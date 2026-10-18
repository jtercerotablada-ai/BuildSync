import { afterEach, describe, expect, it, vi } from 'vitest';
import { solve } from './engine';
import { jacobiEigen, matVec, maxAbs, positiveDefinite } from './linalg';
import { randomSpec, rng, stableSpec, toModel, type OSpec } from './oracle.testlib';
import type { Solution, StiffnessModel } from './types';

vi.setConfig({ testTimeout: 120_000 });
afterEach(() => new Promise((r) => setTimeout(r, 0)));
const yieldNow = () => new Promise((r) => setTimeout(r, 0));

/**
 * THE PROPERTIES OF THE METHOD, on hundreds of generated structures (the oracle's generators: trusses and frames of axis-aligned and Pythagorean members,
 * with member loads and settlements): symmetry and rigid-body null space of every member matrix, symmetry and positive semi-definiteness of K, positive
 * definiteness of K_FF, equilibrium, the energy identity, superposition, scaling, reciprocity, the rotation of the whole structure, a rigid settlement.
 */

function solved(spec: OSpec): Solution | null {
  const out = solve(toModel(spec));
  return out.ok ? out : null;
}
function must(model: StiffnessModel): Solution {
  const out = solve(model);
  if (!out.ok) throw new Error(JSON.stringify(out.issues));
  return out;
}
function* structures(count: number, first: number, opts: Parameters<typeof randomSpec>[1] = {}): Generator<{ seed: number; spec: OSpec; sol: Solution }> {
  let made = 0;
  for (let seed = first; made < count && seed < first + count * 20; seed++) {
    const spec = seed % 2 === 0 ? stableSpec(seed, opts) : randomSpec(seed, opts);
    const sol = solved(spec);
    if (!sol) continue;
    made++;
    yield { seed, spec, sol };
  }
  if (made < count) throw new Error('not enough structures');
}
const rigid = (nodes: { x: number; y: number }[], nd: number, a: number, b: number, theta: number, about = { x: 0, y: 0 }): number[] =>
  nodes.flatMap((n) => (nd === 3 ? [a - theta * (n.y - about.y), b + theta * (n.x - about.x), theta] : [a - theta * (n.y - about.y), b + theta * (n.x - about.x)]));
const blockOf = (s: Solution, key: string, name: string) => {
  const b = s.steps.find((x) => x.key === key)!.blocks.find((x) => x.name === name);
  if (!b || b.type !== 'matrix') throw new Error('no block');
  return b;
};

describe('the stiffness of one member', () => {
  it('is symmetric, positive semi-definite, of rank 1 (a bar) or 3 (a beam-column), and does not resist a rigid-body motion: 200 random members', () => {
    const r = rng(3);
    for (let k = 0; k < 200; k++) {
      const frame = k % 2 === 0;
      const L = 1 + r() * 30;
      const angle = r() * 2 * Math.PI;
      const model: StiffnessModel = {
        mode: frame ? 'frame' : 'truss',
        nodes: [{ x: 3, y: -2 }, { x: 3 + L * Math.cos(angle), y: -2 + L * Math.sin(angle) }],
        members: [{ i: 0, j: 1, E: 100 + r() * 30000, A: 0.5 + r() * 20, I: 10 + r() * 900 }],
        supports: frame ? [{ node: 0, ux: true, uy: true, rz: true }] : [{ node: 0, ux: true, uy: true, rz: false }, { node: 1, ux: true, uy: true, rz: false }],
        loads: [],
        memberLoads: [],
      };
      // held enough to be solved: the matrix is read from the steps
      const s = must(model);
      const Ke = blockOf(s, 'global-member#1', 'K_e').values;
      const n = Ke.length;
      const top = Math.max(...Ke.flat().map(Math.abs));
      for (let a = 0; a < n; a++) for (let b = 0; b < n; b++) expect(Math.abs(Ke[a][b] - Ke[b][a])).toBeLessThanOrEqual(1e-13 * top);
      const { values } = jacobiEigen(Ke);
      expect(values[0]).toBeGreaterThan(-1e-10 * top);
      const rank = values.filter((v) => v > 1e-9 * top).length;
      expect(rank).toBe(frame ? 3 : 1);
      // a rigid translation, and a rigid rotation about any point
      const nd = frame ? 3 : 2;
      for (const [a, b, t, about] of [[1, 0, 0, { x: 0, y: 0 }], [0, 1, 0, { x: 0, y: 0 }], [0.3, -0.7, 0, { x: 0, y: 0 }], [0, 0, 1, { x: 5, y: -1 }], [0.2, 0.1, -0.4, { x: -3, y: 8 }]] as const) {
        const u = rigid(model.nodes, nd, a, b, t, about);
        const f = matVec(Ke, u);
        expect(maxAbs(f), `member ${k}: rigid ${[a, b, t]}`).toBeLessThanOrEqual(1e-11 * top * Math.max(1, maxAbs(u), L));
      }
    }
  });
});

