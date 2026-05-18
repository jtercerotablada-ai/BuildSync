// ACI 318-99 Appendix A — Method 3 Moment Coefficients for Two-Way Slabs
// (still acceptable analysis under ACI 318-19 §8.10.1 for slabs with beams between supports)
//
// Source: PCA Notes on ACI 318-95 (Tables A-1, A-2, A-3) reproduced in:
//   • Nilson, Darwin & Dolan — Design of Concrete Structures, 14th ed., Tables 12.5–12.7
//   • Wang & Salmon — Reinforced Concrete Design, 7th ed., Tables 17.4.1–17.4.3
//   • McCormac & Brown — Design of Reinforced Concrete, 9th ed., Tables 16.2–16.4
//
// Convention:
//   m  = ratio of short to long clear span = la / lb,  0.5 ≤ m ≤ 1.0
//   la = short clear span (subscript "a"  ⇒ direction of stronger moment, more rebar)
//   lb = long clear span  (subscript "b"  ⇒ weaker direction)
//
// Design moments per unit width:
//   Mneg_a  = Ca_neg · w · la²        (continuous-edge negative, where applicable)
//   Mneg_b  = Cb_neg · w · lb²
//   Mpos_a  = Ca_DL · DL · la²  +  Ca_LL · LL · la²
//   Mpos_b  = Cb_DL · DL · lb²  +  Cb_LL · LL · lb²
// where DL and LL are the FACTORED uniform loads (kN/m²) on the panel.
//
// The 9 cases (edge-condition patterns):
//   Case 1 — interior panel (all four edges continuous)
//   Case 2 — one short edge discontinuous
//   Case 3 — one long edge discontinuous
//   Case 4 — two adjacent edges discontinuous (corner panel)
//   Case 5 — two short edges discontinuous (single-bay strip)
//   Case 6 — two long edges discontinuous (single-bay strip)
//   Case 7 — three edges discontinuous, one long edge continuous
//   Case 8 — three edges discontinuous, one short edge continuous
//   Case 9 — all four edges discontinuous (isolated simply-supported panel)
//
// A coefficient of 0 means "no negative moment" (that edge is discontinuous in this case).

export type Method3Case = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9;

export interface Method3Coeffs {
  Ca_neg: number;
  Cb_neg: number;
  Ca_DL:  number;
  Cb_DL:  number;
  Ca_LL:  number;
  Cb_LL:  number;
}

// Tabulated at m = 1.00, 0.95, 0.90, ..., 0.50 (11 values, descending)
const M_VALUES: readonly number[] = [1.0, 0.95, 0.9, 0.85, 0.8, 0.75, 0.7, 0.65, 0.6, 0.55, 0.5];

// Helper to keep tables compact and visually scannable
const T = (
  Ca_neg: number, Cb_neg: number,
  Ca_DL:  number, Cb_DL:  number,
  Ca_LL:  number, Cb_LL:  number,
): Method3Coeffs => ({ Ca_neg, Cb_neg, Ca_DL, Cb_DL, Ca_LL, Cb_LL });

// =============================================================================
// CASE 1 — Interior (all four edges continuous)
// =============================================================================
const CASE_1: Method3Coeffs[] = [
  // m = 1.00
  T(0.033, 0.033, 0.018, 0.018, 0.027, 0.027),
  // 0.95
  T(0.040, 0.029, 0.020, 0.016, 0.030, 0.024),
  // 0.90
  T(0.045, 0.026, 0.022, 0.014, 0.032, 0.022),
  // 0.85
  T(0.050, 0.024, 0.024, 0.012, 0.034, 0.020),
  // 0.80
  T(0.055, 0.021, 0.026, 0.011, 0.037, 0.017),
  // 0.75
  T(0.060, 0.019, 0.028, 0.009, 0.040, 0.016),
  // 0.70
  T(0.065, 0.017, 0.030, 0.008, 0.043, 0.014),
  // 0.65
  T(0.069, 0.014, 0.032, 0.007, 0.046, 0.013),
  // 0.60
  T(0.074, 0.012, 0.034, 0.006, 0.048, 0.011),
  // 0.55
  T(0.077, 0.011, 0.035, 0.005, 0.051, 0.010),
  // 0.50
  T(0.083, 0.010, 0.037, 0.004, 0.053, 0.009),
];

