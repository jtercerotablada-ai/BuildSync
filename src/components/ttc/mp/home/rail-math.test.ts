import { describe, expect, it } from 'vitest';
import {
  DRAG_THRESHOLD,
  atEnd,
  atStart,
  counterText,
  currentIndex,
  dragStarted,
  dragTarget,
  maxScroll,
  nextTarget,
  prevTarget,
  railProgress,
  snapPositions,
  type RailMetrics,
} from './rail-math';

/**
 * Six cards of 300 px with a 20 px gap and a 72 px gutter, in a 1000 px
 * window: the content is 72 + 6 × 300 + 5 × 20 + 72 = 2044 px wide, so the
 * rail scrolls 1044 px, and cards 4, 5 and 6 can never reach the left edge.
 */
const LEFTS = [72, 392, 712, 1032, 1352, 1672];
const SCROLL_WIDTH = 2044;
const CLIENT = 1000;

const at = (scrollLeft: number): RailMetrics => ({
  scrollLeft,
  clientWidth: CLIENT,
  scrollWidth: SCROLL_WIDTH,
  lefts: LEFTS,
});

describe('rail: positions', () => {
  it('measures what can be scrolled', () => {
    expect(maxScroll(at(0))).toBe(1044);
    expect(maxScroll({ clientWidth: 1000, scrollWidth: 800 })).toBe(0);
  });

  it('puts card i at the left edge at lefts[i] − gutter, never beyond the end', () => {
    expect(snapPositions(LEFTS, 1044)).toEqual([0, 320, 640, 960, 1044, 1044]);
    expect(snapPositions([], 100)).toEqual([]);
  });

  it('knows the two ends within a pixel or two', () => {
    expect(atStart(at(0))).toBe(true);
    expect(atStart(at(2))).toBe(true);
    expect(atStart(at(3))).toBe(false);
    expect(atEnd(at(1044))).toBe(true);
    expect(atEnd(at(1042))).toBe(true);
    expect(atEnd(at(1040))).toBe(false);
  });

  it('has both ends at once when nothing scrolls', () => {
    const still = { scrollLeft: 0, clientWidth: 1000, scrollWidth: 900, lefts: [72, 392] };
    expect(atStart(still)).toBe(true);
    expect(atEnd(still)).toBe(true);
  });
});

describe('rail: the buttons', () => {
  it('next goes one card further, step by step, then to the end', () => {
    expect(nextTarget(at(0))).toBe(320);
    expect(nextTarget(at(320))).toBe(640);
    expect(nextTarget(at(640))).toBe(960);
    expect(nextTarget(at(960))).toBe(1044);
    expect(nextTarget(at(1044))).toBe(1044);
  });

  it('next from between two cards goes to the one ahead', () => {
    expect(nextTarget(at(100))).toBe(320);
    expect(nextTarget(at(321))).toBe(640);
  });

  it('previous goes one card back, then to the start', () => {
    expect(prevTarget(at(1044))).toBe(960);
    expect(prevTarget(at(960))).toBe(640);
    expect(prevTarget(at(640))).toBe(320);
    expect(prevTarget(at(320))).toBe(0);
    expect(prevTarget(at(0))).toBe(0);
  });

  it('previous from between two cards goes to the one behind', () => {
    expect(prevTarget(at(500))).toBe(320);
    expect(prevTarget(at(10))).toBe(0);
  });

  it('does nothing on a rail that does not scroll', () => {
    const still = { scrollLeft: 0, clientWidth: 1000, scrollWidth: 900, lefts: [72, 392] };
    expect(nextTarget(still)).toBe(0);
    expect(prevTarget(still)).toBe(0);
  });
});

describe('rail: the counter and the bar', () => {
  it('counts the card nearest the left edge', () => {
    expect(currentIndex(at(0))).toBe(0);
    expect(currentIndex(at(150))).toBe(0);
    expect(currentIndex(at(200))).toBe(1);
    expect(currentIndex(at(640))).toBe(2);
    expect(currentIndex(at(900))).toBe(3);
  });

  it('says the last card once the end is reached', () => {
    expect(currentIndex(at(1044))).toBe(5);
    expect(currentIndex(at(1043))).toBe(5);
    expect(currentIndex(at(1000))).toBe(3);
  });

  it('writes the counter with two digits and clamps a bad index', () => {
    expect(counterText(0, 6)).toBe('01 / 06');
    expect(counterText(5, 6)).toBe('06 / 06');
    expect(counterText(9, 6)).toBe('06 / 06');
    expect(counterText(-2, 6)).toBe('01 / 06');
  });

  it('draws the visible part of the rail, starting where you are', () => {
    const start = railProgress(at(0));
    expect(start.start).toBe(0);
    expect(start.size).toBeCloseTo(1000 / 2044, 9);
    const end = railProgress(at(1044));
    expect(end.start + end.size).toBeCloseTo(1, 9);
    const mid = railProgress(at(522));
    expect(mid.start).toBeCloseTo(522 / 2044, 9);
  });

  it('fills the bar when there is nothing to scroll', () => {
    expect(railProgress({ scrollLeft: 0, clientWidth: 1000, scrollWidth: 900, lefts: [] })).toEqual({
      start: 0,
      size: 1,
    });
    expect(railProgress({ scrollLeft: 0, clientWidth: 0, scrollWidth: 0, lefts: [] })).toEqual({
      start: 0,
      size: 1,
    });
  });
});

describe('rail: dragging with a mouse', () => {
  it('is a click until the pointer has moved more than the threshold', () => {
    expect(DRAG_THRESHOLD).toBe(5);
    expect(dragStarted(0)).toBe(false);
    expect(dragStarted(5)).toBe(false);
    expect(dragStarted(-5)).toBe(false);
    expect(dragStarted(6)).toBe(true);
    expect(dragStarted(-6)).toBe(true);
  });

  it('moves the content with the pointer, and stops at both ends', () => {
    // Dragging left by 100 px scrolls 100 px further along.
    expect(dragTarget(300, 500, 400, 1044)).toBe(400);
    expect(dragTarget(300, 500, 600, 1044)).toBe(200);
    expect(dragTarget(300, 500, 5000, 1044)).toBe(0);
    expect(dragTarget(300, 500, -5000, 1044)).toBe(1044);
    expect(dragTarget(0, 0, 100, 0)).toBe(0);
  });
});
