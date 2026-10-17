import type { AnalysisIssue, AnalysisWarning, FrameAnalysis, MemberLine } from '@/lib/calc/frame/analysis';
import { encodeFrame, leavesBehind, type FrameForm, type FrameList, type FrameNotice } from '@/lib/calc/frame/model';
import type { Clamp, TemplateParams } from '@/lib/calc/frame/templates';
import type { FrameUi } from '@/lib/calc/frame/strings';
import type { DiagramMode } from './layout';

/**
 * The little text machinery of the frame calculator's sentences. No React, no
 * words of its own (a calculator's words are a prop: lib/calc/frame/strings.ts).
 *
 *   fill      a sentence with holes: `{count}` is the number, and
 *             `{count|member|members}` is the first word when it is 1 and the
 *             second otherwise. One pass over the sentence, so that nothing
 *             typed into a hole is taken for another hole.
 *   listOf    numbers as a reader writes them: 1–4, 6 and 9–11.
 *   nodesOf   the same with the word for them in front.
 *   signed    a value with its sign and a TRUE minus; a zero with none.
 *
 * Then every SENTENCE the tool builds out of the analysis (a problem, a
 * warning, a notice, the line under the drawing, a pointer's readout), as
 * functions that can be run without a browser - and the small rules of the
 * form (which form is solved, how a row gets the focus, what is left behind
 * in the history).
 */

export function fill(text: string, vars: Record<string, string | number>): string {
  return text.replace(/\{(\w+)(?:\|([^|}]*)\|([^|}]*))?\}/g, (all, key: string, one?: string, many?: string) => {
    const value = vars[key];
    if (value === undefined) return all;
    if (one !== undefined && many !== undefined) return Number(value) === 1 ? one : many;
    return String(value);
  });
}

/** The numbers, ascending and once each, runs of three or more as ranges, the last joined by `and`. */
export function listOf(numbers: readonly number[], and: string): string {
  const sorted = [...new Set(numbers)].sort((a, b) => a - b);
  const parts: string[] = [];
  for (let i = 0; i < sorted.length; ) {
    let j = i;
    while (j + 1 < sorted.length && sorted[j + 1] === sorted[j] + 1) j++;
    if (j - i >= 2) parts.push(`${sorted[i]}–${sorted[j]}`);
    else for (let k = i; k <= j; k++) parts.push(String(sorted[k]));
    i = j + 1;
  }
  if (parts.length <= 1) return parts.join('');
  return `${parts.slice(0, -1).join(', ')} ${and} ${parts[parts.length - 1]}`;
}

/** "node 3" or "nodes 3 and 4": the word that goes with how many there are. */
export function nodesOf(numbers: readonly number[], words: { and: string; theNode: string; theNodes: string }): string {
  const count = new Set(numbers).size;
  return `${count === 1 ? words.theNode : words.theNodes} ${listOf(numbers, words.and)}`;
}

/** A value as the tables write it: always with its sign, a true minus, and a zero with none. */
export function signed(text: string, value: number): string {
  return value === 0 || text === '0' ? '0' : `${value > 0 ? '+' : '−'}${text}`;
}

/** How the page writes a number (the group mark is the page's). */
export interface Fmt {
  /** A size or a coordinate, with a true minus. */
  num: (v: number, significant?: number) => string;
  /** A value with its sign always shown (+ or a true minus; none for zero). */
  val: (v: number, significant?: number) => string;
}

/* ── Problems and warnings ────────────────────────────────────────────── */

/**
 * The sentence for one problem the analysis reports: its code's line in the words given, with the numbers the code carries put
 * in its holes. Nothing in the sentence is left as a `{hole}`.
 */
export function issueSentence(issue: AnalysisIssue, w: FrameUi, how: { number?: (v: number) => string; unit?: string } = {}): string {
  const vars: Record<string, string | number> = {};
  const say = how.number ?? ((v: number) => String(v));
  vars.unit = how.unit ?? '';
  vars.distance = issue.distance !== undefined ? say(issue.distance) : '0';
  vars.size = issue.size !== undefined ? say(issue.size) : '0';
  vars.length = issue.length !== undefined ? say(issue.length) : '0';
  vars.count = issue.count ?? 0;
  vars.max = issue.max ?? 0;
  vars.list = issue.list ? w.lists[issue.list] : '';
  const field = issue.row?.field;
  vars.field = (field && (w.fields as Record<string, string>)[field]) || w.fields.x;
  const pair = issue.nodes ?? issue.members ?? [];
  vars.a = pair[0] ?? 0;
  vars.b = pair[1] ?? 0;
  if (issue.code === 'disconnected') vars.groups = (issue.groups ?? []).map((g) => `${w.words.nodes} ${listOf(g, w.words.and)}`).join('; ');
  if (issue.code === 'duplicate-nodes') vars.list = listOf(issue.nodes ?? [], w.words.and);
  if (issue.code === 'mechanism') {
    const kind = issue.kind ?? 'sway';
    vars.nodes = nodesOf(issue.nodes ?? [], w.words);
    vars.move = fill(w.mechanism[kind].move, { n: (issue.nodes ?? []).length });
    vars.fix = w.mechanism[kind].fix;
    vars.more = (issue.count ?? 1) > 1 ? fill(w.mechanism.more, { count: issue.count ?? 0 }) : '';
  }
  return fill(w.issues[issue.code], vars).trim();
}

