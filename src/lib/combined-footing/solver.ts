/**
 * Combined Footing Solver — Phase B
 * ----------------------------------
 *
 * Implements the design checks for a rectangular combined footing
 * supporting two columns per ACI 318-25 §13.3.4 and Wight & MacGregor
 * 7e §15-6 (Example 15-5 cross-validation in tests/).
 *
 * Design steps:
 *   1. Bearing — resultant location → footing centroid → uniform q_avg ≤ qa
 *   2. Beam analysis — BMD/SFD with two point loads + distributed soil reaction
 *   3. Two-way (punching) shear at each column (at d/2)
 *   4. One-way shear at d from the face of the more loaded column
 *   5. Longitudinal flexure — positive (between cols) and negative (cantilever)
 *   6. Transverse flexure — at each column with crossbeam width = col + d
 */

import type {
  CombinedFootingInput, CombinedFootingAnalysis,
  CombinedBearingCheck, LongitudinalBeamAnalysis,
  CombinedPunchingCheck, CombinedOneWayShearCheck,
  CombinedLongFlexureCheck, CombinedTransFlexureCheck,
  CombinedColumn,
  CombinedBearingInterfaceCheck, CombinedBarFitCheck, CombinedDevelopmentCheck,
} from './types';
import type { CalcStep } from '../footing/types';
import { barArea, barDiameter } from '../rc/types';

const PI = Math.PI;

function ref(code: 'ACI 318-25' | 'ACI 318-19', section: string): string {
  if (code === 'ACI 318-19') return `ACI 318-19 §${section}`;
  return `ACI 318-25 §${section}`;
}

// ─── BEARING ────────────────────────────────────────────────────────────────

function checkBearing(input: CombinedFootingInput): CombinedBearingCheck {
  const { code, geometry: g, soil, column1, column2 } = input;
  const gammaC = soil.gammaConcrete ?? 24;
  const gammaS = soil.gammaSoil ?? 18;

  const A_m2 = (g.B * g.L) / 1e6;
  const Wf = gammaC * A_m2 * (g.T / 1000);
  const Ws = gammaS * A_m2 * ((g.embedment ?? 0) / 1000);

  const P1 = column1.PD + column1.PL;
  const P2 = column2.PD + column2.PL;
  const P_service = P1 + P2 + Wf + Ws;
  const A_req = P_service / soil.qa;

  // Resultant location along longitudinal axis (from chosen reference)
  const xR = (P1 * column1.position + P2 * column2.position) / Math.max(P1 + P2, 1e-9);

  // Footing left edge: assume user provides leftEdge OR auto-place so centroid
  // (= leftEdge + L/2) matches the resultant. For 'auto', leftEdge = xR − L/2.
  const leftEdge = g.leftEdge ?? (xR - g.L / 2);
  const centroidOffset = (leftEdge + g.L / 2) - xR;     // mm, 0 = perfect

  // Pressure: if centroid ≈ resultant → uniform q_avg. Otherwise trapezoidal.
  const q_avg = P_service / A_m2;     // kPa
  // Eccentricity in m
  const e_m = centroidOffset / 1000;
  const L_m = g.L / 1000;
  const dq = (e_m * 6 * P_service) / (g.B / 1000 * Math.pow(L_m, 2));     // kPa
  const q_max = q_avg + Math.abs(dq);
  const q_min = Math.max(0, q_avg - Math.abs(dq));

  const ratio = q_max / soil.qa;
  const ok = q_max <= soil.qa;

  return {
    P_service, A_req, A_prov: A_m2,
    xResultantFromLeft: xR - leftEdge,
    centroidOffset, q_avg, q_max, q_min, Wf, Ws,
    ratio, ok,
    ref: ref(code, '13.3.1'),
    steps: [
      {
        title: 'Service loads + footing weight',
        formula: 'P_service = P1 + P2 + Wf + Ws',
        substitution: `${P1.toFixed(1)} + ${P2.toFixed(1)} + ${Wf.toFixed(1)} + ${Ws.toFixed(1)}`,
        result: `Pservice = ${P_service.toFixed(1)} kN`,
      },
      {
        title: 'Resultant location (from reference)',
        formula: 'xR = (P1·x1 + P2·x2) / (P1 + P2)',
        substitution: `(${P1.toFixed(1)}·${column1.position} + ${P2.toFixed(1)}·${column2.position}) / ${(P1+P2).toFixed(1)}`,
        result: `xR = ${xR.toFixed(0)} mm   (footing left edge = ${leftEdge.toFixed(0)} mm)`,
      },
      {
        title: 'Centroid match (uniform pressure)',
        formula: 'centroidOffset = (leftEdge + L/2) − xR',
        substitution: `(${leftEdge.toFixed(0)} + ${(g.L/2).toFixed(0)}) − ${xR.toFixed(0)}`,
        result: `offset = ${centroidOffset.toFixed(1)} mm  ${Math.abs(centroidOffset) < 50 ? '✓ uniform pressure' : '⚠ trapezoidal pressure'}`,
      },
      {
        title: 'Average bearing pressure',
        formula: 'qavg = Pservice / A',
        substitution: `${P_service.toFixed(1)} / ${A_m2.toFixed(3)}`,
        result: `qavg = ${q_avg.toFixed(1)} kPa  (allow ${soil.qa} kPa) ${q_avg <= soil.qa ? '✓' : '✗'}`,
      },
      {
        title: 'Peak bearing pressure (with offset)',
        formula: 'qmax = qavg + 6·Pservice·e / (B·L²)',
        substitution: `e = ${centroidOffset.toFixed(1)} mm`,
        result: `qmax = ${q_max.toFixed(1)} kPa  ${ok ? '✓' : '✗'}`,
        ref: ref(code, '13.3.1'),
      },
    ],
  };
}

