import { formatNumber } from '../format';
import { NAMED, NUMBER, checkOf, round4, signed, tidy, written, type Direction, type Rotation, type UnitSystem } from '../beam/model';
import type { ShaftBearing, ShaftDrawing, ShaftIssue, ShaftIssueCode, ShaftModel, ShaftSegment } from './types';

/**
 * ─────────────────────────────────────────────────────────────────────────────
 * SHAFT ON BEARINGS — what the visitor edits, and what the engine is given
 * ─────────────────────────────────────────────────────────────────────────────
 * Between the form of the fourth calculator ("Shaft on bearings",
 * /resources/shaft-on-bearings) and its engine (types.ts is the agreement
 * between the two). Pure functions, no React: the shaft as entered, segment
 * by segment (`ShaftForm`); what each edit does to it; the round section of
 * a segment; the model the engine takes, and which row of the form each of
 * its entries is; what only the form can know is wrong; the shaft as one of
 * its three views draws it; and the address that carries the case from one
 * engineer to another.
 *
 * WHAT IS THE FIRST CALCULATOR'S IS USED, NOT WRITTEN AGAIN: the rounding of
 * a converted value (`tidy`), how a number travels in an address (`written`,
 * `signed`, `NUMBER`, `NAMED`) and the check an address begins with
 * (`checkOf`) are beam/model.ts's. The units, the materials and the section
 * are this page's own: a shaft is turned from bar, in inches and pounds or
 * in millimetres and newtons, and none of the beam's are those. So is the
 * rounding of a converted LENGTH, which keeps two figures more than `tidy`
 * (`tidyLength` says why).
 *
 * UNITS. The form holds numbers in the units it SHOWS (`SHAFT_UNITS`):
 *
 *     US   in, lbf, lbf·in, ksi, lb/in³
 *     SI   mm, N,   N·m,    MPa, kg/m³
 *
 * The engine takes any consistent set, and is given the one each system is
 * nearest to: INCHES AND POUNDS-FORCE, or MILLIMETRES AND NEWTONS. So a
 * length, a diameter and a force go in as they are typed, and a deflection
 * and a reaction come out as they are shown. Three quantities do not, and
 * each is brought across in one place (`TO_ENGINE`):
 *
 *     the modulus    ksi → lbf/in² (× 1,000);   MPa is N/mm² already
 *     a couple       lbf·in already;            N·m → N·mm (× 1,000)
 *     the density    lb/in³ is lbf/in³ of weight under standard gravity;
 *                    kg/m³ → N/mm³ (× 9.80665 × 10⁻⁹)
 *
 * and two results come back through the same numbers: a moment (`shownMoment`:
 * N·mm to N·m) and a stress (`shownStress`: lbf/in² to ksi). Nothing else in
 * this file holds a 1,000 or a g, and nothing outside it needs one.
 *
 * POSITIONS. A bearing, a force and a couple are placed by their distance
 * from the LEFT END of the shaft, as the engine places them. The segments
 * follow one another from that end; nothing but their lengths places them.
 * So a segment made longer, shorter or taken away moves no bearing and no
 * load: each keeps the distance that was typed for it, and one that is then
 * off the shaft is said to be (the engine's 'outside'), not moved.
 *
 * SIZES AND DIRECTIONS. A force is two sizes, one in each plane, each with
 * the way it points: down or up; towards the viewer or away (the viewer
 * stands beside the shaft, its left end to the left). A couple is two sizes,
 * each with the way it turns as its plane is seen. The engine's signs
 * (types.ts) are made of them in one place, `toEngine`: down, towards the
 * viewer and counter-clockwise are positive.
 */

/** What this page's case is called in its address: `#h=…` — the first calculator's is `#b=…`, the second's `#s=…`, the third's `#c=…`. */
export const SHAFT_KEY = 'h';

/** The most segments the form takes, and the most forces, and the most couples. */
export const MAX_SEGMENTS = 8;
export const MAX_ROWS = 12;

/* ── The units ────────────────────────────────────────────────────────── */

/** Every unit the page writes. A slope is in radians in both systems; `line` is a weight per length, `I` and `Z` a section's two properties. */
export const SHAFT_UNITS: Record<
  UnitSystem,
  { length: string; diameter: string; force: string; moment: string; stress: string; E: string; deflection: string; slope: string; density: string; line: string; I: string; Z: string }
> = {
  us: { length: 'in', diameter: 'in', force: 'lbf', moment: 'lbf·in', stress: 'ksi', E: 'ksi', deflection: 'in', slope: 'rad', density: 'lb/in³', line: 'lbf/in', I: 'in⁴', Z: 'in³' },
  si: { length: 'mm', diameter: 'mm', force: 'N', moment: 'N·m', stress: 'MPa', E: 'MPa', deflection: 'mm', slope: 'rad', density: 'kg/m³', line: 'N/mm', I: 'mm⁴', Z: 'mm³' },
};

/* Exact definitions: 1 in = 25.4 mm, 1 lbf = 4.4482216152605 N, 1 lb = 0.45359237 kg. */
const IN = 25.4;
const LBF = 4.4482216152605;
const LB = 0.45359237;
/** Standard gravity, m/s²: what makes a weight of a mass. One pound-force is one pound under it, exactly. */
const G = 9.80665;

/** One US unit in SI units, per quantity of the form. */
export const SHAFT_US_TO_SI = {
  length: IN, // in → mm: a length, a diameter, a position
  force: LBF, // lbf → N
  moment: (LBF * IN) / 1000, // lbf·in → N·m
  E: (LBF * 1000) / (IN * IN), // ksi → MPa
  density: LB / (IN / 1000) ** 3, // lb/in³ → kg/m³
} as const;

