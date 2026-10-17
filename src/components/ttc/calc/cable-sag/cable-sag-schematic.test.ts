import { createElement as h } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { analyseSafely } from '@/lib/calc/cable-sag/analysis';
import { defaultCase, defaultCaseFor, type CableSagForm } from '@/lib/calc/cable-sag/model';
import { cableSagUi } from '@/lib/calc/cable-sag/strings';
import { CableSchematic, cableLayout, type Layout, type LayoutOptions } from './CableSchematic';
import { SweepChart, chartLayout, niceStep, niceTicks, tickText, type ChartPoint } from './SweepChart';

/**
 * THE CABLE'S DRAWING AND ITS CHARTS — what is reckoned (`cableLayout`, `chartLayout`, held here without React:
 * where every line, symbol, arrow, number and tick goes) and what is written of it (`CableSchematic`, `SweepChart`,
 * as the server sends them).
 */

const OPTIONS: LayoutOptions = {
  width: 720,
  group: ',',
  unit: 'ft',
  labels: cableSagUi.en.results.labels,
  texts: { A: 'tension 13.46 kip', B: 'tension 13.46 kip', H: 'pretension H 12.5 kip' },
  tensions: true,
  dims: true,
  load: true,
  parabola: true,
};
const drawingOf = (form: CableSagForm) => analyseSafely(form).drawing;
const layoutOf = (form: CableSagForm, over: Partial<LayoutOptions> = {}): Layout => cableLayout(drawingOf(form), { ...OPTIONS, ...over });
const base = defaultCase();
const state = defaultCaseFor('state');
const points = defaultCaseFor('points');
const combined: CableSagForm = { ...base, weightFrom: 'section', q: 0, sag: 20 };
const inclined: CableSagForm = { ...base, rise: 20, known: 'sag', sagKind: 'low', sag: 12 };
const steep: CableSagForm = { ...base, rise: 80, sag: 5 };
const show = (form: CableSagForm, over: Record<string, unknown> = {}) =>
  renderToStaticMarkup(h(CableSchematic, { drawing: drawingOf(form), summary: 'A cable.', legend: cableSagUi.en.results.legend, ...OPTIONS, ...over }));
const attr = (tag: string, name: string) => tag.match(new RegExp(` ${name}="([^"]*)"`))?.[1];
const curve = (l: Layout, id: string) => l.curves.find((c) => c.id === id)!;
const everyNumber = (value: unknown): number[] => {
  if (typeof value === 'number') return [value];
  if (Array.isArray(value)) return value.flatMap(everyNumber);
  if (value && typeof value === 'object') return Object.values(value).flatMap(everyNumber);
  return [];
};

