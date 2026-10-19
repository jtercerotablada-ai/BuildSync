import { describe, expect, it } from 'vitest';
import { Hold, Spy, type HoldEnv, type SpyEnv } from './reader-place';
import { HOLD_MAX, HOLD_MIN, HOLD_QUIET, LINE_BELOW_MARGIN, READING_WINDOW, cardAtLine, holdOver, keyMoves, readerScrolled, strayOf } from './solution-state';

/**
 * WHERE THE READER IS, run without a browser: a page of cards whose heights change under the reader (a far card is a room kept for its tables, an estimate, and
 * the tables of the cards round a card the reader is taken to are drawn a moment after the jump), a clock that is moved by hand, and the frames the browser
 * would run. The page does what a browser does with a programmatic jump: it scrolls by exactly what it is told and by nothing when the content above changes.
 */

/** A page: cards one under the other from `base`, each with a height; the screen is `view` tall and the page scrolls by `scrollY`. */
class Page {
  heights: number[];
  scrollY = 0;
  scrolls = 0;
  constructor(heights: number[], readonly base = 400, readonly view = 800, readonly tail = 600) {
    this.heights = [...heights];
  }
  get total(): number {
    return this.base + this.heights.reduce((a, b) => a + b, 0) + this.tail;
  }
  /** px from the top of the screen. */
  top(k: number): number {
    return this.base + this.heights.slice(0, k).reduce((a, b) => a + b, 0) - this.scrollY;
  }
  /** Scrolls by what the page allows; returns how far it went. */
  scrollBy(dy: number): number {
    const before = this.scrollY;
    this.scrollY = Math.max(0, Math.min(this.total - this.view, this.scrollY + dy));
    this.scrolls++;
    return this.scrollY - before;
  }
  /** The tables of cards a..b are drawn: each is `by` taller. */
  draw(a: number, b: number, by: number): void {
    for (let k = a; k <= b; k++) this.heights[k] += by;
  }
}

/** A clock and the frames a browser runs, by hand. */
class Frames {
  now = 0;
  private queue: { id: number; call: () => void }[] = [];
  private next = 1;
  frame = (call: () => void): number => {
    const id = this.next++;
    this.queue.push({ id, call });
    return id;
  };
  cancel = (id: number): void => {
    this.queue = this.queue.filter((q) => q.id !== id);
  };
  /** Run the frames up to `ms` later, 16 ms apart: `during(t)` is called just before each frame (the page changing under the reader), `after(t)` once the frame has run, as the browser is about to paint. */
  run(ms: number, during?: (t: number) => void, after?: (t: number) => void): void {
    const end = this.now + ms;
    while (this.now < end) {
      this.now += 16;
      during?.(this.now);
      const due = this.queue;
      this.queue = [];
      for (const q of due) q.call();
      after?.(this.now);
    }
  }
  get pending(): number {
    return this.queue.length;
  }
}

const KEYS = Array.from({ length: 40 }, (_, k) => `c${k}`);
const MARGIN = 96;

function holdOn(page: Page, clock: Frames, waiting: () => boolean = () => false): { hold: Hold; moves: number[] } {
  const moves: number[] = [];
  const env: HoldEnv = {
    now: () => clock.now,
    frame: clock.frame,
    cancel: clock.cancel,
    top: (key) => {
      const k = KEYS.indexOf(key);
      return k < 0 ? null : page.top(k);
    },
    want: (_, at) => (at === 'margin' ? MARGIN : at),
    scrollBy: (dy) => {
      moves.push(dy);
      return page.scrollBy(dy);
    },
    waiting,
  };
  return { hold: new Hold(env), moves };
}