// ─── LONGITUDINAL BEAM ANALYSIS ─────────────────────────────────────────────

function analyzeLongitudinalBeam(input: CombinedFootingInput): LongitudinalBeamAnalysis {
  const { geometry: g, column1, column2 } = input;
  const Pu1 = 1.2 * column1.PD + 1.6 * column1.PL;
  const Pu2 = 1.2 * column2.PD + 1.6 * column2.PL;

  // Factored uniform pressure (no overburden subtracted — matches qnu convention)
  const A_m2 = (g.B * g.L) / 1e6;
  const qnu = (Pu1 + Pu2) / A_m2;     // kPa
  // Distributed UPWARD load on the beam = qnu × B  (kN/m)
  const wu = qnu * (g.B / 1000);

  // Position of columns RELATIVE to footing left edge (mm, then m)
  const leftEdge = g.leftEdge ?? ((column1.PD + column1.PL) * column1.position
                                 + (column2.PD + column2.PL) * column2.position)
                                  / (column1.PD + column1.PL + column2.PD + column2.PL)
                                 - g.L / 2;
  const xc1_m = (column1.position - leftEdge) / 1000;
  const xc2_m = (column2.position - leftEdge) / 1000;
  const L_m = g.L / 1000;

  // BMD/SFD by superposition. Convention: take cuts from the LEFT, sum forces
  // (upward positive on beam). At any section x, V(x) = wu·x − Σ Pu_i for x ≥ xi.
  // Then M(x) = ∫V dx; M(0) = 0.
  // Sample at fine intervals
  const NSAMPLES = Math.max(50, Math.floor(L_m / 0.05));     // every ~50 mm
  const dx = L_m / NSAMPLES;
  const samples: { x: number; M: number; V: number }[] = [];
  let M = 0;
  let prevV = 0;
  let Mu_pos_max = 0, Mu_neg_max = 0;
  let x_pos = 0, x_neg = 0;
  for (let i = 0; i <= NSAMPLES; i++) {
    const x = i * dx;
    let V = wu * x;
    if (x >= xc1_m) V -= Pu1;
    if (x >= xc2_m) V -= Pu2;
    if (i > 0) {
      // Trapezoidal integration of V to get M
      M += (V + prevV) / 2 * dx;
    }
    samples.push({ x: x * 1000, M, V });     // store mm + kN, kN·m
    prevV = V;
    if (M > Mu_pos_max) { Mu_pos_max = M; x_pos = x * 1000; }
    if (M < Mu_neg_max) { Mu_neg_max = M; x_neg = x * 1000; }
  }

  // Maximum shear at face of each column (at x = xc ± col_dim/2)
  // For col1 face nearer interior: x = xc1_m + col1.cl/2/1000
  // For col2 face nearer interior: x = xc2_m - col2.cl/2/1000
  function shearAt(x_m: number): number {
    let V = wu * x_m;
    if (x_m >= xc1_m) V -= Pu1;
    if (x_m >= xc2_m) V -= Pu2;
    return V;
  }
  const Vu_max_at_col1 = Math.abs(shearAt(xc1_m + column1.cl / 2 / 1000));
  const Vu_max_at_col2 = Math.abs(shearAt(xc2_m - column2.cl / 2 / 1000));

  return {
    wu, Pu1, Pu2,
    Mu_pos_max, x_Mu_pos_max: x_pos,
    Mu_neg_max, x_Mu_neg_max: x_neg,
    Vu_max_at_col1, Vu_max_at_col2,
    bmd: samples,
    steps: [
      {
        title: 'Factored loads + distributed soil reaction',
        formula: 'Pu_i = 1.2·PD + 1.6·PL;  wu = qnu × B',
        substitution: `Pu1 = ${Pu1.toFixed(1)}, Pu2 = ${Pu2.toFixed(1)} kN; wu = ${qnu.toFixed(1)}·${(g.B/1000).toFixed(2)} = ${wu.toFixed(1)} kN/m`,
        result: `qnu = ${qnu.toFixed(1)} kPa, wu = ${wu.toFixed(1)} kN/m`,
      },
      {
        title: 'Maximum positive bending moment',
        formula: 'Mu+ = ∫V dx (between columns, where V crosses zero)',
        substitution: `at x = ${x_pos.toFixed(0)} mm from left edge`,
        result: `Mu+ = ${Mu_pos_max.toFixed(1)} kN·m`,
      },
      {
        title: 'Maximum negative bending moment',
        formula: 'Mu− = ∫V dx (cantilever or face of interior column)',
        substitution: `at x = ${x_neg.toFixed(0)} mm`,
        result: `Mu− = ${Mu_neg_max.toFixed(1)} kN·m`,
      },
      {
        title: 'Maximum shear at face of each column',
        formula: 'Vu_face = wu·x − ΣPu_i',
        substitution: `column 1 face | column 2 face`,
        result: `Vu_face,1 = ${Vu_max_at_col1.toFixed(1)} kN, Vu_face,2 = ${Vu_max_at_col2.toFixed(1)} kN`,
      },
    ],
  };
}

