// Base Plate (Column Base) Design — types
// References:
//   AISC Design Guide 1, 3rd Edition (2024) — "Base Connection Design for Steel Structures"
//     by Amit Kanvinde, Mahmoud Maamouri, Joshua Buckholt
//   AISC 360-22 — Specification for Structural Steel Buildings
//   ACI 318-25 — Building Code Requirements for Structural Concrete (Chapter 17 Anchoring)
//
// Sign / unit convention (US customary, internal):
//   forces      kips
//   lengths     in
//   stress      ksi
//   moments     kip·in
//   φ factors   per AISC / ACI

export type Code = 'AISC 360-22 + ACI 318-25';
export type DesignMethod = 'LRFD' | 'ASD';

// ----------------------------------------------------------------------------
// Column input
// ----------------------------------------------------------------------------
export type ColumnShape = 'W' | 'HSS-rect' | 'HSS-round' | 'pipe' | 'custom';
export interface Column {
  shape: ColumnShape;
  /** AISC section label, e.g. "W12X65" — informational only. */
  label?: string;
  /** Depth d (W) or overall depth (HSS-rect) (in). */
  d: number;
  /** Flange width bf (W) or overall width (HSS-rect) (in). */
  bf: number;
  /** Flange thickness tf (W) or wall thickness (HSS) (in). */
  tf: number;
  /** Web thickness tw (W). For HSS / pipe, equal to wall thickness. */
  tw: number;
  /** Yield strength of column steel (ksi). Default 50 (A992). */
  Fy: number;
}

// ----------------------------------------------------------------------------
// Plate
// ----------------------------------------------------------------------------
export interface Plate {
  /** Plate width B (in) — perpendicular to N. */
  B: number;
  /** Plate length N (in) — parallel to bending direction. */
  N: number;
  /** Plate thickness tp (in). User-specified or auto-determined. */
  tp: number;
  /** Whether the user has overridden the plate thickness or it should be auto-sized. */
  tpAuto: boolean;
  /** Yield strength of plate steel (ksi). Default 50 (A572 Gr 50). */
  Fy: number;
}

// ----------------------------------------------------------------------------
// Concrete pedestal / footing
// ----------------------------------------------------------------------------
export interface Concrete {
  /** Specified compressive strength f'c (ksi). Default 4. */
  fc: number;
  /** Pedestal width B2 (in) — for A2/A1 confinement factor. */
  B2: number;
  /** Pedestal length N2 (in). */
  N2: number;
  /** Lightweight concrete factor λa (default 1.0 for normal weight). */
  lambdaA: number;
  /** Whether the concrete should be assumed cracked at service load
   *  (per ACI 318 §17.6.2.5). Default true (conservative). */
  cracked: boolean;
}

// ----------------------------------------------------------------------------
// Anchor rod input
// ----------------------------------------------------------------------------
export type AnchorGrade =
  | 'F1554-36'   // ASTM F1554 Gr 36 (Fy=36, Fu=58 ksi)
  | 'F1554-55'   // ASTM F1554 Gr 55 (Fy=55, Fu=75 ksi)
  | 'F1554-105'  // ASTM F1554 Gr 105 (Fy=105, Fu=125 ksi)
  | 'A325'       // (Fu=120 ksi for ≤1")
  | 'A490'       // (Fu=150 ksi)
  | 'custom';

export type AnchorTermination =
  | 'hex-nut'      // Heavy hex nut on embedded end (preferred)
  | 'plate-washer' // Plate washer on embedded end
  | 'hooked';      // Hooked rod (limited capacity, usually not recommended)

