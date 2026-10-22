'use strict';
/* KalaVerse server: serves the website and proxies KalaSathi chat to a free LLM API.
   The API key stays on the server and is never sent to the browser. No npm packages needed (Node 18+). */
const http = require('http');
const fs = require('fs');
const path = require('path');
const Core = require('./public/js/core.js');

function loadEnv(file) {
  try {
    for (const line of fs.readFileSync(file, 'utf8').split(/\r?\n/)) {
      const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/);
      if (m && !(m[1] in process.env)) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '');
    }
  } catch { /* no .env file */ }
}
loadEnv(path.join(__dirname, '.env'));

const PUBLIC = path.join(__dirname, 'public');
const HERITAGE = JSON.parse(fs.readFileSync(path.join(PUBLIC, 'data', 'heritage.json'), 'utf8'));
const MIME = { '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.json': 'application/json; charset=utf-8', '.svg': 'image/svg+xml', '.ico': 'image/x-icon', '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.jfif': 'image/jpeg', '.webp': 'image/webp', '.gif': 'image/gif' };

// Tried in order. Gemma 4 31B first (Google host, does not train on prompts, 140+ languages incl. Hindi),
// then NVIDIA Nemotron 3 Super, then OpenRouter's own free router as the last safety net.
const DEFAULT_OR_MODELS = 'google/gemma-4-31b-it:free,nvidia/nemotron-3-super-120b-a12b:free,openrouter/free';

function config() {
  const e = process.env;
  let provider = (e.LLM_PROVIDER || '').toLowerCase();
  if (!provider) provider = e.OPENROUTER_API_KEY ? 'openrouter' : e.HF_TOKEN ? 'huggingface' : 'none';
  if (provider === 'huggingface') return { provider, key: e.HF_TOKEN, base: e.LLM_BASE_URL || 'https://router.huggingface.co/v1', models: (e.HF_MODEL || 'Qwen/Qwen3-8B').split(',').map((s) => s.trim()).filter(Boolean) };
  if (provider === 'openrouter') return { provider, key: e.OPENROUTER_API_KEY, base: e.LLM_BASE_URL || 'https://openrouter.ai/api/v1', models: (e.OPENROUTER_MODEL || DEFAULT_OR_MODELS).split(',').map((s) => s.trim()).filter(Boolean) };
  return { provider: 'none', key: '', base: '', models: [] };
}

const LIMIT = { windowMs: 60000, max: Number(process.env.RATE_LIMIT_PER_MIN) || 15 };
const hits = new Map();
setInterval(() => { const now = Date.now(); for (const [ip, arr] of hits) if (!arr.length || now - arr[arr.length - 1] > LIMIT.windowMs) hits.delete(ip); }, 300000).unref();
// Behind Render/Railway/nginx every request comes from the proxy. Set TRUST_PROXY=1 so limits are per visitor, not shared.
function clientIp(req) {
  const n = Number(process.env.TRUST_PROXY) || 0, xff = String(req.headers['x-forwarded-for'] || '').split(',').map((x) => x.trim()).filter(Boolean);
  if (n > 0 && xff.length) return xff[Math.max(0, xff.length - n)];
  return req.socket.remoteAddress || 'unknown';
}
function limited(ip) {
  const now = Date.now(), arr = (hits.get(ip) || []).filter((t) => now - t < LIMIT.windowMs);
  arr.push(now); hits.set(ip, arr);
  return arr.length > LIMIT.max;
}

function contextFor(st) {
  const t = st.tutorial;
  return [
    `Art form: ${st.artForm} (${st.name}, capital ${st.capital}).`,
    `History: ${st.history}`, `Cultural significance: ${st.significance}`,
    `Facts: ${st.facts.join(' ')}`, `Traditional materials: ${st.materials.join('; ')}.`,
    `Key motifs: ${st.motifs.join('; ')}.`, `Other crafts from the state: ${st.otherCrafts.join(', ')}.`,
    `Tutorial "${t.title}" (${t.difficulty}, ${t.time}). Materials: ${t.materials.join('; ')}. Steps: ${t.steps.map((s, i) => `${i + 1}. ${s.title}: ${s.text}`).join(' ')}`,
  ].join('\n').slice(0, 6000);
}

