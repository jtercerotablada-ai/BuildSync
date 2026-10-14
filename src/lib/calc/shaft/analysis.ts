import { agree } from '../format';
import type { UnitSystem } from '../beam/model';
import type { BeamExtreme, Side } from '../beam/solver';
import { solveShaft } from './engine';
import {
  TO_ENGINE,
  allIssues,
  drawingOf,
  formIssues,
  issueOnRow,
  sectionOf,
  shaftLength,
  shownMoment,
  shownStress,
  toEngine,
  type EngineInput,
  type RoundSection,
  type ShaftForm,
  type ShaftFormIssue,
  type ShaftFormIssueCode,
  type ShaftRow,
  type ShaftView,
} from './model';
import type { PlaneState, ShaftDrawing, ShaftSolution, ShaftState } from './types';

/**
 * ─────────────────────────────────────────────────────────────────────────────
 * SHAFT ON BEARINGS — from the form to everything the page prints
 * ─────────────────────────────────────────────────────────────────────────────
 * This calculator's `analyse` (continuous/analysis.ts is the third one's, and
 * this file is written as that one is): the form as it stands (model.ts) goes
 * in; out come the faults by row, the shaft as each of its three views draws
 * it, and — when the shaft can be solved — every number of the tables and
 * every point of the diagrams, ALREADY SETTLED and IN THE UNITS SHOWN: a value
 * that is rounding is zero here, once, so that the table, the drawing and the
 * words for a screen reader cannot say different things. The component lays
 * it out and decides nothing about a number.
 *
 * THREE VIEWS OF ONE SHAFT. Each plane is a beam of its own (types.ts): the
 * vertical one, seen from the side, and the horizontal one, seen from above.
 * What the shaft feels at a section is the two together — the root of the
 * sum of their squares — and that is what a bearing is chosen by, what a
 * section is stressed by and what a gear's mesh sees. So every result is
 * three numbers (`ByPlanes`): the two planes', signed, and their size. The
 * tables have all three; each view's diagrams are its own.
 *
 * WHAT COUNTS AS ZERO (`floors`). Measured against the size of the problem,
 * never of each diagram — beam/BeamCalculator.tsx, `noise`, says why. The
 * size is the engine's own (types.ts): `loadScale` as a force — every
 * force's size, every couple over the distance between the bearings, the
 * whole weight —, and that as a slope and as a deflection, `slopeScale` and
 * `deflectionScale`: the loads × L² and × L³ over the EI of the STIFFEST
 * segment. A billionth of each is the floor; × L for a moment.
 *
 * One floor for a shear and a reaction, as the third calculator has it and
 * for its reason: with the bearings at their closest (a thousandth of the
 * shaft) the reactions are a thousand times the loads, and each is still
 * right to 4e-11 of the LOADS (engine.ts, CLOSE; 2e-10 with every other
 * limit reached as well) — a millionth of such a reaction would print a real
 * shear of a thousandth of the loads as 0.
 *
 * And ONE floor for a slope, and one for a deflection, all along the shaft:
 * the stiffest segment's, not that of the segment a point is in. A slope is
 * one value on both sides of a shoulder; with a floor to each side it would
 * be a result seen from the stiff side and nothing from the soft one. And
 * the stiffest segment's is the floor the engine was measured against
 * (engine.ts, STIFF): with stiffnesses a million times apart — the most it
 * takes — and every other limit reached at once, the worst rounding of a
 * slope or a deflection is five times under it (twelve, in the first of the
 * two measurements there; five is the margin to count on). By the softest
 * segment's EI the real slopes of the stiff part of such a shaft would read
 * as nothing.
 *
 * A SIZE IS SETTLED BY ITS PLANES. Each plane's value is settled against the
 * floor, and the two together are the root of the sum of the squares of the
 * SETTLED two: a row of a table adds up as it is printed, and a size cannot
 * be a result where both its planes are rounding. A largest value is the
 * engine's — found, not picked from the stations — read at its place in that
 * same way.
 *
 * WHERE A LARGEST VALUE IS: the first place it is reached. Where a response
 * does not change along a stretch — the shear between two forces, the slope
 * of an overhang past its last load — the engine's "largest" is whichever
 * station a rounding favours (it reads a point from the nearer end of the
 * shaft, so one value comes back a last figure apart from station to
 * station). Two values that are one to nine figures are one value (`SAME`),
 * and the place given for it is where the stretch starts (`largestSize`).
 * Nine figures of the value ITSELF, not its floor: at the flat top of a
 * deflected shape the stations beside the highest point are under it by
 * some hundred-thousandth of it, and it stays where the engine found it.
 *
 * WHAT A FLOOR DOES NOT DO. It says which values are rounding; it does not
 * make a value just above it good to the four figures printed. Measured
 * (engine.ts, the header, against a solver in exact arithmetic): what is
 * small is right to THE SIZE OF THE PROBLEM, not to its own figures — at
 * every limit at once a shear or a reaction within 2e-10 of the loads, a
 * moment within 8e-14 of the loads × L, a slope or a deflection within 8e-11
 * of its size of the problem. So, on a shaft at those limits, a reaction
 * that is itself under a millionth of the loads may be out in its fourth
 * figure, and a slope or a deflection that is only just a result — a
 * hundred-millionth of its size of the problem — in its third. What the
 * tables are of — the radial load and the slope at each bearing, the slope
 * and the deflection at each force, any value that is a ten-thousandth of
 * the largest of its kind or more — is right to 5e-8 of ITSELF there, and to
 * 3e-14 of the largest of its diagram on an ordinary shaft. (Those are the
 * first measurement's figures. The second, by another hand, ran two to six
 * times them — 1.4e-10 for a slope at every limit at once, 9e-14 on an
 * ordinary shaft, and 3e-7 of itself for a value printed at a bearing or at
 * a force on a shaft whose one force stands a hair beside a bearing — and
 * found the four figures printed right on every shaft it drew.) This file
 * adds nothing to that: it settles, converts and puts in rows (held against the
 * unit-load method worked out from the FORM, analysis.test.ts: on its random
 * shafts every value handed on is within a hundred-millionth of the largest
 * of its kind, or under its floor).
 *
 * AND WHAT IT HIDES. A floor is measured against what the loads could do to
 * the shaft — loads × L³ ÷ EI, for a deflection — and a shaft does a
 * fraction of that: the less, the nearer its loads stand to its bearings. On
 * the random shafts of the tests the floor is under a ten-thousandth of the
 * shaft's largest deflection, and of its largest slope and moment: what it
 * hides is past the fourth figure of the largest value printed beside it
 * (on a thousand more it was at most 8e-6, 4e-6 and 8e-7). Where it shows
 * is in a value that is small for a reason: the deflection UNDER a force
 * that stands within some twenty-thousandth of the shaft's length of a
 * bearing (a thousandth of an inch, on 20 in) is under a billionth of
 * loads × L³ ÷ EI and reads 0, while the same shaft's largest deflection is
 * printed. And a force standing ON a bearing is in the size of the problem
 * though it bends nothing: beside one a trillion times the loads that do
 * bend the shaft, what those do is rounding, and reads 0 as well.
 *
 * THE STRESS IS NOMINAL, AND THE SEGMENT'S OWN: the resultant moment over
 * the section modulus of the segment the section is in — the engine's own
 * division, made here of the moment as it is printed, so that the two
 * cannot disagree and a stress is nothing exactly where its moment is. At a
 * shoulder with no applied moment on it the moment is one value and the
 * section two, so the stress is two: a segment's largest is on its own side,
 * and the largest of the shaft is the largest of those — there the small
 * side of the shoulder governs. (With an applied moment ON the shoulder the
 * moment is two values as well: each segment still has its own side's.)
 *
 * UNITS as model.ts shows them (`SHAFT_UNITS`): positions, diameters and
 * deflections in in or mm; forces in lbf or N; moments in lbf·in or N·m;
 * stresses in ksi or MPa; slopes in radians. The engine is given inches and
 * pounds-force, or millimetres and newtons: a moment and a stress come back
 * through model.ts's own two functions (`shownMoment`, `shownStress`), and
 * no factor is written here.
 *
 * SIGNS as types.ts has them, plane by plane: a reaction positive against a
 * positive force (upward in the vertical plane, away from the viewer in the
 * horizontal one), shear positive when the part to the left of the cut is
 * pushed that way, moment positive sagging, deflection positive against a
 * positive force (so a shaft pushed down deflects by a negative number),
 * slope positive counter-clockwise. The two planes TOGETHER are a size: never
 * negative.
 */

