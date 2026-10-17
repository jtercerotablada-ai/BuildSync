import { cableLine, cosd, sind, solveDrum, solveLoad, solvePull, validateCable } from './engine';
import { CABLE_UNITS, drumInput, engineScale, loadInput, pullInput, sectionField, sectionInput, type CableForm, type CableUnits, type EngineScale } from './model';
import type {
  CableLine,
  CableMode,
  CurvePoint,
  DrumIssueCode,
  DrumUnknown,
  LoadIssueCode,
  LoadWarningCode,
  PullIssueCode,
  PullRegimeId,
  PullRole,
  PullStatus,
  PullWarningCode,
  Side,
} from './types';

/**
 * ─────────────────────────────────────────────────────────────────────────────
 * CABLE TENSION AND ELONGATION — from the form to everything the page prints
 * ─────────────────────────────────────────────────────────────────────────────
 * This calculator's `analyse` (truss/analysis.ts is the model of this file): the
 * form as it stands goes in; out come the faults by row, and — when the mode
 * can be solved — every number of the tables and every line of the drawing,
 * ALREADY SETTLED and IN THE UNITS SHOWN. Only the mode that is open is solved.
 * A value that is rounding is zero here, once, so the table, the drawing and
 * the words for a screen reader cannot say different things. The component
 * lays it out and decides nothing about a number.
 *
 * NO WORDS. Where a word is wanted — a problem, a note, a status — this file
 * gives a STABLE MACHINE CODE and the numbers the sentence needs; strings.ts
 * (the page's, in both languages) writes the sentence. The codes:
 *
 *   issues[].code     'number' | 'range' (a field; see `row`, `min`, `max`, `minOpen`)
 *                     mode load:  'parallel-legs' 'slack-leg' 'size'
 *                     mode pull:  'size'
 *                     mode drum:  'underdetermined' (count) 'overdetermined' 'order' 'degenerate' (unknown) 'overflow'
 *                     and 'stopped': the arithmetic threw (never expected).
 *                     (types.ts lists the numbers each carries.)
 *   cableIssues[]     'number' | 'range' about the CABLE (section, length, ΔT, n, allowable) in modes pull and drum:
 *                     the mode's own numbers are still there; only the cable's block is missing (`cable: null`).
 *   warnings[].code   load: 'no-load' 'no-exact-position' 'no-second-order' 'restrained-slack'(leg) 'large-strain' 'shrinks-past-zero'(leg)
 *                     pull: 'kinetic-above-static' 'no-governing'
 *                     drum: 'no-friction' 'no-wrap' 'beyond-limit' (unknown, max)
 *   pull status       'pull' | 'slides-on-its-own' | 'stays-put' | 'self-locking' | 'leaves-surface' | 'cannot-hold' | 'no-pull-needed'  (per regime, types.ts)
 *   notes             'no-verdict': the calculator gives numbers; whether a cable is adequate is the engineer's.
 *                     'typical-values': the section presets are typical (always, when a rope or strand preset is in use,
 *                     see `typical`).
 *
 * WHAT COUNTS AS ZERO. A force under 1e-9 of the size of the problem (|W| + |H|, or W, or the larger tension)
 * is exactly 0; a stretch under 1e-9 of the larger of its two parts (an elastic stretch cancelled by a
 * thermal one) is exactly 0; a displacement under 1e-9 of the largest stretch. Never −0, never 1e-14.
 *
 * UNITS. Everything is in the units the form shows (model.ts, CABLE_UNITS): forces in lbf/kip or N/kN, stress in
 * ksi or MPa, stretches and displacements in in or mm, lengths in ft or m, areas in in² or mm², diameters in
 * in or mm, angles in degrees. The drawings are in the LENGTH unit (ft, m) for positions and in the force
 * unit for arrows.
 */

export type AnalysisIssueCode = LoadIssueCode | PullIssueCode | DrumIssueCode | 'stopped';

/** A field of the form, as an issue names it. */
export type CableRow =
  | { group: 'section' | 'leg2section'; field: 'd' | 'A' | 'factor' | 'E' | 'alpha' | 'mbf' }
  | { group: 'dT' }
  | { group: 'design'; field: 'n' | 'allowable' }
  | { group: 'load'; field: 'W' | 'H' | 'legs' }
  | { group: 'leg1' | 'leg2'; field: 'angle' | 'side' | 'length' }
  | { group: 'pull'; field: 'W' | 'theta' | 'muS' | 'muK' | 'phi' | 'accel' | 'travel' | 'length' }
  | { group: 'drum'; field: 'Tbig' | 'Tsmall' | 'mu' | 'wrap' };

