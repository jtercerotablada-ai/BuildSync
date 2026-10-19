import { describe, expect, it } from 'vitest';
import { FIGURE_STEP, MAX_FIGURE, MIN_FIGURE, PIN_BOTTOM, PIN_CHANGES, PIN_LOOKS, PIN_START, fitPin, looser, sameFit, settleFit, tighten, type PinFit, type PinHeld, type PinMeasure } from './pin-fit';

/**
 * THE DRAWING IS KEPT IN VIEW AT THE HEIGHT OF THE WINDOW, as a rule that takes measures and nothing else. The measures below are the ones read off the real page
 * (the default structure, 1280 to 1920 px wide, headless Chromium): the pin sticks 92 px under the top of the window under the 76 px header (112 under the 96 px
 * one), the pin is 637 px tall at 1280-1366 px with a drawing box of 325-353 px and a sentence of 69 px (+ 8 above it), 694-715 px at 1536-1600 px.
 */

/** A window and the default structure's pin in it, as the page measured it before the drawing was fitted (width: where the pin sticks, the pin, its drawing box, the sentence with the 8 px above it). */
const REAL: Record<number, [top: number, pin: number, figure: number, saying: number]> = {
  1101: [84, 650, 250, 100],
  1280: [92, 637, 325, 77],
  1366: [92, 637, 353, 77],
  1440: [92, 637, 353, 77],
  1536: [112, 694, 410, 77],
  1600: [112, 715, 431, 77],
  1920: [112, 697, 435, 54],
};
function measure(width: number, height: number): PinMeasure {
  const [top, pinHeight, figureHeight, sayingHeight] = REAL[width];
  return { windowHeight: height, top, pinHeight, figureHeight, sayingHeight, sayingInside: true };
}

