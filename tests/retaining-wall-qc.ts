// Retaining Wall — EXTENSIVE QC
// Cross-checks every formula against SkyCiv verification models, ACI 318-19
// handbook examples, and Das (Principles of Foundation Engineering).

import { kaRankine, kpRankine, kaCoulomb, kpCoulomb, integrateActivePressure } from '../src/lib/retaining-wall/earth-pressure';
import { computeStability } from '../src/lib/retaining-wall/stability';
import { solveWall } from '../src/lib/retaining-wall/solve';
import { flexureDesign, vcOneWay, minReinforcement, crackControl } from '../src/lib/retaining-wall/design';
import {
  developmentLengthTension,
  developmentLengthHook,
  lapSpliceLength,
  pickLapSpliceClass,
  shearFrictionCapacity,
  shearFrictionRequiredArea,
  meyerhofBearing,
  multiLayerStemRebar,
} from '../src/lib/retaining-wall/aci-checks';
import type { WallInput } from '../src/lib/retaining-wall/types';

let PASS = 0;
let FAIL = 0;
const fails: string[] = [];

function expect(name: string, actual: number, expected: number, tol = 0.01) {
  const diff = Math.abs(actual - expected);
  const relDiff = expected !== 0 ? diff / Math.abs(expected) : diff;
  const ok = relDiff <= tol;
  if (ok) {
    PASS++;
    console.log(`✓ ${name}: ${actual.toFixed(4)} (expected ${expected.toFixed(4)}, diff ${(relDiff*100).toFixed(2)}%)`);
  } else {
    FAIL++;
    const msg = `✗ ${name}: GOT ${actual.toFixed(4)} EXPECTED ${expected.toFixed(4)} (${(relDiff*100).toFixed(2)}% off, tol ${(tol*100).toFixed(0)}%)`;
    console.log(msg);
    fails.push(msg);
  }
}

function expectBool(name: string, actual: boolean, expected: boolean) {
  if (actual === expected) {
    PASS++;
    console.log(`✓ ${name}: ${actual}`);
  } else {
    FAIL++;
    const msg = `✗ ${name}: GOT ${actual} EXPECTED ${expected}`;
    console.log(msg);
    fails.push(msg);
  }
}

console.log('\n==========================================');
console.log('BLOCK 1: Earth pressure coefficients');
console.log('==========================================');
// Rankine Ka for level backfill: Ka = (1-sinφ)/(1+sinφ) = tan²(45 - φ/2)
expect('Ka Rankine φ=30° level', kaRankine(30*Math.PI/180, 0), (1-Math.sin(30*Math.PI/180))/(1+Math.sin(30*Math.PI/180)), 0.001);
expect('Ka Rankine φ=35° level', kaRankine(35*Math.PI/180, 0), 0.271, 0.01);
expect('Ka Rankine φ=40° level', kaRankine(40*Math.PI/180, 0), 0.217, 0.01);
// Rankine Kp for level: Kp = (1+sinφ)/(1-sinφ) = tan²(45 + φ/2)
expect('Kp Rankine φ=30° level', kpRankine(30*Math.PI/180, 0), (1+Math.sin(30*Math.PI/180))/(1-Math.sin(30*Math.PI/180)), 0.001);
expect('Kp Rankine φ=35° level', kpRankine(35*Math.PI/180, 0), 3.69, 0.02);
// Rankine Ka sloped backfill β=10°, φ=35° — from Das Table 13.3
expect('Ka Rankine φ=35° β=10°', kaRankine(35*Math.PI/180, 10*Math.PI/180), 0.282, 0.02);
// Coulomb Ka with δ=0 should equal Rankine
expect('Ka Coulomb φ=35° δ=0 β=0', kaCoulomb(35*Math.PI/180, 0, 0), 0.271, 0.01);
// Coulomb Ka with δ=2/3·φ=23.3°, β=0 — from Das Table 13.5
expect('Ka Coulomb φ=35° δ=23.3° β=0', kaCoulomb(35*Math.PI/180, 0, 23.3*Math.PI/180), 0.244, 0.02);

