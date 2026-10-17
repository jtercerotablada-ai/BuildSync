import { afterEach, describe, expect, it, vi } from 'vitest';
import { curveOf, shapeAt, solveHanging, solveKnown } from './engine';
import { aForLevelSag, aForSagMid, between, catenaryLevel, catenaryOn, logBetween, parabolaClosed, rng, solveShot } from './oracle.testlib';
import { PARABOLA_TOLERANCE, type CableShape, type HangingInput, type HangingSolution, type Known, type Setup } from './types';

// Heavy by design (hundreds of generated cables, each through nested bracketed solves and an RK4 oracle).
vi.setConfig({ testTimeout: 120_000 });
// A turn of the event loop between two tests lets the runner hear from this worker (truss/engine.test.ts does the same).
afterEach(() => new Promise<void>((resolve) => setTimeout(resolve, 0)));

/**
 * THE HANGING CABLE, against what is known.
 *
 * Evidence that shares no code with the engine (oracle.testlib.ts):
 *   — the closed forms of the LEVEL PARABOLA (H = qL²/8d, T = √(H² + (qL/2)²), the length by its
 *     arcsinh formula) and of the LEVEL CATENARY (a(cosh − 1), 2a·sinh);
 *   — the INCLINED catenary by its two boundary conditions solved directly (vertex abscissa by bisection);
 *   — RK4 SHOOTING of the physical equations along the unstretched length, rigid and elastic, with q and
 *     w together, Newton in (V0, Lu): the engine's exact combined shape has no closed form to compare to;
 *   — PROPERTIES: the vertical load carried equals q·L + w·(unstretched length); scaling; the elastic
 *     length lies between s/(1 + Tmax/EA) and s/(1 + Tmin/EA); known → solve → known round trips;
 *   — LIMITS: a sag/span from 1e-6 to 100, rises up to 50 spans.
 */

const hang = (i: HangingInput): HangingSolution => {
  const out = solveHanging(i);
  if (!out.ok) throw new Error(`not solved: ${JSON.stringify(i)} ${JSON.stringify(out.issues)}`);
  return out;
};
const near = (got: number, want: number, tol = 1e-9, scale = Math.max(Math.abs(want), 1e-300)) => {
  expect(Math.abs(got - want), `got ${got}, want ${want}`).toBeLessThanOrEqual(tol * scale);
};
const setup = (L: number, h: number, q: number, w: number, EA: number | null = null): Setup => ({ L, h, q, w, EA });

describe('the level parabola (q only) in closed form', () => {
  it('H = qL²/8d, T = √(H² + (qL/2)²), the length by the arcsinh formula, the reactions qL/2', () => {
    const r = rng(1);
    for (let n = 0; n < 250; n++) {
      const L = logBetween(r, 5, 2000);
      const ratio = logBetween(r, 1e-5, 5);
      const q = logBetween(r, 1e-3, 50);
      const d = ratio * L;
      const s = hang({ L, h: 0, q, w: 0, EA: null, known: { kind: 'sag-mid', value: d } });
      const H = (q * L * L) / (8 * d);
      near(s.exact.H, H, 1e-10);
      near(s.exact.tension.max, Math.hypot(H, (q * L) / 2), 1e-10);
      near(s.exact.reaction.A, (q * L) / 2, 1e-9);
      near(s.exact.reaction.B, (q * L) / 2, 1e-9);
      near(s.exact.sagMid, d, 1e-10);
      near(s.exact.sagLow, d, 1e-9);
      near(s.exact.vertex.x, L / 2, 1e-9);
      near(s.exact.angle.A, (Math.atan((q * L) / (2 * H)) * 180) / Math.PI, 1e-10);
      near(s.exact.length, parabolaClosed(q, L, 0, H).length, 1e-10);
      expect(s.family).toBe('parabola');
      expect(s.difference).toBeNull();
      expect(s.exact.unstretched).toBe(s.exact.length);
      expect(s.exact.strain).toBeNull();
    }
  });

  it('the textbook length series: L(1 + 8/3 (d/L)² − 32/5 (d/L)⁴ + …)', () => {
    const s = hang({ L: 100, h: 0, q: 0.1, w: 0, EA: null, known: { kind: 'sag-mid', value: 5 } });
    const r = 0.05;
    const series = 100 * (1 + (8 / 3) * r ** 2 - (32 / 5) * r ** 4 + (256 / 7) * r ** 6);
    near(s.exact.length, series, 5e-8);
  });

  it('inclined: the sag between the chord and the cable is qL²/8H whatever the rise; closed forms for the slopes and the length', () => {
    const r = rng(2);
    for (let n = 0; n < 200; n++) {
      const L = logBetween(r, 5, 500);
      const h = between(r, -3, 3) * L;
      const q = logBetween(r, 1e-2, 20);
      const H = q * L * logBetween(r, 0.1, 500);
      const o = parabolaClosed(q, L, h, H);
      const s = hang({ L, h, q, w: 0, EA: null, known: { kind: 'H', value: H } });
      near(s.exact.sagMid, o.sagMid, 1e-10);
      near(s.exact.slope.A, o.slopeA, 1e-10, Math.max(1, Math.abs(o.slopeA)));
      near(s.exact.slope.B, o.slopeB, 1e-10, Math.max(1, Math.abs(o.slopeB)));
      near(s.exact.tension.A, o.TA, 1e-10);
      near(s.exact.tension.B, o.TB, 1e-10);
      near(s.exact.length, o.length, 1e-9);
      expect(s.exact.vertex.inside).toBe(o.slopeA < 0 && o.slopeB > 0);
      near(s.exact.vertex.x, o.x0, 1e-8, L);
    }
  });

  it('the parabola by its lowest point: H = qL² / (2(√d + √(d + h))²) for the sag below the lower support', () => {
    const r = rng(3);
    for (let n = 0; n < 150; n++) {
      const L = logBetween(r, 5, 500);
      const h = between(r, 0.01, 2) * L * (r() < 0.5 ? 1 : -1);
      const q = logBetween(r, 1e-2, 20);
      const d = logBetween(r, 1e-3, 2) * L;
      const s = hang({ L, h, q, w: 0, EA: null, known: { kind: 'sag-low', value: d } });
      const H = (q * L * L) / (2 * (Math.sqrt(d) + Math.sqrt(d + Math.abs(h))) ** 2);
      near(s.exact.H, H, 1e-9);
      near(s.exact.sagLow, d, 1e-9);
      expect(s.exact.vertex.inside).toBe(true);
    }
  });
});

