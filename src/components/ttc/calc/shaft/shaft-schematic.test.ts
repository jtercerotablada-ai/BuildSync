import { createElement as h } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { afterEach, describe, expect, it } from 'vitest';
import { formatNumber } from '@/lib/calc/format';
import type { ShaftDrawing } from '@/lib/calc/shaft/types';
import { xToPx } from '../beam/BeamPlot';
import { ShaftSchematic, shaftHeight, shaftLayout, type ShaftLayout } from './ShaftSchematic';

// Markup and arithmetic from end to end, some thousands of drawings of it: a turn of the event loop between two
// tests lets the runner hear from this worker (as in lib/calc/continuous/engine.test.ts).
afterEach(() => new Promise<void>((resolve) => setTimeout(resolve, 0)));

/**
 * THE DRAWING OF THE SHAFT, read back from its markup.
 *
 * Three things are held here, each measured on what the component writes
 * and reckoned again in this file from the drawing it was given:
 *
 *   - the geometry: a rectangle per segment where the segment is and as tall
 *     as its diameter, on one scale across the shaft; the bearings under it
 *     where they stand; an arrow for each force and an arc for each couple,
 *     pointing the way its sign says; and, with both planes together,
 *     nothing that is an arrow;
 *   - the dimension line: what it names, and what gives way to what;
 *   - THE VALUES: no two on each other, none on the line of an arrow or on
 *     an arc, none past a side of the drawing. Drawings of this kind fail
 *     there, and nowhere a test of one shaft would show it: so over shafts
 *     made at random, up to the most the form takes (eight segments, twelve
 *     forces, twelve couples), each at seven widths from 280 to 1100 px.
 *
 * HOW MANY, AND HOW. React, as it runs under a test, takes some 50 ms to
 * write one crowded drawing out, so what is read from MARKUP is some five
 * hundred drawings: every shaft named below, in one plane and with both
 * together, and forty made at random, at the seven widths. The component
 * reckons where everything goes in one function with no React in it
 * (`shaftLayout`) and draws what that returns; the same rules are held on
 * what it returns for six hundred more shafts (4,200 drawings) and for five
 * of the named ones at every second width from 280 to 1100 px. And each of
 * the five hundred read from markup is shown to be, shape for shape and
 * number for number, what the layout said - so a rule that holds on the one
 * holds on the other.
 *
 * A box is reckoned as the component reckons one: 6.9 px to a character of
 * the labels' 11.5 px mono, 12 above the baseline and 3 below. That the type
 * the site sets them in is no wider was measured in a browser (Geist Mono:
 * 6.901 px), not here.
 */

const CHAR = 6.9; // one character of the labels' 11.5px mono
const DIM_CHAR = 6.8; // …and of the dimension line's 11px, and a little
const P_TOP = 53; // where the arrow of a force starts
const P_MIN = 52; // the shortest of them: over the thickest part
const C_OUT = 14; // an arc passes this far outside the thickest part
const WIDTHS = [280, 320, 390, 500, 724, 900, 1100];
/** A level value is centred to the tenth of a pixel. */
const tenth = (v: number) => Math.round(v * 10) / 10;

type More = { resultants?: boolean; width?: number; probeX?: number | null; group?: string; figures?: number; summary?: string };
const draw = (drawing: ShaftDrawing, { resultants = false, width = 724, probeX = null, summary = 'a shaft', ...more }: More = {}) =>
  renderToStaticMarkup(h(ShaftSchematic, { drawing, resultants, width, probeX, summary, ...more }));

/* ── Reading the markup ───────────────────────────────────────────────── */

const attr = (tag: string, name: string) => Number(tag.match(new RegExp(` ${name}="([^"]*)"`))?.[1]);
const groups = (svg: string, name: string) => [...svg.matchAll(new RegExp(`<g class="mp-shaft-fig__${name}">([\\s\\S]*?)</g>`, 'g'))].map((m) => m[1]);
const tags = (inner: string, tag: string): string[] => inner.match(new RegExp(`<${tag}[ >][^>]*>`, 'g')) ?? [];
const pointsOf = (tag: string) => tag.match(/ points="([^"]*)"/)![1].split(' ').map((p) => p.split(',').map(Number));

/** The drawing's own frame: how wide and tall it is, and where its top is. */
const frame = (svg: string) => {
  const m = svg.match(/<svg[^>]* width="([^"]*)" height="([^"]*)" viewBox="0 (-?[\d.]+) ([\d.]+) ([\d.]+)"/)!;
  expect([Number(m[4]), Number(m[5])]).toEqual([Number(m[1]), Number(m[2])]);
  return { width: Number(m[1]), height: Number(m[2]), top: Number(m[3]) };
};
/** The axis: its height in the drawing, and its two ends. */
const axis = (svg: string) => {
  const tag = svg.match(/<line class="mp-shaft-fig__axis"[^>]*>/)![0];
  expect(attr(tag, 'y1')).toBe(attr(tag, 'y2'));
  return { y: attr(tag, 'y1'), x1: attr(tag, 'x1'), x2: attr(tag, 'x2') };
};
const segs = (svg: string) => (svg.match(/<rect class="mp-shaft-fig__seg"[^>]*>/g) ?? []).map((t) => ({ x: attr(t, 'x'), y: attr(t, 'y'), w: attr(t, 'width'), h: attr(t, 'height') }));
const bores = (svg: string) => (svg.match(/<line class="mp-shaft-fig__bore"[^>]*>/g) ?? []).map((t) => ({ x1: attr(t, 'x1'), x2: attr(t, 'x2'), y1: attr(t, 'y1'), y2: attr(t, 'y2') }));
/** Each bearing: the tip of its triangle, where its base is, and the line it stands on. */
const pins = (svg: string) =>
  groups(svg, 'bearing').map((g) => {
    const [tip, left, right] = pointsOf(tags(g, 'polygon')[0]);
    const line = tags(g, 'line')[0];
    return { x: tip[0], y: tip[1], base: left[1], half: (right[0] - left[0]) / 2, foot: attr(line, 'y1'), from: attr(line, 'x1'), to: attr(line, 'x2') };
  });
/** Each force: its line, and the head or the dot at one end of it. */
const arrows = (svg: string) =>
  groups(svg, 'force').map((g) => {
    const line = tags(g, 'line')[0];
    const headTag = tags(g, 'polygon')[0];
    const dot = tags(g, 'circle')[0];
    const head = headTag ? pointsOf(headTag) : null;
    return {
      x: attr(line, 'x1'),
      straight: attr(line, 'x1') === attr(line, 'x2'),
      top: Math.min(attr(line, 'y1'), attr(line, 'y2')),
      bottom: Math.max(attr(line, 'y1'), attr(line, 'y2')),
      // The head's first point is its tip; the other two are its base.
      tip: head ? head[0] : null,
      base: head ? head[1][1] : null,
      half: head ? (head[2][0] - head[1][0]) / 2 : 0,
      dot: dot ? { x: attr(dot, 'cx'), y: attr(dot, 'cy') } : null,
    };
  });
/** Each couple: the circle its arc is part of, and the head at one end of it. */
const arcs = (svg: string) =>
  groups(svg, 'couple').map((g) => {
    const m = g.match(/<path d="M([\d.-]+) ([\d.-]+) A([\d.]+) ([\d.]+) 0 1 1 ([\d.-]+) ([\d.-]+)"/)!;
    const [sx, sy, r, r2, ex, ey] = m.slice(1).map(Number);
    expect(r2).toBe(r);
    const headTag = tags(g, 'polygon')[0];
    return { x: (sx + ex) / 2, r, start: [sx, sy], end: [ex, ey], head: headTag ? pointsOf(headTag) : null };
  });

type Box = { text: string; l: number; r: number; t: number; b: number };
/** Each value of a load, and the box it fills: level and centred on its x, or turned to read upward along its own line. */
const values = (svg: string) =>
  [...(groups(svg, 'values')[0] ?? '').matchAll(/<text class="mp-shaft-fig__label"([^>]*)>([^<]*)<\/text>/g)].map((m) => {
    const [x, y, text] = [attr(m[1], 'x'), attr(m[1], 'y'), m[2]];
    const anchor = m[1].match(/ text-anchor="([^"]*)"/)![1];
    const w = [...text].length * CHAR;
    // Written upward: turned a quarter about its own start, so its length runs up from y and its line lies across x.
    const turned = m[1].includes(` transform="rotate(-90 ${x} ${y})"`);
    if (turned !== m[1].includes('transform=')) throw new Error(`"${text}" is turned some other way:${m[1]}`);
    if (anchor !== (turned ? 'start' : 'middle')) throw new Error(`"${text}" hangs by its ${anchor}`);
    return turned ? { text, x, y, turned, l: x - 12, r: x + 3, t: y - w, b: y } : { text, x, y, turned, l: x - w / 2, r: x + w / 2, t: y - 12, b: y + 3 };
  });
/** Each reaction: its arrow, if it has one, and its value, if it is written. */
const reactions = (svg: string) =>
  groups(svg, 'reaction').map((g) => {
    const line = tags(g, 'line')[0];
    const headTag = tags(g, 'polygon')[0];
    const head = headTag ? pointsOf(headTag) : null;
    const t = g.match(/<text x="([^"]*)" y="([^"]*)" text-anchor="([^"]*)">([^<]*)<\/text>/);
    const text = t ? { x: Number(t[1]), y: Number(t[2]), anchor: t[3], text: t[4] } : null;
    const w = text ? text.text.length * CHAR : 0;
    const l = text ? (text.anchor === 'start' ? text.x : text.anchor === 'end' ? text.x - w : text.x - w / 2) : 0;
    return {
      x: line ? attr(line, 'x1') : null,
      top: line ? Math.min(attr(line, 'y1'), attr(line, 'y2'), ...(head ? head.map((p) => p[1]) : [])) : null,
      bottom: line ? Math.max(attr(line, 'y1'), attr(line, 'y2'), ...(head ? head.map((p) => p[1]) : [])) : null,
      tip: head ? head[0] : null,
      base: head ? head[1][1] : null,
      text,
      box: text ? ({ text: text.text, l, r: l + w, t: text.y - 12, b: text.y + 3 } satisfies Box) : null,
    };
  });
/** The dimension line: its own line, its ticks, what is written under it, and the unit. */
const dims = (svg: string) => {
  const g = groups(svg, 'dim')[0];
  const [line, ...ticks] = tags(g, 'line');
  const texts = [...g.matchAll(/<text x="([^"]*)" y="([^"]*)" text-anchor="middle">([^<]*)<\/text>/g)].map((m) => ({ x: Number(m[1]), y: Number(m[2]), text: m[3], l: Number(m[1]) - (m[3].length * DIM_CHAR) / 2, r: Number(m[1]) + (m[3].length * DIM_CHAR) / 2 }));
  const unit = g.match(/<text class="mp-shaft-fig__unit" x="([^"]*)" y="([^"]*)" text-anchor="end">([^<]*)<\/text>/)!;
  return { y: attr(line, 'y1'), from: attr(line, 'x1'), to: attr(line, 'x2'), ticks: ticks.map((t) => attr(t, 'x1')), texts, unit: { text: unit[3], r: Number(unit[1]), l: Number(unit[1]) - [...unit[3]].length * DIM_CHAR } };
};
/** The lines that tie a value which went up back to its load: the x of each, and the pieces drawn of it. */
const ties = (svg: string) => [...(groups(svg, 'ties')[0] ?? '').matchAll(/<path d="([^"]*)"/g)].map((m) => ({ x: Number(m[1].match(/^M([\d.]+) /)![1]), pieces: [...m[1].matchAll(/M[\d.]+ ([\d.-]+)V([\d.-]+)/g)].map((p) => [Number(p[1]), Number(p[2])]) }));

