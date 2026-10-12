import { describe, expect, it } from 'vitest';
import { solveBeam, type BeamModel, type BeamState } from '../beam/solver';
import { SHORT, STIFF, placedLoads, polyAt, polyRoots, solveCase, solveContinuous, stretchOf, type ContinuousCase } from './engine';
import type { ContinuousModel, ContinuousSolution, EndKind } from './types';

/**
 * THE CONTINUOUS-BEAM ENGINE, against what is known.
 *
 * Four kinds of evidence, each independent of the others:
 *
 *   — closed forms: the beam tables (AISC Manual, Table 3-23) and the
 *     textbook results for continuous beams, settling supports and stepped
 *     sections, written as their formulas, with Clapeyron's three-moment
 *     equation worked out here in the test for what no table lists;
 *   — the FIRST calculator's engine (beam/solver.ts: another method, no
 *     stiffness matrix in it) on every beam both can solve;
 *   — the beam equation itself: on random beams with their own stiffness
 *     in every span and supports that settle, every diagram is the integral
 *     of the one before it, every support and every end is as it was
 *     entered, and the beam is in equilibrium. A function that does all of
 *     that IS the solution — the problem has only one;
 *   — what is refused, at the limits, and that what is taken there is right.
 *
 * The engine is exact — closed forms — so the tolerances are rounding, not
 * "within half a percent". How it was measured against a reference in
 * 640-bit arithmetic is in the header of engine.ts.
 */

const solved = (model: ContinuousModel): ContinuousCase => {
  const out = solveCase(model);
  if (!out.ok) throw new Error(`not solved: ${JSON.stringify(out.issues)}`);
  return out;
};
const refusal = (model: ContinuousModel) => {
  const out = solveContinuous(model);
  return out.ok ? [] : out.issues;
};
const issuesOf = (model: ContinuousModel) => refusal(model).map((i) => i.code);
/** Equal to rounding: relative to the size of the numbers in play. */
const near = (got: number, want: number, scale = Math.max(1, Math.abs(want)), tol = 1e-9) => {
  expect(Math.abs(got - want), `got ${got}, want ${want}`).toBeLessThanOrEqual(tol * scale);
};
/** Every number a solution holds. */
const numbersOf = (s: ContinuousSolution): number[] => [
  s.totalLoad,
  s.loadScale,
  s.residual.force,
  s.residual.moment,
  s.residual.slope,
  ...s.breaks,
  ...s.reactions.flatMap((r) => [r.x, r.Rv, r.Rm]),
  ...Object.values(s.extremes).flatMap((e) => [e.value, e.x]),
  ...s.stations.flatMap((st) => [st.x, st.w, st.V, st.M, st.EItheta, st.EIv]),
  ...s.joints.flatMap((j) => [j.x, j.M, j.EItheta, j.EIv]),
  ...s.spans.flatMap((p) => [p.from, p.to, ...[p.Mmax, p.Mmin, p.Vmax, p.Vmin, p.EIvChord].flatMap((e) => [e.value, e.x])]),
];

const L = 24;
const w = 1.7;
const P = 11;
/** A uniform load over the whole of each span. */
const uniform = (lengths: number[], q: number | number[]) => lengths.map((len, span) => ({ span, a1: 0, a2: len, w1: Array.isArray(q) ? q[span] : q, w2: Array.isArray(q) ? q[span] : q }));
const equal = (count: number, k = 1) => Array.from({ length: count }, () => ({ L, k }));
/** ∫ f over [a, b], exact for a polynomial of the fifth degree: three Gauss points. */
const gauss = (f: (x: number) => number, a: number, b: number) => {
  const half = (b - a) / 2;
  const mid = (a + b) / 2;
  const t = Math.sqrt(3 / 5);
  return half * ((5 / 9) * f(mid - half * t) + (8 / 9) * f(mid) + (5 / 9) * f(mid + half * t));
};

describe('continuous beam: equal spans under a uniform load', () => {
  it('two spans: 3wL/8, 5wL/4, 3wL/8; wL²/8 over the middle support; 9wL²/128 in the span', () => {
    const s = solved({ spans: equal(2), left: 'pin', right: 'pin', dists: uniform([L, L], w) });
    near(s.reactions[0].Rv, (3 * w * L) / 8);
    near(s.reactions[1].Rv, (5 * w * L) / 4);
    near(s.reactions[2].Rv, (3 * w * L) / 8);
    expect(s.reactions.map((r) => r.kind)).toEqual(['pin', 'roller', 'roller']);
    near(s.joints[1].M, (-w * L * L) / 8);
    near(s.extremes.Mmin.value, (-w * L * L) / 8);
    near(s.extremes.Mmin.x, L);
    near(s.extremes.Mmax.value, (9 * w * L * L) / 128);
    near(s.spans[0].Mmax.x, (3 * L) / 8, L, 1e-9);
    near(s.spans[1].Mmax.x, 2 * L - (3 * L) / 8, L, 1e-9);
    // Each span is a propped cantilever: its largest deflection at (1 + √33)/16 of the span from its simple end.
    const x = (L * (1 + Math.sqrt(33))) / 16;
    const deepest = (-w * x * (L ** 3 - 3 * L * x * x + 2 * x ** 3)) / 48;
    near(s.extremes.EIvMin.value, deepest);
    near(s.spans[0].EIvChord.value, deepest);
    near(s.spans[0].EIvChord.x, x, L, 1e-8);
    near(s.spans[1].EIvChord.x, 2 * L - x, L, 1e-8);
    near(s.totalLoad, 2 * w * L);
    near(s.loadScale, 2 * w * L);
  });

  it('three spans: 0.4wL and 1.1wL; 0.1wL² over the supports; 0.08wL² and 0.025wL² in the spans', () => {
    const s = solved({ spans: equal(3), left: 'pin', right: 'pin', dists: uniform([L, L, L], w) });
    [0.4, 1.1, 1.1, 0.4].forEach((c, j) => near(s.reactions[j].Rv, c * w * L));
    [0, -0.1, -0.1, 0].forEach((c, j) => near(s.joints[j].M, c * w * L * L, w * L * L));
    near(s.spans[0].Mmax.value, 0.08 * w * L * L);
    near(s.spans[0].Mmax.x, 0.4 * L, L, 1e-9);
    near(s.spans[1].Mmax.value, 0.025 * w * L * L);
    near(s.spans[1].Mmax.x, 1.5 * L, L, 1e-9);
    near(s.spans[1].Mmin.value, -0.1 * w * L * L);
  });

  it('four spans: 11/28, 8/7, 13/14 of wL; 3/28 and 1/14 of wL² over the supports', () => {
    const s = solved({ spans: equal(4), left: 'pin', right: 'pin', dists: uniform([L, L, L, L], w) });
    [11 / 28, 8 / 7, 13 / 14, 8 / 7, 11 / 28].forEach((c, j) => near(s.reactions[j].Rv, c * w * L));
    [0, -3 / 28, -1 / 14, -3 / 28, 0].forEach((c, j) => near(s.joints[j].M, c * w * L * L, w * L * L));
  });

  it('whatever the common stiffness of the spans: the same forces, and deflections divided by it', () => {
    const one = solved({ spans: equal(3), left: 'pin', right: 'pin', dists: uniform([L, L, L], w) });
    const stiff = solved({ spans: equal(3, 2.5), left: 'pin', right: 'pin', dists: uniform([L, L, L], w) });
    stiff.reactions.forEach((r, j) => near(r.Rv, one.reactions[j].Rv));
    near(stiff.extremes.Mmin.value, one.extremes.Mmin.value);
    near(stiff.extremes.EIvMin.value, one.extremes.EIvMin.value / 2.5);
    near(stiff.at(31).EItheta, one.at(31).EItheta / 2.5);
  });
});

describe('continuous beam: one span, its ends fixed or not', () => {
  const span = [{ L, k: 1 }];
  it('fixed at both ends, uniform load: wL²/12 at the ends, wL²/24 at midspan, wL⁴/384', () => {
    const s = solved({ spans: span, left: 'fixed', right: 'fixed', dists: uniform([L], w) });
    near(s.reactions[0].Rm, (w * L * L) / 12);
    near(s.reactions[1].Rm, (-w * L * L) / 12);
    near(s.reactions[0].Rv, (w * L) / 2);
    near(s.joints[0].M, (-w * L * L) / 12);
    near(s.joints[1].M, (-w * L * L) / 12);
    near(s.extremes.Mmax.value, (w * L * L) / 24);
    near(s.extremes.Mmax.x, L / 2);
    near(s.extremes.EIvMin.value, (-w * L ** 4) / 384);
    // No turn in a wall: what the span's own bending leaves there is rounding.
    near(s.at(0).EItheta, 0, w * L ** 3, 1e-13);
    near(s.at(L).EItheta, 0, w * L ** 3, 1e-13);
    expect(s.reactions.map((r) => r.kind)).toEqual(['fixed', 'fixed']);
  });

  it('fixed at both ends, a load anywhere: Pab²/L² and Pa²b/L², Pa³b³/3L³ under it', () => {
    const a = 15;
    const b = L - a;
    const s = solved({ spans: span, left: 'fixed', right: 'fixed', points: [{ span: 0, a, P }] });
    near(s.joints[0].M, (-P * a * b * b) / (L * L));
    near(s.joints[1].M, (-P * a * a * b) / (L * L));
    near(s.reactions[0].Rv, (P * b * b * (3 * a + b)) / L ** 3);
    near(s.reactions[1].Rv, (P * a * a * (a + 3 * b)) / L ** 3);
    near(s.at(a).EIv, (-P * a ** 3 * b ** 3) / (3 * L ** 3));
    near(s.at(a).M, (2 * P * a * a * b * b) / L ** 3);
    // a > b: the largest deflection is at 2aL/(3a + b) from the left end.
    near(s.extremes.EIvMin.x, (2 * a * L) / (3 * a + b), L, 1e-8);
    near(s.extremes.EIvMin.value, (-2 * P * a ** 3 * b * b) / (3 * (3 * a + b) ** 2));
    // The shear jumps by P under the load.
    near(s.at(a, 'left').V - s.at(a, 'right').V, P);
  });

  it('fixed at both ends, a load over PART of the span: the fixed-end moments are ∫ w·x(L − x)²/L² dx', () => {
    // Uniform, a ramp up, a ramp down, a trapezoid, one that changes sign — each over its own piece of the span.
    for (const [a1, a2, w1, w2] of [[6, 14, 2, 2], [3, 21, 0, 1.5], [0, 9, 2.4, 0], [10, 24, 0.7, 1.9], [4, 20, 1.6, -0.8], [0, 24, 0, 3]]) {
      const q = (x: number) => w1 + ((w2 - w1) * (x - a1)) / (a2 - a1);
      const s = solved({ spans: span, left: 'fixed', right: 'fixed', dists: [{ span: 0, a1, a2, w1, w2 }] });
      const MA = gauss((x) => (q(x) * x * (L - x) ** 2) / (L * L), a1, a2);
      const MB = gauss((x) => (q(x) * x * x * (L - x)) / (L * L), a1, a2);
      const W = gauss(q, a1, a2);
      near(s.joints[0].M, -MA);
      near(s.joints[1].M, -MB);
      // The left reaction by moments about the right end.
      near(s.reactions[0].Rv, (gauss((x) => q(x) * (L - x), a1, a2) + MA - MB) / L);
      near(s.reactions[0].Rv + s.reactions[1].Rv, W);
      near(s.totalLoad, W);
    }
    // A triangle over the whole span: wL²/30 at its point and wL²/20 at its base.
    const tri = solved({ spans: span, left: 'fixed', right: 'fixed', dists: [{ span: 0, a1: 0, a2: L, w1: 0, w2: w }] });
    near(tri.joints[0].M, (-w * L * L) / 30);
    near(tri.joints[1].M, (-w * L * L) / 20);
  });

  it('fixed on the left and simply supported on the right: 5wL/8 and 3wL/8, wL²/8 at the wall, 9wL²/128 in the span', () => {
    const s = solved({ spans: span, left: 'fixed', right: 'pin', dists: uniform([L], w) });
    near(s.reactions[0].Rv, (5 * w * L) / 8);
    near(s.reactions[1].Rv, (3 * w * L) / 8);
    near(s.reactions[0].Rm, (w * L * L) / 8);
    expect(s.reactions[1].Rm).toBe(0);
    near(s.extremes.Mmax.value, (9 * w * L * L) / 128);
    near(s.extremes.Mmax.x, (5 * L) / 8, L, 1e-9);
    expect(s.reactions.map((r) => r.kind)).toEqual(['fixed', 'pin']);
    // …and the mirror image, with the wall's moment clockwise.
    const m = solved({ spans: span, left: 'pin', right: 'fixed', dists: uniform([L], w) });
    near(m.reactions[1].Rv, (5 * w * L) / 8);
    near(m.reactions[1].Rm, (-w * L * L) / 8);
    near(m.extremes.Mmax.x, (3 * L) / 8, L, 1e-9);
  });

  it('fixed on the left, a load at midspan: 11P/16 and 5P/16, 3PL/16 at the wall, 5PL/32 under the load', () => {
    const s = solved({ spans: span, left: 'fixed', right: 'pin', points: [{ span: 0, a: L / 2, P }] });
    near(s.reactions[0].Rv, (11 * P) / 16);
    near(s.reactions[1].Rv, (5 * P) / 16);
    near(s.joints[0].M, (-3 * P * L) / 16);
    near(s.extremes.Mmax.value, (5 * P * L) / 32);
  });

  it('on two simple supports it is the first calculator’s beam: wL/2, wL²/8, 5wL⁴/384', () => {
    const s = solved({ spans: span, left: 'pin', right: 'pin', dists: uniform([L], w) });
    near(s.reactions[0].Rv, (w * L) / 2);
    near(s.extremes.Mmax.value, (w * L * L) / 8);
    near(s.extremes.EIvMin.value, (-5 * w * L ** 4) / 384);
    near(s.at(0).EItheta, (-w * L ** 3) / 24);
    near(s.at(L).EItheta, (w * L ** 3) / 24);
    expect(s.joints[0].M).toBe(0);
    expect(s.joints[1].M).toBe(0);
  });

  it('a cantilever, from either end: PL, PL³/3EI, PL²/2EI; wL²/2, wL⁴/8EI', () => {
    const tip = solved({ spans: span, left: 'fixed', right: 'free', points: [{ span: 0, a: L, P }] });
    near(tip.reactions[0].Rv, P);
    near(tip.reactions[0].Rm, P * L);
    near(tip.at(L).EIv, (-P * L ** 3) / 3);
    near(tip.at(L).EItheta, (-P * L * L) / 2);
    expect(tip.spans[0].kind).toBe('cantilever');
    expect(tip.joints[1].support).toBe(null);
    // The shear is P up to the load, and nothing past the end of the beam.
    near(tip.at(L, 'left').V, P);
    expect(tip.at(L, 'right').V).toBe(0);
    const other = solved({ spans: span, left: 'free', right: 'fixed', points: [{ span: 0, a: 0, P }] });
    near(other.reactions[0].Rm, -P * L);
    near(other.at(0).EIv, (-P * L ** 3) / 3);
    near(other.at(0).EItheta, (P * L * L) / 2);
    near(other.at(0, 'right').V, -P);
    expect(other.at(0, 'left').V).toBe(0);
    const spread = solved({ spans: span, left: 'fixed', right: 'free', dists: uniform([L], w) });
    near(spread.joints[0].M, (-w * L * L) / 2);
    near(spread.extremes.EIvMin.value, (-w * L ** 4) / 8);
    near(spread.at(L).EItheta, (-w * L ** 3) / 6);
    near(spread.spans[0].EIvChord.value, (-w * L ** 4) / 8);
    near(spread.spans[0].EIvChord.x, L);
    // A load over part of it: the tip drops by what the load's own length gives, plus the slope there times the rest.
    const c = 9;
    const part = solved({ spans: span, left: 'fixed', right: 'free', dists: [{ span: 0, a1: 0, a2: c, w1: w, w2: w }] });
    near(part.at(L).EIv, (-w * c ** 4) / 8 - ((w * c ** 3) / 6) * (L - c));
  });
});