export interface AnalysisIssue {
  code: AnalysisIssueCode;
  /** The field at fault, when it is one field. */
  row?: CableRow;
  /** The bounds a 'range' issue is about, in the units SHOWN (min itself is excluded when `minOpen`). Absent for a bound the engine does not set. */
  min?: number;
  max?: number;
  minOpen?: boolean;
  /** 'parallel-legs': [det]. 'slack-leg': [T1, T2] in the force unit. 'order': [Tbig, Tsmall]. 'degenerate': the same. 'overflow': [μβ]. */
  numbers?: number[];
  leg?: 1 | 2;
  /** 'underdetermined': how many are blank. 'degenerate': which one is being solved. */
  count?: number;
  unknown?: DrumUnknown;
}

export interface AnalysisWarning {
  code: LoadWarningCode | PullWarningCode | 'no-friction' | 'no-wrap' | 'beyond-limit';
  leg?: 1 | 2;
  numbers?: number[];
  /** 'beyond-limit': which quantity found is past what the form accepts, and the most it accepts (in the unit its field shows). */
  unknown?: DrumUnknown;
  max?: number;
}

/** One cable under one tension, in the units shown (types.ts, CableLine, has every formula). */
export interface CableOut {
  /** The tension (force unit). */
  T: number;
  /** The section it was solved with: area (in², mm²), modulus (ksi, GPa) and α (10⁻⁶/°F, 10⁻⁶/°C). */
  A: number;
  E: number;
  alpha: number;
  /** The cable's length (ft, m), null if not given. */
  length: number | null;
  /** The temperature change (°F, °C). */
  dT: number;
  /** σ (ksi, MPa) and ε (dimensionless). */
  stress: number;
  strain: number;
  /** Stretches in in or mm: elastic T·L/(A·E), thermal α·L·ΔT (free), their sum. Null without a length. */
  elastic: number | null;
  thermal: number | null;
  stretch: number | null;
  /** L + stretch, in the length unit (ft, m). */
  newLength: number | null;
  /** The ends held, ΔT applied: the force (force unit; tension positive: a rise gives compression) and the stress. */
  restrainedForce: number;
  restrainedStress: number;
  /** The load's tension plus that thermal force, its stress, and whether that sum is negative (the cable goes slack). */
  combinedTension: number;
  combinedStress: number;
  combinedSlack: boolean;
  /** The MBF typed (force unit); MBF / T; MBF / combined tension; n × T. Null where not given or not defined. NOT verdicts. */
  mbf: number | null;
  mbfRatio: number | null;
  mbfRatioCombined: number | null;
  requiredMbf: number | null;
  /** T / allowable stress (area unit), and the solid round diameter and the nominal rope diameter that area asks for (in, mm). */
  requiredArea: number | null;
  requiredDiameter: number | null;
  requiredNominalDiameter: number | null;
}

export interface Arrow {
  /** What it is: the cable's tension, the weight, the normal force, the friction force; H is the horizontal force of the sling. */
  id: 'T' | 'W' | 'H' | 'N' | 'F';
  /** Components in the drawing's frame (x right, y up), force unit. */
  fx: number;
  fy: number;
  magnitude: number;
  /** The unit vector it points along. */
  dx: number;
  dy: number;
  /** Magnitude over the largest in its drawing, 0 to 1: for the length of its shaft. */
  share: number;
}

/* ── Mode 1 ────────────────────────────────────────────────────────────── */

export interface LegLine extends CableOut {
  label: 1 | 2;
  /** Degrees from the horizontal and the side. For one leg these are what equilibrium gave. */
  angle: number;
  side: Side;
  /** Unit vector to the anchor, and the anchor's position relative to the load point (length unit). */
  ux: number;
  uy: number;
  anchorX: number;
  anchorY: number;
  /** T over the larger tension of the sling, 0 to 1. */
  share: number;
}

export interface MoveLine {
  /** In in or mm. */
  dx: number;
  dy: number;
  magnitude: number;
}

export interface SecondOrderLine {
  T1: number;
  T2: number;
  angle1: number;
  angle2: number;
  /** Fractions: 0.01 is 1 %. */
  change1: number;
  change2: number;
  move: MoveLine;
  iterations: number;
}

export interface LoadResults {
  legs: LegLine[];
  /**
   * The move of the load point. `linear` is the first-order (standard hand) value; `exact` is the intersection of
   * the two circles of the stretched legs (EXACT GEOMETRY for those stretches), null when they do not meet.
   * `difference` is |exact − linear| (in or mm).
   */
  move: { linear: MoveLine; exact: MoveLine | null; difference: number | null };
  /** The tensions recomputed in the displaced geometry; null for one leg and when it did not converge. */
  secondOrder: SecondOrderLine | null;
  applied: { W: number; H: number };
  /** The resultant of the loads and the tensions: zero (it is the check on show). */
  residual: number;
  balanced: boolean;
  /** Any of the legs has a thermal change: ΔT ≠ 0. */
  thermal: boolean;
  /** Largest strain; the page may say first-order results are least reliable above 1 % (warning 'large-strain'). */
  maxStrain: number;
}

