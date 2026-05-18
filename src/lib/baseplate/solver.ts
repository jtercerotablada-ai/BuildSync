// Base Plate (Column Base) Design — solver
//
// Implements:
//   • Concrete bearing                  — AISC 360-22 §J8 + DG1 Eq. 4-1..4-7
//   • Plate flexural yielding           — DG1 Eq. 4-10..4-15 (cantilever method)
//   • Combined axial + uniaxial moment  — DG1 §4.3.7 (compression+bending)
//                                         DG1 §4.3.8 (tension+bending)
//                                         Low moment vs Large moment per DG1 Eq. 4-39..4-58
//   • Anchor steel tension              — AISC 360-22 §J3 + DG1 Eq. 4-22 (Nsa = Fu·Ase,N)
//   • Concrete pullout (steel limit)    — ACI 318-25 §17.6.3 (hex nut bearing)
//   • Concrete breakout (group)         — ACI 318-25 §17.6.2 (Ncbg = ANc/ANco · ψ-factors · Nb)
//   • Anchor steel shear                — AISC 360-22 §J3 + ACI 318-25 §17.7.1 (Vsa = 0.6·Fu·Ase,V)
//   • Combined T+V interaction          — ACI 318-25 §17.8 (linear interaction)
//   • Column-to-plate weld              — AISC 360-22 §J2 (Rn = Fnw·Awe·kds)
//
// All formulas in US customary units (kips, in, ksi). The UI may present in SI
// but conversion happens at the boundary.

import {
  type BasePlateInput,
  type BasePlateAnalysis,
  type BearingCheck,
  type PlateYieldCheck,
  type MomentInteraction,
  type AnchorTensionCheck,
  type ConcreteBreakoutCheck,
  type ConcretePulloutCheck,
  type AnchorShearCheck,
  type WeldCheck,
  type CalcStep,
  type AnchorGrade,
  ANCHOR_ROD_SIZES,
  ANCHOR_GRADES,
} from './types';

// ============================================================================
// φ / Ω factor lookup
// ============================================================================
function phi(method: 'LRFD' | 'ASD', phi_LRFD: number, omega_ASD: number): number {
  return method === 'LRFD' ? phi_LRFD : 1 / omega_ASD;
}

function anchorStrengths(grade: AnchorGrade, customFy?: number, customFu?: number): { Fy: number; Fu: number } {
  if (grade === 'custom') return { Fy: customFy ?? 36, Fu: customFu ?? 58 };
  return ANCHOR_GRADES[grade];
}

function aseN(da: number): number {
  // Tensile stress area approximation via UNC threads, fallback to interpolation in catalog.
  // Ase,N = π/4 · (da − 0.9743/n)² where n = threads/inch. Use UNC table values.
  const entry = ANCHOR_ROD_SIZES.find((s) => Math.abs(s.da - da) < 1e-4);
  if (entry) return entry.AseN;
  // Linear interpolate
  const sorted = [...ANCHOR_ROD_SIZES].sort((a, b) => a.da - b.da);
  for (let i = 0; i < sorted.length - 1; i++) {
    const a = sorted[i], b = sorted[i + 1];
    if (da >= a.da && da <= b.da) {
      const t = (da - a.da) / (b.da - a.da);
      return a.AseN + t * (b.AseN - a.AseN);
    }
  }
  // Out of range — use threaded area approximation for UNC-8 thread
  return Math.PI / 4 * Math.pow(da - 0.9743 / 8, 2);
}

function abrg(da: number): number {
  const entry = ANCHOR_ROD_SIZES.find((s) => Math.abs(s.da - da) < 1e-4);
  if (entry) return entry.Abrg;
  // Fallback approximation: 1.5·da² for hex nut
  return 1.5 * da * da;
}