/**
 * From what the form holds to what the engine is given (inches and
 * pounds-force; millimetres and newtons): multiply by these. A length and a
 * force cross as they are.
 */
export const TO_ENGINE: Record<UnitSystem, { E: number; moment: number; density: number }> = {
  us: { E: 1000, moment: 1, density: 1 },
  si: { E: 1, moment: 1000, density: G * 1e-9 },
};

/** A moment of the engine's (lbf·in, N·mm) in the unit shown (lbf·in, N·m). */
export const shownMoment = (units: UnitSystem, M: number): number => M / TO_ENGINE[units].moment;
/** A stress of the engine's (lbf/in², N/mm²) in the unit shown (ksi, MPa): a stress and a modulus are one quantity. */
export const shownStress = (units: UnitSystem, sigma: number): number => sigma / TO_ENGINE[units].E;

/* ── The form ─────────────────────────────────────────────────────────── */

/** Which way a force points in the horizontal plane: towards the viewer, who stands beside the shaft, or away. */
export type Sideways = 'towards' | 'away';

export type ShaftMaterial = 'steel' | 'stainless' | 'aluminum' | 'custom';

/**
 * The modulus of elasticity (ksi, MPa) and the density (lb/in³, kg/m³)
 * offered as a starting point: each the number its own system writes, so
 * the two columns are the same metal and not conversions of one another to
 * the last figure (29,000 ksi is 199,948 MPa; 0.2836 lb/in³ — the
 * 490 lb/ft³ steel is weighed by — is 7,850.02 kg/m³). Steel and aluminum
 * have the moduli the other calculators offer for them (beam/model.ts,
 * `MATERIALS`): "Steel" is one number across the catalogue. Stainless steel
 * is the austenitic grades. The visitor can always type another.
 */
export const SHAFT_MATERIALS: Record<Exclude<ShaftMaterial, 'custom'>, Record<UnitSystem, { E: number; density: number }>> = {
  steel: { us: { E: 29000, density: 0.2836 }, si: { E: 200000, density: 7850 } },
  stainless: { us: { E: 28000, density: 0.289 }, si: { E: 193000, density: 8000 } },
  aluminum: { us: { E: 10100, density: 0.0975 }, si: { E: 69600, density: 2700 } },
};

/** A stretch of the shaft with one round section, as entered. */
export interface SegmentRow {
  id: number;
  /** Length (in, mm). */
  L: number;
  /** Outer diameter (in, mm). */
  d: number;
  /** Diameter of the bore of a hollow shaft (in, mm): 0 for a solid one. */
  bore: number;
}

/** A force across the shaft, `x` from its left end (in, mm): its size in each plane (lbf, N) and the way each points. */
export interface ForceRow {
  id: number;
  x: number;
  v: number;
  vDir: Direction;
  h: number;
  hDir: Sideways;
}

/** A couple applied at `x`: its size in each plane (lbf·in, N·m) and the way each turns, as that plane is seen. */
export interface CoupleRow {
  id: number;
  x: number;
  v: number;
  vDir: Rotation;
  h: number;
  hDir: Rotation;
}

export interface ShaftForm {
  units: UnitSystem;
  /** Left to right: never none. */
  segments: SegmentRow[];
  /** Where each of the two bearings stands, from the left end (in, mm): as typed, in either order. */
  bearings: [number, number];
  forces: ForceRow[];
  couples: CoupleRow[];
  material: ShaftMaterial;
  /** Modulus of elasticity (ksi, MPa): the material's, or the one typed. */
  E: number;
  /** Density (lb/in³, kg/m³): the material's, or the one typed. Used only when the shaft's own weight is a load. */
  density: number;
  /** The shaft's own weight is a load, in the vertical plane. */
  ownWeight: boolean;
  /** The next id to hand out: ids only ever grow, so a removed row's is never reused. */
  nextId: number;
}

/** The three lists of rows. */
export type ShaftList = 'segments' | 'forces' | 'couples';

/**
 * The shaft the page opens with — its own, as each calculator's is: a
 * countershaft of 23 in, turned in four diameters. A 1.5 in journal, a 2 in
 * body, a second 1.5 in journal and a 1.25 in end that overhangs; a bearing
 * at the middle of each journal, 2 in and 16 in from the left end; a gear at
 * the middle of the span between them, pushing 1,000 lbf down and 360 lbf
 * towards the viewer (a tooth's tangential force and its radial one); a
 * pulley on the overhang, 5 in past the second bearing, pulled 400 lbf down
 * by its belt. Steel; its own weight left out.
 *
 * Its rows are numbered as a link numbers them, so this shaft read back from
 * its own address is this shaft, id for id.
 */
export function defaultShaft(): ShaftForm {
  return {
    units: 'us',
    segments: [
      { id: 1, L: 4, d: 1.5, bore: 0 },
      { id: 2, L: 10, d: 2, bore: 0 },
      { id: 3, L: 4, d: 1.5, bore: 0 },
      { id: 4, L: 5, d: 1.25, bore: 0 },
    ],
    bearings: [2, 16],
    forces: [
      { id: 5, x: 9, v: 1000, vDir: 'down', h: 360, hDir: 'towards' },
      { id: 6, x: 21, v: 400, vDir: 'down', h: 0, hDir: 'towards' },
    ],
    couples: [],
    material: 'steel',
    E: 29000,
    density: 0.2836,
    ownWeight: false,
    nextId: 7,
  };
}

