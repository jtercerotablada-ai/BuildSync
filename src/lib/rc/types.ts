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
  /** Maximum aggregate size dagg (mm). Default 19 (3/4"). Used for §25.2.1 spacing. */
  aggSize?: number;
  /** Exposure category (drives min cover §20.5.1.3). Default 'interior'. */
  exposure?: 'interior' | 'exterior' | 'cast-against-ground';
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

// ─── Rebar Layers + Zones (Phase 6 — continuous beam detailing) ────────────
//
// "Rebar Layers and Zones" table model: each layer is a rectangular rebar
// group (count + bar size) that runs along a portion of the beam
// (xStart → xEnd) at a given vertical position (top or bottom face). Multiple
// layers stack into a complete reinforcement layout that matches real shop
// drawings: bottom continuous + bottom curtailed (extra) + top at supports
// (negative-moment), etc.
//
// The legacy `tension`/`compression` fields stay for single-section mode.
// When `layers` is present, it OVERRIDES tension/compression and the solver
// resolves per-station As demand using the layers.
//
// Detailing rules from Wight & MacGregor 7e Ch 10 + ACI 318-25 §9.7.3.
//
export interface RebarLayer {
  /** Vertical position in the cross-section. */
  position: 'top' | 'bottom';
  /** Number of bars in this layer (across the width). */
  count: number;
  /** Bar label, e.g. "#9", "M25". */
  bar: string;
  /** Distance from the corresponding face (top or bottom of beam) to the
   *  CENTER of the layer (mm). Multiple layers at different topDistances
   *  stack vertically (e.g. layer 1 at 50 mm, layer 2 at 100 mm). */
  topBotDistance: number;
  /** Cover override (mm). If null, uses Geometry.coverClear. */
  cover?: number;
  /** Start position along the beam (mm from left support). */
  xStart: number;
  /** End position along the beam (mm from left support). */
  xEnd: number;
  /** Bar mark for shop drawing (e.g. "B1", "T1"). Auto-generated if absent. */
  mark?: string;
}

/** Stirrup zone — same idea applied to transverse reinforcement. */
export interface ShearZoneInput {
  /** Number of legs (typically 2 or 4 for wide beams). */
  legs: number;
  /** Stirrup bar label (e.g. "#3"). */
  bar: string;
  /** Centre-to-centre spacing along beam (mm). */
  spacing: number;
  /** Start position (mm from left support). */
  xStart: number;
  /** End position (mm from left support). */
  xEnd: number;
}

export interface Reinforcement {
  /** Tension steel — legacy single-section mode (a single bar group). For
   *  continuous beams, prefer `layers`. */
  tension: BarGroup[];
  /** Compression / top steel — optional. Legacy single-section mode. */
  compression?: BarGroup[];
  /** Stirrups (transverse reinforcement) — legacy single-zone mode. */
  stirrup: StirrupConfig;
  /** Number of rows of tension bars. Default 1. */
  tensionRows?: number;
  /** Skin reinforcement on side faces §9.7.2.3 (h > 900 mm). */
  skin?: { bar: string; countPerFace: number };

  // ─── Phase 6 — layered mode ──────────────────────────────────────────────
  /** Longitudinal-rebar layers (top and bottom, each over a span [xStart,
   *  xEnd]). When present, these OVERRIDE the legacy tension/compression
   *  fields for capacity calculations. */
  layers?: RebarLayer[];
  /** Stirrup zones (each over a span [xStart, xEnd] with its own spacing).
   *  When present, OVERRIDES the legacy single-zone `stirrup` field. */
  shearZones?: ShearZoneInput[];
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
  /** Factored design torsion Tu (kN·m) — for spandrel / edge / eccentric-load
   *  beams. ACI 318-25 §22.7. Defaults to 0 (most beams). */
  Tu?: number;
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
  /** Torsion design assumption — equilibrium torsion (Tu cannot be reduced) or
   *  compatibility torsion (Tu may be reduced to φ·Tcr per §22.7.3.2). Default
   *  'equilibrium' (conservative). */
  torsionType?: 'equilibrium' | 'compatibility';
}

