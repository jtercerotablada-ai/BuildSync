import { compressionZone, grossArea, totalHeight, widthAt } from './rc-geometry';
import { phiFromStrain, resolveMaterials } from './rc-materials';
import type {
  FlexuralCapacityResult,
  InteractionPoint,
  InteractionResult,
  MomentCurvaturePoint,
  MomentCurvatureResult,
  RcParams,
} from './rc-types';

// Non-linear RC analysis via strain compatibility + force equilibrium.
// All in SI: mm, MPa, N, N·mm.
//
// Two concrete stress models are used:
//
//   [A] WHITNEY (ACI 318) — equivalent rectangular block of depth a=β1·c and
//       uniform stress 0.85·f'c. Used for Mn (nominal capacity) and P-M
//       interaction, which is the ACI design convention.
//
//   [B] HOGNESTAD — parabolic σ(ε) = f'c·[2·ε/ε0 − (ε/ε0)²] up to ε0=0.002,
//       then linear descending branch to 0.85·f'c at εCU=0.003. Used for the
//       moment-curvature curve, where we want a realistic pre- and post-
//       yield response, not the design envelope.
//
// Steel is idealised as elasto-plastic: σ = E·ε, capped at ±fy.
//
// Strain compatibility with linear strain distribution (Navier-Bernoulli):
//   ε(y) = εC · (c − y) / c            (top fiber ε = εC, zero at y = c)
// where positive ε is compression.
//
// For each NA depth c we solve for εC such that ΣF = P (applied axial).
// Then M is the moment of all forces about the plastic centroid (taken as
// the gross-section centroid for consistency).

// =========================================================================
//   WHITNEY-based flexural capacity (pure bending, P = 0)
// =========================================================================

export function computeFlexuralCapacity(params: RcParams): FlexuralCapacityResult {
  const mats = resolveMaterials(params.materials);
  const { concrete, layers } = params;
  const h = totalHeight(concrete);

  // Find c such that ΣF = 0 with P = 0 using Whitney block for concrete and
  // elasto-plastic steel at the ULTIMATE state (ε_top = εCU).
  const eqn = (c: number): number => forceSumWhitney(params, mats, c).P;

  // Bracket: c small → tension dominates → P < 0; c large → compression dominates → P > 0.
  let lo = h * 0.001;
  let hi = h * 1.5;
  // Make sure we actually bracket zero
  let fLo = eqn(lo);
  let fHi = eqn(hi);
  // Expand hi if needed (very heavily reinforced sections)
  let guard = 0;
  while (fLo * fHi > 0 && guard++ < 50) {
    hi *= 1.5;
    fHi = eqn(hi);
  }

  let c = (lo + hi) / 2;
  if (fLo * fHi <= 0) {
    for (let i = 0; i < 80; i++) {
      c = (lo + hi) / 2;
      const fm = eqn(c);
      if (Math.abs(fm) < 1e-3) break;
      if (fLo * fm < 0) {
        hi = c;
        fHi = fm;
      } else {
        lo = c;
        fLo = fm;
      }
    }
  }

  const st = forceSumWhitney(params, mats, c);
  const extremeTensionLayer = extremeTensionSteel(params, c);
  const epsT = extremeTensionLayer
    ? Math.abs(mats.epsCU * (extremeTensionLayer.depth - c) / c)
    : 0;
  const phi = phiFromStrain(epsT, mats.epsY);

  return {
    Mn: st.M,
    phi,
    phiMn: phi * st.M,
    a: mats.beta1 * c,
    c,
    epsT,
    tensionControlled: epsT >= 0.005,
    balanced: Math.abs(epsT - mats.epsY) < 1e-4,
  };
}

// =========================================================================
//   Force/moment from Whitney block at given NA depth c (ULTIMATE state)
// =========================================================================

interface StateSum {
  P: number; // ΣF compression + (N)
  M: number; // moment about plastic centroid (N·mm), positive sags (top compression)
}

