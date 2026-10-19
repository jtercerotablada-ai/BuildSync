import { describe, expect, it } from 'vitest';
import { analyseSafely } from './analysis';
import { solve } from './engine';
import { STAGE_OF, STEP_IDS } from './codes';
import { convertStiffness, emptyStiffness, reduce, toEngine, type StiffnessForm } from './model';
import { TEMPLATE_IDS, type TemplateId } from './templates';
import type { Block, MatrixBlock, Solution, Step, StiffnessModel, VectorBlock } from './types';

const KIP = 4.4482216152605;

function ofTemplate(template: TemplateId, units: 'us' | 'si' = 'us', change?: (f: StiffnessForm) => StiffnessForm): StiffnessForm {
  const f = reduce(emptyStiffness(units), { type: 'template', template });
  return change ? change(f) : f;
}
function solved(f: StiffnessForm): Solution {
  const out = solve(toEngine(f).model);
  if (!out.ok) throw new Error(JSON.stringify(out.issues));
  return out;
}
const step = (s: Solution, key: string): Step => {
  const found = s.steps.find((x) => x.key === key);
  if (!found) throw new Error(`no step ${key}: ${s.steps.map((x) => x.key).join(' ')}`);
  return found;
};
const matrix = (s: Solution, key: string, name: string): MatrixBlock => {
  const b = step(s, key).blocks.find((x): x is MatrixBlock => x.type === 'matrix' && x.name === name);
  if (!b) throw new Error(`no matrix ${name} in ${key}`);
  return b;
};
const vector = (s: Solution, key: string, name: string, tag?: string): VectorBlock => {
  const b = step(s, key).blocks.find((x): x is VectorBlock => x.type === 'vector' && x.name === name && x.tag === tag);
  if (!b) throw new Error(`no vector ${name} in ${key}`);
  return b;
};
const scalar = (s: Solution, key: string, name: string): number => {
  const b = step(s, key).blocks.find((x): x is Extract<Block, { type: 'scalar' }> => x.type === 'scalar' && x.name === name);
  if (!b) throw new Error(`no scalar ${name} in ${key}`);
  return b.value;
};
const close = (a: number, b: number, relative = 1e-9, absolute = 0) => expect(Math.abs(a - b), `${a} vs ${b}`).toBeLessThanOrEqual(Math.max(relative * Math.max(Math.abs(a), Math.abs(b)), absolute));

/*
 * THE HAND ANSWERS (US set; every one is dimensionless in L, w, P, so it holds in SI as well). Signs: reactions on the structure, +x right, +y up,
 * counter-clockwise moments, N positive in tension.
 *
 * TWO-BAR TRUSS. Bars of 10 ft from (0, 0) and (16, 0) to the apex (8, 6): c = ±0.8, s = 0.6. E = 29,000 ksi, A = 10 in², EA = 290,000 kip, EA/L = 29,000 kip/ft.
 *   Apex load 20 kip →, 30 kip ↓.  Joint equilibrium:  −0.8·N1 + 0.8·N2 + 20 = 0  and  −0.6·N1 − 0.6·N2 − 30 = 0  →  N1 = −12.5, N2 = −37.5 kip.
 *   Reactions: left foot (0.8·12.5, 0.6·12.5) = (10, 7.5); right foot (−0.8·37.5, 0.6·37.5) = (−30, 22.5).
 *   By the matrices: K_FF = 29,000·[[0.64 + 0.64, 0.48 − 0.48], [0.48 − 0.48, 0.36 + 0.36]] = [[37,120, 0], [0, 20,880]] kip/ft → ux = 20/37,120 = 5.388e-4 ft,
 *   uy = −30/20,880 = −1.4368e-3 ft;  stresses −12.5/10 = −1.25 ksi and −3.75 ksi.
 * THREE-BAR TRUSS (indeterminate; bars 6, 10, 10 ft; sin = 0.6; equal EA; 40 kip ↓). N_v + 2·0.6·N_i = 40 and N_i = N_v·0.6·(6/10) = 0.36·N_v →
 *   N_v = 40/1.432 = 5000/179 = 27.933, N_i = 1800/179 = 10.056 kip, tension; the free node drops N_v·6/EA; the outer reactions are (∓0.8, 0.6)·N_i.
 * FIVE-MEMBER TRUSS (determinate). Loads 12 kip → at node 3 and 15 kip ↓ at node 4; pin at node 1, roller at node 2. ΣM about node 1: 16·R2 − 6·12 − 24·15 = 0 → R2 = 27.
 *   Joints: node 4: N(2-4)·0.6 + 15 = 0 (bar 2-4 comes up from node 2 at c = 0.8, s = 0.6, so the force it puts on node 4 is −N·(0.8, 0.6)): N(2-4) = −25, N(3-4) = 20.
 *   Node 2: R2 + 0.6·N(2-3) + 0.6·(−25) = 0 → N(2-3) = −20;  −N(1-2) − 0.8·N(2-3) + 0.8·N(2-4) = 0 → N(1-2) = −4.  Node 1: N(1-3) = 20, R1 = (−12, −12).
 * PROPPED CANTILEVER, L = 20 ft, w = 1.2 kip/ft ↓: R_roller = 3wL/8 = 9, R_fixed = 5wL/8 = 15, M_fixed = wL²/8 = 60 kip·ft (counter-clockwise), θ_roller = wL³/(48EI) = 1.655e-3 rad.
 * L-FRAME, a 12 ft column and a 10 ft beam, w = 1 kip/ft ↓ on the beam: ΣFy: R = 10; ΣM about the foot: M = 10·5 = 50 kip·ft (counter-clockwise); the column N = −10, M = −50 (tension on the outer face).
 * PORTAL, 20 × 10 ft, W14×48, H = 10 kip at the left top, inextensible members: r = (I/L)/(I/h) = 0.5, M_foot = H·h·(1 + 3r)/(2·(1 + 6r)) = 100·2.5/8 = 31.25, M_top = 100·1.5/8 = 18.75,
 *   column shear 5 kip each, vertical reactions ±(100 − 2·31.25)/20 = ±1.875 kip.
 * FIXED-FIXED BEAM, L = 20, P = 20 ↓ at a = 8 (b = 12): M_A = Pab²/L² = 57.6, M_B = Pa²b/L² = 38.4, R_A = Pb²(3a + b)/L³ = 12.96, R_B = Pa²(a + 3b)/L³ = 7.04.
 */
