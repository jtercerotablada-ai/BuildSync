/**
 * Base Plate Design — quality-control test suite
 *
 * Tests against worked examples from AISC Design Guide 1, 3rd Edition (2024)
 * by Kanvinde, Maamouri, Buckholt. Each test reproduces the exact inputs and
 * expected numerical outputs from the textbook (within tolerance).
 *
 * Run:   npx tsx tests/baseplate-qc.ts
 */

import { analyze } from '../src/lib/baseplate/solver';
import type { BasePlateInput } from '../src/lib/baseplate/types';

let pass = 0;
let fail = 0;
const failures: string[] = [];

function block(title: string, fn: () => void) {
  console.log(`\n▶ ${title}`);
  fn();
}

function near(name: string, actual: number, expected: number, tol = 0.05) {
  const rel = Math.abs(actual - expected) / Math.max(Math.abs(expected), 1e-9);
  const ok = rel <= tol;
  if (ok) {
    pass++;
    console.log(`  ✓ ${name}: ${actual.toFixed(3)} ≈ ${expected.toFixed(3)} (rel ${(rel * 100).toFixed(2)}%)`);
  } else {
    fail++;
    const msg = `  ✗ ${name}: ${actual.toFixed(3)} ≠ ${expected.toFixed(3)} (rel ${(rel * 100).toFixed(2)}%)`;
    failures.push(`${name}: ${actual} vs ${expected}`);
    console.log(msg);
  }
}

function check(name: string, ok: boolean) {
  if (ok) {
    pass++;
    console.log(`  ✓ ${name}`);
  } else {
    fail++;
    failures.push(name);
    console.log(`  ✗ ${name}`);
  }
}

// ============================================================================
// EXAMPLE 4.7-1 — Concentric Axial Compression (no concrete confinement)
// ============================================================================
// W12X65 column, A992 (Fy=50)
// Pu = 700 kips (LRFD), Pa = 466 kips (ASD)
// Plate: A572 Gr 50, B = 18, N = 20 in (initial trial)
// Concrete: f'c = 4 ksi, footing larger than plate (so √(A2/A1) = 1, no confinement)
// Anchors: 4 - 3/4" F1554 Gr 36
//
// Expected from book (LRFD):
//   m = (20 - 0.95·12.1) / 2 = 4.25 in   (book: 4.25)
//   n = (18 - 0.8·12.0) / 2 = 4.20 in    (book: 4.20)
//   tp,min = 1.49·m·√(2·Pu / (BN·Fy))   (with fp = Pu/A1)
// ============================================================================
block('DG1 Example 4.7-1 — Axial Compression (no confinement, W12X65)', () => {
  const input: BasePlateInput = {
    code: 'AISC 360-22 + ACI 318-25',
    method: 'LRFD',
    column: { shape: 'W', label: 'W12X65', d: 12.10, bf: 12.00, tf: 0.605, tw: 0.390, Fy: 50 },
    plate:  { B: 18, N: 20, tp: 1.5, tpAuto: false, Fy: 50 },
    concrete: { fc: 4, B2: 18, N2: 20, lambdaA: 1.0, cracked: true },  // A2 = A1, no confinement
    anchors: {
      N: 4, da: 0.75, grade: 'F1554-36', termination: 'hex-nut',
      hef: 12, sx: 14, sy: 16, edgeDist: 2,
    },
    loads: { Pu: 700, Mu: 0, Vu: 0 },
    weld:  { electrode: 'E70', size: 0.25, auto: true },
  };
  const r = analyze(input);
  check('solved without errors', r.solved);
  check('classified as compression', r.loadCase === 'compression');
  near('m', r.plateYielding!.m, 4.25, 0.02);
  near('n', r.plateYielding!.n, 4.20, 0.02);
  near("n'", r.plateYielding!.nPrime, 3.01, 0.05);  // (1/4)·√(12.1·12.0) = 3.01
  // fp = Pu/A1 = 700/360 = 1.944 ksi
  near('fp uniform', r.plateYielding!.fp, 1.944, 0.02);
  // tp,req = l · √(2·fp / (φ·Fy)) = 4.25 · √(2·1.944 / (0.9·50)) = 4.25 · 0.294 = 1.249 in
  near('tp,req', r.plateYielding!.tpReq, 1.25, 0.05);
  // Bearing: φc·Pp = 0.65 · 0.85·4·360·1 = 795.6 kips > 700 ✓
  near('φPp bearing', r.bearing!.PpAvail, 795.6, 0.02);
  check('bearing OK', r.bearing!.ok);
});