// ─── TWO-WAY (PUNCHING) SHEAR AT EACH COLUMN ────────────────────────────────

function checkPunchingAtColumn(
  input: CombinedFootingInput, columnIdx: 1 | 2,
): CombinedPunchingCheck {
  const { code, geometry: g, materials: m } = input;
  const col: CombinedColumn = columnIdx === 1 ? input.column1 : input.column2;
  const fc = m.fc;
  const lambda = m.lambdaC ?? 1.0;
  const phi = 0.75;
  const dbBar = barDiameter(input.reinforcement.bottomLong.bar);
  const d = g.T - g.coverClear - dbBar / 2;     // simplified d
  const sqrtFc = Math.sqrt(fc);

  let bo: number, A_punch_mm2: number;
  if (col.shape === 'circular') {
    const dia = col.cl;
    const dCrit = dia + d;
    bo = PI * dCrit;
    A_punch_mm2 = PI * Math.pow(dCrit / 2, 2);
  } else {
    const ax = col.cl + d;
    const ay = col.ct + d;
    bo = 2 * (ax + ay);
    A_punch_mm2 = ax * ay;
  }

  const betaC = Math.max(col.cl, col.ct) / Math.min(col.cl, col.ct);
  const alphaS =
    col.columnLocation === 'edge' ? 30 :
    col.columnLocation === 'corner' ? 20 :
    40;

  const vc1 = 0.33 * lambda * sqrtFc;
  const vc2 = 0.17 * (1 + 2 / betaC) * lambda * sqrtFc;
  const vc3 = 0.083 * (alphaS * d / bo + 2) * lambda * sqrtFc;
  const vc = Math.min(vc1, vc2, vc3);

  const phiVc = (phi * vc * bo * d) / 1000;     // kN

  // Vu = Pu_col − qnu × A_punch (the area inside the perimeter doesn't push back on column)
  const Pu_col = 1.2 * col.PD + 1.6 * col.PL;
  const A_m2 = (g.B * g.L) / 1e6;
  const Pu1 = 1.2 * input.column1.PD + 1.6 * input.column1.PL;
  const Pu2 = 1.2 * input.column2.PD + 1.6 * input.column2.PL;
  const qnu = (Pu1 + Pu2) / A_m2;
  const Vu = Pu_col - qnu * (A_punch_mm2 / 1e6);     // kN

  const vuv = (Vu * 1000) / Math.max(bo * d, 1e-9);     // MPa
  const ratio = Vu / Math.max(phiVc, 1e-9);
  const ok = ratio <= 1;

  return {
    column: columnIdx, bo, d, betaC, alphaS, vc, phiVc, Vu, vuv, ratio, ok,
    ref: ref(code, '22.6'),
    steps: [
      {
        title: `Critical perimeter at column ${columnIdx}`,
        formula: col.shape === 'circular' ? 'bo = π·(D + d)' : 'bo = 2·(cl + d) + 2·(ct + d)',
        substitution: `cl = ${col.cl}, ct = ${col.ct}, d = ${d.toFixed(1)} mm`,
        result: `bo = ${bo.toFixed(0)} mm`,
        ref: ref(code, '22.6.4.1'),
      },
      {
        title: `vc, φVc at column ${columnIdx}`,
        formula: 'vc = min(0.33·λ·√fʹc, 0.17·(1+2/βc)·λ·√fʹc, 0.083·(αs·d/bo+2)·λ·√fʹc)',
        substitution: `vc1 = ${vc1.toFixed(3)}, vc2 = ${vc2.toFixed(3)}, vc3 = ${vc3.toFixed(3)} MPa`,
        result: `vc = ${vc.toFixed(3)} MPa, φVc = ${phiVc.toFixed(1)} kN`,
        ref: ref(code, '22.6.5'),
      },
      {
        title: `Demand at column ${columnIdx}`,
        formula: 'Vu = Pu_col − qnu × A_punch',
        substitution: `${Pu_col.toFixed(1)} − ${qnu.toFixed(1)}·${(A_punch_mm2/1e6).toFixed(4)}`,
        result: `Vu = ${Vu.toFixed(1)} kN  →  ratio = ${ratio.toFixed(3)} ${ok ? '✓' : '✗'}`,
      },
    ],
  };
}