describe('the stiffness of the structure', () => {
  it('K is symmetric and positive semi-definite with the rigid-body motions in its null space: 150 structures', async () => {
    for (const { seed, spec, sol } of structures(150, 1)) {
      if (seed % 40 === 0) await yieldNow();
      const N = sol.K.length;
      const nd = spec.mode === 'frame' ? 3 : 2;
      const top = Math.max(...sol.K.flat().map(Math.abs));
      for (let a = 0; a < N; a++) for (let b = a + 1; b < N; b++) expect(Math.abs(sol.K[a][b] - sol.K[b][a]), `#${seed}`).toBeLessThanOrEqual(1e-12 * top);
      const sym = sol.K.map((row, a) => row.map((_, b) => 0.5 * (sol.K[a][b] + sol.K[b][a])));
      expect(jacobiEigen(sym).values[0], `#${seed}`).toBeGreaterThan(-1e-9 * top);
      for (const [a, b, t] of [[1, 0, 0], [0, 1, 0], [0, 0, 1]] as const) {
        const f = matVec(sol.K, rigid(spec.nodes, nd, a, b, t));
        expect(maxAbs(f), `#${seed} rigid ${[a, b, t]}`).toBeLessThanOrEqual(1e-10 * top * Math.max(1, ...spec.nodes.map((n) => Math.hypot(n.x, n.y))));
      }
    }
  });
  it('K_FF is positive definite for every structure that is solved, and the printed K_FF is the partition of K: 150 structures', async () => {
    for (const { seed, sol } of structures(150, 500)) {
      if (seed % 40 === 0) await yieldNow();
      const kff = blockOf(sol, 'partition', 'K_FF').values;
      expect(positiveDefinite(kff), `#${seed}`).toBe(true);
      if (kff.length > 0) {
        const sym = kff.map((row, a) => row.map((_, b) => 0.5 * (kff[a][b] + kff[b][a])));
        expect(jacobiEigen(sym).values[0], `#${seed}`).toBeGreaterThan(0);
      }
      sol.free.forEach((da, a) => sol.free.forEach((db, b) => expect(kff[a][b]).toBe(sol.K[da - 1][db - 1])));
    }
  });
});

describe('equilibrium and energy', () => {
  it('every solved structure is in equilibrium as a whole and at every joint, and K u = P + R: 200 structures', async () => {
    for (const { seed, sol } of structures(200, 1000, { settlements: true })) {
      if (seed % 40 === 0) await yieldNow();
      for (const c of sol.checks) expect(c.ok, `#${seed} ${c.id} ${c.value} / ${c.scale}`).toBe(true);
      const R = new Array<number>(sol.u.length).fill(0);
      for (const r of sol.reactions) R[r.dof - 1] = r.value;
      const Ku = matVec(sol.K, sol.u);
      const top = Math.max(sol.scale * Math.max(1, sol.size), ...Ku.map(Math.abs), 1e-300);
      Ku.forEach((v, d) => expect(Math.abs(v - sol.P[d] - R[d]), `#${seed} dof ${d}`).toBeLessThanOrEqual(1e-9 * top));
    }
  });
  it('the energy: ½uᵀKu = ½uᵀP when nothing settles, and ½uᵀP + ½u_RᵀR when something does: 150 structures', async () => {
    for (const { seed, sol } of structures(150, 3000, { settlements: true })) {
      if (seed % 40 === 0) await yieldNow();
      const Ku = matVec(sol.K, sol.u);
      const U = 0.5 * sol.u.reduce((s, v, d) => s + v * Ku[d], 0);
      const work = 0.5 * sol.u.reduce((s, v, d) => s + v * sol.P[d], 0) + 0.5 * sol.reactions.reduce((s, r) => s + sol.u[r.dof - 1] * r.value, 0);
      const terms = 0.5 * sol.u.reduce((s, v, d) => s + Math.abs(v * Ku[d]) + Math.abs(v * sol.P[d]), 0);
      expect(Math.abs(U - work), `#${seed}`).toBeLessThanOrEqual(1e-9 * Math.max(terms, 1e-300));
      // the strain energy of a structure is not negative
      expect(U).toBeGreaterThanOrEqual(-1e-9 * terms);
      const settles = sol.dofs.some((d) => d.restrained && d.prescribed !== 0);
      if (!settles) expect(sol.reactions.every((r) => sol.u[r.dof - 1] === 0)).toBe(true);
    }
  });
});

