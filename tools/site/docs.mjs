// The docs wiki, in sidebar order. Each page: slug, title, nav (optional short name), lede, body (HTML; h2 and h3 build
// "On this page"). Written in plain words: say what happens, give the code, say what can go wrong.
import { SITE, code, tabs, steps, note, table, cards } from './kit.mjs';
import { FLOW, LIFE, VIEW, GAME, MONEY, MAIL, CONV } from './figs.mjs';

const B = SITE.url, S = 'sl_your_slot';
const WEB = `<div data-isoteh="${S}"></div>\n<script async src="${B}/s/isoteh.js"></script>`;

export const DOCS = [
  { group: 'Get started', pages: [
    { slug: 'index', title: 'Introduction', lede: 'Isoteh is one ad network for blogs, newsletters, apps, chat and games. Owners sell the space they already have, brands book it directly, and nobody reading is tracked.',
      body: `
<h2>Who these docs are for</h2>
${cards([['/docs/quickstart-owners', 'Owners', 'You run a site, a newsletter, an app, a game or a channel and want to sell ad space.'], ['/docs/quickstart-brands', 'Brands', 'You want your ad inside the pages, inboxes and games your customers already use.']])}
<h2>Owners</h2>
<ul>
<li><a href="/docs/quickstart-owners">Owner quickstart</a>: list a space and paste two lines.</li>
<li><a href="/docs/integration-guide">Integration guide</a>: the whole process, from picking a spot to getting paid.</li>
<li><a href="/docs/websites">Websites and blogs</a>, <a href="/docs/newsletters">newsletters</a>, <a href="/docs/apps">apps and chat</a>, <a href="/docs/games">games</a> and <a href="/docs/creators">creators</a>.</li>
<li><a href="/docs/getting-paid">Getting paid</a>: when money is held, when it moves, and how to withdraw it.</li>
</ul>
<h2>Brands</h2>
<ul>
<li><a href="/docs/quickstart-brands">Brand quickstart</a>: find a space, book it and upload your ad.</li>
<li><a href="/docs/campaigns">Campaigns</a>: pay per 1,000 views across every owner who opts in.</li>
<li><a href="/docs/pixel">Pixel and Conversions API</a>: count sales from your ads without tracking anyone.</li>
<li><a href="/docs/ad-rules">Ad rules and sizes</a>: what an ad can be, and what is never allowed.</li>
</ul>
<h2>More</h2>
<ul>
<li><a href="/docs/how-it-works">How it works</a>, <a href="/docs/counting">how views count</a> and the <a href="/docs/api">API reference</a>.</li>
<li><a href="/docs/sdks">SDKs</a> for websites, apps, chat and games.</li>
<li><a href="/docs/changelog">Changelog</a> and <a href="/docs/ai-tools">docs for AI tools</a>.</li>
</ul>` },

    { slug: 'how-it-works', title: 'How it works', lede: 'A brand pays first, the owner approves, the ad runs where it fits, and the owner is paid once it has run.',
      body: `
${FLOW}
<h2>The four rules</h2>
<ul>
<li><strong>The owner decides.</strong> They set the price for a day, a week or a post, and approve every ad before it runs.</li>
<li><strong>The brand pays up front.</strong> Money is held while the ad runs and only then paid out. Owners never chase an invoice.</li>
<li><strong>The ad, not the person.</strong> Views and clicks are counted. Nothing about the reader is stored: no cookies, no profiles, no IP addresses.</li>
<li><strong>Always labelled.</strong> Every ad carries the word Sponsored, and ads never appear in private chats.</li>
</ul>
<h2>Two ways to buy</h2>
${table(['', 'Direct booking', 'Campaign'], [
  ['How it is priced', 'The owner\'s price for a day, a week or a post', 'A price per 1,000 views you set'],
  ['Where it runs', 'One space you picked', 'Every space whose owner opted in, matched by topic and country'],
  ['Who approves', 'The owner, before it runs', 'Isoteh reviews the ad; owners choose to join the network'],
  ['When money moves', 'Held at booking, paid to the owner after it ran', 'Budget held at start, charged per minute as views come in, the rest returned'],
])}
<h2>What the owner pastes</h2>
<p>Each kind of place has its own small piece of code: a script line for websites, an HTML block for newsletters, a function for apps, a billboard for games and a booking page for creators. The dashboard gives you the right one for each space. See the <a href="/docs/integration-guide">integration guide</a>.</p>
<h2>What happens to one ad</h2>
${LIFE}
<p>Each ad comes with a signed token. The view link and the click link carry that token, so we can count each view and click once without knowing who saw it. See <a href="/docs/counting">how views count</a>.</p>` },

    { slug: 'core-concepts', title: 'Core concepts', lede: 'The handful of words used across Isoteh, in the order you meet them.',
      body: `
<h2>Places and spaces</h2>
<p>A <strong>place</strong> is something you own with an audience: a website, a newsletter, an app, a game or a creator channel. A <strong>space</strong> (called a slot in the code and the API) is one spot inside it where an ad can go: a banner, a native card, a newsletter block, a billboard in a game or a sponsored post. Every space has an id that starts with <code>sl_</code>.</p>
${table(['Kind of space', 'Where it lives', 'Priced by'], [
  ['Banner', 'A website or app', 'Day or week'],
  ['Native card', 'A feed, a channel or under an AI answer, drawn in your own style', 'Day or week'],
  ['Email block', 'A newsletter issue', 'Issue or week'],
  ['Game board', 'A surface inside a game world', 'Day or week'],
  ['Creator post', 'A post on your own channel', 'Post'],
])}
<h2>Bookings</h2>
<p>A <strong>booking</strong> is a brand buying one space for set dates. Dates can't be sold twice. An unpaid booking holds its dates for 30 minutes, then lets them go.</p>
<h2>Campaigns</h2>
<p>A <strong>campaign</strong> is a budget a brand spends per 1,000 views across many spaces at once. Campaigns hold <strong>ad groups</strong>, which hold <strong>ads</strong>. They only show on spaces whose owners opted into the network.</p>
<h2>Views, clicks and events</h2>
<ul>
<li>A <strong>view</strong> counts once when at least half the ad has been on screen for a second. See <a href="/docs/counting">how views count</a>.</li>
<li>A <strong>click</strong> counts once and sends the reader on to the brand's page.</li>
<li>An <strong>event</strong> is what happened after a click, like a sign-up or a purchase, sent by the brand. See <a href="/docs/pixel">Pixel and Conversions API</a>.</li>
</ul>
<h2>Money</h2>
<p>All amounts are kept in whole cents with a currency code, so <code>50000 USD</code> is $500.00. Isoteh keeps 15% of each booking; the owner keeps 85%. See <a href="/docs/getting-paid">getting paid</a>.</p>` },

    { slug: 'quickstart-owners', title: 'Owner quickstart', lede: 'List a space, paste two lines, and your first booking can arrive the same day.',
      body: `
${steps([
  ['Make an account', `<p><a href="/app#signup">Sign up</a> and pick Owner. Listing is free and there is no traffic minimum.</p>`],
  ['Add your place', '<p>In the dashboard, open Places and add your site, newsletter, app, game or channel. Give it a few topic words, like <code>coffee, austin, recipes</code>, so fitting brands find it.</p>'],
  ['Add a space and set its price', '<p>Pick the kind of space and its size, then a price per day, per week or per post. Turn on Approve each ad if you want to see every ad first (it is on by default).</p>'],
  ['Paste the code', `<p>Copy the code shown under the space and paste it where the ad should appear.</p>${code(WEB, 'HTML')}`],
  ['Share your booking page', `<p>Every space has its own page at <code>${B}/book/${S}</code>. Link to it from an Advertise with us page. Your space also appears in the <a href="/market">marketplace</a>.</p>`],
])}
${note('Until a brand books, your space can show your own house ad, an Advertise here card that links to your booking page, or nothing at all. Pick it in the space\'s settings.', 'tip')}
<h2>Next</h2>
${cards([['/docs/integration-guide', 'Integration guide', 'The full process for every kind of place.'], ['/docs/getting-paid', 'Getting paid', 'When money is held and when it moves.']])}` },

    { slug: 'quickstart-brands', title: 'Brand quickstart', lede: 'Find a space that fits, book it, upload your ad and pay. It goes live when the owner approves it.',
      body: `
${steps([
  ['Make an account', '<p><a href="/app#signup">Sign up</a> and pick Brand.</p>'],
  ['Find space', '<p>Open the <a href="/market">marketplace</a> and filter by kind of place, topic and country. Each listing shows the audience, the price and the dates still free.</p>'],
  ['Book and upload', '<p>Pick dates and upload your ad: an image (PNG, JPEG, WebP or GIF, up to 1.5 MB) or plain text with a title, a line and a button. See <a href="/docs/ad-rules">ad rules and sizes</a>.</p>'],
  ['Pay', '<p>Pay by card through Stripe, or by bank transfer. The money is held, not paid to the owner yet.</p>'],
  ['Wait for approval', '<p>The owner approves the ad, and we check it. If the owner says no, your money comes back.</p>'],
  ['Count the results', '<p>Views and clicks show in Reports by ad and by day. Add the <a href="/docs/pixel">events tag</a> to count sales too.</p>'],
])}
${note('Want to reach many owners at once instead of booking one space? Start a <a href="/docs/campaigns">campaign</a> and pay per 1,000 views.')}` },
  ] },

  { group: 'Owners', pages: [
    { slug: 'integration-guide', title: 'Integration guide', lede: 'The full process to add Isoteh ads to a site, a newsletter, an app or a game, from picking the spot to getting paid. For the short version, see the owner quickstart.',
      body: `
<h2>Before you start</h2>
<ul><li>You have an Isoteh account set to Owner. See the <a href="/docs/quickstart-owners">owner quickstart</a>.</li><li>You can edit the page, template, email or code where the ad will go.</li></ul>
<h2>Process overview</h2>
${steps([
  ['Design', '<p>Decide where ads go and how many. One ad near the top of an article and one in the middle of a newsletter is plenty for most places.</p>'],
  ['Create the spaces', '<p>Add each spot as a space in the dashboard, with its size and price. Each gets an id like <code>sl_8f2k…</code>.</p>'],
  ['Integrate', '<p>Paste the code for your kind of place (below). The dashboard shows the same code with your own ids.</p>'],
  ['Test', '<p>Open your page. You should see your house ad or the Advertise here card. Check the dashboard: the space shows its first serve within a minute.</p>'],
  ['Go live', '<p>Make the space bookable and, if you like, join the network so campaigns can fill unsold days.</p>'],
  ['Approve and get paid', '<p>Approve bookings as they arrive. Money moves to your balance after each booking has run.</p>'],
])}
<h2>Pick the code for your place</h2>
${table(['Place', 'What you paste', 'Guide'], [
  ['Website or blog', 'A div and one script line', '<a href="/docs/websites">Websites and blogs</a>'],
  ['WordPress', 'A shortcode, after a 40-line plugin', '<a href="/docs/websites#wordpress">WordPress</a>'],
  ['Newsletter', 'An HTML block with the issue name', '<a href="/docs/newsletters">Newsletters</a>'],
  ['App or chat', 'One function call, drawn in your own style', '<a href="/docs/apps">Apps and chat</a>'],
  ['Three.js game', 'A billboard mesh', '<a href="/docs/games">Games</a>'],
  ['Any other engine', 'A JSON request and two links', '<a href="/docs/games#any-engine">Any engine</a>'],
  ['Creator channel', 'Nothing: share your booking page', '<a href="/docs/creators">Creators</a>'],
])}
<h2>Use the SDK or the API</h2>
<p><strong>Use an SDK</strong> when you want the view counting done for you. The website script, the native SDK and the game SDK all measure what is really on screen and send the view once.</p>
<p><strong>Use the API</strong> when you draw everything yourself, for example in Unity, Godot or a server-rendered page. You call <a href="/docs/api-ad"><code>GET /v1/ad</code></a> and then call the view link once the ad has been seen. You are then responsible for the view rule.</p>
${note('Never count a view the reader did not see. Views counted against the rule are found in review, and those bookings can be refunded to the brand.', 'warn')}
<h2>Examples</h2>
<h3>Website</h3>
${code(WEB, 'HTML')}
<h3>App or chat</h3>
${code(`import { getNativeAd } from '${B}/s/isoteh-native.mjs';

const card = await getNativeAd({ server: '${B}', slot: '${S}', keywords: 'coffee, austin' });
if (card) {
  show(card);      // your own component, with card.label ("Sponsored") on it
  card.seen();     // once it has been half on screen for a second
}`, 'JavaScript')}
<h3>Three.js game</h3>
${code(`import { AdBoard } from '${B}/s/isoteh-three.mjs';

const board = new AdBoard(THREE, { server: '${B}', slot: '${S}', width: 8, height: 4 });
scene.add(board.mesh);
// every frame
board.update(camera, renderer, dt, { occluders: [buildings] });`, 'JavaScript')}
<h2>When something goes wrong</h2>
${table(['What you see', 'Why', 'Fix'], [
  ['Nothing shows', 'No booking, and the space is set to show nothing when empty', 'Turn on a house ad or the Advertise here card'],
  ['The page jumps when the ad loads', 'The box has no size', 'Give the div a width and an aspect-ratio, or set the space\'s size'],
  ['Views stay at zero', 'The ad is below the fold and nobody scrolls to it, or your app never calls <code>seen()</code>', 'Move the space up, or call <code>seen()</code> after a second on screen'],
  ['<code>404 No such slot</code>', 'The id is wrong', 'Copy the code again from the dashboard'],
  ['<code>429 Slow down</code>', 'Too many requests from one place for one space', 'Ask once per page view, not in a loop'],
])}
<h2>Next steps</h2>
${cards([['/docs/approving-ads', 'Approving ads', 'What you see before an ad runs.'], ['/docs/getting-paid', 'Getting paid', 'Balance, payouts and timing.'], ['/docs/counting', 'How views count', 'The rules every SDK follows.'], ['/docs/api', 'API reference', 'Every endpoint you can call.']])}` },

    { slug: 'websites', title: 'Websites and blogs', lede: 'One div and one script line. The space is kept free while the ad loads, so the page never jumps, and nothing about your readers is sent anywhere.',
      body: `
<h2>Add the code</h2>
${code(WEB, 'HTML')}
<p>Load the script once per page, even with several spaces. Each <code>data-isoteh</code> div becomes one ad.</p>
<h2>Keep the layout still</h2>
<p>Give the box its size so nothing moves when the ad arrives. If you set a size on the space, the dashboard's code already includes it.</p>
${code(`<div data-isoteh="${S}" style="max-width:300px;aspect-ratio:300/250"></div>`, 'HTML')}
<h2>Tell us what the page is about</h2>
<p>Topic words help pick a fitting ad. They describe the page, never the reader.</p>
${code(`<div data-isoteh="${S}" data-keywords="coffee, austin, recipes"></div>`, 'HTML')}
<p>If the page has a <code>&lt;meta name="keywords"&gt;</code> tag, its words are used too.</p>
<h2>What the script does</h2>
<ul>
<li>Loads the ad only when the space is near the screen.</li>
<li>Draws it inside a shadow root, so your styles and the ad's never mix.</li>
<li>Labels it Sponsored and links out with <code>rel="sponsored"</code>.</li>
<li>Counts a view once, when half the ad has been on screen for a second while the tab is visible.</li>
<li>Sets no cookies and uses no storage.</li>
</ul>
<h2>WordPress</h2>
${steps([
  ['Install the plugin', `<p>Download <a href="/wordpress/isoteh.php">isoteh.php</a> and upload it under Plugins, Add New, Upload. It is a 40-line shortcode and nothing else.</p>`],
  ['Set the server', `<p>Under Settings, Isoteh, set the server address to <code>${B}</code>.</p>`],
  ['Place the shortcode', `<p>Put it in any post, page or widget.</p>${code(`[isoteh slot="${S}"]`, 'Shortcode')}`],
])}
${note('No plugin? Paste the website code into a Custom HTML block instead. It works the same.', 'tip')}
<h2>Ghost</h2>
<p>Add an HTML card where the ad goes and paste the website code. To show it on every post, put the script line in Settings, Code injection, Site footer, and the div in your theme where the ad belongs.</p>
<h2>Other site builders</h2>
<p>Any builder that allows an HTML or embed block works: Webflow, Squarespace, Framer, Wix and plain HTML. Paste the website code into it.</p>` },

    { slug: 'newsletters', title: 'Newsletters', lede: 'An HTML block for every tool that allows one, and a ready-made block for Substack. Every reader of one issue sees the same ad.',
      body: `
<h2>Ghost, beehiiv, Kit, Mailchimp and Brevo</h2>
<p>Paste this into an HTML block in the email. Replace <code>ISSUE</code> with a new name for each send; the date works well.</p>
${code(`<table role="presentation" width="100%" style="max-width:600px;margin:16px auto">
  <tr><td style="font:12px sans-serif;color:#777;padding-bottom:4px">Sponsored</td></tr>
  <tr><td><a href="${B}/e/${S}/c?i=ISSUE"><img src="${B}/e/${S}.png?i=ISSUE" width="600" alt="Sponsored" style="display:block;width:100%;height:auto;border:0"></a></td></tr>
</table>`, 'HTML')}
<h2>One ad per issue</h2>
${MAIL}
<p>The first open of an issue picks the ad. Every later open and click of that issue uses the same one, so forwarded copies and late readers see what everyone else saw.</p>
<h2>Opens and clicks</h2>
<ul><li><strong>Opens</strong> are counted when the image loads. Many mail apps load images ahead of time, so opens are an estimate.</li><li><strong>Clicks</strong> are exact: each link counts once per reader per day.</li></ul>
<h2>Substack</h2>
<p>Substack doesn't run outside code and stores images itself, so use the ready-made block.</p>
${steps([
  ['Open the kit', `<p>Open this address with your issue name. It returns the ad's image, its text and the tracked link.</p>${code(`${B}/e/${S}/kit?i=2026-11-06`, 'URL')}`],
  ['Add the image', '<p>Download the image and add it to the post.</p>'],
  ['Link it', '<p>Link the image and the words to the <code>link</code> the kit gave you, and write Sponsored above it.</p>'],
])}` },

    { slug: 'apps', title: 'Apps and chat', lede: 'Ask for a card and draw it in your own style. Cards come back for public channels, feeds and AI answers, never for private chats.',
      body: `
<h2>Get a card</h2>
${code(`import { getNativeAd } from '${B}/s/isoteh-native.mjs';

const card = await getNativeAd({
  server: '${B}',
  slot: '${S}',
  keywords: 'channel topic words',
  ctx: 'public',            // 'private' or 'dm' always returns null
});`, 'JavaScript')}
<h2>Draw it</h2>
<p>The card gives you its parts. Draw them with your own components, and always show <code>card.label</code>.</p>
${table(['Field', 'What it is'], [
  ['<code>label</code>', 'Always "Sponsored". Show it.'],
  ['<code>sponsor</code>', 'The brand\'s name'],
  ['<code>title</code>, <code>body</code>', 'Plain text, no HTML'],
  ['<code>cta</code>', 'The button words, "Learn more" when the brand gave none'],
  ['<code>image</code>', 'An image address, or empty for a text ad'],
  ['<code>seen()</code>', 'Call once, after the card has been at least half on screen for a second'],
  ['<code>open()</code>', 'Opens the brand\'s page through the click counter'],
])}
<h2>Under an AI answer</h2>
<p>Pass the words of the question or the answer as <code>keywords</code>. The card is matched to the topic, never to the person, and the answer itself is never changed. Show the card after the answer, clearly apart from it.</p>
${note('Never place a card inside the answer text or style it to look like part of the reply. It must read as a separate, labelled ad.', 'warn')}
<h2>Private chats</h2>
<p>Ads never appear in private or direct chats. Send <code>ctx: 'private'</code> from one and you get <code>null</code>; the server enforces the same rule.</p>` },

    { slug: 'games', title: 'Games', lede: 'Turn any surface in your world into a billboard. A view counts only when the player can really read it.',
      body: `
<h2>Three.js</h2>
${code(`import { AdBoard } from '${B}/s/isoteh-three.mjs';

const board = new AdBoard(THREE, { server: '${B}', slot: '${S}', width: 8, height: 4 });
board.mesh.position.set(0, 3, -20);
scene.add(board.mesh);

function frame(dt) {
  board.update(camera, renderer, dt, { occluders: [buildings] });
  renderer.render(scene, camera);
}

// on tap or click
if (board.hit(raycaster)) board.open();`, 'JavaScript')}
<p>Pass your own <code>THREE</code>, so the SDK carries no copy of it. The board shows the ad with a small Sponsored strip, an Advertise here card when the space is free, or a plain panel.</p>
<h2>When a view counts</h2>
${GAME}
${table(['Rule', 'Value'], [['Part of the board on screen and not hidden', 'At least half'], ['Share of the screen it covers', 'At least 1.5%'], ['Angle from straight on', 'At most 55°'], ['Time in a row', '1 second']])}
<p>These follow the common rules for in-game ads, so brands can trust the numbers. Nothing about the player is sent.</p>
<h2>Any engine</h2>
<p>Unity, Godot or your own engine: fetch the ad, draw its image on a surface, call its view link once the player has seen it for a second, and open its click link on tap.</p>
${code(`GET ${B}/v1/ad?slot=${S}&kw=racing,cars

{
  "ad": { "kind": "image", "sponsor": "Juniper Coffee", "image": "${B}/cr/….png", "width": 1200, "height": 600 },
  "label": "Sponsored",
  "view": "${B}/t/v?k=…",
  "click": "${B}/c?k=…"
}`, 'HTTP')}
<p>The <code>GameAd</code> class in <code>isoteh-game.mjs</code> holds the same rules without Three.js, if you want to port them. See the <a href="/docs/sdk-game">game SDK</a>.</p>` },

    { slug: 'creators', title: 'Creators', lede: 'Sell sponsored posts on your own channel. Brands book and pay first, you post with a tracked link, and you are paid three days later.',
      body: `
${steps([
  ['Add a creator space', '<p>Add your channel as a place and a Creator post space with a price per post.</p>'],
  ['Share your booking page', `<p>Put it in your bio or media kit.</p>${code(`${B}/book/${S}`, 'URL')}`],
  ['Accept a booking', '<p>Read the brief and accept or decline. The brand has already paid.</p>'],
  ['Post with your link', '<p>Each booking gets its own short link. Use it in the post, then add the post\'s address in the dashboard.</p>'],
  ['Get paid', '<p>Three days after you add the post link, or as soon as the brand confirms, 85% moves to your balance.</p>'],
])}
<h2>If something goes wrong</h2>
<p>Either side can open a dispute from the booking. Our team looks at the post and the brief, then pays the creator or returns the money to the brand as credit.</p>` },

    { slug: 'approving-ads', title: 'Approving ads', lede: 'Every ad waits for you. You see exactly what will run, on which dates, and you can say no to anyone.',
      body: `
<h2>What you see</h2>
<p>Each booking request shows the ad as it will look, the brand, the link it goes to, the dates and the amount already paid.</p>
<h2>Approve or decline</h2>
<ul><li><strong>Approve</strong> and the ad runs on its dates.</li><li><strong>Decline</strong> and the brand gets their money back. You don't need to give a reason.</li></ul>
<h2>Our review too</h2>
<p>Every ad is also checked by us before it can run, and any change sends it back for review. We turn away anything in our <a href="/brand-safety">brand safety rules</a>.</p>
<h2>Turning approval off</h2>
<p>If you trust the marketplace's review, turn off Approve each ad on a space and paid bookings go live at once. You can still pull an ad at any time.</p>` },

    { slug: 'getting-paid', title: 'Getting paid', lede: 'The brand pays when they book. We hold the money while the ad runs, then 85% moves to your balance, ready to withdraw.',
      body: `
${MONEY}
<h2>When money moves</h2>
${table(['Kind of booking', 'Moves to your balance'], [['Banner, native card, game board', 'When the booking\'s last day has ended'], ['Newsletter', 'When the booked issues have been sent'], ['Creator post', 'Three days after you add the post link, or when the brand confirms']])}
<h2>Fees</h2>
<p>Listing is free. There is no monthly fee and no setup fee. Isoteh keeps 15% of each booking; you keep 85%.</p>
<h2>Withdraw</h2>
<p>Ask for a payout from Money in the dashboard, in US dollars to your bank or PayPal. Payouts are sent by our team today and marked Sent in your dashboard; automatic payouts are on the way.</p>
<h2>Taxes</h2>
<p>You are responsible for taxes on what you earn. Keep your payout details and country up to date in Settings.</p>
<h2>Disputes and refunds</h2>
<p>If a brand disputes a booking, the money stays held until our team decides. We pay the owner if the ad ran as booked and refund the brand, as credit, if it didn't.</p>` },
  ] },

  { group: 'Brands', pages: [
    { slug: 'campaigns', title: 'Campaigns', lede: 'Set a budget and a price per 1,000 views, and your ad runs on every space whose owner opted in, matched by topic and country.',
      body: `
${steps([
  ['Add credit', '<p>Top up your balance under Money, by card or bank transfer.</p>'],
  ['Create a campaign', '<p>Set the total budget, the price per 1,000 views, the dates, and the topics and countries to match.</p>'],
  ['Add ad groups and ads', '<p>Group ads by idea or audience. Every ad is reviewed before it runs.</p>'],
  ['Start', '<p>Starting holds the budget. Views are charged every minute; whatever is left comes back when the campaign ends.</p>'],
])}
<h2>Matching without tracking</h2>
<p>Campaigns are matched to the page, never the person: the topic words of the space and page, the kind of place, and the reader's country. There are no interest profiles and no retargeting, because we keep nothing to build them from.</p>
<h2>Audiences and lists</h2>
<p>An audience is a saved set of topics, countries, kinds of place or sites. A list holds sites or topics to include or leave out. Lists never hold email addresses or people.</p>` },

    { slug: 'ad-rules', title: 'Ad rules and sizes', lede: 'An ad is an image or plain text. No scripts, no HTML, nothing that moves on its own with sound.',
      body: `
<h2>Formats</h2>
${table(['Format', 'What to upload'], [['Image', 'PNG, JPEG, WebP or GIF, up to 1.5 MB. Checked by its bytes, never by its name.'], ['Text', 'A title, one line and button words, in plain text'], ['Native card', 'An image and text; the owner draws it in their own style'], ['Email', 'An image; we add the Sponsored line'], ['Game board', 'A wide image, 2:1 works on most boards']])}
<h2>Common sizes</h2>
${table(['Space', 'Size in pixels'], [['Medium rectangle', '300 × 250'], ['Leaderboard', '728 × 90'], ['Newsletter block', '600 wide, any height up to 400'], ['Game board', '1200 × 600'], ['Native card image', '1:1 or 1.91:1']])}
<p>Upload images at twice the size for sharp screens. The space's own size is shown on its booking page.</p>
<h2>Never allowed</h2>
<ul><li>Scripts, HTML, trackers or tracking pixels in the ad</li><li>Pop-ups, auto-playing sound, or ads that pretend to be part of the page</li><li>Anything in our <a href="/brand-safety">brand safety rules</a></li></ul>` },

    { slug: 'pixel', title: 'Pixel and Conversions API', lede: 'Count sign-ups and sales that came from your ads, from the browser or from your server, without cookies and without knowing who anyone is.',
      body: `
${CONV}
<h2>How it works</h2>
<p>A click on your ad adds <code>?isoteh_ref=…</code> to your link. The reference names the ad and the day, the same for everyone who clicked that ad that day, so it can never point to one person. You send it back with what happened, from the browser or from your server, and we count it against the ad.</p>
<h2>The browser tag</h2>
${steps([
  ['Add the tag to every page', code(`<script async src="${B}/s/isoteh-events.js"></script>`, 'HTML')],
  ['Send events where they happen', code(`isoteh('sign_up');
isoteh('purchase', { value: 24.00, currency: 'USD' });`, 'JavaScript')],
  ['Check it', '<p>Click your own ad, then do the action. The event shows in Events within a minute.</p>'],
])}
<p>The tag keeps the reference only for that browser tab (session storage), sets no cookies, and sends nothing at all for visitors who did not arrive from an ad. A visit from an ad sends a <code>page_view</code> by itself.</p>
<h2>Conversions API (from your server)</h2>
<p>Send events from your backend when the browser can't be trusted to: a payment confirmed by your processor, a renewal, a sale in a shop. Keep the reference from the landing page with the order.</p>
${tabs([
  { label: 'cURL', code: `curl ${B}/v1/events \\
  -H 'Authorization: Bearer isk_your_key' \\
  -H 'Content-Type: application/json' \\
  -d '{"event":"purchase","ref":"REF_FROM_THE_LINK","value":2400,"currency":"USD"}'` },
  { label: 'Node.js', code: `await fetch('${B}/v1/events', {
  method: 'POST',
  headers: { authorization: 'Bearer ' + process.env.ISOTEH_KEY, 'content-type': 'application/json' },
  body: JSON.stringify({ event: 'purchase', ref: order.isotehRef, value: 2400, currency: 'USD' }),
});` },
  { label: 'Python', code: `import os, requests

requests.post('${B}/v1/events',
  headers={'Authorization': f"Bearer {os.environ['ISOTEH_KEY']}"},
  json={'event': 'purchase', 'ref': order.isoteh_ref, 'value': 2400, 'currency': 'USD'})` },
])}
<h3>Request body</h3>
${table(['Field', 'Type', 'Notes'], [
  ['<code>event</code>', 'text', 'Lower case, like <code>purchase</code> or <code>sign_up</code>, 2 to 32 characters'],
  ['<code>ref</code>', 'text', 'The <code>isoteh_ref</code> from the landing page. Valid for 31 days.'],
  ['<code>value</code>', 'whole number', 'In minor units: 2400 is $24.00. Optional.'],
  ['<code>currency</code>', 'text', 'ISO code, like USD. Optional.'],
  ['<code>count</code>', 'whole number', 'How many, when you send several at once. Optional.'],
])}
<h3>Response</h3>
${code(`{ "ok": true, "matched": true }`, 'JSON')}
<p><code>matched</code> is false when the reference is missing, expired or belongs to another account. The event is still kept, without an ad.</p>
<h2>Keys</h2>
<p>Make an API key under Settings. Keys start with <code>isk_</code>. Keep them on your server, never in a browser or an app.</p>
${note('The browser tag needs no key. Only the Conversions API does.', 'tip')}
<h2>Troubleshoot</h2>
${table(['Problem', 'Cause and fix'], [['No events show', 'Visits did not come from an ad, so there is no reference. Click your own ad to test.'], ['Events show without an ad', 'The reference was lost on a redirect. Keep the query string, or save the reference at landing.'], ['<code>401 Sign in first</code>', 'The key is wrong or was deleted. Make a new one.'], ['<code>415 Send JSON</code>', 'Set <code>Content-Type: application/json</code>.']])}` },

    { slug: 'reports', title: 'Reports', lede: 'Views, clicks, spend and events by ad, ad group, campaign and day.',
      body: `
<h2>What is counted</h2>
${table(['Number', 'Meaning'], [['Serves', 'Times an ad was sent to a page, app or game'], ['Views', 'Times it was really seen, by the rule in <a href="/docs/counting">how views count</a>'], ['Clicks', 'Clicks, once per reader per ad per day'], ['Events', 'Sign-ups, sales and anything else you sent'], ['Spend', 'What you paid, in your currency']])}
<h2>Exports</h2>
<p>Download any report as CSV from the dashboard, or read the same numbers from the <a href="/docs/api">API</a>.</p>` },
  ] },

  { group: 'SDKs', pages: [
    { slug: 'sdks', title: 'SDKs', lede: 'Small files, no dependencies, served from Isoteh itself. Each one counts views by the same rule and sends nothing about the person.',
      body: `
${table(['SDK', 'For', 'Load from'], [
  ['<a href="/docs/sdk-web">Website script</a>', 'Websites, blogs, WordPress, Ghost', `<code>${B}/s/isoteh.js</code>`],
  ['<a href="/docs/sdk-native">Native SDK</a>', 'Apps, chat, feeds, AI answers', `<code>${B}/s/isoteh-native.mjs</code>`],
  ['<a href="/docs/sdk-three">Three.js board</a>', 'Three.js games', `<code>${B}/s/isoteh-three.mjs</code>`],
  ['<a href="/docs/sdk-game">Game SDK</a>', 'Any engine, the view rules alone', `<code>${B}/s/isoteh-game.mjs</code>`],
  ['<a href="/docs/pixel">Events tag</a>', 'Brands counting sales', `<code>${B}/s/isoteh-events.js</code>`],
  ['<a href="/docs/websites#wordpress">WordPress plugin</a>', 'WordPress shortcode', `<code>${B}/wordpress/isoteh.php</code>`],
])}
<h2>Shared rules</h2>
<ul><li>No cookies, no storage of anything about the person.</li><li>Every ad is labelled Sponsored.</li><li>A view is sent once, by the rule in <a href="/docs/counting">how views count</a>.</li><li>Errors never break your page: on any failure you get no ad.</li></ul>
<h2>Coming next</h2>
<p>Unity and Godot packages. The <a href="/docs/api-ad">JSON API</a> already works from any engine today.</p>` },

    { slug: 'sdk-web', title: 'Website script', nav: 'Website script', lede: 'Reference for isoteh.js: attributes, behaviour and what it sends.',
      body: `
<h2>Install</h2>
${code(WEB, 'HTML')}
<h2>Attributes</h2>
${table(['Attribute', 'Required', 'What it does'], [['<code>data-isoteh</code>', 'Yes', 'The space id'], ['<code>data-keywords</code>', 'No', 'Topic words for this spot, comma separated, up to 300 characters']])}
<h2>Behaviour</h2>
<ul><li>Waits until the space is near the screen before asking for an ad.</li><li>Draws inside a shadow root with its own small styles.</li><li>When there is no ad and no size was set, hides the box.</li><li>An Advertise here card links to your booking page.</li></ul>
<h2>What it sends</h2>
<p>One request for the ad (space id, topic words), one view beacon and, on click, the click link. No identifiers, no cookies, no fingerprinting.</p>` },

    { slug: 'sdk-native', title: 'Native SDK', lede: 'Reference for getNativeAd: options and the card it returns.',
      body: `
${code(`getNativeAd({ server, slot, keywords = '', ctx = 'public', fetchFn }) → Promise<Card | null>`, 'Signature')}
<h2>Options</h2>
${table(['Option', 'Default', 'Meaning'], [['<code>server</code>', '', `Your Isoteh address, <code>${B}</code>`], ['<code>slot</code>', '', 'The space id'], ['<code>keywords</code>', "''", 'Topic words for the channel, feed or question'], ['<code>ctx</code>', "'public'", "'private' or 'dm' always returns null"], ['<code>fetchFn</code>', 'global fetch', 'Your own fetch, for React Native or tests']])}
<h2>The card</h2>
${table(['Field', 'Type'], [['<code>label</code>', 'text, always "Sponsored"'], ['<code>sponsor</code>, <code>title</code>, <code>body</code>, <code>cta</code>', 'plain text'], ['<code>image</code>', 'address or empty'], ['<code>link</code>', 'the click address'], ['<code>seen()</code>', 'send the view, once'], ['<code>open()</code>', 'open the link in a new tab, returns it']])}
<p>Returns <code>null</code> when there is no ad, the request fails, or the chat is private.</p>` },

    { slug: 'sdk-three', title: 'Three.js board', lede: 'Reference for AdBoard: a billboard mesh that loads, draws and counts its own ad.',
      body: `
${code(`new AdBoard(THREE, { server, slot, width = 4, height = 2, keywords = '', px = 512 })`, 'Constructor')}
<h2>Options</h2>
${table(['Option', 'Default', 'Meaning'], [['<code>width</code>, <code>height</code>', '4, 2', 'Size in scene units'], ['<code>keywords</code>', "''", 'Topic words, like racing, cars'], ['<code>px</code>', '512', 'Width of the drawn texture in pixels']])}
<h2>Methods</h2>
${table(['Method', 'What it does'], [['<code>mesh</code>', 'The mesh to add to your scene'], ['<code>update(camera, renderer, dt, { occluders })</code>', 'Call every frame; measures what the player sees and sends the view once'], ['<code>hit(raycaster)</code>', 'True when a ray hits the board'], ['<code>open()</code>', 'Opens the brand\'s page'], ['<code>reload()</code>', 'Asks for a new ad, for example on a new level']])}` },

    { slug: 'sdk-game', title: 'Game SDK', lede: 'Reference for GameAd: the view rules for any engine, without Three.js.',
      body: `
${code(`import { GameAd, RULES } from '${B}/s/isoteh-game.mjs';
// RULES = { minVisible: 0.5, minShare: 0.015, maxAngle: 55, seconds: 1 }`, 'JavaScript')}
<h2>Use</h2>
${steps([['Load', '<p><code>await ad.load()</code> returns the ad, an Advertise here offer, or null.</p>'], ['Measure each frame', '<p>Work out what share of the board is on screen and not hidden, what share of the screen it covers, and the angle to the camera. Pass them to the class each frame with the time since the last.</p>'], ['Let it count', '<p>After one second in a row inside the rules it sends the view, once.</p>']])}
<p>Porting to Unity or Godot? Copy the four numbers in <code>RULES</code> and the same one-second logic; the <a href="/docs/api-ad">JSON API</a> does the rest.</p>` },
  ] },

  { group: 'API reference', pages: [
    { slug: 'api', title: 'API overview', lede: 'A small JSON API. Ads, views and clicks are public; everything about your account needs a key.',
      body: `
<h2>Base address</h2>
${code(B, 'URL')}
<h2>Authentication</h2>
<p>Public endpoints (<code>/v1/ad</code>, view and click links) need nothing. Account endpoints need an API key in the header. Make one under Settings; it starts with <code>isk_</code> and is shown once.</p>
${code(`Authorization: Bearer isk_your_key`, 'Header')}
<p>Writes must be JSON with <code>Content-Type: application/json</code>.</p>
<h2>Endpoints</h2>
${table(['Method and path', 'What it does', 'Key'], [
  ['<code>GET /v1/ad</code>', '<a href="/docs/api-ad">Get an ad for a space</a>', 'No'],
  ['<code>POST /t/v?k=…</code>', '<a href="/docs/api-views">Count a view</a>', 'No'],
  ['<code>GET /c?k=…</code>', '<a href="/docs/api-views">Count a click and go to the brand</a>', 'No'],
  ['<code>POST /v1/events</code>', '<a href="/docs/pixel">Send a conversion</a>', 'Yes'],
  ['<code>GET /v1/events</code>', 'Events by day or hour', 'Yes'],
  ['<code>GET /v1/overview</code>', 'Spend, views, clicks and events for a date range', 'Yes'],
  ['<code>GET /v1/reports</code>', 'Report rows by ad and day', 'Yes'],
  ['<code>GET /v1/market</code>', 'Search listed spaces', 'No'],
  ['<code>GET /v1/slots/{id}/snippets</code>', 'The code to paste for a space', 'Yes'],
])}
<h2>Money in the API</h2>
<p>Every amount is a whole number of minor units with a currency: <code>{"amount": 50000, "currency": "USD"}</code> is $500.00.</p>` },

    { slug: 'api-ad', title: 'Get an ad', lede: 'GET /v1/ad returns the ad for a space right now, an Advertise here offer, or nothing.',
      body: `
${code(`GET ${B}/v1/ad?slot=${S}&kw=coffee,austin`, 'Request')}
<h2>Query</h2>
${table(['Name', 'Required', 'Meaning'], [['<code>slot</code>', 'Yes', 'The space id'], ['<code>kw</code>', 'No', 'Topic words, comma separated'], ['<code>ctx</code>', 'No', "<code>private</code>, <code>dm</code> or <code>direct</code> returns no ad"], ['<code>country</code>', 'No', 'Two-letter country code, when you know it from context']])}
<h2>Response</h2>
${tabs([
  { label: 'An ad', code: `{
  "ad": { "kind": "image", "sponsor": "Juniper Coffee", "title": "Beans by Friday",
          "body": "Small-batch beans roasted in Austin.", "cta": "Shop the beans",
          "image": "${B}/cr/3f9c….png", "width": 1200, "height": 600 },
  "label": "Sponsored",
  "source": "booking",
  "view": "${B}/t/v?k=…",
  "click": "${B}/c?k=…"
}` },
  { label: 'Space is free', code: `{
  "ad": null,
  "open": { "text": "Advertise here", "url": "${B}/book/${S}", "from": "$40.00 a day" }
}` },
  { label: 'Nothing', code: `{ "ad": null }` },
])}
<p><code>source</code> is <code>booking</code>, <code>campaign</code> or <code>house</code>.</p>` },

    { slug: 'api-views', title: 'Views and clicks', lede: 'Each ad carries two links. Call the view link once it was seen, and send taps through the click link.',
      body: `
${VIEW}
<h2>View</h2>
${code(`POST ${B}/t/v?k=TOKEN      (or GET, which returns a 1×1 image)`, 'HTTP')}
<p>Call it once, after the ad has passed the <a href="/docs/counting">view rule</a>. Repeats of the same token are ignored. Answers <code>204</code>.</p>
<h2>Click</h2>
${code(`GET ${B}/c?k=TOKEN   →   302 to the brand's page, with utm_source, utm_medium and isoteh_ref`, 'HTTP')}
<p>Open it in a new tab or the system browser. Robots are ignored and each reader's click counts once.</p>` },

    { slug: 'api-errors', title: 'Errors and limits', lede: 'Errors are JSON with one plain sentence. Limits keep one page or one script from flooding a space.',
      body: `
${code(`{ "error": "No such slot" }`, 'JSON')}
${table(['Status', 'Meaning'], [['<code>400</code>', 'Something in the request is wrong; the message says what'], ['<code>401</code>', 'No key, or the key is wrong'], ['<code>403</code>', 'Your key can\'t do this'], ['<code>404</code>', 'No such space, ad or booking'], ['<code>415</code>', 'Writes must be JSON'], ['<code>429</code>', 'Too many requests; slow down and try again'], ['<code>5xx</code>', 'Our fault; try again in a moment']])}
<h2>Limits</h2>
${table(['What', 'Limit'], [['Ad requests', '120 a minute from one place for one space'], ['Views', '600 a minute from one place'], ['Clicks', '60 an hour from one place'], ['Events from the tag', '30 an hour from one place for one ad']])}
<p>"One place" is a hash that changes every day and is kept only in memory, never stored.</p>` },
  ] },

  { group: 'Resources', pages: [
    { slug: 'counting', title: 'How views count', lede: 'One rule for every kind of place, so a view means the same thing on a blog, in an app and in a game.',
      body: `
${VIEW}
<h2>The rule</h2>
${table(['Place', 'A view counts when'], [['Website, app, chat', 'At least half the ad is on screen for one second in a row, while the page or app is in front'], ['Game', 'At least half the board is on screen and not hidden, it covers at least 1.5% of the screen, it faces the player within 55°, for one second in a row'], ['Newsletter', 'The image loads (an estimate; mail apps preload images)'], ['Creator post', 'Not counted as views; clicks on the post\'s link are counted']])}
<h2>Counted once</h2>
<p>Every ad sent carries a signed token. Its view and its click count once each, however many times they are called.</p>
<h2>Robots and repeats</h2>
<p>Known robots and preview tools are ignored. Repeated calls from one place are held back by limits that use a daily-changing hash kept only in memory.</p>
<h2>What we never use</h2>
<ul><li>Cookies or local storage on readers</li><li>IP addresses, stored or shared</li><li>Device ids, fingerprints or cross-site profiles</li></ul>` },

    { slug: 'changelog', title: 'Changelog', lede: 'What changed, newest first.',
      body: `
<h2>6 November 2026</h2>
<ul><li>New docs: integration guide, SDK and API reference, Pixel and Conversions API.</li><li>Company, help and legal pages.</li></ul>
<h2>31 October 2026</h2>
<ul><li>Isoteh is live at isoteh.amaete.com.</li><li>The new dashboard: campaigns, ad groups, events, audiences, places, bookings and earnings.</li></ul>
<h2>29 October 2026</h2>
<ul><li>First version: places and spaces, direct bookings, held payments, the website script, newsletter blocks, native cards, the Three.js board and the WordPress plugin.</li></ul>` },

    { slug: 'ai-tools', title: 'Docs for AI tools', lede: 'Give your coding assistant the whole of these docs in one file.',
      body: `
<h2>llms.txt</h2>
<p>A plain list of every docs page with a one-line summary, for AI tools that read it.</p>
${code(`${B}/llms.txt`, 'URL')}
<h2>Copy a page</h2>
<p>Every page has a Copy page button at the top. It copies the page as plain text, ready to paste into a chat with an assistant.</p>` },
  ] },
];
