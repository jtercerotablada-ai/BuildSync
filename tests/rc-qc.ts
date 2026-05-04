/**
 * RC Beam Design — quality-control test suite
 *
 * Tests against:
 *   - First-principles formulas from ACI 318-25 (SI units)
 *   - Classic textbook examples (Wight & MacGregor)
 *
 * Run:   npx tsx tests/rc-qc.ts
 */

import { analyze, analyzeEnvelope, resolveStations, checkDetailing, computeBeta1, computeEc, computeFr, phiFromStrain, xiFromMonths } from '../src/lib/rc/solver';
import type { BeamInput, BeamEnvelopeInput } from '../src/lib/rc/types';

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
      compression: [{ bar: '#4', count: 2 }], // hanger bars per §9.7.6.4 / Wight §5-3
      stirrup: { bar: '#3', legs: 2, spacing: 200 },
    },
    loads: { Mu: 200, Vu: 100, Ma: 130, M_DL: 80, M_LL: 50 },
  };
  const r = analyze(input);
  check('flexure OK', r.flexure.ok);
  check('shear OK', r.shear.ok);
  check('crack control OK', r.crack.ok);
  check('detailing OK', r.detailing.ok);
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
// ENVELOPE — multi-section design (Phase 1)
// ============================================================================

block('Envelope: simply-supported UDL only — Mu(x), Vu(x) closed form', () => {
  // SS beam, L=6 m, wu=60 kN/m, no point loads
  // M_max = w·L²/8 = 60·36/8 = 270 kN·m at x=L/2
  // V_max = w·L/2 = 180 kN at supports, V=0 at midspan
  const stations = resolveStations(
    { kind: 'simply-supported', udl: { wu: 60 }, point: [], nStations: 11 },
    6000,
  );
  const mid = stations.find((s) => Math.abs(s.x - 3000) < 1)!;
  const left = stations[0];
  const right = stations[stations.length - 1];
  near('Mu at midspan (kN·m)', mid.Mu, 270, 0.001);
  near('Vu at left support (kN)', left.Vu, 180, 0.001);
  near('Vu at right support (kN)', right.Vu, 180, 0.001);
  near('Vu at midspan (kN)', mid.Vu, 0, 0.001);
  near('Mu at supports (kN·m)', left.Mu, 0, 0.001);
});

block('Envelope: SS UDL + midspan point load', () => {
  // L=6 m, wu=40 kN/m, P=60 kN at x=3 m
  // R_A = R_B = 40·6/2 + 60/2 = 150 kN
  // M(L/2) = 40·6²/8 + 60·6/4 = 180 + 90 = 270 kN·m
  // V at left (just inside) = 150 kN
  // V just left of midspan = 150 - 40·3 = 30 kN
  // V just right of midspan = 30 - 60 = -30 kN  (|V|=30)
  const stations = resolveStations(
    { kind: 'simply-supported', udl: { wu: 40 }, point: [{ x: 3000, Pu: 60 }], nStations: 21 },
    6000,
  );
  const left = stations[0];
  near('R_A reaction proxy via V(0)', left.Vu, 150, 0.001);
  // Find a station at x=2999 to be JUST left of P; resolveStations injects x=3000 explicitly
  // Find the entry exactly at x=3000 — there will be 2 (one from grid, one from injection)
  const allAt3000 = stations.filter((s) => Math.abs(s.x - 3000) < 1e-6);
  check('At least one station at x=3000', allAt3000.length >= 1);
  const mid = allAt3000[0];
  near('Mu at midspan (kN·m)', mid.Mu, 270, 0.001);
});

block('Envelope: manual stations passthrough', () => {
  const stations = resolveStations(
    {
      kind: 'manual',
      stations: [
        { x: 0, Mu: 0, Vu: 200 },
        { x: 3000, Mu: 350, Vu: 0 },
        { x: 6000, Mu: 0, Vu: 200 },
      ],
    },
    6000,
  );
  check('3 stations passed through', stations.length === 3);
  near('Mu midspan', stations[1].Mu, 350, 0.001);
});

block('Envelope analysis: SS UDL — flexure & shear pass at every station', () => {
  // Use a less-aggressive limit category so deflection doesn't dominate the test
  const input: BeamEnvelopeInput = {
    code: 'ACI 318-25', method: 'LRFD',
    geometry: { shape: 'rectangular', bw: 300, h: 600, d: 540, L: 6000, coverClear: 40 },
    materials: { fc: 28, fy: 420, fyt: 420 },
    reinforcement: {
      tension: [{ bar: '#9', count: 4 }],
      stirrup: { bar: '#3', legs: 2, spacing: 200 },
    },
    demand: { kind: 'simply-supported', udl: { wu: 60 }, point: [], nStations: 21 },
    loads: { Mu: 0, Vu: 0, Ma: 230, M_DL: 140, M_LL: 90, deflectionLimitCategory: 'floor-no-attached' },
  };
  const r = analyzeEnvelope(input);
  check('solver completed', r.solved);
  check('21+ stations', r.stations.length >= 21);
  check('every station passes flexure (ratio ≤ 1)', r.stations.every((s) => s.flexureRatio <= 1));
  check('every station passes shear (ratio ≤ 1)', r.stations.every((s) => s.shearRatio <= 1));
  check('governing kind is flexure or shear (well-designed)', r.governing.kind === 'flexure' || r.governing.kind === 'shear');
  near('worst flexure ratio matches Mu_max/φMn', r.maxFlexureRatio, 270 / r.flexureWorst.phiMn, 0.05);
});

