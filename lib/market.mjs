// Selling ad space and moving the money.
//
// A booking: the advertiser picks a slot, an approved-or-pending ad and dates (or a number of posts for a creator).
//   requested -> (owner accepts, unless the slot takes bookings without asking) -> awaiting_payment -> paid
//   -> runs on its dates -> settled: the owner is paid automatically.
//   A creator post: paid -> the creator adds the post's link -> settled after ISOTEH_RELEASE_DAYS unless the advertiser
//   disputes it (or straight away when the advertiser confirms). Staff settle or refund a dispute.
// A pay-per-view campaign: the advertiser adds credit, activating the campaign holds its budget, views are charged at
//   its price per thousand, and whatever is left comes back when it ends.
//
// Money lives in `ledger`. Accounts: each person's id, plus 'escrow' (money held for bookings and running budgets) and
// 'platform' (our fees). Every movement is a set of rows that sum to zero.
import { id, now, int, httpError, token, CURRENCIES } from './util.mjs';

const DAY = 86_400_000;
const HOLDS = ['requested', 'awaiting_payment', 'paid', 'live'];

export function makeMarket({ db, cfg }) {
  const audit = (actor, action, detail) => db.run('INSERT INTO audit (at, actor, action, detail) VALUES (?, ?, ?, ?)', now(), actor, action, JSON.stringify(detail));

  function move(rows, t = now()) {
    const sum = rows.reduce((s, r) => s + r.amount, 0);
    if (sum !== 0) throw new Error('ledger rows must balance');
    for (const r of rows) if (r.amount) db.insert('ledger', { at: t, ...r });
  }
  const balance = (accountId, currency) => db.get('SELECT COALESCE(SUM(amount),0) n FROM ledger WHERE account_id = ? AND currency = ?', accountId, currency).n;
  const balances = (accountId) => db.all('SELECT currency, SUM(amount) amount FROM ledger WHERE account_id = ? GROUP BY currency HAVING SUM(amount) <> 0', accountId);

  const feeOf = (slot, amount) => Math.round(amount * (slot.fee_bps ?? cfg.feeBps) / 10_000);

  // ---- bookings ----
  function quote(slot, unit, qty, starts) {
    qty = Math.max(1, Math.min(int(qty, 1), unit === 'week' ? 12 : unit === 'day' ? 90 : 10));
    const price = { day: slot.price_day, week: slot.price_week, post: slot.price_post }[unit];
    if (!price) throw httpError(400, `This slot isn't sold by the ${unit}`);
    const start = unit === 'post' ? now() : startOfDay(starts);
    const ends = unit === 'post' ? start + 14 * DAY : start + qty * (unit === 'week' ? 7 : 1) * DAY;
    return { qty, starts: start, ends, amount: price * qty };
  }
  function startOfDay(t) {
    const d = new Date(int(t, now())); d.setUTCHours(0, 0, 0, 0);
    if (d.getTime() < now() - DAY) throw httpError(400, 'Pick a start date from today on');
    return d.getTime();
  }

  function taken(slotId, starts, ends, except = '') {
    const holdSince = now() - cfg.holdMinutes * 60_000;
    return db.all(`SELECT id, starts, ends, status FROM bookings WHERE slot_id = ? AND id <> ? AND ends > ? AND starts < ?
      AND (status IN ('requested','paid','live') OR (status = 'awaiting_payment' AND created > ?))`, slotId, except, starts, ends, holdSince);
  }

  function book(account, { slot_id, ad_id, unit = 'day', qty = 1, starts, note }) {
    const slot = db.get(`SELECT s.*, p.account_id owner_id, p.currency, p.status pstatus FROM slots s JOIN properties p ON p.id = s.property_id WHERE s.id = ?`, slot_id);
    if (!slot || slot.status !== 'active' || slot.pstatus !== 'active' || !slot.booking_open) throw httpError(404, 'That slot isn\'t taking bookings');
    const ad = db.get('SELECT * FROM ads WHERE id = ? AND account_id = ?', ad_id, account.id);
    if (!ad) throw httpError(400, 'Pick one of your ads');
    if (ad.review === 'rejected') throw httpError(400, 'That ad was not approved; edit it first');
    if (slot.format === 'creator') unit = 'post';
    else if (unit === 'post') throw httpError(400, 'Only creator slots are sold by the post');
    const q = quote(slot, unit, qty, starts);
    return db.tx(() => {
      if (unit !== 'post' && taken(slot.id, q.starts, q.ends).length) throw httpError(409, 'Those dates are already booked');
      const b = {
        id: id('bk'), slot_id: slot.id, ad_id: ad.id, account_id: account.id, owner_id: slot.owner_id, unit, qty: q.qty,
        starts: q.starts, ends: q.ends, amount: q.amount, fee: feeOf(slot, q.amount), currency: slot.currency,
        status: slot.approve && slot.owner_id !== account.id ? 'requested' : 'awaiting_payment', note: String(note ?? '').slice(0, 500), created: now(),
      };
      db.insert('bookings', b);
      audit(account.id, 'booking.create', { id: b.id, slot: slot.id, amount: b.amount, currency: b.currency });
      return b;
    });
  }

  function respond(owner, bookingId, accept) {
    const b = db.get('SELECT * FROM bookings WHERE id = ? AND owner_id = ?', bookingId, owner.id);
    if (!b || b.status !== 'requested') throw httpError(404, 'No request to answer');
    if (accept && b.unit !== 'post' && taken(b.slot_id, b.starts, b.ends, b.id).filter((x) => x.status !== 'requested').length) throw httpError(409, 'Those dates were taken meanwhile');
    db.patch('bookings', b.id, { status: accept ? 'awaiting_payment' : 'declined', created: now() });
    audit(owner.id, accept ? 'booking.accept' : 'booking.decline', { id: b.id });
  }

  /** A payment came in (webhook or staff). Idempotent. */
  function paid(ref, by = 'provider', got = {}) {
    return db.tx(() => {
      const p = db.get('SELECT * FROM payments WHERE ref = ?', ref);
      if (!p) throw httpError(404, 'Unknown payment');
      if (p.status === 'paid') return { already: true };
      if ((got.amount !== undefined && got.amount !== p.amount) || (got.currency && got.currency !== p.currency)) {
        audit(by, 'payment.mismatch', { ref, got, want: { amount: p.amount, currency: p.currency } });
        throw httpError(409, 'The amount paid does not match');
      }
      db.run(`UPDATE payments SET status = 'paid', paid_at = ? WHERE ref = ?`, now(), ref);
      if (p.kind === 'booking') {
        const b = db.get('SELECT * FROM bookings WHERE id = ?', p.target_id);
        move([{ account_id: 'escrow', kind: 'payment', amount: p.amount, currency: p.currency, booking_id: b.id, note: `paid by ${p.account_id}` },
          { account_id: 'outside', kind: 'payment', amount: -p.amount, currency: p.currency, booking_id: b.id, note: p.provider }]);
        // paid after the hold ran out and someone else took the dates: keep the money for a refund by staff
        const clash = b.unit !== 'post' && taken(b.slot_id, b.starts, b.ends, b.id).filter((x) => ['paid', 'live'].includes(x.status)).length;
        db.patch('bookings', b.id, { status: clash ? 'disputed' : 'paid', paid_at: now(), provider: p.provider, pay_ref: ref,
          link_code: b.unit === 'post' ? token(6) : null, note: clash ? `${b.note ?? ''} [paid after the dates were taken]`.trim() : b.note });
      } else {
        move([{ account_id: p.account_id, kind: 'topup', amount: p.amount, currency: p.currency, note: p.provider },
          { account_id: 'outside', kind: 'topup', amount: -p.amount, currency: p.currency, note: p.provider }]);
      }
      audit(by, 'payment.paid', { ref, kind: p.kind, amount: p.amount, currency: p.currency });
      return { ok: true };
    });
  }

  function settle(b, by = 'system') {
    db.tx(() => {
      const fresh = db.get('SELECT status FROM bookings WHERE id = ?', b.id);
      if (!['paid', 'live', 'disputed'].includes(fresh.status)) return;
      move([{ account_id: 'escrow', kind: 'release', amount: -b.amount, currency: b.currency, booking_id: b.id },
        { account_id: b.owner_id, kind: 'earning', amount: b.amount - b.fee, currency: b.currency, booking_id: b.id },
        { account_id: 'platform', kind: 'fee', amount: b.fee, currency: b.currency, booking_id: b.id }]);
      db.patch('bookings', b.id, { status: 'settled', settled_at: now() });
      audit(by, 'booking.settle', { id: b.id });
    });
  }
  function refund(b, by) {
    db.tx(() => {
      if (!['paid', 'live', 'disputed'].includes(db.get('SELECT status FROM bookings WHERE id = ?', b.id).status)) throw httpError(409, 'Nothing to refund');
      move([{ account_id: 'escrow', kind: 'refund', amount: -b.amount, currency: b.currency, booking_id: b.id },
        { account_id: b.account_id, kind: 'refund', amount: b.amount, currency: b.currency, booking_id: b.id, note: 'refund to the advertiser\'s credit' }]);
      db.patch('bookings', b.id, { status: 'refunded', settled_at: now() });
      audit(by, 'booking.refund', { id: b.id });
    });
  }

  // creator posts
  function posted(owner, bookingId, url) {
    const b = db.get('SELECT * FROM bookings WHERE id = ? AND owner_id = ?', bookingId, owner.id);
    if (!b || b.unit !== 'post' || !['paid', 'live'].includes(b.status)) throw httpError(404, 'No paid post to deliver');
    if (!/^https:\/\/\S{4,500}$/.test(url ?? '')) throw httpError(400, 'Paste the post\'s https link');
    db.patch('bookings', b.id, { post_url: url, posted_at: now(), status: 'live' });
  }
  function confirm(buyer, bookingId) {
    const b = db.get('SELECT * FROM bookings WHERE id = ? AND account_id = ?', bookingId, buyer.id);
    if (!b || b.status !== 'live' || !b.posted_at) throw httpError(404, 'Nothing to confirm yet');
    settle(b, buyer.id);
  }
  function dispute(buyer, bookingId, reason) {
    const b = db.get('SELECT * FROM bookings WHERE id = ? AND account_id = ?', bookingId, buyer.id);
    if (!b || !['paid', 'live'].includes(b.status)) throw httpError(404, 'Nothing to dispute');
    db.patch('bookings', b.id, { status: 'disputed', note: `${b.note ?? ''}\n[dispute] ${String(reason ?? '').slice(0, 500)}`.trim() });
    audit(buyer.id, 'booking.dispute', { id: b.id });
  }
  function cancel(buyer, bookingId) {
    const b = db.get('SELECT * FROM bookings WHERE id = ? AND account_id = ?', bookingId, buyer.id);
    if (!b || !['requested', 'awaiting_payment'].includes(b.status)) throw httpError(409, 'Only unpaid bookings can be cancelled');
    db.patch('bookings', b.id, { status: 'cancelled' });
  }

  // ---- pay-per-view campaigns ----
  function activate(account, campaignId) {
    return db.tx(() => {
      const c = db.get('SELECT * FROM campaigns WHERE id = ? AND account_id = ?', campaignId, account.id);
      if (!c) throw httpError(404, 'No such campaign');
      if (c.status === 'active') return c;
      if (c.status === 'ended') throw httpError(409, 'That campaign has ended');
      if (c.cpm > 0) {
        const held = db.get(`SELECT COALESCE(SUM(amount),0) n FROM ledger WHERE campaign_id = ? AND account_id = 'escrow'`, c.id).n;
        const need = c.budget - c.spent - held;
        if (need > 0) {
          if (balance(account.id, c.currency) < need) throw httpError(402, 'Add credit to cover the budget first');
          move([{ account_id: account.id, kind: 'hold', amount: -need, currency: c.currency, campaign_id: c.id },
            { account_id: 'escrow', kind: 'hold', amount: need, currency: c.currency, campaign_id: c.id }]);
        }
      }
      db.patch('campaigns', c.id, { status: 'active' });
      return { ...c, status: 'active' };
    });
  }
  function endCampaign(c) {
    db.tx(() => {
      const held = db.get(`SELECT COALESCE(SUM(amount),0) n FROM ledger WHERE campaign_id = ? AND account_id = 'escrow'`, c.id).n;
      if (held > 0) move([{ account_id: 'escrow', kind: 'release', amount: -held, currency: c.currency, campaign_id: c.id },
        { account_id: c.account_id, kind: 'release', amount: held, currency: c.currency, campaign_id: c.id, note: 'unspent budget' }]);
      db.patch('campaigns', c.id, { status: 'ended' });
    });
  }

  /** Charge pay-per-view campaigns for new views and pay the slots' owners. */
  function chargeViews() {
    const rows = db.all(`SELECT s.rowid, s.*, c.id cid, c.cpm, c.currency, c.account_id buyer, c.budget, c.spent, p.account_id owner, sl.fee_bps
      FROM stats s JOIN ads a ON a.id = s.ad_id JOIN campaigns c ON c.id = a.campaign_id JOIN slots sl ON sl.id = s.slot_id
      JOIN properties p ON p.id = sl.property_id WHERE s.booking_id = '' AND c.cpm > 0 AND s.views > s.settled_views`);
    for (const r of rows) db.tx(() => {
      const c = db.get('SELECT spent, budget FROM campaigns WHERE id = ?', r.cid);
      let cost = Math.floor(r.views * r.cpm / 1000) - Math.floor(r.settled_views * r.cpm / 1000);
      cost = Math.max(0, Math.min(cost, c.budget - c.spent));
      if (r.owner === r.buyer) cost = 0;                    // an owner's own campaign on their own slots costs nothing
      const fee = Math.round(cost * (r.fee_bps ?? cfg.feeBps) / 10_000);
      if (cost) move([{ account_id: 'escrow', kind: 'spend', amount: -cost, currency: r.currency, campaign_id: r.cid },
        { account_id: r.owner, kind: 'earning', amount: cost - fee, currency: r.currency, campaign_id: r.cid },
        { account_id: 'platform', kind: 'fee', amount: fee, currency: r.currency, campaign_id: r.cid }]);
      db.run('UPDATE stats SET settled_views = ? WHERE rowid = ?', r.views, r.rowid);
      db.run('UPDATE campaigns SET spent = spent + ? WHERE id = ?', cost, r.cid);
    });
  }

  // ---- payouts ----
  function requestPayout(account, { amount, currency, method, details }) {
    amount = int(amount);
    if (!CURRENCIES.includes(currency)) throw httpError(400, 'Pick a currency');
    if (!['bank', 'mobile_money', 'paypal', 'other'].includes(method)) throw httpError(400, 'Pick how to be paid');
    if (!String(details ?? '').trim()) throw httpError(400, 'Add the account details');
    return db.tx(() => {
      if (amount <= 0 || amount > balance(account.id, currency)) throw httpError(400, 'That is more than your balance');
      const p = { id: id('po'), account_id: account.id, amount, currency, method, details: String(details).slice(0, 500), status: 'requested', created: now() };
      db.insert('payouts', p);
      move([{ account_id: account.id, kind: 'payout', amount: -amount, currency, note: p.id },
        { account_id: 'payouts_pending', kind: 'payout', amount, currency, note: p.id }]);
      return p;
    });
  }
  function finishPayout(staff, payoutId, ok) {
    db.tx(() => {
      const p = db.get(`SELECT * FROM payouts WHERE id = ? AND status = 'requested'`, payoutId);
      if (!p) throw httpError(404, 'No open payout');
      move(ok ? [{ account_id: 'payouts_pending', kind: 'payout', amount: -p.amount, currency: p.currency, note: p.id },
        { account_id: 'outside', kind: 'payout', amount: p.amount, currency: p.currency, note: p.id }]
        : [{ account_id: 'payouts_pending', kind: 'payout', amount: -p.amount, currency: p.currency, note: p.id },
          { account_id: p.account_id, kind: 'payout_returned', amount: p.amount, currency: p.currency, note: p.id }]);
      db.patch('payouts', p.id, { status: ok ? 'paid' : 'returned', paid_at: now() });
      audit(staff.id, ok ? 'payout.paid' : 'payout.returned', { id: p.id });
    });
  }

  /** Housekeeping, every minute: expire unpaid holds, settle finished bookings and creator posts, charge views, end campaigns. */
  function tick(t = now()) {
    db.run(`UPDATE bookings SET status = 'expired' WHERE status = 'awaiting_payment' AND created < ?`, t - cfg.holdMinutes * 60_000 - 60_000);
    db.run(`UPDATE bookings SET status = 'expired' WHERE status = 'requested' AND starts < ? AND unit <> 'post'`, t);
    db.run(`UPDATE bookings SET status = 'live' WHERE status = 'paid' AND unit <> 'post' AND starts <= ?`, t);
    for (const b of db.all(`SELECT * FROM bookings WHERE status = 'live' AND unit <> 'post' AND ends <= ?`, t)) settle(b);
    for (const b of db.all(`SELECT * FROM bookings WHERE status = 'live' AND unit = 'post' AND posted_at < ?`, t - cfg.releaseDays * DAY)) settle(b);
    chargeViews();
    for (const c of db.all(`SELECT * FROM campaigns WHERE status = 'active' AND ((ends IS NOT NULL AND ends <= ?) OR (cpm > 0 AND spent >= budget))`, t)) endCampaign(c);
    db.run('DELETE FROM seen WHERE at < ?', t - 2 * DAY);
    db.run('DELETE FROM sessions WHERE expires < ?', t);
  }

  return { book, quote, taken, respond, paid, settle, refund, posted, confirm, dispute, cancel, activate, endCampaign, chargeViews,
    requestPayout, finishPayout, balance, balances, move, tick, audit, HOLDS };
}
