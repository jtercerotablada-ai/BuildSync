import { NAMED, NUMBER, US_TO_SI, checkOf, checked, written, type UnitSystem } from '../beam/model';
import { TEMPLATE_DEFAULTS, buildTemplate, type BuiltTemplate, type Clamp, type TemplateId, type TemplateParams } from './templates';
import {
  MAX_MEMBERS,
  MAX_MEMBER_LOADS,
  MAX_NODAL_LOADS,
  MAX_NODES,
  MAX_SUPPORTS,
  type FrameIssue,
  type FrameLoadDir,
  type FrameMemberLoad,
  type FrameModel,
  type FrameSupportKind,
} from './types';

/**
 * ─────────────────────────────────────────────────────────────────────────────
 * PLANE FRAME ANALYSIS — what the visitor edits, and what the engine is given
 * ─────────────────────────────────────────────────────────────────────────────
 * Between the form of the eighth calculator ("Plane frame analysis", /resources/frame) and its engine
 * (types.ts is the agreement between the two). Pure functions, no React: the frame as entered (`FrameForm`),
 * what each edit does to it (`reduceFrame`), the model the engine takes and which row of the form each of its
 * entries is (`toEngine`, `issueRow`), the same frame in the other unit system (`convertFrame`), and the
 * address that carries the case from one engineer to another. The rest of the shell's wants of a model:
 * `defaultCase()`, `encode`, `decode` (null for an address that cannot be read), and a reducer with a `'load'`
 * action that returns the form it is given ITSELF.
 *
 * THE FORM HOLDS NUMBERS, not the text typed (the field component is where text is); a field that is not a number
 * yet commits NaN, which the engine reports against its row ('number'). `null` is "not given" for the sections
 * (E, A, I of the frame and of a member, a member's depth).
 *
 * UNITS. The form holds numbers in the units it SHOWS (`FRAME_UNITS`):
 *
 *     US   ft, kip, kip/ft, kip·ft;  A in², I in⁴, E ksi;  depth and settlement in inches;  °F and 1/°F
 *     SI   m,  kN,  kN/m,   kN·m;    A mm², I 10⁶ mm⁴, E GPa; depth and settlement in millimetres; °C and 1/°C
 *
 * (10⁶ mm⁴ is the unit of the beam calculator and of the AISC tables in SI: a W16×31 is 215.) The engine takes any consistent
 * set and is given feet and kips or metres and kilonewtons. EVERY conversion lives in this file: the section and the
 * depth and settlements cross in ONE place (`TO_ENGINE`), the displacements come back through `FROM_ENGINE`, and the
 * other system's numbers are made by `convertFrame` (`FRAME_US_TO_SI`). A temperature DIFFERENCE converts by 5/9
 * (a degree Fahrenheit is 5/9 of a degree Celsius) and α, a strain per degree, by 9/5. Nothing else in the calculator
 * holds a 12, a 144, a 1000 or a 1.8.
 *
 * IDENTITY AND NUMBERS. Every row has an `id` that only ever grows (a removed row's is never reused). A member, a
 * support and a load name their node BY ITS ID, a member load its member. What the visitor sees are LABELS: a row's
 * place in its list, from 1. Deleting a node renumbers the labels after it and nothing else.
 *
 * DELETING A NODE takes with it every member attached to it, those members' loads, and every support and nodal load
 * on it; DELETING A MEMBER takes its loads. The visitor is TOLD: `form.notice` carries the labels (in the numbering
 * BEFORE the removal), the counts, and whether anything was renumbered (`renumbered: false` is "numbered as before").
 * The notice is transient: the next action replaces it, it is never written in an address.
 *
 * THE CAP: 50 nodes, 100 members, 40 supports, 60 nodal loads, 120 member loads. An `'add'` past one is refused (the form
 * is returned as it was, with `notice = { code: 'limit', list, max }`), and so is one with nothing to add
 * (`'nothing-to-add'` and why).
 */

/** What this page's case is called in its address: `#f=…` (`#b` beam, `#s` single span, `#c` continuous beam, `#h` shaft, `#t` truss, `#k`/`#g` cables). */
export const FRAME_KEY = 'f';

export { MAX_MEMBERS, MAX_MEMBER_LOADS, MAX_NODAL_LOADS, MAX_NODES, MAX_SUPPORTS };

/* ── The units ────────────────────────────────────────────────────────── */

export interface FrameUnitNames {
  length: string;
  force: string;
  line: string;
  moment: string;
  area: string;
  inertia: string;
  E: string;
  depth: string;
  displacement: string;
  temperature: string;
  alpha: string;
  spring: string;
  rotationalSpring: string;
}
export const FRAME_UNITS: Record<UnitSystem, FrameUnitNames> = {
  us: { length: 'ft', force: 'kip', line: 'kip/ft', moment: 'kip·ft', area: 'in²', inertia: 'in⁴', E: 'ksi', depth: 'in', displacement: 'in', temperature: '°F', alpha: '1/°F', spring: 'kip/ft', rotationalSpring: 'kip·ft/rad' },
  si: { length: 'm', force: 'kN', line: 'kN/m', moment: 'kN·m', area: 'mm²', inertia: '10⁶ mm⁴', E: 'GPa', depth: 'mm', displacement: 'mm', temperature: '°C', alpha: '1/°C', spring: 'kN/m', rotationalSpring: 'kN·m/rad' },
};

/** Exact definitions: 1 ft = 0.3048 m; 1 kip = 4.4482216152605 kN; 1 in = 25.4 mm. */
const IN = 25.4;
export const FRAME_US_TO_SI = {
  length: US_TO_SI.length,
  force: US_TO_SI.force,
  line: US_TO_SI.line,
  moment: US_TO_SI.moment,
  area: IN * IN, // in² → mm²
  inertia: IN ** 4 / 1e6, // in⁴ → 10⁶ mm⁴
  // ksi → GPa: kip/in² = 4.4482216152605 kN / 645.16 mm² = 0.0068947572932 kN/mm², and a kN/mm² is a GPa.
  E: US_TO_SI.force / (IN * IN),
  depth: IN, // in → mm (also the settlements)
  temperature: 5 / 9, // a difference: °F → °C
  alpha: 9 / 5, // strain per °F → per °C
} as const;

/** From what the form holds to what the engine is given (feet and kips; metres and kilonewtons). */
export const TO_ENGINE: Record<UnitSystem, { area: number; inertia: number; E: number; depth: number }> = {
  us: { area: 1 / 144, inertia: 1 / 20736, E: 144, depth: 1 / 12 },
  si: { area: 1e-6, inertia: 1e-6, E: 1e6, depth: 1e-3 },
};

/** From the engine's results to the units shown: a displacement (ft → in, m → mm). A rotation is in radians in both. */
export const FROM_ENGINE: Record<UnitSystem, { displacement: number }> = {
  us: { displacement: 12 },
  si: { displacement: 1000 },
};

/* ── The form ─────────────────────────────────────────────────────────── */

export type FrameMaterial = 'steel' | 'aluminum' | 'custom';

/** The modulus and α offered as a starting point, in the unit each system shows (29,000 ksi is 199.95 GPa; steel is 200 GPa; 6.5e-6/°F is 11.7e-6/°C). */
export const FRAME_MATERIALS: Record<Exclude<FrameMaterial, 'custom'>, { E: Record<UnitSystem, number>; alpha: Record<UnitSystem, number> }> = {
  steel: { E: { us: 29000, si: 200 }, alpha: { us: 6.5e-6, si: 11.7e-6 } },
  aluminum: { E: { us: 10100, si: 69.6 }, alpha: { us: 13e-6, si: 23.4e-6 } },
};