describe('the catenary (w only) in closed form', () => {
  it('level: H = w·a with d = a(cosh(L/2a) − 1); length 2a·sinh(L/2a); T = w·a·cosh(L/2a); reaction a·w·sinh(L/2a)', () => {
    const r = rng(4);
    for (let n = 0; n < 250; n++) {
      const L = logBetween(r, 5, 2000);
      const ratio = logBetween(r, 1e-5, 20);
      const w = logBetween(r, 1e-3, 50);
      const d = ratio * L;
      const a = aForLevelSag(L, d);
      const c = catenaryLevel(w, L, a);
      const s = hang({ L, h: 0, q: 0, w, EA: null, known: { kind: 'sag-mid', value: d } });
      near(s.exact.H, c.H, 1e-9);
      near(s.exact.length, c.length, 1e-9);
      near(s.exact.tension.max, c.T, 1e-9);
      near(s.exact.reaction.A, c.V, 1e-8);
      near(s.exact.sagLow, d, 1e-8);
      expect(s.family).toBe('catenary');
    }
  });

  it('inclined: the two boundary conditions solved directly (vertex position by bisection) give the same cable', () => {
    const r = rng(5);
    for (let n = 0; n < 250; n++) {
      const L = logBetween(r, 5, 500);
      const h = between(r, -8, 8) * L * (r() < 0.15 ? 0 : 1);
      const w = logBetween(r, 1e-2, 20);
      const d = logBetween(r, 1e-3, 5) * L;
      const a = aForSagMid(w, L, h, d);
      const o = catenaryOn(w, L, h, a);
      const s = hang({ L, h, q: 0, w, EA: null, known: { kind: 'sag-mid', value: d } });
      near(s.exact.H, o.H, 1e-9);
      near(s.exact.tension.A, o.TA, 1e-9);
      near(s.exact.tension.B, o.TB, 1e-9);
      near(s.exact.length, o.length, 1e-9);
      near(s.exact.sagLow, o.sagLow, 1e-7, L);
      expect(s.exact.vertex.inside).toBe(o.inside);
      near(s.exact.slope.A, o.slopeA, 1e-8, Math.max(1, Math.abs(o.slopeA)));
      near(s.exact.slope.B, o.slopeB, 1e-8, Math.max(1, Math.abs(o.slopeB)));
    }
  });
});

describe('very taut inclined catenaries (the oracle is the less precise here, so its tolerance is stated)', () => {
  it('the closed-form oracle locates the vertex only as well as h/(L·ratio²)·1e-16; the engine agrees within that, and reproduces the sag it was given to 1e-12', () => {
    const r = rng(55);
    for (let n = 0; n < 150; n++) {
      const L = logBetween(r, 5, 500);
      const h = between(r, -8, 8) * L;
      const w = logBetween(r, 1e-2, 20);
      const ratio = logBetween(r, 1e-5, 1e-3);
      const d = ratio * L;
      const s = hang({ L, h, q: 0, w, EA: null, known: { kind: 'sag-mid', value: d } });
      near(s.exact.sagMid, d, 1e-11);
      const kappa = Math.max(1, Math.abs(h) / L) / ratio ** 2;
      const tol = 1e-9 + 2e-15 * kappa;
      const o = catenaryOn(w, L, h, aForSagMid(w, L, h, d));
      near(s.exact.H, o.H, tol);
      near(s.exact.length, o.length, 1e-9);
    }
  });
});

