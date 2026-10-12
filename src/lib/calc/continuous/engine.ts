import type { BeamExtreme, BeamReaction, BeamState, Side, SupportKind } from '../beam/solver';
import type { ContinuousIssue, ContinuousJoint, ContinuousModel, ContinuousOutcome, ContinuousSolution, ContinuousSpanResult, SpanDistLoad, SpanPointLoad } from './types';

/**
 * ─────────────────────────────────────────────────────────────────────────────
 * CONTINUOUS BEAM — the engine: one finite element per span
 * ─────────────────────────────────────────────────────────────────────────────
 * The engine of the third calculator of the catalogue ("Continuous beam",
 * /resources/continuous-beam). A beam entered span by span (types.ts), each
 * span with its own stiffness, on supports that may settle: solved here for
 * one set of loads. Every arrangement of the live load is envelope.ts, which
 * asks this file once per case.
 *
 * THE METHOD: direct stiffness, with ONE Euler–Bernoulli element per span.
 *   1. Two unknowns at each joint, its deflection and its rotation. Each
 *      span between two supports brings its own 4 × 4 stiffness, k × the
 *      reference EI over its own length (`stiffnessOf`).
 *   2. The loads of a span enter as its FIXED-END ACTIONS, in closed form:
 *      P·a·b²/l² for a point load, and for a load varying linearly over any
 *      part of the span that same expression integrated — a polynomial, so
 *      the integral is written out, not approximated (`sumsOf`). A support
 *      that settles is fixed-end actions too: with the rotations held, a
 *      span whose ends move apart by g takes 6k·g/l² at each end.
 *   3. The supports are conditions on the unknowns: the deflection of a
 *      support is given (its settlement is in 2.), and so is the rotation
 *      of a fixed end. What is left free — the rotations — is solved for
 *      (`solveStiff`).
 *   4. Each span's end moments are then the element's own equations, and
 *      the moment over a support is that of the two spans meeting there —
 *      the joint's equation says they are one number — taken from the span
 *      that says it with the smaller numbers (`endMoment`): a stiff, loaded
 *      span says a small moment as the difference of two large ones, and
 *      the flexible span beside it says the same moment outright.
 *
 * A SPAN WITH A FREE END is not in those equations. An overhang is a
 * cantilever from its support: it hands that joint the moment of its loads
 * and no stiffness at all, so the two unknowns of its free end are taken
 * out by hand — exactly — before anything is solved. Left in, its stiffness
 * has to cancel itself out at the support, and what rounding left of a
 * stiff overhang was a restraint on the flexible span beside it: 4e-10 of
 * the largest moment with stiffness factors a thousand either way,
 * measured, where it is now 2e-14.
 *
 * INSIDE A SPAN NOTHING IS INTERPOLATED. With its two end moments known a
 * span between two supports is a simply supported beam under its own loads
 * and those two moments, and shear, moment, slope and deflection there are
 * the closed forms of the beam tables, each load by its own (`around`; for
 * a cantilever, `hung`): the value at a point is those formulas worked out
 * at that point. Four things about how:
 *   — The deflection is the straight line through the span's two supports
 *     plus the bending of the span between them, divided by its k. The line
 *     holds the settlements, as they were given; the bending is zero at
 *     both supports, and the moment at each is the joint's own number, by
 *     the form of the expressions and not by rounding.
 *   — A load is never "passed". The first engine's brackets say what a load
 *     does beyond itself as the reaction it causes less the load itself:
 *     one large number less another, for a load near a support — and with a
 *     flexible span beside a stiff one that was 2e-10 of the largest
 *     deflection of the beam (measured, with stiffness factors a thousand
 *     either way; 1e-7 with a million). Here the loads
 *     ahead of a point are summed from one end of the span and the loads
 *     behind it from the other, each as the share of it that the end
 *     carries: a number the size of what the load does there. (A load ON a
 *     support bends nothing: it is in that support's reaction, and nowhere
 *     else.)
 *   — A place is where it was entered. Loads and points are placed in their
 *     span, from its end, and compared as they are — before, at, or after —
 *     with no "close enough": a load a billionth of the span from a support
 *     is that far from it, and two loads that far apart are two loads. Only
 *     a position ALONG THE BEAM, which a page asks for, is matched to one of
 *     those places within rounding (HAIR) — which is why two places that a
 *     position along the beam cannot tell apart are ONE place before
 *     anything is solved (TOUCH, `placedLoads`).
 *   — What the elements were solved for and are NOT used for is the slope:
 *     each span's slope comes from its own bending. That the two spans at a
 *     support then agree on it, and with the rotation the joint was solved
 *     for, is the check that the beam is one piece — compatibility, the one
 *     thing the construction above does not give by itself. It is looked at
 *     before anything is returned (`residual.slope`).
 *
 * WHY ONE ELEMENT PER SPAN IS ENOUGH — and what beam/solver.ts says against
 * finite elements. There, a load a hair from a support made a hair-long
 * element. Here an element is a span and a load adds no node: where a load
 * sits cannot hurt the solution. And the unknowns are rotations, not
 * reactions: two supports close together are two rotations that differ, not
 * two reactions that cannot be told apart. The equations are solved for the
 * same beam with its length 1 — every unknown is then a force — and each
 * unknown in its own unit (`solveStiff`).
 *
 * WHAT IS EXACT, AND WHERE IT STOPS. The formulas are exact; the numbers in
 * them are doubles. Held against an independent solver — direct stiffness
 * on a mesh with a node at every load, in 640-bit arithmetic, itself held
 * against the same in exact fractions — on some forty thousand random
 * beams, at every place where something happens (both sides) and between:
 *   — Ordinary beams (one to six spans, every way of holding the ends,
 *     stiffness factors 0.2 to 5, supports that settle): every value within
 *     3e-13 of the largest of its diagram; each reaction within 8e-12 of
 *     itself, each moment over a support within 3e-12 of itself.
 *   — Whether the supports hold the beam is COUNTED before anything is
 *     solved, as in the first engine: with no fixed end and fewer than two
 *     supports it is a mechanism, whatever its spans are like.
 *   — Short spans and stiffness factors far apart: see SHORT and STIFF.
 *     Neither is where the arithmetic gives out.
 *   — A number holds only so much: see BIG.
 *
 * AND AGAINST A SECOND ONE, BY ANOTHER METHOD: the force method — the
 * moments at the joints for unknowns, Clapeyron's equations written from
 * compatibility, each span's loads integrated piece by piece — in exact
 * fractions, with every condition that makes a beam THE beam checked
 * exactly on each one (the load; V′ = −w, M′ = V, k·θ′ = M, v′ = θ; every
 * support where its settlement puts it; one slope at every support and
 * none in a wall; ΣF and ΣM). On the 89,200 beams of a lattice — one to
 * eight spans, every way of holding their ends, seven patterns of lengths
 * (a span at the limit among them), five of stiffness (0.001 and 1,000 in
 * turn among them), eight of loading, five of settlement — and on some
 * forty thousand random ones, every number a solution holds: the stations,
 * `at` on both sides of every place and between, the reactions, the
 * joints, each span's largest values and where they are, the deflection
 * from each span's own supports.
 *   — Every value within 3e-13 of the largest of its diagram on the random
 *     beams, stiffness factors anywhere from 0.001 to 1,000; within 2e-12
 *     with a span at its shortest between spans a million times apart, on
 *     supports that settle. Against the size of the problem (`loadScale`,
 *     a force): a shear or a reaction within 2e-12 of it; a moment within
 *     1e-15 of it × the length; a slope within 1e-15 of it × length², and
 *     a deflection within 3e-14 of it × length³, each OVER THE SMALLEST
 *     STIFFNESS FACTOR — a deflection grows as 1/k, and what is rounding
 *     in one is to be measured against that.
 *   — In a span whose values are small beside the beam's — a million times
 *     stiffer than the loaded one, or seven spans from it — every value is
 *     within 5e-13 of the largest IN THAT SPAN: a span is right to its own
 *     figures (envelope.ts counts on it).
 *   — Each refusal is the one the rule gives, and nothing held is refused:
 *     of the 72 ways of holding one to eight spans, the 68 that hold are
 *     solved and the 4 that do not are called mechanisms.
 *   — What a position along the beam cannot say is not there to be had.
 *     INSIDE a load shorter than a billionth of the beam the intensity and
 *     the shear are good to about 3e-16 × the beam's length ÷ the load's:
 *     five figures in a load 1e-11 of the beam long. And where a diagram is
 *     all but nothing it is right to 1e-16 of load × length, not of
 *     itself: under a load a billionth of its span from a WALL the moments
 *     are that load times a billionth of a billionth of the span, good to
 *     seven figures.
 *   — What that solver found wrong is in three places below, each with its
 *     numbers: a station read past the support its stretch ends at
 *     (`inside`), two places a position cannot tell apart (TOUCH), and the
 *     grid of equal spans (`cellsIn`). On beams whose places are further
 *     apart than 1e-11 of their length they changed the number of stations
 *     of one beam in twenty-seven, and no number otherwise: on 4,668 such
 *     beams every reaction, moment, slope and deflection is what it was,
 *     to the last figure (seven largest shears, by a rounding).
 *
 * UNITS and SIGNS: types.ts. Any consistent set; loads and settlements
 * positive downward; reactions and deflections positive upward; moment
 * positive sagging; x from the left end of the beam.
 */

