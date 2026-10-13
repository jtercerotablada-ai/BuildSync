import { afterEach, describe, expect, it } from 'vitest';
import { solveBeam, type BeamModel, type Side } from '../beam/solver';
import { CLOSE, SHORT, STIFF, solveShaft } from './engine';
import type { PlaneState, ShaftIssue, ShaftModel, ShaftSegment, ShaftSolution, ShaftState } from './types';

// As in continuous/engine.test.ts: arithmetic that never waits. A turn of the event loop between two tests lets the
// runner hear from this worker, which it otherwise reports as a timeout of its own over a passing run.
afterEach(() => new Promise<void>((resolve) => setTimeout(resolve, 0)));

/**
 * THE SHAFT ENGINE, against what is known.
 *
 * Five kinds of evidence, each independent of the others:
 *
 *   — closed forms: a shaft of one section is a beam of the tables (AISC
 *     Manual, Table 3-23), and a STEPPED one is worked out here, case by
 *     case, by the unit-load method (virtual work) — the integral of
 *     M × m ÷ EI, m the moment of a unit load where the answer is wanted —
 *     with the integrals written out;
 *   — the same method as a function (`unitLoad`), with this file's own
 *     statics: on random shafts, at random points. It has no constant of
 *     integration and carries nothing from piece to piece: nothing of how
 *     engine.ts integrates is in it;
 *   — the FIRST calculator's engine (beam/solver.ts), which integrates a
 *     beam of one stiffness by another method again, on every shaft both
 *     can solve;
 *   — the beam equation itself, on random shafts: every bearing where it
 *     is, the slope one value across every place, the curvature the moment
 *     over that segment's EI, the shaft in equilibrium — and what a change
 *     of units, a mirror, a turn about its axis and two sets of loads
 *     added together must leave as it was;
 *   — what is refused, at the limits, and that what is taken there is right.
 *
 * The engine is exact — closed forms — so the tolerances are rounding, not
 * "within half a percent". How it was measured against a reference in exact
 * fractions is in the header of engine.ts; three shafts of that reference
 * are pinned at the end of this file.
 */

const solved = (model: ShaftModel): ShaftSolution => {
  const out = solveShaft(model);
  if (!out.ok) throw new Error(`not solved: ${JSON.stringify(out.issues)}`);
  return out;
};
const issuesOf = (model: ShaftModel): ShaftIssue[] => {
  const out = solveShaft(model);
  return out.ok ? [] : out.issues;
};
const codesOf = (model: ShaftModel) => issuesOf(model).map((i) => i.code);
/** Equal to rounding: relative to the size of the numbers in play. */
const near = (got: number, want: number, scale = Math.max(1, Math.abs(want)), tol = 1e-9) => {
  expect(Math.abs(got - want), `got ${got}, want ${want}`).toBeLessThanOrEqual(tol * Math.abs(scale));
};

type Plane = 'v' | 'h';
const PLANES: Plane[] = ['v', 'h'];
const planeOf = (st: ShaftState, plane: Plane): PlaneState => (plane === 'v' ? st.vertical : st.horizontal);
const SIDES: Side[] = ['left', 'right'];
/** Where each segment starts; the last is the shaft's length. */
const stepsOf = (m: ShaftModel) => m.segments.reduce((xs, s) => [...xs, xs[xs.length - 1] + s.L], [0]);
/** ∫ f over [a, b], exact for a polynomial of the fifth degree: three Gauss points. */
const gauss = (f: (x: number) => number, a: number, b: number) => {
  const half = (b - a) / 2;
  const mid = (a + b) / 2;
  const t = Math.sqrt(3 / 5);
  return half * ((5 / 9) * f(mid - half * t) + (8 / 9) * f(mid) + (5 / 9) * f(mid + half * t));
};

/**
 * One plane of a shaft by the two equations of equilibrium, written here:
 * its reactions, and the shear and the moment at t from WHAT IS TO THE LEFT
 * of the section (t at no load: a point where neither jumps).
 */
function statics(m: ShaftModel, plane: Plane) {
  const X = stepsOf(m);
  const a = Math.min(...m.bearings);
  const b = Math.max(...m.bearings);
  const forces = (m.forces ?? []).map((f) => ({ x: f.x, P: f[plane] }));
  const couples = (m.couples ?? []).map((c) => ({ x: c.x, C: c[plane] }));
  const weights = m.segments.map((s, i) => ({ from: X[i], to: X[i + 1], w: plane === 'v' ? (s.w ?? 0) : 0 }));
  const W = forces.reduce((sum, f) => sum + f.P, 0) + weights.reduce((sum, g) => sum + g.w * (g.to - g.from), 0);
  // Moments about the left bearing: the right one carries them. (A couple counter-clockwise unloads it.)
  const Rb = (forces.reduce((sum, f) => sum + f.P * (f.x - a), 0) + weights.reduce((sum, g) => sum + g.w * (g.to - g.from) * ((g.from + g.to) / 2 - a), 0) - couples.reduce((sum, c) => sum + c.C, 0)) / (b - a);
  const Ra = W - Rb;
  const V = (t: number) => (t > a ? Ra : 0) + (t > b ? Rb : 0) - forces.reduce((sum, f) => sum + (f.x < t ? f.P : 0), 0) - weights.reduce((sum, g) => sum + (g.from < t ? g.w * (Math.min(g.to, t) - g.from) : 0), 0);
  const M = (t: number) =>
    (t > a ? Ra * (t - a) : 0) +
    (t > b ? Rb * (t - b) : 0) -
    forces.reduce((sum, f) => sum + (f.x < t ? f.P * (t - f.x) : 0), 0) -
    couples.reduce((sum, c) => sum + (c.x < t ? c.C : 0), 0) -
    weights.reduce((sum, g) => {
      if (!(g.from < t)) return sum;
      const to = Math.min(g.to, t);
      return sum + g.w * (to - g.from) * (t - (g.from + to) / 2);
    }, 0);
  return { a, b, Ra, Rb, W, V, M };
}

/**
 * THE UNIT-LOAD METHOD, as a function: the deflection ('v') or the slope
 * ('theta') of one plane at x is ∫ M × m ÷ EI over the whole shaft, m the
 * moment of a unit force (down) or a unit couple (counter-clockwise) at x on
 * the same two bearings. M × m is of the third degree between two places:
 * three Gauss points integrate it exactly.
 */
function unitLoad(model: ShaftModel, plane: Plane, x: number, what: 'v' | 'theta'): number {
  const X = stepsOf(model);
  const L = X[X.length - 1];
  const { a, b, M } = statics(model, plane);
  const span = b - a;
  const m = (t: number) =>
    what === 'v'
      ? // Reactions (b − x)/span at the left bearing and (x − a)/span at the right one.
        (t > a ? ((b - x) / span) * (t - a) : 0) + (t > b ? ((x - a) / span) * (t - b) : 0) - (t > x ? t - x : 0)
      : // Reactions +1/span and −1/span; past the couple the moment drops by it.
        (t > a ? (t - a) / span : 0) - (t > b ? (t - b) / span : 0) - (t > x ? 1 : 0);
  const cuts = [...new Set([0, L, a, b, x, ...X, ...(model.forces ?? []).map((f) => f.x), ...(model.couples ?? []).map((c) => c.x)])].filter((t) => t >= 0 && t <= L).sort((p, q) => p - q);
  let work = 0;
  for (let i = 0; i < cuts.length - 1; i++) {
    const mid = (cuts[i] + cuts[i + 1]) / 2;
    let g = 0;
    while (g < model.segments.length - 1 && X[g + 1] <= mid) g += 1;
    work += gauss((t) => M(t) * m(t), cuts[i], cuts[i + 1]) / model.segments[g].EI;
  }
  // The work of the unit load is the bending it meets. A unit force acts DOWN and a deflection is positive against it: minus.
  return what === 'v' ? -work : work;
}

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
const fixed = (v: number, digits: number) => Number(v.toFixed(digits));
/** A round steel section, solid or bored, in inches and pounds: what model.ts will make of a diameter. */
const E = 29e6;
const round = (d: number, bore = 0, weight = false): Omit<ShaftSegment, 'L'> => {
  const I = (Math.PI * (d ** 4 - bore ** 4)) / 64;
  return { EI: E * I, Z: I / (d / 2), ...(weight ? { w: (0.2836 * Math.PI * (d * d - bore * bore)) / 4 } : {}) };
};

/**
 * A shaft as a visitor could have it: one to six round steel segments, some
 * bored, some with their own weight; two bearings anywhere — at an end, at a
 * step, inside — a twentieth of the shaft apart or more; a few forces and
 * couples in both planes, anywhere: on a bearing, on a step, on an end.
 * `one`: every segment the same section (a beam).
 */
function randomShaft(seed: number, opt: { one?: boolean; weight?: boolean; loads?: number } = {}): ShaftModel {
  const r = mulberry32(seed);
  const pick = <T>(list: T[]): T => list[Math.floor(r() * list.length)];
  const n = 1 + Math.floor(r() * 6);
  const weight = opt.weight ?? r() < 0.5;
  const same = round(fixed(1 + r() * 2, 2), 0, weight);
  const segments: ShaftSegment[] = Array.from({ length: n }, () => {
    const d = fixed(0.75 + r() * 3.25, 2);
    const bore = r() < 0.2 ? fixed(d * (0.3 + 0.4 * r()), 2) : 0;
    const L = fixed(1 + r() * 11, 2);
    return { L, ...(opt.one ? same : round(d, bore, weight && r() < 0.8)) };
  });
  const X = segments.reduce((xs, s) => [...xs, xs[xs.length - 1] + s.L], [0]);
  const L = X[n];
  const somewhere = (others: number[] = []) => {
    const u = r();
    if (u < 0.6) return fixed(r() * L, 3);
    if (u < 0.8) return pick(X);
    return others.length ? pick(others) : fixed(r() * L, 3);
  };
  let bearings: [number, number];
  do bearings = [somewhere(), somewhere()];
  while (Math.abs(bearings[0] - bearings[1]) < 0.05 * L);
  const taken: number[] = [...bearings];
  const load = (size: number) => {
    const u = r();
    return { v: u < 0.2 ? 0 : fixed((r() * 2 - 1) * size, 1), h: u > 0.8 ? 0 : fixed((r() * 2 - 1) * size, 1) };
  };
  const forces = Array.from({ length: opt.loads ?? 1 + Math.floor(r() * 5) }, () => {
    const x = somewhere(taken);
    taken.push(x);
    return { x, ...load(900) };
  });
  const couples = Array.from({ length: Math.floor(r() * 3) }, () => {
    const x = somewhere(taken);
    taken.push(x);
    return { x, ...load(2500) };
  });
  return { segments, bearings, forces, couples };
}

/** The largest of each response of a solved shaft, by planes, over its stations: what a difference is measured against. */
const topOf = (s: ShaftSolution) => {
  const top = { V: 0, M: 0, theta: 0, v: 0 };
  for (const st of s.stations) {
    top.V = Math.max(top.V, st.V);
    top.M = Math.max(top.M, st.M);
    top.theta = Math.max(top.theta, st.theta);
    top.v = Math.max(top.v, st.v);
  }
  return top;
};
/**
 * What a difference in each response of a solved shaft is measured against: the largest value there is, by
 * planes — or, for a shaft that hardly bends, a thousandth of the size of its problem (in a slope and a
 * deflection, as its softest segment would have them). Its rounding is that of its loads, not of a diagram that
 * is all but nothing.
 */
const sizeOf = (s: ShaftSolution, m: ShaftModel) => {
  const top = topOf(s);
  const soft = Math.max(...m.segments.map((g) => g.EI)) / Math.min(...m.segments.map((g) => g.EI));
  return { V: Math.max(top.V, 1e-3 * s.loadScale), M: Math.max(top.M, 1e-3 * s.loadScale * s.L), theta: Math.max(top.theta, 1e-3 * soft * s.slopeScale), v: Math.max(top.v, 1e-3 * soft * s.deflectionScale) };
};
/** The middle of every piece of a solved shaft, and two more points in it. */
const insideOf = (s: ShaftSolution): number[] => s.breaks.slice(0, -1).flatMap((x, i) => [0.5, 0.21, 0.83].map((u) => x + (s.breaks[i + 1] - x) * u));

const L = 40;
const EI = 2.4e7;
const Z = 1.6;
const P = 800;

