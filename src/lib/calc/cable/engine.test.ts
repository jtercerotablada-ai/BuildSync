import { afterEach, describe, expect, it, vi } from 'vitest';
import { cableLine, cosd, liftAngle, pullAt, pullCore, sind, solveDrum, solveLoad, solvePull, validateCable } from './engine';
import { between, near, numbersIn, pickOf, rng } from './testlib';
import { CURVE_POINTS, type CableSection, type LegInput, type LoadInput, type LoadSolution, type PullInput, type PullSolution, type Side } from './types';

vi.setConfig({ testTimeout: 120_000 });
afterEach(() => new Promise<void>((resolve) => setTimeout(resolve, 0)));

/*
 * The oracles in this file are written here and share nothing with engine.ts:
 * a Newton iteration on the two tensions, the law of sines on the force
 * triangle, a bisection on a circle for the displaced point, a bisection on the
 * vertical balance of a symmetric sling, a 2×2 Gaussian elimination for the
 * block on the slope, a fine scan for the best angle, and a Runge–Kutta
 * integration of dT/dθ = μT. Engine units here: lbf, inches, psi, °F.
 */

const RAD = Math.PI / 180;
const A0 = (Math.PI / 4) * 0.25 ** 2; // ¼ in solid round, 0.049087 in²
const STEEL: CableSection = { A: A0, E: 29e6, alpha: 6.5e-6 };
const leg = (angle: number, side: Side, length = 120, section: CableSection = STEEL): LegInput => ({ angle, side, length, section });
const sling = (W: number, a1: number, a2: number, o: Partial<LoadInput> = {}): LoadInput => ({ W, H: 0, legs: [leg(a1, 'left'), leg(a2, 'right')], ...o });
const solved = (i: LoadInput): LoadSolution => {
  const out = solveLoad(i);
  if (!out.ok) throw new Error(`not solved: ${JSON.stringify(out.issues)}`);
  return out;
};

/* ── Oracles ──────────────────────────────────────────────────────────── */

/** Newton on F(T1, T2) = T1 u1 + T2 u2 + (H, −W), with a finite-difference Jacobian. */
function newtonTensions(W: number, H: number, a: [number, Side][]): [number, number] {
  const u = a.map(([ang, side]) => [(side === 'left' ? -1 : 1) * Math.cos(ang * RAD), Math.sin(ang * RAD)]);
  const F = (T: number[]) => [T[0] * u[0][0] + T[1] * u[1][0] + H, T[0] * u[0][1] + T[1] * u[1][1] - W];
  let T = [W, W];
  for (let it = 0; it < 60; it++) {
    const f = F(T);
    const h = 1e-6 * (1 + Math.abs(T[0]) + Math.abs(T[1]));
    const fa = F([T[0] + h, T[1]]);
    const fb = F([T[0], T[1] + h]);
    const j = [
      [(fa[0] - f[0]) / h, (fb[0] - f[0]) / h],
      [(fa[1] - f[1]) / h, (fb[1] - f[1]) / h],
    ];
    const det = j[0][0] * j[1][1] - j[0][1] * j[1][0];
    T = [T[0] - (f[0] * j[1][1] - f[1] * j[0][1]) / det, T[1] - (j[0][0] * f[1] - j[1][0] * f[0]) / det];
  }
  return [T[0], T[1]];
}

/** The force triangle: T1 = |R| sin(a2 − ψ) / sin(a2 − a1), T2 = |R| sin(ψ − a1) / sin(a2 − a1). */
function lawOfSines(W: number, H: number, a: [number, Side][]): [number, number] {
  const dir = a.map(([ang, side]) => Math.atan2(Math.sin(ang * RAD), (side === 'left' ? -1 : 1) * Math.cos(ang * RAD)));
  const R = Math.hypot(H, W);
  const psi = Math.atan2(W, -H);
  const s = Math.sin(dir[1] - dir[0]);
  return [(R * Math.sin(dir[1] - psi)) / s, (R * Math.sin(psi - dir[0])) / s];
}

/** The point where the circles about the anchors meet, nearest the start, found by bisection on the first circle. */
function bruteCircles(a1: [number, number], r1: number, a2: [number, number], r2: number): [number, number] {
  const f = (t: number) => Math.hypot(a1[0] + r1 * Math.cos(t) - a2[0], a1[1] + r1 * Math.sin(t) - a2[1]) - r2;
  const t0 = Math.atan2(-a1[1], -a1[0]);
  let best: number | null = null;
  const N = 12000;
  for (let k = 0; k < N; k++) {
    const lo = t0 - 0.3 + (0.6 * k) / N;
    const hi = t0 - 0.3 + (0.6 * (k + 1)) / N;
    if (f(lo) * f(hi) <= 0) {
      let x = lo;
      let y = hi;
      for (let b = 0; b < 200; b++) {
        const m = (x + y) / 2;
        if (f(x) * f(m) <= 0) y = m;
        else x = m;
      }
      const t = (x + y) / 2;
      if (best === null || Math.abs(t - t0) < Math.abs(best - t0)) best = t;
    }
  }
  if (best === null) throw new Error('no circle crossing');
  return [a1[0] + r1 * Math.cos(best), a1[1] + r1 * Math.sin(best)];
}

const anchorOf = (angle: number, side: Side, L: number): [number, number] => [(side === 'left' ? -1 : 1) * L * Math.cos(angle * RAD), L * Math.sin(angle * RAD)];

/* ── Mode 1 ───────────────────────────────────────────────────────────── */

describe('mode 1 — the section: σ, ε, stretches', () => {
  it('has the hand numbers of a ¼ in steel cable', () => {
    // T = 1000 lbf, L = 120 in, ΔT = 50 °F.
    const c = cableLine({ T: 1000, section: STEEL, length: 120, dT: 50 });
    expect(c.stress).toBeCloseTo(1000 / A0, 9); // 20,371 psi
    expect(c.strain).toBeCloseTo(1000 / A0 / 29e6, 15);
    expect(c.elastic).toBeCloseTo((1000 * 120) / (A0 * 29e6), 12); // 0.084289 in
    expect(c.thermal).toBeCloseTo(6.5e-6 * 120 * 50, 15); // 0.039 in
    expect(c.stretch).toBeCloseTo(c.elastic! + 0.039, 12);
    expect(c.newLength).toBeCloseTo(120 + c.stretch!, 12);
  });

  it('gives the restrained thermal force E·A·α·ΔT: compression on a rise, tension on a fall', () => {
    // 29e6 · 0.0490874 · 6.5e-6 · 50 = 462.65 lbf
    const hand = 29e6 * A0 * 6.5e-6 * 50;
    const rise = cableLine({ T: 300, section: STEEL, length: 120, dT: 50 });
    expect(rise.restrainedForce).toBeCloseTo(-hand, 9);
    expect(rise.restrainedStress).toBeCloseTo(-29e6 * 6.5e-6 * 50, 9); // −9,425 psi
    expect(rise.combinedTension).toBeCloseTo(300 - hand, 9);
    expect(rise.combinedSlack).toBe(true);
    const fall = cableLine({ T: 300, section: STEEL, length: 120, dT: -50 });
    expect(fall.restrainedForce).toBeCloseTo(hand, 9);
    expect(fall.combinedTension).toBeCloseTo(300 + hand, 9);
    expect(fall.combinedSlack).toBe(false);
    expect(fall.combinedStress).toBeCloseTo((300 + hand) / A0, 9);
  });

  it('has no stretch without a length, and no restrained force at ΔT = 0 (never −0)', () => {
    const c = cableLine({ T: 100, section: STEEL, length: null });
    expect(c.elastic).toBeNull();
    expect(c.thermal).toBeNull();
    expect(c.stretch).toBeNull();
    expect(c.newLength).toBeNull();
    expect(Object.is(c.restrainedForce, 0)).toBe(true);
    expect(Object.is(c.restrainedStress, 0)).toBe(true);
  });

  it('gives the MBF ratio, the MBF that n·T asks for, the area and the diameters for an allowable stress', () => {
    const c = cableLine({ T: 2000, section: { ...STEEL, mbf: 10000, factor: 0.4 }, length: 120, n: 5, allowable: 40000 });
    expect(c.mbfRatio).toBeCloseTo(5, 12);
    expect(c.requiredMbf).toBe(10000);
    expect(c.requiredArea).toBeCloseTo(0.05, 15);
    expect(c.requiredDiameter).toBeCloseTo(Math.sqrt((4 * 0.05) / Math.PI), 14); // 0.2523 in solid
    expect(c.requiredNominalDiameter).toBeCloseTo(Math.sqrt(0.05 / 0.4), 14); // a rope of factor 0.4
    expect(cableLine({ T: 0, section: { ...STEEL, mbf: 10000 }, length: 1 }).mbfRatio).toBeNull();
    expect(cableLine({ T: 2000, section: STEEL, length: 1 }).requiredMbf).toBeNull();
    expect(cableLine({ T: 2000, section: STEEL, length: 1 }).requiredArea).toBeNull();
  });
});

