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
    const GROUP = { solo: 'Share your plan with someone you trust and keep your phone charged.', family: 'Choose short workshop sessions and carry water and snacks for the children.', friends: 'Book a group workshop slot in advance so you can sit together.', elder: 'Pick the Relaxed pace and ask each place about seating and step-free access.' };
    const tf = $('tf'), tout = $('tout');
    tf.append(field('State', select('ts', stateOpts)), field('Start time', select('tstart', [['8', '8:00 AM'], ['9', '9:00 AM'], ['10', '10:00 AM']])), field('Pace', select('tpace', [['1', 'Relaxed'], ['0', 'Balanced']])),
      field('Travelling as', select('tgroup', [['solo', 'Solo'], ['family', 'Family with children'], ['friends', 'Friends'], ['elder', 'Senior travellers']])));
    const fs = el('fieldset'); fs.append(el('legend', 'Interests'));
    INT.forEach(([v, t]) => { const l = el('label'), c = el('input'); c.type = 'checkbox'; c.value = v; c.checked = true; l.append(c, document.createTextNode(' ' + t)); fs.append(l); });
    tf.append(fs, btn('Build my day', buildTour, 'btn'), btn('Surprise me', () => { planState = S[Math.floor(Math.random() * S.length)].id; fillPlanner(); buildTour(); }));
    function fillPlanner() { if (planState) $('ts').value = planState; }
    document.addEventListener('kv-plan', (e) => { const s = S.find((x) => x.name === e.detail); if (!s) return; planState = s.id; fillPlanner(); buildTour(); tf.scrollIntoView({ behavior: 'smooth', block: 'start' }); });
    const fmt = (m) => { const h = Math.floor(m / 60) % 24; return (h % 12 || 12) + ':' + String(m % 60).padStart(2, '0') + (h < 12 ? ' AM' : ' PM'); };
    const hm = (m) => (m >= 60 ? Math.floor(m / 60) + ' h ' : '') + (m % 60 ? (m % 60) + ' min' : '');
    function buildTour() {
      const s = byId($('ts').value), t = tourOf(s), want = [...tf.querySelectorAll('input:checked')].map((c) => c.value), relaxed = $('tpace').value === '1', grp = $('tgroup').value;
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
      tout.append(btn('Plan the journey with KalaYatri', () => window.openYatri('Plan a one day art trip in ' + s.name + ' for ' + $('tgroup').selectedOptions[0].textContent.toLowerCase())), copy, btn('Print', () => window.print()));
    }
    buildTour();

    /* ---------- KalaLens: in-browser image analysis ---------- */
    $('lart').replaceWith(Object.assign(select('lart', stateOpts)));
    const frame = $('frame'), fin = $('lfile'); let last = null;
    frame.onclick = () => fin.click(); $('lchange').onclick = () => fin.click();
    ['dragenter', 'dragover'].forEach((n) => frame.addEventListener(n, (e) => { e.preventDefault(); frame.classList.add('drag'); }));
    ['dragleave', 'drop'].forEach((n) => frame.addEventListener(n, (e) => { e.preventDefault(); frame.classList.remove('drag'); }));
    frame.addEventListener('drop', (e) => take(e.dataTransfer.files[0]));
    fin.onchange = (e) => { take(e.target.files[0]); fin.value = ''; };
    $('lart').onchange = () => { if (last) lens(last.img, last.url); };
    function take(f) {
      if (!f) return;
      if (!/^image\//.test(f.type) || f.size > 8e6) return void $('lout').replaceChildren(el('p', 'Please choose an image under 8 MB.', 'empty'));
      const rd = new FileReader(), img = new Image(), bad = () => $('lout').replaceChildren(el('p', 'That image could not be read.', 'empty'));
      rd.onerror = bad; img.onerror = bad;
      img.onload = () => { last = { img, url: rd.result }; $('fprev').src = rd.result; $('fprev').hidden = false; $('fph').hidden = true; frame.classList.add('has'); $('lchange').hidden = false; lens(img, rd.result); };
      rd.onload = () => { img.src = rd.result; }; rd.readAsDataURL(f);
    }
    function lens(img, url) {
      const W = 96, H = Math.max(24, Math.round(96 * img.height / img.width)), cv = document.createElement('canvas'); cv.width = W; cv.height = H;
      const cx = cv.getContext('2d', { willReadFrequently: true }); cx.drawImage(img, 0, 0, W, H); const d = cx.getImageData(0, 0, W, H).data;
      const L = (i) => 0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2]; let sum = 0, sq = 0, edge = 0, asym = 0, sat = 0; const bins = {};
      for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
        const i = (y * W + x) * 4, l = L(i); sum += l; sq += l * l;
        if (x > 0) edge += Math.abs(l - L(i - 4)) > 30 ? 1 : 0;
        if (x < W / 2) asym += Math.abs(l - L((y * W + (W - 1 - x)) * 4)) / 255;
        const mx = Math.max(d[i], d[i + 1], d[i + 2]), mn = Math.min(d[i], d[i + 1], d[i + 2]); sat += mx ? (mx - mn) / mx : 0;
        const k = [d[i] >> 6, d[i + 1] >> 6, d[i + 2] >> 6].join(); bins[k] = (bins[k] || 0) + 1;
      }
      const n = W * H, mean = sum / n, contrast = Math.sqrt(sq / n - mean * mean) / 128, detail = edge / n, balance = 1 - asym / (n / 2), colour = sat / n;
      const pal = Object.entries(bins).sort((a, b) => b[1] - a[1]).slice(0, 5).map(([k]) => k.split(',').map((v) => Number(v) * 64 + 32));
      const s = byId($('lart').value), out = $('lout'), pct = (v) => Math.round(Math.max(0, Math.min(1, v)) * 100);
      const bar = (name, v, note) => { const w = el('div'); const b = el('div', null, 'bar2'); b.append(Object.assign(el('i'), {})); b.firstChild.style.width = pct(v) + '%'; w.append(el('b', name + ': ' + pct(v) + '%'), b, el('p', note, 'note')); return w; };
      const tips = [];
      if (contrast < 0.35) tips.push('Contrast is low. ' + short(s) + ' reads best with clear dark outlines against a lighter ground.');
      if (colour < 0.2) tips.push('Colours look muted. Traditional palettes use natural pigments such as ' + s.materials.slice(-1)[0].toLowerCase() + '.');
      if (detail < 0.08) tips.push('There is little line detail. Try filling empty areas with the motifs of the form, such as ' + s.motifs[0].split(' (')[0] + ' or ' + s.motifs[1].split(' (')[0] + '.');
      if (detail > 0.3) tips.push('The surface is very busy. Leave some breathing space around the main figure.');
      if (balance < 0.75) tips.push('The composition leans to one side. Many traditional layouts are symmetrical or centred on one motif.');
      if (!tips.length) tips.push('Strong contrast, colour and balance. Next, refine the borders and repeat patterns for consistency.');
      const overall = pct((Math.min(1, contrast / 0.6) + Math.min(1, colour / 0.6) + Math.min(1, detail / 0.2) + balance) / 4);
      const head = el('div', null, 'lhead'), ring = el('div', String(overall), 'ring'); ring.style.setProperty('--p', overall); ring.setAttribute('aria-label', 'Overall score ' + overall + ' out of 100');
      const ht = el('div'); ht.append(el('h3', 'Feedback for ' + short(s)), el('p', 'Overall score from colour, contrast, detail and balance', 'note')); head.append(ring, ht);
      const ai = el('div', null, 'aifb'), aip = el('p', 'KalaLens is studying your artwork', 'typing'); ai.append(el('h4', 'Mentor feedback'), aip);
      { const cv2 = document.createElement('canvas'), k = Math.min(1, 768 / Math.max(img.width, img.height)); cv2.width = Math.round(img.width * k); cv2.height = Math.round(img.height * k); cv2.getContext('2d').drawImage(img, 0, 0, cv2.width, cv2.height);
        let ft = ''; window.KVstream('/api/lens', { image: cv2.toDataURL('image/jpeg', 0.72), art: s.id, lang: window.I18n.lang }, (c) => { ft += c; aip.className = ''; aip.textContent = ft; }).then((r) => { if (r.err) { aip.className = ''; aip.textContent = ft || (r.err === 'no_key' ? 'Mentor feedback needs an API key on the server. The scores below still work.' : r.err === 'rate' ? 'Too many uploads in a short time. Please wait a minute.' : 'Mentor feedback is unavailable right now. The scores below still work.'); } }); }
      const sw = el('div', null, 'sw'); pal.forEach((c) => { const x = el('span'); x.style.background = 'rgb(' + c.join() + ')'; x.title = 'rgb(' + c.join() + ')'; sw.append(x); });
      out.replaceChildren(head, ai, el('h4', 'Dominant colours'), sw, bar('Contrast', contrast / 0.6, 'How clearly shapes stand out.'), bar('Colour richness', colour / 0.6, 'How saturated the palette is.'),
        bar('Detail', detail / 0.2, 'Amount of line work and pattern.'), bar('Balance', balance, 'Left-right symmetry of the composition.'), el('h4', 'Suggestions'), ul(tips),
        el('h4', 'To practise next'), ul([s.tutorial.title + ' (' + s.tutorial.difficulty + ')', 'Study motifs: ' + s.motifs.slice(0, 3).map((m) => m.split(' (')[0]).join(', ')]),
        el('p', 'This is a quick rule-based analysis of colour, contrast, detail and balance, not a judgment of artistic merit. Ask a practising artist for craft-specific feedback.', 'note'));
    }

    /* ---------- Community and Marketplace ---------- */
    const cb = $('cbody'), ct = $('ctabs'); let mstate = '', mq = '', msort = '', msaved = false, wstate = '', wlevel = '', wq = '';
    const flip = (a, v) => { const i = a.indexOf(v); if (i < 0) a.push(v); else a.splice(i, 1); };
    const stateSel = (id, v) => { const s = select(id, [['', 'All states'], ...S.map((x) => [x.id, x.name])]); s.value = v; return s; };
    [['market', 'Marketplace'], ['work', 'Workshops'], ['show', 'Showcase']].forEach(([k, l]) => { const b = el('button', l, 'chip'); b.type = 'button'; b.dataset.k = k; b.onclick = () => tab(k); ct.append(b); });
    function tab(k) { ct.querySelectorAll('.chip').forEach((b) => b.classList.toggle('on', b.dataset.k === k)); ({ market, work: workshops, show: showcase })[k](); }

    function market() {
      const wish = store.get('wish2', []), enq = store.get('enq', []), items = [];
      S.forEach((s) => [s.artForm, ...s.otherCrafts.slice(0, 2)].forEach((n) => items.push({ id: s.id + ':' + n, n, s, price: 800 + (hash(n) % 70) * 100 })));
      const st = stateSel('mst', mstate), q = Object.assign(el('input'), { type: 'text', value: mq, placeholder: 'Search crafts' }), so = select('msort', [['', 'Featured'], ['lo', 'Price: low to high'], ['hi', 'Price: high to low'], ['az', 'Name A to Z']]);
      so.value = msort; const sv = Object.assign(el('input'), { type: 'checkbox', checked: msaved }), svl = el('label', null, 'chk'); svl.append(sv, document.createTextNode('Saved only'));
      const bar = el('div', null, 'toolbar'); bar.append(field('State', st), field('Search', q), field('Sort', so), svl);
      const count = el('p', null, 'note ccount'), list = el('div', null, 'cardrow');
      const draw = () => {
        mstate = st.value; mq = q.value; msort = so.value; msaved = sv.checked;
        const rows = items.filter((i) => (!mstate || i.s.id === mstate) && (!mq || (i.n + ' ' + i.s.name).toLowerCase().includes(mq.toLowerCase())) && (!msaved || wish.includes(i.id)));
        if (msort === 'lo') rows.sort((a, b) => a.price - b.price); else if (msort === 'hi') rows.sort((a, b) => b.price - a.price); else if (msort === 'az') rows.sort((a, b) => a.n.localeCompare(b.n));
        count.textContent = rows.length + ' of ' + items.length + ' sample listings. Saved: ' + wish.length;
        list.replaceChildren();
        rows.forEach((i) => {
          const saved = wish.includes(i.id), asked = enq.includes(i.id), c = el('div', null, 'card');
          c.append(el('h3', i.n), el('p', i.s.name + ' | ' + short(i.s), 'mute'), el('p', 'Sample price Rs ' + i.price.toLocaleString('en-IN'), 'price'),
            btn(saved ? 'Saved (tap to remove)' : 'Save to wishlist', () => { flip(wish, i.id); store.set('wish2', wish); draw(); }, saved ? 'btn' : 'alt'),
            btn(asked ? 'Enquiry saved' : 'Enquire', () => { if (!asked) { enq.push(i.id); store.set('enq', enq); draw(); } }), btn('About the art', () => go('explore/' + i.s.id)));
          list.append(c);
        });
        if (!rows.length) list.append(el('p', msaved ? 'Nothing saved yet. Tap Save to wishlist on a listing.' : 'No listings match.', 'empty'));
      };
      [st, so, sv].forEach((x) => { x.onchange = draw; }); q.oninput = draw;
      cb.replaceChildren(bar, count, list, el('p', 'Sample listings from the dataset. Wishlist and enquiries are saved only in this browser. Real artisans can list work once seller accounts launch.', 'note')); draw();
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

    const SAMPLES = [
      { id: 's1', n: 'Anita', s: 'bihar', t: 'Finished my first Madhubani fish motif today. Any tips for keeping the double lines steady?', l: 12 },
      { id: 's2', n: 'Rohan', s: 'maharashtra', t: 'Our class tried Warli with rice paste on a clay-coloured sheet. The stick figures were the most fun.', l: 8 },
      { id: 's3', n: 'Meera', s: 'odisha', t: 'Which natural colours work best for a beginner Pattachitra practice piece?', l: 5 }];
    function showcase() {
      const mine = store.get('posts', []), liked = store.get('liked', {}), f = el('form', null, 'panel');
      const nm = Object.assign(el('input'), { type: 'text', maxLength: 40, required: true }), tx = Object.assign(el('input'), { type: 'text', maxLength: 200, required: true });
      f.append(field('Your name', nm), field('State', select('pst', stateOpts)), field('Share your work or a question', tx), btn('Post', () => f.requestSubmit(), 'btn'));
      f.onsubmit = (e) => { e.preventDefault(); mine.unshift({ id: 'u' + Date.now(), n: nm.value.trim(), s: f.querySelector('select').value, t: tx.value.trim(), l: 0, own: true }); store.set('posts', mine.slice(0, 30)); showcase(); };
      const list = el('div', null, 'cardrow');
      mine.forEach((p, i) => { if (!p.id) p.id = 'o' + i; });
      [...mine, ...SAMPLES].forEach((p) => {
        const st = byId(p.s); if (!st) return;
        const isMine = mine.includes(p), c = el('div', null, 'card' + (isMine ? ' mine' : '')), n = (p.l || 0) + (liked[p.id] ? 1 : 0);
        c.append(el('h3', p.n), el('p', st.name + ' | ' + short(st), 'mute'), el('p', p.t));
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
