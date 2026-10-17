/**
 * ─────────────────────────────────────────────────────────────────
 * CABLE SAG AND PRETENSION — what the engine is given and what it returns
 * ─────────────────────────────────────────────────────────────────
 * The seventh calculator of the catalogue ("Cable sag and pretension",
 * /resources/cable-sag): "The pretension a cable needs to hang with a given
 * sag." Three modes, one engine (engine.ts):
 *
 *   'hanging'  A CABLE BETWEEN TWO SUPPORTS under its own weight (per unit
 *              LENGTH of cable: the catenary), under a uniform load per unit
 *              HORIZONTAL length (a deck, a pipe: the parabola), or both
 *              (solved EXACTLY, not approximated). What is known is one of:
 *              the sag, the horizontal tension H, the tension at a support,
 *              or the cable's unstretched length; the engine solves for the rest.
 *   'state'    CHANGE OF STATE. A cable in a known state 1 goes to a state 2
 *              (another load, another temperature): new H, sag, tensions,
 *              length — and a table over a range of temperatures and over a
 *              range of load factors.
 *   'points'   A FUNICULAR CABLE: up to 12 vertical point loads, self-weight
 *              neglected (or entered as one load per segment). The sag at one
 *              chosen position (or H, or the largest tension) is known.
 *
 * This file is the agreement between the engine, the form (model.ts), the
 * analysis (analysis.ts) and the page. NO DESIGN CODE, NO VERDICT WORD: every
 * result is a number; every problem is a STABLE MACHINE CODE (listed below)
 * and the numbers its sentence needs. The page writes one sentence per code,
 * in both languages.
 *
 * ── UNITS ──────────────────────────────────────────────────────────────
 * The engine takes ANY CONSISTENT SET: one length unit (L) and one force unit
 * (F). Then a line load is F/L, an area L², a modulus F/L², a strain has no
 * unit. The form is given feet and kips or metres and kilonewtons, and
 * brings the section's inches or millimetres, the loads' pounds per foot, the
 * temperature and the modulus across in ONE place (model.ts, TO_ENGINE).
 *
 * ── GEOMETRY AND SIGNS ─────────────────────────────────────────────────
 *   x to the right, z UP. Support A (left) is the origin (0, 0); support B
 *   (right) is at (L, h): `L` the horizontal distance (> 0), `h` the height of
 *   B over A (either sign; 0 = a level span). The cable sags BELOW its chord
 *   (the straight line A–B). Gravity acts down.
 *
 *   slope  dz/dx of the cable. slope.A is at support A, slope.B at support B.
 *          A cable that sags between level supports has slope.A < 0 < slope.B.
 *   angle  the same slope seen as an angle in degrees BELOW THE HORIZONTAL AT
 *          THE SUPPORT, going INTO the span: angle.A = atan(−slope.A) and
 *          angle.B = atan(slope.B). Positive when the cable leaves the
 *          support downward. (Negative: the cable leaves it upward, which
 *          happens at the HIGH support of a steep span when the lowest point
 *          of the cable falls outside the span: `vertex.inside = false`.)
 *   H      the horizontal component of the tension: the SAME at every point
 *          of the cable (no horizontal load). This is "the pretension" in the
 *          usual sense. Always > 0.
 *   tension  T = H·√(1 + slope²) at a point. A and B are the supports'. `high`
 *          is the one at the higher support (B if h ≥ 0, else A) and `low` the
 *          other: on a level span they are the same cable and `high` is B.
 *          `max` is the larger of the two (always at a support), `min` is H
 *          where the lowest point is inside the span and the smaller support
 *          tension where it is not.
 *   reaction  the VERTICAL force the support exerts ON THE CABLE, positive UP:
 *          reaction.A = −H·slope.A, reaction.B = +H·slope.B. The horizontal one
 *          is H at each (at A it pulls the cable toward −x; at B toward +x).
 *          Their sum is the total vertical load the cable carries. A negative
 *          reaction means that support pushes the cable DOWN (the cable
 *          leaves it upward). The force the cable puts on the support is the
 *          opposite of these.
 *
 * ── THE TWO SAGS (drawn in the page: analysis.ts, `sag`) ────────────────
 *   sagMid  THE USUAL SAG: the vertical distance, at mid-span (x = L/2),
 *           between the chord and the cable. ≥ 0.
 *   sagLow  the vertical distance from the LOWER support's level to the
 *           cable's lowest point. 0 when the lowest point is not inside the
 *           span (then the cable's lowest point is the lower support). On a
 *           LEVEL span the lowest point is at mid-span and the two sags are
 *           the same number; on an inclined span they differ (the chord at
 *           mid-span is h/2 above A, the lowest point is nearer the lower support).
 *   Either may be the known (`Known`: 'sag-mid' or 'sag-low'). A 'sag-low'
 *   that is given must be > 0 (a lowest point at the support level has no
 *   unique cable).
 *
 * ── THE LOAD, AND WHAT "EXACT" MEANS ───────────────────────────────────
 *   w  weight per unit LENGTH of cable (F/L). It is the weight per unit
 *      UNSTRETCHED length: a stretched element carries the same weight.
 *   q  uniform load per unit HORIZONTAL length (F/L).
 *   Both ≥ 0, not both 0. With w only the exact cable is the CATENARY (the
 *   elastic catenary when EA is given); with q only it is the PARABOLA; with
 *   both it is neither: the exact shape is solved, not approximated, from the
 *   equilibrium  H·z'' = q + w·√(1+z'²)/(1+T/EA)  (the load per unit horizontal
 *   length is q plus the weight of the cable over that run), integrated in the
 *   slope p = z' by Gauss–Legendre quadrature (shape.ts). The PARABOLIC
 *   approximation next to it treats all the load as per horizontal length,
 *   q_parabolic = q + w (the cable weight spread over the span, the usual
 *   shortcut) and solves the same known with the same machinery.
 *
 * ── ELASTICITY ──────────────────────────────────────────────────────────
 *   EA  (F): modulus × metallic area, or null for an inextensible cable.
 *   `length` is the length of the cable in its stretched, loaded state;
 *   `unstretched` is the length it had unloaded: ∫ ds/(1 + T/EA) over the
 *   cable, EXACT (not L/(1 + T_avg/EA)); `elongation = length − unstretched`.
 *   With EA = null the two are the same. The load per unit horizontal
 *   length of the weight is  w·√(1+p²)/(1 + T/EA) : a stretched cable carries
 *   its weight over a longer run, so the exact elastic result differs from
 *   the rigid one by a few parts in 10⁴ for a working cable. T/EA is `strain`.
 *
 * ── SOLVING ─────────────────────────────────────────────────────────────
 *   Everything is a function of H. For a given H the shape is found by two
 *   nested bracketed solves (the slope at A; the slope at B for a given slope
 *   at A) of 1e-14 relative tolerance. Every other known is a bracketed root
 *   in ln H, monotone for the sag and the length. For a TENSION known the
 *   tension has a minimum (a very slack cable has a large tension too), so
 *   there are two cables with that tension; the TAUT one (the larger H) is
 *   returned and the slacker one is given in `alternative`. The results are
 *   right to ≥ 1e-11 of themselves on the sag/span range 1e-6 … 100.
 */

