/* KalaVerse ticket booking (DEMO). Shared by KalaYatri (chat plan) and KalaTour (day plan / curated trails).
   Nothing here is real: the tickets are samples and the payment page is a fake portal that only accepts the demo card,
   demo UPI id or demo bank shown on it. Card details are never stored or sent anywhere. Bookings stay in this browser. */
(function () {
  const $ = (id) => document.getElementById(id);
  const el = (t, x, c) => { const e = document.createElement(t); if (x != null) e.textContent = x; if (c) e.className = c; return e; };
  const store = { get: (k, d) => { try { const v = JSON.parse(localStorage.getItem('kv_' + k)); return v == null ? d : v; } catch { return d; } }, set: (k, v) => { try { localStorage.setItem('kv_' + k, JSON.stringify(v)); } catch { /* storage blocked */ } } };
  const hash = (s) => [...String(s)].reduce((h, c) => (h * 31 + c.charCodeAt(0)) >>> 0, 7);
  const money = (n) => 'Rs ' + Math.round(n).toLocaleString('en-IN');
  const r10 = (n) => Math.round(n / 10) * 10;
  const short = (s) => s.artForm.split(/ & | \/ | \(/)[0];
  const btn = (t, f, c) => { const b = el('button', t, 'btn ' + (c || 'alt')); b.type = 'button'; b.onclick = f; return b; };
  const field = (label, node) => { const l = el('label', label); l.append(node); return l; };
  const input = (type, v, at) => Object.assign(el('input'), { type, value: v == null ? '' : v }, at || {});
  const MODES = { train: ['Train, AC chair car', 1], bus: ['Bus, sleeper', 0.6], flight: ['Flight, economy', 3.2] };
  const todayISO = () => { const d = new Date(); return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); };
  const addDays = (iso, n) => { const d = new Date(iso + 'T00:00:00'); d.setDate(d.getDate() + n); return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }); };
  const niceDate = (iso) => new Date(iso + 'T00:00:00').toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' });
  const clampN = (v) => Math.max(1, Math.min(20, parseInt(v, 10) || 1));
  const DEMO_CARD = '4242 4242 4242 4242', DEMO_UPI = 'demo@kalaverse';

  let S = [], T = [], draft = null, step = 1, viewing = null, root = null;
  const byId = (id) => S.find((s) => s.id === id) || S[0];
  const tourOf = (s) => T.find((t) => t.state === s.name);
  const blank = () => ({ state: 'bihar', from: '', date: '', days: 1, travellers: 2, mode: 'train', off: [], stops: null, plan: '', planTitle: '', names: [], ages: [], contact: '' });
  const save = () => store.set('draft', draft);

  /* The tickets offered for a trip. Prices are made-up but stable (they come from a hash of the name). */
  function items(d) {
    const s = byId(d.state), t = tourOf(s), out = [], m = MODES[d.mode] || MODES.train;
    out.push({ id: 'travel', title: 'Return travel to ' + s.capital + ' (' + m[0] + ')', note: 'Per person, both ways', pp: r10((1200 + (hash(s.id) % 30) * 100) * m[1]) });
    if (d.stops && d.stops.length) {
      d.stops.forEach((x, i) => {
        if (x.kind === 'workshop') out.push({ id: 'w' + i, title: x.title, note: 'Workshop seat', pp: 500 + (hash(x.title) % 20) * 100 });
        else if (x.kind === 'heritage') out.push({ id: 'h' + i, title: x.title, note: 'Entry and guided visit', pp: 100 + (hash(x.title) % 5) * 50 });
      });
    } else {
      out.push({ id: 'w', title: s.tutorial.title, note: 'Workshop seat, ' + s.tutorial.time, pp: 500 + (hash(s.tutorial.title) % 20) * 100 });
      out.push({ id: 'h', title: 'Museum and heritage site entry, ' + s.name, note: 'Entry and guided visit', pp: 150 });
      if (t) out.push({ id: 't', title: t.title, note: 'Guided one-day art trail, ' + t.duration, pp: 400 + (hash(t.title) % 8) * 50 });
    }
    return out;
  }
  const chosen = (d) => items(d).filter((i) => !d.off.includes(i.id));
  const totalOf = (d) => chosen(d).reduce((a, i) => a + i.pp * d.travellers, 0);

  function notice(txt) { const n = el('div', null, 'bk-notice'); n.append(el('b', 'DEMO ONLY'), document.createTextNode(' ' + txt)); return n; }
  function stepper() {
    const bar = el('ol', null, 'bk-steps');
    ['Trip and tickets', 'Travellers', 'Payment', 'Tickets'].forEach((t, i) => { const li = el('li', t, i + 1 === step ? 'on' : i + 1 < step ? 'done' : ''); if (i + 1 === step) li.setAttribute('aria-current', 'step'); bar.append(li); });
    return bar;
  }

  /* ---------- Step 1: trip and tickets ---------- */
  function stepTrip() {
    const d = draft, box = el('div'), err = el('p', null, 'bk-err'); err.setAttribute('role', 'alert');
    box.append(notice('Tickets here are samples. No real booking is made and no money is taken.'));
    if (d.stops || d.plan) {
      const det = el('details', null, 'bk-plan'); det.open = true;
      det.append(el('summary', d.planTitle || (d.stops ? 'Your KalaTour plan' : 'Your KalaYatri plan')));
      if (d.stops) { const u = el('ul'); d.stops.forEach((x) => u.append(el('li', x.title))); det.append(u); } else det.append(el('p', d.plan, 'bk-plantxt'));
      det.append(el('p', 'Tickets below are matched to this plan. Untick any you do not need.', 'note'));
      box.append(det);
    }
    const st = el('select'); S.forEach((s) => { const o = el('option', s.name + ' (' + short(s) + ')'); o.value = s.id; st.append(o); }); st.value = d.state;
    const from = input('text', d.from, { maxLength: 40, placeholder: 'e.g. Delhi', autocomplete: 'off' });
    const date = input('date', d.date, { min: todayISO() });
    const days = input('number', d.days, { min: 1, max: 14 });
    const mode = el('select'); Object.entries(MODES).forEach(([k, v]) => { const o = el('option', v[0]); o.value = k; mode.append(o); }); mode.value = d.mode;
    const num = input('number', d.travellers, { min: 1, max: 20, id: 'bk-n', inputMode: 'numeric' });
    const minus = btn('−', () => { num.value = clampN(num.value - 1); num.oninput(); }, 'alt qbtn'), plus = btn('+', () => { num.value = clampN(+num.value + 1); num.oninput(); }, 'alt qbtn');
    minus.setAttribute('aria-label', 'One traveller fewer'); plus.setAttribute('aria-label', 'One traveller more');
    const qty = el('div', null, 'qty'); qty.append(minus, num, plus);
    const form = el('form', null, 'panel bk-form'); form.noValidate = true;
    const nl = field('Number of travellers (1 to 20)', qty); nl.classList.add('wide');
    form.append(field('Destination', st), field('Travelling from', from), field('Travel date', date), field('Days', days), field('Travel by', mode), nl);
    form.onsubmit = (e) => e.preventDefault();
    const list = el('div', null, 'bk-items'), foot = el('div', null, 'bk-total');
    const refresh = () => {
      list.replaceChildren();
      items(d).forEach((i) => {
        const row = el('label', null, 'bk-item'), cb = input('checkbox'); cb.checked = !d.off.includes(i.id);
        cb.onchange = () => { if (cb.checked) d.off = d.off.filter((x) => x !== i.id); else d.off.push(i.id); save(); refresh(); };
        const mid = el('span', null, 'bk-mid'); mid.append(el('b', i.title), el('small', i.note));
        row.append(cb, mid, el('span', money(i.pp) + ' × ' + d.travellers + ' = ' + money(i.pp * d.travellers), 'bk-amt')); list.append(row);
      });
      foot.replaceChildren(el('span', chosen(d).length + ' ticket type' + (chosen(d).length === 1 ? '' : 's') + ' for ' + d.travellers + ' traveller' + (d.travellers === 1 ? '' : 's')), el('b', 'Total ' + money(totalOf(d)), 'bk-sum'));
    };
    st.onchange = () => { d.from = from.value.trim(); d.date = date.value; d.state = st.value; d.stops = null; d.plan = ''; d.planTitle = ''; d.off = []; save(); render(); };
    mode.onchange = () => { d.mode = mode.value; save(); refresh(); };
    num.oninput = () => { const v = parseInt(num.value, 10); if (v >= 1 && v <= 20) { d.travellers = v; d.names = d.names.slice(0, v); d.ages = d.ages.slice(0, v); save(); refresh(); } };
    num.onchange = () => { num.value = clampN(num.value); num.oninput(); };
    from.oninput = () => { d.from = from.value.trim(); save(); }; date.onchange = () => { d.date = date.value; save(); };
    days.onchange = () => { days.value = Math.max(1, Math.min(14, parseInt(days.value, 10) || 1)); d.days = +days.value; save(); };
    refresh();
    const next = btn('Continue to traveller details', () => {
      d.from = from.value.trim(); d.date = date.value;
      if (d.from.length < 2) return void (err.textContent = 'Enter the city you are travelling from.');
      if (!d.date || d.date < todayISO()) return void (err.textContent = 'Choose a travel date from today onwards.');
      if (!chosen(d).length) return void (err.textContent = 'Tick at least one ticket.');
      err.textContent = ''; save(); step = 2; render();
    }, 'btn');
    box.append(form, el('h3', 'Tickets for this trip'), list, foot, err, next, myBookings());
    return box;
  }

  function myBookings() {
    const all = store.get('bookings', []), w = el('div', null, 'bk-mine');
    if (!all.length) return w;
    w.append(el('h3', 'My demo bookings (' + all.length + ')'));
    const u = el('ul', null, 'reqs');
    all.forEach((b) => {
      const li = el('li'), v = btn('View tickets', () => { viewing = b; step = 4; render(); }, 'alt'), x = el('button', 'Delete', 'linkbtn'); x.type = 'button';
      x.onclick = () => { store.set('bookings', store.get('bookings', []).filter((k) => k.id !== b.id)); render(); };
      li.append(el('span', b.id + ' | ' + b.stateName + ' | ' + niceDate(b.date) + ' | ' + money(b.total)), v, x); u.append(li);
    });
    w.append(u); return w;
  }

  /* ---------- Step 2: traveller names ---------- */
  function stepPeople() {
    const d = draft, box = el('div'), err = el('p', null, 'bk-err'); err.setAttribute('role', 'alert');
    box.append(notice('Use any names you like. Details stay in this browser.'), el('h3', 'Who is travelling? (' + d.travellers + ')'));
    const form = el('form', null, 'bk-people'), nm = [], ag = [];
    form.onsubmit = (e) => e.preventDefault();
    for (let i = 0; i < d.travellers; i++) {
      const row = el('div', null, 'bk-person'), n = input('text', d.names[i] || '', { maxLength: 40, placeholder: 'Traveller ' + (i + 1) + ' full name', autocomplete: 'off' }), a = input('number', d.ages[i] || '', { min: 1, max: 100, placeholder: 'Age' });
      n.setAttribute('aria-label', 'Name of traveller ' + (i + 1)); a.setAttribute('aria-label', 'Age of traveller ' + (i + 1));
      nm.push(n); ag.push(a); row.append(el('span', String(i + 1), 'bk-no'), n, a); form.append(row);
    }
    const contact = input('text', d.contact, { maxLength: 60, placeholder: 'Phone or email for the booking (optional)' });
    const back = btn('Back', () => { step = 1; render(); }), go = btn('Continue to payment', () => {
      const names = nm.map((x) => x.value.trim()), ages = ag.map((x) => x.value.trim());
      if (names.some((x) => x.length < 2)) return void (err.textContent = 'Enter a name for every traveller.');
      if (ages.some((x) => !(+x >= 1 && +x <= 100))) return void (err.textContent = 'Enter an age between 1 and 100 for every traveller.');
      d.names = names; d.ages = ages; d.contact = contact.value.trim(); err.textContent = ''; save(); step = 3; render();
    }, 'btn');
    box.append(form, field('Contact (optional)', contact), err, back, go);
    return box;
  }

  /* ---------- Step 3: fake payment portal ---------- */
  function orderSummary() {
    const d = draft, s = byId(d.state), w = el('aside', null, 'bk-order');
    w.append(el('h3', 'Order summary'), el('p', s.name + ' | ' + niceDate(d.date) + ' | from ' + d.from, 'mute'));
    const u = el('ul'); chosen(d).forEach((i) => u.append(el('li', i.title + '  × ' + d.travellers + '  ' + money(i.pp * d.travellers)))); w.append(u);
    w.append(el('p', 'Total ' + money(totalOf(d)), 'bk-sum'), el('p', d.names.join(', '), 'note')); return w;
  }
  /* Generic fake payment portal. o = { total, name, summary (node), back(), paid(method) }. Used by tickets and by the cart. */
  function payPanel(o) {
    const wrap = el('div', null, 'bk-paywrap'), box = el('div'); let tab = 'card', busy = false;
    const err = el('p', null, 'bk-err'); err.setAttribute('role', 'alert');
    const warn = el('div', null, 'bk-notice strong'); warn.append(el('b', 'FAKE PAYMENT PAGE'), document.createTextNode(' Never type a real card number, UPI PIN, OTP or bank password here. Only the demo details below work, and nothing is sent or saved.'));
    const tabs = el('div', null, 'bk-tabs'), pane = el('div', null, 'bk-pane');
    const card = { num: input('text', '', { placeholder: '4242 4242 4242 4242', inputMode: 'numeric', autocomplete: 'off', maxLength: 19 }), name: input('text', '', { placeholder: 'Name on card', autocomplete: 'off', maxLength: 40 }), exp: input('text', '', { placeholder: 'MM/YY', autocomplete: 'off', maxLength: 5 }), cvv: input('password', '', { placeholder: 'CVV', autocomplete: 'off', maxLength: 3, inputMode: 'numeric' }) };
    card.num.oninput = () => { card.num.value = card.num.value.replace(/\D/g, '').slice(0, 16).replace(/(.{4})/g, '$1 ').trim(); };
    card.exp.oninput = () => { let v = card.exp.value.replace(/\D/g, '').slice(0, 4); if (v.length > 2) v = v.slice(0, 2) + '/' + v.slice(2); card.exp.value = v; };
    const upi = input('text', '', { placeholder: DEMO_UPI, autocomplete: 'off', maxLength: 40 });
    const bank = el('select'); [['', 'Choose a bank'], ['demo', 'KalaVerse Demo Bank']].forEach(([v, t]) => { const o = el('option', t); o.value = v; bank.append(o); });
    const draw = () => {
      tabs.querySelectorAll('button').forEach((b) => b.classList.toggle('on', b.dataset.k === tab)); err.textContent = '';
      const hint = (t, fill) => { const p = el('p', null, 'note'); p.append(document.createTextNode(t + ' ')); p.append(btn('Fill demo details', fill, 'alt qbtn')); return p; };
      if (tab === 'card') { const g = el('div', null, 'bk-grid'); g.append(field('Card number', card.num), field('Name on card', card.name), field('Expiry', card.exp), field('CVV', card.cvv)); pane.replaceChildren(hint('Demo card ' + DEMO_CARD + ', any future expiry, any 3 digits. The number 4000 0000 0000 0002 shows a declined payment.', () => { card.num.value = DEMO_CARD; card.name.value = o.name || 'Demo Traveller'; card.exp.value = '12/30'; card.cvv.value = '123'; }), g); }
      else if (tab === 'upi') pane.replaceChildren(hint('Demo UPI id ' + DEMO_UPI + '.', () => { upi.value = DEMO_UPI; }), field('UPI id', upi));
      else pane.replaceChildren(hint('Choose KalaVerse Demo Bank.', () => { bank.value = 'demo'; }), field('Bank', bank));
    };
    [['card', 'Card'], ['upi', 'UPI'], ['bank', 'Net banking']].forEach(([k, l]) => { const b = el('button', l, 'chip'); b.type = 'button'; b.dataset.k = k; b.onclick = () => { if (!busy) { tab = k; draw(); } }; tabs.append(b); });
    const pay = btn('Pay ' + money(o.total) + ' (demo)', () => {
      if (busy) return; let method = '', fail = false;
      if (tab === 'card') {
        const n = card.num.value.replace(/\s/g, '');
        if (!n) return void (err.textContent = 'Enter the demo card, or tap Fill demo details.');
        if (n !== '4242424242424242' && n !== '4000000000000002') { card.num.value = ''; card.cvv.value = ''; return void (err.textContent = 'This is a demo. Real card numbers are not accepted. Tap Fill demo details.'); }
        if (!/^(0[1-9]|1[0-2])\/\d\d$/.test(card.exp.value)) return void (err.textContent = 'Enter the expiry as MM/YY.');
        if (!/^\d{3}$/.test(card.cvv.value) || card.name.value.trim().length < 2) return void (err.textContent = 'Enter the name on card and a 3 digit CVV.');
        method = 'Demo card ending ' + n.slice(-4); fail = n === '4000000000000002';
      } else if (tab === 'upi') { if (!/^[\w.-]+@kalaverse$/i.test(upi.value.trim())) return void (err.textContent = 'Only demo UPI ids ending in @kalaverse work here. Tap Fill demo details.'); method = 'Demo UPI'; }
      else { if (bank.value !== 'demo') return void (err.textContent = 'Choose KalaVerse Demo Bank.'); method = 'Demo net banking'; }
      busy = true; pay.disabled = true; back.disabled = true; err.textContent = ''; pane.replaceChildren(el('p', 'Processing your demo payment. Please do not close this page', 'typing'));
      Object.values(card).forEach((x) => { x.value = ''; });   // card details never leave the form
      setTimeout(() => {
        if (fail) { busy = false; pay.disabled = false; back.disabled = false; draw(); err.textContent = 'Payment declined (demo card for testing failures). Try the other demo card.'; return; }
        o.paid(method);
      }, 1700);
    }, 'btn');
    const back = btn('Back', () => { if (!busy) o.back(); });
    box.append(warn, tabs, pane, err, back, pay); draw();
    wrap.append(box, o.summary); return wrap;
  }

  function stepPay() {
    const d = draft;
    return payPanel({ total: totalOf(d), name: d.names[0], summary: orderSummary(), back: () => { step = 2; render(); }, paid: (method) => {
      const b = { id: 'KV' + Date.now().toString(36).toUpperCase().slice(-6) + Math.floor(Math.random() * 90 + 10), date: d.date, created: Date.now(), state: d.state, stateName: byId(d.state).name, from: d.from, days: d.days, names: d.names, ages: d.ages, contact: d.contact, method, total: totalOf(d), items: chosen(d).map((i) => ({ title: i.title, note: i.note, pp: i.pp })), travellers: d.travellers };
      store.set('bookings', [b, ...store.get('bookings', [])].slice(0, 20)); viewing = b; step = 4; render();
    } });
  }

  /* ---------- Step 4: demo tickets ---------- */
  function qr(seed) {
    const NS = 'http://www.w3.org/2000/svg', n = 25, svg = document.createElementNS(NS, 'svg'); svg.setAttribute('viewBox', '0 0 ' + n + ' ' + n); svg.setAttribute('class', 'bk-qr'); svg.setAttribute('role', 'img'); svg.setAttribute('aria-label', 'Sample code, not scannable');
    let x = hash(seed) || 1; const rnd = () => { x ^= x << 13; x >>>= 0; x ^= x >>> 17; x ^= x << 5; x >>>= 0; return x / 4294967296; };
    const rect = (a, b, w, h, fill) => { const r = document.createElementNS(NS, 'rect'); r.setAttribute('x', a); r.setAttribute('y', b); r.setAttribute('width', w); r.setAttribute('height', h); r.setAttribute('fill', fill || 'currentColor'); svg.append(r); };
    const finder = (a, b) => { rect(a, b, 7, 7); rect(a + 1, b + 1, 5, 5, '#fff'); rect(a + 2, b + 2, 3, 3); };
    for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) { if ((i < 8 && j < 8) || (i < 8 && j > n - 9) || (i > n - 9 && j < 8)) continue; if (rnd() > 0.52) rect(j, i, 1, 1); }
    finder(0, 0); finder(n - 7, 0); finder(0, n - 7); return svg;
  }
  function stepTickets() {
    const b = viewing, box = el('div'), ok = el('div', null, 'bk-ok');
    ok.append(el('h3', 'Booking confirmed (demo)'), el('p', 'Booking ID ' + b.id + '. Paid ' + money(b.total) + ' by ' + b.method + '. This is a sample booking, so no real ticket exists and nothing was charged.'));
    box.append(ok);
    const list = el('div', null, 'bk-tickets');
    b.items.forEach((it, i) => {
      const t = el('article', null, 'bk-ticket'), main = el('div', null, 'bk-tmain');
      main.append(el('small', 'DEMO TICKET | NOT VALID FOR TRAVEL OR ENTRY', 'bk-rib'), el('h4', it.title), el('p', it.note + ' | ' + b.from + ' to ' + b.stateName, 'mute'), el('p', niceDate(b.date) + (b.days > 1 ? ' to ' + addDays(b.date, b.days - 1) : '')), el('p', 'Passengers (' + b.names.length + '): ' + b.names.map((n, k) => n + (b.ages[k] ? ' (' + b.ages[k] + ')' : '')).join(', ')), el('p', 'Ticket ' + b.id + '-' + (i + 1) + ' | ' + money(it.pp) + ' × ' + b.names.length, 'note'));
      const side = el('div', null, 'bk-tside'); side.append(qr(b.id + i), el('small', 'Sample code', 'note')); t.append(main, side); list.append(t);
    });
    box.append(list);
    const row = el('div', null, 'noprint');
    row.append(btn('Print tickets', () => { document.body.classList.add('print-tix'); window.print(); setTimeout(() => document.body.classList.remove('print-tix'), 500); }, 'btn'), btn('Plan another trip with KalaYatri', () => window.openYatri && window.openYatri()), btn('Book another trip', () => { draft = blank(); save(); viewing = null; step = 1; render(); }));
    box.append(row); return box;
  }

  function render() {
    if (!root || !S.length) return;
    const parts = [el('h2', 'Book tickets'), el('p', 'Turn your KalaYatri or KalaTour plan into sample tickets. Choose how many people are travelling, pick the tickets and pay on the demo payment page.', 'mute narrow'), stepper()];
    if (step === 4 && viewing) parts.push(stepTickets());
    else if (step === 3) parts.push(stepPay());
    else if (step === 2) parts.push(stepPeople());
    else parts.push(stepTrip());
    root.replaceChildren(...parts); if (render.last !== step) { render.last = step; root.scrollIntoView({ block: 'start' }); }
  }

  /* Other pages call this to open the booking page with a plan. */
  function start(p) {
    draft = Object.assign(blank(), p || {}); if (!S.some((s) => s.id === draft.state)) draft.state = S[0].id;
    draft.travellers = clampN(draft.travellers); draft.days = Math.max(1, Math.min(14, parseInt(draft.days, 10) || 1)); draft.off = []; draft.names = []; draft.ages = [];
    viewing = null; step = 1; save();
    if (location.hash === '#book') render(); else location.hash = 'book';
  }
  function init(data) {
    S = data.states; T = data.tours; root = $('bk'); if (!root) return;
    const saved = store.get('draft', null); draft = saved && S.some((s) => s.id === saved.state) ? Object.assign(blank(), saved) : blank();
    document.addEventListener('kv-view', (e) => { if (e.detail === 'book') { if (!draft) draft = blank(); render(); } });
    render();
  }
  window.KVbook = { init, start };
  window.KVpay = { panel: payPanel };
})();
