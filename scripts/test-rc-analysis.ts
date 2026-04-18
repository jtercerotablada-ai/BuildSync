// RC analysis test battery.
//
// Reference example (classic ACI textbook beam):
//   b = 300 mm, h = 500 mm, effective depth d = 440 mm
//   4 #25 bars at bottom: As = 4 × 510 = 2040 mm²
//   f'c = 28 MPa, fy = 420 MPa, Es = 200 000 MPa

import { computeCracked } from '../src/lib/section/rc-cracked';
import {
  computeFlexuralCapacity,
  computeInteraction,
  computeMomentCurvature,
} from '../src/lib/section/rc-nonlinear';
import { computeRc } from '../src/lib/section/rc-analysis';
import type { RcParams } from '../src/lib/section/rc-types';

const G = '\x1b[32m';
const R = '\x1b[31m';
const C = '\x1b[36m';
const N = '\x1b[0m';

let pass = 0;
let fail = 0;

function near(actual: number, expected: number, rel: number, label: string) {
  const err = Math.abs(actual - expected) / Math.max(Math.abs(expected), 1e-12);
  const ok = err <= rel;
  if (ok) {
    pass++;
    console.log(`  ${G}✓${N} ${label}  actual=${fmt(actual)}  expected=${fmt(expected)}  err=${(err * 100).toFixed(3)}%`);
  } else {
    fail++;
    console.log(`  ${R}✗${N} ${label}  actual=${fmt(actual)}  expected=${fmt(expected)}  err=${(err * 100).toFixed(3)}%`);
  }
}

function fmt(x: number) {
  if (Math.abs(x) >= 10000) return x.toExponential(4);
  if (Math.abs(x) < 0.01 && x !== 0) return x.toExponential(4);
  return x.toFixed(4);
}

function hdr(s: string) {
  console.log(`\n${C}── ${s} ──${N}`);
}

const beam: RcParams = {
  concrete: { kind: 'rectangular', b: 300, h: 500 },
  layers: [
    { id: 'bot', depth: 440, area: 2040, count: 4, label: '4 #25' },
  ],
  materials: { fc: 28, fy: 420, Es: 200_000 },
};

// ============================================================
// R-01: cracked section (elastic, service loads)
// ============================================================

hdr('R-01: Cracked transformed section (b=300, d=440, As=2040, fc=28, fy=420)');
{
  const r = computeCracked(beam);
  // Hand calc:
  //   n = Es/Ec = 200 000 / (4700·√28) = 200000 / 24870 ≈ 8.04
  //   150·kd² + 16402·kd − 7217000 = 0  →  kd ≈ 171.4 mm
  //   Icr = 300·kd³/3 + n·As·(d−kd)² ≈ 1.686e9 mm⁴
  near(r.n, 8.0413, 0.01, 'modular ratio n = Es/Ec');
  near(r.kd, 171.4, 0.02, 'NA depth kd');
  near(r.Icr, 1.686e9, 0.02, 'Icr cracked transformed');
  if (r.valid) {
    pass++;
    console.log(`  ${G}✓${N} cracked-section valid flag`);
  } else {
    fail++;
    console.log(`  ${R}✗${N} cracked-section valid flag`);
  }
}

// ============================================================
// R-02: nominal flexural capacity Mn via ACI Whitney block
// ============================================================

hdr('R-02: Nominal flexural capacity Mn (pure flexion)');
{
  const r = computeFlexuralCapacity(beam);
  // Hand calc:
  //   a  = As·fy / (0.85·f'c·b) = 2040·420 / (0.85·28·300) = 120 mm
  //   c  = a / β1 = 120 / 0.85 = 141.2 mm
  //   Mn = As·fy·(d − a/2) = 2040·420·380 = 325.58 kN·m = 3.2558e8 N·mm
  //   εt = 0.003·(440−141.2)/141.2 = 0.00635  → tension-controlled → φ = 0.9
  near(r.a, 120, 0.02, 'Whitney block depth a');
  near(r.c, 141.18, 0.02, 'NA depth c = a/β1');
  near(r.Mn, 3.2558e8, 0.02, 'Mn (N·mm)');
  near(r.phi, 0.9, 1e-6, 'φ = 0.90 (tension-controlled)');
  near(r.phiMn, 0.9 * 3.2558e8, 0.02, 'φMn');
  if (r.tensionControlled) {
    pass++;
    console.log(`  ${G}✓${N} tension-controlled flag`);
  } else {
    fail++;
    console.log(`  ${R}✗${N} tension-controlled flag should be true`);
  }
}

// ============================================================
// R-03: P-M interaction key points
// ============================================================

