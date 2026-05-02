// Slab Design — QC SUITE
// Cross-checks against:
//   • ACI 318-19 closed-form moment coefficients (one-way)
//   • PCA Notes Method 3 tables (Cases 1–9, m = 1.0, 0.5, etc.)
//   • Nilson Design of Concrete Structures examples
//   • Hand calculations for As, deflection, punching, crack control

import { analyze } from '../src/lib/slab/solver';
import type { SlabInput, EdgeCondition } from '../src/lib/slab/types';
import { lookupMethod3, classifyEdgesToCase } from '../src/lib/slab/method3-coefficients';

// Test harness ----------------------------------------------------
let PASS = 0, FAIL = 0;
const fails: string[] = [];

function expect(name: string, actual: number, expected: number, tol = 0.02) {
  const diff = Math.abs(actual - expected);
  const denom = Math.max(Math.abs(expected), 1e-9);
  const rel = diff / denom;
  if (rel <= tol) { PASS++; console.log(`  PASS ${name}: ${fmt(actual)} (exp ${fmt(expected)}, ${(rel * 100).toFixed(2)}%)`); }
  else { FAIL++; const msg = `  FAIL ${name}: GOT ${fmt(actual)} EXP ${fmt(expected)} (${(rel * 100).toFixed(2)}% off, tol ${(tol * 100).toFixed(0)}%)`; console.log(msg); fails.push(msg); }
}

function expectNear(name: string, actual: number, expected: number, absTol: number) {
  const diff = Math.abs(actual - expected);
  if (diff <= absTol) { PASS++; console.log(`  PASS ${name}: ${fmt(actual)} (|Δ|=${fmt(diff)})`); }
  else { FAIL++; const msg = `  FAIL ${name}: GOT ${fmt(actual)} EXP ${fmt(expected)} (|Δ|=${fmt(diff)}, absTol ${absTol})`; console.log(msg); fails.push(msg); }
}

function expectBool(name: string, actual: boolean, expected: boolean) {
  if (actual === expected) { PASS++; console.log(`  PASS ${name}: ${actual}`); }
  else { FAIL++; const msg = `  FAIL ${name}: GOT ${actual} EXP ${expected}`; console.log(msg); fails.push(msg); }
}

function expectStr(name: string, actual: string, expected: string) {
  if (actual === expected) { PASS++; console.log(`  PASS ${name}: '${actual}'`); }
  else { FAIL++; const msg = `  FAIL ${name}: GOT '${actual}' EXP '${expected}'`; console.log(msg); fails.push(msg); }
}

function fmt(n: number) {
  if (Math.abs(n) >= 1000 || (Math.abs(n) < 0.001 && n !== 0)) return n.toExponential(3);
  return n.toFixed(4);
}

function block(name: string) { console.log(`\n=== ${name} ===`); }

// Helpers
function edges(left: EdgeCondition, right: EdgeCondition, top: EdgeCondition, bottom: EdgeCondition) {
  return { left, right, top, bottom };
}

console.log('============================================');
console.log(' SLAB DESIGN SOLVER — QC SUITE');
console.log('============================================');

// ============================================================
// BLOCK 1 — Edge classification → Method 3 case
// ============================================================
block('BLOCK 1 — Method 3 case classification (longSide=x)');
{
  expectStr('All fixed → Case 1', String(classifyEdgesToCase(edges('fixed', 'fixed', 'fixed', 'fixed'), 'x')), '1');
  expectStr('All simple → Case 9', String(classifyEdgesToCase(edges('simple', 'simple', 'simple', 'simple'), 'x')), '9');
  // One short edge discontinuous: short side runs along Y axis (since longSide=x means x is long, so short edges are LEFT/RIGHT — those of length Ly)
  expectStr('Top discontinuous (one long disc) → Case 3', String(classifyEdgesToCase(edges('fixed', 'fixed', 'simple', 'fixed'), 'x')), '3');
  expectStr('Right discontinuous (one short disc) → Case 2', String(classifyEdgesToCase(edges('fixed', 'simple', 'fixed', 'fixed'), 'x')), '2');
  expectStr('Top + Right disc → Case 4 (corner)', String(classifyEdgesToCase(edges('fixed', 'simple', 'simple', 'fixed'), 'x')), '4');
  expectStr('Both short disc → Case 5', String(classifyEdgesToCase(edges('simple', 'simple', 'fixed', 'fixed'), 'x')), '5');
  expectStr('Both long disc → Case 6', String(classifyEdgesToCase(edges('fixed', 'fixed', 'simple', 'simple'), 'x')), '6');
}

