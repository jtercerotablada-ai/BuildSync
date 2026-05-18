/**
 * MEGA QC — imperial unit path end-to-end verification.
 *
 * For each of a comprehensive set of analytically-known cases, we:
 *   1. Define the problem in IMPERIAL units (what the user types)
 *   2. Convert inputs to SI via toSI()  (same path the UI uses)
 *   3. Run the solver on the SI model
 *   4. Convert results back to imperial via fromSI() (same path the UI uses)
 *   5. Compare to the analytical imperial answer
 *
 * This catches any silent bug in the unit conversion layer OR in how the
 * solver handles the resulting SI magnitudes.
 */
import { solve } from '../src/lib/beam/solver';
import { toSI, fromSI } from '../src/lib/beam/units';
import type { BeamModel, DiagramPoint } from '../src/lib/beam/types';

let totalChecks = 0;
let totalFails = 0;
const failMessages: string[] = [];

function check(label: string, got: number, expected: number, tol = 0.01) {
  totalChecks += 1;
  const diff = Math.abs(got - expected);
  const denom = Math.max(Math.abs(expected), 1e-6);
  const relErr = diff / denom;
  if (relErr > tol) {
    totalFails += 1;
    const msg = `    FAIL ${label}: got ${got.toFixed(6)}, expected ${expected.toFixed(6)}  (rel err ${(relErr * 100).toFixed(3)}%)`;
    failMessages.push(msg);
    console.log('\x1b[31m' + msg + '\x1b[0m');
  }
}

function header(name: string) {
  console.log(`\n── ${name} ──`);
}

function sample(pts: DiagramPoint[], x: number): number {
  let best = pts[0];
  let bestDist = Math.abs(best.x - x);
  for (const p of pts) {
    const d = Math.abs(p.x - x);
    if (d < bestDist) {
      bestDist = d;
      best = p;
    }
  }
  return best.value;
}

// ---------------------------------------------------------------
// Round-trip conversion sanity (must be numerically invertible)
// ---------------------------------------------------------------
function roundTripTests() {
  header('Round-trip: imperial ↔ SI ↔ imperial');
  const quantities = ['length', 'position', 'force', 'distLoad', 'moment', 'deflection', 'E', 'I', 'A', 'density'] as const;
  const samples = [0.1, 0.5, 1, 3.14159, 10, 100, 1234.56, 99999];
  for (const q of quantities) {
    for (const v of samples) {
      const si = toSI(v, q, 'imperial');
      const back = fromSI(si, q, 'imperial');
      check(`${q} roundtrip(${v})`, back, v, 1e-9);
    }
  }
}

// ---------------------------------------------------------------
// Build an imperial model: accepts imperial values, builds SI model.
// ---------------------------------------------------------------
function imperialModel(Lft: number): BeamModel {
  return {
    length: toSI(Lft, 'length', 'imperial'),
    section: {
      material: 'steel',
      E: toSI(29000, 'E', 'imperial'),      // 29,000 ksi → MPa
      I: toSI(199, 'I', 'imperial'),        // W14x22 I ≈ 199 in⁴ → mm⁴
      A: toSI(6.49, 'A', 'imperial'),        // W14x22 A ≈ 6.49 in² → mm²
      label: 'W14x22',
    },
    supports: [],
    loads: [],
    moments: [],
    selfWeight: false,
    density: toSI(490, 'density', 'imperial'), // steel 490 pcf → kg/m³
  };
}

// Convenience converters so tests read naturally
const LEN = (ft: number) => toSI(ft, 'position', 'imperial');
const F = (kip: number) => toSI(kip, 'force', 'imperial');
const W = (kipft: number) => toSI(kipft, 'distLoad', 'imperial');
const MM = (kipftval: number) => toSI(kipftval, 'moment', 'imperial');

