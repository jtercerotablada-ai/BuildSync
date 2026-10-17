import { afterEach, describe, expect, it, vi } from 'vitest';

// Heavy by design (thousands of generated cases, whole-tool renders): a loaded machine runs a full suite past the 5 s default.
vi.setConfig({ testTimeout: 120_000 });
import { checkOf } from '../beam/model';
import { solveTruss } from './engine';
import {
  FROM_ENGINE,
  MAX_LINK,
  TO_ENGINE,
  TRUSS_KEY,
  TRUSS_MATERIALS,
  TRUSS_UNITS,
  convertTemplateInputs,
  convertTruss,
  decode,
  decodeTruss,
  defaultCase,
  defaultTruss,
  emptyTruss,
  encode,
  encodeTruss,
  issueRow,
  leavesBehind,
  nodeLabel,
  reduceTruss,
  toEngine,
  type TrussAction,
  type TrussForm,
} from './model';
import { rng } from './oracle.testlib';
import { MAX_LOADS, MAX_MEMBERS, MAX_NODES, MAX_SUPPORTS } from './types';

afterEach(() => new Promise<void>((resolve) => setTimeout(resolve, 0)));

/**
 * THE FORM. What each edit does, what the engine is given, the two unit
 * systems and the address that carries a case from one engineer to another.
 * The address is the part that must never let a visitor down, so it gets the
 * most: round trips on random forms, every kind of damage a link can suffer,
 * and fuzz — decode answers a form or null, and does not throw.
 */

/** A form without its ids and its notice: what an address carries. */
function normal(f: TrussForm) {
  const at = new Map(f.nodes.map((n, k) => [n.id, k + 1]));
  return {
    units: f.units,
    material: f.material,
    E: f.E,
    A: f.A,
    nodes: f.nodes.map((n) => [n.x, n.y]),
    members: f.members.map((m) => [at.get(m.i), at.get(m.j), m.A, m.E]),
    supports: f.supports.map((s) => [s.kind, at.get(s.node), s.angle]),
    loads: f.loads.map((l) => [at.get(l.node), l.fx, l.fy]),
  };
}
const act = (form: TrussForm, ...actions: TrussAction[]) => actions.reduce(reduceTruss, form);
const ids = (f: TrussForm) => [...f.nodes, ...f.members, ...f.supports, ...f.loads].map((r) => r.id);
/** A form is consistent: ids unique and below nextId, every reference names a node, every list within its cap. */
function consistent(f: TrussForm) {
  const all = ids(f);
  expect(new Set(all).size).toBe(all.length);
  all.forEach((id) => expect(id).toBeLessThan(f.nextId));
  const node = new Set(f.nodes.map((n) => n.id));
  f.members.forEach((m) => expect(node.has(m.i) && node.has(m.j)).toBe(true));
  f.supports.forEach((s) => expect(node.has(s.node)).toBe(true));
  f.loads.forEach((l) => expect(node.has(l.node)).toBe(true));
  expect(f.nodes.length).toBeLessThanOrEqual(MAX_NODES);
  expect(f.members.length).toBeLessThanOrEqual(MAX_MEMBERS);
  expect(f.supports.length).toBeLessThanOrEqual(MAX_SUPPORTS);
  expect(f.loads.length).toBeLessThanOrEqual(MAX_LOADS);
}
const round8 = (v: number) => (Number.isFinite(v) ? Number(v.toPrecision(8)) : v);

describe('truss form: the truss the page opens with', () => {
  const f = defaultTruss();
  it('is a four-panel Pratt truss of 32 ft by 8 ft with 10 kip at the top joints and 5 at the ends', () => {
    expect(f.units).toBe('us');
    expect(f.nodes.length).toBe(10);
    expect(f.members.length).toBe(17);
    expect(f.supports.map((s) => [s.kind, s.angle])).toEqual([['pin', 90], ['roller', 90]]);
    expect(f.loads.map((l) => l.fy)).toEqual([-5, -10, -10, -10, -5]);
    expect(f.nodes.slice(0, 5).map((n) => [n.x, n.y])).toEqual([[0, 0], [8, 0], [16, 0], [24, 0], [32, 0]]);
    expect(f.nodes.slice(5).map((n) => [n.x, n.y])).toEqual([[0, 8], [8, 8], [16, 8], [24, 8], [32, 8]]);
    expect(f.material).toBe('steel');
    expect(f.E).toBe(29000);
    expect(f.A).toBe(4);
    expect(f.notice).toBeNull();
    consistent(f);
  });
  it('defaultCase is defaultTruss, and each call is a new object', () => {
    expect(defaultCase()).toEqual(f);
    expect(defaultCase()).not.toBe(defaultCase());
  });
  it('its rows are numbered as a link numbers them, so it comes back from its own address id for id', () => {
    expect(decodeTruss(encodeTruss(f))).toEqual(f);
    expect(f.nextId).toBe(1 + 10 + 17 + 2 + 5);
  });
  it('is solved: it is determinate and stable', () => {
    const out = solveTruss(toEngine(f).model);
    expect(out.ok).toBe(true);
  });
  it('emptyTruss is nothing, with the section kept', () => {
    const e = emptyTruss('si');
    expect(e).toMatchObject({ units: 'si', nodes: [], members: [], supports: [], loads: [], E: 200, A: null, nextId: 1 });
    expect(decodeTruss(encodeTruss(e))).toEqual(e);
  });
});

