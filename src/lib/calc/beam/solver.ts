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
 * response is then a sum of polynomials ⟨x − a⟩ⁿ in closed form: there is no
 * mesh and nothing is interpolated — the value at a point is the formula
 * worked out at that point.
 *
 * Why not finite elements (the retired lib/beam-analysis did that): a load
 * placed a hair from a support makes a hair-long element, and the stiffness
 * matrix loses a digit of precision for every factor of ten in L/ℓ, cubed.
 * Here a load adds no unknown at all, so where it sits cannot hurt the
 * solution, nor how short it is — down to a billionth of L, under which two
 * positions are one: a distributed load shorter than a billionth of the
 * length is not applied.
 *
 * WHAT IS EXACT, AND WHERE IT STOPS. The formula is exact; the numbers in it
 * are doubles. Held against an independent solver (direct stiffness in
 * 640-bit arithmetic) on the 55,878 beams of an exhaustive lattice and on
 * ninety thousand random ones:
 *   — Whether the supports hold the beam is COUNTED (`restOf`), not left to
 *     the elimination: no mechanism was solved, no held beam called one.
 *   — What costs digits is two UNKNOWNS that nearly coincide. Two supports
 *     close together each take the pair's moment over the gap, and the split
 *     between them is lost to rounding while their sum stays right; a piece
 *     between hinges that rests on two points close together is the same.
 *     So two consecutive supports closer than a thousandth of L are refused
 *     ('close-supports') whatever stands between them, a hinge included, and
 *     so is a piece resting on a base under a hundred-thousandth of L
 *     ('close-hinges'): see CLOSE and CLOSE_HINGE.
 *   — Inside those limits, with everything a hundredth of L apart or more,
 *     every value agreed to 1e-7 of the largest of its diagram, and to
 *     1e-12 on ordinary beams.
 *   — Nearer the limits it is the LARGEST reaction that measures the error,
 *     and nothing in the solution shows it: the reactions still add up.
 *     Errors of up to about 2e-3 of the largest reaction were measured where
 *     a close pair stands beside a levered piece (one resting on a short
 *     base):
 *       · 24.09 returned for a reaction of 20.6, and 3,690 for the 3,687
 *         beside it: two supports a thousandth of L apart, a hinge as close
 *         to a roller;
 *       · −1,329 for −991, beside one of 227,400: two hinges at their limit
 *         beside two walls at theirs;
 *       · ∓0.044 on a close pair that carries nothing, beside a reaction
 *         of 21: a piece on a base of a ten-thousandth of L further along.
 *     A reaction under about a hundredth of the largest one is then not good
 *     to four figures, whatever share of the LOAD it is, and the largest
 *     ones may be off in their fourth. A slope across a short piece is a
 *     small deflection over a small length and loses more: 0.45 was returned
 *     for 0.09 on a link 1.4e-5 of L long.
 *   — A number holds only so much. A length or a load too large for the
 *     results to be numbers is refused before anything is worked out: see
 *     BIG.
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
  | 'length' // L is not a positive number, or not of a size the engine takes (see BIG)
  | 'number' // a value is not a number, or a load is larger than the engine takes (see BIG)
  | 'outside' // a position is off the beam
  | 'no-supports'
  | 'hinge-at-end' // a hinge at an end of the beam releases nothing
  | 'hinge-at-fixed' // a hinge on a fixed support: which side is held?
  | 'couple-at-hinge' // a couple on a hinge: applied to which side?
  | 'close-supports' // two supports next to each other, closer than a thousandth of the length: not solved
  | 'close-hinges' // a piece between hinges held on a base under a hundred-thousandth of the length: not solved
  | 'unstable'; // the supports do not hold the beam: a mechanism

export interface BeamIssue {
  code: BeamIssueCode;
  /**
   * Which list the offending entry is in, and its index there. Of two
   * supports or two hinges too close together, the one further right; of a
   * hinge too close to a support, the hinge.
   */
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
  /**
   * What is left of ΣF and ΣM (about x = 0) once the reactions are in: zero
   * but for rounding. No beam is returned as solved with more than a
   * millionth of its loads left over.
   */
  residual: { force: number; moment: number };
}

export type BeamOutcome = BeamSolution | { ok: false; issues: BeamIssue[] };

