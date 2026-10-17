import { createElement as h } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { beamStrings } from '@/lib/calc/beam/strings';
import { analyseSafely } from '@/lib/calc/truss/analysis';
import { defaultTruss, reduceTruss, type TrussForm } from '@/lib/calc/truss/model';
import { sharedWords, trussUi } from '@/lib/calc/truss/strings';
import { TEMPLATE_IDS } from '@/lib/calc/truss/templates';
import { TrussCalculator } from './TrussCalculator';
import { SIZES, TrussSchematic, drawingFacts, everyWidth, forceText, stretchOffer, trussLayout, wantedWidth, type Layout, type LayoutOptions, type Rect, type Stretch } from './TrussSchematic';

/**
 * TWO CHOICES ABOUT THE DRAWING:
 *   1. a very flat (or very tall) truss may be drawn with its heights (or widths) larger - off by default, only offered
 *      past a proportion, angles stated not true;
 *   2. a dense truss writes its numbers smaller, in steps, before it leaves any off, and "Show every force" widens the
 *      drawing until all of them fit.
 */

const OPTIONS: LayoutOptions = { width: 720, forces: true, numbers: false, deformed: false, group: ',' };
const drawingOf = (form: TrussForm) => analyseSafely(form).drawing;
const layoutOf = (form: TrussForm, over: Partial<LayoutOptions> = {}): Layout => trussLayout(drawingOf(form), { ...OPTIONS, ...over });
const asTemplate = (id: (typeof TEMPLATE_IDS)[number], units: 'us' | 'si' = 'us') => reduceTruss(units === 'us' ? defaultTruss() : reduceTruss(defaultTruss(), { type: 'units', units }), { type: 'template', template: id });
const pratt = (params: Record<string, number>, units: 'us' | 'si' = 'us') => reduceTruss(units === 'us' ? defaultTruss() : reduceTruss(defaultTruss(), { type: 'units', units }), { type: 'template', template: 'pratt', params });
const tall = (): TrussForm => {
  const f = pratt({ span: 4, height: 8, panels: 4, load: 10 });
  return { ...f, nodes: f.nodes.map((n) => ({ ...n, y: n.y * 7.5 })) };
};
/** 19 X-braced bays of 10 ft: 40 nodes, 96 members; with `extra` 24 longer diagonals, 120. */
const braced = (extra = false): TrussForm => {
  const bays = 19;
  const base = defaultTruss();
  let id = 1;
  const nodes: TrussForm['nodes'] = [];
  const bottom: number[] = [];
  const top: number[] = [];
  for (let i = 0; i <= bays; i++) {
    nodes.push({ id, x: i * 10, y: 0 });
    bottom.push(id++);
  }
  for (let i = 0; i <= bays; i++) {
    nodes.push({ id, x: i * 10, y: 10 });
    top.push(id++);
  }
  const members: TrussForm['members'] = [];
  const add = (i: number, j: number) => members.push({ id: id++, i, j, A: null, E: null });
  for (let i = 0; i < bays; i++) {
    add(bottom[i], bottom[i + 1]);
    add(top[i], top[i + 1]);
    add(bottom[i], top[i + 1]);
    add(top[i], bottom[i + 1]);
  }
  for (let i = 0; i <= bays; i++) add(bottom[i], top[i]);
  if (extra) {
    for (let i = 0; i < 18; i++) add(bottom[i], top[i + 2]);
    for (let i = 0; i < 6; i++) add(top[i], bottom[i + 2]);
  }
  const supports: TrussForm['supports'] = [
    { id: id++, node: bottom[0], kind: 'pin', angle: 90 },
    { id: id++, node: bottom[bays], kind: 'roller', angle: 90 },
  ];
  const loads: TrussForm['loads'] = top.map((node) => ({ id: id++, node, fx: 0, fy: -10 }));
  return { ...base, nodes, members, supports, loads, nextId: id };
};
const roller = (angle: number) => {
  const f = defaultTruss();
  return reduceTruss(f, { type: 'patch', list: 'supports', id: f.supports.find((s) => s.kind === 'roller')!.id, patch: { angle } });
};
const heavy = () => reduceTruss(defaultTruss(), { type: 'patch', list: 'loads', id: defaultTruss().loads[1].id, patch: { fy: -1e9 } });

