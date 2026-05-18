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
// Case 21: Propped cantilever with central point load (not UDL)
// ============================================================
function case21() {
  header('Propped cantilever L=8, central P=16 (fixed at 0, roller at L)');
  const L = 8;
  const P = 16;
  const m = baseModel(L);
  m.supports = [
    { id: 's1', type: 'fixed', position: 0 },
    { id: 's2', type: 'roller', position: L },
  ];
  m.loads = [
    { id: 'p1', type: 'point', position: L / 2, magnitude: P, direction: 'down', loadCase: 'dead' },
  ];
  const r = solve(m);

  // Classical: R_fixed_V = 11P/16, R_fixed_M = -3PL/16, R_roller = 5P/16.
  // M_max(+) at L/2 = 5PL/32.
  check('R_fixed V', r.reactions[0].V, (11 * P) / 16);
  check('R_fixed M', r.reactions[0].M, (-3 * P * L) / 16, 0.02);
  check('R_roller', r.reactions[1].V, (5 * P) / 16);
  check('M at 0', sample(r.moment, 0), (-3 * P * L) / 16, 0.02);
  check('M at L/2', sample(r.moment, L / 2), (5 * P * L) / 32, 0.05);
  check('M at L', sample(r.moment, L), 0, 0.02);
}

// ============================================================
// Case 22: Cantilever with partial UDL only on first half
// ============================================================
function case22() {
  header('Cantilever L=6, UDL w=10 only on [0,3], nothing on [3,6]');
  const L = 6;
  const w = 10;
  const a = 3; // UDL ends at x=3
  const m = baseModel(L);
  m.supports = [{ id: 's1', type: 'fixed', position: 0 }];
  m.loads = [
    {
      id: 'd1',
      type: 'distributed',
      startPosition: 0,
      endPosition: a,
      startMagnitude: w,
      endMagnitude: w,
      direction: 'down',
      loadCase: 'dead',
    },
  ];
  const r = solve(m);

  // Total W = w·a = 30, centroid at a/2 = 1.5 from fixed.
  const W = w * a;
  check('R_V at 0', r.reactions[0].V, W);
  check('R_M at 0', r.reactions[0].M, -W * (a / 2), 0.02);
  // M at a (end of UDL): R_V·a + R_M - w·a²/2 = 30·3 - 45 - 45 = 0.
  check('M at end of UDL (x=3)', sample(r.moment, a), 0, 0.02);
  // M for x > a: V(x) = 0 and M(x) = 0.
  check('M at x=4 (past UDL)', sample(r.moment, 4), 0, 0.02);
  check('M at tip (free)', sample(r.moment, L), 0, 0.02);
  check('V at x=4 (past UDL)', sample(r.shear, 4), 0, 0.05);
}

// ============================================================
// Case 23: Cantilever with applied CCW moment at free tip
// ============================================================
function case23() {
  header('Cantilever L=5, CCW moment M0=25 applied at free tip');
  const L = 5;
  const M0 = 25;
  const m = baseModel(L);
  m.supports = [{ id: 's1', type: 'fixed', position: 0 }];
  m.moments = [{ id: 'm1', position: L, magnitude: M0, direction: 'ccw' }];
  const r = solve(m);

  // No vertical forces → R_V = 0. ΣM: R_M_applied + M0 = 0 → R_M_applied = -M0 (CW).
  // R_M_stored = +M0.
  check('R_V at 0', r.reactions[0].V, 0, 1e-2);
  check('R_M at 0', r.reactions[0].M, M0, 0.02);
  // M(x) is constant = +M0 for 0 ≤ x < L (no forces, only wall's constant moment).
  check('M at 0', sample(r.moment, 0), M0, 0.02);
  check('M at L/2', sample(r.moment, L / 2), M0, 0.02);
  // δ at tip: standard cantilever with tip moment: δ = M0·L²/(2EI).
  const EI = 200000 * 1e6 * 1.12e8 * 1e-12;
  const delta = (M0 * 1000 * L * L) / (2 * EI);
  check('δ at tip (mm)', Math.abs(sample(r.deflection, L)), delta * 1000, 0.1);
}

