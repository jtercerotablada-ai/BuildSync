import { fieldNumber } from '../format';
import { beamSpans, solveBeam, type BeamIssueCode, type BeamModel, type BeamSolution, type BeamSpan, type SupportKind } from './solver';

/**
 * ─────────────────────────────────────────────────────────────────────────────
 * BEAM CALCULATOR — what the visitor edits, and what is worked out from it
 * ─────────────────────────────────────────────────────────────────────────────
 * Between the form (BeamCalculator.tsx) and the engine (solver.ts). Pure
 * functions, no React: the beam as entered (`BeamForm`), the two unit
 * systems, the section and its stiffness, the checks a form needs before the
 * engine is asked, and the address that carries a beam from one engineer to
 * another.
 *
 * UNITS. The form holds numbers in the units it SHOWS (feet and kips, or
 * metres and kilonewtons — `UNITS`). The engine takes any consistent set, so
 * it is given exactly those; only the section is in smaller units (inches or
 * millimetres) and is brought to them here, in one place: `stiffness`,
 * `deflectionFactor`, `bendingStress`, `shearStress`.
 */

export type UnitSystem = 'us' | 'si';

export const UNITS: Record<
  UnitSystem,
  { length: string; force: string; line: string; moment: string; E: string; I: string; S: string; A: string; dim: string; deflection: string; stress: string; weight: string }
> = {
  us: { length: 'ft', force: 'kip', line: 'kip/ft', moment: 'kip·ft', E: 'ksi', I: 'in⁴', S: 'in³', A: 'in²', dim: 'in', deflection: 'in', stress: 'ksi', weight: 'lb/ft' },
  si: { length: 'm', force: 'kN', line: 'kN/m', moment: 'kN·m', E: 'MPa', I: '10⁶ mm⁴', S: '10³ mm³', A: 'mm²', dim: 'mm', deflection: 'mm', stress: 'MPa', weight: 'kg/m' },
};

/** One US unit in SI units, per quantity (exact definitions: 1 ft = 0.3048 m, 1 lbf = 4.4482216152605 N). */
const FT = 0.3048;
const KIP = 4.4482216152605;
const IN = 25.4;
export const US_TO_SI = {
  length: FT,
  force: KIP,
  line: KIP / FT,
  moment: KIP * FT,
  E: (KIP * 1000) / (IN * IN), // ksi → MPa
  I: IN ** 4 / 1e6, // in⁴ → 10⁶ mm⁴
  S: IN ** 3 / 1e3, // in³ → 10³ mm³
  A: IN * IN, // in² → mm²
  dim: IN,
} as const;

export type Direction = 'down' | 'up';
export type Rotation = 'ccw' | 'cw';
export type SectionMode = 'props' | 'rect' | 'shape';
export type MaterialKey = 'steel' | 'aluminum' | 'concrete' | 'wood' | 'custom';

export interface BeamForm {
  units: UnitSystem;
  L: number;
  supports: { id: number; kind: SupportKind; x: number }[];
  hinges: { id: number; x: number }[];
  points: { id: number; x: number; P: number; dir: Direction }[];
  dists: { id: number; x1: number; x2: number; w1: number; w2: number; dir: Direction }[];
  couples: { id: number; x: number; M: number; dir: Rotation }[];
  section: {
    mode: SectionMode;
    material: MaterialKey;
    /** Modulus of elasticity (ksi / MPa). */
    E: number;
    /** 'props': moment of inertia, section modulus and shear area; zero = not given. */
    I: number;
    S: number;
    Av: number;
    /** 'rect': width and depth (in / mm). */
    b: number;
    h: number;
    /** 'shape': AISC designation, and whether the beam's own weight is a load. */
    shape: string;
    selfWeight: boolean;
  };
  /** The next id to hand out: ids only ever grow, so a removed row's is never reused. */
  nextId: number;
}

export const MAX_ROWS = 12;

