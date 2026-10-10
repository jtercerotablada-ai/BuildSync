import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative, sep } from 'node:path';
import vm from 'node:vm';
import { describe, expect, it } from 'vitest';
import {
  ADS,
  ADS_COOKIE_DAYS,
  ADS_TAG_SRC,
  adsBootScript,
  arrivedFromAd,
  linkConversion,
  readAds,
  type AdsOn,
} from './ads';

/**
 * Google Ads conversion measurement: the parts that can be tested without a
 * browser — the switch, the two decisions (who gets Google's tag, which link
 * is which conversion) and the bootstrap script itself, run here against a
 * stand-in for `window` and `document`.
 *
 * What a real browser then does with Google's tag — the requests, the
 * cookies, and whether it can find the form — cannot be tested here; it was
 * watched in a browser and is written down in ads.ts and on the Privacy
 * page, with the check to repeat before measurement is switched on. The
 * pages themselves, in both states of the switch, are in
 * views/ads-pages.test.ts.
 */

const TEST: AdsOn = {
  on: true,
  id: 'AW-000000000',
  labels: { form: 'LABEL_FORM', call: 'LABEL_CALL', whatsapp: 'LABEL_WA' },
};
const ENV = { id: TEST.id, form: 'LABEL_FORM', call: 'LABEL_CALL', whatsapp: 'LABEL_WA' };

describe('the switch: four variables, all or nothing', () => {
  it('is off in this test run — vitest.config.ts blanks the variables', () => {
    expect(ADS).toEqual({ on: false, why: null });
  });

  it('no ID is off, and silent: that is the normal state', () => {
    expect(readAds({})).toEqual({ on: false, why: null });
    expect(readAds({ id: '   ' })).toEqual({ on: false, why: null });
    // Labels without an ID measure nothing and say nothing.
    expect(readAds({ form: 'a1b2c3', call: 'a1b2c3', whatsapp: 'a1b2c3' })).toEqual({ on: false, why: null });
  });

  it('an ID and its three labels is on', () => {
    expect(readAds(ENV)).toEqual(TEST);
  });

  it('accepts values as they are pasted: spaces, quotes, and a label written as send_to', () => {
    expect(
      readAds({
        id: ' "AW-000000000" ',
        form: 'AW-000000000/LABEL_FORM',
        call: " 'LABEL_CALL' ",
        whatsapp: 'LABEL_WA\n',
      }),
    ).toEqual(TEST);
  });

  it('an ID with a label missing or malformed is OFF, and says which', () => {
    for (const kind of ['form', 'call', 'whatsapp'] as const) {
      const missing = readAds({ ...ENV, [kind]: '' });
      expect(missing.on).toBe(false);
      expect(!missing.on && missing.why).toContain(`NEXT_PUBLIC_GOOGLE_ADS_LABEL_${kind.toUpperCase()}`);
      expect(readAds({ ...ENV, [kind]: 'not a label!' }).on).toBe(false);
      // The label of another account's conversion is not this ID's.
      expect(readAds({ ...ENV, [kind]: 'AW-111111111/LABEL' }).on).toBe(false);
    }
  });

  // Only a Google Ads ID. An Analytics or Tag Manager ID in this variable
  // would load a product the Privacy page does not describe.
  it('accepts only a Google Ads ID', () => {
    for (const id of ['G-ABC123DEF4', 'GTM-ABC123', 'UA-12345-1', '1234567890', 'AW-', 'AW-12ab', 'AW-000000000/x']) {
      const cfg = readAds({ ...ENV, id });
      expect(cfg.on, id).toBe(false);
      expect(!cfg.on && cfg.why, id).toContain('NEXT_PUBLIC_GOOGLE_ADS_ID');
    }
  });
});