describe('the exact cable against RK4 shooting of the physical equations (no code shared)', () => {
  it('rigid and elastic, q alone, w alone and both, inclined or level, given H', () => {
    const r = rng(6);
    let checked = 0;
    for (let n = 0; n < 60; n++) {
      const L = logBetween(r, 20, 500);
      const h = between(r, -1.5, 1.5) * L * (r() < 0.2 ? 0 : 1);
      const kind = n % 3;
      const q = kind === 1 ? 0 : logBetween(r, 1e-2, 5);
      const w = kind === 0 ? 0 : logBetween(r, 1e-2, 5);
      const H = (q + w) * L * logBetween(r, 0.3, 40);
      const elastic = n % 2 === 0;
      const EA = elastic ? H * logBetween(r, 30, 5000) : null;
      const s = hang({ L, h, q, w, EA, known: { kind: 'H', value: H } }).exact;
      const shot = solveShot(H, q, w, EA ?? Number.POSITIVE_INFINITY, L, h, H * s.slope.A * 1.05 + 1e-3 * H, s.unstretched * 1.03, 2500);
      expect(shot, `shooting did not converge for ${JSON.stringify({ L, h, q, w, EA, H })}`).not.toBeNull();
      if (!shot) continue;
      near(shot.pA, s.slope.A, 1e-8, Math.max(1, Math.abs(s.slope.A)));
      near(shot.pB, s.slope.B, 1e-8, Math.max(1, Math.abs(s.slope.B)));
      near(shot.Lu, s.unstretched, 1e-8);
      near(shot.s, s.length, 1e-8);
      near(shot.sagMid, s.sagMid, 1e-6, Math.max(s.sagMid, 1e-3 * L));
      checked++;
    }
    expect(checked).toBe(60);
  });
});

describe("the engine's equations, integrated again by Simpson's rule (a different quadrature of the same physics)", () => {
  /** Simpson's rule with n panels (n even) of f over [a, b]. */
  const simpson = (f: (u: number) => number, a: number, b: number, n = 100_000): number => {
    const h = (b - a) / n;
    let s = f(a) + f(b);
    for (let i = 1; i < n; i++) s += f(a + i * h) * (i % 2 === 0 ? 2 : 4);
    return (s * h) / 3;
  };

  it('the run L = H∫dp/λ, the rise h = H∫p dp/λ, the stretched length and the unstretched one, with q, w and EA together', () => {
    const r = rng(18);
    for (let n = 0; n < 40; n++) {
      const L = logBetween(r, 20, 500);
      const h = between(r, -1.5, 1.5) * L * (r() < 0.2 ? 0 : 1);
      const q = n % 3 === 1 ? 0 : logBetween(r, 1e-2, 5);
      const w = n % 3 === 0 ? 0 : logBetween(r, 1e-2, 5);
      const H = (q + w) * L * logBetween(r, 0.05, 40);
      const EA = n % 2 === 0 ? H * logBetween(r, 30, 5000) : null;
      const s = hang({ L, h, q, w, EA, known: { kind: 'H', value: H } }).exact;
      const e = EA === null ? 0 : H / EA;
      // λ(p) = q + w·r/(1 + e·r); in u = asinh p:  dp = cosh u du
      const lambda = (p: number) => q + (w * Math.hypot(1, p)) / (1 + e * Math.hypot(1, p));
      const uA = Math.asinh(s.slope.A);
      const uB = Math.asinh(s.slope.B);
      const integral = (g: (p: number) => number) => simpson((u) => g(Math.sinh(u)) * Math.cosh(u), uA, uB, 20_000);
      near(H * integral((p) => 1 / lambda(p)), L, 1e-11);
      near(H * integral((p) => p / lambda(p)), h, 1e-10, Math.max(Math.abs(h), 1e-3 * L));
      near(H * integral((p) => Math.hypot(1, p) / lambda(p)), s.length, 1e-11);
      near(H * integral((p) => Math.hypot(1, p) / (lambda(p) * (1 + e * Math.hypot(1, p)))), s.unstretched, 1e-11);
    }
  });
});

