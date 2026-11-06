(() => {
  const $ = (s, r = document) => r.querySelector(s), $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const narrow = matchMedia('(max-width: 64rem)');
  const lite = matchMedia('(pointer: coarse)').matches || /[?&]lite/.test(location.search);

  // ---- nav ----
  const nav = $('#nav'), burger = $('#burger');
  const solid = () => nav.classList.toggle('solid', scrollY > 8 || nav.classList.contains('open'));
  addEventListener('scroll', solid, { passive: true }); solid();
  const closeNav = () => { nav.classList.remove('open'); burger.setAttribute('aria-expanded', 'false'); solid(); };
  burger.addEventListener('click', () => { const o = nav.classList.toggle('open'); burger.setAttribute('aria-expanded', String(o)); solid(); });
  $$('.sheet a').forEach((a) => a.addEventListener('click', closeNav));
  addEventListener('keydown', (e) => { if (e.key === 'Escape') closeNav(); });

  // ---- headline, word by word ----
  if (!reduce) $$('[data-split]').forEach((h) => {
    const words = h.textContent.split(' ');
    h.setAttribute('aria-label', h.textContent);
    h.replaceChildren(...words.flatMap((w, i) => {
      const o = document.createElement('span'), n = document.createElement('span');
      o.className = 'w'; o.setAttribute('aria-hidden', 'true'); n.textContent = w; n.style.animationDelay = `${0.12 + i * 0.07}s`; o.append(n);
      return i < words.length - 1 ? [o, ' '] : [o];
    }));
  });

  // ---- hero numbers count up ----
  if (!reduce) $$('[data-count]').forEach((d) => {
    const end = +d.dataset.count, unit = d.dataset.unit ?? 'M+', t0 = performance.now() + 500;
    const step = (t) => { const k = Math.min(1, Math.max(0, (t - t0) / 1400)), e = 1 - (1 - k) ** 3; d.textContent = `${Math.round(end * e)}${unit}`; if (k < 1) requestAnimationFrame(step); };
    d.textContent = `0${unit}`; requestAnimationFrame(step);
  });

  // ---- reveal on scroll ----
  const io = new IntersectionObserver((es) => es.forEach((e) => { if (e.isIntersecting) { e.target.classList.add('in'); io.unobserve(e.target); } }), { rootMargin: '0px 0px -12% 0px' });
  $$('.rv').forEach((el) => io.observe(el));
  const fb = $('.foot-big'); if (fb) new IntersectionObserver(([e]) => { if (e.isIntersecting) fb.classList.add('in'); }, { threshold: 0.1 }).observe(fb);

  // ---- the ad ----
  const DEFAULT = { name: 'Juniper Coffee', line: 'Small-batch beans roasted in Austin, at your door by Friday.', image: '', color: '#2f5d50', host: '', go: 'Shop the beans' };
  let AD = DEFAULT;
  const lum = (hex) => { const n = parseInt(hex.slice(1), 16), c = [n >> 16, (n >> 8) & 255, n & 255].map((v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; }); return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2]; };
  const PALETTE = ['#2f5d50', '#1f3a8a', '#7c2d12', '#6d28d9', '#0e7490', '#9f1239', '#3f6212', '#1e293b'];
  const colorFor = (s) => PALETTE[[...s].reduce((a, c) => (a * 31 + c.charCodeAt(0)) >>> 0, 7) % PALETTE.length];
  const el = (tag, cls, text) => { const e = document.createElement(tag); if (cls) e.className = cls; if (text !== undefined) e.textContent = text; return e; };
  function adEl(kind, ad = AD) {
    const a = el('a', `ad ad-${kind} swap`); a.href = ad.host ? `https://${ad.host}` : '#demo'; a.rel = 'noopener nofollow sponsored'; if (ad.host) a.target = '_blank';
    a.setAttribute('aria-label', `Sponsored: ${ad.name}`);
    const c = ad.color || colorFor(ad.name); a.style.setProperty('--c', c); a.style.setProperty('--ci', lum(c) > 0.45 ? '#0b0d12' : '#fbfbf8');
    const pic = el('span', 'pic');
    if (ad.image) pic.style.backgroundImage = `url("${ad.image.replace(/"/g, '%22')}")`; else pic.textContent = ad.name.trim()[0]?.toUpperCase() ?? '•';
    const tx = el('span', 'tx');
    tx.append(el('span', 'lab', 'Sponsored'), el('span', 'nm', ad.name), el('span', 'ln', ad.line || `Find out more at ${ad.host}`), el('span', 'go', ad.go || (ad.host ? `Visit ${ad.host}` : 'Learn more')));
    a.append(pic, tx);
    a.addEventListener('click', (e) => { if (!ad.host) e.preventDefault(); });
    return a;
  }
  function paint(ring) {
    $$('.ad-slot').forEach((s) => { s.replaceChildren(adEl(s.dataset.ad)); if (ring) { s.classList.remove('ring'); void s.offsetWidth; s.classList.add('ring'); } });
    const b = $('.l-ad .brand'); if (b) { b.firstChild.textContent = AD.name; b.querySelector('small').textContent = AD.line || AD.host; }
    const la = $('.l-ad'), c = AD.color || colorFor(AD.name); if (la) { la.style.setProperty('--ad', c); la.style.setProperty('--ad-ink', lum(c) > 0.45 ? '#0b0d12' : '#fbfbf8'); }
    $$('.va-ad').forEach((v) => v.style.setProperty('--ad', c));
    if (chatShown) chatSpon();
  }

  // ---- see my ad ----
  const maker = $('#maker'), site = $('#site'), note = $('#maker-note'), make = $('#make');
  const fromHost = (host) => {
    const base = host.replace(/^www\./, '').split('.')[0] || host;
    const name = base.split(/[-_]+/).filter(Boolean).map((w) => w[0].toUpperCase() + w.slice(1)).join(' ').slice(0, 40);
    return { name, line: '', image: '', color: '', host: host.replace(/^www\./, '') };
  };
  maker.addEventListener('submit', async (e) => {
    e.preventDefault();
    const raw = site.value.trim();
    if (!raw) { site.focus(); return; }
    let host;
    try { host = new URL(/^https?:\/\//i.test(raw) ? raw : `https://${raw}`).hostname; } catch { host = ''; }
    if (!host || !host.includes('.')) { note.textContent = 'Type a full web address, like yourbrand.com'; note.classList.add('err'); return; }
    note.classList.remove('err'); note.textContent = `Reading ${host}…`; make.disabled = true;
    let ad, msg = '';
    try {
      const r = await fetch(`/v1/preview?url=${encodeURIComponent(raw)}`, { signal: AbortSignal.timeout(9000) });
      const j = await r.json().catch(() => ({}));
      if (r.ok && j.ad) ad = j.ad; else msg = j.error || '';
    } catch { /* no server here, or it timed out */ }
    if (!ad) { ad = fromHost(host); note.textContent = msg ? `${msg}. Here is a simple version from the address.` : 'Here is a simple version, made from the address.'; }
    else note.textContent = `Made from ${ad.host}'s own page. Switch the tabs to see it everywhere.`;
    AD = { ...ad, go: '' }; make.disabled = false;
    paint(true);
  });

  // ---- stage tabs ----
  const CAPS = {
    newsletter: 'Your ad sits between two stories, with the Sponsored label every reader can see.',
    blog: 'A card inside the article and a banner beside it. The owner picks which spots to sell.',
    chat: 'One card in a public channel, or under an AI answer. Never in private chats.',
    game: 'A real board inside the game. The meter shows when a view counts: half on screen, big enough to read, for a second.',
  };
  const tabs = $$('#seg [role=tab]'), ind = $('.seg-ind'), cap = $('#stage-cap');
  const placeInd = () => { const t = tabs.find((x) => x.getAttribute('aria-selected') === 'true'); ind.style.width = `${t.offsetWidth}px`; ind.style.transform = `translateX(${t.offsetLeft}px)`; };
  let current = 'newsletter', touched = false;
  function show(name, focus) {
    current = name;
    tabs.forEach((t) => { const on = t.dataset.s === name; t.setAttribute('aria-selected', String(on)); t.tabIndex = on ? 0 : -1; if (on && focus) t.focus(); });
    $$('.scene').forEach((s) => { const on = s.id === `sc-${name}`; s.classList.toggle('on', on); s.hidden = !on; });
    cap.textContent = CAPS[name]; placeInd();
    if (name === 'chat') chatStart();
    if (name === 'game') gameStart(); else gamePause();
    sceneFx(name);
  }
  tabs.forEach((t, i) => {
    t.addEventListener('click', () => { touched = true; show(t.dataset.s); stopAuto(); });
    t.addEventListener('keydown', (e) => { const d = e.key === 'ArrowRight' ? 1 : e.key === 'ArrowLeft' ? -1 : 0; if (d) { e.preventDefault(); touched = true; show(tabs[(i + d + tabs.length) % tabs.length].dataset.s, true); stopAuto(); } });
  });
  addEventListener('resize', placeInd); document.fonts?.ready.then(placeInd); placeInd();
  // walk through the four scenes on its own until someone touches the tabs; a line under the tab shows the time left
  const DUR = { newsletter: 8000, blog: 8000, chat: 7000, game: 7600 };
  tabs.forEach((t) => t.append(el('i', 'tp')));
  let auto = null, inView = false;
  const runBar = () => tabs.forEach((t) => { t.classList.remove('run'); if (auto !== null && t.dataset.s === current) { void t.offsetWidth; t.style.setProperty('--dur', `${DUR[current]}ms`); t.classList.add('run'); } });
  const stopAuto = () => { clearTimeout(auto); auto = null; runBar(); };
  const queue = () => { clearTimeout(auto); if (reduce || touched || !inView) { auto = null; runBar(); return; } auto = setTimeout(() => { const n = tabs.findIndex((t) => t.dataset.s === current); show(tabs[(n + 1) % tabs.length].dataset.s); queue(); }, DUR[current]); runBar(); };
  const stageObs = new IntersectionObserver(([e]) => { inView = e.isIntersecting; if (inView && auto === null) queue(); if (!inView) stopAuto(); }, { threshold: 0.45 });
  stageObs.observe($('#stage'));
  [site, $('#stage')].forEach((x) => x.addEventListener('pointerdown', () => { touched = true; stopAuto(); }));
  site.addEventListener('focus', () => { touched = true; stopAuto(); });

  // ---- the stage comes alive: a pointer clicks the ad, and notes pop up beside it ----
  const stage = $('#stage');
  const svg = (d, w = 1.8) => `<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="${w}">${d}</svg>`;
  const ICON = {
    check: svg('<path d="m3.5 8.5 3 3 6-7"/>', 2.2),
    eye: svg('<path d="M1.5 8s2.5-4.5 6.5-4.5S14.5 8 14.5 8 12 12.5 8 12.5 1.5 8 1.5 8Z"/><circle cx="8" cy="8" r="2"/>'),
    lock: svg('<rect x="3" y="7" width="10" height="7" rx="1.5"/><path d="M5.5 7V5a2.5 2.5 0 0 1 5 0v2"/>'),
    tag: svg('<path d="M2 8.5V3h5.5L14 9.5 8.5 15z"/><circle cx="5" cy="6" r="1"/>'),
  };
  const NOTES = {
    newsletter: [['l1', 'tag', 'Labelled Sponsored, always'], ['r1', 'eye', 'View counted: half on screen, 1 second', 'green'], ['l2', 'lock', 'No cookies, no reader profiles'], ['r2', 'check', 'Click counted', 'green']],
    blog: [['l1', 'tag', 'You pick which spots to sell'], ['r1', 'eye', 'Two views counted', 'green'], ['l2', 'lock', 'Matched to the article, not the reader'], ['r2', 'check', 'Click counted', 'green']],
    chat: [['l1', 'lock', 'Public channels only, never private'], ['r1', 'tag', 'One card, clearly labelled'], ['r2', 'check', 'Click counted', 'green']],
    game: [['l1', 'tag', 'A real board on the track'], ['r1', 'eye', 'Counted when readable for a second', 'green'], ['l2', 'lock', 'Priced by the developer']],
  };
  const chipsBox = stage.appendChild(el('div', 'chips-fx'));
  chipsBox.setAttribute('aria-hidden', 'true');
  const cursor = stage.appendChild(el('span', 'cursor'));
  cursor.innerHTML = '<svg viewBox="0 0 20 20" width="22" height="22"><path d="M4 2.5v13l3.4-3.2 2.4 5.2 2.2-1-2.4-5.1h4.6z" fill="#0b0d12" stroke="#fff" stroke-width="1.2" stroke-linejoin="round"/></svg>';
  let fxTimers = [], cursorAnim = null;
  function sceneFx(name) {
    fxTimers.forEach(clearTimeout); fxTimers = []; cursorAnim?.cancel(); cursor.style.opacity = '0';
    chipsBox.replaceChildren();
    const notes = (NOTES[name] || []).map(([pos, icon, text, tone]) => { const c = el('span', `cfx ${pos}${tone ? ' ' + tone : ''}`); const i = el('span', 'ci'); i.innerHTML = ICON[icon]; c.append(i, el('span', '', text)); chipsBox.append(c); return [pos, c]; });
    if (reduce) { notes.forEach(([, c]) => c.classList.add('on')); return; }
    const later = (ms, f) => fxTimers.push(setTimeout(f, ms));
    notes.filter(([p]) => p !== 'r2').forEach(([, c], i) => later(700 + i * 900, () => c.classList.add('on')));
    const click = notes.find(([p]) => p === 'r2');
    if (!click) return;
    // the pointer drifts in and taps the ad
    later(name === 'chat' ? 4300 : 3600, () => {
      const ad = $(`#sc-${name} .ad`); if (!ad) return;
      const sr = stage.getBoundingClientRect(), ar = ad.getBoundingClientRect();
      if (ar.bottom > sr.bottom - 10 || ar.top < sr.top) return;
      const x = ar.left - sr.left + Math.min(ar.width * 0.7, ar.width - 30), y = ar.top - sr.top + ar.height * 0.6;
      cursor.style.opacity = '1';
      cursorAnim = cursor.animate([{ transform: `translate(${sr.width * 0.92}px, ${sr.height * 0.95}px)`, opacity: 0 }, { opacity: 1, offset: 0.2 }, { transform: `translate(${x}px, ${y}px)`, opacity: 1 }], { duration: 1300, easing: 'cubic-bezier(.4,0,.2,1)', fill: 'forwards' });
      cursorAnim.onfinish = () => {
        cursor.classList.remove('tap'); void cursor.offsetWidth; cursor.classList.add('tap');
        ad.classList.remove('press'); void ad.offsetWidth; ad.classList.add('press');
        click[1].classList.add('on');
        later(1400, () => { cursorAnim = cursor.animate([{ transform: `translate(${x}px, ${y}px)`, opacity: 1 }, { transform: `translate(${x}px, ${y}px)`, opacity: 0 }], { duration: 400, fill: 'forwards' }); });
      };
    });
  }

  // ---- chat ----
  const msgs = $('#msgs'), aiA = $('#ai-a');
  const PEOPLE = [['Maya', '#2a2f3a', 'Anyone doing anything Saturday morning?'], ['Theo', '#5b6170', 'Farmers market on Republic Square, then a long walk.'], ['Priya', '#8a909c', 'Looking for something new to try this weekend.']];
  let chatShown = false, chatTimer = [];
  const msgEl = ([n, c, t]) => { const m = el('div', 'msg'), av = el('span', 'av', n[0]); av.style.background = c; const b = el('div'); const h = el('div'); h.append(el('b', '', n), el('small', '', 'now')); b.append(h, el('p', '', t)); m.append(av, b); return m; };
  function chatSpon() {
    $('.msg.spon', msgs)?.remove();
    const m = el('div', 'msg spon'), av = el('span', 'av', '★'), b = el('div'), h = el('div');
    h.append(el('b', '', AD.name), el('small', '', 'Sponsored')); b.append(h, adEl('chat')); m.append(av, b); msgs.append(m);
    const s = $('.ai-spon', aiA); if (s) s.replaceChildren(adEl('chat'));
  }
  function chatStart() {
    chatTimer.forEach(clearTimeout); chatTimer = [];
    msgs.replaceChildren(); chatShown = false;
    const steps = [...PEOPLE.map((p) => () => msgs.append(msgEl(p))), () => { chatShown = true; chatSpon(); }];
    if (reduce) { steps.forEach((f) => f()); } else {
      let t = 200;
      steps.forEach((f, i) => {
        chatTimer.push(setTimeout(() => { const ty = el('div', 'msg'); ty.append(el('span'), el('span', 'typing')); ty.lastChild.append(el('i'), el('i'), el('i')); if (i < steps.length - 1) msgs.append(ty); chatTimer.push(setTimeout(() => { ty.remove(); f(); }, i < steps.length - 1 ? 650 : 0)); }, t));
        t += 1100;
      });
    }
    aiA.replaceChildren();
    const intro = el('p', '', 'Three easy ones, all before noon:'), ol = el('ol');
    ['The farmers market on Republic Square opens at nine.', 'Barton Springs is quiet before ten, and cold all year.', 'Walk the Lady Bird Lake trail from the Congress bridge.'].forEach((t) => ol.append(el('li', '', t)));
    const sp = el('div', 'ai-spon'); sp.append(adEl('chat'));
    aiA.append(intro, ol, sp);
  }
  $$('.chat-switch button').forEach((b) => b.addEventListener('click', () => {
    $$('.chat-switch button').forEach((x) => { const on = x === b; x.classList.toggle('on', on); x.setAttribute('aria-pressed', String(on)); });
    $$('.chat[data-view]').forEach((c) => { c.hidden = c.dataset.view !== b.dataset.chat; });
    stopAuto();
  }));

  // ---- game: our own race, Agent Grand Prix, with a board sold through Isoteh ----
  // the clip is 7 s: the board comes into view at 4 s, is readable from 5 s, and is passed at 6.4 s
  const BOARD = { inView: 4.0, readable: 5.0, counted: 6.0 };
  $$('video.race').forEach((v) => { v.muted = true; v.defaultMuted = true; });
  let gameOn = false, views = 0, lastT = 0, gameRaf = 0;
  const fill = $('#m-fill'), mtext = $('#m-text'), mviews = $('#m-views'), meter = $('#meter');
  const gv = $('.game video');
  function meterFrame() {
    gameRaf = gameOn ? requestAnimationFrame(meterFrame) : 0;
    const t = gv.currentTime;
    if (lastT < BOARD.counted && t >= BOARD.counted) { views++; mviews.textContent = views.toLocaleString('en-US'); }
    lastT = t;
    const k = t < BOARD.readable ? 0 : Math.min(1, (t - BOARD.readable) / (BOARD.counted - BOARD.readable));
    fill.style.width = `${Math.round(k * 100)}%`;
    meter.classList.toggle('count', t >= BOARD.counted);
    mtext.textContent = t >= BOARD.counted ? 'View counted' : t >= BOARD.readable ? `Counting ${(t - BOARD.readable).toFixed(1)}s` : t >= BOARD.inView ? 'Too small to read yet' : 'Board coming up';
  }
  function gameStart() {
    gameOn = true;
    if (reduce) { mtext.textContent = 'Board on the main straight'; return; }
    gv.preload = 'auto';
    try { gv.currentTime = 0; } catch {}
    lastT = 0;
    gv.play().catch(() => {});
    if (!gameRaf) gameRaf = requestAnimationFrame(meterFrame);
  }
  function gamePause() { gameOn = false; gv.pause(); }
  // the big screen in the games section plays while it is on screen
  const tv = $('.tv video'), tvCount = $('#tv-count');
  if (tv) {
    new IntersectionObserver(([e]) => { if (reduce) return; if (e.isIntersecting) { tv.preload = 'auto'; tv.play().catch(() => {}); } else tv.pause(); }, { threshold: 0.35 }).observe(tv);
    tv.addEventListener('timeupdate', () => tvCount.classList.toggle('on', tv.currentTime >= BOARD.counted - 0.1));
  }

  // ---- how it works: the cutaway follows the steps ----
  const cut = $('.pin-art .cut'), steps = $$('.steps li'), pin = $('.pin');
  const setStep = (li) => {
    steps.forEach((s) => s.classList.toggle('on', s === li));
    cut.classList.add('open', 'focus');
    $$('.layer', cut).forEach((l) => { l.classList.toggle('on', l.dataset.i === li.dataset.layer); l.classList.toggle('above', +l.dataset.i > +li.dataset.layer); });
  };
  let lastStep = -1;
  const onScroll = () => {
    if (!narrow.matches) return;
    const r = pin.getBoundingClientRect(), span = r.height - innerHeight;
    const k = Math.floor(Math.min(0.999, Math.max(0, -r.top / span)) * steps.length);
    if (k !== lastStep) { lastStep = k; setStep(steps[k]); }
  };
  addEventListener('scroll', onScroll, { passive: true }); onScroll();
  const so = new IntersectionObserver((es) => es.forEach((e) => { if (e.isIntersecting && !narrow.matches) setStep(e.target.closest('li')); }), { rootMargin: '-45% 0px -45% 0px' });
  steps.forEach((s) => so.observe(s.querySelector('h3')));
  new IntersectionObserver((es) => es.forEach((e) => { if (e.isIntersecting) cut.classList.add('open'); }), { threshold: 0.2 }).observe(cut);

  // ---- why: the swipe rail ----
  const rail = $('#rail'), prev = $('#prev'), next = $('#next');
  const stepW = () => (rail.querySelector('.tile')?.offsetWidth ?? 300) + 16;
  prev.addEventListener('click', () => rail.scrollBy({ left: -stepW(), behavior: reduce ? 'auto' : 'smooth' }));
  next.addEventListener('click', () => rail.scrollBy({ left: stepW(), behavior: reduce ? 'auto' : 'smooth' }));
  const arrows = () => { prev.disabled = rail.scrollLeft < 8; next.disabled = rail.scrollLeft > rail.scrollWidth - rail.clientWidth - 8; };
  rail.addEventListener('scroll', arrows, { passive: true }); arrows();
  const to = new IntersectionObserver((es) => es.forEach((e) => e.target.classList.toggle('on', e.intersectionRatio > 0.6)), { root: null, threshold: [0, 0.6, 1] });
  $$('.tile').forEach((t) => to.observe(t));
  let ticks = 12406; const tick = $('[data-tick]');
  if (!reduce) setInterval(() => { ticks += 1 + Math.floor(Math.random() * 4); tick.textContent = ticks.toLocaleString('en-US'); }, 1300);

  // ---- hero: cards float with the scroll; on smaller screens they ride a belt under the numbers ----
  const fls = $$('.floaters .fl');
  if (!reduce && fls.length) {
    const speed = [0.18, -0.12, 0.26, 0.1, -0.2, 0.14, -0.08];
    let ticking = false;
    const par = () => { ticking = false; const y = scrollY; if (y > innerHeight * 1.5) return; fls.forEach((f, i) => f.style.setProperty('--py', (y * speed[i % speed.length]).toFixed(1))); };
    addEventListener('scroll', () => { if (!ticking) { ticking = true; requestAnimationFrame(par); } }, { passive: true });
  }
  const track = $('.fl-track');
  if (track) { const minis = $$('.floaters .mini').map((m) => m.cloneNode(true)); track.append(...minis, ...minis.map((m) => m.cloneNode(true))); }

  // ---- the strip: a belt that never ends ----
  const marq = $('.strip .marq');
  if (marq) marq.append(...[...marq.children].map((li) => { const c = li.cloneNode(true); c.setAttribute('aria-hidden', 'true'); return c; }));

  // ---- how: a line beside the steps fills as you scroll ----
  const stepsEl = $('.steps');
  const stepLine = () => { const r = pin.getBoundingClientRect(), span = r.height - innerHeight * 0.4; stepsEl.style.setProperty('--p', Math.min(1, Math.max(0, (innerHeight * 0.5 - r.top) / span)).toFixed(3)); };
  addEventListener('scroll', stepLine, { passive: true }); stepLine();

  // ---- why: the panels play while the rail is on screen ----
  new IntersectionObserver(([e]) => rail.classList.toggle('play', e.isIntersecting && !reduce), { threshold: 0.2 }).observe(rail);
  let clicks = 318; const tick2 = $('[data-tick2]');
  if (!reduce) setInterval(() => { if (Math.random() < 0.45) { clicks += 1; tick2.textContent = clicks.toLocaleString('en-US'); } }, 1300);
  const small = $('[data-small]');
  if (small && !reduce) {
    let t0 = 0;
    const run = (t) => { if (!rail.classList.contains('play')) { t0 = 0; return requestAnimationFrame(run); } t0 ||= t; const k = ((t - t0) % 4000) / 4000, e = Math.min(1, k / 0.45); small.textContent = Math.round(300 * (1 - (1 - e) ** 3)); requestAnimationFrame(run); };
    requestAnimationFrame(run);
  }

  // ---- questions open and close smoothly ----
  $$('.qs details').forEach((d) => {
    const sum = $('summary', d), ans = $('.ans', d);
    sum.addEventListener('click', (e) => {
      if (reduce) return;
      e.preventDefault();
      if (d.open) { const h = ans.offsetHeight; ans.animate([{ height: `${h}px`, opacity: 1 }, { height: '0px', opacity: 0 }], { duration: 320, easing: 'cubic-bezier(.4,0,.2,1)' }).onfinish = () => { d.open = false; }; }
      else { d.open = true; const h = ans.offsetHeight; ans.animate([{ height: '0px', opacity: 0 }, { height: `${h}px`, opacity: 1 }], { duration: 380, easing: 'cubic-bezier(.2,.7,.1,1)' }); }
    });
  });

  // ---- calculator ----
  const pin2 = $('#price-in');
  const usd = (c) => '$' + (c / 100).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const calc = () => {
    const pay = Math.round(Math.max(0, parseFloat(String(pin2.value).replace(/[^0-9.]/g, '')) || 0) * 100), fee = Math.round(pay * 0.15);
    for (const [id, c] of [['o-pay', pay], ['o-fee', fee], ['o-keep', pay - fee]]) { const d = document.getElementById(id); d.textContent = usd(c); d.classList.remove('bump'); void d.offsetWidth; d.classList.add('bump'); }
  };
  pin2.addEventListener('input', calc);
  $$('.chips button').forEach((b) => b.addEventListener('click', () => { pin2.value = b.textContent; calc(); }));

  paint(false);
  show('newsletter');
})();