/* ── Limits the whole calculator holds ────────────────────────────────── */

/** Up to 12 vertical point loads in the funicular mode. */
export const MAX_POINT_LOADS = 12;
/** The sag/span (mid-span sag over the span) the engine accepts as a KNOWN: below the smallest the arithmetic is no longer meaningful to 10 figures, above the largest the "cable" hangs a hundred spans deep. */
export const MIN_SAG_RATIO = 1e-6;
export const MAX_SAG_RATIO = 100;
/** |h| / L above this is refused ('rise'): a cable that close to vertical has no sag in any usual sense. */
export const MAX_RISE_RATIO = 100;
/**
 * THE PARABOLA TOLERANCE. 'parabola-differs' is raised when the parabolic
 * approximation (all the load per horizontal length) differs from the exact
 * result by MORE than 1 % in the largest of: H, the largest tension, the mid-span
 * sag (the quantity that is not the given one, so it measures the approximation
 * and not the input). Why 1 %: a pretension quoted to the nearest percent is
 * as precise as any cable's modulus and weight are known; for a level cable
 * under its own weight alone it is crossed at a sag/span of about 0.085 (the
 * parabola gives H = wL²/8d, the catenary H = w·a with a(cosh(L/2a) − 1) = d;
 * the largest tension differs by 1 % there, 1.5 % at 0.1 and 10 % at 0.25; the
 * worst of the three is always the tension, and H is a little closer).
 */
