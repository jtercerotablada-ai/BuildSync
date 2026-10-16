import { afterEach, describe, expect, it } from 'vitest';
import { B0, B1, B2, ONE, ZERO, generate, int, isqrt, oracle, q, rng, solveExact, sqrtQ, toNumber, type OCase } from './oracle.testlib';

afterEach(() => new Promise<void>((resolve) => setTimeout(resolve, 0)));

/**
 * THE ORACLE, TESTED ON ITS OWN. Everything engine.test.ts concludes from
 * agreeing with it is worth what it is worth, so it is held to what is known
 * first: exact arithmetic, its solver on systems whose solution is chosen in
 * advance, and the truss cases of statics textbooks.
 */
describe('oracle: exact arithmetic', () => {
  it('fractions are reduced and signed on the numerator', () => {
    expect(q(6, -4)).toEqual({ n: -BigInt(3), d: B2 });
    expect(toNumber(q(1, 3))).toBeCloseTo(1 / 3, 15);
    expect(toNumber(q(-22, 7))).toBeCloseTo(-22 / 7, 14);
  });
  it('isqrt is the floor of the root', () => {
    for (const n of [B0, B1, B2, BigInt(3), BigInt(4), BigInt(15), BigInt(16), BigInt(17), BigInt(10) ** BigInt(40), BigInt(10) ** BigInt(40) + B1, BigInt(10) ** BigInt(40) - B1]) {
      const r = isqrt(n);
      expect(r * r <= n && (r + B1) * (r + B1) > n).toBe(true);
    }
  });
  it('a perfect square has an exact root; another has a root good to 2^-64', () => {
    expect(sqrtQ(q(9, 25))).toEqual(q(3, 5));
    expect(sqrtQ(q(25))).toEqual(q(5));
    const r = sqrtQ(q(2));
    expect(Math.abs(toNumber(r) - Math.SQRT2)).toBeLessThan(1e-15);
    const err = toNumber({ n: r.n * r.n - B2 * r.d * r.d, d: r.d * r.d });
    expect(Math.abs(err)).toBeLessThan(2 ** -62);
  });
});

describe('oracle: the exact solver', () => {
  it('solves systems whose solution was chosen first, with no rounding at all', () => {
    const rand = rng(11);
    for (let t = 0; t < 60; t++) {
      const n = int(rand, 1, 7);
      const x = Array.from({ length: n }, () => q(int(rand, -20, 20), int(rand, 1, 9)));
      const A = Array.from({ length: n }, () => Array.from({ length: n }, () => q(int(rand, -9, 9), int(rand, 1, 4))));
      const b = A.map((row) => row.reduce((s, e, j) => ({ n: s.n * (e.d * x[j].d) + e.n * x[j].n * s.d, d: s.d * e.d * x[j].d }), ZERO));
      const bq = b.map((v) => q(v.n, v.d));
      const got = solveExact(A, bq);
      if (got === null) continue; // a singular matrix
      got.forEach((g, j) => expect(g).toEqual(x[j]));
    }
  });
  it('a singular matrix is null', () => {
    expect(solveExact([[ONE, q(2)], [q(2), q(4)]], [ONE, q(2)])).toBeNull();
  });
});