describe('the rule a hold goes by', () => {
  it('measures how far a card strayed, and calls anything within a pixel where it should be', () => {
    expect(strayOf(96, 96)).toBe(0);
    expect(strayOf(96.9, 96)).toBe(0);
    expect(strayOf(97.5, 96)).toBeCloseTo(1.5);
    expect(strayOf(-300, 96)).toBe(-396);
    expect(strayOf(1400, 96)).toBe(1304);
  });

  it('is over when it has been quiet for long enough, never before its minimum, never while a draw is waiting, and always at its longest', () => {
    const clock = { started: 1000, moved: 1000 };
    expect(holdOver(clock, 1000 + HOLD_MIN - 1, false)).toBe(false);
    // quiet, but not for HOLD_QUIET: the card strayed at 1000, and 700 ms of quiet is 1700
    expect(holdOver(clock, 1000 + HOLD_QUIET - 1, false)).toBe(false);
    expect(holdOver(clock, 1000 + HOLD_QUIET, false)).toBe(true);
    // a card that was put back lately keeps the hold going, however long since it began
    expect(holdOver({ started: 1000, moved: 3000 }, 3000 + HOLD_QUIET - 1, false)).toBe(false);
    expect(holdOver({ started: 1000, moved: 3000 }, 3000 + HOLD_QUIET, false)).toBe(true);
    // a draw that is waiting keeps it going
    expect(holdOver(clock, 1000 + 5000, true)).toBe(false);
    // …but not for ever
    expect(holdOver({ started: 1000, moved: 1000 + HOLD_MAX }, 1000 + HOLD_MAX, true)).toBe(true);
  });

  it('counts a bare modifier key as no scrolling, and every other key as the reader’s', () => {
    for (const k of ['Shift', 'Control', 'Alt', 'Meta', 'CapsLock']) expect(keyMoves(k), k).toBe(false);
    for (const k of ['ArrowDown', 'PageDown', 'Home', 'End', ' ', 'Tab', 'Enter', 'n']) expect(keyMoves(k), k).toBe(true);
  });

  it('calls a scroll the reader’s for a few seconds after they used the wheel, a finger, a key or the scrollbar, and no longer', () => {
    expect(readerScrolled(1000, 1000)).toBe(true);
    expect(readerScrolled(1000 + READING_WINDOW, 1000)).toBe(true);
    expect(readerScrolled(1000 + READING_WINDOW + 1, 1000)).toBe(false);
    expect(readerScrolled(500, -Infinity)).toBe(false);
  });
});

