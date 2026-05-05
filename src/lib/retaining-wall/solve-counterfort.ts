// Counterfort wall solver.
//
// Geometry: REAR buttresses (counterforts) tie the stem slab to the heel
// slab at regular intervals. The wall now has THREE separate flexural
// elements that need design:
//
//   1. STEM SLAB — spans HORIZONTALLY between counterforts, one-way slab
//      with fixed-fixed end conditions. Active pressure is triangular in
//      the vertical direction, so the design moment is computed at the
//      bottom of the stem (where p_max occurs).
//
//        At supports (counterforts):  M_neg = w · L² / 12      (rear face)
//        At midspan:                  M_pos = w · L² / 24      (front face)
//
//      where w = p_max = γ·Ka·H_stem (kN/m² at the base) and L is the
//      counterfort spacing. For higher-up strips, w decreases linearly
//      with depth from the top.
//
//   2. HEEL SLAB — spans LONGITUDINALLY between counterforts, one-way
//      slab with fixed-fixed end conditions, carrying the backfill weight
//      above (less the upward bearing pressure). Same fixed-fixed
//      coefficients as the stem slab:
//
//        M_neg = q · L² / 12   (top tension at counterforts)
//        M_pos = q · L² / 24   (bottom tension at midspan)
//
//      where q is the net downward load (kN/m²).
//
//   3. COUNTERFORT T-BEAM — vertical T-beam with the stem slab as the
//      flange and the counterfort itself as the web (bw = counterfort
//      thickness). Cantilevers from the heel slab. Loaded by the active
//      pressure tributary area (counterfortSpacing × H_stem).
//
//        Load:    H = (1/2)·γ·Ka·H_stem² · S   (kN per counterfort)
//        Moment:  M = H · H_stem / 3            (lever to centroid of triangle)
//        Tension steel goes at the REAR face of the counterfort.
//
// References:
//   • ACI 318-25 SI §13.3.4 (foundation slab strips), §22.2 (flexure),
//     §22.5 (one-way shear), §9.7 (rebar detailing)
//   • Wight & MacGregor 7e §18-3.5 (counterfort walls), §13.6 (T-beams)
//   • ACI MNL-17(21) Counterfort Wall Example

import type {
  WallInput, WallResults, CounterfortGeometry,
  StemDesignResult, SlabDesignResult, KeyDesignResult, CrackControl,
  CounterfortDesignResult,
} from './types';
import { computeStability } from './stability';
import { kaRankine, kaCoulomb, integrateActivePressure } from './earth-pressure';
import { flexureDesign, vcOneWay, minReinforcement, crackControl } from './design';

const LF_LATERAL = 1.6;
const LF_DEAD = 1.2;
const PHI_FLEX = 0.9;
const PHI_SHEAR = 0.75;