function forceSumWhitney(
  params: RcParams,
  mats: ReturnType<typeof resolveMaterials>,
  c: number
): StateSum {
  const { concrete, layers } = params;
  const h = totalHeight(concrete);
  const pcY = h / 2; // plastic centroid ≈ gross centroid for rectangular; refine later

  // Whitney block depth
  const a = Math.min(mats.beta1 * c, h);
  // Compressed concrete force
  const { area } = compressionZone(concrete, a);
  const Cc = 0.85 * mats.fc * area;
  // Moment arm from plastic centroid: concrete force acts at centroid of block.
  const aCentroid = whitneyBlockCentroid(concrete, a);

  let P = Cc;
  let M = Cc * (pcY - aCentroid);

  for (const L of layers) {
    const eps = mats.epsCU * (c - L.depth) / Math.max(c, 1e-9);
    // Steel stress: elasto-plastic, compression +
    const fs = Math.max(-mats.fy, Math.min(mats.fy, mats.Es * eps));
    // If the steel is above the NA, the Whitney block already accounts for
    // the concrete that would have occupied that space — subtract 0.85·f'c
    // to avoid double-counting concrete strength at the compression-steel area.
    const displaced = L.depth < a ? 0.85 * mats.fc : 0;
    const Fs = (fs - displaced) * L.area;
    P += Fs;
    M += Fs * (pcY - L.depth);
  }

  return { P, M };
}

function whitneyBlockCentroid(concrete: RcParams['concrete'], a: number): number {
  if (a <= 0) return 0;
  const { Qtop, area } = compressionZone(concrete, a);
  return area > 0 ? Qtop / area : a / 2;
}

function extremeTensionSteel(params: RcParams, c: number) {
  const tension = params.layers.filter((L) => L.depth > c);
  if (tension.length === 0) return null;
  return tension.reduce((a, b) => (b.depth > a.depth ? b : a));
}

// =========================================================================
//   MOMENT-CURVATURE via Hognestad + fiber integration
// =========================================================================

export function computeMomentCurvature(params: RcParams, nPoints = 60): MomentCurvatureResult {
  const mats = resolveMaterials(params.materials);
  const { concrete } = params;
  const h = totalHeight(concrete);

  // Curvature sweep from 0 to ~ εCU / (h/5) (generous upper bound)
  const phiMax = mats.epsCU / (h * 0.1); // allows NA as high as 10% of h
  const points: MomentCurvaturePoint[] = [];

  for (let k = 0; k <= nPoints; k++) {
    const phi = (k / nPoints) * phiMax;
    const state = stateAtCurvature(params, mats, phi);
    if (!state) continue;
    points.push(state);
  }

  const yieldPoint =
    points.find((p) => p.epsSMax >= mats.epsY) ?? null;
  const ultimatePoint =
    points.slice().reverse().find((p) => p.epsC >= mats.epsCU) ?? null;
  const cracked = points.some((p) => p.epsSMax > mats.fy / mats.Es / 10);

  return { points, yieldPoint, ultimatePoint, cracked };
}

function stateAtCurvature(
  params: RcParams,
  mats: ReturnType<typeof resolveMaterials>,
  phi: number
): MomentCurvaturePoint | null {
  if (phi <= 0) {
    return { phi: 0, M: 0, c: totalHeight(params.concrete), epsC: 0, epsSMax: 0 };
  }

  // Solve for NA depth c such that ΣF = 0 using Hognestad concrete + steel.
  // ε(y) = phi·(c − y) → at y=0 (top) ε = phi·c (compression), y=c ε=0.
  const h = totalHeight(params.concrete);
  const residual = (c: number) => {
    const st = forceSumHognestad(params, mats, phi, c);
    return st.P; // want P = 0
  };

  // Bracket search
  let lo = h * 0.001;
  let hi = h * 2.5;
  let fLo = residual(lo);
  let fHi = residual(hi);
  let guard = 0;
  while (fLo * fHi > 0 && guard++ < 60) {
    hi *= 1.5;
    fHi = residual(hi);
    if (hi > h * 100) return null;
  }
  if (fLo * fHi > 0) return null;

  let c = (lo + hi) / 2;
  for (let i = 0; i < 60; i++) {
    c = (lo + hi) / 2;
    const fm = residual(c);
    if (Math.abs(fm) < 1e-3) break;
    if (fLo * fm < 0) {
      hi = c;
      fHi = fm;
    } else {
      lo = c;
      fLo = fm;
    }
  }

  const st = forceSumHognestad(params, mats, phi, c);
  const epsC = phi * c;
  // Max steel tension strain is at the bottom-most tension layer
  const ext = extremeTensionSteel(params, c);
  const epsSMax = ext ? phi * (ext.depth - c) : 0;

  return { phi, M: st.M, c, epsC, epsSMax };
}

