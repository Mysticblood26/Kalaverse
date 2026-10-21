/* KalaVerse translation helpers. Shared by the browser (translate.js) and Node (server, scripts).
   Numbers and known names (states, capitals, art forms, crafts) are swapped for {1}, {2}... tokens before
   translating, so "Sample price Rs 5,300" and "Sample price Rs 7,500" share ONE cached translation. */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.KVtr = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  const esc = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const SCRIPT = {
    hi: /[\u0900-\u097F]/, mr: /[\u0900-\u097F]/, bn: /[\u0980-\u09FF]/, as: /[\u0980-\u09FF]/, pa: /[\u0A00-\u0A7F]/, gu: /[\u0A80-\u0AFF]/,
    or: /[\u0B00-\u0B7F]/, ta: /[\u0B80-\u0BFF]/, te: /[\u0C00-\u0C7F]/, kn: /[\u0C80-\u0CFF]/, ml: /[\u0D00-\u0D7F]/,
  };
  const LATIN = /[A-Za-z]{2}/;
  const TOKEN = /[{\uFF5B]\s*(\d+)\s*[}\uFF5D]/g;

  /** Every name on the site that should be written in the reader's script wherever it appears. */
  function namesFrom(h) {
    const out = [];
    ((h && h.states) || []).forEach((s) => {
      out.push(s.name, s.capital, s.artForm, ...String(s.artForm).split(/ & | \/ | \(/).map((x) => x.replace(/\)$/, '')), ...(s.otherCrafts || []));
      if (s.tutorial) out.push(s.tutorial.title);
    });
    ((h && h.tours) || []).forEach((t) => out.push(t.title));
    return out;
  }
  function glossary(names) {
    const list = [...new Set(names.map((s) => String(s || '').trim()).filter((s) => s.length >= 3 && /^[A-Z]/.test(s)))].sort((a, b) => b.length - a.length);
    const alt = list.length ? list.map(esc).join('|') + '|' : '';
    return { set: new Set(list), re: new RegExp('(^|[^A-Za-z0-9_{])(' + alt + '\\d[\\d,.:]*\\d|\\d)(?![A-Za-z0-9_}])', 'g') };
  }
  /** "Arrive in Bihar at 8:00 AM" -> { key: "Arrive in {1} at {2} AM", vals: [{v:'Bihar',name:true},{v:'8:00',name:false}] } */
  function template(text, g) {
    const vals = []; let n = 0;
    const key = g ? text.replace(g.re, (m, pre, tok) => { vals.push({ v: tok, name: g.set.has(tok) }); return pre + '{' + (++n) + '}'; }) : text;
    return { key, vals };
  }
  const normTokens = (s) => String(s).replace(TOKEN, '{$1}');
  const tokensOf = (s) => [...normTokens(s).matchAll(/\{(\d+)\}/g)].map((m) => m[1]).sort().join(',');
  /** Put the real numbers / translated names back into a translated template. Returns null if a token is missing. */
  function fill(tpl, vals, nameTr) {
    const t = normTokens(tpl);
    if (vals.length && tokensOf(t) !== vals.map((_, i) => i + 1).sort().join(',')) return null;
    return t.replace(/\{(\d+)\}/g, (m, i) => { const x = vals[i - 1]; return x ? (x.name ? (nameTr(x.v) || x.v) : x.v) : m; });
  }
  /** What does this text need? 'full' = translate the template, 'names' = only swap names, null = leave alone. */
  function mode(text, lang, tp) {
    const bare = tp.key.replace(/\{\d+\}/g, '');
    const hasName = tp.vals.some((x) => x.name), latin = LATIN.test(bare);
    if (SCRIPT[lang] && SCRIPT[lang].test(text)) return hasName ? 'names' : null;
    if (latin) return 'full';
    return hasName ? 'names' : null;
  }
  /** True when a translation actually uses the target script (rejects "model answered in English"). */
  function looksTranslated(lang, src, out, brands) {
    const left = String(src).replace(/\{\d+\}/g, '').replace(new RegExp((brands || ['Kala\\w+']).join('|'), 'g'), '');
    if (!LATIN.test(left)) return true;
    return SCRIPT[lang] ? SCRIPT[lang].test(out) : true;
  }
  return { SCRIPT, LATIN, namesFrom, glossary, template, fill, mode, normTokens, tokensOf, looksTranslated };
});
