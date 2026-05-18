// Advanced Beam — types
// Sign convention (consistent across solver and UI):
//   Geometry:   x increases left-to-right (m)
//   Vertical:   v positive UP (m); θ positive counter-clockwise (rad)
//   Loads:      magnitudes are positive in the input; "direction" sets sign
//   Internal:   shear V positive when right-of-cut points DOWN
//               moment M positive when sagging (tension at bottom fiber)
//   Reactions:  V upward positive; M counter-clockwise applied by support on beam
//
// Units in the input model:
//   length     m
//   E          MPa (= N/mm²)
//   I          mm⁴
//   A          mm²
//   density    kg/m³
//   point load kN
//   moment     kN·m
//   distrib.   kN/m
//   k_v        kN/m            (translational spring stiffness)
//   k_r        kN·m/rad        (rotational spring stiffness)
//   settlement mm  (vertical, downward positive)
//   rotation   rad
//   ΔT         °C  (temperature change for thermal load)
//   α          1/°C
//   h          mm  (section depth, used for thermal-gradient curvature κ_T = α·ΔT_grad / h)

export type SupportType = 'fixed' | 'pin' | 'roller' | 'spring' | 'free';

export interface Support {
  id: string;
  position: number;
  type: SupportType;
  /** Translational stiffness for type='spring' (kN/m). Undefined or 0 → free vertically. */
  kv?: number;
  /** Rotational stiffness for type='spring' (kN·m/rad). Undefined or 0 → free in rotation. */
  kr?: number;
  /** Prescribed vertical settlement (mm, +ve downward). Applied as enforced displacement. */
  settlement?: number;
  /** Prescribed rotation (rad, +ve CCW). Only enforced where rotation DOF is constrained. */
  rotation?: number;
}

export interface Hinge {
  id: string;
  /** Internal moment release at this position. Solver duplicates the rotation DOF here. */
  position: number;
}

export type MaterialPreset =
  | 'steel-A36'
  | 'steel-A992'
  | 'concrete-25'
  | 'concrete-30'
  | 'concrete-35'
  | 'concrete-40'
  | 'aluminum-6061'
  | 'wood-dfir'
  | 'wood-spr'
  | 'custom';

export interface Segment {
  id: string;
  startPosition: number;
  endPosition: number;
  /** Young's modulus in MPa. */
  E: number;
  /** Second moment of area about bending axis in mm⁴. */
  I: number;
  /** Cross-section area in mm² (for self-weight). */
  A?: number;
  /** Self-weight on this segment. */
  selfWeight?: boolean;
  /** Density kg/m³ (default 7850 if missing and self-weight enabled). */
  density?: number;
  /** Coefficient of thermal expansion 1/°C (default 1.2e-5 for steel if missing). */
  alpha?: number;
  /** Section depth mm (used for thermal-gradient curvature). */
  h?: number;
  material?: MaterialPreset;
  label?: string;
}

export type LoadDirection = 'down' | 'up';
export type LoadCase = 'dead' | 'live' | 'wind' | 'snow' | 'seismic';

export interface PointLoad {
  id: string;
  type: 'point';
  position: number;
  magnitude: number;
  direction: LoadDirection;
  loadCase?: LoadCase;
}

export interface DistributedLoad {
  id: string;
  type: 'distributed';
  startPosition: number;
  endPosition: number;
  startMagnitude: number;
  endMagnitude: number;
  direction: LoadDirection;
  loadCase?: LoadCase;
}

export interface PointMoment {
  id: string;
  type: 'moment';
  position: number;
  magnitude: number;
  direction: 'cw' | 'ccw';
  loadCase?: LoadCase;
}

export interface ThermalLoad {
  id: string;
  type: 'thermal';
  segmentId: string;
  /** Top-bottom temperature difference (°C). +ve = top hotter than bottom → hogging curvature for typical orientation. */
  deltaTGradient: number;
  loadCase?: LoadCase;
}

export type Load = PointLoad | DistributedLoad | PointMoment | ThermalLoad;

export interface BeamModel {
  /** Total beam length in metres. Must equal max(segment.endPosition). */
  totalLength: number;
  segments: Segment[];
  supports: Support[];
  hinges: Hinge[];
  loads: Load[];
  /** Number of x-samples for diagrams (default 600 if missing). */
  samples?: number;
}

export interface Reaction {
  supportId: string;
  position: number;
  type: SupportType;
  /** Vertical reaction force (kN). Upward positive. */
  V: number;
  /** Moment reaction (kN·m). Sagging-positive (matches internal moment diagram). */
  M: number;
}

export interface DiagramPoint {
  x: number;
  value: number;
}

export interface Extremum {
  value: number;
  position: number;
}

export interface ModalResult {
  frequencyHz: number;
  omega: number;
  shape: DiagramPoint[];
}

export interface Results {
  reactions: Reaction[];
  shear: DiagramPoint[];
  moment: DiagramPoint[];
  slope: DiagramPoint[];
  deflection: DiagramPoint[];
  maxShear: Extremum;
  minShear: Extremum;
  maxMoment: Extremum;
  minMoment: Extremum;
  maxDeflection: Extremum;
  /** Optional first natural mode results when computeModes=true. */
  modes?: ModalResult[];
  warnings: string[];
  solved: boolean;
}

export interface SolveOptions {
  /** Compute first N natural bending modes. Default 0 (skipped). */
  computeModes?: number;
  /** Override sample count. */
  samples?: number;
}

export const MATERIAL_PRESETS: Record<
  Exclude<MaterialPreset, 'custom'>,
  { label: string; E: number; density: number; alpha: number }
> = {
  'steel-A36':       { label: 'Steel A36',          E: 200_000, density: 7850, alpha: 1.2e-5 },
  'steel-A992':      { label: 'Steel A992',         E: 200_000, density: 7850, alpha: 1.2e-5 },
  'concrete-25':     { label: "Concrete f'c=25 MPa", E: 23_500, density: 2400, alpha: 1.0e-5 },
  'concrete-30':     { label: "Concrete f'c=30 MPa", E: 25_700, density: 2400, alpha: 1.0e-5 },
  'concrete-35':     { label: "Concrete f'c=35 MPa", E: 27_800, density: 2400, alpha: 1.0e-5 },
  'concrete-40':     { label: "Concrete f'c=40 MPa", E: 29_700, density: 2400, alpha: 1.0e-5 },
  'aluminum-6061':   { label: 'Aluminum 6061-T6',   E: 69_000,  density: 2700, alpha: 2.3e-5 },
  'wood-dfir':       { label: 'Wood Douglas Fir',    E: 13_000,  density: 530,  alpha: 4.0e-6 },
  'wood-spr':        { label: 'Wood Spruce-Pine-Fir',E: 9_500,   density: 470,  alpha: 4.0e-6 },
};

export const LOAD_CASE_COLORS: Record<LoadCase, string> = {
  dead:    '#8b7355',
  live:    '#c9a84c',
  wind:    '#4a90c9',
  snow:    '#b0c4de',
  seismic: '#c94c4c',
};

export const LOAD_CASE_LABELS: Record<LoadCase, string> = {
  dead:    'Dead',
  live:    'Live',
  wind:    'Wind',
  snow:    'Snow',
  seismic: 'Seismic',
};
