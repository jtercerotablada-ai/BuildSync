import { describe, expect, it } from 'vitest';
import { analyseSafely } from './analysis';
import { ISSUE_CODES, WARNING_CODES } from './codes';
import { exactSolve } from './bigoracle.testlib';
import { illConditioned, solve } from './engine';
import { emptyStiffness, reduce, toEngine, type StiffnessForm } from './model';
import type { Check, Issue, IssueCode, StiffnessModel, WarningCode } from './types';

/**
 * EVERY DIAGNOSTIC HAS A TEST. A fault is a stable code with the numbers the sentence needs; nothing throws, nothing is NaN or Infinity. The codes are listed
 * in codes.ts (checked at compile time to hold every member of the unions); the last test of this file holds this file to having produced each of them.
 */

const seen = new Set<IssueCode>();
const seenWarnings = new Set<WarningCode>();

const bar = (over: Partial<StiffnessModel> = {}): StiffnessModel => ({
  mode: 'truss',
  nodes: [{ x: 0, y: 0 }, { x: 4, y: 3 }, { x: 8, y: 0 }],
  members: [{ i: 0, j: 1 }, { i: 2, j: 1 }],
  supports: [{ node: 0, ux: true, uy: true, rz: false }, { node: 2, ux: true, uy: true, rz: false }],
  loads: [{ node: 1, fx: 5, fy: -10, m: 0 }],
  memberLoads: [],
  E: 1000,
  A: 2,
  ...over,
});
const beam = (over: Partial<StiffnessModel> = {}): StiffnessModel => ({
  mode: 'frame',
  nodes: [{ x: 0, y: 0 }, { x: 10, y: 0 }],
  members: [{ i: 0, j: 1 }],
  supports: [{ node: 0, ux: true, uy: true, rz: true }, { node: 1, ux: false, uy: true, rz: false }],
  loads: [],
  memberLoads: [{ kind: 'udl', member: 0, w: -1 }],
  E: 1000,
  A: 10,
  I: 100,
  ...over,
});
function issues(m: StiffnessModel): Issue[] {
  const out = solve(m);
  if (out.ok) return [];
  out.issues.forEach((i) => seen.add(i.code));
  return out.issues;
}
function one(m: StiffnessModel, code: IssueCode): Issue {
  const found = issues(m).filter((i) => i.code === code);
  expect(found.length, `${code} in ${JSON.stringify(issues(m))}`).toBeGreaterThan(0);
  return found[0];
}
function warnings(m: StiffnessModel) {
  const out = solve(m);
  if (!out.ok) throw new Error(JSON.stringify(out.issues));
  out.warnings.forEach((w) => seenWarnings.add(w.code));
  return out.warnings;
}

