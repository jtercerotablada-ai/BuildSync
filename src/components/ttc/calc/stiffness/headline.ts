import type { SupportReaction } from '@/lib/calc/stiffness/analysis';

/**
 * THE LARGEST REACTION, as the drawing shows it. The drawing writes a reaction as arrows, one for each force component a support holds (Rx, Ry) and a ring for its
 * moment, each with its own size. The largest reaction a headline quotes must be one of those numbers, with the arrow it is on named - not the resultant of two of
 * them (5.34 kip for a support that pushes 5 and 1.875), which is on no arrow and which a reader takes for a shear. WHICH number it is - the largest force component
 * that is drawn, else the largest moment - is `largestReaction` (text.ts), the one the sentence under the drawing quotes too; this file adds what the headline says
 * of it besides its size: the name of the component (Rx, Ry, M) and the direction its arrow points, from the sign the table gives it.
 */

export type ReactionDirection = 'right' | 'left' | 'up' | 'down' | 'ccw' | 'cw';

/** The symbol of a component: Rx, Ry, or M for a moment. */
export const reactionSymbol = (kind: 'x' | 'y' | 'm'): 'Rx' | 'Ry' | 'M' => (kind === 'x' ? 'Rx' : kind === 'y' ? 'Ry' : 'M');

/**
 * The direction a reaction component acts in, from the sign of the table (a force positive along +x or +y, a moment positive counter-clockwise); null when the
 * support is not in the table or the component is zero or not held.
 */
export function reactionDirection(reactions: readonly SupportReaction[], c: { node: number; kind: 'x' | 'y' | 'm' }): ReactionDirection | null {
  const valueOf = (r: SupportReaction): number => (c.kind === 'x' ? r.rx : c.kind === 'y' ? r.ry : r.rm) ?? 0;
  const r = reactions.find((x) => x.node === c.node && Math.abs(valueOf(x)) > 0);
  if (!r) return null;
  const v = valueOf(r);
  if (c.kind === 'x') return v > 0 ? 'right' : 'left';
  if (c.kind === 'y') return v > 0 ? 'up' : 'down';
  return v > 0 ? 'ccw' : 'cw';
}
