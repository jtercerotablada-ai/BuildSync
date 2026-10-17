import { afterEach, describe, expect, it, vi } from 'vitest';
import { analyseSafely, memberValuesAt, mergeDuplicates, nice, type FrameAnalysis } from './analysis';
import { solveFrame } from './engine';
import { evalPoly } from './element';
import { normal, randomForm } from './forms.testlib';
import { convertFrame, defaultFrame, emptyFrame, reduceFrame, toEngine, type FrameAction, type FrameForm } from './model';
import { FRAME_ZERO } from './types';

vi.setConfig({ testTimeout: 120_000 });
afterEach(() => new Promise((r) => setTimeout(r, 0)));

const run = (form: FrameForm, ...actions: FrameAction[]): FrameForm => actions.reduce(reduceFrame, form);
const solved = (form: FrameForm): FrameAnalysis & { results: NonNullable<FrameAnalysis['results']> } => {
  const a = analyseSafely(form);
  if (!a.results) throw new Error(`not solved: ${JSON.stringify(a.issues)}`);
  return a as never;
};

/** The solver's member 3 (the beam) of the example, for the integral. */
function pieceSource() {
  const r = solveFrame(toEngine(defaultFrame()).model);
  if (!r.ok) throw new Error('example does not solve');
  return r.members[2];
}

/** Every number anywhere in a value. */
function numbers(v: unknown, path = '', out: [string, number][] = []): [string, number][] {
  if (typeof v === 'number') out.push([path, v]);
  else if (Array.isArray(v)) v.forEach((x, k) => numbers(x, `${path}[${k}]`, out));
  else if (v && typeof v === 'object') for (const [k, x] of Object.entries(v)) numbers(x, `${path}.${k}`, out);
  return out;
}

describe('the example', () => {
  const a = solved(defaultFrame());
  const r = a.results;
  it('has the reactions, moments and sway of the solver (the hand answer, to the axial deformations)', () => {
    expect(a.issues).toEqual([]);
    expect(a.warnings).toEqual([]);
    expect(a.determinacy).toMatchObject({ joints: 4, members: 3, reactions: 6, releases: 0, freeJoints: 0, equations: 12, degree: 3, word: 'indeterminate' });
    expect(a.units.moment).toBe('kip·ft');
    // The hand answer is Rx −0.2 and −9.8, Ry 10.125 and 13.875, M −13.25 and −50.75: the solver's are within the effect of EA.
    expect(r.reactions[0].rx).toBeCloseTo(-0.31086, 4);
    expect(r.reactions[1].rx).toBeCloseTo(-9.68914, 4);
    expect(r.reactions[0].ry).toBeCloseTo(10.12835, 4);
    expect(r.reactions[1].ry).toBeCloseTo(13.87165, 4);
    expect(r.reactions[0].rm).toBeCloseTo(16.11494, 4);
    expect(r.reactions[1].rm).toBeCloseTo(46.45198, 4);
    expect(r.members[2].start.M).toBeCloseTo(-13.0063, 4);
    expect(r.members[2].end.M).toBeCloseTo(-50.4394, 4);
    expect(r.members[2].maxima.M.max.value).toBeCloseTo(29.7368, 4);
    expect(r.members[2].maxima.M.max.x).toBeCloseTo(8.4403, 3);
    expect(Math.abs(r.members[2].end.M - -50.75) / 50.75).toBeLessThan(0.01);
    expect(r.displacements![2].ux).toBeCloseTo(0.092819, 5);
    expect(r.displacements![0]).toMatchObject({ ux: 0, uy: 0, rotation: 0 });
    expect(r.extremes.M.max).toMatchObject({ member: 2, x: 10 });
    expect(r.extremes.M.min).toMatchObject({ member: 3, x: 20 });
    expect(r.members[0]).toMatchObject({ label: 1, i: 1, j: 3, length: 10, angle: 90, hingeStart: false, hingeEnd: false, A: 14.1, I: 484, E: 29000 });
    expect(r.members[2].angle).toBe(0);
  });
  it('its equilibrium is exact to the figures: sums settled to zero, the loads added up', () => {
    expect(r.equilibrium).toMatchObject({ sumFx: 0, sumFy: 0, sumM: 0, joint: 0, balanced: true });
    expect(r.equilibrium.applied.fx).toBe(10);
    expect(r.equilibrium.applied.fy).toBeCloseTo(-24, 12);
    expect(r.equilibrium.reacted.fy).toBeCloseTo(24, 12);
    expect(r.equilibrium.about).toEqual({ x: 10, y: 5 });
  });
  it('a pin or a free node never prints a rounding as a result; a zero is 0 and never −0', () => {
    const bad: string[] = [];
    for (const [path, v] of numbers(a.results)) {
      if (Object.is(v, -0)) bad.push(`${path} is −0`);
      if (!Number.isFinite(v)) bad.push(`${path} is ${v}`);
    }
    expect(bad).toEqual([]);
    const pinned = solved(run(defaultFrame(), { type: 'patch', list: 'supports', id: 8, patch: { kind: 'pin' } }));
    expect(pinned.results.reactions[0].rm).toBe(0);
    expect(Object.is(pinned.results.reactions[0].rm, 0)).toBe(true);
  });
});

