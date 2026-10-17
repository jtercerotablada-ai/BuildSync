import { afterEach, describe, expect, it, vi } from 'vitest';
import { pullCore, solveLoad, solvePull } from './engine';
import { between, near, pickOf, rng } from './testlib';
import type { CableSection, LoadInput, PullSolution, PullStatus, Side } from './types';

vi.setConfig({ testTimeout: 120_000 });
afterEach(() => new Promise<void>((resolve) => setTimeout(resolve, 0)));

/*
 * The reviewers' physics findings (A1, A3, A4, A5, A6, A7), each held to an
 * oracle written here that shares nothing with engine.ts:
 *   - the load point of a sling is where the POTENTIAL ENERGY is least (a pattern
 *     search on W·y − H·x + Σ ½k·ext²), not where a Newton iteration lands;
 *   - what a cable does to a block is read from the NET FORCE ALONG THE TRAVEL as the
 *     tension grows, never from the formula T = W·c / Den the engine uses;
 *   - the best cable angle is a scan over φ of the least tension that keeps the block down.
 */

const RAD = Math.PI / 180;

/* ── A1: the sling's second-order tensions are an energy minimum ───────── */

function minimiseEnergy(W: number, H: number, anchors: [number, number][], Lu: number[], k: number[], start: [number, number]): [number, number] {
  const energy = (x: number, y: number) => {
    let e = W * y - H * x;
    anchors.forEach((a, i) => {
      const ext = Math.hypot(a[0] - x, a[1] - y) - Lu[i];
      if (ext > 0) e += 0.5 * k[i] * ext * ext;
    });
    return e;
  };
  let best: [number, number] = [start[0], start[1]];
  let be = energy(best[0], best[1]);
  const s0 = Math.max(...Lu) * 0.5;
  const dirs = [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [-1, -1], [1, -1], [-1, 1]];
  for (let s = s0; s > 1e-13 * s0; s /= 1.6) {
    let moved = true;
    for (let g = 0; moved && g < 500; g++) {
      moved = false;
      for (const [dx, dy] of dirs) {
        const x = best[0] + dx * s;
        const y = best[1] + dy * s;
        const e = energy(x, y);
        if (e < be) {
          be = e;
          best = [x, y];
          moved = true;
        }
      }
    }
  }
  return best;
}

describe('A1 — a heated sling whose legs start slack still gets its second-order tensions', () => {
  const steel = (A: number, E = 29e6): CableSection => ({ A, E, alpha: 6.5e-6 });
  it("the reviewer's case: two legs at 20°, 120 and 60 in, +50 °F, W = 500 lbf", () => {
    const out = solveLoad({ W: 500, H: 0, dT: 50, legs: [{ angle: 20, side: 'left', length: 120, section: steel(0.2) }, { angle: 20, side: 'right', length: 60, section: steel(0.2) }] });
    expect(out.ok).toBe(true);
    if (!out.ok) return;
    expect(out.warnings.map((w) => w.code)).not.toContain('no-second-order');
    const so = out.secondOrder!;
    expect(so).not.toBeNull();
    // The independent answer (pattern search on the potential energy): T1 = 727.99, T2 = 728.27 lbf, the load point moves (+0.0144, −0.1183) in.
    expect(so.T1).toBeCloseTo(727.99, 1);
    expect(so.T2).toBeCloseTo(728.27, 1);
    expect(so.displacement.dx).toBeCloseTo(0.0144, 3);
    expect(so.displacement.dy).toBeCloseTo(-0.1183, 3);
  });

  it('every heated or cooled sling of a random sample has second-order tensions that are the energy minimum', () => {
    const r = rng(1701);
    let heated = 0;
    for (let q = 0; q < 160; q++) {
      const a1 = pickOf(r, [3, 10, 20, 30, 45, 60, 80, between(r, 5, 85)]);
      const a2 = pickOf(r, [3, 10, 20, 30, 45, 60, 80, between(r, 5, 85)]);
      const s1: Side = r() < 0.5 ? 'left' : 'right';
      const s2: Side = s1 === 'left' ? 'right' : 'left';
      const W = between(r, 100, 4000);
      const L1 = between(r, 20, 300);
      const L2 = between(r, 20, 300);
      const dT = pickOf(r, [0, 20, 50, 100, -60, between(r, -80, 150)]);
      const E = pickOf(r, [29e6, 13e6]);
      const A = between(r, 0.05, 0.4);
      const sec1 = steel(A, E);
      const sec2 = { A: A * between(r, 0.6, 1.4), E: E * between(r, 0.6, 1.2), alpha: 12e-6 };
      const input: LoadInput = { W, H: 0, dT, legs: [{ angle: a1, side: s1, length: L1, section: sec1 }, { angle: a2, side: s2, length: L2, section: sec2 }] };
      const out = solveLoad(input);
      if (!out.ok) continue;
      const strain = Math.max(...out.legs.map((l) => Math.abs(l.line.strain)));
      if (strain > 0.03) continue;
      if (dT > 0) heated++;
      expect(out.secondOrder, JSON.stringify(input)).not.toBeNull();
      const Lu = [L1 * (1 + sec1.alpha * dT), L2 * (1 + sec2.alpha * dT)];
      const k = [(sec1.E * sec1.A) / Lu[0], (sec2.E * sec2.A) / Lu[1]];
      const anchors = out.legs.map((l) => [l.anchorX, l.anchorY] as [number, number]);
      const m = minimiseEnergy(W, 0, anchors, Lu, k, [out.secondOrder!.displacement.dx * 0.9, out.secondOrder!.displacement.dy * 0.9 - 1e-3]);
      const scale = Math.max(...Lu) * Math.max(strain, 1e-6) + 1e-9;
      expect(Math.hypot(m[0] - out.secondOrder!.displacement.dx, m[1] - out.secondOrder!.displacement.dy) / scale, JSON.stringify(input)).toBeLessThan(2e-3);
    }
    expect(heated).toBeGreaterThan(60);
  });
});

