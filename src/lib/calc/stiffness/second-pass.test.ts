import { afterEach, describe, expect, it, vi } from 'vitest';
import { analyseSafely } from './analysis';
import { exactSolve } from './bigoracle.testlib';
import { solve } from './engine';
import { compare, gen, girder, real } from './families.testlib';
import { randomForm } from './forms.testlib';
import { decodeStiffness, defaultStiffness, emptyStiffness, reduce, toEngine, type StiffnessForm } from './model';
import { rng } from './oracle.testlib';
import type { MatrixBlock, Solution, StiffnessModel, Step, VectorBlock } from './types';
import { RESIDUAL } from './types';

vi.setConfig({ testTimeout: 300_000 });
afterEach(() => new Promise((r) => setTimeout(r, 0)));

/**
 * THE SECOND ADVERSARIAL PASS, ENGINE AND NUMBERS. Each describe is a finding of the second review (E2 to E12), with the case that showed it, and each test fails on the
 * engine as it was then (double precision, a pivot judged against a running worst-case bound, numbers settled against the largest of their block, a force scale inflated by the
 * terms of the equations). The independent oracle (bigoracle.testlib.ts) has 120 digits and shares no code with the engine.
 */

const tpl = (id: Parameters<typeof tplOf>[0], units: 'us' | 'si' = 'us') => tplOf(id, units);
function tplOf(id: 'truss-two-bar' | 'truss-three-bar' | 'truss-five-member' | 'frame-propped' | 'frame-l' | 'frame-portal' | 'frame-fixed-point', units: 'us' | 'si'): StiffnessForm {
  return reduce(emptyStiffness(units), { type: 'template', template: id });
}
const stiffMember = (form: StiffnessForm, k: number, A: number) => reduce(form, { type: 'patch', list: 'members', id: form.members[k].id, patch: { A } });
const solved = (form: StiffnessForm): Solution => {
  const out = solve(toEngine(form).model);
  if (!out.ok) throw new Error(JSON.stringify(out.issues));
  return out;
};
const stepOf = (steps: readonly Step[], key: string): Step => steps.find((s) => s.key === key)!;
const matrixOf = (steps: readonly Step[], key: string, name: string, tag?: string): number[][] => (stepOf(steps, key).blocks.find((b) => b.type === 'matrix' && b.name === name && b.tag === tag) as MatrixBlock).values;
const vectorOf = (steps: readonly Step[], key: string, name: string, tag?: string): number[] => (stepOf(steps, key).blocks.find((b) => b.type === 'vector' && b.name === name && b.tag === tag) as VectorBlock).values;

describe('E4: an ordinary structure is never refused as ill-conditioned', () => {
  it('the 4-panel Pratt truss of the review (equal bars, one horizontal load at the top right joint) is solved, and its reactions are the statics of it', () => {
    const model = girder('pratt', 4, 7, 10, 0);
    const out = solve(model);
    expect(out.ok).toBe(true);
    if (!out.ok) return;
    // pin at the left foot, a vertical roller at the right foot, 10 kip to the right at height 8 ft: Rx = −10, and the moment of the load about the left foot (−80) is carried by ±2 kip
    const [rx, ry1, ry2] = out.reactions.map((r) => r.value);
    expect(rx).toBeCloseTo(-10, 9);
    expect(ry1).toBeCloseTo(-2, 9);
    expect(ry2).toBeCloseTo(2, 9);
    expect(out.checks.every((c) => c.ok)).toBe(true);
  });
  it('Pratt, Howe and Warren girders of 4 and 5 panels (the most the tool holds), every joint, both directions of a horizontal and of a vertical load, US and SI: none refused, all in equilibrium', () => {
    let solvedCount = 0;
    for (const kind of ['pratt', 'howe', 'warren'] as const) {
      for (const panels of [4, 5]) {
        const joints = girder(kind, panels, 0, 0, 0).nodes.length;
        for (let at = 0; at < joints; at++) {
          for (const [fx, fy] of [[10, 0], [-10, 0], [0, -10], [0, 10]]) {
            for (const units of ['us', 'si'] as const) {
              const out = solve(girder(kind, panels, at, fx, fy, units));
              if (!out.ok) throw new Error(`${kind} ${panels} at ${at} (${fx}, ${fy}) ${units}: ${JSON.stringify(out.issues)}`);
              solvedCount++;
              expect(out.warnings, `${kind} ${panels} at ${at}`).toEqual([]);
              const sumX = out.reactions.filter((r) => r.kind === 'x').reduce((s, r) => s + r.value, 0) + fx;
              const sumY = out.reactions.filter((r) => r.kind === 'y').reduce((s, r) => s + r.value, 0) + fy;
              expect(Math.abs(sumX) + Math.abs(sumY), `${kind} ${panels} at ${at}`).toBeLessThan(1e-9);
            }
          }
        }
      }
    }
    expect(solvedCount).toBe(448);
  });
  it('300 random ordinary trusses and frames (and 300 of realistic proportions): not one refused', () => {
    let refused = 0;
    for (let k = 0; k < 300; k++) {
      const m = k % 2 === 0 ? gen(70000 + k, { contrast: k % 3 === 0 ? 0 : 2, ensureStable: true, settle: k % 4 === 0, memberLoads: true, nodes: [3, 9] }) : real(80000 + k, k % 4 === 1 ? 'truss' : 'frame', 0, 'A', true);
      const out = solve(m);
      if (!out.ok && out.issues[0].code !== 'mechanism') refused++;
    }
    expect(refused).toBe(0);
  });
});