function V_kip(r: { V: number }) { return fromSI(r.V, 'force', 'imperial'); }
function M_kipft(r: { M: number }) { return fromSI(r.M, 'moment', 'imperial'); }
function shear_kip(pts: DiagramPoint[], xFt: number) {
  return fromSI(sample(pts, LEN(xFt)), 'force', 'imperial');
}
function moment_kipft(pts: DiagramPoint[], xFt: number) {
  return fromSI(sample(pts, LEN(xFt)), 'moment', 'imperial');
}
function defl_in(pts: DiagramPoint[], xFt: number) {
  return fromSI(sample(pts, LEN(xFt)), 'deflection', 'imperial');
}

// ---------------------------------------------------------------
// Case I-01: SS, central point load (AISC textbook)
// ---------------------------------------------------------------
function caseI_01() {
  header('I-01: Simply supported L=20ft, P=15 kip @ center');
  const L = 20, P = 15;
  const m = imperialModel(L);
  m.supports = [
    { id: 's1', type: 'pinned', position: 0 },
    { id: 's2', type: 'roller', position: LEN(L) },
  ];
  m.loads = [{
    id: 'l1', type: 'point', position: LEN(L / 2), magnitude: F(P),
    direction: 'down', loadCase: 'dead',
  }];
  const r = solve(m);
  check('R0 (kip)', V_kip(r.reactions[0]), P / 2);
  check('RL (kip)', V_kip(r.reactions[1]), P / 2);
  check('M_mid (kip·ft)', moment_kipft(r.moment, L / 2), P * L / 4);
  check('M_ends zero', moment_kipft(r.moment, 0), 0, 0.02);
}

// ---------------------------------------------------------------
// Case I-02: SS, UDL full span
// ---------------------------------------------------------------
function caseI_02() {
  header('I-02: Simply supported L=24ft, UDL w=2 kip/ft');
  const L = 24, w = 2;
  const m = imperialModel(L);
  m.supports = [
    { id: 's1', type: 'pinned', position: 0 },
    { id: 's2', type: 'roller', position: LEN(L) },
  ];
  m.loads = [{
    id: 'l1', type: 'distributed',
    startPosition: 0, endPosition: LEN(L),
    startMagnitude: W(w), endMagnitude: W(w),
    direction: 'down', loadCase: 'dead',
  }];
  const r = solve(m);
  check('R0', V_kip(r.reactions[0]), w * L / 2);
  check('RL', V_kip(r.reactions[1]), w * L / 2);
  check('M_mid', moment_kipft(r.moment, L / 2), w * L * L / 8);
}

// ---------------------------------------------------------------
// Case I-03: Cantilever, point load at tip
// ---------------------------------------------------------------
function caseI_03() {
  header('I-03: Cantilever L=10ft, P=5 kip @ tip');
  const L = 10, P = 5;
  const m = imperialModel(L);
  m.supports = [{ id: 's1', type: 'fixed', position: 0 }];
  m.loads = [{
    id: 'l1', type: 'point', position: LEN(L), magnitude: F(P),
    direction: 'down', loadCase: 'dead',
  }];
  const r = solve(m);
  check('R_V', V_kip(r.reactions[0]), P);
  check('R_M (kip·ft)', M_kipft(r.reactions[0]), -P * L);
  check('M at fixed', moment_kipft(r.moment, 0), -P * L);
  check('M at tip', moment_kipft(r.moment, L), 0, 0.02);
  // Deflection: δ_tip = PL³/(3EI)
  const E_psi = 29000 * 1000;          // ksi → psi
  const I_in4 = 199;
  const L_in = L * 12;
  const P_lb = P * 1000;
  const delta_in = (P_lb * L_in ** 3) / (3 * E_psi * I_in4);
  check('δ_tip (in)', Math.abs(defl_in(r.deflection, L)), delta_in, 0.02);
}

