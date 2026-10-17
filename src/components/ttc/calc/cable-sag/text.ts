import type { AnalysisIssue, AnalysisWarning } from '@/lib/calc/cable-sag/analysis';
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
