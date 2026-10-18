import { afterEach, describe, expect, it, vi } from 'vitest';
import { solveFrame } from '../frame/engine';
import type { FrameMemberLoad, FrameModel, FrameSupport } from '../frame/types';
import { solveTruss } from '../truss/engine';
import type { TrussModel, TrussSupport } from '../truss/types';
import { solve } from './engine';
import { emptyStiffness, reduce, toEngine } from './model';
import { randomSpec, stableSpec, toModel, type OSpec } from './oracle.testlib';
import { TEMPLATE_IDS } from './templates';

vi.setConfig({ testTimeout: 120_000 });
afterEach(() => new Promise((r) => setTimeout(r, 0)));
const yieldNow = () => new Promise((r) => setTimeout(r, 0));

/**
 * THE TWO OTHER ENGINES OF THE SITE, on the same models (test files only: this library imports neither). The truss calculator's and the plane frame
 * calculator's engines are written differently (they eliminate the supports, use LU with refinement, find the stability by a Cholesky of a matrix of
 * deformations), and they must agree with this one, number for number: the displacements, the reactions, the member forces — and on which structures are
 * mechanisms.
 */

function trussModel(spec: OSpec): TrussModel | null {
  const supports: TrussSupport[] = [];
  for (const s of spec.supports) {
    if (s.dx || s.dy) return null; // (the truss calculator has no settlements)
    if (s.ux && s.uy) supports.push({ node: s.node, kind: 'pin' });
    else if (s.uy) supports.push({ node: s.node, kind: 'roller', angle: 90 });
    else if (s.ux) supports.push({ node: s.node, kind: 'roller', angle: 0 });
    else return null;
  }
  return { nodes: spec.nodes.map((n) => ({ ...n })), members: spec.members.map((m) => ({ i: m.i, j: m.j, E: m.E, A: m.A })), supports, loads: spec.loads.map((l) => ({ node: l.node, fx: l.fx, fy: l.fy })) };
}

function frameModel(spec: OSpec): FrameModel | null {
  const supports: FrameSupport[] = [];
  for (const s of spec.supports) {
    const settle = { ...(s.dx ? { dx: s.dx } : {}), ...(s.dy ? { dy: s.dy } : {}), ...(s.dr ? { dr: s.dr } : {}) };
    if (s.ux && s.uy && s.rz) supports.push({ node: s.node, kind: 'fixed', ...settle });
    else if (s.ux && s.uy) supports.push({ node: s.node, kind: 'pin', ...settle });
    else if (s.uy && !s.ux && !s.rz) supports.push({ node: s.node, kind: 'roller', angle: 90, ...settle });
    else if (s.ux && !s.uy && !s.rz) supports.push({ node: s.node, kind: 'roller', angle: 0, ...settle });
    else if (s.uy && s.rz && !s.ux) supports.push({ node: s.node, kind: 'guide', angle: 90, ...settle });
    else if (s.ux && s.rz && !s.uy) supports.push({ node: s.node, kind: 'guide', angle: 0, ...settle });
    else return null;
  }
  const memberLoads: FrameMemberLoad[] = spec.memberLoads.map((l) =>
    l.kind === 'udl' ? { kind: 'udl', member: l.member, dir: 'local-y', w: l.w } : l.kind === 'point' ? { kind: 'point', member: l.member, dir: 'local-y', a: l.a, P: l.P } : { kind: 'udl', member: l.member, dir: 'local-x', w: l.q },
  );
  return { nodes: spec.nodes.map((n) => ({ ...n })), members: spec.members.map((m) => ({ i: m.i, j: m.j, E: m.E, A: m.A, I: m.I })), supports, loads: spec.loads.map((l) => ({ ...l })), memberLoads };
}

