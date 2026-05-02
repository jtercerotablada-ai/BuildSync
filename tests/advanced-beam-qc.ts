// Advanced Beam — EXTENSIVE QC SUITE
// Cross-checks the solver against closed-form solutions from:
//   • Hibbeler, Structural Analysis (10th ed.)
//   • Gere, Mechanics of Materials (8th ed.)
//   • Roark's Formulas for Stress and Strain (8th ed.)
//   • AISC Steel Construction Manual beam tables
//   • Standard textbook problems for indeterminate beams (Clapeyron 3-moment, etc.)

import { solve } from '../src/lib/advanced-beam/solver';
import type { BeamModel, Load, Support, Segment, Hinge } from '../src/lib/advanced-beam/types';

// ---------- Test harness ----------
let PASS = 0;
let FAIL = 0;
const failMsgs: string[] = [];

function expect(name: string, actual: number, expected: number, tol = 0.01) {
  const diff = Math.abs(actual - expected);
  const denom = Math.max(Math.abs(expected), 1e-12);
  const rel = diff / denom;
  const ok = rel <= tol;
  if (ok) {
    PASS++;
    console.log(
      `  PASS ${name}: ${fmt(actual)} (expected ${fmt(expected)}, ${(rel * 100).toFixed(2)}%)`,
    );
  } else {
    FAIL++;
    const msg = `  FAIL ${name}: GOT ${fmt(actual)} EXPECTED ${fmt(expected)} (${(rel * 100).toFixed(2)}% off, tol ${(tol * 100).toFixed(0)}%)`;
    console.log(msg);
    failMsgs.push(msg);
  }
}

function expectNear(name: string, actual: number, expected: number, absTol: number) {
  const diff = Math.abs(actual - expected);
  const ok = diff <= absTol;
  if (ok) {
    PASS++;
    console.log(`  PASS ${name}: ${fmt(actual)} (expected ${fmt(expected)}, |Δ|=${fmt(diff)})`);
  } else {
    FAIL++;
    const msg = `  FAIL ${name}: GOT ${fmt(actual)} EXPECTED ${fmt(expected)} (|Δ|=${fmt(diff)}, absTol=${absTol})`;
    console.log(msg);
    failMsgs.push(msg);
  }
}

function fmt(n: number) {
  if (Math.abs(n) >= 1000 || (Math.abs(n) < 0.01 && n !== 0)) return n.toExponential(4);
  return n.toFixed(4);
}

function block(name: string) {
  console.log(`\n=== ${name} ===`);
}

// ---------- Standard beam material/geometry for tests ----------
// E = 200 000 MPa, I = 100e6 mm⁴ → EI = 2e7 N·m² = 20 000 kN·m²
const E_TEST = 200_000;
const I_TEST = 100e6;
const EI_TEST = 20_000;        // kN·m² (for analytical formulas)
const A_TEST = 5_000;          // mm²

function seg(start: number, end: number, opts: Partial<Segment> = {}): Segment {
  return {
    id: `seg-${start}-${end}`,
    startPosition: start,
    endPosition: end,
    E: E_TEST,
    I: I_TEST,
    A: A_TEST,
    ...opts,
  };
}
function support(id: string, pos: number, type: Support['type'], extra: Partial<Support> = {}): Support {
  return { id, position: pos, type, ...extra };
}
function pointLoad(id: string, pos: number, mag: number, dir: 'down' | 'up' = 'down'): Load {
  return { id, type: 'point', position: pos, magnitude: mag, direction: dir };
}
function udl(id: string, a: number, b: number, w: number, dir: 'down' | 'up' = 'down'): Load {
  return {
    id, type: 'distributed', startPosition: a, endPosition: b,
    startMagnitude: w, endMagnitude: w, direction: dir,
  };
}
function trapLoad(id: string, a: number, b: number, wA: number, wB: number, dir: 'down' | 'up' = 'down'): Load {
  return {
    id, type: 'distributed', startPosition: a, endPosition: b,
    startMagnitude: wA, endMagnitude: wB, direction: dir,
  };
}
function pointMoment(id: string, pos: number, mag: number, dir: 'cw' | 'ccw' = 'ccw'): Load {
  return { id, type: 'moment', position: pos, magnitude: mag, direction: dir };
}

console.log('================================================');
console.log(' ADVANCED BEAM SOLVER — QC SUITE');
console.log(' EI test value: ' + EI_TEST + ' kN·m²');
console.log('================================================');

// ============================================================
// BLOCK 1: Simply-supported beams (statically determinate)
// ============================================================
block('BLOCK 1 — Simply-supported beam, point load at midspan');
{
  // SS beam, L=6, P=50 kN at midspan
  // M_max = PL/4 = 75 kN·m;  δ_max = PL³/(48EI);  R = ±25 kN
  const L = 6, P = 50;
  const m: BeamModel = {
    totalLength: L,
    segments: [seg(0, L)],
    supports: [support('A', 0, 'pin'), support('B', L, 'roller')],
    hinges: [],
    loads: [pointLoad('P1', L / 2, P)],
  };
  const r = solve(m);
  expect('R_A vertical', r.reactions[0].V, 25, 0.005);
  expect('R_B vertical', r.reactions[1].V, 25, 0.005);
  expect('M_max sagging', r.maxMoment.value, P * L / 4, 0.005);
  expect('M_max location', r.maxMoment.position, L / 2, 0.02);
  const deltaAnalytical = (P * Math.pow(L, 3)) / (48 * EI_TEST) * 1000; // mm
  expect('δ_max midspan (mm)', Math.abs(r.maxDeflection.value), deltaAnalytical, 0.01);
}

block('BLOCK 2 — Simply-supported beam, off-center point load');
{
  // SS beam L=8, P=40 kN at a=3 from left, b=5 from right
  // R_A = Pb/L = 40·5/8 = 25;  R_B = Pa/L = 40·3/8 = 15
  // M_max = Pab/L at load point = 40·3·5/8 = 75
  const L = 8, P = 40, a = 3, b = L - a;
  const m: BeamModel = {
    totalLength: L,
    segments: [seg(0, L)],
    supports: [support('A', 0, 'pin'), support('B', L, 'roller')],
    hinges: [],
    loads: [pointLoad('P1', a, P)],
  };
  const r = solve(m);
  expect('R_A', r.reactions[0].V, P * b / L, 0.01);
  expect('R_B', r.reactions[1].V, P * a / L, 0.01);
  expect('M_max', r.maxMoment.value, P * a * b / L, 0.01);
  expect('M_max location', r.maxMoment.position, a, 0.05);
}

