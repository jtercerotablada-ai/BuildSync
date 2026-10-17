import { NAMED, NUMBER, US_TO_SI, checkOf, checked, tidy, written, type UnitSystem } from '../beam/model';
import { CABLE_MATERIALS, MATERIAL_IDS, type ListedMaterial, type MaterialId } from './materials';
import { MAX_FACTOR_ROWS, MAX_POINT_LOADS, MAX_TABLE_ROWS, type CableIssue, type HangingInput, type Known, type PointsInput, type PointsKnown, type StateInput } from './types';

export { CABLE_MATERIALS, MATERIAL_IDS, type ListedMaterial, type MaterialId };
export { MAX_FACTOR_ROWS, MAX_POINT_LOADS, MAX_TABLE_ROWS };

/**
 * ─────────────────────────────────────────────────────────────────────────────
 * CABLE SAG AND PRETENSION — what the visitor edits, and what the engine is given
 * ─────────────────────────────────────────────────────────────────────────────
 * Between the form of the seventh calculator ("Cable sag and pretension",
 * /resources/cable-sag) and its engine (types.ts is the agreement between the
 * two). Pure functions, no React: the form as entered (`CableSagForm`), what each
 * edit does to it (`reduceCableSag`), the inputs the engine takes (`toEngine`), the
 * same cable in the other unit system (`convertCableSag`), and the address that
 * carries the case from one engineer to another. The rest of the shell's wants of
 * a model: `defaultCase()`, `encode(form)`, `decode(text)` (null for an address that
 * cannot be read), and a reducer with a `'load'` action.
 *
 * THE FORM HOLDS NUMBERS, not the text typed: the field component (NumField) is
 * where text is; a field that is not a number yet commits NaN, which the engine
 * reports against its field ('number', 'section'). THE FORM HOLDS THE INPUTS OF ALL
 * THREE MODES AT ONCE, so a visitor who switches mode and back finds what was typed;
 * `mode` says which one the page solves. A field a mode does not use is ignored by
 * it, whatever it holds (NaN included).
 *
 * UNITS. The form holds numbers in the units it SHOWS (`CABLE_UNITS`):
 *
 *     US   ft, kip;  line loads lb/ft;  area in², diameter in;  E ksi;  unit weight lb/ft³;
 *          alpha 10⁻⁶/°F;  temperature °F;  elongation in;  stress ksi
 *     SI   m,  kN;   line loads kN/m;   area mm², diameter mm;  E GPa;  unit weight kN/m³;
 *          alpha 10⁻⁶/°C;  temperature °C;  elongation mm;  stress MPa
 *
 * The engine takes any consistent set and is given FEET AND KIPS or METRES AND
 * KILONEWTONS. Lengths and forces cross as they are; everything else crosses in
 * ONE place (`TO_ENGINE`): lb/ft → kip/ft (÷ 1000), lb/ft³ → kip/ft³ (÷ 1000),
 * in² → ft² (÷ 144), in → ft (÷ 12), ksi → kip/ft² (× 144); mm² → m² (× 10⁻⁶),
 * mm → m (× 10⁻³), GPa → kN/m² (× 10⁶); alpha × 10⁻⁶. Results come back through
 * `FROM_ENGINE`. Nothing else in the calculator holds a 12, a 144 or a 1000.
 * Switching the system (`convertCableSag`) uses `US_TO_SI`, exact definitions
 * (1 ft = 0.3048 m, 1 kip = 4.4482216152605 kN, 1 in = 25.4 mm); a temperature is
 * converted with its offset (°C = (°F − 32)/1.8), and a TEMPERATURE DIFFERENCE (the
 * table's step) and a coefficient per degree (alpha) with the 1.8 only: ΔT is a
 * difference. The thermal strain is  α·10⁻⁶·(T2 − T1)  in the units shown, which
 * is the same number in either system.
 *
 * THE ADDRESS is  #g=…  (`CABLE_SAG_KEY`; #b beam, #s single span, #c continuous beam,
 * #h shaft, #t truss, #k cable tension and elongation are taken). See `encodeCableSag`.
 */

/** What this page's case is called in its address: `#g=…`. */
export const CABLE_SAG_KEY = 'g';

/* ── The units ────────────────────────────────────────────────────────── */

export const CABLE_UNITS: Record<
  UnitSystem,
  { length: string; force: string; line: string; area: string; dim: string; E: string; stress: string; gamma: string; alpha: string; temp: string; elongation: string }
> = {
  us: { length: 'ft', force: 'kip', line: 'lb/ft', area: 'in²', dim: 'in', E: 'ksi', stress: 'ksi', gamma: 'lb/ft³', alpha: '10⁻⁶/°F', temp: '°F', elongation: 'in' },
  si: { length: 'm', force: 'kN', line: 'kN/m', area: 'mm²', dim: 'mm', E: 'GPa', stress: 'MPa', gamma: 'kN/m³', alpha: '10⁻⁶/°C', temp: '°C', elongation: 'mm' },
};

const FT = US_TO_SI.length;
const KIP = US_TO_SI.force;
const IN = 25.4;
/** One US unit in SI units, per quantity. */
export const CABLE_US_TO_SI = {
  length: FT,
  force: KIP,
  // lb/ft → kN/m
  line: KIP / FT / 1000,
  // lb/ft³ → kN/m³
  gamma: KIP / (FT * FT * FT) / 1000,
  area: IN * IN,
  dim: IN,
  // ksi → GPa
  E: KIP / (IN * IN),
  // per °F → per °C
  alpha: 1.8,
} as const;

/** From what the form holds to what the engine is given (feet and kips; metres and kilonewtons). */
export const TO_ENGINE: Record<UnitSystem, { line: number; gamma: number; area: number; dim: number; E: number; alpha: number }> = {
  us: { line: 1 / 1000, gamma: 1 / 1000, area: 1 / 144, dim: 1 / 12, E: 144, alpha: 1e-6 },
  si: { line: 1, gamma: 1, area: 1e-6, dim: 1e-3, E: 1e6, alpha: 1e-6 },
};