describe('a card the reader was taken to stays where it was put while the cards round it are drawn', () => {
  it('puts a card at its place at once, and again each frame as the tables above it are drawn and move it: never off its place when a frame is painted', () => {
    const page = new Page(KEYS.map(() => 300));
    const clock = new Frames();
    const { hold } = holdOn(page, clock);
    hold.start('c30', 'margin');
    expect(page.top(30)).toBe(MARGIN);
    // The cards above the target come into range and are drawn, over the next frames, each taller than the room kept for it: the target would be pushed down by thousands of pixels.
    const away: number[] = [];
    clock.run(
      800,
      (t) => {
        if (t === 64) page.draw(24, 29, 350);
        if (t === 160) page.draw(18, 23, -200);
        if (t === 240) page.draw(31, 35, 500);
        if (t === 320) page.draw(0, 17, 90);
      },
      () => away.push(Math.abs(page.top(30) - MARGIN)),
    );
    expect(away.length).toBeGreaterThan(40);
    expect(Math.max(...away)).toBeLessThanOrEqual(1);
  });

  it('is what the browser does NOT do: a card put in place once is far from its place after the cards above it are drawn', () => {
    // (the failure this holds against: scrollIntoView once, then the tables arrive - the card had landed 800 px off)
    const page = new Page(KEYS.map(() => 300));
    page.scrollBy(page.top(30) - MARGIN);
    expect(page.top(30)).toBe(MARGIN);
    page.draw(22, 29, 350);
    expect(Math.abs(page.top(30) - MARGIN)).toBeGreaterThan(2000);
  });

  it('ends by itself once the page has been quiet, and does nothing after that', () => {
    const page = new Page(KEYS.map(() => 300));
    const clock = new Frames();
    const { hold, moves } = holdOn(page, clock);
    hold.start('c20', 'margin');
    expect(hold.active).toBe(true);
    clock.run(300, (t) => (t === 80 ? page.draw(14, 19, 200) : undefined));
    expect(hold.active).toBe(true);
    clock.run(HOLD_QUIET + 200);
    expect(hold.active).toBe(false);
    expect(clock.pending).toBe(0);
    const n = moves.length;
    // later changes of the page are the page's: the card is not chased any more
    page.draw(0, 5, 100);
    clock.run(500);
    expect(moves.length).toBe(n);
  });

  it('is kept going by a draw that is still waiting, and by cards that go on being drawn', () => {
    const page = new Page(KEYS.map(() => 300));
    const clock = new Frames();
    let waiting = true;
    const { hold } = holdOn(page, clock, () => waiting);
    hold.start('c20', 'margin');
    clock.run(3000);
    expect(hold.active).toBe(true);
    waiting = false;
    clock.run(HOLD_QUIET + 100);
    expect(hold.active).toBe(false);
    // a card drawn every 500 ms keeps it going for as long as that goes on
    const p2 = new Page(KEYS.map(() => 300));
    const c2 = new Frames();
    const h2 = holdOn(p2, c2).hold;
    h2.start('c20', 'margin');
    c2.run(4000, (t) => (t % 512 < 16 ? p2.draw(10, 12, 40) : undefined));
    expect(h2.active).toBe(true);
    expect(p2.top(20)).toBeGreaterThanOrEqual(MARGIN - 1);
    expect(p2.top(20)).toBeLessThanOrEqual(MARGIN + 1);
  });

  it('is let go at the longest, however busy the page', () => {
    const page = new Page(KEYS.map(() => 300));
    const clock = new Frames();
    const { hold } = holdOn(page, clock, () => true);
    hold.start('c20', 'margin');
    clock.run(HOLD_MAX + 100);
    expect(hold.active).toBe(false);
    expect(clock.pending).toBe(0);
  });

  it('lets go the moment the reader takes over, and never moves the page again', () => {
    const page = new Page(KEYS.map(() => 300));
    const clock = new Frames();
    const { hold, moves } = holdOn(page, clock);
    hold.start('c30', 'margin');
    clock.run(100);
    hold.release();
    expect(hold.active).toBe(false);
    expect(clock.pending).toBe(0);
    const n = moves.length;
    page.scrollBy(500);
    page.draw(10, 29, 300);
    clock.run(2000);
    expect(moves.length).toBe(n);
  });

  it('a new hold replaces the one before it', () => {
    const page = new Page(KEYS.map(() => 300));
    const clock = new Frames();
    const { hold } = holdOn(page, clock);
    hold.start('c10', 'margin');
    clock.run(100);
    hold.start('c30', 'margin');
    expect(hold.key).toBe('c30');
    page.draw(20, 29, 300);
    clock.run(100);
    expect(page.top(30)).toBeGreaterThanOrEqual(MARGIN - 1);
    expect(page.top(30)).toBeLessThanOrEqual(MARGIN + 1);
    expect(page.top(10)).toBeLessThan(0);
  });

  it('keeps a card at a place it was at (Expand all, Collapse all), not only at its margin', () => {
    const page = new Page(KEYS.map(() => 300));
    page.scrollBy(page.top(12) - 250);
    expect(page.top(12)).toBe(250);
    const clock = new Frames();
    const { hold } = holdOn(page, clock);
    hold.start('c12', 250);
    // every card above it closes, and the page is much shorter above the card
    page.heights = page.heights.map((h, k) => (k < 12 ? 60 : h));
    clock.run(200);
    expect(page.top(12)).toBeGreaterThanOrEqual(249);
    expect(page.top(12)).toBeLessThanOrEqual(251);
  });

  it('does not chase a card that is not on the page, and does not fail for one', () => {
    const page = new Page(KEYS.map(() => 300));
    const clock = new Frames();
    const { hold, moves } = holdOn(page, clock);
    hold.start('gone', 'margin');
    clock.run(1500);
    expect(moves).toEqual([]);
    expect(hold.active).toBe(false);
  });

  it('a card near the end of the page that cannot reach its place is not chased for ever: the hold ends, and the page is not moved by it again', () => {
    // (the page ends 100 px under the last card: it cannot be brought up to 96 px, the page is as far as it goes)
    const page = new Page(KEYS.map(() => 300), 400, 800, 100);
    const clock = new Frames();
    const { hold, moves } = holdOn(page, clock);
    hold.start('c39', 'margin');
    expect(page.top(39)).toBeGreaterThan(MARGIN + 100);
    clock.run(HOLD_QUIET + 100);
    // (a page that cannot move is quiet: the hold ends as any other, not at its longest)
    expect(hold.active).toBe(false);
    const asked = moves.length;
    expect(asked).toBeLessThanOrEqual(Math.ceil(HOLD_QUIET / 16) + 3);
    clock.run(2000);
    expect(moves.length).toBe(asked);
  });
});

