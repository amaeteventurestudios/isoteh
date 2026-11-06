// Small helpers the docs and company pages are written with. Everything returns HTML strings.
export const SITE = {
  url: 'https://isoteh.amaete.com',
  email: 'support@isoteh.amaete.com',
  linkedin: 'https://www.linkedin.com/company/isoteh',
  x: 'https://x.com/isotehads',
  owner: 'Amaete Venture Studios',
  updated: '6 November 2026',
};

export const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
export const slugify = (s) => String(s).toLowerCase().replace(/<[^>]+>/g, '').replace(/&[a-z]+;/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

/** A code block with a copy button. title is shown in the block's bar (a file name or a language). */
export const code = (text, title = '') => `<div class="cb">${title ? `<div class="cb-bar"><span>${esc(title)}</span><button class="cp" type="button">Copy</button></div>` : '<button class="cp solo" type="button">Copy</button>'}<pre><code>${esc(text.replace(/^\n|\n\s*$/g, ''))}</code></pre></div>`;

/** Code in tabs: [{ label, code }] */
let tabN = 0;
export const tabs = (items) => {
  const id = `t${++tabN}`;
  return `<div class="tabs" data-tabs><div class="tab-bar" role="tablist">${items.map((t, i) => `<button type="button" role="tab" id="${id}-${i}" aria-controls="${id}-p${i}" aria-selected="${i === 0}"${i ? ' tabindex="-1"' : ''}>${esc(t.label)}</button>`).join('')}<button class="cp" type="button">Copy</button></div>${items.map((t, i) => `<div class="tab-p" role="tabpanel" id="${id}-p${i}" aria-labelledby="${id}-${i}"${i ? ' hidden' : ''}><pre><code>${esc(t.code.replace(/^\n|\n\s*$/g, ''))}</code></pre></div>`).join('')}</div>`;
};

/** Numbered steps joined by a line: [[title, html], ...] */
export const steps = (items) => `<ol class="stp">${items.map(([t, b]) => `<li><h4>${t}</h4><div>${b}</div></li>`).join('')}</ol>`;

/** A callout. kind: note | tip | warn */
export const note = (html, kind = 'note') => {
  const ic = { note: '<circle cx="10" cy="10" r="7.5"/><path d="M10 9v5M10 6.5v.01"/>', tip: '<path d="M7.5 15h5M8 17.5h4M10 2.5a5 5 0 0 0-3 9c.6.5 1 1.2 1 2V14h4v-.5c0-.8.4-1.5 1-2a5 5 0 0 0-3-9Z"/>', warn: '<path d="M10 3 2.5 16.5h15Z"/><path d="M10 8.5v3.5M10 14.5v.01"/>' }[kind];
  return `<div class="call ${kind}"><svg viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.5" aria-hidden="true">${ic}</svg><div>${html}</div></div>`;
};

/** A table: head is an array of strings, rows an array of arrays of HTML. */
export const table = (head, rows) => `<div class="tbl-w"><table><thead><tr>${head.map((h) => `<th>${h}</th>`).join('')}</tr></thead><tbody>${rows.map((r) => `<tr>${r.map((c) => `<td>${c}</td>`).join('')}</tr>`).join('')}</tbody></table></div>`;

/** Link cards: [[href, title, text], ...] */
export const cards = (items) => `<div class="cards">${items.map(([h, t, d]) => `<a class="card" href="${h}"><b>${t}</b><span>${d}</span></a>`).join('')}</div>`;

/** A drawn figure: svg is the inside of an <svg> with the given viewBox. */
export const fig = (viewBox, svg, caption) => `<figure class="fig"><svg viewBox="${viewBox}" role="img" aria-label="${esc(caption)}">${svg}</svg><figcaption>${caption}</figcaption></figure>`;

/** A labelled box for figures. */
export const box = (x, y, w, h, label, sub = '', cls = '') => `<g class="bx ${cls}"><rect x="${x}" y="${y}" width="${w}" height="${h}" rx="12"/><text x="${x + w / 2}" y="${y + h / 2 + (sub ? -4 : 5)}" text-anchor="middle" class="t1">${label}</text>${sub ? `<text x="${x + w / 2}" y="${y + h / 2 + 16}" text-anchor="middle" class="t2">${sub}</text>` : ''}</g>`;
export const arrow = (x1, y1, x2, y2, label = '', dashed = false) => {
  const mx = (x1 + x2) / 2, my = (y1 + y2) / 2;
  return `<g class="ar${dashed ? ' dash' : ''}"><path d="M${x1} ${y1} L${x2} ${y2}" marker-end="url(#ah)"/>${label ? `<text x="${mx}" y="${my - 8}" text-anchor="middle" class="t2">${label}</text>` : ''}</g>`;
};
export const DEFS = '<defs><marker id="ah" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M0 0 10 5 0 10z" fill="currentColor"/></marker></defs>';