/* ── Shafts ───────────────────────────────────────────────────────────── */

/** Segments end to end from 0, each by its length, its diameter and its bore. */
const seg = (...list: [L: number, d: number, bore?: number][]) => {
  let x = 0;
  return list.map(([L, d, bore = 0]) => ({ from: x, to: (x += L), d, bore }));
};
const force = (x: number, value: number, unit = 'lbf') => ({ id: `f${x}`, x, value, label: `${formatNumber(Math.abs(value), 6)} ${unit}` });
const couple = (x: number, value: number, unit = 'lbf·in') => ({ id: `c${x}`, x, value, label: `${formatNumber(Math.abs(value), 6)} ${unit}` });
/** The shaft the page opens with: 23 in in four diameters, a bearing in each journal, a gear and a pulley. */
const example = (over: Partial<ShaftDrawing> = {}): ShaftDrawing => ({
  L: 23,
  lengthUnit: 'in',
  segments: seg([4, 1.5], [10, 2], [4, 1.5], [5, 1.25]),
  bearings: [{ x: 2, reaction: 373.6 }, { x: 16, reaction: 1026.4 }],
  forces: [force(9, 1000), force(21, 400)],
  couples: [],
  ownWeight: false,
  ...over,
});
const plain = (L: number, d: number, over: Partial<ShaftDrawing> = {}): ShaftDrawing => ({ L, lengthUnit: 'in', segments: seg([L, d]), bearings: [{ x: 0, reaction: null }, { x: L, reaction: null }], forces: [], couples: [], ownWeight: false, ...over });

describe('shaft drawing: the profile', () => {
  it('a rectangle per segment: as long as the segment on the diagrams’ scale, as tall as its diameter, centred on the axis', () => {
    for (const width of WIDTHS) {
      const drawing = example();
      const svg = draw(drawing, { width });
      const { y } = axis(svg);
      const got = segs(svg);
      expect(got).toHaveLength(4);
      // One scale across the shaft: what the thickest segment is drawn with.
      const scale = shaftHeight(2, 23, width) / 2;
      for (const [i, s] of drawing.segments.entries()) {
        expect(got[i].x, `${width} px, segment ${i + 1}`).toBe(xToPx(s.from, 23, width));
        expect(got[i].x + got[i].w).toBeCloseTo(xToPx(s.to, 23, width), 9);
        expect(got[i].h).toBeCloseTo(s.d * scale, 9);
        expect(got[i].y + got[i].h / 2).toBeCloseTo(y, 9);
      }
      // A shoulder is the shoulder it is: the journal is three quarters of the body, the end five eighths.
      expect(got[0].h / got[1].h).toBeCloseTo(0.75, 12);
      expect(got[3].h / got[1].h).toBeCloseTo(0.625, 12);
    }
  });

  it('the scale across is the scale along where that gives the largest diameter 24 to 52 px', () => {
    // 10 in of 1 in bar drawn 460 px wide: 400 px for 10 in, so 40 px to the inch along it - and across it.
    expect(shaftHeight(1, 10, 460)).toBe(40);
    expect(segs(draw(plain(10, 1), { width: 460 }))[0]).toEqual({ x: 30, y: expect.any(Number), w: 400, h: 40 });
    // To the whole pixel each side of the axis: 37.4 px is drawn 38.
    expect(shaftHeight(1, 10.7, 460)).toBe(38);
    for (const [d, L, width] of [[1, 10, 460], [2, 23, 500], [3, 40, 724], [55, 900, 724], [1.4, 30, 1100]]) {
      const along = (width - 60) / L;
      expect(d * along).toBeGreaterThan(24);
      expect(d * along).toBeLessThan(52);
      expect(Math.abs(shaftHeight(d, L, width) - d * along), `${d} of ${L} at ${width}`).toBeLessThanOrEqual(1);
    }
  });

  it('a shaft 40 diameters long is not a hairline, and one 3 diameters long does not fill the page', () => {
    for (const width of WIDTHS) {
      // To scale they would be 5.5 to 26 px and 73 to 347 px tall.
      expect(shaftHeight(1, 40, width), `slender at ${width}`).toBeGreaterThanOrEqual(24);
      expect(shaftHeight(1, 40, width)).toBeLessThanOrEqual(26);
      expect(shaftHeight(1, 3, width), `stub at ${width}`).toBe(52);
      expect(segs(draw(plain(40, 1), { width }))[0].h).toBe(shaftHeight(1, 40, width));
      expect(segs(draw(plain(3, 1), { width }))[0].h).toBe(52);
    }
    expect(shaftHeight(1, 40, 280)).toBe(24);
    // Never an odd number of pixels: the axis is on a whole one.
    for (let width = 280; width <= 1100; width += 1) expect(shaftHeight(1.37, 23.4, width) % 2).toBe(0);
  });

  it('the drawing is as tall as its shaft needs: 200 px and the largest diameter, twice', () => {
    for (const [drawing, width] of [[example(), 280], [example(), 724], [plain(3, 1), 500], [plain(10, 1), 460]] as const) {
      const svg = draw(drawing, { width });
      const tall = Math.max(...segs(svg).map((s) => s.h));
      expect(frame(svg)).toEqual({ width, height: 200 + tall, top: 0 });
      // The axis: under the level the arrows start from by the shortest arrow and half the largest diameter.
      expect(axis(svg).y).toBe(P_TOP + P_MIN + tall / 2);
    }
  });

  it('the axis is a line that runs 10 px past both ends', () => {
    for (const width of [280, 724]) expect(axis(draw(example(), { width }))).toEqual({ y: expect.any(Number), x1: 20, x2: width - 20 });
  });

  it('the bore of a hollow segment is two dashed lines, on the same scale as the diameters; a solid one has none', () => {
    const drawing = example({ segments: seg([4, 1.5], [10, 2, 1], [4, 1.5, 1], [5, 1.25]) });
    const svg = draw(drawing);
    const { y } = axis(svg);
    const scale = shaftHeight(2, 23, 724) / 2;
    const level = bores(svg).filter((b) => b.y1 === b.y2);
    expect(level.map((b) => [b.x1, b.x2, b.y1])).toEqual([
      [xToPx(4, 23, 724), xToPx(14, 23, 724), y - scale / 2],
      [xToPx(4, 23, 724), xToPx(14, 23, 724), y + scale / 2],
      [xToPx(14, 23, 724), xToPx(18, 23, 724), y - scale / 2],
      [xToPx(14, 23, 724), xToPx(18, 23, 724), y + scale / 2],
    ]);
    // Between two segments with the same bore there is no edge inside. This bore ends at 4 in and at 18 in, though:
    // the bottom of a hole is an edge, drawn across it.
    const upright = bores(svg).filter((b) => b.x1 === b.x2);
    expect(upright.map((b) => [b.x1, b.y1, b.y2])).toEqual([
      [xToPx(4, 23, 724), y - scale / 2, y + scale / 2],
      [xToPx(18, 23, 724), y - scale / 2, y + scale / 2],
    ]);
    expect(bores(draw(example()))).toEqual([]);
  });

  it('where the bore changes, the step inside is drawn on each side of the axis', () => {
    const svg = draw(example({ segments: seg([4, 1.5, 0.5], [10, 2, 1], [9, 1.5, 0.5]) }));
    const { y } = axis(svg);
    const scale = shaftHeight(2, 23, 724) / 2;
    expect(bores(svg).filter((b) => b.x1 === b.x2).map((b) => [b.x1, b.y1, b.y2])).toEqual([
      [xToPx(4, 23, 724), y - scale / 2, y - scale / 4],
      [xToPx(4, 23, 724), y + scale / 4, y + scale / 2],
      [xToPx(14, 23, 724), y - scale / 2, y - scale / 4],
      [xToPx(14, 23, 724), y + scale / 4, y + scale / 2],
    ]);
  });

  it('a diameter that is not one is not drawn, and writes nothing into the drawing; a bore that is no bore is none', () => {
    // model.ts hands a diameter that is not a positive number as 0. Whatever it is handed, the drawing has no NaN.
    for (const d of [0, -1, Number.NaN, Infinity]) {
      const svg = draw(example({ segments: [{ from: 0, to: 4, d: 1.5, bore: 0 }, { from: 4, to: 14, d, bore: 0 }, { from: 14, to: 23, d: 1.25, bore: 0 }] }));
      expect(svg, String(d)).not.toMatch(/NaN|Infinity|undefined/);
      expect(segs(svg).map((s) => s.x)).toEqual([30, xToPx(14, 23, 724)]);
      // The scale is that of what is left; the segment still has its two ends on the dimension line.
      expect(segs(svg)[0].h).toBe(shaftHeight(1.5, 23, 724));
      expect(dims(svg).texts.map((t) => t.text)).toEqual(['0', '2', '4', '14', '16', '23']);
      // A force over it ends on the axis: there is no surface there.
      expect(arrows(svg)[0].bottom).toBe(axis(svg).y);
    }
    for (const bore of [1.5, 2, -0.5, Number.NaN, Infinity]) {
      const svg = draw(example({ segments: [{ from: 0, to: 23, d: 1.5, bore }] }));
      expect(svg, String(bore)).not.toMatch(/NaN|Infinity|undefined/);
      expect(bores(svg)).toEqual([]);
    }
    // No shaft at all: an axis, a dimension line, and nothing else to trip over.
    const none = draw({ L: Number.NaN, lengthUnit: 'in', segments: [], bearings: [], forces: [], couples: [], ownWeight: true });
    expect(none).not.toMatch(/NaN|Infinity|undefined/);
    expect(segs(none)).toEqual([]);
  });
});