/**
 * Section presets: a few rolled shapes (W shapes), A and I as the AISC Manual lists them in US units, and the same
 * section in SI by conversion (exact, to the eight figures a field shows). TYPICAL starting points for a hand check:
 * a visitor uses the properties of the section actually specified. (Written from the AISC Manual's tables; checked
 * against the published values of the W shapes below, not against the manual itself.)
 */
export const SECTION_PRESETS: { id: string; A: number; I: number }[] = [
  { id: 'W8x31', A: 9.13, I: 110 },
  { id: 'W10x33', A: 9.71, I: 171 },
  { id: 'W12x26', A: 7.65, I: 204 },
  { id: 'W12x40', A: 11.7, I: 307 },
  { id: 'W14x48', A: 14.1, I: 484 },
  { id: 'W16x31', A: 9.13, I: 375 },
  { id: 'W18x35', A: 10.3, I: 510 },
  { id: 'W21x44', A: 13, I: 843 },
  { id: 'W24x55', A: 16.2, I: 1350 },
];
/** What a new frame opens with: W14×48 and structural steel. */
export const DEFAULT_SECTION = { A: 14.1, I: 484 };

export interface NodeRow {
  id: number;
  /** Position (ft, m): x to the right, y up. */
  x: number;
  y: number;
}
export interface MemberRow {
  id: number;
  /** The ids of the two nodes. */
  i: number;
  j: number;
  /** This member's own area (in², mm²), inertia (in⁴, 10⁶ mm⁴) and modulus (ksi, GPa); null: the frame's. */
  A: number | null;
  I: number | null;
  E: number | null;
  /** A moment hinge at the member's start (node i) / end (node j). */
  hingeStart: boolean;
  hingeEnd: boolean;
  /** Section depth (in, mm): only a temperature gradient needs it. Null: not given. */
  h: number | null;
}
export interface SupportRow {
  id: number;
  /** The id of the node. */
  node: number;
  kind: FrameSupportKind;
  /** A roller's / guide's restrained line, degrees counter-clockwise from +x (types.ts): 90 is the usual roller. Kept while the support is another kind. */
  angle: number;
  /** Springs along the global axes (kip/ft, kN/m) and about z (kip·ft/rad, kN·m/rad); 0 is none. */
  kx: number;
  ky: number;
  kr: number;
  /** Settlements: x and y in inches / millimetres, rotation in radians. */
  dx: number;
  dy: number;
  dr: number;
}
export interface LoadRow {
  id: number;
  node: number;
  /** Components (kip, kN), along +x and +y: a gravity load is a negative fy; and a counter-clockwise moment (kip·ft, kN·m). */
  fx: number;
  fy: number;
  m: number;
}
export type MemberLoadKind = FrameMemberLoad['kind'];
export const MEMBER_LOAD_KINDS: MemberLoadKind[] = ['udl', 'udl-projected', 'trapezoid', 'point', 'moment', 'temperature'];
export const LOAD_DIRS: FrameLoadDir[] = ['local-y', 'local-x', 'global-x', 'global-y'];
export const SUPPORT_KINDS: FrameSupportKind[] = ['fixed', 'pin', 'roller', 'guide', 'spring'];

/**
 * A member load. ONE row shape for every kind: the fields a kind does not use are kept (and carried by the address)
 * so that changing the kind back finds them, and the engine ignores them.
 *   udl, udl-projected   `w` (kip/ft, kN/m)                    dir (a projected one: 'global-y' or 'global-x')
 *   trapezoid            `w` at `a`, `w2` at `b` (length)      dir
 *   point                `P` (kip, kN) at `a` (length)         dir
 *   moment               `M` (kip·ft, kN·m) at `a`
 *   temperature          `dT`, `dTg` (°F, °C), `alpha` (1/°F, 1/°C)
 */
export interface MemberLoadRow {
  id: number;
  /** The id of the member. */
  member: number;
  kind: MemberLoadKind;
  dir: FrameLoadDir;
  w: number;
  w2: number;
  P: number;
  M: number;
  a: number;
  b: number;
  dT: number;
  dTg: number;
  alpha: number;
}

export type FrameList = 'nodes' | 'members' | 'supports' | 'loads' | 'memberLoads';

export type FrameNotice =
  /** `members` are the labels the removed members had BEFORE the removal; `renumbered` / `membersRenumbered`: the nodes / the members after them moved up ("numbered as before" when false). */
  | { code: 'node-removed'; node: number; members: number[]; supports: number; loads: number; memberLoads: number; renumbered: boolean; membersRenumbered: boolean }
  | { code: 'member-removed'; member: number; memberLoads: number; renumbered: boolean }
  | { code: 'limit'; list: FrameList; max: number }
  /** An "add" that had nothing to add: every pair of nodes already has a member ('pairs'), every node already has a support ('nodes'), there is no node ('no-node') or no member ('no-member') to put it on. */
  | { code: 'nothing-to-add'; list: FrameList; why: 'pairs' | 'nodes' | 'no-node' | 'no-member' }
  | { code: 'template'; template: TemplateId; clamped: Clamp[] };

export interface FrameForm {
  units: UnitSystem;
  nodes: NodeRow[];
  members: MemberRow[];
  supports: SupportRow[];
  loads: LoadRow[];
  memberLoads: MemberLoadRow[];
  material: FrameMaterial;
  /** Modulus of every member that has none of its own (ksi, GPa); null: not given. */
  E: number | null;
  /** Area (in², mm²) and inertia (in⁴, 10⁶ mm⁴) of every member that has none of its own; null: not given. */
  A: number | null;
  I: number | null;
  /** What the last edit has to tell the visitor. Not part of the case: never written in an address. */
  notice: FrameNotice | null;
  /** The next id to hand out. */
  nextId: number;
}

export const LIMITS: Record<FrameList, number> = { nodes: MAX_NODES, members: MAX_MEMBERS, supports: MAX_SUPPORTS, loads: MAX_NODAL_LOADS, memberLoads: MAX_MEMBER_LOADS };

/** Eight figures, the most a field shows: a coordinate computed from another keeps all of them. */
const eight = (v: number): number => (Number.isFinite(v) ? Number(v.toPrecision(8)) : v);

const supportRow = (id: number, node: number, kind: FrameSupportKind, angle = 90): SupportRow => ({ id, node, kind, angle, kx: 0, ky: 0, kr: 0, dx: 0, dy: 0, dr: 0 });
const memberLoadRow = (id: number, member: number, over: Partial<MemberLoadRow> = {}): MemberLoadRow => ({
  id,
  member,
  kind: 'udl',
  dir: 'global-y',
  w: 0,
  w2: 0,
  P: 0,
  M: 0,
  a: 0,
  b: 0,
  dT: 0,
  dTg: 0,
  alpha: 0,
  ...over,
});