describe('mode 1 — the sling', () => {
  it('the textbook symmetric sling: T = W / (2 sin α)', () => {
    // W = 2000 lbf, 60° each side: T = 2000 / (2·0.866025) = 1154.7005 lbf; σ = 23,523 psi; δe = 0.09734 in
    const s = solved(sling(2000, 60, 60));
    const T = 2000 / (2 * Math.sin(60 * RAD));
    expect(s.legs[0].line.T).toBeCloseTo(T, 9);
    expect(s.legs[1].line.T).toBeCloseTo(T, 9);
    expect(s.legs[0].line.stress).toBeCloseTo(T / A0, 6);
    expect(s.legs[0].line.elastic).toBeCloseTo((T * 120) / (A0 * 29e6), 12);
    expect(s.legs[0].line.elastic).toBeCloseTo(0.09734, 5);
    // The load point drops straight down: sin60·dy = −δ  → dy = −0.11240 in
    expect(s.displacement.linear.dx).toBeCloseTo(0, 12);
    expect(s.displacement.linear.dy).toBeCloseTo(-s.legs[0].line.elastic! / Math.sin(60 * RAD), 12);
    expect(s.displacement.linear.dy).toBeCloseTo(-0.1124, 4);
    expect(s.residual).toBeLessThan(1e-9);
  });

  it('a 45° / 45° sling and a 30° / 60° sling (the classic right-angled force triangle)', () => {
    const s = solved(sling(1000, 45, 45));
    expect(s.legs[0].line.T).toBeCloseTo(1000 / Math.SQRT2, 9); // 707.107
    // Legs at 30° and 60° from the horizontal meet at a right angle: T1 = W cos60 ... = W·sin30·... law of sines: T1 = W·cos60°/sin90° = 500, T2 = W·cos30°/sin90° = 866.025
    const t = solved(sling(1000, 30, 60));
    expect(t.legs[0].line.T).toBeCloseTo(500, 9);
    expect(t.legs[1].line.T).toBeCloseTo(866.0254038, 6);
  });

  it('agrees with a Newton iteration and with the law of sines on random slings (with a horizontal force)', () => {
    const r = rng(11);
    for (let k = 0; k < 400; k++) {
      const a1 = between(r, 8, 85);
      const a2 = between(r, 8, 85);
      const W = between(r, 100, 9000);
      // A horizontal force small enough for both tensions to stay positive.
      const H = k % 2 === 0 ? 0 : between(r, -0.3, 0.3) * W * Math.min(Math.tan(a1 * RAD), Math.tan(a2 * RAD));
      const out = solveLoad(sling(W, a1, a2, { H }));
      if (!out.ok) continue;
      const pair: [number, Side][] = [[a1, 'left'], [a2, 'right']];
      const newton = newtonTensions(W, H, pair);
      const sines = lawOfSines(W, H, pair);
      for (let i = 0; i < 2; i++) {
        expect(near(out.legs[i].line.T, newton[i], 1e-8, 1e-8)).toBe(true);
        expect(near(out.legs[i].line.T, sines[i], 1e-9, 1e-9)).toBe(true);
      }
    }
  });

  it('H = 0: T1 = W cosα2 / sin(α1 + α2) and T2 = W cosα1 / sin(α1 + α2)', () => {
    const r = rng(12);
    for (let k = 0; k < 200; k++) {
      const a1 = between(r, 5, 85);
      const a2 = between(r, 5, 85);
      const out = solved(sling(1234, a1, a2));
      expect(near(out.legs[0].line.T, (1234 * Math.cos(a2 * RAD)) / Math.sin((a1 + a2) * RAD), 1e-10)).toBe(true);
      expect(near(out.legs[1].line.T, (1234 * Math.cos(a1 * RAD)) / Math.sin((a1 + a2) * RAD), 1e-10)).toBe(true);
    }
  });

  it('legs on either side: both on the left need a push to the right (H), and take its tension', () => {
    // u1 = (−cos60, sin60), u2 = (−cos30, sin30): T1 u1 + T2 u2 = (−H, W) with H > 0 large enough.
    const both: LoadInput = { W: 1000, H: 1500, legs: [leg(60, 'left'), leg(30, 'left')] };
    const out = solved(both);
    const newton = newtonTensions(1000, 1500, [[60, 'left'], [30, 'left']]);
    expect(near(out.legs[0].line.T, newton[0], 1e-8, 1e-8)).toBe(true);
    expect(near(out.legs[1].line.T, newton[1], 1e-8, 1e-8)).toBe(true);
    expect(out.legs[0].side).toBe('left');
    expect(out.legs[1].side).toBe('left');
  });

  it('one leg: the cable lies along the resultant of W and H, T = √(W² + H²), the angle is an output', () => {
    // W = 300, H = 400 (to the right): T = 500, the cable runs up and to the LEFT at atan(300/400) = 36.8699° from the horizontal.
    const s = solved({ W: 300, H: 400, legs: [leg(0, 'right')] });
    expect(s.legs[0].line.T).toBeCloseTo(500, 12);
    expect(s.legs[0].angle).toBeCloseTo(Math.atan2(300, 400) / RAD, 12);
    expect(s.legs[0].side).toBe('left');
    expect(s.legs[0].ux).toBeCloseTo(-0.8, 14);
    expect(s.legs[0].uy).toBeCloseTo(0.6, 14);
    expect(s.residual).toBeLessThan(1e-9);
    expect(solved({ W: 300, H: -400, legs: [leg(0, 'right')] }).legs[0].side).toBe('right');
    // Vertical: T = W, angle 90.
    const v = solved({ W: 800, H: 0, legs: [leg(33, 'right')] });
    expect(v.legs[0].line.T).toBe(800);
    expect(v.legs[0].angle).toBe(90);
    expect(v.secondOrder).toBeNull();
    // One leg: the load moves straight along the cable, exact = linear.
    expect(v.displacement.exact).toEqual(v.displacement.linear);
    expect(v.displacement.linear.dy).toBeCloseTo(-v.legs[0].line.stretch!, 14);
  });

  it('a leg with its own section and a thermal change: δ = TL/(AE) + αLΔT, per leg', () => {
    const rope: CableSection = { A: 0.12, E: 13e6, alpha: 6.5e-6 };
    const out = solved({ W: 2000, H: 0, dT: 40, legs: [leg(60, 'left', 120, STEEL), leg(60, 'right', 144, rope)] });
    const T = 2000 / (2 * Math.sin(60 * RAD));
    expect(out.legs[0].line.stretch).toBeCloseTo((T * 120) / (A0 * 29e6) + 6.5e-6 * 120 * 40, 12);
    expect(out.legs[1].line.stretch).toBeCloseTo((T * 144) / (0.12 * 13e6) + 6.5e-6 * 144 * 40, 12);
    // A thermal change does not change the tensions of a determinate sling.
    expect(out.legs[0].line.T).toBeCloseTo(T, 9);
  });

  it('the exact displaced position agrees with a brute-force circle crossing, and differs from the linear one at second order', () => {
    const r = rng(13);
    let worst = 0;
    for (let k = 0; k < 60; k++) {
      const a1 = between(r, 15, 80);
      const a2 = between(r, 15, 80);
      const L1 = between(r, 50, 400);
      const L2 = between(r, 50, 400);
      const W = between(r, 500, 6000);
      const soft: CableSection = { A: between(r, 0.02, 0.2), E: between(r, 8e6, 29e6), alpha: 6.5e-6 };
      const dT = between(r, -60, 60);
      const out = solved({ W, H: 0, dT, legs: [leg(a1, 'left', L1, soft), leg(a2, 'right', L2, soft)] });
      // Independent stretches.
      const T = lawOfSines(W, 0, [[a1, 'left'], [a2, 'right']]);
      const d1 = (T[0] * L1) / (soft.A * soft.E) + soft.alpha * L1 * dT;
      const d2 = (T[1] * L2) / (soft.A * soft.E) + soft.alpha * L2 * dT;
      const p = bruteCircles(anchorOf(a1, 'left', L1), L1 + d1, anchorOf(a2, 'right', L2), L2 + d2);
      expect(out.displacement.exact).not.toBeNull();
      const e = out.displacement.exact!;
      const scale = Math.max(L1, L2);
      expect(Math.abs(e.dx - p[0])).toBeLessThan(1e-9 * scale);
      expect(Math.abs(e.dy - p[1])).toBeLessThan(1e-9 * scale);
      // The linear value is the first-order one: its error is second order in the stretch.
      worst = Math.max(worst, out.displacement.exactMinusLinear! / scale);
      expect(out.displacement.exactMinusLinear!).toBeLessThan(0.05 * Math.hypot(e.dx, e.dy) + 1e-9);
    }
    expect(worst).toBeGreaterThan(0);
  });

  it('the exact position of the symmetric sling follows the closed form y = L sinα − √((L+δ)² − L²cos²α)', () => {
    const s = solved(sling(2000, 60, 60));
    const L = 120;
    const d = s.legs[0].line.stretch!;
    const y = L * Math.sin(60 * RAD) - Math.sqrt((L + d) ** 2 - (L * Math.cos(60 * RAD)) ** 2);
    expect(s.displacement.exact!.dx).toBeCloseTo(0, 11);
    expect(s.displacement.exact!.dy).toBeCloseTo(y, 11);
    // Linearised: −δ / sinα.  They differ in the fourth figure or later, in the right direction.
    expect(Math.abs(s.displacement.exact!.dy - s.displacement.linear.dy)).toBeLessThan(1e-3);
  });

  it('the tensions recomputed in the displaced geometry (second order)', () => {
    // Symmetric sling: bisection on the vertical balance 2·k·(ℓ − L)·(L sinα − y)/ℓ = W with ℓ = √((L cosα)² + (L sinα − y)²).
    const W = 2000;
    const L = 120;
    const a = 60 * RAD;
    const k = (29e6 * A0) / L;
    const balance = (y: number) => {
      const l = Math.hypot(L * Math.cos(a), L * Math.sin(a) - y);
      return 2 * k * (l - L) * ((L * Math.sin(a) - y) / l) - W;
    };
    let lo = -5;
    let hi = 0;
    for (let i = 0; i < 200; i++) {
      const mid = (lo + hi) / 2;
      if (balance(lo) * balance(mid) <= 0) hi = mid;
      else lo = mid;
    }
    const y = (lo + hi) / 2;
    const l = Math.hypot(L * Math.cos(a), L * Math.sin(a) - y);
    const T = k * (l - L);
    const s = solved(sling(W, 60, 60));
    expect(s.secondOrder).not.toBeNull();
    expect(s.secondOrder!.T1).toBeCloseTo(T, 6);
    expect(s.secondOrder!.T2).toBeCloseTo(T, 6);
    expect(s.secondOrder!.displacement.dy).toBeCloseTo(y, 9);
    // The geometry change (the angle gets steeper by the drop) is a tiny change of tension here.
    expect(Math.abs(s.secondOrder!.change1)).toBeLessThan(1e-3);
    expect(s.secondOrder!.change1).toBeCloseTo((T - s.legs[0].line.T) / s.legs[0].line.T, 12);
  });

  it('the second-order state is an equilibrium of the deformed geometry (checked from the angles it reports)', () => {
    const r = rng(14);
    for (let k = 0; k < 100; k++) {
      const W = between(r, 500, 5000);
      const H = between(r, -200, 200);
      const soft: CableSection = { A: between(r, 0.02, 0.1), E: between(r, 8e6, 13e6), alpha: 6.5e-6 };
      const out = solveLoad({ W, H, dT: 0, legs: [leg(between(r, 30, 70), 'left', 100, soft), leg(between(r, 30, 70), 'right', 140, soft)] });
      if (!out.ok || !out.secondOrder) continue;
      const so = out.secondOrder;
      const fx = -so.T1 * Math.cos(so.angle1 * RAD) + so.T2 * Math.cos(so.angle2 * RAD) + H;
      const fy = so.T1 * Math.sin(so.angle1 * RAD) + so.T2 * Math.sin(so.angle2 * RAD) - W;
      expect(Math.hypot(fx, fy)).toBeLessThan(1e-8 * W);
    }
  });

  it('a very stiff sling: the second-order tensions and the geometry change tend to the first-order ones', () => {
    const stiff: CableSection = { A: 1, E: 29e12, alpha: 0 };
    const out = solved({ W: 2000, H: 100, legs: [leg(40, 'left', 100, stiff), leg(70, 'right', 100, stiff)] });
    expect(out.secondOrder).not.toBeNull();
    expect(Math.abs(out.secondOrder!.change1)).toBeLessThan(1e-9);
    expect(Math.abs(out.secondOrder!.change2)).toBeLessThan(1e-9);
  });

  it('scaling: twice the load gives twice every force and twice every stress and (linear) stretch', () => {
    const a = solved(sling(1500, 50, 65, { H: 120 }));
    const b = solved(sling(3000, 50, 65, { H: 240 }));
    for (let i = 0; i < 2; i++) {
      expect(near(b.legs[i].line.T, 2 * a.legs[i].line.T, 1e-12)).toBe(true);
      expect(near(b.legs[i].line.stress, 2 * a.legs[i].line.stress, 1e-12)).toBe(true);
      expect(near(b.legs[i].line.elastic!, 2 * a.legs[i].line.elastic!, 1e-12)).toBe(true);
    }
    expect(near(b.displacement.linear.dy, 2 * a.displacement.linear.dy, 1e-11)).toBe(true);
  });

  it('a sling with no load: every force is zero, with the warning', () => {
    const out = solved(sling(0, 50, 50));
    expect(out.warnings.map((w) => w.code)).toContain('no-load');
    expect(out.legs[0].line.T).toBe(0);
    expect(Object.is(out.legs[0].line.stress, 0)).toBe(true);
    const one = solved({ W: 0, H: 0, legs: [leg(0, 'left')] });
    expect(one.legs[0].angle).toBe(90);
    expect(one.legs[0].line.T).toBe(0);
  });
});