describe('the model is whole', () => {
  it("'mode': neither truss nor frame", () => {
    expect(issues({ ...bar(), mode: 'wing' as never })).toEqual([{ code: 'mode' }]);
    expect(issues(undefined as never)).toEqual([{ code: 'stopped' }]);
    expect(issues(null as never)).toEqual([{ code: 'stopped' }]);
  });
  it("'few-nodes' and 'no-members' carry the count", () => {
    expect(issues(bar({ nodes: [{ x: 0, y: 0 }], members: [], supports: [], loads: [] }))).toEqual([{ code: 'few-nodes', count: 1 }, { code: 'no-members' }]);
    expect(issues(bar({ members: [] }))).toEqual([{ code: 'no-members' }]);
    expect(issues({ ...bar(), nodes: undefined as never })).toContainEqual({ code: 'few-nodes', count: 0 });
  });
  it("'too-big' names the list, how many there are and the cap", () => {
    const nodes = Array.from({ length: 13 }, (_, k) => ({ x: k, y: 0 }));
    expect(issues(bar({ nodes }))).toContainEqual({ code: 'too-big', list: 'nodes', count: 13, max: 12 });
    expect(issues(bar({ members: Array.from({ length: 21 }, () => ({ i: 0, j: 1 })) }))).toContainEqual({ code: 'too-big', list: 'members', count: 21, max: 20 });
    expect(issues(bar({ supports: Array.from({ length: 13 }, () => ({ node: 0, ux: true, uy: true, rz: false })) }))).toContainEqual({ code: 'too-big', list: 'supports', count: 13, max: 12 });
    expect(issues(bar({ loads: Array.from({ length: 41 }, () => ({ node: 1, fx: 1, fy: 1, m: 0 })) }))).toContainEqual({ code: 'too-big', list: 'loads', count: 41, max: 40 });
    expect(issues(beam({ memberLoads: Array.from({ length: 25 }, () => ({ kind: 'udl' as const, member: 0, w: 1 })) }))).toContainEqual({ code: 'too-big', list: 'memberLoads', count: 25, max: 24 });
    // exactly at the cap is fine
    expect(issues(beam({ memberLoads: Array.from({ length: 24 }, () => ({ kind: 'udl' as const, member: 0, w: 1 })) }))).toEqual([]);
    // a truss does not use its member loads, so it does not count them
    expect(issues(bar({ memberLoads: Array.from({ length: 30 }, () => ({ kind: 'udl' as const, member: 0, w: 1 })) }))).toEqual([]);
  });
  it("'number' names the list, the row and the field: a coordinate, a load, a position, a settlement", () => {
    for (const bad of [Number.NaN, Infinity, -Infinity, 1e31, -1e31, 1e39, 1e300]) {
      expect(one(bar({ nodes: [{ x: bad, y: 0 }, { x: 4, y: 3 }, { x: 8, y: 0 }] }), 'number').where).toEqual({ list: 'nodes', index: 0, field: 'x' });
      expect(one(bar({ nodes: [{ x: 0, y: 0 }, { x: 4, y: bad }, { x: 8, y: 0 }] }), 'number').where).toEqual({ list: 'nodes', index: 1, field: 'y' });
      expect(one(bar({ loads: [{ node: 1, fx: bad, fy: 0, m: 0 }] }), 'number').where).toEqual({ list: 'loads', index: 0, field: 'fx' });
    }
    expect(one(bar({ supports: [{ node: 0, ux: true, uy: true, rz: false, dy: Number.NaN }, { node: 2, ux: true, uy: true, rz: false }] }), 'number').where).toEqual({ list: 'supports', index: 0, field: 'dy' });
    expect(one(beam({ supports: [{ node: 0, ux: true, uy: true, rz: true, dr: Infinity }] }), 'number').where).toEqual({ list: 'supports', index: 0, field: 'dr' });
    expect(one(beam({ memberLoads: [{ kind: 'udl', member: 0, w: Number.NaN }] }), 'number').where).toEqual({ list: 'memberLoads', index: 0, field: 'w' });
    expect(one(beam({ memberLoads: [{ kind: 'point', member: 0, a: Number.NaN, P: 1 }] }), 'number').where).toEqual({ list: 'memberLoads', index: 0, field: 'a' });
    expect(one(beam({ memberLoads: [{ kind: 'axial', member: 0, q: 1e32 }] }), 'number').where).toEqual({ list: 'memberLoads', index: 0, field: 'q' });
    // a moment on a node is a number in frame mode
    expect(one(beam({ loads: [{ node: 1, fx: 0, fy: 0, m: Number.NaN }] }), 'number').where).toEqual({ list: 'loads', index: 0, field: 'm' });
  });
  it("'section': E, A or I given and not a finite number in [1e-30, 1e30], the structure's or a member's", () => {
    for (const bad of [0, -1, Number.NaN, Infinity, 1e31, 1e-31]) {
      expect(one(bar({ E: bad }), 'section').where).toEqual({ list: 'model', index: 0, field: 'E' });
      expect(one(bar({ A: bad }), 'section').where).toEqual({ list: 'model', index: 0, field: 'A' });
      expect(one(beam({ I: bad }), 'section').where).toEqual({ list: 'model', index: 0, field: 'I' });
      expect(one(bar({ members: [{ i: 0, j: 1, E: bad }, { i: 2, j: 1 }] }), 'section').where).toEqual({ list: 'members', index: 0, field: 'E' });
      expect(one(bar({ members: [{ i: 0, j: 1 }, { i: 2, j: 1, A: bad }] }), 'section').where).toEqual({ list: 'members', index: 1, field: 'A' });
      expect(one(beam({ members: [{ i: 0, j: 1, I: bad }] }), 'section').where).toEqual({ list: 'members', index: 0, field: 'I' });
    }
    // the limits themselves are fine
    expect(issues(bar({ E: 1e-30, A: 1e30 }))).not.toContainEqual(expect.objectContaining({ code: 'section' }));
    // an I that is not good is nothing to a truss
    expect(issues(bar({ I: -5, members: [{ i: 0, j: 1, I: Number.NaN }, { i: 2, j: 1 }] }))).toEqual([]);
  });
  it("'section-missing': a member has no E, no A, or in frame mode no I; a truss never asks for I", () => {
    expect(one(bar({ E: undefined }), 'section-missing').where).toEqual({ list: 'members', index: 0, field: 'E' });
    expect(issues(bar({ A: undefined })).filter((i) => i.code === 'section-missing').map((i) => [i.members, i.where!.field])).toEqual([[[1], 'A'], [[2], 'A']]);
    expect(one(beam({ I: undefined }), 'section-missing')).toMatchObject({ members: [1], where: { list: 'members', index: 0, field: 'I' } });
    expect(issues(bar({ I: undefined }))).toEqual([]);
    // a member's own value covers the missing one; null is "not given"
    expect(issues(bar({ E: undefined, members: [{ i: 0, j: 1, E: 100 }, { i: 2, j: 1, E: 100 }] }))).toEqual([]);
    expect(issues(bar({ E: null as never }))).toContainEqual(expect.objectContaining({ code: 'section-missing' }));
  });
  it("'member-node': i or j that is not the index of a node", () => {
    for (const bad of [3, -1, 1.5, Number.NaN, undefined as never, 'a' as never]) {
      expect(one(bar({ members: [{ i: bad, j: 1 }, { i: 2, j: 1 }] }), 'member-node').where).toEqual({ list: 'members', index: 0, field: 'i' });
      expect(one(bar({ members: [{ i: 0, j: 1 }, { i: 2, j: bad }] }), 'member-node').where).toEqual({ list: 'members', index: 1, field: 'j' });
    }
  });
  it("'load-node', 'support-node', 'load-member', 'load-kind'", () => {
    expect(one(bar({ loads: [{ node: 7, fx: 1, fy: 1, m: 0 }] }), 'load-node').where).toEqual({ list: 'loads', index: 0, field: 'node' });
    expect(one(bar({ supports: [{ node: -1, ux: true, uy: true, rz: false }] }), 'support-node').where).toEqual({ list: 'supports', index: 0, field: 'node' });
    expect(one(beam({ memberLoads: [{ kind: 'udl', member: 4, w: 1 }] }), 'load-member').where).toEqual({ list: 'memberLoads', index: 0, field: 'member' });
    expect(one(beam({ memberLoads: [{ kind: 'moment', member: 0, M: 1 } as never] }), 'load-kind').where).toEqual({ list: 'memberLoads', index: 0, field: 'kind' });
    expect(one(beam({ memberLoads: [{ member: 0, w: 1 } as never] }), 'load-kind').where).toEqual({ list: 'memberLoads', index: 0, field: 'kind' });
  });
  it("'load-position': a point load not strictly inside its member, with the member's length", () => {
    for (const a of [0, 10, -1, 11, 1e-30 * 0 - 0]) {
      expect(one(beam({ memberLoads: [{ kind: 'point', member: 0, a, P: 5 }] }), 'load-position')).toEqual({ code: 'load-position', where: { list: 'memberLoads', index: 0, field: 'a' }, length: 10 });
    }
    expect(issues(beam({ memberLoads: [{ kind: 'point', member: 0, a: 1e-9, P: 5 }] }))).toEqual([]);
    expect(issues(beam({ memberLoads: [{ kind: 'point', member: 0, a: 10 - 1e-9, P: 5 }] }))).toEqual([]);
  });
});