console.log('\n==========================================');
console.log('BLOCK 2: SkyCiv Model 2 (Metric) full wall');
console.log('==========================================');
// Stem 3.124×0.305, offset 0.686, Base 2.210×0.381, γ=18.85, φ=35°, μ=0.55
// q=17.237 kPa, qAllow=143.641 kPa
// Passive depth=0.975, substructure=0.792
// Expected FS: OT=2.897, Sliding=1.556, Bearing util ≈ 0.64 (i.e. qMax ≈ 93 kPa)
const model2: WallInput = {
  geometry: {
    kind: 'cantilever',
    H_stem: 3124,
    t_stem_top: 305,
    t_stem_bot: 305,
    B_toe: 686,
    B_heel: 2210 - 686 - 305, // 1219
    H_foot: 381,
    backfillSlope: 0,
    frontFill: 975 - 381, // 594 (passive soil above footing top)
  },
  concrete: { fc: 28, fy: 420, Es: 200_000, gamma: 23.56, cover: 75 },
  backfill: [{ name: 'Active', gamma: 18.85, phi: 35*Math.PI/180, c: 0, thickness: 0 }],
  baseSoil: {
    gamma: 18.85,
    phi: 35*Math.PI/180,
    c: 0,
    delta: Math.atan(0.55),  // 28.8° to match μ=0.55
    ca: 0,
    qAllow: 143.641,
    passiveEnabled: false,  // SkyCiv verification models disable passive
  },
  water: { enabled: false, depthFromStemTop: 0, gammaW: 9.81 },
  loads: { surchargeQ: 17.237, seismic: { kh: 0, kv: 0 } },
  theory: 'rankine',
  safetyFactors: { overturning: 2.0, sliding: 1.5, bearing: 3.0, eccentricity: 'kern' },
};
const r2 = solveWall(model2);
expect('Model 2 Ka', r2.pressure.K, 0.271, 0.01);
expect('Model 2 Pa total (Pa+Pq)', r2.pressure.Pa + r2.pressure.Pq, 31.377 + 16.372, 0.05);
expect('Model 2 FS_overturning', r2.stability.FS_overturning, 2.897, 0.05);
expect('Model 2 FS_sliding', r2.stability.FS_sliding, 1.556, 0.05);

console.log('\n==========================================');
console.log('BLOCK 3: SkyCiv Model 3 (Imperial→SI): taller wall with no surcharge');
console.log('==========================================');
// Imperial: stem 16.75 ft × 1.25 ft × 2.5 ft offset, base 9.25×1.25, γ=110pcf, φ=35°, μ=0.5
// qAllow=3 ksf, passive 3ft, substructure 3ft, no surcharge
// Expected: FS_OT=2.889, FS_Sliding=1.554, FS_Bearing=1.131, qMax=2.653 ksf
// Convert: 1 ft = 304.8 mm, 1 pcf = 0.1571 kN/m³, 1 ksf = 47.88 kPa
const FT = 304.8;
const PCF = 0.1571;
const KSF = 47.88;
const model3: WallInput = {
  geometry: {
    kind: 'cantilever',
    H_stem: 16.75 * FT,
    t_stem_top: 1.25 * FT,
    t_stem_bot: 1.25 * FT,
    B_toe: 2.5 * FT,
    B_heel: (9.25 - 2.5 - 1.25) * FT,
    H_foot: 1.25 * FT,
    backfillSlope: 0,
    frontFill: (3 - 1.25) * FT, // passive zone above footing top
  },
  concrete: { fc: 28, fy: 420, Es: 200_000, gamma: 23.56, cover: 75 },
  backfill: [{ name: 'Active', gamma: 110 * PCF, phi: 35*Math.PI/180, c: 0, thickness: 0 }],
  baseSoil: {
    gamma: 110 * PCF,
    phi: 35*Math.PI/180,
    c: 0,
    delta: Math.atan(0.5),
    ca: 0,
    qAllow: 3 * KSF,
    passiveEnabled: false,  // SkyCiv verification disables passive
  },
  water: { enabled: false, depthFromStemTop: 0, gammaW: 9.81 },
  loads: { surchargeQ: 0, seismic: { kh: 0, kv: 0 } },
  theory: 'rankine',
  safetyFactors: { overturning: 2.0, sliding: 1.5, bearing: 3.0, eccentricity: 'kern' },
};
const r3 = solveWall(model3);
expect('Model 3 FS_overturning', r3.stability.FS_overturning, 2.889, 0.08);
expect('Model 3 FS_sliding', r3.stability.FS_sliding, 1.554, 0.08);
expect('Model 3 qMax (kPa)', r3.stability.qMax, 2.653 * KSF, 0.1);
expect('Model 3 qMin (kPa)', r3.stability.qMin, 0.593 * KSF, 0.1);
expect('Model 3 eccentricity (mm)', r3.stability.eccentricity, 0.978 * FT, 0.1);
expectBool('Model 3 eccentricity OK (within kern)', r3.stability.eccentricityOk, true);

