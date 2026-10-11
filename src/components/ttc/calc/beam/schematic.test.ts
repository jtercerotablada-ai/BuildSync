import { createElement as h } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { analyse, defaultBeam, type BeamForm } from '@/lib/calc/beam/model';
import type { BeamReaction } from '@/lib/calc/beam/solver';
import { BeamPlot, pointerX, xToPx, type PlotPoint } from './BeamPlot';
import { BeamSchematic } from './BeamSchematic';

/**
 * THE DRAWING OF THE BEAM: where a reaction is drawn.
 *
 * A reaction is a force at a support, so its arrow stands on the support's
 * own line — not beside it, as it did when the arrow was a character of a
 * centred label. Its value goes beside the arrow, on the side that has room.
 */

const WIDTH = 700;
const draw = (form: BeamForm, reactions: BeamReaction[] | null) => renderToStaticMarkup(h(BeamSchematic, { form, reactions, width: WIDTH, probeX: null, summary: 'a beam' }));
const attr = (tag: string, name: string) => Number(tag.match(new RegExp(` ${name}="([^"]*)"`))?.[1]);
/** Each reaction of the drawing: its arrow's line, its head, and what is written beside it. */
const marks = (svg: string) =>
  [...svg.matchAll(/<g class="mp-beam__reaction">([\s\S]*?)<\/g>/g)].map((m) => {
    const line = m[1].match(/<line[^>]*>/)?.[0];
    const headPoints = m[1].match(/<polygon class="mp-beam__head" points="([^"]*)"/)?.[1];
    const texts = [...m[1].matchAll(/<text x="([^"]*)" y="([^"]*)" text-anchor="([^"]*)">([^<]*)<\/text>/g)].map((t) => ({ x: Number(t[1]), y: Number(t[2]), anchor: t[3], text: t[4] }));
    return {
      x: line ? attr(line, 'x1') : null,
      straight: line ? attr(line, 'x1') === attr(line, 'x2') : null,
      // The head's first point is its tip; the other two are its base.
      tip: headPoints ? headPoints.split(' ')[0].split(',').map(Number) : null,
      base: headPoints ? Number(headPoints.split(' ')[1].split(',')[1]) : null,
      texts,
    };
  });
const reactionsOf = (form: BeamForm) => analyse(form).solution!.reactions;

