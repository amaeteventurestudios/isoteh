// Sign-in through Onyx (Google or an email code): Onyx is stood in for by a fetch stub that answers like the real one.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { start } from './helpers.mjs';

const CORE = 'http://onyx.test';
function onyxStub(people) {  // people: email -> { id, name }
  const json = (status, body) => new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });
  return async (url, init) => {
    if (!String(url).startsWith(CORE)) return fetch(url, init);
    const path = new URL(url).pathname;
    if (path === '/token') return json(400, { error: 'invalid_grant' });
    const b = JSON.parse(init.body);
    if (b.client_id !== 'isoteh' || b.client_secret !== 'isoteh-test-secret-0123') return json(401, { error: { code: 'BAD_CLIENT', message: 'Unknown client' } });
    if (path === '/v1/signin/email/start') return json(200, { masked: 'a***@x.test' });
    if (path === '/v1/signin/email/verify') {
      if (b.code !== '424242') return json(400, { error: { code: 'WRONG_CODE', message: 'That code is not right.' } });
      const p = people[b.email];
      return p.name ? json(200, { user: { id: p.id, email: b.email, display_name: p.name }, needs_profile: false })
        : json(200, { user: { id: p.id, email: b.email, display_name: '' }, needs_profile: true, ticket: `t:${b.email}` });
    }
    if (path === '/v1/signin/profile') {
      const email = b.ticket.slice(2), p = people[email]; p.name = b.display_name;
      return json(200, { user: { id: p.id, email, display_name: p.name }, needs_profile: false });
    }
    return json(404, {});
  };
}
const ENV = { ONYX_CLIENT_SECRET: 'isoteh-test-secret-0123', ONYX_CORE_URL: CORE, ONYX_PUBLIC_URL: 'https://accounts.test' };

test('a new person signs up with an email code and a name, and is signed in', async () => {
  const s = await start(ENV, { fetch: onyxStub({ 'kemi@shop.test': { id: 'ox1' } }) });
  try {
    const b = s.browser();
    assert.equal((await b.get('/v1/auth/onyx/config')).json.on, true);
    assert.equal((await b.post('/v1/auth/onyx/email-start', { email: 'kemi@shop.test' })).status, 200);
    assert.equal((await b.post('/v1/auth/onyx/email-verify', { email: 'kemi@shop.test', code: '000000' })).status, 400);
    const v = (await b.post('/v1/auth/onyx/email-verify', { email: 'kemi@shop.test', code: '424242' })).json;
    assert.equal(v.needs_profile, true);
    const p = (await b.post('/v1/auth/onyx/profile', { ticket: v.ticket, name: 'Kemi Stores', handle: '@kemi' })).json;
    assert.equal(p.me.email, 'kemi@shop.test');
    assert.equal(p.me.name, 'Kemi Stores');
    assert.equal((await b.get('/v1/me')).json.me.email, 'kemi@shop.test', 'the session works');
    // a second sign-in lands on the same account
    const c = s.browser();
    assert.equal((await c.post('/v1/auth/onyx/email-verify', { email: 'kemi@shop.test', code: '424242' })).json.me.id, p.me.id);
  } finally { await s.stop(); }
});

test('an existing password account is found by email and keeps its data; the old password stops working', async () => {
  const s = await start(ENV, { fetch: onyxStub({ 'owner@blog.test': { id: 'ox2', name: 'Chioma' } }) });
  try {
    const old = s.browser();
    const me = (await old.signup('owner@blog.test', 'Chioma', 'old password 123')).json.me;
    const prop = (await old.post('/v1/properties', { kind: 'site', name: 'Food Blog', url: 'https://food.test', currency: 'NGN', country: 'NG' })).json.property;
    const b = s.browser();
    const v = (await b.post('/v1/auth/onyx/email-verify', { email: 'owner@blog.test', code: '424242' })).json;
    assert.equal(v.me.id, me.id);
    assert.ok((await b.get('/v1/properties')).json.properties.some((x) => x.id === prop.id));
    assert.equal((await s.browser().post('/v1/auth/login', { email: 'owner@blog.test', password: 'old password 123' })).status, 401);
  } finally { await s.stop(); }
});

test('sign-up closed: Onyx can sign existing people in but makes no new accounts', async () => {
  const s = await start({ ...ENV, ISOTEH_SIGNUP: 'off' }, { fetch: onyxStub({ 'first@x.test': { id: 'ox3', name: 'First' }, 'new@x.test': { id: 'ox4', name: 'New' } }) });
  try {
    await s.browser().signup('first@x.test', 'First');
    assert.equal((await s.browser().post('/v1/auth/onyx/email-verify', { email: 'first@x.test', code: '424242' })).status, 200);
    assert.equal((await s.browser().post('/v1/auth/onyx/email-verify', { email: 'new@x.test', code: '424242' })).status, 403);
  } finally { await s.stop(); }
});

test('Google: off without the secret; with it, to Onyx with PKCE, and a return without the cookie fails safely', async () => {
  const off = await start();
  try { assert.equal((await off.browser().get('/v1/auth/onyx/config')).json.on, false); assert.equal((await off.browser().get('/v1/auth/onyx/google')).status, 503); }
  finally { await off.stop(); }
  const s = await start(ENV, { fetch: onyxStub({}) });
  try {
    const r = await s.browser().get('/v1/auth/onyx/google');
    assert.equal(r.status, 303);
    const to = new URL(r.location);
    assert.equal(to.origin + to.pathname, 'https://accounts.test/authorize');
    assert.equal(to.searchParams.get('redirect_uri'), `${s.base}/v1/auth/onyx/return`);
    assert.match(to.searchParams.get('code_challenge'), /^[A-Za-z0-9_-]{43}$/);
    assert.match(r.headers.get('set-cookie'), /is_ox=.+HttpOnly/);
    assert.equal((await s.browser().get('/v1/auth/onyx/return?code=x&state=y')).location, '/app/#onyx=failed');
  } finally { await s.stop(); }
});
