/* Isoteh website script. Put <div data-isoteh="SLOT_ID"></div> where an ad goes and load this file once.
   - Keeps the slot's space while the ad loads (give the div its size or aspect-ratio), so the page never jumps.
   - Loads only when the slot is near the screen. No cookies, no storage, nothing about the reader is sent.
   - A view counts when half the ad has been on screen for one second while the page is visible.
   - Every ad is labelled Sponsored and links out with rel="sponsored". */
(function () {
  'use strict';
  if (window.__isoteh) return;
  var me = document.currentScript;
  var server = (me && me.src ? new URL(me.src) : location).origin;
  window.__isoteh = { server: server, version: 1 };

  var CSS = ':host{display:block;font:14px/1.4 system-ui,-apple-system,"Segoe UI",Roboto,sans-serif;color:inherit}' +
    'a{color:inherit;text-decoration:none;display:block}' +
    '.lab{font-size:11px;letter-spacing:.04em;text-transform:uppercase;opacity:.6;margin:0 0 4px}' +
    'img{display:block;width:100%;height:auto;border-radius:6px}' +
    '.card{display:flex;gap:12px;align-items:flex-start;padding:12px;border:1px solid rgba(127,127,127,.3);border-radius:10px}' +
    '.card img{width:72px;height:72px;object-fit:cover;flex:none}' +
    '.t{font-weight:600;margin:0 0 2px}.b{margin:0 0 6px;opacity:.85}.c{display:inline-block;font-weight:600;font-size:13px;padding:4px 10px;border-radius:999px;border:1px solid currentColor}' +
    '.open{display:flex;align-items:center;justify-content:center;height:100%;min-height:60px;border:1px dashed rgba(127,127,127,.5);border-radius:8px;font-size:13px;opacity:.75;text-align:center;padding:8px}';

  function keywords(el) {
    var k = el.getAttribute('data-keywords') || '';
    var m = document.querySelector('meta[name="keywords"]');
    if (m) k += ',' + m.getAttribute('content');
    return k.slice(0, 300);
  }

  function el(tag, cls, text) { var e = document.createElement(tag); if (cls) e.className = cls; if (text) e.textContent = text; return e; }

  function render(host, data) {
    var root = host.shadowRoot || host.attachShadow({ mode: 'open' });
    root.innerHTML = '';
    var style = el('style'); style.textContent = CSS; root.appendChild(style);
    if (data.open) {
      var o = el('a', 'open'); o.href = data.open.url; o.target = '_blank'; o.rel = 'noopener';
      o.textContent = data.open.text + ' · from ' + data.open.from; root.appendChild(o); return null;
    }
    var ad = data.ad;
    if (!ad) { if (!host.style.aspectRatio && !host.style.height) host.style.display = 'none'; return null; }
    var lab = el('p', 'lab', data.label + ' · ' + ad.sponsor); root.appendChild(lab);
    var a = el('a'); a.href = data.click; a.target = '_blank'; a.rel = 'sponsored noopener';
    if (ad.kind === 'image') {
      var img = el('img'); img.src = ad.image; img.alt = ad.title || ad.sponsor; img.width = ad.width; img.height = ad.height; img.decoding = 'async';
      a.appendChild(img);
    } else {
      var card = el('div', 'card');
      if (ad.image) { var i2 = el('img'); i2.src = ad.image; i2.alt = ''; card.appendChild(i2); }
      var txt = el('div');
      txt.appendChild(el('p', 't', ad.title));
      if (ad.body) txt.appendChild(el('p', 'b', ad.body));
      if (ad.cta) txt.appendChild(el('span', 'c', ad.cta));
      card.appendChild(txt); a.appendChild(card);
    }
    root.appendChild(a);
    return data.view;
  }

  function watchView(host, url) {
    var timer = null, done = false;
    var io = new IntersectionObserver(function (es) {
      var e = es[es.length - 1];
      if (done) return;
      if (e.intersectionRatio >= 0.5 && document.visibilityState === 'visible') {
        if (!timer) timer = setTimeout(function () {
          done = true; io.disconnect();
          if (!(navigator.sendBeacon && navigator.sendBeacon(url))) fetch(url, { method: 'POST', keepalive: true, mode: 'no-cors' });
        }, 1000);
      } else if (timer) { clearTimeout(timer); timer = null; }
    }, { threshold: [0, 0.5, 1] });
    io.observe(host);
    document.addEventListener('visibilitychange', function () { if (document.visibilityState !== 'visible' && timer) { clearTimeout(timer); timer = null; } });
  }

  function load(host) {
    var slot = host.getAttribute('data-isoteh');
    var q = '?slot=' + encodeURIComponent(slot) + '&kw=' + encodeURIComponent(keywords(host));
    fetch(server + '/v1/ad' + q, { credentials: 'omit' }).then(function (r) { return r.ok ? r.json() : { ad: null }; })
      .then(function (data) { var view = render(host, data); if (view) watchView(host, view); })
      .catch(function () { /* no ad is fine */ });
  }

  var near = 'IntersectionObserver' in window ? new IntersectionObserver(function (es) {
    es.forEach(function (e) { if (e.isIntersecting) { near.unobserve(e.target); load(e.target); } });
  }, { rootMargin: '300px' }) : null;

  function scan() {
    var list = document.querySelectorAll('[data-isoteh]:not([data-isoteh-on])');
    for (var i = 0; i < list.length; i++) {
      var h = list[i]; h.setAttribute('data-isoteh-on', '');
      if (near) near.observe(h); else load(h);
    }
  }
  scan();
  if ('MutationObserver' in window) new MutationObserver(scan).observe(document.documentElement, { childList: true, subtree: true });
})();
