/**
 * RC Beam Design — quality-control test suite
 *
 * Tests against:
 *   - First-principles formulas from ACI 318-25 (SI units)
 *   - Classic textbook examples (Wight & MacGregor)
 *
 * Run:   npx tsx tests/rc-qc.ts
 */

import { analyze, computeBeta1, computeEc, computeFr, phiFromStrain, xiFromMonths } from '../src/lib/rc/solver';
import type { BeamInput } from '../src/lib/rc/types';

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

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================
block('Helper formulas', () => {
  // β1 per ACI §22.2.2.4.3
  near('β1 at fc=21 MPa', computeBeta1(21), 0.85);
  near('β1 at fc=28 MPa', computeBeta1(28), 0.85);
  near('β1 at fc=35 MPa', computeBeta1(35), 0.85 - 0.05 * 7 / 7);   // 0.80
  near('β1 at fc=42 MPa', computeBeta1(42), 0.85 - 0.05 * 14 / 7);  // 0.75
  near('β1 at fc=55 MPa', computeBeta1(55), 0.65);
  near('β1 at fc=60 MPa', computeBeta1(60), 0.65);

  // Ec per ACI §19.2.2.1
  near('Ec at fc=28 MPa', computeEc(28), 4700 * Math.sqrt(28), 0.005);  // ~24,870 MPa
  near('Ec at fc=35 MPa', computeEc(35), 4700 * Math.sqrt(35), 0.005);

  // fr per §19.2.3.1
  near('fr at fc=28 MPa, λ=1', computeFr(28), 0.62 * Math.sqrt(28));
  near('fr at fc=35 MPa, λ=0.85', computeFr(35, 0.85), 0.62 * 0.85 * Math.sqrt(35));

  // φ per §21.2.2 (fy=420 MPa, εty = 0.0021, TC limit = 0.0051)
  const epsTy = 420 / 200000;
  check('φ tension-controlled (εt=0.006)',  phiFromStrain(0.006, epsTy).phi === 0.90);
  check('φ compression-controlled (εt=εty)', phiFromStrain(epsTy, epsTy).phi === 0.65);
  near('φ transition (εt=0.0035)',
       phiFromStrain(0.0035, epsTy).phi,
       0.65 + 0.25 * (0.0035 - epsTy) / (0.003));

  // ξ per Table 24.2.4.1.3
  near('ξ at 3 mo', xiFromMonths(3), 1.0);
  near('ξ at 6 mo', xiFromMonths(6), 1.2);
  near('ξ at 12 mo', xiFromMonths(12), 1.4);
  near('ξ at 60 mo', xiFromMonths(60), 2.0);
});

// ============================================================================
// TEST 1 — Singly-reinforced rectangular beam (textbook)
// W&M Example 4-1 style:  b=300, h=600, d=540, fc=28, fy=420
// 4 #9 bars (As = 4·645 = 2580 mm²)
// Hand-calc:
//   a = 2580·420 / (0.85·28·300) = 151.8 mm
//   c = 151.8/0.85 = 178.6 mm
//   εt = 0.003·(540 − 178.6)/178.6 = 0.00607 → tension-controlled, φ=0.90
//   Mn = 2580·420·(540 − 75.9)/1e6 = 503.0 kN·m
//   φMn = 452.7 kN·m
// ============================================================================
block('Singly-reinforced rectangular: b=300, h=600, d=540, 4#9, fc=28, fy=420', () => {
  const input: BeamInput = {
    code: 'ACI 318-25', method: 'LRFD',
    geometry: { shape: 'rectangular', bw: 300, h: 600, d: 540, L: 6000, coverClear: 40 },
    materials: { fc: 28, fy: 420 },
    reinforcement: {
      tension: [{ bar: '#9', count: 4 }],
      stirrup: { bar: '#3', legs: 2, spacing: 200 },
    },
    loads: { Mu: 350, Vu: 100 },
  };
  const r = analyze(input);
  check('solved', r.solved);
  near('As provided', r.flexure.As, 4 * 645);
  near('β1', r.flexure.beta1, 0.85);
  near('a (stress block)', r.flexure.a, 151.8, 0.01);
  near('c (NA depth)', r.flexure.c, 178.6, 0.01);
  near('εt', r.flexure.epsT, 0.00607, 0.02);
  check('tension-controlled', r.flexure.section === 'tension-controlled');
  near('φ', r.flexure.phi, 0.90);
  near('Mn', r.flexure.Mn, 503.0, 0.02);
  near('φMn', r.flexure.phiMn, 452.7, 0.02);
});