describe('beam drawing: a reaction is an arrow on its support', () => {
  it('the example beam: each arrow on its support’s line, pointing up at it, the value on the inside', () => {
    const form = defaultBeam();
    const got = marks(draw(form, reactionsOf(form)));
    expect(got).toHaveLength(2);
    const [left, right] = got;
    // On the very x of the support — the apex of its triangle.
    expect(left.x).toBe(xToPx(0, form.L, WIDTH));
    expect(right.x).toBe(xToPx(form.L, form.L, WIDTH));
    for (const r of got) {
      expect(r.straight).toBe(true);
      expect(r.tip![0]).toBe(r.x);
      // Upward: the tip is above the base of the head.
      expect(r.tip![1]).toBeLessThan(r.base!);
    }
    // The value: no arrow character in it any more, and beside the arrow, towards the span.
    expect(left.texts.map((t) => t.text)).toEqual(['15.2']);
    expect(left.texts[0].anchor).toBe('start');
    expect(left.texts[0].x).toBeGreaterThan(left.x!);
    expect(right.texts.map((t) => t.text)).toEqual(['16.8']);
    expect(right.texts[0].anchor).toBe('end');
    expect(right.texts[0].x).toBeLessThan(right.x!);
  });

  it('a support inside the beam has its value to the right of its arrow', () => {
    const form: BeamForm = { ...defaultBeam(), L: 24, supports: [{ id: 1, kind: 'pin', x: 0 }, { id: 2, kind: 'roller', x: 16 }] };
    const got = marks(draw(form, reactionsOf(form)));
    expect(got[1].x).toBe(xToPx(16, 24, WIDTH));
    expect(got[1].texts[0].anchor).toBe('start');
  });

  it('the side is decided by where the support is, not by how long its number is', () => {
    // The last support of a beam: its value goes inside whether it is "16" or "1,234.5".
    const form = defaultBeam();
    for (const Rv of [16, 1234.5, 0.004]) {
      const [left, right] = marks(draw(form, [{ x: 0, kind: 'pin', Rv, Rm: 0 }, { x: 20, kind: 'roller', Rv, Rm: 0 }]));
      expect(left.texts[0].anchor, String(Rv)).toBe('start');
      expect(right.texts[0].anchor, String(Rv)).toBe('end');
    }
    // …at any width of the drawing.
    for (const width of [300, 330, 520, 760, 1200]) {
      const svg = renderToStaticMarkup(h(BeamSchematic, { form, reactions: [{ x: 0, kind: 'pin', Rv: 16, Rm: 0 }, { x: 20, kind: 'roller', Rv: 16, Rm: 0 }], width, probeX: null, summary: 'a beam' }));
      expect(marks(svg).map((r) => r.texts[0].anchor), String(width)).toEqual(['start', 'end']);
    }
  });

  it('a reaction that pulls down points down', () => {
    // An overhang loaded at its tip lifts the far support.
    const form: BeamForm = { ...defaultBeam(), L: 24, supports: [{ id: 1, kind: 'pin', x: 0 }, { id: 2, kind: 'roller', x: 16 }], dists: [], points: [{ id: 3, x: 24, P: 10, dir: 'down' }] };
    const reactions = reactionsOf(form);
    expect(reactions[0].Rv).toBeLessThan(0);
    const [left, right] = marks(draw(form, reactions));
    expect(left.tip![1]).toBeGreaterThan(left.base!);
    expect(right.tip![1]).toBeLessThan(right.base!);
    expect(left.texts[0].text).toBe('5');
    expect(right.texts[0].text).toBe('15');
  });

  it('a fixed support: the force by its arrow, and its moment under the force with the way it turns', () => {
    const form: BeamForm = { ...defaultBeam(), supports: [{ id: 1, kind: 'fixed', x: 0 }], dists: [], points: [{ id: 3, x: 20, P: 10, dir: 'down' }] };
    const [wall] = marks(draw(form, reactionsOf(form)));
    expect(wall.x).toBe(xToPx(0, form.L, WIDTH));
    expect(wall.texts.map((t) => t.text)).toEqual(['10', '↺ 200']);
    expect(wall.texts[1].y).toBeGreaterThan(wall.texts[0].y);
    expect(new Set(wall.texts.map((t) => `${t.x} ${t.anchor}`)).size).toBe(1);
  });

  it('no force, no arrow: the value alone, under the support', () => {
    const form = defaultBeam();
    const [left, right] = marks(draw(form, [{ x: 0, kind: 'pin', Rv: 0, Rm: 0 }, { x: 20, kind: 'roller', Rv: 32, Rm: 0 }]));
    expect(left.x).toBeNull();
    expect(left.tip).toBeNull();
    expect(left.texts).toEqual([expect.objectContaining({ text: '0', anchor: 'middle', x: xToPx(0, form.L, WIDTH) })]);
    expect(right.x).toBe(xToPx(20, form.L, WIDTH));
  });

  it('supports crowded together keep every arrow, and write only the values that fit', () => {
    const form: BeamForm = { ...defaultBeam(), supports: [{ id: 1, kind: 'pin', x: 0 }, { id: 2, kind: 'roller', x: 0.3 }, { id: 3, kind: 'roller', x: 0.6 }, { id: 4, kind: 'roller', x: 20 }] };
    const got = marks(draw(form, reactionsOf(form)));
    expect(got.filter((r) => r.x !== null)).toHaveLength(4);
    // What is written does not run into another value, nor into an arrow.
    const spans = got.flatMap((r) => r.texts.map((t) => (t.anchor === 'start' ? [t.x, t.x + t.text.length * 6.9] : [t.x - t.text.length * 6.9, t.x])));
    const arrows = got.map((r) => r.x!);
    for (const [a, b] of spans) {
      expect(a).toBeGreaterThanOrEqual(0);
      expect(b).toBeLessThanOrEqual(WIDTH);
      expect(arrows.filter((x) => x > a && x < b)).toEqual([]);
    }
    spans.sort((p, q) => p[0] - q[0]);
    for (let i = 1; i < spans.length; i++) expect(spans[i][0]).toBeGreaterThanOrEqual(spans[i - 1][1]);
    expect(spans.length).toBeLessThan(4);
  });

  it('before the beam is solved there is no reaction to draw', () => {
    expect(marks(draw(defaultBeam(), null))).toEqual([]);
  });

  // Four supports on a phone, each with a value of five characters: two
  // neighbours' values, both written on the line beside their arrows, miss
  // each other by 2 px. One of them used to go unwritten — the last
  // support's, which can only write inside. Now one of the two goes a line
  // lower, as long as it ends before the other begins. A value that would lie
  // under its neighbour's, or over it, is left to the table instead: of two
  // numbers stacked between two arrows nobody could say which was whose.
  describe('a reaction has its value where there is room for it beside its own arrow, and nowhere else', () => {
    /** A beam on supports at these places under 1.2 kip/ft, or under what is given. */
    const on = (L: number, at: number[], loads: Partial<BeamForm> = {}): BeamForm => ({
      ...defaultBeam(),
      L,
      supports: at.map((x, i) => ({ id: i + 1, kind: i ? 'roller' : 'pin', x })),
      points: [],
      dists: [{ id: 99, x1: 0, x2: L, w1: 1.2, w2: 1.2, dir: 'down' }],
      ...loads,
    });
    const THREE_SPANS = on(60, [0, 20, 40, 60], { dists: [{ id: 99, x1: 0, x2: 60, w1: 2.156, w2: 2.156, dir: 'down' }] });
    const FOUR_SPANS = on(80, [0, 20, 40, 60, 80], { points: [{ id: 90, x: 30, P: 10, dir: 'down' }] });
    const FIVE_SPANS = on(100, [0, 20, 40, 60, 80, 100]);
    const FIVE_UNEVEN = on(100, [0, 12, 40, 55, 90, 100], { points: [{ id: 90, x: 30, P: 10, dir: 'down' }, { id: 91, x: 70, P: 15, dir: 'down' }] });
    const drawer = (form: BeamForm) => {
      const reactions = reactionsOf(form);
      return (width: number) => marks(renderToStaticMarkup(h(BeamSchematic, { form, reactions, width, probeX: null, summary: 'a beam' })));
    };
    const at = drawer(THREE_SPANS);
    const LINES = [166, 180]; // the baseline of the line beside an arrow, and of the one under it
    /** Each value's box: whose it is, its two ends and the line it is written on. */
    const boxes = (got: ReturnType<typeof marks>) =>
      got.flatMap((r, of) => r.texts.map((t) => ({ of, a: t.anchor === 'start' ? t.x : t.x - t.text.length * 6.9, b: t.anchor === 'start' ? t.x + t.text.length * 6.9 : t.x, y: t.y, text: t.text })));
    /** What is wrong with the reactions of a drawing, if anything: every value written can be told from every other, and belongs to one arrow. */
    const wrong = (got: ReturnType<typeof marks>, width: number): string[] => {
      const found: string[] = [];
      const all = boxes(got);
      for (const p of all) {
        if (!LINES.includes(p.y)) found.push(`"${p.text}" is on a third line, at ${p.y}`);
        if (p.a < 0 || p.b > width) found.push(`"${p.text}" runs past the side: ${p.a} to ${p.b} of ${width}`);
        // Beside its own arrow: 9 from it, on one side or the other.
        if (Math.abs(Math.min(Math.abs(p.a - got[p.of].x!), Math.abs(p.b - got[p.of].x!)) - 9) > 1e-9) found.push(`"${p.text}" is not beside its own arrow at ${got[p.of].x}: ${p.a} to ${p.b}`);
        for (const r of got) if (r.x! > p.a - 3 && r.x! < p.b + 3) found.push(`"${p.text}" is on the arrow at ${r.x}`);
        for (const q of all) {
          if (q.of <= p.of) continue;
          // On one line, 3 px between two values; on two lines, one ends before the other begins.
          const apart = Math.max(q.a - p.b, p.a - q.b);
          if (apart < (q.y === p.y ? 3 : 0) - 1e-6) found.push(`"${p.text}" of support ${p.of + 1} and "${q.text}" of support ${q.of + 1}, on ${q.y === p.y ? 'one line' : 'two lines'}: ${apart} apart`);
        }
      }
      return found;
    };

    it('the values are five characters each: 0.4 and 1.1 of 2.156 kip/ft over 20 ft', () => {
      expect(at(700).map((r) => r.texts.map((t) => t.text))).toEqual([['17.25'], ['47.43'], ['47.43'], ['17.25']]);
    });

    for (const width of [328, 358, 420, 700]) {
      it(`${width} px: four arrows, four values, none on another and none on an arrow`, () => {
        const got = at(width);
        expect(got.map((r) => r.texts.length)).toEqual([1, 1, 1, 1]);
        // The ends write inside; the others beside their own arrow.
        expect(got[0].texts[0].anchor).toBe('start');
        expect(got[3].texts[0].anchor).toBe('end');
        expect(wrong(got, width)).toEqual([]);
      });
    }

    it('with room for all on one line, all are on one line', () => {
      for (const width of [358, 420, 700]) expect(boxes(at(width)).map((p) => p.y), String(width)).toEqual([166, 166, 166, 166]);
    });

    it('328 px, where two values miss each other by 2 px: four values on two lines, the lower one ending before its neighbour begins', () => {
      const got = at(328);
      const [, , third, last] = boxes(got);
      expect(boxes(got).map((p) => p.y)).toEqual([166, 166, 180, 166]);
      // Still to the right of its own arrow, 9 from it — and 2.3 px short of the last support's value, which is why it is not on its line.
      expect(got[2].texts[0].anchor).toBe('start');
      expect(got[2].texts[0].x - got[2].x!).toBeCloseTo(9, 9);
      expect(last.a - third.b).toBeGreaterThan(0);
      expect(last.a - third.b).toBeLessThan(3);
    });

    it('300 px, where it would lie under its neighbour’s: three values, none over another, and the fourth left to the table', () => {
      const got = at(300);
      expect(got.map((r) => r.x)).toEqual([0, 20, 40, 60].map((x) => xToPx(x, 60, 300)));
      expect(got.map((r) => r.texts.map((t) => t.text))).toEqual([['17.25'], ['47.43'], [], ['17.25']]);
      expect(boxes(got).map((p) => p.y)).toEqual([166, 166, 166]);
      expect(wrong(got, 300)).toEqual([]);
    });

    it('the end supports are placed first: the value left out is one between them, never the last support’s', () => {
      // Placed left to right, the support before the last took the only place the last one has.
      expect(at(300).map((r) => r.texts.length)).toEqual([1, 1, 0, 1]);
      const four = drawer(FOUR_SPANS)(328);
      expect(four.map((r) => r.texts.map((t) => t.text))).toEqual([['8.692'], ['33.1'], ['28.36'], [], ['9.629']]);
      expect(four[4].texts[0].anchor).toBe('end');
    });

    it('no two supports’ values overlap in x, on any lines: four and five spans at widths from 280 to 420 px', () => {
      const found: string[] = [];
      let lower = 0;
      let left = 0;
      for (const [name, form] of Object.entries({ 'four spans': FOUR_SPANS, 'five spans': FIVE_SPANS, 'five uneven spans': FIVE_UNEVEN })) {
        const draw = drawer(form);
        for (let width = 280; width <= 420; width += 2) {
          const got = draw(width);
          // Every arrow is drawn, whatever is written.
          if (got.some((r) => r.x === null) || got.length !== form.supports.length) found.push(`${name} at ${width} px: an arrow is missing`);
          found.push(...wrong(got, width).map((f) => `${name} at ${width} px: ${f}`));
          const all = boxes(got);
          for (const p of all) for (const q of all) if (q.of > p.of && Math.min(p.b, q.b) - Math.max(p.a, q.a) > 1e-6) found.push(`${name} at ${width} px: "${p.text}" and "${q.text}" share ${Math.min(p.b, q.b) - Math.max(p.a, q.a)} px`);
          lower += all.filter((p) => p.y === 180).length;
          left += got.filter((r) => !r.texts.length).length;
        }
      }
      expect(found).toEqual([]);
      // Both happen in these drawings: a value a line lower, and a value left to the table.
      expect(lower).toBeGreaterThan(0);
      expect(left).toBeGreaterThan(0);
    }, 30_000);

    it('the turning arrow of a wall’s moment is wider than a digit, and is measured so', () => {
      // One foot is one pixel. "↺ 78.8" is 43.8 px at 7.3 a character (41.4 at a digit's 6.9): with the 9 it stands
      // from its own arrow, the 3 it keeps and the 6 of the next arrow, 61.8 px. At 62 px it is written; at 60 it is not.
      const wall = (roller: number) => {
        const form = on(640, [], { supports: [{ id: 1, kind: 'pin', x: 0 }, { id: 2, kind: 'roller', x: roller }, { id: 3, kind: 'fixed', x: 640 }] });
        return marks(draw(form, [{ x: 0, kind: 'pin', Rv: 5, Rm: 0 }, { x: roller, kind: 'roller', Rv: 5, Rm: 0 }, { x: 640, kind: 'fixed', Rv: 12.5, Rm: 78.8 }]))[2];
      };
      expect(wall(578).texts.map((t) => [t.text, t.anchor])).toEqual([['12.5', 'end'], ['↺ 78.8', 'end']]);
      expect(wall(580).texts).toEqual([]);
    });
  });

  it('a support inside the beam has its value on the right wherever the beam puts it: rounding does not move it', () => {
    // 119.33 + 9 − 3 against 119.33 + 6: on a 12 ft beam 328 px wide the value
    // of the support at 4 ft was "in the way of its own arrow", and went left.
    const wrong: string[] = [];
    for (const width of [300, 328]) {
      for (const L of [12, 24, 50]) {
        for (let x = Math.ceil(0.2 * L); x <= 0.6 * L; x += 1) {
          const form: BeamForm = { ...defaultBeam(), L, supports: [{ id: 1, kind: 'pin', x: 0 }, { id: 2, kind: 'roller', x }, { id: 3, kind: 'roller', x: L }] };
          const svg = renderToStaticMarkup(h(BeamSchematic, { form, reactions: [{ x, kind: 'roller', Rv: 26.9, Rm: 0 }], width, probeX: null, summary: 'a beam' }));
          const [mark] = marks(svg);
          if (mark.texts[0]?.anchor !== 'start') wrong.push(`${width} px, ${L} ft, support at ${x}: ${mark.texts[0]?.anchor ?? 'not written'}`);
        }
      }
    }
    expect(wrong).toEqual([]);
  });
});