/* ── The step the reader is at, from the scroll ───────────────────────── */

describe('the card at the line', () => {
  const line = MARGIN + LINE_BELOW_MARGIN;
  it('is the last card whose top has reached the line; none while the reader is above the first', () => {
    expect(cardAtLine([300, 900, 1500], line)).toBeNull();
    expect(cardAtLine([-1200, -400, 100, 800], line)).toBe(2);
    expect(cardAtLine([-1200, -400, 119.9, 800], line)).toBe(2);
    expect(cardAtLine([-1200, -400, 121, 800], line)).toBe(1);
    expect(cardAtLine([], line)).toBeNull();
  });

  it('counts a card whose top is exactly at the line as reached, and takes the last of two cards that stand at one place (a card of no height)', () => {
    expect(cardAtLine([-400, 120, 700], line)).toBe(1);
    expect(cardAtLine([-400, 120, 120.5, 700], line)).toBe(1);
    expect(cardAtLine([-400, 50, 50, 700], line)).toBe(2);
  });

  it('is the card just above the line when the line is in the gap between two cards, and a card taken off the page is never it', () => {
    expect(cardAtLine([-900, null, -300, 500], line)).toBe(2);
    expect(cardAtLine([null, null], line)).toBeNull();
    expect(cardAtLine([-50, null, 130], line)).toBe(0);
  });

  it('is the card a jump puts at its margin (a card at its scroll margin has reached the line), so the counter agrees with the jump', () => {
    expect(cardAtLine([-2000, MARGIN, MARGIN + 700], line)).toBe(1);
  });
});

class Watch {
  now = 0;
  timers: { id: number; at: number; call: () => void }[] = [];
  private next = 1;
  heard: (number | null)[] = [];
  tops: (number | null)[] = [-900, -300, 400, 1100];
  holding = false;
  env: SpyEnv = {
    now: () => this.now,
    tops: () => this.tops,
    line: () => MARGIN + LINE_BELOW_MARGIN,
    later: (call, ms) => {
      const id = this.next++;
      this.timers.push({ id, at: this.now + ms, call });
      return id;
    },
    clear: (id) => {
      this.timers = this.timers.filter((t) => t.id !== id);
    },
    at: (index) => this.heard.push(index),
    holding: () => this.holding,
  };
  advance(ms: number): void {
    const end = this.now + ms;
    for (;;) {
      const due = this.timers.filter((t) => t.at <= end).sort((a, b) => a.at - b.at)[0];
      if (!due) break;
      this.timers = this.timers.filter((t) => t !== due);
      this.now = Math.max(this.now, due.at);
      due.call();
    }
    this.now = end;
  }
}

