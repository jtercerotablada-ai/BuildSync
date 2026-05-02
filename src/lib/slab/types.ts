// Slab Design — types
// Sign / unit convention:
//   length L_x, L_y         m
//   thickness h, cover c    mm
//   f'c, fy                 MPa
//   loads w, DL, LL         kN/m²
//   moments M               kN·m / m  (per unit width of slab)
//   shears V                kN / m
//   reinforcement As        mm²/m
//   bar size                metric (#10, #12, #16…) or imperial (#3-#11)
//   deflection δ            mm

export type Code = 'ACI 318-19' | 'EN 1992-1-1';
export type SystemUnits = 'SI';                   // (US to be added later)

export type EdgeCondition = 'free' | 'simple' | 'fixed';
export interface PanelEdges {
  /** Edge along x = 0  (left, length = L_y) */
  left: EdgeCondition;
  /** Edge along x = L_x (right, length = L_y) */
  right: EdgeCondition;
  /** Edge along y = 0  (bottom, length = L_x) */
  bottom: EdgeCondition;
  /** Edge along y = L_y (top, length = L_x) */
  top: EdgeCondition;
}

export type ConcreteGrade =
  | 'fc-21'  | 'fc-25' | 'fc-28' | 'fc-30' | 'fc-35' | 'fc-40'
  | 'C20/25' | 'C25/30' | 'C30/37' | 'C35/45' | 'C40/50'
  | 'custom';

export type RebarGrade =
  | 'Gr60'   // 420 MPa (ASTM A615 Gr 60)
  | 'Gr80'   // 550 MPa
  | 'B500A' | 'B500B' | 'B500C'   // 500 MPa, EN 10080
  | 'custom';

export interface Materials {
  /** Concrete compressive strength (MPa). */
  fc: number;
  /** Modulus of rupture (MPa). Defaults to 0.62·√f'c (ACI) when missing. */
  fr?: number;
  /** Concrete unit weight (kN/m³). Default 24. */
  gammaC?: number;
  /** Reinforcement yield strength (MPa). */
  fy: number;
  /** Reinforcement Young's modulus (MPa). Default 200 000. */
  Es?: number;
  /** Concrete grade preset (auto-fills fc). */
  concreteGrade?: ConcreteGrade;
  /** Reinforcement grade preset (auto-fills fy). */
  rebarGrade?: RebarGrade;
}

export interface Geometry {
  /** Clear span in x-direction (m). */
  Lx: number;
  /** Clear span in y-direction (m). */
  Ly: number;
  /** Slab thickness (mm). */
  h: number;
  /** Concrete cover to centroid of x-direction bottom bars (mm). Default 25. */
  cover_bottom_x?: number;
  /** Concrete cover to centroid of y-direction bottom bars (mm). Default 35. */
  cover_bottom_y?: number;
  /** Concrete cover to centroid of x-direction top bars (mm). Default 25. */
  cover_top_x?: number;
  /** Concrete cover to centroid of y-direction top bars (mm). Default 35. */
  cover_top_y?: number;
}

export interface Loads {
  /** Superimposed dead load excluding self-weight (kN/m²). */
  DL_super: number;
  /** Live load (kN/m²). */
  LL: number;
  /** Self-weight DL — auto-computed = γ_c · h. Stored for transparency. */
  DL_self?: number;
  /** Optional load factors — when missing, use code defaults. */
  factor_DL?: number;
  factor_LL?: number;
}

export type ColumnPosition = 'interior' | 'edge' | 'corner';
export interface PunchingInput {
  /** Square column side (mm). For rectangular columns, use the longer side as c1. */
  c1: number;
  /** Other column side (mm). Defaults to c1. */
  c2?: number;
  /** Position relative to slab. Affects critical perimeter and eccentric shear. */
  position: ColumnPosition;
  /** Factored axial column load Vu transferred to slab (kN). */
  Vu: number;
  /** Effective slab depth d (mm). If missing, computed from h, cover, and bar size. */
  d?: number;
  /** Optional unbalanced moment (kN·m) — increases eccentric shear. */
  Mu?: number;
}