// ---------------------------------------------------------------
// Case I-04: Cantilever + UDL full span
// ---------------------------------------------------------------
function caseI_04() {
  header('I-04: Cantilever L=12ft, UDL w=1.5 kip/ft');
  const L = 12, w = 1.5;
  const m = imperialModel(L);
  m.supports = [{ id: 's1', type: 'fixed', position: 0 }];
  m.loads = [{
    id: 'l1', type: 'distributed',
    startPosition: 0, endPosition: LEN(L),
    startMagnitude: W(w), endMagnitude: W(w),
    direction: 'down', loadCase: 'dead',
  }];
  const r = solve(m);
  check('R_V', V_kip(r.reactions[0]), w * L);
  check('R_M', M_kipft(r.reactions[0]), -w * L * L / 2);
  check('M fixed', moment_kipft(r.moment, 0), -w * L * L / 2);
  // δ_tip = wL⁴/(8EI)
  const E_psi = 29000 * 1000, I_in4 = 199, L_in = L * 12, w_lbin = w * 1000 / 12;
  const delta_in = (w_lbin * L_in ** 4) / (8 * E_psi * I_in4);
  check('δ_tip (in)', Math.abs(defl_in(r.deflection, L)), delta_in, 0.02);
}

// ---------------------------------------------------------------
// Case I-05: Fixed-fixed + UDL (Juan's case)
// ---------------------------------------------------------------
function caseI_05() {
  header('I-05: Fixed-fixed L=30ft, UDL w=10 kip/ft (Juan screenshot)');
  const L = 30, w = 10;
  const m = imperialModel(L);
  m.supports = [
    { id: 's1', type: 'fixed', position: 0 },
    { id: 's2', type: 'fixed', position: LEN(L) },
  ];
  m.loads = [{
    id: 'l1', type: 'distributed',
    startPosition: 0, endPosition: LEN(L),
    startMagnitude: W(w), endMagnitude: W(w),
    direction: 'down', loadCase: 'dead',
  }];
  const r = solve(m);
  check('R_V_0', V_kip(r.reactions[0]), w * L / 2);
  check('R_V_L', V_kip(r.reactions[1]), w * L / 2);
  check('R_M_0', M_kipft(r.reactions[0]), -w * L * L / 12);
  check('R_M_L', M_kipft(r.reactions[1]), +w * L * L / 12);
  check('M_mid', moment_kipft(r.moment, L / 2), +w * L * L / 24);
}

// ---------------------------------------------------------------
// Case I-06: Fixed-fixed + central P
// ---------------------------------------------------------------
function caseI_06() {
  header('I-06: Fixed-fixed L=16ft, P=20 kip @ center');
  const L = 16, P = 20;
  const m = imperialModel(L);
  m.supports = [
    { id: 's1', type: 'fixed', position: 0 },
    { id: 's2', type: 'fixed', position: LEN(L) },
  ];
  m.loads = [{
    id: 'l1', type: 'point', position: LEN(L / 2), magnitude: F(P),
    direction: 'down', loadCase: 'dead',
  }];
  const r = solve(m);
  check('R_V_0', V_kip(r.reactions[0]), P / 2);
  check('R_V_L', V_kip(r.reactions[1]), P / 2);
  check('R_M_0', M_kipft(r.reactions[0]), -P * L / 8);
  check('R_M_L', M_kipft(r.reactions[1]), +P * L / 8);
  check('M_mid', moment_kipft(r.moment, L / 2), +P * L / 8);
}

// ---------------------------------------------------------------
// Case I-07: Propped cantilever + UDL
// ---------------------------------------------------------------
function caseI_07() {
  header('I-07: Propped cantilever L=20ft, UDL w=3 kip/ft');
  const L = 20, w = 3;
  const m = imperialModel(L);
  m.supports = [
    { id: 's1', type: 'fixed', position: 0 },
    { id: 's2', type: 'roller', position: LEN(L) },
  ];
  m.loads = [{
    id: 'l1', type: 'distributed',
    startPosition: 0, endPosition: LEN(L),
    startMagnitude: W(w), endMagnitude: W(w),
    direction: 'down', loadCase: 'dead',
  }];
  const r = solve(m);
  check('R_fixed', V_kip(r.reactions[0]), 5 * w * L / 8);
  check('R_roller', V_kip(r.reactions[1]), 3 * w * L / 8);
  check('R_M_fixed', M_kipft(r.reactions[0]), -w * L * L / 8);
}