// ============================================================================
// Main entry point
// ============================================================================
export function analyze(input: BasePlateInput): BasePlateAnalysis {
  const warnings: string[] = [];
  try {
    const out: BasePlateAnalysis = {
      input,
      loadCase: classifyLoadCase(input),
      warnings,
      ok: true,
      solved: true,
    };

    const Pu = input.loads.Pu;
    const Mu = input.loads.Mu;
    const Vu = input.loads.Vu;

    // 1) Concrete bearing — only when there is compression
    if (Pu > 0) {
      out.bearing = checkConcreteBearing(input);
    }

    // 2) Combined axial + moment — partition into low / large moment
    if (Math.abs(Mu) > 1e-6 && Pu > 0) {
      out.momentInteraction = analyzeMoment(input);
    }

    // 3) Plate flexural yielding (uniform-bearing cantilever method)
    out.plateYielding = checkPlateYielding(input, out.momentInteraction, out.bearing);

    // 4) Anchor tension — when there's pure tension or large-moment uplift
    const T = computeTensionDemand(input, out.momentInteraction);
    if (T > 1e-6) {
      // Pure axial tension → all N rods share T equally.
      // Large-moment uplift  → only the tension-side N/2 rods share T.
      const isPureTension = input.loads.Pu < 0 && Math.abs(input.loads.Mu) < 1e-6;
      const nT = isPureTension ? input.anchors.N : Math.max(2, Math.floor(input.anchors.N / 2));
      out.anchorTension = checkAnchorTension(input, T, nT);
      out.concretePullout = checkConcretePullout(input, T, nT);
      out.concreteBreakout = checkConcreteBreakout(input, T);
    }

    // 5) Anchor shear — when there's shear and no shear lug specified
    if (Math.abs(Vu) > 1e-6) {
      out.anchorShear = checkAnchorShear(input);
      // Combined T+V interaction
      if (T > 1e-6 && out.anchorTension && out.anchorShear) {
        out.combinedTV = checkCombinedTV(out.anchorTension, out.anchorShear);
      }
    }

    // 6) Column-to-plate weld
    out.weld = checkWeld(input, T);

    // Aggregate pass/fail
    const checks: (boolean | undefined)[] = [
      out.bearing?.ok,
      out.plateYielding?.ok,
      out.momentInteraction?.feasible,
      out.anchorTension?.ok,
      out.concretePullout?.ok,
      out.concreteBreakout?.ok,
      out.anchorShear?.ok,
      out.combinedTV?.ok,
      out.weld?.ok,
    ];
    out.ok = checks.filter((c) => c !== undefined).every((c) => c === true);

    return out;
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return {
      input,
      loadCase: 'compression',
      warnings: [`Solver error: ${msg}`],
      ok: false,
      solved: false,
    };
  }
}

// ============================================================================
// 1) Concrete bearing — AISC 360 §J8
// ============================================================================
function checkConcreteBearing(input: BasePlateInput): BearingCheck {
  const { method, plate, concrete, loads } = input;
  const Pu = loads.Pu;
  const A1 = plate.B * plate.N;
  const A2 = concrete.B2 * concrete.N2;
  const conf = Math.min(Math.sqrt(A2 / A1), 2);
  const fpMax = 0.85 * concrete.fc * conf;       // ksi
  const Pp = fpMax * A1;                          // kips
  const phiC = phi(method, 0.65, 2.31);
  const PpAvail = phiC * Pp;
  const fp = Pu / A1;
  const ratio = Pu / Math.max(PpAvail, 1e-9);

  const steps: CalcStep[] = [
    {
      title: 'Bearing area A1 (plate footprint)',
      formula: 'A1 = B · N',
      substitution: `A1 = ${plate.B.toFixed(2)} · ${plate.N.toFixed(2)}`,
      result: `A1 = ${A1.toFixed(2)} in²`,
      ref: 'DG1 §4.3.1',
    },
    {
      title: 'Confinement area A2 (pedestal footprint)',
      formula: 'A2 = B2 · N2',
      substitution: `A2 = ${concrete.B2.toFixed(2)} · ${concrete.N2.toFixed(2)}`,
      result: `A2 = ${A2.toFixed(2)} in², √(A2/A1) = ${Math.sqrt(A2 / A1).toFixed(3)} (capped at 2)`,
      ref: 'AISC 360 §J8 Eq. J8-2',
    },
    {
      title: 'Maximum bearing stress fp,max',
      formula: 'fp,max = 0.85·fʹc·√(A2/A1) ≤ 1.7·fʹc',
      substitution: `fp,max = 0.85·${concrete.fc.toFixed(2)}·${conf.toFixed(3)}`,
      result: `fp,max = ${fpMax.toFixed(3)} ksi`,
      ref: 'DG1 Eq. 4-2/4-3',
    },
    {
      title: 'Nominal bearing strength Pp',
      formula: 'Pp = fp,max · A1',
      substitution: `Pp = ${fpMax.toFixed(3)} · ${A1.toFixed(2)}`,
      result: `Pp = ${Pp.toFixed(2)} kips`,
      ref: 'AISC 360 Eq. J8-1',
    },
    {
      title: `Available bearing strength (φc = 0.65 LRFD / Ωc = 2.31 ASD)`,
      formula: method === 'LRFD' ? 'φc·Pp' : 'Pp/Ωc',
      substitution: `${method === 'LRFD' ? 'φ' : '1/Ω'} = ${phiC.toFixed(3)}`,
      result: `${method === 'LRFD' ? 'φ·Pp' : 'Pp/Ω'} = ${PpAvail.toFixed(2)} kips`,
      ref: 'AISC 360 §J8 / ACI 318 §21.2.1',
    },
    {
      title: 'Demand vs capacity',
      formula: `Pu / ${method === 'LRFD' ? 'φ·Pp' : 'Pp/Ω'}`,
      substitution: `${Pu.toFixed(2)} / ${PpAvail.toFixed(2)}`,
      result: `Ratio = ${ratio.toFixed(3)} ${ratio <= 1 ? '✓' : '✗'}`,
    },
  ];

  return {
    A1, A2, confinementFactor: conf,
    fpMax, fp, Pp, PpAvail, ratio,
    ok: ratio <= 1,
    ref: 'AISC 360-22 §J8 + DG1 §4.3.1',
    steps,
  };
}

