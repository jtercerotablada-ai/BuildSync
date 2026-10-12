/**
 * THE CALCULATORS' SHELL — what every results table asks of a value before
 * it prints it. (What the shell is, and a calculator built on it: index.ts.)
 *
 * No React here, and no words: a calculator settles its values with these
 * ONCE, where it has them, and every table, drawing and summary for a screen
 * reader then reads the settled ones — so they cannot say different things.
 *
 * The FLOOR is the calculator's to give, measured against the size of its
 * problem (a billionth of the loads; a millionth of the largest reaction),
 * never against the value itself: a shear that is zero everywhere has nothing
 * of its own to be measured against. (BeamCalculator.tsx, `noise`, says which
 * floor is for which number.)
 */

/** A value that is rounding, not a result, is zero. */
export const settle = (value: number, floor: number) => (Math.abs(value) <= floor ? 0 : value);

/** A largest value and where it occurs — or zero, nowhere, when it is rounding. */
export type Peak = { value: number; x: number | null };
export const peak = (p: { value: number; x: number }, floor: number): Peak => (Math.abs(p.value) <= floor ? { value: 0, x: null } : p);
/** Of two peaks, the one further from zero — the first when they are as far. */
export const larger = (p: Peak, q: Peak) => (Math.abs(p.value) >= Math.abs(q.value) ? p : q);

/** The word for which way a value points: `down` below zero, `up` otherwise. A zero has no way: the caller prints no word for one. */
export const arrow = (v: number, up: string, down: string) => (v < 0 ? down : up);

/** Whether a response read on the left of a point and on its right is two values — a jump there — and not one with its rounding. */
export const two = (l: number, r: number) => Math.abs(l - r) > 1e-9 * Math.max(1, Math.abs(l), Math.abs(r));
