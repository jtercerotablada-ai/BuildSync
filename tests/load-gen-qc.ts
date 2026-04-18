// Load Generator — QC against ASCE 7-22 hand calcs.
import { kz, ke, qz, cpWall, solveAsce722Wind } from '../src/lib/load-gen/asce7-22-wind';
import { lookupWindSpeedMs } from '../src/lib/load-gen/asce7-22-wind-speed-data';

let PASS = 0;
let FAIL = 0;
const fails: string[] = [];

function expect(name: string, actual: number, expected: number, tol = 0.02) {
  const diff = Math.abs(actual - expected);
  const rel = expected !== 0 ? diff / Math.abs(expected) : diff;
  const ok = rel <= tol;
  if (ok) {
    PASS++;
    console.log(`✓ ${name}: ${actual.toFixed(3)} (expected ${expected.toFixed(3)}, ${(rel*100).toFixed(1)}%)`);
  } else {
    FAIL++;
    const m = `✗ ${name}: GOT ${actual.toFixed(3)} EXPECTED ${expected.toFixed(3)} (${(rel*100).toFixed(1)}% off, tol ${(tol*100).toFixed(0)}%)`;
    console.log(m);
    fails.push(m);
  }
}

// Unit helpers for display
const MPH = 0.44704;

console.log('\n=== BLOCK 1: City wind-speed lookups (ASCE 7-22 Fig 26.5-1 Risk II) ===');
{
  const miami = lookupWindSpeedMs(25.7617, -80.1918, 'II');
  expect('Miami V (mph)', miami.V_mph, 170, 0.03);
  const nyc = lookupWindSpeedMs(40.7128, -74.006, 'II');
  expect('New York V (mph)', nyc.V_mph, 115, 0.03);
  const la = lookupWindSpeedMs(34.0522, -118.2437, 'II');
  expect('Los Angeles V (mph)', la.V_mph, 95, 0.03);
  const sanJuan = lookupWindSpeedMs(18.4655, -66.1057, 'II');
  expect('San Juan V (mph)', sanJuan.V_mph, 165, 0.03);
}

console.log('\n=== BLOCK 2: Risk-category scaling ===');
{
  const r1 = lookupWindSpeedMs(25.7617, -80.1918, 'I');
  expect('Miami Risk I', r1.V_mph, 170 * 0.94, 0.02);
  const r3 = lookupWindSpeedMs(25.7617, -80.1918, 'III');
  expect('Miami Risk III', r3.V_mph, 170 * 1.06, 0.02);
  const r4 = lookupWindSpeedMs(25.7617, -80.1918, 'IV');
  expect('Miami Risk IV', r4.V_mph, 170 * 1.12, 0.02);
}

console.log('\n=== BLOCK 3: Kz velocity pressure coefficient (Table 26.10-1) ===');
{
  // ASCE Table 26.10-1 values for Exposure C:
  //   z = 15 ft (4.57 m):  Kz = 0.85
  //   z = 30 ft (9.14 m):  Kz = 0.98
  //   z = 60 ft (18.29 m): Kz = 1.13
  //   z = 100 ft (30.5 m): Kz = 1.26
  expect('Kz(15ft, C)', kz(4.57, 'C'), 0.85, 0.03);
  expect('Kz(30ft, C)', kz(9.14, 'C'), 0.98, 0.03);
  expect('Kz(60ft, C)', kz(18.29, 'C'), 1.13, 0.03);
  expect('Kz(100ft, C)', kz(30.48, 'C'), 1.26, 0.03);
  // Exposure B table values
  //   z = 15 ft: Kz = 0.57; z = 30 ft: Kz = 0.70; z = 60 ft: Kz = 0.85
  expect('Kz(15ft, B)', kz(4.57, 'B'), 0.57, 0.05);
  expect('Kz(30ft, B)', kz(9.14, 'B'), 0.70, 0.04);
  expect('Kz(60ft, B)', kz(18.29, 'B'), 0.85, 0.04);
  // Exposure D
  //   z = 15 ft: Kz = 1.03; z = 30 ft: Kz = 1.16
  expect('Kz(15ft, D)', kz(4.57, 'D'), 1.03, 0.03);
  expect('Kz(30ft, D)', kz(9.14, 'D'), 1.16, 0.03);
}

console.log('\n=== BLOCK 4: Ke ground elevation factor (Table 26.9-1) ===');
{
  expect('Ke(0 m)', ke(0), 1.0, 0.01);
  expect('Ke(500 m)', ke(500), 0.94, 0.03);
  expect('Ke(1000 m)', ke(1000), 0.89, 0.03);
}