/* A load may be entered a rounding past the end of its span — this much of the
   span's length — and is then at that end. */
const EPS = 1e-9;
/* Two positions ALONG THE BEAM closer than this, in units of its length, are
   one: what rounding leaves between two ways of writing the same place (a
   span's start plus a distance, and their sum as a page has it). Fifty
   times the last figure of a position; no two places of a beam are as
   close once its loads are placed (TOUCH). Inside a span nothing is
   compared with a tolerance at all. */
const HAIR = 1e-14;
/* Two places of a span closer than this, in units of the beam's length, are
   ONE place: an end of the span if it is one of the two, otherwise the first
   of them entered. Four hairs, so that a point between two places that is
   within a hair of one is nearer to it than to the other.

   A position along the beam is read within a hair (`at`), and everything
   that reads the beam by position rests on it: this file's own stations,
   a page, and envelope.ts for every case. With two places inside one hair
   those readings were of the wrong one, or of the wrong side of it, and
   what came back was not the beam's (found by an exact solver, by another
   method, held against this one on beams with places a hair apart):
     — a load 2.6e-12 from a wall on a beam of 318: the lowest moment of
       the span returned as 0, and of the beam as −4,490 for −6,429 —
       the place of the load, read from its left, was "before the beam";
     — a load one rounding before the end of its span: in neither span's
       shear, and not on the support — lost, and the beam then refused as
       "too short a span" for the equilibrium it no longer had;
     — two loads with one position along the beam: `breaks` said it twice,
       and what was read there was before both or after one.

   WHAT IT COSTS, measured: the beam as placed against the beam as entered,
   both solved exactly, on 1,500 beams with places a hair apart. No moment,
   slope or deflection moves by more than 2e-14 of the largest there is,
   and no reaction by more than 2e-12 of the loads (the load times the
   4e-14, over the length of its span). What is no longer there is the
   SHEAR BETWEEN the two places: a load that close to a support is ON it —
   in its reaction and in no shear, like any load standing on a support.
   (The first calculator makes one place of two a billionth of the beam
   apart; here it is 4e-14 of it: a hundred-millionth of a millimetre on
   three hundred metres.) */
const TOUCH = 4 * HAIR;

/**
 * A span shorter than this fraction of the beam's whole length is not
 * solved ('short-span'): a thousandth, where the first calculator stops
 * telling two supports apart.
 *
 * MEASURED, with one span or two at a given fraction of the longest,
 * anywhere in beams of two to six spans (every end condition, loads on
 * every span, with and without settlements and stepped stiffness; 2,300
 * random beams per row, the limit taken off):
 *
 *     shortest ÷    largest reaction   worst error of a     worst error of a
 *     longest       ÷ the loads        diagram ÷ its        shear or reaction
 *                                      largest value        ÷ the loads
 *     1/10                  30         7e-14                8e-15
 *     1/100                350         8e-14                9e-14
 *     1/1,000            3,600         1e-13                8e-13
 *     1/10,000          36,000         1e-13                8e-12
 *     1e-5               3.6e5         2e-13                1e-10
 *     1e-6               3.6e6         1e-12                1e-9
 *     1e-7               3.6e7         2e-12                9e-9
 *     1e-8               3.6e8         2e-12                9e-8
 *     1e-9               3.6e9         2e-12                1e-6
 *
 * (Measured once more by the exact solver of the header, 1,500 beams per
 * row: the last column 4e-15, 4e-14, 6e-13, 7e-12, 7e-11, 7e-10, 9e-9, 7e-8
 * and 6e-7 — the same, row for row — and no diagram past 4e-13.)
 *
 * So a short span costs nothing of any diagram measured against its own
 * largest value, and nothing of the moments at all (under 1e-15 of load ×
 * length in every row). What it costs is in what is THE SIZE OF THE LOADS:
 * the two supports of a short span are a clamp, their forces are the moment
 * between them over the span — thousands of times the loads —, and a sum is
 * good to the sixteenth figure of the largest thing in it. A reaction or a
 * shear the size of the loads keeps one figure less for each ten times the
 * span is shorter.
 *
 * The limit is NOT where that reaches the four figures a page prints (a
 * span a billionth of the longest still prints right): at a thousandth,
 * twelve are left. It is kept where the first calculator has its own, so
 * that the two refuse the same beam, and where the reactions a page must
 * print beside each other are no more than a few thousand times apart.
 */
export const SHORT = 1e-3;

/**
 * The stiffness factors the engine takes: from 1/STIFF to STIFF, the
 * reference section being 1 ('stiffness'). Two spans can then be a million
 * times apart.
 *
 * MEASURED, with every factor between 1/range and range and half of them
 * at one end or the other of it (beams of one to eight spans, 1,100 random
 * ones per row, the limit taken off), the worst error of any diagram over
 * its largest value:
 *
 *     range   10      100     1,000   1e4     1e5     1e6     1e8     1e12
 *     now     2e-14   1e-13   1e-13   1e-13   3e-13   1e-13   2e-13   1e-13
 *     before  9e-14   4e-12   7e-10   2e-8    1e-6    6e-7    3e-4    5e-2
 *
 * and each reaction within 4e-12 of itself in every row: nothing is lost to
 * stiffness, at any range. (The exact solver of the header, 1,200 beams per
 * row: 3e-14 in every one.) ("Before": with the overhang left in the
 * equations, the moment over a support taken from one side whatever its
 * neighbour, and the loads summed with the first engine's brackets. Each
 * of the three cost a figure for every ten times the factors were apart.)
 *
 * So the range is not where the arithmetic stops. It is what a stiffness
 * factor can be — a span a thousand times stiffer than the one beside it is
 * a wall to it, and a thousand times more flexible a gap — and it keeps
 * what a solution holds, which grows as 1/k, inside BIG.
 */
export const STIFF = 1e3;

/* The largest and the smallest length, load and settlement the engine
   takes — a load or a settlement of exactly zero is none, and is taken: the
   first engine's limits, for its reasons (a number holds only so much,
   1.8e308, and a link can ask for anything). The smallest is there for the
   other end of what a number holds: under 2.2e-308 it keeps fewer figures
   with every decade, and a load of 1e-316 — alone in its case, as a span's
   live load is in the envelope — failed the engine's own checks of slope
   and equilibrium and came back as a span too short (`lost`), which no
   span was. With lengths and loads both from 1e-60, nothing the engine
   works out of them is that small. What a
   solution holds grows as load × length³ ÷ k: with eight spans, every load
   and the smallest stiffness factor all AT their limits it passes the
   largest number there is, which is why the stations are looked at once
   more before a solution is returned — and the beam refused for its length,
   never returned with something in it that is not a number. */
const BIG = 1e60;
const SMALL = 1e-60;

