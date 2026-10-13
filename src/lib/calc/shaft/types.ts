import type { BeamExtreme, BeamSolution, Side } from '../beam/solver';

/**
 * ─────────────────────────────────────────────────────────────────
 * SHAFT ON BEARINGS — what the engine is given and what it returns
 * ─────────────────────────────────────────────────────────────────
 * The fourth calculator of the catalogue ("Shaft on bearings",
 * /resources/shaft-on-bearings): a round shaft whose diameter changes in
 * steps, carried by TWO bearings, loaded across its axis in any direction —
 * so in two planes at once — and its reactions, bending and deflection.
 *
 * This file is the agreement between the engine (engine.ts), the form
 * (model.ts), the drawing and the page. It holds types and nothing else.
 *
 * TWO BEARINGS, each a simple support: it holds the shaft against moving
 * across its axis and leaves it free to turn (a self-aligning bearing; a
 * bearing short beside the shaft). The shaft is then statically
 * determinate: its reactions, shears and moments follow from equilibrium
 * alone, whatever its diameters, and only its slopes and deflections depend
 * on them. Either bearing may stand inside the shaft, with an overhang past
 * it.
 *
 * TWO PLANES. A force across the shaft is given by its two components: V in
 * the vertical plane and H in the horizontal one. Each plane is a beam of
 * its own, solved on its own; what the shaft feels at a section is the two
 * together — the RESULTANT, the root of the sum of their squares. A round
 * section has the same stiffness every way, so that is exact: the resultant
 * moment bends it about one diameter, and the bending stress is that moment
 * over the section modulus.
 *
 * UNITS: any consistent set: lengths in one unit (L), forces in one unit
 * (F): a moment in F·L, a flexural stiffness EI in F·L², a weight per
 * length in F/L. Slopes are radians, deflections are lengths: the engine is
 * given each segment's own EI and returns them outright (not multiplied by
 * a reference EI, as the beam engines return theirs: there is no one EI
 * here to leave out).
 *
 * POSITIONS: x along the shaft from its left end, 0 to L.
 *
 * SIGNS, plane by plane, as in beam/solver.ts — in the model: a force
 * positive DOWNWARD in the vertical plane and positive TOWARDS THE VIEWER
 * in the horizontal one (the viewer stands beside the shaft, its left end to
 * the left); a couple positive counter-clockwise as seen in its plane. In
 * the results, for each plane: a reaction positive against a positive force
 * (upward; away from the viewer), shear positive when the part to the left
 * of the cut is pushed that same way, moment positive sagging (the fibre
 * on the side a positive force pushes towards is in tension), deflection
 * positive against a positive force, slope positive counter-clockwise.
 * A RESULTANT is a size: never negative.
 */

/** A stretch of the shaft with one section. They follow one another from x = 0 with no gap; their lengths add up to L. */
export interface ShaftSegment {
  /** Length. */
  L: number;
  /** Flexural stiffness E·I of the section (F·L²). */
  EI: number;
  /** Section modulus I ÷ (outer diameter ÷ 2), for the bending stress (L³). Zero or missing: no stress is worked out for this segment. */
  Z?: number;
  /** Own weight per length (F/L), a load in the vertical plane, downward. Zero or missing: none. */
  w?: number;
}

/** A force across the shaft at x, by its components. Positive: downward (v), towards the viewer (h). */
export interface ShaftForce {
  x: number;
  v: number;
  h: number;
}

/** A couple applied at x in each plane (an axial force on a gear, at its radius). Positive counter-clockwise as seen in that plane. */
export interface ShaftCouple {
  x: number;
  v: number;
  h: number;
}

export interface ShaftModel {
  segments: ShaftSegment[];
  /** Where the two bearings stand, x of each, in either order. */
  bearings: [number, number];
  forces?: ShaftForce[];
  couples?: ShaftCouple[];
}

export type ShaftIssueCode =
  | 'no-segments' // there is not one segment
  | 'length' // a segment's length is not a positive number, or not of a size the engine takes
  | 'stiffness' // a segment's EI is not a positive number, or the stiffest is too far above the softest
  | 'number' // a force, a couple, a weight or a section modulus is not a number, or is larger than the engine takes
  | 'outside' // a force, a couple or a bearing is placed off the shaft
  | 'bearings' // the two bearings stand at one place, or too close together to be solved to the figures printed
  | 'short-segment'; // a segment too short beside the shaft to be solved to the figures printed

export interface ShaftIssue {
  code: ShaftIssueCode;
  /** The entry at fault, by its index in its list; a bearing by 0 or 1. */
  where?: { list: 'segments' | 'bearings' | 'forces' | 'couples'; index: number };
}

/** One plane of the shaft at x. */
export interface PlaneState {
  /** Shear. */
  V: number;
  /** Bending moment. */
  M: number;
  /** Slope, radians. */
  theta: number;
  /** Deflection. */
  v: number;
}

/** The shaft at x: each plane, and the two together. */
export interface ShaftState {
  x: number;
  /** The segment the section is in (at a step, the one on the side asked for). */
  segment: number;
  vertical: PlaneState;
  horizontal: PlaneState;
  /** Sizes of the resultant shear, moment, slope and deflection. */
  V: number;
  M: number;
  theta: number;
  v: number;
  /** Bending stress of the resultant moment in this section, M ÷ Z: nominal, with no stress raiser. Null where the segment has no Z. */
  sigma: number | null;
}