export interface AnchorPattern {
  /** Number of anchors total (typically 4 or 8). */
  N: number;
  /** Anchor diameter da (in) — typical 3/4, 7/8, 1, 1-1/4. */
  da: number;
  /** Anchor grade — sets Fu (and Fy). */
  grade: AnchorGrade;
  /** Termination type at embedded end. */
  termination: AnchorTermination;
  /** Embedment depth hef (in) — distance from concrete surface to bearing
   *  surface of anchor head / hook tip. */
  hef: number;
  /** For hooked anchors: hook length eh (in) measured from inner face of
   *  shaft to tip. Per ACI 17.6.3, must be 3·da ≤ eh ≤ 4.5·da. */
  hookLength?: number;
  /** Anchor pattern spacing (in) — perpendicular to N (the bending axis):
   *    sx = spacing between rod columns
   *    sy = spacing between rod rows along N
   *  Pattern is rectangular. For 4 rods, nx=ny=2. */
  sx: number;
  sy: number;
  /** Edge distance from edge of plate to centerline of nearest rod (in). */
  edgeDist: number;
  /** Custom anchor steel ultimate strength (ksi) — only used when grade='custom'. */
  Fu?: number;
  /** Custom anchor steel yield strength (ksi) — only used when grade='custom'. */
  Fy?: number;
}

// ----------------------------------------------------------------------------
// Loads
// ----------------------------------------------------------------------------
export interface Loads {
  /** Factored axial load Pu (kips). +ve compression, -ve tension. LRFD. */
  Pu: number;
  /** Factored uniaxial moment Mu (kip·in) about strong axis. */
  Mu: number;
  /** Factored shear Vu (kips). */
  Vu: number;
}

// ----------------------------------------------------------------------------
// Weld
// ----------------------------------------------------------------------------
export type WeldElectrode = 'E60' | 'E70' | 'E80';
export interface Weld {
  /** Electrode classification (FEXX). Default E70. */
  electrode: WeldElectrode;
  /** Fillet weld leg size w (in) at column-to-plate joint. Auto-sized when 0. */
  size: number;
  /** Whether to auto-size the fillet weld. */
  auto: boolean;
}

// ----------------------------------------------------------------------------
// Aggregate input
// ----------------------------------------------------------------------------
export interface BasePlateInput {
  code: Code;
  method: DesignMethod;
  column: Column;
  plate: Plate;
  concrete: Concrete;
  anchors: AnchorPattern;
  loads: Loads;
  weld: Weld;
  /** Optional firm branding for the print report. */
  branding?: ReportBranding;
}

export interface ReportBranding {
  logoDataUrl?: string;
  companyName?: string;
  companyTagline?: string;
}

// ============================================================================
// Output types
// ============================================================================

export interface CalcStep {
  title: string;
  formula: string;
  substitution: string;
  result: string;
  ref?: string;
}

export interface BearingCheck {
  /** Required bearing area A1 (in²). */
  A1: number;
  /** Available bearing area for confinement A2 (in²). */
  A2: number;
  /** Confinement factor √(A2/A1), capped at 2. */
  confinementFactor: number;
  /** Maximum allowed bearing pressure fp_max (ksi). */
  fpMax: number;
  /** Actual bearing pressure fp under uniform stress assumption (ksi). */
  fp: number;
  /** Nominal bearing strength Pp (kips). */
  Pp: number;
  /** Available (φPp for LRFD or Pp/Ω for ASD) (kips). */
  PpAvail: number;
  /** Demand-to-capacity ratio. */
  ratio: number;
  ok: boolean;
  ref: string;
  steps: CalcStep[];
}

export interface PlateYieldCheck {
  /** Cantilever m = (N - 0.95d) / 2 (in). */
  m: number;
  /** Cantilever n = (B - 0.8bf) / 2 (in). */
  n: number;
  /** Cantilever n' = (1/4)·√(d·bf) (in) — interior region. */
  nPrime: number;
  /** Governing cantilever l = max(m, n, λ·n'). */
  l: number;
  /** Bearing stress fp used in plate flexure (ksi). */
  fp: number;
  /** Required plate thickness (in). */
  tpReq: number;
  /** Provided plate thickness (in). */
  tpProvided: number;
  /** Demand/capacity ratio. */
  ratio: number;
  ok: boolean;
  ref: string;
  steps: CalcStep[];
}

export interface MomentInteraction {
  /** Eccentricity e = Mu/Pu (in). Infinity if Pu = 0. */
  e: number;
  /** Critical eccentricity ecrit = N/2 - Pu/(2·qmax). */
  ecrit: number;
  /** Maximum line load qmax = fp_max·B (kip/in). */
  qmax: number;
  /** Bearing length Y (in). */
  Y: number;
  /** Anchor rod tension demand T (kips), 0 if low-moment case. */
  T: number;
  /** True if e > ecrit. */
  largeMoment: boolean;
  /** Distance f from plate centerline to anchor rod centerline on tension side (in). */
  f: number;
  /** Whether a real solution Y exists (false = plate too small). */
  feasible: boolean;
  steps: CalcStep[];
}

