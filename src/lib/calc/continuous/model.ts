import {
  MAX_ROWS,
  NAMED,
  NUMBER,
  US_TO_SI,
  checkOf,
  convertUnits,
  decodeBeam,
  deflectionFactor,
  encodeBeam,
  reduceBeam,
  round4,
  signed,
  tidy,
  written,
  type BeamAction,
  type BeamForm,
  type Direction,
  type SectionProps,
  type UnitSystem,
} from '../beam/model';
import type { SupportKind } from '../beam/solver';
import type { ContinuousIssue, ContinuousIssueCode, ContinuousModel, EndKind, SpanDistLoad, SpanPointLoad } from './types';

/**
 * ─────────────────────────────────────────────────────────────────────────────
 * CONTINUOUS BEAM — what the visitor edits, and what the engine is given
 * ─────────────────────────────────────────────────────────────────────────────
 * Between the form of the third calculator ("Continuous beam",
 * /resources/continuous-beam) and its engine (types.ts is the agreement
 * between the two). Pure functions, no React: the beam as entered, span by
 * span (`ContinuousForm`); what each edit does to it; the model the engine
 * takes, and which row of the form each of its entries is; the same beam as
 * the first calculator draws it and opens it; what only the form can know is
 * wrong; and the address that carries the case from one engineer to another.
 *
 * WHAT IS THE FIRST CALCULATOR'S IS USED, NOT WRITTEN AGAIN. The two unit
 * systems, the section and its stiffness (`sectionProps`, `stiffness`,
 * `deflectionFactor`, `bendingStress`, `shearStress`), the rounding of a
 * converted value, how a number travels in an address and the check an
 * address begins with are beam/model.ts's. The section of this form IS that
 * form's `section`, so whatever edits it, converts it or writes it in an
 * address is asked of that file, through a beam of nothing that carries it
 * (`carrier`).
 *
 * UNITS. The form holds numbers in the units it SHOWS: feet and kips or
 * metres and kilonewtons along the beam, inches or millimetres in the
 * section — and for a settlement, which is a length of that size. The
 * engine is given the first set as it is; a settlement is brought to it in
 * one place (`toEngine`), through the factor a deflection is shown by, so no
 * 12 and no 1,000 is written in this file.
 *
 * POSITIONS. A load is on ONE span, which it names by its place among the
 * spans (from 0, as the engine does), and is placed from that span's left
 * end. Only `toBeamForm` works out places along the whole beam.
 */

/** What this page's case is called in its address: `#c=…` — the first calculator's is `#b=…`, the second's `#s=…`. */
export const CONTINUOUS_KEY = 'c';

/** The most spans the form takes. Eight spans with live load are 256 arrangements of it. */
export const MAX_SPANS = 8;

/** The section and its material: the first calculator's own. */
export type Section = BeamForm['section'];

/** A span as entered. */
export interface SpanRow {
  id: number;
  /** Length (ft, m). */
  L: number;
  /** Its stiffness as a multiple of the section's EI: 1 where the span is that section. */
  k: number;
  /** Uniform loads over the whole span, downward (kip/ft, kN/m): the one that is always there, and the one that may be on the span or off it. Zero: none. */
  dead: number;
  live: number;
}

/** A point load on one span, `a` from that span's left end (ft, m; kip, kN). */
export interface PointRow {
  id: number;
  /** Which span: its place among the spans, from 0. */
  span: number;
  a: number;
  P: number;
  dir: Direction;
  /** Part of the live load of its span; otherwise it is always there. */
  live: boolean;
}

/** A distributed load over part of one span, from w1 at a1 to w2 at a2 (from that span's left end). */
export interface DistRow {
  id: number;
  span: number;
  a1: number;
  a2: number;
  w1: number;
  w2: number;
  dir: Direction;
  live: boolean;
}

