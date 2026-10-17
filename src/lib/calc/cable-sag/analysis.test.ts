import { afterEach, describe, expect, it, vi } from 'vitest';
import { analyseCableSag, analyseSafely, type CableSagAnalysis } from './analysis';
import { CABLE_UNITS, convertCableSag, defaultCaseFor, reduceCableSag, type CableSagAction, type CableSagForm, type CableSagMode } from './model';
import { between, logBetween, rng } from './oracle.testlib';
import { MAX_POINT_LOADS } from './types';

vi.setConfig({ testTimeout: 120_000 });
afterEach(() => new Promise<void>((resolve) => setTimeout(resolve, 0)));

/**
 * THE ANALYSIS: everything the page prints, settled once and in the units shown.
 *   — the three defaults, with their hand answers;
 *   — no −0, no NaN, no Infinity anywhere in what is returned, whatever the form holds;
 *   — `analyseSafely` never throws, whatever it is given;
 *   — the drawing: the supports, the curves, the sag dimensions, the labels, the frame;
 *   — units, labels, the problems by field.
 */

const MODES: CableSagMode[] = ['hanging', 'state', 'points'];
const act = (form: CableSagForm, ...actions: CableSagAction[]) => actions.reduce(reduceCableSag, form);
const near = (got: number, want: number, tol = 1e-9, scale = Math.max(Math.abs(want), 1e-300)) => {
  expect(Math.abs(got - want), `got ${got}, want ${want}`).toBeLessThanOrEqual(tol * scale);
};

/** Every number in a result, with its path. */
function numbers(value: unknown, path = ''): [string, number][] {
  if (typeof value === 'number') return [[path, value]];
  if (Array.isArray(value)) return value.flatMap((v, i) => numbers(v, `${path}[${i}]`));
  if (value && typeof value === 'object') return Object.entries(value).flatMap(([k, v]) => numbers(v, `${path}.${k}`));
  return [];
}
const clean = (a: CableSagAnalysis) => {
  for (const [path, v] of numbers(a)) {
    expect(Number.isFinite(v), `${path} = ${v}`).toBe(true);
    expect(Object.is(v, -0), `${path} is -0`).toBe(false);
  }
};

