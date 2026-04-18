import type { Point2D, SectionProperties } from './types';

// Computes section properties for an arbitrary simple polygon via Green's theorem.
// Vertices may be given in either orientation; signed area determines direction.
export function computePolygon(vertices: Point2D[]): SectionProperties {
  const n = vertices.length;
  if (n < 3) return empty();

  // Shoelace area (signed).
  let A2 = 0;
  let sumX = 0;
  let sumY = 0;
  for (let i = 0; i < n; i++) {
    const p = vertices[i];
    const q = vertices[(i + 1) % n];
    const cross = p.x * q.y - q.x * p.y;
    A2 += cross;
    sumX += (p.x + q.x) * cross;
    sumY += (p.y + q.y) * cross;
  }
  const signedA = A2 / 2;
  const A = Math.abs(signedA);
  if (A < 1e-12) return empty();

  const xbar = sumX / (6 * signedA);
  const ybar = sumY / (6 * signedA);

  // Second moments about the origin, then translate to centroid via parallel-axis.
  let Ixx0 = 0;
  let Iyy0 = 0;
  let Ixy0 = 0;
  for (let i = 0; i < n; i++) {
    const p = vertices[i];
    const q = vertices[(i + 1) % n];
    const cross = p.x * q.y - q.x * p.y;
    Iyy0 += (p.x * p.x + p.x * q.x + q.x * q.x) * cross;
    Ixx0 += (p.y * p.y + p.y * q.y + q.y * q.y) * cross;
    Ixy0 += (p.x * q.y + 2 * p.x * p.y + 2 * q.x * q.y + q.x * p.y) * cross;
  }
  Ixx0 /= 12;
  Iyy0 /= 12;
  Ixy0 /= 24;
  // Signed area can flip sign of these integrals — take absolute to correspond to magnitude about origin.
  Ixx0 = Math.abs(Ixx0);
  Iyy0 = Math.abs(Iyy0);
  Ixy0 = signedA >= 0 ? Ixy0 : -Ixy0;

  // Parallel-axis shift to centroid.
  const Ix = Ixx0 - A * ybar * ybar;
  const Iy = Iyy0 - A * xbar * xbar;
  const Ixy = Ixy0 - A * xbar * ybar;

  const xs = vertices.map((v) => v.x);
  const ys = vertices.map((v) => v.y);
  const xMin = Math.min(...xs);
  const xMax = Math.max(...xs);
  const yMin = Math.min(...ys);
  const yMax = Math.max(...ys);

  const Sx_top = Ix / Math.max(yMax - ybar, 1e-12);
  const Sx_bot = Ix / Math.max(ybar - yMin, 1e-12);
  const Sy_left = Iy / Math.max(xbar - xMin, 1e-12);
  const Sy_right = Iy / Math.max(xMax - xbar, 1e-12);

  const Zx = polygonPlasticModulus(vertices, A, 'x', ybar, yMin, yMax);
  const Zy = polygonPlasticModulus(vertices, A, 'y', xbar, xMin, xMax);

  const avg = (Ix + Iy) / 2;
  const diff = (Ix - Iy) / 2;
  const rad = Math.sqrt(diff * diff + Ixy * Ixy);
  const I1 = avg + rad;
  const I2 = avg - rad;
  const alpha = Math.abs(Ixy) < 1e-12 && Math.abs(diff) < 1e-12 ? 0 : 0.5 * Math.atan2(-2 * Ixy, Ix - Iy);

  const rx = Math.sqrt(Ix / A);
  const ry = Math.sqrt(Iy / A);
  const r1 = Math.sqrt(I1 / A);
  const r2 = Math.sqrt(I2 / A);

  // Q_x max: first moment of area above neutral axis y=ybar via polygon clipping.
  const aboveNA = clipHalfplane(vertices, ybar, 'x', 'above');
  const Qx_max = firstMoment(aboveNA, ybar, 'x');

  // Ensure CCW orientation in output outline (for consistent rendering).
  const outline = signedA >= 0 ? vertices.slice() : vertices.slice().reverse();

  return {
    A,
    perimeter: polygonPerimeter(vertices),
    xbar,
    ybar,
    xMin,
    xMax,
    yMin,
    yMax,
    Ix,
    Iy,
    Ixy,
    Sx_top,
    Sx_bot,
    Sy_left,
    Sy_right,
    Zx,
    Zy,
    I1,
    I2,
    alpha,
    rx,
    ry,
    r1,
    r2,
    J: 0, // polygon torsion constant is complicated; leave 0 for now
    Cw: 0,
    Qx_max,
    shearCenterX: xbar,
    shearCenterY: ybar,
    outline,
    holes: [],
  };
}

