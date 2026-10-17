import { NAMED, NUMBER, US_TO_SI, checkOf, checked, tidy, written, type UnitSystem } from '../beam/model';
import { areaOfDiameter } from './engine';
import {
  MATERIAL_IDS,
  MODES,
  ROPE_IDS,
  type CableMode,
  type CableSection,
  type DrumInput,
  type LegInput,
  type LoadInput,
  type MaterialId,
  type MaterialPreset,
  type PullInput,
  type RopeId,
  type RopePreset,
  type Side,
  type Travel,
} from './types';

export type { UnitSystem };

/**
 * ─────────────────────────────────────────────────────────────────────────────
 * CABLE TENSION AND ELONGATION — what the visitor edits, and what the engine is given
 * ─────────────────────────────────────────────────────────────────────────────
 * Between the form of the sixth calculator ("Cable tension and elongation",
 * /resources/cable) and its engine (types.ts is the agreement). Pure
 * functions, no React: the case as entered (`CableForm`), what each edit does
 * to it (`reduceCable`), the same case in the other unit system, the engine's
 * inputs (`loadInput`, `pullInput`, `drumInput`, `sectionInput`) and the
 * address that carries the case from one engineer to another (`encodeCable`,
 * `decodeCable`, key `k`: `#k=…`).
 *
 * THE FORM HOLDS NUMBERS, not the text typed (the field component is where text
 * is). A field that is not a number yet commits NaN, which the engine reports
 * against its field ('number'); `null` is "not given" for the optional values
 * (and, in the drum, THE BLANK that is solved).
 *
 * WHAT IS THE FIRST CALCULATOR'S IS USED, NOT WRITTEN AGAIN: `tidy` (the rounding of
 * a converted value), `checkOf` / `checked` (the check an address begins with),
 * `written`, `NUMBER`, `NAMED` (how a number travels in an address).
 *
 * ─── UNITS ─────────────────────────────────────────────────────────────────
 * The form holds numbers in the units it SHOWS (`CABLE_UNITS`):
 *
 *     US   force lbf (or kip: `forceUnit` 'large'), cable length ft, diameter in,
 *          area in², modulus and stress ksi, α in 10⁻⁶/°F, ΔT °F, stretch in,
 *          acceleration ft/s², a mass in lb
 *     SI   force N (or kN), length m, diameter mm, area mm², modulus GPa, stress
 *          MPa, α in 10⁻⁶/°C, ΔT °C, stretch mm, acceleration m/s², a mass in kg
 *
 * The ENGINE is given lbf, INCHES, psi, °F (US) or N, MILLIMETRES, MPa (N/mm²), °C
 * (SI). Everything crosses in ONE place: `TO_ENGINE` (shown × factor = engine)
 * and the results come back through the same numbers (analysis.ts divides). A
 * temperature CHANGE converts as a difference (×5/9 °F → °C, no offset), a
 * coefficient of expansion ×9/5 (per °F → per °C). Nothing else in the
 * calculator holds a 12, a 1000 or a g.
 */

/** What this page's case is called in its address: `#k=…`. */
export const CABLE_KEY = 'k';

/* ── Units ─────────────────────────────────────────────────────────────── */

export type ForceUnit = 'small' | 'large';

export interface CableUnits {
  /** lbf / N and kip / kN. */
  force: { small: string; large: string };
  length: string;
  dia: string;
  area: string;
  E: string;
  stress: string;
  alpha: string;
  dT: string;
  stretch: string;
  accel: string;
  mass: string;
}
export const CABLE_UNITS: Record<UnitSystem, CableUnits> = {
  us: { force: { small: 'lbf', large: 'kip' }, length: 'ft', dia: 'in', area: 'in²', E: 'ksi', stress: 'ksi', alpha: '10⁻⁶/°F', dT: '°F', stretch: 'in', accel: 'ft/s²', mass: 'lb' },
  si: { force: { small: 'N', large: 'kN' }, length: 'm', dia: 'mm', area: 'mm²', E: 'GPa', stress: 'MPa', alpha: '10⁻⁶/°C', dT: '°C', stretch: 'mm', accel: 'm/s²', mass: 'kg' },
};

/** Standard gravity: 9.80665 m/s² exactly, and in ft/s² (÷ 0.3048). */
export const G_SI = 9.80665;
export const G_US = G_SI / 0.3048;

/** Exact definitions: 1 ft = 0.3048 m; 1 in = 25.4 mm; 1 lbf = 4.4482216152605 N; 1 lb = 0.45359237 kg. */
const IN = 25.4;
const LB = 0.45359237;
/** One US unit in SI units, per quantity (forces: lbf → N and kip → kN). */
export const CABLE_US_TO_SI = {
  force: US_TO_SI.force, // lbf → N (and kip → kN)
  length: US_TO_SI.length, // ft → m
  dia: IN, // in → mm
  area: IN * IN, // in² → mm²
  E: US_TO_SI.E / 1000, // ksi → GPa
  stress: US_TO_SI.E, // ksi → MPa
  alpha: 9 / 5, // per °F → per °C (a coefficient: ÷ the degree's size)
  dT: 5 / 9, // °F → °C, a difference
  accel: US_TO_SI.length, // ft/s² → m/s²
  mass: LB,
} as const;

