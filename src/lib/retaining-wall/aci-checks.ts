// Shared ACI / geotechnical checks used across every wall type.
//
// This module groups the cross-cutting checks that don't belong to any one
// solver: bar development & hook & splice lengths, shear-friction at
// construction joints, Meyerhof / Vesić ultimate bearing capacity, and
// multi-layer rebar curtailment. Each function is purely numeric and
// independent of wall geometry — it is called from the per-kind solvers
// (and the auto-design driver) with the relevant inputs.
//
// All formulas use SI units: stresses in MPa, lengths in mm, forces in N
// or kN as labelled. Code citations are inline.

import type {
  DevelopmentLengthResult,
  LapSpliceResult,
  RebarCurtailmentZone,
  StabilityResult,
} from './types';

// ─── Development length (tension) — ACI 318-25 §25.4.2 ────────────────────
//
// ACI 318-25 SI Eq. (25.4.2.4a):
//   ld = (fy · ψt · ψe · ψs · ψg) / (1.1 · λ · √f'c · ((cb + Ktr)/db)) · db
//   minimum ld ≥ 300 mm
//
// Limits: (cb + Ktr)/db ≤ 2.5 (cap; "confinement term").
// In ACI 318-19 SI the formula appears at §25.4.2.3 (renumbered in 25).
//
// Modification factors (default values are the most common case for
// vertical-stem dowels into a footing):
//   • ψt ("top bar") — 1.3 if more than 300 mm of fresh concrete is cast
//                      below the bar in a single placement; 1.0 otherwise
//   • ψe ("epoxy")   — 1.5 epoxy-coated with cb < 3db or clear spacing < 6db
//                      1.2 epoxy-coated otherwise
//                      1.0 uncoated bar
//   • ψs ("size")    — 0.8 for #6 (Ø 19 mm) and smaller; 1.0 for #7 and larger
//   • ψg ("grade")   — 1.0 for fy ≤ 550 MPa; 1.15 for 550 < fy ≤ 690; 1.3 for fy > 690
//   • λ              — 0.75 lightweight concrete; 1.0 normal weight

export function developmentLengthTension(
  db: number,
  fy: number,
  fc: number,
  available: number,
  opts: Partial<{ psi_t: number; psi_e: number; psi_s: number; psi_g: number; lambda: number; cb_Ktr_over_db: number }> = {},
): DevelopmentLengthResult {
  const psi_t = opts.psi_t ?? 1.0;
  const psi_e = opts.psi_e ?? 1.0;
  const psi_s = opts.psi_s ?? (db <= 19 ? 0.8 : 1.0);
  const psi_g = opts.psi_g ?? (fy <= 550 ? 1.0 : fy <= 690 ? 1.15 : 1.3);
  const lambda = opts.lambda ?? 1.0;
  const confinement = Math.min(opts.cb_Ktr_over_db ?? 2.5, 2.5);

  const sqrtFc = Math.sqrt(fc);
  // ACI 318-25 SI Eq. (25.4.2.4a)
  const ld_raw = (db * fy * psi_t * psi_e * psi_s * psi_g) / (1.1 * lambda * sqrtFc * confinement);
  const ld = Math.max(300, ld_raw);

  // Hook length is computed by developmentLengthHook below — caller picks
  // the smaller of `ld` (straight) and `ldh` (hook) when an embedment
  // hook is allowed.
  const ldh = developmentLengthHookValue(db, fy, fc, opts);

  return {
    ld: Math.round(ld),
    ldh: Math.round(ldh),
    available: Math.round(available),
    ok: available >= Math.min(ld, ldh),
  };
}