block('BLOCK 3 — Simply-supported beam, full UDL');
{
  // SS beam L=6, w=10 kN/m
  // R = wL/2 = 30;  M_max = wL²/8 = 45;  δ = 5wL⁴/(384EI)
  const L = 6, w = 10;
  const m: BeamModel = {
    totalLength: L,
    segments: [seg(0, L)],
    supports: [support('A', 0, 'pin'), support('B', L, 'roller')],
    hinges: [],
    loads: [udl('w1', 0, L, w)],
  };
  const r = solve(m);
  expect('R_A', r.reactions[0].V, w * L / 2, 0.005);
  expect('R_B', r.reactions[1].V, w * L / 2, 0.005);
  expect('M_max', r.maxMoment.value, w * L * L / 8, 0.005);
  const deltaAnalytical = 5 * w * Math.pow(L, 4) / (384 * EI_TEST) * 1000;
  expect('δ_max midspan (mm)', Math.abs(r.maxDeflection.value), deltaAnalytical, 0.01);
}

block('BLOCK 4 — Simply-supported beam, triangular load (peak at right)');
{
  // SS beam L=6, w₀=12 at right (linearly varying from 0)
  // R_A = w₀L/6 = 12;  R_B = w₀L/3 = 24
  // M_max at x = L/√3 = 3.464 m, M_max = w₀L²/(9√3) = 27.71
  const L = 6, w0 = 12;
  const m: BeamModel = {
    totalLength: L,
    segments: [seg(0, L)],
    supports: [support('A', 0, 'pin'), support('B', L, 'roller')],
    hinges: [],
    loads: [trapLoad('t1', 0, L, 0, w0)],
  };
  const r = solve(m);
  expect('R_A', r.reactions[0].V, w0 * L / 6, 0.01);
  expect('R_B', r.reactions[1].V, w0 * L / 3, 0.01);
  expect('M_max', r.maxMoment.value, w0 * L * L / (9 * Math.sqrt(3)), 0.01);
  expect('M_max location', r.maxMoment.position, L / Math.sqrt(3), 0.02);
}

block('BLOCK 5 — Simply-supported beam, applied CCW moment at midspan');
{
  // SS beam L=6, M0=80 kN·m CCW applied at midspan.
  // ΣM_about_A (CCW pos): R_B·L + M0 = 0  → R_B = -M0/L  (DOWN)
  // ΣF_y: R_A + R_B = 0  → R_A = +M0/L  (UP)
  // Section-cut M (sagging+):
  //   M(x<L/2) = +R_A·x = +(M0/L)·x  → at L/2⁻: +M0/2 (SAGGING+)
  //   M(x>L/2) = +R_A·x − M0 (CCW couple on left subtracts)  → at L/2⁺: −M0/2 (HOGGING)
  //   M(L⁻) = +M0 − M0 = 0 ✓
  const L = 6, M0 = 80;
  const m: BeamModel = {
    totalLength: L,
    segments: [seg(0, L)],
    supports: [support('A', 0, 'pin'), support('B', L, 'roller')],
    hinges: [],
    loads: [pointMoment('m1', L / 2, M0, 'ccw')],
  };
  const r = solve(m);
  expect('R_A (up)',  r.reactions[0].V, +M0 / L, 0.01);
  expect('R_B (down)', r.reactions[1].V, -M0 / L, 0.01);
  expect('M(L/2⁻) sagging+', findMomentAt(r.moment, L / 2 - 0.001), +M0 / 2, 0.05);
  expect('M(L/2⁺) hogging',  findMomentAt(r.moment, L / 2 + 0.001), -M0 / 2, 0.05);
  expectNear('M(L⁻) ≈ 0', findMomentAt(r.moment, L - 0.001), 0, 0.5);
}

block('BLOCK 6 — Cantilever, tip point load');
{
  // Fixed at x=0, free at x=L. P=50 down at tip.
  // R_v = +P, R_m at wall = -PL (sagging-negative = hogging at wall)
  // M(x) = P·(x - L)  → M(0) = -PL, M(L) = 0
  // δ_tip = PL³/(3EI), θ_tip = PL²/(2EI) (downward, CW)
  const L = 6, P = 50;
  const m: BeamModel = {
    totalLength: L,
    segments: [seg(0, L)],
    supports: [support('A', 0, 'fixed')],
    hinges: [],
    loads: [pointLoad('P1', L, P)],
  };
  const r = solve(m);
  expect('R_v at wall', r.reactions[0].V, P, 0.005);
  expect('R_m at wall (sagging+)', r.reactions[0].M, -P * L, 0.005);
  expect('M at wall (x=0)', findMomentAt(r.moment, 0), -P * L, 0.005);
  expectNear('M at tip (x=L) ≈ 0', findMomentAt(r.moment, L), 0, 0.5);
  const deltaTip = P * Math.pow(L, 3) / (3 * EI_TEST) * 1000;
  expect('δ_tip (mm)', Math.abs(findDefAt(r.deflection, L)), deltaTip, 0.01);
}

block('BLOCK 7 — Cantilever, full UDL');
{
  // Fixed at x=0, w=10 down. R_v = wL, R_m = -wL²/2. M(x) = -w(L-x)²/2.
  // δ_tip = wL⁴/(8EI)
  const L = 6, w = 10;
  const m: BeamModel = {
    totalLength: L,
    segments: [seg(0, L)],
    supports: [support('A', 0, 'fixed')],
    hinges: [],
    loads: [udl('w1', 0, L, w)],
  };
  const r = solve(m);
  expect('R_v at wall', r.reactions[0].V, w * L, 0.005);
  expect('R_m at wall', r.reactions[0].M, -w * L * L / 2, 0.005);
  expect('M at wall', findMomentAt(r.moment, 0), -w * L * L / 2, 0.005);
  const deltaTip = w * Math.pow(L, 4) / (8 * EI_TEST) * 1000;
  expect('δ_tip (mm)', Math.abs(findDefAt(r.deflection, L)), deltaTip, 0.01);
}

