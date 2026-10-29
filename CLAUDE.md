# Isoteh: working notes for Claude Code

A self-hosted ad server for websites, newsletters, apps (Jisst), games and creators. Its own product; Noveniqe's apps
plug into it like any customer. Read `docs/HANDOFF.md` first.

## Conventions
- Plain Node 22, no dependencies (SQLite through `node:sqlite`, run with `--experimental-sqlite`). Only add outside code
  under MIT, Apache 2.0 or BSD. Never copy from Revive or other GPL ad servers.
- Money is whole minor units plus an ISO currency. Never hard-code a currency symbol. Every ledger movement goes through
  `market.move()` and must sum to zero.
- Ads are images or plain text only. Never accept HTML or scripts in an ad.
- No visitor tracking: no cookies for visitors, no stored IPs or ids. Context (topic words, country) only.
- Never serve ads in private chats (`ctx=private`). Every ad shows the label "Sponsored".
- Public content never mentions USG companies or Palasora's private plans. Real place names are fine; businesses in demos
  are invented.
- Phone-first: check the dashboard at 390×844 and 1280×800, light and dark.

## Testing
`npm test`. For a look: `ISOTEH_DATA=/tmp/bb npm run demo && ISOTEH_DATA=/tmp/bb npm start`, then the pages under
`/demo/`, `/market` and `/app` (demo passwords print when the demo data is made). Check the browser console for errors.
