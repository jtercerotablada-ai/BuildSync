import { GL_W, GL_X, bracketFrom, safeNewton } from './numerics';
import type { CableShape, Setup } from './types';

/**
 * ─────────────────────────────────────────────────────────────────────────────
 * CABLE SAG AND PRETENSION — the shape of one cable, for a given H
 * ─────────────────────────────────────────────────────────────────────────────
 * The forward problem the whole engine rests on: given the span, the loads, the
 * elasticity and the HORIZONTAL TENSION H, find the cable.
 *
 * THE EQUATION. With z the height, p = dz/dx the slope and T = H·r the tension
 * (r = √(1 + p²)), a cable under q per horizontal length and w per length
 * (UNSTRETCHED: a stretched element carries the same weight over a longer run)
 * is in equilibrium when
 *
 *     H·dp/dx = λ(p) = q + w·r / (1 + e·r),        e = H / EA        (e = 0: rigid)
 *
 * (the weight of the cable per unit horizontal length is w·ds0/dx = w·r/(1 + T/EA)).
 * So  dx = H·dp/λ  and  dz = p·dx  and the stretched and unstretched lengths are
 *
 *     s  = H ∫ r dp / λ ,          s0 = H ∫ r dp / (λ·(1 + e·r)).
 *
 * Nothing in it is a closed form, and nothing needs to be: with q only it is the
 * parabola, with w only the (elastic) catenary, with both the exact combined
 * shape, and ONE integrator handles all three. The integrals are done by
 * Gauss–Legendre on panels no wider than 0.75 in asinh(p) (an analytic
 * integrand, so exact to rounding), `quad`.
 *
 * THE UNKNOWNS. The cable leaves A with the slope pA and arrives at B with pB. Write
 * c = h/L (the chord's slope) and s = p − c. The two boundary conditions are
 *
 *     ∫ dp/λ over [pA, pB]  =  L / H            (the run)
 *     ∫ (p − c)/λ dp        =  0                (the rise: the cable returns to the chord's height)
 *
 * The second does not involve H: for a given pA it fixes pB (`chordBeta`: the
 * chord's slope is the average of p over the cable, so pB is found by a monotone
 * bracketed solve). The first then fixes pA, i.e. δ = c − pA > 0, by another
 * (`forward`). Working in s = p − c and not in p keeps the integrals free of the
 * cancellation that p = c + s would bring to a very taut cable: a sag/span of 1e-6
 * on a steep span loses no figure.
 */

interface Kernel {
  q: number;
  w: number;
  /** H / EA, or 0 for an inextensible cable. */
  e: number;
}

interface Quad {
  /** ∫ dp / λ */
  F: number;
  /** ∫ (p − c) dp / λ */
  Psi: number;
  /** ∫ r dp / λ  (stretched length / H) */
  S: number;
  /** ∫ r dp / (λ (1 + e r))  (unstretched length / H) */
  U: number;
}

const ZERO: Quad = { F: 0, Psi: 0, S: 0, U: 0 };

/**
 * The widest panel, in asinh(slope). The integrands are analytic in u = asinh(p) at least π/2 from the real axis (their poles are at
 * cosh u = −q/(q·e + w)), so 8 nodes on a panel of half-width 0.375 give an error of order (π/2 / 0.375 + …)^−16 of the integral:
 * ~2e-15 in theory, and 3e-13 at worst when measured against an independent solver (the single-panel branch, half-slope ~0.37).
 * (With q = 0 or w = 0 the integrands are entire or constant: exact.)
 */
const PANEL = 0.75;

/**
 * The four integrals over s from sA to sB, where p = c + s. Orientation counts:
 * from the larger to the smaller gives the negative.
 */
export function quad(k: Kernel, c: number, sA: number, sB: number): Quad {
  if (sA === sB) return ZERO;
  const pA = c + sA;
  const pB = c + sB;
  const du = Math.abs(Math.asinh(pB) - Math.asinh(pA));
  let F = 0;
  let Psi = 0;
  let S = 0;
  let U = 0;
  const add = (s: number, p: number, weight: number, wide: boolean) => {
    const r = Math.hypot(1, p);
    const er = k.e * r;
    const d = k.q * (1 + er) + k.w * r;
    const wt = wide ? weight * r : weight;
    const inv = (1 + er) / d;
    F += wt * inv;
    Psi += wt * s * inv;
    S += wt * r * inv;
    U += (wt * r) / d;
  };
  if (du <= PANEL) {
    const half = 0.5 * (sB - sA);
    const mid = 0.5 * (sA + sB);
    for (let j = 0; j < 4; j++) {
      const dx = half * GL_X[j];
      const wt = half * GL_W[j];
      add(mid - dx, c + (mid - dx), wt, false);
      add(mid + dx, c + (mid + dx), wt, false);
    }
  } else {
    const n = Math.min(400, Math.ceil(du / PANEL));
    const uA = Math.asinh(pA);
    const uB = Math.asinh(pB);
    const hu = (uB - uA) / n;
    const ha = 0.5 * hu;
    for (let i = 0; i < n; i++) {
      const m = uA + (i + 0.5) * hu;
      for (let j = 0; j < 4; j++) {
        const wt = ha * GL_W[j];
        for (const sign of [-1, 1]) {
          const p = Math.sinh(m + sign * ha * GL_X[j]);
          add(p - c, p, wt, true);
        }
      }
    }
  }
  return { F, Psi, S, U };
}