// ─── Standard 90° hook development — ACI 318-25 §25.4.3 ───────────────────
//
// ACI 318-25 SI Eq. (25.4.3.1a):
//   ldh = ((fy · ψe · ψc · ψr · ψo · λ) / (23 · √f'c)) · db^1.5
//   minimum ldh ≥ max(8 db, 150 mm)
//
// Modification factors (defaults assume cover ≥ 65 mm and confining ties):
//   • ψe — 1.2 epoxy; 1.0 otherwise
//   • ψc — 1.0 normal cover; 0.7 if side cover ≥ 65 mm AND tail cover ≥ 50 mm
//   • ψr — 0.8 if confining ties present per §25.4.3.4; 1.0 otherwise
//   • ψo — 1.25 for #11 and smaller bars terminating at edge with cover ≥ 65 mm; 1.0 otherwise
//          (introduced in ACI 318-19 — not in 318-14)

function developmentLengthHookValue(
  db: number,
  fy: number,
  fc: number,
  opts: Partial<{ psi_e: number; psi_c: number; psi_r: number; psi_o: number; lambda: number }> = {},
): number {
  const psi_e = opts.psi_e ?? 1.0;
  const psi_c = opts.psi_c ?? 1.0;
  const psi_r = opts.psi_r ?? 1.0;
  const psi_o = opts.psi_o ?? 1.0;
  const lambda = opts.lambda ?? 1.0;
  const sqrtFc = Math.sqrt(fc);
  const ldh_raw = ((fy * psi_e * psi_c * psi_r * psi_o * lambda) / (23 * sqrtFc)) * Math.pow(db, 1.5);
  return Math.max(8 * db, 150, ldh_raw);
}

export function developmentLengthHook(
  db: number,
  fy: number,
  fc: number,
  available: number,
  opts: Parameters<typeof developmentLengthHookValue>[3] = {},
): DevelopmentLengthResult {
  const ldh = developmentLengthHookValue(db, fy, fc, opts);
  return {
    ld: Math.round(ldh),       // hook-only check; "ld" field stores the hook length for clarity
    ldh: Math.round(ldh),
    available: Math.round(available),
    ok: available >= ldh,
  };
}

// ─── Lap-splice length — ACI 318-25 §25.5.2 ───────────────────────────────
//
// Class A:  ls = 1.0 · ld  (when As_provided ≥ 2·As_req AND ≤ 50 % of bars
//                           spliced within the lap length)
// Class B:  ls = 1.3 · ld  (all other cases)
// minimum ls ≥ 300 mm

export function lapSpliceLength(
  ld: number,
  classType: 'A' | 'B',
  available: number,
): LapSpliceResult {
  const factor = classType === 'A' ? 1.0 : 1.3;
  const ls = Math.max(300, factor * ld);
  return {
    classType,
    ls: Math.round(ls),
    ok: available >= ls,
  };
}

/**
 * Pick lap-splice class per ACI 318-25 §25.5.2.1:
 *   • Class A if As,provided ≥ 2 · As,req AND ≤ 50 % of bars spliced in lap.
 *   • Class B otherwise.
 */
export function pickLapSpliceClass(
  As_provided: number,
  As_req: number,
  fractionInLap: number,
): 'A' | 'B' {
  if (As_provided >= 2 * As_req && fractionInLap <= 0.5) return 'A';
  return 'B';
}

// ─── Shear-friction — ACI 318-25 §22.9 ────────────────────────────────────
//
// At a construction joint (e.g. between footing and stem) the dowels must
// transfer the factored horizontal shear by friction across the rough
// interface:
//   Vn = μ · Avf · fy
//   μ = 1.4·λ  monolithic
//        1.0·λ  hardened concrete with intentional roughening (¼-inch amplitude)
//        0.6·λ  hardened concrete WITHOUT intentional roughening
//        0.7·λ  steel-to-concrete
//
// Limits per §22.9.4.4:
//   φVn ≤ φ · min(0.2 · f'c · Ac, 5.5 · Ac)   for normalweight
//        ≤ φ · min(0.2 · f'c · Ac, 11 + 0.08 · f'c · Ac, 5.5 · Ac)  if monolithic & enhanced
//
// Values returned in kN (consistent with the rest of the solver).

