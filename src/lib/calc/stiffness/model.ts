import { NAMED, NUMBER, US_TO_SI, checkOf, checked, type UnitSystem } from '../beam/model';
import { TEMPLATE_IDS, buildTemplate, type TemplateId } from './templates';
import {
  MAX_LOADS,
  MAX_MEMBERS,
  MAX_MEMBER_LOADS,
  MAX_NODES,
  MAX_SUPPORTS,
  type Issue,
  type ListName,
  type Mode,
  type StiffnessMemberLoad,
  type StiffnessModel,
} from './types';

export type { UnitSystem };
export { MAX_LOADS, MAX_MEMBERS, MAX_MEMBER_LOADS, MAX_NODES, MAX_SUPPORTS };

/**
 * ─────────────────────────────────────────────────────────────────────────────
 * STIFFNESS MATRIX, STEP BY STEP — what the visitor edits, and what the engine is given
 * ─────────────────────────────────────────────────────────────────────────────
 * Between the form of the ninth calculator ("Stiffness matrix, step by step") and its engine (types.ts is the agreement
 * between the two). Pure functions, no React: the structure as entered (`StiffnessForm`), what each edit does to it
 * (`reduceStiffness`), the model the engine takes and which row of the form each of its entries is (`toEngine`, `issueRow`), the
 * same structure in the other unit system (`convertStiffness`), and the address that carries the case from one engineer to
 * another. The rest of the shell's wants of a model: `defaultCase()`, `encode(form)`, `decode(text)` (null for an address that cannot be
 * read), and a reducer whose `'load'` and `'reset'` return the form they are given ITSELF.
 *
 * THE FORM HOLDS NUMBERS, not the text typed (the field component is where text is); a field that is not a number yet commits NaN,
 * which the engine reports against its row ('number'). `null` is "not given" for E, A and I (the structure's and a member's). A field a
 * mode does not use (the moment of a load, the rotation of a support, I, the member loads in truss mode) is kept and ignored.
 * NO CHOICE IS A NUMBER: the mode, the units, the material, a member load's kind are strings and a support's restraints are
 * booleans; the numbers that are references (`id`, `i`, `j`, `node`, `member`, `nextId`) are the only ones a "choices of the form"
 * helper has to keep (the plane frame calculator's `choicesOf` does, unchanged).
 *
 * UNITS. The form holds numbers in the units it SHOWS (`STIFFNESS_UNITS`):
 *
 *     US   ft, kip, kip/ft, kip·ft;  A in², I in⁴, E ksi;  settlements in inches (rotation in radians)
 *     SI   m,  kN,  kN/m,   kN·m;    A mm², I 10⁶ mm⁴, E GPa;  settlements in millimetres
 *
 * The engine takes any consistent set and is given feet and kips or metres and kilonewtons (and radians). EVERY conversion lives in
 * this file: the section and the settlements cross in ONE place (`TO_ENGINE`), the displacements come back through `FROM_ENGINE`, and
 * the other system's numbers are made by `convertStiffness` (`STIFFNESS_US_TO_SI`). A value of up to EIGHT significant figures comes
 * back from the other system as the very number it was.
 *
 * IDENTITY AND NUMBERS. Every row has an `id` that only ever grows (a removed row's is never reused). A member, a support and a load name their
 * node BY ITS ID, a member load its member. What the visitor sees are LABELS: a row's place in its list, from 1. Deleting a node
 * renumbers the labels after it and nothing else. DELETING A NODE takes with it every member attached, those members' loads and the
 * support and loads on it; DELETING A MEMBER takes its loads. The visitor is TOLD: `form.notice` carries the labels (in the numbering BEFORE the
 * removal), the counts, and whether anything was renumbered. The notice is transient: the next action replaces it, it is never written
 * in an address.
 *
 * THE CAP: 12 nodes, 20 members, 12 supports, 40 nodal loads, 24 member loads. An `'add'` past one is refused (the form is returned as it was
 * but for `notice = { code: 'limit', list, max }`), and so is one with nothing to add (`'nothing-to-add'` and why).
 *
 * THE ADDRESS is  #m=…  (`STIFFNESS_KEY`; #b beam, #s single span, #c continuous beam, #h shaft, #t truss, #k cable, #g cable sag and #f plane frame are
 * taken). See `encodeStiffness`.
 */

/** What this page's case is called in its address: `#m=…`. */
export const STIFFNESS_KEY = 'm';

/**
 * A form but for the numbers typed into it: its mode, units, material, its rows, every choice made in it (a restraint, a kind) — and the ids by which a row names a node or a
 * member, which are numbers but not typed ones: a member moved to another node is a different structure, solved in the render that shows it. A section left blank (null)
 * against one filled in (a number) is a choice too: JSON keeps a null and the typed numbers are zeroed. The notice is not part of the case. The plane frame calculator's
 * `choicesOf`, for this form.
 */
const IDENTIFIERS = new Set(['id', 'i', 'j', 'node', 'member', 'nextId']);
export const choicesOf = (form: unknown): string => JSON.stringify(form, (key, value: unknown) => (typeof value === 'number' && !IDENTIFIERS.has(key) ? 0 : key === 'notice' ? null : value));

/* ── The units ────────────────────────────────────────────────────────── */

export interface StiffnessUnitNames {
  length: string;
  force: string;
  line: string;
  moment: string;
  area: string;
  inertia: string;
  E: string;
  stress: string;
  displacement: string;
  rotation: string;
}
export const STIFFNESS_UNITS: Record<UnitSystem, StiffnessUnitNames> = {
  us: { length: 'ft', force: 'kip', line: 'kip/ft', moment: 'kip·ft', area: 'in²', inertia: 'in⁴', E: 'ksi', stress: 'ksi', displacement: 'in', rotation: 'rad' },
  si: { length: 'm', force: 'kN', line: 'kN/m', moment: 'kN·m', area: 'mm²', inertia: '10⁶ mm⁴', E: 'GPa', stress: 'MPa', displacement: 'mm', rotation: 'rad' },
};

