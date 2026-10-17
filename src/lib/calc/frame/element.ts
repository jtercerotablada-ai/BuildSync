import type { EndForce, ExtremeAt, MemberPiece, MemberStation, Poly } from './types';
import { zeros, type Mat } from './linalg';

/**
 * ─────────────────────────────────────────────────────────────────────────────
 * PLANE FRAME — one member: stiffness, loads, condensation, exact diagrams
 * ─────────────────────────────────────────────────────────────────────────────
 * Everything about a SINGLE straight prismatic Euler–Bernoulli member in its
 * local axes (x̄ from node i to node j, ȳ to the left; types.ts has the signs).
 * The local degrees of freedom are ordered [u_i, v_i, θ_i, u_j, v_j, θ_j].
 *
 *  — `localStiffness`: the 6 × 6 matrix.
 *  — `loadVector`: the EQUIVALENT NODAL LOADS p = ∫ q·N dx of the member's loads
 *    (N the Hermite shape functions for bending, the linear ones for the axial
 *    displacement). For an Euler–Bernoulli beam these are the EXACT fixed-end
 *    forces of any load (the shape functions are the exact deflections for unit
 *    end displacements, so Betti's reciprocal theorem gives the fixed-end
 *    force as the load's work on them). A distributed load that varies linearly
 *    over a stretch is a polynomial of degree 1; times a cubic it is of degree 4,
 *    which 3-point Gauss quadrature integrates exactly (it is exact to degree 5).
 *    A temperature change: uniform strain ε₀ = α·ΔT gives p = (−EAε₀, +EAε₀) on
 *    the axial degrees; a free curvature κ₀ gives (−EIκ₀, +EIκ₀) on the end rotations.
 *  — `condense`: static condensation of a moment hinge at either end. The end forces
 *    are f = k*·u − p*, with zero moment at a hinge, and the hinge's own rotation is
 *    recovered from the equation of the released moment.
 *  — `buildPieces`: the exact internal forces N, V, M and displacements u, v along the
 *    member as piecewise polynomials, from the end forces and the loads (closed
 *    form, no interpolation): V(x) = Fy_i + ∫q_ȳ + ΣP_ȳ;  M(x) = −M_i + ∫V − ΣC;
 *    N(x) = −Fx_i − ∫q_x̄ − ΣP_x̄;  v'' = M/EI + κ₀;  u' = N/EA + ε₀.
 *  — the stations (ends, jumps, zero shear, zero moment, zero axial force) and the
 *    extremes of every diagram.
 */

/* ── Polynomials (ascending coefficients) ─────────────────────────────── */

export function evalPoly(c: readonly number[], t: number): number {
  let s = 0;
  for (let k = c.length - 1; k >= 0; k--) s = s * t + c[k];
  return s;
}

export function derivPoly(c: readonly number[]): Poly {
  if (c.length <= 1) return [0];
  return c.slice(1).map((v, k) => v * (k + 1));
}

/**
 * The roots of a polynomial strictly inside (0, ell) where it changes sign. A coefficient c_k whose term c_k·ell^k is
 * under `tiny` counts as zero, so a polynomial that is rounding all over has no roots; the roots are found between the
 * roots of the derivative, by bisection. A root closer to an end than a billionth of ell is not reported (the end is a
 * station already).
 */
export function rootsOn(c: readonly number[], ell: number, tiny: number): number[] {
  let d = c.length - 1;
  while (d > 0 && !(Math.abs(c[d]) * Math.pow(ell, d) > tiny)) d--;
  if (d === 0) return [];
  const p = c.slice(0, d + 1);
  const margin = 1e-9 * ell;
  const out: number[] = [];
  if (d === 1) {
    const r = -p[0] / p[1];
    if (r > margin && r < ell - margin) out.push(r);
    return out;
  }
  const crit = rootsOn(derivPoly(p), ell, tiny / ell).filter((r) => r > 0 && r < ell);
  const cuts = [0, ...crit, ell];
  for (let k = 0; k + 1 < cuts.length; k++) {
    let lo = cuts[k];
    let hi = cuts[k + 1];
    let flo = evalPoly(p, lo);
    const fhi = evalPoly(p, hi);
    if (flo === 0 || fhi === 0 || flo * fhi > 0) continue;
    for (let it = 0; it < 200 && hi - lo > 1e-15 * ell; it++) {
      const mid = 0.5 * (lo + hi);
      const fm = evalPoly(p, mid);
      if (fm === 0) {
        lo = hi = mid;
        break;
      }
      if (fm * flo < 0) hi = mid;
      else {
        lo = mid;
        flo = fm;
      }
    }
    const r = 0.5 * (lo + hi);
    if (r > margin && r < ell - margin) out.push(r);
  }
  return out;
}