block('BLOCK 8 — Cantilever, tip moment');
{
  // Fixed at x=0, applied CCW moment M0=100 at tip.
  // R_v = 0, R_m at wall = ?
  //   ΣM_wall = 0: -R_m_wall + M0 (CCW couple at tip is just a couple, position doesn't matter for ΣM about wall)
  //   Actually applied CCW M0 at tip → contributes +M0 to ΣM_about_wall.
  //   Wall provides M_wall_ccw to balance: -M_wall_ccw + M0 = 0 → M_wall_ccw = M0
  //   In sagging-positive: r.M = -Mccw_support = -M0 (HOGGING for CCW tip moment)
  //   Actually wait: tip moment CCW pulls tip up — this creates HOGGING at the wall.
  //   M(0) = -M0 (hogging), M(L) = -M0 + M0 = 0  →  uniform M = -M0 throughout? NO.
  //   Let me redo. M(x) = (R_v)(x) + R_m_ccw_couple_contribution + applied_couples_to_left
  //   R_v = 0, applied M_ccw at wall (x=0) contributes +M_ccw to M.
  //   So M(x) = M_ccw (constant). But M_ccw_support = M0 and applied tip moment is at L > x, so it's NOT to left for x < L.
  //   At x: M = M_ccw_support_at_x=0 = +M0 (using "couple CCW to left contributes +K")
  //   But this contradicts my expectation.
  //   Let me use a clear analytical check: cantilever fixed-left, tip CCW moment M0.
  //   The beam should be in pure bending with constant moment M0 (CCW) throughout.
  //   "Pure bending with CCW M at right end" → bottom fiber in tension if CCW spins beam to bow down → SAGGING. M_internal = +M0 (sagging+).
  //   So M(x) = +M0 throughout. Tip deflection upward (since CCW moment tips the beam up).
  //   δ_tip = M0·L²/(2EI) UP.  θ_tip = M0·L/(EI) CCW.
  //   So: R_m_wall sagging+ = +M0 (sagging) — wall reaction provides a CW couple on beam to balance.
  //   With my code: Mccw_support = -M0 (CW couple), Rm = -Mccw = +M0 ✓
  const L = 6, M0 = 100;
  const m: BeamModel = {
    totalLength: L,
    segments: [seg(0, L)],
    supports: [support('A', 0, 'fixed')],
    hinges: [],
    loads: [pointMoment('m1', L, M0, 'ccw')],
  };
  const r = solve(m);
  expectNear('R_v at wall ≈ 0', r.reactions[0].V, 0, 0.01);
  expect('R_m at wall (sagging+)', r.reactions[0].M, M0, 0.005);
  expect('M(0) sagging+', findMomentAt(r.moment, 0), M0, 0.01);
  expect('M(L/2) sagging+', findMomentAt(r.moment, L / 2), M0, 0.05);
  const dTip = M0 * L * L / (2 * EI_TEST) * 1000;  // UP, positive
  expect('δ_tip (mm) up', findDefAt(r.deflection, L), dTip, 0.01);
}

// ============================================================
// BLOCK 9-15: Indeterminate beams
// ============================================================
block('BLOCK 9 — Propped cantilever, full UDL');
{
  // Fixed-left, pin-right. UDL w. Classical:
  // R_pin_right = 3wL/8.  R_wall_v = 5wL/8.  M_wall = -wL²/8 (hogging).
  // Max sagging M = +9wL²/128 at x = 5L/8 from left.
  // δ_max ≈ wL⁴/(185·EI) at x ≈ 0.4215L
  const L = 6, w = 10;
  const m: BeamModel = {
    totalLength: L,
    segments: [seg(0, L)],
    supports: [support('A', 0, 'fixed'), support('B', L, 'roller')],
    hinges: [],
    loads: [udl('w1', 0, L, w)],
  };
  const r = solve(m);
  expect('R_wall_v', r.reactions[0].V, 5 * w * L / 8, 0.01);
  expect('R_pin_v',  r.reactions[1].V, 3 * w * L / 8, 0.01);
  expect('M_wall', r.reactions[0].M, -w * L * L / 8, 0.01);
  expect('Max sagging M', r.maxMoment.value, 9 * w * L * L / 128, 0.02);
  expect('Min (hogging) M', r.minMoment.value, -w * L * L / 8, 0.01);
}

block('BLOCK 10 — Propped cantilever, point load at midspan');
{
  // R_pin = 5P/16, R_wall_v = 11P/16, M_wall = -3PL/16
  const L = 6, P = 50;
  const m: BeamModel = {
    totalLength: L,
    segments: [seg(0, L)],
    supports: [support('A', 0, 'fixed'), support('B', L, 'roller')],
    hinges: [],
    loads: [pointLoad('P1', L / 2, P)],
  };
  const r = solve(m);
  expect('R_wall_v', r.reactions[0].V, 11 * P / 16, 0.01);
  expect('R_pin_v',  r.reactions[1].V, 5 * P / 16, 0.01);
  expect('M_wall', r.reactions[0].M, -3 * P * L / 16, 0.01);
  // Max sagging M at midspan = 5PL/32
  expect('M_midspan sagging', findMomentAt(r.moment, L / 2), 5 * P * L / 32, 0.02);
}

block('BLOCK 11 — Fixed-fixed, point load at midspan');
{
  // M_wall = -PL/8, M_mid = +PL/8, δ_mid = PL³/(192EI)
  const L = 6, P = 50;
  const m: BeamModel = {
    totalLength: L,
    segments: [seg(0, L)],
    supports: [support('A', 0, 'fixed'), support('B', L, 'fixed')],
    hinges: [],
    loads: [pointLoad('P1', L / 2, P)],
  };
  const r = solve(m);
  expect('R_A_v', r.reactions[0].V, P / 2, 0.005);
  expect('R_B_v', r.reactions[1].V, P / 2, 0.005);
  expect('M_A wall', r.reactions[0].M, -P * L / 8, 0.005);
  expect('M_B wall', r.reactions[1].M, -P * L / 8, 0.005);
  expect('M_mid sagging', findMomentAt(r.moment, L / 2), P * L / 8, 0.01);
  const dMid = P * Math.pow(L, 3) / (192 * EI_TEST) * 1000;
  expect('δ_mid (mm)', Math.abs(findDefAt(r.deflection, L / 2)), dMid, 0.01);
}

block('BLOCK 12 — Fixed-fixed, full UDL');
{
  // M_wall = -wL²/12, M_mid = +wL²/24, δ_mid = wL⁴/(384EI)
  const L = 6, w = 10;
  const m: BeamModel = {
    totalLength: L,
    segments: [seg(0, L)],
    supports: [support('A', 0, 'fixed'), support('B', L, 'fixed')],
    hinges: [],
    loads: [udl('w1', 0, L, w)],
  };
  const r = solve(m);
  expect('R_A_v', r.reactions[0].V, w * L / 2, 0.005);
  expect('R_B_v', r.reactions[1].V, w * L / 2, 0.005);
  expect('M_A wall', r.reactions[0].M, -w * L * L / 12, 0.005);
  expect('M_B wall', r.reactions[1].M, -w * L * L / 12, 0.005);
  expect('M_mid sagging', findMomentAt(r.moment, L / 2), w * L * L / 24, 0.01);
  const dMid = w * Math.pow(L, 4) / (384 * EI_TEST) * 1000;
  expect('δ_mid (mm)', Math.abs(findDefAt(r.deflection, L / 2)), dMid, 0.01);
}

block('BLOCK 13 — Two-equal-span continuous beam, UDL');
{
  // Two equal spans of L each, continuous over central pin. UDL w on both spans.
  // R_end = 3wL/8 each, R_middle = 10wL/8 = 5wL/4
  // M_middle = -wL²/8 (hogging),  M_max_sag = +9wL²/128 at x = 5L/8 from each end
  const L = 6, w = 10;          // each span length
  const m: BeamModel = {
    totalLength: 2 * L,
    segments: [seg(0, 2 * L)],
    supports: [
      support('A', 0, 'pin'),
      support('B', L, 'roller'),
      support('C', 2 * L, 'roller'),
    ],
    hinges: [],
    loads: [udl('w1', 0, 2 * L, w)],
  };
  const r = solve(m);
  expect('R_A end', r.reactions[0].V, 3 * w * L / 8, 0.01);
  expect('R_B middle', r.reactions[1].V, 10 * w * L / 8, 0.01);
  expect('R_C end', r.reactions[2].V, 3 * w * L / 8, 0.01);
  expect('M middle (hogging)', findMomentAt(r.moment, L), -w * L * L / 8, 0.01);
  expect('M max sagging (any span)', r.maxMoment.value, 9 * w * L * L / 128, 0.02);
}

