// Gravity-wall solver — mass concrete, NO tensile reinforcement reliance.
//
// Stability is identical to the cantilever case (sliding, overturning,
// bearing all from `computeStability`). What's different is the wall-body
// check: instead of designing flexure / shear steel in the stem and footing,
// we verify combined axial + flexure stress at the most-critical horizontal
// section (the base of the stem, just above the footing) per:
//
//   ACI 318-25 §14.5.4 — Plain concrete, combined flexure and axial:
//     • Compression face:  fa + fb ≤ φ · 0.45 · f'c
//     • Tension face:      fa − fb ≤ φ · 0.42 · √f'c   (modulus of rupture)
//   where  fa = Nu / Ag,  fb = Mu / Sm,  φ = 0.60 (plain concrete).
//
//   ACI 318-19 §14.5.2 has the same form (renumbered in 318-25).
//
// References:
//   • ACI 318-25 SI, Chapter 14 "Plain Concrete"
//   • Wight & MacGregor 7e §17.3 "Gravity walls"

import type {
  WallInput, WallResults,
  GravityGeometry,
  StemDesignResult, SlabDesignResult, KeyDesignResult, CrackControl,
} from './types';
import { computeStability } from './stability';
import { kaRankine, kaCoulomb, integrateActivePressure } from './earth-pressure';

const PHI_PLAIN = 0.60;             // ACI 318-25 §21.2.1 (plain concrete)
const COMPRESSION_LIMIT = 0.45;     // §14.5.4.1
const MODULUS_OF_RUPTURE = 0.42;    // §14.5.4.1 — fr = 0.42·λ·√f'c (MPa)

