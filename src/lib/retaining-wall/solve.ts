// Top-level orchestrator: stability + reinforcement design.

import type { WallInput, WallResults } from './types';
import { computeStability } from './stability';
import { designStem, designHeel, designToe } from './design';

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
  if (!stability.bearingOk)
    errors.push(
      `Bearing qmax=${stability.qMax.toFixed(0)} kPa > qAllow=${input.baseSoil.qAllow} kPa`
    );
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

  return {
    pressure,
    stability,
    stem,
    heel,
    toe,
    issues,
    errors,
  };
}

export const DEFAULT_INPUT: WallInput = {
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
    passiveEnabled: true,
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