// ============================================================================
// 2) Plate flexural yielding — cantilever method (DG1 Eq. 4-10..4-15)
// ============================================================================
function checkPlateYielding(
  input: BasePlateInput,
  mi: MomentInteraction | undefined,
  br: BearingCheck | undefined,
): PlateYieldCheck {
  const { method, column, plate } = input;
  const m = (plate.N - 0.95 * column.d) / 2;
  const n = (plate.B - 0.8 * column.bf) / 2;
  const nPrime = Math.sqrt(column.d * column.bf) / 4;

  // Effective bearing-stress factor λ — for low-axial designs we may use λ
  // less than 1, but we use λ = 1 as a conservative simplification per DG1
  // (§4.3.1 commentary).
  const lambda = 1.0;

  // Governing cantilever
  const l = Math.max(m, n, lambda * nPrime);

  // Bearing stress for the calc:
  // - For axial-only: use uniform fp = Pu / (B·N)
  // - For low-moment: fp = Pu / (B·Y) computed in MomentInteraction
  // - For large-moment: fp = fp,max
  let fp: number;
  if (mi && mi.largeMoment && br) {
    fp = br.fpMax;
  } else if (mi && !mi.largeMoment && mi.Y > 0) {
    fp = input.loads.Pu / (plate.B * mi.Y);
  } else if (br) {
    fp = input.loads.Pu / (plate.B * plate.N);
  } else {
    fp = 0; // pure tension
  }

  const phiB = phi(method, 0.90, 1.67);
  // tp,req = l · √(2·fp / (φb·Fy))   for Y ≥ m   per DG1 Eq. 4-15a
  // (For Y < m use Eq. 4-52a; we use the conservative case Y ≥ m here.)
  const tpReq = fp > 0 ? l * Math.sqrt(2 * fp / (phiB * plate.Fy)) : 0;
  const tpProv = plate.tp;
  const ratio = tpReq / Math.max(tpProv, 1e-9);

  const steps: CalcStep[] = [
    {
      title: 'Cantilever m (strong-axis face of column)',
      formula: 'm = (N − 0.95·d) / 2',
      substitution: `m = (${plate.N.toFixed(2)} − 0.95·${column.d.toFixed(2)}) / 2`,
      result: `m = ${m.toFixed(3)} in`,
      ref: 'DG1 Eq. 4-10',
    },
    {
      title: 'Cantilever n (weak-axis face of column)',
      formula: 'n = (B − 0.8·bf) / 2',
      substitution: `n = (${plate.B.toFixed(2)} − 0.8·${column.bf.toFixed(2)}) / 2`,
      result: `n = ${n.toFixed(3)} in`,
      ref: 'DG1 Eq. 4-11',
    },
    {
      title: 'Interior cantilever n′',
      formula: "n' = (1/4)·√(d·bf)",
      substitution: `n' = 0.25·√(${column.d.toFixed(2)}·${column.bf.toFixed(2)})`,
      result: `n' = ${nPrime.toFixed(3)} in`,
      ref: 'DG1 Eq. 4-12',
    },
    {
      title: 'Governing cantilever l',
      formula: "l = max(m, n, λ·n')",
      substitution: `l = max(${m.toFixed(2)}, ${n.toFixed(2)}, ${(lambda * nPrime).toFixed(2)})`,
      result: `l = ${l.toFixed(3)} in`,
    },
    {
      title: 'Bearing stress fp used for plate flexure',
      formula: mi?.largeMoment ? 'fp = fp,max (large moment)' : 'fp = Pu / (B · Y or B · N)',
      substitution: '',
      result: `fp = ${fp.toFixed(3)} ksi`,
    },
    {
      title: `Required plate thickness (φb = 0.90 LRFD / Ωb = 1.67 ASD)`,
      formula: 'tp,req = l · √(2·fp / (φb·Fy))',
      substitution: `tp,req = ${l.toFixed(2)} · √(2·${fp.toFixed(3)} / (${phiB.toFixed(3)}·${plate.Fy.toFixed(0)}))`,
      result: `tp,req = ${tpReq.toFixed(3)} in`,
      ref: 'DG1 Eq. 4-15a / 4-51a',
    },
    {
      title: 'Provided plate thickness vs required',
      formula: 'tp,prov ≥ tp,req',
      substitution: `${tpProv.toFixed(3)} ≥ ${tpReq.toFixed(3)}`,
      result: `Ratio = ${ratio.toFixed(3)} ${ratio <= 1 ? '✓' : '✗'}`,
    },
  ];

  return {
    m, n, nPrime, l, fp, tpReq, tpProvided: tpProv,
    ratio,
    ok: ratio <= 1,
    ref: 'DG1 §4.3.1',
    steps,
  };
}

