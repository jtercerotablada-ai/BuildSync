import { afterEach, describe, expect, it, vi } from 'vitest';
import { analyse, analyseSafely, analyseStiffness, nice, settleSolution, stagesOf, symbolOf, type StiffnessAnalysis } from './analysis';
import { SUPPORT_SYMBOLS } from './codes';
import { solve } from './engine';
import { randomForm } from './forms.testlib';
import { convertStiffness, emptyStiffness, reduce, toEngine, type StiffnessForm } from './model';
import { rng } from './oracle.testlib';
import { TEMPLATE_IDS, type TemplateId } from './templates';
import { ZERO, type Block } from './types';

vi.setConfig({ testTimeout: 120_000 });
afterEach(() => new Promise((r) => setTimeout(r, 0)));

const ofTemplate = (template: TemplateId, units: 'us' | 'si' = 'us'): StiffnessForm => reduce(emptyStiffness(units), { type: 'template', template });
const edit = (f: StiffnessForm, a: Parameters<typeof reduce>[1]): StiffnessForm => reduce(f, a);

function nonFinite(value: unknown, path = ''): string | null {
  if (typeof value === 'number') return Number.isFinite(value) && !Object.is(value, -0) ? null : `${path} = ${value}`;
  if (Array.isArray(value)) {
    for (let k = 0; k < value.length; k++) {
      const r = nonFinite(value[k], `${path}[${k}]`);
      if (r) return r;
    }
    return null;
  }
  if (value && typeof value === 'object') {
    for (const [k, v] of Object.entries(value)) {
      const r = nonFinite(v, `${path}.${k}`);
      if (r) return r;
    }
  }
  return null;
}

describe('the example through the analysis', () => {
  const a = analyseSafely(ofTemplate('truss-two-bar'));
  it('is solved, with its counts and no fault', () => {
    expect(a.issues).toEqual([]);
    expect(a.warnings).toEqual([]);
    expect(a.counts).toEqual({ nodes: 3, members: 2, supports: 2, loads: 1, memberLoads: 0, dofs: 6, free: 2, restrained: 4 });
    expect(a.mode).toBe('truss');
    expect(a.units.displacement).toBe('in');
    expect(a.solution).not.toBeNull();
    expect(a.partial).toEqual([]);
    expect(analyse).toBe(analyseStiffness);
  });
  it('shows displacements in inches, with no rotation in a truss', () => {
    const d = a.results!.displacements;
    expect(d.map((x) => x.node)).toEqual([1, 2, 3]);
    expect(d[2].ux).toBeCloseTo(0.0064655, 6);
    expect(d[2].uy).toBeCloseTo(-0.0172414, 6);
    expect(d[2].magnitude).toBeCloseTo(Math.hypot(0.0064655, 0.0172414), 6);
    expect(d[2].rotation).toBeNull();
    expect(d[2].rotationDegrees).toBeNull();
    expect(d[0]).toEqual({ node: 1, ux: 0, uy: 0, magnitude: 0, rotation: null, rotationDegrees: null });
    expect(a.results!.maxDisplacement).toBeCloseTo(0.0184, 4);
  });
  it('shows the bars with their force, stress in ksi and elongation in inches', () => {
    const m = a.results!.members;
    expect(m[0].bar!.N).toBeCloseTo(-12.5, 9);
    expect(m[0].bar!.stress).toBeCloseTo(-1.25, 9);
    expect(m[1].bar!.stress).toBeCloseTo(-3.75, 9);
    expect(m[0].bar!.elongation).toBeCloseTo((-12.5 * 10 * 12) / 290000, 9);
    expect(m[0].bar!.state).toBe('compression');
    expect([m[0].length, m[0].c, m[0].s]).toEqual([10, expect.closeTo(0.8, 12), expect.closeTo(0.6, 12)]);
    expect([m[0].E, m[0].A, m[0].I]).toEqual([29000, 10, null]);
    expect(m[0].start.N).toBeCloseTo(-12.5, 9);
    expect(m[0].end.V).toBe(0);
  });
  it('groups the reactions by support, in the unit of the force', () => {
    expect(a.results!.reactions).toEqual([
      { label: 1, node: 1, rx: expect.closeTo(10, 9), ry: expect.closeTo(7.5, 9), rm: null, magnitude: expect.closeTo(12.5, 9) },
      { label: 2, node: 2, rx: expect.closeTo(-30, 9), ry: expect.closeTo(22.5, 9), rm: null, magnitude: expect.closeTo(37.5, 9) },
    ]);
  });
  it('says the structure is in equilibrium, with the sums', () => {
    const e = a.results!.equilibrium;
    expect(e.balanced).toBe(true);
    expect([e.sumFx, e.sumFy, e.sumM]).toEqual([0, 0, 0]);
    expect(e.applied).toEqual({ fx: 20, fy: -30, m: expect.closeTo(20 * -(6 - 3) + -30 * (8 - 8), 9) });
    expect(e.reacted.fx).toBeCloseTo(-20, 9);
    expect(e.reacted.fy).toBeCloseTo(30, 9);
    expect(e.reacted.m).toBeCloseTo(-e.applied.m, 9);
    expect(e.about).toEqual({ x: 8, y: 3 });
    expect(a.results!.checks.every((c) => c.ok)).toBe(true);
  });
  it('is the same in SI, in millimetres and megapascals', () => {
    const s = analyseSafely(convertStiffness(ofTemplate('truss-two-bar'), 'si'));
    expect(s.issues).toEqual([]);
    expect(s.units.displacement).toBe('mm');
    // 29,000 ksi is 200 GPa in the listed material: a slightly different modulus, so compare the shape of the answer
    expect(s.results!.members[0].bar!.N / s.results!.members[1].bar!.N).toBeCloseTo(a.results!.members[0].bar!.N / a.results!.members[1].bar!.N, 9);
    expect(s.results!.members[0].bar!.stress).toBeCloseTo((-12.5 * 4.4482216152605) / (10 * 25.4 * 25.4) * 1000, 6);
  });
});

