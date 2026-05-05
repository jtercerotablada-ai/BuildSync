// ============================================================================
// Foundation Design — Types
// ============================================================================
// Phase 7 — Isolated spread footings per ACI 318-25 §13 + §22.5 + §22.6 + §22.8.
//
// Convention: SI units throughout (mm for length, MPa for stress, kN for
// force, kN·m for moment, kPa for soil pressure, kg/m³ for density). Footing
// is a flat pad in the X-Y plane, column rises in +Z direction at the
// footing's center.

// ─── Geometry ───────────────────────────────────────────────────────────────

/** Column cross-section type. Drives the punching-shear critical perimeter shape. */
export type ColumnShape = 'rectangular' | 'square' | 'circular';

export interface FootingGeometry {
  /** Footing plan dimension along X (mm). */
  B: number;
  /** Footing plan dimension along Y (mm). */
  L: number;
  /** Footing thickness (mm). Effective depth d ≈ T − cover − db,top − db,bot/2. */
  T: number;
  /** Effective depth d for flexure / one-way shear (mm). Defaults to T −
   *  cover − db,bot/2 if not specified. */
  d?: number;
  /** Clear cover from soil-side face to outer rebar (mm). ACI §20.5.1.3:
   *  cast against ground = 75 mm. */
  coverClear: number;
  /** Column shape. */
  columnShape: ColumnShape;
  /** Column dimension along X for rectangular/square (mm). For circular, this is the diameter. */
  cx: number;
  /** Column dimension along Y for rectangular (mm). Ignored for square (= cx) and circular. */
  cy?: number;
  /** Eccentricity of column relative to footing centroid along X (mm). 0 = centered. */
  ex?: number;
  /** Eccentricity along Y (mm). */
  ey?: number;
  /** Embedment depth of footing top below grade (mm). Used for self-weight backfill. */
  embedment?: number;
  /** Column position relative to building footprint, used for αs in two-way shear
   *  per ACI 318-25 §22.6.5.3 (αs = 40 interior / 30 edge / 20 corner).
   *  Defaults to 'interior'. */
  columnLocation?: 'interior' | 'edge' | 'corner';
}

// ─── Soil + Materials ──────────────────────────────────────────────────────

export interface SoilProperties {
  /** Allowable (service-level) bearing pressure qa (kPa = kN/m²). */
  qa: number;
  /** Soil unit weight γs (kN/m³). Default 18 (saturated clay typical). */
  gammaSoil?: number;
  /** Concrete unit weight γc (kN/m³). Default 24. */
  gammaConcrete?: number;
}

export interface FootingMaterials {
  /** Concrete fc' (MPa). */
  fc: number;
  /** Steel fy (MPa). */
  fy: number;
  /** Lightweight λ factor (ACI §19.2.4). Default 1.0. */
  lambdaC?: number;
}

// ─── Loads ─────────────────────────────────────────────────────────────────

export interface FootingLoads {
  /** Service dead load (kN). Includes the weight of the column above. */
  PD: number;
  /** Service live load (kN). */
  PL: number;
  /** Optional service moment about footing X-axis (kN·m). */
  Mx?: number;
  /** Optional service moment about footing Y-axis (kN·m). */
  My?: number;
}

// ─── Reinforcement ─────────────────────────────────────────────────────────

export interface FootingReinforcement {
  /** Bottom rebar in X direction (running along X). */
  bottomX: { bar: string; count: number };
  /** Bottom rebar in Y direction (running along Y). */
  bottomY: { bar: string; count: number };
  /** Optional top rebar (for uplift, eccentricity, etc.). */
  topX?: { bar: string; count: number };
  topY?: { bar: string; count: number };
}

// ─── Aggregate input ───────────────────────────────────────────────────────

export type Code = 'ACI 318-25' | 'ACI 318-19';

export interface ReportBranding {
  logoDataUrl?: string;
  companyName?: string;
  companyTagline?: string;
}

export interface FootingInput {
  code: Code;
  geometry: FootingGeometry;
  soil: SoilProperties;
  materials: FootingMaterials;
  loads: FootingLoads;
  reinforcement: FootingReinforcement;
  branding?: ReportBranding;
  /** Lateral horizontal load H (kN) for sliding check. Optional. */
  H?: number;
  /** Friction coefficient between footing and soil (μ). Default 0.45. */
  frictionMu?: number;
  /** Base soil cohesion (kPa). Default 0 (sandy). */
  cohesion?: number;
}

// ─── Calc Step (for report) ────────────────────────────────────────────────

export interface CalcStep {
  title: string;
  formula: string;
  substitution: string;
  result: string;
  ref?: string;
}

// ─── Output ─────────────────────────────────────────────────────────────────

