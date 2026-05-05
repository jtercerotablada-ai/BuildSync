// ============================================================================
// Foundation Design — Solver
// ============================================================================
// Phase 7 — Isolated spread footing per ACI 318-25.
//
// Implements:
//   • §13 — Foundations (general design)
//   • §22.5.5.1(a) — One-way shear (Vc = 0.17·λ·√fc'·bw·d)
//   • §22.6 — Two-way (punching) shear — Table 22.6.5.2 with three vc values
//   • §22.8 — Bearing at member interfaces
//   • §13.3.3 — Flexure at face of column
//   • §8.6.1.1 — Min reinforcement (0.0018·Ag for fy = 420 MPa)
//
// Design flow:
//   1. SIZE: pick B, L from service loads + qa.
//   2. THICKNESS: from punching shear governs typically.
//   3. FLEXURE: bottom rebar each way at face of column.
//   4. ONE-WAY SHEAR: check at d from column face each way.
//   5. PUNCHING: check at d/2 perimeter.
//   6. BEARING: column-footing interface.

import type {
  FootingInput, FootingAnalysis, BearingCheck, PunchingCheck,
  OneWayShearCheck, FootingFlexureCheck, BearingInterfaceCheck, CalcStep,
  Code, OverturningCheck, SlidingCheck, BarFitCheck, DevelopmentCheck,
} from './types';
import { barArea, barDiameter } from '../rc/types';

const PI = Math.PI;

function ref(code: Code, section: string): string {
  if (code === 'ACI 318-19') return `ACI 318-19 §${section}`;
  return `ACI 318-25 §${section}`;
}

// ─── BEARING (service-load soil pressure) ───────────────────────────────────

function checkBearing(
  input: FootingInput,
): BearingCheck & { Wf_kN: number; Ws_kN: number; upliftRegion: boolean } {
  const { code, geometry: g, soil, loads: L } = input;
  const gammaC = soil.gammaConcrete ?? 24;
  const gammaS = soil.gammaSoil ?? 18;
  const A = (g.B * g.L) / 1e6;          // m²
  const B_m = g.B / 1000;
  const L_m = g.L / 1000;
  // Self-weight of the footing concrete (kN)
  const Wf_kN = gammaC * A * (g.T / 1000);
  // Soil overburden ON TOP of the footing if embedded (kN)
  const overburdenDepth_m = (g.embedment ?? 0) / 1000;
  const Ws_kN = gammaS * A * overburdenDepth_m;
  // Total service vertical load (column DL+LL + footing self-weight + overburden)
  const P_service = L.PD + L.PL + Wf_kN + Ws_kN;
  // Required area at allowable bearing
  const A_req = P_service / soil.qa;     // m²
  const A_req_mm2 = A_req * 1e6;

  // Effective eccentricity from applied moments + column eccentricity
  // ACI / Bowles convention: e = M/P measured from footing centroid.
  const Mx_total = (L.Mx ?? 0) + (L.PD + L.PL) * (g.ex ?? 0) / 1000;
  const My_total = (L.My ?? 0) + (L.PD + L.PL) * (g.ey ?? 0) / 1000;
  const eX_m = Math.abs(Mx_total) / Math.max(P_service, 1e-9);
  const eY_m = Math.abs(My_total) / Math.max(P_service, 1e-9);
  // Kern limits: |e| ≤ B/6 (or L/6) for resultant to stay within kern → trapezoid.
  // Outside kern → triangular (Bowles): qmax = 2·P / (3·(B/2 − e)·L_perp)
  const kernX = B_m / 6;
  const kernY = L_m / 6;
  const outsideKernX = eX_m > kernX;
  const outsideKernY = eY_m > kernY;
  const upliftRegion = outsideKernX || outsideKernY;

  const q_avg = P_service / A;
  let q_max: number;
  let q_min: number;
  if (!upliftRegion) {
    // Trapezoidal distribution (within kern)
    const dqx = Math.abs(Mx_total) * 6 / (B_m * B_m * L_m);
    const dqy = Math.abs(My_total) * 6 / (L_m * L_m * B_m);
    q_max = q_avg + dqx + dqy;
    q_min = q_avg - dqx - dqy;
  } else {
    // Triangular (Bowles) — partial uplift. For dominant axis:
    //   qmax = 2·P / (3·(B/2 − e_dom)·L_perp)
    // For both axes outside kern, use product of effective lengths.
    const effB = Math.max(B_m / 2 - eX_m, 1e-3) * 3;     // 3·(B/2−e)
    const effL = Math.max(L_m / 2 - eY_m, 1e-3) * 3;
    const denom_axis_x = effB * L_m;     // pressure along X with full L_perp
    const denom_axis_y = effL * B_m;
    if (outsideKernX && !outsideKernY) {
      q_max = 2 * P_service / denom_axis_x;
      q_min = 0;
    } else if (outsideKernY && !outsideKernX) {
      q_max = 2 * P_service / denom_axis_y;
      q_min = 0;
    } else {
      // Both axes outside kern (worst case)
      q_max = 4 * P_service / (effB * effL);
      q_min = 0;
    }
  }

  const ratio = q_max / soil.qa;
  // ok: q_max ≤ qa AND no excessive uplift (q_min ≥ 0 always since trapezoid
  // hits zero at the kern boundary, which is the design limit).
  const ok = q_max <= soil.qa && !upliftRegion;

  const steps: CalcStep[] = [
    {
      title: 'Footing self-weight Wf',
      formula: 'Wf = γc × B × L × T',
      substitution: `Wf = ${gammaC}·${B_m.toFixed(2)}·${L_m.toFixed(2)}·${(g.T / 1000).toFixed(2)}`,
      result: `Wf = ${Wf_kN.toFixed(2)} kN`,
    },
    {
      title: 'Soil overburden Ws',
      formula: 'Ws = γs × B × L × embedment',
      substitution: `Ws = ${gammaS}·${B_m.toFixed(2)}·${L_m.toFixed(2)}·${overburdenDepth_m.toFixed(2)}`,
      result: `Ws = ${Ws_kN.toFixed(2)} kN`,
    },
    {
      title: 'Total service load Pservice',
      formula: 'Pservice = PD + PL + Wf + Ws',
      substitution: `Pservice = ${L.PD} + ${L.PL} + ${Wf_kN.toFixed(2)} + ${Ws_kN.toFixed(2)}`,
      result: `Pservice = ${P_service.toFixed(2)} kN`,
    },
    {
      title: 'Required footing area Areq',
      formula: 'Areq = Pservice / qa',
      substitution: `Areq = ${P_service.toFixed(2)} / ${soil.qa}`,
      result: `Areq = ${A_req.toFixed(3)} m² (provided ${A.toFixed(3)} m²) ${A >= A_req ? '✓' : '✗'}`,
      ref: ref(code, '13.3.1'),
    },
    {
      title: 'Effective eccentricity (M/P) and kern check',
      formula: 'eX = Mx / P, eY = My / P;  kern: B/6, L/6',
      substitution: `eX = ${eX_m.toFixed(3)} m vs B/6 = ${kernX.toFixed(3)} m; eY = ${eY_m.toFixed(3)} m vs L/6 = ${kernY.toFixed(3)} m`,
      result: upliftRegion ? '✗ Outside kern → partial uplift (Bowles triangular)' : '✓ Within kern → trapezoidal pressure',
    },
    upliftRegion ? {
      title: 'Maximum service soil pressure qmax (Bowles triangle)',
      formula: 'qmax = 2·P / (3·(B/2 − e)·Lperp)',
      substitution: 'partial uplift detected',
      result: `qmax = ${q_max.toFixed(1)} kPa (allow ${soil.qa} kPa) ${q_max <= soil.qa ? '✓' : '✗'}`,
    } : {
      title: 'Maximum service soil pressure qmax (trapezoidal)',
      formula: 'qmax = P/A + 6·Mx/(B²·L) + 6·My/(L²·B)',
      substitution: `qavg = ${q_avg.toFixed(1)} kPa`,
      result: `qmax = ${q_max.toFixed(1)} kPa (allow ${soil.qa} kPa) ${q_max <= soil.qa ? '✓' : '✗'}`,
    },
  ];

  return {
    P_service, A_req: A_req_mm2, A_prov: g.B * g.L, q_max, q_min,
    ratio, ok,
    ref: ref(code, '13.3.1'),
    steps,
    Wf_kN, Ws_kN,
    upliftRegion,
  };
}

