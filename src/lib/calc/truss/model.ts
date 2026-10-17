import { NAMED, NUMBER, US_TO_SI, checkOf, checked, written, type UnitSystem } from '../beam/model';
import { TEMPLATE_DEFAULTS, buildTemplate, type Clamp, type TemplateId, type TemplateParams } from './templates';
import { MAX_LOADS, MAX_MEMBERS, MAX_NODES, MAX_SUPPORTS, type TrussIssue, type TrussModel } from './types';

/**
 * ─────────────────────────────────────────────────────────────────────────────
 * TRUSS MEMBER FORCES — what the visitor edits, and what the engine is given
 * ─────────────────────────────────────────────────────────────────────────────
 * Between the form of the fifth calculator ("Truss member forces",
 * /resources/truss-member-forces) and its engine (types.ts is the agreement between the two).
 * Pure functions, no React: the truss as entered (`TrussForm`), what each edit
 * does to it (`reduceTruss`), the model the engine takes and which row of the
 * form each of its entries is (`toEngine`, `issueRow`), the same truss in the
 * other unit system, and the address that carries the case from one engineer to
 * another. The rest of the shell's wants of a model: `defaultCase()` /
 * `defaultTruss()`, `encodeTruss`, `decodeTruss` (null for an address that
 * cannot be read), and a reducer with a `'load'` action.
 *
 * THE FORM HOLDS NUMBERS, not the text typed: the field component (NumField)
 * is where text is, as in the other calculators; a field that is not a number
 * yet commits NaN, which the engine reports against its row ('number'). `null`
 * is "not given" for the optional sizes.
 *
 * WHAT IS THE FIRST CALCULATOR'S IS USED, NOT WRITTEN AGAIN: the check an
 * address begins with (`checkOf`), how a number is read from one (`NUMBER`,
 * `NAMED`). (A converted value is NOT rounded as the beam's is: `convertTruss`.)
 *
 * UNITS. The form holds numbers in the units it SHOWS (`TRUSS_UNITS`):
 *
 *     US   ft, kip;   area in², modulus ksi;   stress ksi;  displacement in
 *     SI   m,  kN;    area mm², modulus GPa;   stress MPa;  displacement mm
 *
 * The engine takes any consistent set and is given FEET AND KIPS or METRES AND
 * KILONEWTONS. Lengths and forces cross as they are; the section crosses in
 * ONE place (`TO_ENGINE`): in² → ft² (÷ 144), ksi → kip/ft² (× 144);
 * mm² → m² (× 10⁻⁶), GPa → kN/m² (× 10⁶). Results come back through the same
 * numbers (`FROM_ENGINE`): ft → in (× 12) and m → mm (× 1000) for a
 * displacement; kip/ft² → ksi (÷ 144) and kN/m² → MPa (÷ 1000) for a stress.
 * Nothing else in the calculator holds a 12, a 144 or a 1000.
 *
 * IDENTITY AND NUMBERS. Every row has an `id` that only ever grows (a removed
 * row's is never reused). A member, a support and a load name their node BY
 * ITS ID. What the visitor sees are LABELS: a node's place in the list, from 1
 * ("node 3"), a member's likewise. So deleting a node renumbers the labels
 * after it and nothing else.
 *
 * DELETING A NODE (`'remove'` on the nodes) takes with it every member
 * attached to it and every support and load on it; the labels after it close
 * up. The visitor is TOLD: `form.notice` is `{ code: 'node-removed', … }` with
 * the label the node had, the labels the removed members had (in the numbering
 * before the removal), how many supports and loads went, and whether anything
 * was renumbered. The notice is transient: the next action replaces it, it is
 * never written in an address and `'load'` clears it.
 *
 * THE CAP: 40 nodes, 120 members, 40 supports, 80 loads (types.ts). An `'add'`
 * past one is refused (the form is returned as it was) with
 * `notice = { code: 'limit', list, max }`.
 */

/** What this page's case is called in its address: `#t=…` — `#b=` beam, `#s=` single span, `#c=` continuous beam, `#h=` shaft. */
export const TRUSS_KEY = 't';

export { MAX_LOADS, MAX_MEMBERS, MAX_NODES, MAX_SUPPORTS };

/* ── The units ────────────────────────────────────────────────────────── */