describe('who gets the tag: a visitor who arrived from an ad', () => {
  it('a click identifier in the landing address', () => {
    expect(arrivedFromAd('?gclid=EAIaIQobChMI', '')).toBe(true);
    expect(arrivedFromAd('?gbraid=0AAAAAD', '')).toBe(true);
    expect(arrivedFromAd('?wbraid=CjgKEAjw', '')).toBe(true);
    expect(arrivedFromAd('?service=broward-bsip&gclid=abc', '')).toBe(true);
    expect(arrivedFromAd('?gad_source=1&gad_campaignid=9&gclid=abc', '')).toBe(true);
  });

  it('or a click cookie the tag wrote on such a visit', () => {
    expect(arrivedFromAd('', '_gcl_au=1.1.325261202.1791430796; _gcl_aw=GCL.1791430796.abc')).toBe(true);
    expect(arrivedFromAd('', '_gcl_aw=GCL.1791430796.abc')).toBe(true);
    expect(arrivedFromAd('', 'x=1; _gcl_ag=2.1.kabc$i1791431132')).toBe(true);
    expect(arrivedFromAd('', 'x=1;_gcl_gb=GCL.1791431159.abc')).toBe(true);
    expect(arrivedFromAd('?service=broward-bsip', 'a=b; _gcl_aw=GCL.1.abc; c=d')).toBe(true);
  });

  it('nobody else: an ordinary search, a link, a typed address', () => {
    expect(arrivedFromAd('', '')).toBe(false);
    expect(arrivedFromAd('?service=broward-bsip', '')).toBe(false);
    expect(arrivedFromAd('?utm_source=google&utm_medium=organic', '')).toBe(false);
    // Campaign parameters without a click identifier are not an ad click…
    expect(arrivedFromAd('?gad_source=1', '')).toBe(false);
    // …and neither is an empty one, or a parameter that only ends like one.
    expect(arrivedFromAd('?gclid=', '')).toBe(false);
    expect(arrivedFromAd('?gclid=&service=x', '')).toBe(false);
    expect(arrivedFromAd('?notgclid=abc', '')).toBe(false);
    expect(arrivedFromAd('?fbclid=abc&msclkid=def', '')).toBe(false);
    // The tag's random number alone has no click behind it; other cookies
    // (the staff application's session, say) are none of this.
    expect(arrivedFromAd('', '_gcl_au=1.1.325261202.1791430796')).toBe(false);
    expect(arrivedFromAd('', 'next-auth.session-token=abc; my_gcl_aw=1')).toBe(false);
    expect(arrivedFromAd('', '_gcl_aw=')).toBe(false);
  });
});

describe('which link is which conversion', () => {
  it('a phone link is a call', () => {
    expect(linkConversion('tel:+17722658506')).toBe('call');
    expect(linkConversion('TEL:7722658506')).toBe('call');
  });

  it('a WhatsApp link is a WhatsApp chat', () => {
    expect(linkConversion('https://api.whatsapp.com/send?phone=17722658506&text=Hello')).toBe('whatsapp');
    expect(linkConversion('https://wa.me/17722658506')).toBe('whatsapp');
  });

  it('nothing else is anything', () => {
    for (const href of [
      '/contact',
      '/es/contact?service=broward-bsip',
      'mailto:info@ttcivilstructural.com',
      'https://www.myfloridalicense.com/wl11.asp',
      'https://example.com/?next=https://api.whatsapp.com/send',
      'https://api.whatsapp.com.example.com/send',
      '#engineer',
      '',
      null,
      undefined,
    ]) {
      expect(linkConversion(href), String(href)).toBeNull();
    }
  });
});

/* ── the bootstrap script, as it is shipped ─────────────────────────────── */

type Link = { getAttribute: (name: string) => string | null };
type Tag = { src?: string; async?: boolean };
type FrameWindow = { dataLayer?: IArguments[]; document: unknown };
/** The frame the script makes for Google's tag: its own window and document. */
type Frame = {
  attrs: Record<string, string>;
  style: Record<string, string>;
  tabIndex?: number;
  /** Set when the frame is put in the page; a test clears it to take it out. */
  parentNode: unknown;
  setAttribute: (name: string, value: string) => void;
  /** As a browser gives it: no window until the frame is in a document. */
  readonly contentWindow: FrameWindow | null;
  /** The same window, for the tests to read whatever the frame's state. */
  win: FrameWindow;
  /** What was done to the frame's document, in order. */
  log: string[];
  /** What was added to the frame's <head>. */
  tags: Tag[];
};

