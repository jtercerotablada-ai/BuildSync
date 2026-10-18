import { formatNumber } from '@/lib/calc/format';
import { TOLERANCES, type AnalysisIssue, type StiffnessAnalysis } from '@/lib/calc/stiffness/analysis';
import { encodeStiffness, leavesBehind, type StiffnessForm, type StiffnessList, type StiffnessNotice } from '@/lib/calc/stiffness/model';
import type { StiffnessUi } from '@/lib/calc/stiffness/strings';
import { SECTION_LOW, type Mode, type Warning } from '@/lib/calc/stiffness/types';

/**
 * The little text machinery of the stiffness calculator's sentences. No React, no words of its own (a calculator's words are a prop:
 * lib/calc/stiffness/strings.ts).
 *
 *   fill      a sentence with holes: `{count}` is the number, and `{count|member|members}` is the first word when it is 1 and the
 *             second otherwise. One pass over the sentence, so that nothing typed into a hole is taken for another hole.
 *   listOf    numbers as a reader writes them: 1–4, 6 and 9–11.
 *   signed    a value with its sign and a TRUE minus; a zero with none.
 *
 * Then every SENTENCE the tool builds out of the analysis (a problem, a warning, a notice, the line under the drawing), as functions
 * that can be run without a browser - and the small rules of the form (which form is solved, how a row gets the focus, what is left
 * behind in the history).
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

/** How the page writes a number in a sentence (the group mark is the page's). */
export interface Fmt {
  /** A size or a coordinate, with a true minus. */
  num: (v: number, significant?: number) => string;
  /** A value with its sign always shown (+ or a true minus; none for zero). */
  val: (v: number, significant?: number) => string;
}

/** The name of a global DOF from its number: '3y'. */
export function dofName(d: number, mode: Mode): string {
  const nd = mode === 'frame' ? 3 : 2;
  return `${Math.floor((d - 1) / nd) + 1}${['x', 'y', 'θ'][(d - 1) % nd]}`;
}

/**
 * A number as the sentences quote it when it may be a hair: the page's way of writing it ("1 × 10^−9"), except that a nonzero number under
 * 10^−12 is NOT written as 0 (that is where `formatNumber` stops): "between 0 and ..." would say that zero is allowed where the rule is 10^−30.
 */
function quote(v: number, significant: number): string {
  if (v === 0 || Math.abs(v) >= 1e-12 || !Number.isFinite(v)) return formatNumber(v, significant);
  const [mantissa, exponent] = v.toExponential(Math.max(0, significant - 1)).split('e');
  return `${Number(mantissa)} × 10^${String(Number(exponent)).replace('-', '−')}`;
}
/** A tolerance as the sentences quote it: "1 × 10^−9". */
const power = (v: number): string => quote(v, 1);

/* ── Problems and warnings ────────────────────────────────────────────── */

/**
 * The sentence for one problem the analysis reports: its code's line in the words given, with the numbers the code carries put in
 * its holes. Nothing in the sentence is left as a `{hole}`. The tolerances that a sentence quotes are the library's own
 * (`TOLERANCES`), so a sentence can never say 10⁻⁹ where the engine uses another.
 */
export function issueSentence(issue: AnalysisIssue, w: StiffnessUi, how: { number?: (v: number) => string; unit?: string; mode?: Mode } = {}): string {
  const say = how.number ?? ((v: number) => String(v));
  const vars: Record<string, string | number> = {};
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
  vars.limit = power(issue.code === 'ill-conditioned' ? (issue.limit ?? TOLERANCES.residual) : TOLERANCES.limit);
  vars.low = power(SECTION_LOW);
  vars.near = power(TOLERANCES.near);
  vars.short = power(TOLERANCES.short);
  vars.residual = issue.residual !== undefined ? quote(issue.residual, 2) : '0';
  if (issue.code === 'disconnected') vars.groups = (issue.groups ?? []).map((g) => `${w.words.nodes} ${listOf(g, w.words.and)}`).join('; ');
  if (issue.code === 'duplicate-node') vars.list = listOf(issue.nodes ?? [], w.words.and);
  if (issue.code === 'node-unconnected') {
    vars.nodes = nodesOf(issue.nodes ?? [], w.words);
    vars.count = new Set(issue.nodes ?? []).size;
  }
  if (issue.code === 'mechanism') {
    const rigid = issue.kind === 'rigid-body';
    const mode = how.mode ?? 'truss';
    const entry = rigid ? w.mechanism.rigid : w.mechanism.sway;
    vars.where = rigid ? w.mechanism.whole : fill(w.mechanism.where, { dof: issue.dofLabel ?? String(issue.dof ?? ''), node: issue.node ?? 0 });
    vars.move = entry.move;
    vars.fix = mode === 'truss' ? entry.fixTruss : entry.fixFrame;
    const moving = (issue.nodes ?? []).filter((n) => n !== issue.node);
    vars.moving = !rigid && moving.length > 0 ? fill(w.mechanism.moving, { nodes: nodesOf(issue.nodes ?? [], w.words) }) : '';
    vars.more = (issue.count ?? 1) > 1 ? fill(w.mechanism.more, { count: issue.count ?? 0 }) : '';
  }
  return fill(w.issues[issue.code], vars).replace(/\s+/g, ' ').trim();
}

