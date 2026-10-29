// Native ad cards for apps and chat (Jisst channels and feeds). The app draws the card in its own style; this module only
// fetches it and reports what happened. Rules the server also enforces: nothing in private chats (pass ctx: 'private'
// and you always get null), and the app must show the label it is given ("Sponsored").
//
//   const card = await getNativeAd({ server, slot, keywords: 'basketball, austin' });
//   if (card) { draw(card); /* after one second on screen: */ card.seen(); /* on tap: */ card.open(); }

export async function getNativeAd({ server, slot, keywords = '', ctx = 'public', fetchFn = globalThis.fetch } = {}) {
  if (ctx === 'private' || ctx === 'dm') return null;
  const q = new URLSearchParams({ slot, kw: keywords, ctx });
  let data;
  try {
    const r = await fetchFn(`${server.replace(/\/$/, '')}/v1/ad?${q}`, { credentials: 'omit' });
    if (!r.ok) return null;
    data = await r.json();
  } catch { return null; }
  if (!data.ad) return null;
  let counted = false;
  return {
    label: data.label,
    sponsor: data.ad.sponsor,
    title: data.ad.title,
    body: data.ad.body,
    cta: data.ad.cta || 'Learn more',
    image: data.ad.image,
    link: data.click,
    /** Call once the card has been at least half on screen for a second. */
    seen() { if (counted) return; counted = true; fetchFn(data.view, { method: 'POST', keepalive: true, credentials: 'omit' }).catch(() => {}); },
    /** Open the advertiser's page (through the click counter). */
    open() { if (typeof window !== 'undefined') window.open(data.click, '_blank', 'noopener'); return data.click; },
  };
}