describe('shaft drawing: a diameter no shaft has', () => {
  // A diameter can be a positive number and no shaft's: 1e200, or every diameter 1e-310. Its row says so (the
  // engine takes no number of that size) and the drawing is handed it all the same. Scaled as px to a unit of
  // diameter, 2R / dMax was past the largest number there is for a largest diameter under 3e-307, and d × d for a
  // diameter of 1.4e154 or more: the drawing wrote Infinity and NaN into its SVG.
  const unsound = (g: ShaftLayout) => JSON.stringify(g, (_, v) => (typeof v === 'number' && !Number.isFinite(v) ? 'NOT A NUMBER' : v)).split('NOT A NUMBER').length - 1;

  it('one diameter of 1e200 beside ordinary ones, with the shaft’s own weight: every number of the drawing is one', () => {
    const drawing = example({ ownWeight: true, segments: seg([4, 1.5], [10, 1e200], [4, 1.5], [5, 1.25]) });
    for (const resultants of [false, true]) {
      for (const width of WIDTHS) {
        expect(unsound(shaftLayout(drawing, { resultants, width })), String(width)).toBe(0);
        expect(draw(drawing, { resultants, width }), String(width)).not.toMatch(/NaN|Infinity|undefined/);
      }
    }
    // Each diameter by its share of the largest: the 1e200 is the whole height, the others none of it; and the
    // band of the weight is 10 px over it and 3 px over the rest.
    const g = shaftLayout(drawing, { resultants: false, width: 724 });
    expect(g.segments.map((s) => s.r)).toEqual([expect.closeTo(0, 12), shaftHeight(1e200, 23, 724) / 2, expect.closeTo(0, 12), expect.closeTo(0, 12)]);
    expect(g.weight.map((w) => w.height)).toEqual([3, 10, 3, 3]);
  });

  it('every diameter 1e-310: the shaft is drawn 24 px tall, in numbers', () => {
    const drawing = example({ segments: seg([4, 1e-310], [10, 1e-310, 4e-311], [4, 1e-310], [5, 1e-310]) });
    for (const resultants of [false, true]) {
      for (const width of WIDTHS) {
        expect(unsound(shaftLayout(drawing, { resultants, width })), String(width)).toBe(0);
        expect(draw(drawing, { resultants, width }), String(width)).not.toMatch(/NaN|Infinity|undefined/);
      }
    }
    const g = shaftLayout(drawing, { resultants: false, width: 724 });
    expect(g.segments.map((s) => s.r)).toEqual([12, 12, 12, 12]);
    // The bore, by the same share: four tenths of the radius, each side of the axis.
    expect(g.bores.filter((b) => b.y1 === b.y2).map((b) => Math.abs(b.y1 - g.axis))).toEqual([expect.closeTo(4.8, 9), expect.closeTo(4.8, 9)]);
  });

  it('at any size a number can have: one diameter of the four, or all of them, with the weight and with a bore', () => {
    let drawings = 0;
    for (let e = -322; e <= 308; e += 3) {
      const d = Number(`1e${e}`);
      if (!(d > 0)) continue;
      for (const segments of [seg([4, 1.5], [10, d], [4, 1.5], [5, 1.25]), seg([4, d], [10, d], [4, d], [5, d]), seg([4, d, d / 2], [10, d], [4, d, d / 4], [5, d])]) {
        for (const ownWeight of [false, true]) {
          drawings += 1;
          expect(unsound(shaftLayout(example({ segments, ownWeight }), { resultants: false, width: 724 })), `1e${e}`).toBe(0);
        }
      }
    }
    expect(drawings).toBeGreaterThan(1200);
  });

  it('an ordinary shaft is drawn as it was: a diameter half the largest is half as tall, to the last figure', () => {
    const g = shaftLayout(example({ segments: seg([4, 1.5], [10, 2, 1], [4, 1], [5, 0.5]), ownWeight: true }), { resultants: false, width: 724 });
    const R = shaftHeight(2, 23, 724) / 2;
    expect(g.segments.map((s) => s.r)).toEqual([0.75 * R, R, 0.5 * R, 0.25 * R]);
    // The band: by the metal in each section - d² less the bore's - over the most there is of it, 3 of 4.
    expect(g.weight.map((w) => w.height)).toEqual([3 + 7 * (2.25 / 3), 10, 3 + 7 * (1 / 3), 3 + 7 * (0.25 / 3)].map((h) => expect.closeTo(h, 9)));
  });
});

describe('shaft drawing: the bearings', () => {
  it('each is the triangle of a simple support, its tip on the under side of the shaft where the bearing stands', () => {
    for (const width of WIDTHS) {
      const svg = draw(example(), { width });
      const { y } = axis(svg);
      const journal = segs(svg)[0].h / 2;
      expect(pins(svg)).toEqual([
        { x: xToPx(2, 23, width), y: y + journal, base: y + journal + 17, half: 10, foot: y + journal + 17.5, from: xToPx(2, 23, width) - 14, to: xToPx(2, 23, width) + 14 },
        { x: xToPx(16, 23, width), y: y + journal, base: y + journal + 17, half: 10, foot: y + journal + 17.5, from: xToPx(16, 23, width) - 14, to: xToPx(16, 23, width) + 14 },
      ]);
    }
  });

  it('under a thin journal the triangle stands higher than under a thick one; at a step it is on the thicker part', () => {
    const svg = draw(example({ bearings: [{ x: 9, reaction: null }, { x: 21, reaction: null }] }));
    const { y } = axis(svg);
    expect(pins(svg).map((p) => p.y)).toEqual([y + 26, y + (1.25 * 26) / 2]);
    // At 4 in the 1.5 in journal meets the 2 in body: the tip is under the body, and the shoulder hides none of it.
    const step = draw(example({ bearings: [{ x: 4, reaction: null }, { x: 18, reaction: null }] }));
    expect(pins(step).map((p) => [p.x, p.y])).toEqual([
      [xToPx(4, 23, 724), y + 26],
      [xToPx(18, 23, 724), y + (1.5 * 26) / 2],
    ]);
  });

  it('the triangles are drawn before the shaft, which hides what of them a shoulder covers', () => {
    const svg = draw(example());
    expect(svg.indexOf('mp-shaft-fig__bearing')).toBeGreaterThan(0);
    expect(svg.lastIndexOf('mp-shaft-fig__bearing')).toBeLessThan(svg.indexOf('mp-shaft-fig__body'));
  });

  it('a bearing in a groove narrower than its triangle: the tip at the mouth of the groove, not inside two shoulders', () => {
    // A groove 0.1 in wide (3 px) between two collars, the thinner of them 1.75 in.
    const svg = draw(example({ segments: seg([8, 2], [0.1, 1], [14.9, 1.75]), bearings: [{ x: 8.05, reaction: null }, { x: 22, reaction: null }] }));
    expect(pins(svg)[0].y).toBe(axis(svg).y + (1.75 * 26) / 2);
  });

  it('one bearing on the shaft, or none: what there is, and no more', () => {
    expect(pins(draw(example({ bearings: [{ x: 16, reaction: 12 }] })))).toHaveLength(1);
    expect(pins(draw(example({ bearings: [] })))).toEqual([]);
    // A place off the shaft is not on the drawing (model.ts leaves it out; so does the drawing).
    expect(pins(draw(example({ bearings: [{ x: 30, reaction: 1 }, { x: Number.NaN, reaction: 1 }] })))).toEqual([]);
  });
});

describe('shaft drawing: the loads of a plane', () => {
  it('a force is an arrow from one level down to the surface of the shaft under it, whatever its thickness there', () => {
    for (const width of WIDTHS) {
      const svg = draw(example(), { width });
      const { y } = axis(svg);
      const [gear, pulley] = arrows(svg);
      const got = segs(svg);
      expect([gear.x, gear.straight, gear.top, gear.bottom], String(width)).toEqual([xToPx(9, 23, width), true, P_TOP, y - got[1].h / 2]);
      expect([pulley.x, pulley.straight, pulley.top, pulley.bottom], String(width)).toEqual([xToPx(21, 23, width), true, P_TOP, y - got[3].h / 2]);
      // Over the thickest part the arrow is the shortest there is: 52 px.
      expect(gear.bottom - gear.top).toBe(P_MIN);
      expect(pulley.bottom - pulley.top).toBeGreaterThan(P_MIN);
    }
  });

  it('a positive force points down at the shaft; a negative one points up, away from it', () => {
    const svg = draw(example({ forces: [force(9, 1000), force(12, -250)] }));
    const [down, up] = arrows(svg);
    // Down: the tip is on the surface, the base of the head above it.
    expect(down.tip).toEqual([down.x, down.bottom]);
    expect(down.base!).toBeLessThan(down.tip![1]);
    // Up: the tip is where the arrow starts, the base of the head under it.
    expect(up.tip).toEqual([up.x, P_TOP]);
    expect(up.base!).toBeGreaterThan(up.tip![1]);
    expect(values(svg).map((v) => v.text)).toEqual(['1,000 lbf', '250 lbf']);
  });

  it('at a step a force ends on the thicker part', () => {
    const svg = draw(example({ forces: [force(4, 100)] }));
    expect(arrows(svg)[0].bottom).toBe(axis(svg).y - 26);
  });

  it('a couple is an arc about the axis, 14 px clear of the thickest part, with its head at the end it turns towards', () => {
    for (const width of [280, 724]) {
      const svg = draw(example({ couples: [couple(6, 500), couple(12, -500)] }), { width });
      const { y } = axis(svg);
      const R = shaftHeight(2, 23, width) / 2;
      const [ccw, cw] = arcs(svg);
      for (const [arc, x] of [[ccw, 6], [cw, 12]] as const) {
        expect(arc.r).toBe(R + C_OUT);
        expect(arc.x).toBeCloseTo(xToPx(x, 23, width), 1);
        // Its two ends at one height, a little under the axis; its top over the shaft.
        expect(arc.start[1]).toBe(arc.end[1]);
        expect(arc.start[1]).toBeCloseTo(y + arc.r * Math.sin((20 * Math.PI) / 180), 1);
        expect(arc.start[0]).toBeLessThan(arc.end[0]);
      }
      // Counter-clockwise, as seen: over the top from right to left, so the head is at the LEFT end, pointing down.
      // Its first point is its tip: under the end of the arc, and under its own base.
      const [tip, ...base] = ccw.head!;
      expect(Math.abs(tip[0] - ccw.start[0])).toBeLessThan(4);
      expect(tip[1]).toBeGreaterThan(ccw.start[1]);
      for (const p of base) expect(p[1]).toBeLessThan(ccw.start[1]);
      // Clockwise: the head at the RIGHT end.
      const [tip2, ...base2] = cw.head!;
      expect(Math.abs(tip2[0] - cw.end[0])).toBeLessThan(4);
      expect(tip2[1]).toBeGreaterThan(cw.end[1]);
      for (const p of base2) expect(p[1]).toBeLessThan(cw.end[1]);
    }
  });

  it('a couple’s value is by its own arc, on the line above the arcs: over its middle, or beside an arrow that would cross it', () => {
    const alone = draw(example({ forces: [], couples: [couple(9, 500)] }));
    expect(values(alone).map((v) => [v.text, v.x, v.y, v.turned])).toEqual([['500 lbf·in', tenth(xToPx(9, 23, 724)), 83, false]]);
    // With a force at the same place the arrow would run through the value: the value stands beside the arrow.
    const svg = draw(example({ forces: [force(9, 1000)], couples: [couple(9, 500)] }));
    const [moment, load] = values(svg);
    const arrow = arrows(svg)[0].x;
    expect([moment.text, moment.y, load.text, load.x, load.y]).toEqual(['500 lbf·in', 83, '1,000 lbf', tenth(arrow), 46]);
    // 6 px from the line of the arrow, on the side nearer to where it would have been.
    expect(Math.min(Math.abs(moment.l - arrow), Math.abs(moment.r - arrow))).toBeCloseTo(6, 0);
    expect(moment.l > arrow || moment.r < arrow).toBe(true);
  });

  it('a size that is not a number, or is nothing, is not drawn and has no value', () => {
    const svg = draw(example({ forces: [force(9, 1000), { id: 'a', x: 5, value: Number.NaN, label: 'NaN lbf' }, { id: 'b', x: 6, value: 0, label: '0 lbf' }, { id: 'c', x: 40, value: 5, label: '5 lbf' }], couples: [{ id: 'd', x: 7, value: Infinity, label: '— lbf·in' }] }));
    expect(svg).not.toMatch(/NaN|Infinity|undefined|—/);
    expect(arrows(svg)).toHaveLength(1);
    expect(arcs(svg)).toEqual([]);
    expect(values(svg).map((v) => v.text)).toEqual(['1,000 lbf']);
  });

  it('the shaft’s own weight is a band on its top, taller over the heavier segment, and carries no value', () => {
    const drawing = example({ ownWeight: true, segments: seg([4, 1.5], [10, 2, 1], [4, 1.5], [5, 1]) });
    const svg = draw(drawing);
    const { y } = axis(svg);
    const band = tags(groups(svg, 'weight')[0], 'rect').map((t) => ({ x: attr(t, 'x'), y: attr(t, 'y'), w: attr(t, 'width'), h: attr(t, 'height') }));
    const body = segs(svg);
    expect(band).toHaveLength(4);
    // By the metal in each section, d² less the bore's: 2.25, 3, 2.25 and 1. From 3 px to 10 px.
    const metal = [2.25, 3, 2.25, 1];
    for (const [i, b] of band.entries()) {
      expect([b.x, b.w]).toEqual([body[i].x, body[i].w]);
      expect(b.h).toBeCloseTo(3 + 7 * (metal[i] / 3), 9);
      // It stands on the segment's own top.
      expect(b.y + b.h).toBeCloseTo(y - body[i].h / 2, 9);
    }
    expect(values(svg).map((v) => v.text)).toEqual(['1,000 lbf', '400 lbf']);
    // Its small arrows, only where it is 9 px tall or more, point down at the shaft.
    const small = tags(groups(svg, 'weight')[0], 'polygon').map(pointsOf);
    expect(small.length).toBeGreaterThan(3);
    for (const [tip, left] of small) {
      expect(tip[0]).toBeGreaterThan(body[1].x);
      expect(tip[0]).toBeLessThan(body[1].x + body[1].w);
      expect(tip[1]).toBe(y - 26);
      expect(left[1]).toBeLessThan(tip[1]);
    }
    expect(draw(example())).not.toContain('mp-shaft-fig__weight');
  });

  it('the position asked about is a thin line down the drawing, at its place', () => {
    const svg = draw(example(), { probeX: 12.5 });
    const probe = svg.match(/<line class="mp-plot__probe-line"[^>]*>/)![0];
    expect([attr(probe, 'x1'), attr(probe, 'x2'), attr(probe, 'y1'), attr(probe, 'y2')]).toEqual([xToPx(12.5, 23, 724), xToPx(12.5, 23, 724), 8, dims(svg).y - 4]);
    expect(draw(example())).not.toContain('mp-plot__probe-line');
    expect(draw(example(), { probeX: Number.NaN })).not.toContain('mp-plot__probe-line');
    // Past an end of the shaft it is at that end, not off the drawing.
    expect(attr(draw(example(), { probeX: 40 }).match(/<line class="mp-plot__probe-line"[^>]*>/)![0], 'x1')).toBe(694);
  });
});

