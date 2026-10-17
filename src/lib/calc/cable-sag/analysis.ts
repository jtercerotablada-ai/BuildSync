import type { UnitSystem } from '../beam/model';
import { curveOf, solveHanging, solvePoints, solveState } from './engine';
import {
  CABLE_UNITS,
  FROM_ENGINE,
  TO_ENGINE,
  issueField,
  toEngine,
  MODES,
  type CableSagForm,
  type CableSagMode,
  type EngineInput,
  type FormField,
  type PointsKnownField,
  type WeightFrom,
} from './model';
import type { CableIssue, CableIssueCode, CableShape, CableWarning, Difference, Family, HangingSolution, PointsSolution, StateRow, StateSolution } from './types';

/**
 * ─────────────────────────────────────────────────────────────────────────────
 * CABLE SAG AND PRETENSION — from the form to everything the page prints
 * ─────────────────────────────────────────────────────────────────────────────
 * This calculator's `analyse` (truss/analysis.ts is the fifth's, and this file is
 * written as that one is): the form as it stands (model.ts) goes in; out come the faults
 * by field and — when the case can be solved — every number of the tables and every line of
 * the drawing, ALREADY SETTLED and IN THE UNITS SHOWN. A value that is rounding is zero here,
 * once, so the table, the drawing and the words for a screen reader cannot say different
 * things. The component lays it out and decides nothing about a number.
 *
 * NO WORDS. Where a word is wanted this file gives a STABLE MACHINE CODE and the numbers the
 * sentence needs; strings.ts (the page's, in both languages) writes the sentence. The codes:
 *
 *   issues.code     CableIssueCode (types.ts lists every one with its numbers) plus 'stopped':
 *                   the arithmetic threw (never expected).
 *   warnings.code   CableWarningCode (types.ts).
 *   family          'parabola' | 'catenary' | 'combined'  (the exact shape of the cable)
 *   hanging.given   'sag-mid' | 'sag-low' | 'H' | 'T-high' | 'T-low' | 'length'  (what was known)
 *   points.given    'sag' | 'H' | 'T-max'
 *   joint.kind      'A' | 'B' | 'load'
 *   row.code        a table row that could not be solved: CableIssueCode
 *
 * LABELS. Point loads are numbered FROM 1 as the form lists them ("load 1"); a joint of the
 * funicular polygon carries the label of its load (`label`, 0 for a support); the engine
 * counts from 0 and the +1 is made here and nowhere else.
 *
 * WHAT COUNTS AS ZERO (`floors`). A force that is a billionth of the largest force of the
 * cable (its H, its largest tension) is exactly 0; an angle under a billionth of a degree, a
 * length under a billionth of the span, an elongation under a billionth of the cable. A zero is
 * never −0 and never printed as 1e-14. The relative differences between the parabola and the
 * exact cable are 0 under 1e-9.
 *
 * UNITS. Lengths, forces, tensions, reactions are the engine's numbers in the units shown
 * (ft/kip or m/kN). Elongation is brought to inches or millimetres, stress to ksi or MPa
 * (model.ts, FROM_ENGINE). Angles are degrees. Strains are ratios (no unit; the page may
 * show them as a percent).
 */

export type AnalysisIssueCode = CableIssueCode | 'stopped';

export interface AnalysisIssue {
  code: AnalysisIssueCode;
  /** The field of the form at fault (a point load by its id). */
  field?: FormField;
  state?: 1 | 2;
  /** A point load's label (from 1), or two for 'duplicate-position'. */
  at?: number;
  ats?: number[];
  value?: number;
  ratio?: number;
  min?: number;
  max?: number;
  chord?: number;
  length?: number;
  count?: number;
}

export interface AnalysisWarning {
  code: CableWarning['code'];
  state?: 1 | 2;
  difference?: number;
  tolerance?: number;
  ratio?: number;
  strain?: number;
  x?: number;
  value?: number;
  count?: number;
  cause?: 'depth' | 'elasticity';
}

