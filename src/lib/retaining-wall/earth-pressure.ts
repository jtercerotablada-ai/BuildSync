// Lateral earth pressure coefficients and force integrations.
//
// Rankine (1857) — valid for vertical wall back, cohesionless or c-φ soil,
// no wall friction. Active case:
//   Ka = (cos β − √(cos²β − cos²φ)) / (cos β + √(cos²β − cos²φ)) · cos β
//   Passive: Kp = 1/Ka (symmetric for level backfill)
//
// Coulomb (1776) — accounts for wall friction δ and wall back inclination α.
//   Ka = sin²(α+φ) / { sin²α · sin(α−δ) · [1 + √(sin(φ+δ)·sin(φ−β) / (sin(α−δ)·sin(α+β)))]² }
// For vertical wall α = 90°, level backfill β = 0, this reduces to Rankine
// with δ=0.
//
// Surcharge (uniform q, kPa): acts as an equivalent soil layer of height
//   h_eq = q/γ; produces a rectangular pressure diagram of intensity Ka·q.
// Water (hydrostatic below the water table): σw(y) = γw · y, independent of K.
// Seismic: Mononobe-Okabe adds ΔPae to static active thrust.

import type { SoilLayer, WaterTable, WallLoads } from './types';

export function kaRankine(phi: number, beta: number): number {
  const cosB = Math.cos(beta);
  const cosP = Math.cos(phi);
  const disc = cosB * cosB - cosP * cosP;
  if (disc < 0) return 0; // backfill slope steeper than φ: Ka undefined
  const sqrtTerm = Math.sqrt(disc);
  return cosB * ((cosB - sqrtTerm) / (cosB + sqrtTerm));
}

export function kpRankine(phi: number, beta: number): number {
  const cosB = Math.cos(beta);
  const cosP = Math.cos(phi);
  const disc = cosB * cosB - cosP * cosP;
  if (disc < 0) return 0;
  const sqrtTerm = Math.sqrt(disc);
  return cosB * ((cosB + sqrtTerm) / (cosB - sqrtTerm));
}

/**
 * Coulomb active coefficient (per Das, Principles of Foundation Engineering).
 *   α = wall-back inclination from horizontal (90° for vertical back)
 *   β = backfill slope from horizontal
 *   φ = soil friction
 *   δ = wall-soil friction angle
 * All in radians.
 */
export function kaCoulomb(phi: number, beta: number, delta: number, alpha = Math.PI / 2): number {
  const s1 = Math.sin(alpha + phi);
  const s2 = Math.sin(alpha);
  const s3 = Math.sin(alpha - delta);
  const num = s1 * s1;
  // Second factor: [1 + √( sin(φ+δ)·sin(φ−β) / (sin(α−δ)·sin(α+β)) ) ]²
  const inner =
    (Math.sin(phi + delta) * Math.sin(phi - beta)) /
    Math.max(s3 * Math.sin(alpha + beta), 1e-9);
  const innerClamped = Math.max(inner, 0);
  const second = Math.pow(1 + Math.sqrt(innerClamped), 2);
  const denom = s2 * s2 * s3 * second;
  if (denom <= 0) return 0;
  return num / denom;
}

export function kpCoulomb(phi: number, beta: number, delta: number, alpha = Math.PI / 2): number {
  const s1 = Math.sin(alpha - phi);
  const s2 = Math.sin(alpha);
  const s3 = Math.sin(alpha + delta);
  const num = s1 * s1;
  const inner =
    (Math.sin(phi + delta) * Math.sin(phi + beta)) /
    Math.max(s3 * Math.sin(alpha + beta), 1e-9);
  const innerClamped = Math.max(inner, 0);
  const second = Math.pow(1 - Math.sqrt(innerClamped), 2);
  const denom = s2 * s2 * s3 * second;
  if (denom <= 0) return 0;
  return num / denom;
}

/** Effective unit weight of a soil column considering the water table. */
export function effectiveWeight(gamma: number, submerged: boolean, gammaW = 9.81): number {
  return submerged ? Math.max(gamma - gammaW, 0) : gamma;
}