describe('truss form: the units', () => {
  it('the unit names', () => {
    expect(TRUSS_UNITS.us).toEqual({ length: 'ft', force: 'kip', area: 'in²', E: 'ksi', stress: 'ksi', displacement: 'in', moment: 'kip·ft' });
    expect(TRUSS_UNITS.si).toEqual({ length: 'm', force: 'kN', area: 'mm²', E: 'GPa', stress: 'MPa', displacement: 'mm', moment: 'kN·m' });
  });
  it('the default truss in SI: feet to metres, kips to kilonewtons, square inches to square millimetres, steel to 200 GPa', () => {
    const si = convertTruss(defaultTruss(), 'si');
    expect(si.units).toBe('si');
    expect(si.nodes[4]).toMatchObject({ x: 9.7536, y: 0 });
    expect(si.nodes[5]).toMatchObject({ x: 0, y: 2.4384 });
    // 10 kip is 44.482216152605 kN: every figure of the conversion is kept (the beam's `tidy` rounds to six, which turns a symmetric truss into one that is not).
    expect(si.loads[1].fy).toBe(-44.482216152605);
    expect(si.A).toBeCloseTo(2580.64, 6);
    expect(si.E).toBe(200);
    expect(si.material).toBe('steel');
    expect(si.supports.map((s) => s.angle)).toEqual([90, 90]);
  });
  it('and back again: the very same numbers', () => {
    const f = defaultTruss();
    expect(convertTruss(convertTruss(f, 'si'), 'us')).toEqual(f);
    expect(convertTruss(f, 'us')).toBe(f);
  });
  it('round trips for values of up to four significant figures, rows with their own section, a custom modulus, empty and NaN fields', () => {
    const rand = rng(17);
    for (let t = 0; t < 60; t++) {
      let f = defaultTruss();
      f = act(f, { type: 'patch', list: 'nodes', id: f.nodes[3].id, patch: { x: round8(Math.round(rand() * 5000) / 100), y: round8(Math.round(rand() * 900) / 100) } });
      f = act(f, { type: 'patch', list: 'loads', id: f.loads[1].id, patch: { fx: round8(Math.round(rand() * 400) / 10), fy: round8(-Math.round(rand() * 4000) / 10) } });
      f = act(f, { type: 'patch', list: 'members', id: f.members[2].id, patch: { A: round8(Math.round(rand() * 900) / 100 + 0.01), E: Math.round(rand() * 30000) + 100 } });
      f = act(f, { type: 'section', patch: { E: 100 * Math.round(rand() * 300 + 1), A: null } });
      f = act(f, { type: 'patch', list: 'nodes', id: f.nodes[0].id, patch: { x: NaN } });
      const there = convertTruss(f, 'si');
      const back = convertTruss(there, 'us');
      expect(normal(back)).toEqual(normal(f));
    }
  });
  it('a listed material is the listed modulus in the other system (not a conversion of the other column)', () => {
    const f = defaultTruss();
    expect(convertTruss(f, 'si').E).toBe(TRUSS_MATERIALS.steel.si);
    const al = act(f, { type: 'material', material: 'aluminum' });
    expect(al.E).toBe(10100);
    expect(convertTruss(al, 'si').E).toBe(69.6);
    // 29,000 ksi is 199.95 GPa; steel is 200.
    expect(TRUSS_MATERIALS.steel.si).toBe(200);
    // A modulus that is not the listed one is converted.
    const odd = act(f, { type: 'section', patch: { E: 30000 } });
    expect(odd.material).toBe('custom');
    expect(convertTruss(odd, 'si').E).toBeCloseTo(206.84, 2);
  });
  it('the same truss in SI has the same member forces, in kilonewtons (the units are consistent end to end)', () => {
    const us = solveTruss(toEngine(defaultTruss()).model);
    const si = solveTruss(toEngine(convertTruss(defaultTruss(), 'si')).model);
    if (!us.ok || !si.ok) throw new Error('not solved');
    us.members.forEach((m, k) => expect(Math.abs(si.members[k].N - m.N * 4.4482216152605)).toBeLessThanOrEqual(1e-5 * 100));
  });
  it('the engine is given feet and kips or metres and kilonewtons: the section crosses in one place, and results come back through the same numbers', () => {
    expect(TO_ENGINE.us).toEqual({ area: 1 / 144, E: 144 });
    expect(TO_ENGINE.si).toEqual({ area: 1e-6, E: 1e6 });
    // The elongation of a bar: 15 kip, 8 ft, 4 in², 29,000 ksi → 15 · 96 in / (29,000 · 4) = 0.012414 in.
    const f = defaultTruss();
    const out = solveTruss(toEngine(f).model);
    if (!out.ok) throw new Error('not solved');
    const bar = out.members[1];
    expect(bar.N).toBeCloseTo(15, 9);
    expect(bar.elongation! * FROM_ENGINE.us.displacement).toBeCloseTo(1440 / 116000, 12);
    expect(bar.stress! * FROM_ENGINE.us.stress).toBeCloseTo(15 / 4, 12);
    // In SI: the same bar, 66.723 kN, 2.4384 m, 2580.64 mm², 200 GPa → N L / E A = 66723·2438.4 / (200,000 · 2580.64) mm.
    const si = convertTruss(f, 'si');
    const o2 = solveTruss(toEngine(si).model);
    if (!o2.ok) throw new Error('not solved');
    expect(Math.abs(o2.members[1].N - 15 * 4.4482216152605)).toBeLessThan(15 * 4.4482216152605 * 6e-6);
    expect(o2.members[1].elongation! * FROM_ENGINE.si.displacement).toBeCloseTo((o2.members[1].N * 1000 * 2438.4) / (200000 * 2580.64), 6);
    expect(o2.members[1].stress! * FROM_ENGINE.si.stress).toBeCloseTo((o2.members[1].N * 1000) / 2580.64, 6);
  });
});