/* ── Stiffness and loads ──────────────────────────────────────────────── */

export function localStiffness(EA: number, EI: number, L: number): Mat {
  const k = zeros(6);
  const a = EA / L;
  const b = (12 * EI) / (L * L * L);
  const c = (6 * EI) / (L * L);
  const d = (4 * EI) / L;
  const e = (2 * EI) / L;
  k[0][0] = a;
  k[0][3] = -a;
  k[3][0] = -a;
  k[3][3] = a;
  k[1][1] = b;
  k[1][2] = c;
  k[1][4] = -b;
  k[1][5] = c;
  k[2][1] = c;
  k[2][2] = d;
  k[2][4] = -c;
  k[2][5] = e;
  k[4][1] = -b;
  k[4][2] = -c;
  k[4][4] = b;
  k[4][5] = -c;
  k[5][1] = c;
  k[5][2] = e;
  k[5][4] = -c;
  k[5][5] = d;
  return k;
}

/** A distributed load over [a, b], linear from (qy1, qx1) to (qy2, qx2): intensities along +ȳ and +x̄ per unit length. */
export interface LocalDist {
  a: number;
  b: number;
  qy1: number;
  qy2: number;
  qx1: number;
  qx2: number;
}
export interface LocalPoint {
  a: number;
  Px: number;
  Py: number;
}
export interface LocalMoment {
  a: number;
  /** Counter-clockwise. */
  C: number;
}
export interface LocalLoads {
  dist: LocalDist[];
  points: LocalPoint[];
  moments: LocalMoment[];
  /** Free thermal strain α·ΔT (summed over the temperature loads) and free curvature (about +ȳ: v'' = κ₀) = −α·ΔTg/h. */
  eps0: number;
  curv0: number;
}

export const NO_LOADS: LocalLoads = { dist: [], points: [], moments: [], eps0: 0, curv0: 0 };

const GAUSS: [number, number][] = [
  [0, 8 / 9],
  [Math.sqrt(3 / 5), 5 / 9],
  [-Math.sqrt(3 / 5), 5 / 9],
];

/** Hermite shape functions and their slopes at s = x/L. */
const shape = (s: number, L: number): number[] => [1 - 3 * s * s + 2 * s * s * s, L * (s - 2 * s * s + s * s * s), 3 * s * s - 2 * s * s * s, L * (-s * s + s * s * s)];
const slope = (s: number, L: number): number[] => [(-6 * s + 6 * s * s) / L, 1 - 4 * s + 3 * s * s, (6 * s - 6 * s * s) / L, -2 * s + 3 * s * s];

/** The equivalent nodal loads of a member's loads, local axes (see the header). EA and EI are only used by the temperature. */
export function loadVector(L: number, EA: number, EI: number, loads: LocalLoads): number[] {
  const p = [0, 0, 0, 0, 0, 0];
  for (const d of loads.dist) {
    const len = d.b - d.a;
    if (!(len > 0)) continue;
    for (const [g, w] of GAUSS) {
      const x = d.a + (len * (g + 1)) / 2;
      const wt = (w * len) / 2;
      const r = (x - d.a) / len;
      const qy = d.qy1 + (d.qy2 - d.qy1) * r;
      const qx = d.qx1 + (d.qx2 - d.qx1) * r;
      const s = x / L;
      const N = shape(s, L);
      p[0] += qx * (1 - s) * wt;
      p[3] += qx * s * wt;
      p[1] += qy * N[0] * wt;
      p[2] += qy * N[1] * wt;
      p[4] += qy * N[2] * wt;
      p[5] += qy * N[3] * wt;
    }
  }
  for (const q of loads.points) {
    const s = q.a / L;
    const N = shape(s, L);
    p[0] += q.Px * (1 - s);
    p[3] += q.Px * s;
    p[1] += q.Py * N[0];
    p[2] += q.Py * N[1];
    p[4] += q.Py * N[2];
    p[5] += q.Py * N[3];
  }
  for (const m of loads.moments) {
    const D = slope(m.a / L, L);
    p[1] += m.C * D[0];
    p[2] += m.C * D[1];
    p[4] += m.C * D[2];
    p[5] += m.C * D[3];
  }
  p[0] -= EA * loads.eps0;
  p[3] += EA * loads.eps0;
  p[2] -= EI * loads.curv0;
  p[5] += EI * loads.curv0;
  return p;
}