/**
 * Moduli of elasticity offered as a starting point (ksi, MPa). Steel: AISC
 * 360. Aluminum: Aluminum Design Manual. Concrete: ACI 318 §19.2.2.1(b),
 * 57,000√f′c for normalweight concrete at f′c = 4,000 psi (4,700√f′c at
 * 28 MPa). Wood: NDS Supplement, Douglas Fir-Larch No. 2. The visitor can
 * always type another.
 */
export const MATERIALS: Record<Exclude<MaterialKey, 'custom'>, Record<UnitSystem, number>> = {
  steel: { us: 29000, si: 200000 },
  aluminum: { us: 10100, si: 69600 },
  concrete: { us: 3605, si: 24870 },
  wood: { us: 1600, si: 11000 },
};

/** A rolled shape, as lib/steel/aisc-shapes.json lists it (inches, lb/ft). */
export interface SteelShape {
  designation: string;
  family: 'W' | 'S' | 'HSS-R' | 'HSS-C' | 'Pipe';
  weight: number;
  A: number;
  d: number;
  tw: number;
  Ix: number;
  Sx: number;
}

export type SupportLayout = 'simple' | 'cantilever' | 'propped' | 'fixed' | 'overhang' | 'two-span' | 'three-span';
export const LAYOUTS: SupportLayout[] = ['simple', 'cantilever', 'propped', 'fixed', 'overhang', 'two-span', 'three-span'];

const round6 = (v: number): number => (v === 0 || !Number.isFinite(v) ? v : Number(v.toPrecision(6)));

/**
 * A converted value, to six significant figures — or to fewer, when a
 * shorter number is the same value to within the rounding of one conversion.
 *
 * That second half is what lets a beam be looked at in the other system and
 * come back unchanged: 0.85 kip/ft is 12.4048 kN/m, which is 0.849999
 * kip/ft at six figures and 0.85 again here. (At four figures throughout,
 * 88.9 in³ came back as 88.91.) Six parts in a million is the most one
 * six-figure rounding can move a number.
 */
function tidy(v: number): number {
  if (v === 0 || !Number.isFinite(v)) return v;
  for (let figures = 1; figures < 6; figures++) {
    const short = Number(v.toPrecision(figures));
    if (Math.abs(short - v) <= 6e-6 * Math.abs(v)) return short;
  }
  return round6(v);
}
/** Four significant figures: what a computed position is shown and stored to. */
export const round4 = (v: number): number => (v === 0 || !Number.isFinite(v) ? v : Number(v.toPrecision(4)));

export function layoutSupports(layout: SupportLayout, L: number): { kind: SupportKind; x: number }[] {
  switch (layout) {
    case 'simple':
      return [{ kind: 'pin', x: 0 }, { kind: 'roller', x: L }];
    case 'cantilever':
      return [{ kind: 'fixed', x: 0 }];
    case 'propped':
      return [{ kind: 'fixed', x: 0 }, { kind: 'roller', x: L }];
    case 'fixed':
      return [{ kind: 'fixed', x: 0 }, { kind: 'fixed', x: L }];
    case 'overhang':
      return [{ kind: 'pin', x: 0 }, { kind: 'roller', x: round4(0.75 * L) }];
    case 'two-span':
      return [{ kind: 'pin', x: 0 }, { kind: 'roller', x: round4(L / 2) }, { kind: 'roller', x: L }];
    case 'three-span':
      return [{ kind: 'pin', x: 0 }, { kind: 'roller', x: round4(L / 3) }, { kind: 'roller', x: round4((2 * L) / 3) }, { kind: 'roller', x: L }];
  }
}