describe('E5: a stable frame or truss is solved however stiff one member is (up to twenty decades), and never to a wrong answer', () => {
  it('the reviewer’s bent cantilever, the second member A = 3×10¹⁰ in²: solved, with no warning, to every figure', () => {
    const f = decodeStiffness('Km163419q1z;1;f;us;s,29000,30,50;0,0_15,0_20,24;1,2_2,3,,30000000000;1,7;3,-18,-17;')!;
    const model = toEngine(f).model;
    const out = solve(model);
    expect(out.ok).toBe(true);
    if (!out.ok) return;
    // (the cantilever is flimsy: it is told so, as a member that has left first order, and for no other reason)
    expect(out.warnings.map((w) => w.code).filter((c) => c !== 'large-displacements' && c !== 'large-rotation' && c !== 'large-stretch')).toEqual([]);
    const exact = exactSolve(model);
    out.u.forEach((v, d) => expect(Math.abs(v - exact.u[d]), `u ${d + 1}`).toBeLessThanOrEqual(1e-12 * Math.max(...exact.u.map(Math.abs))));
  });
  it('120 realistic structures per decade of stiffness, k = 6 to 14 (a third trusses, a third frames with A, a third frames with A and I): none refused, none wrong (displacements, reactions and end forces to a billionth)', () => {
    let refused = 0;
    let wrong = 0;
    let worst = 0;
    for (const [mode, what] of [['truss', 'A'], ['frame', 'A'], ['frame', 'AI']] as const) {
      for (let k = 6; k <= 14; k++) {
        for (let s = 0; s < 40; s++) {
          const c = compare(real(20000 + s, mode, k, what, true));
          if (c.exact === 'singular') continue;
          if (c.engine !== 'ok') {
            refused++;
            continue;
          }
          worst = Math.max(worst, c.errU, c.errR, c.errF);
          if (c.errU > 1e-9 || c.errR > 1e-9 || c.errF > 1e-9) wrong++;
        }
      }
    }
    expect(refused).toBe(0);
    expect(wrong).toBe(0);
    expect(worst).toBeLessThan(1e-9);
  });
  it('up to twenty decades (a member 10²⁰ times stiffer): solved to eight figures; and beyond, what is refused is refused honestly and what is solved carries a count that is never optimistic', () => {
    let tooOptimistic = 0;
    for (const k of [16, 18, 20]) {
      for (let s = 0; s < 25; s++) {
        const c = compare(real(30000 + s, s % 2 === 0 ? 'truss' : 'frame', k, 'A', true));
        if (c.exact === 'singular') continue;
        expect(c.engine, `k = ${k} seed ${30000 + s}`).toBe('ok');
        expect(c.errU, `k = ${k} seed ${30000 + s}`).toBeLessThan(1e-8);
      }
    }
    for (const k of [22, 24, 26]) {
      for (let s = 0; s < 25; s++) {
        const c = compare(real(30000 + s, s % 2 === 0 ? 'truss' : 'frame', k, 'A', true));
        if (c.exact === 'singular') {
          expect(c.engine, `k = ${k} seed ${30000 + s}`).toMatch(/mechanism|few-supports/);
          continue;
        }
        if (c.engine === 'ok' && c.errU > Math.max(c.count !== undefined ? 10 ** -(c.count - 1) : 1e-6, 1e-9)) tooOptimistic++;
        if (c.engine !== 'ok') expect(['stiffness-range', 'ill-conditioned']).toContain(c.engine);
      }
    }
    expect(tooOptimistic).toBe(0);
  });
});