describe('a real zero is a zero: nothing under a billionth of the problem prints as a number', () => {
  it('a symmetric frame under a symmetric load: no shear where the load is symmetric, equal and opposite thrusts', () => {
    const f = run(defaultFrame(), { type: 'patch', list: 'loads', id: 10, patch: { fx: 0 } });
    const a = solved(f);
    expect(a.results.members[2].stations.find((s) => s.kind === 'zero-shear')!.V).toBe(0);
    expect(a.results.reactions[0].rx + a.results.reactions[1].rx).toBeCloseTo(0, 12);
    expect(a.results.displacements![2].ux + a.results.displacements![3].ux).toBeCloseTo(0, 12);
  });
  it('a simple beam under gravity: no horizontal reaction, no axial force, no rotation at the middle, nothing but exact zeros', () => {
    const f = run(
      emptyFrame(),
      { type: 'add', list: 'nodes', seed: { x: 0, y: 0 } },
      { type: 'add', list: 'nodes', seed: { x: 10, y: 0 } },
      { type: 'add', list: 'nodes', seed: { x: 20, y: 0 } },
      { type: 'add', list: 'members', seed: { i: 1, j: 2 } },
      { type: 'add', list: 'members', seed: { i: 2, j: 3 } },
      { type: 'add', list: 'supports', seed: { node: 1, kind: 'pin' } },
      { type: 'add', list: 'supports', seed: { node: 3, kind: 'roller' } },
      { type: 'add', list: 'memberLoads', seed: { member: 4, kind: 'udl' } },
      { type: 'add', list: 'memberLoads', seed: { member: 5, kind: 'udl' } },
    );
    const a = solved(f);
    expect(a.results.reactions.map((r) => [r.rx, r.rm])).toEqual([[0, 0], [0, 0]]);
    expect(a.results.members.map((m) => [m.start.N, m.end.N])).toEqual([[0, 0], [0, 0]]);
    expect(a.results.displacements![1].rotation).toBe(0);
    expect(a.results.displacements![1].ux).toBe(0);
    expect(a.results.equilibrium).toMatchObject({ sumFx: 0, sumFy: 0, sumM: 0, joint: 0 });
  });
  it('a determinate frame under a temperature change develops exactly nothing (and moves)', () => {
    const f = run(
      emptyFrame(),
      { type: 'template', template: 'l-frame' },
      { type: 'add', list: 'memberLoads', seed: { kind: 'temperature', member: 5 } },
      { type: 'patch', list: 'memberLoads', id: 8, patch: { dT: 60 } },
    );
    const a = solved({ ...f, memberLoads: f.memberLoads.filter((l) => l.kind === 'temperature') });
    const all = [...a.results.members.flatMap((m) => [m.start.N, m.start.V, m.start.M, m.end.N, m.end.V, m.end.M]), ...a.results.reactions.flatMap((r) => [r.rx, r.ry, r.rm])];
    expect(all.every((v) => v === 0)).toBe(true);
    // The beam (12 ft, 60 °F, α = 6.5e-6) grows by 144 · 6.5e-6 · 60 = 0.05616 inch.
    expect(Math.max(...a.results.displacements!.map((d) => d.magnitude))).toBeCloseTo(0.05616, 5);
  });
  it('a frame with no load says so and is all zero', () => {
    const a = solved({ ...defaultFrame(), loads: [], memberLoads: [] });
    expect(a.warnings).toEqual([{ code: 'no-load' }]);
    expect(numbers(a.results.reactions).every(([, v]) => v === 0 || v === 1 || v === 2)).toBe(true);
    expect(a.drawing.moment!.scale).toBeNull();
    expect(a.drawing.deflected!.factor).toBeNull();
  });
  it('the floors are written once: FRAME_ZERO of the force scale, and of the scale times the size for a moment', () => {
    const a = solved(defaultFrame());
    expect(a.results.equilibrium.floor.force).toBeCloseTo(FRAME_ZERO * a.results.equilibrium.scale, 20);
    expect(a.results.equilibrium.floor.moment).toBeCloseTo(a.results.equilibrium.floor.force * Math.hypot(20, 10), 18);
  });
});