/* How much of the largest slope two spans may disagree by at a support —
   or a span and the wall it is built into — and still be returned as one
   beam. Rounding leaves 2e-14 of it (measured on eight thousand random
   beams, at the engine's limits and a million times past them; and of the
   loads, 2e-13 at the limits). This is the last word, as the millionth of
   the loads is for equilibrium: neither has ever been reached. */
const KINK = 1e-8;

type Quad = { V: number; M: number; T: number; Y: number };
type Refusal = { ok: false; issues: ContinuousIssue[] };

const other = (side: Side): Side => (side === 'left' ? 'right' : 'left');

/* ── A span seen from one of its ends ─────────────────────────────────── */

/** A point load, `a` from the end the span is seen from and `b` from the other. Downward. */
interface PointOn {
  a: number;
  b: number;
  P: number;
}
/**
 * A distributed load: it starts `a` from the end the span is seen from,
 * ends at `end` from it and `e` short of the other end, running from `wa` to
 * `wb` over `len`. With its slope and its moments about its start,
 * m[n] = ∫ w(t)·tⁿ dt: every sum below is those four numbers times what the
 * place of the load makes of them. (Never "the load running on for ever,
 * less the same from its end on": beam/solver.ts, `addLoadBehind`, says
 * what that did to a short one.)
 */
interface DistOn {
  a: number;
  end: number;
  e: number;
  len: number;
  wa: number;
  wb: number;
  k: number;
  m: number[];
}
const distOn = (a: number, end: number, e: number, len: number, wa: number, wb: number): DistOn => {
  const dw = wb - wa;
  return { a, end, e, len, wa, wb, k: dw / len, m: [len * (wa + dw / 2), len ** 2 * (wa / 2 + dw / 3), len ** 3 * (wa / 3 + dw / 4), len ** 4 * (wa / 4 + dw / 5)] };
};
/** The moments about its start of a piece of a load: from w, at the slope k, over h. */
const momentsOf = (w: number, k: number, h: number): number[] => {
  const h2 = h * h;
  return [h * (w + (k * h) / 2), h2 * (w / 2 + (k * h) / 3), h2 * h * (w / 3 + (k * h) / 4), h2 * h2 * (w / 4 + (k * h) / 5)];
};

/** The loads of a span, placed from one of its ends. */
interface Frame {
  points: PointOn[];
  dists: DistOn[];
}

/**
 * The loads of a span on two supports, about a point s from its left end
 * and t from its right, as the sums everything there follows from. Those
 * AHEAD of the point, seen from the left end (a from it, b from the right
 * end):
 *
 *     B1 = Σ P·b           B3 = Σ P·a·b·(l + b)
 *
 * and those BEHIND it the same seen from the right end, where they are
 * ahead (C1, C3: a and b change places). For a load P at a ≥ s of a simply
 * supported span the beam tables give the left reaction P·b/l, and at s
 *
 *     V = P·b/l      M = P·b·s/l      k·v = −P·b·s·(l² − b² − s²)/6l
 *
 * with l² − b² written a·(l + b), which is what it is and loses nothing
 * when the load is a hair from the end. A distributed load is the same sums
 * as integrals, polynomials in closed form (`piece`); one the point stands
 * inside is cut there, into a load ahead and a load behind.
 *
 * A point AT a load is before it or after it as the side asked for says:
 * the moment, the slope and the deflection are the same either way, and
 * the shear is the one of that side.
 */
function around(left: Frame, right: Frame, l: number, s: number, t: number, side: Side) {
  let B1 = 0;
  let B3 = 0;
  let C1 = 0;
  let C3 = 0;
  for (const p of left.points) {
    if (s < p.a || (s === p.a && side === 'left')) {
      B1 += p.P * p.b;
      B3 += p.P * p.a * p.b * (l + p.b);
    } else {
      C1 += p.P * p.a;
      C3 += p.P * p.a * p.b * (l + p.a);
    }
  }
  left.dists.forEach((g, index) => {
    let ahead: [number, number] = [0, 0];
    let behind: [number, number] = [0, 0];
    if (s <= g.a) ahead = piece(g.a, g.len + g.e, l, g.m);
    else if (s >= g.end) {
      const r = right.dists[index];
      behind = piece(r.a, r.len + r.e, l, r.m);
    } else {
      const past = s - g.a;
      const w = g.wa + g.k * past;
      // From the point to the end of the load; and, in the mirror, from the point back to its start.
      ahead = piece(s, t, l, momentsOf(w, g.k, g.len - past));
      behind = piece(t, s, l, momentsOf(w, -g.k, past));
    }
    B1 += ahead[0];
    B3 += ahead[1];
    C1 += behind[0];
    C3 += behind[1];
  });
  return { B1, B3, C1, C3 };
}
/**
 * Σ P·b and Σ P·a·b·(l + b) of a piece of distributed load that starts a
 * from the near end and b from the far one, from its moments about its
 * start: under the integral a + t, b − t and l + b − t.
 */
function piece(a: number, b: number, l: number, m: number[]): [number, number] {
  const lb = l + b;
  return [b * m[0] - m[1], a * b * lb * m[0] + ((b - a) * lb - a * b) * m[1] - (lb + b - a) * m[2] + m[3]];
}

/**
 * A cantilever, d from its support — the span seen from that end —:
 * [V, M, k·θ, k·v], the last two from the tangent at the support. Each load
 * by its own closed form, again: one ahead of the point (a ≥ d) gives
 *
 *     V = P     M = −P(a − d)     k·θ = −P·d(2a − d)/2     k·v = −P·d²(3a − d)/6
 *
 * and one behind it nothing but the turn and the drop it left at its own
 * place: k·θ = −P·a²/2, k·v = −P·a²(3d − a)/6. Summed as ΣP, ΣP(a − d),
 * ΣP·a² and ΣP·a³ — every term of one sign for loads of one sign.
 */
function hung(f: Frame, d: number, side: Side): Quad {
  let A0 = 0;
  let A1 = 0;
  let S2 = 0;
  let S3 = 0;
  for (const p of f.points) {
    // At the load, the side asked for: before it or after it.
    if (d < p.a || (d === p.a && side === 'left')) {
      A0 += p.P;
      A1 += p.P * (p.a - d);
    } else {
      S2 += p.P * p.a * p.a;
      S3 += p.P * p.a * p.a * p.a;
    }
  }
  for (const g of f.dists) {
    const past = d - g.a;
    if (past <= 0) {
      A0 += g.m[0];
      A1 += g.m[1] - past * g.m[0];
      continue;
    }
    const whole = d >= g.end;
    const behind = whole ? g.m : momentsOf(g.wa, g.k, past);
    S2 += g.a * g.a * behind[0] + 2 * g.a * behind[1] + behind[2];
    S3 += g.a * g.a * g.a * behind[0] + 3 * g.a * g.a * behind[1] + 3 * g.a * behind[2] + behind[3];
    if (!whole) {
      const rest = momentsOf(g.wa + g.k * past, g.k, g.len - past);
      A0 += rest[0];
      A1 += rest[1];
    }
  }
  return { V: A0, M: -A1, T: (-d * (2 * A1 + d * A0)) / 2 - S2 / 2, Y: (-d * d * (3 * A1 + 2 * d * A0)) / 6 - (3 * d * S2 - S3) / 6 };
}

/** The intensity of the distributed load at a point of a span, s from its left end: where a load begins or ends, on the side asked for. */
function intensity(left: Frame, s: number, side: Side): number {
  let w = 0;
  for (const g of left.dists) {
    const inside = side === 'right' ? s >= g.a && s < g.end : s > g.a && s <= g.end;
    // At its end it is what was entered there, to the last figure.
    if (inside) w += s === g.end ? g.wb : g.wa + g.k * (s - g.a);
  }
  return w;
}

/**
 * What a span's loads add up to, seen from one end: their resultant, their
 * moment about that end, the fixed-end moment at that end (the size of it:
 * hogging, for a downward load) and their size as a force, whichever way
 * each points.
 *
 * The fixed-end moment of a point load is P·a·b²/l². Of a distributed load
 * it is that with a + t for a and b − t for b, integrated over the load:
 *
 *     (a + t)(b − t)² = a·b² + (b² − 2ab)·t + (a − 2b)·t² + t³
 *
 * and ∫ w(t)·tⁿ dt are the load's moments m[n] — closed form, for a load of
 * any length anywhere on the span.
 */
