import type { AnalysisIssue, AnalysisWarning, CableSagAnalysis } from '@/lib/calc/cable-sag/analysis';
import type { FormField } from '@/lib/calc/cable-sag/model';
import type { CableSagUi } from '@/lib/calc/cable-sag/strings';

/**
 * The little text machinery of the cable calculator's sentences. No React, no
 * words of its own (a calculator's words are a prop: lib/calc/cable-sag/strings.ts).
 *
 *   fill              a sentence with holes: `{count}` is the number, and
 *                     `{count|load|loads}` is the first word when it is 1 and the
 *                     second otherwise. One pass over the sentence, so that nothing
 *                     typed into a hole is taken for another hole.
 *   signed            a value as the tables write it: always with its sign, a true
 *                     minus, and a zero with none.
 *   issueSentence     the one sentence of a problem that stops a solution.
 *   warningSentence   the one sentence of a warning that leaves the cable solved.
 *   tableNote         the sentence of a table that cannot be built.
 *   rowSentence       the sentence of a table row that has no solution.
 *   fieldKey          the word the page ties a problem to a field with.
 *
 * Every number reaches a sentence through `ctx.num`, the page's own way to write one
 * (grouped, four figures, never -0 or NaN), and never raw.
 */

export function fill(text: string, vars: Record<string, string | number>): string {
  return text.replace(/\{(\w+)(?:\|([^|}]*)\|([^|}]*))?\}/g, (all, key: string, one?: string, many?: string) => {
    const value = vars[key];
    if (value === undefined) return all;
    if (one !== undefined && many !== undefined) return Number(value) === 1 ? one : many;
    return String(value);
  });
}

/** A value as the tables write it: always with its sign, a true minus, and a zero with none. */
export function signed(text: string, value: number): string {
  return value === 0 || text === '0' ? '0' : `${value > 0 ? '+' : '−'}${text}`;
}

/** What a sentence needs from the page: how it writes a number, its units, and the span the loads are measured along. */
export interface Context {
  num: (value: number, significant?: number) => string;
  /** The length and force units on show. */
  length: string;
  force: string;
  /** The span, in the length unit. */
  span: number;
  /** The temperature and the line-load units on show (the reading under a change of state writes both). */
  temp: string;
  line: string;
}

/** The key by which the page ties a problem to the part of the form it is about; '' when it is about the case as a whole. */
export function fieldKey(field: FormField | undefined): string {
  if (field === undefined) return '';
  return typeof field === 'string' ? field : `point${field.point}`;
}

/** The word for the input a problem is about, in the sentences that name one. */
function fieldWord(issue: AnalysisIssue, w: CableSagUi): string {
  const f = issue.field;
  if (f === undefined) return w.fields.other;
  if (typeof f === 'object') return w.fields.point;
  switch (f) {
    case 'state.q':
      return w.fields.stateQ;
    case 'state.ice':
      return w.fields.stateIce;
    case 'state.T':
      return w.fields.stateT;
    case 'table.thermal':
      return w.fields.tableThermal;
    case 'table.loads':
      return w.fields.tableLoads;
    default:
      return w.fields[f];
  }
}

/** Which table a problem is about. */
const whichOf = (issue: AnalysisIssue, w: CableSagUi): string => (issue.field === 'table.loads' ? w.tables.names.loads : w.tables.names.thermal);

/**
 * The sentence for one problem the analysis reports: its code's line in the words
 * given, with the numbers the code carries put in its holes. Nothing in the sentence
 * is left as a `{hole}`: the ones a code does not carry are written as 0 (never
 * printed for a real code).
 */
export function issueSentence(issue: AnalysisIssue, w: CableSagUi, ctx: Context): string {
  const n = ctx.num;
  const vars: Record<string, string | number> = {
    field: fieldWord(issue, w),
    which: whichOf(issue, w),
    unit: ctx.length,
    force: ctx.force,
    span: n(ctx.span),
    ratio: n(issue.ratio ?? 0),
    // The limits of a ratio are plain numbers (1e-6 is "0.000001"), not the page's four figures.
    min: issue.code === 'sag-range' ? String(issue.min ?? 0) : n(issue.min ?? 0),
    max: String(issue.max ?? 0),
    value: n(issue.value ?? 0),
    chord: n(issue.chord ?? 0),
    length: n(issue.length ?? 0),
    count: issue.count ?? 0,
    a: issue.ats?.[0] ?? 0,
    b: issue.ats?.[1] ?? 0,
  };
  return fill(w.issues[issue.code], vars);
}

