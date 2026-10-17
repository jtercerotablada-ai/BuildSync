import { readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { createElement as h } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { analyseSafely } from '@/lib/calc/cable/analysis';
import { defaultCase, exampleOf, type CableForm } from '@/lib/calc/cable/model';
import { cableUi } from '@/lib/calc/cable/strings';
import { DrumSchematic, drumLayout, type DrumLayout } from './DrumSchematic';
import { PullCurve, clipRun, curveLayout, niceScale } from './PullCurve';
import { PullSchematic, bodyLayout, type BodyLayout } from './PullSchematic';
import { SlingSchematic, slingLayout, type SlingLayout } from './SlingSchematic';
import { arcPath, fitLabel, hitsAny, labelSpan, polar, tagBox, type Label } from './figure';
import { fill } from './text';
import { formatNumber } from '@/lib/calc/format';

/**
 * THE CABLE'S FOUR DRAWINGS - what is reckoned (`slingLayout`, `bodyLayout`,
 * `curveLayout`, `drumLayout`: where every line, arrow, arc, tick and label goes,
 * held here without React) and what is written of it (the components, as the
 * server sends them).
 *
 * What only a browser can show - how the arrows and labels look next to each
 * other at 390 px, the chart's hover-free reading, the printed sheet in black
 * and white - is listed in the report that goes with this file.
 */

const SRC = resolve(__dirname, '..', '..', '..', '..');
const read = (file: string) => readFileSync(join(SRC, file), 'utf8').replace(/\r\n/g, '\n');
const attr = (tag: string, name: string) => tag.match(new RegExp(` ${name}="([^"]*)"`))?.[1];
const deg = (rad: number) => (rad * 180) / Math.PI;
/** The direction of a vector on the page as the angle a reader sees: counter-clockwise from the right, y up. */
const seen = (dx: number, dy: number) => deg(Math.atan2(-dy, dx));

const slingOf = (form: CableForm) => analyseSafely(form).drawing.sling;
const sling = (form: CableForm, width = 720, moved = true) => slingLayout(slingOf(form), { width, moved, group: ',', unit: form.forceUnit === 'large' ? 'kip' : 'lbf', scaleText: cableUi.en.results.moveTag });
const pullOf = (form: CableForm) => analyseSafely(form).pull;
const body = (form: CableForm, id: 'start' | 'run' | 'accel' = 'run', width = 720) => {
  const p = pullOf(form);
  return bodyLayout(p, p?.regimes.find((r) => r.id === id) ?? null, { width, group: ',', unit: 'lbf' });
};
/** The words on the drum, as the calculator makes them from the case. */
const wordsOf = (form: CableForm) => {
  const d = analyseSafely(form).drum;
  const f = cableUi.en.results.drumFig;
  const num = (v: number, sig = 4) => formatNumber(v, sig, ',');
  return {
    load: f.load,
    hold: f.hold,
    symbols: cableUi.en.drum.symbols,
    wrap: d ? fill(f.wrap, { wrap: `${num(d.betaDeg)}°` }) : '',
    turns: d && d.turns >= 1 ? fill(f.turnsLine, { n: num(d.turns) }) : '',
    coil: d && d.turns > 1 ? fill(f.coil, { n: num(d.turns) }) : '',
    taper: d ? fill(f.taper, { ratio: num(d.ratio, 3), mu: num(d.mu, 3) }) : '',
  };
};
const drum = (form: CableForm, width = 720) => drumLayout(analyseSafely(form).drawing.drum, { width, group: ',', unit: 'lbf', words: wordsOf(form) });
const curves = (form: CableForm, width = 720, phi = form.pull.phi) => {
  const p = pullOf(form);
  return curveLayout(p?.curves ?? [], p?.regimes ?? [], { width, group: ',', axisX: 'φ (°)', axisY: 'T (lbf)', phi, lift: (v) => `lift-off ${v}°` });
};

const withLoad = (patch: Partial<CableForm['load']>): CableForm => {
  const f = defaultCase();
  return { ...f, load: { ...f.load, ...patch } };
};
const withPull = (patch: Partial<CableForm['pull']>): CableForm => {
  const f = exampleOf('pull');
  return { ...f, pull: { ...f.pull, ...patch } };
};
const withDrum = (patch: Partial<CableForm['drum']>): CableForm => {
  const f = exampleOf('drum');
  return { ...f, drum: { ...f.drum, ...patch } };
};

/** Every label of a layout is inside the drawing, both ways. */
function expectInside(labels: Label[], width: number, height: number, what: string) {
  for (const l of labels) {
    const [x0, x1] = labelSpan(l);
    expect(x0, `${what}: "${l.text}" starts inside`).toBeGreaterThanOrEqual(-0.5);
    expect(x1, `${what}: "${l.text}" ends inside`).toBeLessThanOrEqual(width + 0.5);
    expect(l.y, `${what}: "${l.text}" is on the page`).toBeGreaterThan(0);
    expect(l.y, `${what}: "${l.text}" is on the page`).toBeLessThanOrEqual(height);
  }
}
const labelsOfSling = (l: SlingLayout): Label[] => [...l.legs.flatMap((x) => [x.tension, ...(x.arc ? [x.arc.label] : [])]), ...l.arrows.map((a) => a.label), ...(l.moved ? [l.moved.label] : [])];
const labelsOfBody = (l: BodyLayout): Label[] => [...l.arrows.map((a) => a.label), ...(l.phiArc ? [l.phiArc.label] : []), ...(l.thetaArc ? [l.thetaArc.label] : [])];

describe('the little geometry the drawings share', () => {
  it('finds a point on a circle by the angle a reader sees, counter-clockwise, y up the page', () => {
    expect(polar({ x: 100, y: 100 }, 10, 0)).toEqual({ x: 110, y: 100 });
    expect(polar({ x: 100, y: 100 }, 10, 90)).toEqual({ x: 100, y: 90 });
    expect(polar({ x: 100, y: 100 }, 10, 180)).toEqual({ x: 90, y: 100 });
    expect(polar({ x: 100, y: 100 }, 10, 270)).toEqual({ x: 100, y: 110 });
  });
  it('writes an arc the shorter way, and the long way past a half turn', () => {
    expect(arcPath({ x: 0, y: 0 }, 10, 0, 90)).toBe('M 10 0 A 10 10 0 0 0 0 -10');
    expect(arcPath({ x: 0, y: 0 }, 10, 180, 120)).toBe('M -10 0 A 10 10 0 0 1 -5 -8.660254');
    expect(arcPath({ x: 0, y: 0 }, 10, 0, 270)).toMatch(/ 0 1 0 /);
  });
  it('keeps a label inside the drawing, moving it sideways, and starts one that is too wide at the edge', () => {
    const l: Label = { text: 'W = 2,000 lbf', x: 5, y: 20, anchor: 'middle' };
    const [x0] = labelSpan(fitLabel(l, 300));
    expect(x0).toBeGreaterThanOrEqual(4);
    const r = fitLabel({ ...l, x: 298, anchor: 'start' }, 300);
    expect(labelSpan(r)[1]).toBeLessThanOrEqual(296);
    expect(fitLabel({ ...l, x: 100 }, 300)).toEqual({ ...l, x: 100 });
    expect(fitLabel(l, 40)).toMatchObject({ anchor: 'start', x: 4 });
  });
});

describe('the sling', () => {
  const layout = sling(defaultCase());

  it('is as wide as it was asked to be and no taller than allowed', () => {
    expect(layout.width).toBe(720);
    expect(layout.height).toBeGreaterThanOrEqual(190);
    expect(layout.height).toBeLessThanOrEqual(440);
  });

  it('draws two legs from the load point up to their anchors, symmetric about it, at 60° from the horizontal', () => {
    expect(layout.legs).toHaveLength(2);
    const [a, b] = layout.legs;
    for (const l of layout.legs) {
      expect([l.x1, l.y1]).toEqual([layout.node.x, layout.node.y]);
      expect(l.y2).toBeLessThan(l.y1);
      expect(seen(Math.abs(l.x2 - l.x1), l.y2 - l.y1)).toBeCloseTo(60, 3);
    }
    expect(a.x2).toBeLessThan(layout.node.x);
    expect(b.x2).toBeGreaterThan(layout.node.x);
    expect(a.x2 + b.x2).toBeCloseTo(2 * layout.node.x, 3);
    expect(a.y2).toBeCloseTo(b.y2, 6);
    // 10 ft legs: 10 · cos 60° = 5 ft either side, 10 · sin 60° up.
    expect((b.x2 - a.x2) / layout.scale).toBeCloseTo(10, 3);
    expect((layout.node.y - a.y2) / layout.scale).toBeCloseTo(10 * Math.sin(Math.PI / 3), 3);
  });

  it('draws the lengths and the angles of unequal legs as they are', () => {
    const l = sling(withLoad({ leg1: { angle: 30, side: 'left', length: 8 }, leg2: { angle: 70, side: 'right', length: 12 } }));
    const [a, b] = l.legs;
    expect(Math.hypot(a.x2 - a.x1, a.y2 - a.y1) / l.scale).toBeCloseTo(8, 3);
    expect(Math.hypot(b.x2 - b.x1, b.y2 - b.y1) / l.scale).toBeCloseTo(12, 3);
    expect(seen(a.x1 - a.x2, a.y2 - a.y1)).toBeCloseTo(30, 3);
    expect(seen(b.x2 - b.x1, b.y2 - b.y1)).toBeCloseTo(70, 3);
    // Two legs on one side: both anchors to the right.
    const same = sling(withLoad({ leg1: { angle: 30, side: 'right', length: 8 }, leg2: { angle: 70, side: 'right', length: 12 } }));
    expect(same.legs.every((x) => x.x2 > same.node.x)).toBe(true);
  });

  it('writes the tension along each leg, on the side away from the other leg, and the angle with an arc', () => {
    const [a, b] = layout.legs;
    expect(a.tension.text).toBe('T1 = 1,155 lbf');
    expect(b.tension.text).toBe('T2 = 1,155 lbf');
    expect(a.tension.x).toBeLessThan(layout.node.x);
    expect(b.tension.x).toBeGreaterThan(layout.node.x);
    for (const l of layout.legs) {
      expect(l.arc?.label.text).toBe('60°');
      expect(l.arc?.d).toMatch(/^M [\d.-]+ [\d.-]+ A /);
      // The arc is about the load point and its dotted base runs along the horizontal on the leg's own side.
      expect(l.arc?.ref.y2).toBe(layout.node.y);
      expect(Math.sign((l.arc?.ref.x2 ?? 0) - layout.node.x)).toBe(l.side === 'left' ? -1 : 1);
    }
  });

  it('puts the weight under the load point as an arrow pointing down, with its size', () => {
    expect(layout.arrows.map((x) => x.id)).toEqual(['W']);
    const w = layout.arrows[0];
    expect(w.tail.x).toBe(layout.node.x);
    expect(w.tail.y).toBeGreaterThan(layout.node.y);
    expect(w.tip.y).toBeGreaterThan(w.tail.y);
    expect(w.tip.x).toBe(layout.node.x);
    expect(w.dir).toEqual({ x: 0, y: 1 });
    expect(w.label.text).toBe('W = 2,000 lbf');
    expect(w.magnitude).toBe(2000);
  });

  it('puts a horizontal force on the side it pushes, and the weight below as ever', () => {
    const right = sling(withLoad({ H: 400 }));
    const h = right.arrows.find((x) => x.id === 'H')!;
    expect(h.dir).toEqual({ x: 1, y: 0 });
    expect(h.tip.x).toBeGreaterThan(right.node.x);
    expect(h.tip.y).toBe(right.node.y);
    expect(h.label.text).toBe('H = 400 lbf');
    const left = sling(withLoad({ H: -400 }));
    expect(left.arrows.find((x) => x.id === 'H')!.dir).toEqual({ x: -1, y: 0 });
    expect(left.arrows.find((x) => x.id === 'H')!.label.text).toBe('H = 400 lbf');
    // The longer the force, the longer its arrow (the weight is the longest).
    const w = right.arrows.find((x) => x.id === 'W')!;
    expect(Math.hypot(h.tip.x - h.tail.x, h.tip.y - h.tail.y)).toBeLessThan(Math.hypot(w.tip.x - w.tail.x, w.tip.y - w.tail.y));
  });

  it('draws a single cable along the resultant of W and H, with the angle it came out at', () => {
    const l = sling(withLoad({ legs: 1, H: 1500 }));
    expect(l.legs).toHaveLength(1);
    expect(l.legs[0].tension.text).toBe('T = 2,500 lbf');
    expect(seen(l.legs[0].x1 - l.legs[0].x2, l.legs[0].y2 - l.legs[0].y1)).toBeCloseTo(deg(Math.atan2(2000, 1500)), 3);
    expect(l.legs[0].arc?.label.text).toBe('53.1°');
    // A vertical cable has no arc to its horizontal worth drawing wider than a quarter turn, and is drawn straight up.
    const vertical = sling(withLoad({ legs: 1, H: 0 }));
    expect(vertical.legs[0].x2).toBeCloseTo(vertical.node.x, 6);
    expect(vertical.legs[0].angle).toBe(90);
  });

  it('draws no arc for a leg that lies flat, and the arc of the other', () => {
    const flat = sling(withLoad({ leg1: { angle: 0, side: 'left', length: 10 }, leg2: { angle: 60, side: 'right', length: 10 }, W: 1000, H: 0 }));
    expect(flat.legs).toHaveLength(2);
    expect(flat.legs[0].arc).toBeNull();
    expect(flat.legs[1].arc?.label.text).toBe('60°');
    expect(flat.height).toBeGreaterThanOrEqual(190);
    expect(flat.legs[0].y2).toBeCloseTo(flat.legs[0].y1, 6);
  });

  it('puts an anchor at the end of each leg: a plate across it and hatching beyond it, away from the load', () => {
    for (const l of layout.legs) {
      const u = { x: (l.x2 - l.x1) / Math.hypot(l.x2 - l.x1, l.y2 - l.y1), y: (l.y2 - l.y1) / Math.hypot(l.x2 - l.x1, l.y2 - l.y1) };
      const [p, q] = l.anchor.plate;
      expect((q.x - p.x) * u.x + (q.y - p.y) * u.y).toBeCloseTo(0, 6);
      expect((p.x + q.x) / 2).toBeCloseTo(l.x2, 6);
      expect(l.anchor.ticks).toHaveLength(4);
      for (const [from, to] of l.anchor.ticks) expect((to.x - from.x) * u.x + (to.y - from.y) * u.y).toBeGreaterThan(0);
    }
  });

  it('draws the position after the stretch with the move EXAGGERATED by a factor that is stated, and means what it says', () => {
    const a = analyseSafely(defaultCase());
    const d = a.drawing.sling!;
    const m = layout.moved!;
    expect(m).not.toBeNull();
    expect(m.factor).toBe(d.moveScale);
    expect(m.label.text).toBe(`drawn ${Math.round(d.moveScale!)} times larger`);
    // The factor is applied to the real move: 0.1124 in down, drawn as factor × 0.1124 in = about an eighth of the sling’s larger side (10 ft).
    expect(m.point.x).toBeCloseTo(layout.node.x, 6);
    const drawn = (m.point.y - layout.node.y) / layout.scale;
    expect(drawn).toBeCloseTo(m.factor * (0.11240 / 12), 2);
    expect(drawn).toBeCloseTo(10 / 8, 2);
    expect(m.links).toHaveLength(2);
    layout.legs.forEach((l, i) => {
      expect([m.links[i].x1, m.links[i].y1]).toEqual([l.x2, l.y2]);
      expect([m.links[i].x2, m.links[i].y2]).toEqual([m.point.x, m.point.y]);
    });
    expect(layout.legend).toContain('moved');
    // …and nothing of it when it is not asked for.
    const off = sling(defaultCase(), 720, false);
    expect(off.moved).toBeNull();
    expect(off.legend).not.toContain('moved');
  });

  it('moves sideways too when the load is pushed sideways', () => {
    const l = sling(withLoad({ H: 600 }));
    expect(l.moved).not.toBeNull();
    expect(l.moved!.point.x).not.toBeCloseTo(l.node.x, 3);
  });

  it('keeps every label inside the drawing, at the width of a phone and of a sheet, whatever the case', () => {
    const forms = [defaultCase(), withLoad({ H: 1500 }), withLoad({ H: -1500 }), withLoad({ legs: 1, H: 1500 }), withLoad({ legs: 1, H: -3e5, W: 1 }), withLoad({ W: 1e8 }), withLoad({ leg1: { angle: 5, side: 'left', length: 100 }, leg2: { angle: 85, side: 'right', length: 3 } })];
    for (const form of forms) {
      for (const width of [280, 320, 390, 720, 1100]) {
        const l = sling(form, width);
        expect(l.width).toBe(width);
        expect(l.height).toBeLessThanOrEqual(440);
        expectInside(labelsOfSling(l), width, l.height, `${width}px`);
        for (const leg of l.legs) for (const v of [leg.x1, leg.y1, leg.x2, leg.y2]) expect(Number.isFinite(v)).toBe(true);
      }
    }
  });

  it('leaves the drawing empty, and the page says so, when the case cannot be solved', () => {
    const bad = slingLayout(null, { width: 390, moved: true, group: ',', unit: 'lbf', scaleText: '' });
    expect(bad).toMatchObject({ width: 390, height: 120, legs: [], arrows: [], moved: null, legend: [] });
  });

  it('writes the SVG with an accessible name, the legs in groups and a legend of what is drawn', () => {
    const html = renderToStaticMarkup(h(SlingSchematic, { drawing: slingOf(defaultCase()), width: 720, moved: true, scaleText: 'drawn {scale} times larger', group: ',', unit: 'lbf', summary: 'A sling.', legend: cableUi.en.results.legend }));
    const svg = html.match(/<svg[^>]*>/)![0];
    expect(attr(svg, 'role')).toBe('img');
    expect(attr(svg, 'aria-label')).toBe('A sling.');
    expect(attr(svg, 'viewBox')).toBe(`0 0 720 ${layout.height}`);
    expect(html).toContain('<g aria-hidden="true">');
    expect(html.match(/ data-leg="\d"/g)).toHaveLength(2);
    expect(html).toContain('data-arrow="W"');
    expect(html.match(/<li class="mp-cable-fig__key">/g)).toHaveLength(5);
    expect(html).toContain('Position after the stretch (exaggerated)');
    expect(html).toContain('T1 = 1,155 lbf');
    expect(html).not.toMatch(/NaN|undefined|Infinity/);
  });
});

describe('the free body', () => {
  const layout = body(exampleOf('pull'));
  const arrow = (l: BodyLayout, id: string) => l.arrows.find((a) => a.id === id)!;

  it('draws the block and the four forces from its centre, each with its name and its size', () => {
    expect(layout.arrows.map((a) => a.id).sort()).toEqual(['F', 'N', 'T', 'W']);
    for (const a of layout.arrows) expect([a.tail.x, a.tail.y]).toEqual([layout.centre.x, layout.centre.y]);
    expect(arrow(layout, 'T').label.text).toBe('T = 37.52 lbf');
    expect(arrow(layout, 'W').label.text).toBe('W = 100 lbf');
    expect(arrow(layout, 'N').label.text).toBe('N = 81.24 lbf');
    expect(arrow(layout, 'F').label.text).toBe('F = 32.5 lbf');
  });

  it('points the cable at φ above the surface, the weight straight down, the normal force out of the surface and the friction against the travel', () => {
    const t = arrow(layout, 'T');
    expect(seen(t.tip.x - t.tail.x, t.tip.y - t.tail.y)).toBeCloseTo(30, 3);
    expect(arrow(layout, 'W').dir).toEqual({ x: 0, y: 1 });
    expect(arrow(layout, 'N').dir).toEqual({ x: 0, y: -1 });
    // Level ground, the block moves with the pull (to the right): friction points left.
    expect(arrow(layout, 'F').dir).toEqual({ x: -1, y: 0 });
  });

  it('makes each arrow as long as its force is large next to the largest, never under a third of the longest', () => {
    const len = (id: string) => Math.hypot(arrow(layout, id).tip.x - arrow(layout, id).tail.x, arrow(layout, id).tip.y - arrow(layout, id).tail.y);
    expect(len('W')).toBeGreaterThan(len('N'));
    expect(len('N')).toBeGreaterThan(len('T'));
    expect(len('T')).toBeGreaterThan(len('F'));
    for (const id of ['T', 'N', 'F']) expect(len(id)).toBeGreaterThanOrEqual(len('W') * 0.33 - 1e-6);
    // The weight, the largest, is the longest the drawing allows.
    expect(len('W')).toBeLessThanOrEqual(120 + 1e-6);
  });

  it('draws the surface at the slope, the block turned with it and standing on it', () => {
    for (const theta of [0, 20, 45, -25, 60]) {
      const l = body(withPull({ theta, phi: 10, muS: 0.6, muK: 0.6 }));
      const s = l.surface;
      expect(seen(s.x2 - s.x1, s.y2 - s.y1)).toBeCloseTo(theta, 3);
      const [p0, p1, p2] = l.block;
      expect(seen(p1.x - p0.x, p1.y - p0.y)).toBeCloseTo(theta, 3);
      // The block’s base lies on the surface line: its two lower corners are within a hair of it.
      const dist = (p: { x: number; y: number }) => Math.abs((s.y2 - s.y1) * (p.x - s.x1) - (s.x2 - s.x1) * (p.y - s.y1)) / Math.hypot(s.x2 - s.x1, s.y2 - s.y1);
      expect(dist(p0)).toBeLessThan(1e-4);
      expect(dist(p1)).toBeLessThan(1e-4);
      expect(dist(p2)).toBeGreaterThan(10);
      // The normal force is out of the surface: perpendicular to it and on the side the block is.
      const n = arrow(l, 'N');
      expect((n.dir.x * (s.x2 - s.x1) + n.dir.y * (s.y2 - s.y1)) / Math.hypot(s.x2 - s.x1, s.y2 - s.y1)).toBeCloseTo(0, 6);
      expect(dist({ x: l.centre.x, y: l.centre.y })).toBeGreaterThan(10);
      expect(l.surface.x1).toBeGreaterThanOrEqual(0);
      expect(l.surface.x2).toBeLessThanOrEqual(l.width);
      expect(l.surface.y1).toBeGreaterThanOrEqual(0);
      expect(l.surface.y2).toBeLessThanOrEqual(l.height);
      // The cable is at θ + φ to the horizontal.
      const t = arrow(l, 'T');
      expect(seen(t.tip.x - t.tail.x, t.tip.y - t.tail.y)).toBeCloseTo(theta + 10, 3);
    }
  });

  it('puts the hatching of the ground on the far side of the surface from the block', () => {
    const l = body(withPull({ theta: 30 }));
    expect(l.hatch.length).toBeGreaterThan(5);
    const n = arrow(l, 'N').dir;
    for (const [from, to] of l.hatch) expect((to.x - from.x) * n.x + (to.y - from.y) * n.y).toBeLessThan(0);
  });

  it('draws the cable angle as an arc from the surface to the cable, and the slope as an arc from the horizontal, with their values', () => {
    expect(layout.phiArc?.label.text).toBe('φ = 30°');
    expect(layout.thetaArc).toBeNull();
    const inclined = body(withPull({ theta: 20, phi: -15 }));
    expect(inclined.phiArc?.label.text).toBe('φ = −15°');
    expect(inclined.thetaArc?.label.text).toBe('θ = 20°');
    expect(inclined.legend).toContain('angle');
    expect(body(withPull({ phi: 0 })).phiArc).toBeNull();
    // The slope’s arc is about a point of the surface.
    const q = inclined.thetaArc!.at;
    const s = inclined.surface;
    expect(Math.abs((s.y2 - s.y1) * (q.x - s.x1) - (s.x2 - s.x1) * (q.y - s.y1)) / Math.hypot(s.x2 - s.x1, s.y2 - s.y1)).toBeLessThan(1e-3);
  });

  it('draws only the weight where the cable cannot pull the block', () => {
    const stays = body(withPull({ travel: 'against', phi: 0, theta: 0 }));
    expect(stays.arrows.map((a) => a.id)).toEqual(['W']);
    expect(stays.legend).toEqual(['weight', 'block', 'slope']);
    expect(stays.block).toHaveLength(4);
  });

  it('draws the acceleration case as its own free body', () => {
    const l = body(withPull({ accel: 4 }), 'accel');
    expect(arrow(l, 'T').magnitude).toBeGreaterThan(arrow(layout, 'T').magnitude);
  });

  it('keeps every label inside the drawing, at the width of a phone and of a sheet, whatever the slope', () => {
    for (const theta of [-30, -10, 0, 25, 60]) {
      for (const phi of [-60, 0, 30, 80]) {
        for (const width of [280, 390, 720]) {
          const l = body(withPull({ theta, phi, muS: 0.2, muK: 0.1 }), 'start', width);
          expect(l.width).toBe(width);
          expect(l.height).toBeGreaterThanOrEqual(230);
          expect(l.height).toBeLessThanOrEqual(330);
          expectInside(labelsOfBody(l), width, l.height, `θ ${theta} φ ${phi} ${width}px`);
        }
      }
    }
  });

  it('leaves the drawing empty when the case cannot be solved', () => {
    const l = bodyLayout(null, null, { width: 390, group: ',', unit: 'lbf' });
    expect(l).toMatchObject({ width: 390, block: [], arrows: [], phiArc: null, thetaArc: null, legend: [] });
  });

  it('writes the SVG with an accessible name and a legend', () => {
    const p = pullOf(exampleOf('pull'))!;
    const html = renderToStaticMarkup(h(PullSchematic, { pull: p, regime: p.regimes[1], width: 720, group: ',', unit: 'lbf', summary: 'A free body.', legend: cableUi.en.results.legend }));
    expect(attr(html.match(/<svg[^>]*>/)![0], 'aria-label')).toBe('A free body.');
    expect(attr(html.match(/<svg[^>]*>/)![0], 'role')).toBe('img');
    for (const id of ['T', 'W', 'N', 'F']) expect(html).toContain(`data-arrow="${id}"`);
    expect(html).toContain('<polygon class="mp-cable-fig__block"');
    expect(html.match(/<li class="mp-cable-fig__key">/g)).toHaveLength(7);
  });
});

describe('the chart T(φ)', () => {
  const form = exampleOf('pull');
  const layout = curves(form);
  const analysis = pullOf(form)!;

  it('rounds the top of the axis up to a round number with steps of 1, 2, 2.5 or 5 times a power of ten', () => {
    expect(niceScale(37.52)).toEqual({ top: 40, step: 10 });
    expect(niceScale(100)).toEqual({ top: 100, step: 20 });
    expect(niceScale(0.7)).toEqual({ top: 0.8, step: 0.2 });
    expect(niceScale(2300)).toEqual({ top: 2500, step: 500 });
    expect(niceScale(1)).toEqual({ top: 1, step: 0.2 });
    for (const max of [0.0123, 0.5, 3, 44.8, 99.9, 1234, 7.2e5]) {
      const { top, step } = niceScale(max);
      expect(top).toBeGreaterThanOrEqual(max);
      expect(top / step).toBeLessThanOrEqual(6.0001);
      expect(top - max).toBeLessThan(step);
      expect([1, 2, 2.5, 5, 10]).toContain(Number((step / 10 ** Math.floor(Math.log10(step))).toPrecision(6)));
    }
  });

  it('cuts a curve at the top of the chart where it leaves, and at the same place where it comes back', () => {
    const run = [{ phi: 0, T: 1 }, { phi: 10, T: 3 }, { phi: 20, T: 1 }];
    expect(clipRun(run, 2)).toEqual([
      [{ phi: 0, T: 1 }, { phi: 5, T: 2 }],
      [{ phi: 15, T: 2 }, { phi: 20, T: 1 }],
    ]);
    expect(clipRun(run, 5)).toEqual([run]);
    expect(clipRun(run, 0.5)).toEqual([]);
    expect(clipRun([{ phi: 0, T: 3 }, { phi: 10, T: 1 }], 2)).toEqual([[{ phi: 5, T: 2 }, { phi: 10, T: 1 }]]);
  });

  it('has real axes: a tick and a number every 30° along the angle, and round steps up the tension', () => {
    expect(layout.xTicks.map((t) => t.label)).toEqual(['−90', '−60', '−30', '0', '30', '60', '90']);
    const xs = layout.xTicks.map((t) => t.at);
    expect(xs[0]).toBe(layout.plot.x0);
    expect(xs[6]).toBe(layout.plot.x1);
    for (let i = 1; i < xs.length; i++) expect(xs[i] - xs[i - 1]).toBeCloseTo((layout.plot.x1 - layout.plot.x0) / 6, 3);
    // The start curve is the tallest to be drawn whole: 4 × its least tension of 44.72 lbf is 178.9, which rounds up to 200.
    expect(layout.yMax).toBe(200);
    expect(layout.yTicks.map((t) => t.label)).toEqual(['0', '50', '100', '150', '200']);
    expect(layout.yTicks[0].at).toBe(layout.plot.y1);
    expect(layout.yTicks[4].at).toBe(layout.plot.y0);
    expect(layout.titleX.text).toBe('φ (°)');
    expect(layout.titleY.text).toBe('T (lbf)');
  });

  it('draws one curve for each case, which stops where the cable cannot pull the block', () => {
    expect(layout.curves.map((c) => c.regime)).toEqual(['start', 'run']);
    for (const c of layout.curves) {
      const source = analysis.curves.find((x) => x.regime === c.regime)!;
      const valid = source.points.filter((p) => p.valid && p.T !== null);
      const X = (phi: number) => layout.plot.x0 + ((phi + 90) / 180) * (layout.plot.x1 - layout.plot.x0);
      const xs = c.runs.flat().map((p) => p.x);
      // Nothing is drawn where the cable cannot pull the block (before the first angle that does), and the curve ends at the last (90°).
      expect(valid[0].phi).toBeGreaterThan(-90);
      expect(Math.min(...xs)).toBeGreaterThanOrEqual(X(valid[0].phi) - 1e-6);
      expect(Math.max(...xs)).toBeCloseTo(X(valid[valid.length - 1].phi), 3);
      // Where it comes in from above the chart it is cut at the top border, at the right angle: T there is the top of the axis.
      const first = c.runs[0][0];
      expect(first.y).toBeCloseTo(layout.plot.y0, 6);
      const phiAtTop = ((first.x - layout.plot.x0) / (layout.plot.x1 - layout.plot.x0)) * 180 - 90;
      const near = source.points.filter((p) => p.valid && p.T !== null && Math.abs(p.phi - phiAtTop) <= 1);
      expect(Math.min(...near.map((p) => Math.abs(p.T! - layout.yMax!)))).toBeLessThan(layout.yMax! * 0.5);
      // Every point is inside the plot area.
      for (const p of c.runs.flat()) {
        expect(p.x).toBeGreaterThanOrEqual(layout.plot.x0 - 1e-6);
        expect(p.x).toBeLessThanOrEqual(layout.plot.x1 + 1e-6);
        expect(p.y).toBeGreaterThanOrEqual(layout.plot.y0 - 1e-6);
        expect(p.y).toBeLessThanOrEqual(layout.plot.y1 + 1e-6);
      }
      expect(c.d.startsWith('M ')).toBe(true);
    }
  });

  it('puts the tension on the curve at the height its value says', () => {
    const run = layout.curves[1];
    const source = analysis.curves[1];
    const p = source.points[90 + 30];
    const Y = (T: number) => layout.plot.y1 - (T / layout.yMax!) * (layout.plot.y1 - layout.plot.y0);
    const X = layout.plot.x0 + ((30 + 90) / 180) * (layout.plot.x1 - layout.plot.x0);
    const here = run.runs.flat().find((q) => Math.abs(q.x - X) < 1e-6)!;
    expect(here.y).toBeCloseTo(Y(p.T!), 3);
  });

  it('marks the least tension of each curve at the best angle atan μ: the lowest point of the curve', () => {
    const [start, run] = layout.curves;
    expect(start.minimum).toMatchObject({ phi: expect.closeTo(26.565, 2), T: expect.closeTo(44.72, 2) });
    expect(run.minimum).toMatchObject({ phi: expect.closeTo(21.801, 2), T: expect.closeTo(37.14, 2) });
    const X = (phi: number) => layout.plot.x0 + ((phi + 90) / 180) * (layout.plot.x1 - layout.plot.x0);
    expect(start.minimum!.x).toBeCloseTo(X(start.minimum!.phi), 3);
    // Lowest on the page is least tension: no point of the curve is lower than its mark.
    for (const c of layout.curves) for (const p of c.runs.flat()) expect(p.y).toBeLessThanOrEqual(c.minimum!.y + 1e-6);
    expect(layout.legend).toContain('minimum');
  });

  it('marks the cable angle chosen, and where it meets each curve', () => {
    const X30 = layout.plot.x0 + ((30 + 90) / 180) * (layout.plot.x1 - layout.plot.x0);
    expect(layout.chosen.x).toBeCloseTo(X30, 6);
    expect(layout.chosen.label.text).toBe('φ = 30°');
    layout.curves.forEach((c, i) => {
      expect(c.at?.x).toBeCloseTo(X30, 6);
      expect(c.at?.T).toBe(analysis.regimes[i].T);
    });
    // Another angle, another place.
    expect(curves(form, 720, -20).chosen.x).toBeLessThan(layout.chosen.x);
  });

  it('marks where the block would lift off', () => {
    expect(layout.lift).toMatchObject({ phi: 90, x: layout.plot.x1 });
    expect(layout.lift?.label.text).toBe('lift-off 90°');
    expect(layout.legend).toContain('lift');
    // On a slope the lift-off is earlier: 90° − θ.
    const steep = curves(withPull({ theta: 30, phi: 5 }));
    expect(steep.lift?.phi).toBeCloseTo(60, 6);
    expect(steep.lift!.x).toBeLessThan(steep.plot.x1);
  });

  it('draws a third curve when the block accelerates', () => {
    const l = curves(withPull({ accel: 4 }));
    expect(l.curves.map((c) => c.regime)).toEqual(['start', 'run', 'accel']);
    expect(l.legend.slice(0, 3)).toEqual(['start', 'run', 'accel']);
    const accel = l.curves[2];
    expect(accel.minimum).not.toBeNull();
    // More tension than to keep it going at the same angle.
    expect(accel.at!.y).toBeLessThan(l.curves[1].at!.y);
  });

  it('draws a curve that leaves the top of the chart through the top, not squeezed against it', () => {
    // A steep, rough case: tension climbs past 4× its least.
    const l = curves(withPull({ muS: 0.9, muK: 0.9, phi: 0 }));
    const c = l.curves[0];
    const tops = c.runs.flat().filter((p) => Math.abs(p.y - l.plot.y0) < 1e-6);
    expect(tops.length).toBeGreaterThan(0);
    // The ends of the run at the top are cut points; the points between are below it.
    expect(Math.min(...c.runs.flat().map((p) => p.y))).toBeCloseTo(l.plot.y0, 6);
  });

  it('draws the axes and no curve when no angle gives a pull', () => {
    const l = curves(withPull({ travel: 'against', theta: 0, muS: 0, muK: 0, phi: 0 }));
    expect(l.yMax).toBeNull();
    expect(l.curves.every((c) => c.d === '' && c.minimum === null && c.at === null)).toBe(true);
    expect(l.yTicks).toEqual([]);
    expect(l.xTicks).toHaveLength(7);
    const empty = curveLayout([], [], { width: 390, group: ',', axisX: 'x', axisY: 'y', phi: 0, lift: () => '' });
    expect(empty.curves).toEqual([]);
    expect(empty.height).toBeGreaterThanOrEqual(230);
  });

  it('keeps the axis titles and the labels inside the chart at the width of a phone', () => {
    for (const width of [280, 390, 720]) {
      for (const f of [form, withPull({ accel: 4 }), withPull({ theta: 30 }), withPull({ W: 5e6 })]) {
        const l = curves(f, width);
        expectInside([l.titleX, l.chosen.label, ...(l.lift ? [l.lift.label] : [])], width, l.height, `${width}px`);
        expect(l.plot.x0).toBeGreaterThan(30);
        expect(l.plot.x1).toBeLessThanOrEqual(width);
        expect(l.plot.y1).toBeLessThan(l.height);
        // The numbers on the vertical axis fit in the margin to their left.
        for (const t of l.yTicks) expect(t.label.length * 6.8 + 8).toBeLessThanOrEqual(l.plot.x0);
      }
    }
  });

  it('writes the SVG with an accessible name, axes with numbers, one path for each curve, a different mark on each and a legend', () => {
    const p = analysis;
    const legend = [{ key: 'start' as const, text: 'To start it moving' }, { key: 'run' as const, text: 'To keep it moving' }, { key: 'minimum' as const, text: 'Least tension' }];
    const html = renderToStaticMarkup(h(PullCurve, { curves: p.curves, regimes: p.regimes, width: 720, group: ',', axisX: 'Cable angle (°)', axisY: 'Tension (lbf)', phi: 30, lift: (v: number) => `lift-off ${v}°`, summary: 'A chart.', legend }));
    const svg = html.match(/<svg[^>]*>/)![0];
    expect(attr(svg, 'role')).toBe('img');
    expect(attr(svg, 'aria-label')).toBe('A chart.');
    expect(html).toContain('>−90<');
    expect(html).toContain('>90<');
    expect(html).toContain('>100<');
    expect(html).toContain('Cable angle (°)');
    expect(html).toContain('transform="rotate(-90');
    expect(html).toContain('data-regime="start"');
    expect(html).toContain('data-regime="run"');
    expect(html).toContain('<circle class="mp-cable-fig__mark"');
    expect(html).toContain('<rect class="mp-cable-fig__mark"');
    expect(html).toContain('clip-path="url(#mp-cable-clip-720)"');
    expect(html.match(/<li class="mp-cable-fig__key">/g)).toHaveLength(3);
    expect(html).not.toMatch(/NaN|undefined|Infinity/);
  });

  it('tells the three cases apart by pattern and by the shape of their mark, not by colour alone', () => {
    const css = read('components/ttc/calc/cable/cable.css');
    expect(css).toMatch(/\.mp-cable-fig__curve--run \{[^}]*stroke-dasharray: 8 4;/);
    expect(css).toMatch(/\.mp-cable-fig__curve--accel \{[^}]*stroke-dasharray: 2 4;/);
    const three = pullOf(withPull({ accel: 4 }))!;
    const html = renderToStaticMarkup(h(PullCurve, { curves: three.curves, regimes: three.regimes, width: 720, group: ',', axisX: 'x', axisY: 'y', phi: 30, lift: () => 'l', summary: 's', legend: [] }));
    expect(html).toContain('<circle class="mp-cable-fig__mark"');
    expect(html).toContain('<rect class="mp-cable-fig__mark"');
    expect(html).toMatch(/<polygon class="mp-cable-fig__mark"/);
  });
});

describe('the drum', () => {
  const layout = drum(exampleOf('drum'));
  const deg = (rad: number) => (rad * 180) / Math.PI;
  const at = (l: DrumLayout, id: 'load' | 'hold' | 'taper') => l.tags.find((t) => t.id === id)?.tag;
  const len = (a: { from: { x: number; y: number }; tip: { x: number; y: number } }) => Math.hypot(a.tip.x - a.from.x, a.tip.y - a.from.y);

  it('draws the drum as a circle with its centre marked, and the cable on it from the load end through the wrap', () => {
    expect(layout.drum.r).toBeGreaterThan(40);
    expect(layout.cable).not.toBeNull();
    expect(layout.legend).toEqual(['drum', 'centre', 'taper', 'dimension', 'loadEnd', 'holdEnd']);
    // The cable starts at the right of the drum, level with its centre, where the large tension hangs down.
    const first = layout.cable!.chunks[0].d.match(/^M ([\d.-]+) ([\d.-]+)/)!;
    expect(Number(first[1])).toBeGreaterThan(layout.drum.x + layout.drum.r);
    expect(Number(first[2])).toBeCloseTo(layout.drum.y, 3);
  });

  it('hangs the load end down from the right of the drum and names it in words, with its tension', () => {
    const load = layout.load!;
    expect(load.dir).toEqual({ x: 0, y: 1 });
    expect(load.from.x).toBeGreaterThan(layout.drum.x + layout.drum.r);
    expect(load.from.y).toBeCloseTo(layout.drum.y, 3);
    expect(load.tip.y).toBeGreaterThan(load.from.y);
    expect(at(layout, 'load')!.lines).toEqual(['Load end', 'T big = 1,000 lbf']);
    expect(at(layout, 'load')!.named).toBe(true);
  });

  it('leaves the holding end where the wrap ends, away from the drum along the tangent, and names it in words', () => {
    // Two turns end where they began, going up.
    expect(layout.hold!.dir.y).toBeCloseTo(-1, 6);
    expect(at(layout, 'hold')!.lines).toEqual(['Holding end', 'T small = 23.05 lbf']);
    // The direction of the analysis, (−sin β, cos β) with y up, is (−sin β, −cos β) on the page.
    for (const wrap of [90, 120, 180, 270]) {
      const l = drum(withDrum({ wrap, wrapUnit: 'deg', Tsmall: null }));
      const b = (wrap * Math.PI) / 180;
      expect(l.hold!.dir.x, `${wrap}°`).toBeCloseTo(-Math.sin(b), 4);
      expect(l.hold!.dir.y, `${wrap}°`).toBeCloseTo(-Math.cos(b), 4);
    }
  });

  it('makes the large end longer and heavier than the small one, by the logarithm of the tension, and no more than a thousandfold counts', () => {
    expect(len(layout.load!)).toBeGreaterThan(len(layout.hold!));
    expect(layout.load!.width).toBeGreaterThan(layout.hold!.width);
    const mild = drum(withDrum({ mu: 0.05, wrap: 1, Tsmall: null }));
    const rough = drum(withDrum({ mu: 0.3, wrap: 2, Tsmall: null }));
    const huge = drum(withDrum({ mu: 3, wrap: 5, Tsmall: null }));
    const lots = drum(withDrum({ mu: 0.3, wrap: 5, Tsmall: null }));
    // The rougher the drum, the smaller the holding end is drawn; a ratio of millions is drawn as a ratio of a thousand.
    expect(len(mild.hold!)).toBeGreaterThan(len(rough.hold!));
    expect(mild.hold!.width).toBeGreaterThan(rough.hold!.width);
    expect(len(huge.hold!)).toBeCloseTo(len(lots.hold!), 6);
    expect(huge.hold!.width).toBeCloseTo(lots.hold!.width, 6);
    // No friction gain: both ends drawn alike.
    const plain = drum(withDrum({ mu: 0, Tsmall: null }));
    expect(len(plain.hold!)).toBeCloseTo(len(plain.load!), 6);
    expect(plain.hold!.width).toBeCloseTo(plain.load!.width, 6);
  });

  it('tapers the cable on the drum from thick at the load end to thin at the holding end, as far as the friction does', () => {
    const w = layout.cable!.chunks.map((c) => c.w);
    for (let i = 1; i < w.length; i++) expect(w[i]).toBeLessThan(w[i - 1]);
    expect(w[0]).toBeCloseTo(layout.load!.width, 0);
    expect(w[w.length - 1]).toBeCloseTo(layout.hold!.width, 0);
    expect(w[0] - w[w.length - 1]).toBeGreaterThan(1);
    // Hardly any friction: hardly any taper.
    const tiny = drum(withDrum({ mu: 0.001, Tsmall: null })).cable!.chunks.map((c) => c.w);
    expect(tiny[0] - tiny[tiny.length - 1]).toBeLessThan(0.2);
  });

  it('draws more than one turn as a coil of loops told apart, at most six', () => {
    const loops = (wrap: number, unit: 'deg' | 'turns' = 'turns') => drum(withDrum({ wrap, wrapUnit: unit, Tsmall: null })).cable?.loops;
    expect(loops(0.5)).toBe(1);
    expect(loops(120, 'deg')).toBe(1);
    expect(loops(360, 'deg')).toBe(1);
    expect(loops(2)).toBe(2);
    expect(loops(2.5)).toBe(3);
    expect(loops(5)).toBe(5);
    expect(loops(30)).toBe(6);
    expect(drum(withDrum({ wrap: 0, Tsmall: null })).cable).toBeNull();
    // The loops are at least 4 px apart, so that they do not pile up on one circle.
    for (const turns of [2, 3, 5, 6]) {
      const l = drum(withDrum({ wrap: turns, Tsmall: null }), 390);
      const growth = l.cable!.outer - 1.06 * l.drum.r;
      expect(growth / (turns - 1), `${turns} turns`).toBeGreaterThanOrEqual(4);
    }
    const one = drum(withDrum({ wrap: 1, Tsmall: null }));
    expect(one.cable!.outer).toBeCloseTo(1.06 * one.drum.r, 3);
  });

  it('draws the wrap angle inside the drum, as an arc with a head between two radii, and writes it', () => {
    const part = drum(withDrum({ wrap: 120, wrapUnit: 'deg', Tsmall: null }));
    const c = part.drum;
    const tip = part.dim!.head[0];
    expect(deg(Math.atan2(-(tip.y - c.y), tip.x - c.x))).toBeCloseTo(120, 3);
    expect(Math.hypot(tip.x - c.x, tip.y - c.y)).toBeLessThan(c.r);
    expect(part.dim!.d.match(/ A /g)).toHaveLength(1);
    expect(part.dim!.radials).toHaveLength(2);
    expect(part.dim!.tag.lines).toEqual(['β = 120°']);
    // A whole turn or more is a whole circle, with its head where it began.
    const two = layout.dim!;
    expect(two.d.match(/ A /g)).toHaveLength(2);
    expect(two.radials).toHaveLength(1);
    expect(two.tag.lines).toEqual(['β = 720°', '2 turns']);
    expect(drum(withDrum({ wrap: 360, wrapUnit: 'deg', Tsmall: null })).dim!.tag.lines).toEqual(['β = 360°', '1 turn']);
    // The words are inside the arc, round the centre.
    expect(Math.abs(layout.dim!.tag.x - layout.drum.x)).toBeLessThan(2);
    expect(layout.dim!.r).toBeLessThan(layout.drum.r);
  });

  it('says on the picture that friction multiplies the tension, with the number, and names a coil', () => {
    expect(at(layout, 'taper')!.lines.join(' ')).toBe('wrapped 2 turns friction multiplies the tension by 43.4 (= e^μβ), μ = 0.3');
    expect(at(layout, 'taper')!.named).toBe(true);
    expect(at(drum(withDrum({ wrap: 120, wrapUnit: 'deg', Tsmall: null })), 'taper')!.lines.join(' ')).toBe('friction multiplies the tension by 1.87 (= e^μβ), μ = 0.3');
    expect(layout.leaders).toHaveLength(1);
  });

  const CASES: [string, CableForm][] = [
    ['the default', exampleOf('drum')],
    ['the large tension unknown', withDrum({ Tbig: null, Tsmall: 23.05 })],
    ['the wrap unknown', withDrum({ wrap: null, Tsmall: 23.05 })],
    ['a wrap under 180°', withDrum({ wrap: 120, wrapUnit: 'deg', Tsmall: null })],
    ['a wrap of 90°', withDrum({ wrap: 90, wrapUnit: 'deg', Tsmall: null })],
    ['exactly 360°', withDrum({ wrap: 360, wrapUnit: 'deg', Tsmall: null })],
    ['five turns', withDrum({ wrap: 5, Tsmall: null })],
    ['tiny μ', withDrum({ mu: 0.001, Tsmall: null })],
    ['huge μ, a ratio of millions', withDrum({ mu: 3, wrap: 5, Tsmall: null })],
    ['thirty turns', withDrum({ wrap: 30, mu: 0.1, Tsmall: null })],
  ];
  for (const [name, form] of CASES) {
    it(`keeps every label clear of every line and of every other label: ${name}`, () => {
      for (const width of [390, 720]) {
        const l = drum(form, width);
        expect(l.width).toBe(width);
        const boxes = [...l.tags.map((t) => ({ id: t.id as string, box: tagBox(t.tag) })), ...(l.dim ? [{ id: 'dim', box: tagBox(l.dim.tag) }] : [])];
        expect(boxes.length, name).toBeGreaterThanOrEqual(3);
        for (const { id, box } of boxes) {
          expect(box.x0, `${name} ${width}px ${id}`).toBeGreaterThanOrEqual(2.5);
          expect(box.x1, `${name} ${width}px ${id}`).toBeLessThanOrEqual(width - 2.5);
          expect(box.y0, `${name} ${width}px ${id}`).toBeGreaterThanOrEqual(2.5);
          expect(box.y1, `${name} ${width}px ${id}`).toBeLessThanOrEqual(l.height - 2.5);
          expect(hitsAny(box, l.lines), `${name} ${width}px: ${id} lies on a line`).toBe(false);
        }
        for (let i = 0; i < boxes.length; i++) {
          for (let j = i + 1; j < boxes.length; j++) {
            const a = boxes[i].box;
            const b = boxes[j].box;
            expect(a.x0 < b.x1 && b.x0 < a.x1 && a.y0 < b.y1 && b.y0 < a.y1, `${name} ${width}px: ${boxes[i].id} lies on ${boxes[j].id}`).toBe(false);
          }
        }
        // Every arrow and the drum stay inside the drawing.
        for (const a of [l.load, l.hold]) {
          if (!a) continue;
          for (const p of [a.from, a.tip]) {
            expect(p.x).toBeGreaterThanOrEqual(0);
            expect(p.x).toBeLessThanOrEqual(width);
            expect(p.y).toBeGreaterThanOrEqual(0);
            expect(p.y).toBeLessThanOrEqual(l.height);
          }
        }
        expect(l.drum.x - l.drum.r).toBeGreaterThanOrEqual(0);
        expect(l.drum.x + l.drum.r).toBeLessThanOrEqual(width);
      }
    });
  }

  it('draws no cable, no angle and no friction sentence on a drum that is not wrapped, and still names both ends', () => {
    const none = drum(withDrum({ wrap: 0, Tsmall: null }));
    expect(none.cable).toBeNull();
    expect(none.dim).toBeNull();
    expect(none.tags.map((t) => t.id)).toEqual(['load', 'hold']);
    expect(none.legend).not.toContain('taper');
  });

  it('leaves the drawing empty when the case cannot be solved', () => {
    const l = drumLayout(null, { width: 390, group: ',', unit: 'lbf', words: { load: '', hold: '', symbols: { big: 'a', small: 'b' }, wrap: '', turns: '', coil: '', taper: '' } });
    expect(l).toMatchObject({ width: 390, cable: null, load: null, hold: null, dim: null, tags: [], legend: [] });
  });

  it('does not draw the force on the drum: it is in the table, and from the centre it lay on the angle', () => {
    expect(read('components/ttc/calc/cable/DrumSchematic.tsx')).not.toContain('mp-cable-fig__resultant');
    expect(layout.legend).not.toContain('resultant');
  });

  it('writes the SVG with an accessible name, the two ends named, the coil and a legend that explains every mark', () => {
    const f = exampleOf('drum');
    const html = renderToStaticMarkup(h(DrumSchematic, { drawing: analyseSafely(f).drawing.drum, width: 720, group: ',', unit: 'lbf', words: wordsOf(f), summary: 'A drum.', legend: cableUi.en.results.legend }));
    expect(attr(html.match(/<svg[^>]*>/)![0], 'aria-label')).toBe('A drum.');
    for (const t of ['Load end', 'T big = 1,000 lbf', 'Holding end', 'T small = 23.05 lbf', 'β = 720°', '2 turns', 'wrapped 2 turns']) expect(html).toContain(`>${t}<`);
    expect(html.match(/<g class="mp-cable-fig__wrap">[\s\S]*?<\/g>/)![0].match(/<path /g)).toHaveLength(14);
    const keys = [...html.matchAll(/<li class="mp-cable-fig__key">[\s\S]*?<span>([^<]*)<\/span>/g)].map((m) => m[1]);
    expect(keys).toEqual(['Drum', 'Centre of the drum', 'Cable on the drum, thinner toward the holding end', 'Wrap angle β', 'Load end: the large tension', 'Holding end: the small tension']);
    expect(html).not.toMatch(/NaN|undefined|Infinity/);
  });
});

describe('the drawings in the sheet', () => {
  const css = read('components/ttc/calc/cable/cable.css');

  it('goes to black on paper, and keeps the meaning in pattern and in the written value', () => {
    const print = css.slice(css.indexOf('@media print'));
    for (const v of ['--mp-cable-tension: #000;', '--mp-cable-friction: #000;', '--mp-cable-normal: #000;']) expect(print).toContain(v);
    expect(print).toContain('.mp-cable .mp-app__plots {\n    break-inside: avoid;');
    expect(print).toContain('.mp-cable .mp-cable__options');
    expect(print).toContain('.mp-cable .mp-cable__curve-table');
    // The curves keep their dashes (they are in the base rules, and print does not take them away).
    expect(print).not.toMatch(/stroke-dasharray: none/);
    // A value written on a drawing carries no halo on paper.
    expect(print).toMatch(/\.mp-cable-fig__value \{\s*stroke: none !important;/);
  });

  it('writes the name of every arrow with its size, so that no colour is needed to read it', () => {
    const source = read('components/ttc/calc/cable/PullSchematic.tsx');
    expect(source).toContain('`${f.id} = ${num(f.magnitude)} ${o.unit}`');
    expect(read('components/ttc/calc/cable/SlingSchematic.tsx')).toContain('`${a.id} = ${num(a.magnitude)} ${o.unit}`');
    expect(read('components/ttc/calc/cable/DrumSchematic.tsx')).toContain('`${o.words.symbols.big} = ${num(big)} ${o.unit}`');
  });

  it('carries neither language: the drawings take their words as props and import the strings as types only', () => {
    for (const file of ['SlingSchematic', 'PullSchematic', 'PullCurve', 'DrumSchematic']) {
      const source = read(`components/ttc/calc/cable/${file}.tsx`);
      expect(source).not.toMatch(/import (?!type)[^;]*from '@\/lib\/calc\/cable\/strings'/);
      expect(source).toContain("'use client';");
    }
  });
});