/** The beam the page opens with: a 20 ft simple span, a uniform load and one point load, a W18×50's properties. */
export function defaultBeam(): BeamForm {
  return {
    units: 'us',
    L: 20,
    supports: [
      { id: 1, kind: 'pin', x: 0 },
      { id: 2, kind: 'roller', x: 20 },
    ],
    hinges: [],
    points: [{ id: 3, x: 12, P: 8, dir: 'down' }],
    dists: [{ id: 4, x1: 0, x2: 20, w1: 1.2, w2: 1.2, dir: 'down' }],
    couples: [],
    section: { mode: 'props', material: 'steel', E: 29000, I: 800, S: 88.9, Av: 6.39, b: 12, h: 24, shape: 'W18X50', selfWeight: false },
    nextId: 5,
  };
}

/** The same beam in the other unit system. */
export function convertUnits(form: BeamForm, to: UnitSystem): BeamForm {
  if (form.units === to) return form;
  const k = (q: keyof typeof US_TO_SI) => (to === 'si' ? US_TO_SI[q] : 1 / US_TO_SI[q]);
  const c = (v: number, q: keyof typeof US_TO_SI) => tidy(v * k(q));
  const s = form.section;
  return {
    ...form,
    units: to,
    L: c(form.L, 'length'),
    supports: form.supports.map((p) => ({ ...p, x: c(p.x, 'length') })),
    hinges: form.hinges.map((p) => ({ ...p, x: c(p.x, 'length') })),
    points: form.points.map((p) => ({ ...p, x: c(p.x, 'length'), P: c(p.P, 'force') })),
    dists: form.dists.map((p) => ({ ...p, x1: c(p.x1, 'length'), x2: c(p.x2, 'length'), w1: c(p.w1, 'line'), w2: c(p.w2, 'line') })),
    couples: form.couples.map((p) => ({ ...p, x: c(p.x, 'length'), M: c(p.M, 'moment') })),
    section: {
      ...s,
      // A listed material keeps its own round number in each system.
      E: s.material === 'custom' ? c(s.E, 'E') : MATERIALS[s.material][to],
      I: c(s.I, 'I'),
      S: c(s.S, 'S'),
      Av: c(s.Av, 'A'),
      b: c(s.b, 'dim'),
      h: c(s.h, 'dim'),
    },
  };
}

/* ── What each edit does to the form ──────────────────────────────────── */

export type BeamAction =
  | { type: 'load'; form: BeamForm }
  | { type: 'units'; units: UnitSystem }
  | { type: 'length'; L: number }
  | { type: 'carry-end'; from: number; to: number }
  | { type: 'layout'; layout: SupportLayout }
  | { type: 'add'; list: RowList }
  | { type: 'remove'; list: RowList; id: number }
  | { type: 'patch'; list: RowList; id: number; patch: Record<string, unknown> }
  | { type: 'section'; patch: Partial<BeamForm['section']> }
  | { type: 'material'; material: MaterialKey };