describe('against the truss calculator', () => {
  it('bar forces, reactions and displacements agree on the trusses both solve, and so does which are mechanisms', async () => {
    let both = 0;
    let neither = 0;
    for (let seed = 1; seed <= 400; seed++) {
      if (seed % 50 === 0) await yieldNow();
      const spec = randomSpec(seed, { mode: 'truss', extra: 0.6 });
      const theirs = trussModel(spec);
      if (!theirs) continue;
      const mine = solve(toModel(spec));
      const other = solveTruss(theirs);
      expect(mine.ok, `#${seed}: mine ${mine.ok ? 'solves' : JSON.stringify(mine.issues.map((i) => i.code))}, theirs ${other.ok ? 'solves' : JSON.stringify(other.issues.map((i) => i.code))}`).toBe(other.ok);
      if (!mine.ok || !other.ok) {
        neither++;
        continue;
      }
      both++;
      const force = Math.max(1e-300, ...other.members.map((m) => Math.abs(m.N)), ...other.reactions.map((r) => Math.hypot(r.rx, r.ry)));
      other.members.forEach((m, k) => expect(Math.abs(mine.forces[k].bar!.N - m.N), `#${seed} bar ${k + 1}`).toBeLessThanOrEqual(1e-8 * force));
      other.members.forEach((m, k) => {
        if (m.elongation !== null) expect(Math.abs(mine.forces[k].bar!.elongation - m.elongation)).toBeLessThanOrEqual(1e-8 * Math.max(1e-300, ...other.displacements!.map((d) => d.magnitude)));
        if (m.stress !== null) expect(Math.abs(mine.forces[k].bar!.stress - m.stress)).toBeLessThanOrEqual(1e-8 * Math.max(1e-300, ...other.members.map((x) => Math.abs(x.stress ?? 0))));
      });
      other.reactions.forEach((r) => {
        const node = r.node;
        const rx = mine.reactions.find((x) => x.node === node + 1 && x.kind === 'x');
        const ry = mine.reactions.find((x) => x.node === node + 1 && x.kind === 'y');
        expect(Math.abs((rx?.value ?? 0) - r.rx), `#${seed} reaction x at ${node + 1}`).toBeLessThanOrEqual(1e-8 * force);
        expect(Math.abs((ry?.value ?? 0) - r.ry), `#${seed} reaction y at ${node + 1}`).toBeLessThanOrEqual(1e-8 * force);
      });
      const top = Math.max(1e-300, ...other.displacements!.map((d) => d.magnitude));
      other.displacements!.forEach((d) => {
        expect(Math.abs(mine.u[2 * d.node] - d.ux), `#${seed} ux ${d.node + 1}`).toBeLessThanOrEqual(1e-8 * top);
        expect(Math.abs(mine.u[2 * d.node + 1] - d.uy), `#${seed} uy ${d.node + 1}`).toBeLessThanOrEqual(1e-8 * top);
      });
    }
    expect(both).toBeGreaterThan(60);
    expect(neither).toBeGreaterThan(60);
  });
  it('the three truss templates, in both systems', () => {
    for (const template of ['truss-two-bar', 'truss-three-bar', 'truss-five-member'] as const) {
      for (const units of ['us', 'si'] as const) {
        const form = reduce(emptyStiffness(units), { type: 'template', template });
        const { model } = toEngine(form);
        const mine = solve(model);
        const theirs: TrussModel = {
          nodes: model.nodes,
          members: model.members.map((m) => ({ i: m.i, j: m.j })),
          supports: model.supports.map((s) => (s.ux && s.uy ? { node: s.node, kind: 'pin' as const } : { node: s.node, kind: 'roller' as const, angle: 90 })),
          loads: model.loads.map((l) => ({ node: l.node, fx: l.fx, fy: l.fy })),
          E: model.E,
          A: model.A,
        };
        const other = solveTruss(theirs);
        if (!mine.ok || !other.ok) throw new Error('not solved');
        other.members.forEach((m, k) => expect(mine.forces[k].bar!.N).toBeCloseTo(m.N, 9));
      }
    }
  });
});