// ============================================================
// BLOCK 2 — Method 3 coefficient lookup
// ============================================================
block('BLOCK 2 — Method 3 lookup');
{
  const c1m1 = lookupMethod3(1, 1.0);
  expect('Case 1 m=1.0  Ca_neg', c1m1.Ca_neg, 0.033, 0.02);
  expect('Case 1 m=1.0  Ca_DL',  c1m1.Ca_DL,  0.018, 0.02);
  expect('Case 1 m=1.0  Ca_LL',  c1m1.Ca_LL,  0.027, 0.02);

  const c9m1 = lookupMethod3(9, 1.0);
  expect('Case 9 m=1.0  Ca_DL = Cb_DL (symmetry)', c9m1.Ca_DL, c9m1.Cb_DL, 0.001);
  expect('Case 9 m=1.0  Ca_DL', c9m1.Ca_DL, 0.036, 0.02);

  // Linear interpolation check: m=0.85 should be midway between m=0.9 and m=0.8
  const c1_85 = lookupMethod3(1, 0.85);
  const c1_85_expected_Ca_neg = 0.050;     // PCA value at m=0.85
  expect('Case 1 m=0.85 Ca_neg (interp)', c1_85.Ca_neg, c1_85_expected_Ca_neg, 0.05);
}

// ============================================================
// BLOCK 3 — Classification: one-way vs two-way
// ============================================================
block('BLOCK 3 — Classification');
{
  // Square 4×4 slab → two-way
  const r1 = analyze({
    code: 'ACI 318-19', units: 'SI',
    geometry: { Lx: 4, Ly: 4, h: 150 },
    edges: edges('simple', 'simple', 'simple', 'simple'),
    materials: { fc: 28, fy: 420 },
    loads: { DL_super: 1.5, LL: 4.8 },
  });
  expectStr('Square 4×4 → two-way', r1.classification, 'two-way');
  expect('β = 1', r1.beta, 1, 0.001);

  // 4×9 slab (β=2.25) → one-way
  const r2 = analyze({
    code: 'ACI 318-19', units: 'SI',
    geometry: { Lx: 4, Ly: 9, h: 150 },
    edges: edges('simple', 'simple', 'simple', 'simple'),
    materials: { fc: 28, fy: 420 },
    loads: { DL_super: 1.5, LL: 4.8 },
  });
  expectStr('4×9 → one-way', r2.classification, 'one-way');
  expect('β = 2.25', r2.beta, 2.25, 0.001);
}

// ============================================================
// BLOCK 4 — One-way SS slab moment
// ============================================================
block('BLOCK 4 — One-way SS slab moments');
{
  // L = 5 m, h = 200 mm, DL_sup = 1.5, LL = 5
  // wSelf = 24 × 0.20 = 4.8;  DL_total = 6.3;  wu = 1.2*6.3 + 1.6*5 = 7.56 + 8 = 15.56 kN/m²
  // SS one-way: M = wu·L²/8 = 15.56 · 25 / 8 = 48.625 kN·m/m
  const r = analyze({
    code: 'ACI 318-19', units: 'SI',
    geometry: { Lx: 5, Ly: 12, h: 200 },                 // β = 2.4 → one-way
    edges: edges('simple', 'simple', 'simple', 'simple'),
    materials: { fc: 28, fy: 420 },
    loads: { DL_super: 1.5, LL: 5 },
  });
  expectStr('one-way classification', r.classification, 'one-way');
  expect('wu factored', r.wu, 1.2 * (1.5 + 4.8) + 1.6 * 5, 0.005);
  expect('Mx_pos = wu·L²/8', r.moments.Mx_pos, r.wu * 25 / 8, 0.005);
  expect('Mx_neg = 0 (SS)', r.moments.Mx_neg, 0, 0.001);
}

block('BLOCK 5 — One-way fixed-fixed slab moments');
{
  // L_short = 4 m (Lx) fixed-fixed.
  // For Lx=4 < Ly=12, longSide=y. The supports for the short (x) span are at x=0 and
  // x=Lx, which are the LEFT and RIGHT edges. To make these fixed → fix LEFT/RIGHT.
  // M_neg = -wu·L²/12,  M_pos = wu·L²/24.
  const r = analyze({
    code: 'ACI 318-19', units: 'SI',
    geometry: { Lx: 4, Ly: 12, h: 200 },
    edges: edges('fixed', 'fixed', 'simple', 'simple'),
    materials: { fc: 28, fy: 420 },
    loads: { DL_super: 1.5, LL: 5 },
  });
  expect('Mx_pos = wu·L²/24', r.moments.Mx_pos, r.wu * 16 / 24, 0.005);
  expect('|Mx_neg| = wu·L²/12', Math.abs(r.moments.Mx_neg), r.wu * 16 / 12, 0.005);
}

