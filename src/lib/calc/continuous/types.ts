import type { BeamExtreme, BeamSolution, Side, SupportKind } from '../beam/solver';

/**
 * ─────────────────────────────────────────────────────────────────
 * CONTINUOUS BEAM — what the engine is given and what it returns
 * ─────────────────────────────────────────────────────────────────
 * The third calculator of the catalogue ("Continuous beam",
 * /resources/continuous-beam): a beam entered span by span, each span with
 * its own stiffness, on supports that may settle, solved by the direct
 * stiffness method — one finite element per span (engine.ts) — and, when
 * asked, under every arrangement of the live load at once (envelope.ts).
 *
 * This file is the agreement between the engine, the form (model.ts) and the
 * page. It holds types and nothing else.
 *
 * UNITS: any consistent set, as in beam/solver.ts: lengths in one unit (L),
 * forces in one unit (F): P in F, w in F/L, M in F·L.
 *
 * STIFFNESS. One reference stiffness EI stands for the whole beam and is NOT
 * an input: each span says how stiff it is as a multiple of it (`k`), and
 * that is all the reactions, shears and moments of a loaded beam depend on.
 * Slopes and deflections are returned multiplied by the reference EI
 * (`EItheta` in F·L², `EIv` in F·L³), as the first engine returns them, for
 * the caller to divide. A settlement is a length, so it is given the same
 * way: multiplied by the reference EI.
 *
 * SIGNS — as in beam/solver.ts. In the model: loads positive DOWNWARD,
 * settlements positive DOWNWARD. In the results: reactions positive upward,
 * a wall's moment positive counter-clockwise as it acts on the beam, shear
 * positive when the part to the left of the cut is pushed up, moment
 * positive sagging, deflection positive UPWARD, slope positive
 * counter-clockwise.
 *
 * POSITIONS. In the model a load is placed on ITS span, from that span's
 * left end. In the results x runs along the whole beam from its left end.
 * Two places of a span that a position along the beam cannot tell apart —
 * closer than 4e-14 of the beam's length — are ONE place in a solution: a
 * load that close to a support stands on it (engine.ts, `placedLoads`).
 */

/** How an end of the beam is held: on a simple support, built into a wall, or not at all (the end span is then an overhang). */
export type EndKind = 'pin' | 'fixed' | 'free';

export interface ContinuousSpan {
  /** Length. */
  L: number;
  /** Flexural stiffness of the span as a multiple of the reference EI: 1 where the span has the reference section. */
  k: number;
}

/** A point load on one span, `a` from that span's left end. Positive downward. */
export interface SpanPointLoad {
  /** Index of the span, from 0. */
  span: number;
  a: number;
  P: number;
  /** Part of the live load, which may be on this span or off it (envelope.ts); otherwise it is always there. */
  live?: boolean;
}

/** A distributed load on one span, varying linearly from w1 at a1 to w2 at a2 (from that span's left end). Positive downward. */
export interface SpanDistLoad {
  span: number;
  a1: number;
  a2: number;
  w1: number;
  w2: number;
  live?: boolean;
}

export interface ContinuousModel {
  /** Left to right. The joints are the ends of the spans: spans.length + 1 of them. */
  spans: ContinuousSpan[];
  /** Every joint between two spans is a simple support. The two ends say how they are held. */
  left: EndKind;
  right: EndKind;
  /**
   * How far each joint's support is pushed DOWN, multiplied by the reference
   * EI (F·L³): one per joint, left to right. Missing, or zero: the support
   * does not move. Ignored at a free end, where there is no support.
   */
  settlements?: number[];
  points?: SpanPointLoad[];
  dists?: SpanDistLoad[];
}

export type ContinuousIssueCode =
  | 'no-spans' // there is not one span
  | 'length' // a span's length is not a positive number, or not of a size the engine takes
  | 'stiffness' // a span's stiffness factor is not a positive number, or is out of the range the engine takes
  | 'number' // a load or a settlement is not a number, or is larger than the engine takes
  | 'outside' // a load is placed off its span, or names a span that is not there
  | 'short-span' // a span too short beside the others to be solved to the figures printed
  | 'unstable'; // the supports do not hold the beam

export interface ContinuousIssue {
  code: ContinuousIssueCode;
  /** The entry at fault: a span, a joint's settlement, or a load by its index in its list. */
  where?: { list: 'spans' | 'settlements' | 'points' | 'dists'; index: number };
}

/** A joint of the solved beam: an end of a span. */
export interface ContinuousJoint {
  x: number;
  /** What holds it, as the first engine names supports (the first simple support is the 'pin', the others 'roller'); null at a free end. */
  support: SupportKind | null;
  /** The bending moment in the beam at the joint, positive sagging: over an interior support it is the hogging moment, negative. Zero at an end that is a simple support or free. */
  M: number;
  /** Reference EI times the slope there. */
  EItheta: number;
  /** Reference EI times the deflection there, positive upward: minus the settlement given, at a support. */
  EIv: number;
}

