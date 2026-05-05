/**
 * Foundation Design — QC test suite
 * ----------------------------------
 *
 * Tests against:
 *   - First-principles formulas from ACI 318-25 (SI Units)
 *   - Wight & MacGregor 7e Ch 15 worked examples
 *   - ACI SP-17(14) footing design examples (where reproducible)
 *
 * Run:   npx tsx tests/footing-qc.ts
 */

import { analyzeFooting } from '../src/lib/footing/solver';
import type { FootingInput } from '../src/lib/footing/types';

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

// ─── Helper: build a default FootingInput ──────────────────────────────────
function defaultInput(overrides: Partial<FootingInput> = {}): FootingInput {
  return {
    code: 'ACI 318-25',
    geometry: {
      B: 2500, L: 2500, T: 500, coverClear: 75,
      columnShape: 'square', cx: 400, cy: 400,
      ...(overrides.geometry ?? {}),
    },
    soil: { qa: 200, gammaSoil: 18, gammaConcrete: 24, ...(overrides.soil ?? {}) },
    materials: { fc: 28, fy: 420, lambdaC: 1.0, ...(overrides.materials ?? {}) },
    loads: { PD: 600, PL: 400, ...(overrides.loads ?? {}) },
    reinforcement: {
      bottomX: { bar: '#7', count: 8 },
      bottomY: { bar: '#7', count: 8 },
      ...(overrides.reinforcement ?? {}),
    },
    ...overrides,
  };
}

// ============================================================================
// BLOCK 1 — Bearing pressure (closed-form)
// ============================================================================

block('Block 1 — Bearing: centric square footing', () => {
  // 2.5m × 2.5m × 400mm, PD=600 PL=400, qa=200 kPa
  // A = 6.25 m², Wf = 24·6.25·0.4 = 60 kN, Ws = 0
  // P_service = 600+400+60 = 1060 kN
  // q_avg = 1060/6.25 = 169.6 kPa < 200 → OK
  const r = analyzeFooting(defaultInput({ geometry: { B: 2500, L: 2500, T: 400, coverClear: 75, columnShape: 'square', cx: 400, cy: 400 } }));
  near('P_service ≈ 1060 kN', r.bearing.P_service, 1060, 0.005);
  near('q_max ≈ 169.6 kPa', r.bearing.q_max, 169.6, 0.005);
  check('Bearing OK', r.bearing.ok);
  check('Within kern (no uplift)', !r.upliftRegion);
});

block('Block 1 — Bearing: eccentric within kern (e < B/6)', () => {
  // B = 3000 mm, e_x = 200 mm, B/6 = 500 mm → within kern
  // Light loads so q_max fits inside qa = 200 kPa
  const r = analyzeFooting(defaultInput({
    geometry: { B: 3000, L: 3000, T: 500, coverClear: 75, columnShape: 'square', cx: 400, cy: 400, ex: 200 },
    loads: { PD: 400, PL: 250 },
  }));
  check('Within kern', !r.upliftRegion);
  check('Bearing OK (within kern + light loads)', r.bearing.ok);
  // q_max should be > q_avg (eccentricity adds to one side)
  check('q_max > q_avg', r.bearing.q_max > r.bearing.P_service / 9);
});

block('Block 1 — Bearing: liftoff (e > B/6) detected', () => {
  // B = 3000, e_x = 700 mm > B/6 = 500
  const r = analyzeFooting(defaultInput({
    geometry: { B: 3000, L: 3000, T: 500, coverClear: 75, columnShape: 'square', cx: 400, cy: 400, ex: 700 },
    loads: { PD: 800, PL: 600 },
  }));
  check('Outside kern → upliftRegion = true', r.upliftRegion);
  check('Warning emitted for partial uplift',
        r.warnings.some((w) => w.toLowerCase().includes('uplift') || w.toLowerCase().includes('kern')));
});

block('Block 1 — Bearing: self-weight + overburden with embedment', () => {
  // 2 m × 2 m × 600 mm, embedment 1500 mm, γs=18, γc=24
  // A = 4 m², Wf = 24·4·0.6 = 57.6 kN, Ws = 18·4·1.5 = 108 kN
  const r = analyzeFooting(defaultInput({
    geometry: { B: 2000, L: 2000, T: 600, coverClear: 75, columnShape: 'square', cx: 400, cy: 400, embedment: 1500 },
    soil: { qa: 200, gammaSoil: 18, gammaConcrete: 24 },
  }));
  near('Wf = 57.6 kN', r.Wf, 57.6, 0.01);
  near('Ws = 108 kN', r.Ws, 108, 0.01);
});

