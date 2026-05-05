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
  DowelCheck,
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

  // Effective eccentricity from applied moments + column eccentricity.
  // Sign convention:
  //   Mx = moment ABOUT footing X-axis → causes pressure gradient along Y
  //         → resultant offset in Y (eY = Mx / P)
  //   My = moment ABOUT footing Y-axis → causes pressure gradient along X
  //         → resultant offset in X (eX = My / P)
  //   ex = column shift in X-direction → adds to My (M = P·ex about Y)
  //   ey = column shift in Y-direction → adds to Mx (M = P·ey about X)
  const Mx_total = (L.Mx ?? 0) + (L.PD + L.PL) * (g.ey ?? 0) / 1000;
  const My_total = (L.My ?? 0) + (L.PD + L.PL) * (g.ex ?? 0) / 1000;
  // eY is the offset of the resultant in the Y-direction (caused by Mx).
  // eX is the offset of the resultant in the X-direction (caused by My).
  const eY_m = Math.abs(Mx_total) / Math.max(P_service, 1e-9);
  const eX_m = Math.abs(My_total) / Math.max(P_service, 1e-9);
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
    // Trapezoidal distribution (within kern):
    //   q(x, y) = P/A ± Mx·c_y/Ix ± My·c_x/Iy
    //   Ix = L³·B/12 (about X-axis), c_y at extreme = L/2
    //   Iy = B³·L/12 (about Y-axis), c_x at extreme = B/2
    //   Δq from Mx at extreme y = 6·|Mx|/(L²·B)
    //   Δq from My at extreme x = 6·|My|/(B²·L)
    const dqFromMx = Math.abs(Mx_total) * 6 / (L_m * L_m * B_m);
    const dqFromMy = Math.abs(My_total) * 6 / (B_m * B_m * L_m);
    q_max = q_avg + dqFromMx + dqFromMy;
    q_min = q_avg - dqFromMx - dqFromMy;
  } else {
    // Triangular (Bowles) — partial uplift. For dominant axis:
    //   qmax = 2·P / (3·(D_compress/2 − e)·D_perp)
    // where e is offset along the compression-direction.
    // eX is offset in X-direction (caused by My), so the X-compression length
    // is 3·(B/2 − eX) and the perpendicular length is L.
    const effB = Math.max(B_m / 2 - eX_m, 1e-3) * 3;     // 3·(B/2−eX)
    const effL = Math.max(L_m / 2 - eY_m, 1e-3) * 3;     // 3·(L/2−eY)
    if (outsideKernX && !outsideKernY) {
      q_max = 2 * P_service / (effB * L_m);
      q_min = 0;
    } else if (outsideKernY && !outsideKernX) {
      q_max = 2 * P_service / (effL * B_m);
      q_min = 0;
    } else {
      // Both axes outside kern (biaxial uplift) — Bowles 4-corner case is
      // chart-based and outside this scope. Use a conservative envelope:
      //   qmax = 2·P / min(effB·L, effL·B), and emit a warning upstream.
      q_max = 2 * P_service / Math.min(effB * L_m, effL * B_m);
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

// ─── EFFECTIVE DEPTHS ──────────────────────────────────────────────────────
//
// Bottom mat: convention is X-bars (running along X) closest to soil, then
// Y-bars on top. For a given direction, d is the distance from extreme
// compression fibre (top) to the centroid of the tension reinforcement IN
// THAT DIRECTION:
//   dX = T − cover − dbX/2          (cantilever along X uses bottom-X bars)
//   dY = T − cover − dbX − dbY/2    (cantilever along Y uses bottom-Y bars,
//                                    which sit ABOVE the X-mat)
//   dAvg = (dX + dY) / 2            (used for two-way / punching)
//
// `g.d` override (from FootingGeometry) bypasses the calculation.
function effectiveDepths(input: FootingInput): { dX: number; dY: number; dAvg: number } {
  const { geometry: g, reinforcement: r } = input;
  if (g.d !== undefined && g.d !== null) {
    return { dX: g.d, dY: g.d, dAvg: g.d };
  }
  const dbX = barDiameter(r.bottomX.bar);
  const dbY = barDiameter(r.bottomY.bar);
  const dX = g.T - g.coverClear - dbX / 2;
  const dY = g.T - g.coverClear - dbX - dbY / 2;
  return { dX, dY, dAvg: (dX + dY) / 2 };
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
  // Two-way punching uses the average d of the two bottom mats
  const { dAvg: d } = effectiveDepths(input);
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
  // αs per §22.6.5.3: interior 40, edge 30, corner 20
  const alphaS =
    g.columnLocation === 'edge' ? 30 :
    g.columnLocation === 'corner' ? 20 :
    40;     // default interior

  // Three candidate vc values (MPa) per Table 22.6.5.2
  const vc1 = 0.33 * lambda * sqrtFc;
  const vc2 = 0.17 * (1 + 2 / betaC) * lambda * sqrtFc;
  const vc3 = 0.083 * (alphaS * d / bo + 2) * lambda * sqrtFc;
  const vc = Math.min(vc1, vc2, vc3);

  // Available φVc = φ·vc·bo·d (in N → kN)
  const phiVc_N = phi * vc * bo * d;
  const phiVc = phiVc_N / 1000;     // kN
  const phiVcStress = phi * vc;      // MPa

  // Factored Vu at the critical perimeter:
  //   Vu = qnu × (A_footing − A_punch) — only the area OUTSIDE the punching cone
  //   contributes to the shear ON the perimeter.
  const A_footing_mm2 = g.B * g.L;
  const Vu_kN = qnu * (A_footing_mm2 - A_punch) / 1e6;     // kPa·m² = kN

  // Direct shear stress vuv = Vu / (bo·d), in MPa
  // Vu_N = Vu_kN × 1000; vuv = Vu_N / (bo·d) = (Vu_kN × 1000) / (bo·d)
  const vuv = (Vu_kN * 1000) / Math.max(bo * d, 1e-9);

  // ── Unbalanced moment shear (ACI 318-25 §8.4.4.2) ─────────────────────
  //
  // When the column transfers a moment Msc to the slab/footing, a fraction γv
  // of that moment is transferred by eccentric shear (the rest, γf, by flexure
  // across the effective slab width per §8.4.2.2.3). The shear stress from
  // γv·Msc varies linearly about the centroid of the critical section:
  //
  //   vu,AB = vuv + γv·Msc·c_AB / Jc       (peak)
  //
  // where:
  //   γf  = 1 / (1 + (2/3)·√(b1/b2))       per §8.4.2.2.1
  //   γv  = 1 − γf                          per §8.4.4.2.2
  //   b1  = column dim in direction of moment transfer + d  (along bending)
  //   b2  = column dim perpendicular + d
  //   c_AB = b1/2 for an interior column (centroid is at the geometric centre)
  //   Jc (interior, rectangular crit section) per R8.4.4.2.3:
  //     Jc = d·b1³/6 + b1·d³/6 + d·b2·b1²/2
  //
  // Convention used here:
  //   Mx (moment about footing X-axis) → bending in Y-direction
  //     b1 = cy + d (column dim along Y, parallel to bending direction)
  //     b2 = cx + d (perpendicular)
  //   My (moment about footing Y-axis) → bending in X-direction
  //     b1 = cx + d
  //     b2 = cy + d
  //
  // Loads.Mx and Loads.My are SERVICE moments. We factor them by the same
  // ratio used for axial: Mu/M_service ≈ (1.2·PD + 1.6·PL) / (PD + PL).
  // This is the conventional simplification when the load split is unknown.
  const PDpL = input.loads.PD + input.loads.PL;
  const factorRatio = PDpL > 0
    ? (1.2 * input.loads.PD + 1.6 * input.loads.PL) / PDpL
    : 1.4;
  const MuX_kNm = (input.loads.Mx ?? 0) * factorRatio;
  const MuY_kNm = (input.loads.My ?? 0) * factorRatio;

  // Helper: compute γf, γv, Jc, c_AB and Δvu for one axis
  function unbalancedDelta(b1: number, b2: number, Mu_kNm: number): {
    gammaF: number; gammaV: number; Jc: number; cAB: number; dvu: number;
  } {
    const gammaF = 1 / (1 + (2 / 3) * Math.sqrt(b1 / b2));
    const gammaV = 1 - gammaF;
    const cAB = b1 / 2;     // interior, symmetric
    const Jc = d * Math.pow(b1, 3) / 6
             + b1 * Math.pow(d, 3) / 6
             + d * b2 * Math.pow(b1, 2) / 2;
    const Mu_Nmm = Math.abs(Mu_kNm) * 1e6;
    const dvu = (gammaV * Mu_Nmm * cAB) / Math.max(Jc, 1e-9);     // MPa
    return { gammaF, gammaV, Jc, cAB, dvu };
  }

  // For circular columns, treat as equivalent square (R22.6.4.1.2)
  const colY = g.columnShape === 'circular' ? g.cx : (g.cy ?? g.cx);
  const colX = g.cx;

  // Mx (about X) — bending along Y
  const mx = MuX_kNm > 0 ? unbalancedDelta(colY + d, colX + d, MuX_kNm)
                         : { gammaF: 0, gammaV: 0, Jc: 0, cAB: 0, dvu: 0 };
  // My (about Y) — bending along X
  const my = MuY_kNm > 0 ? unbalancedDelta(colX + d, colY + d, MuY_kNm)
                         : { gammaF: 0, gammaV: 0, Jc: 0, cAB: 0, dvu: 0 };

  // Peak combined shear stress at the critical perimeter
  const vuMax = vuv + mx.dvu + my.dvu;

  // Use stress-based check when unbalanced moments are present; otherwise the
  // force-based ratio Vu/φVc is equivalent (vuMax = vuv = Vu/(bo·d)).
  const ratio = vuMax / Math.max(phiVcStress, 1e-9);
  const ok = ratio <= 1;

  // Pick the dominant γf/γv to report (fall back to Mx if both present)
  const gammaF = MuX_kNm > 0 ? mx.gammaF : (MuY_kNm > 0 ? my.gammaF : 0);
  const gammaV = MuX_kNm > 0 ? mx.gammaV : (MuY_kNm > 0 ? my.gammaV : 0);

  const hasUnbalanced = MuX_kNm > 0 || MuY_kNm > 0;

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
      title: 'φ·vc available stress',
      formula: 'φ·vc (φ = 0.75)',
      substitution: `φ·vc = 0.75·${vc.toFixed(3)}`,
      result: `φ·vc = ${phiVcStress.toFixed(3)} MPa  (φVc = ${phiVc.toFixed(2)} kN)`,
    },
    {
      title: 'Direct punching shear demand',
      formula: 'Vu = qnu · (Afooting − Apunch);  vuv = Vu/(bo·d)',
      substitution: `Vu = ${qnu.toFixed(1)}·(${(A_footing_mm2 / 1e6).toFixed(3)} − ${(A_punch / 1e6).toFixed(3)}) m²`,
      result: `Vu = ${Vu_kN.toFixed(2)} kN  →  vuv = ${vuv.toFixed(3)} MPa`,
    },
    ...(hasUnbalanced ? [
      {
        title: 'Unbalanced-moment fraction γf, γv (§8.4.2.2.1, §8.4.4.2.2)',
        formula: 'γf = 1/(1 + (2/3)·√(b1/b2));  γv = 1 − γf',
        substitution: MuX_kNm > 0
          ? `b1 = ${(colY + d).toFixed(0)}, b2 = ${(colX + d).toFixed(0)} mm`
          : `b1 = ${(colX + d).toFixed(0)}, b2 = ${(colY + d).toFixed(0)} mm`,
        result: `γf = ${gammaF.toFixed(3)}, γv = ${gammaV.toFixed(3)}`,
        ref: ref(code, '8.4.4.2'),
      },
      {
        title: 'Polar moment-of-inertia analog Jc (interior column, §R8.4.4.2.3)',
        formula: 'Jc = d·b1³/6 + b1·d³/6 + d·b2·b1²/2',
        substitution: MuX_kNm > 0
          ? `Jc(Mx) = ${mx.Jc.toExponential(3)} mm⁴`
          : `Jc(My) = ${my.Jc.toExponential(3)} mm⁴`,
        result: `Δvu(Mx) = ${mx.dvu.toFixed(3)} MPa,  Δvu(My) = ${my.dvu.toFixed(3)} MPa`,
      },
      {
        title: 'Combined peak shear stress',
        formula: 'vu,max = vuv + γv·Mu·c_AB/Jc  (sum over both axes)',
        substitution: `${vuv.toFixed(3)} + ${mx.dvu.toFixed(3)} + ${my.dvu.toFixed(3)}`,
        result: `vu,max = ${vuMax.toFixed(3)} MPa`,
      },
    ] : []),
    {
      title: 'Punching shear utilisation',
      formula: hasUnbalanced ? 'vu,max / (φ·vc)' : 'Vu / φVc  ≡  vuv / (φ·vc)',
      substitution: `${vuMax.toFixed(3)} / ${phiVcStress.toFixed(3)}`,
      result: `Ratio = ${ratio.toFixed(3)} ${ok ? '✓' : '✗ FAIL'}`,
    },
  ];

  // ── Shear-reinforcement advisory (§22.6.6.1, Table 22.6.6.1) ─────────
  // When vu,max > φ·vc, the engineer can either thicken the footing OR add
  // two-way shear reinforcement (stirrups or headed shear studs) up to the
  // code maximum vn:
  //   stirrups in slabs:        vn,max = 0.5·√fʹc   (single/multiple-leg)
  //   headed shear stud reinf.: vn,max = 0.66·√fʹc
  // Report whichever advisory applies.
  if (!ok) {
    const vnMaxStirrups = 0.5 * lambda * sqrtFc;       // §22.6.6.1
    const vnMaxStuds = 0.66 * lambda * sqrtFc;          // §22.6.6.1 (headed studs)
    const phiVnStirrups = phi * vnMaxStirrups;
    const phiVnStuds = phi * vnMaxStuds;
    if (vuMax <= phiVnStuds) {
      const advice = vuMax <= phiVnStirrups
        ? `vu,max ≤ φ·vn,max(stirrups) = ${phiVnStirrups.toFixed(3)} MPa → adding stirrups would be sufficient`
        : `vu,max ≤ φ·vn,max(headed studs) = ${phiVnStuds.toFixed(3)} MPa → adding headed shear studs would be sufficient (stirrups not enough)`;
      steps.push({
        title: 'Shear-reinforcement advisory (§22.6.6.1)',
        formula: 'φ·vn,max (stirrups) = 0.5·φ·√fʹc;  φ·vn,max (studs) = 0.66·φ·√fʹc',
        substitution: `φ·vn,stirrups = ${phiVnStirrups.toFixed(3)}, φ·vn,studs = ${phiVnStuds.toFixed(3)} MPa`,
        result: advice,
        ref: ref(code, '22.6.6'),
      });
    } else {
      steps.push({
        title: 'Shear-reinforcement advisory (§22.6.6.1)',
        formula: 'vu,max > φ·vn,max(headed studs) = 0.66·φ·√fʹc',
        substitution: `vu,max = ${vuMax.toFixed(3)} > ${phiVnStuds.toFixed(3)}`,
        result: 'Even headed shear studs would not be sufficient — must increase footing thickness',
        ref: ref(code, '22.6.6'),
      });
    }
  }

  return {
    bo, d, betaC, alphaS,
    vc1, vc2, vc3, vc, phiVc, Vu: Vu_kN,
    vuv, vuMax, phiVcStress,
    gammaF, gammaV, MuX: MuX_kNm, MuY: MuY_kNm,
    JcX: mx.Jc, JcY: my.Jc, dvuMx: mx.dvu, dvuMy: my.dvu,
    ratio, ok, ref: ref(code, '22.6 + 8.4.4.2'), steps,
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
  // One-way shear in direction X uses the depth of the X-direction reinforcement
  const { dX, dY } = effectiveDepths(input);
  const d = direction === 'X' ? dX : dY;

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

// ─── ECCENTRIC FACTORED PRESSURE FLEXURE (§13.2.6.6) ───────────────────────
//
// ACI 318-25 §13.2.6.6:
//   "External moment on any section… calculated by passing a vertical plane
//   through the member and calculating the moment of the forces acting over
//   the entire area of member on one side of that vertical plane."
//
// For eccentric loading (ex ≠ 0, ey ≠ 0, Mx ≠ 0, or My ≠ 0), the soil
// pressure is NOT uniform — it varies linearly across the footing
// (trapezoidal within kern, triangular Bowles outside). Using qnu·cant²/2
// underestimates Mu on the heavily-loaded side and overestimates on the
// other. We compute Mu on BOTH cantilever sides by integrating the actual
// factored pressure distribution and take the worst.
//
// Pressure averaged over the perpendicular dimension at point x (or y):
//   q_avg(x) = Pu/A + 12·Mu_y·x / (L·B³)              [for X-cantilever]
//   q_avg(y) = Pu/A + 12·Mu_x·y / (B·L³)              [for Y-cantilever]
// (Mu_x integrated over y = 0 by symmetry; only Mu_y affects X-cantilever.)
//
// Closed-form for trapezoidal load (q1 at face, q2 at edge over length cant):
//   Mu = L_perp · cant² · (q1 + 2·q2) / 6
//
// For partial uplift (Bowles): one of q1, q2 may be negative → clip to zero
// and integrate over the contact portion only.
function flexureMuFromPressure(
  input: FootingInput, direction: 'X' | 'Y',
): number {
  const g = input.geometry;
  const colSelf = direction === 'X'
    ? g.cx
    : (g.columnShape === 'circular' ? g.cx : (g.cy ?? g.cx));
  const footingSelf = direction === 'X' ? g.B : g.L;
  const footingPerp = direction === 'X' ? g.L : g.B;

  // Critical-section offset from column centreline (mm) per §13.2.7.1
  let critFromCenterMM: number;
  const supported = g.supportedMember ?? 'column';
  if (supported === 'wall_masonry') {
    critFromCenterMM = colSelf / 4;
  } else if (supported === 'baseplate' && g.basePlate) {
    const plateDim = direction === 'X' ? g.basePlate.Bp : g.basePlate.Lp;
    critFromCenterMM = (colSelf / 2 + plateDim / 2) / 2;
  } else {
    // 'column' or 'wall_concrete'
    critFromCenterMM = colSelf / 2;
  }

  // Eccentricity in the bending direction (X or Y) and perpendicular
  const eDir_mm = direction === 'X' ? (g.ex ?? 0) : (g.ey ?? 0);
  const ePerp_mm = direction === 'X' ? (g.ey ?? 0) : (g.ex ?? 0);
  void ePerp_mm;     // unused — Mu_x cancels for X-cantilever, Mu_y for Y

  // Switch to metres for pressure integration (q in kPa = kN/m²)
  const Bself_m = footingSelf / 1000;
  const Bperp_m = footingPerp / 1000;
  const eSelf_m = eDir_mm / 1000;
  const critFromCenter_m = critFromCenterMM / 1000;

  // Factored loads (kN, kN·m)
  const PDpL = input.loads.PD + input.loads.PL;
  const Pu = 1.2 * input.loads.PD + 1.6 * input.loads.PL;
  const factor = PDpL > 0 ? Pu / PDpL : 1.4;
  // Factored moments INCLUDE the moment from column eccentricity:
  //   ex (shift along X) → Mu_y_extra = Pu·ex
  //   ey (shift along Y) → Mu_x_extra = Pu·ey
  const ex_m = (g.ex ?? 0) / 1000;
  const ey_m = (g.ey ?? 0) / 1000;
  const MuxTotal = factor * (input.loads.Mx ?? 0) + Pu * ey_m;
  const MuyTotal = factor * (input.loads.My ?? 0) + Pu * ex_m;

  // For X-direction cantilever, Mu_y drives the gradient; for Y, Mu_x.
  const MuRelevant = direction === 'X' ? MuyTotal : MuxTotal;

  // Footing area (m²)
  const A_m2 = (g.B / 1000) * (g.L / 1000);

  // q_avg(s_self) — pressure averaged over the perpendicular direction,
  // as a function of the position along the bending direction (m, footing-centred)
  function qAvg(s_self_m: number): number {
    return Pu / A_m2 + 12 * MuRelevant * s_self_m / (Bperp_m * Math.pow(Bself_m, 3));
  }

  // Two cantilevers: + side and − side. Critical sections at:
  //   x_crit_+ = +critFromCenter_m + eSelf_m  (column shifted by eSelf)
  //   x_crit_− = −critFromCenter_m + eSelf_m
  const xCritPlus = +critFromCenter_m + eSelf_m;
  const xCritMinus = -critFromCenter_m + eSelf_m;

  // Cantilever lengths
  const cantPlus_m = (Bself_m / 2) - xCritPlus;     // from +x_crit to +B/2
  const cantMinus_m = xCritMinus - (-Bself_m / 2);  // from -B/2 to -x_crit

  // Compute Mu on one side of the column. Side direction = +1 or -1.
  // s ∈ [0, cant_m] is the distance from the critical section along the
  // outward normal (toward the footing edge).
  function muOnSide(xCrit_m: number, cant_m: number, sign: 1 | -1): number {
    if (cant_m <= 1e-9) return 0;
    const xEdge_m = sign === 1 ? Bself_m / 2 : -Bself_m / 2;
    const q1 = qAvg(xCrit_m);     // q at face of column / wall
    const q2 = qAvg(xEdge_m);     // q at far edge of footing
    // For positive sign, sign = +1, x increases from xCrit to xEdge
    // For negative sign, x decreases. The lever arm s = |x - xCrit|.
    // Pressure varies linearly between q1 and q2 over s ∈ [0, cant].
    // Closed-form integration of L · ∫_0^cant q(s)·s ds with linear q:
    if (q1 >= 0 && q2 >= 0) {
      // Trapezoidal — both ends in contact
      return Bperp_m * cant_m * cant_m * (q1 + 2 * q2) / 6;
    }
    if (q1 < 0 && q2 < 0) {
      // Full uplift on this side — no contact, no moment
      return 0;
    }
    if (q1 >= 0 && q2 < 0) {
      // Pressure drops from q1 at face to 0 at s* < cant, zero past s*
      // s* = q1·cant / (q1 − q2)
      const sStar = (q1 / (q1 - q2)) * cant_m;
      // Triangle with peak q1 at s=0, zero at s=s*: Mu = L·q1·s*²/6
      return Bperp_m * q1 * sStar * sStar / 6;
    }
    // q1 < 0 ≤ q2: contact starts at s_start, runs to cant
    const sStart = (-q1 / (q2 - q1)) * cant_m;
    const tail = cant_m - sStart;
    // Triangle from 0 at sStart to q2 at cant, with lever arm to xCrit:
    // Mu = L · q2 · tail · (2·cant + sStart) / 6
    return Bperp_m * q2 * tail * (2 * cant_m + sStart) / 6;
  }

  const muPlus = muOnSide(xCritPlus, cantPlus_m, 1);
  const muMinus = muOnSide(xCritMinus, cantMinus_m, -1);

  return Math.max(muPlus, muMinus);
}

function checkFootingFlexure(
  input: FootingInput, qnu: number, direction: 'X' | 'Y',
): FootingFlexureCheck {
  const { code, geometry: g, materials: m, reinforcement: r } = input;
  const fc = m.fc;
  const fy = m.fy;
  const phi = 0.90;
  // Flexure in direction X uses the depth of the X-direction tension reinforcement
  const { dX, dY } = effectiveDepths(input);
  const d = direction === 'X' ? dX : dY;

  // Cantilever from critical section per ACI 318-25 §13.2.7.1:
  //   'column'        → at face of column
  //   'wall_concrete' → at face of wall
  //   'wall_masonry'  → at midpoint between centreline and face of masonry wall
  //   'baseplate'     → at midpoint between face of column and edge of plate
  const colDimSelf = direction === 'X' ? g.cx : (g.columnShape === 'circular' ? g.cx : (g.cy ?? g.cx));
  const footingDimSelf = direction === 'X' ? g.B : g.L;
  const footingDimPerp = direction === 'X' ? g.L : g.B;

  let critOffset: number;     // distance from footing edge to critical section
  const supported = g.supportedMember ?? 'column';
  if (supported === 'wall_masonry') {
    // Critical section at colDimSelf/4 inboard of the wall face → cantilever = ((Footing-Wall)/2 + Wall/4)
    critOffset = (footingDimSelf - colDimSelf) / 2 + colDimSelf / 4;
  } else if (supported === 'baseplate' && g.basePlate) {
    // Crit section midway between face of column and edge of base plate
    const plateDim = direction === 'X' ? g.basePlate.Bp : g.basePlate.Lp;
    const colFaceFromEdge = (footingDimSelf - colDimSelf) / 2;
    const plateEdgeFromEdge = (footingDimSelf - plateDim) / 2;
    critOffset = (colFaceFromEdge + plateEdgeFromEdge) / 2;
  } else {
    // 'column' or 'wall_concrete' — face of column/wall
    critOffset = (footingDimSelf - colDimSelf) / 2;
  }
  const cantilever = critOffset;
  const bw = footingDimPerp;

  // Mu at face of column.
  //   • Centric loading (no Mx/My/ex/ey): Mu = qnu·cant²/2·bw — uniform pressure
  //   • Eccentric loading: integrate the actual factored pressure distribution
  //     per §13.2.6.6 and take the worst of the two cantilever sides.
  const hasMoment = (input.loads.Mx ?? 0) !== 0
                 || (input.loads.My ?? 0) !== 0
                 || (g.ex ?? 0) !== 0
                 || (g.ey ?? 0) !== 0;
  const Mu_kNm = hasMoment
    ? flexureMuFromPressure(input, direction)
    : qnu * Math.pow(cantilever / 1000, 2) / 2 * (bw / 1000);

  // AsReq (closed-form quadratic)
  const A_q = fy * fy / (2 * 0.85 * fc * bw);
  const B_q = -fy * d;
  const C_q = (Mu_kNm * 1e6) / phi;
  const disc = B_q * B_q - 4 * A_q * C_q;
  const AsReq = disc < 0 ? 0 : (-B_q - Math.sqrt(disc)) / (2 * A_q);

  // AsMin per §8.6.1.1 for fy = 420: ρ = 0.0018·b·h
  // For fy ≠ 420 MPa, ρmin = 0.0018·420/fy ≥ 0.0014 (per §8.6.1.1)
  // ACI 318-25 §8.6.1.1:
  //   fy < 420 MPa → ρmin = 0.0020 (deformed bars)
  //   fy ≥ 420 MPa → ρmin = max(0.0014, 0.0018·420/fy)
  let rhoMin: number;
  if (fy < 420) rhoMin = 0.0020;
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
      formula: fy < 420 ? 'AsMin = 0.0020·b·h' : 'AsMin = max(0.0014, 0.0018·420/fy)·b·h',
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

  // ── Short-band reinforcement per ACI 318-25 §13.3.3.3(b) ────────────
  // For rectangular footings (B ≠ L), the SHORT-direction reinforcement must
  // be split:
  //   γs = 2 / (β + 1),  β = L_long / L_short
  //   bars in band (= short side, centred on column) = γs · n_total
  //   bars outside the band = (1 − γs) · n_total
  // γs is only defined for the SHORT direction; long direction is uniform.
  let gammaS: number | null = null;
  let barsInBand: number | null = null;
  let barsOutsideBand: number | null = null;
  const Bx = g.B, Ly = g.L;
  if (Bx !== Ly) {
    const longSide = Math.max(Bx, Ly);
    const shortSide = Math.min(Bx, Ly);
    const beta = longSide / shortSide;
    const isShortDirection =
      (direction === 'X' && Bx === shortSide) ||
      (direction === 'Y' && Ly === shortSide);
    if (isShortDirection) {
      gammaS = 2 / (beta + 1);
      barsInBand = Math.round(gammaS * layer.count);
      barsOutsideBand = layer.count - barsInBand;
    }
  }
  if (gammaS !== null && barsInBand !== null && barsOutsideBand !== null) {
    steps.push({
      title: 'Short-direction band reinforcement (§13.3.3.3(b))',
      formula: 'γs = 2/(β+1);  bars in band = γs·n;  outside = (1−γs)·n',
      substitution: `β = ${(Math.max(Bx, Ly) / Math.min(Bx, Ly)).toFixed(3)} → γs = ${gammaS.toFixed(3)}, n = ${layer.count}`,
      result: `${barsInBand} bars in band of width ${Math.min(Bx, Ly)} mm centred on column; ${barsOutsideBand} bars distributed outside`,
      ref: ref(code, '13.3.3.3'),
    });
  }

  return {
    direction, cantilever, bw, d, Mu: Mu_kNm, AsReq, AsMin, AsProv, phiMn,
    ratio, ok, ref: ref(code, '13.3.3'),
    gammaS, barsInBand, barsOutsideBand,
    steps,
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

// ─── COLUMN-FOOTING DOWELS (§16.3.4.1) ────────────────────────────────────
//
// Reinforcement crossing the column-footing joint must be at least 0.005·Ag
// where Ag is the gross column area, AND must be sufficient to transfer any
// force in excess of the bearing capacity from column to footing.
//
//   AsDowelMin       = 0.005 · Ag
//   AsDowelTransfer  = max(0, (Pu − φBn,col) / (φ·fy))
//   AsDowelReq       = max(AsDowelMin, AsDowelTransfer)
//
// `dowelAreaProvided` (mm²) on the input is OPTIONAL. When present, the check
// passes/fails based on whether provided ≥ required. When absent, the check
// is INFORMATIONAL — it reports the required area for the engineer to specify.
function checkDowels(
  input: FootingInput, bearingInterface: BearingInterfaceCheck,
): DowelCheck {
  const { code, geometry: g, materials: m } = input;
  const Ag = g.columnShape === 'circular'
    ? PI * Math.pow(g.cx / 2, 2)
    : g.cx * (g.cy ?? g.cx);
  const AsDowelMin = 0.005 * Ag;
  // Force transfer beyond column bearing — if Pu > φBn_col, balance via dowels
  const phi_dowel = 0.65;     // §21.2.1 for compression-controlled (col)
  const Pu_excess = Math.max(0, bearingInterface.Pu - bearingInterface.phiBn_col);
  // Pu in kN, φ·fy in MPa·1.0; convert: AsTransfer = Pu_excess·1000 / (φ·fy)
  const AsDowelTransfer = (Pu_excess * 1000) / (phi_dowel * m.fy);
  const AsDowelReq = Math.max(AsDowelMin, AsDowelTransfer);
  const AsDowelProv = g.dowelAreaProvided ?? 0;
  const informational = g.dowelAreaProvided === undefined;
  const ok = informational ? true : AsDowelProv >= AsDowelReq;

  const steps: CalcStep[] = [
    {
      title: 'Minimum dowel area (§16.3.4.1)',
      formula: 'AsDowelMin = 0.005 · Ag',
      substitution: g.columnShape === 'circular'
        ? `Ag = π·(${g.cx}/2)² = ${Ag.toFixed(0)} mm²`
        : `Ag = ${g.cx} × ${g.cy ?? g.cx} = ${Ag.toFixed(0)} mm²`,
      result: `AsDowelMin = ${AsDowelMin.toFixed(0)} mm²`,
      ref: ref(code, '16.3.4.1'),
    },
    {
      title: 'Force-transfer dowel area',
      formula: 'AsDowelTransfer = max(0, (Pu − φBn,col) / (φ·fy))',
      substitution: `Pu − φBn,col = ${bearingInterface.Pu.toFixed(1)} − ${bearingInterface.phiBn_col.toFixed(1)} = ${Pu_excess.toFixed(1)} kN`,
      result: `AsDowelTransfer = ${AsDowelTransfer.toFixed(0)} mm²`,
      ref: ref(code, '16.3.4'),
    },
    {
      title: 'Governing dowel area required',
      formula: 'AsDowelReq = max(AsDowelMin, AsDowelTransfer)',
      substitution: `max(${AsDowelMin.toFixed(0)}, ${AsDowelTransfer.toFixed(0)})`,
      result: informational
        ? `AsDowelReq = ${AsDowelReq.toFixed(0)} mm² (provide as separate dowels or extend column bars; no value entered yet)`
        : `AsDowelReq = ${AsDowelReq.toFixed(0)} mm² vs AsProv = ${AsDowelProv.toFixed(0)} mm² ${ok ? '✓' : '✗ FAIL — add dowels'}`,
    },
  ];

  return {
    Ag, AsDowelMin, AsDowelTransfer, AsDowelReq, AsDowelProv,
    ok, informational,
    ref: ref(code, '16.3.4.1'), steps,
  };
}

// ─── OVERTURNING (FOS ≥ 1.5) ───────────────────────────────────────────────

function checkOverturning(input: FootingInput, P_service: number): OverturningCheck {
  const { code, geometry: g, loads: L } = input;
  const FOS_req = 1.5;
  const Mx = Math.abs(L.Mx ?? 0);
  const My = Math.abs(L.My ?? 0);
  const H = Math.abs(input.H ?? 0);
  // Lateral H at top of footing produces an overturning moment about the toe
  // with arm T (thickness). Direction is unknown; conservatively add to both
  // axes' overturning moments.
  const T_m = g.T / 1000;
  const M_H = H * T_m;
  const totalMx = Mx + M_H;
  const totalMy = My + M_H;
  if (Mx === 0 && My === 0 && H === 0) {
    return {
      M_resist: 0, M_overturn: 0, FOS: Infinity, FOS_req,
      ratio: 0, ok: true, notApplicable: true,
      ref: ref(code, '13.3 / Bowles 7.3'),
      steps: [{
        title: 'Overturning check',
        formula: 'No applied moment / lateral load → overturning N/A',
        substitution: '', result: 'N/A',
      }],
    };
  }
  // Lever arms — resisting moment is P × (perpendicular half-dimension):
  //   Mx (about X-axis) → footing tries to tip over an X-line edge,
  //                         lifting +L/2 or -L/2 corner → arm = L/2
  //   My (about Y-axis) → tips about Y-line, lifting +B/2 or -B/2 → arm = B/2
  const arm_for_Mx = (g.L / 1000) / 2;     // L/2 in metres
  const arm_for_My = (g.B / 1000) / 2;     // B/2 in metres
  // Compute FOS for each axis independently and take worst.
  const FOS_x = totalMx > 0 ? (P_service * arm_for_Mx) / totalMx : Infinity;
  const FOS_y = totalMy > 0 ? (P_service * arm_for_My) / totalMy : Infinity;
  const FOS = Math.min(FOS_x, FOS_y);
  // Report values from the governing axis
  const govX = FOS_x <= FOS_y;
  const M_resist = govX ? P_service * arm_for_Mx : P_service * arm_for_My;
  const M_overturn = govX ? totalMx : totalMy;
  const govArm = govX ? arm_for_Mx : arm_for_My;
  const ratio = FOS_req / FOS;
  const ok = FOS >= FOS_req;
  return {
    M_resist, M_overturn, FOS, FOS_req,
    ratio, ok, notApplicable: false,
    ref: ref(code, '13.3 / Bowles 7.3'),
    steps: [
      {
        title: 'Resisting moment about toe (governing axis)',
        formula: 'Mres = Pservice × arm  (arm = L/2 for Mx, B/2 for My)',
        substitution: `P = ${P_service.toFixed(1)} kN, arm = ${govArm.toFixed(2)} m (about ${govX ? 'X' : 'Y'}-axis)`,
        result: `Mres = ${M_resist.toFixed(1)} kN·m`,
      },
      {
        title: 'Overturning moment',
        formula: 'Movt = |Mx or My| + H·T  (H acts at top of footing)',
        substitution: `Mx = ${Mx.toFixed(1)}, My = ${My.toFixed(1)}, H·T = ${M_H.toFixed(1)} kN·m`,
        result: `Movt = ${M_overturn.toFixed(1)} kN·m (governs ${govX ? 'about X' : 'about Y'})`,
      },
      {
        title: 'FOS = Mres / Movt',
        formula: 'FOS ≥ 1.5 (typical practice)',
        substitution: `FOS_x = ${FOS_x === Infinity ? 'N/A' : FOS_x.toFixed(2)}, FOS_y = ${FOS_y === Infinity ? 'N/A' : FOS_y.toFixed(2)}`,
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
    const dowel = checkDowels(input, bearingInterface);
    const overturning = checkOverturning(input, bearing.P_service);
    const sliding = checkSliding(input, bearing.P_service);
    const barFitX = checkBarFit(input, 'X');
    const barFitY = checkBarFit(input, 'Y');
    const developmentX = checkDevelopment(input, 'X');
    const developmentY = checkDevelopment(input, 'Y');

    // ── Geometric / cover sanity guards ─────────────────────────────────
    // ACI 318-25 §13.3.1.2: minimum effective depth d ≥ 150 mm for footings.
    const { dX: _dX, dY: _dY } = effectiveDepths(input);
    if (_dX < 150 || _dY < 150) {
      const which = _dX < 150 && _dY < 150 ? 'dX and dY' : (_dX < 150 ? 'dX' : 'dY');
      warnings.push(`${which} = ${Math.min(_dX, _dY).toFixed(0)} mm < 150 mm minimum (ACI 318-25 §13.3.1.2). Increase T or use smaller bars.`);
    }
    // ACI 318-25 Table 20.5.1.3.1: clear cover for cast-against-earth = 75 mm min.
    if (input.geometry.coverClear < 75) {
      warnings.push(`Clear cover = ${input.geometry.coverClear} mm < 75 mm minimum for cast-against-earth (ACI 318-25 Table 20.5.1.3.1). Use 50 mm only if footing is cast on a concrete blinding (PCC bed / mud mat).`);
    }

    if (!bearing.ok) warnings.push(`Bearing fails — service pressure ${bearing.q_max.toFixed(1)} kPa > allowable ${input.soil.qa} kPa. Increase footing area.`);
    if (upliftRegion) warnings.push(`Eccentricity outside kern → partial uplift (Bowles triangular pressure). Consider larger footing OR shifting column.`);
    if (!punching.ok) warnings.push(`Punching shear fails — Vu/φVc = ${punching.ratio.toFixed(2)}. Increase footing thickness.`);
    if (!shearX.ok) warnings.push(`One-way shear (X) fails — Vu/φVc = ${shearX.ratio.toFixed(2)}.`);
    if (!shearY.ok) warnings.push(`One-way shear (Y) fails — Vu/φVc = ${shearY.ratio.toFixed(2)}.`);
    if (!flexureX.ok) warnings.push(`Flexure (X) fails — Mu/φMn = ${flexureX.ratio.toFixed(2)}. Add bottom-X bars.`);
    if (!flexureY.ok) warnings.push(`Flexure (Y) fails — Mu/φMn = ${flexureY.ratio.toFixed(2)}. Add bottom-Y bars.`);
    if (!bearingInterface.ok) warnings.push(`Column bearing fails — add dowel reinforcement per §16.3.4.1.`);
    if (!dowel.ok && !dowel.informational) warnings.push(`Provided dowel area ${dowel.AsDowelProv.toFixed(0)} mm² < required ${dowel.AsDowelReq.toFixed(0)} mm² (ACI 318-25 §16.3.4.1).`);
    if (dowel.informational && dowel.AsDowelReq > 0) warnings.push(`Specify column dowels: As ≥ ${dowel.AsDowelReq.toFixed(0)} mm² required (ACI 318-25 §16.3.4.1, 0.005·Ag minimum).`);
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
               dowel.ok &&
               overturning.ok && sliding.ok &&
               barFitX.ok && barFitY.ok &&
               developmentX.ok && developmentY.ok;

    return {
      input, bearing, punching, shearX, shearY, flexureX, flexureY, bearingInterface,
      dowel,
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
      dowel: emptyDowel(),
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
  return {
    bo: 0, d: 0, betaC: 1, alphaS: 40,
    vc1: 0, vc2: 0, vc3: 0, vc: 0, phiVc: 0, Vu: 0,
    vuv: 0, vuMax: 0, phiVcStress: 0,
    gammaF: 0, gammaV: 0, MuX: 0, MuY: 0,
    JcX: 0, JcY: 0, dvuMx: 0, dvuMy: 0,
    ratio: 0, ok: false, ref: '', steps: [],
  };
}
function emptyShear(direction: 'X' | 'Y'): OneWayShearCheck {
  return { direction, bw: 0, d: 0, cantilever: 0, Vc: 0, phiVc: 0, Vu: 0, ratio: 0, ok: false, ref: '', steps: [] };
}
function emptyFlex(direction: 'X' | 'Y'): FootingFlexureCheck {
  return {
    direction, cantilever: 0, bw: 0, d: 0, Mu: 0, AsReq: 0, AsMin: 0, AsProv: 0, phiMn: 0,
    ratio: 0, ok: false, gammaS: null, barsInBand: null, barsOutsideBand: null,
    ref: '', steps: [],
  };
}
function emptyBearingInt(): BearingInterfaceCheck {
  return { phiBn_col: 0, phiBn_ftg: 0, phiBn: 0, Pu: 0, ratio: 0, ok: false, ref: '', steps: [] };
}
function emptyDowel(): DowelCheck {
  return {
    Ag: 0, AsDowelMin: 0, AsDowelTransfer: 0, AsDowelReq: 0, AsDowelProv: 0,
    ok: true, informational: true, ref: '', steps: [],
  };
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