export interface SlingDrawing {
  /** The load point at the origin; the anchors at (±, +) in the length unit (ft, m). */
  load: { x: number; y: number };
  anchors: { leg: 1 | 2; x: number; y: number; tension: number; angle: number; side: Side }[];
  /** The loads: W down, H along x (force unit) as arrows from the load point. */
  arrows: Arrow[];
  /** Where the load point settles (length unit): exact, else linear. Null when there is no move. */
  displaced: { x: number; y: number } | null;
  /** What to multiply the move by to DRAW it so that it is an eighth of the sling's larger side. Null: nothing to draw. */
  moveScale: number | null;
  box: { x0: number; y0: number; x1: number; y1: number; width: number; height: number };
}

/* ── Mode 2 ────────────────────────────────────────────────────────────── */

export interface RegimeLine {
  id: PullRegimeId;
  status: PullStatus;
  /** What a 'pull' tension does: drives the block (along), holds it back (against) or releases it (against, a cable that lifts it off its friction). Null for any other status. */
  role: PullRole | null;
  /** The coefficient used, the acceleration over g and the acceleration in the unit shown (ft/s², m/s²; 0 for start and run). */
  mu: number;
  aOverG: number;
  a: number;
  /** Force unit. T, N, F, lift, drag: null as in types.ts. */
  T: number | null;
  rawT: number | null;
  N: number | null;
  F: number | null;
  lift: number | null;
  drag: number | null;
  weightAlong: number;
  weightNormal: number;
  inertia: number;
  /** The best cable angle (degrees from the surface) and what happens there. */
  optimum: { phi: number; T: number | null; N: number | null; closedForm: number; valid: boolean; status: PullStatus; best: { phi: number; T: number; N: number; atLiftOff: boolean } | null };
  phiLift: number | null;
  liftTension: number | null;
  hold: { T: number; N: number } | null;
  /** The cable under this regime's tension (stress, stretch…); null without a 'pull' status or when the cable is incomplete (`cableIssues`). */
  cable: CableOut | null;
  /**
   * The free-body arrows (T, W, N, F and nothing else) in the drawing's frame: x right, y up, the surface at θ. W always; T, N, F for status
   * 'pull'. A block that slides by itself has, in place of the cable's pull, the HOLD-BACK cable (`hold`: T, N, F on the way it is held); a case
   * with no pull to be told ('no-pull-needed') has N and F.
   */
  arrows: Arrow[];
  /** True when the arrows T, N, F are those of the holding cable of `hold` and not a cable that pulls the block along. */
  holdDrawn: boolean;
  /** The direction of travel and the acceleration, for the drawing: the unit vector of the travel in the drawing's frame, and a (ft/s², m/s²; 0 at constant speed). */
  travelDir: { dx: number; dy: number };
}

export interface CurveLine {
  regime: PullRegimeId;
  points: CurvePoint[];
  /** The least valid tension on the grid, as an index into `points`; null if none. */
  minIndex: number | null;
  /** The least tension the block allows (types.ts, PullBest): at φ* when the block stays down there, else at lift-off. Null when no angle pulls it. */
  optimum: { phi: number; T: number; atLiftOff: boolean } | null;
  /** Largest valid T, and the top of a sensible plot (the larger of 3 × the least and... capped at the largest valid). Null when no point is valid. */
  maxValid: number | null;
  plotMax: number | null;
}

export interface PullResults {
  regimes: RegimeLine[];
  curves: CurveLine[];
  governing: PullRegimeId | null;
  /** The surface: angle θ (degrees), unit vector along it and its normal, in the drawing's frame. */
  surface: { theta: number; sx: number; sy: number; nx: number; ny: number };
  /** The drawing's cable angle from the horizontal, θ + φ (degrees), and φ. */
  cableAngle: number;
  phi: number;
  travel: 'along' | 'against';
  /** The weight in the force unit (a mass is brought to its weight). */
  W: number;
  /** The mass, when it can be told: W / g in lb or kg. */
  mass: number;
}

/* ── Mode 3 ────────────────────────────────────────────────────────────── */

export interface DrumResults {
  /** Which of the four was blank. */
  solved: DrumUnknown;
  Tbig: number;
  Tsmall: number;
  mu: number;
  /** The wrap in degrees, turns and radians. */
  betaDeg: number;
  turns: number;
  betaRad: number;
  /** e^(μβ) = Tbig / Tsmall, the exponent μβ, and Tsmall / Tbig (the share of the load a person holds). */
  ratio: number;
  exponent: number;
  holdShare: number;
  /** The force the drum feels (force unit), its components and direction (degrees ccw from +x in the drum frame of types.ts). */
  resultant: { magnitude: number; x: number; y: number; angle: number };
  /** The cable at Tbig (stress, MBF ratio…); no length, so no stretch. Null when the cable is incomplete (`cableIssues`). */
  cable: CableOut | null;
}