/** From the engine's results to the units shown: an elongation (ft → in, m → mm), a stress (kip/ft² → ksi, kN/m² → MPa), a line load (kip/ft → lb/ft, kN/m). */
export const FROM_ENGINE: Record<UnitSystem, { elongation: number; stress: number; line: number }> = {
  us: { elongation: 12, stress: 1 / 144, line: 1000 },
  si: { elongation: 1000, stress: 1 / 1000, line: 1 },
};

/* ── The form ─────────────────────────────────────────────────────────── */

export type CableSagMode = 'hanging' | 'state' | 'points';
export const MODES: readonly CableSagMode[] = ['hanging', 'state', 'points'];

/** What is known in the hanging cable (and in state 1 of a change of state). */
export type KnownField = 'sag' | 'H' | 'T-high' | 'T-low' | 'length';
export const KNOWN_FIELDS: readonly KnownField[] = ['sag', 'H', 'T-high', 'T-low', 'length'];
/** Which sag the 'sag' known is: 'mid' the mid-span sag, 'low' the depth of the lowest point below the lower support. */
export type SagKind = 'mid' | 'low';
export type SectionBy = 'diameter' | 'area';
/** Where the cable's own weight comes from: the section and the material, a typed weight per length, or none (a weightless cable carrying a load). */
export type WeightFrom = 'section' | 'typed' | 'none';
export type PointsKnownField = 'sag' | 'H' | 'T-max';
export const POINTS_KNOWN_FIELDS: readonly PointsKnownField[] = ['sag', 'H', 'T-max'];

export interface PointRow {
  id: number;
  /** Position from support A (ft, m). */
  x: number;
  /** Downward force (kip, kN). */
  P: number;
}

/**
 * State 2 of a change of state, and its tables. State 1 is the form's own load (`q` and
 * the self-weight) at T1, with its known; state 2 is this `q`, the self-weight plus
 * `ice`, at T2.
 */
export interface StateForm {
  /**
   * State 2's load per unit horizontal length (lb/ft, kN/m). `null` (the field left empty) is
   * "THE SAME AS STATE 1": state 2 carries state 1's `form.q`, and follows it when that changes.
   * A number, 0 included, is state 2's own load, absolute. (Ice is separate: it is always added.)
   */
  q: number | null;
  /** Weight per unit length of cable ADDED in state 2 — ice (lb/ft, kN/m). */
  ice: number;
  /** The temperatures of state 1 and state 2 (°F, °C). */
  T1: number;
  T2: number;
  /** The temperature table: from `low` to `high` every `step` (°F, °C; `step` a difference), at state 2's load. At most 41 rows. */
  low: number;
  high: number;
  step: number;
  /** The load-factor table: `factorRows` factors from `factorLow` to `factorHigh`, each multiplying state 2's ADDED load, at state 2's temperature. 1 to 21 rows. ADDED is what state 2 carries above state 1: the ice, plus (q2 − q1) where state 2's q is typed (nothing, where it is "same as state 1"). The self-weight and state 1's own load stay. A factor of 1 is state 2 exactly. */
  factorLow: number;
  factorHigh: number;
  factorRows: number;
}

export type CableSagNotice = { code: 'limit'; list: 'points'; max: number };

export interface CableSagForm {
  units: UnitSystem;
  mode: CableSagMode;
  /** Horizontal distance between the supports, and the height of the right support over the left (either sign) (ft, m). */
  span: number;
  rise: number;
  /* ── section and material ── */
  material: MaterialId;
  sectionBy: SectionBy;
  /** Nominal diameter (in, mm). Used when `sectionBy` is 'diameter'. */
  diameter: number;
  /** Metallic area (in², mm²). Used when `sectionBy` is 'area'. */
  area: number;
  /** Metallic area ÷ the circle of the nominal diameter (1 for a bar). Used with the diameter. */
  fill: number;
  /** Weight per length ÷ (unit weight × metallic area). */
  lay: number;
  /** Modulus on the metallic area (ksi, GPa); thermal coefficient (10⁻⁶ per °F, per °C); unit weight (lb/ft³, kN/m³). */
  E: number;
  alpha: number;
  gamma: number;
  /** Use E and the area in the solution: the elastic cable (stretched vs unstretched length, the load over the stretched run). Off: an inextensible cable. */
  elastic: boolean;
  /* ── loads ── */
  weightFrom: WeightFrom;
  /** The cable's weight per length when `weightFrom` is 'typed' (lb/ft, kN/m). */
  typedWeight: number;
  /** A uniform load per unit HORIZONTAL length — a deck, a pipe (lb/ft, kN/m). */
  q: number;
  /* ── what is known (hanging, and state 1) ── */
  known: KnownField;
  sagKind: SagKind;
  /** The values: a sag (ft, m), H (kip, kN), a tension at a support (kip, kN), the unstretched length (ft, m). */
  sag: number;
  H: number;
  T: number;
  length: number;
  /* ── change of state ── */
  state: StateForm;
  /* ── point loads ── */
  points: PointRow[];
  pointsKnown: PointsKnownField;
  /** Position of the given sag (ft, m from A), the sag there (ft, m), H, the largest tension (kip, kN). */
  sagAt: number;
  pointsSag: number;
  pointsH: number;
  pointsT: number;
  /** What the last edit has to tell the visitor. Not part of the case: never written in an address. */
  notice: CableSagNotice | null;
  /** The next point id to hand out. */
  nextId: number;
}

/* ── The cases the page opens with ────────────────────────────────────── */