describe('a frame through the analysis', () => {
  const a = analyseSafely(ofTemplate('frame-propped'));
  it('has rotations in radians and degrees, and moments at the ends of the member', () => {
    const d = a.results!.displacements;
    expect(d[1].rotation).toBeCloseTo((1.2 * 8000) / (48 * ((29000 * 144 * 600) / 20736)), 9);
    expect(d[1].rotationDegrees).toBeCloseTo((d[1].rotation! * 180) / Math.PI, 12);
    expect(d[0].rotation).toBe(0);
    const m = a.results!.members[0];
    expect(m.start).toEqual({ N: 0, V: expect.closeTo(15, 9), M: expect.closeTo(-60, 9) });
    expect(m.end).toEqual({ N: 0, V: expect.closeTo(-9, 9), M: 0 });
    expect(m.bar).toBeNull();
    expect(m.I).toBe(600);
  });
  it('gives the moment of a fixed support', () => {
    expect(a.results!.reactions[0]).toMatchObject({ label: 1, node: 1, rx: 0, ry: expect.closeTo(15, 9), rm: expect.closeTo(60, 9) });
    expect(a.results!.reactions[1]).toMatchObject({ label: 2, node: 2, rx: null, ry: expect.closeTo(9, 9), rm: null });
  });
  it('draws the beam as it bends: the UDL part and the end rotations, at its middle wL⁴/(192EI) down', () => {
    const def = a.drawing.deformed!;
    expect(def.factor).not.toBeNull();
    const pts = def.members[0].points;
    expect(pts).toHaveLength(17);
    expect(pts[0]).toEqual({ x: 0, y: 0 });
    // the end is the displaced node
    expect(pts[16].x).toBeCloseTo(def.nodes[1].x, 12);
    expect(pts[16].y).toBeCloseTo(def.nodes[1].y, 12);
    const EI = (29000 * 144 * 600) / 20736;
    const drop = (1.2 * 20 ** 4) / (192 * EI);
    expect(pts[8].x).toBeCloseTo(10, 6);
    expect(pts[8].y).toBeCloseTo(-def.factor! * drop, 9);
  });
  it('draws a fixed-fixed beam under a point load, though no node moves: the deflection at 7.5 ft is Pb²x²(3aL − 3ax − bx)/(6EIL³)', () => {
    const f = analyseSafely(ofTemplate('frame-fixed-point'));
    const def = f.drawing.deformed!;
    expect(def.factor).not.toBeNull();
    expect(def.nodes.map((n) => [n.x, n.y])).toEqual([[0, 0], [20, 0]]);
    const EI = (29000 * 144 * 600) / 20736;
    const [P, a, b, L, x] = [20, 8, 12, 20, 7.5];
    const drop = (P * b * b * x * x * (3 * a * L - 3 * a * x - b * x)) / (6 * EI * L ** 3);
    const pts = def.members[0].points;
    expect(pts).toHaveLength(17);
    expect(pts[6].x).toBeCloseTo(7.5, 9);
    expect(pts[6].y).toBeCloseTo(-def.factor! * drop, 9);
    // the other segment: x = 11.25 ft, y = Pa²(L − x)²(3bL − (L − x)(3b + a))/(6EIL³)
    const y2 = (P * a * a * (L - 11.25) ** 2 * (3 * b * L - (L - 11.25) * (3 * b + a))) / (6 * EI * L ** 3);
    expect(pts[9].x).toBeCloseTo(11.25, 9);
    expect(pts[9].y).toBeCloseTo(-def.factor! * y2, 9);
    // the largest drawn deflection is the largest of the curve (the closed form, scanned)
    const curve = (xx: number) => (xx <= a ? (P * b * b * xx * xx * (3 * a * L - xx * (3 * a + b))) / (6 * EI * L ** 3) : (P * a * a * (L - xx) ** 2 * (3 * b * L - (L - xx) * (3 * b + a))) / (6 * EI * L ** 3));
    let top = 0;
    for (let q = 0; q <= 2000; q++) top = Math.max(top, curve((L * q) / 2000));
    expect(def.maxDisplacement / 12).toBeLessThanOrEqual(top * 1.0000001);
    expect(def.maxDisplacement / 12).toBeGreaterThan(top * 0.97);
    // the table has no displacement to show
    expect(f.results!.maxDisplacement).toBe(0);
  });
  it('the fixed-fixed beam on two spans bends where a nodal load pushes it', () => {
    // a beam of two members, fixed at both ends, a load at the middle node: v(L/2) = PL³/(192EI)
    let f = reduce(emptyStiffness(), { type: 'template', template: 'frame-propped' });
    f = reduce(f, { type: 'clear' });
    f = reduce(f, { type: 'add', list: 'nodes', seed: { x: 0, y: 0 } });
    f = reduce(f, { type: 'add', list: 'nodes', seed: { x: 10, y: 0 } });
    f = reduce(f, { type: 'add', list: 'nodes', seed: { x: 20, y: 0 } });
    f = reduce(f, { type: 'add', list: 'members', seed: { i: f.nodes[0].id, j: f.nodes[1].id } });
    f = reduce(f, { type: 'add', list: 'members', seed: { i: f.nodes[1].id, j: f.nodes[2].id } });
    f = reduce(f, { type: 'add', list: 'supports', seed: { node: f.nodes[0].id, preset: 'fixed' } });
    f = reduce(f, { type: 'add', list: 'supports', seed: { node: f.nodes[2].id, preset: 'fixed' } });
    f = reduce(f, { type: 'add', list: 'loads', seed: { node: f.nodes[1].id, fy: -10 } });
    const a2 = analyseSafely(f);
    expect(a2.issues).toEqual([]);
    const EI = (29000 * 144 * 100) / 20736;
    void EI;
    const sol = a2.solution!;
    // by hand with I = 100 in⁴: v = PL³/(192 EI), L = 20 ft
    const ei = (29000 * 144 * f.I!) / 20736;
    expect(sol.u[4]).toBeCloseTo(-(10 * 8000) / (192 * ei), 9);
  });
});

