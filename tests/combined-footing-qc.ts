/**
 * Combined Footing QC test suite — Phase B
 * -----------------------------------------
 *
 * Tests against:
 *   - Wight & MacGregor 7e §15-6 Example 15-5 (combined footing for two
 *     columns with property line constraint, pp. 838-847)
 *   - First-principles formulas from ACI 318-25 SI §13.3.4 + §22.6
 *
 * Run:   npx tsx tests/combined-footing-qc.ts
 */

import { analyzeCombinedFooting } from '../src/lib/combined-footing/solver';
import type { CombinedFootingInput } from '../src/lib/combined-footing/types';

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

// ─── Wight & MacGregor 7e Ex 15-5 ───────────────────────────────────────────
//
// Conversions (imperial → SI):
//   Exterior column: 24 × 16 in  →  610 × 406 mm
//   Interior column: 24 × 24 in  →  610 × 610 mm
//   Spacing 20 ft = 240 in       →  6096 mm  (centre-to-centre)
//   PD1 = 200 kips → 889.6 kN,  PL1 = 150 kips → 667.2 kN
//   PD2 = 300 kips → 1334.5 kN, PL2 = 225 kips → 1000.8 kN
//   qa = 5 ksf gross → 239 kPa
//   f'c = 3000 psi → 20.68 MPa, fy = 60 ksi → 413.7 MPa
//
// Wight's final design:
//   Footing 25.33 ft × 8 ft × 36 in  →  7722 × 2438 × 914 mm
//   Centroid at 152 in (3861 mm) from exterior face
//   qnu = 5.92 ksf → 283.4 kPa
//   Vu (punching at int. col) = 589 kips → 2620 kN
//   φVc (interior) ≈ 845 kips → 3760 kN

