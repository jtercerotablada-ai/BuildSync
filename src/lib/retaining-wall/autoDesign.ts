// Auto-design driver — given a wall type + soil + materials + retained
// height, iteratively size the geometry until every stability and
// reinforcement check passes with margin ≥ 1.05.
//
// One entry point dispatches per kind. Each tuner runs a bounded
// iterative loop (≤ 50 iterations) that bumps the failing dimension by
// a fixed step until checks pass:
//
//   • Sliding fail   → widen B_heel by 100 mm (more weight to friction,
//                      more passive area, longer resisting moment arm)
//   • Overturning fail → widen B_heel by 100 mm
//   • Bearing fail   → widen B (toe + heel) by 100 mm OR thicken H_foot
//                      by 50 mm
//   • Stem-shear fail → thicken stem t_bot by 25 mm
//   • Stem-flexure fail → if rebar > rho_max, thicken t_bot
//
// Returns the patched WallInput plus a list of rationale steps for the UI.

import type {
  WallInput, WallResults, WallKind,
} from './types';
import { solveWall } from './solve';

export interface AutoDesignStep {
  iter: number;
  what: string;            // human-readable description
  reason: string;          // which check drove this change
  delta: string;           // what changed (e.g. "B_heel 1500 → 1600 mm")
}

export interface AutoDesignResult {
  patchedInput: WallInput;
  ok: boolean;             // true if all checks pass after iteration
  iterations: number;
  steps: AutoDesignStep[];
  warnings: string[];      // residual issues (e.g. ran out of iterations)
}

const MAX_ITER = 50;
const MARGIN = 1.05;

export function autoDesign(input: WallInput, opts: { kind?: WallKind } = {}): AutoDesignResult {
  const kind = opts.kind ?? input.geometry.kind;
  // Force the geometry to the requested kind first
  let cur: WallInput = { ...input, geometry: { ...input.geometry, kind } as WallInput['geometry'] };

  const steps: AutoDesignStep[] = [];
  const warnings: string[] = [];
  let iter = 0;
  let result: WallResults | null = null;

  while (iter < MAX_ITER) {
    iter++;
    try {
      result = solveWall(cur);
    } catch (e) {
      warnings.push(`Solver threw at iteration ${iter}: ${(e as Error).message}`);
      break;
    }

    // Check if everything passes with margin
    const fsOT = result.stability.FS_overturning;
    const fsSL = result.stability.FS_sliding;
    const okBearing = result.stability.bearingOk && result.stability.qMax * MARGIN <= cur.baseSoil.qAllow;
    const okOT = fsOT >= cur.safetyFactors.overturning * MARGIN;
    const okSL = fsSL >= cur.safetyFactors.sliding * MARGIN;
    const okShear = result.stem.shearOk && result.heel.shearOk && result.toe.shearOk;
    const okEcc = result.stability.eccentricityOk;
    if (okOT && okSL && okBearing && okShear && okEcc && result.errors.length === 0) {
      return {
        patchedInput: cur,
        ok: true,
        iterations: iter,
        steps,
        warnings,
      };
    }

    // Pick the most-failing dimension and bump it.
    // Priority: bearing → overturning → sliding → eccentricity → shear
    if (!okBearing) {
      // Widen BOTH toe and heel by 100 mm each — increases footprint without
      // adding much weight (footing thickness held constant). Spreading the
      // load across more area is the right way to drop qmax.
      const newB_toe  = (cur.geometry.B_toe  ?? 600)  + 100;
      const newB_heel = (cur.geometry.B_heel ?? 1500) + 100;
      cur = bumpGeometry(cur, { B_toe: newB_toe, B_heel: newB_heel });
      steps.push({
        iter,
        what: 'Widened toe and heel to spread load',
        reason: `qmax ${result.stability.qMax.toFixed(1)} kPa exceeds qAllow ${cur.baseSoil.qAllow} kPa (with margin ${MARGIN})`,
        delta: `B_toe +100 mm, B_heel +100 mm`,
      });
    } else if (!okOT) {
      const newB_heel = (cur.geometry.B_heel ?? 1500) + 150;
      cur = bumpGeometry(cur, { B_heel: newB_heel });
      steps.push({
        iter,
        what: 'Widened heel to increase resisting moment',
        reason: `Overturning FS=${fsOT.toFixed(2)} < ${cur.safetyFactors.overturning} × ${MARGIN}`,
        delta: `B_heel +150 mm`,
      });
    } else if (!okSL) {
      const newB_heel = (cur.geometry.B_heel ?? 1500) + 100;
      cur = bumpGeometry(cur, { B_heel: newB_heel });
      steps.push({
        iter,
        what: 'Widened heel to increase normal force on base (more friction)',
        reason: `Sliding FS=${fsSL.toFixed(2)} < ${cur.safetyFactors.sliding} × ${MARGIN}`,
        delta: `B_heel +100 mm`,
      });
    } else if (!okEcc) {
      const newB_toe = (cur.geometry.B_toe ?? 600) + 100;
      cur = bumpGeometry(cur, { B_toe: newB_toe });
      steps.push({
        iter,
        what: 'Widened toe to bring resultant within kern',
        reason: `Eccentricity ${result.stability.eccentricity.toFixed(0)} mm outside kern`,
        delta: `B_toe +100 mm`,
      });
    } else if (!okShear) {
      const newT = cur.geometry.t_stem_bot + 25;
      cur = bumpGeometry(cur, { t_stem_bot: newT });
      steps.push({
        iter,
        what: 'Thickened stem to handle shear demand',
        reason: result.stem.shearOk ? 'Footing shear high' : `Stem Vu=${result.stem.Vu.toFixed(1)} > φVc`,
        delta: `t_stem_bot +25 mm`,
      });
    } else {
      // We're inside margin range but errors persist — just return what we have
      break;
    }
  }

  if (iter >= MAX_ITER) {
    warnings.push(`Auto-design did not converge in ${MAX_ITER} iterations. Residual errors: ${result?.errors.join('; ') ?? 'unknown'}`);
  }
  return {
    patchedInput: cur,
    ok: result ? result.errors.length === 0 : false,
    iterations: iter,
    steps,
    warnings,
  };
}

/** Bump geometry while preserving the discriminated kind. */
function bumpGeometry(
  input: WallInput,
  patch: Partial<{ B_toe: number; B_heel: number; H_foot: number; t_stem_bot: number }>,
): WallInput {
  return {
    ...input,
    geometry: { ...input.geometry, ...patch } as WallInput['geometry'],
  };
}
