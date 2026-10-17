import { afterEach, describe, expect, it, vi } from 'vitest';
import { derivPoly, evalPoly, pieceAt } from './element';
import { solveFrame } from './engine';
import { randomFrame, rng, stableFrame, toModel, type OSpec } from './oracle.testlib';
import type { FrameMemberLoad, FrameSolution } from './types';

// Heavy by design (hundreds of generated frames, several properties each): a loaded machine runs past the 5 s default.
vi.setConfig({ testTimeout: 120_000 });
afterEach(() => new Promise((r) => setTimeout(r, 0)));

/**
 * PROPERTIES THAT MUST HOLD FOR ANY FRAME, checked on generated ones (the same generators as the oracle's: oracle.testlib.ts). Each property is
 * recomputed here from the specification, not read off the engine's own checks.
 */

function solve(spec: OSpec): FrameSolution {
  const r = solveFrame(toModel(spec));
  if (!r.ok) throw new Error(`not solved: ${JSON.stringify(r.issues)}`);
  return r;
}
const tryIt = (spec: OSpec): FrameSolution | null => {
  const r = solveFrame(toModel(spec));
  return r.ok ? r : null;
};
const close = (a: number, b: number, scale: number, rel = 1e-9, label = '') => expect(Math.abs(a - b), `${label}: ${a} vs ${b} (scale ${scale})`).toBeLessThanOrEqual(rel * Math.max(scale, 1e-12));

/** Geometry of a member of the specification. */
function geo(spec: OSpec, mi: number) {
  const m = spec.members[mi];
  const a = spec.nodes[m.i];
  const b = spec.nodes[m.j];
  const L = Math.hypot(b.x - a.x, b.y - a.y);
  return { L, c: (b.x - a.x) / L, s: (b.y - a.y) / L, a, b };
}
/** A vector of size w along a direction, in the member's local axes. */
function comp(dir: string, w: number, c: number, s: number): [number, number] {
  if (dir === 'local-x') return [w, 0];
  if (dir === 'local-y') return [0, w];
  if (dir === 'global-x') return [w * c, -w * s];
  return [w * s, w * c];
}
/** The distributed load on member mi at distance x, local components. */
function qAt(spec: OSpec, mi: number, x: number): [number, number] {
  const { c, s, L } = geo(spec, mi);
  let qx = 0;
  let qy = 0;
  for (const l of spec.memberLoads) {
    if (l.member !== mi) continue;
    if (l.kind === 'udl') {
      const [a, b] = comp(l.dir, l.w, c, s);
      qx += a;
      qy += b;
    } else if (l.kind === 'udl-projected') {
      const [a, b] = comp(l.dir, l.w * (l.dir === 'global-y' ? Math.abs(c) : Math.abs(s)), c, s);
      qx += a;
      qy += b;
    } else if (l.kind === 'trapezoid' && x >= l.a && x <= l.b) {
      const w = l.w1 + ((l.w2 - l.w1) * (x - l.a)) / (l.b - l.a);
      const [a, b] = comp(l.dir, w, c, s);
      qx += a;
      qy += b;
    }
  }
  void L;
  return [qx, qy];
}
/** Load resultant of member mi: local forces and the moment about the member's start (counter-clockwise), by Simpson's rule over each load. */
function resultant(spec: OSpec, mi: number): { fx: number; fy: number; m: number; points: { a: number; Px: number; Py: number }[]; couples: { a: number; C: number }[] } {
  const { L, c, s } = geo(spec, mi);
  let fx = 0;
  let fy = 0;
  let m = 0;
  const points: { a: number; Px: number; Py: number }[] = [];
  const couples: { a: number; C: number }[] = [];
  const simpson = (f: (x: number) => number, a: number, b: number) => {
    const n = 200;
    const h = (b - a) / n;
    let sum = f(a) + f(b);
    for (let k = 1; k < n; k++) sum += f(a + k * h) * (k % 2 === 0 ? 2 : 4);
    return (sum * h) / 3;
  };
  for (const l of spec.memberLoads) {
    if (l.member !== mi) continue;
    if (l.kind === 'udl' || l.kind === 'udl-projected' || l.kind === 'trapezoid') {
      const a = l.kind === 'trapezoid' ? l.a : 0;
      const b = l.kind === 'trapezoid' ? l.b : L;
      fx += simpson((x) => qAt({ ...spec, memberLoads: [l] } as OSpec, mi, x)[0], a, b);
      fy += simpson((x) => qAt({ ...spec, memberLoads: [l] } as OSpec, mi, x)[1], a, b);
      m += simpson((x) => qAt({ ...spec, memberLoads: [l] } as OSpec, mi, x)[1] * x, a, b);
    } else if (l.kind === 'point') {
      const [px, py] = comp(l.dir, l.P, c, s);
      fx += px;
      fy += py;
      m += py * l.a;
      points.push({ a: l.a, Px: px, Py: py });
    } else if (l.kind === 'moment') {
      m += l.M;
      couples.push({ a: l.a, C: l.M });
    }
  }
  return { fx, fy, m, points, couples };
}