describe('the defaults, with their hand answers', () => {
  it('hanging: the parabola of the 100 ft span — H 12.5, T 13.463, reactions 5, 21.80°, length 102.606, elongation 0.693 in', () => {
    const a = analyseCableSag(defaultCaseFor('hanging'));
    expect(a.issues).toEqual([]);
    expect(a.warnings).toEqual([]);
    expect(a.mode).toBe('hanging');
    expect(a.state).toBeNull();
    expect(a.points).toBeNull();
    const h = a.hanging!;
    expect(h.family).toBe('parabola');
    expect(h.given).toBe('sag-mid');
    expect(h.parabolaExact).toBe(true);
    expect(h.parabolic).toBeNull();
    expect(h.difference).toBeNull();
    near(h.exact.H, 12.5, 1e-12);
    near(h.exact.tension.max, Math.hypot(12.5, 5), 1e-12);
    near(h.exact.reaction.A, 5, 1e-11);
    near(h.exact.angle.A, (Math.atan(0.4) * 180) / Math.PI, 1e-11);
    near(h.exact.length, 102.60606304268443, 1e-11);
    near(h.exact.sagMid, 10, 1e-11);
    near(h.exact.sagLow, 10, 1e-11);
    near(h.exact.sagRatio, 0.1, 1e-11);
    near(h.exact.vertex.x, 50, 1e-11);
    near(h.exact.vertex.z, -10, 1e-11);
    expect(h.exact.vertex.inside).toBe(true);
    // 1 in steel bar: A = 0.7854 in², EA = 22,777 kip; strain 13.46/22777 = 5.9e-4; the stretch ≈ 102.6 ft × 5.9e-4 ≈ 0.0577 ft = 0.69 in
    near(h.section.area, Math.PI / 4, 1e-12);
    near(h.section.EA ?? 0, 29000 * Math.PI / 4, 1e-12);
    expect(h.section.selfWeight).toBe(0);
    near(h.exact.elongation, 0.6933, 2e-4);
    near(h.exact.strain ?? 0, 5.911e-4, 1e-3);
    expect(h.chord).toBe(100);
    expect(h.chordAngle).toBe(0);
    expect(a.units).toBe(CABLE_UNITS.us);
    clean(a);
  });

  it('state: the rope in ice and cold — H 3.0155 → 4.7349 kip (×1.570), sag 6 → 6.195 ft, ΔT −40 °F, strain −2.6e-4', () => {
    const a = analyseCableSag(defaultCaseFor('state'));
    expect(a.issues).toEqual([]);
    const s = a.state!;
    near(s.state1.H, 3.0155, 1e-4);
    near(s.state2.H, 4.7349, 1e-4);
    near(s.state1.sagMid, 6, 1e-11);
    near(s.state2.sagMid, 6.1952, 1e-4);
    near(s.change.ratioH, 1.5702, 1e-4);
    near(s.change.deltaH, s.state2.H - s.state1.H, 1e-12);
    near(s.change.deltaT, -40, 1e-15);
    near(s.change.thermalStrain, -2.6e-4, 1e-12);
    near(s.change.loadPerLength.state1, 1.6083, 1e-4);
    near(s.change.loadPerLength.state2, 2.6083, 1e-4);
    near(s.section.area, 0.40055, 1e-4);
    near(s.section.selfWeight, 1.6083, 1e-4);
    near(s.section.EA ?? 0, 5207.19, 1e-6);
    expect(s.family).toBe('catenary');
    expect(s.parabolic).not.toBeNull();
    expect(s.tables.thermal).toHaveLength(11);
    expect(s.tables.loads).toHaveLength(7);
    expect(s.tables.notes).toEqual([]);
    // the 20 °F row is state 2 and the factor-1 row is state 2
    const t = s.tables.thermal.find((r) => r.isState2)!;
    expect(t.value).toBe(20);
    near(t.H ?? 0, s.state2.H, 1e-9);
    expect(s.tables.thermal.filter((r) => r.isState2)).toHaveLength(1);
    const f = s.tables.loads.find((r) => r.isState2)!;
    expect(f.value).toBe(1);
    near(f.H ?? 0, s.state2.H, 1e-9);
    // the row with state 1's temperature (60 °F) and the factor 0 (no ice, same cable) is state 1
    near(s.tables.thermal.find((r) => r.value === 60)!.ratioH ?? 0, s.tables.thermal.find((r) => r.value === 60)!.H! / s.state1.H, 1e-12);
    near(s.tables.loads[0].H ?? 0, s.state2.H / 1, 1e-1 * s.state2.H); // factor 0 at 20 °F: lighter than state 2
    expect(s.tables.loads[0].H!).toBeLessThan(s.state2.H);
    clean(a);
  });

  it('points: 60 ft, 10/20/10 kip — H 37.5, ordinates 8/12/8, tensions 42.5/38.81, length 65.048, T max 42.5', () => {
    const a = analyseCableSag(defaultCaseFor('points'));
    expect(a.issues).toEqual([]);
    const p = a.points!;
    near(p.H, 37.5, 1e-13);
    expect(p.joints.map((j) => j.kind)).toEqual(['A', 'load', 'load', 'load', 'B']);
    expect(p.joints.map((j) => j.label)).toEqual([0, 1, 2, 3, 0]);
    expect(p.joints.map((j) => j.x)).toEqual([0, 15, 30, 45, 60]);
    near(p.joints[1].sag, 8, 1e-12);
    near(p.joints[2].sag, 12, 1e-12);
    near(p.segments[0].tension, 42.5, 1e-13);
    expect(p.segments.map((s) => s.label)).toEqual([1, 2, 3, 4]);
    expect(p.segments[0].share).toBe(1);
    near(p.segments[1].share, 38.81043674065006 / 42.5, 1e-12);
    near(p.length, 65.04834939252005, 1e-12);
    expect(p.tensionMax).toEqual({ value: expect.closeTo(42.5, 12), segment: 1 });
    expect(p.reaction).toEqual({ A: expect.closeTo(20, 12), B: expect.closeTo(20, 12) });
    expect(p.lowest.joint).toBe(2);
    expect(p.given).toBe('sag');
    expect(p.sagAt).toEqual({ x: 30, value: 12 });
    // the equilibrium is recomputed and is exactly zero below the floor
    expect(p.equilibrium).toEqual({ sumFz: 0, sumM: 0, joint: 0, balanced: true });
    clean(a);
  });

  it('the same three in SI give the same cables', () => {
    const k = 4.4482216152605;
    const h = analyseCableSag(defaultCaseFor('hanging', 'si')).hanging!;
    expect(Math.abs(h.exact.H / (12.5 * k) - 1)).toBeLessThan(1e-4);
    // elongation is in millimetres in SI: 0.693 in = 17.6 mm
    near(h.exact.elongation, 0.6933 * 25.4, 5e-4);
    const s = analyseCableSag(defaultCaseFor('state', 'si')).state!;
    near(s.change.ratioH, 1.5702, 2e-3);
    near(s.change.deltaT, -22.2222, 1e-4);
    near(s.change.thermalStrain, -2.6e-4, 1e-3);
    expect(s.tables.thermal.find((r) => r.isState2)).toBeDefined();
    const p = analyseCableSag(defaultCaseFor('points', 'si')).points!;
    expect(Math.abs(p.H / (37.5 * k) - 1)).toBeLessThan(1e-4);
    expect(analyseCableSag(defaultCaseFor('points', 'si')).units).toBe(CABLE_UNITS.si);
  });
});