/**
 * THE DRAWING OF THE BEAM: the positions written under it.
 *
 * The beam's two ends, its supports and its hinges, each where it is — and
 * where two would run together, one is left out. Never an end: the last
 * number on that line, beside the unit, is read as the length of the beam.
 */
describe('beam drawing: the dimension line', () => {
  const dims = (form: BeamForm, width: number) => [...renderToStaticMarkup(h(BeamSchematic, { form, reactions: null, width, probeX: null, summary: 'a beam' })).match(/<g class="mp-beam__dim">[\s\S]*?<\/g>/)![0].matchAll(/<text[^>]*>([^<]*)<\/text>/g)].map((m) => m[1]);
  const supports = (...at: number[]): BeamForm['supports'] => at.map((x, i) => ({ id: i + 1, kind: i ? 'roller' : 'pin', x }));
  const NEAR_THE_END: BeamForm = { ...defaultBeam(), supports: supports(0, 19, 20) };

  it('a support a foot before the end does not take the end’s label: a 20 ft beam read "0 … 19 ft"', () => {
    for (const width of [280, 300, 328, 358, 382]) expect(dims(NEAR_THE_END, width), String(width)).toEqual(['0', '20', 'ft']);
    // With room for both, both.
    expect(dims(NEAR_THE_END, 700)).toEqual(['0', '19', '20', 'ft']);
    // And at the other end: the support at 0.8 ft gives way to the 0.
    expect(dims({ ...defaultBeam(), supports: supports(0, 0.8, 20) }, 328)).toEqual(['0', '20', 'ft']);
  });

  it('the two ends are named at every width, whatever stands near them, and the places read left to right', () => {
    // Each beam with the label of its far end: a support, two supports or a hinge close to an end, and rows of supports.
    const beams: [end: string, form: BeamForm][] = [
      ['20', NEAR_THE_END],
      ['20', { ...defaultBeam(), supports: supports(0, 0.8, 19.2, 20) }],
      ['20', { ...defaultBeam(), supports: supports(0, 1, 20), hinges: [{ id: 7, x: 19.5 }] }],
      ['110', { ...defaultBeam(), L: 110, supports: supports(...Array.from({ length: 12 }, (_, i) => 10 * i)) }],
      ['100', { ...defaultBeam(), L: 100, supports: supports(0, 12, 40, 55, 90, 100) }],
      ['12.35', { ...defaultBeam(), L: 12.345, supports: supports(0, 12, 12.345) }],
    ];
    for (const [end, form] of beams) {
      for (const width of [280, 300, 328, 358, 382, 420, 546, 699, 724, 943, 1100, 1400]) {
        const got = dims(form, width);
        expect([got[0], got[got.length - 2], got[got.length - 1]], `${end} ft at ${width} px: ${got.join(' ')}`).toEqual(['0', end, 'ft']);
        const places = got.slice(0, -1).map(Number);
        expect(places, `${end} ft at ${width} px`).toEqual([...places].sort((p, q) => p - q));
      }
    }
  });

  it('the supports between the ends keep their labels where there is room, as they did', () => {
    const three: BeamForm = { ...defaultBeam(), L: 60, supports: supports(0, 20, 40, 60) };
    for (const width of [280, 328, 700, 1100]) expect(dims(three, width), String(width)).toEqual(['0', '20', '40', '60', 'ft']);
  });
});

