import type { MaterialPreset } from '../beam/types';

export type ShapeKind =
  | 'rectangular'
  | 'hollow-rect'
  | 'circular'
  | 'hollow-circ'
  | 'i-shape'
  | 't-shape'
  | 'angle'
  | 'channel'
  | 'box-girder';

export type TemplateParams =
  | { kind: 'rectangular'; b: number; h: number }
  | { kind: 'hollow-rect'; B: number; H: number; tw: number; tf: number }
  | { kind: 'circular'; D: number }
  | { kind: 'hollow-circ'; D: number; d: number }
  | { kind: 'i-shape'; H: number; B: number; tw: number; tf: number }
  | { kind: 't-shape'; H: number; B: number; tw: number; tf: number }
  | { kind: 'angle'; H: number; B: number; t: number }
  | { kind: 'channel'; H: number; B: number; tw: number; tf: number }
  | { kind: 'box-girder'; B: number; H: number; tw: number; tf: number };

export interface PolygonParams {
  vertices: Array<{ x: number; y: number }>;
}

export interface DatabaseSectionRef {
  designation: string;
  family: string;
}

export type SectionSource =
  | { type: 'template'; params: TemplateParams }
  | { type: 'database'; ref: DatabaseSectionRef }
  | { type: 'polygon'; params: PolygonParams };

export interface Point2D {
  x: number;
  y: number;
}

export interface SectionProperties {
  // Geometric (all in SI: mm, mm², mm³, mm⁴)
  A: number;
  perimeter: number;
  xbar: number;
  ybar: number;

  // Bounding box of the outline (in natural shape coords, origin at bottom-left of bbox)
  xMin: number;
  xMax: number;
  yMin: number;
  yMax: number;

  // Centroidal moments of inertia
  Ix: number;
  Iy: number;
  Ixy: number;

  // Section moduli (elastic)
  Sx_top: number;
  Sx_bot: number;
  Sy_left: number;
  Sy_right: number;

  // Plastic section moduli
  Zx: number;
  Zy: number;

  // Principal axes
  I1: number;
  I2: number;
  alpha: number;

  // Radii of gyration
  rx: number;
  ry: number;
  r1: number;
  r2: number;

  // Torsion
  J: number;
  Cw: number;

  // Outline polyline (CCW, in natural coords)
  outline: Point2D[];

  // Hole outlines (for hollow shapes — CW direction, subtracted for heatmap)
  holes: Point2D[][];
}

export interface SavedSection {
  id: string;
  name: string;
  material: MaterialPreset;
  source: SectionSource;
  props: SectionProperties;
  createdAt: number;
}

export interface PendingBeamSection {
  material: MaterialPreset;
  E: number;
  I: number;
  A: number;
  label: string;
}