// ─── FACTORED NET SOIL PRESSURE ─────────────────────────────────────────────

function factoredNetPressure(input: FootingInput): number {
  // Factored loads excluding footing self-weight (which is balanced by overburden + own weight)
  // qnu = (1.2·PD + 1.6·PL) / A   in kPa
  const A = (input.geometry.B * input.geometry.L) / 1e6;
  const Pu = 1.2 * input.loads.PD + 1.6 * input.loads.PL;
  return Pu / A;          // kPa
}

// ─── PUNCHING SHEAR (§22.6) ────────────────────────────────────────────────

function checkPunching(input: FootingInput, qnu: number): PunchingCheck {
  const { code, geometry: g, materials: m } = input;
  const fc = m.fc;
  const lambda = m.lambdaC ?? 1.0;
  const phi = 0.75;
  const d = g.d ?? (g.T - g.coverClear - 25);    // assume #8 bottom bar avg
  const sqrtFc = Math.sqrt(fc);

  // Critical perimeter at d/2 from column face
  let bo: number;
  let A_punch: number;        // area inside critical perimeter (mm²)
  if (g.columnShape === 'circular') {
    const dia = g.cx;
    const dCrit = dia + d;
    bo = PI * dCrit;
    A_punch = PI * Math.pow(dCrit / 2, 2);
  } else {
    const cx = g.cx;
    const cy = g.cy ?? cx;
    const ax = cx + d;
    const ay = cy + d;
    bo = 2 * (ax + ay);
    A_punch = ax * ay;
  }

  // βc: ratio of long/short of column (≥ 1)
  const cx = g.cx;
  const cy = g.columnShape === 'circular' ? g.cx : (g.cy ?? cx);
  const betaC = Math.max(cx, cy) / Math.min(cx, cy);

  // αs per §22.6.5.3: 40 interior, 30 edge, 20 corner.  Default interior.
  const alphaS = 40;

  // Three candidate vc values (MPa) per Table 22.6.5.2
  const vc1 = 0.33 * lambda * sqrtFc;
  const vc2 = 0.17 * (1 + 2 / betaC) * lambda * sqrtFc;
  const vc3 = 0.083 * (alphaS * d / bo + 2) * lambda * sqrtFc;
  const vc = Math.min(vc1, vc2, vc3);

  // Available φVc = φ·vc·bo·d (in N → kN)
  const phiVc_N = phi * vc * bo * d;
  const phiVc = phiVc_N / 1000;     // kN

  // Factored Vu at the critical perimeter:
  //   Vu = qnu × (A_footing − A_punch) — only the area OUTSIDE the punching cone
  //   contributes to the shear ON the perimeter.
  const A_footing_mm2 = g.B * g.L;
  const Vu_kN = qnu * (A_footing_mm2 - A_punch) / 1e6;     // kPa·m² = kN

  const ratio = Vu_kN / Math.max(phiVc, 1e-9);
  const ok = ratio <= 1;

  const steps: CalcStep[] = [
    {
      title: 'Critical perimeter bo at d/2 from column face',
      formula: g.columnShape === 'circular'
        ? 'bo = π·(D + d)'
        : 'bo = 2·(cx + d) + 2·(cy + d)',
      substitution: g.columnShape === 'circular'
        ? `bo = π·(${cx} + ${d.toFixed(1)})`
        : `bo = 2·(${cx} + ${d.toFixed(1)}) + 2·(${cy} + ${d.toFixed(1)})`,
      result: `bo = ${bo.toFixed(0)} mm`,
      ref: ref(code, '22.6.4.1'),
    },
    {
      title: 'Aspect ratio βc',
      formula: 'βc = longSide / shortSide ≥ 1',
      substitution: `βc = ${Math.max(cx, cy)} / ${Math.min(cx, cy)}`,
      result: `βc = ${betaC.toFixed(3)}`,
    },
    {
      title: 'vc candidates per ACI Table 22.6.5.2',
      formula: 'vc = min(0.33·λ·√fʹc, 0.17·(1+2/βc)·λ·√fʹc, 0.083·(αs·d/bo+2)·λ·√fʹc)',
      substitution: `vc1 = ${vc1.toFixed(3)}, vc2 = ${vc2.toFixed(3)}, vc3 = ${vc3.toFixed(3)} MPa`,
      result: `vc = ${vc.toFixed(3)} MPa`,
      ref: ref(code, '22.6.5'),
    },
    {
      title: 'φVc punching capacity',
      formula: 'φVc = φ·vc·bo·d (φ = 0.75)',
      substitution: `φVc = 0.75·${vc.toFixed(3)}·${bo.toFixed(0)}·${d.toFixed(1)}/1000`,
      result: `φVc = ${phiVc.toFixed(2)} kN`,
    },
    {
      title: 'Punching shear demand Vu',
      formula: 'Vu = qnu · (Afooting − Apunch)',
      substitution: `Vu = ${qnu.toFixed(1)}·(${(A_footing_mm2 / 1e6).toFixed(3)} − ${(A_punch / 1e6).toFixed(3)}) m²`,
      result: `Vu = ${Vu_kN.toFixed(2)} kN`,
    },
    {
      title: 'Punching shear ratio',
      formula: 'Vu / φVc',
      substitution: `${Vu_kN.toFixed(2)} / ${phiVc.toFixed(2)}`,
      result: `Ratio = ${ratio.toFixed(3)} ${ok ? '✓' : '✗ FAIL — increase footing depth'}`,
    },
  ];

  return {
    bo, d, betaC, alphaS, vc1, vc2, vc3, vc, phiVc, Vu: Vu_kN,
    ratio, ok, ref: ref(code, '22.6'), steps,
  };
}