export interface ContinuousForm {
  units: UnitSystem;
  /** Left to right: never none. */
  spans: SpanRow[];
  /** How each end of the beam is held. Every joint between two spans is a simple support. */
  left: EndKind;
  right: EndKind;
  /**
   * How far each support is pushed DOWN (in, mm — the unit a deflection is
   * shown in): one per joint, left to right, so one more than there are
   * spans whatever is done to them. Zero: the support does not move. A free
   * end has no support, and what is kept here for it counts for nothing.
   */
  settlements: number[];
  points: PointRow[];
  dists: DistRow[];
  /** The live load taken in EVERY arrangement, span by span: the page then shows the range of each result. Otherwise it is on every span at once. */
  everyArrangement: boolean;
  section: Section;
  /** The next id to hand out: ids only ever grow, so a removed row's is never reused. */
  nextId: number;
}

/** The two lists of loads, and the three lists of rows. */
export type LoadList = 'points' | 'dists';
export type ContinuousList = 'spans' | LoadList;

/**
 * The beam the page opens with — its own, as each calculator's is: three
 * spans of 24, 30 and 24 ft on simple supports, 0.9 kip/ft of dead load and
 * 1.2 kip/ft of live load on each, the live load taken in every arrangement,
 * on a W21×44's properties (d·tw = 20.7 × 0.350 for the shear area).
 *
 * Its spans are numbered as a link numbers them, so this beam read back from
 * its own address is this beam, id for id.
 */
export function defaultContinuous(): ContinuousForm {
  return {
    units: 'us',
    spans: [
      { id: 1, L: 24, k: 1, dead: 0.9, live: 1.2 },
      { id: 2, L: 30, k: 1, dead: 0.9, live: 1.2 },
      { id: 3, L: 24, k: 1, dead: 0.9, live: 1.2 },
    ],
    left: 'pin',
    right: 'pin',
    settlements: [0, 0, 0, 0],
    points: [],
    dists: [],
    everyArrangement: true,
    section: { mode: 'props', material: 'steel', E: 29000, I: 843, S: 81.6, Av: 7.245, b: 12, h: 24, shape: 'W21X44', selfWeight: false },
    nextId: 4,
  };
}

/*
 * The section is the first calculator's (beam/model.ts): what converts it,
 * edits it and writes it in an address takes a `BeamForm`. So it is handed
 * one — a beam of nothing, in this form's units and with its section — and
 * the section is read from what comes back. (span.ts brings a stress to the
 * other units the same way.)
 */
const carrier = (form: Pick<ContinuousForm, 'units' | 'section'>): BeamForm => ({ units: form.units, L: 0, supports: [], hinges: [], points: [], dists: [], couples: [], section: form.section, nextId: 1 });

/** The settlement of every joint, left to right: one more than there are spans, whatever the list holds. */
const settlementsOf = (form: ContinuousForm): number[] => Array.from({ length: form.spans.length + 1 }, (_, j) => form.settlements[j] ?? 0);

/** Whether something holds the beam at a joint: a simple support at every joint between two spans, and at an end unless it is free. */
const held = (form: ContinuousForm, joint: number): boolean => (joint === 0 ? form.left : joint === form.spans.length ? form.right : 'pin') !== 'free';

/** Whether a support of the beam is given a settlement — a value that is not a number is one, until it is retyped. */
export function settles(form: ContinuousForm): boolean {
  return settlementsOf(form).some((d, j) => d !== 0 && held(form, j));
}

/**
 * Whether every span is the section entered: each stiffness factor is 1.
 * Where one is not, that span is another section, of which only the
 * stiffness is known: a stress worked out with the S and the shear area
 * entered would be a stress in a member that is not there.
 */
export function oneSection(form: ContinuousForm): boolean {
  return form.spans.every((s) => s.k === 1);
}

/** Where each joint is along the whole beam, left to right, from 0: the last is the beam's length. */
export function jointPositions(form: ContinuousForm): number[] {
  const at = [0];
  for (const s of form.spans) at.push(at[at.length - 1] + s.L);
  return at;
}

/**
 * The same beam in the other unit system, as `convertUnits` does it for the
 * first calculator: every quantity as its own, to the figures a field shows,
 * and back again to the very same numbers. A stiffness factor has no unit.
 */