export function reduceBeam(form: BeamForm, action: BeamAction): BeamForm {
  switch (action.type) {
    case 'load':
      return action.form;
    case 'units':
      return convertUnits(form, action.units);
    case 'length':
      return { ...form, L: action.L };
    case 'carry-end': {
      // What sat on the right end stays on the right end: lengthening a
      // simple span should not leave its roller behind. Done once, when the
      // length field is left — not on every keystroke: typing 85 over 20
      // passes through 8, and a load at 8 would be carried off with the roller.
      const { from, to } = action;
      if (!(from > 0) || !(to > 0) || from === to) return form;
      const end = (x: number) => (Math.abs(x - from) < 1e-9 * from ? to : x);
      return {
        ...form,
        supports: form.supports.map((s) => ({ ...s, x: end(s.x) })),
        dists: form.dists.map((d) => ({ ...d, x1: end(d.x1), x2: end(d.x2) })),
        points: form.points.map((p) => ({ ...p, x: end(p.x) })),
        couples: form.couples.map((c) => ({ ...c, x: end(c.x) })),
      };
    }
    case 'layout': {
      let id = form.nextId;
      const supports = layoutSupports(action.layout, form.L).map((s) => ({ id: id++, ...s }));
      return { ...form, supports, hinges: [], nextId: id };
    }
    case 'add': {
      if (form[action.list].length >= MAX_ROWS) return form;
      const id = form.nextId;
      const mid = round4(form.L / 2);
      const us = form.units === 'us';
      const next = { ...form, nextId: id + 1 };
      switch (action.list) {
        case 'supports':
          return { ...next, supports: [...form.supports, { id, kind: 'roller', x: mid }] };
        case 'hinges':
          return { ...next, hinges: [...form.hinges, { id, x: mid }] };
        case 'points':
          return { ...next, points: [...form.points, { id, x: mid, P: us ? 10 : 50, dir: 'down' }] };
        case 'dists':
          return { ...next, dists: [...form.dists, { id, x1: 0, x2: form.L, w1: us ? 1 : 15, w2: us ? 1 : 15, dir: 'down' }] };
        case 'couples':
          return { ...next, couples: [...form.couples, { id, x: mid, M: us ? 20 : 30, dir: 'cw' }] };
      }
      return form;
    }
    case 'remove':
      return { ...form, [action.list]: form[action.list].filter((r) => r.id !== action.id) };
    case 'patch':
      return { ...form, [action.list]: form[action.list].map((r) => (r.id === action.id ? { ...r, ...action.patch } : r)) };
    case 'section':
      return { ...form, section: { ...form.section, ...action.patch } };
    case 'material':
      return {
        ...form,
        section: { ...form.section, material: action.material, E: action.material === 'custom' ? form.section.E : MATERIALS[action.material][form.units] },
      };
  }
}

/* ── The section ──────────────────────────────────────────────────────── */

export interface SectionProps {
  /** ksi / MPa. */
  E: number;
  /** in⁴ / 10⁶ mm⁴. Zero when not known: no deflection is reported. */
  I: number;
  /** in³ / 10³ mm³. Zero when not known: no bending stress. */
  S: number;
  /** The area the shear is divided by (in² / mm²), and the factor on V/A. Zero: no shear stress. */
  Av: number;
  shearFactor: number;
  /** How the shear stress is taken, for the note under it. */
  shearRule: 'area' | 'rect' | 'web' | 'hss' | 'round' | 'none';
  /** Own weight per length in the form's line-load unit (kip/ft, kN/m); zero unless it is known and asked for. */
  selfWeight: number;
}

/** A positive, finite number, or zero. */
const pos = (v: number) => (Number.isFinite(v) && v > 0 ? v : 0);

export function sectionProps(form: BeamForm, shape?: SteelShape | null): SectionProps {
  const s = form.section;
  const si = form.units === 'si';
  if (s.mode === 'rect') {
    const b = pos(s.b);
    const h = pos(s.h);
    const scaleI = si ? 1e6 : 1;
    const scaleS = si ? 1e3 : 1;
    return {
      E: pos(s.E),
      I: (b * h ** 3) / 12 / scaleI,
      S: (b * h * h) / 6 / scaleS,
      Av: b * h,
      // The parabolic distribution of a rectangle peaks at 1.5 times the average.
      shearFactor: 1.5,
      shearRule: b && h ? 'rect' : 'none',
      selfWeight: 0,
    };
  }
  if (s.mode === 'shape') {
    if (!shape) return { E: MATERIALS.steel[form.units], I: 0, S: 0, Av: 0, shearFactor: 1, shearRule: 'none', selfWeight: 0 };
    // The shear area of AISC 360 Chapter G: the web of an I-shape (d·tw), the
    // two webs of a rectangular HSS (2·h·t with h = d − 3t), half the area of
    // a round one.
    const [AvIn, rule]: [number, SectionProps['shearRule']] =
      shape.family === 'W' || shape.family === 'S'
        ? [shape.d * shape.tw, 'web']
        : shape.family === 'HSS-R'
          ? [2 * (shape.d - 3 * shape.tw) * shape.tw, 'hss']
          : [shape.A / 2, 'round'];
    return {
      E: MATERIALS.steel[form.units],
      I: si ? shape.Ix * US_TO_SI.I : shape.Ix,
      S: si ? shape.Sx * US_TO_SI.S : shape.Sx,
      Av: si ? AvIn * US_TO_SI.A : AvIn,
      shearFactor: 1,
      shearRule: rule,
      // lb/ft → kip/ft, or → kN/m.
      selfWeight: s.selfWeight ? (si ? (shape.weight / 1000) * US_TO_SI.line : shape.weight / 1000) : 0,
    };
  }
  return { E: pos(s.E), I: pos(s.I), S: pos(s.S), Av: pos(s.Av), shearFactor: 1, shearRule: pos(s.Av) ? 'area' : 'none', selfWeight: 0 };
}