/** A positive number, and not infinity: what a length, a diameter, a modulus and a density must be. */
const positive = (v: number): boolean => v > 0 && Number.isFinite(v);

/**
 * Where each segment ends, left to right, from 0: the last is the length of
 * the shaft. A length that is not a positive number counts for nothing here
 * — its row says what is wrong with it — so that what the form places by
 * these (a new load, the drawing) is placed on the rest of the shaft.
 */
export function segmentEnds(form: Pick<ShaftForm, 'segments'>): number[] {
  const at = [0];
  for (const s of form.segments) at.push(at[at.length - 1] + (positive(s.L) ? s.L : 0));
  return at;
}

/** The length of the shaft: its segments end to end. */
export function shaftLength(form: Pick<ShaftForm, 'segments'>): number {
  const at = segmentEnds(form);
  return at[at.length - 1];
}

/**
 * The material a modulus and a density are: the listed one only with ITS
 * modulus and ITS density, and the visitor's own with any other. A label
 * beside a number it does not go with would be false twice over: once on
 * screen, and again when the units are switched and the listed numbers of
 * the other system quietly took the place of what was typed.
 */
function materialOf(material: ShaftMaterial, units: UnitSystem, E: number, density: number): ShaftMaterial {
  if (material === 'custom') return material;
  const listed = SHAFT_MATERIALS[material][units];
  return listed.E === E && listed.density === density ? material : 'custom';
}

/**
 * A converted LENGTH, to the eight figures a field shows — or to fewer, when
 * a shorter number is the same value to within the rounding of one
 * conversion. It is `tidy` (beam/model.ts) with two more figures, and it is
 * here because a shaft's lengths need them: a force, a couple, a modulus and
 * a density are converted with `tidy` itself, as every calculator's are.
 *
 * A shaft dimensioned in inches is in sixteenths and sixty-fourths, and
 * those are long numbers that are exact: 16 7/16 in is 16.4375, six figures,
 * and 417.5125 mm to the last of them. At six figures it was shown as
 * 417.51 mm and came back as 16.4374 in — a shaft looked at in the other
 * system was no longer the shaft that had been typed. Of the 640 lengths
 * from 1/16 in to 40 in by sixteenths, 189 came back changed that way; at
 * eight figures none does, nor any length up to 30 in by thousandths of an
 * inch, nor any up to a metre by twentieths of a millimetre (model.test.ts
 * counts them). A length of eight figures — 10 in and more, to the
 * sixty-fourth — can still move in its last: a field shows no more. Six
 * parts in a hundred million is past the most one eight-figure rounding can
 * move a number.
 */
function tidyLength(v: number): number {
  if (v === 0 || !Number.isFinite(v)) return v;
  for (let figures = 1; figures < 8; figures++) {
    const short = Number(v.toPrecision(figures));
    if (Math.abs(short - v) <= 6e-8 * Math.abs(v)) return short;
  }
  return Number(v.toPrecision(8));
}

/**
 * The same shaft in the other unit system, as `convertUnits` does it for the
 * first calculator: every quantity as its own, to the figures a field shows,
 * and back again to the very same numbers. A listed material keeps its own
 * round numbers in each system.
 */
export function convertShaft(form: ShaftForm, to: UnitSystem): ShaftForm {
  if (form.units === to) return form;
  const factor = (q: keyof typeof SHAFT_US_TO_SI) => (to === 'si' ? SHAFT_US_TO_SI[q] : 1 / SHAFT_US_TO_SI[q]);
  const c = (v: number, q: 'force' | 'moment' | 'E' | 'density') => tidy(v * factor(q));
  const along = (v: number) => tidyLength(v * factor('length'));
  const listed = form.material === 'custom' ? null : SHAFT_MATERIALS[form.material][to];
  return {
    ...form,
    units: to,
    segments: form.segments.map((s) => ({ ...s, L: along(s.L), d: along(s.d), bore: along(s.bore) })),
    bearings: [along(form.bearings[0]), along(form.bearings[1])],
    forces: form.forces.map((f) => ({ ...f, x: along(f.x), v: c(f.v, 'force'), h: c(f.h, 'force') })),
    couples: form.couples.map((m) => ({ ...m, x: along(m.x), v: c(m.v, 'moment'), h: c(m.h, 'moment') })),
    E: listed ? listed.E : c(form.E, 'E'),
    density: listed ? listed.density : c(form.density, 'density'),
  };
}

/* ── What each edit does to the form ──────────────────────────────────── */

export type ShaftAction =
  | { type: 'load'; form: ShaftForm }
  | { type: 'reset' }
  | { type: 'units'; units: UnitSystem }
  /** A segment is added after the last, a copy of it. A force or a couple is added at the middle of the shaft. */
  | { type: 'add'; list: ShaftList }
  | { type: 'remove'; list: ShaftList; id: number }
  | { type: 'patch'; list: ShaftList; id: number; patch: Record<string, unknown> }
  /** A bearing is moved: the first (0) or the second (1), to `x` from the left end. */
  | { type: 'bearing'; index: number; x: number }
  /** A material is chosen: its modulus and its density come with it. 'custom' keeps what is typed. */
  | { type: 'material'; material: ShaftMaterial }
  /** A modulus or a density is typed. */
  | { type: 'modulus'; E: number }
  | { type: 'density'; density: number }
  | { type: 'own-weight'; on: boolean };

