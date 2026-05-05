/**
 * Mat Foundation Solver — Phase C
 * --------------------------------
 *
 * Conventional rigid-method analysis per ACI 318-25 §13.3.4 and Wight 7e §15-7.
 *
 * Design steps in this kickoff:
 *   1. Bearing — total load + resultant location → eccentric pressure at the
 *      4 corners (bilinear). Check q_max ≤ qa.
 *   2. Two-way (punching) shear at EACH column independently per §22.6,
 *      with αs auto-detected based on proximity to mat edges.
 *
 * Strip-method flexure (column-line beams) is in a follow-up commit; the
 * current implementation flags geometry sufficient to validate sizing and
 * column-by-column punching, which is the critical limit state for mats.
 */

import type {
  MatFoundationInput, MatFoundationAnalysis,
  MatBearingCheck, MatPunchingCheck, MatColumn,
} from './types';
import type { CalcStep } from '../footing/types';
import { barDiameter } from '../rc/types';

const PI = Math.PI;

function ref(code: 'ACI 318-25' | 'ACI 318-19', section: string): string {
  if (code === 'ACI 318-19') return `ACI 318-19 §${section}`;
  return `ACI 318-25 §${section}`;
}

// ─── BEARING (rigid-method bilinear pressure) ───────────────────────────────

function checkBearing(input: MatFoundationInput): MatBearingCheck {
  const { code, geometry: g, soil, columns } = input;
  const gammaC = soil.gammaConcrete ?? 24;
  const gammaS = soil.gammaSoil ?? 18;

  const A_m2 = (g.B * g.L) / 1e6;
  const B_m = g.B / 1000;
  const L_m = g.L / 1000;
  const Wf = gammaC * A_m2 * (g.T / 1000);
  const Ws = gammaS * A_m2 * ((g.embedment ?? 0) / 1000);

  // Sum service column loads + applied moments
  let Pcols = 0;
  let MxTotal_kNm = 0;     // moment about X-axis of mat (= ΣP·y_offset_from_centre + ΣMx_applied)
  let MyTotal_kNm = 0;
  for (const c of columns) {
    const P = c.PD + c.PL;
    Pcols += P;
    // Position relative to mat centroid (B/2, L/2)
    const xRel_m = (c.x - g.B / 2) / 1000;
    const yRel_m = (c.y - g.L / 2) / 1000;
    // Sign convention: My (about Y-axis) caused by load offset in X
    //                  Mx (about X-axis) caused by load offset in Y
    MyTotal_kNm += P * xRel_m + (c.My ?? 0);
    MxTotal_kNm += P * yRel_m + (c.Mx ?? 0);
  }

  const P_service = Pcols + Wf + Ws;
  const q_avg = P_service / A_m2;

  // Resultant location (mat-local coordinates)
  const xResultant = g.B / 2 + (MyTotal_kNm * 1000) / Math.max(P_service, 1e-9);
  const yResultant = g.L / 2 + (MxTotal_kNm * 1000) / Math.max(P_service, 1e-9);
  const eX = xResultant - g.B / 2;     // mm
  const eY = yResultant - g.L / 2;

  // Bilinear pressure: q(x, y) = P/A + 6·My·x_rel/(L·B²) + 6·Mx·y_rel/(B·L²)
  // where x_rel ∈ [-B/2, +B/2] and y_rel ∈ [-L/2, +L/2]
  const dqMx = (6 * Math.abs(MxTotal_kNm)) / (B_m * Math.pow(L_m, 2));     // gradient along Y
  const dqMy = (6 * Math.abs(MyTotal_kNm)) / (L_m * Math.pow(B_m, 2));     // gradient along X
  // Sign-aware corner pressures
  const sX = Math.sign(MyTotal_kNm) || 0;
  const sY = Math.sign(MxTotal_kNm) || 0;
  // q at (xRel, yRel) = q_avg + sX·dqMy·(xRel/(B/2)) + sY·dqMx·(yRel/(L/2))
  function qAtCorner(xRel: number, yRel: number): number {
    return q_avg
      + sX * dqMy * (2 * xRel / B_m)
      + sY * dqMx * (2 * yRel / L_m);
  }
  const q_BL = qAtCorner(-B_m / 2, -L_m / 2);
  const q_BR = qAtCorner(+B_m / 2, -L_m / 2);
  const q_TL = qAtCorner(-B_m / 2, +L_m / 2);
  const q_TR = qAtCorner(+B_m / 2, +L_m / 2);
  const q_max = Math.max(q_BL, q_BR, q_TL, q_TR);
  const q_min = Math.min(q_BL, q_BR, q_TL, q_TR);

  const ratio = q_max / soil.qa;
  const ok = q_max <= soil.qa;

  return {
    P_service, Wf, Ws, A: A_m2, q_avg,
    xResultant, yResultant, eX, eY,
    q_corner_BL: q_BL, q_corner_BR: q_BR,
    q_corner_TL: q_TL, q_corner_TR: q_TR,
    q_max, q_min,
    ratio, ok,
    ref: ref(code, '13.3.1'),
    steps: [
      {
        title: 'Service load summation',
        formula: 'Pservice = ΣP_col + Wf + Ws',
        substitution: `${columns.length} columns: ΣP = ${Pcols.toFixed(1)} kN; Wf = ${Wf.toFixed(1)}; Ws = ${Ws.toFixed(1)}`,
        result: `Pservice = ${P_service.toFixed(1)} kN, qavg = ${q_avg.toFixed(1)} kPa`,
      },
      {
        title: 'Resultant of column loads (rigid-method)',
        formula: 'xR = ΣP_i·x_i / ΣP_i;  similarly yR',
        substitution: `eccentricity from centre = (${eX.toFixed(0)}, ${eY.toFixed(0)}) mm`,
        result: `Resultant at (${xResultant.toFixed(0)}, ${yResultant.toFixed(0)}) mm in mat-local coords`,
      },
      {
        title: 'Bilinear corner pressures',
        formula: 'q(x,y) = P/A ± 6·Mx·c_y/(B·L²) ± 6·My·c_x/(L·B²)',
        substitution: `dq_Mx = ${dqMx.toFixed(1)} kPa, dq_My = ${dqMy.toFixed(1)} kPa`,
        result: `BL=${q_BL.toFixed(1)}, BR=${q_BR.toFixed(1)}, TL=${q_TL.toFixed(1)}, TR=${q_TR.toFixed(1)} kPa`,
      },
      {
        title: 'qmax vs allowable',
        formula: 'qmax ≤ qa',
        substitution: `${q_max.toFixed(1)} kPa  vs  ${soil.qa} kPa`,
        result: `Ratio = ${ratio.toFixed(3)} ${ok ? '✓' : '✗ FAIL — increase mat dimensions'}`,
        ref: ref(code, '13.3.1'),
      },
    ],
  };
}