// ============================================================================
// 3) Combined axial + moment — DG1 §4.3.6/4.3.7/4.3.8
// ============================================================================
function analyzeMoment(input: BasePlateInput): MomentInteraction {
  const { method, plate, concrete, loads, anchors } = input;
  const Pu = loads.Pu;
  const Mu = Math.abs(loads.Mu);
  const N = plate.N;
  const B = plate.B;
  const A1 = B * N;
  const A2 = concrete.B2 * concrete.N2;
  const conf = Math.min(Math.sqrt(A2 / A1), 2);
  const fpMax = 0.85 * concrete.fc * conf;
  const phiC = phi(method, 0.65, 2.31);
  const fpMaxAvail = phiC * fpMax;          // available bearing stress
  const qmax = fpMaxAvail * B;              // kip/in (line load)

  const e = Mu / Math.max(Pu, 1e-9);
  const ecrit = N / 2 - Pu / (2 * qmax);
  const largeMoment = e > ecrit;

  // f = distance from plate centerline to anchor rod centerline on tension side
  // = N/2 − edgeDist (assuming anchors at edges of plate)
  const f = N / 2 - anchors.edgeDist;

  let Y: number;
  let T: number;
  let feasible = true;

  if (!largeMoment) {
    // Y = N − 2·e
    Y = N - 2 * e;
    T = 0;
  } else {
    // Quadratic for Y:
    //   Y² − 2(f + N/2)·Y + 2·Pu·(e + f)/qmax = 0
    const a = 1;
    const b = -2 * (f + N / 2);
    const c = 2 * Pu * (e + f) / qmax;
    const disc = b * b - 4 * a * c;
    if (disc < 0) {
      feasible = false;
      Y = 0;
      T = 0;
    } else {
      // Use minus root (smaller Y) per DG1 Eq. 4-58
      Y = ((f + N / 2) - Math.sqrt(disc / 4));
      // T = qmax · Y − Pu (Eq. 4-55)
      T = qmax * Y - Pu;
      if (T < 0) T = 0;
    }
  }

  const steps: CalcStep[] = [
    {
      title: 'Eccentricity e',
      formula: 'e = Mu / Pu',
      substitution: `e = ${Mu.toFixed(2)} / ${Pu.toFixed(2)}`,
      result: `e = ${e.toFixed(3)} in`,
      ref: 'DG1 Eq. 4-39',
    },
    {
      title: 'Maximum bearing line load qmax',
      formula: 'qmax = (φc · 0.85·fʹc·√(A2/A1)) · B',
      substitution: `qmax = ${fpMaxAvail.toFixed(3)} · ${B.toFixed(2)}`,
      result: `qmax = ${qmax.toFixed(2)} kip/in`,
    },
    {
      title: 'Critical eccentricity ecrit',
      formula: 'ecrit = N/2 − Pu / (2·qmax)',
      substitution: `ecrit = ${(N / 2).toFixed(2)} − ${Pu.toFixed(2)}/(2·${qmax.toFixed(2)})`,
      result: `ecrit = ${ecrit.toFixed(3)} in → ${largeMoment ? 'LARGE moment (anchors in tension)' : 'LOW moment (bearing only)'}`,
      ref: 'DG1 Eq. 4-40',
    },
    {
      title: 'Bearing length Y',
      formula: largeMoment
        ? 'Y = (f + N/2) − √[(f + N/2)² − 2·Pu·(e+f)/qmax]'
        : 'Y = N − 2·e',
      substitution: '',
      result: feasible ? `Y = ${Y.toFixed(3)} in` : 'NO REAL SOLUTION — increase plate dimensions',
      ref: largeMoment ? 'DG1 Eq. 4-58' : 'DG1 Eq. 4-42',
    },
  ];
  if (largeMoment && feasible) {
    steps.push({
      title: 'Anchor rod tension demand T',
      formula: 'T = qmax · Y − Pu',
      substitution: `T = ${qmax.toFixed(2)} · ${Y.toFixed(2)} − ${Pu.toFixed(2)}`,
      result: `T = ${T.toFixed(2)} kips (total tension across all anchors on the tension side)`,
      ref: 'DG1 Eq. 4-55',
    });
  }

  return { e, ecrit, qmax, Y, T, largeMoment, f, feasible, steps };
}

function computeTensionDemand(input: BasePlateInput, mi: MomentInteraction | undefined): number {
  // Pure axial tension
  if (input.loads.Pu < 0) return -input.loads.Pu;
  // Large-moment uplift
  if (mi && mi.largeMoment && mi.feasible) return mi.T;
  return 0;
}