/* Positions are compared in units of L; two closer than this are one. */
const EPS = 1e-9;
/* Two supports that are not one, and closer than this, are not solved. The
   arithmetic loses a digit of the split between them for every factor of
   ten in the gap, and up to three times that for a fixed support beside
   another: at a ten-thousandth of L a reaction of 15 came out as 15.29
   with −0.29 beside it where the beam has +0.00009 — and the sum of the two
   is right all the while, so no check on the solution can see it. At a
   thousandth the pair by itself is right in the figures printed; beside a
   levered piece it is not always (the header has the measurements).

   The rule is about two supports NEXT TO EACH OTHER along the beam,
   whatever stands between them: a hinge between the two, or under one of
   them, changes nothing. With a hinge there they hold two different pieces
   and are not the pair described above, and on pins and rollers such beams
   were being solved right. They are refused all the same: with a fixed
   support among the two they were not (a wall 4.5e-5 of L from the next
   and a hinge between them: 114.9 returned for 114.7), so an exception
   would need a limit of its own, and none has been measured. */
const CLOSE = 1e-3;
/* The same for a piece of the beam between hinges that rests on two points
   this close: a hinge beside another hinge, or beside the only support of
   its piece. (A hinge beside a support is no trouble when the piece rests
   on something else as well, nor beside a fixed support.) One such piece by
   itself is solved right down to a hundred-thousandth of L; below, the
   elimination gave up and a beam that stands was called a mechanism.
   Several of them, or one beside a close pair of supports, are another
   matter: the header has what was measured, and `lost` what is refused. */
const CLOSE_HINGE = 1e-5;
/* The largest length and the largest load the engine takes, and the
   smallest length. Nobody builds a beam of 1e60 ft, but a link can ask for
   one, and a number holds only so much (1.8e308): past it a product is
   Infinity, and Infinity less Infinity is no number at all. A uniform load
   of 1e308 came back as "two supports closer than a thousandth" on
   supports 20 ft apart; two point loads of ±1e308 as a solution, with
   Infinity among its moments for the diagrams to draw.

   What a solution holds grows as load × length³ — as intensity × length⁴
   for a distributed load. With the length and twelve rows of every kind of
   load all AT the limit, the largest number in the solutions of the page's
   seven layouts was 1.5e300 (the tip of a cantilever), a hundred million
   times short of the end. One piece levered on a base at ITS limit uses
   that margin up, which is why the stations are looked at once more before
   a solution is returned. The smallest length is for the couples, which
   are divided by it: 8 kip·ft on a beam of 1e-310 ft was "two supports
   closer than a thousandth" too. */
const BIG = 1e60;
const SMALL = 1e-60;

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
/* A whole distributed load, downward, seen from a distance d past its START
   that is at or beyond its end: by its moments about that start,
   m[n] = ∫ w(s)·sⁿ ds. The brackets would say "the load running on for ever,
   less the same from its end on" — two ramps of slope (w2 − w1)/length, and
   for a short load that slope is huge and the two cancel to nothing: a
   10 kip triangle a ten-millionth of the span long came out as 9.875. */