describe('the geometry', () => {
  it("'zero-length': a member from a node to itself", () => {
    expect(one(bar({ members: [{ i: 0, j: 1 }, { i: 1, j: 1 }] }), 'zero-length')).toEqual({ code: 'zero-length', where: { list: 'members', index: 1 }, members: [2] });
  });
  it("'duplicate-node': nodes at one place are one group, with the distance and the size", () => {
    const i = one(bar({ nodes: [{ x: 0, y: 0 }, { x: 4, y: 3 }, { x: 0, y: 0 }] }), 'duplicate-node');
    expect(i).toEqual({ code: 'duplicate-node', nodes: [1, 3], distance: 0, size: 5 });
    // three at one place: one issue
    const three = issues(bar({ nodes: [{ x: 4, y: 3 }, { x: 4, y: 3 }, { x: 4, y: 3 }, { x: 0, y: 0 }], members: [{ i: 0, j: 3 }], supports: [{ node: 3, ux: true, uy: true, rz: true }], loads: [] })).filter((x) => x.code === 'duplicate-node');
    expect(three).toEqual([{ code: 'duplicate-node', nodes: [1, 2, 3], distance: 0, size: 5 }]);
    // closer than a billionth of the structure: not at one place, but too near to tell apart
    const near = one(bar({ nodes: [{ x: 0, y: 0 }, { x: 4e9, y: 3e9 }, { x: 8e9, y: 0 }, { x: 1, y: 0 }], members: [{ i: 0, j: 1 }, { i: 2, j: 1 }, { i: 3, j: 1 }], supports: [{ node: 0, ux: true, uy: true, rz: false }, { node: 2, ux: true, uy: true, rz: false }], loads: [] }), 'duplicate-node');
    expect(near.nodes).toEqual([1, 4]);
    expect(near.distance).toBe(1);
    expect(near.size).toBeCloseTo(Math.hypot(8e9, 3e9), 3);
    // 1e17 beside a unit structure
    expect(issues(bar({ nodes: [{ x: 0, y: 0 }, { x: 4, y: 3 }, { x: 1e17, y: 0 }] })).map((x) => x.code)).toContain('duplicate-node');
  });
  it("'short-member': a member shorter than a hundred-thousandth of the structure", () => {
    const i = one(bar({ nodes: [{ x: 0, y: 0 }, { x: 4, y: 3 }, { x: 8, y: 0 }, { x: 4, y: 3.00001 }], members: [{ i: 0, j: 1 }, { i: 2, j: 1 }, { i: 1, j: 3 }] }), 'short-member');
    expect(i.where).toEqual({ list: 'members', index: 2 });
    expect(i.members).toEqual([3]);
    expect(i.length).toBeCloseTo(1e-5, 12);
    expect(i.size).toBeCloseTo(Math.hypot(8, 3.00001), 9);
    // twice as long as that is fine
    expect(issues(bar({ nodes: [{ x: 0, y: 0 }, { x: 4, y: 3 }, { x: 8, y: 0 }, { x: 4, y: 3.0001 }], members: [{ i: 0, j: 1 }, { i: 2, j: 1 }, { i: 1, j: 3 }] })).map((x) => x.code)).not.toContain('short-member');
  });
  it("'duplicate-member': two members on one pair of nodes, whichever way round", () => {
    expect(one(bar({ members: [{ i: 0, j: 1 }, { i: 2, j: 1 }, { i: 1, j: 0 }] }), 'duplicate-member')).toEqual({ code: 'duplicate-member', where: { list: 'members', index: 2 }, members: [1, 3] });
  });
  it("'node-unconnected': a node with no member", () => {
    expect(one(bar({ nodes: [...bar().nodes, { x: 20, y: 20 }] }), 'node-unconnected')).toEqual({ code: 'node-unconnected', nodes: [4] });
  });
  it("'disconnected': separate pieces, each with its nodes", () => {
    const m = bar({ nodes: [...bar().nodes, { x: 20, y: 20 }, { x: 30, y: 20 }], members: [...bar().members, { i: 3, j: 4 }] });
    expect(one(m, 'disconnected')).toEqual({ code: 'disconnected', groups: [[1, 2, 3], [4, 5]] });
  });
  it("'duplicate-support': a second support at a node, 'few-supports' alone", () => {
    expect(one(bar({ supports: [...bar().supports, { node: 0, ux: true, uy: false, rz: false }] }), 'duplicate-support')).toEqual({ code: 'duplicate-support', where: { list: 'supports', index: 2 }, nodes: [1] });
    expect(issues(bar({ supports: [{ node: 0, ux: true, uy: true, rz: false }] }))).toEqual([{ code: 'few-supports', count: 2 }]);
    expect(issues(bar({ supports: [] }))).toEqual([{ code: 'few-supports', count: 0 }]);
    // a rotation restraint counts in a frame and not in a truss
    expect(issues(bar({ supports: [{ node: 0, ux: true, uy: true, rz: true }] }))).toEqual([{ code: 'few-supports', count: 2 }]);
    expect(issues(beam({ supports: [{ node: 0, ux: true, uy: true, rz: false }] }))).toEqual([{ code: 'few-supports', count: 2 }]);
    expect(issues(beam({ supports: [{ node: 0, ux: true, uy: true, rz: true }] }))).toEqual([]);
  });
  it('several faults are reported together, each once', () => {
    const m = bar({
      nodes: [...bar().nodes, { x: 20, y: 20 }],
      members: [{ i: 0, j: 1 }, { i: 2, j: 1 }, { i: 1, j: 0 }, { i: 1, j: 1 }],
      loads: [{ node: 9, fx: 1, fy: 1, m: 0 }],
    });
    // (a load on a node that is not there is found before the geometry is looked at)
    expect(issues(m).map((x) => x.code)).toEqual(['load-node']);
    const g = bar({ nodes: [...bar().nodes, { x: 20, y: 20 }], members: [{ i: 0, j: 1 }, { i: 2, j: 1 }, { i: 1, j: 0 }, { i: 1, j: 1 }] });
    expect(issues(g).map((x) => x.code).sort()).toEqual(['duplicate-member', 'node-unconnected', 'zero-length']);
  });
});

