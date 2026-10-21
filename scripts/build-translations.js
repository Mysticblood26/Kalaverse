#!/usr/bin/env node
'use strict';
/* Builds the PERMANENT translations: public/data/i18n/<lang>.json (committed, served as static files).
   Run once:   node scripts/build-translations.js            (all 11 languages)
               node scripts/build-translations.js hi ta      (only some)
   Needs no key (uses Google web translate); GEMINI_API_KEY is used first if set. Re-run any time: finished strings are kept
   in cache/translations.json, so it only translates what is new or missing. */
const fs = require('fs'), path = require('path'), vm = require('vm');
const ROOT = path.join(__dirname, '..'), PUB = path.join(ROOT, 'public');
const { spawnSync } = require('child_process');
/* Load .env (the build script is run by hand, so it must read the keys itself) */
try { fs.readFileSync(path.join(__dirname, '..', '.env'), 'utf8').split(/\r?\n/).forEach((l) => { const m = l.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/); if (m && m[2] && !(m[1] in process.env)) process.env[m[1]] = m[2].replace(/^[\"']|[\"']$/g, ''); }); } catch { /* no .env */ }
const T = require(path.join(PUB, 'js', 'trutil.js')), { translate, LANGNAME, ok, providerNames } = require(path.join(ROOT, 'lib', 'translator.js'));
const H = JSON.parse(fs.readFileSync(path.join(PUB, 'data', 'heritage.json'), 'utf8'));
let HI = {}; try { HI = JSON.parse(fs.readFileSync(path.join(PUB, 'data', 'heritage.hi.json'), 'utf8')); } catch { /* optional */ }
const read = (f) => fs.readFileSync(path.join(PUB, f), 'utf8');
const G = T.glossary(T.namesFrom(H));

/* Brand names written in each language's own script (the machine translators keep them in Latin letters).
   Applied when the language files are written, so it also fixes strings that are already in the cache.
   Order of each list: KalaSathi, KalaLens, KalaTour, KalaYatri, KalaVerse. Edit a spelling here and re-run. */
const BRANDS = ['KalaSathi', 'KalaLens', 'KalaTour', 'KalaYatri', 'KalaVerse'];
const BRAND_NATIVE = {
  hi: ['कलासाथी', 'कलालेंस', 'कलाटूर', 'कलायात्री', 'कलावर्स'],
  mr: ['कलासाथी', 'कलालेन्स', 'कलाटूर', 'कलायात्री', 'कलावर्स'],
  bn: ['কলাসাথী', 'কলালেন্স', 'কলাটুর', 'কলাযাত্রী', 'কলাভার্স'],
  as: ['কলাসাথী', 'কলালেন্স', 'কলাটুৰ', 'কলাযাত্ৰী', 'কলাভাৰ্স'],
  gu: ['કલાસાથી', 'કલાલેન્સ', 'કલાટૂર', 'કલાયાત્રી', 'કલાવર્સ'],
  pa: ['ਕਲਾਸਾਥੀ', 'ਕਲਾਲੈਂਸ', 'ਕਲਾਟੂਰ', 'ਕਲਾਯਾਤਰੀ', 'ਕਲਾਵਰਸ'],
  or: ['କଳାସାଥୀ', 'କଳାଲେନ୍ସ', 'କଳାଟୁର', 'କଳାଯାତ୍ରୀ', 'କଳାଭର୍ସ'],
  ta: ['கலாசாத்தி', 'கலாலென்ஸ்', 'கலாடூர்', 'கலாயாத்ரி', 'கலாவெர்ஸ்'],
  te: ['కళాసాథి', 'కళాలెన్స్', 'కళాటూర్', 'కళాయాత్రి', 'కళావర్స్'],
  kn: ['ಕಲಾಸಾಥಿ', 'ಕಲಾಲೆನ್ಸ್', 'ಕಲಾಟೂರ್', 'ಕಲಾಯಾತ್ರಿ', 'ಕಲಾವರ್ಸ್'],
  ml: ['കലാസാഥി', 'കലാലെൻസ്', 'കലാടൂർ', 'കലായാത്രി', 'കലാവേഴ്സ്']
};
const fixBrands = (lang, str) => {
  const nat = BRAND_NATIVE[lang]; if (!nat || typeof str !== 'string') return str;
  BRANDS.forEach((b, i) => {
    str = str.replace(new RegExp('[^\\s|:,.()]+\\s*\\(\\s*' + b + '\\s*\\)', 'g'), nat[i]);   // "native (KalaSathi)" -> native only
    str = str.replace(new RegExp(b, 'g'), nat[i]);                                           // plain Latin name -> native
  });
  return str;
};
const want = new Set();           // keys to translate (templates and names)
const hand = {};                  // hand-written Hindi we already have: key -> translation
const add = (s) => { s = String(s == null ? '' : s).replace(/\s+/g, ' ').trim(); if (!T.LATIN.test(s)) return; const tp = T.template(s, G); if (T.mode(s, 'hi', tp) === 'names') tp.vals.filter((v) => v.name).forEach((v) => want.add(v.v)); else { want.add(tp.key); tp.vals.filter((v) => v.name).forEach((v) => want.add(v.v)); } };

/* 1. all data: states, tours, names */
(function walk(o) { if (typeof o === 'string') add(o); else if (Array.isArray(o)) o.forEach(walk); else if (o && typeof o === 'object') Object.entries(o).forEach(([k, v]) => { if (k !== 'id') walk(v); }); })(H);
T.namesFrom(H).forEach(add);
const Core = require(path.join(PUB, 'js', 'core.js'));
H.states.forEach((s) => { add(Core.first(s.history, 1)); add(Core.first(s.history, 2)); });   // home cards and map use the first sentences

/* 2. menu and label dictionary (English side of i18n.js) */
(function () {
  const doc = { documentElement: { setAttribute() {} }, addEventListener() {}, querySelector() { return null; }, querySelectorAll() { return []; }, getElementById() { return null; } };
  const sb = { window: { matchMedia: () => ({ matches: true }) }, document: doc, localStorage: { getItem: () => null, setItem() {} }, CustomEvent: function () {}, location: {}, matchMedia: () => ({ matches: true }) }; sb.window.window = sb.window;
  vm.runInNewContext(read('js/i18n.js'), sb); const d = sb.window.I18n.dict;
  Object.values(d.en).forEach(add);
  Object.keys(d.en).forEach((k) => { if (d.hi[k] && T.LATIN.test(d.en[k])) hand[d.en[k]] = d.hi[k]; });
})();

/* 3. index.html text and attributes */
(function () {
  const html = read('index.html').replace(/<script[\s\S]*?<\/script>|<style[\s\S]*?<\/style>|<svg[\s\S]*?<\/svg>/g, ' ');
  (html.match(/>[^<>]+</g) || []).forEach((m) => add(m.slice(1, -1)));
  (html.match(/\b(?:placeholder|aria-label|title|alt)="[^"]+"/g) || []).forEach((m) => add(m.replace(/^[^=]+="|"$/g, '')));
  (html.match(/<meta name="description" content="[^"]+"/) || []).forEach((m) => add(m.replace(/^.*content="|"$/g, '')));
  (html.match(/<title>[^<]+/) || []).forEach((m) => add(m.slice(7)));
})();

/* 4. every plain text string written in the scripts */
['js/app.js', 'js/features.js', 'js/yatri.js', 'js/chat.js'].forEach((f) => {
  (read(f).match(/'(?:[^'\\\n]|\\.)*'|"(?:[^"\\\n]|\\.)*"/g) || []).forEach((q) => {
    const s = q.slice(1, -1).replace(/\\'/g, "'").replace(/\\"/g, '"').replace(/\\n/g, ' ');
    if (/^[A-Z][^<>{}=;]*[a-z]/.test(s) && s.length < 260 && !/^(Content-Type|Escape|Enter|DOMContentLoaded|http|data:|rgb|image)/.test(s) && !/[\\]/.test(s)) add(s);
  });
  (read(f).match(/\[\s*'[a-z]+',\s*'[^']+'\s*\]/g) || []).forEach((m) => add(m.replace(/^.*',\s*'|'\s*\]$/g, '')));
});

/* 5. sentences built from pieces at run time (same wording as the code in app.js / features.js) */
const short = (s) => s.artForm.split(/ & | \/ | \(/)[0], hm = (m) => (m >= 60 ? Math.floor(m / 60) + ' h ' : '') + (m % 60 ? (m % 60) + ' min' : '');
const zones = [...new Set(H.states.map((s) => s.zone))];
H.states.forEach((s) => {
  const t = s.tutorial, tour = H.tours.find((x) => x.state === s.name), ml = (x) => x.toLowerCase();
  [s.name + ', ' + s.zone, s.name + ' (' + short(s) + ')', s.name + ', ' + short(s), short(s) + '. Capital: ' + s.capital + '. Region: ' + s.zone + '.',
    'State: ' + s.name + '. Capital: ' + s.capital + '. Region: ' + s.zone + '.', 'Other crafts from ' + s.name, 'Try it: ' + t.title, 'Ask KalaSathi about ' + short(s),
    t.difficulty + ', about ' + t.time + '.', 'Arrive and meet your guide in ' + s.name + (tour ? '' : ' (' + s.capital + ')'), 'Your day in ' + s.name,
    'Visit a local museum or heritage site for ' + short(s), 'Workshop: ' + t.title + ' (' + t.time + ')', 'Meet artisans and see ' + ml(s.materials[0]) + ' being prepared',
    'Buy from artisans: ' + s.otherCrafts.slice(0, 2).join(' and '), s.name + ' | ' + short(s), s.name + ' | ' + t.difficulty + ' | about ' + t.time,
    'Contrast is low. ' + short(s) + ' reads best with clear dark outlines against a lighter ground.', 'Colours look muted. Traditional palettes use natural pigments such as ' + ml(s.materials[s.materials.length - 1]) + '.',
    'There is little line detail. Try filling empty areas with the motifs of the form, such as ' + s.motifs[0].split(' (')[0] + ' or ' + s.motifs[1].split(' (')[0] + '.',
    'Feedback for ' + short(s), t.title + ' (' + t.difficulty + ')', 'Study motifs: ' + s.motifs.slice(0, 3).map((m) => m.split(' (')[0]).join(', ')].forEach(add);
  t.steps.forEach((st, i) => add((i + 1) + '. ' + st.title));
});
H.tours.forEach((t) => { add(t.state + '. ' + t.duration + '. ' + t.theme + '.'); add(t.state); });
zones.forEach(add);
['Explore India | ', 'KalaSathi | ', 'KalaTour | ', 'Cultural map | ', 'KalaLens | ', 'Community | '].forEach((x) => add(x + 'KalaVerse'));
['1 art traditions', '5 of 36 shown.', '108 of 108 sample listings. Saved: 0', 'Sample price Rs 5,300', 'Sample fee Rs 1,200', '7 stops', 'About 10 h 20 min', 'Ends about 6:20 PM', '8:00 AM', '1:00 PM', '30 min', '2 h', '1 h 30 min',
  'Your seat requests (0)', 'Appreciate (12)', 'Appreciated (13)', 'Contrast: 50%', 'Colour richness: 50%', 'Detail: 50%', 'Balance: 50%', 'Overall score 50 out of 100'].forEach(add);
['Madhubani Mithila Warli Kalamkari'].forEach(() => {});

/* 6. hand-written Hindi we already have for Bihar (heritage.hi.json) */
(function pair(en, hi) {
  if (typeof en === 'string' && typeof hi === 'string') { const tp = T.template(en.replace(/\s+/g, ' ').trim(), G); if (!tp.vals.length) hand[tp.key] = hi; }
  else if (Array.isArray(en) && Array.isArray(hi)) en.forEach((x, i) => pair(x, hi[i]));
  else if (en && hi && typeof en === 'object' && typeof hi === 'object') Object.keys(hi).forEach((k) => pair(en[k], hi[k]));
})(H.states.find((s) => s.id === 'bihar'), HI.bihar || {});

/* ---- run ---- */
(async () => {
  const ENGINE = (process.env.TRANSLATE_ENGINE || 'auto').toLowerCase();
  const keys = [...want].sort(), CACHE = path.join(ROOT, 'cache', 'translations.json'), OUT = path.join(PUB, 'data', 'i18n');
  let cache = {}; try { cache = JSON.parse(fs.readFileSync(CACHE, 'utf8')); } catch { /* first run */ }
  fs.mkdirSync(OUT, { recursive: true });
  const args = process.argv.slice(2), flushOnly = args.includes('--flush-only');
  const langs = args.filter((a) => !a.startsWith('--')).length ? args.filter((a) => !a.startsWith('--')) : Object.keys(LANGNAME);
  console.log(keys.length + ' strings to cover per language. Engine: ' + (ENGINE === 'indictrans' ? 'IndicTrans2 (AI4Bharat, runs on your computer)' : 'API: ' + providerNames().join(' -> ')));
  const flush = (lang) => {
    const o = {}; keys.forEach((k) => { const v = cache[lang + '|' + k] || (lang === 'hi' && hand[k]); if (v) o[k] = BRANDS.includes(k) && BRAND_NATIVE[lang] ? BRAND_NATIVE[lang][BRANDS.indexOf(k)] : fixBrands(lang, v); });
    fs.writeFileSync(path.join(OUT, lang + '.json'), JSON.stringify(o)); fs.writeFileSync(CACHE, JSON.stringify(cache));
    return Object.keys(o).length;
  };
  let stop = false;
  for (const lang of langs) {
    if (stop) break;
    if (!LANGNAME[lang]) { console.log('skip unknown language', lang); continue; }
    const todo = keys.filter((k) => !cache[lang + '|' + k] && !(lang === 'hi' && hand[k]));
    if (flushOnly) { console.log(`${lang} ${LANGNAME[lang]}: ${keys.length - todo.length} / ${keys.length} from cache -> public/data/i18n/${lang}.json (${flush(lang)} written)`); continue; }
    console.log(`${lang} ${LANGNAME[lang]}: ${keys.length - todo.length} done, ${todo.length} to translate`);
    if (todo.length) {
      if (ENGINE === 'indictrans') {
        const fin = path.join(ROOT, 'cache', 'indic-in-' + lang + '.json'), fout = path.join(ROOT, 'cache', 'indic-out-' + lang + '.json');
        fs.writeFileSync(fin, JSON.stringify(todo));
        const py = process.env.PYTHON || (process.platform === 'win32' ? 'python' : 'python3');
        const r = spawnSync(py, [path.join(__dirname, 'indictrans.py'), lang, fin, fout], { stdio: 'inherit' });
        if (r.error || r.status) { console.log('  IndicTrans2 stopped (' + (r.error ? r.error.message : 'exit ' + r.status) + '). See README: "IndicTrans2 setup". Whatever finished is kept; run again to continue.'); stop = true; }
        let got = {}; try { got = JSON.parse(fs.readFileSync(fout, 'utf8')); } catch { /* nothing yet */ }
        let bad = 0; todo.forEach((t) => { if (got[t] == null) return; if (ok(lang, t, got[t])) cache[lang + '|' + t] = T.normTokens(got[t]).trim(); else bad++; });
        if (bad) console.log('  ' + bad + ' strings did not pass the checks (lost a {1} token or stayed English). Fill them with: TRANSLATE_ENGINE=web npm run translate ' + lang);
      } else {
        let n = 0;
        try { await translate(lang, todo, (src, out) => { src.forEach((t, i) => { if (out[i]) cache[lang + '|' + t] = out[i]; }); if (++n % 5 === 0) flush(lang); }); }
        catch (e) { console.log(e.rate ? '\n  Google is rate limiting this connection. Progress is saved. Wait 30-60 minutes (or use the default IndicTrans2 engine) and run again.' : '  stopped: ' + e.message); stop = true; }
      }
    }
    console.log(`  saved ${flush(lang)} / ${keys.length} -> public/data/i18n/${lang}.json`);
  }
})();