/**
 * ─────────────────────────────────────────────────────────────────────────────
 * BEAM — reactions, shear, bending moment, slope and deflection of one beam
 * ─────────────────────────────────────────────────────────────────────────────
 * The engine of the first calculator of the catalogue ("Beam reactions and
 * diagrams", /resources/beam). A straight, prismatic Euler–Bernoulli beam on
 * any number of pin, roller and fixed supports, with internal hinges, under
 * point loads, linearly varying distributed loads and applied couples.
 * Statically determinate or not: one method for all of them.
 *
 * THE METHOD: initial parameters with Macaulay brackets. The unknowns are
 * the slope and deflection at the left end, the support reactions and the
 * rotation jump at each hinge; the equations are the support conditions,
 * zero moment at each hinge, and the equilibrium of the whole beam. Every
 * response is then a sum of polynomials ⟨x − a⟩ⁿ, EXACT at every point —
 * there is no mesh, and nothing is interpolated.
 *
 * Why not finite elements (the retired lib/beam-analysis did that): a load
 * placed a hair from a support makes a hair-long element, and the stiffness
 * matrix loses a digit of precision for every factor of ten in L/ℓ, cubed.
 * Here a load adds no unknown at all, so where it sits cannot hurt the
 * solution; only two SUPPORTS that nearly coincide are ill-conditioned, and
 * that is the physics, not the arithmetic.
 *
 * UNITS: any consistent set. Lengths in one unit (L), forces in one unit
 * (F): P in F, w in F/L, M in F·L. The flexural stiffness is NOT an input:
 * with one EI along the beam, reactions, shear and moment do not depend on
 * it, and slope and deflection are returned multiplied by it (`EItheta` in
 * F·L², `EIv` in F·L³) for the caller to divide.
 *
 * SIGNS — in the model:
 *   point and distributed loads   positive DOWNWARD
 *   applied couple                positive COUNTER-CLOCKWISE
 * — in the results:
 *   reaction force Rv             positive UPWARD
 *   reaction moment Rm            positive COUNTER-CLOCKWISE, as it acts on the beam
 *   shear V                       positive when the part to the LEFT of the cut is pushed up
 *   moment M                      positive SAGGING (tension in the bottom fibre)
 *   deflection v                  positive UPWARD (a beam sagging under gravity is negative)
 *   slope θ = dv/dx               positive counter-clockwise
 * so that  dV/dx = −w,  dM/dx = V,  EI·dθ/dx = M,  dv/dx = θ.
 *
 * At a point load, a couple, a support or a hinge a response jumps; `at()`
 * takes the side wanted.
 */

export type SupportKind = 'pin' | 'roller' | 'fixed';

export interface BeamSupport {
  x: number;
  /** A pin and a roller are the same support here: the beam carries no axial load. */
  kind: SupportKind;
}
/** Positive downward. */
export interface BeamPointLoad {
  x: number;
  P: number;
}
/** Positive counter-clockwise. */
export interface BeamCouple {
  x: number;
  M: number;
}
/** Linearly varying from w1 at x1 to w2 at x2, positive downward. */
export interface BeamDistLoad {
  x1: number;
  x2: number;
  w1: number;
  w2: number;
}

export interface BeamModel {
  L: number;
  supports: BeamSupport[];
  /** Internal moment releases, strictly inside the beam. */
  hinges?: number[];
  points?: BeamPointLoad[];
  couples?: BeamCouple[];
  dists?: BeamDistLoad[];
}

export type BeamIssueCode =
  | 'length' // L is not a positive, finite number
  | 'number' // a value is not a finite number
  | 'outside' // a position is off the beam
  | 'no-supports'
  | 'hinge-at-end' // a hinge at an end of the beam releases nothing
  | 'hinge-at-fixed' // a hinge on a fixed support: which side is held?
  | 'couple-at-hinge' // a couple on a hinge: applied to which side?
  | 'close-supports' // two supports so close that the arithmetic cannot tell them apart
  | 'unstable'; // the supports do not hold the beam: a mechanism

export interface BeamIssue {
  code: BeamIssueCode;
  /** Which list the offending entry is in, and its index there. */
  where?: { list: 'supports' | 'hinges' | 'points' | 'couples' | 'dists'; index: number };
}

export type Side = 'left' | 'right';

