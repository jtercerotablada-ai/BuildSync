import { afterEach, describe, expect, it, vi } from 'vitest';
import { solveFrame } from './engine';
import type { FrameIssue, FrameIssueCode, FrameModel } from './types';

vi.setConfig({ testTimeout: 120_000 });
afterEach(() => new Promise((r) => setTimeout(r, 0)));

/**
 * EVERY DIAGNOSTIC CODE, with the numbers it carries (types.ts lists them). A model that is wrong comes back as a list of issues, never as an
 * exception and never with a NaN.
 */

const base = (o: Partial<FrameModel> = {}): FrameModel => ({
  nodes: [{ x: 0, y: 0 }, { x: 10, y: 0 }],
  members: [{ i: 0, j: 1 }],
  supports: [{ node: 0, kind: 'fixed' }],
  loads: [],
  memberLoads: [],
  E: 1000,
  A: 10,
  I: 100,
  ...o,
});
function issues(m: unknown): FrameIssue[] {
  const r = solveFrame(m as FrameModel);
  if (r.ok) throw new Error('solved');
  return r.issues;
}
const only = (m: unknown, code: FrameIssueCode): FrameIssue => {
  const found = issues(m).filter((i) => i.code === code);
  expect(found, JSON.stringify(issues(m))).toHaveLength(1);
  return found[0];
};
const portal = (o: Partial<FrameModel> = {}): FrameModel => ({
  nodes: [{ x: 0, y: 0 }, { x: 20, y: 0 }, { x: 0, y: 10 }, { x: 20, y: 10 }],
  members: [{ i: 0, j: 2 }, { i: 1, j: 3 }, { i: 2, j: 3 }],
  supports: [{ node: 0, kind: 'pin' }, { node: 1, kind: 'pin' }],
  loads: [{ node: 2, fx: 10, fy: 0, m: 0 }],
  memberLoads: [],
  E: 1000,
  A: 10,
  I: 100,
  ...o,
});