describe('the layout of the hanging example', () => {
  const layout = layoutOf(base);

  it('is as wide as it was asked to be, and as tall as the cable and its margin are', () => {
    expect(layout.width).toBe(720);
    // 100 ft by 10 ft with a margin of 14 % of 100 ft all round: 128 ft wide.
    expect(layout.scale).toBeCloseTo(720 / 128, 3);
    expect(layout.height).toBeGreaterThan(0);
    expect(layout.height).toBeLessThan(layout.width);
  });

  it('puts support A on the left and B on the right, at one level', () => {
    const [A, B] = layout.supports;
    expect([A.id, B.id]).toEqual(['A', 'B']);
    expect(B.x - A.x).toBeCloseTo(100 * layout.scale, 2);
    expect(A.y).toBe(B.y);
    expect(layout.chord).toEqual({ x1: A.x, y1: A.y, x2: B.x, y2: B.y });
    expect(A.letter.value).toBe('A');
    expect(A.letter.y).toBeGreaterThan(A.y + A.depth);
  });

  it('draws the cable from one support to the other, hanging below the chord by the sag', () => {
    const c = curve(layout, 'exact');
    const [A, B] = layout.supports;
    expect(c.points[0]).toEqual({ x: A.x, y: A.y });
    expect(c.points[c.points.length - 1].x).toBeCloseTo(B.x, 2);
    expect(c.points).toHaveLength(65);
    // y is down the page: the lowest point is at mid-span and 10 ft under the supports.
    const lowest = c.points.reduce((m, p) => (p.y > m.y ? p : m));
    expect(lowest.x).toBeCloseTo((A.x + B.x) / 2, 1);
    expect(lowest.y - A.y).toBeCloseTo(10 * layout.scale, 1);
    expect(c.d.startsWith(`M${A.x} ${A.y} L`)).toBe(true);
  });

  it('draws a cable that is a pure parabola once: there is no second curve to compare it with', () => {
    expect(layout.curves.map((c) => c.id)).toEqual(['exact']);
  });

  it('draws the two sags as one line when they are the same line, which on a level span they are', () => {
    expect(layout.dims).toHaveLength(1);
    const d = layout.dims[0];
    expect(d.both).toBe(true);
    expect(d.given).toBe(true);
    // Said in words, the one sag, not two letters.
    expect(d.text.value).toBe('sag 10 ft');
    expect(d.text.anchor).toBe('start');
    // From the chord at mid-span down to the cable.
    expect(d.x).toBeCloseTo(layout.chord.x1 + 50 * layout.scale, 1);
    expect(d.y1).toBe(layout.chord.y1);
    expect(d.y2 - d.y1).toBeCloseTo(10 * layout.scale, 1);
    // The chord is the level the sag is measured from, so there is no level line to draw.
    expect(d.level).toBeNull();
  });

  it('writes the tensions over the supports, inside them, where the margin is narrower than the words', () => {
    // 14 % of the span is 79 px here, and “tension 13.46 kip” is 126.
    expect(layout.tensions.map((t) => [t.id, t.text.value, t.text.anchor])).toEqual([
      ['A', 'tension 13.46 kip', 'start'],
      ['B', 'tension 13.46 kip', 'end'],
    ]);
    const [A, B] = layout.supports;
    expect(layout.tensions[0].text.x).toBeGreaterThanOrEqual(A.x);
    expect(layout.tensions[1].text.x).toBeLessThanOrEqual(B.x);
    expect(layout.tensions[0].text.y).toBeLessThan(A.y);
  });

  it('writes them outside the supports where there is room for them', () => {
    const wide = layoutOf(base, { width: 1400 });
    expect(wide.tensions.map((t) => t.text.anchor)).toEqual(['end', 'start']);
    const [A, B] = wide.supports;
    expect(wide.tensions[0].text.x).toBeLessThan(A.x);
    expect(wide.tensions[1].text.x).toBeGreaterThan(B.x);
  });

  it('puts the pretension under the lowest point, as a horizontal arrow with its words', () => {
    const H = layout.H!;
    const c = curve(layout, 'exact');
    const lowest = c.points.reduce((m, p) => (p.y > m.y ? p : m));
    expect(H.x).toBeCloseTo(lowest.x, 1);
    expect(H.arrow.y).toBeGreaterThan(lowest.y);
    expect(H.arrow.x2).toBeGreaterThan(H.arrow.x1);
    expect(H.arrow.y).toBe(H.arrow.y);
    expect(H.text.value).toBe('pretension H 12.5 kip');
    expect(H.text.y).toBeGreaterThan(H.arrow.y);
    expect(H.text.anchor).toBe('middle');
  });

  it('draws the load as a row of arrows that end on the cable, none over the sag line', () => {
    expect(layout.loadArrows.length).toBeGreaterThanOrEqual(4);
    expect(layout.loadArrows.length).toBeLessThanOrEqual(13);
    const c = curve(layout, 'exact');
    for (const a of layout.loadArrows) {
      expect(a.tip.y).toBeGreaterThan(a.tail.y);
      expect(a.tip.x).toBe(a.tail.x);
      // The tip is on the cable (2 px over it).
      const k = c.points.findIndex((p) => p.x >= a.tip.x);
      const p0 = c.points[k - 1];
      const p1 = c.points[k];
      const y = p0.y + ((a.tip.x - p0.x) / (p1.x - p0.x)) * (p1.y - p0.y);
      expect(a.tip.y).toBeCloseTo(y - 2, 0);
      expect(Math.abs(a.tip.x - layout.dims[0].x)).toBeGreaterThanOrEqual(10);
    }
  });

  it('has no point loads, joints or polygon pieces: those are the other mode’s', () => {
    expect([layout.pointLoads, layout.joints, layout.segments]).toEqual([[], [], []]);
  });

  it('explains what it draws, and only that', () => {
    expect(layout.legend).toEqual(['cable', 'chord', 'sagBoth', 'load', 'tension', 'H', 'support']);
  });

  it('draws a scale bar under the drawing: a round length, as long on the page as the cable’s own scale makes it', () => {
    const bar = layout.scaleBar;
    // 20 % of 128 ft is 25.6 ft; the round length under it is 20 ft.
    expect(bar.length).toBe(20);
    expect(bar.x2 - bar.x1).toBeCloseTo(20 * layout.scale, 2);
    expect(bar.text.value).toBe('20 ft');
    expect(bar.y).toBeGreaterThan(layout.supports[0].y + layout.supports[0].depth);
    expect(bar.y).toBeLessThan(layout.height);
    expect(bar.x2).toBeLessThan(layout.width);
    for (const width of [280, 390, 1100]) {
      const l = layoutOf(base, { width });
      expect(l.scaleBar.x2 - l.scaleBar.x1).toBeCloseTo(l.scaleBar.length * l.scale, 2);
      expect(l.scaleBar.x2).toBeLessThan(width);
    }
    expect(layoutOf(defaultCaseFor('hanging', 'si')).scaleBar.text.value).toMatch(/^\d+(\.\d+)? ft$/);
  });

  it('is finite everywhere', () => {
    for (const n of everyNumber(layout)) expect(Number.isFinite(n)).toBe(true);
  });
});

