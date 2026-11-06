// The advertiser workspace behind the dashboard: organizations and their team, the person's own settings (password,
// two-step sign-in), the organization's key, Slack and support; ad groups and audiences; events that happen after a
// click; and the numbers the dashboard and the campaign tables show.
//
// Privacy, the same as the rest of Isoteh: an audience is a set of places chosen by context (topics, countries, kinds of
// place, formats, sites), never a list of people. An event counts what happened after a click against the ad that was
// clicked. The click carries a reference that is the same for everyone who clicks that ad that day, so no event can
// point to one person. Nothing about a visitor is stored.
import { createHmac, randomBytes } from 'node:crypto';
import { id, now, int, sha, token, sign, unsign, httpError, words, hashPassword, checkPassword, EMAIL_RE, limited } from './util.mjs';

const DAY = 86_400_000;
const FIELDS = ['topic', 'country', 'kind', 'format', 'site'];
const EVENT_RE = /^[a-z][a-z0-9_]{1,31}$/;
const CATEGORIES = ['Billing', 'Campaigns', 'Tracking', 'Account', 'Selling ad space', 'Book a call', 'Something else'];
const dayOf = (t) => new Date(t).toISOString().slice(0, 10);
const hourOf = (t) => new Date(t).toISOString().slice(0, 13);
const json = (s, d) => { try { return JSON.parse(s); } catch { return d; } };
const hostOf = (u) => { try { return new URL(u).hostname.replace(/^www\./, ''); } catch { return ''; } };

// ---- two-step sign-in: TOTP (RFC 6238), six digits, 30 seconds, one step either side ----
const B32 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
export function base32(buf) {
  let bits = 0, v = 0, out = '';
  for (const b of buf) { v = (v << 8) | b; bits += 8; while (bits >= 5) { out += B32[(v >>> (bits - 5)) & 31]; bits -= 5; } }
  if (bits) out += B32[(v << (5 - bits)) & 31];
  return out;
}
function unbase32(s) {
  let bits = 0, v = 0; const out = [];
  for (const c of String(s).replace(/=+$/, '').toUpperCase()) { const i = B32.indexOf(c); if (i < 0) continue; v = (v << 5) | i; bits += 5; if (bits >= 8) { out.push((v >>> (bits - 8)) & 255); bits -= 8; } }
  return Buffer.from(out);
}
export function totp(secret, t = now(), step = 0) {
  const c = Buffer.alloc(8); c.writeBigUInt64BE(BigInt(Math.floor(t / 30_000) + step));
  const h = createHmac('sha1', unbase32(secret)).update(c).digest();
  const o = h[h.length - 1] & 15;
  return String((h.readUInt32BE(o) & 0x7fffffff) % 1_000_000).padStart(6, '0');
}
export const totpOk = (secret, code, t = now()) => !!secret && /^\d{6}$/.test(String(code ?? '').trim()) && [-1, 0, 1].some((s) => totp(secret, t, s) === String(code).trim());