export interface AnchorTensionCheck {
  /** Number of anchors in tension. */
  nT: number;
  /** Tension demand per rod (kips). */
  ru: number;
  /** Anchor steel ultimate strength Fu (ksi). */
  Fu: number;
  /** Tensile stress area Ase,N (in²). */
  AseN: number;
  /** Nominal steel tensile strength Nsa per rod (kips). */
  Nsa: number;
  /** Available tensile strength per rod φNsa (kips). */
  NsaAvail: number;
  ratio: number;
  ok: boolean;
  ref: string;
  steps: CalcStep[];
}

export interface ConcreteBreakoutCheck {
  /** Projected concrete failure area for the group ANc (in²). */
  ANc: number;
  /** Projected area for a single anchor ANco = 9·hef² (in²). */
  ANco: number;
  /** Eccentricity factor ψec,N. */
  psiEcN: number;
  /** Edge factor ψed,N. */
  psiEdN: number;
  /** Cracking factor ψc,N. */
  psiCN: number;
  /** Cast-in splitting factor ψcp,N. */
  psiCpN: number;
  /** Basic single-anchor breakout strength Nb (kips). */
  Nb: number;
  /** Group breakout strength Ncbg (kips). */
  Ncbg: number;
  /** Available group breakout φNcbg (kips). */
  NcbgAvail: number;
  /** Total tension demand T (kips). */
  T: number;
  ratio: number;
  ok: boolean;
  ref: string;
  steps: CalcStep[];
}

export interface ConcretePulloutCheck {
  /** Pullout strength of a single anchor with hex nut Np (kips). */
  Np: number;
  /** Available pullout strength φNpn (kips). */
  NpnAvail: number;
  /** Pullout demand per rod (kips). */
  ru: number;
  ratio: number;
  ok: boolean;
  ref: string;
  steps: CalcStep[];
}

export interface AnchorShearCheck {
  /** Number of anchors resisting shear. */
  nV: number;
  /** Shear per anchor (kips). */
  vu: number;
  /** Steel shear strength per rod Vsa (kips). */
  Vsa: number;
  /** Available steel shear φVsa per rod (kips). */
  VsaAvail: number;
  ratio: number;
  ok: boolean;
  ref: string;
  steps: CalcStep[];
}

export interface WeldCheck {
  /** Effective weld length per side (in). */
  Le: number;
  /** Required weld strength per inch (kip/in). */
  rReq: number;
  /** Weld nominal strength per inch Rn (kip/in). */
  Rn: number;
  /** Available weld strength per inch φRn (kip/in). */
  RnAvail: number;
  /** Required weld leg size w (in). */
  wReq: number;
  /** Provided weld leg size w (in). */
  wProvided: number;
  /** Minimum weld size per AISC Spec Table J2.4 (in). */
  wMin: number;
  ratio: number;
  ok: boolean;
  ref: string;
  steps: CalcStep[];
}

export interface BasePlateAnalysis {
  /** Echo of inputs after defaulting. */
  input: BasePlateInput;
  /** Loading case identifier. */
  loadCase: 'compression' | 'tension' | 'compression+moment-low'
          | 'compression+moment-high' | 'tension+moment' | 'shear-only';
  /** Concrete bearing check (only when Pu > 0 compression). */
  bearing?: BearingCheck;
  /** Plate flexural yielding check. */
  plateYielding?: PlateYieldCheck;
  /** Combined axial + moment partition (large vs low moment). */
  momentInteraction?: MomentInteraction;
  /** Anchor steel tension check (when anchors are in tension). */
  anchorTension?: AnchorTensionCheck;
  /** Concrete breakout check for tension. */
  concreteBreakout?: ConcreteBreakoutCheck;
  /** Concrete pullout check (steel limit at the head/nut). */
  concretePullout?: ConcretePulloutCheck;
  /** Anchor steel shear check. */
  anchorShear?: AnchorShearCheck;
  /** Combined T+V interaction per ACI 318 §17.8 (when both present). */
  combinedTV?: { ratio: number; ok: boolean; ref: string; steps: CalcStep[] };
  /** Column-to-plate weld check. */
  weld?: WeldCheck;
  /** Aggregate warnings, code limit notes. */
  warnings: string[];
  /** Overall pass/fail (logical AND of every check that ran). */
  ok: boolean;
  /** Solver completed without errors. */
  solved: boolean;
}

