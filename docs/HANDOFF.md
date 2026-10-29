# Isoteh handoff

Written 29 October 2026, when the first version was built (as "Billbo", renamed the same day). The name is the owner's:
ISOTEH in the logo, Isoteh in sentences, said ee-shaw-teh, from the Yoruba ìṣọtẹ̀ (rebellion). Tagline: "Advertising on
your terms." The shown brand comes from one setting (`ISOTEH_BRAND`, default Isoteh).

## Why it exists
Research in the project ("Ad server research: what's broken") found the same gap everywhere: people with an audience
can't easily sell their own ads directly, get paid fast, and keep their pages fast without tracking
readers. Revive is the biggest free ad server, but it is old PHP software under the GPL; unpatched copies were hacked to
inject malicious ads. Google, Unity, AdMob and Substack each keep owners inside their own garden. No ad server covers
websites, newsletters, apps and games in one place, and in-world game ads are sold only by closed companies.

## What it does today
- **Places and slots.** An owner adds places (website, newsletter, app, game, creator channel) and slots in them: banner,
  native card, newsletter block, in-game board or sponsored post, with prices per day, week or post, in their currency.
- **Direct bookings.** Advertisers find space at `/market`, book at `/book/<slot>`, upload an ad, and pay. The owner can
  approve each booking first (`approve`). Dates can't be double-sold; an unpaid booking holds its dates for 30 minutes.
- **Money held, then paid out.** Payment goes to escrow. When the booking ends the owner gets the amount less the fee;
  creator posts pay out `ISOTEH_RELEASE_DAYS` (3) after the creator adds the post link, or at once when the brand confirms.
  Disputes go to staff, who pay the owner or refund the advertiser (as credit). Owners ask for payouts; staff send them.
- **Pay-per-view network.** Advertisers add credit and run campaigns priced per 1,000 views. They show only on slots
  whose owners opted in (`network`), matched by topic words and country. Starting a campaign holds its budget; views are
  charged every minute; the rest comes back when it ends.
- **House ads and "Advertise here".** A slot can show the owner's own ad when unsold, or an "Advertise here" card linking
  to its booking page.
- **Counting.** Every served ad carries a signed token. Views count once, when the browser, app or game reports the ad
  was really seen. Clicks count once and redirect with `utm_source` and `utm_medium`. Robots are ignored. No visitor data
  is stored; rate limits use a daily-rotating hash held only in memory.
- **Review.** Every ad from a member waits for staff approval; any change sends it back. Ads are images or plain text.
- **Dashboard** (`/app`): My places (with copy-and-paste code per slot), My ads, Bookings, Money, Reports, Staff
  (review queue, transfers to confirm, payouts, disputes, team roles) and Settings (API keys).
- **Payments.** The home market is the US: prices default to USD and Stripe is the main way to pay (`STRIPE_SECRET_KEY`,
  `STRIPE_WEBHOOK_SECRET`; webhook `/hooks/stripe`, event `checkout.session.completed`). Manual ACH or wire transfers are
  confirmed by staff (set `ISOTEH_PAY_INSTRUCTIONS` to the account to pay into). For African markets, Paystack
  (`PAYSTACK_SECRET_KEY`; webhook `/hooks/paystack`). Webhooks check the signature and the amount.

## Inside
| File | Job |
| --- | --- |
| `server.mjs` | Starts it |
| `lib/config.mjs` | Every setting, from the environment |
| `lib/db.mjs` | The SQLite schema (made on start-up) |
| `lib/engine.mjs` | Which ad a slot shows, and counting serves, views and clicks |
| `lib/market.mjs` | Bookings, the ledger, campaigns' budgets, payouts and the one-minute `tick()` |
| `lib/payments.mjs` | Paystack, Stripe and manual payments, and their webhooks |
| `lib/creatives.mjs` | Checking and storing ad images |
| `lib/snippets.mjs` | The code an owner pastes, per kind of place |
| `lib/app.mjs` | Every web address |
| `public/` | The dashboard and public pages (no framework) |
| `sdk/web/isoteh.js` | The website script |
| `sdk/native/isoteh-native.mjs` | Native cards for apps and Jisst |
| `sdk/game/isoteh-game.mjs`, `isoteh-three.mjs` | In-game ads: the view rules, and a Three.js billboard |
| `wordpress/isoteh/isoteh.php` | The WordPress plugin (GPL, as WordPress plugins are; it is a 40-line shortcode, nothing else) |
| `demo/` | A food blog, a newsletter, a Jisst channel and a racing game using the real SDKs |
| `tools/demo-data.mjs`, `tools/grant.mjs`, `tools/png.mjs` | Demo data, giving a role from the shell, drawing PNGs |

Money: whole minor units (cents) with an ISO currency; never a hard-coded symbol. Every ledger movement is a set
of rows that sums to zero across accounts (people's ids plus `escrow`, `platform`, `payouts_pending`, `outside`); the
tests check the whole ledger sums to zero.

## Server
`.github/workflows/deploy.yml` tests every push. Deploying needs the repository variable `DEPLOY_ENABLED=yes` and the
same three secrets the games use (`SERVER_HOST`, `SERVER_USER`, `SERVER_SSH_KEY`). `deploy/install.sh` then installs
service `isoteh` on 127.0.0.1:8400 with data in `/var/lib/isoteh`, nightly backups in `/var/backups/isoteh`, a Caddy site
file, and the spare address `ads.129-146-26-28.sslip.io`. Set the variable `ADS_DOMAIN` once a real name points at the
server. In production nobody becomes administrator by signing up first: set the secret `ISOTEH_ADMIN_EMAIL`, or run
`tools/grant.mjs <email> admin` on the server.

## Not done yet (next steps)
1. A domain (then the variable `ADS_DOMAIN`).
2. A repository, then deploy.
3. Stripe Connect for automatic US payouts (today staff send payouts by hand and press Sent); Paystack Transfers later
   for African markets.
4. Prebid (Apache 2.0) to fill unsold slots from outside ad exchanges.
5. Sign in with Noveniqe (Core) as a second way in, so Jisst and the games share accounts.
6. Unity and Godot packages (the JSON API and rules already work for any engine).
7. Email notices (booking requests, payments, payouts); today everything shows in the dashboard.
8. Video ads, and car liveries and track signs inside Agent Grand Prix itself.