export function reduceShaft(form: ShaftForm, action: ShaftAction): ShaftForm {
  switch (action.type) {
    case 'load':
      return action.form;
    case 'reset':
      return defaultShaft();
    case 'units':
      return convertShaft(form, action.units);
    case 'add': {
      const id = form.nextId;
      const us = form.units === 'us';
      if (action.list === 'segments') {
        if (form.segments.length >= MAX_SEGMENTS) return form;
        // Another like the last: the shaft goes on in the bar it ended in.
        // Nothing else moves: a bearing or a load stays where it was typed.
        const last = form.segments[form.segments.length - 1] ?? (us ? { L: 4, d: 1, bore: 0 } : { L: 100, d: 25, bore: 0 });
        return { ...form, segments: [...form.segments, { id, L: last.L, d: last.d, bore: last.bore }], nextId: id + 1 };
      }
      if (form[action.list].length >= MAX_ROWS) return form;
      const mid = round4(shaftLength(form) / 2);
      // The usual one of its kind, pointing the way the engine counts as
      // positive, and all of it in the vertical plane: the other plane's
      // size is typed when there is one.
      if (action.list === 'forces') return { ...form, forces: [...form.forces, { id, x: mid, v: us ? 100 : 500, vDir: 'down', h: 0, hDir: 'towards' }], nextId: id + 1 };
      return { ...form, couples: [...form.couples, { id, x: mid, v: us ? 100 : 10, vDir: 'ccw', h: 0, hDir: 'ccw' }], nextId: id + 1 };
    }
    case 'remove': {
      if (action.list !== 'segments') return { ...form, [action.list]: form[action.list].filter((r) => r.id !== action.id) };
      // A shaft has a segment. And only the segment goes: the bearings and
      // the loads keep their distances from the left end (the header,
      // POSITIONS), and one that is now off the shaft is said to be.
      if (form.segments.length <= 1 || !form.segments.some((s) => s.id === action.id)) return form;
      return { ...form, segments: form.segments.filter((s) => s.id !== action.id) };
    }
    case 'patch':
      // A row is told apart by its id: no edit of it changes that.
      return { ...form, [action.list]: form[action.list].map((r) => (r.id === action.id ? { ...r, ...action.patch, id: r.id } : r)) };
    case 'bearing': {
      if (action.index !== 0 && action.index !== 1) return form;
      const bearings: [number, number] = [form.bearings[0], form.bearings[1]];
      bearings[action.index] = action.x;
      return { ...form, bearings };
    }
    case 'material': {
      if (action.material === 'custom') return { ...form, material: 'custom' };
      // One of the listed three, found among them: never looked up as a property.
      const key = (Object.keys(SHAFT_MATERIALS) as Exclude<ShaftMaterial, 'custom'>[]).find((k) => k === action.material);
      if (!key) return form;
      return { ...form, material: key, ...SHAFT_MATERIALS[key][form.units] };
    }
    case 'modulus':
      return { ...form, E: action.E, material: materialOf(form.material, form.units, action.E, form.density) };
    case 'density':
      return { ...form, density: action.density, material: materialOf(form.material, form.units, form.E, action.density) };
    case 'own-weight':
      return { ...form, ownWeight: action.on };
  }
}

/* ── The section ──────────────────────────────────────────────────────── */

/** A round section, solid or hollow, in the form's unit of length: in², in⁴, in³ — or mm², mm⁴, mm³. */
export interface RoundSection {
  /** Area of metal, π(d² − b²)/4: what the weight per length is the density times. */
  A: number;
  /** Moment of inertia about a diameter, π(d⁴ − b⁴)/64: the same about every diameter. */
  I: number;
  /** Section modulus, I ÷ (d/2) = π(d⁴ − b⁴)/(32·d): the bending stress is the moment over it. */
  Z: number;
}

/**
 * The section of a segment, or `null` when its two diameters are not a
 * section: an outer diameter that is not a positive number; a bore that is
 * not a number, is negative, or leaves no wall (as large as the outer
 * diameter, or larger). `formIssues` says which.
 *
 * d⁴ − b⁴ is worked as (d − b)(d + b)(d² + b²): a thin tube is the
 * difference of two numbers nearly equal, and taken at the fourth power
 * first it would lose the figures the wall is made of.
 */
export function sectionOf(segment: Pick<SegmentRow, 'd' | 'bore'>): RoundSection | null {
  const { d, bore: b } = segment;
  if (!positive(d) || !Number.isFinite(b) || b < 0 || b >= d) return null;
  const A = (Math.PI * (d - b) * (d + b)) / 4;
  const I = (Math.PI * (d - b) * (d + b) * (d * d + b * b)) / 64;
  return { A, I, Z: I / (d / 2) };
}

/* ── From the form to the engine ──────────────────────────────────────── */

/** A row of the form, as an issue names it: a segment (and which of its fields, when it is one), a bearing, a load, or one of the material's two numbers. */
export type ShaftRow =
  | { list: 'segments'; id: number; field?: 'L' | 'd' | 'bore' }
  | { list: 'bearings'; index: 0 | 1 }
  | { list: 'forces' | 'couples'; id: number }
  | { list: 'material'; field: 'E' | 'density' };

/**
 * What the engine says of a shaft, and what only the form can know: an
 * outer diameter that is not one ('diameter'), a bore that is not one or
 * leaves no wall ('bore'), no modulus ('modulus'), no density for a weight
 * that is asked for ('density').
 */