describe('continuous beam: a load on one span of two', () => {
  it('a point load a from the end support: −Pa(L² − a²)/4L² over the middle one', () => {
    for (const a of [L / 2, 7, 19.5]) {
      const s = solved({ spans: equal(2), left: 'pin', right: 'pin', points: [{ span: 0, a, P }] });
      const MB = (-P * a * (L * L - a * a)) / (4 * L * L);
      near(s.joints[1].M, MB);
      near(s.reactions[0].Rv, (P * (L - a)) / L + MB / L);
      near(s.reactions[2].Rv, MB / L);
      near(s.reactions[1].Rv, P - (P * (L - a)) / L - (2 * MB) / L);
      // The unloaded span: a straight line of moment, and it lifts.
      near(s.at(L + L / 2).M, MB / 2);
      expect(s.spans[1].EIvChord.value).toBeGreaterThan(0);
    }
    // At midspan: 13P/32, 11P/16, −3P/32, and 3PL/32 over the support.
    const mid = solved({ spans: equal(2), left: 'pin', right: 'pin', points: [{ span: 0, a: L / 2, P }] });
    near(mid.reactions[0].Rv, (13 * P) / 32);
    near(mid.reactions[1].Rv, (11 * P) / 16);
    near(mid.reactions[2].Rv, (-3 * P) / 32);
    near(mid.joints[1].M, (-3 * P * L) / 32);
  });

  it('one span loaded uniformly: wL²/16 over the support, 7wL/16 at its own end', () => {
    const s = solved({ spans: equal(2), left: 'pin', right: 'pin', dists: [{ span: 0, a1: 0, a2: L, w1: w, w2: w }] });
    near(s.joints[1].M, (-w * L * L) / 16);
    near(s.reactions[0].Rv, (7 * w * L) / 16);
    near(s.reactions[1].Rv, (5 * w * L) / 8);
    near(s.reactions[2].Rv, (-w * L) / 16);
    near(s.spans[0].Mmax.value, (49 * w * L * L) / 512);
  });

  it('a load on a support goes into the support, and bends nothing', () => {
    for (const load of [{ span: 0, a: L, P }, { span: 1, a: 0, P }]) {
      const s = solved({ spans: equal(2), left: 'pin', right: 'pin', points: [load] });
      expect(s.reactions[1].Rv).toBe(P);
      expect(s.reactions[0].Rv).toBe(0);
      expect(s.extremes.Mmax.value).toBe(0);
      expect(s.extremes.Mmin.value).toBe(0);
      expect(s.extremes.EIvMin.value).toBe(0);
      expect(s.extremes.Vmax.value).toBe(0);
      near(s.totalLoad, P);
      expect(s.residual).toEqual({ force: 0, moment: 0, slope: 0 });
    }
  });
});

describe('continuous beam: an overhang', () => {
  const c = 7;
  it('a load on the tip: Pc over the support, the span lifts by PcL²/16, the tip drops by Pc²(L + c)/3', () => {
    const s = solved({ spans: [{ L, k: 1 }, { L: c, k: 1 }], left: 'pin', right: 'free', points: [{ span: 1, a: c, P }] });
    near(s.reactions[0].Rv, (-P * c) / L);
    near(s.reactions[1].Rv, (P * (L + c)) / L);
    expect(s.reactions).toHaveLength(2);
    near(s.joints[1].M, -P * c);
    near(s.extremes.Mmin.value, -P * c);
    near(s.at(L / 2).EIv, (P * c * L * L) / 16);
    near(s.at(L).EItheta, (-P * c * L) / 3);
    near(s.at(L + c).EIv, (-P * c * c * (L + c)) / 3);
    expect(s.spans.map((p) => p.kind)).toEqual(['span', 'cantilever']);
    // From its own support the tip is where it is: the support does not settle.
    near(s.spans[1].EIvChord.value, (-P * c * c * (L + c)) / 3);
    near(s.spans[1].EIvChord.x, L + c);
    expect(s.joints[2]).toMatchObject({ support: null, M: 0 });
    expect(s.at(L + c, 'right')).toMatchObject({ V: 0, M: 0 });
  });

  it('each with its own stiffness: the tip is the turn of the support times c, plus the cantilever’s own Pc³/3', () => {
    const [k1, k2] = [2.5, 0.4];
    const s = solved({ spans: [{ L, k: k1 }, { L: c, k: k2 }], left: 'pin', right: 'free', points: [{ span: 1, a: c, P }] });
    near(s.at(L).EItheta, (-P * c * L) / (3 * k1));
    near(s.at(L + c).EIv, (-P * c * L * c) / (3 * k1) - (P * c ** 3) / (3 * k2));
    // A uniform load on the overhang alone: wc²/2 over the support, wc⁴/8 of its own.
    const u = solved({ spans: [{ L, k: k1 }, { L: c, k: k2 }], left: 'pin', right: 'free', dists: [{ span: 1, a1: 0, a2: c, w1: w, w2: w }] });
    near(u.joints[1].M, (-w * c * c) / 2);
    near(u.at(L + c).EIv, (-((w * c * c) / 2) * L * c) / (3 * k1) - (w * c ** 4) / (8 * k2));
  });

  it('on the left it is the mirror image', () => {
    const s = solved({ spans: [{ L: c, k: 1 }, { L, k: 1 }], left: 'free', right: 'pin', points: [{ span: 0, a: 0, P }] });
    near(s.reactions[0].Rv, (P * (L + c)) / L);
    near(s.reactions[1].Rv, (-P * c) / L);
    near(s.joints[1].M, -P * c);
    near(s.at(0).EIv, (-P * c * c * (L + c)) / 3);
    near(s.at(c + L / 2).EIv, (P * c * L * L) / 16);
    expect(s.spans.map((p) => p.kind)).toEqual(['cantilever', 'span']);
    expect(s.reactions.map((r) => r.kind)).toEqual(['pin', 'roller']);
  });

  it('an overhang that carries nothing has exactly no shear and no moment, whatever the rest of the beam carries', () => {
    const s = solved({ spans: [{ L: c, k: 1.3 }, { L, k: 1 }, { L: 18, k: 0.7 }, { L: c, k: 2 }], left: 'free', right: 'free', dists: [{ span: 1, a1: 2, a2: 19, w1: w, w2: 0.3 }], points: [{ span: 2, a: 5, P }] });
    for (const index of [0, 3]) {
      expect(s.spans[index].Mmax.value).toBe(0);
      expect(s.spans[index].Mmin.value).toBe(0);
      expect(s.spans[index].Vmax.value).toBe(0);
      expect(s.spans[index].Vmin.value).toBe(0);
    }
    expect(s.joints[1].M).toBe(0);
    expect(s.joints[3].M).toBe(0);
    // It is not still for that: it swings with the support it hangs from.
    near(s.at(0).EIv, -s.at(c).EItheta * c, Math.abs(s.at(c).EItheta * c), 1e-12);
    expect(Math.abs(s.spans[0].EIvChord.value)).toBeGreaterThan(1);
  });
});