/* ── One cable ────────────────────────────────────────────────────────── */

/** One cable, every number in the units shown (types.ts, CableShape, says what each is). */
export interface ShapeLine {
  H: number;
  tension: { A: number; B: number; high: number; low: number; max: number; maxAt: 'A' | 'B'; min: number };
  /** Vertical force of each support on the cable (up positive). The horizontal one is H. */
  reaction: { A: number; B: number };
  /** Degrees below the horizontal at each support, into the span. */
  angle: { A: number; B: number };
  slope: { A: number; B: number };
  sagMid: number;
  sagLow: number;
  /** sagMid over the span: the usual sag/span ratio. */
  sagRatio: number;
  vertex: { x: number; z: number; inside: boolean };
  length: number;
  unstretched: number;
  /** In inches or millimetres. */
  elongation: number;
  /** T_max / EA; null for an inextensible cable. */
  strain: number | null;
  /** The total vertical load carried. */
  load: number;
}

export interface SectionLine {
  /** What the cable's weight is taken from. */
  weightFrom: WeightFrom;
  /** The metallic area (in², mm²); the nominal diameter (in, mm) when the section is by diameter, else null. */
  area: number;
  diameter: number | null;
  /** The cable's weight per length (lb/ft, kN/m). */
  selfWeight: number;
  /** E × A (kip, kN); null for an inextensible cable. */
  EA: number | null;
}

/** (parabolic − exact) / exact, as a ratio. */
export interface DifferenceLine {
  H: number;
  tension: number;
  sagMid: number;
  length: number;
  worst: number;
}

/* ── The drawing ──────────────────────────────────────────────────────── */

export interface Point {
  x: number;
  z: number;
}

/**
 * A curve of the drawing, as points from A to B (x from A, z up, in ft or m).
 *   'exact'      the cable (mode hanging): the catenary, the parabola, or the combined shape.
 *   'parabola'   the parabolic approximation, overlaid (hanging; absent for a pure parabola).
 *   'state1'     the cable in state 1 (change of state).
 *   'state2'     the cable in state 2.
 *   'polygon'    the funicular polygon (points).
 */
export type CurveId = 'exact' | 'parabola' | 'state1' | 'state2' | 'polygon';
export interface Curve {
  id: CurveId;
  points: Point[];
}

/**
 * A dimension line for a sag: a vertical segment at `x` from `zTop` (the chord, or the lower
 * support's level) down to `zBottom` (the cable), with its `value`. For a sag measured to the
 * lowest point `low`, `zTop` is the lower support's level and a level line from it is drawn
 * (`level`: the z of that line; the page draws it from the support to x).
 */
export interface Dimension {
  x: number;
  zTop: number;
  zBottom: number;
  value: number;
  /** For the lowest-point sag: the lower support's x, where the level line starts. */
  from?: number;
}

export interface Drawing {
  mode: CableSagMode;
  supports: { A: Point; B: Point };
  /** The straight line A–B. */
  chord: { x0: number; z0: number; x1: number; z1: number };
  curves: Curve[];
  /**
   * The sag(s): `mid` the vertical distance from the chord at mid-span, `low` the depth of the
   * lowest point below the lower support (null where the lowest point is not in the span),
   * `given` which one the visitor gave (null if the sag was not the known). In a funicular
   * cable `mid` is the sag at the stated position (not at mid-span) and `low` is null. In a
   * change of state they are state 2's, `state1` is state 1's mid-span sag.
   */
  sag: { mid: Dimension | null; low: Dimension | null; given: 'mid' | 'low' | null; state1?: Dimension | null };
  /** Where to put the tension labels: at A, at B, and H at the lowest point (or the lower end). */
  labels: { A: Point; B: Point; H: Point };
  /** The point loads of a funicular cable, as arrows ending on the cable. `share` is |P| over the largest, 0 to 1. Empty in the other modes. */
  loads: { label: number; x: number; z: number; P: number; share: number }[];
  /** The box around the supports and the curves, and the same padded all round by `pad` (room for the arrows and the labels). */
  box: { x0: number; z0: number; x1: number; z1: number; width: number; height: number };
  frame: { x0: number; z0: number; x1: number; z1: number; width: number; height: number };
  pad: number;
}