/** From the shown numbers to the engine's (shown × factor = engine). */
export interface EngineScale {
  /** lbf, N: 1 for 'small', 1000 for 'large'. */
  force: number;
  /** Cable length: ft → in, m → mm. */
  length: number;
  /** Diameter and area are in the engine's own units already. */
  dia: number;
  area: number;
  /** ksi → psi, GPa → MPa. */
  E: number;
  /** An allowable stress: ksi → psi, MPa. */
  stress: number;
  /** The table's 10⁻⁶. */
  alpha: number;
  dT: number;
  /** An acceleration to a / g. */
  accel: number;
  /** A mass to the force of its weight (lbf, N). */
  mass: number;
  /** Stretch: the engine's length unit (in, mm) is the shown one. */
  stretch: number;
}
export function engineScale(units: UnitSystem, force: ForceUnit): EngineScale {
  const f = force === 'large' ? 1000 : 1;
  return units === 'us'
    ? { force: f, length: 12, dia: 1, area: 1, E: 1000, stress: 1000, alpha: 1e-6, dT: 1, accel: 1 / G_US, mass: 1, stretch: 1 }
    : { force: f, length: 1000, dia: 1, area: 1, E: 1000, stress: 1, alpha: 1e-6, dT: 1, accel: 1 / G_SI, mass: G_SI, stretch: 1 };
}

/* ── The tables ────────────────────────────────────────────────────────── */

/**
 * Material presets. Each is TYPICAL; the manufacturer's value governs. The
 * two systems' numbers are written out, not converted (29,000 ksi is 199.95 GPa and
 * steel is 200 GPa). THE WIRE ROPES' MODULI ARE EFFECTIVE (APPARENT) MODULI, NOT STEEL'S
 * (types.ts says why). Sources: EN 1993-1-11:2006 (Table 3.1: the rope and strand
 * moduli; Annex C: the metallic-area factors), the Hanes Supply wire-rope guide
 * (modulus by load range, ASTM A586 / A603), Bekaert's 7-wire strand data sheet
 * (ASTM A416), SCI Design Manual for Structural Stainless Steel 4th ed., 6061-T6 data sheets.
 *
 *   steel          E 29,000 ksi = 200 GPa; α 6.5 ×10⁻⁶/°F = 11.7 ×10⁻⁶/°C (AISC 360 / ASCE).
 *   stainless      E 28,000 ksi = 193 GPa; α 9.2 ×10⁻⁶/°F = 16.6 ×10⁻⁶/°C (austenitic; sources run 8.9–9.6 ×10⁻⁶/°F: medium confidence).
 *   aluminum       E 10,000 ksi = 69 GPa;  α 13.0 ×10⁻⁶/°F = 23.4 ×10⁻⁶/°C (6061-T6: 13.1 / 23.6).
 *   strand7        E 28,500 ksi = 196 GPa: 7-wire prestressing strand (ASTM A416; PCI / ACI 28,500 ksi); α steel's.
 *   rope           6×19 / 6×36 wire rope with an independent wire-rope core (IWRC): effective E 14,500 ksi = 100 GPa
 *                  (EN 1993-1-11: 100 ± 10 GPa; range 13,000–15,500 ksi; Hanes: 6×19 IWRC 13,500 ksi at 0–20 % of the breaking
 *                  load, 15,000 ksi at 21–65 %, and service load is usually 20–40 %: the upper bracket); α steel's.
 *                  A SECANT value over a load range: it is about HALF of steel's.
 *   rope-fibre     the same with a fibre core: softer, 11,500 ksi = 80 GPa (EN: 80 ± 10 GPa; range 9,900–12,000 ksi): about 40 % of
 *                  steel's; MEDIUM CONFIDENCE.
 *   rope-spiral    spiral strand: effective E 21,800 ksi = 150 GPa (EN: 150 ± 10 GPa; range 20,000–23,200 ksi; 20,000 is a floor, not
 *                  the typical value).
 *   rope-locked    locked-coil rope: effective E 23,200 ksi = 160 GPa (EN: 160 ± 10 GPa; range 21,800–24,700 ksi).
 *   The moduli of spiral and locked-coil ropes depend on pre-stretch and on the load level: a new rope that was not pre-stretched is
 *   softer, a pre-stretched one up to about 10 % stiffer. A rope's modulus is always a secant value over a load range.
 */
export const MATERIALS: Record<Exclude<MaterialId, 'custom'>, MaterialPreset> = {
  steel: { id: 'steel', E: { us: 29000, si: 200 }, alpha: { us: 6.5, si: 11.7 }, rope: 'solid', typical: false },
  stainless: { id: 'stainless', E: { us: 28000, si: 193 }, alpha: { us: 9.2, si: 16.6 }, rope: 'solid', typical: false },
  aluminum: { id: 'aluminum', E: { us: 10000, si: 69 }, alpha: { us: 13, si: 23.4 }, rope: 'solid', typical: true },
  strand7: { id: 'strand7', E: { us: 28500, si: 196 }, alpha: { us: 6.5, si: 11.7 }, rope: 'strand7', typical: false },
  rope: { id: 'rope', E: { us: 14500, si: 100 }, alpha: { us: 6.5, si: 11.7 }, rope: 'rope-6x19', typical: true },
  'rope-fibre': { id: 'rope-fibre', E: { us: 11500, si: 80 }, alpha: { us: 6.5, si: 11.7 }, rope: 'rope-6x19', typical: true },
  'rope-spiral': { id: 'rope-spiral', E: { us: 21800, si: 150 }, alpha: { us: 6.5, si: 11.7 }, rope: 'spiral', typical: true },
  'rope-locked': { id: 'rope-locked', E: { us: 23200, si: 160 }, alpha: { us: 6.5, si: 11.7 }, rope: 'locked', typical: true },
};

