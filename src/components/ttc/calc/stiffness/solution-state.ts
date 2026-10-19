import type { StiffnessAnalysis } from '@/lib/calc/stiffness/analysis';
import type { UnitSystem } from '@/lib/calc/stiffness/model';
import type { StiffnessUi } from '@/lib/calc/stiffness/strings';
import type { Block, MatrixBlock, Step, StepId, VectorBlock } from '@/lib/calc/stiffness/types';
import { notation } from './math';
import { stepWeight } from './steps';
import { fill } from './text';

/**
 * THE WORKED SOLUTION'S STATE AND ITS RULES, with no React and no DOM, so that every one of them can be run in a test: which cards start
 * open, what "Expand all" and "Collapse all" and a click do to them, where Previous and Next go from where the reader is, which cards are
 * drawn in full (the ones near the screen), how a long table is drawn a few rows at a time, what a printed sheet leaves out, and how a
 * count of entries is written.
 *
 * THE COST OF A SOLUTION is its tables. A structure of twelve nodes is 130 cards and about sixty thousand entries, and a page that builds
 * them all freezes a phone for a minute. So a card that is OPEN draws its words (a title, a paragraph, the formulas) whatever the size, and
 * draws its TABLES only while it is near the screen; a card far away keeps the room its tables will take (`later`). Opening every card is
 * then one cheap render whatever the size, a keystroke re-draws only what is in sight, and the page the reader scrolls is a full solution.
 * On paper every card is drawn in full (the browser prints what the page holds), but for a very long solution the sheet may leave out the
 * member-by-member assembly and the elimination, which are nine tenths of the entries (`printSteps`).
 */

/** A card with more entries than this starts closed (the first card never does): a 36 × 36 matrix, shown twice, is the one that is too much to open for the reader. */
export const OPEN_CARD = 800;
/** The cards drawn in full before the page knows where the screen is (the server's page, and the first render in the browser): this many entries at most, and at most this many cards. */
export const SEED_ENTRIES = 150;
export const SEED_CARDS = 4;
/** More entries than this and the printed sheet offers to leave out the assembly and the elimination. */
export const PRINT_BUDGET = 6000;
/** The steps a short printed sheet leaves out when the visitor chooses a short sheet: the member-by-member assembly and the passes of the elimination. */
export const PRINT_SKIPPED: readonly StepId[] = ['assembly', 'augmented', 'forward-pass', 'back-substitution'];

/** The most entries of a table drawn in one go; the rest follow a few rows at a time. */
export const TABLE_CHUNK = 260;
/** A table with no more entries than this is drawn whole at once. */
export const TABLE_WHOLE = 600;

/* ── What each card is ────────────────────────────────────────────────── */

/** Which cards start open: the first, and every card whose tables are not very large. */
export function autoOpen(steps: readonly Step[]): boolean[] {
  return steps.map((s, k) => k === 0 || stepWeight(s) <= OPEN_CARD);
}

/** How many cards start closed because their tables are very large. */
export const startClosed = (open: readonly boolean[]): number => open.filter((x) => !x).length;

/** The keys of the cards drawn in full before the screen is known: the first few, while they stay small. */
export function seedNear(steps: readonly Step[]): ReadonlySet<string> {
  const keys = new Set<string>();
  let entries = 0;
  for (const s of steps) {
    entries += stepWeight(s);
    if (keys.size >= 2 && (entries > SEED_ENTRIES || keys.size >= SEED_CARDS)) break;
    keys.add(s.key);
  }
  return keys;
}

/** The set of cards near the screen after some come into range (`on`) and some leave it; the same set when nothing changed. */
export function applyNear(prev: ReadonlySet<string>, changes: readonly { key: string; on: boolean }[]): ReadonlySet<string> {
  let next: Set<string> | null = null;
  for (const c of changes) {
    if (c.on === prev.has(c.key) && next === null) continue;
    next ??= new Set(prev);
    if (c.on) next.add(c.key);
    else next.delete(c.key);
  }
  return next ?? prev;
}

/**
 * The most often the cards in sight are drawn while the page scrolls (ms): the first card to come into sight after the page has been still is drawn at once - a
 * jump is not made to wait - and the rest at this pace, so that a flick through forty cards is not forty draws in a second.
 */
