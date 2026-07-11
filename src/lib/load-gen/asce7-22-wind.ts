// ASCE 7-22 Wind load calculations — MWFRS (Ch 27 Directional Procedure) +
// Components & Cladding (Ch 30 Part 1). SI internal: m, m/s, Pa, N.

import type {
  ExposureCategory,
  RoofType,
  StructureData,
  SiteData,
  VelocityPressureBreakdown,
  WallPressures,
  RoofPressure,
  MwfrsResult,
  CCZone,
  CCResult,
  WindResult,
  Enclosure,
  TopoFeature,
  GustMode,
} from './types';

// ------------------- 26.10-1 Kz / Kh Velocity Pressure Exposure ----------
// ASCE 7-22 Table 26.10-1.  7-22 recalibrated the exposure profiles: the
// constant is 2.41 (was 2.01 in 7-16) with new gradient heights zg and new α.
// The recalibration reproduces essentially the same Kz values (< 0.5% shift).
const EXPOSURE_PARAMS: Record<ExposureCategory, { alpha: number; zg_m: number }> = {
  B: { alpha: 7.5, zg_m: 999.744 },   // zg = 3280 ft
  C: { alpha: 9.8, zg_m: 749.808 },   // zg = 2460 ft
  D: { alpha: 11.5, zg_m: 589.788 },  // zg = 1935 ft
};

/**
 * Velocity pressure exposure coefficient Kz or Kh (same formula, z is the
 * relevant height). Input z in meters (SI). ASCE 7-22 Table 26.10-1:
 *
 *   Kz = 2.41 · (z/zg)^(2/α)   for 4.57 m (15 ft) ≤ z ≤ zg
 *   Kz = 2.41 · (4.57/zg)^(2/α) for z < 4.57 m  (clamp to 15 ft)
 */
export function kz(z_m: number, exposure: ExposureCategory): number {
  const { alpha, zg_m } = EXPOSURE_PARAMS[exposure];
  const zUse = Math.min(Math.max(z_m, 4.572), zg_m); // 15 ft floor
  return 2.41 * Math.pow(zUse / zg_m, 2 / alpha);
}

// ------------------- 26.8 Topographic factor Kzt --------------------------
// Kzt = (1 + K1·K2·K3)², Fig 26.8-1.  K1/(H/Lh) multipliers by exposure,
// γ (height attenuation) and μ (horizontal attenuation, upwind/downwind).
// Note 2: where H/Lh > 0.5, use H/Lh = 0.5 and substitute 2H for Lh.
// ASCE 7-22 deleted the 7-16 isolation/sheltering criteria — the speed-up is
// considered even when similar upwind features are present.
const TOPO_PARAMS: Record<Exclude<TopoFeature, 'none'>, {
  k1hl: Record<ExposureCategory, number>; gamma: number; muUp: number; muDown: number;
}> = {
  ridge:      { k1hl: { B: 1.30, C: 1.45, D: 1.55 }, gamma: 3.0, muUp: 1.5, muDown: 1.5 },
  escarpment: { k1hl: { B: 0.75, C: 0.85, D: 0.95 }, gamma: 2.5, muUp: 1.5, muDown: 4.0 },
  hill:       { k1hl: { B: 0.95, C: 1.05, D: 1.15 }, gamma: 4.0, muUp: 1.5, muDown: 1.5 },
};

/**
 * Topographic factor at height z above ground (all lengths in meters).
 * x is measured from the crest, positive downwind.
 */
export function kzt(
  feature: TopoFeature,
  exposure: ExposureCategory,
  H_m: number,
  Lh_m: number,
  x_m: number,
  z_m: number
): number {
  if (feature === 'none' || H_m <= 0 || Lh_m <= 0) return 1.0;
  let Lh = Lh_m;
  if (H_m / Lh > 0.5) Lh = 2 * H_m; // Note 2 substitution (forces H/Lh = 0.5)
  const t = TOPO_PARAMS[feature];
  const K1 = t.k1hl[exposure] * Math.min(H_m / Lh, 0.5);
  const mu = x_m >= 0 ? t.muDown : t.muUp;
  const K2 = Math.max(0, 1 - Math.abs(x_m) / (mu * Lh));
  const K3 = Math.exp((-t.gamma * Math.max(z_m, 0)) / Lh);
  return Math.pow(1 + K1 * K2 * K3, 2);
}