describe('shaft: one section is a beam of the tables', () => {
  it('a central force: P/2 on each bearing, PL/4, PL³/48EI, PL²/16EI at the bearings', () => {
    const s = solved({ segments: [{ L, EI, Z }], bearings: [0, L], forces: [{ x: L / 2, v: P, h: 0 }] });
    near(s.bearings[0].vertical, P / 2);
    near(s.bearings[1].vertical, P / 2);
    expect(s.bearings.map((b) => b.radial)).toEqual([s.bearings[0].vertical, s.bearings[1].vertical]);
    near(s.extremes.M.value, (P * L) / 4);
    expect(s.extremes.M.x).toBe(L / 2);
    near(s.extremes.sigma?.value ?? 0, (P * L) / 4 / Z);
    near(s.at(L / 2).vertical.v, (-P * L ** 3) / (48 * EI));
    near(s.extremes.v.value, (P * L ** 3) / (48 * EI));
    near(s.extremes.v.x, L / 2, L);
    near(s.extremes.vertical.vMin.value, (-P * L ** 3) / (48 * EI));
    near(s.bearings[0].thetaVertical, (-P * L * L) / (16 * EI));
    near(s.bearings[1].thetaVertical, (P * L * L) / (16 * EI));
    near(s.bearings[0].theta, (P * L * L) / (16 * EI));
    near(s.extremes.theta.value, (P * L * L) / (16 * EI));
    near(s.extremes.V.value, P / 2);
    // Nothing in the other plane, to the last figure.
    for (const st of s.stations) expect(st.horizontal).toEqual({ V: 0, M: 0, theta: 0, v: 0 });
    expect(s.bearings.map((b) => [b.horizontal, b.thetaHorizontal])).toEqual([[0, 0], [0, 0]]);
  });

  it('a force anywhere: Pb/L and Pa/L; Pa²b²/3EIL under it; the largest deflection at √((L² − b²)/3), and its size', () => {
    const a = 26;
    const b = L - a;
    const s = solved({ segments: [{ L, EI }], bearings: [0, L], forces: [{ x: a, v: 0, h: P }] });
    near(s.bearings[0].horizontal, (P * b) / L);
    near(s.bearings[1].horizontal, (P * a) / L);
    near(s.at(a).horizontal.v, (-P * a * a * b * b) / (3 * EI * L));
    near(s.at(a).horizontal.M, (P * a * b) / L);
    const x = Math.sqrt((L * L - b * b) / 3);
    const deepest = (P * b * (L * L - b * b) ** 1.5) / (9 * Math.sqrt(3) * EI * L);
    near(s.extremes.v.value, deepest);
    near(s.extremes.v.x, x, L, 1e-8);
    near(s.extremes.horizontal.vMin.value, -deepest);
    near(s.extremes.horizontal.vMin.x, x, L, 1e-8);
    near(s.bearings[0].thetaHorizontal, (-P * a * b * (L + b)) / (6 * EI * L));
    near(s.bearings[1].thetaHorizontal, (P * a * b * (L + a)) / (6 * EI * L));
    // The slope under the force: Pab(b − a)/3EIL.
    near(s.at(a).horizontal.theta, (P * a * b * (a - b)) / (3 * EI * L), (P * L * L) / EI);
  });

  it('an overhung force: −Pc/ℓ and P(ℓ + c)/ℓ; Pc²(ℓ + c)/3EI at the tip; Pcℓ²/9√3EI up between the bearings, at ℓ/√3', () => {
    const l = 30;
    const c = 10;
    const s = solved({ segments: [{ L: l + c, EI, Z }], bearings: [0, l], forces: [{ x: l + c, v: P, h: 0 }] });
    near(s.bearings[0].vertical, (-P * c) / l);
    near(s.bearings[1].vertical, (P * (l + c)) / l);
    near(s.at(l).vertical.M, -P * c);
    near(s.extremes.vertical.Mmin.value, -P * c);
    expect(s.extremes.vertical.Mmin.x).toBe(l);
    near(s.at(l + c).vertical.v, (-P * c * c * (l + c)) / (3 * EI));
    near(s.extremes.v.value, (P * c * c * (l + c)) / (3 * EI));
    expect(s.extremes.v.x).toBe(l + c);
    near(s.extremes.vertical.vMax.value, (P * c * l * l) / (9 * Math.sqrt(3) * EI));
    near(s.extremes.vertical.vMax.x, l / Math.sqrt(3), l, 1e-8);
    near(s.bearings[0].thetaVertical, (P * c * l) / (6 * EI));
    near(s.bearings[1].thetaVertical, (-P * c * l) / (3 * EI));
    near(s.at(l + c).vertical.theta, (-P * c * l) / (3 * EI) - (P * c * c) / (2 * EI));
    // The tip is free: no moment there, and the whole force as shear just before it.
    expect(s.at(l + c, 'left').vertical.M).toBe(0);
    near(s.at(l + c, 'left').vertical.V, P);
  });

  it('its own weight: wL/2, wL²/8, 5wL⁴/384EI, wL³/24EI — in the vertical plane, and whatever the segments it is entered in', () => {
    const w = 0.6;
    const whole = solved({ segments: [{ L, EI, w }], bearings: [0, L] });
    const cut = solved({ segments: [{ L: 7, EI, w }, { L: 21, EI, w }, { L: 12, EI, w }], bearings: [L, 0] });
    for (const s of [whole, cut]) {
      near(s.bearings[0].vertical, (w * L) / 2);
      near(s.bearings[1].vertical, (w * L) / 2);
      near(s.extremes.M.value, (w * L * L) / 8);
      near(s.extremes.M.x, L / 2, L);
      near(s.extremes.v.value, (5 * w * L ** 4) / (384 * EI));
      near(s.extremes.v.x, L / 2, L);
      near(s.bearings[0].thetaVertical, (-w * L ** 3) / (24 * EI));
      near(s.bearings[1].thetaVertical, (w * L ** 3) / (24 * EI));
      near(s.totalLoad.vertical, w * L);
      expect(s.totalLoad.horizontal).toBe(0);
      near(s.loadScale, w * L);
      expect(s.bearings.map((b) => b.horizontal)).toEqual([0, 0]);
    }
    // At a point that is no place of either: the same shaft.
    near(cut.at(17.3).vertical.v, whole.at(17.3).vertical.v);
    near(cut.at(17.3).vertical.theta, whole.at(17.3).vertical.theta, (w * L ** 3) / EI);
  });

  it('a couple at a bearing: C/L on each, the other way; CL/3EI there and CL/6EI at the far one; CL²/9√3EI, at L/√3 from the far one', () => {
    const C = 5000;
    const s = solved({ segments: [{ L, EI }], bearings: [0, L], couples: [{ x: 0, v: C, h: 0 }] });
    near(s.bearings[0].vertical, C / L);
    near(s.bearings[1].vertical, -C / L);
    // Counter-clockwise on the left end: it hogs the shaft there by the whole couple, and by nothing at the far bearing.
    near(s.at(0, 'right').vertical.M, -C);
    expect(s.at(0, 'left').vertical.M).toBe(0);
    near(s.bearings[0].thetaVertical, (C * L) / (3 * EI));
    near(s.bearings[1].thetaVertical, (-C * L) / (6 * EI));
    near(s.extremes.vertical.vMax.value, (C * L * L) / (9 * Math.sqrt(3) * EI));
    near(s.extremes.vertical.vMax.x, L - L / Math.sqrt(3), L, 1e-8);
    near(s.loadScale, C / L);
    expect(s.totalLoad).toEqual({ vertical: 0, horizontal: 0 });
  });

  it('…and a deflection read a millionth of the span from the far bearing is right to its own figures: a piece is worked from its nearer end', () => {
    // EI·v = C·x·(L − x)·(2L − x) / 6L: with r = L − x, which is exact for a point this near the end, C·x·r·(L + r) / 6L.
    const C = 5000;
    const s = solved({ segments: [{ L, EI }], bearings: [0, L], couples: [{ x: 0, v: C, h: 0 }] });
    for (const x of [L * (1 - 1e-3), L * (1 - 1e-6), L * (1 - 1e-9 * 40)]) {
      const r = L - x;
      const want = (C * x * r * (L + r)) / (6 * L * EI);
      near(s.at(x).vertical.v, want, want, 1e-13);
      // …and the slope there: EI·θ = C (L/3 − x + x²/2L).
      near(s.at(x).vertical.theta, (C * (L / 3 - x + (x * x) / (2 * L))) / EI, (C * L) / EI, 1e-14);
    }
    // The same from the near end: C·x·(L − x)(2L − x)/6L a millionth of the span past the left bearing.
    const x = L * 1e-6;
    near(s.at(x).vertical.v, (C * x * (L - x) * (2 * L - x)) / (6 * L * EI), (C * x * L) / (3 * EI), 1e-13);
  });

  it('a couple at midspan jumps the moment, not the slope: ±C/2 either side, CL/12EI there, CL/24EI at the bearings, no deflection under it', () => {
    const C = 5000;
    const s = solved({ segments: [{ L, EI }], bearings: [0, L], couples: [{ x: L / 2, v: 0, h: C }] });
    near(s.at(L / 2, 'left').horizontal.M, C / 2);
    near(s.at(L / 2, 'right').horizontal.M, -C / 2);
    expect(s.at(L / 2, 'left').horizontal.theta).toBe(s.at(L / 2, 'right').horizontal.theta);
    near(s.at(L / 2).horizontal.theta, (C * L) / (12 * EI));
    near(s.bearings[0].thetaHorizontal, (-C * L) / (24 * EI));
    near(s.bearings[1].thetaHorizontal, (-C * L) / (24 * EI));
    near(s.at(L / 2).horizontal.v, 0, (C * L * L) / EI, 1e-12);
    // The largest resultant moment is on both sides of the couple: one size.
    near(s.extremes.M.value, C / 2);
  });
});

describe('shaft: the first calculator’s engine, on every shaft of one section (200 random ones)', () => {
  // beam/solver.ts integrates a beam of one stiffness by initial parameters and Macaulay brackets, from the left
  // end, and fixes its constants by solving for them. Here the slopes come from the curvature added up between
  // the bearings and carried out from them: another route to the same shape.
  const asBeam = (m: ShaftModel, plane: Plane): BeamModel => {
    const X = stepsOf(m);
    return {
      L: X[X.length - 1],
      supports: [
        { x: m.bearings[0], kind: 'pin' },
        { x: m.bearings[1], kind: 'roller' },
      ],
      points: (m.forces ?? []).map((f) => ({ x: f.x, P: f[plane] })),
      couples: (m.couples ?? []).map((c) => ({ x: c.x, M: c[plane] })),
      dists: plane === 'v' ? m.segments.flatMap((g, i) => (g.w ? [{ x1: X[i], x2: X[i + 1], w1: g.w, w2: g.w }] : [])) : [],
    };
  };
  it('agrees on every response at every place (both sides) and between, and on the reactions', () => {
    let compared = 0;
    for (let seed = 1; seed <= 200; seed++) {
      const m = randomShaft(seed * 31, { one: true });
      const s = solved(m);
      const stiffness = m.segments[0].EI;
      for (const plane of PLANES) {
        const beam = solveBeam(asBeam(m, plane));
        if (!beam.ok) throw new Error(`seed ${seed}: the beam is not solved`);
        const top = sizeOf(s, m);
        const F = s.loadScale || 1;
        const points: [number, Side][] = [...s.breaks.flatMap((x): [number, Side][] => [[x, 'left'], [x, 'right']]), ...insideOf(s).map((x): [number, Side] => [x, 'right'])];
        for (const [x, side] of points) {
          const got = planeOf(s.at(x, side), plane);
          const want = beam.at(x, side);
          near(got.V, want.V, F, 1e-10);
          near(got.M, want.M, F * s.L, 1e-10);
          near(got.theta, want.EItheta / stiffness, top.theta, 1e-10);
          near(got.v, want.EIv / stiffness, top.v, 1e-10);
          compared += 1;
        }
        s.bearings.forEach((b, k) => near(plane === 'v' ? b.vertical : b.horizontal, beam.reactions[k].Rv, F, 1e-10));
        // The planes it hands back are that engine's own solutions of these very beams.
        const own = plane === 'v' ? s.planes.vertical : s.planes.horizontal;
        expect(own.reactions.map((r) => r.Rv)).toEqual(beam.reactions.map((r) => r.Rv));
        expect(own.extremes).toEqual(beam.extremes);
      }
    }
    expect(compared).toBeGreaterThan(8000);
  }, 60_000);
});

