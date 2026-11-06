(() => {
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const $ = (s) => document.querySelector(s), $$ = (s) => [...document.querySelectorAll(s)];
  const narrow = matchMedia('(max-width: 64rem)');

  // drawer
  const menu = $('#menu'), close = () => { document.body.classList.remove('menu-open'); menu.setAttribute('aria-expanded', 'false'); };
  menu.addEventListener('click', () => { const o = document.body.classList.toggle('menu-open'); menu.setAttribute('aria-expanded', String(o)); });
  $('#scrim').addEventListener('click', close);
  addEventListener('keydown', (e) => { if (e.key === 'Escape') close(); });
  $$('.panel a').forEach((a) => a.addEventListener('click', close));

  // section highlight in the panel
  const links = $$('[data-spy]');
  const spy = new IntersectionObserver((es) => es.forEach((e) => {
    if (!e.isIntersecting) return;
    links.forEach((l) => l.setAttribute('aria-current', String(l.getAttribute('href') === '#' + e.target.id)));
  }), { rootMargin: '-40% 0px -55% 0px' });
  links.forEach((l) => { const s = document.querySelector(l.getAttribute('href')); if (s) spy.observe(s); });

  // cutaways
  const cuts = $$('.cut');
  setTimeout(() => cuts[0]?.classList.add('open'), reduce ? 0 : 600);
  const io = new IntersectionObserver((es) => es.forEach((e) => { if (e.isIntersecting) { e.target.classList.add('in'); io.unobserve(e.target); } }), { rootMargin: '0px 0px -10% 0px' });
  $$('.rv').forEach((el) => io.observe(el));

  const pinCut = $('.pin-art .cut'), steps = $$('.steps li'), pin = $('.pin');
  const setStep = (li) => {
    steps.forEach((s) => s.classList.toggle('on', s === li));
    pinCut.classList.add('open', 'focus');
    pinCut.querySelectorAll('.layer').forEach((l) => { l.classList.toggle('on', l.dataset.i === li.dataset.layer); l.classList.toggle('above', +l.dataset.i > +li.dataset.layer); });
  };
  let last = -1;
  const onScroll = () => {
    if (!narrow.matches) return;
    const r = pin.getBoundingClientRect(), span = r.height - innerHeight;
    const k = Math.floor(Math.min(0.999, Math.max(0, -r.top / span)) * steps.length);
    if (k !== last) { last = k; setStep(steps[k]); }
  };
  addEventListener('scroll', onScroll, { passive: true }); onScroll();
  const so = new IntersectionObserver((es) => es.forEach((e) => { if (e.isIntersecting && !narrow.matches) setStep(e.target.closest('li')); }), { rootMargin: '-40% 0px -40% 0px' });
  steps.forEach((s) => so.observe(s.querySelector('h3')));
  new IntersectionObserver((es) => es.forEach((e) => { if (e.isIntersecting) pinCut.classList.add('open'); }), { threshold: 0.2 }).observe(pinCut);

  const tilt = $('#tilt');
  if (!reduce && matchMedia('(pointer: fine)').matches) addEventListener('pointermove', (e) => {
    const x = e.clientX / innerWidth - 0.5, y = e.clientY / innerHeight - 0.5;
    tilt.style.transform = `rotateX(${(-y * 6).toFixed(2)}deg) rotateY(${(x * 8).toFixed(2)}deg)`;
  }, { passive: true });

  let n = 11512;
  setInterval(() => { n += 1 + Math.floor(Math.random() * 3); $$('[data-seen]').forEach((s) => (s.textContent = n.toLocaleString('en-US'))); }, reduce ? 4000 : 1400);

  // ask: answers come from this page's own facts
  const QA = [
    { k: ['paid', 'pay', 'payout', 'money', 'bank', 'paypal', 'withdraw', 'when'], a: 'The brand pays when they book. We hold the money while the ad runs, then 85% moves to your balance. Withdraw it to your bank or PayPal in US dollars.', go: '#pricing' },
    { k: ['track', 'cookie', 'privacy', 'data', 'profile', 'gdpr'], a: 'No. Isoteh sets no cookies on your readers and builds no profiles. A view counts when half the ad is on screen for a second, and clicks are exact. We measure the ad, not the person.', go: '#how' },
    { k: ['substack', 'newsletter', 'email', 'beehiiv', 'ghost'], a: 'Yes. On Substack you paste a ready-made ad block into the post. On tools that allow code, the ad drops in by itself. Clicks are counted either way.', go: '#where' },
    { k: ['fee', 'cost', 'price', 'pricing', 'percent', '15', 'free', 'charge'], a: 'Listing is free. Isoteh takes 15% of each booking, so you keep 85%. No monthly fee and no audience minimum.', go: '#pricing' },
    { k: ['small', 'audience', 'minimum', 'traffic', 'big', 'followers'], a: 'There is no traffic minimum. A blog or newsletter with a few hundred readers can list today and set its own price.', go: '#price' },
    { k: ['game', 'games', 'billboard', 'unity', 'three'], a: 'Games get boards inside the world. A view counts only when the board is really on screen and big enough to read.', go: '#where' },
    { k: ['chat', 'private', 'app', 'channel', 'dm'], a: 'Ads appear in public channels only, never in private chats, and they always carry the Sponsored label.', go: '#where' },
    { k: ['approve', 'brand', 'reject', 'control', 'choose'], a: 'Every ad waits for your approval. Say no to any brand, any time, and the money goes back to them.', go: '#how' },
    { k: ['start', 'install', 'setup', 'set', 'code', 'wordpress', 'add'], a: 'List your space, then paste two lines where the ad should sit. WordPress has a plugin. That is the whole setup.', go: '#install' },
  ];
  const fallback = { a: 'I can answer questions about getting paid, tracking, pricing, newsletters, games, chat and setup. Try one of the suggestions.', go: '#questions' };
  const answer = $('#answer'), aq = $('#aq'), aa = $('#aa'), input = $('#q');
  let timer;
  const ask = (text) => {
    const t = text.toLowerCase();
    let best = fallback, score = 0;
    for (const x of QA) { const s = x.k.filter((k) => t.includes(k)).length; if (s > score) { score = s; best = x; } }
    answer.hidden = false; aq.textContent = text; aa.textContent = '';
    clearInterval(timer);
    const words = best.a.split(' '); let i = 0;
    const done = () => { aa.textContent = best.a + ' '; const l = document.createElement('a'); l.href = best.go; l.textContent = 'Show me'; aa.append(l); };
    if (reduce) return done();
    const caret = document.createElement('span'); caret.className = 'caret';
    timer = setInterval(() => { aa.textContent = words.slice(0, ++i).join(' '); aa.append(caret); if (i >= words.length) { clearInterval(timer); done(); } }, 38);
  };
  $('#ask').addEventListener('submit', (e) => { e.preventDefault(); if (input.value.trim()) ask(input.value.trim()); });
  $$('#sugg button').forEach((b) => b.addEventListener('click', () => { input.value = b.textContent; ask(b.textContent); }));

  // dashboard switcher
  const caps = ['Who booked, when, and what you get from each one.', 'Shown, seen and clicked, for every space you sell.', 'Your balance in dollars, and a payout when you want it.', 'What brands see when they look for a place to book.', 'Every ad is checked before it can run.'];
  const tabs = $$('[role=tab]'), imgs = $$('.screen img');
  const show = (i) => {
    tabs.forEach((t, k) => { t.setAttribute('aria-selected', String(k === i)); t.tabIndex = k === i ? 0 : -1; });
    imgs.forEach((m, k) => { m.classList.toggle('on', k === i); if (k === i) m.loading = 'eager'; });
    $('#cap').textContent = caps[i];
  };
  tabs.forEach((t, i) => {
    t.addEventListener('click', () => show(i));
    t.addEventListener('keydown', (e) => { const d = e.key === 'ArrowRight' ? 1 : e.key === 'ArrowLeft' ? -1 : 0; if (d) { const j = (i + d + tabs.length) % tabs.length; show(j); tabs[j].focus(); } });
  });

  // calculator
  const pin2 = $('#price-in');
  const usd = (c) => '$' + (c / 100).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const calc = () => {
    const pay = Math.round(Math.max(0, parseFloat(String(pin2.value).replace(/[^0-9.]/g, '')) || 0) * 100), fee = Math.round(pay * 0.15);
    for (const [id, c] of [['o-pay', pay], ['o-fee', fee], ['o-keep', pay - fee]]) { const d = document.getElementById(id); d.textContent = usd(c); d.classList.remove('bump'); void d.offsetWidth; d.classList.add('bump'); }
  };
  pin2.addEventListener('input', calc);
  $$('.calc .chips button').forEach((b) => b.addEventListener('click', () => { pin2.value = b.textContent; calc(); }));

  const copy = $('#copy');
  copy.addEventListener('click', async () => {
    try { await navigator.clipboard.writeText($('#snippet').innerText); copy.textContent = 'Copied'; } catch { copy.textContent = 'Select and copy'; }
    setTimeout(() => (copy.textContent = 'Copy'), 1800);
  });
})();