block('Envelope analysis: SS UDL — under-reinforced fails at midspan', () => {
  // Same beam but 2#9 instead of 4 — should fail flexure at midspan
  const input: BeamEnvelopeInput = {
    code: 'ACI 318-25', method: 'LRFD',
    geometry: { shape: 'rectangular', bw: 300, h: 600, d: 540, L: 6000, coverClear: 40 },
    materials: { fc: 28, fy: 420, fyt: 420 },
    reinforcement: {
      tension: [{ bar: '#9', count: 2 }],
      stirrup: { bar: '#3', legs: 2, spacing: 200 },
    },
    demand: { kind: 'simply-supported', udl: { wu: 60 }, point: [], nStations: 21 },
    loads: { Mu: 0, Vu: 0, Ma: 230, M_DL: 140, M_LL: 90, deflectionLimitCategory: 'floor-attached-likely-damage' },
  };
  const r = analyzeEnvelope(input);
  check('solver completed', r.solved);
  check('overall fails', !r.ok);
  // Could govern as flexure OR deflection (under-reinforced beams crack badly).
  check('governing is flexure or deflection', r.governing.kind === 'flexure' || r.governing.kind === 'deflection');
  check('worst x is near midspan', Math.abs(r.governing.x - 3000) < 50);
  check('action message in EN', r.governing.actionEn !== undefined && r.governing.actionEn.length > 0);
  check('action message in ES', r.governing.actionEs !== undefined && r.governing.actionEs.length > 0);
});

block('Envelope analysis: SS UDL — under-stirruped fails at supports (shear)', () => {
  // High UDL, sparse stirrups → shear governs near supports
  const input: BeamEnvelopeInput = {
    code: 'ACI 318-25', method: 'LRFD',
    geometry: { shape: 'rectangular', bw: 300, h: 600, d: 540, L: 6000, coverClear: 40 },
    materials: { fc: 28, fy: 420, fyt: 420 },
    reinforcement: {
      tension: [{ bar: '#9', count: 5 }],
      stirrup: { bar: '#3', legs: 2, spacing: 600 },   // very wide spacing → low Vs
    },
    demand: { kind: 'simply-supported', udl: { wu: 200 }, point: [], nStations: 21 },
    loads: { Mu: 0, Vu: 0 },
  };
  const r = analyzeEnvelope(input);
  check('solver completed', r.solved);
  check('overall fails', !r.ok);
  // Worst shear is at the supports (x=0 or x=L)
  const worstShr = r.stations.reduce((a, b) => (b.shearRatio > a.shearRatio ? b : a));
  check('worst shear at a support', worstShr.x < 100 || worstShr.x > 5900);
});

block('Envelope analysis: manual mode reproduces single-section result', () => {
  // If we pass exactly one station at x=midspan, the worst-station capacity should
  // match a single analyze() call with the same Mu, Vu.
  const baseInput: BeamInput = {
    code: 'ACI 318-25', method: 'LRFD',
    geometry: { shape: 'rectangular', bw: 300, h: 600, d: 540, L: 6000, coverClear: 40 },
    materials: { fc: 28, fy: 420, fyt: 420 },
    reinforcement: {
      tension: [{ bar: '#9', count: 4 }],
      stirrup: { bar: '#3', legs: 2, spacing: 200 },
    },
    loads: { Mu: 270, Vu: 180, Ma: 200, M_DL: 130, M_LL: 70, deflectionLimitCategory: 'floor-attached-likely-damage' },
  };
  const single = analyze(baseInput);
  const env = analyzeEnvelope({
    ...baseInput,
    demand: {
      kind: 'manual',
      stations: [
        { x: 0, Mu: 0, Vu: 180 },
        { x: 3000, Mu: 270, Vu: 0 },
        { x: 6000, Mu: 0, Vu: 180 },
      ],
    },
  });
  near('worst flexure phiMn matches single-section', env.flexureWorst.phiMn, single.flexure.phiMn, 0.001);
  near('worst shear phiVn matches single-section', env.shearWorst.phiVn, single.shear.phiVn, 0.001);
});

block('Envelope analysis: governing narrative is bilingual', () => {
  const input: BeamEnvelopeInput = {
    code: 'ACI 318-25', method: 'LRFD',
    geometry: { shape: 'rectangular', bw: 300, h: 600, d: 540, L: 6000, coverClear: 40 },
    materials: { fc: 28, fy: 420 },
    reinforcement: {
      tension: [{ bar: '#9', count: 4 }],
      stirrup: { bar: '#3', legs: 2, spacing: 200 },
    },
    demand: { kind: 'simply-supported', udl: { wu: 60 }, point: [], nStations: 11 },
    loads: { Mu: 0, Vu: 0 },
  };
  const r = analyzeEnvelope(input);
  check('English narrative non-empty', r.governing.narrativeEn.length > 10);
  check('Spanish narrative non-empty', r.governing.narrativeEs.length > 10);
  check('English mentions ratio %', /\d+\.\d+%/.test(r.governing.narrativeEn));
});

block('Envelope analysis: ratios increase quadratically with UDL (sanity)', () => {
  const make = (wu: number) => analyzeEnvelope({
    code: 'ACI 318-25', method: 'LRFD',
    geometry: { shape: 'rectangular', bw: 300, h: 600, d: 540, L: 6000, coverClear: 40 },
    materials: { fc: 28, fy: 420 },
    reinforcement: { tension: [{ bar: '#9', count: 4 }], stirrup: { bar: '#3', legs: 2, spacing: 200 } },
    demand: { kind: 'simply-supported', udl: { wu }, point: [], nStations: 11 },
    loads: { Mu: 0, Vu: 0 },
  });
  const r1 = make(40);
  const r2 = make(80);
  // Mu_max scales linearly with w. ratio also scales linearly (capacity is constant).
  near('flexure ratio doubles when w doubles', r2.maxFlexureRatio / r1.maxFlexureRatio, 2.0, 0.05);
  near('shear ratio doubles when w doubles', r2.maxShearRatio / r1.maxShearRatio, 2.0, 0.05);
});

// ============================================================================
// DETAILING — Code-mandated rules (ACI 318-25)
// ============================================================================
//
// Tests cover the 8 sub-checks added in Phase 2:
//   1. Cover §20.5.1.3 (interior, exterior, cast-against-ground)
//   2. Bar fit in one row (Wight Eq 5-25 + §25.2.1)
//   3. Bar clear spacing §25.2.1
//   4. Hanger bars (Wight §5-3 — practical)
//   5. Skin reinforcement §9.7.2.3 (h > 900 mm)
//   6. Stirrup min size §25.7.2.2
//   7. Stirrup leg spacing across width §9.7.6.2.2
//   8. Compression bar lateral support §9.7.6.4
//
// Each test uses a typical 300×600 beam unless otherwise noted.