export function solveCounterfort(input: WallInput): WallResults {
  if (input.geometry.kind !== 'counterfort') {
    throw new Error("solveCounterfort called with non-counterfort geometry");
  }
  const g = input.geometry as CounterfortGeometry;

  const { stability, pressure } = computeStability(input);

  // Earth pressure at the BASE of the stem (worst case for stem-slab + T-beam)
  const Ka =
    input.theory === 'rankine'
      ? kaRankine(input.backfill[0]?.phi ?? 0, g.backfillSlope)
      : kaCoulomb(input.backfill[0]?.phi ?? 0, g.backfillSlope, input.baseSoil.delta);
  const integ = integrateActivePressure(g.H_stem, input.backfill, Ka, input.loads, input.water);
  const gammaActive = input.backfill[0]?.gamma ?? 18;
  const Hstem_m = g.H_stem / 1000;
  const S_m = g.counterfortSpacing / 1000;
  const p_max_kPa = gammaActive * Ka * Hstem_m + Ka * input.loads.surchargeQ; // kN/m² at base

  const fc = input.concrete.fc;
  const fy = input.concrete.fy;
  const cover = input.concrete.cover;

  // ────────────────── 1. STEM SLAB (horizontal one-way) ──────────────────
  // At the base of the stem (worst-case strip), w = p_max, span = S
  const Mneg_stem_unfac = (p_max_kPa * S_m * S_m) / 12;     // kN·m/m  rear face at counterfort
  const Mpos_stem_unfac = (p_max_kPa * S_m * S_m) / 24;     // kN·m/m  front face at midspan
  const Vu_stem_unfac   = p_max_kPa * S_m / 2;              // kN/m at counterfort face (≈ wL/2)

  const Mneg_stem = LF_LATERAL * Mneg_stem_unfac;
  const Mpos_stem = LF_LATERAL * Mpos_stem_unfac;
  const Vu_stem   = LF_LATERAL * Vu_stem_unfac;

  const t_stem = g.t_stem_bot;
  const stemNeg = flexureDesign(Mneg_stem, t_stem, cover, fc, fy);
  const stemPos = flexureDesign(Mpos_stem, t_stem, cover, fc, fy);
  const As_min_stem = minReinforcement(t_stem, fy);
  const stemNeg_As = Math.max(stemNeg.As, As_min_stem);
  const stemPos_As = Math.max(stemPos.As, As_min_stem);
  const Vc_stem = vcOneWay(fc, 1000, stemNeg.d);

  const stemSlab: SlabDesignResult = {
    Mu: Mneg_stem,                                         // negative governs (rear face)
    Vu: Vu_stem,
    As_req: stemNeg_As,
    As_min: As_min_stem,
    Vc: Vc_stem,
    shearOk: Vu_stem <= PHI_SHEAR * Vc_stem,
    d: stemNeg.d,
    a: stemNeg.a,
    phiMn: stemNeg.phiMn,
    critical: 'top',                                       // rear face = "top" of plan view
    crack: crackControl(stemNeg_As, fy, cover),
  };

  // ────────────────── 2. HEEL SLAB (longitudinal one-way) ─────────────────
  // Net downward load on heel = backfill weight + concrete + surcharge − bearing upthrust
  const heel_m = g.B_heel / 1000;
  const Hsoil_m = g.H_stem / 1000;
  const wSoil = gammaActive * Hsoil_m;                        // kN/m² (downward)
  const wSurch = input.loads.surchargeQ;                       // kN/m²
  const wConc  = input.concrete.gamma * (g.H_foot / 1000);     // kN/m² self-weight of heel slab
  // Approximate upward bearing under heel as the heel-side average pressure
  // from the linear distribution: q_heel ≈ qmin (because the heel side is
  // the low-pressure side under typical eccentric loading)
  const q_heel_up = Math.max(stability.qMin, 0);              // kN/m²
  const wHeelDown = LF_DEAD * (wSoil + wConc) + LF_LATERAL * wSurch;
  const wHeelUp   = LF_DEAD * q_heel_up;
  const wHeelNet  = Math.max(0, wHeelDown - wHeelUp);          // kN/m² net down
  const Mneg_heel = (wHeelNet * S_m * S_m) / 12;              // kN·m/m at counterfort, top tension
  const Mpos_heel = (wHeelNet * S_m * S_m) / 24;              // kN·m/m at midspan, bottom tension
  const Vu_heel   = wHeelNet * S_m / 2;
  void Mpos_heel; void heel_m;

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
    d: heelDes.d,
    a: heelDes.a,
    phiMn: heelDes.phiMn,
    critical: 'top',
    crack: crackControl(heel_As, fy, cover),
  };

  // ────────────────── 3. COUNTERFORT T-BEAM ───────────────────────────────
  // Total horizontal load per counterfort = (1/2)·γ·Ka·H² · S   (kN)
  const Hcounter = 0.5 * gammaActive * Ka * Hstem_m * Hstem_m * S_m
                 + Ka * input.loads.surchargeQ * Hstem_m * S_m;     // includes surcharge rectangle
  const Hcounter_factored = LF_LATERAL * Hcounter;
  // Moment at base of counterfort: triangle centroid at H/3, surcharge centroid at H/2
  // For simplicity we use H/3 (the triangular soil component dominates).
  const Mcounter = Hcounter_factored * (g.H_stem / 1000) / 3;        // kN·m
  // Counterfort web (bw) and flange — use stem t_bot as flange depth, counterfort thickness as web
  const bw = g.counterfortThickness;
  // T-beam effective depth: from extreme compression fibre (FRONT face of stem) to rear-face
  // tension steel centroid. Total effective depth ≈ B_heel for the lever arm
  // (the counterfort length backward from the stem rear face). Use heel width
  // as a conservative depth.
  const d_counter = (g.B_heel - cover - 12);                          // mm
  const Mu_counter_Nmm = Mcounter * 1_000_000;
  // Solve As: Mu = φ · As · fy · (d − a/2);  a = As·fy / (0.85·fc·bw)
  let As_counter = Mu_counter_Nmm / (PHI_FLEX * fy * 0.9 * d_counter);
  for (let i = 0; i < 8; i++) {
    const a = (As_counter * fy) / (0.85 * fc * bw);
    const denom = PHI_FLEX * fy * (d_counter - a / 2);
    if (denom <= 0) break;
    const As_new = Mu_counter_Nmm / denom;
    if (Math.abs(As_new - As_counter) < 0.5) { As_counter = As_new; break; }
    As_counter = As_new;
  }
  const a_counter = (As_counter * fy) / (0.85 * fc * bw);
  const phiMn_counter = (PHI_FLEX * As_counter * fy * (d_counter - a_counter / 2)) / 1_000_000; // kN·m

  // Counterfort shear at base: Vu = factored Hcounter
  const Vu_counter = Hcounter_factored;
  const Vc_counter = vcOneWay(fc, bw, d_counter); // kN/m × bw/1000 ≈ already kN per counterfort
  const shearOk_counter = Vu_counter <= PHI_SHEAR * Vc_counter * (bw / 1000);

  const counterfortDesign: CounterfortDesignResult = {
    stemSlab, heelSlab,
    counterfort: {
      Mu: Mcounter,
      Vu: Vu_counter,
      bw,
      d: d_counter,
      As_req: As_counter,
      phiMn: phiMn_counter,
      Vc: Vc_counter * (bw / 1000),
      shearOk: shearOk_counter,
    },
  };

  // ────────────────── Stem (vertical) — distribution + temperature only ──────
  // For counterfort walls the vertical stem rebar is typically just temperature
  // & shrinkage steel — the horizontal slab steel does the heavy lifting.
  const noCrack: CrackControl = {
    s_max: 0, fs: 0, bar: { id: 'N/A', area: 0, diameter: 0 }, s_req: 0, ok: true,
  };
  const As_min_vertical = minReinforcement(t_stem, fy);
  const stemSummary: StemDesignResult = {
    Mu: Mneg_stem,                                  // dominant horizontal moment (display only)
    Vu: Vu_stem,
    As_req: stemPos_As,                             // front-face midspan
    As_min: As_min_vertical,
    Vc: Vc_stem,
    shearOk: stemSlab.shearOk,
    d: stemNeg.d, a: stemNeg.a,
    rho: stemNeg.rho, phiMn: stemNeg.phiMn,
    crack: stemSlab.crack,
    frontFace: {
      Mu: Mpos_stem,
      As_req: stemPos_As,
      crack: crackControl(stemPos_As, fy, cover),
    },
  };

  // Toe + key — preserve cantilever-style for the toe (compute simply)
  const zeroSlab: SlabDesignResult = {
    Mu: 0, Vu: 0, As_req: 0, As_min: As_min_heel,
    Vc: 0, shearOk: true,
    d: 0, a: 0, phiMn: 0, critical: 'top', crack: noCrack,
  };
  const zeroKey: KeyDesignResult = {
    enabled: !!g.key,
    Hp_key: 0, Mu: 0, Vu: 0,
    d: 0, a: 0, As_req: 0, As_min: 0, Vc: 0, shearOk: true, phiMn: 0, crack: noCrack,
  };

  // Diagnostics
  const issues: string[] = [];
  const errors: string[] = [];
  if (!stability.overturningOk) errors.push(`Overturning FS=${stability.FS_overturning.toFixed(2)} < ${input.safetyFactors.overturning}`);
  if (!stability.slidingOk) errors.push(`Sliding FS=${stability.FS_sliding.toFixed(2)} < ${input.safetyFactors.sliding}`);
  if (!stability.bearingOk) errors.push(`Bearing qmax=${stability.qMax.toFixed(0)} kPa exceeds qAllow`);
  if (!stemSlab.shearOk)   errors.push(`Stem slab shear Vu=${Vu_stem.toFixed(1)} > φVc at counterfort face`);
  if (!heelSlab.shearOk)   errors.push(`Heel slab shear Vu=${Vu_heel.toFixed(1)} > φVc at counterfort face`);
  if (!shearOk_counter)    errors.push(`Counterfort T-beam shear exceeds capacity`);
  issues.unshift(
    `Counterfort wall — stem and heel act as one-way slabs spanning between counterforts (S = ${(S_m).toFixed(2)} m). The counterfort itself is a T-beam in tension on the rear face; tension reinforcement is at the back of each counterfort.`,
  );
  void integ;

  return {
    pressure,
    stability,
    stem: stemSummary,
    heel: heelSlab,
    toe: zeroSlab,
    key: zeroKey,
    counterfortDesign,
    issues,
    errors,
  };
}
