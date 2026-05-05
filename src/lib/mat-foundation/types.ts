/**
 * Mat Foundation Design — Phase C
 * --------------------------------
 *
 * Per ACI 318-25 §13.3.4 and Wight & MacGregor 7e §15-7.
 *
 * A mat (raft) foundation supports ALL columns of a building on a single
 * continuous slab. Used when:
 *   • Soil bearing capacity is low (light loads on weak soil)
 *   • Differential settlement must be controlled
 *   • Closely-spaced columns would cause overlapping spread footings
 *   • Heavy loads on irregular soils where piles can't be used
 *
 * Two analytical methods exist:
 *   1. CONVENTIONAL RIGID METHOD (this solver) — assumes the mat is rigid,
 *      soil pressure varies linearly per q = P/A ± Mx·y/Ix ± My·x/Iy,
 *      then strips are analyzed as continuous beams.
 *   2. PLATE-ON-WINKLER-FOUNDATION method — mat as elastic plate on elastic
 *      spring bed (subgrade reaction). Requires FEA (out of scope for this
 *      first release; use CSI SAFE / PLAXIS for the rigorous case).
 *
 * For Phase C kickoff: bearing check (corner pressures) + per-column
 * two-way (punching) shear. Strip flexure is in a follow-up commit since
 * it requires a column-grid analyzer.
 */

import type { Code, ColumnShape, FootingMaterials, ReportBranding, CalcStep } from '../footing/types';

/** A single column on the mat. Position is in mat-local coordinates with the
 *  origin at the mat's lower-left corner (when looking down on the mat). */
export interface MatColumn {
  /** Column ID (e.g. "C1", "B2", or just an index). Used for reporting. */
  id: string;
  /** Column dimension along X (mm). */
  cx: number;
  /** Column dimension along Y (mm). For circular, ignored. */
  cy?: number;
  shape: ColumnShape;
  /** Service dead load (kN). */
  PD: number;
  /** Service live load (kN). */
  PL: number;
  /** Optional service moments transferred to the mat. */
  Mx?: number;
  My?: number;
  /** Column position along X, measured from the mat's lower-left corner (mm). */
  x: number;
  /** Column position along Y, measured from the mat's lower-left corner (mm). */
  y: number;
  /** Column location for αs in two-way shear. Default: solver auto-detects
   *  based on proximity to mat edges. */
  columnLocation?: 'interior' | 'edge' | 'corner';
}

export interface MatGeometry {
  /** Mat plan dimension along X (mm). */
  B: number;
  /** Mat plan dimension along Y (mm). */
  L: number;
  /** Mat thickness (mm). Mats are typically 600–1500 mm thick. */
  T: number;
  /** Clear cover from soil-side face to outer rebar (mm). 75 mm typical. */
  coverClear: number;
  /** Embedment depth of mat top below grade (mm). */
  embedment?: number;
}

export interface MatSoil {
  /** Allowable (service-level) bearing pressure (kPa). */
  qa: number;
  /** Soil unit weight γs (kN/m³). Default 18. */
  gammaSoil?: number;
  /** Concrete unit weight γc (kN/m³). Default 24. */
  gammaConcrete?: number;
  /** Modulus of subgrade reaction ks (kN/m³). Optional — used in Winkler
   *  analysis when implemented; informational only in rigid method. */
  ks?: number;
}

/** Reinforcement layout for mat foundations. ACI 318-25 §13.3.4.4 + R13.3.4.4
 *  recommend continuous reinforcement in BOTH directions near BOTH faces. */
export interface MatReinforcement {
  /** Top mat reinforcement, X-direction bars (resists negative moments
   *  between columns). */
  topX: { bar: string; spacing: number };     // spacing in mm c/c
  topY: { bar: string; spacing: number };
  /** Bottom mat reinforcement, X-direction bars (resists positive moments
   *  at cantilever / mat edges). */
  bottomX: { bar: string; spacing: number };
  bottomY: { bar: string; spacing: number };
}

export interface MatFoundationInput {
  code: Code;
  columns: MatColumn[];
  geometry: MatGeometry;
  soil: MatSoil;
  materials: FootingMaterials;
  reinforcement: MatReinforcement;
  branding?: ReportBranding;
}

// ─── Check Result Types ────────────────────────────────────────────────────