// =============================================================================
// CASE 2 — One short edge discontinuous
// =============================================================================
const CASE_2: Method3Coeffs[] = [
  T(0.040, 0.040, 0.018, 0.018, 0.027, 0.027),
  T(0.045, 0.035, 0.020, 0.016, 0.029, 0.024),
  T(0.050, 0.029, 0.022, 0.014, 0.032, 0.022),
  T(0.055, 0.026, 0.024, 0.012, 0.034, 0.020),
  T(0.060, 0.023, 0.026, 0.011, 0.036, 0.018),
  T(0.066, 0.019, 0.028, 0.009, 0.038, 0.016),
  T(0.071, 0.017, 0.030, 0.008, 0.040, 0.014),
  T(0.076, 0.014, 0.032, 0.007, 0.042, 0.013),
  T(0.081, 0.012, 0.034, 0.006, 0.044, 0.011),
  T(0.085, 0.011, 0.036, 0.005, 0.046, 0.010),
  T(0.089, 0.010, 0.037, 0.004, 0.047, 0.009),
];

// =============================================================================
// CASE 3 — One long edge discontinuous
// =============================================================================
const CASE_3: Method3Coeffs[] = [
  T(0.040, 0.040, 0.018, 0.018, 0.027, 0.027),
  T(0.045, 0.040, 0.020, 0.018, 0.030, 0.027),
  T(0.050, 0.040, 0.022, 0.018, 0.033, 0.027),
  T(0.055, 0.040, 0.024, 0.018, 0.036, 0.027),
  T(0.060, 0.040, 0.027, 0.018, 0.039, 0.027),
  T(0.066, 0.040, 0.029, 0.017, 0.042, 0.025),
  T(0.071, 0.040, 0.031, 0.017, 0.045, 0.024),
  T(0.076, 0.040, 0.033, 0.016, 0.048, 0.022),
  T(0.081, 0.040, 0.035, 0.015, 0.051, 0.021),
  T(0.085, 0.040, 0.037, 0.014, 0.054, 0.019),
  T(0.089, 0.040, 0.038, 0.013, 0.056, 0.017),
];

// =============================================================================
// CASE 4 — Two adjacent edges discontinuous (corner panel)
// =============================================================================
const CASE_4: Method3Coeffs[] = [
  T(0.047, 0.047, 0.027, 0.027, 0.032, 0.032),
  T(0.053, 0.041, 0.030, 0.024, 0.035, 0.029),
  T(0.060, 0.036, 0.034, 0.022, 0.039, 0.026),
  T(0.066, 0.032, 0.037, 0.019, 0.042, 0.024),
  T(0.072, 0.028, 0.041, 0.017, 0.046, 0.022),
  T(0.078, 0.024, 0.044, 0.014, 0.049, 0.019),
  T(0.084, 0.020, 0.047, 0.012, 0.053, 0.017),
  T(0.090, 0.017, 0.050, 0.010, 0.056, 0.014),
  T(0.094, 0.014, 0.054, 0.008, 0.060, 0.012),
  T(0.097, 0.011, 0.057, 0.006, 0.063, 0.010),
  T(0.100, 0.009, 0.060, 0.005, 0.066, 0.008),
];

// =============================================================================
// CASE 5 — Two short edges discontinuous (single-bay strip in long direction)
// =============================================================================
const CASE_5: Method3Coeffs[] = [
  T(0.000, 0.061, 0.023, 0.020, 0.030, 0.028),
  T(0.000, 0.060, 0.026, 0.020, 0.034, 0.027),
  T(0.000, 0.058, 0.029, 0.019, 0.038, 0.026),
  T(0.000, 0.056, 0.032, 0.017, 0.042, 0.025),
  T(0.000, 0.054, 0.035, 0.016, 0.045, 0.023),
  T(0.000, 0.052, 0.039, 0.015, 0.049, 0.022),
  T(0.000, 0.050, 0.042, 0.014, 0.052, 0.020),
  T(0.000, 0.049, 0.046, 0.013, 0.055, 0.018),
  T(0.000, 0.048, 0.050, 0.011, 0.058, 0.016),
  T(0.000, 0.047, 0.053, 0.010, 0.061, 0.014),
  T(0.000, 0.046, 0.057, 0.009, 0.063, 0.012),
];