describe('the model is not whole', () => {
  it('few-nodes, no-members', () => {
    expect(only(base({ nodes: [{ x: 0, y: 0 }], members: [] }), 'few-nodes').count).toBe(1);
    expect(issues(base({ nodes: [] })).map((i) => i.code)).toContain('few-nodes');
    only(base({ members: [] }), 'no-members');
  });
  it('too-big: each list, with how many there are', () => {
    const many = <T,>(n: number, make: (k: number) => T): T[] => Array.from({ length: n }, (_, k) => make(k));
    const nodes = many(51, (k) => ({ x: k, y: 0 }));
    expect(only(base({ nodes, members: many(50, (k) => ({ i: k, j: k + 1 })) }), 'too-big')).toMatchObject({ where: { list: 'nodes' }, count: 51 });
    expect(only(base({ members: many(101, () => ({ i: 0, j: 1 })) }), 'too-big')).toMatchObject({ where: { list: 'members' }, count: 101 });
    expect(only(base({ supports: many(41, () => ({ node: 0, kind: 'pin' as const })) }), 'too-big')).toMatchObject({ where: { list: 'supports' }, count: 41 });
    expect(only(base({ loads: many(61, () => ({ node: 0, fx: 1, fy: 0, m: 0 })) }), 'too-big')).toMatchObject({ where: { list: 'loads' }, count: 61 });
    expect(only(base({ memberLoads: many(121, () => ({ kind: 'udl' as const, member: 0, dir: 'global-y' as const, w: -1 })) }), 'too-big')).toMatchObject({ where: { list: 'memberLoads' }, count: 121 });
  });
  it('number: a coordinate, a load, a position, a spring, a settlement, an angle, α — NaN, infinity or past 1e30 — against its row and field', () => {
    expect(only(base({ nodes: [{ x: Number.NaN, y: 0 }, { x: 10, y: 0 }] }), 'number').where).toEqual({ list: 'nodes', index: 0, field: 'x' });
    expect(only(base({ nodes: [{ x: 0, y: 0 }, { x: 10, y: 1e31 }] }), 'number').where).toEqual({ list: 'nodes', index: 1, field: 'y' });
    expect(only(base({ loads: [{ node: 0, fx: 1, fy: Infinity, m: 0 }] }), 'number').where).toEqual({ list: 'loads', index: 0, field: 'fy' });
    expect(only(base({ supports: [{ node: 0, kind: 'roller', angle: Number.NaN }] }), 'number').where).toEqual({ list: 'supports', index: 0, field: 'angle' });
    expect(only(base({ supports: [{ node: 0, kind: 'spring', kx: Number.NaN }] }), 'number').where).toEqual({ list: 'supports', index: 0, field: 'kx' });
    expect(only(base({ supports: [{ node: 0, kind: 'fixed', dy: -Infinity }] }), 'number').where).toEqual({ list: 'supports', index: 0, field: 'dy' });
    expect(only(base({ memberLoads: [{ kind: 'udl', member: 0, dir: 'global-y', w: Number.NaN }] }), 'number').where).toEqual({ list: 'memberLoads', index: 0, field: 'w' });
    expect(only(base({ memberLoads: [{ kind: 'point', member: 0, dir: 'global-y', a: Number.NaN, P: 1 }] }), 'number').where).toEqual({ list: 'memberLoads', index: 0, field: 'a' });
    expect(only(base({ memberLoads: [{ kind: 'temperature', member: 0, dT: 1, dTg: 0, alpha: Number.NaN }] }), 'number').where).toEqual({ list: 'memberLoads', index: 0, field: 'alpha' });
  });
  it('section: E, A, I or h that is zero, negative, NaN or out of range — the model\'s or a member\'s', () => {
    expect(only(base({ E: 0 }), 'section').where).toEqual({ list: 'model', index: 0, field: 'E' });
    expect(only(base({ A: -1 }), 'section').where).toEqual({ list: 'model', index: 0, field: 'A' });
    expect(only(base({ I: Number.NaN }), 'section').where).toEqual({ list: 'model', index: 0, field: 'I' });
    expect(only(base({ members: [{ i: 0, j: 1, A: 1e-31 }] }), 'section').where).toEqual({ list: 'members', index: 0, field: 'A' });
    expect(only(base({ members: [{ i: 0, j: 1, h: 0 }] }), 'section').where).toEqual({ list: 'members', index: 0, field: 'h' });
    expect(only(base({ members: [{ i: 0, j: 1, E: 1e31 }] }), 'section').where).toEqual({ list: 'members', index: 0, field: 'E' });
  });
  it('member-node, zero-length', () => {
    expect(only(base({ members: [{ i: 0, j: 7 }] }), 'member-node').where).toEqual({ list: 'members', index: 0, field: 'j' });
    expect(only(base({ members: [{ i: -1, j: 1 }] }), 'member-node').where).toEqual({ list: 'members', index: 0, field: 'i' });
    expect(only(base({ members: [{ i: 0, j: 1.5 }] }), 'member-node').where).toMatchObject({ field: 'j' });
    expect(only(base({ nodes: [{ x: 0, y: 0 }, { x: 10, y: 0 }, { x: 5, y: 5 }], members: [{ i: 0, j: 1 }, { i: 2, j: 2 }, { i: 0, j: 2 }] }), 'zero-length').where).toEqual({ list: 'members', index: 1 });
  });
  it('duplicate-node (the pair), short-member, duplicate-member (the second and the pair)', () => {
    expect(only(base({ nodes: [{ x: 0, y: 0 }, { x: 10, y: 0 }, { x: 10, y: 0 }], members: [{ i: 0, j: 1 }] }), 'duplicate-node').nodes).toEqual([1, 2]);
    expect(only(base({ nodes: [{ x: 0, y: 0 }, { x: 100, y: 0 }, { x: 100.0001, y: 0 }], members: [{ i: 0, j: 1 }, { i: 1, j: 2 }] }), 'short-member').where).toEqual({ list: 'members', index: 1 });
    const d = only(base({ members: [{ i: 0, j: 1 }, { i: 1, j: 0 }] }), 'duplicate-member');
    expect(d.where).toEqual({ list: 'members', index: 1 });
    expect(d.members).toEqual([0, 1]);
  });
  it('node-unconnected and disconnected (the nodes of each piece)', () => {
    expect(only(base({ nodes: [{ x: 0, y: 0 }, { x: 10, y: 0 }, { x: 5, y: 5 }] }), 'node-unconnected').nodes).toEqual([2]);
    const g = only(base({ nodes: [{ x: 0, y: 0 }, { x: 10, y: 0 }, { x: 20, y: 0 }, { x: 30, y: 0 }], members: [{ i: 0, j: 1 }, { i: 2, j: 3 }] }), 'disconnected');
    expect(g.groups).toEqual([[0, 1], [2, 3]]);
  });
  it('support-node, support-kind, duplicate-support, spring', () => {
    expect(only(base({ supports: [{ node: 5, kind: 'fixed' }] }), 'support-node').where).toEqual({ list: 'supports', index: 0, field: 'node' });
    expect(only(base({ supports: [{ node: 0, kind: 'wall' as never }] }), 'support-kind').where).toEqual({ list: 'supports', index: 0, field: 'kind' });
    const d = only(base({ supports: [{ node: 0, kind: 'fixed' }, { node: 0, kind: 'pin' }] }), 'duplicate-support');
    expect(d.where).toEqual({ list: 'supports', index: 1 });
    expect(d.nodes).toEqual([0]);
    expect(only(base({ supports: [{ node: 0, kind: 'spring', ky: -5 }] }), 'spring').where).toEqual({ list: 'supports', index: 0, field: 'ky' });
  });
  it('load-node, load-member, load-kind (a kind, a direction, a projected local one)', () => {
    expect(only(base({ loads: [{ node: 9, fx: 1, fy: 0, m: 0 }] }), 'load-node').where).toEqual({ list: 'loads', index: 0, field: 'node' });
    expect(only(base({ memberLoads: [{ kind: 'udl', member: 3, dir: 'global-y', w: 1 }] }), 'load-member').where).toEqual({ list: 'memberLoads', index: 0, field: 'member' });
    expect(only(base({ memberLoads: [{ kind: 'wind' as never, member: 0 } as never] }), 'load-kind').where).toEqual({ list: 'memberLoads', index: 0, field: 'kind' });
    expect(only(base({ memberLoads: [{ kind: 'udl', member: 0, dir: 'up' as never, w: 1 }] }), 'load-kind').where).toEqual({ list: 'memberLoads', index: 0, field: 'dir' });
    expect(only(base({ memberLoads: [{ kind: 'udl-projected', member: 0, dir: 'local-y' as never, w: 1 }] }), 'load-kind').where).toEqual({ list: 'memberLoads', index: 0, field: 'dir' });
  });
  it('load-position: outside the member, a trapezoid with no length, with the length', () => {
    expect(only(base({ memberLoads: [{ kind: 'point', member: 0, dir: 'global-y', a: 10.5, P: 1 }] }), 'load-position')).toMatchObject({ where: { list: 'memberLoads', index: 0, field: 'a' }, length: 10 });
    expect(only(base({ memberLoads: [{ kind: 'moment', member: 0, a: -1, M: 1 }] }), 'load-position').where).toMatchObject({ field: 'a' });
    expect(only(base({ memberLoads: [{ kind: 'trapezoid', member: 0, dir: 'global-y', a: 2, b: 12, w1: 1, w2: 1 }] }), 'load-position').where).toMatchObject({ field: 'b' });
    expect(only(base({ memberLoads: [{ kind: 'trapezoid', member: 0, dir: 'global-y', a: 5, b: 5, w1: 1, w2: 1 }] }), 'load-position').where).toMatchObject({ field: 'b' });
    expect(only(base({ memberLoads: [{ kind: 'trapezoid', member: 0, dir: 'global-y', a: 6, b: 4, w1: 1, w2: 1 }] }), 'load-position').where).toMatchObject({ field: 'b' });
    // The ends are inside, a position past the end by the rounding of eight figures is the end, and one past it by a millionth is not.
    expect(solveFrame(base({ nodes: [{ x: 0, y: 0 }, { x: 8.602325267042627, y: 0 }], memberLoads: [{ kind: 'trapezoid', member: 0, dir: 'global-y', a: 0, b: 8.6023253, w1: -1, w2: -1 }] })).ok).toBe(true);
    expect(solveFrame(base({ memberLoads: [{ kind: 'point', member: 0, dir: 'global-y', a: 10 + 1e-5, P: -1 }] })).ok).toBe(false);
    expect(solveFrame(base({ memberLoads: [{ kind: 'point', member: 0, dir: 'global-y', a: 10, P: -1 }, { kind: 'point', member: 0, dir: 'global-y', a: 0, P: -1 }, { kind: 'moment', member: 0, a: 10 + 1e-12, M: 1 }] })).ok).toBe(true);
  });
  it('depth: a temperature gradient needs the depth of the member (and says which member)', () => {
    const d = only(base({ memberLoads: [{ kind: 'temperature', member: 0, dT: 0, dTg: 20, alpha: 1e-5 }] }), 'depth');
    expect(d).toMatchObject({ where: { list: 'memberLoads', index: 0 }, members: [0] });
    expect(solveFrame(base({ members: [{ i: 0, j: 1, h: 1 }], memberLoads: [{ kind: 'temperature', member: 0, dT: 0, dTg: 20, alpha: 1e-5 }] })).ok).toBe(true);
    // No gradient, no depth needed.
    expect(solveFrame(base({ memberLoads: [{ kind: 'temperature', member: 0, dT: 20, dTg: 0, alpha: 1e-5 }] })).ok).toBe(true);
  });
});