// ─── ONE-WAY SHEAR (§22.5.5.1(a)) ──────────────────────────────────────────

function checkOneWayShear(
  input: FootingInput, qnu: number, direction: 'X' | 'Y',
): OneWayShearCheck {
  const { code, geometry: g, materials: m } = input;
  const fc = m.fc;
  const lambda = m.lambdaC ?? 1.0;
  const phi = 0.75;
  const d = g.d ?? (g.T - g.coverClear - 25);

  // Cantilever projection from column face to footing edge
  // For X direction: critical section perpendicular to X at distance d from column face.
  // Footing extends ±B/2 along X. Column face is at ±cx/2. Cantilever = (B/2 - cx/2 - d).
  const colDimSelf = direction === 'X' ? g.cx : (g.columnShape === 'circular' ? g.cx : (g.cy ?? g.cx));
  const footingDimSelf = direction === 'X' ? g.B : g.L;
  const footingDimPerp = direction === 'X' ? g.L : g.B;
  const cantileverFromFace = (footingDimSelf - colDimSelf) / 2;
  const cantileverFromCritical = Math.max(0, cantileverFromFace - d);
  const bw = footingDimPerp;

  const Vc_N = 0.17 * lambda * Math.sqrt(fc) * bw * d;
  const phiVc_N = phi * Vc_N;
  const phiVc = phiVc_N / 1000;     // kN

  // Tributary area for shear: cantileverFromCritical × bw  (mm²)
  const Atrib_mm2 = cantileverFromCritical * bw;
  const Vu_kN = qnu * Atrib_mm2 / 1e6;

  const ratio = Vu_kN / Math.max(phiVc, 1e-9);
  const ok = ratio <= 1;

  const steps: CalcStep[] = [
    {
      title: `One-way shear ${direction} — critical section at d from column face`,
      formula: 'critical section: x = columnFace + d',
      substitution: `cantilever from face = ${(cantileverFromFace / 1000).toFixed(3)} m, − d = ${(cantileverFromCritical / 1000).toFixed(3)} m remaining`,
      result: `tributary = ${(Atrib_mm2 / 1e6).toFixed(3)} m²`,
      ref: ref(code, '7.4.3.2'),
    },
    {
      title: 'Vc per ACI §22.5.5.1(a)',
      formula: 'Vc = 0.17·λ·√fʹc·bw·d',
      substitution: `Vc = 0.17·${lambda}·√${fc}·${bw}·${d.toFixed(1)} / 1000`,
      result: `Vc = ${(Vc_N / 1000).toFixed(2)} kN, φVc = ${phiVc.toFixed(2)} kN`,
      ref: ref(code, '22.5.5.1'),
    },
    {
      title: 'Vu',
      formula: 'Vu = qnu × tributaryArea',
      substitution: `Vu = ${qnu.toFixed(1)}·${(Atrib_mm2 / 1e6).toFixed(3)}`,
      result: `Vu = ${Vu_kN.toFixed(2)} kN ${ok ? '✓' : '✗ FAIL'}`,
    },
  ];

  return {
    direction, bw, d, cantilever: cantileverFromFace,
    Vc: Vc_N / 1000, phiVc, Vu: Vu_kN,
    ratio, ok, ref: ref(code, '22.5.5.1'), steps,
  };
}