/* ── Static condensation of end hinges ────────────────────────────────── */

export interface Condensed {
  /** The 6 × 6 stiffness with the hinged rotations condensed out (their rows and columns are zero). */
  k: Mat;
  /** The equivalent nodal loads with the same condensation. */
  p: number[];
  /** The member's local displacements with the hinged rotations filled in from the others. */
  recover(u: readonly number[]): number[];
  /** The forces the nodes exert on the member for these end displacements (zero moment at a hinge). */
  forces(u: readonly number[]): number[];
}

export function condense(k: Mat, p: number[], released: { start: boolean; end: boolean }): Condensed {
  const C: number[] = [];
  if (released.start) C.push(2);
  if (released.end) C.push(5);
  const apply = (kk: Mat, pp: number[]): Condensed => ({
    k: kk,
    p: pp,
    recover: (u) => {
      const out = Array.from(u);
      if (C.length === 0) return out;
      const R = [0, 1, 2, 3, 4, 5].filter((i) => !C.includes(i));
      const rhs = C.map((c) => pp0[c] - R.reduce((s, r) => s + k[c][r] * u[r], 0));
      const uc = solveSmall(C.map((c) => C.map((e) => k[c][e])), rhs);
      C.forEach((c, n) => (out[c] = uc[n]));
      return out;
    },
    forces: (u) => {
      const f = [0, 0, 0, 0, 0, 0];
      for (let i = 0; i < 6; i++) {
        if (C.includes(i)) continue;
        let s = -pp[i];
        for (let j = 0; j < 6; j++) if (!C.includes(j)) s += kk[i][j] * u[j];
        f[i] = s;
      }
      return f;
    },
  });
  const pp0 = p;
  if (C.length === 0) return apply(k, p);
  const R = [0, 1, 2, 3, 4, 5].filter((i) => !C.includes(i));
  const kcc = C.map((c) => C.map((e) => k[c][e]));
  // kStar = kRR − kRC kCC⁻¹ kCR, one column of kCC⁻¹ at a time.
  const kStar = zeros(6);
  const pStar = [0, 0, 0, 0, 0, 0];
  const cols = R.map((r) => solveSmall(kcc, C.map((c) => k[c][r])));
  const pc = solveSmall(kcc, C.map((c) => p[c]));
  for (const r of R) {
    for (const s of R) {
      const col = cols[R.indexOf(s)];
      kStar[r][s] = k[r][s] - C.reduce((acc, c, n) => acc + k[r][c] * col[n], 0);
    }
    pStar[r] = p[r] - C.reduce((acc, c, n) => acc + k[r][c] * pc[n], 0);
  }
  return apply(kStar, pStar);
}

/** Solves a 1 × 1 or 2 × 2 system (the hinges' own: always positive definite). */
function solveSmall(a: number[][], b: number[]): number[] {
  if (a.length === 1) return [b[0] / a[0][0]];
  const det = a[0][0] * a[1][1] - a[0][1] * a[1][0];
  return [(b[0] * a[1][1] - a[0][1] * b[1]) / det, (a[0][0] * b[1] - a[1][0] * b[0]) / det];
}

/* ── Exact diagrams ───────────────────────────────────────────────────── */

export interface PieceInput {
  L: number;
  /** What the nodes exert on the member: [Fx_i, Fy_i, M_i, Fx_j, Fy_j, M_j]. */
  f: readonly number[];
  loads: LocalLoads;
  /** Stiffness of the member; null: no displacements. */
  EA: number | null;
  EI: number | null;
  /** The member's own displacement at its start: [u, v, θ]; null when there is no stiffness. */
  start: readonly [number, number, number] | null;
  /** The size under which a force / a moment is rounding (for roots). */
  tinyForce: number;
  tinyMoment: number;
}