/** The sentence for one warning the analysis reports (the structure is solved all the same). */
export function warningSentence(warning: Warning, w: StiffnessUi, how: { mode?: Mode; number?: (v: number) => string } = {}): string {
  const say = how.number ?? ((v: number) => quote(v, 2));
  const mode = how.mode ?? 'truss';
  const dofs = (warning.dofs ?? []).map((d) => dofName(d, mode));
  const vars: Record<string, string | number> = {
    count: warning.count ?? 0,
    dofs: dofs.length > 1 ? `${w.words.dofs} ${dofs.join(', ')}` : dofs.length === 1 ? `${w.words.dof} ${dofs[0]}` : '',
    nodes: nodesOf(warning.nodes ?? [], w.words),
    ratio: warning.ratio !== undefined ? say(warning.ratio) : '0',
    weak: power(TOLERANCES.weak),
  };
  return fill(w.warnings[warning.code], vars).replace(/\s+/g, ' ').trim();
}

/* ── What the form tells whoever just did something ───────────────────── */

export interface NoticeText {
  where: StiffnessList;
  text: string;
}

/** The line the last edit has to tell: the node or member that went, the add that had nothing to add, the list that is full. A template has no line here (the template group says it). */
export function noticeText(n: StiffnessNotice | null, w: StiffnessUi): NoticeText | null {
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
      return null;
  }
}

/* ── The drawing in words ─────────────────────────────────────────────── */

/** The nodes ringed on the drawing: those a problem is about. */
export function flaggedNodes(a: StiffnessAnalysis): number[] {
  const ring = new Set<number>();
  for (const i of a.issues) {
    if (i.code === 'mechanism' || i.code === 'node-unconnected' || i.code === 'duplicate-node' || i.code === 'duplicate-support') for (const n of i.nodes ?? []) ring.add(n);
    if (i.code === 'mechanism' && i.node !== undefined) ring.add(i.node);
  }
  return [...ring].sort((p, q) => p - q);
}

/** The node that moves most (the first when two move alike) and by how much, or null when nothing moves. */
export function largestNode(a: StiffnessAnalysis): { node: number; magnitude: number } | null {
  const d = a.results?.displacements;
  if (!d || d.length === 0) return null;
  let best = d[0];
  for (const x of d) if (x.magnitude > best.magnitude) best = x;
  return best.magnitude > 0 ? { node: best.node, magnitude: best.magnitude } : null;
}

/** The largest reaction: by the size of its force (the resultant at a node), else, when no support pushes, by the size of its moment. Null when every reaction is zero. */
export function largestReaction(a: StiffnessAnalysis): { node: number; value: number; moment: boolean } | null {
  const r = a.results?.reactions;
  if (!r) return null;
  let force: { node: number; value: number; moment: boolean } | null = null;
  let moment: { node: number; value: number; moment: boolean } | null = null;
  for (const x of r) {
    if (x.magnitude > 0 && (!force || x.magnitude > force.value)) force = { node: x.node, value: x.magnitude, moment: false };
    const m = Math.abs(x.rm ?? 0);
    if (m > 0 && (!moment || m > moment.value)) moment = { node: x.node, value: m, moment: true };
  }
  return force ?? moment;
}

/** What is drawn, as far as the sentence under the drawing cares. */
export interface DrawnLooks {
  deformed: boolean;
}

/**
 * THE ONE SENTENCE UNDER THE DRAWING: what to read in it, built from the numbers of the structure on screen and true in every case -
 * an empty drawing says nothing, a structure that cannot be solved says what is wrong and which nodes are ringed, a structure under no
 * load says that nothing moves.
 */