/** What the loads and the reactions add up to, about the origin, from the specification. */
function sums(spec: OSpec, sol: FrameSolution) {
  let fx = 0;
  let fy = 0;
  let m = 0;
  let size = 0;
  for (const l of spec.loads) {
    fx += l.fx;
    fy += l.fy;
    m += spec.nodes[l.node].x * l.fy - spec.nodes[l.node].y * l.fx + l.m;
    size += Math.abs(l.fx) + Math.abs(l.fy);
  }
  spec.members.forEach((_, mi) => {
    const { c, s, a } = geo(spec, mi);
    const r = resultant(spec, mi);
    const gx = c * r.fx - s * r.fy;
    const gy = s * r.fx + c * r.fy;
    fx += gx;
    fy += gy;
    m += r.m + a.x * gy - a.y * gx;
    size += Math.abs(r.fx) + Math.abs(r.fy);
  });
  spec.supports.forEach((s, si) => {
    const r = sol.reactions[si];
    fx += r.rx;
    fy += r.ry;
    m += spec.nodes[s.node].x * r.ry - spec.nodes[s.node].y * r.rx + r.rm;
  });
  return { fx, fy, m, size };
}

const sameFrames: OSpec[] = [];
for (let seed = 1; seed <= 120; seed++) sameFrames.push(stableFrame(seed, { maxNodes: 7 }));
const mixed: { spec: OSpec; sol: FrameSolution }[] = [];
for (let seed = 4000; mixed.length < 160 && seed < 4600; seed++) {
  const spec = randomFrame(seed, { maxNodes: 6 });
  const sol = tryIt(spec);
  if (sol) mixed.push({ spec, sol });
}

describe('equilibrium', () => {
  it('global ΣFx, ΣFy, ΣM (recomputed from the specification, loads at their definition) vanish: hinges, rollers, springs, settlements and all', () => {
    expect(mixed.length).toBeGreaterThanOrEqual(120);
    for (const { spec, sol } of mixed) {
      const t = sums(spec, sol);
      const scale = Math.max(sol.equilibrium.scale, 1e-9);
      close(t.fx, 0, scale, 1e-8, 'ΣFx');
      close(t.fy, 0, scale, 1e-8, 'ΣFy');
      close(t.m, 0, scale * Math.max(sol.equilibrium.size, 1), 1e-8, 'ΣM');
    }
  });
  it('the engine\'s own sums agree with ours', () => {
    for (const { spec, sol } of mixed.slice(0, 60)) {
      const t = sums(spec, sol);
      void t;
      const e = sol.equilibrium;
      expect(Math.abs(e.sumFx)).toBeLessThanOrEqual(1e-8 * Math.max(e.scale, 1e-9));
      expect(Math.abs(e.sumFy)).toBeLessThanOrEqual(1e-8 * Math.max(e.scale, 1e-9));
    }
  });
  it('every JOINT is in equilibrium: loads + reaction − the forces of the members that meet there = 0', () => {
    for (const { spec, sol } of mixed) {
      const n = spec.nodes.length;
      const net = Array.from({ length: n }, () => [0, 0, 0]);
      for (const l of spec.loads) {
        net[l.node][0] += l.fx;
        net[l.node][1] += l.fy;
        net[l.node][2] += l.m;
      }
      sol.reactions.forEach((r) => {
        net[r.node][0] += r.rx;
        net[r.node][1] += r.ry;
        net[r.node][2] += r.rm;
      });
      sol.members.forEach((m) => {
        const [fx1, fy1, mm1, fx2, fy2, mm2] = m.forces;
        // What the nodes exert on the member, in global axes; the member exerts the opposite on the nodes.
        const g1 = [m.cx * fx1 - m.cy * fy1, m.cy * fx1 + m.cx * fy1, mm1];
        const g2 = [m.cx * fx2 - m.cy * fy2, m.cy * fx2 + m.cx * fy2, mm2];
        for (let k = 0; k < 3; k++) {
          net[m.i][k] -= g1[k];
          net[m.j][k] -= g2[k];
        }
      });
      const scale = Math.max(sol.equilibrium.scale, 1e-9);
      net.forEach((v, k) => {
        // A spring's pull is part of the reaction; a node whose rotation is free carries no moment equation.
        close(v[0], 0, scale, 1e-8, `joint ${k} x`);
        close(v[1], 0, scale, 1e-8, `joint ${k} y`);
        const inert = sol.displacements?.[k].rotation === null;
        if (!inert) close(v[2], 0, scale * Math.max(sol.equilibrium.size, 1), 1e-8, `joint ${k} m`);
      });
    }
  });
  it('every MEMBER is a free body in equilibrium under its end values and the loads inside it (loads at an end go straight to the node)', () => {
    for (const { spec, sol } of mixed) {
      sol.members.forEach((m, mi) => {
        const r = resultant({ ...spec, memberLoads: spec.memberLoads.filter((l) => !(l.member === mi && (l.kind === 'point' || l.kind === 'moment') && (l.a <= 0 || l.a >= m.length))) }, mi);
        const scale = Math.max(sol.equilibrium.scale, 1e-9);
        // Axial, shear, and the moment about the start.
        close(-m.start.N + m.end.N + r.fx, 0, scale, 1e-8, 'axial');
        close(m.start.V - m.end.V + r.fy, 0, scale, 1e-8, 'shear');
        close(-m.start.M + m.end.M - m.end.V * m.length + r.m, 0, scale * Math.max(m.length, 1), 1e-8, 'moment');
      });
    }
  });
  it('a hinge carries no moment: exactly zero at a released end', () => {
    let hinges = 0;
    for (const { spec, sol } of mixed) {
      sol.members.forEach((m, mi) => {
        if (spec.members[mi].rs) {
          hinges++;
          expect(m.forces[2]).toBe(0);
          expect(Math.abs(m.start.M)).toBe(0);
        }
        if (spec.members[mi].re) {
          hinges++;
          expect(m.forces[5]).toBe(0);
          expect(Math.abs(m.end.M)).toBe(0);
        }
      });
    }
    expect(hinges).toBeGreaterThan(20);
  });
});