/**
 * Metallic-area factors, A = factor · d² (d the NOMINAL diameter). TYPICAL — the manufacturer's metallic area governs.
 *   solid        π/4 (a solid round bar or rod).
 *   rope-6x19    0.41 (6×19 class, IWRC; EN 1993-1-11 Annex C gives 0.414).
 *   rope-6x36    0.455 (6×36WS with an independent wire-rope core; EN 1993-1-11 Annex C).
 *   strand7      0.60 (7-wire strand: ASTM A416 ½ in = 0.153 in² → 0.61; 0.6 in = 0.217 in² → 0.60; fill 0.78).
 *   locked       0.66 (fully locked coil; EN 1993-1-11 Annex C: 0.660, fill 0.84), with its OWN material 'rope-locked'.
 *   spiral       0.58 (spiral strand of round wires, fill ≈ 0.75).   LOW CONFIDENCE
 */
export const ROPES: Record<Exclude<RopeId, 'custom'>, RopePreset> = {
  solid: { id: 'solid', factor: Math.PI / 4, typical: false, material: 'steel' },
  'rope-6x19': { id: 'rope-6x19', factor: 0.41, typical: true, material: 'rope' },
  'rope-6x36': { id: 'rope-6x36', factor: 0.455, typical: true, material: 'rope' },
  strand7: { id: 'strand7', factor: 0.6, typical: true, material: 'strand7' },
  locked: { id: 'locked', factor: 0.66, typical: true, material: 'rope-locked' },
  spiral: { id: 'spiral', factor: 0.58, typical: true, material: 'rope-spiral' },
};

/* ── The form ──────────────────────────────────────────────────────────── */

/**
 * A cable section as the visitor gives it.
 *   by 'diameter'  A = factor · d² (solid round π/4, or the rope's typical factor, or a typed one);
 *   by 'area'      A typed directly (for a rope: the manufacturer's metallic area).
 *   material       a preset (E and α follow it) or 'custom' (E and α typed); a typed E or α over a preset's makes it 'custom'.
 */
export interface SectionForm {
  by: 'diameter' | 'area';
  /** Nominal diameter (in, mm). */
  d: number | null;
  /** Area (in², mm²). */
  A: number | null;
  rope: RopeId;
  /** The metallic-area factor; used for 'custom' (and kept equal to the preset's for a rope). Null for a solid round. */
  factor: number | null;
  material: MaterialId;
  /** Modulus (ksi, GPa) and thermal coefficient (10⁻⁶ per °F, per °C). */
  E: number | null;
  alpha: number | null;
  /** Minimum breaking force (lbf/kip, N/kN): the manufacturer's. Null: not given. */
  mbf: number | null;
}

export interface LegForm {
  /** Degrees from the horizontal, 0–90. Ignored for one leg (it is an output). */
  angle: number;
  side: Side;
  /** ft, m. */
  length: number;
}
export interface LoadForm {
  /** Force units. */
  W: number;
  H: number;
  legs: 1 | 2;
  leg1: LegForm;
  leg2: LegForm;
  /** Leg 2's own section and material; null: the same as the shared one (leg 1 always uses the shared one). */
  own2: SectionForm | null;
}
export interface PullForm {
  /** The weight (force units), or the mass (lb, kg) when `massInput`. */
  W: number;
  massInput: boolean;
  theta: number;
  muS: number;
  muK: number;
  phi: number;
  /** ft/s², m/s²; null: none. */
  accel: number | null;
  travel: Travel;
  /** Cable length (ft, m). */
  length: number;
}
export interface DrumForm {
  /** Force units; null is the BLANK to solve (exactly one of the four). */
  Tbig: number | null;
  Tsmall: number | null;
  mu: number | null;
  /** The wrap, in `wrapUnit`. */
  wrap: number | null;
  wrapUnit: 'deg' | 'turns';
}

export interface CableForm {
  units: UnitSystem;
  forceUnit: ForceUnit;
  mode: CableMode;
  /** The section and material shared by the modes (and by leg 1). */
  section: SectionForm;
  /** Temperature change (°F, °C): a difference. */
  dT: number;
  /** Design factor n and allowable stress (ksi, MPa): optional. */
  n: number | null;
  allowable: number | null;
  load: LoadForm;
  pull: PullForm;
  drum: DrumForm;
}


/* ── The examples ──────────────────────────────────────────────────────── */

function sectionOf(material: Exclude<MaterialId, 'custom'>, units: UnitSystem): SectionForm {
  return { by: 'diameter', d: units === 'us' ? 0.25 : 6, A: null, rope: 'solid', factor: null, material, E: MATERIALS[material].E[units], alpha: MATERIALS[material].alpha[units], mbf: null };
}