describe('mode 1 — every code', () => {
  const codes = (i: unknown) => {
    const out = solveLoad(i as LoadInput);
    return out.ok ? [] : out.issues.map((x) => x.code);
  };
  it("'number': a value that is not a number, or past 1e30", () => {
    expect(codes(sling(Number.NaN, 60, 60))).toContain('number');
    expect(codes(sling(1, 60, 60, { H: Infinity }))).toContain('number');
    expect(codes(sling(1e31, 60, 60))).toContain('number');
    expect(codes({ W: 1, H: 0, legs: [{ ...leg(60, 'left'), length: Number.NaN }, leg(60, 'right')] })).toContain('number');
    const bad = solveLoad({ W: 1, H: 0, legs: [{ ...leg(60, 'left'), section: { ...STEEL, E: Number.NaN } }, leg(60, 'right')] });
    expect(bad.ok).toBe(false);
    if (!bad.ok) expect(bad.issues.find((i) => i.field === 'E')).toMatchObject({ code: 'number', leg: 1 });
  });
  it("'range': W < 0, the number of legs, an angle outside 0–90, a length or a section ≤ 0", () => {
    const issue = (i: unknown, field: string) => {
      const out = solveLoad(i as LoadInput);
      return out.ok ? undefined : out.issues.find((x) => x.field === field);
    };
    expect(issue(sling(-1, 60, 60), 'W')).toMatchObject({ code: 'range', min: 0 });
    expect(issue({ W: 1, H: 0, legs: [] }, 'legs')).toMatchObject({ code: 'range', min: 1, max: 2 });
    expect(issue({ W: 1, H: 0, legs: [leg(1, 'left'), leg(1, 'left'), leg(1, 'left')] }, 'legs')).toMatchObject({ code: 'range' });
    expect(issue(sling(1, 91, 60), 'angle')).toMatchObject({ code: 'range', min: 0, max: 90, leg: 1 });
    expect(issue(sling(1, 60, -1), 'angle')).toMatchObject({ code: 'range', leg: 2 });
    expect(issue({ W: 1, H: 0, legs: [leg(60, 'left', 0), leg(60, 'right')] }, 'length')).toMatchObject({ code: 'range', min: 0, minOpen: true, leg: 1 });
    expect(issue({ W: 1, H: 0, legs: [leg(60, 'left', 1, { ...STEEL, A: 0 }), leg(60, 'right')] }, 'A')).toMatchObject({ code: 'range', minOpen: true });
    expect(issue({ W: 1, H: 0, legs: [leg(60, 'left'), leg(60, 'right', 1, { ...STEEL, E: -1 })] }, 'E')).toMatchObject({ code: 'range', leg: 2 });
    expect(issue({ W: 1, H: 0, legs: [leg(60, 'left'), { ...leg(60, 'right'), side: 'up' as Side }] }, 'side')).toMatchObject({ code: 'range', leg: 2 });
    expect(issue(sling(1, 60, 60, { n: 0 }), 'n')).toMatchObject({ code: 'range' });
    expect(issue(sling(1, 60, 60, { allowable: -3 }), 'allowable')).toMatchObject({ code: 'range' });
    // The angle of a single leg is an output: it is not checked.
    expect(solveLoad({ W: 1, H: 0, legs: [leg(1000, 'left')] }).ok).toBe(true);
  });
  it("'parallel-legs': both legs vertical, or horizontal on opposite sides, or the same line", () => {
    for (const i of [sling(100, 90, 90), sling(100, 0, 0), sling(100, 45, 45, { legs: [leg(45, 'left'), leg(45, 'left', 200)] })]) {
      const out = solveLoad(i);
      expect(out.ok).toBe(false);
      if (!out.ok) {
        expect(out.issues[0].code).toBe('parallel-legs');
        expect(Math.abs(out.issues[0].numbers![0])).toBeLessThan(1e-9);
      }
    }
  });
  it("'slack-leg': equilibrium would need a leg to push", () => {
    // Both legs on the left with nothing pushing to the right: Σx = −(T1 c1 + T2 c2) = 0 forces a negative tension.
    const out = solveLoad({ W: 1000, H: 0, legs: [leg(60, 'left'), leg(30, 'left')] });
    expect(out.ok).toBe(false);
    if (!out.ok) {
      expect(out.issues[0].code).toBe('slack-leg');
      const [t1, t2] = out.issues[0].numbers!;
      expect(Math.min(t1, t2)).toBeLessThan(0);
      expect(out.issues[0].leg === 1 ? t1 : t2).toBeLessThan(0);
    }
  });
  it("'size': legs almost on one line and a load near the largest number", () => {
    const out = solveLoad({ W: 1e30, H: 0, legs: [leg(90, 'left'), leg(89.9999, 'right')] });
    expect(out.ok).toBe(false);
    if (!out.ok) expect(out.issues[0].code).toBe('size');
  });
  it("warnings: 'no-exact-position' (the stretched legs cannot meet), 'no-second-order', 'restrained-slack', 'large-strain'", () => {
    // Shrinking by cooling until the cables have no length (1 + αΔT < 0): the stretched legs cannot meet.
    const cold = solved({ W: 100, H: 0, dT: -150000, legs: [leg(60, 'left', 120, { A: 1, E: 1e9, alpha: 1e-5 }), leg(60, 'right', 120, { A: 1, E: 1e9, alpha: 1e-5 })] });
    expect(cold.displacement.exact).toBeNull();
    expect(cold.displacement.exactMinusLinear).toBeNull();
    expect(cold.warnings.map((w) => w.code)).toContain('no-exact-position');
    expect(cold.warnings.map((w) => w.code)).toContain('no-second-order');
    expect(cold.secondOrder).toBeNull();
    // A rise with the ends held: the load's tension cannot cover the thermal compression.
    const warm = solved(sling(2000, 60, 60, { dT: 150 }));
    expect(warm.warnings.filter((w) => w.code === 'restrained-slack').map((w) => w.leg)).toEqual([1, 2]);
    // A very soft cable: more than 1 % strain.
    const soft = solved({ W: 2000, H: 0, legs: [leg(60, 'left', 120, { A: 0.05, E: 1e5, alpha: 0 }), leg(60, 'right', 120, { A: 0.05, E: 1e5, alpha: 0 })] });
    const big = soft.warnings.find((w) => w.code === 'large-strain');
    expect(big?.numbers?.[0]).toBeGreaterThan(0.01);
    expect(solved(sling(2000, 60, 60)).warnings).toEqual([]);
  });
  it("warning 'shrinks-past-zero': a fall in temperature that takes more than the whole length (C14)", () => {
    // 120 in legs, α = 6.5e-6, ΔT = −500,000 °F: the free contraction is 389.9 in, more than the cable there is.
    const s = solved(sling(2000, 60, 60, { dT: -500000 }));
    const w = s.warnings.filter((x) => x.code === 'shrinks-past-zero');
    expect(w.map((x) => x.leg)).toEqual([1, 2]);
    expect(w[0].numbers![0]).toBeLessThan(0);
    // A fall that leaves cable (−50,000 °F: the length is 1 − 0.325 of what it was) says nothing of the kind.
    expect(solved(sling(2000, 60, 60, { dT: -50000 })).warnings.map((x) => x.code)).not.toContain('shrinks-past-zero');
  });
  it('validateCable reports the cable faults of the other two modes', () => {
    expect(validateCable(STEEL, 10, 0, null, null)).toEqual([]);
    expect(validateCable({ ...STEEL, A: Number.NaN }, null, 0, null, null)).toEqual([{ code: 'number', field: 'A' }]);
    expect(validateCable(STEEL, 0, 0, null, null)[0]).toMatchObject({ code: 'range', field: 'length' });
    expect(validateCable(STEEL, 10, Number.NaN, 0, -1).map((i) => i.field)).toEqual(['dT', 'n', 'allowable']);
  });
});