/**
 * The units the solution's numbers are in (every step): the engine's. A stiffness entry of two translations is in `stiffness`, of a translation and a rotation in
 * `stiffnessCoupling` (force per radian), of two rotations in `stiffnessRotation` (moment per radian); `unitOf` says which for a pair of DOF kinds.
 */
export const CALCULATION_UNITS: Record<
  UnitSystem,
  { length: string; force: string; moment: string; E: string; area: string; inertia: string; line: string; stiffness: string; stiffnessCoupling: string; stiffnessRotation: string; rotation: string }
> = {
  us: { length: 'ft', force: 'kip', moment: 'kip·ft', E: 'kip/ft²', area: 'ft²', inertia: 'ft⁴', line: 'kip/ft', stiffness: 'kip/ft', stiffnessCoupling: 'kip/rad', stiffnessRotation: 'kip·ft/rad', rotation: 'rad' },
  si: { length: 'm', force: 'kN', moment: 'kN·m', E: 'kN/m²', area: 'm²', inertia: 'm⁴', line: 'kN/m', stiffness: 'kN/m', stiffnessCoupling: 'kN/rad', stiffnessRotation: 'kN·m/rad', rotation: 'rad' },
};

/**
 * The unit of an entry of a vector or a matrix of the steps, from the kinds of its DOFs (the last character of a DOF label: types.ts, `dofKind`):
 *   'displacement'  x, y: the length (ft, m);  θ: rad                          (u, u_F, u_R, u_e …)
 *   'force'         x, y: the force (kip, kN);  θ: the moment (kip·ft, kN·m)   (P, R, f, f_FE, the right-hand sides …)
 *   'stiffness'     x,y × x,y: kip/ft;  x,y × θ: kip/rad;  θ × θ: kip·ft/rad   (k, K_e, K, K_FF …; give both kinds)
 */
export function unitOf(system: UnitSystem, quantity: 'displacement' | 'force' | 'stiffness', row: 'x' | 'y' | 'θ', col?: 'x' | 'y' | 'θ'): string {
  const u = CALCULATION_UNITS[system];
  if (quantity === 'displacement') return row === 'θ' ? u.rotation : u.length;
  if (quantity === 'force') return row === 'θ' ? u.moment : u.force;
  const rotations = (row === 'θ' ? 1 : 0) + ((col ?? row) === 'θ' ? 1 : 0);
  return rotations === 0 ? u.stiffness : rotations === 1 ? u.stiffnessCoupling : u.stiffnessRotation;
}

/** Exact definitions: 1 ft = 0.3048 m; 1 kip = 4.4482216152605 kN; 1 in = 25.4 mm. */
const IN = 25.4;
export const STIFFNESS_US_TO_SI = {
  length: US_TO_SI.length,
  force: US_TO_SI.force,
  line: US_TO_SI.line,
  moment: US_TO_SI.moment,
  area: IN * IN, // in² → mm²
  inertia: IN ** 4 / 1e6, // in⁴ → 10⁶ mm⁴
  // ksi → GPa: kip/in² = 4.4482216152605 kN / 645.16 mm² = 0.0068947572932 kN/mm², and a kN/mm² is a GPa.
  E: US_TO_SI.force / (IN * IN),
  settlement: IN, // in → mm
} as const;

/** From what the form holds to what the engine is given (feet and kips; metres and kilonewtons). */
export const TO_ENGINE: Record<UnitSystem, { area: number; inertia: number; E: number; settlement: number }> = {
  us: { area: 1 / 144, inertia: 1 / 20736, E: 144, settlement: 1 / 12 },
  si: { area: 1e-6, inertia: 1e-6, E: 1e6, settlement: 1e-3 },
};

/** From the engine's results to the units shown: a displacement (ft → in, m → mm) and a stress (kip/ft² → ksi, kN/m² → MPa). A rotation is in radians in both. */
export const FROM_ENGINE: Record<UnitSystem, { displacement: number; stress: number }> = {
  us: { displacement: 12, stress: 1 / 144 },
  si: { displacement: 1000, stress: 1 / 1000 },
};

/* ── The form ─────────────────────────────────────────────────────────── */

export type StiffnessMaterial = 'steel' | 'aluminum' | 'custom';

/** The modulus offered as a starting point, in the unit each system shows (29,000 ksi is 199.95 GPa; steel is 200 GPa). */
export const STIFFNESS_MATERIALS: Record<Exclude<StiffnessMaterial, 'custom'>, Record<UnitSystem, number>> = {
  steel: { us: 29000, si: 200 },
  aluminum: { us: 10100, si: 69.6 },
};

/** What a section left blank is filled with when the visitor switches to frame mode (I) — typical, in the units each system shows. */
export const DEFAULT_SECTION: Record<UnitSystem, { A: number; I: number }> = { us: { A: 10, I: 100 }, si: { A: 6000, I: 40 } };

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
  /** This member's own modulus (ksi, GPa), area (in², mm²) and inertia (in⁴, 10⁶ mm⁴); null: the structure's. */
  E: number | null;
  A: number | null;
  I: number | null;
}
/** The restraints of a node, on its global DOFs, with the prescribed displacement of each (a settlement: inches / millimetres; radians). Kept while the restraint is off, ignored then. */
export interface SupportRow {
  id: number;
  node: number;
  ux: boolean;
  uy: boolean;
  rz: boolean;
  dx: number;
  dy: number;
  dr: number;
}
export interface LoadRow {
  id: number;
  node: number;
  /** Components (kip, kN), along +x and +y: a gravity load is a negative fy; and a counter-clockwise moment (kip·ft, kN·m; frame mode only). */
  fx: number;
  fy: number;
  m: number;
}
export type MemberLoadKind = StiffnessMemberLoad['kind'];
export const MEMBER_LOAD_KINDS: MemberLoadKind[] = ['udl', 'point', 'axial'];
/**
 * A member load (frame mode). ONE row shape for every kind: the fields a kind does not use are kept (and carried by the address) so that changing
 * the kind back finds them, and the engine ignores them.
 *   udl    `w` (kip/ft, kN/m) along +ȳ over the whole member
 *   point  `P` (kip, kN) along +ȳ at `a` (ft, m from node i), strictly inside the member
 *   axial  `q` (kip/ft, kN/m) along +x̄ over the whole member
 */
