// The web server: public ad endpoints (what the website script, the newsletter blocks, the chat app and the game kit
// call), payment webhooks, the account API the dashboard uses, and the dashboard itself.
import { createServer } from 'node:http';
import { readFileSync, existsSync } from 'node:fs';
import { join, extname } from 'node:path';
import { openDb } from './db.mjs';
import { makeEngine } from './engine.mjs';
import { makeMarket } from './market.mjs';
import { makePayments } from './payments.mjs';
import { makeCreatives } from './creatives.mjs';
import { snippets } from './snippets.mjs';
import {
  id, now, token, sha, int, words, esc, money, httpError, body, rawBody, cookies, setCookie, limited,
  hashPassword, checkPassword, EMAIL_RE, CURRENCIES, isBot,
} from './util.mjs';

const ROOT = new URL('..', import.meta.url).pathname;
const DAY = 86_400_000;
const KINDS = ['site', 'newsletter', 'app', 'game', 'creator'];
const FORMATS = ['banner', 'native', 'email', 'game', 'creator'];
const PIXEL = Buffer.from('R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7', 'base64');
const STATIC = { '.js': 'text/javascript; charset=utf-8', '.mjs': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8',
  '.html': 'text/html; charset=utf-8', '.svg': 'image/svg+xml', '.php': 'text/plain; charset=utf-8', '.json': 'application/json' };

