import { agree } from '../format';
import { bendingStress, deflectionFactor, sectionProps, shearStress, stiffness, type BeamForm, type SectionProps, type SteelShape } from '../beam/model';
import type { BeamReaction, Side, SupportKind } from '../beam/solver';
import { solveCase, solveContinuous, type ContinuousCase } from './engine';
import { envelopeContinuous } from './envelope';
import { formIssues, issueOnRow, jointPositions, oneSection, toBeamForm, toEngine, type ContinuousForm, type ContinuousFormIssue, type ContinuousFormIssueCode, type ContinuousRow } from './model';
import type { ContinuousEnvelope, ContinuousModel, ContinuousSolution, Range } from './types';

/**
 * ─────────────────────────────────────────────────────────────────────────────
 * CONTINUOUS BEAM — from the form to everything the page prints
 * ─────────────────────────────────────────────────────────────────────────────
 * This calculator's `analyse` (beam/model.ts has the first one's): the form
 * as it stands (model.ts) and the steel shape in use go in; out come the
 * section, the faults by row, and — when the beam can be solved — every
 * number of the cards and every point of the diagrams, ALREADY SETTLED: a
 * value that is rounding is zero here, once, so that the table, the drawing
 * and the words for a screen reader cannot say different things. The
 * component (ContinuousCalculator.tsx) lays it out and decides nothing.
 *
 * ONE CASE OR EVERY ARRANGEMENT. With the live load on every span the beam
 * is solved once (engine.ts). Taken in every arrangement — and when a span
 * does carry a live load: with none there is one arrangement, and it is that
 * one case — it is envelope.ts, and every result is a pair: the highest and
 * the lowest over all the arrangements, each with the spans whose live load
 * is on in the one that gives it (`on`). In a single case the two of a pair
 * are one value and `on` is null: there is nothing to name.
 *
 * WHAT COUNTS AS ZERO (`floors`). Measured against the size of the problem,
 * never of each diagram — beam/BeamCalculator.tsx, `noise`, says why. The
 * size is the engine's own `loadScale`: the loads added up and, for a span
 * whose two supports settle apart, the force that takes. So a beam with
 * settlements and no load at all still has a size, and its reactions are
 * results; and supports that all go down together, which bends nothing, have
 * none — every shear and moment of that beam is an exact zero in the engine,
 * and its deflection is the settlement itself.
 *
 * The first calculator has a second floor for shears and reactions, a
 * millionth of the LARGEST REACTION: its unknowns are the reactions, and the
 * rounding of two close supports is that large. Not here. This engine's
 * unknowns are rotations; with a span at its shortest (a thousandth of the
 * beam) its reactions are 3,600 times the loads and still right to 8e-13 of
 * the loads (engine.ts, SHORT; 2e-12 with stiffness factors a million times
 * apart besides, on supports that settle) — and a millionth of such a
 * reaction would print a real shear of a third of a percent of the loads as
 * 0. One floor, a billionth of the size of the problem: × L for a moment,
 * × L² for a slope, × L³ for a deflection.
 *
 * WHAT A FLOOR DOES NOT DO. It says which values are rounding; it does not
 * make a value just above it good to the four figures printed. Measured
 * (engine.ts, the header): a shear or a reaction is within 2e-12 of the size
 * of the problem at the engine's limits, so one that is itself under a
 * ten-millionth of the loads may be out in its fourth figure; and a
 * deflection is within 3e-14 of that size × L³ over the SMALLEST stiffness
 * factor, so beside a span a thousand times more flexible than the section
 * a deflection read where the beam crosses its own line may be too. What a
 * span is asked for — its largest moment, its largest deflection — is right
 * to its own figures whatever the spans beside it (within 5e-13 of the
 * largest value in that span).
 *
 * STRESSES ARE THE SECTION'S. M ÷ S and V ÷ Av are given only where every
 * span has a stiffness factor of 1: a span with another is another section,
 * of which nothing but the stiffness is known (`sameSection`).
 *
 * UNITS as in model.ts: positions in ft or m along the whole beam, forces in
 * kip or kN, moments in kip·ft or kN·m; a deflection in in or mm, a slope in
 * radians, a stress in ksi or MPa. Signs as in types.ts: reactions and
 * deflections positive upward, moments positive sagging.
 */