// ─── ONE-WAY SHEAR (longitudinal beam, at d from interior column face) ─────

function checkLongOneWayShear(
  input: CombinedFootingInput, beam: LongitudinalBeamAnalysis,
): CombinedOneWayShearCheck {
  const { code, geometry: g, materials: m, column1, column2 } = input;
  const lambda = m.lambdaC ?? 1.0;
  const phi = 0.75;
  const dbBar = barDiameter(input.reinforcement.bottomLong.bar);
  const d = g.T - g.coverClear - dbBar / 2;
  // Critical section at d from face of the more heavily loaded column
  const Pu1 = 1.2 * column1.PD + 1.6 * column1.PL;
  const Pu2 = 1.2 * column2.PD + 1.6 * column2.PL;
  const heavierIs2 = Pu2 > Pu1;
  const heavyCol = heavierIs2 ? column2 : column1;
  const xCrit_m = heavierIs2
    ? (heavyCol.position - g.leftEdge!) / 1000 - heavyCol.cl / 2 / 1000 - d / 1000
    : (heavyCol.position - g.leftEdge!) / 1000 + heavyCol.cl / 2 / 1000 + d / 1000;

  // Find Vu at xCrit by linear interpolation in the BMD samples
  let Vu = 0;
  for (let i = 1; i < beam.bmd.length; i++) {
    if (beam.bmd[i].x / 1000 >= xCrit_m) {
      Vu = Math.abs(beam.bmd[i].V);
      break;
    }
  }

  const Vc_N = 0.17 * lambda * Math.sqrt(m.fc) * g.B * d;
  const phiVc = (phi * Vc_N) / 1000;     // kN
  const ratio = Vu / Math.max(phiVc, 1e-9);
  const ok = ratio <= 1;

  return {
    xCrit: xCrit_m * 1000, d, bw: g.B,
    Vu, Vc: Vc_N / 1000, phiVc, ratio, ok,
    ref: ref(code, '22.5.5.1'),
    steps: [
      {
        title: 'Critical section at d from face of the more loaded column',
        formula: 'xCrit = colFace ± d',
        substitution: `column ${heavierIs2 ? 2 : 1} (Pu = ${Math.max(Pu1, Pu2).toFixed(1)} kN)`,
        result: `xCrit = ${(xCrit_m * 1000).toFixed(0)} mm from left edge`,
      },
      {
        title: 'φVc per §22.5.5.1(a)',
        formula: 'φVc = φ · 0.17·λ·√fʹc · B · d',
        substitution: `0.75 · 0.17 · 1.0 · √${m.fc} · ${g.B} · ${d.toFixed(1)} / 1000`,
        result: `φVc = ${phiVc.toFixed(1)} kN`,
      },
      {
        title: 'Demand vs capacity',
        formula: 'Vu / φVc',
        substitution: `${Vu.toFixed(1)} / ${phiVc.toFixed(1)}`,
        result: `Ratio = ${ratio.toFixed(3)} ${ok ? '✓' : '✗ FAIL — increase T'}`,
      },
    ],
  };
}

// ─── LONGITUDINAL FLEXURE (positive + negative regions) ─────────────────────