function sumsOf(f: Frame, l: number) {
  let W = 0;
  let near = 0;
  let fem = 0;
  let size = 0;
  for (const p of f.points) {
    W += p.P;
    near += p.P * p.a;
    fem += p.P * p.a * p.b * p.b;
    size += Math.abs(p.P);
  }
  for (const g of f.dists) {
    const b = g.len + g.e;
    const m = g.m;
    W += m[0];
    near += g.a * m[0] + m[1];
    fem += g.a * b * b * m[0] + (b * b - 2 * g.a * b) * m[1] + (g.a - 2 * b) * m[2] + m[3];
    size += ((Math.abs(g.wa) + Math.abs(g.wb)) / 2) * g.len;
  }
  return { W, near, fem: fem / (l * l), size };
}

/* ── The joints ───────────────────────────────────────────────────────── */

/**
 * The stiffness of one span, for its two deflections and two rotations
 * [v₁, θ₁, v₂, θ₂]: the Euler–Bernoulli element, EI = k and length l.
 */
function stiffnessOf(k: number, l: number): number[][] {
  const c12 = (12 * k) / (l * l * l);
  const c6 = (6 * k) / (l * l);
  const c4 = (4 * k) / l;
  const c2 = (2 * k) / l;
  return [
    [c12, c6, -c12, c6],
    [c6, c4, -c6, c2],
    [-c12, -c6, c12, -c6],
    [c6, c2, -c6, c4],
  ];
}

/**
 * The free unknowns of the joints: A·x = b, A a stiffness matrix (symmetric,
 * its diagonal positive). Each unknown is first put in its own unit — the
 * one that makes its diagonal 1 — so that the rotation of a short span,
 * whose stiffness is thousands of times its neighbour's, is a number like
 * the others; then Gaussian elimination with partial pivoting. `null` when
 * the matrix is singular, which the count of the supports has already ruled
 * out.
 */
function solveStiff(A: number[][], b: number[]): number[] | null {
  const n = b.length;
  const unit = A.map((row, i) => 1 / Math.sqrt(row[i]));
  if (!unit.every((u) => u > 0 && Number.isFinite(u))) return null;
  const M = A.map((row, i) => [...row.map((v, j) => v * unit[i] * unit[j]), b[i] * unit[i]]);
  for (let c = 0; c < n; c++) {
    let piv = c;
    for (let r = c + 1; r < n; r++) if (Math.abs(M[r][c]) > Math.abs(M[piv][c])) piv = r;
    if (!(Math.abs(M[piv][c]) > 1e-11)) return null;
    [M[c], M[piv]] = [M[piv], M[c]];
    for (let r = c + 1; r < n; r++) {
      const f = M[r][c] / M[c][c];
      if (f === 0) continue;
      for (let j = c; j <= n; j++) M[r][j] -= f * M[c][j];
    }
  }
  const x = new Array<number>(n).fill(0);
  for (let r = n - 1; r >= 0; r--) {
    let s = M[r][n];
    for (let j = r + 1; j < n; j++) s -= M[r][j] * x[j];
    x[r] = s / M[r][r];
  }
  return x.every(Number.isFinite) ? x.map((v, i) => v * unit[i]) : null;
}

/* ── A stretch of the beam as the polynomials it is ───────────────────── */

/**
 * Between two places where something happens — a support, a load, an end of
 * one — every response is one polynomial: the load a straight line, the
 * shear a parabola, and so on up to the deflection, of the fifth degree.
 * Here they are, by their coefficients in u, which runs from 0 at the start
 * of the stretch to 1 at its end (lowest power first).
 *
 * They are for FINDING where a response turns or changes sign. What the
 * response is there is then read by the span's own formulas, like any
 * other point.
 */
export interface Stretch {
  w: number[];
  V: number[];
  M: number[];
  /** EI·θ and EI·v, as the state they were made from has them. */
  T: number[];
  Y: number[];
}

/**
 * The polynomials of a stretch of length h in a span of stiffness factor k,
 * from the state at its start (on the stretch's side of it) and the
 * intensity of the load at its end: dV = −w, dM = V, k·d(EIθ) = M,
 * d(EIv) = EIθ, integrated from the start. Any consistent units.
 */
export function stretchOf(start: { w: number; V: number; M: number; EItheta: number; EIv: number }, wEnd: number, h: number, k: number): Stretch {
  const { w: w0, V: V0, M: M0, EItheta: T0, EIv: Y0 } = start;
  const dw = wEnd - w0;
  const h2 = h * h;
  const h3 = h2 * h;
  const h4 = h3 * h;
  return {
    w: [w0, dw],
    V: [V0, -h * w0, (-h * dw) / 2],
    M: [M0, h * V0, (-h2 * w0) / 2, (-h2 * dw) / 6],
    T: [T0, (h * M0) / k, (h2 * V0) / (2 * k), (-h3 * w0) / (6 * k), (-h3 * dw) / (24 * k)],
    Y: [Y0, h * T0, (h2 * M0) / (2 * k), (h3 * V0) / (6 * k), (-h4 * w0) / (24 * k), (-h4 * dw) / (120 * k)],
  };
}

export function polyAt(c: number[], u: number): number {
  let v = 0;
  for (let i = c.length - 1; i >= 0; i--) v = v * u + c[i];
  return v;
}

/**
 * Where a polynomial changes sign between lo and hi, ascending — every
 * place, not the ones a grid happens to straddle. Between two consecutive
 * roots of its derivative a polynomial only rises or only falls, so it
 * crosses zero there once or not at all: the derivative's roots are found
 * first (the same way, down to a straight line), and each stretch between
 * them that changes sign is closed by Newton's method kept inside it.
 *
 * A place where it only touches zero is not one: nothing changes sign.
 */
export function polyRoots(c: number[], lo = 0, hi = 1): number[] {
  let n = c.length;
  while (n > 1 && c[n - 1] === 0) n -= 1;
  if (n <= 1) return [];
  if (n === 2) {
    const r = -c[0] / c[1];
    return r > lo && r < hi ? [r] : [];
  }
  const p = n === c.length ? c : c.slice(0, n);
  const dp = p.slice(1).map((v, i) => v * (i + 1));
  const turns = [lo, ...polyRoots(dp, lo, hi), hi];
  const roots: number[] = [];
  for (let i = 0; i < turns.length - 1; i++) {
    const fa = polyAt(p, turns[i]);
    const fb = polyAt(p, turns[i + 1]);
    // Zero at an end of the stretch is that end, which the caller has; rising or falling from it, it is not zero again inside.
    if (fa === 0 || fb === 0 || fa < 0 === fb < 0 || Number.isNaN(fa) || Number.isNaN(fb)) continue;
    let a = turns[i];
    let b = turns[i + 1];
    let x = (a + b) / 2;
    for (let it = 0; it < 80; it++) {
      const fx = polyAt(p, x);
      if (fx === 0) break;
      if (fa < 0 === fx < 0) a = x;
      else b = x;
      let next = x - fx / polyAt(dp, x);
      if (!(next > a && next < b)) next = (a + b) / 2;
      const moved = Math.abs(next - x);
      x = next;
      if (moved <= 1e-16 * Math.max(1, Math.abs(x)) || b - a <= 1e-16) break;
    }
    roots.push(x);
  }
  return roots;
}

/**
 * How many cells a stretch is drawn with: its share of the beam's length × 240, and never under 24. The first
 * engine's grid — less a rounding: a third of the beam is 80 cells however the third was worked out. This file has
 * a share from the spans' own lengths and envelope.ts from positions along the beam; for one of the two a third
 * × 240 was a hair over 80, and on 18 of 48 beams of equal spans the two had not the same stations.
 */
export const cellsIn = (share: number): number => Math.max(24, Math.ceil(share * 240 * (1 - 1e-12)));

/* ── The loads, each at its place ─────────────────────────────────────── */

