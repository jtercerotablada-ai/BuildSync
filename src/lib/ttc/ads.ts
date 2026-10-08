/**
 * ─────────────────────────────────────────────────────────────────────────────
 * GOOGLE ADS CONVERSION MEASUREMENT — the one switch, for the PUBLIC site only
 * ─────────────────────────────────────────────────────────────────────────────
 * The firm runs Google Search ads and wants to know which ad produced a call,
 * a WhatsApp chat or a request sent through the form. Everything about that
 * lives in this file, and it is DORMANT until four variables are set:
 *
 *   NEXT_PUBLIC_GOOGLE_ADS_ID              AW-1234567890
 *   NEXT_PUBLIC_GOOGLE_ADS_LABEL_FORM      the label of the "form" conversion
 *   NEXT_PUBLIC_GOOGLE_ADS_LABEL_CALL      the label of the "call" conversion
 *   NEXT_PUBLIC_GOOGLE_ADS_LABEL_WHATSAPP  the label of the "WhatsApp" one
 *
 * They are read at BUILD time, so a change reaches the site with the next
 * deployment and not before. Two things make that true: each is spelled out
 * below as the literal `process.env.NAME` (the only form Next can inline),
 * and next.config.ts pins all four for every bundle of the build — browser,
 * server and proxy — an unset one as the empty string. Without the pin the
 * server would read an UNSET variable again at run time, and /contact, which
 * is rendered on demand, could disagree with the prerendered Privacy page.
 *
 * THIS FILE IS THE ONLY PLACE THAT READS THEM, and `ADS.on` is the one flag:
 *   • PublicShell prints the bootstrap script when it is true (AdsTag.tsx);
 *   • the Privacy page prints its "advertising" text when it is true
 *     (`legal.privacy` in site.ts and site.es.ts);
 *   • ContactForm reports a sent request through `reportConversion`, which
 *     does nothing unless that script decided to load Google's tag.
 * One flag, so the page that describes the measurement and the measurement
 * itself cannot disagree. It is ALL FOUR OR NOTHING: with a label missing,
 * the tag would be loaded for a conversion the site cannot report while the
 * Privacy page said it reports three, so anything short of four valid values
 * is off — and the build log says which one is wrong.
 *
 * WHO GETS THE TAG — AD CLICKS ONLY. Even when it is on, Google's tag is
 * loaded only for a visitor who arrived from one of the firm's Google ads:
 *   • the address this document was loaded at carries a click identifier
 *     Google adds to an ad's link (`gclid`, or `gbraid` / `wbraid` where a
 *     gclid cannot be used) — AD_CLICK_PARAM; or
 *   • the browser already holds a click cookie the tag wrote on such a visit
 *     (`_gcl_aw` for a gclid, `_gcl_ag` for a gbraid, `_gcl_gb` for a wbraid:
 *     watched in Chromium on October 7, 2026) — AD_CLICK_COOKIE.
 * A visitor from an ordinary search, a link or a typed address gets no
 * request to Google and no cookie: for them the site is what it was.
 *
 * The decision is taken ONCE PER DOCUMENT, by an inline script at the top of
 * the public shell, before React hydrates. That is what makes it hold across
 * the site's own navigation: moving from the landing page to /contact does
 * not reload the document, so the tag loaded on arrival is still there when
 * the form is sent; switching language or reloading IS a new document, with
 * no click identifier in its address, and the cookie answers for it. The
 * staff application is a different document too and never prints the script.
 *
 * WHAT THE TAG IS TOLD TO DO, AND NOT DO (adsBootScript):
 *   • three conversions and nothing else — no Google Analytics, and no
 *     remarketing ping on page load (`send_page_view: false`);
 *   • ad personalisation off (`allow_ad_personalization_signals: false`, and
 *     consent `ad_personalization: 'denied'`) and restricted data processing
 *     on, so Google does not add visitors to remarketing lists;
 *   • no enhanced conversions (`allow_enhanced_conversions: false`): the
 *     event is the label alone — not the name, e-mail, phone, message, files
 *     or reference of the request.
 * Google documents these controls at
 *   https://developers.google.com/tag-platform/security/guides/privacy
 *
 * WHAT IT WAS SEEN TO DO, in Chromium, with a test ID, on October 7, 2026:
 *   • on an ad landing: GET www.googletagmanager.com/gtag/js, then one
 *     POST www.google.com/ccm/collect ("page_view": the page's address and
 *     title, the click identifier, the tag's random number), one
 *     GET www.googleadservices.com/pagead/set_partitioned_cookie and one
 *     POST ad.doubleclick.net/ccm/s/collect;
 *   • moving between pages of the site: nothing;
 *   • on a later full load (cookie only): the script and the ccm/collect;
 *   • on each conversion: GET www.googleadservices.com/pagead/conversion/<id>/,
 *     POST googleads.g.doubleclick.net/pagead/viewthroughconversion/<id>/
 *     (a 302) and GET www.google.com/pagead/1p-conversion/<id>/ after it —
 *     with the label, the page's address and title, the click identifier, the
 *     random number, the screen size and the browser's client hints;
 *   • nothing typed into the form, in any of them.
 * The ccm/collect "page_view" on every full load is the tag's own doing and
 * no setting here stops it. The Privacy page says so.
 *
 * TWO THINGS THE CODE CANNOT GUARANTEE, because they are set in the Google
 * Ads account and reach the tag from Google's side: "Enhanced conversions"
 * (it reads the form's e-mail and phone fields) and a Google Analytics
 * destination added to this tag. Both must stay OFF there, or the Privacy
 * page stops being true while this file still looks right.
 *
 * WHAT IT STORES. Cookies under this site's address whose names begin with
 * `_gcl_` (`_gcl_au`, the click cookie, and `_gcl_gs` when the link carries
 * `gad_source`), one entry in local storage (`_gcl_ls`), and on a gclid
 * landing a cookie of Google's own (`GCL_AW_P`) on google.com,
 * googleadservices.com and doubleclick.net. All were written with a 90-day
 * expiry, which is also what Google publishes:
 *   https://business.safety.google/adscookies/
 *   https://policies.google.com/technologies/cookies  ("‘_gcl_’ cookies last
 *   for 90 days")
 * ADS_COOKIE_DAYS is that figure; the Privacy page prints it from here.
 * The tag writes its cookies for the registrable domain (seen as `.ttc.test`
 * on a test host name), so in production the browser also presents them to
 * the staff host. Nothing there reads them and nothing there loads the tag.
 *
 * CHANGE ANY OF THIS AND THE PRIVACY PAGE HAS TO FOLLOW, in the same commit:
 * a new conversion, a setting removed, Analytics added, personal data sent.
 */