function checkLongFlexure(
  input: CombinedFootingInput, beam: LongitudinalBeamAnalysis, region: 'positive' | 'negative',
): CombinedLongFlexureCheck {
  const { code, geometry: g, materials: m, reinforcement: r } = input;
  const fc = m.fc, fy = m.fy;
  const phi = 0.90;
  const layer = region === 'positive' ? r.bottomLong : (r.topLong ?? r.bottomLong);
  const dbBar = barDiameter(layer.bar);
  const d = g.T - g.coverClear - dbBar / 2;
  const bw = g.B;
  const Mu = region === 'positive' ? Math.abs(beam.Mu_pos_max) : Math.abs(beam.Mu_neg_max);

  // AsReq via singly-reinforced quadratic
  const A_q = fy * fy / (2 * 0.85 * fc * bw);
  const B_q = -fy * d;
  const C_q = (Mu * 1e6) / phi;
  const disc = B_q * B_q - 4 * A_q * C_q;
  const AsReq = disc < 0 ? 0 : (-B_q - Math.sqrt(disc)) / (2 * A_q);

  // AsMin per §9.6.1.2 (beams): max(√fc/(4·fy), 1.4/fy) · b · d
  const AsMin = Math.max(Math.sqrt(fc) / (4 * fy), 1.4 / fy) * bw * d;

  const AsProv = layer.count * barArea(layer.bar);
  const a_prov = AsProv * fy / (0.85 * fc * bw);
  const Mn_prov = (AsProv * fy * (d - a_prov / 2)) / 1e6;     // kN·m
  const phiMn = phi * Mn_prov;

  const ratio = Mu / Math.max(phiMn, 1e-9);
  const ok = ratio <= 1 && AsProv >= Math.max(AsReq, AsMin);

  return {
    region, Mu, d, bw, AsReq, AsMin, AsProv, phiMn, ratio, ok,
    ref: ref(code, '13.3.3 / 9.3'),
    steps: [
      {
        title: `${region === 'positive' ? 'Positive' : 'Negative'} moment Mu`,
        formula: `Mu_${region === 'positive' ? '+' : '−'} = max from BMD`,
        substitution: `at x = ${(region === 'positive' ? beam.x_Mu_pos_max : beam.x_Mu_neg_max).toFixed(0)} mm`,
        result: `Mu = ${Mu.toFixed(1)} kN·m`,
      },
      {
        title: 'AsReq from quadratic',
        formula: 'φ·As·fy·(d − a/2) = Mu',
        substitution: `bw = ${bw}, d = ${d.toFixed(1)}`,
        result: `AsReq = ${AsReq.toFixed(0)} mm²`,
      },
      {
        title: 'AsMin per §9.6.1.2 (beam-like)',
        formula: 'max(√fʹc/(4·fy), 1.4/fy) · bw · d',
        substitution: `bw·d = ${bw}·${d.toFixed(1)}`,
        result: `AsMin = ${AsMin.toFixed(0)} mm²`,
      },
      {
        title: 'AsProv vs target',
        formula: `${layer.count} × ${layer.bar}`,
        substitution: '',
        result: `AsProv = ${AsProv.toFixed(0)} mm² (${ok ? '≥' : '<'} max(AsReq, AsMin))`,
      },
      {
        title: 'φMn check',
        formula: 'Mu / φMn',
        substitution: `${Mu.toFixed(1)} / ${phiMn.toFixed(1)}`,
        result: `Ratio = ${ratio.toFixed(3)} ${ok ? '✓' : '✗ FAIL'}`,
      },
    ],
  };
}

// ─── TRANSVERSE FLEXURE (under each column, crossbeam zone) ─────────────────

function checkTransFlexure(
  input: CombinedFootingInput, columnIdx: 1 | 2,
): CombinedTransFlexureCheck {
  const { code, geometry: g, materials: m, reinforcement: r } = input;
  const col = columnIdx === 1 ? input.column1 : input.column2;
  const fc = m.fc, fy = m.fy;
  const phi = 0.90;
  const dbBar = barDiameter(r.bottomTrans.bar);
  const d = g.T - g.coverClear - dbBar / 2;

  // Crossbeam width = col.cl + d (each side d/2 from face, longitudinal direction)
  const crossbeamWidth = col.cl + d;
  // Transverse cantilever: from col.ct/2 to B/2 (perpendicular to long axis)
  const cantilever = (g.B - col.ct) / 2;
  // Pressure under the crossbeam zone (factored)
  const A_m2 = (g.B * g.L) / 1e6;
  const Pu1 = 1.2 * input.column1.PD + 1.6 * input.column1.PL;
  const Pu2 = 1.2 * input.column2.PD + 1.6 * input.column2.PL;
  const qnu = (Pu1 + Pu2) / A_m2;
  // Mu = qnu·cant²/2·crossbeamWidth (uniform pressure, simple cantilever)
  const Mu = qnu * Math.pow(cantilever / 1000, 2) / 2 * (crossbeamWidth / 1000);

  // AsReq
  const A_q = fy * fy / (2 * 0.85 * fc * crossbeamWidth);
  const B_q = -fy * d;
  const C_q = (Mu * 1e6) / phi;
  const disc = B_q * B_q - 4 * A_q * C_q;
  const AsReq = disc < 0 ? 0 : (-B_q - Math.sqrt(disc)) / (2 * A_q);

  // AsMin per §8.6.1.1
  const rhoMin = fy < 420 ? 0.0020 : Math.max(0.0014, 0.0018 * 420 / fy);
  const AsMin = rhoMin * crossbeamWidth * g.T;

  // Bars in crossbeam zone — share total trans bars proportionally to band width
  const totalBars = r.bottomTrans.count;
  const barsInBand = Math.max(1, Math.round(totalBars * crossbeamWidth / g.L));
  const AsProv = barsInBand * barArea(r.bottomTrans.bar);
  const a_prov = AsProv * fy / (0.85 * fc * crossbeamWidth);
  const Mn = (AsProv * fy * (d - a_prov / 2)) / 1e6;
  const phiMn = phi * Mn;

  const ratio = Mu / Math.max(phiMn, 1e-9);
  const ok = ratio <= 1 && AsProv >= Math.max(AsReq, AsMin);

  return {
    column: columnIdx, crossbeamWidth, cantilever,
    Mu, AsReq, AsMin, AsProv, phiMn, ratio, ok,
    ref: ref(code, '13.3.3 / 15.4'),
    steps: [
      {
        title: `Transverse cantilever at column ${columnIdx}`,
        formula: 'cant = (B − ct)/2',
        substitution: `(${g.B} − ${col.ct}) / 2`,
        result: `cant = ${cantilever.toFixed(0)} mm`,
      },
      {
        title: 'Crossbeam effective width',
        formula: 'wcb = cl + d (each side d/2 from face)',
        substitution: `${col.cl} + ${d.toFixed(1)}`,
        result: `wcb = ${crossbeamWidth.toFixed(0)} mm`,
      },
      {
        title: 'Mu in crossbeam',
        formula: 'Mu = qnu · cant² / 2 · wcb',
        substitution: `${qnu.toFixed(1)} · ${(cantilever/1000).toFixed(3)}² / 2 · ${(crossbeamWidth/1000).toFixed(3)}`,
        result: `Mu = ${Mu.toFixed(1)} kN·m`,
      },
      {
        title: `AsReq / AsMin / AsProv (column ${columnIdx})`,
        formula: 'AsProv = ' + r.bottomTrans.count + ' × ' + r.bottomTrans.bar + ' total; band = ' + barsInBand,
        substitution: '',
        result: `AsReq = ${AsReq.toFixed(0)}, AsMin = ${AsMin.toFixed(0)}, AsProv = ${AsProv.toFixed(0)} mm²`,
      },
      {
        title: 'φMn check',
        formula: 'Mu / φMn',
        substitution: `${Mu.toFixed(1)} / ${phiMn.toFixed(1)}`,
        result: `Ratio = ${ratio.toFixed(3)} ${ok ? '✓' : '✗'}`,
      },
    ],
  };
}