describe('shaft drawing: a reaction is an arrow under its bearing', () => {
  it('on the bearing’s own line, pointing up at it, with its value beside it to four figures', () => {
    for (const width of WIDTHS) {
      const svg = draw(example(), { width });
      const [left, right] = reactions(svg);
      const [a, b] = pins(svg);
      expect([left.x, right.x], String(width)).toEqual([a.x, b.x]);
      for (const [r, p] of [[left, a], [right, b]] as const) {
        expect(r.tip![0]).toBe(r.x);
        // Upward: the tip above the base of its head, and 12 px under the foot of the triangle.
        expect(r.tip![1]).toBeLessThan(r.base!);
        expect(r.top).toBe(p.base + 12);
        expect(r.bottom).toBe(p.base + 36);
      }
      expect([left.text!.text, left.text!.anchor, left.text!.x - left.x!]).toEqual(['373.6', 'start', 9]);
      expect([right.text!.text, right.text!.anchor, right.text!.x - right.x!]).toEqual(['1,026', 'start', 9]);
    }
  });

  it('a reaction that pulls down points down; none at all is its value alone, under the bearing', () => {
    const svg = draw(example({ bearings: [{ x: 2, reaction: -125.5 }, { x: 16, reaction: 0 }] }));
    const [down, none] = reactions(svg);
    expect(down.tip![1]).toBeGreaterThan(down.base!);
    expect(down.text!.text).toBe('125.5');
    expect([none.x, none.tip]).toEqual([null, null]);
    expect([none.text!.text, none.text!.anchor, none.text!.x]).toEqual(['0', 'middle', pins(svg)[1].x]);
    // What prints as nothing is nothing: no arrow beside a 0.
    expect(reactions(draw(example({ bearings: [{ x: 2, reaction: 3e-13 }, { x: 16, reaction: -3e-13 }] }))).map((r) => [r.x, r.text!.text])).toEqual([[null, '0'], [null, '0']]);
  });

  it('before the shaft is solved there is no reaction to draw', () => {
    const svg = draw(example({ bearings: [{ x: 2, reaction: null }, { x: 16, reaction: null }] }));
    expect(reactions(svg)).toEqual([]);
    expect(pins(svg)).toHaveLength(2);
    expect(draw(example({ bearings: [{ x: 2, reaction: Number.NaN }, { x: 16, reaction: Infinity }] }))).not.toMatch(/NaN|Infinity|—|mp-shaft-fig__reaction/);
  });

  it('the last bearing of the drawing writes inside, whatever its number', () => {
    for (const reaction of [16, 1234.5, 0.004]) {
      for (const width of [280, 330, 520, 760, 1100]) {
        const [left, right] = reactions(draw(example({ bearings: [{ x: 0, reaction }, { x: 23, reaction }] }), { width }));
        expect([left.text!.anchor, right.text!.anchor], `${reaction} at ${width}`).toEqual(['start', 'end']);
        expect(right.text!.x).toBe(right.x! - 9);
      }
    }
  });

  it('between two bearings close together a value is not anybody’s: each is written on its outer side', () => {
    // Two bearings 2.4 in apart on a 20 in shaft drawn 500 px wide: 53 px. "5,400" beside the left arrow, inside,
    // would end 9 px before the right one - as far from the one as from the other.
    const close = (width: number) => reactions(draw({ L: 20, lengthUnit: 'in', segments: seg([3, 1.5], [1.2, 2.5], [15.8, 1.25]), bearings: [{ x: 2.2, reaction: -5400.25 }, { x: 4.6, reaction: 6200.25 }], forces: [force(19, 800)], couples: [], ownWeight: false }, { width }));
    const [left, right] = close(500);
    expect([left.text!.text, left.text!.anchor, right.text!.text, right.text!.anchor]).toEqual(['5,400', 'end', '6,200', 'start']);
    // With room for it between them - 18 px to the other arrow, twice what it keeps from its own - it is inside.
    expect(close(1100).map((r) => r.text!.anchor)).toEqual(['start', 'start']);
    for (const width of WIDTHS) {
      const got = close(width);
      for (const [i, r] of got.entries()) {
        if (!r.box) continue;
        const other = got[1 - i].x!;
        expect(Math.min(Math.abs(r.box.l - other), Math.abs(r.box.r - other)), `${r.box.text} at ${width} px`).toBeGreaterThanOrEqual(18 - 1e-6);
        expect(other < r.box.l || other > r.box.r).toBe(true);
      }
    }
  });

  it('a value that has no place of its own is left to the table: the arrows are there all the same', () => {
    // Two bearings 6 px apart at the left end of a phone's drawing. The first has no room outside, and inside is
    // the other's arrow; the second, written beside its own arrow, would be 15 px from the first one's.
    const svg = draw(example({ bearings: [{ x: 0, reaction: 12345.6 }, { x: 0.6, reaction: -11111.1 }] }), { width: 280 });
    const got = reactions(svg);
    expect(got.map((r) => r.x)).toEqual([30, xToPx(0.6, 23, 280)]);
    expect(got.map((r) => [r.tip![1] < r.base!, r.text])).toEqual([[true, null], [false, null]]);
    // A few inches further on, the second has its place.
    expect(reactions(draw(example({ bearings: [{ x: 0, reaction: 12345.6 }, { x: 2, reaction: -11111.1 }] }), { width: 280 })).map((r) => r.text?.text ?? null)).toEqual([null, '11,110']);
  });
});

describe('shaft drawing: both planes together', () => {
  const both = (width: number) =>
    draw(example({ ownWeight: true, bearings: [{ x: 2, reaction: 414.7 }, { x: 16, reaction: 1042 }], forces: [force(9, 1063), force(21, 400)], couples: [couple(9, 3990), couple(15, 1756)] }), { width, resultants: true });

  it('nothing is an arrow: a resultant has no one direction on paper', () => {
    for (const width of WIDTHS) {
      const svg = both(width);
      expect(svg, String(width)).not.toContain('mp-shaft-fig__head');
      // The only triangles left are the two bearings.
      expect(svg.match(/<polygon[^>]*>/g)).toEqual([expect.stringContaining('mp-shaft-fig__pin'), expect.stringContaining('mp-shaft-fig__pin')]);
    }
  });

  it('a force is a line with a dot on the axis, a couple an arc with no head', () => {
    const svg = both(724);
    const { y } = axis(svg);
    expect(arrows(svg).map((a) => [a.x, a.top, a.bottom, a.tip, a.dot])).toEqual([
      [xToPx(9, 23, 724), P_TOP, y, null, { x: xToPx(9, 23, 724), y }],
      [xToPx(21, 23, 724), P_TOP, y, null, { x: xToPx(21, 23, 724), y }],
    ]);
    expect(arcs(svg).map((a) => [a.r, a.head])).toEqual([[40, null], [40, null]]);
    expect(values(svg).map((v) => v.text).sort()).toEqual(['1,063 lbf', '1,756 lbf·in', '3,990 lbf·in', '400 lbf']);
  });

  it('a bearing’s radial load is a number under its triangle, with no arrow', () => {
    for (const width of WIDTHS) {
      const svg = both(width);
      const got = reactions(svg);
      const [a, b] = pins(svg);
      expect(got.map((r) => [r.x, r.tip]), String(width)).toEqual([[null, null], [null, null]]);
      expect(got.map((r) => [r.text!.text, r.text!.anchor, r.text!.x])).toEqual([['414.7', 'middle', a.x], ['1,042', 'middle', b.x]]);
      // Its top 8 px under the line the triangle stands on.
      expect(got[0].box!.t).toBe(a.foot + 7.5);
    }
  });

  it('the band of the shaft’s own weight, if it is asked for there, has no arrows either', () => {
    const svg = draw(example({ ownWeight: true }), { resultants: true });
    expect(tags(groups(svg, 'weight')[0], 'rect')).toHaveLength(4);
    expect(svg).not.toContain('mp-shaft-fig__head');
  });

  it('the same sizes in one plane are arrows', () => {
    const svg = draw(example({ couples: [couple(9, 3990)] }));
    expect(arrows(svg).every((a) => a.tip !== null && a.dot === null)).toBe(true);
    expect(arcs(svg).every((a) => a.head !== null)).toBe(true);
  });
});

/**
 * THE DRAWING OF THE SHAFT: the positions written under it.
 *
 * A tick at every place where something is. The numbers: the two ends, the
 * bearings, the steps - and where two would run together, one is left out.
 * Never an end: the last number on that line, beside the unit, is read as
 * the length of the shaft.
 */