/** Bearing check (rigid-method bilinear pressure distribution). */
export interface MatBearingCheck {
  /** Total service vertical load (columns + Wf + Ws) (kN). */
  P_service: number;
  /** Mat self-weight (kN). */
  Wf: number;
  /** Soil overburden weight (kN). */
  Ws: number;
  /** Provided area (m²). */
  A: number;
  /** Average bearing pressure q_avg = P_service / A (kPa). */
  q_avg: number;
  /** Centroid of all column loads, mat-local coordinates (mm). */
  xResultant: number;
  yResultant: number;
  /** Eccentricity of resultant from the mat centroid (mm). */
  eX: number;
  eY: number;
  /** Pressure at the four corners (kPa) — bilinear distribution per
   *  q(x, y) = P/A + 6·Mx·c_y/(B·L²) + 6·My·c_x/(L·B²). */
  q_corner_BL: number;     // bottom-left (x=0, y=0)
  q_corner_BR: number;     // bottom-right (x=B, y=0)
  q_corner_TL: number;     // top-left (x=0, y=L)
  q_corner_TR: number;     // top-right (x=B, y=L)
  q_max: number;
  q_min: number;
  ratio: number;
  ok: boolean;
  ref: string;
  steps: CalcStep[];
}

/** Two-way (punching) shear at one column. */
export interface MatPunchingCheck {
  columnId: string;
  /** Detected column location class (interior / edge / corner). */
  location: 'interior' | 'edge' | 'corner';
  bo: number;
  d: number;
  betaC: number;
  alphaS: number;
  vc: number;
  phiVc: number;
  Vu: number;
  vuv: number;
  ratio: number;
  ok: boolean;
  ref: string;
  steps: CalcStep[];
}

/** Bearing-interface check at one column on a mat (§22.8). */
export interface MatBearingInterfaceCheck {
  columnId: string;
  Pu: number;
  phiBnCol: number;
  phiBnFtg: number;
  phiBn: number;
  ratio: number;
  ok: boolean;
  ref: string;
  steps: CalcStep[];
}

/** Bar fit / spacing for one mat layer (top X / top Y / bot X / bot Y). */
export interface MatBarFitCheck {
  layer: 'topX' | 'topY' | 'bottomX' | 'bottomY';
  s_clear: number;
  s_min: number;
  s_max: number;
  ok: boolean;
  ref: string;
  steps: CalcStep[];
}

/** Strip-method longitudinal flexure: divides the mat into beam strips along
 *  one axis (X or Y) and analyzes each strip as a continuous beam supporting
 *  the columns that fall in it.  Reports the worst-case Mu+ and Mu− across
 *  all strips. */
export interface MatStripFlexureCheck {
  axis: 'X' | 'Y';
  /** Number of column-line strips identified along this axis. */
  numStrips: number;
  /** Worst positive moment across all strips (kN·m). */
  Mu_pos_max: number;
  /** Worst negative moment magnitude across all strips (kN·m). */
  Mu_neg_max: number;
  /** Required As for the worst Mu+ (mm² per metre width). */
  AsReq_pos_per_m: number;
  AsReq_neg_per_m: number;
  /** Provided As (per metre width) for the bottom mat in this axis. */
  AsProv_pos_per_m: number;
  /** Provided As (per metre width) for the top mat in this axis. */
  AsProv_neg_per_m: number;
  ok: boolean;
  ref: string;
  steps: CalcStep[];
}

/** Aggregate analysis result. */
export interface MatFoundationAnalysis {
  input: MatFoundationInput;
  bearing: MatBearingCheck;
  /** Per-column punching check (one per column). */
  punching: MatPunchingCheck[];
  /** Per-column bearing-interface check. */
  bearingInterface: MatBearingInterfaceCheck[];
  /** Bar-fit checks for all 4 mats. */
  barFit: MatBarFitCheck[];
  /** Strip-method flexure along X and Y. */
  stripFlexureX: MatStripFlexureCheck;
  stripFlexureY: MatStripFlexureCheck;
  /** Factored uniform pressure used in design (kPa) — for punching. */
  qnu_avg: number;
  ok: boolean;
  warnings: string[];
  solved: boolean;
}

// ─── AUTO-DESIGN ──────────────────────────────────────────────────────────

export interface MatAutoDesignOptions {
  /** Aspect ratio B/L target (default 1.0 = square). */
  aspect?: number;
  /** Apply a safety factor to the allowable bearing. */
  qaSafetyFactor?: number;
  fixT?: number;
}

export interface MatAutoDesignResult {
  patchedInput: MatFoundationInput;
  ok: boolean;
  rationaleSteps: CalcStep[];
  warnings: string[];
}
