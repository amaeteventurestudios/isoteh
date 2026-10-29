// The whole path: an owner lists a slot, an advertiser books it and pays, the ad runs, views and clicks count once,
// and the owner is paid automatically.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { start, image, UA } from './helpers.mjs';

const DAY = 86_400_000;

test('direct booking: list, book, accept, pay, run, count, settle', async () => {
  const s = await start();
  try {
    const owner = s.browser(), buyer = s.browser();
    assert.equal((await owner.signup('owner@blog.test', 'Chioma')).json.me.role, 'admin');   // the first account runs the place
    assert.equal((await buyer.signup('ads@suya.test', 'Suya Spot')).json.me.role, 'member');

    const prop = (await owner.post('/v1/properties', { kind: 'site', name: 'Lagos Food Blog', url: 'https://food.test', keywords: 'food, lagos', currency: 'NGN', audience: 40000, country: 'NG' })).json.property;
    const slot = (await owner.post('/v1/slots', { property_id: prop.id, name: 'Sidebar', format: 'banner', width: 300, height: 250, price_day: 500000, booking_open: true, approve: true })).json.slot;
    const snips = (await owner.get(`/v1/slots/${slot.id}/snippets`)).json.snippets;
    assert.ok(snips.find((x) => x.where === 'WordPress').code.includes(slot.id));

    // a free slot offers itself
    let ad = (await buyer.get(`/v1/ad?slot=${slot.id}`)).json;
    assert.equal(ad.ad, null);
    assert.match(ad.open.url, new RegExp(`/book/${slot.id}$`));

    const camp = (await buyer.post('/v1/campaigns', { name: 'Launch', currency: 'NGN' })).json.campaign;
    const created = await buyer.post('/v1/ads', { campaign_id: camp.id, kind: 'image', sponsor: 'Suya Spot', title: 'Best suya in Yaba', url: 'https://suya.test/menu', image: image() });
    assert.equal(created.status, 201, JSON.stringify(created.json));
    assert.equal(created.json.ad.review, 'pending');

    const bk = (await buyer.post('/v1/bookings', { slot_id: slot.id, ad_id: created.json.ad.id, unit: 'day', qty: 3, starts: Date.now() })).json.booking;
    assert.equal(bk.status, 'requested');
    assert.equal(bk.amount, 1_500_000);
    assert.equal(bk.fee, 225_000);    // 15%
    // the same dates can't be sold twice
    assert.equal((await buyer.post('/v1/bookings', { slot_id: slot.id, ad_id: created.json.ad.id, unit: 'day', qty: 1, starts: Date.now() + DAY })).status, 409);

    assert.equal((await owner.post(`/v1/bookings/${bk.id}/accept`)).status, 200);
    const pay = (await buyer.post(`/v1/bookings/${bk.id}/pay`, { provider: 'manual' })).json;
    assert.ok(pay.ref);
    assert.equal((await owner.post(`/v1/staff/payments/${pay.ref}/paid`)).status, 200);
    assert.equal((await owner.post(`/v1/staff/payments/${pay.ref}/paid`)).json.already, true);   // paying twice changes nothing

    // sold, but the ad isn't approved yet: nothing shows (not even the "Advertise here" card)
    assert.deepEqual((await buyer.get(`/v1/ad?slot=${slot.id}`)).json, { ad: null });
    const queue = (await owner.get('/v1/staff/review')).json.ads;
    assert.equal(queue.length, 1);
    await owner.post(`/v1/staff/ads/${queue[0].id}/review`, { decision: 'approved' });

    s.app.market.tick();
    ad = (await buyer.get(`/v1/ad?slot=${slot.id}`)).json;
    assert.equal(ad.source, 'booking');
    assert.equal(ad.label, 'Sponsored');
    assert.equal(ad.ad.sponsor, 'Suya Spot');

    // a view counts once; a robot's never
    const v = ad.view.replace(s.base, '');
    await buyer.post(v); await buyer.post(v);
    await fetch(s.base + v.replace('k=', 'k=x'), { method: 'POST', headers: { 'user-agent': UA } });
    const other = (await buyer.get(`/v1/ad?slot=${slot.id}`)).json;
    await fetch(other.view, { method: 'POST', headers: { 'user-agent': 'Googlebot/2.1' } });
    // a click goes to the advertiser with campaign tags, and counts once
    const c = await buyer.get(ad.click.replace(s.base, ''));
    assert.equal(c.status, 302);
    assert.match(c.location, /^https:\/\/suya\.test\/menu\?utm_source=isoteh&utm_medium=banner$/);
    await buyer.get(ad.click.replace(s.base, ''));
    const mine = (await buyer.get('/v1/bookings')).json.bookings[0];
    assert.equal(mine.views, 1);
    assert.equal(mine.clicks, 1);

    // after the last day the owner is paid, minus the fee
    s.app.market.tick(bk.ends + 1000);
    const money = (await owner.get('/v1/money')).json;
    assert.deepEqual(money.balances, [{ currency: 'NGN', amount: 1_275_000 }]);
    assert.equal(s.app.market.balance('platform', 'NGN'), 225_000);
    assert.equal(s.app.market.balance('escrow', 'NGN'), 0);
    assert.equal(s.app.db.get('SELECT SUM(amount) n FROM ledger').n, 0);   // every movement balances

    // the owner asks for the money; staff send it
    const po = (await owner.post('/v1/payouts', { amount: 1_000_000, currency: 'NGN', method: 'bank', details: 'GTBank 0123456789' })).json.payout;
    assert.equal((await owner.post('/v1/payouts', { amount: 1_000_000, currency: 'NGN', method: 'bank', details: 'x' })).status, 400);   // only what's left
    await owner.post(`/v1/staff/payouts/${po.id}/paid`);
    assert.equal(s.app.market.balance((await owner.get('/v1/me')).json.me.id, 'NGN'), 275_000);
  } finally { await s.stop(); }
});