export function buildPieces(inp: PieceInput): MemberPiece[] {
  const { L, f, loads } = inp;
  const eps = 1e-13 * L;
  const marks = [0, L];
  for (const d of loads.dist) marks.push(d.a, d.b);
  for (const q of loads.points) marks.push(q.a);
  for (const m of loads.moments) marks.push(m.a);
  marks.sort((a, b) => a - b);
  const xs: number[] = [];
  for (const m of marks) {
    const x = Math.min(Math.max(m, 0), L);
    if (xs.length === 0 || x - xs[xs.length - 1] > eps) xs.push(x);
  }
  xs[0] = 0;
  xs[xs.length - 1] = L;
  // (0 − x, so that a zero is never −0.)
  let N = 0 - f[0];
  let V = 0 + f[1];
  let M = 0 - f[2];
  const stiff = inp.EA !== null && inp.EI !== null && inp.start !== null;
  let u = stiff ? inp.start![0] : 0;
  let v = stiff ? inp.start![1] : 0;
  let th = stiff ? inp.start![2] : 0;
  const jumps = (x: number): void => {
    for (const q of loads.points) if (Math.abs(q.a - x) <= eps) {
      V += q.Py;
      N -= q.Px;
    }
    for (const m of loads.moments) if (Math.abs(m.a - x) <= eps) M -= m.C;
  };
  jumps(0);
  const pieces: MemberPiece[] = [];
  for (let k = 0; k + 1 < xs.length; k++) {
    const x0 = xs[k];
    const x1 = xs[k + 1];
    const ell = x1 - x0;
    let a0 = 0;
    let a1 = 0;
    let b0 = 0;
    let b1 = 0;
    for (const d of loads.dist) {
      if (d.a <= x0 + eps && d.b >= x1 - eps && d.b > d.a) {
        const len = d.b - d.a;
        const sy = (d.qy2 - d.qy1) / len;
        const sx = (d.qx2 - d.qx1) / len;
        a0 += d.qy1 + sy * (x0 - d.a);
        a1 += sy;
        b0 += d.qx1 + sx * (x0 - d.a);
        b1 += sx;
      }
    }
    const Vp: Poly = [V, a0, a1 / 2];
    const Mp: Poly = [M, V, a0 / 2, a1 / 6];
    const Np: Poly = [N, -b0, -b1 / 2];
    let up: Poly | null = null;
    let vp: Poly | null = null;
    if (stiff) {
      const EA = inp.EA!;
      const EI = inp.EI!;
      const kappa = Mp.map((c, n) => c / EI + (n === 0 ? loads.curv0 : 0));
      vp = [v, th, kappa[0] / 2, kappa[1] / 6, kappa[2] / 12, kappa[3] / 20];
      const eps_ = Np.map((c, n) => c / EA + (n === 0 ? loads.eps0 : 0));
      up = [u, eps_[0], eps_[1] / 2, eps_[2] / 3];
    }
    pieces.push({ x0, x1, N: Np, V: Vp, M: Mp, u: up, v: vp });
    N = evalPoly(Np, ell);
    V = evalPoly(Vp, ell);
    M = evalPoly(Mp, ell);
    if (stiff) {
      v = evalPoly(vp!, ell);
      th = evalPoly(derivPoly(vp!), ell);
      u = evalPoly(up!, ell);
    }
    jumps(x1);
  }
  return pieces;
}

/** The value of the member's internal forces and displacements at x, on the side asked for at a jump (default: right, left at x = L). */
export function pieceAt(pieces: readonly MemberPiece[], x: number, side?: 'left' | 'right'): { N: number; V: number; M: number; u: number | null; v: number | null; theta: number | null } {
  const end = pieces[pieces.length - 1].x1;
  const want = side ?? (x >= end ? 'left' : 'right');
  let k = pieces.findIndex((p) => (want === 'right' ? x >= p.x0 && x < p.x1 : x > p.x0 && x <= p.x1));
  if (k < 0) k = want === 'right' ? pieces.length - 1 : 0;
  const p = pieces[k];
  const t = Math.min(Math.max(x, p.x0), p.x1) - p.x0;
  return {
    N: evalPoly(p.N, t),
    V: evalPoly(p.V, t),
    M: evalPoly(p.M, t),
    u: p.u ? evalPoly(p.u, t) : null,
    v: p.v ? evalPoly(p.v, t) : null,
    theta: p.v ? evalPoly(derivPoly(p.v), t) : null,
  };
}

export interface Tiny {
  N: number;
  V: number;
  M: number;
}