describe('the stages', () => {
  it('group the steps by their number, in order: fourteen for a loaded frame, every step in exactly one', () => {
    const a = analyseSafely(ofTemplate('frame-l'));
    const stages = stagesOf(a.solution!.steps);
    expect(stages.map((s) => s.number)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14]);
    expect(stages.flatMap((s) => s.steps)).toEqual(a.solution!.steps);
    expect(stages[1].steps.map((s) => s.key)).toEqual(['geometry#1', 'geometry#2']);
    expect(stages[5].steps.map((s) => s.key)).toEqual(['assembly#1', 'assembly#2', 'assembled']);
    expect(stages[6].steps.map((s) => s.key)).toEqual(['nodal-loads', 'member-loads#2', 'load-vector']);
    expect(stagesOf([])).toEqual([]);
  });
});

describe('determinacy, by counting', () => {
  it('the templates are what their books say: 0, 1, 0 for the trusses; 1, 0, 3, 3 for the frames', () => {
    const word = (template: TemplateId) => analyseSafely(ofTemplate(template)).determinacy;
    expect(word('truss-two-bar')).toEqual({ members: 2, joints: 3, reactions: 4, degree: 0, word: 'determinate' });
    expect(word('truss-three-bar')).toEqual({ members: 3, joints: 4, reactions: 6, degree: 1, word: 'indeterminate' });
    expect(word('truss-five-member')).toMatchObject({ degree: 0, word: 'determinate' });
    expect(word('frame-propped')).toMatchObject({ degree: 1, word: 'indeterminate' });
    expect(word('frame-l')).toMatchObject({ degree: 0, word: 'determinate' });
    expect(word('frame-portal')).toMatchObject({ degree: 3, word: 'indeterminate' });
    expect(word('frame-fixed-point')).toMatchObject({ degree: 3, word: 'indeterminate' });
  });
  it('a mechanism or too few supports is unstable; a fault before the count says nothing', () => {
    let f = ofTemplate('truss-five-member');
    f = edit(f, { type: 'remove', list: 'members', id: f.members[1].id });
    expect(analyseSafely(f).determinacy.word).toBe('unstable');
    expect(analyseSafely({ ...ofTemplate('truss-two-bar'), supports: [] }).determinacy.word).toBe('unstable');
    expect(analyseSafely(edit(ofTemplate('truss-two-bar'), { type: 'patch', list: 'loads', id: 9, patch: {} })).determinacy.word).toBe('determinate');
    expect(analyseSafely(edit(ofTemplate('truss-two-bar'), { type: 'section', patch: { E: Number.NaN } })).determinacy.word).toBeNull();
    expect(analyseSafely(emptyStiffness()).determinacy.word).toBeNull();
  });
  it('is counted by the supports as they stand, and a frame counts three to a member', () => {
    const f = ofTemplate('frame-propped');
    const a = analyseSafely(edit(f, { type: 'patch', list: 'supports', id: f.supports[1].id, patch: { rz: true } }));
    expect(a.determinacy).toMatchObject({ reactions: 5, degree: 2, word: 'indeterminate' });
  });
});