/**
 * The loads of a model the engine takes, with every place that is within
 * TOUCH of another brought to it: to an end of its span, or to the first
 * load entered there (points in their order, then distributed loads). A
 * model with no two places that close comes back as it is, to the last
 * figure — which is every model a form hands over.
 *
 * A distributed load one of whose ends is moved keeps what it adds up to:
 * its intensities are stretched by what its length lost or gained. One
 * whose two ends are one place is that resultant, there — a point load —
 * and not dropped: an intensity can be anything, and so can what a load a
 * hair long carries.
 *
 * The places that come back are further apart than TOUCH or the same, so
 * the loads of any part of the model are at the same places as in the
 * whole: envelope.ts solves its cases on this, and every case has its loads
 * where the others have theirs.
 */
export function placedLoads(model: ContinuousModel): { points: SpanPointLoad[]; dists: SpanDistLoad[] } {
  const spans = model.spans;
  const touch = TOUCH * spans.reduce((sum, s) => sum + s.L, 0);
  /** The places of each span so far: its two ends first. */
  const places = spans.map((s) => [0, s.L]);
  const clamp = (span: number, a: number) => Math.min(spans[span].L, Math.max(0, a));
  /** The place of a position: the nearest one within TOUCH, or a new one. */
  const put = (span: number, a: number): number => {
    let found: number | null = null;
    for (const p of places[span]) if (Math.abs(p - a) <= touch && (found === null || Math.abs(p - a) < Math.abs(found - a))) found = p;
    if (found !== null) return found;
    places[span].push(a);
    return a;
  };
  const points: SpanPointLoad[] = [];
  const dists: SpanDistLoad[] = [];
  /** Distributed loads that are one place long. */
  const gathered: SpanPointLoad[] = [];
  for (const p of model.points ?? []) {
    // (No load: it has no place.)
    if (p.P === 0) {
      points.push(p);
      continue;
    }
    const a = put(p.span, clamp(p.span, p.a));
    points.push(a === clamp(p.span, p.a) ? p : { ...p, a });
  }
  for (const d of model.dists ?? []) {
    const [a1, a2, w1, w2] = d.a1 <= d.a2 ? [clamp(d.span, d.a1), clamp(d.span, d.a2), d.w1, d.w2] : [clamp(d.span, d.a2), clamp(d.span, d.a1), d.w2, d.w1];
    if (!(a2 > a1) || (w1 === 0 && w2 === 0)) {
      dists.push(d);
      continue;
    }
    const p1 = put(d.span, a1);
    const p2 = put(d.span, a2);
    if (p1 === a1 && p2 === a2) dists.push(d);
    else if (p2 > p1) {
      const stretch = (a2 - a1) / (p2 - p1);
      dists.push({ ...d, a1: p1, a2: p2, w1: w1 * stretch, w2: w2 * stretch });
    } else {
      const P = ((w1 + w2) / 2) * (a2 - a1);
      if (P !== 0) gathered.push({ span: d.span, a: p1, P, ...(d.live ? { live: true } : {}) });
    }
  }
  return { points: [...points, ...gathered], dists };
}

/* ── The beam ─────────────────────────────────────────────────────────── */

/**
 * A solved beam, with what envelope.ts needs of it beyond what a page does:
 * the response in one span with the slope and the deflection MEASURED FROM
 * THAT SPAN'S OWN SUPPORTS (types.ts, `EIvChord`) — worked out as that, not
 * as a deflection less a line, which under a large settlement is one large
 * number less another.
 */
export interface ContinuousCase extends ContinuousSolution {
  fromSupports(index: number, x: number, side?: Side): BeamState;
  /** The span a position along the beam is read in by `at`: at a joint, the one on the side asked for. */
  spanOf(x: number, side?: Side): number;
}

/** A place in a span: s from its left end and t from its right (both, so that neither is "the length less the other"), and x along the beam. */
interface Place {
  s: number;
  t: number;
  x: number;
}

/** What one span is, once the joints are known. Lengths in units of the beam's length. */
interface Span {
  l: number;
  k: number;
  /** Not a cantilever, or one from its left end, or from its right. */
  root: 'none' | 'left' | 'right';
  left: Frame;
  right: Frame;
  /** The moment at its two ends, sagging positive. */
  Ma: number;
  Mb: number;
  /**
   * The straight line the bending is measured from — through its two
   * supports, or from its one — as reference EI × a deflection in the
   * CALLER'S units (a settlement is given in them, and is returned as it
   * was given), and that line's slope.
   */
  line: (at: Place) => number;
  slope: number;
  /** The same line measured from the span's own supports: nothing for a span, the turning of its support for a cantilever. */
  own: (at: Place) => number;
  ownSlope: number;
  /** Where something happens in it, its two ends included, in order. */
  marks: Place[];
}

/**
 * A point of a span: the state there — the deflection as the line and, apart,
 * the bending (`B`: over the span's k, in units of the beam's length) —, and
 * beside it the slope and the line from the span's own supports.
 */
interface Reading {
  x: number;
  w: number;
  V: number;
  M: number;
  T: number;
  Tc: number;
  B: number;
  line: number;
  own: number;
}

export function solveContinuous(model: ContinuousModel): ContinuousOutcome {
  return solveCase(model);
}

