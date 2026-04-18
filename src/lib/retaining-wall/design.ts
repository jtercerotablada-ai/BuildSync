// Stem / heel / toe reinforcement design per ACI 318-19.
// All inputs in SI: dimensions mm, forces kN/m-of-wall, stresses MPa.

import type {
  WallInput,
  SlabDesignResult,
  StemDesignResult,
} from './types';
import { kaRankine, kaCoulomb, integrateActivePressure } from './earth-pressure';

// ACI 318 helpers
function beta1(fc: number): number {
  if (fc <= 28) return 0.85;
  return Math.max(0.65, 0.85 - (0.05 * (fc - 28)) / 7);
}

function phiFlexure(epsT: number, epsY: number): number {
  if (epsT >= 0.005) return 0.9;
  if (epsT <= epsY) return 0.65;
  return 0.65 + ((0.9 - 0.65) * (epsT - epsY)) / (0.005 - epsY);
}

/**
 * Design a rectangular RC section per meter of wall.
 *   Mu (kN·m/m), b=1000 mm, depth h (mm), cover c (mm)
 *   fc, fy in MPa
 * Returns As_req (mm²/m) for singly-reinforced section.
 */
export function flexureDesign(
  Mu_kNm: number,
  h: number,
  cover: number,
  fc: number,
  fy: number
): { As: number; d: number; a: number; rho: number; phiMn: number } {
  const b = 1000; // per meter
  const db = 16; // assumed bar diameter for d calc (#5). Refine later.
  const d = h - cover - db / 2;
  const Mu_Nmm = Mu_kNm * 1e6;
  // Solve for As: Mu = φ·As·fy·(d − a/2); a = As·fy/(0.85·fc·b)
  // Rearranged quadratic: (As·fy)² − 2·0.85·fc·b·d·(As·fy) + 2·0.85·fc·b·Mu/φ = 0
  // Iterate assuming φ=0.9 (tension-controlled), verify after.
  const phi = 0.9;
  const Rn = Mu_Nmm / (phi * b * d * d); // MPa
  // m = fy / (0.85·fc)
  const m = fy / (0.85 * fc);
  const discriminant = 1 - (2 * Rn * m) / fy;
  if (discriminant < 0) {
    // Section too shallow — would need compression steel; return huge As
    return { As: Infinity, d, a: Infinity, rho: Infinity, phiMn: 0 };
  }
  const rho = (1 / m) * (1 - Math.sqrt(discriminant));
  const As = rho * b * d;
  const a = (As * fy) / (0.85 * fc * b);
  const phiMn = (phi * As * fy * (d - a / 2)) / 1e6; // kN·m/m
  return { As, d, a, rho, phiMn };
}

/**
 * ACI 318 §22.5.5.1 — concrete one-way shear capacity (no stirrups) for a
 * slab: Vc = 0.17·λ·√fc·b·d. Returns kN/m.
 */
export function vcOneWay(fc: number, b: number, d: number, lambda = 1): number {
  const Vc_N = 0.17 * lambda * Math.sqrt(Math.max(fc, 0)) * b * d;
  return Vc_N / 1000; // kN
}

/**
 * ACI 318 §24.4 — minimum reinforcement for shrinkage/temperature in slabs:
 *   ρ_min = 0.0018 (Grade 60) × Ag
 * For walls (§11.6), ρh_min = 0.0025 for vertical, 0.0020 for horizontal —
 * we use 0.0018 as a conservative lower bound for the flexural face.
 */
export function minReinforcement(h: number, fy: number): number {
  const factor = fy <= 420 ? 0.0018 : 0.0018 * (420 / fy);
  return factor * 1000 * h; // mm²/m
}

/**
 * STEM design: moment and shear at the top-of-footing section. Active
 * pressure is integrated from top of stem down to footing top (height H_stem).
 */
export function designStem(input: WallInput): StemDesignResult {
  const { geometry: g, concrete, backfill, loads, water, theory, baseSoil } = input;
  const H = g.H_stem;
  const Ka =
    theory === 'rankine'
      ? kaRankine(backfill[0]?.phi ?? 0, g.backfillSlope)
      : kaCoulomb(backfill[0]?.phi ?? 0, g.backfillSlope, baseSoil.delta);
  const integ = integrateActivePressure(H, backfill, Ka, loads, water);
  const H_drive = integ.Pa + integ.Pq + integ.Pw + integ.dPae; // kN/m

  // Moment at base of stem = H · yBar (from stem base)
  const yBar_m = integ.yBar / 1000; // m above base
  const Mu_kNm = H_drive * yBar_m * 1.6; // ACI load factor for lateral earth (1.6)

  // Critical shear at d from top of footing: conservative, use H_drive (not reduced)
  const Vu_kNm = H_drive * 1.6;

  const fc = concrete.fc;
  const fy = concrete.fy;
  const h = g.t_stem_bot;
  const cover = concrete.cover;
  const { As: As_req, d, a, rho, phiMn } = flexureDesign(Mu_kNm, h, cover, fc, fy);
  const As_min = minReinforcement(h, fy);
  const Vc = vcOneWay(fc, 1000, d);
  const phiVc = 0.75 * Vc;

  return {
    Mu: Mu_kNm,
    Vu: Vu_kNm,
    As_req: Math.max(As_req, As_min),
    As_min,
    Vc,
    shearOk: Vu_kNm <= phiVc,
    d,
    a,
    rho,
    phiMn,
  };
}