/* ── The results ──────────────────────────────────────────────────────── */

export interface HangingResults {
  family: Family;
  /** What the visitor gave. */
  given: 'sag-mid' | 'sag-low' | 'H' | 'T-high' | 'T-low' | 'length';
  /** The straight distance A–B, and the chord's angle above the horizontal (degrees, signed like the rise). */
  chord: number;
  chordAngle: number;
  section: SectionLine;
  exact: ShapeLine;
  /** The parabolic approximation of the same known; null for a pure parabola (it IS the exact one) or if it could not be solved. */
  parabolic: ShapeLine | null;
  parabolaExact: boolean;
  difference: DifferenceLine | null;
  /** For a tension known: the slack cable with the same tension. */
  alternative: { H: number; sagMid: number } | null;
}

export interface StateTableRow {
  index: number;
  /** The temperature (°F, °C) or the load factor of the row. */
  value: number;
  ok: boolean;
  code?: CableIssueCode;
  /** The row is the case's own state 2 (its temperature / factor 1). */
  isState2: boolean;
  H?: number;
  /** H over state 1's. */
  ratioH?: number;
  sagMid?: number;
  sagLow?: number;
  tensionMax?: number;
  tensionHigh?: number;
  tensionLow?: number;
  length?: number;
  unstretched?: number;
}

export interface StateResults {
  family: Family;
  given: HangingResults['given'];
  chord: number;
  section: SectionLine;
  state1: ShapeLine;
  state2: ShapeLine;
  parabolic: { state1: ShapeLine; state2: ShapeLine } | null;
  change: {
    /** T2 − T1 (°F, °C) and the thermal strain α·ΔT. */
    deltaT: number;
    thermalStrain: number;
    /** State 2 over state 1: H, and the others as differences (state 2 − state 1). */
    ratioH: number;
    deltaH: number;
    deltaSagMid: number;
    deltaTensionMax: number;
    deltaLength: number;
    /** The total load per unit length of each state (lb/ft, kN/m): q + w. */
    loadPerLength: { state1: number; state2: number };
  };
  /** `skipped`: the tables were not solved (`analyseCableSag(form, { tables: false })`): their rows are empty, and are somebody else's to fill. */
  tables: { thermal: StateTableRow[]; loads: StateTableRow[]; notes: AnalysisIssue[]; skipped: boolean };
}

export interface JointLine {
  kind: 'A' | 'B' | 'load';
  /** The load's label from 1; 0 for a support. */
  label: number;
  x: number;
  /** Level, up positive from A. */
  z: number;
  /** How far the cable is below the chord. */
  sag: number;
  P: number;
}

export interface SegmentLine {
  /** From 1, left to right. */
  label: number;
  /** Indices into `joints`. */
  from: number;
  to: number;
  dx: number;
  dz: number;
  length: number;
  slope: number;
  /** Degrees, positive when the cable rises to the right. */
  angle: number;
  tension: number;
  vertical: number;
  /** tension over the largest tension, 0 to 1: the weight of its line. */
  share: number;
}

export interface PointsResults {
  given: PointsKnownField;
  chord: number;
  H: number;
  joints: JointLine[];
  segments: SegmentLine[];
  length: number;
  reaction: { A: number; B: number };
  tensionMax: { value: number; segment: number };
  /** The lowest joint (index into `joints`) and its level. */
  lowest: { joint: number; z: number };
  totalLoad: number;
  /** The sag that was given: its position and value (the given sag, or the one at the middle load when H or T was given: null). */
  sagAt: { x: number; value: number } | null;
  /** Equilibrium, recomputed here from the printed numbers: vertical forces and moments about A of the loads and the reactions, and the largest force left over at any load joint. Exactly 0 below the floor. */
  equilibrium: { sumFz: number; sumM: number; joint: number; balanced: boolean };
}

