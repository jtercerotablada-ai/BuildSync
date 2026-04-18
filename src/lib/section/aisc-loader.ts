import { toSI } from '../beam/units';
import database from './aisc-database.json';
import type { SectionProperties, Point2D } from './types';

export interface AISCEntry {
  designation: string;
  family: string;
  weight: number; // lb/ft
  A: number;
  d: number;
  bf: number;
  tf: number;
  tw: number;
  Ix: number;
  Sx: number;
  Zx: number;
  rx: number;
  Iy: number;
  Sy: number;
  Zy: number;
  ry: number;
  J: number;
  Cw?: number;
}

export type AISCFamily = 'W' | 'C' | 'L' | 'HSS-R' | 'HSS-C' | 'Pipe' | 'WT' | 'S';

export const AISC_FAMILIES: Array<{ id: AISCFamily; label: string; description: string }> = [
  { id: 'W', label: 'W — Wide Flange', description: 'I-shaped wide-flange beams' },
  { id: 'S', label: 'S — Standard I', description: 'American standard I-beam (tapered flanges)' },
  { id: 'C', label: 'C — Channel', description: 'C-shaped channels' },
  { id: 'L', label: 'L — Angle', description: 'Equal and unequal leg angles' },
  { id: 'WT', label: 'WT — Tee', description: 'Structural tees cut from W shapes' },
  { id: 'HSS-R', label: 'HSS Rect — Tube', description: 'Rectangular and square hollow structural sections' },
  { id: 'HSS-C', label: 'HSS Round', description: 'Round hollow structural sections' },
  { id: 'Pipe', label: 'Pipe', description: 'Standard-weight pipe' },
];

const entries: AISCEntry[] = database.shapes as AISCEntry[];

export function getAllAISC(): AISCEntry[] {
  return entries;
}

export function getAISCFamilies(): AISCFamily[] {
  return Array.from(new Set(entries.map((e) => e.family))) as AISCFamily[];
}

export function searchAISC(query: string, family?: AISCFamily, limit = 25): AISCEntry[] {
  const q = query.trim().toUpperCase().replace(/\s+/g, '');
  const filtered = family ? entries.filter((e) => e.family === family) : entries;
  if (!q) return filtered.slice(0, limit);
  const scored = filtered.map((e) => {
    const des = e.designation.toUpperCase().replace(/\s+/g, '');
    if (des === q) return { e, rank: 0 };
    if (des.startsWith(q)) return { e, rank: 1 };
    if (des.includes(q)) return { e, rank: 2 };
    return { e, rank: 99 };
  });
  return scored
    .filter((s) => s.rank < 99)
    .sort((a, b) => a.rank - b.rank)
    .slice(0, limit)
    .map((s) => s.e);
}

export function findAISC(designation: string): AISCEntry | null {
  const q = designation.trim().toUpperCase().replace(/\s+/g, '');
  return entries.find((e) => e.designation.toUpperCase().replace(/\s+/g, '') === q) ?? null;
}

// Convert an AISC imperial entry to SectionProperties in SI (mm, mm², mm³, mm⁴).
export function aiscToSectionProperties(e: AISCEntry): SectionProperties {
  const A = toSI(e.A, 'A', 'imperial');
  const Ix = toSI(e.Ix, 'I', 'imperial');
  const Iy = toSI(e.Iy, 'I', 'imperial');
  const Sx = toSI(e.Sx, 'sectionModulus', 'imperial');
  const Sy = toSI(e.Sy, 'sectionModulus', 'imperial');
  const Zx = toSI(e.Zx, 'sectionModulus', 'imperial');
  const Zy = toSI(e.Zy, 'sectionModulus', 'imperial');
  const rx = toSI(e.rx, 'dimension', 'imperial');
  const ry = toSI(e.ry, 'dimension', 'imperial');
  const J = toSI(e.J, 'torsion', 'imperial');
  const Cw = e.Cw !== undefined ? toSI(e.Cw, 'warping', 'imperial') : 0;

  const d = toSI(e.d, 'dimension', 'imperial');
  const bf = toSI(e.bf, 'dimension', 'imperial');
  const tw = toSI(e.tw, 'dimension', 'imperial');
  const tf = toSI(e.tf, 'dimension', 'imperial');

  const outline = aiscOutline(e.family, { d, bf, tw, tf });
  const perimeter = polylinePerimeter(outline);

  // xbar / ybar are shape-specific (centered for W/HSS/Pipe/S, asymmetric for C/L/WT).
  // For simplicity, store bounding-box center as the origin; canvas scales to fit.
  const xs = outline.map((p) => p.x);
  const ys = outline.map((p) => p.y);
  const xMin = Math.min(...xs);
  const xMax = Math.max(...xs);
  const yMin = Math.min(...ys);
  const yMax = Math.max(...ys);

  const xbar = (xMin + xMax) / 2;
  const ybar = (yMin + yMax) / 2;

  return {
    A,
    perimeter,
    xbar,
    ybar,
    xMin,
    xMax,
    yMin,
    yMax,
    Ix,
    Iy,
    Ixy: 0,
    Sx_top: Sx,
    Sx_bot: Sx,
    Sy_left: Sy,
    Sy_right: Sy,
    Zx,
    Zy,
    I1: Math.max(Ix, Iy),
    I2: Math.min(Ix, Iy),
    alpha: 0,
    rx,
    ry,
    r1: Math.max(rx, ry),
    r2: Math.min(rx, ry),
    J,
    Cw,
    outline,
    holes: [],
  };
}

