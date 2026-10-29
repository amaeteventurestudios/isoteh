// Small helpers: ids, hashing, signed values, passwords, request bodies, rate limits, HTML escaping, money.
import { createHash, createHmac, randomBytes, scryptSync, timingSafeEqual } from 'node:crypto';

export const sha = (s) => createHash('sha256').update(s).digest('hex');
export const token = (bytes = 24) => randomBytes(bytes).toString('base64url');
/** Short, URL-safe, sortable-enough ids: a prefix plus 10 random characters. */
export const id = (prefix) => `${prefix}_${randomBytes(8).toString('base64url').replace(/[-_]/g, '').slice(0, 10).padEnd(10, '0')}`;
export const now = () => Date.now();

export function same(a, b) {
  const x = Buffer.from(String(a)), y = Buffer.from(String(b));
  return x.length === y.length && timingSafeEqual(x, y);
}

// ---- signed values (ad tokens, sessions): base64url(JSON) + "." + HMAC-SHA256, cut to 22 characters ----
export function sign(obj, key) {
  const body = Buffer.from(JSON.stringify(obj)).toString('base64url');
  return `${body}.${createHmac('sha256', key).update(body).digest('base64url').slice(0, 22)}`;
}
export function unsign(value, key) {
  if (!value || typeof value !== 'string' || value.length > 2000) return null;
  const [body, mac] = value.split('.');
  if (!body || !mac || !same(mac, createHmac('sha256', key).update(body).digest('base64url').slice(0, 22))) return null;
  try { return JSON.parse(Buffer.from(body, 'base64url').toString()); } catch { return null; }
}

// ---- passwords: scrypt, "s1:<salt>:<hash>" ----
export function hashPassword(pw) {
  const salt = randomBytes(16);
  return `s1:${salt.toString('base64url')}:${scryptSync(String(pw), salt, 32).toString('base64url')}`;
}
export function checkPassword(pw, stored) {
  const [v, salt, hash] = String(stored ?? '').split(':');
  if (v !== 's1' || !salt || !hash) return false;
  return same(scryptSync(String(pw), Buffer.from(salt, 'base64url'), 32).toString('base64url'), hash);
}

// ---- cookies ----
export function cookies(req) {
  const out = {};
  for (const part of (req.headers.cookie ?? '').split(/;\s*/)) {
    const i = part.indexOf('=');
    if (i > 0) out[part.slice(0, i)] = decodeURIComponent(part.slice(i + 1));
  }
  return out;
}
export function setCookie(res, name, value, { maxAge, secure, path = '/' } = {}) {
  const parts = [`${name}=${encodeURIComponent(value)}`, `Path=${path}`, 'HttpOnly', 'SameSite=Lax'];
  if (secure) parts.push('Secure');
  if (maxAge !== undefined) parts.push(`Max-Age=${maxAge}`);
  const prev = res.getHeader('set-cookie');
  res.setHeader('set-cookie', [...(Array.isArray(prev) ? prev : prev ? [prev] : []), parts.join('; ')]);
}

// ---- request bodies: raw bytes (webhooks need them), JSON or forms; capped ----
export async function rawBody(req, cap = 32_768) {
  const chunks = []; let size = 0;
  for await (const c of req) { size += c.length; if (size > cap) throw httpError(413, 'Too large'); chunks.push(c); }
  return Buffer.concat(chunks);
}
export async function body(req, cap) {
  const raw = (await rawBody(req, cap)).toString();
  const type = req.headers['content-type'] ?? '';
  if (type.includes('application/json')) { try { return JSON.parse(raw || '{}'); } catch { throw httpError(400, 'Bad JSON'); } }
  return Object.fromEntries(new URLSearchParams(raw));
}
export const httpError = (status, message) => Object.assign(new Error(message), { status });

// ---- rate limits: fixed windows in memory (one process) ----
const hits = new Map();
export function limited(key, max, windowMs) {
  const t = Date.now(), h = hits.get(key);
  if (!h || t - h.at > windowMs) { hits.set(key, { at: t, n: 1 }); return false; }
  h.n += 1;
  if (hits.size > 100_000) for (const [k, v] of hits) if (t - v.at > 3_600_000) hits.delete(k);
  return h.n > max;
}
export const resetLimits = () => hits.clear();

export const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
export const EMAIL_RE = /^[^\s@]{1,64}@[^\s@]{1,190}\.[^\s@]{2,63}$/;

// ---- money: whole minor units (cents, pence, kobo) and an ISO currency; never a hard-coded symbol ----
const MINOR = { JPY: 0, KRW: 0, XOF: 0, XAF: 0, RWF: 0, UGX: 0 };
export const minorDigits = (cur) => MINOR[cur] ?? 2;
export function money(minor, cur) {
  try { return new Intl.NumberFormat('en', { style: 'currency', currency: cur }).format(minor / 10 ** minorDigits(cur)); }
  catch { return `${(minor / 100).toFixed(2)} ${cur}`; }
}
export const CURRENCIES = ['USD', 'CAD', 'GBP', 'EUR', 'AUD', 'MXN', 'BRL', 'NGN', 'GHS', 'KES', 'ZAR', 'EGP', 'MAD', 'XOF', 'XAF', 'UGX', 'TZS', 'RWF'];
export const int = (v, d = 0) => { const n = Number.parseInt(v, 10); return Number.isFinite(n) ? n : d; };

/** Lower-case words for context matching ("Austin, Food & Drink" -> ["austin","food","drink"]). */
export const words = (s) => [...new Set(String(s ?? '').toLowerCase().split(/[^\p{L}\p{N}]+/u).filter((w) => w.length > 1))].slice(0, 40);

const BOTS = /bot|crawl|spider|slurp|headless|lighthouse|preview|facebookexternalhit|embedly|whatsapp|telegrambot|discordbot|curl|wget|python-requests|httpclient|axios|node-fetch|go-http/i;
export const isBot = (ua) => !ua || BOTS.test(ua);