export const PARABOLA_TOLERANCE = 0.01;
/** T/EA above this raises the 'strain-high' warning (a working cable is under a few tenths of a percent). */
export const STRAIN_WARNING = 0.01;
/** The table of a change of state has at most this many rows (temperature) / this many (load factor). */
export const MAX_TABLE_ROWS = 41;
export const MAX_FACTOR_ROWS = 21;

/* ── The inputs ───────────────────────────────────────────────────────── */

/** The cable and its load, in the engine's units. */
export interface Setup {
  /** Horizontal distance between the supports (L), > 0. */
  L: number;
  /** Height of B over A (L), either sign; |h| ≤ 100·L. */
  h: number;
  /** Load per unit horizontal length (F/L), ≥ 0. */
  q: number;
  /** Weight per unit length of cable (F/L), ≥ 0. q + w > 0. */
  w: number;
  /** Modulus × area (F): null is an inextensible cable. */
  EA: number | null;
}

/**
 * What is known, and its value (the engine's units). All values must be > 0.
 *   'H'        the horizontal tension (F).
 *   'sag-mid'  the mid-span sag (L): see THE TWO SAGS.
 *   'sag-low'  the depth of the lowest point below the lower support (L).
 *   'T-high'   the tension at the higher support (F) — the larger one, when the span is not level.
 *   'T-low'    the tension at the lower support (F).
 *   'length'   the cable's UNSTRETCHED length (L).
 */
export type Known =
  | { kind: 'H'; value: number }
  | { kind: 'sag-mid'; value: number }
  | { kind: 'sag-low'; value: number }
  | { kind: 'T-high'; value: number }
  | { kind: 'T-low'; value: number }
  | { kind: 'length'; value: number };
export type KnownKind = Known['kind'];

export interface HangingInput extends Setup {
  known: Known;
}

/** A state of the cable in a change of state: its loads (the section, the span and the elasticity are the cable's). */
export interface StateLoads {
  q: number;
  w: number;
}

export interface StateInput {
  L: number;
  h: number;
  EA: number | null;
  /** What is known about state 1 (the same choices as the hanging cable). */
  known: Known;
  state1: StateLoads;
  /**
   * State 2: its loads and THE THERMAL STRAIN α·(T2 − T1) (no unit; negative for
   * cooling). The cable's unstressed length goes from L0 to L0·(1 + thermal).
   */
  state2: StateLoads & { thermal: number };
  /**
   * Optional tables. `thermal`: one row per thermal strain α·(T − T1) at the loads of
   * state 2. `loads`: one row per pair of loads at state 2's temperature. At most 41
   * and 21 rows (MAX_TABLE_ROWS, MAX_FACTOR_ROWS); more are refused ('table').
   */
  sweep?: { thermal?: number[]; loads?: StateLoads[] };
}

export interface PointLoad {
  /** Horizontal distance from A (L), strictly between 0 and L. */
  x: number;
  /** Downward force (F). A negative one pulls up (see 'upward-load'). */
  P: number;
}