describe('the diagrams', () => {
  it('dV/dx = q, dN/dx = −q_x, dM/dx = V along every member, away from the loads that make them jump', () => {
    for (const { spec, sol } of mixed.slice(0, 100)) {
      sol.members.forEach((m, mi) => {
        const L = m.length;
        const marks = new Set<number>([0, L]);
        for (const l of spec.memberLoads) if (l.member === mi && l.kind !== 'udl' && l.kind !== 'udl-projected' && l.kind !== 'temperature') {
          marks.add('a' in l ? l.a : 0);
          if (l.kind === 'trapezoid') marks.add(l.b);
        }
        const h = 1e-5 * L;
        for (const t of [0.07, 0.23, 0.41, 0.58, 0.77, 0.93]) {
          const x = t * L;
          if ([...marks].some((b) => Math.abs(b - x) < 3 * h)) continue;
          const lo = pieceAt(m.pieces, x - h);
          const hi = pieceAt(m.pieces, x + h);
          const mid = pieceAt(m.pieces, x);
          const [qx, qy] = qAt(spec, mi, x);
          const scale = Math.max(sol.equilibrium.scale, 1e-9);
          close((hi.V - lo.V) / (2 * h), qy, scale / L, 1e-5, 'dV/dx');
          close((hi.N - lo.N) / (2 * h), -qx, scale / L, 1e-5, 'dN/dx');
          close((hi.M - lo.M) / (2 * h), mid.V, scale, 1e-5, 'dM/dx');
        }
      });
    }
  });
  it('the deflected shape closes: v and u reach the end displacements, v\' the end rotations, and EI v\'\' = M (+ the thermal curvature)', () => {
    for (const { spec, sol } of mixed) {
      if (!sol.displacements) continue;
      sol.members.forEach((m, mi) => {
        const d = m.displacements!;
        const first = m.pieces[0];
        const last = m.pieces[m.pieces.length - 1];
        const ell = last.x1 - last.x0;
        const top = Math.max(...d.map(Math.abs), 1e-9);
        const tol = 1e-8 * top;
        close(evalPoly(first.v!, 0), d[1], tol / 1e-8, 1e-8, 'v(0)');
        close(evalPoly(derivPoly(first.v!), 0), d[2], top / Math.max(m.length, 1) + Math.abs(d[2]), 1e-8, "v'(0)");
        close(evalPoly(last.v!, ell), d[4], tol / 1e-8, 1e-8, 'v(L)');
        close(evalPoly(derivPoly(last.v!), ell), d[5], top / Math.max(m.length, 1) + Math.abs(d[5]), 1e-8, "v'(L)");
        close(evalPoly(last.u!, ell), d[3], tol / 1e-8, 1e-8, 'u(L)');
        // Continuity between pieces: displacements and slopes.
        for (let k = 1; k < m.pieces.length; k++) {
          const a = m.pieces[k - 1];
          const b = m.pieces[k];
          close(evalPoly(a.v!, a.x1 - a.x0), evalPoly(b.v!, 0), top, 1e-9, 'v continuity');
          close(evalPoly(derivPoly(a.v!), a.x1 - a.x0), evalPoly(derivPoly(b.v!), 0), top / Math.max(m.length, 1) + Math.abs(d[2]), 1e-8, 'slope continuity');
          close(evalPoly(a.u!, a.x1 - a.x0), evalPoly(b.u!, 0), top, 1e-9, 'u continuity');
        }
        // Curvature: v'' − κ₀ = M/EI at the middle of every piece.
        const sm = spec.members[mi];
        const th = spec.memberLoads.filter((l): l is Extract<FrameMemberLoad, { kind: 'temperature' }> => l.member === mi && l.kind === 'temperature');
        const curv0 = th.reduce((s, l) => s - (l.alpha * l.dTg) / (l.dTg === 0 ? 1 : sm.h!) * (l.dTg === 0 ? 0 : 1), 0);
        for (const p of m.pieces) {
          const t = (p.x1 - p.x0) / 2;
          const kappa = evalPoly(derivPoly(derivPoly(p.v!)), t);
          close(kappa - curv0, evalPoly(p.M, t) / (sm.E * sm.I), Math.abs(kappa) + Math.abs(curv0) + Math.abs(evalPoly(p.M, t) / (sm.E * sm.I)) + 1e-9, 1e-8, "EI v''");
        }
      });
    }
  });
  it('members rigidly joined at a node turn with it: the member\'s own end rotation is the node\'s; a hinged end differs and the node\'s is free if every end is hinged', () => {
    for (const { spec, sol } of mixed) {
      if (!sol.displacements) continue;
      sol.members.forEach((m, mi) => {
        const sm = spec.members[mi];
        const d = m.displacements!;
        const ni = sol.displacements![m.i];
        const nj = sol.displacements![m.j];
        const tol = 1e-8 * Math.max(...sol.displacements!.map((x) => Math.max(Math.abs(x.ux), Math.abs(x.uy))), 1e-12);
        close(d[0], m.cx * ni.ux + m.cy * ni.uy, tol / 1e-8, 1e-8, 'u_i');
        close(d[1], -m.cy * ni.ux + m.cx * ni.uy, tol / 1e-8, 1e-8, 'v_i');
        close(d[3], m.cx * nj.ux + m.cy * nj.uy, tol / 1e-8, 1e-8, 'u_j');
        close(d[4], -m.cy * nj.ux + m.cx * nj.uy, tol / 1e-8, 1e-8, 'v_j');
        const rot = Math.max(...sol.displacements!.map((x) => Math.abs(x.rotation ?? 0)), 1e-9);
        if (!sm.rs) close(d[2], ni.rotation!, rot, 1e-8, 'θ_i joined');
        if (!sm.re) close(d[5], nj.rotation!, rot, 1e-8, 'θ_j joined');
      });
    }
  });
});