describe('properties that hold of every cable', () => {
  const cases = (n: number, seed: number) => {
    const r = rng(seed);
    return Array.from({ length: n }, () => {
      const L = logBetween(r, 10, 800);
      const h = between(r, -2, 2) * L * (r() < 0.3 ? 0 : 1);
      const kind = Math.floor(r() * 3);
      const q = kind === 1 ? 0 : logBetween(r, 1e-2, 10);
      const w = kind === 0 ? 0 : logBetween(r, 1e-2, 10);
      const H = (q + w) * L * logBetween(r, 0.2, 60);
      const EA = r() < 0.5 ? H * logBetween(r, 50, 5000) : null;
      return { L, h, q, w, EA, H };
    });
  };

  it('the vertical reactions carry exactly q·L + w·(unstretched length)', () => {
    for (const c of cases(200, 7)) {
      const s = hang({ ...c, known: { kind: 'H', value: c.H } }).exact;
      near(s.reaction.A + s.reaction.B, c.q * c.L + c.w * s.unstretched, 1e-10, Math.max(c.q * c.L + c.w * s.unstretched, 1e-12));
      near(s.load, s.reaction.A + s.reaction.B, 1e-12, Math.max(s.load, 1e-12));
    }
  });

  it('tension at each support = H·√(1 + slope²) = √(H² + reaction²), and the angles are the slopes', () => {
    for (const c of cases(200, 8)) {
      const s = hang({ ...c, known: { kind: 'H', value: c.H } }).exact;
      near(s.tension.A, Math.hypot(c.H, s.reaction.A), 1e-12);
      near(s.tension.B, Math.hypot(c.H, s.reaction.B), 1e-12);
      near(Math.tan((s.angle.A * Math.PI) / 180), -s.slope.A, 1e-9, Math.max(1, Math.abs(s.slope.A)));
      near(Math.tan((s.angle.B * Math.PI) / 180), s.slope.B, 1e-9, Math.max(1, Math.abs(s.slope.B)));
      expect(s.tension.max).toBe(Math.max(s.tension.A, s.tension.B));
      expect(s.tension.high).toBe(c.h >= 0 ? s.tension.B : s.tension.A);
      expect(s.tension.low).toBe(c.h >= 0 ? s.tension.A : s.tension.B);
      // the chord's slope lies between the support slopes (the cable is convex)
      expect(s.slope.A).toBeLessThan(c.h / c.L + 1e-12);
      expect(s.slope.B).toBeGreaterThan(c.h / c.L - 1e-12);
    }
  });

  it('the length is longer than the chord, the unstretched one shorter than the stretched one, and between the bounds s/(1 + Tmax/EA) and s/(1 + Tmin/EA)', () => {
    for (const c of cases(200, 9)) {
      const s = hang({ ...c, known: { kind: 'H', value: c.H } }).exact;
      expect(s.length).toBeGreaterThan(Math.hypot(c.L, c.h));
      if (c.EA === null) {
        expect(s.unstretched).toBe(s.length);
        expect(s.elongation).toBe(0);
      } else {
        expect(s.unstretched).toBeLessThan(s.length);
        expect(s.unstretched).toBeGreaterThanOrEqual((s.length / (1 + s.tension.max / c.EA)) * (1 - 1e-12));
        expect(s.unstretched).toBeLessThanOrEqual((s.length / (1 + s.tension.min / c.EA)) * (1 + 1e-12));
        near(s.elongation, s.length - s.unstretched, 1e-12);
        near(s.strain ?? 0, s.tension.max / c.EA, 1e-14);
      }
    }
  });

  it('scaling: doubling every load and EA doubles every force and leaves the geometry alone (H known doubled, sag known unchanged)', () => {
    for (const c of cases(120, 10)) {
      const base = hang({ ...c, known: { kind: 'H', value: c.H } }).exact;
      const d = base.sagMid;
      for (const k of [2, 0.37, 10]) {
        const scaled = hang({ L: c.L, h: c.h, q: k * c.q, w: k * c.w, EA: c.EA === null ? null : k * c.EA, known: { kind: 'sag-mid', value: d } }).exact;
        near(scaled.H, k * base.H, 1e-9);
        near(scaled.tension.max, k * base.tension.max, 1e-9);
        near(scaled.reaction.A, k * base.reaction.A, 1e-8, Math.max(Math.abs(k * base.reaction.A), 1e-9 * base.tension.max));
        near(scaled.length, base.length, 1e-9);
        near(scaled.slope.B, base.slope.B, 1e-8, Math.max(1, Math.abs(base.slope.B)));
        near(scaled.strain ?? 0, base.strain ?? 0, 1e-9, Math.max(base.strain ?? 0, 1e-300));
      }
    }
  });

  it('scaling the geometry: a cable twice as long in every length, with the same loads per length, has the same shape and twice the H', () => {
    for (const c of cases(80, 11)) {
      const base = hang({ ...c, known: { kind: 'H', value: c.H } }).exact;
      const big = hang({ L: 2 * c.L, h: 2 * c.h, q: c.q, w: c.w, EA: c.EA === null ? null : 2 * c.EA, known: { kind: 'H', value: 2 * c.H } }).exact;
      near(big.sagMid, 2 * base.sagMid, 1e-9);
      near(big.length, 2 * base.length, 1e-9);
      near(big.slope.A, base.slope.A, 1e-8, Math.max(1, Math.abs(base.slope.A)));
    }
  });

  it('a cable with more tension sags less and is shorter (monotone in H)', () => {
    for (const c of cases(80, 12)) {
      const a = hang({ ...c, known: { kind: 'H', value: c.H } }).exact;
      const b = hang({ ...c, known: { kind: 'H', value: c.H * 1.1 } }).exact;
      expect(b.sagMid).toBeLessThan(a.sagMid);
      expect(b.unstretched).toBeLessThan(a.unstretched);
    }
  });

  it('the cable sags below its chord: the curve starts at A, ends at B and lies on or below the chord', () => {
    for (const c of cases(60, 13)) {
      const s = hang({ ...c, known: { kind: 'H', value: c.H } }).exact;
      const pts = curveOf(s, 48);
      expect(pts[0]).toEqual({ x: 0, z: 0 });
      expect(pts[pts.length - 1]).toEqual({ x: c.L, z: c.h });
      for (let i = 1; i < pts.length; i++) {
        expect(pts[i].x).toBeGreaterThan(pts[i - 1].x);
        const chordZ = (c.h / c.L) * pts[i].x;
        expect(pts[i].z).toBeLessThanOrEqual(chordZ + 1e-9 * (c.L + Math.abs(c.h)));
      }
      // the mid-span sag is the chord minus the curve at x = L/2: interpolate the two samples around it
      const k = pts.findIndex((p) => p.x >= c.L / 2);
      const a = pts[k - 1];
      const b = pts[k];
      const t = (c.L / 2 - a.x) / (b.x - a.x);
      const zMid = a.z + t * (b.z - a.z);
      near(c.h / 2 - zMid, s.sagMid, 5e-3, Math.max(s.sagMid, 1e-9 * c.L));
    }
  });

  it('a pure parabola passes through the points of its closed form', () => {
    const q = 0.12;
    const L = 80;
    const h = 14;
    const H = 20;
    const s = hang({ L, h, q, w: 0, EA: null, known: { kind: 'H', value: H } }).exact;
    for (const p of curveOf(s, 40)) near(p.z, (h / L) * p.x - (q * p.x * (L - p.x)) / (2 * H), 1e-10, 10);
  });
});

