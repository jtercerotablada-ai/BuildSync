// Retaining Wall — EXTENSIVE QC
// Cross-checks every formula against SkyCiv verification models, ACI 318-19
// handbook examples, and Das (Principles of Foundation Engineering).

import { kaRankine, kpRankine, kaCoulomb, kpCoulomb, integrateActivePressure } from './src/lib/retaining-wall/earth-pressure';
import { computeStability } from './src/lib/retaining-wall/stability';
import { solveWall } from './src/lib/retaining-wall/solve';
import { flexureDesign, vcOneWay, minReinforcement, crackControl } from './src/lib/retaining-wall/design';
import type { WallInput } from './src/lib/retaining-wall/types';

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
console.log('BLOCK 12: Validation of results vs expected');
console.log('==========================================');
console.log(`  PASS: ${PASS}`);
console.log(`  FAIL: ${FAIL}`);
if (FAIL > 0) {
  console.log('\n  FAILURES:');
  fails.forEach(f => console.log('   ' + f));
}
process.exit(FAIL > 0 ? 1 : 0);
