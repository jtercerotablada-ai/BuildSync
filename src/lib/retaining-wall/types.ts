// Retaining-wall analysis types.
// SI internal: lengths mm, forces N, moments N·mm, stresses MPa, unit weights
// kN/m³ (stored as SI: N/mm³ = kN/m³ × 1e-6), angles radians.

// ─── Wall kinds ────────────────────────────────────────────────────────────
//
// Eight wall types are supported, all sharing a common cross-section base
// (the cantilever-style stem-on-footing envelope). Each kind layers the
// fields it specifically needs on top.
//
//  1. cantilever    — single tapered stem + toe + heel (the bread-and-butter)
//  2. gravity       — mass concrete, no flexural rebar reliance, optional
//                     additional batter on either face
//  3. semi-gravity  — cantilever envelope with light vertical reinforcement
//                     (temperature + minor flexure only)
//  4. l-shaped      — heel only (B_toe = 0); stem may lean forward
//  5. counterfort   — REAR buttresses; stem becomes a slab spanning HORIZONTALLY
//                     between counterforts; heel is a slab spanning between
//                     counterforts longitudinally; counterfort is a T-beam in
//                     tension (ACI 318-25 §13.3 / §22.2 / §9.7)
//  6. buttressed    — FRONT buttresses (compression mirror of counterfort)
//  7. basement      — propped at top by floor slab/diaphragm; fixed-pinned
//                     stem moment diagram; both faces need rebar
//  8. abutment      — bridge abutment with seat + backwall + breastwall +
//                     optional wing walls; AASHTO LRFD load combinations

export type WallKind =
  | 'cantilever'
  | 'gravity'
  | 'semi-gravity'
  | 'l-shaped'
  | 'counterfort'
  | 'buttressed'
  | 'basement'
  | 'abutment';

/**
 * Common geometry shared by every wall type. Convention:
 *  • Stem = vertical concrete wall, height H_stem above footing top.
 *  • Footing = horizontal base slab with heel (behind stem) + toe (in front).
 *  • Heel supports backfill weight; toe sits below finished grade in front.
 *
 *                            <— Heel —>
 *     ┌────────────────────────────┐   top of stem
 *     │                            │
 *     │  stem                      │
 *     │  (width_top → width_bot)   │ H_stem
 *     │                            │
 *     ├──┬──────────────────────┬──┤   top of footing
 *     │▍▍│       footing        │▍▍│ H_foot
 *     │▍▍│                      │▍▍│
 *     └──┴──────────────────────┴──┘
 *     <— B_toe —><— B_stem —><—B_heel—>
 *
 * A shear key (optional) projects below the footing to increase sliding
 * resistance.
 *
 * For l-shaped walls, B_toe is forced to 0. For counterfort/buttressed,
 * the stem-thickness and heel-thickness fields refer to the SLAB spanning
 * between counterforts (the counterfort itself is in `counterfortThickness`).
 */
interface WallGeometryBase {
  H_stem: number;        // stem height above footing top (mm)
  t_stem_top: number;    // stem thickness at top (mm)
  t_stem_bot: number;    // stem thickness at footing (mm)
  B_toe: number;         // toe width (mm); l-shaped forces 0
  B_heel: number;        // heel width (mm)
  H_foot: number;        // footing thickness (mm)
  backfillSlope: number; // β, slope of backfill above stem top (radians, 0 = level)
  frontFill: number;     // depth of soil in front of wall above footing top (mm)
  /** Optional shear key projecting below the footing (cantilever / counterfort / buttressed). */
  key?: { width: number; depth: number; offsetFromHeel: number };
}

/** Cantilever wall — the existing default. */
export interface CantileverGeometry extends WallGeometryBase {
  kind: 'cantilever';
}

/** Gravity wall — mass concrete, often trapezoidal, no flexure rebar reliance. */
export interface GravityGeometry extends WallGeometryBase {
  kind: 'gravity';
  /** Additional front-face batter (rad), in addition to t_top→t_bot taper. */
  batterFront: number;
  /** Additional back-face batter (rad). */
  batterBack: number;
}

/** Semi-gravity — cantilever envelope with light vertical reinforcement only. */
export interface SemiGravityGeometry extends WallGeometryBase {
  kind: 'semi-gravity';
}

/** L-shaped — toe absent (B_toe = 0); stem may lean forward. */
export interface LShapedGeometry extends WallGeometryBase {
  kind: 'l-shaped';
  /** Forward stem lean (rad), positive = top tilted toward retained side. */
  stemLean: number;
}

