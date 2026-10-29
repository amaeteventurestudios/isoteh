# Isoteh

**Advertising on your terms.**

Isoteh (ee-shaw-teh) takes its name from the Yoruba word ìṣọtẹ̀, rebellion: a break from ad networks that set the
rules, take the biggest cut and track people.

A modern ad server you run yourself. It shows ads on websites and blogs, in email newsletters, in apps and chat (Jisst),
inside games, and it handles creators' brand deals. It is its own product: Jisst, Agent Grand Prix, Palasora and anyone
else plug into it as customers.

- **Direct sales first.** Owners list ad slots with prices per day, week or post. Advertisers book, upload and pay up front.
  The money is held while the ad runs and paid to the owner automatically, less our fee (15% by default).
- **Local money.** Prices in NGN, GHS, KES, ZAR and more. Paystack (cards, bank, USSD, mobile money), Stripe (cards), or a
  bank transfer that staff confirm. Payouts by bank, mobile money or PayPal.
- **No tracking.** Ads are picked by the page's topic and the visitor's country, never by following people. No cookies
  for visitors, and nothing stored about them.
- **Honest numbers.** A view counts once, only when the ad was actually seen (half on screen for a second; in games, the
  in-game ad rules). Clicks go through us once. Newsletter opens are marked as estimates.
- **Safe ads.** Images only (checked by their bytes), served from our own address. No HTML or scripts in ads, so a
  hacked ad can't attack readers the way old Revive servers were used. Every ad is checked by staff before it runs.
- **Never in private chats.** Apps pass `ctx=private` and get nothing back.

Plain Node 22 with no dependencies: the database is SQLite, built into Node. No outside code at all.

## Where ads go

| Place | How |
| --- | --- |
| Any website | `<div data-isoteh="SLOT"></div>` and one `<script src=".../s/isoteh.js">` |
| WordPress | `wordpress/isoteh/isoteh.php` plugin, then `[isoteh slot="SLOT"]` (or the website code in a Custom HTML block) |
| Ghost | The website code in an HTML card, or Code injection |
| Newsletters (Ghost, Beehiiv, Kit, Mailchimp) | An HTML block: `/e/SLOT.png?i=ISSUE` inside a link to `/e/SLOT/c?i=ISSUE` |
| Substack | `/e/SLOT/kit?i=ISSUE` gives the image and the tracked link to paste in |
| Apps and Jisst | `sdk/native/isoteh-native.mjs`: `getNativeAd({ server, slot, keywords })` |
| Three.js games | `sdk/game/isoteh-three.mjs`: `new AdBoard(THREE, { server, slot, width, height })` |
| Other engines (Unity, Godot) | `GET /v1/ad?slot=SLOT` gives JSON with the image, a view link and a click link; `sdk/game/isoteh-game.mjs` holds the view rules |
| Creators | The slot's booking page `/book/SLOT`; each paid post gets a tracked link `/go/CODE` |

The dashboard (`/app`) gives the exact code for every slot.

## Run and test

```
npm test                                                        # 9 tests: bookings, money, newsletters, creators, webhooks, safety
ISOTEH_DATA=/tmp/isoteh-demo npm run demo                       # demo data (passwords in the output)
ISOTEH_DATA=/tmp/isoteh-demo npm start                          # http://127.0.0.1:8400, demos at /demo/
```

See `docs/HANDOFF.md` for how it works inside, the money rules, the server install and what comes next.