/**
 * What is known in a funicular cable.
 *   'sag'    the vertical distance (L) between the chord and the cable at the
 *            horizontal position x (not necessarily at a load; > 0 below the chord).
 *   'H'      the horizontal tension (F).
 *   'T-max'  the largest tension in the cable (F), at a support.
 */
export type PointsKnown = { kind: 'sag'; x: number; value: number } | { kind: 'H'; value: number } | { kind: 'T-max'; value: number };

export interface PointsInput {
  L: number;
  h: number;
  loads: PointLoad[];
  known: PointsKnown;
}

/* ── What goes wrong ──────────────────────────────────────────────────── */

/**
 * Every reason the engine returns no solution. Each is a STABLE MACHINE CODE.
 * `field` names the input at fault, `state` (1 or 2) the state of a change of
 * state, `index` the load (INDEX FROM 0 in the input; analysis.ts turns it
 * into a label from 1).
 *
 *  'number'                 an input is not a finite number, or is past 1e30 in size.     field
 *  'span'                   L is not > 0.
 *  'rise'                   |h| > 100·L.                                                  ratio = |h|/L; max
 *  'load-zero'              q and w are both 0: with no load there is no sag to          state
 *                           speak of (the cable is straight). In a change of state it is
 *                           state 1's; state 2's is 'state2-load-zero'.
 *  'section'                EA given and not a finite number > 0.                          field
 *  'known-value'            the known value is not a finite number > 0.                    field = the known's kind
 *  'sag-range'              a given mid-span sag / L outside 1e-6 … 100.                   ratio; min; max
 *  'length-below-chord'     the unstretched length is not longer than the chord (an        chord; length; state
 *                           inextensible cable cannot reach). Also for an elastic one
 *                           if it is shorter than the chord by more than the
 *                           solver's range (a strain far beyond 100 %).
 *  'tension-below-minimum'  the given tension is below the least tension the cable           min = that least tension; value
 *                           can have in this span and load, searched between 1e-2 and
 *                           1e9 times (q + w)·L of horizontal tension. (For q only the tension
 *                           never falls below ≈ qL/2 however slack the cable.)
 *  'state2-load-zero'       state 2 has no load: the cable would be straight (taut)        chord; length = state 2's unstressed length
 *                           or slack, and a "sag" has no meaning. SLACK when the
 *                           unstressed length is the longer.
 *  'state2-too-short'       an inextensible cable at state 2 cannot reach: its              chord; length = state 2's unstressed length
 *                           unstressed length L0·(1 + thermal) is not longer than the
 *                           chord (the temperature fell, or the span was moved). With
 *                           elasticity there is always a (very tight) answer.
 *  'thermal'                the thermal strain is not a finite number, or is ≤ −1.         value
 *  'table'                  a table asks for more rows than it may.                         count; max; field = 'thermal' | 'loads'
 *  'too-many-loads'         more than 12 point loads.                                      count; max
 *  'load-position'          a point load at a position not strictly between 0 and L.        index; value
 *  'duplicate-position'     two point loads at one position.                                indices = [first, second]
 *  'no-loads'               no point load, or every one is 0: the cable is straight.
 *  'sag-position'           the position of the given sag is not strictly between 0 and L,  value
 *                           or the loads' moment there is 0 (the sag would be 0 for any H).
 *  'negative-tension'       the given sag has the wrong sign for the loads (the cable    value = the H it would need (≤ 0)
 *                           would have to be above its chord, or H = 0): slack.
 *  'solver'                 a bracketed solve did not close (never expected).              state; field
 *  'size'                   a number in the results is past what a double holds.
 */