describe('truss form: what each edit does', () => {
  const base = defaultTruss();

  it('load replaces the form and clears the notice', () => {
    const other = emptyTruss('si');
    const noted = act(base, { type: 'remove', list: 'nodes', id: base.nodes[9].id });
    expect(noted.notice).not.toBeNull();
    expect(act(noted, { type: 'load', form: { ...other, notice: { code: 'limit', list: 'nodes', max: 40 } } })).toEqual(other);
  });

  it('load hands back the very form it was given (B1): the page tells a truss opened whole from one edited, by ===', () => {
    const other = emptyTruss('si');
    // The same object, not a copy of it: `reduceTruss(d, { type: 'load', form: other }) === other` held for the other calculators' reducers.
    expect(act(base, { type: 'load', form: other })).toBe(other);
    expect(act(base, { type: 'load', form: base })).toBe(base);
    // One that carries a notice is the same truss without it (a link never does).
    const noted = { ...other, notice: { code: 'limit', list: 'nodes', max: 40 } as const };
    expect(act(base, { type: 'load', form: noted })).toEqual(other);
    // And anything done to it afterwards is another object, so the page knows it has been edited.
    const edited = act(act(base, { type: 'load', form: other }), { type: 'add', list: 'nodes' });
    expect(edited).not.toBe(other);
  });

  it('units converts; a unit switch clears a notice', () => {
    const f = act(base, { type: 'remove', list: 'loads', id: base.loads[0].id }, { type: 'units', units: 'si' });
    expect(f.units).toBe('si');
    expect(f.notice).toBeNull();
    expect(act(f, { type: 'units', units: 'si' })).toBe(f);
  });

  it('a node is added to the right of the last one, at its height; or where it is told', () => {
    const f = act(base, { type: 'add', list: 'nodes' });
    expect(f.nodes[10]).toEqual({ id: base.nextId, x: 40, y: 8 });
    expect(f.nextId).toBe(base.nextId + 1);
    expect(act(base, { type: 'add', list: 'nodes', seed: { x: 3, y: 4 } }).nodes[10]).toMatchObject({ x: 3, y: 4 });
    expect(act(emptyTruss(), { type: 'add', list: 'nodes' }).nodes[0]).toMatchObject({ x: 0, y: 0 });
    expect(act(emptyTruss('si'), { type: 'add', list: 'nodes' }, { type: 'add', list: 'nodes' }).nodes[1]).toMatchObject({ x: 2.5, y: 0 });
  });

  it('a member is added between two nodes that have none: the last node and the nearest it is not joined to', () => {
    const withNode = act(base, { type: 'add', list: 'nodes', seed: { x: 8, y: 16 } });
    const f = act(withNode, { type: 'add', list: 'members' });
    const m = f.members[17];
    expect(m.i).toBe(withNode.nodes[10].id);
    // Nearest to (8, 16): the top node at (8, 8).
    expect(m.j).toBe(withNode.nodes[6].id);
    expect(m.A).toBeNull();
    expect(m.E).toBeNull();
    // Told which nodes: that pair; a pair already joined, or a node to itself, is refused.
    const a = base.nodes[0].id;
    const c = base.nodes[2].id;
    expect(act(base, { type: 'add', list: 'members', seed: { i: a, j: c } }).members[17]).toMatchObject({ i: a, j: c });
    // Told a pair already joined, or a node to itself, nothing is added - and the form SAYS so (B3), where it said nothing.
    for (const seed of [{ i: a, j: base.nodes[1].id }, { i: a, j: a }]) {
      const refused = act(base, { type: 'add', list: 'members', seed });
      expect(refused.members).toEqual(base.members);
      expect(refused.notice).toEqual({ code: 'nothing-to-add', list: 'members', why: 'pairs' });
    }
    // A node that does not exist falls back to the default pair.
    expect(act(base, { type: 'add', list: 'members', seed: { i: 9999, j: a } }).members.length).toBe(18);
    expect(act(emptyTruss(), { type: 'add', list: 'members' }).members.length).toBe(0);
    // Every pair of nodes already joined: nothing to add, and a notice that says it.
    const triangle = act(emptyTruss(), { type: 'add', list: 'nodes', seed: { x: 0, y: 0 } }, { type: 'add', list: 'nodes', seed: { x: 4, y: 0 } }, { type: 'add', list: 'nodes', seed: { x: 2, y: 3 } });
    const joined = act(triangle, { type: 'add', list: 'members' }, { type: 'add', list: 'members' }, { type: 'add', list: 'members' });
    expect(joined.members).toHaveLength(3);
    const none = act(joined, { type: 'add', list: 'members' });
    expect(none.members).toHaveLength(3);
    expect(none.notice).toEqual({ code: 'nothing-to-add', list: 'members', why: 'pairs' });
    // Two nodes only, and one member between them: the same.
    expect(act(emptyTruss(), { type: 'add', list: 'members' }).notice).toEqual({ code: 'nothing-to-add', list: 'members', why: 'pairs' });
  });

  it('a support is added at the first node that has none: a pin when it is the first, a roller after it; or where it is told', () => {
    const withNodes = act(emptyTruss(), { type: 'add', list: 'nodes' }, { type: 'add', list: 'nodes' });
    const one = act(withNodes, { type: 'add', list: 'supports' });
    expect(one.supports[0]).toMatchObject({ node: withNodes.nodes[0].id, kind: 'pin', angle: 90 });
    const two = act(one, { type: 'add', list: 'supports' });
    expect(two.supports[1]).toMatchObject({ node: withNodes.nodes[1].id, kind: 'roller', angle: 90 });
    // Every node has one: nothing is added, and the notice says why.
    const full = act(two, { type: 'add', list: 'supports' });
    expect(full.supports).toEqual(two.supports);
    expect(full.notice).toEqual({ code: 'nothing-to-add', list: 'supports', why: 'nodes' });
    // No node at all: a different reason.
    expect(act(emptyTruss(), { type: 'add', list: 'supports' }).notice).toEqual({ code: 'nothing-to-add', list: 'supports', why: 'no-node' });
    expect(act(base, { type: 'add', list: 'supports', seed: { node: base.nodes[3].id, kind: 'roller', angle: 45 } }).supports[2]).toMatchObject({ node: base.nodes[3].id, kind: 'roller', angle: 45 });
  });

  it('a load is added on the first node (or the one told), 10 kip / 40 kN down', () => {
    expect(act(base, { type: 'add', list: 'loads' }).loads[5]).toMatchObject({ node: base.nodes[0].id, fx: 0, fy: -10 });
    expect(act(convertTruss(base, 'si'), { type: 'add', list: 'loads' }).loads[5]).toMatchObject({ fx: 0, fy: -40 });
    expect(act(base, { type: 'add', list: 'loads', seed: { node: base.nodes[4].id, fx: 3 } }).loads[5]).toMatchObject({ node: base.nodes[4].id, fx: 3, fy: -10 });
    expect(act(emptyTruss(), { type: 'add', list: 'loads' }).loads.length).toBe(0);
    expect(act(emptyTruss(), { type: 'add', list: 'loads' }).notice).toEqual({ code: 'nothing-to-add', list: 'loads', why: 'no-node' });
  });

  it('the CAP: past 40 nodes, 120 members, 40 supports or 80 loads an add is refused and the notice says which', () => {
    let f = emptyTruss();
    for (let k = 0; k < MAX_NODES; k++) f = act(f, { type: 'add', list: 'nodes' });
    expect(f.nodes.length).toBe(MAX_NODES);
    const full = act(f, { type: 'add', list: 'nodes' });
    expect(full.nodes.length).toBe(MAX_NODES);
    expect(full.notice).toEqual({ code: 'limit', list: 'nodes', max: 40 });
    expect(full.nextId).toBe(f.nextId);
    // The next action clears the notice.
    expect(act(full, { type: 'add', list: 'loads' }).notice).toBeNull();
    // Supports: one node each.
    for (let k = 0; k < MAX_SUPPORTS; k++) f = act(f, { type: 'add', list: 'supports' });
    expect(f.supports.length).toBe(40);
    expect(act(f, { type: 'add', list: 'supports' }).notice).toEqual({ code: 'limit', list: 'supports', max: 40 });
    for (let k = 0; k < MAX_LOADS; k++) f = act(f, { type: 'add', list: 'loads' });
    expect(f.loads.length).toBe(80);
    expect(act(f, { type: 'add', list: 'loads' }).notice).toEqual({ code: 'limit', list: 'loads', max: 80 });
    for (let k = 0; k < MAX_MEMBERS + 5; k++) f = act(f, { type: 'add', list: 'members' });
    expect(f.members.length).toBe(MAX_MEMBERS);
    expect(act(f, { type: 'add', list: 'members' }).notice).toEqual({ code: 'limit', list: 'members', max: 120 });
    consistent(f);
    // A full form is still a form that is written and read.
    expect(normal(decodeTruss(encodeTruss(f))!)).toEqual(normal(f));
  });

  it('DELETING A NODE takes its members, supports and loads with it and says so, with the labels it had', () => {
    // Node 2 (label 2) of the default: bottom (8, 0). Members touching it: bottom 0-1 (label 1), 1-2 (2), vertical (9), diagonal T0-B1 (14).
    const gone = base.nodes[1].id;
    const f = act(base, { type: 'remove', list: 'nodes', id: gone });
    expect(f.nodes.length).toBe(9);
    const touching = base.members.map((m, k) => (m.i === gone || m.j === gone ? k + 1 : 0)).filter(Boolean);
    expect(f.notice).toEqual({ code: 'node-removed', node: 2, members: touching, supports: 0, loads: 0, renumbered: true, membersRenumbered: true });
    expect(f.members.length).toBe(17 - touching.length);
    expect(touching).toEqual([1, 2, 10, 14]);
    consistent(f);
    // A node with a support and a load: the pin at label 1 has no load; the top-left corner (label 6) has a load and no support.
    const corner = act(base, { type: 'remove', list: 'nodes', id: base.nodes[5].id });
    expect(corner.notice).toMatchObject({ node: 6, supports: 0, loads: 1, renumbered: true });
    const pin = act(base, { type: 'remove', list: 'nodes', id: base.nodes[0].id });
    expect(pin.notice).toMatchObject({ node: 1, supports: 1, loads: 0 });
    expect(pin.supports.length).toBe(1);
    // The LAST node renumbers nothing.
    const last = act(base, { type: 'remove', list: 'nodes', id: base.nodes[9].id });
    expect(last.notice).toMatchObject({ node: 10, renumbered: false });
    // The members of the last node are the last members but one: node 10's member 13 and diagonal 17 go, and member 14..16 close up.
    expect(last.notice).toMatchObject({ membersRenumbered: true });
    // Labels close up: what had label 3 has label 2; nothing else moved.
    expect(nodeLabel(f, base.nodes[2].id)).toBe(2);
    expect(nodeLabel(f, gone)).toBe(0);
    // A node that is not there: nothing happens, nothing is said.
    expect(act(base, { type: 'remove', list: 'nodes', id: 99999 })).toBe(base);
  });

  it('deleting every node leaves an empty truss that can be written and read', () => {
    let f = base;
    for (const n of base.nodes) f = act(f, { type: 'remove', list: 'nodes', id: n.id });
    expect(f).toMatchObject({ nodes: [], members: [], supports: [], loads: [] });
    expect(decodeTruss(encodeTruss(f))).toEqual({ ...f, notice: null, nextId: 1 });
  });

  it('deleting a member, a support or a load takes that row only; ids are never reused', () => {
    const m = act(base, { type: 'remove', list: 'members', id: base.members[3].id });
    expect(m.members.length).toBe(16);
    expect(m.nodes).toEqual(base.nodes);
    // The members after it moved up one number, and the form says so (B9); removing the last one renumbers nothing and says nothing.
    expect(m.notice).toEqual({ code: 'member-removed', member: 4 });
    expect(act(base, { type: 'remove', list: 'members', id: base.members[16].id }).notice).toBeNull();
    const s = act(base, { type: 'remove', list: 'supports', id: base.supports[0].id });
    expect(s.supports.length).toBe(1);
    const l = act(base, { type: 'remove', list: 'loads', id: base.loads[2].id });
    expect(l.loads.length).toBe(4);
    expect(act(base, { type: 'remove', list: 'loads', id: 424242 })).toBe(base);
    const again = act(m, { type: 'add', list: 'members', seed: { i: base.nodes[0].id, j: base.nodes[2].id } });
    expect(again.members[16].id).toBe(base.nextId);
    expect(ids(again)).not.toContain(base.members[3].id);
  });

  it('patch: a field is changed; what is not a field of the list, or not the right kind of value, is left alone', () => {
    const n = base.nodes[2].id;
    expect(act(base, { type: 'patch', list: 'nodes', id: n, patch: { x: 17, y: -2 } }).nodes[2]).toEqual({ id: n, x: 17, y: -2 });
    // A field that is not a number yet is NaN, and is kept: the engine says so against its row.
    expect(Number.isNaN(act(base, { type: 'patch', list: 'nodes', id: n, patch: { x: NaN } }).nodes[2].x)).toBe(true);
    expect(act(base, { type: 'patch', list: 'nodes', id: n, patch: { x: 'a', z: 4, id: 77 } })).toBe(base);
    expect(act(base, { type: 'patch', list: 'nodes', id: 999, patch: { x: 1 } })).toBe(base);
    const m = base.members[0].id;
    expect(act(base, { type: 'patch', list: 'members', id: m, patch: { A: 5, E: null } }).members[0]).toMatchObject({ A: 5, E: null });
    // A member moved to a node that exists; to one that does not: refused.
    expect(act(base, { type: 'patch', list: 'members', id: m, patch: { j: base.nodes[3].id } }).members[0].j).toBe(base.nodes[3].id);
    expect(act(base, { type: 'patch', list: 'members', id: m, patch: { j: 31337 } })).toBe(base);
    expect(act(base, { type: 'patch', list: 'supports', id: base.supports[1].id, patch: { kind: 'pin' } }).supports[1].kind).toBe('pin');
    expect(act(base, { type: 'patch', list: 'supports', id: base.supports[1].id, patch: { kind: 'slider' } })).toBe(base);
    expect(act(base, { type: 'patch', list: 'supports', id: base.supports[1].id, patch: { angle: 30 } }).supports[1]).toMatchObject({ kind: 'roller', angle: 30 });
    expect(act(base, { type: 'patch', list: 'loads', id: base.loads[0].id, patch: { fx: 3, node: base.nodes[7].id } }).loads[0]).toMatchObject({ fx: 3, node: base.nodes[7].id });
  });

  it('a template replaces the geometry, supports and loads, keeps the units and the section, and says what it changed', () => {
    const f = act(convertTruss(base, 'si'), { type: 'template', template: 'warren', params: { span: 12, height: 3, panels: 3, load: 20 } });
    expect(f.units).toBe('si');
    expect(f.E).toBe(200);
    expect(f.nodes.length).toBe(7);
    expect(f.nodes[4]).toMatchObject({ x: 2, y: 3 });
    expect(f.loads.map((l) => l.fy)).toEqual([-20, -20, -20]);
    expect(f.notice).toBeNull();
    consistent(f);
    expect(solveTruss(toEngine(f).model).ok).toBe(true);
    // Clamped: the notice carries it.
    const odd = act(base, { type: 'template', template: 'pratt', params: { panels: 5 } });
    expect(odd.notice).toEqual({ code: 'template', template: 'pratt', clamped: [{ field: 'panels', asked: 5, used: 6 }] });
    expect(odd.nodes.length).toBe(14);
    // The ids are new and the form reads back.
    expect(normal(decodeTruss(encodeTruss(odd))!)).toEqual(normal(odd));
    expect(odd.nextId).toBe(1 + 14 + 25 + 2 + 7);
    // Defaults are the unit system's.
    expect(act(convertTruss(base, 'si'), { type: 'template', template: 'cantilever' }).nodes[1].x).toBe(1.25);
  });

  it('every template builds a consistent form that is solved', () => {
    for (const id of ['triangle', 'king-post', 'queen-post', 'pratt', 'howe', 'warren', 'warren-verticals', 'fink', 'cantilever'] as const) {
      for (const units of ['us', 'si'] as const) {
        const f = act(convertTruss(base, units), { type: 'template', template: id });
        consistent(f);
        expect(solveTruss(toEngine(f).model).ok, `${id} ${units}`).toBe(true);
      }
    }
  });

  it('material sets the modulus for the unit system; typing another modulus makes it the visitor\'s own; the area is kept', () => {
    const al = act(base, { type: 'material', material: 'aluminum' });
    expect(al).toMatchObject({ material: 'aluminum', E: 10100, A: 4 });
    expect(act(al, { type: 'material', material: 'custom' }).E).toBe(10100);
    const own = act(al, { type: 'section', patch: { E: 12345 } });
    expect(own).toMatchObject({ material: 'custom', E: 12345 });
    // The listed value typed back stays the material.
    expect(act(base, { type: 'section', patch: { E: 29000 } }).material).toBe('steel');
    expect(act(base, { type: 'section', patch: { A: null } }).A).toBeNull();
    expect(act(base, { type: 'section', patch: { E: null } })).toMatchObject({ E: null, material: 'custom' });
    expect(act(base, { type: 'section', patch: {} })).toEqual(base);
  });

  it('the next edit of any kind takes a notice away', () => {
    const f = act(base, { type: 'remove', list: 'nodes', id: base.nodes[9].id });
    expect(f.notice).not.toBeNull();
    for (const action of [{ type: 'add', list: 'loads' }, { type: 'patch', list: 'nodes', id: f.nodes[0].id, patch: { x: 1 } }, { type: 'material', material: 'aluminum' }, { type: 'section', patch: { A: 3 } }] as TrussAction[]) {
      expect(act(f, action).notice, action.type).toBeNull();
    }
  });

  it('a long random walk of edits never leaves the form inconsistent, and each step reads back from its address', () => {
    const rand = rng(404);
    let f = base;
    const lists = ['nodes', 'members', 'supports', 'loads'] as const;
    for (let step = 0; step < 600; step++) {
      const r = rand();
      const list = lists[Math.floor(rand() * 4)];
      const row = f[list][Math.floor(rand() * Math.max(1, f[list].length))] as { id: number } | undefined;
      let action: TrussAction;
      if (r < 0.25) action = { type: 'add', list };
      else if (r < 0.4) action = { type: 'remove', list, id: row?.id ?? -1 };
      else if (r < 0.7) action = { type: 'patch', list, id: row?.id ?? -1, patch: { x: round8(rand() * 100), y: round8(rand() * 50), fx: round8(rand() * 9 - 4), fy: round8(-rand() * 20), angle: round8(rand() * 360), A: rand() < 0.3 ? null : round8(rand() * 9 + 0.5), E: rand() < 0.5 ? null : 29000, i: f.nodes[Math.floor(rand() * f.nodes.length)]?.id ?? -1, j: f.nodes[Math.floor(rand() * f.nodes.length)]?.id ?? -1, node: f.nodes[Math.floor(rand() * f.nodes.length)]?.id ?? -1 } };
      else if (r < 0.75) action = { type: 'units', units: f.units === 'us' ? 'si' : 'us' };
      else if (r < 0.8) action = { type: 'template', template: ['pratt', 'fink', 'warren', 'cantilever', 'triangle'][Math.floor(rand() * 5)] as 'pratt', params: { panels: Math.floor(rand() * 30) - 3 } };
      else if (r < 0.85) action = { type: 'material', material: ['steel', 'aluminum', 'custom'][Math.floor(rand() * 3)] as 'steel' };
      else if (r < 0.9) action = { type: 'add', list: lists[Math.floor(rand() * 4)] };
      else if (r < 0.95) action = { type: 'section', patch: { E: rand() < 0.5 ? null : round8(rand() * 30000), A: rand() < 0.5 ? null : round8(rand() * 9) } };
      else action = { type: 'remove', list: 'nodes', id: f.nodes[0]?.id ?? -1 };
      f = reduceTruss(f, action);
      consistent(f);
      if (step % 7 === 0) {
        const back = decodeTruss(encodeTruss(f));
        expect(back, `step ${step}`).not.toBeNull();
        expect(normal(back!)).toEqual(normal(f));
      }
    }
  });
});

