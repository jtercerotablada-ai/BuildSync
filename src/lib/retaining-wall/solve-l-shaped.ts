// L-shaped wall solver — cantilever wall with B_toe = 0 (heel only).
//
// Used in dense urban / shallow-footing conditions where the toe cannot
// project forward of the property line. The stem still cantilevers from
// the footing — the rear face works the same as a cantilever wall — but
// without a toe to provide bearing pressure resistance in front of the
// stem, the bearing pressure distribution shifts: more soil pressure is
// developed under the heel, and overturning resistance comes mainly from
// the heel + backfill weight.
//
// Optionally the stem may lean forward (`stemLean` > 0); the lean adds a
// secondary effect on overturning that this solver acknowledges as a
// note for hand-check verification. The lean is purely geometric here;
// the rear-face active-pressure integration is unchanged.
//
// References:
//   • ACI 318-25 SI §13.3 (foundation design)
//   • Wight & MacGregor 7e §17.2 (cantilever wall variants — L-shaped)

import type { WallInput, WallResults, LShapedGeometry } from './types';
import { solveCantileverWall } from './solve';

export function solveLShaped(input: WallInput): WallResults {
  if (input.geometry.kind !== 'l-shaped') {
    throw new Error("solveLShaped called with non-l-shaped geometry");
  }
  const g = input.geometry as LShapedGeometry;

  // The cantilever solver handles B_toe = 0 gracefully (toe slab gets
  // zero moment + zero shear because its lever arm is zero).
  const result = solveCantileverWall(input);

  // Toe results are mathematically zero; surface that the toe slab is
  // intentionally absent rather than a missed check.
  result.toe = {
    ...result.toe,
    Mu: 0, Vu: 0, As_req: 0,
  };

  result.issues.unshift(
    "L-shaped wall — no toe slab (B_toe = 0). Bearing pressure distribution is more eccentric than a typical cantilever wall; ensure the resultant stays within the kern (B/6) by widening the heel if the eccentricity check fails.",
  );

  if (g.stemLean !== 0) {
    const leanDeg = (g.stemLean * 180) / Math.PI;
    result.issues.push(
      `L-shaped stem leans ${leanDeg.toFixed(1)}° forward — the lean adds a secondary stabilising moment from stem self-weight (currently ignored in the solver; verify by hand for ≥ 5° lean).`,
    );
  }

  return result;
}