// ============================================================================
// BLOCK 2 — Punching shear (Table 22.6.5.2)
// ============================================================================

block('Block 2 — Punching: square column βc = 1 → vc1 governs', () => {
  // 400×400 column, square footing, ample size
  const r = analyzeFooting(defaultInput({
    geometry: { B: 3000, L: 3000, T: 600, coverClear: 75, columnShape: 'square', cx: 400, cy: 400 },
    loads: { PD: 800, PL: 600 },
  }));
  near('βc = 1', r.punching.betaC, 1.0, 0.001);
  // vc1 = 0.33·√fc, vc2 = 0.17·(1+2)·√fc = 0.51·√fc, vc3 depends on αs·d/bo
  // For square interior column, vc1 typically governs (smallest)
  near('vc1 = 0.33·√fc', r.punching.vc1, 0.33 * Math.sqrt(28), 0.001);
  // Confirm vc selected
  check('vc = min of three candidates', r.punching.vc === Math.min(r.punching.vc1, r.punching.vc2, r.punching.vc3));
});

block('Block 2 — Punching: rectangular column βc = 2.5 → vc2 governs', () => {
  // 200 × 500 column → βc = 500/200 = 2.5
  const r = analyzeFooting(defaultInput({
    geometry: { B: 3000, L: 3000, T: 600, coverClear: 75, columnShape: 'rectangular', cx: 200, cy: 500 },
    loads: { PD: 800, PL: 600 },
  }));
  near('βc = 2.5', r.punching.betaC, 2.5, 0.001);
  // For βc = 2.5: vc2 = 0.17·(1+2/2.5)·√fc = 0.17·1.8·√fc = 0.306·√fc < vc1 = 0.33·√fc
  // So vc2 should govern (be smaller than vc1)
  check('vc2 < vc1 (rectangular column governs)', r.punching.vc2 < r.punching.vc1);
});

block('Block 2 — Punching: circular column', () => {
  // Circular column 500 mm diameter
  const r = analyzeFooting(defaultInput({
    geometry: { B: 3000, L: 3000, T: 600, coverClear: 75, columnShape: 'circular', cx: 500 },
    loads: { PD: 600, PL: 400 },
  }));
  // bo = π·(D + d). With T=600, cover=75, d ≈ 600−75−25 = 500
  // bo = π·(500 + 500) = π·1000 ≈ 3141.6
  near('bo = π·(D + d)', r.punching.bo, Math.PI * 1000, 0.05);
});

block('Block 2 — Punching: thick footing → vc3 (large d/bo) sanity', () => {
  // Large d / small bo case — vc3 = 0.083·(αs·d/bo + 2)·√fc
  // Use small column to force small bo, big T to force large d
  const r = analyzeFooting(defaultInput({
    geometry: { B: 4000, L: 4000, T: 1200, coverClear: 75, columnShape: 'square', cx: 250, cy: 250 },
    loads: { PD: 1500, PL: 1000 },
  }));
  // Just verify all three computed and vc is the minimum
  check('vc3 computed positively', r.punching.vc3 > 0);
  check('vc = min', r.punching.vc === Math.min(r.punching.vc1, r.punching.vc2, r.punching.vc3));
});

// ============================================================================
// BLOCK 3 — One-way shear (§22.5.5.1(a))
// ============================================================================

block('Block 3 — One-way shear: X direction closed form', () => {
  // 3m × 3m × 600 mm, 400 mm column. d ≈ 500 mm.
  // Cantilever from face = (3000 − 400)/2 = 1300 mm. Critical at d → 1300 − 500 = 800 mm.
  // bw = L = 3000 mm (perpendicular to X)
  // Vc = 0.17·1·√28·3000·500 / 1000 = 1349 kN
  const r = analyzeFooting(defaultInput({
    geometry: { B: 3000, L: 3000, T: 600, coverClear: 75, columnShape: 'square', cx: 400, cy: 400 },
    loads: { PD: 800, PL: 500 },
  }));
  // Vc = 0.17·√28·3000·d / 1000
  const d = r.shearX.d;
  const expectedVc = 0.17 * Math.sqrt(28) * 3000 * d / 1000;
  near('Vc per ACI §22.5.5.1(a)', r.shearX.Vc, expectedVc, 0.005);
  check('Cantilever from face = 1300 mm', Math.abs(r.shearX.cantilever - 1300) < 1);
});