describe('truss form: from the form to the engine', () => {
  it('the model has the nodes, members, supports and loads in the form\'s order, with node ids turned into indices', () => {
    const f = defaultTruss();
    const { model, rows } = toEngine(f);
    expect(model.nodes.length).toBe(10);
    expect(model.members[0]).toMatchObject({ i: 0, j: 1 });
    expect(model.members[16]).toMatchObject({ i: 3, j: 9 });
    expect(model.supports).toEqual([{ node: 0, kind: 'pin' }, { node: 4, kind: 'roller', angle: 90 }]);
    expect(model.loads.map((l) => [l.node, l.fy])).toEqual([[5, -5], [6, -10], [7, -10], [8, -10], [9, -5]]);
    expect(model.E).toBeCloseTo(29000 * 144, 6);
    expect(model.A).toBeCloseTo(4 / 144, 12);
    expect(rows.nodes).toEqual(f.nodes.map((n) => n.id));
    expect(rows.members).toEqual(f.members.map((m) => m.id));
  });
  it('a missing E or A is left out; an own section of a member crosses with the same factors', () => {
    let f = act(defaultTruss(), { type: 'section', patch: { E: null, A: null } });
    expect('E' in toEngine(f).model || 'A' in toEngine(f).model).toBe(false);
    f = act(f, { type: 'patch', list: 'members', id: f.members[0].id, patch: { A: 2, E: 10000 } });
    expect(toEngine(f).model.members[0]).toEqual({ i: 0, j: 1, A: 2 / 144, E: 10000 * 144 });
    expect(toEngine(f).model.members[1]).toEqual({ i: 1, j: 2 });
    const si = act(convertTruss(f, 'si'), { type: 'section', patch: { A: 1000 } });
    expect(toEngine(si).model.A).toBeCloseTo(1e-3, 15);
  });
  it('a pin carries no angle to the engine, a roller does', () => {
    const { model } = toEngine(defaultTruss());
    expect('angle' in model.supports[0]).toBe(false);
    expect(model.supports[1].angle).toBe(90);
  });
  it('a reference to a node that is not there is index −1, which the engine refuses and issueRow turns back into the row', () => {
    // Only a form made by hand can hold one; the reducer never makes one.
    const f = defaultTruss();
    const broken: TrussForm = { ...f, members: [...f.members.slice(0, 16), { ...f.members[16], j: 777 }], supports: [...f.supports, { id: 900, node: 888, kind: 'pin', angle: 90 }], loads: [...f.loads, { id: 901, node: 999, fx: 0, fy: 0 }] };
    const { model, rows } = toEngine(broken);
    const out = solveTruss(model);
    expect(out.ok).toBe(false);
    if (out.ok) return;
    const rowsOfIssues = out.issues.map((i) => ({ code: i.code, row: issueRow(i, rows) }));
    expect(rowsOfIssues).toContainEqual({ code: 'member-node', row: { list: 'members', id: f.members[16].id, field: 'j' } });
    expect(rowsOfIssues).toContainEqual({ code: 'support-node', row: { list: 'supports', id: 900 } });
    expect(rowsOfIssues).toContainEqual({ code: 'load-node', row: { list: 'loads', id: 901 } });
  });
  it('a field that is NaN is named against its row', () => {
    let f = defaultTruss();
    f = act(f, { type: 'patch', list: 'nodes', id: f.nodes[3].id, patch: { y: NaN } }, { type: 'patch', list: 'members', id: f.members[1].id, patch: { A: NaN } }, { type: 'section', patch: { E: -3 } });
    const { model, rows } = toEngine(f);
    const out = solveTruss(model);
    expect(out.ok).toBe(false);
    if (out.ok) return;
    const named = out.issues.map((i) => issueRow(i, rows));
    expect(named).toContainEqual({ list: 'nodes', id: f.nodes[3].id, field: 'y' });
    expect(named).toContainEqual({ list: 'members', id: f.members[1].id, field: 'A' });
    expect(named).toContainEqual({ list: 'model', field: 'E' });
    expect(issueRow({ code: 'mechanism', nodes: [1] }, rows)).toBeUndefined();
  });
});