describe('E6: a true mechanism is a mechanism, however stiff a bar in it is', () => {
  it('the reviewer’s four-node chain (bar 1 of 10¹² in², two pins, a load on the end): a mechanism, unstable, the right words, whatever the area of bar 1 from 10 to 10²⁰', () => {
    const base = decodeStiffness('Ko761yw652g;1;t;us;s,29000,10,100;28,16_15,0_20,24_0,0;2,3,,1000000000000_2,4_1,4;4,3_1,3;3,-18,-17;')!;
    for (const A of [10, 1e6, 1e9, 1e11, 1e12, 1e13, 1e14, 1e15, 1e18, 1e20]) {
      const f = stiffMember(base, 0, A);
      const a = analyseSafely(f);
      expect(a.issues.map((i) => i.code), `A = ${A}`).toEqual(['mechanism']);
      expect(a.determinacy.word, `A = ${A}`).toBe('unstable');
      expect(a.issues[0].count, `A = ${A}`).toBeGreaterThanOrEqual(2);
    }
  });
  it('a chain of bars on a line with one of them 10⁹ to 10¹⁴ times stiffer: the middle node sways, whatever that bar is', () => {
    for (const A of [1, 1e9, 1e10, 1e12, 1e14]) {
      const out = solve({ mode: 'truss', nodes: [{ x: 0, y: 0 }, { x: 5, y: 0 }, { x: 10, y: 0 }, { x: 15, y: 0 }], members: [{ i: 0, j: 1, A }, { i: 1, j: 2 }, { i: 2, j: 3 }], supports: [{ node: 0, ux: true, uy: true, rz: false }, { node: 3, ux: true, uy: true, rz: false }], loads: [{ node: 1, fx: 0, fy: -1, m: 0 }], memberLoads: [], E: 100, A: 1 });
      expect(out.ok, `A = ${A}`).toBe(false);
      if (!out.ok) expect(out.issues[0], `A = ${A}`).toMatchObject({ code: 'mechanism', kind: 'sway' });
    }
  });
  it('real structures of random shape with one bar k decades stiffer, k = 9 to 14 (weak supports: most are mechanisms): every mechanism of the oracle is a mechanism, every stable one is solved', () => {
    let mechanisms = 0;
    for (let k = 9; k <= 14; k++) {
      for (let s = 0; s < 60; s++) {
        const c = compare(real(20000 + s, 'truss', k, 'A', false));
        if (c.exact === 'singular') {
          mechanisms++;
          expect(c.engine, `k = ${k} seed ${20000 + s}`).toMatch(/^(mechanism|few-supports)$/);
        } else expect(c.engine, `k = ${k} seed ${20000 + s}`).toBe('ok');
      }
    }
    expect(mechanisms).toBeGreaterThan(200);
  });
});