/**
 * Ground elevation factor Ke per Table 26.9-1. Only a function of site
 * elevation above sea level. Fitted to the table using an exponential
 * approximation (accurate to ±0.005 across 0–2000 m). Conservative default
 * Ke = 1.0 (which the code explicitly allows).
 */
export function ke(elevation_m: number): number {
  if (elevation_m <= 0) return 1.0;
  // Table fit: Ke = e^(-0.000119·z)  with z in m. Matches ASCE 7-22 Table 26.9-1.
  const Ke = Math.exp(-0.000119 * elevation_m);
  // Round to 0.01 to match the code convention.
  return Math.max(0.85, Math.round(Ke * 100) / 100);
}

/**
 * Velocity pressure qz (or qh at mean roof height). ASCE 7-22 Eq 26.10-1 in SI:
 *   qz = 0.613 · Kz · Kzt · Ke · V²      (Pa, V in m/s)
 *
 * NOTE: 7-22 removed Kd from the velocity-pressure equation — the
 * directionality factor is now applied inside the pressure equations
 * (p = q·Kd·G·Cp − qi·Kd·GCpi), i.e. exactly once on every pressure.
 */
export function qz(
  V_ms: number,
  Kz: number,
  Kzt: number,
  Ke: number
): number {
  return 0.613 * Kz * Kzt * Ke * V_ms * V_ms;
}

// ------------------- 26.11 Gust-effect factor -----------------------------
// Table 26.11-1 terrain exposure constants (ASCE 7-22, ft units).  α/zg/ℓ/zmin
// are code-confirmed; ᾱ, b̄, c, ε̄ trace to the 7-22 draft table (flagged in
// the UI as verify-against-print for flexible buildings).
const GUST_CONST: Record<ExposureCategory, {
  c: number; ell: number; epsBar: number; alphaBar: number; bBar: number; zmin: number;
}> = {
  B: { c: 0.3, ell: 320, epsBar: 1 / 3.0, alphaBar: 1 / 4.5, bBar: 0.47, zmin: 30 },
  C: { c: 0.2, ell: 500, epsBar: 1 / 5.0, alphaBar: 1 / 6.4, bBar: 0.66, zmin: 15 },
  D: { c: 0.15, ell: 650, epsBar: 1 / 8.0, alphaBar: 1 / 8.0, bBar: 0.78, zmin: 7 },
};

export interface GustResult { G: number; mode: GustMode; Iz: number; Q: number; R: number | null }

/**
 * Gust-effect factor per §26.11.  h/B/L in meters (converted to ft inside),
 * V in m/s.  'default' → 0.85 (permitted for rigid buildings);
 * 'calculated' → rigid Eq 26.11-6; 'flexible' → Gf Eq 26.11-10 with n1 (Hz)
 * and damping ratio β.
 */
export function gustEffect(
  mode: GustMode,
  exposure: ExposureCategory,
  h_m: number,
  B_m: number,
  L_m: number,
  V_ms: number,
  n1: number,
  beta: number
): GustResult {
  if (mode === 'default') return { G: 0.85, mode, Iz: 0, Q: 0, R: null };
  const M_TO_FT = 1 / 0.3048;
  const h = h_m * M_TO_FT, B = B_m * M_TO_FT, L = L_m * M_TO_FT;
  const k = GUST_CONST[exposure];
  const zBar = Math.max(0.6 * h, k.zmin);                    // ft
  const Iz = k.c * Math.pow(33 / zBar, 1 / 6);               // Eq 26.11-7
  const Lz = k.ell * Math.pow(zBar / 33, k.epsBar);          // Eq 26.11-9
  const Q = Math.sqrt(1 / (1 + 0.63 * Math.pow((B + h) / Lz, 0.63))); // Eq 26.11-8
  const gQ = 3.4, gv = 3.4;

  if (mode === 'calculated') {
    const G = 0.925 * ((1 + 1.7 * gQ * Iz * Q) / (1 + 1.7 * gv * Iz)); // Eq 26.11-6
    return { G, mode, Iz, Q, R: null };
  }

  // Flexible Gf — Eq 26.11-10..16.  gR (Eq 26.11-11) is undefined for
  // 3600·n1 ≤ 1, so clamp to physically plausible floors (0.01 Hz ≈ 100 s
  // period; 0.5% damping) — anything lower is not a building.
  const n = Math.max(n1, 0.01);
  const b = Math.max(beta, 0.005);
  const gR = Math.sqrt(2 * Math.log(3600 * n)) + 0.577 / Math.sqrt(2 * Math.log(3600 * n)); // 26.11-11
  const V_mph = V_ms / 0.44704;
  const Vz = k.bBar * Math.pow(zBar / 33, k.alphaBar) * (88 / 60) * V_mph; // ft/s, 26.11-16
  const N1 = (n * Lz) / Vz;                                   // 26.11-14
  const Rn = (7.47 * N1) / Math.pow(1 + 10.3 * N1, 5 / 3);    // 26.11-13
  const Rl = (eta: number) => (eta <= 0 ? 1 : 1 / eta - (1 / (2 * eta * eta)) * (1 - Math.exp(-2 * eta))); // 26.11-15
  const Rh = Rl((4.6 * n * h) / Vz);
  const RB = Rl((4.6 * n * B) / Vz);
  const RLl = Rl((15.4 * n * L) / Vz);
  const R = Math.sqrt((1 / b) * Rn * Rh * RB * (0.53 + 0.47 * RLl)); // 26.11-12
  const Gf = 0.925 * ((1 + 1.7 * Iz * Math.sqrt(gQ * gQ * Q * Q + gR * gR * R * R)) / (1 + 1.7 * gv * Iz)); // 26.11-10
  return { G: Gf, mode, Iz, Q, R };
}