/**
 * THE DRAWING OF THE BEAM: where a load's value is written.
 *
 * Every load has its value by it. None is written over another, none runs
 * past the side of the drawing, and none is left out to make room — at any
 * width a phone or a desk gives the drawing. Dead and live load over the
 * whole beam used to be two values printed on each other.
 */

const CHAR = 6.9; // one character of the labels' 11.5px mono
const WIDTHS = [300, 360, 390, 700, 1100];
const drawAt = (form: BeamForm, width: number, more: { ownWeight?: number; group?: string } = {}) => renderToStaticMarkup(h(BeamSchematic, { form, reactions: null, width, probeX: null, summary: 'a beam', ...more }));

/** Each value of a load in the drawing, and the box it fills: from where its text hangs, by which end, and how many characters it is. */
const values = (svg: string) =>
  [...svg.matchAll(/<text class="mp-beam__label"([^>]*)>([^<]*)<\/text>/g)].map((m) => {
    const [x, y, text] = [attr(m[1], 'x'), attr(m[1], 'y'), m[2]];
    const anchor = m[1].match(/ text-anchor="([^"]*)"/)![1];
    const w = text.length * CHAR;
    // Written upward: turned a quarter about its own start, so its length runs up from y and its line lies across x.
    const turned = m[1].includes(` transform="rotate(-90 ${x} ${y})"`);
    if (turned !== m[1].includes('transform=')) throw new Error(`"${text}" is turned some other way:${m[1]}`);
    const l = turned ? x - 12 : anchor === 'start' ? x : anchor === 'end' ? x - w : x - w / 2;
    return { text, x, y, anchor, turned, l, r: turned ? x + 3 : l + w, t: turned ? y - w : y - 12, b: turned ? y : y + 3 };
  });
/** The drawing's own frame: how tall it is, and where its top is. */
const frame = (svg: string) => {
  const m = svg.match(/<svg[^>]* width="([^"]*)" height="([^"]*)" viewBox="0 (-?[\d.]+) ([\d.]+) ([\d.]+)"/)!;
  expect([Number(m[4]), Number(m[5])]).toEqual([Number(m[1]), Number(m[2])]);
  return { width: Number(m[1]), height: Number(m[2]), top: Number(m[3]) };
};
/** The lines that tie a value which went up back to its load: the x of each, and the pieces drawn of it. */
const ties = (svg: string) => [...(svg.match(/<g stroke="currentColor"[^>]*>([\s\S]*?)<\/g>/)?.[1] ?? '').matchAll(/<path d="([^"]*)"/g)].map((m) => ({ x: Number(m[1].match(/^M([\d.]+) /)![1]), pieces: [...m[1].matchAll(/M[\d.]+ ([\d.-]+)V([\d.-]+)/g)].map((p) => [Number(p[1]), Number(p[2])]) }));

/** What is wrong with a drawing, if anything: each load's value must be there, inside the drawing, and clear of every other. */
function faults(svg: string, loads: number): string[] {
  const got = values(svg);
  const { width, height, top } = frame(svg);
  const found: string[] = [];
  if (got.length !== loads) found.push(`${got.length} values for ${loads} loads`);
  for (const v of got) {
    if (v.l < 0 || v.r > width) found.push(`"${v.text}" runs past the side: ${v.l} to ${v.r} of ${width}`);
    if (v.t < top) found.push(`"${v.text}" runs past the top: ${v.t} above ${top}`);
  }
  // Taller only by what the values took above its own 216.
  if (top > 0 || height !== 216 - top) found.push(`${height} tall with its top at ${top}`);
  for (let i = 0; i < got.length; i += 1) {
    for (let j = i + 1; j < got.length; j += 1) {
      const [p, q] = [got[i], got[j]];
      const apart = Math.max(p.l - q.r, q.l - p.r);
      const above = Math.max(p.t - q.b, q.t - p.b);
      if (apart < 0 && above < 0) found.push(`"${p.text}" on "${q.text}"`);
      // Side by side on a line, two values keep more than a character between them: "16 kip16 kip" is one word.
      else if (above < 0 && !p.turned && !q.turned && apart <= CHAR) found.push(`"${p.text}" against "${q.text}": ${apart} apart`);
    }
  }
  // A line that ties a value to its load is not drawn through another value.
  for (const tie of ties(svg)) {
    for (const [from, to] of tie.pieces) {
      for (const v of got) if (tie.x > v.l && tie.x < v.r && from < v.b && to > v.t) found.push(`the line at ${tie.x} runs through "${v.text}"`);
    }
  }
  return found;
}

const span = (L: number, loads: Partial<BeamForm> = {}): BeamForm => ({ ...defaultBeam(), L, supports: [{ id: 1, kind: 'pin', x: 0 }, { id: 2, kind: 'roller', x: L }], points: [], dists: [], couples: [], ...loads });
const points = (...list: [x: number, P: number][]): BeamForm['points'] => list.map(([x, P], i) => ({ id: 100 + i, x, P: Math.abs(P), dir: P < 0 ? 'up' : 'down' }));
const dists = (...list: [x1: number, x2: number, w1: number, w2: number][]): BeamForm['dists'] => list.map(([x1, x2, w1, w2], i) => ({ id: 200 + i, x1, x2, w1, w2, dir: 'down' }));
const couples = (...list: [x: number, M: number][]): BeamForm['couples'] => list.map(([x, M], i) => ({ id: 300 + i, x, M: Math.abs(M), dir: M < 0 ? 'cw' : 'ccw' }));
const count = (form: BeamForm) => form.points.length + form.dists.length + form.couples.length;

const DEAD_AND_LIVE = span(20, { dists: dists([0, 20, 1, 1], [0, 20, 1.1, 1.1]) });
const LAST_FOOT = span(20, { dists: dists([19, 20, 1.25, 1.25]) });
const TWO_AXLES = span(40, { points: points([18, 16], [22, 16]) });
const TWELVE = span(24, { points: points(...Array.from({ length: 12 }, (_, i): [number, number] => [1 + 2 * i, [2.5, 5, 7.5, 10, 12.5, 15][i % 6]])) });
const BEAMS: Record<string, BeamForm> = {
  'the example': defaultBeam(),
  'dead and live load over the whole beam': DEAD_AND_LIVE,
  'a load on the last foot': LAST_FOOT,
  'two axle loads 4 ft apart on 40 ft': TWO_AXLES,
  'dead load over the whole beam, live load over half of it': span(20, { dists: dists([0, 20, 0.5, 0.5], [0, 10, 1, 1]) }),
  'dead, live and snow load over the whole beam': span(20, { dists: dists([0, 20, 1, 1], [0, 20, 1.1, 1.1], [0, 20, 0.9, 0.9]) }),
  'a load whose ends differ in sign, on the last quarter': span(20, { dists: dists([15, 20, 2.5, -1.5]) }),
  'a point load and a moment at one place': span(20, { points: points([10, 12]), couples: couples([10, 50]) }),
  'a point load a foot from the end, over a uniform load': span(20, { points: points([1, 8]), dists: dists([0, 20, 1.2, 1.2]) }),
  'two point loads at one place': span(20, { points: points([10, 8], [10, 5]) }),
  'three point loads close together': span(40, { points: points([18, 16], [20, 16], [22, 16]) }),
  'a load near each end of a beam fixed at both': span(20, { supports: [{ id: 1, kind: 'fixed', x: 0 }, { id: 2, kind: 'fixed', x: 20 }], points: points([0.5, 10], [19.5, 10]) }),
  'a moment at each end': span(20, { couples: couples([0, 100], [20, -100]) }),
  'a low load between two moments, under a taller one': span(20, { dists: dists([0, 20, 2, 2], [2, 18, 0.6, 0.6]), couples: couples([3, 40], [17, 40]) }),
  'three spans with a load on each and in each': span(30, {
    supports: [{ id: 1, kind: 'pin', x: 0 }, { id: 2, kind: 'roller', x: 10 }, { id: 3, kind: 'roller', x: 20 }, { id: 4, kind: 'roller', x: 30 }],
    points: points([5, 10], [15, 12], [25, 8]),
    dists: dists([0, 10, 1, 1], [10, 20, 1.5, 1.5], [20, 30, 0.8, 0.8]),
  }),
  'an overhang: a load that changes sign, a moment, a load at the tip': span(24, { supports: [{ id: 1, kind: 'pin', x: 0 }, { id: 2, kind: 'roller', x: 16 }], points: points([24, 5]), dists: dists([4, 14, 2, -1.5]), couples: couples([20, 30]) }),
  'long values, in SI': span(12.345, { units: 'si', points: points([6.1725, 1234.56], [6.9, 2345.67]), dists: dists([0, 12.345, 123.456, 234.567]), couples: couples([3, 12345.6]) }),
  'twelve point loads': TWELVE,
  'twelve equal point loads': span(24, { points: points(...Array.from({ length: 12 }, (_, i): [number, number] => [1 + 2 * i, 5])) }),
  'thirty point loads and four moments': span(30, { points: points(...Array.from({ length: 30 }, (_, i): [number, number] => [0.5 + i, 1234.5 + i])), couples: couples([14, 20], [15, 20], [15.5, 20], [16, 20]) }),
};