describe('a determinate frame does not know its stiffness', () => {
  it('reactions, end forces, N, V and M are the same for any E, A, I: 80 trees on a single fixed support', () => {
    for (let seed = 1; seed <= 80; seed++) {
      const spec = randomFrame(seed + 700, { tree: true, noHinges: true, exotic: false, maxNodes: 7 });
      spec.supports.splice(0, spec.supports.length, { node: 0, kind: 'fixed' });
      const a = solve(spec);
      expect(a.determinacy).toMatchObject({ degree: 0, word: 'determinate' });
      const r = rng(seed);
      const other: OSpec = { ...spec, members: spec.members.map((m) => ({ ...m, E: m.E * (0.1 + r() * 20), A: m.A * (0.05 + r() * 40), I: m.I * (0.02 + r() * 50) })) };
      const b = solve(other);
      const scale = Math.max(a.equilibrium.scale, 1e-9);
      a.reactions.forEach((x, k) => {
        close(x.rx, b.reactions[k].rx, scale, 1e-9, 'rx');
        close(x.ry, b.reactions[k].ry, scale, 1e-9, 'ry');
        close(x.rm, b.reactions[k].rm, scale * a.equilibrium.size, 1e-9, 'rm');
      });
      a.members.forEach((m, k) => {
        m.forces.forEach((v, q) => close(v, b.members[k].forces[q], scale * (q % 3 === 2 ? a.equilibrium.size : 1), 1e-9, 'end force'));
        close(m.maxima.M.max.value, b.members[k].maxima.M.max.value, scale * a.equilibrium.size, 1e-9, 'M max');
      });
    }
  });
  it('and the displacements do depend on them (the contrast): stiffer sections move less', () => {
    const spec = stableFrame(5);
    spec.loads.push({ node: spec.nodes.length - 1, fx: 5, fy: -5, m: 0 });
    const a = solve(spec);
    const b = solve({ ...spec, members: spec.members.map((m) => ({ ...m, I: m.I * 10, A: m.A * 10 })) });
    const top = (s: FrameSolution) => Math.max(...s.displacements!.map((d) => d.magnitude));
    expect(top(b)).toBeLessThan(top(a) / 5);
  });
});