block('BLOCK 14 — Three-equal-span continuous beam, full UDL');
{
  // Three equal spans of L, UDL w throughout.
  // R_outer = 0.4 wL,  R_inner = 1.1 wL  (sums to 3wL ✓)
  // M_inner_support = -wL²/10
  // M_middle_span max sag = +wL²/40,  M_outer_span max sag = +0.08 wL² @ x = 0.4L
  const L = 6, w = 10;
  const m: BeamModel = {
    totalLength: 3 * L,
    segments: [seg(0, 3 * L)],
    supports: [
      support('A', 0, 'pin'),
      support('B', L, 'roller'),
      support('C', 2 * L, 'roller'),
      support('D', 3 * L, 'roller'),
    ],
    hinges: [],
    loads: [udl('w1', 0, 3 * L, w)],
  };
  const r = solve(m);
  expect('R_A outer', r.reactions[0].V, 0.4 * w * L, 0.01);
  expect('R_B inner', r.reactions[1].V, 1.1 * w * L, 0.01);
  expect('R_C inner', r.reactions[2].V, 1.1 * w * L, 0.01);
  expect('R_D outer', r.reactions[3].V, 0.4 * w * L, 0.01);
  expect('M at B (hogging)', findMomentAt(r.moment, L), -w * L * L / 10, 0.01);
  expect('M middle span sag', findMomentAt(r.moment, 1.5 * L), w * L * L / 40, 0.05);
}

block('BLOCK 15 — Overhang: simple beam with cantilever extension on right');
{
  // Span 0..L1=4 (pin-pin), then cantilever 4..6 with point load P=20 at tip.
  // R_left = -P·a/L1 = -20·2/4 = -10 (down)
  // R_right_pin = P·(L1+a)/L1 = 20·6/4 = 30
  // M_at_right_pin = -P·a = -40 (hogging)
  // M(x) in span: linearly from 0 at x=0 to -40 at x=L1, then linearly to 0 at tip x=L1+a
  const L1 = 4, a = 2, P = 20, L = L1 + a;
  const m: BeamModel = {
    totalLength: L,
    segments: [seg(0, L)],
    supports: [support('A', 0, 'pin'), support('B', L1, 'roller')],
    hinges: [],
    loads: [pointLoad('P1', L, P)],
  };
  const r = solve(m);
  expect('R_A', r.reactions[0].V, -P * a / L1, 0.01);
  expect('R_B', r.reactions[1].V, P * (L1 + a) / L1, 0.01);
  expect('M at B (hogging)', findMomentAt(r.moment, L1), -P * a, 0.01);
  expectNear('M at tip (cantilever) ≈ 0', findMomentAt(r.moment, L), 0, 0.5);
}

// ============================================================
// BLOCK 16-18: Spring supports
// ============================================================
block('BLOCK 16 — SS-like beam where right support is a vertical spring');
{
  // Left pin, right vertical spring of stiffness k. UDL w.
  // As k → ∞, behaves as SS (R_left = wL/2, R_right_spring = wL/2).
  // For finite k, the spring deflects δ = R_spring/k. Use Castigliano:
  //   The pin-pin SS solution requires R = wL/2 at the right with no deflection at the right.
  //   With a spring, we have δ_right = R_spring/k. The structure becomes pin + spring.
  //   By treating the spring as a flexibility addition: R_spring = wL/2 / (1 + k_beam/k_spring)
  //   where k_beam at right = 3EI/L³ (effective vertical stiffness at right end with left pinned)
  //
  // Simpler: pick k VERY large (1e10 kN/m) → near-rigid, expect SS behavior.
  const L = 6, w = 10;
  const k_large = 1e10;
  const m: BeamModel = {
    totalLength: L,
    segments: [seg(0, L)],
    supports: [
      support('A', 0, 'pin'),
      support('B', L, 'spring', { kv: k_large }),
    ],
    hinges: [],
    loads: [udl('w1', 0, L, w)],
  };
  const r = solve(m);
  expect('R_A (rigid spring)', r.reactions[0].V, w * L / 2, 0.005);
  expect('R_B spring (rigid)', r.reactions[1].V, w * L / 2, 0.005);
}

block('BLOCK 17 — Cantilever with rotational spring at wall (k_r → 0 = pin)');
{
  // Cantilever-like: spring support at left with kv → ∞ but kr = 0 (pin behavior).
  // Should give R_left_v = P, R_right needs another support → make it SS instead.
  // Better test: SS beam with rotational spring at right support of stiffness k_r.
  //   k_r = 0 → standard SS. k_r → ∞ → propped cantilever (fixed-right, pin-left).
  // Use UDL w, L=6. Test k_r huge → propped cantilever with FIXED at right, pin at left:
  //   R_pin_left = 3wL/8, R_wall_right_v = 5wL/8, M_wall_right = -wL²/8
  const L = 6, w = 10;
  const k_r_large = 1e10;
  const m: BeamModel = {
    totalLength: L,
    segments: [seg(0, L)],
    supports: [
      support('A', 0, 'pin'),
      support('B', L, 'spring', { kv: 1e12, kr: k_r_large }),
    ],
    hinges: [],
    loads: [udl('w1', 0, L, w)],
  };
  const r = solve(m);
  expect('R_pin_left', r.reactions[0].V, 3 * w * L / 8, 0.01);
  expect('R_wall_v',   r.reactions[1].V, 5 * w * L / 8, 0.01);
  expect('M_wall',     r.reactions[1].M, -w * L * L / 8, 0.02);
}

block('BLOCK 18 — Beam on elastic foundation-like: two soft springs');
{
  // L=4, two equal springs at ends with k_v = 1000 kN/m each, point load P=20 at midspan.
  // No moment-resisting support → rigid-body translation possible? No — symmetry, both springs
  // share P/2 = 10. Each compresses δ = 10/1000 = 0.01 m = 10 mm. Beam itself bends from the
  // loading: midspan deflection = (PL³/48EI) PLUS the spring compression = 11.25 + 10 = 21.25 mm
  // But with both ends softly supported, the rigid-body translation IS the spring compression.
  const L = 4, P = 20, k = 1000;
  const m: BeamModel = {
    totalLength: L,
    segments: [seg(0, L)],
    supports: [
      support('A', 0, 'spring', { kv: k }),
      support('B', L, 'spring', { kv: k }),
    ],
    hinges: [],
    loads: [pointLoad('P1', L / 2, P)],
  };
  const r = solve(m);
  expect('R_A spring', r.reactions[0].V, P / 2, 0.01);
  expect('R_B spring', r.reactions[1].V, P / 2, 0.01);
  const expectedSpringDef = P / 2 / k * 1000;          // 10 mm at the supports
  const expectedBeamMid = P * Math.pow(L, 3) / (48 * EI_TEST) * 1000;  // bend contribution
  const expectedTotalMid = expectedSpringDef + expectedBeamMid;
  expect('δ at A (mm)', Math.abs(findDefAt(r.deflection, 0)), expectedSpringDef, 0.01);
  expect('δ at midspan (mm)', Math.abs(findDefAt(r.deflection, L / 2)), expectedTotalMid, 0.02);
}