// ---------------------------------------------------------------
// Case I-08: SS + applied moment at midspan (CCW)
// ---------------------------------------------------------------
function caseI_08() {
  header('I-08: SS L=20ft, CCW moment M0=40 kip·ft at midspan');
  const L = 20, M0 = 40;
  const m = imperialModel(L);
  m.supports = [
    { id: 's1', type: 'pinned', position: 0 },
    { id: 's2', type: 'roller', position: LEN(L) },
  ];
  m.moments = [{ id: 'm1', position: LEN(L / 2), magnitude: MM(M0), direction: 'ccw' }];
  const r = solve(m);
  check('R0', V_kip(r.reactions[0]), M0 / L);
  check('RL', V_kip(r.reactions[1]), -M0 / L);
  check('M just before mid', moment_kipft(r.moment, L / 2 - 0.1), M0 / 2, 0.05);
  check('M just after mid', moment_kipft(r.moment, L / 2 + 0.1), -M0 / 2, 0.05);
}

// ---------------------------------------------------------------
// Case I-09: SS + overhang (double overhang)
// ---------------------------------------------------------------
function caseI_09() {
  header('I-09: Double overhang L=40ft, pin@10, roller@30, UDL w=2 kip/ft');
  const L = 40, w = 2, a = 10, b = 30;
  const m = imperialModel(L);
  m.supports = [
    { id: 's1', type: 'pinned', position: LEN(a) },
    { id: 's2', type: 'roller', position: LEN(b) },
  ];
  m.loads = [{
    id: 'l1', type: 'distributed',
    startPosition: 0, endPosition: LEN(L),
    startMagnitude: W(w), endMagnitude: W(w),
    direction: 'down', loadCase: 'dead',
  }];
  const r = solve(m);
  // Symmetric, total load wL, split equally
  check('R_pin', V_kip(r.reactions[0]), w * L / 2);
  check('R_roller', V_kip(r.reactions[1]), w * L / 2);
  // Cantilever moment at each support: M_sup = -w·a²/2 (a=10)
  check('M at pin', moment_kipft(r.moment, a), -w * a * a / 2, 0.05);
  check('M at roller', moment_kipft(r.moment, b), -w * a * a / 2, 0.05);
}

// ---------------------------------------------------------------
// Case I-10: Very short beam (edge case: L=0.5 ft)
// ---------------------------------------------------------------
function caseI_10() {
  header('I-10: Very short SS L=0.5ft, P=5 kip @ center');
  const L = 0.5, P = 5;
  const m = imperialModel(L);
  m.supports = [
    { id: 's1', type: 'pinned', position: 0 },
    { id: 's2', type: 'roller', position: LEN(L) },
  ];
  m.loads = [{
    id: 'l1', type: 'point', position: LEN(L / 2), magnitude: F(P),
    direction: 'down', loadCase: 'dead',
  }];
  const r = solve(m);
  check('R0', V_kip(r.reactions[0]), P / 2);
  check('RL', V_kip(r.reactions[1]), P / 2);
  check('M_mid', moment_kipft(r.moment, L / 2), P * L / 4, 0.05);
}

// ---------------------------------------------------------------
// Case I-11: Very long beam (edge case: L=100 ft)
// ---------------------------------------------------------------
function caseI_11() {
  header('I-11: Very long SS L=100ft, UDL w=0.8 kip/ft');
  const L = 100, w = 0.8;
  const m = imperialModel(L);
  m.supports = [
    { id: 's1', type: 'pinned', position: 0 },
    { id: 's2', type: 'roller', position: LEN(L) },
  ];
  m.loads = [{
    id: 'l1', type: 'distributed',
    startPosition: 0, endPosition: LEN(L),
    startMagnitude: W(w), endMagnitude: W(w),
    direction: 'down', loadCase: 'dead',
  }];
  const r = solve(m);
  check('R0', V_kip(r.reactions[0]), w * L / 2);
  check('RL', V_kip(r.reactions[1]), w * L / 2);
  check('M_mid', moment_kipft(r.moment, L / 2), w * L * L / 8);
}