/** What is wrong, by row. 'size': a number that is one, of a size the engine does not take (under 1e-60 or over 1e60), or whose results are past the largest number there is. */
export type AnalysisIssueCode = ContinuousFormIssueCode | 'size';
export interface AnalysisIssue {
  code: AnalysisIssueCode;
  /** The row at fault, when it is one row. */
  row?: ContinuousRow;
}

/** A value of the cards, settled. */
export interface Value {
  value: number;
  /** Where along the beam; null for a value that is rounding — zero, at no place. */
  x: number | null;
  /** Over every arrangement: the spans (from 0, ascending) whose live load is on in the one that gives this value. Null in a single case. */
  on: number[] | null;
}

/** The highest and the lowest of a result over every arrangement. `one`: they are the same number — always, in a single case — and no arrangement is to be named. */
export interface Both {
  max: Value;
  min: Value;
  one: boolean;
}

export interface SupportRow {
  /** Its joint (from 0), and its number among the supports (from 1): a free end is a joint, and no support. */
  joint: number;
  number: number;
  x: number;
  kind: SupportKind;
  /** Its reaction, upward. */
  Rv: Both;
  /** The bending moment in the beam over it, sagging positive: at a fixed end, the moment the wall holds. */
  M: Both;
}

export interface SpanRow {
  /** Its place among the spans, from 0. */
  index: number;
  from: number;
  to: number;
  kind: 'span' | 'cantilever';
  /** Its largest sagging moment — over every arrangement, the largest of them all. A value of zero: it sags nowhere. */
  sagging: Value;
  /**
   * Its largest deflection either way MEASURED FROM ITS OWN SUPPORTS
   * (types.ts, `EIvChord`), in the unit shown, positive upward; null without
   * E and I.
   */
  deflection: Value | null;
  /** Its length — twice it, for an overhang — over that deflection; null where there is no deflection to divide by. */
  ratio: number | null;
}

export interface Largest {
  /** The shear furthest from zero, and the moment: what the two stresses are of. */
  shear: Value;
  moment: Value;
  /** The largest sagging moment (above zero) and hogging moment (below it); a value of zero: none. */
  sagging: Value;
  hogging: Value;
  /** The point of the deflected shape furthest from the line of the beam, in the unit shown; null without E and I. */
  deflection: Value | null;
  /** The highest and the lowest of each diagram, for its labels and its summary; the deflection's in the unit shown. */
  peaks: { V: [Value, Value]; M: [Value, Value]; D: [Value, Value] | null };
  /** M ÷ S and the shear rule, of the two largest above (ksi, MPa); null without the value of the section it takes, or where a span is not that section. */
  sigma: number | null;
  tau: number | null;
}

/** A point of a diagram. */
export type Dot = { x: number; y: number };
/** One diagram: its line — or, over every arrangement, the upper edge of its band and `lower`, the other edge — and the values labelled on it. */
export interface Diagram {
  upper: Dot[];
  lower: Dot[] | null;
  marks: Dot[];
}

/** The response at a point: each a range over every arrangement, of one value in a single case. */
export interface PointValues {
  x: number;
  /** The shear and the moment just left of the point and just right of it: at a load or a support the shear is two values, and at a fixed end the moment is the wall's on one side and nothing on the other. */
  V: { left: Range; right: Range };
  M: { left: Range; right: Range };
  /** In the unit shown, positive upward; null without E and I. */
  deflection: Range | null;
  /** In radians, positive counter-clockwise; null without E and I. */
  slope: Range | null;
  /** M ÷ S there, of the side whose moment is the larger; null as `Largest.sigma`. */
  sigma: Range | null;
}