// =============================================================================
// CASE 6 — Two long edges discontinuous (single-bay strip in short direction)
// =============================================================================
const CASE_6: Method3Coeffs[] = [
  T(0.061, 0.000, 0.020, 0.023, 0.028, 0.030),
  T(0.063, 0.000, 0.024, 0.024, 0.031, 0.031),
  T(0.067, 0.000, 0.027, 0.025, 0.034, 0.032),
  T(0.070, 0.000, 0.029, 0.025, 0.037, 0.033),
  T(0.074, 0.000, 0.032, 0.024, 0.040, 0.034),
  T(0.078, 0.000, 0.034, 0.024, 0.044, 0.034),
  T(0.083, 0.000, 0.036, 0.023, 0.047, 0.034),
  T(0.087, 0.000, 0.038, 0.022, 0.050, 0.034),
  T(0.090, 0.000, 0.040, 0.021, 0.052, 0.034),
  T(0.093, 0.000, 0.042, 0.020, 0.055, 0.034),
  T(0.097, 0.000, 0.044, 0.019, 0.057, 0.033),
];

// =============================================================================
// CASE 7 — Three edges discontinuous, one LONG edge continuous
// =============================================================================
const CASE_7: Method3Coeffs[] = [
  T(0.000, 0.071, 0.029, 0.021, 0.034, 0.029),
  T(0.000, 0.069, 0.033, 0.021, 0.038, 0.029),
  T(0.000, 0.066, 0.038, 0.020, 0.042, 0.028),
  T(0.000, 0.062, 0.042, 0.019, 0.046, 0.028),
  T(0.000, 0.058, 0.046, 0.017, 0.051, 0.027),
  T(0.000, 0.054, 0.050, 0.016, 0.055, 0.025),
  T(0.000, 0.050, 0.054, 0.014, 0.058, 0.023),
  T(0.000, 0.047, 0.058, 0.012, 0.062, 0.022),
  T(0.000, 0.043, 0.063, 0.010, 0.066, 0.020),
  T(0.000, 0.039, 0.067, 0.009, 0.069, 0.018),
  T(0.000, 0.036, 0.071, 0.008, 0.072, 0.016),
];

// =============================================================================
// CASE 8 — Three edges discontinuous, one SHORT edge continuous
// =============================================================================
const CASE_8: Method3Coeffs[] = [
  T(0.071, 0.000, 0.021, 0.029, 0.029, 0.034),
  T(0.072, 0.000, 0.025, 0.029, 0.033, 0.034),
  T(0.074, 0.000, 0.029, 0.029, 0.036, 0.034),
  T(0.076, 0.000, 0.032, 0.029, 0.040, 0.034),
  T(0.078, 0.000, 0.036, 0.028, 0.044, 0.034),
  T(0.080, 0.000, 0.039, 0.028, 0.047, 0.034),
  T(0.083, 0.000, 0.043, 0.027, 0.050, 0.033),
  T(0.085, 0.000, 0.046, 0.026, 0.053, 0.033),
  T(0.087, 0.000, 0.050, 0.025, 0.056, 0.032),
  T(0.089, 0.000, 0.053, 0.024, 0.058, 0.031),
  T(0.090, 0.000, 0.056, 0.022, 0.061, 0.030),
];

// =============================================================================
// CASE 9 — All four edges discontinuous (isolated simply-supported panel)
// =============================================================================
const CASE_9: Method3Coeffs[] = [
  T(0.000, 0.000, 0.036, 0.036, 0.036, 0.036),
  T(0.000, 0.000, 0.040, 0.033, 0.040, 0.033),
  T(0.000, 0.000, 0.045, 0.029, 0.045, 0.029),
  T(0.000, 0.000, 0.050, 0.026, 0.050, 0.026),
  T(0.000, 0.000, 0.056, 0.023, 0.056, 0.023),
  T(0.000, 0.000, 0.061, 0.019, 0.061, 0.019),
  T(0.000, 0.000, 0.068, 0.016, 0.068, 0.016),
  T(0.000, 0.000, 0.074, 0.013, 0.074, 0.013),
  T(0.000, 0.000, 0.081, 0.010, 0.081, 0.010),
  T(0.000, 0.000, 0.088, 0.008, 0.088, 0.008),
  T(0.000, 0.000, 0.095, 0.006, 0.095, 0.006),
];

