import { describe, expect, it } from 'vitest';
import { TOLERANCES, analyseSafely } from './analysis';
import { solve } from './engine';
import { randomForm } from './forms.testlib';
import { CALCULATION_UNITS, choicesOf, emptyStiffness, reduce, toEngine, unitOf, type StiffnessForm } from './model';
import { exactSolve } from './bigoracle.testlib';
import { AGREE, ASSEMBLY, EPSILON, EPSILON_DD, LARGE, LIMIT, NEAR, RECORD_LIMIT, RESIDUAL, RESOLVE, RIGID, ROUNDING, SHORT, STRAIN, WEAK, ZERO, dofKind, type StiffnessModel } from './types';

describe('the units of an entry', () => {
  it('follow from the kinds of its DOFs', () => {
    expect(unitOf('us', 'stiffness', 'x', 'y')).toBe('kip/ft');
    expect(unitOf('us', 'stiffness', 'y', 'θ')).toBe('kip/rad');
    expect(unitOf('us', 'stiffness', 'θ', 'x')).toBe('kip/rad');
    expect(unitOf('us', 'stiffness', 'θ', 'θ')).toBe('kip·ft/rad');
    expect(unitOf('si', 'stiffness', 'x', 'x')).toBe('kN/m');
    expect(unitOf('si', 'stiffness', 'θ', 'θ')).toBe('kN·m/rad');
    expect(unitOf('us', 'displacement', 'x')).toBe('ft');
    expect(unitOf('us', 'displacement', 'θ')).toBe('rad');
    expect(unitOf('si', 'displacement', 'y')).toBe('m');
    expect(unitOf('us', 'force', 'y')).toBe('kip');
    expect(unitOf('us', 'force', 'θ')).toBe('kip·ft');
    expect(unitOf('si', 'force', 'θ')).toBe('kN·m');
    // a DOF label says its kind
    expect(['1x', '12y', '3θ'].map(dofKind)).toEqual(['x', 'y', 'θ']);
    expect(CALCULATION_UNITS.us.E).toBe('kip/ft²');
    expect(CALCULATION_UNITS.si.inertia).toBe('m⁴');
  });
  it('the step numbers are in those units: a stiffness entry of two translations is EA/L in kip/ft', () => {
    const out = solve(toEngine(reduce(emptyStiffness(), { type: 'template', template: 'truss-two-bar' })).model);
    if (!out.ok) throw new Error('x');
    const k = out.steps.find((s) => s.key === 'local-stiffness#1')!.blocks[0];
    if (k.type !== 'matrix') throw new Error('x');
    expect(k.values[0][0]).toBe(29000); // kip/ft: 29,000 ksi × 10 in² = 290,000 kip over 10 ft
  });
});

describe('the choices of a form', () => {
  it('a number typed changes nothing; a restraint, a mode, units, material, a kind, a reference, a blank section or a row does', () => {
    const base = reduce(emptyStiffness(), { type: 'template', template: 'frame-propped' });
    const same = [
      reduce(base, { type: 'patch', list: 'nodes', id: base.nodes[1].id, patch: { x: 33 } }),
      reduce(base, { type: 'patch', list: 'memberLoads', id: base.memberLoads[0].id, patch: { w: -9 } }),
      reduce(base, { type: 'patch', list: 'supports', id: base.supports[0].id, patch: { dy: 2 } }),
      reduce(base, { type: 'section', patch: { A: 99 } }),
      reduce(base, { type: 'add', list: 'nodes' }) === base ? base : { ...base, notice: { code: 'limit' as const, list: 'nodes' as const, max: 12 } },
    ];
    for (const f of same.slice(0, 4)) expect(choicesOf(f)).toBe(choicesOf(base));
    expect(choicesOf(same[4])).toBe(choicesOf(base));
    const different = [
      reduce(base, { type: 'mode', mode: 'truss' }),
      reduce(base, { type: 'units', units: 'si' }),
      reduce(base, { type: 'material', material: 'aluminum' }),
      reduce(base, { type: 'patch', list: 'supports', id: base.supports[1].id, patch: { rz: true } }),
      reduce(base, { type: 'patch', list: 'memberLoads', id: base.memberLoads[0].id, patch: { kind: 'point' } }),
      reduce(base, { type: 'section', patch: { I: null } }),
      reduce(base, { type: 'add', list: 'nodes' }),
      reduce(base, { type: 'remove', list: 'loads', id: 999 }) === base ? reduce(base, { type: 'add', list: 'loads' }) : base,
      reduce(reduce(base, { type: 'add', list: 'nodes' }), { type: 'patch', list: 'members', id: base.members[0].id, patch: { j: 7 } }) === base ? base : reduce(reduce(base, { type: 'add', list: 'nodes' }), { type: 'patch', list: 'members', id: base.members[0].id, patch: { j: base.nodes[0].id } }),
    ];
    for (const f of different) expect(choicesOf(f)).not.toBe(choicesOf(base));
  });
  it('a hundred random edits of numbers leave the choices as they were', () => {
    for (let seed = 1; seed <= 100; seed++) {
      const f = randomForm(seed);
      let g: StiffnessForm = f;
      for (const n of f.nodes) g = reduce(g, { type: 'patch', list: 'nodes', id: n.id, patch: { x: seed * 1.5, y: -seed } });
      for (const l of f.loads) g = reduce(g, { type: 'patch', list: 'loads', id: l.id, patch: { fx: 12.5, fy: -3 } });
      expect(choicesOf(g)).toBe(choicesOf(f));
    }
  });
});

