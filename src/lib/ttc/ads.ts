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
 * WHERE THE TAG RUNS — IN A FRAME OF ITS OWN, NOT IN THE PAGE. The script
 * does not add Google's tag to the page's document. It makes a hidden, empty
 * frame of this same site and loads the tag inside it. The page keeps only
 * `window.__ttcAds` and the click listener, and hands the frame one thing
 * per conversion: its label.
 *
 * The reason is the form. A Google Ads account can have "Enhanced
 * conversions" set to automatic — this one had it that way from the day it
 * was created — and then the tag searches the document it runs in for an
 * e-mail field and sends that address, hashed, with the conversion
 * (`em=tv.1~em.<SHA-256>` and `ec_mode=a` on the request).
 * `allow_enhanced_conversions: false`, below, does not stop that automatic
 * mode: on October 8, 2026, with the tag in the page, the live site sent the
 * hash of what was typed in the form's e-mail field, and measurement was
 * switched off the same hour. The frame's document has no form, no field and
 * no text, so there is nothing in it for the tag to find.
 *
 * The frame is same-origin on purpose: the tag still reads and writes this
 * site's `_gcl_` cookies and still sees the click identifier in the address,
 * which is what ties a conversion to an ad.
 *
 * WHAT THE TAG IS TOLD TO DO, AND NOT DO (adsBootScript):
 *   • three conversions and nothing else — no Google Analytics, and no
 *     remarketing ping on page load (`send_page_view: false`);
 *   • ad personalisation off (`allow_ad_personalization_signals: false`, and
 *     consent `ad_personalization: 'denied'`) and restricted data processing
 *     on, so Google does not add visitors to remarketing lists;
 *   • no enhanced conversions (`allow_enhanced_conversions: false`) — which
 *     turned out to refuse only the kind a site sends by hand; the automatic
 *     kind is kept out by the frame, above. The event is the label alone —
 *     not the name, e-mail, phone, message, files or reference of the
 *     request.
 * Google documents these controls at
 *   https://developers.google.com/tag-platform/security/guides/privacy
 *
 * WHAT IT WAS SEEN TO DO, in Chromium, on October 8, 2026, with the firm's
 * own conversion ID, the tag in its frame and "Enhanced conversions" still
 * on in the account (first watched on October 7, with a test ID and the tag
 * in the page):
 *   • on an ad landing: GET www.googletagmanager.com/gtag/js, then one
 *     POST www.google.com/ccm/collect ("page_view": the page's address, the
 *     click identifier, the tag's random number — and no title: the frame
 *     has none), one GET www.googleadservices.com/pagead/set_partitioned_cookie
 *     and one POST ad.doubleclick.net/ccm/s/collect;
 *   • moving between pages of the site: nothing;
 *   • on a later full load (cookie only): the script and the ccm/collect;
 *   • on each conversion: GET www.googleadservices.com/pagead/conversion/<id>/,
 *     www.googleadservices.com/ccm/conversion/<id>/ (a GET or a POST) and
 *     POST googleads.g.doubleclick.net/pagead/viewthroughconversion/<id>/ —
 *     with the label, the address of the page the visitor is on (the tag
 *     reads it from the window above its frame), the address the frame was
 *     made at (the page that was loaded in full), the click identifier, the
 *     random number, the screen size and the browser's client hints;
 *   • with the form filled in: the e-mail parameter empty (`em=tv.1`), and
 *     nothing typed into the form in any request — not in clear, not
 *     URL-encoded, not as a SHA-256.
 * The ccm/collect "page_view" on every full load is the tag's own doing and
 * no setting here stops it. The Privacy page says so.
 *
 * ONE THING IT WAS SEEN TO DO THAT IT NO LONGER CAN (October 10, 2026). A new
 * frame's document remembers the address of the page that made it, fragment
 * and all, as its `document.referrer` — and the tag sends that with every
 * conversion (`ref=`). A calculator keeps the visitor's case in the
 * fragment (`#b=…`, BeamCalculator.tsx; the Privacy page says that part of
 * an address is not sent), so a call reported from a calculator page carried
 * the beam to Google. `b()` now takes the fragment off the address for the
 * instant the frame is made and puts it back (try/finally): the frame has
 * never seen it. If the address cannot be changed, no frame is made — a
 * conversion goes unreported rather than the case be sent. The page loads'
 * own requests never carried it. GOOGLE-ADS/verificacion/hash-leak.mjs is the
 * check: run it with the gate whenever this file or a calculator's address
 * code changes.
 *
 * TWO THINGS THE CODE CANNOT GUARANTEE:
 *   • A Google Analytics destination added to this tag. That is set in the
 *     Google Ads account and reaches the tag from Google's side; it must
 *     stay OFF there, or the Privacy page stops being true while this file
 *     still looks right.
 *   • What Google's tag does inside its frame tomorrow. The frame is
 *     same-origin, so the browser does not forbid the tag from reaching the
 *     page above it — it already reads that window's address. What keeps
 *     the form out of its reach is that the tag looks for fields in its OWN
 *     document. That is how it behaves, not a rule it is bound by, so it is
 *     CHECKED and not assumed. Before measurement is switched on, and after
 *     any change to this file: open /contact with a click identifier in the
 *     address (?gclid=TEST), fill in the form without sending it, call
 *     `__ttcAds('form')`, and read every request to Google for the name,
 *     e-mail and phone that were typed — in clear, URL-encoded, and as
 *     SHA-256 in hex and in base64. None may be there, and `em` must be
 *     `tv.1`. Do it on an https address: on http://localhost the tag does
 *     no enhanced conversions at all (`em=tv.1~ec.e3`, in the page and in
 *     a frame alike), so a pass there proves nothing. "Enhanced conversions"
 *     should be switched off in the account as well; the frame is what
 *     keeps the page true while it is not.
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
 *   1. makes a hidden frame and, INSIDE IT, queues the settings and loads
 *      Google's tag — never in the page's own document, so the tag has no
 *      form to read (see "WHERE THE TAG RUNS", at the top);
 *   2. keeps `window.__ttcAds(kind)`, the one function that reports a
 *      conversion — the same kind is not reported twice within a second, so
 *      a double tap is one call, not two;
 *   3. listens, once and on the document, for a click on any phone or
 *      WhatsApp link: every such link on the site, the bar on phones
 *      included, with no change to the links themselves. Capture phase, so a
 *      handler that stops the event cannot hide it.
 * The form reports through the same function (reportConversion, below).
 *
 * The frame (`f` in the script; `b()` builds it, `x` is its window). It is
 * opened and closed —
 * `document.open()`, `close()` — before anything is put in it: that gives
 * it a document of its own carrying this page's address, the address the
 * tag reads the click identifier from, instead of the blank one a new frame
 * starts with, which not every browser keeps. Its window is read again
 * after that, because older browsers made a new one on `open()`. The queue
 * function stays in the page and pushes into the frame's `dataLayer`; no
 * script is written into the frame but Google's.
 *
 * It is made while the page's address has NO FRAGMENT (`h` is taken off and
 * put back around it, whatever happens in between): a frame remembers the
 * address it was made at, and what a calculator keeps after the `#` is not
 * for the tag — see "ONE THING IT WAS SEEN TO DO", at the top.
 *
 * It goes in <head>, where React leaves alone what it did not render — as
 * long as the page hydrates. When hydration fails at the root (a browser
 * extension rewrote the page first, say), React builds the document again
 * and keeps only scripts and styles in <head>: the frame goes, where the
 * tag's own <script>, in the old arrangement, stayed. That can happen before
 * the tag has run and written its click cookie, and a frame built later, on
 * another page of the site, would find neither the identifier in the
 * address nor the cookie. So the script watches <head> and builds the frame
 * again the moment it is taken out, while the address is still the one the
 * visitor arrived at — three times at most, so that something bent on
 * removing it cannot lock the page in a loop. A conversion that finds the
 * frame gone all the same builds it again before reporting. A frame built
 * again loads the tag again, and with it the page-load request of that one
 * page.
 *
 * ES5 and self-contained: it is not compiled, and it must never be the
 * reason a page breaks — hence the try/catch around the whole of it, and a
 * second one inside `__ttcAds`, which runs later, from a click.
 */