const ALL_CASES: Record<Method3Case, Method3Coeffs[]> = {
  1: CASE_1, 2: CASE_2, 3: CASE_3, 4: CASE_4, 5: CASE_5,
  6: CASE_6, 7: CASE_7, 8: CASE_8, 9: CASE_9,
};

// Lookup with linear interpolation in m
export function lookupMethod3(caseNum: Method3Case, m: number): Method3Coeffs {
  const mClamped = Math.max(0.5, Math.min(1.0, m));
  const table = ALL_CASES[caseNum];
  // Find bracketing m values (M_VALUES is descending)
  let i = 0;
  for (; i < M_VALUES.length - 1; i++) {
    if (mClamped >= M_VALUES[i + 1]) break;
  }
  if (i >= M_VALUES.length - 1) i = M_VALUES.length - 2;
  const m_hi = M_VALUES[i];          // larger m
  const m_lo = M_VALUES[i + 1];      // smaller m
  const c_hi = table[i];
  const c_lo = table[i + 1];
  const t = (mClamped - m_lo) / Math.max(1e-9, m_hi - m_lo);
  return {
    Ca_neg: c_lo.Ca_neg + t * (c_hi.Ca_neg - c_lo.Ca_neg),
    Cb_neg: c_lo.Cb_neg + t * (c_hi.Cb_neg - c_lo.Cb_neg),
    Ca_DL:  c_lo.Ca_DL  + t * (c_hi.Ca_DL  - c_lo.Ca_DL ),
    Cb_DL:  c_lo.Cb_DL  + t * (c_hi.Cb_DL  - c_lo.Cb_DL ),
    Ca_LL:  c_lo.Ca_LL  + t * (c_hi.Ca_LL  - c_lo.Ca_LL ),
    Cb_LL:  c_lo.Cb_LL  + t * (c_hi.Cb_LL  - c_lo.Cb_LL ),
  };
}

/**
 * Map a PanelEdges record (which side is free / simply / fixed) to one of the
 * 9 Method 3 cases. Treat 'fixed' and (heuristically) 'simple' to be CONTINUOUS
 * if the edge is a slab-to-slab connection; here we treat 'fixed' as continuous
 * and 'simple' / 'free' as discontinuous, which matches Method 3 nomenclature
 * where "discontinuous" means the slab terminates at a wall or beam without
 * continuity to another panel.
 *
 * Returns case number 1–9, or null if the configuration is unrecognized
 * (e.g. all four edges free — invalid for Method 3).
 */
export function classifyEdgesToCase(edges: {
  left:   'free' | 'simple' | 'fixed';
  right:  'free' | 'simple' | 'fixed';
  top:    'free' | 'simple' | 'fixed';
  bottom: 'free' | 'simple' | 'fixed';
}, longSide: 'x' | 'y'): Method3Case | null {
  const cont = (e: 'free' | 'simple' | 'fixed') => e === 'fixed';
  // Long-direction edges are perpendicular to long span
  const longEdges  = longSide === 'x' ? [edges.top, edges.bottom] : [edges.left, edges.right];
  const shortEdges = longSide === 'x' ? [edges.left, edges.right] : [edges.top, edges.bottom];
  const c_long  = longEdges.map(cont);     // [continuous?, continuous?]
  const c_short = shortEdges.map(cont);
  const nL = c_long.filter(Boolean).length;   // # continuous long edges
  const nS = c_short.filter(Boolean).length;  // # continuous short edges
  const total = nL + nS;
  if (total === 4) return 1;                   // all continuous
  if (total === 0) return 9;                   // all discontinuous
  if (total === 3) {
    // 3 of 4 edges continuous → 1 discontinuous
    if (nL === 2) return 2;                    // long edges both cont, one short disc
    /* nS === 2 */    return 3;                // short edges both cont, one long disc
  }
  if (total === 2) {
    if (nL === 1 && nS === 1) return 4;        // adjacent (corner)
    if (nL === 2)              return 5;       // both long continuous, both short discontinuous
    /* nS === 2 */              return 6;      // both short continuous, both long discontinuous
  }
  if (total === 1) {
    if (nL === 1) return 7;                    // only one long edge continuous
    /* nS === 1 */    return 8;                // only one short edge continuous
  }
  return null;
}