export function makeWorkspace({ db, cfg, fetch = globalThis.fetch }) {
  // ---- organizations ----
  /** What a signed-in person acts as: their own account, or an organization they belong to. */
  function actAs(person, orgId) {
    if (orgId && orgId !== person.id) {
      const m = db.get('SELECT role FROM members WHERE org_id = ? AND account_id = ?', orgId, person.id);
      const org = m && db.get('SELECT * FROM accounts WHERE id = ?', orgId);
      if (org) return { ...org, role: person.role, actor: person, orgRole: m.role };
    }
    return { ...person, actor: person, orgRole: 'admin' };
  }
  function orgsOf(person) {
    return [{ id: person.id, name: person.name, kind: person.kind, role: 'admin', own: true },
      ...db.all(`SELECT a.id, a.name, a.kind, m.role FROM members m JOIN accounts a ON a.id = m.org_id WHERE m.account_id = ? AND m.org_id <> ? ORDER BY a.name`, person.id, person.id)];
  }
  const orgPub = (a) => ({ id: a.id, name: a.name, website: a.website ?? '', kind: a.kind, setup_hidden: !!a.setup_hidden, slack: !!a.slack_url, role: a.orgRole });
  const personPub = (p) => ({ id: p.id, email: p.email, name: p.name, role: p.role, country: p.country, totp_on: !!p.totp_on });
  const adminOnly = (a) => { if (a.orgRole !== 'admin') throw httpError(403, 'Only an admin of this organization can do that'); };

  function acceptInvites(person) {
    for (const inv of db.all('SELECT * FROM invites WHERE email = ?', person.email)) {
      db.run('INSERT OR IGNORE INTO members (org_id, account_id, role, created) VALUES (?, ?, ?, ?)', inv.org_id, person.id, inv.role, now());
      db.run('DELETE FROM invites WHERE id = ?', inv.id);
    }
  }

  // ---- Slack: an incoming webhook the organization pastes in; we post short notes to it ----
  async function notify(orgId, text) {
    const url = db.get('SELECT slack_url FROM accounts WHERE id = ?', orgId)?.slack_url;
    if (!url) return false;
    try {
      const r = await fetch(url, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ text }), signal: AbortSignal.timeout(5000) });
      return r.ok;
    } catch { return false; }
  }
  const slackUrl = (v) => {
    const s = String(v ?? '').trim();
    if (!s) return null;
    let u; try { u = new URL(s); } catch { throw httpError(400, 'Paste the webhook address Slack gave you'); }
    if (u.protocol !== 'https:' || u.hostname !== 'hooks.slack.com' || !u.pathname.startsWith('/services/') || u.port) throw httpError(400, 'Use a Slack incoming webhook (https://hooks.slack.com/services/…)');
    return u.toString();
  };

  // ---- audiences: does a place fit? ----
  function placeFacts(slot, prop, ctx) {
    return { topic: new Set([...words(slot.keywords), ...words(prop.keywords), ...(ctx.kw ?? [])]), country: (ctx.country || prop.country || '').toUpperCase(),
      kind: prop.kind, format: slot.format, site: hostOf(prop.url) };
  }
  function condOk(c, f) {
    const v = String(c.value ?? '').trim().toLowerCase();
    if (!v) return false;
    if (c.field === 'topic') return words(v).some((w) => f.topic.has(w));
    if (c.field === 'site') return !!f.site && (f.site === v.replace(/^www\./, '') || f.site.endsWith(`.${v}`));
    if (c.field === 'country') return v.toUpperCase().split(/[\s,]+/).includes(f.country);
    return String(f[c.field] ?? '').toLowerCase() === v;
  }
  function listOk(list, f) {
    const items = String(list.items).split(/\n/).map((x) => x.trim().toLowerCase()).filter(Boolean);
    return items.some((x) => condOk({ field: list.kind === 'sites' ? 'site' : 'topic', value: x }, f));
  }
  /** True when an ad in this ad group may show on this place. */
  function groupOk(groupId, slot, prop, ctx) {
    if (!groupId) return true;
    const g = db.get('SELECT status, audience_id FROM ad_groups WHERE id = ?', groupId);
    if (!g) return true;
    if (g.status !== 'active') return false;
    const au = g.audience_id && db.get('SELECT * FROM audiences WHERE id = ?', g.audience_id);
    if (!au) return true;
    const f = placeFacts(slot, prop, ctx);
    const inc = json(au.include, []), exc = json(au.exclude, []), lists = json(au.lists, []);
    if (exc.some((c) => condOk(c, f))) return false;
    for (const l of lists) {
      const list = db.get('SELECT * FROM lists WHERE id = ?', l.id);
      if (list && l.exclude && listOk(list, f)) return false;
    }
    const tests = [...inc.map((c) => () => condOk(c, f)), ...lists.filter((l) => !l.exclude).map((l) => () => { const list = db.get('SELECT * FROM lists WHERE id = ?', l.id); return !list || listOk(list, f); })];
    if (!tests.length) return true;
    return au.match === 'all' ? tests.every((t) => t()) : tests.some((t) => t());
  }

  // ---- events ----
  /** The reference a click adds to the advertiser's link: the ad and the day, the same for everyone. */
  const clickRef = (adId, t = now()) => sign({ a: adId, d: dayOf(t) }, cfg.key);
  function withRef(url, adId) {
    try { const u = new URL(url); u.searchParams.set('isoteh_ref', clickRef(adId)); return u.toString(); } catch { return url; }
  }
  function record(accountId, { name, adId = '', value = 0, currency = '', n = 1, source }, t = now()) {
    name = String(name ?? '').toLowerCase().trim();
    if (!EVENT_RE.test(name)) throw httpError(400, 'Name the event in lower case, like purchase or sign_up');
    n = Math.max(1, Math.min(int(n, 1), 10_000));
    value = Math.max(0, Math.min(int(value), 1e12));
    currency = String(currency || '').toUpperCase().slice(0, 3);
    db.run(`INSERT INTO events (hour, account_id, ad_id, name, n, value, currency) VALUES (?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT (hour, account_id, ad_id, name, currency) DO UPDATE SET n = n + excluded.n, value = value + excluded.value`, hourOf(t), accountId, adId, name, n, value, value ? currency : '');
    db.run('INSERT INTO event_sources (account_id, source, last_at) VALUES (?, ?, ?) ON CONFLICT (account_id, source) DO UPDATE SET last_at = excluded.last_at', accountId, source, t);
  }
  /** An event from the browser tag on the advertiser's site. Only counts with a valid click reference. */
  function tagEvent(b, who) {
    const r = unsign(String(b.ref ?? ''), cfg.key);
    if (!r?.a || !r.d || Date.parse(r.d) < now() - 31 * DAY) return false;
    const ad = db.get('SELECT id, account_id FROM ads WHERE id = ?', r.a);
    if (!ad || limited(`ev:${who}:${ad.id}`, 30, 3_600_000)) return false;
    record(ad.account_id, { name: b.event ?? b.ev, adId: ad.id, value: b.value, currency: b.currency, source: 'tag' });
    return true;
  }

  // ---- numbers: spend, views, clicks and events for an organization over some days ----
  function metrics(orgId, from, to, currency) {
    const days = [];
    for (let t = Date.parse(from); t <= Date.parse(to); t += DAY) days.push(dayOf(t));
    const series = new Map(days.map((d) => [d, { day: d, spend: 0, views: 0, clicks: 0, serves: 0, conversions: 0, value: 0 }]));
    const ads = db.all('SELECT a.id, a.campaign_id, a.group_id FROM ads a WHERE a.account_id = ?', orgId);
    const adMap = new Map(ads.map((a) => [a.id, a]));
    const by = { ad: {}, group: {}, campaign: {} };
    const add = (adId, campaignId, k, v) => {
      const a = adMap.get(adId);
      const keys = [['ad', adId], ['group', a?.group_id], ['campaign', campaignId ?? a?.campaign_id]];
      for (const [t, key] of keys) if (key) { const o = (by[t][key] ??= { spend: 0, views: 0, clicks: 0, serves: 0, conversions: 0, value: 0 }); o[k] += v; }
    };
    for (const r of db.all(`SELECT st.day, st.ad_id, SUM(st.serves) serves, SUM(st.views) views, SUM(st.clicks) clicks FROM stats st JOIN ads a ON a.id = st.ad_id
      WHERE a.account_id = ? AND st.day >= ? AND st.day <= ? GROUP BY st.day, st.ad_id`, orgId, from, to)) {
      const s = series.get(r.day); if (s) { s.views += r.views; s.clicks += r.clicks; s.serves += r.serves; }
      add(r.ad_id, null, 'views', r.views); add(r.ad_id, null, 'clicks', r.clicks); add(r.ad_id, null, 'serves', r.serves);
    }
    const t0 = Date.parse(from), t1 = Date.parse(to) + DAY;
    // pay-per-view spend comes out of the campaign's held budget
    for (const r of db.all(`SELECT l.at, l.amount, l.campaign_id FROM ledger l JOIN campaigns c ON c.id = l.campaign_id
      WHERE c.account_id = ? AND l.account_id = 'escrow' AND l.kind = 'spend' AND l.currency = ? AND l.at >= ? AND l.at < ?`, orgId, currency, t0, t1)) {
      const s = series.get(dayOf(r.at)); if (s) s.spend += -r.amount;
      add(null, r.campaign_id, 'spend', -r.amount);
    }
    // a booking counts as spent when it is paid
    for (const r of db.all(`SELECT b.paid_at, b.amount, b.ad_id FROM bookings b WHERE b.account_id = ? AND b.currency = ? AND b.paid_at >= ? AND b.paid_at < ?
      AND b.status IN ('paid','live','settled','disputed')`, orgId, currency, t0, t1)) {
      const s = series.get(dayOf(r.paid_at)); if (s) s.spend += r.amount;
      add(r.ad_id, null, 'spend', r.amount);
    }
    for (const r of db.all(`SELECT substr(hour,1,10) day, ad_id, name, SUM(n) n, SUM(CASE WHEN currency = ? THEN value ELSE 0 END) value FROM events
      WHERE account_id = ? AND hour >= ? AND hour < ? AND name NOT IN ('page_view') GROUP BY day, ad_id, name`, currency, orgId, from, `${to}T99`)) {
      const s = series.get(r.day); if (s) { s.conversions += r.n; s.value += r.value; }
      if (r.ad_id) { add(r.ad_id, null, 'conversions', r.n); add(r.ad_id, null, 'value', r.value); }
    }
    const list = [...series.values()];
    const total = list.reduce((o, s) => { for (const k in o) o[k] += s[k]; return o; }, { spend: 0, views: 0, clicks: 0, serves: 0, conversions: 0, value: 0 });
    return { series: list, total, by };
  }

  function setup(a) {
    const tracking = !!db.get('SELECT 1 FROM event_sources WHERE account_id = ?', a.id);
    const payment = !!db.get(`SELECT 1 FROM payments WHERE account_id = ? AND status = 'paid'`, a.id) || db.get(`SELECT COALESCE(SUM(amount),0) n FROM ledger WHERE account_id = ?`, a.id).n > 0
      || !!db.get(`SELECT 1 FROM bookings WHERE account_id = ? AND paid_at IS NOT NULL`, a.id);
    const campaign = !!db.get('SELECT 1 FROM campaigns WHERE account_id = ?', a.id);
    const launched = !!db.get(`SELECT 1 FROM campaigns WHERE account_id = ? AND status IN ('active','ended')`, a.id)
      || !!db.get(`SELECT 1 FROM bookings WHERE account_id = ? AND status IN ('paid','live','settled')`, a.id);
    return { campaign, tracking, payment, launched };
  }

  // ---- the signed-in routes; returns undefined when the path isn't one of these ----
  async function route({ a, p, q, m, b, req, res, send, str, startSession, imageUrl, sessionId }) {
    let mm;
    const person = a.actor;
    if (p === '/v1/workspace' && m === 'GET') {
      return send(res, 200, { me: personPub(person), org: orgPub(a), orgs: orgsOf(person), setup: setup(a) });
    }
    // organizations
    if (p === '/v1/orgs' && m === 'POST') {
      const org = { id: id('ac'), email: `${id('org')}@orgs.invalid`, name: str(b.name, 60, 'a name', 2), pw: '!', role: 'member', kind: 'org',
        website: b.website ? httpsOrNull(b.website) : null, country: person.country, created: now() };
      db.insert('accounts', org);
      db.insert('members', { org_id: org.id, account_id: person.id, role: 'admin', created: now() });
      db.run('UPDATE sessions SET org_id = ? WHERE id = ?', org.id, sessionId);
      return send(res, 201, { org: { id: org.id, name: org.name } });
    }
    if (p === '/v1/orgs/switch' && m === 'POST') {
      const to = String(b.id ?? '');
      if (to !== person.id && !db.get('SELECT 1 FROM members WHERE org_id = ? AND account_id = ?', to, person.id)) throw httpError(404, 'No such organization');
      if (!sessionId) throw httpError(400, 'Sign in with your password to switch');
      db.run('UPDATE sessions SET org_id = ? WHERE id = ?', to, sessionId);
      return send(res, 200, { ok: true });
    }
    if (p === '/v1/org' && m === 'PATCH') {
      const o = {};
      if (b.setup_hidden !== undefined) o.setup_hidden = b.setup_hidden ? 1 : 0;
      if (b.name !== undefined || b.website !== undefined) {
        adminOnly(a);
        if (b.name !== undefined) o.name = str(b.name, 60, 'a name', 2);
        if (b.website !== undefined) o.website = b.website ? httpsOrNull(b.website) : null;
      }
      db.patch('accounts', a.id, o);
      return send(res, 200, { ok: true });
    }
    // the team
    if (p === '/v1/team' && m === 'GET') {
      const owner = a.kind === 'org' ? [] : [{ id: a.id, name: a.name, email: a.email, role: 'admin', owner: true }];
      return send(res, 200, {
        members: [...owner, ...db.all('SELECT x.id, x.name, x.email, m.role FROM members m JOIN accounts x ON x.id = m.account_id WHERE m.org_id = ? AND m.account_id <> ? ORDER BY m.created', a.id, a.id)],
        invites: db.all('SELECT id, email, role, created FROM invites WHERE org_id = ? ORDER BY created', a.id), you: person.id });
    }
    if (p === '/v1/team' && m === 'POST') {
      adminOnly(a);
      const email = String(b.email ?? '').trim().toLowerCase();
      if (!EMAIL_RE.test(email)) throw httpError(400, 'Use a real email address');
      const role = b.role === 'admin' ? 'admin' : 'member';
      const x = db.get(`SELECT id FROM accounts WHERE email = ? AND kind <> 'org'`, email);
      if (x?.id === a.id) throw httpError(400, 'That is this account itself');
      if (x) { db.run('INSERT OR REPLACE INTO members (org_id, account_id, role, created) VALUES (?, ?, ?, ?)', a.id, x.id, role, now()); return send(res, 201, { added: true }); }
      db.run('INSERT OR REPLACE INTO invites (id, org_id, email, role, created) VALUES (?, ?, ?, ?, ?)', id('inv'), a.id, email, role, now());
      return send(res, 201, { invited: true });
    }
    if ((mm = p.match(/^\/v1\/team\/(\w+)\/remove$/)) && m === 'POST') {
      if (mm[1] !== person.id) adminOnly(a);
      db.run('DELETE FROM members WHERE org_id = ? AND account_id = ?', a.id, mm[1]);
      db.run('DELETE FROM invites WHERE org_id = ? AND id = ?', a.id, mm[1]);
      return send(res, 200, { ok: true });
    }
    // the person's own settings
    if (p === '/v1/me' && m === 'PATCH') {
      db.patch('accounts', person.id, { name: str(b.name, 60, 'your name', 1) });
      return send(res, 200, { ok: true });
    }
    if (p === '/v1/me/password' && m === 'POST') {
      if (!checkPassword(b.current, person.pw)) throw httpError(400, 'Your current password is not right');
      if (String(b.password ?? '').length < 12) throw httpError(400, 'Use a new password of 12 characters or more');
      db.patch('accounts', person.id, { pw: hashPassword(b.password) });
      db.run('DELETE FROM sessions WHERE account_id = ? AND id <> ?', person.id, sessionId ?? '');
      return send(res, 200, { ok: true });
    }
    if (p === '/v1/me/2fa/start' && m === 'POST') {
      if (person.totp_on) throw httpError(409, 'Two-step sign-in is already on');
      const secret = base32(randomBytes(20));
      db.patch('accounts', person.id, { totp: secret });
      return send(res, 200, { secret, uri: `otpauth://totp/${encodeURIComponent(`${cfg.brand}:${person.email}`)}?secret=${secret}&issuer=${encodeURIComponent(cfg.brand)}` });
    }
    if (p === '/v1/me/2fa/enable' && m === 'POST') {
      if (!totpOk(person.totp, b.code)) throw httpError(400, 'That code did not match; try the newest one');
      db.patch('accounts', person.id, { totp_on: 1 });
      return send(res, 200, { ok: true });
    }
    if (p === '/v1/me/2fa/disable' && m === 'POST') {
      if (!totpOk(person.totp, b.code)) throw httpError(400, 'That code did not match');
      db.patch('accounts', person.id, { totp_on: 0, totp: null });
      return send(res, 200, { ok: true });
    }
    // the organization's server key: one at a time, shown once, rotated by making a new one
    if (p === '/v1/org/key' && m === 'GET') {
      const k = db.get(`SELECT id, created FROM api_keys WHERE account_id = ? AND label = 'Organization key'`, a.id);
      return send(res, 200, { key: k ?? null });
    }
    if (p === '/v1/org/key/rotate' && m === 'POST') {
      adminOnly(a);
      const k = `isk_${token(24)}`;
      db.tx(() => {
        db.run(`DELETE FROM api_keys WHERE account_id = ? AND label = 'Organization key'`, a.id);
        db.insert('api_keys', { id: id('key'), account_id: a.id, hash: sha(k), label: 'Organization key', created: now() });
      });
      return send(res, 200, { key: k });
    }
    // Slack
    if (p === '/v1/org/slack' && m === 'POST') {
      adminOnly(a);
      const url = slackUrl(b.url);
      db.patch('accounts', a.id, { slack_url: url });
      if (url) await notify(a.id, `${cfg.brand} is connected. You will get a note here when someone books your space, when an ad is approved and when a campaign runs out of budget.`);
      return send(res, 200, { ok: true, connected: !!url });
    }
    // support
    if (p === '/v1/support' && m === 'POST') {
      if (!CATEGORIES.includes(b.category)) throw httpError(400, 'Pick a category');
      const t = { id: id('tk'), account_id: a.id, actor_id: person.id, subject: str(b.subject, 120, 'a subject', 3), category: b.category, body: str(b.body, 4000, 'what happened', 5), status: 'open', created: now() };
      db.insert('tickets', t);
      return send(res, 201, { ticket: { id: t.id } });
    }
    // ad groups
    if (p === '/v1/groups' && m === 'POST') {
      const c = db.get('SELECT id FROM campaigns WHERE id = ? AND account_id = ?', b.campaign_id, a.id);
      if (!c) throw httpError(404, 'No such campaign');
      const g = { id: id('ag'), campaign_id: c.id, account_id: a.id, name: str(b.name, 80, 'a name', 1), status: 'active', audience_id: ownAudience(a, b.audience_id), created: now() };
      db.insert('ad_groups', g);
      return send(res, 201, { group: g });
    }
    if ((mm = p.match(/^\/v1\/groups\/(\w+)$/)) && m === 'PATCH') {
      const g = db.get('SELECT * FROM ad_groups WHERE id = ? AND account_id = ?', mm[1], a.id);
      if (!g) throw httpError(404, 'No such ad group');
      const o = {};
      if (b.name !== undefined) o.name = str(b.name, 80, 'a name', 1);
      if (b.status !== undefined) { if (!['active', 'paused'].includes(b.status)) throw httpError(400, 'Bad status'); o.status = b.status; }
      if (b.audience_id !== undefined) o.audience_id = ownAudience(a, b.audience_id);
      db.patch('ad_groups', g.id, o);
      return send(res, 200, { group: { ...g, ...o } });
    }
    // audiences and lists
    if (p === '/v1/audiences' && m === 'GET') {
      return send(res, 200, {
        audiences: db.all('SELECT * FROM audiences WHERE account_id = ? ORDER BY created DESC', a.id).map((x) => ({ ...x, include: json(x.include, []), exclude: json(x.exclude, []), lists: json(x.lists, []),
          groups: db.get('SELECT COUNT(*) n FROM ad_groups WHERE audience_id = ?', x.id).n })),
        lists: db.all('SELECT id, name, kind, items, created FROM lists WHERE account_id = ? ORDER BY created DESC', a.id).map((l) => ({ ...l, count: l.items.split('\n').filter(Boolean).length })),
        reach: reach(a) });
    }
    if (p === '/v1/audiences' && m === 'POST') {
      const conds = (v) => (Array.isArray(v) ? v : []).slice(0, 20).map((c) => {
        if (!FIELDS.includes(c?.field)) throw httpError(400, 'Pick what each condition looks at');
        return { field: c.field, value: str(c.value, 200, 'a value', 1) };
      });
      const lists = (Array.isArray(b.lists) ? b.lists : []).slice(0, 10).map((l) => {
        if (!db.get('SELECT 1 FROM lists WHERE id = ? AND account_id = ?', l?.id, a.id)) throw httpError(400, 'Pick one of your lists');
        return { id: l.id, exclude: !!l.exclude };
      });
      const include = conds(b.include), exclude = conds(b.exclude);
      if (!include.length && !exclude.length && !lists.length) throw httpError(400, 'Add at least one condition or list');
      const x = { id: id('au'), account_id: a.id, name: str(b.name, 80, 'a name', 1), match: b.match === 'all' ? 'all' : 'any',
        include: JSON.stringify(include), exclude: JSON.stringify(exclude), lists: JSON.stringify(lists), created: now() };
      db.insert('audiences', x);
      return send(res, 201, { audience: { id: x.id } });
    }
    if ((mm = p.match(/^\/v1\/audiences\/(\w+)\/delete$/)) && m === 'POST') {
      db.run('UPDATE ad_groups SET audience_id = NULL WHERE audience_id = ? AND account_id = ?', mm[1], a.id);
      db.run('DELETE FROM audiences WHERE id = ? AND account_id = ?', mm[1], a.id);
      return send(res, 200, { ok: true });
    }
    if (p === '/v1/lists' && m === 'POST') {
      if (!['sites', 'topics'].includes(b.kind)) throw httpError(400, 'Pick sites or topics');
      const items = String(b.items ?? '').split(/[\n,]+/).map((x) => x.trim().toLowerCase().replace(/^https?:\/\//, '').replace(/\/.*$/, '')).filter(Boolean);
      if (items.some((x) => EMAIL_RE.test(x))) throw httpError(400, 'Lists hold sites or topics, never email addresses');
      if (!items.length) throw httpError(400, 'Add at least one site or topic');
      const l = { id: id('ls'), account_id: a.id, name: str(b.name, 80, 'a name', 1), kind: b.kind, items: [...new Set(items)].slice(0, 5000).join('\n'), created: now() };
      db.insert('lists', l);
      return send(res, 201, { list: { id: l.id } });
    }
    if ((mm = p.match(/^\/v1\/lists\/(\w+)\/delete$/)) && m === 'POST') {
      db.run('DELETE FROM lists WHERE id = ? AND account_id = ?', mm[1], a.id);
      return send(res, 200, { ok: true });
    }
    // events
    if (p === '/v1/events' && m === 'POST') {
      let adId = '';
      if (b.ref) { const r = unsign(String(b.ref), cfg.key); const ad = r?.a && db.get('SELECT id FROM ads WHERE id = ? AND account_id = ?', r.a, a.id); if (ad) adId = ad.id; }
      record(a.id, { name: b.event, adId, value: b.value, currency: b.currency, n: b.count, source: 'server' });
      return send(res, 201, { ok: true, matched: !!adId });
    }
    if (p === '/v1/events' && m === 'GET') {
      const days = Math.max(1, Math.min(int(q.get('days'), 30), 365)), hourly = q.get('by') === 'hour';
      const to = q.get('to') && /^\d{4}-\d\d-\d\d$/.test(q.get('to')) ? q.get('to') : dayOf(now());
      const from = q.get('from') && /^\d{4}-\d\d-\d\d$/.test(q.get('from')) ? q.get('from') : dayOf(Date.parse(to) - (days - 1) * DAY);
      const rows = db.all(`SELECT ${hourly ? 'hour' : 'substr(hour,1,10)'} k, name, SUM(n) n FROM events WHERE account_id = ? AND hour >= ? AND hour < ? GROUP BY k, name ORDER BY k`, a.id, from, `${to}T99`);
      const clicks = db.all(`SELECT st.day k, SUM(st.clicks) n FROM stats st JOIN ads x ON x.id = st.ad_id WHERE x.account_id = ? AND st.day >= ? AND st.day <= ? GROUP BY st.day`, a.id, from, to);
      return send(res, 200, { from, to, rows, clicks,
        sources: Object.fromEntries(db.all('SELECT source, last_at FROM event_sources WHERE account_id = ?', a.id).map((r) => [r.source, r.last_at])),
        recent: db.all(`SELECT e.hour, e.name, e.n, e.value, e.currency, x.sponsor, x.title FROM events e LEFT JOIN ads x ON x.id = e.ad_id WHERE e.account_id = ? ORDER BY e.hour DESC LIMIT 20`, a.id) });
    }
    // the dashboard's numbers, and the campaign tables with their numbers
    if (p === '/v1/overview' && m === 'GET') {
      const { from, to, currency } = range(a, q);
      const mt = metrics(a.id, from, to, currency);
      return send(res, 200, { from, to, currency, ...mt, setup: setup(a), currencies: currenciesOf(a) });
    }
    if (p === '/v1/ads/all' && m === 'GET') {
      const { from, to, currency } = range(a, q);
      const mt = metrics(a.id, from, to, currency);
      const campaigns = db.all('SELECT * FROM campaigns WHERE account_id = ? ORDER BY created DESC', a.id);
      const groups = db.all('SELECT g.*, au.name audience FROM ad_groups g LEFT JOIN audiences au ON au.id = g.audience_id WHERE g.account_id = ? ORDER BY g.created DESC', a.id);
      const ads = db.all('SELECT * FROM ads WHERE account_id = ? ORDER BY created DESC', a.id).map(({ image, ...x }) => ({ ...x, image_url: imageUrl(image) }));
      const bookings = db.all(`SELECT b.ad_id, COUNT(*) n FROM bookings b WHERE b.account_id = ? AND b.status IN ('paid','live','settled') GROUP BY b.ad_id`, a.id);
      return send(res, 200, { from, to, currency, campaigns, groups, ads, by: mt.by, booked: Object.fromEntries(bookings.map((r) => [r.ad_id, r.n])), currencies: currenciesOf(a) });
    }
    return undefined;
  }

  function httpsOrNull(v) {
    let s = String(v ?? '').trim();
    if (!s) return null;
    if (!/^https?:\/\//i.test(s)) s = `https://${s}`;
    try { const u = new URL(s); if (!/^https?:$/.test(u.protocol)) throw 0; return u.toString().replace(/\/$/, ''); } catch { throw httpError(400, 'Use a web address like https://yourbrand.com'); }
  }
  function ownAudience(a, v) {
    if (!v) return null;
    if (!db.get('SELECT 1 FROM audiences WHERE id = ? AND account_id = ?', v, a.id)) throw httpError(400, 'Pick one of your audiences');
    return v;
  }
  function currenciesOf(a) {
    return db.all(`SELECT currency FROM (SELECT currency FROM campaigns WHERE account_id = ? UNION SELECT currency FROM bookings WHERE account_id = ?
      UNION SELECT currency FROM ledger WHERE account_id = ?)`, a.id, a.id, a.id).map((r) => r.currency);
  }
  function range(a, q) {
    const ok = (v) => (v && /^\d{4}-\d\d-\d\d$/.test(v) ? v : null);
    const to = ok(q.get('to')) ?? dayOf(now());
    const from = ok(q.get('from')) ?? dayOf(Date.parse(to) - 29 * DAY);
    if (Date.parse(to) - Date.parse(from) > 400 * DAY || from > to) throw httpError(400, 'Pick a range of a year or less');
    const list = currenciesOf(a);
    const currency = String(q.get('currency') || (list.includes('USD') ? 'USD' : list[0]) || 'USD').toUpperCase();
    return { from, to, currency };
  }
  /** How many places an audience could reach: counts of open slots by kind and country, for the audience builder. */
  function reach() {
    return db.all(`SELECT p.kind, p.country, COUNT(*) n FROM slots s JOIN properties p ON p.id = s.property_id
      WHERE s.status = 'active' AND p.status = 'active' AND s.network = 1 GROUP BY p.kind, p.country`);
  }

  return { actAs, orgsOf, orgPub, personPub, acceptInvites, notify, groupOk, withRef, clickRef, tagEvent, record, metrics, setup, route, CATEGORIES };
}