function baseBeam(over: Partial<BeamInput> = {}): BeamInput {
  return {
    code: 'ACI 318-25', method: 'LRFD',
    geometry: { shape: 'rectangular', bw: 300, h: 600, d: 540, dPrime: 50, L: 6000, coverClear: 40 },
    materials: { fc: 28, fy: 420, fyt: 420, aggSize: 19, exposure: 'interior' },
    reinforcement: {
      tension: [{ bar: '#9', count: 4 }],
      compression: [{ bar: '#4', count: 2 }],
      stirrup: { bar: '#3', legs: 2, spacing: 200 },
    },
    loads: { Mu: 200, Vu: 100 },
    ...over,
  };
}

block('Detailing: well-designed beam — all 8 checks pass', () => {
  const r = checkDetailing(baseBeam());
  check('cover OK', r.cover.ok);
  check('barFit OK', r.barFit.ok);
  check('barSpacing OK', r.barSpacing.ok);
  check('hangerBars OK', r.hangerBars.ok);
  check('skinReinf OK (h≤900)', r.skinReinf.ok);
  check('stirrupSize OK', r.stirrupSize.ok);
  check('stirrupLegSpacing OK', r.stirrupLegSpacing.ok);
  check('compressionLateral OK', r.compressionLateral.ok);
  check('overall detailing OK', r.ok);
});

block('Detailing CHECK 1 — cover §20.5.1.3', () => {
  // Interior: min 40 mm. With 40 → pass; with 30 → fail.
  const ok = checkDetailing(baseBeam({ geometry: { ...baseBeam().geometry, coverClear: 40 } }));
  check('interior 40 mm passes', ok.cover.ok);
  const bad = checkDetailing(baseBeam({ geometry: { ...baseBeam().geometry, coverClear: 30 } }));
  check('interior 30 mm fails', !bad.cover.ok);
  // Exterior: min 50 mm. With 40 → fails.
  const ext = checkDetailing(baseBeam({
    geometry: { ...baseBeam().geometry, coverClear: 40 },
    materials: { ...baseBeam().materials, exposure: 'exterior' },
  }));
  check('exterior 40 mm fails (need 50)', !ext.cover.ok);
  const extOk = checkDetailing(baseBeam({
    geometry: { ...baseBeam().geometry, coverClear: 50 },
    materials: { ...baseBeam().materials, exposure: 'exterior' },
  }));
  check('exterior 50 mm passes', extOk.cover.ok);
  // Cast-against-ground: min 75 mm.
  const gnd = checkDetailing(baseBeam({
    geometry: { ...baseBeam().geometry, coverClear: 50 },
    materials: { ...baseBeam().materials, exposure: 'cast-against-ground' },
  }));
  check('cast-against-ground 50 mm fails (need 75)', !gnd.cover.ok);
});

block('Detailing CHECK 2 — bar fit (Wight Eq 5-25)', () => {
  // 300 mm wide beam with 8 #9 bars: doesn't fit
  const tight = checkDetailing(baseBeam({
    reinforcement: {
      ...baseBeam().reinforcement,
      tension: [{ bar: '#9', count: 8 }],
    },
  }));
  check('8#9 in 300mm beam does NOT fit in one row', !tight.barFit.ok);
  // 4 #9 → fits
  const fits = checkDetailing(baseBeam({
    reinforcement: {
      ...baseBeam().reinforcement,
      tension: [{ bar: '#9', count: 4 }],
    },
  }));
  check('4#9 in 300mm beam fits', fits.barFit.ok);
});

block('Detailing CHECK 3 — bar clear spacing §25.2.1', () => {
  // Standard test: 4 #9 in 300 mm → spacing should be ≥ max(25, 28.7, 4/3·19=25.3) = 28.7
  // Available = 300 - 2·40 - 2·9.5 = 201 mm. Bar widths = 4·28.7 = 114.8. Free space = 86.2 mm.
  // Clear spacing = 86.2/3 = 28.7 mm. Required = 28.7 mm → just at boundary, should pass.
  const r = checkDetailing(baseBeam());
  check('4#9 in 300mm meets §25.2.1 spacing', r.barSpacing.ok);
  // 5 #9 in 300mm → spacing < required → fail
  const tight = checkDetailing(baseBeam({
    geometry: { ...baseBeam().geometry, bw: 300 },
    reinforcement: {
      ...baseBeam().reinforcement,
      tension: [{ bar: '#9', count: 5 }],
    },
  }));
  // 5 bars: required width = 5·28.7 + 4·28.7 = 9·28.7 = 258.3 mm > 201 mm available → barFit fails first
  // barSpacing becomes informational for multi-row case
  check('5#9 in 300mm: rowsNeeded > 1 (informational spacing)', !tight.barFit.ok);
});

block('Detailing CHECK 4 — hanger bars (Wight §5-3)', () => {
  const noTop = checkDetailing(baseBeam({
    reinforcement: {
      tension: [{ bar: '#9', count: 4 }],
      stirrup: { bar: '#3', legs: 2, spacing: 200 },
    },
  }));
  check('beam without top bars fails', !noTop.hangerBars.ok);
  const oneBar = checkDetailing(baseBeam({
    reinforcement: {
      tension: [{ bar: '#9', count: 4 }],
      compression: [{ bar: '#4', count: 1 }],
      stirrup: { bar: '#3', legs: 2, spacing: 200 },
    },
  }));
  check('beam with only 1 top bar fails', !oneBar.hangerBars.ok);
  const twoBar = checkDetailing(baseBeam({
    reinforcement: {
      tension: [{ bar: '#9', count: 4 }],
      compression: [{ bar: '#4', count: 2 }],
      stirrup: { bar: '#3', legs: 2, spacing: 200 },
    },
  }));
  check('beam with 2 top hanger bars passes', twoBar.hangerBars.ok);
});

