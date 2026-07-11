// Load Generator types — ASCE 7-22 Wind + Snow + Seismic.
// SI internal: lengths mm, velocity m/s, pressure Pa, force kN.

export type DesignCode =
  | 'ASCE-7-22'
  | 'ASCE-7-16'
  | 'ASCE-7-10'
  | 'EN-1991'
  | 'NBCC-2020'
  | 'NBCC-2015'
  | 'AS-NZS-1170'
  | 'AS-4055-2021'
  | 'CTE-DB-SE-AE'
  | 'SANS-10160-3'
  | 'IS-875-2015'
  | 'NSCP-2015'
  | 'CFE-Viento-2020'
  | 'CFE-Viento-2008';

export type RiskCategory = 'I' | 'II' | 'III' | 'IV';
export type ExposureCategory = 'B' | 'C' | 'D';
export type SiteClass = 'A' | 'B' | 'C' | 'D' | 'E' | 'F' | 'Default';
export type RoofType = 'flat' | 'gable' | 'hip' | 'monoslope';
export type Enclosure = 'enclosed' | 'partially-enclosed' | 'open';

// ======================== Inputs =========================

export interface LocationData {
  lat: number;
  lng: number;
  formattedAddress?: string;
  elevation: number; // m above sea level (SI)
}

export interface SiteData {
  location: LocationData | null;
  riskCategory: RiskCategory;
  exposure: ExposureCategory;
  siteClass: SiteClass; // for seismic — unused in wind MVP but kept for future
  V: number; // 3-second gust design wind speed (m/s)
  V_source: 'ATC' | 'interpolated' | 'manual';
}

export interface StructureData {
  H: number; // mean roof height (mm) — used for Kz and qh
  L: number; // building length, plan, parallel to wind (mm)
  B: number; // building width, plan, perpendicular to wind (mm)
  roofType: RoofType;
  roofSlope: number; // degrees (0 for flat)
  enclosure: Enclosure;
  // Directionality + topographic (default conservative)
  Kd: number;      // Table 26.6-1; 0.85 for MWFRS buildings
  Kzt: number;     // topographic factor, default 1.0 (flat ground)
}

// ---- Snow (ASCE 7-22 Chapter 7) ----
export type SnowTerrain = 'B' | 'C' | 'D' | 'above-treeline' | 'alaska-no-trees';
export type RoofExposure = 'fully-exposed' | 'partially-exposed' | 'sheltered';
export type ThermalCondition =
  | 'heated'              // Ct = 1.0 — heated, all other structures (Table 7.3-2)
  | 'heated-unventilated' // Ct from Table 7.3-3 (roof R-value × pg matrix)
  | 'cold-ventilated'     // Ct = 1.2 — cold / ventilated roof, R ≥ 25 (ASCE 7-22)
  | 'unheated'            // Ct = 1.2 — unheated & open-air structures
  | 'below-freezing'      // Ct = 1.3 — intentionally kept below freezing
  | 'greenhouse';         // Ct = 0.85 — continuously heated greenhouse (roof R < 2)

export interface SnowData {
  pg: number;            // ground snow load — stored in Pa (pressureSmall)
  terrain: SnowTerrain;
  roofExposure: RoofExposure;
  thermal: ThermalCondition;
  roofR: number;         // roof thermal resistance R (h·ft²·°F/Btu) — for Table 7.3-3
  roofSlope: number;     // degrees (uses StructureData.roofSlope if linked; kept separate for clarity)
  slippery: boolean;     // unobstructed slippery surface (metal, membrane, glass)
  eaveToRidge: number;   // W — horizontal eave-to-ridge distance, stored in mm (for rain-on-snow slope check)
}

// ---- Seismic (ASCE 7-22 Chapters 11–12, ELF) ----
export type SeismicSystemPeriod =
  | 'steel-moment'      // Ct = 0.028, x = 0.8
  | 'concrete-moment'   // Ct = 0.016, x = 0.9
  | 'steel-ebf'         // Ct = 0.03,  x = 0.75
  | 'steel-brb'         // Ct = 0.03,  x = 0.75
  | 'other';            // Ct = 0.02,  x = 0.75