export interface BeamState {
  x: number;
  /** Intensity of the distributed load there, positive downward (F/L). */
  w: number;
  V: number;
  M: number;
  /** EI·θ (F·L²). */
  EItheta: number;
  /** EI·v (F·L³), positive upward. */
  EIv: number;
}

export interface BeamReaction {
  x: number;
  kind: SupportKind;
  /** Upward. */
  Rv: number;
  /** Counter-clockwise on the beam; zero unless the support is fixed. */
  Rm: number;
}

export interface BeamExtreme {
  value: number;
  x: number;
}

export interface BeamSolution {
  ok: true;
  L: number;
  /** Every position where something happens, 0 and L included, ascending. */
  breaks: number[];
  reactions: BeamReaction[];
  /** The response at x; where it jumps, on the side asked for (right by default, left at x = L). */
  at(x: number, side?: Side): BeamState;
  /** Points for plotting: both sides of every break, and enough in between. */
  stations: BeamState[];
  extremes: {
    Vmax: BeamExtreme;
    Vmin: BeamExtreme;
    Mmax: BeamExtreme;
    Mmin: BeamExtreme;
    /** Highest and lowest points of the deflected shape. */
    EIvMax: BeamExtreme;
    EIvMin: BeamExtreme;
    EIthetaMax: BeamExtreme;
    EIthetaMin: BeamExtreme;
  };
  /** Resultant of the applied loads, positive downward. */
  totalLoad: number;
  /** What is left of ΣF and ΣM (about x = 0) once the reactions are in: zero but for rounding. */
  residual: { force: number; moment: number };
}

export type BeamOutcome = BeamSolution | { ok: false; issues: BeamIssue[] };

/* Positions are compared in units of L; two closer than this are one. */
const EPS = 1e-9;

type Quad = { V: number; M: number; T: number; Y: number };

/** The step ⟨d⟩⁰: 1 past the point, 0 before it, and at it the side asked for. */
const step = (d: number, side: Side): boolean => d > EPS || (d >= -EPS && side === 'right');

/* The response of a beam with zero slope and deflection at x = 0 to one
   action of size k, ADDED to q as [V, M, EIθ, EIv] at a distance d past the
   action — the Macaulay brackets ⟨d⟩ⁿ, each integrated from the one before.
   Dimensionless: lengths are in units of L. (Added in place: these run a few
   thousand times per solve, which runs on every keystroke.) */
function addUpwardForce(q: Quad, d: number, side: Side, k: number) {
  if (step(d, side)) q.V += k;
  if (d > 0) {
    q.M += k * d;
    q.T += (k * d * d) / 2;
    q.Y += (k * d * d * d) / 6;
  }
}
function addCcwCouple(q: Quad, d: number, side: Side, k: number) {
  if (step(d, side)) q.M -= k;
  if (d > 0) {
    q.T -= k * d;
    q.Y -= (k * d * d) / 2;
  }
}
/** A uniform load of intensity k that starts at the point and never stops, downward. */
function addUniformFrom(q: Quad, d: number, k: number) {
  if (d <= 0) return;
  const d2 = d * d;
  q.V -= k * d;
  q.M -= (k * d2) / 2;
  q.T -= (k * d2 * d) / 6;
  q.Y -= (k * d2 * d2) / 24;
}
/** A ramp of slope k that starts from zero at the point and never stops, downward. */
function addRampFrom(q: Quad, d: number, k: number) {
  if (d <= 0) return;
  const d2 = d * d;
  q.V -= (k * d2) / 2;
  q.M -= (k * d2 * d) / 6;
  q.T -= (k * d2 * d2) / 24;
  q.Y -= (k * d2 * d2 * d) / 120;
}
/** A jump k in slope at the point (what a hinge allows). */
function addKink(q: Quad, d: number, side: Side, k: number) {
  if (step(d, side)) q.T += k;
  if (d > 0) q.Y += k * d;
}