describe('a pointer over a diagram', () => {
  const a = solved(defaultFrame());
  it('reads the exact N, V and M of a member at any distance, on either side of a jump', () => {
    // The beam (member 3): M(0) = −13.0063, V(0) = +10.1283, and at 8.4403 ft the shear is zero and M is the maximum.
    expect(memberValuesAt(a.results, 3, 0)!.M).toBeCloseTo(-13.0063, 4);
    expect(memberValuesAt(a.results, 3, 0)!.V).toBeCloseTo(10.12835, 4);
    expect(memberValuesAt(a.results, 3, a.results.members[2].maxima.M.max.x)!.V).toBe(0);
    expect(memberValuesAt(a.results, 3, a.results.members[2].maxima.M.max.x)!.M).toBeCloseTo(29.7368, 4);
    expect(memberValuesAt(a.results, 3, 20)!.M).toBeCloseTo(-50.4394, 4);
    expect(memberValuesAt(a.results, 4, 1)).toBeNull();
    expect(memberValuesAt(a.results, 3, Number.NaN)).toBeNull();
    const f = run(defaultFrame(), { type: 'add', list: 'memberLoads', seed: { kind: 'point', member: 7 } });
    const b = solved(f);
    const jump = b.results.members[2].stations.filter((s) => s.kind === 'load');
    expect(jump).toHaveLength(2);
    const x = jump[0].x;
    expect(memberValuesAt(b.results, 3, x, 'right')!.V - memberValuesAt(b.results, 3, x, 'left')!.V).toBeCloseTo(-10, 8);
  });
});

describe('units', () => {
  it('the same frame in SI has the same forces (kN) and moments (kN·m) as the US one converted, and displacements in millimetres', () => {
    const us = solved(defaultFrame());
    const si = solved(convertFrame(defaultFrame(), 'si'));
    const kip = 4.4482216152605;
    expect(si.units).toMatchObject({ length: 'm', force: 'kN', moment: 'kN·m', displacement: 'mm' });
    // SI uses E = 200 GPa (29,000 ksi is 199.95): forces agree to a few parts in ten thousand, displacements to the same.
    expect(si.results.reactions[1].ry / kip).toBeCloseTo(us.results.reactions[1].ry, 2);
    expect(si.results.members[2].end.M / (kip * 0.3048)).toBeCloseTo(us.results.members[2].end.M, 2);
    expect(si.results.displacements![2].ux / 25.4 / us.results.displacements![2].ux).toBeCloseTo(1, 3);
  });
});