block('Wight Ex 15-5 — Combined footing (two columns, property line)', () => {
  // Reference origin: exterior face of exterior column at x = 0
  // Exterior col centerline: at 8 in from exterior face = 203 mm
  // Interior col centerline: at 8 + 240 = 248 in = 6299 mm

  const input: CombinedFootingInput = {
    code: 'ACI 318-25',
    column1: {
      cl: 610, ct: 406,         // 24 × 16 in: cl along longitudinal, ct transverse
      shape: 'rectangular',
      PD: 889.6, PL: 667.2,
      position: 203,             // 8 in from exterior face = 203 mm
      columnLocation: 'edge',    // exterior column
    },
    column2: {
      cl: 610, ct: 610,         // 24 × 24 in
      shape: 'square',
      PD: 1334.5, PL: 1000.8,
      position: 6299,            // 8 + 240 in = 248 in = 6299 mm
      columnLocation: 'interior',
    },
    geometry: {
      L: 7722,                   // 25.33 ft
      B: 2438,                   // 8 ft
      T: 914,                    // 36 in
      coverClear: 76,            // 3 in
      embedment: 305,            // 12 in fill + floor (approximate)
    },
    soil: { qa: 239, gammaSoil: 19, gammaConcrete: 24 },     // 5 ksf gross
    materials: { fc: 20.68, fy: 413.7, lambdaC: 1.0 },
    reinforcement: {
      // These will be design quantities; plug placeholders for now
      bottomLong: { bar: '#9', count: 14 },     // bottom-longitudinal (positive M)
      topLong: { bar: '#9', count: 14 },        // top-longitudinal (negative M)
      bottomTrans: { bar: '#7', count: 18 },    // bottom-transverse (under each col)
    },
  };

  const r = analyzeCombinedFooting(input);

  // Resultant location: (1556.8 · 203 + 2335.3 · 6299) / 3892.1
  //                  = (315,930 + 14,710,255) / 3892.1
  //                  = 15,026,185 / 3892.1 = 3861 mm ✓
  near('Resultant location ≈ 3861 mm from exterior face', r.bearing.xResultantFromLeft, 3861, 0.05);

  // qnu factored ≈ 5.92 ksf = 283.4 kPa
  // Pu1 = 1.2·889.6 + 1.6·667.2 = 1067.5 + 1067.5 = 2135.1 kN
  // Pu2 = 1.2·1334.5 + 1.6·1000.8 = 1601.4 + 1601.3 = 3202.7 kN
  // A = 7.722 × 2.438 = 18.83 m²
  // qnu = (2135.1 + 3202.7) / 18.83 = 283.5 kPa ✓
  near('qnu ≈ 283.4 kPa', r.qnu, 283.4, 0.02);

  // Punching at interior column (Vu = 589 kips → 2620 kN per Wight)
  // d = 914 - 76 - 28.65/2 ≈ 824 mm  (Wight uses 32.5 in = 826 mm)
  // bo = 4·(610 + 824) = 5736 mm  (Wight: 4·56.5 in = 226 in = 5740 mm) ✓
  // vc = 0.33·√20.68 = 1.501 MPa (= 219 psi) ✓
  // φVc = 0.75·1.501·5736·824/1000 = 5326 kN  (Wight: 845 kips·... let me recheck)
  // Wait Wight has φVc = 0.75·219·226·32.5 = 1,205,250 lbs = 1205 kips. Hmm.
  // Wait Wight says fvc = 164 psi (which is 0.75·219), not φVc.
  // φVc = 0.75 · vc · bo · d = 0.75·1.501·5736·824 / 1000 = 5325 kN ≈ 1196 kips
  near('Punching column 2: bo ≈ 5736 mm', r.punching2.bo, 5736, 0.02);
  near('Punching column 2: vc ≈ 1.501 MPa', r.punching2.vc, 1.501, 0.02);

  // Vu at interior column: Pu2 - qnu·A_punch
  // A_punch = (610 + 824)² = 1434² = 2,056,356 mm² = 2.056 m²
  // qnu·A_punch = 283.5·2.056 = 583 kN
  // Vu = 3202.7 - 583 = 2620 kN ≈ 589 kips ✓
  near('Punching column 2: Vu ≈ 2620 kN (Wight 589 kips)', r.punching2.Vu, 2620, 0.03);
  check('Punching column 2 passes', r.punching2.ok);

  // Beam analysis cross-validation against Wight's Fig 15-21.
  //
  // Sign convention: positive M = bottom tension (sagging). For a footing
  // with upward soil pressure + downward column loads, BETWEEN columns the
  // beam curves CONCAVE-DOWN (top tension) → NEGATIVE M (top reinforcement).
  // At cantilever ends the beam curves CONCAVE-UP (bottom tension) → POSITIVE
  // M (bottom reinforcement). Wight's "2100 kip·ft" label is the MAGNITUDE
  // of the negative span moment.
  //
  // Hand-calc with Pu1 = 2135 kN, Pu2 = 3203 kN, wu = 691 kN/m, L = 7.722 m:
  //   M at xc1     = 0.5·(wu·xc1)·xc1 = 14 kN·m            (small +)
  //   M at x* (V=0) = 14 + 0.5·(-1995)·(x*-xc1) = -2866 kN·m  (large −)
  //   M at xc2     = -2866 + 0.5·2217·(xc2-x*) = +690 kN·m    (medium +)
  //
  // Wight peaks: 2100 kip·ft = 2848 kN·m (between cols, top tension)
  //              516 kip·ft  = 700 kN·m  (right cantilever, bot. tension)
  near('|Mu−| ≈ 2848 kN·m (Wight 2100 kip·ft, between cols)',
       Math.abs(r.beam.Mu_neg_max), 2848, 0.05);
  near('Mu+ ≈ 690 kN·m (Wight 516 kip·ft, right cantilever)',
       r.beam.Mu_pos_max, 690, 0.10);

  // Bearing should pass
  check('Bearing passes (qmax ≤ qa)', r.bearing.ok);

  // Centroid offset is small (footing centered on resultant)
  check('Centroid offset < 50 mm (uniform pressure)', Math.abs(r.bearing.centroidOffset) < 50);
});

// ─── BLOCK 2: New Phase B checks (bar fit + dev length + bearing interface) ─

import { autoDesignCombinedFooting } from '../src/lib/combined-footing/autoDesign';

block('Phase B engine — bearing interface at each column (§22.8)', () => {
  // Use a heavy load that exceeds φBn,col to test transfer requirement
  const r = analyzeCombinedFooting({
    code: 'ACI 318-25',
    column1: { cl: 400, ct: 400, shape: 'square', PD: 800, PL: 600, position: 250, columnLocation: 'edge' },
    column2: { cl: 400, ct: 400, shape: 'square', PD: 1200, PL: 800, position: 4250, columnLocation: 'interior' },
    geometry: { L: 4500, B: 2200, T: 700, coverClear: 75, embedment: 400 },
    soil: { qa: 250 },
    materials: { fc: 25, fy: 420, lambdaC: 1.0 },
    reinforcement: {
      bottomLong: { bar: '#7', count: 12 },
      topLong: { bar: '#7', count: 10 },
      bottomTrans: { bar: '#5', count: 16 },
    },
  });
  check('Bearing interface column 1 computed', r.bearingInterface1.phiBn > 0);
  check('Bearing interface column 2 computed', r.bearingInterface2.phiBn > 0);
  // Column 2 has higher Pu so its ratio should be ≥ column 1's
  check('Column 2 ratio ≥ Column 1 ratio (heavier load)',
    r.bearingInterface2.ratio >= r.bearingInterface1.ratio);
});