/** Where the rows of a template go, numbered from `first`: nodes, members, supports, loads, member loads. */
function rowsOf(t: BuiltTemplate, first: number): Pick<FrameForm, 'nodes' | 'members' | 'supports' | 'loads' | 'memberLoads' | 'nextId'> {
  let id = first;
  const nodeIds = t.nodes.map(() => id++);
  const nodes: NodeRow[] = t.nodes.map((n, k) => ({ id: nodeIds[k], x: eight(n.x), y: eight(n.y) }));
  const memberIds = t.members.map(() => id++);
  const members: MemberRow[] = t.members.map((m, k) => ({ id: memberIds[k], i: nodeIds[m.i], j: nodeIds[m.j], A: null, I: null, E: null, hingeStart: Boolean(m.hingeStart), hingeEnd: Boolean(m.hingeEnd), h: null }));
  const supports: SupportRow[] = t.supports.map((s) => supportRow(id++, nodeIds[s.node], s.kind, s.angle ?? 90));
  const loads: LoadRow[] = t.loads.map((l) => ({ id: id++, node: nodeIds[l.node], fx: eight(l.fx), fy: eight(l.fy), m: eight(l.m) }));
  const memberLoads: MemberLoadRow[] = t.memberLoads.map((l) => memberLoadRow(id++, memberIds[l.member], { kind: l.kind, dir: l.dir, w: eight(l.w) }));
  return { nodes, members, supports, loads, memberLoads, nextId: id };
}

/**
 * The frame the page opens with — a textbook one with an answer you can check by hand: a single-bay PORTAL FRAME, 20 ft wide and
 * 10 ft high, fixed at both feet, W14×48 steel throughout (A = 14.1 in², I = 484 in⁴, E = 29,000 ksi), a lateral
 * load of 10 kip at the left corner and 1.2 kip/ft on the beam. Nodes 1 (0,0), 2 (20,0), 3 (0,10), 4 (20,10); members 1 and 2 the
 * columns, 3 the beam.
 *
 * By hand. Same I in beam and columns, so r = (I/L)/(I/h) = h/L = 0.5. Treating the members as inextensible:
 *   Lateral load H = 10 alone: each column carries H/2 = 5 kip. Slope-deflection gives the column moments
 *       M_foot = H·h·(1 + 3r) / (2 (1 + 6r)) = 100 · 2.5 / 8 = 31.25 kip·ft,
 *       M_top  = H·h·3r / (2 (1 + 6r))       = 100 · 1.5 / 8 = 18.75 kip·ft,
 *     the beam ends have the same 18.75, and overturning gives the vertical reactions ±(H·h − 2·31.25)/L = ±1.875 kip.
 *   Gravity w = 1.2 alone: the fixed-end moment wL²/12 = 40 carried over with 2/(2 + r) = 0.8 gives beam ends −32 (hogging),
 *     beam middle +wL²/8 − 32 = +28 (sagging), column tops 32 and feet 16 kip·ft; vertical reactions wL/2 = 12; the base thrust is
 *     (32 + 16)/h = 4.8 kip towards the centre at each foot.
 *   Together: reactions at node 1: Rx = 4.8 − 5 = −0.2 kip, Ry = 12 − 1.875 = 10.125 kip; at node 2: Rx = −4.8 − 5 = −9.8 kip,
 *     Ry = 13.875 kip; beam end moments −32 + 18.75 = −13.25 (left) and −32 − 18.75 = −50.75 kip·ft (right); the feet
 *     moments are 31.25 ∓ 16 kip·ft. ΣFx: 10 − 0.2 − 9.8 = 0.
 * WHAT THE SOLVER GIVES is a little different, because the W14×48 members do shorten and lengthen (the beam's axial
 * stiffness lets the two column tops sway by slightly different amounts): reactions Rx = −0.311 and −9.689 kip, Ry = 10.128 and
 * 13.872 kip, beam end moments −13.01 and −50.44 kip·ft (2 % and 0.6 % from the hand figures), the base moments 16.11 and 46.45
 * kip·ft, the middle of the beam +29.74 kip·ft at 8.44 ft from the left, the top of the left column 0.0928 in to the right.
 * (Take the section's A up to 10⁷ in² and it reproduces the hand answer to five figures: model.test.ts.) Its rows are numbered as a link
 * numbers them, so this frame read back from its own address is this frame, id for id.
 */
export function defaultFrame(): FrameForm {
  const t = buildTemplate('portal', TEMPLATE_DEFAULTS.us.portal, 'us');
  return { units: 'us', ...rowsOf(t, 1), material: 'steel', E: 29000, A: DEFAULT_SECTION.A, I: DEFAULT_SECTION.I, notice: null };
}
/** The shell's name for the same thing. */
export const defaultCase = defaultFrame;

/** A frame with nothing in it: what a visitor starts a frame of their own from. */
export function emptyFrame(units: UnitSystem = 'us'): FrameForm {
  const section = convertSection(DEFAULT_SECTION, units);
  return { units, nodes: [], members: [], supports: [], loads: [], memberLoads: [], material: 'steel', E: FRAME_MATERIALS.steel.E[units], A: section.A, I: section.I, notice: null, nextId: 1 };
}

/* ── Units ────────────────────────────────────────────────────────────── */

/**
 * A converted value, to fifteen significant figures (the rounding of a double and no more), or to the shortest number of up
 * to eight figures within the noise of that: a coordinate rounded to six figures moves each node a little on its own, and a
 * frame that was symmetric, or had members on one line, is not after it. A value of up to EIGHT figures (what a field
 * holds) comes back from the other system as the very number it was.
 */
const exact = (v: number): number => {
  if (v === 0 || !Number.isFinite(v)) return v;
  const long = Number(v.toPrecision(15));
  // A number of up to EIGHT figures (what a field holds) within the noise of a conversion and back is that number: 27.3 comes back as 27.3
  // and not as 27.3000000000001. Longer ones are not looked for: the chance that a number of nine figures or more sits within
  // 2e-14 of a value by accident is about one in a million, and snapping to it would move a converted value by as much.
  for (let figures = 1; figures <= 8; figures++) {
    const short = Number(long.toPrecision(figures));
    if (Math.abs(short - long) <= 2e-14 * Math.abs(long)) return short;
  }
  return long;
};

type Quantity = keyof typeof FRAME_US_TO_SI;
const convert = (v: number, q: Quantity, from: UnitSystem, to: UnitSystem): number => {
  if (from === to) return v;
  const f = FRAME_US_TO_SI[q];
  return exact(v * (to === 'si' ? f : 1 / f));
};

function convertSection(s: { A: number; I: number }, to: UnitSystem): { A: number; I: number } {
  return to === 'us' ? s : { A: convert(s.A, 'area', 'us', 'si'), I: convert(s.I, 'inertia', 'us', 'si') };
}

/** The preset's A and I in the units given. */
export function presetValues(id: string, units: UnitSystem): { A: number; I: number } | null {
  const p = SECTION_PRESETS.find((s) => s.id === id);
  return p ? convertSection(p, units) : null;
}

/** The listed material a value is, in the system it is written in; null for any other. */
function listedModulus(v: number | null, units: UnitSystem): Exclude<FrameMaterial, 'custom'> | null {
  if (v === null) return null;
  return (Object.keys(FRAME_MATERIALS) as Exclude<FrameMaterial, 'custom'>[]).find((m) => FRAME_MATERIALS[m].E[units] === v) ?? null;
}
function listedAlpha(v: number, units: UnitSystem): Exclude<FrameMaterial, 'custom'> | null {
  return (Object.keys(FRAME_MATERIALS) as Exclude<FrameMaterial, 'custom'>[]).find((m) => FRAME_MATERIALS[m].alpha[units] === v) ?? null;
}