export function shearFrictionCapacity(
  Avf: number,                // mm² / m (per metre of wall)
  fy: number,                 // MPa
  mu: number,                 // friction coefficient (already includes λ)
  fc: number,                 // MPa
  Ac: number = 1000 * 400,    // mm²/m default = 1000 mm × 400 mm (assumed footing-stem interface)
): { Vn: number; Vn_max: number } {
  // Vn = μ · Avf · fy  → from MPa·mm² = N. Convert to kN.
  const Vn_N = mu * Avf * fy;
  const Vn_max_N = Math.min(0.2 * fc * Ac, 5.5 * Ac);
  return {
    Vn: Vn_N / 1000,         // kN/m
    Vn_max: Vn_max_N / 1000, // kN/m cap
  };
}

/**
 * Required Avf to resist a given factored shear Vu (kN/m) at the joint.
 * Solves Vu / φ = μ · Avf · fy for Avf.
 */
export function shearFrictionRequiredArea(
  Vu_kN_per_m: number,
  fy: number,
  mu: number,
  phi: number = 0.75,
): number {
  if (Vu_kN_per_m <= 0) return 0;
  const Vn_req_N = (Vu_kN_per_m * 1000) / phi; // N/m
  return Vn_req_N / (mu * fy);                  // mm²/m
}

// ─── Meyerhof / Vesić ultimate bearing capacity ───────────────────────────
//
// Wight & MacGregor §13 (and Bowles "Foundation Analysis and Design")
//   qu = c · Nc · sc · dc · ic
//      + q · Nq · sq · dq · iq
//      + 0.5 · γ · B' · Nγ · sγ · dγ · iγ
//
// Bearing-capacity factors (Meyerhof / Vesić, identical for cohesionless
// soils above φ = 30°):
//   Nq = e^(π·tanφ) · tan²(45 + φ/2)
//   Nc = (Nq − 1) · cotφ                 (φ > 0)
//        Nc = 5.14                       (φ = 0)
//   Nγ = 2 · (Nq + 1) · tanφ             (Vesić)
//
// Shape factors (Meyerhof, rectangular footing B × L):
//   sc = 1 + (B/L) · (Nq/Nc)
//   sq = 1 + (B/L) · tanφ
//   sγ = 1 − 0.4 · (B/L)
//
// Depth factors (Df ≤ B):
//   k = Df / B            if Df ≤ B
//   k = atan(Df / B)      if Df > B
//   dc = 1 + 0.4 · k                                (φ = 0)
//   dq = 1 + 2 · tanφ · (1 − sinφ)² · k             (φ > 0)
//   dγ = 1
//
// Inclination factors (load inclined at angle β from vertical):
//   iq = ic = (1 − β/90)²
//   iγ = (1 − β/φ)²       (φ > 0; otherwise iγ = 1)
//   β = atan(H/V)          β in degrees
//
// Allowable bearing: qa,ult = qu / FS_bearing.
// Net allowable: subtract overburden q from qu before dividing by FS.