describe('textbook cases with hand answers (also in the comments of templates.ts)', () => {
  it('the two-bar truss: bars of −12.5 and −37.5 kip, reactions (10, 7.5) and (−30, 22.5), the apex moves 0.00647 in and −0.01724 in', () => {
    const s = solved(ofTemplate('truss-two-bar'));
    close(s.forces[0].bar!.N, -12.5);
    close(s.forces[1].bar!.N, -37.5);
    expect(s.reactions.map((r) => [r.label, r.value])).toEqual([['1x', expect.closeTo(10, 9)], ['1y', expect.closeTo(7.5, 9)], ['2x', expect.closeTo(-30, 9)], ['2y', expect.closeTo(22.5, 9)]]);
    // K_FF = [[37120, 0], [0, 20880]] kip/ft: the cs terms of the two bars cancel
    const kff = matrix(s, 'partition', 'K_FF');
    close(kff.values[0][0], 37120);
    close(kff.values[1][1], 20880);
    expect(Math.abs(kff.values[0][1])).toBeLessThan(1e-9);
    close(s.u[4], 20 / 37120);
    close(s.u[5], -30 / 20880);
    close(s.u[4] * 12, 0.0064655, 1e-4);
    close(s.u[5] * 12, -0.0172414, 1e-4);
    // stresses and elongations
    close(s.forces[0].bar!.stress, -12.5 / (10 / 144));
    close(s.forces[0].bar!.elongation, (-12.5 * 10) / 290000);
    close(s.forces[1].bar!.elongation, (-37.5 * 10) / 290000);
    // joint equilibrium at the apex by hand: −0.8·N1 + 0.8·N2 + 20 = 0, −0.6·N1 − 0.6·N2 − 30 = 0
    close(-0.8 * s.forces[0].bar!.N + 0.8 * s.forces[1].bar!.N + 20, 0, 1, 1e-9);
    close(-0.6 * s.forces[0].bar!.N - 0.6 * s.forces[1].bar!.N - 30, 0, 1, 1e-9);
  });
  it('the three-bar truss (indeterminate): N_v = 5000/179, N_i = 1800/179 kip, all tension', () => {
    const s = solved(ofTemplate('truss-three-bar'));
    close(s.forces[1].bar!.N, 5000 / 179);
    close(s.forces[0].bar!.N, 1800 / 179);
    close(s.forces[2].bar!.N, 1800 / 179);
    // the free node drops N_v·6/EA and does not move sideways
    close(s.u[7], -((5000 / 179) * 6) / 290000);
    expect(Math.abs(s.u[6])).toBeLessThan(1e-15);
    // reactions: the middle pin 27.933 up, the outer pins (∓8.045, 6.034)
    const r = Object.fromEntries(s.reactions.map((x) => [x.label, x.value]));
    close(r['2y'], 5000 / 179);
    close(r['1x'], -0.8 * (1800 / 179));
    close(r['3x'], 0.8 * (1800 / 179));
    close(r['1y'], 0.6 * (1800 / 179));
    close(r['3y'], 0.6 * (1800 / 179));
    close(r['2x'], 0, 1, 1e-12);
  });
  it('the five-member truss (determinate): −4, +20, −20, +20, −25 kip; reactions (−12, −12) and (0, 27)', () => {
    const s = solved(ofTemplate('truss-five-member'));
    [-4, 20, -20, 20, -25].forEach((n, k) => close(s.forces[k].bar!.N, n, 1e-9, 1e-9));
    const r = Object.fromEntries(s.reactions.map((x) => [x.label, x.value]));
    close(r['1x'], -12);
    close(r['1y'], -12);
    close(r['2y'], 27);
  });
  it('the propped cantilever: 3wL/8 = 9, 5wL/8 = 15 kip, wL²/8 = 60 kip·ft, θ = wL³/48EI = 1.655e-3 rad', () => {
    const s = solved(ofTemplate('frame-propped'));
    const r = Object.fromEntries(s.reactions.map((x) => [x.label, x.value]));
    close(r['1y'], 15);
    close(r['1θ'], 60);
    close(r['2y'], 9);
    close(r['1x'], 0, 1, 1e-9);
    const EI = (29000 * 144 * 600) / 20736;
    close(s.u[5], (1.2 * 8000) / (48 * EI));
    close(s.u[3], 0, 1, 1e-12);
    // the internal forces at the ends: V = 15 and −9, M = −60 (hogging) and 0
    expect(s.forces[0].start).toEqual({ N: expect.closeTo(0, 9), V: expect.closeTo(15, 9), M: expect.closeTo(-60, 9) });
    close(s.forces[0].end.V, -9);
    close(s.forces[0].end.M, 0, 1, 1e-9);
  });
  it('the L-frame: reactions (0, 10, 50); column N = −10, V = 0, M = −50; beam V = 10 and 0, M = −50 and 0', () => {
    const s = solved(ofTemplate('frame-l'));
    const r = Object.fromEntries(s.reactions.map((x) => [x.label, x.value]));
    close(r['1x'], 0, 1, 1e-9);
    close(r['1y'], 10);
    close(r['1θ'], 50);
    const [col, beam] = s.forces;
    close(col.start.N, -10);
    close(col.end.N, -10);
    close(col.start.V, 0, 1, 1e-9);
    close(col.start.M, -50);
    close(col.end.M, -50);
    close(beam.start.V, 10);
    close(beam.start.M, -50);
    close(beam.end.V, 0, 1, 1e-9);
    close(beam.end.M, 0, 1, 1e-9);
    close(beam.start.N, 0, 1, 1e-9);
  });
  it('the portal frame: the hand answer of the slope-deflection method to 3 %, and exactly when the members cannot shorten', () => {
    const portal = ofTemplate('frame-portal');
    const s = solved(portal);
    const r = Object.fromEntries(s.reactions.map((x) => [x.label, x.value]));
    close(r['1x'], -5, 0.05);
    close(r['2x'], -5, 0.05);
    close(r['1θ'], 31.25, 0.03);
    close(r['2θ'], 31.25, 0.03);
    close(r['2y'], 1.875, 0.03);
    close(r['1y'], -1.875, 0.03);
    // the beam ends carry M_top = 18.75
    close(Math.abs(s.forces[2].start.M), 18.75, 0.03);
    close(Math.abs(s.forces[2].end.M), 18.75, 0.03);
    // the same frame with members a hundred thousand times stiffer in tension: the hand answer to five figures
    const stiff = reduce(portal, { type: 'section', patch: { A: 14.1e5 } });
    const t = solved(stiff);
    const q = Object.fromEntries(t.reactions.map((x) => [x.label, x.value]));
    close(q['1x'], -5, 1e-4);
    close(q['2x'], -5, 1e-4);
    close(q['1θ'], 31.25, 1e-4);
    close(q['2θ'], 31.25, 1e-4);
    close(q['2y'], 1.875, 1e-4);
    close(Math.abs(t.forces[2].start.M), 18.75, 1e-4);
  });
  it('the fixed-fixed beam with a point load: M = Pab²/L² and Pa²b/L², R = Pb²(3a+b)/L³ and Pa²(a+3b)/L³; nothing is free', () => {
    const s = solved(ofTemplate('frame-fixed-point'));
    expect(s.free).toEqual([]);
    const r = Object.fromEntries(s.reactions.map((x) => [x.label, x.value]));
    close(r['1θ'], 57.6);
    close(r['2θ'], -38.4);
    close(r['1y'], 12.96);
    close(r['2y'], 7.04);
    expect(s.u.every((v) => v === 0)).toBe(true);
    // with no free DOF the solution step has nothing to eliminate
    expect(s.steps.map((x) => x.id)).not.toContain('augmented');
    expect(s.steps.map((x) => x.id)).not.toContain('forward-pass');
    expect(vector(s, 'solution', 'u_F').values).toEqual([]);
  });
  it('the same problems in SI give the same dimensionless answers', () => {
    const t = solved(ofTemplate('truss-two-bar', 'si'));
    close(t.forces[0].bar!.N, -12.5 * 4);
    close(t.forces[1].bar!.N, -37.5 * 4);
    const p = solved(ofTemplate('frame-propped', 'si'));
    const r = Object.fromEntries(p.reactions.map((x) => [x.label, x.value]));
    // L = 6 m, w = −20 kN/m: wL = 120
    close(r['1y'], (5 * 120) / 8);
    close(r['2y'], (3 * 120) / 8);
    close(r['1θ'], (120 * 6) / 8);
    const fp = solved(ofTemplate('frame-fixed-point', 'si'));
    const q = Object.fromEntries(fp.reactions.map((x) => [x.label, x.value]));
    const [P, a, b, L] = [80, 2.4, 3.6, 6];
    close(q['1θ'], (P * a * b * b) / (L * L));
    close(q['2θ'], -(P * a * a * b) / (L * L));
    close(q['1y'], (P * b * b * (3 * a + b)) / L ** 3);
    close(q['2y'], (P * a * a * (a + 3 * b)) / L ** 3);
    const th = solved(ofTemplate('truss-three-bar', 'si'));
    close(th.forces[1].bar!.N, (160 * 125) / 179);
  });
  it('a settlement of the roller of the propped cantilever: R = −3EIδ/L³ at the roller, +3EIδ/L³ and 3EIδ/L² at the fixed end', () => {
    const f = ofTemplate('frame-propped', 'us', (g) => {
      const noLoad = { ...g, memberLoads: [] };
      return reduce(noLoad, { type: 'patch', list: 'supports', id: g.supports[1].id, patch: { dy: -1 } });
    });
    const s = solved(f);
    const EI = (29000 * 144 * 600) / 20736;
    const delta = 1 / 12;
    const r = Object.fromEntries(s.reactions.map((x) => [x.label, x.value]));
    close(r['2y'], (-3 * EI * delta) / 8000);
    close(r['1y'], (3 * EI * delta) / 8000);
    close(r['1θ'], (3 * EI * delta) / 400);
    close(s.u[4], -delta);
    // the prescribed value is in the steps
    expect(vector(s, 'partition', 'u_R').values).toContain(-delta);
    expect(vector(s, 'partition', 'u_R').highlights).toEqual([{ index: 3, reason: 'prescribed' }]);
    expect(s.checks.every((c) => c.ok)).toBe(true);
  });
});