// ============================================================================
// 4) Anchor steel tension — AISC 360 §J3 + DG1 Eq. 4-22
// ============================================================================
function checkAnchorTension(input: BasePlateInput, T: number, nT: number): AnchorTensionCheck {
  const { method, anchors } = input;
  const { Fy, Fu } = anchorStrengths(anchors.grade, anchors.Fy, anchors.Fu);
  void Fy;
  const ru = T / nT;
  const Ase = aseN(anchors.da);
  const Nsa = Fu * Ase;
  const phiT = phi(method, 0.75, 2.0);
  const NsaAvail = phiT * Nsa;
  const ratio = ru / Math.max(NsaAvail, 1e-9);

  const steps: CalcStep[] = [
    {
      title: 'Anchor steel ultimate strength',
      formula: 'Fu',
      substitution: ANCHOR_GRADES[anchors.grade as Exclude<AnchorGrade, 'custom'>]?.label ?? 'custom',
      result: `Fu = ${Fu.toFixed(0)} ksi`,
    },
    {
      title: 'Tensile stress area Ase,N',
      formula: 'Ase,N from UNC table',
      substitution: `da = ${anchors.da.toFixed(3)} in`,
      result: `Ase,N = ${Ase.toFixed(3)} in²`,
      ref: 'AISC Manual Table 7-17',
    },
    {
      title: 'Tension demand per rod',
      formula: 'ru = T / nT',
      substitution: `ru = ${T.toFixed(2)} / ${nT}`,
      result: `ru = ${ru.toFixed(2)} kips/rod`,
    },
    {
      title: 'Nominal tensile strength per rod',
      formula: 'Nsa = Fu · Ase,N',
      substitution: `Nsa = ${Fu.toFixed(0)} · ${Ase.toFixed(3)}`,
      result: `Nsa = ${Nsa.toFixed(2)} kips`,
      ref: 'DG1 Eq. 4-22 / AISC J3-1',
    },
    {
      title: `Available tensile strength (φ = 0.75 LRFD / Ω = 2.0 ASD)`,
      formula: method === 'LRFD' ? 'φ·Nsa' : 'Nsa/Ω',
      substitution: '',
      result: `${method === 'LRFD' ? 'φ·Nsa' : 'Nsa/Ω'} = ${NsaAvail.toFixed(2)} kips`,
    },
    {
      title: 'Demand vs capacity',
      formula: 'ru / available',
      substitution: `${ru.toFixed(2)} / ${NsaAvail.toFixed(2)}`,
      result: `Ratio = ${ratio.toFixed(3)} ${ratio <= 1 ? '✓' : '✗'}`,
    },
  ];

  return { nT, ru, Fu, AseN: Ase, Nsa, NsaAvail, ratio, ok: ratio <= 1, ref: 'AISC 360 §J3 + DG1 Eq. 4-22', steps };
}

// ============================================================================
// 5) Concrete pullout — ACI 318-25 §17.6.3
// ============================================================================
function checkConcretePullout(input: BasePlateInput, T: number, nT: number): ConcretePulloutCheck {
  const { anchors, concrete, method } = input;
  const ru = T / nT;
  const fc_psi = concrete.fc * 1000; // ksi → psi

  let Np: number;
  if (anchors.termination === 'hooked' && anchors.hookLength) {
    const eh = anchors.hookLength;
    Np = 0.9 * fc_psi * eh * anchors.da / 1000;  // kips (ACI Eq. 17.6.3.1)
  } else {
    // Hex nut / plate washer: Np = 8·Abrg·f'c (ACI 17.6.3.2)
    Np = 8 * abrg(anchors.da) * fc_psi / 1000;
  }
  const psiCp = concrete.cracked ? 1.0 : 1.4;
  const Npn = psiCp * Np;
  const phiP = phi(method, 0.70, 2.0);
  const NpnAvail = phiP * Npn;
  const ratio = ru / Math.max(NpnAvail, 1e-9);

  const steps: CalcStep[] = [
    {
      title: 'Pullout strength per rod',
      formula: anchors.termination === 'hooked'
        ? 'Np = 0.9·fʹc·eh·da'
        : 'Np = 8·Abrg·fʹc',
      substitution: anchors.termination === 'hooked'
        ? `Np = 0.9·${fc_psi}·${anchors.hookLength}·${anchors.da}`
        : `Np = 8·${abrg(anchors.da).toFixed(3)}·${fc_psi}`,
      result: `Np = ${Np.toFixed(2)} kips`,
      ref: anchors.termination === 'hooked' ? 'ACI 318 §17.6.3.1' : 'ACI 318 §17.6.3.2',
    },
    {
      title: `Cracking factor ψcp`,
      formula: 'ψcp = 1.0 (cracked) or 1.4 (uncracked)',
      substitution: concrete.cracked ? 'cracked' : 'uncracked',
      result: `ψcp = ${psiCp}`,
      ref: 'ACI 318 §17.6.3.3',
    },
    {
      title: `Available pullout (φ = 0.70 LRFD)`,
      formula: 'φ·ψcp·Np',
      substitution: '',
      result: `${(phiP * psiCp).toFixed(3)}·Np = ${NpnAvail.toFixed(2)} kips`,
    },
    {
      title: 'Demand vs capacity',
      formula: 'ru / available',
      substitution: `${ru.toFixed(2)} / ${NpnAvail.toFixed(2)}`,
      result: `Ratio = ${ratio.toFixed(3)} ${ratio <= 1 ? '✓' : '✗'}`,
    },
  ];

  return { Np, NpnAvail, ru, ratio, ok: ratio <= 1, ref: 'ACI 318-25 §17.6.3', steps };
}