console.log('\n==========================================');
console.log('BLOCK 4: Das textbook example — level cohesionless backfill');
console.log('==========================================');
// Das Ex 13.3: H=5m, γ=16.5 kN/m³, φ=35°, no surcharge, Rankine
// Expected: Pa = 0.5·Ka·γ·H² = 0.5·0.271·16.5·25 = 55.89 kN/m, acts at H/3
{
  const pts = integrateActivePressure(
    5000,
    [{ name:'s', gamma:16.5, phi:35*Math.PI/180, c:0, thickness:0 }],
    0.271,
    { surchargeQ: 0, seismic: { kh:0, kv:0 } },
    { enabled: false, depthFromStemTop: 0, gammaW: 9.81 },
  );
  expect('Das Pa', pts.Pa, 55.89, 0.03);
  expect('Das yBar (m from base)', pts.yBar/1000, 5/3, 0.05);
}

console.log('\n==========================================');
console.log('BLOCK 5: ACI 318-19 Flexure design — rectangular beam');
console.log('==========================================');
// McCormac Ex 3.2-style: Mu=200 kN·m/m, b=1000 mm, h=500 mm, cover=75 mm, fc=28, fy=420
// d = 500 - 75 - 16/2 = 417 mm. Phi=0.9. Rn = Mu/(φbd²) = 200e6/(0.9·1000·417²) = 1.278 MPa
// ρ = (0.85·28/420)·[1 - √(1 - 2·1.278·420/(0.85·28·420))] ≈ 0.00317
// As = ρ·b·d ≈ 1321 mm²/m
{
  const r = flexureDesign(200, 500, 75, 28, 420);
  expect('ACI flexure d', r.d, 417, 0.02);
  expect('ACI flexure As (Mu=200)', r.As, 1321, 0.05);
}

console.log('\n==========================================');
console.log('BLOCK 6: ACI 318-19 One-way shear Vc');
console.log('==========================================');
// Vc = 0.17·λ·√fc·b·d, λ=1 (normal weight), fc=28 MPa, b=1000, d=417
// Vc = 0.17·1·√28·1000·417 = 0.17·5.29·1000·417 = 374.7 kN/m
expect('Vc one-way (fc=28, d=417)', vcOneWay(28, 1000, 417), 374.7, 0.02);
expect('Vc one-way (fc=21, d=300)', vcOneWay(21, 1000, 300), 0.17*Math.sqrt(21)*1000*300/1000, 0.01);

console.log('\n==========================================');
console.log('BLOCK 7: ACI minimum reinforcement');
console.log('==========================================');
// Slab min: ρ=0.0018 for Grade 60 (fy=420). For h=500: As_min = 0.0018·1000·500 = 900 mm²/m
expect('Min reinforcement slab (h=500, fy=420)', minReinforcement(500, 420), 900, 0.001);
// For fy=500: scales by 420/500 = 0.84 → ρ=0.001512, As_min = 756
expect('Min reinforcement slab (h=500, fy=500)', minReinforcement(500, 500), 0.0018*1000*500*420/500, 0.001);

console.log('\n==========================================');
console.log('BLOCK 8: ACI §24.3.2 crack control');
console.log('==========================================');
// fs = 2/3·fy = 280 MPa. s_max = min(380·(280/280) - 2.5·cc, 300·(280/280))
//   = min(380 - 2.5·75, 300) = min(192.5, 300) = 192.5 mm
{
  const cc = crackControl(1000, 420, 75);
  expect('Crack s_max (fy=420, cc=75)', cc.s_max, 192.5, 0.005);
  // With larger cover 50 → s_max = min(380 - 125, 300) = 255
  const cc2 = crackControl(1000, 420, 50);
  expect('Crack s_max (fy=420, cc=50)', cc2.s_max, 255, 0.005);
}

console.log('\n==========================================');
console.log('BLOCK 9: Edge cases');
console.log('==========================================');
// 9a: very short wall (H_stem=600) with default fill → should pass everything
const shortWall = solveWall({
  ...model2,
  geometry: { ...model2.geometry, H_stem: 600, t_stem_bot: 250, t_stem_top: 200, H_foot: 300, B_toe: 300, B_heel: 400 },
  loads: { ...model2.loads, surchargeQ: 0 },
});
expectBool('Short wall OT OK', shortWall.stability.overturningOk, true);
expectBool('Short wall Sliding OK', shortWall.stability.slidingOk, true);