export function meyerhofBearing(opts: {
  c: number;       // cohesion (kPa)
  gamma: number;   // unit weight (kN/m³)
  B: number;       // footing width — perpendicular to wall length (mm)
  L: number;       // footing length — along wall (mm); use a large value (e.g. 10·B) for "strip" footings
  Df: number;      // embedment depth from grade to base of footing (mm)
  phi: number;     // friction angle (radians)
  q: number;       // overburden pressure at footing level (kPa)
  H: number;       // factored horizontal load (kN/m)
  V: number;       // factored vertical load (kN/m)
  FS_bearing: number;
}): NonNullable<StabilityResult['bearingMeyerhof']> {
  const { c, gamma, phi, q, H, V, FS_bearing } = opts;
  const B = opts.B / 1000;   // mm → m
  const L = opts.L / 1000;
  const Df = opts.Df / 1000;
  const ratio = B / L;

  const tanPhi = Math.tan(phi);
  const sinPhi = Math.sin(phi);

  // Bearing capacity factors
  let Nq: number, Nc: number, Ng: number;
  if (phi <= 1e-6) {
    Nc = 5.14;
    Nq = 1.0;
    Ng = 0.0;
  } else {
    Nq = Math.exp(Math.PI * tanPhi) * Math.pow(Math.tan(Math.PI / 4 + phi / 2), 2);
    Nc = (Nq - 1) / tanPhi;
    Ng = 2 * (Nq + 1) * tanPhi;        // Vesić
  }

  // Shape factors
  const sc = 1 + ratio * (Nq / Math.max(Nc, 1e-9));
  const sq = 1 + ratio * tanPhi;
  const sg = Math.max(0.6, 1 - 0.4 * ratio); // floor at 0.6 to avoid weird narrow-strip values

  // Depth factors
  const k = Df <= B ? Df / B : Math.atan(Df / B);
  const dc = 1 + 0.4 * k;
  const dq = phi > 1e-6 ? 1 + 2 * tanPhi * Math.pow(1 - sinPhi, 2) * k : 1.0;
  const dg = 1.0;

  // Inclination factors (Meyerhof)
  const beta_deg = (Math.atan2(Math.max(H, 0), Math.max(V, 1e-9)) * 180) / Math.PI;
  const iq = Math.pow(Math.max(0, 1 - beta_deg / 90), 2);
  const ic = iq;
  const phi_deg = (phi * 180) / Math.PI;
  const ig = phi > 1e-6 ? Math.pow(Math.max(0, 1 - beta_deg / phi_deg), 2) : 1.0;

  // qu (kPa). γ is in kN/m³, B in m → product in kPa.
  const qu =
    c * Nc * sc * dc * ic
    + q * Nq * sq * dq * iq
    + 0.5 * gamma * B * Ng * sg * dg * ig;

  const qaUlt = (qu - q) / FS_bearing + q; // net allowable + overburden
  return { qu, Nc, Nq, Ng, sc, sq, sg, dc, dq, dg, ic, iq, ig, qaUlt };
}

// ─── Multi-layer stem rebar with curtailment — ACI 318-25 §9.7.3 ─────────
//
// Given the moment envelope along the stem (M(y) where y is elevation above
// footing top), build a layered rebar plan:
//
//   • At the base, As_max sized to peak demand.
//   • Bars are extended UP the stem until the moment demand drops below the
//     capacity of the next-smaller layer.
//   • Each curtailment point shifted UP by max(d, 12 db) per §9.7.3.3
//     (the "shift rule").
//   • Minimum reinforcement always ≥ ρ_min = 0.0018 (§24.4.3 temperature).
//
// This is a simplified one-curtailment-step routine. It returns 1–3 zones:
//   Zone 1 — base of stem to y1 (peak demand, full As)
//   Zone 2 — y1 to y2 (reduced As)
//   Zone 3 — y2 to top (As_min)
//
// For a typical cantilever wall the moment varies as M(y) = (1/3)·γ·Ka·(H-y)³
// + (1/2)·γ_q·Ka·(H-y)² (active triangle + surcharge rectangle). We use the
// caller-provided sample points; they need not be analytic.

