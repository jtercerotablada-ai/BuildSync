import type { ConcreteShape, RcParams } from './rc-types';

// Helpers to query rectangular & T-beam concrete geometries.
//
// All coordinates are measured with y = 0 at the top compression fiber and
// increasing downward (so "depth d" in RC literature maps directly to y).

export function grossArea(shape: ConcreteShape): number {
  switch (shape.kind) {
    case 'rectangular':
      return shape.b * shape.h;
    case 't-beam':
      return shape.bf * shape.hf + shape.bw * (shape.h - shape.hf);
  }
}

export function totalHeight(shape: ConcreteShape): number {
  return shape.h;
}

// Width of the section at depth y (y=0 at top).
export function widthAt(shape: ConcreteShape, y: number): number {
  if (y < 0 || y > shape.h) return 0;
  switch (shape.kind) {
    case 'rectangular':
      return shape.b;
    case 't-beam':
      return y <= shape.hf ? shape.bf : shape.bw;
  }
}

// Distance from top fiber to the centroid of the gross section.
export function grossCentroidFromTop(shape: ConcreteShape): number {
  switch (shape.kind) {
    case 'rectangular':
      return shape.h / 2;
    case 't-beam': {
      const Af = shape.bf * shape.hf;
      const Aw = shape.bw * (shape.h - shape.hf);
      const yf = shape.hf / 2;
      const yw = shape.hf + (shape.h - shape.hf) / 2;
      return (Af * yf + Aw * yw) / (Af + Aw);
    }
  }
}

// Gross moment of inertia about the centroidal horizontal axis.
export function grossIx(shape: ConcreteShape): number {
  const ybar = grossCentroidFromTop(shape);
  switch (shape.kind) {
    case 'rectangular': {
      // Centroid at h/2 → same as b·h³/12 about its own centroid
      return (shape.b * shape.h ** 3) / 12;
    }
    case 't-beam': {
      const Af = shape.bf * shape.hf;
      const Aw = shape.bw * (shape.h - shape.hf);
      const yf = shape.hf / 2;
      const yw = shape.hf + (shape.h - shape.hf) / 2;
      const IfLocal = (shape.bf * shape.hf ** 3) / 12;
      const IwLocal = (shape.bw * (shape.h - shape.hf) ** 3) / 12;
      return (
        IfLocal + Af * (yf - ybar) ** 2 + IwLocal + Aw * (yw - ybar) ** 2
      );
    }
  }
}

// Compressed concrete area & first moment when neutral axis is at depth c
// from the top fiber (0 ≤ c ≤ h). For the strain-based M-φ analysis we also
// return the section modulus about y=0 (top fiber) so M can be computed from
// the parabolic stress distribution.
export interface CompressionZone {
  area: number;     // compressed concrete area (mm²)
  Qtop: number;     // first moment about top fiber, Σ w(y)·y·dy (mm³)
}

// Plastic centroid (measured from top fiber). This is the point at which a
// purely axial force acting on the fully-yielded section produces zero moment.
// Required for correct P-M interaction diagrams (ACI 318 convention: moments
// are taken about the plastic centroid so "pure compression" is at M=0).
//
// Net-force formulation matching rc-nonlinear.ts:
//   • Concrete: 0.85·f'c·Ag acting at the gross concrete centroid
//   • Each steel layer: (fy − 0.85·f'c)·As_i at depth d_i
//
// y_pc = [ 0.85·f'c·Ag·y_conc + Σ (fy − 0.85·f'c)·As_i·d_i ]
//        --------------------------------------------------------
//        [ 0.85·f'c·Ag       + Σ (fy − 0.85·f'c)·As_i       ]
export function plasticCentroidFromTop(params: RcParams, fc: number, fy: number): number {
  const { concrete, layers } = params;
  const Ag = grossArea(concrete);
  const yConc = grossCentroidFromTop(concrete);
  const Fc = 0.85 * fc * Ag;
  let sumF = Fc;
  let sumFy = Fc * yConc;
  for (const L of layers) {
    const Fs = (fy - 0.85 * fc) * L.area;
    sumF += Fs;
    sumFy += Fs * L.depth;
  }
  return sumF > 0 ? sumFy / sumF : yConc;
}

export function compressionZone(shape: ConcreteShape, c: number): CompressionZone {
  const cc = Math.max(0, Math.min(c, shape.h));
  if (cc <= 0) return { area: 0, Qtop: 0 };
  switch (shape.kind) {
    case 'rectangular':
      return {
        area: shape.b * cc,
        Qtop: (shape.b * cc * cc) / 2,
      };
    case 't-beam': {
      if (cc <= shape.hf) {
        return { area: shape.bf * cc, Qtop: (shape.bf * cc * cc) / 2 };
      }
      const Af = shape.bf * shape.hf;
      const Qf = (shape.bf * shape.hf * shape.hf) / 2;
      const webDepth = cc - shape.hf;
      const Aw = shape.bw * webDepth;
      const Qw = shape.bw * webDepth * (shape.hf + webDepth / 2);
      return { area: Af + Aw, Qtop: Qf + Qw };
    }
  }
}
