import { expect } from 'vitest';
import { solveFrame } from './engine';
import { pieceAt } from './element';
import { solveOracle, toModel, type OSpec } from './oracle.testlib';

/** The engine against the exact oracle on one specification (oracle.test.ts has the story). */
export const TOL = 1e-8;

/**
 * The deflection of member mi at x by the double integral of the exact moment: v(x) = v_i + θ_i·x + ∫(x − ξ)(M/EI + κ₀)dξ, with M the oracle's
 * (the free body to the left of the cut, exact fractions), the integral by 3-point Gauss between the breakpoints (exact for the cubic M),
 * and v_i, θ_i from the oracle's displacements. Only for a member whose start is not a hinge (its own end rotation is the node's).
 */
function oracleV(spec: OSpec, oracle: NonNullable<ReturnType<typeof solveOracle>>, mi: number, x: number): number {
  const m = spec.members[mi];
  const a = spec.nodes[m.i];
  const b = spec.nodes[m.j];
  const L = Math.hypot(b.x - a.x, b.y - a.y);
  const c = (b.x - a.x) / L;
  const s = (b.y - a.y) / L;
  const EI = m.E * m.I;
  let curv0 = 0;
  for (const l of spec.memberLoads) if (l.member === mi && l.kind === 'temperature' && l.dTg !== 0) curv0 -= (l.alpha * l.dTg) / m.h!;
  const marks = new Set<number>([0, x]);
  for (const l of spec.memberLoads) {
    if (l.member !== mi) continue;
    if ('a' in l && l.a > 0 && l.a < x) marks.add(l.a);
    if (l.kind === 'trapezoid' && l.b > 0 && l.b < x) marks.add(l.b);
  }
  const cuts = [...marks].sort((p, q) => p - q);
  const nodes3: [number, number][] = [[0, 8 / 9], [Math.sqrt(0.6), 5 / 9], [-Math.sqrt(0.6), 5 / 9]];
  let integral = 0;
  for (let k = 0; k + 1 < cuts.length; k++) {
    const lo = cuts[k];
    const hi = cuts[k + 1];
    for (const [g, w] of nodes3) {
      const xi = ((hi - lo) / 2) * g + (hi + lo) / 2;
      integral += w * ((hi - lo) / 2) * (x - xi) * (oracle.at(mi, xi, 'right').M / EI + curv0);
    }
  }
  const vi = -s * oracle.u[3 * m.i] + c * oracle.u[3 * m.i + 1];
  return vi + oracle.u[3 * m.i + 2] * x + integral;
}