export function makeApp(cfg, { fetch } = {}) {
  const db = openDb(cfg.dataDir);
  const engine = makeEngine({ db, cfg });
  const market = makeMarket({ db, cfg });
  const payments = makePayments({ db, cfg, fetch });
  const creatives = makeCreatives(cfg.dataDir === ':memory:' ? join(ROOT, 'data-test', String(process.pid)) : cfg.dataDir);

  // ---- responses ----
  const send = (res, status, data, headers = {}) => {
    res.writeHead(status, { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store', ...headers });
    res.end(JSON.stringify(data));
  };
  const cors = { 'access-control-allow-origin': '*' };
  const ipOf = (req) => (cfg.trustProxy ? String(req.headers['x-forwarded-for'] ?? '').split(',')[0].trim() : '') || req.socket.remoteAddress || '';
  // a rotating, never-stored stand-in for the viewer's address, used only for in-memory rate limits
  const who = (req) => sha(`${ipOf(req)}|${new Date().toISOString().slice(0, 10)}|${cfg.key.toString('hex').slice(0, 16)}`).slice(0, 20);
  const countryOf = (req, q) => String((cfg.trustProxy && req.headers['cf-ipcountry']) || q.get('country') || '').toUpperCase().slice(0, 2);

  // ---- accounts ----
  function signedIn(req) {
    const auth = req.headers.authorization ?? '';
    if (auth.startsWith('Bearer isk_')) {
      const k = db.get('SELECT account_id FROM api_keys WHERE hash = ?', sha(auth.slice(7)));
      return k ? db.get('SELECT * FROM accounts WHERE id = ?', k.account_id) : null;
    }
    const s = cookies(req).is_s;
    if (!s) return null;
    const row = db.get('SELECT account_id FROM sessions WHERE id = ? AND expires > ?', sha(s), now());
    return row ? db.get('SELECT * FROM accounts WHERE id = ?', row.account_id) : null;
  }
  const need = (req) => { const a = signedIn(req); if (!a) throw httpError(401, 'Sign in first'); return a; };
  const staff = (a) => { if (!['staff', 'admin'].includes(a.role)) throw httpError(403, 'Staff only'); return a; };
  const pub = (a) => ({ id: a.id, email: a.email, name: a.name, role: a.role, country: a.country });
  function startSession(res, accountId) {
    const s = token();
    db.insert('sessions', { id: sha(s), account_id: accountId, expires: now() + 30 * DAY });
    setCookie(res, 'is_s', s, { maxAge: 30 * 86400, secure: cfg.secure });
  }

  // ---- shapes the SDKs read ----
  const imageUrl = (f) => (f ? `${cfg.publicUrl}/cr/${f}` : null);
  function adJson(choice, slot, req) {
    if (!choice) return { ad: null };
    if (choice.source === 'open') {
      const prop = db.get('SELECT currency FROM properties WHERE id = ?', slot.property_id);
      return { ad: null, open: { text: 'Advertise here', url: `${cfg.publicUrl}/book/${slot.id}`,
        from: money(slot.price_day || slot.price_week, prop.currency) + (slot.price_day ? ' a day' : ' a week') } };
    }
    const k = engine.served(choice, slot, req.headers['user-agent']);
    const a = choice.ad;
    return {
      ad: { kind: a.kind, sponsor: a.sponsor, title: a.title, body: a.body, cta: a.cta, image: imageUrl(a.image), width: a.width, height: a.height },
      label: 'Sponsored', source: choice.source,
      click: `${cfg.publicUrl}/c?k=${encodeURIComponent(k)}`, view: `${cfg.publicUrl}/t/v?k=${encodeURIComponent(k)}`,
    };
  }
  const slotById = (sid) => db.get('SELECT * FROM slots WHERE id = ?', String(sid ?? ''));

  /** Newsletter issues: the first open of an issue picks its ad; every later open and click uses the same one. */
  function issueAd(slot, issue) {
    issue = String(issue || 'default').slice(0, 64);
    let row = db.get('SELECT * FROM issues WHERE slot_id = ? AND issue = ?', slot.id, issue);
    if (!row) {
      const choice = engine.decide(slot, {});
      const ad = choice?.ad;
      db.run('INSERT OR IGNORE INTO issues (slot_id, issue, ad_id, booking_id, at) VALUES (?, ?, ?, ?, ?)', slot.id, issue, ad?.id ?? null, choice?.booking_id ?? '', now());
      row = db.get('SELECT * FROM issues WHERE slot_id = ? AND issue = ?', slot.id, issue);
    }
    const ad = row.ad_id ? db.get('SELECT * FROM ads WHERE id = ?', row.ad_id) : null;
    return { row, ad };
  }

  // ---- validation ----
  const str = (v, max, name, min = 0) => {
    const s = String(v ?? '').trim();
    if (s.length < min) throw httpError(400, `Add ${name}`);
    if (s.length > max) throw httpError(400, `${name[0].toUpperCase()}${name.slice(1)} is too long (${max} characters at most)`);
    return s;
  };
  const httpsUrl = (v, name = 'a link') => {
    const s = String(v ?? '').trim();
    try { const u = new URL(s); if (u.protocol !== 'https:') throw 0; return u.toString(); } catch { throw httpError(400, `Use an https:// address for ${name}`); }
  };
  const optUrl = (v) => (String(v ?? '').trim() ? httpsUrl(v, 'the address') : null);
  const cur = (v) => { const c = String(v ?? 'USD').toUpperCase(); if (!CURRENCIES.includes(c)) throw httpError(400, 'Pick a currency'); return c; };
  const ownProperty = (a, pid) => { const p = db.get('SELECT * FROM properties WHERE id = ? AND account_id = ?', pid, a.id); if (!p) throw httpError(404, 'No such place'); return p; };
  const ownSlot = (a, sid) => {
    const s = db.get('SELECT s.* FROM slots s JOIN properties p ON p.id = s.property_id WHERE s.id = ? AND p.account_id = ?', sid, a.id);
    if (!s) throw httpError(404, 'No such slot'); return s;
  };
  const ownCampaign = (a, cid) => { const c = db.get('SELECT * FROM campaigns WHERE id = ? AND account_id = ?', cid, a.id); if (!c) throw httpError(404, 'No such campaign'); return c; };

  function slotFields(b, partial) {
    const o = {};
    if (!partial || b.name !== undefined) o.name = str(b.name, 80, 'a name', 1);
    if (!partial || b.format !== undefined) { if (!FORMATS.includes(b.format)) throw httpError(400, 'Pick a format'); o.format = b.format; }
    for (const k of ['width', 'height']) if (!partial || b[k] !== undefined) o[k] = Math.max(0, Math.min(int(b[k]), 4000));
    if (!partial || b.keywords !== undefined) o.keywords = str(b.keywords, 300, 'keywords');
    for (const k of ['price_day', 'price_week', 'price_post']) if (!partial || b[k] !== undefined) o[k] = Math.max(0, int(b[k]));
    const yes = (v) => (v === true || v === 1 || v === '1' || v === 'true' ? 1 : 0);
    for (const [k, d] of [['booking_open', 1], ['approve', 1], ['network', 0]]) {
      if (b[k] !== undefined) o[k] = yes(b[k]); else if (!partial) o[k] = d;
    }
    if (b.status !== undefined) { if (!['active', 'paused'].includes(b.status)) throw httpError(400, 'Bad status'); o.status = b.status; }
    return o;
  }

  function adFields(b, partial) {
    const o = {};
    if (!partial || b.kind !== undefined) { if (!['image', 'native'].includes(b.kind)) throw httpError(400, 'Pick image or native'); o.kind = b.kind; }
    if (!partial || b.sponsor !== undefined) o.sponsor = str(b.sponsor, 60, 'the sponsor\'s name', 2);
    if (!partial || b.title !== undefined) o.title = str(b.title, 80, 'a headline');
    if (!partial || b.body !== undefined) o.body = str(b.body, 220, 'the text');
    if (!partial || b.cta !== undefined) o.cta = str(b.cta, 24, 'a button word');
    if (!partial || b.url !== undefined) o.url = httpsUrl(b.url, 'the ad\'s link');
    if (b.image) Object.assign(o, (({ file, width, height }) => ({ image: file, width, height }))(creatives.save(b.image)));
    return o;
  }

  // ---- routes ----
  async function handle(req, res) {
    const u = new URL(req.url, 'http://x');
    const p = u.pathname, q = u.searchParams, m = req.method;
    res.setHeader('x-content-type-options', 'nosniff');
    res.setHeader('referrer-policy', 'strict-origin-when-cross-origin');

    if (m === 'OPTIONS') { res.writeHead(204, { ...cors, 'access-control-allow-methods': 'GET, POST', 'access-control-allow-headers': 'content-type', 'access-control-max-age': '86400' }); return res.end(); }
    if (p === '/healthz') return send(res, 200, { ok: true });

    // -- what the SDKs call --
    if (p === '/v1/ad' && m === 'GET') {
      const slot = slotById(q.get('slot'));
      if (!slot) return send(res, 404, { error: 'No such slot' }, cors);
      if (limited(`ad:${who(req)}:${slot.id}`, 120, 60_000)) return send(res, 429, { error: 'Slow down' }, cors);
      const priv = ['private', 'dm', 'direct'].includes(q.get('ctx') ?? '');
      const choice = engine.decide(slot, { kw: words(q.get('kw')), country: countryOf(req, q), private: priv });
      return send(res, 200, adJson(choice, slot, req), cors);
    }
    if (p === '/t/v') {   // view beacon (GET image or sendBeacon POST)
      if (m === 'POST') await rawBody(req, 2048).catch(() => null);
      if (!limited(`v:${who(req)}`, 600, 60_000)) engine.viewed(q.get('k'), req.headers['user-agent']);
      res.writeHead(m === 'POST' ? 204 : 200, { ...cors, 'cache-control': 'no-store', ...(m === 'POST' ? {} : { 'content-type': 'image/gif' }) });
      return res.end(m === 'POST' ? undefined : PIXEL);
    }
    if (p === '/c' && m === 'GET') {
      const to = limited(`c:${who(req)}`, 60, 3_600_000) ? engine.clicked(q.get('k'), 'bot-limited') : engine.clicked(q.get('k'), req.headers['user-agent']);
      if (!to) { res.writeHead(404, { 'content-type': 'text/plain' }); return res.end('This ad has ended.'); }
      res.writeHead(302, { location: to, 'cache-control': 'no-store', 'referrer-policy': 'origin' }); return res.end();
    }
    let mm;
    if ((mm = p.match(/^\/cr\/([0-9a-f]{32}\.(?:png|jpg|webp|gif))$/))) {
      const f = creatives.read(mm[1]);
      if (!f) { res.writeHead(404); return res.end(); }
      res.writeHead(200, { ...cors, 'content-type': f.type, 'cache-control': 'public, max-age=31536000, immutable', 'content-security-policy': "default-src 'none'" });
      return res.end(f.bytes);
    }
    // newsletters: /e/<slot>.png?i=<issue> (the image), /e/<slot>/c?i=<issue> (the link), /e/<slot>/kit?i=<issue> (Substack)
    if ((mm = p.match(/^\/e\/([\w]+)\.png$/))) {
      const slot = slotById(mm[1]);
      const { row, ad } = slot ? issueAd(slot, q.get('i')) : {};
      const f = ad?.image ? creatives.read(ad.image) : null;
      if (ad && !isBot(req.headers['user-agent'])) engine.bump('serves', ad.id, slot.id, row.booking_id);   // opens, an estimate (mail apps preload images)
      res.writeHead(200, { 'content-type': f ? f.type : 'image/gif', 'cache-control': 'no-cache' });
      return res.end(f ? f.bytes : PIXEL);
    }
    if ((mm = p.match(/^\/e\/([\w]+)\/c$/))) {
      const slot = slotById(mm[1]);
      const { row, ad } = slot ? issueAd(slot, q.get('i')) : {};
      if (!ad) { res.writeHead(302, { location: slot ? `${cfg.publicUrl}/book/${slot.id}` : cfg.publicUrl }); return res.end(); }
      if (!isBot(req.headers['user-agent']) && !limited(`ec:${who(req)}:${slot.id}:${row.issue}`, 1, 86_400_000)) engine.bump('clicks', ad.id, slot.id, row.booking_id);
      res.writeHead(302, { location: engine.withUtm(ad.url, 'email'), 'cache-control': 'no-store' }); return res.end();
    }
    if ((mm = p.match(/^\/e\/([\w]+)\/kit$/))) {
      const slot = slotById(mm[1]);
      if (!slot) return send(res, 404, { error: 'No such slot' });
      const { ad } = issueAd(slot, q.get('i'));
      const i = encodeURIComponent(q.get('i') || 'default');
      return send(res, 200, ad ? { sponsor: ad.sponsor, title: ad.title, body: ad.body, cta: ad.cta, image: imageUrl(ad.image),
        link: `${cfg.publicUrl}/e/${slot.id}/c?i=${i}`, label: 'Sponsored' } : { ad: null });
    }
    // creators: one tracked link per paid post
    if ((mm = p.match(/^\/go\/([\w-]{6,16})$/))) {
      const b = db.get(`SELECT b.*, a.url FROM bookings b JOIN ads a ON a.id = b.ad_id WHERE b.link_code = ?`, mm[1]);
      if (!b) { res.writeHead(404, { 'content-type': 'text/plain' }); return res.end('This link has ended.'); }
      if (!isBot(req.headers['user-agent']) && !limited(`go:${who(req)}:${b.id}`, 1, 86_400_000)) engine.bump('clicks', b.ad_id, b.slot_id, b.id);
      res.writeHead(302, { location: engine.withUtm(b.url, 'creator'), 'cache-control': 'no-store' }); return res.end();
    }

    // -- payments --
    if (p === '/hooks/paystack' && m === 'POST') {
      const raw = await rawBody(req, 65_536);
      const e = payments.paystackEvent(raw, req.headers['x-paystack-signature']);
      if (!e) return send(res, 401, { error: 'Bad signature' });
      if (e.ref) try { market.paid(e.ref, 'paystack', { amount: e.amount, currency: e.currency }); } catch (err) { if (err.status !== 404) throw err; }
      return send(res, 200, { ok: true });
    }
    if (p === '/hooks/stripe' && m === 'POST') {
      const raw = await rawBody(req, 65_536);
      const e = payments.stripeEvent(raw, req.headers['stripe-signature']);
      if (!e) return send(res, 401, { error: 'Bad signature' });
      if (e.ref) try { market.paid(e.ref, 'stripe', { amount: e.amount, currency: e.currency }); } catch (err) { if (err.status !== 404) throw err; }
      return send(res, 200, { ok: true });
    }

    // -- public listings --
    if (p === '/v1/market' && m === 'GET') {
      const kind = q.get('kind'), country = (q.get('country') ?? '').toUpperCase(), text = words(q.get('q'));
      let rows = db.all(`SELECT s.id, s.name, s.format, s.width, s.height, s.price_day, s.price_week, s.price_post, s.keywords,
          p.id property_id, p.name property, p.kind, p.url, p.about, p.country, p.audience, p.currency, p.keywords pkw
        FROM slots s JOIN properties p ON p.id = s.property_id
        WHERE s.status = 'active' AND p.status = 'active' AND s.booking_open = 1 AND (s.price_day > 0 OR s.price_week > 0 OR s.price_post > 0)
        ORDER BY p.audience DESC LIMIT 500`);
      if (kind) rows = rows.filter((r) => r.kind === kind);
      if (country) rows = rows.filter((r) => r.country === country);
      if (text.length) rows = rows.filter((r) => { const w = new Set(words(`${r.name} ${r.property} ${r.about} ${r.keywords} ${r.pkw}`)); return text.every((t) => w.has(t)); });
      return send(res, 200, { slots: rows.slice(0, 100).map(({ pkw, ...r }) => r) });
    }
    if ((mm = p.match(/^\/v1\/slots\/(\w+)\/public$/)) && m === 'GET') {
      const s = db.get(`SELECT s.id, s.name, s.format, s.width, s.height, s.price_day, s.price_week, s.price_post, s.booking_open, s.approve, s.status,
          p.name property, p.kind, p.url, p.about, p.country, p.audience, p.currency FROM slots s JOIN properties p ON p.id = s.property_id WHERE s.id = ?`, mm[1]);
      if (!s) return send(res, 404, { error: 'No such slot' });
      const t = now();
      const booked = s.format === 'creator' ? [] : market.taken(s.id, t - DAY, t + 120 * DAY).map(({ starts, ends }) => ({ starts, ends }));
      const last30 = db.get(`SELECT COALESCE(SUM(views),0) views, COALESCE(SUM(clicks),0) clicks FROM stats WHERE slot_id = ? AND day >= ?`, s.id, engine.today(t - 30 * DAY));
      return send(res, 200, { slot: s, booked, last30 });
    }

    // -- accounts --
    if (p === '/v1/auth/signup' && m === 'POST') {
      if (limited(`su:${who(req)}`, 10, 3_600_000)) throw httpError(429, 'Too many tries; wait an hour');
      const b = await body(req);
      const email = String(b.email ?? '').trim().toLowerCase();
      if (!EMAIL_RE.test(email)) throw httpError(400, 'Use a real email address');
      if (String(b.password ?? '').length < 10) throw httpError(400, 'Use a password of 10 characters or more');
      const first = !db.get('SELECT 1 FROM accounts LIMIT 1');
      if (!cfg.signupOpen && !first) throw httpError(403, 'Sign-up is closed for now');
      if (db.get('SELECT 1 FROM accounts WHERE email = ?', email)) throw httpError(409, 'That email already has an account; sign in');
      const a = { id: id('ac'), email, name: str(b.name, 60, 'your name', 1), pw: hashPassword(b.password),
        role: (cfg.adminEmail ? email === cfg.adminEmail : first && cfg.mode !== 'production') ? 'admin' : 'member', country: String(b.country ?? '').toUpperCase().slice(0, 2) || null, created: now() };
      db.insert('accounts', a);
      startSession(res, a.id);
      return send(res, 201, { me: pub(a) });
    }
    if (p === '/v1/auth/login' && m === 'POST') {
      const b = await body(req);
      const email = String(b.email ?? '').trim().toLowerCase();
      if (limited(`li:${who(req)}`, 20, 900_000) || limited(`li:${email}`, 10, 900_000)) throw httpError(429, 'Too many tries; wait 15 minutes');
      const a = db.get('SELECT * FROM accounts WHERE email = ?', email);
      if (!a || !checkPassword(b.password, a.pw)) throw httpError(401, 'Wrong email or password');
      startSession(res, a.id);
      return send(res, 200, { me: pub(a) });
    }
    if (p === '/v1/auth/logout' && m === 'POST') {
      const s = cookies(req).is_s;
      if (s) db.run('DELETE FROM sessions WHERE id = ?', sha(s));
      setCookie(res, 'is_s', '', { maxAge: 0, secure: cfg.secure });
      return send(res, 200, { ok: true });
    }
    if (p === '/v1/me' && m === 'GET') {
      const a = signedIn(req);
      return send(res, 200, { me: a ? pub(a) : null, brand: cfg.brand, providers: cfg.providers, currencies: CURRENCIES, feeBps: cfg.feeBps, releaseDays: cfg.releaseDays, publicUrl: cfg.publicUrl, payInstructions: cfg.payInstructions });
    }

    if (p.startsWith('/v1/')) {
      // everything below needs a signed-in account; writes must be JSON (a cross-site form can't send it)
      if ((m === 'POST' || m === 'PATCH') && !String(req.headers['content-type'] ?? '').includes('application/json')) throw httpError(415, 'Send JSON');
      const a = need(req);
      return api(req, res, a, p, q, m);
    }

    // -- static files and the dashboard --
    if ((mm = p.match(/^\/s\/([\w.-]+\.(?:js|mjs))$/))) return file(res, join(ROOT, 'sdk', mm[1].replace(/^isoteh-(game|three)\./, 'game/isoteh-$1.').replace(/^isoteh-native\./, 'native/isoteh-native.').replace(/^isoteh\.js$/, 'web/isoteh.js')), cors, 'public, max-age=300');
    if ((mm = p.match(/^\/a\/([\w.-]+)$/))) return file(res, join(ROOT, 'public', mm[1]), {}, 'public, max-age=300');
    if (p === '/wordpress/isoteh.php') return file(res, join(ROOT, 'wordpress', 'isoteh', 'isoteh.php'), {}, 'no-cache', { 'content-disposition': 'attachment; filename="isoteh.php"' });
    if (p.startsWith('/demo/')) return file(res, join(ROOT, p.replace(/\.\./g, '')), {}, 'no-cache');
    if (m === 'GET' && (p === '/' || /^\/(market|book\/\w+|app(\/[\w/-]*)?)$/.test(p))) {
      const html = readFileSync(join(ROOT, 'public', 'app.html'), 'utf8').replaceAll('{{BRAND}}', esc(cfg.brand));
      res.writeHead(200, { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-cache',
        'content-security-policy': "default-src 'self'; img-src 'self' data: https:; style-src 'self' 'unsafe-inline'; script-src 'self'; frame-ancestors 'none'; base-uri 'none'; form-action 'self'" });
      return res.end(html);
    }
    throw httpError(404, 'Not found');
  }

  function file(res, path, headers, cache, extra = {}) {
    if (!path.startsWith(ROOT) || !existsSync(path)) throw httpError(404, 'Not found');
    res.writeHead(200, { 'content-type': STATIC[extname(path)] ?? 'application/octet-stream', 'cache-control': cache, ...headers, ...extra });
    return res.end(readFileSync(path));
  }

  // ---- the signed-in API ----
  async function api(req, res, a, p, q, m) {
    let mm;
    const b = m === 'POST' || m === 'PATCH' ? await body(req, p === '/v1/ads' || /^\/v1\/ads\/\w+$/.test(p) ? 2_200_000 : 32_768) : {};

    // places (properties) and their slots
    if (p === '/v1/properties' && m === 'GET') {
      const props = db.all('SELECT * FROM properties WHERE account_id = ? ORDER BY created DESC', a.id);
      const slots = db.all('SELECT s.* FROM slots s JOIN properties p ON p.id = s.property_id WHERE p.account_id = ? ORDER BY s.created', a.id);
      return send(res, 200, { properties: props.map((x) => ({ ...x, slots: slots.filter((s) => s.property_id === x.id) })) });
    }
    if (p === '/v1/properties' && m === 'POST') {
      if (!KINDS.includes(b.kind)) throw httpError(400, 'Pick what kind of place this is');
      const x = { id: id('pr'), account_id: a.id, kind: b.kind, name: str(b.name, 80, 'a name', 1), url: optUrl(b.url), about: str(b.about, 400, 'a description'),
        keywords: str(b.keywords, 300, 'keywords'), country: String(b.country ?? '').toUpperCase().slice(0, 2) || null,
        audience: Math.max(0, int(b.audience)), currency: cur(b.currency), status: 'active', created: now() };
      db.insert('properties', x);
      return send(res, 201, { property: x });
    }
    if ((mm = p.match(/^\/v1\/properties\/(\w+)$/)) && m === 'PATCH') {
      const x = ownProperty(a, mm[1]), o = {};
      if (b.name !== undefined) o.name = str(b.name, 80, 'a name', 1);
      if (b.url !== undefined) o.url = optUrl(b.url);
      if (b.about !== undefined) o.about = str(b.about, 400, 'a description');
      if (b.keywords !== undefined) o.keywords = str(b.keywords, 300, 'keywords');
      if (b.audience !== undefined) o.audience = Math.max(0, int(b.audience));
      if (b.country !== undefined) o.country = String(b.country).toUpperCase().slice(0, 2) || null;
      if (b.status !== undefined) { if (!['active', 'paused'].includes(b.status)) throw httpError(400, 'Bad status'); o.status = b.status; }
      db.patch('properties', x.id, o);
      return send(res, 200, { property: { ...x, ...o } });
    }
    if (p === '/v1/slots' && m === 'POST') {
      const x = ownProperty(a, b.property_id);
      const s = { id: id('sl'), property_id: x.id, ...slotFields(b, false), status: 'active', created: now() };
      if (x.kind === 'creator') s.format = 'creator';
      db.insert('slots', s);
      return send(res, 201, { slot: s });
    }
    if ((mm = p.match(/^\/v1\/slots\/(\w+)$/)) && m === 'PATCH') {
      const s = ownSlot(a, mm[1]), o = slotFields(b, true);
      if (b.house_ad_id !== undefined) {
        if (b.house_ad_id && !db.get('SELECT 1 FROM ads WHERE id = ? AND account_id = ?', b.house_ad_id, a.id)) throw httpError(400, 'Pick one of your own ads');
        o.house_ad_id = b.house_ad_id || null;
      }
      db.patch('slots', s.id, o);
      return send(res, 200, { slot: { ...s, ...o } });
    }
    if ((mm = p.match(/^\/v1\/slots\/(\w+)\/snippets$/)) && m === 'GET') {
      const s = ownSlot(a, mm[1]);
      return send(res, 200, { snippets: snippets(cfg, s) });
    }

    // campaigns and ads
    if (p === '/v1/campaigns' && m === 'GET') {
      const cs = db.all('SELECT * FROM campaigns WHERE account_id = ? ORDER BY created DESC', a.id);
      const ads = db.all('SELECT * FROM ads WHERE account_id = ? ORDER BY created DESC', a.id);
      return send(res, 200, { campaigns: cs.map((c) => ({ ...c, ads: ads.filter((x) => x.campaign_id === c.id).map((x) => ({ ...x, image_url: imageUrl(x.image) })) })) });
    }
    if (p === '/v1/campaigns' && m === 'POST') {
      const c = { id: id('cp'), account_id: a.id, name: str(b.name, 80, 'a name', 1), status: 'draft', currency: cur(b.currency),
        starts: b.starts ? int(b.starts) : null, ends: b.ends ? int(b.ends) : null, budget: Math.max(0, int(b.budget)), cpm: Math.max(0, int(b.cpm)),
        daily_views: Math.max(0, int(b.daily_views)), keywords: str(b.keywords, 300, 'keywords'), countries: str(b.countries, 200, 'countries').toUpperCase(),
        priority: ['staff', 'admin'].includes(a.role) ? Math.max(1, Math.min(9, int(b.priority, 5))) : 5, spent: 0, created: now() };
      db.insert('campaigns', c);
      return send(res, 201, { campaign: c });
    }
    if ((mm = p.match(/^\/v1\/campaigns\/(\w+)$/)) && m === 'PATCH') {
      const c = ownCampaign(a, mm[1]);
      if (b.status === 'active') return send(res, 200, { campaign: market.activate(a, c.id) });
      if (b.status === 'ended') { market.endCampaign(c); return send(res, 200, { campaign: { ...c, status: 'ended' } }); }
      const o = {};
      if (b.status === 'paused') o.status = 'paused';
      if (b.name !== undefined) o.name = str(b.name, 80, 'a name', 1);
      if (b.keywords !== undefined) o.keywords = str(b.keywords, 300, 'keywords');
      if (b.countries !== undefined) o.countries = str(b.countries, 200, 'countries').toUpperCase();
      if (b.daily_views !== undefined) o.daily_views = Math.max(0, int(b.daily_views));
      if (c.status === 'draft') {
        if (b.budget !== undefined) o.budget = Math.max(0, int(b.budget));
        if (b.cpm !== undefined) o.cpm = Math.max(0, int(b.cpm));
        if (b.starts !== undefined) o.starts = b.starts ? int(b.starts) : null;
        if (b.ends !== undefined) o.ends = b.ends ? int(b.ends) : null;
      }
      db.patch('campaigns', c.id, o);
      return send(res, 200, { campaign: { ...c, ...o } });
    }
    if (p === '/v1/ads' && m === 'POST') {
      const c = ownCampaign(a, b.campaign_id);
      const x = { id: id('ad'), campaign_id: c.id, account_id: a.id, ...adFields(b, false), created: now() };
      if (x.kind === 'image' && !x.image) throw httpError(400, 'Add an image');
      if (x.kind === 'native' && !x.title) throw httpError(400, 'Add a headline');
      x.review = ['staff', 'admin'].includes(a.role) ? 'approved' : 'pending';
      db.insert('ads', x);
      return send(res, 201, { ad: { ...x, image_url: imageUrl(x.image) } });
    }
    if ((mm = p.match(/^\/v1\/ads\/(\w+)$/)) && m === 'PATCH') {
      const x = db.get('SELECT * FROM ads WHERE id = ? AND account_id = ?', mm[1], a.id);
      if (!x) throw httpError(404, 'No such ad');
      const o = adFields(b, true);
      if (Object.keys(o).length) o.review = ['staff', 'admin'].includes(a.role) ? 'approved' : 'pending';   // every change is checked again
      db.patch('ads', x.id, o);
      return send(res, 200, { ad: { ...x, ...o } });
    }

    // bookings
    if (p === '/v1/bookings' && m === 'POST') return send(res, 201, { booking: market.book(a, b) });
    if (p === '/v1/bookings' && m === 'GET') {
      const sql = `SELECT b.*, s.name slot, s.format, p.name property, ad.sponsor, ad.title, ad.review,
          (SELECT COALESCE(SUM(views),0) FROM stats WHERE booking_id = b.id) views, (SELECT COALESCE(SUM(clicks),0) FROM stats WHERE booking_id = b.id) clicks
        FROM bookings b JOIN slots s ON s.id = b.slot_id JOIN properties p ON p.id = s.property_id JOIN ads ad ON ad.id = b.ad_id`;
      const rows = q.get('as') === 'owner' ? db.all(`${sql} WHERE b.owner_id = ? ORDER BY b.created DESC LIMIT 200`, a.id)
        : db.all(`${sql} WHERE b.account_id = ? ORDER BY b.created DESC LIMIT 200`, a.id);
      return send(res, 200, { bookings: rows.map((r) => ({ ...r, link: r.link_code ? `${cfg.publicUrl}/go/${r.link_code}` : null })) });
    }
    if ((mm = p.match(/^\/v1\/bookings\/(\w+)\/(accept|decline|pay|post|confirm|dispute|cancel)$/)) && m === 'POST') {
      const [, bid, act] = mm;
      if (act === 'accept' || act === 'decline') market.respond(a, bid, act === 'accept');
      if (act === 'post') market.posted(a, bid, b.url);
      if (act === 'confirm') market.confirm(a, bid);
      if (act === 'dispute') market.dispute(a, bid, b.reason);
      if (act === 'cancel') market.cancel(a, bid);
      if (act === 'pay') {
        const bk = db.get(`SELECT * FROM bookings WHERE id = ? AND account_id = ? AND status = 'awaiting_payment'`, bid, a.id);
        if (!bk) throw httpError(409, 'This booking isn\'t waiting for payment');
        if (bk.created < now() - cfg.holdMinutes * 60_000 && market.taken(bk.slot_id, bk.starts, bk.ends, bk.id).length) throw httpError(409, 'Those dates were taken; book again');
        db.patch('bookings', bk.id, { created: now() });   // paying renews the hold
        const pay = await payments.start({ kind: 'booking', target_id: bk.id, account: a, amount: bk.amount, currency: bk.currency, provider: b.provider ?? 'manual', returnUrl: `${cfg.publicUrl}/app/bookings` });
        db.patch('bookings', bk.id, { pay_ref: pay.ref, provider: b.provider ?? 'manual' });
        return send(res, 200, pay);
      }
      return send(res, 200, { ok: true });
    }

    // money
    if (p === '/v1/money' && m === 'GET') {
      return send(res, 200, { balances: market.balances(a.id),
        ledger: db.all('SELECT at, kind, amount, currency, booking_id, campaign_id, note FROM ledger WHERE account_id = ? ORDER BY id DESC LIMIT 200', a.id),
        payouts: db.all('SELECT id, amount, currency, method, status, created, paid_at FROM payouts WHERE account_id = ? ORDER BY created DESC LIMIT 50', a.id),
        payments: db.all(`SELECT ref, kind, target_id, amount, currency, provider, status, created FROM payments WHERE account_id = ? ORDER BY created DESC LIMIT 50`, a.id) });
    }
    if (p === '/v1/topups' && m === 'POST') {
      const amount = int(b.amount);
      if (amount <= 0) throw httpError(400, 'Enter an amount');
      return send(res, 200, await payments.start({ kind: 'topup', target_id: null, account: a, amount, currency: cur(b.currency), provider: b.provider ?? 'manual', returnUrl: `${cfg.publicUrl}/app/money` }));
    }
    if ((mm = p.match(/^\/v1\/payments\/(\w+)$/)) && m === 'GET') {
      const x = db.get('SELECT ref, kind, target_id, amount, currency, provider, status FROM payments WHERE ref = ? AND account_id = ?', mm[1], a.id);
      if (!x) throw httpError(404, 'No such payment');
      return send(res, 200, { payment: x });
    }
    if (p === '/v1/payouts' && m === 'POST') return send(res, 201, { payout: market.requestPayout(a, b) });

    // reports: views and clicks per day, for what you own or what you bought
    if (p === '/v1/reports' && m === 'GET') {
      const since = engine.today(now() - Math.min(int(q.get('days'), 30), 365) * DAY);
      const rows = q.get('as') === 'owner'
        ? db.all(`SELECT st.day, st.slot_id, s.name slot, SUM(st.serves) serves, SUM(st.views) views, SUM(st.clicks) clicks FROM stats st
            JOIN slots s ON s.id = st.slot_id JOIN properties p ON p.id = s.property_id WHERE p.account_id = ? AND st.day >= ? GROUP BY st.day, st.slot_id ORDER BY st.day`, a.id, since)
        : db.all(`SELECT st.day, st.ad_id, ad.sponsor, ad.title, SUM(st.serves) serves, SUM(st.views) views, SUM(st.clicks) clicks FROM stats st
            JOIN ads ad ON ad.id = st.ad_id WHERE ad.account_id = ? AND st.day >= ? GROUP BY st.day, st.ad_id ORDER BY st.day`, a.id, since);
      return send(res, 200, { rows });
    }

    // API keys, for servers (a chat app listing its channels as places, a game studio's build tools)
    if (p === '/v1/keys' && m === 'GET') return send(res, 200, { keys: db.all('SELECT id, label, created FROM api_keys WHERE account_id = ?', a.id) });
    if (p === '/v1/keys' && m === 'POST') {
      const k = `isk_${token(24)}`;
      const row = { id: id('key'), account_id: a.id, hash: sha(k), label: str(b.label, 60, 'a label'), created: now() };
      db.insert('api_keys', row);
      return send(res, 201, { key: k, id: row.id });
    }
    if ((mm = p.match(/^\/v1\/keys\/(\w+)\/delete$/)) && m === 'POST') {
      db.run('DELETE FROM api_keys WHERE id = ? AND account_id = ?', mm[1], a.id);
      return send(res, 200, { ok: true });
    }

    // staff
    if (p.startsWith('/v1/staff/')) {
      staff(a);
      if (p === '/v1/staff/review' && m === 'GET') {
        return send(res, 200, { ads: db.all(`SELECT ad.*, ac.email, ac.name owner FROM ads ad JOIN accounts ac ON ac.id = ad.account_id WHERE ad.review = 'pending' ORDER BY ad.created LIMIT 100`)
          .map((x) => ({ ...x, image_url: imageUrl(x.image) })) });
      }
      if ((mm = p.match(/^\/v1\/staff\/ads\/(\w+)\/review$/)) && m === 'POST') {
        if (!['approved', 'rejected'].includes(b.decision)) throw httpError(400, 'Approve or reject');
        db.patch('ads', mm[1], { review: b.decision, review_note: str(b.note, 300, 'a note') || null });
        market.audit(a.id, `ad.${b.decision}`, { id: mm[1] });
        return send(res, 200, { ok: true });
      }
      if (p === '/v1/staff/overview' && m === 'GET') {
        const t = engine.today();
        return send(res, 200, {
          accounts: db.get('SELECT COUNT(*) n FROM accounts').n, properties: db.get('SELECT COUNT(*) n FROM properties').n, slots: db.get('SELECT COUNT(*) n FROM slots').n,
          today: db.get('SELECT COALESCE(SUM(serves),0) serves, COALESCE(SUM(views),0) views, COALESCE(SUM(clicks),0) clicks FROM stats WHERE day = ?', t),
          escrow: market.balances('escrow'), fees: market.balances('platform'), pendingPayouts: market.balances('payouts_pending'),
          disputes: db.all(`SELECT b.*, s.name slot FROM bookings b JOIN slots s ON s.id = b.slot_id WHERE b.status = 'disputed' ORDER BY b.created`),
          payments: db.all(`SELECT p.*, ac.email FROM payments p JOIN accounts ac ON ac.id = p.account_id WHERE p.status = 'open' AND p.provider = 'manual' ORDER BY p.created DESC LIMIT 100`),
          payouts: db.all(`SELECT po.*, ac.email, ac.name FROM payouts po JOIN accounts ac ON ac.id = po.account_id WHERE po.status = 'requested' ORDER BY po.created`),
        });
      }
      if ((mm = p.match(/^\/v1\/staff\/payments\/(\w+)\/paid$/)) && m === 'POST') return send(res, 200, market.paid(mm[1], a.id));
      if ((mm = p.match(/^\/v1\/staff\/payouts\/(\w+)\/(paid|return)$/)) && m === 'POST') { market.finishPayout(a, mm[1], mm[2] === 'paid'); return send(res, 200, { ok: true }); }
      if ((mm = p.match(/^\/v1\/staff\/bookings\/(\w+)\/(release|refund)$/)) && m === 'POST') {
        const bk = db.get('SELECT * FROM bookings WHERE id = ?', mm[1]);
        if (!bk) throw httpError(404, 'No such booking');
        if (mm[2] === 'release') market.settle(bk, a.id); else market.refund(bk, a.id);
        return send(res, 200, { ok: true });
      }
      if (p === '/v1/staff/accounts' && m === 'POST') {
        if (a.role !== 'admin') throw httpError(403, 'Administrator only');
        if (!['member', 'staff', 'admin'].includes(b.role)) throw httpError(400, 'Bad role');
        const t = db.get('SELECT id FROM accounts WHERE email = ?', String(b.email ?? '').toLowerCase());
        if (!t) throw httpError(404, 'No account with that email');
        db.patch('accounts', t.id, { role: b.role });
        market.audit(a.id, 'account.role', { id: t.id, role: b.role });
        return send(res, 200, { ok: true });
      }
    }
    throw httpError(404, 'Not found');
  }

  const server = createServer(async (req, res) => {
    try { await handle(req, res); }
    catch (e) {
      const status = e.status ?? 500;
      if (status === 500) console.error(e);
      if (!res.headersSent) send(res, status, { error: status === 500 ? 'Something went wrong' : e.message });
      else res.end();
    }
  });
  let timer;
  return {
    db, engine, market, payments, creatives, server,
    listen(port = cfg.port, host = cfg.host) {
      timer = setInterval(() => { try { market.tick(); } catch (e) { console.error('tick', e); } }, 60_000);
      timer.unref();
      return new Promise((ok) => server.listen(port, host, () => ok(server)));
    },
    close() { clearInterval(timer); server.closeAllConnections?.(); return new Promise((ok) => server.close(() => { db.close(); ok(); })); },
  };
}