export type ShaftFormIssueCode = ShaftIssueCode | 'diameter' | 'bore' | 'modulus' | 'density';
export interface ShaftFormIssue {
  code: ShaftFormIssueCode;
  /** The row at fault, when it is one row. */
  row?: ShaftRow;
}

export interface EngineInput {
  model: ShaftModel;
  /**
   * Which row of the form each entry of the model is, list by list and in
   * the model's order: all four lists are the form's, one for one. The
   * shaft's own weight is no entry of its own — it is each segment's `w`.
   */
  rows: { segments: ShaftRow[]; bearings: ShaftRow[]; forces: ShaftRow[]; couples: ShaftRow[] };
}

/** A size and the way it acts as the engine's one signed number — and a plain zero, never −0. */
const signedBy = (size: number, plus: boolean): number => (plus ? size : -size) + 0;

/**
 * The shaft as the engine takes it (types.ts), in inches and pounds-force or
 * in millimetres and newtons (the header, UNITS):
 *
 *   — each segment with its length as typed; its EI, the modulus brought to
 *     the engine's stress (`TO_ENGINE`) times the I of `sectionOf`; and its
 *     Z, for the bending stress;
 *   — when the shaft's own weight is asked for, each segment's weight per
 *     length `w`: the density as a weight per volume (`TO_ENGINE`) times the
 *     area of metal. Not asked for, no segment has a `w` at all;
 *   — the two bearings where they were typed, in the order typed;
 *   — every force and every couple with its directions as signs: down,
 *     towards the viewer and counter-clockwise are positive. A couple is
 *     brought to the engine's moment (`TO_ENGINE`).
 *
 * WHAT THE FORM CANNOT WORK OUT IS SENT AS "NOT A NUMBER". With no modulus
 * there is no EI; with two diameters that are no section there is no EI, no
 * Z and no weight; with the weight asked for and no density there is no
 * weight. Each is NaN in the model, so that an engine asked all the same
 * refuses the shaft: it is never solved as if the weight were not there, or
 * with a stiffness nobody entered. `formIssues` names each of them first, in
 * words of its own, and `allIssues` keeps the engine from saying it again.
 * So is what works out past the largest number there is (the fourth power
 * of a diameter of 10⁸⁰): the form finds no fault with such a number, and
 * the engine names the segment.
 *
 * Whatever else the form holds is sent as it is, for the engine to refuse: a
 * length of zero, a force that is no number, a bearing off the shaft.
 */
export function toEngine(form: ShaftForm): EngineInput {
  const k = TO_ENGINE[form.units];
  const E = positive(form.E) ? form.E * k.E : Number.NaN;
  const unitWeight = positive(form.density) ? form.density * k.density : Number.NaN;
  /** A value worked out here, or "not a number": infinity is no stiffness and no weight either. */
  const worked = (v: number): number => (Number.isFinite(v) ? v : Number.NaN);
  const segments = form.segments.map((s) => {
    const p = sectionOf(s);
    const sent: ShaftSegment = { L: s.L, EI: p ? worked(E * p.I) : Number.NaN, Z: p ? worked(p.Z) : Number.NaN };
    if (form.ownWeight) sent.w = p ? worked(unitWeight * p.A) : Number.NaN;
    return sent;
  });
  return {
    model: {
      segments,
      bearings: [form.bearings[0], form.bearings[1]],
      forces: form.forces.map((f) => ({ x: f.x, v: signedBy(f.v, f.vDir === 'down'), h: signedBy(f.h, f.hDir === 'towards') })),
      couples: form.couples.map((c) => ({ x: c.x, v: signedBy(c.v * k.moment, c.vDir === 'ccw'), h: signedBy(c.h * k.moment, c.hDir === 'ccw') })),
    },
    rows: {
      segments: form.segments.map((s) => ({ list: 'segments', id: s.id })),
      bearings: [
        { list: 'bearings', index: 0 },
        { list: 'bearings', index: 1 },
      ],
      forces: form.forces.map((f) => ({ list: 'forces', id: f.id })),
      couples: form.couples.map((c) => ({ list: 'couples', id: c.id })),
    },
  };
}

/**
 * An issue of the engine as the form shows it: on its row. A segment is
 * named for its length ('length', 'short-segment') or for its diameter
 * ('stiffness': of what makes an EI, the diameter is the segment's own), and
 * the code says which; for a weight or a section modulus ('number') it is
 * named whole. An entry that is not there is nobody's row, and neither is an
 * issue of the whole shaft.
 */
export function issueOnRow(issue: ShaftIssue, rows: EngineInput['rows']): ShaftFormIssue {
  const row = issue.where ? rows[issue.where.list][issue.where.index] : undefined;
  if (!row) return { code: issue.code };
  if (row.list !== 'segments') return { code: issue.code, row };
  const field = issue.code === 'length' || issue.code === 'short-segment' ? 'L' : issue.code === 'stiffness' ? 'd' : undefined;
  return { code: issue.code, row: field ? { ...row, field } : row };
}

/**
 * What only the form can know is wrong, before the engine is asked — by
 * row, the segments first and each of them by its fields in the order they
 * are typed, then the material:
 *
 *   'length'    a segment's length is not a positive number. The engine's own
 *               word for it, on the same row and field: the two say one thing.
 *   'diameter'  a segment's outer diameter is not a positive number.
 *   'bore'      a bore that is not a number or is negative; or, beside an
 *               outer diameter that is one, a bore as large or larger: no
 *               wall is left.
 *   'modulus'   E is not a positive number: there is no stiffness.
 *   'density'   the shaft's own weight is asked for, and the density is not
 *               a positive number: there is no weight to apply. Not asked
 *               for, the density is not on screen and whatever it holds is
 *               no problem.
 *
 * THE SHAFT IS NOT SOLVED while any of these stands. A length that is not
 * one is sent to the engine as it is, and the engine refuses it by its own
 * rule; what each of the others leaves unknown `toEngine` sends as "not a
 * number", which no engine takes. A number that is one and is too large or
 * too small for the engine, a position off the shaft, two bearings at one
 * place are the engine's to name.
 */