// 9b: narrow wall — should fail overturning
const narrowWall = solveWall({
  ...model2,
  geometry: { ...model2.geometry, B_heel: 400, B_toe: 200 },
});
expectBool('Narrow wall OT FAIL', narrowWall.stability.overturningOk, false);
expectBool('Narrow wall bearing FAIL', narrowWall.stability.bearingOk, false);

// 9c: water table at the surface — max hydrostatic force
const wetWall = solveWall({
  ...model2,
  water: { enabled: true, depthFromStemTop: 0, gammaW: 9.81 },
});
// Pw = 0.5·γw·Hw² for Hw=3.505m = 0.5·9.81·12.285 = 60.25 kN/m additional
const expectedPw = 0.5 * 9.81 * Math.pow(3.505, 2);
expect('Wet wall Pw', wetWall.pressure.Pw, expectedPw, 0.02);

// 9d: seismic kh=0.2 — should reduce FS_OT significantly
const seismicWall = solveWall({
  ...model2,
  loads: { ...model2.loads, seismic: { kh: 0.2, kv: 0 } },
});
const FS_ratio = seismicWall.stability.FS_overturning / r2.stability.FS_overturning;
console.log(`  Seismic reduces FS_OT by ${((1-FS_ratio)*100).toFixed(0)}% (expected 10-30%)`);
expectBool('Seismic reduces FS_OT', seismicWall.stability.FS_overturning < r2.stability.FS_overturning, true);

console.log('\n==========================================');
console.log('BLOCK 10: Dimensional consistency spot checks');
console.log('==========================================');
// Pa should scale with H² — doubling H should 4× Pa
{
  const p1 = integrateActivePressure(3000, [{name:'s',gamma:18,phi:35*Math.PI/180,c:0,thickness:0}], 0.271, { surchargeQ:0, seismic:{kh:0,kv:0} }, { enabled:false, depthFromStemTop:0, gammaW:9.81 });
  const p2 = integrateActivePressure(6000, [{name:'s',gamma:18,phi:35*Math.PI/180,c:0,thickness:0}], 0.271, { surchargeQ:0, seismic:{kh:0,kv:0} }, { enabled:false, depthFromStemTop:0, gammaW:9.81 });
  expect('Pa scales with H² (ratio=4)', p2.Pa/p1.Pa, 4, 0.02);
}

console.log('\n==========================================');
console.log('BLOCK 11: Load factors & ACI design checks');
console.log('==========================================');
// Stem design Mu is based on H_STEM only (stem cantilevers from footing top).
// Compute expected by integrating pressure over stem height independently.
{
  const stemInteg = integrateActivePressure(
    3124,
    model2.backfill,
    0.271,
    model2.loads,
    model2.water
  );
  const H_stem_drive = stemInteg.Pa + stemInteg.Pq + stemInteg.Pw + stemInteg.dPae;
  const yBar_stem = stemInteg.yBar / 1000;
  const stemMuEst = 1.6 * H_stem_drive * yBar_stem; // kN·m/m
  console.log(`  Stem expected Mu (from integration) = ${stemMuEst.toFixed(1)} kN·m/m`);
  console.log(`  Stem solver Mu = ${r2.stem.Mu.toFixed(1)} kN·m/m`);
  expect('Stem Mu matches stem-only integration', r2.stem.Mu, stemMuEst, 0.03);
}