console.log('\n=== BLOCK 5: qz velocity pressure (Eq 26.10-1) ===');
{
  // From ASCE 7-22 Example: V=115 mph, Kz=0.85, Kzt=Kd=Ke=1 → qz ≈ 28.8 psf
  // (using 0.00256 form: qz = 0.00256·0.85·1·1·1·115² = 28.79 psf)
  // In SI: V = 115·0.44704 = 51.41 m/s, qz = 0.613·0.85·1·1·1·51.41² = 1377 Pa
  // 28.79 psf · 47.88 = 1378 Pa ✓
  const V = 115 * MPH;
  const q = qz(V, 0.85, 1, 1, 1);
  expect('qz (V=115 mph, Kz=0.85)', q, 1378, 0.03);

  // With Kd = 0.85 (Table 26.6-1 for MWFRS buildings)
  const q2 = qz(V, 0.85, 1, 0.85, 1);
  expect('qz (V=115 mph, Kd=0.85)', q2, 1378 * 0.85, 0.03);
}

console.log('\n=== BLOCK 6: Wall Cp coefficients (Fig 27.3-1) ===');
{
  const short = cpWall(0.8);  // L/B < 1
  expect('Cp windward short', short.windward, 0.8, 0.001);
  expect('Cp leeward L/B=0.8', short.leeward, -0.5, 0.001);
  expect('Cp side', short.side, -0.7, 0.001);

  const sq = cpWall(2.0);
  expect('Cp leeward L/B=2', sq.leeward, -0.3, 0.001);

  const long = cpWall(4.0);
  expect('Cp leeward L/B=4', long.leeward, -0.2, 0.001);
}

console.log('\n=== BLOCK 7: Full solve — Miami 30x60x40 flat-roof enclosed building ===');
{
  const result = solveAsce722Wind(
    {
      location: { lat: 25.7617, lng: -80.1918, elevation: 3, formattedAddress: 'Miami FL' },
      riskCategory: 'II',
      exposure: 'C',
      siteClass: 'Default',
      V: 170 * MPH,
      V_source: 'ATC',
    },
    {
      H: 30 * 304.8,
      L: 60 * 304.8,
      B: 40 * 304.8,
      roofType: 'flat',
      roofSlope: 0,
      enclosure: 'enclosed',
      Kd: 0.85,
      Kzt: 1.0,
    }
  );
  console.log(`  V=170 mph → qh = ${result.breakdown.qh.toFixed(0)} Pa (${(result.breakdown.qh/47.88).toFixed(1)} psf)`);
  console.log(`  Kh = ${result.breakdown.Kz.toFixed(3)}, Kd = ${result.breakdown.Kd}, Ke = ${result.breakdown.Ke}`);
  console.log(`  MWFRS windward (design) = ${result.mwfrs.walls.windwardDesign.toFixed(0)} Pa (${(result.mwfrs.walls.windwardDesign/47.88).toFixed(1)} psf)`);
  console.log(`  MWFRS leeward  (design) = ${result.mwfrs.walls.leewardDesign.toFixed(0)} Pa (${(result.mwfrs.walls.leewardDesign/47.88).toFixed(1)} psf)`);
  console.log(`  MWFRS side     (design) = ${result.mwfrs.walls.sideDesign.toFixed(0)} Pa (${(result.mwfrs.walls.sideDesign/47.88).toFixed(1)} psf)`);
  console.log(`  C&C a boundary = ${result.cc.a.toFixed(0)} mm (${(result.cc.a/304.8).toFixed(2)} ft)`);
  result.cc.roof.forEach(z => console.log(`    ${z.label}: +${(z.p_pos/47.88).toFixed(1)} / ${(z.p_neg/47.88).toFixed(1)} psf`));
  // Expected from ASCE hand calc for this case:
  //   qh at H=30 ft, Exp C: Kh=0.98
  //   qh = 0.00256·0.98·1·0.85·1·170² = 61.7 psf
  //   Windward design ≈ qh·G·Cp_w ± qh·GCpi = 61.7·0.85·0.8 ± 61.7·0.18 = 41.9 ± 11.1 psf
  //   max ≈ 53 psf ≈ 2530 Pa
  expect('qh Miami (Pa)', result.breakdown.qh, 61.7 * 47.88, 0.05);
  expect('qh Miami (psf)', result.breakdown.qh / 47.88, 61.7, 0.05);
}

console.log('\n=== TOTAL ===');
console.log(`PASS: ${PASS}`);
console.log(`FAIL: ${FAIL}`);
if (FAIL > 0) {
  console.log('\nFAILURES:');
  fails.forEach(f => console.log('   ' + f));
}
process.exit(FAIL > 0 ? 1 : 0);