/* ── The pull: what the cable does, read from the net force along the travel ───────── */

/**
 * The net force along the direction of travel as the tension T grows, from the two equations of motion and nothing else:
 *   along the travel:  σ·T·cosφ − σ·W·sinθ − μ·N − W·a/g,   N = W·cosθ − T·sinφ.
 * Linear in T, so its value at T = 0 and its slope are read by two evaluations. The cable's role follows from what the block does as T rises.
 */
function oracle(W: number, theta: number, mu: number, phi: number, a: number, sigma: 1 | -1): { status: PullStatus; role: 'drive' | 'restrain' | 'release' | null; T: number | null } {
  const g = (T: number) => sigma * T * Math.cos(phi * RAD) - sigma * W * Math.sin(theta * RAD) - mu * (W * Math.cos(theta * RAD) - T * Math.sin(phi * RAD)) - W * a;
  const g0 = g(0);
  const slope = g(1) - g0;
  const root = slope === 0 ? Number.NaN : -g0 / slope;
  const lifted = (T: number) => W * Math.cos(theta * RAD) - T * Math.sin(phi * RAD) < -1e-12 * W;
  if (sigma === 1) {
    if (g0 > 0) return { status: 'slides-on-its-own', role: null, T: null };
    if (slope > 0) return lifted(root) ? { status: 'leaves-surface', role: 'drive', T: null } : { status: 'pull', role: 'drive', T: root };
    return { status: 'self-locking', role: null, T: null };
  }
  if (g0 > 0) {
    if (slope < 0) return lifted(root) ? { status: 'leaves-surface', role: 'restrain', T: null } : { status: 'pull', role: 'restrain', T: root };
    return { status: 'cannot-hold', role: null, T: null };
  }
  if (slope > 0) return lifted(root) ? { status: 'leaves-surface', role: 'release', T: null } : { status: 'pull', role: 'release', T: root };
  return { status: 'stays-put', role: null, T: null };
}