// ============================================================
// BLOCK 19-20: Internal hinges
// ============================================================
block('BLOCK 19 — SS beam with internal hinge at midspan, full UDL');
{
  // L=6, pin-pin, hinge at midspan, UDL w.
  // Internal hinge → moment = 0 at midspan. The two halves act as two SS beams with the hinge
  // acting like a pin connection. Each half (length L/2) carries half the load with two end supports.
  //   But the hinge has no support — it can deflect freely. The whole structure is unstable!
  // To stabilize, add a roller at the hinge. Let's instead test:
  //   Three supports + 1 internal hinge → still 1° indeterminate.
  // Better: cantilever with hinge — fixed at left, roller at right, hinge at L/4.
  //   With UDL w over full length, the moment at L/4 must be 0.
  //   We can verify: M(L/4) = 0 from the solver's diagram.
  const L = 6, w = 10;
  const m: BeamModel = {
    totalLength: L,
    segments: [seg(0, L)],
    supports: [support('A', 0, 'fixed'), support('B', L, 'roller')],
    hinges: [{ id: 'h1', position: L / 4 }],
    loads: [udl('w1', 0, L, w)],
  };
  const r = solve(m);
  expectNear('M at hinge ≈ 0', findMomentAt(r.moment, L / 4), 0, 0.5);  // ≤0.5 kN·m absolute
}

block('BLOCK 20 — Three-span Gerber beam with hinges (textbook problem)');
{
  // Equal spans L each, UDL w throughout, hinges at L/2 of outer spans.
  // Central span behaves as SS beam supported by the hinges.
  // Reactions and moments from textbook (Hibbeler ex):
  //   With L=6, w=10:
  //     Each end span: cantilever-like supported at the start.
  //     Approximate behavior: each hinge segment of outer span = SS-like piece.
  // For simplicity, test a known case: one cantilever + one suspended span (L1=L2=L).
  //   Cantilever fixed-left of length L. At its tip, an internal hinge connects to a beam of
  //   length L resting on the hinge (left end) and a roller (right end). UDL w over both.
  //   Total length 2L.
  //   Expected: cantilever supports the hinge → suspended SS-beam reactions:
  //     R_at_hinge = wL/2,  R_at_far_roller = wL/2.
  //   The cantilever sees: own UDL w on length L plus hinge reaction wL/2 (down) at its tip.
  //     R_v_wall = wL + wL/2 = 1.5wL
  //     R_m_wall = -(w·L²/2 + wL/2·L) = -(wL²/2 + wL²/2) = -wL²
  const L = 6, w = 10;
  const m: BeamModel = {
    totalLength: 2 * L,
    segments: [seg(0, 2 * L)],
    supports: [
      support('A', 0, 'fixed'),
      support('B', 2 * L, 'roller'),
    ],
    hinges: [{ id: 'h1', position: L }],
    loads: [udl('w1', 0, 2 * L, w)],
  };
  const r = solve(m);
  expect('R_wall_v', r.reactions[0].V, 1.5 * w * L, 0.01);
  expect('R_wall_m', r.reactions[0].M, -w * L * L, 0.01);
  expect('R_far_roller', r.reactions[1].V, 0.5 * w * L, 0.01);
  expectNear('M at hinge (=0)', findMomentAt(r.moment, L), 0, 1.0);  // absolute kN·m
}

// ============================================================
// BLOCK 21-22: Settlements
// ============================================================
block('BLOCK 21 — SS beam, right support settlement → no internal forces');
{
  // SS beam, no external load, right pin settles by Δ=20 mm. Statically determinate → no internal forces.
  const L = 6;
  const m: BeamModel = {
    totalLength: L,
    segments: [seg(0, L)],
    supports: [support('A', 0, 'pin'), support('B', L, 'roller', { settlement: 20 })],
    hinges: [],
    loads: [],
  };
  const r = solve(m);
  expectNear('R_A (no force)', r.reactions[0].V, 0, 0.01);
  expectNear('R_B (no force)', r.reactions[1].V, 0, 0.01);
  expectNear('M_max abs', Math.abs(r.maxMoment.value), 0, 0.05);
  expect('δ at right end', findDefAt(r.deflection, L), -20, 0.005); // -20 mm (down)
}

block('BLOCK 22 — Two-span continuous beam, central support settlement δ');
{
  // Pin-pin-pin three-support beam, no external load, central support sinks by δ down.
  // Closed-form (cubic shape on each half-span; v(0)=v(2L)=0, v(L)=-δ, v″=0 at end pins,
  // v'(L)=0 by symmetry):
  //   v(x) = (δ/(2L³))·x³ - (3δ/(2L))·x   on [0, L]  (mirrored on [L, 2L])
  //   v″(x) = (3δ/L³)·x   →   M(L⁻) = +EI·v″(L) = +3EI·δ/L²  (SAGGING+, dips down at center)
  //   R_A = M(L)/L = +3EI·δ/L³ (UP),  R_C = R_A (UP),  R_B = -2·R_A (DOWN, support pulls beam down).
  const L = 6;
  const delta = 10;             // mm settlement at central support
  const EI = EI_TEST;
  const dM = delta / 1000;      // m
  const m: BeamModel = {
    totalLength: 2 * L,
    segments: [seg(0, 2 * L)],
    supports: [
      support('A', 0, 'pin'),
      support('B', L, 'roller', { settlement: delta }),
      support('C', 2 * L, 'roller'),
    ],
    hinges: [],
    loads: [],
  };
  const r = solve(m);
  const M_B_expected = +3 * EI * dM / (L * L);          // kN·m (sagging+)
  const R_A_expected = +3 * EI * dM / Math.pow(L, 3);   // kN (up)
  const R_B_expected = -2 * R_A_expected;               // kN (down)
  expect('R_A (up)',   r.reactions[0].V, R_A_expected, 0.02);
  expect('R_B (down)', r.reactions[1].V, R_B_expected, 0.02);
  expect('R_C (up)',   r.reactions[2].V, R_A_expected, 0.02);
  expect('M at B (sagging+)', findMomentAt(r.moment, L), M_B_expected, 0.02);
}