/**
 * A clean textbook case for each mode (US units; `defaultCaseFor(mode, 'si')` is the same
 * case in SI, to the figures a field shows). `defaultCase()` is the hanging cable's.
 *
 * HANGING. A level 100 ft span, a 1 in steel cable, a uniform load of 100 lb/ft on
 * the horizontal (the cable's own weight left out: `weightFrom: 'none'`), a mid-span sag
 * of 10 ft. By hand: the parabola. H = qL²/8d = 0.1 × 100² / 80 = 12.5 kip; each
 * reaction qL/2 = 5 kip vertical; T_max = √(12.5² + 5²) = 13.463 kip; the cable
 * leaves each support at atan(5/12.5) = 21.80° below horizontal; its length
 * L(1 + 8/3·(d/L)² − 32/5·(d/L)⁴ …) = 100(1 + 0.026667 − 0.00064 …) = 102.60 ft;
 * the lowest point is at mid-span, 10 ft below the supports.
 *
 * STATE. A 300 ft span of 1 in 6×19 IWRC rope (14,500 ksi on 0.4139 in², weight
 * 1.7605 lb/ft: 490 lb/ft³ × 0.4139 in² × 1.25 = 1.76·d²), hanging with a 6 ft sag at
 * 60 °F, then cooled to 20 °F with 1 lb/ft of ice on it (w₂ = 2.7605 lb/ft). By hand,
 * H₁ = wL²/8d = 0.0017605 × 300² / 48 = 3.3010 kip (the exact catenary, elastic: 3.3009).
 * The textbook state equation of a level span — parabolic length s = L(1 + 8/3 r² − 32/5 r⁴),
 * r = wL/8H, the unstressed length L₀ = s₁/(1 + H₁/EA), and at state 2
 * s₂ = L₀(1 + αΔT)(1 + H₂/EA) with αΔT = 6.5e-6 × (−40) — is a cubic in H₂ whose
 * root, found independently (state.test.ts), is H₂ = 5.0873 kip. The engine's
 * exact elastic solution is H₂ = 5.0857 kip (3.2e-4 lower: the textbook takes
 * the mean tension as H and the parabola as the shape; an independent RK4 solver
 * gives 5.08566), with a sag of 6.105 ft and a largest tension of 5.102 kip.
 *
 * POINTS. A 60 ft level span carrying 10, 20 and 10 kip at 15, 30 and 45 ft, with a
 * 12 ft sag under the middle load. By hand: the reactions of the beam are 20 kip each;
 * M₀(30) = 20·30 − 10·15 = 450 kip·ft, so H = 450/12 = 37.5 kip; the ordinates are
 * 8, 12 and 8 ft below the supports (M₀(15)/H = 300/37.5 = 8); the segments run 15 ft
 * across and 8, 4, 4, 8 ft down/up: lengths 17.000, 15.524, 15.524, 17.000 ft (8-15-17),
 * tensions 37.5·17/15 = 42.50, 38.81, 38.81, 42.50 kip, total length 65.05 ft;
 * support reactions 20 kip vertical and 37.5 kip horizontal; T_max = 42.50 kip.
 */
function usBase(): CableSagForm {
  const steel = CABLE_MATERIALS.steel;
  return {
    units: 'us',
    mode: 'hanging',
    span: 100,
    rise: 0,
    material: 'steel',
    sectionBy: 'diameter',
    diameter: 1,
    area: 0.7854,
    fill: steel.fill,
    lay: steel.lay,
    E: steel.E.us,
    alpha: steel.alpha.us,
    gamma: steel.gamma.us,
    elastic: true,
    weightFrom: 'none',
    typedWeight: 1.6,
    q: 100,
    known: 'sag',
    sagKind: 'mid',
    sag: 10,
    H: 12.5,
    T: 13.5,
    length: 102.6,
    state: { q: null, ice: 1, T1: 60, T2: 20, low: 0, high: 100, step: 10, factorLow: 0, factorHigh: 3, factorRows: 7 },
    points: [
      { id: 1, x: 15, P: 10 },
      { id: 2, x: 30, P: 20 },
      { id: 3, x: 45, P: 10 },
    ],
    pointsKnown: 'sag',
    sagAt: 30,
    pointsSag: 12,
    pointsH: 37.5,
    pointsT: 42.5,
    notice: null,
    nextId: 4,
  };
}

export function defaultCaseFor(mode: CableSagMode, units: UnitSystem = 'us'): CableSagForm {
  const base = usBase();
  let form: CableSagForm;
  switch (mode) {
    case 'hanging':
      form = base;
      break;
    case 'state': {
      const rope = CABLE_MATERIALS.rope;
      form = {
        ...base,
        mode: 'state',
        span: 300,
        material: 'rope',
        fill: rope.fill,
        lay: rope.lay,
        E: rope.E.us,
        alpha: rope.alpha.us,
        gamma: rope.gamma.us,
        weightFrom: 'section',
        q: 0,
        known: 'sag',
        sag: 6,
        H: 3,
        T: 3.1,
        length: 300.3,
      };
      break;
    }
    case 'points':
      form = { ...base, mode: 'points', span: 60 };
      break;
  }
  return units === 'us' ? form : convertCableSag(form, units);
}

export function defaultCase(): CableSagForm {
  return defaultCaseFor('hanging');
}
export const defaultCableSag = defaultCase;

/* ── Units ────────────────────────────────────────────────────────────── */

/**
 * A converted number to the figures a field shows: the shortest form (up to seven figures) within 2.2e-7 of itself, else eight figures.
 * (beam/model's `tidy` stops at six, which moves a value typed to five figures on a round trip: 938.03 ft → 285.9 m → 938.02 ft.
 * Here a hop moves a number by at most 2.2e-7 of itself, two hops by 4.4e-7, less than the 5e-7 that is half the gap between two numbers
 * of five figures: so a value typed with up to FIVE significant figures comes back as typed, whichever system it was typed in.
 * Six figures are not promised.)
 */