export function convertContinuous(form: ContinuousForm, to: UnitSystem): ContinuousForm {
  if (form.units === to) return form;
  const c = (v: number, q: keyof typeof US_TO_SI) => tidy(v * (to === 'si' ? US_TO_SI[q] : 1 / US_TO_SI[q]));
  return {
    ...form,
    units: to,
    spans: form.spans.map((s) => ({ ...s, L: c(s.L, 'length'), dead: c(s.dead, 'line'), live: c(s.live, 'line') })),
    // Inches and millimetres, as a side of the rectangle.
    settlements: form.settlements.map((d) => c(d, 'dim')),
    points: form.points.map((p) => ({ ...p, a: c(p.a, 'length'), P: c(p.P, 'force') })),
    dists: form.dists.map((d) => ({ ...d, a1: c(d.a1, 'length'), a2: c(d.a2, 'length'), w1: c(d.w1, 'line'), w2: c(d.w2, 'line') })),
    section: convertUnits(carrier(form), to).section,
  };
}

/* ── What each edit does to the form ──────────────────────────────────── */

export type ContinuousAction =
  | { type: 'load'; form: ContinuousForm }
  | { type: 'reset' }
  | { type: 'units'; units: UnitSystem }
  | { type: 'end'; side: 'left' | 'right'; kind: EndKind }
  | { type: 'settlement'; joint: number; value: number }
  | { type: 'arrangements'; every: boolean }
  /** A span is added after the last. A load goes on the span named (its place, from 0), or on the first. */
  | { type: 'add'; list: ContinuousList; span?: number }
  | { type: 'remove'; list: ContinuousList; id: number }
  | { type: 'patch'; list: ContinuousList; id: number; patch: Record<string, unknown> }
  | { type: 'carry-end'; id: number; from: number; to: number }
  | Extract<BeamAction, { type: 'section' | 'material' }>;

export function reduceContinuous(form: ContinuousForm, action: ContinuousAction): ContinuousForm {
  switch (action.type) {
    case 'load':
      return action.form;
    case 'reset':
      return defaultContinuous();
    case 'units':
      return convertContinuous(form, action.units);
    case 'end':
      // Nothing else moves: the settlement kept for an end that is now free
      // is still there when the end is given its support back.
      return action.side === 'left' ? { ...form, left: action.kind } : { ...form, right: action.kind };
    case 'settlement': {
      if (!Number.isInteger(action.joint) || action.joint < 0 || action.joint > form.spans.length) return form;
      const settlements = settlementsOf(form);
      settlements[action.joint] = action.value;
      return { ...form, settlements };
    }
    case 'arrangements':
      return { ...form, everyArrangement: action.every };
    case 'add': {
      const id = form.nextId;
      const us = form.units === 'us';
      if (action.list === 'spans') {
        if (form.spans.length >= MAX_SPANS) return form;
        // Another like the last: its length and its two loads. Its stiffness
        // is the section's own, and the support at its far end is new and
        // has not settled; the supports there were stay as they are.
        const last = form.spans[form.spans.length - 1] ?? { L: us ? 20 : 6, dead: 0, live: 0 };
        return { ...form, spans: [...form.spans, { id, L: last.L, k: 1, dead: last.dead, live: last.live }], settlements: [...settlementsOf(form), 0], nextId: id + 1 };
      }
      if (form[action.list].length >= MAX_ROWS) return form;
      const span = action.span !== undefined && form.spans[action.span] ? action.span : 0;
      const mid = round4((form.spans[span]?.L ?? 0) / 2);
      // Always there until it is marked as live: nothing is left out of an arrangement by default.
      if (action.list === 'points') return { ...form, points: [...form.points, { id, span, a: mid, P: us ? 10 : 50, dir: 'down', live: false }], nextId: id + 1 };
      // Over the first half of its span: over the whole of it, it would be the span's own uniform load again.
      return { ...form, dists: [...form.dists, { id, span, a1: 0, a2: mid, w1: us ? 1 : 15, w2: us ? 1 : 15, dir: 'down', live: false }], nextId: id + 1 };
    }
    case 'remove': {
      if (action.list !== 'spans') return { ...form, [action.list]: form[action.list].filter((r) => r.id !== action.id) };
      const i = form.spans.findIndex((s) => s.id === action.id);
      // A beam has a span.
      if (i < 0 || form.spans.length <= 1) return form;
      // The span goes with its loads and with one joint: the support at its
      // right end — or, for the first span, the one at its left, where the
      // beam used to begin. What is further right moves up by one span, and
      // every load left is still on the span it was on: none is put on
      // another because its own is gone.
      const gone = i === 0 ? 0 : i + 1;
      const kept = <T extends { span: number }>(rows: T[]): T[] => rows.filter((r) => r.span !== i).map((r) => (r.span > i ? { ...r, span: r.span - 1 } : r));
      return { ...form, spans: form.spans.filter((_, j) => j !== i), settlements: settlementsOf(form).filter((_, j) => j !== gone), points: kept(form.points), dists: kept(form.dists) };
    }
    case 'patch': {
      // A load is moved to a span of the beam, or it stays on its own.
      const { span, ...rest } = action.patch;
      const patch = action.list === 'spans' || (typeof span === 'number' && form.spans[span] !== undefined) ? action.patch : rest;
      return { ...form, [action.list]: form[action.list].map((r) => (r.id === action.id ? { ...r, ...patch } : r)) };
    }
    case 'carry-end': {
      // What sat on the right end of a span stays on it when the span is
      // made longer or shorter: a load placed at the end, a distributed load
      // that ran to it. Done once, when the length field is left, as the
      // first calculator does (beam/model.ts) and for its reason: typing 30
      // over 24 passes through 3.
      const { from, to } = action;
      const i = form.spans.findIndex((s) => s.id === action.id);
      if (i < 0 || !(from > 0) || !(to > 0) || from === to) return form;
      const end = (a: number) => (Math.abs(a - from) < 1e-9 * from ? to : a);
      return {
        ...form,
        points: form.points.map((p) => (p.span === i ? { ...p, a: end(p.a) } : p)),
        dists: form.dists.map((d) => (d.span === i ? { ...d, a1: end(d.a1), a2: end(d.a2) } : d)),
      };
    }
    case 'section':
    case 'material':
      return { ...form, section: reduceBeam(carrier(form), action).section };
  }
}

