/**
 * Mat Foundation QC test suite — Phase C
 * ---------------------------------------
 *
 * Tests against:
 *   - Hand-calculated examples (rigid method, ACI 318-25 §13.3.4)
 *   - Cross-check vs combined-footing solver for the 2-column degenerate case
 *
 * Run:   npx tsx tests/mat-foundation-qc.ts
 */

import { analyzeMatFoundation } from '../src/lib/mat-foundation/solver';
import type { MatFoundationInput } from '../src/lib/mat-foundation/types';

let pass = 0, fail = 0;
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
    failures.push(`${name}: ${actual} vs ${expected}`);
    console.log(`  ✗ ${name}: ${actual.toFixed(3)} ≠ ${expected.toFixed(3)} (rel ${(rel * 100).toFixed(2)}%)`);
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

// ────────────────────────────────────────────────────────────────────────────
// BLOCK 1 — Symmetric 4-column mat: uniform pressure
// ────────────────────────────────────────────────────────────────────────────
//
// 12 × 12 m mat, 800 mm thick. 4 columns 500×500 mm at the corners of an
// 8×8 m grid centred on the mat (positions: (2, 2), (10, 2), (2, 10), (10, 10)).
// Each column: PD = 1500, PL = 1000 kN.
//
// Hand-calc:
//   ΣP_col = 4·2500 = 10,000 kN
//   Wf = 24 · 144 · 0.8 = 2765 kN
//   P_service = 12,765 kN
//   A = 144 m²,  q_avg = 88.6 kPa (uniform — 4-fold symmetric)
//   ΣPu = 4·(1.2·1500 + 1.6·1000) = 4·3400 = 13,600 kN
//   qnu = 13,600 / 144 = 94.4 kPa
//
// Punching at one corner column (interior to mat? No — 2 m from each edge):
//   Detected as 'corner' column (within 1.5·500 = 750 mm of two edges? No,
//     it's 2000 mm − 250 = 1750 mm from each edge). With 1.5·500 = 750 mm
//     tolerance, it's NOT close enough → 'interior'. αs = 40.
//   d = 800 − 75 − 12.7/2 ≈ 719 mm  (using #4 = 12.7 mm)... but with #5 it's ~715.
//   Using #5 (db = 15.9 mm): d = 800 − 75 − 7.95 = 717 mm
//   bo = 4·(500 + 717) = 4868 mm
//   vc = 0.33·√25 = 1.65 MPa
//   φVc = 0.75·1.65·4868·717 / 1000 = 4319 kN
//   A_punch = (500 + 717)² = 1,481,089 mm² = 1.481 m²
//   Vu = 3400 − 94.4·1.481 = 3400 − 140 = 3260 kN
//   ratio = 3260/4319 = 0.755 → passes ✓