/**
 * What is wrong, by row: the form's own words and the engine's (model.ts,
 * `ShaftFormIssueCode`), and two of this file's.
 *
 * 'size': a number that IS one, of a size the engine does not take (a
 * length, a stiffness, a load, a weight or a section modulus under 1e-60 or
 * over 1e60 — or lengths that add up past that, or results past the largest
 * number there is: then with no row). The engine says 'length', 'stiffness'
 * or 'number' of those; a page that answered a length of 1e61 with "must be
 * a positive number" would be saying something false.
 *
 * So 'stiffness', as this file hands it on, has ONE meaning: the stiffest
 * segment is too far above the softest. It comes as two issues, the stiffest
 * segment's row first, then the softest's.
 *
 * 'stopped': the arithmetic threw an exception (`analyseSafely`) — no row,
 * and nothing known of it but that.
 */
export type ShaftAnalysisIssueCode = ShaftFormIssueCode | 'size' | 'stopped';
export interface ShaftAnalysisIssue {
  code: ShaftAnalysisIssueCode;
  /** The row at fault, when it is one row. */
  row?: ShaftRow;
}

/**
 * A quantity in each plane, signed as that plane's are (the header), and the
 * two together — the root of the sum of their squares: a size, never
 * negative. The keys are the three views' names (model.ts, `ShaftView`), so
 * a view reads its own value by its name.
 */
export interface ByPlanes {
  vertical: number;
  horizontal: number;
  both: number;
}

/** A result and where it is. */
export interface ShaftValue {
  value: number;
  /** Where along the shaft, from its left end; null for a value at no place: one that is rounding — zero. */
  x: number | null;
}

/** A bearing of the solved shaft. */
export interface BearingResult {
  /** Its number, left to right: 1 is the left one, whichever was typed first. */
  number: 1 | 2;
  /** Which of the form's two bearings it is (`ShaftForm.bearings`, 0 or 1): the form keeps them as typed, in either order. */
  index: 0 | 1;
  /** Where it stands — where the engine placed it: on a step, when it was typed within a hair of one. */
  x: number;
  /**
   * Its reaction (lbf, N): upward in the vertical plane, away from the viewer
   * in the horizontal one — and `both`, the RADIAL LOAD on the bearing: the
   * size of the two together, what a bearing is chosen by.
   */
  reaction: ByPlanes;
  /** The slope of the shaft at the bearing (rad), by planes — and `both`, the one angle the bearing must take as misalignment. */
  slope: ByPlanes;
}