/* ── From the form to the engine ──────────────────────────────────────── */

/** A row of the form, as an issue names it: a span (and which of its fields, when it is one), a joint's settlement, or a load. */
export type ContinuousRow =
  | { list: 'spans'; id: number; field?: 'L' | 'k' | 'dead' | 'live' }
  | { list: 'settlements'; joint: number }
  | { list: LoadList; id: number };

/** What the engine says of a beam, and what only the form can know: a section value that is not one, a settlement with no E or I to make a force of it. */
export type ContinuousFormIssueCode = ContinuousIssueCode | 'section' | 'settlement';
export interface ContinuousFormIssue {
  code: ContinuousFormIssueCode;
  /** The row at fault, when it is one row. */
  row?: ContinuousRow;
}

export interface EngineInput {
  model: ContinuousModel;
  /**
   * Which row of the form each entry of the model is, list by list and in
   * the model's order. Its spans and its settlements are the form's, one for
   * one; its distributed loads are not — the uniform loads of the spans are
   * among them — and `null` there is the beam's own weight, which is no row.
   */
  rows: { spans: ContinuousRow[]; settlements: ContinuousRow[]; points: ContinuousRow[]; dists: (ContinuousRow | null)[] };
}

/**
 * The beam as the engine takes it (types.ts): the spans with their stiffness
 * factors, the two ends, and
 *
 *   — the uniform dead and live load of each span as distributed loads over
 *     the whole of it, span by span (a load of zero is none, and is not
 *     sent); then the form's own distributed loads; then, when the section
 *     is a steel shape and its own weight is asked for, that weight on every
 *     span, as a load that is always there. Last, so that it moves no row;
 *   — directions as signs: down is positive;
 *   — each settlement multiplied by EI, in the engine's units. It is a
 *     length in inches or millimetres and a deflection is shown in the same,
 *     so it is divided by the factor a deflection is shown through
 *     (`deflectionFactor`: the engine's EI·v to inches or millimetres). At a
 *     free end there is no support: zero, whatever the form keeps.
 *
 * `section` is what `sectionProps` gives for the form, `EI` what `stiffness`
 * gives for that.
 *
 * A SETTLEMENT WITH NO EI — no modulus, or no moment of inertia — cannot be
 * made a force of. It is sent as "not a number", so that an engine asked all
 * the same refuses the beam rather than solve it as if nothing had settled.
 * `formIssues` names it first, in words of its own.
 */
