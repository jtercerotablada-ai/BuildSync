import { emptyStiffness, reduceStiffness, type StiffnessAction, type StiffnessForm } from '@/lib/calc/stiffness/model';
import type { Mode } from '@/lib/calc/stiffness/types';

/**
 * Test library: structures the tests and the pictures need that the library's templates do not give - a structure at the cap of the
 * form (12 nodes, 20 members), a flat one, a tall one, one with a settlement, and one with a number of every size.
 */

const run = (form: StiffnessForm, ...actions: StiffnessAction[]): StiffnessForm => actions.reduce((f, a) => reduceStiffness(f, a), form);

/** A form built from rows: nodes as [x, y], members as pairs of node numbers (from 1), supports as [node, preset], loads as [node, fx, fy]. */
export function build(o: { mode: Mode; units?: 'us' | 'si'; nodes: [number, number][]; members: [number, number][]; supports: [number, 'fixed' | 'pin' | 'roller'][]; loads?: [number, number, number][]; memberLoads?: { member: number; w: number }[] }): StiffnessForm {
  let f = emptyStiffness(o.units ?? 'us', o.mode);
  for (const [x, y] of o.nodes) f = run(f, { type: 'add', list: 'nodes', seed: { x, y } });
  const id = (n: number) => f.nodes[n - 1].id;
  for (const [i, j] of o.members) f = run(f, { type: 'add', list: 'members', seed: { i: id(i), j: id(j) } });
  for (const [n, preset] of o.supports) f = run(f, { type: 'add', list: 'supports', seed: { node: id(n), preset } });
  for (const [n, fx, fy] of o.loads ?? []) f = run(f, { type: 'add', list: 'loads', seed: { node: id(n), fx, fy } });
  for (const l of o.memberLoads ?? []) f = run(f, { type: 'add', list: 'memberLoads', seed: { member: f.members[l.member - 1].id, kind: 'udl', w: l.w } });
  return f;
}

/**
 * Six panels of a girder, braced: 12 nodes and 20 members (5 + 5 chords, 6 posts, 4 diagonals). A truss on a pin and a roller; or, as a
 * frame, on two fixed feet with a load on every top node.
 */
export function girder(mode: Mode, units: 'us' | 'si' = 'us'): StiffnessForm {
  const nodes: [number, number][] = [];
  for (let k = 0; k < 6; k++) nodes.push([k * 8, 0]);
  for (let k = 0; k < 6; k++) nodes.push([k * 8, 6]);
  const members: [number, number][] = [];
  for (let k = 1; k < 6; k++) members.push([k, k + 1]);
  for (let k = 7; k < 12; k++) members.push([k, k + 1]);
  for (let k = 1; k <= 6; k++) members.push([k, k + 6]);
  members.push([1, 8], [3, 10], [4, 11], [6, 11]);
  return build({
    mode,
    units,
    nodes,
    members,
    supports: mode === 'truss' ? [[1, 'pin'], [6, 'roller']] : [[1, 'fixed'], [6, 'fixed']],
    loads: [7, 8, 9, 10, 11, 12].map((n) => [n, n === 7 ? 6 : 0, -10] as [number, number, number]),
  });
}

/** A flat structure (a long low truss) and a tall one (a mast), for the drawing's proportions. */
export const flat = (): StiffnessForm =>
  build({ mode: 'truss', nodes: [[0, 0], [100, 0], [200, 0], [50, 1], [150, 1]], members: [[1, 4], [4, 2], [2, 5], [5, 3], [4, 5], [1, 2], [2, 3]], supports: [[1, 'pin'], [3, 'roller']], loads: [[4, 0, -5], [5, 0, -5]] });
export const tall = (): StiffnessForm =>
  build({ mode: 'frame', nodes: [[0, 0], [0, 40], [0, 80], [0, 120]], members: [[1, 2], [2, 3], [3, 4]], supports: [[1, 'fixed']], loads: [[4, 5, 0]] });

/** A portal frame whose right foot settles, to exercise the prescribed displacement of the steps. */
export function settling(): StiffnessForm {
  let f = build({ mode: 'frame', nodes: [[0, 0], [20, 0], [0, 10], [20, 10]], members: [[1, 3], [2, 4], [3, 4]], supports: [[1, 'fixed'], [2, 'pin']], loads: [[3, 10, 0]], memberLoads: [{ member: 3, w: -1 }] });
  f = run(f, { type: 'patch', list: 'supports', id: f.supports[1].id, patch: { dy: -0.5 } });
  return f;
}

/** A form whose every number field holds `value`. */
export function allNumbers(base: StiffnessForm, value: number): StiffnessForm {
  const f = (v: number) => (Number.isFinite(value) ? value : v);
  return {
    ...base,
    nodes: base.nodes.map((n) => ({ ...n, x: f(n.x), y: f(n.y) })),
    supports: base.supports.map((s) => ({ ...s, dx: f(s.dx), dy: f(s.dy), dr: f(s.dr) })),
    loads: base.loads.map((l) => ({ ...l, fx: f(l.fx), fy: f(l.fy), m: f(l.m) })),
    memberLoads: base.memberLoads.map((l) => ({ ...l, w: f(l.w), P: f(l.P), a: f(l.a), q: f(l.q) })),
    E: f(base.E ?? 1),
    A: f(base.A ?? 1),
    I: f(base.I ?? 1),
  };
}