// ============================================================
// BLOCK 6 — Two-way SS slab (Case 9), m = 1.0
// ============================================================
block('BLOCK 6 — Two-way SS square (Case 9, m=1.0)');
{
  // 5×5, h=200, DL_sup=1.5, LL=5
  // wu = 1.2·(1.5+4.8) + 1.6·5 = 15.56
  // Case 9 m=1.0: Ca_DL = 0.036, Ca_LL = 0.036
  // Mx_pos = (0.036·DL + 0.036·LL)·L² where DL,LL are factored
  //   = (0.036·1.2·6.3 + 0.036·1.6·5)·25
  //   = (0.036·7.56 + 0.036·8)·25 = 0.036·15.56·25 = 14.004 kN·m/m
  const r = analyze({
    code: 'ACI 318-19', units: 'SI',
    geometry: { Lx: 5, Ly: 5, h: 200 },
    edges: edges('simple', 'simple', 'simple', 'simple'),
    materials: { fc: 28, fy: 420 },
    loads: { DL_super: 1.5, LL: 5 },
  });
  expect('Mx_pos via Method 3 Case 9', r.moments.Mx_pos, 0.036 * r.wu * 25, 0.02);
  expect('Mx_pos = My_pos (square)', r.moments.Mx_pos, r.moments.My_pos, 0.005);
  expect('Mx_neg = 0 (Case 9)', r.moments.Mx_neg, 0, 0.001);
}

// ============================================================
// BLOCK 7 — Two-way interior panel (Case 1, m=1.0)
// ============================================================
block('BLOCK 7 — Two-way interior square (Case 1, m=1.0)');
{
  const r = analyze({
    code: 'ACI 318-19', units: 'SI',
    geometry: { Lx: 5, Ly: 5, h: 200 },
    edges: edges('fixed', 'fixed', 'fixed', 'fixed'),
    materials: { fc: 28, fy: 420 },
    loads: { DL_super: 1.5, LL: 5 },
  });
  // Case 1 m=1.0: Ca_DL = 0.018, Ca_LL = 0.027, Ca_neg = 0.033
  expect('Mx_pos', r.moments.Mx_pos, (0.018 * 1.2 * 6.3 + 0.027 * 1.6 * 5) * 25, 0.03);
  expect('|Mx_neg|', Math.abs(r.moments.Mx_neg), 0.033 * r.wu * 25, 0.02);
  expect('Symmetry Mx_pos = My_pos', r.moments.Mx_pos, r.moments.My_pos, 0.005);
}

// ============================================================
// BLOCK 8 — Two-way Case 1, m=0.5 (long rectangular interior panel)
// ============================================================
block('BLOCK 8 — Two-way Case 1, m=0.5 (4×8 interior)');
{
  // Lx=4, Ly=8 → β=2 (still two-way), m = 0.5
  // Case 1 m=0.5: Ca_neg=0.083, Ca_DL=0.037, Ca_LL=0.053
  //               Cb_neg=0.010, Cb_DL=0.004, Cb_LL=0.009
  const r = analyze({
    code: 'ACI 318-19', units: 'SI',
    geometry: { Lx: 4, Ly: 8, h: 200 },
    edges: edges('fixed', 'fixed', 'fixed', 'fixed'),
    materials: { fc: 28, fy: 420 },
    loads: { DL_super: 1.5, LL: 5 },
  });
  // longSide = y → Ma applies in x (short), Mb applies in y (long)
  // Mx_pos = (Ca_DL·DLu + Ca_LL·LLu)·L_short²
  const DLu = 1.2 * 6.3;
  const LLu = 1.6 * 5;
  expect('Mx_pos (short, larger)', r.moments.Mx_pos, (0.037 * DLu + 0.053 * LLu) * 16, 0.04);
  expect('My_pos (long, smaller)', r.moments.My_pos, (0.004 * DLu + 0.009 * LLu) * 64, 0.05);
  expect('|Mx_neg|', Math.abs(r.moments.Mx_neg), 0.083 * r.wu * 16, 0.02);
}

// ============================================================
// BLOCK 9 — Reinforcement: As_min ACI (S&T)
// ============================================================
block('BLOCK 9 — Reinforcement minimum As (ACI shrinkage & temp)');
{
  // h=200 mm slab, fy=420 → ρ_st = 0.0018, As_min = 0.0018·1000·200 = 360 mm²/m
  const r = analyze({
    code: 'ACI 318-19', units: 'SI',
    geometry: { Lx: 5, Ly: 5, h: 200 },
    edges: edges('simple', 'simple', 'simple', 'simple'),
    materials: { fc: 28, fy: 420 },
    loads: { DL_super: 0, LL: 0.001 },                  // tiny load — As_design driven by minimum
  });
  const mid = r.reinforcement.find((x) => x.location === 'mid-x')!;
  expect('As_min (ACI fy=420)', mid.As_min, 0.0018 * 1000 * 200, 0.001);
}

block('BLOCK 10 — Reinforcement minimum As (EN 1992-1-1)');
{
  // EN: As_min = max(0.26·fctm/fy·b·d, 0.0013·b·d). For C25/30, fck=25, fctm=0.30·25^(2/3)=2.565
  //   ratio = 0.26·2.565/500 = 0.001334. min=0.0013. → ratio = 0.001334
  // d = h - cover = 200 - 25 = 175 (for x-direction bottom)
  // As_min = 0.001334·1000·175 = 233.5 mm²/m
  const r = analyze({
    code: 'EN 1992-1-1', units: 'SI',
    geometry: { Lx: 5, Ly: 5, h: 200 },
    edges: edges('simple', 'simple', 'simple', 'simple'),
    materials: { fc: 25, fy: 500 },
    loads: { DL_super: 0, LL: 0.001 },
  });
  const mid = r.reinforcement.find((x) => x.location === 'mid-x')!;
  const fctm = 0.30 * Math.pow(25, 2 / 3);
  const ratio = Math.max(0.26 * fctm / 500, 0.0013);
  expect('As_min (EN C25/30)', mid.As_min, ratio * 1000 * (200 - 25), 0.005);
}

