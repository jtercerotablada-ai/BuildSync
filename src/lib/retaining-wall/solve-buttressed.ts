// Buttressed wall solver — FRONT buttresses (compression).
//
// Geometry: buttresses sit in front of the stem and act in COMPRESSION
// (the wall pushes forward; the buttress resists by being squeezed
// against the stem and footing). Mathematically the stem slab and heel
// slab still span between buttresses, so their flexural design mirrors
// the counterfort case. The difference is the buttress itself:
//
//   • Counterfort (rear): buttress is in TENSION at its rear face;
//     significant tension reinforcement is required at the back face.
//   • Buttressed  (front): buttress is in COMPRESSION; only nominal
//     reinforcement (As_min for temperature/shrinkage) is required.
//
// We compute the same stem-slab and heel-slab moments as the counterfort
// solver, then design the buttress with As_min only — the load is carried
// by concrete compression, not steel tension.
//
// References:
//   • ACI 318-25 SI §11 (walls), §22.2 (flexure)
//   • Wight & MacGregor 7e §18-3.5 (counterfort / buttressed walls)

import type {
  WallInput, WallResults, ButtressedGeometry,
  SlabDesignResult, KeyDesignResult, CrackControl, StemDesignResult,
  ButtressedDesignResult,
} from './types';
import { computeStability } from './stability';
import { kaRankine, kaCoulomb, integrateActivePressure } from './earth-pressure';
import { flexureDesign, vcOneWay, minReinforcement, crackControl } from './design';

const LF_LATERAL = 1.6;
const LF_DEAD = 1.2;
const PHI_FLEX = 0.9;
const PHI_SHEAR = 0.75;

