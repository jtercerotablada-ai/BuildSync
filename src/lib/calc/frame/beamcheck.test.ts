import { afterEach, describe, expect, it, vi } from 'vitest';
import { solveBeam, type BeamModel } from '../beam/solver';
import { pieceAt } from './element';
import { solveFrame } from './engine';
import { rng } from './oracle.testlib';
import type { FrameMemberLoad, FrameModel, FrameSupport } from './types';

vi.setConfig({ testTimeout: 120_000 });
afterEach(() => new Promise((r) => setTimeout(r, 0)));

/**
 * A SINGLE HORIZONTAL MEMBER (or a chain of them along one line) is a beam, and the beam calculator's engine (lib/calc/beam/solver.ts: initial parameters
 * with Macaulay brackets, a different method altogether) is exact for it. Random beams — supports of every kind, internal hinges, point loads, trapezoidal
 * loads across several members, couples — are solved by both, and the reactions, the shear, the moment, the slope and the deflection compared. The signs
 * are the beam calculator's: V up on the left part, M sagging, slope counter-clockwise, deflection up.
 */

const EI = 1000 * 2;

function randomBeam(seed: number): { beam: BeamModel; frame: FrameModel } | null {
  const r = rng(seed);
  const pick = <T,>(xs: readonly T[]): T => xs[Math.floor(r() * xs.length)];
  const L = pick([8, 10, 12, 16, 20]);
  const grid = (n: number) => (L * n) / 16;
  const supportsAt = new Map<number, 'pin' | 'roller' | 'fixed'>();
  const nSup = 1 + Math.floor(r() * 3);
  for (let k = 0; k < nSup; k++) supportsAt.set(grid(pick([0, 0, 4, 8, 8, 12, 16, 16, 2, 6, 10, 14])), pick(['pin', 'roller', 'fixed', 'pin'] as const));
  const hingesAt: number[] = [];
  const nHinge = Math.floor(r() * 3);
  for (let k = 0; k < nHinge; k++) {
    const x = grid(pick([3, 5, 6, 7, 9, 10, 11, 13]));
    if (!hingesAt.includes(x)) hingesAt.push(x);
  }
  const points = Array.from({ length: Math.floor(r() * 4) }, () => ({ x: grid(Math.floor(r() * 17)), P: pick([-5, 10, 4, 7.5, 2]) }));
  const dists = Array.from({ length: Math.floor(r() * 3) }, () => {
    const a = Math.floor(r() * 16);
    const b = a + 1 + Math.floor(r() * (16 - a));
    return { x1: grid(a), x2: grid(b), w1: pick([0, 1, 2, -1.5, 3]), w2: pick([0, 1, 2, 4, -1]) };
  });
  const couples = Array.from({ length: Math.floor(r() * 3) }, () => ({ x: grid(Math.floor(r() * 17)), M: pick([10, -20, 6]) }));
  const beam: BeamModel = {
    L,
    supports: [...supportsAt].map(([x, kind]) => ({ x, kind })).sort((a, b) => a.x - b.x),
    hinges: hingesAt.sort((a, b) => a - b),
    points,
    couples,
    dists,
  };

  // The frame: a node at every end, support and hinge; a member between neighbours.
  const xs = [...new Set([0, L, ...supportsAt.keys(), ...hingesAt])].sort((a, b) => a - b);
  const at = (x: number) => xs.indexOf(x);
  const hasFixed = [...supportsAt.values()].includes('fixed');
  let pinned = hasFixed;
  const supports: FrameSupport[] = [...supportsAt].sort((a, b) => a[0] - b[0]).map(([x, kind]) => {
    if (kind === 'fixed') return { node: at(x), kind: 'fixed' };
    if (!pinned) {
      pinned = true;
      return { node: at(x), kind: 'pin' };
    }
    return { node: at(x), kind: 'roller', angle: 90 };
  });
  const members = xs.slice(0, -1).map((_, k) => ({ i: k, j: k + 1, E: 1000, A: 100, I: 2, releases: { start: hingesAt.includes(xs[k]) || undefined, end: hingesAt.includes(xs[k + 1]) || undefined } }));
  // The member that holds a position (the left one at a node), and the distance along it.
  const holder = (x: number): { member: number; a: number } => {
    let k = xs.findIndex((v, i) => i < xs.length - 1 && x > v && x <= xs[i + 1]);
    if (k < 0) k = 0;
    return { member: k, a: x - xs[k] };
  };
  const memberLoads: FrameMemberLoad[] = [];
  for (const p of points) {
    const h = holder(p.x);
    memberLoads.push({ kind: 'point', member: h.member, dir: 'global-y', a: h.a, P: -p.P });
  }
  for (const c of couples) {
    const h = holder(c.x);
    memberLoads.push({ kind: 'moment', member: h.member, a: h.a, M: c.M });
  }
  for (const d of dists) {
    xs.slice(0, -1).forEach((xa, k) => {
      const lo = Math.max(d.x1, xa);
      const hi = Math.min(d.x2, xs[k + 1]);
      if (hi <= lo) return;
      const w = (x: number) => d.w1 + ((d.w2 - d.w1) * (x - d.x1)) / (d.x2 - d.x1);
      memberLoads.push({ kind: 'trapezoid', member: k, dir: 'global-y', a: lo - xa, b: hi - xa, w1: -w(lo), w2: -w(hi) });
    });
  }
  const frame: FrameModel = { nodes: xs.map((x) => ({ x, y: 0 })), members, supports, loads: [], memberLoads };
  return { beam, frame };
}

