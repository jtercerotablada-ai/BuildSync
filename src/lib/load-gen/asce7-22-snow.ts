// ASCE 7-22 Snow loads — Chapter 7.
// Flat-roof (7.3), sloped-roof balanced (7.4), minimum roof snow (7.3.4) and
// rain-on-snow surcharge (7.10).  Internal working unit: psf (natural for ASCE);
// pg is received in Pa and all result pressures are returned in Pa.

import type {
  SnowData,
  SnowResult,
  SnowTerrain,
  RoofExposure,
  ThermalCondition,
  RiskCategory,
} from './types';

// 1 psf = 47.880259 Pa
export const PSF_TO_PA = (0.00444822161526 * 1000) / (0.3048 * 0.3048);

// --- Table 7.3-1 Exposure Factor Ce  [terrain][roof exposure] ---
const CE: Record<SnowTerrain, Partial<Record<RoofExposure, number>>> = {
  B: { 'fully-exposed': 0.9, 'partially-exposed': 1.0, sheltered: 1.2 },
  C: { 'fully-exposed': 0.9, 'partially-exposed': 1.0, sheltered: 1.1 },
  D: { 'fully-exposed': 0.8, 'partially-exposed': 0.9, sheltered: 1.0 },
  'above-treeline': { 'fully-exposed': 0.7, 'partially-exposed': 0.8 },
  'alaska-no-trees': { 'fully-exposed': 0.7, 'partially-exposed': 0.8 },
};

// --- Table 7.3-2 Thermal Factor Ct (fixed-value conditions) ---
const CT_FIXED: Partial<Record<ThermalCondition, number>> = {
  heated: 1.0,
  'cold-ventilated': 1.2, // ASCE 7-22: cold/ventilated roof, R ≥ 25 → 1.2 (was 1.1 in 7-16)
  unheated: 1.2,
  'below-freezing': 1.3,
  greenhouse: 0.85,
};

// --- Table 7.3-3 Thermal Factor for HEATED, UNVENTILATED roofs (Ct = f(Rroof, pg)) ---
// Rows = roof R-value (h·ft²·°F/Btu): ≤20, 30, 40, 50.  Cols = pg (psf): ≤10,20,30,40,50,60,≥70.
const T733_R = [20, 30, 40, 50];
const T733_PG = [10, 20, 30, 40, 50, 60, 70];
const T733: number[][] = [
  [1.20, 1.11, 1.05, 1.01, 1.00, 1.00, 1.00], // R ≤ 20
  [1.20, 1.17, 1.14, 1.13, 1.12, 1.11, 1.10], // R = 30
  [1.20, 1.19, 1.17, 1.16, 1.16, 1.15, 1.15], // R = 40
  [1.20, 1.20, 1.19, 1.19, 1.19, 1.18, 1.18], // R = 50
];
function interp1(xs: number[], ys: number[], x: number): number {
  if (x <= xs[0]) return ys[0];
  if (x >= xs[xs.length - 1]) return ys[ys.length - 1];
  for (let i = 0; i + 1 < xs.length; i++) {
    if (x >= xs[i] && x <= xs[i + 1]) {
      const t = (x - xs[i]) / (xs[i + 1] - xs[i]);
      return ys[i] + t * (ys[i + 1] - ys[i]);
    }
  }
  return ys[ys.length - 1];
}
/** Table 7.3-3 heated-unventilated Ct with bilinear interpolation (R & pg). */
export function ctHeatedUnventilated(Rroof: number, pg: number): number {
  if (Rroof > 50) return 1.2; // footnote b
  // interpolate each R-row across pg, then interpolate across R
  const perRow = T733.map((row) => interp1(T733_PG, row, pg));
  return interp1(T733_R, perRow, Rroof);
}

// --- Table 7.3-4 Minimum roof snow pm,max by Risk Category (psf) ---
const PM_MAX: Record<RiskCategory, number> = { I: 25, II: 30, III: 35, IV: 40 };

/**
 * Roof slope factor Cs per §7.4 / Fig 7.4-1.  Piecewise-linear in the roof
 * slope angle θ (degrees).  Three thermal bands (warm Ct≤1.0, cold Ct=1.1,
 * cold Ct≥1.2), each with a "slippery unobstructed surface" (dashed) and an
 * "all other surfaces" (solid) branch.  Cs decays linearly to 0 at 70°.
 */