export interface CableSagAnalysis {
  units: (typeof CABLE_UNITS)[UnitSystem];
  mode: CableSagMode;
  /** Faults that stop a solution, each once. Empty: solved. */
  issues: AnalysisIssue[];
  warnings: AnalysisWarning[];
  /** Exactly one of the three is set when solved, by the form's mode. */
  hanging: HangingResults | null;
  state: StateResults | null;
  points: PointsResults | null;
  drawing: Drawing;
}

/* ── The settling ─────────────────────────────────────────────────────── */

/** Never −0. */
const clean = (v: number): number => (v === 0 ? 0 : v);
const settle = (v: number, floor: number): number => (Math.abs(v) <= floor ? 0 : clean(v));

function lineOf(shape: CableShape, form: CableSagForm): ShapeLine {
  const f = FROM_ENGINE[form.units];
  const L = shape.setup.L;
  const force = Math.max(shape.H, shape.tension.max);
  const ff = 1e-9 * force;
  const lf = 1e-9 * L;
  const deg = 1e-9;
  return {
    H: shape.H,
    tension: { ...shape.tension },
    reaction: { A: settle(shape.reaction.A, ff), B: settle(shape.reaction.B, ff) },
    angle: { A: settle(shape.angle.A, deg), B: settle(shape.angle.B, deg) },
    slope: { A: settle(shape.slope.A, 1e-12), B: settle(shape.slope.B, 1e-12) },
    sagMid: settle(shape.sagMid, lf),
    sagLow: settle(shape.sagLow, lf),
    sagRatio: settle(shape.sagMid / L, 1e-12),
    vertex: { x: settle(shape.vertex.x, lf), z: settle(shape.vertex.z, lf), inside: shape.vertex.inside },
    length: shape.length,
    unstretched: shape.unstretched,
    elongation: settle(shape.elongation * f.elongation, 1e-9 * shape.length * f.elongation),
    strain: shape.strain,
    load: settle(shape.load, ff),
  };
}

const differenceLine = (d: Difference): DifferenceLine => ({
  H: settle(d.H, 1e-9),
  tension: settle(d.tension, 1e-9),
  sagMid: settle(d.sagMid, 1e-9),
  length: settle(d.length, 1e-9),
  worst: settle(d.worst, 1e-9),
});

/** The section as the form states it (what the page's "worked" line shows). */
function sectionOf(form: CableSagForm, input: EngineInput): SectionLine {
  const k = TO_ENGINE[form.units];
  const f = FROM_ENGINE[form.units];
  return {
    weightFrom: form.weightFrom,
    area: input.area / k.area,
    diameter: form.sectionBy === 'diameter' ? form.diameter : null,
    selfWeight: input.self * f.line,
    EA: input.EA,
  };
}

/* ── Issues ───────────────────────────────────────────────────────────── */

function issueLine(i: CableIssue, form: CableSagForm): AnalysisIssue {
  const out: AnalysisIssue = { code: i.code };
  const field = issueField(i, form);
  if (field !== undefined) out.field = field;
  if (i.state) out.state = i.state;
  if (i.index !== undefined) out.at = i.index + 1;
  if (i.indices) out.ats = i.indices.map((k) => k + 1);
  for (const key of ['value', 'ratio', 'min', 'max', 'chord', 'length', 'count'] as const) if (i[key] !== undefined) out[key] = i[key];
  return out;
}

/**
 * The lines of one engine problem: one, but for two loads at one position, which is a problem of BOTH rows (the engine names the second of a
 * pair; three at one place made two pairs and left the first row unmarked).
 */
function issueLines(i: CableIssue, form: CableSagForm): AnalysisIssue[] {
  if (i.code !== 'duplicate-position' || !i.indices || i.indices.length !== 2) return [issueLine(i, form)];
  const [a, b] = i.indices;
  const first = issueField({ ...i, indices: [b, a] }, form);
  const second = issueLine(i, form);
  return first !== undefined && first !== second.field ? [{ ...second, field: first }, second] : [second];
}