export function multiLayerStemRebar(opts: {
  /** Sample points {y_above_base_mm, M_kNm_per_m}, sorted by y ascending. */
  envelope: { y: number; M: number }[];
  /** Stem effective depth d (mm) at base for shift calc. */
  d_base: number;
  /** Bar diameter at the base layer (mm). */
  db_base: number;
  /** Concrete cover (mm). */
  cover: number;
  /** Material strengths. */
  fc: number;
  fy: number;
  /** Wall thickness at base (mm). For per-metre design we use 1000 width. */
  h_base: number;
  /** As_min per metre (mm²/m). */
  As_min: number;
  /** Bar designation at base (e.g. "#6"). */
  barLabel: string;
  /** Spacing of base layer bars (mm). */
  spacing_base: number;
}): RebarCurtailmentZone[] {
  if (opts.envelope.length === 0) return [];
  const Mmax = Math.max(...opts.envelope.map((p) => p.M));
  if (Mmax <= 0) return [];

  // Peak demand at the base (largest M). Floor at As_min so the base layer
  // is never lighter than ACI 318-25 §24.4.3 temperature/shrinkage steel.
  const As_peak_calc = solveAsForM(Mmax, opts.h_base, opts.cover, opts.fc, opts.fy);
  const As_peak_per_m = Math.max(As_peak_calc, opts.As_min);

  // Curtailment threshold: switch to the lighter (As_min) layer when M drops
  // below half of peak (a pragmatic 50 % rule that matches Wight §10.6).
  // Apply the §9.7.3.3 shift rule: extend the bar at least max(d, 12 db) past
  // the cut point.
  const shift = Math.max(opts.d_base, 12 * opts.db_base);
  const M_threshold = 0.5 * Mmax;

  // Find first y where M ≤ threshold
  const cutPoint = opts.envelope.find((p) => p.M <= M_threshold);
  let y_cut = cutPoint ? cutPoint.y : (opts.envelope[opts.envelope.length - 1]?.y ?? 0);
  y_cut = Math.min(y_cut + shift, opts.envelope[opts.envelope.length - 1]?.y ?? y_cut);

  const zones: RebarCurtailmentZone[] = [];
  // Zone 1: base → cut point
  zones.push({
    yStart: 0,
    yEnd: y_cut,
    bar: opts.barLabel,
    spacing: opts.spacing_base,
    As_per_m: As_peak_per_m,
    As_req_max: As_peak_per_m,
    ok: As_peak_per_m >= opts.As_min,
  });
  // Zone 2: cut point → top — light steel only
  const yTop = opts.envelope[opts.envelope.length - 1]?.y ?? 0;
  if (yTop > y_cut) {
    zones.push({
      yStart: y_cut,
      yEnd: yTop,
      bar: opts.barLabel,
      spacing: opts.spacing_base * 2,                      // halve the bars (alternate layout)
      As_per_m: opts.As_min,
      As_req_max: Math.min(M_threshold > 0 ? solveAsForM(M_threshold, opts.h_base, opts.cover, opts.fc, opts.fy) : 0, As_peak_per_m),
      ok: opts.As_min > 0,
    });
  }
  return zones;
}

/**
 * Solve As (mm²/m) needed to resist Mu (kN·m/m) for a rectangular section
 * with width = 1000 mm, total depth = h, cover = cover, fc, fy.
 *
 * Uses the iterative Whitney rectangular block: solves
 *   φMn = φ·As·fy·(d − a/2),  a = As·fy / (0.85·fc·b)
 * for As. Iteration converges in 3–5 steps.
 */
function solveAsForM(Mu_kNm: number, h: number, cover: number, fc: number, fy: number): number {
  const phi = 0.9;
  const b = 1000;
  const d = h - cover - 12;          // assume #4–#5 bar centroid offset of 12 mm
  const Mu_Nmm = Mu_kNm * 1_000_000;
  let As = Mu_Nmm / (phi * fy * 0.9 * d);   // initial guess, jd ≈ 0.9d
  for (let i = 0; i < 8; i++) {
    const a = (As * fy) / (0.85 * fc * b);
    const denom = phi * fy * (d - a / 2);
    if (denom <= 0) return Mu_Nmm / (phi * fy * 0.5 * d); // ill-conditioned; fall back
    const As_new = Mu_Nmm / denom;
    if (Math.abs(As_new - As) < 0.5) { As = As_new; break; }
    As = As_new;
  }
  return As;
}