describe('A3, A5, A6, A7 — every status of a regime is what the net force along the travel says', () => {
  it('the engine agrees with the oracle on 40,000 random cases (status, role and tension)', () => {
    const r = rng(31337);
    const seen = new Map<string, number>();
    let compared = 0;
    for (let q = 0; q < 40000; q++) {
      const W = between(r, 1, 3000);
      const theta = between(r, -30, 60);
      const mu = pickOf(r, [between(r, 0, 1.5), between(r, 1.5, 5), 0.05, 0.3]);
      const phi = pickOf(r, [between(r, -90, 90), between(r, -90, 90), between(r, 30, 90), between(r, -90, -40)]);
      const a = pickOf(r, [0, 0, between(r, -1, 2)]);
      const sigma: 1 | -1 = r() < 0.5 ? 1 : -1;
      const core = pullCore(W, theta, mu, phi, a, sigma);
      const o = oracle(W, theta, mu, phi, a, sigma);
      // Keep clear of exact ties, where either answer is a matter of rounding.
      const g1 = Math.abs(sigma * Math.cos(phi * RAD) + mu * Math.sin(phi * RAD));
      const g0 = Math.abs(Math.sin(theta * RAD) + sigma * (mu * Math.cos(theta * RAD) + a));
      if (g1 < 1e-6 || g0 < 1e-6) continue;
      compared++;
      seen.set(`${sigma}:${o.status}`, (seen.get(`${sigma}:${o.status}`) ?? 0) + 1);
      expect(core.status, `W=${W} θ=${theta} μ=${mu} φ=${phi} a=${a} σ=${sigma}`).toBe(o.status);
      expect(core.role).toBe(o.role);
      if (o.status === 'pull') expect(near(core.T as number, o.T as number, 1e-9, 1e-9)).toBe(true);
    }
    expect(compared).toBeGreaterThan(30000);
    // Every status is met on both travels where it exists.
    for (const key of ['1:pull', '1:slides-on-its-own', '1:self-locking', '1:leaves-surface', '-1:pull', '-1:stays-put', '-1:cannot-hold', '-1:leaves-surface']) expect(seen.get(key) ?? 0, key).toBeGreaterThan(20);
  });

  it("A3: against the pull at 30°, μ = 0.3, φ = 80°, W = 100 no tension holds the block, and more tension makes it worse", () => {
    const core = pullCore(100, 30, 0.3, 80, 0, -1);
    expect(core.status).toBe('cannot-hold');
    expect(core.T).toBeNull();
    // The reviewer's brute force: the net downhill force is 24.0 at T = 0 and only grows (25.2 at 10, 30.1 at 50, 32.6 at 100).
    const down = (T: number) => 100 * Math.sin(30 * RAD) - T * Math.cos(80 * RAD) - 0.3 * (100 * Math.cos(30 * RAD) - T * Math.sin(80 * RAD));
    expect(down(0)).toBeCloseTo(24.0, 1);
    expect(down(10)).toBeCloseTo(25.2, 1);
    expect(down(50)).toBeCloseTo(30.1, 1);
    // Up to the tension at which the cable would lift the block off (N = 0 at T = 87.9), it only grows.
    for (let T = 0; T < 87; T += 1) expect(down(T + 1)).toBeGreaterThan(down(T));
  });

  it('A5: frictionless level ground needs no tension: not "slides by itself"', () => {
    const s = solvePull({ W: 100, theta: 0, muS: 0, muK: 0, phi: 30, aOverG: null, travel: 'along' });
    expect(s.ok).toBe(true);
    if (!s.ok) return;
    for (const id of ['start', 'run'] as const) {
      const r = s.regimes.find((x) => x.id === id)!;
      expect(r.status).toBe('no-pull-needed');
      expect(r.T).toBeNull();
      expect(r.N).toBe(100);
      expect(r.F).toBe(0);
    }
    // The exact limit slope: tanθ = −μ.
    const edge = pullCore(100, -Math.atan(0.5) / RAD, 0.5, 0, 0, 1);
    expect(edge.status).toBe('no-pull-needed');
    // Against the pull, too: nothing to hold.
    expect(pullCore(100, 0, 0, 30, 0, -1).status).toBe('no-pull-needed');
    // The same block with an acceleration asked for does need a pull.
    expect(pullCore(100, 0, 0, 30, 0.2, 1).status).toBe('pull');
  });

  it('A6: against the pull the tension is the one that HOLDS the block: the block slides for less and is held for more', () => {
    // θ = 30°, μs = 0.3, μk = 0.2, φ = 0, against: start T = 24.02, run T = 32.68 (the reviewer's numbers).
    const s = solvePull({ W: 100, theta: 30, muS: 0.3, muK: 0.2, phi: 0, aOverG: null, travel: 'against' }) as PullSolution;
    const start = s.regimes.find((r) => r.id === 'start')!;
    const run = s.regimes.find((r) => r.id === 'run')!;
    expect(start.T).toBeCloseTo(24.02, 2);
    expect(run.T).toBeCloseTo(32.68, 2);
    expect(start.role).toBe('restrain');
    // Independent: below T the block slides down (net force along the travel positive); at and above it, it is held.
    const net = (T: number, mu: number) => 100 * Math.sin(30 * RAD) - T - mu * 100 * Math.cos(30 * RAD);
    expect(net(start.T! - 1, 0.3)).toBeGreaterThan(0);
    expect(net(start.T! + 1, 0.3)).toBeLessThan(0);
    expect(net(run.T!, 0.2)).toBeCloseTo(0, 9);
  });
});