function addLoadBehind(q: Quad, d: number, m: number[]) {
  q.V -= m[0];
  q.M -= m[0] * d - m[1];
  q.T -= (m[0] * d * d - 2 * m[1] * d + m[2]) / 2;
  q.Y -= (m[0] * d * d * d - 3 * m[1] * d * d + 3 * m[2] * d - m[3]) / 6;
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

/* Where f crosses zero between a and b, given its values at the two; null
   when it does not. An end where f is zero has no sign to bracket with, and
   is no reason to pass over the cell: the shear at a free end is zero and
   can cross zero again a hair further on, with the largest moment there. So
   that end is looked at just inside the cell instead, and the cell is passed
   over only if f is still zero there (zero all along) or has the sign of the
   other end. Zero is anything up to `zero`, the caller's measure of rounding:
   the moment at a hinge comes out as ±1e-15, and that sign is nobody's. */
function crossing(f: (x: number, side: Side) => number, a: number, b: number, fa: number, fb: number, zero: number): number | null {
  // Nothing at either end — no load on this stretch, the commonest cell of
  // all — is nothing in between: not worth two more evaluations to learn.
  if (fa === 0 && fb === 0) return null;
  const hair = 1e-6 * (b - a);
  let lo = a;
  let hi = b;
  let flo = fa;
  let fhi = fb;
  if (Math.abs(flo) <= zero) flo = f((lo += hair), 'right');
  if (Math.abs(fhi) <= zero) fhi = f((hi -= hair), 'left');
  if (Math.abs(flo) <= zero || Math.abs(fhi) <= zero || flo < 0 === fhi < 0) return null;
  return bisect((x) => f(x, 'right'), lo, hi, flo);
}

/* Do the supports hold the beam? In a mechanism nothing bends: the hinges cut
   the beam into pieces and each one moves as a straight line. A line is held
   by a fixed support, or by two of its points that cannot move — a support
   on it, or a hinge whose other piece is held without leaning on this one.
   That is a count, exact wherever the supports are; the elimination cannot
   tell a mechanism from two supports a hair apart, so it is not asked.

   `null` for a mechanism. Otherwise, for each piece that rests on points
   alone, the distance from the first of them to the last, and the hinge (its
   place in `hinges`) at an end of that base, −1 when both ends are supports.
   Positions in units of L, both lists in ascending order. */
function restOf(supports: { a: number; kind: SupportKind }[], hinges: number[]): { base: number; hinge: number }[] | null {
  const n = hinges.length + 1;
  const wall = new Array<boolean>(n).fill(false);
  const own: number[][] = Array.from({ length: n }, () => []);
  // A support on a hinge holds that point of both its pieces.
  const pinned = hinges.map(() => false);
  for (const s of supports) {
    const on = hinges.findIndex((h) => Math.abs(h - s.a) < EPS);
    if (on >= 0) pinned[on] = true;
    else {
      const i = hinges.filter((h) => h < s.a).length;
      own[i].push(s.a);
      if (s.kind === 'fixed') wall[i] = true;
    }
  }
  // Piece i with what is on it and the hinge on ONE side of it: held that
  // way, the piece on its other side may lean on it.
  const holds = (i: number, hinge: boolean) => wall[i] || own[i].length + (hinge ? 1 : 0) >= 2;
  const fromLeft: boolean[] = [];
  for (let i = 0; i < n; i++) fromLeft.push(holds(i, i > 0 && (pinned[i - 1] || fromLeft[i - 1])));
  const fromRight = new Array<boolean>(n).fill(false);
  for (let i = n - 1; i >= 0; i--) fromRight[i] = holds(i, i < n - 1 && (pinned[i] || fromRight[i + 1]));

  const rest: { base: number; hinge: number }[] = [];
  for (let i = 0; i < n; i++) {
    if (wall[i]) continue;
    const before = i > 0 && (pinned[i - 1] || fromLeft[i - 1]);
    const after = i < n - 1 && (pinned[i] || fromRight[i + 1]);
    const points = [...(before ? [hinges[i - 1]] : []), ...own[i], ...(after ? [hinges[i]] : [])];
    if (points.length < 2) return null;
    rest.push({ base: points[points.length - 1] - points[0], hinge: after ? i : before ? i - 1 : -1 });
  }
  return rest;
}

export function solveBeam(model: BeamModel): BeamOutcome {
  const issues: BeamIssue[] = [];
  const L = model.L;
  // Not a number, not positive, or not of a size the engine takes.
  if (!(L >= SMALL && L <= BIG)) return { ok: false, issues: [{ code: 'length' }] };

  const hingesIn = model.hinges ?? [];
  const pointsIn = model.points ?? [];
  const couplesIn = model.couples ?? [];
  const distsIn = model.dists ?? [];

  /* ── What was entered, checked ─────────────────────────────────────── */
  const finite = (...v: number[]) => v.every(Number.isFinite);
  /** The size of a load: a number, and one the engine takes. (NaN is not under any limit.) */
  const sized = (...v: number[]) => v.every((s) => Math.abs(s) <= BIG);
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
    if (!finite(p.x) || !sized(p.P)) issues.push({ code: 'number', where: { list: 'points', index } });
    else if (!on(p.x)) issues.push({ code: 'outside', where: { list: 'points', index } });
  });
  couplesIn.forEach((c, index) => {
    if (!finite(c.x) || !sized(c.M)) issues.push({ code: 'number', where: { list: 'couples', index } });
    else if (!on(c.x)) issues.push({ code: 'outside', where: { list: 'couples', index } });
  });
  distsIn.forEach((d, index) => {
    if (!finite(d.x1, d.x2) || !sized(d.w1, d.w2)) issues.push({ code: 'number', where: { list: 'dists', index } });
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

  /* ── Is it held, and by things far enough apart to solve? ──────────── */
  // A mechanism is called one whatever else is true of it: moving a support
  // that is too close to another would not make it stand.
  const rest = restOf(supports, hinges);
  if (!rest) return { ok: false, issues: [{ code: 'unstable' }] };
  supports.forEach((s, i) => {
    if (i > 0 && s.a - supports[i - 1].a < CLOSE - EPS) issues.push({ code: 'close-supports', where: { list: 'supports', index: s.from } });
  });
  /** A hinge of `hinges`, as the caller listed it. */
  const hingeIssue = (i: number): BeamIssue => ({ code: 'close-hinges', where: { list: 'hinges', index: hingesIn.findIndex((h) => Math.abs(unit(h) - hinges[i]) < EPS) } });
  for (const r of rest) {
    // Two supports alone on a base this short are the case above.
    if (r.hinge < 0 || r.base >= CLOSE_HINGE - EPS) continue;
    const issue = hingeIssue(r.hinge);
    if (!issues.some((i) => i.code === issue.code && i.where?.index === issue.where?.index)) issues.push(issue);
  }
  if (issues.length) return { ok: false, issues };

  const points = pointsIn.filter((p) => p.P !== 0).map((p) => ({ a: unit(p.x), P: p.P }));
  const couples = couplesIn.filter((c) => c.M !== 0).map((c) => ({ a: unit(c.x), M: c.M / L }));
  // A distributed load entered right-to-left is the same load.
  const dists = distsIn
    .map((d) => (d.x1 <= d.x2 ? d : { x1: d.x2, x2: d.x1, w1: d.w2, w2: d.w1 }))
    // Its length from the two positions as they were given: taken from the
    // two divided by L, a load a ten-millionth of the span long would be
    // known to nine figures only, and its resultant with it.
    .map((d) => ({ a: unit(d.x1), b: unit(d.x2), len: (d.x2 - d.x1) / L, wa: d.w1 * L, wb: d.w2 * L, k: 0, m: [0, 0, 0, 0] }))
    // One whose two ends are one position (EPS) has no length here, whatever
    // its intensity: it is not applied.
    .filter((d) => d.b - d.a > EPS && (d.wa !== 0 || d.wb !== 0));
  for (const d of dists) {
    const dw = d.wb - d.wa;
    d.k = dw / d.len;
    // ∫ w(s)·sⁿ ds from its start, n = 0…3: all it is to a point past its end.
    d.m = [d.len * (d.wa + dw / 2), d.len ** 2 * (d.wa / 2 + dw / 3), d.len ** 3 * (d.wa / 3 + dw / 4), d.len ** 4 * (d.wa / 4 + dw / 5)];
  }

  /** The applied loads alone, on a beam with zero slope and deflection at the left end. */
  const loadsAt = (x: number, side: Side): Quad => {
    const q: Quad = { V: 0, M: 0, T: 0, Y: 0 };
    for (const p of points) addUpwardForce(q, x - p.a, side, -p.P);
    for (const c of couples) addCcwCouple(q, x - c.a, side, c.M);
    for (const d of dists) {
      const past = x - d.a;
      if (past >= d.b - d.a) addLoadBehind(q, past, d.m);
      else {
        // Inside the load: the part of it behind the point.
        addUniformFrom(q, past, d.wa);
        addRampFrom(q, past, d.k);
      }
    }
    return q;
  };
  /** Their resultant, positive downward; and its moment about x = 0, counter-clockwise, per unit of L. */
  const totalLoad = points.reduce((sum, p) => sum + p.P, 0) + dists.reduce((sum, d) => sum + ((d.wa + d.wb) / 2) * d.len, 0);
  const momentOfLoads =
    points.reduce((sum, p) => sum - p.P * p.a, 0) +
    couples.reduce((sum, c) => sum + c.M, 0) +
    dists.reduce((sum, d) => {
      // ∫ w(s)·s ds over the load: its resultant at its left end, plus the
      // moment of the trapezoid about that end.
      const W = ((d.wa + d.wb) / 2) * d.len;
      return sum - (W * d.a + (d.wa * d.len * d.len) / 2 + ((d.wb - d.wa) * d.len * d.len) / 3);
    }, 0);
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

  // The beam is held and nothing on it is too close together, so this goes
  // through. Should the arithmetic fail all the same — several things each
  // just past its limit — the beam is refused as what it then is, too close
  // to separate, with the tightest of them named; never as a mechanism,
  // which it is not.
  const lost = (): BeamOutcome => {
    const tight = rest.filter((r) => r.hinge >= 0).sort((p, q) => p.base - q.base)[0];
    if (tight) return { ok: false, issues: [hingeIssue(tight.hinge)] };
    let near = 1;
    for (let i = 2; i < nR; i++) if (supports[i].a - supports[i - 1].a < supports[near].a - supports[near - 1].a) near = i;
    return { ok: false, issues: [{ code: 'close-supports', where: nR > 1 ? { list: 'supports', index: supports[near].from } : undefined }] };
  };
  const u = solveLinear(A, b);
  if (!u) return lost();

  const stateAt = (xn: number, side: Side): Quad => unknownsAt(loadsAt(xn, side), xn, side, (i) => u[i]);
  // The reactions must carry the loads — their sum and their moment about
  // x = 0, both taken from the loads themselves and not from the response —
  // and nothing may be left past the right end. All of it measured against
  // the loads AS FORCES (a distributed load is its mean intensity times its
  // length, a couple its moment over L). Against intensities, one short
  // load of huge intensity made the tolerance huge, and reactions of 9.875
  // under a load of 10 were returned as the solution. (That load is now
  // taken off by its moments and adds up; of 140,000 random beams, the
  // closest allowed among them, none was stopped here. It stays as the last
  // word on what may be called a solution.)
  const size =
    points.reduce((sum, p) => sum + Math.abs(p.P), 0) +
    dists.reduce((sum, d) => sum + ((Math.abs(d.wa) + Math.abs(d.wb)) / 2) * d.len, 0) +
    couples.reduce((sum, c) => sum + Math.abs(c.M), 0);
  const force = supports.reduce((sum, _s, i) => sum + u[2 + i], 0) - totalLoad;
  const moment = momentOfLoads + supports.reduce((sum, s, i) => sum + u[2 + i] * s.a, 0) + fixedAt.reduce((sum, _s, k) => sum + u[2 + nR + k], 0);
  const end = stateAt(1, 'right');
  if ([force, moment, end.V, end.M].some((left) => Math.abs(left) > 1e-6 * size)) return lost();

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
  const grids: BeamState[][] = [];
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
    grids.push(grid);
  }
  // The limits on what is entered (BIG) keep these numbers; on a beam near
  // the limit of length under loads near theirs, a levered piece can still
  // take a deflection past the largest there is. That is no solution, and it
  // is the length, cubed, that took it there.
  if (!stations.every((s) => finite(s.V, s.M, s.EItheta, s.EIv))) return { ok: false, issues: [{ code: 'length' }] };
  // Every grid point is a candidate too: a derivative that is EXACTLY zero
  // on one (the midspan of a symmetric beam) is no sign change to bracket.
  const candidates = [...stations];
  const roots = (f: (s: BeamState) => number) => {
    // Rounding, for this diagram: a million-millionth of its largest value.
    const zero = 1e-12 * stations.reduce((top, s) => Math.max(top, Math.abs(f(s))), 0);
    for (const grid of grids) {
      for (let j = 0; j < grid.length - 1; j++) {
        const x = crossing((xx, side) => f(at(xx, side)), grid[j].x, grid[j + 1].x, f(grid[j]), f(grid[j + 1]), zero);
        if (x === null) continue;
        // On the side of the crossing that is INSIDE this stretch: a root that
        // lands on its far end (the moment dying out at a free end) must not
        // be read past a load or a support there — that put a zero among the
        // extremes of a shear diagram that never reaches zero.
        candidates.push(at(x, x - grid[j].x < grid[j + 1].x - x ? 'right' : 'left'));
      }
    }
  };
  roots((s) => s.w);
  roots((s) => s.V);
  roots((s) => s.M);
  roots((s) => s.EItheta);
  const pick = (of: (s: BeamState) => number, sign: 1 | -1): BeamExtreme => {
    let best = candidates[0];
    for (const s of candidates) if (sign * of(s) > sign * of(best)) best = s;
    return { value: of(best), x: best.x };
  };

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
    residual: { force, moment: moment * L },
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
  // Rounding of the slope, as in the search for the extremes.
  const zero = 1e-12 * Math.max(Math.abs(solution.extremes.EIthetaMax.value), Math.abs(solution.extremes.EIthetaMin.value));
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
      if (inside[j + 1].x - inside[j].x < tol) continue;
      const x = crossing((xx, side) => solution.at(xx, side).EItheta, inside[j].x, inside[j + 1].x, inside[j].EItheta, inside[j + 1].EItheta, zero);
      if (x !== null) consider(solution.at(x));
    }
    return { ...s, EIv: best };
  });
}
