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

  // ---- reveal on scroll ----
  const io = new IntersectionObserver((es) => es.forEach((e) => { if (e.isIntersecting) { e.target.classList.add('in'); io.unobserve(e.target); } }), { rootMargin: '0px 0px -12% 0px' });
  $$('.rv, .games-art').forEach((el) => io.observe(el));

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
    game?.board(AD);
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
    if (name === 'game') gameStart(); else game?.pause();
  }
  tabs.forEach((t, i) => {
    t.addEventListener('click', () => { touched = true; show(t.dataset.s); stopAuto(); });
    t.addEventListener('keydown', (e) => { const d = e.key === 'ArrowRight' ? 1 : e.key === 'ArrowLeft' ? -1 : 0; if (d) { e.preventDefault(); touched = true; show(tabs[(i + d + tabs.length) % tabs.length].dataset.s, true); stopAuto(); } });
  });
  addEventListener('resize', placeInd); document.fonts?.ready.then(placeInd); placeInd();
  // walk through the four scenes on its own until someone touches the tabs
  let auto = null;
  const stopAuto = () => { clearInterval(auto); auto = null; };
  const stageObs = new IntersectionObserver(([e]) => {
    if (reduce) return;
    if (e.isIntersecting && auto === null && !touched) auto = setInterval(() => { const n = tabs.findIndex((t) => t.dataset.s === current); show(tabs[(n + 1) % tabs.length].dataset.s); }, current === 'game' ? 9000 : 6500);
    if (!e.isIntersecting) stopAuto();
  }, { threshold: 0.5 });
  stageObs.observe($('#stage'));
  [site, $('#stage')].forEach((x) => x.addEventListener('pointerdown', () => { touched = true; stopAuto(); }));
  site.addEventListener('focus', () => { touched = true; stopAuto(); });

  // ---- chat ----
  const msgs = $('#msgs'), aiA = $('#ai-a');
  const PEOPLE = [['Maya', '#7c3aed', 'Anyone doing anything Saturday morning?'], ['Theo', '#0e7490', 'Farmers market on Republic Square, then a long walk.'], ['Priya', '#be123c', 'Looking for something new to try this weekend.']];
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

  // ---- game: a small street race with a real board ----
  let game = null, gameLoading = false;
  const threeUrl = () => { const s = document.getElementById('three-src'); return s ? URL.createObjectURL(new Blob([s.textContent], { type: 'text/javascript' })) : '/a/three.module.min.js'; };
  async function gameStart() {
    if (game) return game.play();
    if (gameLoading) return;
    const box = $('.game');
    const gl = (() => { try { return !!document.createElement('canvas').getContext('webgl2'); } catch { return false; } })();
    if (reduce || !gl) { box.classList.add('static'); return; }
    gameLoading = true;
    try { const THREE = await import(threeUrl()); game = makeGame(THREE, box); game.board(AD); if (current === 'game') game.play(); }
    catch (err) { console.warn('game preview', err); box.classList.add('static'); }
    gameLoading = false;
  }

  function makeGame(THREE, box) {
    const canvas = $('#game', box), fill = $('#m-fill'), mtext = $('#m-text'), mviews = $('#m-views'), meter = $('#meter');
    const renderer = new THREE.WebGLRenderer({ canvas, antialias: !lite, powerPreference: 'low-power' });
    renderer.setPixelRatio(Math.min(devicePixelRatio, lite ? 1.5 : 2));
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    const scene = new THREE.Scene(), sky = new THREE.Color('#c9d6ea');
    scene.background = sky; scene.fog = new THREE.Fog(sky, 60, 190);
    const camera = new THREE.PerspectiveCamera(58, 1, 0.1, 400);
    scene.add(new THREE.HemisphereLight(0xffffff, 0x7d8f6a, 1.6));
    const sun = new THREE.DirectionalLight(0xfff4e0, 1.6); sun.position.set(-40, 60, 20); scene.add(sun);
    const mat = (c) => new THREE.MeshLambertMaterial({ color: c });
    const R = 46, W = 10;   // track radius and width
    const ground = new THREE.Mesh(new THREE.CircleGeometry(220, 64), mat('#a7b88f')); ground.rotation.x = -Math.PI / 2; scene.add(ground);
    const road = new THREE.Mesh(new THREE.RingGeometry(R - W / 2, R + W / 2, 160, 1), mat('#454b57')); road.rotation.x = -Math.PI / 2; road.position.y = 0.02; scene.add(road);
    const dummy = new THREE.Object3D();
    const ring = (n, r, geo, colorAt, y = 0) => {
      const m = new THREE.InstancedMesh(geo, new THREE.MeshLambertMaterial(), n);
      for (let i = 0; i < n; i++) { const a = (i / n) * Math.PI * 2; dummy.position.set(Math.cos(a) * r, y, Math.sin(a) * r); dummy.rotation.set(0, -a, 0); dummy.updateMatrix(); m.setMatrixAt(i, dummy.matrix); m.setColorAt(i, new THREE.Color(colorAt(i))); }
      scene.add(m); return m;
    };
    ring(90, R, new THREE.BoxGeometry(0.25, 0.04, 1.6), (i) => (i % 2 ? '#454b57' : '#f4f1e8'), 0.04);
    ring(120, R - W / 2 - 0.4, new THREE.BoxGeometry(0.8, 0.12, 2.4), (i) => (i % 2 ? '#e8e4da' : '#c8323c'), 0.06);
    ring(120, R + W / 2 + 0.4, new THREE.BoxGeometry(0.8, 0.12, 2.4), (i) => (i % 2 ? '#e8e4da' : '#c8323c'), 0.06);
    // town outside the track, trees inside
    const rnd = (() => { let s = 7; return () => (s = (s * 16807) % 2147483647) / 2147483647; })();
    const bGeo = new THREE.BoxGeometry(1, 1, 1); bGeo.translate(0, 0.5, 0);
    const blocks = new THREE.InstancedMesh(bGeo, new THREE.MeshLambertMaterial(), 70), tones = ['#e9e3d6', '#d9dde6', '#f1ece2', '#c9d2dd', '#e6d6c3', '#dfe5ea'];
    for (let i = 0; i < 70; i++) { const a = rnd() * Math.PI * 2, r = R + 24 + rnd() * 50; dummy.position.set(Math.cos(a) * r, 0, Math.sin(a) * r); dummy.rotation.set(0, rnd() * Math.PI, 0); dummy.scale.set(6 + rnd() * 8, 4 + rnd() * 14, 6 + rnd() * 8); dummy.updateMatrix(); blocks.setMatrixAt(i, dummy.matrix); blocks.setColorAt(i, new THREE.Color(tones[i % tones.length])); }
    dummy.scale.set(1, 1, 1); scene.add(blocks);
    const cone = new THREE.ConeGeometry(1.6, 4.5, 7); cone.translate(0, 3.6, 0);
    const trees = new THREE.InstancedMesh(cone, mat('#4f7a52'), 60);
    for (let i = 0; i < 60; i++) { const a = rnd() * Math.PI * 2, r = 8 + rnd() * (R - W / 2 - 12); dummy.position.set(Math.cos(a) * r, 0, Math.sin(a) * r); const s = 0.7 + rnd() * 0.7; dummy.scale.set(s, s, s); dummy.rotation.set(0, 0, 0); dummy.updateMatrix(); trees.setMatrixAt(i, dummy.matrix); }
    dummy.scale.set(1, 1, 1); scene.add(trees);
    // the billboard, just outside the track, turned toward oncoming cars
    const BW = 12, BH = 6, ba = Math.PI * 0.18, br = R + W / 2 + 7;
    const board = new THREE.Group(); board.position.set(Math.cos(ba) * br, 0, Math.sin(ba) * br);
    const tex = document.createElement('canvas'); tex.width = 1024; tex.height = 512;
    const texture = new THREE.CanvasTexture(tex); texture.colorSpace = THREE.SRGBColorSpace; texture.anisotropy = 4;
    const face = new THREE.Mesh(new THREE.PlaneGeometry(BW, BH), new THREE.MeshBasicMaterial({ map: texture, toneMapped: false })); face.position.y = 5 + BH / 2;
    const rim = new THREE.Mesh(new THREE.BoxGeometry(BW + 0.6, BH + 0.6, 0.4), mat('#1d222d')); rim.position.set(0, face.position.y, -0.22);
    [-BW / 3, BW / 3].forEach((x) => { const p = new THREE.Mesh(new THREE.BoxGeometry(0.5, 5.2, 0.5), mat('#2a303d')); p.position.set(x, 2.6, -0.3); board.add(p); });
    board.add(rim, face); scene.add(board);
    const aim = ba - 0.42; board.lookAt(Math.cos(aim) * R, 0, Math.sin(aim) * R);
    // cars
    const car = (body) => {
      const g = new THREE.Group();
      const b = new THREE.Mesh(new THREE.BoxGeometry(2, 0.7, 4.2), mat(body)); b.position.y = 0.65;
      const c = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.55, 1.9), mat('#1b2029')); c.position.set(0, 1.25, -0.2);
      const wg = new THREE.CylinderGeometry(0.42, 0.42, 0.36, 12); wg.rotateZ(Math.PI / 2);
      [[-1, 1.4], [1, 1.4], [-1, -1.4], [1, -1.4]].forEach(([x, z]) => { const w = new THREE.Mesh(wg, mat('#111318')); w.position.set(x, 0.42, z); g.add(w); });
      g.add(b, c); scene.add(g); return g;
    };
    const me = car('#f4f1e8'), rivals = [{ g: car('#3a5bff'), a: 0.35, r: R - 2.2, v: 0.165 }, { g: car('#c8323c'), a: -0.5, r: R + 2.2, v: 0.15 }];
    const place = (g, a, r) => { g.position.set(Math.cos(a) * r, 0, Math.sin(a) * r); g.rotation.y = -a; };

    // the board's ad
    function drawBoard(ad) {
      const x = tex.getContext('2d'), w = tex.width, h = tex.height, c = ad.color || colorFor(ad.name), split = Math.round(w * 0.4);
      x.fillStyle = '#fefefe'; x.fillRect(0, 0, w, h);
      x.fillStyle = c; x.fillRect(0, 0, split, h);
      x.fillStyle = lum(c) > 0.45 ? '#0b0d12' : '#fbfbf8'; x.font = '600 220px Geist, system-ui, sans-serif'; x.textAlign = 'center'; x.textBaseline = 'middle';
      x.fillText(ad.name.trim()[0]?.toUpperCase() ?? '•', split / 2, h / 2 + 10);
      x.textAlign = 'left'; x.textBaseline = 'alphabetic';
      x.fillStyle = '#7a8090'; x.font = '500 30px Geist, system-ui, sans-serif'; x.fillText('Sponsored', split + 48, 84);
      x.fillStyle = '#0b0d12'; let size = 84; x.font = `600 ${size}px Geist, system-ui, sans-serif`;
      while (x.measureText(ad.name).width > w - split - 96 && size > 40) { size -= 4; x.font = `600 ${size}px Geist, system-ui, sans-serif`; }
      x.fillText(ad.name, split + 48, 84 + size + 20);
      x.fillStyle = '#454b58'; x.font = '400 36px Geist, system-ui, sans-serif';
      const words = (ad.line || `Find out more at ${ad.host}`).split(' '); let line = '', y = 84 + size + 92, n = 0;
      for (const wd of words) { const t = line ? `${line} ${wd}` : wd; if (x.measureText(t).width > w - split - 96) { x.fillText(line, split + 48, y); y += 48; line = wd; if (++n === 3) break; } else line = t; }
      if (n < 3 && line) x.fillText(line, split + 48, y);
      texture.needsUpdate = true;
    }

    // what the player sees, by the same rules the game kit counts with
    const RULES = { minVisible: 0.5, minShare: 0.015, maxAngle: 55, seconds: 1 };
    const pts = []; for (let i = 0; i < 4; i++) for (let j = 0; j < 4; j++) pts.push(new THREE.Vector3((i / 3 - 0.5) * BW, (j / 3 - 0.5) * BH, 0));
    const v = new THREE.Vector3(), n = new THREE.Vector3(), toCam = new THREE.Vector3();
    let seen = 0, counted = false, views = 0;
    function measure(dt) {
      face.updateMatrixWorld();
      let inside = 0; for (const p of pts) { v.copy(p).applyMatrix4(face.matrixWorld).project(camera); if (v.z < 1 && Math.abs(v.x) <= 1 && Math.abs(v.y) <= 1) inside++; }
      const vis = inside / pts.length;
      const corners = [[-1, -1], [1, -1], [1, 1], [-1, 1]].map(([a, b]) => v.set(a * BW / 2, b * BH / 2, 0).applyMatrix4(face.matrixWorld).project(camera).clone());
      let area = 0; for (let i = 0; i < 4; i++) { const p = corners[i], q = corners[(i + 1) % 4]; area += p.x * q.y - q.x * p.y; }
      const share = corners.every((c) => c.z < 1) ? Math.min(1, Math.abs(area / 2) / 4) : 0;
      n.set(0, 0, 1).transformDirection(face.matrixWorld); face.getWorldPosition(v); toCam.copy(camera.position).sub(v).normalize();
      const angle = THREE.MathUtils.radToDeg(Math.acos(Math.min(1, Math.max(-1, n.dot(toCam)))));
      const ok = vis >= RULES.minVisible && share >= RULES.minShare && angle <= RULES.maxAngle;
      if (ok) seen += dt; else { seen = 0; if (vis < 0.05) counted = false; }
      if (ok && seen >= RULES.seconds && !counted) { counted = true; views++; mviews.textContent = views.toLocaleString('en-US'); }
      fill.style.width = `${Math.round((counted ? 1 : Math.min(1, seen / RULES.seconds)) * 100)}%`;
      meter.classList.toggle('count', counted);
      mtext.textContent = counted ? 'View counted' : vis < RULES.minVisible ? (vis > 0 ? `${Math.round(vis * 100)}% on screen` : 'Board off screen') : share < RULES.minShare ? 'Too small to read yet' : angle > RULES.maxAngle ? 'Seen at too steep an angle' : `Counting ${seen.toFixed(1)}s`;
    }

    // drive
    let a = ba - 1.6, running = false, last = 0, raf = 0, visible = true;
    const resize = () => { const w = box.clientWidth, h = box.clientHeight; if (!w || !h) return; renderer.setSize(w, h, false); camera.aspect = w / h; camera.fov = w / h < 0.9 ? 72 : 58; camera.updateProjectionMatrix(); };
    new ResizeObserver(resize).observe(box); resize();
    const look = new THREE.Vector3();
    function frame(t) {
      raf = requestAnimationFrame(frame);
      const dt = Math.min(0.05, (t - (last || t)) / 1000); last = t;
      a += dt * 0.16;
      place(me, a, R + 1.6);
      rivals.forEach((r) => { r.a += dt * r.v; place(r.g, r.a, r.r); });
      const back = a - 0.16, ahead = a + 0.22;
      camera.position.set(Math.cos(back) * (R + 0.4), 4.2, Math.sin(back) * (R + 0.4));
      look.set(Math.cos(ahead) * (R + 2.5), 1.8, Math.sin(ahead) * (R + 2.5)); camera.lookAt(look);
      measure(dt);
      renderer.render(scene, camera);
    }
    const vo = new IntersectionObserver(([e]) => { visible = e.isIntersecting; sync(); }); vo.observe(box);
    document.addEventListener('visibilitychange', () => sync());
    function sync() { const go = running && visible && !document.hidden; if (go && !raf) { last = 0; raf = requestAnimationFrame(frame); } else if (!go && raf) { cancelAnimationFrame(raf); raf = 0; } }
    // a first frame so the scene isn't empty before it starts
    place(me, a, R + 1.6); rivals.forEach((r) => place(r.g, r.a, r.r));
    return {
      play() { running = true; resize(); sync(); },
      pause() { running = false; sync(); },
      board(ad) { (document.fonts?.ready ?? Promise.resolve()).then(() => drawBoard(ad)); },
    };
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
