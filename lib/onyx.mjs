// Sign-in through Onyx, the studio's shared accounts: Continue with Google, or a 6-digit code by email, on Isoteh's own
// sign-in page. Onyx proves who the person is; Isoteh finds their account (by Onyx id, then by the email they signed up
// with here) or makes one, then starts its own session as a password sign-in would. Authenticator codes still apply.
//   POST /v1/auth/onyx/email-start  { email }
//   POST /v1/auth/onyx/email-verify { email, code }        -> { me } | { needs_profile, ticket } | { need_code, ticket }
//   POST /v1/auth/onyx/profile      { ticket, name, handle } -> same
//   POST /v1/auth/onyx/2fa          { ticket, code }        -> { me }
//   GET  /v1/auth/onyx/google                               -> Google through Onyx, back to /v1/auth/onyx/return
//   GET  /v1/auth/onyx/return                               -> /app/ (or /app/#onyx=profile:<ticket> / 2fa:<ticket>)
import { createHash, randomBytes } from 'node:crypto';
import { id, now, token, sign, unsign, hashPassword, cookies, setCookie, body, httpError, limited, EMAIL_RE } from './util.mjs';
import { totpOk } from './workspace.mjs';

export function makeOnyx({ cfg, db, startSession, acceptInvites, pub, send, who, fetch = globalThis.fetch }) {
  const O = cfg.onyx;
  const on = () => (O.secret || '').length >= 16;
  const returnUri = `${cfg.publicUrl}/v1/auth/onyx/return`;
  const key = createHash('sha256').update(`${cfg.key.toString('hex')}:onyx`).digest();

  async function call(path, b) {
    const r = await fetch(O.core + path, { method: 'POST', headers: { 'content-type': 'application/json' }, signal: AbortSignal.timeout(15_000),
      body: JSON.stringify({ ...b, client_id: O.client, client_secret: O.secret }) });
    return { status: r.status, body: await r.json().catch(() => ({})) };
  }
  const fail = (r) => { throw httpError(r.status >= 400 ? r.status : 502, r.body?.error?.message || 'Sign-in is not answering. Try again in a minute.'); };

  // The Isoteh account for an Onyx person
  function accountFor(user) {
    const email = String(user.email ?? '').trim().toLowerCase();
    let a = db.get('SELECT * FROM accounts WHERE onyx_id = ?', user.id);
    if (!a && email) a = db.get("SELECT * FROM accounts WHERE email = ? AND kind != 'org'", email);
    if (!a) {
      if (!EMAIL_RE.test(email)) throw httpError(400, 'Your account has no email we can use. Try the email code instead.');
      const first = !db.get('SELECT 1 FROM accounts LIMIT 1');
      if (!cfg.signupOpen && !first) throw httpError(403, 'Sign-up is closed for now');
      a = { id: id('ac'), email, name: String(user.display_name || email.split('@')[0]).slice(0, 60), pw: hashPassword(token(24)),
        role: (cfg.adminEmail ? email === cfg.adminEmail : first && cfg.mode !== 'production') ? 'admin' : 'member', country: null, created: now(), onyx_id: user.id };
      db.insert('accounts', a);
    } else if (!a.onyx_id) {
      // First time this account meets Onyx. Isoteh never proved who made it, so from now on only the person who just
      // proved the email gets in: the old password is replaced (a stranger who signed up first with their address loses it).
      db.run('UPDATE accounts SET onyx_id = ?, pw = ? WHERE id = ?', user.id, hashPassword(token(24)), a.id);
      a = db.get('SELECT * FROM accounts WHERE id = ?', a.id);
    }
    return a;
  }
  // Onyx said who it is: sign in, or ask for the authenticator code first
  function finish(res, user) {
    const a = accountFor(user);
    if (a.totp_on) return { need_code: true, ticket: sign({ a: a.id, t: '2fa', exp: now() + 10 * 60_000 }, key) };
    acceptInvites(a);
    startSession(res, a.id);
    return { me: pub(a) };
  }
  function after(res, r) {
    if (r.status !== 200) fail(r);
    if (r.body.needs_profile) return { needs_profile: true, ticket: r.body.ticket, suggest: r.body.user?.display_name ?? '' };
    return finish(res, r.body.user);
  }
  const b64u = (buf) => Buffer.from(buf).toString('base64url');

  return async function route(req, res, p, m, q) {
    if (!p.startsWith('/v1/auth/onyx/')) return false;
    const act = p.slice('/v1/auth/onyx/'.length);
    if (act === 'config' && m === 'GET') return send(res, 200, { on: on() }), true;
    if (!on()) throw httpError(503, 'Google and email-code sign-in are not switched on here yet');

    if (act === 'google' && m === 'GET') {
      const verifier = b64u(randomBytes(48)), state = b64u(randomBytes(12));
      setCookie(res, 'is_ox', sign({ v: verifier, s: state, exp: now() + 15 * 60_000 }, key), { maxAge: 900, secure: cfg.secure, path: '/v1/auth/onyx/' });
      const u = new URLSearchParams({ response_type: 'code', client_id: O.client, redirect_uri: returnUri, state, via: 'google',
        code_challenge: b64u(createHash('sha256').update(verifier).digest()), code_challenge_method: 'S256' });
      res.writeHead(303, { location: `${O.pub}/authorize?${u}`, 'cache-control': 'no-store' }); res.end(); return true;
    }
    if (act === 'return' && m === 'GET') {
      const f = unsign(cookies(req).is_ox, key);
      setCookie(res, 'is_ox', '', { maxAge: 0, secure: cfg.secure, path: '/v1/auth/onyx/' });
      const go = (to) => { res.writeHead(303, { location: to, 'cache-control': 'no-store' }); res.end(); return true; };
      if (!f || f.exp < now() || q.get('state') !== f.s || !q.get('code')) return go('/app/#onyx=failed');
      const r = await fetch(`${O.core}/token`, { method: 'POST', headers: { 'content-type': 'application/x-www-form-urlencoded' }, signal: AbortSignal.timeout(15_000),
        body: new URLSearchParams({ grant_type: 'authorization_code', code: q.get('code'), redirect_uri: returnUri, code_verifier: f.v, client_id: O.client, client_secret: O.secret }) }).catch(() => null);
      const j = r ? await r.json().catch(() => ({})) : {};
      if (!r?.ok || !j.user) return go('/app/#onyx=failed');
      if (j.needs_profile) return go(`/app/#onyx=profile:${encodeURIComponent(j.ticket)}`);
      try { const out = finish(res, j.user); return go(out.need_code ? `/app/#onyx=2fa:${encodeURIComponent(out.ticket)}` : '/app/'); }
      catch (e) { return go(`/app/#onyx=failed:${encodeURIComponent(e.message)}`); }
    }
    if (m !== 'POST') return false;
    const b = await body(req);
    if (act === 'email-start') {
      if (limited(`ox:${who(req)}`, 10, 600_000)) throw httpError(429, 'Too many codes asked for. Wait a few minutes.');
      const r = await call('/v1/signin/email/start', { email: String(b.email ?? ''), ip: who(req) });
      if (r.status !== 200) fail(r);
      return send(res, 200, { sent: true, masked: r.body.masked }), true;
    }
    if (act === 'email-verify') return send(res, 200, after(res, await call('/v1/signin/email/verify', { email: String(b.email ?? ''), code: String(b.code ?? ''), ip: who(req) }))), true;
    if (act === 'profile') return send(res, 200, after(res, await call('/v1/signin/profile', { ticket: String(b.ticket ?? ''), display_name: String(b.name ?? ''), handle: String(b.handle ?? '').replace(/^@/, '') }))), true;
    if (act === '2fa') {
      const t = unsign(String(b.ticket ?? ''), key);
      if (!t || t.t !== '2fa' || t.exp < now()) throw httpError(400, 'That sign-in has run out. Please start again.');
      const a = db.get('SELECT * FROM accounts WHERE id = ?', t.a);
      if (!a || limited(`2fa:${a.id}`, 8, 900_000) || !totpOk(a.totp, b.code)) throw httpError(401, 'That code did not match');
      acceptInvites(a); startSession(res, a.id);
      return send(res, 200, { me: pub(a) }), true;
    }
    return false;
  };
}
