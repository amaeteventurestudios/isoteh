// Company, help and legal pages. kind: 'legal' adds the legal tabs and the date; wide skips the side contents.
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { SITE, code, table, cards, note } from './kit.mjs';
import { FLOW, MONEY } from './figs.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const E = `<a href="mailto:${SITE.email}">${SITE.email}</a>`;
const CO = SITE.owner;

// the front page's questions, kept in one place
const home = readFileSync(join(ROOT, 'public', 'home.html'), 'utf8');
const homeFaq = [...home.matchAll(/<details><summary>([\s\S]*?)<\/summary><div class="ans">([\s\S]*?)<\/div><\/details>/g)].map((m) => [m[1], m[2]]);
const moreFaq = [
  ['Can I sell space in more than one place?', '<p>Yes. One account can hold any number of sites, newsletters, apps, games and channels, each with its own spaces and prices.</p>'],
  ['What currencies do you support?', '<p>Prices default to US dollars. Every amount is kept with its currency, so other currencies can be added per place.</p>'],
  ['Can brands target people?', '<p>No. Brands choose topics, kinds of place, sites and countries. There are no interest profiles, no retargeting and no lookalikes, because we keep nothing to build them from.</p>'],
  ['Does the script slow my page down?', '<p>It is one small file, loads after your page, asks for an ad only when the space is near the screen, and keeps the space\'s size so nothing jumps.</p>'],
  ['Can I use Isoteh with Google AdSense?', '<p>Yes. Isoteh only touches the spaces you give it. Many owners sell direct with Isoteh and fill other spots elsewhere.</p>'],
  ['Is there an API?', '<p>Yes. See the <a href="/docs/api">API reference</a>. Ads, views and clicks are public; your account\'s data needs a key.</p>'],
];
const faqHtml = (list) => list.map(([q, a]) => `<details class="qa"><summary>${q}</summary><div>${a}</div></details>`).join('');

