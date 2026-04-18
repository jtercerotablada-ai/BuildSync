/**
 * Analytical-solution test battery for the beam solver.
 * Run: npx tsx scripts/test-solver.ts
 *
 * Each case builds a BeamModel, calls solve(), and compares the result
 * against a closed-form analytical answer. Tolerance is tight for
 * reactions/shear/moment (exact numerics expected) and looser for
 * deflection (FEM cubic elements give small discretization error).
 */

import { solve } from '../src/lib/beam/solver';
import type { BeamModel } from '../src/lib/beam/types';

type Check = { label: string; got: number; want: number; tol: number };

let failCount = 0;
let passCount = 0;

function approx(got: number, want: number, tol = 1e-3): boolean {
  return Math.abs(got - want) <= tol + 1e-6 * Math.max(Math.abs(got), Math.abs(want));
}

function check(label: string, got: number, want: number, tol = 1e-3) {
  const ok = approx(got, want, tol);
  if (ok) {
    passCount++;
  } else {
    failCount++;
    console.log(`  ✗ ${label}: got ${got.toFixed(6)}, want ${want.toFixed(6)}`);
  }
}

function sample(arr: { x: number; value: number }[], x: number): number {
  let best = arr[0];
  let bestD = Math.abs(arr[0].x - x);
  for (const p of arr) {
    const d = Math.abs(p.x - x);
    if (d < bestD) {
      bestD = d;
      best = p;
    }
  }
  return best.value;
}

function baseModel(length: number): BeamModel {
  return {
    length,
    section: { material: 'steel', E: 200000, I: 1.12e8, A: undefined, label: '' },
    supports: [],
    loads: [],
    moments: [],
    selfWeight: false,
    density: 7850,
  };
}

function header(name: string) {
  console.log(`\n── ${name} ──`);
}

// ============================================================
// Case 1: Simply supported, central point load
// ============================================================
function case1() {
  header('Simply supported, central point load P at L/2');
  const L = 10;
  const P = 20; // kN
  const m = baseModel(L);
  m.supports = [
    { id: 's1', type: 'pinned', position: 0 },
    { id: 's2', type: 'roller', position: L },
  ];
  m.loads = [
    { id: 'p1', type: 'point', position: L / 2, magnitude: P, direction: 'down', loadCase: 'dead' },
  ];
  const r = solve(m);

  // Analytical: R1 = R2 = P/2, M_max = P·L/4 at center
  check('R at 0', r.reactions[0].V, P / 2);
  check('R at L', r.reactions[1].V, P / 2);
  check('V just after 0', sample(r.shear, 0.1), P / 2);
  check('V just before L', sample(r.shear, L - 0.1), -P / 2);
  check('M at center', sample(r.moment, L / 2), (P * L) / 4);
  check('M at 0', sample(r.moment, 0), 0, 1e-2);
  check('M at L', sample(r.moment, L), 0, 1e-2);

  // Max deflection at center: δ = P·L³/(48·EI). In mm units.
  const EI = 200000 * 1e6 * 1.12e8 * 1e-12; // N·m²
  const deltaM = (P * 1000 * Math.pow(L, 3)) / (48 * EI); // meters
  const deltaMM = deltaM * 1000;
  check('δ at center (mm)', Math.abs(sample(r.deflection, L / 2)), deltaMM, 0.05);
}

// ============================================================
// Case 2: Simply supported, UDL over full span
// ============================================================
function case2() {
  header('Simply supported, UDL w over full span');
  const L = 8;
  const w = 5; // kN/m
  const m = baseModel(L);
  m.supports = [
    { id: 's1', type: 'pinned', position: 0 },
    { id: 's2', type: 'roller', position: L },
  ];
  m.loads = [
    {
      id: 'd1',
      type: 'distributed',
      startPosition: 0,
      endPosition: L,
      startMagnitude: w,
      endMagnitude: w,
      direction: 'down',
      loadCase: 'dead',
    },
  ];
  const r = solve(m);

  // Analytical: R = wL/2, M_max = wL²/8 at L/2, V(0) = wL/2, V(L) = -wL/2
  const R = (w * L) / 2;
  check('R at 0', r.reactions[0].V, R);
  check('R at L', r.reactions[1].V, R);
  check('V at 0⁺', sample(r.shear, 0), R, 0.05);
  check('V at L⁻', sample(r.shear, L), -R, 0.05);
  check('V at center', sample(r.shear, L / 2), 0);
  check('M_max at center', sample(r.moment, L / 2), (w * L * L) / 8);
  check('M at 0', sample(r.moment, 0), 0, 1e-2);
  check('M at L', sample(r.moment, L), 0, 1e-2);

  const EI = 200000 * 1e6 * 1.12e8 * 1e-12;
  const delta = (5 * (w * 1000) * Math.pow(L, 4)) / (384 * EI);
  check('δ_max (mm)', Math.abs(sample(r.deflection, L / 2)), delta * 1000, 0.05);
}

