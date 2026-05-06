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

export type WallKind = 'cantilever';

/**
 * Cantilever retaining-wall geometry. Convention:
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
 * BuildSync supports cantilever walls only. Other wall families (gravity,
 * counterfort, basement, abutment) were removed in commit "scope: cantilever
 * only" to focus on a single, deeply-implemented wall type matching CYPE
 * StruBIM Cantilever Walls.
 */
export interface WallGeometry {
  kind: 'cantilever';
  H_stem: number;        // stem height above footing top (mm)
  t_stem_top: number;    // stem thickness at top (mm)
  t_stem_bot: number;    // stem thickness at footing (mm)
  B_toe: number;         // toe width (mm)
  B_heel: number;        // heel width (mm)
  H_foot: number;        // footing thickness (mm)
  backfillSlope: number; // β, slope of backfill above stem top (radians, 0 = level)
  frontFill: number;     // depth of soil in front of wall above footing top (mm)
  /** Optional shear key projecting below the footing. */
  key?: { width: number; depth: number; offsetFromHeel: number };
}

/** Type alias kept for backwards compatibility with existing print-report imports. */
export type CantileverGeometry = WallGeometry;

export type WallCode = 'ACI 318-25' | 'ACI 318-19';

export interface ConcreteMaterial {
  fc: number;    // f'c (MPa)
  fy: number;    // yield strength of reinforcement (MPa)
  Es: number;    // steel modulus (MPa, typically 200 000)
  gamma: number; // concrete unit weight (kN/m³; reinforced typ. 24)
  cover: number; // clear cover to rebar (mm, typ. 50 for soil face, 40 otherwise)
}

/**
 * Soil layer on the retained (backfill) side. Multi-layer supported.
 *   γ          = apparent (moist) unit weight (kN/m³). Used above the water table.
 *   φ          = friction angle (radians)
 *   c          = cohesion (kPa = kN/m²)
 *   thickness  = measured from top of stem down (mm). Last layer is unbounded.
 *   gammaSubmerged  (optional) = submerged effective unit weight γ' = γ_sat − γ_w
 *                  (kN/m³). Used below the water table when known from lab
 *                  testing. If omitted, γ' is approximated as max(γ − γ_w, 0)
 *                  treating γ as the saturated weight (geotechnical convention
 *                  for inputs to retaining-wall design when WT is enabled).
 *                  Per CYPE "Lateral Pressure Calculations" §1, effective
 *                  stress below WT uses γ' explicitly.
 */
export interface SoilLayer {
  name: string;
  gamma: number;            // unit weight (kN/m³)
  phi: number;              // friction angle φ (radians)
  c: number;                // cohesion (kPa)
  thickness: number;        // mm; 0 or Infinity for "extend to bottom"
  gammaSubmerged?: number;  // γ' (kN/m³) for use below WT
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

export type EarthPressureTheory = 'rankine' | 'coulomb' | 'at-rest';

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
  /** Code edition for citations. Defaults to ACI 318-25. */
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
  /**
   * Combined axial + bending interaction check at the base of the stem
   * (ACI 318-25 §22.4). Computes nominal Pn, Mn at the converged neutral
   * axis depth and reports utilization = Mu / (φ·Mn) at the given Pu.
   */
  pmCheck?: {
    Pu: number;            // factored axial (kN/m), compression positive
    Pn: number;            // nominal axial at solution c (kN/m)
    Mn: number;            // nominal moment at solution c (kN·m/m)
    phi: number;           // strength reduction factor (0.65–0.90)
    c: number;             // neutral-axis depth (mm)
    epsilonT: number;      // strain at extreme tension steel
    classification: 'tension-controlled' | 'compression-controlled' | 'transition';
    utilization: number;   // Mu / (φ·Mn)
    ok: boolean;
  };
  /**
   * Geometric and mechanical reinforcement ratios per face (vertical bars
   * at the rear of the stem). CYPE differentiates min/max ratios for
   * tension face and compression face.
   *   ρ = As / (b·d)            geometric
   *   ω = (As·fy) / (b·d·f'c)   mechanical (EC-2 / CYPE)
   * ACI 318-25 minimums:
   *   Walls (Table 11.6.1):  ρ_min,vert = 0.0012 (≤#16) / 0.0015 (>#16)
   *   Slabs (§24.4.3):       ρ_min,slab = 0.0018 for fy = 420 MPa
   *   Tension-controlled max (§21.2.2): εt ≥ 0.005, typ. ρ_max ~ 0.015–0.02
   */
  ratios?: {
    rho_geometric: number;     // ρ = As / (b·d)
    rho_min: number;           // §24.4.3 / Table 11.6.1
    rho_max: number;           // tension-controlled limit
    omega_mechanical: number;  // ω = ρ · (fy/fc)
    rho_geometric_ok: boolean;
    rho_max_ok: boolean;       // ρ ≤ ρ_max → tension-controlled
  };
  /**
   * Cap beam ("top of wall") check — per CYPE StruBIM Cantilever Walls
   * Manual §2.4.1.5 a horizontal cap beam (typically 2 #4) runs along
   * the full length of the wall to control cracking and provide a tied
   * edge for the verticals.
   */
  capBeam?: {
    As_provided: number;       // mm² (default 2 × #4 = 258)
    As_min: number;            // mm² minimum per cap-beam criterion
    layout: string;            // e.g. "2 #4"
    ok: boolean;
  };
  /**
   * Anchorage of vertical stem bars at the TOP of the wall (per ACI
   * 318-25 §25.4 development length / §25.4.3 hook). The bars must be
   * developed past their flexural cut-off point per §9.7.3.3.
   */
  topAnchorage?: DevelopmentLengthResult;
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

export interface WallResults {
  pressure: PressureDistribution;
  stability: StabilityResult;
  stem: StemDesignResult;
  heel: SlabDesignResult;
  toe: SlabDesignResult;
  key: KeyDesignResult;
  issues: string[]; // non-fatal warnings (low eccentricity, thin cover, etc.)
  errors: string[]; // fatal: FS < min, bearing exceeds, etc.
}