describe('what is printed is settled', () => {
  it('no -0, no NaN, no Infinity anywhere, for thousands of random cables in all three modes and both systems', () => {
    const r = rng(61);
    for (let n = 0; n < 600; n++) {
      const mode = MODES[n % 3];
      let f = defaultCaseFor(mode, n % 2 ? 'si' : 'us');
      f = act(
        f,
        { type: 'geometry', patch: { span: logBetween(r, 5, 500), rise: r() < 0.4 ? 0 : between(r, -1, 1) * 300 } },
        { type: 'loads', patch: { q: r() < 0.3 ? 0 : logBetween(r, 0.1, 500), weightFrom: (['section', 'typed', 'none'] as const)[Math.floor(r() * 3)], typedWeight: logBetween(r, 0.05, 5) } },
        { type: 'known', patch: { known: (['sag', 'H', 'T-high', 'T-low', 'length'] as const)[Math.floor(r() * 5)], sagKind: r() < 0.5 ? 'mid' : 'low', sag: logBetween(r, 0.01, 40), H: logBetween(r, 0.5, 80), T: logBetween(r, 0.5, 80), length: logBetween(r, 5, 700) } },
        { type: 'material', material: (['steel', 'rope', 'strand', 'aluminum', 'spiral', 'locked', 'stainless'] as const)[Math.floor(r() * 7)] },
        { type: 'section', patch: { diameter: logBetween(r, 0.2, 3), elastic: r() < 0.7 } },
        { type: 'state', patch: { T1: between(r, 0, 90), T2: between(r, -30, 100), ice: r() < 0.5 ? 0 : logBetween(r, 0.1, 3), q: r() < 0.5 ? 0 : logBetween(r, 1, 100) } },
        { type: 'points', patch: { sagAt: r() < 0.5 ? 20 : between(r, 1, 100), pointsSag: logBetween(r, 0.5, 30), pointsKnown: (['sag', 'H', 'T-max'] as const)[Math.floor(r() * 3)], pointsH: logBetween(r, 1, 100), pointsT: logBetween(r, 5, 200) } },
      );
      const a = analyseSafely(f);
      clean(a);
    }
  });

  it('a perfectly horizontal segment has a slope and an angle of exactly 0 (never −0, never 1e-15)', () => {
    const f = act(defaultCaseFor('points'), { type: 'point-patch', id: 3, patch: { x: 45, P: 20 } }, { type: 'point-patch', id: 1, patch: { x: 15, P: 20 } }, { type: 'point-patch', id: 2, patch: { P: 10 } });
    // 20 at 15, 10 at 30, 20 at 45 gives R = 25 on each side: not horizontal in the middle; two equal loads at 20 and 40 do
    const g = act(f, { type: 'point-remove', id: 2 }, { type: 'point-patch', id: 1, patch: { x: 20, P: 10 } }, { type: 'point-patch', id: 3, patch: { x: 40, P: 10 } }, { type: 'points', patch: { sagAt: 20, pointsSag: 6 } });
    const a = analyseCableSag(g);
    expect(a.issues).toEqual([]);
    const mid = a.points!.segments[1];
    expect(Object.is(mid.slope, 0)).toBe(true);
    expect(Object.is(mid.angle, 0)).toBe(true);
    expect(Object.is(mid.vertical, 0)).toBe(true);
    expect(Object.is(mid.dz, 0)).toBe(true);
    clean(a);
  });

  it('an inextensible cable has an elongation of exactly 0 and no strain', () => {
    const a = analyseCableSag(act(defaultCaseFor('hanging'), { type: 'section', patch: { elastic: false } }));
    expect(a.hanging!.exact.elongation).toBe(0);
    expect(a.hanging!.exact.strain).toBeNull();
    expect(a.hanging!.section.EA).toBeNull();
  });

  it('a temperature change with α = 0 changes nothing: state 2 is state 1, exactly', () => {
    const f = act(defaultCaseFor('state'), { type: 'material', material: 'custom' }, { type: 'section', patch: { alpha: 0 } }, { type: 'state', patch: { ice: 0, q: 0, T2: -40 } });
    const a = analyseCableSag(f);
    expect(a.issues).toEqual([]);
    const s = a.state!;
    expect(s.change.ratioH).toBe(1);
    expect(s.change.deltaH).toBe(0);
    expect(s.change.deltaSagMid).toBe(0);
    expect(s.change.thermalStrain).toBe(0);
    expect(s.state2).toEqual(s.state1);
    clean(a);
  });

  it('ΔT is a difference: the same change of state in °C gives the same ratio', () => {
    const us = defaultCaseFor('state');
    const si = convertCableSag(us, 'si');
    const a = analyseCableSag(us).state!;
    const b = analyseCableSag(si).state!;
    near(b.change.ratioH, a.change.ratioH, 1e-3);
    near(b.change.thermalStrain, a.change.thermalStrain, 1e-4);
    near(b.change.deltaT, (20 - 60) / 1.8, 1e-4);
  });

  it('the parabola next to the exact cable: the difference line, the family and the warning', () => {
    const f = act(defaultCaseFor('hanging'), { type: 'loads', patch: { q: 0, weightFrom: 'typed', typedWeight: 1000 } }, { type: 'known', patch: { sag: 30 } }, { type: 'section', patch: { elastic: false } });
    const a = analyseCableSag(f);
    const h = a.hanging!;
    expect(h.family).toBe('catenary');
    expect(h.parabolaExact).toBe(false);
    expect(h.parabolic).not.toBeNull();
    expect(h.difference!.worst).toBeGreaterThan(0.01);
    expect(h.difference!.H).toBeLessThan(0);
    expect(a.warnings.map((w) => w.code)).toContain('parabola-differs');
    expect(a.warnings.find((w) => w.code === 'parabola-differs')?.ratio).toBeCloseTo(0.3, 9);
    // the difference in the exact sag is zero to the floor: the sag was the known
    expect(h.difference!.sagMid).toBe(0);
    clean(a);
  });

  it('a tension known: both cables, the warning, the alternative', () => {
    const f = act(defaultCaseFor('hanging'), { type: 'loads', patch: { q: 0, weightFrom: 'typed', typedWeight: 1000 } }, { type: 'known', patch: { known: 'T-high', T: 1100 } }, { type: 'geometry', patch: { span: 100 } });
    const a = analyseCableSag(f);
    expect(a.issues, JSON.stringify(a.issues)).toEqual([]);
    expect(a.hanging!.alternative).not.toBeNull();
    expect(a.hanging!.alternative!.sagMid).toBeGreaterThan(a.hanging!.exact.sagMid);
    expect(a.warnings.map((w) => w.code)).toContain('tension-two-roots');
  });
});