// ============================================================
// Case 3: Cantilever, point load at tip
// ============================================================
function case3() {
  header('Cantilever (fixed at 0), point load P at free tip L');
  const L = 6;
  const P = 10;
  const m = baseModel(L);
  m.supports = [{ id: 's1', type: 'fixed', position: 0 }];
  m.loads = [{ id: 'p1', type: 'point', position: L, magnitude: P, direction: 'down', loadCase: 'dead' }];
  const r = solve(m);

  // Analytical: R_V = P, R_M = -P·L (hogging at fixed end)
  check('R_V at 0', r.reactions[0].V, P);
  check('R_M at 0', r.reactions[0].M, -P * L);
  check('V anywhere', sample(r.shear, L / 2), P);
  check('M at 0', sample(r.moment, 0), -P * L);
  check('M at tip', sample(r.moment, L), 0, 1e-2);

  const EI = 200000 * 1e6 * 1.12e8 * 1e-12;
  const delta = ((P * 1000) * Math.pow(L, 3)) / (3 * EI);
  check('δ at tip (mm)', Math.abs(sample(r.deflection, L)), delta * 1000, 0.1);
}

// ============================================================
// Case 4: Cantilever, UDL over full span
// ============================================================
function case4() {
  header('Cantilever (fixed at 0), UDL w full span');
  const L = 5;
  const w = 8;
  const m = baseModel(L);
  m.supports = [{ id: 's1', type: 'fixed', position: 0 }];
  m.loads = [
    {
      id: 'd1',
      type: 'distributed',
      startPosition: 0,
      endPosition: L,
      startMagnitude: w,
      endMagnitude: w,
      direction: 'down',
      loadCase: 'dead',
    },
  ];
  const r = solve(m);

  const W = w * L; // total
  check('R_V at 0', r.reactions[0].V, W);
  check('R_M at 0', r.reactions[0].M, (-w * L * L) / 2);
  check('V at 0', sample(r.shear, 0.01), W, 0.1);
  check('V at tip', sample(r.shear, L - 0.01), 0, 0.1);
  check('M at 0', sample(r.moment, 0), (-w * L * L) / 2);
  check('M at tip', sample(r.moment, L), 0, 1e-2);
  check('M at L/2', sample(r.moment, L / 2), (-w * L * L) / 8);

  const EI = 200000 * 1e6 * 1.12e8 * 1e-12;
  const delta = ((w * 1000) * Math.pow(L, 4)) / (8 * EI);
  check('δ at tip (mm)', Math.abs(sample(r.deflection, L)), delta * 1000, 0.1);
}

// ============================================================
// Case 5: Overhanging beam (Juan's bug case)
// ============================================================
function case5() {
  header('Overhang: supports 0 & 8, UDL 10 kN/m on [0,8], point 10 kN at x=10');
  const L = 10;
  const w = 10;
  const P = 10;
  const m = baseModel(L);
  m.supports = [
    { id: 's1', type: 'pinned', position: 0 },
    { id: 's2', type: 'roller', position: 8 },
  ];
  m.loads = [
    {
      id: 'd1',
      type: 'distributed',
      startPosition: 0,
      endPosition: 8,
      startMagnitude: w,
      endMagnitude: w,
      direction: 'down',
      loadCase: 'dead',
    },
    { id: 'p1', type: 'point', position: 10, magnitude: P, direction: 'down', loadCase: 'dead' },
  ];
  const r = solve(m);

  // R0 + R8 = 80+10 = 90; sum M about 0: R8·8 = 10·4·8 + 10·10 → wait
  // Actually: ΣM_0: R8·8 = w·8·4 + P·10 = 320 + 100 = 420 → R8 = 52.5
  // R0 = 90 - 52.5 = 37.5
  check('R0', r.reactions[0].V, 37.5);
  check('R8', r.reactions[1].V, 52.5);
  check('M at 0', sample(r.moment, 0), 0, 1e-2);
  check('M at 8', sample(r.moment, 8), -20, 0.05);
  check('M at 10 (free end)', sample(r.moment, 10), 0, 0.05);
  check('M at 4', sample(r.moment, 4), 37.5 * 4 - 10 * 4 * 2); // = 150 - 80 = 70
}