export function solveCase(model: ContinuousModel): ContinuousCase | Refusal {
  const spansIn = model.spans ?? [];
  const n = spansIn.length;
  if (n === 0) return { ok: false, issues: [{ code: 'no-spans' }] };
  // As they were entered, for what is wrong with them; each at its place (`placedLoads`), once the model is taken.
  let pointsIn = model.points ?? [];
  let distsIn = model.dists ?? [];
  const settled = model.settlements ?? [];
  const leftKind = model.left === 'pin' || model.left === 'fixed' ? model.left : 'free';
  const rightKind = model.right === 'pin' || model.right === 'fixed' ? model.right : 'free';
  /** Is there a support under joint j? */
  const held = (j: number) => (j === 0 ? leftKind !== 'free' : j === n ? rightKind !== 'free' : true);
  const wall = (j: number) => (j === 0 && leftKind === 'fixed') || (j === n && rightKind === 'fixed');

  /* ── What was entered, checked ─────────────────────────────────────── */
  const issues: ContinuousIssue[] = [];
  const sized = (...v: number[]) => v.every((s) => s === 0 || (Math.abs(s) >= SMALL && Math.abs(s) <= BIG));
  const sound = spansIn.map((s) => s.L >= SMALL && s.L <= BIG);
  spansIn.forEach((s, index) => {
    if (!sound[index]) issues.push({ code: 'length', where: { list: 'spans', index } });
    if (!(s.k >= 1 / STIFF && s.k <= STIFF)) issues.push({ code: 'stiffness', where: { list: 'spans', index } });
  });
  for (let j = 0; j <= n; j++) if (held(j) && !sized(settled[j] ?? 0)) issues.push({ code: 'number', where: { list: 'settlements', index: j } });
  /** Is there such a span, and is the position on it? (A span whose own length is at fault has no "on it" to ask about.) */
  const there = (span: number) => Number.isInteger(span) && span >= 0 && span < n;
  const on = (span: number, a: number) => !sound[span] || (a >= -EPS * spansIn[span].L && a <= spansIn[span].L * (1 + EPS));
  pointsIn.forEach((p, index) => {
    if (!Number.isFinite(p.a) || !sized(p.P)) issues.push({ code: 'number', where: { list: 'points', index } });
    else if (!there(p.span) || !on(p.span, p.a)) issues.push({ code: 'outside', where: { list: 'points', index } });
  });
  distsIn.forEach((d, index) => {
    if (!Number.isFinite(d.a1) || !Number.isFinite(d.a2) || !sized(d.w1, d.w2)) issues.push({ code: 'number', where: { list: 'dists', index } });
    else if (!there(d.span) || !on(d.span, d.a1) || !on(d.span, d.a2)) issues.push({ code: 'outside', where: { list: 'dists', index } });
  });
  if (issues.length) return { ok: false, issues };

  /* ── Is it held, and is every span one the engine takes? ───────────── */
  // A beam with no hinge is one straight line when nothing bends: a fixed
  // end holds it, or two supports. Counted, not left to the elimination —
  // and a mechanism is called one whatever else is true of it.
  const walls = (leftKind === 'fixed' ? 1 : 0) + (rightKind === 'fixed' ? 1 : 0);
  const rests = n - 1 + (leftKind === 'pin' ? 1 : 0) + (rightKind === 'pin' ? 1 : 0);
  if (walls === 0 && rests < 2) return { ok: false, issues: [{ code: 'unstable' }] };

  const length = spansIn.reduce((sum, s) => sum + s.L, 0);
  spansIn.forEach((s, index) => {
    // (Less a rounding: three spans that add up to a thousand times the first are not under the limit.)
    if (s.L < SHORT * (1 - 1e-9) * length) issues.push({ code: 'short-span', where: { list: 'spans', index } });
  });
  if (issues.length) return { ok: false, issues };
  ({ points: pointsIn, dists: distsIn } = placedLoads(model));

  /* ── The same beam with its length 1: lengths ÷ length, w × length, settlements ÷ length³ ── */
  /** Where each joint is along the beam, as the caller's lengths add up. */
  const X: number[] = [0];
  for (const s of spansIn) X.push(X[X.length - 1] + s.L);
  const L2 = length * length;
  const L3 = L2 * length;
  /** Reference EI × the deflection of each support, as it was given: minus its settlement. */
  const v = X.map((_, j) => (held(j) ? -(settled[j] ?? 0) : 0));

  const spans: Span[] = spansIn.map((s, i) => ({
    l: s.L / length,
    k: s.k,
    root: held(i) && held(i + 1) ? 'none' : held(i) ? 'left' : 'right',
    left: { points: [], dists: [] },
    right: { points: [], dists: [] },
    Ma: 0,
    Mb: 0,
    line: () => 0,
    slope: 0,
    own: () => 0,
    ownSlope: 0,
    marks: [],
  }));
  /* What stands ON each support. It bends no span, and the shear either side
     of the support does not show it: the support carries it, on top of what
     the two spans bring. */
  const onSupport = X.map(() => 0);
  /** On the span: a position a rounding off its end is its end. */
  const clamp = (a: number, L: number) => Math.min(L, Math.max(0, a));
  // Every distance is from what was entered — to the far end too, which is
  // not "the length less a rounded distance" — and a place is the same
  // number wherever it is written: a point is AT a load when the two are
  // equal, with nothing to be "near enough".
  const place = (i: number, a: number): Place => ({ s: a / length, t: (spansIn[i].L - a) / length, x: X[i] + a });
  for (const p of pointsIn) {
    if (p.P === 0) continue;
    const sp = spans[p.span];
    const at = place(p.span, clamp(p.a, spansIn[p.span].L));
    sp.left.points.push({ a: at.s, b: at.t, P: p.P });
    sp.right.points.push({ a: at.t, b: at.s, P: p.P });
    sp.marks.push(at);
    if (at.s === 0 && held(p.span)) onSupport[p.span] += p.P;
    else if (at.t === 0 && held(p.span + 1)) onSupport[p.span + 1] += p.P;
  }
  for (const d of distsIn) {
    const sp = spans[d.span];
    const L = spansIn[d.span].L;
    // Entered right to left, it is the same load.
    const [a1, a2, w1, w2] = d.a1 <= d.a2 ? [clamp(d.a1, L), clamp(d.a2, L), d.w1, d.w2] : [clamp(d.a2, L), clamp(d.a1, L), d.w2, d.w1];
    const len = (a2 - a1) / length;
    // One with no length, or no intensity, is no load.
    if (!(len > 0) || (w1 === 0 && w2 === 0)) continue;
    const [start, end] = [place(d.span, a1), place(d.span, a2)];
    sp.left.dists.push(distOn(start.s, end.s, end.t, len, w1 * length, w2 * length));
    sp.right.dists.push(distOn(end.t, start.t, start.s, len, w2 * length, w1 * length));
    sp.marks.push(start, end);
  }
  spans.forEach((sp, i) => {
    const inside = sp.marks.filter((m) => m.s > 0 && m.t > 0).sort((p, q) => p.s - q.s);
    sp.marks = [{ s: 0, t: sp.l, x: X[i] }, ...inside.filter((m, j) => j === 0 || m.s !== inside[j - 1].s), { s: sp.l, t: 0, x: X[i + 1] }];
  });

  /* ── The joints: assemble, hold, solve ─────────────────────────────── */
  const sums = spans.map((sp) => ({ left: sumsOf(sp.left, sp.l), right: sumsOf(sp.right, sp.l) }));
  /** How far apart the two supports of a span have moved (reference EI ×, the right one less the left, downward); nothing for a cantilever. */
  const gap = spans.map((sp, i) => (sp.root === 'none' ? (v[i] - v[i + 1]) / L3 : 0));
  const N = 2 * (n + 1);
  const K = Array.from({ length: N }, () => new Array<number>(N).fill(0));
  /** The fixed-end actions on each unknown: what holds every joint still. */
  const fixed = new Array<number>(N).fill(0);
  /** Each span's own two fixed-end moments, counter-clockwise on the span: at its left end and at its right. */
  const fixedOf: [number, number][] = [];
  const stiff: number[][][] = [];
  spans.forEach((sp, i) => {
    const ke = stiffnessOf(sp.k, sp.l);
    stiff.push(ke);
    if (sp.root !== 'none') {
      // An overhang: no stiffness, and on the joint of its support the moment of its loads about it.
      if (sp.root === 'left') fixed[2 * i + 1] += sums[i].left.near;
      else fixed[2 * i + 3] -= sums[i].right.near;
      fixedOf.push([0, 0]);
      return;
    }
    const f: [number, number] = [sums[i].left.fem + ke[1][0] * gap[i], -sums[i].right.fem + ke[1][0] * gap[i]];
    fixed[2 * i + 1] += f[0];
    fixed[2 * i + 3] += f[1];
    for (let a = 0; a < 4; a++) for (let b = 0; b < 4; b++) K[2 * i + a][2 * i + b] += ke[a][b];
    fixedOf.push(f);
  });
  // Free: the rotation of every support but a fixed end. (The deflections
  // are given: of a support by its settlement, which is in the fixed-end
  // actions; of a free end by its cantilever.)
  const free: number[] = [];
  for (let j = 0; j <= n; j++) if (held(j) && !wall(j)) free.push(2 * j + 1);
  const solved = solveStiff(
    free.map((r) => free.map((c) => K[r][c])),
    free.map((r) => -fixed[r]),
  );
  /* The beam is held and every span is one the engine takes, so the
     equations go through and what comes back is one beam. Should the
     arithmetic fail all the same, the beam is refused as what it then is —
     too much for these numbers — and never as a mechanism, which it is not:
     by its shortest span, or by the stiffness factor furthest from 1,
     whichever is nearer its limit. */
  const lost = (): Refusal => {
    let short = 0;
    let far = 0;
    spans.forEach((sp, i) => {
      if (sp.l < spans[short].l) short = i;
      if (Math.abs(Math.log(sp.k)) > Math.abs(Math.log(spans[far].k))) far = i;
    });
    const byLength = Math.log(spans[short].l) / Math.log(SHORT);
    const byStiffness = Math.abs(Math.log(spans[far].k)) / Math.log(STIFF);
    return { ok: false, issues: [n > 1 && byLength >= byStiffness ? { code: 'short-span', where: { list: 'spans', index: short } } : { code: 'stiffness', where: { list: 'spans', index: far } }] };
  };
  if (!solved) return lost();
  /** Reference EI × the rotation of each joint that was solved for. */
  const turn = new Array<number>(n + 1).fill(0);
  free.forEach((r, i) => (turn[(r - 1) / 2] = solved[i]));

  /* ── The moment at each joint ──────────────────────────────────────── */
  // The element's equation for the moment at one of its ends, counter-
  // clockwise on the span, and the size of what it is added up from.
  const endMoment = (i: number, end: 0 | 1) => {
    const ke = stiff[i][end === 0 ? 1 : 3];
    const parts = [ke[1] * turn[i], ke[3] * turn[i + 1], fixedOf[i][end]];
    return { value: parts[0] + parts[1] + parts[2], mass: Math.abs(parts[0]) + Math.abs(parts[1]) + Math.abs(parts[2]) };
  };
  /** Sagging positive. */
  const jointM = X.map((_, j) => {
    // Nothing turns a free end, or a simple support at an end of the beam.
    if (!held(j) || (j === 0 && leftKind === 'pin') || (j === n && rightKind === 'pin')) return 0;
    // The support of an overhang: the moment there is the overhang's loads about it. Statics.
    if (j < n && spans[j].root === 'left') return -sums[j].left.near;
    if (j > 0 && spans[j - 1].root === 'right') return -sums[j - 1].right.near;
    if (j === 0) return -endMoment(0, 0).value;
    if (j === n) return endMoment(n - 1, 1).value;
    const before = endMoment(j - 1, 1);
    const after = endMoment(j, 0);
    return before.mass <= after.mass ? before.value : -after.value;
  });

  /* ── Each span, by its own formulas ────────────────────────────────── */
  /** A point of span i; where the shear jumps, on the side asked for. With the span's line at zero. */
  const bend = (i: number, { s, t }: Place, side: Side): Quad => {
    const sp = spans[i];
    const { l } = sp;
    if (sp.root === 'left') return hung(sp.left, s, side);
    if (sp.root === 'right') {
      // In the mirror the shear and the slope change sign, and left is right.
      const q = hung(sp.right, t, other(side));
      return { V: -q.V, M: q.M, T: -q.T, Y: q.Y };
    }
    // On two supports: the loads ahead of the point, seen from the left end;
    // the loads behind it, ahead in the mirror; and the two end moments. At
    // an end t/l or s/l is 1 and the other 0: the moment there is the
    // joint's own number, and the bending is zero.
    const { B1, B3, C1, C3 } = around(sp.left, sp.right, l, s, t, side);
    const { Ma, Mb } = sp;
    return {
      V: (B1 - C1 + (Mb - Ma)) / l,
      M: Ma * (t / l) + Mb * (s / l) + (B1 * s + C1 * t) / l,
      T: (3 * s * s * B1 - B3 - (3 * t * t * C1 - C3) + Ma * (l * l - 3 * t * t) - Mb * (l * l - 3 * s * s)) / (6 * l),
      Y: -(s * (B3 - s * s * B1) + t * (C3 - t * t * C1) + s * t * (Ma * (l + t) + Mb * (l + s))) / (6 * l),
    };
  };
  const read = (i: number, at: Place, side: Side): Reading => {
    const sp = spans[i];
    const q = bend(i, at, side);
    const T = q.T / sp.k;
    return { x: at.x, w: intensity(sp.left, at.s, side), V: q.V, M: q.M, T: sp.slope + T, Tc: sp.ownSlope + T, B: q.Y / sp.k, line: sp.line(at), own: sp.own(at) };
  };
  const first = (i: number) => spans[i].marks[0];
  const last = (i: number) => spans[i].marks[spans[i].marks.length - 1];
  spans.forEach((sp, i) => {
    if (sp.root !== 'none') return;
    const { l } = sp;
    const [va, vb] = [v[i], v[i + 1]];
    sp.Ma = jointM[i];
    sp.Mb = jointM[i + 1];
    // At an end one of the two shares is 1 and the other 0: the support is where its settlement puts it, to the last figure.
    sp.line = ({ s, t }) => va * (t / l) + vb * (s / l);
    sp.slope = (vb - va) / L3 / l;
  });
  /** Reference EI × the slope of a span at one of its ends, from its own bending. */
  const endSlope = (i: number, end: 'left' | 'right') => (end === 'left' ? read(i, first(i), 'right').T : read(i, last(i), 'left').T);
  spans.forEach((sp, i) => {
    if (sp.root === 'none') return;
    // It turns with its support: with the span beside it, or not at all in a wall.
    const j = sp.root === 'left' ? i : i + 1;
    const turned = wall(j) ? 0 : sp.root === 'left' ? endSlope(i - 1, 'right') : endSlope(i + 1, 'left');
    sp.slope = sp.ownSlope = turned;
    sp.own = sp.root === 'left' ? ({ s }) => turned * s * L3 : ({ t }) => -turned * t * L3;
    sp.line = (at) => v[j] + sp.own(at);
  });

  /* ── Back in the caller's units ────────────────────────────────────── */
  const hair = HAIR * length;
  // (Plus zero: a zero is written 0, never −0.)
  const state = (r: Reading, own = false): BeamState => ({ x: r.x, w: r.w / length + 0, V: r.V + 0, M: r.M * length + 0, EItheta: (own ? r.Tc : r.T) * L2 + 0, EIv: (own ? r.own : r.line) + r.B * L3 + 0 });
  /** The span a position is in; at a joint, the one on the side asked for. */
  const spanAt = (x: number, side: Side) => {
    let i = 0;
    while (i < n - 1 && (x > X[i + 1] + hair || (x >= X[i + 1] - hair && side === 'right'))) i += 1;
    return i;
  };
  /* A position of the beam as a place of span i. One where something happens
     is that place as the span has it, not "x less where the span starts":
     that difference is good to a rounding of the beam's length, and under a
     load a hair from a support that rounding, times the shear, was the
     eleventh figure of the moment there. */
  const within = (i: number, x: number): Place => {
    let found: Place | null = null;
    for (const m of spans[i].marks) if (Math.abs(m.x - x) <= hair && (found === null || Math.abs(m.x - x) < Math.abs(found.x - x))) found = m;
    if (found) return { ...found, x };
    const s = Math.min(spans[i].l, Math.max(0, (x - X[i]) / length));
    return { s, t: spans[i].l - s, x };
  };
  const at = (x: number, side?: Side): BeamState => {
    const xc = Math.min(length, Math.max(0, x));
    const s: Side = side ?? (xc >= length - hair ? 'left' : 'right');
    // Past an end there is no beam: no shear, no moment, and the end's own slope and deflection.
    if (xc <= hair && s === 'left') return { ...state(read(0, { ...first(0), x: xc }, 'right')), w: 0, V: 0, M: 0 };
    if (xc >= length - hair && s === 'right') return { ...state(read(n - 1, { ...last(n - 1), x: xc }, 'left')), w: 0, V: 0, M: 0 };
    const i = spanAt(xc, s);
    return state(read(i, within(i, xc), s));
  };
  const spanOf = (x: number, side?: Side): number => {
    const xc = Math.min(length, Math.max(0, x));
    return spanAt(xc, side ?? (xc >= length - hair ? 'left' : 'right'));
  };
  const fromSupports = (index: number, x: number, side?: Side): BeamState => {
    const i = Math.min(n - 1, Math.max(0, Math.trunc(index) || 0));
    const xc = Math.min(X[i + 1], Math.max(X[i], x));
    return state(read(i, within(i, xc), side ?? (xc >= X[i + 1] - hair ? 'left' : 'right')), true);
  };

  /* ── Reactions, and what is left over ──────────────────────────────── */
  let pinned = false;
  const kindOf = (j: number): SupportKind | null => {
    if (!held(j)) return null;
    if (wall(j)) return 'fixed';
    if (pinned) return 'roller';
    pinned = true;
    return 'pin';
  };
  const kinds = X.map((_, j) => kindOf(j));
  /** The upward force of each support: what stands on it, and the shear either side of it. */
  const Rv = X.map((_, j) => (held(j) ? onSupport[j] + (j < n ? read(j, first(j), 'right').V : 0) - (j > 0 ? read(j - 1, last(j - 1), 'left').V : 0) : 0));
  /** The moment of a wall on the beam, counter-clockwise (in units of force × the length). */
  const Rm = X.map((_, j) => (j === 0 && leftKind === 'fixed' ? -jointM[0] : j === n && rightKind === 'fixed' ? jointM[n] : 0));
  const reactions: BeamReaction[] = [];
  X.forEach((x, j) => {
    const kind = kinds[j];
    if (kind) reactions.push({ x, kind, Rv: Rv[j] + 0, Rm: Rm[j] * length + 0 });
  });
  const totalLoad = sums.reduce((sum, s) => sum + s.left.W, 0);
  // The size of the problem as a force: the loads, and for a span whose
  // supports settle apart the moment that takes with its ends held, over
  // the beam's length. What rounding is measured against.
  const size = sums.reduce((sum, s, i) => sum + s.left.size + Math.abs(stiff[i][1][0] * gap[i]), 0);
  const force = Rv.reduce((sum, r) => sum + r, 0) - totalLoad;
  // About x = 0, counter-clockwise, per unit of the length: the loads from
  // the model — each span's resultant at its start, plus its moment about
  // that start — and not from the response.
  const moment = Rv.reduce((sum, r, j) => sum + (r * X[j]) / length, 0) + Rm[0] + Rm[n] - sums.reduce((sum, s, i) => sum + (s.left.W * X[i]) / length + s.left.near, 0);

  /* ── Stations ──────────────────────────────────────────────────────── */
  // Both sides of everything that happens, and a grid between: the first
  // engine's. Kept span by span, and stretch by stretch, for what follows.
  // Each is the formula at its x — read from x as `at` reads it, so that
  // asking for a station's place gives the station back.
  /* A point of the stretch from a to b of span i, read from x as `at` reads
     it — and from INSIDE the stretch. Where two places are a few hairs
     apart a point between them is within a hair of one and IS that one;
     read there on the far side it would be past the load, or past the
     support, the stretch ends at. Past a load that is the diagram a hair
     early; past a support with a load standing on it, it is a shear the
     beam has nowhere — and it was returned as the largest of the beam
     (100 on a support and anything 4e-12 before it, on two spans of 10
     under 1: −106.25 for −6.25). */
  const inside = (i: number, a: Place, b: Place, x: number): Reading => {
    const at = within(i, x);
    if (at.s >= b.s) return read(i, { ...b, x }, 'left');
    if (at.s <= a.s) return read(i, { ...a, x }, 'right');
    return read(i, at, 'right');
  };
  const readings: Reading[][][] = spans.map((sp, i) =>
    sp.marks.slice(0, -1).map((a, m) => {
      const b = sp.marks[m + 1];
      const cells = cellsIn(b.s - a.s);
      const row: Reading[] = [read(i, a, 'right')];
      for (let j = 1; j < cells; j++) row.push(inside(i, a, b, a.x + ((b.x - a.x) * j) / cells));
      row.push(read(i, b, 'left'));
      return row;
    }),
  );
  const stations: BeamState[] = readings.flatMap((rows) => rows.flatMap((row) => row.map((r) => state(r))));
  // The limits on what is entered keep these numbers; at those limits a
  // deflection can still pass the largest number there is. That is no
  // solution, and it is the length, cubed, that took it there.
  if (!stations.every((s) => Number.isFinite(s.x) && Number.isFinite(s.w) && Number.isFinite(s.V) && Number.isFinite(s.M) && Number.isFinite(s.EItheta) && Number.isFinite(s.EIv))) return { ok: false, issues: [{ code: 'length' }] };

  /* ── Is it one beam? ───────────────────────────────────────────────── */
  // The reactions carry the loads by construction; they are added up all
  // the same, as the first engine does, and no beam is returned with more
  // than a millionth of its loads left over.
  if (![force, moment].every((left) => Math.abs(left) <= 1e-6 * size)) return lost();
  // The slope at each support, said three times: by the span before it, by
  // the span after it, and by the rotation the joint was solved for (none,
  // at a fixed end). Measured against the largest slope there is — and
  // against the size of the problem, for a beam whose loads all stand on
  // its supports: nothing bends, every slope is rounding, and rounding is
  // no kink.
  let kink = 0;
  for (let j = 0; j <= n; j++) {
    if (!held(j)) continue;
    const said: number[] = [turn[j]];
    if (j > 0) said.push(endSlope(j - 1, 'right'));
    if (j < n) said.push(endSlope(j, 'left'));
    kink = Math.max(kink, Math.max(...said) - Math.min(...said));
  }
  const all = readings.flat(2);
  const steepest = all.reduce((top, r) => Math.max(top, Math.abs(r.T)), 0);
  if (!(kink <= KINK * steepest + (1e-12 * size) / Math.min(...spans.map((sp) => sp.k)))) return lost();

  /* ── Extremes ──────────────────────────────────────────────────────── */
  // On a stretch every response is one polynomial, so its extreme is at an
  // end of the stretch or where its derivative changes sign: V where w does,
  // M where V does, the slope where M does, the deflection where the slope
  // does. Every one of those places is found (`polyRoots`), and read there
  // by the span's own formulas like any other point.
  const candidates: Reading[][] = readings.map((rows, i) => {
    const sp = spans[i];
    const list = rows.flat();
    rows.forEach((row, m) => {
      const a = sp.marks[m];
      const b = sp.marks[m + 1];
      const start = row[0];
      const st = stretchOf({ w: start.w, V: start.V, M: start.M, EItheta: start.T, EIv: 0 }, row[row.length - 1].w, b.s - a.s, sp.k);
      // From its own supports the slope differs by a constant: the same polynomial but for its first coefficient.
      const own = [start.Tc, ...st.T.slice(1)];
      for (const u of new Set([...polyRoots(st.w), ...polyRoots(st.V), ...polyRoots(st.M), ...polyRoots(st.T), ...polyRoots(own)])) {
        if (!(u > 0 && u < 1)) continue;
        // From inside this stretch, should the root land on one of its ends.
        list.push(inside(i, a, b, a.x + (b.x - a.x) * u));
      }
    });
    return list;
  });
  const pick = (list: Reading[], of: (r: Reading) => number, sign: 1 | -1): BeamExtreme => {
    let best = list[0];
    for (const r of list) if (sign * of(r) > sign * of(best)) best = r;
    return { value: of(best) + 0, x: best.x };
  };
  /** Each response of a reading, in the caller's units. */
  const of = {
    V: (r: Reading) => r.V,
    M: (r: Reading) => r.M * length,
    T: (r: Reading) => r.T * L2,
    Y: (r: Reading) => r.line + r.B * L3,
    own: (r: Reading) => r.own + r.B * L3,
  };
  const everywhere = candidates.flat();
  const spanResults: ContinuousSpanResult[] = spans.map((sp, i) => {
    const list = candidates[i];
    const up = pick(list, of.own, 1);
    const down = pick(list, of.own, -1);
    const chord = Math.abs(down.value) > Math.abs(up.value) ? down : up;
    return {
      index: i,
      from: X[i],
      to: X[i + 1],
      kind: sp.root === 'none' ? 'span' : 'cantilever',
      Mmax: pick(list, of.M, 1),
      Mmin: pick(list, of.M, -1),
      Vmax: pick(list, of.V, 1),
      Vmin: pick(list, of.V, -1),
      // A span that does not bend deflects nowhere: at its start, by convention.
      EIvChord: chord.value === 0 ? { value: 0, x: X[i] } : chord,
    };
  });

  const joints: ContinuousJoint[] = X.map((x, j) => {
    const here = at(x);
    return { x, support: kinds[j], M: jointM[j] * length + 0, EItheta: here.EItheta, EIv: here.EIv };
  });

  return {
    ok: true,
    L: length,
    breaks: spans.flatMap((sp, i) => sp.marks.slice(i === 0 ? 0 : 1).map((m) => m.x)),
    reactions,
    at,
    fromSupports,
    spanOf,
    stations,
    extremes: {
      Vmax: pick(everywhere, of.V, 1),
      Vmin: pick(everywhere, of.V, -1),
      Mmax: pick(everywhere, of.M, 1),
      Mmin: pick(everywhere, of.M, -1),
      EIvMax: pick(everywhere, of.Y, 1),
      EIvMin: pick(everywhere, of.Y, -1),
      EIthetaMax: pick(everywhere, of.T, 1),
      EIthetaMin: pick(everywhere, of.T, -1),
    },
    totalLoad,
    residual: { force, moment: moment * length, slope: kink * L2 },
    loadScale: size,
    joints,
    spans: spanResults,
  };
}