/**
 * The case the page opens with (mode 'load'), and the examples the other two
 * modes open with (their inputs are kept in the form, so a click on a mode
 * shows its example). Steel, ¼ in solid round, ΔT 0, US units. (The same case
 * in SI is `convertCable(defaultCase(), 'si')`.)
 *
 * LOAD (a symmetric two-leg sling): W = 2,000 lbf on two 10 ft legs at 60° from the horizontal.
 *   T = W / (2·sin60°) = 1,154.70 lbf in each leg.
 *   A = π/4·0.25² = 0.049087 in²;  σ = T/A = 23.523 ksi;  ε = σ/E = 8.111×10⁻⁴.
 *   δe = T·L/(A·E) = 1154.70·120 / (0.049087·29×10⁶) = 0.09734 in each leg (no thermal).
 *   The load point drops: sin60°·dy = −δe → dy = −0.11240 in (dx = 0).
 * PULL (the textbook crate): W = 100 lb on level ground (θ = 0), μs = 0.5, μk = 0.4, pulled by a rope at φ = 30° above the ground.
 *   run:   T = μk·W / (cos30° + μk·sin30°) = 40 / 1.066025 = 37.52 lbf; N = 100 − 37.52·0.5 = 81.24 lbf; F = 0.4·N = 32.50 lbf.
 *   start: T = 50 / (cos30° + 0.5·sin30°) = 50 / 1.116025 = 44.80 lbf.
 *   best angle φ* = atan(μ): 21.80° (run), T_min = 40/√1.16 = 37.14 lbf; 26.57° (start), T_min = 50/√1.25 = 44.72 lbf.
 * DRUM (a load held by 2 turns round a post): T_big = 1,000 lbf, μ = 0.3, wrap 2 turns (β = 4π): ratio e^(0.3·4π) = e^3.7699 = 43.38;
 *   T_small = 1000 / 43.38 = 23.05 lbf — what a person holds. The blank is Tsmall.
 */
export function defaultCase(): CableForm {
  return {
    units: 'us',
    forceUnit: 'small',
    mode: 'load',
    section: sectionOf('steel', 'us'),
    dT: 0,
    n: null,
    allowable: null,
    load: { W: 2000, H: 0, legs: 2, leg1: { angle: 60, side: 'left', length: 10 }, leg2: { angle: 60, side: 'right', length: 10 }, own2: null },
    pull: { W: 100, massInput: false, theta: 0, muS: 0.5, muK: 0.4, phi: 30, accel: null, travel: 'along', length: 20 },
    drum: { Tbig: 1000, Tsmall: null, mu: 0.3, wrap: 2, wrapUnit: 'turns' },
  };
}
/** The example of one mode: the default case with that mode open, in the units asked. */
export function exampleOf(mode: CableMode, units: UnitSystem = 'us'): CableForm {
  return convertCable({ ...defaultCase(), mode }, units);
}

/* ── Units ─────────────────────────────────────────────────────────────── */

/**
 * The same case in the other unit system: every quantity as its own, to the
 * figures a field shows (`tidy`), and back again to the very same numbers for
 * values of up to four significant figures. A listed material's E and α are the
 * listed ones in the other system. The force scale (lbf/kip) is kept.
 */
export function convertCable(form: CableForm, to: UnitSystem): CableForm {
  if (form.units === to) return form;
  const F = CABLE_US_TO_SI;
  const c = (v: number, q: keyof typeof F): number => tidy(v * (to === 'si' ? F[q] : 1 / F[q]));
  const opt = (v: number | null, q: keyof typeof F): number | null => (v === null ? null : c(v, q));
  const section = (s: SectionForm): SectionForm => {
    const listed = s.material !== 'custom' && s.E === MATERIALS[s.material].E[form.units] && s.alpha === MATERIALS[s.material].alpha[form.units];
    return {
      ...s,
      d: opt(s.d, 'dia'),
      A: opt(s.A, 'area'),
      E: listed ? MATERIALS[s.material as Exclude<MaterialId, 'custom'>].E[to] : opt(s.E, 'E'),
      alpha: listed ? MATERIALS[s.material as Exclude<MaterialId, 'custom'>].alpha[to] : opt(s.alpha, 'alpha'),
      mbf: opt(s.mbf, 'force'),
    };
  };
  const leg = (l: LegForm): LegForm => ({ ...l, length: c(l.length, 'length') });
  return {
    ...form,
    units: to,
    section: section(form.section),
    dT: c(form.dT, 'dT'),
    allowable: opt(form.allowable, 'stress'),
    load: { ...form.load, W: c(form.load.W, 'force'), H: c(form.load.H, 'force'), leg1: leg(form.load.leg1), leg2: leg(form.load.leg2), own2: form.load.own2 ? section(form.load.own2) : null },
    pull: { ...form.pull, W: c(form.pull.W, form.pull.massInput ? 'mass' : 'force'), accel: opt(form.pull.accel, 'accel'), length: c(form.pull.length, 'length') },
    drum: { ...form.drum, Tbig: opt(form.drum.Tbig, 'force'), Tsmall: opt(form.drum.Tsmall, 'force') },
  };
}

/** A value kept to twelve figures: more than any field holds (a field shows eight), and none of the noise of a multiplication by 1000. */
const twelve = (v: number): number => Number(v.toPrecision(12)) + 0;