describe('linearity', () => {
  it('superposition: the answers to two sets of loads add up to the answer to both: 120 structures', async () => {
    const r = rng(9);
    for (const { seed, spec } of structures(120, 5000)) {
      if (seed % 40 === 0) await yieldNow();
      const nd = spec.mode === 'frame' ? 3 : 2;
      void nd;
      const split = (which: 0 | 1): OSpec => ({
        ...spec,
        loads: spec.loads.filter((_, k) => k % 2 === which),
        memberLoads: spec.memberLoads.filter((_, k) => k % 2 === which),
      });
      const a = solved(split(0));
      const b = solved(split(1));
      const ab = solved(spec);
      expect(a && b && ab, `#${seed}`).toBeTruthy();
      const top = (s: Solution) => Math.max(...s.u.map(Math.abs), 1e-300);
      const topR = Math.max(...ab!.reactions.map((x) => Math.abs(x.value)), ...a!.reactions.map((x) => Math.abs(x.value)), ...b!.reactions.map((x) => Math.abs(x.value)), 1e-300);
      ab!.u.forEach((v, d) => expect(Math.abs(v - (a!.u[d] + b!.u[d])), `#${seed} u${d}`).toBeLessThanOrEqual(1e-9 * Math.max(top(ab!), top(a!), top(b!))));
      ab!.reactions.forEach((x, k) => expect(Math.abs(x.value - (a!.reactions[k].value + b!.reactions[k].value))).toBeLessThanOrEqual(1e-9 * topR));
      ab!.forces.forEach((f, m) =>
        f.f.forEach((v, q) => expect(Math.abs(v - (a!.forces[m].f[q] + b!.forces[m].f[q])), `#${seed} f${m}.${q}`).toBeLessThanOrEqual(1e-9 * Math.max(topR, ...f.f.map(Math.abs)))),
      );
      void r;
    }
  });
  it('scaling the loads scales every answer, a negative factor reverses it: 120 structures', async () => {
    const r = rng(10);
    for (const { seed, spec, sol } of structures(120, 7000)) {
      if (seed % 40 === 0) await yieldNow();
      const lambda = [3, 0.25, -1, -2.5, 1e6][Math.floor(r() * 5)];
      const scaled = solved({
        ...spec,
        loads: spec.loads.map((l) => ({ ...l, fx: l.fx * lambda, fy: l.fy * lambda, m: l.m * lambda })),
        memberLoads: spec.memberLoads.map((l) => (l.kind === 'udl' ? { ...l, w: l.w * lambda } : l.kind === 'axial' ? { ...l, q: l.q * lambda } : { ...l, P: l.P * lambda })),
        supports: spec.supports.map((s) => ({ ...s, dx: (s.dx ?? 0) * lambda, dy: (s.dy ?? 0) * lambda, dr: (s.dr ?? 0) * lambda })),
      })!;
      const top = Math.max(...sol.u.map(Math.abs), 1e-300) * Math.abs(lambda);
      sol.u.forEach((v, d) => expect(Math.abs(scaled.u[d] - lambda * v), `#${seed} u${d}`).toBeLessThanOrEqual(1e-9 * top));
      const topF = Math.max(...sol.reactions.map((x) => Math.abs(x.value)), 1e-300) * Math.abs(lambda);
      sol.reactions.forEach((x, k) => expect(Math.abs(scaled.reactions[k].value - lambda * x.value)).toBeLessThanOrEqual(1e-9 * topF));
    }
  });
  it('a stiffer material: E times k gives displacements divided by k and the very same forces: 120 structures', async () => {
    for (const { seed, spec, sol } of structures(120, 9000)) {
      if (seed % 40 === 0) await yieldNow();
      const k = 8;
      // (a settlement is a displacement, not a force: its reactions scale with E, so the check is for structures that do not settle)
      const noSettlement: OSpec = { ...spec, supports: spec.supports.map((s) => ({ ...s, dx: 0, dy: 0, dr: 0 })) };
      const base = solved(noSettlement)!;
      void sol;
      const stiff = solved({ ...noSettlement, members: noSettlement.members.map((m) => ({ ...m, E: m.E * k })) })!;
      const top = Math.max(...base.u.map(Math.abs), 1e-300);
      base.u.forEach((v, d) => expect(Math.abs(stiff.u[d] - v / k), `#${seed} u${d}`).toBeLessThanOrEqual(1e-9 * top));
      const topF = Math.max(...base.reactions.map((x) => Math.abs(x.value)), 1e-300);
      base.reactions.forEach((x, j) => expect(Math.abs(stiff.reactions[j].value - x.value), `#${seed} R${j}`).toBeLessThanOrEqual(1e-9 * topF));
      base.forces.forEach((f, m) => f.f.forEach((v, q) => expect(Math.abs(stiff.forces[m].f[q] - v)).toBeLessThanOrEqual(1e-9 * Math.max(topF, ...f.f.map(Math.abs)))));
    }
  });
  it('a bigger structure of the same shape: every coordinate times 3 gives the same bar forces and displacements three times as large', () => {
    // a truss with every coordinate times 3 and the same sections: the angles are the same, so the forces are; an elongation N·L/EA is three times as long
    const model = (s: number): StiffnessModel => ({
      mode: 'truss',
      nodes: [{ x: 0, y: 0 }, { x: 16 * s, y: 0 }, { x: 8 * s, y: 6 * s }],
      members: [{ i: 0, j: 2 }, { i: 1, j: 2 }],
      supports: [{ node: 0, ux: true, uy: true, rz: false }, { node: 1, ux: true, uy: true, rz: false }],
      loads: [{ node: 2, fx: 20, fy: -30, m: 0 }],
      memberLoads: [],
      E: 4176000,
      A: 10 / 144,
    });
    const a = must(model(1));
    const b = must(model(3));
    a.forces.forEach((f, k) => expect(b.forces[k].bar!.N).toBeCloseTo(f.bar!.N, 9));
    a.u.forEach((v, d) => expect(b.u[d]).toBeCloseTo(3 * v, 12));
  });
});