hdr('R-03: P-M interaction key points');
{
  const r = computeInteraction(beam);
  // Hand calc:
  //   P0  = 0.85·f'c·(Ag − As) + fy·As
  //       = 0.85·28·(150000 − 2040) + 420·2040
  //       = 23.8·147960 + 856800
  //       = 3_521_448 + 856_800
  //       = 4 378 248 N ≈ 4378 kN
  //   Pnt = −fy·As = −420·2040 = −856 800 N
  //   φ·Pmax (tied) = 0.8·0.65·P0 ≈ 2_276_689 N
  near(r.P0, 4_378_248, 0.005, 'P0 pure axial compression');
  near(r.pureTension, -856_800, 0.005, 'Pnt pure tension');
  near(r.phiPmax, 0.8 * 0.65 * 4_378_248, 0.005, 'φ·Pmax = 0.8·0.65·P0 (tied)');
  // Pure flexion point on the P=0 slice should match Mn
  near(r.pureFlexion.M, 3.2558e8, 0.03, 'pure-flexion M ≈ Mn');
}

// ============================================================
// R-04: balance point — εt = εy at NA depth c_b
// ============================================================

hdr('R-04: Balance point (εt = εy)');
{
  const r = computeInteraction(beam);
  // Hand calc for balance:
  //   εy = 420/200000 = 0.0021
  //   c_b = εCU·d / (εCU + εy) = 0.003·440 / (0.003 + 0.0021) = 1.32/0.0051 = 258.8 mm
  const cb_expected = (0.003 * 440) / (0.003 + 420 / 200000);
  near(r.balancePoint.c, cb_expected, 0.05, 'balance c_b = εCU·d/(εCU+εy)');
  near(r.balancePoint.epsT, 0.0021, 0.05, 'balance εt ≈ εy');
}

// ============================================================
// R-05: moment-curvature monotonic & yield point below ultimate
// ============================================================

hdr('R-05: Moment-curvature envelope');
{
  const r = computeMomentCurvature(beam);
  if (r.points.length > 5) {
    pass++;
    console.log(`  ${G}✓${N} M-φ curve has ${r.points.length} points`);
  } else {
    fail++;
    console.log(`  ${R}✗${N} M-φ curve too few points: ${r.points.length}`);
  }
  if (r.yieldPoint && r.ultimatePoint && r.yieldPoint.phi < r.ultimatePoint.phi) {
    pass++;
    console.log(
      `  ${G}✓${N} yield(φ=${r.yieldPoint.phi.toExponential(3)}) < ultimate(φ=${r.ultimatePoint.phi.toExponential(3)})`
    );
  } else {
    fail++;
    console.log(`  ${R}✗${N} yield / ultimate ordering failed`);
  }
  // Peak moment from M-φ curve should be within ~10% of Mn (Whitney and Hognestad
  // give slightly different peak values)
  const peakM = Math.max(...r.points.map((p) => p.M));
  near(peakM, 3.2558e8, 0.10, 'peak M on M-φ ≈ Mn (±10%)');
}

// ============================================================
// R-06: top-level computeRc aggregator
// ============================================================

hdr('R-06: computeRc() top-level aggregator');
{
  const r = computeRc(beam);
  // Gross Ag = b·h = 150000
  near(r.gross.Ag, 150_000, 1e-9, 'Ag = 300·500');
  near(r.gross.Ig, (300 * 500 ** 3) / 12, 1e-9, 'Ig = b·h³/12');
  // fr = 0.62·√28 = 3.28 MPa; Mcr = fr·Ig / yt = 3.28·3.125e9 / 250
  const expectedFr = 0.62 * Math.sqrt(28);
  const expectedMcr = (expectedFr * ((300 * 500 ** 3) / 12)) / 250;
  near(r.gross.Mcr, expectedMcr, 1e-3, 'Mcr = fr·Ig/yt');
  if (r.cracked && r.flexural && r.momentCurvature && r.interaction) {
    pass++;
    console.log(`  ${G}✓${N} all result sub-structures populated`);
  } else {
    fail++;
    console.log(`  ${R}✗${N} missing sub-structure(s)`);
  }
}

// ============================================================
// R-07: doubly-reinforced — compression steel raises Mn and reduces c
// ============================================================

hdr('R-07: Doubly-reinforced beam vs singly-reinforced');
{
  const singly: RcParams = beam;
  const doubly: RcParams = {
    ...beam,
    layers: [
      { id: 'top', depth: 60, area: 1020, count: 2, label: "2 #25 compression" },
      { id: 'bot', depth: 440, area: 2040, count: 4, label: '4 #25 tension' },
    ],
  };
  const a = computeFlexuralCapacity(singly);
  const b = computeFlexuralCapacity(doubly);
  if (b.c < a.c) {
    pass++;
    console.log(`  ${G}✓${N} doubly c (${b.c.toFixed(1)}) < singly c (${a.c.toFixed(1)})`);
  } else {
    fail++;
    console.log(`  ${R}✗${N} doubly c should be < singly c`);
  }
  if (b.Mn >= a.Mn * 0.99) {
    pass++;
    console.log(`  ${G}✓${N} doubly Mn (${(b.Mn / 1e6).toFixed(1)}) ≥ singly Mn (${(a.Mn / 1e6).toFixed(1)})`);
  } else {
    fail++;
    console.log(`  ${R}✗${N} doubly Mn should be ≥ singly Mn`);
  }
}

console.log('\n════════════════════════════════════');
const color = fail === 0 ? G : R;
console.log(`${color}Result: ${pass} pass, ${fail} fail${N}`);
process.exit(fail === 0 ? 0 : 1);