/** The same case with forces in the other of lbf/kip (N/kN): a factor of 1000, exact (to twelve figures, so that 12,345.6789 lbf comes back as 12,345.6789). */
export function convertForceUnit(form: CableForm, to: ForceUnit): CableForm {
  if (form.forceUnit === to) return form;
  const k = to === 'large' ? 1 / 1000 : 1000;
  const f = (v: number): number => (Number.isFinite(v) ? twelve(v * k) : v);
  const opt = (v: number | null): number | null => (v === null ? null : f(v));
  const section = (s: SectionForm): SectionForm => ({ ...s, mbf: opt(s.mbf) });
  return {
    ...form,
    forceUnit: to,
    section: section(form.section),
    load: { ...form.load, W: f(form.load.W), H: f(form.load.H), own2: form.load.own2 ? section(form.load.own2) : null },
    pull: { ...form.pull, W: form.pull.massInput ? form.pull.W : f(form.pull.W) },
    drum: { ...form.drum, Tbig: opt(form.drum.Tbig), Tsmall: opt(form.drum.Tsmall) },
  };
}

/* ── What each edit does to the form ───────────────────────────────────── */

/** Which section an edit is about: the shared one (and leg 1), or leg 2's own. */
export type SectionTarget = 'main' | 'leg2';

export type CableAction =
  | { type: 'load'; form: CableForm }
  | { type: 'reset' }
  | { type: 'mode'; mode: CableMode }
  | { type: 'units'; units: UnitSystem }
  | { type: 'force'; force: ForceUnit }
  | { type: 'material'; material: MaterialId; target?: SectionTarget }
  | { type: 'rope'; rope: RopeId; target?: SectionTarget }
  | { type: 'section'; patch: Partial<Pick<SectionForm, 'by' | 'd' | 'A' | 'factor' | 'E' | 'alpha' | 'mbf'>>; target?: SectionTarget }
  /** Leg 2 gets its own section (the one it had when it was last taken off, else a copy of the shared one) or goes back to the shared one. */
  | { type: 'own2'; on: boolean; restore?: SectionForm }
  | { type: 'dT'; value: number }
  | { type: 'design'; patch: { n?: number | null; allowable?: number | null } }
  | { type: 'legs'; legs: 1 | 2 }
  | { type: 'leg'; leg: 1 | 2; patch: Partial<LegForm> }
  | { type: 'loadInput'; patch: Partial<Pick<LoadForm, 'W' | 'H'>> }
  | { type: 'pullInput'; patch: Partial<PullForm> }
  | { type: 'drumInput'; patch: Partial<DrumForm> };

const isNum = (v: unknown): v is number => typeof v === 'number';

/** Picks the allowed keys of a patch and checks the kind of each value. */
function pick<T extends object>(patch: object, spec: Record<string, 'number' | 'nullable' | 'side' | 'travel' | 'boolean' | 'unit' | 'by'>): Partial<T> {
  const out: Record<string, unknown> = {};
  for (const [key, kind] of Object.entries(spec)) {
    if (!(key in patch)) continue;
    const v = (patch as Record<string, unknown>)[key];
    if (kind === 'number' && isNum(v)) out[key] = v;
    else if (kind === 'nullable' && (v === null || isNum(v))) out[key] = v;
    else if (kind === 'side' && (v === 'left' || v === 'right')) out[key] = v;
    else if (kind === 'travel' && (v === 'along' || v === 'against')) out[key] = v;
    else if (kind === 'boolean' && typeof v === 'boolean') out[key] = v;
    else if (kind === 'unit' && (v === 'deg' || v === 'turns')) out[key] = v;
    else if (kind === 'by' && (v === 'diameter' || v === 'area')) out[key] = v;
  }
  return out as Partial<T>;
}

/** The factor a section's diameter is squared by: π/4 for a solid round, the rope's (typed or typical). Null: a rope with no factor yet. */
export function ropeFactor(s: Pick<SectionForm, 'rope' | 'factor'>): number | null {
  return s.rope === 'solid' ? Math.PI / 4 : s.factor;
}

function patchSection(units: UnitSystem, s: SectionForm, patch: Partial<SectionForm>): SectionForm {
  const clean = pick<SectionForm>(patch, { by: 'by', d: 'nullable', A: 'nullable', factor: 'nullable', E: 'nullable', alpha: 'nullable', mbf: 'nullable' });
  let next: SectionForm = { ...s, ...clean };
  if (next.material !== 'custom') {
    const preset = MATERIALS[next.material];
    // A modulus or a coefficient typed over a listed material's is the visitor's own.
    if (next.E !== preset.E[units] || next.alpha !== preset.alpha[units]) next = { ...next, material: 'custom' };
  }
  if ('factor' in clean && next.rope !== 'solid' && next.rope !== 'custom') {
    if (next.factor !== ROPES[next.rope].factor) next = { ...next, rope: 'custom' };
  }
  return next;
}