// ─── BEARING AT COLUMN-FOOTING INTERFACE (§22.8) per column ─────────────────

function checkBearingInterfaceForColumn(
  input: CombinedFootingInput, columnIdx: 1 | 2,
): CombinedBearingInterfaceCheck {
  const { code, geometry: g, materials: m } = input;
  const col = columnIdx === 1 ? input.column1 : input.column2;
  const phi = 0.65;
  const A1 = col.shape === 'circular' ? PI * Math.pow(col.cl / 2, 2) : col.cl * col.ct;
  const Pu = 1.2 * col.PD + 1.6 * col.PL;
  // φBn,col = φ·0.85·fʹc·A1 (column on top of footing)
  const phiBnCol = (phi * 0.85 * m.fc * A1) / 1000;     // kN
  // Confinement factor √(A2/A1) capped at 2 — A2 = lower-base area of a 2:1 cone
  // For combined footings, A2 is bounded by the slab below the column. Approximate
  // as min(B, distance to nearest edge × 2)² but practically capped at footing dim.
  // For this simplified path, use the same formula as for spread footings:
  //   factor = min(2, √(A2/A1)).  A2 estimated as (col + 4·T)² capped by footing area.
  const colMaxDim = Math.max(col.cl, col.ct);
  const A2_est = Math.min(
    Math.pow(colMaxDim + 4 * g.T, 2),
    g.B * g.L,
  );
  const factor = Math.min(2, Math.sqrt(A2_est / A1));
  const phiBnFtg = phiBnCol * factor;
  const phiBn = Math.min(phiBnCol, phiBnFtg);
  const ratio = Pu / Math.max(phiBn, 1e-9);
  const ok = ratio <= 1;

  return {
    column: columnIdx, Pu, phiBnCol, phiBnFtg, phiBn, ratio, ok,
    ref: ref(code, '22.8'),
    steps: [
      {
        title: `Column ${columnIdx} bearing area`,
        formula: 'A1 = column gross area; A2 = (col + 4·T)² capped by footing area',
        substitution: `A1 = ${A1.toFixed(0)} mm²; A2 ≈ ${A2_est.toFixed(0)} mm²; √(A2/A1) capped at 2 = ${factor.toFixed(3)}`,
        result: `factor = ${factor.toFixed(3)}`,
      },
      {
        title: `Column ${columnIdx} φBn,col and φBn,ftg`,
        formula: 'φBn,col = φ·0.85·fʹc·A1;   φBn,ftg = φBn,col · √(A2/A1)',
        substitution: `0.65·0.85·${m.fc}·${A1.toFixed(0)}`,
        result: `φBn,col = ${phiBnCol.toFixed(1)} kN, φBn,ftg = ${phiBnFtg.toFixed(1)} kN`,
        ref: ref(code, '22.8.3'),
      },
      {
        title: `Column ${columnIdx} demand`,
        formula: 'Pu / φBn',
        substitution: `${Pu.toFixed(1)} / ${phiBn.toFixed(1)}`,
        result: `Ratio = ${ratio.toFixed(3)} ${ok ? '✓' : '✗ FAIL — add dowels'}`,
      },
    ],
  };
}

// ─── BAR FIT / SPACING (§25.2.1 + §13.3.4) per layer ────────────────────────

