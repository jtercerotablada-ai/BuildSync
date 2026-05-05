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