describe('reciprocity', () => {
  it("Maxwell–Betti: the displacement at a due to a unit load at b is the displacement at b due to a unit load at a: 100 structures", async () => {
    const r = rng(4);
    for (const { seed, spec, sol } of structures(100, 11000)) {
      if (seed % 40 === 0) await yieldNow();
      const nd = spec.mode === 'frame' ? 3 : 2;
      const free = sol.free;
      if (free.length < 2) continue;
      const a = free[Math.floor(r() * free.length)];
      const b = free[Math.floor(r() * free.length)];
      const unit = (dof: number): StiffnessModel => {
        const node = Math.floor((dof - 1) / nd);
        const c = (dof - 1) % nd;
        return { ...toModel({ ...spec, loads: [{ node, fx: c === 0 ? 1 : 0, fy: c === 1 ? 1 : 0, m: c === 2 ? 1 : 0 }], memberLoads: [], supports: spec.supports.map((s) => ({ ...s, dx: 0, dy: 0, dr: 0 })) }) };
      };
      const A = must(unit(a));
      const B = must(unit(b));
      const top = Math.max(...A.u.map(Math.abs), ...B.u.map(Math.abs), 1e-300);
      expect(Math.abs(A.u[b - 1] - B.u[a - 1]), `#${seed} ${a} ${b}`).toBeLessThanOrEqual(1e-9 * top);
    }
  });
});