/** Do a plane's reactions carry its loads? */
export interface ShaftBalance {
  /** The two reactions of the plane added up, and its loads (the shaft's own weight among the vertical ones): each positive as its own is. */
  reactions: number;
  load: number;
  /** They are one number (format.ts, `agree`): the page says so only after asking. */
  ok: boolean;
}

/** One segment of the solved shaft. */
export interface SegmentResult {
  /** Its place among the segments, from 0, and its row of the form. */
  index: number;
  id: number;
  /** Where it starts and ends along the shaft. */
  from: number;
  to: number;
  /** Its outer diameter and its bore (0: solid), as entered. */
  d: number;
  bore: number;
  /** Its section: area, moment of inertia and section modulus, in the form's unit of length (model.ts, `sectionOf`). */
  section: RoundSection;
  /** Its own weight per length (lbf/in, N/mm) when the shaft's weight is a load; null when it is not. */
  w: number | null;
  /** The largest resultant bending moment in the segment (lbf·in, N·m), and where — at a shoulder, this segment's side of it. */
  moment: ShaftValue;
  /** The nominal bending stress there (ksi, MPa): that moment over THIS segment's section modulus. No stress raiser is in it. */
  stress: ShaftValue;
  /** The largest resultant deflection in the segment (in, mm), and where. */
  deflection: ShaftValue;
}

/** The shaft at one of the form's forces: what a gear's mesh cares for. */
export interface ForceResult {
  /** Its row of the form, and its place among the forces, from 0. */
  id: number;
  index: number;
  /** Where it stands, as the engine was given it: kept on the shaft, and on the end of a segment it stands within a rounding of (model.ts, `seatOf`). */
  x: number;
  /** The deflection of the shaft there (in, mm): by planes, and its size. */
  deflection: ByPlanes;
  /** The slope of the shaft there (rad): by planes, and as one angle. */
  slope: ByPlanes;
}

/** The largest values on the whole shaft: of the two planes together, each a size with its place — and zero at no place when the shaft is not bent. */
export interface ShaftLargest {
  /** Resultant shear (lbf, N). */
  shear: ShaftValue;
  /** Resultant bending moment (lbf·in, N·m). */
  moment: ShaftValue;
  /**
   * Nominal bending stress (ksi, MPa): the largest of the segments' own
   * (`SegmentResult.stress`) — at a shoulder with no applied moment on it
   * the small side governs — and `segment`, the one it is in (from 0; null
   * with the value zero).
   */
  stress: ShaftValue & { segment: number | null };
  /** Resultant deflection (in, mm). */
  deflection: ShaftValue;
  /** Resultant slope (rad). */
  slope: ShaftValue;
}

/** A point of a diagram. */
export type ShaftDot = { x: number; y: number };
/** One diagram: its line — through both sides of every jump — and the values labelled on it. */
export interface ShaftDiagram {
  points: ShaftDot[];
  marks: ShaftDot[];
}

/**
 * The highest and the lowest of a diagram, for its labels and its summary.
 * In a plane they are signed. With both planes together the diagram is one
 * of sizes: `max` is the largest, and `min` is zero at no place — a size has
 * no lowest value worth naming.
 */
export interface ShaftPeaks {
  max: ShaftValue;
  min: ShaftValue;
}

/** What one view plots: shear (lbf, N), bending moment (lbf·in, N·m) and deflection (in, mm) of that plane — or, with both planes together, their sizes. */
export interface ShaftViewResults {
  diagrams: { V: ShaftDiagram; M: ShaftDiagram; D: ShaftDiagram };
  peaks: { V: ShaftPeaks; M: ShaftPeaks; D: ShaftPeaks };
}

/** One side of a point of the shaft. */
export interface ShaftSide {
  /** Shear (lbf, N) and bending moment (lbf·in, N·m) just on this side. */
  shear: ByPlanes;
  moment: ByPlanes;
  /** The segment on this side (from 0), its outer diameter and its bore as entered. */
  segment: number;
  d: number;
  bore: number;
  /** The nominal bending stress on this side (ksi, MPa): the resultant moment over this segment's section modulus. */
  stress: number;
}

/** The shaft at a point. */
export interface ShaftPoint {
  /** The position asked for, kept on the shaft (0 to L). */
  x: number;
  /** Just left of the point and just right of it: at a force the shear is two values, at a couple the moment, at a step the section and its stress. */
  left: ShaftSide;
  right: ShaftSide;
  /** What is two values here — the two sides differ by more than rounding — and is to be written as two. */
  jumps: { shear: boolean; moment: boolean; section: boolean; stress: boolean };
  /** Deflection (in, mm) and slope (rad): one value whichever side. */
  deflection: ByPlanes;
  slope: ByPlanes;
}

/** What is rounding, in the units shown: a value no larger than its floor is zero. */
export interface ShaftFloors {
  /** A force, a shear, a reaction (lbf, N). */
  F: number;
  /** A moment (lbf·in, N·m). */
  M: number;
  /** A slope (rad). */
  theta: number;
  /** A deflection (in, mm). */
  v: number;
}

