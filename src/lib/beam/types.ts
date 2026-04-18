export type SupportType = 'pinned' | 'roller' | 'fixed';

export interface Support {
  id: string;
  type: SupportType;
  position: number;
}

export type LoadDirection = 'down' | 'up';
export type LoadCase = 'dead' | 'live' | 'wind' | 'snow' | 'seismic';

export interface PointLoad {
  id: string;
  type: 'point';
  position: number;
  magnitude: number;
  direction: LoadDirection;
  loadCase: LoadCase;
}

export interface DistributedLoad {
  id: string;
  type: 'distributed';
  startPosition: number;
  endPosition: number;
  startMagnitude: number;
  endMagnitude: number;
  direction: LoadDirection;
  loadCase: LoadCase;
}

export type Load = PointLoad | DistributedLoad;

export interface AppliedMoment {
  id: string;
  position: number;
  magnitude: number;
  direction: 'cw' | 'ccw';
}

export type MaterialPreset = 'steel' | 'concrete' | 'aluminum' | 'wood' | 'custom';

export interface Section {
  material: MaterialPreset;
  E: number;
  I: number;
  A?: number;
  label?: string;
}

export interface BeamModel {
  length: number;
  section: Section;
  supports: Support[];
  loads: Load[];
  moments: AppliedMoment[];
  selfWeight: boolean;
  density: number;
}

export interface Reaction {
  supportId: string;
  position: number;
  type: SupportType;
  V: number;
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
  warnings: string[];
  solved: boolean;
}

export const MATERIAL_PRESETS: Record<Exclude<MaterialPreset, 'custom'>, { label: string; E: number; density: number }> = {
  steel: { label: 'Steel (A36)', E: 200000, density: 7850 },
  concrete: { label: 'Concrete (f\'c=28 MPa)', E: 24870, density: 2400 },
  aluminum: { label: 'Aluminum (6061)', E: 69000, density: 2700 },
  wood: { label: 'Wood (Douglas Fir)', E: 13000, density: 500 },
};

export const LOAD_CASE_COLORS: Record<LoadCase, string> = {
  dead: '#8b7355',
  live: '#c9a84c',
  wind: '#4a90c9',
  snow: '#b0c4de',
  seismic: '#c94c4c',
};

export const LOAD_CASE_LABELS: Record<LoadCase, string> = {
  dead: 'Dead Load',
  live: 'Live Load',
  wind: 'Wind Load',
  snow: 'Snow Load',
  seismic: 'Seismic Load',
};