console.log('\n==========================================');
console.log('BLOCK 12: Gravity wall — stability + ACI §14.5 stress');
console.log('==========================================');
// Trapezoidal gravity wall: stem 4 m tall, t_top = 0.6 m, t_bot = 1.5 m
// (typical mass-concrete profile per Wight & MacGregor §17.3). Granular
// backfill φ=32°, γ=18 kN/m³, no surcharge. f'c = 21 MPa (low-strength
// gravity-wall mix). Verify the solver returns gravityStress and that
// the wall body's compression stress stays within 0.45·f'c.
{
  const gravity: WallInput = {
    code: 'ACI 318-25',
    geometry: {
      kind: 'gravity',
      H_stem: 4000,
      t_stem_top: 600,
      t_stem_bot: 1500,
      B_toe: 600,
      B_heel: 600,
      H_foot: 600,
      backfillSlope: 0,
      frontFill: 0,
      batterFront: 0,
      batterBack: 0,
    },
    concrete: { fc: 21, fy: 420, Es: 200_000, gamma: 24, cover: 75 },
    backfill: [{ name: 'Granular', gamma: 18, phi: 32 * Math.PI / 180, c: 0, thickness: 0 }],
    baseSoil: {
      gamma: 19, phi: 30 * Math.PI / 180, c: 0,
      delta: 20 * Math.PI / 180, ca: 0,
      qAllow: 250, passiveEnabled: false,
    },
    water: { enabled: false, depthFromStemTop: 0, gammaW: 9.81 },
    loads: { surchargeQ: 0, seismic: { kh: 0, kv: 0 } },
    theory: 'rankine',
    safetyFactors: { overturning: 2.0, sliding: 1.5, bearing: 3.0, eccentricity: 'kern' },
  };
  const result = solveWall(gravity);
  expectBool('Gravity wall returned gravityStress', !!result.gravityStress, true);
  if (result.gravityStress) {
    const sigma_max_MPa = result.gravityStress.sigma_max / 1000;
    const sigma_allow_MPa = result.gravityStress.sigma_allow / 1000;
    console.log(`  σ_max = ${sigma_max_MPa.toFixed(2)} MPa, σ_allow = ${sigma_allow_MPa.toFixed(2)} MPa`);
    // φ·0.45·f'c with f'c = 21 MPa: 0.60 · 0.45 · 21 = 5.67 MPa
    expect('Gravity σ_allow = 0.60·0.45·f\'c', sigma_allow_MPa, 0.60 * 0.45 * 21, 0.001);
    expectBool('Gravity wall compression OK at base', sigma_max_MPa <= sigma_allow_MPa, true);
  }
  expectBool('Gravity wall solver does not require rebar (As_req = 0)', result.stem.As_req === 0, true);
}

console.log('\n==========================================');
console.log('BLOCK 13: Semi-gravity wall (cantilever equivalent + intent flag)');
console.log('==========================================');
{
  const semi: WallInput = {
    code: 'ACI 318-25',
    geometry: {
      kind: 'semi-gravity',
      H_stem: 1500, t_stem_top: 200, t_stem_bot: 250,
      B_toe: 400, B_heel: 700, H_foot: 350,
      backfillSlope: 0, frontFill: 200,
    },
    concrete: { fc: 28, fy: 420, Es: 200_000, gamma: 24, cover: 75 },
    backfill: [{ name: 'Granular', gamma: 19, phi: 32 * Math.PI / 180, c: 0, thickness: 0 }],
    baseSoil: {
      gamma: 19, phi: 30 * Math.PI / 180, c: 0,
      delta: 20 * Math.PI / 180, ca: 0, qAllow: 200, passiveEnabled: false,
    },
    water: { enabled: false, depthFromStemTop: 0, gammaW: 9.81 },
    loads: { surchargeQ: 5, seismic: { kh: 0, kv: 0 } },
    theory: 'rankine',
    safetyFactors: { overturning: 2.0, sliding: 1.5, bearing: 3.0, eccentricity: 'kern' },
  };
  const result = solveWall(semi);
  // Same input as a cantilever wall should produce the same Mu/Vu/As_req
  const cantEq: WallInput = { ...semi, geometry: { ...semi.geometry, kind: 'cantilever' } };
  const cantResult = solveWall(cantEq);
  expect('Semi-gravity stem Mu == cantilever Mu', result.stem.Mu, cantResult.stem.Mu, 0.001);
  expect('Semi-gravity stem As_req == cantilever As_req', result.stem.As_req, cantResult.stem.As_req, 0.001);
  expectBool('Semi-gravity flags intent in issues', result.issues[0]?.includes('Semi-gravity'), true);
}

console.log('\n==========================================');
console.log('BLOCK 14: L-shaped wall (B_toe = 0)');
console.log('==========================================');
{
  const lshape: WallInput = {
    code: 'ACI 318-25',
    geometry: {
      kind: 'l-shaped',
      H_stem: 2500, t_stem_top: 250, t_stem_bot: 300,
      B_toe: 0,           // L-shaped: no toe
      B_heel: 1800, H_foot: 400,
      backfillSlope: 0, frontFill: 0,
      stemLean: 0,
    },
    concrete: { fc: 28, fy: 420, Es: 200_000, gamma: 24, cover: 75 },
    backfill: [{ name: 'Granular', gamma: 19, phi: 32 * Math.PI / 180, c: 0, thickness: 0 }],
    baseSoil: {
      gamma: 19, phi: 30 * Math.PI / 180, c: 0,
      delta: 20 * Math.PI / 180, ca: 0, qAllow: 200, passiveEnabled: false,
    },
    water: { enabled: false, depthFromStemTop: 0, gammaW: 9.81 },
    loads: { surchargeQ: 0, seismic: { kh: 0, kv: 0 } },
    theory: 'rankine',
    safetyFactors: { overturning: 2.0, sliding: 1.5, bearing: 3.0, eccentricity: 'kern' },
  };
  const result = solveWall(lshape);
  expectBool('L-shaped: toe Mu = 0', result.toe.Mu === 0, true);
  expectBool('L-shaped: toe As_req = 0', result.toe.As_req === 0, true);
  // Stem still works normally
  expectBool('L-shaped: stem still cantilevers (As_req > 0)', result.stem.As_req > 0, true);
  expectBool('L-shaped: footing total width = B_heel + t_stem_bot', result.stability.B === 0 + 300 + 1800, true);
  expectBool('L-shaped flags intent in issues', result.issues.some((m) => m.includes('L-shaped')), true);
}