export function toEngine(form: ContinuousForm, section: SectionProps, EI: number): EngineInput {
  const points: SpanPointLoad[] = form.points.map((p) => ({ span: p.span, a: p.a, P: p.dir === 'down' ? p.P : -p.P, live: p.live }));
  const dists: SpanDistLoad[] = [];
  const distRows: (ContinuousRow | null)[] = [];
  form.spans.forEach((s, span) => {
    for (const field of ['dead', 'live'] as const) {
      if (s[field] === 0) continue;
      dists.push({ span, a1: 0, a2: s.L, w1: s[field], w2: s[field], live: field === 'live' });
      distRows.push({ list: 'spans', id: s.id, field });
    }
  });
  for (const d of form.dists) {
    const sign = d.dir === 'down' ? 1 : -1;
    dists.push({ span: d.span, a1: d.a1, a2: d.a2, w1: sign * d.w1, w2: sign * d.w2, live: d.live });
    distRows.push({ list: 'dists', id: d.id });
  }
  if (section.selfWeight) {
    form.spans.forEach((s, span) => {
      dists.push({ span, a1: 0, a2: s.L, w1: section.selfWeight, w2: section.selfWeight, live: false });
      distRows.push(null);
    });
  }
  // What one unit of the engine's EI·v is, in the unit a settlement is entered in; zero when there is no EI.
  const shown = deflectionFactor(form.units, EI);
  return {
    model: {
      spans: form.spans.map((s) => ({ L: s.L, k: s.k })),
      left: form.left,
      right: form.right,
      settlements: settlementsOf(form).map((d, j) => (d === 0 || !held(form, j) ? 0 : shown > 0 ? d / shown : Number.NaN)),
      points,
      dists,
    },
    rows: {
      spans: form.spans.map((s) => ({ list: 'spans', id: s.id })),
      settlements: settlementsOf(form).map((_, joint) => ({ list: 'settlements', joint })),
      points: form.points.map((p) => ({ list: 'points', id: p.id })),
      dists: distRows,
    },
  };
}

/**
 * An issue of the engine as the form shows it: on its row. A span is named
 * for its length or for its stiffness factor, and the code says which; a
 * span's uniform load is named as that span's field. The beam's own weight
 * is nobody's row, and neither is an issue of the whole beam.
 */
export function issueOnRow(issue: ContinuousIssue, rows: EngineInput['rows']): ContinuousFormIssue {
  const row = issue.where ? rows[issue.where.list][issue.where.index] : null;
  if (!row) return { code: issue.code };
  return { code: issue.code, row: issue.where?.list === 'spans' && row.list === 'spans' ? { ...row, field: issue.code === 'stiffness' ? 'k' : 'L' } : row };
}

/**
 * What only the form can know is wrong, before the engine is asked. `EI` is
 * what `stiffness` gives for the form's section: zero when the modulus or
 * the moment of inertia is missing.
 *
 * 'settlement' — a support is pushed down by a length, and there is no EI to
 * say what force that takes: on its joint. THE BEAM IS NOT TO BE SOLVED
 * then (see `toEngine`): its reactions and moments would be those of
 * supports that had not moved. A settlement that is not a number is the
 * engine's to name.
 *
 * 'section' — a section value that is not one: negative, or not a number.
 * Only what the chosen kind of section uses, by the first calculator's rule
 * (beam/model.ts, `analyse`; model.test.ts holds the two together): a
 * steel shape brings its own modulus, and a leftover in a field that is not
 * on screen is no problem. As there, it does not stop the beam being solved:
 * `sectionProps` reads such a value as "not given".
 */
