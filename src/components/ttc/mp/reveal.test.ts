import { describe, expect, it } from 'vitest';
import {
  createRevealer,
  RV_ATTR,
  type RevealEntry,
  type RevealEnv,
  type RevealTarget,
} from './reveal';

/**
 * The scroll reveal's one promise: a block is hidden ONLY by the observer
 * callback, only while it is below the screen, and whatever hid it also
 * brings it back. These tests drive the engine with a hand-fed observer, so
 * each of the ways the promise could break has a name.
 */

const VIEWPORT = 800;

/** An element reduced to the attribute the engine writes. */
function block() {
  const attrs = new Map<string, string>();
  const el: RevealTarget = {
    setAttribute: (k, v) => void attrs.set(k, v),
    removeAttribute: (k) => void attrs.delete(k),
  };
  return { el, state: () => attrs.get(RV_ATTR) };
}

/** An IntersectionObserver that reports only when the test says so. */
function harness(over: Partial<RevealEnv> = {}) {
  const observers: {
    rootMargin: string;
    observed: Set<RevealTarget>;
    emit: (entries: RevealEntry[]) => void;
  }[] = [];
  const env: RevealEnv = {
    createObserver: (onEntries, rootMargin) => {
      const observed = new Set<RevealTarget>();
      observers.push({ rootMargin, observed, emit: onEntries });
      return {
        observe: (el) => void observed.add(el),
        unobserve: (el) => void observed.delete(el),
      };
    },
    prefersReducedMotion: () => false,
    viewportHeight: () => VIEWPORT,
    ...over,
  };
  return { watch: createRevealer(env), observers };
}

/** What the browser reports for a block whose top edge is at `top`. */
const entry = (
  target: RevealTarget,
  top: number,
  { margin = 40, height = 200 }: { margin?: number; height?: number } = {},
): RevealEntry => ({
  target,
  boundingClientRect: { top },
  rootBounds: { bottom: VIEWPORT - margin },
  isIntersecting: top < VIEWPORT - margin && top + height > margin,
});

describe('scroll reveal: what gets hidden', () => {
  it('hides nothing by itself — watching a block does not touch it', () => {
    const { watch, observers } = harness();
    const b = block();
    watch(b.el, 40);
    expect(b.state()).toBeUndefined();
    expect(observers[0].observed.has(b.el)).toBe(true);
  });

  it('parks a block that is below the screen, then plays it once on screen', () => {
    const { watch, observers } = harness();
    const b = block();
    watch(b.el, 40);
    const io = observers[0];

    io.emit([entry(b.el, 1600)]);
    expect(b.state()).toBe('wait');
    expect(io.observed.has(b.el)).toBe(true);

    io.emit([entry(b.el, 700)]);
    expect(b.state()).toBe('in');
    expect(io.observed.has(b.el)).toBe(false);
  });

  it('never hides a block that is on screen when the observer first reports', () => {
    const { watch, observers } = harness();
    const b = block();
    watch(b.el, 40);
    observers[0].emit([entry(b.el, 300)]);
    expect(b.state()).toBeUndefined();
    expect(observers[0].observed.has(b.el)).toBe(false);
  });

  it('never hides a block already scrolled past (reload or #hash mid-page)', () => {
    const { watch, observers } = harness();
    const b = block();
    watch(b.el, 40);
    observers[0].emit([entry(b.el, -900)]);
    expect(b.state()).toBeUndefined();
    expect(observers[0].observed.has(b.el)).toBe(false);
  });

  // The observer's root stops `margin` px short of the real bottom edge, so
  // a block whose top is in that strip is "not intersecting" yet showing.
  it('never hides a block peeking over the bottom edge, inside the margin', () => {
    const { watch, observers } = harness();
    const peeking = block();
    const justBelow = block();
    watch(peeking.el, 40);
    watch(justBelow.el, 40);
    observers[0].emit([entry(peeking.el, VIEWPORT - 10), entry(justBelow.el, VIEWPORT)]);
    expect(peeking.state()).toBeUndefined();
    expect(justBelow.state()).toBe('wait');
  });

  it('treats a display:none block (an all-zero rectangle) as nothing to stage', () => {
    const { watch, observers } = harness();
    const b = block();
    watch(b.el, 40);
    observers[0].emit([
      { target: b.el, isIntersecting: false, boundingClientRect: { top: 0 }, rootBounds: { bottom: 760 } },
    ]);
    expect(b.state()).toBeUndefined();
  });

  it('falls back to the window height where the observer gives no root bounds', () => {
    const { watch, observers } = harness();
    const below = block();
    const peeking = block();
    watch(below.el, 40);
    watch(peeking.el, 40);
    observers[0].emit([
      { target: below.el, isIntersecting: false, boundingClientRect: { top: 900 }, rootBounds: null },
      { target: peeking.el, isIntersecting: false, boundingClientRect: { top: 790 }, rootBounds: null },
    ]);
    expect(below.state()).toBe('wait');
    expect(peeking.state()).toBeUndefined();
  });

  it('keeps a parked block parked until it is actually on screen', () => {
    const { watch, observers } = harness();
    const b = block();
    watch(b.el, 40);
    observers[0].emit([entry(b.el, 2400)]);
    observers[0].emit([entry(b.el, 1200)]);
    expect(b.state()).toBe('wait');
    expect(observers[0].observed.has(b.el)).toBe(true);
  });
});