/** The sentence for one warning: its code's line with the numbers it carries. */
export function warningSentence(warning: AnalysisWarning, w: CableSagUi, ctx: Context): string {
  const n = ctx.num;
  const vars: Record<string, string | number> = {
    difference: n((warning.difference ?? 0) * 100, 3),
    tolerance: n((warning.tolerance ?? 0) * 100, 3),
    ratio: `${n((warning.ratio ?? 0) * 100, 3)} %`,
    strain: n((warning.strain ?? 0) * 100, 3),
    x: n(warning.x ?? 0),
    value: n(warning.value ?? 0),
    unit: ctx.length,
    force: ctx.force,
    count: warning.count ?? 0,
  };
  // The parabola warning says WHY: the sag is deep, or the cable stretches (a rigid one would agree).
  if (warning.code === 'parabola-differs') vars.why = fill(warning.cause === 'elasticity' ? w.results.compare.whyElastic : w.results.compare.whyDepth, vars);
  return fill(w.warnings[warning.code], vars);
}

/** Which table a note is about, from the problem itself: the loads' table when it says so, the temperatures' otherwise. */
export type TableName = 'thermal' | 'loads';

/** The sentence for a table that cannot be built: the fields of it are not numbers, it asks for too many rows, or its range is empty. */
export function tableNote(note: AnalysisIssue, which: TableName, w: CableSagUi): string {
  const name = w.tables.names[which];
  if (note.code === 'number') return fill(w.tables.number, { which: name });
  if (note.count !== undefined && note.max !== undefined && note.count > note.max) return fill(w.tables.tooMany, { which: name, count: note.count, max: note.max });
  return fill(w.tables.invalid[which], { max: note.max ?? 0 });
}

/** The sentence for a row of a table that has no solution: its code's line, or the general one. */
export function rowSentence(code: string | undefined, w: CableSagUi): string {
  const rows = w.tables.rowCodes as Record<string, string>;
  return (code !== undefined && rows[code]) || rows.other;
}

/** A relative difference written as a percent, signed: "+0.35 %", and "less than 0.001 %" where it is under what the page shows. */
export function percent(ratio: number, w: CableSagUi, group: string, format: (value: number, significant: number, group: string) => string): string {
  const p = ratio * 100;
  if (p === 0 || !Number.isFinite(p)) return `${Number.isFinite(p) ? '0' : '—'} %`;
  if (Math.abs(p) < 0.001) return fill(w.results.compare.less, { value: '0.001' });
  return `${signed(format(Math.abs(p), 3, group), p)} %`;
}

/** The first letter of a name in lower case, for a name that stands in the middle of a sentence ("Load 2" is "load 2"). */
const lowered = (text: string): string => text.charAt(0).toLowerCase() + text.slice(1);

/**
 * THE READING UNDER A DRAWING: one sentence, in plain words, built from the numbers of the solution, that says
 * what the drawing shows to someone who has never seen a cable calculation. It follows what was GIVEN (a sag, the
 * pretension, a tension, the length) and the real direction of each change (a pretension may fall, a sag may
 * shrink). Null where there is no solution: the box of problems speaks then, and nothing is read.
 *
 * `form` is what the sentence takes from the form and the analysis does not carry: the span and the two
 * temperatures, as the form shows them.
 */