describe('a cable under its own weight and a load together', () => {
  const layout = layoutOf(combined);
  it('draws the exact cable solid and the parabola beside it, and says so in the legend', () => {
    expect(layout.curves.map((c) => c.id)).toEqual(['exact', 'parabola']);
    expect(layout.legend.slice(0, 2)).toEqual(['cable', 'parabola']);
    const e = curve(layout, 'exact');
    const p = curve(layout, 'parabola');
    // Both start at the supports and hang the same at midspan (the sag is what was given), and differ between.
    expect(p.points[0]).toEqual(e.points[0]);
    expect(p.points).toHaveLength(e.points.length);
    expect(p.points[16].y).not.toBe(e.points[16].y);
    expect(p.points[32].y).toBeCloseTo(e.points[32].y, 1);
  });
  it('leaves the parabola out when it is not asked for', () => {
    const without = layoutOf(combined, { parabola: false });
    expect(without.curves.map((c) => c.id)).toEqual(['exact']);
    expect(without.legend).not.toContain('parabola');
  });
});

describe('a span that is not level', () => {
  const layout = layoutOf(inclined);
  it('draws support B higher than A by the rise', () => {
    const [A, B] = layout.supports;
    expect(A.y - B.y).toBeCloseTo(20 * layout.scale, 1);
  });
  it('draws the two sags as two lines, labelled away from each other, the one given heavier', () => {
    expect(layout.dims.map((d) => d.id)).toEqual(['mid', 'low']);
    const [mid, low] = layout.dims;
    expect(mid.both || low.both).toBe(false);
    expect(low.given).toBe(true);
    expect(mid.given).toBe(false);
    expect(low.text.value).toBe('sag below lower support 12 ft');
    expect(mid.text.value).toMatch(/^sag at midspan [\d.]+ ft$/);
    // The lowest point is nearer the lower support, so its label points left and the other's right.
    expect(low.x).toBeLessThan(mid.x);
    expect(low.text.anchor).toBe('end');
    expect(mid.text.anchor).toBe('start');
    expect(layout.legend).toContain('sagMid');
    expect(layout.legend).toContain('sagLow');
  });
  it('measures the sag below the lower support from that support’s level, with a level line from it', () => {
    const low = layout.dims.find((d) => d.id === 'low')!;
    const [A] = layout.supports;
    expect(low.level).toEqual({ x1: A.x, x2: low.x, y: A.y });
    expect(low.y1).toBe(A.y);
    expect(low.y2 - low.y1).toBeCloseTo(12 * layout.scale, 1);
  });
});