export interface ForceIntegration {
  Pa: number;    // kN/m (horizontal soil thrust)
  Pq: number;    // kN/m (surcharge contribution)
  Pw: number;    // kN/m (water contribution)
  dPae: number;  // kN/m (seismic increment from M-O)
  yBar: number;  // mm above footing top — resultant of total H
  Ka: number;    // effective active coefficient used at base (for display)
}

/**
 * Integrate lateral pressure over the full wall back height H (mm, from top
 * of stem to bottom of footing). Multi-layer soil supported. Water at depth
 * zw (from stem top) adds hydrostatic pressure σ_w = γw·(z−zw).
 *
 * Returns forces in kN/m-of-wall and lever arm yBar measured from footing
 * base (bottom).
 */
export function integrateActivePressure(
  H: number,                    // total height, mm
  backfill: SoilLayer[],
  K: number,                    // active coefficient (Rankine or Coulomb)
  loads: WallLoads,
  water: WaterTable
): ForceIntegration {
  // Discretise the wall in N horizontal strips and integrate numerically.
  const N = 200;
  const dz = H / N;
  let Pa = 0;
  let Ma = 0;

  let gammaAccum = 0;  // accumulated effective vertical stress (kPa)
  let zPrev = 0;

  for (let i = 0; i < N; i++) {
    const z = (i + 0.5) * dz; // mid-strip depth from top of stem
    // Find which layer contains depth z (assume layers listed top → down).
    let remaining = z;
    let layer = backfill[backfill.length - 1];
    for (const L of backfill) {
      const t = L.thickness <= 0 || !isFinite(L.thickness) ? Infinity : L.thickness;
      if (remaining <= t) {
        layer = L;
        break;
      }
      remaining -= t;
    }

    const submerged = water.enabled && z >= water.depthFromStemTop;
    const gammaEff = effectiveWeight(layer.gamma, submerged, water.gammaW);
    // Vertical effective stress σv' at depth z (kPa):
    // accumulate γ·dz along the column; easier to recompute per step.
    // Here we do an incremental update:
    gammaAccum += gammaEff * (dz / 1000); // Δσv in kPa (dz mm → dz/1000 m)
    const sigmaV = gammaAccum;
    const sigmaH = K * sigmaV; // Rankine/Coulomb: σh = K·σv
    const dF = sigmaH * (dz / 1000); // kN/m per strip (kPa × m)
    Pa += dF;
    const y = (H - z) / 1000; // m above footing bottom
    Ma += dF * y;
    zPrev = z;
  }

  // Surcharge q contributes a rectangular pressure K·q applied over H.
  const Pq = K * loads.surchargeQ * (H / 1000);
  const yq = H / 2 / 1000; // centroid at mid-height (m above footing base)
  Ma += Pq * yq;

  // Water: hydrostatic pressure below water table (independent of K).
  let Pw = 0;
  if (water.enabled) {
    const hw = Math.max(0, (H - water.depthFromStemTop) / 1000); // m of water column
    Pw = 0.5 * water.gammaW * hw * hw; // triangular
    const yw = hw / 3; // centroid 1/3 above base
    Ma += Pw * yw;
  }

  // Mononobe-Okabe increment (simplified horizontal kh, vertical kv=0):
  // ΔPae ≈ 0.75·kh·γ·H² (Seed/Whitman approximation, acting at 0.6H above base)
  let dPae = 0;
  if (loads.seismic.kh > 0) {
    const gammaAvg =
      backfill.reduce((s, L) => s + L.gamma * (L.thickness <= 0 ? 1 : L.thickness), 0) /
      Math.max(
        backfill.reduce((s, L) => s + (L.thickness <= 0 ? 1 : L.thickness), 0),
        1
      );
    const Hm = H / 1000;
    dPae = 0.75 * loads.seismic.kh * gammaAvg * Hm * Hm;
    Ma += dPae * (0.6 * Hm);
  }

  const totalH = Pa + Pq + Pw + dPae;
  const yBar_m = totalH > 0 ? Ma / totalH : 0;
  return {
    Pa,
    Pq,
    Pw,
    dPae,
    yBar: yBar_m * 1000,
    Ka: K,
  };
}