/* ── A4: the best cable angle when the block would lift off ───────────── */

function scanBest(W: number, theta: number, mu: number, a: number, sigma: 1 | -1): { phi: number; T: number } | null {
  let best: { phi: number; T: number } | null = null;
  // The best angle is about the cable that DRIVES (along) or HOLDS BACK (against) the block; a cable that releases it is another thing.
  const role = sigma === 1 ? 'drive' : 'restrain';
  for (let i = -90000; i <= 90000; i++) {
    const phi = i / 1000;
    const o = oracle(W, theta, mu, phi, a, sigma);
    if (o.status !== 'pull' || o.role !== role) continue;
    if (best === null || (o.T as number) < best.T) best = { phi, T: o.T as number };
  }
  return best;
}

describe('A4 — the best angle is the least tension that keeps the block on the surface', () => {
  const run = (theta: number, mu: number, a: number | null, travel: 'along' | 'against') => {
    const out = solvePull({ W: 100, theta, muS: mu, muK: mu, phi: 5, aOverG: a, travel });
    if (!out.ok) throw new Error('not solved');
    return out.regimes.find((r) => r.id === (a === null ? 'run' : 'accel'))!;
  };

  it('the three cases of the review: lift-off is the best angle', () => {
    // θ = 60°, μ = 1: φ* = 45° would lift the block (N = −18.3); the true best is the lift-off angle, 30°, T = 100.
    const a = run(60, 1, null, 'along');
    expect(a.optimum.valid).toBe(false);
    expect(a.optimum.best).not.toBeNull();
    expect(a.optimum.best!.atLiftOff).toBe(true);
    expect(a.optimum.best!.phi).toBeCloseTo(30, 9);
    expect(a.optimum.best!.T).toBeCloseTo(100, 9);
    expect(a.optimum.best!.N).toBe(0);
    // θ = 30°, μ = 2: φ* = 63.4°, true best 60° with T = 100.
    const b = run(30, 2, null, 'along');
    expect(b.optimum.best!.phi).toBeCloseTo(60, 9);
    expect(b.optimum.best!.T).toBeCloseTo(100, 9);
    // θ = 60°, μ = 2.63 → 30°.
    expect(run(60, 2.63, null, 'along').optimum.best!.phi).toBeCloseTo(30, 9);
    // Where φ* keeps the block down, best IS φ*.
    const c = run(0, 0.5, null, 'along');
    expect(c.optimum.valid).toBe(true);
    expect(c.optimum.best).toEqual({ phi: c.optimum.phi, T: c.optimum.T, N: c.optimum.N, atLiftOff: false });
  });

  it('agrees with a scan over φ, 0.001° apart, on random slopes, coefficients and accelerations (both travels)', () => {
    const r = rng(404);
    let lifted = 0;
    let compared = 0;
    for (let q = 0; q < 60; q++) {
      const theta = between(r, -20, 60);
      const mu = pickOf(r, [between(r, 0.1, 1), between(r, 1, 3)]);
      const a = pickOf<number | null>(r, [null, null, between(r, 0.05, 0.8)]);
      const travel = r() < 0.7 ? 'along' : 'against';
      const sigma = travel === 'along' ? 1 : -1;
      const reg = run(theta, mu, a, travel);
      const scan = scanBest(100, theta, mu, a ?? 0, sigma);
      if (scan === null) {
        expect(reg.optimum.best).toBeNull();
        continue;
      }
      compared++;
      expect(reg.optimum.best, `θ=${theta} μ=${mu} a=${a} ${travel}`).not.toBeNull();
      if (reg.optimum.best!.atLiftOff) lifted++;
      expect(near(reg.optimum.best!.T, scan.T, 2e-4, 1e-6), `θ=${theta} μ=${mu} a=${a} ${travel}: engine ${reg.optimum.best!.T} scan ${scan.T}`).toBe(true);
    }
    expect(compared).toBeGreaterThan(30);
    expect(lifted).toBeGreaterThan(3);
  });

  it('a block that slides by itself has no best angle', () => {
    expect(run(-30, 0.2, null, 'along').optimum.best).toBeNull();
  });
});