// ============================================================
// BLOCK 11 — Reinforcement: hand-calc check
// ============================================================
block('BLOCK 11 — Required As from Mu (hand calc, ACI)');
{
  // Mu = 50 kN·m/m, h = 200, cover = 25, d = 175, fy=420, fc=28
  // φ=0.9, Mu_Nmm = 50e6
  // jd ≈ 0.95·d ≈ 166 mm (first estimate)
  // As ≈ Mu / (φ·fy·jd) = 50e6 / (0.9·420·166) = 796 mm²/m
  // Refine via quadratic — should get ~810 mm²/m
  const r = analyze({
    code: 'ACI 318-19', units: 'SI',
    geometry: { Lx: 5, Ly: 5, h: 200, cover_bottom_x: 25 },
    edges: edges('simple', 'simple', 'simple', 'simple'),
    materials: { fc: 28, fy: 420 },
    loads: { DL_super: 0, LL: 50 / (1.6 * 25 / (0.036 * 25)) },     // craft load to get Mu ≈ 50
  });
  // Cross-check that whatever Mu emerges, As_req lies in plausible range
  const mid = r.reinforcement.find((x) => x.location === 'mid-x')!;
  const Mu = mid.Mu;
  const fy = 420, fc = 28, d = mid.d;
  // Independent quadratic solution for As
  const phi = 0.9;
  const A = (phi * fy * fy) / (2 * 0.85 * fc * 1000);
  const B = -phi * fy * d;
  const C = Mu * 1e6;
  const disc = B * B - 4 * A * C;
  const As_indep = (-B - Math.sqrt(Math.max(0, disc))) / (2 * A);
  expect('As_req independent vs solver', mid.As_req, As_indep, 0.005);
}

// ============================================================
// BLOCK 12 — Deflection: h_min for ACI one-way SS
// ============================================================
block('BLOCK 12 — h_min check ACI one-way SS slab L=5m');
{
  // ACI 318-19 Table 7.3.1.1 SS one-way: h_min = L/20
  const r = analyze({
    code: 'ACI 318-19', units: 'SI',
    geometry: { Lx: 5, Ly: 12, h: 200 },               // h=200, L=5 → h_min = 250 → fail
    edges: edges('simple', 'simple', 'simple', 'simple'),
    materials: { fc: 28, fy: 420 },
    loads: { DL_super: 1.5, LL: 5 },
  });
  expect('h_min = L/20 = 250 mm', r.deflection.h_min, 5000 / 20, 0.001);
  expectBool('h_min check failed (h=200 < 250)', r.deflection.h_min_ok, false);
}

block('BLOCK 13 — h_min for ACI one-way fixed-fixed L=5m');
{
  // Both edges fixed: h_min = L/28
  const r = analyze({
    code: 'ACI 318-19', units: 'SI',
    geometry: { Lx: 5, Ly: 12, h: 200 },
    edges: edges('simple', 'simple', 'fixed', 'fixed'),
    materials: { fc: 28, fy: 420 },
    loads: { DL_super: 1.5, LL: 5 },
  });
  expect('h_min = L/28 ≈ 178 mm', r.deflection.h_min, 5000 / 28, 0.001);
  expectBool('h_min OK (200 ≥ 178)', r.deflection.h_min_ok, true);
}

// ============================================================
// BLOCK 14 — Deflection: Branson Ie
// ============================================================
block('BLOCK 14 — Branson Ie when M_service > Mcr');
{
  // 5 m SS slab, h=200, fc=28, heavy load to crack
  const r = analyze({
    code: 'ACI 318-19', units: 'SI',
    geometry: { Lx: 5, Ly: 12, h: 200 },
    edges: edges('simple', 'simple', 'simple', 'simple'),
    materials: { fc: 28, fy: 420 },
    loads: { DL_super: 5, LL: 10 },
  });
  // Ie should be < Ig
  const Ig = 1000 * Math.pow(200, 3) / 12;
  expectBool('Ie < Ig (cracked)', r.deflection.Ie! < Ig, true);
  expectBool('Ie > 0', r.deflection.Ie! > 0, true);
}

