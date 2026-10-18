import type { StiffnessList, SupportRow } from '@/lib/calc/stiffness/model';
import type { StiffnessUi } from '@/lib/calc/stiffness/strings';
import { fill } from './text';

/**
 * THE SMALL RULES OF THE ROWS, as functions (no React): when a support's settlement fields are on screen, and what an edit does to the
 * set of supports whose fields were opened.
 *
 * A support's settlement fields are shown while there is a settlement (a value that is not 0 on a movement the support holds: the row
 * cannot hide what moves the structure) and while the visitor has opened them. They were shown ONLY while there was one - so typing a "0",
 * the first character of "0.25" or of "-0.1", closed the row under the cursor, dropped the focus and lost what came next. A settlement
 * being typed keeps the row open until the visitor closes it.
 */

/** The fields of a support that hold a settlement. */
export const SETTLEMENT_FIELDS = ['dx', 'dy', 'dr'] as const;

/** Whether the support moves anything: a settlement that is not 0 on a movement it holds (a rotation only in a frame). */
export const settles = (s: Pick<SupportRow, 'ux' | 'uy' | 'rz' | 'dx' | 'dy' | 'dr'>, frame: boolean): boolean => (s.ux && s.dx !== 0) || (s.uy && s.dy !== 0) || (frame && s.rz && s.dr !== 0);

/** Whether the settlement fields of a support are shown, and whether they are shown because they must be (a settlement: no button to hide them). */
export function settlementOpen(more: ReadonlySet<number>, s: Pick<SupportRow, 'id' | 'ux' | 'uy' | 'rz' | 'dx' | 'dy' | 'dr'>, frame: boolean): { open: boolean; forced: boolean } {
  const forced = settles(s, frame);
  return { open: more.has(s.id) || forced, forced };
}

/** The supports whose fields are open after an edit: the same set, and the support too when what was typed is a settlement. */
export function keepOpen(more: ReadonlySet<number>, list: StiffnessList, id: number, patch: Record<string, unknown>): ReadonlySet<number> {
  if (list !== 'supports' || more.has(id) || !SETTLEMENT_FIELDS.some((f) => f in patch)) return more;
  return new Set(more).add(id);
}

/** The line that says a steel shape was put into a section: the structure's (members without their own), or one member's - each its own sentence, so that the noun has its article in both languages. */
export const filledLine = (w: Pick<StiffnessUi, 'section'>, shape: string, target: 'structure' | number): string =>
  target === 'structure' ? fill(w.section.filledStructure, { shape }) : fill(w.section.filledMember, { shape, member: target });