describe('shaft: stepped, against the unit-load method written out', () => {
  // Three thirds, the middle one thicker: EI₁, EI₂, EI₁. A force P at midspan.
  const EI1 = 1.1e7;
  const EI2 = 4.3e7;
  const thirds = (k1: number, k2: number): ShaftSegment[] => [{ L: L / 3, EI: k1, Z: 1.2 }, { L: L / 3, EI: k2, Z: 3.4 }, { L: L / 3, EI: k1, Z: 1.2 }];

  it('a central force on a shaft with a thicker middle third: the deflection under it', () => {
    // M = Px/2 and m = x/2 up to midspan, the same again past it:
    //   δ = 2 [ ∫₀^{L/3} (Px²/4)/EI₁ dx + ∫_{L/3}^{L/2} (Px²/4)/EI₂ dx ] = (PL³/6) [ 1/(27 EI₁) + 19/(216 EI₂) ]
    const s = solved({ segments: thirds(EI1, EI2), bearings: [0, L], forces: [{ x: L / 2, v: P, h: 0 }] });
    const delta = ((P * L ** 3) / 6) * (1 / (27 * EI1) + 19 / (216 * EI2));
    near(s.at(L / 2).vertical.v, -delta);
    near(s.extremes.v.value, delta);
    near(s.extremes.v.x, L / 2, L);
    // With one stiffness it is PL³/48EI: 1/27 + 19/216 = 1/8.
    near(((P * L ** 3) / 6) * (1 / (27 * EI) + 19 / (216 * EI)), (P * L ** 3) / (48 * EI));
  });

  it('…and the slope at each bearing', () => {
    // A unit couple at the left bearing: m = −(1 − x/L). M and EI are the same either side of midspan, so
    //   ∫ M (1 − x/L)/EI = ½ ∫ M/EI = ∫₀^{L/3} (Px/2)/EI₁ + ∫_{L/3}^{L/2} (Px/2)/EI₂ = (PL²/4) [ 1/(9 EI₁) + 5/(36 EI₂) ]
    const s = solved({ segments: thirds(EI1, EI2), bearings: [0, L], forces: [{ x: L / 2, v: P, h: 0 }] });
    const theta = ((P * L * L) / 4) * (1 / (9 * EI1) + 5 / (36 * EI2));
    near(s.bearings[0].thetaVertical, -theta);
    near(s.bearings[1].thetaVertical, theta);
    near(s.at(L / 2).vertical.theta, 0, theta, 1e-12);
    // 1/9 + 5/36 = 1/4: PL²/16EI.
    near(((P * L * L) / 4) * (1 / (9 * EI) + 5 / (36 * EI)), (P * L * L) / (16 * EI));
  });

  it('…the stress jumps at each shoulder, and the largest of each segment is its own moment over its own Z', () => {
    const s = solved({ segments: thirds(EI1, EI2), bearings: [0, L], forces: [{ x: L / 2, v: P, h: 0 }] });
    const shoulder = (P * L) / 6;
    near(s.at(L / 3, 'left').sigma ?? 0, shoulder / 1.2);
    near(s.at(L / 3, 'right').sigma ?? 0, shoulder / 3.4);
    expect([s.at(L / 3, 'left').segment, s.at(L / 3, 'right').segment]).toEqual([0, 1]);
    near(s.segments[0].M.value, shoulder);
    expect(s.segments[0].M.x).toBe(L / 3);
    near(s.segments[0].sigma?.value ?? 0, shoulder / 1.2);
    near(s.segments[1].M.value, (P * L) / 4);
    near(s.segments[1].sigma?.value ?? 0, (P * L) / 4 / 3.4);
    near(s.segments[2].sigma?.value ?? 0, shoulder / 1.2);
    // The small side governs: the largest stress of the shaft is at a shoulder, not under the force.
    near(s.extremes.sigma?.value ?? 0, shoulder / 1.2);
    expect(s.extremes.sigma?.x).toBe(L / 3);
    expect(s.extremes.M.x).toBe(L / 2);
  });

  it('an overhung pulley on a shaft that necks down past the bearing: the tip, and both bearings', () => {
    // Between the bearings (ℓ, EI₁) M = −Pc·x/ℓ; on the neck (c, EI₂) M = −P·s, s from the tip. A unit force at the tip: the same with P = 1.
    //   δ = ∫₀^ℓ (Pc·x/ℓ)(c·x/ℓ)/EI₁ dx + ∫₀^c (P·s)(s)/EI₂ ds = Pc²ℓ/3EI₁ + Pc³/3EI₂
    // A unit couple at the right bearing bends the span alone, m = −x/ℓ:   θ = Pcℓ/3EI₁.   At the left one, m = −(1 − x/ℓ):   θ = Pcℓ/6EI₁.
    const l = 28;
    const c = 9;
    const s = solved({ segments: [{ L: l, EI: EI2, Z: 3.4 }, { L: c, EI: EI1, Z: 1.2 }], bearings: [0, l], forces: [{ x: l + c, v: P, h: 0 }] });
    near(s.at(l + c).vertical.v, -((P * c * c * l) / (3 * EI2) + (P * c ** 3) / (3 * EI1)));
    near(s.bearings[1].thetaVertical, (-P * c * l) / (3 * EI2));
    near(s.bearings[0].thetaVertical, (P * c * l) / (6 * EI2));
    // On the neck the slope goes on turning, by the neck's own stiffness: −Pc²/2EI₂ more at the tip.
    near(s.at(l + c).vertical.theta, (-P * c * l) / (3 * EI2) - (P * c * c) / (2 * EI1));
    // At the bearing the moment is one value and the section is two: the neck's stress is the larger.
    near(s.at(l, 'left').sigma ?? 0, (P * c) / 3.4);
    near(s.at(l, 'right').sigma ?? 0, (P * c) / 1.2);
    near(s.extremes.sigma?.value ?? 0, (P * c) / 1.2);
  });

  it('a hollow segment: its own EI in the deflection and its own section modulus in the stress', () => {
    // 2.5 in solid at the ends, 3.5 in with a 2 in bore in the middle third.
    const solid = round(2.5);
    const bored = round(3.5, 2);
    const s = solved({ segments: [{ L: L / 3, ...solid }, { L: L / 3, ...bored }, { L: L / 3, ...solid }], bearings: [0, L], forces: [{ x: L / 2, v: P, h: 0 }] });
    near(s.at(L / 2).vertical.v, -((P * L ** 3) / 6) * (1 / (27 * solid.EI) + 19 / (216 * bored.EI)));
    // 32 M D / π(D⁴ − d⁴), written out.
    near(s.at(L / 2).sigma ?? 0, (32 * ((P * L) / 4) * 3.5) / (Math.PI * (3.5 ** 4 - 2 ** 4)));
    near(s.at(L / 3, 'left').sigma ?? 0, (32 * ((P * L) / 6)) / (Math.PI * 2.5 ** 3));
  });

  it('a notch, a millionth of the shaft long and a million times softer: the shortest and the softest segment the engine takes', () => {
    // Central force, the notch astride midspan (e, EI₂), the rest EI₁:
    //   δ = (P/6) [ (L/2 − e/2)³/EI₁ + ((L/2)³ − (L/2 − e/2)³)/EI₂ ],   θ at a bearing = (P/4) [ (L/2 − e/2)²/EI₁ + ((L/2)² − (L/2 − e/2)²)/EI₂ ]
    const side = 20;
    const e = (2 * side * SHORT) / (1 - SHORT);
    const total = 2 * side + e;
    const soft = EI / STIFF;
    const s = solved({ segments: [{ L: side, EI }, { L: e, EI: soft }, { L: side, EI }], bearings: [0, total], forces: [{ x: total / 2, v: P, h: 0 }] });
    const delta = (P / 6) * (side ** 3 / EI + ((total / 2) ** 3 - side ** 3) / soft);
    const theta = (P / 4) * (side ** 2 / EI + ((total / 2) ** 2 - side ** 2) / soft);
    near(s.at(total / 2).vertical.v, -delta, delta, 1e-9);
    near(s.bearings[0].thetaVertical, -theta, theta, 1e-9);
    near(s.bearings[1].thetaVertical, theta, theta, 1e-9);
    // The notch is no detail of this shaft: it bends it three quarters as much again as the rest of it does.
    expect(delta / ((P * total ** 3) / (48 * EI))).toBeGreaterThan(1.7);
  });

  it('a notch at no round place bends by ITS OWN length, not by the difference of two positions along the shaft', () => {
    // a, the notch e, b; a couple C on the left bearing: M = −C(1 − x/L). A unit couple at the right bearing: m = x/L.
    //   θ at the right bearing = −(C/L²) [ I₁/EI₁ + I₂/EI₂ + I₃/EI₁ ],   each I the integral of (L − x)·x over its part:
    //   I₁ = La²/2 − a³/3     I₂ = e·[ L(a + e/2) − (a² + ae + e²/3) ]     I₃ = Lb²/2 − b³/3
    // 17.3 + e is a position known to sixteen figures; less 17.3 again, the notch would be known to eleven.
    const [a, b] = [17.3, 22.7];
    const e = 1.2e-6 * (a + b);
    const total = a + e + b;
    const [stiff, soft] = [EI, EI / 1e6];
    const C = 5000;
    const s = solved({ segments: [{ L: a, EI: stiff }, { L: e, EI: soft }, { L: b, EI: stiff }], bearings: [0, total], couples: [{ x: 0, v: C, h: 0 }] });
    const I1 = (total * a * a) / 2 - a ** 3 / 3;
    const I2 = e * (total * (a + e / 2) - (a * a + a * e + (e * e) / 3));
    const I3 = (total * b * b) / 2 - b ** 3 / 3;
    const theta = (-C / (total * total)) * (I1 / stiff + I2 / soft + I3 / stiff);
    near(s.bearings[1].thetaVertical, theta, theta, 1e-13);
    // The notch is more than half of that slope.
    expect(I2 / soft / (I1 / stiff + I2 / soft + I3 / stiff)).toBeGreaterThan(0.5);
  });

  it('any point of a stepped shaft under loads of every kind: the unit-load method as a function', () => {
    const model: ShaftModel = {
      segments: [{ L: 6, ...round(1.5, 0, true) }, { L: 14, ...round(2.75, 0, true) }, { L: 9, ...round(3.5, 1.5, true) }, { L: 5, ...round(1.25, 0, true) }],
      bearings: [4, 29],
      forces: [{ x: 0, v: 220, h: -140 }, { x: 13, v: -650, h: 410 }, { x: 24.5, v: 300, h: 380 }, { x: 34, v: 150, h: 0 }],
      couples: [{ x: 13, v: 1800, h: -900 }, { x: 31, v: 0, h: 700 }],
    };
    const s = solved(model);
    const top = topOf(s);
    for (const x of [0, 2.5, 4, 6, 9.1, 13, 20, 22.75, 29, 30.3, 34]) {
      for (const plane of PLANES) {
        near(planeOf(s.at(x), plane).v, unitLoad(model, plane, x, 'v'), top.v, 1e-11);
        near(planeOf(s.at(x), plane).theta, unitLoad(model, plane, x, 'theta'), top.theta, 1e-11);
      }
    }
  });
});

describe('shaft: two planes', () => {
  const stepped: ShaftSegment[] = [{ L: 8, ...round(1.75) }, { L: 16, ...round(3) }, { L: 10, ...round(2.25, 1) }];

  it('a force at 45°: each plane has 1/√2 of everything, and the two together the whole', () => {
    const one = solved({ segments: stepped, bearings: [3, 30], forces: [{ x: 19, v: P, h: 0 }], couples: [{ x: 34, v: 1200, h: 0 }] });
    const k = Math.SQRT1_2;
    const both = solved({ segments: stepped, bearings: [3, 30], forces: [{ x: 19, v: P * k, h: P * k }], couples: [{ x: 34, v: 1200 * k, h: 1200 * k }] });
    const top = topOf(one);
    for (const x of [0, 3, 8, 12.5, 19, 24, 30, 34]) {
      for (const side of SIDES) {
        const a = one.at(x, side);
        const b = both.at(x, side);
        for (const plane of [b.vertical, b.horizontal]) {
          near(plane.V, a.vertical.V * k, top.V, 1e-12);
          near(plane.M, a.vertical.M * k, top.M, 1e-12);
          near(plane.theta, a.vertical.theta * k, top.theta, 1e-12);
          near(plane.v, a.vertical.v * k, top.v, 1e-12);
        }
        near(b.V, a.V, top.V, 1e-12);
        near(b.M, a.M, top.M, 1e-12);
        near(b.theta, a.theta, top.theta, 1e-12);
        near(b.v, a.v, top.v, 1e-12);
        near(b.sigma ?? 0, a.sigma ?? 0, top.M, 1e-12);
      }
    }
    both.bearings.forEach((b, i) => {
      near(b.radial, one.bearings[i].radial);
      near(b.vertical, one.bearings[i].vertical * k);
      near(b.horizontal, one.bearings[i].vertical * k);
      near(b.theta, one.bearings[i].theta, top.theta, 1e-12);
    });
    near(both.extremes.v.value, one.extremes.v.value);
    near(both.extremes.v.x, one.extremes.v.x, one.L, 1e-8);
    near(both.extremes.M.value, one.extremes.M.value);
    near(both.loadScale, one.loadScale);
  });

  it('turn every load about the axis by any angle: every size is what it was (60 random shafts, three angles each)', () => {
    for (let seed = 1; seed <= 60; seed++) {
      // (The weight does not turn with the loads: none here.)
      const m = randomShaft(seed * 53 + 7, { weight: false });
      const s = solved(m);
      const top = sizeOf(s, m);
      const r = mulberry32(seed);
      for (const angle of [Math.PI / 2, r() * 2 * Math.PI, r() * 2 * Math.PI]) {
        const [c, sn] = [Math.cos(angle), Math.sin(angle)];
        const turn = <T extends { v: number; h: number }>(l: T): T => ({ ...l, v: l.v * c - l.h * sn, h: l.v * sn + l.h * c });
        const t = solved({ ...m, forces: (m.forces ?? []).map(turn), couples: (m.couples ?? []).map(turn) });
        for (const [x, side] of [...s.breaks.flatMap((b): [number, Side][] => [[b, 'left'], [b, 'right']]), ...insideOf(s).map((b): [number, Side] => [b, 'right'])]) {
          const [a, b] = [s.at(x, side), t.at(x, side)];
          near(b.V, a.V, top.V, 1e-11);
          near(b.M, a.M, top.M, 1e-11);
          near(b.theta, a.theta, top.theta, 1e-11);
          near(b.v, a.v, top.v, 1e-11);
          expect(b.sigma === null).toBe(a.sigma === null);
          near(b.sigma ?? 0, a.sigma ?? 0, top.M, 1e-11);
        }
        t.bearings.forEach((b, i) => {
          near(b.radial, s.bearings[i].radial, s.loadScale, 1e-11);
          near(b.theta, s.bearings[i].theta, top.theta, 1e-11);
        });
        for (const key of ['V', 'M', 'theta', 'v'] as const) near(t.extremes[key].value, s.extremes[key].value, top[key], 1e-11);
        near(t.extremes.sigma?.value ?? 0, s.extremes.sigma?.value ?? 0, top.M, 1e-11);
        near(t.loadScale, s.loadScale);
      }
    }
  }, 60_000);

  it('the largest moment of the two together is where neither plane has its own: weight in one, a force in the other', () => {
    // Vertical: its weight, M = wx(L − x)/2, largest at midspan. Horizontal: a force H at a, M = Hbx/L up to it.
    // Up to the force the square of the two together is x² [ (w(L − x)/2)² + (Hb/L)² ], which turns where
    //   2x² − 3Lx + L² + 4(Hb/wL)² = 0:   x = (3L − √(L² − 32 (Hb/wL)²)) / 4 — between midspan and the force.
    const w = 3;
    const H = 9;
    const a = 34;
    const b = L - a;
    const s = solved({ segments: [{ L, EI, Z, w }], bearings: [0, L], forces: [{ x: a, v: 0, h: H }] });
    const k = (H * b) / L;
    const x = (3 * L - Math.sqrt(L * L - (32 * k * k) / (w * w))) / 4;
    expect(x).toBeGreaterThan(L / 2);
    expect(x).toBeLessThan(a);
    near(s.extremes.M.x, x, L, 1e-9);
    near(s.extremes.M.value, x * Math.hypot((w * (L - x)) / 2, k));
    // Not where the vertical plane's is, nor the horizontal one's.
    near(s.extremes.vertical.Mmax.x, L / 2, L, 1e-9);
    expect(s.extremes.horizontal.Mmax.x).toBe(a);
    near(s.segments[0].sigma?.value ?? 0, (x * Math.hypot((w * (L - x)) / 2, k)) / Z);
    expect(s.segments[0].sigma?.x).toBe(s.extremes.M.x);
  });

  it('the largest deflection of the two together is between the planes’ own, and no point of the shaft is past it', () => {
    const s = solved({ segments: [{ L, EI }], bearings: [0, L], forces: [{ x: 9, v: P, h: 0 }, { x: 31, v: 0, h: P }] });
    const [xv, xh, x] = [s.extremes.vertical.vMin.x, s.extremes.horizontal.vMin.x, s.extremes.v.x];
    expect(x).toBeGreaterThan(xv);
    expect(x).toBeLessThan(xh);
    // By symmetry: at midspan.
    near(x, L / 2, L, 1e-9);
    for (let i = 0; i <= 4000; i++) expect(s.at((L * i) / 4000).v).toBeLessThanOrEqual(s.extremes.v.value * (1 + 1e-14));
    expect(s.at(x).v).toBe(s.extremes.v.value);
  }, 60_000);
});