describe('shaft drawing: the dimension line', () => {
  const texts = (drawing: ShaftDrawing, more: More = {}) => {
    const d = dims(draw(drawing, more));
    return [...d.texts.map((t) => t.text), d.unit.text];
  };

  it('0, each bearing, each step and the length, with the unit after it', () => {
    expect(texts(example())).toEqual(['0', '2', '4', '14', '16', '18', '23', 'in']);
    expect(texts(example({ lengthUnit: 'mm' })).pop()).toBe('mm');
    const d = dims(draw(example()));
    expect(d.texts.map((t) => t.x)).toEqual([0, 2, 4, 14, 16, 18, 23].map((x) => xToPx(x, 23, 724)));
    expect([d.from, d.to, d.unit.r]).toEqual([30, 694, 722]);
  });

  it('a tick at every place where something is: a load’s too, which has no number', () => {
    const d = dims(draw(example({ couples: [couple(11.5, 500)] })));
    expect([...d.ticks].sort((p, q) => p - q)).toEqual([0, 2, 4, 9, 11.5, 14, 16, 18, 21, 23].map((x) => xToPx(x, 23, 724)));
    // A bearing at a step, a force at a bearing: one place, one tick, one number.
    const shared = dims(draw(example({ bearings: [{ x: 4, reaction: null }, { x: 18, reaction: null }], forces: [force(4, 100)] })));
    expect(shared.ticks).toHaveLength(5);
    expect(shared.texts.map((t) => t.text)).toEqual(['0', '4', '14', '18', '23']);
  });

  // A shoulder is the SUM of the lengths before it, and the sum is not always the number a person types for the
  // same place: 12.7 + 25.4 is 38.099999999999994, and a bearing typed at 38.1 stands on that shoulder. Two
  // numbers, one position on the line. Told apart by their numbers they were two ticks at one pixel - two lines
  // with one key for React, which then left one of them on the drawing at every later draw of it: after an
  // edit, after a turn of the window, and on the printed sheet.
  it('two places that are one position on the line are one tick: no two ticks within a tenth of a pixel, at any width', () => {
    /** Every place of a drawing has its tick, and no tick is within a tenth of a pixel of another. */
    const held = (drawing: ShaftDrawing, what: string) => {
      for (const width of WIDTHS) {
        const g = shaftLayout(drawing, { resultants: false, width });
        const sorted = [...g.ticks].sort((p, q) => p - q);
        expect(new Set(g.ticks).size, `${what} at ${width}`).toBe(g.ticks.length);
        expect(sorted.every((x, i) => i === 0 || x - sorted[i - 1] >= 0.1), `${what} at ${width}: ${sorted.join(' ')}`).toBe(true);
        for (const x of [0, g.L, ...drawing.segments.flatMap((s) => [s.from, s.to]), ...[...drawing.bearings, ...drawing.forces, ...drawing.couples].map((p) => p.x)]) {
          expect(g.ticks.some((t) => Math.abs(t - xToPx(x, g.L, width)) < 0.1), `${what} at ${width}: a tick for ${x}`).toBe(true);
        }
      }
    };
    const summed: ShaftDrawing = { L: 12.7 + 25.4 + 200, lengthUnit: 'mm', segments: seg([12.7, 25], [25.4, 40], [200, 30]), bearings: [{ x: 38.1, reaction: null }, { x: 200, reaction: null }], forces: [force(120, 5000, 'N')], couples: [], ownWeight: false };
    expect(summed.segments[1].to).not.toBe(38.1);
    held(summed, '12.7 + 25.4 mm and a bearing at 38.1');
    // Six places - the two ends, the two shoulders, the force and the other bearing - and six ticks, in the markup too.
    for (const width of WIDTHS) {
      const d = dims(draw(summed, { width }));
      expect(d.ticks, String(width)).toEqual(shaftLayout(summed, { resultants: false, width }).ticks);
      expect(d.ticks, String(width)).toHaveLength(6);
      expect(d.texts.map((t) => t.text)).toContain('38.1');
    }
    const inches: ShaftDrawing = { L: 0.1 + 0.7 + 10, lengthUnit: 'in', segments: seg([0.1, 1.5], [0.7, 2], [10, 1.5]), bearings: [{ x: 0.8, reaction: null }, { x: 8.8, reaction: null }], forces: [force(4.8, 1000)], couples: [couple(0.8, 50)], ownWeight: false };
    held(inches, '0.1 + 0.7 in and a bearing at 0.8');
    // It is no odd shaft: lengths by tenths of an inch, wherever the second shoulder is not the number typed for it.
    let [shafts, was] = [0, 0];
    for (let a = 1; a <= 60; a += 3) {
      for (let b = 1; b <= 60; b += 2) {
        const typed = Number((a / 10 + b / 10).toPrecision(12));
        if (a / 10 + b / 10 === typed) continue;
        shafts += 1;
        const drawing: ShaftDrawing = { L: a / 10 + b / 10 + 10, lengthUnit: 'in', segments: seg([a / 10, 1.5], [b / 10, 2], [10, 1.5]), bearings: [{ x: typed, reaction: null }, { x: typed + 6, reaction: null }], forces: [force(typed, 100), force(typed + 3, 100)], couples: [], ownWeight: false };
        held(drawing, `${a / 10} + ${b / 10} in`);
        // (What it was: the two numbers at one pixel position, at one of the seven widths or more.)
        was += Number(WIDTHS.some((width) => xToPx(typed, drawing.L, width) === xToPx(a / 10 + b / 10, drawing.L, width)));
      }
    }
    expect(shafts).toBeGreaterThan(80);
    expect(was).toBeGreaterThan(shafts / 2);
    // Places that are apart keep a tick each: a tenth of a pixel is not a place.
    const apart = shaftLayout(plain(20, 2, { forces: [force(10, 100), force(10.02, 100)] }), { resultants: false, width: 724 });
    expect(apart.ticks).toHaveLength(4);
  });

  it('one tick for one place, though two numbers a rounding apart name it: a load or a bearing typed on a shoulder, a bearing typed at the end', () => {
    // 21.7 + 20.9 + 5.61 is 48.209999999999994 as the lengths add up, and the shoulder is typed as 48.21.
    const segments = seg([21.7, 2], [20.9, 2], [5.61, 2], [1.74, 2], [2.59, 2]);
    const L = segments[4].to;
    expect(segments[2].to).not.toBe(48.21);
    expect(Math.abs(segments[2].to - 48.21)).toBeLessThan(1e-13);
    // And 1.1 + 2.2 is 3.3000000000000003: a bearing typed at 3.3, the end of that shaft, is a rounding short of it.
    const short = seg([1.1, 2], [2.2, 2]);
    expect(short[1].to).toBeGreaterThan(3.3);
    expect(short[1].to - 3.3).toBeLessThan(1e-14);
    const between = [{ x: 38.98, reaction: null }, { x: 39.26, reaction: null }];
    const shafts: [what: string, drawing: ShaftDrawing, places: number][] = [
      ['a force typed on a shoulder', { ...example(), L, segments, bearings: between, forces: [force(48.21, 1000)] }, 8],
      ['a couple typed on a shoulder', { ...example(), L, segments, bearings: between, forces: [], couples: [couple(48.21, 500)] }, 8],
      ['a bearing typed on a shoulder', { ...example(), L, segments, bearings: [{ x: 10, reaction: null }, { x: 48.21, reaction: null }], forces: [] }, 7],
      ['a bearing typed at the end', { ...example(), L: short[1].to, segments: short, bearings: [{ x: 0, reaction: null }, { x: 3.3, reaction: null }], forces: [] }, 3],
    ];
    for (const [what, drawing, places] of shafts) {
      for (let width = 280; width <= 1100; width += 1) {
        const { ticks } = shaftLayout(drawing, { resultants: false, width });
        expect(ticks, `${what}, ${width} px`).toHaveLength(places);
        // No two on one pixel: two lines there were one place drawn twice - and, keyed by their pixel, two lines under one key.
        const along = [...ticks].sort((p, q) => p - q);
        for (let i = 1; i < along.length; i += 1) expect(along[i] - along[i - 1], `${what}, ${width} px`).toBeGreaterThan(0.01);
      }
      // As it is drawn: as many lines as places, each at an x of its own - 708 px is the drawing of a 1366 px window,
      // where the force's two numbers came to the very same pixel; 724 the sheet's; 350 a phone's.
      for (const width of [350, 708, 724]) {
        const drawn = dims(draw(drawing, { width })).ticks;
        expect(drawn, `${what}, ${width} px`).toHaveLength(places);
        expect(new Set(drawn).size, `${what}, ${width} px`).toBe(places);
      }
      // The numbers under the line were one to a place already: the step gives way to the bearing, the bearing to the end.
      const written = dims(draw(drawing)).texts.map((t) => t.text);
      expect(new Set(written).size, `${what}: ${written.join(' ')}`).toBe(written.length);
    }
    // The place keeps the pixel of the first that names it: an end before a step, a step before what stands on it.
    expect(shaftLayout(shafts[0][1], { resultants: false, width: 724 }).ticks).toContain(xToPx(segments[2].to, L, 724));
    expect(shaftLayout(shafts[3][1], { resultants: false, width: 724 }).ticks).toEqual([0, short[1].to, 1.1].map((x) => xToPx(x, short[1].to, 724)));
  });

  it('the two ends are named at every width, whatever stands near them, and the places read left to right', () => {
    const shafts: [end: string, drawing: ShaftDrawing][] = [
      ['23', example()],
      ['23', example({ bearings: [{ x: 0.5, reaction: null }, { x: 22.6, reaction: null }] })],
      ['20', { ...example(), L: 20, segments: seg([0.4, 1], [19.2, 2], [0.4, 1]), bearings: [{ x: 0.2, reaction: null }, { x: 19.8, reaction: null }] }],
      ['48', { ...example(), L: 48, segments: seg([4, 1.5], [5, 2.25], [7, 3], [8, 3.75], [8, 3.25], [7, 2.5], [5, 2], [4, 1.5]), bearings: [{ x: 2, reaction: null }, { x: 46, reaction: null }] }],
      ['1,234.57', { ...example(), L: 1234.567, lengthUnit: 'mm', segments: seg([1200, 50], [34.567, 40]), bearings: [{ x: 100, reaction: null }, { x: 1210.5, reaction: null }] }],
    ];
    for (const [end, drawing] of shafts) {
      for (const width of [280, 300, 328, 358, 382, 420, 546, 699, 724, 943, 1100, 1400]) {
        const d = dims(draw(drawing, { width }));
        const got = d.texts.map((t) => t.text);
        expect([got[0], got[got.length - 1]], `${end} at ${width} px: ${got.join(' ')}`).toEqual(['0', end]);
        const at = d.texts.map((t) => t.x);
        expect(at, `${end} at ${width} px`).toEqual([...at].sort((p, q) => p - q));
        // No two run together, none runs past a side, and the length is clear of the unit.
        for (let i = 1; i < d.texts.length; i += 1) expect(d.texts[i].l - d.texts[i - 1].r, `${got[i - 1]} and ${got[i]} at ${width} px`).toBeGreaterThanOrEqual(8 - 1e-9);
        expect(d.texts[0].l).toBeGreaterThanOrEqual(0);
        expect(d.unit.l - d.texts[d.texts.length - 1].r, `${end} and its unit at ${width} px`).toBeGreaterThanOrEqual(4 - 1e-9);
        // The length is still under its own tick: its number reaches over it.
        expect(d.texts[d.texts.length - 1].r + 4).toBeGreaterThanOrEqual(d.to);
      }
    }
  });

  it('where two would run together, a bearing keeps its number before a step does, and an end before either', () => {
    // On a phone 14, 16 and 18 are 19 px apart, and two figures are 14 px wide: the bearing at 16 stays, and the
    // steps either side of it give way. (2 and 4, one figure each, have room.)
    expect(texts(example(), { width: 280 })).toEqual(['0', '2', '4', '16', '23', 'in']);
    // A bearing 0.4 in before the end gives way to the end.
    expect(texts(example({ bearings: [{ x: 2, reaction: null }, { x: 22.6, reaction: null }] }), { width: 280 })).toEqual(['0', '2', '4', '14', '18', '23', 'in']);
    // With room for all, all.
    expect(texts(example(), { width: 500 })).toEqual(['0', '2', '4', '14', '16', '18', '23', 'in']);
  });

  it('a position is written to six figures, as a sum of the lengths typed is - or to as many as the page asks', () => {
    const drawing = example({ L: 23.4375, segments: seg([4.0625, 1.5], [10.125, 2], [9.25, 1.5]) });
    expect(texts(drawing)).toEqual(['0', '2', '4.0625', '14.1875', '16', '23.4375', 'in']);
    expect(texts(drawing, { figures: 4 })).toEqual(['0', '2', '4.063', '14.19', '16', '23.44', 'in']);
  });

  it('the length keeps 4 px from the unit after it, and stays under its tick', () => {
    for (const width of WIDTHS) {
      const d = dims(draw({ ...example(), L: 1234.5, lengthUnit: 'mm', segments: seg([1234.5, 50]), bearings: [] }, { width }));
      const last = d.texts[d.texts.length - 1];
      expect(last.text).toBe('1,234.5');
      // Under its tick it would end 6.2 px inside the unit: it is written as far left as keeps 4 px.
      expect(d.unit.l - last.r, String(width)).toBeCloseTo(4, 9);
      expect(last.l).toBeLessThan(d.to);
      expect(last.r).toBeGreaterThan(d.to);
    }
    // A short one is where it always was: on its tick.
    const short = dims(draw(example()));
    expect(short.texts[short.texts.length - 1].x).toBe(694);
  });
});

