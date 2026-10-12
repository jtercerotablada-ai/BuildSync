'use client';

import { useEffect, useLayoutEffect, useRef, useState, type RefObject } from 'react';

/**
 * THE CALCULATORS' SHELL — the column of drawings: how wide, how tall, and
 * whether it is pinned. (What the shell is, and a calculator built on it:
 * index.ts.)
 *
 * A calculator's answer is a column of drawings beside its form (calc.css,
 * .mp-app__out > .mp-app__plots). The drawings are SVG laid out in pixels,
 * so the component must know the column's width; the diagrams share the
 * window's height; and on paper both are the sheet's, not the window's:
 *
 *     const [plotRef, windowWidth] = useWidth<HTMLDivElement>();   // on .mp-app__plots
 *     const [outRef, tooTall] = useTooTall<HTMLElement>();         // on .mp-app__out
 *     const windowPlotHeight = usePlotHeight();
 *     const plotHeight = onPaper ? PAPER_PLOT : windowPlotHeight;  // `onPaper`: sheet.tsx
 *     const width = onPaper ? PAPER_WIDTH : windowWidth;
 *
 * On the server, and until the first measure, the width is 720, a diagram
 * is 150 tall and the column is pinned: the page arrives as the sheet has it.
 */

/* A layout effect in the browser (the drawings must be at their real width
   before the first paint), a plain effect where there is no layout. */
export const useIsoLayoutEffect = typeof window === 'undefined' ? useEffect : useLayoutEffect;

/** The width of an element, as it is laid out — 720 until it has been measured. */
export function useWidth<T extends HTMLElement>(): [RefObject<T | null>, number] {
  const ref = useRef<T>(null);
  const [width, setWidth] = useState(720);
  useIsoLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const measure = () => setWidth(Math.max(280, Math.round(el.clientWidth)));
    measure();
    if (typeof ResizeObserver === 'undefined') return;
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  return [ref, width];
}

/** A diagram as it is drawn for paper: the shortest the page uses, so four drawings share a sheet with the input. */
export const PAPER_PLOT = 96;
/** …and as wide as the sheet's column of type: 191 mm of a Letter page, in the drawing's own pixels. Drawn for THAT width, whatever the window's — a phone's drawing blown up to a page was all letters. */
export const PAPER_WIDTH = 724;

/**
 * How tall each of the three diagrams is. On a desktop the drawings follow
 * the form down the page (calc.css, .mp-app__out is sticky), which only
 * helps if all four fit under the header: 150px each on a tall window, less
 * on a laptop, never under 96. At 96 they need a window some 790px tall;
 * in a shorter one they do not fit at any size worth drawing, and the sheet
 * lets the column scroll with the page instead of pinning it half out of
 * sight.
 */
export function usePlotHeight(): number {
  const [h, setH] = useState(150);
  useEffect(() => {
    // 500px is everything else in the column: the header above it, the
    // schematic, four captions and the note on signs.
    const fit = () => setH(Math.round(Math.min(150, Math.max(96, (window.innerHeight - 500) / 3))));
    fit();
    window.addEventListener('resize', fit);
    return () => window.removeEventListener('resize', fit);
  }, []);
  return h;
}

/**
 * Whether the drawings' column is taller than the window has room for under
 * the header — in which case the sheet does not pin it (.mp-app__out--tall).
 * The heights above are reckoned for a drawing of the beam at its plain
 * size. It grows with what is on the beam (twelve loads close together, their
 * values stacked), and a notice may stand over it: pinned then, the foot of
 * the deflection diagram stayed under the fold for as long as the form was
 * on screen. So the column is measured, each time its size or the window's
 * changes. Not on the server, and not before the first measure: the page
 * arrives pinned, as the sheet has it. Being let go does not change the
 * column's height, so the measure cannot chase itself.
 */
export function useTooTall<T extends HTMLElement>(): [RefObject<T | null>, boolean] {
  const ref = useRef<T>(null);
  const [tooTall, setTooTall] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el || typeof ResizeObserver === 'undefined') return;
    // Where the sheet pins it: its `top`, which is a length whether or not it is pinned now.
    const measure = () => setTooTall(el.getBoundingClientRect().height + (parseFloat(getComputedStyle(el).top) || 0) > window.innerHeight);
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    window.addEventListener('resize', measure);
    return () => {
      ro.disconnect();
      window.removeEventListener('resize', measure);
    };
  }, []);
  return [ref, tooTall];
}
