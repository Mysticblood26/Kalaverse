/* KalaVerse site: routing, home, Explore India and KalaTour. */
(function () {
  const $ = (id) => document.getElementById(id);
  const el = (tag, txt, cls) => { const e = document.createElement(tag); if (txt != null) e.textContent = txt; if (cls) e.className = cls; return e; };
  const list = (tag, arr, cls) => { const e = el(tag, null, cls); arr.forEach((x) => e.append(el('li', x))); return e; };
  const T = (k) => window.I18n.t(k);
  const hiOn = () => window.I18n.lang === 'hi';
  let HI = {};
  const loc = (s) => (hiOn() && HI[s.id]) ? Object.assign({}, s, HI[s.id]) : s;
  const zn = (z) => { const k = 'zone.' + z.replace(/\W/g, ''); const v = T(k); return v === k ? z : v; };
  window.KVloc = loc; window.KVzone = zn;
  const strip = (s) => s.normalize('NFKD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
  // "Madhubani / Mithila Painting" -> "Madhubani". Used for the "Ask KalaSathi" button.
  const shortName = (s) => s.artForm.split(/ & | \/ | \(/)[0];

  const VIEWS = ['home', 'explore', 'map', 'kalasathi', 'lens', 'tours', 'community'];
  const TITLES = { home: '', explore: 'Explore India | ', kalasathi: 'KalaSathi | ', tours: 'KalaTour | ', map: 'Cultural map | ', lens: 'KalaLens | ', community: 'Community | ' };
  let openArt = null, pendingArt = null;
  function route() {
    const parts = location.hash.slice(1).split('/'); let v = parts[0]; if (!VIEWS.includes(v)) v = 'home';
    VIEWS.forEach((n) => $('v-' + n).classList.toggle('on', n === v));
    document.querySelectorAll('nav a').forEach((a) => { const on = a.dataset.v === v; a.classList.toggle('on', on); if (on) a.setAttribute('aria-current', 'page'); else a.removeAttribute('aria-current'); });
    document.title = TITLES[v] + 'KalaVerse';
    document.body.classList.toggle('chatmode', v === 'kalasathi');
    document.dispatchEvent(new CustomEvent('kv-view', { detail: v }));
    if (v === 'explore' && parts[1]) { pendingArt = parts[1]; if (openArt) openArt(parts[1]); }
    if (!(v === 'explore' && parts[1])) window.scrollTo(0, 0);
  }
  // Header height (+ zigzag trim) so the chat can fill exactly the rest of the screen.
  const measure = () => { const h = document.querySelector('header'); if (h) document.documentElement.style.setProperty('--hh', (h.offsetHeight + 12) + 'px'); };
  addEventListener('resize', measure); addEventListener('load', measure); document.addEventListener('kv-lang', () => setTimeout(measure, 0));
  addEventListener('hashchange', route); route(); measure();

  function home(states) {
    const box = $('feat'); if (!box) return;
    ['bihar', 'maharashtra', 'odisha'].forEach((id) => {
      const s = states.find((x) => x.id === id); if (!s) return;
      const a = el('a'); a.href = '#explore/' + s.id;
      a.append(el('h3', shortName(s)), el('p', s.name + ', ' + s.zone, 'where'), el('p', KalaCore.first(s.history, 1)));
      box.append(a);
    });
  }

  function explore(states) {
    const zones = [...new Set(states.map((s) => s.zone))];
    zones.forEach((z) => { const o = el('option', zn(z)); o.value = z; o.dataset.z = z; $('zone').append(o); });
    let cur = states[0].id;
    const visible = () => { const f = strip($('q').value.trim()), z = $('zone').value; return states.filter((s) => (!z || s.zone === z) && (!f || strip(s.name + ' ' + s.artForm).includes(f))); };
    const renderItems = () => {
      const box = $('items'), rows = visible(); box.replaceChildren();
      $('count').textContent = rows.length === states.length ? states.length + T('ex.count') : rows.length + T('ex.of') + states.length + T('ex.shown');
      if (!rows.length) box.append(el('p', T('ex.empty'), 'empty'));
      rows.forEach((s) => {
        const b = el('button', s.artForm, 'item' + (s.id === cur ? ' on' : '')); b.type = 'button'; b.append(el('small', s.name));
        if (s.id === cur) b.setAttribute('aria-current', 'true');
        b.onclick = () => { select(s.id); }; box.append(b);
      });
    };
    const renderDetail = () => {
      const s = loc(states.find((x) => x.id === cur)), t = s.tutorial, d = $('detail');
      const ask = el('button', T('ex.ask') + shortName(s), 'btn alt'); ask.type = 'button';
      ask.onclick = () => window.askKalaSathi && window.askKalaSathi('Tell me about ' + shortName(s));
      const askrow = el('div', null, 'askrow'); askrow.append(ask);
      d.replaceChildren(el('h2', s.artForm), el('p', T('ex.state') + ': ' + s.name + '. ' + T('ex.capital') + ': ' + s.capital + '. ' + T('ex.region') + ': ' + zn(s.zone) + '.', 'mute'), askrow,
        el('h3', T('ex.history')), el('p', s.history), el('h3', T('ex.sig')), el('p', s.significance),
        el('h3', T('ex.good')), list('ul', s.facts, 'facts'),
        el('h3', T('ex.mat')), list('ul', s.materials, 'facts'),
        el('h3', T('ex.motifs')), list('ul', s.motifs, 'facts'),
        el('h3', T('ex.other') + s.name), list('ul', s.otherCrafts, 'tags'),
        el('h3', T('ex.try') + t.title), el('p', t.difficulty + ', ' + ((hiOn() && HI[s.id]) ? T('ex.about') : 'about') + ' ' + t.time + '.', 'mute'),
        el('h3', T('ex.need')), list('ul', t.materials, 'facts'));
      t.steps.forEach((st, i) => { const p = el('p', null, 'step'); p.append(el('b', (i + 1) + '. ' + st.title), document.createTextNode(st.text)); d.append(p); });
    };
    function select(id, fromRoute) {
      if (!states.some((s) => s.id === id)) return;
      cur = id; const s = states.find((x) => x.id === id);
      if ($('zone').value && $('zone').value !== s.zone) $('zone').value = '';
      if (!visible().some((x) => x.id === id)) $('q').value = '';
      renderItems(); renderDetail();
      if (!fromRoute && history.replaceState) history.replaceState(null, '', '#explore/' + id);
      if (window.matchMedia('(max-width:760px)').matches) $('detail').scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
    openArt = (id) => select(id, true);
    $('q').addEventListener('input', renderItems); $('zone').addEventListener('change', renderItems);
    document.addEventListener('kv-lang', () => { [...$('zone').options].forEach((o) => { if (o.dataset.z) o.textContent = zn(o.dataset.z); }); renderItems(); renderDetail(); });
    renderItems(); renderDetail();
    if (pendingArt) openArt(pendingArt);
  }

  function tours(list_) {
    const box = $('tl'), bar = el('div', null, 'chips'), states = [...new Set(list_.map((t) => t.state))]; let cur = '';
    const draw = () => {
      bar.querySelectorAll('.chip').forEach((b) => b.classList.toggle('on', b.dataset.s === cur)); box.replaceChildren();
      list_.filter((t) => !cur || t.state === cur).forEach((t) => {
        const c = el('div', null, 'card');
        c.append(el('h3', t.title), el('p', t.state + '. ' + t.duration + '. ' + t.theme + '.', 'mute where'), list('ul', t.highlights));
        if (t.tips && t.tips.length) c.append(el('h4', T('tips')), list('ul', t.tips));
        const row = el('div', null, 'askrow'), plan = el('button', 'Use in planner', 'btn'), ask = el('button', 'Ask KalaYatri', 'btn alt');
        plan.type = ask.type = 'button';
        plan.onclick = () => document.dispatchEvent(new CustomEvent('kv-plan', { detail: t.state }));
        ask.onclick = () => window.openYatri && window.openYatri('Plan a one day art trip in ' + t.state + ' based on: ' + t.title);
        row.append(plan, ask); c.append(row); box.append(c);
      });
    };
    [['', 'All trails'], ...states.map((x) => [x, x])].forEach(([v, l]) => { const b = el('button', l, 'chip'); b.type = 'button'; b.dataset.s = v; b.onclick = () => { cur = v; draw(); }; bar.append(b); });
    box.before(bar); draw();
  }

  const boot = () => Promise.all([fetch('data/heritage.json').then((r) => { if (!r.ok) throw new Error(r.status); return r.json(); }), fetch('data/heritage.hi.json').then((r) => (r.ok ? r.json() : {})).catch(() => ({}))]).then(([data, hi]) => {
    HI = hi || {}; home(data.states); explore(data.states); tours(data.tours); window.initChat(data.states); if (window.initFeatures) window.initFeatures(data);
  }).catch(() => {
    const m = 'The heritage data could not be loaded. Run the site with npm start.';
    $('detail').textContent = m; $('tl').textContent = m;
  });
  // Wait until every script (features.js loads after this one) has run, otherwise the instant file:// fallback beats it.
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot); else boot();
})();