export const SIGHT_EVERY = 120;
/** The set of cards in sight once the scroll has settled: the cards that are in sight now, as the very same set when nothing changed (nothing is drawn again). */
export function settleSight(prev: ReadonlySet<string>, now: ReadonlySet<string>): ReadonlySet<string> {
  if (prev.size === now.size && [...now].every((k) => prev.has(k))) return prev;
  return new Set(now);
}

/** The room the tables of a card will take, in pixels, until it is drawn once and the real height is known. */
export function estimateBody(step: Step, rowHeight = 36): number {
  let h = 0;
  for (const b of step.blocks) {
    if (b.type === 'matrix') h += 64 + Math.min((b.rowLabels.length + 1) * rowHeight, 640) + 56;
    else if (b.type === 'vector') h += 64 + Math.min((b.labels.length + 1) * rowHeight, 640) + 56;
    else h += 34;
  }
  return Math.round(h) + 16;
}

/* ── Open and closed, and where the reader is ─────────────────────────── */

export interface OpenState {
  /** What "Expand all" and "Collapse all" last said; 'auto' is the cards' own start. */
  mode: 'auto' | 'all' | 'none';
  /** A card opened or closed by hand, by key; it wins over the mode. */
  toggled: Record<string, boolean>;
  /** The card the reader is at: the one they were last taken to (Previous, Next, the outline, the menu), and after that the one at the top of the screen as they scroll (`at`). */
  current: string | null;
  /** What the last press of Expand all or Collapse all did, for the line that tells it. */
  said: 'expanded' | 'collapsed' | null;
  /** The card the reader was taken to by a press that left the focus where it was (Previous, Next, the menu): the line that announces it. It does not follow the scroll. */
  movedTo: string | null;
}

export const FRESH: OpenState = { mode: 'auto', toggled: {}, current: null, said: null, movedTo: null };

export type OpenAction =
  | { type: 'expand' }
  | { type: 'collapse' }
  | { type: 'toggle'; key: string; wasOpen: boolean }
  /** `announce`: the focus stays on the control that was pressed, so the arrival is told in words. */
  | { type: 'go'; key: string; announce?: boolean }
  /** The reader scrolled: the card at the top of the screen is the one they are at (null: above the first). Nothing is opened, closed or announced. */
  | { type: 'at'; key: string | null }
  | { type: 'reset' };

export function openReducer(state: OpenState, action: OpenAction): OpenState {
  switch (action.type) {
    case 'expand':
      return { ...state, mode: 'all', toggled: {}, said: 'expanded', movedTo: null };
    case 'collapse':
      return { ...state, mode: 'none', toggled: {}, said: 'collapsed', movedTo: null };
    case 'toggle':
      return { ...state, toggled: { ...state.toggled, [action.key]: !action.wasOpen }, said: null, movedTo: null };
    case 'go':
      return { ...state, current: action.key, toggled: { ...state.toggled, [action.key]: true }, said: null, movedTo: action.announce ? action.key : null };
    case 'at':
      return state.current === action.key ? state : { ...state, current: action.key };
    case 'reset':
      return FRESH;
  }
}

/** Whether a card is open: by hand, else by the last Expand or Collapse, else by its own start. On paper every card is. */
export function isOpen(state: OpenState, key: string, auto: boolean, onPaper: boolean): boolean {
  if (onPaper) return true;
  const chosen = state.toggled[key];
  if (chosen !== undefined) return chosen;
  if (state.mode === 'all') return true;
  if (state.mode === 'none') return false;
  return auto;
}

/** The card the reader is at, or null: a card that is no longer in the solution (the structure changed under it) is nowhere. */
export function currentOf(state: OpenState, keys: readonly string[]): string | null {
  return state.current !== null && keys.includes(state.current) ? state.current : null;
}

/** The key Previous (-1) or Next (+1) goes to from where the reader is; null when there is nowhere to go. Next from nowhere goes to the first card; Previous from nowhere or from the first goes nowhere. */
export function stepTarget(current: string | null, keys: readonly string[], delta: -1 | 1): string | null {
  if (keys.length === 0) return null;
  const at = current === null ? -1 : keys.indexOf(current);
  if (at < 0) return delta === 1 ? keys[0] : null;
  const to = at + delta;
  return to >= 0 && to < keys.length ? keys[to] : null;
}

/** The line that says where the reader is: the card's own number (as its heading writes it) and its place among all of them; or how many there are, before any. */
export function positionLine(words: { position: string; positionNone: string }, label: string | null, at: number, total: number): string {
  return label === null || at < 0 ? fill(words.positionNone, { total }) : fill(words.position, { label, now: at + 1, total });
}

