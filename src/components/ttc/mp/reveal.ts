/**
 * Scroll reveal — the engine behind `Reveal`, the scroll-triggered
 * `RevealText`, `AnimatedLine` and the stagger lists (primitives.tsx).
 *
 * THE RULE: CONTENT IS VISIBLE UNLESS THIS FILE HAS JUST HIDDEN IT.
 *
 * The server HTML carries no hidden state at all. These blocks used to be
 * Motion components, and Motion serialises its `initial` state into the
 * markup: every animated element under the hero of the recertification page
 * (44 of them) shipped with an inline `opacity:0` or an off-screen transform
 * and stayed invisible until React hydrated — about 2.9 s on a slow
 * connection, a blank cream screen for anyone who scrolled sooner — and for
 * good when a script chunk failed to load, because <noscript> does not apply
 * to a browser that has scripts enabled and simply never received them.
 *
 * Now a block is hidden only by setting `data-rv="wait"` on it (mp.css holds
 * the two states, next to the `mp-enter` keyframes), and that attribute is
 * written in exactly one place: the observer callback below, the first time
 * the observer reports on that block, and only if the block is still BELOW
 * the screen. So:
 *
 *   • No JavaScript, a failed chunk, a slow hydration: nothing was ever
 *     hidden. The page reads as plain HTML and simply has no reveal.
 *   • No IntersectionObserver, or an environment where it never calls back:
 *     the same — the code that hides is the code that proves it can reveal.
 *   • On screen (or already scrolled past) when the observer first reports:
 *     left alone. A block someone is looking at never blinks out to fade in.
 *   • Reduced motion: never watched, and the CSS that would hide is inside
 *     `prefers-reduced-motion: no-preference` as well, for a preference
 *     switched on mid-visit.
 *
 * What a normal visitor sees is what Motion gave them: a block below the fold
 * waits out of sight and rises in once as it crosses the margin.
 *
 * The first classification comes from the observer's own initial entry, not
 * from getBoundingClientRect() in an effect: fifty of those at hydration are
 * fifty forced layouts, and the observer hands over every rectangle in one
 * batch for free.
 *
 * No React in this file. A component only registers its element here
 * (`useReveal` in primitives.tsx) and takes the cleanup back.
 */

export const RV_ATTR = 'data-rv';

/** The part of an element this file touches — a plain object in the tests. */
export type RevealTarget = Pick<Element, 'setAttribute' | 'removeAttribute'>;

export type RevealEntry = {
  target: RevealTarget;
  isIntersecting: boolean;
  boundingClientRect: { top: number };
  /** The viewport pulled in by the margin; null inside a cross-origin frame. */
  rootBounds: { bottom: number } | null;
};

type RevealObserver = {
  observe(el: RevealTarget): void;
  unobserve(el: RevealTarget): void;
};

export type RevealEnv = {
  /** Absent where the browser has no IntersectionObserver. */
  createObserver?: (
    onEntries: (entries: RevealEntry[]) => void,
    rootMargin: string,
  ) => RevealObserver;
  prefersReducedMotion: () => boolean;
  viewportHeight: () => number;
};

const NOOP = () => {};

export function createRevealer(env: RevealEnv) {
  // One observer per margin (the primitives use three: 40, 50 and 60px),
  // shared by every block that asks for it.
  const observers = new Map<number, RevealObserver>();
  // What is being watched. `armed` is true only while THIS code has the block
  // hidden; a block leaves the map the moment its fate is settled.
  const watching = new WeakMap<RevealTarget, { armed: boolean; margin: number }>();

  const settle = (el: RevealTarget) => {
    const w = watching.get(el);
    if (!w) return;
    watching.delete(el);
    observers.get(w.margin)?.unobserve(el);
  };

  const onEntries = (entries: RevealEntry[]) => {
    for (const entry of entries) {
      const el = entry.target;
      const w = watching.get(el);
      if (!w) continue;
      if (entry.isIntersecting) {
        // Hidden by us and now on screen: play. Never hidden: it was on
        // screen from the start, and stays as the server sent it.
        if (w.armed) el.setAttribute(RV_ATTR, 'in');
        settle(el);
      } else if (!w.armed) {
        // First report. The observer's root is the viewport pulled in by the
        // margin, so its bottom edge is `margin` short of the real one — and
        // a block whose top sits in that last strip is already showing.
        const bottom = entry.rootBounds
          ? entry.rootBounds.bottom + w.margin
          : env.viewportHeight();
        if (entry.boundingClientRect.top >= bottom) {
          w.armed = true;
          el.setAttribute(RV_ATTR, 'wait');
        } else {
          // Above the screen (a reload or a #hash mid-page), off to one side,
          // or display:none at this width: nothing to stage.
          settle(el);
        }
      }
      // Armed and still below: keep waiting.
    }
  };

  /**
   * Watch `el`; `margin` is how far inside the viewport's top or bottom edge
   * it must be before it counts as on screen. Returns the cleanup, which
   * also brings a still-hidden block back — after it, nothing is left that
   * could.
   *
   * The margin pulls in the top and bottom edges ONLY. Motion's
   * `margin: '-40px'` pulled in all four, and the page gutter is narrower
   * than 40px on every screen under ~890px wide (16–20px on a phone):
   * anything narrow sitting in it was "on screen" at no scroll position.
   * That is where the gold rule closing every page was parked, at zero
   * width — so on a phone it never drew.
   */
  return function watch(el: RevealTarget, margin: number): () => void {
    if (!env.createObserver || env.prefersReducedMotion()) return NOOP;
    let observer = observers.get(margin);
    if (!observer) {
      observer = env.createObserver(onEntries, `-${margin}px 0px`);
      observers.set(margin, observer);
    }
    watching.set(el, { armed: false, margin });
    observer.observe(el);
    return () => {
      const armed = watching.get(el)?.armed;
      settle(el);
      if (armed) el.removeAttribute(RV_ATTR);
    };
  };
}

let shared: ReturnType<typeof createRevealer> | undefined;

/** The browser's revealer, built on first use (never during server render). */
export function watchReveal(el: Element, margin: number): () => void {
  shared ??= createRevealer({
    createObserver:
      typeof IntersectionObserver === 'function'
        ? (onEntries, rootMargin) => new IntersectionObserver(onEntries, { rootMargin })
        : undefined,
    prefersReducedMotion: () =>
      window.matchMedia('(prefers-reduced-motion: reduce)').matches,
    viewportHeight: () => window.innerHeight,
  });
  return shared(el, margin);
}
