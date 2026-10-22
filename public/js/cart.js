/* KalaVerse marketplace cart and checkout (DEMO). Cart, delivery details and orders stay in this browser.
   Payment uses the same fake portal as ticket booking (window.KVpay). Nothing is charged or shipped. */
(function () {
  const $ = (id) => document.getElementById(id);
  const el = (t, x, c) => { const e = document.createElement(t); if (x != null) e.textContent = x; if (c) e.className = c; return e; };
  const store = { get: (k, d) => { try { const v = JSON.parse(localStorage.getItem('kv_' + k)); return v == null ? d : v; } catch { return d; } }, set: (k, v) => { try { localStorage.setItem('kv_' + k, JSON.stringify(v)); } catch { /* storage blocked */ } } };
  const money = (n) => 'Rs ' + Math.round(n).toLocaleString('en-IN');
  const btn = (t, f, c) => { const b = el('button', t, 'btn ' + (c || 'alt')); b.type = 'button'; b.onclick = f; return b; };
  const field = (label, node) => { const l = el('label', label); l.append(node); return l; };
  const input = (type, v, at) => Object.assign(el('input'), { type, value: v == null ? '' : v }, at || {});
  const FREE_OVER = 3000, SHIPPING = 99;

  let S = [], root = null, step = 1, viewing = null, addr = store.get('addr', { name: '', phone: '', line: '', city: '', pin: '' });
  let cart = store.get('cart', []);
  const saveCart = () => { store.set('cart', cart); badge(); };
  const count = () => cart.reduce((a, i) => a + i.qty, 0);
  const sub = () => cart.reduce((a, i) => a + i.price * i.qty, 0);
  const ship = () => (cart.length && sub() < FREE_OVER ? SHIPPING : 0);
  const total = () => sub() + ship();
  function badge() { const a = $('cartlink'); if (a) { const n = count(); a.textContent = n ? 'Cart (' + n + ')' : 'Cart'; } }

  function thumb(it) {   // same picture rules as the marketplace cards
    const im = el('img', null, 'ct-img'); im.alt = it.n; im.loading = 'lazy';
    const tries = ['img/market/' + encodeURIComponent(String(it.n).replace(/\//g, ' ').replace(/\s+/g, ' ').trim() + '.jfif'), 'img/market/market-placeholder.jfif'];
    let k = 0; im.onerror = () => { k++; if (k < tries.length) im.src = tries[k]; else im.onerror = null; }; im.src = tries[0]; return im;
  }
  function notice() { const n = el('div', null, 'bk-notice'); n.append(el('b', 'DEMO SHOP'), document.createTextNode(' Nothing here is real. No money is taken and nothing will be shipped.')); return n; }
  function stepper() { const bar = el('ol', null, 'bk-steps'); ['Cart', 'Delivery', 'Payment', 'Order'].forEach((t, i) => { const li = el('li', t, i + 1 === step ? 'on' : i + 1 < step ? 'done' : ''); bar.append(li); }); return bar; }

  /* ---------- Step 1: cart ---------- */
  function stepCart() {
    const box = el('div'); box.append(notice());
    if (!cart.length) {
      box.append(el('p', 'Your cart is empty.', 'empty'), btn('Browse the marketplace', () => { location.hash = 'community'; }, 'btn'), orders()); return box;
    }
    const list = el('div', null, 'bk-items');
    cart.forEach((it) => {
      const row = el('div', null, 'bk-item ct-item'), mid = el('span', null, 'bk-mid'), q = el('div', null, 'qty');
      mid.append(el('b', it.n), el('small', it.sname + ' | ' + money(it.price) + ' each'));
      const minus = btn('−', () => { it.qty = Math.max(1, it.qty - 1); saveCart(); render(); }, 'alt qbtn'), plus = btn('+', () => { it.qty = Math.min(20, it.qty + 1); saveCart(); render(); }, 'alt qbtn');
      minus.setAttribute('aria-label', 'One less ' + it.n); plus.setAttribute('aria-label', 'One more ' + it.n);
      q.append(minus, el('span', String(it.qty), 'ct-q'), plus);
      const rm = el('button', 'Remove', 'linkbtn'); rm.type = 'button'; rm.onclick = () => { cart = cart.filter((x) => x !== it); saveCart(); render(); };
      const right = el('div', null, 'ct-right'); right.append(el('b', money(it.price * it.qty), 'bk-amt'), q, rm);
      row.append(thumb(it), mid, right); list.append(row);
    });
    const tot = el('div', null, 'ct-totals');
    [['Subtotal (' + count() + ' item' + (count() === 1 ? '' : 's') + ')', money(sub())], ['Delivery', ship() ? money(ship()) : 'Free'], ['Total', money(total())]].forEach(([a, b], i) => { const r = el('div', null, i === 2 ? 'ct-row big' : 'ct-row'); r.append(el('span', a), el('b', b)); tot.append(r); });
    box.append(list, tot, el('p', 'Delivery is free on orders of ' + money(FREE_OVER) + ' or more.', 'note'), btn('Checkout', () => { step = 2; render(); }, 'btn'), btn('Keep shopping', () => { location.hash = 'community'; }), btn('Clear cart', () => { cart = []; saveCart(); render(); }, 'alt'), orders());
    return box;
  }

  /* ---------- Step 2: delivery ---------- */
  function stepAddress() {
    const box = el('div'), err = el('p', null, 'bk-err'); err.setAttribute('role', 'alert');
    box.append(notice(), el('h3', 'Delivery details'));
    const f = el('form', null, 'panel bk-form'); f.noValidate = true; f.onsubmit = (e) => e.preventDefault();
    const name = input('text', addr.name, { maxLength: 60, autocomplete: 'off' }), phone = input('text', addr.phone, { maxLength: 10, inputMode: 'numeric', autocomplete: 'off', placeholder: '10 digit number' }),
      line = input('text', addr.line, { maxLength: 100, autocomplete: 'off', placeholder: 'House, street, area' }), city = input('text', addr.city, { maxLength: 40, autocomplete: 'off' }), pin = input('text', addr.pin, { maxLength: 6, inputMode: 'numeric', autocomplete: 'off', placeholder: '6 digits' });
    const wide = field('Address', line); wide.classList.add('wide');
    f.append(field('Full name', name), field('Phone', phone), wide, field('City', city), field('PIN code', pin));
    const go = btn('Continue to payment', () => {
      const a = { name: name.value.trim(), phone: phone.value.trim(), line: line.value.trim(), city: city.value.trim(), pin: pin.value.trim() };
      if (a.name.length < 2) return void (err.textContent = 'Enter your name.');
      if (!/^\d{10}$/.test(a.phone)) return void (err.textContent = 'Enter a 10 digit phone number.');
      if (a.line.length < 4 || a.city.length < 2) return void (err.textContent = 'Enter your address and city.');
      if (!/^\d{6}$/.test(a.pin)) return void (err.textContent = 'Enter a 6 digit PIN code.');
      addr = a; store.set('addr', a); step = 3; render();
    }, 'btn');
    box.append(f, el('p', 'Use any made-up address. It stays in this browser only.', 'note'), err, btn('Back', () => { step = 1; render(); }), go); return box;
  }

  /* ---------- Step 3: fake payment (shared portal) ---------- */
  function summary() {
    const w = el('aside', null, 'bk-order'); w.append(el('h3', 'Order summary'));
    const u = el('ul'); cart.forEach((i) => u.append(el('li', i.n + ' × ' + i.qty + '  ' + money(i.price * i.qty)))); w.append(u);
    w.append(el('p', 'Delivery ' + (ship() ? money(ship()) : 'Free'), 'note'), el('p', 'Total ' + money(total()), 'bk-sum'), el('p', 'Deliver to ' + addr.name + ', ' + addr.line + ', ' + addr.city + ' ' + addr.pin, 'note')); return w;
  }
  function stepPay() {
    return window.KVpay.panel({ total: total(), name: addr.name, summary: summary(), back: () => { step = 2; render(); }, paid: (method) => {
      const eta = new Date(); eta.setDate(eta.getDate() + 5 + Math.floor(Math.random() * 3));
      const o = { id: 'KO' + Date.now().toString(36).toUpperCase().slice(-6) + Math.floor(Math.random() * 90 + 10), created: Date.now(), eta: eta.toISOString().slice(0, 10), items: cart.map((i) => ({ n: i.n, sname: i.sname, price: i.price, qty: i.qty })), subtotal: sub(), shipping: ship(), total: total(), addr, method };
      store.set('orders', [o, ...store.get('orders', [])].slice(0, 20)); cart = []; saveCart(); viewing = o; step = 4; render();
    } });
  }

  /* ---------- Step 4: demo order ---------- */
  const nice = (iso) => new Date(iso + 'T00:00:00').toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' });
  function stepOrder() {
    const o = viewing, box = el('div'), ok = el('div', null, 'bk-ok');
    ok.append(el('h3', 'Order placed (demo)'), el('p', 'Order ID ' + o.id + '. Paid ' + money(o.total) + ' by ' + o.method + '. This is a sample order: nothing was charged and nothing will be shipped.'));
    const inv = el('article', null, 'bk-ticket ct-invoice'), main = el('div', null, 'bk-tmain');
    main.append(el('small', 'DEMO ORDER | NOT A REAL PURCHASE', 'bk-rib'), el('h4', 'Order ' + o.id), el('p', 'Expected delivery (sample): ' + nice(o.eta)), el('p', 'Deliver to: ' + o.addr.name + ', ' + o.addr.line + ', ' + o.addr.city + ' ' + o.addr.pin + ', phone ' + o.addr.phone, 'mute'));
    const u = el('ul', null, 'ct-lines'); o.items.forEach((i) => u.append(el('li', i.n + ' (' + i.sname + ') × ' + i.qty + ' = ' + money(i.price * i.qty))));
    main.append(u, el('p', 'Subtotal ' + money(o.subtotal) + ' | Delivery ' + (o.shipping ? money(o.shipping) : 'Free') + ' | Total ' + money(o.total), 'note')); inv.append(main); box.append(ok, inv);
    const row = el('div', null, 'noprint');
    row.append(btn('Print order', () => { document.body.classList.add('print-tix'); window.print(); setTimeout(() => document.body.classList.remove('print-tix'), 500); }, 'btn'), btn('Back to marketplace', () => { viewing = null; step = 1; location.hash = 'community'; }), btn('My cart', () => { viewing = null; step = 1; render(); }));
    box.append(row); return box;
  }

  function orders() {
    const all = store.get('orders', []), w = el('div', null, 'bk-mine'); if (!all.length) return w;
    w.append(el('h3', 'My demo orders (' + all.length + ')')); const u = el('ul', null, 'reqs');
    all.forEach((o) => { const li = el('li'), v = btn('View order', () => { viewing = o; step = 4; render(); }, 'alt'); li.append(el('span', o.id + ' | ' + money(o.total) + ' | ' + o.items.length + ' item' + (o.items.length === 1 ? '' : 's')), v); u.append(li); });
    w.append(u); return w;
  }

  function render() {
    if (!root) return;
    const parts = [el('h2', 'Your cart'), el('p', 'Review what you picked from the marketplace, add your delivery details and pay on the demo payment page.', 'mute narrow'), stepper()];
    parts.push(step === 4 && viewing ? stepOrder() : step === 3 && cart.length ? stepPay() : step === 2 && cart.length ? stepAddress() : (step = 1, stepCart()));
    root.replaceChildren(...parts); if (render.last !== step) { render.last = step; root.scrollIntoView({ block: 'start' }); }
  }

  /* The marketplace calls these. */
  function add(it, qty) {
    const f = cart.find((x) => x.id === it.id);
    if (f) f.qty = Math.min(20, f.qty + (qty || 1)); else cart.push({ id: it.id, n: it.n, sid: it.s.id, sname: it.s.name, price: it.price, slot: it.slot || 1, qty: qty || 1 });
    saveCart(); return cart.find((x) => x.id === it.id).qty;
  }
  function init(data) {
    S = data.states; root = $('ct'); badge(); if (!root) return;
    document.addEventListener('kv-view', (e) => { if (e.detail === 'cart') { if (step === 4 && !viewing) step = 1; render(); } });
    render();
  }
  window.KVcart = { init, add, open: () => { viewing = null; step = 1; if (location.hash === '#cart') render(); else location.hash = 'cart'; } };
})();