// ─── FLEXURE (§13.3.3) ─────────────────────────────────────────────────────

function checkFootingFlexure(
  input: FootingInput, qnu: number, direction: 'X' | 'Y',
): FootingFlexureCheck {
  const { code, geometry: g, materials: m, reinforcement: r } = input;
  const fc = m.fc;
  const fy = m.fy;
  const phi = 0.90;
  const d = g.d ?? (g.T - g.coverClear - 25);

  // Cantilever from face of column to footing edge
  const colDimSelf = direction === 'X' ? g.cx : (g.columnShape === 'circular' ? g.cx : (g.cy ?? g.cx));
  const footingDimSelf = direction === 'X' ? g.B : g.L;
  const footingDimPerp = direction === 'X' ? g.L : g.B;
  const cantilever = (footingDimSelf - colDimSelf) / 2;
  const bw = footingDimPerp;

  // Mu at face of column = qnu × (cantilever²/2) × bw
  const Mu_kNm = qnu * Math.pow(cantilever / 1000, 2) / 2 * (bw / 1000);

  // AsReq (closed-form quadratic)
  const A_q = fy * fy / (2 * 0.85 * fc * bw);
  const B_q = -fy * d;
  const C_q = (Mu_kNm * 1e6) / phi;
  const disc = B_q * B_q - 4 * A_q * C_q;
  const AsReq = disc < 0 ? 0 : (-B_q - Math.sqrt(disc)) / (2 * A_q);

  // AsMin per §8.6.1.1 for fy = 420: ρ = 0.0018·b·h
  // For fy ≠ 420 MPa, ρmin = 0.0018·420/fy ≥ 0.0014 (per §8.6.1.1)
  let rhoMin: number;
  if (fy <= 420) rhoMin = 0.0020;
  else rhoMin = Math.max(0.0014, 0.0018 * 420 / fy);
  const AsMin = rhoMin * bw * g.T;

  const AsTarget = Math.max(AsReq, AsMin);

  // Provided As
  const layer = direction === 'X' ? r.bottomX : r.bottomY;
  const AsProv = layer.count * barArea(layer.bar);

  // φMn for provided As
  const a_prov = AsProv * fy / (0.85 * fc * bw);
  const Mn_prov_kNm = (AsProv * fy * (d - a_prov / 2)) / 1e6;
  const phiMn = phi * Mn_prov_kNm;

  const ratio = Mu_kNm / Math.max(phiMn, 1e-9);
  const ok = ratio <= 1 && AsProv >= AsTarget;

  const steps: CalcStep[] = [
    {
      title: `Flexure ${direction} — critical section at face of column`,
      formula: 'Mu = qnu × (cantilever²/2) × bw',
      substitution: `Mu = ${qnu.toFixed(1)}·${(cantilever / 1000).toFixed(3)}²/2·${(bw / 1000).toFixed(3)}`,
      result: `Mu = ${Mu_kNm.toFixed(2)} kN·m`,
      ref: ref(code, '13.3.3'),
    },
    {
      title: 'Required steel AsReq',
      formula: 'Mu = φ·As·fy·(d − a/2);  a = As·fy/(0.85·fc·b)',
      substitution: `Mu = ${Mu_kNm.toFixed(2)} kN·m, b = ${bw}, d = ${d.toFixed(1)}`,
      result: `AsReq = ${AsReq.toFixed(0)} mm²`,
    },
    {
      title: 'AsMin per §8.6.1.1',
      formula: fy <= 420 ? 'AsMin = 0.0020·b·h' : 'AsMin = max(0.0014, 0.0018·420/fy)·b·h',
      substitution: `ρ_min = ${rhoMin.toFixed(4)}`,
      result: `AsMin = ${AsMin.toFixed(0)} mm²`,
      ref: ref(code, '8.6.1.1'),
    },
    {
      title: 'Provided As',
      formula: 'AsProv = count · barArea',
      substitution: `${layer.count}·${barArea(layer.bar)}`,
      result: `AsProv = ${AsProv.toFixed(0)} mm² (${ok ? '≥' : '<'} target ${AsTarget.toFixed(0)})`,
    },
    {
      title: 'φMn check',
      formula: 'φMn ≥ Mu',
      substitution: `φMn = ${phiMn.toFixed(2)} kN·m`,
      result: `Ratio = ${ratio.toFixed(3)} ${ok ? '✓' : '✗ FAIL'}`,
    },
  ];

  return {
    direction, cantilever, bw, d, Mu: Mu_kNm, AsReq, AsMin, AsProv, phiMn,
    ratio, ok, ref: ref(code, '13.3.3'), steps,
  };
}