describe('against the plane frame calculator', () => {
  it('end forces, reactions and displacements agree on the frames both solve (member loads, settlements, rollers and guides), and so does which are mechanisms', async () => {
    let both = 0;
    let neither = 0;
    for (let seed = 1; seed <= 500; seed++) {
      if (seed % 50 === 0) await yieldNow();
      const spec = seed % 2 === 0 ? stableSpec(seed, { mode: 'frame', settlements: seed % 4 === 0 }) : randomSpec(seed, { mode: 'frame', settlements: true });
      const theirs = frameModel(spec);
      if (!theirs) continue;
      const mine = solve(toModel(spec));
      const other = solveFrame(theirs);
      expect(mine.ok, `#${seed}: mine ${mine.ok ? 'solves' : JSON.stringify(mine.issues.map((i) => i.code))}, theirs ${other.ok ? 'solves' : JSON.stringify(other.issues.map((i) => i.code))}`).toBe(other.ok);
      if (!mine.ok || !other.ok) {
        neither++;
        continue;
      }
      both++;
      const size = other.equilibrium.size;
      const force = Math.max(1e-300, other.equilibrium.scale);
      other.members.forEach((m, k) => {
        m.forces.forEach((v, q) => {
          const unit = q % 3 === 2 ? size : 1;
          expect(Math.abs(mine.forces[k].f[q] - v), `#${seed} member ${k + 1} force ${q}`).toBeLessThanOrEqual(1e-8 * force * unit);
        });
        // the internal forces just inside the ends
        expect(Math.abs(mine.forces[k].start.N - m.start.N)).toBeLessThanOrEqual(1e-8 * force);
        expect(Math.abs(mine.forces[k].start.V - m.start.V)).toBeLessThanOrEqual(1e-8 * force);
        expect(Math.abs(mine.forces[k].start.M - m.start.M)).toBeLessThanOrEqual(1e-8 * force * size);
        expect(Math.abs(mine.forces[k].end.N - m.end.N)).toBeLessThanOrEqual(1e-8 * force);
        expect(Math.abs(mine.forces[k].end.V - m.end.V)).toBeLessThanOrEqual(1e-8 * force);
        expect(Math.abs(mine.forces[k].end.M - m.end.M)).toBeLessThanOrEqual(1e-8 * force * size);
      });
      other.reactions.forEach((r) => {
        const get = (kind: 'x' | 'y' | 'θ') => mine.reactions.find((x) => x.node === r.node + 1 && x.kind === kind)?.value ?? 0;
        expect(Math.abs(get('x') - r.rx), `#${seed} Rx at ${r.node + 1}`).toBeLessThanOrEqual(1e-8 * force);
        expect(Math.abs(get('y') - r.ry), `#${seed} Ry at ${r.node + 1}`).toBeLessThanOrEqual(1e-8 * force);
        expect(Math.abs(get('θ') - r.rm), `#${seed} M at ${r.node + 1}`).toBeLessThanOrEqual(1e-8 * force * size);
      });
      const top = Math.max(1e-300, ...other.displacements!.map((d) => d.magnitude));
      // (a rotation is measured against the displacements over the size of the frame when it is itself only rounding)
      const topRot = Math.max(1e-300, top / size, ...other.displacements!.map((d) => Math.abs(d.rotation ?? 0)));
      other.displacements!.forEach((d) => {
        expect(Math.abs(mine.u[3 * d.node] - d.ux), `#${seed} ux ${d.node + 1}`).toBeLessThanOrEqual(1e-8 * top);
        expect(Math.abs(mine.u[3 * d.node + 1] - d.uy)).toBeLessThanOrEqual(1e-8 * top);
        expect(Math.abs(mine.u[3 * d.node + 2] - (d.rotation ?? 0))).toBeLessThanOrEqual(1e-8 * topRot);
      });
    }
    expect(both).toBeGreaterThan(150);
    expect(neither).toBeGreaterThan(20);
  });
  it('the four frame templates, in both systems', () => {
    for (const template of ['frame-propped', 'frame-l', 'frame-portal', 'frame-fixed-point'] as const) {
      for (const units of ['us', 'si'] as const) {
        const form = reduce(emptyStiffness(units), { type: 'template', template });
        const { model } = toEngine(form);
        const mine = solve(model);
        const theirs = frameModel({ mode: 'frame', nodes: model.nodes, members: model.members.map((m) => ({ i: m.i, j: m.j, E: model.E!, A: model.A!, I: model.I! })), supports: model.supports, loads: model.loads, memberLoads: model.memberLoads });
        const other = solveFrame(theirs!);
        if (!mine.ok || !other.ok) throw new Error(`${template} ${units}`);
        other.members.forEach((m, k) => m.forces.forEach((v, q) => expect(Math.abs(mine.forces[k].f[q] - v), `${template} ${units}`).toBeLessThanOrEqual(1e-9 * Math.max(...m.forces.map(Math.abs), 1))));
      }
    }
  });
});

describe('the template list', () => {
  it('has seven problems, a truss three and a frame four', () => {
    expect(TEMPLATE_IDS).toEqual(['truss-two-bar', 'truss-three-bar', 'truss-five-member', 'frame-propped', 'frame-l', 'frame-portal', 'frame-fixed-point']);
  });
});