// ============================================================
// Case 6: Triangular load (0 at left, w at right) on simply supported
// ============================================================
function case6() {
  header('Simply supported, triangular load 0→w from 0 to L');
  const L = 6;
  const w = 12; // peak
  const m = baseModel(L);
  m.supports = [
    { id: 's1', type: 'pinned', position: 0 },
    { id: 's2', type: 'roller', position: L },
  ];
  m.loads = [
    {
      id: 'd1',
      type: 'distributed',
      startPosition: 0,
      endPosition: L,
      startMagnitude: 0,
      endMagnitude: w,
      direction: 'down',
      loadCase: 'dead',
    },
  ];
  const r = solve(m);

  // Total load W = wL/2. Centroid at 2L/3.
  // R0 = W·(1 - 2/3) = W/3 = wL/6
  // RL = W·(2/3) = wL/3
  check('R0', r.reactions[0].V, (w * L) / 6);
  check('RL', r.reactions[1].V, (w * L) / 3);
  // M_max at x = L/√3, value = wL²/(9√3)
  const xMax = L / Math.sqrt(3);
  const Mmax = (w * L * L) / (9 * Math.sqrt(3));
  check('M_max location', sample(r.moment, xMax), Mmax, 0.05);
  check('M at 0', sample(r.moment, 0), 0, 1e-2);
  check('M at L', sample(r.moment, L), 0, 1e-2);
}

// ============================================================
// Case 7: Propped cantilever with UDL
// ============================================================
function case7() {
  header('Propped cantilever (fixed at 0, roller at L), UDL w');
  const L = 4;
  const w = 6;
  const m = baseModel(L);
  m.supports = [
    { id: 's1', type: 'fixed', position: 0 },
    { id: 's2', type: 'roller', position: L },
  ];
  m.loads = [
    {
      id: 'd1',
      type: 'distributed',
      startPosition: 0,
      endPosition: L,
      startMagnitude: w,
      endMagnitude: w,
      direction: 'down',
      loadCase: 'dead',
    },
  ];
  const r = solve(m);

  // Analytical: R_fixed = 5wL/8, M_fixed = -wL²/8, R_roller = 3wL/8
  check('R_fixed V', r.reactions[0].V, (5 * w * L) / 8);
  check('R_fixed M', r.reactions[0].M, (-w * L * L) / 8, 0.01);
  check('R_roller', r.reactions[1].V, (3 * w * L) / 8);
  // Max positive moment at x = 5L/8 from fixed = 3L/8 from roller; value = 9wL²/128
  const xMax = (5 * L) / 8;
  check('M_max(+) at 5L/8', sample(r.moment, xMax), (9 * w * L * L) / 128, 0.05);
  check('M at 0', sample(r.moment, 0), (-w * L * L) / 8, 0.02);
  check('M at L', sample(r.moment, L), 0, 0.01);
}

// ============================================================
// Case 8: Applied moment at midspan of simply supported beam
// ============================================================
function case8() {
  header('Simply supported, applied moment M0 at midspan');
  const L = 10;
  const M0 = 30; // kN·m
  const m = baseModel(L);
  m.supports = [
    { id: 's1', type: 'pinned', position: 0 },
    { id: 's2', type: 'roller', position: L },
  ];
  // Applied CCW moment M0 at midspan. ΣM_A=0: R_B·L + M0 = 0 → R_B = -M0/L.
  // R_A = +M0/L (upward). CCW moment creates DOWN jump of M0 in diagram.
  m.moments = [{ id: 'm1', position: L / 2, magnitude: M0, direction: 'ccw' }];
  const r = solve(m);

  check('R0', r.reactions[0].V, M0 / L);
  check('RL', r.reactions[1].V, -M0 / L);
  // M(x) from left: R_A·x = (M0/L)·x for x < L/2. At L/2⁻ = +M0/2.
  check('M just before midspan', sample(r.moment, L / 2 - 0.01), M0 / 2, 0.02);
  // CCW applied moment → down jump of M0: M(L/2⁺) = M0/2 - M0 = -M0/2
  check('M just after midspan', sample(r.moment, L / 2 + 0.01), -M0 / 2, 0.02);
  check('M at 0', sample(r.moment, 0), 0, 1e-2);
  check('M at L', sample(r.moment, L), 0, 1e-2);
}