// ============================================================
// BLOCK 15 — Punching shear: ACI interior column
// ============================================================
block('BLOCK 15 — Punching shear ACI interior column');
{
  // 300 mm square column, slab d = 175, fc = 28, Vu = 600 kN
  // bo = 4·(c+d) = 4·(300+175) = 1900 mm
  // vc = min of:
  //   v1 = 0.33·√fc = 1.746 MPa
  //   v2 = (0.17 + 0.33/β)·√fc; β=1 → 0.50·5.292 = 2.646
  //   v3 = (αs·d/bo/12 + 0.17)·√fc = (40·175/1900/12 + 0.17)·5.292 = (0.307 + 0.17)·5.292 = 2.523
  //   → vc = v1 = 1.746
  // φvc = 0.75·1.746 = 1.310
  // vu = Vu / (bo·d) = 600000 / (1900·175) = 1.804 MPa → ratio = 1.804/1.310 = 1.377 → FAIL
  const r = analyze({
    code: 'ACI 318-19', units: 'SI',
    geometry: { Lx: 6, Ly: 6, h: 200, cover_bottom_x: 25 },
    edges: edges('simple', 'simple', 'simple', 'simple'),
    materials: { fc: 28, fy: 420 },
    loads: { DL_super: 1, LL: 4 },
    punching: { c1: 300, c2: 300, position: 'interior', Vu: 600, d: 175 },
  });
  expect('bo = 1900', r.punching!.bo, 1900, 0.001);
  expect('vc ≈ 1.746 MPa', r.punching!.vc, 0.33 * Math.sqrt(28), 0.005);
  expect('vu ≈ 1.804 MPa', r.punching!.vu, 600000 / (1900 * 175), 0.005);
  expectBool('punching FAILS (ratio > 1)', r.punching!.ok, false);
  expectBool('needs reinforcement', r.punching!.needsReinf, true);
}

block('BLOCK 16 — Punching shear ACI interior column passes');
{
  // Same column but smaller load: Vu = 300 kN
  const r = analyze({
    code: 'ACI 318-19', units: 'SI',
    geometry: { Lx: 6, Ly: 6, h: 200, cover_bottom_x: 25 },
    edges: edges('simple', 'simple', 'simple', 'simple'),
    materials: { fc: 28, fy: 420 },
    loads: { DL_super: 1, LL: 4 },
    punching: { c1: 300, c2: 300, position: 'interior', Vu: 300, d: 175 },
  });
  expect('vu lower', r.punching!.vu, 300000 / (1900 * 175), 0.005);
  expectBool('punching OK', r.punching!.ok, true);
}

// ============================================================
// BLOCK 17 — Crack control max spacing (ACI)
// ============================================================
block('BLOCK 17 — Crack control max spacing ACI');
{
  // ACI §24.3.2: fs ≈ 2/3·fy = 280 MPa
  // s_max = least of [380·(280/fs) - 2.5·cc, 300·(280/fs)]
  //   At fs = 280: s_max = least of [380 - 2.5·cc, 300]
  //   cc ≈ rebar.d - 100 in our approx
  const r = analyze({
    code: 'ACI 318-19', units: 'SI',
    geometry: { Lx: 5, Ly: 5, h: 200 },
    edges: edges('simple', 'simple', 'simple', 'simple'),
    materials: { fc: 28, fy: 420 },
    loads: { DL_super: 1.5, LL: 5 },
  });
  expect('fs = 2/3·fy', r.crackControl!.fs, (2 / 3) * 420, 0.001);
  // At fs=280, s_max ≈ 300 (the 300·(280/fs) limit)
  expect('s_max ≈ 300 (ACI)', r.crackControl!.s_max, 300, 0.05);
}

// ============================================================
// BLOCK 18 — Symmetry: rotated panel gives swapped moments
// ============================================================
block('BLOCK 18 — Rotation symmetry');
{
  // Slab 4×8 (Lx=4, Ly=8) and 8×4 (Lx=8, Ly=4) with all simple should give:
  //   First case: Mx_pos > My_pos (x is short → carries more)
  //   Rotated case: My_pos > Mx_pos (y is short)
  const r1 = analyze({
    code: 'ACI 318-19', units: 'SI',
    geometry: { Lx: 4, Ly: 8, h: 200 },
    edges: edges('simple', 'simple', 'simple', 'simple'),
    materials: { fc: 28, fy: 420 },
    loads: { DL_super: 1.5, LL: 5 },
  });
  const r2 = analyze({
    code: 'ACI 318-19', units: 'SI',
    geometry: { Lx: 8, Ly: 4, h: 200 },
    edges: edges('simple', 'simple', 'simple', 'simple'),
    materials: { fc: 28, fy: 420 },
    loads: { DL_super: 1.5, LL: 5 },
  });
  expect('Mx of first ≈ My of rotated', r1.moments.Mx_pos, r2.moments.My_pos, 0.005);
  expect('My of first ≈ Mx of rotated', r1.moments.My_pos, r2.moments.Mx_pos, 0.005);
}

