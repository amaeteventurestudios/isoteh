// The ad engine: which ad a slot shows right now, and the counting of what was served, seen and clicked.
//
// Order of choice for a slot:
//   1. a paid booking running now (the slot is sold to that advertiser for those dates);
//   2. a pay-per-view campaign, if the slot's owner opted into the network (slot.network = 1), matched by the page's
//      context (keywords, country) and never by following a person;
//   3. the owner's own house ad;
//   4. an "Advertise here" card that links to the slot's booking page, when the slot is open for bookings.
// Every ad that is served carries a signed token. A view counts once, only when the viewer's screen reports it was seen
// (half the ad on screen for a second, or the game kit's rule); a click counts once and goes through us to the
// advertiser. Nothing is stored about the viewer.
import { sign, unsign, token, now, words, isBot } from './util.mjs';

const DAY = 86_400_000;
export const today = (t = now()) => new Date(t).toISOString().slice(0, 10);
const csv = (s) => String(s ?? '').split(',').map((x) => x.trim()).filter(Boolean);

/** Which ad kinds can fill which slot formats. */
const FITS = { banner: ['image'], native: ['native', 'image'], email: ['image'], game: ['image'], creator: [] };

export function makeEngine({ db, cfg }) {
  const ratioOk = (slot, ad) => !slot.width || !slot.height || ad.kind !== 'image' ||
    Math.abs(ad.width / ad.height - slot.width / slot.height) <= 0.06 * (slot.width / slot.height);

  function bookedAd(slot, t) {
    const rows = db.all(`SELECT b.id booking_id, a.* FROM bookings b JOIN ads a ON a.id = b.ad_id
      WHERE b.slot_id = ? AND b.status IN ('paid','live') AND b.starts <= ? AND b.ends > ? AND a.review = 'approved'`, slot.id, t, t);
    return rows.length ? rows[Math.floor(Math.random() * rows.length)] : null;
  }

  function networkAd(slot, prop, ctx, t) {
    if (!slot.network) return null;
    const context = new Set([...words(slot.keywords), ...words(prop.keywords), ...ctx.kw]);
    const day = today(t);
    const rows = db.all(`SELECT a.*, c.cpm, c.priority, c.keywords ckw, c.countries, c.daily_views, c.id cid FROM campaigns c JOIN ads a ON a.campaign_id = c.id
      WHERE c.status = 'active' AND (c.starts IS NULL OR c.starts <= ?) AND (c.ends IS NULL OR c.ends > ?)
        AND c.cpm > 0 AND c.spent < c.budget AND c.currency = ? AND a.review = 'approved'`, t, t, prop.currency);
    const fit = rows.filter((a) => FITS[slot.format]?.includes(a.kind) && ratioOk(slot, a)
      && (!a.ckw || words(a.ckw).some((w) => context.has(w)))
      && (!a.countries || (ctx.country && csv(a.countries).map((c) => c.toUpperCase()).includes(ctx.country)))
      && (!a.daily_views || (db.get(`SELECT COALESCE(SUM(s.views),0) n FROM stats s JOIN ads x ON x.id = s.ad_id WHERE s.day = ? AND x.campaign_id = ?`, day, a.cid).n < a.daily_views)));
    if (!fit.length) return null;
    const best = Math.min(...fit.map((a) => a.priority));
    const pool = fit.filter((a) => a.priority === best);
    let r = Math.random() * pool.reduce((s, a) => s + a.cpm, 0);
    for (const a of pool) { r -= a.cpm; if (r <= 0) return a; }
    return pool[pool.length - 1];
  }

  /** Pick the ad for a slot. ctx: { kw: [], country: 'NG', private: bool }. */
  function decide(slot, ctx = {}, t = now()) {
    if (ctx.private) return null;                                 // never inside private chats
    if (!slot || slot.status !== 'active' || slot.format === 'creator') return null;
    const prop = db.get('SELECT * FROM properties WHERE id = ?', slot.property_id);
    if (!prop || prop.status !== 'active') return null;
    ctx = { kw: ctx.kw ?? [], country: ctx.country ?? '' };
    let ad = bookedAd(slot, t), source = 'booking';
    if (!ad) { ad = networkAd(slot, prop, ctx, t); source = 'network'; }
    if (!ad && slot.house_ad_id) {
      ad = db.get(`SELECT * FROM ads WHERE id = ? AND review = 'approved'`, slot.house_ad_id); source = 'house';
      if (ad && !(FITS[slot.format]?.includes(ad.kind) && ratioOk(slot, ad))) ad = null;
    }
    if (!ad) {
      const sold = db.get(`SELECT 1 FROM bookings WHERE slot_id = ? AND status IN ('paid','live') AND starts <= ? AND ends > ?`, slot.id, t, t);
      return !sold && slot.booking_open && (slot.price_day || slot.price_week) ? { source: 'open', slot } : null;
    }
    return { source, ad, booking_id: ad.booking_id ?? '' };
  }

  // ---- counting ----
  const bump = (col, adId, slotId, bookingId, t) => db.run(`INSERT INTO stats (day, ad_id, slot_id, booking_id, ${col}) VALUES (?, ?, ?, ?, 1)
    ON CONFLICT (day, ad_id, slot_id, booking_id) DO UPDATE SET ${col} = ${col} + 1`, today(t), adId, slotId, bookingId ?? '');
  const firstTime = (nonce, kind, t) => db.run('INSERT OR IGNORE INTO seen (nonce, kind, at) VALUES (?, ?, ?)', nonce, kind, t).changes === 1;

  /** Record a serve and make the token its view and click carry. */
  function served(choice, slot, ua, t = now()) {
    const k = sign({ a: choice.ad.id, s: slot.id, b: choice.booking_id || undefined, n: token(9), t }, cfg.key);
    if (!isBot(ua)) bump('serves', choice.ad.id, slot.id, choice.booking_id, t);
    return k;
  }

  /** A view beacon. Returns true when it counted. */
  function viewed(k, ua, t = now()) {
    const v = unsign(k, cfg.key);
    if (!v || t - v.t > 2 * 3_600_000 || t < v.t - 60_000 || isBot(ua)) return false;
    if (!firstTime(v.n, 'view', t)) return false;
    bump('views', v.a, v.s, v.b, t);
    return true;
  }

  /** A click: counts once and returns where to send the person (the ad's own link), or null. */
  function clicked(k, ua, t = now()) {
    const v = unsign(k, cfg.key);
    if (!v) return null;
    const ad = db.get('SELECT url FROM ads WHERE id = ?', v.a);
    if (!ad) return null;
    if (t - v.t <= 7 * DAY && !isBot(ua) && firstTime(v.n, 'click', t)) bump('clicks', v.a, v.s, v.b, t);
    return withUtm(ad.url, slotFormat(v.s));
  }
  const slotFormat = (slotId) => db.get('SELECT format FROM slots WHERE id = ?', slotId)?.format ?? 'ad';
  function withUtm(url, medium) {
    try {
      const u = new URL(url);
      if (!u.searchParams.has('utm_source')) { u.searchParams.set('utm_source', cfg.brand.toLowerCase()); u.searchParams.set('utm_medium', medium); }
      return u.toString();
    } catch { return url; }
  }

  return { decide, served, viewed, clicked, bump, firstTime, withUtm, today };
}