describe('shaft drawing: the page’s own way of setting thousands apart, and what a screen reader is told', () => {
  it('every number the drawing writes itself is printed with it: reactions and positions', () => {
    const drawing: ShaftDrawing = { ...example(), L: 1500, lengthUnit: 'mm', segments: seg([1500, 60]), bearings: [{ x: 0, reaction: 12345.6 }, { x: 1250, reaction: -3456.7 }], forces: [{ id: 'a', x: 600, value: 5, label: '20 000 N' }] };
    const all = (svg: string) => [...svg.matchAll(/<text[^>]*>([^<]*)<\/text>/g)].map((m) => m[1]);
    const es = all(draw(drawing, { group: ' ' }));
    expect(es).toEqual(expect.arrayContaining(['12 350', '3 457', '1 250', '1 500', '20 000 N', 'mm']));
    expect(es.filter((s) => s.includes(','))).toEqual([]);
    expect(all(draw(drawing))).toEqual(expect.arrayContaining(['12,350', '3,457', '1,250', '1,500']));
  });

  it('the drawing is one image with one sentence for a name, and its shapes are not read out one by one', () => {
    const svg = draw(example(), { summary: 'A shaft of 23 in on two bearings.' });
    expect(svg).toMatch(/^<figure class="mp-plot mp-shaft-fig"><svg class="mp-plot__svg"[^>]* role="img" aria-label="A shaft of 23 in on two bearings."><g aria-hidden="true">/);
    expect(svg.endsWith('</g></svg></figure>')).toBe(true);
    // Everything drawn is inside that one hidden group.
    expect(svg.match(/aria-hidden="true"/g)).toHaveLength(1);
  });
});

/**
 * THE DRAWING OF THE SHAFT: where the values are written.
 *
 * Every load has its value by it. None is written over another, over the
 * line of an arrow, over an arc or past a side of the drawing, and none is
 * left out to make room - at any width a phone or a desk gives the drawing.
 */

/**
 * What a drawing shows, as far as the rules about what is written on it go.
 * Read from its markup (`read`), or taken from the layout the component
 * draws (`shown`): the same thing twice, by two roads.
 */
type Picture = {
  frame: { width: number; height: number; top: number };
  axis: number;
  /** The thickest part of the shaft, and each segment's place and height. */
  thickest: number;
  segments: { x: number; w: number; h: number }[];
  values: (Box & { turned: boolean })[];
  /** Each force's line, and the box of its head (none for a resultant). */
  arrows: { x: number; top: number; bottom: number; head: { t: number; b: number; half: number } | null }[];
  /** Each couple's arc, and whether it has a head. */
  arcs: { x: number; r: number; headed: boolean }[];
  ties: { x: number; pieces: number[][] }[];
  pins: { x: number; y: number; from: number; to: number; foot: number }[];
  reactions: { x: number | null; box: Box | null }[];
  dim: { y: number; to: number; ticks: number[]; texts: { text: string; l: number; r: number }[]; unit: { text: string; l: number; r: number } };
};

const read = (svg: string): Picture => {
  const d = dims(svg);
  const body = segs(svg);
  return {
    frame: frame(svg),
    axis: axis(svg).y,
    thickest: Math.max(0, ...body.map((s) => s.h)),
    segments: body.map((s) => ({ x: s.x, w: s.w, h: s.h })),
    values: values(svg).map((v) => ({ text: v.text, turned: v.turned, l: v.l, r: v.r, t: v.t, b: v.b })),
    arrows: arrows(svg).map((a) => ({ x: a.x, top: a.top, bottom: a.bottom, head: a.tip ? { t: Math.min(a.tip[1], a.base!), b: Math.max(a.tip[1], a.base!), half: a.half } : null })),
    arcs: arcs(svg).map((c) => ({ x: c.x, r: c.r, headed: c.head !== null })),
    ties: ties(svg),
    pins: pins(svg).map((p) => ({ x: p.x, y: p.y, from: p.from, to: p.to, foot: p.foot })),
    reactions: reactions(svg).map((r) => ({ x: r.x, box: r.box })),
    dim: { y: d.y, to: d.to, ticks: d.ticks, texts: d.texts.map((t) => ({ text: t.text, l: t.l, r: t.r })), unit: d.unit },
  };
};

const shown = (g: ShaftLayout, resultants: boolean): Picture => ({
  frame: { width: g.width, height: g.height, top: 0 - g.rise },
  axis: g.axis,
  thickest: Math.max(0, ...g.segments.map((s) => 2 * s.r)),
  segments: g.segments.map((s) => ({ x: s.x, w: s.width, h: 2 * s.r })),
  values: g.values.map((v) => ({ text: v.text, turned: v.turned, l: v.l, r: v.r, t: v.t, b: v.b })),
  // A head is 10 px wide and 8.5 long: at the tip of an arrow that points down, at its start if it points up.
  arrows: g.forces.map((f) => ({ x: f.at, top: f.top, bottom: f.tip, head: resultants ? null : f.down ? { t: f.tip - 8.5, b: f.tip, half: 5 } : { t: f.top, b: f.top + 8.5, half: 5 } })),
  arcs: g.couples.map((c) => ({ x: c.at, r: g.arc, headed: !resultants })),
  ties: g.ties.map((t) => ({ x: t.x, pieces: t.pieces })),
  // A triangle 17 tall on a line 28 long, half a pixel under it.
  pins: g.bearings.map((b) => ({ x: b.at, y: b.apex, from: b.at - 14, to: b.at + 14, foot: b.apex + 17.5 })),
  reactions: g.reactions.map((r) => {
    const w = r.text.length * CHAR;
    const l = r.anchor === 'start' ? r.x : r.anchor === 'end' ? r.x - w : r.x - w / 2;
    return { x: r.dir ? r.at : null, box: r.shown ? { text: r.text, l, r: l + w, t: r.y - 12, b: r.y + 3 } : null };
  }),
  dim: {
    y: g.dim,
    to: g.to,
    ticks: g.ticks,
    texts: g.positions.map((p) => ({ text: p.text, l: p.at - (p.text.length * DIM_CHAR) / 2, r: p.at + (p.text.length * DIM_CHAR) / 2 })),
    unit: { text: g.unit, l: g.width - 2 - [...g.unit].length * DIM_CHAR, r: g.width - 2 },
  },
});

/** Where two pictures differ, if they do: numbers to a millionth of a pixel - an arc's place to the tenth its path is written to. */
function differ(a: unknown, b: unknown, path = 'picture'): string | null {
  if (typeof a === 'number' && typeof b === 'number') return Math.abs(a - b) <= (/arcs\[\d+\]\.x$/.test(path) ? 0.11 : 1e-6) ? null : `${path}: ${a} read, ${b} laid out`;
  if (Array.isArray(a) && Array.isArray(b)) {
    if (a.length !== b.length) return `${path}: ${a.length} read, ${b.length} laid out`;
    for (let i = 0; i < a.length; i += 1) {
      const found = differ(a[i], b[i], `${path}[${i}]`);
      if (found) return found;
    }
    return null;
  }
  if (a && b && typeof a === 'object' && typeof b === 'object') {
    const keys = [...new Set([...Object.keys(a), ...Object.keys(b)])];
    for (const key of keys) {
      const found = differ((a as Record<string, unknown>)[key], (b as Record<string, unknown>)[key], `${path}.${key}`);
      if (found) return found;
    }
    return null;
  }
  return a === b ? null : `${path}: ${String(a)} read, ${String(b)} laid out`;
}

const overlap = (p: Omit<Box, 'text'>, q: Omit<Box, 'text'>) => Math.min(p.r, q.r) - Math.max(p.l, q.l) > 1e-6 && Math.min(p.b, q.b) - Math.max(p.t, q.t) > 1e-6;
/** Points along an arc, every two degrees: from 20 degrees below the horizontal on the left, over the top, to 20 below it on the right. */
const along = (arc: { x: number; r: number }, y: number) => Array.from({ length: 111 }, (_, i) => ((160 + 2 * i) * Math.PI) / 180).map((a) => [arc.x + arc.r * Math.cos(a), y + arc.r * Math.sin(a)]);

