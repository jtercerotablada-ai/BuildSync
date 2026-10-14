import { solveBeam, type BeamExtreme, type BeamModel, type BeamOutcome, type BeamSolution, type Side } from '../beam/solver';
import type { PlaneState, ShaftBearing, ShaftIssue, ShaftModel, ShaftOutcome, ShaftSegment, ShaftSegmentResult, ShaftState } from './types';

/**
 * ─────────────────────────────────────────────────────────────────────────────
 * SHAFT ON BEARINGS — the engine: the first engine in each plane, and the
 * bending of a stepped shaft integrated piece by piece
 * ─────────────────────────────────────────────────────────────────────────────
 * The engine of the fourth calculator of the catalogue ("Shaft on bearings",
 * /resources/shaft-on-bearings). A round shaft whose section changes in
 * steps, on TWO bearings, under forces and couples in two planes and its own
 * weight — types.ts has what goes in and what comes out, the units and the
 * signs —: its reactions, shear, bending moment, slope and deflection, in
 * each plane and the two together.
 *
 * THE METHOD.
 *   1. EACH PLANE'S FORCES ARE THE FIRST ENGINE'S. On two simple supports
 *      the shaft is statically determinate: its reactions, shears and
 *      moments follow from equilibrium alone, whatever its diameters. So
 *      each plane is handed to beam/solver.ts as a beam on a pin and a
 *      roller — that plane's forces and couples and, in the vertical one,
 *      each segment's weight as a uniform load over the segment — and the
 *      reactions, the shear and the moment that come back are that plane's.
 *      There is no second statics in this file.
 *   2. THE SLOPES AND THE DEFLECTIONS ARE THIS FILE'S: that engine knows one
 *      stiffness, and here it changes at every step. The shaft is cut at
 *      every place where something happens — an end, a step, a bearing, a
 *      force, a couple — into PIECES. On a piece a plane's moment is ONE
 *      polynomial, of the second degree at most (a weight is uniform): the
 *      moment and the shear at an end of the piece, which are the first
 *      engine's, and the weight. EI is one number there. So the curvature
 *      M ÷ EI is a parabola, the slope its integral — a cubic — and the
 *      deflection the integral of that — a quartic: written out term by
 *      term and worked out as written (`bent`; the sums J and K). No rule of
 *      quadrature stands in for an integral, and nothing is sampled. From
 *      piece to piece the slope and the deflection carry over as they are:
 *      a couple jumps the moment and a step changes EI, and neither jumps
 *      the slope.
 *   3. THE TWO CONSTANTS are the deflection being nothing at the two
 *      bearings — solved once, on paper. Between the bearings A and B, with
 *      κ = M ÷ EI:
 *
 *          v(x) = −[ (B − x) · ∫ from A to x of (t − A) κ dt  +  (x − A) · ∫ from x to B of (B − t) κ dt ] ÷ (B − A)
 *          θ(x) =  [           ∫ from A to x of (t − A) κ dt  −            ∫ from x to B of (B − t) κ dt ] ÷ (B − A)
 *
 *      Differentiated twice, that v is κ; and it is zero at A and at B by
 *      the form of the expression — to the last figure, with nothing large
 *      taken from anything large to get there. (A tangent carried from A
 *      arrives at B as the difference of two deflections, each the size of
 *      the shaft's largest.) The two integrals are sums, over the pieces, of
 *      the closed forms of 2.: the first counted from the left bearing, the
 *      second from the right one. Past a bearing the shaft goes on from that
 *      bearing's own tangent, piece by piece.
 *   4. THE VALUE AT A POINT is those formulas worked out at that point, in
 *      whatever piece it is: at a place, that place's own slope and
 *      deflection; inside a piece, the cubic and the quartic from whichever
 *      end of the piece is nearer. Nothing is interpolated between stations.
 *   5. THE TWO PLANES TOGETHER. A round section is as stiff every way, so
 *      what the shaft feels at a section is the resultant: the root of the
 *      sum of the squares of the two planes' shears, moments, slopes,
 *      deflections. The bending stress is the resultant moment over the
 *      section modulus of the segment — nominal: no stress raiser is in it
 *      — and at a step, where the moment is one value and the section two,
 *      it is the stress of the side asked for.
 *
 * THE LARGEST VALUES are found, not picked from the stations. On a piece
 * every response of a plane is one polynomial, so a plane's moment turns
 * where its shear is zero and its deflection where its slope is — as the
 * first engine finds its own. The SIZE of two planes together turns at
 * neither: it turns where the derivative of the sum of their squares
 * changes sign — a polynomial of the third degree for the moment, the fifth
 * for the slope, the seventh for the deflection. Every such place of every
 * piece is found (`signChanges`: between two consecutive roots of its
 * derivative a polynomial only rises or only falls, so each of its roots is
 * alone in a stretch that brackets it), and the shaft is read there like any
 * other point. The resultant SHEAR has no turn to look for: the sum of the
 * squares of two straight lines is largest at an end. And the largest
 * stress is by segments — the largest moment IN the segment over that
 * segment's own Z, on its own side of a shoulder — and, for the shaft, the
 * largest of those: at a shoulder with no applied moment on it the small
 * side governs.
 *
 * WHAT THE FIRST ENGINE IS ASKED TWICE, AND WHAT IT IS NOT ASKED AT ALL. It
 * adds a shear and a moment up from the LEFT end, the reactions among the
 * rest. Its sums are right to a part in 10¹⁶ of the largest thing in them —
 * not of what they come to.
 *   — Towards the right end the sum is everything on the shaft, and what is
 *     left of a moment that is nothing there, past the last load, is
 *     rounding the size of the loads (of the bearings' reactions, a thousand
 *     times the loads when the bearings are at their closest). Over the EI
 *     of a slender end that is a curvature the shaft does not have. So each
 *     plane is solved as entered AND AS ITS MIRROR IMAGE, and a place past
 *     the middle of the two bearings is read on the mirror image, where it
 *     is near the left end: every moment is added up from the nearer end of
 *     the shaft, with one bearing in the sum at most. Measured (the solver
 *     of "what is exact", a thousand shafts per column), the worst error of
 *     a slope over the largest slope of its shaft, by how many times the
 *     stiffest segment's EI is the softest's:
 *
 *         stiffest ÷ softest   10      100     10⁴     10⁶     10⁸     10¹⁰    10¹²
 *         read from the left   3e-13   2e-12   9e-11   4e-9    2e-7    5e-7    3e-5
 *         from the nearer end  2e-14   2e-14   2e-14   2e-14   5e-14   8e-15   1e-14
 *
 *   — A FORCE STANDING ON A BEARING goes into the bearing and bends
 *     nothing. The first engine has its support carry it: the force less
 *     the reaction to it, two numbers that are one, and what rounding
 *     leaves of the pair is a moment along the whole shaft the size of THAT
 *     force, whatever the forces that do bend the shaft are. So the planes
 *     are read WITHOUT the forces that stand on a bearing, and each is added
 *     to its bearing's reaction as it stands: a shaft whose every force
 *     stands on a bearing has no moment, no slope and no deflection, to the
 *     last figure. (`planes`, which is handed back, is each plane under all
 *     its loads, as types.ts says.)
 *
 * A PLACE IS ONE PLACE. Positions are compared as the first engine compares
 * them: in units of the shaft's length, and two closer than a billionth —
 * a hair — are one. Every place is settled BEFORE anything is solved: the
 * ends and the steps first, then the bearings, the forces and the couples,
 * each of them AT a place already taken when it is within a hair of it. So
 * both planes, and both images of each, have every load at one and the same
 * place; a bearing or a force entered a rounding from a step is on the
 * step; a force within a hair of a bearing stands on it. A point asked for
 * within a hair of a place is that place, on the side asked for.
 *   And a piece is as long as ITS SEGMENT makes it: the pieces of a segment
 * add up to the length it was entered with, not to the difference of two
 * positions along the shaft — which, of a segment a millionth of the shaft
 * long, knows ten figures, and of what that segment's bending adds to the
 * shaft's no more.
 *
 * WHAT IS EXACT, AND WHERE IT STOPS. The formulas are exact; the numbers in
 * them are doubles. Held against an independent solver — statics by the two
 * equations of equilibrium, slopes and deflections by the unit-load method
 * (virtual work: the integral of M × m ÷ EI over the whole shaft, with no
 * constant to fix and nothing carried from piece to piece), in EXACT
 * arithmetic: every input is a double, every sum and product an integer
 * times a power of two, and the one division is made at the end — on a
 * thousand random shafts per row (one to eight segments, some with their
 * weight, up to nine forces and three couples in two planes: on a bearing,
 * on a step, on an end, inside a short segment), at every place, both
 * sides, and at up to five points of every piece:
 *   — Ordinary shafts (stiffest ÷ softest up to 20, bearings a tenth of the
 *     shaft apart or more): every value within 3e-14 of the largest of its
 *     diagram; every shear and every reaction within 6e-15 of the loads.
 *   — What is small is right to THE SIZE OF THE PROBLEM, not to its own
 *     figures. types.ts has that size as a force (`loadScale`), and as a
 *     slope and a deflection (`slopeScale`, `deflectionScale`: the loads
 *     × L² and × L³ over the EI of the STIFFEST segment, the smallest
 *     those two can honestly be). A shaft whose one force all but stands on
 *     a bearing has a far reaction under a millionth of that force, right
 *     to nine figures of itself and no more: it is right to a part in 10¹⁶
 *     of the loads. A page that takes for rounding what is under a
 *     billionth of those three sizes prints no rounding as a result — up
 *     to the limit on the stiffness, which is where that stops (STIFF).
 *   — Short segments, stiffness far apart, bearings close together: see
 *     SHORT, STIFF and CLOSE, each with what was measured there.
 *   — AT EVERY LIMIT AT ONCE (a segment a millionth of the shaft, EI a
 *     million times apart, the bearings a thousandth of the shaft apart):
 *     every shear and reaction within 2e-10 of the size of the problem —
 *     the reactions are then a thousand times the loads, each right to
 *     3e-13 of itself —, every moment within 8e-14 of it × the length,
 *     every slope and deflection within 8e-11 of its own size of the
 *     problem. And of what a page prints of a shaft — the radial load and
 *     the slope at each bearing, the slope and the deflection at each
 *     force, a moment, a stress, a slope or a deflection anywhere that is a
 *     ten-thousandth of the largest of its kind or more — each within 5e-8
 *     of ITSELF, there and in every row measured inside the limits.
 *   — The largest values: on 1,500 further shafts (ordinary ones, soft
 *     ones, ones at every limit) no point of a sampling fifty times finer
 *     than the stations — both sides of every place — was past a largest
 *     value by more than the last figure of it (2e-16), and each largest
 *     value is the value at the place it names.
 *   — No shaft measured — 27,500 of them, the limits on length and
 *     stiffness taken off for the rows past them — was stopped by the
 *     engine's own last check (`lost`).
 *   — MEASURED A SECOND TIME, by another hand and another exact solver (the
 *     two equations of equilibrium written out; the slopes and the
 *     deflections twice, by double integration from the left end and by the
 *     unit-load method, the two held equal term by term), on 130,000 more
 *     shafts: a lattice of 29,000 and the rest at random, their lengths up
 *     to three decades apart, loads on a bearing, on a step, on an end and
 *     a hair beside each. Nothing written here was found wrong in kind; no
 *     largest value was missed, on a sampling ten to a hundred times finer
 *     than the stations; nothing that is nothing came back as a billionth
 *     of the size of the problem. Its worst values run two to six times
 *     the ones written here — on ordinary shafts 9e-14 of the largest of a
 *     diagram; at every limit at once 1.4e-10 of its size of the problem
 *     for a slope; 3e-7 of itself for what a page prints at a bearing or at
 *     a force, on a shaft whose one force stands a hair beside a bearing —:
 *     a worst case is the worst of the shafts that were drawn. The one
 *     sentence that changes with it is the margin under STIFF, and it is
 *     said there.
 *   — A number holds only so much: see BIG.
 *
 * WHAT IS REFUSED, before anything is worked out — types.ts has the words.
 * First what was entered: a length, a stiffness or a number that is not
 * one, or is one and not of a size the engine takes (BIG, SMALL: of a
 * stiffness that is 'stiffness' too, and of a load too small 'number'); a
 * position off the shaft. Then the shaft itself: a segment under a
 * millionth of it (SHORT), the stiffest EI over a million times the softest
 * (STIFF: both segments are named, the stiffest first), the two bearings at
 * one place or under a thousandth of the shaft apart (CLOSE: the one
 * further right is named). And 'length' with no segment named: lengths
 * that add up past the limit, or results past the largest number there is.
 *
 * UNITS and SIGNS: types.ts. Any consistent set; in each plane a force
 * positive as that plane's positive force is, a reaction positive against
 * it, moment positive sagging, deflection positive against a positive
 * force, slope positive counter-clockwise; x from the left end of the
 * shaft.
 */

