// Writes the docs wiki (public/docs/*.html), the company and legal pages (public/pages/*.html), the shared footer in
// public/home.html, public/docs/search.json and public/llms.txt. Run: node tools/site.mjs
// Content lives in tools/site/: docs.mjs (the wiki, in sidebar order) and pages.mjs (company, help and legal pages).
import { readFileSync, writeFileSync, mkdirSync, rmSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { SITE, esc, slugify } from './site/kit.mjs';
import { DOCS } from './site/docs.mjs';
import { PAGES } from './site/pages.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const PUB = join(ROOT, 'public');

const FONTS = '<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin><link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Geist:wght@400;500;600&family=Geist+Mono:wght@400;500&display=swap">';
const ICON = `<link rel="icon" href="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 16 16'%3E%3Crect width='16' height='16' rx='4' fill='%230b0d12'/%3E%3Crect x='4' y='4' width='8' height='8' rx='1.6' fill='none' stroke='white' stroke-width='1.4'/%3E%3Crect x='6.3' y='6.3' width='3.4' height='3.4' rx='.6' fill='white'/%3E%3C/svg%3E">`;
export const MARK = '<svg viewBox="0 0 16 16" fill="none"><rect x="2" y="2" width="12" height="12" rx="2.5" stroke="currentColor" stroke-width="1.6"/><rect x="5.5" y="5.5" width="5" height="5" rx="1" fill="currentColor"/></svg>';

const head = (title, desc, path, css, wiki = false) => `<!doctype html>
<html lang="en"${wiki ? ' class="wiki"' : ''}>
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<title>${esc(title)}</title>
<meta name="description" content="${esc(desc)}">
<link rel="canonical" href="${SITE.url}${path}">
<meta property="og:title" content="${esc(title)}"><meta property="og:description" content="${esc(desc)}"><meta property="og:url" content="${SITE.url}${path}">
<meta name="theme-color" content="#fbfbfc">
${ICON}
${FONTS}
${css.map((c) => `<link rel="stylesheet" href="/a/${c}">`).join('\n')}
<script src="/a/theme.js"></script>
</head>
<body>
<a class="skip" href="#main">Skip to the page</a>
`;

// ---- the footer, shared by every public page ----
const FOOT_COLS = [
  ['Solutions', [['/brands', 'For brands'], ['/owners', 'For owners'], ['/market', 'Find ad space']]],
  ['Company', [['/about', 'About'], ['/brand', 'Brand'], [SITE.linkedin, 'LinkedIn'], [SITE.x, 'X (Twitter)']]],
  ['Developers', [['/docs/integration-guide', 'Integration guide'], ['/docs/sdks', 'SDKs'], ['/docs/pixel', 'Pixel and Conversions API'], ['/docs/api', 'API reference'], ['/docs/counting', 'How views count']]],
  ['Resources', [['/docs', 'Docs'], ['/help', 'Help center'], ['/faq', 'FAQ'], ['/contact', 'Contact']]],
  ['Legal', [['/terms', 'Terms'], ['/privacy', 'Privacy'], ['/brand-safety', 'Brand safety'], ['/dpa', 'DPA'], ['/subprocessors', 'Sub-processors'], ['/security', 'Security'], ['/privacy-choices', 'Your privacy choices']]],
];
const ext = (h) => h.startsWith('http') ? ' rel="noopener" target="_blank"' : '';
export const FOOTER = `<footer class="foot">
  <div class="wrap foot-grid">
    <div class="foot-brand"><a class="wordmark" href="/"><span class="mark" aria-hidden="true">${MARK}</span>Isoteh</a><p>Advertising on your terms. Ads chosen by context, never by tracking people. Always labelled Sponsored.</p></div>
${FOOT_COLS.map(([t, links]) => `    <nav class="foot-col" aria-label="${t}"><h2>${t}</h2>${links.map(([h, l]) => `<a href="${h}"${ext(h)}>${l}</a>`).join('')}</nav>`).join('\n')}
  </div>
  <div class="wrap foot-base"><span>© ${SITE.owner} 2026. All rights reserved.</span><a href="mailto:${SITE.email}">${SITE.email}</a></div>
  <div class="foot-big" aria-hidden="true"><span>Isoteh</span></div>
</footer>`;

// ---- the marketing nav, for company and legal pages ----
const NAV = `<header class="nav solid" id="nav">
  <div class="nav-in">
    <a class="wordmark" href="/" aria-label="Isoteh home"><span class="mark" aria-hidden="true">${MARK}</span>Isoteh</a>
    <nav class="links" aria-label="Main"><a href="/brands">For brands</a><a href="/owners">For owners</a><a href="/about">About</a><a href="/docs">Docs</a><a href="/contact">Contact</a></nav>
    <div class="nav-act"><a class="btn ghost sm" href="/app">Sign in</a><a class="btn sm" href="/app#signup">Start selling</a>
      <button class="burger" id="burger" type="button" aria-label="Open the menu" aria-expanded="false" aria-controls="sheet"><span></span><span></span></button></div>
  </div>
  <div class="sheet" id="sheet"><a href="/brands">For brands</a><a href="/owners">For owners</a><a href="/about">About</a><a href="/docs">Docs</a><a href="/help">Help center</a><a href="/contact">Contact</a><a href="/app#signup">Make an account</a><a href="/app">Sign in</a></div>
</header>`;

// headings get ids and an anchor; returns the html and the list for "On this page"
function anchor(html) {
  const toc = [], used = new Set();
  const out = html.replace(/<h([23])(?: id="([^"]+)")?>([\s\S]*?)<\/h\1>/g, (_, n, given, text) => {
    let id = given || slugify(text) || 'section';
    while (used.has(id)) id += '-2';
    used.add(id); toc.push({ n: +n, id, text: text.replace(/<[^>]+>/g, '') });
    return `<h${n} id="${id}"><a class="hl" href="#${id}" aria-label="Link to this section">#</a>${text}</h${n}>`;
  });
  return { html: out, toc };
}
const plain = (html) => html.replace(/<(script|style|svg)[\s\S]*?<\/\1>/g, ' ').replace(/<[^>]+>/g, ' ').replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&#39;|&rsquo;/g, "'").replace(/\s+/g, ' ').trim();