console.log('\n==========================================');
console.log('BLOCK 15: Development length (ACI 318-25 §25.4.2)');
console.log('==========================================');
{
  // #6 bar (db = 19 mm), fy = 420 MPa, f'c = 28 MPa, normal-weight, uncoated.
  // Default factors: ψt = ψe = 1.0, ψg = 1.0, ψs = 0.8 (#6 ≤ 19 mm), λ = 1.0.
  // Cap (cb+Ktr)/db = 2.5.
  // ld = (19 · 420 · 1 · 1 · 0.8 · 1) / (1.1 · 1 · √28 · 2.5)
  //    = (19 · 336) / (1.1 · 5.2915 · 2.5)
  //    = 6384 / 14.5516 ≈ 438.7 mm
  const r = developmentLengthTension(19, 420, 28, 600);
  console.log(`  ld(#6, 420/28) = ${r.ld} mm; ldh = ${r.ldh} mm`);
  expect('#6 ld ≈ 439 mm', r.ld, 439, 0.02);
  expectBool('available 600 ≥ ld 439 → ok', r.ok, true);
  // Tighter test on hook: ldh = (fy · 1 · 1 · 1 · 1 · 1 / (23 · √28)) · db^1.5
  //                          = (420 / (23 · 5.2915)) · 19^1.5
  //                          = (420 / 121.71) · 82.82 ≈ 285.7 mm
  expect('#6 ldh ≈ 286 mm', r.ldh, 286, 0.02);

  // ψs = 1.0 for #7 (db = 22.2 mm)
  const r7 = developmentLengthTension(22.2, 420, 28, 800);
  expect('#7 ld factor (ψs = 1.0)', r7.ld, 19 * 420 * 1 / (1.1 * Math.sqrt(28) * 2.5) * (22.2 / 19), 0.05);
}

console.log('\n==========================================');
console.log('BLOCK 16: Standard 90° hook (ACI 318-25 §25.4.3)');
console.log('==========================================');
{
  // #5 bar (db = 16 mm), fy = 420, f'c = 28, default factors → 1.0 each.
  // ldh = (420 / (23 · √28)) · 16^1.5
  //     = (420 / 121.71) · 64 ≈ 220.8 mm
  // minimum 8 db = 128, 150 → governing 220.8
  const r = developmentLengthHook(16, 420, 28, 300);
  expect('#5 ldh ≈ 221 mm', r.ldh, 221, 0.02);
  expectBool('300 mm available > 221 mm hook', r.ok, true);

  // Tight cover (ψc = 0.7) cuts ldh
  const rTight = developmentLengthHook(16, 420, 28, 300, { psi_c: 0.7 });
  expect('hook with ψc=0.7 reduces ldh by 30 %', rTight.ldh, 221 * 0.7, 0.02);
}

console.log('\n==========================================');
console.log('BLOCK 17: Lap-splice length (ACI 318-25 §25.5.2)');
console.log('==========================================');
{
  const ld = 500;
  const A = lapSpliceLength(ld, 'A', 600);
  expect('Class A ls = 1.0 · ld', A.ls, 500, 0.001);
  expectBool('Class A ok at 600 available', A.ok, true);
  const B = lapSpliceLength(ld, 'B', 600);
  expect('Class B ls = 1.3 · ld', B.ls, 650, 0.01);
  expectBool('Class B FAILS at 600 available', B.ok, false);
  // Class picker
  expectBool('As,prov=2x req, ≤50% spliced → Class A', pickLapSpliceClass(1000, 500, 0.5) === 'A', true);
  expectBool('As,prov=1.5x req → Class B', pickLapSpliceClass(750, 500, 0.5) === 'B', true);
  expectBool('60% spliced even with 2x area → Class B', pickLapSpliceClass(1000, 500, 0.6) === 'B', true);
}