function checkBarFitForLayer(
  input: CombinedFootingInput, layerKey: 'bottomLong' | 'topLong' | 'bottomTrans',
): CombinedBarFitCheck {
  const { code, geometry: g } = input;
  const layer = layerKey === 'topLong'
    ? (input.reinforcement.topLong ?? input.reinforcement.bottomLong)
    : layerKey === 'bottomTrans'
      ? input.reinforcement.bottomTrans
      : input.reinforcement.bottomLong;
  const dbBar = barDiameter(layer.bar);
  const dagg = 19;
  // For long bars: bars distributed across width B; for trans bars: distributed across length L
  const distAcross = (layerKey === 'bottomTrans') ? g.L : g.B;
  const usable = distAcross - 2 * g.coverClear;
  const s_clear = layer.count > 1
    ? (usable - layer.count * dbBar) / (layer.count - 1)
    : usable;
  const s_min = Math.max(25, dbBar, (4 / 3) * dagg);
  const s_max = Math.min(3 * g.T, 450);
  const ok = s_clear >= s_min && s_clear <= s_max;

  return {
    layer: layerKey, s_clear, s_min, s_max, ok,
    ref: ref(code, '25.2.1 / 13.3.4'),
    steps: [
      {
        title: `${layerKey}: clear spacing`,
        formula: 'sclear = (distAcross − 2·cover − n·db) / (n − 1)',
        substitution: `${distAcross} − ${2 * g.coverClear} − ${layer.count}·${dbBar.toFixed(1)} / ${layer.count - 1}`,
        result: `sclear = ${s_clear.toFixed(0)} mm`,
      },
      {
        title: `${layerKey}: min/max bounds`,
        formula: 'smin = max(25, db, 4/3·dagg);  smax = min(3·T, 450)',
        substitution: `smin = ${s_min.toFixed(0)} mm; smax = ${s_max.toFixed(0)} mm`,
        result: ok ? '✓ within bounds' : (s_clear < s_min ? '✗ too tight' : '✗ too sparse'),
      },
    ],
  };
}

// ─── DEVELOPMENT LENGTH (§25.4.2.3) per layer ───────────────────────────────

function checkDevelopmentForLayer(
  input: CombinedFootingInput, layerKey: 'bottomLong' | 'bottomTrans',
): CombinedDevelopmentCheck {
  const { code, geometry: g, materials: m } = input;
  const layer = layerKey === 'bottomTrans'
    ? input.reinforcement.bottomTrans
    : input.reinforcement.bottomLong;
  const dbBar = barDiameter(layer.bar);
  const psiT = 1.0, psiE = 1.0;
  const psiG = m.fy <= 420 ? 1.0 : m.fy <= 550 ? 1.15 : 1.3;
  const lambda = m.lambdaC ?? 1.0;
  const divisor = dbBar <= 19 ? 1.4 : 1.1;
  const ld_ratio = (m.fy * psiT * psiE * psiG) / (divisor * lambda * Math.sqrt(m.fc));
  const ld = ld_ratio * dbBar;
  // Available embedment: longest cantilever from face of column to footing edge
  // For long bars: cantilever along L direction
  // For trans bars: cantilever along B direction
  const colDim = layerKey === 'bottomTrans'
    ? Math.max(input.column1.ct, input.column2.ct)
    : Math.max(input.column1.cl, input.column2.cl);
  const dim = layerKey === 'bottomTrans' ? g.B : g.L;
  const cantilever = (dim - colDim) / 2;
  const embedment = Math.max(0, cantilever - g.coverClear);
  const ldh = Math.max(150, 8 * dbBar, (0.24 * m.fy / (lambda * Math.sqrt(m.fc))) * dbBar);
  const hookRequired = embedment < ld;
  const okStraight = embedment >= ld;
  const okHook = embedment >= ldh;
  const ok = okStraight || okHook;

  return {
    layer: layerKey, ld, embedment, hookRequired, ldh, ok,
    ref: ref(code, '25.4.2.3 / 25.4.3'),
    steps: [
      {
        title: `${layerKey}: straight ld`,
        formula: 'ld = fy·ψT·ψE·ψG / (divisor·λ·√fʹc) · db',
        substitution: `divisor = ${divisor}; ψG = ${psiG.toFixed(2)}`,
        result: `ld = ${ld.toFixed(0)} mm; embedment = ${embedment.toFixed(0)} mm ${okStraight ? '✓ straight bar OK' : '— hook required'}`,
      },
      {
        title: `${layerKey}: hooked ldh`,
        formula: 'ldh = max(150, 8·db, 0.24·fy/(λ·√fʹc)·db)',
        substitution: '',
        result: `ldh = ${ldh.toFixed(0)} mm ${okHook ? '✓ hook fits' : '✗ even hook does not fit'}`,
      },
    ],
  };
}

// ─── ENTRY POINT ────────────────────────────────────────────────────────────