export function tidy7(v: number): number {
  if (v === 0 || !Number.isFinite(v)) return v;
  for (let figures = 1; figures < 8; figures++) {
    const short = Number(v.toPrecision(figures));
    if (Math.abs(short - v) <= 2.2e-7 * Math.abs(v)) return short;
  }
  return Number(v.toPrecision(8));
}

/**
 * The same cable in the other unit system: every quantity as its own, to the figures
 * a field shows (`tidy7`: at most eight significant figures), and back again to the very
 * same numbers for values of up to five significant figures. A listed material takes its listed numbers in the new
 * system (29,000 ksi is 200 GPa, not 199.948). Temperatures carry their offset, a
 * temperature step and a coefficient per degree do not (ΔT is a difference).
 */
export function convertCableSag(form: CableSagForm, to: UnitSystem): CableSagForm {
  if (form.units === to) return form;
  const k = CABLE_US_TO_SI;
  const mul = (v: number, f: number): number => tidy7(v * (to === 'si' ? f : 1 / f));
  // A temperature within a ten-thousandth of a degree of zero is zero: 0 °F → −17.7778 °C → 0.00004 below 0 °F again, otherwise.
  const temp = (v: number): number => {
    const raw = to === 'si' ? (v - 32) / 1.8 : v * 1.8 + 32;
    return Math.abs(raw) < 1e-4 ? 0 : tidy7(raw);
  };
  const step = (v: number): number => tidy7(to === 'si' ? v / 1.8 : v * 1.8);
  const listed: ListedMaterial | null = form.material !== 'custom' && form.E === CABLE_MATERIALS[form.material].E[form.units] ? form.material : null;
  const s = form.state;
  return {
    ...form,
    units: to,
    span: mul(form.span, k.length),
    rise: mul(form.rise, k.length),
    diameter: mul(form.diameter, k.dim),
    area: mul(form.area, k.area),
    E: listed ? CABLE_MATERIALS[listed].E[to] : mul(form.E, k.E),
    alpha: listed ? CABLE_MATERIALS[listed].alpha[to] : to === 'si' ? tidy7(form.alpha * k.alpha) : tidy7(form.alpha / k.alpha),
    gamma: listed ? CABLE_MATERIALS[listed].gamma[to] : mul(form.gamma, k.gamma),
    typedWeight: mul(form.typedWeight, k.line),
    q: mul(form.q, k.line),
    sag: mul(form.sag, k.length),
    H: mul(form.H, k.force),
    T: mul(form.T, k.force),
    length: mul(form.length, k.length),
    state: {
      ...s,
      q: s.q === null ? null : mul(s.q, k.line),
      ice: mul(s.ice, k.line),
      T1: temp(s.T1),
      T2: temp(s.T2),
      low: temp(s.low),
      high: temp(s.high),
      step: step(s.step),
    },
    points: form.points.map((p) => ({ ...p, x: mul(p.x, k.length), P: mul(p.P, k.force) })),
    sagAt: mul(form.sagAt, k.length),
    pointsSag: mul(form.pointsSag, k.length),
    pointsH: mul(form.pointsH, k.force),
    pointsT: mul(form.pointsT, k.force),
    notice: null,
  };
}

/* ── What each edit does to the form ──────────────────────────────────── */

/**
 * Every edit. `'load'` replaces the case (an address, an example). `'reset'` is the
 * hanging example in the units on show. `'mode'` switches the mode, and with
 * `example: true` also replaces the case by that mode's example in the same
 * units. Each patch changes only the keys it names (anything else in it is ignored;
 * a value of the wrong kind is ignored). The point rows have their own three:
 * `'point-add'` (refused past 12, with `notice = { code: 'limit', … }`),
 * `'point-remove'`, `'point-patch'`.
 */
export type CableSagAction =
  | { type: 'load'; form: CableSagForm }
  | { type: 'reset' }
  | { type: 'mode'; mode: CableSagMode; example?: boolean }
  | { type: 'units'; units: UnitSystem }
  | { type: 'geometry'; patch: Partial<Pick<CableSagForm, 'span' | 'rise'>> }
  | { type: 'material'; material: MaterialId }
  | { type: 'section'; patch: Partial<Pick<CableSagForm, 'sectionBy' | 'diameter' | 'area' | 'fill' | 'lay' | 'E' | 'alpha' | 'gamma' | 'elastic'>> }
  | { type: 'loads'; patch: Partial<Pick<CableSagForm, 'weightFrom' | 'typedWeight' | 'q'>> }
  | { type: 'known'; patch: Partial<Pick<CableSagForm, 'known' | 'sagKind' | 'sag' | 'H' | 'T' | 'length'>> }
  | { type: 'state'; patch: Partial<StateForm> }
  | { type: 'points'; patch: Partial<Pick<CableSagForm, 'pointsKnown' | 'sagAt' | 'pointsSag' | 'pointsH' | 'pointsT'>> }
  | { type: 'point-add'; seed?: Partial<Pick<PointRow, 'x' | 'P'>> }
  | { type: 'point-remove'; id: number }
  | { type: 'point-patch'; id: number; patch: Partial<Pick<PointRow, 'x' | 'P'>> }
  | { type: 'dismiss' };

type Kind = 'number' | 'number-or-null' | 'boolean' | readonly string[];