// Numerically bisect the PNA and compute plastic modulus for an arbitrary polygon.
// axis='x' means PNA is a horizontal line at y=pna (splits area top/bottom).
// axis='y' means PNA is vertical line at x=pna (splits area left/right).
function polygonPlasticModulus(
  vertices: Point2D[],
  A: number,
  axis: 'x' | 'y',
  centroid: number,
  vMin: number,
  vMax: number
): number {
  const areaBelow = (cut: number) => polygonAreaBelow(vertices, cut, axis);

  let lo = vMin;
  let hi = vMax;
  for (let i = 0; i < 60; i++) {
    const mid = (lo + hi) / 2;
    if (areaBelow(mid) < A / 2) lo = mid;
    else hi = mid;
  }
  const pna = (lo + hi) / 2;

  // First moment of the polygon about the PNA, computed as Σ|v - pna|·dA.
  return polygonFirstMomentAbs(vertices, pna, axis);
}

// Area of polygon below the horizontal line y=cut (or left of vertical line x=cut).
function polygonAreaBelow(vertices: Point2D[], cut: number, axis: 'x' | 'y'): number {
  // Clip polygon by the halfplane {v ≤ cut}, return clipped area.
  const clipped = clipHalfplane(vertices, cut, axis, 'below');
  return Math.abs(signedArea(clipped));
}

// First moment (absolute) about the cut line: ∫ |v - cut| dA  over polygon.
function polygonFirstMomentAbs(vertices: Point2D[], cut: number, axis: 'x' | 'y'): number {
  const below = clipHalfplane(vertices, cut, axis, 'below');
  const above = clipHalfplane(vertices, cut, axis, 'above');
  return firstMoment(below, cut, axis) + firstMoment(above, cut, axis);
}

// |first moment of polygon about cut| where the polygon lies entirely on one side of the cut.
function firstMoment(vertices: Point2D[], cut: number, axis: 'x' | 'y'): number {
  const n = vertices.length;
  if (n < 3) return 0;
  let signedA = 0;
  let sumV = 0;
  for (let i = 0; i < n; i++) {
    const p = vertices[i];
    const q = vertices[(i + 1) % n];
    const cross = p.x * q.y - q.x * p.y;
    signedA += cross;
    sumV += axis === 'x' ? (p.y + q.y) * cross : (p.x + q.x) * cross;
  }
  const A = Math.abs(signedA / 2);
  if (A < 1e-12) return 0;
  const centroid = sumV / (3 * signedA);
  return A * Math.abs(centroid - cut);
}

function clipHalfplane(
  vertices: Point2D[],
  cut: number,
  axis: 'x' | 'y',
  side: 'below' | 'above'
): Point2D[] {
  // Sutherland-Hodgman clipping against a single axis-aligned line.
  const value = (v: Point2D) => (axis === 'x' ? v.y : v.x);
  const inside = (v: Point2D) => (side === 'below' ? value(v) <= cut : value(v) >= cut);
  const out: Point2D[] = [];
  const n = vertices.length;
  if (n === 0) return out;

  for (let i = 0; i < n; i++) {
    const cur = vertices[i];
    const prev = vertices[(i + n - 1) % n];
    const curIn = inside(cur);
    const prevIn = inside(prev);
    if (curIn) {
      if (!prevIn) out.push(intersect(prev, cur, cut, axis));
      out.push(cur);
    } else if (prevIn) {
      out.push(intersect(prev, cur, cut, axis));
    }
  }
  return out;
}

function intersect(p: Point2D, q: Point2D, cut: number, axis: 'x' | 'y'): Point2D {
  if (axis === 'x') {
    const t = (cut - p.y) / (q.y - p.y);
    return { x: p.x + t * (q.x - p.x), y: cut };
  }
  const t = (cut - p.x) / (q.x - p.x);
  return { x: cut, y: p.y + t * (q.y - p.y) };
}

function signedArea(vertices: Point2D[]): number {
  let a = 0;
  for (let i = 0; i < vertices.length; i++) {
    const p = vertices[i];
    const q = vertices[(i + 1) % vertices.length];
    a += p.x * q.y - q.x * p.y;
  }
  return a / 2;
}

function polygonPerimeter(pts: Point2D[]): number {
  let p = 0;
  for (let i = 0; i < pts.length; i++) {
    const a = pts[i];
    const b = pts[(i + 1) % pts.length];
    p += Math.hypot(b.x - a.x, b.y - a.y);
  }
  return p;
}

function empty(): SectionProperties {
  return {
    A: 0,
    perimeter: 0,
    xbar: 0,
    ybar: 0,
    xMin: 0,
    xMax: 0,
    yMin: 0,
    yMax: 0,
    Ix: 0,
    Iy: 0,
    Ixy: 0,
    Sx_top: 0,
    Sx_bot: 0,
    Sy_left: 0,
    Sy_right: 0,
    Zx: 0,
    Zy: 0,
    I1: 0,
    I2: 0,
    alpha: 0,
    rx: 0,
    ry: 0,
    r1: 0,
    r2: 0,
    J: 0,
    Cw: 0,
    Qx_max: 0,
    shearCenterX: 0,
    shearCenterY: 0,
    outline: [],
    holes: [],
  };
}
