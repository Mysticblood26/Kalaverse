/* KalaSathi chat client: streams answers from /api/chat, falls back to offline heritage notes. */
(function () {
  const $ = (id) => document.getElementById(id);
  const el = (tag, txt, cls) => { const e = document.createElement(tag); if (txt != null) e.textContent = txt; if (cls) e.className = cls; return e; };
  const T = (k) => window.I18n.t(k);
  const QUICK = () => [1, 2, 3, 4].map((i) => T('chat.q' + i));
  const NEXT = () => [1, 2, 3, 4].map((i) => [T('chat.n' + i), T('chat.nq' + i)]);

  window.initChat = function (states) {
    const log = $('log'), input = $('msg'), send = $('send'), status = $('status');
    let history = [], busy = false, prior = null, ctl = null, hint = null;

    const scroll = () => { log.scrollTop = log.scrollHeight; };
    // Builds DOM from parsed blocks only. Model output is never inserted as HTML.
    function fill(target, text, caret) {
      target.replaceChildren();
      const bl = KalaCore.blocks(text); let last = target;
      bl.forEach((b) => {
        if (b.type === 'p') { const p = el('p'); fillInline(p, b.items[0]); target.append(p); last = p; }
        else { const l = el(b.type); b.items.forEach((it) => { const li = el('li'); fillInline(li, it); l.append(li); last = li; }); target.append(l); }
      });
      if (caret) last.append(caret);
    }
    function fillInline(node, runs) { runs.forEach((r) => node.append(r.b ? el('strong', r.t) : document.createTextNode(r.t))); }
    function add(role, text) {
      const me = role === 'me', m = el('div', null, 'msg ' + (me ? 'me' : 'ai'));
      m.append(el('b', me ? T('chat.you') : T('chat.name')));
      const t = el('div', me ? text : null, me ? 't' : 't rich'); m.append(t); log.append(m); scroll(); return t;
    }
    function clearHint() { if (hint) { hint.remove(); hint = null; } }
    function showHint() {
      clearHint(); hint = el('div', null, 'next'); hint.setAttribute('aria-label', 'Follow-up questions');
      NEXT().forEach(([label, q]) => { const b = el('button', label, 'chip'); b.type = 'button'; b.onclick = () => ask(q); hint.append(b); });
      log.append(hint); scroll();
    }
    function setBusy(v) { busy = v; send.disabled = v; if (!v) input.focus({ preventScroll: true }); }
    const caret = () => { const c = el('span', null, 'cur'); c.setAttribute('aria-label', T('chat.typing')); return c; };
    // Follow-up buttons only appear after a real art answer.
    function finish(q, text) {
      const r = KalaCore.classify(q, prior); if (r.id) prior = r.id;
      history.push({ role: 'assistant', content: text }); setBusy(false);
      if ((r.intent === 'art' || r.intent === 'followup') && r.id) showHint();
    }

    let mode = 'offline';   // 'ai' | 'offline' | 'nofetch'
    const showStatus = () => { status.textContent = (mode === 'ai' ? '' : T(mode === 'nofetch' ? 'chat.nofetch' : 'chat.off')); };
    fetch('/api/status').then((r) => r.json()).then((st) => { mode = st.configured ? 'ai' : 'offline'; showStatus(); }).catch(() => { mode = 'nofetch'; showStatus(); });

    // Greeting and quick questions. Quick questions only show until the person asks something.
    let greeted = true;
    function greet() { log.replaceChildren(); add('ai', '').textContent = T('chat.hello'); greeted = true; drawChips(); }
    function drawChips() {
      const box = $('chips'); box.replaceChildren(); box.hidden = !greeted;
      QUICK().forEach((q) => { const b = el('button', q, 'chip'); b.type = 'button'; b.onclick = () => ask(q); box.append(b); });
    }
    greet();

    // Simulated typing for offline answers, so both modes feel the same.
    function localStream(target, text, done) {
      const words = text.split(/(\s+)/); let i = 0, shown = ''; const c = caret();
      (function tick() {
        if (i >= words.length) { fill(target, text); return done(); }
        const n = Math.min(words.length - i, 3); shown += words.slice(i, i + n).join(''); i += n; fill(target, shown, c); scroll(); setTimeout(tick, 40);
      })();
    }
    function offline(q, target) {
      const r = KalaCore.reply(q, prior, states); if (r.id) prior = r.id;
      localStream(target, r.text, () => { history.push({ role: 'assistant', content: r.text }); setBusy(false); if ((r.intent === 'art' || r.intent === 'followup') && r.id) showHint(); });
    }

    async function ask(q) {
      q = String(q).trim(); if (!q || busy) return;
      if (location.hash.slice(1) !== 'kalasathi') location.hash = 'kalasathi';
      clearHint(); setBusy(true); greeted = false; $('chips').hidden = true; add('me', q); input.value = '';
      const sent = history.slice(-8); history.push({ role: 'user', content: q });
      const target = add('ai', ''); const c = caret(); target.append(c);
      ctl = new AbortController();
      let text = '', pending = false, failure = null;
      const render = () => { pending = false; fill(target, text, c); scroll(); };
      try {
        const res = await fetch('/api/chat', { method: 'POST', headers: { 'Content-Type': 'application/json' }, signal: ctl.signal, body: JSON.stringify({ message: q, history: sent, lang: window.I18n.apiLang() }) });
        if (!res.ok || !res.body) throw new Error(res.status === 429 ? 'rate' : 'http');
        const reader = res.body.getReader(), dec = new TextDecoder(); let buf = '';
        for (;;) {
          const { done, value } = await reader.read(); if (done) break;
          buf += dec.decode(value, { stream: true });
          const evs = buf.split('\n\n'); buf = evs.pop() || '';
          for (const ev of evs) {
            const line = ev.trim(); if (!line.startsWith('data:')) continue;
            const d = JSON.parse(line.slice(5));
            if (d.type === 'chunk') { text += d.text; if (!pending) { pending = true; requestAnimationFrame(render); } }
            else if (d.type === 'error') failure = d;
          }
        }
        if (failure && !text) throw new Error(failure.code || 'upstream');
        if (!text) throw new Error('empty');
        fill(target, text);
        if (failure && text) { target.append(el('p', '(The response was interrupted. Please ask again to continue.)')); }
        finish(q, text);
      } catch (e) {
        if (e.name === 'AbortError') return;
        if (e.message === 'rate') { target.parentElement.classList.add('err'); target.textContent = T('chat.rate'); history.pop(); return setBusy(false); }
        // No key, server down or AI busy: answer from the offline heritage notes instead.
        target.textContent = ''; offline(q, target);
        if (e.message !== 'no_key') status.textContent = T('chat.fallback') + (failure && failure.detail ? ' Reason: ' + String(failure.detail).slice(0, 200) : '');
      }
    }

    $('form').addEventListener('submit', (e) => { e.preventDefault(); ask(input.value); });
    $('clear').addEventListener('click', () => {
      if (ctl) ctl.abort(); history = []; prior = null; hint = null; setBusy(false); input.value = ''; greet(); showStatus();
    });
    // Language change: refresh the greeting (only if the chat has not started), chips and status.
    document.addEventListener('kv-lang', () => { if (greeted) greet(); else drawChips(); showStatus(); });
    // Ready to type as soon as KalaSathi opens (not on touch screens, where focus would pop the keyboard up).
    const fine = window.matchMedia && matchMedia('(pointer:fine)').matches;
    document.addEventListener('kv-view', (e) => { if (e.detail === 'kalasathi') { scroll(); if (fine) input.focus({ preventScroll: true }); } });
    if (location.hash.slice(1) === 'kalasathi' && fine) input.focus({ preventScroll: true });
    window.askKalaSathi = ask;
  };
})();