/* ── Mode 2 ───────────────────────────────────────────────────────────── */

/** T and N from the two equations of equilibrium, by Gaussian elimination: N + T sinφ = W cosθ ; T cosφ − σμN = W sinθ + σWa. */
function balance(W: number, theta: number, mu: number, phi: number, sigma: 1 | -1, a = 0): { T: number; N: number } {
  const m = [
    [Math.sin(phi * RAD), 1, W * Math.cos(theta * RAD)],
    [Math.cos(phi * RAD), -sigma * mu, W * Math.sin(theta * RAD) + sigma * W * a],
  ];
  // Eliminate on the larger pivot.
  if (Math.abs(m[1][0]) > Math.abs(m[0][0])) m.reverse();
  const f = m[1][0] / m[0][0];
  const n2 = m[1].map((v, i) => v - f * m[0][i]);
  const N = n2[2] / n2[1];
  const T = (m[0][2] - m[0][1] * N) / m[0][0];
  return { T, N };
}

const pull = (o: Partial<PullInput> = {}): PullInput => ({ W: 100, theta: 0, muS: 0.5, muK: 0.4, phi: 30, aOverG: null, travel: 'along', ...o });
const run = (i: PullInput): PullSolution => {
  const out = solvePull(i);
  if (!out.ok) throw new Error(`not solved: ${JSON.stringify(out.issues)}`);
  return out;
};
const reg = (s: PullSolution, id: 'start' | 'run' | 'accel') => s.regimes.find((r) => r.id === id)!;