// ============================================================
// Case 24: Cantilever with CW moment at tip (mirror of 23)
// ============================================================
function case24() {
  header('Cantilever L=5, CW moment M0=25 applied at free tip');
  const L = 5;
  const M0 = 25;
  const m = baseModel(L);
  m.supports = [{ id: 's1', type: 'fixed', position: 0 }];
  m.moments = [{ id: 'm1', position: L, magnitude: M0, direction: 'cw' }];
  const r = solve(m);

  check('R_V at 0', r.reactions[0].V, 0, 1e-2);
  check('R_M at 0', r.reactions[0].M, -M0, 0.02);
  check('M at 0', sample(r.moment, 0), -M0, 0.02);
  check('M at L/2', sample(r.moment, L / 2), -M0, 0.02);
}

// ============================================================
// Case 25: SS beam with ascending trapezoidal UDL (w1=5, w2=15)
// ============================================================
function case25() {
  header('SS beam L=8, trapezoidal UDL w1=5 at 0 → w2=15 at L');
  const L = 8;
  const w1 = 5;
  const w2 = 15;
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
      startMagnitude: w1,
      endMagnitude: w2,
      direction: 'down',
      loadCase: 'dead',
    },
  ];
  const r = solve(m);

  // Total W = L·(w1+w2)/2 = 80. Centroid = L·(w1+2w2)/(3(w1+w2)) = 8·35/60 = 4.6667.
  const W = (L * (w1 + w2)) / 2;
  const xc = (L * (w1 + 2 * w2)) / (3 * (w1 + w2));
  const R_L = (W * xc) / L;
  const R_0 = W - R_L;
  check('R0', r.reactions[0].V, R_0, 0.02);
  check('RL', r.reactions[1].V, R_L, 0.02);
  check('M at 0', sample(r.moment, 0), 0, 1e-2);
  check('M at L', sample(r.moment, L), 0, 1e-2);
  // M at x=4: analytical = 33.333·4 - ∫₀⁴(5 + 1.25u)(4-u)du = 133.33 - 53.33 = 80
  check('M at x=4', sample(r.moment, 4), 80, 0.1);
  check('M at x=2', sample(r.moment, 2), 55, 0.1);
}

// ============================================================
// Case 26: SS beam with descending trapezoidal UDL (w1=15, w2=5) — mirror
// ============================================================
function case26() {
  header('SS beam L=8, descending UDL w1=15 at 0 → w2=5 at L');
  const L = 8;
  const w1 = 15;
  const w2 = 5;
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
      startMagnitude: w1,
      endMagnitude: w2,
      direction: 'down',
      loadCase: 'dead',
    },
  ];
  const r = solve(m);

  const W = (L * (w1 + w2)) / 2;
  const xc = (L * (w1 + 2 * w2)) / (3 * (w1 + w2));
  const R_L = (W * xc) / L;
  const R_0 = W - R_L;
  check('R0', r.reactions[0].V, R_0, 0.02);
  check('RL', r.reactions[1].V, R_L, 0.02);
  check('M at 0', sample(r.moment, 0), 0, 1e-2);
  check('M at L', sample(r.moment, L), 0, 1e-2);
}

// ============================================================
// Case 27: UDL direction='up' (lifting load) on SS beam
// ============================================================
function case27() {
  header('SS beam L=10, UDL w=5 directed UP (lifting)');
  const L = 10;
  const w = 5;
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
      direction: 'up',
      loadCase: 'dead',
    },
  ];
  const r = solve(m);

  // Reactions pull DOWN to hold beam (net total up = wL = 50 lifting, supports resist down).
  const R = -(w * L) / 2;
  check('R0', r.reactions[0].V, R);
  check('RL', r.reactions[1].V, R);
  // Moment shape inverted: M_max = -wL²/8 = -62.5 (hogging instead of sagging).
  check('M at L/2', sample(r.moment, L / 2), -(w * L * L) / 8);
  check('M at 0', sample(r.moment, 0), 0, 1e-2);
  check('M at L', sample(r.moment, L), 0, 1e-2);
}