describe('E2/E11: the checks are measured against their own scale, which is printed, and a check can fail', () => {
  const FORMS: [string, StiffnessForm][] = [
    ...(['truss-two-bar', 'truss-three-bar', 'truss-five-member', 'frame-propped', 'frame-l', 'frame-portal', 'frame-fixed-point'] as const).map((id): [string, StiffnessForm] => [id, tpl(id)]),
    ['portal A = 1e9', reduce(tpl('frame-portal'), { type: 'section', patch: { A: 1e9 } })],
    ['portal A = 1e12', reduce(tpl('frame-portal'), { type: 'section', patch: { A: 1e12 } })],
    ['five-bar bar 3 A = 1e10', stiffMember(tpl('truss-five-member'), 2, 1e10)],
  ];
  it('the force scale is the loads added up, the largest reaction or the largest end force: never the sum of the sizes of the terms (2×10¹⁰ kip for a 10 kip load)', () => {
    for (const [name, f] of FORMS) {
      const s = solved(f);
      const loads = s.P.reduce((acc, v, d) => acc + (s.dofs[d].kind === 'θ' ? 0 : Math.abs(v)), 0);
      const biggest = Math.max(...s.reactions.map((r) => Math.abs(r.value) / (r.kind === 'θ' ? s.size : 1)), ...s.forces.flatMap((fo) => fo.f.map((v, q) => Math.abs(v) / (s.mode === 'frame' && q % 3 === 2 ? s.size : 1))));
      expect(s.scale, name).toBeLessThanOrEqual(Math.max(loads, biggest) * 1.5 + 1e-9);
    }
    expect(solved(reduce(tpl('frame-portal'), { type: 'section', patch: { A: 1e9 } })).scale).toBeLessThan(40);
  });
  it('a reaction wrong by one percent breaks the equilibrium of the whole and of the joint it is at: the tolerance of those checks is far under it, for every template and for the portal at A = 1e9', () => {
    for (const [name, f] of FORMS) {
      const s = solved(f);
      const tolerance = (id: string) => {
        const c = s.checks.find((x) => x.id === id)!;
        return RESIDUAL * c.scale + c.allowance;
      };
      for (const r of s.reactions) {
        if (r.value === 0) continue;
        const bump = 0.01 * Math.abs(r.value);
        const per = r.kind === 'θ' ? s.size : 1;
        if (r.kind === 'x') expect(bump, `${name} ${r.label}: ΣFx`).toBeGreaterThan(tolerance('sum-fx'));
        if (r.kind === 'y') expect(bump, `${name} ${r.label}: ΣFy`).toBeGreaterThan(tolerance('sum-fy'));
        // the moment of that reaction about the centre, and the joint it is at
        expect(bump / per, `${name} ${r.label}: joints`).toBeGreaterThan(tolerance('joints'));
        expect(bump / per, `${name} ${r.label}: K·u − P − R`).toBeGreaterThan(tolerance('system'));
      }
      expect(s.checks.every((c) => c.ok), name).toBe(true);
    }
  });
  it('every check has a scale and a rounding allowance, the allowance is rounding (far under the tolerance of a hundred-millionth), and the card prints the scale it used', () => {
    for (const [name, f] of FORMS) {
      const s = solved(f);
      for (const c of s.checks) {
        expect(Number.isFinite(c.allowance), `${name} ${c.id}`).toBe(true);
        expect(c.allowance, `${name} ${c.id}`).toBeGreaterThanOrEqual(0);
        if (c.id !== 'solve') expect(c.allowance, `${name} ${c.id}`).toBeLessThan(RESIDUAL * Math.max(c.scale, 1e-300));
      }
      const checks = stepOf(s.steps, 'checks');
      expect(checks.facts.scale, name).toBe(s.scale);
      expect(checks.facts.work, name).toBeGreaterThanOrEqual(0);
    }
  });
});

describe('E3: the matrices of a member and the multipliers print every real entry, however small beside the largest of their block', () => {
  const E = 29000 * 144;
  const I = 484 / 20736;
  const L = 20;
  const closedBeam = { b: (12 * E * I) / L ** 3, c: (6 * E * I) / L ** 2, d: (4 * E * I) / L, e: (2 * E * I) / L };
  for (const A of [1e8, 1e9, 1e12]) {
    it(`the portal at A = ${A} in²: the 12EI/L³ cells of the beam are 12EI/L³, in k, kT, K_e and the contribution (steps 3, 5, 6), as the assembled K has them`, () => {
      const a = analyseSafely(reduce(tpl('frame-portal'), { type: 'section', patch: { A } }));
      const steps = a.solution!.steps;
      const k = matrixOf(steps, 'local-stiffness#3', 'k');
      expect(k[1][1]).toBeCloseTo(closedBeam.b, 6);
      expect(k[1][2]).toBeCloseTo(closedBeam.c, 6);
      expect(k[2][2]).toBeCloseTo(closedBeam.d, 6);
      expect(k[2][5]).toBeCloseTo(closedBeam.e, 6);
      // the beam is horizontal: K_e is k, with the same cells, none of them 0
      const Ke = matrixOf(steps, 'global-member#3', 'K_e');
      const kT = matrixOf(steps, 'global-member#3', 'kT');
      const contribution = matrixOf(steps, 'assembly#3', 'contribution');
      const K = matrixOf(steps, 'assembled', 'K');
      for (const [r, q, v] of [[1, 1, closedBeam.b], [1, 2, closedBeam.c], [2, 2, closedBeam.d], [2, 5, closedBeam.e], [4, 4, closedBeam.b], [4, 5, -closedBeam.c]] as const) {
        expect(Ke[r][q], `K_e [${r}][${q}]`).toBeCloseTo(k[r][q], 6);
        expect(kT[r][q], `kT [${r}][${q}]`).toBeCloseTo(k[r][q], 6);
        expect(Math.abs(Ke[r][q] - v), `K_e [${r}][${q}] against the formula`).toBeLessThanOrEqual(1e-9 * Math.abs(v));
        void contribution;
      }
      // the contribution of the beam is written into K at the DOFs 7..12 of nodes 3 and 4: DOF 8 is 3y
      expect(contribution[7][7]).toBeCloseTo(closedBeam.b, 6);
      expect(K[7][7]).toBeGreaterThan(contribution[7][7] - 1e-6);
      // none of the 12EI/L³, 6EI/L², 4EI/L or 2EI/L cells prints as 0
      for (const [r, q] of [[1, 1], [1, 2], [2, 2], [2, 5], [1, 4], [4, 4]] as const) expect(Ke[r][q] !== 0, `K_e [${r}][${q}] is not 0`).toBe(true);
    });
  }
  it('the five-bar truss with bar 3 at A = 10¹⁰ in²: the multipliers of the pass that eliminates the stiff bar’s DOFs print their size, and the pass is redone from them', () => {
    const a = analyseSafely(stiffMember(tpl('truss-five-member'), 2, 1e10));
    const steps = a.solution!.steps;
    const passes = steps.filter((s) => s.id === 'forward-pass');
    let tiny = 0;
    passes.forEach((pass, i) => {
      const k = i;
      const before = i === 0 ? matrixOf(steps, 'augmented', 'augmented') : matrixOf(steps, pass.key === 'forward-pass#1' ? 'forward-pass#1' : `forward-pass#${i}`, 'augmented', `pass#${i}`);
      const m = vectorOf(steps, pass.key, 'multipliers', `pass#${k + 1}`);
      const after = matrixOf(steps, pass.key, 'augmented', `pass#${k + 1}`);
      m.forEach((l, q) => {
        if (l !== 0 && Math.abs(l) < 1e-6) tiny++;
        const row = k + 1 + q;
        // the multiplier is the entry under the pivot over the pivot, as printed
        if (before[row][k] !== 0) expect(l, `pass ${k + 1} row ${row}`).toBeCloseTo(before[row][k] / before[k][k], 12);
        else expect(l).toBe(0);
        // and the row below is the row less the multiple, entry by entry, to the size of the entries of both rows
        for (let j = k + 1; j < before.length + 1; j++) {
          const want = before[row][j] - l * before[k][j];
          const size = Math.abs(before[row][j]) + Math.abs(l * before[k][j]);
          expect(Math.abs(after[row][j] - want), `pass ${k + 1} (${row}, ${j})`).toBeLessThanOrEqual(1e-9 * size + 1e-300);
        }
      });
    });
    // multipliers smaller than a billionth that are real (−1.0×10⁻⁹ and −7.5×10⁻¹⁰ in the review) are printed, and not 0
    expect(tiny).toBeGreaterThan(0);
  });
});