// ============================================================================
// TEST 2 — As required for Mu given a section
// b=300, d=540, fc=28, fy=420, Mu=200 kN·m
// Hand-calc: Mu = φ·As·fy·(d − a/2) with a = As·fy/(0.85·fc·b)
// Quadratic in As: A·As² + B·As + C = 0 where
//   A = fy² / (2·0.85·fc·b) = 420² / (2·0.85·28·300) = 12.353
//   B = -fy·d = -420·540 = -226800
//   C = Mu/φ = 200e6/0.9 = 222.222e6
// disc = 226800² - 4·12.353·222.222e6 = 51,437.04e6 - 10,979.2e6 = 40,457.84e6
// √disc = 201,142
// As = (226800 - 201142) / (2·12.353) = 25,658 / 24.706 = 1038.6 mm²
// ============================================================================
block('Required As for Mu = 200 kN·m, b=300, d=540, fc=28, fy=420', () => {
  const input: BeamInput = {
    code: 'ACI 318-25', method: 'LRFD',
    geometry: { shape: 'rectangular', bw: 300, h: 600, d: 540, L: 6000, coverClear: 40 },
    materials: { fc: 28, fy: 420 },
    reinforcement: {
      tension: [{ bar: '#9', count: 4 }],     // doesn't matter for As_req
      stirrup: { bar: '#3', legs: 2, spacing: 200 },
    },
    loads: { Mu: 200, Vu: 100 },
  };
  const r = analyze(input);
  near('As required', r.flexure.AsReq, 1038.6, 0.02);
});

// ============================================================================
// TEST 3 — Minimum steel per §9.6.1.2
// b=300, d=540, fc=28, fy=420
// As_min = max(1.4·b·d/fy, 0.25·√fc·b·d/fy)
//        = max(1.4·300·540/420, 0.25·√28·300·540/420)
//        = max(540, 510.4) = 540 mm²
// ============================================================================
block('Minimum steel As,min', () => {
  const input: BeamInput = {
    code: 'ACI 318-25', method: 'LRFD',
    geometry: { shape: 'rectangular', bw: 300, h: 600, d: 540, L: 6000, coverClear: 40 },
    materials: { fc: 28, fy: 420 },
    reinforcement: {
      tension: [{ bar: '#9', count: 4 }],
      stirrup: { bar: '#3', legs: 2, spacing: 200 },
    },
    loads: { Mu: 100, Vu: 100 },
  };
  const r = analyze(input);
  near('As,min', r.flexure.AsMin, 540, 0.01);
});

// ============================================================================
// TEST 4 — High-strength concrete (β1 < 0.85)
// b=300, h=600, d=540, fc=42 MPa (β1 = 0.75), fy=420, 4 #9
//   a = 2580·420 / (0.85·42·300) = 101.2 mm
//   c = 101.2/0.75 = 134.9 mm
//   εt = 0.003·(540 − 134.9)/134.9 = 0.00901 → tension-controlled
//   Mn = 2580·420·(540 − 50.6)/1e6 = 530.4 kN·m
//   φMn = 477.4 kN·m
// ============================================================================
block('High-strength concrete fc=42 MPa, 4#9', () => {
  const input: BeamInput = {
    code: 'ACI 318-25', method: 'LRFD',
    geometry: { shape: 'rectangular', bw: 300, h: 600, d: 540, L: 6000, coverClear: 40 },
    materials: { fc: 42, fy: 420 },
    reinforcement: {
      tension: [{ bar: '#9', count: 4 }],
      stirrup: { bar: '#3', legs: 2, spacing: 200 },
    },
    loads: { Mu: 350, Vu: 100 },
  };
  const r = analyze(input);
  near('β1', r.flexure.beta1, 0.75, 0.01);
  near('a', r.flexure.a, 101.2, 0.02);
  near('c', r.flexure.c, 134.9, 0.02);
  near('Mn', r.flexure.Mn, 530.4, 0.02);
  near('φMn', r.flexure.phiMn, 477.4, 0.02);
});

// ============================================================================
// TEST 5 — Shear: Vc + Vs
// b=300, d=540, fc=28, fy=420, fyt=420
// 2-leg #3 stirrups @ 200 mm c/c
//   Vc = 0.17·1·√28·300·540/1000 = 145.7 kN
//   Av = 2·71 = 142 mm²
//   Vs = 142·420·540/200/1000 = 161.0 kN
//   Vn = 145.7 + 161.0 = 306.7 kN
//   φVn = 230.0 kN
// ============================================================================
block('Shear: Vc + Vs with 2-leg #3 @ 200 c/c', () => {
  const input: BeamInput = {
    code: 'ACI 318-25', method: 'LRFD',
    geometry: { shape: 'rectangular', bw: 300, h: 600, d: 540, L: 6000, coverClear: 40 },
    materials: { fc: 28, fy: 420 },
    reinforcement: {
      tension: [{ bar: '#9', count: 4 }],
      stirrup: { bar: '#3', legs: 2, spacing: 200 },
    },
    loads: { Mu: 350, Vu: 200 },
  };
  const r = analyze(input);
  near('Vc', r.shear.Vc, 145.7, 0.02);
  near('Av', r.shear.Av, 142);
  near('Vs', r.shear.Vs, 161.0, 0.02);
  near('φVn', r.shear.phiVn, 230.0, 0.02);
});