describe('the parabolic approximation next to the exact cable', () => {
  const level = (ratio: number) => hang({ L: 100, h: 0, q: 0, w: 1, EA: null, known: { kind: 'sag-mid', value: 100 * ratio } });

  it('is the same cable when only q acts (no difference, not flagged)', () => {
    const s = hang({ L: 100, h: 10, q: 0.4, w: 0, EA: null, known: { kind: 'sag-mid', value: 8 } });
    expect(s.parabolic).toEqual(s.exact);
    expect(s.difference).toBeNull();
    expect(s.warnings.map((w) => w.code)).toEqual([]);
  });

  it('converges to the catenary as the sag/span goes to 0, as (sag/span)²: worst ≈ 4/3·(d/L)²', () => {
    const worst = (r: number) => level(r).difference!.worst;
    for (const r of [0.1, 0.05, 0.02, 0.01]) {
      const ratio = worst(r) / r ** 2;
      expect(ratio, `d/L = ${r}`).toBeGreaterThan(1.2);
      expect(ratio).toBeLessThan(1.6);
    }
    expect(worst(1e-3)).toBeLessThan(2e-6);
    expect(worst(1e-4)).toBeLessThan(2e-8);
    // halving the ratio quarters the difference
    near(worst(0.005) / worst(0.01), 0.25, 0.02);
  });

  it('the 1 % tolerance is crossed near a sag/span of 0.085 for a level cable under its own weight', () => {
    let lo = 0.01;
    let hi = 0.3;
    for (let i = 0; i < 50; i++) {
      const mid = 0.5 * (lo + hi);
      if (level(mid).difference!.worst > PARABOLA_TOLERANCE) hi = mid;
      else lo = mid;
    }
    expect(lo).toBeGreaterThan(0.075);
    expect(lo).toBeLessThan(0.095);
    expect(level(0.05).warnings.map((w) => w.code)).not.toContain('parabola-differs');
    const w = level(0.12).warnings.find((x) => x.code === 'parabola-differs');
    expect(w).toBeDefined();
    expect(w?.tolerance).toBe(PARABOLA_TOLERANCE);
    expect(w?.difference).toBeGreaterThan(PARABOLA_TOLERANCE);
    near(w?.ratio ?? 0, 0.12, 1e-9);
  });

  it('the parabola underestimates H, T and the length of a sagging catenary (it is the shallower curve for the same sag)', () => {
    for (const r of [0.02, 0.1, 0.3, 1]) {
      const d = level(r).difference!;
      expect(d.H).toBeLessThan(0);
      expect(d.tension).toBeLessThan(0);
      expect(d.length).toBeLessThan(0);
      expect(Math.abs(d.sagMid)).toBeLessThan(1e-9);
    }
  });

  it('with both loads, the exact cable lies between the pure parabola and the pure catenary of the same total, and "combined" is reported', () => {
    const q = 0.5;
    const w = 0.5;
    const both = hang({ L: 100, h: 0, q, w, EA: null, known: { kind: 'sag-mid', value: 15 } });
    expect(both.family).toBe('combined');
    const onlyQ = hang({ L: 100, h: 0, q: q + w, w: 0, EA: null, known: { kind: 'sag-mid', value: 15 } });
    const onlyW = hang({ L: 100, h: 0, q: 0, w: q + w, EA: null, known: { kind: 'sag-mid', value: 15 } });
    expect(both.exact.H).toBeGreaterThan(onlyQ.exact.H);
    expect(both.exact.H).toBeLessThan(onlyW.exact.H);
    // its parabolic approximation is exactly that parabola
    near(both.parabolic!.H, onlyQ.exact.H, 1e-12);
  });

  it('as the weight goes to 0 the combined cable goes to the parabola, as the load goes to 0 it goes to the catenary', () => {
    const q = 1;
    const pure = hang({ L: 100, h: 20, q, w: 0, EA: null, known: { kind: 'sag-mid', value: 12 } }).exact;
    let previous = Number.POSITIVE_INFINITY;
    for (const w of [1e-2, 1e-4, 1e-6, 1e-8]) {
      const e = Math.abs(hang({ L: 100, h: 20, q, w, EA: null, known: { kind: 'sag-mid', value: 12 } }).exact.H / pure.H - 1);
      expect(e).toBeLessThan(previous);
      previous = e;
    }
    expect(previous).toBeLessThan(1e-6);
    const catenary = hang({ L: 100, h: 20, q: 0, w: 1, EA: null, known: { kind: 'sag-mid', value: 12 } }).exact;
    near(hang({ L: 100, h: 20, q: 1e-9, w: 1, EA: null, known: { kind: 'sag-mid', value: 12 } }).exact.H, catenary.H, 1e-7);
  });
});