// ---------------------------------------------------------------
// Case I-12: Triangular load (ascending) on SS
// ---------------------------------------------------------------
function caseI_12() {
  header('I-12: SS L=18ft, triangular 0→w=6 kip/ft');
  const L = 18, wMax = 6;
  const m = imperialModel(L);
  m.supports = [
    { id: 's1', type: 'pinned', position: 0 },
    { id: 's2', type: 'roller', position: LEN(L) },
  ];
  m.loads = [{
    id: 'l1', type: 'distributed',
    startPosition: 0, endPosition: LEN(L),
    startMagnitude: W(0), endMagnitude: W(wMax),
    direction: 'down', loadCase: 'dead',
  }];
  const r = solve(m);
  // Total W = wL/2 = 54. Centroid at 2L/3 = 12.
  const Wt = wMax * L / 2;
  // R0·L = Wt·(L - 2L/3) = Wt·L/3 → R0 = Wt/3 = 18
  // RL = Wt - R0 = 36
  check('R0', V_kip(r.reactions[0]), Wt / 3);
  check('RL', V_kip(r.reactions[1]), 2 * Wt / 3);
}

// ---------------------------------------------------------------
// Case I-13: Cantilever + applied moment at free tip (CCW)
// ---------------------------------------------------------------
function caseI_13() {
  header('I-13: Cantilever L=8ft, CCW moment M0=30 kip·ft @ tip');
  const L = 8, M0 = 30;
  const m = imperialModel(L);
  m.supports = [{ id: 's1', type: 'fixed', position: 0 }];
  m.moments = [{ id: 'm1', position: LEN(L), magnitude: MM(M0), direction: 'ccw' }];
  const r = solve(m);
  check('R_V', V_kip(r.reactions[0]), 0, 0.05);
  check('R_M', M_kipft(r.reactions[0]), +M0, 0.02);
  check('M constant = +M0', moment_kipft(r.moment, L / 2), M0, 0.02);
}

// ---------------------------------------------------------------
// Case I-14: Cantilever + triangular load (0 at fixed → w at tip)
// ---------------------------------------------------------------
function caseI_14() {
  header('I-14: Cantilever L=12ft, triangular 0→w=4 kip/ft (max at tip)');
  const L = 12, wMax = 4;
  const m = imperialModel(L);
  m.supports = [{ id: 's1', type: 'fixed', position: 0 }];
  m.loads = [{
    id: 'l1', type: 'distributed',
    startPosition: 0, endPosition: LEN(L),
    startMagnitude: W(0), endMagnitude: W(wMax),
    direction: 'down', loadCase: 'dead',
  }];
  const r = solve(m);
  // Total W = wL/2 = 24, centroid at 2L/3 = 8.
  const Wt = wMax * L / 2;
  check('R_V', V_kip(r.reactions[0]), Wt);
  check('R_M', M_kipft(r.reactions[0]), -Wt * (2 * L / 3), 0.05);
  // δ_tip = 11·wL⁴/(120·EI)
  const E_psi = 29000 * 1000, I_in4 = 199, L_in = L * 12, wMax_lbin = wMax * 1000 / 12;
  const delta_in = (11 * wMax_lbin * L_in ** 4) / (120 * E_psi * I_in4);
  check('δ_tip (in)', Math.abs(defl_in(r.deflection, L)), delta_in, 0.05);
}