/**
 * The same frame in the other unit system: every quantity as its own, with all its figures (`exact`), and back again to
 * the very same numbers for values of up to thirteen significant figures. A roller's angle and a rotation have no unit.
 * A modulus or an α that is a listed material's (29,000 ksi, 200 GPa; 6.5e-6, 11.7e-6) is the listed one in the other system,
 * not a conversion of it (a member's own as well). A temperature difference converts by 5/9, never by the +32 of a reading.
 */
export function convertFrame(form: FrameForm, to: UnitSystem): FrameForm {
  const from = form.units;
  if (from === to) return form;
  const c = (v: number, q: Quantity): number => convert(v, q, from, to);
  const opt = (v: number | null, q: Quantity) => (v === null ? null : c(v, q));
  const modulus = (v: number | null) => {
    const listed = listedModulus(v, from);
    return listed ? FRAME_MATERIALS[listed].E[to] : opt(v, 'E');
  };
  const alpha = (v: number) => {
    const listed = listedAlpha(v, from);
    return listed ? FRAME_MATERIALS[listed].alpha[to] : c(v, 'alpha');
  };
  return {
    ...form,
    units: to,
    nodes: form.nodes.map((n) => ({ ...n, x: c(n.x, 'length'), y: c(n.y, 'length') })),
    members: form.members.map((m) => ({ ...m, A: opt(m.A, 'area'), I: opt(m.I, 'inertia'), E: modulus(m.E), h: opt(m.h, 'depth') })),
    supports: form.supports.map((s) => ({ ...s, kx: c(s.kx, 'line'), ky: c(s.ky, 'line'), kr: c(s.kr, 'moment'), dx: c(s.dx, 'depth'), dy: c(s.dy, 'depth') })),
    loads: form.loads.map((l) => ({ ...l, fx: c(l.fx, 'force'), fy: c(l.fy, 'force'), m: c(l.m, 'moment') })),
    memberLoads: form.memberLoads.map((l) => ({
      ...l,
      w: c(l.w, 'line'),
      w2: c(l.w2, 'line'),
      P: c(l.P, 'force'),
      M: c(l.M, 'moment'),
      a: c(l.a, 'length'),
      b: c(l.b, 'length'),
      dT: c(l.dT, 'temperature'),
      dTg: c(l.dTg, 'temperature'),
      alpha: alpha(l.alpha),
    })),
    E: form.material !== 'custom' && form.E === FRAME_MATERIALS[form.material].E[from] ? FRAME_MATERIALS[form.material].E[to] : modulus(form.E),
    A: opt(form.A, 'area'),
    I: opt(form.I, 'inertia'),
    notice: null,
  };
}

/** What the template group holds, in the other system: lengths and the rise, the line load and the forces are converted; the counts, the base and the hinge stay. */
export function convertTemplateParams<T extends Partial<TemplateParams>>(params: T, from: UnitSystem, to: UnitSystem): T {
  if (from === to) return params;
  const out: Partial<TemplateParams> = { ...params };
  for (const k of ['width', 'height', 'rise'] as const) if (typeof params[k] === 'number') out[k] = convert(params[k]!, 'length', from, to);
  if (typeof params.gravity === 'number') out.gravity = convert(params.gravity, 'line', from, to);
  for (const k of ['lateral', 'axial'] as const) if (typeof params[k] === 'number') out[k] = convert(params[k]!, 'force', from, to);
  return out as T;
}

/* ── What each edit does to the form ──────────────────────────────────── */

export type FrameAction =
  /** Opens a whole frame. The form it is given IS the new state (the same object): the page tells "opened whole" from "edited" by that. */
  | { type: 'load'; form: FrameForm }
  /** Start over: the form it is given (the same object), or the example when there is none. */
  | { type: 'reset'; form?: FrameForm }
  /** Takes everything out of the frame: units, material and section stay. */
  | { type: 'clear' }
  | { type: 'units'; units: UnitSystem }
  /** Replaces the geometry, supports and loads by a template's; units and section stay. Parameters are in the form's units. */
  | { type: 'template'; template: TemplateId; params?: Partial<TemplateParams> }
  /** A row is added at the end. `seed` fills what the visitor already chose (a node for a support or a load; the two nodes of a member; the member and kind of a member load). */
  | { type: 'add'; list: FrameList; seed?: Record<string, unknown> }
  | { type: 'remove'; list: FrameList; id: number }
  | { type: 'patch'; list: FrameList; id: number; patch: Record<string, unknown> }
  | { type: 'section'; patch: { E?: number | null; A?: number | null; I?: number | null } }
  /** A section preset (SECTION_PRESETS): into the frame's A and I, or into the A and I of the member whose id is given. */
  | { type: 'preset'; preset: string; member?: number }
  | { type: 'material'; material: FrameMaterial };

const isNode = (form: FrameForm, id: unknown): id is number => typeof id === 'number' && form.nodes.some((n) => n.id === id);
const isMember = (form: FrameForm, id: unknown): id is number => typeof id === 'number' && form.members.some((m) => m.id === id);

/** The unit step a new node is placed at from the last one. */
const stepOf = (units: UnitSystem) => (units === 'us' ? 8 : 2.5);

const num = (v: unknown, fallback: number): number => (typeof v === 'number' ? v : fallback);

/** A member's length from the form, or 0 where a coordinate is not a number. */
export function memberLength(form: FrameForm, m: MemberRow): number {
  const a = form.nodes.find((n) => n.id === m.i);
  const b = form.nodes.find((n) => n.id === m.j);
  if (!a || !b) return 0;
  const L = Math.hypot(b.x - a.x, b.y - a.y);
  return Number.isFinite(L) ? L : 0;
}

export function reduceFrame(form: FrameForm, action: FrameAction): FrameForm {
  const next = (patch: Partial<FrameForm>): FrameForm => ({ ...form, notice: null, ...patch });
  switch (action.type) {
    case 'load':
      // The form that comes in is the form that stays, so that a caller can tell it from one edited afterwards (`===`).
      return action.form;
    case 'reset':
      return action.form ?? defaultFrame();
    case 'clear':
      return { ...emptyFrame(form.units), material: form.material, E: form.E, A: form.A, I: form.I };
    case 'units':
      return convertFrame(form, action.units);
    case 'template': {
      const t = buildTemplate(action.template, action.params ?? {}, form.units);
      return next({ ...rowsOf(t, 1), notice: t.clamped.length > 0 ? { code: 'template', template: action.template, clamped: t.clamped } : null });
    }
    case 'material': {
      if (action.material === 'custom') return next({ material: 'custom' });
      const steel = FRAME_MATERIALS[action.material];
      return next({
        material: action.material,
        E: steel.E[form.units],
        // The temperature loads that carry the previous listed material's α follow the material.
        memberLoads: form.memberLoads.map((l) => (l.kind === 'temperature' && listedAlpha(l.alpha, form.units) !== null ? { ...l, alpha: steel.alpha[form.units] } : l)),
      });
    }
    case 'section': {
      const patch: Partial<FrameForm> = {};
      if ('E' in action.patch) {
        patch.E = action.patch.E ?? null;
        // A modulus typed over a listed material's is the visitor's own.
        if (form.material !== 'custom' && patch.E !== FRAME_MATERIALS[form.material].E[form.units]) patch.material = 'custom';
      }
      if ('A' in action.patch) patch.A = action.patch.A ?? null;
      if ('I' in action.patch) patch.I = action.patch.I ?? null;
      return next(patch);
    }
    case 'preset': {
      const v = presetValues(action.preset, form.units);
      if (!v) return form;
      if (action.member === undefined) return next({ A: v.A, I: v.I });
      if (!isMember(form, action.member)) return form;
      return next({ members: form.members.map((m) => (m.id === action.member ? { ...m, A: v.A, I: v.I } : m)) });
    }
    case 'add':
      return add(form, action.list, action.seed ?? {});
    case 'remove':
      return remove(form, action.list, action.id);
    case 'patch':
      return patch(form, action.list, action.id, action.patch);
  }
}

