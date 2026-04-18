import { compressionZone, widthAt } from './rc-geometry';
import { resolveMaterials } from './rc-materials';
import type { CrackedSectionResult, RcParams } from './rc-types';

// Classical cracked transformed section analysis (elastic range, service loads).
//
// Procedure:
//  1. Find the neutral axis depth `kd` (measured from the top fiber) by solving
//     the transformed first-moment equation:
//         Q_c(kd)  −  Σ (n_eff_i · As_i) · (d_i − kd)  =  0
//     where Q_c is the first moment of the compressed concrete area about
//     the neutral axis, and n_eff_i is:
//         (n − 1) if the layer sits above the NA (compression steel, replaces concrete)
//         n       if the layer sits below the NA (tension steel, no concrete there)
//  2. Once kd is known, compute the cracked transformed moment of inertia Icr.
//  3. Given applied M, compute σ_c_max and σ_s at each layer.

export function computeCracked(params: RcParams, M_Nmm = 0): CrackedSectionResult {
  const mats = resolveMaterials(params.materials);
  const n = mats.n;
  const { concrete, layers } = params;

  if (layers.length === 0) {
    return {
      kd: 0,
      Icr: 0,
      n,
      sigmaC_max: 0,
      sigmaS: [],
      valid: false,
    };
  }

  // Bisection on kd ∈ (0, h):   f(kd) = Qc(kd) − Σ n_eff_i · As_i · (d_i − kd)
  // f is strictly monotonic for the cracked-concrete assumption, so bisection
  // converges in ~50 iterations even across T-beams.
  const h = concrete.h;
  const f = (kd: number) => {
    const { Qtop, area } = compressionZone(concrete, kd);
    // First moment of compressed concrete about the NA:
    //   Qc_about_NA = Qtop_about_top − area·kd   (positive above NA)
    //   but sign convention: about NA, compressed concrete is on top so positive.
    //   More directly: Qc_NA = ∫ w(y)·(kd − y) dy = area·kd − Qtop
    const QcNA = area * kd - Qtop;
    let steelTerm = 0;
    for (const L of layers) {
      const nEff = L.depth < kd ? n - 1 : n; // (n−1) for compression steel
      steelTerm += nEff * L.area * (L.depth - kd);
    }
    return QcNA - steelTerm;
  };

  // Guard: if f(0) and f(h) have same sign we can't bracket. In that case
  // fall back to sending kd=0 (all tension) or kd=h (all compression).
  const fa = f(1e-6);
  const fb = f(h - 1e-6);
  if (fa * fb > 0) {
    return {
      kd: 0,
      Icr: 0,
      n,
      sigmaC_max: 0,
      sigmaS: [],
      valid: false,
    };
  }

  let lo = 1e-6;
  let hi = h - 1e-6;
  let kd = (lo + hi) / 2;
  for (let i = 0; i < 80; i++) {
    kd = (lo + hi) / 2;
    const fm = f(kd);
    if (Math.abs(fm) < 1e-6) break;
    if (fa * fm < 0) hi = kd;
    else lo = kd;
  }

  // Cracked transformed moment of inertia about the NA:
  //   Icr = Ic(kd) + Σ n_eff_i · As_i · (d_i − kd)²
  // where Ic(kd) = ∫_0^{kd} w(y)·(kd − y)² dy
  const Ic = momentOfInertiaCompression(params.concrete, kd);
  let Icr = Ic;
  for (const L of layers) {
    const nEff = L.depth < kd ? n - 1 : n;
    Icr += nEff * L.area * (L.depth - kd) ** 2;
  }

  // Stresses under applied moment (positive M puts the top fiber in compression)
  const sigmaC_max = (Math.abs(M_Nmm) * kd) / Math.max(Icr, 1e-9);
  const sigmaS = layers.map((L) => {
    const yFromNA = L.depth - kd; // positive below NA (tension)
    // σ_s = n · (M · y / Icr); sign: + tension / − compression
    return (n * M_Nmm * yFromNA) / Math.max(Icr, 1e-9);
  });

  return {
    kd,
    Icr,
    n,
    sigmaC_max,
    sigmaS,
    valid: true,
  };
}

// Moment of inertia of the compressed concrete zone about the neutral axis
// at depth c. ∫_0^c w(y)·(c − y)² dy  for the rectangle/T cases.
function momentOfInertiaCompression(shape: {
  kind: 'rectangular' | 't-beam';
  b?: number;
  h: number;
  bw?: number;
  bf?: number;
  hf?: number;
}, c: number): number {
  if (c <= 0) return 0;
  if (shape.kind === 'rectangular') {
    // ∫_0^c b·(c−y)² dy = b·c³/3
    return (shape.b! * c * c * c) / 3;
  }
  // T-beam
  const hf = shape.hf!;
  const bf = shape.bf!;
  const bw = shape.bw!;
  if (c <= hf) {
    return (bf * c * c * c) / 3;
  }
  // Flange contribution: width bf from y=0..hf
  //   ∫_0^{hf} bf·(c−y)² dy = bf·[(c−0)³ − (c−hf)³]/3
  const flange = (bf * ((c) ** 3 - (c - hf) ** 3)) / 3;
  // Web contribution: width bw from y=hf..c
  //   ∫_{hf}^{c} bw·(c−y)² dy = bw·(c−hf)³/3
  const web = (bw * (c - hf) ** 3) / 3;
  return flange + web;
}

// Verify we never reference a zero-width y (sanity check hook for tests)
export const _widthAt = widthAt;