describe('how the pin is sized to the window', () => {
  it('pins the whole block, drawing and sentence, and holds the drawing to the room there is, where the window is tall enough for the drawing at 300 px or more', () => {
    const fit = fitPin(measure(1366, 768));
    expect(fit.mode).toBe('pinned');
    expect(fit.cap).not.toBeNull();
    expect(fit.cap!).toBeGreaterThanOrEqual(MIN_FIGURE);
    // the pin it makes is no taller than the window leaves: header (92) + the drawing + everything else (207 + the sentence's 77) + the bottom gap
    const m = measure(1366, 768);
    const base = m.pinHeight - m.figureHeight - m.sayingHeight;
    expect(m.top + fit.cap! + base + m.sayingHeight + PIN_BOTTOM).toBeLessThanOrEqual(768);
  });

  it('leaves the drawing as it is, with no limit, where the window has room for all of it', () => {
    expect(fitPin(measure(1920, 950))).toEqual({ mode: 'pinned', cap: null });
    expect(fitPin(measure(1600, 1200))).toEqual({ mode: 'pinned', cap: null });
  });

  it('lets the sentence leave the pin where the window has room for the drawing at 300 px but not for the drawing and the sentence', () => {
    // 1366 x 657 is what a 1366 x 768 laptop gives the page; 1536 x 730 is a 1920 x 1080 screen at 125 %.
    for (const [w, h] of [[1366, 657], [1280, 650], [1101, 700]] as const) {
      const fit = fitPin(measure(w, h));
      expect(fit.mode, `${w}x${h}`).toBe('drawing');
      expect(fit.cap!, `${w}x${h}`).toBeGreaterThanOrEqual(MIN_FIGURE);
    }
    const f = fitPin(measure(1536, 730));
    expect(['pinned', 'drawing']).toContain(f.mode);
    expect(f.cap!).toBeGreaterThanOrEqual(MIN_FIGURE);
  });

  it('does not pin where even the drawing alone cannot be 300 px tall (it scrolls with the page, drawn at its own height)', () => {
    for (const [w, h] of [[1280, 600], [1101, 600]] as const) {
      expect(fitPin(measure(w, h)), `${w}x${h}`).toEqual({ mode: 'free', cap: null });
    }
  });

  it('every window from 1101 x 600 to 1920 x 1080 gets a pin that fits it, or no pin, and never a drawing under 300 px', () => {
    for (let h = 560; h <= 1100; h += 10) {
      for (const w of [1101, 1280, 1366, 1440, 1536, 1600, 1920]) {
        const m = measure(w, h);
        const fit = fitPin(m);
        const label = `${w}x${h}`;
        if (fit.mode === 'free') {
          expect(fit.cap, label).toBeNull();
          continue;
        }
        const figure = fit.cap ?? MAX_FIGURE;
        // (the drawing is never made shorter than 300 px, but for the ones that are shorter by their own shape - 250 px at 1101 px wide - and those are not made shorter)
        expect(figure, label).toBeGreaterThanOrEqual(Math.min(MIN_FIGURE, m.figureHeight));
        const base = m.pinHeight - m.figureHeight - m.sayingHeight;
        const pin = base + figure + (fit.mode === 'pinned' ? m.sayingHeight : 0);
        expect(m.top + pin + PIN_BOTTOM, label).toBeLessThanOrEqual(h);
      }
    }
  });

  it('asks for the drawing\'s height in steps, so that a window dragged to another size does not draw it again at every pixel', () => {
    const caps = new Set<number | null>();
    for (let h = 700; h < 760; h++) caps.add(fitPin(measure(1366, h)).cap);
    expect(caps.size).toBeLessThanOrEqual(Math.ceil(60 / FIGURE_STEP) + 1);
    for (const c of caps) if (c !== null) expect(c % FIGURE_STEP).toBe(0);
  });

  it('does not make a drawing shorter than 300 px by its own shape any shorter, and pins it where it fits as it is', () => {
    // 1101 px wide: the default structure is 250 px tall there, whatever the window. Pin 650 px: 84 + 650 + 8 does not fit 700 px; 84 + 550 (no sentence) + 8 does.
    expect(fitPin(measure(1101, 700)).mode).toBe('drawing');
    expect(fitPin(measure(1101, 650)).mode).toBe('drawing');
    // …the drawing would be 258 px at most, and is 250 as it is: it fits, it is not capped below what it is
    expect(fitPin(measure(1101, 650)).cap!).toBeGreaterThanOrEqual(250);
    expect(fitPin(measure(1101, 600))).toEqual({ mode: 'free', cap: null });
  });

  it('is the same whether the sentence is in the pin or under it when it is measured (the answer does not depend on where it stands now)', () => {
    const inside = measure(1366, 657);
    // the same pin with the sentence taken out of it: 77 px shorter
    const outside: PinMeasure = { ...inside, pinHeight: inside.pinHeight - inside.sayingHeight, sayingInside: false };
    expect(fitPin(outside)).toEqual(fitPin(inside));
    const tall = measure(1366, 768);
    expect(fitPin({ ...tall, pinHeight: tall.pinHeight - tall.sayingHeight, sayingInside: false })).toEqual(fitPin(tall));
  });
});

describe('a fit that is kept for the same window and drawing may only tighten', () => {
  const pinned = (cap: number | null): PinFit => ({ mode: 'pinned', cap });
  it('takes the more constrained mode, and never goes back to a looser one', () => {
    expect(tighten(pinned(400), { mode: 'drawing', cap: 320 })).toEqual({ mode: 'drawing', cap: 320 });
    expect(tighten({ mode: 'drawing', cap: 320 }, pinned(380))).toEqual({ mode: 'drawing', cap: 320 });
    expect(tighten({ mode: 'drawing', cap: 320 }, { mode: 'free', cap: null })).toEqual({ mode: 'free', cap: null });
    expect(tighten({ mode: 'free', cap: null }, pinned(500))).toEqual({ mode: 'free', cap: null });
  });

  it('takes the lower limit of the same mode, treats no limit as the loosest, and ignores a change of a few pixels', () => {
    expect(tighten(pinned(null), pinned(420))).toEqual(pinned(420));
    expect(tighten(pinned(420), pinned(null))).toEqual(pinned(420));
    expect(tighten(pinned(420), pinned(380))).toEqual(pinned(380));
    expect(tighten(pinned(380), pinned(420))).toEqual(pinned(380));
    expect(tighten(pinned(420), pinned(418))).toEqual(pinned(420));
  });

  it('settles a window where drawing the figure smaller adds a note under it, instead of going round for ever', () => {
    // The notes under a drawing grow as it is made smaller: under 340 px a word is left off and a line says so (36 px more). Reckoned afresh each time, the fit
    // loosens (the figure was drawn large and found no room), tightens (drawn small, the note came), loosens (...): the loop below is that, with and without `tighten`.
    const window = { windowHeight: 700, top: 92 };
    const pin = (figure: number): PinMeasure => ({ ...window, figureHeight: figure, pinHeight: 207 + figure + 77 + (figure < 340 ? 36 : 0), sayingHeight: 77, sayingInside: true });
    // …without: it never settles.
    let fit = PIN_START;
    let figure = 353;
    const seen: string[] = [];
    for (let k = 0; k < 12; k++) {
      fit = fitPin(pin(figure));
      seen.push(`${fit.mode}/${fit.cap}`);
      figure = Math.min(fit.cap ?? MAX_FIGURE, 353);
    }
    expect(new Set(seen.slice(4)).size).toBeGreaterThan(1);
    // …with: a fixed point in a few rounds.
    let held: PinFit = PIN_START;
    figure = 353;
    const kept: string[] = [];
    for (let k = 0; k < 12; k++) {
      held = k === 0 ? fitPin(pin(figure)) : tighten(held, fitPin(pin(figure)));
      kept.push(`${held.mode}/${held.cap}`);
      figure = Math.min(held.cap ?? MAX_FIGURE, 353);
    }
    expect(new Set(kept.slice(4)).size).toBe(1);
  });
});