/* Positions are compared in units of the shaft's length; two closer than
   this are one. The first engine's own rule, to the letter (beam/solver.ts,
   EPS): each plane is handed to it, and what it takes for one place must be
   one place here. */
const EPS = 1e-9;
/* What this file takes for one place: a millionth more than that. Each plane
   is solved as entered AND as its mirror image, and a distance worked out
   from the other end of the shaft is the same distance less a rounding: two
   places told apart here are then two for the first engine in both. */
const HAIR = EPS * (1 + 1e-6);

/**
 * Two bearings closer than this fraction of the shaft's length are not
 * solved ('bearings'): a thousandth — where the first engine, which is asked
 * for each plane, stops telling two supports apart (beam/solver.ts, CLOSE).
 *
 * Two bearings close together are a clamp: each takes the moment between
 * them over the gap, the reactions are that many times the loads, and a sum
 * is good to the sixteenth figure of the largest thing in it. MEASURED, with
 * the bearings a given fraction of the shaft apart, anywhere along it (a
 * thousand random shafts per row; stiffest ÷ softest up to 20):
 *
 *     bearings apart   reactions, up to    worst error of a     of a moment           of a slope or a
 *     ÷ the shaft      × the loads         shear or reaction    ÷ loads × length      deflection ÷ its
 *                                          ÷ the loads                                size of the problem
 *     1/10                    10           9e-15                7e-16                 2e-15
 *     1/100                  100           7e-13                8e-15                 9e-16
 *     1/1,000              1,000           4e-11                8e-14                 9e-16
 *
 * At a thousandth each reaction is still right to 2e-13 of ITSELF, and
 * nothing of a slope or a deflection is lost: what the gap costs is in what
 * is the size of the loads beside reactions a thousand times larger. That
 * is the first engine's measure too, and its limit is kept as it is.
 */
