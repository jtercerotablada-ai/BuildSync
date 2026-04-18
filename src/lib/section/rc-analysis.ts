import { grossArea, grossCentroidFromTop, grossIx, totalHeight } from './rc-geometry';
import { resolveMaterials } from './rc-materials';
import { computeCracked } from './rc-cracked';
import {
  computeFlexuralCapacity,
  computeInteraction,
  computeMomentCurvature,
} from './rc-nonlinear';
import type { RcParams, RcResults } from './rc-types';

// Top-level RC analysis: gross properties + cracked + Mn + M-φ + P-M.

export function computeRc(params: RcParams): RcResults {
  const mats = resolveMaterials(params.materials);
  const shape = params.concrete;

  const Ag = grossArea(shape);
  const Ig = grossIx(shape);
  const ybar = grossCentroidFromTop(shape);
  const h = totalHeight(shape);
  const yt = ybar;
  const yb = h - ybar;
  // Cracking moment for positive (sagging) bending — tension on the bottom
  // fiber. For T-beams with flange on top, yb > yt, giving a smaller Mcr that
  // is the design-critical value. For rectangular sections yt = yb.
  const Mcr = (mats.fr * Ig) / Math.max(yb, 1e-9);

  const cracked = computeCracked(params, 0);
  const flexural = computeFlexuralCapacity(params);
  const momentCurvature = computeMomentCurvature(params, 60);
  const interaction = computeInteraction(params, 40);

  return {
    gross: { Ag, Ig, yt, yb, Mcr },
    cracked: cracked.valid ? cracked : null,
    flexural,
    momentCurvature,
    interaction,
  };
}

export { computeCracked, computeFlexuralCapacity, computeInteraction, computeMomentCurvature };