export function formIssues(form: ShaftForm): ShaftFormIssue[] {
  const issues: ShaftFormIssue[] = [];
  for (const s of form.segments) {
    if (!positive(s.L)) issues.push({ code: 'length', row: { list: 'segments', id: s.id, field: 'L' } });
    if (!positive(s.d)) issues.push({ code: 'diameter', row: { list: 'segments', id: s.id, field: 'd' } });
    if (!Number.isFinite(s.bore) || s.bore < 0 || (positive(s.d) && s.bore >= s.d)) issues.push({ code: 'bore', row: { list: 'segments', id: s.id, field: 'bore' } });
  }
  if (!positive(form.E)) issues.push({ code: 'modulus', row: { list: 'material', field: 'E' } });
  if (form.ownWeight && !positive(form.density)) issues.push({ code: 'density', row: { list: 'material', field: 'density' } });
  return issues;
}

/** A row as one text: two issues are on the same row when theirs are the same. */
const rowKey = (row: ShaftRow | undefined): string => (!row ? '' : [row.list, 'id' in row ? row.id : '', 'index' in row ? row.index : '', 'field' in row ? (row.field ?? '') : ''].join(':'));

/**
 * Every fault of a shaft, each said once: the form's own (`formIssues`),
 * then the engine's (each through `issueOnRow`) — less what the engine says
 * only BECAUSE of a fault the form has named already:
 *
 *   — the same code on the same row: a length that is not a positive number
 *     is said by both;
 *   — 'stiffness' or 'number' of a segment, or of no row at all, while the
 *     form has a fault of its own: every one of the form's leaves an EI, a
 *     Z or a weight "not a number" in the model (`toEngine`), and that is
 *     the engine's word for one;
 *   — with a length at fault, anything about where things are along the
 *     shaft ('length', 'outside', 'bearings', 'short-segment'): nothing can
 *     be placed on a shaft whose length is not known.
 *
 * What is left is news: a force that is no number, and — on a shaft whose
 * lengths are known — a load or a bearing off it, two bearings at one place.
 * An issue held back here is not lost: once the form's own fault is mended
 * the engine says it again, and nothing is then in its way.
 */
export function allIssues(own: ShaftFormIssue[], said: ShaftFormIssue[]): ShaftFormIssue[] {
  const all = [...own];
  const same = (p: ShaftFormIssue, q: ShaftFormIssue) => p.code === q.code && rowKey(p.row) === rowKey(q.row);
  const unplaced = own.some((i) => i.code === 'length');
  for (const issue of said) {
    if (all.some((i) => same(i, issue))) continue;
    if (own.length > 0 && (issue.code === 'stiffness' || issue.code === 'number') && (!issue.row || issue.row.list === 'segments')) continue;
    if (unplaced && (issue.code === 'length' || issue.code === 'outside' || issue.code === 'bearings' || issue.code === 'short-segment')) continue;
    all.push(issue);
  }
  return all;
}

/* ── The shaft as it is drawn ─────────────────────────────────────────── */

/** One of the three views: the vertical plane, seen from the side; the horizontal plane, seen from above; or both planes' loads together, as their resultants. */
export type ShaftView = 'vertical' | 'horizontal' | 'both';

/* Positions are compared in units of the shaft's length, and two closer than
   this are one: the engines' own measure (beam/solver.ts, EPS). */
const NEAR = 1e-9;

/**
 * The shaft for the drawing (types.ts, `ShaftDrawing`) in one view, in the
 * units shown.
 *
 *   — The profile: the segments end to end, each with its two diameters. A
 *     segment whose length is not a positive number has no place and is left
 *     out (`segmentEnds`); a diameter that is not one is drawn as none (0),
 *     and a bore that is no bore as a solid segment — the row says what is
 *     wrong, and the drawing is never given a value that is not a number.
 *   — The bearings that are on the shaft, each with its reaction in this
 *     view when the shaft is solved (`reactions`: the engine's two bearings,
 *     or the same values settled; each is found by where it stands): upward
 *     in the vertical view, away from the viewer in the horizontal one, the
 *     radial load — a size — in both.
 *   — The forces and the couples OF THIS VIEW: those on the shaft whose size
 *     in this plane is a number and is not zero. A force all in the other
 *     plane has nothing to draw in this one. With both planes together each
 *     is its resultant, which is a size: never negative.
 *   — Its own weight, in the vertical view, when it is a load that can be
 *     worked out.
 *
 * ON THE SHAFT is to within a billionth of its length, as an engine takes a
 * position (`NEAR`): two lengths typed as 0.1 and 0.7 add up to a hair
 * under 0.8, and a bearing typed at 0.8 is at the end of that shaft — it is
 * solved there, and it is drawn there. What is further off has no place in
 * the drawing and is left out; its row says so.
 *
 * WHAT IS WRITTEN BY A LOAD (`label`) is its size and its unit, as the form
 * shows it: what was typed, as typed (to six figures, as the first
 * calculator's drawing writes a load). A resultant is typed by nobody: it
 * is written to the four figures of the tables — unless the load is all in
 * one plane, where it IS the number typed and is written as that. `group` is
 * what the page sets thousands apart with (format.ts).
 *
 * An id is the row's, as text; forces and couples are numbered together, so
 * no two entries of a drawing share one.
 */