describe('the drawing', () => {
  const curveIds = (a: CableSagAnalysis) => a.drawing.curves.map((c) => c.id);

  it('hanging: the exact curve (+ the parabola when it is different), the chord, the supports, the mid-span sag dimension', () => {
    const q = analyseCableSag(defaultCaseFor('hanging'));
    expect(curveIds(q)).toEqual(['exact']);
    const w = analyseCableSag(act(defaultCaseFor('hanging'), { type: 'loads', patch: { q: 0, weightFrom: 'typed', typedWeight: 500 } }, { type: 'section', patch: { elastic: false } }));
    expect(curveIds(w)).toEqual(['exact', 'parabola']);
    for (const a of [q, w]) {
      const d = a.drawing;
      expect(d.mode).toBe('hanging');
      expect(d.supports).toEqual({ A: { x: 0, z: 0 }, B: { x: 100, z: 0 } });
      expect(d.chord).toEqual({ x0: 0, z0: 0, x1: 100, z1: 0 });
      for (const c of d.curves) {
        expect(c.points[0]).toEqual({ x: 0, z: 0 });
        expect(c.points[c.points.length - 1]).toEqual({ x: 100, z: 0 });
        expect(c.points.length).toBeGreaterThan(20);
      }
      expect(d.sag.given).toBe('mid');
      expect(d.sag.mid).toEqual({ x: 50, zTop: 0, zBottom: expect.closeTo(-10, 9), value: expect.closeTo(10, 9) });
      expect(d.sag.low).toEqual({ x: expect.closeTo(50, 8), zTop: 0, zBottom: expect.closeTo(-10, 9), value: expect.closeTo(10, 9), from: 0 });
      expect(d.labels.A).toEqual({ x: 0, z: 0 });
      expect(d.labels.B).toEqual({ x: 100, z: 0 });
      expect(d.labels.H.x).toBeCloseTo(50, 8);
      expect(d.labels.H.z).toBeCloseTo(-10, 8);
      expect(d.loads).toEqual([]);
      // the frame contains the box, which contains every point, padded
      expect(d.box.x0).toBe(0);
      expect(d.box.z1).toBe(0);
      expect(d.box.z0).toBeCloseTo(-10, 8);
      expect(d.frame.x0).toBeLessThan(d.box.x0);
      expect(d.frame.x1).toBeGreaterThan(d.box.x1);
      expect(d.frame.z0).toBeLessThan(d.box.z0);
      expect(d.frame.z1).toBeGreaterThan(d.box.z1);
      near(d.frame.width, d.box.width + 2 * d.pad, 1e-12);
      near(d.pad, 0.14 * Math.max(d.box.width, d.box.height), 1e-12);
    }
  });

  it('inclined hanging: the two sags are different dimensions; the lowest-point one starts from the lower support', () => {
    const a = analyseCableSag(act(defaultCaseFor('hanging'), { type: 'geometry', patch: { rise: 20 } }, { type: 'known', patch: { sagKind: 'low', sag: 6 } }));
    const d = a.drawing;
    expect(d.sag.given).toBe('low');
    expect(d.sag.low!.value).toBeCloseTo(6, 8);
    expect(d.sag.low!.zTop).toBe(0); // the lower support is A (level 0)
    expect(d.sag.low!.from).toBe(0);
    expect(d.sag.mid!.zTop).toBeCloseTo(10, 12); // the chord's height at mid-span
    expect(d.sag.mid!.value).not.toBeCloseTo(6, 3);
    const b = analyseCableSag(act(defaultCaseFor('hanging'), { type: 'geometry', patch: { rise: -20 } }, { type: 'known', patch: { sagKind: 'low', sag: 6 } }));
    expect(b.drawing.sag.low!.zTop).toBe(-20);
    expect(b.drawing.sag.low!.from).toBe(100);
    // a steep taut cable: the lowest point is outside the span: no low dimension
    const steep = analyseCableSag(act(defaultCaseFor('hanging'), { type: 'geometry', patch: { rise: 60 } }, { type: 'known', patch: { sag: 1 } }, { type: 'loads', patch: { q: 0, weightFrom: 'typed', typedWeight: 1000 } }));
    expect(steep.drawing.sag.low).toBeNull();
    expect(steep.warnings.map((w) => w.code)).toContain('vertex-outside');
    expect(steep.drawing.labels.H).toEqual({ x: 0, z: 0 });
    clean(steep);
  });

  it('a sag dimension that is 0 is not drawn', () => {
    const a = analyseCableSag(act(defaultCaseFor('hanging'), { type: 'known', patch: { known: 'H', H: 1e12 } }));
    expect(a.drawing.sag.mid).toBeNull();
  });

  it('state: both cables; state 2\'s sag dimension, state 1\'s separately', () => {
    const a = analyseCableSag(defaultCaseFor('state'));
    expect(curveIds(a)).toEqual(['state1', 'state2']);
    expect(a.drawing.mode).toBe('state');
    expect(a.drawing.sag.mid!.value).toBeCloseTo(6.1952, 3);
    expect(a.drawing.sag.state1!.value).toBeCloseTo(6, 8);
    expect(a.drawing.sag.given).toBe('mid');
  });

  it('points: the polygon through the joints, the loads as arrows on the cable, the sag at the stated position', () => {
    const a = analyseCableSag(defaultCaseFor('points'));
    const d = a.drawing;
    expect(curveIds(a)).toEqual(['polygon']);
    expect(d.curves[0].points).toEqual([{ x: 0, z: 0 }, { x: 15, z: expect.closeTo(-8, 12) }, { x: 30, z: expect.closeTo(-12, 12) }, { x: 45, z: expect.closeTo(-8, 12) }, { x: 60, z: 0 }]);
    expect(d.loads.map((l) => l.label)).toEqual([1, 2, 3]);
    expect(d.loads.map((l) => l.share)).toEqual([0.5, 1, 0.5]);
    expect(d.loads[1]).toEqual({ label: 2, x: 30, z: expect.closeTo(-12, 12), P: 20, share: 1 });
    expect(d.sag.mid).toEqual({ x: 30, zTop: 0, zBottom: expect.closeTo(-12, 12), value: expect.closeTo(12, 12) });
    expect(d.sag.low).toBeNull();
    expect(d.sag.given).toBe('mid');
    expect(d.labels.H).toEqual({ x: 30, z: expect.closeTo(-12, 12) });
    // the sag at a stated position that is not a load, on an inclined span: the value is chord − cable there
    const g = act(defaultCaseFor('points'), { type: 'geometry', patch: { rise: 6 } }, { type: 'points', patch: { sagAt: 22.5, pointsSag: 9 } });
    const b = analyseCableSag(g);
    expect(b.issues).toEqual([]);
    expect(b.drawing.sag.mid!.value).toBeCloseTo(9, 9);
    expect(b.drawing.sag.mid!.zTop).toBeCloseTo((6 / 60) * 22.5, 12);
    expect(b.warnings.map((w) => w.code)).toContain('sag-not-at-load');
    // H given: no sag was the known
    expect(analyseCableSag(act(defaultCaseFor('points'), { type: 'points', patch: { pointsKnown: 'H' } })).drawing.sag.given).toBeNull();
  });

  it('when nothing can be solved, the drawing still shows the supports and the chord the form allows', () => {
    const a = analyseCableSag(act(defaultCaseFor('hanging'), { type: 'known', patch: { sag: -1 } }));
    expect(a.hanging).toBeNull();
    expect(a.drawing.curves).toEqual([]);
    expect(a.drawing.supports.B).toEqual({ x: 100, z: 0 });
    expect(a.drawing.frame.width).toBeGreaterThan(100);
    const b = analyseCableSag(act(defaultCaseFor('hanging'), { type: 'geometry', patch: { span: Number.NaN, rise: Number.NaN } }));
    expect(b.drawing.supports.B).toEqual({ x: 1, z: 0 });
    clean(b);
  });
});