// ─── COLUMN-LOCATION DETECTION ─────────────────────────────────────────────

function detectColumnLocation(
  c: MatColumn, B: number, L: number,
): 'interior' | 'edge' | 'corner' {
  // If user explicitly specified, honour it.
  if (c.columnLocation) return c.columnLocation;
  // Else infer from proximity to mat edges. Tolerance = 1.5·max(cx, cy):
  // if the column is within that distance of an edge, it's an edge column;
  // if within of two edges, corner.
  const colMaxDim = Math.max(c.cx, c.cy ?? c.cx);
  const tol = 1.5 * colMaxDim;
  const nearLeft = c.x - c.cx / 2 < tol;
  const nearRight = (B - c.x) - c.cx / 2 < tol;
  const nearBottom = c.y - (c.cy ?? c.cx) / 2 < tol;
  const nearTop = (L - c.y) - (c.cy ?? c.cx) / 2 < tol;
  const edgeCount = (nearLeft ? 1 : 0) + (nearRight ? 1 : 0)
                  + (nearBottom ? 1 : 0) + (nearTop ? 1 : 0);
  if (edgeCount >= 2) return 'corner';
  if (edgeCount === 1) return 'edge';
  return 'interior';
}

// ─── PUNCHING SHEAR AT A COLUMN ─────────────────────────────────────────────

