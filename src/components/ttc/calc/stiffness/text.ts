import { formatNumber } from '@/lib/calc/format';
import { TOLERANCES, type AnalysisIssue, type StiffnessAnalysis, type StiffnessDrawing } from '@/lib/calc/stiffness/analysis';
import { encodeStiffness, leavesBehind, type StiffnessForm, type StiffnessList, type StiffnessNotice } from '@/lib/calc/stiffness/model';
import type { StiffnessUi } from '@/lib/calc/stiffness/strings';
import { movingNodes } from './mechanism';
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

/**
 * A sentence with its contractions made: Spanish "a el nudo" is "al nudo" and "de el" is "del". `pairs` is the words' own list
 * ("a el|al;de el|del"; none in English).
 */
export function contract(text: string, pairs: string): string {
  let out = text;
  for (const pair of pairs.split(';')) {
    const [from, to] = pair.split('|');
    if (!from || to === undefined) continue;
    out = out.replace(new RegExp(`(^|[^\\p{L}])${from}(?![\\p{L}])`, 'gu'), `$1${to}`);
  }
  return out;
}

const RAISED: Record<string, string> = { '0': '⁰', '1': '¹', '2': '²', '3': '³', '4': '⁴', '5': '⁵', '6': '⁶', '7': '⁷', '8': '⁸', '9': '⁹', '−': '⁻', '-': '⁻' };
/** A power of ten as a sentence sets it: "3 × 10^−5" is "3 × 10⁻⁵". (The drawing's own numbers are set with a raised exponent in the SVG.) */
export const raised = (text: string): string => text.replace(/× 10\^(−?\d+)/g, (_all, e: string) => `× 10${[...e].map((c) => RAISED[c] ?? c).join('')}`);

/** An exaggeration (or its reduction) as a number: 600, 0.4, 3 × 10⁻¹⁴ - never "0" for a factor that is only small. */
export function sayFactor(v: number, num: (v: number, significant: number) => string): string {
  if (v > 0 && v < 1e-12) {
    const [mantissa, exponent] = v.toExponential(2).split('e');
    return raised(`${Number(mantissa)} × 10^${String(Number(exponent)).replace('-', '−')}`);
  }
  return raised(num(v, 3));
}

/* ── One floor for the drawing, the sentence and the results ──────────────── */

/** The least a size is that the page prints as itself: `formatNumber` writes anything under it as 0 (lib/calc/format.ts), so a mark for it would be labelled 0. */
export const PRINT_FLOOR = 1e-12;
/** A force or a moment under this share of the largest of its kind is rounding, not a load or a reaction: it is not drawn, and no sentence counts it. */
export const DRAW_SHARE = 1e-12;
/** The most the deformed shape is magnified on the drawing: a movement that would need more is drawn at this and said to barely show. */
export const FACTOR_CAP = 10_000;

/** The exaggeration the drawing uses for a deformed shape the analysis gave a factor for: the factor, but no more than the cap. Null when there is none. */
export const drawnFactor = (factor: number | null | undefined): number | null => (factor === null || factor === undefined ? null : Math.min(factor, FACTOR_CAP));

/**
 * Whether the deformed shape of an analysis has a movement the figures can show: false when the biggest movement of any point is under the
 * print floor (rounding left by loads that cancel, not a movement), true when it is more, null when the analysis has no deformed shape.
 */
export function movementShows(d: { maxDisplacement: number } | null | undefined): boolean | null {
  if (!d) return null;
  return d.maxDisplacement >= PRINT_FLOOR;
}

/** What a force or a moment of a load or a reaction must be to be drawn: over the print floor and over its share of the largest of its kind. */
export const drawFloor = (largest: number): number => Math.max(PRINT_FLOOR, DRAW_SHARE * largest);

/** The loads at one node, added as the drawing draws them (one arrow for each component, one ring), and whether they cancel. */
export interface NodeSum {
  node: number;
  fx: number;
  fy: number;
  m: number;
  count: number;
  /** Two or more loads that add up to zero in every component they have: nothing is drawn, and the sentence says so. */
  cancelled: boolean;
}
/**
 * The loads at each node, added. A component that cancels to rounding (under a trillionth of the sizes added) is zero. A node whose loads all
 * cancel is `cancelled`. In the order of the nodes.
 */