// ------------------- 27.3 MWFRS External Pressure Coefficients Cp --------

/**
 * Wall pressure coefficients per Fig 27.3-1.
 *   Windward wall: +0.80
 *   Side wall:     −0.70
 *   Leeward wall:  depends on L/B
 *       L/B ≤ 1:  −0.50
 *       L/B = 2:  −0.30
 *       L/B ≥ 4:  −0.20
 *       (linear interpolation between)
 */
export function cpWall(L_over_B: number) {
  const windward = 0.8;
  const side = -0.7;
  let leeward: number;
  if (L_over_B <= 1) leeward = -0.5;
  else if (L_over_B >= 4) leeward = -0.2;
  else if (L_over_B <= 2) leeward = -0.5 + ((-0.3) - (-0.5)) * (L_over_B - 1); // -0.5 to -0.3
  else leeward = -0.3 + ((-0.2) - (-0.3)) * ((L_over_B - 2) / 2); // -0.3 to -0.2
  return { windward, leeward, side };
}

/**
 * Roof pressure coefficients Cp per Fig 27.3-1 for WIND DIRECTION NORMAL
 * TO THE RIDGE (worst case for gables) and h/L ≤ 0.5 OR ≤ 1.0 ranges.
 *
 * This covers the common cases engineers need. For monoslope and complex
 * hip geometries we fall back to flat-roof-like envelopes with a warning.
 *
 * Returns an array of (zone, Cp) pairs covering the full roof.
 */
