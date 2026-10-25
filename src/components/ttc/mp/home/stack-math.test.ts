import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { STACK_PINNED, dwellDelta } from './stack-math';

describe('stack: the pause before the snow plate rises', () => {
  it('does nothing while the snow plate is still below the screen', () => {
    expect(dwellDelta(900, 900)).toBe(0);
    expect(dwellDelta(1400, 900)).toBe(0);
    expect(dwellDelta(899.6, 900)).toBe(0);
  });

  it('scrolls back by exactly the distance the snow plate has risen', () => {
    // The snow plate's top is 828 px above the top of the window (QA: 1440 x 900,
    // after Shift+Tab): scroll up by its top plus a screen.
    expect(dwellDelta(-828, 900)).toBe(-1728);
    expect(dwellDelta(300, 900)).toBe(-600);
    expect(dwellDelta(0, 720)).toBe(-720);
  });
});

describe('stack: the island and the stylesheet agree on when the stack is pinned', () => {
  const css = readFileSync(join(process.cwd(), 'src/app/(public)/home-motion.css'), 'utf8');

  it('uses the same media query as the pinning rules', () => {
    // The stylesheet's rules (the pin, and the scroll-driven dimming inside
    // @supports): both carry exactly this condition.
    const count = css.split(`@media ${STACK_PINNED}`).length - 1;
    expect(count).toBe(2);
  });
});
