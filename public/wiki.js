// Docs wiki: the phone menu, light and dark, code tabs and copy buttons, "On this page" following the reader,
// search (⌘K), and Copy page. Shared bits (tabs, copy) also run on the company and legal pages via pages.js.
(() => {
  const $ = (s, r = document) => r.querySelector(s), $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const root = document.documentElement;

  // ---- theme ----
  const setPressed = () => { const t = root.getAttribute('data-theme') || 'system'; $$('.theme button').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.theme === t))); };
  $$('.theme button').forEach((b) => b.addEventListener('click', () => {
    const t = b.dataset.theme;
    if (t === 'system') root.removeAttribute('data-theme'); else root.setAttribute('data-theme', t);
    try { if (t === 'system') localStorage.removeItem('isoteh-theme'); else localStorage.setItem('isoteh-theme', t); } catch { /* storage blocked */ }
    setPressed();
  }));
  setPressed();

  // ---- phone menu ----
  const wk = $('.wk'), menu = $('#wk-menu');
  let scrim = null;
  const closeMenu = () => { wk.classList.remove('open'); menu.setAttribute('aria-expanded', 'false'); scrim?.remove(); scrim = null; };
  menu?.addEventListener('click', () => {
    if (wk.classList.contains('open')) return closeMenu();
    wk.classList.add('open'); menu.setAttribute('aria-expanded', 'true');
    scrim = document.createElement('div'); scrim.className = 'wk-scrim'; scrim.addEventListener('click', closeMenu); document.body.append(scrim);
    $('.sg a[aria-current]')?.scrollIntoView({ block: 'center' });
  });

  // ---- tabs and copy (also used on company pages) ----
  window.isotehBlocks = () => {
    $$('[data-tabs]').forEach((t) => {
      const tabs = $$('[role=tab]', t), panes = $$('[role=tabpanel]', t);
      const pick = (i, focus) => { tabs.forEach((x, k) => { x.setAttribute('aria-selected', String(k === i)); x.tabIndex = k === i ? 0 : -1; }); panes.forEach((p, k) => { p.hidden = k !== i; }); if (focus) tabs[i].focus(); };
      tabs.forEach((x, i) => {
        x.addEventListener('click', () => pick(i));
        x.addEventListener('keydown', (e) => { if (e.key === 'ArrowRight') pick((i + 1) % tabs.length, true); if (e.key === 'ArrowLeft') pick((i - 1 + tabs.length) % tabs.length, true); });
      });
    });
    $$('.cp').forEach((b) => b.addEventListener('click', async () => {
      const box = b.closest('.cb, .tabs'); const pre = box.querySelector('[role=tabpanel]:not([hidden]) pre') || box.querySelector('pre');
      try { await navigator.clipboard.writeText(pre.textContent); b.textContent = 'Copied'; } catch { b.textContent = 'Select to copy'; }
      setTimeout(() => { b.textContent = 'Copy'; }, 1600);
    }));
  };
  window.isotehBlocks();

  // ---- Copy page: the page as plain text, for pasting into an assistant ----
  $('#copy-page')?.addEventListener('click', async (e) => {
    const doc = $('.wk-doc').cloneNode(true);
    doc.querySelectorAll('.wk-act, .wk-pn, .wk-foot, .hl, .cp, figure svg, .wk-crumb').forEach((n) => n.remove());
    doc.querySelectorAll('h1, h2, h3, h4').forEach((h) => { h.textContent = `\n${'#'.repeat(+h.tagName[1])} ${h.textContent.trim()}\n`; });
    doc.querySelectorAll('pre').forEach((p) => { p.textContent = `\n\`\`\`\n${p.textContent}\n\`\`\`\n`; });
    doc.querySelectorAll('li').forEach((l) => { l.prepend('- '); });
    const text = `${doc.innerText.replace(/\n{3,}/g, '\n\n').trim()}\n\nSource: ${location.href}\n`;
    const b = e.currentTarget;
    try { await navigator.clipboard.writeText(text); b.textContent = 'Copied'; } catch { b.textContent = 'Could not copy'; }
    setTimeout(() => { b.textContent = 'Copy page'; }, 1600);
  });

  // ---- On this page ----
  const tl = $$('.wk-toc a'), heads = tl.map((a) => document.getElementById(a.getAttribute('href').slice(1))).filter(Boolean);
  if (heads.length) {
    let ticking = false;
    const mark = () => {
      ticking = false;
      let cur = heads[0];
      for (const h of heads) if (h.getBoundingClientRect().top < 140) cur = h;
      if (innerHeight + scrollY >= document.documentElement.scrollHeight - 4) cur = heads[heads.length - 1];
      tl.forEach((a) => a.classList.toggle('on', a.getAttribute('href') === `#${cur.id}`));
    };
    addEventListener('scroll', () => { if (!ticking) { ticking = true; requestAnimationFrame(mark); } }, { passive: true });
    mark();
  }

  // ---- search ----
  const sk = $('#sk'), q = $('#sk-q'), res = $('#sk-res');
  let index = null, sel = 0, last = null;
  const load = async () => { if (!index) try { index = await (await fetch('/docs/search.json')).json(); } catch { index = []; } return index; };
  const esc = (s) => s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const find = (term) => {
    const words = term.toLowerCase().split(/\s+/).filter(Boolean);
    if (!words.length) return index.slice(0, 8).map((p) => ({ u: p.u, t: p.t, g: p.g, s: '' }));
    const out = [];
    for (const p of index) {
      const title = p.t.toLowerCase(), body = p.x.toLowerCase();
      let score = 0;
      for (const w of words) { if (title.includes(w)) score += 10; const n = body.split(w).length - 1; if (!n && !title.includes(w)) { score = -1; break; } score += Math.min(n, 5); }
      if (score < 0) continue;
      const hit = p.h.find(([h]) => words.every((w) => h.toLowerCase().includes(w)));
      const at = body.indexOf(words[0]);
      const s = at >= 0 ? p.x.slice(Math.max(0, at - 50), at + 110) : '';
      out.push({ u: p.u + (hit ? `#${hit[1]}` : ''), t: hit ? `${p.t}: ${hit[0]}` : p.t, g: p.g, s, score: score + (hit ? 6 : 0) });
    }
    return out.sort((a, b) => b.score - a.score).slice(0, 12);
  };
  const draw = () => {
    const list = find(q.value);
    sel = 0;
    res.innerHTML = list.length ? list.map((r, i) => `<a role="option" href="${r.u}" aria-selected="${i === 0}"><small>${esc(r.g)}</small>${esc(r.t)}${r.s ? `<span>${esc(r.s)}</span>` : ''}</a>`).join('') : '<p class="none">Nothing found. Try another word.</p>';
  };
  const open = async () => { last = document.activeElement; sk.hidden = false; q.value = ''; await load(); draw(); q.focus(); };
  const close = () => { sk.hidden = true; last?.focus?.(); };
  $('#wk-search')?.addEventListener('click', open);
  q?.addEventListener('input', draw);
  q?.addEventListener('keydown', (e) => {
    const items = $$('a', res);
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault(); if (!items.length) return;
      sel = (sel + (e.key === 'ArrowDown' ? 1 : -1) + items.length) % items.length;
      items.forEach((a, i) => a.setAttribute('aria-selected', String(i === sel))); items[sel].scrollIntoView({ block: 'nearest' });
    }
    if (e.key === 'Enter' && items[sel]) { location.href = items[sel].href; close(); }
  });
  sk?.addEventListener('click', (e) => { if (e.target === sk) close(); });
  addEventListener('keydown', (e) => {
    if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') { e.preventDefault(); sk.hidden ? open() : close(); }
    if (e.key === 'Escape') { if (!sk.hidden) close(); else if (wk.classList.contains('open')) closeMenu(); }
    if (e.key === '/' && sk.hidden && !/input|textarea/i.test(document.activeElement.tagName)) { e.preventDefault(); open(); }
  });
})();