describe('the tolerances', () => {
  it('are written once and handed to the copy as the engine uses them', () => {
    expect(TOLERANCES).toEqual({ resolve: RESOLVE, weak: WEAK, strain: STRAIN, residual: RESIDUAL, zero: ZERO, agree: AGREE, near: NEAR, short: SHORT, rigid: RIGID, large: LARGE, limit: LIMIT, record: RECORD_LIMIT, rounding: ROUNDING });
    expect([RESOLVE, WEAK, STRAIN, RESIDUAL, ZERO, AGREE, NEAR, SHORT, RIGID, LARGE, LIMIT, RECORD_LIMIT]).toEqual([0.1, 1e-6, 1e-6, 1e-8, 1e-9, 1e-12, 1e-9, 1e-5, 1e-6, 0.1, 1e30, 12]);
    // the arithmetic's own constants: one rounding of a double, one of the 32-digit arithmetic the engine works in, the roundings assumed in one entry of a member's matrix, and the allowance of a check
    expect([EPSILON, EPSILON_DD, ASSEMBLY, ROUNDING]).toEqual([2 ** -52, 2 ** -100, 8, 100]);
    // one list: the old pivot-over-diagonal tolerance is gone, and nothing else in it is called singular
    expect(Object.keys(TOLERANCES)).not.toContain('singular');
  });
  it('a pivot is judged against the rounding of the terms that made it, not against the stiffness its DOF started with: two bars into one free node an angle δ apart (a pivot of about δ² of the diagonal) are a stable structure until the pivot is lost in its rounding, which in thirty figures is a hundred trillion trillionth of it', () => {
    // two bars on a line at 45° (one that is tilted: nothing in it is exactly zero), the free joint `e` off the line along the other diagonal: the stiffness across them is (e/L)² of the stiffness along them
    const model = (e: number): StiffnessModel => ({
      mode: 'truss',
      nodes: [{ x: 0, y: 0 }, { x: 20, y: 20 }, { x: 10 + e, y: 10 - e }],
      members: [{ i: 0, j: 2 }, { i: 1, j: 2 }],
      supports: [{ node: 0, ux: true, uy: true, rz: false }, { node: 1, ux: true, uy: true, rz: false }],
      loads: [{ node: 2, fx: 0, fy: -1, m: 0 }],
      memberLoads: [],
      E: 1000,
      A: 1,
    });
    // 1e-8 off the line: a pivot of 1e-18 of its diagonal. It is stable, it is solved without a word about figures (thirty are worked), and it is exact to the figures the double holds
    for (const e of [1e-4, 1e-8]) {
      const out = solve(model(e));
      expect(out.ok, `e = ${e}`).toBe(true);
      if (!out.ok) continue;
      expect(out.warnings.map((x) => x.code), `e = ${e}`).not.toContain('near-mechanism');
      const exact = exactSolve(model(e));
      const top = Math.max(...exact.u.map(Math.abs));
      out.u.forEach((v, d) => expect(Math.abs(v - exact.u[d]) / top, `e = ${e} dof ${d + 1}`).toBeLessThan(1e-9));
    }
    // 1e-12 off the line: a pivot of 1e-26 of its diagonal, which thirty figures keep with a handful: it is stable, it is solved, and the warning counts the figures it is certain of
    const loose = solve(model(1e-12));
    expect(loose.ok).toBe(true);
    if (loose.ok) {
      const w = loose.warnings.find((x) => x.code === 'near-mechanism')!;
      expect(w).toBeDefined();
      expect(w.ratio!).toBeGreaterThan(WEAK);
      expect(w.ratio!).toBeLessThan(RESOLVE);
      expect(w.count).toBe(Math.floor(-Math.log10(w.ratio!)));
      expect(w.dofs).toHaveLength(1);
      // the claim is true: the displacements are exact to the figures it counts
      const exact = exactSolve(model(1e-12));
      const top = Math.max(...exact.u.map(Math.abs));
      const error = Math.max(...loose.u.map((v, d) => Math.abs(v - exact.u[d]))) / top;
      expect(error).toBeLessThan(10 ** -w.count!);
    }
    // 1e-14 off the line: the pivot is lost in its rounding even in thirty figures and the movement strains nothing to speak of: that one is a mechanism, at the free joint
    const lost = solve(model(1e-14));
    expect(lost.ok).toBe(false);
    if (!lost.ok) {
      expect(lost.issues[0].code).toBe('mechanism');
      expect(lost.issues[0].dof).toBe(6);
    }
    // a sound one has neither
    const firm = solve(model(0.5));
    expect(firm.ok && firm.warnings.map((x) => x.code)).not.toContain('near-mechanism');
    // the tolerances are the same numbers in the engine and in the copy
    expect(TOLERANCES.resolve).toBe(RESOLVE);
    expect(TOLERANCES.weak).toBe(WEAK);
    expect(TOLERANCES.strain).toBe(STRAIN);
    expect(TOLERANCES.agree).toBe(AGREE);
    expect(TOLERANCES.large).toBe(LARGE);
  });
});