const near = (a: number, b: number) => Math.abs(a - b) <= 1e-9 * Math.max(1, Math.abs(a), Math.abs(b));

function add(form: FrameForm, list: FrameList, seed: Record<string, unknown>): FrameForm {
  if (form[list].length >= LIMITS[list]) return { ...form, notice: { code: 'limit', list, max: LIMITS[list] } };
  const id = form.nextId;
  const us = form.units === 'us';
  const step = stepOf(form.units);
  switch (list) {
    case 'nodes': {
      if (typeof seed.x === 'number' || typeof seed.y === 'number') {
        const last = form.nodes[form.nodes.length - 1];
        return { ...form, notice: null, nodes: [...form.nodes, { id, x: num(seed.x, last ? last.x : 0), y: num(seed.y, last ? last.y : 0) }], nextId: id + 1 };
      }
      const last = form.nodes[form.nodes.length - 1];
      const taken = (x: number, y: number) => form.nodes.some((n) => near(n.x, x) && near(n.y, y));
      if (!last) return { ...form, notice: null, nodes: [{ id, x: 0, y: 0 }], nextId: id + 1 };
      const ox = Number.isFinite(last.x) ? last.x : 0;
      const oy = Number.isFinite(last.y) ? last.y : 0;
      // Beside the last node: to its right, then above it, to its left, below it, and then further out.
      const offsets: [number, number][] = [];
      for (let ring = 1; ring <= 40; ring++) offsets.push([ring, 0], [0, ring], [-ring, 0], [0, -ring]);
      for (const [kx, ky] of offsets) {
        const x = eight(ox + kx * step);
        const y = eight(oy + ky * step);
        if (!taken(x, y)) return { ...form, notice: null, nodes: [...form.nodes, { id, x, y }], nextId: id + 1 };
      }
      return { ...form, notice: null, nodes: [...form.nodes, { id, x: eight(ox + 41 * step), y: oy }], nextId: id + 1 };
    }
    case 'members': {
      let i: number | undefined = isNode(form, seed.i) ? seed.i : undefined;
      let j: number | undefined = isNode(form, seed.j) ? seed.j : undefined;
      const joined = (a: number, b: number) => form.members.some((m) => (m.i === a && m.j === b) || (m.i === b && m.j === a));
      const at = (n: number) => form.nodes.find((r) => r.id === n)!;
      const apart = (a: number, b: number) => !(near(at(a).x, at(b).x) && near(at(a).y, at(b).y));
      if (i === undefined || j === undefined) {
        // Between two nodes that have no member yet: the last node and the nearest it is not joined to; failing that, the first free pair.
        const ids = form.nodes.map((n) => n.id);
        let found: [number, number] | undefined;
        for (let a = ids.length - 1; a >= 0 && !found; a--) {
          const others = ids.filter((b) => b !== ids[a] && !joined(ids[a], b) && apart(ids[a], b)).sort((p, r) => Math.hypot(at(p).x - at(ids[a]).x, at(p).y - at(ids[a]).y) - Math.hypot(at(r).x - at(ids[a]).x, at(r).y - at(ids[a]).y));
          if (others.length > 0) found = [ids[a], others[0]];
        }
        if (!found) return { ...form, notice: { code: 'nothing-to-add', list: 'members', why: 'pairs' } };
        [i, j] = found;
      }
      if (i === j || joined(i, j)) return { ...form, notice: { code: 'nothing-to-add', list: 'members', why: 'pairs' } };
      return { ...form, notice: null, members: [...form.members, { id, i, j, A: null, I: null, E: null, hingeStart: false, hingeEnd: false, h: null }], nextId: id + 1 };
    }
    case 'supports': {
      const taken = new Set(form.supports.map((s) => s.node));
      let node: number | undefined = isNode(form, seed.node) ? seed.node : undefined;
      if (node === undefined) {
        // The lowest node without a support (then the leftmost): where a support goes.
        const free = form.nodes.filter((n) => !taken.has(n.id)).sort((p, q) => p.y - q.y || p.x - q.x);
        node = free[0]?.id;
      }
      if (node === undefined) return { ...form, notice: { code: 'nothing-to-add', list: 'supports', why: form.nodes.length === 0 ? 'no-node' : 'nodes' } };
      const kind: FrameSupportKind = typeof seed.kind === 'string' && SUPPORT_KINDS.includes(seed.kind as FrameSupportKind) ? (seed.kind as FrameSupportKind) : form.supports.length === 0 ? 'fixed' : 'pin';
      const row = supportRow(id, node, kind, num(seed.angle, 90));
      return { ...form, notice: null, supports: [...form.supports, row], nextId: id + 1 };
    }
    case 'loads': {
      let node: number | undefined = isNode(form, seed.node) ? seed.node : undefined;
      if (node === undefined) {
        // The highest node that carries no load yet (then the leftmost): gravity goes on the top.
        const loaded = new Set(form.loads.map((l) => l.node));
        const order = [...form.nodes].sort((p, q) => q.y - p.y || p.x - q.x);
        node = (order.find((n) => !loaded.has(n.id)) ?? order[0])?.id;
      }
      if (node === undefined) return { ...form, notice: { code: 'nothing-to-add', list: 'loads', why: 'no-node' } };
      return { ...form, notice: null, loads: [...form.loads, { id, node, fx: num(seed.fx, 0), fy: num(seed.fy, us ? -10 : -40), m: num(seed.m, 0) }], nextId: id + 1 };
    }
    case 'memberLoads': {
      let member: number | undefined = isMember(form, seed.member) ? seed.member : undefined;
      if (member === undefined) {
        // The member with the fewest loads, the most horizontal and longest first.
        const count = (m: MemberRow) => form.memberLoads.filter((l) => l.member === m.id).length;
        const order = [...form.members].sort((p, q) => count(p) - count(q) || memberLength(form, q) - memberLength(form, p));
        member = order[0]?.id;
      }
      if (member === undefined) return { ...form, notice: { code: 'nothing-to-add', list: 'memberLoads', why: form.members.length === 0 ? 'no-member' : 'no-member' } };
      const kind: MemberLoadKind = typeof seed.kind === 'string' && MEMBER_LOAD_KINDS.includes(seed.kind as MemberLoadKind) ? (seed.kind as MemberLoadKind) : 'udl';
      const m = form.members.find((r) => r.id === member)!;
      const L = memberLength(form, m);
      // A free position: the middle, then the quarters and the eighths, the first that no point load or couple on this member is on.
      const used = form.memberLoads.filter((l) => l.member === member && (l.kind === 'point' || l.kind === 'moment')).map((l) => l.a);
      let a = eight(L / 2);
      for (const f of [0.5, 0.25, 0.75, 0.125, 0.375, 0.625, 0.875, 0.0625, 0.1875, 0.3125, 0.4375, 0.5625, 0.6875, 0.8125, 0.9375]) {
        const x = eight(L * f);
        if (!used.some((u) => near(u, x))) {
          a = x;
          break;
        }
      }
      const gravity = us ? -1 : -10;
      const row = memberLoadRow(id, member, { kind });
      switch (kind) {
        case 'udl':
        case 'udl-projected':
          row.w = num(seed.w, gravity);
          break;
        case 'trapezoid':
          row.a = 0;
          row.b = eight(L);
          row.w = num(seed.w, gravity);
          row.w2 = num(seed.w2, gravity * 2);
          break;
        case 'point':
          row.a = num(seed.a, a);
          row.P = num(seed.P, us ? -10 : -40);
          break;
        case 'moment':
          row.a = num(seed.a, a);
          row.M = num(seed.M, us ? 10 : 15);
          break;
        case 'temperature':
          row.dT = num(seed.dT, us ? 50 : 30);
          row.alpha = FRAME_MATERIALS[form.material === 'aluminum' ? 'aluminum' : 'steel'].alpha[form.units];
          break;
      }
      if (typeof seed.dir === 'string' && (LOAD_DIRS as string[]).includes(seed.dir) && !(kind === 'udl-projected' && !seed.dir.startsWith('global'))) row.dir = seed.dir as FrameLoadDir;
      return { ...form, notice: null, memberLoads: [...form.memberLoads, row], nextId: id + 1 };
    }
  }
}