// ============================================================
// BLOCK 23-24: Thermal gradient
// ============================================================
block('BLOCK 23 — SS beam, thermal gradient → no internal forces');
{
  // SS beam (statically determinate) with thermal gradient. Free to bow → no reactions, no M.
  const L = 6;
  const segs: Segment[] = [seg(0, L, { h: 300, alpha: 1.2e-5 })];
  const m: BeamModel = {
    totalLength: L,
    segments: segs,
    supports: [support('A', 0, 'pin'), support('B', L, 'roller')],
    hinges: [],
    loads: [{ id: 't1', type: 'thermal', segmentId: segs[0].id, deltaTGradient: 30 }],
  };
  const r = solve(m);
  expectNear('R_A (no force)', r.reactions[0].V, 0, 0.01);
  expectNear('R_B (no force)', r.reactions[1].V, 0, 0.01);
  expectNear('M_max abs', Math.abs(r.maxMoment.value), 0, 0.05);
}

block('BLOCK 24 — Fixed-fixed beam, thermal gradient → uniform sagging M');
{
  // Fixed-fixed, ΔT_grad = T_top - T_bot = +30°C, h = 300 mm, α = 1.2e-5.
  // Internal moment expected to be UNIFORM = +EI·α·ΔT/h (sagging).
  //   EI = 20000 kN·m², α = 1.2e-5 1/°C, ΔT = 30, h = 0.3 m
  //   M_T = 20000 · 1.2e-5 · 30 / 0.3 = 24 kN·m (SAGGING throughout)
  const L = 6;
  const segs: Segment[] = [seg(0, L, { h: 300, alpha: 1.2e-5 })];
  const M_T = EI_TEST * 1.2e-5 * 30 / (300 / 1000);
  const m: BeamModel = {
    totalLength: L,
    segments: segs,
    supports: [support('A', 0, 'fixed'), support('B', L, 'fixed')],
    hinges: [],
    loads: [{ id: 't1', type: 'thermal', segmentId: segs[0].id, deltaTGradient: 30 }],
  };
  const r = solve(m);
  expectNear('R_A_v (no shear)', r.reactions[0].V, 0, 0.01);
  expectNear('R_B_v (no shear)', r.reactions[1].V, 0, 0.01);
  expect('M_A (sagging)', r.reactions[0].M, M_T, 0.01);
  expect('M_B (sagging)', r.reactions[1].M, M_T, 0.01);
  expect('M at midspan (sagging)', findMomentAt(r.moment, L / 2), M_T, 0.01);
}

// ============================================================
// BLOCK 25-26: Variable EI / multi-segment
// ============================================================
block('BLOCK 25 — Two-segment beam, EI doubles in right half, fixed-left cantilever with tip load');
{
  // Cantilever L=6, EI = EI₀ on [0, L/2], EI = 2·EI₀ on [L/2, L]. Tip load P down.
  // δ_tip = P/(3·EI)·L³ if uniform. With piecewise:
  //   Computed from Castigliano or moment-area:
  //   M(x) = -P(L-x). v″(x) = -M/EI(x) — wait: v″ = M/EI in our convention if v+ up, M sagging+.
  //   Actually for downward load on cantilever, M is negative (hogging). v″ = M/EI < 0 (concave down).
  //   v_tip = ∫∫ M/EI dx dx integrated twice from x=0.
  //   For piecewise EI, integrate symbolically:
  //     v_tip = (1/EI₀)·∫∫_{0}^{L/2} M dx² + (1/(2EI₀))·∫∫_{L/2}^{L} M dx²
  //   where M(x) = -P(L-x).
  //   This is tedious; let me just compute numerically and use as expected.
  //
  //   Easier check: reactions are independent of EI for determinate structure.
  const L = 6, P = 50;
  const EI0 = EI_TEST;
  const m: BeamModel = {
    totalLength: L,
    segments: [
      seg(0, L / 2),
      seg(L / 2, L, { I: 2 * I_TEST }),
    ],
    supports: [support('A', 0, 'fixed')],
    hinges: [],
    loads: [pointLoad('P1', L, P)],
  };
  const r = solve(m);
  expect('R_v', r.reactions[0].V, P, 0.005);
  expect('R_m', r.reactions[0].M, -P * L, 0.005);
  // Tip deflection by closed-form integration:
  //   M(x) = -P(L-x), v″ = M/EI(x).
  //   For x ∈ [0, L/2]: v″ = -P(L-x)/EI₀
  //   For x ∈ [L/2, L]: v″ = -P(L-x)/(2EI₀)
  //   v(x) = ∫₀ˣ ∫₀ˣ' v″(s) ds dx'  (with v(0) = 0, v'(0) = 0)
  //   Compute v_tip analytically:
  //     I₁ = ∫₀^{L/2} -P(L-x)/EI₀ dx = -P/EI₀ · [Lx - x²/2]₀^{L/2} = -P/EI₀ · (L²/2 - L²/8) = -3PL²/(8EI₀)
  //     v'(L/2) = I₁
  //     I_total_θ from [0, L/2] additional contribution: ∫₀^{L/2} v″ dx (already done). v'(x) for x ∈ [0, L/2]:
  //       v'(x) = -P/EI₀ · (Lx - x²/2)
  //       v'(L/2) = -3PL²/(8EI₀)  ✓ matches
  //     v(L/2) = ∫₀^{L/2} v'(x) dx = -P/EI₀ · [Lx²/2 - x³/6]₀^{L/2}
  //                                = -P/EI₀ · (L³/8 - L³/48) = -P/EI₀ · (6L³/48 - L³/48) = -5PL³/(48EI₀)
  //   For x ∈ [L/2, L]:
  //     v'(x) = v'(L/2) + ∫_{L/2}^{x} -P(L-s)/(2EI₀) ds
  //           = -3PL²/(8EI₀) - P/(2EI₀) · [Ls - s²/2]_{L/2}^{x}
  //           = -3PL²/(8EI₀) - P/(2EI₀) · (Lx - x²/2 - L²/2 + L²/8)
  //           = -3PL²/(8EI₀) - P/(2EI₀) · (Lx - x²/2 - 3L²/8)
  //     v'(L) = -3PL²/(8EI₀) - P/(2EI₀) · (L² - L²/2 - 3L²/8)
  //           = -3PL²/(8EI₀) - P/(2EI₀) · (L²/8)
  //           = -3PL²/(8EI₀) - PL²/(16EI₀)
  //           = -7PL²/(16EI₀)
  //     v(x) = v(L/2) + ∫_{L/2}^{x} v'(s) ds
  //   Let me just compute v(L) numerically:
  //     v(L/2) = -5PL³/(48EI₀)
  //     ∫_{L/2}^{L} v'(s) ds  with v'(s) = -3PL²/(8EI₀) - (P/(2EI₀))(Ls - s²/2 - 3L²/8)
  //                            = -3PL²/(8EI₀)·(L/2) - (P/(2EI₀))·∫_{L/2}^{L}(Ls - s²/2 - 3L²/8)ds
  //         ∫(Ls - s²/2 - 3L²/8)ds = Ls²/2 - s³/6 - 3L²s/8
  //         eval [L/2, L]:
  //           at L:   L³/2 - L³/6 - 3L³/8 = (12L³ - 4L³ - 9L³)/24 = -L³/24
  //           at L/2: L·L²/8 - (L/2)³/6 - 3L²·L/16 = L³/8 - L³/48 - 3L³/16
  //                 = (6L³ - L³ - 9L³)/48 = -4L³/48 = -L³/12
  //           difference = -L³/24 - (-L³/12) = -L³/24 + 2L³/24 = L³/24
  //     contribution = -3PL³/(16EI₀) - (P/(2EI₀))·(L³/24) = -3PL³/(16EI₀) - PL³/(48EI₀)
  //                  = -9PL³/(48EI₀) - PL³/(48EI₀) = -10PL³/(48EI₀) = -5PL³/(24EI₀)
  //     v(L) = v(L/2) + ∫_{L/2}^{L} v'(s) ds = -5PL³/(48EI₀) - 5PL³/(24EI₀)
  //          = -5PL³/(48EI₀) - 10PL³/(48EI₀) = -15PL³/(48EI₀) = -5PL³/(16EI₀)
  //   So |δ_tip| = 5PL³/(16EI₀) (mm if P in kN, L in m, EI in kN·m², ×1000 for mm)
  const dTip = 5 * P * Math.pow(L, 3) / (16 * EI0) * 1000;
  expect('δ_tip (mm)', Math.abs(findDefAt(r.deflection, L)), dTip, 0.01);
}

