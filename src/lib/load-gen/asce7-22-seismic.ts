// ASCE 7-22 Seismic — Equivalent Lateral Force procedure (Chapters 11–12).
// ASCE 7-22 deleted the Fa/Fv site-coefficient tables of 7-16 (§11.4.3,
// C11.4.3): the design spectral accelerations SDS/SD1 are taken directly from
// the USGS Seismic Design Geodatabase (Hazard Tool) for the site class, with
// period-dependent site effects already embedded in the multi-period spectra.
// This solver therefore takes SDS/SD1 as inputs and applies the (unchanged)
// §12.8 ELF machinery: approximate period Ta → seismic response coefficient Cs
// → base shear V → vertical distribution Fx → Seismic Design Category (§11.6).
// Force internal unit: kN (SI 'force' base). Length: mm (hn → ft for Ta).

import type {
  SeismicData,
  SeismicResult,
  SeismicStoryForce,
  SeismicSystemPeriod,
  RiskCategory,
} from './types';

const MM_TO_FT = 1 / 304.8;

// --- Table 1.5-2 Seismic Importance Factor Ie ---
const IE: Record<RiskCategory, number> = { I: 1.0, II: 1.0, III: 1.25, IV: 1.5 };

// --- Table 12.8-2 approximate-period parameters (hn in ft) ---
const PERIOD_PARAMS: Record<SeismicSystemPeriod, { Ct: number; x: number; label: string }> = {
  'steel-moment': { Ct: 0.028, x: 0.8, label: 'Steel moment-resisting frame' },
  'concrete-moment': { Ct: 0.016, x: 0.9, label: 'Concrete moment-resisting frame' },
  'steel-ebf': { Ct: 0.03, x: 0.75, label: 'Steel eccentrically braced frame' },
  'steel-brb': { Ct: 0.03, x: 0.75, label: 'Steel buckling-restrained braced frame' },
  other: { Ct: 0.02, x: 0.75, label: 'All other structural systems' },
};

// --- Seismic Design Category, Table 11.6-1 (SDS) and 11.6-2 (SD1) ---
// Interval convention [lo ≤ x < hi).
type SDC4 = 'A' | 'B' | 'C' | 'D';
function sdcFromSds(SDS: number, riskIV: boolean): SDC4 {
  if (SDS < 0.167) return 'A';
  if (SDS < 0.33) return riskIV ? 'C' : 'B';
  if (SDS < 0.5) return riskIV ? 'D' : 'C';
  return 'D';
}
function sdcFromSd1(SD1: number, riskIV: boolean): SDC4 {
  if (SD1 < 0.067) return 'A';
  if (SD1 < 0.133) return riskIV ? 'C' : 'B';
  if (SD1 < 0.2) return riskIV ? 'D' : 'C';
  return 'D';
}
const SDC_RANK: Record<string, number> = { A: 0, B: 1, C: 2, D: 3, E: 4, F: 5 };

export function solveAsce722Seismic(
  seismic: SeismicData,
  riskCategory: RiskCategory
): SeismicResult {
  const issues: string[] = [];
  const errors: string[] = [];

  const { SDS, SD1, S1, R, TL, hn, W, stories } = seismic;
  if (SDS < 0) errors.push('SDS must be ≥ 0.');
  if (SD1 < 0) errors.push('SD1 must be ≥ 0.');
  if (R <= 0) errors.push('R must be > 0.');
  if (W <= 0) errors.push('Seismic weight W must be > 0.');

  const SMS = 1.5 * SDS; // SDS = ⅔·SMS  →  SMS = 1.5·SDS
  const SM1 = 1.5 * SD1;
  const Ie = IE[riskCategory];
  const Ts = SDS > 0 ? SD1 / SDS : 0;

  // Approximate fundamental period Ta = Ct·hn^x (Eq 12.8-7), hn in ft
  const { Ct, x } = PERIOD_PARAMS[seismic.systemPeriod];
  const hn_ft = Math.max(hn * MM_TO_FT, 0);
  const Ta = Ct * Math.pow(hn_ft, x);
  const T = Ta; // approximate period governs the base shear here

  // Seismic response coefficient Cs (§12.8.1.1)
  const RIe = R / Ie;
  const CsBase = SDS / RIe;                                            // Eq 12.8-2
  const CsMax = T <= TL ? SD1 / (T * RIe) : (SD1 * TL) / (T * T * RIe); // Eq 12.8-3/-4
  let CsMin = Math.max(0.044 * SDS * Ie, 0.01);                        // Eq 12.8-5
  const nearFaultFloor = S1 >= 0.6 ? (0.5 * S1) / RIe : 0;             // Eq 12.8-6
  if (nearFaultFloor > 0) CsMin = Math.max(CsMin, nearFaultFloor);

  let Cs = CsBase;
  let CsControl = 'base SDS/(R/Ie)';
  if (T > 0 && CsMax < Cs) {
    Cs = CsMax;
    CsControl = T <= TL ? 'upper limit SD1/(T·R/Ie)' : 'upper limit SD1·TL/(T²·R/Ie)';
  }
  if (Cs < CsMin) {
    Cs = CsMin;
    CsControl = nearFaultFloor > 0 && CsMin === nearFaultFloor ? 'near-fault floor 0.5·S1/(R/Ie)' : 'minimum max(0.044·SDS·Ie, 0.01)';
  }

  const V = Cs * W; // base shear, kN

  // Seismic Design Category (§11.6) — governing of the two tables
  const riskIV = riskCategory === 'IV';
  let sdc: string = ['A', 'B', 'C', 'D'][
    Math.max(SDC_RANK[sdcFromSds(SDS, riskIV)], SDC_RANK[sdcFromSd1(SD1, riskIV)])
  ];
  if (S1 >= 0.75) sdc = riskIV ? 'F' : 'E'; // §11.6 override

  // Vertical distribution exponent k (§12.8.3)
  const k = Math.min(2, Math.max(1, 1 + (T - 0.5) / 2));

  // Distribute over `stories` levels of equal weight and equal height.
  const N = Math.max(1, Math.round(stories));
  const storyH_mm = hn / N;
  const storyW = W / N;
  const hxk: number[] = [];
  let sumHxk = 0;
  for (let i = 1; i <= N; i++) {
    const hx_ft = i * storyH_mm * MM_TO_FT;
    const val = storyW * Math.pow(hx_ft, k);
    hxk.push(val);
    sumHxk += val;
  }
  const forces: SeismicStoryForce[] = [];
  let cumV = 0;
  for (let i = N; i >= 1; i--) {
    const Cvx = sumHxk > 0 ? hxk[i - 1] / sumHxk : 0;
    const Fx = Cvx * V;
    cumV += Fx;
    forces.push({ level: i, hx: i * storyH_mm, wx: storyW, Cvx, Fx, Vx: cumV });
  }

  if (nearFaultFloor > 0) {
    issues.push('S1 ≥ 0.6 — near-fault minimum Cs ≥ 0.5·S1/(R/Ie) applied (Eq 12.8-6). ASCE 7-22 restricts this floor to near-fault sites (§11.4.1); relax only if the site is not near-fault.');
  }
  if (T > 2.5) {
    issues.push('Approximate period Ta > 2.5 s — verify the fundamental period; a computed T (≤ Cu·Ta) may govern.');
  }

  return {
    SMS,
    SM1,
    SDS,
    SD1,
    Ie,
    Ta,
    Ts,
    k,
    Cs,
    CsControl,
    V,
    SDC: sdc as SeismicResult['SDC'],
    forces,
    issues,
    errors,
  };
}