/** E·I in the engine's units: kip·ft², or kN·m². Zero when either is missing. */
export function stiffness(units: UnitSystem, p: SectionProps): number {
  // ksi·in⁴ = kip·in², and 144 in² to the ft².  MPa·(10⁶ mm⁴) = 10⁶ N·mm² = 10⁻³ kN·m².
  return units === 'us' ? (p.E * p.I) / 144 : p.E * p.I * 1e-3;
}
/** Deflection in the unit shown (in, mm) from the engine's EI·v (kip·ft³, kN·m³). */
export function deflectionFactor(units: UnitSystem, EI: number): number {
  return EI > 0 ? (units === 'us' ? 12 : 1000) / EI : 0;
}
/** Bending stress (ksi, MPa) from a moment in kip·ft or kN·m. */
export function bendingStress(units: UnitSystem, p: SectionProps, M: number): number | null {
  if (!p.S) return null;
  return units === 'us' ? (M * 12) / p.S : (M * 1e3) / p.S;
}
/** Shear stress (ksi, MPa) from a shear in kip or kN. */
export function shearStress(units: UnitSystem, p: SectionProps, V: number): number | null {
  if (!p.Av) return null;
  return (p.shearFactor * (units === 'us' ? V : V * 1e3)) / p.Av;
}

/* ── From the form to the engine ──────────────────────────────────────── */

export type RowList = 'supports' | 'hinges' | 'points' | 'couples' | 'dists';
/** What the engine says of a beam (supports or hinges too close together included), and what only the form can know: a section value that is not one. */
export type FormIssueCode = BeamIssueCode | 'section';
export interface FormIssue {
  code: FormIssueCode;
  /** The row at fault, when it is one row. */
  row?: { list: RowList; id: number };
}

export function toEngine(form: BeamForm, section: SectionProps): BeamModel {
  const dists = form.dists.map((d) => {
    const k = d.dir === 'down' ? 1 : -1;
    return { x1: d.x1, x2: d.x2, w1: k * d.w1, w2: k * d.w2 };
  });
  if (section.selfWeight) dists.push({ x1: 0, x2: form.L, w1: section.selfWeight, w2: section.selfWeight });
  return {
    L: form.L,
    supports: form.supports.map((s) => ({ x: s.x, kind: s.kind })),
    hinges: form.hinges.map((h) => h.x),
    points: form.points.map((p) => ({ x: p.x, P: p.dir === 'down' ? p.P : -p.P })),
    couples: form.couples.map((c) => ({ x: c.x, M: c.dir === 'ccw' ? c.M : -c.M })),
    dists,
  };
}

export interface BeamAnalysis {
  solution: BeamSolution | null;
  issues: FormIssue[];
  section: SectionProps;
  /** E·I in the engine's units; zero when E or I is missing. */
  EI: number;
  /** Multiply the engine's EI·v by this for the deflection shown; zero when EI is. */
  toDeflection: number;
  /** Multiply EI·θ by this for the slope in radians. */
  toSlope: number;
  /**
   * The size of the problem, as a force: every load's magnitude added up
   * (a couple counts as its moment over the length). What the page measures
   * rounding against — a shear a billionth of this is zero, not a result.
   */
  loadScale: number;
  spans: (BeamSpan & { deflection: number; ratio: number | null })[];
}