// ============================================================
// Case 9: Simply supported, partial UDL on interior strip
// (catches moment-arm bug beyond end of load)
// ============================================================
function case9() {
  header('Simply supported L=10, UDL w=4 on [2,6] only');
  const L = 10;
  const w = 4;
  const m = baseModel(L);
  m.supports = [
    { id: 's1', type: 'pinned', position: 0 },
    { id: 's2', type: 'roller', position: L },
  ];
  m.loads = [
    {
      id: 'd1',
      type: 'distributed',
      startPosition: 2,
      endPosition: 6,
      startMagnitude: w,
      endMagnitude: w,
      direction: 'down',
      loadCase: 'dead',
    },
  ];
  const r = solve(m);

  // Total W = 4·4 = 16 kN. Centroid at 4. ΣM_0: RL·10 = 16·4 → RL = 6.4. R0 = 16-6.4 = 9.6.
  check('R0', r.reactions[0].V, 9.6);
  check('RL', r.reactions[1].V, 6.4);
  check('M at 0', sample(r.moment, 0), 0, 1e-2);
  check('M at 2 (start of load)', sample(r.moment, 2), 9.6 * 2);  // = 19.2
  check('M at 4 (mid of load)', sample(r.moment, 4), 9.6 * 4 - w * 2 * 1); // 38.4 - 8 = 30.4
  check('M at 6 (end of load)', sample(r.moment, 6), 9.6 * 6 - 16 * 2); // = 57.6-32 = 25.6
  // Past the load: M(8) = R0·8 - W·(8-4) = 76.8 - 64 = 12.8
  check('M at 8 (past load)', sample(r.moment, 8), 9.6 * 8 - 16 * 4);
  check('M at L', sample(r.moment, L), 0, 1e-2);
}

// ============================================================
// Case 10: Double overhang (cantilevers on both sides)
// ============================================================
function case10() {
  header('Double overhang: L=12, supports at 2 and 10, UDL w=5 full span');
  const L = 12;
  const w = 5;
  const m = baseModel(L);
  m.supports = [
    { id: 's1', type: 'pinned', position: 2 },
    { id: 's2', type: 'roller', position: 10 },
  ];
  m.loads = [
    {
      id: 'd1',
      type: 'distributed',
      startPosition: 0,
      endPosition: L,
      startMagnitude: w,
      endMagnitude: w,
      direction: 'down',
      loadCase: 'dead',
    },
  ];
  const r = solve(m);

  // Symmetric: R1 = R2 = wL/2 = 30
  check('R1', r.reactions[0].V, 30);
  check('R2', r.reactions[1].V, 30);
  // M at free ends should be 0
  check('M at 0 (free)', sample(r.moment, 0), 0, 1e-2);
  check('M at L (free)', sample(r.moment, L), 0, 1e-2);
  // M at supports: each cantilever length 2, carries w·2 = 10kN.
  // M at support = -w·2·1 = -10
  check('M at left support', sample(r.moment, 2), -10, 0.02);
  check('M at right support', sample(r.moment, 10), -10, 0.02);
  // M at center (x=6) = M_support + (wL_span/2)·(span/2 - span/4)
  // Alternative: between supports, simply-supported-like with end moments -10 each,
  // plus UDL. M(6) = -10 + (30-w·4)·(6-2) - w·4²/2
  //         = -10 + (30-20)·4 - 40 = -10 + 40 - 40 = -10 ... hmm let me redo
  // Actually from left support: V(2⁺) = R1 - w·2 = 30 - 10 = 20
  // At x: M(x) = M(2) + V(2⁺)·(x-2) - w·(x-2)²/2 + ∫cantilever moment from before support
  // Simpler: M(6) = R0_at_2·(6-2) + ∫[0,6] of downward w dm
  //     Σ moments about x=6 from left: R1·4 - w·6·3 = 120 - 90 = 30 — wait but R1 is at x=2.
  //     R1·(6-2) - ∫[0,6] w·(6-u) du = 30·4 - w·[(6² - 0²)/2 - 0]... need to be careful.
  //     Integral of w·(6-u) from 0 to 6 = w·[6u - u²/2] from 0 to 6 = w·(36 - 18) = 18w = 90.
  //     So M(6) = R1·4 - 90 = 120 - 90 = 30. Yes 30 kN·m.
  check('M at center', sample(r.moment, 6), 30, 0.05);
}