// ============================================================
// BLOCK 19 — Edge cases
// ============================================================
block('BLOCK 19 — Edge cases');
{
  // Negative span
  const r1 = analyze({
    code: 'ACI 318-19', units: 'SI',
    geometry: { Lx: 0, Ly: 5, h: 200 },
    edges: edges('simple', 'simple', 'simple', 'simple'),
    materials: { fc: 28, fy: 420 },
    loads: { DL_super: 1, LL: 4 },
  });
  expectBool('Zero span rejected', r1.solved, false);

  // Zero thickness
  const r2 = analyze({
    code: 'ACI 318-19', units: 'SI',
    geometry: { Lx: 5, Ly: 5, h: 0 },
    edges: edges('simple', 'simple', 'simple', 'simple'),
    materials: { fc: 28, fy: 420 },
    loads: { DL_super: 1, LL: 4 },
  });
  expectBool('Zero thickness rejected', r2.solved, false);
}

// ============================================================
// BLOCK 20 — Reinforcement spacing within max
// ============================================================
block('BLOCK 20 — Bar spacing within s_max');
{
  const r = analyze({
    code: 'ACI 318-19', units: 'SI',
    geometry: { Lx: 5, Ly: 5, h: 200 },
    edges: edges('fixed', 'fixed', 'fixed', 'fixed'),
    materials: { fc: 28, fy: 420 },
    loads: { DL_super: 1.5, LL: 5 },
  });
  for (const r1 of r.reinforcement) {
    expectBool(`${r1.location} spacing ≤ s_max`, r1.spacing <= r1.spacing_max, true);
  }
}

// ============================================================
// BLOCK 21 — Eurocode load factors
// ============================================================
block('BLOCK 21 — EN 1992 default load factors 1.35/1.5');
{
  const r = analyze({
    code: 'EN 1992-1-1', units: 'SI',
    geometry: { Lx: 5, Ly: 5, h: 200 },
    edges: edges('simple', 'simple', 'simple', 'simple'),
    materials: { fc: 25, fy: 500 },
    loads: { DL_super: 1.5, LL: 5 },
  });
  // wu = 1.35·(1.5+4.8) + 1.5·5 = 8.505 + 7.5 = 16.005
  expect('EN wu factored', r.wu, 1.35 * (1.5 + 4.8) + 1.5 * 5, 0.005);
}

// ============================================================
// BLOCK 22 — Punching shear EN basic
// ============================================================
block('BLOCK 22 — Punching shear EN 1992 interior');
{
  const r = analyze({
    code: 'EN 1992-1-1', units: 'SI',
    geometry: { Lx: 6, Ly: 6, h: 250, cover_bottom_x: 30 },
    edges: edges('simple', 'simple', 'simple', 'simple'),
    materials: { fc: 30, fy: 500 },
    loads: { DL_super: 1, LL: 4 },
    punching: { c1: 400, c2: 400, position: 'interior', Vu: 600, d: 220 },
  });
  // EN interior bo = 2(c1 + 4d) + 2(c2 + 4d) = 2·(400+880) + 2·(400+880) = 5120 mm
  expect('EN bo interior', r.punching!.bo, 5120, 0.005);
  expectBool('EN punching OK at modest Vu', r.punching!.ok, true);
}

// ============================================================
// BLOCK 23 — Method 3 case 4 (corner) m=1.0
// ============================================================
block('BLOCK 23 — Two-way Case 4 corner panel m=1.0');
{
  const r = analyze({
    code: 'ACI 318-19', units: 'SI',
    geometry: { Lx: 5, Ly: 5, h: 200 },
    edges: edges('fixed', 'simple', 'simple', 'fixed'),    // top + right discontinuous = corner
    materials: { fc: 28, fy: 420 },
    loads: { DL_super: 1.5, LL: 5 },
  });
  expect('Case 4 detected', r.case ?? 0, 4, 0.001);
  // Case 4 m=1.0: Ca_DL=0.027, Ca_neg=0.047
  const DLu = 1.2 * 6.3, LLu = 1.6 * 5;
  expect('Mx_pos Case 4', r.moments.Mx_pos, (0.027 * DLu + 0.032 * LLu) * 25, 0.05);
}

// ============================================================
// BLOCK 24 — ACI 318-25 selection produces identical numerical result
// (formulas unchanged for these provisions; only ref labels differ)
// ============================================================
block('BLOCK 24 — ACI 318-25 vs 318-19 numerical equivalence');
{
  const inputs: SlabInput = {
    code: 'ACI 318-19', units: 'SI',
    geometry: { Lx: 5, Ly: 5, h: 200 },
    edges: edges('fixed', 'fixed', 'fixed', 'fixed'),
    materials: { fc: 28, fy: 420 },
    loads: { DL_super: 1.5, LL: 5 },
  };
  const r19 = analyze(inputs);
  const r25 = analyze({ ...inputs, code: 'ACI 318-25' });
  expect('Mx_pos identical', r25.moments.Mx_pos, r19.moments.Mx_pos, 0.0001);
  expect('h_min identical', r25.deflection.h_min, r19.deflection.h_min, 0.0001);
  // Reference label should now mention 318-25
  if (r25.reinforcement[0].steps?.some((s) => s.ref?.includes('318-25'))) PASS++;
  else { FAIL++; fails.push('  FAIL: 318-25 ref not in reinforcement steps'); }
  console.log(`  ${r25.reinforcement[0].steps?.some((s) => s.ref?.includes('318-25')) ? 'PASS' : 'FAIL'} 318-25 ref present in citations`);
}

