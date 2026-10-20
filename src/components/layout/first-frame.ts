/**
 * The public site's first script: both public root layouts print it as the
 * first child of <body>, so it runs before anything paints and a layout
 * that needs script is right in the first frame instead of moving after
 * hydration.
 *
 *   · `html.js` — script is on. The home page's county switch shows, and
 *     only one county column is shown under 1024px (mp.css, 07).
 *   · `data-county` — an address ending in #miami-dade or #broward picks
 *     that column before React does, so the browser's own jump to the
 *     anchor lands on a column that is there.
 *
 * Both are attributes of <html>, which carries `suppressHydrationWarning`
 * in both layouts. Keep it this small: it blocks the parser for as long as
 * it runs.
 */
export const FIRST_FRAME =
  "(function(d){d.classList.add('js');var h=location.hash.slice(1);if(h==='miami-dade'||h==='broward')d.setAttribute('data-county',h)})(document.documentElement)";