describe('the exaggeration', () => {
  it('is a clean number that draws the largest displacement at 5 to 8 % of the larger side, and is stated', () => {
    for (const template of TEMPLATE_IDS) {
      const a = analyseSafely(ofTemplate(template));
      const def = a.drawing.deformed!;
      if (def.factor === null) continue;
      const mantissa = def.factor / 10 ** Math.floor(Math.log10(def.factor));
      expect([1, 1.5, 2, 2.5, 3, 4, 5, 6, 8, 10]).toContain(Number(mantissa.toPrecision(6)));
      expect(def.share!).toBeGreaterThan(0.04);
      expect(def.share!).toBeLessThan(0.09);
      // the displaced nodes are the nodes plus factor times the displacement
      a.solution!.nodes.forEach((n, k) => {
        expect(def.nodes[k].x).toBeCloseTo(n.x + def.factor! * a.solution!.u[n.dofs[0] - 1], 9);
        expect(def.nodes[k].y).toBeCloseTo(n.y + def.factor! * a.solution!.u[n.dofs[1] - 1], 9);
      });
    }
  });
  it('is null when nothing moves, and nice() is clean', () => {
    const a = analyseSafely(edit(ofTemplate('truss-two-bar'), { type: 'clear' }));
    expect(a.drawing.deformed).toBeNull();
    const noLoad = analyseSafely({ ...ofTemplate('truss-two-bar'), loads: [] });
    expect(noLoad.drawing.deformed!.factor).toBeNull();
    expect(noLoad.warnings).toEqual([{ code: 'no-load' }]);
    expect(noLoad.results!.maxDisplacement).toBe(0);
    expect(nice(0.0123, [1, 1.5, 2, 2.5, 3, 4, 5, 6, 8])).toBe(0.015);
    expect(nice(7, [1, 1.5, 2, 2.5, 3, 4, 5, 6, 8])).toBe(8);
    expect(nice(0)).toBe(1);
    expect(nice(Number.NaN)).toBe(1);
  });
});