function forceSumHognestad(
  params: RcParams,
  mats: ReturnType<typeof resolveMaterials>,
  phi: number,
  c: number
): StateSum {
  const { concrete, layers } = params;
  const h = totalHeight(concrete);
  const pcY = h / 2;

  // Numerically integrate concrete compression from y=0 down to y=c, using
  // N_STRIPS horizontal strips (Simpson-ish trapezoid). Hognestad stress:
  //   ε ≤ 0     → σ = 0 (tension ignored)
  //   0 < ε ≤ ε0 → σ = f'c·[2·ε/ε0 − (ε/ε0)²]         rising parabola
  //   ε0 < ε ≤ εCU → σ = f'c·[1 − 0.15·(ε − ε0)/(εCU − ε0)]  linear descend
  //   ε > εCU   → σ = 0.85·f'c (crushed)
  const eps0 = 0.002;
  const N = 60;
  let Cc = 0;
  let McFromTop = 0;
  const dy = c / N;
  for (let i = 0; i < N; i++) {
    const y = (i + 0.5) * dy;
    const eps = phi * (c - y);
    if (eps <= 0) continue;
    const w = widthAt(concrete, y);
    let sigma: number;
    if (eps <= eps0) {
      const r = eps / eps0;
      sigma = mats.fc * (2 * r - r * r);
    } else if (eps <= mats.epsCU) {
      sigma = mats.fc * (1 - (0.15 * (eps - eps0)) / (mats.epsCU - eps0));
    } else {
      sigma = 0.85 * mats.fc;
    }
    const dF = sigma * w * dy;
    Cc += dF;
    McFromTop += dF * y;
  }

  let P = Cc;
  let M = Cc * (pcY - (Cc > 0 ? McFromTop / Cc : 0));

  for (const L of layers) {
    const eps = phi * (c - L.depth);
    const fs = Math.max(-mats.fy, Math.min(mats.fy, mats.Es * eps));
    // When the layer sits inside the compressed concrete, subtract displaced concrete stress
    let sigmaDisplaced = 0;
    if (L.depth < c) {
      const epsC = phi * (c - L.depth);
      if (epsC > 0 && epsC <= eps0) {
        const r = epsC / eps0;
        sigmaDisplaced = mats.fc * (2 * r - r * r);
      } else if (epsC > eps0 && epsC <= mats.epsCU) {
        sigmaDisplaced = mats.fc * (1 - (0.15 * (epsC - eps0)) / (mats.epsCU - eps0));
      } else if (epsC > mats.epsCU) {
        sigmaDisplaced = 0.85 * mats.fc;
      }
    }
    const Fs = (fs - sigmaDisplaced) * L.area;
    P += Fs;
    M += Fs * (pcY - L.depth);
  }

  return { P, M };
}

// =========================================================================
//   P-M INTERACTION DIAGRAM (ACI 318 / Whitney block)
// =========================================================================