describe('the problems, by field and by label', () => {
  it('each issue carries the field of the form at fault and the numbers its sentence needs', () => {
    const base = defaultCaseFor('hanging');
    const field = (f: CableSagForm) => analyseCableSag(f).issues[0];
    expect(field(act(base, { type: 'geometry', patch: { span: 0 } }))).toEqual({ code: 'span', field: 'span' });
    expect(field(act(base, { type: 'geometry', patch: { rise: 1e6 } }))).toMatchObject({ code: 'rise', field: 'rise', max: 100 });
    expect(field(act(base, { type: 'loads', patch: { q: 0 } }))).toEqual({ code: 'load-zero' });
    expect(field(act(base, { type: 'known', patch: { sag: 0 } }))).toEqual({ code: 'known-value', field: 'known' });
    expect(field(act(base, { type: 'known', patch: { sag: 1e-9 } }))).toMatchObject({ code: 'sag-range', field: 'known', min: 1e-6, max: 100 });
    expect(field(act(base, { type: 'section', patch: { E: 0 } }))).toEqual({ code: 'section', field: 'section' });
    expect(field(act(base, { type: 'section', patch: { E: Number.NaN } }))).toEqual({ code: 'section', field: 'section' });
    expect(field(act(base, { type: 'known', patch: { known: 'length', length: 90 }, }, { type: 'section', patch: { elastic: false } }))).toEqual({ code: 'length-below-chord', field: 'known', chord: 100, length: 90 });
    expect(field(act(base, { type: 'known', patch: { known: 'T-high', T: 1 } }))).toMatchObject({ code: 'tension-below-minimum', field: 'known', value: 1 });
    expect(field(act(base, { type: 'loads', patch: { weightFrom: 'typed', typedWeight: Number.NaN } }))).toEqual({ code: 'number', field: 'weight' });
    expect(field(act(base, { type: 'loads', patch: { q: Number.NaN } }))).toEqual({ code: 'number', field: 'q' });
    const state = defaultCaseFor('state');
    expect(field(act(state, { type: 'state', patch: { T2: Number.NaN } }))).toEqual({ code: 'thermal', field: 'thermal', value: Number.NaN });
    expect(field(act(state, { type: 'state', patch: { ice: -5 } }))).toEqual({ code: 'number', state: 2, field: 'state.ice' });
    expect(field(act(state, { type: 'state', patch: { ice: 0, q: 0 } }, { type: 'loads', patch: { weightFrom: 'none', q: 50 } }))).toMatchObject({ code: 'state2-load-zero', state: 2 });
    expect(field(act(state, { type: 'section', patch: { elastic: false } }, { type: 'state', patch: { T2: -1000 } }))).toMatchObject({ code: 'state2-too-short', state: 2 });
  });

  it('point loads are named by their label (from 1, in the order the form lists them) and by the id of their row', () => {
    const base = defaultCaseFor('points');
    const bad = act(base, { type: 'point-patch', id: 2, patch: { x: 80 } });
    const a = analyseCableSag(bad);
    expect(a.issues).toEqual([{ code: 'load-position', field: { point: 2 }, at: 2, value: 80 }]);
    const dup = act(base, { type: 'point-patch', id: 3, patch: { x: 15 } });
    expect(analyseCableSag(dup).issues).toEqual([{ code: 'duplicate-position', field: { point: 3 }, ats: [1, 3] }]);
    const nan = act(base, { type: 'point-patch', id: 1, patch: { P: Number.NaN } });
    expect(analyseCableSag(nan).issues).toEqual([{ code: 'number', field: { point: 1 }, at: 1 }]);
    expect(analyseCableSag(act(base, { type: 'points', patch: { sagAt: 0 } })).issues).toEqual([{ code: 'sag-position', field: 'sagAt', value: 0 }]);
    expect(analyseCableSag(act(base, { type: 'points', patch: { pointsSag: -3 } })).issues).toMatchObject([{ code: 'negative-tension', field: 'known' }]);
    let many = base;
    for (let i = 0; i < MAX_POINT_LOADS; i++) many = { ...many, points: [...many.points, { id: many.nextId + i, x: 1 + i, P: 1 }] };
    expect(analyseCableSag(many).issues).toEqual([{ code: 'too-many-loads', field: 'points', count: many.points.length, max: MAX_POINT_LOADS }]);
    expect(analyseCableSag({ ...base, points: [] }).issues).toEqual([{ code: 'no-loads', field: 'points' }]);
  });

  it('the table notes: a table that cannot be made is a note, not a problem of the case', () => {
    const a = analyseCableSag(act(defaultCaseFor('state'), { type: 'state', patch: { step: 0, factorRows: 99 } }));
    expect(a.issues).toEqual([]);
    expect(a.state!.tables.thermal).toEqual([]);
    expect(a.state!.tables.loads).toEqual([]);
    expect(a.state!.tables.notes).toEqual([
      { code: 'table', field: 'table.thermal', count: 0, max: 41 },
      { code: 'table', field: 'table.loads', count: 99, max: 21 },
    ]);
  });

  it('a row of a table that cannot be solved says why; the rest stay', () => {
    const f = act(defaultCaseFor('state'), { type: 'section', patch: { elastic: false } }, { type: 'state', patch: { low: -300, high: 0, step: 100, T2: 20 } });
    const rows = analyseCableSag(f).state!.tables.thermal;
    // −300, −200, −100 and 0 °F against 60 °F: the rigid cable has 0.32 ft more than its chord and loses 0.7, 0.5, 0.31 ft and 0.23 ft
    expect(rows.map((r) => r.ok)).toEqual([false, false, true, true]);
    expect(rows[0].code).toBe('state2-too-short');
    expect(rows[3].H).toBeDefined();
  });
});