export const CLOSE = 1e-3;

/**
 * A segment shorter than this fraction of the shaft's length is not solved
 * ('short-segment'): a millionth — a thousand hairs.
 *
 * MEASURED, with one segment or two at a given fraction of the shaft — down
 * to a ten-millionth of it, some with a load standing inside — (a thousand
 * random shafts per row), the worst error over the size of the problem:
 *
 *     shortest ÷ shaft      1/10    1/100   1e-3    1e-4    1e-5    1e-6    1e-7    3e-8
 *     shear, reaction       3e-15   3e-15   2e-15   2e-15   3e-15   2e-15   2e-15   2e-15
 *     moment                3e-16   4e-16   5e-16   3e-16   3e-16   3e-16   3e-16   4e-16
 *     slope                 9e-16   7e-16   1e-15   9e-16   9e-16   9e-16   9e-16   8e-16
 *     deflection            6e-16   4e-16   5e-16   5e-16   7e-16   7e-16   5e-16   3e-16
 *
 * Nothing is lost to a short segment, in any row: a piece is integrated in
 * closed form whatever its length, and is as long as its segment says. So
 * the limit is NOT where the arithmetic gives out. It is where a position
 * stops meaning what was entered. Two positions a hair apart are one place —
 * the first engine's rule, and so this file's — and that engine does not
 * apply a load shorter than a hair, a segment's weight among them. A
 * thousand hairs long, a segment still has its weight to the last figure
 * and a force standing inside it within a thousandth of its own length of
 * where it was put. (A millionth of a shaft is a micron on a metre: no
 * shoulder, groove or relief is that short.)
 */
export const SHORT = 1e-6;

/**
 * The stiffest segment's EI may be this many times the softest's, and no
 * more ('stiffness'): a million — round sections of diameters 31.6 to 1.
 *
 * MEASURED, with every EI between the stiffest and that many times less and
 * half of them at one end or the other of it (a thousand random shafts per
 * column). What a page prints — a slope, a deflection, a moment anywhere
 * that is a ten-thousandth of the largest of its kind or more — against
 * ITSELF; and the worst rounding of a slope over the size of the problem as
 * a slope (types.ts, `slopeScale`: the loads × L² ÷ the STIFFEST EI):
 *
 *     stiffest ÷ softest        10      100     10⁴     10⁶     10⁷     10⁸     10¹⁰    10¹²
 *     of itself                 2e-12   2e-12   5e-12   3e-12   1e-11   8e-12   4e-12   7e-12
 *     slope ÷ slopeScale        5e-16   4e-15   5e-13   3e-11   5e-10   6e-9    3e-7    3e-5
 *     …the bearings and the
 *     shortest segment at
 *     their limits as well                              8e-11   9e-10   1e-8
 *     slope ÷ slopeScale, the
 *     second measurement (the
 *     header): lengths three
 *     decades apart             4e-15   6e-14   2e-12   2e-10   2e-9    1e-8
 *     …at their limits as well                          1e-10   2e-9    1e-8
 *
 * (A deflection over `deflectionScale`: the same, row for row, within a
 * factor of three.) So nothing is lost to stiffness of what a value IS: a
 * slope in a segment a million times softer is right to its own figures.
 * What grows is its last figure seen from the stiff part of the shaft — the
 * soft segment's slopes are that many times larger, and so is their
 * rounding. A slope under a billionth of `slopeScale` is rounding to a
 * page, which prints it as zero (types.ts) — measured against the softest
 * EI instead, a page would call the real slopes of the stiff part nothing.
 * At a million the worst rounding there is, at every limit at once, is
 * twelve times under that billionth — five times under it in the second
 * measurement, which is the margin to count on —; at ten million it is at
 * it, or twice over; at a hundred million it is twelve times over, and a
 * slope that is rounding is printed as a result. That is the limit: the
 * widest range at which what is printed as a result is one.
 */
export const STIFF = 1e6;

/* The largest and the smallest length, stiffness and load the engine takes —
   a load, a weight or a section modulus of exactly zero is none, and is
   taken: the first engine's limits, for its reasons (a number holds only so
   much, 1.8e308, and a link can ask for anything), and the third engine's
   for the small end (under 2.2e-308 a number keeps fewer figures with every
   decade). What a solution holds grows as load × length³ ÷ EI. With twelve
   forces, the length and the softness all AT their limits that is 4e300 at
   the tip of an overhang, forty million times short of the end; under a
   weight at its limit — an intensity, so × length⁴ — it is past it. Which is
   why the stations are looked at once more before a solution is returned,
   and the shaft refused for its lengths, never returned with something in
   it that is not a number. */
const BIG = 1e60;
const SMALL = 1e-60;

type Refusal = { ok: false; issues: ShaftIssue[] };
/** A value of each plane: the vertical one, then the horizontal one. */
type Pair = [number, number];

