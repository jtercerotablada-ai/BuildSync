import { cardAtLine, holdOver, readerScrolled, strayOf, type HoldClock } from './solution-state';

/**
 * WHERE THE READER IS ON A PAGE WHOSE HEIGHT CHANGES UNDER THEM - two small machines, with the page behind an `env` so that each can be run, step by step, without
 * a browser (stiffness-place.test.ts drives them with a page that grows).
 *
 *   Hold   A card the reader is taken to (Next, a link of the outline, the menu) or the card they were reading when Expand all or Collapse all was pressed
 *          STAYS WHERE IT WAS PUT until they move the page themselves. A far card is a room kept for its tables (an estimate of their height) until it is
 *          drawn, and the cards round it are drawn over the next fraction of a second, a few rows at a time: each changes the height of what is above the
 *          card, and a browser that is not asked scrolls the page by exactly nothing. So each frame the card is looked for, and the page is put back if it
 *          strayed, until the page has been quiet for a while (holdOver) or the reader takes over (a wheel, a finger, a key, the scrollbar: `release`).
 *
 *   Spy    The card at the top of the screen is the step the reader is at (the counter, Previous and Next, the outline's mark), by a line a little under the
 *          header. It follows the scroll only when the READER scrolled (a wheel, a finger, a key, the scrollbar a moment ago) and no hold is in force: the page
 *          put back by a hold, or moved by the browser, does not change the step the reader chose.
 */

/** Where a held card stands: px from the top of the screen, or 'margin' - its own scroll margin, where a card the reader is taken to is put. */
export type HoldAt = number | 'margin';

export interface HoldEnv {
  now(): number;
  /** Calls back on the next frame (before it is painted); returns a handle. */
  frame(call: () => void): number;
  cancel(handle: number): void;
  /** Where the card is now, px from the top of the screen; null when it is not on the page. */
  top(key: string): number | null;
  /** Where a card of this key should stand. */
  want(key: string, at: HoldAt): number;
  /** Scroll the page by this much, at once; how far it went (less than asked at the ends of the page). */
  scrollBy(dy: number): number;
  /** Whether cards are still waiting to be drawn (the page is not done changing). */
  waiting(): boolean;
}

interface Held extends HoldClock {
  key: string;
  at: HoldAt;
}

export class Hold {
  private held: Held | null = null;
  private handle = 0;

  constructor(private readonly env: HoldEnv) {}

  /** Whether a card is being held. */
  get active(): boolean {
    return this.held !== null;
  }

  /** The key of the card being held, if any. */
  get key(): string | null {
    return this.held?.key ?? null;
  }

  /** Hold a card where `at` says (replacing any hold before it); the page is put right at once if the card is on it, and each frame after that. */
  start(key: string, at: HoldAt): void {
    const now = this.env.now();
    this.held = { key, at, started: now, moved: now };
    this.align();
    if (!this.handle) this.handle = this.env.frame(this.tick);
  }

  /** The reader took over, or the card is gone: nothing is held. */
  release(): void {
    this.held = null;
    if (this.handle) this.env.cancel(this.handle);
    this.handle = 0;
  }

  /** Put the page right if the held card strayed; whether it had. Called each frame, and after every render that may have changed what is above the card. */
  align(): boolean {
    const h = this.held;
    if (!h) return false;
    const top = this.env.top(h.key);
    if (top === null) return false;
    const stray = strayOf(top, this.env.want(h.key, h.at));
    if (stray === 0) return false;
    // (a card that cannot come to its place - the end of the page is too near - is not put back for ever: only a page that really moved is not yet quiet)
    if (Math.abs(this.env.scrollBy(stray)) < 0.5) return false;
    h.moved = this.env.now();
    return true;
  }

  private tick = (): void => {
    this.handle = 0;
    const h = this.held;
    if (!h) return;
    this.align();
    if (holdOver(h, this.env.now(), this.env.waiting())) {
      this.held = null;
      return;
    }
    this.handle = this.env.frame(this.tick);
  };
}

export interface SpyEnv {
  now(): number;
  /** The cards' tops in the page's order, px from the top of the screen (null: not on the page), and the line the reader is read by. */
  tops(): (number | null)[];
  line(): number;
  later(call: () => void, ms: number): number;
  clear(handle: number): void;
  /** The reader is at this card (its index in the order of `tops`), or above the first (null). */
  at(index: number | null): void;
  /** A hold is in force: the page is being put right, not scrolled by the reader. */
  holding(): boolean;
}

/** The most often the card at the line is looked for while the reader scrolls. */
export const SPY_EVERY = 100;

export class Spy {
  private lastInput = -Infinity;
  private lastRun = -Infinity;
  private timer: number | null = null;

  constructor(private readonly env: SpyEnv) {}

  /** The reader used the wheel, a finger, a key or the scrollbar. */
  input(): void {
    this.lastInput = this.env.now();
  }

  /** A card was chosen (or a hold began): the scrolling that follows is not the reader's until they use the page again. */
  settle(): void {
    this.lastInput = -Infinity;
    this.stop();
  }

  /** The page scrolled. */
  scrolled(): void {
    if (this.env.holding() || !readerScrolled(this.env.now(), this.lastInput)) return;
    if (this.timer !== null) return;
    const wait = Math.max(0, SPY_EVERY - (this.env.now() - this.lastRun));
    this.timer = this.env.later(() => {
      this.timer = null;
      if (!this.env.holding()) this.run();
    }, wait);
  }

  /** Look now: which card is at the line. */
  run(): void {
    this.lastRun = this.env.now();
    this.env.at(cardAtLine(this.env.tops(), this.env.line()));
  }

  stop(): void {
    if (this.timer !== null) this.env.clear(this.timer);
    this.timer = null;
  }
}

/**
 * The page's smooth-scroll library (Lenis, on the public pages) may still be carrying the page to where a wheel sent it, a second after the wheel stopped: a card
 * chosen in that second is where the page is put, not where it was going. Stops the glide where the page is; nothing where there is no such library.
 */
export function stopGlide(): void {
  try {
    const lenis = (window as unknown as { __ttcLenis?: { scrollTo?: (y: number, o: { immediate: boolean; force: boolean }) => void } }).__ttcLenis;
    lenis?.scrollTo?.(window.scrollY, { immediate: true, force: true });
  } catch {
    /* no such library, or it cannot be asked: the page scrolls natively */
  }
}
