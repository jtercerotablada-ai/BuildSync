/**
 * Combined Footing Design — Phase B
 * ----------------------------------
 *
 * Per ACI 318-25 §13.3.4 and Wight & MacGregor 7e §15-6.
 *
 * A combined footing supports TWO columns on a single rectangular pad. The
 * shape is sized so the centroid of the contact area coincides with the
 * resultant of the column loads — yielding uniform soil pressure (the
 * fundamental design assumption).
 *
 * Structural action (Wight §15-6, Fig. 15-20):
 *   • Longitudinal action: footing acts as a beam supported at two columns,
 *     with the soil reaction (pressure × width) as a distributed UPWARD load.
 *     Bending-moment and shear-force diagrams are built and the depth is
 *     sized for the maximum positive (between columns) and negative (under
 *     cantilevers) moments.
 *   • Transverse action: each column transfers its load to the soil via a
 *     "crossbeam" of width = col_dim + d (each side d/2 from column face).
 *     The transverse cantilever is designed like an isolated spread footing.
 *   • Two-way (punching) shear at each column independently per §22.6.
 */

import type { Code, ColumnShape, FootingMaterials, ReportBranding, CalcStep } from '../footing/types';

/** Single column on a combined footing. */
export interface CombinedColumn {
  /** Column dimension along the longitudinal (footing-length) axis (mm). */
  cl: number;
  /** Column dimension along the transverse (footing-width) axis (mm). */
  ct: number;
  /** Column shape. */
  shape: ColumnShape;
  /** Service dead load (kN). */
  PD: number;
  /** Service live load (kN). */
  PL: number;
  /** Column centerline position along the longitudinal axis from a chosen
   *  reference (mm). The solver will compute the resultant location from
   *  these positions and place the footing centroid to match. */
  position: number;
  /** Column-location for αs in two-way shear (interior/edge/corner). */
  columnLocation?: 'interior' | 'edge' | 'corner';
}

/** Geometry of the combined footing rectangle. */
export interface CombinedFootingGeometry {
  /** Footing length along the longitudinal axis (mm). When `auto` is true,
   *  the solver SIZES this to put the centroid at the load resultant. */
  L: number;
  /** Footing width transverse to the columns (mm). When `auto` is true,
   *  the solver sizes this from the required area / L. */
  B: number;
  /** Footing thickness (mm). */
  T: number;
  /** Clear cover from soil-side face to outer rebar (mm). 75 mm typical for
   *  cast-against-earth (ACI 318-25 Table 20.5.1.3.1). */
  coverClear: number;
  /** Embedment depth of footing top below grade (mm). Used for self-weight
   *  + soil-overburden in the bearing check. */
  embedment?: number;
  /** When true, solver will compute L, B from the columns + load resultant
   *  + qa to achieve uniform soil pressure. When false, the user-provided
   *  L, B are used as-is and the solver may report non-uniform pressure. */
  auto?: boolean;
  /** Position of the LEFT edge of the footing along the longitudinal axis
   *  (mm). When `auto` is true, this is computed from the resultant. */
  leftEdge?: number;
}

/** Reinforcement layout for combined footings. Has top/bottom mats AND a
 *  longitudinal beam-style top strip for the negative moment over the
 *  interior support, where the footing acts as a beam in tension on top. */
export interface CombinedFootingReinforcement {
  /** Bottom-longitudinal bars (run along L). For the positive moment region. */
  bottomLong: { bar: string; count: number };
  /** Top-longitudinal bars (run along L). For the negative moment region
   *  between columns or at exterior cantilever. */
  topLong?: { bar: string; count: number };
  /** Bottom-transverse bars under each column (the crossbeam reinforcement). */
  bottomTrans: { bar: string; count: number };
  /** Top-transverse bars (rare; usually shrinkage/temperature only). */
  topTrans?: { bar: string; count: number };
}

export interface CombinedFootingSoil {
  /** Allowable (service-level) bearing pressure (kPa). */
  qa: number;
  /** Soil unit weight γs (kN/m³). Default 18. */
  gammaSoil?: number;
  /** Concrete unit weight γc (kN/m³). Default 24. */
  gammaConcrete?: number;
}

export interface CombinedFootingInput {
  code: Code;
  /** The two columns. The first is conventionally the EXTERIOR (smaller PD/PL)
   *  but the solver does not impose this — order is just for reporting. */
  column1: CombinedColumn;
  column2: CombinedColumn;
  geometry: CombinedFootingGeometry;
  soil: CombinedFootingSoil;
  materials: FootingMaterials;
  reinforcement: CombinedFootingReinforcement;
  /** Optional branding for print report. */
  branding?: ReportBranding;
}

// ─── Check Result Types ────────────────────────────────────────────────────