/** A title as a screen reader is given it, in the page's language: "K sub FF", "K subíndice FF"; a transpose is said too. */
export function spokenTitle(title: string, words: { spokenSub: string; spokenTranspose: string }): string {
  return notation(title)
    .map((p) => (p.kind === 'sub' ? ` ${words.spokenSub} ${p.text.replace(/,/g, ' ')} ` : p.kind === 'sup' ? ` ${words.spokenTranspose} ` : p.text))
    .join('')
    .replace(/\s+/g, ' ')
    .trim();
}

/** The line that tells, in words, where a press of Previous, Next or the menu took the reader (the focus stayed on the control, so the page does not move it): the number, the place among all, the title as it is spoken. */
export function movedLine(words: { moved: string }, label: string, at: number, total: number, title: string): string {
  return fill(words.moved, { label, now: at + 1, total, title });
}

/* ── Where the reader is, from the scroll ──────────────────────────────── */

/** How far under a card's scroll margin (where a card the reader is taken to stands) the reading line lies, px: the card whose top has reached it is the one being read. */
export const LINE_BELOW_MARGIN = 24;

/**
 * The card the reader is at: of the cards' tops (px from the top of the screen, in the page's order; null for a card that is not on the page), the LAST that
 * has reached the line - the card the line crosses, or the one just above it when the line stands in the gap between two. Null when none has: the reader is
 * above the first card (the form, the answer), and is not "at" a step.
 */
export function cardAtLine(tops: readonly (number | null)[], line: number): number | null {
  let at: number | null = null;
  let best = -Infinity;
  for (let k = 0; k < tops.length; k++) {
    const t = tops[k];
    if (t === null || !(t <= line)) continue;
    if (t >= best) {
      best = t;
      at = k;
    }
  }
  return at;
}

/** Scroll events within this long of the reader's last wheel, touch, key or press are the reader's own (a flick keeps going after the finger is up). */
export const READING_WINDOW = 2500;
/** Whether a scroll happening now is one the reader made: they used the wheel, the screen, a key or the scrollbar a moment ago. */
export const readerScrolled = (now: number, lastInput: number): boolean => now - lastInput <= READING_WINDOW;
/** Whether a key press may move the page, so that a card being held in place yields to it: any but a bare modifier. */
export const keyMoves = (key: string): boolean => !['Shift', 'Control', 'Alt', 'Meta', 'CapsLock', 'AltGraph', 'OS'].includes(key);

/* ── Holding a card where it was put ───────────────────────────────────── */

/**
 * A card the reader was taken to stays where it was put until they move the page themselves. The tables of the cards round it are drawn a moment after the
 * jump, over a few turns, and each changes the height of what is above it: the page is put back each frame while that goes on, and the hold ends when it is
 * quiet (nothing has had to be put back for HOLD_QUIET ms and no draw is waiting), never before HOLD_MIN ms, never after HOLD_MAX ms.
 */
export const HOLD_MIN = 400;
export const HOLD_QUIET = 700;
export const HOLD_MAX = 10_000;

/** How far the card is from where it should stand, px (positive: it is below); 0 within a pixel. */
export const strayOf = (top: number, want: number): number => (Math.abs(top - want) > 1 ? top - want : 0);

export interface HoldClock {
  /** When the hold began, and when the card last had to be put back. */
  started: number;
  moved: number;
}
/** Whether a hold is over: it ran out, or it has been quiet long enough with nothing waiting to be drawn. */
export function holdOver(clock: HoldClock, now: number, waiting: boolean): boolean {
  if (now - clock.started >= HOLD_MAX) return true;
  if (waiting) return false;
  return now - clock.started >= HOLD_MIN && now - clock.moved >= HOLD_QUIET;
}

/* ── What a count is, and which units ─────────────────────────────────── */

/** An integer with the page's own mark between thousands ("59,130", "59 130"): never the browser's locale. */
export function groupDigits(n: number, group: string): string {
  const s = String(Math.round(Math.abs(n)));
  return `${n < 0 ? '−' : ''}${s.replace(/\B(?=(\d{3})+(?!\d))/g, group)}`;
}