const CATALOG = HERITAGE.states.map((s) => `${s.artForm.split(/ & | \/ | \(/)[0]} (${s.name})`).join(', ');

function systemPrompt(st, intent, hinglish, ulang) {
  return `You are KalaSathi, a cultural guide for traditional Indian arts and crafts on the KalaVerse platform.
Answer questions about Indian traditional art forms, folk paintings, handicrafts, textiles, techniques, materials, history, cultural significance, artisans, and creative ideas, including broad or comparative questions. If the question is clearly about something else, reply in one or two sentences that you only help with Indian arts and crafts and suggest an example question.
KalaVerse has detailed verified notes on these art forms: ${CATALOG}. For broad questions, you may mention a few of them as examples.
Be concise: at most 120 words, or a short list of 3 to 5 items when steps or materials are asked. Answer only what was asked, do not tell the whole story of an art form, use no headings and no emojis, and finish with one short line inviting a specific follow-up.
${ulang === 'en' ? 'Always reply in simple English.' : LANGNAME[ulang] ? `Always reply in ${LANGNAME[ulang]}, written in its own script.` : `Reply in the language the user writes in (English, Hindi, or Hinglish in Roman script${hinglish ? '; this user wrote Hinglish' : ''}).`}
Never invent facts. ${st ? 'Use the VERIFIED NOTES below as your main source and do not contradict them.' : 'You have no verified notes for this question, so answer from well-established general knowledge. If you are not sure what it refers to, say so briefly and ask for the state or a short description.'}
${intent === 'followup' ? 'The latest message is a follow-up, so answer it about the art form in the notes or conversation.' : ''}
${st ? `\nVERIFIED NOTES:\n${contextFor(st)}` : ''}`;
}

function thinkFilter() {
  let buf = '', think = false;
  const run = (t, final) => {
    buf += t; let out = '';
    while (buf) {
      if (think) { const i = buf.indexOf('</think>'); if (i < 0) { buf = final ? '' : buf.slice(-8); return out; } buf = buf.slice(i + 8); think = false; }
      else {
        const i = buf.indexOf('<think>');
        if (i >= 0) { out += buf.slice(0, i); buf = buf.slice(i + 7); think = true; continue; }
        const k = buf.lastIndexOf('<');
        if (!final && k >= 0 && buf.length - k < 8) { out += buf.slice(0, k); buf = buf.slice(k); return out; }
        out += buf; buf = '';
      }
    }
    return out;
  };
  return { push: (t) => run(t, false), flush: () => run('', true) };
}

// Some hosts (older Gemma builds, a few free endpoints) reject the "system" role with HTTP 400.
// Folding the instructions into the last user message is the portable fallback.
function foldSystem(messages) {
  const sys = messages.find((m) => m.role === 'system'), rest = messages.filter((m) => m.role !== 'system');
  while (rest.length && rest[0].role !== 'user') rest.shift();
  if (sys && rest.length) rest[rest.length - 1] = { role: 'user', content: `${sys.content}\n\n---\nUser message:\n${rest[rest.length - 1].content}` };
  return rest;
}

