// Eurocode 2 (EN 1992-1-1:2004) parallel solver — Phase 5d
//
// Implements the EC2 design strengths and ULS checks for FLEXURE and SHEAR
// alongside the existing ACI 318-25 solver. The two solvers run on the same
// BeamInput; the dispatcher (analyze) picks which one to use based on the
// `code` field. We deliberately keep the EC2 implementation focused and
// production-ready for normal-strength concrete (≤ C50/60); higher-strength
// concrete with η < 1 and λ < 0.8 (3.1.7(3)) is handled with the standard
// linear interpolation.
//
// EC2 vs ACI quick reference (the two big shifts):
//   • Partial factors instead of φ:
//       fcd = αcc·fck/γc       (γc = 1.5, αcc = 1.0 for persistent/transient)
//       fyd = fyk/γs           (γs = 1.15)
//   • Whitney equivalent block: same idea, but with η·fcd over depth λ·x
//       λ = 0.8 (≤ C50/60), η = 1.0 (≤ C50/60)
//   • Shear (no shear reinforcement, §6.2.2):
//       VRd,c = max(CRd,c·k·(100·ρl·fck)^(1/3), v_min)·bw·d
//       CRd,c = 0.18/γc, k = 1 + √(200/d) ≤ 2
//       v_min = 0.035·k^(3/2)·√fck
//   • Shear (with shear reinforcement, §6.2.3):
//       VRd,s = (Asw/s)·z·fywd·cot θ        (variable strut angle, 1 ≤ cot θ ≤ 2.5)
//       VRd,max = αcw·bw·z·ν1·fcd / (cot θ + tan θ)
//       z ≈ 0.9·d
// Reference: EN 1992-1-1:2004, sections 3.1, 3.2, 6.1, 6.2.

import type {
  BeamInput, FlexureCheck, ShearCheck, CalcStep,
} from './types';
import { barArea, barDiameter } from './types';

// ─── Helpers ────────────────────────────────────────────────────────────────

/** EC2 partial factors for persistent/transient design (EN 1992-1-1 §2.4.2.4 + Table 2.1N). */
const GAMMA_C = 1.5;
const GAMMA_S = 1.15;
const ALPHA_CC = 1.0;       // can be 0.85 in some NDPs (UK) — using EC default

/** Effective compressive depth factor λ and effective stress factor η for the
 *  rectangular stress block (§3.1.7(3)). For fck ≤ 50 MPa: λ = 0.8, η = 1.0;
 *  linear reduction up to fck = 90 MPa.
 */
function lambdaEta(fck: number): { lambda: number; eta: number } {
  if (fck <= 50) return { lambda: 0.8, eta: 1.0 };
  if (fck >= 90) return { lambda: 0.7, eta: 0.8 };
  // Linear interpolation between (50, 0.8/1.0) and (90, 0.7/0.8)
  const lambda = 0.8 - (fck - 50) / 400;
  const eta = 1.0 - (fck - 50) / 200;
  return { lambda, eta };
}

/** Strut-angle reduction factor ν1 per §6.2.3(3): for fck ≤ 60 MPa, ν1 = 0.6. */
function nu1(fck: number): number {
  if (fck <= 60) return 0.6;
  return 0.9 - fck / 200;     // §6.2.3(3) NDP — typical
}

function sumBarArea(groups: { bar: string; count: number }[]): number {
  return groups.reduce((s, g) => s + g.count * barArea(g.bar), 0);
}

// ─── EC2 FLEXURE ────────────────────────────────────────────────────────────