export function drawingOf(
  form: ShaftForm,
  view: ShaftView,
  reactions?: readonly Pick<ShaftBearing, 'x' | 'vertical' | 'horizontal' | 'radial'>[] | null,
  group = ',',
): ShaftDrawing {
  const u = SHAFT_UNITS[form.units];
  const ends = segmentEnds(form);
  const L = ends[ends.length - 1];
  const on = (x: number) => Number.isFinite(x) && x >= -NEAR * L && x <= L * (1 + NEAR);
  /** A place that is on the shaft, as a place of the drawing: an end, where it is a hair past one. */
  const placed = (x: number) => Math.min(L, Math.max(0, x));
  const typed = (v: number) => formatNumber(Math.abs(v), 6, group);
  /** A load's two sizes as this view has them: its signed size, and what is written by it. */
  const seen = (v: number, h: number, unit: string): { value: number; label: string } => {
    if (view === 'vertical') return { value: v, label: `${typed(v)} ${unit}` };
    if (view === 'horizontal') return { value: h, label: `${typed(h)} ${unit}` };
    const size = Math.hypot(v, h);
    return { value: size, label: `${h === 0 ? typed(v) : v === 0 ? typed(h) : formatNumber(size, 4, group)} ${unit}` };
  };
  const drawn = <T extends { value: number; x: number }>(loads: T[]): T[] => loads.filter((p) => on(p.x) && Number.isFinite(p.value) && p.value !== 0).map((p) => ({ ...p, x: placed(p.x) }));
  // Whose reaction is whose. The form keeps its two bearings as they were
  // typed; the engine hands its two back from left to right, each where it
  // placed it — on a step, when it stood within a hair of one. So they are
  // paired by where they stand, the way that leaves the two pairs closest:
  // never by their order alone, and never by one number being another.
  const given = reactions?.length === 2 ? reactions : null;
  const apart = (first: number, second: number) => (given ? Math.abs(form.bearings[0] - given[first].x) + Math.abs(form.bearings[1] - given[second].x) : 0);
  const crossed = apart(1, 0) < apart(0, 1);
  const reactionOf = (index: 0 | 1): number | null => {
    const found = given?.[crossed ? 1 - index : index];
    const value = !found ? Number.NaN : view === 'vertical' ? found.vertical : view === 'horizontal' ? found.horizontal : found.radial;
    return Number.isFinite(value) ? value : null;
  };
  return {
    L,
    lengthUnit: u.length,
    segments: form.segments.flatMap((s, i) => {
      if (ends[i + 1] === ends[i]) return [];
      const d = positive(s.d) ? s.d : 0;
      return [{ from: ends[i], to: ends[i + 1], d, bore: positive(s.bore) && s.bore < d ? s.bore : 0 }];
    }),
    bearings: ([0, 1] as const).flatMap((index) => (on(form.bearings[index]) ? [{ x: placed(form.bearings[index]), reaction: reactionOf(index) }] : [])),
    forces: drawn(form.forces.map((f) => ({ id: String(f.id), x: f.x, ...seen(signedBy(f.v, f.vDir === 'down'), signedBy(f.h, f.hDir === 'towards'), u.force) }))),
    couples: drawn(form.couples.map((c) => ({ id: String(c.id), x: c.x, ...seen(signedBy(c.v, c.vDir === 'ccw'), signedBy(c.h, c.hDir === 'ccw'), u.moment) }))),
    ownWeight: view === 'vertical' && form.ownWeight && positive(form.density),
  };
}

/* ── The case in an address ───────────────────────────────────────────── */

/* A material as one letter. 'custom' is written u (the visitor's own), as the first calculator writes it; i is stainless ("inox"). */
const MATERIAL_LETTER: Record<ShaftMaterial, string> = { steel: 's', stainless: 'i', aluminum: 'a', custom: 'u' };

/*
 * No form writes a longer address: eight hollow segments and twelve loads of
 * each kind, with every number at its longest (22 characters, as in
 * beam/model.ts), come to 2,312 characters. model.test.ts writes it.
 */
const MAX_LINK = 2500;

/** A size and its direction as one signed number (beam/model.ts, `signed`) — and a size that is no number keeps its direction too, as −nan: nothing of the row is lost to a reload. */
const sized = (v: number, reversed: boolean): string => (Number.isNaN(v) && reversed ? '-nan' : signed(v, reversed));