/** Counterfort wall — rear buttresses tying stem to heel slab. */
export interface CounterfortGeometry extends WallGeometryBase {
  kind: 'counterfort';
  /** Spacing of counterforts along the wall length (mm), centerline-to-centerline. */
  counterfortSpacing: number;
  /** Counterfort thickness perpendicular to the wall (mm). */
  counterfortThickness: number;
}

/** Buttressed wall — front buttresses (compression mirror of counterfort). */
export interface ButtressedGeometry extends WallGeometryBase {
  kind: 'buttressed';
  /** Spacing of front buttresses along the wall length (mm). */
  buttressSpacing: number;
  /** Buttress thickness perpendicular to the wall (mm). */
  buttressThickness: number;
}

/** Basement / restrained-top wall — propped by floor slab/diaphragm. */
export interface BasementGeometry extends WallGeometryBase {
  kind: 'basement';
  /** Elevation of the top support above the footing top (mm). Typically equals H_stem for "fully propped at top." */
  topElevation: number;
  /** Top boundary condition. 'pinned' = floor slab acts as a pin; 'fixed' = diaphragm provides moment fixity. */
  topFixity: 'pinned' | 'fixed';
}

/** Bridge abutment with seat + backwall + optional wing walls. */
export interface AbutmentGeometry extends WallGeometryBase {
  kind: 'abutment';
  /** Bridge seat geometry + reactions. */
  bridgeSeat: {
    width: number;     // seat width along the abutment (mm)
    deadLoad: number;  // bridge dead load on seat (kN/m of wall)
    liveLoad: number;  // bridge live load on seat (kN/m of wall, AASHTO LL)
  };
  /** Backwall above the seat retaining roadway fill. */
  backwall: {
    H: number;  // height of backwall above seat (mm)
    t: number;  // thickness (mm)
  };
  /** Optional wing walls flanking the abutment. */
  wingWall?: {
    length: number; // mm
    H: number;      // mm
    t: number;      // mm
  };
}

export type WallGeometry =
  | CantileverGeometry
  | GravityGeometry
  | SemiGravityGeometry
  | LShapedGeometry
  | CounterfortGeometry
  | ButtressedGeometry
  | BasementGeometry
  | AbutmentGeometry;

export type WallCode = 'ACI 318-25' | 'ACI 318-19' | 'AASHTO LRFD';

export interface ConcreteMaterial {
  fc: number;    // f'c (MPa)
  fy: number;    // yield strength of reinforcement (MPa)
  Es: number;    // steel modulus (MPa, typically 200 000)
  gamma: number; // concrete unit weight (kN/m³; reinforced typ. 24)
  cover: number; // clear cover to rebar (mm, typ. 50 for soil face, 40 otherwise)
}

/**
 * Soil layer on the retained (backfill) side. Multi-layer supported.
 *   γ  = total unit weight (kN/m³)
 *   φ  = friction angle (radians)
 *   c  = cohesion (kPa = kN/m²)
 *   thickness = measured from top of stem down (mm). Last layer is unbounded.
 */
export interface SoilLayer {
  name: string;
  gamma: number;     // unit weight (kN/m³)
  phi: number;       // friction angle φ (radians)
  c: number;         // cohesion (kPa)
  thickness: number; // mm; 0 or Infinity for "extend to bottom"
}

/**
 * Soil in front of the wall (base soil carrying bearing + passive resistance).
 */
export interface BaseSoil {
  gamma: number;           // unit weight (kN/m³)
  phi: number;             // friction angle φ (radians)
  c: number;               // cohesion (kPa)
  delta: number;           // soil-footing interface friction angle δ (radians), typically (2/3)·φ
  ca: number;              // soil-footing adhesion (kPa), typically (1/2)·c
  qAllow: number;          // allowable bearing pressure (kPa); net service level
  passiveEnabled: boolean; // neglect passive resistance conservatively if false
}

export interface WaterTable {
  enabled: boolean;
  depthFromStemTop: number; // mm, measured downward; 0 means at stem top (conservative)
  gammaW: number;           // unit weight of water (kN/m³, default 9.81)
}