export interface ShaftResults {
  /** The shaft's length, and every position where something happens on it (ascending, 0 and L included). */
  L: number;
  breaks: number[];
  /** The size of the problem as a force (types.ts, `loadScale`; lbf, N), and what is rounding beside it. */
  loadScale: number;
  floors: ShaftFloors;
  /** The shaft carries a load: with none, every value is zero and none has a place. */
  loaded: boolean;
  /** The shaft's whole weight (lbf, N) when it is a load; null when it is not. */
  ownWeight: number | null;
  /** Each plane's reactions against its loads. */
  balance: { vertical: ShaftBalance; horizontal: ShaftBalance };
  /** The two bearings, left to right. */
  bearings: [BearingResult, BearingResult];
  /** Every segment, left to right: one for each row of the form. */
  segments: SegmentResult[];
  /** Every force of the form, in the form's order. */
  forces: ForceResult[];
  largest: ShaftLargest;
  /** The diagrams of each of the three views. */
  views: Record<ShaftView, ShaftViewResults>;
  /** The values at a position along the shaft (kept on it: between 0 and L). */
  at(x: number): ShaftPoint;
}

export interface ShaftAnalysis {
  units: UnitSystem;
  /** The shaft's length as the form has it: its segments end to end (a length that is not a positive number counts for nothing). */
  L: number;
  /** Each segment's round section, row by row of the form; null where its two diameters are not a section — or make one past the largest number there is. */
  sections: (RoundSection | null)[];
  /**
   * From what the engine is given and returns (inches and pounds-force;
   * millimetres and newtons — model.ts) to what is shown: MULTIPLY the
   * engine's value by these. A force, a length, a deflection and a slope are
   * shown as the engine has them (1). Everything in `results` is in the units
   * shown already.
   */
  toShown: { force: number; length: number; moment: number; stress: number; deflection: number; slope: number };
  issues: ShaftAnalysisIssue[];
  /**
   * The shaft as each view draws it (model.ts, `drawingOf`): always there,
   * solved or not. When it is solved each bearing has its reaction of that
   * view written beside it, settled: upward, away from the viewer, or the
   * radial load.
   */
  drawings: Record<ShaftView, ShaftDrawing>;
  /** Null while the shaft cannot be solved. */
  results: ShaftResults | null;
}

/* The largest and the smallest stiffness, load and section modulus the
   engine takes (engine.ts, BIG and SMALL, which it keeps to itself). Here
   for one thing only: to tell a number the engine refuses for its SIZE from
   one it refuses for what it is beside — `worded`. analysis.test.ts holds
   the two files to the same two numbers. */
const BIG = 1e60;
const SMALL = 1e-60;
const taken = (v: number) => v >= SMALL && v <= BIG;

/* Two values of one response that agree to this fraction of themselves —
   nine figures — are one value: of the places where a largest value is
   reached, the first is given (the header, WHERE A LARGEST VALUE IS). The
   last of the four figures printed is five away from it. */
const SAME = 1e-9;

/** A value that is rounding, not a result, is zero. (Plus zero: never −0.) */
const settle = (value: number, floor: number) => (Math.abs(value) <= floor ? 0 : value + 0);
/** A result and where it is — or zero, nowhere. */
const valueOf = (found: BeamExtreme, floor: number): ShaftValue => (Math.abs(found.value) <= floor ? { value: 0, x: null } : { value: found.value + 0, x: found.x });
const NONE = (): ShaftValue => ({ value: 0, x: null });
/** The same value in another unit: where it is does not change. */
const shown = (v: ShaftValue, to: (value: number) => number): ShaftValue => ({ value: to(v.value), x: v.x });
const same = (v: number) => v;

/** A row as one text: two issues are on the same row when theirs are the same. */
const rowKey = (row: ShaftRow | undefined): string => (!row ? '' : [row.list, 'id' in row ? row.id : '', 'index' in row ? row.index : '', 'field' in row ? (row.field ?? '') : ''].join(':'));

/**
 * How far a number is from 1, in decades — and one that is no positive
 * number is further than any. Of the two numbers a product was made of, the
 * one further from 1 is the one that took it out of range.
 */
const reach = (v: number) => (v > 0 && Number.isFinite(v) ? Math.abs(Math.log10(v)) : Infinity);

/**
 * An issue as the page words it. The engine has one word for a number that
 * is not one and for a number that is, of a size it does not take: 'length'
 * of a segment's length, 'stiffness' of its EI, 'number' of the rest. A page
 * that answered a length of 1e61 in with "must be a positive number" would
 * be saying something false: the second of each is 'size' — and it is said
 * of the field that holds the number.
 *
 *   — A length that is a positive number, and refused: 'size', on its
 *     field. With no segment named it is the lengths together, or the
 *     results past the largest number there is: 'size', on no row.
 *   — A stiffness. The form has found no fault (model.ts, `allIssues`, keeps
 *     the engine's word back while it has), so the modulus and the two
 *     diameters ARE numbers. If this segment's EI is one the engine takes,
 *     the fault is the other one 'stiffness' stands for — it is too far
 *     from another segment's — and the issue is handed on as it is. If not,
 *     it is 'size', of whichever of the two numbers the EI is the product
 *     of is the further from 1 (`reach`): the modulus, or the section's
 *     moment of inertia — and that is said of the segment's diameter.
 *   — A segment's weight or section modulus, which the engine names by the
 *     segment whole: 'size' again. Of a section modulus, the diameter's. Of
 *     a weight — the density times the area of metal — the density's or the
 *     diameter's, by the same rule.
 *   — A force or a couple whose three numbers are numbers: 'size', on its
 *     row. One that holds something that is not a number, and a bearing
 *     placed at no number, stay 'number'.
 */