// ─── BEARING AT INTERFACE (§22.8) ──────────────────────────────────────────

function checkBearingInterface(input: FootingInput): BearingInterfaceCheck {
  const { code, geometry: g, materials: m, loads: L } = input;
  const fc = m.fc;
  const phi = 0.65;        // §21.2.1 for bearing
  const Pu = 1.2 * L.PD + 1.6 * L.PL;

  // Column area A1 (mm²)
  const A1 = g.columnShape === 'circular'
    ? PI * Math.pow(g.cx / 2, 2)
    : g.cx * (g.cy ?? g.cx);
  // Footing area A2 — limited to 4·A1 (or up to factor √(A2/A1) ≤ 2 per §22.8.3.2)
  const A2 = g.B * g.L;
  const factor = Math.min(2, Math.sqrt(A2 / A1));

  // Column bearing: φBn = φ·0.85·fc·A1
  const phiBn_col_N = phi * 0.85 * fc * A1;
  const phiBn_col = phiBn_col_N / 1000;     // kN
  // Footing bearing: φBn = φ·0.85·fc·A1·factor
  const phiBn_ftg_N = phi * 0.85 * fc * A1 * factor;
  const phiBn_ftg = phiBn_ftg_N / 1000;     // kN
  const phiBn = Math.min(phiBn_col, phiBn_ftg);

  const ratio = Pu / Math.max(phiBn, 1e-9);
  const ok = ratio <= 1;

  const steps: CalcStep[] = [
    {
      title: 'Column-footing bearing per §22.8',
      formula: 'φBn,col = φ·0.85·fʹc·A1; φBn,ftg = φBn,col · min(2, √(A2/A1))',
      substitution: `A1 = ${A1.toFixed(0)} mm², A2 = ${A2.toFixed(0)} mm², factor = ${factor.toFixed(3)}`,
      result: `φBn,col = ${phiBn_col.toFixed(1)} kN, φBn,ftg = ${phiBn_ftg.toFixed(1)} kN`,
      ref: ref(code, '22.8'),
    },
    {
      title: 'Demand vs governing bearing',
      formula: 'Pu / min(φBn,col, φBn,ftg)',
      substitution: `Pu = ${Pu.toFixed(1)} kN, φBn = ${phiBn.toFixed(1)} kN`,
      result: `Ratio = ${ratio.toFixed(3)} ${ok ? '✓' : '✗ FAIL — add dowel reinforcement'}`,
    },
  ];

  return {
    phiBn_col, phiBn_ftg, phiBn, Pu,
    ratio, ok, ref: ref(code, '22.8'), steps,
  };
}

// ─── OVERTURNING (FOS ≥ 1.5) ───────────────────────────────────────────────

function checkOverturning(input: FootingInput, P_service: number): OverturningCheck {
  const { code, geometry: g, loads: L } = input;
  const FOS_req = 1.5;
  const Mx = Math.abs(L.Mx ?? 0);
  const My = Math.abs(L.My ?? 0);
  if (Mx === 0 && My === 0) {
    return {
      M_resist: 0, M_overturn: 0, FOS: Infinity, FOS_req,
      ratio: 0, ok: true, notApplicable: true,
      ref: ref(code, '13.3 / Bowles 7.3'),
      steps: [{
        title: 'Overturning check',
        formula: 'No applied moment → overturning N/A',
        substitution: '', result: 'N/A',
      }],
    };
  }
  // Resisting moment: P × (B/2 or L/2) — moment about the toe
  const lever_x = (g.B / 1000) / 2;
  const lever_y = (g.L / 1000) / 2;
  const M_resist_x = P_service * lever_x;
  const M_resist_y = P_service * lever_y;
  // Use the smaller of the two as the governing arm if both M present
  const M_resist = Math.min(
    Mx > 0 ? M_resist_x : Infinity,
    My > 0 ? M_resist_y : Infinity,
  );
  const M_overturn = Math.max(Mx, My);
  const FOS = M_resist / Math.max(M_overturn, 1e-9);
  const ratio = FOS_req / FOS;
  const ok = FOS >= FOS_req;
  return {
    M_resist, M_overturn, FOS, FOS_req,
    ratio, ok, notApplicable: false,
    ref: ref(code, '13.3 / Bowles 7.3'),
    steps: [
      {
        title: 'Resisting moment about toe',
        formula: 'Mres = Pservice × (B/2 or L/2)',
        substitution: `P = ${P_service.toFixed(1)} kN, arm = ${Math.min(lever_x, lever_y).toFixed(2)} m`,
        result: `Mres = ${M_resist.toFixed(1)} kN·m`,
      },
      {
        title: 'Overturning moment',
        formula: 'Movt = max(|Mx|, |My|)',
        substitution: `Mx = ${Mx.toFixed(1)}, My = ${My.toFixed(1)} kN·m`,
        result: `Movt = ${M_overturn.toFixed(1)} kN·m`,
      },
      {
        title: 'FOS = Mres / Movt',
        formula: 'FOS ≥ 1.5 (typical practice)',
        substitution: `FOS = ${FOS.toFixed(2)}`,
        result: ok ? `✓ FOS = ${FOS.toFixed(2)} ≥ 1.5` : `✗ FOS = ${FOS.toFixed(2)} < 1.5 — increase footing size`,
      },
    ],
  };
}