describe('the drawing', () => {
  const frame = analyseSafely(ofTemplate('frame-portal'));
  it('carries the nodes with their DOF numbers and which are restrained, the members with their code, the supports with their symbol', () => {
    const d = frame.drawing;
    expect(d.nodes.map((n) => [n.label, n.x, n.y])).toEqual([[1, 0, 0], [2, 20, 0], [3, 0, 10], [4, 20, 10]]);
    expect(d.nodes[0]).toMatchObject({ dofs: [1, 2, 3], dofLabels: ['1x', '1y', '1θ'], restrained: [true, true, true] });
    expect(d.nodes[2]).toMatchObject({ dofs: [7, 8, 9], restrained: [false, false, false] });
    expect(d.members.map((m) => m.code)).toEqual([[1, 2, 3, 7, 8, 9], [4, 5, 6, 10, 11, 12], [7, 8, 9, 10, 11, 12]]);
    expect(d.members[2]).toMatchObject({ label: 3, i: 3, j: 4, x1: 0, y1: 10, x2: 20, y2: 10, length: 20 });
    expect(d.supports.map((s) => s.symbol)).toEqual(['fixed', 'fixed']);
    expect(d.box).toEqual({ x0: 0, y0: 0, x1: 20, y1: 10, width: 20, height: 10 });
    expect(d.side).toBe(20);
    expect(d.pad).toBeCloseTo(2.8, 9);
    expect(d.frame.width).toBeCloseTo(25.6, 9);
  });
  it('carries the loads as arrows, with their share of the largest', () => {
    const d = frame.drawing;
    expect(d.loads).toEqual([{ label: 1, node: 3, x: 0, y: 10, fx: 10, fy: 0, m: 0, magnitude: 10, dx: 1, dy: 0, share: 1 }]);
    const t = analyseSafely(ofTemplate('truss-five-member')).drawing.loads;
    expect(t.map((l) => l.share)).toEqual([expect.closeTo(12 / 15, 12), 1]);
  });
  it('carries the member loads with their direction for a positive value and their share', () => {
    const d = analyseSafely(ofTemplate('frame-l')).drawing;
    expect(d.memberLoads).toHaveLength(1);
    expect(d.memberLoads[0]).toMatchObject({ label: 1, member: 2, kind: 'udl', value: -1, a: 0, b: 10, x1: 0, y1: 12, x2: 10, y2: 12, dx: 0, dy: 1, share: 1 });
    // a point load is at one place
    const p = analyseSafely(ofTemplate('frame-fixed-point')).drawing.memberLoads[0];
    expect(p).toMatchObject({ kind: 'point', a: 8, b: 8, x1: 8, x2: 8, y1: 0, value: -20 });
    // an axial load pushes along the member
    let f = ofTemplate('frame-propped');
    f = edit(f, { type: 'add', list: 'memberLoads', seed: { kind: 'axial', q: 2 } });
    const ax = analyseSafely(f).drawing.memberLoads.find((l) => l.kind === 'axial')!;
    expect([ax.dx, ax.dy]).toEqual([1, 0]);
    // a truss has none, whatever the form holds
    expect(analyseSafely(reduce(ofTemplate('frame-l'), { type: 'mode', mode: 'truss' })).drawing.memberLoads).toEqual([]);
  });
  it('carries the reactions as arrows with their moment', () => {
    const r = frame.drawing.reactions;
    expect(r.map((x) => x.node)).toEqual([1, 2]);
    expect(r[0].rm).toBeGreaterThan(0);
    expect(r.every((x) => x.share <= 1 && x.share >= 0)).toBe(true);
    expect(Math.max(...r.map((x) => x.share))).toBe(1);
    expect(Math.hypot(r[0].dx, r[0].dy)).toBeCloseTo(1, 12);
  });
  it('names a support by what it restrains', () => {
    expect(symbolOf({ ux: true, uy: true, rz: true }, 'frame')).toBe('fixed');
    expect(symbolOf({ ux: true, uy: true, rz: false }, 'frame')).toBe('pin');
    expect(symbolOf({ ux: false, uy: true, rz: false }, 'frame')).toBe('roller-y');
    expect(symbolOf({ ux: true, uy: false, rz: false }, 'frame')).toBe('roller-x');
    expect(symbolOf({ ux: false, uy: true, rz: true }, 'frame')).toBe('guide-y');
    expect(symbolOf({ ux: true, uy: false, rz: true }, 'frame')).toBe('guide-x');
    expect(symbolOf({ ux: false, uy: false, rz: true }, 'frame')).toBe('rotation');
    expect(symbolOf({ ux: false, uy: false, rz: false }, 'frame')).toBe('none');
    // a truss has no rotation to restrain
    expect(symbolOf({ ux: true, uy: true, rz: true }, 'truss')).toBe('pin');
    expect(symbolOf({ ux: false, uy: false, rz: true }, 'truss')).toBe('none');
    const seen = new Set(
      [true, false].flatMap((ux) => [true, false].flatMap((uy) => [true, false].flatMap((rz) => symbolOf({ ux, uy, rz }, 'frame')))),
    );
    expect([...seen].sort()).toEqual([...SUPPORT_SYMBOLS].sort());
  });
  it('carries a settlement of a support in the unit shown, only on a restrained DOF', () => {
    let f = ofTemplate('frame-propped');
    f = edit(f, { type: 'patch', list: 'supports', id: f.supports[1].id, patch: { dy: -0.5, dx: 3 } });
    const s = analyseSafely(f).drawing.supports;
    expect(s[0].settle).toBeNull();
    expect(s[1].settle).toEqual({ dx: 0, dy: -0.5, dr: 0 });
  });
});