export function computeInteraction(params: RcParams, nPoints = 40): InteractionResult {
  const mats = resolveMaterials(params.materials);
  const { concrete, layers } = params;
  const h = totalHeight(concrete);

  // Sweep c from a very small value (near pure tension) up to a very large
  // value (pure compression). At each c we compute P and M from the Whitney
  // stress-block convention, assuming ε_top = εCU.
  const points: InteractionPoint[] = [];

  // Pure tension
  const AsTotal = layers.reduce((s, L) => s + L.area, 0);
  const Pnt = -mats.fy * AsTotal;

  // Pure compression P0 = 0.85·f'c·(Ag − As) + fy·As
  const Ag = grossArea(concrete);
  const P0 = 0.85 * mats.fc * (Ag - AsTotal) + mats.fy * AsTotal;

  // Sweep c values (geometric progression extending well past h)
  const cMin = h * 0.02;
  const cMax = h * 20;
  for (let k = 0; k <= nPoints; k++) {
    const t = k / nPoints;
    const c = cMin * Math.pow(cMax / cMin, t);
    const st = forceSumWhitney(params, mats, c);
    const ext = extremeTensionSteel(params, c);
    const epsT = ext ? Math.abs(mats.epsCU * (ext.depth - c) / c) : 0;
    const phi = phiFromStrain(epsT, mats.epsY);
    // Cap phi·P at 0.80·φ·P0 per ACI 318-19 §22.4.2 (tied reinforcement default)
    const phiPcap = 0.8 * phi * P0;
    const phiP = Math.min(phi * st.P, phiPcap);
    const phiM = phi * Math.abs(st.M);
    points.push({
      P: st.P,
      M: Math.abs(st.M),
      c,
      phi,
      phiP,
      phiM,
      epsT,
    });
  }

  // Sort by c descending so the first entry is closest to pure compression
  points.sort((a, b) => b.c - a.c);

  // Add pure-compression and pure-tension anchors at the ends
  const pureCompression: InteractionPoint = {
    P: P0,
    M: 0,
    c: Infinity,
    phi: 0.65,
    phiP: 0.8 * 0.65 * P0,
    phiM: 0,
    epsT: -Infinity,
    label: 'pure-compression',
  };
  const pureTension: InteractionPoint = {
    P: Pnt,
    M: 0,
    c: 0,
    phi: 0.9,
    phiP: 0.9 * Pnt,
    phiM: 0,
    epsT: mats.fy / mats.Es,
    label: 'pure-tension',
  };

  // Balance point — interpolate where εT = εy in the swept points
  const balancePoint = findByStrain(points, mats.epsY) ?? {
    ...points[Math.floor(points.length / 2)],
    label: 'balance',
  };
  balancePoint.label = 'balance';

  // Pure-flexion point (P = 0) — interpolate
  const pureFlexion = findByP(points, 0) ?? {
    ...points[points.length - 1],
    label: 'pure-flexion',
  };
  pureFlexion.label = 'pure-flexion';

  const full = [pureCompression, ...points, pureTension];

  return {
    points: full,
    P0,
    phiPmax: 0.8 * 0.65 * P0, // tied default; spiral would use 0.85·0.75·P0
    balancePoint,
    pureFlexion,
    pureTension: Pnt,
  };
}

function findByStrain(points: InteractionPoint[], target: number): InteractionPoint | null {
  for (let i = 0; i + 1 < points.length; i++) {
    const a = points[i];
    const b = points[i + 1];
    if ((a.epsT - target) * (b.epsT - target) <= 0) {
      const t = (target - a.epsT) / (b.epsT - a.epsT || 1e-12);
      return interp(a, b, t);
    }
  }
  return null;
}

function findByP(points: InteractionPoint[], target: number): InteractionPoint | null {
  for (let i = 0; i + 1 < points.length; i++) {
    const a = points[i];
    const b = points[i + 1];
    if ((a.P - target) * (b.P - target) <= 0) {
      const t = (target - a.P) / (b.P - a.P || 1e-12);
      return interp(a, b, t);
    }
  }
  return null;
}

function interp(a: InteractionPoint, b: InteractionPoint, t: number): InteractionPoint {
  return {
    P: a.P + t * (b.P - a.P),
    M: a.M + t * (b.M - a.M),
    c: a.c + t * (b.c - a.c),
    phi: a.phi + t * (b.phi - a.phi),
    phiP: a.phiP + t * (b.phiP - a.phiP),
    phiM: a.phiM + t * (b.phiM - a.phiM),
    epsT: a.epsT + t * (b.epsT - a.epsT),
  };
}
