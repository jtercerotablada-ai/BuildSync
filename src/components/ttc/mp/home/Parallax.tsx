'use client';

import { useEffect } from 'react';
import { heroShift, pauseShift } from './parallax-math';

/**
 * The parallax island (spec E14). It renders nothing. Mounted once by
 * `HomeView`, it finds the two boxes the markup marks —
 *
 *   [data-parallax="hero"]   the film's box (12 % taller than the hero)
 *   [data-parallax="pause"]  the pause photograph's frame (18 % taller than
 *                            its plate)
 *
 * — and shifts them with `translate3d` as the page scrolls. Nothing else is
 * written: no layout property, no class, no React state.
 *
 * ONE scroll listener, one `requestAnimationFrame` per burst of scrolling, and
 * only for a box whose plate is on screen (IntersectionObserver). The shifts
 * are `parallax-math.ts`.
 *
 * ON ONLY WHERE IT HELPS: from 900 px of width, with a fine pointer (a mouse
 * or a trackpad), and without a request for reduced motion. Anywhere else, or
 * the moment one of those stops being true, the boxes are put back where the
 * CSS has them. No script: static.
 */
const WHEN = '(min-width: 900px) and (pointer: fine) and (prefers-reduced-motion: no-preference)';

export function Parallax() {
  useEffect(() => {
    const boxes = Array.from(document.querySelectorAll<HTMLElement>('.mp-home [data-parallax]'));
    if (boxes.length === 0) return;
    const mq = window.matchMedia(WHEN);

    // A box is watched through its plate (its parent): the plate is the
    // rectangle that stays put; the box is taller than it and moves.
    const plates = new Map<Element, HTMLElement>();
    const seen = new Set<HTMLElement>();
    let io: IntersectionObserver | undefined;
    let raf = 0;

    const place = () => {
      raf = 0;
      const vh = window.innerHeight;
      for (const box of seen) {
        let y = 0;
        if (box.dataset.parallax === 'hero') {
          y = heroShift(window.scrollY);
        } else {
          const plate = box.parentElement?.getBoundingClientRect();
          if (!plate) continue;
          y = pauseShift(plate.top, plate.height, vh);
        }
        box.style.transform = `translate3d(0, ${y}px, 0)`;
      }
    };
    const schedule = () => {
      if (!raf) raf = requestAnimationFrame(place);
    };

    const start = () => {
      for (const box of boxes) {
        if (box.parentElement) plates.set(box.parentElement, box);
      }
      io = new IntersectionObserver(
        (entries) => {
          for (const entry of entries) {
            const box = plates.get(entry.target);
            if (!box) continue;
            if (entry.isIntersecting) seen.add(box);
            else seen.delete(box);
          }
          schedule();
        },
        { rootMargin: '100px 0px' },
      );
      for (const plate of plates.keys()) io.observe(plate);
      window.addEventListener('scroll', schedule, { passive: true });
      window.addEventListener('resize', schedule);
    };

    const stop = () => {
      io?.disconnect();
      io = undefined;
      plates.clear();
      seen.clear();
      window.removeEventListener('scroll', schedule);
      window.removeEventListener('resize', schedule);
      if (raf) cancelAnimationFrame(raf);
      raf = 0;
      for (const box of boxes) box.style.transform = '';
    };

    const sync = () => {
      stop();
      if (mq.matches) start();
    };
    sync();
    mq.addEventListener('change', sync);

    return () => {
      mq.removeEventListener('change', sync);
      stop();
    };
  }, []);

  return null;
}
