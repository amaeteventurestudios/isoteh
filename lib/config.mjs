// Settings, all from the environment (on the server: /etc/isoteh/isoteh.env, made by deploy/install.sh).
import { sha } from './util.mjs';

const on = (v) => ['1', 'true', 'yes', 'on'].includes(String(v ?? '').toLowerCase());

export function loadConfig(env = process.env, overrides = {}) {
  const mode = env.ISOTEH_ENV ?? 'development';
  const secret = env.ISOTEH_SECRET ?? '';
  if (!/^[0-9a-f]{64}$/i.test(secret) && mode === 'production') throw new Error('ISOTEH_SECRET (64 hex characters) must be set in production');
  const publicUrl = (env.ISOTEH_PUBLIC_URL ?? 'http://127.0.0.1:8400').replace(/\/$/, '');
  const cfg = {
    mode,
    brand: env.ISOTEH_BRAND || 'Isoteh',
    key: Buffer.from(/^[0-9a-f]{64}$/i.test(secret) ? secret : sha('isoteh-development-only'), 'hex'),
    publicUrl, secure: publicUrl.startsWith('https://'),
    host: env.ISOTEH_HOST ?? '127.0.0.1', port: Number(env.ISOTEH_PORT ?? 8400),
    dataDir: env.ISOTEH_DATA ?? new URL('../data', import.meta.url).pathname,
    trustProxy: on(env.ISOTEH_TRUST_PROXY ?? (mode === 'production' ? 'true' : 'false')),
    // the platform's cut of a direct booking, in basis points (1500 = 15%); a slot can set its own
    feeBps: Number(env.ISOTEH_FEE_BPS ?? 1500),
    // a creator deal pays out this many days after the post goes live unless the advertiser disputes it
    releaseDays: Number(env.ISOTEH_RELEASE_DAYS ?? 3),
    // an unpaid booking holds its dates this long
    holdMinutes: Number(env.ISOTEH_HOLD_MINUTES ?? 30),
    // this email becomes the administrator when it signs up; without it, the first account does (never in production)
    adminEmail: (env.ISOTEH_ADMIN_EMAIL ?? '').toLowerCase(),
    // shown to people paying by transfer: the bank account or mobile money number to send to
    payInstructions: env.ISOTEH_PAY_INSTRUCTIONS ?? '',
    signupOpen: !['0', 'false', 'no', 'off'].includes(String(env.ISOTEH_SIGNUP ?? 'true').toLowerCase()),
    paystack: { key: env.PAYSTACK_SECRET_KEY ?? '', api: env.PAYSTACK_API ?? 'https://api.paystack.co' },
    stripe: { key: env.STRIPE_SECRET_KEY ?? '', hook: env.STRIPE_WEBHOOK_SECRET ?? '', api: env.STRIPE_API ?? 'https://api.stripe.com' },
    ...overrides,
  };
  cfg.providers = [...(cfg.stripe.key ? ['stripe'] : []), ...(cfg.paystack.key ? ['paystack'] : []), 'manual'];
  return cfg;
}