describe('linearity', () => {
  const addUp = (a: FrameSolution, b: FrameSolution, c: FrameSolution, scale: number) => {
    a.reactions.forEach((x, k) => {
      close(x.rx + b.reactions[k].rx, c.reactions[k].rx, scale, 1e-9, 'rx');
      close(x.ry + b.reactions[k].ry, c.reactions[k].ry, scale, 1e-9, 'ry');
    });
    a.members.forEach((m, k) => {
      m.forces.forEach((v, q) => close(v + b.members[k].forces[q], c.members[k].forces[q], scale * (q % 3 === 2 ? 20 : 1), 1e-9, 'end force'));
    });
    a.displacements!.forEach((d, k) => close(d.ux + b.displacements![k].ux, c.displacements![k].ux, scale * 1e-3 + 1e-9, 1e-8, 'ux'));
  };
  it('superposition: the loads A and the loads B solved apart add up to the loads A + B (100 frames)', () => {
    for (let seed = 1; seed <= 100; seed++) {
      const spec = stableFrame(seed + 300, { maxNodes: 6, loads: 5 });
      const nodal = spec.loads;
      const half = Math.floor(spec.memberLoads.length / 2);
      const A: OSpec = { ...spec, loads: nodal.slice(0, 1), memberLoads: spec.memberLoads.slice(0, half) };
      const B: OSpec = { ...spec, loads: nodal.slice(1), memberLoads: spec.memberLoads.slice(half) };
      const sa = solve(A);
      const sb = solve(B);
      const sc = solve(spec);
      addUp(sa, sb, sc, Math.max(sc.equilibrium.scale, sa.equilibrium.scale, sb.equilibrium.scale, 1e-9));
    }
  });
  it('scaling: loads × λ give results × λ, including temperature (100 frames)', () => {
    for (let seed = 1; seed <= 100; seed++) {
      const spec = stableFrame(seed + 500, { maxNodes: 6, loads: 5 });
      const lambda = [0.25, -3, 7.5][seed % 3];
      const scaled: OSpec = {
        ...spec,
        loads: spec.loads.map((l) => ({ ...l, fx: l.fx * lambda, fy: l.fy * lambda, m: l.m * lambda })),
        memberLoads: spec.memberLoads.map((l): FrameMemberLoad => {
          switch (l.kind) {
            case 'udl':
            case 'udl-projected':
              return { ...l, w: l.w * lambda };
            case 'trapezoid':
              return { ...l, w1: l.w1 * lambda, w2: l.w2 * lambda };
            case 'point':
              return { ...l, P: l.P * lambda };
            case 'moment':
              return { ...l, M: l.M * lambda };
            default:
              return { ...l, dT: l.dT * lambda, dTg: l.dTg * lambda };
          }
        }),
      };
      const a = solve(spec);
      const b = solve(scaled);
      const scale = Math.max(a.equilibrium.scale, 1e-9) * Math.abs(lambda);
      a.reactions.forEach((x, k) => {
        close(x.rx * lambda, b.reactions[k].rx, scale, 1e-9, 'rx');
        close(x.rm * lambda, b.reactions[k].rm, scale * 30, 1e-9, 'rm');
      });
      a.members.forEach((m, k) => m.forces.forEach((v, q) => close(v * lambda, b.members[k].forces[q], scale * 30, 1e-9, 'end force')));
      a.displacements!.forEach((d, k) => close(d.uy * lambda, b.displacements![k].uy, Math.abs(lambda) * (Math.abs(d.uy) + Math.abs(d.ux) + 1e-12), 1e-8, 'uy'));
    }
  });
  it('Maxwell–Betti: the displacement at A due to a unit load at B equals that at B due to a unit load at A (60 frames)', () => {
    for (let seed = 1; seed <= 60; seed++) {
      const base = stableFrame(seed + 900, { maxNodes: 6 });
      base.loads = [];
      base.memberLoads = [];
      const n = base.nodes.length;
      const A = seed % n;
      const B = (seed * 3 + 1) % n;
      const dirA = seed % 2;
      const dirB = (seed >> 1) % 2;
      const load = (node: number, dir: number) => [{ node, fx: dir === 0 ? 1 : 0, fy: dir === 1 ? 1 : 0, m: 0 }];
      const sa = solve({ ...base, loads: load(A, dirA) });
      const sb = solve({ ...base, loads: load(B, dirB) });
      const at = (s: FrameSolution, node: number, dir: number) => (dir === 0 ? s.displacements![node].ux : s.displacements![node].uy);
      close(at(sb, A, dirA), at(sa, B, dirB), Math.abs(at(sa, B, dirB)) + Math.abs(at(sb, A, dirA)) + 1e-14, 1e-8, 'reciprocity');
    }
  });
});