describe('known → solve → re-solve round trips', () => {
  it('sag-mid → H → sag-mid, and the same cable from H', () => {
    const r = rng(14);
    for (let n = 0; n < 150; n++) {
      const L = logBetween(r, 10, 600);
      const h = between(r, -2, 2) * L * (r() < 0.3 ? 0 : 1);
      const q = r() < 0.4 ? 0 : logBetween(r, 1e-2, 10);
      const w = q === 0 || r() < 0.5 ? logBetween(r, 1e-2, 10) : 0;
      const EA = r() < 0.5 ? (q + w) * L * logBetween(r, 100, 1e5) : null;
      const d = logBetween(r, 1e-4, 2) * L;
      const a = hang({ L, h, q, w, EA, known: { kind: 'sag-mid', value: d } });
      near(a.exact.sagMid, d, 1e-10);
      const b = hang({ L, h, q, w, EA, known: { kind: 'H', value: a.exact.H } });
      near(b.exact.sagMid, d, 1e-9);
      near(b.exact.length, a.exact.length, 1e-10);
    }
  });

  it('length → sag → length, for both a rigid cable and an elastic one', () => {
    const r = rng(15);
    for (let n = 0; n < 150; n++) {
      const L = logBetween(r, 10, 600);
      const h = between(r, -2, 2) * L * (r() < 0.3 ? 0 : 1);
      const q = r() < 0.4 ? 0 : logBetween(r, 1e-2, 10);
      const w = q === 0 || r() < 0.5 ? logBetween(r, 1e-2, 10) : 0;
      const EA = r() < 0.5 ? (q + w) * L * logBetween(r, 100, 1e5) : null;
      const d = logBetween(r, 1e-3, 1.5) * L;
      const a = hang({ L, h, q, w, EA, known: { kind: 'sag-mid', value: d } });
      const b = hang({ L, h, q, w, EA, known: { kind: 'length', value: a.exact.unstretched } });
      // The sag of a flat cable depends on the SQUARE ROOT of its excess length: the figure is amplified by 1/(8/3·(d/L)²).
      near(b.exact.sagMid, d, 1e-9 + 1e-13 / (d / L) ** 2);
      near(b.exact.H, a.exact.H, 1e-9 + 1e-13 / (d / L) ** 2);
      const c = hang({ L, h, q, w, EA, known: { kind: 'sag-mid', value: b.exact.sagMid } });
      near(c.exact.unstretched, a.exact.unstretched, 1e-9);
    }
  });

  it('sag-low → H → sag-low, and the two sags agree on a level span', () => {
    const r = rng(16);
    for (let n = 0; n < 120; n++) {
      const L = logBetween(r, 10, 600);
      const h = between(r, -1.5, 1.5) * L * (r() < 0.2 ? 0 : 1);
      const q = r() < 0.4 ? 0 : logBetween(r, 1e-2, 10);
      const w = q === 0 || r() < 0.5 ? logBetween(r, 1e-2, 10) : 0;
      const d = logBetween(r, 1e-3, 1.5) * L;
      const a = hang({ L, h, q, w, EA: null, known: { kind: 'sag-low', value: d } });
      near(a.exact.sagLow, d, 1e-9);
      const b = hang({ L, h, q, w, EA: null, known: { kind: 'H', value: a.exact.H } });
      near(b.exact.sagLow, d, 1e-8);
      if (h === 0) near(a.exact.sagMid, a.exact.sagLow, 1e-9);
      else expect(a.exact.sagMid).not.toBeCloseTo(a.exact.sagLow, 6);
    }
  });

  it('T-high / T-low → cable → T: the returned cable has the tension asked, and the other root (if any) too', () => {
    const r = rng(17);
    let withAlternative = 0;
    for (let n = 0; n < 150; n++) {
      const L = logBetween(r, 10, 600);
      const h = between(r, -1.5, 1.5) * L * (r() < 0.25 ? 0 : 1);
      const q = r() < 0.3 ? 0 : logBetween(r, 1e-2, 10);
      const w = q === 0 || r() < 0.6 ? logBetween(r, 1e-2, 10) : 0;
      const EA = r() < 0.5 ? (q + w) * L * logBetween(r, 100, 1e5) : null;
      const H = (q + w) * L * logBetween(r, 0.3, 80);
      const from = hang({ L, h, q, w, EA, known: { kind: 'H', value: H } }).exact;
      for (const kind of ['T-high', 'T-low'] as const) {
        const target = kind === 'T-high' ? from.tension.high : from.tension.low;
        const s = hang({ L, h, q, w, EA, known: { kind, value: target } });
        near(kind === 'T-high' ? s.exact.tension.high : s.exact.tension.low, target, 1e-9);
        // either the cable we started from (it was the taut one) or it is the slack alternative
        const matches = Math.abs(s.exact.H / from.H - 1) < 1e-6 || (s.alternative !== null && Math.abs(s.alternative.H / from.H - 1) < 1e-6);
        expect(matches, `${kind} ${JSON.stringify({ L, h, q, w, H })}`).toBe(true);
        if (s.alternative) {
          withAlternative++;
          expect(s.alternative.H).toBeLessThan(s.exact.H);
          expect(s.alternative.sagMid).toBeGreaterThan(s.exact.sagMid);
          const other = hang({ L, h, q, w, EA, known: { kind: 'H', value: s.alternative.H } }).exact;
          near(kind === 'T-high' ? other.tension.high : other.tension.low, target, 1e-8);
          expect(s.warnings.map((x) => x.code)).toContain('tension-two-roots');
        }
      }
    }
    expect(withAlternative).toBeGreaterThan(10);
  });
});