describe('no label sits on a line', () => {
  const words = (v: string) => v.length * 6.6;
  it('lifts the tension over a support above the chord that climbs away from it, along all its length', () => {
    const l = layoutOf({ ...base, rise: 80, sag: 5 }, { width: 390 });
    const [A, B] = l.supports;
    const a = l.tensions.find((t) => t.id === 'A')!.text;
    const farX = a.x + words(a.value);
    const chordAt = A.y + ((B.y - A.y) * (farX - A.x)) / (B.x - A.x);
    expect(a.anchor).toBe('start');
    expect(a.y).toBeLessThanOrEqual(chordAt - 8.9);
    expect(a.y).toBeLessThan(A.y);
  });

  it('puts the words of a sag measured from the lower support over the level line it is measured from', () => {
    const l = layoutOf(inclined);
    const low = l.dims.find((d) => d.id === 'low')!;
    expect(low.text.y).toBeLessThan(low.level!.y);
  });

  it('puts the words of a sag too short to hold them over the chord', () => {
    const l = layoutOf(state);
    for (const d of l.dims) expect(d.text.y).toBeLessThan(Math.min(d.y1, d.y2));
  });

  it('draws no load arrow through the words or the line of a sag', () => {
    for (const form of [base, combined, inclined, steep]) {
      const l = layoutOf(form);
      for (const d of l.dims) {
        const w = words(d.text.value);
        const lo = d.text.anchor === 'start' ? d.text.x : d.text.x - w;
        for (const a of l.loadArrows) {
          const insideWords = a.tip.x >= lo - 4 && a.tip.x <= lo + w + 4 && a.tip.y >= d.text.y - 13 && a.tail.y <= d.text.y + 4;
          expect(insideWords).toBe(false);
          expect(Math.abs(a.tip.x - d.x)).toBeGreaterThanOrEqual(10);
        }
      }
    }
  });

  it('draws state 1 over state 2, so that its dashes show on the thicker line', () => {
    const out = show(state);
    const drawn = out.slice(0, out.indexOf('<ul class="mp-cs-fig__legend">'));
    expect(drawn.indexOf('mp-cs-fig__curve--state2')).toBeGreaterThan(-1);
    expect(drawn.indexOf('mp-cs-fig__curve--state1')).toBeGreaterThan(drawn.indexOf('mp-cs-fig__curve--state2'));
  });
});

describe('a cable whose lowest point is outside the span', () => {
  const layout = layoutOf(steep);
  it('draws no pretension arrow where there is no lowest point to put it, and no sag below the lower support', () => {
    expect(layout.H).toBeNull();
    expect(layout.dims.map((d) => d.id)).toEqual(['mid']);
    expect(layout.legend).not.toContain('H');
  });
});

describe('what is switched off is not drawn', () => {
  it('draws no tensions, no sags, no load arrows when they are not asked for', () => {
    const l = layoutOf(base, { tensions: false, dims: false, load: false });
    expect([l.tensions, l.dims, l.loadArrows]).toEqual([[], [], []]);
    expect(l.H).toBeNull();
    expect(l.legend).toEqual(['cable', 'chord', 'support']);
  });
  it('draws no tension without its words', () => {
    const l = layoutOf(base, { texts: { A: null, B: undefined, H: null } });
    expect(l.tensions).toEqual([]);
    expect(l.H).toBeNull();
  });
});