describe('mode 2 — pulling a load against friction: the textbook cases', () => {
  it('a crate on level ground pulled by a rope at 30°', () => {
    // W = 100, μs = 0.5, μk = 0.4, φ = 30°.
    // run:   T = 0.4·100 / (cos30 + 0.4 sin30) = 40 / 1.066025 = 37.5226; N = 100 − 37.5226·0.5 = 81.2387; F = 32.4955
    // start: T = 50 / (cos30 + 0.5·sin30) = 50 / 1.116025 = 44.8010
    const s = run(pull());
    expect(reg(s, 'run').T).toBeCloseTo(40 / (Math.cos(30 * RAD) + 0.2), 10);
    expect(reg(s, 'run').T).toBeCloseTo(37.5226, 3);
    expect(reg(s, 'run').N).toBeCloseTo(100 - reg(s, 'run').T! * 0.5, 10);
    expect(reg(s, 'run').F).toBeCloseTo(0.4 * reg(s, 'run').N!, 12);
    expect(reg(s, 'start').T).toBeCloseTo(50 / (Math.cos(30 * RAD) + 0.25), 10);
    expect(reg(s, 'start').T).toBeCloseTo(44.8018, 3);
    // The share that lifts and the share that drags.
    expect(reg(s, 'run').lift).toBeCloseTo(reg(s, 'run').T! * 0.5, 12);
    expect(reg(s, 'run').drag).toBeCloseTo(reg(s, 'run').T! * Math.cos(30 * RAD), 12);
    expect(s.governing).toBe('start');
    expect(s.regimes.map((r) => r.id)).toEqual(['start', 'run']);
  });

  it('a block on a 20° incline pulled up the slope, cable parallel to it', () => {
    // W = 100, θ = 20°, μ = 0.3, φ = 0: T = W (sin20 + 0.3 cos20) = 100·(0.342020 + 0.281908) = 62.3928
    const s = run(pull({ theta: 20, muS: 0.3, muK: 0.3, phi: 0 }));
    expect(reg(s, 'run').T).toBeCloseTo(100 * (Math.sin(20 * RAD) + 0.3 * Math.cos(20 * RAD)), 10);
    expect(reg(s, 'run').T).toBeCloseTo(62.3928, 3);
    expect(reg(s, 'run').N).toBeCloseTo(100 * Math.cos(20 * RAD), 10);
    expect(reg(s, 'run').weightAlong).toBeCloseTo(100 * Math.sin(20 * RAD), 10);
    expect(reg(s, 'run').lift).toBe(0);
  });

  it('the classic optimum-angle example: the best angle is atan μ and T_min = μW / √(1+μ²) on level ground', () => {
    // μ = 0.5: φ* = 26.565°, T_min = 0.5·100/√1.25 = 44.7214 (against 50 at φ = 0).
    const s = run(pull({ muS: 0.5, muK: 0.5, phi: 0 }));
    expect(reg(s, 'run').T).toBeCloseTo(50, 12);
    expect(reg(s, 'run').optimum.phi).toBeCloseTo(26.5651, 4);
    expect(reg(s, 'run').optimum.T).toBeCloseTo(44.7214, 4);
    expect(reg(s, 'run').optimum.closedForm).toBeCloseTo(50 / Math.sqrt(1.25), 12);
    expect(reg(s, 'run').optimum.valid).toBe(true);
    // The textbook crate: φ* = 21.80° (μk = 0.4), T_min = 37.14.
    const c = run(pull());
    expect(reg(c, 'run').optimum.phi).toBeCloseTo(21.8014, 4);
    expect(reg(c, 'run').optimum.T).toBeCloseTo(37.1391, 3);
    expect(reg(c, 'start').optimum.phi).toBeCloseTo(26.5651, 4);
  });

  it("travel 'against' (a cable that lowers or holds back): the best direction is below the surface", () => {
    // θ = 30°, μ = 0.2, moving down while the cable pulls up the slope: T = W (sin30 − 0.2 cos30)/(cosφ − 0.2 sinφ)
    const s = run(pull({ theta: 30, muS: 0.2, muK: 0.2, phi: 0, travel: 'against' }));
    expect(reg(s, 'run').T).toBeCloseTo(100 * (0.5 - 0.2 * Math.cos(30 * RAD)), 10);
    expect(reg(s, 'run').optimum.phi).toBeCloseTo(-Math.atan(0.2) / RAD, 10);
    expect(reg(s, 'run').optimum.T).toBeCloseTo((100 * (0.5 - 0.2 * Math.cos(30 * RAD))) / Math.sqrt(1.04), 10);
  });
});