/** Bearing check (uniform pressure under combined footing). */
export interface CombinedBearingCheck {
  /** Total service vertical load (kN), columns + Wf + Ws. */
  P_service: number;
  /** Required area at qa (m²). */
  A_req: number;
  /** Provided area (m²). */
  A_prov: number;
  /** Resultant location from the LEFT edge of the footing (mm). For uniform
   *  pressure, this should equal L/2 (footing centroid). */
  xResultantFromLeft: number;
  /** Footing centroid offset from resultant (mm). 0 = perfect match (uniform
   *  pressure). */
  centroidOffset: number;
  /** Average service bearing pressure (kPa). */
  q_avg: number;
  /** Maximum service bearing pressure (kPa). When centroid matches, q_max
   *  = q_min = q_avg. Otherwise trapezoidal. */
  q_max: number;
  q_min: number;
  /** Self-weight of footing (kN). */
  Wf: number;
  /** Overburden weight (kN). */
  Ws: number;
  ratio: number;
  ok: boolean;
  ref: string;
  steps: CalcStep[];
}

/** Longitudinal beam analysis: BMD + SFD with two columns and distributed
 *  upward soil reaction. */
export interface LongitudinalBeamAnalysis {
  /** Factored uniform load on the beam (kN/m), = qnu × B. Negative sign
   *  in convention (upward load on a beam treated as positive in some texts;
   *  here we use UPWARD POSITIVE since it's the soil reaction). */
  wu: number;
  /** Factored point loads at each column (kN), DOWNWARD. */
  Pu1: number;
  Pu2: number;
  /** Maximum positive bending moment along the beam (kN·m), between the
   *  columns (where shear crosses zero). */
  Mu_pos_max: number;
  /** x-position of M+ max from the left edge (mm). */
  x_Mu_pos_max: number;
  /** Maximum negative bending moment (kN·m), at one of the cantilever ends
   *  or at face of column. */
  Mu_neg_max: number;
  x_Mu_neg_max: number;
  /** Maximum shear at face of each column (kN). Used for one-way shear check. */
  Vu_max_at_col1: number;
  Vu_max_at_col2: number;
  /** Sampled BMD/SFD points for diagrams (every 100 mm, say). */
  bmd: Array<{ x: number; M: number; V: number }>;
  steps: CalcStep[];
}

/** Two-way punching shear at one column (re-uses the same logic as spread
 *  footing). */
export interface CombinedPunchingCheck {
  /** Which column (1 or 2). */
  column: 1 | 2;
  bo: number;
  d: number;
  betaC: number;
  alphaS: number;
  vc: number;
  phiVc: number;     // kN
  Vu: number;        // kN
  vuv: number;       // MPa
  ratio: number;
  ok: boolean;
  ref: string;
  steps: CalcStep[];
}

/** One-way shear check on the longitudinal beam at a critical section
 *  (d from the face of one of the columns or at a region of max V). */
export interface CombinedOneWayShearCheck {
  /** Critical section x-position from the left edge (mm). */
  xCrit: number;
  d: number;
  bw: number;        // = B (full width)
  Vu: number;
  Vc: number;
  phiVc: number;
  ratio: number;
  ok: boolean;
  ref: string;
  steps: CalcStep[];
}

/** Longitudinal flexure check (positive or negative moment region). */
export interface CombinedLongFlexureCheck {
  /** 'positive' (bottom tension, between columns) or 'negative' (top tension,
   *  cantilever or over interior support). */
  region: 'positive' | 'negative';
  Mu: number;
  d: number;
  bw: number;
  AsReq: number;
  AsMin: number;
  AsProv: number;
  phiMn: number;
  ratio: number;
  ok: boolean;
  ref: string;
  steps: CalcStep[];
}

/** Transverse flexure check (under each column, like a spread footing
 *  cantilever). */
export interface CombinedTransFlexureCheck {
  column: 1 | 2;
  /** Effective crossbeam width = col_dim + d (each side d/2 from face). */
  crossbeamWidth: number;
  /** Transverse cantilever length (mm). */
  cantilever: number;
  Mu: number;
  AsReq: number;
  AsMin: number;
  AsProv: number;     // bars in the crossbeam zone
  phiMn: number;
  ratio: number;
  ok: boolean;
  ref: string;
  steps: CalcStep[];
}

/** Aggregate analysis result. */
export interface CombinedFootingAnalysis {
  input: CombinedFootingInput;
  bearing: CombinedBearingCheck;
  beam: LongitudinalBeamAnalysis;
  punching1: CombinedPunchingCheck;
  punching2: CombinedPunchingCheck;
  shearLong: CombinedOneWayShearCheck;
  flexLongPos: CombinedLongFlexureCheck;
  flexLongNeg: CombinedLongFlexureCheck;
  flexTrans1: CombinedTransFlexureCheck;
  flexTrans2: CombinedTransFlexureCheck;
  /** Factored uniform pressure used in design (kPa). */
  qnu: number;
  /** Overall pass/fail. */
  ok: boolean;
  warnings: string[];
  solved: boolean;
}