describe('continuous beam: supports that settle', () => {
  // A settlement is given as the reference EI times the length it goes down.
  const d = 5;
  it('the middle support of two equal spans: 3EIδ/L² over it, 6EIδ/L³ less on it, 3EIδ/L³ more on each end', () => {
    const s = solved({ spans: equal(2), left: 'pin', right: 'pin', settlements: [0, d, 0] });
    near(s.joints[1].M, (3 * d) / (L * L), d / (L * L));
    near(s.reactions[1].Rv, (-6 * d) / L ** 3, d / L ** 3);
    near(s.reactions[0].Rv, (3 * d) / L ** 3, d / L ** 3);
    expect(s.joints.map((j) => j.EIv)).toEqual([0, -d, 0]);
    expect(s.at(L, 'left').EIv).toBe(-d);
    expect(s.totalLoad).toBe(0);
    // The size of the problem is the settlement's: a moment of 6EIδ/L² in each span, over the beam's length.
    near(s.loadScale, (2 * 6 * d) / (L * L) / (2 * L), d / L ** 3);
    // Twice as stiff, twice the forces for the same EI·δ of the reference section.
    const stiff = solved({ spans: equal(2, 2), left: 'pin', right: 'pin', settlements: [0, d, 0] });
    near(stiff.joints[1].M, (6 * d) / (L * L), d / (L * L));
  });

  it('one end of a span fixed at both: 6EIδ/L² at each end, 12EIδ/L³, and the cubic between them', () => {
    const s = solved({ spans: [{ L, k: 1 }], left: 'fixed', right: 'fixed', settlements: [0, d] });
    near(s.joints[0].M, (-6 * d) / (L * L), d / (L * L));
    near(s.joints[1].M, (6 * d) / (L * L), d / (L * L));
    near(s.reactions[0].Rv, (12 * d) / L ** 3, d / L ** 3);
    near(s.reactions[1].Rv, (-12 * d) / L ** 3, d / L ** 3);
    for (const x of [3, 9.5, 12, 20]) near(s.at(x).EIv, -d * ((3 * x * x) / (L * L) - (2 * x ** 3) / L ** 3), d, 1e-12);
    // From its own supports — the straight line from 0 to −δ — the span is an S: δ/6√3 above the line and as much below, at L(½ ∓ 1/√12).
    near(Math.abs(s.spans[0].EIvChord.value), d / (6 * Math.sqrt(3)), d, 1e-12);
    const off = Math.abs(s.spans[0].EIvChord.x - L / 2);
    near(off, L * Math.sqrt(1 / 12), L, 1e-8);
  });

  it('the simple end of a propped span: 3EIδ/L² at the wall, 3EIδ/L³', () => {
    const s = solved({ spans: [{ L, k: 1 }], left: 'fixed', right: 'pin', settlements: [0, d] });
    near(s.joints[0].M, (-3 * d) / (L * L), d / (L * L));
    near(s.reactions[1].Rv, (-3 * d) / L ** 3, d / L ** 3);
    near(s.reactions[0].Rv, (3 * d) / L ** 3, d / L ** 3);
  });

  it('every support by the same amount is the beam, lower: not one force more', () => {
    const loads = { dists: uniform([L, 18, L], w), points: [{ span: 1, a: 5, P }] };
    const spans = [{ L, k: 1 }, { L: 18, k: 2 }, { L, k: 0.5 }];
    const still = solved({ spans, left: 'fixed', right: 'pin', ...loads });
    const lower = solved({ spans, left: 'fixed', right: 'pin', settlements: [d, d, d, d], ...loads });
    expect(lower.reactions).toEqual(still.reactions);
    expect(lower.extremes.Mmin).toEqual(still.extremes.Mmin);
    expect(lower.spans.map((p) => p.EIvChord)).toEqual(still.spans.map((p) => p.EIvChord));
    for (const x of [0, 7, L, 30, 51.5, 66]) near(lower.at(x).EIv, still.at(x).EIv - d, Math.abs(still.extremes.EIvMin.value), 1e-12);
    expect(lower.loadScale).toBe(still.loadScale);
  });

  it('supports that go down in a straight line tilt the beam and bend nothing', () => {
    const spans = [{ L: 10, k: 1 }, { L: 20, k: 3 }, { L: 15, k: 0.5 }];
    const s = solved({ spans, left: 'pin', right: 'pin', settlements: [0, 20, 60, 90] });
    for (const r of s.reactions) near(r.Rv, 0, s.loadScale, 1e-12);
    near(s.extremes.Mmax.value, 0, s.loadScale * s.L, 1e-12);
    near(s.extremes.Mmin.value, 0, s.loadScale * s.L, 1e-12);
    for (const x of [4, 10, 22.5, 41]) near(s.at(x).EIv, -2 * x, 90, 1e-12);
    for (const p of s.spans) near(p.EIvChord.value, 0, 90, 1e-12);
  });

  it('a beam on two supports settles without a force: exactly none, and nothing from its own supports', () => {
    const s = solved({ spans: [{ L, k: 1.7 }], left: 'pin', right: 'pin', settlements: [3, -40] });
    expect(s.reactions.map((r) => r.Rv)).toEqual([0, 0]);
    expect(s.extremes.Mmax.value).toBe(0);
    expect(s.extremes.Vmin.value).toBe(0);
    expect(s.spans[0].EIvChord).toEqual({ value: 0, x: 0 });
    near(s.at(L / 2).EIv, (-3 + 40) / 2);
    // With an overhang, that swings with it.
    const o = solved({ spans: [{ L, k: 1 }, { L: 6, k: 1 }], left: 'pin', right: 'free', settlements: [0, 12] });
    expect(o.extremes.Mmin.value).toBe(0);
    near(o.at(L + 6).EIv, -12 - (12 / L) * 6);
    near(o.spans[1].EIvChord.value, (-12 / L) * 6);
  });

  it('under a free end there is no support to settle: what is entered there is not read', () => {
    const model = { spans: [{ L, k: 1 }, { L: 6, k: 1 }], left: 'pin' as const, right: 'free' as const, points: [{ span: 1, a: 6, P }] };
    const s = solved(model);
    for (const ghost of [50, -3, Number.NaN, Infinity]) expect(numbersOf(solved({ ...model, settlements: [0, 0, ghost] }))).toEqual(numbersOf(s));
    // Missing ones are supports that do not move; and past the last joint there is nothing to settle either.
    expect(numbersOf(solved({ ...model, settlements: [] }))).toEqual(numbersOf(s));
    expect(numbersOf(solved({ ...model, settlements: [0] }))).toEqual(numbersOf(s));
    expect(numbersOf(solved({ ...model, settlements: [0, 0, 0, 77, Number.NaN] }))).toEqual(numbersOf(s));
  });
});

/* ── Stepped stiffness, against Clapeyron ─────────────────────────────── */

/**
 * The three-moment equation, written out for a beam on simple supports,
 * each span with its own length, stiffness factor and uniform load, and
 * each support with its settlement (reference EI × δ, downward):
 *
 *   Mᵢ₋₁·Lᵢ/kᵢ + 2Mᵢ(Lᵢ/kᵢ + Lᵢ₊₁/kᵢ₊₁) + Mᵢ₊₁·Lᵢ₊₁/kᵢ₊₁
 *        = −wᵢLᵢ³/4kᵢ − wᵢ₊₁Lᵢ₊₁³/4kᵢ₊₁ + 6[(sᵢ − sᵢ₋₁)/Lᵢ + (sᵢ − sᵢ₊₁)/Lᵢ₊₁]
 *
 * and solved by the elimination a hand calculation does. The moments over
 * the supports, the two ends included (zero).
 */
function threeMoments(len: number[], k: number[], q: number[], s: number[] = []): number[] {
  const n = len.length - 1;
  if (n < 1) return [0, 0];
  const lower: number[] = [];
  const diag: number[] = [];
  const upper: number[] = [];
  const rhs: number[] = [];
  for (let i = 1; i <= n; i++) {
    const [l1, l2, k1, k2] = [len[i - 1], len[i], k[i - 1], k[i]];
    const z = (j: number) => s[j] ?? 0;
    lower.push(l1 / k1);
    diag.push(2 * (l1 / k1 + l2 / k2));
    upper.push(l2 / k2);
    rhs.push(-(q[i - 1] * l1 ** 3) / (4 * k1) - (q[i] * l2 ** 3) / (4 * k2) + 6 * ((z(i) - z(i - 1)) / l1 + (z(i) - z(i + 1)) / l2));
  }
  for (let i = 1; i < n; i++) {
    const f = lower[i] / diag[i - 1];
    diag[i] -= f * upper[i - 1];
    rhs[i] -= f * rhs[i - 1];
  }
  const M = new Array<number>(n).fill(0);
  for (let i = n - 1; i >= 0; i--) M[i] = (rhs[i] - (i < n - 1 ? upper[i] * M[i + 1] : 0)) / diag[i];
  return [0, ...M, 0];
}
/** The reactions those moments give, by the equilibrium of each span. */
function reactionsOf(len: number[], q: number[], M: number[]): number[] {
  const R = new Array<number>(len.length + 1).fill(0);
  len.forEach((l, i) => {
    R[i] += (q[i] * l) / 2 + (M[i + 1] - M[i]) / l;
    R[i + 1] += (q[i] * l) / 2 - (M[i + 1] - M[i]) / l;
  });
  return R;
}

describe('continuous beam: each span its own stiffness', () => {
  it('two spans: −(w₁L₁³/k₁ + w₂L₂³/k₂) / 8(L₁/k₁ + L₂/k₂) over the middle support', () => {
    const [l1, l2, k1, k2, w1, w2] = [18, 27, 2.5, 0.8, 1.1, 0.6];
    const s = solved({ spans: [{ L: l1, k: k1 }, { L: l2, k: k2 }], left: 'pin', right: 'pin', dists: uniform([l1, l2], [w1, w2]) });
    const MB = -((w1 * l1 ** 3) / k1 + (w2 * l2 ** 3) / k2) / (8 * (l1 / k1 + l2 / k2));
    near(s.joints[1].M, MB);
    near(s.reactions[0].Rv, (w1 * l1) / 2 + MB / l1);
    near(s.reactions[2].Rv, (w2 * l2) / 2 + MB / l2);
    // The slope over the support, from either span: w₁L₁³/24k₁ + M·L₁/3k₁.
    near(s.at(l1).EItheta, (w1 * l1 ** 3) / (24 * k1) + (MB * l1) / (3 * k1));
    near(s.at(l1, 'left').EItheta, s.at(l1, 'right').EItheta, Math.abs(s.at(l1).EItheta), 1e-12);
  });

  it('four and eight spans, stepped, against the three-moment equation written out here', () => {
    const cases: [number[], number[], number[], number[]][] = [
      [[18, 26, 22, 30], [1, 2.5, 0.6, 1.8], [1.1, 0.4, 2.0, 0.9], []],
      [[18, 26, 22, 30], [1, 2.5, 0.6, 1.8], [1.1, 0.4, 2.0, 0.9], [0, 300, -120, 80, 0]],
      [[12, 30, 9, 21, 15, 40, 8, 26], [0.5, 4, 1, 1, 2.2, 0.3, 7, 1.5], [2, 0.5, 0, 1.4, 3, 0.8, 1, 0.6], [10, 0, 0, 65, -30, 0, 0, 12, 0]],
      [[20, 20, 20], [1, 50, 1], [0, 1, 0], []],
      [[20, 20, 20], [1, 0.02, 1], [1, 0, 1], [0, 0, 500, 0]],
    ];
    for (const [len, k, q, settlements] of cases) {
      const s = solved({ spans: len.map((length, i) => ({ L: length, k: k[i] })), left: 'pin', right: 'pin', dists: uniform(len, q), settlements });
      const M = threeMoments(len, k, q, settlements);
      const top = Math.max(...M.map(Math.abs), 1e-9);
      s.joints.forEach((j, i) => near(j.M, M[i], top, 1e-11));
      const R = reactionsOf(len, q, M);
      const big = Math.max(...R.map(Math.abs));
      s.reactions.forEach((r, i) => near(r.Rv, R[i], big, 1e-11));
      near(s.residual.slope, 0, Math.max(Math.abs(s.extremes.EIthetaMax.value), Math.abs(s.extremes.EIthetaMin.value)), 1e-11);
    }
  });

  it('a span a thousand times stiffer than its neighbours is a wall to them; a thousand times more flexible, a gap', () => {
    // Stiff in the middle and loaded at the sides: each side span is fixed at its inner end, to a thousandth.
    const wallish = solved({ spans: [{ L, k: 1 }, { L, k: STIFF }, { L, k: 1 }], left: 'pin', right: 'pin', dists: [{ span: 0, a1: 0, a2: L, w1: w, w2: w }, { span: 2, a1: 0, a2: L, w1: w, w2: w }] });
    const M = threeMoments([L, L, L], [1, STIFF, 1], [w, 0, w]);
    near(wallish.joints[1].M, M[1], Math.abs(M[1]), 1e-12);
    near(wallish.joints[1].M, (-w * L * L) / 8, w * L * L, 3e-3);
    // Flexible in the middle: the side spans hardly know it is there.
    const gap = solved({ spans: [{ L, k: 1 }, { L, k: 1 / STIFF }, { L, k: 1 }], left: 'pin', right: 'pin', dists: [{ span: 0, a1: 0, a2: L, w1: w, w2: w }, { span: 2, a1: 0, a2: L, w1: w, w2: w }] });
    const m = threeMoments([L, L, L], [1, 1 / STIFF, 1], [w, 0, w]);
    near(gap.joints[1].M, m[1], Math.abs(m[1]), 1e-12);
    expect(Math.abs(gap.joints[1].M)).toBeLessThan(1e-3 * w * L * L);
    near(gap.spans[0].Mmax.value, (w * L * L) / 8, w * L * L, 1e-3);
  });
});

/* ── Random beams ─────────────────────────────────────────────────────── */

