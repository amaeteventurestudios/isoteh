// The database: one SQLite file (node:sqlite, built into Node 22), made and upgraded on start-up.
// Money is stored in whole minor units with its currency. Times are milliseconds since 1970.
import { DatabaseSync } from 'node:sqlite';
import { mkdirSync } from 'node:fs';
import { join } from 'node:path';

const SCHEMA = [
  `CREATE TABLE IF NOT EXISTS accounts (
    id TEXT PRIMARY KEY, email TEXT UNIQUE NOT NULL, name TEXT NOT NULL, pw TEXT NOT NULL,
    role TEXT NOT NULL DEFAULT 'member', country TEXT, created INTEGER NOT NULL)`,
  `CREATE TABLE IF NOT EXISTS sessions (id TEXT PRIMARY KEY, account_id TEXT NOT NULL, expires INTEGER NOT NULL)`,
  `CREATE TABLE IF NOT EXISTS api_keys (id TEXT PRIMARY KEY, account_id TEXT NOT NULL, hash TEXT UNIQUE NOT NULL, label TEXT, created INTEGER NOT NULL)`,
  // a property is a place ads appear: a website, a newsletter, an app, a game or a creator's channel
  `CREATE TABLE IF NOT EXISTS properties (
    id TEXT PRIMARY KEY, account_id TEXT NOT NULL, kind TEXT NOT NULL, name TEXT NOT NULL, url TEXT,
    about TEXT, keywords TEXT NOT NULL DEFAULT '', country TEXT, audience INTEGER NOT NULL DEFAULT 0,
    currency TEXT NOT NULL DEFAULT 'USD', status TEXT NOT NULL DEFAULT 'active', created INTEGER NOT NULL)`,
  // a slot is one ad space in a property
  `CREATE TABLE IF NOT EXISTS slots (
    id TEXT PRIMARY KEY, property_id TEXT NOT NULL, name TEXT NOT NULL, format TEXT NOT NULL,
    width INTEGER NOT NULL DEFAULT 0, height INTEGER NOT NULL DEFAULT 0, keywords TEXT NOT NULL DEFAULT '',
    price_day INTEGER NOT NULL DEFAULT 0, price_week INTEGER NOT NULL DEFAULT 0, price_post INTEGER NOT NULL DEFAULT 0,
    booking_open INTEGER NOT NULL DEFAULT 1, approve INTEGER NOT NULL DEFAULT 1, network INTEGER NOT NULL DEFAULT 0,
    fee_bps INTEGER, house_ad_id TEXT, status TEXT NOT NULL DEFAULT 'active', created INTEGER NOT NULL)`,
  `CREATE TABLE IF NOT EXISTS campaigns (
    id TEXT PRIMARY KEY, account_id TEXT NOT NULL, name TEXT NOT NULL, status TEXT NOT NULL DEFAULT 'draft',
    starts INTEGER, ends INTEGER, currency TEXT NOT NULL DEFAULT 'USD', budget INTEGER NOT NULL DEFAULT 0,
    cpm INTEGER NOT NULL DEFAULT 0, daily_views INTEGER NOT NULL DEFAULT 0, keywords TEXT NOT NULL DEFAULT '',
    countries TEXT NOT NULL DEFAULT '', priority INTEGER NOT NULL DEFAULT 5, spent INTEGER NOT NULL DEFAULT 0,
    created INTEGER NOT NULL)`,
  `CREATE TABLE IF NOT EXISTS ads (
    id TEXT PRIMARY KEY, campaign_id TEXT NOT NULL, account_id TEXT NOT NULL, kind TEXT NOT NULL,
    sponsor TEXT NOT NULL, title TEXT NOT NULL DEFAULT '', body TEXT NOT NULL DEFAULT '', cta TEXT NOT NULL DEFAULT '',
    url TEXT NOT NULL, image TEXT, width INTEGER NOT NULL DEFAULT 0, height INTEGER NOT NULL DEFAULT 0,
    review TEXT NOT NULL DEFAULT 'pending', review_note TEXT, created INTEGER NOT NULL)`,
  `CREATE TABLE IF NOT EXISTS bookings (
    id TEXT PRIMARY KEY, slot_id TEXT NOT NULL, ad_id TEXT NOT NULL, account_id TEXT NOT NULL, owner_id TEXT NOT NULL,
    unit TEXT NOT NULL, qty INTEGER NOT NULL, starts INTEGER NOT NULL, ends INTEGER NOT NULL,
    amount INTEGER NOT NULL, fee INTEGER NOT NULL, currency TEXT NOT NULL, status TEXT NOT NULL,
    provider TEXT, pay_ref TEXT, link_code TEXT UNIQUE, post_url TEXT, posted_at INTEGER,
    note TEXT, created INTEGER NOT NULL, paid_at INTEGER, settled_at INTEGER)`,
  // every money movement; a balance is the sum of an account's rows in one currency
  `CREATE TABLE IF NOT EXISTS ledger (
    id INTEGER PRIMARY KEY AUTOINCREMENT, at INTEGER NOT NULL, account_id TEXT NOT NULL, kind TEXT NOT NULL,
    amount INTEGER NOT NULL, currency TEXT NOT NULL, booking_id TEXT, campaign_id TEXT, note TEXT)`,
  // a payment we asked a provider for: a booking, or money added for a pay-per-view campaign
  `CREATE TABLE IF NOT EXISTS payments (
    ref TEXT PRIMARY KEY, kind TEXT NOT NULL, target_id TEXT, account_id TEXT NOT NULL, amount INTEGER NOT NULL,
    currency TEXT NOT NULL, provider TEXT NOT NULL, status TEXT NOT NULL DEFAULT 'open', url TEXT, created INTEGER NOT NULL, paid_at INTEGER)`,
  `CREATE TABLE IF NOT EXISTS payouts (
    id TEXT PRIMARY KEY, account_id TEXT NOT NULL, amount INTEGER NOT NULL, currency TEXT NOT NULL,
    method TEXT NOT NULL, details TEXT NOT NULL, status TEXT NOT NULL DEFAULT 'requested', created INTEGER NOT NULL, paid_at INTEGER)`,
  // counts per day, ad and slot; no row ever names a person
  `CREATE TABLE IF NOT EXISTS stats (
    day TEXT NOT NULL, ad_id TEXT NOT NULL, slot_id TEXT NOT NULL, booking_id TEXT NOT NULL DEFAULT '',
    serves INTEGER NOT NULL DEFAULT 0, views INTEGER NOT NULL DEFAULT 0, clicks INTEGER NOT NULL DEFAULT 0,
    settled_views INTEGER NOT NULL DEFAULT 0, PRIMARY KEY (day, ad_id, slot_id, booking_id))`,
  // each ad token counts once per kind; pruned after two days
  `CREATE TABLE IF NOT EXISTS seen (nonce TEXT NOT NULL, kind TEXT NOT NULL, at INTEGER NOT NULL, PRIMARY KEY (nonce, kind))`,
  // a newsletter issue shows one ad to every inbox, so its image and its link always match
  `CREATE TABLE IF NOT EXISTS issues (slot_id TEXT NOT NULL, issue TEXT NOT NULL, ad_id TEXT, booking_id TEXT,
    at INTEGER NOT NULL, PRIMARY KEY (slot_id, issue))`,
  `CREATE TABLE IF NOT EXISTS audit (id INTEGER PRIMARY KEY AUTOINCREMENT, at INTEGER NOT NULL, actor TEXT, action TEXT NOT NULL, detail TEXT)`,
  // organizations: an org is an account of kind 'org' that people reach through members; everyone also has their own
  `CREATE TABLE IF NOT EXISTS members (org_id TEXT NOT NULL, account_id TEXT NOT NULL, role TEXT NOT NULL DEFAULT 'member',
    created INTEGER NOT NULL, PRIMARY KEY (org_id, account_id))`,
  `CREATE TABLE IF NOT EXISTS invites (id TEXT PRIMARY KEY, org_id TEXT NOT NULL, email TEXT NOT NULL, role TEXT NOT NULL,
    created INTEGER NOT NULL, UNIQUE (org_id, email))`,
  // an ad group holds the ads of one campaign that share an audience
  `CREATE TABLE IF NOT EXISTS ad_groups (id TEXT PRIMARY KEY, campaign_id TEXT NOT NULL, account_id TEXT NOT NULL, name TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'active', audience_id TEXT, created INTEGER NOT NULL)`,
  // an audience is a set of places by context (topic, country, kind of place, format, site), never a set of people
  `CREATE TABLE IF NOT EXISTS audiences (id TEXT PRIMARY KEY, account_id TEXT NOT NULL, name TEXT NOT NULL, match TEXT NOT NULL DEFAULT 'any',
    include TEXT NOT NULL DEFAULT '[]', exclude TEXT NOT NULL DEFAULT '[]', lists TEXT NOT NULL DEFAULT '[]', created INTEGER NOT NULL)`,
  // an uploaded list: sites or topics to include or leave out (never emails or people)
  `CREATE TABLE IF NOT EXISTS lists (id TEXT PRIMARY KEY, account_id TEXT NOT NULL, name TEXT NOT NULL, kind TEXT NOT NULL,
    items TEXT NOT NULL, created INTEGER NOT NULL)`,
  // what happened after a click, counted per hour, ad and event name; no row names a person
  `CREATE TABLE IF NOT EXISTS events (hour TEXT NOT NULL, account_id TEXT NOT NULL, ad_id TEXT NOT NULL DEFAULT '', name TEXT NOT NULL,
    n INTEGER NOT NULL DEFAULT 0, value INTEGER NOT NULL DEFAULT 0, currency TEXT NOT NULL DEFAULT '', PRIMARY KEY (hour, account_id, ad_id, name, currency))`,
  `CREATE TABLE IF NOT EXISTS event_sources (account_id TEXT NOT NULL, source TEXT NOT NULL, last_at INTEGER NOT NULL, PRIMARY KEY (account_id, source))`,
  `CREATE TABLE IF NOT EXISTS tickets (id TEXT PRIMARY KEY, account_id TEXT NOT NULL, actor_id TEXT NOT NULL, subject TEXT NOT NULL,
    category TEXT NOT NULL, body TEXT NOT NULL, status TEXT NOT NULL DEFAULT 'open', created INTEGER NOT NULL)`,
  `CREATE INDEX IF NOT EXISTS bookings_slot ON bookings (slot_id, status, starts, ends)`,
  `CREATE INDEX IF NOT EXISTS ledger_account ON ledger (account_id, currency)`,
  `CREATE INDEX IF NOT EXISTS slots_property ON slots (property_id)`,
  `CREATE INDEX IF NOT EXISTS ads_campaign ON ads (campaign_id)`,
  `CREATE INDEX IF NOT EXISTS seen_at ON seen (at)`,
];

