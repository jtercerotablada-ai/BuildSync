import { describe, expect, it } from 'vitest';
import { HERO_RATE, PAUSE_SPAN, heroShift, passProgress, pauseShift } from './parallax-math';

describe('parallax: the hero film', () => {
  it('sits still at the top and falls behind the page at 0.22 of its speed', () => {
    expect(heroShift(0)).toBe(0);
    expect(heroShift(500)).toBe(110);
    expect(HERO_RATE).toBe(0.22);
  });

  it('never moves up (an overscroll above the top)', () => {
    expect(heroShift(-80)).toBe(0);
  });
});

describe('parallax: the pause photograph', () => {
  const VH = 900;
  const H = 900;

  it('measures how far through its pass a plate is', () => {
    expect(passProgress(VH, H, VH)).toBe(0); // its top at the foot of the screen
    expect(passProgress(-H, H, VH)).toBe(1); // its bottom at the top
    expect(passProgress(0, H, VH)).toBe(0.5); // filling the screen
    expect(passProgress(5000, H, VH)).toBe(0);
    expect(passProgress(-5000, H, VH)).toBe(1);
    expect(passProgress(0, 0, 0)).toBe(0.5);
  });

  it('shifts −9 % as the plate arrives, 0 when it fills the screen, +9 % as it leaves', () => {
    expect(PAUSE_SPAN).toBe(0.09);
    expect(pauseShift(VH, H, VH)).toBe(-81);
    expect(pauseShift(0, H, VH)).toBe(0);
    expect(pauseShift(-H, H, VH)).toBe(81);
  });

  it('stays within ± 9 % of the plate however far off it is', () => {
    for (const top of [-10000, -900, -300, 0, 300, 900, 10000]) {
      expect(Math.abs(pauseShift(top, H, VH))).toBeLessThanOrEqual(0.09 * H + 0.05);
    }
  });

  it('moves down as the page moves up (slower than the page)', () => {
    expect(pauseShift(200, H, VH)).toBeLessThan(pauseShift(100, H, VH));
    expect(pauseShift(-200, H, VH)).toBeGreaterThan(pauseShift(-100, H, VH));
  });
});