function checkPunchingAtColumn(
  input: MatFoundationInput, col: MatColumn, qnu: number,
): MatPunchingCheck {
  const { code, geometry: g, materials: m } = input;
  const fc = m.fc;
  const lambda = m.lambdaC ?? 1.0;
  const phi = 0.75;
  // d based on the smaller bar of the bottom mat
  const dbBar = Math.min(
    barDiameter(input.reinforcement.bottomX.bar),
    barDiameter(input.reinforcement.bottomY.bar),
  );
  const d = g.T - g.coverClear - dbBar / 2;

  const sqrtFc = Math.sqrt(fc);
  const cy_eff = col.shape === 'circular' ? col.cx : (col.cy ?? col.cx);

  let bo: number, A_punch_mm2: number;
  if (col.shape === 'circular') {
    const dCrit = col.cx + d;
    bo = PI * dCrit;
    A_punch_mm2 = PI * Math.pow(dCrit / 2, 2);
  } else {
    const ax = col.cx + d;
    const ay = cy_eff + d;
    bo = 2 * (ax + ay);
    A_punch_mm2 = ax * ay;
  }

  const betaC = Math.max(col.cx, cy_eff) / Math.min(col.cx, cy_eff);
  const location = detectColumnLocation(col, g.B, g.L);
  const alphaS = location === 'edge' ? 30 : location === 'corner' ? 20 : 40;

  const vc1 = 0.33 * lambda * sqrtFc;
  const vc2 = 0.17 * (1 + 2 / betaC) * lambda * sqrtFc;
  const vc3 = 0.083 * (alphaS * d / bo + 2) * lambda * sqrtFc;
  const vc = Math.min(vc1, vc2, vc3);

  const phiVc = (phi * vc * bo * d) / 1000;     // kN
  const Pu_col = 1.2 * col.PD + 1.6 * col.PL;
  const Vu = Pu_col - qnu * (A_punch_mm2 / 1e6);     // kN
  const vuv = (Vu * 1000) / Math.max(bo * d, 1e-9);     // MPa

  const ratio = Vu / Math.max(phiVc, 1e-9);
  const ok = ratio <= 1;

  return {
    columnId: col.id, location, bo, d, betaC, alphaS, vc, phiVc, Vu, vuv,
    ratio, ok,
    ref: ref(code, '22.6'),
    steps: [
      {
        title: `Column ${col.id} — location class`,
        formula: 'Auto-detected from proximity to mat edges',
        substitution: `(x, y) = (${col.x}, ${col.y}) mm; mat = ${g.B}×${g.L} mm`,
        result: `${location} column → αs = ${alphaS}`,
        ref: ref(code, '22.6.5.3'),
      },
      {
        title: `Critical perimeter at column ${col.id}`,
        formula: col.shape === 'circular' ? 'bo = π·(D + d)' : 'bo = 2·(cx + d) + 2·(cy + d)',
        substitution: `cx = ${col.cx}, cy = ${cy_eff}, d = ${d.toFixed(1)} mm`,
        result: `bo = ${bo.toFixed(0)} mm, βc = ${betaC.toFixed(2)}`,
      },
      {
        title: `vc, φVc at column ${col.id}`,
        formula: 'vc = min(vc1, vc2, vc3) per Table 22.6.5.2',
        substitution: `vc1 = ${vc1.toFixed(3)}, vc2 = ${vc2.toFixed(3)}, vc3 = ${vc3.toFixed(3)} MPa`,
        result: `vc = ${vc.toFixed(3)} MPa, φVc = ${phiVc.toFixed(1)} kN`,
      },
      {
        title: `Demand at column ${col.id}`,
        formula: 'Vu = Pu_col − qnu × A_punch',
        substitution: `${Pu_col.toFixed(1)} − ${qnu.toFixed(1)}·${(A_punch_mm2/1e6).toFixed(4)}`,
        result: `Vu = ${Vu.toFixed(1)} kN  →  ratio = ${ratio.toFixed(3)} ${ok ? '✓' : '✗'}`,
      },
    ],
  };
}

// ─── ENTRY POINT ────────────────────────────────────────────────────────────

export function analyzeMatFoundation(input: MatFoundationInput): MatFoundationAnalysis {
  const warnings: string[] = [];

  const bearing = checkBearing(input);

  // Factored uniform pressure for punching (rigid-method qnu = ΣPu / A)
  const A_m2 = (input.geometry.B * input.geometry.L) / 1e6;
  const sumPu = input.columns.reduce(
    (acc, c) => acc + 1.2 * c.PD + 1.6 * c.PL, 0,
  );
  const qnu_avg = sumPu / A_m2;

  const punching = input.columns.map((c) =>
    checkPunchingAtColumn(input, c, qnu_avg),
  );

  if (!bearing.ok) {
    warnings.push(`Bearing fails — qmax = ${bearing.q_max.toFixed(1)} kPa > qa = ${input.soil.qa} kPa.`);
  }
  for (const p of punching) {
    if (!p.ok) {
      warnings.push(`Punching at column ${p.columnId} fails — ratio = ${p.ratio.toFixed(2)}. Increase T or add headed shear studs.`);
    }
  }
  if (input.geometry.T < 600) {
    warnings.push(`Mat thickness ${input.geometry.T} mm is below typical 600-1500 mm range. Verify stiffness.`);
  }
  // ACI 318-25 R13.3.4.4: continuous reinforcement near both faces is recommended
  // for thick two-way slabs (mats). We don't validate this strictly but warn.
  warnings.push(`Per ACI 318-25 R13.3.4.4: continuous top + bottom reinforcement in BOTH directions is recommended for crack control and to intercept punching cracks.`);

  const ok = bearing.ok && punching.every((p) => p.ok);

  return {
    input, bearing, punching, qnu_avg, ok, warnings, solved: true,
  };
}
