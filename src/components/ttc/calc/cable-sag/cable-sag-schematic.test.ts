import { createElement as h } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { analyseSafely, type CableSagAnalysis } from '@/lib/calc/cable-sag/analysis';
import { defaultCase, defaultCaseFor, type CableSagForm } from '@/lib/calc/cable-sag/model';
import { cableSagUi } from '@/lib/calc/cable-sag/strings';
import { CableSchematic, cableLayout, rectsHit, segHitsRect, wrap, type Layout, type LayoutOptions } from './CableSchematic';
import { SweepChart, chartLayout, niceStep, niceTicks, tickText, type ChartPoint } from './SweepChart';

/**
 * THE CABLE'S DRAWING AND ITS CHARTS — what is reckoned (`cableLayout`, `chartLayout`, held here without
 * React: where every line, symbol, arrow, word and tick goes) and what is written of it (`CableSchematic`,
 * `SweepChart`, as the server sends them).
 *
 * The drawing's two rules are held on a matrix of cases: a vertical scale stretched by a whole factor that
 * brings a shallow cable's sag to about a quarter of the drawing's width (and not at all for a deep one), and
 * no word touching another word or any line, at any stretch.
 */

const words = cableSagUi.en.results.labels;
const OPTIONS: LayoutOptions = {
  width: 720,
  group: ',',
  unit: 'ft',
  labels: words,
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
  renderToStaticMarkup(h(CableSchematic, { drawing: drawingOf(form), summary: 'A cable.', legend: cableSagUi.en.results.legend, stretch: cableSagUi.en.results.verticalNote, ...OPTIONS, ...over }));
const attr = (tag: string, name: string) => tag.match(new RegExp(` ${name}="([^"]*)"`))?.[1];
const curve = (l: Layout, id: string) => l.curves.find((c) => c.id === id)!;
const label = (l: Layout, kind: string, id: string) => l.labels.find((x) => x.kind === kind && x.id === id)!;
const everyNumber = (value: unknown): number[] => {
  if (typeof value === 'number') return [value];
  if (Array.isArray(value)) return value.flatMap(everyNumber);
  if (value && typeof value === 'object') return Object.values(value).flatMap(everyNumber);
  return [];
};

/** Everything wrong with where the words of a layout stand: a word on a line, on another word, on a mark, or off the drawing. */
function problems(l: Layout): string[] {
  const out: string[] = [];
  const bar = l.scaleBar;
  l.labels.forEach((a, i) => {
    const name = `${a.kind} ${a.id} “${a.value}”`;
    if (!a.clear) out.push(`${name} found no free spot`);
    if (a.rect.x0 < 0 || a.rect.x1 > l.width) out.push(`${name} is off the sides`);
    if (a.rect.y0 < l.viewTop || a.rect.y1 > l.viewTop + l.height) out.push(`${name} is off the view`);
    for (const s of l.obstacles) if (s !== a.leader && segHitsRect(s, a.rect, 1)) out.push(`${name} touches a line`);
    for (const b of l.labels.slice(i + 1)) if (rectsHit(a.rect, b.rect, 1)) out.push(`${name} touches ${b.kind} ${b.id}`);
    for (const s of l.supports) if (rectsHit(a.rect, { x0: s.x - s.half, y0: s.y, x1: s.x + s.half, y1: s.y + s.depth }, 1)) out.push(`${name} touches support ${s.id}`);
    for (const j of l.joints) if (rectsHit(a.rect, { x0: j.x - j.r, y0: j.y - j.r, x1: j.x + j.r, y1: j.y + j.r }, 1)) out.push(`${name} touches joint ${j.label}`);
    if (l.block && rectsHit(a.rect, l.block.rect, 1)) out.push(`${name} touches the block`);
    if (a.rect.y1 > bar.y - 6) out.push(`${name} is on the scale bar`);
    for (const arrow of l.loadArrows) if (rectsHit(a.rect, { x0: arrow.tip.x - 4, y0: arrow.tail.y, x1: arrow.tip.x + 4, y1: arrow.tip.y }, 1)) out.push(`${name} touches a load arrow`);
    if (l.H && rectsHit(a.rect, { x0: l.H.arrow.x1, y0: l.H.arrow.y - 4, x1: l.H.arrow.x2, y1: l.H.arrow.y + 4 }, 1)) out.push(`${name} touches the pretension arrow`);
  });
  if (l.block) for (const s of l.obstacles) if (segHitsRect(s, l.block.rect, 0)) out.push('a line runs through the block');
  return out;
}

/** The words the page writes on a drawing, as the calculator writes them. */
function textsOf(a: CableSagAnalysis, long: boolean) {
  const num = (v: number) => (long ? '1,234.56' : String(Math.round(v * 1000) / 1000));
  const f = a.units.force;
  if (a.hanging) {
    const e = a.hanging.exact;
    return { A: `tension ${num(e.tension.A)} ${f}`, B: `tension ${num(e.tension.B)} ${f}`, H: `pretension H ${num(e.H)} ${f}` };
  }
  if (a.state) return { A: null, B: null, H: `state 2 pretension H ${num(a.state.state2.H)} ${f}` };
  if (a.points) return { A: `tension ${num(a.points.segments[0].tension)} ${f}`, B: `tension ${num(a.points.segments[a.points.segments.length - 1].tension)} ${f}`, H: null };
  return undefined;
}
function blockOf(a: CableSagAnalysis, long: boolean): string[] | undefined {
  if (!a.state) return undefined;
  const num = (v: number) => (long ? '1,234.56' : String(Math.round(v * 1000) / 1000));
  const one = (n: number, title: string, s: { sagMid: number; H: number; tension: { max: number } }) =>
    `${n} – ${title}: sag ${num(s.sagMid)} ${a.units.length}, pretension H ${num(s.H)} ${a.units.force}, tension ${num(s.tension.max)} ${a.units.force}`;
  return [one(1, words.state1Title, a.state.state1), one(2, words.state2Title, a.state.state2)];
}

describe('the geometry helpers', () => {
  it('finds a segment that touches a rectangle grown by a margin, and one that does not', () => {
    const r = { x0: 10, y0: 10, x1: 20, y1: 20 };
    expect(segHitsRect({ x1: 0, y1: 15, x2: 30, y2: 15 }, r, 0)).toBe(true);
    expect(segHitsRect({ x1: 0, y1: 25, x2: 30, y2: 25 }, r, 0)).toBe(false);
    expect(segHitsRect({ x1: 0, y1: 22, x2: 30, y2: 22 }, r, 3)).toBe(true);
    expect(segHitsRect({ x1: 15, y1: 12, x2: 15, y2: 18 }, r, 0)).toBe(true);
    expect(segHitsRect({ x1: 0, y1: 0, x2: 9, y2: 9 }, r, 0)).toBe(false);
    expect(segHitsRect({ x1: 0, y1: 0, x2: 30, y2: 30 }, r, 0)).toBe(true);
  });
  it('finds two rectangles that overlap, with a margin', () => {
    const a = { x0: 0, y0: 0, x1: 10, y1: 10 };
    expect(rectsHit(a, { x0: 5, y0: 5, x1: 15, y1: 15 }, 0)).toBe(true);
    expect(rectsHit(a, { x0: 12, y0: 0, x1: 20, y1: 10 }, 0)).toBe(false);
    expect(rectsHit(a, { x0: 12, y0: 0, x1: 20, y1: 10 }, 3)).toBe(true);
  });
  it('breaks a paragraph into lines at its spaces', () => {
    expect(wrap('one two three four', 9)).toEqual(['one two', 'three', 'four']);
    expect(wrap('abc', 2)).toEqual(['abc']);
    expect(wrap('', 5)).toEqual([]);
  });
});

describe('the layout of the hanging example', () => {
  const layout = layoutOf(base);

  it('is as wide as it was asked to be, with the cable across it and its supports at one level', () => {
    expect(layout.width).toBe(720);
    const [A, B] = layout.supports;
    expect([A.id, B.id]).toEqual(['A', 'B']);
    // The span is across the width less a margin of 16 px at each side.
    expect(B.x - A.x).toBeCloseTo(100 * layout.scale, 2);
    expect(layout.scale).toBeCloseTo(688 / 100, 3);
    expect(A.y).toBe(B.y);
    expect(layout.chord).toEqual({ x1: A.x, y1: A.y, x2: B.x, y2: B.y });
  });

  it('stretches the vertical scale by a whole factor (a sag of a tenth of the span: 2), and says how much', () => {
    expect(layout.exaggeration).toBe(2);
    const c = curve(layout, 'exact');
    const lowest = c.points.reduce((m, p) => (p.y > m.y ? p : m));
    const [A, B] = layout.supports;
    expect(lowest.x).toBeCloseTo((A.x + B.x) / 2, 1);
    // 10 ft deep, at the horizontal scale times the stretch.
    expect(lowest.y - A.y).toBeCloseTo(10 * layout.scale * 2, 1);
    expect(layout.legend).toContain('vertical');
  });

  it('draws the cable from one support to the other', () => {
    const c = curve(layout, 'exact');
    const [A, B] = layout.supports;
    expect(c.points[0]).toEqual({ x: A.x, y: A.y });
    expect(c.points[c.points.length - 1].x).toBeCloseTo(B.x, 2);
    expect(c.points).toHaveLength(65);
    expect(c.d.startsWith(`M${A.x} ${A.y} L`)).toBe(true);
    expect(layout.curves.map((x) => x.id)).toEqual(['exact']);
  });

  it('draws the two sags as one line, said in words, because on a level span they are the same line', () => {
    expect(layout.dims).toHaveLength(1);
    const d = layout.dims[0];
    expect(d.both).toBe(true);
    expect(d.given).toBe(true);
    expect(label(layout, 'dim', 'mid').value).toBe('sag 10 ft');
    expect(d.y1).toBe(layout.chord.y1);
    expect(d.y2 - d.y1).toBeCloseTo(10 * layout.scale * 2, 1);
    expect(d.level).toBeNull();
  });

  it('names the supports, and writes the tension of each and the pretension in words', () => {
    expect(layout.labels.filter((x) => x.kind === 'support').map((x) => x.value)).toEqual(['A', 'B']);
    expect(label(layout, 'tension', 'A').value).toBe('tension 13.46 kip');
    expect(label(layout, 'tension', 'B').value).toBe('tension 13.46 kip');
    expect(label(layout, 'H', 'H').value).toBe('pretension H 12.5 kip');
  });

  it('puts the pretension under the lowest point, as a horizontal arrow with its words under it', () => {
    const H = layout.H!;
    const lowest = curve(layout, 'exact').points.reduce((m, p) => (p.y > m.y ? p : m));
    expect(H.x).toBeCloseTo(lowest.x, 1);
    expect(H.arrow.y).toBeGreaterThan(lowest.y);
    expect(H.arrow.x2).toBeGreaterThan(H.arrow.x1);
    const w = label(layout, 'H', 'H');
    expect(w.rect.y0).toBeGreaterThan(H.arrow.y);
    expect(Math.abs(w.x - H.x)).toBeLessThan(1);
  });

  it('draws the load as a row of arrows that end on the cable', () => {
    expect(layout.loadArrows.length).toBeGreaterThanOrEqual(4);
    expect(layout.loadArrows.length).toBeLessThanOrEqual(13);
    const c = curve(layout, 'exact');
    for (const a of layout.loadArrows) {
      expect(a.tip.y).toBeGreaterThan(a.tail.y);
      expect(a.tip.x).toBe(a.tail.x);
      const k = c.points.findIndex((p) => p.x >= a.tip.x);
      const p0 = c.points[k - 1];
      const p1 = c.points[k];
      const y = p0.y + ((a.tip.x - p0.x) / (p1.x - p0.x)) * (p1.y - p0.y);
      expect(a.tip.y).toBeCloseTo(y - 2, 0);
    }
  });

  it('draws a scale bar under the drawing, a round length of the horizontal scale, and says that it is the horizontal', () => {
    const bar = layout.scaleBar;
    expect(bar.length).toBe(20);
    expect(bar.x2 - bar.x1).toBeCloseTo(20 * layout.scale, 2);
    expect(bar.text.value).toBe('20 ft horizontal');
    expect(bar.y).toBeGreaterThan(layout.supports[0].y + layout.supports[0].depth);
    expect(bar.y).toBeLessThan(layout.viewTop + layout.height);
    expect(bar.x2).toBeLessThan(layout.width);
  });

  it('has no point loads, joints, polygon pieces or block: those are the other modes’', () => {
    expect([layout.pointLoads, layout.joints, layout.segments]).toEqual([[], [], []]);
    expect(layout.block).toBeNull();
  });

  it('explains what it draws, and only that', () => {
    expect(layout.legend).toEqual(['cable', 'chord', 'sagBoth', 'load', 'tension', 'H', 'support', 'vertical']);
  });

  it('is cropped to what is on it, and finite everywhere', () => {
    expect(layout.viewTop).toBeLessThan(0);
    expect(layout.height).toBeGreaterThan(100);
    expect(layout.height).toBeLessThan(560);
    for (const n of everyNumber({ ...layout, obstacles: undefined })) expect(Number.isFinite(n)).toBe(true);
    for (const s of layout.obstacles) for (const n of Object.values(s)) expect(Number.isFinite(n)).toBe(true);
  });

  it('keeps every word clear of every line and of every other word', () => {
    expect(problems(layout)).toEqual([]);
  });
});

describe('the vertical stretch', () => {
  const level = (ratio: number, width = 720) => layoutOf({ ...base, sag: ratio * 100 }, { width });
  const sagShare = (l: Layout) => (Math.max(...curve(l, 'exact').points.map((p) => p.y)) - l.supports[0].y) / (l.width - 32);

  it('stretches a shallow cable until its sag is about a quarter of the width, and never past 25 times', () => {
    expect(level(0.005).exaggeration).toBe(25);
    expect(level(0.02).exaggeration).toBe(12);
    expect(level(0.05).exaggeration).toBe(4);
    expect(level(0.1).exaggeration).toBe(2);
    for (const ratio of [0.02, 0.03, 0.05, 0.08, 0.1]) {
      const share = sagShare(level(ratio));
      expect(share, `ratio ${ratio}`).toBeGreaterThan(0.19);
      expect(share, `ratio ${ratio}`).toBeLessThan(0.3);
    }
    // At the cap it cannot reach the share: it is the cap that is said.
    expect(sagShare(level(0.005))).toBeCloseTo(0.125, 2);
  });

  it('does not stretch a cable that is already deep, and fades out between a tenth and a seventh of the span', () => {
    for (const ratio of [0.15, 0.2, 0.25, 0.5]) expect(level(ratio).exaggeration, `ratio ${ratio}`).toBe(1);
    const fading = [0.1, 0.11, 0.12, 0.13, 0.14, 0.15].map((r) => level(r).exaggeration);
    for (let i = 1; i < fading.length; i++) expect(fading[i]).toBeLessThanOrEqual(fading[i - 1]);
    expect(fading[fading.length - 1]).toBe(1);
    expect(level(0.12).exaggeration).toBe(1.5);
  });

  it('is a whole number, or a half, so that what is said under the drawing is what was done', () => {
    for (const ratio of [0.004, 0.007, 0.013, 0.02, 0.031, 0.044, 0.06, 0.09, 0.105, 0.12, 0.14, 0.3]) {
      const e = level(ratio).exaggeration;
      expect(e === 1 || e * 2 === Math.round(e * 2), `ratio ${ratio}`).toBe(true);
      if (e >= 2) expect(Number.isInteger(e)).toBe(true);
    }
  });

  it('stretches every height by the same factor: the sag line, the cable and the arrows agree', () => {
    const l = level(0.02);
    const d = l.dims[0];
    // 2 ft at the horizontal scale times 12.
    expect(d.y2 - d.y1).toBeCloseTo(2 * l.scale * 12, 1);
    const lowest = Math.max(...curve(l, 'exact').points.map((p) => p.y));
    expect(lowest - l.supports[0].y).toBeCloseTo(2 * l.scale * 12, 1);
  });

  it('says it under the drawing and in its legend, in both languages, only where it was done', () => {
    const shallow = show({ ...base, sag: 2 });
    expect(shallow).toContain('<p class="mp-cs-fig__stretch">Vertical scale drawn 12 times larger than the horizontal one, so that the sag can be seen. Widths are to scale; heights are not.</p>');
    expect(shallow).toContain('<span>Heights drawn 12 times larger than widths</span>');
    const es = show({ ...base, sag: 2 }, { legend: cableSagUi.es.results.legend, stretch: cableSagUi.es.results.verticalNote });
    expect(es).toContain('Escala vertical dibujada 12 veces mayor que la horizontal');
    expect(es).toContain('<span>Alturas dibujadas 12 veces mayores que los anchos</span>');
    const deep = show({ ...base, sag: 25 });
    expect(deep).not.toContain('mp-cs-fig__stretch');
    expect(deep).not.toContain('Heights drawn');
    expect(show({ ...base, sag: 12 })).toContain('Vertical scale drawn 1.5 times larger');
  });

  it('keeps the drawing within the height it may have, by stretching less where the span is steep', () => {
    const l = layoutOf({ ...base, rise: 60, sag: 2 });
    expect(l.height).toBeLessThanOrEqual(560 + 60);
    expect(l.exaggeration).toBeLessThan(12);
  });
});

describe('a cable under its own weight and a load together', () => {
  const layout = layoutOf(combined);
  it('draws the exact cable solid and the parabola beside it, and says so in the legend', () => {
    expect(layout.curves.map((c) => c.id)).toEqual(['exact', 'parabola']);
    expect(layout.legend.slice(0, 2)).toEqual(['cable', 'parabola']);
    const e = curve(layout, 'exact');
    const p = curve(layout, 'parabola');
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
    expect(A.y - B.y).toBeCloseTo(20 * layout.scale * layout.exaggeration, 1);
  });
  it('draws the two sags as two lines named in words, the one given heavier', () => {
    expect(layout.dims.map((d) => d.id)).toEqual(['mid', 'low']);
    const [mid, low] = layout.dims;
    expect(mid.both || low.both).toBe(false);
    expect(low.given).toBe(true);
    expect(mid.given).toBe(false);
    expect(label(layout, 'dim', 'low').value).toBe('sag below lower support 12 ft');
    expect(label(layout, 'dim', 'mid').value).toMatch(/^sag at midspan [\d.]+ ft$/);
    expect(layout.legend).toEqual(expect.arrayContaining(['sagMid', 'sagLow']));
  });
  it('measures the sag below the lower support from that support’s level, with a level line from it', () => {
    const low = layout.dims.find((d) => d.id === 'low')!;
    const [A] = layout.supports;
    expect(low.level).toEqual({ x1: A.x, x2: low.x, y: A.y });
    expect(low.y1).toBe(A.y);
    expect(low.y2 - low.y1).toBeCloseTo(12 * layout.scale * layout.exaggeration, 1);
  });
  it('keeps every word clear', () => {
    expect(problems(layout)).toEqual([]);
  });
});

describe('a cable whose lowest point is outside the span', () => {
  const layout = layoutOf(steep);
  it('draws no pretension arrow where there is no lowest point to put it, and no sag below the lower support', () => {
    expect(layout.H).toBeNull();
    expect(layout.dims.map((d) => d.id)).toEqual(['mid']);
    expect(layout.legend).not.toContain('H');
  });
  it('keeps every word clear', () => {
    expect(problems(layout)).toEqual([]);
  });
});

describe('what is switched off is not drawn', () => {
  it('draws no tensions, no sags, no load arrows when they are not asked for', () => {
    const l = layoutOf(base, { tensions: false, dims: false, load: false });
    expect(l.labels.map((x) => x.kind)).toEqual(['support', 'support']);
    expect([l.dims, l.loadArrows]).toEqual([[], []]);
    expect(l.H).toBeNull();
    expect(l.legend).toEqual(['cable', 'chord', 'support', 'vertical']);
  });
  it('draws no tension without its words', () => {
    const l = layoutOf(base, { texts: { A: null, B: undefined, H: null } });
    expect(l.labels.some((x) => x.kind === 'tension' || x.kind === 'H')).toBe(false);
    expect(l.H).toBeNull();
  });
});

describe('a change of state', () => {
  const a = analyseSafely(state);
  const layout = layoutOf(state, { texts: textsOf(a, false), block: blockOf(a, false) });

  it('stretches the vertical scale so that the 6 ft sag can be seen, and the gap between the two states with it', () => {
    expect(layout.exaggeration).toBe(11);
    const deepest = (id: string) => Math.max(...curve(layout, id).points.map((p) => p.y));
    const gap = deepest('state2') - deepest('state1');
    // 0.195 ft at the horizontal scale times 11: a few pixels, drawn like the rest.
    expect(gap).toBeCloseTo(0.195 * layout.scale * 11, 0);
    expect(gap).toBeGreaterThan(3);
  });

  it('draws the cable in state 1 dashed under the one in state 2, and a sag line for each, tagged 1 and 2', () => {
    expect(layout.curves.map((c) => c.id)).toEqual(['state1', 'state2']);
    expect(layout.dims.map((d) => d.id)).toEqual(['state1', 'mid']);
    expect(layout.labels.filter((x) => x.kind === 'dim').map((x) => x.value)).toEqual(['1', '2']);
    expect(layout.dims.map((d) => d.given)).toEqual([true, false]);
    expect(layout.legend).toEqual(expect.arrayContaining(['state1', 'state2', 'chord', 'sagMid', 'vertical']));
    expect(layout.loadArrows).toEqual([]);
  });

  it('gives the figures of each state in a block of words above the drawing, not on the curves', () => {
    const b = layout.block!;
    expect(b.lines.map((l) => l.value)).toEqual([
      '1 – State 1 (dashed line): sag 6 ft, pretension H 3.015 kip, tension 3.025 kip',
      '2 – State 2 (solid line): sag 6.195 ft, pretension H 4.735 kip, tension 4.751 kip',
    ]);
    // Above everything that is drawn, with room for the tags of the two sag lines between.
    expect(b.rect.y1).toBeLessThan(Math.min(...curve(layout, 'state2').points.map((p) => p.y)) - 20);
    expect(layout.labels.some((x) => x.kind === 'tension')).toBe(false);
    expect(label(layout, 'H', 'H').value).toBe('state 2 pretension H 4.735 kip');
  });

  it('breaks the block’s lines to the width of a phone, and keeps them on the page', () => {
    const narrow = layoutOf(state, { width: 358, texts: textsOf(a, false), block: blockOf(a, false) });
    expect(narrow.block!.lines.length).toBeGreaterThan(2);
    for (const l of narrow.block!.lines) expect(l.value.length * 6.6).toBeLessThanOrEqual(358 - 32 + 7);
    expect(narrow.block!.rect.x1).toBeLessThanOrEqual(356);
    expect(problems(narrow)).toEqual([]);
  });

  it('keeps every word clear', () => {
    expect(problems(layout)).toEqual([]);
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

  it('stretches a polygon that is shallow like any cable, and does not stretch one that is deep', () => {
    expect(layout.exaggeration).toBe(1);
    expect(layoutOf({ ...points, pointsSag: 1.2 }).exaggeration).toBeGreaterThan(5);
  });

  it('marks a joint at each load, numbered, hung 8, 12 and 8 ft under the supports', () => {
    expect(layout.joints.map((j) => j.label)).toEqual([1, 2, 3]);
    const [A] = layout.supports;
    expect(layout.joints.map((j) => Math.round((j.y - A.y) / (layout.scale * layout.exaggeration)))).toEqual([8, 12, 8]);
    expect(layout.joints.map((j) => Math.round((j.x - A.x) / layout.scale))).toEqual([15, 30, 45]);
    expect(layout.labels.filter((x) => x.kind === 'joint').map((x) => x.value)).toEqual(['1', '2', '3']);
  });

  it('draws each load as an arrow that ends on its joint, with its size over the tail, longer for the larger', () => {
    expect(layout.labels.filter((x) => x.kind === 'load').map((x) => x.value)).toEqual(['10', '20', '10']);
    layout.pointLoads.forEach((a, i) => {
      const j = layout.joints[i];
      expect(a.tip.x).toBe(j.x);
      expect(a.tip.y).toBeLessThan(j.y);
      expect(a.tail.y).toBeLessThan(a.tip.y);
      expect(label(layout, 'load', String(i + 1)).rect.y1).toBeLessThanOrEqual(a.tail.y);
    });
    const len = (a: (typeof layout.pointLoads)[number]) => a.tip.y - a.tail.y;
    expect(len(layout.pointLoads[1])).toBeGreaterThan(len(layout.pointLoads[0]));
    expect(len(layout.pointLoads[0])).toBeCloseTo(len(layout.pointLoads[2]), 3);
  });

  it('draws the sag that was given at its position, a little left of the load’s arrow, and says what it is', () => {
    expect(layout.dims).toHaveLength(1);
    expect(label(layout, 'dim', 'mid').value).toBe('sag 12 ft');
    expect(layout.dims[0].x).toBeCloseTo(layout.joints[1].x - 12, 3);
    expect(layout.dims[0].y2 - layout.dims[0].y1).toBeCloseTo(12 * layout.scale * layout.exaggeration, 1);
    expect(layout.legend).toEqual(['polygon', 'chord', 'sagAt', 'pointLoad', 'joint', 'tension', 'support']);
  });

  it('draws a load that pulls up from below, and writes its minus sign', () => {
    const up = { ...points, points: [{ id: 1, x: 15, P: -4 }, { id: 2, x: 30, P: 20 }], pointsKnown: 'H' as const, pointsH: 40 };
    const l = layoutOf(up);
    const first = l.pointLoads[0];
    expect(label(l, 'load', '1').value).toBe('−4');
    expect(first.tip.y).toBeGreaterThan(l.joints[0].y);
    expect(first.tail.y).toBeGreaterThan(first.tip.y);
    expect(problems(l)).toEqual([]);
  });

  it('keeps every word clear', () => {
    expect(problems(layout)).toEqual([]);
  });
});

describe('a cable that cannot be solved', () => {
  it('is drawn as its supports and the chord, whatever the form holds', () => {
    for (const form of [{ ...base, span: 0 }, { ...base, span: Number.NaN }, { ...base, rise: Number.NaN }, { ...base, rise: 1e9 }, { ...state, alpha: Number.NaN }, { ...points, points: [] }]) {
      const l = layoutOf(form);
      expect(l.curves).toEqual([]);
      expect(l.supports).toHaveLength(2);
      expect(l.dims).toEqual([]);
      expect(l.exaggeration).toBe(1);
      for (const n of everyNumber({ ...l, obstacles: undefined })) expect(Number.isFinite(n)).toBe(true);
      expect(problems(l)).toEqual([]);
    }
  });
});

describe('no word touches another word or any line, on a matrix of cables', () => {
  const RATIOS = [0.005, 0.02, 0.05, 0.1, 0.25, 0.5];
  const RISES = [0, 0.6];
  const WIDTHS = [358, 720];
  const matrix: { name: string; form: CableSagForm }[] = [];
  for (const units of ['us', 'si'] as const) {
    for (const ratio of RATIOS) {
      for (const rise of RISES) {
        const hanging = defaultCaseFor('hanging', units);
        matrix.push({ name: `hanging ${units} sag/span ${ratio} rise ${rise}`, form: { ...hanging, rise: rise * hanging.span, sag: ratio * hanging.span } });
        const st = defaultCaseFor('state', units);
        matrix.push({ name: `state ${units} sag/span ${ratio} rise ${rise}`, form: { ...st, rise: rise * st.span, sag: ratio * st.span } });
        const pt = defaultCaseFor('points', units);
        matrix.push({ name: `points ${units} sag/span ${ratio} rise ${rise}`, form: { ...pt, rise: rise * pt.span, pointsSag: ratio * pt.span } });
      }
    }
  }

  it('solves most of the matrix, so that it tests something', () => {
    const solved = matrix.filter((m) => analyseSafely(m.form).issues.length === 0);
    expect(solved.length).toBeGreaterThan(matrix.length * 0.85);
    for (const mode of ['hanging', 'state', 'points']) expect(solved.filter((m) => m.name.startsWith(mode)).length).toBeGreaterThan(20);
  });

  for (const long of [false, true]) {
    it(`keeps every word clear in every solved case, at widths of ${WIDTHS.join(' and ')}${long ? ', with numbers as long as 1,234.56' : ''}`, () => {
      const found: string[] = [];
      let checked = 0;
      for (const { name, form } of matrix) {
        const a = analyseSafely(form);
        if (a.issues.length) continue;
        for (const width of WIDTHS) {
          const l = cableLayout(a.drawing, { ...OPTIONS, width, unit: a.units.length, texts: textsOf(a, long), block: blockOf(a, long), shares: a.points?.segments.map((s) => s.share) });
          checked++;
          for (const p of problems(l)) found.push(`${name} @${width}: ${p}`);
          for (const n of everyNumber({ ...l, obstacles: undefined })) if (!Number.isFinite(n)) found.push(`${name} @${width}: not finite`);
          // The stretch is whole or a half, and none for a deep cable.
          if (a.drawing.box.height > 0 && l.exaggeration > 1) expect(l.exaggeration === Math.round(l.exaggeration * 2) / 2, name).toBe(true);
        }
      }
      expect(checked).toBeGreaterThan(100);
      expect(found).toEqual([]);
    });
  }

  it('stretches each shallow case and no deep one, whatever the mode', () => {
    for (const { name, form } of matrix) {
      const a = analyseSafely(form);
      if (a.issues.length || form.rise !== 0) continue;
      const l = cableLayout(a.drawing, { ...OPTIONS, texts: textsOf(a, false), block: blockOf(a, false) });
      const ratio = (a.drawing.box.height > 0 ? Math.max(...a.drawing.curves.flatMap((c) => c.points.map((p) => -p.z))) : 0) / a.drawing.box.width;
      if (ratio >= 0.15) expect(l.exaggeration, name).toBe(1);
      if (ratio > 0 && ratio < 0.09) expect(l.exaggeration, name).toBeGreaterThanOrEqual(2);
    }
  });
});

describe('the drawing, as the server sends it', () => {
  const html = show(base);

  it('is one image with a sentence for whoever cannot see it, its shapes hidden from them, cropped by its view box', () => {
    const svg = html.match(/<svg class="mp-plot__svg mp-cs-fig__svg"[^>]*>/)![0];
    expect(attr(svg, 'role')).toBe('img');
    expect(attr(svg, 'aria-label')).toBe('A cable.');
    expect(attr(svg, 'viewBox')).toMatch(/^0 -\d+(\.\d+)? 720 \d+(\.\d+)?$/);
    expect(html).toContain('<g aria-hidden="true">');
  });

  it('draws the cable, the chord, the supports, the dimension line, the load arrows and the pretension, each word in its own text', () => {
    expect(html.match(/<path class="mp-cs-fig__curve mp-cs-fig__curve--exact"/g)).toHaveLength(1);
    const drawn = html.slice(0, html.indexOf('<ul class="mp-cs-fig__legend">'));
    expect(drawn.match(/class="mp-cs-fig__chord"/g)).toHaveLength(1);
    expect(drawn.match(/class="mp-cs-fig__support"/g)).toHaveLength(2);
    expect(html.match(/class="mp-cs-fig__dim mp-cs-fig__dim--mid mp-cs-fig__dim--given"/g)).toHaveLength(1);
    expect(html.match(/class="mp-cs-fig__load"/g)!.length).toBeGreaterThanOrEqual(4);
    expect(html).toContain('class="mp-cs-fig__harrow"');
    expect(html).toMatch(/<text class="mp-cs-fig__label mp-cs-fig__label--dim"[^>]*>sag 10 ft<\/text>/);
    expect(html).toMatch(/<text class="mp-cs-fig__label mp-cs-fig__label--tension"[^>]*>tension 13.46 kip<\/text>/);
    expect(html).toMatch(/<text class="mp-cs-fig__label mp-cs-fig__label--H"[^>]*>pretension H 12.5 kip<\/text>/);
    expect(html).toContain('<g class="mp-cs-fig__scale">');
    expect(html).toContain('>20 ft horizontal<');
    expect(html).not.toMatch(/>d = |>s = |>H = |>T = /);
  });

  it('draws a thin leader from a word that stands away from what it names', () => {
    const l = layoutOf(defaultCaseFor('points'), { texts: { A: 'tension 42.5 kip', B: 'tension 42.5 kip', H: null } });
    const tied = l.labels.filter((x) => x.leader);
    const out = show(defaultCaseFor('points'), { texts: { A: 'tension 42.5 kip', B: 'tension 42.5 kip', H: null } });
    expect(out.match(/class="mp-cs-fig__leader"/g) ?? []).toHaveLength(tied.length);
  });

  it('explains every kind of mark it uses, in the words it is given', () => {
    const w = cableSagUi.en.results.legend;
    for (const key of ['cable', 'chord', 'sagBoth', 'load', 'tension', 'H', 'support'] as const) expect(html).toContain(`<span>${w[key]}</span>`);
    expect(html).not.toContain(w.parabola);
  });

  it('draws nothing it should not: no NaN, no undefined, no exponent in any coordinate', () => {
    for (const form of [base, combined, inclined, steep, state, points, { ...base, span: 0 }]) {
      const out = show(form, { texts: textsOf(analyseSafely(form), false), block: blockOf(analyseSafely(form), false) });
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

  it('draws the block of a change of state as text above the drawing, and state 1 over state 2', () => {
    const a = analyseSafely(state);
    const out = show(state, { texts: textsOf(a, false), block: blockOf(a, false) });
    expect(out).toContain('<g class="mp-cs-fig__block">');
    expect(out).toContain('State 1 (dashed line): sag 6 ft');
    const drawn = out.slice(0, out.indexOf('<ul class="mp-cs-fig__legend">'));
    expect(drawn.indexOf('mp-cs-fig__curve--state1')).toBeGreaterThan(drawn.indexOf('mp-cs-fig__curve--state2'));
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