describe('E9: a reaction that is 0 prints 0, and one that is not prints its size', () => {
  it('the L-frame with its beam made 10⁷ to 10²⁰ times stiffer: the reactions are the textbook’s (0, wL, wL²/2) and the foot’s Rx is exactly 0, in US and in SI', () => {
    for (const units of ['us', 'si'] as const) {
      const base = analyseSafely(tpl('frame-l', units)).results!.reactions[0];
      expect(base.rx, units).toBe(0);
      for (const A of [undefined, 1e7, 1e8, 1e9, 1e10, 1e15, 1e20]) {
        let f = tpl('frame-l', units);
        if (A !== undefined) f = stiffMember(f, 1, units === 'us' ? A : A * 645.16);
        const a = analyseSafely(f);
        expect(a.issues, `${units} ${A}`).toEqual([]);
        const r = a.results!.reactions[0];
        expect(r.rx, `${units} ${A}: Rx`).toBe(0);
        expect(Math.abs(r.ry! - base.ry!), `${units} ${A}: Ry`).toBeLessThanOrEqual(1e-9 * Math.abs(base.ry!));
        expect(Math.abs(r.rm! - base.rm!), `${units} ${A}: M`).toBeLessThanOrEqual(1e-9 * Math.abs(base.rm!));
      }
    }
  });
  it('180 realistic structures with a stiff member: no reaction is printed 0 that the oracle finds larger than a billionth of the force scale, and none is printed that the oracle finds smaller than 10⁻¹² of it', () => {
    let falseZero = 0;
    let noise = 0;
    let seen = 0;
    for (const [mode, k] of [['frame', 8], ['frame', 12], ['truss', 8], ['truss', 12]] as const) {
      for (let s = 0; s < 45; s++) {
        const model = real(40000 + s, mode, k, 'A', true);
        const exact = exactSolve(model);
        const out = solve(model);
        if (exact.singular || !out.ok) continue;
        const scaleF = Math.max(...exact.R.map((v, q) => Math.abs(v) / (out.dofs[exact.restrained[q] - 1].kind === 'θ' ? out.size : 1)));
        out.reactions.forEach((r, q) => {
          const per = r.kind === 'θ' ? out.size : 1;
          seen++;
          if (r.value === 0 && Math.abs(exact.R[q]) / per > 1e-9 * scaleF) falseZero++;
          if (r.value !== 0 && Math.abs(exact.R[q]) / per < 1e-12 * scaleF) noise++;
        });
      }
    }
    expect(seen).toBeGreaterThan(300);
    expect(falseZero).toBe(0);
    expect(noise).toBe(0);
  });
});

