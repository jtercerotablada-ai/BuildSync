/**
 * The slide-over stack's one piece of arithmetic (spec E15, QA finding A1).
 *
 * The stack pins the credentials plate and lets the snow plate ("where we
 * work") slide over it after a pause (home-motion.css §05: `.h-where` has a
 * `margin-top` of 40 % of a screen). Reached with Tab, the credentials plate's
 * two license links are always uncovered: the browser scrolls to a link that
 * is below the screen and stops with it just in view, inside the pause. Reached
 * with Shift+Tab from further down the page, the plate is ABOVE the screen
 * (the sticky plate has been released), the browser's scroll to the link
 * overshoots the pause, and the snow plate ends up lying over the very links
 * F.S. 489.119(5)(b) asks to be reachable (WCAG 2.4.7, 2.4.11).
 *
 * The cure is `StackFocus`: when the keyboard focus enters the credentials
 * plate and the snow plate's top is above the foot of the screen, scroll back
 * by the difference, so the snow plate's top is exactly at the foot of the
 * screen: the end of the pause, where the credentials plate is whole.
 */

/** The media query under which the stack is pinned. It is the one
 *  home-motion.css §05 uses (a test holds the two together). From 901 px, not
 *  900: the phone bar is shown at 900 px and below and would lie over a plate
 *  pinned at exactly 900. */
export const STACK_PINNED =
  '(min-width: 901px) and (min-height: 720px) and (prefers-reduced-motion: no-preference)';

/** How far to scroll (positive = down, negative = up) to put the pause back:
 *  0 unless the snow plate has already begun to rise over the screen. */
export function dwellDelta(whereTop: number, viewportHeight: number): number {
  return whereTop < viewportHeight - 0.5 ? whereTop - viewportHeight : 0;
}
