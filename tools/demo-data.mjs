// Fills a fresh data folder with a believable US demo: five places (a food blog, a newsletter, a chat app, a racing game, a
// creator), three advertisers, running bookings, a pay-per-view campaign and two weeks of numbers. Writes demo/ids.json
// for the demo pages. Usage: ISOTEH_DATA=/tmp/isoteh-demo npm run demo, then ISOTEH_DATA=/tmp/isoteh-demo npm start.
import { writeFileSync } from 'node:fs';
import { loadConfig } from '../lib/config.mjs';
import { makeApp } from '../lib/app.mjs';
import { id, hashPassword } from '../lib/util.mjs';
import { png } from './png.mjs';

const cfg = loadConfig();
const app = makeApp(cfg);
const { db, creatives, market, engine } = app;
if (db.get('SELECT 1 FROM accounts LIMIT 1')) { console.error(`${cfg.dataDir} already has data; use an empty folder`); process.exit(1); }

const DAY = 86_400_000, t0 = Date.now();
const PW = 'demo-password-1';
const acct = (email, name, role = 'member') => { const a = { id: id('ac'), email, name, pw: hashPassword(PW), role, country: 'US', created: t0 - 40 * DAY }; db.insert('accounts', a); return a; };
const prop = (a, kind, name, extra) => { const p = { id: id('pr'), account_id: a.id, kind, name, status: 'active', created: t0 - 30 * DAY, keywords: '', audience: 0, currency: 'USD', ...extra }; db.insert('properties', p); return p; };
const slot = (p, name, format, extra) => { const s = { id: id('sl'), property_id: p.id, name, format, width: 0, height: 0, keywords: '', price_day: 0, price_week: 0, price_post: 0, booking_open: 1, approve: 1, network: 0, status: 'active', created: t0 - 30 * DAY, ...extra }; db.insert('slots', s); return s; };
const camp = (a, name, extra) => { const c = { id: id('cp'), account_id: a.id, name, status: 'active', currency: 'USD', budget: 0, cpm: 0, daily_views: 0, keywords: '', countries: '', priority: 5, spent: 0, created: t0 - 20 * DAY, ...extra }; db.insert('campaigns', c); return c; };
const img = (w, h, bg, band, lines) => creatives.save(png(w, h, { bg, band, lines }).toString('base64'));
const ad = (c, kind, f, extra) => { const a = { id: id('ad'), campaign_id: c.id, account_id: c.account_id, kind, review: 'approved', created: t0 - 20 * DAY, title: '', body: '', cta: '', image: f?.file ?? null, width: f?.width ?? 0, height: f?.height ?? 0, ...extra }; db.insert('ads', a); return a; };
const booking = (s, a, owner, buyer, unit, qty, starts, amount, extra = {}) => {
  const b = { id: id('bk'), slot_id: s.id, ad_id: a.id, account_id: buyer.id, owner_id: owner.id, unit, qty, starts, ends: starts + qty * (unit === 'week' ? 7 : unit === 'day' ? 1 : 14) * DAY,
    amount, fee: Math.round(amount * cfg.feeBps / 10_000), currency: 'USD', status: 'live', provider: 'stripe', created: starts - DAY, paid_at: starts - DAY, ...extra };
  db.insert('bookings', b);
  market.move([{ account_id: 'escrow', kind: 'payment', amount, currency: b.currency, booking_id: b.id }, { account_id: 'outside', kind: 'payment', amount: -amount, currency: b.currency, booking_id: b.id }], b.paid_at);
  return b;
};

// people
acct('admin@demo.test', 'Demo staff', 'admin');
const jess = acct('jess@demo.test', 'Jess Ramirez');
const marcus = acct('marcus@demo.test', 'Marcus Hill');
const jisst = acct('jisst@demo.test', 'Jisst');
const agp = acct('agp@demo.test', 'Agent Grand Prix');
const maya = acct('maya@demo.test', 'Maya Chen');
const smoke = acct('smoke@demo.test', 'Smoke + Salt BBQ');
const fizz = acct('fizz@demo.test', 'Fizz Lab');
const hudson = acct('hudson@demo.test', 'Hudson Goods');

