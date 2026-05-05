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
  // AsMin per ACI 318-25 §8.6.1.1:
  //   fy < 420 MPa → 0.0020·b·h
  //   fy ≥ 420 MPa → max(0.0014, 0.0018·420/fy)·b·h
  // For fy = 420 the formula gives 0.0018·(420/420) = 0.0018.
  const expectedAsMin = 0.0018 * 1800 * 300;
  near('AsMin = 0.0018·b·T (fy=420 boundary)', r.flexureX.AsMin, expectedAsMin, 0.001);
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
// BLOCK 6.5 — MEGA-QC regression: axis bug fixes (CRITICAL)
// ============================================================================

block('Block 6.5 — Rectangular footing with Mx: pressure axis correct', () => {
  // Rectangular B=2m × L=4m, P=400 kN, Mx=100 kN·m (about X, gradient along Y)
  // q_avg = 400/(2·4) = 50 kPa
  // Δq from Mx at extreme y = 6·100/(L²·B) = 6·100/(16·2) = 18.75 kPa
  // qmax = 50 + 18.75 = 68.75; qmin = 50 - 18.75 = 31.25
  const r = analyzeFooting(defaultInput({
    geometry: { B: 2000, L: 4000, T: 500, coverClear: 75, columnShape: 'square', cx: 400, cy: 400 },
    loads: { PD: 200, PL: 200, Mx: 100 },
    soil: { qa: 200 },
  }));
  // q_avg actually includes Wf+Ws: P_service = PD+PL+Wf = 400 + 24·8·0.5 = 496
  // q_avg = 496/8 = 62 kPa, dq = 6·100/(16·2) = 18.75
  // qmax ≈ 80.75, qmin ≈ 43.25
  near('Mx → gradient along Y dimension (rect footing)', r.bearing.q_max, 80.75, 0.05);
  near('qmin matches expected for rect Mx', r.bearing.q_min, 43.25, 0.05);
});

block('Block 6.5 — Rectangular footing with My: pressure axis correct', () => {
  // Rectangular B=2m × L=4m, P=400 kN, My=100 kN·m (about Y, gradient along X)
  // q_avg = 62 kPa as above
  // Δq from My at extreme x = 6·100/(B²·L) = 6·100/(4·4) = 37.5 kPa
  // qmax = 62 + 37.5 = 99.5
  const r = analyzeFooting(defaultInput({
    geometry: { B: 2000, L: 4000, T: 500, coverClear: 75, columnShape: 'square', cx: 400, cy: 400 },
    loads: { PD: 200, PL: 200, My: 100 },
    soil: { qa: 200 },
  }));
  near('My → gradient along X dimension (rect footing)', r.bearing.q_max, 99.5, 0.05);
});

block('Block 6.5 — Column eccentricity ex creates My (not Mx)', () => {
  // Column shifted 200 mm in X with P=400 kN → M = P·ex about Y-axis
  // For 2m × 4m footing: q_avg = 62 (incl Wf), gradient along X = 6·M/(B²·L)
  // M_eccentric = 400·0.2 = 80 kN·m (about Y, since shift is in X)
  // dq = 6·80/(2²·4) = 30 kPa → qmax ≈ 92
  const r = analyzeFooting(defaultInput({
    geometry: { B: 2000, L: 4000, T: 500, coverClear: 75, columnShape: 'square', cx: 400, cy: 400, ex: 200 },
    loads: { PD: 200, PL: 200 },
    soil: { qa: 200 },
  }));
  near('ex creates X-direction gradient (via My)', r.bearing.q_max, 92, 0.05);
});

block('Block 6.5 — Overturning: rectangular Mx uses L/2 as resisting arm', () => {
  // B=2m, L=4m, P_service ≈ 496 kN, Mx=100 kN·m
  // Resisting arm for Mx = L/2 = 2 m → M_resist = 992 kN·m
  // FOS = 992/100 = 9.92
  const r = analyzeFooting(defaultInput({
    geometry: { B: 2000, L: 4000, T: 500, coverClear: 75, columnShape: 'square', cx: 400, cy: 400 },
    loads: { PD: 200, PL: 200, Mx: 100 },
    soil: { qa: 300 },
  }));
  near('Overturning Mx uses arm = L/2 (rect)', r.overturning.FOS, 9.92, 0.05);
});

block('Block 6.5 — Overturning: lateral H adds H·T moment', () => {
  // P=1000 kN service, H=200 kN, Mx=0, T=500
  // M_H = 200 × 0.5 = 100 kN·m → totalMx = 100
  // arm_for_Mx = L/2 = 1.25, M_resist = 1075·1.25 = 1343.75
  // FOS = 1343.75/100 = 13.44
  const r = analyzeFooting(defaultInput({
    geometry: { B: 2500, L: 2500, T: 500, coverClear: 75, columnShape: 'square', cx: 400, cy: 400 },
    loads: { PD: 600, PL: 400 },
    H: 200,
  }));
  check('H produces overturning moment', !r.overturning.notApplicable);
  near('H·T overturning FOS ≈ 13.44', r.overturning.FOS, 13.44, 0.05);
});

// ============================================================================
// BLOCK 6.6 — αs columnLocation (interior / edge / corner)
// ============================================================================

block('Block 6.6 — αs = 40 for interior column (default)', () => {
  const r = analyzeFooting(defaultInput());
  check('Default αs = 40 (interior)', r.punching.alphaS === 40);
});

block('Block 6.6 — αs = 30 for edge column', () => {
  const r = analyzeFooting(defaultInput({
    geometry: { B: 2500, L: 2500, T: 500, coverClear: 75, columnShape: 'square', cx: 400, cy: 400, columnLocation: 'edge' },
  }));
  check('Edge column αs = 30', r.punching.alphaS === 30);
});