describe('shaft: what is true of every shaft (200 random ones, stepped, bored, with their weight, in two planes)', () => {
  const SEEDS = Array.from({ length: 200 }, (_, i) => 1000 + i * 13);
  /** Each of them solved once: the tests below ask the same two hundred shafts different questions. */
  const kept = new Map<number, { m: ShaftModel; s: ShaftSolution }>();
  const shaft = (seed: number) => {
    let found = kept.get(seed);
    if (!found) {
      const m = randomShaft(seed);
      found = { m, s: solved(m) };
      kept.set(seed, found);
    }
    return found;
  };

  it('each plane is in equilibrium: the two reactions carry its loads, and their moments add up to nothing', () => {
    for (const seed of SEEDS) {
      const { m, s } = shaft(seed);
      const X = stepsOf(m);
      for (const plane of PLANES) {
        const R = s.bearings.map((b) => (plane === 'v' ? b.vertical : b.horizontal));
        const loads = (m.forces ?? []).map((f) => ({ x: f.x, P: f[plane] })).concat(plane === 'v' ? m.segments.map((g, i) => ({ x: (X[i] + X[i + 1]) / 2, P: (g.w ?? 0) * g.L })) : []);
        const W = loads.reduce((sum, l) => sum + l.P, 0);
        near(R[0] + R[1], W, s.loadScale, 1e-12);
        near(plane === 'v' ? s.totalLoad.vertical : s.totalLoad.horizontal, W, s.loadScale, 1e-12);
        // About the left end, counter-clockwise: a reaction up, a load down, a couple as it is.
        const about = R[0] * s.bearings[0].x + R[1] * s.bearings[1].x - loads.reduce((sum, l) => sum + l.P * l.x, 0) + (m.couples ?? []).reduce((sum, c) => sum + c[plane], 0);
        near(about, 0, s.loadScale * s.L, 1e-12);
        // …and each is what the two equations give, written out.
        const want = statics(m, plane);
        near(R[0], want.Ra, s.loadScale, 1e-12);
        near(R[1], want.Rb, s.loadScale, 1e-12);
      }
      // The radial load on a bearing is the size of its two, and so is its slope.
      for (const b of s.bearings) {
        expect(b.radial).toBe(Math.hypot(b.vertical, b.horizontal));
        expect(b.theta).toBe(Math.hypot(b.thetaVertical, b.thetaHorizontal));
      }
    }
  }, 60_000);

  it('the shear and the moment at a section are what is to its left; nothing is left past the right end, to the last figure', () => {
    for (const seed of SEEDS) {
      const { m, s } = shaft(seed);
      for (const plane of PLANES) {
        const want = statics(m, plane);
        for (const x of insideOf(s)) {
          const got = planeOf(s.at(x), plane);
          near(got.V, want.V(x), s.loadScale, 1e-12);
          near(got.M, want.M(x), s.loadScale * s.L, 1e-12);
        }
        // A free end carries no moment but a couple applied on it — to the last figure; past it there is no shaft.
        const on = (x: number) => (m.couples ?? []).reduce((sum, c) => sum + (c.x === x ? c[plane] : 0), 0);
        near(planeOf(s.at(s.L, 'left'), plane).M, on(s.L), Math.abs(on(s.L)), 1e-15);
        near(planeOf(s.at(0, 'right'), plane).M, -on(0), Math.abs(on(0)), 1e-15);
        expect([planeOf(s.at(s.L, 'right'), plane).V, planeOf(s.at(s.L, 'right'), plane).M, planeOf(s.at(0, 'left'), plane).V, planeOf(s.at(0, 'left'), plane).M]).toEqual([0, 0, 0, 0]);
      }
    }
  }, 60_000);

  it('no deflection at either bearing, to the last figure, in either plane, from either side', () => {
    for (const seed of SEEDS) {
      const { s } = shaft(seed);
      for (const b of s.bearings) {
        for (const side of SIDES) {
          const st = s.at(b.x, side);
          expect([st.vertical.v, st.horizontal.v, st.v]).toEqual([0, 0, 0]);
        }
      }
    }
  }, 60_000);

  it('the slope and the deflection are one value across every place — a step, a couple, a force, a bearing — and nowhere do they jump', () => {
    for (const seed of SEEDS) {
      const { m, s } = shaft(seed);
      const top = sizeOf(s, m);
      // The steepest the shaft is and the most it curves anywhere: what two points 2δ apart may differ by.
      const curviest = Math.max(...s.stations.map((st) => Math.max(Math.abs(st.vertical.M), Math.abs(st.horizontal.M)) / m.segments[st.segment].EI));
      const d = 1e-7 * s.L;
      for (const x of s.breaks) {
        const [l, r] = [s.at(x, 'left'), s.at(x, 'right')];
        for (const plane of PLANES) {
          expect(planeOf(l, plane).theta).toBe(planeOf(r, plane).theta);
          expect(planeOf(l, plane).v).toBe(planeOf(r, plane).v);
        }
      }
      // Either side of each place, and either side of the middle of each piece (where the engine changes the end it works from).
      const cuts = [...s.breaks.slice(1, -1), ...s.breaks.slice(0, -1).map((x, i) => (x + s.breaks[i + 1]) / 2)];
      for (const x of cuts) {
        const [l, r] = [s.at(x - d), s.at(x + d)];
        for (const plane of PLANES) {
          expect(Math.abs(planeOf(r, plane).theta - planeOf(l, plane).theta)).toBeLessThanOrEqual(2 * d * curviest * 1.01 + 1e-12 * top.theta);
          expect(Math.abs(planeOf(r, plane).v - planeOf(l, plane).v)).toBeLessThanOrEqual(2 * d * top.theta * 1.01 + 1e-12 * top.v);
        }
      }
    }
  }, 60_000);

  it('inside every piece the curvature is the moment over THAT segment’s EI, the slope is the rise of the deflection: by differences', () => {
    let pieces = 0;
    for (const seed of SEEDS) {
      const { m, s } = shaft(seed);
      const top = sizeOf(s, m);
      s.breaks.slice(0, -1).forEach((from, i) => {
        const len = s.breaks[i + 1] - from;
        if (len < 0.02 * s.L) return;
        const x = from + len / 2;
        const d = len / 4;
        const [l, c, r] = [s.at(x - d), s.at(x), s.at(x + d)];
        const seg = m.segments[c.segment];
        for (const plane of PLANES) {
          const [pl, pc, pr] = [planeOf(l, plane), planeOf(c, plane), planeOf(r, plane)];
          const w = plane === 'v' ? (seg.w ?? 0) : 0;
          // On a piece the deflection is of the fourth degree: each difference is the derivative and ONE more term, exactly.
          //   (θ₊ − θ₋)/2d = M/EI − w d²/6EI      (v₊ − 2v + v₋)/d² = M/EI − w d²/12EI      (v₊ − v₋)/2d = θ + V d²/6EI
          const kappa = pc.M / seg.EI;
          const noise = 64 * Number.EPSILON;
          near((pr.theta - pl.theta) / (2 * d), kappa - (w * d * d) / (6 * seg.EI), top.M / seg.EI + (noise * top.theta) / d, 1e-9);
          near((pr.v - 2 * pc.v + pl.v) / (d * d), kappa - (w * d * d) / (12 * seg.EI), top.M / seg.EI + (noise * top.v) / (d * d), 1e-9);
          near((pr.v - pl.v) / (2 * d), pc.theta + (pc.V * d * d) / (6 * seg.EI), top.theta + (noise * top.v) / d, 1e-9);
        }
        pieces += 1;
      });
    }
    expect(pieces).toBeGreaterThan(600);
  }, 60_000);

  it('slope and deflection anywhere are the unit-load method’s, with this file’s own statics', () => {
    let compared = 0;
    for (const seed of SEEDS) {
      const { m, s } = shaft(seed);
      const top = sizeOf(s, m);
      const r = mulberry32(seed + 5);
      const xs = [...s.bearings.map((b) => b.x), ...(m.forces ?? []).map((f) => f.x), 0, s.L, r() * s.L, r() * s.L, r() * s.L];
      for (const x of xs) {
        for (const plane of PLANES) {
          near(planeOf(s.at(x), plane).v, unitLoad(m, plane, x, 'v'), top.v, 1e-10);
          near(planeOf(s.at(x), plane).theta, unitLoad(m, plane, x, 'theta'), top.theta, 1e-10);
          compared += 2;
        }
      }
      s.bearings.forEach((b) => {
        near(b.thetaVertical, unitLoad(m, 'v', b.x, 'theta'), top.theta, 1e-10);
        near(b.thetaHorizontal, unitLoad(m, 'h', b.x, 'theta'), top.theta, 1e-10);
      });
    }
    expect(compared).toBeGreaterThan(4000);
  }, 60_000);

  it('a change of units changes nothing: inches and pounds, or millimetres and newtons', () => {
    // 1 in = 25.4 mm, 1 lbf = 4.4482216152605 N: a length × λ, a force × μ; EI × μλ², a weight × μ/λ, Z × λ³, a couple × μλ.
    const [lam, mu] = [25.4, 4.4482216152605];
    for (const seed of SEEDS.slice(0, 80)) {
      const { m, s: a } = shaft(seed);
      const si: ShaftModel = {
        segments: m.segments.map((g) => ({ L: g.L * lam, EI: g.EI * mu * lam * lam, Z: (g.Z ?? 0) * lam ** 3, ...(g.w ? { w: (g.w * mu) / lam } : {}) })),
        bearings: [m.bearings[0] * lam, m.bearings[1] * lam],
        forces: (m.forces ?? []).map((f) => ({ x: f.x * lam, v: f.v * mu, h: f.h * mu })),
        couples: (m.couples ?? []).map((c) => ({ x: c.x * lam, v: c.v * mu * lam, h: c.h * mu * lam })),
      };
      const b = solved(si);
      const top = sizeOf(a, m);
      expect(b.breaks.length).toBe(a.breaks.length);
      for (const [x, side] of [...a.breaks.flatMap((p): [number, Side][] => [[p, 'left'], [p, 'right']]), ...insideOf(a).map((p): [number, Side] => [p, 'right'])]) {
        const [p, q] = [a.at(x, side), b.at(x * lam, side)];
        for (const plane of PLANES) {
          near(planeOf(q, plane).V / mu, planeOf(p, plane).V, top.V, 1e-10);
          near(planeOf(q, plane).M / (mu * lam), planeOf(p, plane).M, top.M, 1e-10);
          near(planeOf(q, plane).theta, planeOf(p, plane).theta, top.theta, 1e-10);
          near(planeOf(q, plane).v / lam, planeOf(p, plane).v, top.v, 1e-10);
        }
        near(((q.sigma ?? 0) * lam * lam) / mu, p.sigma ?? 0, top.M, 1e-10);
      }
      for (const key of ['V', 'M', 'theta', 'v'] as const) near(b.extremes[key].value / { V: mu, M: mu * lam, theta: 1, v: lam }[key], a.extremes[key].value, top[key], 1e-10);
      near(b.extremes.v.x / lam, a.extremes.v.x, a.L, 1e-7);
      near(b.loadScale / mu, a.loadScale);
      near(b.slopeScale, a.slopeScale);
      near(b.deflectionScale / lam, a.deflectionScale);
    }
  }, 60_000);

  it('…nor do units no shaft is measured in: lengths × 10³⁰ and forces × 10⁻²⁵, and the other way', () => {
    for (const [lam, mu] of [[1e30, 1e-25], [1e-30, 1e25], [1e-18, 1e-12], [1e15, 1e12]]) {
      const m = randomShaft(1234);
      // (No section modulus: × λ³ it is past what the engine takes for one.)
      const far: ShaftModel = {
        segments: m.segments.map((g) => ({ L: g.L * lam, EI: g.EI * mu * lam * lam, ...(g.w ? { w: (g.w * mu) / lam } : {}) })),
        bearings: [m.bearings[0] * lam, m.bearings[1] * lam],
        forces: (m.forces ?? []).map((f) => ({ x: f.x * lam, v: f.v * mu, h: f.h * mu })),
        couples: (m.couples ?? []).map((c) => ({ x: c.x * lam, v: c.v * mu * lam, h: c.h * mu * lam })),
      };
      const [a, b] = [solved(m), solved(far)];
      const top = sizeOf(a, m);
      for (const x of insideOf(a)) {
        const [p, q] = [a.at(x), b.at(x * lam)];
        near(q.V / mu, p.V, top.V, 1e-10);
        near(q.M / (mu * lam), p.M, top.M, 1e-10);
        near(q.theta, p.theta, top.theta, 1e-10);
        near(q.v / lam, p.v, top.v, 1e-10);
      }
      near(b.extremes.v.value / lam, a.extremes.v.value, top.v, 1e-10);
      near(b.extremes.M.value / (mu * lam), a.extremes.M.value, top.M, 1e-10);
    }
  });

  it('the mirror image is the same shaft seen from the other side: the same sizes, the shear and the slope the other way', () => {
    for (const seed of SEEDS.slice(0, 100)) {
      const { m, s: a } = shaft(seed);
      const total = stepsOf(m)[m.segments.length];
      const mirror: ShaftModel = {
        segments: [...m.segments].reverse(),
        bearings: [total - m.bearings[0], total - m.bearings[1]],
        forces: (m.forces ?? []).map((f) => ({ ...f, x: total - f.x })),
        // Counter-clockwise, seen from the other side, is clockwise.
        couples: (m.couples ?? []).map((c) => ({ x: total - c.x, v: -c.v, h: -c.h })),
      };
      const b = solved(mirror);
      const top = sizeOf(a, m);
      for (const [x, side] of [...a.breaks.flatMap((p): [number, Side][] => [[p, 'left'], [p, 'right']]), ...insideOf(a).map((p): [number, Side] => [p, 'right'])]) {
        const [p, q] = [a.at(x, side), b.at(total - x, side === 'left' ? 'right' : 'left')];
        for (const plane of PLANES) {
          near(planeOf(q, plane).V, -planeOf(p, plane).V, top.V, 1e-10);
          near(planeOf(q, plane).M, planeOf(p, plane).M, top.M, 1e-10);
          near(planeOf(q, plane).theta, -planeOf(p, plane).theta, top.theta, 1e-10);
          near(planeOf(q, plane).v, planeOf(p, plane).v, top.v, 1e-10);
        }
        near(q.sigma ?? 0, p.sigma ?? 0, top.M, 1e-10);
      }
      // The left bearing of one is the right bearing of the other.
      near(b.bearings[1].radial, a.bearings[0].radial, a.loadScale, 1e-10);
      near(b.bearings[0].theta, a.bearings[1].theta, top.theta, 1e-10);
      for (const key of ['V', 'M', 'theta', 'v'] as const) {
        near(b.extremes[key].value, a.extremes[key].value, top[key], 1e-10);
      }
      a.segments.forEach((g, i) => {
        const h = b.segments[a.segments.length - 1 - i];
        near(h.M.value, g.M.value, top.M, 1e-10);
        near(h.v.value, g.v.value, top.v, 1e-10);
        near(h.sigma?.value ?? 0, g.sigma?.value ?? 0, top.M, 1e-10);
      });
    }
  }, 60_000);

  it('two sets of loads together are the two apart, added: plane by plane, everywhere', () => {
    for (const seed of SEEDS.slice(0, 100)) {
      const m = randomShaft(seed, { loads: 4 });
      const bare = m.segments.map((g) => ({ L: g.L, EI: g.EI, Z: g.Z }));
      // The weight and the first two forces; then the other forces and the couples, on the shaft with no weight.
      const first: ShaftModel = { ...m, forces: (m.forces ?? []).slice(0, 2), couples: [] };
      const second: ShaftModel = { ...m, segments: bare, forces: (m.forces ?? []).slice(2) };
      const [whole, a, b] = [solved(m), solved(first), solved(second)];
      const scale = sizeOf(whole, m);
      for (const x of insideOf(whole)) {
        const [w, p, q] = [whole.at(x), a.at(x), b.at(x)];
        for (const plane of PLANES) {
          for (const key of ['V', 'M', 'theta', 'v'] as const) near(planeOf(w, plane)[key], planeOf(p, plane)[key] + planeOf(q, plane)[key], scale[key], 1e-11);
        }
      }
      whole.bearings.forEach((bg, i) => {
        near(bg.vertical, a.bearings[i].vertical + b.bearings[i].vertical, whole.loadScale, 1e-11);
        near(bg.thetaHorizontal, a.bearings[i].thetaHorizontal + b.bearings[i].thetaHorizontal, scale.theta, 1e-11);
      });
    }
  }, 60_000);
});

