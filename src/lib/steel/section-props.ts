/**
 * Section properties for user-defined ("custom") steel shapes, imperial (in).
 * Idealised sharp-corner formulas — no fillets/corner radii, so results are a
 * hair off the rolled-shape catalog (which includes them) but exact for the
 * built-up / plated members these inputs represent.
 */
import type { SteelSection } from './aisc360';

/** Doubly-symmetric I-shape from d (depth), bf (flange width), tf, tw. */
export function buildISection(d: number, bf: number, tf: number, tw: number): SteelSection {
  const hw = d - 2 * tf;                              // clear web depth
  const A = 2 * bf * tf + hw * tw;
  const Ix = (bf * d ** 3) / 12 - ((bf - tw) * hw ** 3) / 12;
  const Iy = (2 * tf * bf ** 3) / 12 + (hw * tw ** 3) / 12;
  const Sx = Ix / (d / 2);
  const Sy = Iy / (bf / 2);
  const Zx = bf * tf * (d - tf) + (tw * hw ** 2) / 4;
  const Zy = (tf * bf ** 2) / 2 + (hw * tw ** 2) / 4;
  const rx = Math.sqrt(Ix / A);
  const ry = Math.sqrt(Iy / A);
  const J = (2 * bf * tf ** 3 + hw * tw ** 3) / 3;    // open-section St-Venant
  const ho = d - tf;                                  // flange-centroid distance
  const Cw = (tf * bf ** 3 * ho ** 2) / 24;           // doubly-sym I warping
  return {
    designation: 'Custom I', family: 'W', A, d, bf, tf, tw,
    Ix, Sx, Zx, rx, Iy, Sy, Zy, ry, J, Cw,
  };
}

/** Rectangular HSS from B (width), H (height), t (wall). */
export function buildHSSRect(B: number, H: number, t: number): SteelSection {
  const bi = B - 2 * t, hi = H - 2 * t;
  const A = B * H - bi * hi;
  const Ix = (B * H ** 3 - bi * hi ** 3) / 12;
  const Iy = (H * B ** 3 - hi * bi ** 3) / 12;
  const Sx = Ix / (H / 2);
  const Sy = Iy / (B / 2);
  const Zx = (B * H ** 2 - bi * hi ** 2) / 4;
  const Zy = (H * B ** 2 - hi * bi ** 2) / 4;
  const rx = Math.sqrt(Ix / A);
  const ry = Math.sqrt(Iy / A);
  const Am = (B - t) * (H - t);                       // area enclosed by wall midline
  const J = (2 * t * Am ** 2) / (B - t + (H - t));    // closed thin-wall torsion
  return {
    designation: 'Custom HSS', family: 'HSS-R', A, d: H, bf: B, tf: t, tw: t,
    Ix, Sx, Zx, rx, Iy, Sy, Zy, ry, J, Cw: 0,
  };
}

/** Round HSS / pipe from D (outside diameter) and t (wall). */
export function buildRound(D: number, t: number): SteelSection {
  const di = D - 2 * t;
  const A = (Math.PI / 4) * (D ** 2 - di ** 2);
  const Ix = (Math.PI / 64) * (D ** 4 - di ** 4);
  const Sx = Ix / (D / 2);
  const Zx = (D ** 3 - di ** 3) / 6;
  const rx = Math.sqrt(Ix / A);
  const J = (Math.PI / 32) * (D ** 4 - di ** 4);
  return {
    designation: 'Custom Round', family: 'HSS-C', A, d: D, bf: D, tf: t, tw: t,
    Ix, Sx, Zx, rx, Iy: Ix, Sy: Sx, Zy: Zx, ry: rx, J, Cw: 0,
  };
}