describe('the end forces for the drawing', () => {
  it('a truss: every bar with its state and its share of the largest force', () => {
    const a = analyseSafely(reduce(emptyStiffness(), { type: 'template', template: 'truss-five-member' }));
    const f = a.drawing.forces;
    expect(f.map((x) => x.member)).toEqual([1, 2, 3, 4, 5]);
    expect(f.map((x) => x.state)).toEqual(['compression', 'tension', 'compression', 'tension', 'compression']);
    expect(f.map((x) => x.share.N)).toEqual([expect.closeTo(4 / 25, 9), expect.closeTo(20 / 25, 9), expect.closeTo(20 / 25, 9), expect.closeTo(20 / 25, 9), 1]);
    expect(f[0]).toMatchObject({ x1: 0, y1: 0, x2: 16, y2: 0 });
    expect(f[0].start.N).toBeCloseTo(-4, 9);
    expect(f[0].share.V).toBe(0);
    expect(f[0].share.M).toBe(0);
  });
  it('a frame: N, V and M at both ends, no state', () => {
    const a = analyseSafely(reduce(emptyStiffness(), { type: 'template', template: 'frame-propped' }));
    const f = a.drawing.forces[0];
    expect(f.state).toBeNull();
    expect(f.start.M).toBeCloseTo(-60, 9);
    expect(f.share).toEqual({ N: 0, V: 1, M: 1 });
  });
  it('is empty when nothing is solved', () => {
    expect(analyseSafely(emptyStiffness()).drawing.forces).toEqual([]);
  });
  it('a bar that carries nothing does not lengthen: the rounding in a difference of two displacements is zero', () => {
    // the zero-force bar of a rigid settlement, built by hand: both ends of a bar move together
    let f: StiffnessForm = reduce(emptyStiffness('us', 'truss'), { type: 'clear' });
    f = reduce(f, { type: 'add', list: 'nodes', seed: { x: 0, y: 0 } });
    f = reduce(f, { type: 'add', list: 'nodes', seed: { x: 5, y: 12 } });
    f = reduce(f, { type: 'add', list: 'members', seed: { i: f.nodes[0].id, j: f.nodes[1].id } });
    f = reduce(f, { type: 'add', list: 'supports', seed: { node: f.nodes[0].id, preset: 'pin' } });
    f = reduce(f, { type: 'add', list: 'supports', seed: { node: f.nodes[1].id, preset: 'pin' } });
    f = reduce(f, { type: 'patch', list: 'supports', id: f.supports[0].id, patch: { dx: 0.14, dy: 0.07 } });
    f = reduce(f, { type: 'patch', list: 'supports', id: f.supports[1].id, patch: { dx: 0.14, dy: 0.07 } });
    const a = analyseSafely(f);
    expect(a.issues).toEqual([]);
    expect(a.results!.members[0].bar).toEqual({ N: 0, stress: 0, elongation: 0, state: 'zero' });
  });
});
