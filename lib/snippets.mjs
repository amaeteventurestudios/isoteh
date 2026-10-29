// The copy-and-paste code an owner puts where a slot's ads should appear, one set per kind of place.
export function snippets(cfg, slot) {
  const base = cfg.publicUrl, s = slot.id;
  const box = slot.width && slot.height ? ` style="max-width:${slot.width}px;aspect-ratio:${slot.width}/${slot.height}"` : '';
  const web = `<div data-isoteh="${s}"${box}></div>\n<script async src="${base}/s/isoteh.js"></script>`;
  const out = [];
  if (slot.format === 'banner' || slot.format === 'native') {
    out.push({ where: 'Any website', how: 'Paste where the ad should appear. The space is kept free while the ad loads, so the page never jumps.', code: web });
    out.push({ where: 'WordPress', how: `Install the small ${cfg.brand} plugin (${base}/wordpress/isoteh.php), set the server address once under Settings, then put this shortcode in any post, page or widget. Or paste the website code into a Custom HTML block.`, code: `[isoteh slot="${s}"]` });
    out.push({ where: 'Ghost', how: 'Add an HTML card where the ad goes and paste the website code. For every post, put it in Settings, Code injection, Site footer, and the box in your theme.', code: web });
    out.push({ where: 'Context (optional)', how: 'Tell the server what the page is about, so it can pick a fitting ad without tracking anyone.', code: `<div data-isoteh="${s}" data-keywords="food, austin, bbq"></div>` });
  }
  if (slot.format === 'native') {
    out.push({ where: 'Apps and chat (Jisst)', how: 'Ask for a card and draw it in your own style, always with the word Sponsored. Only in public channels and feeds; send ctx=private from a private chat and you get nothing.', code:
`import { getNativeAd } from '${base}/s/isoteh-native.mjs';
const card = await getNativeAd({ server: '${base}', slot: '${s}', keywords: 'channel topic words' });
if (card) { show(card); card.seen(); /* once it has been on screen for a second */ }
// on tap: card.open()` });
  }
  if (slot.format === 'email') {
    const block = `<table role="presentation" width="100%" style="max-width:${slot.width || 600}px;margin:16px auto"><tr><td style="font:12px sans-serif;color:#777;padding-bottom:4px">Sponsored</td></tr>
<tr><td><a href="${base}/e/${s}/c?i=ISSUE"><img src="${base}/e/${s}.png?i=ISSUE" width="${slot.width || 600}" alt="Sponsored" style="display:block;width:100%;height:auto;border:0"></a></td></tr></table>`;
    out.push({ where: 'Ghost, Beehiiv, Kit, Mailchimp, Brevo', how: 'Paste into an HTML block in the email and replace ISSUE with a new name for every send (the date is fine). Every inbox of one issue sees the same ad. Opens are counted, but mail apps preload images, so treat opens as an estimate; clicks are exact.', code: block });
    out.push({ where: 'Substack', how: `Substack doesn't run outside code and stores images itself, so use the ready-made block: open ${base}/e/${s}/kit?i=ISSUE (with your issue name), add its image to the post, link the image and the words to the link it gives you, and write "Sponsored" above it.`, code: `${base}/e/${s}/kit?i=ISSUE` });
  }
  if (slot.format === 'game') {
    out.push({ where: 'Three.js games', how: 'Turn any surface into a billboard. A view counts only when the board is on screen, big enough, facing the camera and not hidden, for a full second.', code:
`import { AdBoard } from '${base}/s/isoteh-three.mjs';
const board = new AdBoard(THREE, { server: '${base}', slot: '${s}', width: 8, height: 4 });
scene.add(board.mesh);
// every frame:
board.update(camera, renderer, dt, { occluders: [buildings] });
// when the player taps or clicks the board: board.open()` });
    out.push({ where: 'Any engine (Unity, Godot, your own)', how: 'Fetch the ad as JSON, draw its image on a surface, then call its view link once the player has seen it for a second, and open its click link on tap.', code: `GET ${base}/v1/ad?slot=${s}&kw=racing,cars\n-> { ad: { image, width, height, sponsor }, label: "Sponsored", view, click }` });
  }
  if (slot.format === 'creator') {
    out.push({ where: 'Your booking page', how: 'Share this page in your bio or media kit. Brands book and pay up front; you get a tracked link for each post and are paid automatically once the post is up.', code: `${base}/book/${s}` });
  }
  if (slot.booking_open && slot.format !== 'creator') out.push({ where: 'Booking page', how: 'Link to it from an "Advertise with us" page. Advertisers pick dates, upload the ad and pay up front.', code: `${base}/book/${s}` });
  return out;
}