export function analyse(form: BeamForm, shape?: SteelShape | null): BeamAnalysis {
  const section = sectionProps(form, shape);
  const EI = stiffness(form.units, section);
  const toDeflection = deflectionFactor(form.units, EI);
  const engine = toEngine(form, section);
  const out = solveBeam(engine);
  const span = form.L > 0 && Number.isFinite(form.L) ? form.L : 1;
  const size = (v: number) => (Number.isFinite(v) ? Math.abs(v) : 0);
  const loadScale =
    (engine.points ?? []).reduce((sum, p) => sum + size(p.P), 0) +
    (engine.dists ?? []).reduce((sum, d) => sum + ((size(d.w1) + size(d.w2)) / 2) * size(d.x2 - d.x1), 0) +
    (engine.couples ?? []).reduce((sum, c) => sum + size(c.M) / span, 0);
  const issues: FormIssue[] = [];
  if (!out.ok) {
    for (const issue of out.issues) {
      const w = issue.where;
      // The engine's lists are the form's, row for row: the place it names is
      // the row's — of two supports or two hinges too close together, the one
      // further right. Only the beam's own weight, appended to the distributed
      // loads, is no row of the form.
      const row = w && form[w.list][w.index] ? { list: w.list, id: form[w.list][w.index].id } : undefined;
      issues.push({ code: issue.code, row });
    }
  }
  const s = form.section;
  const bad = (v: number) => !Number.isFinite(v) || v < 0;
  // Only what the chosen kind of section uses: a steel shape brings its own
  // modulus, and a leftover in a field that is not on screen is no problem.
  if ((s.mode !== 'shape' && bad(s.E)) || (s.mode === 'props' && (bad(s.I) || bad(s.S) || bad(s.Av))) || (s.mode === 'rect' && (bad(s.b) || bad(s.h)))) issues.push({ code: 'section' });
  const solution = out.ok ? out : null;
  const lengthToShown = form.units === 'us' ? 12 : 1000;
  return {
    solution,
    issues,
    section,
    EI,
    toDeflection,
    toSlope: EI > 0 ? 1 / EI : 0,
    loadScale,
    spans: solution
      ? beamSpans(solution).map((p) => {
          const deflection = p.EIv.value * toDeflection;
          // A limit is written as a fraction of the span; for an overhang, of
          // twice its length (IBC Table 1604.3, note i).
          const reference = (p.kind === 'cantilever' ? 2 : 1) * (p.to - p.from) * lengthToShown;
          return { ...p, deflection, ratio: toDeflection && Math.abs(deflection) > 1e-12 ? reference / Math.abs(deflection) : null };
        })
      : [],
  };
}

/* ── A beam in an address ─────────────────────────────────────────────── */

/**
 * The beam as a short string for the page's address (after `#b=`), so a link
 * opens the same beam. Signs carry the directions; nothing but numbers and a
 * few letters is written, and `decodeBeam` accepts nothing else — the string
 * comes back from wherever a link was pasted.
 *
 * WHATEVER THE FORM HOLDS IS WRITTEN, and read back as that form: a length
 * of 0 on the way to 0.5, a number of any size, each to the eight figures
 * its field shows. A reload must come back to the beam that was on screen,
 * with its warning — not to the example.
 *
 * IT BEGINS WITH A CHECK of the rest (`checkOf`). Without one, a link that
 * lost its last character on the way is still a link, to another beam: a
 * 12 × 24 rectangle became a 12 × 2 one, with no notice.
 */