describe('a chain of horizontal members is the beam calculator\'s beam', () => {
  it('600 random beams: reactions, V, M, slope and deflection agree wherever the beam calculator takes the beam', () => {
    let compared = 0;
    for (let seed = 1; seed <= 600; seed++) {
      const made = randomBeam(seed);
      if (!made) continue;
      const b = solveBeam(made.beam);
      if (!b.ok) continue;
      const f = solveFrame(made.frame);
      expect(f.ok, `beam #${seed} ${JSON.stringify(made.beam)} → ${f.ok ? '' : JSON.stringify(f.issues)}`).toBe(true);
      if (!f.ok) continue;
      compared++;
      const scale = Math.max(1, ...b.reactions.map((r) => Math.abs(r.Rv)), f.equilibrium.scale);
      const L = made.beam.L;
      // Reactions: the frame's vertical reaction at the node of each support, and its moment; no horizontal force.
      made.beam.supports.forEach((s, k) => {
        const node = made.frame.nodes.findIndex((n) => n.x === s.x);
        const r = f.reactions.find((q) => q.node === node)!;
        expect(Math.abs(r.ry - b.reactions[k].Rv), `#${seed} Rv at ${s.x}`).toBeLessThanOrEqual(1e-8 * scale);
        expect(Math.abs(r.rm - b.reactions[k].Rm), `#${seed} Rm at ${s.x}`).toBeLessThanOrEqual(1e-8 * scale * L);
        expect(Math.abs(r.rx), `#${seed} Rx`).toBeLessThanOrEqual(1e-9 * scale);
      });
      const at = (x: number, side: 'left' | 'right') => {
        const k = f.members.findIndex((m) => (side === 'right' ? x >= m.pieces[0].x0 + made.frame.nodes[m.i].x && x < made.frame.nodes[m.j].x : x > made.frame.nodes[m.i].x && x <= made.frame.nodes[m.j].x));
        const m = f.members[Math.max(k, 0)];
        return pieceAt(m.pieces, x - made.frame.nodes[m.i].x, side);
      };
      const check = (x: number, side: 'left' | 'right') => {
        if ((side === 'left' && x <= 0) || (side === 'right' && x >= L)) return;
        const want = b.at(x, side);
        const got = at(x, side);
        const label = `#${seed} x=${x} ${side}`;
        expect(Math.abs(got.V - want.V), `${label} V`).toBeLessThanOrEqual(1e-8 * scale);
        expect(Math.abs(got.M - want.M), `${label} M`).toBeLessThanOrEqual(1e-8 * scale * L);
        expect(Math.abs(got.v! * EI - want.EIv), `${label} EIv`).toBeLessThanOrEqual(1e-7 * (Math.abs(want.EIv) + scale * L ** 3 * 1e-3 + 1e-9));
        expect(Math.abs(got.theta! * EI - want.EItheta), `${label} EIθ`).toBeLessThanOrEqual(1e-7 * (Math.abs(want.EItheta) + scale * L * L * 1e-2 + 1e-9));
      };
      for (let k = 0; k < 16; k++) {
        const x = (L * (k + 0.5)) / 16;
        check(x, 'left');
        check(x, 'right');
      }
      for (const node of made.frame.nodes) {
        check(node.x, 'left');
        check(node.x, 'right');
      }
    }
    expect(compared).toBeGreaterThan(150);
  });

  it('the beam calculator\'s own examples: a UDL on a simple span, a propped cantilever, a point load, a couple', () => {
    const cases: { beam: BeamModel; frame: FrameModel }[] = [
      {
        beam: { L: 10, supports: [{ x: 0, kind: 'pin' }, { x: 10, kind: 'roller' }], dists: [{ x1: 0, x2: 10, w1: 2, w2: 2 }] },
        frame: { nodes: [{ x: 0, y: 0 }, { x: 10, y: 0 }], members: [{ i: 0, j: 1, E: 1000, A: 100, I: 2 }], supports: [{ node: 0, kind: 'pin' }, { node: 1, kind: 'roller' }], loads: [], memberLoads: [{ kind: 'udl', member: 0, dir: 'global-y', w: -2 }] },
      },
      {
        beam: { L: 10, supports: [{ x: 0, kind: 'fixed' }, { x: 10, kind: 'roller' }], points: [{ x: 4, P: 12 }], couples: [{ x: 7, M: 15 }] },
        frame: { nodes: [{ x: 0, y: 0 }, { x: 10, y: 0 }], members: [{ i: 0, j: 1, E: 1000, A: 100, I: 2 }], supports: [{ node: 0, kind: 'fixed' }, { node: 1, kind: 'roller' }], loads: [], memberLoads: [{ kind: 'point', member: 0, dir: 'global-y', a: 4, P: -12 }, { kind: 'moment', member: 0, a: 7, M: 15 }] },
      },
    ];
    for (const c of cases) {
      const b = solveBeam(c.beam);
      const f = solveFrame(c.frame);
      expect(b.ok && f.ok).toBe(true);
      if (!b.ok || !f.ok) continue;
      for (const x of [1, 3.9, 4.1, 6.9, 7.1, 9]) {
        const want = b.at(x, 'right');
        const got = pieceAt(f.members[0].pieces, x, 'right');
        expect(got.V).toBeCloseTo(want.V, 9);
        expect(got.M).toBeCloseTo(want.M, 9);
        expect(got.v! * EI).toBeCloseTo(want.EIv, 7);
      }
      b.reactions.forEach((r, k) => expect(f.reactions[k].ry).toBeCloseTo(r.Rv, 9));
    }
  });
});