const warningLine = (w: CableWarning): AnalysisWarning => ({ ...w });

/* ── The drawing ──────────────────────────────────────────────────────── */

function emptyDrawing(form: CableSagForm): Drawing {
  const L = Number.isFinite(form.span) && form.span > 0 ? form.span : 1;
  const h = Number.isFinite(form.rise) && Math.abs(form.rise) <= 100 * L ? form.rise : 0;
  return frameOf(MODES.includes(form.mode) ? form.mode : 'hanging', [{ x: 0, z: 0 }, { x: L, z: h }], [], { mid: null, low: null, given: null }, [], { A: { x: 0, z: 0 }, B: { x: L, z: h }, H: { x: L / 2, z: h / 2 } });
}

function frameOf(mode: CableSagMode, ends: Point[], curves: Curve[], sag: Drawing['sag'], loads: Drawing['loads'], labels: Drawing['labels']): Drawing {
  const all = [...ends, ...curves.flatMap((c) => c.points)];
  const xs = all.map((p) => p.x);
  const zs = all.map((p) => p.z);
  const x0 = Math.min(...xs);
  const x1 = Math.max(...xs);
  const z0 = Math.min(...zs);
  const z1 = Math.max(...zs);
  const side = Math.max(x1 - x0, z1 - z0);
  const pad = side > 0 ? 0.14 * side : 1;
  return {
    mode,
    supports: { A: ends[0], B: ends[1] },
    chord: { x0: ends[0].x, z0: ends[0].z, x1: ends[1].x, z1: ends[1].z },
    curves,
    sag,
    labels,
    loads,
    box: { x0, z0, x1, z1, width: x1 - x0, height: z1 - z0 },
    frame: { x0: x0 - pad, z0: z0 - pad, x1: x1 + pad, z1: z1 + pad, width: x1 - x0 + 2 * pad, height: z1 - z0 + 2 * pad },
    pad,
  };
}

function dimensionsOf(shape: CableShape, given: 'mid' | 'low' | null): Drawing['sag'] {
  const { L, h } = shape.setup;
  const lf = 1e-9 * L;
  const mid: Dimension | null = shape.sagMid > lf ? { x: L / 2, zTop: h / 2, zBottom: h / 2 - shape.sagMid, value: shape.sagMid } : null;
  const lowLevel = Math.min(0, h);
  const low: Dimension | null = shape.vertex.inside && shape.sagLow > lf ? { x: shape.vertex.x, zTop: lowLevel, zBottom: shape.vertex.z, value: shape.sagLow, from: h >= 0 ? 0 : L } : null;
  return { mid, low, given };
}

function hangingDrawing(form: CableSagForm, sol: HangingSolution): Drawing {
  const { L, h } = sol.exact.setup;
  const curves: Curve[] = [{ id: 'exact', points: curveOf(sol.exact) }];
  if (sol.family !== 'parabola' && sol.parabolic) curves.push({ id: 'parabola', points: curveOf(sol.parabolic) });
  const given = form.known === 'sag' ? (form.sagKind === 'low' ? 'low' : 'mid') : null;
  const v = sol.exact.vertex;
  const lowest = v.inside ? { x: v.x, z: v.z } : { x: h >= 0 ? 0 : L, z: Math.min(0, h) };
  return frameOf('hanging', [{ x: 0, z: 0 }, { x: L, z: h }], curves, dimensionsOf(sol.exact, given), [], { A: { x: 0, z: 0 }, B: { x: L, z: h }, H: lowest });
}