// ---------------------------------------------------------------
// Case I-15: SS + three point loads (stress test)
// ---------------------------------------------------------------
function caseI_15() {
  header('I-15: SS L=20ft, P=5 kip @ 5ft, 10 kip @ 10ft, 5 kip @ 15ft');
  const L = 20;
  const m = imperialModel(L);
  m.supports = [
    { id: 's1', type: 'pinned', position: 0 },
    { id: 's2', type: 'roller', position: LEN(L) },
  ];
  m.loads = [
    { id: 'l1', type: 'point', position: LEN(5), magnitude: F(5), direction: 'down', loadCase: 'dead' },
    { id: 'l2', type: 'point', position: LEN(10), magnitude: F(10), direction: 'down', loadCase: 'dead' },
    { id: 'l3', type: 'point', position: LEN(15), magnitude: F(5), direction: 'down', loadCase: 'dead' },
  ];
  const r = solve(m);
  // Symmetric, total = 20, each R = 10
  check('R0', V_kip(r.reactions[0]), 10);
  check('RL', V_kip(r.reactions[1]), 10);
  // M at x=10: 10·10 - 5·5 = 75
  check('M @ 10', moment_kipft(r.moment, 10), 75, 0.05);
}

// ---------------------------------------------------------------
// Case I-16: Mixed direction load (up + down)
// ---------------------------------------------------------------
function caseI_16() {
  header('I-16: SS L=20ft, UDL 2 kip/ft DOWN + P=10 kip UP @ center');
  const L = 20, w = 2, P = 10;
  const m = imperialModel(L);
  m.supports = [
    { id: 's1', type: 'pinned', position: 0 },
    { id: 's2', type: 'roller', position: LEN(L) },
  ];
  m.loads = [
    {
      id: 'l1', type: 'distributed',
      startPosition: 0, endPosition: LEN(L),
      startMagnitude: W(w), endMagnitude: W(w),
      direction: 'down', loadCase: 'dead',
    },
    { id: 'l2', type: 'point', position: LEN(L / 2), magnitude: F(P), direction: 'up', loadCase: 'dead' },
  ];
  const r = solve(m);
  // Net down = wL - P = 40 - 10 = 30; each R = 15
  check('R0', V_kip(r.reactions[0]), (w * L - P) / 2);
  check('RL', V_kip(r.reactions[1]), (w * L - P) / 2);
  // M_mid = R·L/2 - w·(L/2)²/2 - 0 (P acts AT mid, no lever)
  const Mmid = 15 * L / 2 - w * (L / 2) ** 2 / 2;
  check('M_mid', moment_kipft(r.moment, L / 2), Mmid, 0.05);
}

// ---------------------------------------------------------------
// Case I-17: 2-span continuous beam
// ---------------------------------------------------------------
function caseI_17() {
  header('I-17: 2-span continuous L=40ft, supports @ 0/20/40, UDL w=2 kip/ft');
  const L = 40, w = 2, l = 20;
  const m = imperialModel(L);
  m.supports = [
    { id: 's1', type: 'pinned', position: 0 },
    { id: 's2', type: 'roller', position: LEN(l) },
    { id: 's3', type: 'roller', position: LEN(L) },
  ];
  m.loads = [{
    id: 'l1', type: 'distributed',
    startPosition: 0, endPosition: LEN(L),
    startMagnitude: W(w), endMagnitude: W(w),
    direction: 'down', loadCase: 'dead',
  }];
  const r = solve(m);
  // Classical 2-span UDL: R_end = 3wl/8, R_int = 5wl/4, M_int = -wl²/8
  check('R_end_0', V_kip(r.reactions[0]), 3 * w * l / 8);
  check('R_int', V_kip(r.reactions[1]), 5 * w * l / 4);
  check('R_end_L', V_kip(r.reactions[2]), 3 * w * l / 8);
  check('M_over_int', moment_kipft(r.moment, l), -w * l * l / 8, 0.02);
}