export function openDb(dir) {
  let file = ':memory:';
  if (dir !== ':memory:') { mkdirSync(dir, { recursive: true }); file = join(dir, 'isoteh.db'); }
  const db = new DatabaseSync(file);
  db.exec('PRAGMA journal_mode = WAL; PRAGMA foreign_keys = ON; PRAGMA busy_timeout = 3000;');
  for (const s of SCHEMA) db.exec(s);
  // columns added after the first release
  const cols = (t) => db.prepare(`PRAGMA table_info(${t})`).all().map((c) => c.name);
  for (const [t, c, def] of [['accounts', 'kind', "TEXT NOT NULL DEFAULT 'person'"], ['accounts', 'website', 'TEXT'], ['accounts', 'totp', 'TEXT'],
    ['accounts', 'totp_on', 'INTEGER NOT NULL DEFAULT 0'], ['accounts', 'slack_url', 'TEXT'], ['accounts', 'setup_hidden', 'INTEGER NOT NULL DEFAULT 0'],
    ['sessions', 'org_id', 'TEXT'], ['ads', 'group_id', 'TEXT']]) if (!cols(t).includes(c)) db.exec(`ALTER TABLE ${t} ADD COLUMN ${c} ${def}`);
  const q = (sql) => cache.get(sql) ?? cache.set(sql, db.prepare(sql)).get(sql);
  const cache = new Map();
  return {
    raw: db,
    get: (sql, ...a) => q(sql).get(...a),
    all: (sql, ...a) => q(sql).all(...a),
    run: (sql, ...a) => q(sql).run(...a),
    tx(fn) {
      db.exec('BEGIN IMMEDIATE');
      try { const r = fn(); db.exec('COMMIT'); return r; } catch (e) { db.exec('ROLLBACK'); throw e; }
    },
    /** Insert an object's own fields into a table. */
    insert(table, row) {
      const keys = Object.keys(row);
      return q(`INSERT INTO ${table} (${keys.join(',')}) VALUES (${keys.map(() => '?').join(',')})`).run(...keys.map((k) => row[k] ?? null));
    },
    /** Update the named fields of one row by id. */
    patch(table, rowId, fields) {
      const keys = Object.keys(fields);
      if (!keys.length) return;
      return q(`UPDATE ${table} SET ${keys.map((k) => `${k} = ?`).join(', ')} WHERE id = ?`).run(...keys.map((k) => fields[k] ?? null), rowId);
    },
    close: () => db.close(),
  };
}
