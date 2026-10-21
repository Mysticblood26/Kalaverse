/* KalaYatri: floating travel agent (top right) and a shared streaming helper. */
(function () {
  const el = (t, x, c) => { const e = document.createElement(t); if (x != null) e.textContent = x; if (c) e.className = c; return e; };
  window.KVstream = async function (url, body, onChunk) {
    let res; try { res = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }); } catch (e) { return { err: 'nofetch' }; }
    if (res.status === 429) return { err: 'rate' };
    if (!res.ok || !res.body) return { err: 'http' };
    const rd = res.body.getReader(), dec = new TextDecoder(); let buf = '', got = false, err = null;
    for (;;) {
      const { value, done } = await rd.read(); if (done) break;
      buf += dec.decode(value, { stream: true }); const parts = buf.split('\n\n'); buf = parts.pop();
      for (const p of parts) { if (!p.startsWith('data:')) continue; let j; try { j = JSON.parse(p.slice(5)); } catch (e) { continue; } if (j.type === 'chunk') { got = true; onChunk(j.text); } else if (j.type === 'error') err = j.code || 'error'; }
    }
    return got ? {} : { err: err || 'empty' };
  };
  const GREET = 'Namaste! I am KalaYatri, your travel agent for art and culture trips. Tell me where you want to go, how many days you have and where you start from.';
  const CHIPS = ['Plan a 3 day trip to Bihar', 'Art trip from Delhi for a weekend', 'Best time to visit Rajasthan for crafts'];
  const btn = el('button', null, 'ybtn'); btn.type = 'button'; btn.setAttribute('aria-label', 'KalaYatri travel agent'); btn.title = 'KalaYatri';
  btn.innerHTML = '<svg viewBox="-12 -12 24 24" aria-hidden="true" focusable="false"><g fill="none" stroke="currentColor" stroke-width="1.4"><circle r="10"/><path d="M0-7L2.2 0 0 7-2.2 0z" fill="currentColor"/><path d="M-7 0L0 2.2 7 0 0-2.2z"/></g></svg>';
  const box = el('section', null, 'ybox'); box.hidden = true; box.setAttribute('aria-label', 'KalaYatri chat');
  const head = el('div', null, 'yhead'), x = el('button', '×', 'yx'); x.type = 'button'; x.setAttribute('aria-label', 'Close');
  const ttl = el('div'); ttl.append(el('b', 'KalaYatri'), el('small', 'Your travel agent')); head.append(ttl, x);
  const log = el('div', null, 'ylog'); log.setAttribute('aria-live', 'polite');
  const chips = el('div', null, 'ychips'), form = el('form', null, 'ybar'), inp = el('input'), send = el('button', 'Send', 'ysend');
  inp.type = 'text'; inp.maxLength = 500; inp.placeholder = 'Where do you want to travel?'; inp.autocomplete = 'off'; send.type = 'submit'; form.append(inp, send);
  box.append(head, log, chips, form); document.body.append(btn, box);
  let history = [], busy = false;
  const bubble = (role, t) => { const m = el('div', t, 'ym ' + role); log.append(m); log.scrollTop = log.scrollHeight; return m; };
  const NOTE = { rate: 'Too many questions in a short time. Please wait a minute.', no_key: 'The travel agent needs an API key on the server.', nofetch: 'The server is not reachable right now.' };
  async function ask(q) {
    q = q.trim(); if (!q || busy) return; busy = true; chips.hidden = true; inp.value = ''; bubble('me', q);
    const out = bubble('ai', 'KalaYatri is typing'); out.classList.add('typing'); let txt = '';
    const r = await window.KVstream('/api/yatri', { message: q, history, lang: window.I18n.lang }, (c) => { txt += c; out.classList.remove('typing'); out.textContent = txt; log.scrollTop = log.scrollHeight; });
    if (r.err) { out.classList.remove('typing'); out.textContent = txt || NOTE[r.err] || 'The travel agent is busy. Please try again in a moment.'; }
    history.push({ role: 'user', content: q }); if (txt) history.push({ role: 'assistant', content: txt }); history = history.slice(-10); busy = false;
  }
  CHIPS.forEach((c) => { const b = el('button', c, 'ychip'); b.type = 'button'; b.onclick = () => ask(c); chips.append(b); });
  const open = (q) => { box.hidden = false; btn.classList.add('on'); if (!log.children.length) bubble('ai', GREET); if (q) ask(q); else inp.focus(); };
  const close = () => { box.hidden = true; btn.classList.remove('on'); };
  btn.onclick = () => (box.hidden ? open() : close()); x.onclick = close; form.onsubmit = (e) => { e.preventDefault(); ask(inp.value); };
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && !box.hidden) close(); });
  document.addEventListener('click', (e) => { const t = e.target.closest('[data-yatri]'); if (t) { e.preventDefault(); open(); } });
  document.addEventListener('kv-view', (e) => { btn.hidden = e.detail === 'kalasathi'; }); // in KalaSathi the round button is replaced by the header button
  const hb = document.getElementById('ychat'); if (hb) hb.onclick = () => (box.hidden ? open() : close());
  window.openYatri = open;
})();