/** The sentence for one warning the analysis reports (the frame is solved all the same). */
export function warningSentence(warning: AnalysisWarning, w: FrameUi, how: { and?: string } = {}): string {
  const vars: Record<string, string | number> = {};
  const and = how.and ?? w.words.and;
  vars.count = (warning.members ?? []).length;
  vars.list = listOf(warning.members ?? [], and);
  vars.nodes = nodesOf(warning.nodes ?? [], w.words);
  return fill(w.warnings[warning.code], vars).trim();
}

/* ── What the form tells whoever just did something ───────────────────── */

export interface NoticeText {
  where: FrameList | 'template';
  text: string;
}

/** The unit a template parameter is measured in, from the units shown (none for a count). */
function paramUnit(param: keyof TemplateParams, u: { length: string; force: string; line: string }): string {
  if (param === 'width' || param === 'height' || param === 'rise') return u.length;
  if (param === 'gravity') return u.line;
  if (param === 'lateral' || param === 'axial') return u.force;
  return '';
}

/** One sentence for each thing a template had to change in what it was asked for. */
export function clampSentence(c: Clamp, w: FrameUi, how: { num: (v: number, sig?: number) => string; units: { length: string; force: string; line: string } }): string {
  const text = (v: number | string | boolean): string => (typeof v === 'number' ? how.num(v, 6) : typeof v === 'string' ? ((w.template.bases as Record<string, string>)[v] ?? v) : String(v));
  const key = c.why === 'min' || c.why === 'max' ? 'range' : c.why;
  const word = c.param === 'base' ? (w.template.bases as Record<string, string>) : null;
  const asked = word && typeof c.requested === 'string' ? (word[c.requested] ?? c.requested) : text(c.requested);
  const used = word && typeof c.used === 'string' ? (word[c.used] ?? c.used) : text(c.used);
  return fill(w.template.clamped[key], {
    param: w.template.params[c.param],
    asked,
    used,
    unit: paramUnit(c.param, how.units),
    range: (w.template.ranges as Record<string, string>)[c.param] ?? '',
  })
    .replace(/\s+/g, ' ')
    .trim();
}

/** The line the last edit has to tell: the node or member that went, the add that had nothing to add, the list that is full, a template that had to change a number. */
export function noticeText(n: FrameNotice | null, w: FrameUi, how: { num: (v: number, sig?: number) => string; units: { length: string; force: string; line: string } }): NoticeText | null {
  if (!n) return null;
  switch (n.code) {
    case 'node-removed':
      return {
        where: 'nodes',
        text: [
          fill(w.removed.node, { node: n.node }),
          n.members.length ? fill(w.removed.members, { count: n.members.length, list: listOf(n.members, w.words.and) }) : '',
          n.supports ? fill(w.removed.supports, { count: n.supports }) : '',
          n.loads ? fill(w.removed.loads, { count: n.loads }) : '',
          n.memberLoads ? fill(w.removed.memberLoads, { count: n.memberLoads }) : '',
          n.renumbered ? w.removed.renumbered : '',
          n.membersRenumbered ? w.removed.membersRenumbered : '',
        ]
          .filter(Boolean)
          .join(' '),
      };
    case 'member-removed':
      return {
        where: 'members',
        text: [fill(w.removed.member, { member: n.member }), n.memberLoads ? fill(w.removed.memberOwnLoads, { count: n.memberLoads }) : '', n.renumbered ? w.removed.memberRenumbered : ''].filter(Boolean).join(' '),
      };
    case 'nothing-to-add':
      return { where: n.list, text: w.cannotAdd[n.why] };
    case 'limit':
      return { where: n.list, text: fill(w.limit, { max: n.max, list: w.lists[n.list] }) };
    case 'template':
      return { where: 'template', text: n.clamped.map((c) => clampSentence(c, w, how)).join(' ') };
  }
}

