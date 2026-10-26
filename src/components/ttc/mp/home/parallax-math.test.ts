import { describe, expect, it } from 'vitest';
import { HERO_RATE, heroShift } from './parallax-math';

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