export function stationsOf(pieces: readonly MemberPiece[], tiny: Tiny): MemberStation[] {
  const out: MemberStation[] = [];
  const at = (p: MemberPiece, t: number) => ({ N: evalPoly(p.N, t), V: evalPoly(p.V, t), M: evalPoly(p.M, t) });
  const last = pieces.length - 1;
  pieces.forEach((p, k) => {
    const ell = p.x1 - p.x0;
    const startV = at(p, 0);
    if (k === 0) out.push({ x: p.x0, kind: 'end', side: null, ...startV });
    else {
      const prev = at(pieces[k - 1], pieces[k - 1].x1 - pieces[k - 1].x0);
      const same = Math.abs(prev.N - startV.N) <= tiny.N && Math.abs(prev.V - startV.V) <= tiny.V && Math.abs(prev.M - startV.M) <= tiny.M;
      if (same) out.push({ x: p.x0, kind: 'load', side: null, ...startV });
      else {
        out.push({ x: p.x0, kind: 'load', side: 'left', ...prev });
        out.push({ x: p.x0, kind: 'load', side: 'right', ...startV });
      }
    }
    const inner: MemberStation[] = [];
    for (const t of rootsOn(p.V, ell, tiny.V)) inner.push({ x: p.x0 + t, kind: 'zero-shear', side: null, ...at(p, t) });
    for (const t of rootsOn(p.M, ell, tiny.M)) inner.push({ x: p.x0 + t, kind: 'zero-moment', side: null, ...at(p, t) });
    for (const t of rootsOn(p.N, ell, tiny.N)) inner.push({ x: p.x0 + t, kind: 'zero-axial', side: null, ...at(p, t) });
    inner.sort((a, b) => a.x - b.x);
    out.push(...inner);
    if (k === last) out.push({ x: p.x1, kind: 'end', side: null, ...at(p, ell) });
  });
  return out;
}

/** The largest and the smallest value of N, V and M along the member: the piece ends and the stationary points inside the pieces. */
export function maximaOf(pieces: readonly MemberPiece[]): { N: { max: ExtremeAt; min: ExtremeAt }; V: { max: ExtremeAt; min: ExtremeAt }; M: { max: ExtremeAt; min: ExtremeAt } } {
  const make = (pick: (p: MemberPiece) => Poly) => {
    let max: ExtremeAt | null = null;
    let min: ExtremeAt | null = null;
    const see = (x: number, value: number) => {
      if (max === null || value > max.value) max = { x, value };
      if (min === null || value < min.value) min = { x, value };
    };
    for (const p of pieces) {
      const c = pick(p);
      const ell = p.x1 - p.x0;
      see(p.x0, evalPoly(c, 0));
      see(p.x1, evalPoly(c, ell));
      // Stationary points: the roots of the derivative (a polynomial of degree 3 at most).
      const scale = Math.max(...c.map((v, n) => Math.abs(v) * Math.pow(ell, n)), 0);
      for (const t of rootsOn(derivPoly(c), ell, 1e-15 * scale / Math.max(ell, 1e-300))) see(p.x0 + t, evalPoly(c, t));
    }
    return { max: max as unknown as ExtremeAt, min: min as unknown as ExtremeAt };
  };
  return { N: make((p) => p.N), V: make((p) => p.V), M: make((p) => p.M) };
}

/**
 * The internal forces just inside each end. The start's come straight from the pieces (they are the end forces, plus the loads at x̄ = 0: nothing is integrated).
 * The end's are written from the end forces too, N(L⁻) = Fx_j + Px_L, V(L⁻) = −Fy_j − Py_L, M(L⁻) = M_j + C_L (P and C: the loads exactly AT the end, which
 * go straight to the node), so that a hinge carries exactly 0 and nothing is the sum of a hundred roundings.
 */
export function endForceOf(pieces: readonly MemberPiece[], at: 'start' | 'end', f?: readonly number[], loads?: LocalLoads): EndForce {
  if (at === 'start') {
    const p = pieces[0];
    return { N: p.N[0], V: p.V[0], M: p.M[0] };
  }
  const p = pieces[pieces.length - 1];
  const ell = p.x1 - p.x0;
  if (!f || !loads) return { N: evalPoly(p.N, ell), V: evalPoly(p.V, ell), M: evalPoly(p.M, ell) };
  const L = p.x1;
  const near = (a: number) => Math.abs(a - L) <= 1e-13 * L;
  let Px = 0;
  let Py = 0;
  let C = 0;
  for (const q of loads.points) if (near(q.a)) {
    Px += q.Px;
    Py += q.Py;
  }
  for (const m of loads.moments) if (near(m.a)) C += m.C;
  return { N: f[3] + Px, V: -f[4] - Py, M: f[5] + C };
}