/** The unit system the numbers of an analysis are in - the system it was computed for, not the one the form shows now. */
export function systemOf(analysis: Pick<StiffnessAnalysis, 'units'>): UnitSystem {
  return analysis.units.length === 'm' ? 'si' : 'us';
}

/* ── Paper ────────────────────────────────────────────────────────────── */

export type PrintScope = 'all' | 'short';

/** The total number of entries of a solution. */
export const weightOf = (steps: readonly Step[]): number => steps.reduce((n, s) => n + stepWeight(s), 0);

/** The steps the sheet carries: all of them, or - for a short sheet - all but the assembly of each member and the passes of the elimination. */
export function printSteps(steps: readonly Step[], scope: PrintScope): Step[] {
  return scope === 'all' ? [...steps] : steps.filter((s) => !PRINT_SKIPPED.includes(s.id));
}

/** The scope a solution starts with: a very long one starts as a short sheet (the visitor can ask for all). */
export const startScope = (steps: readonly Step[]): PrintScope => (weightOf(steps) > PRINT_BUDGET ? 'short' : 'all');

/* ── A long table, a few rows at a time ───────────────────────────────── */

/** The rows of a table drawn first: all of them for a table that is not large (and always on paper), else a first chunk. */
export function firstRows(rows: number, cols: number, whole: boolean): number {
  if (whole || rows * cols <= TABLE_WHOLE) return rows;
  return Math.min(rows, Math.max(4, Math.floor(TABLE_CHUNK / Math.max(1, cols))));
}

/** The rows drawn after the next step of the same table. */
export function nextRows(shown: number, rows: number, cols: number): number {
  return Math.min(rows, shown + Math.max(4, Math.floor(TABLE_CHUNK / Math.max(1, cols))));
}

/** The columns of each band of a table printed in bands: as even as can be, none wider than `most`. */
export function bandsOf(total: number, most: number): [number, number][] {
  if (total <= most) return [[0, total]];
  const count = Math.ceil(total / most);
  const size = Math.ceil(total / count);
  return Array.from({ length: count }, (_, k) => [k * size, Math.min(total, (k + 1) * size)] as [number, number]);
}

/* ── What a card holds, said before it is drawn ────────────────────────── */

/** The tables and values a step draws, counted from its blocks without building them: how many tables, the rows × columns of the largest, and how many values in its list. */
export interface Holds {
  tables: number;
  largest: { rows: number; cols: number } | null;
  values: number;
}

const DISPLACEMENT_VECTORS: readonly string[] = ['prescribed', 'u_R', 'u', 'u_F', 'u_e', 'u_local'];
const PLAIN_VECTORS: readonly string[] = ['code', 'multipliers'];
/** The kind of unit a vector's entries are in: vectors of one kind that stand on the same labels are one table (steps.ts, stepBody). */
const kindOfVector = (name: string): string => (DISPLACEMENT_VECTORS.includes(name) ? 'displacement' : PLAIN_VECTORS.includes(name) ? 'plain' : 'force');

/**
 * What a step will draw, by the rules `stepBody` (steps.ts) draws it by: the partition is one table (and one of the loads and movements); consecutive vectors on
 * the same labels, of one kind, are one table; every matrix is one; the scalars are one list. A test holds the two together on every step of every problem.
 */
export function holdsOf(step: Step): Holds {
  let tables = 0;
  let values = 0;
  let largest: Holds['largest'] = null;
  const table = (rows: number, cols: number) => {
    tables++;
    if (largest === null || rows * cols > largest.rows * largest.cols) largest = { rows, cols };
  };
  const matrix = (name: string): MatrixBlock | undefined => step.blocks.find((b): b is MatrixBlock => b.type === 'matrix' && b.name === name && b.tag === undefined);
  const vector = (name: string): VectorBlock | undefined => step.blocks.find((b): b is VectorBlock => b.type === 'vector' && b.name === name && b.tag === undefined);
  if (step.id === 'partition') {
    const FF = matrix('K_FF');
    const RR = matrix('K_RR');
    if (RR) {
      const n = RR.rowLabels.length + (FF && FF.rowLabels.length > 0 ? FF.rowLabels.length : 0);
      const m = RR.colLabels.length + (FF && FF.rowLabels.length > 0 ? FF.colLabels.length : 0);
      table(n, m);
    }
    const PR = vector('P_R');
    const uR = vector('u_R');
    if (PR && uR) {
      const PF = vector('P_F');
      table(PR.labels.length + (PF && PF.labels.length > 0 ? PF.labels.length : 0), 2);
    }
    return { tables, largest, values };
  }
  let group: VectorBlock[] | null = null;
  const closeGroup = () => {
    if (group && group[0].labels.length > 0) table(group[0].labels.length, group.length);
    group = null;
  };
  for (const b of step.blocks as readonly Block[]) {
    if (b.type === 'vector') {
      const last: VectorBlock | undefined = group?.[0];
      if (group && last && last.labels.join(',') === b.labels.join(',') && last.tag === b.tag && kindOfVector(last.name) === kindOfVector(b.name)) group.push(b);
      else {
        closeGroup();
        group = [b];
      }
      continue;
    }
    closeGroup();
    if (b.type === 'scalar') values += 1;
    else table((b as MatrixBlock).rowLabels.length, (b as MatrixBlock).colLabels.length);
  }
  closeGroup();
  return { tables, largest, values };
}

