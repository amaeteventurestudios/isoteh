// Starts the ad server: npm start (settings from the environment; see lib/config.mjs).
import { loadConfig } from './lib/config.mjs';
import { makeApp } from './lib/app.mjs';

const cfg = loadConfig();
const app = makeApp(cfg);
await app.listen();
console.log(`${cfg.brand} on http://${cfg.host}:${cfg.port} (${cfg.mode}; public ${cfg.publicUrl}; payments ${cfg.providers.join(', ')})`);
for (const sig of ['SIGINT', 'SIGTERM']) process.on(sig, () => app.close().then(() => process.exit(0)));
