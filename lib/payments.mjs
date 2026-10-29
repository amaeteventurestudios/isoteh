// Taking money. Three ways in, each turned on by its key:
//   stripe   cards, Apple Pay and Google Pay in the US and worldwide (STRIPE_SECRET_KEY, STRIPE_WEBHOOK_SECRET): the main way;
//   paystack cards, bank, USSD and mobile money in Nigeria, Ghana, Kenya and South Africa (PAYSTACK_SECRET_KEY);
//   manual   always on: the buyer pays by bank transfer (ACH or wire) and staff confirm it in the dashboard.
// A payment is a row in `payments`; the provider's signed webhook (or staff, for manual) marks it paid, and market.paid()
// does the rest. We never see or store card numbers.
import { createHmac } from 'node:crypto';
import { id, now, same, httpError } from './util.mjs';

export function makePayments({ db, cfg, fetch = globalThis.fetch }) {
  async function start({ kind, target_id, account, amount, currency, provider, returnUrl }) {
    if (!cfg.providers.includes(provider)) throw httpError(400, `Payment method ${provider} isn't set up`);
    if (!(amount > 0)) throw httpError(400, 'Nothing to pay');
    const ref = id('pay');
    let url = `${cfg.publicUrl}/app/pay/${ref}`;
    if (provider === 'paystack') {
      const r = await fetch(`${cfg.paystack.api}/transaction/initialize`, {
        method: 'POST', headers: { authorization: `Bearer ${cfg.paystack.key}`, 'content-type': 'application/json' },
        body: JSON.stringify({ email: account.email, amount, currency, reference: ref, callback_url: returnUrl }),
      });
      const j = await r.json().catch(() => ({}));
      if (!r.ok || !j.status) throw httpError(502, `Paystack: ${j.message ?? r.status}`);
      url = j.data.authorization_url;
    } else if (provider === 'stripe') {
      const form = new URLSearchParams({
        mode: 'payment', success_url: returnUrl, cancel_url: returnUrl, client_reference_id: ref, customer_email: account.email,
        'line_items[0][quantity]': '1', 'line_items[0][price_data][currency]': currency.toLowerCase(),
        'line_items[0][price_data][unit_amount]': String(amount),
        'line_items[0][price_data][product_data][name]': kind === 'booking' ? `${cfg.brand} booking ${target_id}` : `${cfg.brand} ad credit`,
        'metadata[ref]': ref,
      });
      const r = await fetch(`${cfg.stripe.api}/v1/checkout/sessions`, { method: 'POST', headers: { authorization: `Bearer ${cfg.stripe.key}`, 'content-type': 'application/x-www-form-urlencoded' }, body: form });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) throw httpError(502, `Stripe: ${j.error?.message ?? r.status}`);
      url = j.url;
    }
    db.insert('payments', { ref, kind, target_id, account_id: account.id, amount, currency, provider, status: 'open', url, created: now() });
    return { ref, url };
  }

  /** Paystack webhook: HMAC-SHA512 of the raw body with the secret key. Returns the paid ref, or null. */
  function paystackEvent(raw, signature) {
    if (!cfg.paystack.key || !signature) return null;
    const mac = createHmac('sha512', cfg.paystack.key).update(raw).digest('hex');
    if (!same(mac, signature)) return null;
    const e = JSON.parse(raw.toString());
    if (e.event !== 'charge.success') return { ignored: true };
    return { ref: e.data?.reference, amount: e.data?.amount, currency: e.data?.currency };
  }

  /** Stripe webhook: "t=<time>,v1=<HMAC-SHA256 of `${t}.${raw}`>", at most five minutes old. */
  function stripeEvent(raw, header, t = now()) {
    if (!cfg.stripe.hook || !header) return null;
    const parts = Object.fromEntries(String(header).split(',').map((p) => p.split('=')));
    const mac = createHmac('sha256', cfg.stripe.hook).update(`${parts.t}.${raw}`).digest('hex');
    if (!parts.v1 || !same(mac, parts.v1) || Math.abs(t / 1000 - Number(parts.t)) > 300) return null;
    const e = JSON.parse(raw.toString());
    if (e.type !== 'checkout.session.completed') return { ignored: true };
    const s = e.data?.object ?? {};
    return { ref: s.client_reference_id ?? s.metadata?.ref, amount: s.amount_total, currency: String(s.currency ?? '').toUpperCase() };
  }

  return { start, paystackEvent, stripeEvent };
}