export type DeflectionLimitCategory =
  | 'flat-roof-no-attached'
  | 'floor-no-attached'
  | 'floor-attached-not-likely'
  | 'floor-attached-likely-damage';

// ============================================================================
// Envelope inputs (Phase 1: simply-supported with UDL + point loads, or manual)
// ============================================================================

export type LoadModel = 'manual' | 'simply-supported';

export interface UDL {
  /** Factored uniform load wu (kN/m). Includes self-weight if you choose. */
  wu: number;
  /** Service UDL ws (kN/m) — for serviceability if you want envelope deflections later. */
  ws?: number;
}

export interface PointLoad {
  /** Position from left support (mm). */
  x: number;
  /** Factored load Pu (kN). */
  Pu: number;
  /** Service load Ps (kN) — optional. */
  Ps?: number;
}

export interface ManualStation {
  /** Position from left support (mm). */
  x: number;
  /** Factored moment Mu at this station (kN·m). + tension at bottom. */
  Mu: number;
  /** Factored shear Vu at this station (kN). */
  Vu: number;
}

// ─── Multi-span continuous beam (Phase 5a) ────────────────────────────────
/** Support type at each interior / end node of a continuous beam. */
export type SupportType = 'pin' | 'roller' | 'fix' | 'free';

export interface ContinuousSpan {
  /** Span length (mm). */
  L: number;
  /** Factored UDL on this span (kN/m). Includes self-weight if you want. */
  wDL?: number;
  /** Factored UDL live load on this span (kN/m). Used for pattern loading. */
  wLL?: number;
  /** Factored point loads on this span (x measured from LEFT end of span). */
  point?: PointLoad[];
}

export interface ContinuousBeamModel {
  /** Spans, listed left-to-right. */
  spans: ContinuousSpan[];
  /** Supports at each node (length = spans.length + 1). */
  supports: SupportType[];
  /** Number of integration stations PER SPAN (default 11). */
  nStations?: number;
  /** Apply ACI §6.4 pattern loading (LL on alternating spans for max +M
   *  midspan / max −M support)? Default true. */
  patternLL?: boolean;
}

/** Demand source: how to derive Mu(x), Vu(x). */
export type DemandSource =
  | { kind: 'simply-supported'; udl?: UDL; point: PointLoad[]; nStations?: number }
  | { kind: 'manual'; stations: ManualStation[] }
  | { kind: 'continuous'; model: ContinuousBeamModel };

export interface BeamEnvelopeInput {
  code: Code;
  method: DesignMethod;
  geometry: Geometry;
  materials: Materials;
  reinforcement: Reinforcement;
  /** Demand source (replaces Loads.Mu/Vu single-point for envelope mode). */
  demand: DemandSource;
  /** Loads block kept for serviceability (Ma, M_DL, M_LL, deflectionLimitCategory). */
  loads: Loads;
  branding?: ReportBranding;
}

// ============================================================================
// Envelope outputs
// ============================================================================
export interface StationResult {
  /** Position from left support (mm). */
  x: number;
  /** Factored moment Mu (kN·m). */
  Mu: number;
  /** Factored shear Vu (kN). */
  Vu: number;
  /** Available flexural strength φMn (kN·m). */
  phiMn: number;
  /** Available shear strength φVn (kN). */
  phiVn: number;
  /** Mu / φMn at this station. */
  flexureRatio: number;
  /** Vu / φVn at this station. */
  shearRatio: number;
  /** Both flexure & shear pass at this station. */
  ok: boolean;
}

export interface GoverningFailure {
  /** What governs the design (highest ratio across all checks). */
  kind: 'flexure' | 'shear' | 'deflection' | 'crack' | 'torsion' | 'none';
  /** Position of the worst station (mm). For deflection/crack, set to L/2 (midspan). */
  x: number;
  /** Demand at that station (kN·m for flexure, kN for shear). */
  demand: number;
  /** Capacity at that station. */
  capacity: number;
  /** Worst ratio (max along beam). */
  ratio: number;
  /** Bilingual narrative. */
  narrativeEn: string;
  narrativeEs: string;
  /** Suggested action if it fails. */
  actionEn?: string;
  actionEs?: string;
}