/** A bearing of the solved shaft. */
export interface ShaftBearing {
  x: number;
  /** Reaction by planes (positive upward; positive away from the viewer). */
  vertical: number;
  horizontal: number;
  /** The radial load on the bearing: the size of the two together. */
  radial: number;
  /** The slope of the shaft at the bearing, by planes and as one angle (radians): what the bearing must take as misalignment. */
  thetaVertical: number;
  thetaHorizontal: number;
  theta: number;
}

/** One segment of the solved shaft, with the largest values inside it. */
export interface ShaftSegmentResult {
  index: number;
  from: number;
  to: number;
  /** The largest resultant moment in the segment, and where (at an end, the end's own side). */
  M: BeamExtreme;
  /** The largest bending stress in the segment — that moment over the segment's Z — and where. Null without Z. */
  sigma: BeamExtreme | null;
  /** The largest resultant deflection in the segment, and where. */
  v: BeamExtreme;
}

export interface ShaftSolution {
  ok: true;
  L: number;
  /** Every position where something happens — an end, a step, a bearing, a force or a couple that has a size (one whose two components are both zero is not a place) — 0 and L included, ascending, each once. */
  breaks: number[];
  /**
   * Each plane as the FIRST engine solves a beam on a pin and a roller under
   * ALL of that plane's loads: its reactions, shear and moment are that
   * plane's by that engine's own sums — right to the size of the loads, and
   * not to the figures of a value that is small beside them (engine.ts: a
   * moment near the right end, a force standing on a bearing). What a page
   * prints is read from `bearings`, `at` and `stations`, which the shaft's
   * engine reads otherwise, and not from here. (Its `EItheta` and `EIv`
   * are NOT the shaft's: that engine knows one stiffness. The shaft's
   * slopes and deflections are in `at` and `stations`.)
   */
  planes: { vertical: BeamSolution; horizontal: BeamSolution };
  bearings: [ShaftBearing, ShaftBearing];
  /** The shaft at x; where something jumps (a shear at a force, a moment at a couple, the stress at a step), on the side asked for: right by default, left at x = L. */
  at(x: number, side?: Side): ShaftState;
  /** Points for plotting: both sides of every break, and enough in between. */
  stations: ShaftState[];
  segments: ShaftSegmentResult[];
  /** The largest values on the whole shaft, each with its place. Sizes for the resultant; `sigma` null when no segment has a Z. */
  extremes: {
    V: BeamExtreme;
    M: BeamExtreme;
    theta: BeamExtreme;
    v: BeamExtreme;
    sigma: BeamExtreme | null;
    /** Highest and lowest of each plane, signed, as a beam's are reported. */
    vertical: { Mmax: BeamExtreme; Mmin: BeamExtreme; vMax: BeamExtreme; vMin: BeamExtreme };
    horizontal: { Mmax: BeamExtreme; Mmin: BeamExtreme; vMax: BeamExtreme; vMin: BeamExtreme };
  };
  /** Resultant of the applied loads in each plane (own weight included in the vertical one), positive as a force is. */
  totalLoad: { vertical: number; horizontal: number };
  /**
   * The size of the problem as a force — every force's size, every couple
   * over the distance between the bearings, the whole weight: what rounding
   * is measured against. A value a billionth of it (times a length, for a
   * moment) is zero, not a result.
   */
  loadScale: number;
  /**
   * The size of the problem as a slope and as a deflection, as `loadScale` is
   * its size as a force: `loadScale` × L² ÷ the EI of the stiffest segment,
   * and that × L. What rounding in a slope and in a deflection is measured
   * against: a value a billionth of it is zero, not a result (engine.ts has
   * what was measured, and why it is the stiffest segment's).
   */
  slopeScale: number;
  deflectionScale: number;
}

export type ShaftOutcome = ShaftSolution | { ok: false; issues: ShaftIssue[] };

/* ── What the drawing is given ────────────────────────────────────────── */

/**
 * The shaft as it is drawn, in the units shown: the drawing knows nothing
 * of the form or the engine. One view at a time: the vertical plane (seen
 * from the side), the horizontal plane (seen from above), or both planes'
 * loads as their resultants.
 */
export interface ShaftDrawing {
  /** Total length, and its unit as written. */
  L: number;
  lengthUnit: string;
  /** The profile: each segment's ends, its outer diameter and its bore (0 for a solid one), in one unit of length (the drawing scales them). */
  segments: { from: number; to: number; d: number; bore: number }[];
  /** The two bearings, with the reaction to write beside each in this view (null: none to write — the shaft is not solved). */
  bearings: { x: number; reaction: number | null }[];
  /** The forces of this view, each with its signed size (positive drawn as this view's positive direction) and the text of its size. */
  forces: { id: string; x: number; value: number; label: string }[];
  /** The couples of this view. */
  couples: { id: string; x: number; value: number; label: string }[];
  /** Own weight drawn along the shaft (vertical view only). */
  ownWeight: boolean;
}