describe('a narrow drawing', () => {
  for (const width of [280, 340, 390]) {
    it(`at ${width} px puts the tensions over the supports, where the margin is too narrow for them, and keeps everything on the page`, () => {
      const l = layoutOf(base, { width });
      expect(l.width).toBe(width);
      const [A, B] = l.supports;
      expect(l.tensions[0].text.anchor).toBe('start');
      expect(l.tensions[1].text.anchor).toBe('end');
      expect(l.tensions[0].text.x).toBeGreaterThanOrEqual(A.x - 4);
      expect(l.tensions[1].text.x).toBeLessThanOrEqual(B.x + 4);
      for (const s of l.supports) {
        expect(s.x).toBeGreaterThan(0);
        expect(s.x).toBeLessThan(width);
        expect(s.y + s.depth + 14).toBeLessThanOrEqual(l.height + 14);
      }
      expect(l.H!.text.y).toBeLessThanOrEqual(l.height + 8);
      for (const n of everyNumber(l)) expect(Number.isFinite(n)).toBe(true);
    });
  }
  it('gives the drawing room above for the largest load arrow and under for the pretension', () => {
    const l = layoutOf(points, { width: 340 });
    const top = Math.min(...l.pointLoads.map((a) => a.text!.y - 10));
    expect(top).toBeGreaterThanOrEqual(-1);
  });
});

describe('a change of state', () => {
  const layout = layoutOf(state);
  it('draws the cable in state 1 dashed under the one in state 2, and a sag line for each', () => {
    expect(layout.curves.map((c) => c.id)).toEqual(['state1', 'state2']);
    const deepest = (id: string) => Math.max(...curve(layout, id).points.map((p) => p.y));
    expect(deepest('state2')).toBeGreaterThan(deepest('state1'));
    expect(layout.dims.map((d) => [d.id, d.text.value, d.text.anchor])).toEqual([
      ['state1', 'state 1 sag 6 ft', 'end'],
      ['mid', 'state 2 sag 6.195 ft', 'start'],
    ]);
    // What was given is state 1's sag.
    expect(layout.dims.map((d) => d.given)).toEqual([true, false]);
    expect(layout.legend).toEqual(expect.arrayContaining(['state1', 'state2', 'chord', 'sagMid']));
    expect(layout.loadArrows).toEqual([]);
  });
});

describe('a cable with point loads', () => {
  const shares = [1, 0.9, 0.9, 1];
  const layout = layoutOf(points, { shares, texts: { A: 'tension 42.5 kip', B: 'tension 42.5 kip', H: null } });

  it('draws the polygon: four pieces between five points, heavier where the tension is larger', () => {
    expect(layout.curves.map((c) => c.id)).toEqual(['polygon']);
    expect(layout.curves[0].points).toHaveLength(5);
    expect(layout.segments).toHaveLength(4);
    expect(layout.segments.map((s) => s.width)).toEqual([4.75, 4.45, 4.45, 4.75]);
    expect(layout.segments[0].x1).toBe(layout.supports[0].x);
    expect(layout.segments[3].x2).toBe(layout.supports[1].x);
    expect(layout.H).toBeNull();
  });

  it('marks a joint at each load, numbered, hung 8, 12 and 8 ft under the supports', () => {
    expect(layout.joints.map((j) => j.label)).toEqual([1, 2, 3]);
    const [A] = layout.supports;
    expect(layout.joints.map((j) => Math.round((j.y - A.y) / layout.scale))).toEqual([8, 12, 8]);
    expect(layout.joints.map((j) => Math.round((j.x - A.x) / layout.scale))).toEqual([15, 30, 45]);
    for (const j of layout.joints) expect(j.text.y).toBeGreaterThan(j.y);
  });

  it('draws each load as an arrow that ends on its joint, with its size at the tail, longer for the larger', () => {
    expect(layout.pointLoads.map((a) => a.text!.value)).toEqual(['10', '20', '10']);
    layout.pointLoads.forEach((a, i) => {
      const j = layout.joints[i];
      expect(a.tip.x).toBe(j.x);
      expect(a.tip.y).toBeLessThan(j.y);
      expect(a.tail.y).toBeLessThan(a.tip.y);
      expect(a.text!.y).toBeLessThan(a.tail.y);
    });
    const len = (a: (typeof layout.pointLoads)[number]) => a.tip.y - a.tail.y;
    expect(len(layout.pointLoads[1])).toBeGreaterThan(len(layout.pointLoads[0]));
    expect(len(layout.pointLoads[0])).toBeCloseTo(len(layout.pointLoads[2]), 3);
  });

  it('draws the sag that was given at its position, and says what it is', () => {
    expect(layout.dims).toHaveLength(1);
    expect(layout.dims[0].text.value).toBe('sag 12 ft');
    expect(layout.dims[0].x).toBeCloseTo(layout.joints[1].x - 12, 3);
    expect(layout.dims[0].text.anchor).toBe('end');
    expect(layout.dims[0].y2 - layout.dims[0].y1).toBeCloseTo(12 * layout.scale, 1);
    expect(layout.legend).toEqual(['polygon', 'chord', 'sagAt', 'pointLoad', 'joint', 'tension', 'support']);
  });

  it('draws a load that pulls up from below, and writes its minus sign', () => {
    const up = { ...points, points: [{ id: 1, x: 15, P: -4 }, { id: 2, x: 30, P: 20 }], pointsKnown: 'H' as const, pointsH: 40 };
    const l = layoutOf(up);
    const first = l.pointLoads[0];
    expect(first.text!.value).toBe('−4');
    expect(first.tip.y).toBeGreaterThan(l.joints[0].y);
    expect(first.tail.y).toBeGreaterThan(first.tip.y);
  });
});