describe('the sign conventions of the contract, worked', () => {
  const beam = (load: StiffnessModel['memberLoads']): StiffnessModel => ({
    mode: 'frame',
    nodes: [{ x: 0, y: 0 }, { x: 10, y: 0 }],
    members: [{ i: 0, j: 1, E: 1000, A: 1, I: 10 }],
    supports: [{ node: 0, ux: true, uy: true, rz: true }, { node: 1, ux: true, uy: true, rz: true }],
    loads: [],
    memberLoads: load,
  });
  const run = (m: StiffnessModel): Solution => {
    const out = solve(m);
    if (!out.ok) throw new Error(JSON.stringify(out.issues));
    return out;
  };
  it('a UDL of 2 kip/ft down on a member fixed at both ends: f_FE = [0, 10, 16.667, 0, 10, −16.667]; V = +10 and −10, M = −16.667 at both ends', () => {
    const s = run(beam([{ kind: 'udl', member: 0, w: -2 }]));
    const fe = s.forces[0].fixedEnd!;
    [0, 10, 100 / 6, 0, 10, -100 / 6].forEach((v, k) => close(fe[k], v, 1e-12, 1e-12));
    expect(s.forces[0].f).toEqual(fe);
    expect(s.forces[0].start).toEqual({ N: 0, V: 10, M: -100 / 6 });
    expect(s.forces[0].end.V).toBe(-10);
    close(s.forces[0].end.M, -100 / 6);
    // the reactions are the same forces, on the structure
    s.reactions.forEach((r, k) => close(r.value, s.forces[0].f[k], 1e-12, 1e-12));
  });
  it('a point load of 20 down at a = 4 on a member fixed at both ends: M_i = Pab²/L² (counter-clockwise on the member), V_i = Pb²(3a+b)/L³', () => {
    const s = run(beam([{ kind: 'point', member: 0, a: 4, P: -20 }]));
    const [a, b, L, P] = [4, 6, 10, 20];
    const fe = s.forces[0].fixedEnd!;
    close(fe[1], (P * b * b * (3 * a + b)) / L ** 3);
    close(fe[2], (P * a * b * b) / (L * L));
    close(fe[4], (P * a * a * (a + 3 * b)) / L ** 3);
    close(fe[5], -(P * a * a * b) / (L * L));
    // hogging at both ends, so M is negative there
    close(s.forces[0].start.M, -(P * a * b * b) / (L * L));
    close(s.forces[0].end.M, -(P * a * a * b) / (L * L));
  });
  it('an axial load q along the member, fixed at both ends: N = +qL/2 (tension) at the start, −qL/2 at the end', () => {
    const s = run(beam([{ kind: 'axial', member: 0, q: 2 }]));
    close(s.forces[0].start.N, 10);
    close(s.forces[0].end.N, -10);
    expect(s.forces[0].fixedEnd).toEqual([-10, 0, 0, -10, 0, 0]);
  });
  it('the same beam drawn from right to left: ȳ points down, so the same sagging beam has M = −25 at midspan, and V keeps its place', () => {
    // simply supported at both ends (roller x free at node 2), a UDL of 2 down, drawn from node 2 (10, 0) to node 1 (0, 0)
    const model = (flip: boolean): StiffnessModel => ({
      mode: 'frame',
      nodes: [{ x: 0, y: 0 }, { x: 10, y: 0 }],
      members: [flip ? { i: 1, j: 0, E: 1000, A: 1, I: 10 } : { i: 0, j: 1, E: 1000, A: 1, I: 10 }],
      supports: [{ node: 0, ux: true, uy: true, rz: false }, { node: 1, ux: false, uy: true, rz: false }],
      loads: [],
      memberLoads: [{ kind: 'udl', member: 0, w: flip ? 2 : -2 }], // (w along ȳ: down is +ȳ when drawn right to left)
    });
    const a = run(model(false));
    const b = run(model(true));
    close(a.reactions[1].value, 10);
    close(b.reactions[1].value, 10);
    // left-to-right: V(0) = +10, V(L) = −10, ends have M = 0
    close(a.forces[0].start.V, 10);
    close(a.forces[0].end.V, -10);
    // right-to-left: V(start) = −10 (at the right end), V(end) = +10
    close(b.forces[0].start.V, -10);
    close(b.forces[0].end.V, 10);
  });
  it('a bar is positive in tension: a bar pulled by 10 kip has N = +10 and lengthens', () => {
    const out = solve({
      mode: 'truss',
      nodes: [{ x: 0, y: 0 }, { x: 5, y: 0 }],
      members: [{ i: 0, j: 1, E: 1000, A: 2 }],
      supports: [{ node: 0, ux: true, uy: true, rz: false }, { node: 1, ux: false, uy: true, rz: false }],
      loads: [{ node: 1, fx: 10, fy: 0, m: 0 }],
      memberLoads: [],
    });
    if (!out.ok) throw new Error('x');
    close(out.forces[0].bar!.N, 10);
    close(out.forces[0].bar!.elongation, (10 * 5) / 2000);
    close(out.forces[0].bar!.stress, 5);
    expect(out.forces[0].start.N).toBe(10);
    expect(out.forces[0].end.N).toBe(10);
  });
});