export function readingSentence(a: StiffnessAnalysis, looks: DrawnLooks, w: StiffnessUi, how: Fmt & { mode: Mode }): string {
  if (a.drawing.nodes.length === 0) return w.drawing.reading.empty;
  const reading = w.drawing.reading;
  const r = a.results;
  if (!r) {
    const mech = a.issues.find((i) => i.code === 'mechanism');
    if (mech) {
      const rigid = mech.kind === 'rigid-body';
      const entry = rigid ? w.mechanism.rigid : w.mechanism.sway;
      const nodes = rigid ? w.mechanism.whole : nodesOf(mech.nodes ?? (mech.node !== undefined ? [mech.node] : []), w.words);
      const first = nodes.charAt(0).toUpperCase() + nodes.slice(1);
      return fill(reading.mechanism, { nodes: first, move: entry.move, ringed: rigid ? '' : reading.ringed, fix: how.mode === 'truss' ? entry.fixTruss : entry.fixFrame })
        .replace(/\s+/g, ' ')
        .trim();
    }
    if (a.determinacy.word === 'unstable') return fill(reading.unstable, { fix: w.mechanism.supportFix }).trim();
    return reading.unsolved;
  }
  const unit = a.units;
  const parts: string[] = [reading.lead];
  const factor = a.drawing.deformed?.factor ?? null;
  const far = largestNode(a);
  if (looks.deformed) parts.push(factor === null ? '' : fill(reading.deformed, { factor: how.num(factor, 3) }));
  // Nothing moves at all when the deformed shape has no exaggeration to state; a node that does not move can still be joined by a member that bends under its own load.
  parts.push(far ? fill(reading.moves, { node: far.node, value: how.num(far.magnitude), unit: unit.displacement }) : factor === null ? (looks.deformed ? reading.stillDrawn : reading.still) : reading.nodesStill);
  const big = largestReaction(a);
  parts.push(big ? fill(big.moment ? reading.reactionMoment : reading.reaction, { value: how.num(big.value), unit: big.moment ? unit.moment : unit.force, node: big.node }) : reading.noReaction);
  return parts.filter(Boolean).join(' ');
}

/* ── What the tool does, as functions that can be run without a browser ─ */

/**
 * WHICH STRUCTURE IS SOLVED. While only NUMBERS change, the answer is of the form as it was a moment ago (`behind`, from
 * useDeferredValue): the key shows at once and the structure is solved in a render of its own. Anything else - the units, the mode, a
 * row added or removed, a restraint ticked, a member moved to another node, a structure opened whole (`whole`, by identity: the form the
 * reducer returned for 'load' IS that form) - is solved in the same render as the form. And on paper it is the form.
 */
export function formToSolve<T>(o: { form: T; behind: T; whole: T | null; onPaper: boolean; choices: (form: T) => string }): T {
  return o.onPaper || o.form === o.whole || o.choices(o.behind) !== o.choices(o.form) ? o.form : o.behind;
}

/** Whether an action replaces the rows (a template, a start over, an opened link, a cleared structure): the rows are numbered from 1 again, and an id stands for another row than before. */
export const restartsRows = (type: string): boolean => type === 'template' || type === 'reset' || type === 'load' || type === 'clear';

/** Whether an action keeps the marks (the member picked, the settlement rows open): a number typed does, anything that can renumber a row does not. */
export const keepsMarks = (type: string): boolean => type === 'patch' || type === 'section' || type === 'material';

/** The duck of a fieldset as far as adding a row to it goes. */
export interface RowsLike {
  querySelectorAll(selector: string): ArrayLike<{ querySelector(selector: string): { focus(): void } | null }>;
}
/**
 * A row added WITH THE KEYBOARD is handed the focus, in its first field - and only if one was added. An "add" that had nothing to add
 * leaves the focus on the button, where it was, and says why in a line. Returns whether the focus was moved.
 */
export function focusAddedRow(fieldset: RowsLike | null | undefined, before: number): boolean {
  const rows = fieldset?.querySelectorAll('.mp-app__item');
  if (!rows || rows.length <= before) return false;
  const first = rows[rows.length - 1].querySelector('input, select');
  first?.focus();
  return first !== null;
}

/**
 * Opening a structure that arrives whole (from the address, or the example on "Start over"): the field with the focus is left FIRST -
 * it would go on showing what was typed into the structure before - and then the structure is loaded, remembered as the one opened
 * whole, and the template group is put back to its starting point. The order is the point.
 */
export function openWhole<T>(found: T, steps: { blur: () => void; load: (form: T) => void; remember: (form: T) => void; template: (form: T) => void }): void {
  steps.blur();
  steps.load(found);
  steps.remember(found);
  steps.template(found);
}

/**
 * A structure about to be thrown away - by "Start over" or "Load problem" - is left one step behind in the browser's history: the
 * address is brought to that structure first (so the entry left behind is the one on screen), then the entry is pushed. Nothing at all
 * happens for the example, or for a structure the new one is the same as. Returns whether anything was left.
 */
export function leaveBehind(before: StiffnessForm, after: StiffnessForm, example: string, io: { take: (code: string) => void; push: () => void }): boolean {
  if (!leavesBehind(before, after, example)) return false;
  io.take(encodeStiffness(before));
  io.push();
  return true;
}