describe('shaft: the largest values are values the shaft takes, and nothing exceeds them', () => {
  const SEEDS = Array.from({ length: 40 }, (_, i) => 7000 + i * 17);

  it('against a sampling a hundred times finer than the stations: no point is past a largest value, and each is the value at the place it names', () => {
    for (const seed of SEEDS) {
      const m = randomShaft(seed);
      const s = solved(m);
      const top = sizeOf(s, m);
      const e = s.extremes;
      const best = { V: 0, M: 0, theta: 0, v: 0 };
      const plane = { v: { Mmax: -Infinity, Mmin: Infinity, vMax: -Infinity, vMin: Infinity }, h: { Mmax: -Infinity, Mmin: Infinity, vMax: -Infinity, vMin: Infinity } };
      const inSegment = m.segments.map(() => ({ M: 0, v: 0 }));
      const see = (st: ShaftState) => {
        for (const key of ['V', 'M', 'theta', 'v'] as const) best[key] = Math.max(best[key], st[key]);
        for (const pl of PLANES) {
          const p = planeOf(st, pl);
          plane[pl].Mmax = Math.max(plane[pl].Mmax, p.M);
          plane[pl].Mmin = Math.min(plane[pl].Mmin, p.M);
          plane[pl].vMax = Math.max(plane[pl].vMax, p.v);
          plane[pl].vMin = Math.min(plane[pl].vMin, p.v);
        }
        inSegment[st.segment].M = Math.max(inSegment[st.segment].M, st.M);
        inSegment[st.segment].v = Math.max(inSegment[st.segment].v, st.v);
      };
      s.breaks.slice(0, -1).forEach((from, i) => {
        const to = s.breaks[i + 1];
        // The engine draws a piece with 24 cells, or 240 × its share of the shaft: a hundred times that.
        const cells = 100 * Math.max(24, Math.ceil(((to - from) / s.L) * 240));
        see(s.at(from, 'right'));
        for (let j = 1; j < cells; j++) see(s.at(from + ((to - from) * j) / cells));
        see(s.at(to, 'left'));
      });
      // Nothing sampled is past a largest value (a rounding of it apart)…
      const slack = 1e-12;
      for (const key of ['V', 'M', 'theta', 'v'] as const) {
        expect(best[key], `seed ${seed}: ${key}`).toBeLessThanOrEqual(e[key].value + slack * top[key]);
        // …and the largest value is not past the shaft: the samples come within a millionth of it.
        expect(e[key].value, `seed ${seed}: ${key}`).toBeLessThanOrEqual(best[key] + 1e-6 * top[key]);
      }
      for (const pl of PLANES) {
        const of = pl === 'v' ? e.vertical : e.horizontal;
        expect(plane[pl].Mmax).toBeLessThanOrEqual(of.Mmax.value + slack * top.M);
        expect(plane[pl].Mmin).toBeGreaterThanOrEqual(of.Mmin.value - slack * top.M);
        expect(plane[pl].vMax).toBeLessThanOrEqual(of.vMax.value + slack * top.v);
        expect(plane[pl].vMin).toBeGreaterThanOrEqual(of.vMin.value - slack * top.v);
        expect(of.Mmax.value).toBeLessThanOrEqual(plane[pl].Mmax + 1e-6 * top.M);
        expect(of.vMin.value).toBeGreaterThanOrEqual(plane[pl].vMin - 1e-6 * top.v);
      }
      s.segments.forEach((g, i) => {
        expect(inSegment[i].M, `seed ${seed}: segment ${i}`).toBeLessThanOrEqual(g.M.value + slack * top.M);
        expect(g.M.value).toBeLessThanOrEqual(inSegment[i].M + 1e-6 * top.M);
        expect(inSegment[i].v).toBeLessThanOrEqual(g.v.value + slack * top.v);
        expect(g.v.value).toBeLessThanOrEqual(inSegment[i].v + 1e-6 * top.v);
        expect(g.M.x).toBeGreaterThanOrEqual(g.from);
        expect(g.M.x).toBeLessThanOrEqual(g.to);
        // The largest stress of a segment is its largest moment over its own Z, at the same place; of the shaft, the largest of those.
        const Zg = m.segments[i].Z ?? 0;
        if (Zg > 0) expect(g.sigma).toEqual({ value: g.M.value / Zg, x: g.M.x });
        else expect(g.sigma).toBeNull();
      });
      const stresses = s.segments.flatMap((g) => (g.sigma ? [g.sigma.value] : []));
      expect(e.sigma?.value ?? null).toBe(stresses.length ? Math.max(...stresses) : null);
      // Each is the value at the place it names, on one side of it or the other.
      const hit = (x: number, of: (st: ShaftState) => number, value: number) => expect(Math.min(Math.abs(of(s.at(x, 'left')) - value), Math.abs(of(s.at(x, 'right')) - value)), `seed ${seed} at ${x}`).toBe(0);
      hit(e.V.x, (st) => st.V, e.V.value);
      hit(e.M.x, (st) => st.M, e.M.value);
      hit(e.theta.x, (st) => st.theta, e.theta.value);
      hit(e.v.x, (st) => st.v, e.v.value);
      hit(e.vertical.Mmax.x, (st) => st.vertical.M, e.vertical.Mmax.value);
      hit(e.vertical.vMin.x, (st) => st.vertical.v, e.vertical.vMin.value);
      hit(e.horizontal.Mmin.x, (st) => st.horizontal.M, e.horizontal.Mmin.value);
      hit(e.horizontal.vMax.x, (st) => st.horizontal.v, e.horizontal.vMax.value);
      s.segments.forEach((g) => hit(g.M.x, (st) => st.M, g.M.value));
    }
  }, 240_000);

  it('a plane’s largest moment is the first engine’s for that plane, found again', () => {
    for (const seed of SEEDS) {
      const s = solved(randomShaft(seed));
      for (const [own, beam] of [[s.extremes.vertical, s.planes.vertical], [s.extremes.horizontal, s.planes.horizontal]] as const) {
        near(own.Mmax.value, beam.extremes.Mmax.value, s.loadScale * s.L, 1e-11);
        near(own.Mmin.value, beam.extremes.Mmin.value, s.loadScale * s.L, 1e-11);
      }
    }
  }, 60_000);
});

