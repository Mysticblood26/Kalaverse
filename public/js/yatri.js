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
  const GREET = 'Namaste! I am KalaYatri, your travel agent for art and culture trips. Tell me where you want to go, how many days you have and where you start from. Set the number of travellers above, and I will plan for the whole group. When the plan looks good, tap Book tickets.';
  const CHIPS = ['Plan a 3 day trip to Bihar from Delhi', 'Art trip from Mumbai to Odisha for a weekend', 'Best time to visit Rajasthan for crafts'];
  const btn = el('button', null, 'ybtn'); btn.type = 'button'; btn.setAttribute('aria-label', 'KalaYatri travel agent'); btn.title = 'KalaYatri';
  btn.innerHTML = '<svg viewBox="-12 -12 24 24" aria-hidden="true" focusable="false"><g fill="none" stroke="currentColor" stroke-width="1.4"><circle r="10"/><path d="M0-7L2.2 0 0 7-2.2 0z" fill="currentColor"/><path d="M-7 0L0 2.2 7 0 0-2.2z"/></g></svg>';
  const box = el('section', null, 'ybox'); box.hidden = true; box.setAttribute('aria-label', 'KalaYatri chat');
  const head = el('div', null, 'yhead'), x = el('button', '×', 'yx'); x.type = 'button'; x.setAttribute('aria-label', 'Close');
  const ttl = el('div'); ttl.append(el('b', 'KalaYatri'), el('small', 'Your travel agent')); head.append(ttl, x);
  // Travellers box and Book tickets shortcut, always visible under the header.
  const tools = el('div', null, 'ytools'), tl = el('label', 'Travellers'), tn = el('input'), tminus = el('button', '\u2212', 'yq'), tplus = el('button', '+', 'yq'), bk = el('button', 'Book tickets', 'ybook');
  tn.type = 'number'; tn.min = 1; tn.max = 20; tn.inputMode = 'numeric'; tn.setAttribute('aria-label', 'Number of travellers');
  tminus.type = tplus.type = bk.type = 'button'; tminus.setAttribute('aria-label', 'One traveller fewer'); tplus.setAttribute('aria-label', 'One traveller more');
  try { tn.value = Math.max(1, Math.min(20, parseInt(JSON.parse(localStorage.getItem('kv_trav')), 10) || 2)); } catch (e) { tn.value = 2; }
  const trav = () => Math.max(1, Math.min(20, parseInt(tn.value, 10) || 1));
  const setTrav = (v) => { tn.value = Math.max(1, Math.min(20, v || 1)); try { localStorage.setItem('kv_trav', JSON.stringify(trav())); } catch (e) { /* storage blocked */ } };
  tn.onchange = () => setTrav(parseInt(tn.value, 10)); tminus.onclick = () => setTrav(trav() - 1); tplus.onclick = () => setTrav(trav() + 1);
  tl.append(tn); tools.append(tl, tminus, tplus, bk);
  const log = el('div', null, 'ylog'); log.setAttribute('aria-live', 'polite');
  const chips = el('div', null, 'ychips'), form = el('form', null, 'ybar'), inp = el('input'), send = el('button', 'Send', 'ysend');
  inp.type = 'text'; inp.maxLength = 500; inp.placeholder = 'Where do you want to travel?'; inp.autocomplete = 'off'; send.type = 'submit'; form.append(inp, send);
  box.append(head, tools, log, chips, form); document.body.append(btn, box);
  let history = [], busy = false;
  /* Work out the trip from what was said, so the booking page opens with the right place, city, days and group size. */
  function tripFromChat(planText) {
    const data = window.KVdata; if (!data) return null;
    const ai = (planText || '').toLowerCase(), all = (history.map((h) => h.content).join(' ') + ' ' + (planText || '')).toLowerCase();
    const keys = (st) => [st.name.toLowerCase(), st.artForm.split(/ & | \/ | \(/)[0].toLowerCase()].filter((k) => k.length >= 5 || k === st.name.toLowerCase());
    const where = (txt) => { let best = null, at = -1; data.states.forEach((st) => keys(st).forEach((k) => { const i = txt.lastIndexOf(k); if (i > at) { at = i; best = st; } })); return best; };
    const st = where(ai) || where(all); if (!st) return null;
    const users = history.filter((h) => h.role === 'user').map((h) => h.content);
    let days = 1; for (const u of users) { const m = u.match(/(\d{1,2})\s*[- ]?\s*days?\b/i); if (m) days = +m[1]; else if (/weekend/i.test(u)) days = 2; }
    let from = ''; for (const u of users) { const m = u.match(/\bfrom\s+([A-Za-z][A-Za-z ]{1,24}?)(?=\s+(?:to|for|and|on|in|with|by|this|next)\b|[,.!?]|$)/i); if (m) from = m[1].trim().replace(/\b\w/g, (c) => c.toUpperCase()); }
    return { state: st.id, from, days: Math.max(1, Math.min(14, days)), travellers: trav(), plan: planText || '', planTitle: 'Your KalaYatri plan' };
  }
  function bookNow(planText) {
    const trip = tripFromChat(planText); if (!window.KVbook) return;
    if (!trip) { bubble('ai', 'Tell me which state you want to visit first, and I will plan it. Then you can book tickets for it.'); return; }
    box.hidden = true; btn.classList.remove('on'); window.KVbook.start(trip);
  }
  bk.onclick = () => { const last = [...history].reverse().find((h) => h.role === 'assistant'); bookNow(last ? last.content : ''); };
  let stick = true; log.addEventListener('scroll', () => { stick = log.scrollHeight - log.scrollTop - log.clientHeight < 80; }, { passive: true });
  const follow = () => { if (stick) log.scrollTop = log.scrollHeight; };
  const bubble = (role, t) => { const m = el('div', t, 'ym ' + role); log.append(m); if (role === 'me') stick = true; follow(); return m; };
  const NOTE = { rate: 'Too many questions in a short time. Please wait a minute.', no_key: 'The travel agent needs an API key on the server.', nofetch: 'The server is not reachable right now.' };
  async function ask(q) {
    q = q.trim(); if (!q || busy) return; busy = true; chips.hidden = true; inp.value = ''; bubble('me', q);
    const out = bubble('ai', 'KalaYatri is typing'); out.classList.add('typing'); let txt = '';
    const r = await window.KVstream('/api/yatri', { message: q, history, lang: window.I18n.lang, travellers: trav() }, (c) => { txt += c; out.classList.remove('typing'); out.textContent = txt; follow(); });
    if (r.err) { out.classList.remove('typing'); out.textContent = txt || NOTE[r.err] || 'The travel agent is busy. Please try again in a moment.'; }
    history.push({ role: 'user', content: q }); if (txt) history.push({ role: 'assistant', content: txt }); history = history.slice(-10); busy = false;
    // A reply that looks like a plan gets a button that takes it to the ticket page.
    if (txt && txt.length > 120 && (/^\s*-/m.test(txt) || /\bday\s*\d|\bday\b/i.test(txt)) && tripFromChat(txt)) {
      const act = el('div', null, 'yact'), b = el('button', 'Book tickets for this plan', 'ybook'); b.type = 'button'; b.onclick = () => bookNow(txt);
      act.append(b, el('small', 'for ' + trav() + (trav() === 1 ? ' traveller' : ' travellers') + '')); log.append(act); follow();
    }
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
