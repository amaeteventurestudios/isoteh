(() => {
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const cuts = document.querySelectorAll('.cut');
  setTimeout(() => cuts[0]?.classList.add('open'), reduce ? 0 : 650);

  // reveal
  const io = new IntersectionObserver((es) => es.forEach((e) => { if (e.isIntersecting) { e.target.classList.add('in'); io.unobserve(e.target); } }), { rootMargin: '0px 0px -10% 0px' });
  document.querySelectorAll('.rv').forEach((el) => io.observe(el));

  // pinned run
  const pinCut = document.querySelector('.pin-art .cut');
  const steps = [...document.querySelectorAll('.steps li')];
  const setStep = (li) => {
    steps.forEach((s) => s.classList.toggle('on', s === li));
    pinCut.classList.add('open', 'focus');
    pinCut.querySelectorAll('.layer').forEach((l) => { l.classList.toggle('on', l.dataset.i === li.dataset.layer); l.classList.toggle('above', +l.dataset.i > +li.dataset.layer); });
  };
  const pin = document.querySelector('.pin');
  const narrow = matchMedia('(max-width: 60rem)');
  let last = -1;
  const onScroll = () => {
    if (!narrow.matches) return;
    const r = pin.getBoundingClientRect(), span = r.height - innerHeight;
    const p = Math.min(0.999, Math.max(0, -r.top / span));
    const k = Math.floor(p * steps.length);
    if (k !== last) { last = k; setStep(steps[k]); }
  };
  addEventListener('scroll', onScroll, { passive: true });
  onScroll();
  const so = new IntersectionObserver((es) => es.forEach((e) => { if (e.isIntersecting && !narrow.matches) setStep(e.target.closest('li')); }), { rootMargin: innerWidth < 960 ? '-52% 0px -28% 0px' : '-40% 0px -40% 0px' });
  steps.forEach((s) => so.observe(s.querySelector('h3')));
  new IntersectionObserver((es) => es.forEach((e) => { if (e.isIntersecting) pinCut.classList.add('open'); }), { threshold: 0.2 }).observe(pinCut);

  // tilt on pointer
  const tilt = document.querySelector('[data-tilt]');
  if (!reduce && matchMedia('(pointer: fine)').matches) {
    addEventListener('pointermove', (e) => {
      const x = e.clientX / innerWidth - 0.5, y = e.clientY / innerHeight - 0.5;
      tilt.style.transform = `rotateX(${(-y * 6).toFixed(2)}deg) rotateY(${(x * 8).toFixed(2)}deg)`;
    }, { passive: true });
  }

  // live count on the count layer
  const seen = document.querySelectorAll('[data-seen]');
  let n = 11512;
  setInterval(() => { n += 1 + Math.floor(Math.random() * 3); seen.forEach((s) => (s.textContent = n.toLocaleString('en-US'))); }, reduce ? 4000 : 1400);

  // switcher
  const caps = ['Who booked, when, and what you get from each one.', 'Shown, seen and clicked, for every space you sell.', 'Your balance in dollars, and a payout when you want it.', 'What brands see when they look for a place to book.', 'Every ad is checked before it can run.'];
  const tabs = [...document.querySelectorAll('[role=tab]')], imgs = [...document.querySelectorAll('.screen img')];
  const show = (i) => {
    tabs.forEach((t, k) => { t.setAttribute('aria-selected', k === i); t.tabIndex = k === i ? 0 : -1; });
    imgs.forEach((m, k) => { m.classList.toggle('on', k === i); if (k === i) m.loading = 'eager'; });
    document.getElementById('cap').textContent = caps[i];
  };
  tabs.forEach((t, i) => {
    t.addEventListener('click', () => show(i));
    t.addEventListener('keydown', (e) => { const d = e.key === 'ArrowRight' ? 1 : e.key === 'ArrowLeft' ? -1 : 0; if (d) { const j = (i + d + tabs.length) % tabs.length; show(j); tabs[j].focus(); } });
  });

  // calculator
  const input = document.getElementById('price');
  const usd = (c) => '$' + (c / 100).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const calc = () => {
    const v = Math.max(0, parseFloat(String(input.value).replace(/[^0-9.]/g, '')) || 0);
    const pay = Math.round(v * 100);
    const vals = { 'o-pay': pay, 'o-fee': Math.round(pay * 0.15), 'o-keep': pay - Math.round(pay * 0.15) };
    for (const [id, c] of Object.entries(vals)) { const d = document.getElementById(id); d.textContent = usd(c); d.classList.remove('bump'); void d.offsetWidth; d.classList.add('bump'); }
  };
  input.addEventListener('input', calc);
  document.querySelectorAll('.chips button').forEach((b) => b.addEventListener('click', () => { input.value = b.textContent; calc(); }));

  // copy
  const copy = document.getElementById('copy');
  copy.addEventListener('click', async () => {
    try { await navigator.clipboard.writeText(document.getElementById('snippet').innerText); copy.textContent = 'Copied'; }
    catch { copy.textContent = 'Select and copy'; }
    setTimeout(() => (copy.textContent = 'Copy'), 1800);
  });
})();