export interface EnvelopeAnalysis {
  /** Echo of inputs (after defaulting). */
  input: BeamEnvelopeInput;
  /** Resolved stations. */
  stations: StationResult[];
  /** Worst (max) ratios along the beam. */
  maxFlexureRatio: number;
  maxShearRatio: number;
  /** What governs and where. */
  governing: GoverningFailure;
  /** Section flexure check — same shape as single-section, evaluated at worst flexure station. */
  flexureWorst: FlexureCheck;
  /** Section shear check — evaluated at worst shear station. */
  shearWorst: ShearCheck;
  /** Deflection (single-point, uses Loads.Ma). Always present. */
  deflection: DeflectionCheck;
  /** Crack control. */
  crack: CrackControlCheck;
  /** Detailing checks (code-mandated). */
  detailing: DetailingCheck;
  /** Torsion check (always present, fields zeroed if Tu = 0). */
  torsion: TorsionCheck;
  /** Phase 3 — stirrup zoning + bar curtailment + dev lengths. Always populated in envelope mode. */
  elevation?: ElevationData;
  /** Self-weight (kN/m). */
  selfWeight: number;
  /** Section type. */
  sectionType: SectionShape;
  warnings: string[];
  /** Overall pass/fail. */
  ok: boolean;
  solved: boolean;
}

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
  /** Time-step deflection curve — Δ at typical milestones (mm). Each entry is
   *  { months, xi, lambdaDelta, deltaLt } so the UI can plot Δ(t) growth. */
  deltaCurve: Array<{ months: number; xi: number; lambdaDelta: number; delta: number }>;
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
  /** Quantitative crack width w (mm) per Frosch (1999), referenced in
   *  ACI 318-25 R24.3.1:
   *    w = 2·(fs/Es)·β·√(dc² + (s/2)²)
   *  where β = (h − c)/(d − c) and dc = clear cover to centre of nearest bar. */
  wCrack: number;
  /** Suggested allowable crack width w,allow (mm) — ACI commentary R24.3.1
   *  guidance: 0.41 mm interior, 0.33 mm exterior, 0.18 mm aggressive. */
  wAllow: number;
  /** w/wAllow ratio. */
  wRatio: number;
  /** Whether the quantitative crack width is below the recommended limit. */
  wOk: boolean;
  ratio: number;
  ok: boolean;
  ref: string;
  steps: CalcStep[];
}

// ============================================================================
// Torsion check — ACI 318-25 §22.7 + §9.5.4 + §9.7.6.3
// ============================================================================
export interface TorsionCheck {
  /** Whether the input torsion Tu is non-zero — false ⇒ skipped, all fields
   *  echo the threshold but no design demand. */
  applies: boolean;
  /** Section gross properties (per §22.7.6.1, hollow sections handled w/ Aoh). */
  /** Area enclosed by outside perimeter Acp (mm²). */
  Acp: number;
  /** Outside perimeter pcp (mm). */
  pcp: number;
  /** Area enclosed by centerline of outermost closed stirrup Aoh (mm²). */
  Aoh: number;
  /** Perimeter of centerline of outermost closed stirrup ph (mm). */
  ph: number;
  /** Gross area enclosed by shear flow path Ao (mm²) — taken as 0.85·Aoh. */
  Ao: number;

  /** Threshold torsion Tth = φ·0.083·λ·√fc·(Acp²/pcp) per §9.5.4.1 (kN·m).
   *  If |Tu| ≤ Tth, torsion may be neglected. */
  Tth: number;
  /** Cracking torque Tcr = 0.33·λ·√fc·(Acp²/pcp) per §22.7.5 (kN·m). */
  Tcr: number;
  /** Torsion demand Tu (kN·m). */
  Tu: number;
  /** Reduced torsion Tu_red used in design — Tu for equilibrium torsion,
   *  min(Tu, φ·Tcr) for compatibility torsion per §22.7.3.2. */
  TuRed: number;
  /** Whether torsion can be neglected (Tu ≤ Tth). */
  neglected: boolean;