async function streamUpstream(cfg, messages, emit, signal) {
  let lastErr = 'unknown error';
  for (const model of cfg.models) {
    for (const variant of [messages, foldSystem(messages)]) {
      let started = false, retryFolded = false, reasoned = false;
      try {
        const headers = { 'Content-Type': 'application/json', Authorization: `Bearer ${cfg.key}` };
        if (cfg.provider === 'openrouter') { headers['HTTP-Referer'] = process.env.SITE_URL || 'http://localhost:3000'; headers['X-Title'] = 'KalaVerse'; }
        const up = await fetch(`${cfg.base}/chat/completions`, { method: 'POST', headers, signal, body: JSON.stringify({ model, messages: variant, stream: true, max_tokens: cfg.maxTokens || 1500, temperature: 0.4, ...(cfg.provider === 'openrouter' ? { reasoning: { effort: 'low' } } : {}) }) });
        if (!up.ok) { const why = (await up.text().catch(() => '')).replace(/\s+/g, ' ').slice(0, 220); lastErr = `${model}: HTTP ${up.status} ${why}`.trim(); console.warn('Upstream failed', lastErr); if (up.status === 400 && variant === messages) { retryFolded = true; } else break; }
        else {
          const dec = new TextDecoder(), filter = thinkFilter();
          let buf = '';
          for await (const chunk of up.body) {
            buf += dec.decode(chunk, { stream: true });
            const lines = buf.split('\n'); buf = lines.pop();
            for (const raw of lines) {
              const line = raw.trim();
              if (!line.startsWith('data:')) continue;
              const data = line.slice(5).trim();
              if (data === '[DONE]') continue;
              let j; try { j = JSON.parse(data); } catch { continue; }
              if (j.error) throw new Error(j.error.message || 'upstream error');
              const dl = j.choices?.[0]?.delta || {}; if (dl.reasoning || dl.reasoning_content) reasoned = true;
          const txt = filter.push(dl.content || '');
              if (txt) { started = true; emit({ type: 'chunk', text: txt }); }
            }
          }
          const rest = filter.flush(); if (rest) { started = true; emit({ type: 'chunk', text: rest }); }
          if (started) return emit({ type: 'done' });
          lastErr = `${model}: empty response${reasoned ? ' (model used its whole token budget on hidden reasoning)' : ''}`; console.warn('Upstream failed', lastErr); break;
        }
      } catch (e) {
        if (signal.aborted) return;
        lastErr = `${model}: ${e.message}`; console.warn('Upstream error', lastErr);
        if (started) return emit({ type: 'error', message: 'The response was interrupted.', partial: true });
        break;
      }
      if (!retryFolded) break;
    }
  }
  emit({ type: 'error', message: 'The AI service is busy or unavailable. Please try again in a moment.', detail: lastErr });
}

async function handleChat(body, emit, signal) {
  const message = String(body.message || '').trim().slice(0, 500);
  const history = (Array.isArray(body.history) ? body.history : []).slice(-8).map((m) => ({ role: m.role === 'user' ? 'user' : 'assistant', content: String(m.content || '').slice(0, 1200) }));
  const prior = Core.topicFromHistory(history);
  const r = Core.classify(message, prior);
  emit({ type: 'meta', intent: r.intent });
  const ulang = LANGNAME[body.lang] ? body.lang : null;
  const lang = ulang ? (ulang === 'hi' ? 'hi' : 'en') : (Core.isHi(message) ? 'hi' : 'en');
  if (['unrelated', 'inappropriate', 'unclear'].includes(r.intent)) { emit({ type: 'chunk', text: Core.CANNED[r.intent][lang] }); return emit({ type: 'done' }); }
  const cfg = config();
  if (cfg.provider === 'none' || !cfg.key) return emit({ type: 'error', code: 'no_key', message: 'No API key is configured on the server.' });
  const st = r.id ? HERITAGE.states.find((s) => s.id === r.id) : null;
  const hinglish = /\b(kaise|kya|hai|hain|banate|banaye|batao|bataiye|kyun|aur|samjhao|chahiye)\b/i.test(message);
  const messages = [{ role: 'system', content: systemPrompt(st, r.intent, hinglish, ulang) }, ...history, { role: 'user', content: message }];
  await streamUpstream(cfg, messages, emit, signal);
}

function readBody(req, max = 20000) {
  return new Promise((resolve, reject) => {
    let size = 0; const parts = [];
    req.on('data', (c) => { size += c.length; if (size > max) { reject(new Error('too large')); req.destroy(); } else parts.push(c); });
    req.on('end', () => { try { resolve(JSON.parse(Buffer.concat(parts).toString() || '{}')); } catch (e) { reject(e); } });
    req.on('error', reject);
  });
}

const LANGNAME = { en: 'English', hi: 'Hindi', ml: 'Malayalam', pa: 'Punjabi', as: 'Assamese', gu: 'Gujarati', kn: 'Kannada', or: 'Odia', ta: 'Tamil', te: 'Telugu', bn: 'Bengali', mr: 'Marathi' };
const langRule = (c) => (c === 'en' || !LANGNAME[c] ? 'Reply in simple English unless the user writes in another language.' : `Always reply in ${LANGNAME[c]}, written in its own script.`);