// ============================================================
// Case 11: Multiple point loads
// ============================================================
function case11() {
  header('SS beam L=10, three point loads at 2, 5, 8 (all 10 kN down)');
  const L = 10;
  const m = baseModel(L);
  m.supports = [
    { id: 's1', type: 'pinned', position: 0 },
    { id: 's2', type: 'roller', position: L },
  ];
  m.loads = [
    { id: 'p1', type: 'point', position: 2, magnitude: 10, direction: 'down', loadCase: 'dead' },
    { id: 'p2', type: 'point', position: 5, magnitude: 10, direction: 'down', loadCase: 'dead' },
    { id: 'p3', type: 'point', position: 8, magnitude: 10, direction: 'down', loadCase: 'dead' },
  ];
  const r = solve(m);

  // ΣM_0: R_L·10 = 10·2 + 10·5 + 10·8 = 150 → R_L = 15
  // R_0 = 30 - 15 = 15
  check('R0', r.reactions[0].V, 15);
  check('RL', r.reactions[1].V, 15);
  check('V at 1 (before first load)', sample(r.shear, 1), 15);
  check('V at 3 (between 1st and 2nd)', sample(r.shear, 3), 5);
  check('V at 6 (between 2nd and 3rd)', sample(r.shear, 6), -5);
  check('V at 9 (after last)', sample(r.shear, 9), -15);
  // M at 5 = R0·5 - 10·3 = 75 - 30 = 45
  check('M at 5', sample(r.moment, 5), 45);
  // M at 2 = R0·2 = 30
  check('M at 2', sample(r.moment, 2), 30);
}

// ============================================================
// Case 12: Fixed-fixed beam with UDL
// ============================================================
function case12() {
  header('Fixed-fixed beam, UDL w full span');
  const L = 8;
  const w = 10;
  const m = baseModel(L);
  m.supports = [
    { id: 's1', type: 'fixed', position: 0 },
    { id: 's2', type: 'fixed', position: L },
  ];
  m.loads = [
    {
      id: 'd1',
      type: 'distributed',
      startPosition: 0,
      endPosition: L,
      startMagnitude: w,
      endMagnitude: w,
      direction: 'down',
      loadCase: 'dead',
    },
  ];
  const r = solve(m);

  // Both ends: R_V = wL/2, R_M = ±wL²/12
  check('R0 V', r.reactions[0].V, (w * L) / 2);
  check('RL V', r.reactions[1].V, (w * L) / 2);
  check('R0 M', r.reactions[0].M, (-w * L * L) / 12, 0.02);
  check('RL M', r.reactions[1].M, (w * L * L) / 12, 0.02);
  check('M at 0', sample(r.moment, 0), (-w * L * L) / 12, 0.02);
  check('M at L', sample(r.moment, L), (-w * L * L) / 12, 0.02);
  // M at midspan = +wL²/24
  check('M at L/2', sample(r.moment, L / 2), (w * L * L) / 24, 0.02);

  const EI = 200000 * 1e6 * 1.12e8 * 1e-12;
  const delta = ((w * 1000) * Math.pow(L, 4)) / (384 * EI);
  check('δ at center (mm)', Math.abs(sample(r.deflection, L / 2)), delta * 1000, 0.05);
}

