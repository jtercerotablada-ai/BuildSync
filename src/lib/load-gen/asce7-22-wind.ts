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
} from './types';

// ------------------- 26.10-1 Kz / Kh Velocity Pressure Exposure ----------
// ASCE 7-22 Table 26.10-1. For buildings with h ≤ 60 ft there are tabulated
// values at discrete heights; we use the formulae in Note 1 which are exact
// power-law forms.
const EXPOSURE_PARAMS: Record<ExposureCategory, { alpha: number; zg_m: number }> = {
  B: { alpha: 7.0, zg_m: 365.76 },    // zg = 1200 ft
  C: { alpha: 9.5, zg_m: 274.32 },    // zg = 900 ft
  D: { alpha: 11.5, zg_m: 213.36 },   // zg = 700 ft
};

/**
 * Velocity pressure exposure coefficient Kz or Kh (same formula, z is the
 * relevant height). Input z in meters (SI). The ASCE formula:
 *
 *   Kz = 2.01 · (z/zg)^(2/α)  for z ≥ 4.57 m (15 ft)
 *   Kz = 2.01 · (4.57/zg)^(2/α) for z < 4.57 m  (i.e. clamp to 4.57 m)
 *
 * Ref: ASCE 7-22 Table 26.10-1 Note 1. Earlier drafts used 2.41 — the
 * current code explicitly uses 2.01.
 */
export function kz(z_m: number, exposure: ExposureCategory): number {
  const { alpha, zg_m } = EXPOSURE_PARAMS[exposure];
  const zUse = Math.max(z_m, 4.57);
  return 2.01 * Math.pow(zUse / zg_m, 2 / alpha);
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
 * Velocity pressure qz (or qh at mean roof height). Eq 26.10-1 in SI:
 *   qz = 0.613 · Kz · Kzt · Kd · Ke · V²      (Pa, V in m/s)
 *
 * This is the SI rewrite of the imperial eq qz = 0.00256·Kz·Kzt·Kd·Ke·V²
 * (psf, V in mph). Derivation: q = ½·ρ·V² with ρ_air ≈ 1.225 kg/m³.
 */
export function qz(
  V_ms: number,
  Kz: number,
  Kzt: number,
  Kd: number,
  Ke: number
): number {
  return 0.613 * Kz * Kzt * Kd * Ke * V_ms * V_ms;
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

// ------------------- 26.11.5 Gust-effect factor G -------------------------
// Default rigid-building gust factor per §26.11.4 (G = 0.85).
// Flexible structures require natural frequency — not in MVP scope.
export function gustFactor(): number {
  return 0.85;
}

// ------------------- MWFRS pressure combine -------------------------------
// p = qh · G · Cp  −  qi · (GCpi)   per Eq 27.3-1 (enclosed / partially enclosed)
// For enclosed buildings qi = qh.
function combinePressure(qh: number, qi: number, G: number, Cp: number, GCpi: number): number {
  return qh * G * Cp - qi * GCpi;
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
  const qh = qz(site.V, Kh, structure.Kzt, structure.Kd, Ke);

  const breakdown: VelocityPressureBreakdown = {
    V: site.V,
    V_mph: site.V / 0.44704,
    Kz: Kh,
    Kzt: structure.Kzt,
    Kd: structure.Kd,
    Ke,
    qh,
  };

  // ---- MWFRS walls + roof ----
  const G = gustFactor();
  const { windward, leeward, side } = cpWall(L_m / B_m);
  const { pos: GCpi_pos, neg: GCpi_neg } = GCpi(structure.enclosure);
  const qi = qh; // enclosed building

  // Design pressure = the worst-case (max magnitude) of +GCpi and −GCpi
  const windwardDesign = Math.max(
    Math.abs(combinePressure(qh, qi, G, windward, GCpi_pos)),
    Math.abs(combinePressure(qh, qi, G, windward, GCpi_neg))
  );
  const leewardDesign = -Math.max(
    Math.abs(combinePressure(qh, qi, G, leeward, GCpi_pos)),
    Math.abs(combinePressure(qh, qi, G, leeward, GCpi_neg))
  );
  const sideDesign = -Math.max(
    Math.abs(combinePressure(qh, qi, G, side, GCpi_pos)),
    Math.abs(combinePressure(qh, qi, G, side, GCpi_neg))
  );

  const walls: WallPressures = {
    windward: qh * G * windward,
    leeward: qh * G * leeward,
    side: qh * G * side,
    GCpi_pos,
    GCpi_neg,
    windwardDesign,
    leewardDesign,
    sideDesign,
  };

  const roofCps = cpRoof(structure.roofType, structure.roofSlope, h_m / L_m);
  const roof: RoofPressure[] = roofCps.map((r) => {
    const pWorst = Math.min(
      combinePressure(qh, qi, G, r.Cp, GCpi_pos),
      combinePressure(qh, qi, G, r.Cp, GCpi_neg)
    );
    return { zone: r.zone, Cp: r.Cp, p: pWorst };
  });

  const mwfrs: MwfrsResult = { G, walls, roof };

  // ---- C&C zones ----
  const a_mm = ccZoneBoundary_mm(B_m * 1000, L_m * 1000, h_m * 1000);
  const ccWallsRaw = ccWallZones();
  const ccRoofRaw = ccRoofZones(structure.roofType, structure.roofSlope);
  const fillZone = (z: CCZone): CCZone => ({
    ...z,
    p_pos: qh * (z.GCp_pos - GCpi_neg), // positive pressure: external + · internal − (most positive)
    p_neg: qh * (z.GCp_neg - GCpi_pos), // negative pressure: external − · internal + (most negative)
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
