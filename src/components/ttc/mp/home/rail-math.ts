/**
 * The building-types rail's arithmetic (spec E13). Pure: the island
 * (`TypesRail.tsx`) measures the scroller and its cards and hands the numbers
 * over; what comes back is where to scroll to, what the counter says, how
 * far the progress hairline reaches, and whether a mouse has dragged far
 * enough to count as a drag.
 *
 * COORDINATES. `lefts` are the cards' left edges in the scroller's CONTENT
 * (the x a card has at `scrollLeft = 0`). The first card sits at the gutter,
 * so `lefts[0]` IS the gutter, and the position at which card `i` is "at the
 * left edge", the one `scroll-snap-align: start` + `scroll-padding` snaps to,
 * is `lefts[i] − lefts[0]` — kept inside 0 … max, because the last cards can
 * never reach the edge.
 */

/** A scroller is "at" an end within this many px (sub-pixel scroll offsets). */
export const END_SLACK = 2;

/** A mouse has to move this far before a press becomes a drag; below it the
 *  press is still a click. */
export const DRAG_THRESHOLD = 5;

export type RailMetrics = {
  scrollLeft: number;
  clientWidth: number;
  scrollWidth: number;
  /** Each card's left edge in content coordinates, in order. */
  lefts: readonly number[];
};

export function maxScroll(m: Pick<RailMetrics, 'clientWidth' | 'scrollWidth'>): number {
  return Math.max(0, m.scrollWidth - m.clientWidth);
}

/** Where each card is "at the left edge", clamped to what can be scrolled to. */
export function snapPositions(lefts: readonly number[], max: number): number[] {
  if (lefts.length === 0) return [];
  const gutter = lefts[0];
  return lefts.map((left) => Math.min(Math.max(left - gutter, 0), Math.max(max, 0)));
}

export function atStart(m: Pick<RailMetrics, 'scrollLeft'>): boolean {
  return m.scrollLeft <= END_SLACK;
}

export function atEnd(m: RailMetrics): boolean {
  return m.scrollLeft >= maxScroll(m) - END_SLACK;
}

/** The card nearest the left edge (the counter's "02"), 0-based. At the very
 *  end the last card counts: the cards behind it can never reach the edge, and
 *  a counter that stopped at "04 / 06" with nothing left to scroll to would
 *  read as a bug. */
export function currentIndex(m: RailMetrics): number {
  const n = m.lefts.length;
  if (n === 0) return 0;
  if (maxScroll(m) > END_SLACK && atEnd(m)) return n - 1;
  const snaps = snapPositions(m.lefts, Number.POSITIVE_INFINITY);
  let best = 0;
  let bestGap = Number.POSITIVE_INFINITY;
  snaps.forEach((s, i) => {
    const gap = Math.abs(s - m.scrollLeft);
    if (gap < bestGap) {
      best = i;
      bestGap = gap;
    }
  });
  return best;
}

/** Where "next" scrolls to: the first card position beyond the current one,
 *  or the end; the current position when there is nothing further. */
export function nextTarget(m: RailMetrics): number {
  const max = maxScroll(m);
  if (m.scrollLeft >= max - END_SLACK) return Math.min(m.scrollLeft, max);
  const beyond = snapPositions(m.lefts, max).find((s) => s > m.scrollLeft + END_SLACK);
  return beyond ?? max;
}

/** Where "previous" scrolls to: the last card position before the current
 *  one, or the start. */
export function prevTarget(m: RailMetrics): number {
  if (atStart(m)) return 0;
  const snaps = snapPositions(m.lefts, maxScroll(m));
  for (let i = snaps.length - 1; i >= 0; i--) {
    if (snaps[i] < m.scrollLeft - END_SLACK) return snaps[i];
  }
  return 0;
}

/** The progress hairline: where it starts and how long it is, as fractions of
 *  the bar. Its length is the part of the rail you can see; its start is how
 *  far along you are. With nothing to scroll it fills the bar. */
export function railProgress(m: RailMetrics): { start: number; size: number } {
  if (!(m.scrollWidth > 0) || m.scrollWidth <= m.clientWidth) return { start: 0, size: 1 };
  const size = Math.min(1, m.clientWidth / m.scrollWidth);
  const start = Math.min(Math.max(m.scrollLeft / m.scrollWidth, 0), 1 - size);
  return { start, size };
}

/** The counter's text: "02 / 06". */
export function counterText(index: number, total: number): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${pad(Math.min(Math.max(index, 0), Math.max(total - 1, 0)) + 1)} / ${pad(total)}`;
}

/** Has a press moved far enough to be a drag? */
export function dragStarted(dx: number): boolean {
  return Math.abs(dx) > DRAG_THRESHOLD;
}

/** The scroll position of a drag: the content follows the pointer. */
export function dragTarget(startScrollLeft: number, startX: number, x: number, max: number): number {
  return Math.min(Math.max(startScrollLeft - (x - startX), 0), Math.max(max, 0));
}