export type AdsConversion = 'form' | 'call' | 'whatsapp';

export type AdsOn = {
  on: true;
  /** `AW-` and the account's conversion ID. */
  id: string;
  labels: Readonly<Record<AdsConversion, string>>;
};

export type AdsConfig = AdsOn | { on: false; why: string | null };

type AdsEnv = {
  id?: string;
  form?: string;
  call?: string;
  whatsapp?: string;
};

const ENV_NAME: Record<keyof AdsEnv, string> = {
  id: 'NEXT_PUBLIC_GOOGLE_ADS_ID',
  form: 'NEXT_PUBLIC_GOOGLE_ADS_LABEL_FORM',
  call: 'NEXT_PUBLIC_GOOGLE_ADS_LABEL_CALL',
  whatsapp: 'NEXT_PUBLIC_GOOGLE_ADS_LABEL_WHATSAPP',
};

/** A value as pasted into a dashboard: spaces and stray quotes removed. */
const clean = (value: string | undefined) => (value ?? '').trim().replace(/^["']+|["']+$/g, '').trim();

/**
 * The configuration, from the four values. Pure, so the rule is testable:
 * no ID → off and silent (the normal state); an ID with anything missing or
 * malformed → off, with the reason in `why`.
 *
 * Only an `AW-` ID is accepted. A `G-…` (Analytics) or `GTM-…` (Tag Manager)
 * ID would load something this site and its Privacy page do not describe.
 * A label may be pasted as Google shows it in `send_to` — `AW-123/AbCdEf` —
 * as long as the part before the slash is this same ID.
 */
export function readAds(env: AdsEnv): AdsConfig {
  const id = clean(env.id);
  if (!id) return { on: false, why: null };
  if (!/^AW-\d{6,}$/.test(id)) {
    return { on: false, why: `${ENV_NAME.id} must look like AW-1234567890` };
  }
  const labels = {} as Record<AdsConversion, string>;
  for (const kind of ['form', 'call', 'whatsapp'] as const) {
    let label = clean(env[kind]);
    if (label.startsWith(`${id}/`)) label = label.slice(id.length + 1);
    if (!/^[A-Za-z0-9_-]{4,64}$/.test(label)) {
      return {
        on: false,
        why: `${ENV_NAME[kind]} is ${label ? 'not a conversion label' : 'missing'}`,
      };
    }
    labels[kind] = label;
  }
  return { on: true, id, labels };
}

export const ADS: AdsConfig = readAds({
  id: process.env.NEXT_PUBLIC_GOOGLE_ADS_ID,
  form: process.env.NEXT_PUBLIC_GOOGLE_ADS_LABEL_FORM,
  call: process.env.NEXT_PUBLIC_GOOGLE_ADS_LABEL_CALL,
  whatsapp: process.env.NEXT_PUBLIC_GOOGLE_ADS_LABEL_WHATSAPP,
});

// An ID was set and the measurement is still off: say so where the person
// who set it will look, the build log. Server only — never in a browser.
if (!ADS.on && ADS.why && typeof window === 'undefined') {
  console.warn(`[ads] Google Ads measurement is OFF: ${ADS.why}. All four variables are needed.`);
}

/** How long the tag's cookies last, in days — Google's figure (see above). */
export const ADS_COOKIE_DAYS = 90;

/* ── The two decisions, as patterns ───────────────────────────────────────
   Patterns rather than functions on purpose: the bootstrap script below is
   text that runs before any bundle loads, and a RegExp prints itself exactly
   (`String(/a/)` is "/a/"), so the script and the functions tested here use
   the very same rule. */

/** A click identifier with a value, in a query string. */
export const AD_CLICK_PARAM = /[?&](?:gclid|gbraid|wbraid)=[^&#]/;
/** A click cookie the tag wrote, in `document.cookie`. Not `_gcl_au`: that
 *  one is a random number with no click behind it. */
export const AD_CLICK_COOKIE = /(?:^|;\s*)_gcl_(?:aw|gb|ag)=[^;]/;
/** A link that starts a phone call. */
export const CALL_LINK = /^tel:/i;
/** A link that opens a WhatsApp chat (the site links `api.whatsapp.com`;
 *  `wa.me` is the short form of the same thing). */
export const WHATSAPP_LINK = /^https?:\/\/(?:api\.whatsapp\.com|wa\.me)\//i;

/**
 * Did this visitor arrive from one of the firm's Google ads?
 * `search` is the query string the document was loaded with and `cookie` is
 * `document.cookie`.
 */
export function arrivedFromAd(search: string, cookie: string): boolean {
  return AD_CLICK_PARAM.test(search) || AD_CLICK_COOKIE.test(cookie);
}

/** Which conversion a click on a link with this `href` is, if any. */
export function linkConversion(href: string | null | undefined): Exclude<AdsConversion, 'form'> | null {
  const h = (href ?? '').trim();
  if (CALL_LINK.test(h)) return 'call';
  if (WHATSAPP_LINK.test(h)) return 'whatsapp';
  return null;
}

/** Where Google's tag is served from. */
export const ADS_TAG_SRC = 'https://www.googletagmanager.com/gtag/js';

/**
 * The inline script the public shell prints when measurement is on.
 *
 * It runs once per document and does nothing at all unless the visitor
 * arrived from an ad (see the top of this file). When they did, it
 *   1. queues the settings and loads Google's tag;
 *   2. keeps `window.__ttcAds(kind)`, the one function that reports a
 *      conversion — the same kind is not reported twice within a second, so
 *      a double tap is one call, not two;
 *   3. listens, once and on the document, for a click on any phone or
 *      WhatsApp link: every such link on the site, the bar on phones
 *      included, with no change to the links themselves. Capture phase, so a
 *      handler that stops the event cannot hide it.
 * The form reports through the same function (reportConversion, below).
 *
 * ES5 and self-contained: it is not compiled, and it must never be the
 * reason a page breaks — hence the try/catch around the whole of it.
 */
export function adsBootScript(cfg: AdsOn): string {
  const id = JSON.stringify(cfg.id);
  return [
    '(function(w,d){try{',
    'if(w.__ttcAds)return;',
    `if(!(${AD_CLICK_PARAM}.test(w.location.search)||${AD_CLICK_COOKIE}.test(d.cookie)))return;`,
    `var I=${id},L=${JSON.stringify(cfg.labels)},T={};`,
    'w.dataLayer=w.dataLayer||[];',
    'function g(){w.dataLayer.push(arguments)}',
    "g('consent','default',{ad_personalization:'denied',analytics_storage:'denied'});",
    "g('set','allow_ad_personalization_signals',false);",
    "g('js',new Date());",
    "g('config',I,{send_page_view:false,allow_enhanced_conversions:false,restricted_data_processing:true});",
    "var s=d.createElement('script');s.async=true;",
    `s.src=${JSON.stringify(`${ADS_TAG_SRC}?id=`)}+I;`,
    'd.head.appendChild(s);',
    'w.__ttcAds=function(k){var n=Date.now();',
    'if(!L[k]||n-(T[k]||0)<1000)return;',
    "T[k]=n;g('event','conversion',{send_to:I+'/'+L[k]})};",
    "d.addEventListener('click',function(e){",
    "var a=e.target&&e.target.closest?e.target.closest('a[href]'):null;if(!a)return;",
    "var h=a.getAttribute('href')||'';",
    `if(${CALL_LINK}.test(h))w.__ttcAds('call');`,
    `else if(${WHATSAPP_LINK}.test(h))w.__ttcAds('whatsapp')},true);`,
    '}catch(e){}})(window,document);',
  ].join('');
}

/**
 * Report a conversion from application code — today only the form, at the
 * moment it shows its success message.
 *
 * `window.__ttcAds` exists only when measurement is on AND the bootstrap
 * script found that this visitor came from an ad. For everyone else this is
 * a no-op: nothing is queued and nothing is sent. Never a reason for the
 * form to fail, hence the catch.
 */
export function reportConversion(kind: AdsConversion): void {
  if (typeof window === 'undefined') return;
  try {
    (window as Window & { __ttcAds?: (k: AdsConversion) => void }).__ttcAds?.(kind);
  } catch {
    /* measurement must never break the page */
  }
}