describe('E10: a settlement typed on a DOF the support does not hold is never a fault, whatever it is', () => {
  it('a hidden 10⁴⁰ on the roller of the propped cantilever: solved, with the warning that it has no effect; on a DOF the roller holds it is still a fault', () => {
    const f = tpl('frame-propped');
    const roller = f.supports[1];
    for (const dx of [1e40, -1e40, 1e300, 5]) {
      const g = reduce(f, { type: 'patch', list: 'supports', id: roller.id, patch: { dx } });
      const a = analyseSafely(g);
      expect(a.issues, `dx = ${dx}`).toEqual([]);
      expect(a.warnings, `dx = ${dx}`).toContainEqual({ code: 'settlement-ignored', dofs: [4] });
      expect(a.solution!.u, `dx = ${dx}`).toEqual(analyseSafely(f).solution!.u);
    }
    const held = analyseSafely(reduce(f, { type: 'patch', list: 'supports', id: roller.id, patch: { dy: 1e40 } }));
    expect(held.issues.map((i) => i.code)).toEqual(['number']);
    // the engine, directly: a prescribed value on a DOF that is not held is ignored even where it is not a number
    const model = toEngine(f).model;
    for (const bad of [Number.NaN, Infinity, 1e40]) {
      const out = solve({ ...model, supports: model.supports.map((s, k) => (k === 1 ? { ...s, dx: bad } : s)) });
      expect(out.ok, String(bad)).toBe(true);
      if (out.ok) expect(out.warnings.map((w) => w.code)).toContain('settlement-ignored');
    }
  });
});

describe('E12: the steps of a refusal are numbers', () => {
  const allFinite = (steps: readonly Step[]) =>
    steps.every(
      (s) =>
        Object.values(s.facts).every((v) => typeof v !== 'number' || Number.isFinite(v)) &&
        s.blocks.every((b) => (b.type === 'scalar' ? Number.isFinite(b.value) : b.type === 'vector' ? b.values.every(Number.isFinite) : b.values.every((r) => r.every(Number.isFinite)))),
    );
  it('a node at 10⁻³²⁰ of the propped cantilever: refused as too small, and not one step of it holds an Infinity or a NaN', () => {
    const model = toEngine(tpl('frame-propped')).model;
    const out = solve({ ...model, nodes: [model.nodes[0], { x: 1e-320, y: 0 }] });
    expect(out.ok).toBe(false);
    if (!out.ok) {
      expect(out.issues.map((i) => i.code)).toEqual(['size']);
      expect(allFinite(out.steps)).toBe(true);
    }
  });
  it('2,000 models of extreme numbers: whatever the refusal, its steps hold only finite numbers', () => {
    const r = rng(1212);
    const pick = <T,>(xs: readonly T[]): T => xs[Math.floor(r() * xs.length)];
    const base = toEngine(tpl('frame-portal')).model;
    let refusals = 0;
    for (let n = 0; n < 2000; n++) {
      const scale = pick([1e-300, 1e-200, 1e-150, 1e-30, 1e30, 1e100, 1e150, 1e200]);
      const m: StiffnessModel = {
        ...base,
        nodes: base.nodes.map((q) => ({ x: q.x * (r() < 0.3 ? scale : 1), y: q.y * (r() < 0.3 ? scale : 1) })),
        E: r() < 0.5 ? pick([1e-30, 1e30, 1e20, 1e-20]) : base.E,
        A: r() < 0.5 ? pick([1e-30, 1e30, 1e20, 1e-20]) : base.A,
        I: r() < 0.5 ? pick([1e-30, 1e30, 1e20, 1e-20]) : base.I,
        loads: base.loads.map((l) => ({ ...l, fx: l.fx * pick([1, 1e30, 1e-30]), fy: l.fy * pick([1, 1e30]) })),
      };
      const out = solve(m);
      if (!out.ok) {
        refusals++;
        expect(allFinite(out.steps), JSON.stringify(out.issues)).toBe(true);
      } else expect(allFinite(out.steps)).toBe(true);
    }
    expect(refusals).toBeGreaterThan(50);
  });
});