/* ═══ The address ════════════════════════════════════════════════════════ */

/** A random form: any values a form can hold, to eight figures. */
function randomForm(rand: () => number): TrussForm {
  const pool = [0, 1, -1, 0.5, 12.5, -7.25, 1e-7, -1e-7, 1234567.8, 1e21, -2.5e-12, 3.1415927, 100, 29000, 0.001, 99999999, NaN, Infinity, -Infinity];
  const num = () => (rand() < 0.5 ? pool[Math.floor(rand() * pool.length)] : round8((rand() - 0.5) * 10 ** Math.floor(rand() * 10 - 3)));
  const positive = () => Math.abs(num()) || 1;
  const nNodes = Math.floor(rand() * 25);
  let id = 1;
  const nodes = Array.from({ length: nNodes }, () => ({ id: id++, x: num(), y: num() }));
  const pickNode = () => nodes[Math.floor(rand() * nodes.length)].id;
  const some = (count: number) => (nodes.length === 0 ? 0 : count);
  const members = Array.from({ length: some(Math.floor(rand() * 40)) }, () => ({ id: id++, i: pickNode(), j: pickNode(), A: rand() < 0.5 ? null : positive(), E: rand() < 0.5 ? null : positive() }));
  const supports = Array.from({ length: some(Math.floor(rand() * 8)) }, () => ({ id: id++, node: pickNode(), kind: (rand() < 0.5 ? 'pin' : 'roller') as 'pin' | 'roller', angle: num() }));
  const loads = Array.from({ length: some(Math.floor(rand() * 20)) }, () => ({ id: id++, node: pickNode(), fx: num(), fy: num() }));
  const material = (['steel', 'aluminum', 'custom'] as const)[Math.floor(rand() * 3)];
  return { units: rand() < 0.5 ? 'us' : 'si', nodes, members, supports, loads, material, E: rand() < 0.3 ? null : num(), A: rand() < 0.3 ? null : num(), notice: null, nextId: id };
}

