'use strict';
/* Offline translation engine. Used ONLY by scripts/build-translations.js (run once, results are committed).
   The running website never calls it. Providers, in order (each one only if its key is set):
   1. gemini        GEMINI_API_KEY            free key from https://aistudio.google.com/apikey (free tier, all Indian languages)
   2. google-cloud  GOOGLE_TRANSLATE_API_KEY  Cloud Translation v2, first 500,000 characters per month free
   3. sarvam        SARVAM_API_KEY            Indian-made, all 22 languages, Rs 100 free credit (about 50,000 characters)
   4. google-web    no key                    slow, rate limited per IP, last resort
   TRANSLATE_ENGINE=gemini|google-cloud|sarvam|google-web|web forces ONE provider. */
const T = require('../public/js/trutil.js');
const LANGNAME = { hi: 'Hindi', ml: 'Malayalam', pa: 'Punjabi', as: 'Assamese', gu: 'Gujarati', kn: 'Kannada', or: 'Odia', ta: 'Tamil', te: 'Telugu', bn: 'Bengali', mr: 'Marathi' };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const GTX = () => process.env.TRANSLATE_GTX_URL || 'https://translate.googleapis.com/translate_a/single';

let lastCall = 0;
async function gate() { const wait = lastCall + (Number(process.env.TRANSLATE_GAP_MS) || 1500) - Date.now(); lastCall = Date.now() + Math.max(0, wait); if (wait > 0) await sleep(wait); }
async function gtxOne(lang, text) {
  await gate();
  const body = new URLSearchParams({ client: 'gtx', sl: 'en', tl: lang, dt: 't', q: text });
  const r = await fetch(GTX(), { method: 'POST', body, signal: AbortSignal.timeout(20000) });
  if (!r.ok) throw new Error('gtx HTTP ' + r.status);
  const j = await r.json(); return (j[0] || []).map((x) => x[0]).join('');
}
async function gtx(lang, texts) {
  const joined = texts.join('\n');
  if (joined.length < 1800 && texts.every((t) => !t.includes('\n'))) {
    try { const out = (await gtxOne(lang, joined)).split('\n'); if (out.length === texts.length) return out; } catch (e) { if (/429|403/.test(e.message)) throw e; }
  }
  const out = []; for (const t of texts) { try { out.push(await gtxOne(lang, t)); } catch (e) { if (/429|403/.test(e.message)) throw e; out.push(null); } } return out;
}

/* Plain MT services can drop or reformat {1}. Swap it for 7001 (numbers survive), and map native digits back afterwards. */
const toNum = (t) => t.replace(/\{(\d+)\}/g, (m, n) => String(7000 + Number(n)));
const digit = (c) => { const cp = c.codePointAt(0); for (const base of [0x966, 0x9E6, 0xA66, 0xAE6, 0xB66, 0xBE6, 0xC66, 0xCE6, 0xD66]) if (cp >= base && cp < base + 10) return String(cp - base); return c; };
const fromNum = (t) => String(t).replace(/[\u0966-\u096F\u09E6-\u09EF\u0A66-\u0A6F\u0AE6-\u0AEF\u0B66-\u0B6F\u0BE6-\u0BEF\u0C66-\u0C6F\u0CE6-\u0CEF\u0D66-\u0D6F]/g, digit).replace(/(?<!\d)70(\d\d)(?!\d)/g, (m, n) => '{' + Number(n) + '}');
const SARVAM_CODE = { hi: 'hi-IN', ml: 'ml-IN', pa: 'pa-IN', as: 'as-IN', gu: 'gu-IN', kn: 'kn-IN', or: 'od-IN', ta: 'ta-IN', te: 'te-IN', bn: 'bn-IN', mr: 'mr-IN' };

