// Test harness: the server on a free port with a throwaway data folder, and a tiny browser with a cookie jar.
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createServer } from 'node:net';
import { loadConfig } from '../lib/config.mjs';
import { makeApp } from '../lib/app.mjs';
import { resetLimits } from '../lib/util.mjs';
import { png } from '../tools/png.mjs';

const freePort = () => new Promise((ok) => { const s = createServer(); s.listen(0, '127.0.0.1', () => { const p = s.address().port; s.close(() => ok(p)); }); });
export const UA = 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 Mobile Safari/604.1';
export const image = (w = 300, h = 250) => png(w, h, { band: { color: [195, 66, 24], y: 0, h: Math.round(h / 3) } }).toString('base64');

export async function start(env = {}, opts = {}) {
  resetLimits();
  const dir = mkdtempSync(join(tmpdir(), 'isoteh-'));
  const port = await freePort();
  const cfg = loadConfig({ ISOTEH_ENV: 'test', ISOTEH_PUBLIC_URL: `http://127.0.0.1:${port}`, ISOTEH_DATA: dir, ISOTEH_SECRET: 'b'.repeat(64), ...env });
  const app = makeApp(cfg, opts);
  await app.listen(port, '127.0.0.1');
  const base = `http://127.0.0.1:${port}`;
  return { app, cfg, base, browser: () => browser(base), async stop() { await app.close(); rmSync(dir, { recursive: true, force: true }); } };
}

export function browser(base) {
  let jar = '';
  async function call(method, path, data, headers = {}) {
    const r = await fetch(base + path, {
      method, redirect: 'manual',
      headers: { 'user-agent': UA, ...(jar ? { cookie: jar } : {}), ...(data !== undefined ? { 'content-type': 'application/json' } : {}), ...headers },
      body: data !== undefined ? JSON.stringify(data) : undefined,
    });
    const set = r.headers.getSetCookie?.() ?? [];
    for (const c of set) { const [kv] = c.split(';'); const [k, v] = kv.split('='); if (k === 'is_s') jar = v ? `is_s=${v}` : ''; }
    const type = r.headers.get('content-type') ?? '';
    const json = type.includes('json') ? await r.json() : null;
    return { status: r.status, json, headers: r.headers, location: r.headers.get('location') };
  }
  return {
    get: (p, h) => call('GET', p, undefined, h),
    post: (p, d = {}, h) => call('POST', p, d, h),
    patch: (p, d = {}) => call('PATCH', p, d),
    async signup(email, name = 'Ada', password = 'correct horse battery') { return call('POST', '/v1/auth/signup', { email, name, password }); },
  };
}