describe('truss form: a truss in an address', () => {
  it('the key is t, and an address is made of characters that need no escaping in a link', () => {
    expect(TRUSS_KEY).toBe('t');
    expect(encodeTruss(defaultTruss())).toMatch(/^[A-Za-z0-9.,;_-]+$/);
    expect(encode).toBe(encodeTruss);
    expect(decode).toBe(decodeTruss);
  });

  it('the default truss: the address, its length, and that it begins with the shared check and the version', () => {
    const text = encodeTruss(defaultTruss());
    const body = text.slice(text.indexOf(';') + 1);
    expect(text.startsWith(checkOf(body) + ';')).toBe(true);
    expect(body).toBe('1;us;s,29000,4;0,0_8,0_16,0_24,0_32,0_0,8_8,8_16,8_24,8_32,8;1,2_2,3_3,4_4,5_6,7_7,8_8,9_9,10_1,6_2,7_3,8_4,9_5,10_6,2_7,3_3,9_4,10;p,1,90_r,5,90;6,0,-5_7,0,-10_8,0,-10_9,0,-10_10,0,-5');
    expect(text.length).toBeLessThan(400);
  });

  it('1,000 random forms come back as themselves — every value a form can hold, NaN and the infinities included', () => {
    const rand = rng(31);
    for (let t = 0; t < 1000; t++) {
      const f = randomForm(rand);
      const text = encodeTruss(f);
      expect(text.length).toBeLessThan(MAX_LINK);
      const back = decodeTruss(text);
      expect(back, text).not.toBeNull();
      expect(normal(back!)).toEqual(normal(f));
      // And the ids are fresh, in the order a link numbers them.
      expect(back!.nextId).toBe(1 + back!.nodes.length + back!.members.length + back!.supports.length + back!.loads.length);
      consistent(back!);
      // Written again, the same text.
      expect(encodeTruss(back!)).toBe(text);
    }
  });

  it('the rows of a template read back too, and a case with a deleted node (ids with a gap) is written by label', () => {
    const f = act(defaultTruss(), { type: 'remove', list: 'nodes', id: defaultTruss().nodes[2].id });
    expect(decodeTruss(encodeTruss(f))!.nodes.length).toBe(9);
    expect(normal(decodeTruss(encodeTruss(f))!)).toEqual(normal(f));
  });

  it('a pin remembers the angle it will have as a roller; a member with only an E keeps it', () => {
    let f = defaultTruss();
    f = act(f, { type: 'patch', list: 'supports', id: f.supports[0].id, patch: { angle: 33.5 } }, { type: 'patch', list: 'members', id: f.members[0].id, patch: { E: 1234 } }, { type: 'patch', list: 'members', id: f.members[1].id, patch: { A: 2.5 } });
    const back = decodeTruss(encodeTruss(f))!;
    expect(back.supports[0]).toMatchObject({ kind: 'pin', angle: 33.5 });
    expect(back.members[0]).toMatchObject({ A: null, E: 1234 });
    expect(back.members[1]).toMatchObject({ A: 2.5, E: null });
  });

  it('what it cannot read is null: the empty string, and things that are not even strings', () => {
    for (const bad of ['', ' ', 'x', ';', ';;;;;;', 'K;', encodeTruss(defaultTruss()) + 'x', undefined, null, 5, {}, []]) expect(decodeTruss(bad as string)).toBeNull();
  });

  /** An address, damaged and given a check that matches, so that only the reading of the body can refuse it. */
  const sealed = (body: string) => `${checkOf(body)};${body}`;
  const good = ['1', 'us', 's,29000,4', '0,0_4,0_2,3', '1,2_2,3_1,3', 'p,1,90_r,2,90', '3,0,-10'];
  const withField = (k: number, value: string) => sealed(good.map((p, i) => (i === k ? value : p)).join(';'));

  it('the pieces of a good address are read (the control for the refusals below)', () => {
    expect(decodeTruss(sealed(good.join(';')))).not.toBeNull();
  });

  it('refuses a body that is not what it says: version, units, material, field count', () => {
    expect(decodeTruss(withField(0, '2'))).toBeNull();
    expect(decodeTruss(withField(0, ''))).toBeNull();
    expect(decodeTruss(withField(1, 'imperial'))).toBeNull();
    expect(decodeTruss(withField(2, 'q,29000,4'))).toBeNull();
    expect(decodeTruss(withField(2, 's,29000'))).toBeNull();
    expect(decodeTruss(withField(2, 's,29000,4,5'))).toBeNull();
    expect(decodeTruss(sealed(good.slice(0, 6).join(';')))).toBeNull();
    expect(decodeTruss(sealed([...good, 'extra'].join(';')))).toBeNull();
    // Without units there are fewer fields: not a truss.
    expect(decodeTruss(sealed(good.filter((_, i) => i !== 1).join(';')))).toBeNull();
  });

  it('refuses a number written any way but the page\'s own', () => {
    for (const bad of ['+5', '.5', '5.', '0x10', '1e999', 'Infinity', 'NaN', '--5', '5e', '1,5', '٣', '5 ', 'e5', '1_0', 'nan1']) {
      expect(decodeTruss(withField(3, `${bad},0_4,0_2,3`)), bad).toBeNull();
      expect(decodeTruss(withField(6, `3,${bad},-10`)), bad).toBeNull();
    }
    // The named ones are the page's own.
    expect(decodeTruss(withField(6, '3,nan,-inf'))).not.toBeNull();
    expect(decodeTruss(withField(6, '3,inf,-nan'))).toBeNull();
    // An empty number in a coordinate is not a number; in an optional field it is "not given".
    expect(decodeTruss(withField(3, ',0_4,0_2,3'))).toBeNull();
    expect(decodeTruss(withField(2, 's,,'))).not.toBeNull();
  });

  it('refuses references to nodes that are not in the list, or are not written as a plain count', () => {
    for (const bad of ['0', '4', '99', '-1', '01', '1.5', 'a', '', '1e0', '+1']) {
      expect(decodeTruss(withField(4, `1,${bad}_2,3`)), `member ${bad}`).toBeNull();
      expect(decodeTruss(withField(4, `${bad},2_2,3`)), `member ${bad}`).toBeNull();
      expect(decodeTruss(withField(5, `p,${bad},90`)), `support ${bad}`).toBeNull();
      expect(decodeTruss(withField(6, `${bad},0,-10`)), `load ${bad}`).toBeNull();
    }
  });

  it('refuses rows with the wrong number of fields, and supports of a kind that is none', () => {
    expect(decodeTruss(withField(3, '0,0_4_2,3'))).toBeNull();
    expect(decodeTruss(withField(3, '0,0,0_4,0_2,3'))).toBeNull();
    expect(decodeTruss(withField(4, '1_2,3'))).toBeNull();
    expect(decodeTruss(withField(4, '1,2,,,'))).toBeNull();
    expect(decodeTruss(withField(5, 'p,1_r,2,90'))).toBeNull();
    expect(decodeTruss(withField(5, 'x,1,90_r,2,90'))).toBeNull();
    expect(decodeTruss(withField(5, 'r,1,90,5'))).toBeNull();
    expect(decodeTruss(withField(6, '3,0'))).toBeNull();
    expect(decodeTruss(withField(6, '3,0,-10,1'))).toBeNull();
    expect(decodeTruss(withField(6, '3,0,-10__3,0,-10'))).toBeNull();
    expect(decodeTruss(withField(6, '_3,0,-10'))).toBeNull();
  });

  it('refuses more rows than the cap — exactly at the cap it reads', () => {
    const rows = (n: number, row: (k: number) => string) => Array.from({ length: n }, (_, k) => row(k)).join('_');
    const nodes = (n: number) => rows(n, (k) => `${k},${k % 3}`);
    const body = (nn: number, mm: number, ss: number, ll: number) => ['1', 'us', 's,29000,4', nodes(nn), rows(mm, (k) => `1,${(k % (nn - 1)) + 2}`), rows(ss, () => 'p,1,90'), rows(ll, () => '1,0,-1')].join(';');
    expect(decodeTruss(sealed(body(40, 120, 40, 80)))).not.toBeNull();
    expect(decodeTruss(sealed(body(41, 1, 1, 1)))).toBeNull();
    expect(decodeTruss(sealed(body(40, 121, 1, 1)))).toBeNull();
    expect(decodeTruss(sealed(body(40, 1, 41, 1)))).toBeNull();
    expect(decodeTruss(sealed(body(40, 1, 1, 81)))).toBeNull();
  });

  it('refuses an address longer than the longest a form can write', () => {
    expect(decodeTruss('K' + '0'.repeat(MAX_LINK))).toBeNull();
    expect(decodeTruss(encodeTruss(defaultTruss()) + '0'.repeat(MAX_LINK))).toBeNull();
  });

  it('the longest address a form can write fits under MAX_LINK, and reads back', () => {
    // 40 nodes, 120 members with both sections, 40 supports, 80 loads, every number as long as a number is written.
    const long = [-1.2345678e-10, 1.2345678e21, -123456.78, 0.00012345, 1.5e300, -5e-324];
    const longest = long.reduce((a, b) => (round8(b).toString().length > a.toString().length ? b : a));
    const n = (k: number) => (k % 2 === 0 ? long[k % long.length] : -long[k % long.length]);
    const nodes = Array.from({ length: 40 }, (_, k) => ({ id: k + 1, x: n(k), y: n(k + 1) }));
    const members = Array.from({ length: 120 }, (_, k) => ({ id: 41 + k, i: 40 - (k % 40), j: 1 + (k % 40), A: n(k), E: n(k + 3) }));
    const supports = Array.from({ length: 40 }, (_, k) => ({ id: 161 + k, node: k + 1, kind: 'roller' as const, angle: n(k) }));
    const loads = Array.from({ length: 80 }, (_, k) => ({ id: 201 + k, node: 40 - (k % 40), fx: n(k), fy: n(k + 2) }));
    const f: TrussForm = { units: 'si', nodes, members, supports, loads, material: 'custom', E: longest, A: longest, notice: null, nextId: 281 };
    const text = encodeTruss(f);
    expect(text.length).toBeLessThan(MAX_LINK);
    expect(text.length).toBeGreaterThan(MAX_LINK / 3);
    expect(normal(decodeTruss(text)!)).toEqual(normal(f));
  });

  it('a link that lost part of itself, or changed, is not a link to another truss: every single-character change of the default, and every cut, is refused', () => {
    const text = encodeTruss(defaultTruss());
    for (let cut = 0; cut < text.length; cut++) expect(decodeTruss(text.slice(0, cut)), `cut at ${cut}`).toBeNull();
    const alphabet = '0123456789abcdefKxyz;,_.-e';
    for (let k = 0; k < text.length; k++) {
      for (const c of alphabet) {
        if (c === text[k]) continue;
        expect(decodeTruss(text.slice(0, k) + c + text.slice(k + 1)), `${k} → ${c}`).toBeNull();
      }
    }
    // A character more, anywhere.
    for (let k = 0; k <= text.length; k += 3) expect(decodeTruss(text.slice(0, k) + '0' + text.slice(k))).toBeNull();
    // Two characters swapped.
    for (let k = 0; k + 1 < text.length; k++) {
      if (text[k] !== text[k + 1]) expect(decodeTruss(text.slice(0, k) + text[k + 1] + text[k] + text.slice(k + 2)), `swap ${k}`).toBeNull();
    }
  });

  it('FUZZ: a hundred thousand strings — random, mutated links, spliced links — never throw, and what is read is a consistent form that writes back as itself', () => {
    const rand = rng(2026);
    const samples = [encodeTruss(defaultTruss()), encodeTruss(emptyTruss()), ...Array.from({ length: 6 }, () => encodeTruss(randomForm(rand)))];
    const chars = '0123456789;,_.-eKabcdefghijklmnopqrstuvwxyz +%\u0000￿';
    let read = 0;
    for (let t = 0; t < 100000; t++) {
      let s: string;
      const r = rand();
      if (r < 0.3) s = Array.from({ length: Math.floor(rand() * 80) }, () => chars[Math.floor(rand() * chars.length)]).join('');
      else if (r < 0.6) {
        const base = samples[Math.floor(rand() * samples.length)];
        const k = Math.floor(rand() * base.length);
        s = base.slice(0, k) + chars[Math.floor(rand() * chars.length)] + base.slice(k + Math.floor(rand() * 3));
      } else if (r < 0.8) {
        const a = samples[Math.floor(rand() * samples.length)];
        const b = samples[Math.floor(rand() * samples.length)];
        s = a.slice(0, Math.floor(rand() * a.length)) + b.slice(Math.floor(rand() * b.length));
      } else {
        // A good body with a matching check but a damaged field: only the reading can refuse it.
        const base = samples[Math.floor(rand() * samples.length)];
        const body = base.slice(base.indexOf(';') + 1);
        const parts = body.split(';');
        const f = Math.floor(rand() * parts.length);
        parts[f] = Array.from({ length: Math.floor(rand() * 20) }, () => chars[Math.floor(rand() * chars.length)]).join('');
        const damaged = parts.join(';');
        s = `${checkOf(damaged)};${damaged}`;
      }
      let out: TrussForm | null;
      try {
        out = decodeTruss(s);
      } catch (e) {
        throw new Error(`threw on ${JSON.stringify(s)}: ${e}`);
      }
      if (out !== null) {
        read++;
        consistent(out);
        expect(encodeTruss(out)).toBe(encodeTruss(decodeTruss(encodeTruss(out))!));
      }
    }
    // The fuzz is not vacuous: some damaged-but-sealed bodies do read (a damaged field that is still a field), and most do not.
    expect(read).toBeGreaterThan(100);
    expect(read).toBeLessThan(40000);
  });
});

