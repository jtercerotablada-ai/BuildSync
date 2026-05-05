// Top-level orchestrator: stability + reinforcement design.

import type { WallInput, WallResults, WallGeometry, WallKind } from './types';
import { computeStability } from './stability';
import { designStem, designHeel, designToe, designKey } from './design';

export function solveWall(input: WallInput): WallResults {
  const { stability, pressure } = computeStability(input);

  // Average bearing pressure under heel and toe (linear interpolation from q_max/q_min)
  const B = stability.B; // mm
  const { qMax, qMin, eccentricity: e } = stability;
  const xToeStart = 0;
  const xToeEnd = input.geometry.B_toe;
  const xHeelStart = input.geometry.B_toe + input.geometry.t_stem_bot;
  const xHeelEnd = B;

  // q(x) = qmax · (1 − x·(qmax−qmin)/(qmax·B))  — linear from qmax at toe (x=0)
  // to qmin at heel (x=B). Handles trapezoidal (|e|≤B/6) case.
  const q_at = (x: number): number => {
    if (Math.abs(e) <= B / 6) {
      const frac = x / B;
      return qMax - (qMax - qMin) * frac;
    }
    // Triangular: pressure only acts over Lc from toe
    const Lc = 3 * (B / 2 - Math.abs(e));
    if (e > 0 /* resultant shifted toward toe */ && x > Lc) return 0;
    if (x > Lc) return 0;
    return qMax * (1 - x / Lc);
  };

  const q_toe_avg = (q_at(xToeStart) + q_at(xToeEnd)) / 2;
  const q_heel_avg = (q_at(xHeelStart) + q_at(xHeelEnd)) / 2;

  const stem = designStem(input);
  const heel = designHeel(input, q_heel_avg);
  const toe = designToe(input, q_toe_avg);
  const key = designKey(input);

  // Diagnostics
  const issues: string[] = [];
  const errors: string[] = [];
  if (!stability.overturningOk)
    errors.push(
      `Overturning FS=${stability.FS_overturning.toFixed(2)} < ${input.safetyFactors.overturning}`
    );
  if (!stability.slidingOk)
    errors.push(
      `Sliding FS=${stability.FS_sliding.toFixed(2)} < ${input.safetyFactors.sliding} — consider a shear key or widen footing`
    );
  if (!stability.bearingOk) {
    if (!isFinite(stability.qMax)) {
      errors.push(
        `Bearing FAIL — resultant falls outside the footing (e=${stability.eccentricity.toFixed(0)} mm, B/2=${(stability.B / 2).toFixed(0)} mm). Wall physically overturns. Widen footing.`
      );
    } else {
      errors.push(
        `Bearing qmax=${stability.qMax.toFixed(0)} kPa > qAllow=${input.baseSoil.qAllow} kPa`
      );
    }
  }
  if (!stability.eccentricityOk) {
    const lim = input.safetyFactors.eccentricity === 'kern' ? 'B/6' : 'B/3';
    issues.push(
      `Eccentricity e=${stability.eccentricity.toFixed(0)} mm outside ${lim} — heel lifts off soil`
    );
  }
  if (!stem.shearOk)
    errors.push(`Stem shear Vu=${stem.Vu.toFixed(1)} exceeds φVc=${(0.75 * stem.Vc).toFixed(1)} kN/m`);
  if (!heel.shearOk)
    errors.push(`Heel shear Vu=${heel.Vu.toFixed(1)} exceeds φVc=${(0.75 * heel.Vc).toFixed(1)} kN/m`);
  if (!toe.shearOk)
    errors.push(`Toe shear Vu=${toe.Vu.toFixed(1)} exceeds φVc=${(0.75 * toe.Vc).toFixed(1)} kN/m`);
  if (key.enabled && !key.shearOk)
    errors.push(`Key shear Vu=${key.Vu.toFixed(1)} exceeds φVc=${(0.75 * key.Vc).toFixed(1)} kN/m`);
  if (!stem.crack.ok)
    issues.push(`Stem rebar spacing ${stem.crack.s_req.toFixed(0)} > s_max ${stem.crack.s_max.toFixed(0)} mm — crack control`);
  if (!heel.crack.ok)
    issues.push(`Heel rebar spacing exceeds ACI §24.3.2`);
  if (!toe.crack.ok)
    issues.push(`Toe rebar spacing exceeds ACI §24.3.2`);

  return {
    pressure,
    stability,
    stem,
    heel,
    toe,
    key,
    issues,
    errors,
  };
}

