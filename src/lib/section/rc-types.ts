// Reinforced-concrete (RC) analysis types.
//
// A layer is a horizontal row of rebar at a specific depth from the top
// compression fiber. In RC convention we use depth `d` measured downward from
// the top (compression fiber) to the centroid of the layer.
//
// All dimensions in mm, forces in N, stresses in MPa, moments in N·mm.

export type ConcreteShape =
  | { kind: 'rectangular'; b: number; h: number }
  | { kind: 't-beam'; bw: number; bf: number; hf: number; h: number }; // bw=web, bf=flange, hf=flange thickness

export interface RebarLayer {
  id: string;
  depth: number;     // d_i: distance from top fiber to layer centroid (mm)
  area: number;      // As_i: total area of bars in the layer (mm²)
  count: number;     // n bars (for display; doesn't affect math)
  label?: string;    // e.g. "4 #8" (optional UI hint)
}

export interface RcMaterials {
  fc: number;     // concrete compressive strength f'c (MPa)
  fy: number;     // steel yield strength (MPa)
  Es: number;     // steel Young's modulus (MPa, typically 200 000)
  Ec?: number;    // concrete Young's modulus (MPa). If omitted use ACI 318: Ec = 4700·√f'c
  fr?: number;    // modulus of rupture (MPa). If omitted use ACI 318: fr = 0.62·√f'c
  epsCU?: number; // ultimate concrete strain (default 0.003 per ACI 318)
  beta1?: number; // Whitney stress-block factor. If omitted computed from f'c per ACI 318
}

export interface RcParams {
  concrete: ConcreteShape;
  layers: RebarLayer[];
  materials: RcMaterials;
}

// ============ Results ============

export interface CrackedSectionResult {
  kd: number;         // neutral-axis depth from top fiber (mm)
  Icr: number;        // cracked transformed moment of inertia (mm⁴, in concrete units)
  n: number;          // modular ratio Es/Ec
  sigmaC_max: number; // max concrete compressive stress at top fiber (MPa)
  sigmaS: number[];   // steel stress at each layer (MPa), + tension / − compression
  valid: boolean;     // false if no tension steel crosses the section (cracked state undefined)
}

export interface FlexuralCapacityResult {
  Mn: number;         // nominal moment capacity (N·mm)
  phi: number;        // ACI 318 strength reduction factor (0.65 – 0.90)
  phiMn: number;      // design moment capacity (N·mm)
  a: number;          // Whitney block depth (mm)
  c: number;          // neutral-axis depth = a/β1 (mm)
  epsT: number;       // strain in the extreme tension steel (used for φ)
  tensionControlled: boolean; // εt ≥ 0.005 per ACI 318
  balanced: boolean;  // εt = εy at balance point
}

export interface MomentCurvaturePoint {
  phi: number;    // curvature (1/mm)
  M: number;      // moment (N·mm)
  c: number;      // neutral-axis depth (mm)
  epsC: number;   // concrete compressive strain at top
  epsSMax: number;// max steel tensile strain
}

export interface MomentCurvatureResult {
  points: MomentCurvaturePoint[];
  yieldPoint: MomentCurvaturePoint | null;    // when max tension steel first reaches εy
  ultimatePoint: MomentCurvaturePoint | null; // when εc reaches εCU (0.003)
  cracked: boolean; // whether cracking was detected in the curve
}

export interface InteractionPoint {
  P: number;  // axial load (N), compression +
  M: number;  // moment (N·mm)
  c: number;  // NA depth (mm); ∞ means pure compression, −∞ means pure tension
  phi: number; // ACI strength reduction
  phiP: number;
  phiM: number;
  epsT: number; // strain in extreme tension steel
  label?: 'pure-compression' | 'pure-flexion' | 'balance' | 'pure-tension' | undefined;
}

export interface InteractionResult {
  points: InteractionPoint[];      // sweep from pure-compression to pure-tension
  P0: number;                      // nominal pure-axial capacity (N)
  phiPmax: number;                 // max design axial = 0.80·φ·P0 (tied) per ACI
  balancePoint: InteractionPoint;  // where εt = εy
  pureFlexion: InteractionPoint;   // P = 0
  pureTension: number;             // As_total · fy (N, tension negative)
}

export interface RcResults {
  gross: {
    Ag: number;     // gross concrete area (mm²)
    Ig: number;     // gross moment of inertia (mm⁴)
    yt: number;     // distance from centroid to top fiber (mm)
    yb: number;     // distance from centroid to bottom fiber (mm)
    Mcr: number;    // cracking moment Mcr = fr · Ig / yt (N·mm)
  };
  cracked: CrackedSectionResult | null; // null when no tension steel
  flexural: FlexuralCapacityResult;      // Mn under pure flexion
  momentCurvature: MomentCurvatureResult;
  interaction: InteractionResult;
}