function remove(form: FrameForm, list: FrameList, id: number): FrameForm {
  if (list === 'members') {
    const at = form.members.findIndex((r) => r.id === id);
    if (at < 0) return form;
    const memberLoads = form.memberLoads.filter((l) => l.member !== id);
    const renumbered = at < form.members.length - 1;
    return { ...form, notice: { code: 'member-removed', member: at + 1, memberLoads: form.memberLoads.length - memberLoads.length, renumbered }, members: form.members.filter((r) => r.id !== id), memberLoads };
  }
  if (list !== 'nodes') {
    const at = form[list].findIndex((r) => r.id === id);
    if (at < 0) return form;
    return { ...form, notice: null, [list]: (form[list] as { id: number }[]).filter((r) => r.id !== id) };
  }
  const index = form.nodes.findIndex((n) => n.id === id);
  if (index < 0) return form;
  const gone = form.members.map((m, k) => (m.i === id || m.j === id ? k + 1 : 0)).filter((k) => k > 0);
  const goneIds = new Set(form.members.filter((m) => m.i === id || m.j === id).map((m) => m.id));
  const kept = form.members.map((_, k) => k + 1).filter((label) => !gone.includes(label));
  const membersRenumbered = kept.some((label, k) => label !== k + 1);
  const supports = form.supports.filter((s) => s.node !== id);
  const loads = form.loads.filter((l) => l.node !== id);
  const memberLoads = form.memberLoads.filter((l) => !goneIds.has(l.member));
  return {
    ...form,
    nodes: form.nodes.filter((n) => n.id !== id),
    members: form.members.filter((m) => m.i !== id && m.j !== id),
    supports,
    loads,
    memberLoads,
    notice: {
      code: 'node-removed',
      node: index + 1,
      members: gone,
      supports: form.supports.length - supports.length,
      loads: form.loads.length - loads.length,
      memberLoads: form.memberLoads.length - memberLoads.length,
      renumbered: index < form.nodes.length - 1,
      membersRenumbered,
    },
  };
}

/** What each list lets a patch change. */
const ALLOWED: Record<FrameList, string[]> = {
  nodes: ['x', 'y'],
  members: ['i', 'j', 'A', 'I', 'E', 'h', 'hingeStart', 'hingeEnd'],
  supports: ['node', 'kind', 'angle', 'kx', 'ky', 'kr', 'dx', 'dy', 'dr'],
  loads: ['node', 'fx', 'fy', 'm'],
  memberLoads: ['member', 'kind', 'dir', 'w', 'w2', 'P', 'M', 'a', 'b', 'dT', 'dTg', 'alpha'],
};

function patch(form: FrameForm, list: FrameList, id: number, change: Record<string, unknown>): FrameForm {
  const clean: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(change)) {
    if (!ALLOWED[list].includes(key)) continue;
    if (key === 'i' || key === 'j' || key === 'node') {
      if (isNode(form, value)) clean[key] = value;
    } else if (key === 'member') {
      if (isMember(form, value)) clean[key] = value;
    } else if (key === 'kind') {
      if (list === 'supports' && SUPPORT_KINDS.includes(value as FrameSupportKind)) clean[key] = value;
      if (list === 'memberLoads' && MEMBER_LOAD_KINDS.includes(value as MemberLoadKind)) clean[key] = value;
    } else if (key === 'dir') {
      if ((LOAD_DIRS as string[]).includes(value as string)) clean[key] = value;
    } else if (key === 'hingeStart' || key === 'hingeEnd') {
      if (typeof value === 'boolean') clean[key] = value;
    } else if (key === 'A' || key === 'I' || key === 'E' || key === 'h') {
      if (value === null || typeof value === 'number') clean[key] = value;
    } else if (typeof value === 'number') clean[key] = value;
  }
  if (Object.keys(clean).length === 0 || !form[list].some((r) => r.id === id)) return form;
  return {
    ...form,
    notice: null,
    [list]: (form[list] as { id: number }[]).map((r) => {
      if (r.id !== id) return r;
      const row = { ...r, ...clean } as unknown as MemberLoadRow;
      // A projected load can only be global.
      if (list === 'memberLoads' && row.kind === 'udl-projected' && !row.dir.startsWith('global')) row.dir = 'global-y';
      return row;
    }),
  };
}

/* ── From the form to the engine ──────────────────────────────────────── */

/** A row of the form, as an issue names it. */
export type FrameRow = { list: FrameList; id: number; field?: string } | { list: 'model'; field: 'E' | 'A' | 'I' };

export interface EngineInput {
  model: FrameModel;
  /** The id of the row behind each entry of the model, by index: what an issue's `where.index` points at. */
  rows: { nodes: number[]; members: number[]; supports: number[]; loads: number[]; memberLoads: number[] };
}

/**
 * The model the engine takes, in feet and kips or metres and kilonewtons. A reference to a node or a member that is not
 * there is index −1, which the engine refuses; a number that is NaN stays NaN, which it reports ('number', 'section').
 * A value null is left out.
 */
