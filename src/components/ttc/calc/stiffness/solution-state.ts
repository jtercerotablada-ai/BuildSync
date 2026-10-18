import type { StiffnessAnalysis } from '@/lib/calc/stiffness/analysis';
import type { UnitSystem } from '@/lib/calc/stiffness/model';
import type { Step, StepId } from '@/lib/calc/stiffness/types';
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
  /** The card the reader was last taken to (Previous, Next, the outline, the menu). */
  current: string | null;
  /** What the last press of Expand all or Collapse all did, for the line that tells it. */
  said: 'expanded' | 'collapsed' | null;
}

export const FRESH: OpenState = { mode: 'auto', toggled: {}, current: null, said: null };

export type OpenAction =
  | { type: 'expand' }
  | { type: 'collapse' }
  | { type: 'toggle'; key: string; wasOpen: boolean }
  | { type: 'go'; key: string }
  | { type: 'reset' };

export function openReducer(state: OpenState, action: OpenAction): OpenState {
  switch (action.type) {
    case 'expand':
      return { ...state, mode: 'all', toggled: {}, said: 'expanded' };
    case 'collapse':
      return { ...state, mode: 'none', toggled: {}, said: 'collapsed' };
    case 'toggle':
      return { ...state, toggled: { ...state.toggled, [action.key]: !action.wasOpen }, said: null };
    case 'go':
      return { ...state, current: action.key, toggled: { ...state.toggled, [action.key]: true }, said: null };
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