// ============================================================================
// Anchor catalog
// ============================================================================
export interface AnchorRodSize {
  /** Diameter (in). */
  da: number;
  /** Tensile stress area Ase,N (in²) per AISC Table 7-17. */
  AseN: number;
  /** Heavy hex nut bearing area Abrg (in²) per AISC Table 14-2. */
  Abrg: number;
}

export const ANCHOR_ROD_SIZES: AnchorRodSize[] = [
  { da: 0.500, AseN: 0.142, Abrg: 0.464 },
  { da: 0.625, AseN: 0.226, Abrg: 0.671 },
  { da: 0.750, AseN: 0.334, Abrg: 0.911 },
  { da: 0.875, AseN: 0.462, Abrg: 1.184 },
  { da: 1.000, AseN: 0.606, Abrg: 1.501 },
  { da: 1.125, AseN: 0.763, Abrg: 1.851 },
  { da: 1.250, AseN: 0.969, Abrg: 2.237 },
  { da: 1.375, AseN: 1.155, Abrg: 2.659 },
  { da: 1.500, AseN: 1.405, Abrg: 3.118 },
  { da: 1.750, AseN: 1.900, Abrg: 4.144 },
  { da: 2.000, AseN: 2.500, Abrg: 5.316 },
];

// ============================================================================
// Anchor grade strengths
// ============================================================================
export const ANCHOR_GRADES: Record<Exclude<AnchorGrade, 'custom'>, { Fy: number; Fu: number; label: string }> = {
  'F1554-36':  { Fy:  36, Fu:  58, label: 'ASTM F1554 Gr 36 (Fu=58 ksi)' },
  'F1554-55':  { Fy:  55, Fu:  75, label: 'ASTM F1554 Gr 55 (Fu=75 ksi)' },
  'F1554-105': { Fy: 105, Fu: 125, label: 'ASTM F1554 Gr 105 (Fu=125 ksi)' },
  'A325':      { Fy:  92, Fu: 120, label: 'ASTM F3125 A325 (Fu=120 ksi)' },
  'A490':      { Fy: 130, Fu: 150, label: 'ASTM F3125 A490 (Fu=150 ksi)' },
};

// ============================================================================
// Common AISC W-shape catalog (subset). Inputs only; full DB later.
// ============================================================================
export interface WShape {
  label: string;
  d: number; bf: number; tf: number; tw: number;
}

export const COMMON_W_SHAPES: WShape[] = [
  { label: 'W8X31',   d:  8.00, bf:  8.00, tf: 0.435, tw: 0.285 },
  { label: 'W10X45',  d: 10.10, bf:  8.02, tf: 0.620, tw: 0.350 },
  { label: 'W10X68',  d: 10.40, bf: 10.10, tf: 0.770, tw: 0.470 },
  { label: 'W12X65',  d: 12.10, bf: 12.00, tf: 0.605, tw: 0.390 },
  { label: 'W12X87',  d: 12.50, bf: 12.10, tf: 0.810, tw: 0.515 },
  { label: 'W12X120', d: 13.10, bf: 12.30, tf: 1.110, tw: 0.710 },
  { label: 'W12X170', d: 14.00, bf: 12.60, tf: 1.560, tw: 0.960 },
  { label: 'W14X90',  d: 14.00, bf: 14.50, tf: 0.710, tw: 0.440 },
  { label: 'W14X120', d: 14.50, bf: 14.70, tf: 0.940, tw: 0.590 },
  { label: 'W14X176', d: 15.20, bf: 15.70, tf: 1.310, tw: 0.830 },
  { label: 'W14X211', d: 15.70, bf: 15.80, tf: 1.560, tw: 0.980 },
  { label: 'W14X257', d: 16.40, bf: 16.00, tf: 1.890, tw: 1.180 },
];