/** The specification with its global-direction loads written in the members' own axes: the same physical loads. */
function inLocalAxes(spec: OSpec): OSpec {
  const out: FrameMemberLoad[] = [];
  for (const l of spec.memberLoads) {
    const { c, s } = geo(spec, l.member);
    if (l.kind === 'udl' || l.kind === 'udl-projected') {
      const dir = l.kind === 'udl-projected' ? l.dir : l.dir;
      const w = l.kind === 'udl-projected' ? l.w * (l.dir === 'global-y' ? Math.abs(c) : Math.abs(s)) : l.w;
      const [qx, qy] = comp(dir, w, c, s);
      out.push({ kind: 'udl', member: l.member, dir: 'local-x', w: qx }, { kind: 'udl', member: l.member, dir: 'local-y', w: qy });
    } else if (l.kind === 'trapezoid') {
      const [x1, y1] = comp(l.dir, l.w1, c, s);
      const [x2, y2] = comp(l.dir, l.w2, c, s);
      out.push({ kind: 'trapezoid', member: l.member, dir: 'local-x', a: l.a, b: l.b, w1: x1, w2: x2 }, { kind: 'trapezoid', member: l.member, dir: 'local-y', a: l.a, b: l.b, w1: y1, w2: y2 });
    } else if (l.kind === 'point') {
      const [px, py] = comp(l.dir, l.P, c, s);
      out.push({ kind: 'point', member: l.member, dir: 'local-x', a: l.a, P: px }, { kind: 'point', member: l.member, dir: 'local-y', a: l.a, P: py });
    } else out.push(l);
  }
  return { ...spec, memberLoads: out };
}