export interface MemberLoadRow {
  id: number;
  member: number;
  kind: MemberLoadKind;
  w: number;
  P: number;
  a: number;
  q: number;
}

export type StiffnessList = ListName;

export type SupportPreset = 'fixed' | 'pin' | 'roller';

export type StiffnessNotice =
  /** `members` are the labels the removed members had BEFORE the removal; `renumbered` / `membersRenumbered`: the nodes / the members after them moved up ("numbered as before" when false). */
  | { code: 'node-removed'; node: number; members: number[]; supports: number; loads: number; memberLoads: number; renumbered: boolean; membersRenumbered: boolean }
  | { code: 'member-removed'; member: number; memberLoads: number; renumbered: boolean }
  | { code: 'limit'; list: StiffnessList; max: number }
  /** An "add" that had nothing to add: every pair of nodes already has a member ('pairs'), fewer than two nodes ('few-nodes'), every pair without a member is at one place ('coincident'), every node already has a support ('nodes'), no node ('no-node') or no member ('no-member') to put it on, member loads in truss mode ('truss-mode'). */
  | { code: 'nothing-to-add'; list: StiffnessList; why: 'pairs' | 'few-nodes' | 'coincident' | 'nodes' | 'no-node' | 'no-member' | 'truss-mode' }
  /** A template was loaded in place of the structure. */
  | { code: 'template'; template: TemplateId };

export interface StiffnessForm {
  mode: Mode;
  units: UnitSystem;
  nodes: NodeRow[];
  members: MemberRow[];
  supports: SupportRow[];
  loads: LoadRow[];
  memberLoads: MemberLoadRow[];
  material: StiffnessMaterial;
  /** Modulus of every member that has none of its own (ksi, GPa); area (in², mm²); inertia (in⁴, 10⁶ mm⁴). Null: not given. */
  E: number | null;
  A: number | null;
  I: number | null;
  /** What the last edit has to tell the visitor. Not part of the case: never written in an address. */
  notice: StiffnessNotice | null;
  /** The next id to hand out. */
  nextId: number;
}

export const LIMITS: Record<StiffnessList, number> = { nodes: MAX_NODES, members: MAX_MEMBERS, supports: MAX_SUPPORTS, loads: MAX_LOADS, memberLoads: MAX_MEMBER_LOADS };

/** Eight figures, the most a field shows: a coordinate computed from another keeps all of them. */
const eight = (v: number): number => (Number.isFinite(v) ? Number(v.toPrecision(8)) : v);

const PRESETS: Record<SupportPreset, { ux: boolean; uy: boolean; rz: boolean }> = {
  fixed: { ux: true, uy: true, rz: true },
  pin: { ux: true, uy: true, rz: false },
  roller: { ux: false, uy: true, rz: false },
};
const supportRow = (id: number, node: number, preset: SupportPreset | { ux: boolean; uy: boolean; rz: boolean }): SupportRow => {
  const flags = typeof preset === 'string' ? PRESETS[preset] : preset;
  return { id, node, ux: flags.ux, uy: flags.uy, rz: flags.rz, dx: 0, dy: 0, dr: 0 };
};

/** What a support's restraints are called: the preset they equal, or null for any other combination. */
export function presetOf(s: Pick<SupportRow, 'ux' | 'uy' | 'rz'>, mode: Mode = 'frame'): SupportPreset | null {
  const rz = mode === 'frame' ? s.rz : false;
  for (const key of Object.keys(PRESETS) as SupportPreset[]) {
    const p = PRESETS[key];
    if (p.ux === s.ux && p.uy === s.uy && p.rz === rz) return key;
  }
  return null;
}

/** Rows of a template, numbered from 1: nodes, members, supports, loads, member loads. */
function rowsOf(t: ReturnType<typeof buildTemplate>): Pick<StiffnessForm, 'nodes' | 'members' | 'supports' | 'loads' | 'memberLoads' | 'nextId'> {
  let id = 1;
  const nodeIds = t.nodes.map(() => id++);
  const nodes: NodeRow[] = t.nodes.map((n, k) => ({ id: nodeIds[k], x: eight(n.x), y: eight(n.y) }));
  const memberIds = t.members.map(() => id++);
  const members: MemberRow[] = t.members.map((m, k) => ({ id: memberIds[k], i: nodeIds[m.i], j: nodeIds[m.j], E: null, A: null, I: null }));
  const supports: SupportRow[] = t.supports.map((s) => supportRow(id++, nodeIds[s.node], s));
  const loads: LoadRow[] = t.loads.map((l) => ({ id: id++, node: nodeIds[l.node], fx: eight(l.fx), fy: eight(l.fy), m: eight(l.m) }));
  const memberLoads: MemberLoadRow[] = t.memberLoads.map((l) => ({
    id: id++,
    member: memberIds[l.member],
    kind: l.kind,
    w: l.kind === 'udl' ? eight(l.w) : 0,
    P: l.kind === 'point' ? eight(l.P) : 0,
    a: l.kind === 'point' ? eight(l.a) : 0,
    q: l.kind === 'axial' ? eight(l.q) : 0,
  }));
  return { nodes, members, supports, loads, memberLoads, nextId: id };
}

function formOfTemplate(template: TemplateId, units: UnitSystem): StiffnessForm {
  const t = buildTemplate(template, units);
  return { mode: t.mode, units, ...rowsOf(t), material: 'steel', E: t.E, A: t.A, I: t.I, notice: null };
}

