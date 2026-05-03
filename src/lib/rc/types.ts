// Reinforced Concrete (RC) Beam Design — types
//
// References:
//   ACI 318-25 (SI units) — Building Code Requirements for Structural Concrete
//     Chapter 9  — Beams
//     Chapter 22 — Sectional strength
//     Chapter 24 — Serviceability
//   ACI MNL-17(21) — RC Design Handbook (worked examples)
//   Wight & MacGregor — RC Mechanics and Design (textbook)
//   EN 1992-1-1:2023 — Eurocode 2 (alternative code)
//
// Sign / unit convention (SI primary):
//   length (b, h, d, s)            mm
//   force / strength (Pu, Vu)      kN
//   moment (Mu, Mn)                kN·m
//   stress / strength (fc, fy)     MPa
//   area of steel (As)             mm²
//   load (w)                       kN/m or kN/m²

// ============================================================================
// Code + section type
// ============================================================================
export type Code = 'ACI 318-25' | 'ACI 318-19' | 'EN 1992-1-1';
export type SectionShape = 'rectangular' | 'T-beam' | 'inverted-T' | 'L-beam';
export type DesignMethod = 'LRFD' | 'ASD';     // ACI is LRFD by default

// ============================================================================
// Geometry
// ============================================================================
export interface Geometry {
  shape: SectionShape;
  /** Web width bw (mm). For rectangular = b; for T-beam = web only. */
  bw: number;
  /** Total depth h (mm). */
  h: number;
  /** Effective depth d to centroid of tension steel (mm). */
  d: number;
  /** Optional effective depth d′ to compression steel (mm) — doubly reinforced only. */
  dPrime?: number;
  /** T-beam: effective flange width bf (mm) per ACI §6.3.2. */
  bf?: number;
  /** T-beam: flange thickness hf (mm). */
  hf?: number;
  /** Beam clear span L (mm) — used for serviceability and self-weight. */
  L: number;
  /** Clear cover to outermost reinforcement (stirrup outer face) (mm). */
  coverClear: number;
}

// ============================================================================
// Materials
// ============================================================================
export interface Materials {
  /** Specified compressive strength fʹc (MPa). */
  fc: number;
  /** Tension rebar yield strength fy (MPa). */
  fy: number;
  /** Stirrup yield strength fyt (MPa). Defaults to fy. */
  fyt?: number;
  /** Rebar Young's modulus Es (MPa). Default 200 000. */
  Es?: number;
  /** Concrete unit weight γc (kN/m³). Default 24 (normal weight). */
  gammaC?: number;
  /** Concrete λ factor (ACI §19.2.4): 1.0 normal, 0.75 sand-LW, 0.85 LW. */
  lambdaC?: number;
}

// ============================================================================
// Reinforcement
// ============================================================================
export interface BarGroup {
  /** Bar label, e.g. "#9", "M25". */
  bar: string;
  /** Number of bars in this group. */
  count: number;
}

export interface StirrupConfig {
  /** Stirrup bar label (typically "#3" or "M10"). */
  bar: string;
  /** Number of legs crossing the section (typically 2). */
  legs: number;
  /** Centre-to-centre spacing along the beam (mm). */
  spacing: number;
}

export interface Reinforcement {
  /** Tension steel — array of bar groups (e.g. [{bar:"#9", count:3}]). */
  tension: BarGroup[];
  /** Compression steel (doubly reinforced) — optional. */
  compression?: BarGroup[];
  /** Stirrups (transverse reinforcement). */
  stirrup: StirrupConfig;
  /** Number of rows of tension bars. Default 1. Used to estimate d when not specified. */
  tensionRows?: number;
}

// ============================================================================
// Loads
// ============================================================================
export interface Loads {
  /** Factored design moment Mu (kN·m). */
  Mu: number;
  /** Factored design shear Vu (kN). */
  Vu: number;
  /** Factored axial Pu (kN) — usually 0 for beams. + compression. */
  Pu?: number;
  /** Service moment Ma (kN·m) — for deflection (full sustained + live). */
  Ma?: number;
  /** Dead-load moment M_DL (kN·m) — for sustained deflection. */
  M_DL?: number;
  /** Live-load moment M_LL (kN·m). */
  M_LL?: number;
  /** Sustained fraction ψ of live load (0..1). Default 0.25. */
  sustainedLLFraction?: number;
  /** Long-term period for ξ multiplier (months). Default 60 (5+ yr → ξ=2.0). */
  longTermPeriodMonths?: number;
  /** Service load category (Tabla 24.2.2 limit selection). */
  deflectionLimitCategory?: DeflectionLimitCategory;
}

export type DeflectionLimitCategory =
  | 'flat-roof-no-attached'
  | 'floor-no-attached'
  | 'floor-attached-not-likely'
  | 'floor-attached-likely-damage';