/** What is wrong with a picture, if anything. `loads`: how many values it must have. */
function faults(p: Picture, loads: number): string[] {
  const found: string[] = [];
  const { width, height, top } = p.frame;
  const got = p.values;
  if (got.length !== loads) found.push(`${got.length} values for ${loads} loads`);
  if (p.arrows.length + p.arcs.length !== loads) found.push(`${p.arrows.length} arrows and ${p.arcs.length} arcs for ${loads} loads`);
  // Taller only by what the values took above its own height: the foot of the drawing is 22 px under the dimension line.
  if (top > 0 || Math.abs(height - (p.dim.y + 22 - top)) > 1e-9) found.push(`${height} tall with its top at ${top} and its dimension line at ${p.dim.y}`);
  if (![width, height, top, p.axis, p.thickest].every(Number.isFinite)) found.push('a size of the drawing is not a number');

  const curved = p.arcs.map((c) => along(c, p.axis));
  for (const v of got) {
    if (![v.l, v.r, v.t, v.b].every(Number.isFinite)) found.push(`"${v.text}" is nowhere: ${v.l} ${v.r} ${v.t} ${v.b}`);
    if (v.l < 0 || v.r > width) found.push(`"${v.text}" runs past the side: ${v.l} to ${v.r} of ${width}`);
    if (v.t < top) found.push(`"${v.text}" runs past the top: ${v.t} above ${top}`);
    // Over the line of an arrow, or over its head.
    for (const a of p.arrows) {
      if (a.x > v.l - 1 && a.x < v.r + 1 && a.top < v.b && a.bottom > v.t) found.push(`"${v.text}" is on the arrow at ${a.x}`);
      if (a.head && overlap(v, { l: a.x - a.head.half, r: a.x + a.head.half, t: a.head.t, b: a.head.b })) found.push(`"${v.text}" is on the head of the arrow at ${a.x}`);
    }
    // Over an arc: no point of one is in the box of a value, nor within a pixel of it. (An arc wholly under a
    // value, or to one side of it, has no such point and is not walked along.)
    for (const [i, points] of curved.entries()) {
      const c = p.arcs[i];
      if (v.b + 1 <= p.axis - c.r || v.r + 1 <= c.x - c.r || v.l - 1 >= c.x + c.r) continue;
      if (points.some(([x, y]) => x > v.l - 1 && x < v.r + 1 && y > v.t - 1 && y < v.b + 1)) found.push(`"${v.text}" is on the arc at ${c.x}`);
    }
    // On the shaft: a value is above the thickest part of it.
    if (v.b > p.axis - p.thickest / 2) found.push(`"${v.text}" reaches down to the shaft`);
  }
  for (let i = 0; i < got.length; i += 1) {
    for (let j = i + 1; j < got.length; j += 1) {
      const [a, b] = [got[i], got[j]];
      const apart = Math.max(a.l - b.r, b.l - a.r);
      const above = Math.max(a.t - b.b, b.t - a.b);
      if (apart < -1e-6 && above < -1e-6) found.push(`"${a.text}" on "${b.text}"`);
      // Side by side on a line, two values keep more than a character between them: "400 lbf250 lbf" is one word.
      else if (above < -1e-6 && !a.turned && !b.turned && apart <= CHAR) found.push(`"${a.text}" against "${b.text}": ${apart} apart`);
      // One above the other reading upward, the same.
      else if (apart < -1e-6 && a.turned && b.turned && above <= CHAR) found.push(`"${a.text}" over "${b.text}": ${above} apart`);
    }
  }
  // A line that ties a value to its load is not drawn through another value.
  for (const tie of p.ties) {
    if (!tie.pieces.length) found.push(`the line at ${tie.x} has nothing drawn of it`);
    for (const [from, to] of tie.pieces) {
      for (const v of got) if (tie.x > v.l && tie.x < v.r && from < v.b && to > v.t) found.push(`the line at ${tie.x} runs through "${v.text}"`);
      if (!(to > from)) found.push(`the line at ${tie.x} is drawn upside down: ${from} to ${to}`);
    }
  }

  // The reactions: each value inside the drawing, clear of the other, of both arrows and of the other bearing's triangle.
  for (const [i, r] of p.reactions.entries()) {
    if (!r.box) continue;
    const box = r.box;
    if (box.l < 0 || box.r > width) found.push(`reaction "${box.text}" runs past the side: ${box.l} to ${box.r} of ${width}`);
    if (box.b > p.dim.y - 4) found.push(`reaction "${box.text}" reaches the dimension line`);
    if (box.t < p.axis + p.thickest / 2) found.push(`reaction "${box.text}" reaches up to the shaft`);
    for (const [j, o] of p.reactions.entries()) {
      // 9 px from its own arrow, and twice that from the other's.
      if (i === j && r.x !== null && r.x > box.l - 8 && r.x < box.r + 8) found.push(`reaction "${box.text}" is on its own arrow`);
      if (i !== j && o.x !== null && o.x > box.l - 17 && o.x < box.r + 17) found.push(`reaction "${box.text}" is as near the other bearing's arrow as its own`);
      if (j > i && o.box && Math.min(box.r, o.box.r) - Math.max(box.l, o.box.l) > 1e-6) found.push(`reactions "${box.text}" and "${o.box.text}" are one over the other`);
    }
    for (const pin of p.pins) if (overlap(box, { l: pin.from, r: pin.to, t: pin.y, b: pin.foot + 1 })) found.push(`reaction "${box.text}" is on the bearing at ${pin.x}`);
  }

  // The dimension line: its numbers apart, inside, the last one clear of the unit.
  const { texts, unit } = p.dim;
  for (let i = 1; i < texts.length; i += 1) if (texts[i].l - texts[i - 1].r < 8 - 1e-9) found.push(`positions "${texts[i - 1].text}" and "${texts[i].text}" run together`);
  if (texts.length < 2 || texts[0].text !== '0') found.push(`the dimension line reads ${texts.map((t) => t.text).join(' ')}`);
  else {
    if (texts[0].l < 0 || unit.r > width) found.push('the dimension line runs past a side');
    if (unit.l - texts[texts.length - 1].r < 4 - 1e-9) found.push(`the length "${texts[texts.length - 1].text}" runs into its unit`);
    if (texts[texts.length - 1].r + 4 < p.dim.to) found.push(`the length "${texts[texts.length - 1].text}" is not under its tick`);
  }
  // Its ticks: one to a place - no two within a hundredth of a pixel, where they would be one place drawn twice.
  const marks = [...p.dim.ticks].sort((a, b) => a - b);
  for (let i = 1; i < marks.length; i += 1) if (marks[i] - marks[i - 1] < 0.01) found.push(`two ticks at ${marks[i]}`);
  return found;
}

/**
 * A drawing as its markup, held to the rules - and to being what its layout
 * says: what is found on the layouts of thousands of shafts is then found
 * on what a visitor sees.
 */
function wrong(drawing: ShaftDrawing, width: number, resultants: boolean): string[] {
  const svg = draw(drawing, { width, resultants });
  const picture = read(svg);
  const found = faults(picture, drawing.forces.length + drawing.couples.length);
  if (/NaN|Infinity|undefined/.test(svg)) found.push('a value that is not a number is in the markup');
  const drift = differ(picture, shown(shaftLayout(drawing, { width, resultants }), resultants));
  if (drift) found.push(`the markup is not what was laid out - ${drift}`);
  // With both planes together nothing has a head; in one plane every load has.
  if (resultants ? svg.includes('mp-shaft-fig__head') : [...picture.arrows.map((a) => a.head !== null), ...picture.arcs.map((c) => c.headed)].includes(false)) found.push(resultants ? 'an arrow among resultants' : 'a load with no head');
  return found;
}

const GEARS: ShaftDrawing = {
  L: 18,
  lengthUnit: 'in',
  segments: seg([2, 1.25], [5, 1.75], [4, 2.25], [5, 1.75], [2, 1.25]),
  bearings: [{ x: 1, reaction: 812.5 }, { x: 17, reaction: -112.5 }],
  forces: [force(5, 1250), force(12, -550)],
  couples: [couple(5, 3750), couple(12, -1650)],
  ownWeight: false,
};
const MOST: ShaftDrawing = {
  L: 48,
  lengthUnit: 'in',
  segments: seg([4, 1.5], [5, 2.25], [7, 3, 1.25], [8, 3.75, 1.25], [8, 3.25, 1.25], [7, 2.5], [5, 2], [4, 1.5]),
  bearings: [{ x: 2, reaction: 12345 }, { x: 46, reaction: 9876 }],
  forces: Array.from({ length: 12 }, (_, i) => force(3 + i * 3.8, (i % 3 === 1 ? -1 : 1) * (1250 + 150 * i))),
  couples: Array.from({ length: 12 }, (_, i) => couple(4.5 + i * 3.6, (i % 2 ? -1 : 1) * (2400 + 325 * i))),
  ownWeight: true,
};
const SHAFTS: Record<string, ShaftDrawing> = {
  'the example': example(),
  'the example with its own weight': example({ ownWeight: true }),
  'two helical gears: a force and a couple at each': GEARS,
  'a force at each end of the shaft, and a couple at each end': { ...GEARS, forces: [force(0, 2500), force(18, 2000)], couples: [couple(0, 320), couple(18, -320)] },
  'two forces at one place, and a couple there too': { ...GEARS, forces: [force(9, 800), { ...force(9, 500), id: 'second' }], couples: [couple(9, 1200)] },
  'three couples closer together than one value is wide': { ...GEARS, forces: [], couples: [couple(8, 1200), couple(9, 1500), couple(10, 1800)] },
  'three forces close together': { ...GEARS, forces: [force(8, 1600), force(9, 1600), force(10, 1600)], couples: [] },
  'a couple between two forces close to it': { ...GEARS, forces: [force(8.5, 1600), force(9.5, 1600)], couples: [couple(9, 2500)] },
  'long values, in SI': { ...GEARS, L: 1234.5, lengthUnit: 'mm', segments: seg([200, 40], [834.5, 55, 20], [200, 40]), bearings: [{ x: 100, reaction: 123456.7 }, { x: 1134.5, reaction: -23456.7 }], forces: [force(617.25, 123456.789, 'N'), force(690, -234567.891, 'N')], couples: [couple(300, 1234567.89, 'N·m'), couple(617.25, -98765.4321, 'N·m')] },
  'eight segments, six forces, three couples': {
    L: 40,
    lengthUnit: 'in',
    segments: seg([3, 1.5], [4, 2], [5, 2.5, 1], [6, 3.5, 1], [8, 3, 1], [6, 2.5], [5, 2], [3, 1.5]),
    bearings: [{ x: 1.5, reaction: 2210 }, { x: 38.5, reaction: 1890 }],
    forces: [force(6, 800), force(11, 1200), force(15, -400), force(22, 1500), force(27, 650), force(33, 350)],
    couples: [couple(11, 2400), couple(20, -900), couple(33, 1200)],
    ownWeight: true,
  },
  'the most the form takes: 8 segments, 12 forces, 12 couples': MOST,
  'twelve forces and twelve couples, each couple at a force': { ...MOST, couples: MOST.forces.map((f) => couple(f.x, 2400 + 100 * f.x)) },
  'twelve forces and twelve couples on the last tenth of the shaft': { ...MOST, forces: MOST.forces.map((f, i) => ({ ...f, x: 43.2 + 0.4 * i })), couples: MOST.couples.map((c, i) => ({ ...c, x: 43.3 + 0.4 * i })) },
  'twelve forces and twelve couples all at one place': { ...MOST, forces: MOST.forces.map((f) => ({ ...f, x: 24 })), couples: MOST.couples.map((c) => ({ ...c, x: 24 })) },
};

