/**
 * The ribbon's arithmetic (spec E7). Pure: no DOM, no clock, no React. The
 * island (`RibbonRows.tsx`) feeds it a frame's `dt`, the page's scroll speed
 * and which rows the pointer is on, and writes the offsets it returns to the
 * tracks. Everything that could be wrong about the motion — which way a row
 * goes, how fast, when it comes to rest, where the loop closes — is here, so
 * `ribbon-math.test.ts` can pin it.
 *
 * THE MODEL. Each row is a track of two identical lists side by side, `width`
 * px each. The track is moved by `x`, kept in (−width, 0]: moving by exactly
 * one list is the same picture, so the wrap is invisible and the loop never
 * ends. A row has a signed base speed — row A runs left (negative), row B
 * right (positive) — and three things scale it:
 *
 *   direction   one number for the whole ribbon, +1 or −1, that FOLLOWS the
 *               page: scroll down and the rows run their way, scroll up and
 *               both reverse. It eases (4.5 per second) rather than flips, so
 *               a reversal slows to a stop and turns, as a belt would.
 *   boost       `1 + min(v / 480, 9)`: the faster the page is scrolled, the
 *               faster the type runs, up to ten times. `v` is the page's
 *               speed in px/s, smoothed over about 80 ms so a wheel's single
 *               notch does not make the ribbon jerk.
 *   hold        per row, 0 to 1: the pointer (or focus) on a row eases it to
 *               rest (6 per second) and letting go eases it back.
 */

export const RIBBON = {
  /** px/s: row A runs left, row B right. */
  baseA: -74,
  baseB: 46,
  /** s⁻¹: how fast the direction follows the scroll direction. */
  dirRate: 4.5,
  /** s⁻¹: how fast a row comes to rest under the pointer, and leaves it. */
  holdRate: 6,
  /** s⁻¹: smoothing of the measured scroll speed. */
  speedRate: 12,
  /** px/s of scrolling that doubles the speed. */
  boostDivisor: 480,
  /** The most the speed is multiplied by, beyond 1. */
  boostMax: 9,
  /** A frame longer than this (a background tab coming back) counts as this. */
  maxDt: 0.1,
  /** px/s below which the page counts as not scrolling (rounding noise). */
  scrollEps: 12,
} as const;

/** `current` moved toward `target` the way a spring-free ease does: the same
 *  fraction of the gap per second whatever the frame rate. */
export function approach(current: number, target: number, rate: number, dt: number): number {
  if (!(dt > 0)) return current;
  return current + (target - current) * (1 - Math.exp(-rate * dt));
}

/** The factor the type's speed is multiplied by for a page speed `v` (px/s,
 *  either sign): 1 at rest, 2 at 480, 10 from 4,320 up. */
export function scrollBoost(v: number): number {
  return 1 + Math.min(Math.abs(v) / RIBBON.boostDivisor, RIBBON.boostMax);
}

/** `x` brought into (−width, 0]. One list further along is the same picture,
 *  so this changes nothing the eye can see. A width that is not a positive
 *  number (the lists are not measured yet) leaves the track where it is. */
export function wrapOffset(x: number, width: number): number {
  if (!(width > 0) || !Number.isFinite(x)) return 0;
  const r = x - Math.ceil(x / width) * width;
  return r === 0 ? 0 : r; // never −0
}

export type RibbonRowState = { x: number; hold: number };

export type RibbonState = {
  /** The direction the page was last scrolled in: +1 down, −1 up. */
  target: 1 | -1;
  /** The eased direction, −1 to +1. */
  dir: number;
  /** The smoothed page speed, px/s, never negative. */
  speed: number;
  rows: RibbonRowState[];
};

export type RibbonInput = {
  /** The page's scroll velocity, px/s, positive when it moves down. */
  scrollV: number;
  /** Per row: is the pointer (or focus) on it? */
  hovered: readonly boolean[];
  /** Per row: its signed base speed and the width of ONE list. */
  rows: readonly { base: number; width: number }[];
};

export function initialRibbon(rows: number): RibbonState {
  return {
    target: 1,
    dir: 1,
    speed: 0,
    rows: Array.from({ length: rows }, () => ({ x: 0, hold: 0 })),
  };
}

/**
 * One frame. Returns a new state; `state` is not touched. `dtSeconds` is the
 * time since the last frame.
 */
export function stepRibbon(state: RibbonState, input: RibbonInput, dtSeconds: number): RibbonState {
  const dt = Math.min(Math.max(dtSeconds, 0), RIBBON.maxDt);
  const v = Number.isFinite(input.scrollV) ? input.scrollV : 0;

  const target: 1 | -1 = Math.abs(v) > RIBBON.scrollEps ? (v > 0 ? 1 : -1) : state.target;
  const dir = approach(state.dir, target, RIBBON.dirRate, dt);
  const speed = approach(state.speed, Math.abs(v), RIBBON.speedRate, dt);
  const boost = scrollBoost(speed);

  const rows = state.rows.map((row, i) => {
    const spec = input.rows[i];
    if (!spec) return row;
    const hold = approach(row.hold, input.hovered[i] ? 1 : 0, RIBBON.holdRate, dt);
    const velocity = spec.base * dir * boost * (1 - hold);
    return { hold, x: wrapOffset(row.x + velocity * dt, spec.width) };
  });

  return { target, dir, speed, rows };
}
