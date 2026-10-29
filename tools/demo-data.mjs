// Fills a fresh data folder with a believable demo: five places (a food blog, a newsletter, a chat app, a racing game, a
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
const acct = (email, name, role = 'member') => { const a = { id: id('ac'), email, name, pw: hashPassword(PW), role, country: 'NG', created: t0 - 40 * DAY }; db.insert('accounts', a); return a; };
const prop = (a, kind, name, extra) => { const p = { id: id('pr'), account_id: a.id, kind, name, status: 'active', created: t0 - 30 * DAY, keywords: '', audience: 0, currency: 'NGN', ...extra }; db.insert('properties', p); return p; };
const slot = (p, name, format, extra) => { const s = { id: id('sl'), property_id: p.id, name, format, width: 0, height: 0, keywords: '', price_day: 0, price_week: 0, price_post: 0, booking_open: 1, approve: 1, network: 0, status: 'active', created: t0 - 30 * DAY, ...extra }; db.insert('slots', s); return s; };
const camp = (a, name, extra) => { const c = { id: id('cp'), account_id: a.id, name, status: 'active', currency: 'NGN', budget: 0, cpm: 0, daily_views: 0, keywords: '', countries: '', priority: 5, spent: 0, created: t0 - 20 * DAY, ...extra }; db.insert('campaigns', c); return c; };
const img = (w, h, bg, band, lines) => creatives.save(png(w, h, { bg, band, lines }).toString('base64'));
const ad = (c, kind, f, extra) => { const a = { id: id('ad'), campaign_id: c.id, account_id: c.account_id, kind, review: 'approved', created: t0 - 20 * DAY, title: '', body: '', cta: '', image: f?.file ?? null, width: f?.width ?? 0, height: f?.height ?? 0, ...extra }; db.insert('ads', a); return a; };
const booking = (s, a, owner, buyer, unit, qty, starts, amount, extra = {}) => {
  const b = { id: id('bk'), slot_id: s.id, ad_id: a.id, account_id: buyer.id, owner_id: owner.id, unit, qty, starts, ends: starts + qty * (unit === 'week' ? 7 : unit === 'day' ? 1 : 14) * DAY,
    amount, fee: Math.round(amount * cfg.feeBps / 10_000), currency: 'NGN', status: 'live', provider: 'paystack', created: starts - DAY, paid_at: starts - DAY, ...extra };
  db.insert('bookings', b);
  market.move([{ account_id: 'escrow', kind: 'payment', amount, currency: 'NGN', booking_id: b.id }, { account_id: 'outside', kind: 'payment', amount: -amount, currency: 'NGN', booking_id: b.id }], b.paid_at);
  return b;
};

// people
acct('admin@demo.test', 'Demo staff', 'admin');
const chioma = acct('chioma@demo.test', 'Chioma Eze');
const ama = acct('ama@demo.test', 'Ama Owusu');
const jisst = acct('jisst@demo.test', 'Jisst');
const agp = acct('agp@demo.test', 'Agent Grand Prix');
const tobi = acct('tobi@demo.test', 'Tobi Adeyemi');
const suya = acct('suya@demo.test', 'Suya Spot');
const zobo = acct('zobo@demo.test', 'Zobo Fizz');
const kente = acct('kente@demo.test', 'Kente Co');