describe('mode 2 — against independent checks', () => {
  it('the force balance holds to machine precision on random (W, θ, μ, φ, a, direction)', () => {
    const r = rng(21);
    let checked = 0;
    for (let k = 0; k < 4000; k++) {
      const W = between(r, 1, 5000);
      const theta = between(r, -30, 60);
      const muK = between(r, 0.02, 1.2);
      const phi = between(r, -90, 90);
      const a = r() < 0.5 ? 0 : between(r, 0, 0.6);
      const travel = r() < 0.7 ? 'along' : 'against';
      const out = solvePull(pull({ W, theta, muS: muK, muK, phi, aOverG: a === 0 ? null : a, travel }));
      if (!out.ok) continue;
      const sigma = travel === 'along' ? 1 : -1;
      const regime = reg(out, a === 0 ? 'run' : 'accel');
      if (regime.status !== 'pull') continue;
      const T = regime.T!;
      const N = regime.N!;
      const Nres = N + T * Math.sin(phi * RAD) - W * Math.cos(theta * RAD);
      const Sres = T * Math.cos(phi * RAD) - W * Math.sin(theta * RAD) - sigma * muK * N - sigma * W * a;
      expect(Math.abs(Nres)).toBeLessThanOrEqual(1e-12 * (W + T) + 1e-12);
      expect(Math.abs(Sres)).toBeLessThanOrEqual(1e-12 * (W + T) + 1e-12);
      const ind = balance(W, theta, muK, phi, sigma, a);
      expect(near(T, ind.T, 1e-9, 1e-9)).toBe(true);
      expect(regime.F).toBeCloseTo(muK * N, 9);
      checked++;
    }
    expect(checked).toBeGreaterThan(1500);
  });

  it('a fine scan of T(φ) puts the minimum at σ·atan μ, and T_min is the closed form', () => {
    const r = rng(22);
    let seen = 0;
    for (let k = 0; k < 24; k++) {
      const W = between(r, 10, 1000);
      const theta = between(r, -8, 25);
      const mu = between(r, 0.15, 1);
      const travel = k % 3 === 0 ? 'against' : 'along';
      const sigma = travel === 'along' ? 1 : -1;
      // Scan with the independent balance, 0.001° steps; only angles where the pull is physical (T > 0, N ≥ 0).
      let best = Infinity;
      let at = 0;
      for (let i = -90000; i <= 90000; i++) {
        const phi = i / 1000;
        const b = balance(W, theta, mu, phi, sigma);
        if (b.T > 0 && b.N >= 0 && b.T < best) {
          best = b.T;
          at = phi;
        }
      }
      const s = run(pull({ W, theta, muS: mu, muK: mu, phi: 5, travel }));
      const o = reg(s, 'run').optimum;
      if (!o.valid) continue;
      seen++;
      expect(Math.abs(at - sigma * Math.atan(mu) / RAD)).toBeLessThanOrEqual(0.0015);
      expect(Math.abs(o.phi - at)).toBeLessThanOrEqual(0.0015);
      expect(near(best, o.closedForm, 1e-8)).toBe(true);
      expect(near(o.T!, o.closedForm, 1e-12)).toBe(true);
      // The phi we derived is measured from the surface: from the horizontal it is theta + phi*.
      expect(o.phi + theta).toBeCloseTo(at + theta, 2);
    }
    expect(seen).toBeGreaterThan(10);
  });

  it('the optimum does not depend on the slope and the acceleration (only on μ)', () => {
    const a = reg(run(pull({ theta: 0, muK: 0.35, muS: 0.35 })), 'run').optimum.phi;
    const b = reg(run(pull({ theta: 25, muK: 0.35, muS: 0.35 })), 'run').optimum.phi;
    const c = reg(run(pull({ theta: 25, muK: 0.35, muS: 0.35, aOverG: 0.2 })), 'accel').optimum.phi;
    expect(a).toBe(b);
    expect(a).toBe(c);
  });

  it('the curve T(φ) has 181 points, matches an independent evaluation, and its marked minimum is the least valid point', () => {
    const s = run(pull({ W: 250, theta: 10, muS: 0.45, muK: 0.35, phi: 12 }));
    expect(s.curves.map((c) => c.regime)).toEqual(['start', 'run']);
    for (const c of s.curves) {
      expect(c.points).toHaveLength(CURVE_POINTS);
      expect(c.points[0].phi).toBe(-90);
      expect(c.points[180].phi).toBe(90);
      const mu = c.regime === 'start' ? 0.45 : 0.35;
      c.points.forEach((p) => {
        const b = balance(250, 10, mu, p.phi, 1);
        if (p.valid) {
          expect(near(p.T!, b.T, 1e-9, 1e-9)).toBe(true);
          expect(b.N).toBeGreaterThanOrEqual(-1e-9);
        } else expect(p.T).toBeNull();
      });
      const valid = c.points.filter((p) => p.valid);
      const least = Math.min(...valid.map((p) => p.T!));
      expect(c.points[c.minIndex!].T).toBe(least);
      // On a 1° grid the least is within a degree of atan μ.
      expect(Math.abs(c.points[c.minIndex!].phi - Math.atan(mu) / RAD)).toBeLessThanOrEqual(1);
    }
    expect(pullAt(250, 10, 0.35, 12, 0, 'along').T).toBeCloseTo(reg(s, 'run').T!, 12);
  });

  it('acceleration: T = W (sinθ + μ cosθ + a/g) / (cosφ + μ sinφ); the best angle is unchanged', () => {
    const s = run(pull({ W: 100, theta: 0, muS: 0.5, muK: 0.4, phi: 30, aOverG: 0.25 }));
    expect(s.regimes.map((r) => r.id)).toEqual(['start', 'run', 'accel']);
    expect(reg(s, 'accel').T).toBeCloseTo((100 * (0.4 + 0.25)) / (Math.cos(30 * RAD) + 0.4 * Math.sin(30 * RAD)), 10);
    expect(reg(s, 'accel').inertia).toBe(25);
    expect(s.governing).toBe('accel');
    expect(s.curves).toHaveLength(3);
    // Braking (a < 0) needs less.
    expect(reg(run(pull({ aOverG: -0.1 })), 'accel').T!).toBeLessThan(reg(run(pull()), 'run').T!);
    // a = 0 is no acceleration regime.
    expect(run(pull({ aOverG: 0 })).regimes).toHaveLength(2);
  });

  it('the lift-off angle is atan2(cosθ, sinθ + σa/g), independent of μ, and N = 0 there', () => {
    expect(liftAngle(0, 0, 1)).toBe(90);
    expect(liftAngle(30, 0, 1)).toBeCloseTo(60, 12);
    expect(liftAngle(-10, 0, 1)).toBeNull();
    expect(liftAngle(0, 0.5, 1)).toBeCloseTo(Math.atan2(1, 0.5) / RAD, 12);
    const r = rng(23);
    for (let k = 0; k < 300; k++) {
      const theta = between(r, -30, 60);
      const mu = between(r, 0.05, 1.5);
      const a = r() < 0.5 ? 0 : between(r, 0, 0.8);
      const sigma = r() < 0.5 ? 1 : -1;
      const L = liftAngle(theta, a, sigma);
      if (L === null || L > 90) continue;
      const core = pullCore(100, theta, mu, L, a, sigma);
      // At lift-off the friction formula gives N = 0 (when it is a pull at all).
      if (core.rawT !== null && core.rawT > 0) {
        const N = 100 * Math.cos(theta * RAD) - core.rawT * Math.sin(L * RAD);
        expect(Math.abs(N)).toBeLessThan(1e-8);
      }
      expect(liftAngle(theta, a, sigma)).toBe(L);
    }
    // Level ground, a = 0: the lift tension is W.
    expect(reg(run(pull()), 'run').liftTension).toBeCloseTo(100, 10);
    expect(reg(run(pull({ theta: 30 })), 'run').phiLift).toBeCloseTo(60, 12);
  });

  it('exact multiples of 90° are exact (a pull straight up from level ground is T = W, N = 0)', () => {
    expect(cosd(90)).toBe(0);
    expect(sind(180)).toBe(0);
    expect(sind(-90)).toBe(-1);
    const s = run(pull({ phi: 90, muS: 0.3, muK: 0.3 }));
    expect(reg(s, 'run').T).toBeCloseTo(100, 12);
    expect(reg(s, 'run').N).toBe(0);
    expect(reg(s, 'run').status).toBe('pull');
  });

  it('scaling: twice the weight gives twice T, N and F, and the same angles', () => {
    const a = run(pull({ W: 80, theta: 12, phi: 20, aOverG: 0.1 }));
    const b = run(pull({ W: 160, theta: 12, phi: 20, aOverG: 0.1 }));
    for (const id of ['start', 'run', 'accel'] as const) {
      expect(near(reg(b, id).T!, 2 * reg(a, id).T!, 1e-12)).toBe(true);
      expect(near(reg(b, id).N!, 2 * reg(a, id).N!, 1e-12)).toBe(true);
      expect(near(reg(b, id).F!, 2 * reg(a, id).F!, 1e-12)).toBe(true);
      expect(reg(b, id).optimum.phi).toBe(reg(a, id).optimum.phi);
    }
  });
});