export function formIssues(form: ContinuousForm, EI: number): ContinuousFormIssue[] {
  const issues: ContinuousFormIssue[] = [];
  if (!(EI > 0)) {
    settlementsOf(form).forEach((d, joint) => {
      if (d !== 0 && Number.isFinite(d) && held(form, joint)) issues.push({ code: 'settlement', row: { list: 'settlements', joint } });
    });
  }
  const s = form.section;
  const bad = (v: number) => !Number.isFinite(v) || v < 0;
  if ((s.mode !== 'shape' && bad(s.E)) || (s.mode === 'props' && (bad(s.I) || bad(s.S) || bad(s.Av))) || (s.mode === 'rect' && (bad(s.b) || bad(s.h)))) issues.push({ code: 'section' });
  return issues;
}

/* ── The same beam, as the first calculator holds one ─────────────────── */

/**
 * The beam as a `BeamForm` of the first calculator, in positions along the
 * whole beam: what the drawing takes (BeamSchematic.tsx), and what the first
 * calculator opens (`generalCode`).
 *
 *   — The supports. An end on a simple support and every joint between two
 *     spans are simple supports — the first of them along the beam a pin,
 *     the others rollers, as the engine names them; a fixed end is fixed; a
 *     free end has none.
 *   — Every load in its place: the uniform dead and live load of each span
 *     over that span, then the form's own distributed loads, and the point
 *     loads. Dead and live are not added together: each is drawn with the
 *     number that was typed.
 *
 * What a `BeamForm` has no word for is not in it: the stiffness factors, the
 * settlements, which loads are live. The beam's own weight is not a row
 * there either: the section carries it, and the drawing is given it apart.
 *
 * A load that names no span of the beam has no place, and is left out. One
 * placed past the end of its span is drawn where its numbers put it — its
 * row says it is off its span.
 *
 * IDS. A load row keeps its id. What is no row of that list here is numbered
 * below zero, where no row's id can be (they are handed out from `nextId`,
 * upward): the support at joint j is −(j + 1); of span i (from 0), the dead
 * load is −(2i + 1) and the live load −(2i + 2).
 */
export function toBeamForm(form: ContinuousForm): BeamForm {
  const at = jointPositions(form);
  const supports: BeamForm['supports'] = [];
  let pinned = false;
  at.forEach((x, j) => {
    if (!held(form, j)) return;
    const fixed = (j === 0 && form.left === 'fixed') || (j === form.spans.length && form.right === 'fixed');
    const kind: SupportKind = fixed ? 'fixed' : pinned ? 'roller' : 'pin';
    if (!fixed) pinned = true;
    supports.push({ id: -(j + 1), kind, x });
  });
  const dists: BeamForm['dists'] = [];
  form.spans.forEach((s, i) => {
    if (s.dead !== 0) dists.push({ id: -(2 * i + 1), x1: at[i], x2: at[i + 1], w1: s.dead, w2: s.dead, dir: 'down' });
    if (s.live !== 0) dists.push({ id: -(2 * i + 2), x1: at[i], x2: at[i + 1], w1: s.live, w2: s.live, dir: 'down' });
  });
  const placed = <T extends { span: number }>(rows: T[]): T[] => rows.filter((r) => form.spans[r.span] !== undefined);
  for (const d of placed(form.dists)) dists.push({ id: d.id, x1: at[d.span] + d.a1, x2: at[d.span] + d.a2, w1: d.w1, w2: d.w2, dir: d.dir });
  return {
    units: form.units,
    L: at[at.length - 1],
    supports,
    hinges: [],
    points: placed(form.points).map((p) => ({ id: p.id, x: at[p.span] + p.a, P: p.P, dir: p.dir })),
    dists,
    couples: [],
    section: form.section,
    nextId: form.nextId,
  };
}

/**
 * This beam as the first calculator's address carries one (what follows its
 * `#b=`), for the page's link to it — or `null` when that calculator cannot
 * hold this beam as it is:
 *
 *   — a stiffness factor is not 1: it has one EI along the beam;
 *   — a support settles: its supports do not move;
 *   — a span's length is not a positive number, or a load is not on the span
 *     it names. Along the whole beam such a load would land on the next
 *     span, and two joints at one place would be one support: a beam that
 *     calculator solves, and not this one;
 *   — there are more loads than it lists (`MAX_ROWS` of a kind). Here the
 *     two uniform loads of each span are fields of the span; there each is
 *     a row.
 *
 * What it opens is the beam under all its loads at once: that calculator has
 * no dead and no live load. Positions are along the whole beam, written to
 * the eight figures a field shows, as every number in an address is.
 */