/**
 * The structure the page opens with — the TWO-BAR TRUSS of the textbooks, with an answer you can check by hand: two bars of 10 ft meeting at
 * the apex (8, 6) of a 16 ft base, pinned at both feet, E = 29,000 ksi, A = 10 in² (EA = 290,000 kip), and at the apex 20 kip to the right and 30 kip down.
 * Nodes 1 (0, 0), 2 (16, 0), 3 (8, 6); bar 1 from node 1 to node 3 (c = 0.8, s = 0.6), bar 2 from node 2 to node 3 (c = −0.8, s = 0.6).
 *
 * By hand. Equilibrium of the apex:  −0.8·N1 + 0.8·N2 + 20 = 0  and  −0.6·N1 − 0.6·N2 − 30 = 0, so  N1 = −12.5 kip and N2 = −37.5 kip
 * (both bars in compression: N/A = −1.25 ksi and −3.75 ksi). The bars shorten by N·L/EA: 12.5·10/290,000 = 4.310e-4 ft and
 * 37.5·10/290,000 = 1.293e-3 ft, so the apex moves  uy = −1.4368e-3 ft = −0.01724 in  and  ux = +5.388e-4 ft = 0.00647 in.
 * Reactions: node 1 (10, 7.5) kip and node 2 (−30, 22.5) kip: ΣFx = 20 + 10 − 30 = 0, ΣFy = −30 + 7.5 + 22.5 = 0.
 * By the matrices: EA/L = 29,000 kip/ft for both bars; the free DOFs are 5 and 6 (the apex), and K_FF = Σ (EA/L)·[[c², cs], [cs, s²]] =
 * 29,000·[[0.64 + 0.64, 0.48 − 0.48], [0.48 − 0.48, 0.36 + 0.36]] = [[37,120, 0], [0, 20,880]] kip/ft (the cs terms of the two bars cancel),
 * so ux = 20/37,120 = 5.388e-4 ft and uy = −30/20,880 = −1.4368e-3 ft. Its rows are numbered as a link numbers them, so this structure read
 * back from its own address is this structure, id for id.
 */
export function defaultStiffness(): StiffnessForm {
  return formOfTemplate('truss-two-bar', 'us');
}
/** The shell's name for the same thing. */
export const defaultCase = defaultStiffness;

/** A structure with nothing in it: what a visitor starts a structure of their own from. */
export function emptyStiffness(units: UnitSystem = 'us', mode: Mode = 'truss'): StiffnessForm {
  const section = DEFAULT_SECTION[units];
  return { mode, units, nodes: [], members: [], supports: [], loads: [], memberLoads: [], material: 'steel', E: STIFFNESS_MATERIALS.steel[units], A: section.A, I: section.I, notice: null, nextId: 1 };
}

/* ── Units ────────────────────────────────────────────────────────────── */

/**
 * A converted value, to fifteen significant figures (the rounding of a double and no more), or to the shortest number of up to eight figures
 * within the noise of that: a value of up to EIGHT figures (what a field holds) comes back from the other system as the very number it was.
 */
const exact = (v: number): number => {
  if (v === 0 || !Number.isFinite(v)) return v;
  const long = Number(v.toPrecision(15));
  for (let figures = 1; figures <= 8; figures++) {
    const short = Number(long.toPrecision(figures));
    if (Math.abs(short - long) <= 2e-14 * Math.abs(long)) return short;
  }
  return long;
};

type Quantity = keyof typeof STIFFNESS_US_TO_SI;
const convert = (v: number, q: Quantity, from: UnitSystem, to: UnitSystem): number => {
  if (from === to) return v;
  const f = STIFFNESS_US_TO_SI[q];
  return exact(v * (to === 'si' ? f : 1 / f));
};

/** The listed material a value is, in the system it is written in; null for any other. */
function listedModulus(v: number | null, units: UnitSystem): Exclude<StiffnessMaterial, 'custom'> | null {
  if (v === null) return null;
  return (Object.keys(STIFFNESS_MATERIALS) as Exclude<StiffnessMaterial, 'custom'>[]).find((m) => STIFFNESS_MATERIALS[m][units] === v) ?? null;
}

/**
 * The same structure in the other unit system: every quantity as its own, with all its figures (`exact`), and back again to the very same
 * numbers for values of up to eight significant figures. A rotation (a settlement's) has no unit. A modulus that is a listed material's (29,000 ksi,
 * 200 GPa) is the listed one in the other system, not a conversion of it (a member's own as well). Nothing is dropped: the form is the same
 * structure, the mode, the notice cleared.
 */
export function convertStiffness(form: StiffnessForm, to: UnitSystem): StiffnessForm {
  const from = form.units;
  if (from === to) return form;
  const c = (v: number, q: Quantity): number => convert(v, q, from, to);
  const opt = (v: number | null, q: Quantity) => (v === null ? null : c(v, q));
  const modulus = (v: number | null) => {
    const listed = listedModulus(v, from);
    return listed ? STIFFNESS_MATERIALS[listed][to] : opt(v, 'E');
  };
  return {
    ...form,
    units: to,
    nodes: form.nodes.map((n) => ({ ...n, x: c(n.x, 'length'), y: c(n.y, 'length') })),
    members: form.members.map((m) => ({ ...m, E: modulus(m.E), A: opt(m.A, 'area'), I: opt(m.I, 'inertia') })),
    supports: form.supports.map((s) => ({ ...s, dx: c(s.dx, 'settlement'), dy: c(s.dy, 'settlement') })),
    loads: form.loads.map((l) => ({ ...l, fx: c(l.fx, 'force'), fy: c(l.fy, 'force'), m: c(l.m, 'moment') })),
    memberLoads: form.memberLoads.map((l) => ({ ...l, w: c(l.w, 'line'), P: c(l.P, 'force'), a: c(l.a, 'length'), q: c(l.q, 'line') })),
    E: form.material !== 'custom' && form.E === STIFFNESS_MATERIALS[form.material][from] ? STIFFNESS_MATERIALS[form.material][to] : modulus(form.E),
    A: opt(form.A, 'area'),
    I: opt(form.I, 'inertia'),
    notice: null,
  };
}

/* ── What each edit does to the form ──────────────────────────────────── */