function stateDrawing(form: CableSagForm, sol: StateSolution): Drawing {
  const { L, h } = sol.exact.state2.setup;
  const curves: Curve[] = [
    { id: 'state1', points: curveOf(sol.exact.state1) },
    { id: 'state2', points: curveOf(sol.exact.state2) },
  ];
  const v = sol.exact.state2.vertex;
  const lowest = v.inside ? { x: v.x, z: v.z } : { x: h >= 0 ? 0 : L, z: Math.min(0, h) };
  const dims = dimensionsOf(sol.exact.state2, form.known === 'sag' ? (form.sagKind === 'low' ? 'low' : 'mid') : null);
  return frameOf('state', [{ x: 0, z: 0 }, { x: L, z: h }], curves, { ...dims, state1: dimensionsOf(sol.exact.state1, null).mid }, [], { A: { x: 0, z: 0 }, B: { x: L, z: h }, H: lowest });
}

function pointsDrawing(sol: PointsSolution, sagAt: { x: number; value: number } | null): Drawing {
  const L = sol.joints[sol.joints.length - 1].x;
  const h = sol.joints[sol.joints.length - 1].z;
  const points = sol.joints.map((j) => ({ x: j.x, z: j.z }));
  const top = Math.max(0, ...sol.joints.map((j) => Math.abs(j.P)));
  const loads = sol.joints.filter((j) => j.kind === 'load').map((j) => ({ label: j.source + 1, x: j.x, z: j.z, P: j.P, share: top === 0 ? 0 : Math.abs(j.P) / top }));
  let mid: Dimension | null = null;
  if (sagAt && sagAt.x > 0 && sagAt.x < L) {
    // The cable's level at that position: on the polygon.
    const k = points.findIndex((p) => p.x >= sagAt.x);
    const a = points[Math.max(0, k - 1)];
    const b = points[Math.max(1, k)];
    const t = b.x === a.x ? 0 : (sagAt.x - a.x) / (b.x - a.x);
    const zc = a.z + t * (b.z - a.z);
    const chordZ = (h / L) * sagAt.x;
    mid = { x: sagAt.x, zTop: chordZ, zBottom: zc, value: chordZ - zc };
  }
  const lowest = sol.joints[sol.lowest.joint];
  return frameOf('points', [{ x: 0, z: 0 }, { x: L, z: h }], [{ id: 'polygon', points }], { mid, low: null, given: sagAt ? 'mid' : null }, loads, { A: { x: 0, z: 0 }, B: { x: L, z: h }, H: { x: lowest.x, z: lowest.z } });
}

/* ── The analysis ─────────────────────────────────────────────────────── */

function rowsOf(rows: StateRow[], values: number[], h1: number, isState2: (value: number) => boolean): StateTableRow[] {
  return rows.map((r, i) => {
    const value = values[i];
    const base: StateTableRow = { index: r.index, value, ok: r.ok, isState2: isState2(value) };
    if (!r.ok) return { ...base, ...(r.code ? { code: r.code } : {}) };
    return {
      ...base,
      H: r.H,
      ratioH: r.H === undefined ? undefined : r.H / h1,
      sagMid: r.sagMid,
      sagLow: r.sagLow,
      tensionMax: r.tensionMax,
      tensionHigh: r.tensionHigh,
      tensionLow: r.tensionLow,
      length: r.length,
      unstretched: r.unstretched,
    };
  });
}

/**
 * `tables: false` leaves the two tables of a change of state unsolved (empty rows, `tables.skipped`): they are the
 * heavy part of a deep cable (some 10 ms a row, 62 rows), and a page that must stay responsive to a key solves
 * the cable first and the tables when the typing pauses.
 */
export interface AnalyseOptions {
  tables?: boolean;
}