/**
 * A stretch of the shaft between two consecutive places where something
 * happens: one section, and in each plane a moment that is one polynomial.
 * Lengths in units of the shaft's length; a moment as a force (÷ L).
 */
interface Piece {
  /** Its segment. */
  seg: number;
  /** Where it starts, along the shaft, in the caller's units. */
  x: number;
  /** Its length, in the caller's units and in units of the shaft's. */
  len: number;
  h: number;
  /** The reference stiffness over its own: what a curvature here is multiplied by. */
  c: number;
  /** By planes: the moment and the shear just inside its start, and just inside its end; the weight per length of the unit shaft. */
  ma: Pair;
  Va: Pair;
  mb: Pair;
  Vb: Pair;
  q: Pair;
}

/** p(u), its coefficients lowest power first. */
function polyAt(c: number[], u: number): number {
  let v = 0;
  for (let i = c.length - 1; i >= 0; i--) v = v * u + c[i];
  return v;
}

/**
 * Where a polynomial changes sign between 0 and 1, ascending — every place,
 * not the ones a grid happens to straddle. Between two consecutive roots of
 * its derivative a polynomial only rises or only falls, so it crosses zero
 * there once or not at all: the derivative's roots are found first (the same
 * way, down to a straight line), and each stretch between them that changes
 * sign is closed by Newton's method kept inside it. A place where it only
 * touches zero is not one: nothing changes sign there.
 */
function signChanges(c: number[]): number[] {
  let n = c.length;
  while (n > 0 && c[n - 1] === 0) n -= 1;
  if (n <= 1) return [];
  if (n === 2) {
    const r = -c[0] / c[1];
    return r > 0 && r < 1 ? [r] : [];
  }
  const p = n === c.length ? c : c.slice(0, n);
  const dp = p.slice(1).map((v, i) => v * (i + 1));
  const turns = [0, ...signChanges(dp), 1];
  const found: number[] = [];
  for (let i = 0; i < turns.length - 1; i++) {
    let a = turns[i];
    let b = turns[i + 1];
    const fa = polyAt(p, a);
    const fb = polyAt(p, b);
    // Zero at an end of the stretch is that end; rising or falling from it, it is not zero again inside.
    if (fa === 0 || fb === 0 || fa < 0 === fb < 0 || Number.isNaN(fa) || Number.isNaN(fb)) continue;
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
    found.push(x);
  }
  return found;
}

/** The derivative of p² + q², coefficients lowest power first: where it changes sign, the size of the two together turns. */
function turnOfSquares(p: number[], q: number[]): number[] {
  const n = Math.max(p.length, q.length);
  const sum = new Array<number>(2 * n - 1).fill(0);
  for (const c of [p, q]) for (let i = 0; i < c.length; i++) for (let j = 0; j < c.length; j++) sum[i + j] += c[i] * c[j];
  return sum.slice(1).map((v, i) => v * (i + 1));
}

/** How many cells a piece is drawn with: its share of the shaft × 240, and never under 24 — the first engine's grid (less a rounding: a third of the shaft is 80 cells however the third was worked out). */
const cellsIn = (share: number): number => Math.max(24, Math.ceil(share * 240 * (1 - 1e-12)));

/**
 * The shaft, solved (types.ts, `ShaftSolution`) — or everything that is
 * wrong with it, at once: first with what was entered (a length, a
 * stiffness, a number, a position off the shaft), and only when that is
 * sound with the shaft itself (a segment too short, stiffnesses too far
 * apart, the bearings too close). Nothing is worked out of a shaft that is
 * refused.
 */
