import { useEffect, useRef, useState, type RefObject } from 'react';

/**
 * THE DRAWING STAYS IN VIEW BESIDE THE FORM - at the height of the window it is in.
 *
 * On a wide screen the form is in one column and the answer in the other, and what stays in view in the answer's is its pin: the title, the drawing with its
 * notes and legend, and the sentence that reads it. That block is some 640 to 700 px tall, and a laptop's browser window is 657 px (a 1366 × 768 screen) or 730
 * (a 1920 × 1080 screen at 125 %) once the header is taken off: a pin that does not fit under the header is let go, and the drawing was never in view where the
 * form is filled in. So the pin is sized to the window:
 *
 *   'pinned'   the drawing is made as tall as the window leaves room for (down to MIN_FIGURE), and everything stays in the pin;
 *   'drawing'  the sentence that reads the drawing leaves the pin (it stays under it and scrolls away with the page), and the drawing takes its room;
 *   'free'     even so the drawing would be under MIN_FIGURE: it is not pinned, and scrolls with the page, drawn at its full height.
 *
 * The rule is a pure function of five measures, so that it can be run without a browser; the hook measures them and applies it.
 */

/** The shortest a pinned drawing is made: under this a structure of a dozen nodes cannot be read. */
export const MIN_FIGURE = 300;
/** The height the drawing has when it is not held down (layout.ts MAX_HEIGHT). */
export const MAX_FIGURE = 560;
/** Room left under the pin, px. */
export const PIN_BOTTOM = 8;
/** The drawing's height is asked for in steps of this, so that a window dragged to another size does not draw it again at every pixel. */
export const FIGURE_STEP = 10;

export type PinMode = 'pinned' | 'drawing' | 'free';
export interface PinFit {
  mode: PinMode;
  /** The tallest the drawing may be (px), or null for no limit but its own. */
  cap: number | null;
}

export interface PinMeasure {
  /** The window's height, and where the pin sticks (px from the top of the window: the header and a gap). */
  windowHeight: number;
  top: number;
  /** The pin as laid out now, and the part of it that is the drawing itself (its box, with its scrollbar). */
  pinHeight: number;
  figureHeight: number;
  /** The sentence that reads the drawing (with its lines), wherever it is now, and whether it is inside the pin. */
  sayingHeight: number;
  sayingInside: boolean;
}

const capOf = (room: number): number | null => (room >= MAX_FIGURE ? null : Math.floor(room / FIGURE_STEP) * FIGURE_STEP);

/** How the pin is sized to the window: the mode, and the tallest the drawing may be. */
export function fitPin(m: PinMeasure): PinFit {
  const room = m.windowHeight - m.top - PIN_BOTTOM;
  // Whatever is neither the drawing nor the sentence: the title, the notes under the drawing, its legend.
  const base = m.pinHeight - m.figureHeight - (m.sayingInside ? m.sayingHeight : 0);
  // A drawing that is shorter than MIN_FIGURE by its own shape (a wide, flat structure) is not made any shorter: it needs the room it has.
  const needed = Math.min(MIN_FIGURE, m.figureHeight);
  const withSaying = room - base - m.sayingHeight;
  if (withSaying >= needed) return { mode: 'pinned', cap: capOf(withSaying) };
  const alone = room - base;
  if (alone >= needed) return { mode: 'drawing', cap: capOf(alone) };
  return { mode: 'free', cap: null };
}

const RANK: Record<PinMode, number> = { pinned: 0, drawing: 1, free: 2 };

/**
 * The fit to keep when a new one was reckoned for the SAME window and the same drawing: it may only tighten. The notes under a drawing grow as the drawing is
 * made smaller (a word left off, a line to say so), so a fit that loosened again would draw the figure large, find no room, draw it small, and go round for ever.
 * A different window or a different drawing starts over (the caller gives the new fit as it is).
 */
export function tighten(held: PinFit, next: PinFit): PinFit {
  if (RANK[next.mode] > RANK[held.mode]) return next;
  if (RANK[next.mode] < RANK[held.mode]) return held;
  if (next.mode === 'free') return held;
  const a = held.cap;
  const b = next.cap;
  // (null is no limit): the lower limit wins, and a change of a few pixels is not a change.
  if (b === null) return held;
  if (a === null) return next;
  return b < a - 4 ? next : held;
}

/** Whether `b` is a looser fit than `a`: a less constrained mode, or the same with a higher limit (no limit being the highest). */
export function looser(a: PinFit, b: PinFit): boolean {
  if (RANK[b.mode] !== RANK[a.mode]) return RANK[b.mode] < RANK[a.mode];
  if (b.mode === 'free') return false;
  if (b.cap === null) return a.cap !== null;
  return a.cap !== null && b.cap > a.cap + 4;
}

/** Whether two fits are the same: the same mode, and a limit within a few pixels (none is none). */
export function sameFit(a: PinFit, b: PinFit): boolean {
  if (a.mode !== b.mode) return false;
  if (a.mode === 'free') return true;
  if (a.cap === null || b.cap === null) return a.cap === b.cap;
  return Math.abs(a.cap - b.cap) <= 4;
}

/** The most times a fit may be changed in one window by a pin that has settled, and the most looks asked for in a row of a pin that is still changing. */
export const PIN_CHANGES = 4;
export const PIN_LOOKS = 8;