describe('the drawings', () => {
  const a = solved(defaultFrame());
  const d = a.drawing;
  it('the frame: nodes, members, supports, loads, reactions, a box with room for them', () => {
    expect(d.nodes.map((n) => [n.label, n.x, n.y])).toEqual([[1, 0, 0], [2, 20, 0], [3, 0, 10], [4, 20, 10]]);
    expect(d.members.map((m) => [m.label, m.i, m.j])).toEqual([[1, 1, 3], [2, 2, 4], [3, 3, 4]]);
    expect(d.supports.map((s) => [s.label, s.node, s.kind, s.angle, s.settles])).toEqual([[1, 1, 'fixed', null, false], [2, 2, 'fixed', null, false]]);
    expect(d.loads).toMatchObject([{ label: 1, node: 3, fx: 10, magnitude: 10, dx: 1, dy: 0, share: 1 }]);
    expect(d.memberLoads).toMatchObject([{ label: 1, member: 3, kind: 'udl', x1: 0, y1: 10, x2: 20, y2: 10, dx: 0, dy: -1, v1: 1.2, v2: 1.2, share: 1 }]);
    expect(d.reactions).toHaveLength(2);
    expect(d.reactions[1].share).toBe(1);
    expect(d.box).toMatchObject({ x0: 0, y0: 0, x1: 20, y1: 10, width: 20, height: 10 });
    expect(d.side).toBe(20);
    expect(d.pad).toBeCloseTo(2.8, 12);
    expect([d.frame.x0, d.frame.y0, d.frame.x1, d.frame.y1].map((v) => Number(v.toFixed(9)))).toEqual([-2.8, -2.8, 22.8, 12.8]);
  });
  it('each diagram has one clean scale and the largest value is 13 to 17.5 per cent of the larger side', () => {
    for (const diagram of [d.moment!, d.shear!, d.axial!]) {
      const s = diagram.scale!;
      const mantissa = s.perUnit / 10 ** Math.floor(Math.log10(s.perUnit));
      expect([1, 1.2, 1.5, 2, 2.5, 3, 4, 5, 6, 8].some((m) => Math.abs(m - mantissa) < 1e-9), `${diagram.kind} ${s.perUnit}`).toBe(true);
      expect(s.share).toBeGreaterThanOrEqual(0.13);
      expect(s.share).toBeLessThanOrEqual(0.175);
      expect(s.height).toBeCloseTo(diagram.max / s.perUnit, 12);
    }
    expect(d.moment!.unit).toBe('kip·ft');
    expect(d.moment!.side).toBe('tension');
    expect(d.shear!.side).toBe('left');
  });
  it('the scale is a clean number for any frame: 500 random frames', () => {
    let checked = 0;
    for (let seed = 1; seed <= 500; seed++) {
      const an = analyseSafely(randomForm(seed, 14));
      if (!an.results) continue;
      for (const diagram of [an.drawing.moment!, an.drawing.shear!, an.drawing.axial!]) {
        if (!diagram.scale) continue;
        checked++;
        const m = diagram.scale.perUnit / 10 ** Math.floor(Math.log10(diagram.scale.perUnit));
        expect([1, 1.2, 1.5, 2, 2.5, 3, 4, 5, 6, 8].some((v) => Math.abs(v - m) < 1e-9 * 10), `${seed} ${diagram.scale.perUnit}`).toBe(true);
        expect(diagram.scale.share).toBeGreaterThanOrEqual(0.12);
        expect(diagram.scale.share).toBeLessThanOrEqual(0.18);
      }
    }
    expect(checked).toBeGreaterThan(100);
  });
  it('the moment is drawn on the TENSION side: the middle of the beam (sagging) hangs below it, its ends (hogging) stand above it', () => {
    const beam = d.moment!.members[2];
    const mid = beam.labels.find((l) => l.kind === 'max')!;
    expect(mid.value).toBeGreaterThan(0);
    expect(mid.y).toBeLessThan(10);
    expect(mid.ay).toBe(10);
    const end = beam.labels.find((l) => l.kind === 'end')!;
    expect(end.value).toBeLessThan(0);
    expect(end.y).toBeGreaterThan(10);
    // The height of the largest value is the scale's.
    expect(Math.abs(end.y - 10)).toBeCloseTo(d.moment!.scale!.height * (50.4394 / d.moment!.max), 3);
    // The shear is drawn up when positive: the left end of the beam has V = +10.13.
    const v = d.shear!.members[2].labels.find((l) => l.kind === 'start')!;
    expect(v.value).toBeGreaterThan(0);
    expect(v.y).toBeGreaterThan(10);
  });
  it('the polygons are the areas between the member and the outline, split where the sign changes: their area is the integral of the diagram', () => {
    const area = (pts: { x: number; y: number }[]) => Math.abs(pts.reduce((s, p, k) => s + (p.x * pts[(k + 1) % pts.length].y - pts[(k + 1) % pts.length].x * p.y), 0) / 2);
    const beam = d.moment!.members[2];
    expect(beam.polygons.map((p) => p.sign)).toEqual([-1, 1, -1]);
    const k = 1 / d.moment!.scale!.perUnit;
    const sol = pieceSource();
    // ∫ M dx over the beam by Simpson on the exact pieces, positive and negative parts apart.
    let pos = 0;
    let neg = 0;
    for (const p of sol.pieces) {
      const n = 4000;
      const h = (p.x1 - p.x0) / n;
      for (let q = 0; q < n; q++) {
        const m = evalPoly(p.M, (q + 0.5) * h);
        if (m > 0) pos += m * h;
        else neg -= m * h;
      }
    }
    const polygonPos = beam.polygons.filter((p) => p.sign === 1).reduce((s, p) => s + area(p.points), 0);
    const polygonNeg = beam.polygons.filter((p) => p.sign === -1).reduce((s, p) => s + area(p.points), 0);
    // A parabola drawn with 24 chords is short of its area by 1/24² = 0.17 %.
    expect(Math.abs(polygonPos / (pos * k) - 1)).toBeLessThan(0.005);
    expect(Math.abs(polygonNeg / (neg * k) - 1)).toBeLessThan(0.005);
    expect(polygonPos).toBeLessThan(pos * k);
  });
  it('the deflected shape is exaggerated by a clean factor so that the largest displacement is 5 to 8 per cent of the larger side, and starts at the nodes', () => {
    const def = d.deflected!;
    const m = def.factor! / 10 ** Math.floor(Math.log10(def.factor!));
    expect([1, 1.5, 2, 2.5, 3, 4, 5, 6, 8].some((v) => Math.abs(v - m) < 1e-9), `${def.factor}`).toBe(true);
    expect(def.share!).toBeGreaterThanOrEqual(0.05);
    expect(def.share!).toBeLessThanOrEqual(0.08);
    expect(def.maxDisplacement).toBeGreaterThan(0.1468);
    expect(def.maxDisplacement).toBeLessThan(0.16);
    // The node 3 is drawn at its place plus the exaggerated displacement (inches → feet).
    const n3 = def.nodes.find((n) => n.node === 3)!;
    expect(n3.x).toBeCloseTo((def.factor! * 0.092819) / 12, 5);
    expect(def.members[0].points[0]).toEqual({ x: 0, y: 0 });
    const last = def.members[0].points[def.members[0].points.length - 1];
    expect(last.x).toBeCloseTo(n3.x, 6);
    expect(last.y).toBeCloseTo(10 + (def.factor! * -0.002972) / 12, 5);
    expect(def.frame.x1).toBeGreaterThanOrEqual(def.members[2].points.reduce((s, p) => Math.max(s, p.x), 0));
  });
  it('a determinate frame without sections is drawn without a deflected shape and says why; an indeterminate one cannot be solved', () => {
    const bare = { ...defaultFrame(), A: null, I: null, E: null };
    expect(analyseSafely(bare).issues).toEqual([{ code: 'sections', count: 3 }]);
    const g = { ...bare, supports: [{ ...bare.supports[0], kind: 'pin' as const }, { ...bare.supports[1], kind: 'roller' as const }] };
    const simple = analyseSafely(g);
    expect(simple.results).not.toBeNull();
    expect(simple.results!.stiffness).toBe('none');
    expect(simple.results!.displacements).toBeNull();
    expect(simple.results!.maxDisplacement).toBeNull();
    expect(simple.drawing.deflected).toBeNull();
    expect(simple.warnings.map((w) => w.code)).toContain('no-stiffness');
    expect(simple.results!.members[0].deflection).toBeNull();
    expect(simple.results!.members[0].A).toBeNull();
    // The moments are those of statics: the pin–roller portal under the example's loads.
    expect(simple.results!.reactions[1].ry).toBeCloseTo(12 + (10 * 10) / 20, 6);
  });
  it('hinges are drawn at the member ends, pointing into the member, and a node whose rotation is free is marked', () => {
    const f = run(defaultFrame(), { type: 'template', template: 'gable', params: { hinge: true, base: 'pinned' } });
    const a2 = solved(f);
    expect(a2.drawing.hinges).toEqual([
      expect.objectContaining({ member: 3, end: 'end', node: 5, x: 20, y: 23 }),
      expect.objectContaining({ member: 4, end: 'start', node: 5, x: 20, y: 23 }),
    ]);
    expect(a2.drawing.nodes.find((n) => n.label === 5)!.rotationFree).toBe(true);
    expect(a2.drawing.nodes.find((n) => n.label === 1)!.rotationFree).toBe(false);
    expect(a2.results.displacements![4].rotation).toBeNull();
    expect(a2.warnings).toEqual([{ code: 'free-rotation', nodes: [5] }]);
    expect(a2.determinacy.word).toBe('determinate');
  });
  it('member loads are described for drawing: gravity points down on any member, a projected load keeps its direction, a couple has a turn', () => {
    const f = run(
      defaultFrame(),
      { type: 'add', list: 'memberLoads', seed: { kind: 'udl-projected', member: 5 } },
      { type: 'add', list: 'memberLoads', seed: { kind: 'point', member: 5 } },
      { type: 'add', list: 'memberLoads', seed: { kind: 'moment', member: 6 } },
      { type: 'add', list: 'memberLoads', seed: { kind: 'temperature', member: 6 } },
      { type: 'add', list: 'memberLoads', seed: { kind: 'trapezoid', member: 7, dir: 'local-y' } },
    );
    const a2 = solved(f);
    const ml = a2.drawing.memberLoads;
    expect(ml[1]).toMatchObject({ kind: 'udl-projected', member: 1, x1: 0, y1: 0, x2: 0, y2: 10, dx: 0, dy: -1 });
    expect(ml[2]).toMatchObject({ kind: 'point', x1: 0, y1: 5, x2: 0, y2: 5, dy: -1, v1: 10 });
    expect(ml[3]).toMatchObject({ kind: 'moment', turn: 1, dx: 0, dy: 0, x1: 20, y1: 5 });
    expect(ml[4]).toMatchObject({ kind: 'temperature', dx: 0, dy: 0, temperature: { dT: 50, dTg: 0 } });
    // A local-y load on the beam (left of 3→4 is up) with w < 0 pushes down: the arrow follows the sign.
    expect(ml[5]).toMatchObject({ kind: 'trapezoid', member: 3, dx: expect.closeTo(0, 12) as never, dy: -1, v1: 1, v2: 2, x1: 0, x2: 20 });
  });
});