/** The keys a patch may change, and what each must be. */
const SECTION_KEYS: Record<string, Kind> = { sectionBy: ['diameter', 'area'], diameter: 'number', area: 'number', fill: 'number', lay: 'number', E: 'number', alpha: 'number', gamma: 'number', elastic: 'boolean' };
const LOAD_KEYS: Record<string, Kind> = { weightFrom: ['section', 'typed', 'none'], typedWeight: 'number', q: 'number' };
const KNOWN_KEYS: Record<string, Kind> = { known: KNOWN_FIELDS, sagKind: ['mid', 'low'], sag: 'number', H: 'number', T: 'number', length: 'number' };
const STATE_KEYS: Record<string, Kind> = { q: 'number-or-null', ice: 'number', T1: 'number', T2: 'number', low: 'number', high: 'number', step: 'number', factorLow: 'number', factorHigh: 'number', factorRows: 'number' };
const POINTS_KEYS: Record<string, Kind> = { pointsKnown: POINTS_KNOWN_FIELDS, sagAt: 'number', pointsSag: 'number', pointsH: 'number', pointsT: 'number' };
const GEOMETRY_KEYS: Record<string, Kind> = { span: 'number', rise: 'number' };

function clean(patch: unknown, keys: Record<string, Kind>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  if (typeof patch !== 'object' || patch === null) return out;
  for (const [key, value] of Object.entries(patch)) {
    const kind = keys[key];
    if (kind === undefined) continue;
    if (kind === 'number' ? typeof value === 'number' : kind === 'number-or-null' ? typeof value === 'number' || value === null : kind === 'boolean' ? typeof value === 'boolean' : typeof value === 'string' && kind.includes(value)) out[key] = value;
  }
  return out;
}

/** Whether the section's numbers are those of the listed material (so a typed-over number turns it into 'custom'). */
function stillListed(form: CableSagForm): boolean {
  if (form.material === 'custom') return true;
  const p = CABLE_MATERIALS[form.material];
  return form.E === p.E[form.units] && form.alpha === p.alpha[form.units] && form.gamma === p.gamma[form.units] && form.fill === p.fill && form.lay === p.lay;
}

/**
 * Where a load added by 'Add a load' goes: a quarter of the span past the last one (kept inside 1 %…99 % of the span), as before,
 * unless a load sits there already; then the middle of the widest gap between the supports and the loads. Never a position that
 * is taken (two loads at one position are refused by the engine), whatever the loads are. A form whose span or positions are not
 * numbers gets mid-span, as it always did.
 */
function freePosition(form: CableSagForm, last: PointRow | undefined): number {
  const L = form.span;
  if (!Number.isFinite(L) || !(L > 0)) return tidy(L / 2);
  const taken = form.points.map((p) => p.x).filter((x) => Number.isFinite(x));
  const free = (x: number) => x > 0 && x < L && !taken.includes(x);
  if (last && Number.isFinite(last.x)) {
    const a = tidy(Math.min(Math.max(last.x + L / 4, L / 100), L * 0.99));
    if (free(a)) return a;
  } else if (free(tidy(L / 2))) {
    return tidy(L / 2);
  }
  const edges = [0, ...taken.filter((x) => x > 0 && x < L), L].sort((a, b) => a - b);
  let best = 0;
  let at = L / 2;
  for (let i = 0; i + 1 < edges.length; i++) {
    const gap = edges[i + 1] - edges[i];
    if (gap > best) {
      best = gap;
      at = edges[i] + gap / 2;
    }
  }
  const mid = tidy(at);
  return free(mid) ? mid : at;
}

export function reduceCableSag(form: CableSagForm, action: CableSagAction): CableSagForm {
  const next = (patch: Partial<CableSagForm>): CableSagForm => ({ ...form, notice: null, ...patch });
  switch (action.type) {
    case 'load':
      // The very form that was given when it has no notice (a decoded address, an example): the page tells "the case just opened whole" by identity.
      return action.form.notice === null ? action.form : { ...action.form, notice: null };
    case 'reset':
      return defaultCaseFor('hanging', form.units);
    case 'mode':
      if (!MODES.includes(action.mode)) return form;
      return action.example ? defaultCaseFor(action.mode, form.units) : next({ mode: action.mode });
    case 'units':
      return convertCableSag(form, action.units);
    case 'dismiss':
      return form.notice ? next({}) : form;
    case 'geometry':
      return next(clean(action.patch, GEOMETRY_KEYS) as Partial<CableSagForm>);
    case 'material': {
      if (!MATERIAL_IDS.includes(action.material)) return form;
      if (action.material === 'custom') return next({ material: 'custom' });
      const p = CABLE_MATERIALS[action.material];
      return next({ material: action.material, E: p.E[form.units], alpha: p.alpha[form.units], gamma: p.gamma[form.units], fill: p.fill, lay: p.lay });
    }
    case 'section': {
      const patch = clean(action.patch, SECTION_KEYS) as Partial<CableSagForm>;
      const merged = { ...form, ...patch };
      return next({ ...patch, ...(form.material !== 'custom' && !stillListed(merged) ? { material: 'custom' as const } : {}) });
    }
    case 'loads':
      return next(clean(action.patch, LOAD_KEYS) as Partial<CableSagForm>);
    case 'known':
      return next(clean(action.patch, KNOWN_KEYS) as Partial<CableSagForm>);
    case 'state':
      return next({ state: { ...form.state, ...(clean(action.patch, STATE_KEYS) as Partial<StateForm>) } });
    case 'points':
      return next(clean(action.patch, POINTS_KEYS) as Partial<CableSagForm>);
    case 'point-add': {
      if (form.points.length >= MAX_POINT_LOADS) return { ...form, notice: { code: 'limit', list: 'points', max: MAX_POINT_LOADS } };
      const last = form.points[form.points.length - 1];
      const seed = clean(action.seed, { x: 'number', P: 'number' }) as Partial<PointRow>;
      // A new load goes a quarter of the span past the last one (or at mid-span), with the last one's size, and never on a position that is taken.
      const x = seed.x ?? freePosition(form, last);
      const P = seed.P ?? (last && Number.isFinite(last.P) ? last.P : form.units === 'us' ? 10 : 40);
      return next({ points: [...form.points, { id: form.nextId, x, P }], nextId: form.nextId + 1 });
    }
    case 'point-remove':
      return form.points.some((p) => p.id === action.id) ? next({ points: form.points.filter((p) => p.id !== action.id) }) : form;
    case 'point-patch': {
      const patch = clean(action.patch, { x: 'number', P: 'number' });
      if (Object.keys(patch).length === 0 || !form.points.some((p) => p.id === action.id)) return form;
      return next({ points: form.points.map((p) => (p.id === action.id ? { ...p, ...patch } : p)) });
    }
  }
}