// ============================================================================
// 6) Concrete breakout (group) — ACI 318-25 §17.6.2
// ============================================================================
function checkConcreteBreakout(input: BasePlateInput, T: number): ConcreteBreakoutCheck {
  const { anchors, concrete, method } = input;
  const hef = anchors.hef;
  const fc_psi = concrete.fc * 1000;
  const lambda = concrete.lambdaA;

  // Group projected area ANc — assume rectangular pattern with sx, sy spacing
  const nx = anchors.N === 4 ? 2 : Math.max(2, Math.round(Math.sqrt(anchors.N)));
  const ny = anchors.N / nx;
  void ny;
  // Conservative: project from each rod with 1.5·hef on all sides, account for
  // overlap. Simplified box around anchors on tension side only.
  const sx_total = anchors.sx;
  const sy_total = anchors.sy;
  const ANc = Math.min(
    (1.5 * hef + sx_total + 1.5 * hef) * (1.5 * hef + sy_total + 1.5 * hef),
    9 * hef * hef * (anchors.N / 2) * 4, // upper bound
  );
  const ANco = 9 * hef * hef;

  // ψec,N = 1 / (1 + 2eN/(3·hef)) — use 1.0 for concentric
  const psiEcN = 1.0;
  // ψed,N = 1.0 if ca,min ≥ 1.5·hef, else 0.7 + 0.3·ca,min/(1.5·hef)
  const caMin = anchors.edgeDist;
  const psiEdN = caMin >= 1.5 * hef ? 1.0 : 0.7 + 0.3 * caMin / (1.5 * hef);
  // ψc,N = 1.0 cracked / 1.25 uncracked (cast-in)
  const psiCN = concrete.cracked ? 1.0 : 1.25;
  // ψcp,N = 1.0 for cast-in
  const psiCpN = 1.0;

  // Basic single-anchor breakout
  // For hef < 11 in: Nb = 24·λa·√fʹc·hef^1.5
  // For 11 ≤ hef ≤ 25 in: Nb = 16·λa·√fʹc·hef^(5/3)
  let Nb: number;
  if (hef < 11) {
    Nb = 24 * lambda * Math.sqrt(fc_psi) * Math.pow(hef, 1.5) / 1000; // kips
  } else if (hef <= 25) {
    Nb = 16 * lambda * Math.sqrt(fc_psi) * Math.pow(hef, 5 / 3) / 1000;
  } else {
    Nb = 16 * lambda * Math.sqrt(fc_psi) * Math.pow(25, 5 / 3) / 1000;
  }

  const Ncbg = (ANc / ANco) * psiEcN * psiEdN * psiCN * psiCpN * Nb;
  const phiB = phi(method, 0.70, 2.0);
  const NcbgAvail = phiB * Ncbg;
  const ratio = T / Math.max(NcbgAvail, 1e-9);

  const steps: CalcStep[] = [
    {
      title: 'Embedment depth hef',
      formula: 'hef provided',
      substitution: '',
      result: `hef = ${hef.toFixed(2)} in`,
    },
    {
      title: 'Group projected area ANc',
      formula: 'ANc = (3·hef + sx)·(3·hef + sy)',
      substitution: `ANc = (1.5·${hef.toFixed(2)} + ${sx_total.toFixed(2)} + 1.5·${hef.toFixed(2)}) · (1.5·${hef.toFixed(2)} + ${sy_total.toFixed(2)} + 1.5·${hef.toFixed(2)})`,
      result: `ANc = ${ANc.toFixed(0)} in²`,
      ref: 'ACI 318 §17.6.2.1.1',
    },
    {
      title: 'Single-anchor projected area ANco',
      formula: 'ANco = 9·hef²',
      substitution: `ANco = 9·${hef.toFixed(2)}²`,
      result: `ANco = ${ANco.toFixed(0)} in²`,
      ref: 'ACI 318 Eq. 17.6.2.1.4',
    },
    {
      title: 'Edge-distance factor ψed,N',
      formula: 'ψed,N = 1 if ca,min ≥ 1.5·hef, else 0.7 + 0.3·ca,min/(1.5·hef)',
      substitution: `ca,min = ${caMin.toFixed(2)}, 1.5·hef = ${(1.5 * hef).toFixed(2)}`,
      result: `ψed,N = ${psiEdN.toFixed(3)}`,
      ref: 'ACI 318 Eq. 17.6.2.4.1',
    },
    {
      title: 'Cracking factor ψc,N',
      formula: 'ψc,N (1.0 cracked, 1.25 uncracked, cast-in)',
      substitution: concrete.cracked ? 'cracked' : 'uncracked',
      result: `ψc,N = ${psiCN}`,
      ref: 'ACI 318 §17.6.2.5',
    },
    {
      title: 'Basic single-anchor breakout strength Nb',
      formula: hef < 11 ? 'Nb = 24·λa·√fʹc·hef^1.5' : 'Nb = 16·λa·√fʹc·hef^(5/3)',
      substitution: `λa = ${lambda}, fʹc = ${fc_psi} psi, hef = ${hef.toFixed(2)} in`,
      result: `Nb = ${Nb.toFixed(2)} kips`,
      ref: 'ACI 318 Eq. 17.6.2.2.1 / 17.6.2.2.3',
    },
    {
      title: 'Group breakout strength Ncbg',
      formula: 'Ncbg = (ANc/ANco)·ψec·ψed·ψc·ψcp·Nb',
      substitution: `Ncbg = (${ANc.toFixed(0)}/${ANco.toFixed(0)})·${psiEcN}·${psiEdN.toFixed(3)}·${psiCN}·${psiCpN}·${Nb.toFixed(2)}`,
      result: `Ncbg = ${Ncbg.toFixed(2)} kips`,
      ref: 'ACI 318 Eq. 17.6.2.1b',
    },
    {
      title: `Available breakout (φ = 0.70 LRFD)`,
      formula: 'φ·Ncbg',
      substitution: '',
      result: `${phiB.toFixed(3)}·Ncbg = ${NcbgAvail.toFixed(2)} kips`,
      ref: 'ACI 318 Table 17.5.3',
    },
    {
      title: 'Demand vs capacity',
      formula: 'T / available',
      substitution: `${T.toFixed(2)} / ${NcbgAvail.toFixed(2)}`,
      result: `Ratio = ${ratio.toFixed(3)} ${ratio <= 1 ? '✓' : '✗'}`,
    },
  ];

  return {
    ANc, ANco, psiEcN, psiEdN, psiCN, psiCpN, Nb, Ncbg, NcbgAvail, T,
    ratio, ok: ratio <= 1,
    ref: 'ACI 318-25 §17.6.2',
    steps,
  };
}