// places and slots
const blog = prop(chioma, 'site', 'Lagos Food Blog', { url: 'https://lagosfood.example', about: 'Recipes, street food and restaurant reviews from Lagos.', keywords: 'food, lagos, recipes, restaurants', country: 'NG', audience: 48000 });
const sidebar = slot(blog, 'Sidebar', 'banner', { width: 300, height: 250, price_day: 500_000, price_week: 3_000_000, network: 1, keywords: 'food' });
const inline = slot(blog, 'Inside articles', 'native', { price_week: 4_500_000, network: 1, keywords: 'food' });
const brief = prop(ama, 'newsletter', 'The Accra Brief', { url: 'https://accrabrief.example', about: 'Five stories from Accra every weekday morning.', keywords: 'news, accra, business', country: 'GH', audience: 21000, currency: 'GHS' });
const top = slot(brief, 'Top of every issue', 'email', { width: 600, height: 200, price_week: 150_000 });
const chat = prop(jisst, 'app', 'Jisst public channels', { url: 'https://jisst.example', about: 'Cards in public channels and the Status tab. Never in private chats.', keywords: 'chat, football, music, games, food', audience: 9000 });
const channels = slot(chat, 'Channel card', 'native', { price_week: 2_000_000, network: 1, approve: 0 });
const game = prop(agp, 'game', 'Agent Grand Prix', { url: 'https://agentgrandprix.com', about: 'Racing in Abuja and Lagos. Boards line the main straight.', keywords: 'racing, cars, games, abuja, lagos', audience: 12000 });
const board = slot(game, 'Main straight board', 'game', { width: 1024, height: 512, price_week: 2_500_000, network: 1 });
const creator = prop(tobi, 'creator', 'Tobi on Instagram', { url: 'https://instagram.example/tobi', about: 'Fashion and food reels from Ibadan.', keywords: 'fashion, food, ibadan', country: 'NG', audience: 86000 });
const posts = slot(creator, 'Sponsored reel', 'creator', { price_post: 7_500_000 });

// ads
const terracotta = [195, 66, 24], cream = [246, 241, 234], ink = [29, 27, 25], green = [33, 110, 70], gold = [214, 160, 40];
const cSuya = camp(suya, 'Suya Spot in Yaba');
const aSuya = ad(cSuya, 'image', img(300, 250, ink, { color: terracotta, y: 170, h: 80 }, [{ text: 'SUYA SPOT', color: gold, scale: 6, y: 40 }, { text: 'BEST SUYA', color: cream, scale: 4, y: 110 }, { text: 'ORDER NOW', color: cream, scale: 4, y: 196 }]),
  { sponsor: 'Suya Spot', title: 'The best suya in Yaba', url: 'https://suyaspot.example/menu' });
const aSuyaNative = ad(cSuya, 'native', img(160, 160, terracotta, null, [{ text: 'SUYA', color: cream, scale: 7, y: 62 }]),
  { sponsor: 'Suya Spot', title: 'Suya delivered hot in 30 minutes', body: 'Beef, chicken and ram suya from our grill in Yaba, with yaji on the side.', cta: 'Order now', url: 'https://suyaspot.example/order' });
const cZobo = camp(zobo, 'Zobo Fizz launch', { cpm: 150_000, budget: 25_000_000, keywords: 'racing, games, chat, food, football', spent: 0 });
market.move([{ account_id: zobo.id, kind: 'topup', amount: 25_000_000, currency: 'NGN' }, { account_id: 'outside', kind: 'topup', amount: -25_000_000, currency: 'NGN' }], t0 - 20 * DAY);
market.move([{ account_id: zobo.id, kind: 'hold', amount: -25_000_000, currency: 'NGN', campaign_id: cZobo.id }, { account_id: 'escrow', kind: 'hold', amount: 25_000_000, currency: 'NGN', campaign_id: cZobo.id }], t0 - 20 * DAY);
const aZoboBoard = ad(cZobo, 'image', img(1024, 512, [120, 20, 40], { color: gold, y: 380, h: 132 }, [{ text: 'ZOBO FIZZ', color: cream, scale: 22, y: 90 }, { text: 'COLD. RED. NIGERIAN.', color: ink, scale: 9, y: 420 }]),
  { sponsor: 'Zobo Fizz', title: 'Cold. Red. Nigerian.', url: 'https://zobofizz.example' });
const aZoboCard = ad(cZobo, 'native', img(160, 160, [120, 20, 40], null, [{ text: 'ZOBO', color: cream, scale: 7, y: 62 }]),
  { sponsor: 'Zobo Fizz', title: 'Zobo Fizz is here', body: 'Hibiscus, ginger and a little pineapple. Find it in the fridge at your nearest shop.', cta: 'Find a shop', url: 'https://zobofizz.example/shops' });