// ─── SLIDING (FOS ≥ 1.5) ───────────────────────────────────────────────────

function checkSliding(input: FootingInput, P_service: number): SlidingCheck {
  const { code, geometry: g, loads: L } = input;
  const H = Math.abs(input.H ?? 0);
  const FOS_req = 1.5;
  if (H === 0) {
    return {
      N: P_service, H_allow: Infinity, H: 0, FOS: Infinity, FOS_req,
      ratio: 0, ok: true, notApplicable: true,
      ref: ref(code, 'Bowles 7.4'),
      steps: [{
        title: 'Sliding check',
        formula: 'No applied lateral load → sliding N/A',
        substitution: '', result: 'N/A',
      }],
    };
  }
  const mu = input.frictionMu ?? 0.45;     // sandy default
  const c = input.cohesion ?? 0;            // kPa
  const A_m2 = (g.B * g.L) / 1e6;
  const H_allow = mu * P_service + c * A_m2;     // kN
  void L;
  const FOS = H_allow / H;
  const ratio = FOS_req / FOS;
  const ok = FOS >= FOS_req;
  return {
    N: P_service, H_allow, H, FOS, FOS_req,
    ratio, ok, notApplicable: false,
    ref: ref(code, 'Bowles 7.4'),
    steps: [
      {
        title: 'Allowable horizontal load',
        formula: 'Hallow = μ·N + c·A',
        substitution: `μ = ${mu}, N = ${P_service.toFixed(1)} kN, c = ${c} kPa, A = ${A_m2.toFixed(3)} m²`,
        result: `Hallow = ${H_allow.toFixed(1)} kN`,
      },
      {
        title: 'FOS sliding',
        formula: 'FOS = Hallow / H ≥ 1.5',
        substitution: `H = ${H.toFixed(1)} kN`,
        result: ok ? `✓ FOS = ${FOS.toFixed(2)} ≥ 1.5` : `✗ FOS = ${FOS.toFixed(2)} < 1.5`,
      },
    ],
  };
}

// ─── BAR FIT / SPACING (§25.2.1 + §13.3.4) ─────────────────────────────────

function checkBarFit(input: FootingInput, direction: 'X' | 'Y'): BarFitCheck {
  const { code, geometry: g, materials: m, reinforcement: r } = input;
  const dagg = 19;
  const layer = direction === 'X' ? r.bottomX : r.bottomY;
  const dbBar = barDiameter(layer.bar);
  // Footing length in the bar direction (X bars run along X, span across L; etc.)
  // Bars distributed across the perpendicular dimension.
  const distAcross = direction === 'X' ? g.B : g.L;
  const usableWidth = distAcross - 2 * g.coverClear;
  const s_clear = layer.count > 1
    ? (usableWidth - layer.count * dbBar) / (layer.count - 1)
    : 1e9;
  const s_min = Math.max(25, dbBar, (4 / 3) * dagg);
  const s_max = Math.min(3 * g.T, 450);
  const ok = s_clear >= s_min && s_clear <= s_max;
  void m;
  return {
    direction, s_clear, s_min, s_max, ok,
    ref: ref(code, '25.2.1 / 13.3.4'),
    steps: [
      {
        title: `Clear bar spacing (${direction})`,
        formula: 'sclear = (Bperp − 2·cover − n·db) / (n − 1)',
        substitution: `n = ${layer.count}, db = ${dbBar.toFixed(1)}, distAcross = ${distAcross}, cover = ${g.coverClear}`,
        result: `sclear = ${s_clear.toFixed(0)} mm`,
      },
      {
        title: 'Min clear spacing §25.2.1',
        formula: 'smin = max(25, db, 4/3·dagg)',
        substitution: `smin = max(25, ${dbBar.toFixed(1)}, ${((4 / 3) * dagg).toFixed(1)})`,
        result: `smin = ${s_min.toFixed(0)} mm ${s_clear >= s_min ? '✓' : '✗ too close'}`,
      },
      {
        title: 'Max spacing §13.3.4 / §7.7.2.3 analogy',
        formula: 'smax = min(3·T, 450 mm)',
        substitution: `smax = min(${3 * g.T}, 450)`,
        result: `smax = ${s_max.toFixed(0)} mm ${s_clear <= s_max ? '✓' : '✗ too sparse'}`,
      },
    ],
  };
}

// ─── DEVELOPMENT LENGTH (§25.4.2.3) ────────────────────────────────────────