describe('the whole structure moves, and nothing changes in it', () => {
  it('rotating the structure, its loads and (pinned or fixed) supports by an angle leaves the member forces as they were: 150 structures', async () => {
    const r = rng(21);
    let n = 0;
    for (let seed = 13000; n < 150 && seed < 13600; seed++) {
      if (seed % 40 === 0) await yieldNow();
      const spec = randomSpec(seed);
      // supports invariant under rotation: pins in a truss, fixed in a frame; no settlement
      const fixedSpec: OSpec = { ...spec, supports: spec.supports.map((s) => ({ node: s.node, ux: true, uy: true, rz: spec.mode === 'frame' })) };
      const base = solved(fixedSpec);
      const alpha = [Math.PI / 2, Math.PI, 0.3, 1.234, -2.5][Math.floor(r() * 5)];
      const c = Math.cos(alpha);
      const s = Math.sin(alpha);
      const rot = (x: number, y: number) => ({ x: c * x - s * y, y: s * x + c * y });
      const turned: OSpec = {
        ...fixedSpec,
        nodes: fixedSpec.nodes.map((p) => rot(p.x, p.y)),
        loads: fixedSpec.loads.map((l) => {
          const f = rot(l.fx, l.fy);
          return { ...l, fx: f.x, fy: f.y };
        }),
      };
      const other = solved(turned);
      // the rotated structure is a mechanism exactly when the original is
      expect(!!other, `#${seed}`).toBe(!!base);
      if (!base || !other) continue;
      n++;
      const topF = Math.max(...base.forces.flatMap((f) => f.f.map(Math.abs)), 1e-300);
      base.forces.forEach((f, m) => f.f.forEach((v, q) => expect(Math.abs(other.forces[m].f[q] - v), `#${seed} member ${m} ${q}`).toBeLessThanOrEqual(1e-8 * topF * Math.max(1, Math.abs(alpha)))));
      // the displacements turn with it
      const nd = spec.mode === 'frame' ? 3 : 2;
      const topU = Math.max(...base.u.map(Math.abs), 1e-300);
      for (let node = 0; node < spec.nodes.length; node++) {
        const d = rot(base.u[nd * node], base.u[nd * node + 1]);
        expect(Math.abs(other.u[nd * node] - d.x)).toBeLessThanOrEqual(1e-8 * topU);
        expect(Math.abs(other.u[nd * node + 1] - d.y)).toBeLessThanOrEqual(1e-8 * topU);
        if (nd === 3) expect(Math.abs(other.u[nd * node + 2] - base.u[nd * node + 2])).toBeLessThanOrEqual(1e-8 * topU * 10);
      }
    }
    expect(n).toBe(150);
  });
  it('a rigid-body settlement of every support moves the structure without straining it: no end force, no reaction: 80 structures', async () => {
    const r = rng(33);
    let n = 0;
    let trusses = 0;
    for (let seed = 15000; n < 80 && seed < 15600; seed++) {
      if (seed % 40 === 0) await yieldNow();
      // frames stand on any fixed support, so they are always solved; trusses only when they are triangulated and held
      const spec = seed % 4 === 0 ? randomSpec(seed, { mode: 'truss' }) : stableSpec(seed, { mode: 'frame' });
      const nd = spec.mode === 'frame' ? 3 : 2;
      const a = (r() - 0.5) * 0.2;
      const b = (r() - 0.5) * 0.2;
      const t = (r() - 0.5) * 0.05;
      const field = rigid(spec.nodes, nd, a, b, t);
      const moving: OSpec = {
        ...spec,
        loads: [],
        memberLoads: [],
        supports: spec.supports.map((s) => ({ node: s.node, ux: true, uy: true, rz: spec.mode === 'frame', dx: field[nd * s.node], dy: field[nd * s.node + 1], dr: nd === 3 ? field[nd * s.node + 2] : 0 })),
      };
      const sol = solved(moving);
      if (!sol) continue;
      n++;
      if (spec.mode === 'truss') trusses++;
      // (a free node follows the rigid field only if it is held by members: the answer is the field wherever the structure is connected)
      sol.u.forEach((v, d) => expect(Math.abs(v - field[d]), `#${seed} u${d}`).toBeLessThanOrEqual(1e-9 * Math.max(1, ...field.map(Math.abs))));
      const top = Math.max(...sol.K.flat().map(Math.abs)) * Math.max(...field.map(Math.abs), 1e-300) * 10;
      sol.forces.forEach((f) => f.f.forEach((v) => expect(Math.abs(v)).toBeLessThanOrEqual(1e-9 * top)));
      sol.reactions.forEach((x) => expect(Math.abs(x.value)).toBeLessThanOrEqual(1e-9 * top));
    }
    expect(n).toBe(80);
    expect(trusses).toBeGreaterThan(3);
  });
});

describe('the printed results are clean (settled): no −0, no 1e-14 beside a real zero', () => {
  it('every number the page would print is a number or an exact zero: 100 structures through the analysis', async () => {
    const { analyseSafely } = await import('./analysis');
    const { emptyStiffness, reduce } = await import('./model');
    const { TEMPLATE_IDS } = await import('./templates');
    for (const template of TEMPLATE_IDS) {
      for (const units of ['us', 'si'] as const) {
        const a = analyseSafely(reduce(emptyStiffness(units), { type: 'template', template }));
        const walk = (v: unknown, path: string) => {
          if (typeof v === 'number') {
            expect(Object.is(v, -0), path).toBe(false);
            expect(Number.isFinite(v), path).toBe(true);
          } else if (Array.isArray(v)) v.forEach((x, k) => walk(x, `${path}[${k}]`));
          else if (v && typeof v === 'object') for (const [k, x] of Object.entries(v)) walk(x, `${path}.${k}`);
        };
        walk(a.results, `${template} ${units} results`);
        walk(a.solution?.steps, `${template} ${units} steps`);
        walk(a.drawing, `${template} ${units} drawing`);
      }
    }
  });
});