async function httpJson(url, opt, label) {
  const r = await fetch(url, { signal: AbortSignal.timeout(30000), ...opt });
  if (!r.ok) { const body = await r.text().catch(() => ''); throw new Error(label + ' HTTP ' + r.status + (r.status === 400 || r.status === 401 || r.status === 403 ? ' ' + body.slice(0, 160) : '')); }
  return r.json();
}
const decodeHtml = (s) => String(s).replace(/&#(\d+);/g, (m, n) => String.fromCodePoint(Number(n))).replace(/&quot;/g, '"').replace(/&apos;|&#39;/g, "'").replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&');

/** Google Cloud Translation v2 (official API key, 500k characters per month free). */
async function googleCloud(lang, texts) {
  const base = process.env.GOOGLE_TRANSLATE_URL || 'https://translation.googleapis.com/language/translate/v2';
  const j = await httpJson(base + '?key=' + encodeURIComponent(process.env.GOOGLE_TRANSLATE_API_KEY), { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ q: texts.map(toNum), source: 'en', target: lang, format: 'text' }) }, 'google-cloud');
  const arr = (j.data && j.data.translations) || [];
  return texts.map((_, i) => (arr[i] ? fromNum(decodeHtml(arr[i].translatedText)) : null));
}

/** Sarvam AI sarvam-translate:v1. One string per request, a few in parallel. */
async function sarvam(lang, texts) {
  const url = process.env.SARVAM_URL || 'https://api.sarvam.ai/translate';
  const one = async (t) => {
    const j = await httpJson(url, { method: 'POST', headers: { 'Content-Type': 'application/json', 'api-subscription-key': process.env.SARVAM_API_KEY }, body: JSON.stringify({ input: toNum(t), source_language_code: 'en-IN', target_language_code: SARVAM_CODE[lang], model: 'sarvam-translate:v1', numerals_format: 'international' }) }, 'sarvam');
    return j.translated_text ? fromNum(j.translated_text) : null;
  };
  const out = new Array(texts.length).fill(null);
  for (let i = 0; i < texts.length; i += 4) { await Promise.all(texts.slice(i, i + 4).map(async (t, n) => { out[i + n] = await one(t); })); }
  return out;
}
function parseArr(txt) {
  const t = String(txt || '').replace(/^```(?:json)?\s*|\s*```$/g, '').trim(), i = t.indexOf('['), k = t.lastIndexOf(']');
  if (i < 0 || k < i) return null; try { const a = JSON.parse(t.slice(i, k + 1)); return Array.isArray(a) ? a : null; } catch { return null; }
}
let lastGem = 0;   // Gemini free tier is about 15 requests per minute: keep a gap between calls
async function gemini(lang, texts) {
  const gap = Number(process.env.TRANSLATE_GEMINI_GAP_MS) || 4500, wait = lastGem + gap - Date.now(); lastGem = Date.now() + Math.max(0, wait); if (wait > 0) await sleep(wait);
  const prompt = `Translate every string in this JSON array from English to ${LANGNAME[lang]}, written in its own script. Keep the site names KalaVerse, KalaSathi, KalaLens, KalaTour, KalaYatri in Latin letters. Write names of places, states, art forms and crafts in ${LANGNAME[lang]} script (transliterate). Tokens like {1} {2} are placeholders: keep each exactly once, unchanged. Keep numbers and Rs. Return ONLY a JSON array of exactly ${texts.length} strings in the same order.\n` + JSON.stringify(texts);
  let last, limited = 0; const models = (process.env.GEMINI_MODEL || 'gemini-3.5-flash-lite,gemini-3.1-flash-lite').split(',').map((x) => x.trim()).filter(Boolean);
  for (const m of (process.env.GEMINI_MODEL || 'gemini-3.5-flash-lite,gemini-3.1-flash-lite').split(',').map((s) => s.trim()).filter(Boolean)) {
    try {
      const r = await fetch(`${process.env.GEMINI_URL || 'https://generativelanguage.googleapis.com/v1beta'}/models/${encodeURIComponent(m)}:generateContent`, { method: 'POST', signal: AbortSignal.timeout(60000), headers: { 'Content-Type': 'application/json', 'x-goog-api-key': process.env.GEMINI_API_KEY }, body: JSON.stringify({ contents: [{ role: 'user', parts: [{ text: prompt }] }], generationConfig: { temperature: 0, responseMimeType: 'application/json' } }) });
      if (!r.ok) { last = new Error(m + ' HTTP ' + r.status); if (r.status === 429) limited++; continue; }   // 429 on this model: try the next one (each model has its own quota)
      const j = await r.json(), arr = parseArr(((j.candidates?.[0]?.content?.parts) || []).map((x) => x.text || '').join(''));
      if (arr && arr.length === texts.length) return arr.map((x) => (typeof x === 'string' ? x : null));
      last = new Error(m + ' bad shape');
    } catch (e) { last = e; }
  }
  if (limited && limited >= models.length) throw new Error('429 all Gemini models are rate limited');
  throw last || new Error('gemini failed');
}
const ok = (lang, src, out) => typeof out === 'string' && out.trim() && T.tokensOf(src) === T.tokensOf(out) && T.looksTranslated(lang, src, T.normTokens(out));