describe('shaft: what a solution holds', () => {
  const model: ShaftModel = {
    segments: [{ L: 6, ...round(1.5) }, { L: 14, EI: 9e7 }, { L: 10, ...round(2.25, 1, true) }],
    bearings: [26, 2],
    forces: [{ x: 11, v: 400, h: -250 }, { x: 30, v: 0, h: 120 }, { x: 17, v: 0, h: 0 }],
    couples: [{ x: 20, v: 900, h: 0 }, { x: 8, v: 0, h: 0 }],
  };
  const s = solved(model);

  it('every place once, in order: the ends, the steps, the bearings, the forces, the couples — and a load of no size is no place', () => {
    expect(s.L).toBe(30);
    expect(s.breaks).toEqual([0, 2, 6, 11, 20, 26, 30]);
  });

  it('the bearings left to right, whatever the order they were entered in', () => {
    expect(s.bearings.map((b) => b.x)).toEqual([2, 26]);
    const swapped = solved({ ...model, bearings: [2, 26] });
    expect(swapped.bearings).toEqual(s.bearings);
  });

  it('the stations: both sides of every place, a grid between, from one end to the other', () => {
    expect(s.stations[0].x).toBe(0);
    expect(s.stations[s.stations.length - 1].x).toBe(30);
    for (let i = 1; i < s.stations.length; i++) expect(s.stations[i].x).toBeGreaterThanOrEqual(s.stations[i - 1].x);
    for (const x of s.breaks.slice(1, -1)) expect(s.stations.filter((st) => st.x === x).length).toBe(2);
    s.breaks.slice(0, -1).forEach((from, i) => expect(s.stations.filter((st) => st.x >= from && st.x <= s.breaks[i + 1]).length).toBeGreaterThanOrEqual(25));
    // A station is the shaft at its place, read again.
    const st = s.stations[137];
    expect(s.at(st.x)).toEqual(st);
    // Either side of the couple: two moments, one slope.
    const [l, r] = s.stations.filter((p) => p.x === 20);
    near(l.vertical.M - r.vertical.M, 900);
    expect(l.vertical.theta).toBe(r.vertical.theta);
    // Either side of the first step: one moment, two sections.
    const [a, b] = s.stations.filter((p) => p.x === 6);
    expect([a.segment, b.segment]).toEqual([0, 1]);
    expect(a.M).toBe(b.M);
    expect(a.sigma).not.toBeNull();
    expect(b.sigma).toBeNull();
  });

  it('a point: the right of a place unless the left is asked for (and the left at the far end); off the shaft, its end', () => {
    expect(s.at(11)).toEqual(s.at(11, 'right'));
    expect(s.at(11, 'left').vertical.V - s.at(11, 'right').vertical.V).toBeCloseTo(400, 9);
    expect(s.at(30)).toEqual(s.at(30, 'left'));
    expect(s.at(-3)).toEqual(s.at(0));
    expect(s.at(41)).toEqual({ ...s.at(30), x: 30 });
    expect(s.at(13.25).x).toBe(13.25);
    expect(s.at(13.25).segment).toBe(1);
    // Within a hair of a place it IS the place: the side decides, as at the place.
    expect({ ...s.at(11 + 1e-8 * 30 * 0.05, 'left'), x: 11 }).toEqual(s.at(11, 'left'));
    expect({ ...s.at(11 - 1e-8 * 30 * 0.05, 'right'), x: 11 }).toEqual(s.at(11, 'right'));
    // A position that is no number has nothing at it.
    expect(Number.isNaN(s.at(Number.NaN).v)).toBe(true);
    expect(s.at(Number.NaN).sigma).toBeNull();
  });

  it('the stress: the two moments together over the section modulus of the segment — none where the segment has none', () => {
    const Z0 = model.segments[0].Z ?? 0;
    const here = s.at(4);
    expect(here.M).toBe(Math.hypot(here.vertical.M, here.horizontal.M));
    expect(here.sigma).toBe(here.M / Z0);
    expect(s.at(15).sigma).toBeNull();
    expect(s.segments.map((g) => g.sigma === null)).toEqual([false, true, false]);
    expect(s.segments.map((g) => [g.index, g.from, g.to])).toEqual([[0, 0, 6], [1, 6, 20], [2, 20, 30]]);
    const none = solved({ ...model, segments: model.segments.map((g) => ({ L: g.L, EI: g.EI })) });
    expect(none.extremes.sigma).toBeNull();
    expect(none.stations.every((st) => st.sigma === null)).toBe(true);
    // A section modulus of zero is none.
    expect(solved({ ...model, segments: model.segments.map((g) => ({ L: g.L, EI: g.EI, Z: 0 })) }).extremes.sigma).toBeNull();
  });

  it('the size of the problem: every force’s size, every couple over the distance between the bearings, the whole weight', () => {
    const w = model.segments[2].w ?? 0;
    near(s.loadScale, Math.hypot(400, 250) + 120 + 900 / 24 + w * 10);
    near(s.totalLoad.vertical, 400 + w * 10);
    near(s.totalLoad.horizontal, -250 + 120);
    // As a slope and as a deflection: over the stiffest segment's EI.
    near(s.slopeScale, (s.loadScale * 30 * 30) / 9e7);
    near(s.deflectionScale, (s.loadScale * 30 ** 3) / 9e7);
  });

  it('every size is the root of the sum of the squares of its two planes, and never negative', () => {
    for (const st of s.stations) {
      expect(st.V).toBe(Math.hypot(st.vertical.V, st.horizontal.V));
      expect(st.M).toBe(Math.hypot(st.vertical.M, st.horizontal.M));
      expect(st.theta).toBe(Math.hypot(st.vertical.theta, st.horizontal.theta));
      expect(st.v).toBe(Math.hypot(st.vertical.v, st.horizontal.v));
    }
  });

  it('every number of it is a number, and no zero is written −0 (150 random shafts)', () => {
    const numbers = (st: ShaftState) => [st.x, st.V, st.M, st.theta, st.v, st.sigma ?? 0, ...[st.vertical, st.horizontal].flatMap((p) => [p.V, p.M, p.theta, p.v])];
    for (let seed = 1; seed <= 150; seed++) {
      const out = solved(randomShaft(seed * 97));
      const e = out.extremes;
      const all = [
        out.L,
        out.loadScale,
        out.slopeScale,
        out.deflectionScale,
        out.totalLoad.vertical,
        out.totalLoad.horizontal,
        ...out.breaks,
        ...out.stations.flatMap(numbers),
        ...out.bearings.flatMap((b) => [b.x, b.vertical, b.horizontal, b.radial, b.thetaVertical, b.thetaHorizontal, b.theta]),
        ...out.segments.flatMap((g) => [g.from, g.to, g.M.value, g.M.x, g.v.value, g.v.x, g.sigma?.value ?? 0, g.sigma?.x ?? 0]),
        ...[e.V, e.M, e.theta, e.v, ...(e.sigma ? [e.sigma] : []), ...Object.values(e.vertical), ...Object.values(e.horizontal)].flatMap((x) => [x.value, x.x]),
      ];
      expect(all.every(Number.isFinite), `seed ${seed}`).toBe(true);
      expect(all.some((v) => Object.is(v, -0)), `seed ${seed}`).toBe(false);
      for (const key of [e.V, e.M, e.theta, e.v]) expect(key.value).toBeGreaterThanOrEqual(0);
    }
  }, 60_000);

  it('a shaft with nothing on it is solved, and is nothing all along', () => {
    const idle = solved({ segments: model.segments.map((g) => ({ L: g.L, EI: g.EI, Z: 1 })), bearings: [2, 26] });
    expect(idle.loadScale).toBe(0);
    expect(idle.breaks).toEqual([0, 2, 6, 20, 26, 30]);
    for (const st of idle.stations) expect([st.V, st.M, st.theta, st.v, st.sigma]).toEqual([0, 0, 0, 0, 0]);
    expect(idle.extremes.M).toEqual({ value: 0, x: 0 });
    expect(idle.bearings.map((b) => b.radial)).toEqual([0, 0]);
  });
});

describe('shaft: a force on a bearing, and places a hair apart', () => {
  const segments: ShaftSegment[] = [{ L: 10, EI: 3e7, Z: 2 }, { L: 20, EI: 8e7, Z: 4 }];

  it('a force standing on a bearing goes into the bearing and bends nothing', () => {
    const s = solved({ segments, bearings: [4, 25], forces: [{ x: 25, v: 700, h: -300 }] });
    expect(s.bearings[1].vertical).toBe(700);
    expect(s.bearings[1].horizontal).toBe(-300);
    expect(s.bearings[1].radial).toBe(Math.hypot(700, 300));
    expect([s.bearings[0].vertical, s.bearings[0].horizontal]).toEqual([0, 0]);
    for (const st of s.stations) expect([st.V, st.M, st.theta, st.v]).toEqual([0, 0, 0, 0]);
    expect(s.loadScale).toBe(Math.hypot(700, 300));
  });

  it('beside other loads it is in that bearing’s reaction and nowhere else', () => {
    const others = { segments, bearings: [4, 25] as [number, number], forces: [{ x: 15, v: 500, h: 200 }] };
    const [a, b] = [solved(others), solved({ ...others, forces: [...others.forces, { x: 4, v: 900, h: 0 }] })];
    near(b.bearings[0].vertical, a.bearings[0].vertical + 900);
    near(b.bearings[1].vertical, a.bearings[1].vertical);
    for (const x of [0, 4, 9, 15, 22, 25, 30]) {
      for (const side of SIDES) {
        near(b.at(x, side).vertical.V, a.at(x, side).vertical.V, 1400, 1e-12);
        near(b.at(x, side).vertical.M, a.at(x, side).vertical.M, 1400 * 30, 1e-12);
        near(b.at(x, side).vertical.v, a.at(x, side).vertical.v, a.extremes.v.value, 1e-12);
      }
    }
  });

  it('the planes handed back are each plane under ALL its loads, the force on the bearing among them', () => {
    const s = solved({ segments, bearings: [4, 25], forces: [{ x: 25, v: 700, h: -300 }, { x: 15, v: 500, h: 200 }] });
    expect(s.totalLoad).toEqual({ vertical: 1200, horizontal: -100 });
    expect(s.planes.vertical.totalLoad).toBe(1200);
    near(s.planes.vertical.reactions[1].Rv, s.bearings[1].vertical);
    near(s.planes.horizontal.reactions[1].Rv, s.bearings[1].horizontal);
    near(s.bearings[1].vertical, 700 + (500 * 11) / 21);
    // …and what is read of the shaft is the first engine's too: the same shear and moment, a rounding apart.
    for (const x of [2, 9.5, 15, 20, 28]) {
      near(s.at(x).vertical.M, s.planes.vertical.at(x).M, 1200 * 30, 1e-13);
      near(s.at(x).horizontal.V, s.planes.horizontal.at(x).V, 1200, 1e-13);
    }
  });

  it('a force within a hair of a bearing — a billionth of the shaft — is ON it; one two hairs away is beside it', () => {
    const on = solved({ segments, bearings: [4, 25], forces: [{ x: 25 + 0.9e-9 * 30, v: 700, h: 0 }] });
    expect(on.breaks).toEqual([0, 4, 10, 25, 30]);
    expect(on.bearings[1].vertical).toBe(700);
    expect(on.extremes.M.value).toBe(0);
    const beside = solved({ segments, bearings: [4, 25], forces: [{ x: 25 + 2e-9 * 30, v: 700, h: 0 }] });
    expect(beside.breaks.length).toBe(6);
    // Its moment about the bearing, two hairs of arm: 700 × 6e-8, carried by the far bearing over 21.
    near(beside.bearings[0].vertical, (-700 * 2e-9 * 30) / 21, 700, 1e-13);
    near(beside.at(25).vertical.M, -700 * 2e-9 * 30, 700 * 30, 1e-13);
    // Between the bearing and the force the whole of it is shear; past it, none.
    near(beside.at(25, 'right').vertical.V, 700);
    expect(beside.at(25 + 2e-9 * 30, 'right').vertical.V).toBe(0);
  });

  it('a bearing or a load entered a rounding from a step is at the step; a position a rounding off an end is the end', () => {
    const s = solved({ segments, bearings: [10 + 1e-12, 30 * (1 + 1e-10)], forces: [{ x: 10 - 1e-12, v: 100, h: 0 }, { x: -1e-9, v: 50, h: 0 }] });
    expect(s.breaks).toEqual([0, 10, 30]);
    expect(s.bearings.map((b) => b.x)).toEqual([10, 30]);
    // 100 on the left bearing; 50 on the tip of a 10 overhang, over a span of 20.
    near(s.bearings[0].vertical, 100 + 50 * 1.5);
    near(s.bearings[1].vertical, -25);
  });

  it('two forces a hair apart are one place, and carry what the two carry', () => {
    const two = solved({ segments, bearings: [4, 25], forces: [{ x: 15, v: 300, h: 0 }, { x: 15 + 0.5e-9 * 30, v: 200, h: 100 }] });
    const one = solved({ segments, bearings: [4, 25], forces: [{ x: 15, v: 500, h: 100 }] });
    expect(two.breaks).toEqual(one.breaks);
    expect(two.bearings).toEqual(one.bearings);
    expect(two.extremes).toEqual(one.extremes);
    expect(two.loadScale).toBe(300 + Math.hypot(200, 100));
  });
});