describe('E8: the count of figures is a bound the displacements keep, and never more than one figure optimistic', () => {
  /** Two tilted bars on a line, the free joint `e` off it (a stiffness across them of (e/L)² of that along): the pivot loses a figure for every decade. */
  const tilted = (seed: number, e: number): StiffnessModel => {
    const r = rng(seed);
    const angle = r() * Math.PI;
    const a = 10 + r() * 30;
    const cos = Math.cos(angle);
    const sin = Math.sin(angle);
    const t = 0.3 + r() * 0.4;
    const onLine = { x: a * t * cos - e * sin, y: a * t * sin + e * cos };
    return {
      mode: 'truss',
      nodes: [{ x: 0, y: 0 }, { x: a * cos, y: a * sin }, onLine],
      members: [{ i: 0, j: 2 }, { i: 1, j: 2 }],
      supports: [{ node: 0, ux: true, uy: true, rz: false }, { node: 1, ux: true, uy: true, rz: false }],
      loads: [{ node: 2, fx: Number(((r() - 0.5) * 10).toFixed(3)), fy: Number((-1 - r() * 10).toFixed(3)), m: 0 }],
      memberLoads: [],
      E: 1000 * (1 + Math.floor(r() * 30)),
      A: 0.5 + r() * 20,
    };
  };
  it('more than 220 structures that carry the warning (tilted joints, stiff members of realistic and of random shape): the true error of the displacements is under 10 to the minus (N − 1) in every one', () => {
    const r = rng(8888);
    let warned = 0;
    let optimistic = 0;
    let worstGap = -Infinity;
    const note = (m: StiffnessModel) => {
      const c = compare(m);
      if (c.exact === 'singular' || c.engine !== 'ok' || c.count === undefined) return;
      warned++;
      const truth = c.errU > 0 ? -Math.log10(c.errU) : 99;
      worstGap = Math.max(worstGap, c.count - truth);
      if (c.count > truth + 1) optimistic++;
    };
    for (let n = 0; warned < 200 && n < 4000; n++) note(tilted(500 + n, 10 ** -(10.2 + 3.2 * r())));
    expect(warned).toBeGreaterThanOrEqual(190);
    const stiffWarned = warned;
    for (let s = 0; s < 600 && warned < stiffWarned + 60; s++) note(s % 2 === 0 ? real(50000 + s, s % 4 === 0 ? 'truss' : 'frame', 21 + (s % 5), 'A', true) : gen(51000 + s, { contrast: 22 + (s % 4), sign: 'up', ensureStable: true, memberLoads: true, fraction: 0.3 }));
    expect(warned).toBeGreaterThanOrEqual(220);
    expect(optimistic).toBe(0);
    expect(worstGap).toBeLessThan(1);
  });
  it('the count is the worst of the displacements’ bounds, and is in the solution for a test to read', () => {
    const out = solve(tilted(5, 1e-12));
    expect(out.ok).toBe(true);
    if (!out.ok) return;
    const w = out.warnings.find((x) => x.code === 'near-mechanism')!;
    expect(w.ratio).toBe(out.accuracy);
    expect(w.count).toBe(Math.floor(-Math.log10(out.accuracy)));
    expect(out.uError.length).toBe(out.u.length);
    expect(Math.max(...out.uError)).toBeGreaterThan(0);
    // an ordinary structure carries no such word and a bound far under a billionth
    const plain = solved(defaultStiffness());
    expect(plain.warnings).toEqual([]);
    expect(plain.accuracy).toBeLessThan(1e-20);
  });
});