export function compare(spec: OSpec, label: string, tol = TOL): 'solved' | 'mechanism' {
  const oracle = solveOracle(spec);
  const engine = solveFrame(toModel(spec));
  if (oracle === null) {
    expect(engine.ok, `${label}: the oracle says mechanism, the engine solved it`).toBe(false);
    if (!engine.ok) expect(engine.issues.some((i) => i.code === 'mechanism' || i.code === 'unrestrained' || i.code === 'few-supports'), `${label}: ${JSON.stringify(engine.issues)}`).toBe(true);
    return 'mechanism';
  }
  if (!engine.ok) throw new Error(`${label}: the oracle solved it, the engine said ${JSON.stringify(engine.issues)}`);
  const scale = Math.max(engine.equilibrium.scale, 1e-9);
  const size = engine.equilibrium.size;
  const f = scale * tol;
  const m = scale * size * tol;
  engine.reactions.forEach((r, k) => {
    expect(Math.abs(r.rx - oracle.reactions[k].rx), `${label} reaction ${k} rx`).toBeLessThanOrEqual(f);
    expect(Math.abs(r.ry - oracle.reactions[k].ry), `${label} reaction ${k} ry`).toBeLessThanOrEqual(f);
    expect(Math.abs(r.rm - oracle.reactions[k].rm), `${label} reaction ${k} rm`).toBeLessThanOrEqual(m);
  });
  let big = 0;
  for (const v of oracle.u) big = Math.max(big, Math.abs(v));
  engine.displacements!.forEach((d, k) => {
    expect(Math.abs(d.ux - oracle.u[3 * k]), `${label} ux ${k}`).toBeLessThanOrEqual(tol * big + 1e-14);
    expect(Math.abs(d.uy - oracle.u[3 * k + 1]), `${label} uy ${k}`).toBeLessThanOrEqual(tol * big + 1e-14);
    if (d.rotation !== null) expect(Math.abs(d.rotation - oracle.u[3 * k + 2]), `${label} rot ${k}`).toBeLessThanOrEqual(tol * Math.max(big / size, 1e-9) + 1e-14);
  });
  engine.members.forEach((mem, mi) => {
    mem.forces.forEach((v, k) => expect(Math.abs(v - oracle.forces[mi][k]), `${label} member ${mi} force ${k}`).toBeLessThanOrEqual(k % 3 === 2 ? m : f));
    const L = mem.length;
    const xs = [0, 0.25, 0.37, 0.5, 0.75, 1].map((t) => t * L);
    for (const bp of mem.pieces) xs.push(bp.x0, bp.x1);
    for (const x of xs) {
      for (const side of ['left', 'right'] as const) {
        if ((side === 'left' && x <= 0) || (side === 'right' && x >= L)) continue;
        const a = pieceAt(mem.pieces, x, side);
        const b = oracle.at(mi, x, side);
        expect(Math.abs(a.N - b.N), `${label} member ${mi} N(${x},${side})`).toBeLessThanOrEqual(f);
        expect(Math.abs(a.V - b.V), `${label} member ${mi} V(${x},${side})`).toBeLessThanOrEqual(f);
        expect(Math.abs(a.M - b.M), `${label} member ${mi} M(${x},${side})`).toBeLessThanOrEqual(m);
      }
    }
    // The deflected shape, by the oracle's own double integral of its own moment.
    if (!spec.members[mi].rs) {
      let top = 1e-12;
      for (const v of oracle.u) top = Math.max(top, Math.abs(v));
      for (const t of [0.2, 0.45, 0.7, 1]) {
        const x = t * L;
        const got = pieceAt(mem.pieces, x, t === 1 ? 'left' : 'right').v!;
        const want = oracleV(spec, oracle, mi, x);
        expect(Math.abs(got - want), `${label} member ${mi} v(${x})`).toBeLessThanOrEqual(tol * top + 1e-12);
      }
    }
    // The reported extremes are values of the exact diagram, and nothing sampled exceeds them.
    for (const key of ['M', 'V', 'N'] as const) {
      const hi = mem.maxima[key].max;
      const lo = mem.maxima[key].min;
      const tol = key === 'M' ? m : f;
      const exact = (x: number) => oracle.at(mi, Math.min(Math.max(x, 0), L), x >= L ? 'left' : 'right')[key];
      // At a jump the extreme is the value on one of its sides.
      const either = (x: number, v: number) => {
        const xx = Math.min(Math.max(x, 0), L);
        const sides = [xx < L ? oracle.at(mi, xx, 'right')[key] : NaN, xx > 0 ? oracle.at(mi, xx, 'left')[key] : NaN];
        return Math.min(...sides.map((s) => (Number.isNaN(s) ? Infinity : Math.abs(s - v))));
      };
      expect(either(hi.x, hi.value), `${label} ${key} max value`).toBeLessThanOrEqual(tol);
      expect(either(lo.x, lo.value), `${label} ${key} min value`).toBeLessThanOrEqual(tol);
      for (let t = 0; t <= 12; t++) {
        const v = exact((t / 12) * L);
        expect(v, `${label} ${key} sample above max`).toBeLessThanOrEqual(hi.value + tol);
        expect(v, `${label} ${key} sample below min`).toBeGreaterThanOrEqual(lo.value - tol);
      }
    }
  });
  expect(Math.abs(oracle.residual.fx), `${label} oracle ΣFx`).toBeLessThanOrEqual(1e-9 * scale + 1e-12);
  return 'solved';
}