export interface DrumDrawing {
  /** The drum has radius 1 and its centre at the origin. The wrap runs counter-clockwise from 0 to `wrap` degrees (more than 360 = more than a turn). */
  wrap: number;
  turns: number;
  /** Where Tbig leaves (angle 0) and Tsmall leaves (angle wrap mod 360), as points on the circle. */
  bigPoint: { x: number; y: number };
  smallPoint: { x: number; y: number };
  /** The tension arrows on the drum (force unit), with the resultant. */
  arrows: { id: 'big' | 'small' | 'resultant'; fx: number; fy: number; magnitude: number; dx: number; dy: number; share: number }[];
}

/* ── The analysis ─────────────────────────────────────────────────────── */

export interface CableAnalysis {
  units: CableUnits;
  mode: CableMode;
  /** Faults that stop the mode's solution, each once. Empty: solved. */
  issues: AnalysisIssue[];
  /** About the cable of modes pull and drum, which can be missing while the mode is solved. */
  cableIssues: AnalysisIssue[];
  warnings: AnalysisWarning[];
  /** Whether a rope/strand/aluminium preset is in use: its numbers are typical and the manufacturer's must be used. */
  typical: boolean;
  /** Null when the mode is not solved (and for the other modes). */
  load: LoadResults | null;
  pull: PullResults | null;
  drum: DrumResults | null;
  drawing: { sling: SlingDrawing | null; drum: DrumDrawing | null };
}

const clean = (v: number): number => (v === 0 ? 0 : v);
const settle = (v: number, floor: number): number => (Math.abs(v) <= floor ? 0 : clean(v));
const opt = (v: number | null, f: (x: number) => number): number | null => (v === null ? null : f(v));

function cableOut(line: CableLine, k: EngineScale, floor: number): CableOut {
  const stretchFloor = 1e-9 * Math.max(Math.abs(line.elastic ?? 0), Math.abs(line.thermal ?? 0));
  const stress = (v: number) => clean(v / k.stress);
  const force = (v: number) => settle(v / k.force, floor);
  return {
    T: force(line.T),
    A: line.A / k.area,
    E: line.E / k.E,
    alpha: line.alpha / k.alpha,
    length: opt(line.length, (v) => v / k.length),
    dT: line.dT / k.dT,
    stress: stress(line.stress),
    strain: clean(line.strain),
    elastic: opt(line.elastic, (v) => settle(v / k.stretch, stretchFloor / k.stretch)),
    thermal: opt(line.thermal, (v) => settle(v / k.stretch, stretchFloor / k.stretch)),
    stretch: opt(line.stretch, (v) => settle(v / k.stretch, stretchFloor / k.stretch)),
    newLength: opt(line.newLength, (v) => v / k.length),
    restrainedForce: force(line.restrainedForce),
    restrainedStress: stress(line.restrainedStress),
    combinedTension: force(line.combinedTension),
    combinedStress: stress(line.combinedStress),
    combinedSlack: line.combinedSlack && force(line.combinedTension) < 0,
    mbf: opt(line.mbf, (v) => v / k.force),
    mbfRatio: line.mbfRatio,
    mbfRatioCombined: line.mbfRatioCombined,
    requiredMbf: opt(line.requiredMbf, (v) => v / k.force),
    requiredArea: opt(line.requiredArea, (v) => v / k.area),
    requiredDiameter: opt(line.requiredDiameter, (v) => v / k.dia),
    requiredNominalDiameter: opt(line.requiredNominalDiameter, (v) => v / k.dia),
  };
}

/** Where an engine field is on the form. */
function rowOf(form: CableForm, mode: CableMode, field: string | undefined, leg?: 1 | 2): CableRow | undefined {
  if (!field) return undefined;
  const sectionGroup = leg === 2 && form.load.own2 ? 'leg2section' : 'section';
  const s = leg === 2 && form.load.own2 ? form.load.own2 : form.section;
  const sec = sectionField(s, field);
  if (sec && ['A', 'E', 'alpha', 'mbf', 'factor'].includes(field)) return { group: sectionGroup, field: sec };
  switch (field) {
    case 'dT':
      return { group: 'dT' };
    case 'n':
    case 'allowable':
      return { group: 'design', field };
    case 'legs':
      return { group: 'load', field: 'legs' };
    case 'angle':
    case 'side':
    case 'length':
      return mode === 'load' ? { group: leg === 2 ? 'leg2' : 'leg1', field } : mode === 'pull' && field === 'length' ? { group: 'pull', field: 'length' } : undefined;
    case 'W':
    case 'H':
      return mode === 'load' ? { group: 'load', field } : { group: 'pull', field: 'W' };
    case 'theta':
    case 'muS':
    case 'muK':
    case 'phi':
    case 'travel':
      return { group: 'pull', field };
    case 'aOverG':
      return { group: 'pull', field: 'accel' };
    case 'Tbig':
    case 'Tsmall':
    case 'mu':
      return { group: 'drum', field };
    case 'beta':
      return { group: 'drum', field: 'wrap' };
    default:
      return undefined;
  }
}