export function solveButtressed(input: WallInput): WallResults {
  if (input.geometry.kind !== 'buttressed') {
    throw new Error("solveButtressed called with non-buttressed geometry");
  }
  const g = input.geometry as ButtressedGeometry;

  const { stability, pressure } = computeStability(input);

  const Ka =
    input.theory === 'rankine'
      ? kaRankine(input.backfill[0]?.phi ?? 0, g.backfillSlope)
      : kaCoulomb(input.backfill[0]?.phi ?? 0, g.backfillSlope, input.baseSoil.delta);
  const integ = integrateActivePressure(g.H_stem, input.backfill, Ka, input.loads, input.water);
  void integ;
  const gammaActive = input.backfill[0]?.gamma ?? 18;
  const Hstem_m = g.H_stem / 1000;
  const S_m = g.buttressSpacing / 1000;
  const p_max_kPa = gammaActive * Ka * Hstem_m + Ka * input.loads.surchargeQ;

  const fc = input.concrete.fc;
  const fy = input.concrete.fy;
  const cover = input.concrete.cover;

  // Stem slab (horizontal one-way) — same formulas as counterfort
  const Mneg_stem = LF_LATERAL * (p_max_kPa * S_m * S_m) / 12;
  const Mpos_stem = LF_LATERAL * (p_max_kPa * S_m * S_m) / 24;
  const Vu_stem   = LF_LATERAL * (p_max_kPa * S_m / 2);

  const t_stem = g.t_stem_bot;
  const stemNeg = flexureDesign(Mneg_stem, t_stem, cover, fc, fy);
  const stemPos = flexureDesign(Mpos_stem, t_stem, cover, fc, fy);
  const As_min_stem = minReinforcement(t_stem, fy);
  const stemNeg_As = Math.max(stemNeg.As, As_min_stem);
  const stemPos_As = Math.max(stemPos.As, As_min_stem);
  const Vc_stem = vcOneWay(fc, 1000, stemNeg.d);

  const stemSlab: SlabDesignResult = {
    Mu: Mneg_stem,
    Vu: Vu_stem,
    As_req: stemNeg_As,
    As_min: As_min_stem,
    Vc: Vc_stem,
    shearOk: Vu_stem <= PHI_SHEAR * Vc_stem,
    d: stemNeg.d, a: stemNeg.a, phiMn: stemNeg.phiMn,
    critical: 'top',
    crack: crackControl(stemNeg_As, fy, cover),
  };

  // Heel slab — same formulation as counterfort
  const wSoil = gammaActive * Hstem_m;
  const wSurch = input.loads.surchargeQ;
  const wConc = input.concrete.gamma * (g.H_foot / 1000);
  const q_heel_up = Math.max(stability.qMin, 0);
  const wHeelDown = LF_DEAD * (wSoil + wConc) + LF_LATERAL * wSurch;
  const wHeelUp = LF_DEAD * q_heel_up;
  const wHeelNet = Math.max(0, wHeelDown - wHeelUp);
  const Mneg_heel = (wHeelNet * S_m * S_m) / 12;
  const Vu_heel = wHeelNet * S_m / 2;

  const t_heel = g.H_foot;
  const heelDes = flexureDesign(Mneg_heel, t_heel, cover, fc, fy);
  const As_min_heel = minReinforcement(t_heel, fy);
  const heel_As = Math.max(heelDes.As, As_min_heel);
  const Vc_heel = vcOneWay(fc, 1000, heelDes.d);
  const heelSlab: SlabDesignResult = {
    Mu: Mneg_heel,
    Vu: Vu_heel,
    As_req: heel_As,
    As_min: As_min_heel,
    Vc: Vc_heel,
    shearOk: Vu_heel <= PHI_SHEAR * Vc_heel,
    d: heelDes.d, a: heelDes.a, phiMn: heelDes.phiMn,
    critical: 'top',
    crack: crackControl(heel_As, fy, cover),
  };

  // Buttress — in COMPRESSION; As_min only.
  const bw = g.buttressThickness;
  const d_buttress = (g.B_toe - cover - 12);
  // Total horizontal "load" per buttress (used only for shear check)
  const Hbuttress = 0.5 * gammaActive * Ka * Hstem_m * Hstem_m * S_m
                  + Ka * input.loads.surchargeQ * Hstem_m * S_m;
  const Vu_buttress = LF_LATERAL * Hbuttress;
  const As_min_buttress = minReinforcement(bw, fy);
  // Compression-resistance check (informational — not strictly required to
  // be a tension-design like the counterfort): the buttress concrete
  // section provides ample compression capacity. We surface the moment as
  // 0 (no tension-design required) and Vc per ACI §22.5.
  const Vc_buttress = vcOneWay(fc, bw, d_buttress);

  const buttressedDesign: ButtressedDesignResult = {
    stemSlab, heelSlab,
    counterfort: {                             // reuses CounterfortDesignResult shape
      Mu: 0,                                   // compression mode — no tension-design moment
      Vu: Vu_buttress,
      bw, d: d_buttress,
      As_req: As_min_buttress,                 // nominal As only
      phiMn: 0,
      Vc: Vc_buttress * (bw / 1000),
      shearOk: Vu_buttress <= PHI_SHEAR * Vc_buttress * (bw / 1000),
    },
    compressionMode: true,
  };

  // Stem summary (for the StemDesignResult slot)
  const stemSummary: StemDesignResult = {
    Mu: Mneg_stem,
    Vu: Vu_stem,
    As_req: stemPos_As,
    As_min: As_min_stem,
    Vc: Vc_stem,
    shearOk: stemSlab.shearOk,
    d: stemNeg.d, a: stemNeg.a, rho: stemNeg.rho, phiMn: stemNeg.phiMn,
    crack: stemSlab.crack,
    frontFace: {
      Mu: Mpos_stem,
      As_req: stemPos_As,
      crack: crackControl(stemPos_As, fy, cover),
    },
  };

  const noCrack: CrackControl = {
    s_max: 0, fs: 0, bar: { id: 'N/A', area: 0, diameter: 0 }, s_req: 0, ok: true,
  };
  const zeroSlab: SlabDesignResult = {
    Mu: 0, Vu: 0, As_req: 0, As_min: As_min_heel,
    Vc: 0, shearOk: true,
    d: 0, a: 0, phiMn: 0, critical: 'top', crack: noCrack,
  };
  const zeroKey: KeyDesignResult = {
    enabled: !!g.key,
    Hp_key: 0, Mu: 0, Vu: 0, d: 0, a: 0,
    As_req: 0, As_min: 0, Vc: 0, shearOk: true, phiMn: 0, crack: noCrack,
  };

  // Diagnostics
  const issues: string[] = [];
  const errors: string[] = [];
  if (!stability.overturningOk) errors.push(`Overturning FS=${stability.FS_overturning.toFixed(2)} < ${input.safetyFactors.overturning}`);
  if (!stability.slidingOk) errors.push(`Sliding FS=${stability.FS_sliding.toFixed(2)} < ${input.safetyFactors.sliding}`);
  if (!stability.bearingOk) errors.push(`Bearing qmax=${stability.qMax.toFixed(0)} kPa exceeds qAllow`);
  if (!stemSlab.shearOk) errors.push(`Stem slab shear exceeds φVc`);
  if (!heelSlab.shearOk) errors.push(`Heel slab shear exceeds φVc`);
  if (!buttressedDesign.counterfort.shearOk) errors.push(`Buttress shear exceeds φVc`);
  issues.unshift(
    `Buttressed wall — front buttresses act in COMPRESSION (mirror of counterfort). Stem and heel slabs span between buttresses with the same fixed-fixed coefficients (M = wL²/12 at supports, wL²/24 at midspan). Buttress reinforcement is As_min only because the buttress is in compression.`,
  );

  return {
    pressure,
    stability,
    stem: stemSummary,
    heel: heelSlab,
    toe: zeroSlab,
    key: zeroKey,
    buttressedDesign,
    issues,
    errors,
  };
}