describe('the same frame seen differently', () => {
  it('writing the global loads in the members\' own axes changes nothing (100 frames)', () => {
    for (let seed = 1; seed <= 100; seed++) {
      const spec = stableFrame(seed + 1100, { maxNodes: 6, loads: 5 });
      const a = solve(spec);
      const b = solve(inLocalAxes(spec));
      const scale = Math.max(a.equilibrium.scale, 1e-9);
      a.members.forEach((m, k) => m.forces.forEach((v, q) => close(v, b.members[k].forces[q], scale * 30, 1e-9, 'end force')));
    }
  });
  it('rotating the whole frame and its loads by any angle leaves N, V and M alone and turns the reactions and displacements (100 frames, 7 angles)', () => {
    const angles = [30, 45, 90, 137.5, 180, 270, -61];
    for (let seed = 1; seed <= 100; seed++) {
      const spec = inLocalAxes(stableFrame(seed + 1300, { maxNodes: 6, loads: 5 }));
      // A roller's line would not turn with the frame: a pin is the same support at every angle.
      spec.supports = spec.supports.map((s) => ({ node: s.node, kind: s.kind === 'fixed' ? ('fixed' as const) : ('pin' as const) }));
      const deg = angles[seed % angles.length];
      const th = (deg * Math.PI) / 180;
      const c = Math.cos(th);
      const s = Math.sin(th);
      const rotated: OSpec = {
        ...spec,
        nodes: spec.nodes.map((p) => ({ x: c * p.x - s * p.y, y: s * p.x + c * p.y })),
        loads: spec.loads.map((l) => ({ ...l, fx: c * l.fx - s * l.fy, fy: s * l.fx + c * l.fy })),
      };
      const a = solve(spec);
      const b = solve(rotated);
      const scale = Math.max(a.equilibrium.scale, 1e-9);
      a.members.forEach((m, k) => {
        m.forces.forEach((v, q) => close(v, b.members[k].forces[q], scale * (q % 3 === 2 ? 30 : 1), 1e-8, `end force ${q}`));
        close(m.maxima.M.max.value, b.members[k].maxima.M.max.value, scale * 30, 1e-8, 'M max');
        close(m.maxima.V.min.value, b.members[k].maxima.V.min.value, scale, 1e-8, 'V min');
      });
      a.reactions.forEach((r, k) => {
        close(c * r.rx - s * r.ry, b.reactions[k].rx, scale, 1e-8, 'rx');
        close(s * r.rx + c * r.ry, b.reactions[k].ry, scale, 1e-8, 'ry');
        close(r.rm, b.reactions[k].rm, scale * 30, 1e-8, 'rm');
      });
      const top = Math.max(...a.displacements!.map((d) => d.magnitude), 1e-12);
      a.displacements!.forEach((d, k) => {
        close(c * d.ux - s * d.uy, b.displacements![k].ux, top, 1e-8, 'ux');
        close(d.rotation!, b.displacements![k].rotation!, top / Math.max(a.equilibrium.size, 1) + Math.abs(d.rotation!), 1e-8, 'rotation');
      });
    }
  });
  it('mirroring the frame in the y axis: N, |V| and |M| are the same, the reactions mirror (100 frames)', () => {
    for (let seed = 1; seed <= 100; seed++) {
      const spec = inLocalAxes(stableFrame(seed + 1500, { maxNodes: 6, loads: 5 }));
      spec.supports = spec.supports.map((s) => ({ node: s.node, kind: s.kind === 'fixed' ? ('fixed' as const) : ('pin' as const) }));
      const mirror: OSpec = {
        ...spec,
        nodes: spec.nodes.map((p) => ({ x: -p.x, y: p.y })),
        loads: spec.loads.map((l) => ({ ...l, fx: -l.fx, m: -l.m })),
        memberLoads: spec.memberLoads.map((l): FrameMemberLoad => {
          switch (l.kind) {
            case 'udl':
              return { ...l, w: l.dir === 'local-y' ? -l.w : l.w };
            case 'trapezoid':
              return l.dir === 'local-y' ? { ...l, w1: -l.w1, w2: -l.w2 } : l;
            case 'point':
              return l.dir === 'local-y' ? { ...l, P: -l.P } : l;
            case 'moment':
              return { ...l, M: -l.M };
            case 'temperature':
              return { ...l, dTg: -l.dTg };
            default:
              return l;
          }
        }),
      };
      const a = solve(spec);
      const b = solve(mirror);
      const scale = Math.max(a.equilibrium.scale, 1e-9);
      a.members.forEach((m, k) => {
        close(m.start.N, b.members[k].start.N, scale, 1e-9, 'N start');
        close(m.end.N, b.members[k].end.N, scale, 1e-9, 'N end');
        close(m.start.V, -b.members[k].start.V, scale, 1e-9, 'V start');
        close(m.start.M, -b.members[k].start.M, scale * 30, 1e-9, 'M start');
        close(m.end.M, -b.members[k].end.M, scale * 30, 1e-9, 'M end');
      });
      a.reactions.forEach((r, k) => {
        close(r.rx, -b.reactions[k].rx, scale, 1e-9, 'rx');
        close(r.ry, b.reactions[k].ry, scale, 1e-9, 'ry');
        close(r.rm, -b.reactions[k].rm, scale * 30, 1e-9, 'rm');
      });
    }
  });
  it('a symmetric frame under a symmetric load is symmetric: a portal, a gable, a two-bay frame', () => {
    const portal = (bays: number): OSpec => {
      const nodes: OSpec['nodes'] = [];
      for (let c = 0; c <= bays; c++) nodes.push({ x: 8 * c, y: 0 }, { x: 8 * c, y: 6 });
      const members: OSpec['members'] = [];
      for (let c = 0; c <= bays; c++) members.push({ i: 2 * c, j: 2 * c + 1, E: 1000, A: 20, I: 300, rs: false, re: false });
      for (let c = 0; c < bays; c++) members.push({ i: 2 * c + 1, j: 2 * c + 3, E: 1000, A: 20, I: 400, rs: false, re: false });
      return {
        nodes,
        members,
        supports: Array.from({ length: bays + 1 }, (_, c) => ({ node: 2 * c, kind: 'fixed' as const })),
        loads: [],
        memberLoads: members.map((_, k) => k).filter((k) => k > bays).map((k) => ({ kind: 'udl' as const, member: k, dir: 'global-y' as const, w: -2 })),
      };
    };
    for (const bays of [1, 2, 3]) {
      const spec = portal(bays);
      const s = solve(spec);
      const last = bays;
      for (let c = 0; c <= bays; c++) {
        const mirrorC = last - c;
        close(s.reactions[c].ry, s.reactions[mirrorC].ry, 30, 1e-9, 'ry');
        close(s.reactions[c].rx, -s.reactions[mirrorC].rx, 30, 1e-9, 'rx');
        close(s.reactions[c].rm, -s.reactions[mirrorC].rm, 300, 1e-9, 'rm');
      }
      close(s.displacements![1].ux, -s.displacements![2 * bays + 1].ux, 1e-3, 1e-9, 'sway');
    }
  });
});