/** The bounds of a range issue in the units shown. */
function boundsOf(form: CableForm, k: EngineScale, field: string | undefined, b: { min?: number; max?: number }): { min?: number; max?: number } {
  const f: Record<string, number> = { W: k.force, H: k.force, mbf: k.force, length: k.length, E: k.E, alpha: k.alpha, allowable: k.stress, A: k.area, aOverG: k.accel };
  const mass = field === 'W' && form.mode === 'pull' && form.pull.massInput;
  const div = mass ? k.mass : field !== undefined ? (f[field] ?? 1) : 1;
  const wrap = field === 'beta' ? (form.drum.wrapUnit === 'deg' ? Math.PI / 180 : 2 * Math.PI) : 1;
  const d = div * wrap;
  return { ...(b.min !== undefined ? { min: b.min / d } : {}), ...(b.max !== undefined ? { max: b.max / d } : {}) };
}

function issueOf(form: CableForm, k: EngineScale, mode: CableMode, i: { code: string; field?: string; leg?: 1 | 2; min?: number; max?: number; minOpen?: boolean; numbers?: number[]; count?: number }): AnalysisIssue {
  const out: AnalysisIssue = { code: i.code as AnalysisIssueCode };
  const row = rowOf(form, mode, i.field, i.leg);
  if (row) out.row = row;
  if (i.leg) out.leg = i.leg;
  if (i.code === 'range') {
    Object.assign(out, boundsOf(form, k, i.field, i));
    if (i.minOpen) out.minOpen = true;
  }
  if (i.count !== undefined) out.count = i.count;
  if (i.numbers) {
    out.numbers = i.code === 'slack-leg' || i.code === 'order' || i.code === 'degenerate' ? i.numbers.map((v) => (i.code === 'slack-leg' || mode !== 'load' ? v / k.force : v)) : i.numbers;
    if (i.code === 'degenerate') out.numbers = i.numbers.map((v) => v / k.force);
  }
  if (i.code === 'degenerate' && i.field) out.unknown = i.field as DrumUnknown;
  return out;
}

const arrowOf = (id: Arrow['id'], fx: number, fy: number): Arrow => {
  const magnitude = Math.hypot(fx, fy);
  return { id, fx: clean(fx), fy: clean(fy), magnitude, dx: magnitude === 0 ? 0 : clean(fx / magnitude), dy: magnitude === 0 ? 0 : clean(fy / magnitude), share: 0 };
};
const shared = (list: Arrow[]): Arrow[] => {
  const top = Math.max(0, ...list.map((a) => a.magnitude));
  return list.map((a) => ({ ...a, share: top === 0 ? 0 : a.magnitude / top }));
};

const typicalOf = (form: CableForm): boolean => {
  const typ = (s: CableForm['section']) => s.rope !== 'solid' || ['aluminum', 'rope', 'rope-fibre', 'rope-spiral', 'strand7', 'custom'].includes(s.material);
  return typ(form.section) || (form.load.own2 !== null && form.mode === 'load' && form.load.legs === 2 && typ(form.load.own2));
};

export function analyseCable(form: CableForm): CableAnalysis {
  const units = CABLE_UNITS[form.units];
  const k = engineScale(form.units, form.forceUnit);
  const base: CableAnalysis = { units, mode: form.mode, issues: [], cableIssues: [], warnings: [], typical: typicalOf(form), load: null, pull: null, drum: null, drawing: { sling: null, drum: null } };
  if (form.mode === 'load') return { ...base, ...loadAnalysis(form, k) };
  if (form.mode === 'pull') return { ...base, ...pullAnalysis(form, k) };
  return { ...base, ...drumAnalysis(form, k) };
}

/** The cable's own faults (modes pull and drum). */
function cableFaults(form: CableForm, k: EngineScale, mode: CableMode, length: number | null): AnalysisIssue[] {
  const sec = sectionInput(form.section, form);
  return validateCable(sec, length === null ? null : length * k.length, form.dT * k.dT, form.n, form.allowable === null ? null : form.allowable * k.stress).map((i) => issueOf(form, k, mode, i));
}

/* ── Mode 1 ───────────────────────────────────────────────────────────── */