function checkDevelopment(input: FootingInput, direction: 'X' | 'Y'): DevelopmentCheck {
  const { code, geometry: g, materials: m, reinforcement: r } = input;
  const layer = direction === 'X' ? r.bottomX : r.bottomY;
  const dbBar = barDiameter(layer.bar);
  // Available embedment from face of column to footing edge (mm)
  const colDimSelf = direction === 'X' ? g.cx : (g.columnShape === 'circular' ? g.cx : (g.cy ?? g.cx));
  const footingDimSelf = direction === 'X' ? g.B : g.L;
  const cantilever = (footingDimSelf - colDimSelf) / 2;
  // Embedment = cantilever − cover (rough)
  const embedment = Math.max(0, cantilever - g.coverClear);
  // ld simplified per §25.4.2.3 case 2 (no confinement guarantee):
  //   db ≤ 19 (≤ #6): ld/db = fy·ψt·ψe·ψg / (1.4·λ·√fc)
  //   db > 19 (≥ #7): ld/db = fy·ψt·ψe·ψg / (1.1·λ·√fc)
  const psiT = 1.0;        // bottom bar — no top-cast factor
  const psiE = 1.0;        // uncoated
  const psiG = m.fy <= 420 ? 1.0 : m.fy <= 550 ? 1.15 : 1.3;
  const lambda = m.lambdaC ?? 1.0;
  const divisor = dbBar <= 19 ? 1.4 : 1.1;
  const ld_ratio = (m.fy * psiT * psiE * psiG) / (divisor * lambda * Math.sqrt(m.fc));
  const ld = Math.max(300, ld_ratio * dbBar);
  // Hooks are STANDARD practice in footings when straight embedment < ld.
  // Per ACI §25.4.3, a 90° hook reduces development to ldh ≈ 0.24·fy/(λ·√fc')·db
  // which is typically < 250 mm — fits in any footing. So development NEVER
  // fails outright; we just flag whether hooks are required for detailing.
  const hookRequired = embedment < ld;
  // ldh (with hook) per §25.4.3 simplified
  const ldh = Math.max(150, 8 * dbBar, 0.24 * m.fy / (lambda * Math.sqrt(m.fc)) * dbBar);
  const okWithHook = embedment >= ldh;
  const ok = !hookRequired || okWithHook;
  return {
    direction, ld, embedment, ok, hookRequired,
    ref: ref(code, '25.4.2.3 / 25.4.3'),
    steps: [
      {
        title: `Development length ld (${direction})`,
        formula: dbBar <= 19
          ? 'ld = (fy·ψt·ψe·ψg / (1.4·λ·√fʹc))·db ≥ 300 mm  [#6 and smaller]'
          : 'ld = (fy·ψt·ψe·ψg / (1.1·λ·√fʹc))·db ≥ 300 mm  [#7 and larger]',
        substitution: `db = ${dbBar.toFixed(1)} mm, fy = ${m.fy} MPa, fc = ${m.fc} MPa, ψg = ${psiG}`,
        result: `ld = ${ld.toFixed(0)} mm (straight)`,
      },
      {
        title: 'Available embedment from face of column',
        formula: 'embedment = cantilever − cover',
        substitution: `cantilever = ${cantilever.toFixed(0)}, cover = ${g.coverClear}`,
        result: `embedment = ${embedment.toFixed(0)} mm`,
      },
      {
        title: hookRequired ? '90° standard hook required (§25.4.3)' : 'Straight embedment sufficient',
        formula: hookRequired ? 'ldh = max(150, 8·db, 0.24·fy/(λ·√fʹc)·db)' : 'ld ≤ embedment',
        substitution: hookRequired ? `ldh = ${ldh.toFixed(0)} mm` : 'OK as straight bar',
        result: ok ? '✓ OK (with hook if required)' : '✗ Even hooked bar does not fit — increase footing',
      },
    ],
  };
}

// ─── MAIN ANALYZER ──────────────────────────────────────────────────────────