// ---- KalaYatri: travel-planning agent (streams like /api/chat) ----
async function handleYatri(body, emit, signal) {
  const message = String(body.message || '').trim().slice(0, 600);
  const history = (Array.isArray(body.history) ? body.history : []).slice(-10).map((m) => ({ role: m.role === 'user' ? 'user' : 'assistant', content: String(m.content || '').slice(0, 1200) }));
  const cfg = config(), trav = Math.max(1, Math.min(50, parseInt(body.travellers, 10) || 1));
  if (cfg.provider === 'none' || !cfg.key) return emit({ type: 'error', code: 'no_key', message: 'No API key is configured on the server.' });
  const text = (message + ' ' + history.map((h) => h.content).join(' ')).toLowerCase();
  const hit = HERITAGE.states.filter((s) => text.includes(s.name.toLowerCase())).slice(0, 2);
  const notes = hit.map((s) => { const t = HERITAGE.tours.find((x) => x.state === s.name); return contextFor(s).slice(0, 1400) + (t ? `\nOne-day trail: ${t.title}. ${t.highlights.join('; ')}. Tips: ${(t.tips || []).join('; ')}` : ''); }).join('\n\n');
  const sys = `You are KalaYatri, a friendly travel-planning agent for trips built around Indian traditional art, crafts and culture.
${langRule(body.lang)}
Group size: ${trav} traveller${trav === 1 ? '' : 's'} (taken from the Travellers box in the chat). Plan for exactly this many people and do not ask how many are travelling.
If something essential is missing (destination state, starting city, number of days, interests), ask ONE short question. Otherwise give a concise plan: day-wise lines with places, artisan workshops and local food, best season, and how to reach by train, flight or road in general terms. Mention accessibility only if asked.
Never invent prices, timetables, phone numbers or booking confirmations. KalaVerse has a demo ticket page: when you give a plan, end with one short line saying the person can tap "Book tickets" under your message to book sample tickets for it. Those tickets are a demo, not real, so for real travel tell them to check the railway, airline and venue websites. At most 170 words, plain text, use lines starting with "-" for lists, no emojis, no headings.
Art destinations KalaVerse knows: ${CATALOG}.${notes ? `\nVERIFIED NOTES:\n${notes}` : ''}`;
  await streamUpstream(cfg, [{ role: 'system', content: sys }, ...history, { role: 'user', content: message }], emit, signal);
}

