import { describe, expect, it } from 'vitest';
import { HIDE_AFTER_PX, UP_EPSILON, reveal, startHide, stepHide, type HideState } from './header-hide';

/** Scroll through a list of positions, as the browser's scroll events do. */
function run(positions: number[], active = true, from: HideState = startHide(0)): HideState[] {
  const out: HideState[] = [];
  let s = from;
  for (const y of positions) {
    s = stepHide(s, y, active);
    out.push(s);
  }
  return out;
}

describe('the home header slides away on the way down (E17)', () => {
  it('stays after less than 120px of scrolling down', () => {
    const steps = run([20, 60, 100, HIDE_AFTER_PX - 1]);
    expect(steps.every((s) => !s.hidden)).toBe(true);
  });

  it('leaves once 120px have been travelled downward', () => {
    const steps = run([40, 80, HIDE_AFTER_PX]);
    expect(steps[1].hidden).toBe(false);
    expect(steps[2].hidden).toBe(true);
  });

  it('a single long jump (an anchor link) hides it too', () => {
    expect(run([2400])[0].hidden).toBe(true);
  });

  it('stays away while the visitor keeps going down', () => {
    const steps = run([200, 260, 330, 331, 900]);
    expect(steps.every((s) => s.hidden)).toBe(true);
  });

  it('comes back on ANY scroll up, however short', () => {
    const away = run([300])[0];
    expect(away.hidden).toBe(true);
    expect(stepHide(away, 300 - UP_EPSILON, true).hidden).toBe(false);
    expect(stepHide(away, 100, true).hidden).toBe(false);
  });

  it('a fraction of a pixel of jitter is not a scroll up', () => {
    const away = run([300])[0];
    expect(stepHide(away, 299.5, true).hidden).toBe(true);
    expect(stepHide(away, 300, true).hidden).toBe(true);
  });

  it('counts the distance since the last upward move, not from the top', () => {
    // down 100, up a little, down 100 more: never 120 in one run.
    const steps = run([100, 90, 190]);
    expect(steps.every((s) => !s.hidden)).toBe(true);
    // …but 120 after the flick does hide it.
    expect(run([100, 90, 210])[2].hidden).toBe(true);
  });

  it('is showing at the very top of the page, and when the page is pulled past it', () => {
    const away = run([500])[0];
    expect(stepHide(away, 0, true).hidden).toBe(false);
    expect(stepHide(away, -40, true).hidden).toBe(false);
  });

  it('after coming back it has to travel the full distance again', () => {
    const back = run([300, 280])[1];
    expect(back.hidden).toBe(false);
    expect(stepHide(back, 280 + HIDE_AFTER_PX - 1, true).hidden).toBe(false);
    expect(stepHide(back, 280 + HIDE_AFTER_PX, true).hidden).toBe(true);
  });
});

describe('where the rule does not apply', () => {
  it('never hides when it is not active (wider than 900px, reduced motion)', () => {
    const steps = run([50, 400, 4000], false);
    expect(steps.every((s) => !s.hidden)).toBe(true);
  });

  it('still follows the page, so the first step after it applies is measured from there', () => {
    const wide = run([4000], false)[0];
    expect(wide.y).toBe(4000);
    // narrowed again, 50px further down: not 4050px of travel.
    expect(stepHide(wide, 4050, true).hidden).toBe(false);
  });

  it('active again takes an already-hidden header back out when the rule turns off', () => {
    const away = run([500])[0];
    expect(stepHide(away, 520, false).hidden).toBe(false);
  });
});

describe('focus entering the header', () => {
  it('shows it, and counts from there', () => {
    const away = run([500])[0];
    const shown = reveal(away);
    expect(shown.hidden).toBe(false);
    expect(shown.y).toBe(500);
    expect(stepHide(shown, 500 + HIDE_AFTER_PX - 1, true).hidden).toBe(false);
  });
});