/**
 * Run the script against a stand-in browser; return what it did.
 * `dead`: frames that never get a window (something neuters them).
 * `observer`: the stand-in window has a MutationObserver.
 */
function boot(search: string, cookie: string, cfg: AdsOn = TEST, env: { dead?: boolean; observer?: boolean; hash?: string; frozen?: boolean } = {}) {
  /** Everything added to the PAGE's own <head>. */
  const pageHead: unknown[] = [];
  /** The address being rewritten and the frame being made, in the order they happened. */
  const trail: string[] = [];
  const frames: Frame[] = [];
  const listeners: { type: string; fn: (e: unknown) => void; capture: unknown }[] = [];
  let clock = 1_000_000;
  const head = {
    appendChild: (el: unknown) => {
      pageHead.push(el);
      const frame = frames.find((f) => f === el);
      if (frame) {
        frame.parentNode = head;
        // What a new frame's document remembers as its referrer: the address at this moment.
        trail.push(`frame made at ${window.location.pathname}${window.location.search}${window.location.hash}`);
      }
      return el;
    },
  };
  const makeFrame = (): Frame => {
    const log: string[] = [];
    const tags: Tag[] = [];
    const win: FrameWindow = {
      document: {
        open: () => log.push('open'),
        close: () => log.push('close'),
        createElement: (tag: string) => {
          log.push(`create ${tag}`);
          return {} as Tag;
        },
        head: {
          appendChild: (el: Tag) => {
            // How much was already queued for the tag when it was added.
            log.push(`add tag, ${win.dataLayer?.length ?? 'no'} queued`);
            tags.push(el);
          },
        },
      },
    };
    const frame: Frame = {
      attrs: {},
      style: {},
      parentNode: null,
      setAttribute: (name, value) => {
        frame.attrs[name] = value;
      },
      log,
      tags,
      win,
      get contentWindow() {
        return env.dead || !frame.parentNode ? null : win;
      },
    };
    frames.push(frame);
    return frame;
  };
  const document = {
    cookie,
    createElement: (tag: string) => (tag === 'iframe' ? makeFrame() : ({} as Tag)),
    head,
    addEventListener: (type: string, fn: (e: unknown) => void, capture: unknown) =>
      listeners.push({ type, fn, capture }),
  };
  /** What the script asked to be told about, had the window an observer. */
  const observers: { fn: () => void; target: unknown; options: unknown }[] = [];
  class FakeObserver {
    constructor(private fn: () => void) {}
    observe(target: unknown, options: unknown) {
      observers.push({ fn: this.fn, target, options });
    }
  }
  const location = { pathname: '/resources/beam', search, hash: env.hash ?? '' };
  const history = {
    state: null,
    /** As a browser's: the address becomes `url`. `frozen`: a browser that refuses (Safari, after too many). */
    replaceState: (_state: unknown, _title: string, url: string) => {
      if (env.frozen) throw new Error('SecurityError');
      trail.push(`address ${url}`);
      const at = url.indexOf('#');
      location.hash = at < 0 ? '' : url.slice(at);
    },
  };
  const window: {
    location: typeof location;
    history: typeof history;
    dataLayer?: IArguments[];
    __ttcAds?: (kind: string) => void;
    MutationObserver?: typeof FakeObserver;
  } = env.observer ? { location, history, MutationObserver: FakeObserver } : { location, history };
  // `new Date()` for the tag's 'js' command, `Date.now()` for the script's
  // own clock — the second is the one the tests move.
  const FakeDate = Object.assign(function FakeDate() {}, { now: () => clock });
  const run = () => vm.runInNewContext(adsBootScript(cfg), { window, document, Date: FakeDate });
  run();
  /** Everything queued for Google's tag — in its frame, the latest one — as
   *  plain arrays of plain values. */
  const queue = (): unknown[][] =>
    (frames.at(-1)?.win.dataLayer ?? []).map((args) => JSON.parse(JSON.stringify(Array.from(args))));
  const events = () => queue().filter((q) => q[0] === 'event');
  const click = (href: string | null, inside = true) => {
    const link: Link = { getAttribute: (name) => (name === 'href' ? href : null) };
    for (const l of listeners.filter((x) => x.type === 'click')) {
      // The click lands on an element inside the link (the label's text, an
      // icon): `closest` is what finds the <a>.
      l.fn({ target: { closest: (sel: string) => (inside && sel === 'a[href]' && href !== null ? link : null) } });
    }
  };
  return {
    window,
    trail,
    head,
    pageHead,
    frames,
    observers,
    listeners,
    queue,
    events,
    click,
    run,
    tick: (ms: number) => {
      clock += ms;
    },
  };
}