export type CableIssueCode =
  | 'number'
  | 'span'
  | 'rise'
  | 'load-zero'
  | 'section'
  | 'known-value'
  | 'sag-range'
  | 'length-below-chord'
  | 'tension-below-minimum'
  | 'state2-load-zero'
  | 'state2-too-short'
  | 'thermal'
  | 'table'
  | 'too-many-loads'
  | 'load-position'
  | 'duplicate-position'
  | 'no-loads'
  | 'sag-position'
  | 'negative-tension'
  | 'solver'
  | 'size';

export const ISSUE_CODES: readonly CableIssueCode[] = [
  'number',
  'span',
  'rise',
  'load-zero',
  'section',
  'known-value',
  'sag-range',
  'length-below-chord',
  'tension-below-minimum',
  'state2-load-zero',
  'state2-too-short',
  'thermal',
  'table',
  'too-many-loads',
  'load-position',
  'duplicate-position',
  'no-loads',
  'sag-position',
  'negative-tension',
  'solver',
  'size',
];

export interface CableIssue {
  code: CableIssueCode;
  field?: string;
  state?: 1 | 2;
  index?: number;
  indices?: number[];
  value?: number;
  ratio?: number;
  min?: number;
  max?: number;
  chord?: number;
  length?: number;
  count?: number;
}

/**
 * What the engine says without refusing: the solution is there.
 *  'parabola-differs'  the parabolic approximation differs from the exact result    difference (relative, the worst of H, T, sag);
 *                      by more than PARABOLA_TOLERANCE (1 %).                       tolerance; ratio = the mid-span sag / L
 *  'strain-high'       the largest T/EA is above 1 %.                               strain
 *  'vertex-outside'    the cable's lowest point is outside the span: the cable      x = where the (imaginary) lowest point would be,
 *                      rises (or falls) all the way from one support to the other.   from A
 *  'tension-two-roots' a given tension is the tension of two cables, a taut one     alternative H (the slack one)
 *                      (returned) and a slack one (`alternative`).
 *  'upward-load'       a point load pulls up: the funicular polygon may rise         count
 *                      above its chord.
 *  'zero-load'         a point load of 0: it changes nothing.                        count
 *  'sag-not-at-load'   the given sag is at a position that carries no load: it is    value = x
 *                      a point on a segment.
 */
export type CableWarningCode = 'parabola-differs' | 'strain-high' | 'vertex-outside' | 'tension-two-roots' | 'upward-load' | 'zero-load' | 'sag-not-at-load';
export const WARNING_CODES: readonly CableWarningCode[] = ['parabola-differs', 'strain-high', 'vertex-outside', 'tension-two-roots', 'upward-load', 'zero-load', 'sag-not-at-load'];

export interface CableWarning {
  code: CableWarningCode;
  state?: 1 | 2;
  difference?: number;
  tolerance?: number;
  ratio?: number;
  strain?: number;
  x?: number;
  value?: number;
  count?: number;
}

export interface CableFailure {
  ok: false;
  issues: CableIssue[];
}

/* ── What comes back: the hanging cable ───────────────────────────────── */

export interface CableShape {
  /** The cable as solved (the engine's units): enough to draw it again (`curveOf`). */
  setup: Setup;
  /** The horizontal tension: "the pretension". */
  H: number;
  slope: { A: number; B: number };
  tension: { A: number; B: number; high: number; low: number; max: number; maxAt: 'A' | 'B'; min: number };
  /** Vertical force of each support ON THE CABLE, up positive. */
  reaction: { A: number; B: number };
  /** Degrees below the horizontal at each support, into the span (see GEOMETRY AND SIGNS). */
  angle: { A: number; B: number };
  sagMid: number;
  sagLow: number;
  /** The lowest point: x from A, z in the level of A (negative when below A); `inside`: it is between the supports. */
  vertex: { x: number; z: number; inside: boolean };
  /** Stretched length, unstretched length, and their difference. */
  length: number;
  unstretched: number;
  elongation: number;
  /** T_max / EA; null for an inextensible cable. */
  strain: number | null;
  /** The total vertical load carried = reaction.A + reaction.B. */
  load: number;
}