/** Service-load bearing check (ACI §13). */
export interface BearingCheck {
  /** Total service vertical load including footing self-weight + soil overburden (kN). */
  P_service: number;
  /** Required area A_req = P_service / qa (mm²). */
  A_req: number;
  /** Provided area A = B·L (mm²). */
  A_prov: number;
  /** Maximum service soil pressure (kPa). For concentric: q = P/A. */
  q_max: number;
  /** Minimum service soil pressure (kPa) — only differs from q_max under eccentricity. */
  q_min: number;
  /** ratio = q_max / qa. */
  ratio: number;
  /** Whether bearing passes (q_max ≤ qa). */
  ok: boolean;
  ref: string;
  steps: CalcStep[];
}

/** Two-way (punching) shear check at d/2 from column face. Includes
 *  unbalanced-moment shear stress per ACI 318-25 §8.4.4.2. */
export interface PunchingCheck {
  /** Critical perimeter length bo (mm) at d/2 from column face. */
  bo: number;
  /** Effective depth d used (mm). */
  d: number;
  /** Aspect ratio βc = long side / short side of column. */
  betaC: number;
  /** αs factor: 40 (interior), 30 (edge), 20 (corner). Default interior. */
  alphaS: number;
  /** Three vc candidates per ACI Table 22.6.5.2 (MPa). */
  vc1: number;     // 0.33·λ·√fc'
  vc2: number;     // 0.17·(1 + 2/βc)·λ·√fc'
  vc3: number;     // 0.083·(αs·d/bo + 2)·λ·√fc'
  /** Governing vc = min(vc1, vc2, vc3) (MPa). */
  vc: number;
  /** Available φVc (kN) — capacity at critical perimeter. */
  phiVc: number;
  /** Factored shear demand at the critical perimeter (kN). */
  Vu: number;
  /** Direct shear stress vuv = Vu/(bo·d) (MPa). */
  vuv: number;
  /** Peak combined shear stress at critical perimeter (MPa) — includes
   *  unbalanced-moment contribution γv·Msc·c/Jc per §8.4.4.2.3. */
  vuMax: number;
  /** Available shear stress φ·vc (MPa). */
  phiVcStress: number;
  /** Fraction of Mu transferred by flexure (γf) per §8.4.2.2.1. */
  gammaF: number;
  /** Fraction of Mu transferred by eccentric shear (γv = 1 − γf) per §8.4.4.2.2. */
  gammaV: number;
  /** Factored unbalanced moment about X-axis (kN·m). */
  MuX: number;
  /** Factored unbalanced moment about Y-axis (kN·m). */
  MuY: number;
  /** Polar moment-of-inertia analog Jc for Mx (mm⁴). 0 when Mx = 0. */
  JcX: number;
  /** Polar moment-of-inertia analog Jc for My (mm⁴). 0 when My = 0. */
  JcY: number;
  /** Δvu from Mx unbalanced shear (MPa). */
  dvuMx: number;
  /** Δvu from My unbalanced shear (MPa). */
  dvuMy: number;
  /** Demand/capacity ratio = vuMax / (φ·vc). */
  ratio: number;
  ok: boolean;
  ref: string;
  steps: CalcStep[];
}

/** One-way shear at d from column face (each direction). */
export interface OneWayShearCheck {
  /** Direction: 'X' = long projection, critical section perpendicular to X. */
  direction: 'X' | 'Y';
  /** Footing width perpendicular to projection (mm). */
  bw: number;
  /** Effective depth d (mm). */
  d: number;
  /** Tributary cantilever length (mm). */
  cantilever: number;
  /** Vc per ACI §22.5.5.1(a) (kN). */
  Vc: number;
  /** φVc (kN). */
  phiVc: number;
  /** Vu = qnu × bw × cantilever (kN). */
  Vu: number;
  ratio: number;
  ok: boolean;
  ref: string;
  steps: CalcStep[];
}

/** Flexure design at face of column (each direction). */
export interface FootingFlexureCheck {
  direction: 'X' | 'Y';
  /** Cantilever length from column face to footing edge (mm). */
  cantilever: number;
  /** Footing width perpendicular to bending (mm). */
  bw: number;
  /** Effective depth d (mm). */
  d: number;
  /** Factored moment per unit width (kN·m / m → kN·m for the full width). */
  Mu: number;
  /** Required steel area total (mm²). */
  AsReq: number;
  /** Minimum steel per ACI §8.6.1.1 (= 0.0018·b·h for fy = 420). */
  AsMin: number;
  /** Provided As (mm²). */
  AsProv: number;
  /** φMn (kN·m) of provided As. */
  phiMn: number;
  ratio: number;
  ok: boolean;
  ref: string;
  steps: CalcStep[];
}

/** Bearing at column-footing interface §22.8. */
export interface BearingInterfaceCheck {
  /** Permitted column bearing strength φBn (kN). */
  phiBn_col: number;
  /** Permitted footing bearing strength (with √(A2/A1) factor up to 2) (kN). */
  phiBn_ftg: number;
  /** Governing φBn = min(col, ftg) (kN). */
  phiBn: number;
  /** Pu (kN). */
  Pu: number;
  ratio: number;
  ok: boolean;
  ref: string;
  steps: CalcStep[];
}