export function analyseCableSag(source: CableSagForm, options: AnalyseOptions = {}): CableSagAnalysis {
  // A mode that is none of the three (a form from nowhere) is the hanging cable's.
  const form: CableSagForm = MODES.includes(source.mode) ? source : { ...source, mode: 'hanging' };
  const units = CABLE_UNITS[form.units] ?? CABLE_UNITS.us;
  const input = toEngine(form);
  const base = { units, mode: form.mode, hanging: null, state: null, points: null } as const;

  if (form.mode === 'hanging') {
    const out = solveHanging(input.hanging);
    if (!out.ok) return { ...base, issues: out.issues.map((i) => issueLine(i, form)), warnings: [], drawing: emptyDrawing(form) };
    const exact = lineOf(out.exact, form);
    const results: HangingResults = {
      family: out.family,
      given: input.hanging.known.kind,
      chord: out.chord,
      chordAngle: settle((Math.atan2(form.rise, form.span) * 180) / Math.PI, 1e-9),
      section: sectionOf(form, input),
      exact,
      parabolic: out.family === 'parabola' || !out.parabolic ? null : lineOf(out.parabolic, form),
      parabolaExact: out.family === 'parabola',
      difference: out.difference ? differenceLine(out.difference) : null,
      alternative: out.alternative,
    };
    return { ...base, issues: [], warnings: out.warnings.map(warningLine), hanging: results, drawing: hangingDrawing(form, out) };
  }

  if (form.mode === 'state') {
    const skipTables = options.tables === false;
    const out = solveState(skipTables ? { ...input.state, sweep: {} } : input.state);
    if (!out.ok) return { ...base, issues: out.issues.map((i) => issueLine(i, form)), warnings: [], drawing: emptyDrawing(form) };
    const s1 = out.exact.state1;
    const s2 = out.exact.state2;
    const k = TO_ENGINE[form.units];
    const f = FROM_ENGINE[form.units];
    const st = form.state;
    const thermalStrain = clean(form.alpha * k.alpha * (st.T2 - st.T1));
    const results: StateResults = {
      family: out.family,
      given: input.state.known.kind,
      chord: out.chord,
      section: sectionOf(form, input),
      state1: lineOf(s1, form),
      state2: lineOf(s2, form),
      parabolic: out.parabolic ? { state1: lineOf(out.parabolic.state1, form), state2: lineOf(out.parabolic.state2, form) } : null,
      change: {
        deltaT: clean(st.T2 - st.T1),
        thermalStrain,
        ratioH: out.ratioH,
        deltaH: settle(s2.H - s1.H, 1e-12 * s1.H),
        deltaSagMid: settle(s2.sagMid - s1.sagMid, 1e-12 * out.chord),
        deltaTensionMax: settle(s2.tension.max - s1.tension.max, 1e-12 * s1.tension.max),
        deltaLength: settle(s2.length - s1.length, 1e-12 * out.chord),
        loadPerLength: { state1: (s1.setup.q + s1.setup.w) * f.line, state2: (s2.setup.q + s2.setup.w) * f.line },
      },
      tables: {
        thermal: rowsOf(out.tables.thermal, input.temps, s1.H, (t) => Math.abs(t - st.T2) <= 1e-9 * Math.max(1, Math.abs(st.T2)) + 0.01 * st.step),
        loads: rowsOf(out.tables.loads, input.factors, s1.H, (v) => Math.abs(v - 1) <= 1e-9),
        notes: input.tableIssues.map((i) => issueLine(i, form)),
        skipped: skipTables,
      },
    };
    return { ...base, issues: [], warnings: out.warnings.map(warningLine), state: results, drawing: stateDrawing(form, out) };
  }

  const out = solvePoints(input.points);
  if (!out.ok) {
    // Issues name loads by index; the form's rows are in the same order.
    return { ...base, issues: out.issues.flatMap((i) => issueLines(i, form)), warnings: [], drawing: emptyDrawing(form) };
  }
  const known = input.points.known;
  const sagAt = known.kind === 'sag' ? { x: known.x, value: known.value } : null;
  const results = pointsResultsOf(out, known.kind, sagAt, input);
  return { ...base, issues: [], warnings: out.warnings.map(warningLine), points: results, drawing: pointsDrawing(out, sagAt) };
}