/* ═══ Review fixes: A6, B2, B7, B12 ═══════════════════════════════════════ */

describe('truss form: switching units keeps the geometry exact (A6, B7)', () => {
  const TEMPLATES = ['triangle', 'king-post', 'queen-post', 'pratt', 'howe', 'warren', 'warren-verticals', 'fink', 'cantilever'] as const;

  it('a truss that carries nothing in a member in feet carries nothing in it in metres, for every template at awkward spans', () => {
    let checked = 0;
    for (const id of TEMPLATES) {
      for (const span of [24, 31.7, 33.3333, 40.5, 100]) {
        for (const panels of [2, 6]) {
          let f = act(emptyTruss('us'), { type: 'template', template: id, params: { span, height: span / 4, panels, load: 10 } });
          f = act(f, { type: 'section', patch: { A: 4 } });
          const us = solveTruss(toEngine(f).model);
          const si = solveTruss(toEngine(convertTruss(f, 'si')).model);
          if (!us.ok || !si.ok) continue;
          checked++;
          // Which members are zero, and which are zero by inspection, do not change with the unit.
          expect(si.members.map((m) => m.zero), `${id} ${span} ${panels}`).toEqual(us.members.map((m) => m.zero));
          expect(si.inspection.length, `${id} ${span} ${panels}`).toBe(us.inspection.length);
        }
      }
    }
    expect(checked).toBeGreaterThan(70);
  });

  it('the reviewer’s cases: a 31.7 ft Warren of 2 panels and a queen post of 31.7 ft keep their zero members', () => {
    const warren = act(emptyTruss('us'), { type: 'template', template: 'warren', params: { span: 31.7, height: 31.7 / 4, panels: 2, load: 10 } });
    const queen = act(emptyTruss('us'), { type: 'template', template: 'queen-post', params: { span: 31.7, height: 31.7 / 4, load: 10 } });
    for (const f of [warren, queen]) {
      const us = solveTruss(toEngine(f).model);
      const si = solveTruss(toEngine(convertTruss(f, 'si')).model);
      if (!us.ok || !si.ok) throw new Error('not solved');
      const zeros = us.members.filter((m) => m.zero).length;
      expect(zeros).toBeGreaterThan(0);
      expect(si.members.filter((m) => m.zero).length).toBe(zeros);
    }
  });

  it('a value comes back as the very number it was, up to twelve figures, in either direction', () => {
    const rand = rng(88);
    for (let t = 0; t < 400; t++) {
      const f = act(defaultTruss(), { type: 'patch', list: 'nodes', id: defaultTruss().nodes[3].id, patch: { x: Number((rand() * 90).toPrecision(1 + (t % 12))) } }, { type: 'section', patch: { A: Number((rand() * 20).toPrecision(1 + ((t + 5) % 12))) } });
      expect(normal(convertTruss(convertTruss(f, 'si'), 'us'))).toEqual(normal(f));
    }
    // Five-figure values, which the beam’s rounding moved by a tenth of a percent.
    const odd = act(defaultTruss(), { type: 'section', patch: { A: 8.8701 } }, { type: 'patch', list: 'nodes', id: defaultTruss().nodes[3].id, patch: { x: 894.37 } });
    expect(convertTruss(convertTruss(odd, 'si'), 'us')).toEqual(odd);
  });

  it('a member’s own modulus that is a listed one is the listed one in the other system, and comes back', () => {
    const f = act(defaultTruss(), { type: 'patch', list: 'members', id: defaultTruss().members[0].id, patch: { E: 29000 } }, { type: 'patch', list: 'members', id: defaultTruss().members[1].id, patch: { E: 10100 } }, { type: 'patch', list: 'members', id: defaultTruss().members[2].id, patch: { E: 30000 } });
    const si = convertTruss(f, 'si');
    expect(si.members[0].E).toBe(200);
    expect(si.members[1].E).toBe(69.6);
    expect(si.members[2].E).toBeCloseTo(206.8427, 3);
    expect(convertTruss(si, 'us')).toEqual(f);
  });

  it('the template group’s numbers are converted with the units, and its shape is kept (B7)', () => {
    const inputs = { template: 'warren' as const, span: 40, height: 10, panels: 6, load: 12, supports: 'two-pins' as const };
    const si = convertTemplateInputs(inputs, 'us', 'si');
    expect(si).toMatchObject({ template: 'warren', panels: 6, supports: 'two-pins' });
    expect(si.span).toBeCloseTo(12.192, 9);
    expect(si.height).toBeCloseTo(3.048, 9);
    expect(si.load).toBeCloseTo(12 * 4.4482216152605, 9);
    expect(convertTemplateInputs(si, 'si', 'us')).toEqual(inputs);
    expect(convertTemplateInputs(inputs, 'us', 'us')).toBe(inputs);
  });

  it('a truss converted to SI is written in an address and read back as that truss, every figure', () => {
    const f = convertTruss(act(emptyTruss('us'), { type: 'template', template: 'warren', params: { span: 33.3333, height: 8.3333, panels: 6, load: 10 } }), 'si');
    expect(normal(decodeTruss(encodeTruss(f))!)).toEqual(normal(f));
    // …and the link still ends under its cap, with the longest number it can write.
    expect(encodeTruss(f).length).toBeLessThan(MAX_LINK);
  });
});