/* ── Where on a member ────────────────────────────────────────────────── */

/** "at node 3" at an end, "4.2 ft from node 1" between: a place along a member, from its own numbers. */
export function whereText(line: Pick<MemberLine, 'i' | 'j' | 'length'>, x: number, w: FrameUi, how: { num: (v: number, sig?: number) => string; length: string }): string {
  const near = 1e-9 * line.length;
  if (x <= near) return fill(w.results.headline.node, { node: line.i });
  if (x >= line.length - near) return fill(w.results.headline.node, { node: line.j });
  return fill(w.results.headline.along, { x: how.num(x), unit: how.length, node: line.i });
}

/** The extreme of larger size of a pair (the maximum when they are as far from zero), or null when both are absent or zero. */
export function largerExtreme<T extends { value: number }>(a: T | null, b: T | null): T | null {
  const pick = !a ? b : !b ? a : Math.abs(a.value) >= Math.abs(b.value) ? a : b;
  return pick && pick.value !== 0 ? pick : null;
}

/** The largest node displacement (the first when two are as large), or null when nothing moves or there are no displacements. */
export function largestNode(a: FrameAnalysis): { node: number; magnitude: number } | null {
  const d = a.results?.displacements;
  if (!d || d.length === 0) return null;
  let best = d[0];
  for (const x of d) if (x.magnitude > best.magnitude) best = x;
  return best.magnitude > 0 ? { node: best.node, magnitude: best.magnitude } : null;
}

/** The nodes ringed on the drawing: those a problem is about. */
export function flaggedNodes(a: FrameAnalysis): number[] {
  const ring = new Set<number>();
  for (const i of a.issues) if (i.code === 'mechanism' || i.code === 'node-unconnected' || i.code === 'duplicate-node' || i.code === 'duplicate-nodes' || i.code === 'scale' || i.code === 'duplicate-support' || i.code === 'hinged-joint-moment') for (const n of i.nodes ?? []) ring.add(n);
  return [...ring].sort((p, q) => p - q);
}

/**
 * THE ONE SENTENCE UNDER THE DRAWING: what to read in it, built from the numbers of the case on screen and true in every case -
 * a diagram that is empty says so, a frame that cannot be solved says what is wrong and which nodes are ringed, a frame without
 * sections has no deformed shape and says that.
 */
export function readingSentence(a: FrameAnalysis, mode: DiagramMode, w: FrameUi, how: Fmt & { length: string; factor?: number | null }): string {
  if (a.drawing.nodes.length === 0) return w.results.reading.empty;
  const r = a.results;
  const reading = w.results.reading;
  if (!r) {
    const mech = a.issues.find((i) => i.code === 'mechanism');
    if (mech) {
      const kind = mech.kind ?? 'sway';
      return fill(reading.mechanism, { nodes: nodesOf(mech.nodes ?? [], w.words), move: fill(w.mechanism[kind].move, { n: (mech.nodes ?? []).length }), fix: w.mechanism[kind].fix }).trim();
    }
    if (a.determinacy.word === 'unstable') return fill(reading.unstable, { fix: w.mechanism.supportFix }).trim();
    return reading.unsolved;
  }
  if (mode === 'none') return reading.none;
  const unit = a.units;
  if (mode === 'deformed') {
    if (r.displacements === null) return reading.noDeformed;
    const factor = a.drawing.deflected?.factor ?? null;
    if (factor === null) return reading.zero.deformed;
    const far = largestNode(a);
    const largest = far ? fill(reading.largest.displacement, { value: how.num(far.magnitude), unit: unit.displacement, node: far.node }) : '';
    return fill(reading.deformed, { factor: how.num(factor, 3), largest }).trim();
  }
  const e = r.extremes[mode];
  const top = largerExtreme(e.max, e.min);
  if (!top) return reading.zero[mode];
  const line = r.members[top.member - 1];
  const largest = fill(reading.largest[mode], { value: how.val(top.value), unit: mode === 'M' ? unit.moment : unit.force, member: top.member, where: whereText(line, top.x, w, { num: how.num, length: how.length }) });
  return fill(reading[mode], { largest }).trim();
}

/** What a pointer over a member reads: N, V and M at a distance from its first node, with the member's own units. */
export function readoutSentence(w: FrameUi, how: Fmt & { length: string; force: string; moment: string }, o: { member: number; node: number; x: number; N: number; V: number; M: number }): string {
  return fill(w.results.readout.line, { member: o.member, x: how.num(o.x), length: how.length, node: o.node, N: how.val(o.N), V: how.val(o.V), M: how.val(o.M), force: how.force, moment: how.moment });
}