export function reduceCable(form: CableForm, action: CableAction): CableForm {
  const section = (target: SectionTarget | undefined, edit: (s: SectionForm) => SectionForm): CableForm => {
    if (target === 'leg2') return form.load.own2 ? { ...form, load: { ...form.load, own2: edit(form.load.own2) } } : form;
    return { ...form, section: edit(form.section) };
  };
  switch (action.type) {
    case 'load':
      return action.form;
    case 'reset':
      return defaultCase();
    case 'mode':
      return MODES.includes(action.mode) ? { ...form, mode: action.mode } : form;
    case 'units':
      return action.units === 'us' || action.units === 'si' ? convertCable(form, action.units) : form;
    case 'force':
      return action.force === 'small' || action.force === 'large' ? convertForceUnit(form, action.force) : form;
    case 'material': {
      const m = action.material;
      if (!MATERIAL_IDS.includes(m)) return form;
      return section(action.target, (s) => (m === 'custom' ? { ...s, material: 'custom' } : { ...s, material: m, E: MATERIALS[m].E[form.units], alpha: MATERIALS[m].alpha[form.units] }));
    }
    case 'rope': {
      const r = action.rope;
      if (!ROPE_IDS.includes(r)) return form;
      return section(action.target, (s) => (r === 'custom' ? { ...s, rope: 'custom', factor: s.factor ?? 0.5 } : r === 'solid' ? { ...s, rope: 'solid', factor: null } : { ...s, rope: r, factor: ROPES[r].factor }));
    }
    case 'section':
      return section(action.target, (s) => patchSection(form.units, s, action.patch));
    case 'own2':
      if (action.on) return form.load.own2 ? form : { ...form, load: { ...form.load, own2: action.restore && typeof action.restore === 'object' ? { ...action.restore } : { ...form.section } } };
      return form.load.own2 ? { ...form, load: { ...form.load, own2: null } } : form;
    case 'dT':
      return isNum(action.value) ? { ...form, dT: action.value } : form;
    case 'design':
      return { ...form, ...pick<CableForm>(action.patch, { n: 'nullable', allowable: 'nullable' }) };
    case 'legs':
      return action.legs === 1 || action.legs === 2 ? { ...form, load: { ...form.load, legs: action.legs } } : form;
    case 'leg': {
      const key = action.leg === 2 ? 'leg2' : 'leg1';
      return { ...form, load: { ...form.load, [key]: { ...form.load[key], ...pick<LegForm>(action.patch, { angle: 'number', side: 'side', length: 'number' }) } } };
    }
    case 'loadInput':
      return { ...form, load: { ...form.load, ...pick<LoadForm>(action.patch, { W: 'number', H: 'number' }) } };
    case 'pullInput': {
      const patch = pick<PullForm>(action.patch, { W: 'number', massInput: 'boolean', theta: 'number', muS: 'number', muK: 'number', phi: 'number', accel: 'nullable', travel: 'travel', length: 'number' });
      let next: PullForm = { ...form.pull, ...patch };
      // The weight field turned into a mass field (or back) keeps the same body: the number is converted unless it is retyped with the switch.
      if ('massInput' in patch && patch.massInput !== form.pull.massInput && !('W' in patch)) {
        const k = engineScale(form.units, form.forceUnit);
        // weight (force units) × engine force = mass × engine mass (weight in lbf or N)
        // `tidy`, as every other conversion is: a weight of 100 N is 10.1972 kg and comes back as 100 N, not 99.999999.
        next = { ...next, W: Number.isFinite(next.W) ? tidy(patch.massInput ? (next.W * k.force) / k.mass : (next.W * k.mass) / k.force) : next.W };
      }
      return { ...form, pull: next };
    }
    case 'drumInput': {
      const patch = pick<DrumForm>(action.patch, { Tbig: 'nullable', Tsmall: 'nullable', mu: 'nullable', wrap: 'nullable', wrapUnit: 'unit' });
      let next: DrumForm = { ...form.drum, ...patch };
      // The wrap field turned from degrees to turns (or back) keeps the same wrap: 2 turns is 720°, not "2 degrees". A blank stays blank, and a wrap
      // retyped with the switch is what was typed.
      if (patch.wrapUnit !== undefined && patch.wrapUnit !== form.drum.wrapUnit && !('wrap' in patch) && form.drum.wrap !== null && Number.isFinite(form.drum.wrap)) {
        next = { ...next, wrap: tidy(patch.wrapUnit === 'turns' ? form.drum.wrap / 360 : form.drum.wrap * 360) };
      }
      return { ...form, drum: next };
    }
  }
}

/**
 * A form but for the numbers typed into it: its units, its modes, every choice made in it. A choice is solved in the render that shows it (the
 * page defers only the solving of typed numbers). The number of legs is a number, and a choice: one cable or two.
 */
export const choicesOf = (form: CableForm): string => JSON.stringify(form, (key, value: unknown) => (typeof value === 'number' && key !== 'legs' ? 0 : value));

/* ── From the form to the engine ───────────────────────────────────────── */

/**
 * The section as the engine takes it (lbf, in, psi, per °F — or N, mm, MPa, per °C).
 * A value not given is NaN, which the engine reports against its field.
 */
export function sectionInput(s: SectionForm, form: Pick<CableForm, 'units' | 'forceUnit'>): CableSection {
  const k = engineScale(form.units, form.forceUnit);
  const f = ropeFactor(s);
  let A: number;
  if (s.by === 'area') A = s.A === null ? Number.NaN : s.A * k.area;
  else A = s.d === null || f === null ? Number.NaN : areaOfDiameter(s.d * k.dia, f);
  return {
    A,
    E: s.E === null ? Number.NaN : s.E * k.E,
    alpha: s.alpha === null ? Number.NaN : s.alpha * k.alpha,
    mbf: s.mbf === null ? null : s.mbf * k.force,
    factor: s.rope === 'solid' ? null : f,
  };
}