// ============================================================================
// EXAMPLE 4.7-3 — Concentric Axial Tension
// ============================================================================
// W10X45 column, A992 (Fy=50)
// Pu = 70 kips uplift (LRFD)
// Plate: A572 Gr 50
// Anchors: 4 - 7/8" F1554 Gr 36, large spread footing (no edge effects)
// 4" square anchor pattern (g = 4")
//
// Expected from book (LRFD):
//   ru per rod = 70/4 = 17.5 kips
//   Ase,N (7/8") = 0.462 in²
//   Nsa = 58·0.462 = 26.8 kips
//   φNsa = 0.75·26.8 = 20.1 kips > 17.5 ✓
//   Embedment hef = 15 in for breakout > 70 kips
//     ANc = (45 + 4)·(45 + 4) = 2401 in² (book says 2400)
//     ANco = 9·15² = 2025 in² (book: 2030)
//     Nb = 16·1·√4000·15^(5/3) /1000 = 99.4 kips approx (book uses different formula?)
//     Ncbg = (2400/2025)·1·1·1·1·Nb
//   Heavy hex nut pullout for 7/8" rod from Table 4-2 = 26.7 kips > 17.5 ✓
// ============================================================================
block('DG1 Example 4.7-3 — Axial Tension (W10X45, 4·7/8" F1554-36)', () => {
  const input: BasePlateInput = {
    code: 'AISC 360-22 + ACI 318-25',
    method: 'LRFD',
    column: { shape: 'W', label: 'W10X45', d: 10.10, bf: 8.02, tf: 0.620, tw: 0.350, Fy: 50 },
    plate:  { B: 14, N: 14, tp: 1.0, tpAuto: false, Fy: 50 },
    concrete: { fc: 4, B2: 100, N2: 100, lambdaA: 1.0, cracked: true },  // very large footing
    anchors: {
      N: 4, da: 0.875, grade: 'F1554-36', termination: 'hex-nut',
      hef: 15, sx: 4, sy: 4, edgeDist: 5,
    },
    loads: { Pu: -70, Mu: 0, Vu: 0 },     // -ve = uplift / tension
    weld:  { electrode: 'E70', size: 0.1875, auto: true },
  };
  const r = analyze(input);
  check('solved without errors', r.solved);
  check('classified as tension', r.loadCase === 'tension');
  // Anchor steel tension
  near('ru per rod', r.anchorTension!.ru, 17.5, 0.02);
  near('Nsa per rod', r.anchorTension!.Nsa, 26.8, 0.02);
  near('φNsa per rod', r.anchorTension!.NsaAvail, 20.1, 0.02);
  check('anchor steel OK', r.anchorTension!.ok);
  // Concrete pullout (hex nut, da = 7/8")
  // Abrg(7/8") = 1.184 in², Np = 8·1.184·4000/1000 = 37.9 kips
  // φ·ψcp·Np = 0.70·1.0·37.9 = 26.5 kips > 17.5 ✓
  near('Np pullout (hex nut)', r.concretePullout!.Np, 37.9, 0.05);
  check('pullout OK', r.concretePullout!.ok);
  // Concrete breakout
  // ANc = (3·15 + 4)·(3·15 + 4) = 49·49 = 2401 in² (book 2400)
  near('ANc', r.concreteBreakout!.ANc, 2400, 0.05);
  near('ANco', r.concreteBreakout!.ANco, 2025, 0.05);
});