/* ── The order of the tables ──────────────────────────────────────────── */

/** The orders the tables of members can be read in. */
export type Order = 'member' | 'M' | 'V' | 'N';

/** The largest size of one internal force along a member. */
export function sizeOf(m: MemberLine, key: 'M' | 'V' | 'N'): number {
  const x = m.maxima[key];
  return Math.max(Math.abs(x.max.value), Math.abs(x.min.value));
}

/** The members in an order, the member number breaking every tie: by number, or by the size of the moment, shear or axial force, largest first. A new list. */
export function sortMembers<T extends MemberLine>(members: readonly T[], order: Order): T[] {
  const list = [...members];
  const byLabel = (p: T, q: T) => p.label - q.label;
  // Two sizes that print alike are a tie, whatever the last bit of each was.
  const by = (p: number, q: number) => (Math.abs(p - q) <= 1e-9 * Math.max(Math.abs(p), Math.abs(q)) ? 0 : p - q);
  if (order === 'member') return list.sort(byLabel);
  return list.sort((p, q) => by(sizeOf(q, order), sizeOf(p, order)) || byLabel(p, q));
}

/* ── What the tool does, as functions that can be run without a browser ─ */

/**
 * A form but for the numbers typed into it: its units, its rows, every choice made in it - and the ids by which a row names a node
 * or a member, which are numbers but not typed ones: a member moved to another node is a different frame, solved in the render that
 * shows it. A section left blank (null) against one filled in (a number) is a choice too: JSON keeps a null and the typed numbers
 * are zeroed.
 */
const IDENTIFIERS = new Set(['id', 'i', 'j', 'node', 'member', 'nextId']);
export const choicesOf = (form: unknown): string => JSON.stringify(form, (key, value: unknown) => (typeof value === 'number' && !IDENTIFIERS.has(key) ? 0 : value));

/**
 * WHICH FRAME IS SOLVED. While only NUMBERS change, the answer is of the form as it was a moment ago (`behind`, from
 * useDeferredValue): the key shows at once and the frame is solved in a render of its own. Anything else - the units, a row
 * added or removed, a choice in a list, a member moved to another node, a frame opened whole (`whole`, by identity: the form
 * the reducer returned for 'load' IS that form) - is solved in the same render as the form. And on paper it is the form.
 */
export function formToSolve<T>(o: { form: T; behind: T; whole: T | null; onPaper: boolean }): T {
  return o.onPaper || o.form === o.whole || choicesOf(o.behind) !== choicesOf(o.form) ? o.form : o.behind;
}

/** Whether an action keeps the member marks: a number typed does, anything that can renumber a member does not. */
export const keepsMarks = (type: string): boolean => type === 'patch' || type === 'section' || type === 'material' || type === 'preset';

/** The duck of a fieldset as far as adding a row to it goes. */
export interface RowsLike {
  querySelectorAll(selector: string): ArrayLike<{ querySelector(selector: string): { focus(): void } | null }>;
}
/**
 * A row added WITH THE KEYBOARD is handed the focus, in its first field - and only if one was added. An "add" that had nothing
 * to add leaves the focus on the button, where it was, and says why in a line. Returns whether the focus was moved.
 */
export function focusAddedRow(fieldset: RowsLike | null | undefined, before: number): boolean {
  const rows = fieldset?.querySelectorAll('.mp-app__item');
  if (!rows || rows.length <= before) return false;
  const first = rows[rows.length - 1].querySelector('input, select');
  first?.focus();
  return first !== null;
}

/**
 * Opening a frame that arrives whole (from the address, or the example on "Start over"): the field with the focus is left FIRST -
 * it would go on showing what was typed into the frame before - and then the frame is loaded, remembered as the one opened whole,
 * and the template group is put back to its starting point. The order is the point.
 */
export function openWhole<T>(found: T, steps: { blur: () => void; load: (form: T) => void; remember: (form: T) => void; template: (form: T) => void }): void {
  steps.blur();
  steps.load(found);
  steps.remember(found);
  steps.template(found);
}

/**
 * A frame about to be thrown away - by "Start over" or "Load template" - is left one step behind in the browser's history: the
 * address is brought to that frame first (so the entry left behind is the one on screen), then the entry is pushed. Nothing at all
 * happens for the example, or for a frame the new one is the same as. Returns whether anything was left.
 */
export function leaveBehind(before: FrameForm, after: FrameForm, example: string, io: { take: (code: string) => void; push: () => void }): boolean {
  if (!leavesBehind(before, after, example)) return false;
  io.take(encodeFrame(before));
  io.push();
  return true;
}