export interface Floors {
  F: number;
  V: number;
  M: number;
  EItheta: number;
  EIv: number;
}

export interface ContinuousResults {
  /** The live load was taken in every arrangement: each result is a pair. */
  ranged: boolean;
  /** The beam's length, and every position where something happens on it. */
  L: number;
  breaks: number[];
  /** The size of the problem, as a force (types.ts), and what is rounding beside it. */
  loadScale: number;
  floors: Floors;
  /**
   * In a single case: the reactions added up and the load, and whether they
   * are one number (format.ts, `agree`) — the page says they are only after
   * asking. Null over every arrangement, where there is no one sum.
   */
  balance: { reactions: number; load: number; ok: boolean } | null;
  /** In a single case: the reactions, for the drawing. Null over every arrangement: each is a range, and an arrow has one length. */
  reactions: BeamReaction[] | null;
  supports: SupportRow[];
  spans: SpanRow[];
  largest: Largest;
  /** Shear, moment and — with E and I — deflection in the unit shown. */
  diagrams: { V: Diagram; M: Diagram; D: Diagram | null };
  /** The values at a position along the beam (kept on it: between 0 and L). */
  at(x: number): PointValues;
}

export interface ContinuousAnalysis {
  section: SectionProps;
  /** E·I in the engine's units; zero when E or I is missing. */
  EI: number;
  /** Multiply the engine's EI·v by this for the deflection shown, and its EI·θ by `toSlope` for radians; zero when EI is. */
  toDeflection: number;
  toSlope: number;
  /** Every span has a stiffness factor of 1: the stresses are the section's. */
  sameSection: boolean;
  /** The spans (from 0) that carry a live load that is one: 2 to the power of their number is how many arrangements there are. */
  liveSpans: number[];
  issues: AnalysisIssue[];
  /** Null while the beam cannot be solved. */
  results: ContinuousResults | null;
}

/** A value that is rounding, not a result, is zero. (Plus zero: never −0.) */
const settle = (value: number, floor: number) => (Math.abs(value) <= floor ? 0 : value + 0);
/** A result and where it is — or zero, nowhere. */
const valueOf = (found: { value: number; x: number; spans?: number[] }, floor: number): Value =>
  Math.abs(found.value) <= floor ? { value: 0, x: null, on: found.spans ? [] : null } : { value: found.value, x: found.x, on: found.spans ?? null };
/** Of two, the one further from zero — the first when they are as far. */
const larger = (p: Value, q: Value) => (Math.abs(p.value) >= Math.abs(q.value) ? p : q);
const NONE = (ranged: boolean): Value => ({ value: 0, x: null, on: ranged ? [] : null });
const times = (v: Value, k: number): Value => ({ ...v, value: v.value * k });

/**
 * The spans that carry a live load that is one, ascending: a point load with
 * a size, a distributed load with an intensity and a length. (The engine
 * takes a load of no size, or of no length, for no load.)
 */
function liveSpansOf(model: ContinuousModel): number[] {
  const on = [...(model.points ?? []).filter((p) => p.live && p.P !== 0).map((p) => p.span), ...(model.dists ?? []).filter((d) => d.live && (d.w1 !== 0 || d.w2 !== 0) && d.a1 !== d.a2).map((d) => d.span)];
  return [...new Set(on)].sort((p, q) => p - q);
}

/**
 * An issue as the page words it. The engine says 'length' of a span whose
 * length is not a positive number AND of one that is, of a size it does not
 * take; 'number' of a value that is not a number AND of one past what it
 * takes. A page that answered 1e61 ft with "must be a positive number" would
 * be saying something false: the second of each is 'size'.
 *
 * And one issue is not said at all (`null`): a span's uniform load runs to
 * the end of its span, so a length that is not a number makes the engine
 * name the load as well. The load is as it was entered; the fault is the
 * length's, and is said there.
 */