/** The kernel of a cable with the horizontal tension H. */
export function kernelOf(set: Setup, H: number): Kernel {
  return { q: set.q, w: set.w, e: set.EA === null ? 0 : H / set.EA };
}

/**
 * pB − c for a cable that leaves A with the slope pA = c − δ: the point past which
 * the cable has gone as far above the chord's slope as it began below it, weighted by
 * the load. For a parabola it is exactly δ. NaN if it cannot be found.
 */
export function chordBeta(k: Kernel, c: number, delta: number): number {
  let lo = 0;
  let hi = Number.POSITIVE_INFINITY;
  let b = delta;
  for (let i = 0; i < 100; i++) {
    const psi = quad(k, c, -delta, b).Psi;
    if (Number.isNaN(psi)) return Number.NaN;
    if (psi === 0) return b;
    if (psi < 0) lo = b;
    else hi = b;
    // dψ/dβ = β/λ(pB). Newton, kept inside the bracket; with no upper end yet, doubled.
    let next = b - psi / (b * inverseLoad(k, c + b));
    if (!(next > lo && next < hi)) next = hi === Number.POSITIVE_INFINITY ? 2 * b : 0.5 * (lo + hi);
    if (Math.abs(next - b) <= 1e-14 * next) return next;
    b = next;
  }
  return b;
}

/** 1/λ(p): the run per unit of slope and of H. */
function inverseLoad(k: Kernel, p: number): number {
  const r = Math.hypot(1, p);
  const er = k.e * r;
  return (1 + er) / (k.q * (1 + er) + k.w * r);
}

export interface Forward {
  set: Setup;
  H: number;
  k: Kernel;
  /** The chord's slope. */
  c: number;
  /** c − pA > 0 and pB − c > 0. */
  delta: number;
  beta: number;
  /** The four integrals over the whole cable (pA to pB). */
  total: Quad;
}

/** The cable for the horizontal tension H, or null where the solves do not close. */
export function forward(set: Setup, H: number): Forward | null {
  if (!(H > 0) || !Number.isFinite(H)) return null;
  const k = kernelOf(set, H);
  const c = set.h / set.L;
  const rc = Math.hypot(1, c);
  const lam = set.q + (set.w * rc) / (1 + k.e * rc);
  const t0 = Math.log((lam * set.L) / (2 * H));
  if (!Number.isFinite(t0)) return null;
  // f(t) = H·F(δ) − L with δ = e^t, and its derivative: dF/dδ = (1 + δ/β)/λ(pA), so df/dt = H·δ·(1 + δ/β)/λ(pA).
  const f = (t: number): number => {
    const d = Math.exp(t);
    const b = chordBeta(k, c, d);
    if (!Number.isFinite(b)) return Number.NaN;
    return H * quad(k, c, -d, b).F - set.L;
  };
  const fdf = (t: number): [number, number] => {
    const d = Math.exp(t);
    const b = chordBeta(k, c, d);
    if (!Number.isFinite(b)) return [Number.NaN, Number.NaN];
    return [H * quad(k, c, -d, b).F - set.L, H * d * (1 + d / b) * inverseLoad(k, c - d)];
  };
  const br = bracketFrom(f, t0, 0.5, -60, 80, true);
  if (!br) return null;
  const t = br.a === br.b ? br.a : safeNewton(fdf, br.a, br.b, br.fa, br.fb, 1e-14, 1e-14, 1e-14 * set.L);
  if (!Number.isFinite(t)) return null;
  const delta = Math.exp(t);
  const beta = chordBeta(k, c, delta);
  if (!Number.isFinite(beta)) return null;
  const total = quad(k, c, -delta, beta);
  // CLOSURE. A cable that does not come back to B (the run is not L, the chord's height is not reached) is no cable, whatever
  // the two nested solves reported: they close to ~1e-14 on every cable met in practice, and in the one corner that was found
  // where they did not (a strain of thousands of per cent on a span a hundred times as high as wide) they closed on a wrong
  // root. Better no answer ('solver') than a cable that violates its own boundary conditions.
  const run = H * total.F;
  const rise = H * total.Psi;
  if (!(Math.abs(run - set.L) <= 1e-7 * set.L) || !(Math.abs(rise) <= 1e-7 * set.L * Math.max(delta, beta))) return null;
  return { set, H, k, c, delta, beta, total };
}

