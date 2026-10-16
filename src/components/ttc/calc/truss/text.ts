import type { AnalysisIssue } from '@/lib/calc/truss/analysis';
import type { TrussUi } from '@/lib/calc/truss/strings';

/**
 * The little text machinery of the truss calculator's sentences. No React, no
 * words of its own (a calculator's words are a prop: lib/calc/truss/strings.ts).
 *
 *   fill      a sentence with holes: `{count}` is the number, and
 *             `{count|motion|motions}` is the first word when it is 1 and the
 *             second otherwise. One pass over the sentence, so that nothing
 *             typed into a hole is taken for another hole.
 *   listOf    numbers as a reader writes them: 1–4, 6 and 9–11. A run of three
 *             or more in a row is a range; two are two numbers.
 *   nodesOf   the same with the word for them in front, in the singular for one:
 *             "node 3", "nodes 3 and 4" — or, in Spanish, "el nudo 3", "los nudos 3 y 4".
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

/** A force as the tables write it: always with its sign, a true minus, and a zero with none. */
export function signed(text: string, value: number): string {
  return value === 0 || text === '0' ? '0' : `${value > 0 ? '+' : '−'}${text}`;
}

/**
 * The sentence for one problem the analysis reports: its code's line in the
 * words given, with the numbers the code carries put in its holes. Nothing in
 * the sentence is left as a `{hole}`: a number the code does not carry is the
 * sentence's own fault and is written as 0 (never printed for a real code).
 */
export function issueSentence(issue: AnalysisIssue, w: TrussUi): string {
  const vars: Record<string, string | number> = {};
  if (issue.count !== undefined) vars.count = issue.count;
  if (issue.max !== undefined) vars.max = issue.max;
  if (issue.list) vars.list = w.lists[issue.list];
  const field = issue.row?.field;
  if (issue.code === 'number' || issue.code === 'section') vars.field = w.fields[(field ?? 'x') as keyof TrussUi['fields']] ?? w.fields.x;
  const pair = issue.nodes ?? issue.members ?? [];
  vars.a = pair[0] ?? 0;
  vars.b = pair[1] ?? 0;
  vars.count ??= 0;
  vars.max ??= 0;
  if (issue.code === 'disconnected') vars.groups = (issue.groups ?? []).map((g) => `${w.words.nodes} ${listOf(g, w.words.and)}`).join('; ');
  if (issue.code === 'mechanism') vars.nodes = nodesOf(issue.nodes ?? [], w.words);
  return fill(w.issues[issue.code], vars);
}

/** The orders the table of member forces can be read in. */
export type Order = 'member' | 'largest' | 'tension';

/** The members in an order, the member number breaking every tie: by number; by size of force, largest first; by force, tension first. A new list. */
export function sortMembers<T extends { label: number; force: number }>(members: readonly T[], order: Order): T[] {
  const list = [...members];
  const byLabel = (p: T, q: T) => p.label - q.label;
  // Two forces that print alike are a tie, whatever the last bit of each was.
  const by = (p: number, q: number) => (Math.abs(p - q) <= 1e-9 * Math.max(Math.abs(p), Math.abs(q)) ? 0 : p - q);
  if (order === 'largest') return list.sort((p, q) => by(Math.abs(q.force), Math.abs(p.force)) || byLabel(p, q));
  if (order === 'tension') return list.sort((p, q) => by(q.force, p.force) || byLabel(p, q));
  return list.sort(byLabel);
}
