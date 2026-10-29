// Newsletters, creators, payment webhooks and the files the SDKs load.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createHmac } from 'node:crypto';
import { start, image, UA } from './helpers.mjs';

async function seller(s, kind, slotFields) {
  const admin = s.browser(), owner = s.browser(), buyer = s.browser();
  await admin.signup('admin@x.test'); await owner.signup('owner@x.test'); await buyer.signup('buyer@x.test');
  const prop = (await owner.post('/v1/properties', { kind, name: 'Place', currency: 'NGN' })).json.property;
  const slot = (await owner.post('/v1/slots', { property_id: prop.id, name: 'Slot', approve: false, ...slotFields })).json.slot;
  const camp = (await buyer.post('/v1/campaigns', { name: 'C', currency: 'NGN' })).json.campaign;
  const ad = (await buyer.post('/v1/ads', { campaign_id: camp.id, kind: 'image', sponsor: 'Kente Co', title: 'Woven in Bonwire', url: 'https://kente.test', image: image(600, 200) })).json.ad;
  await admin.post(`/v1/staff/ads/${ad.id}/review`, { decision: 'approved' });
  return { admin, owner, buyer, slot, ad };
}

test('newsletters: one ad per issue, image and link agree, Substack kit', async () => {
  const s = await start();
  try {
    const { admin, buyer, slot, ad } = await seller(s, 'newsletter', { format: 'email', width: 600, height: 200, price_week: 2_000_000 });
    const bk = (await buyer.post('/v1/bookings', { slot_id: slot.id, ad_id: ad.id, unit: 'week', qty: 1, starts: Date.now() })).json.booking;
    assert.equal(bk.status, 'awaiting_payment');   // this slot takes bookings without asking
    const pay = (await buyer.post(`/v1/bookings/${bk.id}/pay`, { provider: 'manual' })).json;
    await admin.post(`/v1/staff/payments/${pay.ref}/paid`);

    const img = await fetch(`${s.base}/e/${slot.id}.png?i=2026-10-29`, { headers: { 'user-agent': UA } });
    assert.equal(img.headers.get('content-type'), 'image/png');
    const click = await buyer.get(`/e/${slot.id}/c?i=2026-10-29`);
    assert.equal(click.status, 302);
    assert.match(click.location, /^https:\/\/kente\.test\/\?utm_source=isoteh&utm_medium=email$/);
    const kit = (await buyer.get(`/e/${slot.id}/kit?i=2026-10-29`)).json;
    assert.equal(kit.sponsor, 'Kente Co');
    assert.equal(kit.label, 'Sponsored');
    assert.equal(kit.link, `${s.base}/e/${slot.id}/c?i=2026-10-29`);
    const row = s.app.db.get('SELECT * FROM stats WHERE slot_id = ?', slot.id);
    assert.equal(row.serves, 1); assert.equal(row.clicks, 1); assert.equal(row.booking_id, bk.id);
    // a different issue gets its own pick (here the same booking, since it is the only one running)
    const empty = await fetch(`${s.base}/e/${slot.id}.png?i=old-issue`);
    assert.equal(empty.headers.get('content-type'), 'image/png');
  } finally { await s.stop(); }
});

test('creators: pay up front, tracked link, post, release after confirmation', async () => {
  const s = await start();
  try {
    const { admin, owner, buyer, slot, ad } = await seller(s, 'creator', { format: 'banner', price_post: 7_500_000 });
    assert.equal(slot.format, 'creator');
    const bk = (await buyer.post('/v1/bookings', { slot_id: slot.id, ad_id: ad.id, qty: 1 })).json.booking;
    assert.equal(bk.unit, 'post');
    assert.equal((await buyer.post(`/v1/bookings/${bk.id}/confirm`)).status, 404);   // nothing posted yet
    const pay = (await buyer.post(`/v1/bookings/${bk.id}/pay`, { provider: 'manual' })).json;
    await admin.post(`/v1/staff/payments/${pay.ref}/paid`);
    const mine = (await owner.get('/v1/bookings?as=owner')).json.bookings[0];
    assert.match(mine.link, /\/go\/[\w-]+$/);
    const go = await buyer.get(mine.link.replace(s.base, ''));
    assert.match(go.location, /utm_medium=creator/);
    assert.equal((await owner.post(`/v1/bookings/${bk.id}/post`, { url: 'http://insecure.test' })).status, 400);
    assert.equal((await owner.post(`/v1/bookings/${bk.id}/post`, { url: 'https://instagram.test/p/abc' })).status, 200);
    // not released before the waiting days unless the advertiser confirms
    s.app.market.tick();
    assert.equal(s.app.db.get('SELECT status FROM bookings WHERE id = ?', bk.id).status, 'live');
    await buyer.post(`/v1/bookings/${bk.id}/confirm`);
    const o = (await owner.get('/v1/me')).json.me;
    assert.equal(s.app.market.balance(o.id, 'NGN'), 7_500_000 - 1_125_000);
    assert.equal((await buyer.get('/v1/bookings')).json.bookings[0].clicks, 1);
  } finally { await s.stop(); }
});