// ---- KalaLens: vision feedback on an uploaded artwork ----
async function handleLens(body, emit, signal) {
  const img = String(body.image || '');
  if (!/^data:image\/(jpeg|png|webp);base64,/.test(img) || img.length > 1500000) return emit({ type: 'error', message: 'Please send a smaller JPG, PNG or WebP image.' });
  const st = HERITAGE.states.find((s) => s.id === body.art) || HERITAGE.states[0];
  // Providers that can look at images, tried in order. Gemini first (free key from aistudio.google.com), then OpenRouter.
  const e = process.env, cfg = config(), tries = [];
  if (e.GEMINI_API_KEY) tries.push({ provider: 'gemini', maxTokens: 4000, key: e.GEMINI_API_KEY, base: e.GEMINI_OPENAI_URL || 'https://generativelanguage.googleapis.com/v1beta/openai', models: (e.GEMINI_VISION_MODEL || e.GEMINI_MODEL || 'gemini-3.5-flash-lite,gemini-3.1-flash-lite').split(',').map((x) => x.trim()).filter(Boolean) });
  if (e.OPENROUTER_API_KEY) tries.push({ provider: 'openrouter', maxTokens: 4000, key: e.OPENROUTER_API_KEY, base: e.LLM_BASE_URL || 'https://openrouter.ai/api/v1', models: (e.OPENROUTER_VISION_MODEL || 'google/gemma-4-31b-it:free').split(',').map((x) => x.trim()).filter(Boolean) });
  if (!tries.length) return emit({ type: 'error', code: 'no_key', message: 'No API key is configured on the server.' });
  const prompt = `You are KalaLens, an honest and kind mentor for learners of ${st.artForm} from ${st.name}. Study the uploaded image carefully and base EVERYTHING on what you actually see in it: its subject, motifs, border, line work, colours, composition and how it compares with the traditional style.
If the image is NOT an artwork, return {"overall":null,"summary":"<one short sentence saying so>","ratings":[],"colours":[],"strengths":[],"improvements":[],"practice":[]}.
Otherwise return ONLY one JSON object, with no markdown and no text around it, in exactly this shape:
{"summary":"2 or 3 sentences describing what you see in this specific piece and how it fits ${st.artForm}",
"ratings":[{"name":"aspect name","note":"one sentence naming a specific strength AND a specific flaw you can see in this aspect","score":<integer 0-100>}],
"colours":[{"name":"colour name","hex":"#rrggbb"}],
"strengths":["2 things done well, specific to this image"],
"improvements":["3 concrete improvements, specific to this image"],
"practice":["2 exercises or things to study next, specific to ${st.artForm}"]}
Do NOT output an overall score; it is calculated from the ratings.
Give exactly these 5 ratings, in this order, with exactly these names: "Line work", "Colour palette", "Motif authenticity", "Composition", "Detail and finish". Write the note FIRST (the evidence), then the score that the evidence deserves.
Scoring scale, used strictly: 90-100 = master or exhibition quality; 75-89 = skilled, only small flaws; 60-74 = competent, clear flaws; 40-59 = beginner, many flaws; 20-39 = rough attempt; 0-19 = barely recognisable. Most learner work falls between 35 and 75. Use the whole range, never default to a comfortable middle number, and make the five scores differ according to the evidence (a strong aspect and a weak aspect should be at least 15 points apart when the image shows it). Judge only what is visible, and compare it with the real traditional style of ${st.artForm}.
List the 4 or 5 dominant colours really visible, with approximate hex codes. Every sentence at most 25 words. No emojis. Keep the JSON keys in English; write every value (notes, sentences) in the language below, but keep the five aspect names exactly as written in English.
${langRule(body.lang)}
Verified notes about the art form:\n${contextFor(st).slice(0, 2500)}`;
  const msgs = [{ role: 'user', content: [{ type: 'text', text: prompt }, { type: 'image_url', image_url: { url: img } }] }];
  let failed = null;
  for (const t of tries) {
    let got = false;
    const hold = (ev) => { if (ev.type === 'error' && !ev.partial) { failed = ev; return; } if (ev.type === 'chunk') got = true; if (ev.type !== 'done') emit(ev); };   // hold back errors until every provider failed
    await streamUpstream(t, msgs, hold, signal);
    if (got || signal.aborted) return;
    console.warn('KalaLens: ' + t.provider + ' failed, trying the next provider.', failed && failed.detail);
  }
  emit({ type: 'error', message: (failed && failed.message) || 'The AI service is busy or unavailable. Please try again in a moment.', detail: failed && failed.detail });
}