describe('the stability', () => {
  it("'mechanism' of a whole that can move: a rigid-body motion, the DOF and the node of the zero pivot, the shape", () => {
    // a bar from (0, 0) to (10, 0), pinned at the first end and held in x only at the second: it can turn about the pin
    const m: StiffnessModel = {
      mode: 'truss',
      nodes: [{ x: 0, y: 0 }, { x: 10, y: 0 }],
      members: [{ i: 0, j: 1, E: 100, A: 1 }],
      supports: [{ node: 0, ux: true, uy: true, rz: false }, { node: 1, ux: true, uy: false, rz: false }],
      loads: [{ node: 1, fx: 0, fy: 5, m: 0 }],
      memberLoads: [],
    };
    const i = one(m, 'mechanism');
    expect(i).toMatchObject({ code: 'mechanism', dof: 4, node: 2, kind: 'rigid-body', nodes: [2], count: 1 });
    // (the pivot is exactly zero, and so is the rounding in it: there is no share to state)
    expect(i.ratio).toBeUndefined();
    expect(i.shape).toEqual([0, 0, 0, 1]);
  });
  it("'mechanism' of a sway: a rectangle of four bars has no diagonal, and the shape moves its free corners", () => {
    const m: StiffnessModel = {
      mode: 'truss',
      nodes: [{ x: 0, y: 0 }, { x: 4, y: 0 }, { x: 4, y: 3 }, { x: 0, y: 3 }],
      members: [{ i: 0, j: 1 }, { i: 1, j: 2 }, { i: 2, j: 3 }, { i: 3, j: 0 }],
      supports: [{ node: 0, ux: true, uy: true, rz: false }, { node: 1, ux: false, uy: true, rz: false }],
      loads: [{ node: 2, fx: 10, fy: 0, m: 0 }],
      memberLoads: [],
      E: 1000,
      A: 1,
    };
    const i = one(m, 'mechanism');
    expect(i.kind).toBe('sway');
    expect(i.count).toBe(1);
    expect(i.nodes!.length).toBeGreaterThanOrEqual(1);
    expect(i.shape).toHaveLength(8);
    expect(Math.max(...i.shape!.map(Math.abs))).toBeGreaterThan(0.5);
    // the null mode really is a motion with no bar changing length: each bar's elongation, to first order, is zero
    const u = i.shape!;
    const nodes = m.nodes;
    for (const b of m.members) {
      const dx = nodes[b.j].x - nodes[b.i].x;
      const dy = nodes[b.j].y - nodes[b.i].y;
      const L = Math.hypot(dx, dy);
      const e = (dx / L) * (u[2 * b.j] - u[2 * b.i]) + (dy / L) * (u[2 * b.j + 1] - u[2 * b.i + 1]);
      expect(Math.abs(e)).toBeLessThan(1e-9);
    }
    // two bars short of a diagonal: two independent motions
    const two = one({ ...m, members: [{ i: 0, j: 1 }, { i: 1, j: 2 }, { i: 2, j: 3 }] }, 'mechanism');
    expect(two.count).toBe(2);
  });
  it("'mechanism': a joint of two bars on one line, and a node with one bar, are swaying", () => {
    const line: StiffnessModel = {
      mode: 'truss',
      nodes: [{ x: 0, y: 0 }, { x: 5, y: 0 }, { x: 10, y: 0 }],
      members: [{ i: 0, j: 1 }, { i: 1, j: 2 }],
      supports: [{ node: 0, ux: true, uy: true, rz: false }, { node: 2, ux: true, uy: true, rz: false }],
      loads: [{ node: 1, fx: 0, fy: -1, m: 0 }],
      memberLoads: [],
      E: 100,
      A: 1,
    };
    expect(one(line, 'mechanism')).toMatchObject({ kind: 'sway', dof: 4, node: 2, nodes: [2] });
    const lone: StiffnessModel = { ...line, members: [{ i: 0, j: 1 }, { i: 1, j: 2 }], nodes: [{ x: 0, y: 0 }, { x: 5, y: 3 }, { x: 10, y: 6 }] };
    // (the three nodes are on one line again, tilted)
    expect(one(lone, 'mechanism').kind).toBe('sway');
  });
  it("'mechanism' in frame mode: three restrained DOFs that do not hold the structure", () => {
    // a beam held in x at both ends and in y at neither → three restrained DOFs, all along x: it can move in y and turn
    const m = beam({ supports: [{ node: 0, ux: true, uy: false, rz: false }, { node: 1, ux: true, uy: false, rz: true }], memberLoads: [] });
    const i = one(m, 'mechanism');
    expect(i.kind).toBe('rigid-body');
    expect(i.count).toBe(1);
    // the free DOFs are the y translations: 1y and 2y move together, 2θ is held, 1θ is free: two motions, as the stiffness says
    const w = beam({ supports: [{ node: 0, ux: true, uy: true, rz: false }, { node: 1, ux: true, uy: true, rz: false }, { node: 1, ux: true, uy: true, rz: true }].slice(0, 2), memberLoads: [] });
    expect(solve(w).ok).toBe(true);
  });
  it('a mechanism comes with the steps worked out up to the zero pivot', () => {
    const m: StiffnessModel = {
      mode: 'truss',
      nodes: [{ x: 0, y: 0 }, { x: 4, y: 0 }, { x: 4, y: 3 }, { x: 0, y: 3 }],
      members: [{ i: 0, j: 1 }, { i: 1, j: 2 }, { i: 2, j: 3 }, { i: 3, j: 0 }],
      supports: [{ node: 0, ux: true, uy: true, rz: false }, { node: 1, ux: false, uy: true, rz: false }],
      loads: [{ node: 2, fx: 10, fy: 0, m: 0 }],
      memberLoads: [],
      E: 1000,
      A: 1,
    };
    const out = solve(m);
    expect(out.ok).toBe(false);
    if (out.ok) return;
    const ids = out.steps.map((s) => s.id);
    expect(ids.slice(0, 3)).toEqual(['structure', 'geometry', 'geometry']);
    expect(ids).toContain('assembled');
    expect(ids).toContain('reduced');
    expect(ids).toContain('augmented');
    const last = out.steps[out.steps.length - 1];
    expect(last.id).toBe('forward-pass');
    expect(last.facts.singular).toBe(true);
    const aug = last.blocks.find((b) => b.type === 'matrix')!;
    expect(aug.type === 'matrix' && aug.highlights).toEqual([expect.objectContaining({ reason: 'zero-pivot' })]);
    // the page gets them settled, with the faults by row
    const a = analyseSafely(reduce(reduce(emptyStiffness(), { type: 'template', template: 'truss-five-member' }), { type: 'remove', list: 'members', id: 8 }));
    expect(a.issues.map((x) => x.code)).toContain('mechanism');
    expect(a.partial.length).toBeGreaterThan(8);
    expect(a.solution).toBeNull();
    expect(a.issues.find((x) => x.code === 'mechanism')!.dofLabel).toMatch(/^\d+[xy]$/);
  });
  it('a mechanism over 12 free DOFs has the steps up to the reduced equation and no passes', () => {
    // a chain of 8 nodes in a line, truss mode: every interior joint sways
    const nodes = Array.from({ length: 8 }, (_, k) => ({ x: k * 4, y: 0 }));
    const members = Array.from({ length: 7 }, (_, k) => ({ i: k, j: k + 1, E: 100, A: 1 }));
    const out = solve({ mode: 'truss', nodes, members, supports: [{ node: 0, ux: true, uy: true, rz: false }, { node: 7, ux: false, uy: true, rz: false }], loads: [], memberLoads: [] });
    expect(out.ok).toBe(false);
    if (out.ok) return;
    expect(out.steps.map((s) => s.id)).not.toContain('forward-pass');
    expect(out.steps[out.steps.length - 1].id).toBe('reduced');
    expect(out.issues[0]).toMatchObject({ code: 'mechanism', kind: 'sway' });
  });
  it("'ill-conditioned' is the safety net: a residual or a failed check beyond RESIDUAL, with the largest departure", () => {
    const ok: Check[] = [{ id: 'sum-fx', value: 1e-12, scale: 10, allowance: 0, ok: true }];
    expect(illConditioned(0, ok)).toBeNull();
    expect(illConditioned(1e-9, ok)).toBeNull();
    const bad = illConditioned(1e-3, ok)!;
    expect(bad).toEqual({ code: 'ill-conditioned', residual: 1e-3, limit: 1e-8 });
    const failed: Check[] = [{ id: 'joints', value: 5e-3, scale: 10, allowance: 0, ok: false }];
    expect(illConditioned(0, failed)).toEqual({ code: 'ill-conditioned', residual: 5e-4, limit: 1e-8 });
    expect(illConditioned(Number.NaN, ok)).toEqual({ code: 'ill-conditioned', residual: 1, limit: 1e-8 });
    seen.add('ill-conditioned');
    // and a structure that is nearly a mechanism is solved, and warned of (below)
  });
  it("'size': a number past what a double holds, from nodes so close together that a cube of their distance is zero", () => {
    const m = beam({ nodes: [{ x: 0, y: 0 }, { x: 1e-200, y: 0 }], supports: [{ node: 0, ux: true, uy: true, rz: true }], memberLoads: [] });
    const out = solve(m);
    expect(out.ok).toBe(false);
    if (!out.ok) {
      expect(out.issues).toEqual([{ code: 'size' }]);
      seen.add('size');
    }
  });
  it("'stopped': the arithmetic threw (here, a model that throws when it is read)", () => {
    const m = bar();
    Object.defineProperty(m, 'nodes', {
      get() {
        throw new Error('boom');
      },
    });
    const out = solve(m);
    expect(out).toEqual({ ok: false, issues: [{ code: 'stopped' }], steps: [] });
    seen.add('stopped');
  });
  it('whatever it is given, the engine neither throws nor returns a NaN: 3,000 models made of garbage', () => {
    const junk: unknown[] = [0, -1, 1e17, 1e39, Number.NaN, Infinity, null, undefined, 'x', {}, [], true, 3.5, -0, 1e-300, 1e300];
    let seed = 7;
    const r = () => {
      seed = (seed * 1664525 + 1013904223) >>> 0;
      return seed / 4294967296;
    };
    const pick = <T,>(xs: readonly T[]): T => xs[Math.floor(r() * xs.length)];
    for (let k = 0; k < 3000; k++) {
      const m = bar();
      const target = pick(['nodes', 'members', 'supports', 'loads', 'memberLoads', 'E', 'A', 'I', 'mode'] as const);
      const where = m[target] as unknown;
      if (Array.isArray(where) && where.length > 0 && r() < 0.8) {
        const row = where[Math.floor(r() * where.length)] as Record<string, unknown>;
        if (row && typeof row === 'object') {
          const field = pick(Object.keys(row));
          row[field] = pick(junk);
        } else where[Math.floor(r() * where.length)] = pick(junk);
      } else (m as unknown as Record<string, unknown>)[target] = pick(junk);
      m.mode = r() < 0.5 ? 'frame' : m.mode;
      const out = solve(m);
      const text = JSON.stringify(out, (_k, v) => (typeof v === 'number' && !Number.isFinite(v) ? '<<NONFINITE>>' : v));
      expect(text.includes('<<NONFINITE>>'), JSON.stringify(m)).toBe(false);
      if (!out.ok) out.issues.forEach((i) => seen.add(i.code));
    }
  });
});