/** Gaussian elimination with scaled partial pivoting; `null` when the matrix is singular. */
function solveLinear(A: number[][], b: number[]): number[] | null {
  const n = b.length;
  const M = A.map((row, i) => [...row, b[i]]);
  // Each row is measured against its own largest entry, so a row of small
  // numbers is not mistaken for a row of zeros.
  for (const row of M) {
    let s = 0;
    for (let j = 0; j < n; j++) s = Math.max(s, Math.abs(row[j]));
    if (s === 0) return null;
    for (let j = 0; j <= n; j++) row[j] /= s;
  }
  for (let c = 0; c < n; c++) {
    let piv = c;
    for (let r = c + 1; r < n; r++) if (Math.abs(M[r][c]) > Math.abs(M[piv][c])) piv = r;
    if (Math.abs(M[piv][c]) < 1e-11) return null;
    [M[c], M[piv]] = [M[piv], M[c]];
    for (let r = c + 1; r < n; r++) {
      const f = M[r][c] / M[c][c];
      if (f === 0) continue;
      for (let k = c; k <= n; k++) M[r][k] -= f * M[c][k];
    }
  }
  const x = new Array<number>(n).fill(0);
  for (let r = n - 1; r >= 0; r--) {
    let s = M[r][n];
    for (let k = r + 1; k < n; k++) s -= M[r][k] * x[k];
    x[r] = s / M[r][r];
  }
  return x.every(Number.isFinite) ? x : null;
}

/** Bisection for a root of f in [a, b], given f(a) and f(b) of opposite sign. */
function bisect(f: (x: number) => number, a: number, b: number, fa: number): number {
  let lo = a;
  let hi = b;
  let flo = fa;
  for (let i = 0; i < 60; i++) {
    const mid = (lo + hi) / 2;
    const fm = f(mid);
    if (fm === 0) return mid;
    if (flo < 0 === fm < 0) {
      lo = mid;
      flo = fm;
    } else hi = mid;
  }
  return (lo + hi) / 2;
}

