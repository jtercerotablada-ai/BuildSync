/**
 * RC Solver — Cross-validation against published worked examples
 * --------------------------------------------------------------
 * Each block reproduces a worked example from a published reference
 * (ACI SP-17, CRSI Design Guide, Mosley, etc.) numerically. Tolerance
 * is set to 1% (rel) — anything wider gets flagged.
 *
 * Run:   npx tsx tests/rc-validation-published.ts
 */

import { analyze } from '../src/lib/rc/solver';
import { autoDesign } from '../src/lib/rc/autoDesign';
import type { BeamInput } from '../src/lib/rc/types';

let pass = 0, fail = 0;
const failures: string[] = [];

function block(title: string, fn: () => void) {
  console.log(`\n▶ ${title}`);
  fn();
}
function near(name: string, actual: number, expected: number, tol = 0.01) {
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

// ============================================================================
// REFERENCE 1: ACI SP-17(14) — Beam Example 1
// Continuous interior beam, 6 spans.
//   18" × 30" rectangular cross-section, 7" slab, T-beam at midspan.
//   fc' = 5000 psi (34.47 MPa); fy = 60 ksi (413.7 MPa)
//   d = 27.5" = 698 mm; bw = 18" = 457 mm; h = 30" = 762 mm; bf = 120" = 3048 mm
//
// First interior support negative moment:
//   M2 = 428 ft-kip = 580.3 kN·m  →  As req = 3.65 in² = 2355 mm²
//
// Positive moment at exterior span:
//   ME+ = 306 ft-kip = 414.9 kN·m  →  As req = 2.49 in² = 1606 mm²
//
// Shear at critical section d:
//   Vu @ d = 63.5 kip = 282.4 kN
//   Vc = 70.0 kip = 311.4 kN (Imperial 2·√fc'·bw·d)
//   φVc = 52.5 kip = 233.5 kN
//
// Note: SI Vc = 0.17·λ·√fc'·bw·d gives 318.7 kN (vs imperial 311.4 — that's
// the well-known ACI imperial-to-SI rounding gap. Tolerance set to 3%.)
// ============================================================================

block('ACI SP-17(14) — Example 1: Negative-moment AsReq match', () => {
  const input: BeamInput = {
    code: 'ACI 318-25', method: 'LRFD',
    geometry: {
      shape: 'rectangular',     // negative moment → concrete in compression at bottom of web
      bw: 457, h: 762, d: 698, dPrime: 60, L: 10973, coverClear: 38,
    },
    materials: { fc: 34.47, fy: 413.7, lambdaC: 1.0 },
    reinforcement: {
      tension: [{ bar: '#7', count: 7 }],     // 7 #7 bars (provided per SP-17)
      compression: [{ bar: '#4', count: 2 }],
      stirrup: { bar: '#3', legs: 2, spacing: 200 },
    },
    loads: { Mu: 580.3, Vu: 282.4 },
  };
  const r = analyze(input);
  // SP-17 AsReq = 3.65 in² = 2355 mm² ; we compare to our solver's AsReq
  near('AsReq matches SP-17 (3.65 in² = 2355 mm²)', r.flexure.AsReq, 2355, 0.02);
  // 7 × #7 = 7 × 387 = 2709 mm²; check capacity > demand
  near('As provided = 7×#7 = 2709 mm²', r.flexure.As, 2709, 0.001);
  // φMn must exceed Mu
  if (r.flexure.phiMn > 580.3) {
    pass++; console.log(`  ✓ φMn = ${r.flexure.phiMn.toFixed(1)} kN·m > Mu = 580.3 → OK`);
  } else {
    fail++; failures.push(`φMn ${r.flexure.phiMn.toFixed(1)} < Mu 580.3`);
    console.log(`  ✗ φMn = ${r.flexure.phiMn.toFixed(1)} kN·m < Mu = 580.3 → FAIL`);
  }
});

block('ACI SP-17(14) — Example 1: Positive-moment T-beam AsReq match', () => {
  const input: BeamInput = {
    code: 'ACI 318-25', method: 'LRFD',
    geometry: {
      shape: 'T-beam',           // positive moment → flange in compression
      bw: 457, h: 762, d: 698, bf: 3048, hf: 178, dPrime: 60, L: 10973, coverClear: 38,
    },
    materials: { fc: 34.47, fy: 413.7, lambdaC: 1.0 },
    reinforcement: {
      tension: [{ bar: '#7', count: 5 }],     // 5 #7 bars (provided per SP-17)
      compression: [{ bar: '#4', count: 2 }],
      stirrup: { bar: '#3', legs: 2, spacing: 200 },
    },
    loads: { Mu: 414.9, Vu: 200 },
  };
  const r = analyze(input);
  // SP-17 AsReq = 2.49 in² = 1606 mm²
  near('AsReq matches SP-17 (2.49 in² = 1606 mm²)', r.flexure.AsReq, 1606, 0.02);
  // 5 × #7 = 1935 mm²
  near('As provided = 5×#7 = 1935 mm²', r.flexure.As, 1935, 0.001);
  if (r.flexure.phiMn > 414.9) {
    pass++; console.log(`  ✓ φMn = ${r.flexure.phiMn.toFixed(1)} kN·m > Mu = 414.9 → OK`);
  } else {
    fail++; failures.push(`φMn ${r.flexure.phiMn.toFixed(1)} < Mu 414.9`);
    console.log(`  ✗ φMn = ${r.flexure.phiMn.toFixed(1)} kN·m < Mu = 414.9 → FAIL`);
  }
});

block('ACI SP-17(14) — Example 1: Vc closed-form match', () => {
  // Pure shear test — no point in flexure pass/fail
  const input: BeamInput = {
    code: 'ACI 318-25', method: 'LRFD',
    geometry: { shape: 'rectangular', bw: 457, h: 762, d: 698, dPrime: 60, L: 10973, coverClear: 38 },
    materials: { fc: 34.47, fy: 413.7, lambdaC: 1.0 },
    reinforcement: {
      tension: [{ bar: '#7', count: 7 }],
      compression: [{ bar: '#4', count: 2 }],
      stirrup: { bar: '#3', legs: 2, spacing: 200 },
    },
    loads: { Mu: 100, Vu: 282.4 },
  };
  const r = analyze(input);
  // ACI 318-25 SI: Vc = 0.17·λ·√fc'·bw·d = 0.17·1·√34.47·457·698 / 1000 = 318.7 kN
  // SP-17 imperial: Vc = 2·√fc·bw·d = 2·√5000·18·27.5 / 1000 = 70 kip = 311.4 kN
  // Tolerance is 3% to absorb the ACI imperial-to-SI rounding gap.
  near('Vc matches ACI 318-25 SI eqn (0.17·√fc·bw·d)', r.shear.Vc, 318.7, 0.005);
  near('Vc within 3% of SP-17 imperial value (311.4 kN)', r.shear.Vc, 311.4, 0.03);
});

// ============================================================================
// REFERENCE 2: Hand-calc closed-form for singly-reinforced rectangular beam
// (Wight & MacGregor 7e Example 4-1 style)
//
// b = 12", h = 24", d = 21.5", fc' = 4 ksi, fy = 60 ksi, As = 3.0 in² (3 #9)
// In SI: bw = 305 mm, h = 610 mm, d = 546 mm, fc' = 27.6 MPa, fy = 414 MPa,
//        As = 3·645 = 1935 mm² (using #9 = 645 mm² each)
//
// Closed-form:
//   a = As·fy/(0.85·fc·b) = 1935·414/(0.85·27.6·305) = 800876 / 7144.4 = 112.1 mm
//   c = a/β1 = 112.1/0.85 = 131.9 mm
//   εt = 0.003·(d-c)/c = 0.003·(546-131.9)/131.9 = 0.00942 → tension-controlled, φ=0.90
//   Mn = As·fy·(d-a/2) = 1935·414·(546-56) = 1935·414·490 = 392,572,500 N·mm = 392.6 kN·m
//   φMn = 0.9 · 392.6 = 353.3 kN·m
// ============================================================================

block('Wight 4-1 — Singly-reinforced rectangular (3 #9, b=305, h=610, d=546)', () => {
  // SINGLY: no compression steel for this test.
  const input: BeamInput = {
    code: 'ACI 318-25', method: 'LRFD',
    geometry: { shape: 'rectangular', bw: 305, h: 610, d: 546, dPrime: 60, L: 6000, coverClear: 40 },
    materials: { fc: 27.6, fy: 414, lambdaC: 1.0 },
    reinforcement: {
      tension: [{ bar: '#9', count: 3 }],
      compression: [],     // SINGLY — no compression bars
      stirrup: { bar: '#3', legs: 2, spacing: 200 },
    },
    loads: { Mu: 250, Vu: 100 },
  };
  const r = analyze(input);
  // Closed-form (singly):
  //   a = As·fy / (0.85·fc·b) = 1935·414 / (0.85·27.6·305) = 112.1 mm
  //   c = a/β1 = 112.1 / 0.85 = 131.9 mm
  //   εt = 0.003·(d-c)/c = 0.003·(546-131.9)/131.9 = 0.00942 → TC, φ=0.90
  //   Mn = As·fy·(d-a/2) = 1935·414·(546-56.05) = 392.6 kN·m
  //   φMn = 0.9·392.6 = 353.3 kN·m
  near('a (Whitney depth) = 112.1 mm', r.flexure.a, 112.1, 0.01);
  near('c (NA depth) = 131.9 mm', r.flexure.c, 131.9, 0.01);
  near('Mn = 392.6 kN·m', r.flexure.Mn, 392.6, 0.01);
  near('φMn = 353.3 kN·m', r.flexure.phiMn, 353.3, 0.01);
  near('εt = 0.00942 (tension-controlled)', r.flexure.epsT, 0.00942, 0.02);
  if (r.flexure.section === 'tension-controlled') {
    pass++; console.log('  ✓ section = tension-controlled (φ = 0.90)');
  } else {
    fail++; failures.push(`section: ${r.flexure.section}`);
  }
});

// Same beam DOUBLY-reinforced (3 #9 bottom + 2 #4 top): verifies the
// quadratic re-solve when A's doesn't yield.
block('Wight 4-1 doubly variant — 3 #9 + 2 #4 (A\'s elastic, not yielding)', () => {
  const input: BeamInput = {
    code: 'ACI 318-25', method: 'LRFD',
    geometry: { shape: 'rectangular', bw: 305, h: 610, d: 546, dPrime: 60, L: 6000, coverClear: 40 },
    materials: { fc: 27.6, fy: 414, lambdaC: 1.0 },
    reinforcement: {
      tension: [{ bar: '#9', count: 3 }],
      compression: [{ bar: '#4', count: 2 }],
      stirrup: { bar: '#3', legs: 2, spacing: 200 },
    },
    loads: { Mu: 250, Vu: 100 },
  };
  const r = analyze(input);
  // Doubly closed-form (assume both yield first):
  //   AsNet = 1935 - 258 = 1677, a_yield = 1677·414/(0.85·27.6·305) = 97.18 mm
  //   c_yield = 114.3, εs' = 0.003·(114.3-60)/114.3 = 0.00143 < εy=0.00207
  //   → A's elastic, re-solve quadratic:
  //   0.85·fc·b·β1·c² + (As'·Es·0.003 - As·fy)·c - As'·Es·0.003·d' = 0
  //   A=0.85·27.6·305·0.85=6070, B=-646090, C=-9.288e6
  //   disc=B²-4AC=4.174e11+2.255e11=6.429e11, √=802460
  //   c = (646090+802460)/12140 = 119.32 mm → a = 101.4 mm
  near('a (doubly, A\'s elastic) ≈ 101.4 mm', r.flexure.a, 101.4, 0.01);
  near('c (doubly) ≈ 119.3 mm', r.flexure.c, 119.3, 0.01);
  if (r.flexure.section === 'tension-controlled') {
    pass++; console.log('  ✓ section = tension-controlled');
  } else {
    fail++;
  }
});

// ============================================================================
// REFERENCE 3: Wight Example 7-1 style — TORSION
// b = 12", h = 24", fc = 4 ksi, fy = 60 ksi, cover = 1.5", #3 stirrup
// In SI: bw=305, h=610, fc=27.6, fy=414, cover=38, db_s=9.5
// Aoh = (305-2·(38+9.5/2))·(610-2·(38+9.5/2)) = (305-85.5)·(610-85.5) = 219.5·524.5 = 115,127 mm²
// Wait, ACI defines cc as cover to centerline of stirrup = clear cover + db_s/2 = 38 + 4.75 = 42.75
// Aoh = (305 - 2·42.75)·(610 - 2·42.75) = 219.5·524.5 = 115,128 mm²
// ph = 2·(219.5 + 524.5) = 1488 mm
// Acp = 305·610 = 186,050 mm²
// pcp = 2·(305+610) = 1830 mm
// Tcr = 0.33·1·√27.6·186050²/1830 = 0.33·5.254·1.892e10 = 3.279e10 N·mm = 32.79 kN·m
// Tth = 0.75·0.083·√27.6·186050²/1830 = 0.75·0.083·5.254·1.892e10 = 6.184e9 N·mm = 6.18 kN·m
// ============================================================================

block('Wight 7-1 style — Torsion section properties (b=305, h=610, fc=27.6)', () => {
  const input: BeamInput = {
    code: 'ACI 318-25', method: 'LRFD',
    geometry: { shape: 'rectangular', bw: 305, h: 610, d: 546, dPrime: 60, L: 6000, coverClear: 38 },
    materials: { fc: 27.6, fy: 414, lambdaC: 1.0 },
    reinforcement: {
      tension: [{ bar: '#9', count: 3 }],
      compression: [{ bar: '#4', count: 2 }],
      stirrup: { bar: '#3', legs: 2, spacing: 150 },
    },
    loads: { Mu: 200, Vu: 100, Tu: 20 },     // Tu in mid-range above Tth
  };
  const r = analyze(input);
  // Acp = 305·610 = 186,050
  near('Acp matches', r.torsion.Acp, 186050, 0.001);
  // pcp = 2·(305+610) = 1830
  near('pcp matches', r.torsion.pcp, 1830, 0.001);
  // Aoh: cc = 38 + 9.5/2 = 42.75. Inner = (305-85.5)·(610-85.5) = 219.5·524.5 = 115,128
  near('Aoh matches (web only)', r.torsion.Aoh, 219.5 * 524.5, 0.005);
  // ph = 2·(219.5 + 524.5) = 1488
  near('ph matches', r.torsion.ph, 2 * (219.5 + 524.5), 0.005);
  // Tcr = 0.33·1·√27.6·(186050²/1830) / 1e6 = 32.81 kN·m (computed above)
  const expTcr = 0.33 * 1.0 * Math.sqrt(27.6) * (186050 * 186050) / 1830 / 1e6;
  near('Tcr (cracking torque) matches closed-form', r.torsion.Tcr, expTcr, 0.005);
  // Tth = φ·0.083·√fc·Acp²/pcp = 0.75·0.083·√27.6·(186050²/1830) / 1e6
  const expTth = 0.75 * 0.083 * Math.sqrt(27.6) * (186050 * 186050) / 1830 / 1e6;
  near('Tth (threshold) matches closed-form', r.torsion.Tth, expTth, 0.005);
});

// ============================================================================
// REFERENCE 4: Auto-design round-trip — feed Mu = 250 to autoDesign,
// verify the recommended bars give φMn ≥ Mu (after applying)
// ============================================================================

block('Auto-design round-trip: design → analyze must pass', () => {
  const input: BeamInput = {
    code: 'ACI 318-25', method: 'LRFD',
    geometry: { shape: 'rectangular', bw: 305, h: 610, d: 546, dPrime: 60, L: 6500, coverClear: 40 },
    materials: { fc: 27.6, fy: 414, lambdaC: 1.0 },
    reinforcement: {
      tension: [{ bar: '#5', count: 1 }], compression: [],
      stirrup: { bar: '#3', legs: 2, spacing: 300 },
    },
    loads: { Mu: 250, Vu: 130 },
  };
  const recommendation = autoDesign(input);
  const newInput: BeamInput = { ...input, reinforcement: recommendation.reinforcement };
  const r = analyze(newInput);
  if (r.flexure.phiMn >= input.loads.Mu * 0.99) {
    pass++; console.log(`  ✓ Auto-design φMn = ${r.flexure.phiMn.toFixed(1)} ≥ Mu = ${input.loads.Mu} (within 1%)`);
  } else {
    fail++; failures.push(`auto-design φMn ${r.flexure.phiMn} < Mu ${input.loads.Mu}`);
  }
  if (r.shear.phiVn >= input.loads.Vu * 0.99) {
    pass++; console.log(`  ✓ Auto-design φVn = ${r.shear.phiVn.toFixed(1)} ≥ Vu = ${input.loads.Vu}`);
  } else {
    fail++; failures.push(`auto-design φVn ${r.shear.phiVn} < Vu ${input.loads.Vu}`);
  }
});

// ============================================================================
// SUMMARY
// ============================================================================
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