describe('analyseSafely never throws', () => {
  it('on forms with anything in any field', () => {
    const r = rng(62);
    const junk = [undefined, null, Number.NaN, Number.POSITIVE_INFINITY, Number.NEGATIVE_INFINITY, 'x', {}, [], -1, 0, 1e300, -1e300, 1e-300];
    for (let n = 0; n < 400; n++) {
      const f = defaultCaseFor(MODES[n % 3], n % 2 ? 'si' : 'us') as unknown as Record<string, unknown>;
      for (const key of Object.keys(f)) if (r() < 0.25) f[key] = junk[Math.floor(r() * junk.length)];
      const state = f.state as Record<string, unknown> | undefined;
      if (state && typeof state === 'object' && r() < 0.5) for (const key of Object.keys(state)) if (r() < 0.3) state[key] = junk[Math.floor(r() * junk.length)];
      let out: CableSagAnalysis | undefined;
      expect(() => {
        out = analyseSafely(f as unknown as CableSagForm);
      }).not.toThrow();
      expect(out).toBeDefined();
      // (an issue may carry the very number that was typed, even an infinity: it is what its sentence quotes)
      for (const [path, v] of numbers({ ...out, issues: [] })) expect(Number.isFinite(v), path).toBe(true);
      // what is returned is always the same shape
      expect(Array.isArray(out!.issues)).toBe(true);
      expect(out!.drawing.frame.width).toBeGreaterThan(0);
      for (const [path, v] of numbers(out!.drawing)) expect(Number.isFinite(v), `drawing ${path}`).toBe(true);
    }
  });

  it('on a null form, or one the arithmetic throws on: the problem is "stopped"', () => {
    const a = analyseSafely(null as unknown as CableSagForm);
    expect(a.issues).toEqual([{ code: 'stopped' }]);
    expect(a.hanging).toBeNull();
    expect(a.drawing.frame.width).toBeGreaterThan(0);
    const booby = { ...defaultCaseFor('hanging'), get span(): number { throw new Error('boom'); } };
    const b = analyseSafely(booby as unknown as CableSagForm);
    expect(b.issues).toEqual([{ code: 'stopped' }]);
    expect(b.drawing.supports.B.x).toBeGreaterThan(0);
  });
});