export const TRUSS_UNITS: Record<UnitSystem, { length: string; force: string; area: string; E: string; stress: string; displacement: string; moment: string }> = {
  us: { length: 'ft', force: 'kip', area: 'in²', E: 'ksi', stress: 'ksi', displacement: 'in', moment: 'kip·ft' },
  si: { length: 'm', force: 'kN', area: 'mm²', E: 'GPa', stress: 'MPa', displacement: 'mm', moment: 'kN·m' },
};

/** Exact definitions: 1 ft = 0.3048 m; 1 kip = 4.4482216152605 kN; 1 in = 25.4 mm. */
const IN = 25.4;
export const TRUSS_US_TO_SI = {
  length: US_TO_SI.length,
  force: US_TO_SI.force,
  moment: US_TO_SI.moment,
  area: IN * IN, // in² → mm²
  // ksi → GPa: kip/in² = 4.4482216152605 kN / 645.16 mm² = 0.0068947572932 kN/mm², and a kN/mm² is a GPa.
  E: US_TO_SI.force / (IN * IN),
} as const;

/** From what the form holds to what the engine is given (feet and kips; metres and kilonewtons). */
export const TO_ENGINE: Record<UnitSystem, { area: number; E: number }> = {
  us: { area: 1 / 144, E: 144 },
  si: { area: 1e-6, E: 1e6 },
};

/** From the engine's results to the units shown: a displacement (ft → in, m → mm) and a stress (kip/ft² → ksi, kN/m² → MPa). */
export const FROM_ENGINE: Record<UnitSystem, { displacement: number; stress: number }> = {
  us: { displacement: 12, stress: 1 / 144 },
  si: { displacement: 1000, stress: 1 / 1000 },
};

/* ── The form ─────────────────────────────────────────────────────────── */

export type TrussMaterial = 'steel' | 'aluminum' | 'custom';

/** The modulus offered as a starting point, in the unit each system shows: the same metal, written each way (29,000 ksi is 199.95 GPa; steel is 200 GPa). */
export const TRUSS_MATERIALS: Record<Exclude<TrussMaterial, 'custom'>, Record<UnitSystem, number>> = {
  steel: { us: 29000, si: 200 },
  aluminum: { us: 10100, si: 69.6 },
};

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
  /** This member's own area (in², mm²) and modulus (ksi, GPa); null: the truss's. */
  A: number | null;
  E: number | null;
}

export interface SupportRow {
  id: number;
  /** The id of the node. */
  node: number;
  kind: 'pin' | 'roller';
  /** A roller's direction, degrees counter-clockwise from +x (types.ts): 90 is the usual roller. Kept while the support is a pin. */
  angle: number;
}

export interface LoadRow {
  id: number;
  node: number;
  /** Components (kip, kN), along +x and +y: a gravity load is a negative fy. */
  fx: number;
  fy: number;
}

export type TrussNotice =
  /** `members` are the labels the removed members had BEFORE the removal; `renumbered` / `membersRenumbered`: the nodes / the members after them moved up. */
  | { code: 'node-removed'; node: number; members: number[]; supports: number; loads: number; renumbered: boolean; membersRenumbered: boolean }
  /** A member was removed and the members after it moved up one number. Said only when some did. */
  | { code: 'member-removed'; member: number }
  | { code: 'limit'; list: TrussList; max: number }
  /** An "add" that had nothing to add: every pair of nodes already has a member ('pairs'), every node already has a support ('nodes'), or there is no node to put a support or a load on ('no-node'). */
  | { code: 'nothing-to-add'; list: TrussList; why: 'pairs' | 'nodes' | 'no-node' }
  | { code: 'template'; template: TemplateId; clamped: Clamp[] };

export interface TrussForm {
  units: UnitSystem;
  nodes: NodeRow[];
  members: MemberRow[];
  supports: SupportRow[];
  loads: LoadRow[];
  material: TrussMaterial;
  /** Modulus of every member that has none of its own (ksi, GPa); null: not given. */
  E: number | null;
  /** Area of every member that has none of its own (in², mm²); null: not given. With both, the page shows elongation, displacement and stress. */
  A: number | null;
  /** What the last edit has to tell the visitor. Not part of the case: never written in an address. */
  notice: TrussNotice | null;
  /** The next id to hand out. */
  nextId: number;
}