function loadAnalysis(form: CableForm, k: EngineScale): Partial<CableAnalysis> {
  const input = loadInput(form);
  const out = solveLoad(input);
  if (!out.ok) return { issues: out.issues.map((i) => issueOf(form, k, 'load', i)) };
  const scale = out.scale;
  const tFloor = 1e-9 * scale;
  const topT = Math.max(...out.legs.map((l) => l.line.T));
  const legs: LegLine[] = out.legs.map((l, i) => {
    const settledT = Math.abs(l.line.T) <= tFloor ? 0 : l.line.T;
    const line = cableLine({ T: settledT, section: input.legs[i].section, length: input.legs[i].length, dT: input.dT, n: input.n, allowable: input.allowable });
    return {
      label: l.leg,
      angle: l.angle,
      side: l.side,
      ux: clean(l.ux),
      uy: l.uy,
      anchorX: clean(l.anchorX / k.length),
      anchorY: clean(l.anchorY / k.length),
      share: topT > 0 ? settledT / topT : 0,
      ...cableOut(line, k, tFloor / k.force),
    };
  });
  const stretches = out.legs.map((l) => Math.max(Math.abs(l.line.elastic ?? 0), Math.abs(l.line.thermal ?? 0)));
  const moveFloor = 1e-9 * Math.max(0, ...stretches);
  const move = (m: { dx: number; dy: number; magnitude: number }): MoveLine => {
    const dx = settle(m.dx, moveFloor);
    const dy = settle(m.dy, moveFloor);
    return { dx: dx / k.stretch, dy: dy / k.stretch, magnitude: Math.hypot(dx, dy) / k.stretch };
  };
  const linear = move(out.displacement.linear);
  const exact = out.displacement.exact ? move(out.displacement.exact) : null;
  const so = out.secondOrder;
  const secondOrder: SecondOrderLine | null = so
    ? {
        T1: settle(so.T1, tFloor) / k.force,
        T2: settle(so.T2, tFloor) / k.force,
        angle1: so.angle1,
        angle2: so.angle2,
        change1: so.change1,
        change2: so.change2,
        move: move(so.displacement),
        iterations: so.iterations,
      }
    : null;
  // The rounding of the larger tension (a leg almost flat carries a huge one) is not an imbalance either.
  const residual = settle(out.residual, Math.max(tFloor, 1e-11 * topT)) / k.force;
  const maxStrain = Math.max(...legs.map((l) => Math.abs(l.strain)));
  const load: LoadResults = {
    legs,
    move: { linear, exact, difference: out.displacement.exactMinusLinear === null || !exact ? null : Math.abs(Math.hypot(exact.dx - linear.dx, exact.dy - linear.dy)) < 1e-12 * Math.max(1, linear.magnitude) ? 0 : Math.hypot(exact.dx - linear.dx, exact.dy - linear.dy) },
    secondOrder,
    applied: { W: input.W / k.force, H: input.H / k.force },
    residual,
    balanced: residual === 0,
    thermal: input.dT !== 0,
    maxStrain,
  };

  // The drawing, in the length unit.
  const lenOf = (v: number) => v / k.length;
  const shownMove = exact ?? linear;
  const sizeX = Math.max(...legs.map((l) => Math.abs(l.anchorX)), 0);
  const sizeY = Math.max(...legs.map((l) => l.anchorY), 0);
  const side = Math.max(sizeX * 2, sizeY);
  const moveLen = lenOf(shownMove.magnitude * k.stretch);
  // Never drawn smaller than it is: a move that is already an eighth of the sling or more is drawn to scale (1).
  const moveScale = moveLen > 0 && side > 0 ? Math.max(1, side / 8 / moveLen) : null;
  const arrows = shared([...(load.applied.W !== 0 ? [arrowOf('W', 0, -load.applied.W)] : []), ...(load.applied.H !== 0 ? [arrowOf('H', load.applied.H, 0)] : [])]);
  const xs = [0, ...legs.map((l) => l.anchorX)];
  const ys = [0, ...legs.map((l) => l.anchorY)];
  const x0 = Math.min(...xs);
  const x1 = Math.max(...xs);
  const y0 = Math.min(...ys);
  const y1 = Math.max(...ys);
  const sling: SlingDrawing = {
    load: { x: 0, y: 0 },
    anchors: legs.map((l) => ({ leg: l.label, x: l.anchorX, y: l.anchorY, tension: l.T, angle: l.angle, side: l.side })),
    arrows,
    displaced: moveLen > 0 ? { x: lenOf(shownMove.dx * k.stretch), y: lenOf(shownMove.dy * k.stretch) } : null,
    moveScale,
    box: { x0, y0, x1, y1, width: x1 - x0, height: y1 - y0 },
  };
  return { load, warnings: out.warnings.map((w) => ({ code: w.code, ...(w.leg ? { leg: w.leg } : {}), ...(w.numbers ? { numbers: w.numbers } : {}) })), drawing: { sling, drum: null } };
}

/* ── Mode 2 ───────────────────────────────────────────────────────────── */

