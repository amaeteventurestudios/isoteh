// Drawn diagrams for the docs. Monochrome, drawn with currentColor so they work in light and dark.
import { fig, box, arrow, DEFS } from './kit.mjs';

export const FLOW = fig('0 0 760 250', DEFS +
  box(20, 30, 150, 64, 'Brand', 'books and pays') +
  box(305, 30, 150, 64, 'Isoteh', 'holds the money', 'hi') +
  box(590, 30, 150, 64, 'Owner', 'approves the ad') +
  box(590, 160, 150, 64, 'Your page', 'shows the ad') +
  box(305, 160, 150, 64, 'Counting', 'views and clicks') +
  box(20, 160, 150, 64, 'Payout', '85% to the owner', 'hi') +
  arrow(172, 62, 301, 62, 'pays up front') + arrow(457, 62, 586, 62, 'asks') + arrow(665, 96, 665, 156, '') +
  arrow(588, 192, 459, 192, 'seen and clicked') + arrow(303, 192, 174, 192, 'after it ran'),
  'How a booking moves: the brand pays first, the owner approves, the ad runs and is counted, then the owner is paid.');

export const LIFE = fig('0 0 760 330', DEFS +
  box(20, 20, 170, 56, 'Your page or app', '') + box(295, 20, 170, 56, 'GET /v1/ad', '', 'hi') + box(570, 20, 170, 56, 'Ad JSON', 'image, text, links') +
  arrow(192, 48, 291, 48, 'slot, topic') + arrow(467, 48, 566, 48, '') +
  box(570, 130, 170, 56, 'Draw the ad', 'labelled Sponsored') + arrow(655, 78, 655, 126) +
  box(295, 130, 170, 56, 'POST view', 'half on screen, 1 s', 'hi') + arrow(568, 158, 469, 158) +
  box(20, 130, 170, 56, 'Tap or click', 'goes through /c') + arrow(293, 158, 194, 158, '', true) +
  box(20, 250, 170, 56, "Brand's site", '?isoteh_ref=…') + arrow(105, 188, 105, 246) +
  box(295, 250, 170, 56, 'Event', 'purchase, sign_up', 'hi') + arrow(192, 278, 291, 278, 'tag or server') +
  box(570, 250, 170, 56, 'Reports', 'by ad and day') + arrow(467, 278, 566, 278),
  'One ad from request to sale. Nothing about the person is sent at any step.');

export const VIEW = fig('0 0 760 260', DEFS +
  '<g class="scr"><rect x="20" y="20" width="300" height="210" rx="14"/><text x="36" y="44" class="t2">Screen</text></g>' +
  '<g class="adb"><rect x="180" y="150" width="200" height="110" rx="10"/><rect x="180" y="150" width="140" height="80" class="in"/><text x="250" y="195" text-anchor="middle" class="t1">Ad</text></g>' +
  '<text x="20" y="252" class="t2">More than half inside the screen</text>' +
  '<g class="tm"><circle cx="520" cy="120" r="58"/><path d="M520 120 V70" /><path d="M520 120 L556 140"/><text x="520" y="205" text-anchor="middle" class="t1">1 second in a row</text><text x="520" y="225" text-anchor="middle" class="t2">while the page is visible</text></g>' +
  '<g class="ck"><circle cx="690" cy="120" r="30"/><path d="m676 121 10 10 19-21"/><text x="690" y="175" text-anchor="middle" class="t1">1 view</text></g>' +
  arrow(400, 120, 456, 120) + arrow(582, 120, 655, 120),
  'A view counts once: at least half the ad on screen, for one second in a row, while the page or app is in front.');

export const GAME = fig('0 0 760 260', DEFS +
  '<g class="cam"><circle cx="90" cy="130" r="22"/><text x="90" y="178" text-anchor="middle" class="t2">Player</text></g>' +
  '<path class="cone" d="M110 120 L470 40 L470 220 L110 140 Z"/>' +
  '<g class="adb"><rect x="470" y="70" width="18" height="120" rx="3"/></g>' +
  '<path class="ang" d="M150 130 A40 40 0 0 0 146 112"/><text x="200" y="110" class="t2">within 55° of straight on</text>' +
  '<text x="500" y="105" class="t1">Board</text><text x="500" y="125" class="t2">at least 1.5% of the screen</text><text x="500" y="145" class="t2">half of it not hidden</text><text x="500" y="165" class="t2">for 1 second in a row</text>' +
  '<g class="bl"><rect x="330" y="150" width="60" height="70" rx="6"/><text x="360" y="240" text-anchor="middle" class="t2">a building can hide it</text></g>',
  'In a game the board must face the player, be big enough to read and not be hidden, for a full second.');

export const MONEY = fig('0 0 760 200', DEFS +
  '<g class="split"><rect x="20" y="40" width="612" height="44" rx="8" class="you"/><rect x="636" y="40" width="104" height="44" rx="8" class="fee"/>' +
  '<text x="36" y="68" class="t1 inv">$425.00 to the owner (85%)</text><text x="688" y="68" text-anchor="middle" class="t1">$75 (15%)</text></g>' +
  '<text x="20" y="28" class="t2">A $500.00 booking</text>' +
  '<g class="tl"><path d="M30 150 H730"/><circle cx="30" cy="150" r="7"/><circle cx="270" cy="150" r="7"/><circle cx="500" cy="150" r="7"/><circle cx="730" cy="150" r="7" class="fill"/>' +
  '<text x="30" y="180" class="t2">Brand pays</text><text x="270" y="180" text-anchor="middle" class="t2">Held while it runs</text><text x="500" y="180" text-anchor="middle" class="t2">Booking ends</text><text x="730" y="180" text-anchor="end" class="t2">Paid to your balance</text></g>',
  'Money is held from the moment a brand pays until the booking has run. Then 85% moves to the owner.');

export const MAIL = fig('0 0 760 220', DEFS +
  box(20, 70, 160, 70, 'Issue: 2026-11-06', 'you send it') +
  box(300, 20, 160, 56, 'First open', 'picks the ad', 'hi') + box(300, 130, 160, 56, 'Every other open', 'same ad') +
  box(580, 70, 160, 70, 'Clicks', 'counted exactly') +
  arrow(182, 95, 296, 55) + arrow(182, 115, 296, 155) + arrow(462, 50, 576, 95) + arrow(462, 155, 576, 118),
  'Every inbox that opens one issue sees the same ad, so a newsletter reads the same for everyone.');

export const CONV = fig('0 0 760 200', DEFS +
  box(20, 70, 150, 60, 'Ad click', '') + box(215, 70, 150, 60, 'Your link', '+ isoteh_ref') + box(410, 20, 150, 56, 'Browser tag', 'isoteh(…)', 'hi') + box(410, 124, 150, 56, 'Your server', 'POST /v1/events', 'hi') + box(605, 70, 135, 60, 'Reports', 'sales per ad') +
  arrow(172, 100, 211, 100) + arrow(367, 92, 406, 52) + arrow(367, 108, 406, 150) + arrow(562, 48, 601, 92) + arrow(562, 152, 601, 110),
  'The reference names the ad and the day, the same for everyone who clicked that ad that day. It never names a person.');