block('Detailing CHECK 5 — skin reinforcement §9.7.2.3 (h > 900)', () => {
  // h = 600 → not required → informational pass
  const small = checkDetailing(baseBeam());
  check('h=600 → skin not required', small.skinReinf.ok);
  // h = 1000 with no skin → fails
  const deepNoSkin = checkDetailing(baseBeam({
    geometry: { ...baseBeam().geometry, h: 1000, d: 920 },
  }));
  check('h=1000 with no skin → fails', !deepNoSkin.skinReinf.ok);
  // h = 1000 with skin → passes
  const deepWithSkin = checkDetailing(baseBeam({
    geometry: { ...baseBeam().geometry, h: 1000, d: 920 },
    reinforcement: {
      ...baseBeam().reinforcement,
      skin: { bar: '#4', countPerFace: 4 },
    },
  }));
  check('h=1000 with 4 skin bars/face → passes', deepWithSkin.skinReinf.ok);
});

block('Detailing CHECK 6 — stirrup min size §25.7.2.2', () => {
  // #9 longitudinal + #3 stirrup → OK
  const ok = checkDetailing(baseBeam());
  check('#3 stirrup with #9 longit OK', ok.stirrupSize.ok);
  // #14 longitudinal + #3 stirrup → fails (need #4)
  const big = checkDetailing(baseBeam({
    reinforcement: {
      ...baseBeam().reinforcement,
      tension: [{ bar: '#14', count: 2 }],
    },
  }));
  check('#3 stirrup with #14 longit fails', !big.stirrupSize.ok);
  // #14 longitudinal + #4 stirrup → passes
  const bigOk = checkDetailing(baseBeam({
    reinforcement: {
      ...baseBeam().reinforcement,
      tension: [{ bar: '#14', count: 2 }],
      stirrup: { bar: '#4', legs: 2, spacing: 200 },
    },
  }));
  check('#4 stirrup with #14 longit passes', bigOk.stirrupSize.ok);
});

block('Detailing CHECK 7 — stirrup leg spacing across width §9.7.6.2.2', () => {
  // Wide beam with only 2 legs may exceed leg spacing limit
  const wide = checkDetailing(baseBeam({
    geometry: { ...baseBeam().geometry, bw: 800 },
    loads: { Mu: 200, Vu: 50 },     // low Vu so threshold is d=540 (lesser of d, 600)
  }));
  // Inner span = 800 - 2·40 - 2·9.5 = 701 mm (with 2 legs).
  // Limit (low Vs) = min(540, 600) = 540 mm. 701 > 540 → fails
  check('800mm wide with 2 legs fails leg spacing', !wide.stirrupLegSpacing.ok);
  // Same beam with 4 legs → 701/3 = 234 mm < 540 → passes
  const wide4legs = checkDetailing(baseBeam({
    geometry: { ...baseBeam().geometry, bw: 800 },
    reinforcement: {
      ...baseBeam().reinforcement,
      stirrup: { bar: '#3', legs: 4, spacing: 200 },
    },
    loads: { Mu: 200, Vu: 50 },
  }));
  check('800mm wide with 4 legs passes', wide4legs.stirrupLegSpacing.ok);
});

block('Detailing CHECK 8 — compression bar lateral support §9.7.6.4', () => {
  // No compression bars → informational pass
  const noComp = checkDetailing(baseBeam({
    reinforcement: {
      tension: [{ bar: '#9', count: 4 }],
      compression: [{ bar: '#4', count: 2 }],   // Add hangers so other checks pass
      stirrup: { bar: '#3', legs: 2, spacing: 200 },
    },
  }));
  check('with hanger compression bars, lateral support OK', noComp.compressionLateral.ok);
});

block('Detailing: integration — well-designed deep beam (h=1100, with skin)', () => {
  const r = checkDetailing({
    code: 'ACI 318-25', method: 'LRFD',
    geometry: { shape: 'rectangular', bw: 500, h: 1100, d: 1020, dPrime: 50, L: 9000, coverClear: 50 },
    materials: { fc: 35, fy: 420, fyt: 420, aggSize: 19, exposure: 'interior' },
    reinforcement: {
      tension: [{ bar: '#10', count: 6 }],
      compression: [{ bar: '#4', count: 2 }],
      stirrup: { bar: '#4', legs: 2, spacing: 200 },
      skin: { bar: '#4', countPerFace: 4 },
    },
    loads: { Mu: 1200, Vu: 500 },
  });
  check('deep beam with skin reinforcement passes detailing', r.ok);
});

block('Detailing: bilingual narratives populated', () => {
  const ok = checkDetailing(baseBeam());
  check('passing narrative EN', ok.narrativeEn.includes('Detailing OK'));
  check('passing narrative ES', ok.narrativeEs.includes('Detallado OK'));
  const fail = checkDetailing(baseBeam({
    reinforcement: { tension: [{ bar: '#9', count: 4 }], stirrup: { bar: '#3', legs: 2, spacing: 200 } },
  }));
  check('failing narrative EN', fail.narrativeEn.includes('issues'));
  check('failing narrative ES', fail.narrativeEs.includes('Problemas'));
});

block('Detailing: analyze() output includes detailing', () => {
  const r = analyze(baseBeam());
  check('detailing present', !!r.detailing);
  check('detailing.ok present', typeof r.detailing.ok === 'boolean');
  check('detailing has all 8 sub-checks', !!(r.detailing.cover && r.detailing.barFit && r.detailing.barSpacing
    && r.detailing.hangerBars && r.detailing.skinReinf && r.detailing.stirrupSize
    && r.detailing.stirrupLegSpacing && r.detailing.compressionLateral));
});

// ============================================================================
// QC AUDIT FIXES — tests for the 1 RED + 4 YELLOW findings (vs ACI 318-25)
// ============================================================================