function worded(issue: ShaftFormIssue, form: ShaftForm, input: EngineInput): ShaftAnalysisIssue {
  const row = issue.row;
  const k = TO_ENGINE[form.units];
  if (issue.code === 'length') {
    if (!row || row.list !== 'segments') return { code: 'size' };
    const segment = form.segments.find((s) => s.id === row.id);
    return segment && segment.L > 0 && Number.isFinite(segment.L) ? { code: 'size', row } : issue;
  }
  if ((issue.code !== 'stiffness' && issue.code !== 'number') || !row) return issue;
  if (row.list === 'segments') {
    const index = form.segments.findIndex((s) => s.id === row.id);
    const sent = input.model.segments[index];
    const section = index >= 0 ? sectionOf(form.segments[index]) : null;
    const diameter: ShaftRow = { list: 'segments', id: row.id, field: 'd' };
    if (issue.code === 'stiffness') {
      if (sent && taken(sent.EI)) return issue;
      return { code: 'size', row: reach(form.E * k.E) > reach(section?.I ?? Number.NaN) ? { list: 'material', field: 'E' } : diameter };
    }
    // The section modulus, when it is that; the weight otherwise.
    const modulus = sent?.Z ?? 0;
    if (!(modulus === 0 || taken(modulus))) return { code: 'size', row: diameter };
    return { code: 'size', row: reach(form.density * k.density) > reach(section?.A ?? Number.NaN) ? { list: 'material', field: 'density' } : diameter };
  }
  if (issue.code === 'number' && (row.list === 'forces' || row.list === 'couples')) {
    const held = form[row.list].filter((r) => r.id === row.id).flatMap((r) => [r.x, r.v, r.h]);
    return held.every(Number.isFinite) ? { code: 'size', row } : issue;
  }
  return issue;
}

/** What is common to a shaft solved and one that is not: the form's own, and its drawings with no reaction on them. */
function unsolved(form: ShaftForm, group: string): Omit<ShaftAnalysis, 'issues'> {
  return {
    units: form.units,
    L: shaftLength(form),
    // (A diameter of 10⁸⁰ is a number, and its fourth power is not: no section to print.)
    sections: form.segments.map((s) => sectionOf(s)).map((p) => (p && Number.isFinite(p.A + p.I + p.Z) ? p : null)),
    toShown: { force: 1, length: 1, moment: shownMoment(form.units, 1), stress: shownStress(form.units, 1), deflection: 1, slope: 1 },
    drawings: { vertical: drawingOf(form, 'vertical', null, group), horizontal: drawingOf(form, 'horizontal', null, group), both: drawingOf(form, 'both', null, group) },
    results: null,
  };
}

/**
 * The form, analysed. `group` is what the page sets thousands apart with
 * (format.ts): it is written into the drawings' labels (model.ts,
 * `drawingOf`) and nowhere else — every other result is a number.
 */