const DEG = 180 / Math.PI;

/** Everything about the cable that `forward` found. Null where a number would not be finite. */
export function describe(fw: Forward): CableShape | null {
  const { set, H, k, c, delta, beta, total } = fw;
  const pA = c - delta;
  const pB = c + beta;
  const W = delta + beta;

  // Mid-span: the point where half the run has been covered; the sag is how far the chord is above the cable there.
  const half = (mu: number): [number, number] => [H * quad(k, c, -delta, -delta + mu).F - set.L / 2, H * inverseLoad(k, c - delta + mu)];
  const fb = H * total.F - set.L / 2;
  const mu = safeNewton(half, 0, W, -set.L / 2, fb, 1e-14, 0, 1e-14 * set.L);
  if (!Number.isFinite(mu)) return null;
  const sagMid = Math.max(0, -H * quad(k, c, -delta, -delta + mu).Psi);

  // The lowest point (where p = 0), also when it falls outside the span.
  const v = quad(k, 0, pA, 0);
  const vertex = { x: H * v.F, z: H * v.Psi, inside: pA < 0 && pB > 0 };
  const sagLow = vertex.inside ? Math.max(0, Math.min(0, set.h) - vertex.z) : 0;

  const TA = H * Math.hypot(1, pA);
  const TB = H * Math.hypot(1, pB);
  const high = set.h >= 0 ? TB : TA;
  const low = set.h >= 0 ? TA : TB;
  const max = Math.max(TA, TB);
  const reaction = { A: -H * pA, B: H * pB };
  const length = H * total.S;
  const unstretched = set.EA === null ? length : H * total.U;
  const shape: CableShape = {
    setup: set,
    H,
    slope: { A: pA, B: pB },
    tension: { A: TA, B: TB, high, low, max, maxAt: TA > TB ? 'A' : 'B', min: vertex.inside ? H : Math.min(TA, TB) },
    reaction,
    angle: { A: Math.atan(-pA) * DEG, B: Math.atan(pB) * DEG },
    sagMid,
    sagLow,
    vertex,
    length,
    unstretched,
    elongation: length - unstretched,
    strain: set.EA === null ? null : max / set.EA,
    load: reaction.A + reaction.B,
  };
  const numbers = [H, TA, TB, high, low, max, reaction.A, reaction.B, sagMid, sagLow, vertex.x, vertex.z, length, unstretched, pA, pB];
  return numbers.every(Number.isFinite) ? shape : null;
}

/** What a root-find on the length or on a tension needs, without the mid-span and the lowest point (those cost a solve of their own). */
export interface Light {
  pA: number;
  pB: number;
  high: number;
  low: number;
  length: number;
  unstretched: number;
}

export function lightAt(set: Setup, H: number): Light | null {
  const fw = forward(set, H);
  if (!fw) return null;
  const pA = fw.c - fw.delta;
  const pB = fw.c + fw.beta;
  const TA = H * Math.hypot(1, pA);
  const TB = H * Math.hypot(1, pB);
  const length = H * fw.total.S;
  const out: Light = { pA, pB, high: set.h >= 0 ? TB : TA, low: set.h >= 0 ? TA : TB, length, unstretched: set.EA === null ? length : H * fw.total.U };
  return Object.values(out).every(Number.isFinite) ? out : null;
}

/** The cable for the tension H, with everything about it; null where it cannot be found. */
export function shapeAt(set: Setup, H: number): CableShape | null {
  const fw = forward(set, H);
  return fw ? describe(fw) : null;
}

/**
 * The cable's curve as `n + 1` points from A to B, spaced evenly in asinh(slope) (so a
 * steep end is not starved of points). x from A, z in A's level. The ends are exactly
 * (0, 0) and (L, h). A shape that cannot be drawn gives just the chord.
 */
export function curveOf(shape: CableShape, n = 64): { x: number; z: number }[] {
  const { setup: set, H } = shape;
  const k = kernelOf(set, H);
  const pA = shape.slope.A;
  const pB = shape.slope.B;
  const uA = Math.asinh(pA);
  const uB = Math.asinh(pB);
  const points = [{ x: 0, z: 0 }];
  let x = 0;
  let z = 0;
  let prev = pA;
  for (let i = 1; i <= n; i++) {
    const p = i === n ? pB : Math.sinh(uA + ((uB - uA) * i) / n);
    const q = quad(k, 0, prev, p);
    x += H * q.F;
    z += H * q.Psi;
    prev = p;
    points.push(i === n ? { x: set.L, z: set.h } : { x, z });
  }
  return points.every((p) => Number.isFinite(p.x) && Number.isFinite(p.z)) ? points : [{ x: 0, z: 0 }, { x: set.L, z: set.h }];
}