describe('shaft: what is refused, and at which limit', () => {
  const seg: ShaftSegment = { L: 10, EI: 3e7, Z: 2 };
  const long: ShaftSegment = { L: 20, EI: 8e7, Z: 4 };
  const base: ShaftModel = { segments: [seg, long], bearings: [4, 25], forces: [{ x: 15, v: 500, h: 200 }], couples: [{ x: 8, v: 100, h: 0 }] };

  it('the shaft as it stands is solved', () => {
    expect(issuesOf(base)).toEqual([]);
  });

  it('no segment', () => {
    expect(issuesOf({ ...base, segments: [] })).toEqual([{ code: 'no-segments' }]);
  });

  it('a length that is not a positive number, or not of a size the engine takes: named by its segment', () => {
    for (const bad of [0, -3, Number.NaN, Number.POSITIVE_INFINITY, 1e61, 1e-61]) {
      expect(issuesOf({ ...base, segments: [seg, { ...long, L: bad }] }), String(bad)).toEqual([{ code: 'length', where: { list: 'segments', index: 1 } }]);
    }
    // At the limits themselves, a length is one the engine takes (and the forces and the bearings with it).
    expect(codesOf({ segments: [{ L: 1e60, EI: 1 }], bearings: [0, 1e60] })).toEqual([]);
    expect(codesOf({ segments: [{ L: 1e-60, EI: 1 }], bearings: [0, 1e-60] })).toEqual([]);
    // Each length one the engine takes, and all of them together not: no one segment is at fault.
    expect(issuesOf({ segments: [{ L: 6e59, EI: 1 }, { L: 6e59, EI: 1 }], bearings: [0, 1e60] })).toEqual([{ code: 'length' }]);
  });

  it('a stiffness that is not a positive number, or not of a size the engine takes: named by its segment', () => {
    for (const bad of [0, -3e7, Number.NaN, Number.POSITIVE_INFINITY, 1e61, 1e-61]) {
      expect(issuesOf({ ...base, segments: [{ ...seg, EI: bad }, long] }), String(bad)).toEqual([{ code: 'stiffness', where: { list: 'segments', index: 0 } }]);
    }
  });

  it('a force, a couple, a weight, a section modulus or a bearing that is not a number, or not of a size the engine takes', () => {
    const one = (m: ShaftModel) => issuesOf(m);
    for (const bad of [Number.NaN, Number.POSITIVE_INFINITY, 1e61, -1e61, 1e-61]) {
      expect(one({ ...base, forces: [{ x: 15, v: bad, h: 0 }] }), String(bad)).toEqual([{ code: 'number', where: { list: 'forces', index: 0 } }]);
      expect(one({ ...base, forces: [{ x: 15, v: 1, h: 0 }, { x: 15, v: 0, h: bad }] })).toEqual([{ code: 'number', where: { list: 'forces', index: 1 } }]);
      expect(one({ ...base, couples: [{ x: 8, v: bad, h: 0 }] })).toEqual([{ code: 'number', where: { list: 'couples', index: 0 } }]);
      expect(one({ ...base, segments: [seg, { ...long, w: bad }] })).toEqual([{ code: 'number', where: { list: 'segments', index: 1 } }]);
    }
    for (const bad of [Number.NaN, Number.POSITIVE_INFINITY, 1e61, 1e-61, -2]) {
      expect(one({ ...base, segments: [{ ...seg, Z: bad }, long] }), String(bad)).toEqual([{ code: 'number', where: { list: 'segments', index: 0 } }]);
    }
    for (const bad of [Number.NaN, Number.POSITIVE_INFINITY]) {
      expect(one({ ...base, bearings: [4, bad] })).toEqual([{ code: 'number', where: { list: 'bearings', index: 1 } }]);
      expect(one({ ...base, forces: [{ x: bad, v: 1, h: 1 }] })).toEqual([{ code: 'number', where: { list: 'forces', index: 0 } }]);
      expect(one({ ...base, couples: [{ x: bad, v: 1, h: 1 }] })).toEqual([{ code: 'number', where: { list: 'couples', index: 0 } }]);
    }
    // A load of exactly nothing is none, and is taken; so is a weight the other way up, and a load at the limit of size.
    expect(codesOf({ ...base, forces: [{ x: 15, v: 0, h: 0 }, { x: 3, v: -1e60, h: 1e-60 }], segments: [{ ...seg, w: -0.4 }, long] })).toEqual([]);
  });

  it('what is not a number at all where one must be — a text, nothing — is refused as that, and never worked on', () => {
    // A link can ask for anything. "3" is three to a comparison and a text to a sum: a shaft is not added up out of it.
    const odd = (v: unknown) => v as number;
    expect(issuesOf({ ...base, segments: [{ ...seg, L: odd('10') }, long] })).toEqual([{ code: 'length', where: { list: 'segments', index: 0 } }]);
    expect(issuesOf({ ...base, segments: [{ ...seg, EI: odd('3e7') }, long] })).toEqual([{ code: 'stiffness', where: { list: 'segments', index: 0 } }]);
    expect(issuesOf({ ...base, segments: [{ ...seg, Z: odd('2') }, long] })).toEqual([{ code: 'number', where: { list: 'segments', index: 0 } }]);
    expect(issuesOf({ ...base, segments: [seg, { ...long, w: odd('0.3') }] })).toEqual([{ code: 'number', where: { list: 'segments', index: 1 } }]);
    expect(issuesOf({ ...base, forces: [{ x: 15, v: odd('500'), h: 0 }] })).toEqual([{ code: 'number', where: { list: 'forces', index: 0 } }]);
    expect(issuesOf({ ...base, forces: [{ x: odd(undefined), v: 1, h: 0 }] })).toEqual([{ code: 'number', where: { list: 'forces', index: 0 } }]);
    expect(issuesOf({ ...base, couples: [{ x: 8, v: 1, h: odd(null) }] })).toEqual([{ code: 'number', where: { list: 'couples', index: 0 } }]);
    expect(issuesOf({ ...base, bearings: [odd('4'), 25] })).toEqual([{ code: 'number', where: { list: 'bearings', index: 0 } }]);
    expect(issuesOf({ ...base, bearings: odd(undefined) as unknown as [number, number] })).toEqual([
      { code: 'number', where: { list: 'bearings', index: 0 } },
      { code: 'number', where: { list: 'bearings', index: 1 } },
    ]);
    expect(issuesOf(odd(undefined) as unknown as ShaftModel)).toEqual([{ code: 'no-segments' }]);
    // What may be left out is: no forces, no couples, no weight, no section modulus.
    expect(codesOf({ segments: [{ L: 10, EI: 3e7 }], bearings: [0, 10] })).toEqual([]);
  });

  it('a force, a couple or a bearing off the shaft', () => {
    expect(issuesOf({ ...base, forces: [{ x: 30.001, v: 1, h: 0 }] })).toEqual([{ code: 'outside', where: { list: 'forces', index: 0 } }]);
    expect(issuesOf({ ...base, forces: [{ x: 15, v: 1, h: 0 }, { x: -0.001, v: 1, h: 0 }] })).toEqual([{ code: 'outside', where: { list: 'forces', index: 1 } }]);
    expect(issuesOf({ ...base, couples: [{ x: 31, v: 1, h: 0 }] })).toEqual([{ code: 'outside', where: { list: 'couples', index: 0 } }]);
    expect(issuesOf({ ...base, bearings: [-2, 25] })).toEqual([{ code: 'outside', where: { list: 'bearings', index: 0 } }]);
    // A load of no size is off the shaft all the same: it is where it was entered.
    expect(codesOf({ ...base, forces: [{ x: 99, v: 0, h: 0 }] })).toEqual(['outside']);
    // With a length at fault there is no "off the shaft" to say: the length alone is named.
    expect(codesOf({ ...base, segments: [seg, { ...long, L: Number.NaN }], forces: [{ x: 1e9, v: 1, h: 0 }] })).toEqual(['length']);
  });

  it('everything that is wrong with what was entered, at once', () => {
    expect(issuesOf({ segments: [{ L: -1, EI: 0, Z: -1 }, seg], bearings: [Number.NaN, 4], forces: [{ x: 3, v: Number.NaN, h: 0 }], couples: [{ x: Number.NaN, v: 1, h: 1 }] })).toEqual([
      { code: 'length', where: { list: 'segments', index: 0 } },
      { code: 'stiffness', where: { list: 'segments', index: 0 } },
      { code: 'number', where: { list: 'segments', index: 0 } },
      { code: 'number', where: { list: 'bearings', index: 0 } },
      { code: 'number', where: { list: 'forces', index: 0 } },
      { code: 'number', where: { list: 'couples', index: 0 } },
    ]);
  });

  it('the bearings: at one place, within a hair, or closer than a thousandth of the shaft — the one further right is named', () => {
    expect(CLOSE).toBe(1e-3);
    expect(issuesOf({ ...base, bearings: [12, 12] })).toEqual([{ code: 'bearings', where: { list: 'bearings', index: 1 } }]);
    expect(issuesOf({ ...base, bearings: [12 + 1e-9, 12] })).toEqual([{ code: 'bearings', where: { list: 'bearings', index: 1 } }]);
    expect(issuesOf({ ...base, bearings: [12, 12 + 0.999e-3 * 30] })).toEqual([{ code: 'bearings', where: { list: 'bearings', index: 1 } }]);
    expect(issuesOf({ ...base, bearings: [12 + 0.999e-3 * 30, 12] })).toEqual([{ code: 'bearings', where: { list: 'bearings', index: 0 } }]);
    // A thousandth apart they are two, entered either way round, anywhere along the shaft.
    for (const at of [0, 5, 10, 12, 29.97]) {
      expect(codesOf({ ...base, bearings: [at, at + 1e-3 * 30] }), String(at)).toEqual([]);
      expect(codesOf({ ...base, bearings: [at + 1e-3 * 30, at] }), String(at)).toEqual([]);
    }
  });

  it('…and a thousandth apart the shaft is right: an overhung force a thousand times the span away, against the tables', () => {
    // Bearings at 0 and ℓ, the force at the tip, c = 999 ℓ past them: −Pc/ℓ and P(ℓ + c)/ℓ, Pc²(ℓ + c)/3EI, Pcℓ/3EI.
    const l = 0.03;
    const c = 30 - l;
    const s = solved({ segments: [{ L: 30, EI: 3e7, Z: 2 }], bearings: [0, l], forces: [{ x: 30, v: 0, h: 500 }] });
    near(s.bearings[0].horizontal, (-500 * c) / l, (500 * c) / l, 1e-10);
    near(s.bearings[1].horizontal, (500 * 30) / l, (500 * 30) / l, 1e-10);
    near(s.at(30).horizontal.v, (-500 * c * c * 30) / (3 * 3e7), (500 * 30 ** 3) / 3e7, 1e-10);
    near(s.bearings[1].thetaHorizontal, (-500 * c * l) / (3 * 3e7), (500 * c * l) / 3e7, 1e-10);
    near(s.bearings[0].thetaHorizontal, (500 * c * l) / (6 * 3e7), (500 * c * l) / 3e7, 1e-10);
    near(s.extremes.M.value, 500 * c, 500 * c, 1e-10);
    // …and the other way round: both bearings at the far end, the force on the near tip.
    const t = solved({ segments: [{ L: 30, EI: 3e7, Z: 2 }], bearings: [30, 30 - l], forces: [{ x: 0, v: 0, h: 500 }] });
    near(t.bearings[1].horizontal, (-500 * c) / l, (500 * c) / l, 1e-10);
    near(t.at(0).horizontal.v, (-500 * c * c * 30) / (3 * 3e7), (500 * 30 ** 3) / 3e7, 1e-10);
  });

  it('a segment shorter than a millionth of the shaft: named; at a millionth it is taken', () => {
    expect(SHORT).toBe(1e-6);
    const at = (2 * 10 * SHORT) / (1 - SHORT);
    const shaft = (e: number): ShaftModel => ({ segments: [seg, { L: e, EI: 5e6 }, seg], bearings: [0, 20], forces: [{ x: 10, v: 100, h: 0 }] });
    expect(codesOf(shaft(at))).toEqual([]);
    expect(issuesOf(shaft(at * 0.99))).toEqual([{ code: 'short-segment', where: { list: 'segments', index: 1 } }]);
    expect(issuesOf({ segments: [{ L: 1e-5, EI: 3e7 }, seg, seg, { L: 1e-5, EI: 3e7 }], bearings: [0, 20] })).toEqual([
      { code: 'short-segment', where: { list: 'segments', index: 0 } },
      { code: 'short-segment', where: { list: 'segments', index: 3 } },
    ]);
    // One segment is the whole shaft: never short.
    expect(codesOf({ segments: [{ L: 1e-30, EI: 1 }], bearings: [0, 1e-30] })).toEqual([]);
  });

  it('the stiffest segment more than a million times the softest: both are named, the stiffest first; at a million they are taken', () => {
    expect(STIFF).toBe(1e6);
    const shaft = (soft: number): ShaftModel => ({ segments: [{ L: 10, EI: soft }, { L: 10, EI: 3e7 }, { L: 10, EI: 3e7 }], bearings: [0, 30], forces: [{ x: 15, v: 100, h: 0 }] });
    expect(codesOf(shaft(30))).toEqual([]);
    expect(issuesOf(shaft(29.9))).toEqual([
      { code: 'stiffness', where: { list: 'segments', index: 1 } },
      { code: 'stiffness', where: { list: 'segments', index: 0 } },
    ]);
  });

  it('…and a million apart the shaft is right: a middle third a million times stiffer, and an overhang a million times softer', () => {
    // The thirds of the unit-load case above: (PL³/6)[1/(27 EI₁) + 19/(216 EI₂)] and (PL²/4)[1/(9 EI₁) + 5/(36 EI₂)].
    const [k1, k2] = [40, 4e7];
    const s = solved({ segments: [{ L: L / 3, EI: k1 }, { L: L / 3, EI: k2 }, { L: L / 3, EI: k1 }], bearings: [0, L], forces: [{ x: L / 2, v: P, h: 0 }] });
    near(s.at(L / 2).vertical.v, -((P * L ** 3) / 6) * (1 / (27 * k1) + 19 / (216 * k2)));
    near(s.bearings[0].thetaVertical, -((P * L * L) / 4) * (1 / (9 * k1) + 5 / (36 * k2)));
    // The neck of the overhung pulley: Pc²ℓ/3EI₁ + Pc³/3EI₂. The soft neck is all of the tip's deflection but a part in 10⁵…
    const [l, c] = [28, 9];
    const t = solved({ segments: [{ L: l, EI: k2 }, { L: c, EI: k1 }], bearings: [0, l], forces: [{ x: l + c, v: P, h: 0 }] });
    near(t.at(l + c).vertical.v, -((P * c * c * l) / (3 * k2) + (P * c ** 3) / (3 * k1)));
    // …and none of the slope at the bearings, which is the stiff span's own: right to its own figures.
    near(t.bearings[1].thetaVertical, (-P * c * l) / (3 * k2), (P * c * l) / k2, 1e-12);
    near(t.bearings[0].thetaVertical, (P * c * l) / (6 * k2), (P * c * l) / k2, 1e-12);
    // A neck with nothing on it does not bend: the slope of the bearing all along it, and a straight line down to its tip.
    const idle = solved({ segments: [{ L: c, EI: k1 }, { L: l, EI: k2 }, { L: c, EI: k1 }], bearings: [c, c + l], forces: [{ x: c + l / 2, v: P, h: 0 }] });
    const turn = (P * l * l) / (16 * k2);
    for (const x of [c + l, c + l + 3, c + l + c]) expect(idle.at(x).vertical.theta).toBe(idle.bearings[1].thetaVertical);
    for (const x of [0, 4, c]) expect(idle.at(x).vertical.theta).toBe(idle.bearings[0].thetaVertical);
    near(idle.bearings[1].thetaVertical, turn, turn, 1e-12);
    near(idle.at(c + l + c).vertical.v, turn * c, turn * c, 1e-12);
    near(idle.at(0).vertical.v, turn * c, turn * c, 1e-12);
    expect(idle.at(c + l + c, 'left').vertical.M).toBe(0);
    expect(idle.at(2).vertical.M).toBe(0);
  });

  it('what is wrong with the shaft itself, at once: its bearings, a short segment, its stiffness', () => {
    expect(issuesOf({ segments: [{ L: 1e-5, EI: 1 }, { L: 30, EI: 3e7 }], bearings: [7, 7], forces: [{ x: 15, v: 1, h: 0 }] })).toEqual([
      { code: 'short-segment', where: { list: 'segments', index: 0 } },
      { code: 'stiffness', where: { list: 'segments', index: 1 } },
      { code: 'stiffness', where: { list: 'segments', index: 0 } },
      { code: 'bearings', where: { list: 'bearings', index: 1 } },
    ]);
    // Bearings that are two places and still too close are said with the rest, not after it.
    expect(codesOf({ segments: [{ L: 10, EI: 1 }, { L: 20, EI: 3e7 }], bearings: [7 + 0.7e-3 * 30, 7], forces: [{ x: 15, v: 1, h: 0 }] })).toEqual(['stiffness', 'stiffness', 'bearings']);
  });

  it('a shaft whose results are past the largest number there is: refused for its lengths, never returned with something in it that is not a number', () => {
    // Every entry one the engine takes; the deflection under its weight, w × length⁴ ÷ EI, is not a number a double holds.
    expect(issuesOf({ segments: [{ L: 1e60, EI: 1e-60, w: 1e60 }], bearings: [0, 5e59] })).toEqual([{ code: 'length' }]);
    // With a force for a load it is one — 8 × 10²⁹⁸ at the tip — and is returned.
    const big = solved({ segments: [{ L: 1e60, EI: 1e-60 }], bearings: [0, 5e59], forces: [{ x: 1e60, v: 1e60, h: 0 }] });
    near(big.at(1e60).vertical.v, (-1e60 * 5e59 * 5e59 * 1e60) / 3e-60);
  });
});