export function slopeFactorCs(thetaDeg: number, Ct: number, slippery: boolean): number {
  const t = thetaDeg;
  let hold: number; // slope up to which Cs = 1.0
  if (Ct <= 1.0) hold = slippery ? 5 : 30;          // warm roof
  else if (Ct <= 1.1) hold = slippery ? 10 : 37.5;  // cold, Ct = 1.1
  else hold = slippery ? 15 : 45;                    // cold, Ct ≥ 1.2
  if (t <= hold) return 1.0;
  if (t >= 70) return 0.0;
  return (70 - t) / (70 - hold);
}

export function solveAsce722Snow(snow: SnowData, riskCategory: RiskCategory): SnowResult {
  const issues: string[] = [];
  const errors: string[] = [];

  const pg = snow.pg / PSF_TO_PA; // psf — ultimate, Risk-Category-specific (Hazard Tool)
  if (pg < 0) errors.push('Ground snow load pg must be ≥ 0.');

  const Ce = CE[snow.terrain]?.[snow.roofExposure];
  if (Ce === undefined) {
    errors.push(`Roof exposure "${snow.roofExposure}" is not defined for terrain ${snow.terrain} (Table 7.3-1).`);
  }
  const CeUsed = Ce ?? 1.0;
  const Ct = snow.thermal === 'heated-unventilated'
    ? ctHeatedUnventilated(snow.roofR, pg)         // Table 7.3-3
    : (CT_FIXED[snow.thermal] ?? 1.0);             // Table 7.3-2

  // Flat-roof snow load — Eq 7.3-1 (ASCE 7-22): pf = 0.7·Ce·Ct·pg  (Is removed;
  // risk is carried in the ultimate pg).  Strength-level load.
  const pf = 0.7 * CeUsed * Ct * pg; // psf
  const theta = snow.roofSlope;

  // Rain-on-snow surcharge — §7.10 (pg ≤ 20 psf, slope < W/50 deg → +8 psf in 7-22)
  const W_ft = snow.eaveToRidge / 304.8; // mm → ft
  let rainOnSnow = 0;
  if (pg > 0 && pg <= 20 && W_ft > 0 && theta < W_ft / 50) {
    rainOnSnow = 8; // psf added to the balanced load (ASCE 7-22 §7.10; was 5 psf in 7-16)
  }

  // Sloped-roof (balanced) snow load — Eq 7.4-1.  The rain-on-snow surcharge
  // (§7.10) is added AFTER the slope factor — it is not reduced by Cs.
  const Cs = slopeFactorCs(theta, Ct, snow.slippery);
  const slopeFactorApplies = theta > 0;
  const ps = Cs * pf + rainOnSnow; // psf

  // Minimum roof snow load for low-slope roofs — §7.3.3 (slope < 15°).
  // ASCE 7-22: pm = min(pg, pm,max[Risk Category])  (Table 7.3-4).  Separate
  // uniform load case — not combined with drift/sliding/unbalanced/partial.
  let pm = 0;
  let minimumApplies = false;
  if (theta < 15) {
    minimumApplies = true;
    pm = Math.min(pg, PM_MAX[riskCategory]);
  }

  const balanced = Math.max(ps, minimumApplies ? pm : 0);
  const minimumGoverns = minimumApplies && pm > ps;

  if (pg > 0 && pg < 5) {
    issues.push('Very low ground snow (pg < 5 psf) — confirm the site actually carries a snow design load.');
  }
  if (rainOnSnow > 0) {
    issues.push('Rain-on-snow surcharge (+8 psf, ASCE 7-22 §7.10) applies: low slope and pg ≤ 20 psf.');
  }
  if (minimumApplies && minimumGoverns) {
    issues.push(`Minimum roof snow (§7.3.3) governs: pm = min(pg, pm,max) = ${pm.toFixed(1)} psf (pm,max ${PM_MAX[riskCategory]} psf, Risk ${riskCategory}).`);
  }
  if (theta >= 70) {
    issues.push('Roof slope ≥ 70° — slope factor Cs = 0, no balanced snow retained on the surface.');
  }

  const toPa = (v: number) => v * PSF_TO_PA;
  return {
    Ce: CeUsed,
    Ct,
    pf: toPa(pf),
    Cs,
    ps: toPa(ps),
    pm: toPa(pm),
    rainOnSnow: toPa(rainOnSnow),
    governing: toPa(balanced),
    slopeFactorApplies,
    minimumGoverns,
    issues,
    errors,
  };
}