const FLAT = pratt({ span: 200, height: 8, panels: 8, load: 10 });
const FLATTER = pratt({ span: 200, height: 1, panels: 8, load: 10 });

const schematic = (form: TrussForm, over: Record<string, unknown> = {}, lang: 'en' | 'es' = 'en') =>
  renderToStaticMarkup(
    h(TrussSchematic, { drawing: drawingOf(form), width: 720, forces: true, numbers: false, deformed: false, group: ',', summary: 'A truss.', legend: trussUi[lang].results.legend, notes: trussUi[lang].results.drawingNotes, ...over }),
  );
const calculator = (lang: 'en' | 'es', initial: TrussForm) => renderToStaticMarkup(h(TrussCalculator, { t: sharedWords(beamStrings[lang].ui), w: trussUi[lang], initial }));
const text = (html: string) => html.replace(/<[^>]*>/g, ' ').replace(/&#x27;|&#39;/g, "'").replace(/\s+/g, ' ');

/* ── the checker: shares no code with the layout ── */
const toRect = (x: number, y: number, r: Rect) => Math.hypot(Math.max(r.x0 - x, 0, x - r.x1), Math.max(r.y0 - y, 0, y - r.y1));
function gap(seg: { x1: number; y1: number; x2: number; y2: number }, r: Rect): number {
  if (Math.max(seg.x1, seg.x2) < r.x0 - 30 || Math.min(seg.x1, seg.x2) > r.x1 + 30 || Math.max(seg.y1, seg.y2) < r.y0 - 30 || Math.min(seg.y1, seg.y2) > r.y1 + 30) return Infinity;
  const steps = Math.max(1, Math.ceil(Math.hypot(seg.x2 - seg.x1, seg.y2 - seg.y1)));
  let best = Infinity;
  for (let i = 0; i <= steps; i++) best = Math.min(best, toRect(seg.x1 + ((seg.x2 - seg.x1) * i) / steps, seg.y1 + ((seg.y2 - seg.y1) * i) / steps, r));
  return best;
}
function crowding(layout: Layout, what: string): string[] {
  const words: { name: string; rect: Rect }[] = [];
  for (const m of layout.members) if (m.text) words.push({ name: `member ${m.label}`, rect: m.text.rect });
  for (const a of layout.loads) words.push({ name: `load ${a.label}`, rect: a.text.rect });
  for (const a of layout.reactions) words.push({ name: `reaction ${a.label}`, rect: a.text.rect });
  for (const d of layout.deformed?.nodes ?? []) if (d.tag) words.push({ name: `tag ${d.label}`, rect: d.tag.rect });
  const bad: string[] = [];
  for (const w of words) {
    const r = w.rect;
    if (r.x0 < 0 || r.y0 < 0 || r.x1 > layout.width || r.y1 > layout.height) bad.push(`${what}: ${w.name} leaves the drawing`);
    for (const m of layout.members) if (gap(m, r) < m.strokeWidth / 2 + 0.5) bad.push(`${what}: ${w.name} touches member ${m.label}`);
    for (const n of layout.nodes) if (toRect(n.x, n.y, r) < n.r) bad.push(`${what}: ${w.name} touches node ${n.label}`);
    for (const s of layout.supports) if (r.x0 < s.box.x1 && s.box.x0 < r.x1 && r.y0 < s.box.y1 && s.box.y0 < r.y1) bad.push(`${what}: ${w.name} on the support at node ${s.node}`);
    for (const a of [...layout.loads, ...layout.reactions]) if (gap({ x1: a.tail.x, y1: a.tail.y, x2: a.tip.x, y2: a.tip.y }, r) < 1.5) bad.push(`${what}: ${w.name} on an arrow of node ${a.node}`);
    for (const other of words) if (other !== w && r.x0 < other.rect.x1 && other.rect.x0 < r.x1 && r.y0 < other.rect.y1 && other.rect.y0 < r.y1) bad.push(`${what}: ${w.name} over ${other.name}`);
  }
  return bad;
}
/** The width the page draws at: the column's, or wider; on paper exactly the sheet's. */
const drawnWidth = (form: TrussForm, column: number, paper: boolean, over: Partial<LayoutOptions> = {}) =>
  paper ? column : wantedWidth(drawingOf(form), { forces: true, numbers: over.numbers ?? false, group: ',' }, column);

/* ═══ 1. Draw taller / draw wider ═══════════════════════════════════════════ */

describe('a stretched drawing is offered only past a proportion, and by a clean number', () => {
  it('offers nothing to the example, to a template, or to a truss 8 : 1', () => {
    expect(stretchOffer(drawingOf(defaultTruss()))).toBeNull();
    for (const id of TEMPLATE_IDS) expect(stretchOffer(drawingOf(asTemplate(id))), id).toBeNull();
    expect(stretchOffer(drawingOf(pratt({ span: 64, height: 8, panels: 8, load: 10 })))).toBeNull();
    expect(stretchOffer(drawingOf(pratt({ span: 72, height: 8, panels: 8, load: 10 })))).not.toBeNull();
  });

  it('offers a flat truss its heights, and a tall one its widths, by 2, 3, 4, 5, 6, 8 or 10', () => {
    const flat = stretchOffer(drawingOf(FLAT))!;
    expect(flat.axis).toBe('heights');
    const flatter = stretchOffer(drawingOf(FLATTER))!;
    expect(flatter.axis).toBe('heights');
    const high = stretchOffer(drawingOf(tall()))!;
    expect(high.axis).toBe('widths');
    for (const o of [flat, flatter, high]) expect([2, 3, 4, 5, 6, 8, 10]).toContain(o.n);
    // 25 : 1 -> 5 (the drawn height is a fifth of the width); 200 : 1 -> as much as 10 allows.
    expect(flat.n).toBe(5);
    expect(flatter.n).toBe(10);
    expect(high.n).toBe(3);
  });

  it('brings the drawn height to about a fifth of the width when the number allows it', () => {
    for (const span of [72, 100, 160, 200, 320, 400]) {
      const form = pratt({ span, height: 8, panels: 8, load: 10 });
      const drawing = drawingOf(form);
      const offer = stretchOffer(drawing)!;
      const natural = drawing.box.height / drawing.box.width;
      if (offer.n < 10 && offer.n > 2) expect(natural * offer.n, `span ${span}`).toBeGreaterThan(0.14);
      if (offer.n < 10 && offer.n > 2) expect(natural * offer.n, `span ${span}`).toBeLessThan(0.3);
      expect(natural * offer.n, `span ${span}`).toBeLessThan(0.5);
    }
  });

  it('is exactly the same drawing as before when it is not asked for', () => {
    const offer = stretchOffer(drawingOf(FLAT))!;
    const plain = layoutOf(FLAT, { width: 1200 });
    expect(plain.stretch).toBeNull();
    expect(plain.scaleX).toBe(plain.scaleY);
    expect(layoutOf(FLAT, { width: 1200, stretch: null })).toEqual(plain);
    expect(layoutOf(FLAT, { width: 1200, stretch: offer }).stretch).toEqual(offer);
  });
});

describe('a stretched drawing joins the stretched nodes and leaves every mark alone', () => {
  for (const [name, form] of [['flat 25 : 1', FLAT], ['flat 200 : 1', FLATTER], ['tall 1 : 15', tall()]] as const) {
    it(`${name}: heights (or widths) larger by exactly N, members on the stretched nodes, circles round and the same size`, () => {
      const offer = stretchOffer(drawingOf(form))!;
      const plain = layoutOf(form, { width: 1200 });
      const bent = layoutOf(form, { width: 1200, stretch: offer });
      const [along, across] = offer.axis === 'heights' ? (['scaleX', 'scaleY'] as const) : (['scaleY', 'scaleX'] as const);
      // The stretched direction is drawn N times the other.
      expect(bent[across] / bent[along]).toBeCloseTo(offer.n, 3);
      expect(bent.scale).toBeCloseTo(bent[along], 3);
      // The drawn truss is larger in that direction only.
      const span = (l: Layout, f: 'x' | 'y') => Math.max(...l.nodes.map((n) => n[f])) - Math.min(...l.nodes.map((n) => n[f]));
      const grew = (f: 'x' | 'y') => span(bent, f) / span(plain, f);
      if (offer.axis === 'heights') expect(grew('y')).toBeGreaterThan(1.5);
      else expect(grew('x')).toBeGreaterThan(1.5);
      // Every member runs between the stretched positions of its two nodes.
      const at = new Map(bent.nodes.map((n) => [n.label, n]));
      for (const m of bent.members) {
        expect(m.x1, `member ${m.label}`).toBeCloseTo(at.get(m.i)!.x, 3);
        expect(m.y1).toBeCloseTo(at.get(m.i)!.y, 3);
        expect(m.x2).toBeCloseTo(at.get(m.j)!.x, 3);
        expect(m.y2).toBeCloseTo(at.get(m.j)!.y, 3);
      }
      // Nodes are circles of the same size; supports and arrows are the same size as without the stretch.
      expect(bent.nodes.map((n) => n.r)).toEqual(plain.nodes.map((n) => n.r));
      expect(bent.supports.map((s) => s.depth)).toEqual(plain.supports.map((s) => s.depth));
      for (const [i, a] of bent.loads.entries()) expect(Math.hypot(a.tip.x - a.tail.x, a.tip.y - a.tail.y)).toBeCloseTo(Math.hypot(plain.loads[i].tip.x - plain.loads[i].tail.x, plain.loads[i].tip.y - plain.loads[i].tail.y), 3);
      // Written upright: every number's box is wider than tall and as tall as without the stretch.
      for (const m of bent.members) if (m.text) expect(m.text.rect.y1 - m.text.rect.y0).toBeCloseTo(13 * (bent.fontSize / 11), 3);
      expect(bent.height).toBeLessThanOrEqual(560.01);
    });
  }

  it('is the same markup for the marks: circles keep their radius, the text is never skewed, no scale() on a mark', () => {
    const offer = stretchOffer(drawingOf(FLAT))!;
    const html = schematic(FLAT, { width: 1200, stretch: true });
    const radii = new Set([...html.matchAll(/<circle cx="[^"]*" cy="[^"]*" r="([\d.]+)"/g)].map((m) => m[1]));
    expect([...radii].length).toBeGreaterThanOrEqual(1);
    expect(html).not.toMatch(/scale\(|skew|matrix\(/);
    expect(layoutOf(FLAT, { width: 1200, stretch: offer }).nodes.every((n) => radii.has(String(n.r)))).toBe(true);
  });

  it('draws the displacement of a stretched drawing no larger than the true drawing does', () => {
    const offer = stretchOffer(drawingOf(FLAT))!;
    const homeToMoved = (l: Layout) => l.deformed!.nodes.map((m) => ({ label: m.label, dx: m.x - l.nodes.find((n) => n.label === m.label)!.x, dy: m.y - l.nodes.find((n) => n.label === m.label)!.y }));
    const plain = homeToMoved(layoutOf(FLAT, { width: 1200, deformed: true }));
    const bent = homeToMoved(layoutOf(FLAT, { width: 1200, deformed: true, stretch: offer }));
    expect(bent.length).toBe(plain.length);
    for (const [i, p] of plain.entries()) {
      expect(bent[i].dx).toBeCloseTo(p.dx, 1);
      expect(bent[i].dy).toBeCloseTo(p.dy, 1);
    }
  });
});

describe('a stretched drawing keeps every word clear of every line, node, support, arrow and word', { timeout: 120000 }, () => {
  const cases: [string, TrussForm, Stretch][] = [
    ['flat 25 : 1', FLAT, stretchOffer(drawingOf(FLAT))!],
    ['flat 200 : 1', FLATTER, stretchOffer(drawingOf(FLATTER))!],
    ['tall 1 : 15', tall(), stretchOffer(drawingOf(tall()))!],
    ['flat in SI', pratt({ span: 60, height: 2, panels: 12, load: 20 }, 'si'), { axis: 'heights', n: 5 }],
  ];
  for (const [name, form, stretch] of cases) {
    it(`${name}: at 320, 390, 720 and 1200 px and on paper, with and without numbers, and deformed`, () => {
      for (const [column, paper] of [[320, false], [390, false], [720, false], [1200, false], [724, true]] as const) {
        for (const [numbers, deformed] of [[false, false], [true, false], [true, true]] as const) {
          const width = drawnWidth(form, column, paper, { numbers });
          const layout = layoutOf(form, { width, numbers, deformed, stretch });
          expect(crowding(layout, `${name} ${paper ? 'paper' : column}${numbers ? ' numbers' : ''}${deformed ? ' deformed' : ''}`)).toEqual([]);
        }
      }
    });
  }
});

describe('the words about a stretched drawing, in both languages', { timeout: 120000 }, () => {
  it('states under the drawing, in the legend and in the description that heights are drawn N times larger and angles are not true', () => {
    const n = stretchOffer(drawingOf(FLAT))!.n;
    const en = schematic(FLAT, { stretch: true });
    expect(text(en)).toContain(`Heights are drawn ${n} times larger than widths: angles are not true.`);
    expect(text(en)).toContain(`Heights ×${n}: angles are not true`);
    expect(en).toContain('mp-truss-fig__key--stretched');
    const es = schematic(FLAT, { stretch: true }, 'es');
    expect(text(es)).toContain(`Las alturas se dibujan ${n} veces mayores que los anchos: los ángulos no son reales.`);
    expect(text(es)).toContain(`Alturas ×${n}: los ángulos no son reales`);
  });

  it('says widths for a tall truss', () => {
    const n = stretchOffer(drawingOf(tall()))!.n;
    expect(text(schematic(tall(), { stretch: true }))).toContain(`Widths are drawn ${n} times larger than heights: angles are not true.`);
    expect(text(schematic(tall(), { stretch: true }, 'es'))).toContain(`Los anchos se dibujan ${n} veces mayores que las alturas`);
  });

  it('says nothing of it when it is off, or when the truss has ordinary proportions', () => {
    expect(schematic(FLAT)).not.toContain('angles are not true');
    expect(schematic(FLAT)).not.toContain('mp-truss-fig__key--stretched');
    expect(schematic(defaultTruss(), { stretch: true })).not.toContain('angles are not true');
  });

  it('puts the switch in the form only for a truss past the proportion, with its number, and the reading sentence nowhere before it is on', () => {
    const flat = calculator('en', FLAT);
    expect(text(flat)).toContain(`Draw taller (heights ×${stretchOffer(drawingOf(FLAT))!.n})`);
    expect(text(calculator('es', FLAT))).toContain(`Dibujar más alto (alturas ×${stretchOffer(drawingOf(FLAT))!.n})`);
    expect(text(calculator('en', tall()))).toContain(`Draw wider (widths ×${stretchOffer(drawingOf(tall()))!.n})`);
    expect(text(calculator('es', tall()))).toContain(`Dibujar más ancho (anchos ×${stretchOffer(drawingOf(tall()))!.n})`);
    expect(text(calculator('en', defaultTruss()))).not.toContain('Draw taller');
    expect(text(calculator('en', defaultTruss()))).not.toContain('Draw wider');
    // Off by default: the page does not say its angles are untrue.
    expect(flat).not.toContain('angles are not true');
    expect(flat).toMatch(/<input type="checkbox"[^>]*\/><span>Draw taller/);
    expect(flat).not.toMatch(/<input type="checkbox" checked=""[^>]*\/><span>Draw taller/);
  });

  it('keeps the new sentences out of the other calculators’ words: the legend and the notes exist in both languages', () => {
    for (const lang of ['en', 'es'] as const) {
      const w = trussUi[lang].results;
      for (const s of [w.options.taller, w.options.wider, w.legend.stretchedHeights, w.legend.stretchedWidths, w.drawingNotes.stretchedHeights, w.drawingNotes.stretchedWidths, w.reading.stretchedHeights, w.reading.stretchedWidths]) expect(s).toContain('{n}');
      expect(w.options.every).not.toBe('');
    }
  });
});

/* ═══ 2. Smaller numbers before leaving any off; show every force ══════════ */

const SMALLEST = SIZES[SIZES.length - 1];
/** The matrix: the example, every template in both unit systems, 18 panels, 40 nodes and 120 members, flat, tall, 1e9 and rollers. */
const MATRIX: [string, TrussForm][] = [['example', defaultTruss()]];
for (const units of ['us', 'si'] as const) for (const id of TEMPLATE_IDS) MATRIX.push([`${id} ${units}`, asTemplate(id, units)]);
MATRIX.push(
  ['pratt 18 panels', pratt({ span: 144, height: 12, panels: 18, load: 5 })],
  ['40 nodes, 96 members', braced()],
  ['40 nodes, 120 members', braced(true)],
  ['flat', FLATTER],
  ['tall', tall()],
  ['load 1e9', heavy()],
  ['roller 30', roller(30)],
  ['roller 45', roller(45)],
  ['roller 0', roller(0)],
);

describe('the numbers are set at one size, the largest at which every one fits', { timeout: 120000 }, () => {
  it('keeps 11 px for a truss whose numbers all fit at 11, and changes nothing about it', () => {
    const layout = layoutOf(defaultTruss());
    expect(layout.fontSize).toBe(11);
    expect(layout.thinned).toBe(0);
    expect(layout).toEqual(layoutOf(defaultTruss(), { fontSize: 11 }));
    expect(schematic(defaultTruss())).not.toMatch(/class="mp-truss-fig__value"[^>]*style=/);
  });

  for (const [name, form] of MATRIX) {
    it(`${name}: at 320, 390, 720, 1200 and on paper, every word is clear, the size is the largest feasible, and only the impossible is left off`, () => {
      for (const [column, paper] of [[320, false], [390, false], [720, false], [1200, false], [724, true]] as const) {
        for (const numbers of [false, true]) {
          const width = drawnWidth(form, column, paper, { numbers });
          const what = `${name} ${paper ? 'paper' : column}${numbers ? ' numbers' : ''}`;
          const layout = layoutOf(form, { width, numbers });
          expect(crowding(layout, what), what).toEqual([]);
          expect(SIZES as readonly number[], what).toContain(layout.fontSize);
          // One size for the whole drawing: every number's box has the height of that size.
          for (const m of layout.members) {
            const box = m.text ?? m.spare;
            if (box) expect(box.rect.y1 - box.rect.y0, what).toBeCloseTo(13 * (layout.fontSize / 11), 3);
          }
          expect(layout.members.filter((m) => m.text === null && (m.spare !== null)).length, what).toBe(layout.thinned);
          // Forced at each size the layout could have chosen: none larger fits better than the chosen, and an omission means even the least size cannot place all.
          const at = (size: number) => layoutOf(form, { width, numbers, fontSize: size }).thinned;
          for (const size of SIZES) {
            if (size > layout.fontSize) expect(at(size), `${what} at ${size}`).toBeGreaterThan(layout.thinned);
            expect(at(size), `${what} at ${size}`).toBeGreaterThanOrEqual(layout.thinned);
          }
          if (layout.thinned > 0) expect(at(SMALLEST), what).toBeGreaterThanOrEqual(layout.thinned);
        }
      }
    });
  }

  it('cuts the numbers left off a dense truss on a phone, and on paper', () => {
    const dense = braced(true);
    for (const [column, paper] of [[390, false], [724, true]] as const) {
      const width = drawnWidth(dense, column, paper);
      const before = layoutOf(dense, { width, fontSize: 11 }).thinned;
      const after = layoutOf(dense, { width });
      expect(after.thinned, `${paper ? 'paper' : column}`).toBeLessThan(before);
      expect(after.fontSize).toBeLessThan(11);
    }
  });

  it('writes the smaller size on the numbers (and only on them), and keeps the loads and reactions at 11', () => {
    const dense = braced(true);
    const width = drawnWidth(dense, 724, true);
    const layout = layoutOf(dense, { width });
    expect(layout.fontSize).toBeLessThan(11);
    const html = schematic(dense, { width: 724, widen: false, paper: true });
    expect(html).toContain(`style="font-size:${layout.fontSize}px"`);
    const loads = html.match(/<g class="mp-truss-fig__load">[\s\S]*?<\/g>/)![0];
    expect(loads).not.toContain('font-size');
  });

  it('keeps the largest forces when something must be left off (on paper nearly all of a 120-member truss must be)', () => {
    const dense = braced(true);
    const drawing = drawingOf(dense);
    const layout = layoutOf(dense, { width: drawnWidth(dense, 390, false) });
    expect(layout.thinned).toBeGreaterThan(0);
    expect(layout.thinned).toBeLessThan(120);
    expect(layoutOf(dense, { width: 724 }).thinned).toBeGreaterThan(100);
    const order = drawing.members.map((m) => ({ label: m.label, size: Math.abs(m.force ?? 0) })).sort((p, q) => q.size - p.size);
    const shown = (label: number) => layout.members.find((m) => m.label === label)!.text !== null;
    expect(order.slice(0, 20).filter((f) => shown(f.label)).length).toBeGreaterThanOrEqual(order.slice(-20).filter((f) => shown(f.label)).length);
    expect(order.slice(0, 10).filter((f) => shown(f.label)).length).toBeGreaterThanOrEqual(7);
  });

  it('breaks a tie between equal forces the way it always did: by length, then by member number', () => {
    // Two equal forces at the same weight: the longer, then the lower number, is placed first, so with room for one it is the one that stays.
    const layout = layoutOf(defaultTruss(), { width: 720 });
    const again = layoutOf(defaultTruss(), { width: 720 });
    expect(layout.members.map((m) => m.text?.value)).toEqual(again.members.map((m) => m.text?.value));
  });
});

describe('“Show every force” widens the drawing until every number fits', { timeout: 120000 }, () => {
  const dense = braced(true);
  const drawing = drawingOf(dense);
  const looks = { forces: true, numbers: false, deformed: false, group: ',' };

  it('is the column’s own width when nothing is left off', () => {
    const d = drawingOf(defaultTruss());
    expect(everyWidth(d, looks, 720)).toEqual({ width: 720, complete: false });
  });

  it('draws a 40-node, 120-member truss on a phone wide enough for all 120 numbers, at no less than 8 px', () => {
    for (const column of [320, 390, 720]) {
      const base = wantedWidth(drawing, looks, column);
      expect(layoutOf(dense, { width: base }).thinned, `${column}`).toBeGreaterThan(0);
      const found = everyWidth(drawing, looks, base);
      expect(found.complete).toBe(true);
      const wide = found.width;
      expect(wide, `${column}`).toBeGreaterThan(base);
      expect(wide).toBeLessThanOrEqual(6000);
      const layout = layoutOf(dense, { width: wide });
      expect(layout.thinned, `${column}`).toBe(0);
      expect(layout.fontSize).toBeGreaterThanOrEqual(SMALLEST);
      expect(layout.members.every((m) => m.text !== null)).toBe(true);
      expect(crowding(layout, `every ${column}`)).toEqual([]);
    }
  });

  it('is the least width it finds: a little narrower and the smallest size no longer places them all', () => {
    const base = wantedWidth(drawing, looks, 390);
    const wide = everyWidth(drawing, looks, base).width;
    const narrower = layoutOf(dense, { width: Math.round(wide * 0.8), fontSize: SMALLEST });
    expect(narrower.thinned).toBeGreaterThan(0);
  });

  it('is offered by the page only when some numbers are left off, and the drawing says it was widened', () => {
    const facts = drawingFacts(drawing, looks, 390, true);
    expect(facts.omitted).toBeGreaterThan(0);
    expect(facts.every).toBe(true);
    expect(drawingFacts(drawingOf(defaultTruss()), looks, 720, true).omitted).toBe(0);
    expect(drawingFacts(drawingOf(FLAT), looks, 720, true).offer).not.toBeNull();
    expect(text(calculator('en', dense))).toContain('Show every force');
    expect(text(calculator('es', dense))).toContain('Mostrar todas las fuerzas');
    expect(text(calculator('en', defaultTruss()))).not.toContain('Show every force');
    expect(text(calculator('es', defaultTruss()))).not.toContain('Mostrar todas las fuerzas');
    // Off by default: the column's own drawing, with the usual note.
    const plain = schematic(dense, { width: 390 });
    expect(plain).toContain('Scroll sideways to see all of it.');
    expect(plain).not.toContain('widened until every force');
    const all = schematic(dense, { width: 390, every: true });
    expect(text(all)).toContain('This drawing is widened until every force is written on it');
    expect(all).not.toMatch(/\d+ labels? (is|are) left off/);
    expect(text(schematic(dense, { width: 390, every: true }, 'es'))).toContain('Este dibujo se ensancha hasta que cada fuerza queda escrita en él');
    // It is wider than without.
    const w = (html: string) => Number(html.match(/<svg class="mp-plot__svg[^>]*? width="(\d+)"/)?.[1]);
    expect(w(all)).toBeGreaterThan(w(plain));
  });

  it('is not offered for a tall truss: its size follows its height, so a wider drawing is only more empty page', () => {
    const d = drawingOf(tall());
    const facts = drawingFacts(d, looks, 390, true);
    expect(facts.omitted).toBeGreaterThan(0);
    expect(facts.every).toBe(false);
    expect(everyWidth(d, looks, 390).width).toBe(390);
    expect(layoutOf(tall(), { width: 390 }).widthBound).toBe(false);
    expect(text(calculator('en', tall()))).not.toContain('Show every force');
    expect(layoutOf(braced(true), { width: 700 }).widthBound).toBe(true);
  });

  it('is not offered on paper, which cannot scroll', () => {
    expect(drawingFacts(drawing, looks, 724, false).every).toBe(false);
  });

  it('does nothing on paper, which cannot scroll: the sheet keeps its width and says how many numbers are left to the table', () => {
    const paper = schematic(dense, { width: 724, widen: false, paper: true, every: true });
    expect(paper).toContain('width="724"');
    expect(text(paper)).toMatch(/\d+ labels are left off the drawing to keep it readable\. All of them are in the table below\./);
    expect(text(paper)).not.toContain('Pick a member');
    const es = schematic(dense, { width: 724, widen: false, paper: true }, 'es');
    expect(text(es)).toMatch(/\d+ etiquetas quedan fuera del dibujo para que se lea bien\. Todas están en la tabla de abajo\./);
    // On a screen the note still tells the reader to pick a member.
    expect(text(schematic(dense, { width: 724, widen: false }))).toContain('Pick a member');
  });

  it('is kept from one draw to the next: the same layout object for the same choices', () => {
    const a = schematic(dense, { width: 390, every: true });
    const b = schematic(dense, { width: 390, every: true });
    expect(a).toBe(b);
    expect(forceText(1, ',')).toBe('+1');
  });
});