describe('the supports do not hold the frame', () => {
  it('few-supports: fewer than 3 reaction components', () => {
    expect(only(base({ supports: [{ node: 0, kind: 'pin' }] }), 'few-supports').count).toBe(2);
    expect(only(base({ supports: [] }), 'few-supports').count).toBe(0);
    expect(only(base({ supports: [{ node: 0, kind: 'pin' }, { node: 1, kind: 'spring' }] }), 'few-supports').count).toBe(2);
    // Springs count, each independent one: a pin and a spring in y.
    expect(solveFrame(base({ supports: [{ node: 0, kind: 'pin' }, { node: 1, kind: 'spring', ky: 100 }] })).ok).toBe(true);
    // A pin with a rotational spring is three.
    expect(solveFrame(base({ supports: [{ node: 0, kind: 'pin', kr: 1e3 }, { node: 1, kind: 'roller' }] })).ok).toBe(true);
  });
  it('unrestrained: three reactions that cannot hold it; the count of free rigid motions', () => {
    // Three vertical rollers: parallel lines of action, the frame can slide along them.
    const parallel = base({ nodes: [{ x: 0, y: 0 }, { x: 10, y: 0 }, { x: 20, y: 0 }], members: [{ i: 0, j: 1 }, { i: 1, j: 2 }], supports: [{ node: 0, kind: 'roller' }, { node: 1, kind: 'roller' }, { node: 2, kind: 'roller' }] });
    expect(only(parallel, 'unrestrained').count).toBe(1);
    // Two vertical rollers and a horizontal one hold it; three horizontal ones leave it free to slide up and down.
    const triangle = {
      nodes: [{ x: 0, y: 0 }, { x: 10, y: 0 }, { x: 5, y: 5 }],
      members: [{ i: 0, j: 1 }, { i: 1, j: 2 }, { i: 0, j: 2 }],
    };
    expect(solveFrame(base({ ...triangle, supports: [{ node: 0, kind: 'roller', angle: 90 }, { node: 1, kind: 'roller', angle: 90 }, { node: 2, kind: 'roller', angle: 0 }] })).ok).toBe(true);
    expect(only(base({ ...triangle, supports: [{ node: 0, kind: 'roller', angle: 0 }, { node: 1, kind: 'roller', angle: 0 }, { node: 2, kind: 'roller', angle: 0 }] }), 'unrestrained').count).toBe(1);
    // A pin and a roller whose line passes through the pin: the frame turns about the pin.
    const through = base({ supports: [{ node: 0, kind: 'pin' }, { node: 1, kind: 'roller', angle: 0 }] });
    expect(only(through, 'unrestrained').count).toBe(1);
    // Inclined lines meeting at a point.
    const point = base({
      nodes: [{ x: 0, y: 0 }, { x: 10, y: 0 }, { x: 5, y: 5 }],
      members: [{ i: 0, j: 1 }, { i: 1, j: 2 }, { i: 0, j: 2 }],
      supports: [{ node: 0, kind: 'roller', angle: 45 }, { node: 1, kind: 'roller', angle: 135 }, { node: 2, kind: 'roller', angle: 90 }],
    });
    expect(only(point, 'unrestrained').count).toBe(1);
    // A fixed support alone holds it.
    expect(solveFrame(base()).ok).toBe(true);
  });
  it('hinged-joint-moment: a moment where every member is hinged and nothing holds the rotation', () => {
    const arch = {
      nodes: [{ x: 0, y: 0 }, { x: 12, y: 6 }, { x: 24, y: 0 }],
      members: [{ i: 0, j: 1, releases: { end: true } }, { i: 1, j: 2, releases: { start: true } }],
      supports: [{ node: 0, kind: 'pin' as const }, { node: 2, kind: 'pin' as const }],
      loads: [{ node: 1, fx: 0, fy: -10, m: 5 }],
      memberLoads: [],
      E: 1000,
      A: 10,
      I: 100,
    };
    expect(only(arch, 'hinged-joint-moment').nodes).toEqual([1]);
    expect(solveFrame({ ...arch, loads: [{ node: 1, fx: 0, fy: -10, m: 0 }] }).ok).toBe(true);
    // A rotational spring at that node holds it.
    expect(solveFrame({ ...arch, supports: [...arch.supports, { node: 1, kind: 'spring' as const, kr: 100 }] }).ok).toBe(true);
  });
});

