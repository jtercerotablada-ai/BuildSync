// Semi-gravity wall solver — cantilever envelope with light vertical
// reinforcement only. Stability and ACI checks are identical to a cantilever
// wall; the wall just relies primarily on its own weight for stability and
// the rebar is sized to the §24.4.3 temperature/shrinkage minimum (which
// the cantilever solver already returns as As_min).
//
// Use cases: short walls (H ≤ 1.5 m), where the bending demand is low and
// the As_min controls the steel design naturally. Picking 'semi-gravity'
// over 'cantilever' is a documentation choice — the print report flags
// the wall as semi-gravity and emphasizes that flexure should be verified
// by hand for non-trivial heights.
//
// References:
//   • ACI 318-25 SI §13.3 (foundation design) + §24.4.3 (temperature steel)
//   • Wight & MacGregor 7e §18-3.2 (semi-gravity walls)

import type { WallInput, WallResults } from './types';
import { solveCantileverWall } from './solve';

export function solveSemiGravity(input: WallInput): WallResults {
  if (input.geometry.kind !== 'semi-gravity') {
    throw new Error("solveSemiGravity called with non-semi-gravity geometry");
  }
  const result = solveCantileverWall(input);
  // Surface the semi-gravity intent so downstream UI/print reports can render
  // a different label. Keep the cantilever-solver math identical.
  result.issues.unshift(
    'Semi-gravity wall — rebar values shown represent the cantilever-equivalent demand. Use the As_min value (ACI 318-25 §24.4.3) for short walls where flexure is negligible; verify the assumption by hand for taller walls.',
  );
  return result;
}