function worded(issue: ContinuousFormIssue, form: ContinuousForm): AnalysisIssue | null {
  const row = issue.row;
  if (issue.code === 'length') {
    // With no span named, it is the results that passed the largest number there is.
    if (!row || row.list !== 'spans') return { code: 'size' };
    const span = form.spans.find((s) => s.id === row.id);
    return span && span.L > 0 && Number.isFinite(span.L) ? { code: 'size', row } : issue;
  }
  if (issue.code !== 'number' || !row) return issue;
  if (row.list === 'spans') {
    const span = form.spans.find((s) => s.id === row.id);
    const load = span ? (row.field === 'live' ? span.live : span.dead) : Number.NaN;
    if (!Number.isFinite(load)) return issue;
    return span && Number.isFinite(span.L) ? { code: 'size', row } : null;
  }
  const held: number[] = (() => {
    if (row.list === 'settlements') return [form.settlements[row.joint] ?? 0];
    if (row.list === 'points') return form.points.filter((p) => p.id === row.id).flatMap((p) => [p.a, p.P]);
    return form.dists.filter((d) => d.id === row.id).flatMap((d) => [d.a1, d.a2, d.w1, d.w2]);
  })();
  return held.every(Number.isFinite) ? { code: 'size', row } : issue;
}

/** The beam as the drawing takes it (beam/BeamSchematic.tsx), and what the page writes by its loads. */
export interface ContinuousDrawing {
  beam: BeamForm;
  /** The uniform loads drawn as one block, by that block's id: the dead and the live load it is, as entered. */
  uniform: { id: number; dead: number; live: number }[];
  /** The ids of the loads drawn apart that are live. */
  live: { points: number[]; dists: number[] };
}

/**
 * The beam for the drawing: `toBeamForm`'s (model.ts), with the uniform
 * loads of the spans drawn as an engineer sketches them — ONE block for the
 * dead and the live load of a span together, as tall as their sum, and one
 * block for all the spans in a row that carry the same two. Each as its own
 * block, two to a span, was sixteen values over an eight-span beam, one
 * written through the arrows of the other. The page writes both numbers by
 * the block, as they were typed: never their sum, which nobody entered.
 *
 * A span whose two loads point opposite ways (one of them entered with a
 * minus) keeps them apart, as `toBeamForm` has them: their sum would be a
 * block of another height, or none at all.
 *
 * A block takes the id of its first span's dead load, −(2i + 1).
 */
export function drawingOf(form: ContinuousForm): ContinuousDrawing {
  const beam = toBeamForm(form);
  const at = jointPositions(form);
  const uniform: ContinuousDrawing['uniform'] = [];
  const blocks: BeamForm['dists'] = [];
  const live = { points: form.points.filter((p) => p.live).map((p) => p.id), dists: form.dists.filter((d) => d.live).map((d) => d.id) };
  let last: { dead: number; live: number } | null = null;
  form.spans.forEach((s, i) => {
    const together = Number.isFinite(s.dead) && Number.isFinite(s.live) && s.dead * s.live >= 0 && (s.dead !== 0 || s.live !== 0);
    if (!together) {
      last = null;
      blocks.push(...beam.dists.filter((d) => d.id === -(2 * i + 1) || d.id === -(2 * i + 2)));
      if (s.live !== 0) live.dists.push(-(2 * i + 2));
      return;
    }
    const sum = s.dead + s.live;
    if (last && last.dead === s.dead && last.live === s.live) blocks[blocks.length - 1] = { ...blocks[blocks.length - 1], x2: at[i + 1] };
    else {
      blocks.push({ id: -(2 * i + 1), x1: at[i], x2: at[i + 1], w1: sum, w2: sum, dir: 'down' });
      uniform.push({ id: -(2 * i + 1), dead: s.dead, live: s.live });
    }
    last = { dead: s.dead, live: s.live };
  });
  // The spans' own loads first, then the form's rows: the order `toBeamForm` gives them in.
  return { beam: { ...beam, dists: [...blocks, ...beam.dists.filter((d) => d.id > 0)] }, uniform, live };
}