describe('the warnings: a solution with a note', () => {
  it("'no-load': nothing loads the structure, and every result is zero", () => {
    const w = warnings(bar({ loads: [] }));
    expect(w).toEqual([{ code: 'no-load' }]);
    const zero = solve(bar({ loads: [{ node: 1, fx: 0, fy: 0, m: 0 }] }));
    expect(zero.ok && zero.warnings).toEqual([{ code: 'no-load' }]);
    if (zero.ok) {
      expect(zero.u.every((v) => v === 0)).toBe(true);
      expect(zero.reactions.every((r) => r.value === 0)).toBe(true);
      expect(zero.checks.every((c) => c.ok)).toBe(true);
    }
    // a settlement is a load
    expect(warnings(bar({ loads: [], supports: [{ node: 0, ux: true, uy: true, rz: false, dy: 0.01 }, { node: 2, ux: true, uy: true, rz: false }] }))).toEqual([]);
    // a member load is a load
    expect(warnings(beam())).toEqual([]);
    expect(warnings(beam({ memberLoads: [{ kind: 'udl', member: 0, w: 0 }] }))).toEqual([{ code: 'no-load' }]);
  });
  it("'member-loads-ignored': truss mode with member loads in the model", () => {
    expect(warnings(bar({ memberLoads: [{ kind: 'udl', member: 0, w: 3 }, { kind: 'axial', member: 1, q: 1 }] }))).toEqual([{ code: 'member-loads-ignored', count: 2 }]);
  });
  it("'settlement-ignored': a prescribed displacement on a DOF that is not restrained", () => {
    const w = warnings(beam({ supports: [{ node: 0, ux: true, uy: true, rz: true }, { node: 1, ux: false, uy: true, rz: false, dx: 0.5, dr: 0.1 }] }));
    expect(w).toContainEqual({ code: 'settlement-ignored', dofs: [4, 6] });
    // the value has no effect on the results
    const a = solve(beam({ supports: [{ node: 0, ux: true, uy: true, rz: true }, { node: 1, ux: false, uy: true, rz: false, dx: 0.5, dr: 0.1 }] }));
    const b = solve(beam());
    if (a.ok && b.ok) expect(a.u).toEqual(b.u);
    // a truss has no rotation to settle
    expect(warnings(bar({ supports: [{ node: 0, ux: true, uy: true, rz: false, dr: 3 }, { node: 2, ux: true, uy: true, rz: false }] }))).toEqual([]);
  });
  it("'empty-support': a support that restrains nothing", () => {
    const w = warnings(bar({ supports: [...bar().supports, { node: 1, ux: false, uy: false, rz: false }] }));
    expect(w).toEqual([{ code: 'empty-support', nodes: [2] }]);
    // in truss mode a rotation restraint alone restrains nothing
    expect(warnings(bar({ supports: [...bar().supports, { node: 1, ux: false, uy: false, rz: true }] }))).toEqual([{ code: 'empty-support', nodes: [2] }]);
  });
  it("'near-mechanism': solved, but the results are guaranteed to fewer than six figures: a joint almost on the line of its two bars, and a very stiff bar beside soft ones, and the figures are counted and true", () => {
    // two tilted bars with the free joint 1e-12 ft off their line: a pivot of 1e-26 of its diagonal, which thirty figures keep with a handful
    const tilted = (e: number): StiffnessModel => ({
      mode: 'truss',
      nodes: [{ x: 0, y: 0 }, { x: 20, y: 20 }, { x: 10 + e, y: 10 - e }],
      members: [{ i: 0, j: 2 }, { i: 1, j: 2 }],
      supports: [{ node: 0, ux: true, uy: true, rz: false }, { node: 1, ux: true, uy: true, rz: false }],
      loads: [{ node: 2, fx: 0, fy: -1, m: 0 }],
      memberLoads: [],
      E: 1000,
      A: 1,
    });
    const out = solve(tilted(1e-12));
    expect(out.ok).toBe(true);
    if (!out.ok) return;
    const w = out.warnings.find((x) => x.code === 'near-mechanism');
    expect(w).toBeDefined();
    expect(w!.ratio!).toBeGreaterThan(1e-6);
    expect(w!.ratio!).toBeLessThan(0.1);
    expect(w!.count).toBe(Math.floor(-Math.log10(w!.ratio!)));
    expect(w!.dofs).toHaveLength(1);
    expect(out.accuracy).toBe(w!.ratio);
    // the figures are true: the displacements are exact to the count
    const exact = exactSolve(tilted(1e-12));
    const error = Math.max(...out.u.map((v, d) => Math.abs(v - exact.u[d]))) / Math.max(...exact.u.map(Math.abs));
    expect(error).toBeLessThan(10 ** -w!.count!);
    seenWarnings.add('near-mechanism');
    // a bar of 10²⁵ in² beside ordinary ones (a rigid link a hundred thousand million million million times stiffer): thirty figures keep a few of the soft part, and the warning says how many
    const base = toEngine(reduce(emptyStiffness(), { type: 'template', template: 'truss-two-bar' })).model;
    const stiff = solve({ ...base, members: [{ ...base.members[0], A: 1e25 / 144 }, base.members[1]] });
    expect(stiff.ok && stiff.warnings.map((x) => x.code)).toContain('near-mechanism');
    // a bar of 10¹⁰ in² is imitated rigid and costs nothing: no figure is lost
    const rigid = solve({ ...base, members: [{ ...base.members[0], A: 1e10 / 144 }, base.members[1]] });
    expect(rigid.ok && rigid.warnings).toEqual([]);
    // the same bars with ordinary sections lose no figure
    expect(warnings(base)).toEqual([]);
  });
  it("'stiffness-range': a stable structure whose pivot is lost in rounding, even in thirty figures, is NOT a mechanism: a movement that strains a member, and the right words for it", () => {
    // the portal of the page with an area of 1e30 in² (the most an area may be): the sway of the beam is held by the columns' bending alone, 1e-30 of the axial stiffness around it
    const portal = reduce(emptyStiffness(), { type: 'template', template: 'frame-portal' });
    const huge = reduce(portal, { type: 'section', patch: { A: 1e30 } });
    const a = analyseSafely(huge);
    expect(a.issues.map((x) => x.code)).toEqual(['stiffness-range']);
    expect(a.issues[0]).toMatchObject({ code: 'stiffness-range', node: 4, dofLabel: '4x', nodes: [4] });
    seen.add('stiffness-range');
    // not unstable: the count of the portal says what it says, and a mechanism it is not
    expect(a.determinacy.word).toBeNull();
    expect(a.results).toBeNull();
    // the step that stopped it is marked and says why
    const last = a.partial[a.partial.length - 1];
    expect(last.id).toBe('forward-pass');
    expect(last.facts).toMatchObject({ singular: true, cause: 'range' });
    expect(last.facts.error as number).toBeGreaterThan(0);
    expect(last.formulas).toEqual([]);
    // the same area, thirty orders of magnitude down, is solved with no word: it is the range of the arithmetic that was reached, not the structure that is at fault
    expect(analyseSafely(reduce(portal, { type: 'section', patch: { A: 1e14 } })).issues).toEqual([]);
    // a real mechanism, by contrast, is a mechanism whatever the sections
    for (const A of [1e-3, 10, 1e14, 1e30]) {
      const m = solve({ mode: 'truss', nodes: [{ x: 0, y: 0 }, { x: 5, y: 0 }, { x: 10, y: 0 }], members: [{ i: 0, j: 1 }, { i: 1, j: 2 }], supports: [{ node: 0, ux: true, uy: true, rz: false }, { node: 2, ux: true, uy: true, rz: false }], loads: [{ node: 1, fx: 0, fy: -1, m: 0 }], memberLoads: [], E: 100, A });
      expect(m.ok, `A = ${A}`).toBe(false);
      if (!m.ok) expect(m.issues[0], `A = ${A}`).toMatchObject({ code: 'mechanism', dof: 4 });
    }
  });
  it("'large-displacements': first order only; a member whose chord turns by more than a tenth, and which one", () => {
    // the two-bar truss with its apex 0.001 ft off the line of the span: 10 kip down moves it thousands of its own length
    const flat = toEngine(reduce(emptyStiffness(), { type: 'template', template: 'truss-two-bar' })).model;
    const shallow = { ...flat, nodes: [flat.nodes[0], flat.nodes[1], { x: 8, y: 0.001 }] };
    const out = solve(shallow);
    expect(out.ok).toBe(true);
    if (!out.ok) return;
    const w = out.warnings.find((x) => x.code === 'large-displacements')!;
    expect(w).toBeDefined();
    expect(w.ratio!).toBeGreaterThan(0.1);
    expect([1, 2]).toContain(w.count);
    expect(w.nodes).toHaveLength(2);
    seenWarnings.add('large-displacements');
    // the ordinary one has none
    expect(warnings(flat).map((x) => x.code)).not.toContain('large-displacements');
  });
  it("'large-rotation' and 'large-stretch': first order only; an end that turns away from its chord, and a member that stretches, are told as such, and only they", () => {
    // a beam of 20 ft that a unit load a foot bends until its ends turn 165 rad (the chord does not turn at all: the supports are level)
    const beamModel = beam({ nodes: [{ x: 0, y: 0 }, { x: 20, y: 0 }], members: [{ i: 0, j: 1 }], supports: [{ node: 0, ux: true, uy: true, rz: false }, { node: 1, ux: false, uy: true, rz: false }], memberLoads: [{ kind: 'udl', member: 0, w: -1 }], E: 29000 * 144, A: 1, I: 0.01 / 20736 });
    const bent = solve(beamModel);
    expect(bent.ok).toBe(true);
    if (bent.ok) {
      const rotation = bent.warnings.find((x) => x.code === 'large-rotation')!;
      expect(rotation).toBeDefined();
      expect(rotation.count).toBe(1);
      expect(rotation.nodes).toEqual([1, 2]);
      expect(rotation.ratio!).toBeCloseTo(165.5, 0);
      expect(bent.warnings.map((x) => x.code)).not.toContain('large-displacements');
      expect(bent.warnings.map((x) => x.code)).not.toContain('large-stretch');
      seenWarnings.add('large-rotation');
    }
    // the same beam stiff enough that its ends turn a hundredth of a radian: nothing to say
    const stiffer = solve({ ...beamModel, I: 100 / 20736 });
    expect(stiffer.ok && stiffer.warnings).toEqual([]);
    // a cantilever whose tip turns 0.079 rad (the chord 0.053): nothing; whose tip turns 0.9 rad: its end has left its chord, and the chord has turned too
    const cantilever = (rotation: number): StiffnessModel => {
      const L = 10;
      const EI = 29000 * 144 * (100 / 20736);
      // tip rotation = P L² / (2 EI)
      const P = (rotation * 2 * EI) / (L * L);
      return beam({ nodes: [{ x: 0, y: 0 }, { x: L, y: 0 }], members: [{ i: 0, j: 1 }], supports: [{ node: 0, ux: true, uy: true, rz: true }], loads: [{ node: 1, fx: 0, fy: -P, m: 0 }], E: 29000 * 144, A: 10, I: 100 / 20736 });
    };
    const small = solve(cantilever(0.079));
    expect(small.ok && small.warnings.map((x) => x.code)).toEqual([]);
    const large = solve(cantilever(0.9));
    expect(large.ok && large.warnings.map((x) => x.code)).toEqual(expect.arrayContaining(['large-displacements', 'large-rotation']));
    // a bar of 10 ft that a pull of 10 kip stretches 345 times its length (A = 1e-6 in²); its chord does not turn
    const bar: StiffnessModel = { mode: 'truss', nodes: [{ x: 0, y: 0 }, { x: 10, y: 0 }], members: [{ i: 0, j: 1 }], supports: [{ node: 0, ux: true, uy: true, rz: false }, { node: 1, ux: false, uy: true, rz: false }], loads: [{ node: 1, fx: 10, fy: 0, m: 0 }], memberLoads: [], E: 29000 * 144, A: 1e-6 / 144 };
    const pulled = solve(bar);
    expect(pulled.ok).toBe(true);
    if (pulled.ok) {
      const stretch = pulled.warnings.find((x) => x.code === 'large-stretch')!;
      expect(stretch).toBeDefined();
      expect(stretch.count).toBe(1);
      expect(stretch.ratio!).toBeCloseTo(344.8, 0);
      expect(pulled.warnings.map((x) => x.code)).not.toContain('large-displacements');
      seenWarnings.add('large-stretch');
    }
    // an ordinary bar carries no such word
    expect(solve({ ...bar, A: 10 / 144 }).ok && (solve({ ...bar, A: 10 / 144 }) as { warnings: unknown[] }).warnings).toEqual([]);
  });
  it('a sound structure has no warning', () => {
    expect(warnings(bar())).toEqual([]);
  });
});