export function solveGravity(input: WallInput): WallResults {
  if (input.geometry.kind !== 'gravity') {
    throw new Error("solveGravity called with non-gravity geometry");
  }
  const g = input.geometry as GravityGeometry;
  const { stability, pressure } = computeStability(input);

  // ──────────────── Plain-concrete stress at base of stem ────────────────
  // We check the horizontal section at the top of the footing (base of stem).
  // Per unit length of wall:
  //   • Axial compression Nu = factored stem self-weight above this section
  //   • Moment Mu = factored earth-pressure moment about the same section
  //   • Section: rectangular, width = 1000 mm, depth = t_stem_bot
  //
  // Load factors per ACI 318-25 §5.3:
  //   • 1.2 D for dead load (self-weight)
  //   • 1.6 H for lateral earth load
  const fc = input.concrete.fc;
  const lambda = 1.0;                  // normal weight; lightweight not supported here

  // Stem self-weight above the section, per metre of wall
  const tAvg_m = (g.t_stem_top + g.t_stem_bot) / 2 / 1000; // m
  const Hstem_m = g.H_stem / 1000;
  const Wstem = input.concrete.gamma * tAvg_m * Hstem_m;   // kN/m
  const Nu = 1.2 * Wstem;                                  // factored axial (kN/m)

  // Moment from earth pressure about the same section
  const Ka =
    input.theory === 'rankine'
      ? kaRankine(input.backfill[0]?.phi ?? 0, g.backfillSlope)
      : kaCoulomb(input.backfill[0]?.phi ?? 0, g.backfillSlope, input.baseSoil.delta);
  const integ = integrateActivePressure(g.H_stem, input.backfill, Ka, input.loads, input.water);
  const H_drive = integ.Pa + integ.Pq + integ.Pw + integ.dPae;
  const yBar_m = integ.yBar / 1000;
  const Mu = 1.6 * H_drive * yBar_m;                       // kN·m / m

  // Section properties (rectangular, per metre)
  const t = g.t_stem_bot;                                  // mm
  const Ag_mm2 = 1000 * t;                                 // mm²
  const Sm_mm3 = (1000 * t * t) / 6;                       // mm³

  // Convert factored loads to N and N·mm
  const Nu_N = Nu * 1000;                                  // kN → N
  const Mu_Nmm = Mu * 1_000_000;                           // kN·m → N·mm

  // Stresses (MPa)
  const fa = Nu_N / Ag_mm2;                                // MPa, compression positive
  const fb = Mu_Nmm / Sm_mm3;                              // MPa
  const sigma_compression = fa + fb;                       // MPa
  const sigma_tension     = fa - fb;                       // MPa, can be negative (= net tension)

  // Allowable stresses (ACI 318-25 §14.5.4.1)
  const sigma_compression_allow = PHI_PLAIN * COMPRESSION_LIMIT * fc;            // MPa
  const sigma_tension_allow     = PHI_PLAIN * MODULUS_OF_RUPTURE * lambda * Math.sqrt(fc); // MPa
  // Tension face is OK if  fa − fb ≥ −sigma_tension_allow  (allow modest tension up to fr)

  const compressionOk = sigma_compression <= sigma_compression_allow + 1e-6;
  const tensionOk     = sigma_tension >= -sigma_tension_allow - 1e-6;
  const sigma_max_kPa = sigma_compression * 1000;          // MPa → kPa for display
  const sigma_min_kPa = sigma_tension * 1000;
  const sigma_allow_kPa = sigma_compression_allow * 1000;

  // ──────────────── Dummy member-design results ─────────────────────────
  // Gravity walls don't rely on tensile rebar; we return zeroed StemDesignResult
  // (and similarly heel/toe/key) so the type contract is satisfied. The print
  // report and the Design tab branch on `kind === 'gravity'` to render
  // `gravityStress` instead of the rebar-design table.
  const noCrack: CrackControl = {
    s_max: 0, fs: 0,
    bar: { id: 'N/A', area: 0, diameter: 0 },
    s_req: 0, ok: true,
  };
  const zeroStem: StemDesignResult = {
    Mu, Vu: H_drive * 1.6,
    As_req: 0, As_min: 0, Vc: 0, shearOk: true,
    d: 0, a: 0, rho: 0, phiMn: 0,
    crack: noCrack,
  };
  const zeroSlab: SlabDesignResult = {
    Mu: 0, Vu: 0, As_req: 0, As_min: 0,
    Vc: 0, shearOk: true,
    d: 0, a: 0, phiMn: 0,
    critical: 'top',
    crack: noCrack,
  };
  const zeroKey: KeyDesignResult = {
    enabled: !!g.key,
    Hp_key: 0, Mu: 0, Vu: 0,
    d: 0, a: 0,
    As_req: 0, As_min: 0, Vc: 0, shearOk: true, phiMn: 0,
    crack: noCrack,
  };

  // ──────────────── Diagnostics ─────────────────────────────────────────
  const issues: string[] = [];
  const errors: string[] = [];
  if (!stability.overturningOk)
    errors.push(`Overturning FS=${stability.FS_overturning.toFixed(2)} < ${input.safetyFactors.overturning}`);
  if (!stability.slidingOk)
    errors.push(`Sliding FS=${stability.FS_sliding.toFixed(2)} < ${input.safetyFactors.sliding}`);
  if (!stability.bearingOk)
    errors.push(`Bearing qmax=${stability.qMax.toFixed(0)} kPa > qAllow=${input.baseSoil.qAllow} kPa`);
  if (!stability.eccentricityOk) {
    const lim = input.safetyFactors.eccentricity === 'kern' ? 'B/6' : 'B/3';
    issues.push(`Eccentricity e=${stability.eccentricity.toFixed(0)} mm outside ${lim} — heel lifts off soil (gravity wall: avoid)`);
  }
  if (!compressionOk) {
    errors.push(
      `Wall body compression σ=${sigma_compression.toFixed(2)} MPa exceeds φ·0.45·f'c = ${sigma_compression_allow.toFixed(2)} MPa (ACI 318-25 §14.5.4.1)`,
    );
  }
  if (!tensionOk) {
    errors.push(
      `Wall body tension σ=${(-sigma_tension).toFixed(2)} MPa exceeds φ·0.42·λ·√f'c = ${sigma_tension_allow.toFixed(2)} MPa — gravity wall would crack (ACI 318-25 §14.5.4.1)`,
    );
  }

  return {
    pressure,
    stability,
    stem: zeroStem,
    heel: zeroSlab,
    toe: zeroSlab,
    key: zeroKey,
    gravityStress: {
      sigma_max: sigma_max_kPa,
      sigma_min: sigma_min_kPa,
      sigma_allow: sigma_allow_kPa,
      ok: compressionOk && tensionOk,
    },
    issues,
    errors,
  };
}