export function analyzeFooting(input: FootingInput): FootingAnalysis {
  const warnings: string[] = [];
  try {
    const bearingFull = checkBearing(input);
    const { Wf_kN, Ws_kN, upliftRegion, ...bearing } = bearingFull;
    const qnu = factoredNetPressure(input);

    const punching = checkPunching(input, qnu);
    const shearX = checkOneWayShear(input, qnu, 'X');
    const shearY = checkOneWayShear(input, qnu, 'Y');
    const flexureX = checkFootingFlexure(input, qnu, 'X');
    const flexureY = checkFootingFlexure(input, qnu, 'Y');
    const bearingInterface = checkBearingInterface(input);
    const overturning = checkOverturning(input, bearing.P_service);
    const sliding = checkSliding(input, bearing.P_service);
    const barFitX = checkBarFit(input, 'X');
    const barFitY = checkBarFit(input, 'Y');
    const developmentX = checkDevelopment(input, 'X');
    const developmentY = checkDevelopment(input, 'Y');

    if (!bearing.ok) warnings.push(`Bearing fails — service pressure ${bearing.q_max.toFixed(1)} kPa > allowable ${input.soil.qa} kPa. Increase footing area.`);
    if (upliftRegion) warnings.push(`Eccentricity outside kern → partial uplift (Bowles triangular pressure). Consider larger footing OR shifting column.`);
    if (!punching.ok) warnings.push(`Punching shear fails — Vu/φVc = ${punching.ratio.toFixed(2)}. Increase footing thickness.`);
    if (!shearX.ok) warnings.push(`One-way shear (X) fails — Vu/φVc = ${shearX.ratio.toFixed(2)}.`);
    if (!shearY.ok) warnings.push(`One-way shear (Y) fails — Vu/φVc = ${shearY.ratio.toFixed(2)}.`);
    if (!flexureX.ok) warnings.push(`Flexure (X) fails — Mu/φMn = ${flexureX.ratio.toFixed(2)}. Add bottom-X bars.`);
    if (!flexureY.ok) warnings.push(`Flexure (Y) fails — Mu/φMn = ${flexureY.ratio.toFixed(2)}. Add bottom-Y bars.`);
    if (!bearingInterface.ok) warnings.push(`Column bearing fails — add dowel reinforcement per §16.3.4.1.`);
    if (!overturning.notApplicable && !overturning.ok) warnings.push(`Overturning FOS = ${overturning.FOS.toFixed(2)} < 1.5 — increase footing footprint or counterweight.`);
    if (!sliding.notApplicable && !sliding.ok) warnings.push(`Sliding FOS = ${sliding.FOS.toFixed(2)} < 1.5 — add shear key or increase weight.`);
    if (!barFitX.ok) warnings.push(`Bottom-X bar spacing out of bounds (sclear = ${barFitX.s_clear.toFixed(0)} mm).`);
    if (!barFitY.ok) warnings.push(`Bottom-Y bar spacing out of bounds (sclear = ${barFitY.s_clear.toFixed(0)} mm).`);
    // hookRequired is INFORMATIONAL (not a fail) — footings routinely use 90°
    // hooks at bar ends. Only emit a warning if even hooked bars don't fit.
    if (!developmentX.ok) warnings.push(`Bottom-X bars cannot develop even with hook — increase footing size.`);
    if (!developmentY.ok) warnings.push(`Bottom-Y bars cannot develop even with hook — increase footing size.`);

    const ok = bearing.ok && punching.ok && shearX.ok && shearY.ok &&
               flexureX.ok && flexureY.ok && bearingInterface.ok &&
               overturning.ok && sliding.ok &&
               barFitX.ok && barFitY.ok &&
               developmentX.ok && developmentY.ok;

    return {
      input, bearing, punching, shearX, shearY, flexureX, flexureY, bearingInterface,
      overturning, sliding, barFitX, barFitY, developmentX, developmentY,
      qnu, Wf: Wf_kN, Ws: Ws_kN, upliftRegion, ok, warnings, solved: true,
    };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return {
      input,
      bearing: emptyBearing(),
      punching: emptyPunching(),
      shearX: emptyShear('X'),
      shearY: emptyShear('Y'),
      flexureX: emptyFlex('X'),
      flexureY: emptyFlex('Y'),
      bearingInterface: emptyBearingInt(),
      overturning: emptyOver(),
      sliding: emptySliding(),
      barFitX: emptyBarFit('X'),
      barFitY: emptyBarFit('Y'),
      developmentX: emptyDev('X'),
      developmentY: emptyDev('Y'),
      qnu: 0, Wf: 0, Ws: 0, upliftRegion: false,
      ok: false,
      warnings: [`Solver error: ${msg}`],
      solved: false,
    };
  }
}

// ─── Empty helpers (for error fallback) ────────────────────────────────────

function emptyBearing(): BearingCheck {
  return { P_service: 0, A_req: 0, A_prov: 0, q_max: 0, q_min: 0, ratio: 0, ok: false, ref: '', steps: [] };
}
function emptyPunching(): PunchingCheck {
  return { bo: 0, d: 0, betaC: 1, alphaS: 40, vc1: 0, vc2: 0, vc3: 0, vc: 0, phiVc: 0, Vu: 0, ratio: 0, ok: false, ref: '', steps: [] };
}
function emptyShear(direction: 'X' | 'Y'): OneWayShearCheck {
  return { direction, bw: 0, d: 0, cantilever: 0, Vc: 0, phiVc: 0, Vu: 0, ratio: 0, ok: false, ref: '', steps: [] };
}
function emptyFlex(direction: 'X' | 'Y'): FootingFlexureCheck {
  return { direction, cantilever: 0, bw: 0, d: 0, Mu: 0, AsReq: 0, AsMin: 0, AsProv: 0, phiMn: 0, ratio: 0, ok: false, ref: '', steps: [] };
}
function emptyBearingInt(): BearingInterfaceCheck {
  return { phiBn_col: 0, phiBn_ftg: 0, phiBn: 0, Pu: 0, ratio: 0, ok: false, ref: '', steps: [] };
}
function emptyOver(): OverturningCheck {
  return { M_resist: 0, M_overturn: 0, FOS: Infinity, FOS_req: 1.5, ratio: 0, ok: true, notApplicable: true, ref: '', steps: [] };
}
function emptySliding(): SlidingCheck {
  return { N: 0, H_allow: Infinity, H: 0, FOS: Infinity, FOS_req: 1.5, ratio: 0, ok: true, notApplicable: true, ref: '', steps: [] };
}
function emptyBarFit(direction: 'X' | 'Y'): BarFitCheck {
  return { direction, s_clear: 0, s_min: 0, s_max: 0, ok: false, ref: '', steps: [] };
}
function emptyDev(direction: 'X' | 'Y'): DevelopmentCheck {
  return { direction, ld: 0, embedment: 0, ok: false, hookRequired: false, ref: '', steps: [] };
}
