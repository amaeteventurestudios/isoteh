/* Isoteh events tag: counts what happens after someone clicks an Isoteh ad (a visit, a sign-up, a sale).
   Put it on every page:  <script src="https://<your isoteh>/s/isoteh-events.js" async></script>
   Then, where something happens:  isoteh('purchase', { value: 24.00, currency: 'USD' })   or   isoteh('sign_up')
   A click on an ad adds ?isoteh_ref=... to your link. The reference names the ad and the day, the same for everyone who
   clicked that ad that day, so it can't point to a person. This tag keeps it only for this browser tab (sessionStorage),
   sets no cookies and sends nothing at all to anyone who didn't arrive from an ad. */
(function () {
  var s = document.currentScript, base = s ? new URL(s.src).origin : '', KEY = 'isoteh_ref', ref = null;
  try { ref = new URLSearchParams(location.search).get(KEY); if (ref) sessionStorage.setItem(KEY, ref); else ref = sessionStorage.getItem(KEY); } catch (e) { /* private mode */ }
  var DIG = { JPY: 0, KRW: 0, XOF: 0, XAF: 0, RWF: 0, UGX: 0 };
  function send(event, o) {
    if (!ref || !/^[a-z][a-z0-9_]{1,31}$/.test(event)) return;
    o = o || {};
    var cur = String(o.currency || '').toUpperCase(), d = DIG[cur] === undefined ? 2 : DIG[cur];
    var body = JSON.stringify({ ref: ref, event: event, value: o.value ? Math.round(Number(o.value) * Math.pow(10, d)) : 0, currency: cur });
    try { if (navigator.sendBeacon && navigator.sendBeacon(base + '/t/e', body)) return; } catch (e) { /* fall through */ }
    fetch(base + '/t/e', { method: 'POST', body: body, keepalive: true, mode: 'no-cors' }).catch(function () {});
  }
  var queued = (window.isoteh && window.isoteh.q) || [];
  window.isoteh = function (event, o) { send(String(event || '').toLowerCase(), o); };
  if (new URLSearchParams(location.search).get(KEY)) send('page_view');
  for (var i = 0; i < queued.length; i++) window.isoteh.apply(null, queued[i]);
})();