describe('what is wrong with the frame, by row, in labels', () => {
  it('a number that is not a number is traced to the row and field, and labelled', () => {
    const a = analyseSafely(run(defaultFrame(), { type: 'patch', list: 'nodes', id: 3, patch: { y: Number.NaN } }));
    expect(a.results).toBeNull();
    expect(a.issues).toEqual([{ code: 'number', row: { list: 'nodes', id: 3, field: 'y' }, at: 3 }]);
    expect(a.drawing.members).toHaveLength(1);
    expect(a.drawing.nodes).toHaveLength(3);
  });
  it('a section, a position, a depth, a support, a load', () => {
    expect(analyseSafely({ ...defaultFrame(), I: 0 }).issues).toEqual([{ code: 'section', row: { list: 'model', field: 'I' } }]);
    const pos = analyseSafely(run(defaultFrame(), { type: 'add', list: 'memberLoads', seed: { kind: 'point', member: 7 } }, { type: 'patch', list: 'memberLoads', id: 12, patch: { a: 25 } }));
    expect(pos.issues).toEqual([{ code: 'load-position', row: { list: 'memberLoads', id: 12, field: 'a' }, at: 2, length: 20 }]);
    const depth = analyseSafely(run(defaultFrame(), { type: 'add', list: 'memberLoads', seed: { kind: 'temperature', member: 7 } }, { type: 'patch', list: 'memberLoads', id: 12, patch: { dTg: 10 } }));
    expect(depth.issues).toEqual([{ code: 'depth', row: { list: 'memberLoads', id: 12 }, at: 2, members: [3] }]);
    const dup = analyseSafely(run(defaultFrame(), { type: 'add', list: 'supports', seed: { node: 1 } }));
    expect(dup.issues).toEqual([{ code: 'duplicate-support', row: { list: 'supports', id: 12 }, at: 3, nodes: [1] }]);
  });
  it('a mechanism names the nodes (labels), the kind and how many; the determinacy word is "unstable", never a number that looks fine', () => {
    const a = analyseSafely(run(defaultFrame(), { type: 'template', template: 'portal', params: { base: 'pinned' } }, { type: 'patch', list: 'members', id: 7, patch: { hingeStart: true, hingeEnd: true } }));
    expect(a.issues).toEqual([{ code: 'mechanism', nodes: [3, 4], kind: 'sway', count: 1 }]);
    expect(a.determinacy.word).toBe('unstable');
    expect(a.determinacy).toMatchObject({ members: 3, reactions: 4, releases: 2, equations: 12, degree: -1 });
  });
  it('few supports and unrestrained carry their counts', () => {
    expect(analyseSafely({ ...defaultFrame(), supports: [] }).issues).toEqual([{ code: 'few-supports', count: 0 }]);
    const three = run(defaultFrame(), { type: 'template', template: 'l-frame', params: { base: 'pinned' } }, { type: 'patch', list: 'supports', id: 7, patch: { angle: (Math.atan2(10, 12) * 180) / Math.PI } });
    expect(analyseSafely(three).issues).toEqual([{ code: 'unrestrained', count: 1 }]);
  });
  it('three nodes at one place are ONE issue; two the arithmetic took for one only because the frame is huge are another', () => {
    const f = run(defaultFrame(), { type: 'add', list: 'nodes', seed: { x: 0, y: 0 } }, { type: 'add', list: 'nodes', seed: { x: 0, y: 0 } });
    const a = analyseSafely(f);
    expect(a.issues.filter((i) => i.code === 'duplicate-nodes')).toEqual([{ code: 'duplicate-nodes', nodes: [1, 5, 6] }]);
    expect(a.issues.filter((i) => i.code === 'node-unconnected').map((i) => i.nodes)).toEqual([[5], [6]]);
    const merged = mergeDuplicates([[0, 1]], [{ x: 0, y: 0 }, { x: 1e-3, y: 0 }, { x: 1e12, y: 0 }]);
    expect(merged).toEqual([{ code: 'scale', nodes: [1, 2], distance: 1e-3, size: 1e12 }]);
    expect(mergeDuplicates([[0, 1]], [{ x: 5, y: 5 }, { x: 5, y: 5 }])).toEqual([{ code: 'duplicate-node', nodes: [1, 2] }]);
  });
  it('too-big says which list and the cap; disconnected gives the groups in labels; duplicate-member the pair', () => {
    let f = emptyFrame();
    for (let k = 0; k < 51; k++) f = { ...f, nodes: [...f.nodes, { id: k + 1, x: k, y: 0 }], nextId: k + 2 };
    expect(analyseSafely(f).issues.find((i) => i.code === 'too-big')).toEqual({ code: 'too-big', row: { list: 'nodes', id: 1 }, at: 1, list: 'nodes', max: 50, count: 51 });
    const two = run(defaultFrame(), { type: 'remove', list: 'members', id: 7 });
    expect(analyseSafely(two).issues).toEqual([{ code: 'disconnected', groups: [[1, 3], [2, 4]] }]);
    const d = defaultFrame();
    const dup = { ...d, members: [...d.members, { id: 99, i: 4, j: 3, A: null, I: null, E: null, hingeStart: false, hingeEnd: false, h: null }] };
    expect(analyseSafely(dup).issues).toEqual([{ code: 'duplicate-member', row: { list: 'members', id: 99 }, at: 4, members: [3, 4] }]);
  });
  it('"unstable" is only said of a frame that does not stand: a moment on a free hinge, missing sections or a bad number leave the word empty', () => {
    const gable = run(defaultFrame(), { type: 'template', template: 'gable', params: { hinge: true, base: 'pinned' } });
    const hinge = analyseSafely(run(gable, { type: 'add', list: 'loads', seed: { node: 5, fx: 0, fy: 0, m: 10 } }));
    expect(hinge.issues).toEqual([{ code: 'hinged-joint-moment', nodes: [5] }]);
    expect(hinge.determinacy).toMatchObject({ degree: 0, freeJoints: 1, word: null });
    expect(analyseSafely({ ...defaultFrame(), I: null }).determinacy.word).toBeNull();
    expect(analyseSafely({ ...defaultFrame(), supports: [] }).determinacy.word).toBe('unstable');
    const four = run(defaultFrame(), { type: 'template', template: 'portal', params: { base: 'pinned' } }, { type: 'patch', list: 'members', id: 7, patch: { hingeStart: true, hingeEnd: true } });
    expect(analyseSafely(four).determinacy.word).toBe('unstable');
  });
  it('the counts are there even when the frame cannot be solved', () => {
    const a = analyseSafely(run(defaultFrame(), { type: 'patch', list: 'nodes', id: 3, patch: { y: Number.NaN } }));
    expect(a.determinacy).toEqual({ joints: 4, members: 3, reactions: 6, releases: 0, freeJoints: 0, equations: 12, degree: 3, word: null });
  });
});