describe('the bootstrap script', () => {
  it('does nothing at all for a visitor who did not come from an ad', () => {
    for (const [search, cookie] of [
      ['', ''],
      ['?service=broward-bsip', ''],
      ['?utm_source=newsletter', 'theme=light'],
      ['', '_gcl_au=1.1.1.1'],
    ]) {
      const b = boot(search, cookie);
      expect(b.pageHead).toEqual([]);
      expect(b.frames).toEqual([]);
      expect(b.listeners).toEqual([]);
      expect(b.window.dataLayer).toBeUndefined();
      expect(b.window.__ttcAds).toBeUndefined();
    }
  });

  it('loads Google’s tag, once, for one who did — by the address or by the cookie', () => {
    for (const [search, cookie] of [
      ['?gclid=TEST123', ''],
      ['?gbraid=TEST123', ''],
      ['?wbraid=TEST123', ''],
      ['', '_gcl_au=1.1.1.1; _gcl_aw=GCL.1.TEST123'],
      ['?service=broward-bsip', '_gcl_gb=GCL.1.TEST123'],
    ]) {
      const b = boot(search, cookie);
      expect(b.frames).toHaveLength(1);
      expect(b.frames[0].tags).toEqual([{ async: true, src: `${ADS_TAG_SRC}?id=AW-000000000` }]);
      expect(b.listeners.map((l) => [l.type, l.capture])).toEqual([['click', true]]);
      // Printed twice in one document (it is not, but nothing forbids it):
      // the second copy must not load the tag or listen again.
      b.run();
      expect(b.frames).toHaveLength(1);
      expect(b.frames[0].tags).toHaveLength(1);
      expect(b.listeners).toHaveLength(1);
    }
  });

  // The promise the Privacy page makes about the form rests on this. With
  // "Enhanced conversions" on in the Google Ads account, the tag reads the
  // e-mail field of the document it runs in (ads.ts, "WHERE THE TAG RUNS").
  // So it never runs in the page: the page's <head> is given one thing, the
  // frame, and the page's window is given no queue for the tag to read.
  it('loads it in a frame of its own — nothing of Google’s is added to the page’s document or window', () => {
    const b = boot('?gclid=TEST123', '');
    expect(b.pageHead).toEqual([b.frames[0]]);
    expect(b.window.dataLayer).toBeUndefined();
    // (`history` and `location` are the stand-in window's own.)
    expect(Object.keys(b.window).sort()).toEqual(['__ttcAds', 'history', 'location']);
    // The tag itself is added to the frame's document, not the page's.
    expect(b.frames[0].tags).toHaveLength(1);
    const script = adsBootScript(TEST);
    expect(script).not.toMatch(/w\.dataLayer|d\.createElement\('script'\)|d\.head\.appendChild\(s\)/);
    // After a click and a sent form, still nothing but the frame.
    b.click('tel:+17722658506');
    b.window.__ttcAds?.('form');
    expect(b.pageHead).toEqual([b.frames[0]]);
    expect(b.window.dataLayer).toBeUndefined();
  });

  it('the frame is nothing a visitor can see, reach or hear announced', () => {
    const frame = boot('?gclid=TEST123', '').frames[0];
    expect(frame.style).toEqual({ display: 'none' });
    expect(frame.attrs).toEqual({ 'aria-hidden': 'true' });
    expect(frame.tabIndex).toBe(-1);
    // No address of its own: nothing is fetched to make it.
    expect(Object.keys(frame.attrs)).not.toContain('src');
  });

  // Opened and closed before anything goes in (see adsBootScript): the tag is
  // added last, to a document that is the frame's for good, with the four
  // settings already waiting for it.
  it('opens and closes the frame’s document, queues the settings, then adds the tag', () => {
    const frame = boot('?gclid=TEST123', '').frames[0];
    expect(frame.log).toEqual(['open', 'close', 'create script', 'add tag, 4 queued']);
  });

  // A new frame remembers the address it was made at — fragment and all — as
  // its referrer, and the tag sends that with every conversion. A calculator
  // keeps the visitor's case after the #: the frame is made without it.
  describe('what is after the # of the address is not for the tag', () => {
    const BEAM = '#b=us;23.75;p0_r23.75;;12,8;;;p,s,29000,800,88.9,6.39';

    it('the frame is made while the address has no fragment, and the fragment is put back', () => {
      const b = boot('?gclid=TEST123', '', TEST, { hash: BEAM });
      expect(b.trail).toEqual(['address /resources/beam?gclid=TEST123', 'frame made at /resources/beam?gclid=TEST123', `address /resources/beam?gclid=TEST123${BEAM}`]);
      expect(b.window.location.hash).toBe(BEAM);
      // Opened and closed inside that same instant: `open()` gives the frame this page's address.
      expect(b.frames[0].log.slice(0, 2)).toEqual(['open', 'close']);
      expect(b.frames).toHaveLength(1);
    });

    it('an address with no fragment is left alone', () => {
      const b = boot('?gclid=TEST123', '');
      expect(b.trail).toEqual(['frame made at /resources/beam?gclid=TEST123']);
    });

    it('the fragment comes back even when the frame cannot be made', () => {
      const b = boot('?gclid=TEST123', '', TEST, { hash: BEAM, dead: true });
      expect(b.trail.at(-1)).toBe(`address /resources/beam?gclid=TEST123${BEAM}`);
      expect(b.window.location.hash).toBe(BEAM);
    });

    it('a frame built again later is made the same way, without the fragment of that moment', () => {
      const b = boot('?gclid=TEST123', '', TEST, { hash: BEAM });
      const later = '#b=us;31.5;p0_r31.5;;12,8;;;p,s,29000,800,88.9,6.39';
      b.window.location.hash = later;
      b.frames[0].parentNode = null;
      b.trail.length = 0;
      b.tick(5_000);
      b.window.__ttcAds?.('call');
      expect(b.frames).toHaveLength(2);
      expect(b.trail).toEqual(['address /resources/beam?gclid=TEST123', 'frame made at /resources/beam?gclid=TEST123', `address /resources/beam?gclid=TEST123${later}`]);
      expect(b.events()).toHaveLength(1);
    });

    it('if the address cannot be changed no frame is made: a conversion unreported, not a case sent', () => {
      const b = boot('?gclid=TEST123', '', TEST, { hash: BEAM, frozen: true });
      expect(b.frames).toEqual([]);
      expect(b.pageHead).toEqual([]);
      expect(b.window.__ttcAds).toBeUndefined();
      expect(b.window.location.hash).toBe(BEAM);
      // …and with no fragment such a browser is measured as before.
      expect(boot('?gclid=TEST123', '', TEST, { frozen: true }).frames).toHaveLength(1);
    });

    it('no frame is ever made at an address with a fragment, whatever the fragment', () => {
      for (const hash of ['#main', '#b=x', '#', '#a#b']) {
        const b = boot('?gclid=TEST123', '_gcl_aw=GCL.1.x', TEST, { hash: hash === '#' ? '' : hash });
        expect(b.trail.filter((t) => t.startsWith('frame made at ')).every((t) => !t.includes('#')), hash).toBe(true);
      }
    });
  });

  // React can rebuild <head> after an error and drop what it did not render.
  // A conversion that finds the frame gone builds it again first; the click
  // cookie the first frame wrote still ties it to its ad.
  it('builds the frame again if it was taken out of the page, and the conversion is not lost', () => {
    const b = boot('?gclid=TEST123', '');
    b.click('tel:+17722658506');
    expect(b.events()).toHaveLength(1);
    b.frames[0].parentNode = null;
    b.tick(5_000);
    b.window.__ttcAds?.('form');
    expect(b.frames).toHaveLength(2);
    expect(b.pageHead).toEqual([b.frames[0], b.frames[1]]);
    expect(b.frames[1].log).toEqual(['open', 'close', 'create script', 'add tag, 4 queued']);
    expect(b.queue().map((x) => x[0])).toEqual(['consent', 'set', 'js', 'config', 'event']);
    expect(b.events()).toEqual([['event', 'conversion', { send_to: 'AW-000000000/LABEL_FORM' }]]);
    // While it is in the page, it is left alone.
    b.tick(5_000);
    b.click('https://wa.me/17722658506');
    expect(b.frames).toHaveLength(2);
    expect(b.events()).toHaveLength(2);
  });

  it('a conversion that cannot be reported is dropped quietly — a click on “Call” still calls', () => {
    const b = boot('?gclid=TEST123', '');
    // The frame's window is gone but the frame still looks attached.
    b.frames[0].win.dataLayer = undefined;
    expect(() => b.click('tel:+17722658506')).not.toThrow();
    expect(() => b.window.__ttcAds?.('form')).not.toThrow();
  });

  // The one edit that must never pass: a way back into the page. A frame
  // that cannot be used (something neuters frames, `open()` throws) means no
  // measurement for that visitor — not the tag in the page's document, where
  // it would read the form.
  it('if the frame cannot be used, it gives up — it never falls back to the page', () => {
    const b = boot('?gclid=TEST123', '', TEST, { dead: true });
    expect(b.pageHead).toEqual([b.frames[0]]);
    expect(b.frames[0].tags).toEqual([]);
    expect(b.frames[0].win.dataLayer).toBeUndefined();
    expect(Object.keys(b.window).sort()).toEqual(['history', 'location']);
    expect(b.listeners).toEqual([]);
  });

  // React keeps only scripts and styles in <head> when it has to build the
  // document again after a failed hydration: the frame goes, and with it a
  // tag that may not have run yet (adsBootScript). The script watches <head>
  // and puts the frame back at once, while the address still carries the
  // click identifier.
  it('watches <head> and builds the frame again the moment it is taken out — three times at most', () => {
    const b = boot('?gclid=TEST123', '', TEST, { observer: true });
    expect(b.observers).toHaveLength(1);
    expect(b.observers[0].target).toBe(b.head);
    expect(b.observers[0].options).toEqual({ childList: true });
    // Any other change in <head> is none of its business.
    b.observers[0].fn();
    expect(b.frames).toHaveLength(1);
    for (const count of [2, 3, 4]) {
      b.frames.at(-1)!.parentNode = null;
      b.observers[0].fn();
      expect(b.frames).toHaveLength(count);
      expect(b.frames.at(-1)!.log).toEqual(['open', 'close', 'create script', 'add tag, 4 queued']);
      // Putting the new frame in <head> is itself a change there: no loop.
      b.observers[0].fn();
      expect(b.frames).toHaveLength(count);
    }
    // Something keeps removing it: stop, rather than lock the page in a loop.
    b.frames.at(-1)!.parentNode = null;
    b.observers[0].fn();
    b.observers[0].fn();
    expect(b.frames).toHaveLength(4);
    // A conversion still builds one for itself.
    b.window.__ttcAds?.('form');
    expect(b.frames).toHaveLength(5);
    expect(b.events()).toEqual([['event', 'conversion', { send_to: 'AW-000000000/LABEL_FORM' }]]);
  });

  it('a browser with no MutationObserver is not watched, and nothing else changes', () => {
    const b = boot('?gclid=TEST123', '');
    expect(b.observers).toEqual([]);
    expect(b.frames).toHaveLength(1);
    b.click('tel:+17722658506');
    expect(b.events()).toHaveLength(1);
  });

  // What the tag is told before it loads. Each line is a promise the Privacy
  // page makes: no remarketing ping, no personalised advertising, no
  // Analytics, and no enhanced conversions sent by hand — the account's
  // automatic kind is not stopped by a setting; the frame keeps it out
  // (the tests above, and ads.ts, "WHERE THE TAG RUNS").
  it('queues the settings before anything else, and no page view', () => {
    const q = boot('?gclid=TEST123', '').queue();
    expect(q.map((x) => x[0])).toEqual(['consent', 'set', 'js', 'config']);
    expect(q[0]).toEqual(['consent', 'default', { ad_personalization: 'denied', analytics_storage: 'denied' }]);
    expect(q[1]).toEqual(['set', 'allow_ad_personalization_signals', false]);
    expect(q[3]).toEqual([
      'config',
      'AW-000000000',
      { send_page_view: false, allow_enhanced_conversions: false, restricted_data_processing: true },
    ]);
    // One destination: the Google Ads ID. Nothing is configured for Analytics.
    expect(q.filter((x) => x[0] === 'config')).toHaveLength(1);
  });

  it('a click on a phone link is the call conversion; on a WhatsApp link, the WhatsApp one', () => {
    const b = boot('?gclid=TEST123', '');
    b.click('tel:+17722658506');
    expect(b.events()).toEqual([['event', 'conversion', { send_to: 'AW-000000000/LABEL_CALL' }]]);
    b.click('https://api.whatsapp.com/send?phone=17722658506&text=Hello');
    expect(b.events()[1]).toEqual(['event', 'conversion', { send_to: 'AW-000000000/LABEL_WA' }]);
    expect(b.events()).toHaveLength(2);
  });

  it('a click on anything else is not a conversion', () => {
    const b = boot('?gclid=TEST123', '');
    b.click('/contact');
    b.click('mailto:info@ttcivilstructural.com');
    b.click('https://www.broward.org/CodeAppeals');
    b.click('tel:+17722658506', false); // a click outside any link
    b.click(null);
    expect(b.events()).toEqual([]);
  });

  it('the form reports through the same function, with its own label', () => {
    const b = boot('', '_gcl_aw=GCL.1.TEST123');
    b.window.__ttcAds?.('form');
    expect(b.events()).toEqual([['event', 'conversion', { send_to: 'AW-000000000/LABEL_FORM' }]]);
    // A kind with no label is nothing.
    b.window.__ttcAds?.('newsletter');
    expect(b.events()).toHaveLength(1);
  });

  // One real action, one conversion: a double tap on "Call" is one call.
  it('does not report the same kind twice within a second; later, and another kind, it does', () => {
    const b = boot('?gclid=TEST123', '');
    b.click('tel:+17722658506');
    b.tick(300);
    b.click('tel:+17722658506');
    expect(b.events()).toHaveLength(1);
    b.click('https://wa.me/17722658506');
    expect(b.events()).toHaveLength(2);
    b.tick(5_000);
    b.click('tel:+17722658506');
    expect(b.events()).toHaveLength(3);
  });

  // The event is the label and nothing else — no name, e-mail, phone,
  // message, file or reference can ride along, because there is no
  // parameter for one.
  it('a conversion carries the label and nothing else', () => {
    const b = boot('?gclid=TEST123', '');
    b.click('tel:+17722658506');
    b.window.__ttcAds?.('form');
    for (const e of b.events()) {
      expect(e).toHaveLength(3);
      expect(Object.keys(e[2] as object)).toEqual(['send_to']);
    }
    const script = adsBootScript(TEST);
    expect(script).not.toMatch(/user_data|email|phone_number|enhanced_conversion_data|transaction_id|value:/);
  });

  it('never throws, whatever the page is like', () => {
    expect(() =>
      vm.runInNewContext(adsBootScript(TEST), {
        window: {},
        document: {},
      }),
    ).not.toThrow();
  });

  it('is plain text that cannot close its own <script> element', () => {
    const script = adsBootScript(TEST);
    expect(script).not.toMatch(/<\/script|<!--/i);
    expect(script).toContain(`"${TEST.id}"`);
    // The only address in it is Google's tag; the only product, Google Ads.
    expect(script.match(/https?:\/\/[^"'\\]+/g)).toEqual([`${ADS_TAG_SRC}?id=`]);
    expect(script).not.toMatch(/google-analytics|G-[A-Z0-9]{6,}|GTM-/);
  });
});

it('the cookie lifetime the Privacy page prints is Google’s figure', () => {
  // https://business.safety.google/adscookies/ — _gcl_au, _gcl_aw, _gcl_gb,
  // _gcl_ag, _gcl_gs and GCL_AW_P: 90 days. Move it only with that page.
  expect(ADS_COOKIE_DAYS).toBe(90);
});

/* ── where it is wired, and where it must never be ──────────────────────── */

const SRC = join(process.cwd(), 'src');
const files: string[] = [];
(function walk(dir: string) {
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    if (statSync(full).isDirectory()) walk(full);
    else if (/\.(ts|tsx)$/.test(name)) files.push(full);
  }
})(SRC);
const rel = (f: string) => relative(SRC, f).split(sep).join('/');
const sources = new Map(files.map((f) => [rel(f), readFileSync(f, 'utf8')]));
const notTests = [...sources].filter(([f]) => !/\.test\.tsx?$/.test(f));
/** Files whose code (tests aside) matches. */
const where = (re: RegExp) => notTests.filter(([, code]) => re.test(code)).map(([f]) => f).sort();

describe('one module, mounted by the public shell and by nothing else', () => {
  it('only ads.ts reads the variables', () => {
    expect(where(/NEXT_PUBLIC_GOOGLE_ADS/)).toEqual(['lib/ttc/ads.ts']);
  });

  // next.config.ts freezes the same four at build time, for every bundle
  // (see the comment there): a fifth variable read here and not pinned there
  // would be read again by the server at run time.
  it('next.config.ts pins every variable ads.ts reads, and no other', () => {
    const read = [...sources.get('lib/ttc/ads.ts')!.matchAll(/process\.env\.(NEXT_PUBLIC_GOOGLE_ADS_\w+)/g)].map((m) => m[1]);
    expect(read).toHaveLength(4);
    const config = readFileSync(join(process.cwd(), 'next.config.ts'), 'utf8');
    const pinned = [...config.matchAll(/"(NEXT_PUBLIC_GOOGLE_ADS_\w+)"/g)].map((m) => m[1]);
    expect(pinned.sort()).toEqual([...read].sort());
    expect(config).toMatch(/env: googleAdsEnv/);
  });

  it('ads.ts is imported by the shell’s tag, the form and the two content files — nothing else', () => {
    expect(where(/from ['"](?:@\/lib\/ttc\/ads|\.\/ads)['"]/)).toEqual([
      'components/ttc/mp/AdsTag.tsx',
      'components/ttc/mp/ContactForm.tsx',
      'components/ttc/mp/PublicShell.tsx',
      'lib/ttc/site.es.ts',
      'lib/ttc/site.ts',
    ]);
  });

  it('the tag is mounted by PublicShell only, and PublicShell by the two public layouts only', () => {
    expect(where(/from ['"][^'"]*\/AdsTag['"]/)).toEqual(['components/ttc/mp/PublicShell.tsx']);
    expect(where(/from ['"][^'"]*\/PublicShell['"]/)).toEqual([
      'app/(public)/(site)/layout.tsx',
      'app/(public-es)/(site)/layout.tsx',
    ]);
  });

  // The staff application, its shell and the three root layouts: no file
  // there names the module, the tag or any of Google's advertising hosts.
  it('nothing in the staff application, its shell or a root layout mentions any of it', () => {
    const staff = notTests.filter(
      ([f]) =>
        f.startsWith('app/(app)/') ||
        f.startsWith('components/layout/') ||
        f.startsWith('components/providers/') ||
        f === 'app/(public)/layout.tsx' ||
        f === 'app/(public-es)/layout.tsx',
    );
    expect(staff.length).toBeGreaterThan(50);
    for (const [f, code] of staff) {
      expect(code, f).not.toMatch(
        /ttc\/ads|AdsTag|__ttcAds|googletagmanager|google-analytics|doubleclick|googleadservices|gtag\(/,
      );
    }
  });

  // No other file loads anything from Google's tag hosts: the only code
  // that names one is ads.ts (the two content files name them in prose, on
  // the Privacy page).
  it('no other code names Google’s advertising hosts', () => {
    expect(where(/googletagmanager|google-analytics|doubleclick|googleadservices/)).toEqual([
      'lib/ttc/ads.ts',
      'lib/ttc/site.es.ts',
      'lib/ttc/site.ts',
    ]);
  });
});