export function analyseContinuous(form: ContinuousForm, shape?: SteelShape | null): ContinuousAnalysis {
  const section = sectionProps(form, shape);
  const EI = stiffness(form.units, section);
  const toDeflection = deflectionFactor(form.units, EI);
  const toSlope = EI > 0 ? 1 / EI : 0;
  const sameSection = oneSection(form);
  const input = toEngine(form, section, EI);
  const liveSpans = liveSpansOf(input.model);
  const ranged = form.everyArrangement && liveSpans.length > 0;

  // A settlement with no E or I cannot be made a force of: the beam is not
  // solved (model.ts, `formIssues`). What else is wrong with it is still
  // said, all at once: the engine is asked about the beam with those
  // supports where they were, and only its issues are read.
  const own = formIssues(form, EI);
  const unsettled = new Set(own.flatMap((i) => (i.code === 'settlement' && i.row?.list === 'settlements' ? [i.row.joint] : [])));
  const model: ContinuousModel = unsettled.size ? { ...input.model, settlements: (input.model.settlements ?? []).map((s, j) => (unsettled.has(j) ? 0 : s)) } : input.model;
  const outcome = ranged ? envelopeContinuous(model) : solveContinuous(model);
  const issues = [...own, ...(outcome.ok ? [] : outcome.issues.map((i) => issueOnRow(i, input.rows)))].flatMap((i) => worded(i, form) ?? []);
  const common = { section, EI, toDeflection, toSlope, sameSection, liveSpans, issues };
  if (!outcome.ok || unsettled.size) return { ...common, results: null };

  const env: ContinuousEnvelope | null = 'all' in outcome ? outcome : null;
  const sol: ContinuousSolution = 'all' in outcome ? outcome.all : outcome;
  const L = sol.L;
  const F = 1e-9 * sol.loadScale;
  const floors: Floors = { F, V: F, M: F * L, EItheta: F * L * L, EIv: F * L * L * L };

  /* ── Support by support ─────────────────────────────────────────────── */
  const pair = (max: Value, min: Value, floor: number): Both => ({ max, min, one: Math.abs(max.value - min.value) <= floor });
  /** A support's own value, at the support: it has a place even when it is zero. */
  const here = (found: { value: number; spans?: number[] }, x: number, floor: number): Value => ({ value: settle(found.value, floor), x, on: found.spans ?? null });
  const supports: SupportRow[] = [];
  sol.joints.forEach((joint, j) => {
    if (!joint.support) return;
    const number = supports.length + 1;
    const reaction = sol.reactions[number - 1];
    const of = env?.joints[j];
    const Rv = of ? pair(here(of.Rv.max, joint.x, floors.F), here(of.Rv.min, joint.x, floors.F), floors.F) : pair(here({ value: reaction.Rv }, joint.x, floors.F), here({ value: reaction.Rv }, joint.x, floors.F), floors.F);
    const M = of ? pair(here(of.M.max, joint.x, floors.M), here(of.M.min, joint.x, floors.M), floors.M) : pair(here({ value: joint.M }, joint.x, floors.M), here({ value: joint.M }, joint.x, floors.M), floors.M);
    supports.push({ joint: j, number, x: joint.x, kind: joint.support, Rv, M });
  });

  /* ── Span by span ───────────────────────────────────────────────────── */
  // A limit is written as a fraction of the span; for an overhang, of twice
  // its length — as beam/model.ts takes it, for the reason given there.
  const lengthToShown = form.units === 'us' ? 12 : 1000;
  const spans: SpanRow[] = (env ?? sol).spans.map((span) => {
    const top = valueOf(span.Mmax, floors.M);
    const chord = valueOf(span.EIvChord, floors.EIv);
    const reference = (span.kind === 'cantilever' ? 2 : 1) * (span.to - span.from) * lengthToShown;
    return {
      index: span.index,
      from: span.from,
      to: span.to,
      kind: span.kind,
      sagging: top.value > 0 ? top : NONE(ranged),
      deflection: toDeflection ? times(chord, toDeflection) : null,
      ratio: toDeflection && chord.x !== null ? reference / Math.abs(chord.value * toDeflection) : null,
    };
  });

  /* ── The largest values ─────────────────────────────────────────────── */
  const ex = (env ?? sol).extremes;
  const V: [Value, Value] = [valueOf(ex.Vmax, floors.V), valueOf(ex.Vmin, floors.V)];
  const M: [Value, Value] = [valueOf(ex.Mmax, floors.M), valueOf(ex.Mmin, floors.M)];
  const D: [Value, Value] | null = toDeflection ? [times(valueOf(ex.EIvMax, floors.EIv), toDeflection), times(valueOf(ex.EIvMin, floors.EIv), toDeflection)] : null;
  const shear = larger(V[0], V[1]);
  const moment = larger(M[0], M[1]);
  const largest: Largest = {
    shear,
    moment,
    sagging: M[0].value > 0 ? M[0] : NONE(ranged),
    hogging: M[1].value < 0 ? M[1] : NONE(ranged),
    deflection: D ? larger(D[0], D[1]) : null,
    peaks: { V, M, D },
    sigma: sameSection ? bendingStress(form.units, section, Math.abs(moment.value)) : null,
    tau: sameSection ? shearStress(form.units, section, Math.abs(shear.value)) : null,
  };

  /* ── What the diagrams draw ─────────────────────────────────────────── */
  // Every station the engine returns — both sides of each jump — and, over
  // every arrangement, each corner of the two edges. A value that is
  // rounding is drawn as the zero it is.
  const labelled = (floor: number, ...peaks: Value[]): Dot[] =>
    peaks
      .flatMap((p) => (p.x === null || Math.abs(p.value) <= floor ? [] : [{ x: p.x, y: p.value }]))
      .filter((p, i, all) => all.findIndex((q) => Math.abs(q.y - p.y) <= floor && Math.abs(q.x - p.x) < 1e-9 * L) === i);
  /** One value as the range it is in a single case. */
  const only = (v: number): Range => ({ max: v, min: v });
  const stations: { x: number; V: Range; M: Range; EIv: Range }[] = env ? env.stations : sol.stations.map((s) => ({ x: s.x, V: only(s.V), M: only(s.M), EIv: only(s.EIv) }));
  const drawn = (of: (s: { V: Range; M: Range; EIv: Range }) => Range, floor: number, k: number, peaks: [Value, Value]): Diagram => ({
    upper: stations.map((s) => ({ x: s.x, y: settle(of(s).max, floor) * k })),
    lower: env ? stations.map((s) => ({ x: s.x, y: settle(of(s).min, floor) * k })) : null,
    marks: labelled(floor * k, ...peaks),
  });
  const diagrams = {
    V: drawn((s) => s.V, floors.V, 1, V),
    M: drawn((s) => s.M, floors.M, 1, M),
    D: D ? drawn((s) => s.EIv, floors.EIv, toDeflection, D) : null,
  };

  /* ── The values at a point ──────────────────────────────────────────── */
  // The envelope follows the shear, the moment and the deflection, not the
  // slope. Its range is made here the same way (envelope.ts says why it is
  // exact): what is always there, plus each span's live load alone where it
  // turns the beam one way, and where it turns it the other. Those cases are
  // solved the first time a slope is asked for, and kept.
  let cases: ContinuousCase[] | null = null;
  const slopeCases = (): ContinuousCase[] => {
    if (cases) return cases;
    const points = model.points ?? [];
    const dists = model.dists ?? [];
    const geometry = { spans: model.spans, left: model.left, right: model.right };
    const solved = [
      solveCase({ ...geometry, settlements: model.settlements, points: points.filter((p) => !p.live), dists: dists.filter((d) => !d.live) }),
      ...liveSpans.map((span) => solveCase({ ...geometry, points: points.filter((p) => p.live && p.span === span), dists: dists.filter((d) => d.live && d.span === span) })),
    ];
    // The whole beam was solved, so its parts are: the same spans, some of the same loads.
    cases = solved.flatMap((c) => (c.ok ? [c] : []));
    return cases;
  };
  // What is rounding in the slope one live load causes is measured WHERE THE
  // EFFECT IS, as the envelope measures it (envelope.ts, "what counts as an
  // effect"): against the largest slope that load causes in the span the
  // point is in — read off the case's own stations, once. Against the
  // largest slope it causes anywhere, a span a million times stiffer than
  // the loaded one lost what the load does turn it by.
  const turned = new Map<ContinuousCase, number[]>();
  const turnIn = (c: ContinuousCase, span: number): number => {
    let reach = turned.get(c);
    if (!reach) {
      reach = c.spans.map((sp) => c.stations.reduce((most, s) => (s.x >= sp.from && s.x <= sp.to ? Math.max(most, Math.abs(s.EItheta)) : most), 0));
      turned.set(c, reach);
    }
    return reach[span] ?? 0;
  };
  const slopeAt = (x: number, side: Side): Range => {
    if (!env) return only(sol.at(x, side).EItheta);
    const [base, ...lives] = slopeCases();
    const range = { max: base.at(x, side).EItheta, min: base.at(x, side).EItheta };
    for (const c of lives) {
      // Under a million-millionth of that, an effect is the zero it is: neither added to the highest slope nor to the lowest.
      const effect = settle(c.at(x, side).EItheta, 1e-12 * turnIn(c, c.spanOf(x, side)));
      if (effect > 0) range.max += effect;
      else range.min += effect;
    }
    return range;
  };
  const settled = (r: Range, floor: number, k = 1): Range => ({ max: settle(r.max, floor) * k, min: settle(r.min, floor) * k });
  const at = (asked: number): PointValues => {
    const x = Math.min(L, Math.max(0, asked));
    const read = (side: Side): { V: Range; M: Range; EIv: Range } => {
      if (env) return env.at(x, side);
      const s = sol.at(x, side);
      return { V: only(s.V), M: only(s.M), EIv: only(s.EIv) };
    };
    const left = read('left');
    const right = read('right');
    const moments = { left: settled(left.M, floors.M), right: settled(right.M, floors.M) };
    // The stress is of the side that has the moment: at a fixed end the other side is past the beam.
    const reach = (r: Range) => Math.max(Math.abs(r.max), Math.abs(r.min));
    const bent = reach(moments.left) > reach(moments.right) ? moments.left : moments.right;
    const least = bent.min <= 0 && bent.max >= 0 ? 0 : Math.min(Math.abs(bent.max), Math.abs(bent.min));
    const stress = (m: number) => (sameSection ? bendingStress(form.units, section, m) : null);
    const [low, high] = [stress(least), stress(reach(bent))];
    return {
      x,
      V: { left: settled(left.V, floors.V), right: settled(right.V, floors.V) },
      M: moments,
      deflection: toDeflection ? settled(right.EIv, floors.EIv, toDeflection) : null,
      slope: toSlope ? settled(slopeAt(x, 'right'), floors.EItheta, toSlope) : null,
      sigma: low !== null && high !== null ? { max: high, min: low } : null,
    };
  };

  /* ── Do the reactions carry the load? ───────────────────────────────── */
  const sum = sol.reactions.reduce((total, r) => total + r.Rv, 0);
  const balance = env ? null : { reactions: sum, load: settle(sol.totalLoad, floors.F), ok: agree(sum, sol.totalLoad, Math.max(sol.loadScale, ...sol.reactions.map((r) => Math.abs(r.Rv)))) };

  return {
    ...common,
    results: {
      ranged,
      L,
      breaks: sol.breaks,
      loadScale: sol.loadScale,
      floors,
      balance,
      reactions: env ? null : sol.reactions.map((r) => ({ ...r, Rv: settle(r.Rv, floors.F), Rm: settle(r.Rm, floors.M) })),
      supports,
      spans,
      largest,
      diagrams,
      at,
    },
  };
}
