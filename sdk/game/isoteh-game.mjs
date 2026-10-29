// Ads inside games, for any engine. Fetch an ad for a slot, draw its image on a surface in your world (a billboard, a
// car's livery, a shop sign, a loading screen), and tell this module each frame how well the player can see it.
//
// A view counts once, after one second in a row in which:
//   - at least half of the ad is inside the screen and not hidden behind something;
//   - the ad covers at least 1.5% of the screen;
//   - the player looks at it from within 55 degrees of straight on.
// These follow the common rules for in-game ads, so advertisers can trust the numbers. Nothing about the player is sent.

export const RULES = { minVisible: 0.5, minShare: 0.015, maxAngle: 55, seconds: 1 };

export class GameAd {
  constructor({ server, slot, keywords = '', fetchFn = globalThis.fetch.bind(globalThis) }) {
    this.server = server.replace(/\/$/, '');
    this.slot = slot; this.keywords = keywords; this.fetchFn = fetchFn;
    this.data = null; this.seenFor = 0; this.counted = false;
  }

  /** Ask for an ad. Resolves to the ad ({ image, width, height, sponsor, ... }), an "Advertise here" offer, or null. */
  async load() {
    try {
      const q = new URLSearchParams({ slot: this.slot, kw: this.keywords });
      const r = await this.fetchFn(`${this.server}/v1/ad?${q}`, { credentials: 'omit' });
      this.data = r.ok ? await r.json() : { ad: null };
    } catch { this.data = { ad: null }; }
    this.seenFor = 0; this.counted = false;
    return this.data.ad ?? (this.data.open ? { open: this.data.open } : null);
  }

  /**
   * Call every frame. visible: share of the ad on screen and unhidden (0..1); share: share of the screen the ad
   * covers (0..1); angle: degrees between the ad's face and the player's view. Returns true while it counts as seen.
   */
  frame(dt, { visible, share, angle = 0 }) {
    const ok = !!this.data?.ad && visible >= RULES.minVisible && share >= RULES.minShare && angle <= RULES.maxAngle
      && (typeof document === 'undefined' || document.visibilityState === 'visible');
    this.seenFor = ok ? this.seenFor + dt : 0;
    if (ok && !this.counted && this.seenFor >= RULES.seconds) {
      this.counted = true;
      this.fetchFn(this.data.view, { method: 'POST', keepalive: true, credentials: 'omit' }).catch(() => {});
    }
    return ok;
  }

  /** The player tapped or clicked the ad: open the advertiser's page (through the click counter). */
  open() {
    const url = this.data?.click ?? this.data?.open?.url;
    if (url && typeof window !== 'undefined') window.open(url, '_blank', 'noopener');
    return url ?? null;
  }
}