test('never in private chats; members cannot reach staff tools; writes must be JSON', async () => {
  const s = await start();
  try {
    const a = s.browser(), b = s.browser();
    await a.signup('admin@x.test'); await b.signup('member@x.test');
    const prop = (await b.post('/v1/properties', { kind: 'app', name: 'Jisst channels', currency: 'NGN' })).json.property;
    const slot = (await b.post('/v1/slots', { property_id: prop.id, name: 'Channel card', format: 'native', price_day: 1000 })).json.slot;
    assert.ok((await b.get(`/v1/ad?slot=${slot.id}`)).json.open);
    assert.deepEqual((await b.get(`/v1/ad?slot=${slot.id}&ctx=private`)).json, { ad: null });
    assert.equal((await b.get('/v1/staff/review')).status, 403);
    const r = await fetch(`${s.base}/v1/properties`, { method: 'POST', headers: { 'content-type': 'application/x-www-form-urlencoded' }, body: 'kind=site&name=x' });
    assert.equal(r.status, 415);
    // an "image" that is really a web page is refused
    const camp = (await b.post('/v1/campaigns', { name: 'x', currency: 'NGN' })).json.campaign;
    const bad = await b.post('/v1/ads', { campaign_id: camp.id, kind: 'image', sponsor: 'Bad', url: 'https://x.test', image: Buffer.from('<html><script>alert(1)</script></html>'.padEnd(64)).toString('base64') });
    assert.equal(bad.status, 400);
    assert.equal((await b.post('/v1/ads', { campaign_id: camp.id, kind: 'native', sponsor: 'Ok', title: 'Hi', url: 'javascript:alert(1)' })).status, 400);
  } finally { await s.stop(); }
});

test('pay-per-view campaigns: credit, hold, match by context, charge views, refund the rest', async () => {
  const s = await start();
  try {
    const admin = s.browser(), owner = s.browser(), buyer = s.browser();
    await admin.signup('admin@x.test'); await owner.signup('dev@game.test'); await buyer.signup('brand@drink.test');
    const prop = (await owner.post('/v1/properties', { kind: 'game', name: 'Racer', keywords: 'racing, cars', currency: 'NGN' })).json.property;
    const slot = (await owner.post('/v1/slots', { property_id: prop.id, name: 'Trackside board', format: 'game', width: 1024, height: 512, network: true, booking_open: false })).json.slot;
    const camp = (await buyer.post('/v1/campaigns', { name: 'Drinks', currency: 'NGN', budget: 10_000, cpm: 2_000, keywords: 'racing' })).json.campaign;
    const ad = (await buyer.post('/v1/ads', { campaign_id: camp.id, kind: 'image', sponsor: 'Zobo Fizz', url: 'https://drink.test', image: image(1024, 512) })).json.ad;
    await admin.post(`/v1/staff/ads/${ad.id}/review`, { decision: 'approved' });

    assert.equal((await buyer.patch(`/v1/campaigns/${camp.id}`, { status: 'active' })).status, 402);   // no credit yet
    const top = (await buyer.post('/v1/topups', { amount: 10_000, currency: 'NGN', provider: 'manual' })).json;
    await admin.post(`/v1/staff/payments/${top.ref}/paid`);
    assert.equal((await buyer.patch(`/v1/campaigns/${camp.id}`, { status: 'active' })).json.campaign.status, 'active');

    for (let i = 0; i < 3; i++) {
      const got = (await buyer.get(`/v1/ad?slot=${slot.id}`)).json;
      assert.equal(got.source, 'network');
      await buyer.post(got.view.replace(s.base, ''));
    }
    s.app.market.tick();
    const me = (await owner.get('/v1/me')).json.me;
    assert.equal(s.app.market.balance(me.id, 'NGN'), 5);    // 3 views at 2,000 per thousand = 6, less 15%
    assert.equal(s.app.db.get('SELECT spent FROM campaigns WHERE id = ?', camp.id).spent, 6);

    // a campaign for other topics doesn't show here
    await buyer.patch(`/v1/campaigns/${camp.id}`, { keywords: 'cooking' });
    assert.equal((await buyer.get(`/v1/ad?slot=${slot.id}`)).json.ad, null);

    await buyer.patch(`/v1/campaigns/${camp.id}`, { status: 'ended' });
    const bm = (await buyer.get('/v1/me')).json.me;
    assert.equal(s.app.market.balance(bm.id, 'NGN'), 10_000 - 6);
    assert.equal(s.app.db.get('SELECT SUM(amount) n FROM ledger').n, 0);
  } finally { await s.stop(); }
});