console.log('\n==========================================');
console.log('BLOCK 18: Shear-friction at construction joint (§22.9)');
console.log('==========================================');
{
  // Stem-footing joint with intentional roughening: μ = 1.0·λ = 1.0
  // Vu = 50 kN/m factored, fy = 420, φ = 0.75
  // Avf,req = 50 · 1000 / (0.75 · 1.0 · 420) = 158.7 mm²/m
  const Avf_req = shearFrictionRequiredArea(50, 420, 1.0, 0.75);
  expect('Shear-friction Avf_req ≈ 159 mm²/m', Avf_req, 158.7, 0.02);
  // Capacity with Avf = 200 mm²/m
  const cap = shearFrictionCapacity(200, 420, 1.0, 28);
  // Vn = 1.0 · 200 · 420 = 84_000 N/m → 84 kN/m
  expect('Shear-friction Vn(200, 420) = 84 kN/m', cap.Vn, 84, 0.001);
  // Cap (Ac = 1000·400 = 400_000 mm²): 0.2·28·400_000 = 2_240_000 N → 2240 kN/m
  // 5.5·400_000 = 2_200_000 N → 2200 kN/m → governs
  expect('Vn cap ≈ 2200 kN/m', cap.Vn_max, 2200, 0.001);
}

console.log('\n==========================================');
console.log('BLOCK 19: Meyerhof / Vesić bearing capacity');
console.log('==========================================');
{
  // Strip footing, 2 m wide, 0 m embedment, sand φ=30°, c=0, γ=18 kN/m³.
  // qu = 0.5 · γ · B · Nγ for c = 0, q = 0.
  // Nq(30°) = e^(π·tan30) · tan²(60) = e^1.8138 · 3 = 6.146 · 3 = 18.40
  // Nγ Vesić = 2(Nq+1)tanφ = 2·19.40·0.5774 = 22.40
  const r = meyerhofBearing({
    c: 0, gamma: 18, B: 2000, L: 20000, Df: 0,
    phi: 30 * Math.PI / 180, q: 0, H: 0, V: 100,
    FS_bearing: 3.0,
  });
  expect('Nq(30°) ≈ 18.4', r.Nq, 18.40, 0.02);
  expect('Nγ Vesić(30°) ≈ 22.4', r.Ng, 22.40, 0.05);
  expect('Nc(30°) ≈ 30.14', r.Nc, 30.14, 0.05);
  // qu = 0.5 · 18 · 2 · 22.4 · sγ · dγ · iγ
  //    sγ ≈ 1 - 0.4·(2/20) = 0.96
  //    dγ = 1, iγ ≈ 1 (β=0)
  //    qu ≈ 18 · 22.4 · 0.96 ≈ 387 kPa
  expect('Strip qu (φ=30, B=2m) ≈ 387 kPa', r.qu, 387, 0.05);
  // Inclination check: H/V = 0 → iq = ic = iγ = 1
  expectBool('Vertical load → iq = 1', Math.abs(r.iq - 1) < 1e-6, true);
}

console.log('\n==========================================');
console.log('BLOCK 20: Multi-layer stem rebar curtailment (§9.7.3)');
console.log('==========================================');
{
  // Cantilever stem H = 4 m, base demand Mu(0) = 80 kN·m/m, decreasing
  // cubically to 0 at top. Use 11 sample points.
  const H = 4000;
  const Mu_base = 80;
  const envelope = Array.from({ length: 11 }, (_, i) => {
    const y = (i / 10) * H;
    const M = Mu_base * Math.pow(1 - y / H, 3);
    return { y, M };
  });
  const zones = multiLayerStemRebar({
    envelope, d_base: 350, db_base: 19, cover: 75,
    fc: 28, fy: 420, h_base: 400,
    As_min: 720, barLabel: '#6', spacing_base: 200,
  });
  expectBool('Two zones produced (base + light)', zones.length === 2, true);
  expectBool('Zone 1 starts at base (y=0)', zones[0].yStart === 0, true);
  expectBool('Zone 1 As ≥ As_min (peak demand floored at As_min)', zones[0].As_per_m >= 720, true);
  expectBool('Zone 2 As = As_min', zones[1].As_per_m === 720, true);
  expectBool('Zones cover full height', zones[zones.length - 1].yEnd === H, true);
  // Cut point should be at least at y where M < 50% Mmax PLUS the shift rule
  // (max(d, 12db) = max(350, 228) = 350). M=40 occurs at y where (1-y/H)^3=0.5
  // → y/H = 1 - 0.5^(1/3) ≈ 0.206 → y ≈ 825 mm. Plus shift 350 → 1175 mm.
  expectBool('Zone 1 ends near M=50% point + shift', zones[0].yEnd >= 800, true);
}

