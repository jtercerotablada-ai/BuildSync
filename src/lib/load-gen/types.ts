// Load Generator types — ASCE 7-22 Wind MVP.
// SI internal: lengths mm, velocity m/s, pressure Pa, force N.

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

export interface LoadGenInput {
  code: DesignCode;
  site: SiteData;
  structure: StructureData;
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