block('QC Fix #1 (RED) — Bischoff Ie §24.2.3.5 replaces Branson 1965', () => {
  // Lightly-reinforced section: Branson under-predicts deflection vs Bischoff.
  // Beam: 300×400, d=350, fc=28 MPa, fy=420, 2#5 (As=398 mm² → ρ=0.38%).
  // Service moment Ma chosen so Ma > (2/3)·Mcr to trigger Bischoff branch.
  const input: BeamInput = {
    code: 'ACI 318-25', method: 'LRFD',
    geometry: { shape: 'rectangular', bw: 300, h: 400, d: 350, dPrime: 50, L: 5000, coverClear: 40 },
    materials: { fc: 28, fy: 420, fyt: 420, aggSize: 19, exposure: 'interior' },
    reinforcement: {
      tension: [{ bar: '#5', count: 2 }],
      compression: [{ bar: '#4', count: 2 }],
      stirrup: { bar: '#3', legs: 2, spacing: 175 },
    },
    loads: { Mu: 60, Vu: 50, Ma: 50, M_DL: 30, M_LL: 20, deflectionLimitCategory: 'floor-no-attached' },
  };
  const r = analyze(input);
  // Hand-calc reference (Bischoff):
  //   Ig = 300·400³/12 = 1.6e9 mm⁴
  //   fr = 0.62·√28 = 3.28 MPa, yt = 200 mm
  //   Mcr = 3.28·1.6e9/200/1e6 = 26.24 kN·m  (Ig*fr/yt; engineering)
  //   (2/3)·Mcr ≈ 17.5 kN·m
  //   Ma = 50 > McrEff → Bischoff branch active
  //   Icr (linear-elastic cracked) ≈ ~3.5e8 mm⁴ for ρ ≈ 0.38%
  //   Bischoff Ie = Icr / (1 − ((2/3)·Mcr/Ma)²·(1 − Icr/Ig))
  //               = 3.5e8 / (1 − (0.350)²·(1 − 0.219))
  //               = 3.5e8 / 0.904 ≈ 3.87e8 mm⁴
  // Branson (old) for the same case would give Ie ≈ Icr·(1−(Mcr/Ma)³) + Ig·(Mcr/Ma)³
  //              ≈ 3.5e8·0.855 + 1.6e9·0.145 = 2.99e8 + 2.32e8 = 5.31e8 mm⁴
  // → Bischoff is SMALLER (lower Ie ⇒ larger deflection) ⇒ matches the §24.2.3.5 intent.
  near('Mcr (kN·m)', r.deflection.Mcr, 26.24, 0.05);
  // Bischoff result must be < Branson would have given for the same Ig, Icr, Ma:
  const Mcr = r.deflection.Mcr;
  const branson_estimate = r.deflection.Icr * (1 - Math.pow(Mcr / 50, 3))
                         + r.deflection.Ig * Math.pow(Mcr / 50, 3);
  check('Bischoff Ie < Branson Ie at low ρ (deflection conservative)', r.deflection.Ie < branson_estimate);
  // Bischoff should be > Icr and < Ig (mathematical bounds)
  check('Ie > Icr (within bounds)', r.deflection.Ie > r.deflection.Icr);
  check('Ie ≤ Ig (capped)', r.deflection.Ie <= r.deflection.Ig + 1);
});

block('QC Fix #1 (cont.) — Bischoff Ie = Ig when Ma ≤ (2/3)·Mcr (§24.2.3.5a)', () => {
  // Heavy section, low service moment: should be uncracked → Ie = Ig.
  const input: BeamInput = {
    code: 'ACI 318-25', method: 'LRFD',
    geometry: { shape: 'rectangular', bw: 400, h: 700, d: 640, dPrime: 50, L: 6000, coverClear: 40 },
    materials: { fc: 35, fy: 420, fyt: 420, aggSize: 19, exposure: 'interior' },
    reinforcement: {
      tension: [{ bar: '#9', count: 4 }],
      compression: [{ bar: '#4', count: 2 }],
      stirrup: { bar: '#3', legs: 2, spacing: 200 },
    },
    // Ma chosen well below (2/3)·Mcr
    loads: { Mu: 100, Vu: 50, Ma: 30, M_DL: 18, M_LL: 12, deflectionLimitCategory: 'floor-no-attached' },
  };
  const r = analyze(input);
  near('Ie = Ig (uncracked branch)', r.deflection.Ie, r.deflection.Ig, 0.001);
});

block('QC Fix #2 (YELLOW) — Stirrup size threshold = 36 mm (§25.7.2.2/§9.7.6.4.2)', () => {
  // ASTM #11 = 35.8 mm → still allows #3 stirrup (boundary just below threshold)
  const ok = checkDetailing(baseBeam({
    reinforcement: {
      tension: [{ bar: '#11', count: 3 }],
      compression: [{ bar: '#4', count: 2 }],
      stirrup: { bar: '#3', legs: 2, spacing: 200 },
    },
  }));
  check('#3 stirrup with #11 (db=35.8) longit OK (35.8 < 36)', ok.stirrupSize.ok);
  // ASTM #14 = 43 mm → must use ≥#4 stirrup (above threshold)
  const big = checkDetailing(baseBeam({
    reinforcement: {
      tension: [{ bar: '#14', count: 2 }],
      compression: [{ bar: '#4', count: 2 }],
      stirrup: { bar: '#3', legs: 2, spacing: 200 },
    },
  }));
  check('#3 stirrup with #14 longit fails (43 ≥ 36)', !big.stirrupSize.ok);
});

block('QC Fix #3 (YELLOW) — Citation now §9.7.6.2.2 (beam) not §10.7.6.5.2 (column)', () => {
  const input: BeamInput = {
    code: 'ACI 318-25', method: 'LRFD',
    geometry: { shape: 'rectangular', bw: 300, h: 600, d: 540, dPrime: 50, L: 6000, coverClear: 40 },
    materials: { fc: 28, fy: 420, fyt: 420, aggSize: 19, exposure: 'interior' },
    reinforcement: {
      tension: [{ bar: '#9', count: 4 }],
      compression: [{ bar: '#4', count: 2 }],
      stirrup: { bar: '#3', legs: 2, spacing: 200 },
    },
    loads: { Mu: 200, Vu: 100 },
  };
  const r = analyze(input);
  // Find the s,max step in shear and verify its ref string
  const sMaxStep = r.shear.steps.find((s) => s.title.includes('Maximum stirrup spacing'));
  check('s_max step exists', !!sMaxStep);
  check('s_max cites §9.7.6.2.2 (beam rule)', !!sMaxStep && sMaxStep.ref?.includes('9.7.6.2.2'));
  check('s_max does NOT cite §10.7.6.5.2 (column rule)', !!sMaxStep && !sMaxStep.ref?.includes('10.7.6.5.2'));
});