/**
 * Drainage system behind the wall.
 * Geotechnical best-practice for retaining walls: a continuous granular
 * drainage layer (≥ 300 mm thick) against the rear face of the stem, with
 * a perforated longitudinal drainage pipe at the base discharging to a
 * weep system or storm drain. Reduces hydrostatic pressure on the wall.
 *
 * The drainage is RENDERED in the visualisation (2D canvas, 3D viewer,
 * print report) and prevents the water-table ΔP component from being
 * relied upon — but the solver does NOT subtract drainage capacity from
 * water pressure (conservative). When `enabled = true`, the user is
 * expected to also set water.enabled = false (or keep the water table
 * deep) since the drainage relieves it.
 */
export interface DrainageSystem {
  enabled: boolean;
  /** Gravel-pack thickness against the rear face of the stem (mm, typ. 300). */
  gravelThickness: number;
  /** Perforated drain pipe diameter at the base (mm, typ. 100–150). */
  pipeDiameter: number;
}

/**
 * Loads on the wall.
 *   surchargeQ: uniform vertical stress (kPa) applied at top of backfill
 *   pointLoad:  optional line load at some distance behind stem
 *   seismic:    Mononobe-Okabe parameters (kh, kv); both zero ⇒ static only
 */
export interface WallLoads {
  surchargeQ: number;                                    // kPa
  pointLoad?: { P: number; distanceBehindStem: number }; // kN/m-of-wall, mm
  seismic: { kh: number; kv: number };                   // horizontal / vertical seismic coefficients
}

export type EarthPressureTheory = 'rankine' | 'coulomb';

/**
 * Optional firm-branding for the print-report cover.
 * (Mirrors the slab / footing print-report branding shape.)
 */
export interface ReportBranding {
  companyName?: string;
  companyTagline?: string;
  /** PNG/JPEG/SVG data-URL produced by FileReader. */
  logoDataUrl?: string;
}

export interface WallInput {
  /** Code edition for citations. Defaults to ACI 318-25; abutments auto-select AASHTO LRFD. */
  code?: WallCode;
  geometry: WallGeometry;
  concrete: ConcreteMaterial;
  backfill: SoilLayer[]; // layers from top to bottom
  baseSoil: BaseSoil;
  water: WaterTable;
  /** Drainage system behind wall — visualisation + best-practice flag. */
  drainage?: DrainageSystem;
  loads: WallLoads;
  theory: EarthPressureTheory;
  safetyFactors: {
    overturning: number;          // min FS (typ. 2.0)
    sliding: number;              // min FS (typ. 1.5)
    bearing: number;              // min FS (typ. 3.0 ultimate, 1.0 allowable check)
    eccentricity: 'kern' | 'B/3'; // e limit: kern (B/6) or middle third (B/3)
  };
  branding?: ReportBranding;
}

// ============ Results ============

export interface PressureDistribution {
  /** Earth-pressure coefficient (Ka or Kp) used. */
  K: number;
  /** Height above which pressure is integrated (from stem-top). */
  H_total: number; // mm
  /** Horizontal active force per m of wall length (kN/m). */
  Pa: number;
  /** y-coordinate of resultant above footing top (mm). */
  yBar: number;
  /** Vertical component of Pa (if wall-friction). */
  PaV: number;
  /** Contribution from surcharge (kN/m). */
  Pq: number;
  /** Contribution from water (kN/m). */
  Pw: number;
  /** Seismic additional thrust ΔPae (kN/m). */
  dPae: number;
}

export interface ForceResultant {
  label: string;
  V: number;   // vertical force (kN/m of wall), positive = down
  H: number;   // horizontal force (kN/m), positive = drives wall AWAY from backfill
  x: number;   // lever arm from toe (mm, +forward)
  y: number;   // lever arm from footing base (mm, + up)
  Mo?: number; // overturning moment about toe (kN·m/m), if applicable
  Mr?: number; // resisting moment about toe (kN·m/m)
}