describe('through the form', () => {
  it('a visitor who types junk gets the fault against the row, once', () => {
    let f: StiffnessForm = reduce(emptyStiffness(), { type: 'template', template: 'frame-portal' });
    f = reduce(f, { type: 'patch', list: 'nodes', id: f.nodes[2].id, patch: { y: Number.NaN } });
    f = reduce(f, { type: 'section', patch: { I: -5 } });
    f = reduce(f, { type: 'patch', list: 'loads', id: f.loads[0].id, patch: { fy: Infinity } });
    const a = analyseSafely(f);
    expect(a.issues).toEqual([
      { code: 'number', row: { list: 'nodes', id: f.nodes[2].id, field: 'y' }, at: 3 },
      // (the structure's own field, with a value of zero or below: the sentence is told both, so that it says 'greater than zero' and does not say 'leave it blank')
      { code: 'section', row: { list: 'model', field: 'I' }, count: 1, max: 1 },
      { code: 'number', row: { list: 'loads', id: f.loads[0].id, field: 'fy' }, at: 1 },
    ]);
    expect(a.results).toBeNull();
    expect(a.solution).toBeNull();
  });
  it('a model with no member and the form that gives it is told so', () => {
    const f = reduce(emptyStiffness(), { type: 'template', template: 'truss-two-bar' });
    const a = analyseSafely({ ...f, members: [], memberLoads: [] });
    expect(a.issues).toEqual([{ code: 'no-members' }]);
    expect(analyseSafely(emptyStiffness()).issues).toEqual([{ code: 'few-nodes', count: 0 }, { code: 'no-members' }]);
  });
  it('the engine input of a form with nothing is refused, not crashed', () => {
    expect(solve(toEngine(emptyStiffness()).model).ok).toBe(false);
  });
});

describe('the lists of codes', () => {
  it('every issue code and every warning code was produced by a test in this file', () => {
    const missing = ISSUE_CODES.filter((c) => !seen.has(c));
    expect(missing).toEqual([]);
    expect(WARNING_CODES.filter((c) => !seenWarnings.has(c))).toEqual([]);
  });
});