describe('E7: a member past first order is told in each of the three ways it can be, and only then', () => {
  /** The three measures of how far a member has left first order, worked from the members’ own geometry and the exact displacements: independent of the engine. */
  const measures = (model: StiffnessModel, u: number[]) => {
    const nd = model.mode === 'frame' ? 3 : 2;
    let chord = 0;
    let stretch = 0;
    let rotation = 0;
    model.members.forEach((m) => {
      const a = model.nodes[m.i];
      const b = model.nodes[m.j];
      const L = Math.hypot(b.x - a.x, b.y - a.y);
      const c = (b.x - a.x) / L;
      const sn = (b.y - a.y) / L;
      const dx = u[nd * m.j] - u[nd * m.i];
      const dy = u[nd * m.j + 1] - u[nd * m.i + 1];
      const across = (-sn * dx + c * dy) / L;
      chord = Math.max(chord, Math.abs(across));
      stretch = Math.max(stretch, Math.abs(c * dx + sn * dy) / L);
      if (nd === 3) rotation = Math.max(rotation, Math.abs(u[nd * m.i + 2] - across), Math.abs(u[nd * m.j + 2] - across));
    });
    return { chord, stretch, rotation };
  };
  it('the seven templates in both units say nothing about it', () => {
    for (const id of ['truss-two-bar', 'truss-three-bar', 'truss-five-member', 'frame-propped', 'frame-l', 'frame-portal', 'frame-fixed-point'] as const) {
      for (const units of ['us', 'si'] as const) expect(solved(tpl(id, units)).warnings.map((w) => w.code), `${id} ${units}`).toEqual([]);
    }
  });
  it('300 structures, ordinary ones and flimsy ones (members softened by up to eight decades): the engine says "chord", "rotation" and "stretch" exactly when the exact displacements put a member past a tenth in that way', () => {
    const tally = { none: 0, chord: 0, rotation: 0, stretch: 0 };
    for (let n = 0; n < 300; n++) {
      const model = n % 3 === 0 ? real(60000 + n, n % 2 === 0 ? 'truss' : 'frame', 0, 'A', true) : gen(61000 + n, { contrast: 8, sign: 'down', ensureStable: true, memberLoads: n % 2 === 0, nodes: [3, 7], mode: n % 2 === 0 ? 'frame' : 'truss', fraction: 0.5 });
      const exact = exactSolve(model);
      const out = solve(model);
      if (exact.singular || !out.ok) continue;
      const m = measures(model, exact.u);
      const codes = out.warnings.map((w) => w.code);
      const one = (value: number, code: string, key: keyof typeof tally) => {
        if (value > 0.1 * (1 + 1e-6)) {
          expect(codes, `#${n} ${code} (${value})`).toContain(code);
          tally[key]++;
        } else if (value < 0.1 * (1 - 1e-6)) expect(codes, `#${n} ${code} (${value})`).not.toContain(code);
      };
      one(m.chord, 'large-displacements', 'chord');
      one(m.rotation, 'large-rotation', 'rotation');
      one(m.stretch, 'large-stretch', 'stretch');
      if (m.chord < 0.1 && m.rotation < 0.1 && m.stretch < 0.1) tally.none++;
    }
    expect(tally.none).toBeGreaterThan(40);
    expect(tally.chord).toBeGreaterThan(20);
    expect(tally.rotation).toBeGreaterThan(10);
    expect(tally.stretch).toBeGreaterThan(10);
  });
});

describe('the whole engine against the 120-digit oracle on forms of every sort (random edits of the example, of the templates, of nothing)', () => {
  it('1,500 forms: every one the oracle solves is solved, to the double, with no value printed as 0 that is more than a billionth of the force scale; every singular one is a mechanism or too few supports; none is refused as a stiffness range or as ill-conditioned', () => {
    let solvedBoth = 0;
    let mechanisms = 0;
    let falseZero = 0;
    let worst = 0;
    for (let seed = 1; seed <= 1500; seed++) {
      const model = toEngine(randomForm(seed, 30)).model;
      const out = solve(model);
      if (!out.ok) {
        // (a fault of the model is not about the arithmetic)
        if (!['mechanism', 'stiffness-range', 'ill-conditioned', 'size'].includes(out.issues[0].code)) continue;
        mechanisms++;
        expect(out.issues[0].code, `#${seed}`).toBe('mechanism');
        expect(exactSolve(model).singular, `#${seed}: the oracle solves what the engine calls a mechanism`).toBe(true);
        continue;
      }
      const exact = exactSolve(model);
      expect(exact.singular, `#${seed}: the engine solved what the oracle finds singular`).toBe(false);
      const fScale = Math.max(1e-300, ...exact.P.map(Math.abs), ...exact.R.map(Math.abs), ...exact.f.flatMap((x) => x.map(Math.abs)));
      if (fScale < 1e-50) continue;
      solvedBoth++;
      out.reactions.forEach((r, k) => {
        worst = Math.max(worst, Math.abs(r.value - exact.R[k]) / fScale);
        if (r.value === 0 && Math.abs(exact.R[k]) > 1e-9 * fScale) falseZero++;
      });
      out.forces.forEach((fo, k) =>
        fo.f.forEach((v, q) => {
          worst = Math.max(worst, Math.abs(v - exact.f[k][q]) / fScale);
          if (v === 0 && Math.abs(exact.f[k][q]) > 1e-9 * fScale) falseZero++;
        }),
      );
    }
    expect(solvedBoth).toBeGreaterThan(250);
    expect(mechanisms).toBeGreaterThan(25);
    expect(falseZero).toBe(0);
    expect(worst).toBeLessThan(1e-12);
  });
});