describe('the extremes', () => {
  const ratios = [1e-6, 1e-5, 1e-3, 0.05, 0.3, 1, 5, 20, 100];
  const rises = [0, 0.3, 3, 20, 50, -2, -40];

  it('every sag/span from 1e-6 to 100 on every rise from level to 50 spans solves, reproduces its sag and balances', () => {
    for (const family of ['parabola', 'catenary', 'combined'] as const) {
      const q = family === 'catenary' ? 0 : 0.7;
      const w = family === 'parabola' ? 0 : 0.4;
      for (const ratio of ratios) {
        for (const c of rises) {
          const L = 100;
          const out = solveHanging({ L, h: c * L, q, w, EA: null, known: { kind: 'sag-mid', value: ratio * L } });
          expect(out.ok, `${family} d/L=${ratio} h/L=${c} ${JSON.stringify(out)}`).toBe(true);
          if (!out.ok) continue;
          const s = out.exact;
          near(s.sagMid, ratio * L, 1e-7, ratio * L);
          near(s.reaction.A + s.reaction.B, q * L + w * s.length, 1e-8);
          for (const v of [s.H, s.tension.max, s.length, s.sagLow, s.vertex.x]) expect(Number.isFinite(v)).toBe(true);
          const kappa = Math.max(1, Math.abs(c)) / ratio ** 2;
          if (family === 'catenary' && 2e-15 * kappa < 1e-6) {
            const o = catenaryOn(w, L, c * L, aForSagMid(w, L, c * L, ratio * L));
            near(s.H, o.H, 1e-8 + 2e-15 * kappa);
            near(s.length, o.length, 1e-8);
          }
          if (family === 'parabola') {
            const o = parabolaClosed(q, L, c * L, (q * L * L) / (8 * ratio * L));
            near(s.length, o.length, 1e-8);
            near(s.tension.max, Math.max(o.TA, o.TB), 1e-9);
          }
        }
      }
    }
  });

  it('a very taut cable (sag/span 1e-6) on a very steep span keeps its figures', () => {
    const q = 1;
    const L = 100;
    const s = hang({ L, h: 3000, q, w: 0, EA: null, known: { kind: 'sag-mid', value: 1e-4 } }).exact;
    near(s.H, (q * L * L) / (8 * 1e-4), 1e-9);
    near(s.sagMid, 1e-4, 1e-8);
  });

  it('lowest-point sag works from tiny to deep', () => {
    for (const d of [1e-4, 1, 100, 5000]) {
      const s = hang({ L: 100, h: 30, q: 0, w: 1, EA: null, known: { kind: 'sag-low', value: d } }).exact;
      near(s.sagLow, d, 1e-8);
    }
  });

  it('is fast: a hundred combined elastic solves from a sag take well under the test timeout', () => {
    const t = performance.now();
    for (let i = 0; i < 100; i++) hang({ L: 100 + i, h: 20, q: 0.3, w: 0.2, EA: 5000, known: { kind: 'sag-mid', value: 3 + i / 10 } });
    expect(performance.now() - t).toBeLessThan(20_000);
  });
});