/* ── From the form to the engine ──────────────────────────────────────── */

/** Metallic area in the engine's units (ft², m²): the diameter's circle times the fill, or the area typed. NaN when the one in use is not a number. */
export function metalArea(form: CableSagForm): number {
  const k = TO_ENGINE[form.units];
  return form.sectionBy === 'diameter' ? form.fill * (Math.PI / 4) * (form.diameter * k.dim) ** 2 : form.area * k.area;
}

/** The cable's weight per length in the engine's units (kip/ft, kN/m): 0, the typed one, or unit weight × metallic area × lay. */
export function selfWeight(form: CableSagForm): number {
  const k = TO_ENGINE[form.units];
  if (form.weightFrom === 'none') return 0;
  if (form.weightFrom === 'typed') return form.typedWeight * k.line;
  return form.gamma * k.gamma * metalArea(form) * form.lay;
}

/** E × A in the engine's units (kip, kN) — or null for an inextensible cable. NaN where a number is missing (the engine says so). */
export function stiffness(form: CableSagForm): number | null {
  if (!form.elastic) return null;
  return form.E * TO_ENGINE[form.units].E * metalArea(form);
}

export interface EngineInput {
  mode: CableSagMode;
  hanging: HangingInput;
  state: StateInput;
  points: PointsInput;
  /** The cable's weight per length, EA and metallic area, as the engine has them (kip/ft, kip, ft² or kN/m, kN, m²). */
  self: number;
  EA: number | null;
  area: number;
  /** The rows of the two tables, as asked: the temperatures (°F, °C) and the load factors; empty where the table cannot be made. */
  temps: number[];
  factors: number[];
  /** Why a table cannot be made: 'table' codes (their field names which), 'number' for a field that is not a number. Not an error of the case. */
  tableIssues: CableIssue[];
  /** The id of the row behind each point load, by index. */
  rows: number[];
}

function knownOf(form: CableSagForm): Known {
  switch (form.known) {
    case 'sag':
      return { kind: form.sagKind === 'low' ? 'sag-low' : 'sag-mid', value: form.sag };
    case 'H':
      return { kind: 'H', value: form.H };
    case 'T-high':
      return { kind: 'T-high', value: form.T };
    case 'T-low':
      return { kind: 'T-low', value: form.T };
    case 'length':
      return { kind: 'length', value: form.length };
  }
}

function pointsKnownOf(form: CableSagForm): PointsKnown {
  switch (form.pointsKnown) {
    case 'sag':
      return { kind: 'sag', x: form.sagAt, value: form.pointsSag };
    case 'H':
      return { kind: 'H', value: form.pointsH };
    case 'T-max':
      return { kind: 'T-max', value: form.pointsT };
  }
}

/**
 * The inputs of all three solvers, in feet and kips or metres and kilonewtons.
 * A number that is NaN stays NaN, which the engine reports ('number', 'section').
 */
export function toEngine(form: CableSagForm): EngineInput {
  const k = TO_ENGINE[form.units];
  const self = selfWeight(form);
  const EA = stiffness(form);
  const s = form.state;
  const known = knownOf(form);
  const q1 = form.q * k.line;
  const alpha = form.alpha * k.alpha;

  // The tables.
  const tableIssues: CableIssue[] = [];
  let temps: number[] = [];
  let factors: number[] = [];
  if (![s.low, s.high, s.step].every(Number.isFinite)) tableIssues.push({ code: 'number', field: 'thermal' });
  else if (!(s.step > 0) || s.high < s.low) tableIssues.push({ code: 'table', field: 'thermal', count: 0, max: MAX_TABLE_ROWS });
  else {
    // The last row sits on the upper end when the step divides the range to six figures: a step and an end that crossed a units toggle (5.5555556 °C, 60 °C) must not lose a row to rounding.
    const ratio = (s.high - s.low) / s.step;
    // The slack is the rounding of the three numbers (eight figures each, `tidy7`) in units of the step.
    const slack = 2e-6 * ((Math.abs(s.low) + Math.abs(s.high)) / s.step + ratio) + 1e-9;
    const n = Math.floor(ratio + slack) + 1;
    if (n > MAX_TABLE_ROWS) tableIssues.push({ code: 'table', field: 'thermal', count: n, max: MAX_TABLE_ROWS });
    else temps = Array.from({ length: n }, (_, i) => (i === n - 1 && Math.abs(s.low + i * s.step - s.high) <= slack * s.step ? s.high : s.low + i * s.step));
  }
  if (![s.factorLow, s.factorHigh, s.factorRows].every(Number.isFinite)) tableIssues.push({ code: 'number', field: 'loads' });
  else if (!Number.isInteger(s.factorRows) || s.factorRows < 1 || s.factorRows > MAX_FACTOR_ROWS) tableIssues.push({ code: 'table', field: 'loads', count: s.factorRows, max: MAX_FACTOR_ROWS });
  else factors = Array.from({ length: s.factorRows }, (_, i) => (s.factorRows === 1 ? s.factorLow : s.factorLow + (i * (s.factorHigh - s.factorLow)) / (s.factorRows - 1)));

  // State 2's load per length: its own where typed, state 1's where the field is empty. What the load-factor table multiplies is
  // the part ABOVE state 1: ice + (q2 − q1). With "same as state 1" the deck load is state 1's at every factor.
  const q2 = (s.q === null ? form.q : s.q) * k.line;
  const dq = s.q === null ? 0 : q2 - q1;
  const state2 = { q: q2, w: self + s.ice * k.line };
  const hanging: HangingInput = { L: form.span, h: form.rise, q: q1, w: self, EA, known };
  const state: StateInput = {
    L: form.span,
    h: form.rise,
    EA,
    known,
    state1: { q: q1, w: self },
    state2: { ...state2, thermal: alpha * (s.T2 - s.T1) },
    sweep: {
      thermal: temps.map((t) => alpha * (t - s.T1)),
      loads: factors.map((f) => ({ q: dq === 0 ? q1 : q1 + dq * f, w: self + s.ice * k.line * f })),
    },
  };
  const points: PointsInput = { L: form.span, h: form.rise, loads: form.points.map((p) => ({ x: p.x, P: p.P })), known: pointsKnownOf(form) };
  return { mode: form.mode, hanging, state, points, self, EA, area: metalArea(form), temps, factors, tableIssues, rows: form.points.map((p) => p.id) };
}

