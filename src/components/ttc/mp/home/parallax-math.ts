/**
 * Parallax arithmetic (spec E14), pure. The island (`Parallax.tsx`) reads the
 * scroll position and the plate's rectangle and writes `translate3d` from
 * what comes back. Only vertical shifts, only a transform.
 *
 *   the hero film   moves down 0.22 × scrollY: slower than the page, so the
 *                   page seems to slide over a deeper picture. The film's box
 *                   is 12 % taller than the hero (home.css), and the part of
 *                   it that a downward shift uncovers is always above the
 *                   screen, so no edge shows.
 *   the pause photo moves ±9 % of its plate's height, from −9 % as the plate
 *                   enters at the foot of the screen to +9 % as it leaves at
 *                   the top, 0 when it is centred. Its frame is 18 % taller
 *                   than the plate (home-lower.css), centred, so the shift
 *                   never shows an edge either.
 */

export const HERO_RATE = 0.22;
export const PAUSE_SPAN = 0.09;

/** Whole tenths of a pixel: sub-pixel writes buy nothing and cost a style. */
const tenth = (n: number) => Math.round(n * 10) / 10;

export function heroShift(scrollY: number): number {
  return tenth(Math.max(0, scrollY) * HERO_RATE);
}

/** How far through its pass a plate is: 0 as its top meets the foot of the
 *  screen, 1 as its bottom leaves the top. */
export function passProgress(top: number, height: number, viewportHeight: number): number {
  const travel = viewportHeight + height;
  if (!(travel > 0)) return 0.5;
  return Math.min(Math.max((viewportHeight - top) / travel, 0), 1);
}

export function pauseShift(top: number, height: number, viewportHeight: number): number {
  const p = passProgress(top, height, viewportHeight);
  return tenth((p - 0.5) * 2 * PAUSE_SPAN * height);
}