describe('the worked solution: its steps', () => {
  it('the two-bar truss gives the 25 steps in order, every key once, stages never going back', () => {
    const s = solved(ofTemplate('truss-two-bar'));
    expect(s.steps.map((x) => x.key)).toEqual([
      'structure',
      'geometry#1',
      'geometry#2',
      'local-stiffness#1',
      'local-stiffness#2',
      'transformation#1',
      'transformation#2',
      'global-member#1',
      'global-member#2',
      'assembly#1',
      'assembly#2',
      'assembled',
      'nodal-loads',
      'load-vector',
      'partition',
      'reduced',
      'augmented',
      'forward-pass#1',
      'back-substitution#1',
      'back-substitution#2',
      'solution',
      'displacements',
      'reactions',
      'end-forces#1',
      'end-forces#2',
      'checks',
    ]);
    expect(new Set(s.steps.map((x) => x.key)).size).toBe(s.steps.length);
    let last = 0;
    for (const x of s.steps) {
      expect(x.number).toBeGreaterThanOrEqual(last);
      expect(x.number).toBe(STAGE_OF[x.id]);
      last = x.number;
    }
    expect(s.steps.map((x) => x.number)).toEqual([1, 2, 2, 3, 3, 4, 4, 5, 5, 6, 6, 6, 7, 7, 8, 9, 10, 10, 10, 10, 10, 11, 12, 13, 13, 14]);
    for (const x of s.steps) expect(STEP_IDS).toContain(x.id);
  });
  it('a step is computed from earlier steps only, and says which', () => {
    for (const template of TEMPLATE_IDS) {
      const s = solved(ofTemplate(template));
      const seen = new Set<string>();
      for (const x of s.steps) {
        for (const from of x.from) expect(seen.has(from), `${template}: ${x.key} from ${from}`).toBe(true);
        seen.add(x.key);
      }
    }
  });
  it('the scope of a step is the structure or one member, with its label', () => {
    const s = solved(ofTemplate('frame-l'));
    for (const x of s.steps) {
      if (['geometry', 'local-stiffness', 'transformation', 'global-member', 'assembly', 'member-loads', 'end-forces'].includes(x.id)) {
        expect(x.scope).toEqual({ kind: 'member', member: x.sub });
      } else expect(x.scope).toEqual({ kind: 'structure' });
    }
    // a member load makes a member-loads step for the loaded member only
    expect(s.steps.filter((x) => x.id === 'member-loads').map((x) => x.key)).toEqual(['member-loads#2']);
    const t = solved(ofTemplate('truss-two-bar'));
    expect(t.steps.some((x) => x.id === 'member-loads')).toBe(false);
  });
  it('structure: the numbering of the DOFs, which are free and which restrained, with the prescribed values', () => {
    const s = solved(ofTemplate('frame-propped'));
    expect(matrix(s, 'structure', 'dof-numbers').values).toEqual([[1, 2, 3], [4, 5, 6]]);
    expect(matrix(s, 'structure', 'restraints').values).toEqual([[1, 1, 1], [0, 1, 0]]);
    expect(matrix(s, 'structure', 'restraints').colLabels).toEqual(['x', 'y', 'θ']);
    expect(s.dofs.map((d) => d.label)).toEqual(['1x', '1y', '1θ', '2x', '2y', '2θ']);
    expect(s.dofs.map((d) => d.free)).toEqual([null, null, null, 1, null, 2]);
    expect(s.free).toEqual([4, 6]);
    expect(s.restrained).toEqual([1, 2, 3, 5]);
    const t = solved(ofTemplate('truss-five-member'));
    expect(t.dofs.map((d) => d.number)).toEqual([1, 2, 3, 4, 5, 6, 7, 8]);
    expect(t.nodes[3].dofs).toEqual([7, 8]);
    expect(step(t, 'structure').formulas).toEqual(['DOF(n, x) = 2n − 1', 'DOF(n, y) = 2n']);
    expect(step(s, 'structure').formulas).toEqual(['DOF(n, x) = 3n − 2', 'DOF(n, y) = 3n − 1', 'DOF(n, θ) = 3n']);
    expect(step(t, 'structure').facts).toMatchObject({ mode: 'truss', nodes: 4, members: 5, dofsPerNode: 2, dofs: 8, free: 5, restrained: 3 });
  });
  it('geometry: L, c, s, the angle', () => {
    const s = solved(ofTemplate('truss-two-bar'));
    expect(scalar(s, 'geometry#1', 'L')).toBe(10);
    close(scalar(s, 'geometry#1', 'c'), 0.8);
    close(scalar(s, 'geometry#1', 's'), 0.6);
    close(scalar(s, 'geometry#2', 'c'), -0.8);
    close(scalar(s, 'geometry#1', 'θ'), (Math.atan2(6, 8) * 180) / Math.PI);
    expect(s.members[1].angle).toBeCloseTo(180 - 36.8698976, 6);
    // a vertical and a horizontal member have exact direction cosines and angles
    const l = solved(ofTemplate('frame-l'));
    expect([l.members[0].c, l.members[0].s, l.members[0].angle]).toEqual([0, 1, 90]);
    expect([l.members[1].c, l.members[1].s, l.members[1].angle]).toEqual([1, 0, 0]);
  });
  it('local stiffness: the matrix and its named terms, a bar and a beam-column', () => {
    const s = solved(ofTemplate('frame-propped'));
    const k = matrix(s, 'local-stiffness#1', 'k');
    expect(k.rowLabels).toEqual(['u1', 'v1', 'θ1', 'u2', 'v2', 'θ2']);
    const EA = 29000 * 144 * (10 / 144);
    const EI = (29000 * 144 * 600) / 20736;
    const L = 20;
    close(k.values[0][0], EA / L);
    close(k.values[1][1], (12 * EI) / L ** 3);
    close(k.values[1][2], (6 * EI) / L ** 2);
    close(k.values[2][2], (4 * EI) / L);
    close(k.values[2][5], (2 * EI) / L);
    expect(k.symbolic![1][1]).toBe('12EI/L³');
    expect(k.symbolic![1][4]).toBe('−12EI/L³');
    expect(k.symbolic![0][3]).toBe('−EA/L');
    expect(k.symbolic![0][1]).toBe('0');
    close(scalar(s, 'local-stiffness#1', '4EI/L'), (4 * EI) / L);
    close(scalar(s, 'local-stiffness#1', '12EI/L³'), (12 * EI) / L ** 3);
    // symmetric
    for (let a = 0; a < 6; a++) for (let b = 0; b < 6; b++) expect(k.values[a][b]).toBe(k.values[b][a]);
    // highlights: axial and bending terms, every non-zero entry once
    const reasons = new Set(k.highlights!.map((h) => h.reason));
    expect([...reasons].sort()).toEqual(['axial', 'bending']);
    expect(k.highlights!.length).toBe(20);
    const bar = solved(ofTemplate('truss-two-bar'));
    const kb = matrix(bar, 'local-stiffness#1', 'k');
    expect(kb.rowLabels).toEqual(['u1', 'u3']);
    expect(kb.values).toEqual([[29000, -29000], [-29000, 29000]]);
    expect(kb.symbolic).toEqual([['EA/L', '−EA/L'], ['−EA/L', 'EA/L']]);
  });
  it('transformation: T and its symbolic form; T rotates a unit vector', () => {
    const s = solved(ofTemplate('truss-two-bar'));
    const T = matrix(s, 'transformation#1', 'T');
    expect(T.rowLabels).toEqual(['u1', 'u3']);
    expect(T.colLabels).toEqual(['1x', '1y', '3x', '3y']);
    close(T.values[0][0], 0.8);
    close(T.values[0][1], 0.6);
    expect(T.values[0][2]).toBe(0);
    expect(T.symbolic).toEqual([['c', 's', '0', '0'], ['0', '0', 'c', 's']]);
    const f = solved(ofTemplate('frame-portal'));
    const Tf = matrix(f, 'transformation#1', 'T'); // the vertical left column: c = 0, s = 1
    expect(Tf.values[0]).toEqual([0, 1, 0, 0, 0, 0]);
    expect(Tf.values[1]).toEqual([-1, 0, 0, 0, 0, 0]);
    expect(Tf.values[2]).toEqual([0, 0, 1, 0, 0, 0]);
    expect(Tf.symbolic![1]).toEqual(['−s', 'c', '0', '0', '0', '0']);
  });
  it('global member matrix: K_e = Tᵀ k T, its code vector, and in a truss the closed form that equals it', () => {
    const s = solved(ofTemplate('truss-two-bar'));
    const Ke = matrix(s, 'global-member#1', 'K_e');
    expect(Ke.rowLabels).toEqual(['1x', '1y', '3x', '3y']);
    // (EA/L)·[c², cs, −c², −cs; …] with EA/L = 29000, c = 0.8, s = 0.6
    close(Ke.values[0][0], 29000 * 0.64);
    close(Ke.values[0][1], 29000 * 0.48);
    close(Ke.values[1][1], 29000 * 0.36);
    close(Ke.values[0][2], -29000 * 0.64);
    expect(vector(s, 'global-member#2', 'code').values).toEqual([3, 4, 5, 6]);
    expect(vector(s, 'global-member#1', 'code').values).toEqual([1, 2, 5, 6]);
    const closed = matrix(s, 'global-member#1', 'K_e_closed');
    expect(closed.factor).toBe('EA/L');
    expect(closed.factorValue).toBe(29000);
    expect(closed.symbolic![0]).toEqual(['c²', 'cs', '−c²', '−cs']);
    closed.values.forEach((row, a) => row.forEach((v, b) => close(v, Ke.values[a][b], 1e-12, 1e-9)));
    for (const k of [1, 2]) expect(step(s, `global-member#${k}`).facts.agree).toBe(true);
    // frame mode: the code of a member between nodes 1 and 3 is 1,2,3,7,8,9
    const f = solved(ofTemplate('frame-portal'));
    expect(vector(f, 'global-member#1', 'code').values).toEqual([1, 2, 3, 7, 8, 9]);
    expect(vector(f, 'global-member#3', 'code').values).toEqual([7, 8, 9, 10, 11, 12]);
    expect(matrix(f, 'global-member#1', 'kT').rowLabels).toEqual(['u1', 'v1', 'θ1', 'u3', 'v3', 'θ3']);
    // a column's global matrix swaps axial and bending
    const col = matrix(f, 'global-member#1', 'K_e');
    close(col.values[0][0], (12 * 29000 * 144 * (484 / 20736)) / 1000);
    close(col.values[1][1], (29000 * 144 * (14.1 / 144)) / 10);
  });
  it('assembly: the member is placed by its code vector, member by member, and the running K shows who contributed', () => {
    const s = solved(ofTemplate('truss-two-bar'));
    const a1 = step(s, 'assembly#1');
    const c1 = matrix(s, 'assembly#1', 'contribution');
    const r1 = matrix(s, 'assembly#1', 'running');
    expect(c1.rowLabels).toEqual(['1x', '1y', '2x', '2y', '3x', '3y']);
    // member 1 spans DOFs 1, 2, 5, 6: a 4 × 4 block of positions in a 6 × 6 matrix, 16 cells, nothing elsewhere
    expect(c1.highlights).toHaveLength(16);
    expect(a1.facts).toMatchObject({ member: 1, cells: 16 });
    expect(c1.values[2][2]).toBe(0);
    expect(c1.values[0][0]).toBe(matrix(s, 'global-member#1', 'K_e').values[0][0]);
    expect(r1.values).toEqual(c1.values);
    const r2 = matrix(s, 'assembly#2', 'running');
    const c2 = matrix(s, 'assembly#2', 'contribution');
    // the running K after member 2 is member 1's plus member 2's, cell by cell
    for (let a = 0; a < 6; a++) for (let b = 0; b < 6; b++) expect(r2.values[a][b]).toBe(r1.values[a][b] + c2.values[a][b]);
    expect(r2.highlights!.every((h) => h.reason === 'contributed')).toBe(true);
    // the apex block (DOFs 5 and 6) is shared by both members
    const K = matrix(s, 'assembled', 'K');
    const shared = K.highlights!.filter((h) => h.reason === 'shared');
    expect(shared).toHaveLength(4);
    expect(shared.every((h) => h.members!.join() === '1,2' && h.row >= 4 && h.col >= 4)).toBe(true);
    expect(K.highlights!.filter((h) => h.reason === 'contributed').every((h) => h.members!.length === 1)).toBe(true);
    // cells nobody contributed to are not marked
    expect(K.highlights!.some((h) => h.row === 0 && h.col === 2)).toBe(false);
    expect(K.values).toEqual(s.K);
    expect(step(s, 'assembled').facts.symmetric).toBe(true);
  });
  it('the load vector: nodal loads, and in frame mode the member loads as fixed-end forces and equivalent nodal loads', () => {
    const t = solved(ofTemplate('truss-two-bar'));
    expect(vector(t, 'nodal-loads', 'P_nodal').values).toEqual([0, 0, 0, 0, 20, -30]);
    expect(vector(t, 'load-vector', 'P').values).toEqual([0, 0, 0, 0, 20, -30]);
    expect(step(t, 'load-vector').blocks.map((b) => b.name)).toEqual(['P']);
    const f = solved(ofTemplate('frame-propped'));
    const key = 'member-loads#1';
    expect(vector(f, key, 'f_FE', 'udl#1').values).toEqual([0, 12, 40, 0, 12, -40]);
    expect(vector(f, key, 'f_FE', 'udl#1').symbolic).toEqual(['0', '−wL/2', '−wL²/12', '0', '−wL/2', 'wL²/12']);
    expect(vector(f, key, 'equivalent').values).toEqual([0, -12, -40, 0, -12, 40]);
    expect(vector(f, 'load-vector', 'P_equivalent').values).toEqual([0, -12, -40, 0, -12, 40]);
    expect(vector(f, 'load-vector', 'P').values).toEqual([0, -12, -40, 0, -12, 40]);
    expect(step(f, key).formulas).toContain('wL²/12');
    // both loads of a member: a UDL and a point load, summed
    const g = ofTemplate('frame-propped', 'us', (h) => reduce(h, { type: 'add', list: 'memberLoads', seed: { kind: 'point', a: 8, P: -20 } }));
    const s = solved(g);
    expect(step(s, 'member-loads#1').blocks.filter((b) => b.name === 'f_FE').map((b) => b.tag)).toEqual(['udl#1', 'point#2', 'total']);
    const total = vector(s, 'member-loads#1', 'f_FE', 'total').values;
    const udl = vector(s, 'member-loads#1', 'f_FE', 'udl#1').values;
    const pt = vector(s, 'member-loads#1', 'f_FE', 'point#2').values;
    total.forEach((v, k) => close(v, udl[k] + pt[k], 1e-12, 1e-12));
    expect(scalar(s, 'member-loads#1', 'b')).toBe(12);
    expect(step(s, 'member-loads#1').formulas).toEqual(expect.arrayContaining(['Pb²(3a+b)/L³', 'Pab²/L²', 'Pa²(a+3b)/L³', 'Pa²b/L²', 'wL/2', 'wL²/12', 'b = L − a']));
    // an inclined member: the equivalent loads are in global axes
    const inc = solve({
      mode: 'frame',
      nodes: [{ x: 0, y: 0 }, { x: 8, y: 6 }],
      members: [{ i: 0, j: 1, E: 1000, A: 10, I: 100 }],
      supports: [{ node: 0, ux: true, uy: true, rz: true }],
      loads: [],
      memberLoads: [{ kind: 'udl', member: 0, w: 1 }],
    });
    if (!inc.ok) throw new Error('inc');
    const eq = vector(inc, 'member-loads#1', 'equivalent').values;
    // w = 1 along ȳ = (−0.6, 0.8): resultant wL = 10 along (−0.6, 0.8), half at each end
    close(eq[0], -3, 1e-12);
    close(eq[1], 4, 1e-12);
    close(eq[3], -3, 1e-12);
    close(eq[4], 4, 1e-12);
    close(eq[2], 100 / 12, 1e-12); // wL²/12 counter-clockwise
    close(eq[5], -100 / 12, 1e-12);
  });
  it('the partition: K_FF, K_FR, K_RF, K_RR, P_F, P_R, u_R with their DOF labels', () => {
    const s = solved(ofTemplate('frame-propped'));
    expect(matrix(s, 'partition', 'K_FF').rowLabels).toEqual(['2x', '2θ']);
    expect(matrix(s, 'partition', 'K_FR').colLabels).toEqual(['1x', '1y', '1θ', '2y']);
    expect(matrix(s, 'partition', 'K_RF').rowLabels).toEqual(['1x', '1y', '1θ', '2y']);
    expect(matrix(s, 'partition', 'K_RR').values).toHaveLength(4);
    expect(vector(s, 'partition', 'P_F').values).toEqual([0, 40]);
    expect(vector(s, 'partition', 'P_R').values).toEqual([0, -12, -40, -12]);
    expect(s.K[3][3]).toBe(matrix(s, 'partition', 'K_FF').values[0][0]);
    // the reduced equation
    expect(vector(s, 'reduced', 'rhs').values).toEqual([0, 40]);
    expect(step(s, 'reduced').formulas).toEqual(['K_FF·u_F = P_F − K_FR·u_R']);
  });
  it('the elimination: one pass per row but the last, then one unknown at a time, the last first', () => {
    const s = solved(ofTemplate('truss-three-bar'));
    // 2 free DOFs → 1 pass, 2 back-substitutions
    expect(s.steps.filter((x) => x.id === 'forward-pass')).toHaveLength(1);
    const portal = solved(ofTemplate('frame-portal'));
    // 12 DOFs, 6 restrained → 6 free: 5 passes, 6 unknowns
    expect(portal.free).toHaveLength(6);
    const passes = portal.steps.filter((x) => x.id === 'forward-pass');
    expect(passes.map((x) => x.sub)).toEqual([1, 2, 3, 4, 5]);
    const backs = portal.steps.filter((x) => x.id === 'back-substitution');
    expect(backs.map((x) => x.facts.unknown)).toEqual([6, 5, 4, 3, 2, 1]);
    expect(backs.map((x) => x.sub)).toEqual([1, 2, 3, 4, 5, 6]);
    // pass 1: the pivot is the first diagonal entry of K_FF, the multipliers are a_i1 / a_11, and column 1 is zero below the pivot afterwards
    const kff = matrix(portal, 'partition', 'K_FF').values;
    const rhs = vector(portal, 'reduced', 'rhs').values;
    const first = passes[0];
    close(first.facts.pivot as number, kff[0][0]);
    const mult = first.blocks.find((b): b is VectorBlock => b.type === 'vector' && b.name === 'multipliers')!;
    expect(mult.labels).toEqual(portal.free.slice(1).map((d) => portal.dofs[d - 1].label));
    mult.values.forEach((l, k) => close(l, kff[k + 1][0] / kff[0][0], 1e-12, 1e-15));
    const aug = first.blocks.find((b): b is MatrixBlock => b.type === 'matrix')!;
    expect(aug.colLabels[aug.colLabels.length - 1]).toBe('rhs');
    for (let i = 1; i < 6; i++) expect(aug.values[i][0]).toBe(0);
    close(aug.values[1][6], rhs[1] - mult.values[0] * rhs[0], 1e-12, 1e-12);
    expect(aug.highlights!.find((h) => h.reason === 'pivot')).toEqual({ row: 0, col: 0, reason: 'pivot' });
    // (marked: the entries under the pivot that were not already 0, which are the rows whose multiplier is not 0; and only entries whose value changed are 'updated')
    expect(aug.highlights!.filter((h) => h.reason === 'eliminated')).toHaveLength(mult.values.filter((l) => l !== 0).length);
    expect(mult.values.some((l) => l === 0)).toBe(true);
    expect(mult.values.some((l) => l !== 0)).toBe(true);
    // after the last pass the matrix is upper triangular
    const lastAug = passes[4].blocks.find((b): b is MatrixBlock => b.type === 'matrix')!;
    for (let i = 0; i < 6; i++) for (let j = 0; j < i; j++) expect(lastAug.values[i][j]).toBe(0);
    // the unknowns come out in the solution
    const uF = vector(portal, 'solution', 'u_F').values;
    backs.forEach((b) => expect(uF[(b.facts.unknown as number) - 1]).toBe(b.facts.value));
    expect(step(portal, 'solution').facts).toMatchObject({ recorded: true, free: 6 });
    expect(step(portal, 'solution').facts.residual as number).toBeLessThan(1e-9);
  });
  it('a structure with more than 12 free DOFs is solved but only the result is recorded, with a code saying why', () => {
    // a ladder frame of 6 storeys: 14 nodes is over the cap, so 12 nodes of 3 DOFs, 3 restrained at the foot of one column and nothing else → 33 free
    const f = ofTemplate('frame-portal', 'us', (g) => {
      let h: StiffnessForm = reduce(g, { type: 'clear' });
      for (let k = 0; k < 8; k++) h = reduce(h, { type: 'add', list: 'nodes' });
      h = { ...h, nodes: h.nodes.map((n, k) => ({ ...n, x: (k % 4) * 10, y: Math.floor(k / 4) * 10 })) };
      const ids = h.nodes.map((n) => n.id);
      const pairs: [number, number][] = [[0, 1], [1, 2], [2, 3], [4, 5], [5, 6], [6, 7], [0, 4], [1, 5], [2, 6], [3, 7]];
      for (const [a, b] of pairs) h = reduce(h, { type: 'add', list: 'members', seed: { i: ids[a], j: ids[b] } });
      h = reduce(h, { type: 'add', list: 'supports', seed: { node: ids[0], preset: 'fixed' } });
      h = reduce(h, { type: 'add', list: 'supports', seed: { node: ids[3], preset: 'fixed' } });
      return reduce(h, { type: 'add', list: 'loads', seed: { node: ids[7], fx: 10, fy: -5 } });
    });
    const s = solved(f);
    expect(s.free).toHaveLength(18);
    const ids = s.steps.map((x) => x.id);
    expect(ids).not.toContain('augmented');
    expect(ids).not.toContain('forward-pass');
    expect(ids).not.toContain('back-substitution');
    const sol = step(s, 'solution');
    expect(sol.facts).toMatchObject({ recorded: false, why: 'too-many-free-dofs', limit: 12, free: 18 });
    expect(vector(s, 'solution', 'u_F').values).toHaveLength(18);
    expect(s.checks.every((c) => c.ok)).toBe(true);
  });
  it('the boundary: 12 free DOFs are recorded, 13 are not', () => {
    const make = (free: number): StiffnessModel => {
      // A triangulated strip of n nodes along x (a zigzag, every node joined to the next and to the one two before it): 2n − 3 bars. Held by r reaction
      // components, pin + roller (3) or two pins (4), it has 2n − r free DOFs.
      const n = Math.ceil((free + 3) / 2);
      const r = 2 * n - free;
      const nodes = Array.from({ length: n }, (_, k) => ({ x: k * 4, y: (k % 2) * 3 }));
      const members = Array.from({ length: n - 1 }, (_, k) => ({ i: k, j: k + 1, E: 1000, A: 1 }));
      for (let k = 2; k < n; k++) members.push({ i: k - 2, j: k, E: 1000, A: 1 });
      return {
        mode: 'truss',
        nodes,
        members,
        supports: r === 3 ? [{ node: 0, ux: true, uy: true, rz: false }, { node: 1, ux: false, uy: true, rz: false }] : [{ node: 0, ux: true, uy: true, rz: false }, { node: 1, ux: true, uy: true, rz: false }],
        loads: [{ node: n - 1, fx: 1, fy: -2, m: 0 }],
        memberLoads: [],
      };
    };
    const a = solve(make(11));
    if (!a.ok) throw new Error(JSON.stringify(a.issues));
    expect(a.free.length).toBe(11);
    const b = solve(make(13));
    if (!b.ok) throw new Error(JSON.stringify(b.issues));
    expect(b.free.length).toBe(13);
    expect(a.steps.some((x) => x.id === 'forward-pass')).toBe(true);
    expect(b.steps.some((x) => x.id === 'forward-pass')).toBe(false);
    expect(step(b, 'solution').facts.recorded).toBe(false);
    const c = solve(make(12));
    if (!c.ok) throw new Error(JSON.stringify(c.issues));
    expect(c.free.length).toBe(12);
    expect(step(c, 'solution').facts.recorded).toBe(true);
    expect(c.steps.filter((x) => x.id === 'forward-pass')).toHaveLength(11);
  });
  it('displacements, reactions and member end forces', () => {
    const s = solved(ofTemplate('frame-l'));
    expect(vector(s, 'displacements', 'u').values).toEqual(s.u);
    expect(vector(s, 'displacements', 'u').labels).toEqual(s.dofs.map((d) => d.label));
    const KRF = vector(s, 'reactions', 'K_RF·u_F').values;
    const KRR = vector(s, 'reactions', 'K_RR·u_R').values;
    const PR = vector(s, 'reactions', 'P_R').values;
    const R = vector(s, 'reactions', 'R').values;
    // (the reactions are worked in 32 digits and printed as doubles: the three printed parts, added in doubles, give R to the rounding of the parts, and a reaction that is 0 prints 0)
    R.forEach((v, k) => expect(Math.abs(v - (KRF[k] + KRR[k] - PR[k]))).toBeLessThanOrEqual(1e-12 * (Math.abs(KRF[k]) + Math.abs(KRR[k]) + Math.abs(PR[k]))));
    expect(s.reactions.map((r) => r.value)).toEqual(R);
    // end forces of member 2 (the loaded beam): u_e is picked by the code vector, u_local = T u_e, f = k u_local + f_FE
    const ue = vector(s, 'end-forces#2', 'u_e').values;
    expect(ue).toEqual(s.members[1].code.map((d) => s.u[d - 1]));
    const f = vector(s, 'end-forces#2', 'f').values;
    const fk = vector(s, 'end-forces#2', 'k·u_local').values;
    const fe = vector(s, 'end-forces#2', 'f_FE').values;
    f.forEach((v, k) => expect(v).toBe(fk[k] + fe[k]));
    const ends = matrix(s, 'end-forces#2', 'ends');
    expect(ends.rowLabels).toEqual(['N', 'V', 'M']);
    expect(ends.colLabels).toEqual(['i', 'j']);
    expect(ends.values[1]).toEqual([s.forces[1].start.V, s.forces[1].end.V]);
    // a member without a load has no fixed-end forces in its step
    expect(step(s, 'end-forces#1').blocks.some((b) => b.name === 'f_FE')).toBe(false);
    expect(s.forces[0].fixedEnd).toBeNull();
    // a bar: N, stress, elongation
    const t = solved(ofTemplate('truss-two-bar'));
    expect(scalar(t, 'end-forces#1', 'N')).toBe(t.forces[0].bar!.N);
    expect(scalar(t, 'end-forces#1', 'σ')).toBe(t.forces[0].bar!.stress);
    expect(scalar(t, 'end-forces#1', 'δ')).toBe(t.forces[0].bar!.elongation);
    expect(step(t, 'end-forces#1').formulas).toContain('N = f_2 = (EA/L)(u_j − u_i)');
  });
  it('the checks: equilibrium of the whole and of every joint, the energy identity, the residual of K u = P + R', () => {
    for (const template of TEMPLATE_IDS) {
      const s = solved(ofTemplate(template));
      expect(s.checks.map((c) => c.id)).toEqual(['sum-fx', 'sum-fy', 'sum-moment', 'joints', 'energy', 'system', 'solve']);
      for (const c of s.checks) expect(c.ok, `${template} ${c.id} ${c.value} ${c.scale}`).toBe(true);
      expect(step(s, 'checks').facts.allOk).toBe(true);
    }
    const s = solved(ofTemplate('frame-portal'));
    const about = step(s, 'checks').facts;
    expect([about.aboutX, about.aboutY]).toEqual([10, 5]);
    expect(s.about).toEqual({ x: 10, y: 5 });
    expect(s.size).toBeCloseTo(Math.hypot(20, 10), 12);
    const U = scalar(s, 'checks', 'U');
    const W = scalar(s, 'checks', 'W');
    close(U, W, 1e-12);
    // for a structure that does not settle, ½uᵀKu = ½uᵀP
    close(U, 0.5 * s.u.reduce((acc, v, k) => acc + v * s.P[k], 0), 1e-12);
    // the energy of the two-bar truss, by hand: ½(20·ux − 30·uy)
    const t = solved(ofTemplate('truss-two-bar'));
    close(scalar(t, 'checks', 'U'), 0.5 * (20 * (20 / 37120) + 30 * (30 / 20880)), 1e-12);
  });
  it('the units of the steps: kip and ft, kN and m', () => {
    const us = solved(ofTemplate('truss-two-bar'));
    const si = solved(ofTemplate('truss-two-bar', 'si'));
    // E in kip/ft² and kN/m²
    expect(matrix(us, 'structure', 'sections').values[0][0]).toBe(29000 * 144);
    expect(matrix(si, 'structure', 'sections').values[0][0]).toBe(200e6);
    expect(matrix(si, 'structure', 'sections').values[0][1]).toBeCloseTo(6000e-6, 15);
    expect(si.forces[0].bar!.stress / 1000).toBeCloseTo(-50000 / 6000, 6); // N / A = −50 kN / 6000 mm², in MPa
    expect(KIP).toBeGreaterThan(4.448);
  });
  it('a truss never asks for I, and ignores a moment on a node, a rotation settlement and the member loads, whatever they hold', () => {
    const out = solve({
      mode: 'truss',
      nodes: [{ x: 0, y: 0 }, { x: 4, y: 3 }],
      members: [{ i: 0, j: 1, E: 1000, A: 1, I: Number.NaN }],
      supports: [{ node: 0, ux: true, uy: true, rz: true, dr: Number.NaN }, { node: 1, ux: false, uy: true, rz: false }],
      loads: [{ node: 1, fx: 5, fy: 0, m: Number.NaN }],
      memberLoads: [{ kind: 'udl', member: 7, w: Number.NaN }],
    });
    expect(out.ok).toBe(true);
    if (out.ok) expect(out.warnings).toEqual([{ code: 'member-loads-ignored', count: 1 }]);
  });
  it('is deterministic: the same model gives the very same steps', () => {
    const a = solve(toEngine(ofTemplate('frame-portal')).model);
    const b = solve(toEngine(ofTemplate('frame-portal')).model);
    expect(JSON.stringify(a)).toBe(JSON.stringify(b));
  });
  it('the same structure after a round trip of units gives the same dimensionless answer', () => {
    const us = ofTemplate('frame-portal');
    const back = convertStiffness(convertStiffness(us, 'si'), 'us');
    expect(back).toEqual({ ...us, notice: null });
    const a = analyseSafely(us);
    const b = analyseSafely(back);
    expect(JSON.stringify(a.results)).toBe(JSON.stringify(b.results));
  });
});