// ---- KalaLens step 1: identify WHICH traditional art form a picture is (Gemini, structured JSON output) ----
// Uses Gemini's native API with a response schema, so the answer is always one of the known art ids (or "none").
// temperature 0 makes the answer repeatable. The model must list what it sees BEFORE it chooses, which improves accuracy.
const ART_IDS = HERITAGE.states.map((s) => s.id);
const ART_GUIDE = HERITAGE.states.map((s) => `- ${s.id} = ${s.artForm} (${s.name}). Typical look: ${s.motifs.slice(0, 3).map((m) => m.replace(/\s*\(.*?\)\s*/g, '')).join(', ')}. Materials: ${s.materials.slice(0, 2).map((m) => m.replace(/\s*\(.*?\)\s*/g, '')).join(', ')}.`).join('\n');
const DEAD_MODELS = new Set();   // model ids Google answered 404 for, so we stop asking
function detectModels() {
  const e = process.env;
  return (e.GEMINI_DETECT_MODEL || ['gemini-3.5-flash', e.GEMINI_VISION_MODEL, e.GEMINI_MODEL, 'gemini-3.5-flash-lite', 'gemini-3.1-flash-lite'].filter(Boolean).join(',')).split(',').map((x) => x.trim()).filter(Boolean).filter((x, i, a) => a.indexOf(x) === i);
}
const DETECT_SCHEMA = {
  type: 'OBJECT', propertyOrdering: ['is_traditional_artwork', 'visible_features', 'candidates', 'best_id', 'best_confidence', 'reason'],
  required: ['is_traditional_artwork', 'visible_features', 'candidates', 'best_id', 'best_confidence', 'reason'],
  properties: {
    is_traditional_artwork: { type: 'BOOLEAN' },
    visible_features: { type: 'STRING' },
    candidates: { type: 'ARRAY', items: { type: 'OBJECT', propertyOrdering: ['id', 'confidence'], required: ['id', 'confidence'], properties: { id: { type: 'STRING', format: 'enum', enum: ART_IDS }, confidence: { type: 'NUMBER' } } } },
    best_id: { type: 'STRING', format: 'enum', enum: [...ART_IDS, 'none'] },
    best_confidence: { type: 'NUMBER' },
    reason: { type: 'STRING' },
  },
};
function detectPrompt() {
  return `You are an expert curator of Indian traditional paintings, textiles and crafts. Identify which art form the attached picture belongs to.
Choose ONLY from this list of ids:
${ART_GUIDE}

Method (follow it in order and write the result in the JSON fields):
1. visible_features: describe in 2 to 4 short sentences what you actually SEE: the medium (paper, cloth, wall, metal, clay, fabric), line work (double lines, dots, stick figures, fine miniature lines, bold outlines), colours (natural earthy, gold leaf, red and white, black and white), figures, borders and composition. Do not guess from the file, only from what is visible.
2. candidates: the 3 most likely ids with confidence from 0 to 1, best first. Confidences must reflect real doubt, so they must not all be high.
3. best_id: the single best id. If the picture is not a traditional Indian art form or craft (a photo of a person, a landscape, a screenshot, Western or digital art, a cartoon), or if you cannot tell, use "none" and set is_traditional_artwork to false when it is not an artwork at all.
4. reason: one sentence naming the strongest visual evidence for best_id, for example "Double-line borders and fish motifs are typical of Madhubani".
Tell similar styles apart carefully: Madhubani (bihar) has double-line borders and filled flat colour; Warli (maharashtra) is white stick figures on a mud-coloured ground; Gond (madhya_pradesh) fills animals with dots and dashes; Pattachitra (odisha) has bold outlines, floral borders and mythological faces on cloth; Kalamkari (andhra_pradesh) is pen-drawn natural-dye cloth with a tree of life; Pichwai and Pahari/Kangra are fine miniatures; Thanjavur has raised gold-leaf gesso and gems; Mysore is gold gesso with muted colour; Kalighat has bold brush outlines and flat figures; Thangka is a Buddhist cloth scroll.
Return only the JSON.`;
}
async function geminiDetect(img, signal) {
  const e = process.env, key = e.GEMINI_API_KEY, base = (e.GEMINI_NATIVE_URL || 'https://generativelanguage.googleapis.com/v1beta').replace(/\/$/, '');
  const m = img.match(/^data:(image\/(?:jpeg|png|webp));base64,(.+)$/s);
  const body = { contents: [{ role: 'user', parts: [{ text: detectPrompt() }, { inline_data: { mime_type: m[1], data: m[2] } }] }], generationConfig: { temperature: 0, maxOutputTokens: 1500, responseMimeType: 'application/json', responseSchema: DETECT_SCHEMA } };
  let lastErr = 'no model could be used';
  for (const model of detectModels()) {
    if (DEAD_MODELS.has(model)) continue;
    try {
      const r = await fetch(`${base}/models/${encodeURIComponent(model)}:generateContent`, { method: 'POST', signal, headers: { 'Content-Type': 'application/json', 'x-goog-api-key': key }, body: JSON.stringify(body) });
      if (!r.ok) { const why = (await r.text().catch(() => '')).replace(/\s+/g, ' ').slice(0, 200); lastErr = `${model}: HTTP ${r.status} ${why}`; console.warn('KalaLens detect failed', lastErr); if (r.status === 404) DEAD_MODELS.add(model); if (r.status === 401 || r.status === 403 || (r.status === 400 && /API key/i.test(why))) return { error: 'bad_key', detail: lastErr }; continue; }
      const j = await r.json(), txt = (j.candidates?.[0]?.content?.parts || []).map((p) => p.text || '').join('');
      const o = JSON.parse(txt.replace(/```(?:json)?/gi, '').trim());
      return { model, o };
    } catch (err) { if (signal.aborted) return { error: 'aborted' }; lastErr = `${model}: ${err.message}`; console.warn('KalaLens detect error', lastErr); }
  }
  return { error: 'unavailable', detail: lastErr };
}
async function handleDetect(body, signal) {
  const img = String(body.image || '');
  if (!/^data:image\/(jpeg|png|webp);base64,/.test(img) || img.length > 2500000) return { error: 'bad_image', message: 'Please send a smaller JPG, PNG or WebP image.' };
  if (!process.env.GEMINI_API_KEY) return { error: 'no_key', message: 'Auto-detect needs GEMINI_API_KEY on the server.' };
  const r = await geminiDetect(img, signal);
  if (r.error) return { error: r.error, message: r.error === 'bad_key' ? 'The Gemini API key was rejected.' : 'The detection service is busy or unavailable. Please try again.', detail: r.detail };
  const o = r.o || {}, name = (id) => { const s = HERITAGE.states.find((x) => x.id === id); return s ? { id: s.id, state: s.name, artForm: s.artForm } : null; };
  const cands = (Array.isArray(o.candidates) ? o.candidates : []).filter((c) => c && ART_IDS.includes(c.id)).map((c) => ({ ...name(c.id), confidence: Math.max(0, Math.min(1, Number(c.confidence) || 0)) })).sort((a, b) => b.confidence - a.confidence).filter((c, i, a) => a.findIndex((d) => d.id === c.id) === i).slice(0, 3);
  let best = ART_IDS.includes(o.best_id) ? o.best_id : null, conf = Math.max(0, Math.min(1, Number(o.best_confidence) || 0));
  if (best && cands.length && cands[0].id !== best) { const c = cands.find((x) => x.id === best); conf = c ? Math.min(conf, c.confidence) : Math.min(conf, 0.5); }
  const art = o.is_traditional_artwork !== false && best ? name(best) : null;
  const margin = cands.length > 1 && cands[0].id === best ? cands[0].confidence - cands[1].confidence : 1;
  // 'sure' only when the model is confident AND the runner-up is clearly behind. Otherwise the page asks the person to confirm.
  return { ok: true, model: r.model, art, confidence: conf, sure: !!art && conf >= 0.75 && margin >= 0.2, candidates: cands, features: String(o.visible_features || '').slice(0, 600), reason: String(o.reason || '').slice(0, 300) };
}

const hits2 = new Map();
function limited2(ip, max) { const now = Date.now(), arr = (hits2.get(ip) || []).filter((t) => now - t < 60000); arr.push(now); hits2.set(ip, arr); return arr.length > max; }

const SECURITY = {
  'Content-Security-Policy': "default-src 'self'; style-src 'self' https://fonts.googleapis.com; font-src https://fonts.gstatic.com; img-src 'self' data:; connect-src 'self'; base-uri 'none'; form-action 'self'; frame-ancestors 'none'",
  'Referrer-Policy': 'strict-origin-when-cross-origin', 'X-Content-Type-Options': 'nosniff', 'Permissions-Policy': 'camera=(), microphone=(), geolocation=()',
};

function serveStatic(req, res) {
  let p = decodeURIComponent(new URL(req.url, 'http://x').pathname);
  if (p === '/') p = '/index.html';
  const file = path.normalize(path.join(PUBLIC, p));
  if (!file.startsWith(PUBLIC + path.sep)) { res.writeHead(403); return res.end('Forbidden'); }
  fs.readFile(file, (err, data) => {
    if (err) { res.writeHead(404, { 'Content-Type': 'text/plain' }); return res.end('Not found'); }
    res.writeHead(200, { 'Content-Type': MIME[path.extname(file)] || 'application/octet-stream', 'Cache-Control': ['.html', '.js', '.css'].includes(path.extname(file)) ? 'no-cache' : 'public, max-age=300', ...SECURITY });
    res.end(data);
  });
}

function createServer() {
  return http.createServer(async (req, res) => {
    const url = new URL(req.url, 'http://x');
    try {
      if (req.method === 'GET' && url.pathname === '/api/status') {
        const c = config(); res.writeHead(200, { 'Content-Type': 'application/json' });
        return res.end(JSON.stringify({ provider: c.provider, configured: !!c.key }));
      }
      if (req.method === 'POST' && url.pathname === '/api/chat') {
        const ip = clientIp(req);
        if (limited(ip)) { res.writeHead(429, { 'Content-Type': 'application/json' }); return res.end(JSON.stringify({ error: 'Too many requests. Please wait a minute.' })); }
        let body; try { body = await readBody(req); } catch { res.writeHead(400, { 'Content-Type': 'application/json' }); return res.end(JSON.stringify({ error: 'Invalid request' })); }
        if (!String(body.message || '').trim()) { res.writeHead(400, { 'Content-Type': 'application/json' }); return res.end(JSON.stringify({ error: 'Message is required' })); }
        res.writeHead(200, { 'Content-Type': 'text/event-stream; charset=utf-8', 'Cache-Control': 'no-cache, no-transform', Connection: 'keep-alive', 'X-Accel-Buffering': 'no' });
        const ctl = new AbortController(); res.on('close', () => ctl.abort());
        const emit = (e) => { if (!res.writableEnded) res.write(`data: ${JSON.stringify(e)}\n\n`); };
        try { await handleChat(body, emit, ctl.signal); } catch (e) { console.error(e); emit({ type: 'error', message: 'Unexpected server error.' }); }
        return res.end();
      }
      if (req.method === 'POST' && url.pathname === '/api/lens-detect') {
        const ip = clientIp(req);
        const json = (code, obj) => { res.writeHead(code, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' }); res.end(JSON.stringify(obj)); };
        if (limited2(ip + url.pathname, 10)) return json(429, { error: 'rate', message: 'Too many uploads in a short time. Please wait a minute.' });
        let body; try { body = await readBody(req, 3000000); } catch { return json(400, { error: 'bad_image', message: 'Invalid request' }); }
        const ctl = new AbortController(); res.on('close', () => ctl.abort());
        try { return json(200, await handleDetect(body, ctl.signal)); } catch (e) { console.error(e); return json(500, { error: 'server', message: 'Unexpected server error.' }); }
      }
      if (req.method === 'POST' && (url.pathname === '/api/yatri' || url.pathname === '/api/lens')) {
        const ip = clientIp(req), lens = url.pathname === '/api/lens';
        if (limited2(ip + url.pathname, lens ? 8 : 15)) { res.writeHead(429, { 'Content-Type': 'application/json' }); return res.end(JSON.stringify({ error: 'Too many requests. Please wait a minute.' })); }
        let body; try { body = await readBody(req, lens ? 2000000 : 20000); } catch { res.writeHead(400, { 'Content-Type': 'application/json' }); return res.end(JSON.stringify({ error: 'Invalid request' })); }
        res.writeHead(200, { 'Content-Type': 'text/event-stream; charset=utf-8', 'Cache-Control': 'no-cache, no-transform', Connection: 'keep-alive', 'X-Accel-Buffering': 'no' });
        const ctl = new AbortController(); res.on('close', () => ctl.abort());
        const emit = (e) => { if (!res.writableEnded) res.write(`data: ${JSON.stringify(e)}\n\n`); };
        try { await (lens ? handleLens : handleYatri)(body, emit, ctl.signal); emit({ type: 'done' }); } catch (e) { console.error(e); emit({ type: 'error', message: 'Unexpected server error.' }); }
        return res.end();
      }
      if (req.method === 'GET' || req.method === 'HEAD') return serveStatic(req, res);
      res.writeHead(405); res.end();
    } catch (e) { console.error(e); if (!res.headersSent) res.writeHead(500); res.end(); }
  });
}

if (require.main === module) {
  const port = Number(process.env.PORT) || 3000, c = config();
  createServer().listen(port, () => {
    console.log(`KalaVerse running at http://localhost:${port}`);
    console.log('Translations: pre-built files in public/data/i18n (no API used). The AI key is used only by KalaSathi, KalaYatri and KalaLens.');
    console.log(c.key ? `Chat provider: ${c.provider}, models: ${c.models.join(', ')}` : 'No API key found in .env. KalaSathi will use offline heritage notes. See README.md.');
  });
}
module.exports = { createServer, config, thinkFilter, foldSystem, handleDetect };