export function solveShaft(model: ShaftModel): ShaftOutcome {
  /* The model AS NUMBERS. What is not one where a number must be — a text, nothing at all — is "not a number"
     here, and is refused as that below: left as it came, "3" is three to a comparison and a text to a sum, and a
     shaft with a length of "3" was added up into a text and worked on until the engine fell over. (A link can
     ask for anything; a form sends numbers.) A weight or a section modulus that is not there is none. */
  const num = (v: unknown): number => (typeof v === 'number' ? v : Number.NaN);
  const list = <T>(v: T[] | undefined): T[] => (Array.isArray(v) ? v : []);
  const segs: Required<ShaftSegment>[] = list(model?.segments).map((s) => ({ L: num(s?.L), EI: num(s?.EI), Z: s?.Z == null ? 0 : num(s.Z), w: s?.w == null ? 0 : num(s.w) }));
  const n = segs.length;
  if (n === 0) return { ok: false, issues: [{ code: 'no-segments' }] };
  const forcesIn = list(model.forces).map((f) => ({ x: num(f?.x), v: num(f?.v), h: num(f?.h) }));
  const couplesIn = list(model.couples).map((c) => ({ x: num(c?.x), v: num(c?.v), h: num(c?.h) }));
  const bearingsIn: [number, number] = [num(model.bearings?.[0]), num(model.bearings?.[1])];

  /* ── What was entered, checked ─────────────────────────────────────── */
  const issues: ShaftIssue[] = [];
  /** The size of a load: nothing, or a number the engine takes. (NaN is not within any limit.) */
  const sized = (...v: number[]) => v.every((s) => s === 0 || (Math.abs(s) >= SMALL && Math.abs(s) <= BIG));
  let sound = true;
  segs.forEach((s, index) => {
    const where = { list: 'segments' as const, index };
    if (!(s.L >= SMALL && s.L <= BIG)) {
      issues.push({ code: 'length', where });
      sound = false;
    }
    // (Not a positive number — or one, and not of a size the engine takes: there is no other word for an EI.)
    if (!(s.EI >= SMALL && s.EI <= BIG)) issues.push({ code: 'stiffness', where });
    if (!sized(s.w) || !(s.Z === 0 || (s.Z >= SMALL && s.Z <= BIG))) issues.push({ code: 'number', where });
  });
  /** Where each segment starts along the shaft, as the caller's lengths add up; the last is the shaft's length. */
  const X: number[] = [0];
  for (const s of segs) X.push(X[X.length - 1] + s.L);
  const L = X[n];
  // Each length is one the engine takes, and all of them together are not: no one segment is at fault.
  if (sound && !(L <= BIG)) {
    issues.push({ code: 'length' });
    sound = false;
  }
  // (With a length at fault there is no "on the shaft" to ask about.)
  const on = (x: number) => !sound || (x >= -EPS * L && x <= L * (1 + EPS));
  bearingsIn.forEach((x, index) => {
    if (!Number.isFinite(x)) issues.push({ code: 'number', where: { list: 'bearings', index } });
    else if (!on(x)) issues.push({ code: 'outside', where: { list: 'bearings', index } });
  });
  forcesIn.forEach((f, index) => {
    if (!Number.isFinite(f.x) || !sized(f.v, f.h)) issues.push({ code: 'number', where: { list: 'forces', index } });
    else if (!on(f.x)) issues.push({ code: 'outside', where: { list: 'forces', index } });
  });
  couplesIn.forEach((c, index) => {
    if (!Number.isFinite(c.x) || !sized(c.v, c.h)) issues.push({ code: 'number', where: { list: 'couples', index } });
    else if (!on(c.x)) issues.push({ code: 'outside', where: { list: 'couples', index } });
  });
  if (issues.length) return { ok: false, issues };

  /* ── Is it a shaft the engine takes? ───────────────────────────────── */
  segs.forEach((s, index) => {
    // (Less a rounding: segments that add up to a million times the first are not under the limit.)
    if (s.L < SHORT * (1 - 1e-9) * L) issues.push({ code: 'short-segment', where: { list: 'segments', index } });
  });
  let stiffest = 0;
  let softest = 0;
  segs.forEach((s, i) => {
    if (s.EI > segs[stiffest].EI) stiffest = i;
    if (s.EI < segs[softest].EI) softest = i;
  });
  // The two it is said of, the stiffest first: neither is at fault by itself.
  if (segs[stiffest].EI > STIFF * (1 + 1e-9) * segs[softest].EI) issues.push({ code: 'stiffness', where: { list: 'segments', index: stiffest } }, { code: 'stiffness', where: { list: 'segments', index: softest } });

  /* ── Every place, once ─────────────────────────────────────────────── */
  /** A position in units of the shaft's length, as the first engine has it. */
  const unit = (x: number) => Math.min(1, Math.max(0, x / L));
  // The ends and the steps first: a bearing or a load within a hair of one is ON it. Then the bearings, the
  // forces and the couples, each in its order: one within a hair of a place taken is at that place.
  const places: { x: number; a: number }[] = X.map((x) => ({ x, a: unit(x) }));
  const put = (x: number): number => {
    const a = unit(x);
    let found = -1;
    for (let k = 0; k < places.length; k++) if (Math.abs(places[k].a - a) <= HAIR && (found < 0 || Math.abs(places[k].a - a) < Math.abs(places[found].a - a))) found = k;
    if (found >= 0) return places[found].x;
    const xc = Math.min(L, Math.max(0, x));
    places.push({ x: xc, a });
    return xc;
  };
  const placed: [number, number] = [put(bearingsIn[0]), put(bearingsIn[1])];
  /** The bearings left to right, by their place in the model. */
  const order: [number, number] = placed[1] < placed[0] ? [1, 0] : [0, 1];
  const xA = placed[order[0]];
  const xB = placed[order[1]];
  // As the first engine refuses two supports — less half a hair, so that it takes the shaft and its mirror image
  // both: it is asked next, and must not be the one to say so.
  if (unit(xB) - unit(xA) < CLOSE - EPS / 2) issues.push({ code: 'bearings', where: { list: 'bearings', index: order[1] } });
  if (issues.length) return { ok: false, issues };

  // (A force or a couple of no size is nothing, and has no place.)
  const forces = forcesIn.filter((f) => f.v !== 0 || f.h !== 0).map((f) => ({ x: put(f.x), v: f.v, h: f.h }));
  const couples = couplesIn.filter((c) => c.v !== 0 || c.h !== 0).map((c) => ({ x: put(c.x), v: c.v, h: c.h }));
  places.sort((p, q) => p.x - q.x);
  const m = places.length - 1;
  const iA = places.findIndex((p) => p.x === xA);
  const iB = places.findIndex((p) => p.x === xB);

  const loadScale = forces.reduce((sum, f) => sum + Math.hypot(f.v, f.h), 0) + couples.reduce((sum, c) => sum + Math.hypot(c.v, c.h), 0) / (xB - xA) + segs.reduce((sum, s) => sum + Math.abs(s.w) * s.L, 0);

  /* ── Each plane's forces: the first engine's ───────────────────────── */
  type Load = { x: number; v: number; h: number };
  const beamOf = (carried: Load[], p: 0 | 1): BeamModel => ({
    L,
    supports: [
      { x: xA, kind: 'pin' },
      { x: xB, kind: 'roller' },
    ],
    points: carried.map((f) => ({ x: f.x, P: p === 0 ? f.v : f.h })),
    couples: couples.map((c) => ({ x: c.x, M: p === 0 ? c.v : c.h })),
    dists: p === 0 ? segs.flatMap((s, g) => (s.w ? [{ x1: X[g], x2: X[g + 1], w1: s.w, w2: s.w }] : [])) : [],
  });
  /* The shaft is one the engine takes, so what comes back is a shaft that
     adds up. Should the arithmetic fail all the same, it is refused as what
     it then is — too much for these numbers — by whichever of its three
     measures is nearest its limit: the bearings, the shortest segment, the
     stiffness. Never reached, on any shaft measured (the header). */
  const lost = (): Refusal => {
    let short = 0;
    segs.forEach((s, i) => {
      if (s.L < segs[short].L) short = i;
    });
    const byBearings = Math.log(unit(xB) - unit(xA)) / Math.log(CLOSE);
    const byLength = n > 1 ? Math.log(segs[short].L / L) / Math.log(SHORT) : 0;
    const byStiffness = Math.log(segs[stiffest].EI / segs[softest].EI) / Math.log(STIFF);
    if (byLength > byBearings && byLength >= byStiffness) return { ok: false, issues: [{ code: 'short-segment', where: { list: 'segments', index: short } }] };
    if (byStiffness > byBearings) return { ok: false, issues: [{ code: 'stiffness', where: { list: 'segments', index: softest } }] };
    return { ok: false, issues: [{ code: 'bearings', where: { list: 'bearings', index: order[1] } }] };
  };
  /** What the first engine says of a plane it does not solve, as this one words it. */
  const refused = (outcome: BeamOutcome): Refusal | null => {
    if (outcome.ok) return null;
    // Its results past the largest number there is: the lengths took them there.
    if (outcome.issues.some((i) => i.code === 'length')) return { ok: false, issues: [{ code: 'length' }] };
    return lost();
  };
  /** The same beam seen from the other side: left is right, and a counter-clockwise couple is clockwise. */
  const mirrorOf = (beam: BeamModel): BeamModel => ({
    L,
    supports: beam.supports.map((s) => ({ x: L - s.x, kind: s.kind })),
    points: (beam.points ?? []).map((p) => ({ x: L - p.x, P: p.P })),
    couples: (beam.couples ?? []).map((c) => ({ x: L - c.x, M: -c.M })),
    dists: (beam.dists ?? []).map((d) => ({ x1: L - d.x2, x2: L - d.x1, w1: d.w2, w2: d.w1 })),
  });
  // Each plane under all its loads: what is handed back as `planes`.
  const vertical = solveBeam(beamOf(forces, 0));
  const horizontal = solveBeam(beamOf(forces, 1));
  /* A FORCE STANDING ON A BEARING GOES INTO THE BEARING, and nowhere else:
     it bends nothing. The first engine would have its support carry it —
     the force less the reaction to it, two numbers that are one — and what
     rounding leaves of that pair is a moment along the whole shaft, the size
     of that force, whatever the forces that do bend it are. So the shaft is
     read on each plane WITHOUT those forces, and each is added to its
     bearing's reaction as it stands. (With none, these are the same beams.) */
  const standing = (f: Load) => f.x === xA || f.x === xB;
  const bending = forces.filter((f) => !standing(f));
  const stood = (x: number, p: 0 | 1) => forces.reduce((sum, f) => sum + (f.x === x ? (p === 0 ? f.v : f.h) : 0), 0);
  const read = bending.length === forces.length ? [vertical, horizontal] : [solveBeam(beamOf(bending, 0)), solveBeam(beamOf(bending, 1))];
  const seen = [solveBeam(mirrorOf(beamOf(bending, 0))), solveBeam(mirrorOf(beamOf(bending, 1)))];
  const no = refused(vertical) ?? refused(horizontal) ?? refused(read[0]) ?? refused(read[1]) ?? refused(seen[0]) ?? refused(seen[1]);
  if (no || !vertical.ok || !horizontal.ok || !read[0].ok || !read[1].ok || !seen[0].ok || !seen[1].ok) return no ?? lost();
  const planes: [BeamSolution, BeamSolution] = [read[0], read[1]];
  const mirrors: [BeamSolution, BeamSolution] = [seen[0], seen[1]];
  /* WHICH OF THE TWO IS READ WHERE. The first engine adds a shear and a
     moment up from the left end. Towards the right end that is everything
     on the shaft, one large number less another, and what is left of a
     moment that is nothing there — past the last load — is rounding the
     size of the loads: divided by the EI of a slender end, a curvature the
     shaft does not have. So a place past the middle of the two bearings is
     read on the mirror image, where it is near the left end. */
  const middle = (xA + xB) / 2;
  const other = (side: Side): Side => (side === 'left' ? 'right' : 'left');
  /** The shear and the moment of plane p at place j, on the side asked for. */
  const atMark = (p: 0 | 1, j: number, side: Side): { V: number; M: number } => {
    if (places[j].x <= middle) return planes[p].at(places[j].x, side);
    const s = mirrors[p].at(L - places[j].x, other(side));
    return { V: -s.V, M: s.M };
  };
  /** The same at a point that is no place, and further than a hair from any. */
  const between = (p: 0 | 1, x: number): { V: number; M: number } => {
    if (x <= middle) return planes[p].at(x, 'right');
    const s = mirrors[p].at(L - x, 'right');
    return { V: -s.V, M: s.M };
  };

  /* ── The pieces ────────────────────────────────────────────────────── */
  /** The stiffest section: every curvature is worked out as a multiple of the one it would have there. */
  const EIref = segs[stiffest].EI;
  const pieces: Piece[] = [];
  let g = 0;
  for (let i = 0; i < m; i++) {
    if (places[i].x === X[g + 1]) g += 1;
    const s = segs[g];
    // A place is where it is IN ITS SEGMENT, and a piece as long as the segment's own length makes it: from the
    // positions along the shaft, a segment a millionth of the shaft long would be known to ten figures only,
    // and what its bending adds to the shaft's with it.
    const from = places[i].x === X[g] ? 0 : places[i].x - X[g];
    const to = places[i + 1].x === X[g + 1] ? s.L : places[i + 1].x - X[g];
    const len = to - from;
    const [a, b] = [[atMark(0, i, 'right'), atMark(1, i, 'right')], [atMark(0, i + 1, 'left'), atMark(1, i + 1, 'left')]];
    pieces.push({
      seg: g,
      x: places[i].x,
      len,
      h: len / L,
      c: EIref / s.EI,
      ma: [a[0].M / L, a[1].M / L],
      Va: [a[0].V, a[1].V],
      mb: [b[0].M / L, b[1].M / L],
      Vb: [b[0].V, b[1].V],
      q: [s.w * L, 0],
    });
  }
  // The moment carried along a piece by its shear and its weight arrives at the first engine's moment at the far
  // end, or this is not one shaft: the last word, as the millionth of the loads is for that engine's equilibrium.
  for (const e of pieces) {
    for (const p of [0, 1] as const) {
      const left = [e.ma[p] + e.h * (e.Va[p] - (e.q[p] * e.h) / 2) - e.mb[p], e.Va[p] - e.q[p] * e.h - e.Vb[p]];
      if (!left.every((d) => Math.abs(d) <= 1e-6 * loadScale)) return lost();
    }
  }

  /* ── Slope and deflection at every place ───────────────────────────── */
  // In each piece, by planes: the curvature added up from its start (J) and
  // from its end (K) — the turn across it, its first moment about that end,
  // and what it drops the far end by from the tangent at that end. Closed
  // forms of a moment of the second degree.
  const J0: Pair[] = [];
  const J1: Pair[] = [];
  const J2: Pair[] = [];
  const K0: Pair[] = [];
  const K1: Pair[] = [];
  const K2: Pair[] = [];
  for (const e of pieces) {
    const { h, c } = e;
    const of = (f: (p: 0 | 1) => number): Pair => [f(0), f(1)];
    J0.push(of((p) => c * h * (e.ma[p] + h * (e.Va[p] / 2 - (e.q[p] * h) / 6))));
    J1.push(of((p) => c * h * h * (e.ma[p] / 2 + h * (e.Va[p] / 3 - (e.q[p] * h) / 8))));
    J2.push(of((p) => c * h * h * (e.ma[p] / 2 + h * (e.Va[p] / 6 - (e.q[p] * h) / 24))));
    K0.push(of((p) => c * h * (e.mb[p] - h * (e.Vb[p] / 2 + (e.q[p] * h) / 6))));
    K1.push(of((p) => c * h * h * (e.mb[p] / 2 - h * (e.Vb[p] / 3 + (e.q[p] * h) / 8))));
    K2.push(of((p) => c * h * h * (e.mb[p] / 2 - h * (e.Vb[p] / 6 + (e.q[p] * h) / 24))));
  }
  /** How far each place between the bearings is from the left one, and from the right one. */
  const dA = new Array<number>(m + 1).fill(0);
  const dB = new Array<number>(m + 1).fill(0);
  for (let j = iA + 1; j <= iB; j++) dA[j] = dA[j - 1] + pieces[j - 1].h;
  for (let j = iB - 1; j >= iA; j--) dB[j] = dB[j + 1] + pieces[j].h;
  const span = dA[iB];
  /** By planes: the slope and the deflection at each place, as forces (× L² ÷ the reference stiffness, × L³ ÷ it). */
  const T: number[][] = [[], []];
  const Y: number[][] = [[], []];
  for (const p of [0, 1] as const) {
    const t = new Array<number>(m + 1).fill(0);
    const y = new Array<number>(m + 1).fill(0);
    // Between the bearings: the curvature's first moment about the left bearing, from it to the place (PA),
    // and about the right one, from the place to it (PB).
    const PA = new Array<number>(m + 1).fill(0);
    const PB = new Array<number>(m + 1).fill(0);
    for (let j = iA + 1; j <= iB; j++) PA[j] = PA[j - 1] + dA[j - 1] * J0[j - 1][p] + J1[j - 1][p];
    for (let j = iB - 1; j >= iA; j--) PB[j] = PB[j + 1] + dB[j + 1] * K0[j][p] + K1[j][p];
    for (let j = iA; j <= iB; j++) {
      t[j] = (PA[j] - PB[j]) / span;
      // At a bearing one of the two distances is nothing and so is the sum beside the other: zero, by the form of the expression.
      y[j] = 0 - (dB[j] * PA[j] + dA[j] * PB[j]) / span;
    }
    // Past the right bearing: from its tangent, piece by piece. Before the left one: the same, backwards.
    for (let j = iB; j < m; j++) {
      t[j + 1] = t[j] + J0[j][p];
      y[j + 1] = y[j] + t[j] * pieces[j].h + J2[j][p];
    }
    for (let j = iA - 1; j >= 0; j--) {
      t[j] = t[j + 1] - K0[j][p];
      y[j] = y[j + 1] - t[j + 1] * pieces[j].h + K2[j][p];
    }
    T[p] = t;
    Y[p] = y;
  }

  /* ── The shaft at a point ──────────────────────────────────────────── */
  const sT = (L / EIref) * L;
  const sY = sT * L;
  const stateOf = (x: number, seg: number, sv: { V: number; M: number }, sh: { V: number; M: number }, tv: number, yv: number, th: number, yh: number): ShaftState => {
    // (Plus zero: a zero is written 0, never −0.)
    const v: PlaneState = { V: sv.V + 0, M: sv.M + 0, theta: tv * sT + 0, v: yv * sY + 0 };
    const hz: PlaneState = { V: sh.V + 0, M: sh.M + 0, theta: th * sT + 0, v: yh * sY + 0 };
    const M = Math.hypot(v.M, hz.M);
    const Z = segs[seg].Z;
    return { x, segment: seg, vertical: v, horizontal: hz, V: Math.hypot(v.V, hz.V), M, theta: Math.hypot(v.theta, hz.theta), v: Math.hypot(v.v, hz.v), sigma: Z > 0 ? M / Z : null };
  };
  /** At place j: its own slope and deflection, which are one value whichever side; the shear, the moment and the section of the side asked for. */
  const atPlace = (j: number, side: Side, x: number): ShaftState => {
    const seg = side === 'left' ? pieces[Math.max(0, j - 1)].seg : pieces[Math.min(m - 1, j)].seg;
    return stateOf(x, seg, atMark(0, j, side), atMark(1, j, side), T[0][j], Y[0][j], T[1][j], Y[1][j]);
  };
  /** Slope and deflection of one plane inside piece i, s from its start and r from its end: from whichever of the two is nearer. */
  const bent = (i: number, p: 0 | 1, s: number, r: number): [number, number] => {
    const e = pieces[i];
    if (s <= r) {
      const [mo, V, q, t] = [e.ma[p], e.Va[p], e.q[p], T[p][i]];
      return [t + e.c * s * (mo + s * (V / 2 - (q * s) / 6)), Y[p][i] + s * (t + e.c * s * (mo / 2 + s * (V / 6 - (q * s) / 24)))];
    }
    const [mo, V, q, t] = [e.mb[p], e.Vb[p], e.q[p], T[p][i + 1]];
    return [t - e.c * r * (mo - r * (V / 2 + (q * r) / 6)), Y[p][i + 1] - r * (t - e.c * r * (mo / 2 - r * (V / 6 + (q * r) / 24)))];
  };
  /** Inside piece i, more than a hair from both its ends. */
  const interior = (i: number, x: number): ShaftState => {
    const e = pieces[i];
    // Each distance from its own end of the piece, neither as the length less the other: a millionth of the span
    // from a bearing, "the length less the rest" knows ten figures of that millionth, and a deflection there is it.
    const s = Math.min(e.h, Math.max(0, (x - e.x) / L));
    const r = Math.min(e.h, Math.max(0, (places[i + 1].x - x) / L));
    const [tv, yv] = bent(i, 0, s, r);
    const [th, yh] = bent(i, 1, s, r);
    return stateOf(x, e.seg, between(0, x), between(1, x), tv, yv, th, yh);
  };
  /* A point of piece i read from INSIDE the piece. Within a hair of one of
     its ends it IS that end, on the piece's side of it: read as a point
     past the place, the first engine would count the force or the bearing
     that stands there — the shear a hair early, and at a bearing with a
     force on it a shear the shaft has nowhere. */
  const inside = (i: number, x: number): ShaftState => {
    const a = unit(x);
    if (a - places[i].a <= HAIR) return atPlace(i, 'right', x);
    if (places[i + 1].a - a <= HAIR) return atPlace(i + 1, 'left', x);
    return interior(i, x);
  };
  const nowhere: PlaneState = { V: Number.NaN, M: Number.NaN, theta: Number.NaN, v: Number.NaN };
  const at = (x: number, side?: Side): ShaftState => {
    // A position that is not a number has nothing at it.
    if (Number.isNaN(x)) return { x, segment: 0, vertical: { ...nowhere }, horizontal: { ...nowhere }, V: Number.NaN, M: Number.NaN, theta: Number.NaN, v: Number.NaN, sigma: null };
    const xc = Math.min(L, Math.max(0, x));
    const a = xc / L;
    const sd: Side = side ?? (a >= 1 - EPS ? 'left' : 'right');
    // The last place at or before it; then, of that one and the next, the nearer if it is within a hair.
    let lo = 0;
    let hi = m;
    while (lo < hi) {
      const mid = (lo + hi + 1) >> 1;
      if (places[mid].a <= a) lo = mid;
      else hi = mid - 1;
    }
    const before = a - places[lo].a;
    const after = lo < m ? places[lo + 1].a - a : Number.POSITIVE_INFINITY;
    if (before <= HAIR && before <= after) return atPlace(lo, sd, xc);
    if (after <= HAIR) return atPlace(lo + 1, sd, xc);
    return interior(lo, xc);
  };

  /* ── Stations, and where the largest values may be ─────────────────── */
  // Both sides of every place and a grid between, the first engine's. And
  // in every piece, each place where a response turns: on a piece each one
  // is a polynomial in u, 0 at its start and 1 at its end, so the turns are
  // the sign changes of a derivative, all of them found (`signChanges`). A
  // plane's moment turns where its shear is zero and its deflection where
  // its slope is. The SIZE of two planes together turns where the
  // derivative of the sum of their squares is zero — of the third degree
  // for the moment, the fifth for the slope, the seventh for the deflection
  // — and nowhere a plane's own derivative would point at. What the shaft
  // is there is then read as at any other point.
  const stations: ShaftState[] = [];
  /** By segments: every station in it, and every turn. */
  const found: ShaftState[][] = segs.map(() => []);
  pieces.forEach((e, i) => {
    const cells = cellsIn(e.h);
    const row: ShaftState[] = [atPlace(i, 'right', e.x)];
    for (let j = 1; j < cells; j++) row.push(inside(i, e.x + (e.len * j) / cells));
    row.push(atPlace(i + 1, 'left', places[i + 1].x));
    stations.push(...row);
    found[e.seg].push(...row);
    const { h, c } = e;
    const turns = new Set<number>();
    const moment: number[][] = [];
    const slope: number[][] = [];
    const deflection: number[][] = [];
    for (const p of [0, 1] as const) {
      const [mo, V, q] = [e.ma[p], e.Va[p], e.q[p]];
      const shear = [V, -q * h];
      moment.push([mo, V * h, (-q * h * h) / 2]);
      slope.push([T[p][i], c * mo * h, (c * V * h * h) / 2, (-c * q * h * h * h) / 6]);
      deflection.push([Y[p][i], T[p][i] * h, (c * mo * h * h) / 2, (c * V * h * h * h) / 6, (-c * q * h * h * h * h) / 24]);
      for (const u of [...signChanges(shear), ...signChanges(slope[p])]) turns.add(u);
    }
    for (const pair of [moment, slope, deflection]) for (const u of signChanges(turnOfSquares(pair[0], pair[1]))) turns.add(u);
    for (const u of turns) if (u > 0 && u < 1) found[e.seg].push(inside(i, e.x + e.len * u));
  });
  // The limits on what is entered keep these numbers; at those limits a
  // deflection can still pass the largest number there is. That is no
  // solution, and it is the length, cubed, that took it there.
  // (A size is a number when its two planes are, and a stress when its moment is; added up, one that is not shows.)
  const sum = (s: ShaftState) => s.x + s.V + s.M + s.theta + s.v + (s.sigma ?? 0);
  const slopeScale = loadScale * sT;
  const deflectionScale = loadScale * sY;
  if (!stations.every((s) => Number.isFinite(sum(s))) || !Number.isFinite(deflectionScale)) return { ok: false, issues: [{ code: 'length' }] };

  /* ── The largest values ────────────────────────────────────────────── */
  /** The largest (sign 1) or the lowest (−1) of a response over a list, and where: the first of them, when several are as large. */
  const pick = (list: ShaftState[], of: (s: ShaftState) => number, sign: 1 | -1 = 1): BeamExtreme => {
    let best = list[0];
    for (const s of list) if (sign * of(s) > sign * of(best)) best = s;
    return { value: of(best) + 0, x: best.x };
  };
  const segments: ShaftSegmentResult[] = segs.map((s, index) => {
    const M = pick(found[index], (st) => st.M);
    return { index, from: X[index], to: X[index + 1], M, sigma: s.Z > 0 ? { value: M.value / s.Z, x: M.x } : null, v: pick(found[index], (st) => st.v) };
  });
  let sigma: BeamExtreme | null = null;
  for (const s of segments) if (s.sigma && (!sigma || s.sigma.value > sigma.value)) sigma = s.sigma;
  const everywhere = found.flat();
  const ofPlane = (plane: (s: ShaftState) => PlaneState) => ({
    Mmax: pick(everywhere, (s) => plane(s).M, 1),
    Mmin: pick(everywhere, (s) => plane(s).M, -1),
    vMax: pick(everywhere, (s) => plane(s).v, 1),
    vMin: pick(everywhere, (s) => plane(s).v, -1),
  });

  const bearing = (k: 0 | 1): ShaftBearing => {
    const j = k === 0 ? iA : iB;
    // What the shaft brings it — from the solution its place is read on (`atMark`): the shear jumps there by this
    // very number — and what stands on it.
    const of = (p: 0 | 1) => (k === 0 ? planes[p].reactions[0].Rv : mirrors[p].reactions[0].Rv) + stood(places[j].x, p) + 0;
    const [rv, rh] = [of(0), of(1)];
    const [tv, th] = [T[0][j] * sT + 0, T[1][j] * sT + 0];
    return { x: places[j].x, vertical: rv, horizontal: rh, radial: Math.hypot(rv, rh), thetaVertical: tv, thetaHorizontal: th, theta: Math.hypot(tv, th) };
  };

  return {
    ok: true,
    L,
    breaks: places.map((p) => p.x),
    planes: { vertical, horizontal },
    bearings: [bearing(0), bearing(1)],
    at,
    stations,
    segments,
    extremes: {
      V: pick(everywhere, (s) => s.V),
      M: pick(everywhere, (s) => s.M),
      theta: pick(everywhere, (s) => s.theta),
      v: pick(everywhere, (s) => s.v),
      sigma,
      vertical: ofPlane((s) => s.vertical),
      horizontal: ofPlane((s) => s.horizontal),
    },
    totalLoad: { vertical: vertical.totalLoad + 0, horizontal: horizontal.totalLoad + 0 },
    loadScale,
    slopeScale,
    deflectionScale,
  };
}
