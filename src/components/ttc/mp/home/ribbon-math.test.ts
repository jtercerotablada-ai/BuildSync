import { describe, expect, it } from 'vitest';
import {
  RIBBON,
  approach,
  initialRibbon,
  scrollBoost,
  stepRibbon,
  wrapOffset,
  type RibbonInput,
  type RibbonState,
} from './ribbon-math';

/**
 * The ribbon's arithmetic: which way each row runs, how fast, when it stops,
 * and where the loop closes. The island only measures and writes; every rule
 * of the motion is asserted here.
 */

const W = 1000;
const ROWS = [
  { base: RIBBON.baseA, width: W },
  { base: RIBBON.baseB, width: W },
];
const idle: RibbonInput = { scrollV: 0, hovered: [false, false], rows: ROWS };

/** Run `seconds` of frames at 60 fps with the same input. */
function run(state: RibbonState, input: RibbonInput, seconds: number, fps = 60): RibbonState {
  let s = state;
  const frames = Math.round(seconds * fps);
  for (let i = 0; i < frames; i++) s = stepRibbon(s, input, 1 / fps);
  return s;
}

describe('ribbon: the helpers', () => {
  it('boost is 1 at rest, 2 at 480 px/s, and never more than 10', () => {
    expect(scrollBoost(0)).toBe(1);
    expect(scrollBoost(480)).toBe(2);
    expect(scrollBoost(-480)).toBe(2);
    expect(scrollBoost(4320)).toBe(10);
    expect(scrollBoost(100000)).toBe(10);
  });

  it('wraps an offset into (−width, 0] and never returns −0', () => {
    expect(wrapOffset(0, W)).toBe(0);
    expect(wrapOffset(-W, W)).toBe(0);
    expect(Object.is(wrapOffset(-W, W), -0)).toBe(false);
    expect(wrapOffset(-250, W)).toBe(-250);
    expect(wrapOffset(250, W)).toBe(-750);
    expect(wrapOffset(-1250, W)).toBe(-250);
    expect(wrapOffset(3 * W + 40, W)).toBeCloseTo(-(W - 40), 9);
  });

  it('leaves a track alone while its list is unmeasured', () => {
    expect(wrapOffset(123, 0)).toBe(0);
    expect(wrapOffset(123, NaN)).toBe(0);
    expect(wrapOffset(NaN, W)).toBe(0);
  });

  it('approach covers the same share of the gap per second at any frame rate', () => {
    const slow = (() => {
      let v = 0;
      for (let i = 0; i < 30; i++) v = approach(v, 1, 4.5, 1 / 30);
      return v;
    })();
    const fast = (() => {
      let v = 0;
      for (let i = 0; i < 120; i++) v = approach(v, 1, 4.5, 1 / 120);
      return v;
    })();
    expect(slow).toBeCloseTo(fast, 9);
    expect(slow).toBeCloseTo(1 - Math.exp(-4.5), 9);
    expect(approach(0.3, 1, 5, 0)).toBe(0.3);
    expect(approach(0.3, 1, 5, -1)).toBe(0.3);
  });
});

describe('ribbon: base motion', () => {
  it('runs row A to the left and row B to the right, at the base speeds', () => {
    const s = run(initialRibbon(2), idle, 1);
    expect(s.rows[0].x).toBeCloseTo(-74, 4); // 74 px/s leftwards
    // Row B moves +46 px; the wrap brings it into (−W, 0]: same picture.
    expect(s.rows[1].x).toBeCloseTo(46 - W, 4);
  });

  it('keeps every offset inside (−width, 0] for ever', () => {
    let s = initialRibbon(2);
    for (let i = 0; i < 40; i++) {
      s = run(s, idle, 5);
      for (const row of s.rows) {
        expect(row.x).toBeLessThanOrEqual(0);
        expect(row.x).toBeGreaterThan(-W);
      }
    }
  });

  it('is the same picture after one lap', () => {
    // 1000 px at 74 px/s is 13.513… s: after that the offset is back at ~0.
    const lap = W / 74;
    const s = run(initialRibbon(2), idle, lap, 600);
    const phase = ((s.rows[0].x % W) + W) % W;
    expect(Math.min(phase, W - phase)).toBeLessThan(1);
  });

  it('does not move on a zero or negative frame, or without a measured list', () => {
    const s0 = initialRibbon(2);
    expect(stepRibbon(s0, idle, 0).rows[0].x).toBe(0);
    expect(stepRibbon(s0, idle, -3).rows[0].x).toBe(0);
    const unmeasured = { ...idle, rows: [{ base: -74, width: 0 }, { base: 46, width: 0 }] };
    expect(run(s0, unmeasured, 2).rows.map((r) => r.x)).toEqual([0, 0]);
  });

  it('treats a very long frame (a tab coming back) as 100 ms', () => {
    const a = stepRibbon(initialRibbon(2), idle, 30);
    const b = stepRibbon(initialRibbon(2), idle, 0.1);
    expect(a.rows[0].x).toBeCloseTo(b.rows[0].x, 9);
    expect(a.rows[0].x).toBeCloseTo(-7.4, 9);
  });

  it('does not change its input state', () => {
    const s0 = initialRibbon(2);
    const copy = JSON.stringify(s0);
    stepRibbon(s0, idle, 0.016);
    expect(JSON.stringify(s0)).toBe(copy);
  });
});

