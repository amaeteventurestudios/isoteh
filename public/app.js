// The dashboard and public pages, in one small app with no framework. Pages: / (about), /market, /book/<slot>,
// /app (places, ads, bookings, money, reports, staff, settings) and /app/pay/<ref>.
const $main = document.getElementById('main');
let S = { me: null, brand: 'Isoteh', providers: ['manual'], currencies: ['NGN'], feeBps: 1500, releaseDays: 3, publicUrl: location.origin };

// ---- theme ----
const root = document.documentElement;
try { const t = localStorage.getItem('is-theme'); if (t) root.dataset.theme = t; } catch { /* private mode */ }
document.getElementById('theme').addEventListener('click', () => {
  const dark = root.dataset.theme ? root.dataset.theme === 'dark' : matchMedia('(prefers-color-scheme: dark)').matches;
  root.dataset.theme = dark ? 'light' : 'dark';
  try { localStorage.setItem('is-theme', root.dataset.theme); } catch { /* ignore */ }
});

// ---- helpers ----
const rc = (el, ...kids) => el.replaceChildren(...kids.flat(Infinity).filter((k) => k !== null && k !== undefined && k !== false));
function h(tag, attrs = {}, ...kids) {
  const e = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs ?? {})) {
    if (v === undefined || v === null || v === false) continue;
    if (k.startsWith('on')) e.addEventListener(k.slice(2), v);
    else if (k === 'class') e.className = v;
    else if (k === 'value') e.value = v;
    else e.setAttribute(k, v === true ? '' : v);
  }
  for (const k of kids.flat(Infinity)) if (k !== null && k !== undefined && k !== false) e.append(k instanceof Node ? k : String(k));
  return e;
}
async function api(path, data, method) {
  const r = await fetch(path, { method: method ?? (data ? 'POST' : 'GET'), headers: data ? { 'content-type': 'application/json' } : {}, body: data ? JSON.stringify(data) : undefined, credentials: 'same-origin' });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(j.error ?? `Error ${r.status}`);
  return j;
}
const DIG = { JPY: 0, KRW: 0, XOF: 0, XAF: 0, RWF: 0, UGX: 0 };
const digits = (c) => DIG[c] ?? 2;
const money = (minor, cur) => { try { return new Intl.NumberFormat(undefined, { style: 'currency', currency: cur }).format(minor / 10 ** digits(cur)); } catch { return `${minor / 100} ${cur}`; } };
const toMinor = (major, cur) => Math.round(Number(String(major).replace(/[^\d.]/g, '') || 0) * 10 ** digits(cur));
const day = (t) => new Date(t).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' });
const when = (t) => new Date(t).toLocaleString(undefined, { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
const num = (n) => new Intl.NumberFormat().format(n ?? 0);
const KIND = { site: 'Website or blog', newsletter: 'Newsletter', app: 'App or chat', game: 'Game', creator: 'Creator channel' };
const FORMAT = { banner: 'Banner', native: 'Native card', email: 'Newsletter block', game: 'In-game board', creator: 'Sponsored post' };
const STATUS = { requested: ['Waiting for the owner', 'warn'], awaiting_payment: ['Waiting for payment', 'warn'], paid: ['Paid, starts soon', 'ok'], live: ['Running', 'ok'],
  settled: ['Done, owner paid', ''], declined: ['Declined', 'bad'], cancelled: ['Cancelled', ''], expired: ['Expired', ''], disputed: ['Disputed', 'bad'], refunded: ['Refunded', ''] };
const pill = (s) => { const [t, c] = STATUS[s] ?? [s, '']; return h('span', { class: `pill ${c}` }, t); };
const err = () => h('p', { class: 'err', role: 'alert' });
function formData(form) {
  const o = {};
  for (const el of form.elements) if (el.name) o[el.name] = el.type === 'checkbox' ? el.checked : el.value;
  return o;
}
function busy(btn, fn) {
  return async (e) => {
    e?.preventDefault?.();
    const box = btn.closest('form, .card')?.querySelector('.err');
    if (box) box.textContent = '';
    btn.disabled = true;
    try { await fn(); } catch (x) { if (box) box.textContent = x.message; else alert(x.message); } finally { btn.disabled = false; }
  };
}
function field(label, input, hint) { return h('label', {}, label, hint ? h('span', { class: 'hint' }, ` ${hint}`) : null, input); }
const sel = (name, opts, value) => h('select', { name }, Object.entries(opts).map(([v, t]) => h('option', { value: v, selected: v === value }, t)));
const curSel = (name = 'currency', value = 'NGN') => sel(name, Object.fromEntries(S.currencies.map((c) => [c, c])), value);
const fileToB64 = (file) => new Promise((ok, no) => { const r = new FileReader(); r.onload = () => ok(r.result); r.onerror = no; r.readAsDataURL(file); });
async function copy(text, btn) { try { await navigator.clipboard.writeText(text); btn.textContent = 'Copied'; setTimeout(() => { btn.textContent = 'Copy'; }, 1500); } catch { /* select instead */ } }

function go(path) { history.pushState({}, '', path); route(); }
document.addEventListener('click', (e) => {
  const a = e.target.closest('a[href^="/"]');
  if (!a || a.target || e.metaKey || e.ctrlKey || a.hasAttribute('download') || /^\/(s|a|cr|e|go|c|wordpress|demo)\//.test(a.getAttribute('href'))) return;
  e.preventDefault(); go(a.getAttribute('href'));
});
addEventListener('popstate', route);

function show(...nodes) { rc($main, ...nodes); $main.focus({ preventScroll: true }); scrollTo(0, 0); }

// ---- pages ----
async function route() {
  const p = location.pathname;
  for (const a of document.querySelectorAll('nav a')) a.classList.toggle('on', p.startsWith(a.getAttribute('href')));
  try {
    if (p === '/') return landing();
    if (p === '/market') return market();
    let m;
    if ((m = p.match(/^\/book\/(\w+)$/))) return book(m[1]);
    if ((m = p.match(/^\/app\/pay\/(\w+)$/))) return payPage(m[1]);
    if (p.startsWith('/app')) return dashboard(p.split('/')[2] || 'places');
    show(h('p', {}, 'Not found.'));
  } catch (x) { show(h('p', { class: 'err' }, x.message)); }
}

function landing() {
  show(
    h('section', { class: 'hero' },
      h('h1', {}, 'Advertising on your terms.'),
      h('p', { class: 'lead' }, `${S.brand} lets anyone with an audience sell ads directly: websites and blogs, newsletters, apps and chat channels, games, and creators. Advertisers book and pay up front, owners are paid automatically, in their own currency. Ads are picked by what the page is about, never by following people.`),
      h('div', { class: 'row' }, h('a', { class: 'btn', href: '/market' }, 'Find ad space'), h('a', { class: 'btn ghost', href: '/app' }, 'Sell your space'))),
    h('div', { class: 'surfaces' },
      [['Websites and blogs', 'One line of code, WordPress or Ghost. Space is kept free while the ad loads, so pages stay fast and steady.'],
        ['Newsletters', 'A sponsor block for Ghost, Beehiiv, Kit and Mailchimp, and a ready-made block for Substack. Honest numbers: clicks, with opens marked as estimates.'],
        ['Apps and chat', 'Native cards in public channels and feeds, drawn in the app\'s own style. Never in private chats.'],
        ['Games', 'Billboards, liveries and signs inside the game world, counted only when the player actually sees them.'],
        ['Creators', 'A booking page for brand deals: paid up front, one tracked link per post, paid out automatically.']]
        .map(([t, d]) => h('div', { class: 'surface' }, h('b', {}, t), h('span', { class: 'muted small' }, d)))),
    h('h2', {}, 'How it works'),
    h('ol', { class: 'steps' },
      h('li', {}, h('b', {}, 'List your space. '), 'Add your site, newsletter, app, game or channel, set prices per day, week or post, and paste the code we give you.'),
      h('li', {}, h('b', {}, 'Advertisers book and pay. '), 'They pick dates, upload the ad and pay by card, bank, USSD or mobile money. You can approve each booking first. Every ad is checked before it runs.'),
      h('li', {}, h('b', {}, 'You get paid. '), `The money is held while the ad runs and released to you when it ends (creator posts: ${S.releaseDays} days after posting, or sooner when the brand confirms). Our fee is ${S.feeBps / 100}%.`)),
    S.brand === 'Isoteh' ? h('p', { class: 'muted small', style: 'margin-top:24px' }, 'Isoteh (ee-shaw-teh) comes from the Yoruba word ìṣọtẹ̀, rebellion: a break from ad networks that set the rules, take the biggest cut and follow people around.') : null,
  );
}

async function market() {
  const form = h('form', { class: 'row card' },
    h('input', { name: 'q', placeholder: 'Search: food, Lagos, racing…', style: 'flex:2;min-width:180px' }),
    sel('kind', { '': 'Every kind', ...KIND }), h('input', { name: 'country', placeholder: 'Country (NG)', maxlength: 2, style: 'width:110px' }),
    h('button', { type: 'submit' }, 'Search'));
  const list = h('div', { class: 'grid' });
  async function load() {
    const f = formData(form);
    const { slots } = await api(`/v1/market?${new URLSearchParams(f)}`);
    rc(list, ...(slots.length ? slots.map(card) : [h('p', { class: 'muted' }, 'Nothing listed yet that matches.')]));
  }
  function card(s) {
    const price = s.price_day ? `${money(s.price_day, s.currency)} a day` : s.price_week ? `${money(s.price_week, s.currency)} a week` : `${money(s.price_post, s.currency)} a post`;
    return h('a', { class: 'card', href: `/book/${s.id}`, style: 'text-decoration:none;color:inherit;display:block' },
      h('span', { class: 'pill' }, KIND[s.kind]), ' ', h('span', { class: 'pill' }, FORMAT[s.format]),
      h('h3', { style: 'margin-top:10px' }, s.property), h('p', { class: 'muted small' }, s.name, s.width ? ` · ${s.width}×${s.height}` : '', s.country ? ` · ${s.country}` : ''),
      s.about ? h('p', { class: 'small' }, s.about) : null,
      h('p', { style: 'margin:0' }, h('b', {}, price), s.audience ? h('span', { class: 'muted small' }, ` · ${num(s.audience)} audience`) : null));
  }
  form.addEventListener('submit', (e) => { e.preventDefault(); load(); });
  show(h('h1', {}, 'Ad space'), h('p', { class: 'muted' }, 'Book directly with the people who own it. Paid up front, held until your ad has run.'), form, list);
  await load();
}

async function book(slotId) {
  const { slot: s, booked, last30 } = await api(`/v1/slots/${slotId}/public`);
  const box = h('div');
  const info = h('div', { class: 'card' },
    h('span', { class: 'pill' }, KIND[s.kind]), ' ', h('span', { class: 'pill' }, FORMAT[s.format]),
    h('h1', { style: 'margin-top:10px;font-size:1.9rem' }, s.property),
    h('p', { class: 'muted' }, s.name, s.width ? ` · ${s.width}×${s.height} pixels` : ''),
    s.about ? h('p', {}, s.about) : null,
    s.url ? h('p', {}, h('a', { href: s.url, target: '_blank', rel: 'noopener' }, s.url)) : null,
    h('table', {}, h('tbody', {},
      s.price_day ? h('tr', {}, h('td', {}, 'Per day'), h('td', { class: 'num' }, money(s.price_day, s.currency))) : null,
      s.price_week ? h('tr', {}, h('td', {}, 'Per week'), h('td', { class: 'num' }, money(s.price_week, s.currency))) : null,
      s.price_post ? h('tr', {}, h('td', {}, 'Per post'), h('td', { class: 'num' }, money(s.price_post, s.currency))) : null,
      s.audience ? h('tr', {}, h('td', {}, 'Audience'), h('td', { class: 'num' }, num(s.audience))) : null,
      h('tr', {}, h('td', {}, 'Last 30 days'), h('td', { class: 'num' }, `${num(last30.views)} views · ${num(last30.clicks)} clicks`)))),
    booked.length ? h('p', { class: 'small muted', style: 'margin-top:12px' }, 'Already booked: ', booked.map((b) => `${day(b.starts)} to ${day(b.ends - 1)}`).join('; ')) : null);
  show(h('div', { class: 'split' }, info, box));
  if (!s.booking_open || s.status !== 'active') { box.append(h('div', { class: 'card' }, h('p', {}, 'This space isn\'t taking bookings right now.'))); return; }
  if (!S.me) { box.append(h('div', { class: 'card' }, h('h2', {}, 'Book this space'), h('p', { class: 'muted' }, 'Sign in or make a free account to book.'), authForm(() => book(slotId)))); return; }

  const { campaigns } = await api('/v1/campaigns');
  const ads = campaigns.flatMap((c) => c.ads.filter((a) => a.review !== 'rejected').map((a) => ({ ...a, campaign: c.name })));
  const unit = s.format === 'creator' ? 'post' : s.price_day ? 'day' : 'week';
  const units = { ...(s.price_day ? { day: 'Days' } : {}), ...(s.price_week ? { week: 'Weeks' } : {}), ...(s.price_post ? { post: 'Posts' } : {}) };
  const today = new Date().toISOString().slice(0, 10);
  const form = h('form', {},
    ads.length ? field('Your ad', sel('ad_id', Object.fromEntries(ads.map((a) => [a.id, `${a.sponsor}: ${a.title || 'image ad'} (${a.review})`])))) : h('p', { class: 'note' }, 'You have no ads yet. Make one below; it is checked before it runs.'),
    h('div', { class: 'two' }, field('Sold by', sel('unit', units, unit)), field('How many', h('input', { name: 'qty', type: 'number', min: 1, max: 90, value: 1 }))),
    s.format !== 'creator' ? field('Start date', h('input', { name: 'starts', type: 'date', min: today, value: today })) : null,
    field('Note to the owner', h('textarea', { name: 'note', placeholder: 'Optional' })),
    h('p', { class: 'small muted', id: 'total' }), err(), h('button', { type: 'submit' }, 'Book'));
  const total = () => { const f = formData(form); const price = { day: s.price_day, week: s.price_week, post: s.price_post }[f.unit] ?? 0; form.querySelector('#total').textContent = `Total ${money(price * Math.max(1, Number(f.qty) || 1), s.currency)}, paid up front and held until your ad has run.`; };
  form.addEventListener('input', total); total();
  const btn = form.querySelector('button');
  form.addEventListener('submit', busy(btn, async () => {
    const f = formData(form);
    if (!f.ad_id) throw new Error('Make an ad first');
    const { booking } = await api('/v1/bookings', { slot_id: s.id, ad_id: f.ad_id, unit: f.unit, qty: Number(f.qty), starts: f.starts ? Date.parse(`${f.starts}T00:00:00Z`) : undefined, note: f.note });
    rc(box, h('div', { class: 'card' }, h('h2', {}, 'Booked'), h('p', {}, pill(booking.status), ' ', money(booking.amount, booking.currency)),
      booking.status === 'requested' ? h('p', {}, 'The owner will answer soon. You pay once they accept; find it under Bookings.') : payButtons(booking),
      h('a', { href: '/app/bookings' }, 'See your bookings')));
  }));
  box.append(h('div', { class: 'card' }, h('h2', {}, 'Book this space'), form), adForm(campaigns, () => book(slotId), s));
}

function payButtons(b) {
  const wrap = h('div', { class: 'row' });
  for (const p of S.providers) {
    const label = { manual: 'Bank transfer or mobile money', paystack: 'Pay with Paystack', stripe: 'Pay by card (Stripe)' }[p];
    const btn = h('button', { type: 'button', class: p === 'manual' ? 'ghost' : '' }, label);
    btn.addEventListener('click', busy(btn, async () => { const r = await api(`/v1/bookings/${b.id}/pay`, { provider: p }); if (r.url.startsWith(location.origin)) go(new URL(r.url).pathname); else location.href = r.url; }));
    wrap.append(btn);
  }
  return h('div', {}, wrap, err());
}

async function payPage(ref) {
  const { payment: p } = await api(`/v1/payments/${ref}`);
  show(h('div', { class: 'card', style: 'max-width:560px' }, h('h1', { style: 'font-size:1.8rem' }, p.status === 'paid' ? 'Paid. Thank you.' : 'Pay by transfer'),
    p.status === 'paid' ? h('p', {}, 'Your payment is confirmed.') : [
      h('p', {}, `Send ${money(p.amount, p.currency)} by bank transfer or mobile money and put this reference in the description:`),
      h('pre', {}, p.ref),
      S.payInstructions ? h('pre', {}, S.payInstructions) : h('p', { class: 'note' }, 'Our team will send you the account to pay into.'),
      h('p', { class: 'muted small' }, 'Our team confirms it, usually the same day, and your booking or credit starts straight away.')],
    h('a', { href: p.kind === 'booking' ? '/app/bookings' : '/app/money' }, 'Back')));
}

function authForm(after) {
  let mode = 'login';
  const form = h('form', {});
  const draw = () => {
    rc(form, 
      mode === 'signup' ? field('Your name or business', h('input', { name: 'name', autocomplete: 'name', required: true })) : null,
      field('Email', h('input', { name: 'email', type: 'email', autocomplete: 'email', required: true })),
      field('Password', h('input', { name: 'password', type: 'password', autocomplete: mode === 'signup' ? 'new-password' : 'current-password', minlength: mode === 'signup' ? 10 : 1, required: true }), mode === 'signup' ? '(10 characters or more)' : ''),
      err(), h('div', { class: 'row' }, h('button', { type: 'submit' }, mode === 'signup' ? 'Make my account' : 'Sign in'),
        h('button', { type: 'button', class: 'ghost', onclick: () => { mode = mode === 'login' ? 'signup' : 'login'; draw(); } }, mode === 'login' ? 'New here? Make an account' : 'I have an account')));
  };
  draw();
  form.addEventListener('submit', (e) => busy(form.querySelector('button[type=submit]'), async () => {
    const { me } = await api(`/v1/auth/${mode}`, formData(form)); S.me = me; after();
  })(e));
  return form;
}

// ---- the dashboard ----
async function dashboard(tab) {
  if (!S.me) return show(h('div', { class: 'card', style: 'max-width:480px;margin:0 auto' }, h('h1', { style: 'font-size:1.8rem' }, 'Your dashboard'), h('p', { class: 'muted' }, 'Sell your ad space, run ads, and see your money.'), authForm(() => dashboard(tab))));
  const tabs = [['places', 'My places'], ['ads', 'My ads'], ['bookings', 'Bookings'], ['money', 'Money'], ['reports', 'Reports'],
    ...(['staff', 'admin'].includes(S.me.role) ? [['staff', 'Staff']] : []), ['settings', 'Settings']];
  const body = h('div');
  show(h('div', { class: 'tabs', role: 'tablist' }, tabs.map(([k, t]) => h('a', { href: `/app/${k}`, class: k === tab ? 'on' : '', role: 'tab' }, t))), body);
  const pages = { places, ads: adsTab, bookings, money: moneyTab, reports, staff: staffTab, settings };
  await (pages[tab] ?? places)(body);
}

async function places(body) {
  const { properties } = await api('/v1/properties');
  const add = h('form', { class: 'card' }, h('h2', {}, 'Add a place'),
    h('div', { class: 'two' }, field('Kind', sel('kind', KIND)), field('Name', h('input', { name: 'name', required: true, placeholder: 'Lagos Food Blog' }))),
    field('Address', h('input', { name: 'url', placeholder: 'https://…' }), '(optional)'),
    field('What it is about', h('textarea', { name: 'about', placeholder: 'Recipes and restaurant reviews from Lagos' })),
    field('Topics', h('input', { name: 'keywords', placeholder: 'food, lagos, recipes' }), '(helps pick fitting ads)'),
    h('div', { class: 'two' }, field('Audience', h('input', { name: 'audience', type: 'number', min: 0, placeholder: 'Monthly readers, subscribers or players' })),
      field('Country', h('input', { name: 'country', maxlength: 2, placeholder: 'NG' }))),
    field('Currency you charge in', curSel()), err(), h('button', { type: 'submit' }, 'Add place'));
  add.addEventListener('submit', (e) => busy(add.querySelector('button'), async () => { await api('/v1/properties', { ...formData(add), audience: Number(formData(add).audience) || 0 }); places(body); })(e));
  rc(body, 
    properties.length ? null : h('p', { class: 'note' }, 'Start by adding the place where ads will appear: your website, newsletter, app, game or channel. Then add ad slots to it.'),
    ...properties.map((p) => placeCard(p, body)), add);
}

function placeCard(p, body) {
  const slotForm = h('form', {});
  const fmtDefault = { site: 'banner', newsletter: 'email', app: 'native', game: 'game', creator: 'creator' }[p.kind];
  const draw = () => rc(slotForm, 
    h('h3', {}, 'Add an ad slot'),
    h('div', { class: 'two' }, field('Name', h('input', { name: 'name', required: true, placeholder: p.kind === 'newsletter' ? 'Top of every issue' : 'Sidebar' })),
      p.kind === 'creator' ? h('input', { type: 'hidden', name: 'format', value: 'creator' }) : field('Format', sel('format', Object.fromEntries(Object.entries(FORMAT).filter(([k]) => k !== 'creator')), fmtDefault))),
    p.kind === 'creator' ? null : h('div', { class: 'two' }, field('Width', h('input', { name: 'width', type: 'number', min: 0, placeholder: '300' })), field('Height', h('input', { name: 'height', type: 'number', min: 0, placeholder: '250' }))),
    h('div', { class: 'two' },
      p.kind === 'creator' ? field(`Price per post (${p.currency})`, h('input', { name: 'price_post', inputmode: 'decimal' }))
        : field(`Price per day (${p.currency})`, h('input', { name: 'price_day', inputmode: 'decimal' }), '(optional)'),
      p.kind === 'creator' ? null : field(`Price per week (${p.currency})`, h('input', { name: 'price_week', inputmode: 'decimal' }), '(optional)')),
    h('label', { class: 'check' }, h('input', { type: 'checkbox', name: 'booking_open', checked: true }), 'Take bookings'),
    h('label', { class: 'check' }, h('input', { type: 'checkbox', name: 'approve', checked: true }), 'I approve each booking first'),
    p.kind === 'creator' ? null : h('label', { class: 'check' }, h('input', { type: 'checkbox', name: 'network' }), 'Fill unsold time with ads from the network (paid per view)'),
    err(), h('button', { type: 'submit', class: 'small' }, 'Add slot'));
  draw();
  slotForm.addEventListener('submit', (e) => busy(slotForm.querySelector('button'), async () => {
    const f = formData(slotForm);
    await api('/v1/slots', { ...f, property_id: p.id, width: Number(f.width) || 0, height: Number(f.height) || 0,
      price_day: toMinor(f.price_day ?? 0, p.currency), price_week: toMinor(f.price_week ?? 0, p.currency), price_post: toMinor(f.price_post ?? 0, p.currency) });
    places(body);
  })(e));
  return h('div', { class: 'card' },
    h('div', { class: 'row', style: 'justify-content:space-between' }, h('h2', { style: 'margin:0' }, p.name), h('span', { class: 'pill' }, KIND[p.kind])),
    h('p', { class: 'muted small' }, [p.url, p.country, p.audience ? `${num(p.audience)} audience` : null, p.currency].filter(Boolean).join(' · ')),
    ...p.slots.map((s) => slotRow(s, p)),
    h('details', {}, h('summary', { class: 'small', style: 'cursor:pointer;font-weight:600;margin:8px 0' }, 'Add an ad slot'), slotForm));
}

function slotRow(s, p) {
  const out = h('div');
  const btn = h('button', { type: 'button', class: 'small ghost' }, 'Get the code');
  btn.addEventListener('click', busy(btn, async () => {
    const { snippets } = await api(`/v1/slots/${s.id}/snippets`);
    rc(out, ...snippets.map((x) => { const c = h('button', { type: 'button', class: 'small ghost' }, 'Copy'); c.addEventListener('click', () => copy(x.code, c)); return h('div', { style: 'margin:10px 0' }, h('b', {}, x.where), h('p', { class: 'small muted', style: 'margin:2px 0' }, x.how), h('pre', {}, x.code), c); }));
  }));
  const prices = [s.price_day && `${money(s.price_day, p.currency)}/day`, s.price_week && `${money(s.price_week, p.currency)}/week`, s.price_post && `${money(s.price_post, p.currency)}/post`].filter(Boolean).join(' · ');
  return h('div', { style: 'border-top:1px solid var(--line);padding:10px 0' },
    h('div', { class: 'row', style: 'justify-content:space-between' }, h('div', {}, h('b', {}, s.name), ' ', h('span', { class: 'pill' }, FORMAT[s.format]), s.width ? h('span', { class: 'muted small' }, ` ${s.width}×${s.height}`) : null),
      h('div', { class: 'row' }, h('a', { href: `/book/${s.id}`, class: 'small' }, 'Booking page'), btn)),
    h('p', { class: 'small muted', style: 'margin:4px 0 0' }, prices || 'No prices set', s.booking_open ? '' : ' · not taking bookings', s.network ? ' · network on' : ''), out);
}

function adForm(campaigns, after, slot) {
  const form = h('form', { class: 'card' });
  const draw = (kind) => rc(form, 
    h('h2', {}, 'Make an ad'),
    campaigns.length ? field('Campaign', sel('campaign_id', { ...Object.fromEntries(campaigns.map((c) => [c.id, c.name])), '': 'A new campaign' })) : h('input', { type: 'hidden', name: 'campaign_id', value: '' }),
    field('Kind', sel('kind', { image: 'Image (banner, newsletter, game board)', native: 'Native card (headline, text, small picture)' }, kind)),
    field('Sponsor name', h('input', { name: 'sponsor', required: true, placeholder: 'Your business name' })),
    field('Headline', h('input', { name: 'title', maxlength: 80 }), kind === 'native' ? '' : '(optional)'),
    kind === 'native' ? field('Text', h('textarea', { name: 'body', maxlength: 220 })) : null,
    kind === 'native' ? field('Button word', h('input', { name: 'cta', maxlength: 24, placeholder: 'Order now' })) : null,
    field('Link', h('input', { name: 'url', required: true, placeholder: 'https://…' })),
    field('Image', h('input', { name: 'image', type: 'file', accept: 'image/png,image/jpeg,image/webp,image/gif' }),
      slot?.width ? `(${slot.width}×${slot.height} for this space; PNG, JPEG, WebP or GIF under 1.5 MB)` : '(PNG, JPEG, WebP or GIF under 1.5 MB)'),
    h('p', { class: 'small muted' }, 'Every ad is checked by our team before it runs. Ads are always labelled Sponsored.'),
    err(), h('button', { type: 'submit' }, 'Save ad'));
  draw('image');
  form.addEventListener('change', (e) => { if (e.target.name === 'kind') draw(e.target.value); });
  form.addEventListener('submit', (e) => busy(form.querySelector('button[type=submit]'), async () => {
    const f = formData(form), file = form.querySelector('input[type=file]').files[0];
    let cid = f.campaign_id;
    if (!cid) cid = (await api('/v1/campaigns', { name: `${f.sponsor} ads`, currency: slot?.currency ?? 'NGN' })).campaign.id;
    await api('/v1/ads', { campaign_id: cid, kind: f.kind, sponsor: f.sponsor, title: f.title ?? '', body: f.body ?? '', cta: f.cta ?? '', url: f.url, image: file ? await fileToB64(file) : undefined });
    after();
  })(e));
  return form;
}

async function adsTab(body) {
  const { campaigns } = await api('/v1/campaigns');
  const camp = h('form', { class: 'card' }, h('h2', {}, 'Pay-per-view campaign'),
    h('p', { class: 'small muted' }, 'Runs across every slot whose owner fills unsold time from the network, matched by topic and country. You pay per thousand views from your credit; whatever is left comes back when it ends.'),
    field('Name', h('input', { name: 'name', required: true })),
    h('div', { class: 'two' }, field('Currency', curSel()), field('Budget', h('input', { name: 'budget', inputmode: 'decimal' }))),
    h('div', { class: 'two' }, field('Price per 1,000 views', h('input', { name: 'cpm', inputmode: 'decimal' })), field('Most views a day', h('input', { name: 'daily_views', type: 'number', min: 0 }), '(0 = no limit)')),
    field('Topics', h('input', { name: 'keywords', placeholder: 'food, football' }), '(empty = any)'),
    field('Countries', h('input', { name: 'countries', placeholder: 'NG, GH, KE' }), '(empty = any)'),
    err(), h('button', { type: 'submit' }, 'Save as draft'));
  camp.addEventListener('submit', (e) => busy(camp.querySelector('button'), async () => {
    const f = formData(camp);
    await api('/v1/campaigns', { ...f, budget: toMinor(f.budget, f.currency), cpm: toMinor(f.cpm, f.currency), daily_views: Number(f.daily_views) || 0 });
    adsTab(body);
  })(e));
  const list = campaigns.map((c) => {
    const act = h('div', { class: 'row' });
    const set = (status, label, cls = 'ghost') => { const b = h('button', { type: 'button', class: `small ${cls}` }, label); b.addEventListener('click', busy(b, async () => { await api(`/v1/campaigns/${c.id}`, { status }, 'PATCH'); adsTab(body); })); act.append(b); };
    if (c.cpm && c.status !== 'active' && c.status !== 'ended') set('active', 'Start');
    if (c.cpm && c.status === 'active') set('paused', 'Pause');
    if (c.cpm && c.status !== 'ended') set('ended', 'End', 'danger');
    return h('div', { class: 'card' },
      h('div', { class: 'row', style: 'justify-content:space-between' }, h('h2', { style: 'margin:0' }, c.name), h('span', { class: 'pill' }, c.status)),
      c.cpm ? h('p', { class: 'small muted' }, `${money(c.cpm, c.currency)} per 1,000 views · spent ${money(c.spent, c.currency)} of ${money(c.budget, c.currency)}`) : h('p', { class: 'small muted' }, 'For direct bookings'),
      act,
      h('div', { class: 'grid', style: 'margin-top:12px' }, c.ads.map((a) => h('div', {},
        a.image_url ? h('img', { class: 'thumb', src: a.image_url, alt: '' }) : null,
        h('p', { style: 'margin:6px 0 0' }, h('b', {}, a.sponsor), a.title ? `: ${a.title}` : ''),
        h('span', { class: `pill ${a.review === 'approved' ? 'ok' : a.review === 'rejected' ? 'bad' : 'warn'}` }, a.review === 'pending' ? 'Being checked' : a.review),
        a.review_note ? h('p', { class: 'small' }, a.review_note) : null))));
  });
  rc(body, ...list, adForm(campaigns, () => adsTab(body)), camp);
}

async function bookings(body) {
  const [mine, theirs] = await Promise.all([api('/v1/bookings'), api('/v1/bookings?as=owner')]);
  const table = (rows, owner) => rows.length ? h('div', { class: 'scroll' }, h('table', {},
    h('thead', {}, h('tr', {}, h('th', {}, owner ? 'Advertiser' : 'Where'), h('th', {}, 'When'), h('th', { class: 'num' }, 'Amount'), h('th', {}, 'Status'), h('th', { class: 'num hide-sm' }, 'Views · clicks'), h('th', {}))),
    h('tbody', {}, rows.map((b) => h('tr', {},
      h('td', {}, owner ? h('span', {}, h('b', {}, b.sponsor), b.title ? ` ${b.title}` : '', b.review !== 'approved' ? h('span', { class: 'pill warn' }, ' ad being checked') : '') : h('span', {}, h('b', {}, b.property), ` · ${b.slot}`), b.note ? h('div', { class: 'small muted' }, b.note) : null),
      h('td', { class: 'small' }, b.unit === 'post' ? (b.post_url ? h('a', { href: b.post_url, target: '_blank', rel: 'noopener' }, 'The post') : `${b.qty} post`) : `${day(b.starts)} to ${day(b.ends - 1)}`),
      h('td', { class: 'num' }, money(b.amount, b.currency), owner ? h('div', { class: 'small muted' }, `you get ${money(b.amount - b.fee, b.currency)}`) : null),
      h('td', {}, pill(b.status)),
      h('td', { class: 'num hide-sm' }, `${num(b.views)} · ${num(b.clicks)}`),
      h('td', {}, actions(b, owner))))))) : h('p', { class: 'muted' }, 'None yet.');
  function actions(b, owner) {
    const wrap = h('div', { class: 'row' });
    const act = (path, label, data, cls = 'ghost') => { const btn = h('button', { type: 'button', class: `small ${cls}` }, label); btn.addEventListener('click', busy(btn, async () => { await api(`/v1/bookings/${b.id}/${path}`, data ?? {}); bookings(body); })); wrap.append(btn); };
    if (owner && b.status === 'requested') { act('accept', 'Accept', null, ''); act('decline', 'Decline'); }
    if (owner && b.unit === 'post' && ['paid', 'live'].includes(b.status)) {
      wrap.append(h('div', { class: 'small' }, 'Your tracked link: ', h('code', {}, b.link)));
      const btn = h('button', { type: 'button', class: 'small' }, b.post_url ? 'Change post link' : 'I posted it');
      btn.addEventListener('click', busy(btn, async () => { const url = prompt('Paste the link to your post (https://…)'); if (url) { await api(`/v1/bookings/${b.id}/post`, { url }); bookings(body); } }));
      wrap.append(btn);
    }
    if (!owner && b.status === 'awaiting_payment') wrap.append(payButtons(b));
    if (!owner && ['requested', 'awaiting_payment'].includes(b.status)) act('cancel', 'Cancel');
    if (!owner && b.status === 'live' && b.unit === 'post' && b.post_url) act('confirm', 'Looks good, pay them', null, '');
    if (!owner && ['paid', 'live'].includes(b.status)) {
      const btn = h('button', { type: 'button', class: 'small danger' }, 'Report a problem');
      btn.addEventListener('click', busy(btn, async () => { const reason = prompt('What went wrong?'); if (reason) { await api(`/v1/bookings/${b.id}/dispute`, { reason }); bookings(body); } }));
      wrap.append(btn);
    }
    return wrap;
  }
  rc(body, h('div', { class: 'card' }, h('h2', {}, 'People booking your space'), table(theirs.bookings, true)),
    h('div', { class: 'card' }, h('h2', {}, 'Space you booked'), table(mine.bookings, false)));
}

async function moneyTab(body) {
  const m = await api('/v1/money');
  const top = h('form', { class: 'card' }, h('h2', {}, 'Add credit'), h('p', { class: 'small muted' }, 'For pay-per-view campaigns. Bookings are paid one by one.'),
    h('div', { class: 'two' }, field('Amount', h('input', { name: 'amount', inputmode: 'decimal', required: true })), field('Currency', curSel())),
    field('Pay with', sel('provider', Object.fromEntries(S.providers.map((p) => [p, { manual: 'Bank transfer or mobile money', paystack: 'Paystack', stripe: 'Card (Stripe)' }[p]])))),
    err(), h('button', { type: 'submit' }, 'Continue'));
  top.addEventListener('submit', (e) => busy(top.querySelector('button'), async () => {
    const f = formData(top);
    const r = await api('/v1/topups', { amount: toMinor(f.amount, f.currency), currency: f.currency, provider: f.provider });
    if (r.url.startsWith(location.origin)) go(new URL(r.url).pathname); else location.href = r.url;
  })(e));
  const out = h('form', { class: 'card' }, h('h2', {}, 'Get paid'),
    h('div', { class: 'two' }, field('Amount', h('input', { name: 'amount', inputmode: 'decimal', required: true })), field('Currency', curSel())),
    field('How', sel('method', { bank: 'Bank account', mobile_money: 'Mobile money', paypal: 'PayPal', other: 'Other' })),
    field('Account details', h('textarea', { name: 'details', required: true, placeholder: 'Bank, account number and name; or phone number and network' })),
    err(), h('button', { type: 'submit' }, 'Ask for payout'));
  out.addEventListener('submit', (e) => busy(out.querySelector('button'), async () => { const f = formData(out); await api('/v1/payouts', { ...f, amount: toMinor(f.amount, f.currency) }); moneyTab(body); })(e));
  const KINDS = { earning: 'Earned', fee: 'Fee', topup: 'Credit added', hold: 'Held for a campaign', release: 'Returned', refund: 'Refund', payout: 'Payout', payout_returned: 'Payout returned', spend: 'Spent' };
  rc(body, 
    h('div', { class: 'grid' }, (m.balances.length ? m.balances : [{ currency: 'NGN', amount: 0 }]).map((b) => h('div', { class: 'card' }, h('div', { class: 'muted small' }, `Balance in ${b.currency}`), h('div', { class: 'stat' }, money(b.amount, b.currency))))),
    h('div', { class: 'split' },
      h('div', { class: 'card' }, h('h2', {}, 'History'), m.ledger.length ? h('div', { class: 'scroll' }, h('table', {}, h('tbody', {}, m.ledger.map((l) => h('tr', {},
        h('td', { class: 'small' }, when(l.at)), h('td', {}, KINDS[l.kind] ?? l.kind, l.note ? h('div', { class: 'small muted' }, l.note) : null), h('td', { class: 'num' }, money(l.amount, l.currency))))))) : h('p', { class: 'muted' }, 'Nothing yet.'),
      m.payouts.length ? [h('h3', { style: 'margin-top:16px' }, 'Payouts'), m.payouts.map((p) => h('p', { class: 'small' }, `${day(p.created)} · ${money(p.amount, p.currency)} · ${p.status}`))] : null),
      h('div', {}, out, top)));
}

async function reports(body) {
  const [own, bought] = await Promise.all([api('/v1/reports?as=owner&days=30'), api('/v1/reports?days=30')]);
  const block = (title, rows, nameOf) => {
    if (!rows.length) return h('div', { class: 'card' }, h('h2', {}, title), h('p', { class: 'muted' }, 'No numbers yet.'));
    const by = new Map();
    for (const r of rows) { const k = nameOf(r); const x = by.get(k) ?? { serves: 0, views: 0, clicks: 0 }; x.serves += r.serves; x.views += r.views; x.clicks += r.clicks; by.set(k, x); }
    const days = [...rows.reduce((m, r) => m.set(r.day, (m.get(r.day) ?? 0) + r.views), new Map())];
    const max = Math.max(1, ...days.map(([, v]) => v));
    return h('div', { class: 'card' }, h('h2', {}, title),
      h('div', { style: 'display:flex;align-items:flex-end;gap:3px;height:80px;margin:8px 0 14px', role: 'img', 'aria-label': 'Views per day' },
        days.map(([d, v]) => h('div', { class: 'bar', title: `${d}: ${num(v)} views`, style: `flex:1;height:${Math.max(2, Math.round(v / max * 80))}px` }))),
      h('div', { class: 'scroll' }, h('table', {}, h('thead', {}, h('tr', {}, h('th', {}, ''), h('th', { class: 'num' }, 'Shown'), h('th', { class: 'num' }, 'Seen'), h('th', { class: 'num' }, 'Clicks'), h('th', { class: 'num' }, 'Click rate'))),
        h('tbody', {}, [...by].map(([k, x]) => h('tr', {}, h('td', {}, k), h('td', { class: 'num' }, num(x.serves)), h('td', { class: 'num' }, num(x.views)), h('td', { class: 'num' }, num(x.clicks)),
          h('td', { class: 'num' }, x.views ? `${(x.clicks / x.views * 100).toFixed(1)}%` : '–')))))),
      h('p', { class: 'small muted' }, 'Last 30 days. "Seen" counts an ad that was at least half on screen for a second. Newsletter "shown" counts opens, which mail apps inflate; clicks are exact.'));
  };
  rc(body, block('Your space', own.rows, (r) => r.slot), block('Your ads', bought.rows, (r) => `${r.sponsor}${r.title ? `: ${r.title}` : ''}`));
}

async function staffTab(body) {
  const [{ ads }, o] = await Promise.all([api('/v1/staff/review'), api('/v1/staff/overview')]);
  const act = (label, path, data, cls = 'ghost') => { const b = h('button', { type: 'button', class: `small ${cls}` }, label); b.addEventListener('click', busy(b, async () => { await api(path, data ?? {}); staffTab(body); })); return b; };
  const bal = (list) => list.length ? list.map((b) => money(b.amount, b.currency)).join(' · ') : '0';
  rc(body, 
    h('div', { class: 'grid' },
      h('div', { class: 'card' }, h('div', { class: 'muted small' }, 'Today'), h('div', { class: 'stat' }, num(o.today.views)), h('div', { class: 'small muted' }, `views · ${num(o.today.clicks)} clicks · ${num(o.today.serves)} shown`)),
      h('div', { class: 'card' }, h('div', { class: 'muted small' }, 'Held for running ads'), h('div', { class: 'stat', style: 'font-size:1.2rem' }, bal(o.escrow))),
      h('div', { class: 'card' }, h('div', { class: 'muted small' }, 'Our fees'), h('div', { class: 'stat', style: 'font-size:1.2rem' }, bal(o.fees))),
      h('div', { class: 'card' }, h('div', { class: 'muted small' }, 'People and places'), h('div', { class: 'stat' }, num(o.accounts)), h('div', { class: 'small muted' }, `${num(o.properties)} places · ${num(o.slots)} slots`))),
    h('div', { class: 'card' }, h('h2', {}, `Ads to check (${ads.length})`), ads.length ? h('div', { class: 'grid' }, ads.map((a) => h('div', {},
      a.image_url ? h('img', { class: 'thumb', src: a.image_url, alt: '' }) : null,
      h('p', { style: 'margin:6px 0 2px' }, h('b', {}, a.sponsor), a.title ? `: ${a.title}` : ''), a.body ? h('p', { class: 'small' }, a.body) : null,
      h('p', { class: 'small muted' }, h('a', { href: a.url, target: '_blank', rel: 'noopener noreferrer' }, a.url), ` · from ${a.email}`),
      h('div', { class: 'row' }, act('Approve', `/v1/staff/ads/${a.id}/review`, { decision: 'approved' }, ''),
        (() => { const b = h('button', { type: 'button', class: 'small danger' }, 'Reject'); b.addEventListener('click', busy(b, async () => { const note = prompt('Why? (the advertiser sees this)'); if (note !== null) { await api(`/v1/staff/ads/${a.id}/review`, { decision: 'rejected', note }); staffTab(body); } })); return b; })())))) : h('p', { class: 'muted' }, 'All checked.')),
    h('div', { class: 'card' }, h('h2', {}, 'Transfers to confirm'), o.payments.length ? o.payments.map((p) => h('div', { class: 'row', style: 'justify-content:space-between;border-top:1px solid var(--line);padding:8px 0' },
      h('span', {}, h('code', {}, p.ref), ` · ${money(p.amount, p.currency)} · ${p.email} · ${p.kind}`), act('Money received', `/v1/staff/payments/${p.ref}/paid`, {}, ''))) : h('p', { class: 'muted' }, 'None waiting.')),
    h('div', { class: 'card' }, h('h2', {}, 'Payouts to send'), o.payouts.length ? o.payouts.map((p) => h('div', { style: 'border-top:1px solid var(--line);padding:8px 0' },
      h('p', { style: 'margin:0' }, h('b', {}, money(p.amount, p.currency)), ` to ${p.name} (${p.email}) by ${p.method.replace('_', ' ')}`), h('pre', {}, p.details),
      h('div', { class: 'row' }, act('Sent', `/v1/staff/payouts/${p.id}/paid`, {}, ''), act('Return to balance', `/v1/staff/payouts/${p.id}/return`)))) : h('p', { class: 'muted' }, 'None waiting.')),
    h('div', { class: 'card' }, h('h2', {}, 'Disputes'), o.disputes.length ? o.disputes.map((b) => h('div', { style: 'border-top:1px solid var(--line);padding:8px 0' },
      h('p', { style: 'margin:0' }, h('b', {}, b.slot), ` · ${money(b.amount, b.currency)}`), b.post_url ? h('p', { class: 'small' }, h('a', { href: b.post_url, target: '_blank', rel: 'noopener noreferrer' }, b.post_url)) : null, h('pre', {}, b.note ?? ''),
      h('div', { class: 'row' }, act('Pay the owner', `/v1/staff/bookings/${b.id}/release`, {}, ''), act('Refund the advertiser', `/v1/staff/bookings/${b.id}/refund`, {}, 'danger')))) : h('p', { class: 'muted' }, 'None.')),
    S.me.role === 'admin' ? (() => {
      const f = h('form', { class: 'card' }, h('h2', {}, 'Team'), h('div', { class: 'two' }, field('Email', h('input', { name: 'email', type: 'email', required: true })), field('Role', sel('role', { staff: 'Staff', admin: 'Administrator', member: 'Member' }))), err(), h('button', { type: 'submit', class: 'small' }, 'Set role'));
      f.addEventListener('submit', (e) => busy(f.querySelector('button'), async () => { await api('/v1/staff/accounts', formData(f)); f.reset(); })(e));
      return f;
    })() : null);
}

async function settings(body) {
  const { keys } = await api('/v1/keys');
  const f = h('form', { class: 'row' }, h('input', { name: 'label', placeholder: 'What it is for', style: 'flex:1;min-width:160px' }), h('button', { type: 'submit', class: 'small' }, 'Make a key'));
  const shown = h('div');
  f.addEventListener('submit', (e) => busy(f.querySelector('button'), async () => { const r = await api('/v1/keys', formData(f)); rc(shown, h('p', { class: 'note' }, 'Copy it now; it won\'t be shown again.'), h('pre', {}, r.key)); })(e));
  const out = h('button', { type: 'button', class: 'ghost' }, 'Sign out');
  out.addEventListener('click', busy(out, async () => { await api('/v1/auth/logout', {}); S.me = null; go('/'); }));
  rc(body, 
    h('div', { class: 'card' }, h('h2', {}, S.me.name), h('p', { class: 'muted' }, S.me.email, ` · ${S.me.role}`), out),
    h('div', { class: 'card' }, h('h2', {}, 'API keys'), h('p', { class: 'small muted' }, 'For your own servers: a chat app adding its channels as places, a studio adding slots from its build tools. Send it as "Authorization: Bearer <key>".'),
      keys.map((k) => { const d = h('button', { type: 'button', class: 'small danger' }, 'Delete'); d.addEventListener('click', busy(d, async () => { await api(`/v1/keys/${k.id}/delete`, {}); settings(body); })); return h('div', { class: 'row', style: 'justify-content:space-between;padding:6px 0' }, h('span', {}, k.label || 'Key', h('span', { class: 'small muted' }, ` · ${day(k.created)}`)), d); }),
      f, err(), shown));
}

// ---- start ----
api('/v1/me').then((r) => { S = { ...S, ...r }; document.title = document.title.replace(/^[^:]+/, S.brand); route(); }).catch(() => route());
