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
 */

export const HERO_RATE = 0.22;

/** Whole tenths of a pixel: sub-pixel writes buy nothing and cost a style. */
const tenth = (n: number) => Math.round(n * 10) / 10;

export function heroShift(scrollY: number): number {
  return tenth(Math.max(0, scrollY) * HERO_RATE);
}