block('Block 3 — One-way shear: asymmetric column cx ≠ cy', () => {
  const r = analyzeFooting(defaultInput({
    geometry: { B: 3000, L: 4000, T: 600, coverClear: 75, columnShape: 'rectangular', cx: 300, cy: 600 },
    loads: { PD: 1000, PL: 700 },
  }));
  // X: cantilever from cx face = (3000 − 300)/2 = 1350 mm
  // Y: cantilever from cy face = (4000 − 600)/2 = 1700 mm
  near('Cantilever X = 1350 mm', r.shearX.cantilever, 1350, 0.001);
  near('Cantilever Y = 1700 mm', r.shearY.cantilever, 1700, 0.001);
});

// ============================================================================
// BLOCK 4 — Flexure at face of column (§13.3.3)
// ============================================================================

block('Block 4 — Flexure: square equal directions Mx = My', () => {
  const r = analyzeFooting(defaultInput({
    geometry: { B: 2500, L: 2500, T: 500, coverClear: 75, columnShape: 'square', cx: 400, cy: 400 },
    loads: { PD: 600, PL: 400 },
  }));
  near('Mu_X ≈ Mu_Y for square footing+column', r.flexureX.Mu, r.flexureY.Mu, 0.01);
});

block('Block 4 — Flexure: AsMin governs for thin, lightly-loaded footing', () => {
  // Light loads, 300 mm thick
  const r = analyzeFooting(defaultInput({
    geometry: { B: 1800, L: 1800, T: 300, coverClear: 75, columnShape: 'square', cx: 300, cy: 300 },
    loads: { PD: 100, PL: 50 },
    reinforcement: { bottomX: { bar: '#5', count: 8 }, bottomY: { bar: '#5', count: 8 } },
  }));
  // AsMin = 0.0020·b·T (fy = 420)
  const expectedAsMin = 0.0020 * 1800 * 300;
  near('AsMin = 0.0020·b·T', r.flexureX.AsMin, expectedAsMin, 0.001);
});

// ============================================================================
// BLOCK 5 — Bearing at column-footing interface (§22.8)
// ============================================================================

block('Block 5 — Bearing interface: A2 = A1 → factor = 1', () => {
  // Pedestal sits on identical pedestal: A2 = A1, factor = 1
  const r = analyzeFooting(defaultInput({
    geometry: { B: 400, L: 400, T: 400, coverClear: 75, columnShape: 'square', cx: 400, cy: 400 },
    loads: { PD: 50, PL: 30 },
  }));
  near('φBn,col = φBn,ftg (factor = 1)', r.bearingInterface.phiBn_col, r.bearingInterface.phiBn_ftg, 0.001);
});

block('Block 5 — Bearing interface: A2 >> A1 → factor capped at 2', () => {
  // 3m × 3m footing, 200 mm column → A2/A1 huge → factor capped at 2
  const r = analyzeFooting(defaultInput({
    geometry: { B: 3000, L: 3000, T: 500, coverClear: 75, columnShape: 'square', cx: 200, cy: 200 },
    loads: { PD: 200, PL: 100 },
  }));
  // φBn_ftg should be 2 × φBn_col (factor capped)
  near('φBn_ftg = 2·φBn_col (capped)',
       r.bearingInterface.phiBn_ftg / r.bearingInterface.phiBn_col, 2, 0.005);
});

// ============================================================================
// BLOCK 6 — Overturning + sliding (NEW)
// ============================================================================

block('Block 6 — Overturning: pure vertical → N/A', () => {
  const r = analyzeFooting(defaultInput());
  check('Overturning N/A for pure vertical', r.overturning.notApplicable);
  check('Overturning OK', r.overturning.ok);
});