describe('the step the reader is at follows their scrolling, and only theirs', () => {
  it('says nothing for a scroll nobody asked for (the page moved by itself, a jump, scroll anchoring)', () => {
    const w = new Watch();
    const spy = new Spy(w.env);
    w.now = 5000;
    spy.scrolled();
    w.advance(500);
    expect(w.heard).toEqual([]);
  });

  it('says which card is at the line when the reader has scrolled, a moment after, and again as they go on', () => {
    const w = new Watch();
    const spy = new Spy(w.env);
    w.now = 1000;
    spy.input();
    spy.scrolled();
    w.advance(10);
    // the first look is at once (nothing was looked at lately), at the line: card 1 (top -300) is the last above it
    w.advance(200);
    expect(w.heard).toEqual([1]);
    w.tops = [-3000, -2400, -1700, -1000];
    w.now += 50;
    spy.scrolled();
    w.advance(300);
    expect(w.heard).toEqual([1, 3]);
  });

  it('looks at most every 100 ms however many scroll events come, and the last look sees where the page stopped', () => {
    const w = new Watch();
    const spy = new Spy(w.env);
    w.now = 1000;
    spy.input();
    spy.scrolled();
    w.advance(0);
    for (let k = 0; k < 30; k++) {
      w.tops = [-900 - 40 * k, -300 - 40 * k, 400 - 40 * k, 1100 - 40 * k];
      spy.scrolled();
      w.advance(16);
    }
    w.advance(400);
    // not one look for each of the 31 events, and the last says where it ended: top 400 - 1160 = -760 for card 2, -60 for card 3: card 3 is at the line
    expect(w.heard.length).toBeLessThan(10);
    expect(w.heard[w.heard.length - 1]).toBe(3);
  });

  it('says nothing while a card is being held (the page being put back is not the reader scrolling)', () => {
    const w = new Watch();
    const spy = new Spy(w.env);
    w.now = 1000;
    spy.input();
    w.holding = true;
    spy.scrolled();
    w.advance(500);
    expect(w.heard).toEqual([]);
    w.holding = false;
    spy.scrolled();
    w.advance(500);
    expect(w.heard).toEqual([1]);
  });

  it('a scroll that came while a card was held is not looked at later, when the hold is over: it was not the reader’s', () => {
    const w = new Watch();
    const spy = new Spy(w.env);
    w.now = 1000;
    spy.input();
    w.holding = true;
    spy.scrolled();
    w.holding = false;
    w.advance(500);
    expect(w.heard).toEqual([]);
  });

  it('forgets that the reader scrolled when a card is chosen: the scrolling that follows is the jump’s', () => {
    const w = new Watch();
    const spy = new Spy(w.env);
    w.now = 1000;
    spy.input();
    spy.settle();
    spy.scrolled();
    w.advance(500);
    expect(w.heard).toEqual([]);
    // and what was waiting to be looked at is not looked at
    const v = new Watch();
    const s2 = new Spy(v.env);
    v.now = 1000;
    s2.input();
    s2.scrolled();
    s2.settle();
    v.advance(500);
    expect(v.heard).toEqual([]);
  });

  it('stops looking for a scroll once the reader has been still for a few seconds (a later move of the page is not theirs)', () => {
    const w = new Watch();
    const spy = new Spy(w.env);
    w.now = 1000;
    spy.input();
    w.advance(READING_WINDOW + 500);
    spy.scrolled();
    w.advance(500);
    expect(w.heard).toEqual([]);
  });

  it('says "above the first card" (null) when the reader scrolled back to the form, so that the counter does not claim a step', () => {
    const w = new Watch();
    const spy = new Spy(w.env);
    w.now = 1000;
    spy.input();
    w.tops = [300, 900, 1500, 2100];
    spy.scrolled();
    w.advance(300);
    expect(w.heard).toEqual([null]);
  });

  it('an initial look (a page that opens part-way down) says where the reader is without any input', () => {
    const w = new Watch();
    const spy = new Spy(w.env);
    spy.run();
    expect(w.heard).toEqual([1]);
  });
});
