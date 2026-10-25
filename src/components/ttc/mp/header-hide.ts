/**
 * WHEN THE HOME'S HEADER SLIDES AWAY (E17 of the home specification), as pure
 * functions so the rule can be tested: SiteHeader only reads the scroll
 * position, asks this file, and writes one class.
 *
 * On a phone the home is a very long page, and a black bar that stays over
 * the photographs takes a tenth of a small screen. So, on the home alone and
 * at 900px and below:
 *
 *   · after HIDE_AFTER_PX of scrolling DOWN the header slides up and out;
 *   · ANY scroll up brings it back, and so does the top of the page;
 *   · it comes back when the menu opens (SiteHeader stops asking while the
 *     menu is open) and when focus enters it (`reveal`: a keyboard user who
 *     Tabs into a header that is off screen must see where the focus is);
 *   · under "reduce motion" it never hides.
 *
 * "Scrolling down" is the distance travelled downward since the last upward
 * move, not the distance from the top: a visitor who reads down a screen,
 * flicks back up a little and goes on down has a header that never leaves
 * until they have really moved on.
 */

/** How far down, in CSS pixels, before the header leaves. */
export const HIDE_AFTER_PX = 120;

/** An upward step smaller than this is the scroll position jittering (a
 *  fractional position on a high-density screen), not a scroll up. */
export const UP_EPSILON = 1;

export interface HideState {
  /** The scroll position at the last step. */
  y: number;
  /** The header is off screen. */
  hidden: boolean;
  /** Distance travelled downward since the last upward move. */
  down: number;
}

/** The state when watching begins: header showing, nothing travelled. */
export function startHide(y: number): HideState {
  return { y, hidden: false, down: 0 };
}

/**
 * One scroll event. `active` is false when the rule does not apply right now
 * (wider than 900px, reduced motion): the header is then always showing, and
 * the position is still followed so that the first step after the rule
 * applies again is measured from where the page is, not from where it was.
 */
export function stepHide(state: HideState, y: number, active: boolean): HideState {
  if (!active || y <= 0) return startHide(y);
  const dy = y - state.y;
  if (dy <= -UP_EPSILON) return startHide(y);
  if (dy <= 0) return { ...state, y };
  const down = state.down + dy;
  return { y, hidden: state.hidden || down >= HIDE_AFTER_PX, down };
}

/** Focus entered the header: show it, and count from here. */
export function reveal(state: HideState): HideState {
  return startHide(state.y);
}