// ============================================================
// Case 13: Upward point load (to exercise the direction='up' branch)
// ============================================================
function case13() {
  header('SS beam, upward point load P at L/3 (negative reaction check)');
  const L = 9;
  const P = 15;
  const m = baseModel(L);
  m.supports = [
    { id: 's1', type: 'pinned', position: 0 },
    { id: 's2', type: 'roller', position: L },
  ];
  m.loads = [
    { id: 'p1', type: 'point', position: L / 3, magnitude: P, direction: 'up', loadCase: 'dead' },
  ];
  const r = solve(m);
  // For upward load, reactions should be downward (negative): total load = -P up, supports pull down.
  // Upward load at L/3: ΣM_0: R_L·L = -P·(L/3) → R_L = -P/3. R0 = -P - R_L = -P + P/3 = -2P/3
  check('R0', r.reactions[0].V, -(2 * P) / 3);
  check('RL', r.reactions[1].V, -P / 3);
  // M at L/3 = R0·L/3 = -2P/3 · L/3 = -2PL/9
  check('M at L/3', sample(r.moment, L / 3), (-2 * P * L) / 9, 0.05);
}

// ============================================================
// Case 14: CW applied moment at midspan (mirror of case 8)
// ============================================================
function case14() {
  header('Simply supported, CW applied moment at midspan');
  const L = 10;
  const M0 = 30;
  const m = baseModel(L);
  m.supports = [
    { id: 's1', type: 'pinned', position: 0 },
    { id: 's2', type: 'roller', position: L },
  ];
  // CW applied moment (direction = 'cw', sign=-1). Mirror of case 8.
  // ΣM_A: R_B·L - M0 = 0 → R_B = +M0/L. R_A = -M0/L.
  m.moments = [{ id: 'm1', position: L / 2, magnitude: M0, direction: 'cw' }];
  const r = solve(m);

  check('R0', r.reactions[0].V, -M0 / L);
  check('RL', r.reactions[1].V, M0 / L);
  // CW applied moment → UP jump of M0 in diagram.
  check('M just before midspan', sample(r.moment, L / 2 - 0.01), -M0 / 2, 0.02);
  check('M just after midspan', sample(r.moment, L / 2 + 0.01), M0 / 2, 0.02);
  check('M at 0', sample(r.moment, 0), 0, 1e-2);
  check('M at L', sample(r.moment, L), 0, 1e-2);
}

// ============================================================
// Case 15: Cantilever fixed at RIGHT end (mirror of case 3)
// ============================================================
function case15() {
  header('Cantilever fixed at x=L, point load P at free left tip x=0');
  const L = 6;
  const P = 10;
  const m = baseModel(L);
  m.supports = [{ id: 's1', type: 'fixed', position: L }];
  m.loads = [{ id: 'p1', type: 'point', position: 0, magnitude: P, direction: 'down', loadCase: 'dead' }];
  const r = solve(m);

  // Analytical: R_V = P, internal sagging M at wall = -PL (hogging).
  check('R_V at L', r.reactions[0].V, P);
  // M at wall (interior sagging) = -PL.
  check('M at L (wall)', sample(r.moment, L), -P * L, 0.02);
  check('M at 0 (free)', sample(r.moment, 0), 0, 1e-2);
  check('M at L/2', sample(r.moment, L / 2), (-P * L) / 2, 0.02);

  const EI = 200000 * 1e6 * 1.12e8 * 1e-12;
  // Tip deflection = PL³/(3EI) same magnitude as left-fixed cantilever.
  const delta = ((P * 1000) * Math.pow(L, 3)) / (3 * EI);
  check('δ at free tip (mm)', Math.abs(sample(r.deflection, 0)), delta * 1000, 0.1);
}