  /** Required transverse At/s (mm²/mm) — area of one leg of closed stirrup
   *  per unit length. ACI Eq 22.7.6.1a with cot(θ)=1, θ=45°. */
  AtPerS: number;
  /** Required longitudinal Al (mm²) — total additional area distributed
   *  around the perimeter ph. Eq 22.7.6.1b. */
  Al: number;
  /** Combined transverse demand (Av/s + 2·At/s) — ACI Eq R22.7.6.1. */
  AvtPerS: number;

  /** Maximum stirrup spacing for torsion §9.7.6.3.3 — min(ph/8, 300 mm). */
  sMaxTorsion: number;

  /** Combined Vu + Tu interaction per §22.7.7.1: ratio of (left/right) of:
   *    LHS = √[ (Vu/(bw·d))² + (Tu·ph/(1.7·Aoh²))² ]
   *    RHS = φ·(Vc/(bw·d) + 0.66·√fc)                   (solid sections)
   *  Compares as LHS/RHS — must be ≤ 1.0. */
  interactionRatio: number;
  /** Whether crushing-of-web check passes. */
  interactionOk: boolean;

  /** Final pass/fail (interaction + provided stirrup spacing limit). */
  ok: boolean;

  /** Code ref. */
  ref: string;
  /** Per-step calc trace for the report. */
  steps: CalcStep[];
}

// ============================================================================
// Detailing checks (code-mandated code-mandated rules)
// ============================================================================

/** Single sub-check — one ACI provision, pass/fail + bilingual notes. */
export interface DetailingItem {
  /** Provision label, e.g. 'Cover §20.5.1.3'. */
  label: string;
  /** ACI code reference for the provision. */
  ref: string;
  /** Whether this sub-check passes. */
  ok: boolean;
  /** Whether this sub-check is just informational (no fail penalty). */
  informational?: boolean;
  /** Required value (units in note). Optional. */
  required?: number;
  /** Provided value (units in note). Optional. */
  provided?: number;
  /** Plain-language English explanation. */
  noteEn: string;
  /** Plain-language Spanish explanation. */
  noteEs: string;
}

// ============================================================================
// Phase 3 — Development length, lap splices, stirrup zoning, bar curtailment
// ============================================================================

/** Bar location for §25.4.2.5(d) ψt factor: top bars get 1.3, others 1.0. */
export type BarLocation = 'top' | 'bottom' | 'side';

/** Bar coating for §25.4.2.5(b) ψe factor. */
export type BarCoating = 'uncoated' | 'epoxy' | 'galvanized';

export interface DevLengthInfo {
  /** Bar diameter db (mm). */
  db: number;
  /** Bar location (drives ψt). */
  location: BarLocation;
  /** Bar coating (drives ψe). */
  coating: BarCoating;
  /** Confinement / cover case used (1 or 2 per §25.4.2.3). */
  case: 1 | 2;
  /** Tension development length ld (mm). */
  ld: number;
  /** Compression development length ldc (mm). */
  ldc: number;
  /** Multipliers used (for the calc step trace). */
  factors: { psiT: number; psiE: number; psiS: number; psiG: number; lambda: number };
  /** Code ref. */
  ref: string;
  /** Calc steps for the report. */
  steps: CalcStep[];
}

export interface LapSpliceInfo {
  /** Class A length = 1.0·ld (mm). */
  classA: number;
  /** Class B length = 1.3·ld (mm). */
  classB: number;
  /** Recommended class given the design — usually B unless stress ≤ 50% fy and ≤ 50% bars spliced at one location. */
  recommended: 'A' | 'B';
  /** Code ref. */
  ref: string;
}

/** A continuous range of the beam length where stirrups have a single spacing. */
export interface StirrupZone {
  /** Start of zone (mm from left support). */
  xStart: number;
  /** End of zone (mm from left support). */
  xEnd: number;
  /** Selected stirrup spacing (mm) for this zone. */
  s: number;
  /** Max permitted spacing for this zone (mm) — driver. */
  sMax: number;
  /** Worst Vu seen in this zone (kN). */
  VuMax: number;
  /** Worst Vu/φVn ratio in this zone. */
  ratio: number;
  /** Number of stirrups required across this zone (rounded up). */
  count: number;
  /** Whether the zone passes shear with the chosen spacing. */
  ok: boolean;
}