export type TrussList = 'nodes' | 'members' | 'supports' | 'loads';

const LIMITS: Record<TrussList, number> = { nodes: MAX_NODES, members: MAX_MEMBERS, supports: MAX_SUPPORTS, loads: MAX_LOADS };

/** Where the rows of a template go, numbered from `first`: nodes, members, supports, loads. */
function rowsOf(t: ReturnType<typeof buildTemplate>, first: number): Pick<TrussForm, 'nodes' | 'members' | 'supports' | 'loads' | 'nextId'> {
  let id = first;
  const nodeIds = t.nodes.map(() => id++);
  // Eight figures, the most a field shows: a coordinate like 7 m ÷ 3 is written to them.
  const nodes: NodeRow[] = t.nodes.map((n, k) => ({ id: nodeIds[k], x: eight(n.x), y: eight(n.y) }));
  const members: MemberRow[] = t.members.map((m) => ({ id: id++, i: nodeIds[m.i], j: nodeIds[m.j], A: null, E: null }));
  const supports: SupportRow[] = t.supports.map((s) => ({ id: id++, node: nodeIds[s.node], kind: s.kind, angle: s.angle ?? 90 }));
  const loads: LoadRow[] = t.loads.map((l) => ({ id: id++, node: nodeIds[l.node], fx: eight(l.fx), fy: eight(l.fy) }));
  return { nodes, members, supports, loads, nextId: id };
}

/**
 * The truss the page opens with — a classic textbook one with an answer you
 * can check by hand: a four-panel PRATT truss, 32 ft long and 8 ft deep (8 ft
 * panels, so the diagonals are at 45°), a pin at the left end and a roller at
 * the right, and 10 kip at each top-chord joint (5 kip at the two ends). Steel,
 * 4 in² in every member.
 *
 * By hand (joints, then check): the reactions are 20 kip each (ΣP = 5 + 10 +
 * 10 + 10 + 5 = 40). Tension positive:
 *
 *     bottom chord   0, +15, +15, 0 kip      (the two end panels carry nothing)
 *     top chord      −15, −20, −20, −15 kip
 *     verticals      −20, −15, −10, −15, −20 kip     (left to right)
 *     diagonals      +15√2 = +21.213, +5√2 = +7.071, +7.071, +21.213 kip
 *
 * Its rows are numbered as a link numbers them, so this truss read back from
 * its own address is this truss, id for id.
 */
export function defaultTruss(): TrussForm {
  const t = buildTemplate('pratt', { ...TEMPLATE_DEFAULTS.us.pratt, supports: 'pin-roller' }, 'us');
  return { units: 'us', ...rowsOf(t, 1), material: 'steel', E: 29000, A: 4, notice: null };
}
/** The shell's name for the same thing. */
export const defaultCase = defaultTruss;

/** A truss with nothing in it: what a visitor starts a truss of their own from. */
export function emptyTruss(units: UnitSystem = 'us'): TrussForm {
  return { units, nodes: [], members: [], supports: [], loads: [], material: 'steel', E: TRUSS_MATERIALS.steel[units], A: null, notice: null, nextId: 1 };
}

/* ── Units ────────────────────────────────────────────────────────────── */

/**
 * A converted value, to fifteen significant figures (the rounding of a double and
 * no more), or to the shortest number within the noise of that. Rounding a coordinate to six or eight figures moves each node a little
 * on its own, and a truss that was symmetric, or had members on one line, is not
 * after it: the centre diagonals of a Warren truss that carried nothing carried
 * a few hundredths of a percent of the load, and three members that statics showed
 * to be zero were one. Fifteen figures keep the geometry, and a value of up to
 * thirteen figures comes back from the other system as the very number it was.
 */
const exact = (v: number): number => {
  if (v === 0 || !Number.isFinite(v)) return v;
  const long = Number(v.toPrecision(15));
  // The shortest number (up to twelve figures) that is the same to within the noise of a conversion and back: 27.3 comes
  // back as 27.3 and not as 27.3000000000001, which is what fifteen figures make of the digits the other system kept.
  for (let figures = 1; figures <= 12; figures++) {
    const short = Number(long.toPrecision(figures));
    if (Math.abs(short - long) <= 5e-14 * Math.abs(long)) return short;
  }
  return long;
};

