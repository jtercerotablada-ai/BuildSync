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
  DriftResult,
  DriftSurcharge,
  UnbalancedGable,
  SlidingSnow,
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

// ==================== Drift / unbalanced / sliding (§7.6–7.9) ====================
const MM_TO_FT = 1 / 304.8;
const FT_TO_MM = 304.8;

/** Snow density γ — Eq 7.7-1 (pg in psf → pcf). */
export function snowDensityPcf(pg_psf: number): number {
  return Math.min(0.13 * pg_psf + 14, 30);
}

/** Drift height hd — ASCE 7-22 Eq 7.6-1 (ft).  No −1.5 term, no 20-ft lu floor. */
export function driftHeightFt(pg_psf: number, lu_ft: number, W2: number, gamma_pcf: number): number {
  if (pg_psf <= 0 || lu_ft <= 0 || W2 <= 0) return 0;
  return 1.5 * Math.sqrt((Math.pow(pg_psf, 0.74) * Math.pow(lu_ft, 0.7) * Math.pow(W2, 1.7)) / gamma_pcf);
}

/**
 * Drift, unbalanced-gable and sliding provisions.  Internal units: ft/psf/pcf
 * (converted from mm/Pa at the boundary).  ps = balanced sloped-roof load.
 */
function solveDrift(snow: SnowData, pf_psf: number, ps_psf: number, theta: number): DriftResult | null {
  const d = snow.drift;
  const wantsAny = d.step || d.parapet || d.sliding || (theta >= 2.38 && theta <= 30.2);
  if (!wantsAny) return null;

  const issues: string[] = [];
  const pg = snow.pg / PSF_TO_PA;
  const W2 = snow.W2;
  const gamma = snowDensityPcf(pg);
  const hb = ps_psf > 0 && gamma > 0 ? ps_psf / gamma : 0; // ft

  if (pg <= 0) return null;
  if (W2 <= 0 || W2 > 1) {
    issues.push('Winter Wind Parameter W2 must be the Fig 7.6-1 map value (typically 0.25–0.65).');
  }

  // §7.2 drift/unbalanced exceptions
  const luMax_ft = Math.max(d.luUpper, d.luLower, d.parapetLu, snow.eaveToRidge) * MM_TO_FT;
  if ((pg <= 10 && luMax_ft <= 100) || (pg <= 5 && luMax_ft <= 300)) {
    issues.push('§7.2 exception: drift and unbalanced loads need not be considered (low pg with short fetch). Values shown for reference.');
  }

  // ---- Lower-roof step drifts (§7.7.1) ----
  let leeward: DriftSurcharge | null = null;
  let windward: DriftSurcharge | null = null;
  let hc = 0;
  let required = false;
  if (d.step) {
    const luU = d.luUpper * MM_TO_FT;
    const luL = d.luLower * MM_TO_FT;
    const stepH = d.stepHeight * MM_TO_FT;
    hc = Math.max(stepH - hb, 0);
    required = hb > 0 ? hc / hb >= 0.2 : true;
    if (!required) {
      issues.push('hc/hb < 0.2 — step drift loads are not required (§7.7.1). Values shown for reference.');
    }

    // Leeward (snow blown from the upper roof): height capped by hc and by 0.6·(lower-roof length, new in 7-22)
    {
      const hd = driftHeightFt(pg, luU, W2, gamma);
      const h = Math.min(hd, hc, 0.6 * luL);
      const w = hd <= hc ? 4 * hd : Math.min((4 * hd * hd) / Math.max(hc, 1e-9), 8 * hc);
      leeward = {
        hd: hd * FT_TO_MM, h: h * FT_TO_MM, pd: gamma * h * PSF_TO_PA,
        w: w * FT_TO_MM, capped: h < hd - 1e-9, peak: (ps_psf + gamma * h) * PSF_TO_PA,
      };
      if (w > luL) issues.push('Leeward drift width exceeds the lower roof — taper the surcharge linearly to zero at the far end (§7.7.1).');
    }
    // Windward (snow blown across the lower roof toward the wall): 0.75·hd, width 8×(0.75·hd)
    {
      const hd75 = 0.75 * driftHeightFt(pg, luL, W2, gamma);
      const h = Math.min(hd75, hc); // hc cap per ASCE intent (windward cap sentence is a known 7-22 text gap)
      const w = 8 * hd75;
      windward = {
        hd: hd75 * FT_TO_MM, h: h * FT_TO_MM, pd: gamma * h * PSF_TO_PA,
        w: w * FT_TO_MM, capped: h < hd75 - 1e-9, peak: (ps_psf + gamma * h) * PSF_TO_PA,
      };
    }
    issues.push('Windward and leeward step drifts are separate load cases in ASCE 7-22 — check both (the "larger governs" rule was deleted).');
  }

  // ---- Parapet drift (§7.8, windward method) ----
  let parapet: DriftSurcharge | null = null;
  if (d.parapet) {
    const luP = d.parapetLu * MM_TO_FT;
    const hp = d.parapetHeight * MM_TO_FT;
    const hcP = Math.max(hp - hb, 0);
    const hd75 = 0.75 * driftHeightFt(pg, luP, W2, gamma);
    const h = Math.min(hd75, hcP);
    parapet = {
      hd: hd75 * FT_TO_MM, h: h * FT_TO_MM, pd: gamma * h * PSF_TO_PA,
      w: 8 * hd75 * FT_TO_MM, capped: h < hd75 - 1e-9, peak: (ps_psf + gamma * h) * PSF_TO_PA,
    };
    if (hcP <= 0) issues.push('Parapet is buried in the balanced snow (hc ≤ 0) — no parapet drift surcharge forms.');
  }

  // ---- Unbalanced gable (§7.6.1) ----
  let unbalanced: UnbalancedGable | null = null;
  {
    const applies = theta >= 2.38 && theta <= 30.2;
    if (applies) {
      const W_ft = snow.eaveToRidge * MM_TO_FT;
      const simpleCase = W_ft <= 20;
      if (simpleCase) {
        unbalanced = { applies, simpleCase, windward: 0, leeward: pg * PSF_TO_PA, surcharge: 0, extent: 0 };
      } else {
        const S = 1 / Math.tan((theta * Math.PI) / 180); // run per unit rise
        const hd = driftHeightFt(pg, W_ft, W2, gamma);   // lu = W, no 20-ft floor in 7-22
        unbalanced = {
          applies, simpleCase,
          windward: 0.3 * ps_psf * PSF_TO_PA,
          leeward: ps_psf * PSF_TO_PA,
          surcharge: ((gamma * hd) / Math.sqrt(S)) * PSF_TO_PA,
          extent: (8 / 3) * hd * Math.sqrt(S) * FT_TO_MM,
        };
      }
    } else if (theta > 0) {
      unbalanced = { applies: false, simpleCase: false, windward: 0, leeward: 0, surcharge: 0, extent: 0 };
    }
  }

  // ---- Sliding snow (§7.9) ----
  let sliding: SlidingSnow | null = null;
  if (d.sliding) {
    const trigger = snow.slippery ? theta > 1.19 : theta > 9.46; // ¼:12 / 2:12
    if (trigger) {
      const W_ft = snow.eaveToRidge * MM_TO_FT;
      const total = 0.4 * pf_psf * W_ft; // lb per ft of eave, full 15-ft strip
      const width = Math.min(15, Math.max(d.luLower * MM_TO_FT, 1));
      const totalApplied = total * (width / 15); // §7.9: narrower roof → reduce proportionally
      sliding = {
        intensity: (total / 15) * PSF_TO_PA,
        width: width * FT_TO_MM,
        totalPerLength: totalApplied * 14.5939, // lb/ft → N/m
      };
      if (width < 15) issues.push('Lower roof narrower than 15 ft — total sliding load reduced proportionally (§7.9).');
    } else {
      issues.push(`Sliding snow not triggered: upper roof slope must exceed ${snow.slippery ? '¼ on 12 (1.19°)' : '2 on 12 (9.46°)'} (§7.9).`);
    }
  }

  return {
    gamma_pcf: gamma,
    hb: hb * FT_TO_MM,
    hc: hc * FT_TO_MM,
    required,
    leeward,
    windward,
    parapet,
    unbalanced,
    sliding,
    issues,
  };
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

  // Drift / unbalanced / sliding — hb from the balanced sloped load (no ROS)
  const drift = solveDrift(snow, pf, Cs * pf, theta);

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
    drift,
    issues,
    errors,
  };
}