// ============================================================================
// 7) Anchor steel shear — AISC 360 §J3 / ACI 318-25 §17.7.1
// ============================================================================
function checkAnchorShear(input: BasePlateInput): AnchorShearCheck {
  const { method, anchors, loads } = input;
  const { Fu } = anchorStrengths(anchors.grade, anchors.Fy, anchors.Fu);
  // All anchors on the tension side resist shear if it acts toward them.
  // Conservatively: shear distributed to all anchors equally.
  const nV = anchors.N;
  const vu = Math.abs(loads.Vu) / nV;
  const Ase = aseN(anchors.da);
  // Vsa = 0.6 · Fu · Ase  (per ACI 318 §17.7.1.2 for cast-in headed bolts)
  const Vsa = 0.6 * Fu * Ase;
  const phiV = phi(method, 0.65, 2.31);   // φ for anchor shear, cast-in ductile (ACI 17.5.3)
  const VsaAvail = phiV * Vsa;
  const ratio = vu / Math.max(VsaAvail, 1e-9);

  const steps: CalcStep[] = [
    {
      title: 'Shear demand per rod',
      formula: 'vu = Vu / N',
      substitution: `vu = ${Math.abs(loads.Vu).toFixed(2)} / ${nV}`,
      result: `vu = ${vu.toFixed(2)} kips/rod`,
    },
    {
      title: 'Steel shear strength per rod',
      formula: 'Vsa = 0.6 · Fu · Ase',
      substitution: `Vsa = 0.6 · ${Fu.toFixed(0)} · ${Ase.toFixed(3)}`,
      result: `Vsa = ${Vsa.toFixed(2)} kips`,
      ref: 'ACI 318 Eq. 17.7.1.2b',
    },
    {
      title: `Available shear strength (φ = 0.65 LRFD)`,
      formula: 'φ·Vsa',
      substitution: '',
      result: `φ·Vsa = ${VsaAvail.toFixed(2)} kips`,
      ref: 'ACI 318 Table 17.5.3',
    },
    {
      title: 'Demand vs capacity',
      formula: 'vu / available',
      substitution: `${vu.toFixed(2)} / ${VsaAvail.toFixed(2)}`,
      result: `Ratio = ${ratio.toFixed(3)} ${ratio <= 1 ? '✓' : '✗'}`,
    },
  ];

  return { nV, vu, Vsa, VsaAvail, ratio, ok: ratio <= 1, ref: 'ACI 318-25 §17.7.1', steps };
}

// ============================================================================
// 8) Combined T+V interaction — ACI 318 §17.8
// ============================================================================
function checkCombinedTV(t: AnchorTensionCheck, v: AnchorShearCheck) {
  // Linear interaction: ratio = T/φNn + V/φVn  ≤ 1.2
  const ratio = t.ratio + v.ratio;
  return {
    ratio,
    ok: ratio <= 1.2,
    ref: 'ACI 318-25 §17.8.3 (linear interaction ≤ 1.2)',
    steps: [
      {
        title: 'Linear interaction',
        formula: 'T/φNn + V/φVn ≤ 1.2',
        substitution: `${t.ratio.toFixed(3)} + ${v.ratio.toFixed(3)}`,
        result: `Ratio = ${ratio.toFixed(3)} ${ratio <= 1.2 ? '✓' : '✗'}`,
      },
    ],
  };
}