export interface StabilityResult {
  resultants: ForceResultant[];
  sumV: number;              // total vertical (kN/m)
  sumH: number;              // total horizontal driving (kN/m)
  Mr: number;                // resisting moment about toe (kN·m/m)
  Mo: number;                // overturning moment about toe (kN·m/m)
  FS_overturning: number;
  FS_sliding: number;
  slidingMu: number;         // friction coefficient used (tan δ)
  passiveResistance: number; // kN/m
  keyContribution: number;   // kN/m, extra passive from key if present
  // Bearing
  eccentricity: number;       // mm, measured from footing centerline (+ toward heel)
  kern: number;               // B/6 (mm)
  qMax: number;               // kPa, max bearing pressure at toe
  qMin: number;               // kPa, min (can be 0 if heel lifts)
  bearingUtilization: number; // qMax / qAllow
  B: number;                  // total footing width (mm)
  /** Optional ultimate-bearing breakdown (Meyerhof / Vesić).  Populated by aci-checks.ts. */
  bearingMeyerhof?: {
    qu: number;          // ultimate bearing capacity (kPa)
    Nc: number; Nq: number; Ng: number;
    sc: number; sq: number; sg: number;       // shape factors
    dc: number; dq: number; dg: number;       // depth factors
    ic: number; iq: number; ig: number;       // load-inclination factors
    qaUlt: number;       // qu / FS_bearing (kPa)
  };
  // Pass/fail flags
  overturningOk: boolean;
  slidingOk: boolean;
  bearingOk: boolean;
  eccentricityOk: boolean;
}

export interface CrackControl {
  /** ACI 318-25 §24.3.2 max spacing: s = 380(280/fs) - 2.5·cc ≤ 300(280/fs). */
  s_max: number;
  fs: number;                                                       // service stress in reinforcement (MPa), = 2·fy/3
  /** Chosen bar diameter / area (display hint only). */
  bar: { id: string; area: number; diameter: number };
  /** Required spacing to provide As_req with the chosen bar (mm). */
  s_req: number;
  /** True if s_req ≤ s_max (crack control satisfied). */
  ok: boolean;
}

/** Development-length result (ACI 318-25 §25.4). */
export interface DevelopmentLengthResult {
  ld: number;       // straight tension development length (mm)
  ldh: number;      // standard 90° hook development (mm)
  available: number; // available embedment in the receiving member (mm)
  ok: boolean;
}

/** Lap-splice result (ACI 318-25 §25.5). */
export interface LapSpliceResult {
  classType: 'A' | 'B';
  ls: number;       // lap-splice length (mm)
  ok: boolean;
}

/** Curtailment band — one rebar zone within a layered stem rebar plan. */
export interface RebarCurtailmentZone {
  yStart: number;   // elevation above footing top (mm) — bottom of zone
  yEnd: number;     // elevation above footing top (mm) — top of zone
  bar: string;      // bar designation (e.g. "#6")
  spacing: number;  // mm
  As_per_m: number; // mm² / m
  As_req_max: number; // peak As demand within the zone (mm²/m)
  ok: boolean;
}

export interface StemDesignResult {
  /** Max moment at footing-top interface (kN·m/m). */
  Mu: number;
  /** Max shear at d from top of footing (kN/m). */
  Vu: number;
  /** Required As at stem base per meter (mm²/m). */
  As_req: number;
  As_min: number;   // ACI 318 min temp/shrinkage
  Vc: number;       // concrete shear capacity (kN/m)
  shearOk: boolean; // true if Vu ≤ φVc (no stirrups)
  /** effective depth d used (mm) */
  d: number;
  /** depth of stress block a (mm) */
  a: number;
  rho: number;        // reinforcement ratio
  phiMn: number;      // provided design capacity if As_req is used (kN·m/m)
  crack: CrackControl;
  /** Multi-layer rebar curtailment plan (optional, populated when computed). */
  curtailment?: RebarCurtailmentZone[];
  /** Development length of stem dowels into the footing (optional). */
  development?: DevelopmentLengthResult;
  /** Lap splice for vertical bars (optional, when stem is taller than typical bar lengths). */
  lapSplice?: LapSpliceResult;
  /** Shear-friction at the construction joint between footing and stem (optional). */
  shearFriction?: {
    Vu: number;        // kN/m
    Vn: number;        // kN/m
    Avf_req: number;   // mm²/m
    Avf_provided: number; // mm²/m (= As_req)
    ok: boolean;
  };
  /** When a basement / restrained-top wall produces tension on the FRONT face at midspan. */
  frontFace?: {
    Mu: number;
    As_req: number;
    crack: CrackControl;
  };
  /**
   * Horizontal (distribution / temperature) reinforcement in the stem.
   * Per ACI 318-25 §11.6.1 + Wight §18-3: cantilever retaining-wall stems
   * use vertical bars for flexure (sized via §22.2-22.4) and horizontal
   * bars perpendicular to the flexural reinforcement for crack control
   * and shrinkage. Minimum ρt = 0.0020 (deformed bars ≤ #16, fy = 420
   * MPa) per Table 11.6.1.
   */
  horizontalReinforcement?: {
    /** ρt minimum from Table 11.6.1 (cast-in-place, deformed). */
    rho_t_min: number;
    /** Required As per metre of stem height (mm²/m). */
    As_horizontal_per_m: number;
    /** Maximum spacing per §11.7.3.1 (= min(3·h, 450 mm)). */
    s_max: number;
  };
}