export const PAGES = [
  // ---- solutions ----
  { slug: 'brands', title: 'For brands', lede: 'Put your ad inside the newsletters, articles, apps and games your customers already read, matched to the topic and never to the person.', wide: true,
    body: `
<div class="pg-cta"><a class="btn lg" href="/app#signup">Launch a campaign</a><a class="btn lg ghost" href="/market">Find ad space</a></div>
<h2>Why brands book Isoteh</h2>
${cards([['/docs/quickstart-brands', 'Book a space directly', 'Pick the newsletter, blog or game you want, see the price, and book the dates.'], ['/docs/campaigns', 'Or run a campaign', 'Set a price per 1,000 views and reach every owner who opts in, by topic and country.'], ['/docs/counting', 'Views that were really seen', 'Half on screen for a second. In games, readable and facing the player.'], ['/docs/pixel', 'Count sales without tracking', 'A reference that names the ad and the day, never the person.']])}
<h2>Where your ad can run</h2>
${table(['Place', 'What the reader sees'], [['Newsletters', 'A labelled block inside the issue, the same for every reader of that issue'], ['Blogs and websites', 'A banner or a card in the page, kept to its size so nothing jumps'], ['Apps and chat', 'A native card in public channels, feeds and under AI answers'], ['Browser games', 'A billboard in the game world, counted only when readable'], ['Creators', 'A sponsored post with its own tracked link']])}
<h2>What you pay</h2>
<p>For a booking, the owner's price for the dates or the post, paid up front and held until it has run. If the owner declines, your money comes back. For a campaign, your price per 1,000 views, charged as views come in, with the rest returned at the end.</p>` },

  { slug: 'owners', title: 'For owners', lede: 'Earn from the space you already have. Set your price, approve every ad, and get paid after it runs.', wide: true,
    body: `
<div class="pg-cta"><a class="btn lg" href="/app#signup">Start selling</a><a class="btn lg ghost" href="/docs/integration-guide">Read the integration guide</a></div>
${FLOW}
<h2>Built for the people who own the page</h2>
${cards([['/docs/approving-ads', 'Every ad waits for you', 'See it before it runs. Say no to anyone, and the brand is refunded.'], ['/docs/getting-paid', 'Paid before it runs', 'The brand pays when they book. You never chase an invoice.'], ['/docs/quickstart-owners', 'No traffic minimum', 'A small blog can list today and set its own price.'], ['/docs/counting', 'We measure the ad, not the person', 'No cookies on your readers, no profiles, no stored IPs.']])}
<h2>Keep 85%</h2>
${MONEY}
<p>Listing is free. No monthly fee and no setup fee. Isoteh keeps 15% of each booking.</p>
<h2>Works where you publish</h2>
<p>Websites and blogs, WordPress, Ghost, beehiiv, Kit, Mailchimp, Brevo, Substack, apps and chat, Three.js games and any engine through the API. See the <a href="/docs/integration-guide">integration guide</a>.</p>` },

  // ---- company ----
  { slug: 'about', title: 'About Isoteh', lede: 'Advertising on your terms. We are building the ad network for the people who own the page.', wide: true,
    body: `
<h2>Why we exist</h2>
<p>People with an audience can't easily sell their own ad space. The big networks decide the price, place ads the owner never saw, follow readers from site to site, and pay late. Newsletter writers, small blogs and game makers are mostly left out, or kept inside one platform's walls.</p>
<p>Isoteh is the other way round. The owner sets the price and approves every ad. The brand pays first. Readers are never tracked. And one network covers websites, newsletters, apps, chat and games, so an owner can sell all of it from one place.</p>
<h2>The name</h2>
<p>Isoteh comes from the Yoruba word ìṣọtẹ̀, which means rebellion. We say it ee-shaw-teh. It is a small rebellion against advertising that follows people around.</p>
<h2>What we believe</h2>
<ul><li><strong>The owner decides.</strong> Their space, their price, their yes or no.</li><li><strong>Measure the ad, not the person.</strong> Context is enough to place a good ad.</li><li><strong>Always honest.</strong> Every ad says Sponsored. No ads in private chats. No scripts in ads.</li><li><strong>Paid on time.</strong> Money is held from the moment a brand books, so owners never chase an invoice.</li></ul>
<h2>Who we are</h2>
<p>Isoteh is made by ${CO}, an independent studio in the United States. It is a young product: we are starting with newsletters, independent sites and browser games, including our own.</p>
<h2>Talk to us</h2>
<p>Write to ${E}. We read everything.</p>` },

  { slug: 'brand', title: 'Brand assets', lede: 'The Isoteh mark, wordmark, colours and type, for press, partners and anyone writing about us.', wide: true,
    body: `
<h2>Logo</h2>
<div class="assets">
  <figure class="asset"><div class="a-prev light"><span class="a-mark"><svg viewBox="0 0 16 16" fill="none"><rect x="2" y="2" width="12" height="12" rx="2.5" stroke="currentColor" stroke-width="1.6"/><rect x="5.5" y="5.5" width="5" height="5" rx="1" fill="currentColor"/></svg></span></div><figcaption><b>Symbol</b><span><a href="/a/brand-mark-black.svg" download>Black SVG</a><a href="/a/brand-mark-white.svg" download>White SVG</a></span></figcaption></figure>
  <figure class="asset"><div class="a-prev light"><span class="a-word"><span class="a-sq"><svg viewBox="0 0 16 16" fill="none"><rect x="2" y="2" width="12" height="12" rx="2.5" stroke="currentColor" stroke-width="1.6"/><rect x="5.5" y="5.5" width="5" height="5" rx="1" fill="currentColor"/></svg></span>Isoteh</span></div><figcaption><b>Lockup</b><span><a href="/a/brand-lockup-black.svg" download>Black SVG</a><a href="/a/brand-lockup-white.svg" download>White SVG</a></span></figcaption></figure>
  <figure class="asset"><div class="a-prev dark"><span class="a-word"><span class="a-sq"><svg viewBox="0 0 16 16" fill="none"><rect x="2" y="2" width="12" height="12" rx="2.5" stroke="currentColor" stroke-width="1.6"/><rect x="5.5" y="5.5" width="5" height="5" rx="1" fill="currentColor"/></svg></span>Isoteh</span></div><figcaption><b>Lockup on dark</b><span><a href="/a/brand-lockup-white.svg" download>White SVG</a></span></figcaption></figure>
  <figure class="asset"><div class="a-prev light"><span class="a-avatar"><svg viewBox="0 0 16 16" fill="none"><rect x="4" y="4" width="8" height="8" rx="1.6" stroke="currentColor" stroke-width="1.4"/><rect x="6.3" y="6.3" width="3.4" height="3.4" rx=".6" fill="currentColor"/></svg></span></div><figcaption><b>Avatar</b><span><a href="/a/brand-avatar.svg" download>SVG</a></span></figcaption></figure>
</div>
<h2>Colour</h2>
<div class="swatches">${[['Ink', '#0B0D12'], ['Slate', '#454B58'], ['Mist', '#7A8090'], ['Line', '#D6D9E1'], ['Paper', '#FBFBFC']].map(([n, h], i) => `<div class="sw sw${i + 1}"><span>${n}</span><code>${h}</code></div>`).join('')}</div>
<p>Isoteh is black and white. The only colour on our pages is the brand's own ad.</p>
<h2>Type</h2>
${table(['Use', 'Typeface'], [['Headlines, body and interface', 'Geist (SIL Open Font License)'], ['Numbers and code', 'Geist Mono']])}
<h2>Using the name</h2>
<ul><li>Write Isoteh in sentences, with one capital. ISOTEH only inside the logo.</li><li>Say ee-shaw-teh.</li><li>Don't stretch, recolour, outline or add effects to the mark.</li><li>Leave space around the mark equal to its inner square.</li><li>Don't use the mark in a way that suggests we endorse you.</li></ul>` },

  // ---- help ----
  { slug: 'help', title: 'How can we help?', lede: 'Guides for owners and brands, answers to common questions, and a way to reach us.', wide: true,
    body: `
${cards([['/docs', 'Getting started', 'What Isoteh is and how a booking works.'], ['/docs/quickstart-owners', 'For owners', 'List a space, paste the code, approve ads, get paid.'], ['/docs/quickstart-brands', 'For brands', 'Book a space, run a campaign, count sales.'], ['/docs/sdks', 'SDK and API reference', 'Every file, option and endpoint.'], ['/faq', 'FAQ', 'Short answers to the questions we hear most.'], ['/contact', 'Contact support', `Write to ${SITE.email}.`]])}
<h2>Common tasks</h2>
${table(['I want to…', 'Read'], [['Put an ad on my blog', '<a href="/docs/websites">Websites and blogs</a>'], ['Sell a spot in my newsletter', '<a href="/docs/newsletters">Newsletters</a>'], ['Add ads to my game', '<a href="/docs/games">Games</a>'], ['Withdraw my money', '<a href="/docs/getting-paid">Getting paid</a>'], ['See sales from my ads', '<a href="/docs/pixel">Pixel and Conversions API</a>'], ['Report a bad ad', `<a href="/brand-safety#report-an-ad">Report an ad</a>`]])}
<h2>Signed in already?</h2>
<p>Open Help in the dashboard to send us a message with your account attached. We answer there and by email.</p>` },

  { slug: 'faq', title: 'Questions', lede: 'Short answers to what owners and brands ask us most.', wide: true,
    body: `
<div class="faq-list">${faqHtml(homeFaq)}${faqHtml(moreFaq)}</div>
<p class="pg-more">Still have a question? Write to ${E} or read the <a href="/docs">docs</a>.</p>` },

  { slug: 'contact', title: 'Get in touch', lede: 'We are a small team and read every message.', wide: true,
    body: `
<div class="contact">
  <div class="ct"><h2>Email</h2><p>For support, partnerships, press and anything else.</p><p class="big"><a href="mailto:${SITE.email}">${SITE.email}</a></p></div>
  <div class="ct"><h2>Follow us</h2><p>News and changes as they ship.</p><p><a href="${SITE.x}" rel="noopener" target="_blank">X (Twitter)</a><br><a href="${SITE.linkedin}" rel="noopener" target="_blank">LinkedIn</a></p></div>
  <div class="ct"><h2>Already a customer?</h2><p>Open Help in the dashboard so your message comes with your account.</p><p><a href="/app">Sign in</a></p></div>
  <div class="ct"><h2>Security</h2><p>Found a weakness? Email us with the subject Security report. See <a href="/security#report-a-vulnerability">how to report</a>.</p></div>
</div>` },

  // ---- legal ----
  { slug: 'terms', kind: 'legal', title: 'Terms of service', lede: `The agreement between you and ${CO} for using Isoteh, as an owner, a brand or a visitor.`,
    body: `
<h2>1. Who we are and who can use Isoteh</h2>
<p>Isoteh is run by ${CO} ("we", "us"). You must be at least 18 and able to make a binding contract to open an account. If you use Isoteh for a business, you agree to these terms for that business. Keep your sign-in details safe; you are responsible for what happens under your account.</p>
<h2>2. Words we use</h2>
<ul><li><strong>Owner</strong>: someone who lists ad space in a website, newsletter, app, game or channel.</li><li><strong>Brand</strong>: someone who books space or runs campaigns.</li><li><strong>Space</strong>: one spot where an ad can appear.</li><li><strong>Booking</strong>: a brand buying a space for set dates or posts.</li><li><strong>Readers</strong>: the people who see ads in an owner's place.</li></ul>
<h2>3. Using the service</h2>
<p>We give you a limited, non-exclusive, non-transferable right to use Isoteh, its dashboard, SDKs and API while you have an account and follow these terms. You may not: copy or resell the service; get around limits or security; send automated or fake views, clicks or events; scrape the marketplace; or use Isoteh for anything unlawful or in our <a href="/brand-safety">brand safety rules</a>.</p>
<h2>4. Integration</h2>
<p>Owners must install our code as described in the <a href="/docs">docs</a>, keep the Sponsored label visible, never place ads in private chats, and never count views that did not meet the <a href="/docs/counting">view rule</a>. We may slow or stop serving to a space that breaks these rules.</p>
<h2>5. Owners</h2>
<ul><li>You set your prices and may approve or decline any ad.</li><li>You confirm you have the right to sell the space and that your place follows the law and our rules.</li><li>You are responsible for any notices your readers need about the ads on your place.</li></ul>
<h2>6. Brands</h2>
<ul><li>You are responsible for your ads and the pages they link to: they must be true, lawful and yours to use.</li><li>Ads are images or plain text. We review every ad and may refuse any.</li><li>If you send events, you confirm you may share them and that they contain no personal data.</li></ul>
<h2>7. Money</h2>
<ul><li>Brands pay when they book. We hold the money until the booking has run, then pay the owner the price less our fee, which is 15% unless agreed otherwise in writing.</li><li>Campaign budgets are held when a campaign starts, charged as views are counted, and any rest is returned to the brand's balance.</li><li>Payouts are sent to the account the owner gives us. Owners are responsible for their own taxes. We may ask for tax forms before paying out.</li><li>If views or clicks turn out to be invalid, we may adjust, hold or reverse the amounts involved.</li><li>Brand balances are credit for use on Isoteh and are not a bank account.</li></ul>
<h2>8. Disputes between owners and brands</h2>
<p>Either side can open a dispute on a booking. We look at what was booked and what ran, then pay the owner or return the money to the brand as credit. Our decision on the held money is final for that booking.</p>
<h2>9. Data and privacy</h2>
<p>We do not track readers. How we handle the information we do keep is in our <a href="/privacy">privacy policy</a> and <a href="/dpa">data processing terms</a>. Numbers about ads (views, clicks, events) may be used to run, improve and protect the service.</p>
<h2>10. Your content and ours</h2>
<p>You keep your ads, places and content. You let us host, show and adapt them (for example, resizing an image) to run the service. We keep Isoteh, its code, design and name. If you send us ideas, we may use them without owing you anything.</p>
<h2>11. Confidentiality</h2>
<p>Each side keeps the other's non-public business information private and uses it only for working together on Isoteh.</p>
<h2>12. Security testing</h2>
<p>Please don't test our security without telling us first. See <a href="/security">security</a> for how to report a problem.</p>
<h2>13. No warranties</h2>
<p>Isoteh is provided as it is. We work hard to keep it running and accurate, but we don't promise it will be uninterrupted, error-free or bring any particular result.</p>
<h2>14. Limits on liability</h2>
<p>To the extent the law allows, neither side is liable for indirect or lost-profit damages, and our total liability for any claim is limited to the fees we received from you in the three months before the claim.</p>
<h2>15. Indemnity</h2>
<p>You will defend us against claims caused by your ads, your place, your content or your breaking these terms, and cover the resulting costs.</p>
<h2>16. Suspension and ending</h2>
<p>You can close your account at any time. We may suspend or close an account that breaks these terms or puts readers, owners, brands or us at risk. Money held for bookings that already ran is still paid; money for bookings that didn't run is returned.</p>
<h2>17. Changes</h2>
<p>We may change these terms. For important changes we will tell you at least 30 days ahead by email or in the dashboard. Using Isoteh after that means you accept them.</p>
<h2>18. Law</h2>
<p>These terms are governed by the laws of the United States and of the state where ${CO} is organized, and disputes go to the courts there, unless the law where you live says otherwise.</p>
<h2>19. Contact</h2>
<p>${E}</p>` },

  { slug: 'privacy', kind: 'legal', title: 'Privacy policy', lede: 'What we collect, why, and the choices you have. The short version: we do not track the people who see ads.',
    body: `
${note('<strong>The short version.</strong> Readers who see an ad through Isoteh get no cookies, no profile and no stored IP address. We keep only what we need to run accounts, count ads and move money.', 'tip')}
<h2>1. Readers who see ads</h2>
<p>When a page, app or game asks for an ad, it sends the space id, topic words and, sometimes, a country. We use these to pick an ad and then forget them. To count views and clicks once, each ad carries a signed token that names the ad, not the person. To stop abuse, we use a hash of the connection that changes every day and is kept only in memory, never written down.</p>
<p>We do not set cookies on readers, store IP addresses, build profiles, follow people across sites, sell or share personal data, or use device ids or fingerprints.</p>
<h2>2. Visitors who click an ad</h2>
<p>A click adds a reference to the brand's link. It names the ad and the day, the same for everyone who clicked that ad that day. If the brand uses our events tag, it keeps that reference in the browser tab only (session storage) and sends us events like a purchase with that reference. It sends nothing for visitors who didn't come from an ad.</p>
<h2>3. Account holders</h2>
<p>For owners and brands we keep: name, email, password (hashed), organization, team members, places, spaces, ads, bookings, balances and payout details, support messages, and a record of sign-ins for security. Payment cards are handled by Stripe; we never see full card numbers.</p>
<h2>4. Visitors to our own site</h2>
<p>Our pages use one cookie, only after you sign in, to keep you signed in. Our pages load their typeface from Google Fonts, which receives your connection's address when it sends the font.</p>
<h2>5. Why we use it</h2>
${table(['Purpose', 'Legal basis'], [['Running accounts, bookings and payments', 'Contract'], ['Counting views, clicks and events', 'Contract and legitimate interest'], ['Stopping fraud and abuse', 'Legitimate interest'], ['Meeting tax and accounting duties', 'Legal obligation'], ['Product news (you can say no)', 'Consent or legitimate interest']])}
<h2>6. Who we share it with</h2>
<p>Only the service providers we need, listed on our <a href="/subprocessors">sub-processors</a> page, and authorities when the law requires it. We never sell personal data.</p>
<h2>7. How long we keep it</h2>
<p>Account data for as long as the account is open and then as long as tax and accounting law requires. Ad numbers are kept as daily totals with no personal data. Server logs are kept for a short time to fix problems.</p>
<h2>8. Security</h2>
<p>See our <a href="/security">security page</a>.</p>
<h2>9. Your choices and rights</h2>
<p>You can see, correct, download or delete your account data, and object to or limit how we use it. Email ${E}. We honour Global Privacy Control signals. See <a href="/privacy-choices">your privacy choices</a>.</p>
<h2 id="california">10. California</h2>
<p>California residents have the right to know, delete and correct their personal information, and to opt out of its sale or sharing. We do not sell or share personal information for cross-context behavioural advertising, and we do not discriminate against anyone for using their rights.</p>
<h2>11. Moving data between countries</h2>
<p>We run Isoteh in the United States. Where the law requires it, we use standard contractual clauses for data from the EU, the UK and other places with similar rules.</p>
<h2>12. Children</h2>
<p>Isoteh is not for children under 13, and accounts are for adults. We do not knowingly collect children's data. Owners must not use Isoteh on places directed at children without telling us first.</p>
<h2>13. Changes</h2>
<p>We will post changes here and tell account holders about important ones.</p>
<h2>14. Contact</h2>
<p>${CO}, ${E}</p>` },

  { slug: 'brand-safety', kind: 'legal', title: 'Brand safety', lede: 'The rules every ad, every place and every view on Isoteh must follow, so owners, brands and readers can trust each other.',
    body: `
<h2>Where these rules apply</h2>
<p>To every ad booked or run on Isoteh, every place and space listed, and every view, click and event sent to us. They sit alongside our <a href="/terms">terms</a>.</p>
<h2>Ads must be honest</h2>
<ul><li>Clearly labelled Sponsored, and never made to look like the page, the answer or a message from the owner.</li><li>True, with any important conditions stated.</li><li>Images or plain text only: no scripts, no HTML, no trackers.</li><li>Linking to a working page that matches the ad.</li></ul>
<h2>Never allowed</h2>
<ul><li>Illegal products or services, weapons and explosives, illegal drugs and drug equipment</li><li>Hate, harassment, violence or anything that demeans people for who they are</li><li>Sexual content and adult services</li><li>Scams, get-rich-quick schemes, fake reviews and misleading health claims</li><li>Malware, phishing and anything that collects data by deceit</li><li>Ads aimed at children, or placed on places directed at children</li><li>Political ads and issue ads, for now</li></ul>
<h2>Allowed only with our approval</h2>
<ul><li>Alcohol, gambling and betting, and anything else limited by age, only where legal and with an age gate</li><li>Financial products, crypto and lending</li><li>Health, medical and pharmacy products</li><li>Dating</li></ul>
<h2>Places must be real</h2>
<ul><li>Owners list only places they own or run, with a real audience.</li><li>No ads in private chats, ever.</li><li>No ad stacking, hidden spaces, or spaces made only to be loaded by robots.</li><li>No buying traffic to inflate views.</li></ul>
<h2>Views must be real</h2>
<p>Views follow <a href="/docs/counting">the view rule</a>. Robots are filtered. Faking views, clicks or events, or paying people to make them, ends the account and the money involved is returned to the brand.</p>
<h2>AI answers and chat</h2>
<ul><li>An ad never changes or appears inside an AI answer; it sits apart from it, labelled.</li><li>Ads are matched to the topic of the conversation, never to a person.</li><li>No ads in private or direct conversations.</li></ul>
<h2 id="report-an-ad">Report an ad</h2>
<p>Seen an ad that breaks these rules? Email ${E} with where you saw it. We look at every report and pull ads that break the rules.</p>
<h2>What we do</h2>
<p>We may refuse or pull any ad, pause a space or close an account that breaks these rules. Money for ads pulled before they ran goes back to the brand.</p>` },

  { slug: 'dpa', kind: 'legal', title: 'Data processing terms', lede: 'How personal data is handled between Isoteh and the owners and brands who use it. These terms form part of our terms of service; no signature is needed.',
    body: `
<h2>1. Roles</h2>
<p>For account data (the people in your organization) and for running the service, ${CO} acts as an independent controller. Isoteh is built so that readers' personal data is not needed: we don't receive it in ad requests and we ask brands not to send it in events. Where we process personal data on your behalf at your written request, we act as your processor under section 9.</p>
<h2>2. Words used</h2>
<p>"Personal data", "controller", "processor" and "data subject" have the meanings in the GDPR and the UK GDPR, and include "personal information" under US state privacy laws.</p>
<h2>3. What you agree to</h2>
<ul><li>Not to send us readers' personal data: no names, emails, phone numbers, ids or IP addresses in topic words, events or ads.</li><li>To have the rights and give the notices your own readers need.</li><li>To keep your API keys secret.</li></ul>
<h2>4. What we agree to</h2>
<ul><li>To follow the data protection laws that apply to us.</li><li>Not to sell or share personal data, and not to use it for cross-context behavioural advertising.</li><li>To keep personal data confidential and secure (see section 11).</li></ul>
<h2>5. Requests from people</h2>
<p>We help each other answer requests from people using their privacy rights, without delay.</p>
<h2>6. Security incidents</h2>
<p>We tell affected customers without undue delay, and within 72 hours where we can, after learning of a breach affecting their personal data, and help them meet their own duties.</p>
<h2>7. Sub-processors</h2>
<p>We use the providers on our <a href="/subprocessors">sub-processors</a> page, bound by written terms at least as protective as these. We give 15 days' notice of a new sub-processor on that page; you may object for a good reason.</p>
<h2>8. Moving data between countries</h2>
<p>Data is processed in the United States. For transfers from the EU, the EEA, Switzerland or the UK, the standard contractual clauses (and the UK addendum) apply and are made part of these terms.</p>
<h2>9. When we are your processor</h2>
<p>We process only on your documented instructions, make sure our people are bound to confidentiality, help with impact assessments, delete or return the data at the end, and give you the information needed to show we meet these terms.</p>
<h2>10. Keeping and deleting</h2>
<p>We keep personal data only as long as section 7 of our <a href="/privacy">privacy policy</a> says, then delete it.</p>
<h2>11. Security measures</h2>
${table(['Area', 'Measure'], [['In transit', 'TLS on every connection'], ['At rest', 'Encrypted cloud block storage (Oracle Cloud encrypts it by default) and nightly backups on the same storage'], ['Access', 'Least privilege, two-step sign-in for staff, keys stored hashed'], ['Minimising', 'No reader identifiers collected; abuse limits use a daily hash held in memory only'], ['Ads', 'Images and text only, served from our own address with a fixed type, so ads can\'t carry scripts']])}
<h2>12. Order of documents</h2>
<p>If these terms and our terms of service disagree about personal data, these terms win.</p>
<h2>Contact</h2>
<p>${E}</p>` },

  { slug: 'subprocessors', kind: 'legal', title: 'Sub-processors', lede: 'The companies we use to run Isoteh that may handle personal data, what each one does, and where.',
    body: `
<h2>Current sub-processors</h2>
${table(['Sub-processor', 'Purpose', 'Location'], [['Oracle Cloud Infrastructure', 'Servers, storage and backups', 'United States'], ['Cloudflare', 'Domain names (DNS)', 'Global'], ['Stripe', 'Card payments and billing', 'United States'], ['Google Fonts', 'Typeface for our own website (not for ads)', 'Global'], ['GitHub', 'Source code and deployment (no customer data)', 'United States']])}
<h2>Only when you turn them on</h2>
${table(['Service', 'Purpose', 'Location'], [['Paystack', 'Payments in African markets, when chosen at checkout', 'Nigeria'], ['Slack', 'Notices sent to your own Slack workspace, if you connect it', 'United States']])}
<h2>Notice of changes</h2>
<p>We post new sub-processors here at least 15 days before they start, as set out in our <a href="/dpa">data processing terms</a>.</p>
<h2>Change log</h2>
${table(['Date', 'Change'], [['6 November 2026', 'First published']])}
<h2>Contact</h2>
<p>${E}</p>` },

  { slug: 'security', kind: 'legal', title: 'Security', lede: 'How we protect Isoteh, the people who use it and the money that moves through it.',
    body: `
<h2>Built to need less</h2>
<p>The safest data is data we never collect. Ad requests carry no reader identifiers, abuse limits use a daily-changing hash kept only in memory, and events carry a reference to the ad, not the person.</p>
<h2>Ads can't carry code</h2>
<p>Ads are images or plain text. Each image is checked by its bytes, stored under its own hash and served from our address with a fixed type and a strict content policy, so an ad can never run a script on an owner's page.</p>
<h2>Infrastructure</h2>
<p>Isoteh runs on Oracle Cloud in the United States behind a hardened web server with automatic TLS. The service runs as its own unprivileged user. Data is backed up every night.</p>
<h2>Encryption</h2>
<p>TLS on every connection. Passwords are hashed with a slow, salted hash. API keys and session tokens are stored only as hashes.</p>
<h2>Accounts</h2>
<p>Two-step sign-in, team roles, sessions that expire, and limits on repeated sign-in attempts.</p>
<h2>Payments</h2>
<p>Card details go straight to Stripe and never touch our servers. Payment webhooks are checked by signature and by amount. Every movement of money is written as a set of ledger rows that must sum to zero.</p>
<h2>How we build</h2>
<p>Every change runs the test suite before it ships, and the server uses no outside code libraries, so there are none to patch. Secrets live in the server's environment, never in code.</p>
<h2 id="report-a-vulnerability">Report a vulnerability</h2>
<p>Email ${E} with the subject Security report and how to reproduce it. Please give us time to fix it before telling others, and don't test against other people's accounts or data. We will answer quickly and credit you if you like.</p>
<h2>Contact</h2>
<p>${E}</p>` },

  { slug: 'privacy-choices', kind: 'legal', title: 'Your privacy choices', lede: 'What you can do about your data on Isoteh, whether you see ads, click them or have an account.',
    body: `
<h2>If you see ads through Isoteh</h2>
<p>There is nothing to opt out of, because there is nothing to opt out from: we don't set cookies on you, store your IP address, build a profile or follow you across sites. Ads are chosen by the page's topic.</p>
<h2>Do not sell or share my personal information</h2>
<p>We don't sell or share personal information, for money or for cross-context behavioural advertising. That stays true for everyone, without a request. If you'd still like it on record, email ${E}.</p>
<h2>Global Privacy Control</h2>
<p>We honour the Global Privacy Control signal as a request not to sell or share. Since we never do either, nothing changes in what you see.</p>
<h2>If you clicked an ad</h2>
<p>The brand's link carries a reference to the ad and the day, never to you. If the brand uses our events tag, it lives only in that browser tab and ends when you close it.</p>
<h2>If you have an account</h2>
<ul><li>Change your details in Settings.</li><li>Download or delete your data, or close your account, by emailing ${E}.</li><li>Turn product emails off from any email we send.</li></ul>
<h2>More</h2>
<p>Read our <a href="/privacy">privacy policy</a>.</p>` },
];