/** The input of the form an engine issue is about, when it is about one. */
export type FormField =
  | 'span'
  | 'rise'
  | 'q'
  | 'weight'
  | 'section'
  | 'known'
  | 'thermal'
  | 'state.q'
  | 'state.ice'
  | 'state.T'
  | 'table.thermal'
  | 'table.loads'
  | 'points'
  | 'sagAt'
  | { point: number };

/**
 * Where on the form an engine issue belongs (a point load by its id). `undefined`: the
 * issue is about the case as a whole.
 */
export function issueField(issue: CableIssue, form: CableSagForm): FormField | undefined {
  switch (issue.code) {
    case 'span':
      return 'span';
    case 'rise':
      return 'rise';
    case 'section':
      return 'section';
    case 'known-value':
    case 'sag-range':
    case 'length-below-chord':
    case 'tension-below-minimum':
    case 'negative-tension':
      return 'known';
    case 'thermal':
      return 'thermal';
    case 'table':
      return issue.field === 'loads' ? 'table.loads' : 'table.thermal';
    case 'sag-position':
      return 'sagAt';
    case 'too-many-loads':
    case 'no-loads':
      return 'points';
    case 'load-position':
    case 'duplicate-position': {
      const i = issue.index ?? issue.indices?.[1];
      const row = i === undefined ? undefined : form.points[i];
      return row ? { point: row.id } : 'points';
    }
    case 'number':
      switch (issue.field) {
        case 'L':
          return 'span';
        case 'h':
          return 'rise';
        case 'q':
          return issue.state === 2 ? 'state.q' : 'q';
        case 'w':
          if (issue.state === 2) return 'state.ice';
          return form.weightFrom === 'typed' ? 'weight' : form.weightFrom === 'section' ? 'section' : undefined;
        case 'x':
        case 'P': {
          const row = issue.index === undefined ? undefined : form.points[issue.index];
          return row ? { point: row.id } : 'points';
        }
        default:
          return undefined;
      }
    default:
      return undefined;
  }
}

/* ── The case in an address ───────────────────────────────────────────── */

const VERSION = '1';

/**
 * The longest address a form can write: 12 point loads and every number at 22
 * characters (model.test.ts writes it). Every ordinary case is under 450 characters.
 */
export const MAX_LINK = 2500;

const MATERIAL_LETTER: Record<MaterialId, string> = { steel: 's', stainless: 'n', aluminum: 'a', strand: 't', rope: 'r', spiral: 'p', locked: 'k', custom: 'u' };
const MODE_LETTER: Record<CableSagMode, string> = { hanging: 'h', state: 's', points: 'p' };
const KNOWN_LETTER: Record<KnownField, string> = { sag: 's', H: 'h', 'T-high': 't', 'T-low': 'l', length: 'g' };
const POINTS_KNOWN_LETTER: Record<PointsKnownField, string> = { sag: 's', H: 'h', 'T-max': 't' };
const WEIGHT_LETTER: Record<WeightFrom, string> = { section: 's', typed: 't', none: 'n' };

/**
 * The case as a short string for the page's address (after `#g=`), so a link opens the
 * same cable. Written as the other calculators write theirs (truss/model.ts): each number
 * to the eight figures its field shows, nothing but numbers, a few letters and the separators
 * `; , _`. Nine fields after the check:
 *
 *     version ; mode,units ; span,rise ; section ; loads ; known ; state ; points ; pointsKnown
 *
 *   version      1
 *   mode,units   h | s | p  (hanging, state, points) ; us | si
 *   section      material letter (s steel, n stainless, a aluminum, t strand, r rope,
 *                p spiral, k locked coil, u the visitor's own), d | a (by diameter / by
 *                area), diameter, area, fill, lay, E, alpha, gamma, elastic (1 | 0)
 *   loads        weight from (s section, t typed, n none), typed weight, q
 *   known        s | h | t | l | g (sag, H, T high, T low, length), m | l (the sag is the
 *                mid-span one / the lowest point's), sag, H, T, length
 *   state        q (empty: the same as state 1; older links have a number), ice, T1, T2, low, high, step, factorLow, factorHigh, factorRows
 *   points       x,P  joined by _  (the rows, in the order they have; at most 12)
 *   pointsKnown  s | h | t (sag, H, T max), sagAt, sag, H, T
 *
 * A link carries no ids: the point rows are numbered again on reading. WHATEVER THE FORM
 * HOLDS IS WRITTEN and read back as that form — a number that is NaN, a mode's field
 * it does not use — so that a reload comes back to the cable that was on screen, with its
 * warning, and not to the example.
 *
 * IT BEGINS WITH A CHECK of the rest, the first calculator's (`checkOf`): a link cut short,
 * or with a character more, less or changed, is not a link to another cable.
 */