/** (parabolic − exact) / exact, per quantity; `worst` is the largest absolute one of H, tension, sagMid. */
export interface Difference {
  H: number;
  tension: number;
  sagMid: number;
  length: number;
  worst: number;
}

export type Family = 'parabola' | 'catenary' | 'combined';

export interface HangingSolution {
  ok: true;
  /** 'parabola': q only (the exact shape IS the parabola); 'catenary': w only; 'combined': both. */
  family: Family;
  /** The straight distance A–B. */
  chord: number;
  exact: CableShape;
  /** The same known solved with all the load per horizontal length (q + w). Null if that solve failed. For family 'parabola' it equals `exact`. */
  parabolic: CableShape | null;
  /** Null for family 'parabola'. */
  difference: Difference | null;
  /** For a tension known: the slack cable with the same tension. Null otherwise. */
  alternative: { H: number; sagMid: number } | null;
  warnings: CableWarning[];
}

export type HangingOutcome = HangingSolution | CableFailure;

/* ── What comes back: a change of state ───────────────────────────────── */

export interface StateRow {
  /** Index in the sweep that asked for it, from 0. */
  index: number;
  ok: boolean;
  /** Set when `ok` is false: the problem, as a code. */
  code?: CableIssueCode;
  H?: number;
  sagMid?: number;
  sagLow?: number;
  tensionMax?: number;
  tensionHigh?: number;
  tensionLow?: number;
  length?: number;
  unstretched?: number;
}

export interface StateSolution {
  ok: true;
  family: Family;
  chord: number;
  /** Exact shapes of both states. */
  exact: { state1: CableShape; state2: CableShape };
  /** The same change of state with all the load per horizontal length; null if it could not be solved. */
  parabolic: { state1: CableShape; state2: CableShape } | null;
  /** state 2's H over state 1's. 1 exactly for no change. */
  ratioH: number;
  /** The unstressed length of state 2 over state 1's: 1 + thermal. */
  ratioLength: number;
  tables: { thermal: StateRow[]; loads: StateRow[] };
  warnings: CableWarning[];
}

export type StateOutcome = StateSolution | CableFailure;

/* ── What comes back: the funicular cable ─────────────────────────────── */

export interface Joint {
  /** 'A', 'B' the supports; 'load' a point load. */
  kind: 'A' | 'B' | 'load';
  /** Index in the input's `loads` for a load; −1 for a support. */
  source: number;
  /** x from A. */
  x: number;
  /** Level of the cable, z, relative to A's, up positive. */
  z: number;
  /** How far the cable is BELOW the chord here (0 at the supports). */
  sag: number;
  /** The load at the joint (F, down positive); 0 at a support. */
  P: number;
}

export interface Segment {
  /** Joint indices (into `joints`). */
  from: number;
  to: number;
  dx: number;
  dz: number;
  length: number;
  /** dz/dx, and the same as an angle in degrees (positive: rises to the right). */
  slope: number;
  angle: number;
  /** Tension T = H·√(1 + slope²), and its vertical component H·slope (positive: pulls the left joint down / the right one up, i.e. the cable rises to the right). */
  tension: number;
  vertical: number;
}

export interface PointsSolution {
  ok: true;
  chord: number;
  H: number;
  /** A, the loads in order of x, B. */
  joints: Joint[];
  /** One more than the loads. */
  segments: Segment[];
  length: number;
  /** Vertical force of each support on the cable (up positive) — H is the horizontal one. */
  reaction: { A: number; B: number };
  /** The largest tension, and the segment (index into `segments`) with it: the first, where several are equal. */
  tensionMax: { value: number; segment: number };
  /** The lowest joint of the polygon (index into `joints`) and its level z. */
  lowest: { joint: number; z: number };
  /** Σ P. */
  totalLoad: number;
  warnings: CableWarning[];
}

export type PointsOutcome = PointsSolution | CableFailure;