// ---- the docs wiki ----
rmSync(join(PUB, 'docs'), { recursive: true, force: true });
mkdirSync(join(PUB, 'docs'), { recursive: true });
const flat = DOCS.flatMap((g) => g.pages.map((p) => ({ ...p, group: g.group })));
const href = (slug) => slug === 'index' ? '/docs' : `/docs/${slug}`;
const search = [];
const SIDE = (cur) => DOCS.map((g) => `<div class="sg"><h2>${g.group}</h2>${g.pages.map((p) => `<a href="${href(p.slug)}"${p.slug === cur ? ' aria-current="page"' : ''}>${p.nav || p.title}</a>`).join('')}</div>`).join('');

flat.forEach((p, i) => {
  const { html, toc } = anchor(p.body);
  const prev = flat[i - 1], next = flat[i + 1];
  search.push({ t: p.title, g: p.group, u: href(p.slug), h: toc.map((x) => [x.text, x.id]), x: plain(p.lede + ' ' + html).slice(0, 2400) });
  const page = head(`${p.title}: Isoteh docs`, p.lede.replace(/<[^>]+>/g, ''), href(p.slug), ['home.css', 'wiki.css'], true) + `<div class="wk">
<aside class="wk-side" id="wk-side" aria-label="Docs">
  <div class="wk-top"><a class="wordmark" href="/"><span class="mark" aria-hidden="true">${MARK}</span>Isoteh <span class="wk-docs">Docs</span></a>
    <div class="theme" role="group" aria-label="Theme"><button type="button" data-theme="system" aria-label="Match my device"><svg viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.5"><rect x="3" y="4" width="14" height="10" rx="1.5"/><path d="M7.5 17h5M10 14v3"/></svg></button><button type="button" data-theme="light" aria-label="Light"><svg viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.5"><circle cx="10" cy="10" r="3.2"/><path d="M10 2.5v2M10 15.5v2M2.5 10h2M15.5 10h2M4.7 4.7l1.4 1.4M13.9 13.9l1.4 1.4M4.7 15.3l1.4-1.4M13.9 6.1l1.4-1.4"/></svg></button><button type="button" data-theme="dark" aria-label="Dark"><svg viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M15.5 12.5A6 6 0 0 1 7.5 4.5a6 6 0 1 0 8 8Z"/></svg></button></div></div>
  <button class="wk-search" type="button" id="wk-search"><svg viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.6" aria-hidden="true"><circle cx="9" cy="9" r="5.5"/><path d="m13 13 4 4"/></svg>Search…<kbd>⌘K</kbd></button>
  <nav class="wk-nav" aria-label="Docs pages">${SIDE(p.slug)}</nav>
</aside>
<div class="wk-main">
  <header class="wk-bar"><button class="wk-menu" type="button" id="wk-menu" aria-controls="wk-side" aria-expanded="false" aria-label="Open the docs menu"><span></span><span></span></button><a class="wordmark wk-mob" href="/docs"><span class="mark" aria-hidden="true">${MARK}</span>Docs</a>
    <nav aria-label="Links"><a href="/help">Help</a><a href="/contact">Contact</a><a class="go" href="/app#signup">Brand sign in</a><a class="go" href="/app">Owner sign in</a></nav></header>
  <div class="wk-body">
    <main id="main" class="wk-doc">
      <p class="wk-crumb">${p.group}</p>
      <div class="wk-h"><h1>${p.title}</h1><div class="wk-act"><button type="button" id="copy-page">Copy page</button><a href="/contact">Ask a question</a></div></div>
      <p class="wk-lede">${p.lede}</p>
${html}
      <nav class="wk-pn" aria-label="Previous and next">${prev ? `<a class="pv" href="${href(prev.slug)}"><small>Previous</small>${prev.title}</a>` : '<span></span>'}${next ? `<a class="nx" href="${href(next.slug)}"><small>Next</small>${next.title}</a>` : ''}</nav>
      <footer class="wk-foot"><span>© ${SITE.owner} 2026</span><a href="/">isoteh.amaete.com</a><a href="/terms">Terms</a><a href="/privacy">Privacy</a><a href="mailto:${SITE.email}">${SITE.email}</a></footer>
    </main>
    <aside class="wk-toc" aria-label="On this page">${toc.length ? `<p><svg viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.5" aria-hidden="true"><path d="M3.5 5.5h13M3.5 10h9M3.5 14.5h11"/></svg>On this page</p>${toc.map((x) => `<a class="l${x.n}" href="#${x.id}">${x.text}</a>`).join('')}` : ''}</aside>
  </div>
</div>
</div>
<div class="sk" id="sk" hidden><div class="sk-box" role="dialog" aria-modal="true" aria-label="Search the docs"><div class="sk-in"><svg viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.6" aria-hidden="true"><circle cx="9" cy="9" r="5.5"/><path d="m13 13 4 4"/></svg><input id="sk-q" type="search" placeholder="Search the docs" autocomplete="off" aria-label="Search the docs"><kbd>Esc</kbd></div><div class="sk-res" id="sk-res" role="listbox"></div></div></div>
<script src="/a/wiki.js" defer></script>
</body>
</html>
`;
  writeFileSync(join(PUB, 'docs', `${p.slug}.html`), page);
});
writeFileSync(join(PUB, 'docs', 'search.json'), JSON.stringify(search));

// ---- company, help and legal pages ----
rmSync(join(PUB, 'pages'), { recursive: true, force: true });
mkdirSync(join(PUB, 'pages'), { recursive: true });
for (const p of PAGES) {
  const { html, toc } = anchor(p.body);
  const legal = p.kind === 'legal';
  const LEGAL_TABS = [['/terms', 'Terms'], ['/privacy', 'Privacy'], ['/brand-safety', 'Brand safety'], ['/security', 'Security'], ['/dpa', 'DPA'], ['/subprocessors', 'Sub-processors'], ['/privacy-choices', 'Privacy choices']];
  const page = head(`${p.title}: Isoteh`, p.lede.replace(/<[^>]+>/g, ''), `/${p.slug}`, ['home.css', 'home-fx.css', 'wiki.css', 'pages.css']) + NAV + `
<main id="main" class="pg ${p.kind || ''}">
  <div class="wrap pg-head">
    ${legal ? `<nav class="pg-tabs" aria-label="Legal">${LEGAL_TABS.map(([h, l]) => `<a href="${h}"${h === '/' + p.slug ? ' aria-current="page"' : ''}>${l}</a>`).join('')}</nav>` : ''}
    <h1 class="h2">${p.title}</h1>
    <p class="pg-lede">${p.lede}</p>
    ${legal ? `<p class="pg-date">Last updated ${SITE.updated}</p>` : ''}
  </div>
  <div class="wrap ${toc.length > 2 && !p.wide ? 'pg-grid' : 'pg-one'}">
    ${toc.length > 2 && !p.wide ? `<nav class="pg-toc" aria-label="On this page">${toc.filter((x) => x.n === 2).map((x) => `<a href="#${x.id}">${x.text}</a>`).join('')}</nav>` : ''}
    <div class="pg-body wk-doc">
${html}
    </div>
  </div>
</main>
${FOOTER}
<script src="/a/pages.js" defer></script>
</body>
</html>
`;
  writeFileSync(join(PUB, 'pages', `${p.slug}.html`), page);
}

// ---- the footer on the front page ----
const home = readFileSync(join(PUB, 'home.html'), 'utf8');
const a = home.indexOf('<footer class="foot">'), b = home.indexOf('</footer>') + '</footer>'.length;
writeFileSync(join(PUB, 'home.html'), home.slice(0, a) + FOOTER + home.slice(b));

// ---- llms.txt: the docs for AI tools ----
writeFileSync(join(PUB, 'llms.txt'), `# Isoteh\n\n> One ad network for blogs, newsletters, apps, chat and games. Owners set the price and approve every ad; readers are never tracked; every ad is labelled Sponsored.\n\n${DOCS.map((g) => `## ${g.group}\n\n${g.pages.map((p) => `- [${p.title}](${SITE.url}${href(p.slug)}): ${p.lede.replace(/<[^>]+>/g, '')}`).join('\n')}`).join('\n\n')}\n\n## Company and legal\n\n${PAGES.map((p) => `- [${p.title}](${SITE.url}/${p.slug}): ${p.lede.replace(/<[^>]+>/g, '')}`).join('\n')}\n`);

console.log(`docs ${flat.length} pages, company ${PAGES.length} pages, footer updated`);
