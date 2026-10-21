'use client';

import React, { useEffect, useRef, useState } from 'react';

/**
 * A box that scrolls sideways where it overflows — the milestone page's four
 * cards swipe on a phone — and is a plain block where it fits.
 *
 * While it scrolls it is a named region and a Tab stop, so a keyboard moves
 * it with the arrow keys (WCAG 2.1.1: content in a scrolling box must be
 * reachable without a pointer). Once it fits (from 721px, where the cards
 * are a table) it is neither: a ring around a whole table that the keys
 * cannot move was an empty stop, and a screen reader announced a "region"
 * with nothing in it to operate. The same rule as the calculators'
 * `ScrollBox` (calc/stiffness/MatrixTable.tsx).
 *
 * The server HTML keeps the stop (`scrolls` starts true): a phone can scroll
 * the box by keyboard before the page has hydrated, and the first measure
 * takes the stop away where the box fits. Every word of the children stays
 * in the server HTML.
 */
export function ScrollRegion({
  className,
  labelledBy,
  children,
}: {
  className: string;
  /** The id of the heading that names the region. */
  labelledBy: string;
  children: React.ReactNode;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [scrolls, setScrolls] = useState(true);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const measure = () => setScrolls(el.scrollWidth > el.clientWidth + 1);
    measure();
    if (typeof ResizeObserver === 'undefined') return;
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    // A card that changes width (a font arriving) changes what overflows
    // without changing the box itself.
    if (el.firstElementChild) ro.observe(el.firstElementChild);
    return () => ro.disconnect();
  }, []);

  return (
    <div
      ref={ref}
      className={className}
      role={scrolls ? 'region' : undefined}
      aria-labelledby={scrolls ? labelledBy : undefined}
      tabIndex={scrolls ? 0 : undefined}
    >
      {children}
    </div>
  );
}