export interface SlabInput {
  code: Code;
  units: SystemUnits;
  geometry: Geometry;
  edges: PanelEdges;
  materials: Materials;
  loads: Loads;
  punching?: PunchingInput;
}

// ---------------------------------------------------------------------------
// Output types
// ---------------------------------------------------------------------------

export interface MomentSet {
  /** Positive (sagging) midspan moment in x-direction (kN·m / m). */
  Mx_pos: number;
  /** Positive midspan moment in y-direction. */
  My_pos: number;
  /** Negative moment at continuous edge in x-direction (≤ 0). */
  Mx_neg: number;
  /** Negative moment at continuous edge in y-direction (≤ 0). */
  My_neg: number;
  /** Maximum factored shear V at supports in x-direction (kN / m). */
  Vx: number;
  /** Maximum factored shear V at supports in y-direction. */
  Vy: number;
}

export interface ReinforcementResult {
  location: 'mid-x' | 'mid-y' | 'sup-x' | 'sup-y';
  /** Design factored moment (kN·m / m). */
  Mu: number;
  /** Effective depth d at this location (mm). */
  d: number;
  /** Required area of steel (mm²/m). */
  As_req: number;
  /** Minimum As per code (mm²/m). */
  As_min: number;
  /** Final design As = max(As_req, As_min) (mm²/m). */
  As_design: number;
  /** Suggested bar size (e.g. "#5", "ϕ12"). */
  bar: string;
  /** Required spacing for the chosen bar (mm). */
  spacing: number;
  /** Maximum allowed spacing per code (mm). */
  spacing_max: number;
  /** Code reference clause. */
  ref: string;
}

export interface DeflectionResult {
  /** Minimum thickness check h_min (mm) per code Table. */
  h_min: number;
  /** Whether h ≥ h_min. */
  h_min_ok: boolean;
  /** Span-to-depth ratio limit per code (Eurocode §7.4.2). */
  spanDepthLimit?: number;
  /** Actual L/d ratio. */
  spanDepth?: number;
  /** Span/depth check OK. */
  spanDepthOk?: boolean;
  /** Branson effective moment of inertia (mm⁴/m). */
  Ie?: number;
  /** Immediate deflection under service load (mm). */
  delta_immediate?: number;
  /** Long-term deflection multiplier (per ACI 318-19 §24.2.4.1.1). */
  longTermFactor?: number;
  /** Long-term deflection (mm). */
  delta_longterm?: number;
  /** Code limit (mm). */
  delta_limit: number;
  /** Whether delta ≤ limit. */
  delta_ok?: boolean;
}

export interface PunchingResult {
  /** Critical perimeter b_o (mm) at d/2 from column face. */
  bo: number;
  /** Effective depth d (mm). */
  d: number;
  /** Concrete shear strength v_c (MPa). */
  vc: number;
  /** Required factored shear stress v_u (MPa). */
  vu: number;
  /** Demand-to-capacity ratio v_u / (φ·v_c). */
  ratio: number;
  /** Whether v_u ≤ φ·v_c. */
  ok: boolean;
  /** Code reference. */
  ref: string;
  /** Whether shear reinforcement is needed (ratio > 1). */
  needsReinf: boolean;
}

export interface CrackControlResult {
  /** Service stress in steel f_s (MPa). */
  fs: number;
  /** Maximum allowed bar spacing per code (mm). */
  s_max: number;
  /** Actual proposed spacing (mm). */
  s: number;
  ok: boolean;
  ref: string;
}

export interface SlabAnalysis {
  /** Echo of inputs (after defaulting). */
  geometry: Geometry;
  materials: Materials;
  loads: Loads;
  edges: PanelEdges;
  code: Code;
  /** L_y / L_x (≥ 1.0 by convention). */
  beta: number;
  /** Slab classification: one-way (β > 2) or two-way. */
  classification: 'one-way' | 'two-way';
  /** ACI Method 3 case number used (1–9), or null if one-way. */
  case?: number;
  /** Total factored uniform load (kN/m²). */
  wu: number;
  /** Self-weight (kN/m²). */
  wSelf: number;
  /** Service load for SLS deflection (kN/m²). */
  wService: number;
  /** Moments per unit width. */
  moments: MomentSet;
  /** Reinforcement design at the four critical locations. */
  reinforcement: ReinforcementResult[];
  /** Deflection check. */
  deflection: DeflectionResult;
  /** Punching shear (only if punching input provided). */
  punching?: PunchingResult;
  /** Crack-control checks for midspan (positive M). */
  crackControl?: CrackControlResult;
  /** Warnings, code limit notes, etc. */
  warnings: string[];
  /** Solved successfully. */
  solved: boolean;
}