// ============================================================
// Case 28: UDL defined right-to-left (startPosition > endPosition)
// Result must match equivalent left-to-right definition.
// ============================================================
function case28() {
  header('SS beam L=10, UDL on [2,8] defined R→L (start=8, end=2)');
  const L = 10;
  const w = 6;
  const m = baseModel(L);
  m.supports = [
    { id: 's1', type: 'pinned', position: 0 },
    { id: 's2', type: 'roller', position: L },
  ];
  m.loads = [
    {
      id: 'd1',
      type: 'distributed',
      startPosition: 8, // reversed
      endPosition: 2,
      startMagnitude: w,
      endMagnitude: w,
      direction: 'down',
      loadCase: 'dead',
    },
  ];
  const r = solve(m);

  // Equivalent to UDL on [2,8]. W = 6·6 = 36, centroid at x=5.
  // ΣM_0: R_L·10 = 36·5 → R_L = 18. R_0 = 18. Symmetric.
  check('R0', r.reactions[0].V, 18, 0.02);
  check('RL', r.reactions[1].V, 18, 0.02);
  check('M at 0', sample(r.moment, 0), 0, 1e-2);
  check('M at L', sample(r.moment, L), 0, 1e-2);
  check('M at 5 (center)', sample(r.moment, 5), 18 * 5 - 6 * 3 * 1.5, 0.05);
}