export function encodeBeam(form: BeamForm): string {
  const n = written;
  const sec = form.section;
  const body = [
    form.units,
    n(form.L),
    form.supports.map((s) => `${s.kind[0]}${n(s.x)}`).join('_'),
    form.hinges.map((h) => n(h.x)).join('_'),
    form.points.map((p) => `${n(p.x)},${signed(p.P, p.dir === 'up')}`).join('_'),
    form.dists.map((d) => `${n(d.x1)},${n(d.x2)},${signed(d.w1, d.dir === 'up')},${signed(d.w2, d.dir === 'up')}`).join('_'),
    form.couples.map((c) => `${n(c.x)},${signed(c.M, c.dir === 'cw')}`).join('_'),
    sec.mode === 'shape'
      ? `s,${sec.shape.replace(/[^A-Za-z0-9./-]/g, '')},${sec.selfWeight ? 1 : 0}`
      : sec.mode === 'rect'
        ? `r,${MATERIAL_LETTER[sec.material]},${n(sec.E)},${n(sec.b)},${n(sec.h)}`
        : `p,${MATERIAL_LETTER[sec.material]},${n(sec.E)},${n(sec.I)},${n(sec.S)},${n(sec.Av)}`,
  ].join(';');
  return `${checkOf(body)};${body}`;
}

/**
 * The check an address begins with: the length of the rest and a sum of its
 * characters, as one number in base 36. A link that lost its tail has
 * another length, so no shortened link passes. One changed character, or two
 * neighbours swapped, always changes the sum: 31 shares no factor with
 * 1,296, and no two characters of a link are 216 apart.
 *
 * Links are kept by the people they were sent to: this must never change.
 */
function checkOf(body: string): string {
  let sum = 0;
  for (let i = 0; i < body.length; i++) sum = (sum * 31 + body.charCodeAt(i)) % 1296;
  // 1,296 is 36²: the sum is the last two characters, the length the ones before.
  return (body.length * 1296 + sum).toString(36);
}

const NUMBER = /^-?\d+(\.\d+)?(e-?\d+)?$/;
/* What is not a number has a name. A field can be left holding one: a value
   near the largest a number can be overflows when the units are switched. */
const NAMED = new Map<string, number>([['inf', Infinity], ['-inf', -Infinity], ['nan', Number.NaN]]);
/** A number as an address carries it: the eight figures its field shows, with no `+` in an exponent. */
const written = (v: number): string => (Number.isFinite(v) ? fieldNumber(v).replace('e+', 'e') : v > 0 ? 'inf' : v < 0 ? '-inf' : 'nan');
/**
 * A size and its direction as one signed number. A zero keeps its direction
 * too, as −0: an upward load whose size is being retyped is still upward
 * after a reload.
 */
const signed = (v: number, reversed: boolean): string => (v === 0 ? (reversed ? '-0' : '0') : written(reversed ? -v : v));

const KINDS: Record<string, SupportKind> = { p: 'pin', r: 'roller', f: 'fixed' };
/* 'custom' is written u (the visitor's own): c is concrete. */
const MATERIAL_LETTER: Record<MaterialKey, string> = { steel: 's', aluminum: 'a', concrete: 'c', wood: 'w', custom: 'u' };

/*
 * No form writes a longer address: twelve rows of every kind with every
 * number at its longest (22 characters: −1.2345678 × 10²⁰ is written out in
 * full) come to 2,899 characters.
 */
const MAX_LINK = 3000;

/** The beam a string from `encodeBeam` describes, or `null` if it is anything else. */
export function decodeBeam(text: string): BeamForm | null {
  if (text.length > MAX_LINK) return null;
  const cut = text.indexOf(';');
  const first = text.slice(0, Math.max(cut, 0));
  // A link from before the check existed begins with its units. Those have
  // been sent to people, and open as they always did.
  if (first === 'us' || first === 'si') return readBeam(text);
  const body = text.slice(cut + 1);
  return first !== '' && first === checkOf(body) ? readBeam(body) : null;
}

