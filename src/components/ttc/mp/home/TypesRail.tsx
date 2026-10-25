'use client';

import React, { useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { Arrow } from './glyphs';
import {
  atEnd,
  atStart,
  counterText,
  currentIndex,
  dragStarted,
  dragTarget,
  maxScroll,
  nextTarget,
  prevTarget,
  railProgress,
  type RailMetrics,
} from './rail-math';

/**
 * The building-types rail's island (spec E13): the two ring buttons, mouse
 * drag, the arrow keys, the counter and the progress hairline.
 *
 * `HomeTypes` (a server component) prints the rail as a NATIVE horizontal
 * scroller — a trackpad, a finger, shift + wheel and, with the region focused,
 * the arrow keys all scroll it with no script — and this component adds to it.
 * It renders one thing, the buttons' container `.h-types__ctl`, and reaches the
 * rest of its section by `data-motion` attributes:
 *
 *   rail        the scroller (`role="region"`, focusable)
 *   rail-card   each card
 *   rail-count  the "01 / 06" text         (aria-hidden, decoration)
 *   rail-bar    the progress hairline      (aria-hidden, decoration)
 *
 * The counter's text and the bar's transform are written straight to those two
 * nodes (they are decoration, nothing re-renders them, and hydration is long
 * over by the time this runs). The buttons exist only once the script has run
 * — before it, and without it, the container is empty and CSS hides it — and
 * they use `aria-disabled`, not `disabled`: a button that disables itself
 * under the keyboard focus takes the focus with it.
 *
 * All the arithmetic — where "next" goes, which card the counter names, how
 * long the bar is, when a press has become a drag — is `rail-math.ts`.
 */

const noop = () => () => {};

export function TypesRail({ prev, next }: { prev: string; next: string }) {
  const ctlRef = useRef<HTMLDivElement>(null);
  const stepRef = useRef<((dir: 1 | -1) => void) | null>(null);
  // false on the server and in the hydration pass, true after: the buttons are
  // the one thing here that is not in the server HTML.
  const ready = useSyncExternalStore(noop, () => true, () => false);
  const [ends, setEnds] = useState({ start: true, end: false });

  useEffect(() => {
    const section = ctlRef.current?.closest('section');
    const rail = section?.querySelector<HTMLElement>('[data-motion="rail"]');
    if (!section || !rail) return;
    const cards = Array.from(section.querySelectorAll<HTMLElement>('[data-motion="rail-card"]'));
    const count = section.querySelector<HTMLElement>('[data-motion="rail-count"]');
    const bar = section.querySelector<HTMLElement>('[data-motion="rail-bar"]');
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)');

    const metrics = (): RailMetrics => {
      const box = rail.getBoundingClientRect();
      return {
        scrollLeft: rail.scrollLeft,
        clientWidth: rail.clientWidth,
        scrollWidth: rail.scrollWidth,
        lefts: cards.map((card) => card.getBoundingClientRect().left - box.left + rail.scrollLeft),
      };
    };

    let shownIndex = -1;
    const update = () => {
      const m = metrics();
      const index = currentIndex(m);
      if (count && index !== shownIndex) {
        count.textContent = counterText(index, cards.length);
        shownIndex = index;
      }
      if (bar) {
        const { start, size } = railProgress(m);
        bar.style.transform = `translateX(${start * 100}%) scaleX(${size})`;
      }
      const s = atStart(m);
      const e = atEnd(m);
      setEnds((was) => (was.start === s && was.end === e ? was : { start: s, end: e }));
    };

    let ticking = false;
    const onScroll = () => {
      if (ticking) return;
      ticking = true;
      requestAnimationFrame(() => {
        ticking = false;
        update();
      });
    };
    rail.addEventListener('scroll', onScroll, { passive: true });
    const ro = new ResizeObserver(update);
    ro.observe(rail);
    update();

    // Previous / next: one card, smoothly (at once under reduced motion).
    const step = (dir: 1 | -1) => {
      const m = metrics();
      rail.scrollTo({
        left: dir > 0 ? nextTarget(m) : prevTarget(m),
        behavior: reduce.matches ? 'auto' : 'smooth',
      });
    };
    stepRef.current = step;

    // With the region itself focused, the arrow keys move a card at a time (a
    // native arrow key moves about 40 px). Home and End stay native.
    const onKey = (e: KeyboardEvent) => {
      if (e.target !== rail || e.altKey || e.ctrlKey || e.metaKey || e.shiftKey) return;
      if (e.key === 'ArrowRight') step(1);
      else if (e.key === 'ArrowLeft') step(-1);
      else return;
      e.preventDefault();
    };
    rail.addEventListener('keydown', onKey);

    // Mouse drag. Only a mouse: a finger already scrolls the rail natively. A
    // press is still a click until it has moved more than 5 px; after that the
    // rail follows the pointer and the click that ends the drag is swallowed,
    // so letting go over a card does not open it.
    let drag: { id: number; x0: number; s0: number; moved: boolean } | null = null;
    let swallow = false;
    const onDown = (e: PointerEvent) => {
      if (e.pointerType !== 'mouse' || e.button !== 0) return;
      drag = { id: e.pointerId, x0: e.clientX, s0: rail.scrollLeft, moved: false };
    };
    const onMove = (e: PointerEvent) => {
      if (!drag || e.pointerId !== drag.id) return;
      if (!drag.moved) {
        if (!dragStarted(e.clientX - drag.x0)) return;
        drag.moved = true;
        rail.setPointerCapture(e.pointerId);
        rail.classList.add('is-dragging');
      }
      rail.scrollLeft = dragTarget(drag.s0, drag.x0, e.clientX, maxScroll(rail));
    };
    const onUp = (e: PointerEvent) => {
      if (!drag || e.pointerId !== drag.id) return;
      if (drag.moved) {
        swallow = true;
        window.setTimeout(() => (swallow = false), 0);
        if (rail.hasPointerCapture(e.pointerId)) rail.releasePointerCapture(e.pointerId);
      }
      rail.classList.remove('is-dragging');
      drag = null;
    };
    const onClick = (e: MouseEvent) => {
      if (!swallow) return;
      e.preventDefault();
      e.stopPropagation();
    };
    // A link or a picture would start the browser's own drag-and-drop and cut
    // the pointer events off.
    const onDragStart = (e: Event) => e.preventDefault();
    rail.addEventListener('pointerdown', onDown);
    rail.addEventListener('pointermove', onMove);
    rail.addEventListener('pointerup', onUp);
    rail.addEventListener('pointercancel', onUp);
    rail.addEventListener('click', onClick, true);
    rail.addEventListener('dragstart', onDragStart);

    return () => {
      stepRef.current = null;
      ro.disconnect();
      rail.removeEventListener('scroll', onScroll);
      rail.removeEventListener('keydown', onKey);
      rail.removeEventListener('pointerdown', onDown);
      rail.removeEventListener('pointermove', onMove);
      rail.removeEventListener('pointerup', onUp);
      rail.removeEventListener('pointercancel', onUp);
      rail.removeEventListener('click', onClick, true);
      rail.removeEventListener('dragstart', onDragStart);
      rail.classList.remove('is-dragging');
    };
  }, []);

  return (
    <div ref={ctlRef} className="h-types__ctl" data-motion="rail-ctl">
      {ready ? (
        <>
          <button
            type="button"
            className="h-ring h-types__btn h-types__btn--prev"
            aria-label={prev}
            aria-disabled={ends.start}
            onClick={() => {
              if (!ends.start) stepRef.current?.(-1);
            }}
          >
            <Arrow />
          </button>
          <button
            type="button"
            className="h-ring h-types__btn"
            aria-label={next}
            aria-disabled={ends.end}
            onClick={() => {
              if (!ends.end) stepRef.current?.(1);
            }}
          >
            <Arrow />
          </button>
        </>
      ) : null}
    </div>
  );
}