export function encodeCableSag(form: CableSagForm): string {
  const n = written;
  const s = form.state;
  const body = [
    VERSION,
    `${MODE_LETTER[form.mode]},${form.units}`,
    `${n(form.span)},${n(form.rise)}`,
    [MATERIAL_LETTER[form.material], form.sectionBy === 'diameter' ? 'd' : 'a', n(form.diameter), n(form.area), n(form.fill), n(form.lay), n(form.E), n(form.alpha), n(form.gamma), form.elastic ? '1' : '0'].join(','),
    `${WEIGHT_LETTER[form.weightFrom]},${n(form.typedWeight)},${n(form.q)}`,
    [KNOWN_LETTER[form.known], form.sagKind === 'mid' ? 'm' : 'l', n(form.sag), n(form.H), n(form.T), n(form.length)].join(','),
    // State 2's q: an EMPTY field is "the same as state 1"; a link written before that was possible has a number there, and reads as that number.
    [s.q === null ? '' : n(s.q), ...[s.ice, s.T1, s.T2, s.low, s.high, s.step, s.factorLow, s.factorHigh, s.factorRows].map(n)].join(','),
    form.points.map((p) => `${n(p.x)},${n(p.P)}`).join('_'),
    [POINTS_KNOWN_LETTER[form.pointsKnown], n(form.sagAt), n(form.pointsSag), n(form.pointsH), n(form.pointsT)].join(','),
  ].join(';');
  return `${checkOf(body)};${body}`;
}
export const encode = encodeCableSag;

/**
 * The cable a string from `encodeCableSag` describes, or `null` if it is anything else: a
 * check that is not the rest's, a version that is not 1, not nine fields, a
 * number in any notation but the page's own, a letter that means nothing, more point rows than
 * the cap, a row that is not two numbers. Never throws, whatever the string is — it comes back
 * from wherever a link was pasted.
 */
export function decodeCableSag(text: string): CableSagForm | null {
  try {
    return read(text);
  } catch {
    return null;
  }
}
export const decode = decodeCableSag;

function letterKey<T extends string>(table: Record<T, string>, letter: string | undefined): T | null {
  return (Object.keys(table) as T[]).find((key) => table[key] === letter) ?? null;
}

function read(text: string): CableSagForm | null {
  if (typeof text !== 'string' || text.length > MAX_LINK) return null;
  const body = checked(text);
  if (body === null) return null;
  const parts = body.split(';');
  if (parts.length !== 9 || parts[0] !== VERSION) return null;
  const [, modeUnits, geometry, section, loads, known, state, pointText, pointsKnown] = parts;
  let bad = false;
  const num = (s: string | undefined): number => {
    if (s === undefined) {
      bad = true;
      return 0;
    }
    const named = NAMED.get(s);
    if (named !== undefined) return named;
    const v = NUMBER.test(s) ? Number(s) : Number.NaN;
    if (!Number.isFinite(v)) bad = true;
    // As a number, a written −0 is a plain zero.
    return v + 0;
  };
  const fields = (s: string, count: number): string[] => {
    const f = s.split(',');
    if (f.length !== count) {
      bad = true;
      return Array.from({ length: count }, () => '');
    }
    return f;
  };

  const [modeLetter, units] = fields(modeUnits, 2);
  const mode = letterKey(MODE_LETTER, modeLetter);
  if (!mode || (units !== 'us' && units !== 'si')) return null;

  const [span, rise] = fields(geometry, 2);
  const sec = fields(section, 10);
  const material = letterKey(MATERIAL_LETTER, sec[0]);
  const by = sec[1] === 'd' ? 'diameter' : sec[1] === 'a' ? 'area' : null;
  if (!material || !by || (sec[9] !== '0' && sec[9] !== '1')) return null;
  const ld = fields(loads, 3);
  const weightFrom = letterKey(WEIGHT_LETTER, ld[0]);
  const kn = fields(known, 6);
  const knownField = letterKey(KNOWN_LETTER, kn[0]);
  if (!weightFrom || !knownField || (kn[1] !== 'm' && kn[1] !== 'l')) return null;
  const st = fields(state, 10);
  const pk = fields(pointsKnown, 5);
  const pointsKnownField = letterKey(POINTS_KNOWN_LETTER, pk[0]);
  if (!pointsKnownField) return null;

  let points: PointRow[] = [];
  if (pointText !== '') {
    const rows = pointText.split('_');
    if (rows.length > MAX_POINT_LOADS) return null;
    points = rows.map((r, i) => {
      const [x, P, extra] = r.split(',');
      if (extra !== undefined || P === undefined) bad = true;
      return { id: i + 1, x: num(x), P: num(P) };
    });
  }
  const form: CableSagForm = {
    units,
    mode,
    span: num(span),
    rise: num(rise),
    material,
    sectionBy: by,
    diameter: num(sec[2]),
    area: num(sec[3]),
    fill: num(sec[4]),
    lay: num(sec[5]),
    E: num(sec[6]),
    alpha: num(sec[7]),
    gamma: num(sec[8]),
    elastic: sec[9] === '1',
    weightFrom,
    typedWeight: num(ld[1]),
    q: num(ld[2]),
    known: knownField,
    sagKind: kn[1] === 'm' ? 'mid' : 'low',
    sag: num(kn[2]),
    H: num(kn[3]),
    T: num(kn[4]),
    length: num(kn[5]),
    state: { q: st[0] === '' ? null : num(st[0]), ice: num(st[1]), T1: num(st[2]), T2: num(st[3]), low: num(st[4]), high: num(st[5]), step: num(st[6]), factorLow: num(st[7]), factorHigh: num(st[8]), factorRows: num(st[9]) },
    points,
    pointsKnown: pointsKnownField,
    sagAt: num(pk[1]),
    pointsSag: num(pk[2]),
    pointsH: num(pk[3]),
    pointsT: num(pk[4]),
    notice: null,
    nextId: points.length + 1,
  };
  return bad ? null : form;
}