describe('mechanisms are found, named, and never invented', () => {
  it('a portal with pinned feet and a hinge at each end of the beam is a four-bar linkage: the two corners sway', () => {
    const m = portal({ members: [{ i: 0, j: 2 }, { i: 1, j: 3 }, { i: 2, j: 3, releases: { start: true, end: true } }] });
    expect(only(m, 'mechanism')).toMatchObject({ nodes: [2, 3], kind: 'sway', count: 1 });
  });
  it('the same with ONE hinge is stable and determinate; with fixed feet, hinges at both column tops and both beam ends are stable (one degree indeterminate: the joints are free)', () => {
    const one = solveFrame(portal({ members: [{ i: 0, j: 2 }, { i: 1, j: 3 }, { i: 2, j: 3, releases: { start: true } }] }));
    expect(one.ok).toBe(true);
    if (one.ok) expect(one.determinacy).toMatchObject({ degree: 0, word: 'determinate' });
    const fixed = solveFrame(portal({ supports: [{ node: 0, kind: 'fixed' }, { node: 1, kind: 'fixed' }], members: [{ i: 0, j: 2, releases: { end: true } }, { i: 1, j: 3, releases: { end: true } }, { i: 2, j: 3, releases: { start: true, end: true } }] }));
    expect(fixed.ok).toBe(true);
    if (fixed.ok) expect(fixed.determinacy).toMatchObject({ joints: 4, members: 3, reactions: 6, releases: 4, freeJoints: 2, equations: 10, degree: 1, word: 'indeterminate' });
  });
  it('a beam with two hinges in one span between three supports, and a cantilever with a hinge', () => {
    const beam = base({
      nodes: [{ x: 0, y: 0 }, { x: 5, y: 0 }, { x: 10, y: 0 }, { x: 15, y: 0 }],
      members: [{ i: 0, j: 1 }, { i: 1, j: 2, releases: { start: true, end: true } }, { i: 2, j: 3 }],
      supports: [{ node: 0, kind: 'pin' }, { node: 3, kind: 'roller' }],
    });
    // Three bars in a straight line between a pin and a roller: the two joints between them can move up and down, two mechanisms.
    const m = only(beam, 'mechanism');
    expect(m).toMatchObject({ nodes: [1, 2], count: 2 });
    // A pin–roller beam with a hinge is a mechanism: the two halves fold at the hinge.
    const folded = base({
      nodes: [{ x: 0, y: 0 }, { x: 5, y: 0 }, { x: 10, y: 0 }],
      members: [{ i: 0, j: 1, releases: { end: true } }, { i: 1, j: 2 }],
      supports: [{ node: 0, kind: 'pin' }, { node: 2, kind: 'roller' }],
    });
    expect(only(folded, 'mechanism').nodes).toEqual([1]);
    // A cantilever with a hinge in it: the tip swings about the hinge.
    const swing = base({
      nodes: [{ x: 0, y: 0 }, { x: 5, y: 0 }, { x: 10, y: 0 }],
      members: [{ i: 0, j: 1 }, { i: 1, j: 2, releases: { start: true } }],
      supports: [{ node: 0, kind: 'fixed' }],
    });
    expect(only(swing, 'mechanism')).toMatchObject({ nodes: [2], kind: 'rotation', count: 1 });
  });
  it('a three-hinged frame with its hinges in a line is a mechanism (to first order); lifted off the line it is stable, down to a rise of a thousandth of the span', () => {
    const arch = (rise: number) =>
      solveFrame({
        nodes: [{ x: 0, y: 0 }, { x: 12, y: rise }, { x: 24, y: 0 }],
        members: [{ i: 0, j: 1, releases: { end: true } }, { i: 1, j: 2, releases: { start: true } }],
        supports: [{ node: 0, kind: 'pin' }, { node: 2, kind: 'pin' }],
        loads: [{ node: 1, fx: 0, fy: -10, m: 0 }],
        memberLoads: [],
        E: 1000,
        A: 10,
        I: 100,
      });
    const flat = arch(0);
    expect(flat.ok).toBe(false);
    if (!flat.ok) expect(flat.issues[0]).toMatchObject({ code: 'mechanism', nodes: [1], kind: 'rotation', count: 1 });
    // A rise of 0.001 ft on a span of 24 (4 in a hundred thousand) is still solved, with a thrust of 6,000 times the load.
    for (const rise of [6, 1, 0.1, 0.024, 0.001]) {
      const r = arch(rise);
      expect(r.ok, `rise ${rise}`).toBe(true);
      // H = P L / (4 f).
      if (r.ok) expect(Math.abs(r.reactions[0].rx - (10 * 24) / (4 * rise)) / ((10 * 24) / (4 * rise))).toBeLessThan(1e-6);
    }
  });
  it('a node held by two collinear members and nothing else moves across them; a single bar to nowhere', () => {
    const m = base({
      nodes: [{ x: 0, y: 0 }, { x: 10, y: 0 }, { x: 20, y: 0 }],
      members: [{ i: 0, j: 1, releases: { end: true } }, { i: 1, j: 2, releases: { start: true } }],
      supports: [{ node: 0, kind: 'pin' }, { node: 2, kind: 'pin' }],
    });
    expect(only(m, 'mechanism').nodes).toEqual([1]);
  });
  it('a stable frame with several hinges is never called a mechanism: a Gerber beam and a hinged-column portal', () => {
    // Fixed at 0, hinge at 10, roller at 20 (statics only), plus a hinge at 20 on the second span end if the roller holds it.
    const gerber = base({
      nodes: [{ x: 0, y: 0 }, { x: 10, y: 0 }, { x: 20, y: 0 }, { x: 30, y: 0 }],
      members: [{ i: 0, j: 1, releases: { end: true } }, { i: 1, j: 2 }, { i: 2, j: 3, releases: { start: true } }],
      supports: [{ node: 0, kind: 'fixed' }, { node: 2, kind: 'roller' }, { node: 3, kind: 'roller' }],
      memberLoads: [{ kind: 'udl', member: 0, dir: 'global-y', w: -1 }, { kind: 'udl', member: 1, dir: 'global-y', w: -1 }, { kind: 'udl', member: 2, dir: 'global-y', w: -1 }],
    });
    const s = solveFrame(gerber);
    expect(s.ok).toBe(true);
    if (s.ok) expect(s.determinacy).toMatchObject({ degree: 0, word: 'determinate' });
    // Hinged-base columns (pendulums) holding a beam that is held sideways by a bracing member: stable.
    const braced = portal({
      nodes: [{ x: 0, y: 0 }, { x: 20, y: 0 }, { x: 0, y: 10 }, { x: 20, y: 10 }],
      members: [{ i: 0, j: 2, releases: { start: true, end: true } }, { i: 1, j: 3, releases: { start: true, end: true } }, { i: 2, j: 3 }, { i: 0, j: 3, releases: { start: true, end: true } }],
    });
    expect(solveFrame(braced).ok).toBe(true);
  });
});

