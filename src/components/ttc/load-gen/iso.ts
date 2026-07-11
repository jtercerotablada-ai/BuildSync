// Shared 30° axonometric (isometric) projection helpers for the Load
// Generator 3D building diagrams.  Model axes: +x → screen down-right,
// +y → screen down-left (depth), +z → screen up.  Visible faces of a box
// [0,l]×[0,b]×[0,h] are therefore: top (z=h), near-right (x=l) and
// near-left (y=b); the three edges meeting at (0,0,0) are hidden.

export const C30 = 0.8660254;
export const S30 = 0.5;

export const INK = '#221e17';
export const GOLD = '#c9a84c';
export const GOLD_DEEP = '#9a7a2c';
export const LINE = '#cfc7b6';
export const MUTE = '#8a8272';

export interface XY { X: number; Y: number }

/** Build a projector for a given screen origin + scale. */
export function makeIso(ox: number, oy: number, s: number) {
  return (x: number, y: number, z: number): XY => ({
    X: ox + (x - y) * C30 * s,
    Y: oy + (x + y) * S30 * s - z * s,
  });
}

/**
 * Fit an l×b×h box into an available area and return {s, ox, oy} so the
 * projected bounding box starts at (padL, padT).
 */
export function fitIso(l: number, b: number, h: number, availW: number, availH: number, padL: number, padT: number) {
  const s = Math.min(availW / ((l + b) * C30), availH / ((l + b) * S30 + h));
  return { s, ox: padL + b * C30 * s, oy: padT + h * s };
}

export const poly = (ps: XY[]) => ps.map((p) => `${p.X.toFixed(1)},${p.Y.toFixed(1)}`).join(' ');

/** Sleek dart arrowhead path for load arrows (marker 10.5×7.5, refX 9.3, refY 3.5). */
export const DART = 'M0,0 L9.5,3.5 L0,7 L2.6,3.5 Z';