/** Providers that are usable right now, in order. Each is [name, fn, max strings per call]. */
function providers() {
  const e = process.env, force = String(e.TRANSLATE_ENGINE || 'auto').toLowerCase().replace(/^web$/, 'google-web'), all = [];
  if (e.GEMINI_API_KEY) all.push(['gemini', gemini, 40]);
  if (e.GOOGLE_TRANSLATE_API_KEY) all.push(['google-cloud', googleCloud, 50]);
  if (e.SARVAM_API_KEY) all.push(['sarvam', sarvam, 20]);
  if (e.TRANSLATE_FREE !== '0' || force === 'google-web') all.push(['google-web', gtx, 25]);
  return force !== 'auto' && force !== 'indictrans' ? all.filter((p) => p[0] === force) : all;
}
const providerNames = () => providers().map((p) => p[0]);

/** Translate texts -> array (null where every provider failed). Calls onBatch(texts, results) after each batch so callers can save. */
async function translate(lang, texts, onBatch, log = console.log) {
  const res = new Array(texts.length).fill(null), provs = providers();
  if (!provs.length) throw new Error('No translation provider. Put GEMINI_API_KEY (free, https://aistudio.google.com/apikey) in .env, or leave TRANSLATE_FREE on.');
  const dead = new Set(); let rl = 0;
  const base = Number(process.env.TRANSLATE_BACKOFF_MS) || 30000;
  for (let i = 0; i < texts.length; ) {
    const idx = []; let size = 0;
    while (i < texts.length && idx.length < 40 && size + texts[i].length < 4000) { size += texts[i].length; idx.push(i++); }
    if (!idx.length) idx.push(i++);
    let pending = idx;
    for (const [name, fn, max] of provs) {
      let tries = 0;
      while (pending.length && !dead.has(name) && tries < 3) {
        try {
          const part = pending.slice(0, max), out = await fn(lang, part.map((k) => texts[k]));
          rl = 0; let good = 0;
          part.forEach((k, n) => { if (ok(lang, texts[k], out[n])) { res[k] = T.normTokens(out[n]).trim(); good++; } });
          pending = pending.filter((k) => res[k] == null);
          if (!good) tries++;
        } catch (e) {
          if (/429|403/.test(e.message)) {            // rate limited: wait, then retry the SAME batch (does not count as a failed try)
            if (++rl > 6) { const err = new Error('RATE_LIMIT'); err.rate = true; throw err; }
            const w = Math.min(base * 2 ** (rl - 1), 600000); log(`  ${name}: rate limited (429). Waiting ${Math.round(w / 1000)}s, then continuing...`); await sleep(w);
          } else { log(`  ${name} ${lang}: ${e.message}`); if (++tries >= 3) dead.add(name); }
        }
      }
    }
    if (onBatch) onBatch(idx.map((k) => texts[k]), idx.map((k) => res[k]));
  }
  return res;
}
module.exports = { translate, LANGNAME, ok, providerNames };