/** One span of the solved beam, with the largest values inside it. */
export interface ContinuousSpanResult {
  /** Index of the span, from 0. */
  index: number;
  from: number;
  to: number;
  /** 'cantilever' when one of its ends is a free end of the beam. */
  kind: 'span' | 'cantilever';
  /** Largest sagging moment in the span (the highest M), and where; and the lowest M. */
  Mmax: BeamExtreme;
  Mmin: BeamExtreme;
  Vmax: BeamExtreme;
  Vmin: BeamExtreme;
  /**
   * The largest deflection of the span, either way, as reference EI × v, and
   * where — MEASURED FROM THE SPAN'S OWN SUPPORTS: from the straight line
   * through its two ends for a span, from its supported end for a
   * cantilever. With supports that do not settle that is the deflection
   * itself; with ones that do, it is what a deflection limit is written for.
   */
  EIvChord: BeamExtreme;
}

/**
 * The beam solved under all its loads. It IS a `BeamSolution` of the first
 * engine — `at`, `stations`, `breaks`, `reactions`, `extremes`, `totalLoad`,
 * `residual`, with x along the whole beam and EI the reference EI — so that
 * everything written for one (the drawing, the three diagrams, the tables)
 * reads it as it is. Plus what a continuous beam is asked about: its joints
 * and its spans.
 */
export interface ContinuousSolution extends BeamSolution {
  joints: ContinuousJoint[];
  spans: ContinuousSpanResult[];
  /**
   * As in a `BeamSolution`, what is left of ΣF and ΣM once the reactions are
   * in; and `slope`, what a beam solved joint by joint can leave besides:
   * the largest difference, at a support, between the slope (reference EI ×)
   * of the span before it and of the span after it — a kink, in a beam that
   * has none. Zero but for rounding; no beam is returned with one of more
   * than a hundred-millionth of its largest slope — and, where every slope
   * is itself all but nothing (the loads standing on the supports, nothing
   * bends), of more than what rounding is beside the size of the problem:
   * a million-millionth of it, over the smallest stiffness factor
   * (engine.ts, KINK).
   */
  residual: { force: number; moment: number; slope: number };
  /**
   * The size of the problem, as a force: every load's magnitude added up
   * and, for each span whose two supports settle by different amounts, the
   * moment that would take with the span's ends held (6k × the difference
   * ÷ its length²) over the length of the beam. What rounding is measured
   * against — with settlements and no load, the loads alone are no measure.
   */
  loadScale: number;
}

export type ContinuousOutcome = ContinuousSolution | { ok: false; issues: ContinuousIssue[] };

/* ── Every arrangement of the live load ───────────────────────────────── */

/** The two ends of what a response can be, over every arrangement of the live load. */
export interface Range {
  max: number;
  min: number;
}

/** A largest (or smallest) value, where it occurs, and the arrangement that gives it. */
export interface Governing {
  value: number;
  /** Where along the beam; for a value that belongs to a joint, the joint's x. */
  x: number;
  /** The spans whose live load is ON in the arrangement that gives this value: indices from 0, ascending. Empty: no live load on at all. */
  spans: number[];
}

/** The response at a point, as a range. */
export interface EnvelopeState {
  x: number;
  V: Range;
  M: Range;
  /** Reference EI × deflection, positive upward. */
  EIv: Range;
}

export interface EnvelopeJoint {
  x: number;
  support: SupportKind | null;
  /** Reaction, upward. */
  Rv: { max: Governing; min: Governing };
  /** Moment of a wall on the beam, counter-clockwise; both zero unless the joint is a fixed end. */
  Rm: { max: Governing; min: Governing };
  /** Bending moment in the beam at the joint, sagging positive. */
  M: { max: Governing; min: Governing };
}

export interface EnvelopeSpan {
  index: number;
  from: number;
  to: number;
  kind: 'span' | 'cantilever';
  /** The highest and the lowest moment and shear anywhere in the span, over every arrangement. */
  Mmax: Governing;
  Mmin: Governing;
  Vmax: Governing;
  Vmin: Governing;
  /** The largest deflection from the span's own supports (see ContinuousSpanResult.EIvChord), either way, over every arrangement. */
  EIvChord: Governing;
}

/**
 * The beam under EVERY arrangement of its live load: each span's live load
 * may be on or off, whatever the others are (2ⁿ arrangements for n spans
 * that carry live load); the loads that are not live, and the settlements,
 * are always there.
 */
export interface ContinuousEnvelope {
  ok: true;
  L: number;
  /** As in a solution: every position where something happens, 0 and L included. */
  breaks: number[];
  /** The range of the response at x; where it jumps, on the side asked for (right by default, left at x = L). */
  at(x: number, side?: Side): EnvelopeState;
  /** Points for plotting the two edges of each band: both sides of every break, every place where an edge has a corner, and enough in between. */
  stations: EnvelopeState[];
  extremes: { Vmax: Governing; Vmin: Governing; Mmax: Governing; Mmin: Governing; EIvMax: Governing; EIvMin: Governing };
  joints: EnvelopeJoint[];
  spans: EnvelopeSpan[];
  /** The one arrangement with every live load on: what `solveContinuous` returns for the same model. */
  all: ContinuousSolution;
}

export type EnvelopeOutcome = ContinuousEnvelope | { ok: false; issues: ContinuousIssue[] };
