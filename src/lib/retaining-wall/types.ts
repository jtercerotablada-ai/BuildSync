// Retaining-wall analysis types.
// SI internal: lengths mm, forces N, moments N·mm, stresses MPa, unit weights
// kN/m³ (stored as SI: N/mm³ = kN/m³ × 1e-6), angles radians.

export type WallKind = 'cantilever' | 'gravity';

/**
 * Cantilever wall geometry. Convention:
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
 */
export interface WallGeometry {
  kind: WallKind;
  H_stem: number;      // stem height above footing top (mm)
  t_stem_top: number;  // stem thickness at top (mm)
  t_stem_bot: number;  // stem thickness at footing (mm) — cantilever uses taper
  B_toe: number;       // toe width (mm, in front of stem)
  B_heel: number;      // heel width (mm, behind stem)
  H_foot: number;      // footing thickness (mm)
  key?: { width: number; depth: number; offsetFromHeel: number }; // optional shear key below footing
  backfillSlope: number; // β, slope of backfill above stem top (radians, 0 = level)
  frontFill: number;   // depth of soil in front of wall above footing top (mm, ≥ 0 for toe cover)
}

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
  gamma: number;   // unit weight (kN/m³)
  phi: number;     // friction angle φ (radians)
  c: number;       // cohesion (kPa)
  thickness: number; // mm; 0 or Infinity for "extend to bottom"
}

/**
 * Soil in front of the wall (base soil carrying bearing + passive resistance).
 */
export interface BaseSoil {
  gamma: number;         // unit weight (kN/m³)
  phi: number;           // friction angle φ (radians)
  c: number;             // cohesion (kPa)
  delta: number;         // soil-footing interface friction angle δ (radians), typically (2/3)·φ
  ca: number;            // soil-footing adhesion (kPa), typically (1/2)·c
  qAllow: number;        // allowable bearing pressure (kPa); net service level
  passiveEnabled: boolean; // neglect passive resistance conservatively if false
}

export interface WaterTable {
  enabled: boolean;
  depthFromStemTop: number; // mm, measured downward; 0 means at stem top (conservative)
  gammaW: number;           // unit weight of water (kN/m³, default 9.81)
}

/**
 * Loads on the wall.
 *   surchargeQ: uniform vertical stress (kPa) applied at top of backfill
 *   pointLoad:  optional line load at some distance behind stem
 *   seismic:    Mononobe-Okabe parameters (kh, kv); both zero ⇒ static only
 */
export interface WallLoads {
  surchargeQ: number;              // kPa
  pointLoad?: { P: number; distanceBehindStem: number }; // kN/m-of-wall, mm
  seismic: { kh: number; kv: number }; // horizontal / vertical seismic coefficients
}

export type EarthPressureTheory = 'rankine' | 'coulomb';

export interface WallInput {
  geometry: WallGeometry;
  concrete: ConcreteMaterial;
  backfill: SoilLayer[];     // layers from top to bottom
  baseSoil: BaseSoil;
  water: WaterTable;
  loads: WallLoads;
  theory: EarthPressureTheory;
  safetyFactors: {
    overturning: number;       // min FS (typ. 2.0)
    sliding: number;            // min FS (typ. 1.5)
    bearing: number;            // min FS (typ. 3.0 ultimate, 1.0 allowable check)
    eccentricity: 'kern' | 'B/3'; // e limit: kern (B/6) or middle third (B/3)
  };
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
  V: number;       // vertical force (kN/m of wall), positive = down
  H: number;       // horizontal force (kN/m), positive = drives wall AWAY from backfill
  x: number;       // lever arm from toe (mm, +forward)
  y: number;       // lever arm from footing base (mm, + up)
  Mo?: number;     // overturning moment about toe (kN·m/m), if applicable
  Mr?: number;     // resisting moment about toe (kN·m/m)
}

export interface StabilityResult {
  resultants: ForceResultant[];
  sumV: number;       // total vertical (kN/m)
  sumH: number;       // total horizontal driving (kN/m)
  Mr: number;         // resisting moment about toe (kN·m/m)
  Mo: number;         // overturning moment about toe (kN·m/m)
  FS_overturning: number;
  FS_sliding: number;
  slidingMu: number;  // friction coefficient used (tan δ)
  passiveResistance: number; // kN/m
  keyContribution: number;   // kN/m, extra passive from key if present
  // Bearing
  eccentricity: number;       // mm, measured from footing centerline (+ toward heel)
  kern: number;               // B/6 (mm)
  qMax: number;               // kPa, max bearing pressure at toe
  qMin: number;               // kPa, min (can be 0 if heel lifts)
  bearingUtilization: number; // qMax / qAllow
  B: number;                  // total footing width (mm)
  // Pass/fail flags
  overturningOk: boolean;
  slidingOk: boolean;
  bearingOk: boolean;
  eccentricityOk: boolean;
}

export interface CrackControl {
  /** ACI 318-19 §24.3.2 max spacing: s = 380(280/fs) - 2.5·cc ≤ 300(280/fs). */
  s_max: number;            // mm
  fs: number;               // service stress in reinforcement (MPa), = 2·fy/3
  /** Chosen bar diameter / area (display hint only). */
  bar: { id: string; area: number; diameter: number };
  /** Required spacing to provide As_req with the chosen bar (mm). */
  s_req: number;
  /** True if s_req ≤ s_max (crack control satisfied). */
  ok: boolean;
}

export interface StemDesignResult {
  /** Max moment at footing-top interface (kN·m/m). */
  Mu: number;
  /** Max shear at d from top of footing (kN/m). */
  Vu: number;
  /** Required As at stem base per meter (mm²/m). */
  As_req: number;
  As_min: number;     // ACI 318 min temp/shrinkage
  Vc: number;         // concrete shear capacity (kN/m)
  shearOk: boolean;   // true if Vu ≤ φVc (no stirrups)
  /** effective depth d used (mm) */
  d: number;
  /** depth of stress block a (mm) */
  a: number;
  rho: number;        // reinforcement ratio
  phiMn: number;      // provided design capacity if As_req is used (kN·m/m)
  crack: CrackControl;
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
  enabled: boolean;           // true if key is modeled in geometry
  /** Horizontal passive force on key face (kN/m). */
  Hp_key: number;
  /** Factored moment at the base of the footing where the key springs from (kN·m/m). */
  Mu: number;
  /** Factored shear at the same section (kN/m). */
  Vu: number;
  d: number;                  // effective depth into key (mm)
  a: number;                  // Whitney block depth
  As_req: number;             // mm²/m
  As_min: number;
  Vc: number;                 // kN/m concrete shear capacity
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
  issues: string[];       // non-fatal warnings (low eccentricity, thin cover, etc.)
  errors: string[];       // fatal: FS < min, bearing exceeds, etc.
}