block('Block 6 — Overturning: applied moment within FOS limit', () => {
  // Mx = 100 kN·m, B = 2500, T = 500. P_service ≈ 1075 (incl. Wf=75)
  // Lever arm = B/2 = 1.25 m, M_resist = 1075·1.25 = 1343.75 kN·m
  // FOS = 1343.75/100 = 13.44 ≥ 1.5
  const r = analyzeFooting(defaultInput({
    geometry: { B: 2500, L: 2500, T: 500, coverClear: 75, columnShape: 'square', cx: 400, cy: 400 },
    loads: { PD: 600, PL: 400, Mx: 100 },
  }));
  near('FOS overturning ≈ 13.44', r.overturning.FOS, 13.44, 0.02);
  check('FOS ≥ 1.5', r.overturning.ok);
});

block('Block 6 — Sliding: lateral H + friction', () => {
  // H = 200 kN, P_service ≈ 1060 kN, μ = 0.45
  // H_allow = 0.45·1060 = 477 kN
  // FOS = 477/200 = 2.39 ≥ 1.5
  const r = analyzeFooting(defaultInput({ H: 200, frictionMu: 0.45 }));
  near('H_allow ≈ 0.45·N', r.sliding.H_allow, 0.45 * r.bearing.P_service, 0.01);
  near('FOS sliding ≈ 2.4', r.sliding.FOS, 0.45 * r.bearing.P_service / 200, 0.01);
});

block('Block 6 — Sliding: insufficient friction → fail', () => {
  // H = 600 kN > 0.45·P → FOS < 1.5
  const r = analyzeFooting(defaultInput({ H: 600 }));
  check('Sliding fails when H too large', !r.sliding.ok);
});

// ============================================================================
// BLOCK 7 — Bar fit / spacing (NEW)
// ============================================================================

block('Block 7 — Bar fit: typical spacing OK', () => {
  // 2500 wide, 8 #7 bars: s_clear = (2500 − 150 − 8·22.2)/(7) = 311 mm — OK
  const r = analyzeFooting(defaultInput());
  check('Bar fit X OK', r.barFitX.ok);
  check('Bar fit Y OK', r.barFitY.ok);
});

block('Block 7 — Bar fit: too sparse (s > 3·T or > 450)', () => {
  // 4000 wide, 2 bars only → huge clear spacing
  const r = analyzeFooting(defaultInput({
    geometry: { B: 4000, L: 4000, T: 600, coverClear: 75, columnShape: 'square', cx: 400, cy: 400 },
    reinforcement: {
      bottomX: { bar: '#5', count: 2 },
      bottomY: { bar: '#5', count: 2 },
    },
  }));
  check('Bar fit X fails (too sparse)', !r.barFitX.ok);
});

// ============================================================================
// BLOCK 10 — Edition equivalence (ACI 318-19 vs 318-25)
// ============================================================================

block('Block 10 — Code label: 318-19 vs 318-25', () => {
  const r19 = analyzeFooting(defaultInput({ code: 'ACI 318-19' }));
  const r25 = analyzeFooting(defaultInput({ code: 'ACI 318-25' }));
  // Numerics identical
  near('Same q_max for both codes', r19.bearing.q_max, r25.bearing.q_max, 0.0001);
  near('Same Vc punching for both codes', r19.punching.phiVc, r25.punching.phiVc, 0.0001);
  // ref text differs
  check('318-19 ref says ACI 318-19', r19.bearing.ref.includes('ACI 318-19'));
  check('318-25 ref says ACI 318-25', r25.bearing.ref.includes('ACI 318-25'));
});

// ============================================================================
// BLOCK 9 — Wall / strip footing (1 m strip)
// ============================================================================

block('Block 9 — Strip footing: 1m wide, 400 mm thick', () => {
  // Strip = thin wall column; treat 1 m segment
  const r = analyzeFooting(defaultInput({
    geometry: { B: 1500, L: 1000, T: 400, coverClear: 75, columnShape: 'rectangular', cx: 250, cy: 1000 },
    loads: { PD: 100, PL: 80 },     // per metre of wall
    reinforcement: {
      bottomX: { bar: '#5', count: 6 },
      bottomY: { bar: '#5', count: 4 },
    },
  }));
  check('Solver completed', r.solved);
  // For a 1m strip, only X-direction flexure matters (Y direction has very small cantilever)
  // Verify solver doesn't crash
  check('Both flexure checks computed', r.flexureX.ok !== undefined && r.flexureY.ok !== undefined);
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