export function solveBeam(model: BeamModel): BeamOutcome {
  const issues: BeamIssue[] = [];
  const L = model.L;
  if (!Number.isFinite(L) || L <= 0) return { ok: false, issues: [{ code: 'length' }] };

  const hingesIn = model.hinges ?? [];
  const pointsIn = model.points ?? [];
  const couplesIn = model.couples ?? [];
  const distsIn = model.dists ?? [];

  /* ── What was entered, checked ─────────────────────────────────────── */
  const finite = (...v: number[]) => v.every(Number.isFinite);
  const on = (x: number) => x >= -EPS * L && x <= L * (1 + EPS);
  const unit = (x: number) => Math.min(1, Math.max(0, x / L));

  model.supports.forEach((s, index) => {
    if (!finite(s.x)) issues.push({ code: 'number', where: { list: 'supports', index } });
    else if (!on(s.x)) issues.push({ code: 'outside', where: { list: 'supports', index } });
  });
  hingesIn.forEach((h, index) => {
    if (!finite(h)) issues.push({ code: 'number', where: { list: 'hinges', index } });
    else if (!on(h)) issues.push({ code: 'outside', where: { list: 'hinges', index } });
    else if (unit(h) < EPS || unit(h) > 1 - EPS) issues.push({ code: 'hinge-at-end', where: { list: 'hinges', index } });
  });
  pointsIn.forEach((p, index) => {
    if (!finite(p.x, p.P)) issues.push({ code: 'number', where: { list: 'points', index } });
    else if (!on(p.x)) issues.push({ code: 'outside', where: { list: 'points', index } });
  });
  couplesIn.forEach((c, index) => {
    if (!finite(c.x, c.M)) issues.push({ code: 'number', where: { list: 'couples', index } });
    else if (!on(c.x)) issues.push({ code: 'outside', where: { list: 'couples', index } });
  });
  distsIn.forEach((d, index) => {
    if (!finite(d.x1, d.x2, d.w1, d.w2)) issues.push({ code: 'number', where: { list: 'dists', index } });
    else if (!on(d.x1) || !on(d.x2)) issues.push({ code: 'outside', where: { list: 'dists', index } });
  });
  if (issues.length) return { ok: false, issues };
  if (model.supports.length === 0) return { ok: false, issues: [{ code: 'no-supports' }] };

  /* ── The same beam with L = 1: lengths ÷ L, w × L, couples ÷ L ─────── */
  // Two supports at one point are one support, and the stiffer one.
  const supports: { a: number; kind: SupportKind; from: number }[] = [];
  model.supports
    .map((s, from) => ({ a: unit(s.x), kind: s.kind, from }))
    .sort((p, q) => p.a - q.a)
    .forEach((s) => {
      const last = supports[supports.length - 1];
      if (last && Math.abs(last.a - s.a) < EPS) {
        if (s.kind === 'fixed') last.kind = 'fixed';
      } else supports.push({ ...s });
    });
  const hinges = [...new Set(hingesIn.map(unit))].sort((p, q) => p - q).filter((h, i, arr) => i === 0 || h - arr[i - 1] > EPS);
  const fixedAt = supports.filter((s) => s.kind === 'fixed');

  hingesIn.forEach((h, index) => {
    if (fixedAt.some((s) => Math.abs(s.a - unit(h)) < EPS)) issues.push({ code: 'hinge-at-fixed', where: { list: 'hinges', index } });
  });
  couplesIn.forEach((c, index) => {
    if (c.M !== 0 && hinges.some((h) => Math.abs(h - unit(c.x)) < EPS)) issues.push({ code: 'couple-at-hinge', where: { list: 'couples', index } });
  });
  if (issues.length) return { ok: false, issues };

  const points = pointsIn.filter((p) => p.P !== 0).map((p) => ({ a: unit(p.x), P: p.P }));
  const couples = couplesIn.filter((c) => c.M !== 0).map((c) => ({ a: unit(c.x), M: c.M / L }));
  // A distributed load entered right-to-left is the same load.
  const dists = distsIn
    .map((d) => (d.x1 <= d.x2 ? d : { x1: d.x2, x2: d.x1, w1: d.w2, w2: d.w1 }))
    .map((d) => ({ a: unit(d.x1), b: unit(d.x2), wa: d.w1 * L, wb: d.w2 * L, k: 0 }))
    .filter((d) => d.b - d.a > EPS && (d.wa !== 0 || d.wb !== 0));
  for (const d of dists) d.k = (d.wb - d.wa) / (d.b - d.a);

  /** The applied loads alone, on a beam with zero slope and deflection at the left end. */
  const loadsAt = (x: number, side: Side): Quad => {
    const q: Quad = { V: 0, M: 0, T: 0, Y: 0 };
    for (const p of points) addUpwardForce(q, x - p.a, side, -p.P);
    for (const c of couples) addCcwCouple(q, x - c.a, side, c.M);
    for (const d of dists) {
      addUniformFrom(q, x - d.a, d.wa);
      addRampFrom(q, x - d.a, d.k);
      // …and taken off again past its end.
      addUniformFrom(q, x - d.b, -d.wb);
      addRampFrom(q, x - d.b, -d.k);
    }
    return q;
  };
  const intensityAt = (x: number, side: Side): number => {
    let w = 0;
    for (const d of dists) {
      const inside = side === 'right' ? x >= d.a - EPS && x < d.b - EPS : x > d.a + EPS && x <= d.b + EPS;
      if (inside) w += d.wa + d.k * (x - d.a);
    }
    return w;
  };

  /* ── The unknowns: EIθ(0), EIv(0), each reaction, each hinge's kink ── */
  const nR = supports.length;
  const nM = fixedAt.length;
  const nH = hinges.length;
  const N = 2 + nR + nM + nH;
  /** The unknowns' own part of the response at x: each one times what it contributes there. */
  const unknownsAt = (q: Quad, x: number, side: Side, value: (i: number) => number, only = -1): Quad => {
    const k = (i: number) => (only < 0 || only === i ? value(i) : 0);
    q.T += k(0);
    q.Y += k(0) * x + k(1);
    supports.forEach((s, i) => addUpwardForce(q, x - s.a, side, k(2 + i)));
    fixedAt.forEach((s, i) => addCcwCouple(q, x - s.a, side, k(2 + nR + i)));
    hinges.forEach((h, i) => addKink(q, x - h, side, k(2 + nR + nM + i)));
    return q;
  };

  const A: number[][] = [];
  const b: number[] = [];
  const equation = (x: number, side: Side, of: keyof Quad) => {
    // One column per unknown: what it alone, at unit value, puts there.
    A.push(Array.from({ length: N }, (_, i) => unknownsAt({ V: 0, M: 0, T: 0, Y: 0 }, x, side, () => 1, i)[of]));
    b.push(-loadsAt(x, side)[of]);
  };
  for (const s of supports) equation(s.a, 'right', 'Y'); // no deflection at a support
  for (const s of fixedAt) equation(s.a, 'right', 'T'); // no rotation at a fixed one
  for (const h of hinges) equation(h, 'right', 'M'); // no moment at a hinge
  equation(1, 'right', 'V'); // nothing is left past the right end:
  equation(1, 'right', 'M'); // the whole beam is in equilibrium

  // No solution: a mechanism — unless two supports sit within a thousandth
  // of the beam of each other. That pair IS stable (it clamps the beam), but
  // its two reactions are a difference of nearly equal numbers and the
  // system is singular to rounding; calling it a mechanism would be false.
  const closest = supports.reduce((gap, s, i) => (i === 0 ? gap : Math.min(gap, s.a - supports[i - 1].a)), Infinity);
  const unsolved: BeamOutcome = { ok: false, issues: [{ code: closest < 1e-3 ? 'close-supports' : 'unstable' }] };
  const u = solveLinear(A, b);
  if (!u) return unsolved;

  const stateAt = (xn: number, side: Side): Quad => unknownsAt(loadsAt(xn, side), xn, side, (i) => u[i]);
  // The solution must satisfy what it was asked: anything else is a matrix
  // too close to singular to trust (a mechanism but for rounding).
  const scale = Math.max(1, ...points.map((p) => Math.abs(p.P)), ...dists.map((d) => Math.abs(d.wa) + Math.abs(d.wb)), ...couples.map((c) => Math.abs(c.M)));
  const end = stateAt(1, 'right');
  if (Math.abs(end.V) > 1e-6 * scale || Math.abs(end.M) > 1e-6 * scale) return unsolved;

  /* ── Back in the caller's units ────────────────────────────────────── */
  const at = (x: number, side?: Side): BeamState => {
    const xn = unit(x);
    const s: Side = side ?? (xn >= 1 - EPS ? 'left' : 'right');
    const q = stateAt(xn, s);
    return { x: xn * L, w: intensityAt(xn, s) / L, V: q.V, M: q.M * L, EItheta: q.T * L * L, EIv: q.Y * L * L * L };
  };

  const reactions: BeamReaction[] = supports.map((s, i) => {
    const k = fixedAt.indexOf(s);
    return { x: s.a * L, kind: s.kind, Rv: u[2 + i], Rm: k < 0 ? 0 : u[2 + nR + k] * L };
  });

  const breaksN = [0, 1, ...supports.map((s) => s.a), ...hinges, ...points.map((p) => p.a), ...couples.map((c) => c.a), ...dists.flatMap((d) => [d.a, d.b])]
    .sort((p, q) => p - q)
    .filter((x, i, arr) => i === 0 || x - arr[i - 1] > EPS);

  /* ── Stations and extremes ─────────────────────────────────────────── */
  // Between two breaks every response is one polynomial (V a parabola at
  // most), so an extreme is at a break or where the derivative crosses zero:
  // V where w = 0, M where V = 0, v where θ = 0, θ where M = 0. The crossing
  // is bracketed on a fine grid and closed by bisection.
  const stations: BeamState[] = [];
  const candidates: BeamState[] = [];
  const GRID = 24;
  for (let i = 0; i < breaksN.length - 1; i++) {
    const a = breaksN[i];
    const c = breaksN[i + 1];
    const n = Math.max(GRID, Math.ceil((c - a) * 240));
    const grid: BeamState[] = [];
    for (let j = 0; j <= n; j++) {
      const xn = a + ((c - a) * j) / n;
      grid.push(at(xn * L, j === 0 ? 'right' : j === n ? 'left' : 'right'));
    }
    stations.push(...grid);
    // Every grid point is a candidate too: a derivative that is EXACTLY zero
    // on one (the midspan of a symmetric beam) is no sign change to bracket.
    candidates.push(...grid);
    const roots = (f: (s: BeamState) => number) => {
      for (let j = 0; j < n; j++) {
        const fa = f(grid[j]);
        const fb = f(grid[j + 1]);
        if (fa === 0 || fb === 0 || fa < 0 === fb < 0) continue;
        const x = bisect((xx) => f(at(xx, 'right')), grid[j].x, grid[j + 1].x, fa);
        // On the side of the crossing that is INSIDE this stretch: a root that
        // lands on its far end (the moment dying out at a free end) must not
        // be read past a load or a support there — that put a zero among the
        // extremes of a shear diagram that never reaches zero.
        candidates.push(at(x, x - grid[j].x < grid[j + 1].x - x ? 'right' : 'left'));
      }
    };
    roots((s) => s.w);
    roots((s) => s.V);
    roots((s) => s.M);
    roots((s) => s.EItheta);
  }
  const pick = (of: (s: BeamState) => number, sign: 1 | -1): BeamExtreme => {
    let best = candidates[0];
    for (const s of candidates) if (sign * of(s) > sign * of(best)) best = s;
    return { value: of(best), x: best.x };
  };

  const totalLoad = points.reduce((sum, p) => sum + p.P, 0) + dists.reduce((sum, d) => sum + ((d.wa + d.wb) / 2) * (d.b - d.a), 0);
  // About x = 0, counter-clockwise positive, per unit of L then × L.
  const momentOfLoads =
    points.reduce((sum, p) => sum - p.P * p.a, 0) +
    couples.reduce((sum, c) => sum + c.M, 0) +
    dists.reduce((sum, d) => {
      // ∫ w(s)·s ds over the load: its resultant at its left end, plus the
      // moment of the trapezoid about that end.
      const len = d.b - d.a;
      const W = ((d.wa + d.wb) / 2) * len;
      return sum - (W * d.a + (d.wa * len * len) / 2 + ((d.wb - d.wa) * len * len) / 3);
    }, 0);
  const momentOfReactions = supports.reduce((sum, s, i) => sum + u[2 + i] * s.a, 0) + fixedAt.reduce((sum, _s, k) => sum + u[2 + nR + k], 0);

  return {
    ok: true,
    L,
    breaks: breaksN.map((x) => x * L),
    reactions,
    at,
    stations,
    extremes: {
      Vmax: pick((s) => s.V, 1),
      Vmin: pick((s) => s.V, -1),
      Mmax: pick((s) => s.M, 1),
      Mmin: pick((s) => s.M, -1),
      EIvMax: pick((s) => s.EIv, 1),
      EIvMin: pick((s) => s.EIv, -1),
      EIthetaMax: pick((s) => s.EItheta, 1),
      EIthetaMin: pick((s) => s.EItheta, -1),
    },
    totalLoad,
    residual: {
      force: reactions.reduce((sum, r) => sum + r.Rv, 0) - totalLoad,
      moment: (momentOfLoads + momentOfReactions) * L,
    },
  };
}