export function toEngine(form: FrameForm): EngineInput {
  const nodeAt = new Map(form.nodes.map((n, k) => [n.id, k]));
  const memberAt = new Map(form.members.map((m, k) => [m.id, k]));
  const at = (id: number) => nodeAt.get(id) ?? -1;
  const k = TO_ENGINE[form.units];
  const model: FrameModel = {
    nodes: form.nodes.map((n) => ({ x: n.x, y: n.y })),
    members: form.members.map((m) => ({
      i: at(m.i),
      j: at(m.j),
      ...(m.A !== null ? { A: m.A * k.area } : {}),
      ...(m.I !== null ? { I: m.I * k.inertia } : {}),
      ...(m.E !== null ? { E: m.E * k.E } : {}),
      ...(m.hingeStart || m.hingeEnd ? { releases: { start: m.hingeStart, end: m.hingeEnd } } : {}),
      ...(m.h !== null ? { h: m.h * k.depth } : {}),
    })),
    supports: form.supports.map((s) => ({
      node: at(s.node),
      kind: s.kind,
      ...(s.kind === 'roller' || s.kind === 'guide' ? { angle: s.angle } : {}),
      ...(s.kx !== 0 ? { kx: s.kx } : {}),
      ...(s.ky !== 0 ? { ky: s.ky } : {}),
      ...(s.kr !== 0 ? { kr: s.kr } : {}),
      ...(s.dx !== 0 ? { dx: s.dx * k.depth } : {}),
      ...(s.dy !== 0 ? { dy: s.dy * k.depth } : {}),
      ...(s.dr !== 0 ? { dr: s.dr } : {}),
    })),
    loads: form.loads.map((l) => ({ node: at(l.node), fx: l.fx, fy: l.fy, m: l.m })),
    memberLoads: form.memberLoads.map((l): FrameMemberLoad => {
      const member = memberAt.get(l.member) ?? -1;
      switch (l.kind) {
        case 'udl':
          return { kind: 'udl', member, dir: l.dir, w: l.w };
        case 'udl-projected':
          return { kind: 'udl-projected', member, dir: l.dir === 'global-x' ? 'global-x' : 'global-y', w: l.w };
        case 'trapezoid':
          return { kind: 'trapezoid', member, dir: l.dir, a: l.a, b: l.b, w1: l.w, w2: l.w2 };
        case 'point':
          return { kind: 'point', member, dir: l.dir, a: l.a, P: l.P };
        case 'moment':
          return { kind: 'moment', member, a: l.a, M: l.M };
        default:
          return { kind: 'temperature', member, dT: l.dT, dTg: l.dTg, alpha: l.alpha };
      }
    }),
    ...(form.E !== null ? { E: form.E * k.E } : {}),
    ...(form.A !== null ? { A: form.A * k.area } : {}),
    ...(form.I !== null ? { I: form.I * k.inertia } : {}),
  };
  return {
    model,
    rows: { nodes: form.nodes.map((n) => n.id), members: form.members.map((m) => m.id), supports: form.supports.map((s) => s.id), loads: form.loads.map((l) => l.id), memberLoads: form.memberLoads.map((l) => l.id) },
  };
}

/** The row of the form an engine issue is about, when it is about one row. */
export function issueRow(issue: FrameIssue, rows: EngineInput['rows']): FrameRow | undefined {
  const w = issue.where;
  if (!w) return undefined;
  if (w.list === 'model') return { list: 'model', field: w.field === 'A' ? 'A' : w.field === 'I' ? 'I' : 'E' };
  const id = rows[w.list][w.index];
  return id === undefined ? undefined : { list: w.list, id, ...(w.field ? { field: w.field } : {}) };
}

/** A node's label: its place in the list, from 1. 0 for an id that is not there. */
export function nodeLabel(form: FrameForm, id: number): number {
  return form.nodes.findIndex((n) => n.id === id) + 1;
}
export function memberLabel(form: FrameForm, id: number): number {
  return form.members.findIndex((m) => m.id === id) + 1;
}

/* ── The case in an address ───────────────────────────────────────────── */

const MATERIAL_LETTER: Record<FrameMaterial, string> = { steel: 's', aluminum: 'a', custom: 'u' };
const SUPPORT_LETTER: Record<FrameSupportKind, string> = { fixed: 'f', pin: 'p', roller: 'r', guide: 'g', spring: 's' };
const LOAD_LETTER: Record<MemberLoadKind, string> = { udl: 'u', 'udl-projected': 'j', trapezoid: 't', point: 'p', moment: 'm', temperature: 'e' };

/** A number as THIS address carries it: fifteen significant figures, so that a converted frame comes back as it was. */
const written15 = (v: number): string => (Number.isFinite(v) ? String(Number(v.toPrecision(15))).replace('e+', 'e') : written(v));

/**
 * Whether replacing `before` by `after` throws a frame away that nobody could get back: it is not the example (which "Start
 * over" brings back) and it is not what `after` is. The page then leaves it one step behind in the browser's history, so
 * that Back restores it - for "Start over" and for "Load template" alike.
 */
export function leavesBehind(before: FrameForm, after: FrameForm, example: string): boolean {
  const was = encodeFrame(before);
  return was !== example && was !== encodeFrame(after);
}

/** The version of the address, its first field. A reader of another version returns null; it is raised only if the format changes. */
const VERSION = '1';

/*
 * The longest address a form can write: 50 nodes, 100 members, 40 supports, 60 nodal loads and 120 member loads, every
 * number at its longest (22 characters). model.test.ts writes it and reads it back. Every ordinary frame is under 2,000 characters.
 */
export const MAX_LINK = 60000;

/**
 * The case as a short string for the page's address (after `#f=`), so a link opens the same frame. Written as the other calculators
 * write theirs: each number to fifteen figures, nothing but numbers, a few letters and the separators `; _ ,`. Eight fields, the rows
 * of a list joined by `_`, trailing default fields of a row left out:
 *
 *     version ; units ; section ; nodes ; members ; supports ; loads ; member loads
 *
 *   version   1
 *   units     us | si
 *   section   material letter (s steel, a aluminum, u the visitor's own), E, A, I — each empty when not given:  s,29000,14.1,484
 *   a node    x,y
 *   a member  i,j,A,I,E,hinges,h    i and j are NODE NUMBERS (labels, from 1); A, I, E, h empty when the member has none;
 *             hinges is 0 or empty (none), 1 (at the start), 2 (at the end), 3 (both).   1,3,,,,2   1,2,10,400,29000,0,12
 *   a support kind,node,angle,kx,ky,kr,dx,dy,dr    kind f fixed, p pin, r roller, g guide, s spring; angle 90 and the zeros are left out
 *             at the end:  f,1   or   r,2,45   or   s,3,90,0,150
 *   a load    node,fx,fy,m   (m may be left out when 0)
 *   a member load  kind,member,dir,w,w2,P,M,a,b,dT,dTg,alpha    kind u udl, j projected, t trapezoid, p point, m moment, e temperature;
 *             member is a MEMBER NUMBER (label); dir 0 local-y, 1 local-x, 2 global-x, 3 global-y; trailing zeros left out
 *
 * A link carries no ids: the rows are numbered again on reading, nodes first, then members, supports, loads and member loads.
 * WHATEVER THE FORM HOLDS IS WRITTEN and read back as that form — a node with no member, a number that is NaN, a member from
 * a node to itself — so that a reload comes back to the frame that was on screen, with its warning.
 *
 * IT BEGINS WITH A CHECK of the rest, the first calculator's (`checkOf`): a link cut short, or with a character more, less or
 * changed, is not a link to another frame.
 */