describe('the rest', () => {
  it('sections: an indeterminate frame without E, A or I cannot be solved; a determinate one can, without displacements', () => {
    const missing = portal({ I: undefined });
    expect(only(missing, 'sections').count).toBe(3);
    expect(only(portal({ members: [{ i: 0, j: 2 }, { i: 1, j: 3, E: 5 }, { i: 2, j: 3 }], E: undefined }), 'sections').count).toBe(2);
    const det = solveFrame({ ...base({ supports: [{ node: 0, kind: 'pin' }, { node: 1, kind: 'roller' }], loads: [{ node: 1, fx: 0, fy: 0, m: 0 }], memberLoads: [{ kind: 'udl', member: 0, dir: 'global-y', w: -2 }] }), I: undefined });
    expect(det.ok).toBe(true);
    if (det.ok) {
      expect(det.stiffness).toBe('none');
      expect(det.displacements).toBeNull();
      expect(det.warnings.map((w) => w.code)).toContain('no-stiffness');
      expect(det.members[0].maxima.M.max.value).toBeCloseTo(25, 9);
    }
  });
  it('ill-conditioned: stiffness that differ by too many orders of magnitude', () => {
    const r = solveFrame(portal({ A: 1e25 }));
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.issues).toEqual([{ code: 'ill-conditioned' }]);
    // And a reasonable range (steel: A in ft², I in ft⁴ ...) is fine.
    expect(solveFrame(portal({ E: 29000 * 144, A: 14.1 / 144, I: 484 / 20736 })).ok).toBe(true);
    expect(solveFrame(portal({ A: 1e6 })).ok).toBe(true);
  });
  it('stopped: the arithmetic threw (never expected); the engine says so and does not throw', () => {
    const hostile = new Proxy({}, { get() { throw new Error('boom'); } });
    const r = solveFrame(hostile as never);
    expect(r).toEqual({ ok: false, issues: [{ code: 'stopped' }] });
  });
  it('nothing throws or returns a NaN for garbage in any field', () => {
    const junk = [null, undefined, NaN, Infinity, -1, 0, 1e308, '7', [], {}, true];
    const m = portal({ memberLoads: [{ kind: 'udl', member: 2, dir: 'global-y', w: -1 }], supports: [{ node: 0, kind: 'fixed' }, { node: 1, kind: 'roller', angle: 45 }] }) as unknown as Record<string, unknown>;
    let n = 0;
    for (const key of Object.keys(m)) for (const j of junk) {
      const copy = { ...m, [key]: j };
      const r = solveFrame(copy as never);
      n++;
      expect(JSON.stringify(r).includes('null') || r.ok || r.issues.length > 0).toBe(true);
      if (r.ok) expect(JSON.stringify(r)).not.toMatch(/NaN|Infinity/);
    }
    // And inside the lists.
    const lists = ['nodes', 'members', 'supports', 'loads', 'memberLoads'];
    for (const key of lists) for (const j of junk) {
      const copy = { ...m, [key]: [j, ...((m[key] as unknown[]) ?? [])] };
      expect(() => solveFrame(copy as never)).not.toThrow();
      n++;
    }
    expect(n).toBeGreaterThan(100);
  });
  it('size: a result past what a number holds is refused, not returned as Infinity', () => {
    // Loads and spans at the limits of the input range, sections at the bottom of it.
    const r = solveFrame({
      nodes: [{ x: 0, y: 0 }, { x: 1e30, y: 0 }],
      members: [{ i: 0, j: 1 }],
      supports: [{ node: 0, kind: 'fixed' }],
      loads: [],
      memberLoads: [{ kind: 'udl', member: 0, dir: 'global-y', w: -1e30 }],
      E: 1e-30,
      A: 1e-30,
      I: 1e-30,
    });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.issues).toEqual([{ code: 'size' }]);
    // And the same at the sizes of a real structure is fine.
    expect(solveFrame(base({ memberLoads: [{ kind: 'udl', member: 0, dir: 'global-y', w: -1 }] })).ok).toBe(true);
  });
});