export type StiffnessAction =
  /** Opens a whole structure. The form it is given IS the new state (the same object): the page tells "opened whole" from "edited" by that. */
  | { type: 'load'; form: StiffnessForm }
  /** Start over: the form it is given (the same object), or the example when there is none. */
  | { type: 'reset'; form?: StiffnessForm }
  /** Takes everything out of the structure: mode, units, material and section stay. */
  | { type: 'clear' }
  /** Truss or frame. Nothing is dropped: a mode's own fields are kept while the other is shown. A blank I is filled in when the frame needs it. */
  | { type: 'mode'; mode: Mode }
  | { type: 'units'; units: UnitSystem }
  /** Replaces the structure, the mode and the section by a textbook problem's; the units stay (the form's `units` are the system the problem is written in). */
  | { type: 'template'; template: TemplateId }
  /** A row is added at the end. `seed` fills what the visitor already chose (a node for a support or a load; the two nodes of a member; the member and kind of a member load; `preset` of a support). */
  | { type: 'add'; list: StiffnessList; seed?: Record<string, unknown> }
  | { type: 'remove'; list: StiffnessList; id: number }
  | { type: 'patch'; list: StiffnessList; id: number; patch: Record<string, unknown> }
  | { type: 'section'; patch: { E?: number | null; A?: number | null; I?: number | null } }
  | { type: 'material'; material: StiffnessMaterial };

const isNode = (form: StiffnessForm, id: unknown): id is number => typeof id === 'number' && form.nodes.some((n) => n.id === id);
const isMember = (form: StiffnessForm, id: unknown): id is number => typeof id === 'number' && form.members.some((m) => m.id === id);

/** The unit step a new node is placed at from the last one. */
const stepOf = (units: UnitSystem) => (units === 'us' ? 8 : 2.5);

const num = (v: unknown, fallback: number): number => (typeof v === 'number' ? v : fallback);

/** A member's length from the form, or 0 where a coordinate is not a number. */
export function memberLength(form: StiffnessForm, m: MemberRow): number {
  const a = form.nodes.find((n) => n.id === m.i);
  const b = form.nodes.find((n) => n.id === m.j);
  if (!a || !b) return 0;
  const L = Math.hypot(b.x - a.x, b.y - a.y);
  return Number.isFinite(L) ? L : 0;
}

const near = (a: number, b: number) => Math.abs(a - b) <= 1e-9 * Math.max(1, Math.abs(a), Math.abs(b));

/** A position along a member that is strictly inside it and that no point load of the member (other than the row `except`) is at. */
export function freePosition(form: StiffnessForm, member: number, except?: number): number {
  const m = form.members.find((r) => r.id === member);
  const L = m ? memberLength(form, m) : 0;
  const used = form.memberLoads.filter((l) => l.member === member && l.kind === 'point' && l.id !== except).map((l) => l.a);
  const fractions = [0.5, 0.25, 0.75, 0.125, 0.375, 0.625, 0.875, 0.0625, 0.1875, 0.3125, 0.4375, 0.5625, 0.6875, 0.8125, 0.9375];
  for (const f of fractions) {
    const x = eight(L * f);
    if (x > 0 && x < L && !used.some((u) => near(u, x))) return x;
  }
  return eight(L / 2);
}

export function reduceStiffness(form: StiffnessForm, action: StiffnessAction): StiffnessForm {
  const next = (patch: Partial<StiffnessForm>): StiffnessForm => ({ ...form, notice: null, ...patch });
  switch (action.type) {
    case 'load':
      // The form that comes in is the form that stays, so that a caller can tell it from one edited afterwards (`===`).
      return action.form;
    case 'reset':
      return action.form ?? defaultStiffness();
    case 'clear':
      return { ...emptyStiffness(form.units, form.mode), material: form.material, E: form.E, A: form.A, I: form.I };
    case 'mode': {
      if (action.mode !== 'truss' && action.mode !== 'frame') return form;
      if (action.mode === form.mode) return form;
      const filled: Partial<StiffnessForm> = {};
      // A frame needs a moment of inertia, and a truss never asked for one: the blank is filled in with a typical value.
      if (action.mode === 'frame' && form.I === null) filled.I = DEFAULT_SECTION[form.units].I;
      return next({ mode: action.mode, ...filled });
    }
    case 'units':
      return convertStiffness(form, action.units);
    case 'template': {
      if (!TEMPLATE_IDS.includes(action.template)) return form;
      return { ...formOfTemplate(action.template, form.units), notice: { code: 'template', template: action.template } };
    }
    case 'material': {
      if (action.material === 'custom') return next({ material: 'custom' });
      if (action.material !== 'steel' && action.material !== 'aluminum') return form;
      return next({ material: action.material, E: STIFFNESS_MATERIALS[action.material][form.units] });
    }
    case 'section': {
      const patch: Partial<StiffnessForm> = {};
      if ('E' in action.patch) {
        patch.E = action.patch.E ?? null;
        // A modulus typed over a listed material's is the visitor's own.
        if (form.material !== 'custom' && patch.E !== STIFFNESS_MATERIALS[form.material][form.units]) patch.material = 'custom';
      }
      if ('A' in action.patch) patch.A = action.patch.A ?? null;
      if ('I' in action.patch) patch.I = action.patch.I ?? null;
      return next(patch);
    }
    case 'add':
      return add(form, action.list, action.seed ?? {});
    case 'remove':
      return remove(form, action.list, action.id);
    case 'patch':
      return patch(form, action.list, action.id, action.patch);
  }
}
export const reduce = reduceStiffness;