/**
 * The stretches of the beam a deflection limit is written for: each span
 * between two supports, and each overhang past the last support (or the
 * whole beam, on one support). With the largest deflection in each, either
 * way, as EI·v.
 */
export interface BeamSpan {
  from: number;
  to: number;
  kind: 'span' | 'cantilever';
  /** The largest |EI·v| in the stretch, and where. */
  EIv: BeamExtreme;
}

export function beamSpans(solution: BeamSolution): BeamSpan[] {
  const xs = solution.reactions.map((r) => r.x);
  const tol = EPS * solution.L;
  const stretches: { from: number; to: number; kind: BeamSpan['kind'] }[] = [];
  if (xs[0] > tol) stretches.push({ from: 0, to: xs[0], kind: 'cantilever' });
  for (let i = 0; i < xs.length - 1; i++) stretches.push({ from: xs[i], to: xs[i + 1], kind: 'span' });
  if (solution.L - xs[xs.length - 1] > tol) stretches.push({ from: xs[xs.length - 1], to: solution.L, kind: 'cantilever' });
  return stretches.map((s) => {
    let best: BeamExtreme = { value: 0, x: s.from };
    const consider = (st: BeamState) => {
      if (st.x < s.from - tol || st.x > s.to + tol) return;
      if (Math.abs(st.EIv) > Math.abs(best.value)) best = { value: st.EIv, x: st.x };
    };
    solution.stations.forEach(consider);
    // The exact extremes, where they fall in this stretch.
    for (const e of [solution.extremes.EIvMax, solution.extremes.EIvMin]) consider(solution.at(e.x));
    // …and a turning point of the shape inside it, closed by bisection.
    const inside = solution.stations.filter((st) => st.x >= s.from - tol && st.x <= s.to + tol);
    for (let j = 0; j < inside.length - 1; j++) {
      const fa = inside[j].EItheta;
      const fb = inside[j + 1].EItheta;
      if (fa === 0 || fb === 0 || fa < 0 === fb < 0 || inside[j + 1].x - inside[j].x < tol) continue;
      consider(solution.at(bisect((x) => solution.at(x, 'right').EItheta, inside[j].x, inside[j + 1].x, fa)));
    }
    return { ...s, EIv: best };
  });
}