describe('mode 2 — every status and code', () => {
  it("'slides-on-its-own', with the holding tension of a cable pulling the other way", () => {
    // θ = −20° along the pull (down the slope), μ = 0.2: tan20 = 0.364 > 0.2, it slides by itself. Holding: cable pulls UP the slope
    // at φ above the surface: T = W (sin20 − 0.2 cos20)/(cosφ − 0.2 sinφ).
    const s = run(pull({ theta: -20, muS: 0.2, muK: 0.2, phi: 10 }));
    const r = reg(s, 'run');
    expect(r.status).toBe('slides-on-its-own');
    expect(r.T).toBeNull();
    expect(r.rawT!).toBeLessThan(0);
    const expected = (100 * (Math.sin(20 * RAD) - 0.2 * Math.cos(20 * RAD))) / (Math.cos(10 * RAD) - 0.2 * Math.sin(10 * RAD));
    expect(r.hold!.T).toBeCloseTo(expected, 10);
    // Independent: the block moving down (σ = −1 for the flipped cable) with a cable pulling up the slope (slope +20 along it).
    const b = balance(100, 20, 0.2, 10, -1);
    expect(r.hold!.T).toBeCloseTo(b.T, 9);
    expect(r.hold!.N).toBeCloseTo(b.N, 9);
    expect(s.governing).toBeNull();
    expect(s.warnings.map((w) => w.code)).toContain('no-governing');
    // Static friction enough to keep it at rest (μs = 0.5 > tan 20°) but kinetic not: a pull is needed to START it, and once going it runs on its own.
    const mixed = run(pull({ theta: -20, muS: 0.5, muK: 0.2, phi: 10 }));
    expect(reg(mixed, 'start').status).toBe('pull');
    expect(reg(mixed, 'run').status).toBe('slides-on-its-own');
    expect(mixed.governing).toBe('start');
  });
  it("'stays-put': going against the pull needs a push when friction holds", () => {
    const s = run(pull({ theta: 5, muS: 0.5, muK: 0.5, phi: 10, travel: 'against' }));
    expect(reg(s, 'run').status).toBe('stays-put');
    expect(reg(s, 'run').T).toBeNull();
    expect(reg(s, 'run').hold).toBeNull();
  });
  it("'self-locking': along the pull, the harder the cable pulls the harder friction grips", () => {
    // A cable pressing the block into the surface at a steep angle: Den = cosφ + μ sinφ < 0 while the block would stay put.
    const s = run(pull({ theta: 10, muS: 0.5, muK: 0.5, phi: -80 }));
    expect(reg(s, 'run').status).toBe('self-locking');
    expect(reg(s, 'run').T).toBeNull();
    expect(reg(s, 'run').rawT!).toBeLessThan(0);
  });
  it("'cannot-hold': against the pull, a block that slides by itself is not held by any tension at this angle (A3)", () => {
    // θ = 60°, μ = 0.5, φ = 70° above the surface: the cable lifts the block as it pulls, so friction grips LESS as T rises.
    const s = run(pull({ theta: 60, muS: 0.5, muK: 0.5, phi: 70, travel: 'against' }));
    expect(reg(s, 'run').status).toBe('cannot-hold');
    expect(reg(s, 'run').T).toBeNull();
    expect(reg(s, 'run').rawT!).toBeLessThan(0);
    expect(reg(s, 'run').role).toBeNull();
  });
  it("'leaves-surface': N would be negative; T and N are the formula's, the regime is refused, phiLift says where", () => {
    const s = run(pull({ theta: 45, muS: 0.2, muK: 0.2, phi: 60 }));
    const r = reg(s, 'run');
    expect(r.status).toBe('leaves-surface');
    expect(r.T).toBeNull();
    expect(r.N!).toBeLessThan(0);
    expect(r.rawT!).toBeGreaterThan(0);
    expect(r.phiLift).toBeCloseTo(45, 12); // 90 − θ
    expect(60).toBeGreaterThan(r.phiLift!);
    expect(s.governing).toBeNull();
    const curve = s.curves.find((c) => c.regime === 'run')!;
    expect(curve.points.find((p) => p.phi === 60)!.valid).toBe(false);
    expect(curve.points.find((p) => p.phi === 60)!.status).toBe('leaves-surface');
    // Below the lift-off angle it is fine.
    expect(reg(run(pull({ theta: 45, muS: 0.2, muK: 0.2, phi: 40 })), 'run').status).toBe('pull');
    // The optimum (11.3° above the surface) is below the lift-off angle here: valid.
    expect(r.optimum.valid).toBe(true);
  });
  it('a steep pull into the surface on a block that already slides is a STOPPING tension, not a pull that starts it (A7)', () => {
    // Along the pull, θ = −25° (down), μ = 0.1, φ = −85°: Den < 0 and c < 0. The block slides at T = 0; the formula's T = 100·... stops it.
    const core = pullCore(100, -25, 0.1, -85, 0, 1);
    expect(core.den).toBeLessThan(0);
    expect(core.c).toBeLessThan(0);
    expect(core.rawT!).toBeGreaterThan(0);
    expect(core.status).toBe('slides-on-its-own');
    expect(core.T).toBeNull();
    const s = run(pull({ theta: -25, muS: 0.1, muK: 0.1, phi: -85 }));
    expect(reg(s, 'run').status).toBe('slides-on-its-own');
    expect(s.governing).toBeNull();
    // Independent: the net force along the travel at T = 0 is positive, and falls as the cable presses the block down.
    const g = (T: number) => T * Math.cos(-85 * RAD) - 100 * Math.sin(-25 * RAD) - 0.1 * (100 * Math.cos(-25 * RAD) - T * Math.sin(-85 * RAD));
    expect(g(0)).toBeGreaterThan(0);
    expect(g(1000)).toBeLessThan(g(0));
  });
  it("'number' and 'range'", () => {
    const f = (i: unknown, field: string) => {
      const out = solvePull(i as PullInput);
      return out.ok ? undefined : out.issues.find((x) => x.field === field);
    };
    expect(f(pull({ W: Number.NaN }), 'W')).toMatchObject({ code: 'number' });
    expect(f(pull({ W: 0 }), 'W')).toMatchObject({ code: 'range', minOpen: true });
    expect(f(pull({ theta: 61 }), 'theta')).toMatchObject({ code: 'range', min: -30, max: 60 });
    expect(f(pull({ theta: -31 }), 'theta')).toMatchObject({ code: 'range' });
    expect(f(pull({ muS: -0.1 }), 'muS')).toMatchObject({ code: 'range' });
    expect(f(pull({ muK: 6 }), 'muK')).toMatchObject({ code: 'range', max: 5 });
    expect(f(pull({ phi: 91 }), 'phi')).toMatchObject({ code: 'range', min: -90, max: 90 });
    expect(f(pull({ aOverG: 11 }), 'aOverG')).toMatchObject({ code: 'range' });
    expect(f(pull({ aOverG: Number.NaN }), 'aOverG')).toMatchObject({ code: 'number' });
    expect(f(pull({ travel: 'sideways' as never }), 'travel')).toMatchObject({ code: 'range' });
    expect(solvePull(pull({ muS: 0, muK: 0, phi: 0 })).ok).toBe(true);
  });
  it("'size': a tension past 1e30", () => {
    // Against the pull, μ = 1, θ = 60° (c > 0): den = cosφ − sinφ, made 1e-11 (just above the 1e-12 that counts as zero).
    const phi = 45 - 1e-11 / Math.SQRT2 / RAD;
    const big = solvePull(pull({ W: 1e29, theta: 60, muS: 1, muK: 1, phi, travel: 'against' }));
    expect(big.ok).toBe(false);
    if (!big.ok) expect(big.issues[0].code).toBe('size');
  });
  it("'kinetic-above-static' is a warning", () => {
    const s = run(pull({ muS: 0.3, muK: 0.5 }));
    expect(s.warnings).toEqual([{ code: 'kinetic-above-static', numbers: [0.3, 0.5] }]);
  });
});

/* ── Mode 3 ───────────────────────────────────────────────────────────── */

/** dT/dθ = μT by the classical Runge–Kutta, from the small end round the wrap. */
function integrate(Ts: number, mu: number, beta: number, steps = 4000): number {
  let T = Ts;
  const h = beta / steps;
  for (let i = 0; i < steps; i++) {
    const k1 = mu * T;
    const k2 = mu * (T + (h * k1) / 2);
    const k3 = mu * (T + (h * k2) / 2);
    const k4 = mu * (T + h * k3);
    T += (h * (k1 + 2 * k2 + 2 * k3 + k4)) / 6;
  }
  return T;
}