function add(form: StiffnessForm, list: StiffnessList, seed: Record<string, unknown>): StiffnessForm {
  if (!(list in LIMITS)) return form;
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
          const others = ids
            .filter((b) => b !== ids[a] && !joined(ids[a], b) && apart(ids[a], b))
            .sort((p, r) => Math.hypot(at(p).x - at(ids[a]).x, at(p).y - at(ids[a]).y) - Math.hypot(at(r).x - at(ids[a]).x, at(r).y - at(ids[a]).y));
          if (others.length > 0) found = [ids[a], others[0]];
        }
        if (!found) {
          const free = ids.some((a) => ids.some((b) => a < b && !joined(a, b)));
          const why = form.nodes.length < 2 ? 'few-nodes' : free ? 'coincident' : 'pairs';
          return { ...form, notice: { code: 'nothing-to-add', list: 'members', why } };
        }
        [i, j] = found;
      }
      if (i === j || joined(i, j)) return { ...form, notice: { code: 'nothing-to-add', list: 'members', why: i === j ? 'coincident' : 'pairs' } };
      return { ...form, notice: null, members: [...form.members, { id, i, j, E: null, A: null, I: null }], nextId: id + 1 };
    }
    case 'supports': {
      const taken = new Set(form.supports.map((s) => s.node));
      let node: number | undefined = isNode(form, seed.node) && !taken.has(seed.node as number) ? (seed.node as number) : undefined;
      if (node === undefined) {
        // The lowest node without a support (then the leftmost): where a support goes.
        const free = form.nodes.filter((n) => !taken.has(n.id)).sort((p, q) => p.y - q.y || p.x - q.x);
        node = free[0]?.id;
      }
      if (node === undefined) return { ...form, notice: { code: 'nothing-to-add', list: 'supports', why: form.nodes.length === 0 ? 'no-node' : 'nodes' } };
      // The first support of a frame is fixed, of a truss a pin; the others a pin or a roller.
      const preset: SupportPreset =
        typeof seed.preset === 'string' && seed.preset in PRESETS ? (seed.preset as SupportPreset) : form.mode === 'frame' ? (form.supports.length === 0 ? 'fixed' : 'pin') : form.supports.length === 0 ? 'pin' : 'roller';
      return { ...form, notice: null, supports: [...form.supports, supportRow(id, node, preset)], nextId: id + 1 };
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
      if (form.mode === 'truss') return { ...form, notice: { code: 'nothing-to-add', list: 'memberLoads', why: 'truss-mode' } };
      let member: number | undefined = isMember(form, seed.member) ? seed.member : undefined;
      if (member === undefined) {
        // The member with the fewest loads, the longest first.
        const count = (m: MemberRow) => form.memberLoads.filter((l) => l.member === m.id).length;
        const order = [...form.members].sort((p, q) => count(p) - count(q) || memberLength(form, q) - memberLength(form, p));
        member = order[0]?.id;
      }
      if (member === undefined) return { ...form, notice: { code: 'nothing-to-add', list: 'memberLoads', why: 'no-member' } };
      const kind: MemberLoadKind = typeof seed.kind === 'string' && (MEMBER_LOAD_KINDS as string[]).includes(seed.kind) ? (seed.kind as MemberLoadKind) : 'udl';
      const row: MemberLoadRow = { id, member, kind, w: 0, P: 0, a: 0, q: 0 };
      if (kind === 'udl') row.w = num(seed.w, us ? -1 : -10);
      else if (kind === 'point') {
        row.a = num(seed.a, freePosition(form, member));
        row.P = num(seed.P, us ? -10 : -40);
      } else row.q = num(seed.q, us ? 1 : 10);
      return { ...form, notice: null, memberLoads: [...form.memberLoads, row], nextId: id + 1 };
    }
  }
}

function remove(form: StiffnessForm, list: StiffnessList, id: number): StiffnessForm {
  if (list === 'members') {
    const at = form.members.findIndex((r) => r.id === id);
    if (at < 0) return form;
    const memberLoads = form.memberLoads.filter((l) => l.member !== id);
    const renumbered = at < form.members.length - 1;
    return { ...form, notice: { code: 'member-removed', member: at + 1, memberLoads: form.memberLoads.length - memberLoads.length, renumbered }, members: form.members.filter((r) => r.id !== id), memberLoads };
  }
  if (list !== 'nodes') {
    if (!(list in LIMITS)) return form;
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
const ALLOWED: Record<StiffnessList, string[]> = {
  nodes: ['x', 'y'],
  members: ['i', 'j', 'E', 'A', 'I'],
  supports: ['node', 'ux', 'uy', 'rz', 'dx', 'dy', 'dr'],
  loads: ['node', 'fx', 'fy', 'm'],
  memberLoads: ['member', 'kind', 'w', 'P', 'a', 'q'],
};

function patch(form: StiffnessForm, list: StiffnessList, id: number, change: Record<string, unknown>): StiffnessForm {
  if (!(list in ALLOWED)) return form;
  const clean: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(change)) {
    if (!ALLOWED[list].includes(key)) continue;
    if (key === 'i' || key === 'j' || key === 'node') {
      if (isNode(form, value)) clean[key] = value;
    } else if (key === 'member') {
      if (isMember(form, value)) clean[key] = value;
    } else if (key === 'kind') {
      if ((MEMBER_LOAD_KINDS as string[]).includes(value as string)) clean[key] = value;
    } else if (key === 'ux' || key === 'uy' || key === 'rz') {
      if (typeof value === 'boolean') clean[key] = value;
    } else if (key === 'E' || key === 'A' || key === 'I') {
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
      if (list === 'memberLoads' && ((clean.kind !== undefined && clean.kind !== (r as MemberLoadRow).kind) || (clean.member !== undefined && clean.member !== (r as MemberLoadRow).member))) return startKind(form, row);
      return row;
    }),
  };
}

/**
 * A member load whose KIND (or member) has just been changed: the fields the new kind uses that hold nothing (0) are given what a new row of that kind
 * starts with, so that the load is not silently zero, and a point load is given a position strictly inside its member that no other point load is at.
 * What the visitor typed in the other fields is kept (the address keeps them, so that changing back finds them).
 */
function startKind(form: StiffnessForm, row: MemberLoadRow): MemberLoadRow {
  const us = form.units === 'us';
  const out = { ...row };
  const m = form.members.find((r) => r.id === row.member);
  const L = m ? memberLength(form, m) : 0;
  switch (row.kind) {
    case 'udl':
      if (out.w === 0) out.w = us ? -1 : -10;
      break;
    case 'point': {
      if (out.P === 0) out.P = us ? -10 : -40;
      const used = form.memberLoads.filter((l) => l.member === row.member && l.kind === 'point' && l.id !== row.id).map((l) => l.a);
      const valid = Number.isFinite(out.a) && out.a > 0 && out.a < L && !used.some((u) => near(u, out.a));
      if (!valid) out.a = freePosition(form, row.member, row.id);
      break;
    }
    case 'axial':
      if (out.q === 0) out.q = us ? 1 : 10;
      break;
  }
  return out;
}

