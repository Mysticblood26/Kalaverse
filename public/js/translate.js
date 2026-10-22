/* KalaVerse: shows the whole page in the chosen language using PRE-BUILT files (public/data/i18n/<lang>.json).
   No translation API is called while visitors browse. Only KalaSathi, KalaYatri and KalaLens use the AI API.
   Numbers and names (states, art forms, crafts) are swapped through {1} {2} tokens, so one stored sentence fits all of them. */
(function () {
  const lang = window.I18n.lang; if (lang === 'en') return;
  const K = window.KVtr, ATTRS = ['placeholder', 'aria-label', 'title', 'alt'], SKIP = 'script,style,noscript,textarea,[data-notr],.brand,.msg.me,.ym.me';
  const shown = new WeakMap(); let mem = {}, G = null, ready = false, timer = null;
  const nameTr = (v) => mem[v];

  function resolve(raw) {
    const text = raw.replace(/\s+/g, ' ').trim(); if (!text) return null;
    if (!G) return mem[text] || null;
    const tp = K.template(text, G), m = K.mode(text, lang, tp); if (!m) return null;
    if (m === 'names') return tp.vals.every((v) => !v.name || mem[v.v]) ? K.fill(tp.key, tp.vals, nameTr) : null;
    if (mem[tp.key]) { const o = K.fill(mem[tp.key], tp.vals, nameTr); if (o) return o; }
    return mem[text] || null;
  }
  const live = (n) => { const t = n.parentElement && n.parentElement.closest('.t'); return !!(t && t.querySelector('.cur')); }; // chat still typing
  function run() {
    if (!ready) return; obs.disconnect();
    try {
      const w = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
      for (let n = w.nextNode(); n; n = w.nextNode()) {
        const v = n.nodeValue, t = v.trim(); if (!t || !K.LATIN.test(t) && !G || shown.get(n) === v || (n.parentElement && n.parentElement.closest(SKIP)) || live(n)) continue;
        const o = resolve(t); if (o) { const m = v.match(/^(\s*)[\s\S]*?(\s*)$/); n.nodeValue = m[1] + o + m[2]; shown.set(n, n.nodeValue); }
      }
      document.querySelectorAll(ATTRS.map((a) => '[' + a + ']').join(',')).forEach((e) => {
        if (e.closest(SKIP)) return;
        ATTRS.forEach((a) => { const v = e.getAttribute(a); if (!v || !K.LATIN.test(v) || (e.__kvt && e.__kvt[a] === v)) return; const o = resolve(v); if (o) { e.setAttribute(a, o); (e.__kvt = e.__kvt || {})[a] = o; } });
      });
      const ti = resolve(document.title); if (ti && document.title !== ti) document.title = ti;
      const md = document.querySelector('meta[name=description]'); if (md) { const o = resolve(md.content); if (o) md.content = o; }
    } finally { watch(); }
  }
  const obs = new MutationObserver(() => { clearTimeout(timer); timer = setTimeout(run, 40); });
  const watch = () => { obs.observe(document.body, { childList: true, subtree: true, characterData: true, attributes: true, attributeFilter: ATTRS }); const t = document.querySelector('title'); if (t) obs.observe(t, { childList: true }); };
  const get = (u) => fetch(u).then((r) => (r.ok ? r.json() : null)).catch(() => null);
  Promise.all([get('data/i18n/' + lang + '.json'), get('data/heritage.json')]).then(([tr, h]) => {
    mem = tr || {}; if (h) G = K.glossary(K.namesFrom(h));
    ready = true; run();
    if (!tr) console.warn('KalaVerse: public/data/i18n/' + lang + '.json is missing. Run: node scripts/build-translations.js ' + lang);
  });
  watch();
})();
