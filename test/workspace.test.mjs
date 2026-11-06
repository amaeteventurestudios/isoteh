// The advertiser workspace: organizations and their team, two-step sign-in, audiences by context, events after a click,
// and the dashboard's numbers.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { start, image, UA } from './helpers.mjs';
import { totp } from '../lib/workspace.mjs';

test('organizations, team invites and switching', async () => {
  const s = await start();
  try {
    const ada = s.browser(), ben = s.browser();
    await ada.signup('ada@brand.test', 'Ada');
    const org = (await ada.post('/v1/orgs', { name: 'Juniper Coffee', website: 'juniper.test' })).json.org;
    let w = (await ada.get('/v1/workspace')).json;
    assert.equal(w.org.name, 'Juniper Coffee');
    assert.equal(w.org.website, 'https://juniper.test');
    assert.equal(w.orgs.length, 2);
    // an invite waits for the email to sign up, then the person is in
    assert.equal((await ada.post('/v1/team', { email: 'ben@brand.test' })).json.invited, true);
    await ben.signup('ben@brand.test', 'Ben');
    w = (await ben.get('/v1/workspace')).json;
    assert.ok(w.orgs.find((o) => o.id === org.id));
    assert.equal((await ben.post('/v1/orgs/switch', { id: org.id })).status, 200);
    assert.equal((await ben.get('/v1/workspace')).json.org.id, org.id);
    // a member can't rename it; an admin can; nobody can sign in as the org itself
    assert.equal((await ben.patch('/v1/org', { name: 'Mine now' })).status, 403);
    assert.equal((await ada.patch('/v1/org', { name: 'Juniper Coffee Co' })).status, 200);
    // what the org buys is shared: Ben sees Ada's campaign
    await ada.post('/v1/campaigns', { name: 'Autumn', currency: 'USD' });
    assert.equal((await ben.get('/v1/campaigns')).json.campaigns.length, 1);
    // someone outside can't switch into it
    const eve = s.browser(); await eve.signup('eve@x.test', 'Eve');
    assert.equal((await eve.post('/v1/orgs/switch', { id: org.id })).status, 404);
    assert.equal((await ada.post('/v1/org/slack', { url: 'https://evil.test/hook' })).status, 400);
    assert.equal((await ada.post('/v1/support', { subject: 'Help', category: 'Billing', body: 'Where is my invoice?' })).status, 201);
  } finally { await s.stop(); }
});

test('password change and two-step sign-in', async () => {
  const s = await start();
  try {
    const a = s.browser();
    await a.signup('kofi@x.test', 'Kofi', 'first password 1');
    assert.equal((await a.post('/v1/me/password', { current: 'wrong', password: 'second password 22' })).status, 400);
    assert.equal((await a.post('/v1/me/password', { current: 'first password 1', password: 'second password 22' })).status, 200);
    const { secret } = (await a.post('/v1/me/2fa/start')).json;
    assert.equal((await a.post('/v1/me/2fa/enable', { code: '000000' })).status, 400);
    assert.equal((await a.post('/v1/me/2fa/enable', { code: totp(secret) })).status, 200);
    const b = s.browser();
    const r = await b.post('/v1/auth/login', { email: 'kofi@x.test', password: 'second password 22' });
    assert.equal(r.status, 401); assert.equal(r.json.need_code, true);
    assert.equal((await b.post('/v1/auth/login', { email: 'kofi@x.test', password: 'second password 22', code: totp(secret) })).status, 200);
  } finally { await s.stop(); }
});

test('audiences pick places by context; events count against the clicked ad', async () => {
  const s = await start();
  try {
    const owner = s.browser(), buyer = s.browser();
    await owner.signup('owner@x.test', 'Owner');
    await buyer.signup('buy@x.test', 'Buyer');
    const food = (await owner.post('/v1/properties', { kind: 'site', name: 'Food', url: 'https://food.test', keywords: 'food', country: 'US', currency: 'USD' })).json.property;
    const cars = (await owner.post('/v1/properties', { kind: 'site', name: 'Cars', url: 'https://cars.test', keywords: 'cars', country: 'US', currency: 'USD' })).json.property;
    const mk = async (p) => (await owner.post('/v1/slots', { property_id: p.id, name: 'Side', format: 'banner', width: 300, height: 250, network: true, booking_open: false })).json.slot;
    const sf = await mk(food), sc = await mk(cars);
    await owner.post('/v1/topups', { amount: 0, currency: 'USD' }).catch(() => {});
    const au = (await buyer.post('/v1/audiences', { name: 'Not cars', match: 'any', include: [], exclude: [{ field: 'site', value: 'cars.test' }] })).json.audience;
    const camp = (await buyer.post('/v1/campaigns', { name: 'CPM', currency: 'USD', budget: 10_000, cpm: 2_000 })).json.campaign;
    const g = (await buyer.post('/v1/groups', { campaign_id: camp.id, name: 'Main', audience_id: au.id })).json.group;
    const ad = (await buyer.post('/v1/ads', { campaign_id: camp.id, group_id: g.id, kind: 'image', sponsor: 'Juniper', url: 'https://juniper.test/', image: image() })).json.ad;
    await owner.post(`/v1/staff/ads/${ad.id}/review`, { decision: 'approved' });
    // give the buyer credit and start the campaign
    const pay = (await buyer.post('/v1/topups', { amount: 20_000, currency: 'USD', provider: 'manual' })).json;
    await owner.post(`/v1/staff/payments/${pay.ref}/paid`);
    assert.equal((await buyer.patch(`/v1/campaigns/${camp.id}`, { status: 'active' })).status, 200);

    const onFood = (await buyer.get(`/v1/ad?slot=${sf.id}`)).json;
    assert.equal(onFood.source, 'network');
    assert.equal((await buyer.get(`/v1/ad?slot=${sc.id}`)).json.ad, null);   // left out by the audience

    // the click carries a reference for that ad and day; the browser tag counts a purchase with it
    const c = await buyer.get(onFood.click.replace(s.base, ''));
    const ref = new URL(c.location).searchParams.get('isoteh_ref');
    assert.ok(ref);
    const e = await fetch(`${s.base}/t/e`, { method: 'POST', headers: { 'user-agent': UA, 'content-type': 'text/plain' }, body: JSON.stringify({ ref, event: 'purchase', value: 4500, currency: 'USD' }) });
    assert.equal(e.headers.get('x-counted'), '1');
    const bad = await fetch(`${s.base}/t/e`, { method: 'POST', headers: { 'user-agent': UA }, body: JSON.stringify({ ref: 'nope', event: 'purchase' }) });
    assert.equal(bad.headers.get('x-counted'), '0');
    const ev = (await buyer.get('/v1/events?days=7')).json;
    assert.equal(ev.rows.find((r) => r.name === 'purchase').n, 1);
    assert.ok(ev.sources.tag);
    const ov = (await buyer.get('/v1/overview')).json;
    assert.equal(ov.total.conversions, 1);
    assert.equal(ov.total.value, 4500);
    assert.equal(ov.setup.tracking, true);
    assert.equal(ov.setup.launched, true);
    const all = (await buyer.get('/v1/ads/all')).json;
    assert.equal(all.by.group[g.id].conversions, 1);
    assert.equal(all.groups[0].audience, 'Not cars');
    assert.equal((await buyer.post('/v1/lists', { name: 'People', kind: 'sites', items: 'a@b.test' })).status, 400);   // never people
  } finally { await s.stop(); }
});
