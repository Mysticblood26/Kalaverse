/* KalaVerse features: cultural map, KalaLens, KalaTour planner, KalaYatri, Community and Marketplace.
   All DOM is built from text (never HTML). User data stays in this browser (localStorage). */
   (function () {
    const $ = (id) => document.getElementById(id);
    const el = (t, x, c) => { const e = document.createElement(t); if (x != null) e.textContent = x; if (c) e.className = c; return e; };
    const ul = (a, c) => { const u = el('ul', null, c); a.forEach((x) => u.append(el('li', x))); return u; };
    const short = (s) => s.artForm.split(/ & | \/ | \(/)[0];
    const store = { get: (k, d) => { try { return JSON.parse(localStorage.getItem('kv_' + k)) || d; } catch { return d; } }, set: (k, v) => { try { localStorage.setItem('kv_' + k, JSON.stringify(v)); } catch { /* storage blocked */ } } };
    const hash = (s) => [...s].reduce((h, c) => (h * 31 + c.charCodeAt(0)) >>> 0, 7);
    const go = (h) => { location.hash = h; };
    function field(label, node) { const l = el('label', label); l.append(node); return l; }
    function select(id, opts) { const s = el('select'); s.id = id; opts.forEach(([v, t]) => { const o = el('option', t); o.value = v; s.append(o); }); return s; }
    const btn = (t, f, c) => { const b = el('button', t, 'btn ' + (c || 'alt')); b.type = 'button'; b.onclick = f; return b; };
  
    window.initFeatures = function (data) {
      const S = data.states, tours = data.tours, byId = (id) => S.find((s) => s.id === id);
      const stateOpts = S.map((s) => [s.id, s.name + ' (' + short(s) + ')']);
      const tourOf = (s) => tours.find((t) => t.state === s.name);
      let planState = null;
  
      /* ---------- Cultural map: real state outlines (public/data/map.json, from an SVG) ---------- */
      const grid = $('mapsvg'), md = $('mapd'), sel = $('mapsel'), NS = 'http://www.w3.org/2000/svg', T = (k) => window.I18n.t(k);
      const svg = (t, at) => { const e = document.createElementNS(NS, t); Object.entries(at || {}).forEach(([k, v]) => e.setAttribute(k, v)); return e; };
      let curId = 'bihar';
      S.forEach((s) => sel.append(Object.assign(el('option', s.name), { value: s.id }))); sel.onchange = () => showState(sel.value, true);
      function showState(id, user) {
        curId = id; const s = window.KVloc(byId(id)), t = tourOf(s); sel.value = id;
        grid.querySelectorAll('.reg').forEach((r) => r.classList.toggle('on', r.dataset.id === id));
        const on = grid.querySelector('path.reg.on'); if (on && on.parentNode) on.parentNode.append(on);
        md.replaceChildren(el('h2', s.name), el('p', short(s) + '. ' + T('ex.capital') + ': ' + s.capital + '. ' + T('ex.region') + ': ' + window.KVzone(s.zone) + '.', 'mute'), el('p', KalaCore.first(s.history, 2)),
          el('h3', T('map.art')), ul([s.artForm, ...s.otherCrafts], 'facts'),
          el('h3', T('map.places')), t ? ul(t.highlights, 'facts') : el('p', T('map.none'), 'mute'));
        const row = el('div', null, 'askrow');
        row.append(btn(T('map.learn'), () => go('explore/' + id)), btn(T('map.plan'), () => { planState = id; go('tours'); fillPlanner(); }), btn(T('map.shop'), () => { mstate = id; go('community'); tab('market'); }), btn(T('map.ask'), () => window.askKalaSathi('Tell me about ' + short(s))));
        md.append(row);
        if (user && window.matchMedia('(max-width:760px)').matches) md.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
      document.addEventListener('kv-lang', () => showState(curId));
      fetch('data/map.json').then((r) => { if (!r.ok) throw new Error(r.status); return r.json(); }).then((m) => {
        grid.setAttribute('viewBox', m.vb.join(' '));
        const g = svg('g'), hits = svg('g');
        const mk = (node, id) => { const s = byId(id); if (!s) return null; node.dataset.id = id; node.setAttribute('tabindex', '0'); node.setAttribute('role', 'button'); node.setAttribute('aria-label', s.name + ', ' + short(s));
          const ti = svg('title'); ti.textContent = s.name; node.append(ti); node.onclick = () => showState(id, true); node.onkeydown = (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); showState(id); } }; return node; };
        m.regions.forEach((r) => { const n = mk(svg('path', { d: r.d, class: 'reg' }), r.id); if (n) g.append(n); });
        (m.hits || []).forEach((r) => { const n = mk(svg('circle', { cx: r.x, cy: r.y, r: r.r, class: 'hit' }), r.id); if (n) hits.append(n); });
        grid.append(g, hits); showState(curId);
      }).catch(() => md.replaceChildren(el('p', T('map.fail'), 'empty')));
      sel.value = 'bihar'; showState('bihar');
  
      /* ---------- KalaTour planner ---------- */
      const INT = [['workshop', 'Hands-on workshop'], ['heritage', 'Heritage and museum'], ['food', 'Local food'], ['shop', 'Craft shopping']];
      const KIND = { arrive: 'Arrive', workshop: 'Workshop', heritage: 'Heritage', food: 'Food', shop: 'Shopping', end: 'Wrap up' };
      const GROUP = { solo: 'Share your plan with someone you trust and keep your phone charged.', many: 'Book workshop slots in advance for the whole group so you can sit together, and ask each place about seating and step-free access.' };
      const tf = $('tf'), tout = $('tout');
      tf.append(field('State', select('ts', stateOpts)), field('Start time', select('tstart', [['8', '8:00 AM'], ['9', '9:00 AM'], ['10', '10:00 AM']])), field('Pace', select('tpace', [['1', 'Relaxed'], ['0', 'Balanced']])),
        field('Number of travellers', Object.assign(el('input'), { type: 'number', id: 'tnum', min: 1, max: 20, value: 2, inputMode: 'numeric' })));
      const fs = el('fieldset'); fs.append(el('legend', 'Interests'));
      INT.forEach(([v, t]) => { const l = el('label'), c = el('input'); c.type = 'checkbox'; c.value = v; c.checked = true; l.append(c, document.createTextNode(' ' + t)); fs.append(l); });
      tf.append(fs, btn('Build my day', buildTour, 'btn'), btn('Surprise me', () => { planState = S[Math.floor(Math.random() * S.length)].id; fillPlanner(); buildTour(); }));
      function fillPlanner() { if (planState) $('ts').value = planState; }
      document.addEventListener('kv-plan', (e) => { const s = S.find((x) => x.name === e.detail); if (!s) return; planState = s.id; fillPlanner(); buildTour(); tf.scrollIntoView({ behavior: 'smooth', block: 'start' }); });
      const fmt = (m) => { const h = Math.floor(m / 60) % 24; return (h % 12 || 12) + ':' + String(m % 60).padStart(2, '0') + (h < 12 ? ' AM' : ' PM'); };
      const hm = (m) => (m >= 60 ? Math.floor(m / 60) + ' h ' : '') + (m % 60 ? (m % 60) + ' min' : '');
      function buildTour() {
        const s = byId($('ts').value), t = tourOf(s), want = [...tf.querySelectorAll('input:checked')].map((c) => c.value), relaxed = $('tpace').value === '1', grp = (parseInt($('tnum').value, 10) || 1) > 1 ? 'many' : 'solo';
        const hl = t ? t.highlights : [], stops = [];
        const add = (kind, title, mins) => want.includes(kind) && stops.push([kind, title, mins]);
        stops.push(['arrive', 'Arrive and meet your guide in ' + s.name + (t ? '' : ' (' + s.capital + ')'), 30]);
        add('heritage', t && hl[0] ? hl[0] : 'Visit a local museum or heritage site for ' + short(s), 90);
        add('workshop', t && hl[1] ? hl[1] : 'Workshop: ' + s.tutorial.title + ' (' + s.tutorial.time + ')', 120);
        add('food', t && hl.find((x) => /lunch|cuisine|culinary|food/i.test(x)) || 'Lunch with regional cuisine', 60);
        add('heritage', t && hl[2] ? hl[2] : 'Meet artisans and see ' + s.materials[0].toLowerCase() + ' being prepared', 90);
        add('shop', 'Buy from artisans: ' + s.otherCrafts.slice(0, 2).join(' and '), 60);
        stops.push(['end', 'Wrap up and travel onward', 30]);
        const start = Number($('tstart').value) * 60; let m = start; const o = el('ul', null, 'tl'), lines = [];
        stops.forEach(([kind, title, d]) => { const x = el('li'), b = el('b', fmt(m)); b.append(el('span', KIND[kind], 'tag k-' + kind)); x.append(b, document.createTextNode(title), el('span', hm(d), 'dur')); o.append(x); lines.push(fmt(m) + '  ' + title); m += d + (relaxed ? 20 : 0); });
        const sum = el('div', null, 'tsum'); sum.append(el('span', stops.length + ' stops'), el('span', 'About ' + hm(m - start)), el('span', 'Ends about ' + fmt(m)));
        tout.replaceChildren(el('h3', 'Your day in ' + s.name), sum, o);
        const tips = [GROUP[grp], ...(t && t.tips ? t.tips : [])]; tout.append(el('h4', window.I18n.t('tips')), ul(tips));
        tout.append(el('p', 'Timings are suggestions. Confirm opening hours with each place before you travel.', 'note'));
        const copy = btn('Copy plan', () => { const txt = 'My day in ' + s.name + '\n' + lines.join('\n'); (navigator.clipboard ? navigator.clipboard.writeText(txt) : Promise.reject()).then(() => { copy.textContent = 'Copied'; }).catch(() => { copy.textContent = 'Copy not allowed here'; }); });
        const nT = Math.max(1, Math.min(20, parseInt($('tnum').value, 10) || 1));
        tout.append(btn('Book tickets for this plan (' + nT + (nT === 1 ? ' traveller' : ' travellers') + ')', () => window.KVbook && window.KVbook.start({ state: s.id, travellers: nT, stops: stops.map(([kind, title]) => ({ kind, title })), planTitle: 'Your KalaTour day in ' + s.name }), 'btn'),
          btn('Plan the journey with KalaYatri', () => window.openYatri('Plan a one day art trip in ' + s.name + ' for ' + nT + (nT === 1 ? ' traveller' : ' travellers'))), copy, btn('Print', () => window.print()));
      }
      $('tnum').oninput = () => { if ($('tnum').value !== '') buildTour(); };
      buildTour();
  
      /* ---------- KalaLens: in-browser image analysis ---------- */
      const frame = $('frame'), fin = $('lfile'); let last = null;
      frame.onclick = () => fin.click(); $('lchange').onclick = () => fin.click();
      ['dragenter', 'dragover'].forEach((n) => frame.addEventListener(n, (e) => { e.preventDefault(); frame.classList.add('drag'); }));
      ['dragleave', 'drop'].forEach((n) => frame.addEventListener(n, (e) => { e.preventDefault(); frame.classList.remove('drag'); }));
      frame.addEventListener('drop', (e) => take(e.dataTransfer.files[0]));
      fin.onchange = (e) => { take(e.target.files[0]); fin.value = ''; };
      function take(f) {
        if (!f) return;
        if (!/^image\//.test(f.type) || f.size > 8e6) return void $('lout').replaceChildren(el('p', 'Please choose an image under 8 MB.', 'empty'));
        const rd = new FileReader(), img = new Image(), bad = () => $('lout').replaceChildren(el('p', 'That image could not be read.', 'empty'));
        rd.onerror = bad; img.onerror = bad;
        img.onload = () => { last = { img, url: rd.result }; $('fprev').src = rd.result; $('fprev').hidden = false; $('fph').hidden = true; frame.classList.add('has'); $('lchange').hidden = false; analyse(img, rd.result); };
        rd.onload = () => { img.src = rd.result; }; rd.readAsDataURL(f);
      }
      /* KalaLens: the AI looks at the picture and writes the whole report (score, ratings, colours, strengths, suggestions, practice). */
      const HEX = /^#[0-9a-f]{6}$/i, clamp = (v) => Math.max(0, Math.min(100, Math.round(Number(v) || 0))), has = (v) => v != null && v !== '' && Number.isFinite(Number(v));
      const list = (x, n) => (Array.isArray(x) ? x : []).map((v) => String(v).trim()).filter(Boolean).slice(0, n);
      function parseLens(t) {
        t = String(t).replace(/```(?:json)?/gi, ''); const i = t.indexOf('{'), k = t.lastIndexOf('}'); if (i < 0 || k < i) return null;
        try {
          const j = JSON.parse(t.slice(i, k + 1));
          const ratings = (Array.isArray(j.ratings) ? j.ratings : []).map((r) => ({ name: String((r && r.name) || '').trim(), score: clamp(r && r.score), note: String((r && r.note) || '').trim() })).filter((r) => r.name).slice(0, 6);
          const colours = (Array.isArray(j.colours) ? j.colours : []).map((c) => ({ name: String((c && c.name) || '').trim(), hex: String((c && c.hex) || '').trim() })).filter((c) => HEX.test(c.hex)).slice(0, 6);
          const o = { overall: ratings.length >= 3 ? Math.round(ratings.reduce((a, r) => a + r.score, 0) / ratings.length) : (has(j.overall) ? clamp(j.overall) : null),   // the score is the average of the five rated aspects, not a number the model picks
            summary: String(j.summary || '').trim(), ratings, colours, strengths: list(j.strengths, 4), improvements: list(j.improvements, 4), practice: list(j.practice, 4) };
          return o.summary || o.improvements.length || o.ratings.length ? o : null;
        } catch (e) { return null; }
      }
      /* Step 1 (auto): Gemini looks at the picture and names the art form. Step 2: the mentor feedback for that art form. */
      const jpeg = (img) => { const cv = document.createElement('canvas'), k = Math.min(1, 1024 / Math.max(img.width, img.height)); cv.width = Math.round(img.width * k); cv.height = Math.round(img.height * k); cv.getContext('2d').drawImage(img, 0, 0, cv.width, cv.height); return cv.toDataURL('image/jpeg', 0.8); };
      function analyse(img, url) {
        const det = $('ldet'), stamp = (lens.n = (lens.n || 0) + 1);
        const wait = el('div', null, 'aifb detect'); wait.append(el('h4', 'Art form'), el('p', 'KalaLens is identifying the painting style', 'typing')); det.replaceChildren(wait); $('lout').replaceChildren();
        if (!img.__kv) img.__kv = jpeg(img);
        fetch('/api/lens-detect', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ image: img.__kv }) })
          .then((r) => r.json().catch(() => ({ error: 'http' }))).catch(() => ({ error: 'nofetch' })).then((d) => {
            if (stamp !== lens.n) return;
            const box = el('div', null, 'aifb detect'); box.append(el('h4', 'Art form'));
            const pct = (c) => Math.round(c * 100) + '%';
            if (!d || !d.ok) {
              box.append(el('p', d && d.error === 'rate' ? 'Too many uploads in a short time. Please wait a minute.' : d && d.error === 'no_key' ? 'Auto-detect needs a Gemini API key on the server.' : 'The art form could not be identified right now. Please try again.', 'note'), btn('Try again', () => analyse(img, url)));
              return det.replaceChildren(box);
            }
            if (!d.art) { box.append(el('p', 'KalaLens could not match this to one of the traditional Indian art forms on KalaVerse. Try a clearer, well-lit photo of the whole artwork.'), btn('Try again', () => analyse(img, url))); return det.replaceChildren(box); }
            box.append(el('p', d.art.artForm + ' (' + d.art.state + ')', 'dname'), el('p', (d.sure ? 'Detected with ' : 'Best guess, only ') + pct(d.confidence) + ' sure' + (d.sure ? '' : '. A clearer photo may help.'), 'note'));
            if (d.reason) box.append(el('p', d.reason));
            const alts = d.candidates.filter((c) => c.id !== d.art.id);
            if (!d.sure && alts.length) box.append(el('p', 'Also similar: ' + alts.map((c) => c.artForm + ' (' + pct(c.confidence) + ')').join(', '), 'note'));
            det.replaceChildren(box);
            lens(img, url, d.art.id, false);
          });
      }
      function lens(img, url, artId, own) {
        const s = byId(artId), out = $('lout'), stamp = own ? (lens.n = (lens.n || 0) + 1) : lens.n;   // a newer upload cancels an older answer still on its way
        const bar = (name, v, note) => { const w = el('div'); const b = el('div', null, 'bar2'); b.append(el('i')); b.firstChild.style.width = Math.round(Math.max(0, Math.min(1, v)) * 100) + '%'; w.append(el('b', name + ': ' + Math.round(v * 100) + '%'), b, note ? el('p', note, 'note') : el('span')); return w; };
        const wait = el('div', null, 'aifb'); wait.append(el('h4', 'Mentor feedback'), el('p', 'KalaLens is studying your artwork', 'typing')); out.replaceChildren(wait);
        const show = (o) => {
          const parts = [];
          if (o.overall != null) {
            const head = el('div', null, 'lhead'), ring = el('div', String(o.overall), 'ring'); ring.style.setProperty('--p', o.overall); ring.setAttribute('aria-label', 'Overall score ' + o.overall + ' out of 100');
            const ht = el('div'); ht.append(el('h3', 'Feedback for ' + short(s)), el('p', 'Overall score given by KalaLens AI', 'note')); head.append(ring, ht); parts.push(head);
          } else parts.push(el('h3', 'Feedback for ' + short(s)));
          const ai = el('div', null, 'aifb'); ai.append(el('h4', 'Mentor feedback'), el('p', o.summary)); parts.push(ai);
          if (o.colours.length) { const sw = el('div', null, 'sw'); o.colours.forEach((c) => { const x = el('span'); x.style.background = c.hex; x.title = (c.name ? c.name + ' ' : '') + c.hex; sw.append(x); }); parts.push(el('h4', 'Dominant colours'), sw, el('p', o.colours.map((c) => c.name).filter(Boolean).join(' · '), 'note')); }
          o.ratings.forEach((r) => parts.push(bar(r.name, r.score / 100, r.note)));
          if (o.strengths.length) parts.push(el('h4', 'Strengths'), ul(o.strengths));
          if (o.improvements.length) parts.push(el('h4', 'Suggestions'), ul(o.improvements));
          if (o.practice.length) parts.push(el('h4', 'To practise next'), ul(o.practice));
          parts.push(el('p', 'The score and all feedback are written by AI from your image, so treat them as a guide and ask a practising artist for craft-specific advice.', 'note'));
          out.replaceChildren(...parts);
        };
        let ft = ''; if (!img.__kv) img.__kv = jpeg(img);
        window.KVstream('/api/lens', { image: img.__kv, art: s.id, lang: window.I18n.lang }, (c) => { ft += c; }).then((r) => {
          if (stamp !== lens.n) return;
          const o = ft ? parseLens(ft) : null; if (o) return show(o);
          const box = el('div', null, 'aifb'), retry = el('button', 'Try again', 'btn alt'); retry.type = 'button'; retry.onclick = () => lens(img, url, artId, true);
          box.append(el('h4', 'Mentor feedback'), el('p', r.err === 'no_key' ? 'Mentor feedback needs an API key on the server.' : r.err === 'rate' ? 'Too many uploads in a short time. Please wait a minute.' : 'Mentor feedback is unavailable right now.'), retry); out.replaceChildren(box);
        });
      }
  
      /* ---------- Community and Marketplace ---------- */
      const imgFile = (n) => 'img/market/' + encodeURIComponent(String(n).replace(/\//g, ' ').replace(/\s+/g, ' ').trim() + '.jfif');
      const cb = $('cbody'), ct = $('ctabs'); let mstate = '', mq = '', msort = '', msaved = false, wstate = '', wlevel = '', wq = '';
      const flip = (a, v) => { const i = a.indexOf(v); if (i < 0) a.push(v); else a.splice(i, 1); };
      const stateSel = (id, v) => { const s = select(id, [['', 'All states'], ...S.map((x) => [x.id, x.name])]); s.value = v; return s; };
      [['market', 'Marketplace'], ['work', 'Workshops'], ['show', 'Showcase']].forEach(([k, l]) => { const b = el('button', l, 'chip'); b.type = 'button'; b.dataset.k = k; b.onclick = () => tab(k); ct.append(b); });
      function tab(k) { ct.querySelectorAll('.chip').forEach((b) => b.classList.toggle('on', b.dataset.k === k)); ({ market, work: workshops, show: showcase })[k](); }
  
      // The 12 states shown in the marketplace (one listing each, its main art form). Add or swap state ids here to change them.
      const MARKET = ['bihar', 'maharashtra', 'odisha', 'madhya_pradesh', 'andhra_pradesh', 'rajasthan', 'tamil_nadu', 'west_bengal', 'kerala', 'uttar_pradesh', 'himachal_pradesh', 'karnataka'];
      function market() {
        const wish = store.get('wish2', []), enq = store.get('enq', []), items = [];
        if (mstate && !MARKET.includes(mstate)) mstate = '';   // the map's Browse marketplace button can pass a state that has no listing
        S.filter((s) => MARKET.includes(s.id)).forEach((s) => items.push({ id: s.id + ':' + s.artForm, n: s.artForm, s, slot: 1, price: 800 + (hash(s.artForm) % 70) * 100 })); // one listing per state: its main art form
        const st = select('mst', [['', 'All states'], ...S.filter((x) => MARKET.includes(x.id)).map((x) => [x.id, x.name])]), q = Object.assign(el('input'), { type: 'text', value: mq, placeholder: 'Search crafts' }), so = select('msort', [['', 'Featured'], ['lo', 'Price: low to high'], ['hi', 'Price: high to low'], ['az', 'Name A to Z']]);
        st.value = mstate; so.value = msort; const sv = Object.assign(el('input'), { type: 'checkbox', checked: msaved }), svl = el('label', null, 'chk'); svl.append(sv, document.createTextNode('Saved only'));
        const bar = el('div', null, 'toolbar'); bar.append(field('State', st), field('Search', q), field('Sort', so), svl);
        const count = el('p', null, 'note ccount'), list = el('div', null, 'cardrow');
        const draw = () => {
          mstate = st.value; mq = q.value; msort = so.value; msaved = sv.checked;
          const rows = items.filter((i) => (!mstate || i.s.id === mstate) && (!mq || (i.n + ' ' + i.s.name).toLowerCase().includes(mq.toLowerCase())) && (!msaved || wish.includes(i.id)));
          if (msort === 'lo') rows.sort((a, b) => a.price - b.price); else if (msort === 'hi') rows.sort((a, b) => b.price - a.price); else if (msort === 'az') rows.sort((a, b) => a.n.localeCompare(b.n));
          count.textContent = rows.length + ' of ' + items.length + ' sample listings. Saved: ' + wish.length;
          list.replaceChildren();
          rows.forEach((i) => {
            const saved = wish.includes(i.id), asked = enq.includes(i.id), c = el('div', null, 'card post');
            // Picture lookup: img/market/<Art Form Name>.jfif (the name shown on the card, with / removed), then market-placeholder.jfif.
            const im = el('img', null, 'pimg'); im.loading = 'lazy'; im.alt = i.n + ', ' + i.s.name;
            const tries = [imgFile(i.n), 'img/market/market-placeholder.jfif'];
            let k = 0; im.onerror = () => { k++; if (k < tries.length) im.src = tries[k]; else im.onerror = null; }; im.src = tries[0];
            c.append(im, el('h3', i.n), el('p', i.s.name + ' | ' + short(i.s), 'mute'), el('p', 'Sample price Rs ' + i.price.toLocaleString('en-IN'), 'price'),
              btn(saved ? 'Saved (tap to remove)' : 'Save to wishlist', () => { flip(wish, i.id); store.set('wish2', wish); draw(); }, saved ? 'btn' : 'alt'),
              btn(asked ? 'Enquiry saved' : 'Enquire', () => { if (!asked) { enq.push(i.id); store.set('enq', enq); draw(); } }), btn('About the art', () => go('explore/' + i.s.id)));
            const addB = btn('Add to cart', () => { const q = window.KVcart.add(i, 1); addB.textContent = 'Added (' + q + ' in cart)'; }, 'btn'), buyB = btn('Buy now', () => { window.KVcart.add(i, 1); window.KVcart.open(); }, 'btn');
            const first = c.querySelector('button'); c.insertBefore(addB, first); c.insertBefore(buyB, first);
            list.append(c);
          });
          if (!rows.length) list.append(el('p', msaved ? 'Nothing saved yet. Tap Save to wishlist on a listing.' : 'No listings match.', 'empty'));
        };
        [st, so, sv].forEach((x) => { x.onchange = draw; }); q.oninput = draw;
        cb.replaceChildren(bar, count, list, el('p', 'Sample listings from the dataset. Add items to the cart and check out with the demo payment page. Wishlist, cart and enquiries are saved only in this browser. Real artisans can list work once seller accounts launch.', 'note')); draw();
      }
  
      function workshops() {
        const reqs = store.get('requests', []), levels = [...new Set(S.map((s) => s.tutorial.difficulty))];
        const st = stateSel('wst', wstate), lv = select('wlv', [['', 'Any level'], ...levels.map((l) => [l, l])]), q = Object.assign(el('input'), { type: 'text', value: wq, placeholder: 'Search workshops' });
        lv.value = wlevel; const bar = el('div', null, 'toolbar'); bar.append(field('State', st), field('Level', lv), field('Search', q));
        const mine = el('div', null, 'card mine'), list = el('div', null, 'cardrow');
        mine.append(el('h3', 'Your seat requests (' + reqs.length + ')'));
        if (!reqs.length) mine.append(el('p', 'None yet. Request a seat on any workshop below.', 'mute'));
        else { const u = el('ul', null, 'reqs'); reqs.forEach((r, i) => { const li = el('li'), x = el('button', 'Cancel', 'linkbtn'); x.type = 'button'; x.onclick = () => { reqs.splice(i, 1); store.set('requests', reqs); workshops(); }; li.append(el('span', r.w + ' | ' + r.st), x); u.append(li); }); mine.append(u); }
        const draw = () => {
          wstate = st.value; wlevel = lv.value; wq = q.value; list.replaceChildren(); let n = 0;
          S.filter((s) => (!wstate || s.id === wstate) && (!wlevel || s.tutorial.difficulty === wlevel) && (!wq || (s.tutorial.title + ' ' + s.name).toLowerCase().includes(wq.toLowerCase()))).forEach((s) => {
            const w = s.tutorial, c = el('div', null, 'card'), idx = reqs.findIndex((r) => r.w === w.title); n++;
            c.append(el('h3', w.title), el('p', s.name + ' | ' + w.difficulty + ' | about ' + w.time, 'mute'), el('p', 'Sample fee Rs ' + (500 + hash(w.title) % 20 * 100).toLocaleString('en-IN'), 'price'),
              btn(idx >= 0 ? 'Requested (tap to cancel)' : 'Request a seat', () => { if (idx >= 0) reqs.splice(idx, 1); else reqs.push({ w: w.title, st: s.name, from: 'Community' }); store.set('requests', reqs); workshops(); }, idx >= 0 ? 'btn' : 'alt'),
              btn('Plan the trip', () => window.openYatri('Plan a trip to ' + s.name + ' to join the workshop ' + w.title)), btn('About the art', () => go('explore/' + s.id)));
            list.append(c);
          });
          if (!n) list.append(el('p', 'No workshops match.', 'empty'));
        };
        [st, lv].forEach((x) => { x.onchange = draw; }); q.oninput = draw;
        cb.replaceChildren(el('p', 'Seat requests are saved in your browser and shared with KalaYatri. Hosts are not contacted yet.', 'note'), mine, bar, list); draw();
      }
  
      /* Sample posts. Each has an image path: put your real pictures in public/img/community/ named after the poster (Anita.jfif etc.)
         (or change the 'img' paths below). If a file is missing the grey-gold placeholder.jfif is shown instead. */
      const PLACEHOLDER = 'img/community/placeholder.jfif';
      const SAMPLES = [
        { id: 's1', n: 'Anita', s: 'bihar', t: 'Finished my first Madhubani fish motif today. Any tips for keeping the double lines steady?', l: 12, img: 'img/community/Anita.jfif' },
        { id: 's2', n: 'Rohan', s: 'maharashtra', t: 'Our class tried Warli with rice paste on a clay-coloured sheet. The stick figures were the most fun.', l: 8, img: 'img/community/Rohan.jfif' },
        { id: 's3', n: 'Meera', s: 'odisha', t: 'Which natural colours work best for a beginner Pattachitra practice piece?', l: 5, img: 'img/community/Meera.jfif' },
        { id: 's4', n: 'Kabir', s: 'madhya_pradesh', t: 'Tried the Gond dot-and-dash fill for the first time. The patterns inside the deer took longer than the outline!', l: 9, img: 'img/community/Kabir.jfif' },
        { id: 's5', n: 'Lakshmi', s: 'andhra_pradesh', t: 'Practising the Kalamkari tree of life with a bamboo pen. Still learning to control the ink flow.', l: 6, img: 'img/community/Lakshmi.jfif' },
        { id: 's6', n: 'Tenzin', s: 'sikkim', t: 'My first small Thangka study: the lotus seat and halo. Any advice on mixing mineral blues?', l: 11, img: 'img/community/Tenzin.jfif' }];
      function shrink(file, done) {   // keep user pictures small so they fit in the browser's storage
        if (!file || !/^image\//.test(file.type) || file.size > 8e6) return done(null);
        const rd = new FileReader(), im = new Image();
        rd.onerror = im.onerror = () => done(null);
        im.onload = () => { const k = Math.min(1, 640 / Math.max(im.width, im.height)), cv = document.createElement('canvas'); cv.width = Math.round(im.width * k); cv.height = Math.round(im.height * k); cv.getContext('2d').drawImage(im, 0, 0, cv.width, cv.height); done(cv.toDataURL('image/jpeg', 0.7)); };
        rd.onload = () => { im.src = rd.result; }; rd.readAsDataURL(file);
      }
      function showcase() {
        const mine = store.get('posts', []), liked = store.get('liked', {}), f = el('form', null, 'panel');
        const nm = Object.assign(el('input'), { type: 'text', maxLength: 40, required: true }), tx = Object.assign(el('input'), { type: 'text', maxLength: 200, required: true });
        const pic = Object.assign(el('input'), { type: 'file', accept: 'image/*' });
        f.append(field('Your name', nm), field('State', select('pst', stateOpts)), field('Share your work or a question', tx), field('Picture of your work (optional)', pic), btn('Post', () => f.requestSubmit(), 'btn'));
        f.onsubmit = (e) => { e.preventDefault(); shrink(pic.files[0], (img) => { mine.unshift({ id: 'u' + Date.now(), n: nm.value.trim(), s: f.querySelector('select').value, t: tx.value.trim(), l: 0, own: true, img: img || '' }); store.set('posts', mine.slice(0, 20)); showcase(); }); };
        const list = el('div', null, 'cardrow');
        mine.forEach((p, i) => { if (!p.id) p.id = 'o' + i; });
        [...mine, ...SAMPLES].forEach((p) => {
          const st = byId(p.s); if (!st) return;
          const isMine = mine.includes(p), c = el('div', null, 'card post' + (isMine ? ' mine' : '')), n = (p.l || 0) + (liked[p.id] ? 1 : 0);
          const im = el('img', null, 'pimg'); im.loading = 'lazy'; im.alt = 'Artwork shared by ' + p.n + ' (' + short(st) + ')'; im.src = p.img || PLACEHOLDER;
          im.onerror = () => { im.onerror = null; im.src = PLACEHOLDER; };
          c.append(im, el('h3', p.n), el('p', st.name + ' | ' + short(st), 'mute'), el('p', p.t));
          if (!isMine) c.append(el('p', 'Sample post', 'sample'));
          c.append(btn((liked[p.id] ? 'Appreciated (' : 'Appreciate (') + n + ')', () => { if (liked[p.id]) delete liked[p.id]; else liked[p.id] = 1; store.set('liked', liked); showcase(); }, liked[p.id] ? 'btn' : 'alt'));
          if (isMine) c.append(btn('Delete', () => { store.set('posts', mine.filter((m) => m !== p)); showcase(); }));
          list.append(c);
        });
        cb.replaceChildren(el('p', 'Posts are stored only in this browser until a shared community server is added. Do not post personal information.', 'note'), f, list);
      }
      tab('market');
      window.addEventListener('hashchange', fillPlanner);
    };
  })();