// ============================================================================
// TEST 6 — Stirrup max spacing per §10.7.6.5.2
// For Vs ≤ 0.33·√fc·bw·d:  s,max = min(d/2, 600)
// d=540 → s,max = min(270, 600) = 270 mm
// ============================================================================
block('Stirrup max spacing (Vs low)', () => {
  const input: BeamInput = {
    code: 'ACI 318-25', method: 'LRFD',
    geometry: { shape: 'rectangular', bw: 300, h: 600, d: 540, L: 6000, coverClear: 40 },
    materials: { fc: 28, fy: 420 },
    reinforcement: {
      tension: [{ bar: '#9', count: 4 }],
      stirrup: { bar: '#3', legs: 2, spacing: 200 },
    },
    loads: { Mu: 350, Vu: 100 },         // low Vu so Vs = 0
  };
  const r = analyze(input);
  near('s,max', r.shear.sMax, 270, 0.01);
});

// ============================================================================
// TEST 7 — Compression-controlled section (over-reinforced)
// b=200, h=400, d=350, fc=28, fy=420, As = 4 #11 = 4024 mm²
//   a = 4024·420 / (0.85·28·200) = 354.9 mm  (way bigger than d!)
//   c = 354.9 / 0.85 = 417.5 mm
//   εt = 0.003·(350 − 417.5)/417.5 = -0.000485  → compression-controlled
//   φ = 0.65
// ============================================================================
block('Compression-controlled (over-reinforced)', () => {
  const input: BeamInput = {
    code: 'ACI 318-25', method: 'LRFD',
    geometry: { shape: 'rectangular', bw: 200, h: 400, d: 350, L: 4000, coverClear: 40 },
    materials: { fc: 28, fy: 420 },
    reinforcement: {
      tension: [{ bar: '#11', count: 4 }],
      stirrup: { bar: '#3', legs: 2, spacing: 200 },
    },
    loads: { Mu: 100, Vu: 50 },
  };
  const r = analyze(input);
  check('compression-controlled flag', r.flexure.section === 'compression-controlled');
  near('φ', r.flexure.phi, 0.65);
});

// ============================================================================
// TEST 8 — Sanity: section passes everything for moderate load
// ============================================================================
block('Sanity: well-designed beam passes all checks', () => {
  const input: BeamInput = {
    code: 'ACI 318-25', method: 'LRFD',
    geometry: { shape: 'rectangular', bw: 300, h: 600, d: 540, L: 6000, coverClear: 40 },
    materials: { fc: 28, fy: 420 },
    reinforcement: {
      tension: [{ bar: '#9', count: 4 }],     // 2580 mm²
      stirrup: { bar: '#3', legs: 2, spacing: 200 },
    },
    loads: { Mu: 200, Vu: 100, Ma: 130, M_DL: 80, M_LL: 50 },
  };
  const r = analyze(input);
  check('flexure OK', r.flexure.ok);
  check('shear OK', r.shear.ok);
  check('crack control OK', r.crack.ok);
  check('overall OK', r.ok);
});

// ============================================================================
// TEST 9 — Deflection: Ig for rectangular section
// b=300, h=600 → Ig = 300·600³/12 = 5.4e9 mm⁴
// yt = h/2 = 300 mm
// ============================================================================
block('Section properties: rectangular Ig', () => {
  const input: BeamInput = {
    code: 'ACI 318-25', method: 'LRFD',
    geometry: { shape: 'rectangular', bw: 300, h: 600, d: 540, L: 6000, coverClear: 40 },
    materials: { fc: 28, fy: 420 },
    reinforcement: {
      tension: [{ bar: '#9', count: 4 }],
      stirrup: { bar: '#3', legs: 2, spacing: 200 },
    },
    loads: { Mu: 200, Vu: 100, Ma: 130 },
  };
  const r = analyze(input);
  near('Ig', r.deflection.Ig, 5.4e9, 0.001);
  near('Ec', r.deflection.Ec, 24870, 0.005);
});

// ============================================================================
// TEST 10 — T-beam, NA in flange
// bf=600, hf=120, bw=300, h=600, d=540, fc=28, fy=420, 4#9
// As = 2580 mm². Try bf as if rectangular:
//   a_assumed = 2580·420 / (0.85·28·600) = 75.9 mm
// Since 75.9 < hf (120), NA is in flange → treat as rectangular b=bf=600
//   c = 75.9 / 0.85 = 89.3 mm
//   εt = 0.003·(540 − 89.3)/89.3 = 0.01515 → tension-controlled
//   Mn = 2580·420·(540 − 37.95)/1e6 = 543.8 kN·m
// ============================================================================
block('T-beam, NA in flange (bf=600, hf=120, bw=300, 4#9)', () => {
  const input: BeamInput = {
    code: 'ACI 318-25', method: 'LRFD',
    geometry: {
      shape: 'T-beam', bw: 300, h: 600, d: 540, bf: 600, hf: 120,
      L: 6000, coverClear: 40,
    },
    materials: { fc: 28, fy: 420 },
    reinforcement: {
      tension: [{ bar: '#9', count: 4 }],
      stirrup: { bar: '#3', legs: 2, spacing: 200 },
    },
    loads: { Mu: 350, Vu: 100 },
  };
  const r = analyze(input);
  near('a (NA in flange, b=bf)', r.flexure.a, 75.9, 0.02);
  near('c', r.flexure.c, 89.3, 0.02);
  near('Mn', r.flexure.Mn, 543.8, 0.02);
});

// ============================================================================
// SUMMARY
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
