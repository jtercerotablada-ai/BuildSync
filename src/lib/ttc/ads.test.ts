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
 * cookies — cannot be tested here; it was watched once, with a test ID, and
 * is written down in ads.ts and on the Privacy page. The pages themselves,
 * in both states of the switch, are in views/ads-pages.test.ts.
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

/** Run the script against a stand-in browser; return what it did. */
function boot(search: string, cookie: string, cfg: AdsOn = TEST) {
  const appended: { src?: string; async?: boolean }[] = [];
  const listeners: { type: string; fn: (e: unknown) => void; capture: unknown }[] = [];
  let clock = 1_000_000;
  const document = {
    cookie,
    createElement: () => ({}) as { src?: string; async?: boolean },
    head: { appendChild: (el: { src?: string }) => appended.push(el) },
    addEventListener: (type: string, fn: (e: unknown) => void, capture: unknown) =>
      listeners.push({ type, fn, capture }),
  };
  const window: {
    location: { search: string };
    dataLayer?: IArguments[];
    __ttcAds?: (kind: string) => void;
  } = { location: { search } };
  // `new Date()` for the tag's 'js' command, `Date.now()` for the script's
  // own clock — the second is the one the tests move.
  const FakeDate = Object.assign(function FakeDate() {}, { now: () => clock });
  const run = () => vm.runInNewContext(adsBootScript(cfg), { window, document, Date: FakeDate });
  run();
  /** Everything queued for Google's tag, as plain arrays of plain values. */
  const queue = (): unknown[][] =>
    (window.dataLayer ?? []).map((args) => JSON.parse(JSON.stringify(Array.from(args))));
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
    appended,
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
      expect(b.appended).toEqual([]);
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
      expect(b.appended).toEqual([{ async: true, src: `${ADS_TAG_SRC}?id=AW-000000000` }]);
      expect(b.listeners.map((l) => [l.type, l.capture])).toEqual([['click', true]]);
      // Printed twice in one document (it is not, but nothing forbids it):
      // the second copy must not load the tag or listen again.
      b.run();
      expect(b.appended).toHaveLength(1);
      expect(b.listeners).toHaveLength(1);
    }
  });

  // What the tag is told before it loads. Each line is a promise the Privacy
  // page makes: no remarketing ping, no personalised advertising, no
  // enhanced conversions, no Analytics.
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