export interface SlabDesignResult {
  Mu: number;     // kN·m/m
  Vu: number;     // kN/m at d from face of support
  As_req: number; // mm²/m
  As_min: number;
  Vc: number;
  shearOk: boolean;
  d: number;
  a: number;
  phiMn: number;
  critical: 'top' | 'bottom'; // which face is in tension
  crack: CrackControl;
}

export interface KeyDesignResult {
  enabled: boolean; // true if key is modeled in geometry
  /** Horizontal passive force on key face (kN/m). */
  Hp_key: number;
  /** Factored moment at the base of the footing where the key springs from (kN·m/m). */
  Mu: number;
  /** Factored shear at the same section (kN/m). */
  Vu: number;
  d: number;        // effective depth into key (mm)
  a: number;        // Whitney block depth
  As_req: number;   // mm²/m
  As_min: number;
  Vc: number;       // kN/m concrete shear capacity
  shearOk: boolean;
  phiMn: number;
  crack: CrackControl;
}

/**
 * Counterfort design (kind = 'counterfort').
 *  • stemSlab = horizontal slab spanning between counterforts (one-way, fixed-fixed)
 *  • heelSlab = longitudinal slab spanning between counterforts under backfill
 *  • counterfort = T-beam in tension (rear face)
 */
export interface CounterfortDesignResult {
  stemSlab: SlabDesignResult;
  heelSlab: SlabDesignResult;
  counterfort: {
    Mu: number;        // T-beam max moment (kN·m)
    Vu: number;        // T-beam max shear (kN)
    bw: number;        // web width (mm) — = counterfortThickness
    d: number;         // effective depth (mm)
    As_req: number;    // tension steel (mm²)
    phiMn: number;     // capacity (kN·m)
    Vc: number;        // shear capacity (kN)
    shearOk: boolean;
  };
}

/** Buttressed design — front buttresses are in compression (mirror of counterfort). */
export interface ButtressedDesignResult extends CounterfortDesignResult {
  /** True if the buttresses fully relieve stem flexure (compression mode). */
  compressionMode: boolean;
}

/** Top-support reaction (basement / restrained-top wall). */
export interface TopSupportResult {
  /** Reaction at the top tie / floor slab (kN/m). */
  reaction: number;
  /** Stem moment diagram extrema. */
  Mmax_pos: number; // bottom face tension (kN·m/m)
  Mmax_neg: number; // top face tension (kN·m/m), negative number
  yMax_pos: number; // mm above footing top
  yMax_neg: number; // mm above footing top
  fixity: 'pinned' | 'fixed';
}

/** Bridge-seat + backwall + wing wall design (abutment). */
export interface AbutmentDesignResult {
  /** Bridge seat bearing-pad reaction summary. */
  seat: {
    PuD: number; // factored DL (kN/m)
    PuL: number; // factored LL (kN/m)
    PuTotal: number;
  };
  /** Backwall flexural design (vertical cantilever above seat). */
  backwall: SlabDesignResult;
  /** Optional wing-wall design. */
  wingWall?: SlabDesignResult;
}

export interface WallResults {
  pressure: PressureDistribution;
  stability: StabilityResult;
  stem: StemDesignResult;
  heel: SlabDesignResult;
  toe: SlabDesignResult;
  key: KeyDesignResult;
  /** Populated for kind = 'counterfort'. */
  counterfortDesign?: CounterfortDesignResult;
  /** Populated for kind = 'buttressed'. */
  buttressedDesign?: ButtressedDesignResult;
  /** Populated for kind = 'basement'. */
  topSupport?: TopSupportResult;
  /** Populated for kind = 'abutment'. */
  abutmentDesign?: AbutmentDesignResult;
  /** Gravity-wall compression-stress check (kind = 'gravity'). */
  gravityStress?: {
    sigma_max: number; // kPa
    sigma_min: number; // kPa
    sigma_allow: number; // 0.45·f'c (kPa) per ACI §14.5
    ok: boolean;
  };
  issues: string[]; // non-fatal warnings (low eccentricity, thin cover, etc.)
  errors: string[]; // fatal: FS < min, bearing exceeds, etc.
}