/** A support's settlement as the engine takes it: only on a restrained DOF (the typed value is kept while the restraint is off, and means nothing then). */
export const settlementOf = (s: Pick<SupportRow, 'ux' | 'uy' | 'rz' | 'dx' | 'dy' | 'dr'>, mode: Mode = 'frame'): { dx: number; dy: number; dr: number } => ({
  dx: s.ux ? s.dx : 0,
  dy: s.uy ? s.dy : 0,
  dr: mode === 'frame' && s.rz ? s.dr : 0,
});

/* ── From the form to the engine ──────────────────────────────────────── */

/** A row of the form, as an issue names it. */
export type StiffnessRow = { list: StiffnessList; id: number; field?: string } | { list: 'model'; field: 'E' | 'A' | 'I' };

export interface EngineInput {
  model: StiffnessModel;
  /** The id of the row behind each entry of the model, by index: what an issue's `where.index` points at. */
  rows: { nodes: number[]; members: number[]; supports: number[]; loads: number[]; memberLoads: number[] };
}

/**
 * The model the engine takes, in feet and kips or metres and kilonewtons. A reference to a node or a member that is not there is index −1, which
 * the engine refuses; a number that is NaN stays NaN, which it reports ('number', 'section'). A value null is left out.
 */
export function toEngine(form: StiffnessForm): EngineInput {
  const nodeAt = new Map(form.nodes.map((n, k) => [n.id, k]));
  const memberAt = new Map(form.members.map((m, k) => [m.id, k]));
  const at = (id: number) => nodeAt.get(id) ?? -1;
  const k = TO_ENGINE[form.units];
  const model: StiffnessModel = {
    mode: form.mode,
    nodes: form.nodes.map((n) => ({ x: n.x, y: n.y })),
    members: form.members.map((m) => ({
      i: at(m.i),
      j: at(m.j),
      ...(m.E !== null ? { E: m.E * k.E } : {}),
      ...(m.A !== null ? { A: m.A * k.area } : {}),
      ...(m.I !== null ? { I: m.I * k.inertia } : {}),
    })),
    supports: form.supports.map((s) => {
      // A settlement typed on a DOF the support does not restrain means nothing, and the form hides it: it is not passed on.
      const settle = settlementOf(s, form.mode);
      return {
        node: at(s.node),
        ux: s.ux,
        uy: s.uy,
        rz: s.rz,
        ...(settle.dx !== 0 ? { dx: settle.dx * k.settlement } : {}),
        ...(settle.dy !== 0 ? { dy: settle.dy * k.settlement } : {}),
        ...(settle.dr !== 0 ? { dr: settle.dr } : {}),
      };
    }),
    loads: form.loads.map((l) => ({ node: at(l.node), fx: l.fx, fy: l.fy, m: l.m })),
    memberLoads: form.memberLoads.map((l): StiffnessMemberLoad => {
      const member = memberAt.get(l.member) ?? -1;
      switch (l.kind) {
        case 'udl':
          return { kind: 'udl', member, w: l.w };
        case 'point':
          return { kind: 'point', member, a: l.a, P: l.P };
        default:
          return { kind: 'axial', member, q: l.q };
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
export function issueRow(issue: Issue, rows: EngineInput['rows']): StiffnessRow | undefined {
  const w = issue.where;
  if (!w) return undefined;
  if (w.list === 'model') return { list: 'model', field: w.field === 'A' ? 'A' : w.field === 'I' ? 'I' : 'E' };
  const id = rows[w.list][w.index];
  return id === undefined ? undefined : { list: w.list, id, ...(w.field ? { field: w.field } : {}) };
}

/** A node's label: its place in the list, from 1. 0 for an id that is not there. */
export function nodeLabel(form: StiffnessForm, id: number): number {
  return form.nodes.findIndex((n) => n.id === id) + 1;
}
export function memberLabel(form: StiffnessForm, id: number): number {
  return form.members.findIndex((m) => m.id === id) + 1;
}

/* ── The case in an address ───────────────────────────────────────────── */

const MATERIAL_LETTER: Record<StiffnessMaterial, string> = { steel: 's', aluminum: 'a', custom: 'u' };
const LOAD_LETTER: Record<MemberLoadKind, string> = { udl: 'u', point: 'p', axial: 'a' };

/** A number as THIS address carries it: the shortest text that reads back as the very same number (a double always does). */
const written = (v: number): string => (Number.isFinite(v) ? String(v).replace('e+', 'e') : v > 0 ? 'inf' : v < 0 ? '-inf' : 'nan');

/**
 * Whether replacing `before` by `after` throws a structure away that nobody could get back: it is not the example (which "Start over" brings
 * back) and it is not what `after` is. The page then leaves it one step behind in the browser's history, so that Back restores it — for "Start over"
 * and for "Load template" alike.
 */
export function leavesBehind(before: StiffnessForm, after: StiffnessForm, example: string): boolean {
  const was = encodeStiffness(before);
  return was !== example && was !== encodeStiffness(after);
}

/** The version of the address, its first field. A reader of another version returns null; it is raised only if the format changes. */
const VERSION = '1';

/*
 * The longest address a form can write: 12 nodes, 20 members, 12 supports, 40 nodal loads and 24 member loads, every number at its longest
 * (23 characters). model.test.ts writes it and reads it back. Every ordinary structure is under 1,500 characters.
 */
export const MAX_LINK = 16000;

/**
 * The case as a short string for the page's address (after `#m=`), so a link opens the same structure. Nine fields, the rows of a list joined by
 * `_`, trailing default fields of a row left out:
 *
 *     version ; mode ; units ; section ; nodes ; members ; supports ; loads ; member loads
 *
 *   version   1
 *   mode      t truss, f frame
 *   units     us | si
 *   section   material letter (s steel, a aluminum, u the visitor's own), E, A, I — each empty when not given:  s,29000,10,100
 *   a node    x,y
 *   a member  i,j,E,A,I    i and j are NODE NUMBERS (labels, from 1); E, A, I empty when the member has none:  1,3   or   1,2,,12.5,480
 *   a support node,flags,dx,dy,dr    flags is a digit: 1 ux + 2 uy + 4 rz restrained (3 a pin, 2 a roller, 7 fixed); dx, dy, dr left out when 0:  1,3   2,2,0,-0.5
 *   a load    node,fx,fy,m   (m may be left out when 0)
 *   a member load  kind,member,w,P,a,q    kind u udl, p point, a axial; member is a MEMBER NUMBER (label); trailing zeros left out:  u,1,-1.2   p,1,0,-20,8
 *
 * A link carries no ids: the rows are numbered again on reading, nodes first, then members, supports, loads and member loads.
 * WHATEVER THE FORM HOLDS IS WRITTEN and read back as that form, bit for bit — a node with no member, a number that is NaN, a member from a node to
 * itself — so that a reload comes back to the structure that was on screen, with its warning. IT BEGINS WITH A CHECK of the rest, the first calculator's
 * (`checkOf`): a link cut short, or with a character more, less or changed, is not a link to another structure.
 */
export function encodeStiffness(form: StiffnessForm): string {
  const n = written;
  const optional = (v: number | null) => (v === null ? '' : n(v));
  const trim = (fields: string[], keep: number, defaults: string[] = []): string => {
    let end = fields.length;
    while (end > keep && (fields[end - 1] === '' || fields[end - 1] === (defaults[end - 1] ?? '\u0000'))) end--;
    return fields.slice(0, end).join(',');
  };
  const label = (id: number) => nodeLabel(form, id);
  const body = [
    VERSION,
    form.mode === 'frame' ? 'f' : 't',
    form.units,
    `${MATERIAL_LETTER[form.material]},${optional(form.E)},${optional(form.A)},${optional(form.I)}`,
    form.nodes.map((p) => `${n(p.x)},${n(p.y)}`).join('_'),
    form.members.map((m) => trim([String(label(m.i)), String(label(m.j)), optional(m.E), optional(m.A), optional(m.I)], 2)).join('_'),
    form.supports
      .map((s) => trim([String(label(s.node)), String((s.ux ? 1 : 0) + (s.uy ? 2 : 0) + (s.rz ? 4 : 0)), n(s.dx), n(s.dy), n(s.dr)], 2, ['', '', '0', '0', '0']))
      .join('_'),
    form.loads.map((l) => trim([String(label(l.node)), n(l.fx), n(l.fy), n(l.m)], 3, ['', '', '', '0'])).join('_'),
    form.memberLoads.map((l) => trim([LOAD_LETTER[l.kind], String(memberLabel(form, l.member)), n(l.w), n(l.P), n(l.a), n(l.q)], 2, ['', '', '0', '0', '0', '0'])).join('_'),
  ].join(';');
  return `${checkOf(body)};${body}`;
}
/** The shell's name for the same thing. */
export const encode = encodeStiffness;

/**
 * The structure a string from `encodeStiffness` describes, or `null` if it is anything else: a check that is not the rest's, a version that is
 * not 1, not nine fields, a number in any notation but the page's own, more rows than the cap, a row that names a node or a member that is not in the
 * list, a letter that is none of the known ones. Never throws, whatever the string is: it comes back from wherever a link was pasted.
 */
export function decodeStiffness(text: string): StiffnessForm | null {
  try {
    return read(text);
  } catch {
    return null;
  }
}
export const decode = decodeStiffness;

function read(text: string): StiffnessForm | null {
  if (typeof text !== 'string' || text.length > MAX_LINK) return null;
  const body = checked(text);
  if (body === null) return null;
  const parts = body.split(';');
  if (parts.length !== 9) return null;
  const [version, modeText, units, sectionText, nodeText, memberText, supportText, loadText, memberLoadText] = parts;
  if (version !== VERSION || (units !== 'us' && units !== 'si') || (modeText !== 't' && modeText !== 'f')) return null;
  let bad = false;
  const num = (s: string | undefined, fallback?: number): number => {
    if (s === undefined || s === '') {
      if (fallback === undefined) bad = true;
      return fallback ?? 0;
    }
    const named = NAMED.get(s);
    if (named !== undefined) return named;
    const v = NUMBER.test(s) ? Number(s) : Number.NaN;
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
  const material = (Object.keys(MATERIAL_LETTER) as StiffnessMaterial[]).find((key) => MATERIAL_LETTER[key] === section[0]);
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
  const members: MemberRow[] = rows(memberText, 2, 5, MAX_MEMBERS).map(([i, j, e, a, ii]) => ({ id: id++, i: nodeIdOf(i), j: nodeIdOf(j), E: optional(e), A: optional(a), I: optional(ii) }));
  const supports: SupportRow[] = rows(supportText, 2, 5, MAX_SUPPORTS).map((r) => {
    if (!/^[0-7]$/.test(r[1] ?? '')) bad = true;
    const flags = /^[0-7]$/.test(r[1] ?? '') ? Number(r[1]) : 0;
    return { id: id++, node: nodeIdOf(r[0]), ux: (flags & 1) !== 0, uy: (flags & 2) !== 0, rz: (flags & 4) !== 0, dx: num(r[2], 0), dy: num(r[3], 0), dr: num(r[4], 0) };
  });
  const loads: LoadRow[] = rows(loadText, 3, 4, MAX_LOADS).map(([node, fx, fy, m]) => ({ id: id++, node: nodeIdOf(node), fx: num(fx), fy: num(fy), m: num(m, 0) }));
  const loadKinds = Object.entries(LOAD_LETTER) as [MemberLoadKind, string][];
  const memberLoads: MemberLoadRow[] = rows(memberLoadText, 2, 6, MAX_MEMBER_LOADS).map((r) => {
    const kind = loadKinds.find(([, letter]) => letter === r[0])?.[0];
    if (!kind) bad = true;
    const m = labelOf(r[1], members.length);
    return { id: id++, member: bad ? 0 : members[m].id, kind: kind ?? 'udl', w: num(r[2], 0), P: num(r[3], 0), a: num(r[4], 0), q: num(r[5], 0) };
  });
  if (bad) return null;
  return { mode: modeText === 'f' ? 'frame' : 'truss', units, nodes, members, supports, loads, memberLoads, material, E, A, I, notice: null, nextId: id };
}