describe('a cable that cannot be solved', () => {
  it('is drawn as its supports and the chord, whatever the form holds', () => {
    for (const form of [{ ...base, span: 0 }, { ...base, span: Number.NaN }, { ...base, rise: Number.NaN }, { ...base, rise: 1e9 }, { ...state, alpha: Number.NaN }, { ...points, points: [] }]) {
      const l = layoutOf(form);
      expect(l.curves).toEqual([]);
      expect(l.supports).toHaveLength(2);
      expect(l.dims).toEqual([]);
      expect(l.H === null || typeof l.H === 'object').toBe(true);
      for (const n of everyNumber(l)) expect(Number.isFinite(n)).toBe(true);
    }
  });
});

describe('the drawing, as the server sends it', () => {
  const html = show(base);

  it('is one image with a sentence for whoever cannot see it, its shapes hidden from them', () => {
    const svg = html.match(/<svg class="mp-plot__svg mp-cs-fig__svg"[^>]*>/)![0];
    expect(attr(svg, 'role')).toBe('img');
    expect(attr(svg, 'aria-label')).toBe('A cable.');
    expect(attr(svg, 'viewBox')).toMatch(/^0 0 720 \d+/);
    expect(html).toContain('<g aria-hidden="true">');
  });

  it('draws the cable, the chord, the supports, the dimension line, the load arrows and the pretension', () => {
    expect(html.match(/<path class="mp-cs-fig__curve mp-cs-fig__curve--exact"/g)).toHaveLength(1);
    const drawn = html.slice(0, html.indexOf('<ul class="mp-cs-fig__legend">'));
    expect(drawn.match(/class="mp-cs-fig__chord"/g)).toHaveLength(1);
    expect(drawn.match(/class="mp-cs-fig__support"/g)).toHaveLength(2);
    expect(html.match(/class="mp-cs-fig__dim mp-cs-fig__dim--mid mp-cs-fig__dim--given"/g)).toHaveLength(1);
    expect(html.match(/class="mp-cs-fig__load"/g)!.length).toBeGreaterThanOrEqual(4);
    expect(html).toContain('class="mp-cs-fig__harrow"');
    expect(html).toContain('>sag 10 ft<');
    expect(html).toContain('>tension 13.46 kip<');
    expect(html).toContain('>pretension H 12.5 kip<');
    expect(html).toContain('<g class="mp-cs-fig__scale">');
    expect(html).toContain('>20 ft<');
  });

  it('explains every kind of mark it uses, in the words it is given', () => {
    const words = cableSagUi.en.results.legend;
    for (const key of ['cable', 'chord', 'sagBoth', 'load', 'tension', 'H', 'support'] as const) expect(html).toContain(`<span>${words[key]}</span>`);
    expect(html).not.toContain(words.parabola);
  });

  it('draws nothing it should not: no NaN, no undefined, no exponent in any coordinate', () => {
    for (const form of [base, combined, inclined, steep, state, points, { ...base, span: 0 }]) {
      const out = show(form);
      expect(out).not.toMatch(/NaN|undefined|Infinity|[\d.]e[+-]\d/);
    }
  });

  it('draws the polygon of a cable with point loads as lines, with its joints and arrows', () => {
    const out = show(points, { shares: [1, 0.9, 0.9, 1] });
    const drawn = out.slice(0, out.indexOf('<ul class="mp-cs-fig__legend">'));
    expect(drawn.match(/class="mp-cs-fig__piece"/g)).toHaveLength(4);
    expect(drawn.match(/class="mp-cs-fig__joint"/g)).toHaveLength(3);
    expect(drawn.match(/class="mp-cs-fig__pointload"/g)).toHaveLength(3);
  });

  it('is described, in Spanish, by the words it is given', () => {
    const out = show(base, { legend: cableSagUi.es.results.legend });
    expect(out).toContain('<span>Cable (exacto): línea continua</span>');
  });
});