/** The form's field an engine field is, for the section: 'A' is the diameter when the section is given by diameter. */
export function sectionField(s: Pick<SectionForm, 'by'>, engineField: string): 'd' | 'A' | 'factor' | 'E' | 'alpha' | 'mbf' | null {
  switch (engineField) {
    case 'A':
      return s.by === 'diameter' ? 'd' : 'A';
    case 'factor':
    case 'E':
    case 'alpha':
    case 'mbf':
      return engineField;
    default:
      return null;
  }
}

export function loadInput(form: CableForm): LoadInput {
  const k = engineScale(form.units, form.forceUnit);
  const leg = (l: LegForm, s: SectionForm): LegInput => ({ angle: l.angle, side: l.side, length: l.length * k.length, section: sectionInput(s, form) });
  const legs = form.load.legs === 1 ? [leg(form.load.leg1, form.section)] : [leg(form.load.leg1, form.section), leg(form.load.leg2, form.load.own2 ?? form.section)];
  return { W: form.load.W * k.force, H: form.load.H * k.force, legs, dT: form.dT * k.dT, n: form.n, allowable: form.allowable === null ? null : form.allowable * k.stress };
}

export function pullInput(form: CableForm): PullInput {
  const k = engineScale(form.units, form.forceUnit);
  const p = form.pull;
  return {
    W: p.W * (p.massInput ? k.mass : k.force),
    theta: p.theta,
    muS: p.muS,
    muK: p.muK,
    phi: p.phi,
    aOverG: p.accel === null ? null : p.accel * k.accel,
    travel: p.travel,
  };
}

export function drumInput(form: CableForm): DrumInput {
  const k = engineScale(form.units, form.forceUnit);
  const d = form.drum;
  return {
    Tbig: d.Tbig === null ? null : d.Tbig * k.force,
    Tsmall: d.Tsmall === null ? null : d.Tsmall * k.force,
    mu: d.mu,
    beta: d.wrap === null ? null : d.wrap * (d.wrapUnit === 'deg' ? Math.PI / 180 : 2 * Math.PI),
  };
}

/* ── The case in an address ────────────────────────────────────────────── */

const VERSION = '1';

/** The longest address a form can write is under this (model.test.ts writes it with every number at its longest). */
export const MAX_LINK = 1500;

const MATERIAL_LETTER: Record<MaterialId, string> = { steel: 's', stainless: 'i', aluminum: 'a', strand7: 't', rope: 'r', 'rope-fibre': 'f', 'rope-spiral': 'p', 'rope-locked': 'k', custom: 'u' };
const ROPE_LETTER: Record<RopeId, string> = { solid: 's', 'rope-6x19': 'a', 'rope-6x36': 'b', strand7: 'c', locked: 'd', spiral: 'e', custom: 'u' };
const MODE_LETTER: Record<CableMode, string> = { load: 'l', pull: 'p', drum: 'd' };

const lookup = <K extends string>(table: Record<K, string>, letter: string | undefined): K | null => (Object.keys(table) as K[]).find((key) => table[key] === letter) ?? null;

/**
 * The case as a short string for the page's address (after `#k=`). Written as
 * the other calculators write theirs: each number to the eight figures its field
 * shows, nothing but numbers, letters and the separators `; ,`. After the check,
 * eight fields:
 *
 *     version ; head ; section ; leg-2 section ; design ; load ; pull ; drum
 *
 *   version   1
 *   head      units(us|si), force(s small|l large), mode(l load|p pull|d drum):  us,s,l
 *   section   by(d|a), rope, factor, material, d, A, E, alpha, mbf — empty when null:  d,s,,s,0.25,,29000,6.5,
 *             rope letters s solid, a 6×19, b 6×36, c 7-wire strand, d locked coil, e spiral, u own factor;
 *             material letters s steel, i stainless, a aluminum, t 7-wire strand, r rope, f fibre-core rope,
 *             p spiral strand, k locked-coil rope, u own E and α
 *   leg-2 section   empty when leg 2 uses the shared one, else the same nine fields
 *   design    ΔT, n, allowable stress:  0,,
 *   load      W, H, legs(1|2), angle1, side1(l|r), length1, angle2, side2, length2
 *   pull      W, mass(0|1), θ, μs, μk, φ, accel, travel(a along|g against), length
 *   drum      Tbig, Tsmall, μ, wrap, unit(d degrees|t turns) — the blank is empty
 *
 * WHATEVER THE FORM HOLDS IS WRITTEN and read back as that form (a NaN as `nan`),
 * all three modes' inputs, so that a reload comes back to the case that was on
 * screen. It begins with a check of the rest, the first calculator's (`checkOf`).
 */