/** The listed modulus (steel, aluminium) a value is, in the system it is written in; null for any other. */
function listedModulus(v: number | null, units: UnitSystem): Exclude<TrussMaterial, 'custom'> | null {
  if (v === null) return null;
  return (Object.keys(TRUSS_MATERIALS) as Exclude<TrussMaterial, 'custom'>[]).find((m) => TRUSS_MATERIALS[m][units] === v) ?? null;
}

/**
 * The same truss in the other unit system: every quantity as its own, with all
 * its figures (`exact`), and back again to the very same numbers for values of up
 * to thirteen significant figures. A roller's angle has no unit. A modulus that is
 * a listed material's (29,000 ksi, 200 GPa) is the listed one in the other system
 * (a member's own as well as the section's), not a conversion of it.
 */
export function convertTruss(form: TrussForm, to: UnitSystem): TrussForm {
  if (form.units === to) return form;
  const c = (v: number, q: keyof typeof TRUSS_US_TO_SI): number => {
    const f = TRUSS_US_TO_SI[q];
    return exact(v * (to === 'si' ? f : 1 / f));
  };
  const opt = (v: number | null, q: 'area' | 'E') => (v === null ? null : c(v, q));
  const modulus = (v: number | null) => {
    const listed = listedModulus(v, form.units);
    return listed ? TRUSS_MATERIALS[listed][to] : opt(v, 'E');
  };
  return {
    ...form,
    units: to,
    nodes: form.nodes.map((n) => ({ ...n, x: c(n.x, 'length'), y: c(n.y, 'length') })),
    members: form.members.map((m) => ({ ...m, A: opt(m.A, 'area'), E: modulus(m.E) })),
    loads: form.loads.map((l) => ({ ...l, fx: c(l.fx, 'force'), fy: c(l.fy, 'force') })),
    // A listed material's modulus is the listed one in the other system; any other number is converted.
    E: form.material !== 'custom' && form.E === TRUSS_MATERIALS[form.material][form.units] ? TRUSS_MATERIALS[form.material][to] : modulus(form.E),
    A: opt(form.A, 'area'),
    notice: null,
  };
}

/** What the template group holds, in the other system: the span and the depth (lengths) and the load (a force) are converted; the shape, the panels and the supports stay. */
export function convertTemplateInputs<T extends { span: number; height: number; load: number }>(inputs: T, from: UnitSystem, to: UnitSystem): T {
  if (from === to) return inputs;
  const c = (v: number, q: 'length' | 'force'): number => exact(v * (to === 'si' ? TRUSS_US_TO_SI[q] : 1 / TRUSS_US_TO_SI[q]));
  return { ...inputs, span: c(inputs.span, 'length'), height: c(inputs.height, 'length'), load: c(inputs.load, 'force') };
}

/* ── What each edit does to the form ──────────────────────────────────── */

export type TrussAction =
  /** Opens a whole truss. The form it is given IS the new state (the same object): the page tells "opened whole" from "edited" by that. */
  | { type: 'load'; form: TrussForm }
  | { type: 'units'; units: UnitSystem }
  /** Replaces the geometry, supports and loads by a template's; units and section stay. Parameters are in the form's units. */
  | { type: 'template'; template: TemplateId; params?: Partial<TemplateParams> }
  /** A row is added at the end. `seed` fills what the visitor already chose (a node for a support or a load; the two nodes of a member). */
  | { type: 'add'; list: TrussList; seed?: Record<string, unknown> }
  | { type: 'remove'; list: TrussList; id: number }
  | { type: 'patch'; list: TrussList; id: number; patch: Record<string, unknown> }
  | { type: 'section'; patch: { E?: number | null; A?: number | null } }
  | { type: 'material'; material: TrussMaterial };

const isNode = (form: TrussForm, id: unknown): id is number => typeof id === 'number' && form.nodes.some((n) => n.id === id);

/** Eight figures, the most a field shows: a coordinate computed from another keeps all of them (a rounding to four turned 123,456 into 123,500). */
const eight = (v: number): number => (Number.isFinite(v) ? Number(v.toPrecision(8)) : v);