// ---------------------------------------------------------------
// Case I-18: SS + UDL partial span
// ---------------------------------------------------------------
function caseI_18() {
  header('I-18: SS L=30ft, UDL w=4 kip/ft on [10, 20]');
  const L = 30, w = 4, a = 10, b = 20;
  const m = imperialModel(L);
  m.supports = [
    { id: 's1', type: 'pinned', position: 0 },
    { id: 's2', type: 'roller', position: LEN(L) },
  ];
  m.loads = [{
    id: 'l1', type: 'distributed',
    startPosition: LEN(a), endPosition: LEN(b),
    startMagnitude: W(w), endMagnitude: W(w),
    direction: 'down', loadCase: 'dead',
  }];
  const r = solve(m);
  const Wt = w * (b - a);
  const xc = (a + b) / 2;
  check('R_total', V_kip(r.reactions[0]) + V_kip(r.reactions[1]), Wt);
  // R0·L = Wt·(L - xc) → R0 = Wt·(L - xc)/L
  check('R0', V_kip(r.reactions[0]), Wt * (L - xc) / L, 0.02);
  check('RL', V_kip(r.reactions[1]), Wt * xc / L, 0.02);
}

// ---------------------------------------------------------------
// Case I-19: Applied CW moment vs CCW at same position
// ---------------------------------------------------------------
function caseI_19() {
  header('I-19: SS L=20ft, CW moment M0=40 kip·ft @ midspan (mirror of I-08)');
  const L = 20, M0 = 40;
  const m = imperialModel(L);
  m.supports = [
    { id: 's1', type: 'pinned', position: 0 },
    { id: 's2', type: 'roller', position: LEN(L) },
  ];
  m.moments = [{ id: 'm1', position: LEN(L / 2), magnitude: MM(M0), direction: 'cw' }];
  const r = solve(m);
  // CW → opposite signs of CCW case
  check('R0', V_kip(r.reactions[0]), -M0 / L);
  check('RL', V_kip(r.reactions[1]), M0 / L);
}

// ---------------------------------------------------------------
// Case I-20: Section properties round-trip (E, I in imperial)
// ---------------------------------------------------------------
function caseI_20() {
  header('I-20: W14x22 (I=199 in⁴, E=29000 ksi): SS L=20, P=10 @ center');
  // Verify deflection matches classic PL³/(48EI)
  const L = 20, P = 10;
  const m = imperialModel(L);
  m.supports = [
    { id: 's1', type: 'pinned', position: 0 },
    { id: 's2', type: 'roller', position: LEN(L) },
  ];
  m.loads = [{ id: 'l1', type: 'point', position: LEN(L / 2), magnitude: F(P), direction: 'down', loadCase: 'dead' }];
  const r = solve(m);
  // δ_mid = PL³/(48EI) in consistent imperial units (inches)
  const E_psi = 29000 * 1000;
  const I_in4 = 199;
  const L_in = L * 12;
  const P_lb = P * 1000;
  const delta_in = (P_lb * L_in ** 3) / (48 * E_psi * I_in4);
  check('δ_mid (in)', Math.abs(defl_in(r.deflection, L / 2)), delta_in, 0.02);
}

// ---------------------------------------------------------------
// Run all
// ---------------------------------------------------------------
roundTripTests();
caseI_01();
caseI_02();
caseI_03();
caseI_04();
caseI_05();
caseI_06();
caseI_07();
caseI_08();
caseI_09();
caseI_10();
caseI_11();
caseI_12();
caseI_13();
caseI_14();
caseI_15();
caseI_16();
caseI_17();
caseI_18();
caseI_19();
caseI_20();

console.log('\n════════════════════════════════════');
if (totalFails === 0) {
  console.log(`\x1b[32mResult: ${totalChecks} pass, 0 fail — IMPERIAL path verified\x1b[0m`);
} else {
  console.log(`\x1b[31mResult: ${totalChecks - totalFails} pass, ${totalFails} FAIL\x1b[0m`);
  for (const f of failMessages) console.log(f);
}
