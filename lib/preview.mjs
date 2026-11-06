// "See your ad" on the front page: read a brand's own page (name, one line, picture, colour) and hand back the parts of
// an ad. Only public http(s) addresses on the normal ports; private and local networks are refused at every redirect,
// the page is cut off at 400 KB and 5 seconds, and nothing is stored.
import { lookup } from 'node:dns/promises';
import { isIP } from 'node:net';
import { httpError } from './util.mjs';

const MAX = 400_000;

export function privateIp(ip) {
  const a = ip.toLowerCase().replace(/^::ffff:/, '');
  if (isIP(a) === 4) {
    const [p, q] = a.split('.').map(Number);
    return p === 0 || p === 10 || p === 127 || p >= 224 || (p === 100 && q >= 64 && q <= 127) || (p === 169 && q === 254)
      || (p === 172 && q >= 16 && q <= 31) || (p === 192 && q === 168) || (p === 198 && (q === 18 || q === 19));
  }
  return a === '::' || a === '::1' || /^f[cd]/.test(a) || /^fe[89ab]/.test(a) || a.startsWith('64:ff9b');
}

const ENT = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ', '#39': "'", mdash: '—', ndash: '–', rsquo: '’', lsquo: '‘', hellip: '…' };
const clean = (s, n) => String(s ?? '').replace(/&(#x[\da-f]+|#\d+|\w+);/gi, (m, e) => e[0] === '#' ? String.fromCodePoint(e[1] === 'x' || e[1] === 'X' ? parseInt(e.slice(2), 16) : +e.slice(1)) : ENT[e.toLowerCase()] ?? m)
  .replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim().slice(0, n);

function meta(html, key) {
  for (const m of html.matchAll(/<meta\b[^>]*>/gi)) {
    const tag = m[0], k = tag.match(/\b(?:property|name)\s*=\s*["']?([^"'\s>]+)/i)?.[1]?.toLowerCase();
    if (k === key) return tag.match(/\bcontent\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+))/i)?.slice(1).find((v) => v !== undefined) ?? '';
  }
  return '';
}

export function parsePage(html, base) {
  const host = base.hostname.replace(/^www\./, '');
  const title = clean(html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1], 120);
  const site = clean(meta(html, 'og:site_name') || meta(html, 'application-name'), 60);
  const ogt = clean(meta(html, 'og:title'), 120);
  // "Juniper Coffee | Small-batch beans" → the brand half
  const split = (t) => t.split(/\s+[|·•–—:-]\s+/).map((x) => x.trim()).filter(Boolean);
  const parts = split(ogt || title);
  const name = site || parts.find((x) => x.length <= 40) || host;
  const line = clean(meta(html, 'og:description') || meta(html, 'description') || meta(html, 'twitter:description'), 160)
    || parts.find((x) => x !== name) || '';
  let image = meta(html, 'og:image') || meta(html, 'og:image:url') || meta(html, 'twitter:image');
  try { image = image ? new URL(clean(image, 600), base).href : ''; } catch { image = ''; }
  if (!image.startsWith('https://')) image = '';
  const color = /^#[\da-f]{6}$/i.test(meta(html, 'theme-color').trim()) ? meta(html, 'theme-color').trim().toLowerCase() : '';
  return { name: clean(name, 40), line: clean(line, 140), image, color, host };
}

export async function readSite(raw, fetchImpl = fetch, resolve = (h) => lookup(h, { all: true })) {
  let u;
  try { u = new URL(/^https?:\/\//i.test(raw) ? raw : `https://${raw}`); } catch { throw httpError(400, 'That does not look like a web address'); }
  for (let hop = 0; hop < 4; hop++) {
    if (!/^https?:$/.test(u.protocol) || u.username || u.password || (u.port && !['80', '443'].includes(u.port))) throw httpError(400, 'Use a normal web address');
    const host = u.hostname.replace(/^\[|\]$/g, '');
    if (!host.includes('.') && !isIP(host)) throw httpError(400, 'Use a full web address, like yourbrand.com');
    let addrs;
    try { addrs = isIP(host) ? [{ address: host }] : await resolve(host); } catch { throw httpError(404, 'We could not find that website'); }
    if (!addrs.length || addrs.some((x) => privateIp(x.address))) throw httpError(400, 'That address is not a public website');
    let r;
    try {
      r = await fetchImpl(u, { redirect: 'manual', signal: AbortSignal.timeout(5000), headers: { 'user-agent': 'Mozilla/5.0 (compatible; IsotehPreview/1.0)', accept: 'text/html' } });
    } catch { throw httpError(504, 'That website did not answer in time'); }
    if ([301, 302, 303, 307, 308].includes(r.status) && r.headers.get('location')) { u = new URL(r.headers.get('location'), u); continue; }
    if (!r.ok) throw httpError(502, `That website answered ${r.status}`);
    let html = '', got = 0;
    const dec = new TextDecoder();
    for await (const chunk of r.body) { got += chunk.length; html += dec.decode(chunk, { stream: true }); if (got > MAX || /<\/head>/i.test(html)) break; }
    return parsePage(html, u);
  }
  throw httpError(502, 'Too many redirects');
}