describe('mode 3 — a cable round a drum', () => {
  const drum = (o: Partial<Parameters<typeof solveDrum>[0]> = {}) => solveDrum({ Tbig: 1000, Tsmall: null, mu: 0.3, beta: 4 * Math.PI, ...o });
  const ok = (o: Parameters<typeof drum>[0] = {}) => {
    const out = drum(o);
    if (!out.ok) throw new Error(`not solved: ${JSON.stringify(out.issues)}`);
    return out;
  };

  it('the textbook: a load held by 2 turns round a post, μ = 0.3', () => {
    // e^(0.3·4π) = e^3.76991 = 43.3762; T_small = 1000 / 43.3762 = 23.0536
    const s = ok();
    expect(s.solved).toBe('Tsmall');
    expect(s.ratio).toBeCloseTo(Math.exp(0.3 * 4 * Math.PI), 12);
    expect(s.ratio).toBeCloseTo(43.376, 3);
    expect(s.Tsmall).toBeCloseTo(23.0541, 3);
    expect(s.exponent).toBeCloseTo(3.76991, 5);
  });
  it('half a turn at μ = 0.5 multiplies by e^(π/2) = 4.8105', () => {
    const s = ok({ Tbig: null, Tsmall: 100, mu: 0.5, beta: Math.PI });
    expect(s.solved).toBe('Tbig');
    expect(s.Tbig).toBeCloseTo(481.0477, 3);
  });
  it('solves each of the four unknowns and the round trip is exact', () => {
    const r = rng(31);
    for (let k = 0; k < 500; k++) {
      const Ts = between(r, 1, 1000);
      const mu = between(r, 0.02, 1.2);
      const beta = between(r, 0.1, 20);
      const Tb = Ts * Math.exp(mu * beta);
      const a = ok({ Tbig: null, Tsmall: Ts, mu, beta });
      expect(near(a.Tbig, Tb, 1e-13)).toBe(true);
      const b = ok({ Tbig: Tb, Tsmall: null, mu, beta });
      expect(near(b.Tsmall, Ts, 1e-13)).toBe(true);
      const c = ok({ Tbig: Tb, Tsmall: Ts, mu: null, beta });
      expect(near(c.mu, mu, 1e-12)).toBe(true);
      const d = ok({ Tbig: Tb, Tsmall: Ts, mu, beta: null });
      expect(near(d.beta, beta, 1e-12)).toBe(true);
      // Plug the solution back: the four satisfy the law.
      expect(near(c.Tbig, c.Tsmall * Math.exp(c.mu * c.beta), 1e-12)).toBe(true);
      expect(near(d.Tbig, d.Tsmall * Math.exp(d.mu * d.beta), 1e-12)).toBe(true);
      expect(near(a.ratio, Math.exp(mu * beta), 1e-13)).toBe(true);
    }
  });
  it('agrees with a numerical integration of dT/dθ = μT', () => {
    const r = rng(32);
    for (let k = 0; k < 40; k++) {
      const Ts = between(r, 5, 500);
      const mu = between(r, 0.05, 0.9);
      const beta = between(r, 0.5, 25);
      const s = ok({ Tbig: null, Tsmall: Ts, mu, beta });
      expect(near(s.Tbig, integrate(Ts, mu, beta), 1e-10)).toBe(true);
    }
  });
  it('the force on the drum: √(Tb² + Ts² − 2 Tb Ts cosβ)', () => {
    const half = ok({ Tbig: 500, Tsmall: 100, mu: null, beta: Math.PI });
    expect(half.resultant).toBeCloseTo(600, 9); // β = 180°: the tensions add
    const turn = ok({ Tbig: 500, Tsmall: 100, mu: null, beta: 2 * Math.PI });
    expect(turn.resultant).toBeCloseTo(400, 9); // a whole turn: they subtract
    const r = rng(33);
    for (let k = 0; k < 200; k++) {
      const Tb = between(r, 100, 900);
      const Ts = between(r, 10, Tb);
      const beta = between(r, 0.1, 12);
      const s = ok({ Tbig: Tb, Tsmall: Ts, mu: null, beta });
      expect(near(s.resultant, Math.sqrt(Tb * Tb + Ts * Ts - 2 * Tb * Ts * Math.cos(beta)), 1e-9, 1e-9)).toBe(true);
      expect(near(Math.hypot(s.resultantX, s.resultantY), s.resultant, 1e-12)).toBe(true);
    }
  });
  it('scaling: twice the big tension gives twice the small one and the resultant, the same ratio', () => {
    const a = ok();
    const b = ok({ Tbig: 2000 });
    expect(near(b.Tsmall, 2 * a.Tsmall, 1e-14)).toBe(true);
    expect(near(b.resultant, 2 * a.resultant, 1e-12)).toBe(true);
    expect(b.ratio).toBe(a.ratio);
  });
  it("warnings: 'no-friction' and 'no-wrap'", () => {
    expect(ok({ mu: 0 }).warnings).toEqual([{ code: 'no-friction' }]);
    expect(ok({ beta: 0 }).warnings).toEqual([{ code: 'no-wrap' }]);
    expect(ok({ mu: 0 }).Tsmall).toBe(1000);
    // A μ or a wrap that is FOUND can be past what the form accepts as an entry: it is flagged (A10).
    const mu = ok({ Tsmall: 500, mu: null, beta: 1e-5 });
    expect(mu.mu).toBeGreaterThan(100);
    expect(mu.warnings).toEqual([{ code: 'beyond-limit', field: 'mu', max: 100 }]);
    const beta = ok({ Tsmall: 999.0005, mu: 1e-6, beta: null });
    expect(beta.beta).toBeGreaterThan(200 * Math.PI);
    expect(beta.warnings).toEqual([{ code: 'beyond-limit', field: 'beta', max: 200 * Math.PI }]);
    expect(ok({ Tsmall: 500, mu: null, beta: 2 }).warnings).toEqual([]);
    // A pull equal to the load: μ = 0 is the only way, and any wrap gives it: degenerate for β.
  });
  it('every code', () => {
    const code = (o: Parameters<typeof drum>[0]) => {
      const out = drum(o);
      return out.ok ? [] : out.issues.map((i) => i.code);
    };
    expect(code({ Tbig: Number.NaN })).toEqual(['number']);
    expect(code({ Tbig: 0 })).toEqual(['range']);
    expect(code({ mu: -1 })).toEqual(['range']);
    expect(code({ beta: 1e6 })).toEqual(['range']);
    expect(code({ Tsmall: 5 })).toEqual(['overdetermined']);
    const under = drum({ Tsmall: null, mu: null });
    expect(under.ok).toBe(false);
    if (!under.ok) expect(under.issues[0]).toEqual({ code: 'underdetermined', count: 2 });
    expect(code({ Tbig: 100, Tsmall: 200, mu: null, beta: 3 })).toEqual(['order']);
    expect(code({ Tbig: 100, Tsmall: 200, mu: 0.3, beta: null })).toEqual(['order']);
    // μ with a zero wrap, and β with a zero friction: any value fits or none does.
    const deg = drum({ Tbig: 100, Tsmall: 100, mu: null, beta: 0 });
    expect(deg.ok).toBe(false);
    if (!deg.ok) expect(deg.issues[0]).toMatchObject({ code: 'degenerate', field: 'mu' });
    const deg2 = drum({ Tbig: 200, Tsmall: 100, mu: 0, beta: null });
    expect(deg2.ok).toBe(false);
    if (!deg2.ok) expect(deg2.issues[0]).toMatchObject({ code: 'degenerate', field: 'beta' });
    // Equal tensions with a wrap and friction left to find: μ = 0 / β = 0.
    expect(ok({ Tbig: 100, Tsmall: 100, mu: null, beta: 3 }).mu).toBe(0);
    expect(ok({ Tbig: 100, Tsmall: 100, mu: 0.4, beta: null }).beta).toBe(0);
    // e^(μβ) past a double: μ = 100, β = 100 turns.
    const over = drum({ Tbig: null, Tsmall: 1, mu: 100, beta: 200 * Math.PI });
    expect(over.ok).toBe(false);
    if (!over.ok) {
      expect(over.issues[0].code).toBe('overflow');
      expect(over.issues[0].numbers![0]).toBeGreaterThan(700);
    }
    // The ratio is huge but still a number: the small tension underflows to nothing → overflow.
    expect(code({ Tbig: 1000, Tsmall: null, mu: 2, beta: 600 })).toEqual(['overflow']);
  });
});

/* ── Never throws, never NaN ───────────────────────────────────────────── */

describe('the engine never throws and never returns NaN or Infinity', () => {
  const junk = [Number.NaN, Infinity, -Infinity, 0, -0, 1, -1, 1e30, 1e31, 1e-300, 'x', null, undefined, {}, [], true];
  it('on garbage inputs', () => {
    const r = rng(41);
    const j = () => pickOf(r, junk) as number;
    for (let k = 0; k < 3000; k++) {
      const sec = () => ({ A: j(), E: j(), alpha: j(), mbf: j(), factor: j() }) as CableSection;
      const results = [
        solveLoad({ W: j(), H: j(), dT: j(), n: j(), allowable: j(), legs: [{ angle: j(), side: 'left', length: j(), section: sec() }, { angle: j(), side: 'right', length: j(), section: sec() }] }),
        solveLoad({ W: j(), H: j(), legs: [{ angle: 60, side: 'left', length: 100, section: sec() }] }),
        solveLoad(j() as unknown as LoadInput),
        solvePull({ W: j(), theta: j(), muS: j(), muK: j(), phi: j(), aOverG: j(), travel: pickOf(r, ['along', 'against', j()]) } as PullInput),
        solvePull(j() as unknown as PullInput),
        solveDrum({ Tbig: j(), Tsmall: j(), mu: j(), beta: j() }),
        solveDrum(j() as unknown as Parameters<typeof solveDrum>[0]),
      ];
      results.forEach((out, i) => expect(numbersIn(out).filter((v) => !Number.isFinite(v)), `result ${i}: ${JSON.stringify(out)}`).toEqual([]));
    }
  });
  it('on extreme valid inputs (huge, tiny, nearly degenerate)', () => {
    const r = rng(42);
    for (let k = 0; k < 3000; k++) {
      const e = () => 10 ** between(r, -12, 29);
      const sec: CableSection = { A: e(), E: e(), alpha: r() < 0.5 ? 0 : 10 ** between(r, -9, -3) };
      const loads = solveLoad({ W: e(), H: (r() < 0.5 ? -1 : 1) * e(), dT: between(r, -1e4, 1e4), legs: [{ angle: between(r, 0, 90), side: pickOf(r, ['left', 'right'] as const), length: e(), section: sec }, { angle: pickOf(r, [0, 90, between(r, 0, 90)]), side: pickOf(r, ['left', 'right'] as const), length: e(), section: sec }] });
      const pulls = solvePull({ W: e(), theta: between(r, -30, 60), muS: between(r, 0, 5), muK: between(r, 0, 5), phi: pickOf(r, [-90, 90, 0, between(r, -90, 90)]), aOverG: pickOf(r, [null, between(r, -10, 10)]), travel: pickOf(r, ['along', 'against'] as const) });
      const drums = solveDrum({ Tbig: pickOf(r, [null, e()]), Tsmall: pickOf(r, [null, e()]), mu: pickOf(r, [null, between(r, 0, 100)]), beta: pickOf(r, [null, between(r, 0, 200 * Math.PI)]) });
      for (const out of [loads, pulls, drums]) for (const v of numbersIn(out)) expect(Number.isFinite(v)).toBe(true);
    }
  });
});
