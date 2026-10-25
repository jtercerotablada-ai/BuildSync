'use client';

import React, { useEffect, useRef } from 'react';
import { useMotionPaused } from '../media';
import { RIBBON, initialRibbon, stepRibbon } from './ribbon-math';

/**
 * The ribbon's island (spec E7): the two rows of moving type.
 *
 * `HomeRibbon` (a server component) prints the rows — both lists of each row,
 * the second a copy rendered by React so that hydration never meets DOM it did
 * not write — and hands them to this component as `children`. This renders the
 * one wrapper (`div.h-rib__rows`, `aria-hidden`: a moving ribbon is decoration;
 * the same eight services are real links in the grid below) and moves the
 * tracks inside it.
 *
 * WHAT IT DOES, in a requestAnimationFrame loop, by writing `translate3d` to
 * each `[data-ribbon-track]` through a ref (never through React state or a
 * React-managed style: it would render sixty times a second). The arithmetic
 * is `ribbon-math.ts`; this file only measures and writes:
 *
 *   • each track moves by exactly one list's width and wraps (the lists are
 *     identical, so the wrap is invisible);
 *   • it follows the page's scroll direction and speed;
 *   • a row comes to rest under the pointer, or when something in it has focus.
 *
 * WHEN IT RUNS. Only while the rows are within 200 px of the screen
 * (IntersectionObserver), the visitor has not paused motion (the same switch
 * as the film: `useMotionPaused`), and the visitor has not asked for reduced
 * motion (CSS shows a plain wrapped list then and hides the second copies; the
 * loop is never started). Otherwise there is no frame request at all. The
 * tracks stay where they stopped.
 *
 * WITHOUT THIS SCRIPT the rows still run, on CSS keyframes that apply only to
 * `html:not(.js)` (home.css): `html.js` is set by the page's first script, so
 * the moment scripts run the CSS lets go and this takes over.
 */
export function RibbonRows({ children }: { children: React.ReactNode }) {
  const rootRef = useRef<HTMLDivElement>(null);
  const paused = useMotionPaused();
  const pausedRef = useRef(paused);
  const syncRef = useRef<(() => void) | null>(null);

  // The switch changed: start or stop the loop. (The effect below installs
  // `sync`; this one runs first on mount, when there is nothing to sync yet,
  // and `pausedRef` is already right when the other one reads it.)
  useEffect(() => {
    pausedRef.current = paused;
    syncRef.current?.();
  }, [paused]);

  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;

    const rows = Array.from(root.querySelectorAll<HTMLElement>('[data-ribbon-row]'));
    const tracks = rows.map((row) => row.querySelector<HTMLElement>('[data-ribbon-track]'));
    const lists = tracks.map((track) => track?.querySelector<HTMLElement>('ul') ?? null);
    const specs = rows.map((row) => ({
      base: row.dataset.ribbonRow === 'b' ? RIBBON.baseB : RIBBON.baseA,
      width: 0,
    }));
    const hovered = rows.map(() => false);
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)');

    let state = initialRibbon(rows.length);
    let visible = false;
    let raf = 0;
    let last = 0;
    let lastY = 0;

    // One list's width, to the sub-pixel: a rounded width would let the loop
    // drift by a fraction of a pixel on every lap and, in time, show a seam.
    const measure = () => {
      lists.forEach((list, i) => {
        specs[i].width = list ? list.getBoundingClientRect().width : 0;
      });
    };

    const frame = (now: number) => {
      const dt = (now - last) / 1000;
      last = now;
      const y = window.scrollY;
      const scrollV = dt > 0 ? (y - lastY) / dt : 0;
      lastY = y;
      state = stepRibbon(state, { scrollV, hovered, rows: specs }, dt);
      state.rows.forEach((row, i) => {
        const track = tracks[i];
        if (track) track.style.transform = `translate3d(${row.x}px, 0, 0)`;
      });
      raf = requestAnimationFrame(frame);
    };

    const sync = () => {
      const run = visible && !pausedRef.current && !reduce.matches;
      if (run && !raf) {
        measure();
        last = performance.now();
        lastY = window.scrollY;
        raf = requestAnimationFrame(frame);
      } else if (!run && raf) {
        cancelAnimationFrame(raf);
        raf = 0;
      }
    };
    syncRef.current = sync;

    const io = new IntersectionObserver(
      ([entry]) => {
        visible = entry?.isIntersecting ?? false;
        sync();
      },
      { rootMargin: '200px 0px' },
    );
    io.observe(root);

    const ro = new ResizeObserver(measure);
    lists.forEach((list) => list && ro.observe(list));

    // Pointer or focus on a row. A finger does not hover: on a touch screen a
    // tap would otherwise stop the row until the next tap elsewhere.
    const off: (() => void)[] = [];
    rows.forEach((row, i) => {
      const enter = (e: PointerEvent) => {
        if (e.pointerType !== 'touch') hovered[i] = true;
      };
      const focus = () => void (hovered[i] = true);
      const leave = () => void (hovered[i] = false);
      row.addEventListener('pointerenter', enter);
      row.addEventListener('pointerleave', leave);
      row.addEventListener('focusin', focus);
      row.addEventListener('focusout', leave);
      off.push(() => {
        row.removeEventListener('pointerenter', enter);
        row.removeEventListener('pointerleave', leave);
        row.removeEventListener('focusin', focus);
        row.removeEventListener('focusout', leave);
      });
    });

    reduce.addEventListener('change', sync);

    return () => {
      syncRef.current = null;
      if (raf) cancelAnimationFrame(raf);
      io.disconnect();
      ro.disconnect();
      reduce.removeEventListener('change', sync);
      off.forEach((fn) => fn());
      tracks.forEach((track) => {
        if (track) track.style.transform = '';
      });
    };
  }, []);

  return (
    <div ref={rootRef} className="h-rib__rows" aria-hidden="true">
      {children}
    </div>
  );
}