/**
 * HEEL slab design — tension on top. Moment at face of stem, from:
 *   • Backfill weight + surcharge (down, causing tension at top)
 *   • Heel self-weight (down, same direction)
 *   • Upward bearing pressure under heel (relief, causing top tension too)
 * Net Mu at face of stem. ACI load factor 1.2 dead + 1.6 surcharge.
 */
export function designHeel(
  input: WallInput,
  q_heel_avg: number // net upward pressure under heel (kPa, averaged)
): SlabDesignResult {
  const { geometry: g, concrete, backfill, loads } = input;
  const heelM = g.B_heel / 1000;
  const H_stem_m = g.H_stem / 1000;
  const H_foot_m = g.H_foot / 1000;

  // Average backfill unit weight
  const totalThick = backfill.reduce((s, L) => s + (L.thickness <= 0 ? H_stem_m * 1000 : L.thickness), 0);
  const gammaAvg =
    totalThick > 0
      ? backfill.reduce(
          (s, L) =>
            s + L.gamma * (L.thickness <= 0 ? H_stem_m * 1000 : Math.min(L.thickness, H_stem_m * 1000)),
          0
        ) / totalThick
      : (backfill[0]?.gamma ?? 18);

  // Down loads per unit length of heel:
  const w_fill = gammaAvg * H_stem_m; // kN/m² (kPa)
  const w_foot = concrete.gamma * H_foot_m; // kPa
  const w_q = loads.surchargeQ; // kPa

  const wDown = (1.2 * (w_fill + w_foot) + 1.6 * w_q); // factored (kPa)
  const wUp = 1.2 * q_heel_avg; // factored upward reaction under heel (kPa)
  const wNet = Math.max(wDown - wUp, 0); // kPa net down

  // Cantilever moment at face of stem:
  //   Mu = wNet · heel² / 2   (kN·m/m)
  const Mu_kNm = (wNet * heelM * heelM) / 2;
  const Vu_kNm = wNet * heelM;

  const fc = concrete.fc;
  const fy = concrete.fy;
  const h = g.H_foot;
  const cover = concrete.cover;
  const { As: As_req, d, a, phiMn } = flexureDesign(Mu_kNm, h, cover, fc, fy);
  const As_min = minReinforcement(h, fy);
  const Vc = vcOneWay(fc, 1000, d);

  return {
    Mu: Mu_kNm,
    Vu: Vu_kNm,
    As_req: Math.max(As_req, As_min),
    As_min,
    Vc,
    shearOk: Vu_kNm <= 0.75 * Vc,
    d,
    a,
    phiMn,
    critical: 'top',
  };
}

/**
 * TOE slab design — tension on BOTTOM. Upward bearing pressure causes
 * cantilever bending of toe about face of stem. Toe self-weight + any soil
 * above reduces demand slightly.
 */
export function designToe(
  input: WallInput,
  q_toe_avg: number // net upward pressure under toe (kPa, averaged)
): SlabDesignResult {
  const { geometry: g, concrete, baseSoil } = input;
  const toeM = g.B_toe / 1000;
  const H_foot_m = g.H_foot / 1000;
  const w_foot = concrete.gamma * H_foot_m;
  const w_soil = baseSoil.gamma * (g.frontFill / 1000);

  const wUp = 1.2 * q_toe_avg;
  const wDown = 0.9 * (w_foot + w_soil); // min dead-load factor to maximize net up
  const wNet = Math.max(wUp - wDown, 0);

  const Mu_kNm = (wNet * toeM * toeM) / 2;
  const Vu_kNm = wNet * toeM;

  const fc = concrete.fc;
  const fy = concrete.fy;
  const h = g.H_foot;
  const cover = concrete.cover;
  const { As: As_req, d, a, phiMn } = flexureDesign(Mu_kNm, h, cover, fc, fy);
  const As_min = minReinforcement(h, fy);
  const Vc = vcOneWay(fc, 1000, d);

  return {
    Mu: Mu_kNm,
    Vu: Vu_kNm,
    As_req: Math.max(As_req, As_min),
    As_min,
    Vc,
    shearOk: Vu_kNm <= 0.75 * Vc,
    d,
    a,
    phiMn,
    critical: 'bottom',
  };
}