function pullAnalysis(form: CableForm, k: EngineScale): Partial<CableAnalysis> {
  const input = pullInput(form);
  const out = solvePull(input);
  if (!out.ok) return { issues: out.issues.map((i) => issueOf(form, k, 'pull', i)) };
  const W = input.W / k.force;
  const floor = 1e-12 * input.W;
  const cableIssues = cableFaults(form, k, 'pull', form.pull.length);
  const section = sectionInput(form.section, form);
  const lengthEngine = form.pull.length * k.length;

  const regimes: RegimeLine[] = out.regimes.map((r) => {
    const T = r.T === null ? null : settle(r.T, floor);
    const N = r.N === null ? null : settle(r.N, floor);
    const sigma = form.pull.travel === 'along' ? 1 : -1;
    const th = form.pull.theta;
    const phi = form.pull.phi;
    const sx = cosd(th);
    const sy = sind(th);
    const nx = -sy;
    const ny = sx;
    // The forces to draw. A cable that pulls the block: T along θ + φ. A block that slides by itself: the cable that HOLDS it back, pulling the
    // other way (−s) at φ above the surface, with the normal force and the friction that go with it. A case that needs no pull: N and F alone.
    const hold = r.status === 'slides-on-its-own' && r.hold ? r.hold : null;
    const drawn = T !== null && N !== null ? { T, N, F: r.F === null ? 0 : settle(r.F, floor), dir: [cosd(th + phi), sind(th + phi)] as [number, number], fdir: -sigma }
      : hold ? { T: hold.T, N: settle(hold.N, floor), F: settle(r.mu * hold.N, floor), dir: [-cosd(phi) * sx + sind(phi) * nx, -cosd(phi) * sy + sind(phi) * ny] as [number, number], fdir: -1 }
      : r.status === 'no-pull-needed' && r.N !== null ? { T: 0, N: settle(r.N, floor), F: r.F === null ? 0 : settle(r.F, floor), dir: [0, 0] as [number, number], fdir: -sigma }
      : null;
    const inForce = shared(
      [
        ...(drawn
          ? [
              arrowOf('T', (drawn.T * drawn.dir[0]) / k.force, (drawn.T * drawn.dir[1]) / k.force),
              arrowOf('N', (drawn.N * nx) / k.force, (drawn.N * ny) / k.force),
              arrowOf('F', (drawn.fdir * drawn.F * sx) / k.force, (drawn.fdir * drawn.F * sy) / k.force),
            ]
          : []),
        arrowOf('W', 0, -W),
      ].filter((a) => a.magnitude > 0 || a.id === 'W'),
    );
    const cable = T !== null && cableIssues.length === 0 ? cableOut(cableLine({ T, section, length: lengthEngine, dT: form.dT * k.dT, n: form.n, allowable: form.allowable === null ? null : form.allowable * k.stress }), k, floor / k.force) : null;
    const best = r.optimum.best;
    return {
      id: r.id,
      status: r.status,
      role: r.role,
      mu: r.mu,
      aOverG: r.aOverG,
      a: r.aOverG / k.accel,
      T: opt(T, (v) => v / k.force),
      rawT: opt(r.rawT, (v) => v / k.force),
      N: opt(N, (v) => v / k.force),
      F: r.F === null ? null : settle(r.F, floor) / k.force,
      lift: r.lift === null ? null : settle(r.lift, floor) / k.force,
      drag: r.drag === null ? null : settle(r.drag, floor) / k.force,
      weightAlong: settle(r.weightAlong, floor) / k.force,
      weightNormal: settle(r.weightNormal, floor) / k.force,
      inertia: settle(r.inertia, floor) / k.force,
      optimum: {
        phi: clean(r.optimum.phi),
        T: opt(r.optimum.T, (v) => v / k.force),
        N: r.optimum.N === null ? null : settle(r.optimum.N, floor) / k.force,
        closedForm: settle(r.optimum.closedForm, floor) / k.force,
        valid: r.optimum.valid,
        status: r.optimum.status,
        best: best ? { phi: clean(best.phi), T: best.T / k.force, N: settle(best.N, floor) / k.force, atLiftOff: best.atLiftOff } : null,
      },
      phiLift: r.phiLift,
      liftTension: opt(r.liftTension, (v) => v / k.force),
      hold: r.hold ? { T: r.hold.T / k.force, N: settle(r.hold.N, floor) / k.force } : null,
      cable,
      arrows: inForce,
      holdDrawn: hold !== null,
      travelDir: { dx: clean(sigma * sx), dy: clean(sigma * sy) },
    };
  });

  const curves: CurveLine[] = out.curves.map((c) => {
    const points = c.points.map((p) => ({ ...p, T: opt(p.T, (v) => v / k.force), N: p.N === null ? null : settle(p.N, floor) / k.force }));
    const valid = points.filter((p) => p.valid && p.T !== null).map((p) => p.T as number);
    const r = regimes.find((x) => x.id === c.regime) as RegimeLine;
    const least = valid.length ? Math.min(...valid) : null;
    const most = valid.length ? Math.max(...valid) : null;
    const best = r.optimum.best;
    return {
      regime: c.regime,
      points,
      minIndex: c.minIndex,
      optimum: best ? { phi: best.phi, T: best.T, atLiftOff: best.atLiftOff } : null,
      maxValid: most,
      plotMax: least === null || most === null ? null : Math.min(most, 4 * Math.max(least, 1e-300)),
    };
  });

  const theta = form.pull.theta;
  const pull: PullResults = {
    regimes,
    curves,
    governing: out.governing,
    surface: { theta, sx: clean(out.surface.sx), sy: clean(out.surface.sy), nx: clean(out.surface.nx), ny: clean(out.surface.ny) },
    cableAngle: theta + form.pull.phi,
    phi: form.pull.phi,
    travel: form.pull.travel,
    W,
    mass: (W * k.force) / k.mass,
  };
  return { pull, cableIssues, warnings: out.warnings.map((w) => ({ code: w.code, ...(w.numbers ? { numbers: w.numbers } : {}) })) };
}