test('creators: automatic release after the waiting days; disputes go to staff', async () => {
  const s = await start({ ISOTEH_RELEASE_DAYS: '3' });
  try {
    const { admin, owner, buyer, slot, ad } = await seller(s, 'creator', { format: 'creator', price_post: 1000 });
    const one = async () => {
      const bk = (await buyer.post('/v1/bookings', { slot_id: slot.id, ad_id: ad.id })).json.booking;
      const pay = (await buyer.post(`/v1/bookings/${bk.id}/pay`, { provider: 'manual' })).json;
      await admin.post(`/v1/staff/payments/${pay.ref}/paid`);
      await owner.post(`/v1/bookings/${bk.id}/post`, { url: 'https://x.test/post' });
      return bk;
    };
    const a = await one(), b = await one();
    await buyer.post(`/v1/bookings/${b.id}/dispute`, { reason: 'Post was deleted' });
    s.app.market.tick(Date.now() + 4 * 86_400_000);
    assert.equal(s.app.db.get('SELECT status FROM bookings WHERE id = ?', a.id).status, 'settled');
    assert.equal(s.app.db.get('SELECT status FROM bookings WHERE id = ?', b.id).status, 'disputed');
    assert.equal((await admin.get('/v1/staff/overview')).json.disputes.length, 1);
    await admin.post(`/v1/staff/bookings/${b.id}/refund`);
    const bm = (await buyer.get('/v1/me')).json.me;
    assert.equal(s.app.market.balance(bm.id, 'NGN'), 1000);   // refunded as credit
    assert.equal(s.app.db.get('SELECT SUM(amount) n FROM ledger').n, 0);
  } finally { await s.stop(); }
});

test('Paystack: start a payment, accept only a correctly signed webhook with the right amount', async () => {
  const calls = [];
  const fetchStub = async (url, opts) => { calls.push({ url, body: JSON.parse(opts.body) }); return new Response(JSON.stringify({ status: true, data: { authorization_url: 'https://checkout.paystack.test/abc' } })); };
  const s = await start({ PAYSTACK_SECRET_KEY: 'sk_test_123', PAYSTACK_API: 'https://api.paystack.test' }, { fetch: fetchStub });
  try {
    const { buyer, slot, ad } = await seller(s, 'site', { format: 'banner', width: 600, height: 200, price_day: 100_000 });
    const bk = (await buyer.post('/v1/bookings', { slot_id: slot.id, ad_id: ad.id, unit: 'day', qty: 2, starts: Date.now() })).json.booking;
    const pay = (await buyer.post(`/v1/bookings/${bk.id}/pay`, { provider: 'paystack' })).json;
    assert.equal(pay.url, 'https://checkout.paystack.test/abc');
    assert.equal(calls[0].body.amount, 200_000);
    assert.equal(calls[0].body.currency, 'NGN');

    const hook = async (event, key = 'sk_test_123') => {
      const raw = JSON.stringify(event);
      return fetch(`${s.base}/hooks/paystack`, { method: 'POST', body: raw, headers: { 'content-type': 'application/json', 'x-paystack-signature': createHmac('sha512', key).update(raw).digest('hex') } });
    };
    assert.equal((await hook({ event: 'charge.success', data: { reference: pay.ref, amount: 200_000, currency: 'NGN' } }, 'wrong')).status, 401);
    assert.equal((await hook({ event: 'charge.success', data: { reference: pay.ref, amount: 1, currency: 'NGN' } })).status, 409);
    assert.equal(s.app.db.get('SELECT status FROM bookings WHERE id = ?', bk.id).status, 'awaiting_payment');
    assert.equal((await hook({ event: 'charge.success', data: { reference: pay.ref, amount: 200_000, currency: 'NGN' } })).status, 200);
    assert.equal(s.app.db.get('SELECT status FROM bookings WHERE id = ?', bk.id).status, 'paid');
  } finally { await s.stop(); }
});

test('Stripe: signed checkout webhook marks a top-up paid', async () => {
  const fetchStub = async () => new Response(JSON.stringify({ url: 'https://checkout.stripe.test/s' }));
  const s = await start({ STRIPE_SECRET_KEY: 'sk_test', STRIPE_WEBHOOK_SECRET: 'whsec_test' }, { fetch: fetchStub });
  try {
    const b = s.browser(); await b.signup('a@x.test');
    const pay = (await b.post('/v1/topups', { amount: 5000, currency: 'USD', provider: 'stripe' })).json;
    const raw = JSON.stringify({ type: 'checkout.session.completed', data: { object: { client_reference_id: pay.ref, amount_total: 5000, currency: 'usd' } } });
    const t = Math.floor(Date.now() / 1000);
    const sig = `t=${t},v1=${createHmac('sha256', 'whsec_test').update(`${t}.${raw}`).digest('hex')}`;
    assert.equal((await fetch(`${s.base}/hooks/stripe`, { method: 'POST', body: raw, headers: { 'stripe-signature': sig } })).status, 200);
    assert.deepEqual((await b.get('/v1/money')).json.balances, [{ currency: 'USD', amount: 5000 }]);
  } finally { await s.stop(); }
});

test('SDK files, images and the dashboard are served safely', async () => {
  const s = await start();
  try {
    for (const f of ['isoteh.js', 'isoteh-native.mjs', 'isoteh-game.mjs', 'isoteh-three.mjs']) {
      const r = await fetch(`${s.base}/s/${f}`);
      assert.equal(r.status, 200, f);
      assert.match(r.headers.get('content-type'), /javascript/);
      assert.equal(r.headers.get('access-control-allow-origin'), '*');
    }
    const page = await fetch(`${s.base}/market`);
    assert.match(page.headers.get('content-security-policy'), /script-src 'self'/);
    assert.equal((await fetch(`${s.base}/s/..%2Flib%2Fapp.mjs`)).status, 404);
    assert.equal((await fetch(`${s.base}/demo/../lib/config.mjs`)).status, 404);
    assert.equal((await fetch(`${s.base}/cr/../../etc/passwd`)).status, 404);
  } finally { await s.stop(); }
});