export function encodeFrame(form: FrameForm): string {
  const n = written15;
  const optional = (v: number | null) => (v === null ? '' : n(v));
  const trim = (fields: string[], keep: number, defaults: string[] = []): string => {
    let end = fields.length;
    while (end > keep && (fields[end - 1] === '' || fields[end - 1] === (defaults[end - 1] ?? '\u0000'))) end--;
    return fields.slice(0, end).join(',');
  };
  const label = (id: number) => nodeLabel(form, id);
  const body = [
    VERSION,
    form.units,
    `${MATERIAL_LETTER[form.material]},${optional(form.E)},${optional(form.A)},${optional(form.I)}`,
    form.nodes.map((p) => `${n(p.x)},${n(p.y)}`).join('_'),
    form.members
      .map((m) => trim([String(label(m.i)), String(label(m.j)), optional(m.A), optional(m.I), optional(m.E), String((m.hingeStart ? 1 : 0) + (m.hingeEnd ? 2 : 0)), optional(m.h)], 2, ['', '', '', '', '', '0']))
      .join('_'),
    form.supports
      .map((s) => trim([SUPPORT_LETTER[s.kind], String(label(s.node)), n(s.angle), n(s.kx), n(s.ky), n(s.kr), n(s.dx), n(s.dy), n(s.dr)], 2, ['', '', '90', '0', '0', '0', '0', '0', '0']))
      .join('_'),
    form.loads.map((l) => trim([String(label(l.node)), n(l.fx), n(l.fy), n(l.m)], 3, ['', '', '', '0'])).join('_'),
    form.memberLoads
      .map((l) => trim([LOAD_LETTER[l.kind], String(memberLabel(form, l.member)), String(LOAD_DIRS.indexOf(l.dir)), n(l.w), n(l.w2), n(l.P), n(l.M), n(l.a), n(l.b), n(l.dT), n(l.dTg), n(l.alpha)], 3, ['', '', '', '0', '0', '0', '0', '0', '0', '0', '0', '0']))
      .join('_'),
  ].join(';');
  return `${checkOf(body)};${body}`;
}
/** The shell's names for the same two. */
export const encode = encodeFrame;

/**
 * The frame a string from `encodeFrame` describes, or `null` if it is anything else: a check that is not the rest's, a version
 * that is not 1, not eight fields, a number in any notation but the page's own, more rows than the cap, a row that names a node
 * or a member that is not in the list, a letter that is none of the known ones. Never throws, whatever the string is: it comes
 * back from wherever a link was pasted.
 */
export function decodeFrame(text: string): FrameForm | null {
  try {
    return read(text);
  } catch {
    return null;
  }
}
export const decode = decodeFrame;

function read(text: string): FrameForm | null {
  if (typeof text !== 'string' || text.length > MAX_LINK) return null;
  const body = checked(text);
  if (body === null) return null;
  const parts = body.split(';');
  if (parts.length !== 8) return null;
  const [version, units, sectionText, nodeText, memberText, supportText, loadText, memberLoadText] = parts;
  if (version !== VERSION || (units !== 'us' && units !== 'si')) return null;
  let bad = false;
  const num = (s: string | undefined, fallback?: number): number => {
    if (s === undefined || s === '') {
      if (fallback === undefined) bad = true;
      return fallback ?? 0;
    }
    const named = NAMED.get(s);
    if (named !== undefined) return named;
    // Fifteen figures, as they are written: a link made by hand with more reads as the number the page would have written.
    const v = NUMBER.test(s) ? Number(Number(s).toPrecision(15)) : Number.NaN;
    if (!Number.isFinite(v)) bad = true;
    // As a number, a written −0 is a plain zero.
    return v + 0;
  };
  const optional = (s: string | undefined): number | null => (s === undefined || s === '' ? null : num(s));
  const rows = (s: string, fewest: number, most: number, cap: number): string[][] => {
    if (s === '') return [];
    const list = s.split('_').map((r) => r.split(','));
    if (list.length <= cap && list.every((r) => r.length >= fewest && r.length <= most)) return list;
    bad = true;
    return [];
  };
  const section = sectionText.split(',');
  if (section.length !== 4) return null;
  const material = (Object.keys(MATERIAL_LETTER) as FrameMaterial[]).find((key) => MATERIAL_LETTER[key] === section[0]);
  if (!material) return null;
  const E = optional(section[1]);
  const A = optional(section[2]);
  const I = optional(section[3]);

  const nodeRows = rows(nodeText, 2, 2, MAX_NODES);
  if (bad) return null;
  let id = 1;
  const nodes: NodeRow[] = nodeRows.map(([x, y]) => ({ id: id++, x: num(x), y: num(y) }));
  const labelOf = (s: string | undefined, count: number): number => {
    if (s === undefined || !/^[1-9]\d{0,2}$/.test(s) || Number(s) > count) {
      bad = true;
      return 0;
    }
    return Number(s) - 1;
  };
  const nodeIdOf = (s: string | undefined): number => {
    const k = labelOf(s, nodes.length);
    return bad ? 0 : nodes[k].id;
  };
  const hingesOf = (s: string | undefined): number => {
    if (s === undefined || s === '' || s === '0') return 0;
    if (/^[123]$/.test(s)) return Number(s);
    bad = true;
    return 0;
  };
  const members: MemberRow[] = rows(memberText, 2, 7, MAX_MEMBERS).map(([i, j, a, ii, e, hinges, h]) => {
    const flags = hingesOf(hinges);
    return { id: id++, i: nodeIdOf(i), j: nodeIdOf(j), A: optional(a), I: optional(ii), E: optional(e), hingeStart: (flags & 1) !== 0, hingeEnd: (flags & 2) !== 0, h: optional(h) };
  });
  const kinds = Object.entries(SUPPORT_LETTER) as [FrameSupportKind, string][];
  const supports: SupportRow[] = rows(supportText, 2, 9, MAX_SUPPORTS).map((r) => {
    const kind = kinds.find(([, letter]) => letter === r[0])?.[0];
    if (!kind) bad = true;
    return {
      id: id++,
      node: nodeIdOf(r[1]),
      kind: kind ?? 'pin',
      angle: num(r[2], 90),
      kx: num(r[3], 0),
      ky: num(r[4], 0),
      kr: num(r[5], 0),
      dx: num(r[6], 0),
      dy: num(r[7], 0),
      dr: num(r[8], 0),
    };
  });
  const loads: LoadRow[] = rows(loadText, 3, 4, MAX_NODAL_LOADS).map(([node, fx, fy, m]) => ({ id: id++, node: nodeIdOf(node), fx: num(fx), fy: num(fy), m: num(m, 0) }));
  const loadKinds = Object.entries(LOAD_LETTER) as [MemberLoadKind, string][];
  const memberLoads: MemberLoadRow[] = rows(memberLoadText, 3, 12, MAX_MEMBER_LOADS).map((r) => {
    const kind = loadKinds.find(([, letter]) => letter === r[0])?.[0];
    if (!kind) bad = true;
    const m = labelOf(r[1], members.length);
    const dirIndex = /^[0-3]$/.test(r[2] ?? '') ? Number(r[2]) : -1;
    if (dirIndex < 0) bad = true;
    return {
      id: id++,
      member: bad ? 0 : members[m].id,
      kind: kind ?? 'udl',
      dir: LOAD_DIRS[Math.max(dirIndex, 0)],
      w: num(r[3], 0),
      w2: num(r[4], 0),
      P: num(r[5], 0),
      M: num(r[6], 0),
      a: num(r[7], 0),
      b: num(r[8], 0),
      dT: num(r[9], 0),
      dTg: num(r[10], 0),
      alpha: num(r[11], 0),
    };
  });
  if (bad) return null;
  return { units, nodes, members, supports, loads, memberLoads, material, E, A, I, notice: null, nextId: id };
}