export function checkFlexureEC2(input: BeamInput): FlexureCheck {
  const { geometry: g, materials: m, reinforcement: r, loads: L } = input;
  const fck = m.fc;                                  // EC2: fck (characteristic)
  const fyk = m.fy;
  const fcd = ALPHA_CC * fck / GAMMA_C;
  const fyd = fyk / GAMMA_S;
  const Es = m.Es ?? 200000;
  const epsCu = 0.0035;                               // §3.1.7 ultimate strain
  const { lambda, eta } = lambdaEta(fck);
  const beta1 = lambda;                               // for our shared β1 field

  // Provided steel
  const As = sumBarArea(r.tension);
  const AsPrime = sumBarArea(r.compression ?? []);
  const dPrime = g.dPrime ?? 60;

  // Effective compression width — same shape rules as ACI for now
  let bEff = g.bw;
  if (g.shape === 'T-beam' || g.shape === 'L-beam') bEff = g.bf ?? g.bw;

  // Plastic NA depth from equilibrium: As·fyd = η·fcd·b·(λ·x)  →  x = As·fyd / (η·fcd·b·λ)
  let x = As * fyd / (eta * fcd * bEff * lambda);
  // Doubly-reinforced — assume both steels yield (will refine below)
  if (AsPrime > 1e-6) {
    const AsNet = Math.max(0, As - AsPrime);
    x = AsNet * fyd / (eta * fcd * bEff * lambda);
  }
  const c = x;                                        // for shared API
  const a = lambda * x;                               // equivalent block depth

  // Strain in compression steel
  const epsSPrime = epsCu * (x - dPrime) / Math.max(x, 1);
  const fsPrime = Math.min(fyd, epsSPrime * Es);
  const epsTy = fyk / Es;
  const epsT = epsCu * (g.d - x) / Math.max(x, 1);

  // φ → use unity (partial factors are already in fcd, fyd). Keep `phi` field
  // for shared API consumers; ratio is just MEd/MRd.
  const phi = 1.0;

  // Resisting moment MRd
  let MRd_kNm: number;
  if (AsPrime > 1e-6) {
    const Cs = AsPrime * fsPrime;
    const Cc = eta * fcd * bEff * a;
    MRd_kNm = (Cc * (g.d - a / 2) + Cs * (g.d - dPrime)) / 1e6;
  } else if ((g.shape === 'T-beam' || g.shape === 'L-beam') && g.hf && a > g.hf) {
    const Cflange = eta * fcd * (g.bf ?? bEff) * g.hf;
    const Cweb = eta * fcd * g.bw * (a - g.hf);
    MRd_kNm = (Cflange * (g.d - g.hf / 2) + Cweb * (g.d - (a + g.hf) / 2)) / 1e6;
  } else {
    MRd_kNm = (As * fyd * (g.d - a / 2)) / 1e6;
  }

  // Required As (singly, closed form): MEd = As·fyd·(d − a/2), a = As·fyd/(η·fcd·b·λ)
  // → m_rel = As·fyd·(d − As·fyd/(2·η·fcd·b·λ·d))/d²
  // Standard EC2 closed form: μ = MEd/(b·d²·fcd), Asreq = (μ·b·d²·fcd)/(z·fyd)·(some factor)
  // Use direct quadratic:
  //   As² · fyd²/(2·η·fcd·b·λ) − As·fyd·d + MEd = 0
  const MEd_Nmm = Math.abs(L.Mu) * 1e6;
  const A_q = (fyd * fyd) / (2 * eta * fcd * bEff * lambda);
  const B_q = -fyd * g.d;
  const C_q = MEd_Nmm;
  const disc = B_q * B_q - 4 * A_q * C_q;
  const AsReq = disc < 0 ? 0 : (-B_q - Math.sqrt(disc)) / (2 * A_q);
  const needsDouble = disc < 0;

  // As,min per §9.2.1.1: max(0.26·(fctm/fyk)·bt·d, 0.0013·bt·d)
  const fctm = fck <= 50
    ? 0.30 * Math.pow(fck, 2 / 3)              // §3.1.6 Table 3.1
    : 2.12 * Math.log(1 + (fck + 8) / 10);
  const AsMin = Math.max(
    0.26 * (fctm / fyk) * g.bw * g.d,
    0.0013 * g.bw * g.d,
  );

  // As,max for ductility — §5.6.3 / Annex A.5: x/d ≤ 0.45 (≤ C50/60), else 0.35
  const xOverD_max = fck <= 50 ? 0.45 : 0.35;
  const xMax = xOverD_max * g.d;
  const AsMaxTC = (eta * fcd * bEff * lambda * xMax) / fyd;

  const ratio = (Math.abs(L.Mu)) / Math.max(MRd_kNm, 1e-9);
  const ok = ratio <= 1 && As >= AsMin;

  // Section classification by EC2: the ductility limit x/d is the analogue
  // of ACI's tension-/transition-/compression-controlled bands.
  let section: 'tension-controlled' | 'transition' | 'compression-controlled';
  const xOverD = x / g.d;
  if (xOverD <= 0.25) section = 'tension-controlled';
  else if (xOverD <= xOverD_max) section = 'transition';
  else section = 'compression-controlled';

  const steps: CalcStep[] = [
    {
      title: 'Design strengths fcd, fyd',
      formula: 'fcd = αcc·fck/γc;  fyd = fyk/γs',
      substitution: `fcd = ${ALPHA_CC}·${fck}/${GAMMA_C}; fyd = ${fyk}/${GAMMA_S}`,
      result: `fcd = ${fcd.toFixed(2)} MPa, fyd = ${fyd.toFixed(2)} MPa`,
      ref: 'EN 1992-1-1 §2.4.2.4 + Table 2.1N',
    },
    {
      title: 'Stress-block factors λ, η',
      formula: 'λ = 0.8, η = 1.0 (fck ≤ 50 MPa); linear reduction up to fck = 90 MPa',
      substitution: `fck = ${fck}`,
      result: `λ = ${lambda.toFixed(3)}, η = ${eta.toFixed(3)}`,
      ref: 'EN 1992-1-1 §3.1.7(3)',
    },
    {
      title: 'Provided tension steel As',
      formula: 'As = Σ count·Ab',
      substitution: r.tension.map((g) => `${g.count}·${barArea(g.bar)}`).join(' + '),
      result: `As = ${As.toFixed(0)} mm²`,
    },
    {
      title: 'NA depth x (rectangular stress block)',
      formula: AsPrime > 0
        ? '(As − Aʹs)·fyd = η·fcd·b·(λ·x)'
        : 'x = As·fyd / (η·fcd·b·λ)',
      substitution: `x = ${As.toFixed(0)}·${fyd.toFixed(1)} / (${eta.toFixed(2)}·${fcd.toFixed(1)}·${bEff.toFixed(0)}·${lambda.toFixed(2)})`,
      result: `x = ${x.toFixed(2)} mm,  a = λ·x = ${a.toFixed(2)} mm,  x/d = ${xOverD.toFixed(3)}`,
      ref: 'EN 1992-1-1 §3.1.7',
    },
    {
      title: 'Net tensile strain εs',
      formula: 'εs = εcu·(d − x)/x   (εcu = 0.0035)',
      substitution: `εs = 0.0035·(${g.d} − ${x.toFixed(1)})/${x.toFixed(1)}`,
      result: `εs = ${(epsT * 1000).toFixed(3)} ‰  (εyd = ${(epsTy * 1000).toFixed(3)} ‰)`,
    },
    {
      title: 'Resisting moment MRd',
      formula: AsPrime > 0
        ? 'MRd = Cc·(d − a/2) + Cs·(d − dʹ)'
        : ((g.shape === 'T-beam' || g.shape === 'L-beam') && g.hf && a > g.hf
          ? 'MRd = Cflange·(d − hf/2) + Cweb·(d − (a+hf)/2)'
          : 'MRd = As·fyd·(d − a/2)'),
      substitution: `d = ${g.d}, a = ${a.toFixed(2)}`,
      result: `MRd = ${MRd_kNm.toFixed(2)} kN·m`,
    },
    {
      title: 'Demand vs capacity',
      formula: 'MEd / MRd',
      substitution: `${Math.abs(L.Mu).toFixed(2)} / ${MRd_kNm.toFixed(2)}`,
      result: `Ratio = ${ratio.toFixed(3)} ${ok ? '✓' : '✗'}`,
    },
    {
      title: 'As,min per §9.2.1.1',
      formula: 'As,min = max(0.26·(fctm/fyk)·b·d, 0.0013·b·d)',
      substitution: `fctm = ${fctm.toFixed(2)} MPa`,
      result: `As,min = ${AsMin.toFixed(0)} mm²`,
      ref: 'EN 1992-1-1 §9.2.1.1',
    },
    {
      title: 'Ductility check x/d',
      formula: 'x/d ≤ 0.45 (≤ C50/60) for full plastic redistribution',
      substitution: `x/d = ${xOverD.toFixed(3)}, limit = ${xOverD_max}`,
      result: `Section: ${section.replace('-', ' ')}`,
      ref: 'EN 1992-1-1 §5.6.3 / Annex A.5',
    },
  ];

  return {
    As, a, c, beta1, epsT, epsTy, phi, section,
    Mn: MRd_kNm,        // semantic match: MRd is the design resisting moment
    phiMn: MRd_kNm,     // already factored
    AsReq, AsMin, AsMaxTC,
    ratio, ok, needsDouble,
    ref: 'EN 1992-1-1 §6.1',
    steps,
  };
}