// places and slots
const blog = prop(jess, 'site', 'Austin Eats', { url: 'https://austineats.example', about: 'Barbecue, tacos and restaurant reviews from Austin, Texas.', keywords: 'food, austin, bbq, restaurants', country: 'US', audience: 48000 });
const sidebar = slot(blog, 'Sidebar', 'banner', { width: 300, height: 250, price_day: 4_000, price_week: 25_000, network: 1, keywords: 'food' });
const inline = slot(blog, 'Inside articles', 'native', { price_week: 35_000, network: 1, keywords: 'food' });
const brief = prop(marcus, 'newsletter', 'The Brooklyn Brief', { url: 'https://brooklynbrief.example', about: 'Five local stories from Brooklyn every weekday morning.', keywords: 'news, brooklyn, new york, business', country: 'US', audience: 21000 });
const top = slot(brief, 'Top of every issue', 'email', { width: 600, height: 200, price_week: 60_000 });
const chat = prop(jisst, 'app', 'Jisste public channels', { url: 'https://jisste.example', about: 'Cards in public channels and the Status tab. Never in private chats.', keywords: 'chat, basketball, music, games, food', audience: 9000 });
const channels = slot(chat, 'Channel card', 'native', { price_week: 15_000, network: 1, approve: 0 });
const game = prop(agp, 'game', 'Agent Grand Prix', { url: 'https://agentgrandprix.com', about: 'Street racing for AI agents. Boards line the main straight.', keywords: 'racing, cars, games', audience: 12000 });
const board = slot(game, 'Main straight board', 'game', { width: 1024, height: 512, price_week: 20_000, network: 1 });
const creator = prop(maya, 'creator', 'Maya on Instagram', { url: 'https://instagram.example/maya', about: 'Food and style reels from Los Angeles.', keywords: 'fashion, food, los angeles', country: 'US', audience: 86000 });
const posts = slot(creator, 'Sponsored reel', 'creator', { price_post: 75_000 });

// ads
const terracotta = [195, 66, 24], cream = [246, 241, 234], ink = [29, 27, 25], green = [33, 90, 70], gold = [214, 160, 40];
const cSmoke = camp(smoke, 'Smoke + Salt in East Austin');
const aSmoke = ad(cSmoke, 'image', img(300, 250, ink, { color: terracotta, y: 170, h: 80 }, [{ text: 'SMOKE+SALT', color: gold, scale: 6, y: 40 }, { text: 'TEXAS BBQ', color: cream, scale: 4, y: 110 }, { text: 'ORDER NOW', color: cream, scale: 4, y: 196 }]),
  { sponsor: 'Smoke + Salt BBQ', title: 'Brisket smoked for 14 hours', url: 'https://smokesalt.example/menu' });
const aSmokeNative = ad(cSmoke, 'native', img(160, 160, terracotta, null, [{ text: 'BBQ', color: cream, scale: 8, y: 60 }]),
  { sponsor: 'Smoke + Salt BBQ', title: 'Brisket delivered in 30 minutes', body: 'Post oak smoked brisket, ribs and sausage from our pit in East Austin.', cta: 'Order now', url: 'https://smokesalt.example/order' });
const cFizz = camp(fizz, 'Fizz Lab launch', { cpm: 1_200, budget: 200_000, keywords: 'racing, games, chat, food, basketball', spent: 0 });
market.move([{ account_id: fizz.id, kind: 'topup', amount: 200_000, currency: 'USD' }, { account_id: 'outside', kind: 'topup', amount: -200_000, currency: 'USD' }], t0 - 20 * DAY);
market.move([{ account_id: fizz.id, kind: 'hold', amount: -200_000, currency: 'USD', campaign_id: cFizz.id }, { account_id: 'escrow', kind: 'hold', amount: 200_000, currency: 'USD', campaign_id: cFizz.id }], t0 - 20 * DAY);
const aFizzBoard = ad(cFizz, 'image', img(1024, 512, [120, 20, 40], { color: gold, y: 380, h: 132 }, [{ text: 'FIZZ LAB', color: cream, scale: 22, y: 90 }, { text: 'HIBISCUS SODA', color: ink, scale: 9, y: 420 }]),
  { sponsor: 'Fizz Lab', title: 'Hibiscus soda, ice cold', url: 'https://fizzlab.example' });
const aFizzCard = ad(cFizz, 'native', img(160, 160, [120, 20, 40], null, [{ text: 'FIZZ', color: cream, scale: 7, y: 62 }]),
  { sponsor: 'Fizz Lab', title: 'Meet Fizz Lab hibiscus soda', body: 'Hibiscus, ginger and a little pineapple. In the fridge at your corner store.', cta: 'Find a store', url: 'https://fizzlab.example/stores' });