describe('truss form: a node added past a large one keeps its figures (B12)', () => {
  it('123,456 plus the step is 123,464 and not 123,500', () => {
    const f = act(emptyTruss('us'), { type: 'add', list: 'nodes', seed: { x: 123456, y: 0 } }, { type: 'add', list: 'nodes' });
    expect(f.nodes[1].x).toBe(123464);
  });
});

describe('truss form: what "Load template" and "Start over" leave behind (B2)', () => {
  const EXAMPLE_LINK = encodeTruss(defaultTruss());
  it('a truss that was edited is left behind by a template, and the example is not', () => {
    const edited = act(defaultTruss(), { type: 'patch', list: 'loads', id: defaultTruss().loads[1].id, patch: { fy: -12 } });
    const template: TrussAction = { type: 'template', template: 'howe', params: { span: 40 } };
    expect(leavesBehind(edited, act(edited, template), EXAMPLE_LINK)).toBe(true);
    // The example is one press of "Start over" away: nothing to keep.
    expect(leavesBehind(defaultTruss(), act(defaultTruss(), template), EXAMPLE_LINK)).toBe(false);
    // A template that builds what is there already changes nothing.
    const built = act(edited, template);
    expect(leavesBehind(built, act(built, template), EXAMPLE_LINK)).toBe(false);
  });
  it('"Start over" on an edited truss leaves it behind, on the example it does not', () => {
    const edited = act(defaultTruss(), { type: 'add', list: 'nodes' });
    expect(leavesBehind(edited, defaultTruss(), EXAMPLE_LINK)).toBe(true);
    expect(leavesBehind(defaultTruss(), defaultTruss(), EXAMPLE_LINK)).toBe(false);
  });
});