/* ── Mode 3 ───────────────────────────────────────────────────────────── */

function drumAnalysis(form: CableForm, k: EngineScale): Partial<CableAnalysis> {
  const out = solveDrum(drumInput(form));
  if (!out.ok) return { issues: out.issues.map((i) => issueOf(form, k, 'drum', i)) };
  const cableIssues = cableFaults(form, k, 'drum', null);
  const big = out.Tbig;
  const floor = 1e-9 * Math.max(big, out.Tsmall);
  const betaDeg = (out.beta * 180) / Math.PI;
  const rx = settle(out.resultantX, floor);
  const ry = settle(out.resultantY, floor);
  const R = Math.hypot(rx, ry);
  const cable = cableIssues.length === 0 ? cableOut(cableLine({ T: big, section: sectionInput(form.section, form), length: null, dT: form.dT * k.dT, n: form.n, allowable: form.allowable === null ? null : form.allowable * k.stress }), k, floor / k.force) : null;
  const drum: DrumResults = {
    solved: out.solved,
    Tbig: out.Tbig / k.force,
    Tsmall: out.Tsmall / k.force,
    mu: out.mu,
    betaDeg: clean(betaDeg),
    turns: out.beta / (2 * Math.PI),
    betaRad: out.beta,
    ratio: out.ratio,
    exponent: out.exponent,
    holdShare: out.Tsmall / out.Tbig,
    resultant: { magnitude: R / k.force, x: rx / k.force, y: ry / k.force, angle: R === 0 ? 0 : Math.atan2(ry, rx) / (Math.PI / 180) },
    cable,
  };
  const wrapMod = ((betaDeg % 360) + 360) % 360;
  const bx = (-out.Tsmall * sind(betaDeg)) / k.force;
  const by = (-out.Tbig + out.Tsmall * cosd(betaDeg)) / k.force;
  const mk = (id: 'big' | 'small' | 'resultant', fx: number, fy: number) => {
    const a = arrowOf('T', fx, fy);
    return { id, fx: a.fx, fy: a.fy, magnitude: a.magnitude, dx: a.dx, dy: a.dy, share: 0 };
  };
  const arrows = [mk('big', 0, -drum.Tbig), mk('small', -drum.Tsmall * sind(betaDeg), drum.Tsmall * cosd(betaDeg)), mk('resultant', settle(bx, floor / k.force), settle(by, floor / k.force))];
  const top = Math.max(...arrows.map((a) => a.magnitude));
  const drawing: DrumDrawing = {
    wrap: drum.betaDeg,
    turns: drum.turns,
    bigPoint: { x: 1, y: 0 },
    smallPoint: { x: clean(cosd(wrapMod)), y: clean(sind(wrapMod)) },
    arrows: arrows.map((a) => ({ ...a, share: top === 0 ? 0 : a.magnitude / top })),
  };
  return {
    drum,
    cableIssues,
    warnings: out.warnings.map((w) => {
      const unit = form.drum.wrapUnit === 'deg' ? Math.PI / 180 : 2 * Math.PI;
      return {
        code: w.code,
        ...(w.field ? { unknown: w.field, numbers: [w.field === 'beta' ? out.beta / unit : out.mu] } : {}),
        ...(w.max !== undefined ? { max: w.field === 'beta' ? w.max / unit : w.max } : {}),
      };
    }),
    drawing: { sling: null, drum: drawing },
  };
}

/**
 * `analyseCable`, which nothing it is given can make throw. If anything in the
 * arithmetic did, the page would be a blank box — so it is caught here and said
 * as 'stopped'.
 */
export function analyseSafely(form: CableForm): CableAnalysis {
  try {
    return analyseCable(form);
  } catch {
    const mode = form && (form.mode === 'pull' || form.mode === 'drum' || form.mode === 'load') ? form.mode : 'load';
    return {
      units: CABLE_UNITS[form?.units === 'si' ? 'si' : 'us'],
      mode,
      issues: [{ code: 'stopped' }],
      cableIssues: [],
      warnings: [],
      typical: false,
      load: null,
      pull: null,
      drum: null,
      drawing: { sling: null, drum: null },
    };
  }
}