describe('the faults, by row', () => {
  it('say which row and its label, and carry the numbers', () => {
    let f = ofTemplate('truss-two-bar');
    f = edit(f, { type: 'patch', list: 'members', id: f.members[1].id, patch: { A: -2 } });
    const a = analyseSafely(f);
    expect(a.issues).toEqual([{ code: 'section', row: { list: 'members', id: f.members[1].id, field: 'A' }, at: 2 }]);
    expect(a.results).toBeNull();
    expect(a.drawing.nodes).toHaveLength(3);
    expect(a.counts.dofs).toBe(6);
  });
  it('a mechanism names its DOF by label, the nodes that move and the shape; the steps up to the zero pivot come with it, settled', () => {
    let f = ofTemplate('truss-five-member');
    f = edit(f, { type: 'remove', list: 'members', id: f.members[1].id });
    const a = analyseSafely(f);
    const m = a.issues.find((i) => i.code === 'mechanism')!;
    expect(m.dofLabel).toMatch(/^[1-4][xy]$/);
    expect(m.nodes!.length).toBeGreaterThan(0);
    expect(m.shape).toHaveLength(8);
    expect(a.partial.map((s) => s.id)).toContain('assembled');
    expect(nonFinite(a.partial)).toBeNull();
  });
  it('a fault in a hand-made form that no row can be told for is still said', () => {
    const a = analyseSafely({ ...ofTemplate('truss-two-bar'), members: [] });
    expect(a.issues).toEqual([{ code: 'no-members' }]);
    expect(a.counts).toMatchObject({ members: 0, nodes: 3 });
  });
});