const cKente = camp(kente, 'Kente Co newsletter', { currency: 'GHS' });
const aKente = ad(cKente, 'image', img(600, 200, green, { color: gold, y: 0, h: 20 }, [{ text: 'KENTE CO', color: gold, scale: 9, y: 50 }, { text: 'WOVEN IN BONWIRE', color: cream, scale: 5, y: 120 }]),
  { sponsor: 'Kente Co', title: 'Woven in Bonwire', url: 'https://kenteco.example' });
ad(camp(suya, 'Waiting for review'), 'native', null, { sponsor: 'Suya Spot', title: 'Late-night suya, now till 2am', body: 'Open late in Yaba every Friday and Saturday.', cta: 'See hours', url: 'https://suyaspot.example/hours', review: 'pending', created: t0 - 3_600_000 });

// bookings running now, one finished, one waiting for the owner
const today = new Date(); today.setUTCHours(0, 0, 0, 0);
const sod = today.getTime();
booking(sidebar, aSuya, chioma, suya, 'day', 14, sod - 6 * DAY, 7_000_000);
booking(inline, aSuyaNative, chioma, suya, 'week', 2, sod - 7 * DAY, 9_000_000);
booking(top, aKente, ama, kente, 'week', 2, sod - 8 * DAY, 300_000, { currency: 'GHS' });
db.run(`UPDATE ledger SET currency = 'GHS' WHERE booking_id = (SELECT id FROM bookings WHERE slot_id = ?)`, top.id);
const done = booking(sidebar, aSuya, chioma, suya, 'day', 7, sod - 20 * DAY, 3_500_000);
market.settle(done);
const reel = booking(posts, aSuyaNative, tobi, suya, 'post', 1, t0 - 2 * DAY, 7_500_000, { link_code: 'demo42', post_url: 'https://instagram.example/p/suya-reel', posted_at: t0 - DAY });
db.insert('bookings', { id: id('bk'), slot_id: board.id, ad_id: aZoboBoard.id, account_id: zobo.id, owner_id: agp.id, unit: 'week', qty: 1, starts: sod + 14 * DAY, ends: sod + 21 * DAY,
  amount: 2_500_000, fee: 375_000, currency: 'NGN', status: 'requested', note: 'For the Lagos round, please.', created: t0 - 3_600_000 });

// two weeks of numbers
const rnd = (a, b) => Math.round(a + Math.random() * (b - a));
for (let d = 13; d >= 0; d--) {
  const day = engine.today(t0 - d * DAY);
  const put = (a, s, b, views, ctr) => { const v = rnd(views * 0.8, views * 1.2); db.run('INSERT INTO stats (day, ad_id, slot_id, booking_id, serves, views, clicks, settled_views) VALUES (?, ?, ?, ?, ?, ?, ?, ?)', day, a.id, s.id, b, Math.round(v * 1.35), v, Math.round(v * ctr * (0.7 + Math.random() * 0.6)), b ? 0 : v); };
  const bk = (s) => db.get(`SELECT id FROM bookings WHERE slot_id = ? AND status = 'live' AND unit <> 'post'`, s.id)?.id ?? '';
  if (d <= 6) put(aSuya, sidebar, bk(sidebar), 1600, 0.009);
  put(aSuyaNative, inline, bk(inline), 1100, 0.021);
  put(aKente, top, bk(top), 9000, 0.012);
  put(aZoboCard, channels, '', 2400, 0.008);
  put(aZoboBoard, board, '', 3100, 0.004);
  if (d <= 1) put(aSuyaNative, posts, reel.id, 0, 0);
}
db.run(`UPDATE stats SET clicks = 412, views = 0, serves = 0 WHERE booking_id = ?`, reel.id);
// charge the network views already counted (keep the demo's ledger honest)
db.run('UPDATE stats SET settled_views = 0 WHERE booking_id = \'\'');
market.chargeViews();

writeFileSync(new URL('../demo/ids.json', import.meta.url), JSON.stringify({ sidebar: sidebar.id, inline: inline.id, newsletter: top.id, chat: channels.id, game: board.id, creator: posts.id }, null, 2));
console.log(`Demo data in ${cfg.dataDir}. Sign in as admin@demo.test, chioma@demo.test, suya@demo.test ... with password ${PW}`);
await app.close();