describe('shaft drawing: every load has its value, clear of every other, of every arrow and arc, and inside the drawing', () => {
  for (const [name, drawing] of Object.entries(SHAFTS)) {
    it(name, () => {
      for (const width of WIDTHS) {
        expect(wrong(drawing, width, false), `at ${width} px`).toEqual([]);
        // …and with both planes together, where the same sizes are marks and not arrows.
        expect(wrong(drawing, width, true), `both planes at ${width} px`).toEqual([]);
      }
    }, 30_000);
  }

  it('the example is drawn the same at any width: each value over its own arrow, on one line, and nothing tied', () => {
    for (let width = 280; width <= 1100; width += 41) {
      const svg = draw(example(), { width });
      expect(values(svg).map((v) => [v.text, v.x, v.y, v.turned]), String(width)).toEqual([
        ['1,000 lbf', tenth(xToPx(9, 23, width)), 46, false],
        ['400 lbf', tenth(xToPx(21, 23, width)), 46, false],
      ]);
      expect(ties(svg)).toEqual([]);
      expect(frame(svg).top).toBe(0);
    }
  });

  it('a helical gear: the force’s value over its arrow, the couple’s beside the arrow, by its arc', () => {
    for (const width of WIDTHS) {
      const svg = draw(GEARS, { width });
      const got = values(svg);
      expect(got.map((v) => [v.text, v.y, v.turned]), String(width)).toEqual([
        ['3,750 lbf·in', 83, false],
        ['1,650 lbf·in', 83, false],
        ['1,250 lbf', 46, false],
        ['550 lbf', 46, false],
      ]);
      // Each couple's value within 8 px of its own couple's line, and not across it.
      for (const [i, x] of [5, 12].entries()) {
        const at = xToPx(x, 18, width);
        expect(Math.min(Math.abs(got[i].l - at), Math.abs(got[i].r - at)), `${got[i].text} at ${width}`).toBeLessThanOrEqual(8);
        expect(got[i].l > at || got[i].r < at).toBe(true);
      }
      expect(frame(svg).top).toBe(0);
    }
  });

  it('two loads at one place: one value above the other on the one arrow, and no line between them', () => {
    const drawing = SHAFTS['two forces at one place, and a couple there too'];
    const svg = draw({ ...drawing, couples: [] });
    const x = tenth(xToPx(9, 18, 724));
    expect(values(svg).map((v) => [v.text, v.x, v.y])).toEqual([
      ['800 lbf', x, 46],
      ['500 lbf', x, 31],
    ]);
    expect(ties(svg)).toEqual([]);
    // The couple there too: beside the arrow, by its arc, where it has room; on a phone, on top of the two.
    expect(values(draw(drawing)).map((v) => [v.text, v.y])).toEqual([['1,200 lbf·in', 83], ['800 lbf', 46], ['500 lbf', 31]]);
  });

  it('a value that has to go up a line is tied to its load by a line that reaches it', () => {
    // Three forces 22 px apart: the outer two on their outer sides, the middle one a line up.
    const svg = draw(SHAFTS['three forces close together'], { width: 460 });
    const at = [8, 9, 10].map((x) => xToPx(x, 18, 460));
    const got = values(svg);
    expect(got.map((v) => [v.text, v.y])).toEqual([['1,600 lbf', 46], ['1,600 lbf', 31], ['1,600 lbf', 46]]);
    expect(got[0].r).toBeLessThanOrEqual(at[0] + 1e-6);
    expect(got[2].l).toBeGreaterThanOrEqual(at[2] - 1e-6);
    // From just under the value down to where its arrow starts.
    expect(ties(svg)).toEqual([{ x: at[1], pieces: [[36, 53]] }]);
    expect(got[1].l).toBeLessThan(at[1] - 3);
    expect(got[1].r).toBeGreaterThan(at[1] + 3);
  });

  it('a row of forces too close for lines: each value written up its own arrow, and the drawing taller by what that takes', () => {
    const drawing: ShaftDrawing = { ...GEARS, L: 24, segments: seg([24, 2]), bearings: [{ x: 0, reaction: null }, { x: 24, reaction: null }], forces: Array.from({ length: 12 }, (_, i) => force(1 + 2 * i, [250, 500, 750, 1000, 1250, 1500][i % 6])), couples: [] };
    const svg = draw(drawing, { width: 328 });
    const got = values(svg);
    expect(got.map((v) => v.text)).toEqual(drawing.forces.map((f) => f.label));
    for (const [i, v] of got.entries()) {
      expect(v.turned, v.text).toBe(true);
      // Across its own arrow's line, starting just above where the arrow starts.
      const stem = xToPx(drawing.forces[i].x, 24, 328);
      expect(v.l, v.text).toBeLessThan(stem);
      expect(v.r, v.text).toBeGreaterThan(stem);
      expect(v.b, v.text).toBe(47);
    }
    // "1,250 lbf" is 9 characters: 62.1 px up from 47, and 4 kept clear above it.
    expect(frame(svg).top).toBe(-20);
    expect(ties(svg)).toEqual([]);
    // The marker of the place asked about runs the whole of the taller drawing: from 8 under its top.
    const probe = draw(drawing, { width: 328, probeX: 5 }).match(/<line class="mp-plot__probe-line"[^>]*>/)![0];
    expect(attr(probe, 'y1')).toBe(8 - 20);
    // On a desk the same loads have room: every value level.
    expect(values(draw(drawing, { width: 1100 })).some((v) => v.turned)).toBe(false);
  });

  it('written upward, a couple’s value stands on its own arc where the column over it is free', () => {
    const svg = draw(SHAFTS['eight segments, six forces, three couples'], { width: 350 });
    const { y } = axis(svg);
    const got = values(svg);
    expect(got.every((v) => v.turned)).toBe(true);
    const lone = got.find((v) => v.text === '900 lbf·in')!;
    const arc = arcs(svg)[1];
    // On the line of its own couple, its foot 6 px above the top of the arc.
    expect(lone.l).toBeLessThan(arc.x);
    expect(lone.r).toBeGreaterThan(arc.x);
    expect(lone.b).toBeCloseTo(y - arc.r - 6, 1);
    // The couple at 11 in has a force there: its value is over that force's, in the one column, with no line.
    const [stacked, under] = [got.find((v) => v.text === '2,400 lbf·in')!, got.find((v) => v.text === '1,200 lbf')!];
    expect([stacked.l, stacked.r]).toEqual([under.l, under.r]);
    expect(stacked.b).toBeLessThan(under.t);
    expect(ties(svg)).toEqual([]);
  });

  it('a value longer than the drawing is wide is centred on it, and nothing loops', () => {
    const svg = draw(example({ forces: [{ id: 'a', x: 9, value: 1, label: 'x'.repeat(60) }] }), { width: 280 });
    expect(values(svg).map((v) => [v.x, v.y])).toEqual([[140, 46]]);
  });
});

/* ── Shafts made at random ────────────────────────────────────────────── */

/** A generator of numbers from 0 to 1 that gives the same ones each time it is started from a seed (mulberry32). */
function random(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * A shaft nobody would turn: up to eight segments of any proportions, some
 * hollow; two bearings anywhere, now and then at an end, at a step or a
 * hair apart; up to twelve forces and twelve couples, spread out or crowded
 * into a tenth of the shaft, some sharing a place; values from one figure
 * to seven. `dense`: the most of everything.
 */
function made(seed: number, dense: boolean): { drawing: ShaftDrawing; resultants: boolean } {
  const next = random(seed);
  const int = (lo: number, hi: number) => lo + Math.floor(next() * (hi - lo + 1));
  const pick = <T>(list: T[]): T => list[int(0, list.length - 1)];
  const si = next() < 0.4;
  const size = si ? 25.4 : 1;
  const segments = seg(
    ...Array.from({ length: dense ? 8 : int(1, 8) }, (): [number, number, number] => {
      const d = Number((size * (0.5 + 3.5 * next())).toPrecision(3));
      return [Number((size * (0.3 + 8 * next() ** 2)).toPrecision(3)), d, next() < 0.25 ? Number((d * (0.2 + 0.6 * next())).toPrecision(2)) : 0];
    }),
  );
  const L = segments[segments.length - 1].to;
  const steps = segments.map((s) => s.to);
  const spot = () => {
    const kind = next();
    return kind < 0.08 ? 0 : kind < 0.16 ? L : kind < 0.28 ? pick(steps) : Number((L * next()).toPrecision(4));
  };
  const first = spot();
  const second = next() < 0.15 ? Math.min(L, first + L * 0.01 * next()) : spot();
  const resultants = next() < 0.3;
  const reaction = () => {
    const kind = next();
    const v = kind < 0.1 ? 0 : 10 ** (6 * next() - 1) * (resultants || next() < 0.75 ? 1 : -1);
    return kind > 0.92 ? null : v;
  };
  const sign = () => (resultants || next() < 0.7 ? 1 : -1);
  const number = () => formatNumber(Number((10 ** (5.5 * next())).toPrecision(int(1, 6))), 6, si && next() < 0.5 ? ' ' : ',');
  // Where the loads are: over the whole shaft, or crowded into a stretch of it.
  const from = next() < 0.35 ? L * 0.9 * next() : 0;
  const over = from > 0 ? L * (0.05 + 0.2 * next()) : L;
  const place = () => Math.min(L, Number((from + over * next()).toPrecision(4)));
  const forces = Array.from({ length: dense ? 12 : int(0, 12) }, (_, i) => ({ id: `f${i}`, x: place(), value: sign(), label: `${number()} ${si ? 'N' : 'lbf'}` }));
  const couples = Array.from({ length: dense ? 12 : int(0, 12) }, (_, i) => ({ id: `c${i}`, x: forces.length && next() < 0.4 ? pick(forces).x : place(), value: sign(), label: `${number()} ${si ? 'N·m' : 'lbf·in'}` }));
  return { drawing: { L, lengthUnit: si ? 'mm' : 'in', segments, bearings: [{ x: first, reaction: reaction() }, { x: second, reaction: reaction() }], forces, couples, ownWeight: next() < 0.5 }, resultants };
}

describe('shaft drawing: shafts made at random, each at seven widths', () => {
  it('forty of them as their markup - twenty-eight of every kind and twelve with the most the form takes: 280 drawings, each what its layout says', () => {
    const found: string[] = [];
    for (const [seed, n, dense] of [[9000, 28, false], [9500, 12, true]] as const) {
      for (let i = 0; i < n; i += 1) {
        const { drawing, resultants } = made(seed + i, dense);
        for (const width of WIDTHS) found.push(...wrong(drawing, width, resultants).map((f) => `shaft ${seed + i}${resultants ? ', both planes' : ''} at ${width} px: ${f}`));
      }
    }
    expect(found.slice(0, 20)).toEqual([]);
  }, 120_000);

  /** Lays out `n` shafts from `seed` on at every width, and says what is wrong with any of them. */
  const sweep = (seed: number, n: number, dense: boolean) => {
    const found: string[] = [];
    const seen = { drawings: 0, values: 0, turned: 0, tied: 0, unwritten: 0, dropped: 0, taller: 0 };
    for (let i = 0; i < n; i += 1) {
      const { drawing, resultants } = made(seed + i, dense);
      for (const width of WIDTHS) {
        const g = shaftLayout(drawing, { width, resultants });
        const picture = shown(g, resultants);
        found.push(...faults(picture, drawing.forces.length + drawing.couples.length).map((f) => `shaft ${seed + i}${resultants ? ', both planes' : ''} at ${width} px: ${f}`));
        // Whatever the shaft, both its bearings are drawn, and a rectangle for each of its segments.
        if (picture.pins.length !== 2 || picture.segments.length !== drawing.segments.length) found.push(`shaft ${seed + i} at ${width} px: ${picture.pins.length} bearings, ${picture.segments.length} segments`);
        seen.drawings += 1;
        seen.values += picture.values.length;
        seen.turned += picture.values.filter((v) => v.turned).length;
        seen.tied += picture.ties.length;
        seen.unwritten += picture.reactions.filter((r) => !r.box).length;
        seen.dropped += drawing.segments.length + 3 > picture.dim.texts.length ? 1 : 0;
        seen.taller += picture.frame.top < 0 ? 1 : 0;
      }
    }
    return { found, seen };
  };

  it('four hundred shafts of every kind: 2,800 drawings', () => {
    const { found, seen } = sweep(1, 400, false);
    expect(found.slice(0, 20)).toEqual([]);
    expect(seen.drawings).toBe(2800);
    // What these drawings exercise: values level and upward, values tied back, drawings that grew, reactions left
    // to the table, positions that gave way.
    expect(seen.values).toBeGreaterThan(20_000);
    expect(seen.turned).toBeGreaterThan(3000);
    expect(seen.values - seen.turned).toBeGreaterThan(3000);
    expect(seen.tied).toBeGreaterThan(300);
    expect(seen.taller).toBeGreaterThan(300);
    expect(seen.unwritten).toBeGreaterThan(10);
    expect(seen.dropped).toBeGreaterThan(300);
  }, 120_000);

  it('two hundred with the most the form takes - eight segments, twelve forces, twelve couples: 1,400 drawings', () => {
    const { found, seen } = sweep(5000, 200, true);
    expect(found.slice(0, 20)).toEqual([]);
    expect(seen.values).toBe(1400 * 24);
  }, 120_000);

  it('at every second width from 280 to 1100 px: the example, the gears, the long values and the most there can be', () => {
    const found: string[] = [];
    for (let width = 280; width <= 1100; width += 2) {
      for (const name of ['the example', 'two helical gears: a force and a couple at each', 'long values, in SI', 'eight segments, six forces, three couples', 'the most the form takes: 8 segments, 12 forces, 12 couples']) {
        const drawing = SHAFTS[name];
        for (const resultants of [false, true]) found.push(...faults(shown(shaftLayout(drawing, { width, resultants }), resultants), drawing.forces.length + drawing.couples.length).map((f) => `${name}${resultants ? ', both planes' : ''} at ${width} px: ${f}`));
      }
    }
    expect(found.slice(0, 20)).toEqual([]);
  }, 120_000);
});