export function adsBootScript(cfg: AdsOn): string {
  const id = JSON.stringify(cfg.id);
  return [
    '(function(w,d){try{',
    'if(w.__ttcAds)return;',
    `if(!(${AD_CLICK_PARAM}.test(w.location.search)||${AD_CLICK_COOKIE}.test(d.cookie)))return;`,
    `var I=${id},L=${JSON.stringify(cfg.labels)},T={},f,x,R=0;`,
    // The queue is the FRAME's. Nothing of Google's is put on the page's window.
    'function g(){x.dataLayer.push(arguments)}',
    'function b(){',
    // The frame must never see the fragment: off before it is made, back after — or no frame.
    "var h=w.location.hash||'',p=w.location.pathname+w.location.search;",
    "if(h)w.history.replaceState(w.history.state,'',p);",
    'try{',
    "f=d.createElement('iframe');",
    "f.setAttribute('aria-hidden','true');f.tabIndex=-1;f.style.display='none';",
    'd.head.appendChild(f);',
    'var y=f.contentWindow.document;y.open();y.close();',
    "}finally{if(h)w.history.replaceState(w.history.state,'',p+h)}",
    'x=f.contentWindow;y=x.document;x.dataLayer=[];',
    "g('consent','default',{ad_personalization:'denied',analytics_storage:'denied'});",
    "g('set','allow_ad_personalization_signals',false);",
    "g('js',new Date());",
    "g('config',I,{send_page_view:false,allow_enhanced_conversions:false,restricted_data_processing:true});",
    "var s=y.createElement('script');s.async=true;",
    `s.src=${JSON.stringify(`${ADS_TAG_SRC}?id=`)}+I;`,
    '(y.head||y.documentElement).appendChild(s)}',
    'b();',
    'w.__ttcAds=function(k){try{var n=Date.now();',
    'if(!L[k]||n-(T[k]||0)<1000)return;',
    'T[k]=n;if(!f.parentNode)b();',
    "g('event','conversion',{send_to:I+'/'+L[k]})}catch(e){}};",
    "d.addEventListener('click',function(e){",
    "var a=e.target&&e.target.closest?e.target.closest('a[href]'):null;if(!a)return;",
    "var h=a.getAttribute('href')||'';",
    `if(${CALL_LINK}.test(h))w.__ttcAds('call');`,
    `else if(${WHATSAPP_LINK}.test(h))w.__ttcAds('whatsapp')},true);`,
    // The frame is put back as soon as it is taken out of <head>; R bounds it.
    'if(w.MutationObserver)new w.MutationObserver(function(){',
    'try{if(!f.parentNode&&R++<3)b()}catch(e){}}).observe(d.head,{childList:true});',
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