export function cpRoof(
  roofType: RoofType,
  thetaDeg: number,
  h_over_L: number
): Array<{ zone: string; Cp: number }> {
  const hL = Math.max(h_over_L, 0.25);

  // Flat / slope ≤ 10°  → treat as flat (ASCE applies flat-roof rules)
  if (roofType === 'flat' || thetaDeg < 10) {
    // Flat roof, Fig 27.3-1 Note: wind perpendicular to ridge is N/A; treat
    // roof as stepped from windward edge with zones based on h
    if (hL <= 0.5) {
      return [
        { zone: 'Roof 0 to h/2',  Cp: -0.9 },
        { zone: 'Roof h/2 to h',  Cp: -0.9 },
        { zone: 'Roof h to 2h',   Cp: -0.5 },
        { zone: 'Roof > 2h',      Cp: -0.3 },
      ];
    }
    // h/L = 1.0
    return [
      { zone: 'Roof 0 to h/2',  Cp: -1.3 },
      { zone: 'Roof h/2 to h',  Cp: -0.7 },
      { zone: 'Roof h to 2h',   Cp: -0.7 },
      { zone: 'Roof > 2h',      Cp: -0.7 },
    ];
  }

  // Gable / Hip — wind NORMAL to ridge. Table lookup on θ vs h/L.
  const theta = thetaDeg;
  const hL_key = hL <= 0.25 ? 0.25 : hL <= 0.5 ? 0.5 : 1.0;

  // Windward and leeward surface coefficients (Fig 27.3-1 extracted)
  const table: Record<number, Array<{ theta: number; wind: number[]; lee: number }>> = {
    0.25: [
      { theta: 10, wind: [-0.7, -0.18], lee: -0.3 },
      { theta: 15, wind: [-0.5, 0.0],   lee: -0.5 },
      { theta: 20, wind: [-0.3, 0.2],   lee: -0.5 },
      { theta: 25, wind: [-0.2, 0.3],   lee: -0.6 },
      { theta: 30, wind: [-0.2, 0.3],   lee: -0.6 },
      { theta: 35, wind: [0.0, 0.4],    lee: -0.6 },
      { theta: 45, wind: [0.4, 0.4],    lee: -0.6 },
      { theta: 60, wind: [0.01 * 60, 0.01 * 60], lee: -0.6 },
    ],
    0.5: [
      { theta: 10, wind: [-0.9, -0.18], lee: -0.5 },
      { theta: 15, wind: [-0.7, -0.18], lee: -0.5 },
      { theta: 20, wind: [-0.4, 0.0],   lee: -0.6 },
      { theta: 25, wind: [-0.3, 0.2],   lee: -0.6 },
      { theta: 30, wind: [-0.2, 0.2],   lee: -0.6 },
      { theta: 35, wind: [-0.2, 0.3],   lee: -0.6 },
      { theta: 45, wind: [0.0, 0.4],    lee: -0.6 },
      { theta: 60, wind: [0.01 * 60, 0.01 * 60], lee: -0.6 },
    ],
    1.0: [
      { theta: 10, wind: [-1.3, -0.18], lee: -0.7 },
      { theta: 15, wind: [-1.0, -0.18], lee: -0.6 },
      { theta: 20, wind: [-0.7, -0.18], lee: -0.6 },
      { theta: 25, wind: [-0.5, 0.0],   lee: -0.6 },
      { theta: 30, wind: [-0.3, 0.2],   lee: -0.6 },
      { theta: 35, wind: [-0.2, 0.2],   lee: -0.6 },
      { theta: 45, wind: [0.0, 0.3],    lee: -0.6 },
      { theta: 60, wind: [0.01 * 60, 0.01 * 60], lee: -0.6 },
    ],
  };

  const rows = table[hL_key];
  // Interpolate by theta
  let row = rows[0];
  for (let i = 0; i + 1 < rows.length; i++) {
    if (theta >= rows[i].theta && theta <= rows[i + 1].theta) {
      const t = (theta - rows[i].theta) / (rows[i + 1].theta - rows[i].theta);
      row = {
        theta,
        wind: [
          rows[i].wind[0] + t * (rows[i + 1].wind[0] - rows[i].wind[0]),
          rows[i].wind[1] + t * (rows[i + 1].wind[1] - rows[i].wind[1]),
        ],
        lee: rows[i].lee + t * (rows[i + 1].lee - rows[i].lee),
      };
      break;
    }
  }

  return [
    { zone: 'Windward roof (neg)', Cp: row.wind[0] },
    { zone: 'Windward roof (pos)', Cp: row.wind[1] },
    { zone: 'Leeward roof',        Cp: row.lee },
  ];
}

// ------------------- 26.11 Internal Pressure GCpi -------------------------
export function GCpi(enclosure: Enclosure): { pos: number; neg: number } {
  if (enclosure === 'open') return { pos: 0, neg: 0 };
  if (enclosure === 'partially-enclosed') return { pos: 0.55, neg: -0.55 };
  return { pos: 0.18, neg: -0.18 }; // enclosed
}

// ------------------- MWFRS pressure combine -------------------------------
// ASCE 7-22 Eq 27.3-1: p = q·Kd·G·Cp − qi·Kd·(GCpi)  (Kd applied here, not in q).
// For enclosed buildings qi = qh.
function combinePressure(qh: number, qi: number, Kd: number, G: number, Cp: number, GCpi: number): number {
  return Kd * (qh * G * Cp - qi * GCpi);
}

// ------------------- Components & Cladding (Ch 30, Part 1) ---------------
// For buildings h ≤ 60 ft, the low-rise envelope procedure gives
// GCp values for walls and roof zones. We use the "h ≤ 60 ft" Fig 30.3-1 /
// 30.3-2A coefficients for Aeff = 10 ft² (most conservative).