// ============================================================================
// Aggregate input
// ============================================================================
export interface BeamInput {
  code: Code;
  method: DesignMethod;
  geometry: Geometry;
  materials: Materials;
  reinforcement: Reinforcement;
  loads: Loads;
  branding?: ReportBranding;
}

export interface ReportBranding {
  logoDataUrl?: string;
  companyName?: string;
  companyTagline?: string;
}

// ============================================================================
// Output / results
// ============================================================================
export interface CalcStep {
  title: string;
  formula: string;
  substitution: string;
  result: string;
  ref?: string;
}

export interface FlexureCheck {
  /** Provided tension steel area (mm²). */
  As: number;
  /** Whitney stress-block depth a (mm). */
  a: number;
  /** Neutral axis depth c (mm). */
  c: number;
  /** β1 factor (ACI §22.2.2.4.3). */
  beta1: number;
  /** Net tensile strain at extreme tension steel εt (—). */
  epsT: number;
  /** Yield strain εty = fy/Es. */
  epsTy: number;
  /** Strength reduction φ (ACI §21.2.2). */
  phi: number;
  /** Section classification. */
  section: 'tension-controlled' | 'transition' | 'compression-controlled';
  /** Nominal moment Mn (kN·m). */
  Mn: number;
  /** Available moment φMn (kN·m). */
  phiMn: number;
  /** Required steel for given Mu (mm²). */
  AsReq: number;
  /** Minimum steel per ACI §9.6.1.2 (mm²). */
  AsMin: number;
  /** Max steel for tension-controlled response (mm²) — informational. */
  AsMaxTC: number;
  /** Demand-to-capacity ratio Mu / φMn. */
  ratio: number;
  /** Whether flexure check passes. */
  ok: boolean;
  /** Whether the section needs compression steel (Mu > φMn,max with singly). */
  needsDouble: boolean;
  ref: string;
  steps: CalcStep[];
}

export interface ShearCheck {
  /** Concrete shear strength Vc (kN). */
  Vc: number;
  /** Stirrup shear strength Vs (kN). */
  Vs: number;
  /** Nominal shear Vn = Vc + Vs (kN). */
  Vn: number;
  /** Available φVn (kN). */
  phiVn: number;
  /** Maximum permitted Vs per ACI §22.5.1.2 (kN). */
  VsMax: number;
  /** Maximum stirrup spacing per ACI §10.7.6.5.2 (mm). */
  sMax: number;
  /** Required stirrup spacing for given Vu (mm). */
  sReq: number;
  /** Provided stirrup area Av (mm²) per spacing. */
  Av: number;
  /** Minimum required Av per ACI §9.6.3.4 (mm²). */
  AvMin: number;
  /** Demand-to-capacity ratio Vu / φVn. */
  ratio: number;
  /** Whether shear check passes. */
  ok: boolean;
  /** Whether stirrups are required (Vu > 0.5·φVc). */
  stirrupsRequired: boolean;
  ref: string;
  steps: CalcStep[];
}

export interface DeflectionCheck {
  /** Gross moment of inertia Ig (mm⁴). */
  Ig: number;
  /** Cracked moment of inertia Icr (mm⁴). */
  Icr: number;
  /** Modulus of rupture fr (MPa). */
  fr: number;
  /** Cracking moment Mcr (kN·m). */
  Mcr: number;
  /** Effective moment of inertia Ie (Branson) (mm⁴). */
  Ie: number;
  /** Modulus of elasticity Ec (MPa). */
  Ec: number;
  /** Modular ratio n = Es/Ec. */
  n: number;
  /** Reinforcement ratio for doubly reinf ρ′ (compression). */
  rhoComp: number;
  /** Sustained-load multiplier λΔ = ξ/(1 + 50·ρ′). */
  lambdaDelta: number;
  /** Time multiplier ξ (depends on period). */
  xi: number;
  /** Immediate deflection Δi (mm). */
  deltaI: number;
  /** Long-term deflection Δlt (mm). */
  deltaLt: number;
  /** Deflection used to check vs limit (mm). */
  deltaCheck: number;
  /** Code limit Δlimit = L / ratio (mm). */
  deltaLimit: number;
  /** L/ratio used (180/240/360/480 per Tabla 24.2.2). */
  deltaLimitRatio: number;
  /** Limit category. */
  limitCategory: DeflectionLimitCategory;
  ratio: number;
  ok: boolean;
  ref: string;
  steps: CalcStep[];
}

export interface CrackControlCheck {
  /** Service stress in tension steel fs (MPa). */
  fs: number;
  /** Maximum allowed bar spacing s_max per ACI §24.3.2 (mm). */
  sMax: number;
  /** Actual bar spacing s (mm). */
  s: number;
  /** Concrete cover to centre of bar cc (mm). */
  cc: number;
  ratio: number;
  ok: boolean;
  ref: string;
  steps: CalcStep[];
}