/** The eight fields of an address, without its check. */
function readBeam(text: string): BeamForm | null {
  const parts = text.split(';');
  if (parts.length !== 8) return null;
  const [units, L, supports, hinges, points, dists, couples, section] = parts;
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
  /** Written with a minus: the direction is the other one. */
  const reversed = (s: string) => s.startsWith('-');
  const rows = (s: string, fields: number): string[][] => {
    if (s === '') return [];
    const list = s.split('_').map((r) => r.split(','));
    if (list.length <= MAX_ROWS && list.every((r) => r.length === fields)) return list;
    // Not a list: none of it is read. A row short of a field has nothing where its number should be.
    bad = true;
    return [];
  };
  let id = 1;
  // What the link does not carry (the rectangle's sides when it gives
  // properties, and the reverse) starts from the default section in the
  // link's own units — not from inches under a millimetre label.
  const base = units === 'si' ? convertUnits(defaultBeam(), 'si') : defaultBeam();
  const form: BeamForm = {
    units,
    L: num(L),
    supports: rows(supports, 1).map(([s]) => {
      const kind = KINDS[s[0]];
      if (!kind) bad = true;
      return { id: id++, kind: kind ?? 'pin', x: num(s.slice(1)) };
    }),
    hinges: rows(hinges, 1).map(([x]) => ({ id: id++, x: num(x) })),
    points: rows(points, 2).map(([x, P]) => ({ id: id++, x: num(x), P: Math.abs(num(P)), dir: reversed(P) ? ('up' as const) : ('down' as const) })),
    dists: rows(dists, 4).map(([x1, x2, w1, w2]) => {
      const a = num(w1);
      const b = num(w2);
      // One direction per load: upward only when neither end points down.
      const up = a <= 0 && b <= 0 && (reversed(w1) || reversed(w2));
      return { id: id++, x1: num(x1), x2: num(x2), w1: up ? Math.abs(a) : a, w2: up ? Math.abs(b) : b, dir: up ? ('up' as const) : ('down' as const) };
    }),
    couples: rows(couples, 2).map(([x, M]) => ({ id: id++, x: num(x), M: Math.abs(num(M)), dir: reversed(M) ? ('cw' as const) : ('ccw' as const) })),
    section: { ...base.section },
    nextId: 0,
  };
  const sec = section.split(',');
  // Looked up by its letter among the five, never as a property: "constructor"
  // is a property of every object, and is no material.
  const listed = (Object.keys(MATERIAL_LETTER) as MaterialKey[]).find((key) => MATERIAL_LETTER[key] === sec[1]);
  // A material is the listed one only with the listed modulus: any other E
  // is the visitor's own, or switching units would quietly "restore" it.
  const material = (key: MaterialKey, E: number): MaterialKey => (key !== 'custom' && MATERIALS[key][units] !== E ? 'custom' : key);
  if (sec[0] === 's' && sec.length === 3 && /^[A-Za-z0-9./-]{2,24}$/.test(sec[1]) && (sec[2] === '0' || sec[2] === '1')) {
    form.section = { ...form.section, mode: 'shape', material: 'steel', shape: sec[1], selfWeight: sec[2] === '1' };
  } else if (sec[0] === 'r' && sec.length === 5 && listed) {
    const E = num(sec[2]);
    form.section = { ...form.section, mode: 'rect', material: material(listed, E), E, b: num(sec[3]), h: num(sec[4]) };
  } else if (sec[0] === 'p' && sec.length === 6 && listed) {
    const E = num(sec[2]);
    form.section = { ...form.section, mode: 'props', material: material(listed, E), E, I: num(sec[3]), S: num(sec[4]), Av: num(sec[5]) };
  } else return null;
  // A length that cannot be one is read like any other: 0 is what the field
  // holds on the way to 0.5, and the form says what is wrong with it.
  if (bad) return null;
  form.nextId = id;
  return form;
}