export function readingOf(a: CableSagAnalysis, w: CableSagUi, ctx: Context, form: { span: number; T1: number; T2: number }): string | null {
  const r = w.results.reading;
  const n = ctx.num;
  const withUnit = (v: number, unit: string, sig = 4) => `${n(v, sig)} ${unit}`;
  const L = ctx.length;
  const F = ctx.force;

  if (a.hanging) {
    const e = a.hanging.exact;
    const vars = {
      span: withUnit(form.span, L),
      d: withUnit(e.sagMid, L),
      s: withUnit(e.sagLow, L),
      H: withUnit(e.H, F),
      len: withUnit(e.unstretched, L, 5),
      T: withUnit(a.hanging.given === 'T-low' ? e.tension.low : e.tension.high, F),
    };
    const given = a.hanging.given;
    const lengthLead = e.strain === null ? r.hanging.lengthRigid : r.hanging.length;
    // The two supports pull alike to the figures shown (a level span): "the higher support" is then no one in particular.
    const alike = n(e.tension.A) === n(e.tension.B);
    const lead = given === 'sag-mid' ? r.hanging.sagMid : given === 'sag-low' ? r.hanging.sagLow : given === 'H' ? r.hanging.H : given === 'T-high' ? (alike ? r.hanging.TBoth : r.hanging.THigh) : given === 'T-low' ? (alike ? r.hanging.TBoth : r.hanging.TLow) : lengthLead;
    const tail = alike ? fill(r.hanging.tailEqual, { T: withUnit(e.tension.A, F) }) : fill(r.hanging.tailDiff, { Ta: withUnit(e.tension.A, F), Tb: withUnit(e.tension.B, F) });
    return fill(lead, vars) + tail;
  }

  if (a.state) {
    const c = a.state.change;
    const s1 = a.state.state1;
    const s2 = a.state.state2;
    const changed = (p: number, q: number) => n(p) !== n(q);
    const parts: string[] = [];
    if (changed(form.T1, form.T2)) parts.push(fill(r.state.temp, { a: withUnit(form.T1, ctx.temp), b: withUnit(form.T2, ctx.temp) }));
    if (changed(c.loadPerLength.state1, c.loadPerLength.state2)) parts.push(fill(r.state.load, { a: withUnit(c.loadPerLength.state1, ctx.line), b: withUnit(c.loadPerLength.state2, ctx.line) }));
    const cond = parts.length ? parts.join(` ${r.state.and} `) : r.state.none;
    const h = { a: withUnit(s1.H, F), b: withUnit(s2.H, F) };
    const d = { a: withUnit(s1.sagMid, L), b: withUnit(s2.sagMid, L) };
    const hText = fill(!changed(s1.H, s2.H) ? r.state.hSame : s2.H > s1.H ? r.state.hRise : r.state.hFall, h);
    const dText = fill(!changed(s1.sagMid, s2.sagMid) ? r.state.dSame : s2.sagMid > s1.sagMid ? r.state.dGrow : r.state.dShrink, d);
    const gap = Math.abs(c.deltaSagMid);
    return fill(r.state.when, { cond, h: hText, d: dText }) + (changed(s1.sagMid, s2.sagMid) ? ` ${fill(r.state.gap, { g: withUnit(gap, L) })}` : '');
  }

  if (a.points) {
    const p = a.points;
    const nameOf = (i: number) => {
      const j = p.joints[i];
      return lowered(j.kind === 'load' ? fill(w.results.joints.load1, { n: j.label }) : fill(w.results.joints.support, { name: j.kind }));
    };
    const t = w.results.headline;
    const z = p.lowest.z;
    const lowest = z === 0 ? t.levelA : fill(z < 0 ? t.belowA : t.aboveA, { value: withUnit(Math.abs(z), L) });
    const vars = {
      H: withUnit(p.H, F),
      T: withUnit(p.tensionMax.value, F),
      joint: nameOf(p.lowest.joint),
      z: lowest,
      d: p.sagAt ? withUnit(p.sagAt.value, L) : '',
      x: p.sagAt ? withUnit(p.sagAt.x, L) : '',
    };
    // A lowest joint that IS support A is level with support A by definition: that is not said.
    const atA = p.joints[p.lowest.joint]?.kind === 'A';
    const lead = p.given === 'sag' && p.sagAt ? r.points.sag : p.given === 'T-max' ? (atA ? r.points.TAtSupport : r.points.T) : atA ? r.points.HAtSupport : r.points.H;
    const steep = p.segments[p.tensionMax.segment - 1];
    const tail = steep ? fill(r.points.steepest, { a: nameOf(steep.from), b: nameOf(steep.to), T: withUnit(steep.tension, F) }) : '.';
    return fill(lead, vars) + tail;
  }
  return null;
}