/** The unit step a new node is placed at from the last one. */
const stepOf = (units: UnitSystem) => (units === 'us' ? 8 : 2.5);

export function reduceTruss(form: TrussForm, action: TrussAction): TrussForm {
  const next = (patch: Partial<TrussForm>): TrussForm => ({ ...form, notice: null, ...patch });
  switch (action.type) {
    case 'load':
      // The form that comes in is the form that stays, so that a caller can tell it from one edited afterwards (`===`).
      return action.form.notice === null ? action.form : { ...action.form, notice: null };
    case 'units':
      return convertTruss(form, action.units);
    case 'template': {
      const t = buildTemplate(action.template, action.params ?? {}, form.units);
      const clamped = t.clamped;
      return next({ ...rowsOf(t, 1), notice: clamped.length > 0 ? { code: 'template', template: action.template, clamped } : null });
    }
    case 'material':
      return next({ material: action.material, E: action.material === 'custom' ? form.E : TRUSS_MATERIALS[action.material][form.units] });
    case 'section': {
      const patch: Partial<TrussForm> = {};
      if ('E' in action.patch) {
        patch.E = action.patch.E ?? null;
        // A modulus typed over a listed material's is the visitor's own.
        if (form.material !== 'custom' && patch.E !== TRUSS_MATERIALS[form.material][form.units]) patch.material = 'custom';
      }
      if ('A' in action.patch) patch.A = action.patch.A ?? null;
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

function add(form: TrussForm, list: TrussList, seed: Record<string, unknown>): TrussForm {
  if (form[list].length >= LIMITS[list]) return { ...form, notice: { code: 'limit', list, max: LIMITS[list] } };
  const id = form.nextId;
  const us = form.units === 'us';
  const num = (v: unknown, fallback: number): number => (typeof v === 'number' ? v : fallback);
  switch (list) {
    case 'nodes': {
      const last = form.nodes[form.nodes.length - 1];
      const x = typeof seed.x === 'number' ? seed.x : last ? eight(last.x + stepOf(form.units)) : 0;
      const y = typeof seed.y === 'number' ? seed.y : last ? last.y : 0;
      return { ...form, notice: null, nodes: [...form.nodes, { id, x, y }], nextId: id + 1 };
    }
    case 'members': {
      let i: number | undefined = isNode(form, seed.i) ? seed.i : undefined;
      let j: number | undefined = isNode(form, seed.j) ? seed.j : undefined;
      const joined = (a: number, b: number) => form.members.some((m) => (m.i === a && m.j === b) || (m.i === b && m.j === a));
      if (i === undefined || j === undefined) {
        // Between two nodes that have no member yet: the last node and the nearest it is not joined to; failing that, the first free pair.
        const ids = form.nodes.map((n) => n.id);
        const at = (n: number) => form.nodes.find((r) => r.id === n)!;
        const free: [number, number][] = [];
        for (let a = ids.length - 1; a >= 0; a--) {
          const others = ids.filter((b) => b !== ids[a] && !joined(ids[a], b)).sort((p, q) => Math.hypot(at(p).x - at(ids[a]).x, at(p).y - at(ids[a]).y) - Math.hypot(at(q).x - at(ids[a]).x, at(q).y - at(ids[a]).y));
          if (others.length > 0) {
            free.push([ids[a], others[0]]);
            break;
          }
        }
        if (free.length === 0) return { ...form, notice: { code: 'nothing-to-add', list: 'members', why: 'pairs' } };
        [i, j] = free[0];
      }
      if (i === j || joined(i, j)) return { ...form, notice: { code: 'nothing-to-add', list: 'members', why: 'pairs' } };
      return { ...form, notice: null, members: [...form.members, { id, i, j, A: null, E: null }], nextId: id + 1 };
    }
    case 'supports': {
      const taken = new Set(form.supports.map((s) => s.node));
      const node = isNode(form, seed.node) ? seed.node : form.nodes.find((n) => !taken.has(n.id))?.id;
      if (node === undefined) return { ...form, notice: { code: 'nothing-to-add', list: 'supports', why: form.nodes.length === 0 ? 'no-node' : 'nodes' } };
      const kind = seed.kind === 'pin' || seed.kind === 'roller' ? seed.kind : form.supports.length === 0 ? 'pin' : 'roller';
      return { ...form, notice: null, supports: [...form.supports, { id, node, kind, angle: num(seed.angle, 90) }], nextId: id + 1 };
    }
    case 'loads': {
      const node = isNode(form, seed.node) ? seed.node : form.nodes[0]?.id;
      if (node === undefined) return { ...form, notice: { code: 'nothing-to-add', list: 'loads', why: 'no-node' } };
      return { ...form, notice: null, loads: [...form.loads, { id, node, fx: num(seed.fx, 0), fy: num(seed.fy, us ? -10 : -40) }], nextId: id + 1 };
    }
  }
}

function remove(form: TrussForm, list: TrussList, id: number): TrussForm {
  if (list !== 'nodes') {
    const at = form[list].findIndex((r) => r.id === id);
    if (at < 0) return form;
    // A member's number is its place in the list: the ones after it move up, and the page says so.
    const notice: TrussNotice | null = list === 'members' && at < form.members.length - 1 ? { code: 'member-removed', member: at + 1 } : null;
    return { ...form, notice, [list]: form[list].filter((r) => r.id !== id) };
  }
  const index = form.nodes.findIndex((n) => n.id === id);
  if (index < 0) return form;
  const gone = form.members.map((m, k) => (m.i === id || m.j === id ? k + 1 : 0)).filter((k) => k > 0);
  // Some member that stays is now numbered differently from before.
  const kept = form.members.map((_, k) => k + 1).filter((label) => !gone.includes(label));
  const membersRenumbered = kept.some((label, k) => label !== k + 1);
  const supports = form.supports.filter((s) => s.node !== id);
  const loads = form.loads.filter((l) => l.node !== id);
  return {
    ...form,
    nodes: form.nodes.filter((n) => n.id !== id),
    members: form.members.filter((m) => m.i !== id && m.j !== id),
    supports,
    loads,
    notice: { code: 'node-removed', node: index + 1, members: gone, supports: form.supports.length - supports.length, loads: form.loads.length - loads.length, renumbered: index < form.nodes.length - 1, membersRenumbered },
  };
}

/** What each list lets a patch change, and what the value must be. */
function patch(form: TrussForm, list: TrussList, id: number, change: Record<string, unknown>): TrussForm {
  const allowed: Record<TrussList, string[]> = { nodes: ['x', 'y'], members: ['i', 'j', 'A', 'E'], supports: ['node', 'kind', 'angle'], loads: ['node', 'fx', 'fy'] };
  const clean: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(change)) {
    if (!allowed[list].includes(key)) continue;
    if (key === 'i' || key === 'j' || key === 'node') {
      if (isNode(form, value)) clean[key] = value;
    } else if (key === 'kind') {
      if (value === 'pin' || value === 'roller') clean[key] = value;
    } else if (key === 'A' || key === 'E') {
      if (value === null || typeof value === 'number') clean[key] = value;
    } else if (typeof value === 'number') clean[key] = value;
  }
  if (Object.keys(clean).length === 0 || !form[list].some((r) => r.id === id)) return form;
  return { ...form, notice: null, [list]: (form[list] as { id: number }[]).map((r) => (r.id === id ? { ...r, ...clean } : r)) };
}

/* ── From the form to the engine ──────────────────────────────────────── */

/** A row of the form, as an issue names it. */
export type TrussRow = { list: TrussList; id: number; field?: string } | { list: 'model'; field: 'E' | 'A' };

export interface EngineInput {
  model: TrussModel;
  /** The id of the row behind each entry of the model, by index: what an issue's `where.index` points at. */
  rows: { nodes: number[]; members: number[]; supports: number[]; loads: number[] };
}

/**
 * The model the engine takes, in feet and kips or metres and kilonewtons. A
 * reference to a node that is not there is index −1, which the engine refuses
 * ('member-node', 'support-node', 'load-node'); a number that is NaN stays NaN,
 * which it reports ('number', 'section'). A value null is left out.
 */
export function toEngine(form: TrussForm): EngineInput {
  const index = new Map(form.nodes.map((n, k) => [n.id, k]));
  const at = (id: number) => index.get(id) ?? -1;
  const k = TO_ENGINE[form.units];
  const model: TrussModel = {
    nodes: form.nodes.map((n) => ({ x: n.x, y: n.y })),
    members: form.members.map((m) => ({
      i: at(m.i),
      j: at(m.j),
      ...(m.A !== null ? { A: m.A * k.area } : {}),
      ...(m.E !== null ? { E: m.E * k.E } : {}),
    })),
    supports: form.supports.map((s) => ({ node: at(s.node), kind: s.kind, ...(s.kind === 'roller' ? { angle: s.angle } : {}) })),
    loads: form.loads.map((l) => ({ node: at(l.node), fx: l.fx, fy: l.fy })),
    ...(form.E !== null ? { E: form.E * k.E } : {}),
    ...(form.A !== null ? { A: form.A * k.area } : {}),
  };
  return { model, rows: { nodes: form.nodes.map((n) => n.id), members: form.members.map((m) => m.id), supports: form.supports.map((s) => s.id), loads: form.loads.map((l) => l.id) } };
}

/** The row of the form an engine issue is about, when it is about one row. */
export function issueRow(issue: TrussIssue, rows: EngineInput['rows']): TrussRow | undefined {
  const w = issue.where;
  if (!w) return undefined;
  if (w.list === 'model') return { list: 'model', field: w.field === 'A' ? 'A' : 'E' };
  const id = rows[w.list][w.index];
  return id === undefined ? undefined : { list: w.list, id, ...(w.field ? { field: w.field } : {}) };
}

/** A node's label: its place in the list, from 1. 0 for an id that is not there. */
export function nodeLabel(form: TrussForm, id: number): number {
  return form.nodes.findIndex((n) => n.id === id) + 1;
}

/* ── The case in an address ───────────────────────────────────────────── */

const MATERIAL_LETTER: Record<TrussMaterial, string> = { steel: 's', aluminum: 'a', custom: 'u' };

/**
 * A number as THIS address carries it: fifteen significant figures, where the
 * other calculators' carry the eight a field shows. A truss that was converted to
 * the other units holds the full figures of the conversion (`convertTruss`), and a
 * link that rounded them would open a truss whose symmetric members are no longer.
 */
const written15 = (v: number): string => (Number.isFinite(v) ? String(Number(v.toPrecision(15))).replace('e+', 'e') : written(v));

/**
 * Whether replacing `before` by `after` throws a truss away that nobody could get back: it is not the example (which "Start
 * over" brings back) and it is not what `after` is. The page then leaves it one step behind in the browser's history, so
 * that Back restores it - for "Start over" and for "Load template" alike.
 */
export function leavesBehind(before: TrussForm, after: TrussForm, example: string): boolean {
  const was = encodeTruss(before);
  return was !== example && was !== encodeTruss(after);
}

/** The version of the address, its first field. A reader of another version returns null; it is raised only if the format changes. */
const VERSION = '1';

/*
 * The longest address a form can write: 40 nodes with both coordinates at 22
 * characters, 120 members each with both sizes at 22, 40 supports and 80 loads
 * (model.test.ts writes it). Every ordinary truss is under 800 characters.
 */
export const MAX_LINK = 12000;

/**
 * The case as a short string for the page's address (after `#t=`), so a link
 * opens the same truss. Written as the other calculators write theirs
 * (beam/model.ts, `encodeBeam`): each number to fifteen figures (`written15`), nothing but numbers, a few letters and the separators `; _ ,`. Seven
 * fields, the rows of a list joined by `_`:
 *
 *     version ; units ; section ; nodes ; members ; supports ; loads
 *
 *   version   1
 *   units     us | si
 *   section   material letter (s steel, a aluminum, u the visitor's own), the
 *             modulus and the area — each empty when not given:  s,29000,4
 *   a node    x,y
 *   a member  i,j  or  i,j,A  or  i,j,A,E   — i and j are NODE NUMBERS (the
 *             labels, from 1); A and E are empty when the member has none:
 *             1,2,,29000
 *   a support p,node,angle    a pin (the angle it keeps for when it is a roller again)
 *             r,node,angle    a roller; the angle in degrees
 *   a load    node,fx,fy
 *
 * A link carries no ids: the rows are numbered again on reading, nodes first,
 * then members, supports and loads. WHATEVER THE FORM HOLDS IS WRITTEN and read
 * back as that form — a node with no member, a number that is NaN, a member from
 * a node to itself — so that a reload comes back to the truss that was on screen,
 * with its warning, and not to the example.
 *
 * IT BEGINS WITH A CHECK of the rest, the first calculator's (`checkOf`): a link
 * cut short, or with a character more, less or changed, is not a link to
 * another truss.
 */
export function encodeTruss(form: TrussForm): string {
  const n = written15;
  const optional = (v: number | null) => (v === null ? '' : n(v));
  const label = (id: number) => nodeLabel(form, id);
  const body = [
    VERSION,
    form.units,
    `${MATERIAL_LETTER[form.material]},${optional(form.E)},${optional(form.A)}`,
    form.nodes.map((p) => `${n(p.x)},${n(p.y)}`).join('_'),
    form.members
      .map((m) => {
        const base = `${label(m.i)},${label(m.j)}`;
        if (m.A === null && m.E === null) return base;
        return m.E === null ? `${base},${optional(m.A)}` : `${base},${optional(m.A)},${optional(m.E)}`;
      })
      .join('_'),
    form.supports.map((s) => `${s.kind === 'pin' ? 'p' : 'r'},${label(s.node)},${n(s.angle)}`).join('_'),
    form.loads.map((l) => `${label(l.node)},${n(l.fx)},${n(l.fy)}`).join('_'),
  ].join(';');
  return `${checkOf(body)};${body}`;
}
/** The shell's names for the same two. */
export const encode = encodeTruss;

/**
 * The truss a string from `encodeTruss` describes, or `null` if it is anything
 * else: a check that is not the rest's, a version that is not 1, not seven
 * fields, a number in any notation but the page's own, more rows than the cap,
 * a member or a support or a load that names a node that is not in the list, a
 * material that is none of the three. Never throws, whatever the string is —
 * it comes back from wherever a link was pasted.
 */
export function decodeTruss(text: string): TrussForm | null {
  try {
    return read(text);
  } catch {
    return null;
  }
}
export const decode = decodeTruss;

function read(text: string): TrussForm | null {
  if (typeof text !== 'string' || text.length > MAX_LINK) return null;
  const body = checked(text);
  if (body === null) return null;
  const parts = body.split(';');
  if (parts.length !== 7) return null;
  const [version, units, sectionText, nodeText, memberText, supportText, loadText] = parts;
  if (version !== VERSION || (units !== 'us' && units !== 'si')) return null;
  let bad = false;
  const num = (s: string): number => {
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
  if (section.length !== 3) return null;
  const material = (Object.keys(MATERIAL_LETTER) as TrussMaterial[]).find((key) => MATERIAL_LETTER[key] === section[0]);
  if (!material) return null;
  const E = optional(section[1]);
  const A = optional(section[2]);

  const nodeRows = rows(nodeText, 2, 2, MAX_NODES);
  if (bad) return null;
  let id = 1;
  const nodes: NodeRow[] = nodeRows.map(([x, y]) => ({ id: id++, x: num(x), y: num(y) }));
  const ref = (s: string): number => {
    if (!/^[1-9]\d{0,2}$/.test(s) || Number(s) > nodes.length) {
      bad = true;
      return 0;
    }
    return nodes[Number(s) - 1].id;
  };
  const members: MemberRow[] = rows(memberText, 2, 4, MAX_MEMBERS).map(([i, j, a, e]) => ({ id: id++, i: ref(i), j: ref(j), A: optional(a), E: optional(e) }));
  const supports: SupportRow[] = rows(supportText, 2, 3, MAX_SUPPORTS).map((r) => {
    const kind = r[0] === 'p' ? 'pin' : r[0] === 'r' ? 'roller' : null;
    if (kind === null || r.length !== 3) bad = true;
    return { id: id++, node: ref(r[1] ?? ''), kind: kind ?? 'pin', angle: num(r[2] ?? '') };
  });
  const loads: LoadRow[] = rows(loadText, 3, 3, MAX_LOADS).map(([node, fx, fy]) => ({ id: id++, node: ref(node), fx: num(fx), fy: num(fy) }));
  if (bad) return null;
  return { units, nodes, members, supports, loads, material, E, A, notice: null, nextId: id };
}