function pointsResultsOf(sol: PointsSolution, given: PointsKnownField, sagAt: { x: number; value: number } | null, input: EngineInput): PointsResults {
  const L = input.points.L;
  const force = Math.max(sol.H, sol.tensionMax.value);
  const ff = 1e-9 * force;
  const lf = 1e-9 * L;
  const top = sol.tensionMax.value;
  const joints: JointLine[] = sol.joints.map((j) => ({ kind: j.kind, label: j.source + 1, x: j.x, z: settle(j.z, lf), sag: settle(j.sag, lf), P: j.P }));
  const segments: SegmentLine[] = sol.segments.map((s, i) => ({
    label: i + 1,
    from: s.from,
    to: s.to,
    dx: s.dx,
    dz: settle(s.dz, lf),
    length: s.length,
    slope: settle(s.slope, 1e-12),
    angle: settle(s.angle, 1e-9),
    tension: s.tension,
    vertical: settle(s.vertical, ff),
    share: top === 0 ? 0 : s.tension / top,
  }));
  // Equilibrium of the whole: the loads and the reactions (horizontal: −H at A and +H at B), moments about A.
  const loadsSum = sol.joints.reduce((s, j) => s + j.P, 0);
  const sumFz = settle(sol.reaction.A + sol.reaction.B - loadsSum, 1e-9 * Math.max(Math.abs(loadsSum), force));
  const h = input.points.h;
  // About A: the vertical reaction at B at x = L, its horizontal one H at height h, and the loads at their x.
  const mLoads = sol.joints.reduce((s, j) => s - j.P * j.x, 0);
  const sumM = settle(sol.reaction.B * L - sol.H * h + mLoads, 1e-9 * Math.max(Math.abs(loadsSum), force) * Math.max(L, Math.abs(h)));
  // Every load joint: the cable's vertical pull on it, H·(slope right − slope left), against the load.
  let joint = 0;
  for (let i = 1; i + 1 < sol.joints.length; i++) joint = Math.max(joint, Math.abs(sol.H * (sol.segments[i].slope - sol.segments[i - 1].slope) - sol.joints[i].P));
  joint = settle(joint, 1e-9 * Math.max(Math.abs(loadsSum), force));
  return {
    given,
    chord: sol.chord,
    H: sol.H,
    joints,
    segments,
    length: sol.length,
    reaction: { A: settle(sol.reaction.A, ff), B: settle(sol.reaction.B, ff) },
    tensionMax: { value: sol.tensionMax.value, segment: sol.tensionMax.segment + 1 },
    lowest: { joint: sol.lowest.joint, z: settle(sol.lowest.z, lf) },
    totalLoad: loadsSum,
    sagAt,
    equilibrium: { sumFz, sumM, joint, balanced: sumFz === 0 && sumM === 0 && joint === 0 },
  };
}

/**
 * `analyseCableSag`, which nothing it is given can make throw. The form goes through the
 * engine (which does not throw) and through this file's arithmetic; if anything in it did,
 * the page would be a blank box — so it is caught here and said as 'stopped', with the
 * drawing the form still allows.
 */
export function analyseSafely(form: CableSagForm, options?: AnalyseOptions): CableSagAnalysis {
  try {
    return analyseCableSag(form, options);
  } catch {
    let drawing: Drawing;
    try {
      drawing = emptyDrawing(form);
    } catch {
      const zero = { x0: 0, z0: 0, x1: 0, z1: 0, width: 0, height: 0 };
      drawing = {
        mode: 'hanging',
        supports: { A: { x: 0, z: 0 }, B: { x: 1, z: 0 } },
        chord: { x0: 0, z0: 0, x1: 1, z1: 0 },
        curves: [],
        sag: { mid: null, low: null, given: null },
        labels: { A: { x: 0, z: 0 }, B: { x: 1, z: 0 }, H: { x: 0.5, z: 0 } },
        loads: [],
        box: zero,
        frame: { x0: -1, z0: -1, x1: 2, z1: 1, width: 3, height: 2 },
        pad: 1,
      };
    }
    return { units: CABLE_UNITS[form?.units] ?? CABLE_UNITS.us, mode: MODES.includes(form?.mode) ? form.mode : 'hanging', issues: [{ code: 'stopped' }], warnings: [], hanging: null, state: null, points: null, drawing };
  }
}