// ============================================================
// Case 16: Combined loads (UDL + point + applied moment on SS beam)
// ============================================================
function case16() {
  header('SS beam L=10, UDL w=4 full span + P=15 at x=3 + M0=20 CCW at x=7');
  const L = 10;
  const w = 4;
  const P = 15;
  const M0 = 20;
  const m = baseModel(L);
  m.supports = [
    { id: 's1', type: 'pinned', position: 0 },
    { id: 's2', type: 'roller', position: L },
  ];
  m.loads = [
    {
      id: 'd1',
      type: 'distributed',
      startPosition: 0,
      endPosition: L,
      startMagnitude: w,
      endMagnitude: w,
      direction: 'down',
      loadCase: 'dead',
    },
    { id: 'p1', type: 'point', position: 3, magnitude: P, direction: 'down', loadCase: 'dead' },
  ];
  m.moments = [{ id: 'm1', position: 7, magnitude: M0, direction: 'ccw' }];
  const r = solve(m);

  // Reactions by superposition / equilibrium:
  // ΣF_y: R0 + RL = wL + P = 40 + 15 = 55.
  // ΣM_0 (CCW+): RL·L + M0 - w·L·(L/2) - P·3 = 0
  //   RL·10 + 20 - 40·5 - 15·3 = 0 → RL = (200 + 45 - 20)/10 = 225/10 = 22.5
  // R0 = 55 - 22.5 = 32.5
  check('R0', r.reactions[0].V, 32.5);
  check('RL', r.reactions[1].V, 22.5);
  check('M at 0', sample(r.moment, 0), 0, 1e-2);
  check('M at L', sample(r.moment, L), 0, 1e-2);
  // M at x=3 (just before P): M = R0·3 - w·3²/2 = 97.5 - 18 = 79.5
  check('M at x=3⁻', sample(r.moment, 3 - 0.01), 79.5, 0.1);
  // M at x=5 (between P and M0): M = R0·5 - w·5²/2 - P·(5-3) = 162.5 - 50 - 30 = 82.5
  check('M at x=5', sample(r.moment, 5), 82.5, 0.1);
  // M just before x=7: R0·7 - w·7²/2 - P·(7-3) = 227.5 - 98 - 60 = 69.5
  check('M at x=7⁻', sample(r.moment, 7 - 0.01), 69.5, 0.1);
  // CCW M0 at x=7 → down jump of M0: M(7+) = 69.5 - 20 = 49.5
  check('M at x=7⁺', sample(r.moment, 7 + 0.01), 49.5, 0.1);
}

// ============================================================
// Case 17: Two applied moments on SS beam (superposition)
// ============================================================
function case17() {
  header('SS beam L=8, +M1 CCW at x=2 and +M2 CW at x=6');
  const L = 8;
  const M1 = 10; // CCW at x=2
  const M2 = 15; // CW at x=6
  const m = baseModel(L);
  m.supports = [
    { id: 's1', type: 'pinned', position: 0 },
    { id: 's2', type: 'roller', position: L },
  ];
  m.moments = [
    { id: 'm1', position: 2, magnitude: M1, direction: 'ccw' },
    { id: 'm2', position: 6, magnitude: M2, direction: 'cw' },
  ];
  const r = solve(m);

  // ΣF_y: R0 + RL = 0.
  // ΣM_0 (CCW+): RL·L + M1 - M2 = 0 → RL = (M2 - M1)/L = 5/8 = 0.625
  // R0 = -RL = -0.625
  check('R0', r.reactions[0].V, -0.625);
  check('RL', r.reactions[1].V, 0.625);
  check('M at 0', sample(r.moment, 0), 0, 1e-2);
  check('M at L', sample(r.moment, L), 0, 1e-2);
  // M(x) = R0·x for 0<x<2: M(2⁻) = -0.625·2 = -1.25
  check('M at x=2⁻', sample(r.moment, 2 - 0.01), -1.25, 0.05);
  // CCW M1 → -M1 jump: M(2⁺) = -1.25 - 10 = -11.25
  check('M at x=2⁺', sample(r.moment, 2 + 0.01), -11.25, 0.05);
  // Between: M(x) = R0·x - M1. At x=5: -3.125 - 10 = -13.125
  check('M at x=5', sample(r.moment, 5), -13.125, 0.05);
  // M(6⁻) = R0·6 - M1 = -3.75 - 10 = -13.75
  check('M at x=6⁻', sample(r.moment, 6 - 0.01), -13.75, 0.05);
  // CW M2 → +M2 jump: M(6⁺) = -13.75 + 15 = 1.25
  check('M at x=6⁺', sample(r.moment, 6 + 0.01), 1.25, 0.05);
}

// ============================================================
// Case 18: Self-weight only on a simply supported steel beam
// ============================================================
function case18() {
  header('SS beam L=6, W14x22 section, self-weight only');
  const L = 6;
  const m = baseModel(L);
  // W14x22: A = 4180 mm², I = 1.12e8 mm⁴. Density = 7850 kg/m³.
  m.section = { material: 'steel', E: 200000, I: 1.12e8, A: 4180, label: 'W14x22' };
  m.supports = [
    { id: 's1', type: 'pinned', position: 0 },
    { id: 's2', type: 'roller', position: L },
  ];
  m.selfWeight = true;
  const r = solve(m);

  // Self-weight per meter: w_sw = ρ·A·g = 7850 kg/m³ · 4180e-6 m² · 9.81 = 321.8 N/m = 0.3218 kN/m
  const w = (7850 * 4180e-6 * 9.81) / 1000; // kN/m
  const R = (w * L) / 2;
  check('R0', r.reactions[0].V, R, 1e-3);
  check('RL', r.reactions[1].V, R, 1e-3);
  check('M at L/2', sample(r.moment, L / 2), (w * L * L) / 8, 0.01);
  check('M at 0', sample(r.moment, 0), 0, 1e-2);
  check('M at L', sample(r.moment, L), 0, 1e-2);
}