console.log('\n==========================================');
console.log('BLOCK 21: Basement (restrained-top) wall — propped cantilever');
console.log('==========================================');
{
  // Stem 4 m tall, propped at top by floor slab (pinned). Active pressure
  // governed by Ka·γ·H at base (typical basement wall).
  const basement: WallInput = {
    code: 'ACI 318-25',
    geometry: {
      kind: 'basement',
      H_stem: 4000, t_stem_top: 300, t_stem_bot: 350,
      B_toe: 600, B_heel: 1200, H_foot: 500,
      backfillSlope: 0, frontFill: 0,
      topElevation: 4000, topFixity: 'pinned',
    },
    concrete: { fc: 28, fy: 420, Es: 200_000, gamma: 24, cover: 75 },
    backfill: [{ name: 'Granular', gamma: 18, phi: 32 * Math.PI / 180, c: 0, thickness: 0 }],
    baseSoil: {
      gamma: 19, phi: 30 * Math.PI / 180, c: 0,
      delta: 20 * Math.PI / 180, ca: 0, qAllow: 250, passiveEnabled: false,
    },
    water: { enabled: false, depthFromStemTop: 0, gammaW: 9.81 },
    loads: { surchargeQ: 10, seismic: { kh: 0, kv: 0 } },
    theory: 'rankine',
    safetyFactors: { overturning: 2.0, sliding: 1.5, bearing: 3.0, eccentricity: 'kern' },
  };
  const r = solveWall(basement);
  // p_max,tri = γ·Ka·H = 18 · 0.307 · 4 = 22.10 kPa
  // Ka(rankine, 32°, level) = (1-sin32)/(1+sin32) = 0.307
  // M_base,tri = (7/120) · 22.10 · 16 = 20.63 kN·m/m  (unfactored)
  // Factored × 1.6 = 33.0 kN·m/m
  const Ka = (1 - Math.sin(32*Math.PI/180)) / (1 + Math.sin(32*Math.PI/180));
  const p_tri = 18 * Ka * 4;
  const Mbase_tri = (7/120) * p_tri * 16;
  // Surcharge (q=10): p_uni = Ka · 10 = 3.07 kPa, M_base,uni = (1/8)·3.07·16 = 6.13
  const p_uni = Ka * 10;
  const Mbase_uni = (1/8) * p_uni * 16;
  const Mbase_expected_factored = 1.6 * (Mbase_tri + Mbase_uni);
  console.log(`  M_base expected = ${Mbase_expected_factored.toFixed(2)} kN·m/m, solver = ${r.stem.Mu.toFixed(2)}`);
  expect('Basement stem M_base (factored)', r.stem.Mu, Mbase_expected_factored, 0.05);
  expectBool('Basement returned topSupport', !!r.topSupport, true);
  if (r.topSupport) {
    // R_top,tri = (9/40) · 22.10 · 4 = 19.89 kN/m, R_top,uni = (3/8) · 3.07 · 4 = 4.61
    const Rtri = (9/40) * p_tri * 4;
    const Runi = (3/8) * p_uni * 4;
    const R_expected = 1.6 * (Rtri + Runi);
    expect('Basement top reaction (factored)', r.topSupport.reaction, R_expected, 0.05);
  }
  expectBool('Stem returns frontFace (positive moment)', !!r.stem.frontFace, true);
  if (r.stem.frontFace) {
    expectBool('Front-face Mu > 0 (positive span moment)', r.stem.frontFace.Mu > 0, true);
    expectBool('Front-face As_req ≥ As_min', r.stem.frontFace.As_req >= r.stem.As_min, true);
  }
}

console.log('\n==========================================');
console.log('BLOCK 22: Validation of results vs expected');
console.log('==========================================');
console.log(`  PASS: ${PASS}`);
console.log(`  FAIL: ${FAIL}`);
if (FAIL > 0) {
  console.log('\n  FAILURES:');
  fails.forEach(f => console.log('   ' + f));
}
process.exit(FAIL > 0 ? 1 : 0);