// ---------------------------------------------------------------------------
// Bar catalog — used by reinforcement chooser
// ---------------------------------------------------------------------------
export interface Bar {
  /** Display label (e.g. "#5", "ϕ12"). */
  label: string;
  /** Bar diameter (mm). */
  db: number;
  /** Cross-section area (mm²). */
  Ab: number;
  /** Region. */
  system: 'imperial' | 'metric';
}

export const BAR_CATALOG: Bar[] = [
  // ASTM A615 imperial
  { label: '#3',  db:  9.5,  Ab:   71, system: 'imperial' },
  { label: '#4',  db: 12.7,  Ab:  129, system: 'imperial' },
  { label: '#5',  db: 15.9,  Ab:  199, system: 'imperial' },
  { label: '#6',  db: 19.1,  Ab:  284, system: 'imperial' },
  { label: '#7',  db: 22.2,  Ab:  387, system: 'imperial' },
  { label: '#8',  db: 25.4,  Ab:  510, system: 'imperial' },
  { label: '#9',  db: 28.7,  Ab:  645, system: 'imperial' },
  { label: '#10', db: 32.3,  Ab:  819, system: 'imperial' },
  { label: '#11', db: 35.8,  Ab: 1006, system: 'imperial' },
  // EN metric
  { label: 'ϕ8',  db:  8,    Ab:   50, system: 'metric'   },
  { label: 'ϕ10', db: 10,    Ab:   79, system: 'metric'   },
  { label: 'ϕ12', db: 12,    Ab:  113, system: 'metric'   },
  { label: 'ϕ16', db: 16,    Ab:  201, system: 'metric'   },
  { label: 'ϕ20', db: 20,    Ab:  314, system: 'metric'   },
  { label: 'ϕ25', db: 25,    Ab:  491, system: 'metric'   },
  { label: 'ϕ32', db: 32,    Ab:  804, system: 'metric'   },
];

// ---------------------------------------------------------------------------
// Material presets
// ---------------------------------------------------------------------------
export const CONCRETE_PRESETS: Record<Exclude<ConcreteGrade, 'custom'>, { label: string; fc: number }> = {
  'fc-21':  { label: "f'c = 21 MPa (3000 psi)", fc: 21 },
  'fc-25':  { label: "f'c = 25 MPa", fc: 25 },
  'fc-28':  { label: "f'c = 28 MPa (4000 psi)", fc: 28 },
  'fc-30':  { label: "f'c = 30 MPa", fc: 30 },
  'fc-35':  { label: "f'c = 35 MPa (5000 psi)", fc: 35 },
  'fc-40':  { label: "f'c = 40 MPa", fc: 40 },
  'C20/25': { label: 'EN C20/25 — fck=20, fcm=28', fc: 20 },
  'C25/30': { label: 'EN C25/30 — fck=25, fcm=33', fc: 25 },
  'C30/37': { label: 'EN C30/37 — fck=30, fcm=38', fc: 30 },
  'C35/45': { label: 'EN C35/45 — fck=35, fcm=43', fc: 35 },
  'C40/50': { label: 'EN C40/50 — fck=40, fcm=48', fc: 40 },
};

export const REBAR_PRESETS: Record<Exclude<RebarGrade, 'custom'>, { label: string; fy: number }> = {
  'Gr60':  { label: 'ASTM A615 Gr 60 — fy=420 MPa', fy: 420 },
  'Gr80':  { label: 'ASTM A615 Gr 80 — fy=550 MPa', fy: 550 },
  'B500A': { label: 'EN 10080 B500A — fyk=500 MPa', fy: 500 },
  'B500B': { label: 'EN 10080 B500B — fyk=500 MPa', fy: 500 },
  'B500C': { label: 'EN 10080 B500C — fyk=500 MPa', fy: 500 },
};