// ============================================================
// Case 19: Two fixed supports, central point load (symmetric)
// ============================================================
function case19() {
  header('Fixed-fixed beam L=10, central point load P=20');
  const L = 10;
  const P = 20;
  const m = baseModel(L);
  m.supports = [
    { id: 's1', type: 'fixed', position: 0 },
    { id: 's2', type: 'fixed', position: L },
  ];
  m.loads = [
    { id: 'p1', type: 'point', position: L / 2, magnitude: P, direction: 'down', loadCase: 'dead' },
  ];
  const r = solve(m);

  // Analytical: R0 = RL = P/2. M_walls = -PL/8 (hogging), M_center = +PL/8.
  check('R0 V', r.reactions[0].V, P / 2);
  check('RL V', r.reactions[1].V, P / 2);
  check('R0 M', r.reactions[0].M, (-P * L) / 8, 0.02);
  check('RL M', r.reactions[1].M, (P * L) / 8, 0.02);
  check('M at 0', sample(r.moment, 0), (-P * L) / 8, 0.02);
  check('M at L', sample(r.moment, L), (-P * L) / 8, 0.02);
  check('M at L/2', sample(r.moment, L / 2), (P * L) / 8, 0.05);

  const EI = 200000 * 1e6 * 1.12e8 * 1e-12;
  const delta = ((P * 1000) * Math.pow(L, 3)) / (192 * EI);
  check('δ at center (mm)', Math.abs(sample(r.deflection, L / 2)), delta * 1000, 0.1);
}

// ============================================================
// Case 20: Continuous beam (3 supports), UDL — shows interior support bending
// ============================================================
function case20() {
  header('2-span continuous beam L=12, supports 0/6/12, UDL w=10');
  const L = 12;
  const w = 10;
  const m = baseModel(L);
  m.supports = [
    { id: 's1', type: 'pinned', position: 0 },
    { id: 's2', type: 'roller', position: 6 },
    { id: 's3', type: 'roller', position: L },
  ];
  m.loads = [
    {
      id: 'd1',
      type: 'distributed',
      startPosition: 0,
      endPosition: L,
      startMagnitude: w,
      endMagnitude: w,
      direction: 'down',
      loadCase: 'dead',
    },
  ];
  const r = solve(m);

  // Classical 2-equal-span continuous beam with UDL w, span l=6:
  // R_end = 3wl/8 = 22.5, R_mid = 10wl/8 = 75, M_mid_support = -wl²/8 = -45
  // Max positive M in each span at x = 3l/8 from end support = 9wl²/128 = 25.3125
  const l = 6;
  const R_end = (3 * w * l) / 8;
  const R_mid = (10 * w * l) / 8;
  check('R0', r.reactions[0].V, R_end, 0.05);
  check('R_mid', r.reactions[1].V, R_mid, 0.05);
  check('RL', r.reactions[2].V, R_end, 0.05);
  check('M at mid support', sample(r.moment, 6), (-w * l * l) / 8, 0.05);
  check('M at 0', sample(r.moment, 0), 0, 1e-2);
  check('M at L', sample(r.moment, L), 0, 1e-2);
  // Max positive in left span at x = 3l/8 = 2.25
  check('M_max(+) in span', sample(r.moment, (3 * l) / 8), (9 * w * l * l) / 128, 0.05);
}

// ============================================================
// Run all
// ============================================================
const cases = [
  case1, case2, case3, case4, case5, case6, case7, case8, case9, case10,
  case11, case12, case13, case14, case15, case16, case17, case18, case19, case20,
];
for (const c of cases) {
  try {
    c();
  } catch (e) {
    failCount++;
    console.log(`  ✗ ${c.name} threw: ${e}`);
  }
}

console.log(`\n────────────────────────────\nResult: ${passCount} pass, ${failCount} fail`);
if (failCount > 0) process.exit(1);