/**
 * The case as a short string for the page's address (after `#h=`), so a link
 * opens the same shaft. Written as the first calculator writes a beam
 * (beam/model.ts, `encodeBeam`) and with its own means: each number to the
 * eight figures its field shows, signs for the directions, nothing but
 * numbers and a few letters. Six fields, the rows of a list joined by `_`:
 *
 *     units ; bearings ; segments ; forces ; couples ; material
 *
 *   bearings   the two distances from the left end, first,second
 *   segments   length,diameter of each — and its bore after them when it has
 *              one: length,diameter,bore
 *   a force    place,vertical,horizontal — a size pointing up, or away from
 *              the viewer, with a minus
 *   a couple   place,vertical,horizontal — a size turning clockwise with a
 *              minus
 *   material   its letter (s steel, i stainless, a aluminum, u the
 *              visitor's own), the modulus, the density, and 1 when the
 *              shaft's own weight is a load, 0 when it is not
 *
 * WHATEVER THE FORM HOLDS IS WRITTEN, and read back as that form: a length
 * of 0 on its way to 0.5, a bore larger than its diameter, a number of any
 * size. A reload must come back to the shaft that was on screen, with its
 * warning — not to the example. (One thing comes back as the same load and
 * not the same text: a size typed with a minus is that size pointing the
 * other way, and is read as that.)
 *
 * THE MODULUS AND THE DENSITY TRAVEL WITH THE MATERIAL'S LETTER, listed or
 * not. A link then opens on the numbers it was sent with whatever this file
 * lists for that material by then: if they are no longer the listed ones,
 * they are the visitor's own.
 *
 * IT BEGINS WITH A CHECK of the rest, the first calculator's (`checkOf`): a
 * link that lost a character on its way is not a link to another shaft.
 */
export function encodeShaft(form: ShaftForm): string {
  const n = written;
  const body = [
    form.units,
    `${n(form.bearings[0])},${n(form.bearings[1])}`,
    form.segments.map((s) => (s.bore === 0 ? `${n(s.L)},${n(s.d)}` : `${n(s.L)},${n(s.d)},${n(s.bore)}`)).join('_'),
    form.forces.map((f) => `${n(f.x)},${sized(f.v, f.vDir === 'up')},${sized(f.h, f.hDir === 'away')}`).join('_'),
    form.couples.map((c) => `${n(c.x)},${sized(c.v, c.vDir === 'cw')},${sized(c.h, c.hDir === 'cw')}`).join('_'),
    `${MATERIAL_LETTER[form.material]},${n(form.E)},${n(form.density)},${form.ownWeight ? 1 : 0}`,
  ].join(';');
  return `${checkOf(body)};${body}`;
}

/**
 * The case a string from `encodeShaft` describes, or `null` if it is
 * anything else: a check that is not the rest's, not six fields, a number in
 * any notation but the page's own, a shaft of no segment or of more than
 * eight, bearings that are not two, more loads than the form lists, a
 * material that is none of the four. The string comes back from wherever a
 * link was pasted.
 *
 * The rows are numbered again, the segments first: a link carries no ids.
 */
export function decodeShaft(text: string): ShaftForm | null {
  if (text.length > MAX_LINK) return null;
  const cut = text.indexOf(';');
  const body = text.slice(cut + 1);
  if (cut < 1 || text.slice(0, cut) !== checkOf(body)) return null;
  const parts = body.split(';');
  if (parts.length !== 6) return null;
  const [units, bearings, segments, forces, couples, material] = parts;
  if (units !== 'us' && units !== 'si') return null;
  let bad = false;
  const num = (s: string): number => {
    const named = NAMED.get(s);
    if (named !== undefined) return named;
    const v = NUMBER.test(s) ? Number(s) : Number.NaN;
    if (!Number.isFinite(v)) bad = true;
    // As a number, the −0 of `signed` is a plain zero.
    return v + 0;
  };
  /** A size, without the way it acts: only a size is ever written −nan (`sized`). */
  const size = (s: string): number => (s === '-nan' ? Number.NaN : Math.abs(num(s)));
  /** Written with a minus: the direction is the other one. */
  const reversed = (s: string) => s.startsWith('-');
  const rows = (s: string, fewest: number, fields: number, most: number): string[][] => {
    if (s === '') return [];
    const list = s.split('_').map((r) => r.split(','));
    if (list.length <= most && list.every((r) => r.length >= fewest && r.length <= fields)) return list;
    // Not a list: none of it is read.
    bad = true;
    return [];
  };
  let id = 1;
  const segmentRows: SegmentRow[] = rows(segments, 2, 3, MAX_SEGMENTS).map(([L, d, bore]) => ({ id: id++, L: num(L), d: num(d), bore: bore === undefined ? 0 : num(bore) }));
  const stands = rows(bearings, 2, 2, 1)[0];
  if (segmentRows.length === 0 || !stands) return null;
  const forceRows: ForceRow[] = rows(forces, 3, 3, MAX_ROWS).map(([x, v, h]) => ({ id: id++, x: num(x), v: size(v), vDir: reversed(v) ? 'up' : 'down', h: size(h), hDir: reversed(h) ? 'away' : 'towards' }));
  const coupleRows: CoupleRow[] = rows(couples, 3, 3, MAX_ROWS).map(([x, v, h]) => ({ id: id++, x: num(x), v: size(v), vDir: reversed(v) ? 'cw' : 'ccw', h: size(h), hDir: reversed(h) ? 'cw' : 'ccw' }));
  const [letter, modulus, weight, own, ...more] = material.split(',');
  // One of the four letters, each of them a material: found among them, never looked up as a property.
  const listed = (Object.keys(MATERIAL_LETTER) as ShaftMaterial[]).find((key) => MATERIAL_LETTER[key] === letter);
  if (!listed || modulus === undefined || weight === undefined || (own !== '0' && own !== '1') || more.length > 0) return null;
  const E = num(modulus);
  const density = num(weight);
  const first = num(stands[0]);
  const second = num(stands[1]);
  if (bad) return null;
  return {
    units,
    segments: segmentRows,
    bearings: [first, second],
    forces: forceRows,
    couples: coupleRows,
    material: materialOf(listed, units, E, density),
    E,
    density,
    ownWeight: own === '1',
    nextId: id,
  };
}