// ============================================================================
// EXAMPLE 4.7-11 — Combined Axial Compression + Large Moment
// ============================================================================
// W12X87 column, A992
// Pu = 376 kips, Mu = 3,600 kip·in (LRFD); e = Mu/Pu = 9.57 in
// Plate: A572 Gr 50, second iteration N = 24, B = 22
// Concrete: f'c = 4 ksi, A2/A1 = 4 (full confinement), so fp,max = 1.7·4 = 6.8 ksi
//   With φc = 0.65: φc·fp,max = 4.42 ksi… book reports fp,max = 2.21 ksi
//   This is because the plate has no confinement gain (fp,max = 0.85·fc·1 = 3.4 with φ=0.65 → 2.21)
//   So A2 ≈ A1.
// Anchors: 1" F1554 Gr 36, edge distance = 1.5" then revised to 2.75"
//
// Expected after iteration with edgeDist = 2.75" (final):
//   f = 24/2 - 2.75 = 9.25 in
//   qmax = 2.21·22 = 48.6 kip/in
//   ecrit = 24/2 - 376/(2·48.6) = 8.13 in  (book confirms)
//   e = 9.57 > ecrit → LARGE moment
//   Y = 8.60 in, T = 42.0 kips (book exact match)
// ============================================================================
block('DG1 Example 4.7-11 — Large Moment (W12X87, Pu=376, Mu=3600)', () => {
  const input: BasePlateInput = {
    code: 'AISC 360-22 + ACI 318-25',
    method: 'LRFD',
    column: { shape: 'W', label: 'W12X87', d: 12.50, bf: 12.10, tf: 0.810, tw: 0.515, Fy: 50 },
    plate:  { B: 22, N: 24, tp: 2.0, tpAuto: false, Fy: 50 },
    // A2 = A1 → no confinement gain, fp,max = 0.85·fc = 3.4 ksi nominal,
    // φc·fp,max = 0.65·3.4 = 2.21 ksi available
    concrete: { fc: 4, B2: 22, N2: 24, lambdaA: 1.0, cracked: true },
    anchors: {
      N: 4, da: 1.0, grade: 'F1554-36', termination: 'hex-nut',
      hef: 18, sx: 12, sy: 16.5, edgeDist: 2.75,
    },
    loads: { Pu: 376, Mu: 3600, Vu: 0 },
    weld:  { electrode: 'E70', size: 0.25, auto: true },
  };
  const r = analyze(input);
  check('solved without errors', r.solved);
  check('classified as large-moment compression', r.loadCase === 'compression+moment-high');
  near('eccentricity e', r.momentInteraction!.e, 9.57, 0.02);
  near('qmax', r.momentInteraction!.qmax, 48.6, 0.05);
  near('ecrit', r.momentInteraction!.ecrit, 8.13, 0.05);
  check('large moment classification', r.momentInteraction!.largeMoment);
  near('Y bearing length', r.momentInteraction!.Y, 8.60, 0.10);
  near('T anchor tension', r.momentInteraction!.T, 42.0, 0.10);
});

// ============================================================================
// SANITY CHECKS — non-textbook checks for solver behaviour
// ============================================================================
block('Sanity — pure compression, oversized plate', () => {
  const r = analyze({
    code: 'AISC 360-22 + ACI 318-25', method: 'LRFD',
    column: { shape: 'W', label: 'W10X45', d: 10.1, bf: 8.02, tf: 0.62, tw: 0.35, Fy: 50 },
    plate: { B: 16, N: 16, tp: 1.0, tpAuto: false, Fy: 50 },
    concrete: { fc: 4, B2: 32, N2: 32, lambdaA: 1.0, cracked: true },
    anchors: { N: 4, da: 0.75, grade: 'F1554-36', termination: 'hex-nut', hef: 12, sx: 12, sy: 12, edgeDist: 2 },
    loads: { Pu: 100, Mu: 0, Vu: 0 },
    weld: { electrode: 'E70', size: 0.25, auto: true },
  });
  check('low load passes bearing', r.bearing!.ok);
  check('thick plate passes flexure', r.plateYielding!.ok);
  check('no anchor tension demand', r.anchorTension === undefined);
  check('overall pass', r.ok);
});

block('Sanity — overload triggers fail flag', () => {
  const r = analyze({
    code: 'AISC 360-22 + ACI 318-25', method: 'LRFD',
    column: { shape: 'W', label: 'W10X45', d: 10.1, bf: 8.02, tf: 0.62, tw: 0.35, Fy: 50 },
    plate: { B: 10, N: 10, tp: 0.5, tpAuto: false, Fy: 50 },
    concrete: { fc: 3, B2: 10, N2: 10, lambdaA: 1.0, cracked: true },
    anchors: { N: 4, da: 0.75, grade: 'F1554-36', termination: 'hex-nut', hef: 8, sx: 6, sy: 6, edgeDist: 2 },
    loads: { Pu: 600, Mu: 0, Vu: 0 },     // way over capacity
    weld: { electrode: 'E70', size: 0.25, auto: true },
  });
  check('overload fails bearing', !r.bearing!.ok);
  check('thin plate fails flexure', !r.plateYielding!.ok);
  check('overall fails', !r.ok);
});

// ============================================================================
// Summary
// ============================================================================
console.log('\n' + '='.repeat(60));
console.log(`PASSED:  ${pass}`);
console.log(`FAILED:  ${fail}`);
console.log(`TOTAL:   ${pass + fail}`);
console.log('='.repeat(60));
if (fail > 0) {
  console.log('\nFailed checks:');
  failures.forEach((f) => console.log('  - ' + f));
  process.exit(1);
}
process.exit(0);