export function analyseShaft(form: ShaftForm, group = ','): ShaftAnalysis {
  const common = unsolved(form, group);
  const input = toEngine(form);
  // The engine is asked whatever the form has found: what the form cannot
  // work out it sends as "not a number" (model.ts, `toEngine`), the engine
  // refuses that shaft, and what ELSE is wrong with it — a load off the
  // shaft, the bearings at one place — is said all at once.
  const own = formIssues(form);
  const outcome = solveShaft(input.model);
  const said = outcome.ok ? [] : outcome.issues.map((i) => issueOnRow(i, input.rows));
  const issues = allIssues(own, said)
    .map((i) => worded(i, form, input))
    // (A diameter whose fourth power is past the largest number has no EI and no section modulus: the engine names its segment twice, and it is one fault.)
    .filter((issue, i, all) => all.findIndex((other) => other.code === issue.code && rowKey(other.row) === rowKey(issue.row)) === i);
  // (A form with a fault of its own is never solved: `toEngine` sees to it. Asked twice all the same.)
  if (!outcome.ok || own.length) return { ...common, issues };

  const sol: ShaftSolution = outcome;
  const units = form.units;
  const L = sol.L;
  /* What is rounding, as the engine has each quantity — the header says why
     these four. A moment's is in lbf·in or N·mm here, and handed on in the
     unit shown. */
  const F = 1e-9 * sol.loadScale;
  const floorM = F * L;
  const floorT = 1e-9 * sol.slopeScale;
  const floorD = 1e-9 * sol.deflectionScale;
  const toMoment = (M: number) => shownMoment(units, M);
  const toStress = (sigma: number) => shownStress(units, sigma);
  const floors: ShaftFloors = { F, M: toMoment(floorM), theta: floorT, v: floorD };

  /** A quantity by planes: each settled, and the two together of the settled two (the header). */
  const planes = (vertical: number, horizontal: number, floor: number, to: (value: number) => number = same): ByPlanes => {
    const [a, b] = [settle(vertical, floor), settle(horizontal, floor)];
    return { vertical: to(a), horizontal: to(b), both: to(Math.hypot(a, b)) };
  };
  /** The size of a response at a section, settled by its planes. */
  const sizeOf = (s: ShaftState, of: (p: PlaneState) => number, floor: number) => Math.hypot(settle(of(s.vertical), floor), settle(of(s.horizontal), floor));
  /**
   * A largest size and where it is — or zero, nowhere. The value is the
   * engine's (it is found, not picked from the stations), read at its place
   * by its planes as every other size is: on the side given or, with none,
   * the larger of the two sides. Where that is nothing — both planes
   * rounding there, and their root just past the floor — the largest of the
   * stations' settled sizes stands for it: the line a diagram draws and the
   * value labelled on it cannot then say different things.
   *
   * THE PLACE IS THE FIRST WHERE IT IS THAT LARGE (`among`: the stations to
   * look through, left to right). Along a stretch with no load on it a shear
   * is one value, and so is the slope of an overhang past its last load;
   * the engine reads a point from whichever end of the shaft is nearer
   * (engine.ts), so the same value comes back a last figure apart from one
   * station to the next, and "the largest" was the one a rounding favoured:
   * a shear of 667.6 lbf "at 9.094 in", a tenth of an inch past the gear it
   * starts at. Two values that are one to nine figures are one value
   * (`SAME`), and the first place it is reached is the one an engineer
   * names. (Not "closer than the floor": measured against the floor, the
   * largest deflection of a shaft that bends little — a force a thousandth
   * of an inch from a bearing — was given a tenth of an inch before the place
   * where the shaft does go furthest.)
   */
  const largestSize = (found: BeamExtreme, of: (p: PlaneState) => number, floor: number, among: ShaftState[], side?: Side): ShaftValue => {
    if (!(found.value > floor)) return NONE();
    let value = side ? sizeOf(sol.at(found.x, side), of, floor) : Math.max(sizeOf(sol.at(found.x, 'left'), of, floor), sizeOf(sol.at(found.x, 'right'), of, floor));
    let x = found.x;
    if (!(value > 0)) {
      value = 0;
      for (const s of among) {
        const size = sizeOf(s, of, floor);
        if (size > value) [value, x] = [size, s.x];
      }
      if (!(value > 0)) return NONE();
    }
    for (const s of among) {
      if (s.x >= x) break;
      if (sizeOf(s, of, floor) >= value * (1 - SAME)) return { value, x: s.x };
    }
    return { value, x };
  };
  /** The highest (1) or the lowest (−1) value of one plane and where it is — the first place, as above — or zero, nowhere. */
  const planePeak = (found: BeamExtreme, of: (s: ShaftState) => number, floor: number, sign: 1 | -1): ShaftValue => {
    const peak = valueOf(found, floor);
    if (peak.x === null) return peak;
    for (const s of sol.stations) {
      if (s.x >= peak.x) break;
      if (sign * of(s) >= sign * peak.value - SAME * Math.abs(peak.value)) return { value: peak.value, x: s.x };
    }
    return peak;
  };
  /** The stations of each segment: a station at a shoulder is the segment's whose side it is on. */
  const within: ShaftState[][] = sol.segments.map(() => []);
  for (const s of sol.stations) within[s.segment]?.push(s);
  const V = (p: PlaneState) => p.V;
  const M = (p: PlaneState) => p.M;
  const T = (p: PlaneState) => p.theta;
  const D = (p: PlaneState) => p.v;

  /* ── Bearing by bearing ─────────────────────────────────────────────── */
  // The engine hands its two back left to right; the form keeps them as
  // typed. Two bearings that are solved stand a thousandth of the shaft
  // apart or more, so which is the left one is plain from what was typed.
  const typed: [0 | 1, 0 | 1] = form.bearings[1] < form.bearings[0] ? [1, 0] : [0, 1];
  const bearingOf = (i: 0 | 1): BearingResult => {
    const b = sol.bearings[i];
    return { number: i === 0 ? 1 : 2, index: typed[i], x: b.x, reaction: planes(b.vertical, b.horizontal, F), slope: planes(b.thetaVertical, b.thetaHorizontal, floorT) };
  };
  const bearings: [BearingResult, BearingResult] = [bearingOf(0), bearingOf(1)];

  /* ── Do the reactions carry the loads? ──────────────────────────────── */
  const balanceOf = (plane: 'vertical' | 'horizontal'): ShaftBalance => {
    const [first, second] = [sol.bearings[0][plane], sol.bearings[1][plane]];
    const sum = first + second;
    const load = sol.totalLoad[plane];
    return { reactions: settle(sum, F), load: settle(load, F), ok: agree(sum, load, Math.max(sol.loadScale, Math.abs(first), Math.abs(second))) };
  };
  const balance = { vertical: balanceOf('vertical'), horizontal: balanceOf('horizontal') };
  const ownWeight = form.ownWeight ? input.model.segments.reduce((sum, s) => sum + (s.w ?? 0) * s.L, 0) : null;

  /* ── Segment by segment ─────────────────────────────────────────────── */
  /**
   * The nominal stress of a moment (as the engine has it) in a segment: over
   * that segment's section modulus, as the engine's own `sigma` is — worked
   * out HERE, of the moment as it is printed, so that a stress and the
   * moment beside it cannot disagree, and a stress is nothing exactly where
   * its moment is. (Every segment of a solved shaft has its section modulus:
   * `toEngine` sends it, and the engine takes none that is not a positive
   * number. Were one missing, its stress would be no number, and print as
   * none.)
   */
  const sigmaIn = (segment: number, moment: number): number => {
    const Z = input.model.segments[segment]?.Z ?? 0;
    return moment === 0 ? 0 : Z > 0 ? moment / Z : Number.NaN;
  };
  /** By segments, as the engine has a stress: the largest of each. */
  const sigmas: number[] = [];
  const segments: SegmentResult[] = sol.segments.map((s, i) => {
    const row = form.segments[i];
    const section = sectionOf(row);
    // (Never, of a shaft that was solved: the engine was given this section's EI.)
    if (!section) throw new Error('a solved shaft with a segment of no section');
    // At a shoulder the moment is read on the segment's own side: one value for both segments unless a couple stands on the shoulder; inside, a couple makes it two, and the larger is the segment's.
    const side: Side | undefined = s.M.x <= s.from ? 'right' : s.M.x >= s.to ? 'left' : undefined;
    const moment = largestSize(s.M, M, floorM, within[i], side);
    sigmas.push(sigmaIn(i, moment.value));
    const stress: ShaftValue = moment.x === null ? NONE() : { value: toStress(sigmas[i]), x: moment.x };
    return {
      index: i,
      id: row.id,
      from: s.from,
      to: s.to,
      d: row.d,
      bore: row.bore,
      section,
      w: form.ownWeight ? (input.model.segments[i].w ?? 0) : null,
      moment: shown(moment, toMoment),
      stress,
      deflection: largestSize(s.v, D, floorD, within[i]),
    };
  });

  /* ── At each force ──────────────────────────────────────────────────── */
  const forces: ForceResult[] = form.forces.map((f, index) => {
    // Where the engine was given it (model.ts, `seatOf`): on the end of a segment, when it stands within a rounding of one.
    const s = sol.at(input.model.forces?.[index]?.x ?? f.x);
    return { id: f.id, index, x: s.x, deflection: planes(s.vertical.v, s.horizontal.v, floorD), slope: planes(s.vertical.theta, s.horizontal.theta, floorT) };
  });

  /* ── The largest values ─────────────────────────────────────────────── */
  const ex = sol.extremes;
  // The largest stress is the largest of the segments' own, and the FIRST of them when two are as large: a shaft
  // with the same shoulder at both ends has one largest stress at two places, a last figure apart by rounding —
  // and two values that are one to nine figures are one value (`SAME`).
  let worst = -1;
  segments.forEach((s, i) => {
    if (s.stress.x !== null && (worst < 0 || sigmas[i] > sigmas[worst] * (1 + SAME))) worst = i;
  });
  const largest: ShaftLargest = {
    shear: largestSize(ex.V, V, F, sol.stations),
    moment: shown(largestSize(ex.M, M, floorM, sol.stations), toMoment),
    stress: worst < 0 ? { ...NONE(), segment: null } : { ...segments[worst].stress, segment: worst },
    deflection: largestSize(ex.v, D, floorD, sol.stations),
    slope: largestSize(ex.theta, T, floorT, sol.stations),
  };

  /* ── What each view draws ───────────────────────────────────────────── */
  // Every station the engine returns — both sides of each jump. A value that
  // is rounding is drawn as the zero it is.
  const labelled = (floor: number, ...peaks: ShaftValue[]): ShaftDot[] =>
    peaks
      .flatMap((p) => (p.x === null || Math.abs(p.value) <= floor ? [] : [{ x: p.x, y: p.value }]))
      .filter((p, i, all) => all.findIndex((q) => Math.abs(q.y - p.y) <= floor && Math.abs(q.x - p.x) < 1e-9 * L) === i);
  const diagram = (y: (s: ShaftState) => number, floor: number, peaks: ShaftPeaks): ShaftDiagram => ({ points: sol.stations.map((s) => ({ x: s.x, y: y(s) })), marks: labelled(floor, peaks.max, peaks.min) });
  /** The highest (1) or the lowest (−1) shear of a plane: a plane's shear is a straight line between two places, so it is at a station — both sides of every place are stations. */
  const shearPeak = (plane: 'vertical' | 'horizontal', sign: 1 | -1): ShaftValue => {
    let best = sol.stations[0];
    for (const s of sol.stations) if (sign * s[plane].V > sign * best[plane].V) best = s;
    return planePeak({ value: best[plane].V, x: best.x }, (s) => s[plane].V, F, sign);
  };
  const planeView = (plane: 'vertical' | 'horizontal'): ShaftViewResults => {
    const of = ex[plane];
    const peaks = {
      V: { max: shearPeak(plane, 1), min: shearPeak(plane, -1) },
      M: { max: shown(planePeak(of.Mmax, (s) => s[plane].M, floorM, 1), toMoment), min: shown(planePeak(of.Mmin, (s) => s[plane].M, floorM, -1), toMoment) },
      D: { max: planePeak(of.vMax, (s) => s[plane].v, floorD, 1), min: planePeak(of.vMin, (s) => s[plane].v, floorD, -1) },
    };
    return {
      diagrams: {
        V: diagram((s) => settle(s[plane].V, F), floors.F, peaks.V),
        M: diagram((s) => toMoment(settle(s[plane].M, floorM)), floors.M, peaks.M),
        D: diagram((s) => settle(s[plane].v, floorD), floors.v, peaks.D),
      },
      peaks,
    };
  };
  const sizeView = (): ShaftViewResults => {
    const peaks = { V: { max: largest.shear, min: NONE() }, M: { max: largest.moment, min: NONE() }, D: { max: largest.deflection, min: NONE() } };
    return {
      diagrams: {
        V: diagram((s) => planes(s.vertical.V, s.horizontal.V, F).both, floors.F, peaks.V),
        M: diagram((s) => planes(s.vertical.M, s.horizontal.M, floorM, toMoment).both, floors.M, peaks.M),
        D: diagram((s) => planes(s.vertical.v, s.horizontal.v, floorD).both, floors.v, peaks.D),
      },
      peaks,
    };
  };
  const views: Record<ShaftView, ShaftViewResults> = { vertical: planeView('vertical'), horizontal: planeView('horizontal'), both: sizeView() };

  /* ── The values at a point ──────────────────────────────────────────── */
  const at = (asked: number): ShaftPoint => {
    const x = Math.min(L, Math.max(0, asked));
    const [l, r] = [sol.at(x, 'left'), sol.at(x, 'right')];
    /** The stress on a side, as the engine has one: of the two moments together, each settled. */
    const sigmaOf = (s: ShaftState) => sigmaIn(s.segment, Math.hypot(settle(s.vertical.M, floorM), settle(s.horizontal.M, floorM)));
    const sideOf = (s: ShaftState): ShaftSide => {
      const row = form.segments[s.segment];
      return { shear: planes(s.vertical.V, s.horizontal.V, F), moment: planes(s.vertical.M, s.horizontal.M, floorM, toMoment), segment: s.segment, d: row.d, bore: row.bore, stress: toStress(sigmaOf(s)) };
    };
    const [left, right] = [sideOf(l), sideOf(r)];
    const apart = (of: (p: PlaneState) => number, floor: number) => Math.abs(of(l.vertical) - of(r.vertical)) > floor || Math.abs(of(l.horizontal) - of(r.horizontal)) > floor;
    // A stress is two values where its moment is, or where the same moment is over another section: what is rounding in it is the moment's, over the smaller of the two section moduli.
    const [Zl, Zr] = [input.model.segments[l.segment]?.Z ?? 0, input.model.segments[r.segment]?.Z ?? 0];
    const [sl, sr] = [sigmaOf(l), sigmaOf(r)];
    return {
      x,
      left,
      right,
      jumps: {
        shear: apart(V, F),
        moment: apart(M, floorM),
        section: l.segment !== r.segment && (left.d !== right.d || left.bore !== right.bore),
        stress: Math.abs(sl - sr) > floorM / Math.min(Zl, Zr),
      },
      deflection: planes(r.vertical.v, r.horizontal.v, floorD),
      slope: planes(r.vertical.theta, r.horizontal.theta, floorT),
    };
  };

  /* ── The drawings, with what each bearing carries ───────────────────── */
  const carried = bearings.map((b) => ({ x: b.x, vertical: b.reaction.vertical, horizontal: b.reaction.horizontal, radial: b.reaction.both }));
  const drawings: Record<ShaftView, ShaftDrawing> = { vertical: drawingOf(form, 'vertical', carried, group), horizontal: drawingOf(form, 'horizontal', carried, group), both: drawingOf(form, 'both', carried, group) };

  return {
    ...common,
    issues,
    drawings,
    results: { L, breaks: sol.breaks, loadScale: sol.loadScale, floors, loaded: sol.loadScale > 0, ownWeight, balance, bearings, segments, forces, largest, views, at },
  };
}