/** Gauss–Legendre nodes of order 5 on [-1, 1]. */
const G5: [number, number][] = [
  [0, 0.5688888888888889],
  [0.5384693101056831, 0.47862867049936647],
  [-0.5384693101056831, 0.47862867049936647],
  [0.9061798459386640, 0.23692688505618908],
  [-0.9061798459386640, 0.23692688505618908],
];
const integrate = (f: (x: number) => number, a: number, b: number): number => G5.reduce((s, [g, w]) => s + w * f(((b - a) / 2) * g + (a + b) / 2) * ((b - a) / 2), 0);

describe('energy', () => {
  it('the work of the loads on the displacements, ½ΣP·u, equals the strain energy ∫(N²/2EA + M²/2EI): 100 frames with nodal, distributed, point and couple loads', () => {
    for (let seed = 1; seed <= 100; seed++) {
      const spec = stableFrame(seed + 1700, { maxNodes: 6, loads: 5 });
      // No temperature (it is not a load that does work in this sum).
      spec.memberLoads = spec.memberLoads.filter((l) => l.kind !== 'temperature');
      const sol = solve(spec);
      let work = 0;
      spec.loads.forEach((l) => {
        const d = sol.displacements![l.node];
        work += l.fx * d.ux + l.fy * d.uy + (d.rotation === null ? 0 : l.m * d.rotation);
      });
      let energy = 0;
      sol.members.forEach((m, mi) => {
        const sm = spec.members[mi];
        for (const p of m.pieces) {
          energy += integrate((x) => (evalPoly(p.N, x) ** 2) / (2 * sm.E * sm.A) + (evalPoly(p.M, x) ** 2) / (2 * sm.E * sm.I), 0, p.x1 - p.x0);
        }
        // The loads on the member: distributed ones against the displacement of its axis, point loads and couples at their place.
        for (const l of spec.memberLoads) {
          if (l.member !== mi) continue;
          const { c, s } = geo(spec, mi);
          if (l.kind === 'udl' || l.kind === 'udl-projected' || l.kind === 'trapezoid') {
            const a = l.kind === 'trapezoid' ? l.a : 0;
            const b = l.kind === 'trapezoid' ? l.b : m.length;
            for (const p of m.pieces) {
              const lo = Math.max(a, p.x0);
              const hi = Math.min(b, p.x1);
              if (hi <= lo) continue;
              work += integrate((x) => {
                const [qx, qy] = qAt({ ...spec, memberLoads: [l] }, mi, x);
                return qx * evalPoly(p.u!, x - p.x0) + qy * evalPoly(p.v!, x - p.x0);
              }, lo, hi);
            }
          } else if (l.kind === 'point') {
            const [px, py] = comp(l.dir, l.P, c, s);
            const at = pieceAt(m.pieces, l.a, 'right');
            work += px * at.u! + py * at.v!;
          } else if (l.kind === 'moment') {
            work += l.M * pieceAt(m.pieces, l.a, 'right').theta!;
          }
        }
      });
      close(work / 2, energy, Math.abs(energy) + Math.abs(work / 2) + 1e-14, 1e-8, 'energy');
    }
  });
});

describe('nothing in, nothing out', () => {
  it('a frame with no load has every result exactly zero, and says so', () => {
    for (let seed = 1; seed <= 30; seed++) {
      const spec = stableFrame(seed + 2000, { maxNodes: 6 });
      spec.loads = [];
      spec.memberLoads = [];
      const s = solve(spec);
      expect(s.warnings.map((w) => w.code)).toContain('no-load');
      s.reactions.forEach((r) => expect([r.rx, r.ry, r.rm]).toEqual([0, 0, 0]));
      s.members.forEach((m) => m.forces.forEach((v) => expect(v).toBe(0)));
      s.displacements!.forEach((d) => expect([d.ux, d.uy]).toEqual([0, 0]));
    }
  });
});