describe('beam drawing: every load has its value, clear of every other and inside the drawing', () => {
  for (const [name, form] of Object.entries(BEAMS)) {
    it(name, () => {
      for (const width of WIDTHS) expect(faults(drawAt(form, width), count(form)), `at ${width} px`).toEqual([]);
    });
  }

  it('at every width from 300 to 1400 px', () => {
    const found: string[] = [];
    for (let width = 300; width <= 1400; width += 50) {
      for (const name of ['the example', 'dead and live load over the whole beam', 'a load on the last foot', 'two axle loads 4 ft apart on 40 ft', 'long values, in SI', 'twelve point loads']) {
        found.push(...faults(drawAt(BEAMS[name], width), count(BEAMS[name])).map((f) => `${name} at ${width} px: ${f}`));
      }
    }
    expect(found).toEqual([]);
  }, 30_000);

  it('dead and live load over the whole beam: two values, each over an end of its load, on the line it always had', () => {
    for (const width of WIDTHS) {
      const svg = drawAt(DEAD_AND_LIVE, width);
      const [live, dead] = values(svg).sort((p, q) => p.y - q.y);
      // The lower load keeps the left end; the other is over the right end — not on it, as both were.
      expect([dead.text, dead.x, dead.anchor], String(width)).toEqual(['1 kip/ft', xToPx(0, 20, width) + 2, 'start']);
      expect([live.text, live.x, live.anchor], String(width)).toEqual(['1.1 kip/ft', xToPx(20, 20, width) - 2, 'end']);
      // Six above each one's own outline: the taller load's value 3 higher, and nothing stacked.
      expect(live.y).toBe(65);
      expect(dead.y).toBeCloseTo(115 - (10 + (1 / 1.1) * 34) - 6, 9);
      expect(frame(svg).height).toBe(216);
    }
  });

  it('a load on the last foot: its value hangs from the load’s right end, inside the drawing', () => {
    // From its left end it ran 35 px past the side of a phone's drawing: "1.25 k".
    for (const width of [300, 328, 360, 390, 700]) {
      const [v] = values(drawAt(LAST_FOOT, width));
      expect([v.text, v.x, v.anchor], String(width)).toEqual(['1.25 kip/ft', xToPx(20, 20, width) - 2, 'end']);
      expect(v.r, String(width)).toBeLessThanOrEqual(width);
    }
    // With room on its right — the middle of a beam, or a drawing wide enough — a load keeps its value over its left end.
    const [mid] = values(drawAt(span(20, { dists: dists([9, 10, 1.25, 1.25]) }), 700));
    expect([mid.x, mid.anchor]).toEqual([xToPx(9, 20, 700) + 2, 'start']);
    const [wide] = values(drawAt(LAST_FOOT, 1100));
    expect([wide.x, wide.anchor]).toEqual([xToPx(19, 20, 1100) + 2, 'start']);
    expect(wide.r).toBeLessThanOrEqual(1100);
  });

  it('two axle loads 4 ft apart: on a phone each value is on the outer side of its own arrow, and on a desk over it', () => {
    const phone = values(drawAt(TWO_AXLES, 328));
    expect(phone.map((v) => [v.text, v.x, v.anchor, v.y])).toEqual([
      ['16 kip', xToPx(18, 40, 328), 'end', 46],
      ['16 kip', xToPx(22, 40, 328), 'start', 46],
    ]);
    const desk = values(drawAt(TWO_AXLES, 1100));
    expect(desk.map((v) => [v.x, v.anchor, v.y])).toEqual([
      [xToPx(18, 40, 1100), 'middle', 46],
      [xToPx(22, 40, 1100), 'middle', 46],
    ]);
  });

  it('the example beam is drawn as it always was, at any width', () => {
    const form = defaultBeam();
    for (let width = 280; width <= 1400; width += 70) {
      const svg = drawAt(form, width);
      expect(values(svg).map((v) => [v.text, v.x, v.y, v.anchor]).sort(), String(width)).toEqual([
        ['1.2 kip/ft', xToPx(0, 20, width) + 2, 65, 'start'],
        ['8 kip', xToPx(12, 20, width), 46, 'middle'],
      ]);
      expect(frame(svg)).toEqual({ width, height: 216, top: 0 });
      expect(ties(svg)).toEqual([]);
    }
  });

  it('a value that has to go up a line is tied to its load, and the drawing keeps its height while there is room', () => {
    // Three loads 13 px apart: the outer two on their outer sides, the middle one a line up.
    const form = BEAMS['three point loads close together'];
    const svg = drawAt(form, 328);
    const at = [18, 20, 22].map((x) => xToPx(x, 40, 328));
    expect(values(svg).map((v) => [v.x, v.anchor, v.y])).toEqual([
      [at[0], 'end', 46],
      [at[1], 'middle', 31],
      [at[2], 'start', 46],
    ]);
    // From just under the value down to where its arrow starts.
    expect(ties(svg)).toEqual([{ x: at[1], pieces: [[36, 53]] }]);
    expect(frame(svg).height).toBe(216);
  });

  it('the line of a value that went up is kept clear: the next value is written beside it, not across it', () => {
    // Three loads 20 px apart. The third has room over its own arrow — but would lie across the second one's line.
    const svg = drawAt(span(40, { points: points([17, 16], [20, 16], [23, 16]) }), 328);
    const at = [17, 20, 23].map((x) => xToPx(x, 40, 328));
    expect(values(svg).map((v) => [v.x, v.anchor, v.y, v.turned])).toEqual([
      [at[0], 'end', 46, false],
      [at[1], 'middle', 31, false],
      [at[2], 'start', 46, false],
    ]);
    expect(ties(svg)).toEqual([{ x: at[1], pieces: [[36, 53]] }]);
  });

  it('a value whose neighbour went up out of its way keeps its own place, and does not push the next one up', () => {
    // Twelve loads 55 px apart: "12.5 kip" is too long between "10 kip" and "15 kip", and is the one that goes up.
    const got = values(drawAt(TWELVE, 724));
    expect(got.map((v) => [v.text, v.anchor, v.y]).slice(3, 7)).toEqual([
      ['10 kip', 'middle', 46],
      ['12.5 kip', 'middle', 31],
      ['15 kip', 'middle', 46],
      ['2.5 kip', 'middle', 46],
    ]);
    expect(got.filter((v) => v.y !== 46).map((v) => v.text)).toEqual(['12.5 kip', '12.5 kip']);
  });

  it('only its own neighbours make a row too close: a point load’s value that goes up over a distributed load’s stays level', () => {
    // Six loads over the whole beam leave their values no room on one line; one of them is over the point load's arrow.
    const form = span(20, { points: points([1, 8]), dists: dists(...[1, 1.02, 1.04, 1.06, 1.08, 1.1].map((w): [number, number, number, number] => [0, 20, w, w])) });
    const svg = drawAt(form, 328);
    expect(faults(svg, 7)).toEqual([]);
    const [point] = values(svg);
    expect([point.text, point.turned, point.anchor, point.y]).toEqual(['8 kip', false, 'start', 31]);
  });

  it('two loads at one place: one value above the other on the one arrow, and no line between them', () => {
    const svg = drawAt(BEAMS['two point loads at one place'], 700);
    const x = xToPx(10, 20, 700);
    expect(values(svg).map((v) => [v.text, v.x, v.anchor, v.y])).toEqual([
      ['8 kip', x, 'middle', 46],
      ['5 kip', x, 'middle', 31],
    ]);
    expect(ties(svg)).toEqual([]);
  });

  it('a row of point loads too close for lines: each value written up its own arrow, and the drawing taller by what that takes', () => {
    const svg = drawAt(TWELVE, 328);
    const got = values(svg);
    expect(got.map((v) => v.text)).toEqual(TWELVE.points.map((p) => `${p.P} kip`));
    for (const [i, v] of got.entries()) {
      expect(v.turned, v.text).toBe(true);
      // Across its own arrow's line, starting just above where the arrow starts.
      const stem = xToPx(TWELVE.points[i].x, 24, 328);
      expect(v.l, v.text).toBeLessThan(stem);
      expect(v.r, v.text).toBeGreaterThan(stem);
      expect(v.b, v.text).toBe(47);
    }
    // "12.5 kip" is 8 characters: 55.2 px up from 47, and 4 kept clear above it.
    expect(frame(svg)).toEqual({ width: 328, height: 216 + 13, top: -13 });
    expect(ties(svg)).toEqual([]);
    // The marker of the place asked about runs the whole of the taller drawing: from 8 under its top, as in the plain one.
    const probe = (form: BeamForm) => renderToStaticMarkup(h(BeamSchematic, { form, reactions: null, width: 328, probeX: 5, summary: 'a beam' })).match(/<line class="mp-plot__probe-line"[^>]*>/)![0];
    expect(attr(probe(TWELVE), 'y1')).toBe(8 - 13);
    expect(attr(probe(defaultBeam()), 'y1')).toBe(8);
    // On a desk the same loads have room: every value level, three of them a line up.
    const desk = values(drawAt(TWELVE, 1100));
    expect(desk.some((v) => v.turned)).toBe(false);
  });

  it('a distributed load’s value keeps clear of a point load’s arrow where its load has room, and is written over the arrow where it has none', () => {
    // A foot from the left end, the arrow would run through the value: the value goes to the other end.
    const [, w] = values(drawAt(BEAMS['a point load a foot from the end, over a uniform load'], 700));
    expect([w.text, w.x, w.anchor]).toEqual(['1.2 kip/ft', xToPx(20, 20, 700) - 2, 'end']);
    // A span a value long with a load at its middle: no clear place. The value is written after the arrow, which so goes behind it.
    const svg = drawAt(BEAMS['three spans with a load on each and in each'], 328);
    const mid = values(svg).find((v) => v.text === '1.5 kip/ft')!;
    const arrow = xToPx(15, 30, 328);
    expect(mid.l).toBeLessThan(arrow);
    expect(mid.r).toBeGreaterThan(arrow);
    expect(svg.indexOf('>1.5 kip/ft<')).toBeGreaterThan(svg.lastIndexOf('class="mp-beam__point"'));
    expect(svg.indexOf('>1.5 kip/ft<')).toBeGreaterThan(svg.lastIndexOf('class="mp-beam__couple"'));
  });

  // Joists 12 in apart on a desk: every value was a few pixels too long to stand beside the line of the one before,
  // too short to count as crowded, and went up a line — eleven lines for twelve equal loads, 120 px of drawing, and a
  // row that looked like a ramp of growing arrows.
  describe('a row of point loads that would climb line upon line is written upward instead', () => {
    const row = (n: number, from: number, step: number, P: number) => points(...Array.from({ length: n }, (_, i): [number, number] => [from + i * step, P]));
    /** How tall a drawing is, having checked that every value is in it, clear of the others. */
    const height = (form: BeamForm, width: number) => {
      const svg = drawAt(form, width);
      expect(faults(svg, count(form)), `at ${width} px`).toEqual([]);
      return frame(svg).height;
    };
    const upward = (form: BeamForm, width: number) => values(drawAt(form, width)).map((v) => v.turned);

    it('twelve joists 12 in apart, on a desk: one row, each value up its own arrow, 13 px taller', () => {
      const joists = span(20, { points: row(12, 4, 1, 1.85) });
      for (const width of [699, 724]) {
        expect(upward(joists, width), String(width)).toEqual(Array(12).fill(true));
        // "1.85 kip" is 8 characters: 55.2 px up from 47, and 4 kept clear above it. It was 336.
        expect(height(joists, width), String(width)).toBe(216 + 13);
        expect(ties(drawAt(joists, width)), String(width)).toEqual([]);
      }
      // With room for the values level, on two lines, they are level.
      expect(upward(joists, 943)).toEqual(Array(12).fill(false));
      expect(height(joists, 943)).toBe(216);
    });

    it('nine loads 2 ft apart and twelve loads 2 ft apart, on a phone', () => {
      const nine = span(20, { points: row(9, 2, 2, 2.4) });
      const twelve = span(24, { points: row(12, 1, 2, 3) });
      for (const width of [350, 358, 374]) {
        // "2.4 kip" upward is 6 px taller than the drawing; level, it took eight lines and 291.
        expect([upward(nine, width).every(Boolean), height(nine, width)], String(width)).toEqual([true, 222]);
      }
      // "3 kip" upward fits under the drawing's own top; level, it took eleven lines and 336.
      for (const width of [328, 350, 358]) expect([upward(twelve, width).every(Boolean), height(twelve, width)], String(width)).toEqual([true, 216]);
    });

    it('one line taller than the upward row is not climbing: five joists stay level, on four lines', () => {
      const five = span(20, { points: row(5, 4, 1, 1.85) });
      expect(upward(five, 724)).toEqual(Array(5).fill(false));
      expect(height(five, 724)).toBe(216 + 15);
    });

    it('any number of equal loads, their arrows from 16 to 48 px apart: never more than a line taller than the upward row', () => {
      // 16 px is the room a value written upward takes; closer than that, the upward values themselves go up in tiers.
      const found: string[] = [];
      for (const [P, turned] of [[5, 0], [1.85, 13]]) {
        // Six is the first row that climbed past the line allowed: five lines for six loads.
        for (const n of [3, 6, 12]) {
          for (let apart = 16; apart <= 48; apart += 1) {
            // A beam of 664 ft drawn 724 px wide: one foot is one pixel, and the row is at its middle.
            const form = span(664, { points: row(n, 332 - (apart * (n - 1)) / 2, apart, P) });
            const tall = height(form, 724);
            if (tall > 216 + turned + 15) found.push(`${n} loads of ${P} kip ${apart} px apart: ${tall} px, the upward row ${216 + turned}`);
          }
        }
      }
      expect(found).toEqual([]);
    }, 30_000);
  });

  it('a load whose ends differ in sign says which way each end acts, as its arrows show', () => {
    const drawn = (d: Omit<BeamForm['dists'][number], 'id'>) => {
      const svg = drawAt(span(20, { dists: [{ id: 200, ...d }] }), 700);
      // The tip of each arrow of the load: on the beam (y 115) where it acts downward, above it where it acts upward.
      const tips = [...svg.matchAll(/<g><line[^>]*><\/line><polygon class="mp-beam__head" points="[\d.]+,([\d.]+) /g)].map((m) => Number(m[1]));
      expect(tips.length).toBeGreaterThan(2);
      return { text: values(svg).map((v) => v.text), first: tips[0] === 115 ? '↓' : '↑', last: tips[tips.length - 1] === 115 ? '↓' : '↑' };
    };
    expect(drawn({ x1: 5, x2: 15, w1: 2, w2: -1, dir: 'down' })).toEqual({ text: ['2 ↓ – 1 ↑ kip/ft'], first: '↓', last: '↑' });
    // Entered as acting upward, each end acts the other way.
    expect(drawn({ x1: 5, x2: 15, w1: 2, w2: -1, dir: 'up' })).toEqual({ text: ['2 ↑ – 1 ↓ kip/ft'], first: '↑', last: '↓' });
    // Entered from right to left, it is still read from left to right.
    expect(drawn({ x1: 15, x2: 5, w1: 2, w2: -1, dir: 'down' })).toEqual({ text: ['1 ↑ – 2 ↓ kip/ft'], first: '↑', last: '↓' });
    // One way along its whole length: no arrow in the value, the drawing says it.
    expect(drawn({ x1: 5, x2: 15, w1: 2, w2: 1, dir: 'down' })).toEqual({ text: ['2 – 1 kip/ft'], first: '↓', last: '↓' });
  });

  it('a value longer than any place its load has is hung from the side of the drawing, inside it', () => {
    // 30 characters, 207 px, for a load 22 px long right of the middle of a 280 px drawing: hung from the load's left
    // end, from its right end or centred on it, the value crosses a side.
    const form = span(20, { dists: dists([13, 15, 1234.56, -2345.67]) });
    const svg = drawAt(form, 280);
    expect(faults(svg, 1)).toEqual([]);
    const [v] = values(svg);
    expect([v.text, v.x, v.anchor]).toEqual(['1,234.56 ↓ – 2,345.67 ↑ kip/ft', 278, 'end']);
    expect([v.l, v.r]).toEqual([278 - 30 * CHAR, 278]);
  });

  it('a size that is not a number is not drawn, and writes nothing into the drawing: loads, moments and reactions', () => {
    // 1e308 kip/ft read in kN/m is past the largest number there is. Its row says so; the drawing leaves it out.
    const form: BeamForm = {
      ...defaultBeam(),
      points: [...points([12, 8]), { id: 9, x: 6, P: Infinity, dir: 'down' }, { id: 10, x: 7, P: Number.NaN, dir: 'up' }],
      dists: [{ id: 8, x1: 0, x2: 20, w1: Infinity, w2: 1, dir: 'down' }, { id: 11, x1: 2, x2: 9, w1: 1, w2: Number.NaN, dir: 'down' }],
      couples: [{ id: 7, x: 5, M: Infinity, dir: 'cw' }, { id: 12, x: 15, M: Number.NaN, dir: 'ccw' }],
    };
    const reactions: BeamReaction[] = [{ x: 0, kind: 'pin', Rv: Number.NaN, Rm: 0 }, { x: 10, kind: 'fixed', Rv: 5, Rm: Infinity }, { x: 20, kind: 'roller', Rv: 16.8, Rm: 0 }];
    for (const width of [300, 360, 700]) {
      const svg = renderToStaticMarkup(h(BeamSchematic, { form, reactions, width, probeX: null, summary: 'a beam' }));
      expect(svg, String(width)).not.toMatch(/NaN|Infinity|—/);
      // What is a number is drawn as ever: the 8 kip load, and the reaction of 16.8.
      expect(values(svg).map((v) => v.text)).toEqual(['8 kip']);
      expect(svg.match(/class="mp-beam__point"/g)).toHaveLength(1);
      expect(svg).not.toContain('mp-beam__dist');
      expect(svg).not.toContain('mp-beam__couple');
      expect(marks(svg).map((r) => r.texts.map((t) => t.text))).toEqual([['16.8']]);
    }
  });

  it('the beam’s own weight is drawn and carries no value: the other loads’ values are the only ones', () => {
    const svg = drawAt(defaultBeam(), 700, { ownWeight: 0.05 });
    expect(values(svg).map((v) => v.text).sort()).toEqual(['1.2 kip/ft', '8 kip']);
    expect(svg.match(/<g class="mp-beam__dist"><polygon/g)).toHaveLength(2);
  });
});

describe('beam drawing: the page’s own way of setting thousands apart', () => {
  const form = span(1500, { units: 'si', points: points([750, 1234.56]), dists: dists([0, 1500, 12345.6, 23456.7]), couples: couples([300, 12345.6]) });
  const reactions: BeamReaction[] = [{ x: 0, kind: 'fixed', Rv: 3643.2, Rm: -21480.4 }];
  const texts = (svg: string) => [...svg.matchAll(/<text[^>]*>([^<]*)<\/text>/g)].map((m) => m[1]);

  it('every number of the drawing is printed with it: loads, reactions and positions', () => {
    const svg = renderToStaticMarkup(h(BeamSchematic, { form, reactions, width: 700, probeX: null, summary: 'a beam', group: ' ' }));
    expect(texts(svg)).toEqual(expect.arrayContaining(['1 234.56 kN', '12 345.6 – 23 456.7 kN/m', '12 345.6 kN·m', '3 643', '↻ 21 480', '1 500']));
    expect(texts(svg).filter((s) => s.includes(','))).toEqual([]);
  });

  it('and with a comma when the page says nothing', () => {
    const svg = renderToStaticMarkup(h(BeamSchematic, { form, reactions, width: 700, probeX: null, summary: 'a beam' }));
    expect(texts(svg)).toEqual(expect.arrayContaining(['1,234.56 kN', '12,345.6 – 23,456.7 kN/m', '12,345.6 kN·m', '3,643', '↻ 21,480', '1,500']));
  });

  it('the values labelled on a diagram too', () => {
    const plot = (group?: string) => renderToStaticMarkup(h(BeamPlot, { title: 'Shear', unit: 'kN', points: [{ x: 0, y: 12345.6 }, { x: 10, y: -2345.67 }], marks: [{ x: 0, y: 12345.6 }, { x: 10, y: -2345.67 }], breaks: [], L: 10, width: 700, probe: null, onProbe: () => {}, summary: 'shear', ...(group ? { group } : {}) }));
    expect(texts(plot(' '))).toEqual(['12 350', '-2 346']);
    expect(texts(plot())).toEqual(['12,350', '-2,346']);
  });
});

/**
 * THE DIAGRAMS: results that are not numbers.
 *
 * A load of 1e308 kip is a number; its moments are not. The engine refuses
 * what it can see coming, and a diagram is the last to be handed what is
 * left: it draws what is a number and writes nothing for the rest — "NaN" in
 * a path is an error in the console and a diagram that is not there.
 */
describe('beam diagrams: only what is a number is drawn', () => {
  const plot = (points: PlotPoint[], more: { marks?: PlotPoint[]; probe?: PlotPoint | null } = {}) =>
    renderToStaticMarkup(h(BeamPlot, { title: 'Moment', unit: 'kip·ft', points, marks: [], breaks: [0, 20], L: 20, width: 360, probe: null, onProbe: () => {}, summary: 'moment', ...more }));
  const path = (svg: string, name: string) => svg.match(new RegExp(`<path class="mp-plot__${name}" d="([^"]*)"`))?.[1] ?? null;

  it('stations of Infinity and NaN are left out of the line, and the scale is that of the rest', () => {
    const svg = plot([{ x: 0, y: 0 }, { x: 5, y: 40 }, { x: 10, y: Infinity }, { x: 12, y: Number.NaN }, { x: 15, y: -Infinity }, { x: 20, y: -10 }]);
    expect(svg).not.toMatch(/NaN|Infinity/);
    // From −10 to 40 over the 108 px between the margins: 0 is at 108.4, as if the three had not been there.
    expect(path(svg, 'line')).toBe('M30.0 108.4 L105.0 22.0 L330.0 130.0');
    expect(path(svg, 'area')).toBe('M30.0 108.4 L30.0 108.4 L105.0 22.0 L330.0 130.0 L330.0 108.4 Z');
    expect(svg).toContain('<line class="mp-plot__axis" x1="30" x2="330" y1="108.4" y2="108.4">');
  });

  it('a value that is not a number is not labelled, and the marker of a place keeps its line without its dot', () => {
    const points = [{ x: 0, y: 0 }, { x: 5, y: 40 }, { x: 12, y: Number.NaN }, { x: 20, y: -10 }];
    const svg = plot(points, { marks: [{ x: 5, y: 40 }, { x: 10, y: Infinity }, { x: 12, y: Number.NaN }], probe: { x: 12, y: Number.NaN } });
    expect(svg).not.toMatch(/NaN|Infinity|—/);
    expect(svg.match(/<circle class="mp-plot__dot"[^>]*>/g)).toEqual(['<circle class="mp-plot__dot" cx="105" cy="22" r="3">']);
    expect([...svg.matchAll(/<text class="mp-plot__value"[^>]*>([^<]*)</g)].map((m) => m[1])).toEqual(['40']);
    expect(svg).toContain('<g class="mp-plot__probe"><line x1="210" x2="210" y1="16" y2="136"></line></g>');
    // Where the value is a number, the dot is on it.
    expect(plot(points, { probe: { x: 5, y: 40 } })).toContain('<g class="mp-plot__probe"><line x1="105" x2="105" y1="16" y2="136"></line><circle cx="105" cy="22" r="4"></circle></g>');
  });

  it('extremes that are numbers and further apart than the largest number: a flat line, not a line of NaN', () => {
    const svg = plot([{ x: 0, y: 1e308 }, { x: 20, y: -1e308 }], { marks: [{ x: 0, y: 1e308 }], probe: { x: 10, y: 0 } });
    expect(svg).not.toMatch(/NaN|Infinity/);
    expect(path(svg, 'line')).toBe('M30.0 76.0 L330.0 76.0');
  });

  it('nothing that is a number: the axis alone', () => {
    const svg = plot([{ x: 0, y: Number.NaN }, { x: 20, y: Infinity }], { marks: [{ x: 20, y: Infinity }] });
    expect(svg).not.toMatch(/NaN|Infinity|—/);
    expect([path(svg, 'line'), path(svg, 'area')]).toEqual([null, null]);
    expect(svg).toContain('<line class="mp-plot__axis" x1="30" x2="330" y1="76" y2="76">');
  });
});

describe('beam diagrams: the position a pointer asks about', () => {
  it('a diagram reports it that way: what it tells the page is the x the page shows', () => {
    // The diagram has no state of its own, so it can be called as the function it is and its pointer handler found.
    const told: (number | null)[] = [];
    const drawn = BeamPlot({ title: 'Shear', unit: 'kip', points: [{ x: 0, y: 1 }, { x: 200, y: -1 }], marks: [], breaks: [], L: 200, width: 460, probe: null, onProbe: (x) => told.push(x), summary: 'shear' });
    type Node = { props?: { className?: string; children?: unknown; onPointerMove?: (e: unknown) => void; onPointerDown?: (e: unknown) => void } };
    const find = (node: unknown): Node | null => {
      if (Array.isArray(node)) return node.map(find).find(Boolean) ?? null;
      const n = node as Node | null;
      if (!n?.props) return null;
      return n.props.className === 'mp-plot__hit' ? n : find(n.props.children);
    };
    const hit = find(drawn)!;
    // The overlay lies from 100 to 500 px of the window; the pointer is 61.7283 % along it, at 123.4566 ft.
    const pointer = (clientX: number) => ({ clientX, currentTarget: { getBoundingClientRect: () => ({ left: 100, width: 400 }) } });
    hit.props!.onPointerMove!(pointer(100 + 0.617283 * 400));
    hit.props!.onPointerDown!(pointer(100 + 0.25 * 400));
    hit.props!.onPointerMove!(pointer(900));
    hit.props!.onPointerMove!(pointer(-50));
    expect(told).toEqual([123.5, 50, 200, 0]);
  });

  it('is the pointer’s, to the four figures the page prints positions with', () => {
    // 61.7283 % along a 200 ft beam is 123.4566 ft: the values are read at 123.5, which is what is shown.
    expect(pointerX(0.617283, 200)).toBe(123.5);
    expect(pointerX(0.6173, 20)).toBe(12.35);
    expect(pointerX(0.5, 6.096)).toBe(3.048);
    expect(pointerX(1 / 3, 10)).toBe(3.333);
    for (const L of [0.75, 6.096, 20, 123.45, 2500]) {
      for (let i = 0; i <= 400; i += 1) {
        const x = pointerX(i / 400, L);
        expect(x, `${i}/400 of ${L}`).toBe(x === L ? L : Number(x.toPrecision(4)));
      }
    }
  });

  it('is never off the beam: not before its start, and not past an end that four figures would round up', () => {
    expect(pointerX(-0.2, 20)).toBe(0);
    expect(pointerX(0, 20)).toBe(0);
    expect(pointerX(1.3, 20)).toBe(20);
    // 12.345 to four figures is 12.35: past the end of a 12.345 m beam.
    expect(pointerX(1, 12.345)).toBe(12.345);
    expect(pointerX(0.99999, 12.345)).toBe(12.34);
    for (const L of [12.345, 7.0007, 33.335, 0.123456]) {
      for (let i = 0; i <= 1000; i += 1) {
        const x = pointerX(i / 1000, L);
        expect(x >= 0 && x <= L, `${i}/1000 of ${L}: ${x}`).toBe(true);
      }
    }
  });
});
