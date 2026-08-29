"use client";

import { useEffect, useState } from "react";

/**
 * "Today", as the person looking at the screen means it.
 *
 * WHY THIS EXISTS. Every view that drew a today marker computed it during
 * render with `new Date()`. Server renders run in UTC, so from 20:00 in
 * Miami (00:00 UTC) the server's "today" is already TOMORROW — and React
 * does not repair a className mismatch when it hydrates, so the wrong day
 * stayed lit until that node happened to re-render for some other reason.
 * Working an evening, the Timeline's today pill and today line, and the
 * Calendar's today circle, all pointed one day ahead. Paging the Timeline
 * could even light TWO days: the stale server one and the correct client one.
 *
 * The fix is not "compute it more carefully" — it is to not compute it on the
 * server at all. `useToday()` returns `null` for the server render AND the
 * first client render, so the two agree and there is nothing to repair; the
 * marker paints one frame later, from the browser's own clock.
 *
 * Callers must handle `null` by drawing no marker for that first frame.
 * That is deliberate: a wrong marker is worse than a late one, because a
 * schedule is read for exactly this.
 */

/** Local midnight of the calendar day `now` falls in. */
export function localDayOf(now: Date): Date {
  return new Date(now.getFullYear(), now.getMonth(), now.getDate());
}

/** Local midnight of the day AFTER `now` — when a marker goes stale.
 *  Built by day arithmetic on the local calendar, so DST transitions (when
 *  a "day" is 23 or 25 hours long) land on the real boundary rather than
 *  `now + 86400000`. */
export function nextLocalMidnight(now: Date): Date {
  return new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
}

/** Milliseconds until the next local midnight, clamped to at least 1s so a
 *  clock that lands exactly on the boundary cannot spin a zero-delay timer. */
export function msUntilNextLocalMidnight(now: Date): number {
  return Math.max(1000, nextLocalMidnight(now).getTime() - now.getTime());
}

/**
 * Local midnight of today, or `null` until the component has mounted.
 *
 * Re-arms itself at the next local midnight, so a tab left open overnight
 * — the browser someone leaves running on the office machine — moves its
 * today marker instead of keeping yesterday lit.
 */
export function useToday(): Date | null {
  const [today, setToday] = useState<Date | null>(null);

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | undefined;

    const tick = () => {
      const now = new Date();
      const day = localDayOf(now);
      // Only swap the object when the calendar day actually changed: the
      // value is a useMemo dependency in several views, and a fresh Date
      // every tick would recompute every column layout for nothing.
      setToday((prev) => (prev && prev.getTime() === day.getTime() ? prev : day));
      timer = setTimeout(tick, msUntilNextLocalMidnight(now));
    };

    tick();
    return () => {
      if (timer) clearTimeout(timer);
    };
  }, []);

  return today;
}
