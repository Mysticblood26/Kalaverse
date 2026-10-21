/* KalaSathi core: intent detection and offline answers. Runs in the browser and in Node. */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.KalaCore = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  const NAMED = { madhubani: 'bihar', mithila: 'bihar', kalamkari: 'andhra_pradesh', warli: 'maharashtra', pichwai: 'rajasthan', pattachitra: 'odisha', patachitra: 'odisha', thangka: 'sikkim', mysore: 'karnataka', gesso: 'karnataka', tanjore: 'tamil_nadu', thanjavur: 'tamil_nadu', kangra: 'himachal_pradesh', pahari: 'himachal_pradesh', gond: 'madhya_pradesh', rogan: 'gujarat', lippan: 'gujarat', kalighat: 'west_bengal', kalamezhuthu: 'kerala', phulkari: 'punjab', cheriyal: 'telangana', nirmal: 'telangana', pithora: 'gujarat', pithoro: 'gujarat', srikalahasti: 'andhra_pradesh', raghurajpur: 'odisha', tibetan: 'sikkim', monpa: 'arunachal_pradesh', muga: 'assam', sualkuchi: 'assam', bastar: 'chhattisgarh', kunbi: 'goa', panipat: 'haryana', sohrai: 'jharkhand', khovar: 'jharkhand', longpi: 'manipur', khasi: 'meghalaya', puan: 'mizoram', naga: 'nagaland', tripuri: 'tripura', aipan: 'uttarakhand', chikankari: 'uttar_pradesh', nicobarese: 'andaman_nicobar', nek: 'chandigarh', dadra: 'dadra_nagar_haveli_daman_diu', varli: 'dadra_nagar_haveli_daman_diu', zardozi: 'delhi', kani: 'jammu_kashmir', ladakhi: 'ladakh', lakshadweep: 'lakshadweep', pondicherry: 'puducherry', puducherry: 'puducherry' };
  const DEV = { 'मधुबनी': 'bihar', 'मिथिला': 'bihar', 'कलमकारी': 'andhra_pradesh', 'वारली': 'maharashtra', 'पिछवाई': 'rajasthan', 'पट्टचित्र': 'odisha', 'थंका': 'sikkim', 'गोंड': 'madhya_pradesh' };
  const UNMAPPED = ['bandhani', 'ikat', 'dhokra', 'kantha', 'patola', 'sanjhi', 'kolam', 'rangoli', 'alpana', 'bidri', 'pashmina', 'channapatna', 'kondapalli', 'saura', 'patua', 'tholu'];
  const GENERIC = ['art', 'arts', 'artform', 'painting', 'paintings', 'craft', 'crafts', 'handicraft', 'handicrafts', 'handloom', 'artisan', 'artisans', 'folk', 'tribal', 'pigment', 'pigments', 'motif', 'motifs', 'kalam', 'textile', 'weaving', 'pottery', 'sculpture', 'mural', 'miniature', 'embroidery', 'drawing', 'scroll', 'dye', 'dyes', 'canvas', 'brush'];
  const DEVGEN = ['कला', 'चित्रकला', 'पेंटिंग', 'चित्र', 'शिल्प', 'लोककला', 'रंगोली', 'कारीगर'];
  const FOLLOW = /\b(why|how|what|which|who|when|where|explain|more|detail|details|elaborate|continue|tell|steps?|materials?|tools?|colou?rs?|history|origin|significance|meaning|example|kyun|kyu|kaise|kya|aur|batao|bataiye|samjhao|isme|iske)\b|क्यों|कैसे|क्या|और|समझाइए|बताइए|इसके|इसमें/i;
  const OFF = [/capital of|prime minister|president of|population of/i, /\b(joke|jokes|riddle|meme)\b/i, /\b(cricket|ipl|football|match|score|stock|bitcoin|crypto|election|politics)\b/i, /\b(python|javascript|java|html|css|sql|program|code|coding|algorithm|debug)\b/i, /\b(weather|temperature|forecast|news|headlines)\b/i, /\b(homework|math|equation|solve|translate|recipe|movie|lyrics)\b/i];
  const BAD = /\b(porn\w*|xxx|nsfw|fuck\w*|bitch\w*|slut\w*|cunt|asshole|bastard|madarchod|behenchod|bhenchod|chutiya\w*|randi|gandu|harami|kamina)\b|नंगी|चूतिया|मादरचोद|भेनचोद/i;
  const BADREQ = /\b(sex\s?(chat|story|video)|nude (pics?|photos?)|send nudes|sexting|erotic story|kill (yourself|myself|you)|how to (hurt|kill|stab|poison)|make a (bomb|weapon)|suicide)\b/i;

  const strip = (s) => s.normalize('NFKD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
  const toks = (s) => strip(s).match(/[a-z]+|[\u0900-\u097F]+/g) || [];
  const first = (s, n) => ((s || '').match(/[^.!?]+[.!?]+(\s|$)/g) || [s || '']).slice(0, n).join('').trim();
  function lev(a, b) {
    const d = Array.from({ length: a.length + 1 }, (_, i) => [i, ...Array(b.length).fill(0)]);
    for (let j = 1; j <= b.length; j++) d[0][j] = j;
    for (let i = 1; i <= a.length; i++) for (let j = 1; j <= b.length; j++)
      d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
    return d[a.length][b.length];
  }
  function fuzzy(t, list) {
    if (list.includes(t)) return t;
    if (t.length < 6) return null;
    return list.find((k) => k.length >= 6 && Math.abs(k.length - t.length) <= 1 && lev(t, k) <= (k.length >= 9 ? 2 : 1)) || null;
  }
  // Multi-word names that single keywords cannot express. Checked before the keyword scan.
  const PHRASES = [[/kerala\s+(temple\s+)?murals?|केरल/i, 'kerala'], [/bengal\s+pa+t+a?chitra/i, 'west_bengal']];
  function scan(text) {
    let id = null, unmapped = null, generic = false;
    const ph = PHRASES.find(([re]) => re.test(text)); if (ph) id = ph[1];
    for (const t of toks(text)) {
      const n = fuzzy(t, Object.keys(NAMED)); if (n) { if (!id) id = NAMED[n]; continue; }
      const u = fuzzy(t, UNMAPPED); if (u) { unmapped = u; continue; }
      if (GENERIC.includes(t)) { generic = true; continue; }
      const dk = Object.keys(DEV).find((w) => t.includes(w)); if (dk) { if (!id) id = DEV[dk]; continue; }
      if (DEVGEN.some((w) => t.includes(w))) generic = true;
    }
    return { id, unmapped, generic };
  }
  function gibberish(text) {
    const t = text.trim();
    if (!/[\p{L}\p{N}]/u.test(t)) return true;
    const w = toks(t);
    if (!w.length) return /\d/.test(t);
    if (/[a-z]+\d+[a-z]*|\d+[a-z]+/i.test(t) && w.length <= 2) return true;
    return w.every((x) => {
      if (/[\u0900-\u097F]/.test(x) || x.length < 4) return false;
      const v = (x.match(/[aeiou]/g) || []).length / x.length;
      return /(.{2,3})\1{1,}/.test(x) || /(.)\1{3,}/.test(x) || /qwert|asdf|sdfg|dfgh|fghj|ghjk|hjkl|zxcv|xcvb|cvbn|wert|erty|rtyu|tyui|yuio|uiop/.test(x) || v < 0.2 || (x.length >= 7 && v < 0.25) || /^(xyz|abc|lorem|test|qwerty)$/.test(x);
    });
  }
  /** Most recent art form named in the conversation. User turns win over assistant turns. */
  function topicFromHistory(history) {
    for (const role of ['user', 'assistant'])
      for (let i = history.length - 1; i >= 0; i--) {
        if (history[i].role !== role) continue;
        const s = scan(String(history[i].content || '').slice(0, 600)); if (s.id) return s.id;
      }
    return null;
  }
  function classify(msg, prior) {
    const text = msg.trim();
    if (BAD.test(text) || BADREQ.test(text)) return { intent: 'inappropriate' };
    const s = scan(text);
    if (s.id) return { intent: 'art', id: s.id };
    if (s.unmapped) return { intent: 'art', unmapped: s.unmapped };
    if (OFF.some((r) => r.test(text)) && !s.generic) return { intent: 'unrelated' };
    if (gibberish(text)) return { intent: 'unclear' };
    const n = toks(text).length;
    // Broad art questions ("tell me about folk art") go to the model without art-form notes. Short ones stay on the current art form.
    if (s.generic) return prior && n <= 4 ? { intent: 'art', id: prior } : { intent: 'art', general: true };
    if (prior && n <= 12 && FOLLOW.test(text)) return { intent: 'followup', id: prior };
    if (n <= 2) return { intent: 'unclear' };
    // No art keyword and not an obvious off-topic word: let the model decide (it redirects politely if unrelated).
    return { intent: 'other' };
  }
  const CANNED = {
    unrelated: { en: 'I am KalaSathi, and I specialise in Indian traditional arts and crafts, so I cannot help with that one. Ask me about a folk painting, a craft technique, the materials an art form uses, or its history, for example "What materials are used in Pattachitra?"', hi: 'मैं कलासाथी हूँ और भारतीय पारंपरिक कला एवं शिल्प में विशेषज्ञ हूँ, इसलिए इस विषय में मदद नहीं कर सकता। आप किसी लोक चित्रकला, शिल्प तकनीक, सामग्री या इतिहास के बारे में पूछ सकते हैं।' },
    inappropriate: { en: 'I cannot respond to that. KalaSathi is here for respectful conversation about Indian art and crafts. If you would like to continue, ask me about a painting style, a technique or a craft tradition.', hi: 'मैं इसका उत्तर नहीं दे सकता। कलासाथी भारतीय कला और शिल्प पर सम्मानजनक चर्चा के लिए है।' },
    unclear: { en: 'I could not tell what you meant. Could you rephrase, or tell me which Indian art form or craft you have in mind, such as Madhubani, Warli or Kalamkari? If it is a name I should know, please share the state or a short description.', hi: 'मैं आपकी बात समझ नहीं पाया। क्या आप बता सकते हैं कि आप किस भारतीय कला या शिल्प के बारे में पूछ रहे हैं, जैसे मधुबनी, वारली या कलमकारी?' },
    ask: { en: 'Which art form do you mean? For example Madhubani, Warli, Kalamkari or Pattachitra.', hi: 'आप किस कला के बारे में पूछ रहे हैं? जैसे मधुबनी, वारली, कलमकारी या पट्टचित्र।' },
  };
  const unknownText = (u) => `I do not have verified notes on ${u[0].toUpperCase() + u.slice(1)} yet. I can explain the art forms in the Explore section, such as Madhubani, Warli or Pattachitra.`;
  const isHi = (s) => /[\u0900-\u097F]/.test(s);
  function facet(q) {
    const s = strip(q);
    if (/material|pigment|colou?r|tools?|samagri/.test(s) || /सामग्री|रंग/.test(q)) return 'materials';
    if (/how|make|create|steps?|draw|banate|banaye|banana|kaise|tutorial/.test(s) || /कैसे|बनाते|बनाएं/.test(q)) return 'steps';
    if (/motif|symbol|pattern/.test(s)) return 'motifs';
    if (/signific|meaning|why|importance|kyun|kyu/.test(s) || /क्यों|महत्व/.test(q)) return 'why';
    if (/histor|origin|where|when|itihas/.test(s) || /इतिहास/.test(q)) return 'history';
    if (/other crafts|also|related/.test(s)) return 'other';
    if (/more|aur batao|detail|elaborate|continue/.test(s) || /और/.test(q)) return 'more';
    return 'overview';
  }
  /** Offline answer built only from the heritage dataset. */
  function answer(st, q) {
    const f = facet(q), L = (a) => a.join(', '), art = st.artForm.replace(/ Painting$/, '');
    const t = {
      materials: `${art} traditionally uses ${L(st.materials.slice(0, 4)).toLowerCase()}.`,
      steps: `To try "${st.tutorial.title}" (${st.tutorial.difficulty.toLowerCase()}, about ${st.tutorial.time}): ${st.tutorial.steps.map((x, i) => `${i + 1}. ${x.title}`).join('; ')}.`,
      motifs: `Key motifs in ${art}: ${L(st.motifs.slice(0, 4).map((m) => m.split(' (')[0]))}.`,
      why: first(st.significance, 2), history: first(st.history, 2),
      other: `Other crafts from ${st.name}: ${L(st.otherCrafts)}.`,
      more: `${first(st.significance, 1)} ${first(st.facts[0] || '', 1)}`,
      overview: `${st.artForm} comes from ${st.name}. ${first(st.history, 1)}`,
    }[f];
    return t + ' Ask me about its materials, history, motifs or how to try it.';
  }
  const overview = (states, lang) => lang === 'hi'
    ? 'कलावर्स में इन कलाओं के नोट्स हैं: ' + states.map((x) => x.artForm.split(/ & | \/ | \(/)[0]).join(', ') + '। किसी एक के बारे में पूछिए, जैसे मधुबनी या वारली।'
    : 'KalaVerse has notes on ' + states.length + ' Indian art traditions: ' + states.map((x) => x.artForm.split(/ & | \/ | \(/)[0] + ' (' + x.name + ')').join(', ') + '. Ask about any one of them, for example "Explain Warli painting".';
  function reply(msg, prior, states) {
    const lang = isHi(msg) ? 'hi' : 'en', r = classify(msg, prior);
    if (['unrelated', 'inappropriate', 'unclear'].includes(r.intent)) return { text: CANNED[r.intent][lang], id: prior, intent: r.intent };
    if (r.unmapped) return { text: unknownText(r.unmapped), id: prior, intent: 'art' };
    if (r.general || r.intent === 'other') return { text: r.general ? overview(states, lang) : CANNED.unrelated[lang], id: prior, intent: r.intent };
    const st = states.find((s) => s.id === r.id);
    return { text: answer(st, msg), id: r.id, intent: r.intent };
  }
  /** Splits model text into paragraph / list blocks with **bold** runs. Plain data only, the page builds DOM from it. */
  function inline(line) {
    let parts = line.replace(/`/g, '').split('**');
    if (parts.length % 2 === 0) parts = [parts.slice(0, -1).join('**'), parts[parts.length - 1]]; // unclosed ** while streaming
    return parts.map((t, i) => ({ t: t.replace(/(^|\s)\*(\S[^*]*)\*(?=\s|$|[.,;:!?])/g, '$1$2').replace(/\*/g, ''), b: i % 2 === 1 })).filter((x) => x.t);
  }
  function blocks(text) {
    const out = []; let cur = null;
    const push = (type, line) => { if (!cur || cur.type !== type) { cur = { type, items: [] }; out.push(cur); } cur.items.push(inline(line)); };
    for (const raw of String(text || '').replace(/\r/g, '').split('\n')) {
      const line = raw.trim();
      if (!line) { cur = null; continue; }
      let m;
      if ((m = line.match(/^[-*\u2022]\s+(.*)$/))) push('ul', m[1]);
      else if ((m = line.match(/^\d{1,2}[.)]\s+(.*)$/))) push('ol', m[1]);
      else if ((m = line.match(/^#{1,6}\s+(.*)$/))) { cur = null; push('p', '**' + m[1].replace(/\*\*/g, '') + '**'); cur = null; }
      else if (cur && cur.type === 'p') cur.items[0].push({ t: ' ', b: false }, ...inline(line));
      else { cur = null; push('p', line); }
    }
    return out;
  }
  return { classify, reply, answer, facet, topicFromHistory, CANNED, isHi, first, blocks };
});