/**
 * `analyseShaft`, for the page — which must outlive a fault in it. An
 * exception anywhere in the arithmetic comes back as a shaft with no results
 * and one issue, 'stopped': the page says so in its results box, as it says
 * every other refusal, the form stays as it was typed, and the next edit is
 * analysed afresh. Thrown while the page draws itself, the same exception
 * takes the whole page away, and a link to that shaft can never be opened:
 * it throws again every time. No shaft is known to reach this (the tests,
 * the engine's own fuzz); it is here for the fault nobody has written yet.
 *
 * The values at a point are asked for once, at mid-length: they are worked
 * out when first read and not before (`at`) — a fault there is to be caught
 * here with the rest, and the page reads them at once in any case.
 */
export function analyseSafely(form: ShaftForm, group = ','): ShaftAnalysis {
  try {
    const analysis = analyseShaft(form, group);
    analysis.results?.at(analysis.results.L / 2);
    return analysis;
  } catch {
    // What the form goes on showing whatever became of the shaft: its sections, and its drawings with no reaction on them.
    try {
      return { ...unsolved(form, group), issues: [{ code: 'stopped' }] };
    } catch {
      /* not even that: a shaft with nothing to draw */
    }
    const blank = (): ShaftDrawing => ({ L: 0, lengthUnit: '', segments: [], bearings: [], forces: [], couples: [], ownWeight: false });
    return {
      units: form?.units === 'si' ? 'si' : 'us',
      L: 0,
      sections: [],
      toShown: { force: 1, length: 1, moment: 1, stress: 1, deflection: 1, slope: 1 },
      issues: [{ code: 'stopped' }],
      drawings: { vertical: blank(), horizontal: blank(), both: blank() },
      results: null,
    };
  }
}