block('BLOCK 26 — Three-segment beam, central segment 4× stiffer (haunched), SS UDL');
{
  // L=6, segments [0,2] (EI₀), [2,4] (4·EI₀), [4,6] (EI₀). UDL w=10. Pin-roller.
  // Reactions = wL/2 each (independent of EI).
  // M_max sagging at midspan = wL²/8 = 45 (also independent of EI).
  // Deflection is reduced compared to uniform EI.
  const L = 6, w = 10;
  const m: BeamModel = {
    totalLength: L,
    segments: [
      seg(0, 2),
      seg(2, 4, { I: 4 * I_TEST }),
      seg(4, L),
    ],
    supports: [support('A', 0, 'pin'), support('B', L, 'roller')],
    hinges: [],
    loads: [udl('w1', 0, L, w)],
  };
  const r = solve(m);
  expect('R_A', r.reactions[0].V, w * L / 2, 0.005);
  expect('R_B', r.reactions[1].V, w * L / 2, 0.005);
  expect('M_mid', r.maxMoment.value, w * L * L / 8, 0.005);
  // Deflection should be LESS than uniform-EI case (5wL⁴/(384EI₀)·1000 mm)
  const dUniform = 5 * w * Math.pow(L, 4) / (384 * EI_TEST) * 1000;
  const dMidActual = Math.abs(findDefAt(r.deflection, L / 2));
  if (dMidActual < dUniform * 0.9) {
    PASS++;
    console.log(`  PASS Haunched midspan deflection ${fmt(dMidActual)} mm < 90% of uniform ${fmt(dUniform)} mm`);
  } else {
    FAIL++;
    const msg = `  FAIL Haunched midspan deflection ${fmt(dMidActual)} mm not < 90% of uniform ${fmt(dUniform)} mm`;
    console.log(msg);
    failMsgs.push(msg);
  }
}

// ============================================================
// BLOCK 27: Self-weight
// ============================================================
block('BLOCK 27 — Cantilever with self-weight only');
{
  // Cantilever L=6, A=5000 mm², ρ=7850 kg/m³ → w_sw = 7850·5e-3·9.81 = 385.0 N/m = 0.385 kN/m
  // M_wall = -w·L²/2,  R_v = w·L
  const L = 6;
  const w_sw = 7850 * (A_TEST * 1e-6) * 9.81 / 1000;     // kN/m
  const m: BeamModel = {
    totalLength: L,
    segments: [seg(0, L, { selfWeight: true, density: 7850 })],
    supports: [support('A', 0, 'fixed')],
    hinges: [],
    loads: [],
  };
  const r = solve(m);
  expect('R_v', r.reactions[0].V, w_sw * L, 0.01);
  expect('R_m', r.reactions[0].M, -w_sw * L * L / 2, 0.01);
}

// ============================================================
// BLOCK 28-29: Equilibrium consistency checks
// ============================================================
block('BLOCK 28 — Equilibrium check on multi-load propped cantilever');
{
  // Propped cantilever L=8, point load P=30 at x=2, UDL w=5 from x=4 to x=8, applied moment M0=20 CCW at x=6
  // ΣF_y = R_wall_v + R_pin_v - P - w·(8-4) = R_wall + R_pin - 30 - 20 = 0  →  R_wall + R_pin = 50
  // ΣM_about_wall: -R_pin·8 + P·2 + w·(8-4)·6 + M_wall + M0_CCW = 0
  //   M0_CCW (applied) about wall: just the couple itself = +M0
  //   wait sign: M about wall = sum of all couples + sum of (force_y · x_force) where +y up gives +CCW
  //   M about wall: -R_pin·8 (R_pin up at x=8 → +R_pin·8 CCW, so subtract for ΣM = 0 means +R_pin·8 = ...)
  //   Easier: just check that solver gives a valid result by checking ΣF and ΣM after solve.
  const L = 8;
  const m: BeamModel = {
    totalLength: L,
    segments: [seg(0, L)],
    supports: [support('A', 0, 'fixed'), support('B', L, 'roller')],
    hinges: [],
    loads: [
      pointLoad('P1', 2, 30),
      udl('w1', 4, 8, 5),
      pointMoment('m1', 6, 20, 'ccw'),
    ],
  };
  const r = solve(m);
  // Total external load = 30 + 5·4 = 50 kN down. Sum of vertical reactions must = +50.
  const sumV = r.reactions[0].V + r.reactions[1].V;
  expect('ΣF_y reactions', sumV, 50, 0.005);
  // Sum of moments about x=0 (CCW positive) = sum of force × x + sum of couples + R_m_wall_couple
  //   R_pin·8 (CCW from up force) + M_wall_couple (CCW = -r.M for wall) + M0_applied (CCW)
  //   - P·2 (CW from down force) - (w·4)·6 (centroid of UDL at x=6, down force, CW)
  // Using sagging-positive r.M for wall: support's CCW couple = -r.M
  const sumM_ccw =
    r.reactions[1].V * L                  // R_pin up at x=L
    + (-r.reactions[0].M)                 // wall's CCW couple
    + 20                                  // applied CCW moment
    - 30 * 2                              // point load 30 kN down at x=2
    - 5 * 4 * 6;                          // UDL centroid at x=6, total 20 kN down
  expectNear('ΣM_about_wall (CCW) ≈ 0', sumM_ccw, 0, 0.5);
}