// Simplified outline for visualization — sharp corners, approximate profile.
// Not used for property math (DB values are authoritative).
function aiscOutline(
  family: string,
  d: { d: number; bf: number; tw: number; tf: number }
): Point2D[] {
  const { d: H, bf: B, tw, tf } = d;
  switch (family) {
    case 'W':
    case 'S':
      return iOutline(H, B, tw, tf);
    case 'WT':
      return tOutline(H, B, tw, tf);
    case 'C':
      return channelOutline(H, B, tw, tf);
    case 'L':
      return angleOutline(H, B, tw);
    case 'HSS-R':
      return hollowRectOutline(B, H, tw);
    case 'HSS-C':
    case 'Pipe':
      return circleOutline(H / 2);
    default:
      return [];
  }
}

function iOutline(H: number, B: number, tw: number, tf: number): Point2D[] {
  const halfB = B / 2;
  const halfW = tw / 2;
  const topInner = H / 2 - tf;
  const botInner = -H / 2 + tf;
  return [
    { x: -halfB, y: -H / 2 },
    { x: halfB, y: -H / 2 },
    { x: halfB, y: botInner },
    { x: halfW, y: botInner },
    { x: halfW, y: topInner },
    { x: halfB, y: topInner },
    { x: halfB, y: H / 2 },
    { x: -halfB, y: H / 2 },
    { x: -halfB, y: topInner },
    { x: -halfW, y: topInner },
    { x: -halfW, y: botInner },
    { x: -halfB, y: botInner },
  ];
}

function tOutline(H: number, B: number, tw: number, tf: number): Point2D[] {
  const halfB = B / 2;
  const halfW = tw / 2;
  const flangeBot = H - tf;
  return [
    { x: -halfW, y: 0 },
    { x: halfW, y: 0 },
    { x: halfW, y: flangeBot },
    { x: halfB, y: flangeBot },
    { x: halfB, y: H },
    { x: -halfB, y: H },
    { x: -halfB, y: flangeBot },
    { x: -halfW, y: flangeBot },
  ];
}

function channelOutline(H: number, B: number, tw: number, tf: number): Point2D[] {
  return [
    { x: 0, y: 0 },
    { x: B, y: 0 },
    { x: B, y: tf },
    { x: tw, y: tf },
    { x: tw, y: H - tf },
    { x: B, y: H - tf },
    { x: B, y: H },
    { x: 0, y: H },
  ];
}

function angleOutline(H: number, B: number, t: number): Point2D[] {
  return [
    { x: 0, y: 0 },
    { x: B, y: 0 },
    { x: B, y: t },
    { x: t, y: t },
    { x: t, y: H },
    { x: 0, y: H },
  ];
}

function hollowRectOutline(B: number, H: number, _t: number): Point2D[] {
  return [
    { x: -B / 2, y: -H / 2 },
    { x: B / 2, y: -H / 2 },
    { x: B / 2, y: H / 2 },
    { x: -B / 2, y: H / 2 },
  ];
}

function circleOutline(r: number): Point2D[] {
  const out: Point2D[] = [];
  const N = 64;
  for (let i = 0; i < N; i++) {
    const a = (i / N) * 2 * Math.PI;
    out.push({ x: r * Math.cos(a), y: r * Math.sin(a) });
  }
  return out;
}

function polylinePerimeter(pts: Point2D[]): number {
  let p = 0;
  for (let i = 0; i < pts.length; i++) {
    const a = pts[i];
    const b = pts[(i + 1) % pts.length];
    p += Math.hypot(b.x - a.x, b.y - a.y);
  }
  return p;
}