block('Phase B engine — bar fit checks for all 3 layers', () => {
  const r = analyzeCombinedFooting({
    code: 'ACI 318-25',
    column1: { cl: 400, ct: 400, shape: 'square', PD: 600, PL: 400, position: 250 },
    column2: { cl: 400, ct: 400, shape: 'square', PD: 800, PL: 500, position: 4250 },
    geometry: { L: 4500, B: 2200, T: 700, coverClear: 75 },
    soil: { qa: 250 },
    materials: { fc: 25, fy: 420 },
    reinforcement: {
      bottomLong: { bar: '#7', count: 10 },
      topLong: { bar: '#7', count: 10 },
      bottomTrans: { bar: '#5', count: 12 },
    },
  });
  check('Bar fit bottom-long has s_clear', r.barFitBotLong.s_clear > 0);
  check('Bar fit top-long has s_clear', r.barFitTopLong.s_clear > 0);
  check('Bar fit bottom-trans has s_clear', r.barFitBotTrans.s_clear > 0);
});

block('Phase B engine — development length checks', () => {
  const r = analyzeCombinedFooting({
    code: 'ACI 318-25',
    column1: { cl: 400, ct: 400, shape: 'square', PD: 600, PL: 400, position: 250 },
    column2: { cl: 400, ct: 400, shape: 'square', PD: 800, PL: 500, position: 4250 },
    geometry: { L: 4500, B: 2200, T: 700, coverClear: 75 },
    soil: { qa: 250 },
    materials: { fc: 25, fy: 420 },
    reinforcement: {
      bottomLong: { bar: '#7', count: 10 },
      topLong: { bar: '#7', count: 10 },
      bottomTrans: { bar: '#5', count: 12 },
    },
  });
  check('Bottom-long ld > 0', r.developmentBotLong.ld > 0);
  check('Bottom-long ldh > 150', r.developmentBotLong.ldh >= 150);
  check('Bottom-trans ld > 0', r.developmentBotTrans.ld > 0);
});

block('Phase B auto-design — converges on light + heavy cases', () => {
  // Light case
  const r1 = autoDesignCombinedFooting({
    code: 'ACI 318-25',
    column1: { cl: 400, ct: 400, shape: 'square', PD: 400, PL: 200, position: 250, columnLocation: 'edge' },
    column2: { cl: 400, ct: 400, shape: 'square', PD: 500, PL: 300, position: 4250, columnLocation: 'interior' },
    geometry: { L: 1000, B: 1000, T: 300, coverClear: 75, embedment: 300 },     // placeholder; auto-design will override
    soil: { qa: 250 },
    materials: { fc: 25, fy: 420, lambdaC: 1.0 },
    reinforcement: {
      bottomLong: { bar: '#5', count: 4 },
      topLong: { bar: '#5', count: 4 },
      bottomTrans: { bar: '#5', count: 4 },
    },
  });
  check('Auto-design light: L > 1500 mm', r1.patchedInput.geometry.L > 1500);
  check('Auto-design light: T ≥ 450 mm', r1.patchedInput.geometry.T >= 450);
  check('Auto-design light: rationale steps generated', r1.rationaleSteps.length >= 4);

  // Heavy case
  const r2 = autoDesignCombinedFooting({
    code: 'ACI 318-25',
    column1: { cl: 600, ct: 600, shape: 'square', PD: 1500, PL: 1000, position: 300, columnLocation: 'edge' },
    column2: { cl: 700, ct: 700, shape: 'square', PD: 2500, PL: 1800, position: 7300, columnLocation: 'interior' },
    geometry: { L: 1000, B: 1000, T: 300, coverClear: 75, embedment: 400 },
    soil: { qa: 200 },
    materials: { fc: 28, fy: 420, lambdaC: 1.0 },
    reinforcement: {
      bottomLong: { bar: '#5', count: 4 },
      topLong: { bar: '#5', count: 4 },
      bottomTrans: { bar: '#5', count: 4 },
    },
  });
  check('Auto-design heavy: L > 7000 mm', r2.patchedInput.geometry.L > 7000);
  check('Auto-design heavy: T grew from 300', r2.patchedInput.geometry.T > 450);
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