/* ── The charts ───────────────────────────────────────────────────────── */

const series = (ys: (number | null)[], from = 0, step = 10, current = -1): ChartPoint[] => ys.map((y, i) => ({ x: from + i * step, y, current: i === current }));

describe('the ticks', () => {
  it('chooses round steps', () => {
    expect([niceStep(100, 5), niceStep(7, 4), niceStep(0.9, 4), niceStep(1234, 4), niceStep(0, 4), niceStep(Number.NaN, 4)]).toEqual([20, 2, 0.2, 500, 1, 1]);
  });
  it('lists the round numbers between two ends, the ends included only where they are on the grid', () => {
    expect(niceTicks(0, 100, 5)).toEqual({ step: 20, values: [0, 20, 40, 60, 80, 100] });
    expect(niceTicks(5.3, 7.4, 4).values).toEqual([5.5, 6, 6.5, 7]);
    expect(niceTicks(-0.3, 0.3, 4).values).toEqual([-0.3, -0.2, -0.1, 0, 0.1, 0.2, 0.3]);
  });
  it('writes a tick with the figures its step needs, a true minus, thousands set apart, and never −0 or an exponent', () => {
    expect(tickText(5.5, 0.5, ',')).toBe('5.5');
    expect(tickText(6, 0.5, ',')).toBe('6.0');
    expect(tickText(-40, 20, ',')).toBe('−40');
    expect(tickText(-0, 0.1, ',')).toBe('0');
    expect(tickText(-1e-17, 0.1, ',')).toBe('0');
    expect(tickText(12500, 2500, ',')).toBe('12,500');
    expect(tickText(12500, 2500, ' ')).toBe('12 500');
    expect(tickText(0.00005, 0.00001, ',')).toBe('0.00005');
    expect(tickText(Number.NaN, 1, ',')).toBe('—');
    expect(tickText(2e16, 1e16, ',')).not.toMatch(/e\+/);
  });
});