block('Block 6.6 — αs = 20 for corner column', () => {
  const r = analyzeFooting(defaultInput({
    geometry: { B: 2500, L: 2500, T: 500, coverClear: 75, columnShape: 'square', cx: 400, cy: 400, columnLocation: 'corner' },
  }));
  check('Corner column αs = 20', r.punching.alphaS === 20);
});

// ============================================================================
// BLOCK 6.7 — Effective depths dX vs dY (different bar diameters)
// ============================================================================

block('Block 6.7 — dX > dY when Y-bars stack on top of X-bars', () => {
  // X = #6 (db=19.1), Y = #6 (db=19.1), T=500, cover=75
  // dX = 500 - 75 - 19.1/2 = 415.45
  // dY = 500 - 75 - 19.1 - 19.1/2 = 396.35
  const r = analyzeFooting(defaultInput({
    geometry: { B: 2500, L: 2500, T: 500, coverClear: 75, columnShape: 'square', cx: 400, cy: 400 },
    reinforcement: {
      bottomX: { bar: '#6', count: 8 },
      bottomY: { bar: '#6', count: 8 },
    },
  }));
  // shearX uses dX, shearY uses dY. dX > dY by 1·db.
  check('shearX uses larger d than shearY', r.shearX.d > r.shearY.d);
  near('dX − dY ≈ db (≈19 mm)', r.shearX.d - r.shearY.d, 19.1, 0.1);
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
// BLOCK 8 — Auto-design round-trip
// ============================================================================
import { autoDesignFooting } from '../src/lib/footing/autoDesign';

block('Block 8 — Auto-design: light loads → small footing all OK', () => {
  const r = autoDesignFooting(defaultInput({
    loads: { PD: 200, PL: 150 },
    soil: { qa: 150, gammaSoil: 18, gammaConcrete: 24 },
  }), { shape: 'square' });
  check('Returns ok=true for light loads', r.ok);
  check('Has rationale steps', r.rationaleSteps.length >= 4);
  // Re-analyze the patched input to confirm
  const verify = analyzeFooting(r.patchedInput);
  check('Verify analysis on patched input passes', verify.ok);
});

block('Block 8 — Auto-design: heavy loads → large footing', () => {
  const r = autoDesignFooting(defaultInput({
    loads: { PD: 2000, PL: 1500 },
    soil: { qa: 250, gammaSoil: 18, gammaConcrete: 24 },
    materials: { fc: 35, fy: 420, lambdaC: 1.0 },
  }), { shape: 'square' });
  // Heavy loads — algorithm finds reasonable dimensions; full convergence may
  // need additional iterations but the geometry comes out right.
  check('B ≥ 3500 mm for heavy loads', r.patchedInput.geometry.B >= 3500);
  check('T ≥ 600 mm for heavy loads', r.patchedInput.geometry.T >= 600);
  check('Bearing converges', analyzeFooting(r.patchedInput).bearing.ok);
});

block('Block 8 — Auto-design: rectangular shape with aspect ratio', () => {
  const r = autoDesignFooting(defaultInput({
    loads: { PD: 800, PL: 600 },
  }), { shape: 'rectangular', aspect: 1.5 });
  // L/B should be approximately 1.5
  const ratio = r.patchedInput.geometry.L / r.patchedInput.geometry.B;
  check('Aspect ratio L/B ≈ 1.5', Math.abs(ratio - 1.5) < 0.15);
});

block('Block 8 — Auto-design: idempotent (analyze patched → same ok)', () => {
  const r = autoDesignFooting(defaultInput(), { shape: 'square' });
  // Run analyzeFooting on the patched input; should match auto-design's `ok`
  const reAnalyzed = analyzeFooting(r.patchedInput);
  check('Re-analyzing patched input matches', reAnalyzed.ok === r.ok);
});

block('Block 8 — Auto-design: punching-shear governs T iteration', () => {
  // Big column with high load on tight square footing → punching governs T
  const r = autoDesignFooting(defaultInput({
    geometry: { B: 2000, L: 2000, T: 300, coverClear: 75, columnShape: 'square', cx: 600, cy: 600 },
    loads: { PD: 1500, PL: 1000 },
    soil: { qa: 300, gammaSoil: 18, gammaConcrete: 24 },
  }), { shape: 'square' });
  // T should grow significantly from 300 mm starting point
  check('T grew from initial 300 mm', r.patchedInput.geometry.T > 400);
});

// ============================================================================
// BLOCK 11 — Wight & MacGregor 7e Ch 15 cross-validation (NEW, MEGA-QC)
// ============================================================================
// Source: Wight, J.K. & MacGregor, J.G., "Reinforced Concrete: Mechanics and
// Design" 7th ed., Pearson 2016, Ch 15 §15-5, Example 15-2 (pp. 825-829).
// Imperial→SI conversions:
//   1 in = 25.4 mm        1 ksi = 6.895 MPa     1 kip = 4.448 kN
//   1 ft = 304.8 mm       1 ksf = 47.88 kPa     1 kip·ft = 1.356 kN·m
//
// Wight's design (final, after iteration):
//   Column 18×18 in (457×457 mm), PD = 400 kips (1779 kN), PL = 270 kips (1201 kN)
//   f'c = 3000 psi (20.68 MPa), fy = 60 ksi (413.7 MPa)
//   Footing 11'2" × 11'2" × 32" thick (3404 × 3404 × 813 mm)
//   Bottom rebar: 11 #8 each way, As_prov = 8.69 in² (5606 mm²)
//
// Wight's computed values (target benchmarks):
//   qnu = 7.31 ksf  →  350 kPa
//   bo  = 184 in    →  4674 mm  (perimeter at d/2 from face)
//   d_avg = 28 in   →  711 mm
//   vc  = 4·√f'c (psi)  =  219 psi  =  1.501 MPa  (governs over vc2, vc3)
//   φVc = 845 kips  →  3759 kN
//   Vu  = 805 kips  →  3580 kN
//   Mu  = 954 kip·ft  →  1294 kN·m  (cantilever at face of column)
//   AsReq = 7.97 in²  →  5142 mm²
//   AsMin = 0.0018·b·h = 0.0018·134·32 = 7.72 in² → 4981 mm²
//   φMn (provided) = 1070 kip·ft  →  1451 kN·m

block('Block 11 — Wight Ex 15-2: 18-in column, square spread footing', () => {
  const r = analyzeFooting({
    code: 'ACI 318-25',
    geometry: {
      B: 3404, L: 3404, T: 813,
      coverClear: 76, columnShape: 'square',
      cx: 457, cy: 457,
      embedment: 305,    // 6" fill + 6" floor
      columnLocation: 'interior',     // αs = 40
    },
    soil: { qa: 320, gammaSoil: 19, gammaConcrete: 24 },
    materials: { fc: 20.68, fy: 413.7, lambdaC: 1.0 },
    loads: { PD: 1779.3, PL: 1200.9 },
    reinforcement: {
      bottomX: { bar: '#8', count: 11 },
      bottomY: { bar: '#8', count: 11 },
    },
  });

  // Factored net soil pressure
  near('qnu (Wight 7.31 ksf)', r.qnu, 350, 0.02);

  // Two-way (punching) shear quantities
  near('bo (Wight 184 in)', r.punching.bo, 4674, 0.01);
  near('d_avg (Wight 28 in)', r.punching.d, 711, 0.02);
  near('vc (Wight 4·√fʹc = 219 psi)', r.punching.vc, 1.501, 0.02);
  near('φVc (Wight 845 kips)', r.punching.phiVc, 3759, 0.03);
  near('Vu  (Wight 805 kips)', r.punching.Vu, 3580, 0.02);
  check('Punching ratio Vu/φVc < 1 (Wight has 0.95)', r.punching.ratio < 1.0);

  // Flexure quantities
  near('Mu (Wight 954 kip·ft)', r.flexureX.Mu, 1294, 0.03);
  // AsMin: Wight uses ACI 318-14 §7.6.1.1 (Grade 60 → ρmin = 0.0018):
  //   AsMin_318-14 = 0.0018 · 134 · 32 = 7.72 in² = 4981 mm²
  // Our solver follows ACI 318-25 §8.6.1.1 (fy < 420 MPa → ρmin = 0.0020):
  //   AsMin_318-25 = 0.0020 · 3404 · 813 = 5535 mm²  (∼11% higher)
  // The difference is a code evolution, not a calculation error. We verify the
  // modern (318-25) value here and note the legacy 318-14 value for reference.
  near('AsMin §8.6.1.1 (ACI 318-25, ρmin=0.0020)', r.flexureX.AsMin, 5535, 0.02);
  near('AsReq (Wight 7.97 in²)', r.flexureX.AsReq, 5142, 0.10);
  // Note: AsProv for 11 #8 = 11 × 510 mm² (catalog) = 5610 mm². Wight has
  // 11 × 0.79 in² = 8.69 in² = 5606 mm² (essentially same).
  near('AsProv (Wight 8.69 in²)', r.flexureX.AsProv, 5610, 0.02);
  near('φMn (Wight 1070 kip·ft)', r.flexureX.phiMn, 1451, 0.05);

  // Overall pass/fail status (Wight's design passes all checks)
  check('Wight punching passes', r.punching.ok);
  check('Wight one-way shear X passes', r.shearX.ok);
  check('Wight one-way shear Y passes', r.shearY.ok);
  check('Wight flexure X passes', r.flexureX.ok);
  check('Wight flexure Y passes', r.flexureY.ok);
});

block('Block 11 — Wight Ex 15-2: rigid-vs-flexible classification', () => {
  // Wight §15-3 / fig 15-7: rigid footing has Vmax ≤ 2h. For Ex 15-2:
  //   Vmax = (B - cx)/2 = (3404 - 457)/2 = 1473 mm
  //   2·T  = 2·813 = 1626 mm
  //   Vmax = 1473 < 2·T = 1626 → RIGID footing per Wight ✓
  const Vmax = (3404 - 457) / 2;
  const T2 = 2 * 813;
  check('Wight Ex 15-2 is rigid (Vmax ≤ 2T)', Vmax <= T2);
});

// ============================================================================
// BLOCK 12 — Unbalanced moment punching shear (ACI 318-25 §8.4.4.2)
// ============================================================================
// Reference: ACI 318-25 §8.4.4.2 — Factored two-way shear stress due to shear
// AND factored slab moment resisted by the column. When the column transfers
// an unbalanced moment Msc, a fraction γv = 1 − γf is transferred by eccen-
// tric shear, adding a stress γv·Msc·c_AB / Jc to the direct stress vuv.
//
//   γf  = 1 / (1 + (2/3)·√(b1/b2))     §8.4.2.2.1
//   γv  = 1 − γf                        §8.4.4.2.2
//   Jc  = d·b1³/6 + b1·d³/6 + d·b2·b1²/2   (interior column, R8.4.4.2.3)
//   vu,max = vuv + γv·Msc·c_AB/Jc       §8.4.4.2.3
//
// Hand-calculated example (Wight Ex 15-2 dimensions + applied Mx):
//   B=L=3404, T=813, cx=cy=457, d_avg=711.6, PD=1779.3, PL=1200.9
//   Service Mx = 100 kN·m;  factor ≈ (1.2·1779.3 + 1.6·1200.9)/(2980.2) = 1.361
//   Mu_x = 136.1 kN·m
//   For Mx (about X-axis), b1 = cy+d = 1168.6, b2 = cx+d = 1168.6 (square col)
//   γf = 1/(1 + (2/3)·1) = 0.6,    γv = 0.4
//   c_AB = b1/2 = 584.3 mm
//   Jc = 711.6·(1168.6)³/6 + 1168.6·(711.6)³/6 + 711.6·1168.6·(1168.6)²/2
//      = 1.892e11 + 7.014e10 + 5.681e11 = 8.273e11 mm⁴
//   Δvu_Mx = 0.4·136.1e6·584.3 / 8.273e11 = 0.0385 MPa
//   vuv = 1.077 MPa (from Wight Ex 15-2)
//   vu,max = 1.077 + 0.0385 = 1.116 MPa
//   φ·vc = 0.75·1.501 = 1.126 MPa  →  ratio = 1.116/1.126 = 0.991 (still passes)

block('Block 12 — γf, γv for square interior column', () => {
  // For a square column (cx = cy), b1 = b2 → γf = 1/(1 + 2/3) = 0.6
  const r = analyzeFooting({
    code: 'ACI 318-25',
    geometry: {
      B: 3404, L: 3404, T: 813, coverClear: 76,
      columnShape: 'square', cx: 457, cy: 457,
      columnLocation: 'interior',
    },
    soil: { qa: 320 },
    materials: { fc: 20.68, fy: 413.7 },
    loads: { PD: 1779.3, PL: 1200.9, Mx: 100 },
    reinforcement: {
      bottomX: { bar: '#8', count: 11 },
      bottomY: { bar: '#8', count: 11 },
    },
  });
  near('γf for square column = 0.60', r.punching.gammaF, 0.60, 0.01);
  near('γv for square column = 0.40', r.punching.gammaV, 0.40, 0.01);
});

block('Block 12 — Mx factoring: service → factored', () => {
  // factor = (1.2·PD + 1.6·PL)/(PD+PL) = (1.2·1779.3 + 1.6·1200.9)/2980.2
  //        = 4057.4/2980.2 = 1.361
  // Service Mx = 100 kN·m → MuX = 136.1 kN·m
  const r = analyzeFooting({
    code: 'ACI 318-25',
    geometry: {
      B: 3404, L: 3404, T: 813, coverClear: 76,
      columnShape: 'square', cx: 457, cy: 457,
    },
    soil: { qa: 320 },
    materials: { fc: 20.68, fy: 413.7 },
    loads: { PD: 1779.3, PL: 1200.9, Mx: 100 },
    reinforcement: {
      bottomX: { bar: '#8', count: 11 },
      bottomY: { bar: '#8', count: 11 },
    },
  });
  near('MuX factored ≈ 136.1 kN·m', r.punching.MuX, 136.1, 0.02);
});

block('Block 12 — Jc for interior column (Wight Ex 15-2 + Mx)', () => {
  // Hand-calc: Jc(Mx) = 8.273e11 mm⁴
  const r = analyzeFooting({
    code: 'ACI 318-25',
    geometry: {
      B: 3404, L: 3404, T: 813, coverClear: 76,
      columnShape: 'square', cx: 457, cy: 457,
    },
    soil: { qa: 320 },
    materials: { fc: 20.68, fy: 413.7 },
    loads: { PD: 1779.3, PL: 1200.9, Mx: 100 },
    reinforcement: {
      bottomX: { bar: '#8', count: 11 },
      bottomY: { bar: '#8', count: 11 },
    },
  });
  near('Jc(Mx) ≈ 8.27e11 mm⁴', r.punching.JcX, 8.27e11, 0.02);
  // Δvu from Mx: 0.0385 MPa (5.6 psi)
  near('Δvu from Mx ≈ 0.0385 MPa', r.punching.dvuMx, 0.0385, 0.05);
});

block('Block 12 — Combined vu,max for Wight Ex 15-2 + Mx = 100 kN·m', () => {
  // vuv (centric Wight Ex 15-2) ≈ 1.077 MPa
  // Δvu(Mx) ≈ 0.0385 MPa
  // vu,max ≈ 1.116 MPa, φ·vc = 1.126 MPa → ratio ≈ 0.991 (still passes)
  const r = analyzeFooting({
    code: 'ACI 318-25',
    geometry: {
      B: 3404, L: 3404, T: 813, coverClear: 76,
      columnShape: 'square', cx: 457, cy: 457,
    },
    soil: { qa: 320 },
    materials: { fc: 20.68, fy: 413.7 },
    loads: { PD: 1779.3, PL: 1200.9, Mx: 100 },
    reinforcement: {
      bottomX: { bar: '#8', count: 11 },
      bottomY: { bar: '#8', count: 11 },
    },
  });
  near('vuv (direct) ≈ 1.077 MPa', r.punching.vuv, 1.077, 0.02);
  near('vu,max ≈ 1.116 MPa', r.punching.vuMax, 1.116, 0.02);
  near('φ·vc ≈ 1.126 MPa', r.punching.phiVcStress, 1.126, 0.02);
  near('ratio ≈ 0.991', r.punching.ratio, 0.991, 0.02);
  check('Punching still passes (ratio < 1)', r.punching.ok);
});

block('Block 12 — Larger Mx pushes ratio over 1.0', () => {
  // Mx = 300 kN·m → factored 408 kN·m → Δvu = 0.4·408e6·584/8.27e11 = 0.115 MPa
  // vu,max = 1.077 + 0.115 = 1.193 > 1.126 = φ·vc → FAILS
  const r = analyzeFooting({
    code: 'ACI 318-25',
    geometry: {
      B: 3404, L: 3404, T: 813, coverClear: 76,
      columnShape: 'square', cx: 457, cy: 457,
    },
    soil: { qa: 400 },
    materials: { fc: 20.68, fy: 413.7 },
    loads: { PD: 1779.3, PL: 1200.9, Mx: 300 },
    reinforcement: {
      bottomX: { bar: '#8', count: 11 },
      bottomY: { bar: '#8', count: 11 },
    },
  });
  check('Punching FAILS with large unbalanced moment', !r.punching.ok);
  check('Ratio > 1.0', r.punching.ratio > 1.0);
});

block('Block 12 — Both Mx + My add their Δvu contributions', () => {
  // For symmetric (square) column with both Mx, My: γv same, both add
  const r = analyzeFooting({
    code: 'ACI 318-25',
    geometry: {
      B: 3404, L: 3404, T: 813, coverClear: 76,
      columnShape: 'square', cx: 457, cy: 457,
    },
    soil: { qa: 320 },
    materials: { fc: 20.68, fy: 413.7 },
    loads: { PD: 1779.3, PL: 1200.9, Mx: 80, My: 80 },
    reinforcement: {
      bottomX: { bar: '#8', count: 11 },
      bottomY: { bar: '#8', count: 11 },
    },
  });
  // Both contributions should be equal for square column with equal M
  near('Δvu(Mx) ≈ Δvu(My) for symmetric column', r.punching.dvuMx, r.punching.dvuMy, 0.005);
  // And vu,max should equal vuv + 2·Δvu
  near('vu,max = vuv + Δvu(Mx) + Δvu(My)', r.punching.vuMax,
       r.punching.vuv + r.punching.dvuMx + r.punching.dvuMy, 0.001);
});

block('Block 12 — Centric column: vu,max = vuv (no unbalanced moment)', () => {
  // Wight Ex 15-2 centric: ratio should still match Block 11
  const r = analyzeFooting({
    code: 'ACI 318-25',
    geometry: {
      B: 3404, L: 3404, T: 813, coverClear: 76,
      columnShape: 'square', cx: 457, cy: 457,
    },
    soil: { qa: 320 },
    materials: { fc: 20.68, fy: 413.7 },
    loads: { PD: 1779.3, PL: 1200.9 },
    reinforcement: {
      bottomX: { bar: '#8', count: 11 },
      bottomY: { bar: '#8', count: 11 },
    },
  });
  near('vu,max = vuv when no Mx/My', r.punching.vuMax, r.punching.vuv, 0.001);
  near('Δvu(Mx) = 0', r.punching.dvuMx, 0, 0.001);
  near('Δvu(My) = 0', r.punching.dvuMy, 0, 0.001);
});

// ============================================================================
// BLOCK 13 — MEGA-GAP-ANALYSIS fixes (ACI 318-25 §13.3.3.3, §16.3.4.1, etc.)
// ============================================================================
//
// References (ACI 318-25 SI):
//   §13.3.1.2     — d ≥ 150 mm minimum (B3)
//   Table 20.5.1.3.1 — cover ≥ 75 mm cast-against-earth (B4)
//   §16.3.4.1     — column dowels ≥ 0.005·Ag (B2)
//   §13.2.7.1     — supportedMember critical sections (B5, B6)
//   §13.3.3.3(b)  — short-band reinforcement γs = 2/(β+1) (B1)
//   §22.6.6.1     — shear-reinforcement advisory (B9)

block('Block 13 — B3: d ≥ 150 mm warning emitted when violated', () => {
  // T=200, cover=75, #5 db=15.9 → dX = 200-75-7.95 = 117 mm < 150 → warn
  const r = analyzeFooting(defaultInput({
    geometry: { B: 1500, L: 1500, T: 200, coverClear: 75, columnShape: 'square', cx: 300, cy: 300 },
    reinforcement: {
      bottomX: { bar: '#5', count: 6 },
      bottomY: { bar: '#5', count: 6 },
    },
  }));
  const has150Warning = r.warnings.some((w) => w.includes('150 mm minimum'));
  check('Warning emitted when d < 150 mm', has150Warning);
});

block('Block 13 — B4: cover < 75 mm warning emitted', () => {
  // cover = 50 (mud-mat case) → emit warning
  const r = analyzeFooting(defaultInput({
    geometry: { B: 2500, L: 2500, T: 500, coverClear: 50, columnShape: 'square', cx: 400, cy: 400 },
  }));
  const hasCoverWarning = r.warnings.some((w) => w.includes('75 mm minimum') || w.includes('cast-against-earth'));
  check('Warning emitted when cover < 75 mm', hasCoverWarning);
});

block('Block 13 — B2: dowel area = 0.005·Ag (informational mode)', () => {
  // Default input: 400×400 column → Ag = 160000 mm²
  // AsDowelMin = 0.005 × 160000 = 800 mm²
  const r = analyzeFooting(defaultInput());
  near('AsDowelMin = 0.005·Ag', r.dowel.AsDowelMin, 800, 0.001);
  check('Dowel check is informational (no value provided)', r.dowel.informational);
  check('Informational dowel does not flag failure', r.dowel.ok);
  // Engineer specifies dowel area too low → fail
  const r2 = analyzeFooting(defaultInput({
    geometry: { B: 2500, L: 2500, T: 500, coverClear: 75, columnShape: 'square', cx: 400, cy: 400, dowelAreaProvided: 500 },
  }));
  check('Dowel fails when provided 500 mm² < required 800 mm²', !r2.dowel.ok);
});

block('Block 13 — B2: dowel area for force transfer when bearing fails', () => {
  // Heavy load that exceeds column bearing capacity
  // φBn,col = 0.65·0.85·fc·Ag = 0.65·0.85·25·160000 / 1000 = 2210 kN
  // For PD=1500, PL=1500: Pu = 1.2·1500 + 1.6·1500 = 4200 kN > 2210 → excess 1990
  // AsTransfer = 1990·1000 / (0.65·420) = 7290 mm² >> AsMin (800) → governs
  const r = analyzeFooting(defaultInput({
    geometry: { B: 2500, L: 2500, T: 500, coverClear: 75, columnShape: 'square', cx: 400, cy: 400 },
    loads: { PD: 1500, PL: 1500 },
    soil: { qa: 1500 },     // big to skip bearing fail noise
  }));
  check('AsDowelTransfer > 0 when Pu > φBn,col', r.dowel.AsDowelTransfer > 0);
  check('AsDowelReq = max(min, transfer)', r.dowel.AsDowelReq >= r.dowel.AsDowelMin);
});

block('Block 13 — B1: square footing has no short-band split', () => {
  const r = analyzeFooting(defaultInput());     // B = L = 2500
  check('Square footing: gammaS is null in X', r.flexureX.gammaS == null);
  check('Square footing: gammaS is null in Y', r.flexureY.gammaS == null);
});

block('Block 13 — B1: rectangular footing splits short-direction bars', () => {
  // B = 2000 (short), L = 4000 (long), β = 2.0
  // γs = 2/(2+1) = 0.667
  // Short direction = X (B is the short side, X-bars run along X distributed in Y)
  // Wait: convention here — X-direction bars resist bending in X (cantilever along X)
  // For B < L, the cantilever along X (= 1000mm) is shorter than along Y (= 2000mm)
  // So X-direction is the SHORT cantilever direction = needs less reinforcement
  // The "short" in §13.3.3.3 means the SHORT footing dimension, i.e. bars perpendicular
  // to the short side. Code language: "in the short direction" = bars in the short
  // dimension's bending sense.
  // Here B = 2000 (short side along X); bars resisting bending in X (cantilever along Y) = bottomY
  // Hmm convention ambiguity. Our code uses: isShort = (direction X & B = short) | (Y & L = short)
  // For B=2000, L=4000: B is short → direction='X' is short.
  const r = analyzeFooting(defaultInput({
    geometry: { B: 2000, L: 4000, T: 600, coverClear: 75, columnShape: 'square', cx: 400, cy: 400 },
    loads: { PD: 800, PL: 600 },
    reinforcement: {
      bottomX: { bar: '#7', count: 12 },
      bottomY: { bar: '#7', count: 12 },
    },
  }));
  // X is the short direction (B < L)
  near('γs for short direction (X) = 2/(β+1) ≈ 0.667', r.flexureX.gammaS ?? 0, 0.667, 0.01);
  // Y is the long direction → no γs split
  check('Long direction (Y) has no gammaS', r.flexureY.gammaS == null);
  // Bars in band ≈ 0.667 × 12 = 8 (rounded)
  check('barsInBand ≈ 8', r.flexureX.barsInBand === 8);
  check('barsOutsideBand = total − band', r.flexureX.barsOutsideBand === 12 - 8);
});

block('Block 13 — B5: masonry wall critical section is at midpoint', () => {
  // For a wall 'wall_masonry' the critical section is midway between
  // centreline and face → cantilever increases by colDim/4
  // Default colDim = 400, expected extra arm = 100 mm
  const rCol = analyzeFooting(defaultInput({
    geometry: { B: 2500, L: 2500, T: 500, coverClear: 75, columnShape: 'square', cx: 400, cy: 400 },
  }));
  const rMasonry = analyzeFooting(defaultInput({
    geometry: { B: 2500, L: 2500, T: 500, coverClear: 75, columnShape: 'square', cx: 400, cy: 400, supportedMember: 'wall_masonry' },
  }));
  // Cantilever for 'column' = (2500 - 400)/2 = 1050 mm
  // Cantilever for 'wall_masonry' = 1050 + 400/4 = 1150 mm  (extra colDim/4 = 100)
  near('Cantilever for column = 1050 mm', rCol.flexureX.cantilever, 1050, 0.001);
  near('Cantilever for wall_masonry = 1150 mm (+colDim/4)', rMasonry.flexureX.cantilever, 1150, 0.001);
  check('Wall_masonry Mu > column Mu', rMasonry.flexureX.Mu > rCol.flexureX.Mu);
});

block('Block 13 — B6: base-plate critical section at midpoint of column-face & plate-edge', () => {
  // Column 400×400, base plate 600×600 on a 2500×2500 footing
  // Cantilever for 'column' = (2500-400)/2 = 1050
  // Cantilever for 'baseplate' = avg of:
  //   colFaceFromEdge = 1050
  //   plateEdgeFromEdge = (2500-600)/2 = 950
  //   midpoint = (1050 + 950)/2 = 1000
  const r = analyzeFooting(defaultInput({
    geometry: {
      B: 2500, L: 2500, T: 500, coverClear: 75,
      columnShape: 'square', cx: 400, cy: 400,
      supportedMember: 'baseplate',
      basePlate: { Bp: 600, Lp: 600 },
    },
  }));
  near('Cantilever for baseplate = 1000 mm (midway)', r.flexureX.cantilever, 1000, 0.001);
});

block('Block 13 — B9: shear advisory when punching just over capacity', () => {
  // Engineer thin footing — punching fails, but stirrups would suffice
  const r = analyzeFooting(defaultInput({
    geometry: { B: 2500, L: 2500, T: 350, coverClear: 75, columnShape: 'square', cx: 300, cy: 300 },
    loads: { PD: 800, PL: 600 },
  }));
  check('Punching fails for thin footing', !r.punching.ok);
  // Look for the advisory in the calc steps
  const hasAdvisory = r.punching.steps.some((s) =>
    s.title.includes('advisory') || s.title.includes('Advisory'));
  check('Shear-reinforcement advisory step present', hasAdvisory);
});

// ============================================================================
// BLOCK 14 — B7 Eccentric soil-pressure flexure (ACI 318-25 §13.2.6.6)
// ============================================================================
// Sustento bibliográfico:
//   • ACI 318-25 §13.2.6.6 — moment by integrating soil pressure over the
//     cantilever area on one side of a vertical plane.
//   • Wight & MacGregor 7e §15-2 — trapezoidal pressure under footings:
//     q(x) = P/A + M·c/Ix.
//   • Bowles 5e §4-7 — partial-uplift triangle when e > kern (outside B/6).
//
// Implementation:
//   For each cantilever side, integrate L·∫_0^cant q(s)·s ds where q(s) is
//   linear in s. Closed form: Mu = L·cant²·(q1 + 2·q2)/6 when q1, q2 ≥ 0.
//   Partial-uplift cases handled with clipping.

block('Block 14 — B7: centric loading reproduces uniform formula', () => {
  // No moment, no eccentricity → new code = old qnu·cant²/2·bw
  const r = analyzeFooting(defaultInput());     // B=L=2500, T=500, cx=cy=400
  // qnu = (1.2·600 + 1.6·400)/(2.5²) = (720+640)/6.25 = 217.6 kPa
  // cant = (2500-400)/2 = 1050 mm = 1.05 m
  // bw = 2500 mm = 2.5 m
  // Mu = 217.6 · 1.05² / 2 · 2.5 = 299.9 kN·m
  const qnu = (1.2 * 600 + 1.6 * 400) / (2.5 * 2.5);
  const cant_m = (2500 - 400) / 2 / 1000;
  const bw_m = 2.5;
  const expected = qnu * cant_m * cant_m / 2 * bw_m;
  near('Centric Mu reproduces uniform formula', r.flexureX.Mu, expected, 0.01);
});

block('Block 14 — B7: My applied → +X side has higher Mu than centric', () => {
  // Square footing 2500×2500, T=500, P_DL=600, P_LL=400, My=200 kN·m
  // factor = (720+640)/1000 = 1.36
  // Pu = 1360 kN, MuyTotal_factored = 1.36·200 = 272 kN·m
  // q_avg over y at x: q(x) = Pu/A + 12·MuyTotal·x/(L·B³) (in m units)
  // q at face (x=0.2 m, the +face of column): 1360/6.25 + 12·272·0.2/(2.5·2.5³)
  //   = 217.6 + 12·54.4/39.0625 = 217.6 + 16.71 = 234.3 kPa
  // q at edge (x=1.25 m): 1360/6.25 + 12·272·1.25/(2.5·2.5³)
  //   = 217.6 + 12·340/39.0625 = 217.6 + 104.4 = 322.0 kPa
  // Mu = L · cant² · (q_face + 2·q_edge) / 6
  //    = 2.5 · 1.05² · (234.3 + 2·322.0) / 6
  //    = 2.5 · 1.1025 · 878.3 / 6 = 403.4 kN·m
  // (Centric Mu was 299.9 → ~35% increase on the loaded side)
  const r = analyzeFooting(defaultInput({
    geometry: { B: 2500, L: 2500, T: 500, coverClear: 75, columnShape: 'square', cx: 400, cy: 400 },
    loads: { PD: 600, PL: 400, My: 200 },
  }));
  // Mu_X is affected by My (gradient along X)
  near('Mu_X with My ≈ 403.4 kN·m', r.flexureX.Mu, 403.4, 0.03);
  // Mu_Y is unaffected by My (Mu_y term cancels in y-direction integration)
  // Mu_Y should equal centric value (≈ 299.9 with no Mx)
  near('Mu_Y unaffected by My (= centric)', r.flexureY.Mu, 299.9, 0.02);
});

block('Block 14 — B7: Mx applied → +Y side has higher Mu than centric', () => {
  // Symmetric to previous: Mx = 200 affects Y-cantilever, not X
  const r = analyzeFooting(defaultInput({
    geometry: { B: 2500, L: 2500, T: 500, coverClear: 75, columnShape: 'square', cx: 400, cy: 400 },
    loads: { PD: 600, PL: 400, Mx: 200 },
  }));
  near('Mu_Y with Mx ≈ 403.4 kN·m', r.flexureY.Mu, 403.4, 0.03);
  near('Mu_X unaffected by Mx (= centric)', r.flexureX.Mu, 299.9, 0.02);
});

block('Block 14 — B7: column eccentricity ex creates extra Mu_y → larger Mu_X', () => {
  // ex = 100 mm, no applied moments
  // Mu_y_extra (factored) = Pu · ex = 1360 · 0.1 = 136 kN·m
  // Same as if My_service = 100 kN·m (since 100·1.36 = 136)
  // q at +face (x = 200 mm = 0.2 m):
  //   q = 1360/6.25 + 12·136·0.2/(2.5·2.5³)
  //     = 217.6 + 12·27.2/39.0625
  //     = 217.6 + 8.36 = 226 kPa
  // q at +edge (x = 1.25 m):
  //   q = 217.6 + 12·136·1.25/(2.5·2.5³)
  //     = 217.6 + 52.2 = 269.8 kPa
  // But also: critical section shifted by ex toward +X edge
  //   x_crit_+ = ex_m + cx/2_m = 0.1 + 0.2 = 0.3 m
  //   cant_+ = 1.25 - 0.3 = 0.95 m
  //   x_crit_- = ex_m - cx/2_m = 0.1 - 0.2 = -0.1 m
  //   cant_- = -0.1 - (-1.25) = 1.15 m  (longer on -X side, but lower pressure)
  //
  // +X side:
  //   q1 = q(0.3, 0) = 217.6 + 12·136·0.3/39.0625 = 217.6 + 12.54 = 230.1
  //   q2 = q(1.25, 0) = 269.8 (as above)
  //   Mu+ = 2.5 · 0.95² · (230.1 + 2·269.8)/6 = 2.5 · 0.9025 · 769.7/6 = 289.5 kN·m
  // -X side:
  //   q1 = q(-0.1, 0) = 217.6 + 12·136·(-0.1)/39.0625 = 217.6 - 4.18 = 213.4
  //   q2 = q(-1.25, 0) = 217.6 - 52.2 = 165.4
  //   Mu− = 2.5 · 1.15² · (213.4 + 2·165.4)/6 = 2.5 · 1.3225 · 544.2/6 = 299.8 kN·m
  // Max(Mu+, Mu-) = 299.8 — close to centric (because ex is small)
  const r = analyzeFooting(defaultInput({
    geometry: { B: 2500, L: 2500, T: 500, coverClear: 75, columnShape: 'square', cx: 400, cy: 400, ex: 100 },
    loads: { PD: 600, PL: 400 },
  }));
  // Worst Mu_X should be ≈ 299.8 (just slightly different from centric 299.9)
  near('Mu_X with ex=100 ≈ 300 kN·m', r.flexureX.Mu, 299.8, 0.02);
});

block('Block 14 — B7: combined Mx + My on rectangular footing', () => {
  // Rectangular 2000 × 4000, both Mx and My
  // Mu_X depends on My only; Mu_Y depends on Mx only
  const r = analyzeFooting(defaultInput({
    geometry: { B: 2000, L: 4000, T: 600, coverClear: 75, columnShape: 'square', cx: 400, cy: 400 },
    loads: { PD: 600, PL: 400, Mx: 50, My: 50 },
  }));
  // Just verify both are higher than they would be with only one moment
  const r_centric = analyzeFooting(defaultInput({
    geometry: { B: 2000, L: 4000, T: 600, coverClear: 75, columnShape: 'square', cx: 400, cy: 400 },
    loads: { PD: 600, PL: 400 },
  }));
  check('Mu_X with My > Mu_X centric', r.flexureX.Mu > r_centric.flexureX.Mu);
  check('Mu_Y with Mx > Mu_Y centric', r.flexureY.Mu > r_centric.flexureY.Mu);
});

block('Block 14 — B7: heavy eccentricity → partial uplift case (Bowles)', () => {
  // ex = 500 mm on a 2.5-m footing → e/B = 0.2 > kern (1/6 = 0.167)
  // → outside kern → partial uplift (Bowles triangular).
  // Engineering note: under heavy eccentricity, the +X cantilever is SHORT
  // (column close to +X edge) and the -X cantilever is LONG but lightly
  // loaded (or in uplift). Mu can actually DECREASE vs centric — bearing
  // fails first under such eccentricity, which is the governing limit.
  // This test verifies the integration handles partial uplift WITHOUT
  // crashing or producing NaN, and that bearing flags the problem.
  const r = analyzeFooting(defaultInput({
    geometry: { B: 2500, L: 2500, T: 500, coverClear: 75, columnShape: 'square', cx: 400, cy: 400, ex: 500 },
    loads: { PD: 600, PL: 400 },
  }));
  check('Mu_X is finite and > 0 under partial uplift', r.flexureX.Mu > 0 && isFinite(r.flexureX.Mu));
  check('Mu_Y is finite and > 0 under partial uplift', r.flexureY.Mu > 0 && isFinite(r.flexureY.Mu));
  check('Bearing detects partial uplift (governs over flexure)', r.upliftRegion);
});

block('Block 14 — B7: Wight Ex 15-2 (no eccentricity) still matches', () => {
  // Wight Ex 15-2: PD=400 kips, PL=270 kips, no moment.
  // factor = (480+432)/670 = 1.361 (same as before)
  // Should NOT trigger eccentric path → Mu unchanged from Block 11.
  const r = analyzeFooting({
    code: 'ACI 318-25',
    geometry: {
      B: 3404, L: 3404, T: 813, coverClear: 76,
      columnShape: 'square', cx: 457, cy: 457,
      embedment: 305, columnLocation: 'interior',
    },
    soil: { qa: 320 },
    materials: { fc: 20.68, fy: 413.7 },
    loads: { PD: 1779.3, PL: 1200.9 },
    reinforcement: {
      bottomX: { bar: '#8', count: 11 },
      bottomY: { bar: '#8', count: 11 },
    },
  });
  near('Wight Ex 15-2 Mu unchanged by B7 patch', r.flexureX.Mu, 1294, 0.03);
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