block('QC Fix #4 (YELLOW) — Vc size-effect (§22.5.5.1.3) when Av < Av,min', () => {
  // Deep beam, no stirrups (Av effectively zero) → eqn (c) with size-effect kicks in.
  // d = 1200 mm → λs = √(2/(1+1200/250)) = √(2/5.8) = 0.587
  // ρw = As/(bw·d). For bw=300, d=1200, 4#9: As=2580. ρw = 2580/(300·1200) = 0.00717.
  // Vc(c) = 0.66·0.587·0.00717^(1/3)·1·√28·300·1200 / 1000
  //       = 0.66·0.587·0.193·5.29·300·1200/1000 ≈ 142 kN
  // Vc(a) simplified: 0.17·1·√28·300·1200/1000 = 324 kN  (over-prediction)
  // Solver should now use eqn (c) and report ~142 kN, not 324 kN.
  const input: BeamInput = {
    code: 'ACI 318-25', method: 'LRFD',
    geometry: { shape: 'rectangular', bw: 300, h: 1300, d: 1200, dPrime: 50, L: 8000, coverClear: 40 },
    materials: { fc: 28, fy: 420, fyt: 420, aggSize: 19, exposure: 'interior' },
    reinforcement: {
      tension: [{ bar: '#9', count: 4 }],
      compression: [{ bar: '#4', count: 2 }],
      // Sparse stirrups so Av < Av,min
      stirrup: { bar: '#3', legs: 2, spacing: 1500 },
      skin: { bar: '#4', countPerFace: 4 },
    },
    loads: { Mu: 600, Vu: 50 },
  };
  const r = analyze(input);
  near('Vc (size-effect eqn c)', r.shear.Vc, 142, 0.10);     // 10% tolerance
  // Critical comparison: must be SMALLER than the simplified eqn (a) value
  const Vc_simplified = 0.17 * 1.0 * Math.sqrt(28) * 300 * 1200 / 1000;     // = 324 kN
  check('Vc(c) < Vc(a) for under-stirruped deep beam', r.shear.Vc < Vc_simplified * 0.9);
});

block('QC Fix #4 (cont.) — When Av ≥ Av,min, Vc still uses simplified eqn (a)', () => {
  // Standard well-stirruped beam → eqn (a).
  const input: BeamInput = {
    code: 'ACI 318-25', method: 'LRFD',
    geometry: { shape: 'rectangular', bw: 300, h: 600, d: 540, dPrime: 50, L: 6000, coverClear: 40 },
    materials: { fc: 28, fy: 420, fyt: 420, aggSize: 19, exposure: 'interior' },
    reinforcement: {
      tension: [{ bar: '#9', count: 4 }],
      compression: [{ bar: '#4', count: 2 }],
      stirrup: { bar: '#3', legs: 2, spacing: 200 },     // tight enough for Av ≥ Av,min
    },
    loads: { Mu: 200, Vu: 200 },
  };
  const r = analyze(input);
  // Vc(a) = 0.17·1·√28·300·540/1000 = 145.7 kN
  near('Vc (simplified eqn a)', r.shear.Vc, 145.7, 0.01);
});

block('QC Fix #5 (YELLOW) — §9.7.6.4.3 compression-bar stirrup spacing limit', () => {
  // Beam with #11 longitudinal compression bars + #3 stirrup at 600 mm spacing.
  //   limit (a) 16·db,longit  = 16·35.8 = 573 mm
  //   limit (b) 48·db,stirrup = 48·9.5 = 456 mm     ← governs
  //   limit (c) min(bw, h)    = min(300, 600) = 300 mm   ← actually governs
  //   s_max = min(573, 456, 300) = 300 mm
  // Provided 600 mm → fails.
  const tooWide = checkDetailing(baseBeam({
    reinforcement: {
      tension: [{ bar: '#9', count: 4 }],
      compression: [{ bar: '#11', count: 2 }],
      stirrup: { bar: '#3', legs: 2, spacing: 600 },
    },
  }));
  check('compression-bar spacing fails (600 > 300)', !tooWide.compressionLateral.ok);
  // Same beam but s = 200 mm → passes.
  const ok = checkDetailing(baseBeam({
    reinforcement: {
      tension: [{ bar: '#9', count: 4 }],
      compression: [{ bar: '#11', count: 2 }],
      stirrup: { bar: '#3', legs: 2, spacing: 200 },
    },
  }));
  check('compression-bar spacing OK (200 ≤ 300)', ok.compressionLateral.ok);
});

block('QC Audit — Vc with simplified eqn matches the Phase-1 baseline (regression)', () => {
  // Sanity: classic textbook beam still produces Vc = 145.7 kN as in our 50/50 baseline tests.
  const input: BeamInput = {
    code: 'ACI 318-25', method: 'LRFD',
    geometry: { shape: 'rectangular', bw: 300, h: 600, d: 540, dPrime: 50, L: 6000, coverClear: 40 },
    materials: { fc: 28, fy: 420, fyt: 420 },
    reinforcement: {
      tension: [{ bar: '#9', count: 4 }],
      compression: [{ bar: '#4', count: 2 }],
      stirrup: { bar: '#3', legs: 2, spacing: 200 },
    },
    loads: { Mu: 350, Vu: 200 },
  };
  const r = analyze(input);
  near('Regression: Vc = 145.7 kN', r.shear.Vc, 145.7, 0.01);
  near('Regression: Vs = 161 kN', r.shear.Vs, 161, 0.01);
  near('Regression: φVn = 230 kN', r.shear.phiVn, 230, 0.01);
});

// ============================================================================
// PHASE 3 — Stirrup zoning, dev length, lap splices, bar curtailment
// ============================================================================
import { tensionDevLength, compressionDevLength, lapSpliceLength, computeStirrupZones, computeCurtailment, buildElevationData } from '../src/lib/rc/phase3';