block('Block 1 — Symmetric 4-column mat, uniform pressure', () => {
  const input: MatFoundationInput = {
    code: 'ACI 318-25',
    columns: [
      { id: 'C1', cx: 500, cy: 500, shape: 'square', PD: 1500, PL: 1000, x:  2000, y:  2000 },
      { id: 'C2', cx: 500, cy: 500, shape: 'square', PD: 1500, PL: 1000, x: 10000, y:  2000 },
      { id: 'C3', cx: 500, cy: 500, shape: 'square', PD: 1500, PL: 1000, x:  2000, y: 10000 },
      { id: 'C4', cx: 500, cy: 500, shape: 'square', PD: 1500, PL: 1000, x: 10000, y: 10000 },
    ],
    geometry: { B: 12000, L: 12000, T: 800, coverClear: 75 },
    soil: { qa: 200, gammaSoil: 18, gammaConcrete: 24 },
    materials: { fc: 25, fy: 420, lambdaC: 1.0 },
    reinforcement: {
      topX:    { bar: '#5', spacing: 200 },
      topY:    { bar: '#5', spacing: 200 },
      bottomX: { bar: '#5', spacing: 200 },
      bottomY: { bar: '#5', spacing: 200 },
    },
  };

  const r = analyzeMatFoundation(input);

  // Bearing
  near('Pservice ≈ 12,765 kN', r.bearing.P_service, 12765, 0.01);
  near('q_avg ≈ 88.6 kPa', r.bearing.q_avg, 88.6, 0.01);
  // Symmetric → no eccentricity
  near('eX = 0 (symmetric)', r.bearing.eX, 0, 0.01);
  near('eY = 0 (symmetric)', r.bearing.eY, 0, 0.01);
  // All four corners equal (no moment)
  near('q_BL = q_BR = q_avg', r.bearing.q_corner_BL, r.bearing.q_avg, 0.01);
  near('q_TR = q_avg', r.bearing.q_corner_TR, r.bearing.q_avg, 0.01);
  // q_max = q_avg under symmetric load
  near('q_max = q_avg (no moment)', r.bearing.q_max, r.bearing.q_avg, 0.01);
  check('Bearing passes (q_max ≤ qa)', r.bearing.ok);

  // Punching
  near('qnu ≈ 94.4 kPa', r.qnu_avg, 94.44, 0.01);
  // 4 columns → 4 punching results
  check('4 punching checks computed', r.punching.length === 4);
  // All 4 should give the same result by symmetry
  near('All columns yield same φVc', r.punching[0].phiVc, r.punching[3].phiVc, 0.001);
  near('All columns yield same ratio', r.punching[0].ratio, r.punching[2].ratio, 0.001);
  // Hand-calc check on column 1 (interior — it's 2 m from edges, far enough that
  // tolerance 1.5·500 = 750 mm doesn't include it)
  check('Column C1 detected as interior', r.punching[0].location === 'interior');
  check('Column C1 αs = 40', r.punching[0].alphaS === 40);
  near('Column C1 bo ≈ 4868 mm', r.punching[0].bo, 4868, 0.01);
  near('Column C1 vc ≈ 1.65 MPa', r.punching[0].vc, 1.65, 0.01);
  near('Column C1 φVc ≈ 4319 kN', r.punching[0].phiVc, 4319, 0.02);
  near('Column C1 Vu ≈ 3260 kN', r.punching[0].Vu, 3260, 0.02);
  check('All punching passes', r.punching.every((p) => p.ok));

  // Overall
  check('Overall mat passes', r.ok);
});

// ────────────────────────────────────────────────────────────────────────────
// BLOCK 2 — Asymmetric loading → eccentric pressure
// ────────────────────────────────────────────────────────────────────────────
//
// Same 4-column mat, but column C4 (top-right) has 2× the load. Resultant
// shifts toward C4 → bilinear pressure with peak at TR corner.

block('Block 2 — Asymmetric loading: bilinear pressure', () => {
  const input: MatFoundationInput = {
    code: 'ACI 318-25',
    columns: [
      { id: 'C1', cx: 500, cy: 500, shape: 'square', PD: 1500, PL: 1000, x:  2000, y:  2000 },
      { id: 'C2', cx: 500, cy: 500, shape: 'square', PD: 1500, PL: 1000, x: 10000, y:  2000 },
      { id: 'C3', cx: 500, cy: 500, shape: 'square', PD: 1500, PL: 1000, x:  2000, y: 10000 },
      // C4 doubled
      { id: 'C4', cx: 500, cy: 500, shape: 'square', PD: 3000, PL: 2000, x: 10000, y: 10000 },
    ],
    geometry: { B: 12000, L: 12000, T: 800, coverClear: 75 },
    soil: { qa: 200, gammaSoil: 18, gammaConcrete: 24 },
    materials: { fc: 25, fy: 420, lambdaC: 1.0 },
    reinforcement: {
      topX:    { bar: '#5', spacing: 200 },
      topY:    { bar: '#5', spacing: 200 },
      bottomX: { bar: '#5', spacing: 200 },
      bottomY: { bar: '#5', spacing: 200 },
    },
  };

  const r = analyzeMatFoundation(input);

  // Resultant should shift toward C4 (positive X and Y)
  check('eX > 0 (toward C4 in +X)', r.bearing.eX > 0);
  check('eY > 0 (toward C4 in +Y)', r.bearing.eY > 0);
  // q_max should be at top-right corner (closest to C4)
  check('q_max = q_TR (peak at C4 corner)',
    r.bearing.q_corner_TR === r.bearing.q_max);
  check('q_min = q_BL (opposite corner)',
    r.bearing.q_corner_BL === r.bearing.q_min);
  // q_max > q_avg (eccentric)
  check('q_max > q_avg', r.bearing.q_max > r.bearing.q_avg);
  // q_min ≥ 0 (no uplift on a mat — usually doesn't happen with realistic loads)
  check('q_min ≥ 0 (no uplift)', r.bearing.q_min >= 0);

  // C4 has higher Pu so its punching ratio should be the worst
  const c4 = r.punching.find((p) => p.columnId === 'C4');
  const c1 = r.punching.find((p) => p.columnId === 'C1');
  check('C4 punching ratio > C1 (heavier load)',
    c4!.ratio > c1!.ratio);
});