/** Overturning stability check (ACI commentary R13.3 / typical FOS=1.5). */
export interface OverturningCheck {
  /** Resisting moment about the toe (kN·m). */
  M_resist: number;
  /** Overturning moment about the toe (kN·m). */
  M_overturn: number;
  /** FOS = M_resist / M_overturn. */
  FOS: number;
  /** Required FOS (default 1.5). */
  FOS_req: number;
  /** ratio = FOS_req / FOS (≤ 1 = ok). */
  ratio: number;
  ok: boolean;
  /** True if the load is purely vertical (no moment, ratio is N/A). */
  notApplicable: boolean;
  ref: string;
  steps: CalcStep[];
}

/** Sliding stability check. */
export interface SlidingCheck {
  /** Total vertical load resisting sliding (kN). */
  N: number;
  /** Allowable horizontal load = μ·N + c·A (kN). */
  H_allow: number;
  /** Applied horizontal load (kN). */
  H: number;
  /** FOS = H_allow / H. */
  FOS: number;
  /** Required FOS (default 1.5). */
  FOS_req: number;
  ratio: number;
  ok: boolean;
  notApplicable: boolean;
  ref: string;
  steps: CalcStep[];
}

/** Bar fit / spacing check per direction (§25.2.1, §13.3.4). */
export interface BarFitCheck {
  direction: 'X' | 'Y';
  /** Provided clear bar spacing (mm). */
  s_clear: number;
  /** Min clear spacing per §25.2.1: max(25, db, 4/3·dagg). */
  s_min: number;
  /** Max clear spacing per §13.3.4 / §7.7.2.3 analogue: min(3·T, 450). */
  s_max: number;
  /** True when s_min ≤ s_clear ≤ s_max. */
  ok: boolean;
  ref: string;
  steps: CalcStep[];
}

/** Development length check at bar end (§25.4.2.3 simplified). */
export interface DevelopmentCheck {
  direction: 'X' | 'Y';
  /** Required ld in tension (mm). */
  ld: number;
  /** Available embedment from face of column to footing edge (mm). */
  embedment: number;
  /** True when embedment ≥ ld (or hooks are needed). */
  ok: boolean;
  /** True if a 90° hook is recommended (embedment < ld). */
  hookRequired: boolean;
  ref: string;
  steps: CalcStep[];
}

export interface FootingAnalysis {
  input: FootingInput;
  bearing: BearingCheck;
  punching: PunchingCheck;
  shearX: OneWayShearCheck;
  shearY: OneWayShearCheck;
  flexureX: FootingFlexureCheck;
  flexureY: FootingFlexureCheck;
  bearingInterface: BearingInterfaceCheck;
  overturning: OverturningCheck;
  sliding: SlidingCheck;
  barFitX: BarFitCheck;
  barFitY: BarFitCheck;
  developmentX: DevelopmentCheck;
  developmentY: DevelopmentCheck;
  /** Factored net soil pressure qnu used in design (kPa). */
  qnu: number;
  /** Self-weight of footing (kN). */
  Wf: number;
  /** Soil overburden weight on top of footing if embedded (kN). */
  Ws: number;
  /** True when eccentricity puts pressure outside the kern (e > B/6 or L/6) and
   *  soil pressure is computed as a triangle (Bowles), not trapezoid. */
  upliftRegion: boolean;
  /** Overall pass/fail — AND of all checks. */
  ok: boolean;
  warnings: string[];
  solved: boolean;
}

// ─── Auto-design ────────────────────────────────────────────────────────────

export interface AutoDesignOptions {
  /** 'square' forces B = L. 'rectangular' uses aspect ratio. */
  shape: 'square' | 'rectangular';
  /** L/B ratio for rectangular (default 1.25). */
  aspect?: number;
  /** Skip thickness iteration; keep input.geometry.T. */
  fixT?: boolean;
  /** Force a specific bar size (e.g. '#7'). Otherwise picks smallest fitting. */
  fixBarSize?: string;
  /** Bump B/L if overturning fails. Default true. */
  designForOverturning?: boolean;
  /** Additional service-load reserve factor on qa (default 1.0). */
  qaSafetyFactor?: number;
}

export interface AutoDesignResult {
  /** Patched FootingInput with B, L, T, rebar all set. Drop into model. */
  patchedInput: FootingInput;
  /** Whether the final analysis passes ALL checks. */
  ok: boolean;
  /** Per-step rationale (size B/L → size T → pick bottom bars → ...) for the report. */
  rationaleSteps: CalcStep[];
  /** Warnings about anything unusual or unconverged. */
  warnings: string[];
}