/** The sentence that says what a card holds, for the room kept for its tables: "This step holds 2 tables (the largest 36 × 36) and 3 values."; '' for a card with neither. */
export function holdsLine(w: Pick<StiffnessUi, 'solution' | 'matrix' | 'words'>, h: Holds): string {
  const parts: string[] = [];
  if (h.tables > 0 && h.largest) {
    const size = fill(w.matrix.size, h.largest);
    parts.push(h.tables === 1 ? fill(w.solution.holdsTable, { size }) : fill(w.solution.holdsTables, { count: h.tables, size }));
  }
  if (h.values > 0) parts.push(fill(w.solution.holdsValues, { count: h.values }));
  return parts.length === 0 ? '' : fill(w.solution.holds, { what: parts.join(` ${w.words.and} `) });
}

/* ── A card that is not drawn is re-written only when its words change ──── */

/** What a card writes of itself when its tables are not drawn: its number, its title, its explanation and its formulas. */
export interface CardWords {
  label: string;
  title: string;
  paragraphs: readonly string[];
  formulas: readonly string[];
}
const sameList = (a: readonly string[], b: readonly string[]): boolean => a.length === b.length && a.every((x, k) => x === b[k]);
export const sameWords = (a: CardWords, b: CardWords): boolean => a.label === b.label && a.title === b.title && sameList(a.paragraphs, b.paragraphs) && sameList(a.formulas, b.formulas);

/** The props of a card that are DATA (a new object each time the structure is solved, whatever changed in it); every other prop is a stable thing, compared by identity. */
const DATA_KEYS = ['view', 'step', 'ctx', 'form', 'zeros'] as const;
export interface SameCardProps {
  view: CardWords;
  step: unknown;
  ctx: unknown;
  form: unknown;
  zeros: unknown;
  open: boolean;
  near: boolean;
  [key: string]: unknown;
}

/**
 * Whether a card is the same as it was and need not be written again. A card that DRAWS its tables (open and near the screen) is the same when none of its data
 * changed. A card that does not - closed, or open and far away - writes only its heading and its words, and a number typed into the form changes the words of
 * few of them: the others are left as they are, which is what makes a keystroke on a structure of a hundred and thirty steps cost what it costs on one of twenty.
 * (A card that comes near is written again at once, with the data of the moment: `near` is one of the things compared.)
 */
export function sameCard(a: SameCardProps, b: SameCardProps): boolean {
  for (const k of new Set([...Object.keys(a), ...Object.keys(b)])) {
    if ((DATA_KEYS as readonly string[]).includes(k)) continue;
    if (a[k] !== b[k]) return false;
  }
  if (a.open && a.near) return DATA_KEYS.every((k) => a[k] === b[k]);
  return sameWords(a.view, b.view);
}

/* ── Which analysis the solution is of ─────────────────────────────────── */

/**
 * The analysis the worked solution is written from. On screen it is the DEFERRED one (the solution is the heaviest thing on the page, and is drawn in a render of
 * its own after the answer); on paper it is the one just solved - a deferred value is the one before until its own render, and a sheet is never printed with the
 * numbers of the structure before. `behind` says whether what is on screen is still of the structure a moment ago.
 */
export function solutionOf<T>(o: { fresh: T; deferred: T; onPaper: boolean }): { analysis: T; behind: boolean } {
  return o.onPaper ? { analysis: o.fresh, behind: false } : { analysis: o.deferred, behind: o.deferred !== o.fresh };
}