export function analyzeCombinedFooting(input: CombinedFootingInput): CombinedFootingAnalysis {
  const warnings: string[] = [];
  // Resolve leftEdge if not provided (auto)
  if (input.geometry.leftEdge === undefined) {
    const P1 = input.column1.PD + input.column1.PL;
    const P2 = input.column2.PD + input.column2.PL;
    const xR = (P1 * input.column1.position + P2 * input.column2.position) / Math.max(P1 + P2, 1e-9);
    input.geometry = { ...input.geometry, leftEdge: xR - input.geometry.L / 2 };
  }

  const bearing = checkBearing(input);
  const beam = analyzeLongitudinalBeam(input);
  const punching1 = checkPunchingAtColumn(input, 1);
  const punching2 = checkPunchingAtColumn(input, 2);
  const shearLong = checkLongOneWayShear(input, beam);
  const flexLongPos = checkLongFlexure(input, beam, 'positive');
  const flexLongNeg = checkLongFlexure(input, beam, 'negative');
  const flexTrans1 = checkTransFlexure(input, 1);
  const flexTrans2 = checkTransFlexure(input, 2);
  const bearingInterface1 = checkBearingInterfaceForColumn(input, 1);
  const bearingInterface2 = checkBearingInterfaceForColumn(input, 2);
  const barFitBotLong = checkBarFitForLayer(input, 'bottomLong');
  const barFitTopLong = checkBarFitForLayer(input, 'topLong');
  const barFitBotTrans = checkBarFitForLayer(input, 'bottomTrans');
  const developmentBotLong = checkDevelopmentForLayer(input, 'bottomLong');
  const developmentBotTrans = checkDevelopmentForLayer(input, 'bottomTrans');

  if (!bearing.ok) warnings.push(`Bearing fails — qmax = ${bearing.q_max.toFixed(1)} > qa.`);
  if (Math.abs(bearing.centroidOffset) > 50) {
    warnings.push(`Footing centroid is ${bearing.centroidOffset.toFixed(0)} mm from load resultant → trapezoidal pressure. Resize for uniform.`);
  }
  if (!punching1.ok) warnings.push(`Punching at column 1 fails (ratio ${punching1.ratio.toFixed(2)}).`);
  if (!punching2.ok) warnings.push(`Punching at column 2 fails (ratio ${punching2.ratio.toFixed(2)}).`);
  if (!shearLong.ok) warnings.push(`Longitudinal one-way shear fails (ratio ${shearLong.ratio.toFixed(2)}).`);
  if (!flexLongPos.ok) warnings.push(`Positive-moment flexure fails — increase bottom-long bars.`);
  if (!flexLongNeg.ok) warnings.push(`Negative-moment flexure fails — increase top-long bars.`);
  if (!flexTrans1.ok) warnings.push(`Transverse flexure at column 1 fails.`);
  if (!flexTrans2.ok) warnings.push(`Transverse flexure at column 2 fails.`);
  if (!bearingInterface1.ok) warnings.push(`Column-1 bearing interface fails (Pu/φBn = ${bearingInterface1.ratio.toFixed(2)}). Add dowels per §16.3.4.1.`);
  if (!bearingInterface2.ok) warnings.push(`Column-2 bearing interface fails (Pu/φBn = ${bearingInterface2.ratio.toFixed(2)}). Add dowels per §16.3.4.1.`);
  if (!barFitBotLong.ok) warnings.push(`Bottom-long bar spacing out of bounds (sclear = ${barFitBotLong.s_clear.toFixed(0)} mm).`);
  if (!barFitTopLong.ok) warnings.push(`Top-long bar spacing out of bounds (sclear = ${barFitTopLong.s_clear.toFixed(0)} mm).`);
  if (!barFitBotTrans.ok) warnings.push(`Bottom-trans bar spacing out of bounds (sclear = ${barFitBotTrans.s_clear.toFixed(0)} mm).`);
  if (!developmentBotLong.ok) warnings.push(`Bottom-long bars cannot develop even with hook — increase footing.`);
  if (!developmentBotTrans.ok) warnings.push(`Bottom-trans bars cannot develop even with hook — increase footing.`);

  const A_m2 = (input.geometry.B * input.geometry.L) / 1e6;
  const qnu = (beam.Pu1 + beam.Pu2) / A_m2;

  const ok = bearing.ok && punching1.ok && punching2.ok && shearLong.ok
          && flexLongPos.ok && flexLongNeg.ok && flexTrans1.ok && flexTrans2.ok
          && bearingInterface1.ok && bearingInterface2.ok
          && barFitBotLong.ok && barFitTopLong.ok && barFitBotTrans.ok
          && developmentBotLong.ok && developmentBotTrans.ok;

  return {
    input, bearing, beam, punching1, punching2, shearLong,
    flexLongPos, flexLongNeg, flexTrans1, flexTrans2,
    bearingInterface1, bearingInterface2,
    barFitBotLong, barFitTopLong, barFitBotTrans,
    developmentBotLong, developmentBotTrans,
    qnu, ok, warnings, solved: true,
  };
}

void barArea;     // keep import side-effects
void analyzeLongitudinalBeam;     // keep export-style