describe('the layout of a chart', () => {
  const opts = { width: 340, height: 200, group: ',' };
  const layout = chartLayout(series([5.4, 5.8, 6.2, 6.6, 7.0], 0, 25, 2), opts);

  it('puts the first row at the left of the plot and the last at the right, rising values up the page', () => {
    expect(layout.dots).toHaveLength(5);
    expect(layout.dots[0].x).toBe(layout.plot.x0);
    expect(layout.dots[4].x).toBe(layout.plot.x1);
    for (let i = 1; i < 5; i++) expect(layout.dots[i].y).toBeLessThan(layout.dots[i - 1].y);
    expect(layout.runs).toHaveLength(1);
    expect(layout.runs[0].startsWith('M')).toBe(true);
    expect(layout.runs[0].split('L')).toHaveLength(5);
  });

  it('marks the row that is state 2', () => {
    expect(layout.dots.map((d) => d.current)).toEqual([false, false, true, false, false]);
  });

  it('labels both axes with round numbers that cover the values', () => {
    expect(layout.xTicks.map((t) => t.text)).toEqual(['0', '50', '100']);
    const ys = layout.yTicks.map((t) => t.value);
    expect(Math.min(...ys)).toBeLessThanOrEqual(5.4);
    expect(Math.max(...ys)).toBeGreaterThanOrEqual(7);
    expect(layout.yTicks.every((t) => t.at >= layout.plot.y0 - 0.01 && t.at <= layout.plot.y1 + 0.01)).toBe(true);
    expect(layout.least).toEqual({ x: 0, y: 5.4 });
    expect(layout.most).toEqual({ x: 100, y: 7 });
  });

  it('breaks the line where a row has no solution, and marks where it would stand', () => {
    const l = chartLayout(series([1, 2, null, null, 5, 6], 0, 10), opts);
    expect(l.runs).toHaveLength(2);
    expect(l.gaps).toHaveLength(2);
    expect(l.dots).toHaveLength(4);
    const lone = chartLayout(series([1, null, 3], 0, 10), opts);
    expect(lone.runs).toEqual([]);
    expect(lone.dots).toHaveLength(2);
  });

  it('gives a level line an axis of its own, a little over and under it, not a ladder of ticks a billionth apart', () => {
    const l = chartLayout(series([6, 6 + 1e-13, 6 - 1e-13, 6]), opts);
    expect(l.yTicks.length).toBeGreaterThanOrEqual(2);
    expect(l.yTicks.length).toBeLessThan(12);
    for (const t of l.yTicks) expect(t.text).toMatch(/^\d+(\.\d+)?$/);
    expect(new Set(l.yTicks.map((t) => t.text)).size).toBe(l.yTicks.length);
  });

  it('copes with one row, none, and a table that has no solution at all', () => {
    for (const rows of [series([4]), [], series([null, null])]) {
      const l = chartLayout(rows, opts);
      expect(l.runs).toEqual([]);
      for (const n of everyNumber(l)) expect(Number.isFinite(n)).toBe(true);
    }
    expect(chartLayout([], opts).least).toBeNull();
  });

  it('writes a negative axis with a true minus and no −0', () => {
    const l = chartLayout(series([-3, -1, 2], -40, 20), opts);
    expect(l.xTicks.map((t) => t.text)).toEqual(['−40', '−30', '−20', '−10', '0']);
    expect([...l.xTicks, ...l.yTicks].every((t) => !/(^|[^\d.])-|−0(?![.\d])/.test(t.text.replace('−', '')))).toBe(true);
  });

  it('is finite everywhere, for any values', () => {
    for (const ys of [[1e-9, 2e-9, 3e-9], [1e9, 2e9], [-5, 5, -5], [0, 0, 0]]) {
      const l = chartLayout(series(ys), opts);
      for (const n of everyNumber(l)) expect(Number.isFinite(n)).toBe(true);
    }
  });
});

describe('the chart, as the server sends it', () => {
  const html = renderToStaticMarkup(
    h(SweepChart, { points: series([5.4, 5.8, 6.2, 6.6, 7.0], 0, 25, 2), width: 340, group: ',', title: 'Sag at midspan', xTitle: 'Temperature (°F)', yTitle: 'Sag at midspan (ft)', about: 'The sag rises with the temperature.' }),
  );
  it('is one image with its sentence, a caption, both axes and their titles', () => {
    expect(html).toContain('<figcaption class="mp-plot__title">Sag at midspan</figcaption>');
    const svg = html.match(/<svg[^>]*>/)![0];
    expect(attr(svg, 'role')).toBe('img');
    expect(attr(svg, 'aria-label')).toBe('The sag rises with the temperature.');
    expect(html).toContain('>Temperature (°F)<');
    expect(html).toContain('>Sag at midspan (ft)<');
    expect(html.match(/class="mp-cs-chart__dot"/g)).toHaveLength(5);
    expect(html.match(/class="mp-cs-chart__ring"/g)).toHaveLength(1);
    expect(html.match(/class="mp-cs-chart__line"/g)).toHaveLength(1);
  });
  it('draws no NaN', () => {
    expect(html).not.toMatch(/NaN|undefined|Infinity/);
  });
});