export function loadSums(loads: readonly { node: number; fx: number; fy: number; m: number }[]): NodeSum[] {
  const sums = new Map<number, { fx: number; fy: number; m: number; count: number; tx: number; ty: number; tm: number }>();
  for (const l of loads) {
    const s = sums.get(l.node) ?? { fx: 0, fy: 0, m: 0, count: 0, tx: 0, ty: 0, tm: 0 };
    s.fx += l.fx;
    s.fy += l.fy;
    s.m += l.m;
    s.count++;
    s.tx += Math.abs(l.fx);
    s.ty += Math.abs(l.fy);
    s.tm += Math.abs(l.m);
    sums.set(l.node, s);
  }
  return [...sums.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([node, s]) => {
      // (a component with nothing in it, terms 0, is zero already and is not one that cancelled)
      const cancels = (v: number, terms: number) => terms > 0 && Math.abs(v) <= 1e-12 * terms;
      const gone = [cancels(s.fx, s.tx), cancels(s.fy, s.ty), cancels(s.m, s.tm)];
      const fx = gone[0] ? 0 : s.fx;
      const fy = gone[1] ? 0 : s.fy;
      const m = gone[2] ? 0 : s.m;
      return { node, fx, fy, m, count: s.count, cancelled: s.count > 1 && fx === 0 && fy === 0 && m === 0 && gone.some(Boolean) };
    });
}

/**
 * What the deformed shape is drawn at, in words: magnified N times (a factor over 1), at its true size (1), or shrunk to a share of its size (under 1:
 * a reduction is not a magnification, and it is never "0 times"). `shrink` is the clean N the analysis gives for a reduction (the factor is 1/N): it is
 * said as a percentage (2.5 is 40 %), and as 1/N only where a percentage would be a row of zeros.
 */
export function scalePhrase(d: { factor: number; shrink?: number | null }, num: (v: number, significant: number) => string, notes: { scaleUp: string; scaleOne: string; scaleDown: string; scaleDownPct?: string }): string {
  if (d.factor === 1) return notes.scaleOne;
  if (d.factor > 1) return fill(notes.scaleUp, { factor: sayFactor(Math.min(d.factor, FACTOR_CAP), num) });
  const shrink = d.shrink ?? 1 / d.factor;
  // "shrunk to 1/2.5 of its size" reads oddly: 2.5 is not a number of parts. A share is said as a percentage while it has a figure to show.
  if (notes.scaleDownPct && shrink <= 100) return fill(notes.scaleDownPct, { pct: num(100 / shrink, 3) });
  const n = sayFactor(shrink, num);
  // 1/3 × 10¹⁰ would read as (1/3) × 10¹⁰
  return fill(notes.scaleDown, { factor: n.includes('×') ? `(${n})` : n });
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
  return contract(fill(w.issues[issue.code], vars).replace(/\s+/g, ' ').trim(), w.words.contractions);
}