// ============================================================
// Case 29: Guided support at right end + fixed at left + UDL
// Tests the guided support DOF constraint (θ=0, v free, R_V=0, R_M≠0)
// ============================================================
function case29() {
  header('Fixed at 0, GUIDED at L=4, UDL w=6 full span');
  const L = 4;
  const w = 6;
  const m = baseModel(L);
  m.supports = [
    { id: 's1', type: 'fixed', position: 0 },
    { id: 's2', type: 'guided', position: L },
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

  // Derived: R_V_0 = wL = 24. R_V_L = 0 (guided). R_M_0_applied = +wL²/3 = 32.
  // R_M_L_applied = wL²/6 = 16. Stored = -applied.
  check('R_V_0', r.reactions[0].V, w * L);
  check('R_V_L (guided)', r.reactions[1].V, 0, 1e-2);
  check('R_M_0', r.reactions[0].M, -(w * L * L) / 3, 0.1);
  check('R_M_L', r.reactions[1].M, -(w * L * L) / 6, 0.1);
  check('M at 0', sample(r.moment, 0), -(w * L * L) / 3, 0.1);
  // M(L-) from left = wL·L - wL²/3 - wL²/2 = wL²(1 - 1/3 - 1/2) = wL²/6.
  check('M at L (interior)', sample(r.moment, L), (w * L * L) / 6, 0.1);
  // Slope at L must be 0 (guided). Sampling slightly inside to avoid any edge effect.
  check('slope at L (guided)', sample(r.slope, L), 0, 1e-3);
  // Slope at 0 must also be 0 (fixed).
  check('slope at 0 (fixed)', sample(r.slope, 0), 0, 1e-3);
}

// ============================================================
// Case 30: Three-span continuous beam, UDL full length
// ============================================================
function case30() {
  header('3-span continuous beam L=18, supports 0/6/12/18, UDL w=10');
  const L = 18;
  const w = 10;
  const l = 6; // span length
  const m = baseModel(L);
  m.supports = [
    { id: 's1', type: 'pinned', position: 0 },
    { id: 's2', type: 'roller', position: 6 },
    { id: 's3', type: 'roller', position: 12 },
    { id: 's4', type: 'roller', position: L },
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

  // Classical: R_end = 0.4·wl = 24, R_interior = 1.1·wl = 66. M_over_interior = -wl²/10 = -36.
  check('R0', r.reactions[0].V, 0.4 * w * l, 0.1);
  check('R_mid1', r.reactions[1].V, 1.1 * w * l, 0.1);
  check('R_mid2', r.reactions[2].V, 1.1 * w * l, 0.1);
  check('RL', r.reactions[3].V, 0.4 * w * l, 0.1);
  check('M at mid support 1', sample(r.moment, 6), -(w * l * l) / 10, 0.1);
  check('M at mid support 2', sample(r.moment, 12), -(w * l * l) / 10, 0.1);
  check('M at 0', sample(r.moment, 0), 0, 0.02);
  check('M at L', sample(r.moment, L), 0, 0.02);
  // Max positive in middle span at center (x=9): wl²·1/40 = 9
  check('M_max(+) in middle span', sample(r.moment, 9), (w * l * l) / 40, 0.2);
}

// ============================================================
// Case 31: Double overhang (asymmetric support positions)
// ============================================================
function case31() {
  header('Asym overhang L=10, pin at 2, roller at 7, UDL w=10 full');
  const L = 10;
  const w = 10;
  const m = baseModel(L);
  m.supports = [
    { id: 's1', type: 'pinned', position: 2 },
    { id: 's2', type: 'roller', position: 7 },
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

  // ΣM_pin(2): R_roller·5 - w·10·3 = 0 → R_roller = 60. R_pin = 100 - 60 = 40.
  check('R_pin (x=2)', r.reactions[0].V, 40, 0.02);
  check('R_roller (x=7)', r.reactions[1].V, 60, 0.02);
  check('M at 0 (free)', sample(r.moment, 0), 0, 0.02);
  check('M at L (free)', sample(r.moment, L), 0, 0.02);
  // M at x=2 (pin): only voladizo [0,2] contributes: -w·2²/2 = -20.
  check('M at pin support (x=2)', sample(r.moment, 2), -20, 0.05);
  // M at x=7 (roller): -w·7²/2 + R_pin·5 = -245 + 200 = -45
  check('M at roller (x=7)', sample(r.moment, 7), -45, 0.05);
  // M at x=5 (between): -w·5²/2 + R_pin·3 = -125 + 120 = -5
  check('M at x=5', sample(r.moment, 5), -5, 0.05);
}

// ============================================================
// Case 32: Applied moment exactly AT a support position
// ============================================================
function case32() {
  header('SS beam L=10, CCW moment M0=20 applied at roller (x=L)');
  const L = 10;
  const M0 = 20;
  const m = baseModel(L);
  m.supports = [
    { id: 's1', type: 'pinned', position: 0 },
    { id: 's2', type: 'roller', position: L },
  ];
  // Moment at x=L (exactly at roller)
  m.moments = [{ id: 'm1', position: L, magnitude: M0, direction: 'ccw' }];
  const r = solve(m);

  // ΣM_0 (CCW+): R_L·L + M0 = 0 → R_L = -M0/L = -2. R_0 = +2.
  check('R0', r.reactions[0].V, M0 / L, 0.02);
  check('RL', r.reactions[1].V, -M0 / L, 0.02);
  // M(x) = R_0·x = (M0/L)·x for 0<x<L. M(L-) just before jump at L.
  // With applied moment AT L, the jump is at L. M(L-) = M0 (before jump).
  check('M at 0', sample(r.moment, 0), 0, 1e-2);
  check('M at L/2', sample(r.moment, L / 2), M0 / 2, 0.02);
  // M at x=L with atRightEnd fix: shows pre-jump interior value.
  check('M at L-ε', sample(r.moment, L - 0.01), M0, 0.05);
}

// ============================================================
// Case 33: Point load applied exactly AT a support
// ============================================================
function case33() {
  header('SS beam L=8, P=20 applied at roller (x=L)');
  const L = 8;
  const P = 20;
  const m = baseModel(L);
  m.supports = [
    { id: 's1', type: 'pinned', position: 0 },
    { id: 's2', type: 'roller', position: L },
  ];
  // Point load AT the roller
  m.loads = [
    { id: 'p1', type: 'point', position: L, magnitude: P, direction: 'down', loadCase: 'dead' },
  ];
  const r = solve(m);

  // Load directly on roller → R_L carries all of P. R_0 = 0.
  check('R0', r.reactions[0].V, 0, 0.02);
  check('RL', r.reactions[1].V, P, 0.02);
  // M anywhere = 0 (no bending anywhere, load goes directly into support).
  check('M at 0', sample(r.moment, 0), 0, 1e-2);
  check('M at L/2', sample(r.moment, L / 2), 0, 0.05);
  check('M at L', sample(r.moment, L), 0, 0.05);
}

// ============================================================
// Case 34: Very short beam (L = 0.5 m) — numerical stability
// ============================================================
function case34() {
  header('Very short SS beam L=0.5, P=10 at center');
  const L = 0.5;
  const P = 10;
  const m = baseModel(L);
  m.supports = [
    { id: 's1', type: 'pinned', position: 0 },
    { id: 's2', type: 'roller', position: L },
  ];
  m.loads = [
    { id: 'p1', type: 'point', position: L / 2, magnitude: P, direction: 'down', loadCase: 'dead' },
  ];
  const r = solve(m);

  check('R0', r.reactions[0].V, P / 2);
  check('RL', r.reactions[1].V, P / 2);
  check('M at center', sample(r.moment, L / 2), (P * L) / 4);
  check('M at 0', sample(r.moment, 0), 0, 1e-2);
  check('M at L', sample(r.moment, L), 0, 1e-2);
}

// ============================================================
// Case 35: Very long beam (L = 30 m) — numerical stability
// ============================================================
function case35() {
  header('Very long SS beam L=30, UDL w=5');
  const L = 30;
  const w = 5;
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

  const R = (w * L) / 2;
  check('R0', r.reactions[0].V, R);
  check('RL', r.reactions[1].V, R);
  check('M_max at center', sample(r.moment, L / 2), (w * L * L) / 8);
  const EI = 200000 * 1e6 * 1.12e8 * 1e-12;
  const delta = (5 * (w * 1000) * Math.pow(L, 4)) / (384 * EI);
  check('δ_max (mm)', Math.abs(sample(r.deflection, L / 2)), delta * 1000, 0.5);
}

// ============================================================
// Case 36: Non-integer support positions
// ============================================================
function case36() {
  header('SS beam L=10, pin at 1.5, roller at 8.5, UDL w=4 full');
  const L = 10;
  const w = 4;
  const aPin = 1.5;
  const aRoll = 8.5;
  const m = baseModel(L);
  m.supports = [
    { id: 's1', type: 'pinned', position: aPin },
    { id: 's2', type: 'roller', position: aRoll },
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

  // Symmetric positions: each support bears half the total load.
  // R_pin = R_roller = wL/2 = 20.
  check('R_pin', r.reactions[0].V, (w * L) / 2, 0.02);
  check('R_roller', r.reactions[1].V, (w * L) / 2, 0.02);
  check('M at 0 (free)', sample(r.moment, 0), 0, 0.02);
  check('M at L (free)', sample(r.moment, L), 0, 0.02);
  // Voladizo at left: UDL over [0, 1.5]. M at pin = -w·1.5²/2 = -4.5
  check('M at pin (x=1.5)', sample(r.moment, aPin), -4.5, 0.05);
  check('M at roller (x=8.5)', sample(r.moment, aRoll), -4.5, 0.05);
}

// ============================================================
// Case 37: Cantilever + triangular UDL (0 at fixed → w at tip)
// ============================================================
function case37() {
  header('Cantilever L=6, triangular UDL 0 at fixed → w=12 at tip');
  const L = 6;
  const w = 12;
  const m = baseModel(L);
  m.supports = [{ id: 's1', type: 'fixed', position: 0 }];
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

  // Total W = wL/2 = 36. Centroid at 2L/3 = 4 from fixed.
  const W = (w * L) / 2;
  const xc = (2 * L) / 3;
  check('R_V', r.reactions[0].V, W);
  // R_M = -W·xc = -36·4 = -144
  check('R_M', r.reactions[0].M, -W * xc, 0.1);
  check('M at 0', sample(r.moment, 0), -W * xc, 0.1);
  check('M at tip', sample(r.moment, L), 0, 0.02);

  const EI = 200000 * 1e6 * 1.12e8 * 1e-12;
  // δ_tip for triangular (0→w, max AT TIP) on cantilever: 11·wL⁴/(120·EI)
  // Load concentrated near free end, so maximum deflection is LARGER.
  const delta = (11 * (w * 1000) * Math.pow(L, 4)) / (120 * EI);
  check('δ at tip (mm)', Math.abs(sample(r.deflection, L)), delta * 1000, 0.2);
}

// ============================================================
// Case 38: Cantilever + triangular UDL (w at fixed → 0 at tip)
// ============================================================
function case38() {
  header('Cantilever L=6, triangular UDL w=12 at fixed → 0 at tip');
  const L = 6;
  const w = 12;
  const m = baseModel(L);
  m.supports = [{ id: 's1', type: 'fixed', position: 0 }];
  m.loads = [
    {
      id: 'd1',
      type: 'distributed',
      startPosition: 0,
      endPosition: L,
      startMagnitude: w,
      endMagnitude: 0,
      direction: 'down',
      loadCase: 'dead',
    },
  ];
  const r = solve(m);

  // Total W = wL/2 = 36. Centroid at L/3 = 2 from fixed.
  const W = (w * L) / 2;
  const xc = L / 3;
  check('R_V', r.reactions[0].V, W);
  check('R_M', r.reactions[0].M, -W * xc, 0.1);
  check('M at 0', sample(r.moment, 0), -W * xc, 0.1);
  check('M at tip', sample(r.moment, L), 0, 0.02);

  const EI = 200000 * 1e6 * 1.12e8 * 1e-12;
  // δ_tip for triangular (w→0, max AT FIXED) on cantilever: wL⁴/(30·EI)
  // Load concentrated near fixed end, so maximum deflection is SMALLER.
  const delta = ((w * 1000) * Math.pow(L, 4)) / (30 * EI);
  check('δ at tip (mm)', Math.abs(sample(r.deflection, L)), delta * 1000, 0.2);
}

// ============================================================
// Case 39: SS beam + upward point load + downward UDL (mixed direction)
// ============================================================
function case39() {
  header('SS beam L=10, UDL w=5 down full + P=30 UP at x=5');
  const L = 10;
  const w = 5;
  const P = 30;
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
    { id: 'p1', type: 'point', position: 5, magnitude: P, direction: 'up', loadCase: 'dead' },
  ];
  const r = solve(m);

  // Total vertical: wL down + P up = 50 - 30 = 20 net down. Symmetric → R = 10 each.
  check('R0', r.reactions[0].V, 10);
  check('RL', r.reactions[1].V, 10);
  // M at center: R_0·5 - w·5²/2 + 0 (P not yet at x=5-) = 50 - 62.5 = -12.5
  // With the UP load at 5, M(5) = R_0·5 - w·25/2 + 0 = -12.5. At x=5+: subtracts -P·(5-5) = 0 so same.
  check('M at 5 (with P lifting)', sample(r.moment, 5), -12.5, 0.05);
  check('M at 0', sample(r.moment, 0), 0, 1e-2);
  check('M at L', sample(r.moment, L), 0, 1e-2);
}

// ============================================================
// Case 40: Fixed + roller + roller (propped beam with interior support)
// ============================================================
function case40() {
  header('Fixed at 0, rollers at 4 and 8, UDL w=8 full (L=8)');
  const L = 8;
  const w = 8;
  const m = baseModel(L);
  m.supports = [
    { id: 's1', type: 'fixed', position: 0 },
    { id: 's2', type: 'roller', position: 4 },
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

  // Continuity at x=4 and x=8 with fixed end: this is a "propped" 2-span continuous with left end fixed.
  // Verify equilibrium only (exact numeric values are messier).
  const totalReactions = r.reactions.reduce((a, x) => a + x.V, 0);
  check('Sum of vertical reactions', totalReactions, w * L, 0.1);
  check('M at 0 (fixed end has hogging)', sample(r.moment, 0) < 0 ? -1 : 1, -1, 0);
  check('M at L (free-ish end, roller)', sample(r.moment, L), 0, 0.1);
}

// ============================================================
// Run all
// ============================================================
const cases = [
  case1, case2, case3, case4, case5, case6, case7, case8, case9, case10,
  case11, case12, case13, case14, case15, case16, case17, case18, case19, case20,
  case21, case22, case23, case24, case25, case26, case27, case28, case29, case30,
  case31, case32, case33, case34, case35, case36, case37, case38, case39, case40,
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
