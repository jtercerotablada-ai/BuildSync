// Top-level cantilever-wall solver: stability + reinforcement design.
//
// BuildSync supports cantilever retaining walls only. Calls the shared
// stability + design functions and aggregates errors / warnings for the UI.

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
    issues.push(`Stem rebar spacing ${stem.crack.s_req.toFixed(0)} > s_max ${stem.crack.s_max.toFixed(0)} mm — crack control (ACI 318-25 §24.3.2)`);
  if (!heel.crack.ok)
    issues.push(`Heel rebar spacing exceeds ACI 318-25 §24.3.2`);
  if (!toe.crack.ok)
    issues.push(`Toe rebar spacing exceeds ACI 318-25 §24.3.2`);

  // ──────── ACI 318-25 §13.3.1.2 — overall depth such that d ≥ 150 mm ────────
  // Effective depth of bottom reinforcement in shallow foundations must be at
  // least 150 mm. We check the heel and toe (they share the same H_foot).
  const d_provided = input.geometry.H_foot - input.concrete.cover - 12; // mm; assumes #4 bar
  if (d_provided < 150) {
    errors.push(
      `Footing effective depth d=${d_provided.toFixed(0)} mm < 150 mm minimum (ACI 318-25 §13.3.1.2). Increase H_foot or reduce cover.`,
    );
  }

  // ──────── §11.6.1 + §11.7.3.1 — Horizontal stem reinforcement ────────
  // Cantilever retaining-wall stem is designed as a one-way slab (§13.3.6.1)
  // for flexure (vertical bars). Perpendicular to the flexural reinforcement,
  // horizontal distribution / shrinkage steel is required per §11.6.1
  // Table 11.6.1: ρt ≥ 0.0020 (deformed bars ≤ #16, fy = 420 MPa) for cast-
  // in-place walls, with maximum spacing per §11.7.3.1: s ≤ min(3·h, 450 mm).
  const rho_t_min = 0.0020;
  const As_horiz = rho_t_min * 1000 * input.geometry.t_stem_bot; // mm²/m (per metre of stem height)
  const s_max_horiz = Math.min(3 * input.geometry.t_stem_bot, 450);
  stem.horizontalReinforcement = {
    rho_t_min,
    As_horizontal_per_m: As_horiz,
    s_max: s_max_horiz,
  };

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
  drainage: {
    enabled: true,
    gravelThickness: 300,
    pipeDiameter: 100,
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
 * Returns the default cantilever geometry, preserving the common cross-section
 * fields from `prev` when provided. Kept for backwards compatibility with the
 * calculator's reset-to-defaults flow; previously used by WallTypeChooser
 * which is no longer present.
 */
export function defaultGeometryFor(_kind: WallKind, prev?: WallGeometry): WallGeometry {
  const base = prev ?? DEFAULT_INPUT.geometry;
  return {
    kind: 'cantilever',
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
}