export interface BeamAnalysis {
  /** Echo of inputs (after defaulting). */
  input: BeamInput;
  /** Flexure check (always present). */
  flexure: FlexureCheck;
  /** Shear check (always present). */
  shear: ShearCheck;
  /** Deflection check (always present). */
  deflection: DeflectionCheck;
  /** Crack-control check (always present). */
  crack: CrackControlCheck;
  /** Self-weight (kN/m). */
  selfWeight: number;
  /** Section type detected. */
  sectionType: SectionShape;
  /** Whether the design is compression-controlled (warning). */
  warnings: string[];
  /** Overall pass/fail (logical AND of flexure, shear, deflection, crack). */
  ok: boolean;
  /** Solver completed without errors. */
  solved: boolean;
}

// ============================================================================
// Bar catalog — SI metric + ASTM imperial
// ============================================================================
export interface Bar {
  /** Display label (e.g. "#9", "M25"). */
  label: string;
  /** Nominal diameter db (mm). */
  db: number;
  /** Cross-section area Ab (mm²). */
  Ab: number;
  /** Mass per metre (kg/m). */
  mass: number;
  /** System. */
  system: 'imperial' | 'metric';
}

export const BAR_CATALOG: Bar[] = [
  // ASTM A615 — imperial sizes (US)
  { label: '#3',  db:  9.5, Ab:   71, mass: 0.560, system: 'imperial' },
  { label: '#4',  db: 12.7, Ab:  129, mass: 0.994, system: 'imperial' },
  { label: '#5',  db: 15.9, Ab:  199, mass: 1.552, system: 'imperial' },
  { label: '#6',  db: 19.1, Ab:  284, mass: 2.235, system: 'imperial' },
  { label: '#7',  db: 22.2, Ab:  387, mass: 3.042, system: 'imperial' },
  { label: '#8',  db: 25.4, Ab:  510, mass: 3.973, system: 'imperial' },
  { label: '#9',  db: 28.7, Ab:  645, mass: 5.060, system: 'imperial' },
  { label: '#10', db: 32.3, Ab:  819, mass: 6.404, system: 'imperial' },
  { label: '#11', db: 35.8, Ab: 1006, mass: 7.907, system: 'imperial' },
  { label: '#14', db: 43.0, Ab: 1452, mass: 11.38, system: 'imperial' },
  { label: '#18', db: 57.3, Ab: 2581, mass: 20.24, system: 'imperial' },
  // CSA / EN metric
  { label: 'M10', db: 11.3, Ab:  100, mass: 0.785, system: 'metric'   },
  { label: 'M15', db: 16.0, Ab:  200, mass: 1.570, system: 'metric'   },
  { label: 'M20', db: 19.5, Ab:  300, mass: 2.355, system: 'metric'   },
  { label: 'M25', db: 25.2, Ab:  500, mass: 3.925, system: 'metric'   },
  { label: 'M30', db: 29.9, Ab:  700, mass: 5.495, system: 'metric'   },
  { label: 'M35', db: 35.7, Ab: 1000, mass: 7.850, system: 'metric'   },
  { label: 'M45', db: 43.7, Ab: 1500, mass: 11.78, system: 'metric'   },
  { label: 'M55', db: 56.4, Ab: 2500, mass: 19.63, system: 'metric'   },
];

export function lookupBar(label: string): Bar | undefined {
  return BAR_CATALOG.find((b) => b.label === label);
}

export function barArea(label: string): number {
  return lookupBar(label)?.Ab ?? 0;
}

export function barDiameter(label: string): number {
  return lookupBar(label)?.db ?? 0;
}

// ============================================================================
// Material presets
// ============================================================================
export const CONCRETE_PRESETS = [
  { label: "f'c = 21 MPa (3000 psi)", fc: 21 },
  { label: "f'c = 25 MPa", fc: 25 },
  { label: "f'c = 28 MPa (4000 psi)", fc: 28 },
  { label: "f'c = 30 MPa", fc: 30 },
  { label: "f'c = 35 MPa (5000 psi)", fc: 35 },
  { label: "f'c = 40 MPa", fc: 40 },
  { label: "f'c = 45 MPa", fc: 45 },
  { label: "f'c = 50 MPa", fc: 50 },
  { label: "f'c = 55 MPa", fc: 55 },
  { label: "f'c = 60 MPa", fc: 60 },
];

export const REBAR_PRESETS = [
  { label: 'ASTM A615 Gr 60 — fy=420 MPa', fy: 420 },
  { label: 'ASTM A615 Gr 80 — fy=550 MPa', fy: 550 },
  { label: 'ASTM A706 Gr 60 — fy=420 MPa (low-alloy)', fy: 420 },
  { label: 'EN 10080 B500A — fy=500 MPa', fy: 500 },
  { label: 'EN 10080 B500B — fy=500 MPa', fy: 500 },
  { label: 'CSA G30.18 Gr 400 — fy=400 MPa', fy: 400 },
];
