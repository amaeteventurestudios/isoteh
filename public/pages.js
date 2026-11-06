// Company, help and legal pages: the phone menu, tabs and copy buttons, and the big name rising in the footer.
(() => {
  const $ = (s, r = document) => r.querySelector(s), $$ = (s, r = document) => [...r.querySelectorAll(s)];
  document.documentElement.classList.add('js');
  const nav = $('#nav'), burger = $('#burger');
  const closeNav = () => { nav.classList.remove('open'); burger.setAttribute('aria-expanded', 'false'); };
  burger?.addEventListener('click', () => { const o = nav.classList.toggle('open'); burger.setAttribute('aria-expanded', String(o)); });
  $$('.sheet a').forEach((a) => a.addEventListener('click', closeNav));
  addEventListener('keydown', (e) => { if (e.key === 'Escape') closeNav(); });

  $$('[data-tabs]').forEach((t) => {
    const tabs = $$('[role=tab]', t), panes = $$('[role=tabpanel]', t);
    tabs.forEach((x, i) => x.addEventListener('click', () => { tabs.forEach((y, k) => y.setAttribute('aria-selected', String(k === i))); panes.forEach((p, k) => { p.hidden = k !== i; }); }));
  });
  $$('.cp').forEach((b) => b.addEventListener('click', async () => {
    const box = b.closest('.cb, .tabs'); const pre = box.querySelector('[role=tabpanel]:not([hidden]) pre') || box.querySelector('pre');
    try { await navigator.clipboard.writeText(pre.textContent); b.textContent = 'Copied'; } catch { b.textContent = 'Select to copy'; }
    setTimeout(() => { b.textContent = 'Copy'; }, 1600);
  }));

  // contents: mark the section being read
  const links = $$('.pg-toc a'), secs = links.map((a) => document.getElementById(a.getAttribute('href').slice(1))).filter(Boolean);
  if (secs.length) {
    const mark = () => { let cur = secs[0]; for (const s of secs) if (s.getBoundingClientRect().top < innerHeight * 0.3) cur = s; links.forEach((a) => a.classList.toggle('on', a.getAttribute('href') === `#${cur.id}`)); };
    addEventListener('scroll', mark, { passive: true }); mark();
  }

  const big = $('.foot-big');
  if (big && 'IntersectionObserver' in window) new IntersectionObserver(([e], o) => { if (e.isIntersecting) { big.classList.add('in'); o.disconnect(); } }, { threshold: 0.1 }).observe(big);
  else big?.classList.add('in');
})();