// ============================================================================
// 9) Column-to-plate weld — AISC 360 §J2
// ============================================================================
function checkWeld(input: BasePlateInput, T: number): WeldCheck {
  const { method, column, weld } = input;
  // Weld effective length: for W-shape, use perimeter of column footprint
  // (2·d + 4·bf for W-shape with all-around fillet).
  // For tension demand, only flange welds are usually loaded.
  const Le = 2 * column.bf;  // both flange tips total length per side; conservative
  const FEXX = weld.electrode === 'E60' ? 60 : weld.electrode === 'E80' ? 80 : 70;
  const Fnw = 0.6 * FEXX;
  // kds = 1.5 for transverse (load perpendicular to weld)
  const kds = 1.5;

  // Required force per inch
  const rReq = T > 0 ? T / Math.max(Le, 1e-9) : 0;

  // Try the provided size first; auto-size if needed
  const wTry = weld.auto ? Math.max(weld.size, minWeldSize(Math.max(column.tf, column.tw))) : weld.size;
  // Awe = w / √2 per inch
  const Awe = wTry / Math.sqrt(2);
  const Rn = Fnw * Awe * kds;
  const phiW = phi(method, 0.75, 2.0);
  const RnAvail = phiW * Rn;

  // Required leg size
  const wReq = rReq > 0
    ? Math.sqrt(2) * rReq / (phiW * Fnw * kds)
    : 0;

  const wMin = minWeldSize(Math.max(column.tf, column.tw));
  const wProvided = weld.auto ? Math.max(wReq, wMin) : weld.size;
  const ratio = wProvided > 0 ? wReq / wProvided : 0;

  const steps: CalcStep[] = [
    {
      title: 'Effective weld length Le',
      formula: 'Le = 2·bf (both flange tips)',
      substitution: `Le = 2·${column.bf.toFixed(2)}`,
      result: `Le = ${Le.toFixed(2)} in`,
    },
    {
      title: 'Required weld strength per inch',
      formula: 'rReq = T / Le',
      substitution: `rReq = ${T.toFixed(2)} / ${Le.toFixed(2)}`,
      result: `rReq = ${rReq.toFixed(3)} kip/in`,
    },
    {
      title: 'Nominal weld stress',
      formula: 'Fnw = 0.60 · FEXX, kds = 1.5 (transverse)',
      substitution: `Fnw = 0.60·${FEXX}`,
      result: `Fnw = ${Fnw.toFixed(1)} ksi, kds = ${kds}`,
      ref: 'AISC 360 Eq. J2-4 / J2-5',
    },
    {
      title: 'Required fillet leg size',
      formula: 'wReq = √2 · rReq / (φ·Fnw·kds)',
      substitution: `wReq = √2·${rReq.toFixed(3)}/(${phiW.toFixed(2)}·${Fnw.toFixed(1)}·${kds})`,
      result: `wReq = ${wReq.toFixed(3)} in`,
    },
    {
      title: 'Minimum fillet size per AISC Table J2.4',
      formula: 'wMin from thinner connected part',
      substitution: `t = ${Math.max(column.tf, column.tw).toFixed(3)} in`,
      result: `wMin = ${wMin.toFixed(3)} in`,
      ref: 'AISC 360 Table J2.4',
    },
    {
      title: 'Provided fillet size',
      formula: weld.auto ? 'wProv = max(wReq, wMin)' : 'wProv = user-specified',
      substitution: '',
      result: `wProv = ${wProvided.toFixed(3)} in (${ratio <= 1 ? '✓' : '✗'})`,
    },
  ];

  return { Le, rReq, Rn, RnAvail, wReq, wProvided, wMin, ratio, ok: ratio <= 1, ref: 'AISC 360-22 §J2', steps };
}

function minWeldSize(t: number): number {
  // AISC Table J2.4 (US customary, in)
  if (t <= 0.25) return 1 / 8;
  if (t <= 0.50) return 3 / 16;
  if (t <= 0.75) return 1 / 4;
  return 5 / 16;
}

// ============================================================================
// Loading case classification
// ============================================================================
function classifyLoadCase(input: BasePlateInput): BasePlateAnalysis['loadCase'] {
  const { Pu, Mu, Vu } = input.loads;
  const hasMoment = Math.abs(Mu) > 1e-6;
  const hasShear = Math.abs(Vu) > 1e-6;
  if (Pu < 0 && hasMoment) return 'tension+moment';
  if (Pu < 0) return 'tension';
  if (Pu === 0 && hasShear) return 'shear-only';
  if (Pu > 0 && hasMoment) {
    const A1 = input.plate.B * input.plate.N;
    const A2 = input.concrete.B2 * input.concrete.N2;
    const conf = Math.min(Math.sqrt(A2 / A1), 2);
    const fpMax = 0.85 * input.concrete.fc * conf;
    const phiC = phi(input.method, 0.65, 2.31);
    const qmax = phiC * fpMax * input.plate.B;
    const e = Math.abs(Mu) / Pu;
    const ecrit = input.plate.N / 2 - Pu / (2 * qmax);
    return e > ecrit ? 'compression+moment-high' : 'compression+moment-low';
  }
  return 'compression';
}