export function generalCode(form: ContinuousForm): string | null {
  if (!oneSection(form) || settles(form)) return null;
  if (!form.spans.every((s) => s.L > 0 && Number.isFinite(s.L))) return null;
  const on = (span: number, a: number) => form.spans[span] !== undefined && a >= 0 && a <= form.spans[span].L;
  if (!form.points.every((p) => on(p.span, p.a)) || !form.dists.every((d) => on(d.span, d.a1) && on(d.span, d.a2))) return null;
  const beam = toBeamForm(form);
  if (beam.points.length > MAX_ROWS || beam.dists.length > MAX_ROWS) return null;
  return encodeBeam(beam);
}

/* ── The case in an address ───────────────────────────────────────────── */

/* How an end is held, as one letter: n is "nothing holds it". */
const END_LETTER: Record<EndKind, string> = { pin: 'p', fixed: 'f', free: 'n' };

/*
 * No form writes a longer address: eight spans, twelve loads of each kind
 * and nine settlements, with every number at its longest (22 characters, as
 * in beam/model.ts), come to 2,779 characters. model.test.ts writes it.
 */
const MAX_LINK = 3000;

/** The section's field of an address, as the first calculator writes it: the last of a beam's. */
const sectionField = (form: Pick<ContinuousForm, 'units' | 'section'>): string => {
  const beam = encodeBeam(carrier(form));
  return beam.slice(beam.lastIndexOf(';') + 1);
};

/**
 * The case as a short string for the page's address (after `#c=`), so a link
 * opens the same beam. Written as the first calculator writes a beam
 * (beam/model.ts, `encodeBeam`) and with its own means: each number to the
 * eight figures its field shows, signs for the directions, nothing but
 * numbers and a few letters. Seven fields, the rows of a list joined by `_`:
 *
 *     units ; ends ; spans ; settlements ; point loads ; distributed loads ; section
 *
 *   ends          two letters, left then right — p on a simple support, f
 *                 fixed, n free — and 1 when the live load is taken in every
 *                 arrangement, 0 when it is on every span
 *   spans         length,k,dead,live of each
 *   settlements   one per joint; nothing at all when no support is moved
 *   a load        d or l (always there, or live) and its span counted from
 *                 1; then its place and its size: span,a,P and
 *                 span,a1,a2,w1,w2
 *   section       the first calculator's own field, written by it
 *
 * WHATEVER THE FORM HOLDS IS WRITTEN, and read back as that form: a length
 * of 0 on its way to 0.5, a stiffness factor of 0, a number of any size. A
 * reload must come back to the beam that was on screen, with its warning —
 * not to the example.
 *
 * IT BEGINS WITH A CHECK of the rest, the first calculator's (`checkOf`): a
 * link that lost a character on its way is not a link to another beam.
 */
export function encodeContinuous(form: ContinuousForm): string {
  const n = written;
  const on = (r: { span: number; live: boolean }) => `${r.live ? 'l' : 'd'}${r.span + 1}`;
  const moved = settlementsOf(form);
  const body = [
    form.units,
    `${END_LETTER[form.left]}${END_LETTER[form.right]}${form.everyArrangement ? 1 : 0}`,
    form.spans.map((s) => `${n(s.L)},${n(s.k)},${n(s.dead)},${n(s.live)}`).join('_'),
    moved.every((d) => d === 0) ? '' : moved.map(n).join('_'),
    form.points.map((p) => `${on(p)},${n(p.a)},${signed(p.P, p.dir === 'up')}`).join('_'),
    form.dists.map((d) => `${on(d)},${n(d.a1)},${n(d.a2)},${signed(d.w1, d.dir === 'up')},${signed(d.w2, d.dir === 'up')}`).join('_'),
    sectionField(form),
  ].join(';');
  return `${checkOf(body)};${body}`;
}

/**
 * The case a string from `encodeContinuous` describes, or `null` if it is
 * anything else: a check that is not the rest's, not seven fields, a number
 * in any notation but the page's own, a beam of no span or of more than
 * eight, a list of settlements that is not one per joint, a load on a span
 * that is not there, a section the first calculator refuses. The string
 * comes back from wherever a link was pasted.
 *
 * The rows are numbered again, the spans first: a link carries no ids.
 */