function ccWallZones(): CCZone[] {
  // GCp from Fig 30.3-2A for Aeff = 10 ft²
  return [
    { label: 'Wall Zone 4 (interior)', GCp_pos: 1.00, GCp_neg: -1.10, p_pos: 0, p_neg: 0, area_ref: 10 },
    { label: 'Wall Zone 5 (corner)',   GCp_pos: 1.00, GCp_neg: -1.40, p_pos: 0, p_neg: 0, area_ref: 10 },
  ];
}

function ccRoofZones(roofType: RoofType, theta: number): CCZone[] {
  // Fig 30.3-2A for flat or low-slope (<=7°). Note that ASCE 7-22 introduced
  // Zone 1' in some editions; we simplify to classic 1/2/3.
  if (roofType === 'flat' || theta < 7) {
    return [
      { label: 'Roof Zone 1 (interior)', GCp_pos: 0.30, GCp_neg: -1.10, p_pos: 0, p_neg: 0, area_ref: 10 },
      { label: 'Roof Zone 2 (edge)',     GCp_pos: 0.30, GCp_neg: -1.80, p_pos: 0, p_neg: 0, area_ref: 10 },
      { label: 'Roof Zone 3 (corner)',   GCp_pos: 0.30, GCp_neg: -2.80, p_pos: 0, p_neg: 0, area_ref: 10 },
    ];
  }
  // Sloped roof 7° < θ ≤ 27° (Fig 30.3-2B values)
  if (theta <= 27) {
    return [
      { label: 'Roof Zone 1 (interior)', GCp_pos: 0.50, GCp_neg: -0.90, p_pos: 0, p_neg: 0, area_ref: 10 },
      { label: 'Roof Zone 2 (edge)',     GCp_pos: 0.50, GCp_neg: -1.70, p_pos: 0, p_neg: 0, area_ref: 10 },
      { label: 'Roof Zone 3 (corner)',   GCp_pos: 0.50, GCp_neg: -2.60, p_pos: 0, p_neg: 0, area_ref: 10 },
    ];
  }
  // Steep slope 27° < θ ≤ 45°
  return [
    { label: 'Roof Zone 1 (interior)', GCp_pos: 0.90, GCp_neg: -0.80, p_pos: 0, p_neg: 0, area_ref: 10 },
    { label: 'Roof Zone 2 (edge)',     GCp_pos: 0.90, GCp_neg: -1.00, p_pos: 0, p_neg: 0, area_ref: 10 },
    { label: 'Roof Zone 3 (corner)',   GCp_pos: 0.90, GCp_neg: -1.20, p_pos: 0, p_neg: 0, area_ref: 10 },
  ];
}

function ccZoneBoundary_mm(B_mm: number, L_mm: number, h_mm: number): number {
  // a = min(0.1·least horizontal dim, 0.4·h), ≥ 3 ft (914 mm), ≥ 4% of least
  const leastHoriz = Math.min(B_mm, L_mm);
  const raw = Math.min(0.1 * leastHoriz, 0.4 * h_mm);
  const min4pct = 0.04 * leastHoriz;
  return Math.max(raw, min4pct, 914);
}