export interface StirrupZoningResult {
  /** Ordered list of zones, covering [0, L]. */
  zones: StirrupZone[];
  /** Total stirrup count across the beam. */
  totalCount: number;
  /** Total mass of all stirrups (kg) — for steel takeoff. */
  totalMass: number;
  /** Whether all zones meet shear demand + s,max. */
  ok: boolean;
  /** Bilingual narrative summary. */
  narrativeEn: string;
  narrativeEs: string;
}

/** A single longitudinal bar with its termination/extension info. */
export interface BarCutoff {
  /** Bar group index in Reinforcement.tension or .compression. */
  groupIndex: number;
  /** Position in section: 'tension' (bottom) or 'compression' (top). */
  position: 'tension' | 'compression';
  /** Bar label (e.g. '#9'). */
  bar: string;
  /** Number of bars in this group. */
  count: number;
  /** Group is "running" (extends full length) or "curtailed" (terminated). */
  kind: 'running' | 'curtailed';
  /** Theoretical cutoff x (mm from left support) — where Mu equals reduced φMn. Null for running. */
  xTheoretical?: number;
  /** Actual cutoff x (mm) after extension max(d, 12·db) per §9.7.3.3. Null for running. */
  xActual?: number;
  /** Development-length extension required from xActual. */
  ld?: number;
  /** Bar starts at xStart, ends at xEnd along the beam (mm). */
  xStart: number;
  xEnd: number;
  /** Bilingual note (why this bar is curtailed or running). */
  noteEn: string;
  noteEs: string;
}

export interface CurtailmentResult {
  /** Layout per bar group. */
  bars: BarCutoff[];
  /** Total mass of longitudinal steel (kg). */
  totalMass: number;
  /** Whether the curtailment plan satisfies §9.7.3 (extensions, support continuation). */
  ok: boolean;
  /** Bilingual narrative summary. */
  narrativeEn: string;
  narrativeEs: string;
}

export interface ElevationData {
  /** Stirrup zoning along the beam. */
  zoning: StirrupZoningResult;
  /** Bar cutoffs and continuations. */
  curtailment: CurtailmentResult;
  /** Development-length info per bar size used. */
  devLengths: Record<string, DevLengthInfo>;
  /** Lap-splice info per bar size used. */
  lapSplices: Record<string, LapSpliceInfo>;
}

export interface DetailingCheck {
  /** Min clear concrete cover §20.5.1.3 — driven by exposure. */
  cover: DetailingItem;
  /** Bar physically fits in bw with required clear spacing §25.2.1 + Wight Eq 5-25. */
  barFit: DetailingItem;
  /** Min clear bar spacing §25.2.1 — max(25mm, db, 4/3·dagg). */
  barSpacing: DetailingItem;
  /** Hanger bars (practical) — at least 2 top bars to hold stirrups. */
  hangerBars: DetailingItem;
  /** Skin reinforcement required when h > 900 mm §9.7.2.3. */
  skinReinf: DetailingItem;
  /** Min stirrup bar size §25.7.2.2 (≥#3 for #11 & smaller longit; ≥#4 for #14, #18). */
  stirrupSize: DetailingItem;
  /** Stirrup leg spacing across the width §9.7.6.2.2. */
  stirrupLegSpacing: DetailingItem;
  /** Lateral support of compression reinforcement §9.7.6.4 (closed stirrups + size). */
  compressionLateral: DetailingItem;
  /** Aggregate ok flag (logical AND of non-informational items). */
  ok: boolean;
  /** Bilingual aggregated narrative. */
  narrativeEn: string;
  narrativeEs: string;
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
  /** Detailing checks (code-mandated code-mandated rules). */
  detailing: DetailingCheck;
  /** Torsion check (always present, but fields are zeroed if Tu = 0). */
  torsion: TorsionCheck;
  /** Self-weight (kN/m). */
  selfWeight: number;
  /** Section type detected. */
  sectionType: SectionShape;
  /** Whether the design is compression-controlled (warning). */
  warnings: string[];
  /** Overall pass/fail (logical AND of flexure, shear, deflection, crack, detailing, torsion). */
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