describe('the fit kept between measures', () => {
  const ENV = '650|92|600';
  const M = (pin: number, figure: number, inside = true, saying = 100, win = 650): PinMeasure => ({ windowHeight: win, top: 92, pinHeight: pin, figureHeight: figure, sayingHeight: saying, sayingInside: inside });
  /** The 12-node structure at 1280 x 650, as the page measured it in the order it happened (the first measures are of a page still laying itself out). */
  const seq: PinMeasure[] = [M(649, 315), M(619, 359, false), M(606, 245), M(606, 245), M(606, 245)];
  const run = (measures: PinMeasure[], from: PinHeld | null = null, env = ENV): PinHeld[] => {
    const out: PinHeld[] = [];
    let held = from;
    for (const m of measures) {
      held = settleFit(held, env, m);
      out.push(held);
    }
    return out;
  };

  it('believes a measure only when the pin has been measured twice alike: a fit reckoned from a page that was still laying itself out is mended once it has stopped changing', () => {
    const r = run(seq);
    // (the second measure said "free" for a moment, and was not believed: the pin that settled has the sentence under it and the drawing at its own height)
    expect(fitPin(seq[1]).mode).toBe('free');
    expect(r.map((h) => h.fit.mode)).toEqual(['drawing', 'drawing', 'drawing', 'drawing', 'drawing']);
    expect(r.map((h) => h.fit.cap)).toEqual([310, 310, 310, 280, 280]);
    // the first look at a window is taken, and looked at again to see that the pin has settled
    expect(r[0].again).toBe(true);
    expect(r[1].again).toBe(true);
    expect(r[4].again).toBe(false);
  });

  it('a key typed into the form does not take the sentence out of the pin and back: a measure taken while the figure is being laid out again is not believed', () => {
    // a settled pin on a 1366 x 657 window; the sentence is out of the pin
    const settled = M(560, 350, false, 77, 657);
    const held0 = run([settled, settled, settled], null, '657|92|600')[2];
    expect(held0.fit.mode).toBe('drawing');
    const kept = held0.fit;
    // the key: the figure is drawn again, for a moment taller with a note, and for a moment short of one
    const during = [M(640, 353, false, 77, 657), M(500, 330, false, 77, 657), settled, settled];
    expect(fitPin(during[0]).mode).toBe('free');
    expect(fitPin(during[1]).mode).toBe('pinned');
    const r = run(during, held0, '657|92|600');
    for (const h of r) expect(h.fit).toEqual(kept);
    expect(r[0].again).toBe(true);
    expect(r[3].again).toBe(false);
  });

  it('a window that really is another size, once the pin has settled in it, gets the fit it needs', () => {
    const tall = run([M(606, 245, true, 100, 720), M(606, 245, true, 100, 720)], null, '720|92|600');
    expect(tall[1].fit.mode).toBe('pinned');
    // dragged shorter: the window is another (a new start); a first look is taken as it is, and the pin that settles keeps it
    const short = run([M(606, 245, true, 100, 600), M(606, 245, true, 100, 600), M(606, 245, true, 100, 600)], tall[1], '600|92|600');
    expect(short[2].fit).toEqual({ mode: 'free', cap: null });
    expect(short[0].changes).toBe(0);
  });

  it('goes round for ever without a limit, and settles with it: the drawing large, no room, the drawing small, a note, no room, large again', () => {
    // under 340 px a word is left off and a line says so: 36 px more under the drawing. A 700 px high window.
    const pin = (figure: number): PinMeasure => ({ windowHeight: 700, top: 92, figureHeight: figure, pinHeight: 207 + figure + 77 + (figure < 340 ? 36 : 0), sayingHeight: 77, sayingInside: true });
    let held: PinHeld | null = null;
    let figure = 353;
    const seen: string[] = [];
    for (let k = 0; k < 40; k++) {
      held = settleFit(held, ENV, pin(figure));
      seen.push(`${held.fit.mode}/${held.fit.cap}`);
      figure = Math.min(held.fit.cap ?? MAX_FIGURE, 353);
    }
    // the last twenty looks are of one fit, and the pin is no longer changed
    expect(new Set(seen.slice(20)).size).toBe(1);
    expect(held!.changes).toBeLessThanOrEqual(PIN_CHANGES);
    expect(held!.again).toBe(false);
  });

  it('a pin that is never still is looked at a few times and left as it was, not for ever', () => {
    let held: PinHeld | null = settleFit(null, ENV, M(600, 300));
    const first = held.fit;
    let run = 0;
    let longest = 0;
    for (let k = 0; k < 30; k++) {
      // every look is of a pin of another height, and says another fit
      held = settleFit(held, ENV, M(560 + k * 13, 280 + k * 9, k % 2 === 0));
      run = held.again ? run + 1 : 0;
      longest = Math.max(longest, run);
    }
    expect(longest).toBeLessThanOrEqual(PIN_LOOKS);
    expect(held.fit).toEqual(first);
  });

  it('only tightens once it has been changed as often as it may be', () => {
    let held: PinHeld = { env: ENV, fit: { mode: 'free', cap: null }, last: 'x', changes: PIN_CHANGES, looks: 0, again: false };
    // settled (the same look twice), and a looser fit is open: not taken
    held = settleFit({ ...held, last: '606|245|100|true' }, ENV, M(606, 245));
    expect(held.fit).toEqual({ mode: 'free', cap: null });
    // …but a tighter one is
    const loose: PinHeld = { env: ENV, fit: { mode: 'pinned', cap: 400 }, last: '606|245|100|true', changes: PIN_CHANGES, looks: 0, again: false };
    expect(settleFit(loose, ENV, M(606, 245, true, 100, 560)).fit.mode).not.toBe('pinned');
  });

  it('knows a looser fit from a tighter one, and the same fit from another within a few pixels', () => {
    expect(looser({ mode: 'free', cap: null }, { mode: 'pinned', cap: 400 })).toBe(true);
    expect(looser({ mode: 'pinned', cap: 400 }, { mode: 'free', cap: null })).toBe(false);
    expect(looser({ mode: 'pinned', cap: 320 }, { mode: 'pinned', cap: 380 })).toBe(true);
    expect(looser({ mode: 'pinned', cap: 320 }, { mode: 'pinned', cap: 322 })).toBe(false);
    expect(looser({ mode: 'pinned', cap: 320 }, { mode: 'pinned', cap: null })).toBe(true);
    expect(looser({ mode: 'pinned', cap: null }, { mode: 'pinned', cap: 320 })).toBe(false);
    expect(sameFit({ mode: 'pinned', cap: 320 }, { mode: 'pinned', cap: 324 })).toBe(true);
    expect(sameFit({ mode: 'pinned', cap: 320 }, { mode: 'pinned', cap: 330 })).toBe(false);
    expect(sameFit({ mode: 'pinned', cap: null }, { mode: 'pinned', cap: 330 })).toBe(false);
    expect(sameFit({ mode: 'free', cap: null }, { mode: 'free', cap: null })).toBe(true);
    expect(sameFit({ mode: 'free', cap: null }, { mode: 'drawing', cap: 300 })).toBe(false);
    expect(PIN_START).toEqual({ mode: 'pinned', cap: null });
  });
});