block('Phase 3 — Tension development length §25.4.2.3 simplified', () => {
  // #9 (db = 28.7 mm), fy = 420, fc = 28, lambda = 1.0, bottom bar, uncoated, case 2
  // Per simplified eqn for #7+: ld/db = fy / (1.1 · 1 · √28) = 420 / 5.82 ≈ 72.16
  // ld = 72.16 · 28.7 = 2071 mm  (Wight Table A-6 reference value)
  const r = tensionDevLength({ db: 28.7, fy: 420, fc: 28, lambda: 1.0, location: 'bottom', coating: 'uncoated', case: 2 });
  near('ld for #9, fc=28, Gr60, bottom, case 2', r.ld, 2071, 0.01);
  check('ψt = 1.0 (bottom bar)', Math.abs(r.psiT - 1.0) < 0.001);
  check('ψe = 1.0 (uncoated)', Math.abs(r.psiE - 1.0) < 0.001);
  check('ψg = 1.0 (Gr60)', Math.abs(r.psiG - 1.0) < 0.001);
});

block('Phase 3 — Tension ld for top bar (ψt = 1.3)', () => {
  // Top bar should be 30% longer than bottom
  const bot = tensionDevLength({ db: 28.7, fy: 420, fc: 28, location: 'bottom', case: 2 });
  const top = tensionDevLength({ db: 28.7, fy: 420, fc: 28, location: 'top', case: 2 });
  near('top ld / bottom ld = 1.3', top.ld / bot.ld, 1.3, 0.001);
});

block('Phase 3 — Tension ld for #5 (smaller bar)', () => {
  // #5 (db = 15.9 mm), fc = 28, Gr 60, case 2
  // ld/db = 420 / (1.4 · 1 · √28) = 420 / 7.41 = 56.7
  // ld = 56.7 · 15.9 = 901 mm
  const r = tensionDevLength({ db: 15.9, fy: 420, fc: 28, location: 'bottom', case: 2 });
  near('ld for #5 (db ≤ 19, divisor 1.4)', r.ld, 901, 0.01);
});

block('Phase 3 — Min ld = 300 mm', () => {
  // Tiny bar with high fc and small db should still floor at 300 mm
  const r = tensionDevLength({ db: 10, fy: 420, fc: 60, location: 'bottom', case: 1 });
  check('ld floored at 300 mm minimum', r.ld >= 300);
});

block('Phase 3 — Compression development length §25.4.9.2', () => {
  // #9 in 28 MPa, Gr 60: ldc/db = max(0.24·420/√28, 0.043·420) = max(19.05, 18.06) = 19.05
  // ldc = 19.05 · 28.7 = 547 mm  (≥ 200 mm minimum)
  const ldc = compressionDevLength({ db: 28.7, fy: 420, fc: 28 });
  near('ldc for #9, fc=28, Gr60', ldc, 547, 0.02);
});

block('Phase 3 — Lap splice §25.5', () => {
  // For ld = 2071 mm: classA = 2071, classB = 2693 (=1.3·2071)
  const splice = lapSpliceLength(2071);
  near('Class A splice = 1.0·ld', splice.classA, 2071, 0.001);
  near('Class B splice = 1.3·ld', splice.classB, 2692, 0.01);
  check('Default recommendation = Class B', splice.recommended === 'B');
  // When stress ≤ 0.5fy AND ≤ 50% bars spliced, Class A is allowed
  const spliceA = lapSpliceLength(2071, 200, 420, 0.5);
  check('Recommends Class A when stress + frac low', spliceA.recommended === 'A');
});

block('Phase 3 — Stirrup zoning: simply-supported beam', () => {
  // Standard 300×600 beam, 4#9 + 2#4 hangers, #3 stirrups, L=6m
  // SS UDL = 60 kN/m → Vu_max = 180 kN, Vu_mid = 0
  const input: BeamEnvelopeInput = {
    code: 'ACI 318-25', method: 'LRFD',
    geometry: { shape: 'rectangular', bw: 300, h: 600, d: 540, dPrime: 50, L: 6000, coverClear: 40 },
    materials: { fc: 28, fy: 420, fyt: 420, aggSize: 19, exposure: 'interior' },
    reinforcement: {
      tension: [{ bar: '#9', count: 4 }],
      compression: [{ bar: '#4', count: 2 }],
      stirrup: { bar: '#3', legs: 2, spacing: 200 },
    },
    demand: { kind: 'simply-supported', udl: { wu: 60 }, point: [], nStations: 21 },
    loads: { Mu: 0, Vu: 0, Ma: 230, M_DL: 140, M_LL: 90, deflectionLimitCategory: 'floor-no-attached' },
  };
  const r = analyzeEnvelope(input);
  check('elevation populated', !!r.elevation);
  if (!r.elevation) return;
  check('at least 1 stirrup zone', r.elevation.zoning.zones.length >= 1);
  check('zones cover full beam length', Math.abs(r.elevation.zoning.zones[r.elevation.zoning.zones.length - 1].xEnd - input.geometry.L) < 1);
  check('stirrup count > 10 along 6m beam', r.elevation.zoning.totalCount > 10);
  // Zones near supports should have tighter spacing than midspan
  const firstZone = r.elevation.zoning.zones[0];
  const midZone = r.elevation.zoning.zones[Math.floor(r.elevation.zoning.zones.length / 2)];
  // The midspan zone might not be looser if SS UDL is low — check that zones are CONSISTENT instead
  check('first zone spacing ≤ midspan zone spacing', firstZone.s <= midZone.s);
});

block('Phase 3 — Stirrup zoning: high-shear beam needs tight zones', () => {
  // High UDL → high Vu near supports → very tight stirrups required
  const input: BeamEnvelopeInput = {
    code: 'ACI 318-25', method: 'LRFD',
    geometry: { shape: 'rectangular', bw: 300, h: 600, d: 540, dPrime: 50, L: 6000, coverClear: 40 },
    materials: { fc: 28, fy: 420 },
    reinforcement: {
      tension: [{ bar: '#9', count: 5 }],
      compression: [{ bar: '#4', count: 2 }],
      stirrup: { bar: '#3', legs: 2, spacing: 200 },
    },
    demand: { kind: 'simply-supported', udl: { wu: 200 }, point: [], nStations: 21 },
    loads: { Mu: 0, Vu: 0 },
  };
  const r = analyzeEnvelope(input);
  if (!r.elevation) return;
  // First zone must be much tighter than midspan
  const firstZone = r.elevation.zoning.zones[0];
  check('first zone spacing tight (≤ 150 mm) for high Vu', firstZone.s <= 150);
});