export interface SeismicData {
  // ASCE 7-22 takes the design spectral accelerations directly from the USGS
  // Seismic Design Geodatabase (Hazard Tool) for the site class — the Fa/Fv
  // site-coefficient tables of 7-16 were deleted (§11.4.3, C11.4.3).
  SDS: number;          // design short-period spectral accel (g)
  SD1: number;          // design 1-s spectral accel (g)
  S1: number;           // mapped 1-s spectral accel (g) — for §11.6 SDC override & near-fault Cs floor
  TL: number;           // long-period transition (s)
  R: number;            // response modification coefficient (Table 12.2-1)
  systemPeriod: SeismicSystemPeriod;
  hn: number;           // structural height — stored in mm (converted to ft for Ta)
  W: number;            // effective seismic weight — stored in kN (SI 'force' base)
  stories: number;      // number of stories for vertical force distribution (equal w & h assumed)
  // riskCategory is read from SiteData (shared)
}

export interface LoadGenInput {
  code: DesignCode;
  site: SiteData;
  structure: StructureData;
  snow: SnowData;
  seismic: SeismicData;
}

// ======================== Results ========================

export interface VelocityPressureBreakdown {
  V: number;         // m/s
  V_mph: number;     // display
  Kz: number;        // at mean roof height (Kh)
  Kzt: number;
  Kd: number;
  Ke: number;
  qh: number;        // Pa — velocity pressure at mean roof height
}

export interface WallPressures {
  windward: number;  // Pa, positive = pushes into wall
  leeward: number;   // Pa, negative = suction
  side: number;      // Pa, negative
  GCpi_pos: number;  // +internal pressure coefficient
  GCpi_neg: number;  // -internal pressure coefficient
  // Net design pressures (external + internal worst)
  windwardDesign: number;
  leewardDesign: number;
  sideDesign: number;
}

export interface RoofPressure {
  zone: string;      // 'windward', 'leeward', '0-h/2', etc. (varies by slope)
  Cp: number;
  p: number;         // Pa design pressure (worst case w/ +/- GCpi)
}

export interface MwfrsResult {
  G: number;         // gust factor (0.85 rigid)
  walls: WallPressures;
  roof: RoofPressure[];
}

export interface CCZone {
  label: string;     // "Wall 4", "Wall 5", "Roof 1", "Roof 2", "Roof 3"
  GCp_pos: number;
  GCp_neg: number;
  p_pos: number;     // Pa
  p_neg: number;     // Pa
  area_ref: number;  // reference effective area, ft² in docs (we use 10 ft²)
}

export interface CCResult {
  a: number;         // zone boundary distance (mm), min(0.1·least, 0.4·h), ≥ 3 ft
  walls: CCZone[];   // Zone 4 interior + Zone 5 corner
  roof: CCZone[];    // Zone 1, 2, 3 (flat) or 1, 2e, 2r, 3 (sloped)
}

export interface WindResult {
  breakdown: VelocityPressureBreakdown;
  mwfrs: MwfrsResult;
  cc: CCResult;
  issues: string[];
  errors: string[];
}

// ---- Snow results ----
export interface SnowResult {
  Ce: number;
  Ct: number;
  pf: number;            // flat-roof snow load (Pa)
  Cs: number;            // roof slope factor
  ps: number;            // sloped-roof (balanced) snow load (Pa)
  pm: number;            // minimum snow load for low-slope roofs (Pa)
  rainOnSnow: number;    // rain-on-snow surcharge (Pa, added to pf)
  governing: number;     // governing balanced roof snow load (Pa)
  slopeFactorApplies: boolean;
  minimumGoverns: boolean;
  issues: string[];
  errors: string[];
}

// ---- Seismic results ----
export interface SeismicStoryForce {
  level: number;         // 1 = base-most story, N = roof
  hx: number;            // height above base (mm)
  wx: number;            // story weight (kN)
  Cvx: number;           // vertical distribution factor
  Fx: number;            // lateral force at level (kN)
  Vx: number;            // story shear at & below level (kN)
}

export interface SeismicResult {
  SMS: number;           // = 1.5·SDS (derived)
  SM1: number;           // = 1.5·SD1 (derived)
  SDS: number;
  SD1: number;
  Ie: number;
  Ta: number;            // approximate fundamental period (s)
  Ts: number;            // SD1/SDS (spectrum corner period)
  k: number;             // vertical distribution exponent
  Cs: number;            // seismic response coefficient (governing)
  CsControl: string;     // which limit governs Cs
  V: number;             // seismic base shear (kN)
  SDC: 'A' | 'B' | 'C' | 'D' | 'E' | 'F';
  forces: SeismicStoryForce[];
  issues: string[];
  errors: string[];
}

export interface LoadGenResult {
  wind: WindResult | null;
  snow: SnowResult | null;
  seismic: SeismicResult | null;
}