describe('the settling', () => {
  it('prints no −0 and no rounding beside a real zero: every block of every step of every template', () => {
    for (const template of TEMPLATE_IDS) {
      for (const units of ['us', 'si'] as const) {
        const a = analyseSafely(ofTemplate(template, units));
        expect(nonFinite(a.results), template).toBeNull();
        expect(nonFinite(a.solution!.steps), template).toBeNull();
        for (const step of a.solution!.steps) {
          if (step.id === 'structure' || step.id === 'checks' || step.id === 'solution') continue;
          for (const b of step.blocks) {
            if (b.type === 'scalar') continue;
            if (b.type === 'matrix' && b.name === 'ends') continue;
            const values = b.type === 'vector' ? b.values : b.values.flat();
            const top = Math.max(0, ...values.map(Math.abs));
            for (const v of values) expect(v === 0 || Math.abs(v) > ZERO * top, `${template} ${step.key} ${b.name}: ${v} of ${top}`).toBe(true);
          }
        }
      }
    }
  });
  it('a symmetric structure has exact zeros where the symmetry says so: the free node of the three-bar truss does not move sideways', () => {
    const a = analyseSafely(ofTemplate('truss-three-bar'));
    expect(a.results!.displacements[3].ux).toBe(0);
    expect(a.solution!.u[6]).toBe(0);
    expect(a.results!.reactions[1].rx).toBe(0);
  });
  it('the tables and the steps are the same numbers', () => {
    for (const template of TEMPLATE_IDS) {
      const a = analyseSafely(ofTemplate(template));
      const s = a.solution!;
      const u = s.steps.find((x) => x.key === 'displacements')!.blocks[0];
      expect(u.type === 'vector' && u.values).toEqual(s.u);
      a.results!.displacements.forEach((d, k) => {
        expect(d.ux).toBeCloseTo(s.u[s.nodes[k].dofs[0] - 1] * 12, 12);
      });
      const R = s.steps.find((x) => x.key === 'reactions')!.blocks.find((b) => b.name === 'R')!;
      expect(R.type === 'vector' && R.values).toEqual(s.reactions.map((r) => r.value));
      s.forces.forEach((f, k) => {
        const ends = s.steps.find((x) => x.key === `end-forces#${k + 1}`)!.blocks.find((b) => b.name === 'ends');
        if (ends?.type === 'matrix') expect(ends.values).toEqual([[f.start.N, f.end.N], [f.start.V, f.end.V], [f.start.M, f.end.M]]);
      });
    }
  });
  it('the settled solution is the engine solution with its small entries zero, and nothing else changed', () => {
    const form = ofTemplate('frame-portal');
    const raw = solve(toEngine(form).model);
    if (!raw.ok) throw new Error('x');
    const set = settleSolution(raw);
    expect(set.steps.map((s) => s.key)).toEqual(raw.steps.map((s) => s.key));
    raw.steps.forEach((step, k) => {
      expect(set.steps[k].facts).toEqual(step.facts);
      expect(set.steps[k].formulas).toEqual(step.formulas);
      expect(set.steps[k].from).toEqual(step.from);
      step.blocks.forEach((b: Block, q) => {
        const c = set.steps[k].blocks[q];
        expect(c.type).toBe(b.type);
        expect(c.name).toBe(b.name);
        if (b.type === 'matrix' && c.type === 'matrix') {
          expect(c.rowLabels).toEqual(b.rowLabels);
          expect(c.symbolic).toEqual(b.symbolic);
          expect(c.highlights).toEqual(b.highlights);
          const top = Math.max(0, ...b.values.flat().map(Math.abs));
          c.values.forEach((row, r) => row.forEach((v, cc) => expect(Math.abs(v - b.values[r][cc])).toBeLessThanOrEqual(1e-9 * top + 1e-300)));
        }
      });
    });
    // the raw one is untouched
    expect(raw.steps.length).toBe(set.steps.length);
  });
});