// ============================================================
// BLOCK 25 — Punching size factor λ_s reduces vc on THICK slab (d > 250 mm)
// ============================================================
block('BLOCK 25 — λ_s size factor for thick slab');
{
  // d = 500 mm slab. λ_s = √(2 / (1 + 0.004·500)) = √(2/3) = 0.816 → ~18% reduction
  const r = analyze({
    code: 'ACI 318-19', units: 'SI',
    geometry: { Lx: 8, Ly: 8, h: 600, cover_bottom_x: 50 },
    edges: edges('simple', 'simple', 'simple', 'simple'),
    materials: { fc: 28, fy: 420 },
    loads: { DL_super: 1, LL: 4 },
    punching: { c1: 400, c2: 400, position: 'interior', Vu: 600, d: 500 },
  });
  const lambda_s = Math.sqrt(2 / (1 + 0.004 * 500));    // ≈ 0.816
  const expected_vc = lambda_s * 0.33 * Math.sqrt(28);   // ≈ 1.426 MPa
  expect('vc reduced by λ_s', r.punching!.vc, expected_vc, 0.02);
}

// ============================================================
// BLOCK 26 — One-way h_min fy modifier for fy ≠ 420
// ============================================================
block('BLOCK 26 — h_min fy modifier (one-way), fy = 550 MPa');
{
  // SS one-way slab L=5m, fy=550 → factor (0.4 + 550/700) = 1.186
  // h_min = (5000/20) · 1.186 = 296 mm
  const r = analyze({
    code: 'ACI 318-25', units: 'SI',
    geometry: { Lx: 5, Ly: 12, h: 300 },
    edges: edges('simple', 'simple', 'simple', 'simple'),
    materials: { fc: 28, fy: 550 },
    loads: { DL_super: 1.5, LL: 5 },
  });
  const expected = (5000 / 20) * (0.4 + 550 / 700);
  expect('h_min one-way fy=550', r.deflection.h_min, expected, 0.005);
}

// ============================================================
// BLOCK 27 — Two-way h_min: edge beam differentiation
// ============================================================
block('BLOCK 27 — Two-way h_min — interior panel (4 fixed) at fy=420');
{
  // Interior 5×5 panel (4 fixed), fy=420 → ℓn/33 = 5000/33 ≈ 151.5 mm
  const r = analyze({
    code: 'ACI 318-19', units: 'SI',
    geometry: { Lx: 5, Ly: 5, h: 200 },
    edges: edges('fixed', 'fixed', 'fixed', 'fixed'),
    materials: { fc: 28, fy: 420 },
    loads: { DL_super: 1.5, LL: 5 },
  });
  expect('h_min interior fy=420', r.deflection.h_min, 5000 / 33, 0.005);
}

block('BLOCK 28 — Two-way h_min — without edge beams (all simple) at fy=420');
{
  // 5×5 with all SS edges → "without edge beams", denom 30 → h_min = 167 mm
  // But minimum 125 mm absolute floor.
  const r = analyze({
    code: 'ACI 318-19', units: 'SI',
    geometry: { Lx: 5, Ly: 5, h: 200 },
    edges: edges('simple', 'simple', 'simple', 'simple'),
    materials: { fc: 28, fy: 420 },
    loads: { DL_super: 1.5, LL: 5 },
  });
  expect('h_min without edge beams', r.deflection.h_min, 5000 / 30, 0.005);
}

// ============================================================
// BLOCK 29 — Punching √fc cap at 8.3 MPa (ACI §22.6.3.1)
// ============================================================
block('BLOCK 29 — √fc cap at 8.3 MPa for vc (high-strength concrete)');
{
  // f'c = 100 MPa → √fc = 10, but capped at 8.3
  const r = analyze({
    code: 'ACI 318-25', units: 'SI',
    geometry: { Lx: 6, Ly: 6, h: 220, cover_bottom_x: 25 },
    edges: edges('simple', 'simple', 'simple', 'simple'),
    materials: { fc: 100, fy: 420 },
    loads: { DL_super: 1, LL: 4 },
    punching: { c1: 300, c2: 300, position: 'interior', Vu: 500, d: 195 },
  });
  // vc least of three; with √fc capped at 8.3, basic v1 = 0.33·1·8.3 = 2.74 MPa max
  // (the size factor and other terms still apply, but the √fc itself is capped)
  // λs = √(2/(1+0.004·195)) ≈ 1.0 (since d < 250)
  // v1 = 0.33 · 1.0 · 8.3 = 2.739
  const expected_v1 = 0.33 * Math.min(1, Math.sqrt(2 / (1 + 0.004 * 195))) * 8.3;
  expectBool('vc ≤ 0.33·8.3', r.punching!.vc <= expected_v1 + 1e-6, true);
}