block('BLOCK 29 — Symmetry check: SS with symmetric loading → symmetric results');
{
  // SS beam L=10, point loads P=20 at x=2 and x=8 (symmetric).
  // R_A = R_B = 20 each. Diagrams should be symmetric.
  const L = 10, P = 20;
  const m: BeamModel = {
    totalLength: L,
    segments: [seg(0, L)],
    supports: [support('A', 0, 'pin'), support('B', L, 'roller')],
    hinges: [],
    loads: [pointLoad('P1', 2, P), pointLoad('P2', 8, P)],
  };
  const r = solve(m);
  expect('R_A', r.reactions[0].V, P, 0.005);
  expect('R_B', r.reactions[1].V, P, 0.005);
  expect('M(2) = M(8)', findMomentAt(r.moment, 2), findMomentAt(r.moment, 8), 0.005);
  expect('δ(2) = δ(8)', findDefAt(r.deflection, 2), findDefAt(r.deflection, 8), 0.005);
  expect('δ(0) = δ(L)', findDefAt(r.deflection, 0), findDefAt(r.deflection, L), 0.005);
}

// ============================================================
// BLOCK 30: Modal analysis
// ============================================================
block('BLOCK 30 — SS beam first natural frequency');
{
  // SS beam L=6, A=5000 mm², ρ=7850, EI = 20000 kN·m² = 2e7 N·m²
  // ρA = 7850 · 5e-3 = 39.25 kg/m
  // ω₁ = (π/L)² · √(EI / ρA) = (π/6)² · √(2e7/39.25) = 0.2742 · 713.84 = 195.7 rad/s
  // f₁ = ω₁/(2π) = 31.15 Hz
  const L = 6;
  const m: BeamModel = {
    totalLength: L,
    segments: [seg(0, L, { selfWeight: false, density: 7850 })],
    supports: [support('A', 0, 'pin'), support('B', L, 'roller')],
    hinges: [],
    loads: [],
  };
  const r = solve(m, { computeModes: 2 });
  if (!r.modes || r.modes.length < 1) {
    FAIL++;
    failMsgs.push('  FAIL: modal computation did not return modes');
    console.log('  FAIL: modal computation did not return modes');
  } else {
    const rhoA = 7850 * (A_TEST * 1e-6);
    const omega1 = Math.pow(Math.PI / L, 2) * Math.sqrt(2e7 / rhoA);
    const f1 = omega1 / (2 * Math.PI);
    expect('f₁ (Hz) — first bending mode', r.modes[0].frequencyHz, f1, 0.05);
    if (r.modes.length >= 2) {
      // Second mode: ω₂ = (2π/L)² · √(EI/ρA) = 4× ω₁ → f₂ = 4·f₁
      const f2 = 4 * f1;
      expect('f₂ (Hz) — second bending mode', r.modes[1].frequencyHz, f2, 0.05);
    }
  }
}

// ============================================================
// BLOCK 31: Edge cases
// ============================================================
block('BLOCK 31 — Edge case: invalid input handling');
{
  // Zero length
  const r1 = solve({ totalLength: 0, segments: [seg(0, 0)], supports: [], hinges: [], loads: [] });
  if (!r1.solved && r1.warnings.length > 0) {
    PASS++; console.log(`  PASS zero-length rejected (${r1.warnings[0]})`);
  } else { FAIL++; failMsgs.push('  FAIL zero-length should be rejected'); }
  // No supports
  const r2 = solve({ totalLength: 6, segments: [seg(0, 6)], supports: [], hinges: [], loads: [] });
  if (!r2.solved && r2.warnings.length > 0) {
    PASS++; console.log(`  PASS no-supports rejected (${r2.warnings[0]})`);
  } else { FAIL++; failMsgs.push('  FAIL no-supports should be rejected'); }
}

block('BLOCK 32 — Mixed loading on indeterminate beam (kitchen sink)');
{
  // Two-span continuous beam, L1=L2=5, with multiple load types.
  // Just check: solver returns solved=true and reactions sum equals applied vertical load.
  const L = 5;
  const m: BeamModel = {
    totalLength: 2 * L,
    segments: [seg(0, 2 * L)],
    supports: [
      support('A', 0, 'pin'),
      support('B', L, 'roller'),
      support('C', 2 * L, 'roller'),
    ],
    hinges: [],
    loads: [
      pointLoad('P1', L / 2, 25),
      pointLoad('P2', 1.5 * L, 30),
      udl('w1', L * 0.8, L * 1.2, 8),
      pointMoment('m1', L * 0.6, 15, 'cw'),
    ],
  };
  const r = solve(m);
  if (!r.solved) {
    FAIL++; failMsgs.push('  FAIL kitchen-sink solver did not converge');
  } else {
    PASS++; console.log('  PASS kitchen-sink solved successfully');
    const totalVert = 25 + 30 + 8 * (L * 1.2 - L * 0.8);
    const sumV = r.reactions.reduce((s, x) => s + x.V, 0);
    expect('ΣF_y reactions', sumV, totalVert, 0.005);
  }
}

block('BLOCK 33 — Convergence: refining mesh does not change answer');
{
  const L = 6, w = 10;
  const m: BeamModel = {
    totalLength: L,
    segments: [seg(0, L)],
    supports: [support('A', 0, 'fixed'), support('B', L, 'fixed')],
    hinges: [],
    loads: [udl('w1', 0, L, w)],
  };
  const rDefault = solve(m);
  const rFine = solve(m, { samples: 2000 });
  expect('M_mid converges', findMomentAt(rDefault.moment, L / 2), findMomentAt(rFine.moment, L / 2), 0.001);
  expect('M_wall converges', rDefault.reactions[0].M, rFine.reactions[0].M, 0.001);
}

// ============================================================
// SUMMARY
// ============================================================
console.log('\n================================================');
console.log(` SUMMARY:  ${PASS} passed,  ${FAIL} failed,  ${PASS + FAIL} total`);
console.log('================================================');
if (FAIL > 0) {
  console.log('\nFailed tests:');
  for (const msg of failMsgs) console.log(msg);
  process.exit(1);
}
process.exit(0);

// =========================================================
// Helpers
// =========================================================
function findMomentAt(diagram: { x: number; value: number }[], x: number): number {
  // Linear interpolation between nearest points
  let lo = 0, hi = diagram.length - 1;
  for (let i = 0; i < diagram.length; i++) {
    if (diagram[i].x <= x) lo = i;
    if (diagram[i].x >= x) { hi = i; break; }
  }
  if (lo === hi) return diagram[lo].value;
  const x0 = diagram[lo].x, x1 = diagram[hi].x;
  if (x1 === x0) return diagram[lo].value;
  const t = (x - x0) / (x1 - x0);
  return diagram[lo].value * (1 - t) + diagram[hi].value * t;
}
function findDefAt(diagram: { x: number; value: number }[], x: number): number {
  return findMomentAt(diagram, x);
}