describe('scroll reveal: when it must stay out of the way', () => {
  it('reduced motion: nothing is watched and nothing is hidden', () => {
    const { watch, observers } = harness({ prefersReducedMotion: () => true });
    const b = block();
    const stop = watch(b.el, 40);
    expect(observers).toHaveLength(0);
    stop();
    expect(b.state()).toBeUndefined();
  });

  it('no IntersectionObserver: nothing is hidden', () => {
    const { watch } = harness({ createObserver: undefined });
    const b = block();
    watch(b.el, 40)();
    expect(b.state()).toBeUndefined();
  });

  it('an observer that never calls back hides nothing', () => {
    const { watch, observers } = harness();
    const blocks = [block(), block(), block()];
    blocks.forEach((b) => watch(b.el, 40));
    expect(observers[0].observed.size).toBe(3);
    expect(blocks.map((b) => b.state())).toEqual([undefined, undefined, undefined]);
  });
});

describe('scroll reveal: cleanup', () => {
  it('brings a still-parked block back, since nothing is left to reveal it', () => {
    const { watch, observers } = harness();
    const b = block();
    const stop = watch(b.el, 40);
    observers[0].emit([entry(b.el, 1600)]);
    expect(b.state()).toBe('wait');
    stop();
    expect(b.state()).toBeUndefined();
    expect(observers[0].observed.has(b.el)).toBe(false);
  });

  it('leaves a revealed block as it is', () => {
    const { watch, observers } = harness();
    const b = block();
    const stop = watch(b.el, 40);
    observers[0].emit([entry(b.el, 1600)]);
    observers[0].emit([entry(b.el, 500)]);
    stop();
    expect(b.state()).toBe('in');
  });

  it('ignores a late report for a block it no longer watches', () => {
    const { watch, observers } = harness();
    const b = block();
    watch(b.el, 40)();
    observers[0].emit([entry(b.el, 1600)]);
    expect(b.state()).toBeUndefined();
  });

  // React's StrictMode (and a remount) runs effect → cleanup → effect.
  it('can watch the same block again after a cleanup', () => {
    const { watch, observers } = harness();
    const b = block();
    watch(b.el, 40)();
    watch(b.el, 40);
    observers[0].emit([entry(b.el, 1600)]);
    expect(b.state()).toBe('wait');
    observers[0].emit([entry(b.el, 600)]);
    expect(b.state()).toBe('in');
  });
});

describe('scroll reveal: observers', () => {
  // Top and bottom only: the page gutter on a phone is narrower than the
  // margin, so a side inset would leave narrow blocks there never on screen.
  it('shares one observer per margin and pulls in the top and bottom edges by it', () => {
    const { watch, observers } = harness();
    const a = block();
    const b = block();
    const headline = block();
    watch(a.el, 40);
    watch(b.el, 40);
    watch(headline.el, 60);
    expect(observers.map((o) => o.rootMargin)).toEqual(['-40px 0px', '-60px 0px']);
    expect(observers[0].observed.size).toBe(2);
    expect(observers[1].observed.size).toBe(1);
  });

  it('measures the bottom edge with the margin of the block being judged', () => {
    const { watch, observers } = harness();
    const headline = block();
    watch(headline.el, 60);
    // 750 is inside the 60px strip the root leaves out: showing, not below.
    observers[0].emit([entry(headline.el, 750, { margin: 60 })]);
    expect(headline.state()).toBeUndefined();
  });
});