export const DEFAULT_INPUT: WallInput = {
  code: 'ACI 318-25',
  geometry: {
    kind: 'cantilever',
    H_stem: 3000,
    t_stem_top: 250,
    t_stem_bot: 400,
    B_toe: 900,
    B_heel: 1500,
    H_foot: 500,
    backfillSlope: 0,
    frontFill: 300,
  },
  concrete: {
    fc: 28,
    fy: 420,
    Es: 200_000,
    gamma: 24,
    cover: 75,
  },
  backfill: [
    {
      name: 'Granular backfill',
      gamma: 19,
      phi: (32 * Math.PI) / 180,
      c: 0,
      thickness: 0, // extend to bottom
    },
  ],
  baseSoil: {
    gamma: 19,
    phi: (30 * Math.PI) / 180,
    c: 0,
    delta: (20 * Math.PI) / 180, // ~(2/3)·φ
    ca: 0,
    qAllow: 200,
    // Conservative default: do NOT rely on passive pressure unless the user
    // confirms the front soil will remain in place (no future excavation,
    // frost line clearance, etc.).
    passiveEnabled: false,
  },
  water: {
    enabled: false,
    depthFromStemTop: 0,
    gammaW: 9.81,
  },
  loads: {
    surchargeQ: 10,
    seismic: { kh: 0, kv: 0 },
  },
  theory: 'rankine',
  safetyFactors: {
    overturning: 2.0,
    sliding: 1.5,
    bearing: 3.0,
    eccentricity: 'kern',
  },
};

/**
 * Build a complete `WallGeometry` for a given kind, preserving the common
 * cross-section fields from the previous geometry where possible. Used by
 * the calculator UI when the user changes wall type via WallTypeChooser.
 *
 * For l-shaped walls, B_toe is forced to 0. For abutments, the code is
 * automatically switched to AASHTO LRFD by the caller.
 */
export function defaultGeometryFor(kind: WallKind, prev?: WallGeometry): WallGeometry {
  // Common base — pulled from prev if available, else from DEFAULT_INPUT
  const base = prev ?? DEFAULT_INPUT.geometry;
  const common = {
    H_stem: base.H_stem,
    t_stem_top: base.t_stem_top,
    t_stem_bot: base.t_stem_bot,
    B_toe: base.B_toe,
    B_heel: base.B_heel,
    H_foot: base.H_foot,
    backfillSlope: base.backfillSlope,
    frontFill: base.frontFill,
    key: base.key,
  };
  switch (kind) {
    case 'cantilever':
      return { kind: 'cantilever', ...common };
    case 'gravity':
      return { kind: 'gravity', ...common, batterFront: 0, batterBack: 0 };
    case 'semi-gravity':
      return { kind: 'semi-gravity', ...common };
    case 'l-shaped':
      return { kind: 'l-shaped', ...common, B_toe: 0, stemLean: 0 };
    case 'counterfort':
      return { kind: 'counterfort', ...common, counterfortSpacing: 3000, counterfortThickness: 300 };
    case 'buttressed':
      return { kind: 'buttressed', ...common, buttressSpacing: 3000, buttressThickness: 300 };
    case 'basement':
      return { kind: 'basement', ...common, topElevation: common.H_stem, topFixity: 'pinned' };
    case 'abutment':
      return {
        kind: 'abutment', ...common,
        bridgeSeat: { width: 600, deadLoad: 250, liveLoad: 150 },
        backwall: { H: 1500, t: 300 },
        wingWall: undefined,
      };
  }
}