describe('safety', () => {
  it('analyseSafely never throws and never returns a NaN, whatever the form: 3,000 random forms, a quarter of them with a field spoilt', () => {
    let solvedCount = 0;
    for (let seed = 1; seed <= 3000; seed++) {
      let f = randomForm(seed, 18);
      if (seed % 4 === 0 && f.nodes.length > 0) {
        const junk = [Number.NaN, Infinity, -Infinity, 1e300, -1e-300, 0][seed % 6];
        const n = f.nodes[seed % f.nodes.length];
        f = reduceFrame(f, { type: 'patch', list: 'nodes', id: n.id, patch: seed % 8 === 0 ? { x: junk } : { y: junk } });
        if (f.loads.length > 0) f = reduceFrame(f, { type: 'patch', list: 'loads', id: f.loads[0].id, patch: { fx: junk } });
      }
      const a = analyseSafely(f);
      expect(a.units).toBeDefined();
      expect(a.drawing).toBeDefined();
      if (a.results) {
        solvedCount++;
        const bad = numbers(a.results).filter(([, v]) => !Number.isFinite(v) || Object.is(v, -0));
        expect(bad, `seed ${seed}`).toEqual([]);
        const draw = numbers(a.drawing).filter(([, v]) => !Number.isFinite(v));
        expect(draw, `seed ${seed}`).toEqual([]);
      } else expect(a.issues.length, `seed ${seed}`).toBeGreaterThan(0);
    }
    expect(solvedCount).toBeGreaterThan(300);
  });
  it('a forest of random forms agrees with itself in the other unit system: the same issues, the same determinacy', () => {
    for (let seed = 1; seed <= 400; seed++) {
      const f = normal(randomForm(seed, 12));
      const a = analyseSafely(f);
      const b = analyseSafely(convertFrame(f, f.units === 'us' ? 'si' : 'us'));
      expect(b.issues.map((i) => i.code), `seed ${seed}`).toEqual(a.issues.map((i) => i.code));
      expect(b.determinacy, `seed ${seed}`).toEqual(a.determinacy);
    }
  });
  it('nice() picks the closest clean number', () => {
    expect(nice(14.2, [1, 1.5, 2, 2.5, 3, 4, 5, 6, 8])).toBe(15);
    expect(nice(0.0173, [1, 1.2, 1.5, 2, 2.5, 3, 4, 5, 6, 8])).toBe(0.015);
    expect(nice(7, [1, 1.2, 1.5, 2, 2.5, 3, 4, 5, 6, 8])).toBe(8);
    expect(nice(9.5, [1, 1.2, 1.5, 2, 2.5, 3, 4, 5, 6, 8])).toBe(10);
    expect(nice(0, [1, 2])).toBe(1);
    expect(nice(Number.NaN, [1, 2])).toBe(1);
  });
});