/** The sentence for one warning the analysis reports (the structure is solved all the same). */
export function warningSentence(warning: Warning, w: StiffnessUi, how: { mode?: Mode; number?: (v: number) => string } = {}): string {
  const say = how.number ?? ((v: number) => quote(v, 2));
  const mode = how.mode ?? 'truss';
  const dofs = (warning.dofs ?? []).map((d) => dofName(d, mode));
  const vars: Record<string, string | number> = {
    count: warning.count ?? 0,
    n: (warning.nodes ?? []).length,
    dofs: dofs.length > 1 ? `${w.words.dofs} ${dofs.join(', ')}` : dofs.length === 1 ? `${w.words.dof} ${dofs[0]}` : '',
    nodes: nodesOf(warning.nodes ?? [], w.words),
    ratio: warning.ratio !== undefined ? say(warning.ratio) : '0',
    weak: power(TOLERANCES.weak),
  };
  return contract(fill(w.warnings[warning.code], vars).replace(/\s+/g, ' ').trim(), w.words.contractions);
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

/**
 * The nodes a mechanism lets move: those of the motion its issue names and the node of the zero pivot - and, when the mechanism has several
 * independent motions, every node that can move in any of them (mechanism.ts), so that the drawing does not show a partial diagnosis as a whole one.
 */
export function mechanismNodes(a: StiffnessAnalysis, i: AnalysisIssue): number[] {
  const out = new Set<number>(i.nodes ?? []);
  if (i.node !== undefined) out.add(i.node);
  if (i.kind !== 'rigid-body' && (i.count ?? 1) > 1) for (const n of movingNodes(a.partial, a.drawing.side) ?? []) out.add(n);
  return [...out].sort((p, q) => p - q);
}

/** The nodes ringed on the drawing: those a problem is about. A mechanism rings every node that can move. */
export function flaggedNodes(a: StiffnessAnalysis): number[] {
  const ring = new Set<number>();
  for (const i of a.issues) {
    if (i.code === 'mechanism') for (const n of mechanismNodes(a, i)) ring.add(n);
    if (i.code === 'node-unconnected' || i.code === 'duplicate-node' || i.code === 'duplicate-support') for (const n of i.nodes ?? []) ring.add(n);
  }
  return [...ring].sort((p, q) => p - q);
}

/**
 * The node that moves most (the first when two move alike) and by how much, or null when no node moves by as much as the figures show (the page
 * writes a movement under a trillionth as 0: PRINT_FLOOR).
 */
export function largestNode(a: StiffnessAnalysis): { node: number; magnitude: number } | null {
  const d = a.results?.displacements;
  if (!d || d.length === 0) return null;
  let best = d[0];
  for (const x of d) if (x.magnitude > best.magnitude) best = x;
  return best.magnitude >= PRINT_FLOOR ? { node: best.node, magnitude: best.magnitude } : null;
}

/** The node that turns most (the first when two turn alike) and by how much (radians), or null when no node turns: a truss, or a frame whose joints do not turn. */
export function largestRotation(a: StiffnessAnalysis): { node: number; value: number } | null {
  const d = a.results?.displacements;
  if (!d) return null;
  let best: { node: number; value: number } | null = null;
  for (const x of d) {
    const v = Math.abs(x.rotation ?? 0);
    if (v >= PRINT_FLOOR && (!best || v > best.value)) best = { node: x.node, value: v };
  }
  return best;
}

/** One number of the reactions as the drawing writes it: a force along x or along y, or a moment, at a node. `value` is its size (the arrow shows its direction). */
export interface ReactionComponent {
  node: number;
  kind: 'x' | 'y' | 'm';
  value: number;
}

/**
 * Every component of every reaction that the drawing draws as a mark with a number: a force along x, a force along y, a moment - over the print
 * floor and over its share of the largest of its kind (rounding is not a reaction). In the order of the supports, x before y.
 */
export function reactionComponents(a: StiffnessAnalysis): ReactionComponent[] {
  const r = a.results?.reactions;
  if (!r) return [];
  const topF = Math.max(0, ...r.flatMap((x) => [Math.abs(x.rx ?? 0), Math.abs(x.ry ?? 0)]));
  const topM = Math.max(0, ...r.map((x) => Math.abs(x.rm ?? 0)));
  const out: ReactionComponent[] = [];
  for (const x of r) {
    const parts: [ReactionComponent['kind'], number][] = [['x', Math.abs(x.rx ?? 0)], ['y', Math.abs(x.ry ?? 0)], ['m', Math.abs(x.rm ?? 0)]];
    for (const [kind, value] of parts) if (value > 0 && value >= drawFloor(kind === 'm' ? topM : topF)) out.push({ node: x.node, kind, value });
  }
  return out;
}

/**
 * The largest number on a reaction arrow of the drawing: the largest force component, else, when no support pushes, the largest moment. It is
 * what a reader finds written beside an arrow (a resultant of two arrows is on none). Null when every reaction is zero.
 */
export function largestReactionComponent(a: StiffnessAnalysis): ReactionComponent | null {
  const all = reactionComponents(a);
  const pick = (list: ReactionComponent[]) => list.reduce<ReactionComponent | null>((best, c) => (!best || c.value > best.value ? c : best), null);
  return pick(all.filter((c) => c.kind !== 'm')) ?? pick(all.filter((c) => c.kind === 'm'));
}
/** The largest moment among the reactions that are drawn, even where forces react too; null when none. */
export function largestReactionMoment(a: StiffnessAnalysis): ReactionComponent | null {
  return reactionComponents(a)
    .filter((c) => c.kind === 'm')
    .reduce<ReactionComponent | null>((best, c) => (!best || c.value > best.value ? c : best), null);
}

/** `largestReactionComponent`, with whether it is a moment (the headline picks its unit by it). */
export function largestReaction(a: StiffnessAnalysis): (ReactionComponent & { moment: boolean }) | null {
  const c = largestReactionComponent(a);
  return c ? { ...c, moment: c.kind === 'm' } : null;
}

/** How big the largest movement is beside the structure (its larger side), as a ratio; null when nothing moves. It is the true movement, not the drawn one. */
export function movementShare(drawing: StiffnessDrawing): number | null {
  const d = drawing.deformed;
  if (!d || d.factor === null || d.share === null || !(d.factor > 0)) return null;
  const ratio = d.share / d.factor;
  return Number.isFinite(ratio) ? ratio : null;
}
/**
 * The caution about movements that are no longer small: said when the analysis says so (`large`: the chord of a member turns by more than the
 * one limit the engine, the warning and this line share, TOLERANCES.large), with the biggest movement as a share of the structure. '' otherwise.
 */
export function cautionLine(drawing: StiffnessDrawing, notes: { caution: string; cautionShare: string; cautionTimes: string }, num: (v: number, significant: number) => string): string {
  const ratio = movementShare(drawing);
  if (ratio === null || drawing.deformed?.large !== true) return '';
  const share = ratio >= 1 ? fill(notes.cautionTimes, { times: raised(num(ratio, 2)) }) : fill(notes.cautionShare, { pct: num(ratio * 100, 2) });
  return fill(notes.caution, { share, limit: num(TOLERANCES.large, 2) });
}

/**
 * What is drawn, as far as the sentence under the drawing cares: the shape; whether the nodes carry their numbers (the switch; omitted: they do) and
 * which of them the figure drew as dots all the same, because they stand too close for a number (`dots`, labels; the figure reports them: omitted,
 * none); and the switches of the loads and of the reactions (omitted: on), since a sentence quotes only what is drawn.
 */
export interface DrawnLooks {
  deformed: boolean;
  nodeNumbers?: boolean;
  dots?: readonly number[];
  loads?: boolean;
  reactions?: boolean;
}

/**
 * THE ONE SENTENCE UNDER THE DRAWING: what to read in it, built from the numbers of the structure on screen and from what is DRAWN, and true
 * in every case - an empty drawing says nothing, a structure that cannot be solved says what is wrong and which nodes are ringed, a structure
 * under no load says that nothing moves, loads that cancel are said to, a movement under the print floor is not "by 0", a drawing without node
 * numbers (or with some nodes too close for theirs) says what its circles and its dots are and where the numbers of the nodes it names are
 * to be found, a reaction is quoted as the number on an arrow (with its direction) and not at all when reactions are not drawn. A noun, a verb
 * and a pronoun agree with how many there are.
 */
export function readingSentence(a: StiffnessAnalysis, looks: DrawnLooks, w: StiffnessUi, how: Fmt & { mode: Mode }): string {
  if (a.drawing.nodes.length === 0) return w.drawing.reading.empty;
  const reading = w.drawing.reading;
  const labels = a.drawing.nodes.map((n) => n.label);
  const switchOn = looks.nodeNumbers !== false;
  // The nodes the drawing shows as dots: all of them with the switch off, else those it found too close for a number.
  const dotSet = new Set<number>(switchOn ? (looks.dots ?? []) : labels);
  const allDots = labels.every((n) => dotSet.has(n));
  /** What to say of the nodes a sentence names, when some of them are dots: the tables are where their numbers are. */
  const dotCaveat = (named: readonly number[]): string => {
    const dotted = [...new Set(named)].filter((n) => dotSet.has(n)).sort((p, q) => p - q);
    if (dotted.length === 0) return '';
    if (!switchOn) return reading.numbersOff;
    if (allDots) return reading.numbersCrowded;
    const list = nodesOf(dotted, w.words);
    return fill(reading.dotsNamed, { nodes: list.charAt(0).toUpperCase() + list.slice(1), count: dotted.length });
  };
  const r = a.results;
  if (!r) {
    const mech = a.issues.find((i) => i.code === 'mechanism');
    if (mech) {
      const rigid = mech.kind === 'rigid-body';
      const entry = rigid ? w.mechanism.rigid : w.mechanism.sway;
      const moving = mechanismNodes(a, mech);
      const count = rigid ? 1 : Math.max(1, moving.length);
      const nodes = rigid ? w.mechanism.whole : nodesOf(moving, w.words);
      const first = nodes.charAt(0).toUpperCase() + nodes.slice(1);
      const sentence = fill(reading.mechanism, { nodes: first, count, move: entry.move, ringed: rigid ? '' : fill(reading.ringed, { count }), fix: how.mode === 'truss' ? entry.fixTruss : entry.fixFrame })
        .replace(/\s+/g, ' ')
        .trim();
      const caveat = rigid ? '' : dotCaveat(moving);
      return contract(caveat ? `${sentence} ${caveat}` : sentence, w.words.contractions);
    }
    if (a.determinacy.word === 'unstable') return fill(reading.unstable, { fix: w.mechanism.supportFix }).trim();
    return reading.unsolved;
  }
  const unit = a.units;
  const lead = allDots ? reading.nodePlain : dotSet.size > 0 ? reading.nodeMixed : reading.nodeNumbered;
  const parts: string[] = [fill(reading.lead, { nodes: lead })];
  const deformed = a.drawing.deformed;
  const factor = drawnFactor(deformed?.factor ?? null);
  const shows = movementShows(deformed) !== false;
  const far = largestNode(a);
  const turn = largestRotation(a);
  // A sentence that names a node by its number is one that needs the numbers: they are in the tables when the drawing leaves them off.
  const named: number[] = [];
  if (looks.deformed && factor !== null && shows) parts.push(fill(reading.deformed, { scale: scalePhrase({ factor, shrink: deformed?.shrink }, how.num, w.drawing.notes) }));
  // Loads that cancel are drawn as nothing; the sentence says why.
  if (looks.loads !== false) {
    const cancelled = loadSums(a.drawing.loads).filter((s) => s.cancelled).map((s) => s.node);
    if (cancelled.length > 0) parts.push(fill(reading.cancelled, { nodes: nodesOf(cancelled, w.words), count: cancelled.length }));
  }
  if (far) {
    named.push(far.node);
    parts.push(fill(reading.moves, { node: far.node, value: how.num(far.magnitude), unit: unit.displacement }));
  } else if (turn) {
    named.push(turn.node);
    parts.push(fill(reading.turns, { node: turn.node, value: how.num(turn.value), unit: unit.rotation }));
  } else if (factor === null) {
    // Nothing moves, and no deformed shape exists to draw: nothing is said of one that "lies on the structure".
    const none = a.drawing.loads.length === 0 && a.drawing.memberLoads.length === 0 && !a.drawing.supports.some((s) => s.settle);
    parts.push(none ? (looks.deformed ? reading.noLoadDrawn : reading.noLoad) : looks.deformed ? reading.stillDrawn : reading.still);
  } else if (!shows) {
    // The analysis moves nothing but rounding: not "by 0", and no shape is drawn of it.
    parts.push(fill(looks.deformed ? reading.tinyDrawn : reading.tiny, { floor: raised(formatNumber(PRINT_FLOOR, 1)), unit: unit.displacement }));
  } else {
    // A node that does not move can still be joined by a member that bends under its own load.
    parts.push(reading.nodesStill);
  }
  if (looks.reactions !== false) {
    const big = largestReactionComponent(a);
    const moment = largestReactionMoment(a);
    if (!big) parts.push(reading.noReaction);
    else if (big.kind === 'm') {
      named.push(big.node);
      parts.push(fill(reading.reactionMoment, { value: how.num(big.value), unit: unit.moment, node: big.node }));
    } else {
      named.push(big.node);
      parts.push(fill(reading.reaction, { value: how.num(big.value), unit: unit.force, dir: big.kind === 'x' ? reading.horizontal : reading.vertical, node: big.node }));
      if (moment) {
        named.push(moment.node);
        parts.push(fill(reading.reactionMomentToo, { value: how.num(moment.value), unit: unit.moment, node: moment.node }));
      }
    }
  }
  parts.push(dotCaveat(named));
  // (a power of ten the page writes with a caret is set raised, as everywhere else in the sentences)
  return raised(parts.filter(Boolean).join(' '));
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