export function decodeContinuous(text: string): ContinuousForm | null {
  if (text.length > MAX_LINK) return null;
  const cut = text.indexOf(';');
  const body = text.slice(cut + 1);
  if (cut < 1 || text.slice(0, cut) !== checkOf(body)) return null;
  const parts = body.split(';');
  if (parts.length !== 7) return null;
  const [units, ends, spans, settlements, points, dists, section] = parts;
  if (units !== 'us' && units !== 'si') return null;
  const end = /^([pfn])([pfn])([01])$/.exec(ends);
  if (!end) return null;
  // One of the three letters, each of them an end: found among them, never looked up as a property.
  const kindOf = (letter: string) => (Object.keys(END_LETTER) as EndKind[]).find((kind) => END_LETTER[kind] === letter)!;
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
  const rows = (s: string, fields: number, most: number): string[][] => {
    if (s === '') return [];
    const list = s.split('_').map((r) => r.split(','));
    if (list.length <= most && list.every((r) => r.length === fields)) return list;
    // Not a list: none of it is read.
    bad = true;
    return [];
  };
  let id = 1;
  const spanRows: SpanRow[] = rows(spans, 4, MAX_SPANS).map(([L, k, dead, live]) => ({ id: id++, L: num(L), k: num(k), dead: num(dead), live: num(live) }));
  const moved = rows(settlements, 1, MAX_SPANS + 1).map(([d]) => num(d));
  if (spanRows.length === 0 || (moved.length !== 0 && moved.length !== spanRows.length + 1)) return null;
  /** Which span a load is on, and whether it is live: d2 is always there, on the second span. */
  const on = (mark: string): { span: number; live: boolean } => {
    const m = /^([dl])([1-9])$/.exec(mark);
    const span = m ? Number(m[2]) - 1 : 0;
    if (!m || span >= spanRows.length) bad = true;
    return { span, live: m?.[1] === 'l' };
  };
  const pointRows: PointRow[] = rows(points, 3, MAX_ROWS).map(([mark, a, P]) => ({ id: id++, ...on(mark), a: num(a), P: Math.abs(num(P)), dir: reversed(P) ? 'up' : 'down' }));
  const distRows: DistRow[] = rows(dists, 5, MAX_ROWS).map(([mark, a1, a2, w1, w2]) => {
    const a = num(w1);
    const b = num(w2);
    // One direction per load: upward only when neither end points down.
    const up = a <= 0 && b <= 0 && (reversed(w1) || reversed(w2));
    return { id: id++, ...on(mark), a1: num(a1), a2: num(a2), w1: up ? Math.abs(a) : a, w2: up ? Math.abs(b) : b, dir: up ? 'up' : 'down' };
  });
  // The section is read by the calculator that wrote it: as the last field
  // of a beam of nothing, behind that beam's own check.
  const beam = `${units};0;;;;;;${section}`;
  const read = decodeBeam(`${checkOf(beam)};${beam}`)?.section;
  if (!read || bad) return null;
  // What a link does not carry (the rectangle's sides when it gives
  // properties, the name of a shape when it does not give one) starts from
  // THIS page's example, in the link's own units: "Steel shape" then opens
  // on the shape those properties are, not on the first calculator's.
  const own = (units === 'si' ? convertContinuous(defaultContinuous(), 'si') : defaultContinuous()).section;
  const carried: Partial<Section> =
    read.mode === 'shape' ? { shape: read.shape, selfWeight: read.selfWeight } : read.mode === 'rect' ? { E: read.E, b: read.b, h: read.h } : { E: read.E, I: read.I, S: read.S, Av: read.Av };
  return {
    units,
    spans: spanRows,
    left: kindOf(end[1]),
    right: kindOf(end[2]),
    settlements: moved.length ? moved : spanRows.map(() => 0).concat(0),
    points: pointRows,
    dists: distRows,
    everyArrangement: end[3] === '1',
    section: { ...own, mode: read.mode, material: read.material, ...carried },
    nextId: id,
  };
}