const cHudson = camp(hudson, 'Hudson Goods newsletter');
const aHudson = ad(cHudson, 'image', img(600, 200, green, { color: gold, y: 0, h: 20 }, [{ text: 'HUDSON GOODS', color: gold, scale: 8, y: 50 }, { text: 'MADE IN BROOKLYN', color: cream, scale: 5, y: 120 }]),
  { sponsor: 'Hudson Goods', title: 'Bags made in Brooklyn', url: 'https://hudsongoods.example' });
ad(camp(smoke, 'Waiting for review'), 'native', null, { sponsor: 'Smoke + Salt BBQ', title: 'Late-night brisket, now till 2am', body: 'Open late in East Austin every Friday and Saturday.', cta: 'See hours', url: 'https://smokesalt.example/hours', review: 'pending', created: t0 - 3_600_000 });

// bookings running now, one finished, one waiting for the owner
const today = new Date(); today.setUTCHours(0, 0, 0, 0);
const sod = today.getTime();
booking(sidebar, aSmoke, jess, smoke, 'day', 14, sod - 6 * DAY, 56_000);
booking(inline, aSmokeNative, jess, smoke, 'week', 2, sod - 7 * DAY, 70_000);
booking(top, aHudson, marcus, hudson, 'week', 2, sod - 8 * DAY, 120_000);
const done = booking(sidebar, aSmoke, jess, smoke, 'day', 7, sod - 20 * DAY, 28_000);
market.settle(done);
const reel = booking(posts, aSmokeNative, maya, smoke, 'post', 1, t0 - 2 * DAY, 75_000, { link_code: 'demo42', post_url: 'https://instagram.example/p/brisket-reel', posted_at: t0 - DAY });
db.insert('bookings', { id: id('bk'), slot_id: board.id, ad_id: aFizzBoard.id, account_id: fizz.id, owner_id: agp.id, unit: 'week', qty: 1, starts: sod + 14 * DAY, ends: sod + 21 * DAY,
  amount: 20_000, fee: 3_000, currency: 'USD', status: 'requested', note: 'For the season finale, please.', created: t0 - 3_600_000 });

// two weeks of numbers
const rnd = (a, b) => Math.round(a + Math.random() * (b - a));
for (let d = 13; d >= 0; d--) {
  const day = engine.today(t0 - d * DAY);
  const put = (a, s, b, views, ctr) => { const v = rnd(views * 0.8, views * 1.2); db.run('INSERT INTO stats (day, ad_id, slot_id, booking_id, serves, views, clicks, settled_views) VALUES (?, ?, ?, ?, ?, ?, ?, ?)', day, a.id, s.id, b, Math.round(v * 1.35), v, Math.round(v * ctr * (0.7 + Math.random() * 0.6)), b ? 0 : v); };
  const bk = (s) => db.get(`SELECT id FROM bookings WHERE slot_id = ? AND status = 'live' AND unit <> 'post'`, s.id)?.id ?? '';
  if (d <= 6) put(aSmoke, sidebar, bk(sidebar), 1600, 0.009);
  put(aSmokeNative, inline, bk(inline), 1100, 0.021);
  put(aHudson, top, bk(top), 9000, 0.012);
  put(aFizzCard, channels, '', 2400, 0.008);
  put(aFizzBoard, board, '', 3100, 0.004);
  if (d <= 1) put(aSmokeNative, posts, reel.id, 0, 0);
}
db.run(`UPDATE stats SET clicks = 412, views = 0, serves = 0 WHERE booking_id = ?`, reel.id);
// charge the network views already counted (keep the demo's ledger honest)
db.run('UPDATE stats SET settled_views = 0 WHERE booking_id = \'\'');
market.chargeViews();

writeFileSync(new URL('../demo/ids.json', import.meta.url), JSON.stringify({ sidebar: sidebar.id, inline: inline.id, newsletter: top.id, chat: channels.id, game: board.id, creator: posts.id }, null, 2));
console.log(`Demo data in ${cfg.dataDir}. Sign in as admin@demo.test, jess@demo.test (owner), smoke@demo.test (advertiser) ... with password ${PW}`);
await app.close();