block('Phase 3 — Bar curtailment: 1/3 of bars run full length', () => {
  // 6 #9 bars total → must run mustRunCount = ceil(6/3) = 2 bars (or actually ≥ 2 always)
  const input: BeamEnvelopeInput = {
    code: 'ACI 318-25', method: 'LRFD',
    geometry: { shape: 'rectangular', bw: 300, h: 600, d: 540, dPrime: 50, L: 6000, coverClear: 40 },
    materials: { fc: 28, fy: 420 },
    reinforcement: {
      tension: [{ bar: '#9', count: 6 }],
      compression: [{ bar: '#4', count: 2 }],
      stirrup: { bar: '#3', legs: 2, spacing: 200 },
    },
    demand: { kind: 'simply-supported', udl: { wu: 60 }, point: [], nStations: 21 },
    loads: { Mu: 0, Vu: 0 },
  };
  const r = analyzeEnvelope(input);
  if (!r.elevation) return;
  const tensionBars = r.elevation.curtailment.bars.filter(b => b.position === 'tension');
  const runningCount = tensionBars.filter(b => b.kind === 'running').reduce((s, b) => s + b.count, 0);
  const curtailedCount = tensionBars.filter(b => b.kind === 'curtailed').reduce((s, b) => s + b.count, 0);
  check('total tension bar count preserved', runningCount + curtailedCount === 6);
  check('running ≥ 1/3 of total per §9.7.3.8.1', runningCount >= 2);
  // Compression bars always run
  const compBars = r.elevation.curtailment.bars.filter(b => b.position === 'compression');
  check('all compression bars running (hangers)', compBars.every(b => b.kind === 'running'));
});

block('Phase 3 — Bar curtailment: extension max(d, 12·db) past theoretical cutoff', () => {
  // For d=540, db=28.7 → extension = max(540, 12·28.7=344) = 540 mm
  const input: BeamEnvelopeInput = {
    code: 'ACI 318-25', method: 'LRFD',
    geometry: { shape: 'rectangular', bw: 300, h: 600, d: 540, dPrime: 50, L: 6000, coverClear: 40 },
    materials: { fc: 28, fy: 420 },
    reinforcement: {
      tension: [{ bar: '#9', count: 6 }],     // 6 bars → 4 are curtailable
      compression: [{ bar: '#4', count: 2 }],
      stirrup: { bar: '#3', legs: 2, spacing: 200 },
    },
    demand: { kind: 'simply-supported', udl: { wu: 60 }, point: [], nStations: 21 },
    loads: { Mu: 0, Vu: 0 },
  };
  const r = analyzeEnvelope(input);
  if (!r.elevation) return;
  const curtailedBars = r.elevation.curtailment.bars.filter(b => b.kind === 'curtailed');
  if (curtailedBars.length > 0) {
    const bar = curtailedBars[0];
    check('curtailed bar has theoretical cutoff', bar.xTheoretical !== undefined);
    check('curtailed bar has actual cutoff', bar.xActual !== undefined);
    if (bar.xTheoretical !== undefined && bar.xActual !== undefined) {
      const extension = bar.xTheoretical - bar.xActual;
      check('extension ≥ max(d, 12·db) per §9.7.3.3', extension >= Math.max(540, 12 * 28.7) - 1);
    }
  }
});

block('Phase 3 — buildElevationData: dev lengths populated for all bar sizes', () => {
  const input: BeamEnvelopeInput = {
    code: 'ACI 318-25', method: 'LRFD',
    geometry: { shape: 'rectangular', bw: 300, h: 600, d: 540, dPrime: 50, L: 6000, coverClear: 40 },
    materials: { fc: 28, fy: 420 },
    reinforcement: {
      tension: [{ bar: '#9', count: 4 }],
      compression: [{ bar: '#4', count: 2 }],
      stirrup: { bar: '#3', legs: 2, spacing: 200 },
    },
    demand: { kind: 'simply-supported', udl: { wu: 60 }, point: [], nStations: 21 },
    loads: { Mu: 0, Vu: 0 },
  };
  const r = analyzeEnvelope(input);
  if (!r.elevation) return;
  check('dev length for #9 present', !!r.elevation.devLengths['#9']);
  check('dev length for #4 present (top hanger)', !!r.elevation.devLengths['#4']);
  check('lap splice for #9 present', !!r.elevation.lapSplices['#9']);
  near('#9 ld matches §25.4 simplified (~2071 mm)', r.elevation.devLengths['#9'].ld, 2071, 0.05);
});

block('Phase 3 — Stirrup zoning steel takeoff is reasonable', () => {
  const input: BeamEnvelopeInput = {
    code: 'ACI 318-25', method: 'LRFD',
    geometry: { shape: 'rectangular', bw: 300, h: 600, d: 540, dPrime: 50, L: 6000, coverClear: 40 },
    materials: { fc: 28, fy: 420 },
    reinforcement: {
      tension: [{ bar: '#9', count: 4 }],
      compression: [{ bar: '#4', count: 2 }],
      stirrup: { bar: '#3', legs: 2, spacing: 200 },
    },
    demand: { kind: 'simply-supported', udl: { wu: 60 }, point: [], nStations: 21 },
    loads: { Mu: 0, Vu: 0 },
  };
  const r = analyzeEnvelope(input);
  if (!r.elevation) return;
  // For 6m beam with stirrup perimeter ~ 1.5m and ~30 stirrups @ 0.56 kg/m: ~25 kg
  check('stirrup mass within range (10–40 kg)', r.elevation.zoning.totalMass > 10 && r.elevation.zoning.totalMass < 40);
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
