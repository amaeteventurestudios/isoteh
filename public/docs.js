(() => {
  const $ = (s, r = document) => r.querySelector(s), $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const nav = $('#nav'), burger = $('#burger');
  const solid = () => nav.classList.toggle('solid', scrollY > 8 || nav.classList.contains('open'));
  addEventListener('scroll', solid, { passive: true }); solid();
  const closeNav = () => { nav.classList.remove('open'); burger.setAttribute('aria-expanded', 'false'); solid(); };
  burger.addEventListener('click', () => { const o = nav.classList.toggle('open'); burger.setAttribute('aria-expanded', String(o)); solid(); });
  $$('.sheet a').forEach((a) => a.addEventListener('click', closeNav));
  addEventListener('keydown', (e) => { if (e.key === 'Escape') closeNav(); });

  // copy buttons
  $$('.dc').forEach((d) => {
    const b = $('.cp', d), pre = $('pre', d);
    b.addEventListener('click', async () => {
      try { await navigator.clipboard.writeText(pre.textContent); b.textContent = 'Copied'; } catch { b.textContent = 'Select and copy'; }
      setTimeout(() => { b.textContent = 'Copy'; }, 1800);
    });
  });

  // contents: mark the section being read
  const links = $$('.d-toc a'), secs = links.map((a) => $(a.getAttribute('href')));
  const mark = () => {
    let cur = secs[0];
    for (const s of secs) if (s.getBoundingClientRect().top < innerHeight * 0.3) cur = s;
    links.forEach((a) => a.classList.toggle('on', a.getAttribute('href') === `#${cur.id}`));
  };
  addEventListener('scroll', mark, { passive: true }); mark();
})();