describe('totality: whatever the form holds', () => {
  it('300 random forms: no throw, a drawing and results with no NaN, no Infinity and no −0', () => {
    for (let seed = 1; seed <= 300; seed++) {
      const form = randomForm(seed, 30);
      const a = analyseSafely(form);
      expect(nonFinite(a.drawing), `#${seed} drawing`).toBeNull();
      expect(nonFinite(a.results), `#${seed} results`).toBeNull();
      expect(nonFinite(a.counts)).toBeNull();
      if (a.solution) expect(a.issues).toEqual([]);
      else expect(a.issues.length).toBeGreaterThan(0);
    }
  });
  it('junk in every field of the example: NaN, Infinity, 1e17, 40-digit numbers, negative zero', () => {
    const junk = [Number.NaN, Infinity, -Infinity, 1e17, -1e17, 1e39, -1e39, 1.2345678901234567e39, 1e-300, 1e300, -0, 0];
    const r = rng(77);
    let solved = 0;
    for (let k = 0; k < 600; k++) {
      let f: StiffnessForm = ofTemplate(TEMPLATE_IDS[k % TEMPLATE_IDS.length], k % 2 === 0 ? 'us' : 'si');
      const edits = 1 + Math.floor(r() * 4);
      for (let e = 0; e < edits; e++) {
        const list = (['nodes', 'members', 'supports', 'loads', 'memberLoads'] as const)[Math.floor(r() * 5)];
        const rows = f[list] as { id: number }[];
        if (rows.length === 0) continue;
        const row = rows[Math.floor(r() * rows.length)];
        const numeric = Object.keys(row).filter((key) => typeof (row as unknown as Record<string, unknown>)[key] === 'number' && !['id', 'i', 'j', 'node', 'member'].includes(key));
        if (numeric.length === 0) continue;
        f = reduce(f, { type: 'patch', list, id: row.id, patch: { [numeric[Math.floor(r() * numeric.length)]]: junk[Math.floor(r() * junk.length)] } });
      }
      if (r() < 0.3) f = reduce(f, { type: 'section', patch: { E: junk[Math.floor(r() * junk.length)], A: junk[Math.floor(r() * junk.length)] } });
      const a = analyseSafely(f);
      expect(nonFinite(a.drawing), `#${k} drawing`).toBeNull();
      expect(nonFinite(a.results), `#${k} results`).toBeNull();
      expect(nonFinite(a.solution?.steps ?? []), `#${k} steps`).toBeNull();
      if (a.solution) solved++;
    }
    expect(solved).toBeGreaterThan(30);
  });
  it('a structure 1e17 ft across is solved, drawn and exaggerated in bounded work', () => {
    let f = ofTemplate('truss-two-bar');
    f = { ...f, nodes: f.nodes.map((n) => ({ ...n, x: n.x * 1e16, y: n.y * 1e16 })) };
    const a = analyseSafely(f);
    expect(a.issues).toEqual([]);
    expect(nonFinite(a.drawing)).toBeNull();
    expect(nonFinite(a.results)).toBeNull();
    expect(a.drawing.side).toBe(1.6e17);
    expect(a.drawing.deformed!.factor).not.toBeNull();
    // and one with a load of 1e17
    const g = analyseSafely({ ...ofTemplate('frame-portal'), loads: [{ id: 99, node: 3, fx: 1e17, fy: -1e17, m: 1e17 }] });
    expect(g.issues).toEqual([]);
    expect(nonFinite(g.results)).toBeNull();
    expect(g.results!.equilibrium.balanced).toBe(true);
  });
  it('a 40-digit number typed into a field is a number too big, said against its row', () => {
    const f = edit(ofTemplate('truss-two-bar'), { type: 'patch', list: 'nodes', id: 3, patch: { x: Number('1234567890123456789012345678901234567890') } });
    const a = analyseSafely(f);
    expect(a.issues).toEqual([{ code: 'number', row: { list: 'nodes', id: 3, field: 'x' }, at: 3 }]);
    expect(nonFinite(a.drawing)).toBeNull();
  });
  it('an empty form is drawn as an empty page, with a frame to draw in', () => {
    const a = analyseSafely(emptyStiffness());
    expect(a.drawing.nodes).toEqual([]);
    expect(a.drawing.frame.width).toBe(0);
    expect(a.issues[0]).toEqual({ code: 'few-nodes', count: 0 });
  });
  it('analyseSafely survives a form that throws when it is read', () => {
    const bad = { ...ofTemplate('truss-two-bar') };
    Object.defineProperty(bad, 'nodes', {
      get() {
        throw new Error('boom');
      },
    });
    const a = analyseSafely(bad as StiffnessForm);
    expect(a.issues).toEqual([{ code: 'stopped' }]);
    expect(a.solution).toBeNull();
    expect(a.drawing.frame.width).toBe(2);
  });
  it('is quick enough to run at every key: the largest structure (12 nodes, 20 members, 36 DOFs) in well under half a second (about 15 ms on a quiet machine)', () => {
    let f = emptyStiffness('us', 'frame');
    for (let k = 0; k < 12; k++) f = reduce(f, { type: 'add', list: 'nodes', seed: { x: (k % 4) * 10, y: Math.floor(k / 4) * 10 } });
    const ids = f.nodes.map((n) => n.id);
    const pairs: [number, number][] = [[0, 5], [1, 6], [2, 7]];
    for (let r = 0; r < 3; r++) for (let c = 0; c < 4; c++) {
      const a = r * 4 + c;
      if (c < 3) pairs.push([a, a + 1]);
      if (r < 2) pairs.push([a, a + 4]);
    }
    for (const [a, b] of pairs.slice(0, 20)) f = reduce(f, { type: 'add', list: 'members', seed: { i: ids[a], j: ids[b] } });
    f = reduce(f, { type: 'add', list: 'supports', seed: { node: ids[0], preset: 'fixed' } });
    for (let k = 0; k < 12; k++) f = reduce(f, { type: 'add', list: 'loads', seed: { node: ids[k], fx: k, fy: -10 } });
    for (let k = 0; k < 20; k++) f = reduce(f, { type: 'add', list: 'memberLoads', seed: { member: f.members[k].id, kind: 'udl', w: -1 } });
    expect([f.nodes.length, f.members.length, f.memberLoads.length]).toEqual([12, 20, 20]);
    const t0 = performance.now();
    let a: StiffnessAnalysis = analyseSafely(f);
    for (let k = 0; k < 9; k++) a = analyseSafely(f);
    const each = (performance.now() - t0) / 10;
    expect(a.issues).toEqual([]);
    expect(a.solution!.free).toHaveLength(33);
    expect(a.solution!.steps.length).toBeGreaterThan(140);
    expect(each).toBeLessThan(500);
  });
});