// ─── EC2 SHEAR ──────────────────────────────────────────────────────────────

export function checkShearEC2(input: BeamInput): ShearCheck {
  const { geometry: g, materials: m, reinforcement: r, loads: L } = input;
  const fck = m.fc;
  const fcd = ALPHA_CC * fck / GAMMA_C;
  const fywk = m.fyt ?? m.fy;
  const fywd = fywk / GAMMA_S;
  const VEd_kN = Math.abs(L.Vu);
  const VEd_N = VEd_kN * 1e3;

  // Tension steel ratio ρl
  const As = sumBarArea(r.tension);
  const rhoL = Math.min(0.02, As / (g.bw * g.d));

  // VRd,c without shear reinforcement (§6.2.2(1))
  const k = Math.min(2.0, 1 + Math.sqrt(200 / g.d));
  const CRdc = 0.18 / GAMMA_C;
  const sigmaCp = 0;          // no axial load assumed (beam-only)
  const k1 = 0.15;
  const VRdc_term = CRdc * k * Math.pow(100 * rhoL * fck, 1 / 3) + k1 * sigmaCp;
  const vmin = 0.035 * Math.pow(k, 3 / 2) * Math.sqrt(fck);
  const VRdc_N = Math.max(VRdc_term, vmin) * g.bw * g.d;
  const VRdc_kN = VRdc_N / 1e3;

  // Variable-angle strut model (§6.2.3): pick θ such that VRd,s = VEd, with
  // 1 ≤ cot θ ≤ 2.5. Our strategy: use cot θ = 2.5 (most economical) then
  // verify VRd,max isn't exceeded.
  const z = 0.9 * g.d;
  const cotTheta = 2.5;
  const tanTheta = 1 / cotTheta;

  const Av = r.stirrup.legs * barArea(r.stirrup.bar);
  const sProvided = r.stirrup.spacing;
  const VRds_N = (Av / sProvided) * z * fywd * cotTheta;
  const VRds_kN = VRds_N / 1e3;

  // Maximum shear (concrete crushing) — §6.2.3(3)
  const alphaCw = 1.0;        // no axial pre-stress
  const ν1 = nu1(fck);
  const VRdmax_N = alphaCw * g.bw * z * ν1 * fcd / (cotTheta + tanTheta);
  const VRdmax_kN = VRdmax_N / 1e3;

  // Shear capacity = min(VRd,s, VRd,max) when stirrups; else VRd,c
  const stirrupsRequired = VEd_kN > 0.5 * VRdc_kN;
  const VRd_kN = stirrupsRequired ? Math.min(VRds_kN, VRdmax_kN) : VRdc_kN;

  // Required spacing for given VEd: VRd,s ≥ VEd → s ≤ Av·z·fywd·cot θ / VEd_N
  const sReq = VEd_N > 0 ? (Av * z * fywd * cotTheta) / VEd_N : 1e9;

  // Av,min per §9.2.2(5):  ρw,min = (0.08·√fck)/fyk
  const rhoWmin = (0.08 * Math.sqrt(fck)) / fywk;
  const AvMin = rhoWmin * g.bw * sProvided;

  // s,max per §9.2.2(6): SL,max = 0.75·d·(1 + cot α) (for α=90°: 0.75·d)
  const sMax = Math.min(0.75 * g.d, 600);

  const ratio = VEd_kN / Math.max(VRd_kN, 1e-9);
  const ok = ratio <= 1 && Av >= AvMin && sProvided <= sMax;

  const steps: CalcStep[] = [
    {
      title: 'Concrete shear capacity VRd,c (no stirrups)',
      formula: 'VRd,c = max(CRd,c·k·(100·ρl·fck)^(1/3), vmin)·bw·d',
      substitution:
        `k = 1 + √(200/${g.d}) = ${k.toFixed(3)}; ρl = ${rhoL.toFixed(4)}; ` +
        `CRd,c = 0.18/${GAMMA_C} = ${CRdc.toFixed(3)}; vmin = ${vmin.toFixed(3)}`,
      result: `VRd,c = ${VRdc_kN.toFixed(2)} kN`,
      ref: 'EN 1992-1-1 §6.2.2(1)',
    },
    {
      title: 'Shear-reinforcement requirement',
      formula: 'stirrups needed if VEd > 0.5·VRd,c',
      substitution: `VEd = ${VEd_kN.toFixed(1)}, 0.5·VRd,c = ${(0.5 * VRdc_kN).toFixed(1)}`,
      result: stirrupsRequired ? 'YES — stirrups required' : 'NO — only nominal stirrups required',
      ref: 'EN 1992-1-1 §6.2.1(2)',
    },
    {
      title: 'Variable-angle strut model — VRd,s with cot θ = 2.5',
      formula: 'VRd,s = (Asw/s)·z·fywd·cot θ',
      substitution: `Asw = ${Av.toFixed(0)} mm², s = ${sProvided} mm, z = 0.9·d = ${z.toFixed(1)} mm, fywd = ${fywd.toFixed(1)} MPa`,
      result: `VRd,s = ${VRds_kN.toFixed(2)} kN`,
      ref: 'EN 1992-1-1 §6.2.3(3)',
    },
    {
      title: 'Maximum shear (concrete crushing)',
      formula: 'VRd,max = αcw·bw·z·ν1·fcd / (cot θ + tan θ)',
      substitution: `ν1 = ${ν1.toFixed(2)}, fcd = ${fcd.toFixed(2)} MPa`,
      result: `VRd,max = ${VRdmax_kN.toFixed(2)} kN`,
      ref: 'EN 1992-1-1 §6.2.3(3)',
    },
    {
      title: 'Demand vs capacity',
      formula: 'VEd / min(VRd,s, VRd,max)',
      substitution: `VEd = ${VEd_kN.toFixed(2)} kN, VRd = ${VRd_kN.toFixed(2)} kN`,
      result: `Ratio = ${ratio.toFixed(3)} ${ok ? '✓' : '✗'}`,
    },
    {
      title: 'Min stirrup ratio §9.2.2(5)',
      formula: 'ρw,min = 0.08·√fck/fyk',
      substitution: `ρw,min = 0.08·√${fck}/${fywk} = ${rhoWmin.toFixed(5)}`,
      result: `Av,min = ρw,min·bw·s = ${AvMin.toFixed(0)} mm²  (provided ${Av.toFixed(0)})`,
      ref: 'EN 1992-1-1 §9.2.2(5)',
    },
    {
      title: 'Max stirrup spacing §9.2.2(6)',
      formula: 'sl,max = 0.75·d (vertical stirrups, no axial pretension)',
      substitution: `sl,max = 0.75·${g.d}`,
      result: `sl,max = ${sMax.toFixed(0)} mm`,
      ref: 'EN 1992-1-1 §9.2.2(6)',
    },
  ];

  return {
    Vc: VRdc_kN, Vs: VRds_kN, Vn: VRd_kN, phiVn: VRd_kN,
    VsMax: VRdmax_kN, sMax, sReq,
    Av, AvMin,
    ratio, ok, stirrupsRequired,
    ref: 'EN 1992-1-1 §6.2',
    steps,
  };
}