export function encodeCable(form: CableForm): string {
  const n = written;
  const o = (v: number | null) => (v === null ? '' : n(v));
  const sec = (s: SectionForm) => [s.by === 'diameter' ? 'd' : 'a', ROPE_LETTER[s.rope], o(s.factor), MATERIAL_LETTER[s.material], o(s.d), o(s.A), o(s.E), o(s.alpha), o(s.mbf)].join(',');
  const l = form.load;
  const side = (x: Side) => (x === 'left' ? 'l' : 'r');
  const body = [
    VERSION,
    `${form.units},${form.forceUnit === 'large' ? 'l' : 's'},${MODE_LETTER[form.mode]}`,
    sec(form.section),
    l.own2 ? sec(l.own2) : '',
    [n(form.dT), o(form.n), o(form.allowable)].join(','),
    [n(l.W), n(l.H), l.legs, n(l.leg1.angle), side(l.leg1.side), n(l.leg1.length), n(l.leg2.angle), side(l.leg2.side), n(l.leg2.length)].join(','),
    [n(form.pull.W), form.pull.massInput ? 1 : 0, n(form.pull.theta), n(form.pull.muS), n(form.pull.muK), n(form.pull.phi), o(form.pull.accel), form.pull.travel === 'along' ? 'a' : 'g', n(form.pull.length)].join(','),
    [o(form.drum.Tbig), o(form.drum.Tsmall), o(form.drum.mu), o(form.drum.wrap), form.drum.wrapUnit === 'deg' ? 'd' : 't'].join(','),
  ].join(';');
  return `${checkOf(body)};${body}`;
}
/** The shell's name for the same thing. */
export const encode = encodeCable;

/**
 * The case a string from `encodeCable` describes, or `null` if it is anything
 * else: a check that is not the rest's, a version that is not 1, not eight
 * fields or not the right number in a field, a letter that means nothing, a
 * number in any notation but the page's own, a required value missing, or a
 * string past `MAX_LINK`. Never throws, whatever the string is.
 */
export function decodeCable(text: string): CableForm | null {
  try {
    return read(text);
  } catch {
    return null;
  }
}
export const decode = decodeCable;

function read(text: string): CableForm | null {
  if (typeof text !== 'string' || text.length > MAX_LINK) return null;
  const body = checked(text);
  if (body === null) return null;
  const parts = body.split(';');
  if (parts.length !== 8) return null;
  const [version, head, secText, sec2Text, general, loadText, pullText, drumText] = parts;
  if (version !== VERSION) return null;
  let bad = false;
  const num = (s: string | undefined): number => {
    if (s === undefined) {
      bad = true;
      return Number.NaN;
    }
    const named = NAMED.get(s);
    if (named !== undefined) return named;
    const v = NUMBER.test(s) ? Number(s) : Number.NaN;
    if (!Number.isFinite(v)) bad = true;
    return v + 0;
  };
  const opt = (s: string | undefined): number | null => {
    if (s === undefined) {
      bad = true;
      return null;
    }
    return s === '' ? null : num(s);
  };
  const fields = (s: string, count: number): string[] => {
    const f = s.split(',');
    if (f.length !== count) {
      bad = true;
      return Array<string>(count).fill('');
    }
    return f;
  };
  const section = (s: string): SectionForm => {
    const [by, rope, factor, material, d, A, E, alpha, mbf] = fields(s, 9);
    const r = lookup(ROPE_LETTER, rope);
    const m = lookup(MATERIAL_LETTER, material);
    if ((by !== 'd' && by !== 'a') || r === null || m === null) bad = true;
    return { by: by === 'a' ? 'area' : 'diameter', rope: r ?? 'solid', factor: opt(factor), material: m ?? 'steel', d: opt(d), A: opt(A), E: opt(E), alpha: opt(alpha), mbf: opt(mbf) };
  };
  const [units, force, mode] = fields(head, 3);
  const md = lookup(MODE_LETTER, mode);
  if ((units !== 'us' && units !== 'si') || (force !== 's' && force !== 'l') || md === null) bad = true;
  const main = section(secText);
  const own2 = sec2Text === '' ? null : section(sec2Text);
  const [dT, n, allowable] = fields(general, 3);
  const [W, H, legs, a1, s1, L1, a2, s2, L2] = fields(loadText, 9);
  if ((legs !== '1' && legs !== '2') || (s1 !== 'l' && s1 !== 'r') || (s2 !== 'l' && s2 !== 'r')) bad = true;
  const [pW, mass, theta, muS, muK, phi, accel, travel, pL] = fields(pullText, 9);
  if ((mass !== '0' && mass !== '1') || (travel !== 'a' && travel !== 'g')) bad = true;
  const [Tb, Ts, mu, wrap, unit] = fields(drumText, 5);
  if (unit !== 'd' && unit !== 't') bad = true;
  const form: CableForm = {
    units: units === 'si' ? 'si' : 'us',
    forceUnit: force === 'l' ? 'large' : 'small',
    mode: md ?? 'load',
    section: main,
    dT: num(dT),
    n: opt(n),
    allowable: opt(allowable),
    load: {
      W: num(W),
      H: num(H),
      legs: legs === '1' ? 1 : 2,
      leg1: { angle: num(a1), side: s1 === 'r' ? 'right' : 'left', length: num(L1) },
      leg2: { angle: num(a2), side: s2 === 'r' ? 'right' : 'left', length: num(L2) },
      own2,
    },
    pull: { W: num(pW), massInput: mass === '1', theta: num(theta), muS: num(muS), muK: num(muK), phi: num(phi), accel: opt(accel), travel: travel === 'g' ? 'against' : 'along', length: num(pL) },
    drum: { Tbig: opt(Tb), Tsmall: opt(Ts), mu: opt(mu), wrap: opt(wrap), wrapUnit: unit === 'd' ? 'deg' : 'turns' },
  };
  return bad ? null : form;
}