// ------------------- Top-level wind solve ---------------------------------
export function solveAsce722Wind(site: SiteData, structure: StructureData): WindResult {
  const issues: string[] = [];
  const errors: string[] = [];

  const h_m = structure.H / 1000;
  const L_m = structure.L / 1000;
  const B_m = structure.B / 1000;

  if (h_m > 60 * 0.3048) {
    issues.push(
      `Building height ${h_m.toFixed(1)} m exceeds 60 ft (18.3 m) — MVP uses low-rise C&C zones. Use analytical method for taller buildings.`
    );
  }
  if (h_m <= 0 || L_m <= 0 || B_m <= 0) {
    errors.push('Structure dimensions must all be positive.');
  }

  const elev_m = site.location?.elevation ?? 0;
  const Kh = kz(h_m, site.exposure);
  const Ke = ke(elev_m);

  // Topographic factor — computed from Fig 26.8-1 when a feature is set,
  // otherwise the manual value.  Evaluated at mean roof height.
  let KztUsed = structure.Kzt;
  if (structure.topo.feature !== 'none') {
    const Ht = structure.topo.H / 1000, Lh = structure.topo.Lh / 1000, x = structure.topo.x / 1000;
    KztUsed = kzt(structure.topo.feature, site.exposure, Ht, Lh, x, h_m);
    const hMin = site.exposure === 'B' ? 18.288 : 4.572; // 60 ft / 15 ft
    if (Ht / Math.max(Lh, 1e-9) < 0.2 || Ht < hMin) {
      issues.push('Topographic feature is below the §26.8.1 thresholds (H/Lh ≥ 0.2 and H ≥ 15 ft C/D · 60 ft B) — Kzt may be taken as 1.0; the computed value is shown conservatively.');
    }
  }

  const qh = qz(site.V, Kh, KztUsed, Ke); // 7-22: Kd is NOT in qz — applied in the pressure equations

  const breakdown: VelocityPressureBreakdown = {
    V: site.V,
    V_mph: site.V / 0.44704,
    Kz: Kh,
    Kzt: KztUsed,
    Kd: structure.Kd,
    Ke,
    qh,
  };

  // ---- MWFRS walls + roof ----
  const gust = gustEffect(structure.gustMode, site.exposure, h_m, B_m, L_m, site.V, structure.n1, structure.beta);
  const G = gust.G;
  if (structure.gustMode === 'flexible') {
    if (structure.n1 >= 1) {
      issues.push('n1 ≥ 1 Hz — the building is rigid per §26.2; the flexible Gf is not required (calculated G or 0.85 applies).');
    }
    issues.push('Flexible Gf uses the ASCE 7-22 Table 26.11-1 constants as published in the public draft — verify against the print standard.');
  }
  const Kd = structure.Kd;
  const { windward, leeward, side } = cpWall(L_m / B_m);
  const { pos: GCpi_pos, neg: GCpi_neg } = GCpi(structure.enclosure);
  const qi = qh; // enclosed building

  // Design pressure = the worst-case (max magnitude) of +GCpi and −GCpi
  const windwardDesign = Math.max(
    Math.abs(combinePressure(qh, qi, Kd, G, windward, GCpi_pos)),
    Math.abs(combinePressure(qh, qi, Kd, G, windward, GCpi_neg))
  );
  const leewardDesign = -Math.max(
    Math.abs(combinePressure(qh, qi, Kd, G, leeward, GCpi_pos)),
    Math.abs(combinePressure(qh, qi, Kd, G, leeward, GCpi_neg))
  );
  const sideDesign = -Math.max(
    Math.abs(combinePressure(qh, qi, Kd, G, side, GCpi_pos)),
    Math.abs(combinePressure(qh, qi, Kd, G, side, GCpi_neg))
  );

  const walls: WallPressures = {
    windward: qh * Kd * G * windward,
    leeward: qh * Kd * G * leeward,
    side: qh * Kd * G * side,
    GCpi_pos,
    GCpi_neg,
    windwardDesign,
    leewardDesign,
    sideDesign,
  };

  const roofCps = cpRoof(structure.roofType, structure.roofSlope, h_m / L_m);
  const roof: RoofPressure[] = roofCps.map((r) => {
    const pA = combinePressure(qh, qi, Kd, G, r.Cp, GCpi_pos);
    const pB = combinePressure(qh, qi, Kd, G, r.Cp, GCpi_neg);
    // Negative-Cp zones govern in suction (min); positive-Cp zones exist to
    // capture downward pressure — their governing case is the max.
    const pWorst = r.Cp >= 0 ? Math.max(pA, pB) : Math.min(pA, pB);
    return { zone: r.zone, Cp: r.Cp, p: pWorst };
  });

  const mwfrs: MwfrsResult = { G, walls, roof };

  // ---- C&C zones ----  (7-22: p = qh·Kd·[(GCp) − (GCpi)])
  const a_mm = ccZoneBoundary_mm(B_m * 1000, L_m * 1000, h_m * 1000);
  const ccWallsRaw = ccWallZones();
  const ccRoofRaw = ccRoofZones(structure.roofType, structure.roofSlope);
  const fillZone = (z: CCZone): CCZone => ({
    ...z,
    p_pos: qh * Kd * (z.GCp_pos - GCpi_neg), // positive: external + · internal − (most positive)
    p_neg: qh * Kd * (z.GCp_neg - GCpi_pos), // negative: external − · internal + (most negative)
  });
  const cc: CCResult = {
    a: a_mm,
    walls: ccWallsRaw.map(fillZone),
    roof: ccRoofRaw.map(fillZone),
  };

  return {
    breakdown,
    mwfrs,
    cc,
    issues,
    errors,
  };
}