describe('ribbon: it follows the scroll', () => {
  it('reverses both rows when the page is scrolled up, through a stop', () => {
    let s = run(initialRibbon(2), idle, 1);
    expect(s.dir).toBeCloseTo(1, 6);
    const up: RibbonInput = { ...idle, scrollV: -300 };
    // Half a second of scrolling up: the direction has crossed zero.
    s = run(s, up, 0.5);
    expect(s.target).toBe(-1);
    expect(s.dir).toBeLessThan(0.2);
    // Two seconds on, the rows run the other way at (about) full speed.
    const before = run(s, up, 2);
    const after = run(before, up, 1);
    // Row A, which ran left, now runs right (x grows until it wraps).
    const dx = after.rows[0].x - before.rows[0].x;
    const moved = dx > 0 ? dx : dx + W;
    expect(moved).toBeGreaterThan(70 * scrollBoost(300) * 0.8);
    expect(after.dir).toBeCloseTo(-1, 2);
  });

  it('keeps the last direction when the scrolling stops', () => {
    const up: RibbonInput = { ...idle, scrollV: -600 };
    let s = run(initialRibbon(2), up, 2);
    s = run(s, idle, 3);
    expect(s.target).toBe(-1);
    expect(s.dir).toBeCloseTo(-1, 3);
    expect(s.speed).toBeLessThan(1);
  });

  it('ignores scrolling below the noise floor', () => {
    const jitter: RibbonInput = { ...idle, scrollV: -RIBBON.scrollEps };
    const s = run(initialRibbon(2), jitter, 1);
    expect(s.target).toBe(1);
    expect(s.dir).toBeCloseTo(1, 6);
  });

  it('speeds up with the page and tops out at ten times', () => {
    // A list wide enough that one second of even the fastest motion does not wrap.
    const wide: RibbonInput = { ...idle, rows: [{ base: RIBBON.baseA, width: 1e6 }, { base: RIBBON.baseB, width: 1e6 }] };
    const distance = (scrollV: number) => {
      const input = { ...wide, scrollV };
      const warm = run(initialRibbon(2), input, 3);
      return Math.abs(run(warm, input, 1).rows[0].x - warm.rows[0].x);
    };
    expect(distance(0)).toBeCloseTo(74, 3);
    // After three seconds the smoothed speed has settled on the page's.
    expect(distance(480)).toBeCloseTo(74 * 2, 0);
    expect(distance(1_000_000)).toBeCloseTo(74 * 10, 0);
  });

  it('survives a non-finite scroll speed', () => {
    const s = run(initialRibbon(2), { ...idle, scrollV: NaN }, 1);
    expect(s.rows[0].x).toBeCloseTo(-74, 3);
  });
});

describe('ribbon: the pointer', () => {
  it('brings a hovered row to rest and leaves the other one running', () => {
    const over: RibbonInput = { ...idle, hovered: [true, false] };
    let s = run(initialRibbon(2), over, 2);
    const still = s.rows[0].x;
    s = run(s, over, 1);
    // After 2 s at rate 6 the row is at 1 − e⁻¹² of rest: it hardly moves.
    expect(Math.abs(s.rows[0].x - still)).toBeLessThan(0.01);
    expect(s.rows[0].hold).toBeGreaterThan(0.999);
    // Row B kept going.
    expect(s.rows[1].hold).toBe(0);
    expect(s.rows[1].x).not.toBe(initialRibbon(2).rows[1].x);
  });

  it('lets the row go again when the pointer leaves', () => {
    const over: RibbonInput = { ...idle, hovered: [true, false] };
    let s = run(initialRibbon(2), over, 2);
    const stopped = s.rows[0].x;
    s = run(s, idle, 1);
    expect(s.rows[0].hold).toBeLessThan(0.01);
    expect(Math.abs(s.rows[0].x - stopped)).toBeGreaterThan(50);
  });
});