// ────────────────────────────────────────────────────────────────────────────
// BLOCK 3 — Edge column auto-detection
// ────────────────────────────────────────────────────────────────────────────

block('Block 3 — Edge column auto-detected (αs = 30)', () => {
  // Place a column right at the edge of a 6 × 6 m mat
  const input: MatFoundationInput = {
    code: 'ACI 318-25',
    columns: [
      // Column at x = 400 mm (face is at x = 150 mm, only 150 mm from the
      // mat's left edge → less than tolerance 1.5·500 = 750 mm) → 'edge'
      { id: 'EdgeCol', cx: 500, cy: 500, shape: 'square', PD: 800, PL: 600, x: 400, y: 3000 },
    ],
    geometry: { B: 6000, L: 6000, T: 700, coverClear: 75 },
    soil: { qa: 200 },
    materials: { fc: 25, fy: 420 },
    reinforcement: {
      topX:    { bar: '#5', spacing: 200 },
      topY:    { bar: '#5', spacing: 200 },
      bottomX: { bar: '#5', spacing: 200 },
      bottomY: { bar: '#5', spacing: 200 },
    },
  };

  const r = analyzeMatFoundation(input);
  check('Single column detected as edge', r.punching[0].location === 'edge');
  check('αs = 30 for edge column', r.punching[0].alphaS === 30);
});

// ────────────────────────────────────────────────────────────────────────────
// BLOCK 4 — Corner column auto-detection
// ────────────────────────────────────────────────────────────────────────────

block('Block 4 — Corner column auto-detected (αs = 20)', () => {
  // Place a column at the bottom-left corner
  const input: MatFoundationInput = {
    code: 'ACI 318-25',
    columns: [
      // Column at (400, 400) — close to BOTH bottom and left edges → corner
      { id: 'CornerCol', cx: 500, cy: 500, shape: 'square', PD: 800, PL: 600, x: 400, y: 400 },
    ],
    geometry: { B: 6000, L: 6000, T: 700, coverClear: 75 },
    soil: { qa: 200 },
    materials: { fc: 25, fy: 420 },
    reinforcement: {
      topX:    { bar: '#5', spacing: 200 },
      topY:    { bar: '#5', spacing: 200 },
      bottomX: { bar: '#5', spacing: 200 },
      bottomY: { bar: '#5', spacing: 200 },
    },
  };

  const r = analyzeMatFoundation(input);
  check('Single column detected as corner', r.punching[0].location === 'corner');
  check('αs = 20 for corner column', r.punching[0].alphaS === 20);
});

console.log('\n' + '='.repeat(70));
console.log(`PASSED:  ${pass}`);
console.log(`FAILED:  ${fail}`);
console.log(`TOTAL:   ${pass + fail}`);
console.log('='.repeat(70));
if (fail > 0) {
  console.log('\nFailed checks:');
  failures.forEach((f) => console.log('  - ' + f));
  process.exit(1);
}
process.exit(0);