describe('shaft: three shafts no table lists, against an exact solver by another method', () => {
  // The numbers are the UNIT-LOAD METHOD's, worked in exact fractions (every input a double, every sum and product
  // an integer times a power of two, one division at the very end) and rounded once. Nothing of engine.ts is in
  // them, and nothing of this file.
  type Pins = {
    /** By planes, then by bearings (left, right). */
    reactions: number[][];
    /** By bearings: the slope in the vertical plane and in the horizontal one. */
    slopes: number[][];
    /** At each force: the deflection by planes, then the slope by planes. */
    atForces: number[][];
    /** At points that are no place of the shaft: x; V, M, θ, v of the vertical plane; the same of the horizontal one; the stress. */
    points: number[][];
    /** The largest sizes and where: at a place, that place; elsewhere, found on the exact shaft by a search of its own. */
    largest: Record<'M' | 'theta' | 'v', { value: number; x: number }>;
  };
  const held = (model: ShaftModel, pins: Pins, tol: number) => {
    const s = solved(model);
    /** Against the value itself, or — for one that is all but nothing beside the others of its kind — against the largest of them. */
    const tight = (got: number, want: number, among: number[]) => near(got, want, Math.max(Math.abs(want), 1e-3 * Math.max(...among.map(Math.abs))), tol);
    const reactions = pins.reactions.flat();
    const slopes = [...pins.slopes.flat(), ...pins.atForces.flatMap((f) => [f[2], f[3]]), ...pins.points.flatMap((p) => [p[3], p[7]])];
    const deflections = [...pins.atForces.flatMap((f) => [f[0], f[1]]), ...pins.points.flatMap((p) => [p[4], p[8]])];
    const shears = pins.points.flatMap((p) => [p[1], p[5]]);
    const moments = pins.points.flatMap((p) => [p[2], p[6]]);
    s.bearings.forEach((b, k) => {
      tight(b.vertical, pins.reactions[0][k], reactions);
      tight(b.horizontal, pins.reactions[1][k], reactions);
      tight(b.radial, Math.hypot(pins.reactions[0][k], pins.reactions[1][k]), reactions);
      tight(b.thetaVertical, pins.slopes[k][0], slopes);
      tight(b.thetaHorizontal, pins.slopes[k][1], slopes);
      tight(b.theta, Math.hypot(pins.slopes[k][0], pins.slopes[k][1]), slopes);
    });
    (model.forces ?? []).forEach((f, i) => {
      const here = s.at(f.x);
      const [vv, vh, tv, th] = pins.atForces[i];
      tight(here.vertical.v, vv, deflections);
      tight(here.horizontal.v, vh, deflections);
      tight(here.vertical.theta, tv, slopes);
      tight(here.horizontal.theta, th, slopes);
      tight(here.v, Math.hypot(vv, vh), deflections);
      tight(here.theta, Math.hypot(tv, th), slopes);
    });
    for (const [x, V1, M1, t1, v1, V2, M2, t2, v2, sigma] of pins.points) {
      const here = s.at(x);
      tight(here.vertical.V, V1, shears);
      tight(here.vertical.M, M1, moments);
      tight(here.vertical.theta, t1, slopes);
      tight(here.vertical.v, v1, deflections);
      tight(here.horizontal.V, V2, shears);
      tight(here.horizontal.M, M2, moments);
      tight(here.horizontal.theta, t2, slopes);
      tight(here.horizontal.v, v2, deflections);
      tight(here.sigma ?? 0, sigma, [sigma]);
    }
    for (const key of ['M', 'theta', 'v'] as const) {
      tight(s.extremes[key].value, pins.largest[key].value, [pins.largest[key].value]);
      // Where a largest value is: to a millionth of the shaft (the top of a curve is flat, and the exact search stops there too).
      near(s.extremes[key].x, pins.largest[key].x, s.L, 1e-6);
    }
    return s;
  };
  /** Millimetres and newtons: steel, E = 200 000 MPa, 7.85e-6 kg/mm³. */
  const metric = (d: number, bore = 0): Omit<ShaftSegment, 'L'> => {
    const I = (Math.PI * (d ** 4 - bore ** 4)) / 64;
    return { EI: 200000 * I, Z: I / (d / 2), w: (7.85e-6 * 9.80665 * Math.PI * (d * d - bore * bore)) / 4 };
  };

  it('a gearbox shaft in inches and pounds: five diameters, one bored, its own weight, two gears and an overhung pulley, an axial force on each gear', () => {
    const model: ShaftModel = {
      segments: [{ L: 3, ...round(1.25, 0, true) }, { L: 5, ...round(1.75, 0, true) }, { L: 9, ...round(2.5, 0, true) }, { L: 4, ...round(1.75, 0.75, true) }, { L: 3.5, ...round(1.25, 0, true) }],
      bearings: [1.5, 20.25],
      forces: [{ x: 8, v: 1150, h: -420 }, { x: 15.5, v: -300, h: 250 }, { x: 23.75, v: 380, h: 610 }],
      couples: [{ x: 8, v: 950, h: 0 }, { x: 15.5, v: 0, h: -640 }],
    };
    const s = held(
      model,
      {
        reactions: [[663.9585899344821, 586.4707453053454], [-359.06666666666666, 799.0666666666667]],
        slopes: [[-0.0010418559847420478, 0.0006945639812287433], [0.00010044741570171556, -0.0007411650060966016]],
        atForces: [
          [-0.0036281197575950483, 0.0028108455973513947, 0.00016465117959399745, 0.00004045409730975951],
          [-0.0013221628608984886, 0.002010834189865986, 0.00036669557291442505, -0.00024351744913453583],
          [-0.0006250062288841348, -0.004158800575243043, -0.0003828897957569026, -0.0015156645882126259],
        ],
        points: [
          [1.715, 663.3617192371005, 142.2392802129089, -0.001037468342925951, -0.00022368545401753708, -359.06666666666666, -77.19933333333336, 0.0006921760926102575, 0.0001491601239465217, 844.0191960575796],
          [7.595, 659.780077417337, 4033.2625463670634, 0.00003825244317835774, -0.0036689342319710366, -359.06666666666666, -2188.5113333333334, 0.00010904684466241515, 0.0027804227757579837, 8721.316115336509],
          [12.74, -497.09482892781637, 1009.8268227018765, 0.00035070995472848474, -0.0023279053834555138, 60.93333333333333, -2045.1093333333333, -0.00014618369618689872, 0.002550541645639998, 1486.8752652993044],
          [16.66, -202.55193244673455, -601.4808295922433, 0.00035659243903809497, -0.0009021838960097407, -189.06666666666666, -1456.2506666666668, -0.00027160837722196927, 0.0017125034727138732, 1027.1169921958247],
          [22.785, 380.5968706973817, -367.2118166230047, -0.00033190297937415536, -0.00027192150037836786, 610, -588.6499999999999, -0.001433941171130636, -0.0027224719467792324, 3618.279084649766],
        ],
        largest: { M: { value: 4892.937335606834, x: 8 }, theta: { value: 0.00156328152667375, x: 24.5 }, v: { value: 0.005373537684141891, x: 24.5 } },
      },
      1e-12,
    );
    // The largest moment is just right of the first gear, where its couple has been taken up; the tip of the overhang moves and turns the most.
    expect([s.extremes.M.x, s.extremes.theta.x, s.extremes.v.x]).toEqual([8, 24.5, 24.5]);
  });

  it('the same kind of shaft in millimetres and newtons: a bored middle, a force on the very end, a gear with a couple in both planes', () => {
    held(
      {
        segments: [{ L: 60, ...metric(25) }, { L: 180, ...metric(40, 18) }, { L: 90, ...metric(30) }],
        bearings: [30, 285],
        forces: [{ x: 0, v: 900, h: 0 }, { x: 150, v: 2400, h: -1300 }, { x: 330, v: -350, h: 800 }],
        couples: [{ x: 150, v: -48000, h: 21000 }],
      },
      {
        reactions: [[2159.619168835279, 811.4323790665142], [-747.0588235294117, 247.05882352941177]],
        slopes: [[-0.0002962425562027482, 0.0003658405595677419], [0.0005743366829008168, -0.0005254161662391565]],
        atForces: [
          [0.006774127380767778, -0.010975216787032257, -0.00019059063365559482, 0.0003658405595677419],
          [-0.03484665482827469, 0.027602832236802124, -0.00010904044171526368, 0.00006895949117582107],
          [0.027178544750907273, -0.02669950238812643, 0.0006187961409931726, -0.0006272753298179694],
        ],
        points: [
          [23.1, -900.8729155116093, -20800.082174159088, -0.00025322561178256524, 0.001889233380428564, 0, 0, 0.0003658405595677419, -0.0025242998610174186, 13.55954542483471],
          [102.3, 1254.088448707739, 63837.51811526512, -0.0002945161391129376, -0.02475192679433826, -747.0588235294117, -54012.35294117647, 0.00021111602667749722, 0.020642698891537307, 13.877861484680533],
          [171.6, -1151.2579842177659, 146720.5937098427, 0.000033585916565904145, -0.035621478634494635, 552.9411764705883, -98703.52941176471, -0.00002484903321078333, 0.028059958661692166, 29.34699031491912],
          [224.4, -1155.3314569229126, 85826.63246372878, 0.0002883430739020429, -0.02653559776914468, 552.9411764705883, -69508.23529411765, -0.0002090978287200379, 0.02160234872617332, 18.32912143136087],
          [306.90000000000003, -348.74300166328254, 8070.481669210902, 0.0006070672521094823, 0.01297469339995463, 800, -18479.99999999997, -0.0006004343084464681, -0.012416118133891917, 7.607518751953834],
        ],
        // The deflection is largest between the gear and the right bearing, at no place of the shaft: 166.0028 mm.
        largest: { M: { value: 204154.24855062808, x: 150 }, theta: { value: 0.0008811259861712652, x: 330 }, v: { value: 0.04546352964859533, x: 166.00276759948304 } },
      },
      1e-12,
    );
  });

  it('a shaft at every limit at once: a notch a millionth of it long and a million times softer, between bearings a thousandth of it apart', () => {
    // The two bearings are a clamp: 35,015 and −34,990 under forces of 40 and 15. Every number of it to nine figures or better.
    const s = held(
      {
        segments: [{ L: 12, EI: 6e7, Z: 3 }, { L: 30e-6, EI: 60, Z: 0.01 }, { L: 18 - 30e-6, EI: 6e7, Z: 3 }],
        bearings: [12 - 0.012, 12.018],
        forces: [{ x: 0, v: 40, h: 25 }, { x: 30, v: -15, h: 60 }],
        couples: [{ x: 21, v: 300, h: -120 }],
      },
      {
        reactions: [[35014.999999998676, -34989.999999998676], [-29948.999999998865, 30033.999999998865]],
        slopes: [[0.00001780625710116763, 0.00019793594834371388], [-0.000011818848251144875, -0.00013235718173748112]],
        atForces: [
          [-0.0005963105617447976, -0.0026121368685044417, 0.00006571030510116763, 0.00022787597834371387],
          [0.0008778977382619127, -0.004560572996059386, 0.00007351019224885512, -0.00031199734373748113],
        ],
        points: [
          [2.1, -40, -84, 0.00006424030510116763, -0.0004593479210323455, -25, -52.5, 0.00022695722834371388, -0.0021342404389826427, 33.01893396219811],
          [9.3, -40, -372, 0.00003688030510116762, -0.00007457772430393855, -25, -232.50000000000003, 0.00020985722834371387, -0.0005487483949079027, 146.22670754687738],
          [15.600000000000001, -15, 516, 0.000020590192248855132, 0.000016666969878399072, 60, -983.9999999999999, -0.00019751734373748113, -0.0005946352462396575, 370.36198509026275],
          [20.400000000000002, -15, 443.99999999999994, 0.00005899019224885514, 0.00020996389267290374, 60, -695.9999999999999, -0.0002647173437374811, -0.001713214496179567, 275.1872090050698],
          [27.900000000000002, -15, 31.499999999999968, 0.00007295894224885511, 0.0007239122095393172, 60, -125.99999999999987, -0.0003097923437374811, -0.003906922074210676, 43.29260906898539],
        ],
        largest: { M: { value: 1327.404022632145, x: 12.018 }, theta: { value: 0.0003205403108248752, x: 30 }, v: { value: 0.004644300861403303, x: 30 } },
      },
      1e-9,
    );
    // The notch turns the shaft by more than the eighteen units of shaft beside it do — and is a place like any other: no deflection at either bearing.
    expect(s.at(11.988).v).toBe(0);
    expect(s.at(12.018).v).toBe(0);
  });
});
