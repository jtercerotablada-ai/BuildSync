import { COST_PATH } from './cost-path';
import { GUIDES_PATH } from './guides';

/**
 * WHERE THE READER HOLDS A NOTICE — one rule for the three places that word
 * the way in: the phone bar (MobileActionBar), the Call / WhatsApp pair under
 * a page's button (ReachRow `plain`) and the closing band (ContactCTA
 * `notice`). Where it is true they say "Send the notice" and the WhatsApp
 * chat opens with "I received a building inspection notice"; everywhere else
 * they ask for a proposal, so no reader is told the way in is for somebody
 * else. Before this file the bar asked the service's track and the band was
 * told by each view, and the two disagreed on the pages below. A view may
 * still decide for itself (ServiceDetailView by site.ts `holdsNotice`, a
 * guide by its `heroAction`); notice-pages.test.ts keeps both equal to this.
 *
 * Notice pages: /existing-buildings, the cost page, the guides, the two
 * county programs and the milestone page — with the city pages under them.
 * The milestone page counts: its reader is usually holding the Building
 * Official's milestone notice ("within 14 days of receiving the notice"), and
 * the page is written to that letter.
 *
 * THE HOME PAGE IS NOT ONE. It was, while the home led with the recertification
 * notice; since October 24, 2026 it is a presentation of the firm (the owner:
 * no notice, no deadline, no proposal on the home), so it holds none. It is
 * not a "proposal" page either: the phone bar has a third wording there,
 * "Get in touch" to the contact block of the page, and a WhatsApp line that
 * names neither (MobileActionBar `home`, `reach.formHome`).
 *
 * Two existing-building pages are NOT, and are listed by name:
 *   - the guide "is my building due" opens with "No letter yet?" and its one
 *     button sends the address (its `heroAction: 'address'`;
 *     notice-pages.test.ts keeps the two lists equal);
 *   - the assessments page is for cracks, spalling, a report or a purchase —
 *     a buyer or a board with repairs, not a county letter.
 *
 * NO TEXT HERE: the phone bar is a client component, and the guides' and the
 * services' words stay on the server. Paths are canonical (English, no
 * language prefix); a trailing slash and the home page's "/" are allowed
 * (the home is `false`, as is anything else not listed).
 */

/** Guides whose reader has no letter yet (`heroAction: 'address'`). */
export const NO_NOTICE_GUIDES = ['is-my-building-due'] as const;

/** Services (and their city pages) whose reader holds a county notice. */
export const NOTICE_SERVICES = ['building-recertification', 'broward-bsip', 'milestone-inspections'] as const;

/** Existing-building services whose reader does not (see above). */
export const NO_NOTICE_SERVICES = ['structural-condition-assessments'] as const;

export function pageHoldsNotice(path: string): boolean {
  const p = path.replace(/\/+$/, '');
  const under = (base: string) => p === base || p.startsWith(`${base}/`);
  if (under('/existing-buildings') || p === COST_PATH) return true;
  if (under(GUIDES_PATH)) return !NO_NOTICE_GUIDES.some((g) => p === `${GUIDES_PATH}/${g}`);
  return NOTICE_SERVICES.some((s) => under(`/services/${s}`));
}
