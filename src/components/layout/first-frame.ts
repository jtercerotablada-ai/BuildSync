/**
 * The public site's first script: both public root layouts print it as the
 * first child of <body>, so it runs before anything paints and a layout
 * that needs script is right in the first frame instead of moving after
 * hydration.
 *
 *   · `html.js` — script is on. The home page's ribbon and rail take their
 *     scripted forms (home.css, home-motion.css); without it they keep their
 *     CSS-only ones.
 *   · LEGACY ANCHORS — an address that ends in `#miami-dade` or `#broward`
 *     on the home page (`/` or `/es`) leaves for the county's own program
 *     page. Those anchors were the two county columns of the old home page,
 *     which was about recertification; they are in links already published
 *     (Google Ads final URLs, the Business Profile, directories, other
 *     sites) and the server never sees a hash, so this is the only place
 *     that can catch them. The home is now a presentation of the firm and
 *     has neither section. `location.replace`, not an assignment: the dead
 *     anchor does not stay in the history for the Back button to return to.
 *     The query string goes with the visitor (an ad's `gclid` and `utm_*`
 *     are still wanted on the page they land on). The Spanish home goes to
 *     the Spanish page.
 *
 * `data-county` is no longer written: the county switch it served is gone
 * from the home (mp.css still has its rules for the program cards that the
 * city and cost pages share, and they simply never match).
 *
 * The script is an expression: first-frame.test.ts runs it against a stand-in
 * for `document` and `location`. Keep it this small: it blocks the parser for
 * as long as it runs.
 */
export const FIRST_FRAME =
  "(function(d){d.classList.add('js');var l=location,h=l.hash.slice(1),p=l.pathname.replace(/\\/+$/,'');if((h==='miami-dade'||h==='broward')&&(p===''||p==='/es'))l.replace(p+'/services/'+(h==='broward'?'broward-bsip':'building-recertification')+l.search)})(document.documentElement)";