/** What the page keeps between measures: the window it is of, the fit, how the pin looked when last measured, and how often the fit was changed and a look asked for. */
export interface PinHeld {
  env: string;
  fit: PinFit;
  last: string;
  changes: number;
  looks: number;
  /** The pin was still changing, or the fit has just been changed: measure again shortly, to see that it has settled. */
  again: boolean;
}

/** A pin measured in the same way twice has stopped changing. */
const looked = (m: PinMeasure): string => `${Math.round(m.pinHeight)}|${Math.round(m.figureHeight)}|${Math.round(m.sayingHeight)}|${m.sayingInside}`;

/**
 * Where the fit goes after a measure. A new window starts it over with the fit the measure gives. After that a measure is believed only when the pin has
 * been measured twice alike - it has stopped changing: the first measures of a page, and the ones taken as a key is typed, are taken while the drawing and its notes
 * are still being laid out (the server's width, a legend not yet wrapped, a line that comes and goes), and a fit reckoned from one of those would put the sentence in
 * the pin and out of it, or let the drawing go, at each key. A fit that was changed is looked at again, and the notes under a drawing grow as the drawing is made
 * smaller: a fit that goes round that way is changed PIN_CHANGES times and then only tightened (it cannot go round for ever), and a pin that is never still is looked
 * at PIN_LOOKS times and left as it was.
 */
export function settleFit(held: PinHeld | null, env: string, m: PinMeasure): PinHeld {
  const next = fitPin(m);
  const last = looked(m);
  if (!held || held.env !== env) return { env, fit: next, last, changes: 0, looks: 0, again: true };
  if (sameFit(held.fit, next)) return { ...held, last, looks: 0, again: false };
  if (last === held.last) {
    // settled, and the fit is not what it should be
    if (held.changes < PIN_CHANGES) return { env, fit: next, last, changes: held.changes + 1, looks: 0, again: true };
    return { ...held, fit: tighten(held.fit, next), last, looks: 0, again: false };
  }
  // still changing: wait for it
  const looks = held.looks + 1;
  return { ...held, last, looks, again: looks < PIN_LOOKS };
}

export const PIN_START: PinFit = { mode: 'pinned', cap: null };

/** The widest window the answer sits beside the form in (stiffness.css): above it the pin sticks. */
const WIDE = '(min-width: 1101px)';

/**
 * Measures the pin and the sentence and sizes the drawing to the window. `drawing` is whatever changes when the drawing does (its object, at each key typed into
 * the form): the pin is measured again a moment after it, and the fit is changed only if the pin has settled to something that needs it (settleFit) - or a figure
 * whose notes come and go as numbers are typed would take the sentence out of the pin and back at each key. A different window starts the fit over. Not on paper,
 * and not where the answer sits under the form.
 */
export function usePinFit(refs: { pin: RefObject<HTMLElement | null>; saying: RefObject<HTMLElement | null> }, drawing: unknown, off: boolean): PinFit {
  const [fit, setFit] = useState<PinFit>(PIN_START);
  const held = useRef<PinHeld | null>(null);
  const soon = useRef<() => void>(() => undefined);
  useEffect(() => {
    const pin = refs.pin.current;
    if (!pin || off || typeof window === 'undefined') {
      held.current = null;
      setFit(PIN_START);
      return;
    }
    const wide = window.matchMedia(WIDE);
    let ro: ResizeObserver | null = null;
    let timer = 0;
    const measure = () => {
      const figure = pin.querySelector<HTMLElement>('.mp-st-fig__scroll');
      const saying = refs.saying.current;
      // (the sentence is another element once it has left the pin, or come back: observing the same one twice does nothing)
      if (saying) ro?.observe(saying);
      if (!wide.matches || !figure) {
        held.current = null;
        setFit((f) => (f === PIN_START ? f : PIN_START));
        return;
      }
      const top = parseFloat(getComputedStyle(pin).top) || 0;
      const m: PinMeasure = {
        windowHeight: window.innerHeight,
        top,
        pinHeight: pin.getBoundingClientRect().height,
        figureHeight: figure.getBoundingClientRect().height,
        sayingHeight: saying ? saying.getBoundingClientRect().height : 0,
        sayingInside: saying ? pin.contains(saying) : false,
      };
      const env = `${m.windowHeight}|${top}|${Math.round(pin.getBoundingClientRect().width)}`;
      const kept = settleFit(held.current, env, m);
      held.current = kept;
      // (a pin that is still changing, or a fit that was just changed: look again in a moment)
      if (kept.again) {
        window.clearTimeout(timer);
        timer = window.setTimeout(measure, 150);
      }
      setFit((f) => (f.mode === kept.fit.mode && f.cap === kept.fit.cap ? f : kept.fit));
    };
    held.current = null;
    const later = () => {
      window.clearTimeout(timer);
      timer = window.setTimeout(measure, 120);
    };
    ro = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(later);
    ro?.observe(pin);
    measure();
    soon.current = later;
    window.addEventListener('resize', later);
    return () => {
      soon.current = () => undefined;
      window.clearTimeout(timer);
      ro?.disconnect();
      window.removeEventListener('resize', later);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [off]);
  // Another drawing: the fit may be changed once more (it may need another room), and the pin is measured when the drawing has been made.
  useEffect(() => {
    if (held.current) held.current = { ...held.current, changes: Math.max(0, held.current.changes - 1), looks: 0 };
    soon.current();
  }, [drawing]);
  return fit;
}