function mulberry32(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const round2 = (v: number) => Math.round(v * 100) / 100;
const KINDS: EndKind[] = ['pin', 'fixed', 'free'];
/** Do the supports hold it? The count the engine is to make, made here by listing: no wall, and fewer than two supports. */
const stands = (n: number, left: EndKind, right: EndKind) => left === 'fixed' || right === 'fixed' || n - 1 + (left === 'pin' ? 1 : 0) + (right === 'pin' ? 1 : 0) >= 2;

/**
 * A beam as a visitor could have it: one to five spans, any way of holding
 * the ends that stands, a few loads of each kind anywhere — on a support,
 * entered right to left, either way up — and, when asked, its own stiffness
 * in every span and supports that settle.
 */
function randomBeam(seed: number, own = false): ContinuousModel {
  const r = mulberry32(seed);
  const n = 1 + Math.floor(r() * 5);
  const spans = Array.from({ length: n }, () => ({ L: round2(4 + r() * 30), k: own ? [1, 0.5, 2, round2(0.2 + r() * 4.8), round2(0.05 + r() * 40)][Math.floor(r() * 5)] : 1 }));
  let left = KINDS[Math.floor(r() * 3)];
  let right = KINDS[Math.floor(r() * 3)];
  if (!stands(n, left, right)) [left, right] = ['pin', 'pin'];
  const load = () => round2(r() * 20 - 6);
  const points = Array.from({ length: Math.floor(r() * 4) }, () => {
    const span = Math.floor(r() * n);
    const u = r();
    return { span, a: u < 0.08 ? 0 : u < 0.16 ? spans[span].L : round2(r() * spans[span].L), P: load() };
  });
  const dists = Array.from({ length: Math.floor(r() * 4) }, () => {
    const span = Math.floor(r() * n);
    const a = r() < 0.3 ? 0 : round2(r() * spans[span].L);
    const b = r() < 0.3 ? spans[span].L : round2(r() * spans[span].L);
    return { span, a1: a, a2: b, w1: load() / 4, w2: r() < 0.3 ? 0 : load() / 4 };
  });
  const model: ContinuousModel = { spans, left, right, points, dists };
  if (own && r() < 0.6) model.settlements = Array.from({ length: n + 1 }, () => (r() < 0.4 ? 0 : round2(r() * 400 - 100)));
  return model;
}
/** Where each joint is. */
const jointsOf = (m: ContinuousModel) => m.spans.reduce((xs, s) => [...xs, xs[xs.length - 1] + s.L], [0]);
/** The same beam for the first calculator's engine: one stiffness, no settlement. */
function asBeam(m: ContinuousModel): BeamModel {
  const X = jointsOf(m);
  const n = m.spans.length;
  const supports: BeamModel['supports'] = [];
  X.forEach((x, j) => {
    const kind = j === 0 ? m.left : j === n ? m.right : 'pin';
    if (kind !== 'free') supports.push({ x, kind });
  });
  return {
    L: X[n],
    supports,
    points: (m.points ?? []).map((p) => ({ x: X[p.span] + p.a, P: p.P })),
    dists: (m.dists ?? []).map((d) => ({ x1: X[d.span] + d.a1, x2: X[d.span] + d.a2, w1: d.w1, w2: d.w2 })),
  };
}

describe('continuous beam: the first calculator’s engine, on every beam both can solve (300 random ones)', () => {
  // beam/solver.ts solves by initial parameters and Macaulay brackets: its
  // unknowns are the reactions, and there is no stiffness matrix in it.
  it('agrees on every response at every break (both sides) and between, on the reactions and on the largest values', () => {
    let compared = 0;
    for (let seed = 1; seed <= 300; seed++) {
      const m = randomBeam(seed);
      const c = solved(m);
      const b = solveBeam(asBeam(m));
      if (!b.ok) throw new Error(`the first engine refused seed ${seed}: ${JSON.stringify(b.issues)}`);
      compared += 1;
      // The largest of each diagram — or, for a diagram that is zero all along, the size of the problem.
      const F = c.loadScale;
      const top = (of: (s: BeamState) => number, floor: number) => Math.max(1e-3 * floor, ...b.stations.map((s) => Math.abs(of(s))));
      const tops = { V: top((s) => s.V, F), M: top((s) => s.M, F * c.L), T: top((s) => s.EItheta, F * c.L ** 2), Y: top((s) => s.EIv, F * c.L ** 3) };
      const r = mulberry32(seed + 77);
      const xs = [...c.breaks, ...b.breaks, ...Array.from({ length: 40 }, () => r() * c.L)];
      for (const x of xs) {
        for (const side of ['left', 'right'] as const) {
          const [p, q] = [c.at(x, side), b.at(x, side)];
          near(p.V, q.V, tops.V, 1e-9);
          near(p.M, q.M, tops.M, 1e-9);
          near(p.EItheta, q.EItheta, tops.T, 1e-9);
          near(p.EIv, q.EIv, tops.Y, 1e-9);
          near(p.w, q.w, Math.max(1, Math.abs(q.w)), 1e-9);
        }
      }
      // The same supports in the same places, walls where the walls are. (Which simple support is called the pin is each engine's own.)
      expect(c.reactions.map((p) => p.kind === 'fixed')).toEqual(b.reactions.map((q) => q.kind === 'fixed'));
      c.reactions.forEach((p, i) => near(p.x, b.reactions[i].x, c.L, 1e-12));
      const largest = Math.max(1e-3 * F, ...b.reactions.map((q) => Math.abs(q.Rv)));
      c.reactions.forEach((p, i) => {
        near(p.Rv, b.reactions[i].Rv, largest, 1e-9);
        near(p.Rm, b.reactions[i].Rm, tops.M, 1e-9);
      });
      near(c.extremes.Vmax.value, b.extremes.Vmax.value, tops.V, 1e-9);
      near(c.extremes.Vmin.value, b.extremes.Vmin.value, tops.V, 1e-9);
      near(c.extremes.Mmax.value, b.extremes.Mmax.value, tops.M, 1e-9);
      near(c.extremes.Mmin.value, b.extremes.Mmin.value, tops.M, 1e-9);
      near(c.extremes.EIvMax.value, b.extremes.EIvMax.value, tops.Y, 1e-9);
      near(c.extremes.EIvMin.value, b.extremes.EIvMin.value, tops.Y, 1e-9);
      near(c.extremes.EIthetaMax.value, b.extremes.EIthetaMax.value, tops.T, 1e-9);
      near(c.extremes.EIthetaMin.value, b.extremes.EIthetaMin.value, tops.T, 1e-9);
      near(c.totalLoad, b.totalLoad, F, 1e-12);
      expect(c.breaks.length).toBe(b.breaks.length);
      c.breaks.forEach((x, i) => near(x, b.breaks[i], c.L, 1e-12));
    }
    expect(compared).toBe(300);
  }, 60_000);

  it('and on which beams the supports do not hold: every way of holding the ends of one to four spans', () => {
    for (let n = 1; n <= 4; n++) {
      for (const left of KINDS) {
        for (const right of KINDS) {
          const m: ContinuousModel = { spans: Array.from({ length: n }, (_, i) => ({ L: 10 + 3 * i, k: 1 })), left, right, points: [{ span: 0, a: 4, P }] };
          const first = solveBeam(asBeam(m));
          const held = stands(n, left, right);
          expect(solveContinuous(m).ok, `${n} spans, ${left}–${right}`).toBe(held);
          expect(first.ok, `${n} spans, ${left}–${right}, the first engine`).toBe(held);
          if (!held) expect(issuesOf(m)).toEqual(['unstable']);
        }
      }
    }
  });
});

describe('continuous beam: what is true of every beam (200 random ones, each span its own stiffness, supports that settle)', () => {
  const SEEDS = Array.from({ length: 200 }, (_, i) => 5000 + i * 13);
  /** What each response is measured against: the size of the problem, as each response has it. */
  const scales = (m: ContinuousModel, s: ContinuousSolution) => {
    const F = s.loadScale || 1;
    const soft = Math.min(...m.spans.map((p) => p.k));
    return { V: F, M: F * s.L, T: (F * s.L ** 2) / soft, Y: (F * s.L ** 3) / soft + Math.max(0, ...(m.settlements ?? []).map(Math.abs)) };
  };

  it('satisfies the beam equation: in every stretch, each diagram is the integral of the one before — V′ = −w, M′ = V, k·EIθ′ = M, EIv′ = EIθ', () => {
    // Between two places where something happens the load is a straight
    // line, so the shear is of the second degree and the deflection of the
    // fifth: three Gauss points integrate every one of them exactly.
    for (const seed of SEEDS) {
      const m = randomBeam(seed, true);
      const s = solved(m);
      const sc = scales(m, s);
      const X = jointsOf(m);
      for (let i = 0; i < s.breaks.length - 1; i++) {
        const [p, q] = [s.breaks[i], s.breaks[i + 1]];
        const span = X.findIndex((x) => x > p + 1e-9 * s.L) - 1;
        const k = m.spans[span].k;
        const [a, b] = [s.at(p, 'right'), s.at(q, 'left')];
        // The load in it is the load that was entered: its intensity in the middle of the stretch, added up here from the model.
        const mid = (p + q) / 2 - X[span];
        const entered = (m.dists ?? [])
          .filter((d) => d.span === span)
          .reduce((sum, d) => {
            const [a1, a2, w1, w2] = d.a1 <= d.a2 ? [d.a1, d.a2, d.w1, d.w2] : [d.a2, d.a1, d.w2, d.w1];
            return mid > a1 && mid < a2 ? sum + w1 + ((w2 - w1) * (mid - a1)) / (a2 - a1) : sum;
          }, 0);
        near(s.at((p + q) / 2).w, entered, Math.max(1, Math.abs(entered)), 1e-11);
        near(b.V - a.V, -gauss((x) => s.at(x).w, p, q), sc.V, 1e-11);
        near(b.M - a.M, gauss((x) => s.at(x).V, p, q), sc.M, 1e-11);
        near(b.EItheta - a.EItheta, gauss((x) => s.at(x).M, p, q) / k, sc.T, 1e-11);
        near(b.EIv - a.EIv, gauss((x) => s.at(x).EItheta, p, q), sc.Y, 1e-11);
      }
    }
  });

  it('is one beam: moment, slope and deflection do not jump anywhere, and the shear jumps by the load or the reaction that stands there', () => {
    for (const seed of SEEDS) {
      const m = randomBeam(seed, true);
      const s = solved(m);
      const sc = scales(m, s);
      const X = jointsOf(m);
      for (const x of s.breaks.slice(1, -1)) {
        const [a, b] = [s.at(x, 'left'), s.at(x, 'right')];
        near(b.M, a.M, sc.M, 1e-12);
        near(b.EItheta, a.EItheta, sc.T, 1e-11);
        near(b.EIv, a.EIv, sc.Y, 1e-12);
        const loads = (m.points ?? []).filter((p) => Math.abs(X[p.span] + p.a - x) < 1e-9 * s.L).reduce((sum, p) => sum + p.P, 0);
        const reaction = s.reactions.find((r) => r.x === x)?.Rv ?? 0;
        near(b.V - a.V, reaction - loads, sc.V, 1e-12);
      }
    }
  });

  it('is held as it was entered: each support where its settlement puts it, no turn in a wall, no moment at a simple or a free end, no shear at a free one', () => {
    for (const seed of SEEDS) {
      const m = randomBeam(seed, true);
      const s = solved(m);
      const X = jointsOf(m);
      const n = m.spans.length;
      X.forEach((x, j) => {
        const kind = j === 0 ? m.left : j === n ? m.right : 'pin';
        const here = s.at(x);
        // Exactly: these are what was entered, not what was worked out.
        if (kind !== 'free') expect(here.EIv, `seed ${seed}, joint ${j}`).toBe(-(m.settlements?.[j] ?? 0) + 0);
        if (kind === 'fixed') near(here.EItheta, 0, scales(m, s).T, 1e-12);
        if ((j === 0 || j === n) && kind !== 'fixed') expect(s.joints[j].M).toBe(0);
        expect(s.joints[j]).toMatchObject({ x, EIv: here.EIv, EItheta: here.EItheta, support: kind === 'free' ? null : s.joints[j].support });
      });
      // Past either end there is nothing: the moment and the shear there are the end's own jump.
      const [first, last] = [s.at(0, 'right'), s.at(s.L, 'left')];
      const F = s.loadScale || 1;
      const tip = (x: number) => (m.points ?? []).filter((p) => Math.abs(X[p.span] + p.a - x) < 1e-9 * s.L).reduce((sum, p) => sum + p.P, 0);
      if (m.left === 'free') near(first.V, -tip(0), F, 1e-12);
      if (m.right === 'free') near(last.V, tip(s.L), F, 1e-12);
      if (m.left !== 'fixed') near(first.M, 0, F * s.L, 1e-12);
      if (m.right !== 'fixed') near(last.M, 0, F * s.L, 1e-12);
      expect(s.at(0, 'left')).toMatchObject({ V: 0, M: 0, w: 0 });
      expect(s.at(s.L, 'right')).toMatchObject({ V: 0, M: 0, w: 0 });
    }
  });

  it('is in equilibrium: the reactions carry the loads, added up here from the model', () => {
    for (const seed of SEEDS) {
      const m = randomBeam(seed, true);
      const s = solved(m);
      const X = jointsOf(m);
      const F = s.loadScale || 1;
      const sum = (list: number[]) => list.reduce((p, q) => p + q, 0);
      const dists = m.dists ?? [];
      const W = sum((m.points ?? []).map((p) => p.P)) + sum(dists.map((d) => ((d.w1 + d.w2) / 2) * Math.abs(d.a2 - d.a1)));
      near(sum(s.reactions.map((r) => r.Rv)), W, F, 1e-11);
      near(s.totalLoad, W, F, 1e-12);
      // About x = 0, counter-clockwise: ∫ w·x dx of a trapezoid is |x₂ − x₁|·[w₁(2x₁ + x₂) + w₂(x₁ + 2x₂)]/6, whichever way round it was entered.
      const ofLoads =
        -sum((m.points ?? []).map((p) => p.P * (X[p.span] + p.a))) -
        sum(
          dists.map((d) => {
            const [x1, x2] = [X[d.span] + d.a1, X[d.span] + d.a2];
            return (Math.abs(x2 - x1) * (d.w1 * (2 * x1 + x2) + d.w2 * (x1 + 2 * x2))) / 6;
          }),
        );
      near(sum(s.reactions.map((r) => r.Rv * r.x + r.Rm)) + ofLoads, 0, F * s.L, 1e-11);
      near(s.residual.force, 0, F, 1e-11);
      near(s.residual.moment, 0, F * s.L, 1e-11);
      const steep = Math.max(Math.abs(s.extremes.EIthetaMax.value), Math.abs(s.extremes.EIthetaMin.value), 1e-300);
      expect(s.residual.slope).toBeLessThanOrEqual(1e-11 * Math.max(steep, scales(m, s).T));
    }
  });

  it('adds up: two sets of loads and settlements together are the two answers added', () => {
    for (const seed of SEEDS.slice(0, 80)) {
      const base = randomBeam(seed, true);
      const other = randomBeam(seed + 1, true);
      const n = base.spans.length;
      // The other beam's loads, moved onto this one's spans.
      const span = (i: number) => i % n;
      const fit = (a: number, from: number, to: number) => (a / other.spans[from].L) * base.spans[to].L;
      const extra = {
        points: (other.points ?? []).map((p) => ({ span: span(p.span), a: fit(p.a, p.span, span(p.span)), P: p.P })),
        dists: (other.dists ?? []).map((d) => ({ span: span(d.span), a1: fit(d.a1, d.span, span(d.span)), a2: fit(d.a2, d.span, span(d.span)), w1: d.w1, w2: d.w2 })),
        settlements: Array.from({ length: n + 1 }, (_, j) => other.settlements?.[j] ?? 0),
      };
      const a = solved(base);
      const b = solved({ ...base, ...extra });
      const both = solved({
        ...base,
        points: [...(base.points ?? []), ...extra.points],
        dists: [...(base.dists ?? []), ...extra.dists],
        settlements: extra.settlements.map((v, j) => v + (base.settlements?.[j] ?? 0)),
      });
      const sc = scales(base, both);
      const size = (a.loadScale + b.loadScale) / (both.loadScale || 1);
      for (const t of [0.13, 0.37, 0.5, 0.71, 0.94]) {
        const x = t * a.L;
        near(both.at(x).V, a.at(x).V + b.at(x).V, sc.V * Math.max(1, size), 1e-11);
        near(both.at(x).M, a.at(x).M + b.at(x).M, sc.M * Math.max(1, size), 1e-11);
        near(both.at(x).EIv, a.at(x).EIv + b.at(x).EIv, sc.Y * Math.max(1, size), 1e-11);
      }
      both.reactions.forEach((r, i) => near(r.Rv, a.reactions[i].Rv + b.reactions[i].Rv, sc.V * Math.max(1, size), 1e-11));
    }
  });

  it('mirrors: the same beam seen from the other side', () => {
    for (const seed of SEEDS.slice(0, 80)) {
      const m = randomBeam(seed, true);
      const n = m.spans.length;
      const mirrored: ContinuousModel = {
        spans: [...m.spans].reverse(),
        left: m.right,
        right: m.left,
        settlements: m.settlements ? [...m.settlements].reverse() : undefined,
        points: (m.points ?? []).map((p) => ({ span: n - 1 - p.span, a: m.spans[p.span].L - p.a, P: p.P })),
        dists: (m.dists ?? []).map((d) => ({ span: n - 1 - d.span, a1: m.spans[d.span].L - d.a2, a2: m.spans[d.span].L - d.a1, w1: d.w2, w2: d.w1 })),
      };
      const a = solved(m);
      const b = solved(mirrored);
      const sc = scales(m, a);
      const flip = (x: number) => a.L - x;
      for (const t of [0.11, 0.29, 0.5, 0.63, 0.87]) {
        const x = t * a.L;
        if (a.breaks.some((p) => Math.abs(p - x) < 1e-6 * a.L)) continue;
        near(b.at(flip(x)).V, -a.at(x).V, sc.V, 1e-10);
        near(b.at(flip(x)).M, a.at(x).M, sc.M, 1e-10);
        near(b.at(flip(x)).EIv, a.at(x).EIv, sc.Y, 1e-10);
        near(b.at(flip(x)).EItheta, -a.at(x).EItheta, sc.T, 1e-10);
      }
      const back = [...b.reactions].reverse();
      a.reactions.forEach((r, i) => {
        near(back[i].Rv, r.Rv, sc.V, 1e-11);
        near(back[i].Rm, -r.Rm, sc.M, 1e-11);
      });
      const spans = [...b.spans].reverse();
      a.spans.forEach((p, i) => {
        near(spans[i].Mmax.value, p.Mmax.value, sc.M, 1e-11);
        near(spans[i].Mmin.value, p.Mmin.value, sc.M, 1e-11);
        near(spans[i].Vmax.value, -p.Vmin.value, sc.V, 1e-11);
        near(spans[i].EIvChord.value, p.EIvChord.value, sc.Y, 1e-11);
      });
    }
  });

  it('does not depend on the unit of length: feet or inches', () => {
    const c = 12;
    for (const seed of SEEDS.slice(0, 60)) {
      const feet = randomBeam(seed, true);
      const inches: ContinuousModel = {
        ...feet,
        spans: feet.spans.map((p) => ({ L: p.L * c, k: p.k })),
        // Reference EI × a length: F·L³.
        settlements: feet.settlements?.map((v) => v * c ** 3),
        points: (feet.points ?? []).map((p) => ({ ...p, a: p.a * c })),
        dists: (feet.dists ?? []).map((d) => ({ ...d, a1: d.a1 * c, a2: d.a2 * c, w1: d.w1 / c, w2: d.w2 / c })),
      };
      const a = solved(feet);
      const b = solved(inches);
      const sc = scales(feet, a);
      b.reactions.forEach((r, i) => {
        near(r.Rv, a.reactions[i].Rv, sc.V, 1e-11);
        near(r.Rm, a.reactions[i].Rm * c, sc.M * c, 1e-11);
      });
      near(b.extremes.Mmin.value, a.extremes.Mmin.value * c, sc.M * c, 1e-11);
      near(b.extremes.EIvMin.value, a.extremes.EIvMin.value * c ** 3, sc.Y * c ** 3, 1e-11);
      near(b.extremes.Vmax.value, a.extremes.Vmax.value, sc.V, 1e-11);
      near(b.loadScale, a.loadScale, sc.V, 1e-11);
      b.spans.forEach((p, i) => near(p.EIvChord.value, a.spans[i].EIvChord.value * c ** 3, sc.Y * c ** 3, 1e-11));
    }
  });

  it('does not depend on which section is called the reference: every factor × c and every settlement ÷ c, the same forces and EI·v ÷ c', () => {
    for (const seed of SEEDS.slice(0, 60)) {
      const m = randomBeam(seed, true);
      for (const c of [4, 0.125]) {
        const other = solved({ ...m, spans: m.spans.map((p) => ({ L: p.L, k: p.k * c })), settlements: m.settlements?.map((v) => v / c) });
        const s = solved(m);
        const sc = scales(m, s);
        other.reactions.forEach((r, i) => near(r.Rv, s.reactions[i].Rv, sc.V, 1e-11));
        other.joints.forEach((j, i) => near(j.M, s.joints[i].M, sc.M, 1e-11));
        for (const t of [0.07, 0.31, 0.52, 0.77, 0.96]) {
          near(other.at(t * s.L).M, s.at(t * s.L).M, sc.M, 1e-11);
          near(other.at(t * s.L).EIv, s.at(t * s.L).EIv / c, sc.Y / c, 1e-11);
          near(other.at(t * s.L).EItheta, s.at(t * s.L).EItheta / c, sc.T / c, 1e-11);
        }
      }
    }
  });
});
describe('continuous beam: the largest values are values the beam takes, and nothing exceeds them', () => {
  const SEEDS = Array.from({ length: 80 }, (_, i) => 9000 + i * 7);
  it('no point of the beam, on either side of anything, is past an extreme; and each extreme is the value at the place it names', () => {
    for (const seed of SEEDS) {
      const m = randomBeam(seed, true);
      const s = solved(m);
      const e = s.extremes;
      const F = s.loadScale || 1;
      const soft = Math.min(...m.spans.map((p) => p.k));
      const sc = { V: F, M: F * s.L, Y: (F * s.L ** 3) / soft + Math.max(0, ...(m.settlements ?? []).map(Math.abs)), T: (F * s.L ** 2) / soft };
      for (let i = 0; i <= 400; i++) {
        for (const side of ['left', 'right'] as const) {
          // Past an end there is no beam: its zeros are not the beam's.
          if ((i === 0 && side === 'left') || (i === 400 && side === 'right')) continue;
          const st = s.at((i / 400) * s.L, side);
          expect(st.V).toBeLessThanOrEqual(e.Vmax.value + 1e-9 * sc.V);
          expect(st.V).toBeGreaterThanOrEqual(e.Vmin.value - 1e-9 * sc.V);
          expect(st.M).toBeLessThanOrEqual(e.Mmax.value + 1e-9 * sc.M);
          expect(st.M).toBeGreaterThanOrEqual(e.Mmin.value - 1e-9 * sc.M);
          expect(st.EIv).toBeLessThanOrEqual(e.EIvMax.value + 1e-9 * sc.Y);
          expect(st.EIv).toBeGreaterThanOrEqual(e.EIvMin.value - 1e-9 * sc.Y);
          expect(st.EItheta).toBeLessThanOrEqual(e.EIthetaMax.value + 1e-9 * sc.T);
          expect(st.EItheta).toBeGreaterThanOrEqual(e.EIthetaMin.value - 1e-9 * sc.T);
        }
      }
      const hit = (x: number, of: (st: BeamState) => number, value: number) => expect(Math.min(Math.abs(of(s.at(x, 'left')) - value), Math.abs(of(s.at(x, 'right')) - value)), `seed ${seed} at ${x}`).toBe(0);
      hit(e.Vmax.x, (st) => st.V, e.Vmax.value);
      hit(e.Vmin.x, (st) => st.V, e.Vmin.value);
      hit(e.Mmax.x, (st) => st.M, e.Mmax.value);
      hit(e.Mmin.x, (st) => st.M, e.Mmin.value);
      hit(e.EIvMax.x, (st) => st.EIv, e.EIvMax.value);
      hit(e.EIvMin.x, (st) => st.EIv, e.EIvMin.value);
      hit(e.EIthetaMax.x, (st) => st.EItheta, e.EIthetaMax.value);
    }
  }, 60_000);

  it('they are found, not picked from the stations: a moment where the shear is zero, a deflection where the slope is', () => {
    // 0.4L of three equal spans is not a station of anybody's grid.
    const s = solved({ spans: equal(3), left: 'pin', right: 'pin', dists: uniform([L, L, L], w) });
    near(s.at(s.extremes.Mmax.x).V, 0, w * L, 1e-12);
    near(s.at(s.extremes.EIvMin.x).EItheta, 0, w * L ** 3, 1e-12);
    for (const seed of SEEDS) {
      const m = randomBeam(seed, true);
      const c = solved(m);
      const F = c.loadScale || 1;
      const soft = Math.min(...m.spans.map((p) => p.k));
      for (const p of c.spans) {
        for (const e of [p.Mmax, p.Mmin]) {
          // Inside a stretch the moment turns only where the shear is zero; at a place where something happens it need not be.
          if (c.breaks.some((b) => Math.abs(b - e.x) < 1e-7 * c.L)) continue;
          near(c.at(e.x).V, 0, F, 1e-9);
        }
        if (!c.breaks.some((b) => Math.abs(b - p.EIvChord.x) < 1e-7 * c.L) && p.EIvChord.value !== 0) near(c.fromSupports(p.index, p.EIvChord.x).EItheta, 0, (F * c.L ** 2) / soft, 1e-9);
      }
    }
  });

  it('each span has ITS largest values: nothing in the span is past them, and they are in the span', () => {
    for (const seed of SEEDS) {
      const m = randomBeam(seed, true);
      const s = solved(m);
      const F = s.loadScale || 1;
      const soft = Math.min(...m.spans.map((p) => p.k));
      const yScale = (F * s.L ** 3) / soft + Math.max(0, ...(m.settlements ?? []).map(Math.abs));
      expect(s.spans.map((p) => [p.index, p.from, p.to])).toEqual(m.spans.map((_, i) => [i, jointsOf(m)[i], jointsOf(m)[i + 1]]));
      for (const p of s.spans) {
        expect(p.kind).toBe((p.index === 0 && m.left === 'free') || (p.index === m.spans.length - 1 && m.right === 'free') ? 'cantilever' : 'span');
        for (const e of [p.Mmax, p.Mmin, p.Vmax, p.Vmin, p.EIvChord]) {
          expect(e.x).toBeGreaterThanOrEqual(p.from);
          expect(e.x).toBeLessThanOrEqual(p.to);
        }
        let deepest = 0;
        for (let i = 0; i <= 60; i++) {
          const x = p.from + ((p.to - p.from) * i) / 60;
          // Inside the span: on its own side of each of its ends.
          for (const side of i === 0 ? (['right'] as const) : i === 60 ? (['left'] as const) : (['left', 'right'] as const)) {
            const st = s.at(x, side);
            expect(st.M).toBeLessThanOrEqual(p.Mmax.value + 1e-9 * F * s.L);
            expect(st.M).toBeGreaterThanOrEqual(p.Mmin.value - 1e-9 * F * s.L);
            expect(st.V).toBeLessThanOrEqual(p.Vmax.value + 1e-9 * F);
            expect(st.V).toBeGreaterThanOrEqual(p.Vmin.value - 1e-9 * F);
            deepest = Math.max(deepest, Math.abs(s.fromSupports(p.index, x, side).EIv));
          }
        }
        expect(deepest).toBeLessThanOrEqual(Math.abs(p.EIvChord.value) + 1e-9 * yScale);
        near(Math.abs(s.fromSupports(p.index, p.EIvChord.x).EIv), Math.abs(p.EIvChord.value), yScale, 1e-12);
      }
      // The beam's largest are the largest of its spans'.
      near(s.extremes.Mmax.value, Math.max(...s.spans.map((p) => p.Mmax.value)), F * s.L, 1e-12);
      near(s.extremes.Mmin.value, Math.min(...s.spans.map((p) => p.Mmin.value)), F * s.L, 1e-12);
      near(s.extremes.Vmax.value, Math.max(...s.spans.map((p) => p.Vmax.value)), F, 1e-12);
    }
  }, 60_000);

  it('a span’s deflection is measured from its own supports: from the line through both, or from its one', () => {
    for (const seed of SEEDS) {
      const m = randomBeam(seed, true);
      const s = solved(m);
      const F = s.loadScale || 1;
      const soft = Math.min(...m.spans.map((p) => p.k));
      const yScale = (F * s.L ** 3) / soft + Math.max(0, ...(m.settlements ?? []).map(Math.abs));
      for (const p of s.spans) {
        const [a, b] = [s.at(p.from, 'right').EIv, s.at(p.to, 'left').EIv];
        for (const t of [0, 0.2, 0.55, 0.9, 1]) {
          const x = p.from + t * (p.to - p.from);
          const side = t === 1 ? 'left' : 'right';
          const line = p.kind === 'span' ? a + (b - a) * t : p.index === 0 && m.left === 'free' ? b : a;
          near(s.fromSupports(p.index, x, side).EIv, s.at(x, side).EIv - line, yScale, 1e-11);
          // Everything else there is the beam's.
          expect(s.fromSupports(p.index, x, side)).toMatchObject({ x, V: s.at(x, side).V, M: s.at(x, side).M, w: s.at(x, side).w });
        }
      }
    }
  });
});

describe('continuous beam: what a solution holds', () => {
  const model: ContinuousModel = {
    spans: [{ L: 20, k: 1 }, { L: 30, k: 1.5 }, { L: 10, k: 1 }],
    left: 'fixed',
    right: 'free',
    points: [{ span: 1, a: 12, P }, { span: 2, a: 10, P: 3 }],
    dists: [{ span: 0, a1: 5, a2: 20, w1: 0, w2: w }, { span: 1, a1: 0, a2: 30, w1: w, w2: w }],
  };
  it('lists every place where something happens, and has a station on both sides of each', () => {
    const s = solved(model);
    expect(s.L).toBe(60);
    expect(s.breaks).toEqual([0, 5, 20, 32, 50, 60]);
    expect(s.joints.map((j) => [j.x, j.support])).toEqual([[0, 'fixed'], [20, 'pin'], [50, 'roller'], [60, null]]);
    expect(s.reactions.map((r) => [r.x, r.kind])).toEqual([[0, 'fixed'], [20, 'pin'], [50, 'roller']]);
    for (const x of s.breaks) {
      const here = s.stations.filter((st) => st.x === x);
      expect(here).toHaveLength(x === 0 || x === 60 ? 1 : 2);
      expect(here[0]).toEqual(s.at(x, x === 0 ? 'right' : 'left'));
      expect(here[here.length - 1]).toEqual(s.at(x, x === 60 ? 'left' : 'right'));
    }
    // In order along the beam, each the formula at its place, and none further apart than a 240th of the length.
    s.stations.forEach((st, i) => {
      if (i === 0) return;
      expect(st.x).toBeGreaterThanOrEqual(s.stations[i - 1].x);
      expect(st.x - s.stations[i - 1].x).toBeLessThanOrEqual(s.L / 240 + 1e-12);
    });
    for (const st of s.stations.filter((_, i) => i % 7 === 3)) expect([s.at(st.x, 'left'), s.at(st.x, 'right')]).toContainEqual(st);
    expect(numbersOf(s).every(Number.isFinite)).toBe(true);
  });

  it('reads a point on the side asked for: right by default, left at the end of the beam', () => {
    const s = solved(model);
    expect(s.at(32)).toEqual(s.at(32, 'right'));
    expect(s.at(60)).toEqual(s.at(60, 'left'));
    near(s.at(32, 'left').V - s.at(32, 'right').V, P);
    // Over a support the shear jumps by its reaction; the moment is one number, and it is the joint's.
    near(s.at(50, 'right').V - s.at(50, 'left').V, s.reactions[2].Rv);
    expect(s.at(50, 'left').M).toBe(s.joints[2].M);
    expect(s.at(50, 'right').M).toBe(s.joints[2].M);
    expect(s.at(20, 'left').M).toBe(s.at(20, 'right').M);
    // The intensity of the load: on the side asked for, where a load begins or ends.
    expect(s.at(5, 'left').w).toBe(0);
    near(s.at(12.5).w, w / 2);
    near(s.at(20, 'left').w, w);
    expect(s.at(50, 'right').w).toBe(0);
    // Off the beam is its end.
    expect(s.at(-3)).toEqual(s.at(0));
    expect(s.at(99)).toEqual(s.at(60));
  });

  it('names the supports as the first calculator does: the first simple one the pin, the others rollers, a built-in end fixed', () => {
    const kinds = (left: EndKind, right: EndKind) => solved({ ...model, left, right }).reactions.map((r) => r.kind);
    expect(kinds('pin', 'pin')).toEqual(['pin', 'roller', 'roller', 'roller']);
    expect(kinds('fixed', 'fixed')).toEqual(['fixed', 'pin', 'roller', 'fixed']);
    expect(kinds('free', 'pin')).toEqual(['pin', 'roller', 'roller']);
    expect(kinds('free', 'free')).toEqual(['pin', 'roller']);
  });

  it('takes a distributed load entered right to left, and ignores a load of no size or of no length', () => {
    const s = solved(model);
    const same = solved({
      ...model,
      dists: [{ span: 0, a1: 20, a2: 5, w1: w, w2: 0 }, { span: 1, a1: 30, a2: 0, w1: w, w2: w }, { span: 2, a1: 4, a2: 4, w1: 9, w2: 9 }, { span: 0, a1: 3, a2: 8, w1: 0, w2: 0 }],
      points: [...(model.points ?? []), { span: 0, a: 7, P: 0 }],
    });
    expect(numbersOf(same)).toEqual(numbersOf(s));
  });

  it('never writes a zero as −0', () => {
    const s = solved({ spans: equal(2), left: 'pin', right: 'free', points: [{ span: 0, a: 6, P: -P }] });
    for (const v of numbersOf(s)) expect(Object.is(v, -0)).toBe(false);
  });

  it('where a load sits cannot spoil the answer: a hair from a support, it is still the textbook value', () => {
    // Pab/L, and Pb(L² − b²)^1.5 / 9√3·L for the deflection: with a load a millionth, then a billionth, of the span from the support.
    for (const hair of [1e-6, 1e-9, 1e-12]) {
      const a = L * hair;
      const b = L - a;
      const s = solved({ spans: [{ L, k: 1 }], left: 'pin', right: 'pin', points: [{ span: 0, a, P }] });
      near(s.reactions[0].Rv, (P * b) / L);
      near(s.reactions[1].Rv, (P * a) / L, (P * a) / L, 1e-12);
      near(s.at(L / 2).M, (P * a) / 2, P * a, 1e-12);
      near(s.at(L / 2).EIv, (-P * a * (L / 2) * (L * L - a * a - (L / 2) ** 2)) / (6 * L), P * a * L * L, 1e-12);
      near(s.extremes.EIvMin.value, (-P * a * (L * L - a * a) ** 1.5) / (9 * Math.sqrt(3) * L), P * a * L * L, 1e-12);
    }
    // And a very short, very heavy load is the point load it adds up to, to the square of its length —
    // from a hundred-thousandth of the span down to a length no first-calculator beam keeps (a billionth of the beam's).
    for (const short of [1e-4, 1e-7, 1e-10]) {
      const [a1, a2] = [9 - short / 2, 9 + short / 2];
      // What it adds up to, as the two positions are held: their difference is not `short` to the last figure.
      const W = (P / short) * (a2 - a1);
      const s = solved({ spans: equal(2), left: 'pin', right: 'pin', dists: [{ span: 0, a1, a2, w1: P / short, w2: P / short }] });
      const p = solved({ spans: equal(2), left: 'pin', right: 'pin', points: [{ span: 0, a: (a1 + a2) / 2, P: W }] });
      near(s.totalLoad, W, P, 1e-14);
      near(s.joints[1].M, p.joints[1].M, P * L, 1e-10);
      near(s.at(30).EIv, p.at(30).EIv, P * L ** 3, 1e-10);
      near(s.reactions[0].Rv, p.reactions[0].Rv, P, 1e-10);
      // A triangle that short: its resultant at a third of its length from its high end.
      const t = solved({ spans: equal(2), left: 'pin', right: 'pin', dists: [{ span: 0, a1, a2, w1: (2 * P) / short, w2: 0 }] });
      const q = solved({ spans: equal(2), left: 'pin', right: 'pin', points: [{ span: 0, a: a1 + (a2 - a1) / 3, P: W }] });
      near(t.totalLoad, W, P, 1e-14);
      near(t.joints[1].M, q.joints[1].M, P * L, 1e-10);
      near(t.reactions[0].Rv, q.reactions[0].Rv, P, 1e-10);
    }
  });
});

describe('continuous beam: what cannot be solved, and why', () => {
  const span = { L, k: 1 };
  it('says so when there is no span, and when the supports do not hold the beam', () => {
    expect(refusal({ spans: [], left: 'pin', right: 'pin' })).toEqual([{ code: 'no-spans' }]);
    // One span on one support, or on none; two spans on the one between them.
    expect(issuesOf({ spans: [span], left: 'pin', right: 'free' })).toEqual(['unstable']);
    expect(issuesOf({ spans: [span], left: 'free', right: 'pin' })).toEqual(['unstable']);
    expect(issuesOf({ spans: [span], left: 'free', right: 'free' })).toEqual(['unstable']);
    expect(issuesOf({ spans: [span, span], left: 'free', right: 'free' })).toEqual(['unstable']);
    // With no load on it too, and whatever its spans are like: the supports decide.
    expect(issuesOf({ spans: [{ L: 1, k: 1 }, { L: 5000, k: 1 }], left: 'free', right: 'free', points: [{ span: 0, a: 0.5, P }] })).toEqual(['unstable']);
    // A wall holds a beam alone; three spans always have two supports.
    expect(solveContinuous({ spans: [span], left: 'fixed', right: 'free' }).ok).toBe(true);
    expect(solveContinuous({ spans: [span, span, span], left: 'free', right: 'free' }).ok).toBe(true);
    expect(solveContinuous({ spans: [span, span], left: 'pin', right: 'free' }).ok).toBe(true);
  });

  it('names the span whose length is not one', () => {
    for (const bad of [0, -5, Number.NaN, Infinity, 1e61, 1e-61]) {
      expect(refusal({ spans: [span, { L: bad, k: 1 }, span], left: 'pin', right: 'pin' })).toEqual([{ code: 'length', where: { list: 'spans', index: 1 } }]);
    }
    expect(refusal({ spans: [{ L: 0, k: 1 }, { L: -1, k: 1 }], left: 'pin', right: 'pin' })).toEqual([
      { code: 'length', where: { list: 'spans', index: 0 } },
      { code: 'length', where: { list: 'spans', index: 1 } },
    ]);
    // The largest and the smallest lengths that are taken.
    expect(solveContinuous({ spans: [{ L: 1e60, k: 1 }], left: 'pin', right: 'pin' }).ok).toBe(true);
    expect(solveContinuous({ spans: [{ L: 1e-60, k: 1 }], left: 'pin', right: 'pin' }).ok).toBe(true);
  });

  it('names the span whose stiffness factor is not a positive number, or is past a thousand either way', () => {
    expect(STIFF).toBe(1000);
    for (const bad of [0, -1, Number.NaN, Infinity, 1001, 0.000999]) {
      expect(refusal({ spans: [span, span, { L, k: bad }], left: 'pin', right: 'pin' })).toEqual([{ code: 'stiffness', where: { list: 'spans', index: 2 } }]);
    }
    // A length and a factor at fault in one span are both said.
    expect(refusal({ spans: [{ L: 0, k: 0 }], left: 'pin', right: 'pin' }).map((i) => i.code)).toEqual(['length', 'stiffness']);
  });

  it('at a thousand and at a thousandth the beam is solved, and right — against the three-moment equation', () => {
    const len = [20, 26, 18, 24];
    const q = [1.2, 0.7, 1.9, 0.4];
    for (const k of [[1000, 0.001, 1000, 0.001], [0.001, 0.001, 1000, 1000], [1000, 1, 0.001, 1], [0.001, 1000, 1, 1000]]) {
      const s = solved({ spans: len.map((length, i) => ({ L: length, k: k[i] })), left: 'pin', right: 'pin', dists: uniform(len, q), settlements: [0, 0, 40, 0, 0] });
      const M = threeMoments(len, k, q, [0, 0, 40, 0, 0]);
      const top = Math.max(...M.map(Math.abs));
      // Each moment over ITSELF: a small one beside a large one is as good as the large one.
      s.joints.forEach((j, i) => near(j.M, M[i], i === 0 || i === 4 ? top : Math.abs(M[i]), 1e-10));
      reactionsOf(len, q, M).forEach((R, i) => near(s.reactions[i].Rv, R, Math.abs(R), 1e-9));
      expect(s.residual.slope).toBeLessThanOrEqual(1e-12 * Math.max(Math.abs(s.extremes.EIthetaMax.value), Math.abs(s.extremes.EIthetaMin.value)));
    }
  });

  it('names every span shorter than a thousandth of the beam', () => {
    expect(SHORT).toBe(0.001);
    expect(refusal({ spans: [{ L: 30, k: 1 }, { L: 0.02, k: 1 }, { L: 30, k: 1 }], left: 'pin', right: 'pin' })).toEqual([{ code: 'short-span', where: { list: 'spans', index: 1 } }]);
    expect(refusal({ spans: [{ L: 0.01, k: 1 }, { L: 30, k: 1 }, { L: 0.029, k: 1 }], left: 'fixed', right: 'free' })).toEqual([
      { code: 'short-span', where: { list: 'spans', index: 0 } },
      { code: 'short-span', where: { list: 'spans', index: 2 } },
    ]);
    // It is the beam's length that is measured against, in whatever unit.
    expect(issuesOf({ spans: [{ L: 30e9, k: 1 }, { L: 0.02e9, k: 1 }], left: 'pin', right: 'pin' })).toEqual(['short-span']);
    // A beam whose supports do not hold it is that first: lengthening a span would not make it stand.
    expect(issuesOf({ spans: [{ L: 30, k: 1 }, { L: 0.001, k: 1 }], left: 'free', right: 'free' })).toEqual(['unstable']);
  });

  it('a span of a thousandth of the beam is solved, and right — and one a hair shorter is not taken', () => {
    // 1 and 999: exactly a thousandth. Two spans under their own loads: −(w₁L₁³ + w₂L₂³)/8(L₁ + L₂) over the support.
    const [l1, l2, w1, w2] = [1, 999, 40, 0.01];
    const s = solved({ spans: [{ L: l1, k: 1 }, { L: l2, k: 1 }], left: 'pin', right: 'pin', dists: uniform([l1, l2], [w1, w2]) });
    const MB = -(w1 * l1 ** 3 + w2 * l2 ** 3) / (8 * (l1 + l2));
    near(s.joints[1].M, MB, Math.abs(MB), 1e-12);
    near(s.reactions[0].Rv, (w1 * l1) / 2 + MB / l1, Math.abs(MB / l1), 1e-12);
    near(s.reactions[2].Rv, (w2 * l2) / 2 + MB / l2, w2 * l2, 1e-12);
    near(s.reactions[1].Rv, w1 * l1 + w2 * l2 - s.reactions[0].Rv - s.reactions[2].Rv, Math.abs(MB / l1), 1e-12);
    expect(issuesOf({ spans: [{ L: 0.999, k: 1 }, { L: 999, k: 1 }], left: 'pin', right: 'pin' })).toEqual(['short-span']);
    // Inside a longer beam, with walls, stiffness and a settlement: the three-moment equation again.
    const len = [0.1, 40, 0.1, 59.8];
    const k = [1, 2, 0.5, 1];
    const q = [3, 0.5, 8, 0.2];
    const settle = [0, 2, 2, 0, 0];
    const t = solved({ spans: len.map((length, i) => ({ L: length, k: k[i] })), left: 'pin', right: 'pin', dists: uniform(len, q), settlements: settle });
    const M = threeMoments(len, k, q, settle);
    t.joints.forEach((j, i) => near(j.M, M[i], Math.max(...M.map(Math.abs)), 1e-11));
    reactionsOf(len, q, M).forEach((R, i) => near(t.reactions[i].Rv, R, Math.max(...reactionsOf(len, q, M).map(Math.abs)), 1e-11));
    // A short overhang is a span like any other, to the limit.
    expect(solveContinuous({ spans: [{ L: 99.9, k: 1 }, { L: 0.1, k: 1 }], left: 'fixed', right: 'free' }).ok).toBe(true);
    expect(issuesOf({ spans: [{ L: 99.92, k: 1 }, { L: 0.08, k: 1 }], left: 'fixed', right: 'free' })).toEqual(['short-span']);
  });

  it('names every value that is not a number, and every load larger than the engine takes', () => {
    const base = { spans: [span, span], left: 'pin' as const, right: 'pin' as const };
    for (const bad of [Number.NaN, Infinity, -Infinity, 1.1e60, -2e60]) {
      expect(refusal({ ...base, points: [{ span: 0, a: 3, P: 1 }, { span: 1, a: 3, P: bad }] })).toEqual([{ code: 'number', where: { list: 'points', index: 1 } }]);
      expect(refusal({ ...base, dists: [{ span: 0, a1: 0, a2: 5, w1: bad, w2: 1 }] })).toEqual([{ code: 'number', where: { list: 'dists', index: 0 } }]);
      expect(refusal({ ...base, dists: [{ span: 0, a1: 0, a2: 5, w1: 1, w2: bad }] })).toEqual([{ code: 'number', where: { list: 'dists', index: 0 } }]);
      expect(refusal({ ...base, settlements: [0, bad, 0] })).toEqual([{ code: 'number', where: { list: 'settlements', index: 1 } }]);
    }
    for (const bad of [Number.NaN, Infinity]) {
      expect(refusal({ ...base, points: [{ span: 0, a: bad, P: 1 }] })).toEqual([{ code: 'number', where: { list: 'points', index: 0 } }]);
      expect(refusal({ ...base, dists: [{ span: 1, a1: bad, a2: 5, w1: 1, w2: 1 }] })).toEqual([{ code: 'number', where: { list: 'dists', index: 0 } }]);
      expect(refusal({ ...base, dists: [{ span: 1, a1: 0, a2: bad, w1: 1, w2: 1 }] })).toEqual([{ code: 'number', where: { list: 'dists', index: 0 } }]);
    }
    // Everything at fault is said at once, each by its own row.
    expect(refusal({ ...base, points: [{ span: 0, a: 3, P: Number.NaN }], dists: [{ span: 0, a1: 1, a2: 2, w1: 1, w2: 1 }, { span: 0, a1: 1, a2: 2, w1: 1e61, w2: 1 }], settlements: [Number.NaN] })).toEqual([
      { code: 'number', where: { list: 'settlements', index: 0 } },
      { code: 'number', where: { list: 'points', index: 0 } },
      { code: 'number', where: { list: 'dists', index: 1 } },
    ]);
  });

  it('names every load that is off its span, or on a span that is not there', () => {
    const base = { spans: [span, { L: 10, k: 1 }], left: 'pin' as const, right: 'pin' as const };
    expect(refusal({ ...base, points: [{ span: 1, a: 10.5, P }] })).toEqual([{ code: 'outside', where: { list: 'points', index: 0 } }]);
    expect(refusal({ ...base, points: [{ span: 0, a: -0.1, P }] })).toEqual([{ code: 'outside', where: { list: 'points', index: 0 } }]);
    expect(refusal({ ...base, dists: [{ span: 1, a1: 2, a2: 12, w1: 1, w2: 1 }] })).toEqual([{ code: 'outside', where: { list: 'dists', index: 0 } }]);
    expect(refusal({ ...base, dists: [{ span: 1, a1: -2, a2: 8, w1: 1, w2: 1 }] })).toEqual([{ code: 'outside', where: { list: 'dists', index: 0 } }]);
    for (const nowhere of [2, -1, 0.5, Number.NaN]) {
      expect(refusal({ ...base, points: [{ span: nowhere, a: 1, P }] })).toEqual([{ code: 'outside', where: { list: 'points', index: 0 } }]);
      expect(refusal({ ...base, dists: [{ span: nowhere, a1: 0, a2: 1, w1: 1, w2: 1 }] })).toEqual([{ code: 'outside', where: { list: 'dists', index: 0 } }]);
    }
    // On the second span 10 is its end, and a rounding past it is still its end.
    expect(solveContinuous({ ...base, points: [{ span: 1, a: 10, P }] }).ok).toBe(true);
    expect(solveContinuous({ ...base, points: [{ span: 1, a: 10 * (1 + 1e-12), P }] }).ok).toBe(true);
    expect(solveContinuous({ ...base, dists: [{ span: 1, a1: -1e-12, a2: 10, w1: 1, w2: 1 }] }).ok).toBe(true);
    // A size that is not one is said first: there is no asking where such a load is.
    expect(refusal({ ...base, points: [{ span: 7, a: 1, P: Number.NaN }] })).toEqual([{ code: 'number', where: { list: 'points', index: 0 } }]);
  });

  it('up to its limits a load, a settlement and a length of any size are solved, and every number of the solution is a number', () => {
    for (const size of [1e-60, 1e-20, 1, 1e20, 1e60]) {
      const s = solved({ spans: [span, { L: 30, k: 0.5 }], left: 'fixed', right: 'pin', points: [{ span: 0, a: 9, P: size }], dists: [{ span: 1, a1: 0, a2: 30, w1: size, w2: -size }], settlements: [0, size, 0] });
      expect(numbersOf(s).every(Number.isFinite)).toBe(true);
      near(s.totalLoad, size, size, 1e-12);
    }
    for (const length of [1e-60, 1e-20, 1e20, 1e50]) {
      const s = solved({ spans: [{ L: length, k: 1 }, { L: 2 * length, k: 3 }], left: 'pin', right: 'fixed', points: [{ span: 0, a: length / 2, P }], dists: [{ span: 1, a1: 0, a2: 2 * length, w1: 1 / length, w2: 1 / length }] });
      expect(numbersOf(s).every(Number.isFinite)).toBe(true);
      // The same beam at any size: the reactions are those of a beam of length 1 and 2.
      const unit = solved({ spans: [{ L: 1, k: 1 }, { L: 2, k: 3 }], left: 'pin', right: 'fixed', points: [{ span: 0, a: 0.5, P }], dists: [{ span: 1, a1: 0, a2: 2, w1: 1, w2: 1 }] });
      s.reactions.forEach((r, i) => near(r.Rv, unit.reactions[i].Rv, P, 1e-12));
    }
  });

  it('never returns a number that is not one: at all its limits at once it solves or it says the length is too much', () => {
    for (const k of [1, 0.001, 1000]) {
      for (const size of [1e60, -1e60]) {
        const out = solveContinuous({
          spans: Array.from({ length: 8 }, () => ({ L: 1e60, k })),
          left: 'fixed',
          right: 'free',
          points: Array.from({ length: 12 }, (_, i) => ({ span: 7, a: 1e60, P: size * (i % 2 ? 1 : 0.5) })),
          dists: Array.from({ length: 12 }, (_, i) => ({ span: i % 8, a1: 0, a2: 1e60, w1: size, w2: size })),
          settlements: Array.from({ length: 9 }, () => size),
        });
        if (out.ok) expect(numbersOf(out).every(Number.isFinite)).toBe(true);
        else expect(out.issues).toEqual([{ code: 'length' }]);
      }
    }
    // The largest numbers there are, in the engine's other fields: refused before anything is worked out.
    expect(issuesOf({ spans: [span], left: 'pin', right: 'pin', points: [{ span: 0, a: 5, P: 1e308 }, { span: 0, a: 6, P: -1e308 }] })).toEqual(['number', 'number']);
    expect(issuesOf({ spans: [span], left: 'pin', right: 'pin', dists: [{ span: 0, a1: 0, a2: L, w1: 1e308, w2: 1e308 }] })).toEqual(['number']);
  });
});

describe('continuous beam: the polynomials the largest values are found on', () => {
  it('finds every place where a polynomial changes sign, and no other', () => {
    // (u − 0.2)(u − 0.5)(u − 0.9), lowest power first.
    const cubic = [-0.09, 0.73, -1.6, 1];
    polyRoots(cubic).forEach((u, i) => near(u, [0.2, 0.5, 0.9][i], 1, 1e-13));
    expect(polyRoots(cubic)).toHaveLength(3);
    // Between two of them only.
    expect(polyRoots(cubic, 0.3, 0.8)).toHaveLength(1);
    // Of the fifth degree, five roots a hundredth apart at one end and far at the other.
    const quintic = [0.05, 0.06, 0.5, 0.93, 0.94].reduce((c, root) => [0, ...c].map((v, i) => v - root * (c[i] ?? 0)), [1]);
    polyRoots(quintic).forEach((u, i) => near(u, [0.05, 0.06, 0.5, 0.93, 0.94][i], 1, 1e-10));
    expect(polyRoots(quintic)).toHaveLength(5);
    // Touching zero is not crossing it; a root outside is not inside; nothing changes sign in nothing.
    expect(polyRoots([0.25, -1, 1])).toEqual([]);
    expect(polyRoots([-2, 1])).toEqual([]);
    expect(polyRoots([3])).toEqual([]);
    expect(polyRoots([0, 0, 0, 0])).toEqual([]);
    expect(polyRoots([-0.5, 1, 0, 0, 0, 0])).toEqual([0.5]);
    expect(polyRoots([Number.NaN, 1, 1])).toEqual([]);
  });

  it('a stretch’s polynomials are the beam there: they give at its far end what the formulas give', () => {
    const m = randomBeam(5013, true);
    const s = solved(m);
    const X = jointsOf(m);
    for (let i = 0; i < s.breaks.length - 1; i++) {
      const [p, q] = [s.breaks[i], s.breaks[i + 1]];
      const k = m.spans[X.findIndex((x) => x > p + 1e-9 * s.L) - 1].k;
      const st = stretchOf(s.at(p, 'right'), s.at(q, 'left').w, q - p, k);
      for (const u of [0.3, 0.8, 1]) {
        const here = s.at(p + u * (q - p), 'left');
        near(polyAt(st.V, u), here.V, s.loadScale, 1e-12);
        near(polyAt(st.M, u), here.M, s.loadScale * s.L, 1e-12);
        near(polyAt(st.T, u), here.EItheta, Math.abs(s.extremes.EIthetaMin.value) + Math.abs(s.extremes.EIthetaMax.value), 1e-12);
        near(polyAt(st.Y, u), here.EIv, Math.abs(s.extremes.EIvMin.value) + Math.abs(s.extremes.EIvMax.value), 1e-12);
      }
    }
  });
});

describe('continuous beam: places a hair apart', () => {
  /** Two spans of 10 under w = 1: 3.75, 12.5 and 3.75, and the shear of the first span ends at −6.25. */
  const two = (points: ContinuousModel['points'] = [], first = 10): ContinuousModel => ({
    spans: [{ L: 10, k: 1 }, { L: 10, k: 1 }],
    left: 'pin',
    right: 'pin',
    points,
    dists: [{ span: 0, a1: 0, a2: first, w1: 1, w2: 1 }, { span: 1, a1: 0, a2: 10, w1: 1, w2: 1 }],
  });

  it('no station is read past the support its stretch ends at: what stands on a support is in no shear', () => {
    // 100 on the middle support, entered at the END of the first span, and something a few hairs before it — a
    // small load, or the end of the distributed one. Between the two the grid cannot tell its points from the
    // support; read there from the right, a station held the 100: −106.25 for a shear of −6.25, and that was
    // returned as the largest shear of the beam.
    const on = { span: 0, a: 10, P: 100 };
    for (const before of [1e-9, 1e-11, 4e-12, 1e-12]) {
      for (const model of [two([on, { span: 0, a: 10 - before, P: 0.001 }]), two([on], 10 - before)]) {
        const s = solved(model);
        near(s.extremes.Vmin.value, -6.25, 1, 2e-3);
        near(s.spans[0].Vmin.value, -6.25, 1, 2e-3);
        near(s.extremes.Vmax.value, 6.25, 1, 2e-3);
        for (const st of s.stations) expect(Math.abs(st.V)).toBeLessThan(6.26);
        near(s.reactions[1].Rv, 112.5, 1, 2e-3);
      }
    }
    // The support of an overhang on the left is at ITS end too: w·c + 0.001 before it, and no more.
    const s = solved({ spans: [{ L: 3, k: 1 }, { L: 10, k: 1 }], left: 'free', right: 'fixed', points: [{ span: 0, a: 3, P: 100 }, { span: 0, a: 3 - 1e-12, P: 0.001 }], dists: uniform([3, 10], 1) });
    near(s.spans[0].Vmin.value, -3.001, 1, 1e-9);
    for (const st of s.stations) expect(st.V).toBeGreaterThan(-5.6);
  });

  it('two places that a position along the beam cannot tell apart are one place', () => {
    // One rounding before the end of its span a load was in neither span's shear and not on the support: lost —
    // and the beam, no longer in equilibrium, was refused as having "a span too short".
    const lengths = [10.6, 13.447301527164482, 10, 7.9];
    const beam = (points: ContinuousModel['points']): ContinuousModel => ({ spans: lengths.map((len) => ({ L: len, k: 1 })), left: 'fixed', right: 'free', points, dists: uniform(lengths, 1) });
    const onSupport = solved(beam([{ span: 0, a: 10.6, P: 22 }]));
    for (const roundings of [1, 2, 5, 9]) expect(numbersOf(solved(beam([{ span: 0, a: 10.6 - roundings * 2 ** -49, P: 22 }])))).toEqual(numbersOf(onSupport));
    // Under a millionth of the loads the loss went unnoticed, and a reaction came back without its load.
    const small = solved({ ...beam([{ span: 0, a: 10.6 - 2 ** -49, P: 2e-5 }, { span: 2, a: 10, P: 1000 }]), dists: [] });
    expect(small.reactions.map((r) => r.Rv)).toEqual([0, 2e-5, 0, 1000]);

    // Two loads with one position along the beam: one place, said once, with both loads at it.
    const spans = [{ L: 100, k: 1 }, { L: 100, k: 1 }];
    const pair = solved({ spans, left: 'pin', right: 'pin', points: [{ span: 1, a: 50, P: 3 }, { span: 1, a: 50.000000000000007, P: 40 }] });
    expect(pair.breaks).toEqual([0, 100, 150, 200]);
    near(pair.at(150, 'left').V - pair.at(150, 'right').V, 43);
    expect(numbersOf(pair)).toEqual(numbersOf(solved({ spans, left: 'pin', right: 'pin', points: [{ span: 1, a: 50, P: 3 }, { span: 1, a: 50, P: 40 }] })));

    // A load a hair from an END OF THE BEAM is at that end: its place, read from the left, is not "before the beam".
    const wall = solved({ spans, left: 'fixed', right: 'pin', points: [{ span: 0, a: 1e-12, P: -300 }], dists: uniform([100, 100], 2) });
    expect(wall.breaks).toEqual([0, 100, 200]);
    expect(wall.at(1e-12).M).toBe(wall.joints[0].M);
    near(wall.reactions[0].Rv, solved({ spans, left: 'fixed', right: 'pin', dists: uniform([100, 100], 2) }).reactions[0].Rv - 300);

    // What is left apart is further apart than a position is read to, on every beam: a billionth of the span is.
    for (const s of [onSupport, pair, wall, solved(two([{ span: 0, a: 10 - 1e-9 * 10, P: 1 }, { span: 1, a: 1e-9 * 10, P: 1 }]))]) {
      s.breaks.forEach((x, i) => {
        if (i > 0) expect(x - s.breaks[i - 1]).toBeGreaterThan(4e-14 * s.L);
      });
    }
    expect(solved(two([{ span: 0, a: 10 - 1e-9 * 10, P: 1 }, { span: 1, a: 1e-9 * 10, P: 1 }])).breaks).toHaveLength(5);
  });

  it('the loads at their places: nothing is moved that need not be, and nothing is lost', () => {
    const model: ContinuousModel = {
      spans: [{ L: 100, k: 1 }, { L: 100, k: 2 }],
      left: 'pin',
      right: 'fixed',
      points: [{ span: 0, a: 30, P }, { span: 1, a: 100 - 1e-9, P: 2 }, { span: 0, a: 77, P: 0 }],
      dists: [{ span: 0, a1: 80, a2: 20, w1: w, w2: 0 }, { span: 1, a1: 0, a2: 100, w1: w, w2: w }, { span: 1, a1: 40, a2: 40, w1: 9, w2: 9 }],
    };
    // A beam with no two places that close is the beam, load for load.
    const placed = placedLoads(model);
    expect(placed.points).toHaveLength(3);
    expect(placed.dists).toHaveLength(3);
    placed.points.forEach((p, i) => expect(p).toBe(model.points?.[i]));
    placed.dists.forEach((d, i) => expect(d).toBe(model.dists?.[i]));

    // Within 4e-14 of the length — of this beam, 8e-12 — a place is the end of its span, or the load entered before it.
    const close = placedLoads({ ...model, dists: [], points: [{ span: 0, a: 30, P }, { span: 0, a: 30 + 5e-12, P: 1 }, { span: 0, a: 30 - 9e-12, P: 1 }, { span: 0, a: 6e-12, P: 1 }, { span: 1, a: 100 - 7e-12, P: 1, live: true }] });
    expect(close.points.map((p) => p.a)).toEqual([30, 30, 30 - 9e-12, 0, 100]);
    expect(close.points[4]).toEqual({ span: 1, a: 100, P: 1, live: true });

    // A distributed load one of whose ends is moved adds up to what it did; one whose two ends are one place is that, there.
    const loads = { points: [{ span: 0, a: 30, P }], dists: [{ span: 0, a1: 30 + 5e-12, a2: 30.000001, w1: 6e5, w2: 2e5 }, { span: 1, a1: 50, a2: 50 + 4e-12, w1: 1e12, w2: 3e12, live: true }] };
    const moved = placedLoads({ ...model, ...loads });
    expect(moved.dists).toHaveLength(1);
    expect([moved.dists[0].a1, moved.dists[0].a2]).toEqual([30, 30.000001]);
    const resultant = (d: { a1: number; a2: number; w1: number; w2: number }) => ((d.w1 + d.w2) / 2) * (d.a2 - d.a1);
    near(resultant(moved.dists[0]), resultant(loads.dists[0]), 1, 1e-12);
    expect(moved.points).toEqual([loads.points[0], { span: 1, a: 50, P: resultant(loads.dists[1]), live: true }]);
    near(solved({ ...model, ...loads }).totalLoad, P + resultant(loads.dists[0]) + resultant(loads.dists[1]), 1, 1e-12);

    // Placed twice is placed once: the loads of a part of the model are where they are in the whole.
    for (const once of [close, moved]) {
      const twice = placedLoads({ ...model, ...once });
      twice.points.forEach((p, i) => expect(p).toBe(once.points[i]));
      twice.dists.forEach((d, i) => expect(d).toBe(once.dists[i]));
    }
  });
});

describe('continuous beam: a beam no table lists, against an exact solver by another method', () => {
  // Four spans built in on the left with an overhang on the right, each with its own stiffness, on supports that
  // settle, under loads of every kind: one that stands on a support, one on the tip, an upward one, a partial load
  // that changes sign and one entered right to left. The numbers are the FORCE METHOD's, worked in exact fractions
  // — Clapeyron's equations written from compatibility, the moments at the joints for unknowns, and every
  // condition that makes a beam the beam checked exactly — and rounded once. Nothing of engine.ts is in them, and
  // nothing of this file.
  const model: ContinuousModel = {
    spans: [{ L: 18, k: 1 }, { L: 24, k: 2.5 }, { L: 15, k: 0.4 }, { L: 6, k: 1.6 }],
    left: 'fixed',
    right: 'free',
    settlements: [0, 30, -12, 45, 0],
    points: [{ span: 0, a: 7, P: 12 }, { span: 2, a: 15, P: 9 }, { span: 3, a: 6, P: 4, live: true }, { span: 1, a: 10, P: -5, live: true }],
    dists: [
      { span: 0, a1: 0, a2: 18, w1: 1.2, w2: 1.2 },
      { span: 1, a1: 4, a2: 20, w1: 0.5, w2: 3, live: true },
      { span: 2, a1: 12, a2: 3, w1: 2, w2: -1 },
      { span: 3, a1: 0, a2: 6, w1: 0.8, w2: 0.8 },
    ],
  };
  const s = solved(model);
  const tight = (got: number, want: number, scale: number) => near(got, want, scale, 1e-13);

  it('the reactions, the wall, and each joint: its moment, its slope, where it is', () => {
    const [F, M, T, Y] = [25, 70, 400, 2400];
    [17.97500707722944, 26.87611047185645, 10.401738916354452, 23.64714353455966].forEach((R, i) => tight(s.reactions[i].Rv, R, F));
    tight(s.reactions[0].Rm, 59.20312888312973, M);
    expect(s.totalLoad).toBeCloseTo(78.9, 12);
    [-59.20312888312973, -62.053001492999805, -4.692846981605116, -38.4, 0].forEach((m, j) => tight(s.joints[j].M, m, M));
    [0, -46.105173385165784, 180.44808727006395, -349.10529363503196, -412.10529363503196].forEach((t, j) => tight(s.joints[j].EItheta, t, T));
    // Each support where its settlement puts it; the tip, 2,400.63 down.
    expect(s.joints.slice(0, 4).map((j) => j.EIv)).toEqual([-0, -30, 12, -45].map((v) => v + 0));
    tight(s.joints[4].EIv, -2400.6317618101916, Y);
  });

  it('each span: its largest moment and where, its shears, its deflection from its own supports', () => {
    const [F, M, Y] = [25, 70, 2400];
    [37.22192065747635, 67.17691408769474, -4.692846981605116, 0].forEach((m, i) => tight(s.spans[i].Mmax.value, m, M));
    near(s.spans[1].Mmax.x, 18 + 15.573432391570329, 1, 1e-7);
    expect([s.spans[0].Mmax.x, s.spans[2].Mmax.x, s.spans[3].Mmax.x]).toEqual([7, 42, 63]);
    [-62.053001492999805, -62.053001492999805, -38.4, -38.4].forEach((m, i) => tight(s.spans[i].Mmin.value, m, M));
    [17.97500707722944, 11.25111754908589, 0.152856465440341, 8.8].forEach((v, i) => tight(s.spans[i].Vmax.value, v, F));
    [-15.62499292277056, -11.74888245091411, -5.847143534559659, 4].forEach((v, i) => tight(s.spans[i].Vmin.value, v, F));
    [-554.4906629103818, -1158.4333042310689, 857.9436131027686, -2355.6317618101916].forEach((c, i) => tight(s.spans[i].EIvChord.value, c, Y));
    tight(s.extremes.EIvMax.value, 837.864991647814, Y);
    tight(s.extremes.EIvMin.value, -2400.6317618101916, Y);
    tight(s.extremes.Mmax.value, 67.17691408769474, M);
    tight(s.extremes.Vmin.value, -15.62499292277056, F);
  });
});