describe('oracle: statics textbooks', () => {
  // Triangle 0,0 - 4,0 - 2,3 with a pin at the left, a vertical roller at the right, 10 down at the apex.
  // R = 5 each; the rafters: 5 / (3/√13) = 5√13/3 = 6.00925 in compression; the tie 5·(2/3) = 10/3 in tension.
  const triangle: OCase = {
    nodes: [{ x: q(0), y: q(0) }, { x: q(4), y: q(0) }, { x: q(2), y: q(3) }],
    members: [{ i: 0, j: 1, ea: ONE }, { i: 0, j: 2, ea: ONE }, { i: 1, j: 2, ea: ONE }],
    supports: [{ node: 0, kind: 'pin' }, { node: 1, kind: 'roller', c: q(0), s: q(1) }],
    loads: [{ node: 2, fx: q(0), fy: q(-10) }],
  };
  it('a triangle by hand', () => {
    const out = oracle(triangle)!;
    expect(out.N[0]).toBeCloseTo(10 / 3, 14);
    expect(out.N[1]).toBeCloseTo((-5 * Math.sqrt(13)) / 3, 13);
    expect(out.N[2]).toBeCloseTo((-5 * Math.sqrt(13)) / 3, 13);
    expect(out.reactions[0]).toEqual({ rx: 0, ry: 5 });
    expect(out.reactions[1]).toEqual({ rx: 0, ry: 5 });
  });
  it('a 3-4-5 triangle has an EXACT solution: members 3, 4, 5 under a horizontal load at the apex', () => {
    // Nodes (0,0), (4,0), (0,3). Pin at (0,0), vertical roller at (4,0). Load 12 to the right at (0,3):
    // ΣM about (0,0): R_B · 4 = 12 · 3 → R_B = 9 (up); R_A = (−12, −9). Member (1,2) is the hypotenuse.
    const c: OCase = {
      nodes: [{ x: q(0), y: q(0) }, { x: q(4), y: q(0) }, { x: q(0), y: q(3) }],
      members: [{ i: 0, j: 1, ea: ONE }, { i: 0, j: 2, ea: ONE }, { i: 1, j: 2, ea: ONE }],
      supports: [{ node: 0, kind: 'pin' }, { node: 1, kind: 'roller', c: q(0), s: q(1) }],
      loads: [{ node: 2, fx: q(12), fy: q(0) }],
    };
    const out = oracle(c)!;
    // Joint (0,3): the hypotenuse (direction to (4,0): (4/5, −3/5)) and the vertical member (0, −1 from the node): 12 + 4/5·N_h = 0 → N_h = −15; −3/5·N_h − N_v = 0 → N_v = 9.
    expect(out.N[2]).toBe(-15);
    expect(out.N[1]).toBe(9);
    expect(out.N[0]).toBe(12);
    expect(out.reactions[1].ry).toBe(9);
    expect(out.reactions[0]).toEqual({ rx: -12, ry: -9 });
  });
  it('the two routes — equilibrium and stiffness — agree on a determinate truss, whatever the stiffness', () => {
    const rand = rng(5);
    let compared = 0;
    for (let t = 0; t < 40; t++) {
      const g = generate(rand, { nodes: [3, 6], extra: [0, 0], grid: 6 });
      const a = oracle(g.exact, 'equilibrium');
      const stiff = { ...g.exact, members: g.exact.members.map((m) => ({ ...m, ea: q(int(rand, 1, 50), int(rand, 1, 7)) })) };
      const b = oracle(stiff, 'stiffness');
      expect(a === null).toBe(b === null);
      if (!a || !b) continue;
      compared++;
      a.N.forEach((v, k) => expect(Math.abs(v - b.N[k])).toBeLessThanOrEqual(1e-9 * Math.max(1, Math.abs(v))));
    }
    expect(compared).toBeGreaterThan(10);
  });
  it('an indeterminate truss follows the stiffness: three bars hanging from a ceiling share the load by EA', () => {
    // Bars to D(0,-3) from A(-4,0), B(0,0), C(4,0): lengths 5, 3, 5. P = 10 down at D. EA = a for A and C, b for B.
    // Vertical stiffness: B: b/3; A or C: (a/5)·(3/5)² each. δ = P / (b/3 + 2·a·9/125); the force in B = (b/3)δ.
    const A_ = 7;
    const B_ = 4;
    const c: OCase = {
      nodes: [{ x: q(-4), y: q(0) }, { x: q(0), y: q(0) }, { x: q(4), y: q(0) }, { x: q(0), y: q(-3) }],
      members: [{ i: 0, j: 3, ea: q(A_) }, { i: 1, j: 3, ea: q(B_) }, { i: 2, j: 3, ea: q(A_) }],
      supports: [{ node: 0, kind: 'pin' }, { node: 1, kind: 'pin' }, { node: 2, kind: 'pin' }],
      loads: [{ node: 3, fx: q(0), fy: q(-10) }],
    };
    const out = oracle(c)!;
    const delta = 10 / (B_ / 3 + (2 * A_ * 9) / 125);
    expect(out.N[1]).toBeCloseTo((B_ / 3) * delta, 12);
    expect(out.N[0]).toBeCloseTo(((A_ / 5) * (3 / 5) * delta), 12);
    expect(out.route).toBe('stiffness');
  });
  it('a mechanism is singular', () => {
    // A joint with two collinear members.
    const c: OCase = {
      nodes: [{ x: q(0), y: q(0) }, { x: q(2), y: q(0) }, { x: q(4), y: q(0) }],
      members: [{ i: 0, j: 1, ea: ONE }, { i: 1, j: 2, ea: ONE }],
      supports: [{ node: 0, kind: 'pin' }, { node: 2, kind: 'roller', c: q(0), s: q(1) }],
      loads: [{ node: 1, fx: q(0), fy: q(-1) }],
    };
    expect(oracle(c)).toBeNull();
  });
});