describe('the elastic cable', () => {
  it('with EA the weight is carried over the stretched run: H falls a little and the unstretched length is shorter than the stretched one', () => {
    const rigid = hang({ L: 100, h: 0, q: 0, w: 1, EA: null, known: { kind: 'sag-mid', value: 6 } }).exact;
    const elastic = hang({ L: 100, h: 0, q: 0, w: 1, EA: 800, known: { kind: 'sag-mid', value: 6 } }).exact;
    expect(elastic.H).toBeLessThan(rigid.H);
    near(elastic.H / rigid.H - 1, -(elastic.strain ?? 0), 0.3, elastic.strain ?? 1);
    expect(elastic.unstretched).toBeLessThan(elastic.length);
  });

  it('L0 = s/(1 + T_avg/EA): the exact unstretched length matches the textbook mean-tension formula to 1e-6 for a working cable', () => {
    const s = hang({ L: 300, h: 0, q: 0.5, w: 0, EA: 5e6, known: { kind: 'sag-mid', value: 12 } }).exact;
    // mean tension of a parabola over its length is within a few % of the mean of H and T_max
    const mean = (s.H + s.tension.max) / 2;
    near(s.unstretched, s.length / (1 + mean / 5e6), 3e-7);
  });

  it('the parabola is not changed by elasticity (only its unstretched length is); the stretched length is the same', () => {
    const a = hang({ L: 100, h: 5, q: 0.3, w: 0, EA: null, known: { kind: 'H', value: 20 } }).exact;
    const b = hang({ L: 100, h: 5, q: 0.3, w: 0, EA: 1000, known: { kind: 'H', value: 20 } }).exact;
    near(b.length, a.length, 1e-12);
    near(b.sagMid, a.sagMid, 1e-12);
    expect(b.unstretched).toBeLessThan(a.unstretched);
  });

  it('an elastic cable can be given a length shorter than its chord (it is stretched); a rigid one cannot', () => {
    const s = hang({ L: 100, h: 0, q: 0.2, w: 0, EA: 2000, known: { kind: 'length', value: 99.5 } }).exact;
    expect(s.length).toBeGreaterThan(100);
    expect(s.unstretched).toBeCloseTo(99.5, 9);
    expect(solveHanging({ L: 100, h: 0, q: 0.2, w: 0, EA: null, known: { kind: 'length', value: 99.5 } })).toEqual({ ok: false, issues: [{ code: 'length-below-chord', chord: 100, length: 99.5 }] });
  });

  it('the strain-high warning', () => {
    const s = hang({ L: 100, h: 0, q: 1, w: 0, EA: 100, known: { kind: 'sag-mid', value: 5 } });
    expect(s.warnings.find((w) => w.code === 'strain-high')?.strain).toBeGreaterThan(0.01);
    const t = hang({ L: 100, h: 0, q: 1, w: 0, EA: 1e6, known: { kind: 'sag-mid', value: 5 } });
    expect(t.warnings.map((w) => w.code)).not.toContain('strain-high');
  });
});

describe('where the lowest point is', () => {
  it('outside the span on a steep taut cable: sagLow is 0, the vertex is imaginary, and it is flagged', () => {
    const s = hang({ L: 100, h: 60, q: 0, w: 1, EA: null, known: { kind: 'sag-mid', value: 1 } });
    expect(s.exact.vertex.inside).toBe(false);
    expect(s.exact.sagLow).toBe(0);
    expect(s.exact.vertex.x).toBeLessThan(0);
    expect(s.exact.angle.A).toBeLessThan(0);
    expect(s.exact.tension.min).toBe(s.exact.tension.A);
    const w = s.warnings.find((x) => x.code === 'vertex-outside');
    expect(w?.x).toBeLessThan(0);
    // the other way round
    const t = hang({ L: 100, h: -60, q: 0, w: 1, EA: null, known: { kind: 'sag-mid', value: 1 } });
    expect(t.exact.vertex.x).toBeGreaterThan(100);
    expect(t.exact.tension.min).toBe(t.exact.tension.B);
  });

  it('the reaction at the high support is the larger on an inclined span, and the high support carries the maximum tension', () => {
    const s = hang({ L: 100, h: 20, q: 0.5, w: 0, EA: null, known: { kind: 'sag-mid', value: 8 } }).exact;
    expect(s.reaction.B).toBeGreaterThan(s.reaction.A);
    expect(s.tension.maxAt).toBe('B');
    expect(s.tension.max).toBe(s.tension.high);
  });
});

describe('shapeAt and solveKnown', () => {
  it('shapeAt returns null for an H that is not positive and finite; solveKnown tags the issue with the state', () => {
    const set = setup(100, 0, 1, 0);
    expect(shapeAt(set, 0)).toBeNull();
    expect(shapeAt(set, Number.NaN)).toBeNull();
    expect(shapeAt(set, Number.POSITIVE_INFINITY)).toBeNull();
    const k: Known = { kind: 'length', value: 50 };
    const out = solveKnown(set, k, 2);
    expect('issue' in out && out.issue).toEqual({ code: 'length-below-chord', chord: 100, length: 50, state: 2 });
  });

  it('the shape carries what it was solved with', () => {
    const set = setup(100, 5, 0.2, 0.1, 3000);
    const s = shapeAt(set, 25) as CableShape;
    expect(s.setup).toEqual(set);
    expect(s.H).toBe(25);
  });
});