// ============================================================
// BLOCK 30 — Drop panel reduces two-way h_min (ACI Table 8.3.1.1)
// ============================================================
block('BLOCK 30 — Drop panel reduces h_min');
{
  // 5×5 with all simple edges; without drop = ℓn/30 = 167; with drop = ℓn/33 = 151.5
  const noDrop = analyze({
    code: 'ACI 318-25', units: 'SI',
    geometry: { Lx: 5, Ly: 5, h: 200 },
    edges: edges('simple', 'simple', 'simple', 'simple'),
    materials: { fc: 28, fy: 420 },
    loads: { DL_super: 1.5, LL: 5 },
  });
  const withDrop = analyze({
    code: 'ACI 318-25', units: 'SI',
    geometry: { Lx: 5, Ly: 5, h: 200 },
    edges: edges('simple', 'simple', 'simple', 'simple'),
    materials: { fc: 28, fy: 420 },
    loads: { DL_super: 1.5, LL: 5 },
    punching: { c1: 300, c2: 300, position: 'interior', Vu: 200,
      dropPanelSize: 1500, dropPanelThickness: 75 },
  });
  expect('without-drop h_min = ℓn/30', noDrop.deflection.h_min, 5000 / 30, 0.005);
  expect('with-drop h_min = ℓn/33', withDrop.deflection.h_min, 5000 / 33, 0.005);
  expectBool('with-drop is smaller', withDrop.deflection.h_min < noDrop.deflection.h_min, true);
}

// ============================================================
// BLOCK 31 — User reinforcement override + capacity verification
// ============================================================
block('BLOCK 31 — User-defined rebar with φMn / utilization check');
{
  // SS slab L=5, fy=420, fc=28, h=200. Auto would pick a small bar.
  // User overrides midspan-x with #5 @ 200 mm c/c → As_provided = 199·1000/200 = 995 mm²/m
  // d = 175 mm; a = 995·420/(0.85·28·1000) = 17.5 mm; jd = d − a/2 = 166.25
  // φMn = 0.9·995·420·166.25/1e6 = 62.5 kN·m/m
  const r = analyze({
    code: 'ACI 318-19', units: 'SI',
    geometry: { Lx: 5, Ly: 5, h: 200 },
    edges: edges('simple', 'simple', 'simple', 'simple'),
    materials: { fc: 28, fy: 420 },
    loads: { DL_super: 1.5, LL: 5 },
    userRebar: [{ location: 'mid-x', bar: '#5', spacing: 200 }],
  });
  const mid = r.reinforcement.find((x) => x.location === 'mid-x')!;
  expect('User bar applied (As_provided)', mid.As_provided, 199 * 1000 / 200, 0.005);
  // φMn calculation
  const a = (mid.As_provided * 420) / (0.85 * 28 * 1000);
  const phiMn_expected = (0.9 * mid.As_provided * 420 * (mid.d - a / 2)) / 1e6;
  expect('φMn matches independent calc', mid.phiMn_provided, phiMn_expected, 0.01);
  // utilization
  expect('utilization Mu/φMn', mid.utilization, mid.Mu / mid.phiMn_provided, 0.005);
  // source flag
  expectStr('source = user', mid.source, 'user');
  expectBool('OK because φMn >> Mu', mid.ok, true);
}

block('BLOCK 32 — User overrides too small bar → FAIL');
{
  // Heavy load (Mu high) but user picks only #3 @ 300 — way under-reinforced
  const r = analyze({
    code: 'ACI 318-19', units: 'SI',
    geometry: { Lx: 5, Ly: 5, h: 200 },
    edges: edges('simple', 'simple', 'simple', 'simple'),
    materials: { fc: 28, fy: 420 },
    loads: { DL_super: 5, LL: 10 },
    userRebar: [{ location: 'mid-x', bar: '#3', spacing: 300 }],
  });
  const mid = r.reinforcement.find((x) => x.location === 'mid-x')!;
  expectBool('FAIL flag set', mid.ok, false);
  expectBool('utilization > 1', mid.utilization > 1, true);
  expectBool('failure messages present', mid.failures.length > 0, true);
}

block('BLOCK 33 — Default (no user rebar) → source = auto, ok = true');
{
  const r = analyze({
    code: 'ACI 318-19', units: 'SI',
    geometry: { Lx: 5, Ly: 5, h: 200 },
    edges: edges('simple', 'simple', 'simple', 'simple'),
    materials: { fc: 28, fy: 420 },
    loads: { DL_super: 1.5, LL: 5 },
  });
  for (const r1 of r.reinforcement) {
    expectStr(`${r1.location} source = auto`, r1.source, 'auto');
    expectBool(`${r1.location} ok = true`, r1.ok, true);
  }
}

// ============================================================
// SUMMARY
// ============================================================
console.log('\n============================================');
console.log(` SUMMARY:  ${PASS} passed,  ${FAIL} failed,  ${PASS + FAIL} total`);
console.log('============================================');
if (FAIL > 0) {
  console.log('\nFailed:');
  for (const m of fails) console.log(m);
  process.exit(1);
}
process.exit(0);
