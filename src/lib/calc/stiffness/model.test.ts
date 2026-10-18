import { afterEach, describe, expect, it, vi } from 'vitest';
import { checkOf } from '../beam/model';
import { analyseSafely } from './analysis';
import { normal, randomForm, randomNumber } from './forms.testlib';
import {
  CALCULATION_UNITS,
  DEFAULT_SECTION,
  FROM_ENGINE,
  LIMITS,
  MAX_LINK,
  STIFFNESS_KEY,
  STIFFNESS_MATERIALS,
  STIFFNESS_UNITS,
  TO_ENGINE,
  convertStiffness,
  decode,
  decodeStiffness,
  defaultCase,
  emptyStiffness,
  encode,
  encodeStiffness,
  freePosition,
  issueRow,
  leavesBehind,
  memberLabel,
  memberLength,
  nodeLabel,
  presetOf,
  reduce,
  settlementOf,
  toEngine,
  type StiffnessForm,
} from './model';
import { rng } from './oracle.testlib';
import { solve } from './engine';
import { TEMPLATE_IDS } from './templates';

vi.setConfig({ testTimeout: 120_000 });
afterEach(() => new Promise((r) => setTimeout(r, 0)));

/** The EXAMPLE as its address writes it: a link written once and kept for ever, so that this text must never change. */
const EXAMPLE = 'K4nzqqdvy1o;1;t;us;s,29000,10,100;0,0_16,0_8,6;1,3_2,3;1,3_2,3;3,20,-30;';

const IDENTIFIERS = new Set(['id', 'i', 'j', 'node', 'member', 'nextId']);
const NUMERIC_FIELDS = new Set(['x', 'y', 'E', 'A', 'I', 'dx', 'dy', 'dr', 'fx', 'fy', 'm', 'w', 'P', 'a', 'q']);

describe('the example', () => {
  it('is the two-bar truss of the textbooks', () => {
    const f = defaultCase();
    expect(f.mode).toBe('truss');
    expect(f.units).toBe('us');
    expect(f.nodes.map((n) => [n.x, n.y])).toEqual([[0, 0], [16, 0], [8, 6]]);
    expect(f.members.map((m) => [nodeLabel(f, m.i), nodeLabel(f, m.j)])).toEqual([[1, 3], [2, 3]]);
    expect(f.supports.map((s) => [nodeLabel(f, s.node), s.ux, s.uy, s.rz])).toEqual([[1, true, true, false], [2, true, true, false]]);
    expect(f.loads.map((l) => [nodeLabel(f, l.node), l.fx, l.fy, l.m])).toEqual([[3, 20, -30, 0]]);
    expect([f.E, f.A, f.I, f.material]).toEqual([29000, 10, 100, 'steel']);
    expect(f.notice).toBeNull();
  });
  it('is written as the address it has always been written as', () => {
    expect(encode(defaultCase())).toBe(EXAMPLE);
    expect(STIFFNESS_KEY).toBe('m');
  });
  it('comes back from its own address, id for id', () => {
    expect(decode(encode(defaultCase()))).toEqual(defaultCase());
  });
  it('every shell name is the model name', () => {
    expect(encode).toBe(encodeStiffness);
    expect(decode).toBe(decodeStiffness);
  });
  it('has the answer in its comments: bars of -12.5 and -37.5 kip, reactions (10, 7.5) and (-30, 22.5)', () => {
    const out = solve(toEngine(defaultCase()).model);
    if (!out.ok) throw new Error(JSON.stringify(out.issues));
    expect(out.forces.map((f) => f.bar!.N)).toEqual([expect.closeTo(-12.5, 9), expect.closeTo(-37.5, 9)]);
    expect(out.reactions.map((r) => r.value)).toEqual([expect.closeTo(10, 9), expect.closeTo(7.5, 9), expect.closeTo(-30, 9), expect.closeTo(22.5, 9)]);
  });
});

describe('the reducer returns the form it is given, not a copy', () => {
  it("'load' returns that form itself", () => {
    const a = defaultCase();
    const b = reduce(emptyStiffness('si', 'frame'), { type: 'template', template: 'frame-portal' });
    expect(reduce(a, { type: 'load', form: b })).toBe(b);
  });
  it("'reset' with a form returns that form itself, without one the example", () => {
    const a = reduce(defaultCase(), { type: 'add', list: 'nodes' });
    const b = defaultCase();
    expect(reduce(a, { type: 'reset', form: b })).toBe(b);
    expect(reduce(a, { type: 'reset' })).toEqual(defaultCase());
  });
  it('an edit that changes nothing returns the form itself', () => {
    const f = defaultCase();
    expect(reduce(f, { type: 'patch', list: 'nodes', id: 999, patch: { x: 1 } })).toBe(f);
    expect(reduce(f, { type: 'patch', list: 'nodes', id: f.nodes[0].id, patch: { nonsense: 1 } })).toBe(f);
    expect(reduce(f, { type: 'remove', list: 'nodes', id: 999 })).toBe(f);
    expect(reduce(f, { type: 'mode', mode: 'truss' })).toBe(f);
  });
});

describe('no choice is a number', () => {
  it('on 150 random forms every number in the form is a typed one or a reference', () => {
    for (let seed = 1; seed <= 150; seed++) {
      const form = randomForm(seed);
      const walk = (value: unknown, key: string) => {
        if (typeof value === 'number') expect(IDENTIFIERS.has(key) || NUMERIC_FIELDS.has(key), `key ${key} (seed ${seed})`).toBe(true);
        else if (Array.isArray(value)) value.forEach((v) => walk(v, key));
        else if (value && typeof value === 'object') for (const [k, v] of Object.entries(value)) if (k !== 'notice') walk(v, k);
      };
      walk(form, '');
    }
  });
});

describe('add: a free, valid row in every list', () => {
  it('a node goes beside the last one and never on another', () => {
    let f = emptyStiffness('us');
    for (let k = 0; k < LIMITS.nodes; k++) f = reduce(f, { type: 'add', list: 'nodes' });
    expect(f.nodes).toHaveLength(LIMITS.nodes);
    const seen = new Set(f.nodes.map((n) => `${n.x},${n.y}`));
    expect(seen.size).toBe(f.nodes.length);
  });
  it('a member goes between two nodes that have none, and never twice on one pair', () => {
    let f = emptyStiffness('si');
    for (let k = 0; k < 5; k++) f = reduce(f, { type: 'add', list: 'nodes' });
    for (let k = 0; k < 10; k++) {
      f = reduce(f, { type: 'add', list: 'members' });
      expect(f.notice).toBeNull();
    }
    const pairs = new Set(f.members.map((m) => [Math.min(m.i, m.j), Math.max(m.i, m.j)].join('-')));
    expect(pairs.size).toBe(10);
    // 5 nodes have exactly 10 pairs: the next add has nothing to add, and says why.
    const refused = reduce(f, { type: 'add', list: 'members' });
    expect(refused.members).toHaveLength(10);
    expect(refused.notice).toEqual({ code: 'nothing-to-add', list: 'members', why: 'pairs' });
  });
  it('a member with fewer than two nodes says so', () => {
    expect(reduce(emptyStiffness(), { type: 'add', list: 'members' }).notice).toEqual({ code: 'nothing-to-add', list: 'members', why: 'few-nodes' });
  });
  it('every pair at one place says so', () => {
    let f = emptyStiffness();
    f = reduce(f, { type: 'add', list: 'nodes', seed: { x: 1, y: 1 } });
    f = reduce(f, { type: 'add', list: 'nodes', seed: { x: 1, y: 1 } });
    expect(reduce(f, { type: 'add', list: 'members' }).notice).toEqual({ code: 'nothing-to-add', list: 'members', why: 'coincident' });
  });
  it('a support goes on a node that has none; a truss gets a pin, then rollers; a frame a fixed support, then pins', () => {
    let t = reduce(emptyStiffness('us', 'truss'), { type: 'template', template: 'truss-five-member' });
    t = { ...t, supports: [] };
    for (let k = 0; k < 4; k++) t = reduce(t, { type: 'add', list: 'supports' });
    expect(t.supports.map((s) => presetOf(s, 'truss'))).toEqual(['pin', 'roller', 'roller', 'roller']);
    expect(new Set(t.supports.map((s) => s.node)).size).toBe(4);
    expect(reduce(t, { type: 'add', list: 'supports' }).notice).toEqual({ code: 'nothing-to-add', list: 'supports', why: 'nodes' });
    let fr = reduce(emptyStiffness('us', 'frame'), { type: 'template', template: 'frame-l' });
    fr = { ...fr, supports: [] };
    for (let k = 0; k < 3; k++) fr = reduce(fr, { type: 'add', list: 'supports' });
    expect(fr.supports.map((s) => presetOf(s))).toEqual(['fixed', 'pin', 'pin']);
  });
  it('a support seeded with a preset, or with a node that has one already, is placed sensibly', () => {
    const f = reduce(emptyStiffness(), { type: 'template', template: 'frame-l' });
    const g = reduce(f, { type: 'add', list: 'supports', seed: { preset: 'roller' } });
    expect(g.supports[g.supports.length - 1]).toMatchObject({ ux: false, uy: true, rz: false });
    // seeding the node of the existing support does not make a second one at it
    const h = reduce(f, { type: 'add', list: 'supports', seed: { node: f.supports[0].node } });
    expect(new Set(h.supports.map((s) => s.node)).size).toBe(h.supports.length);
  });
  it('a support with no node says so', () => {
    expect(reduce(emptyStiffness(), { type: 'add', list: 'supports' }).notice).toEqual({ code: 'nothing-to-add', list: 'supports', why: 'no-node' });
    expect(reduce(emptyStiffness(), { type: 'add', list: 'loads' }).notice).toEqual({ code: 'nothing-to-add', list: 'loads', why: 'no-node' });
  });
  it('a load goes on the highest node without one', () => {
    let f = reduce(emptyStiffness(), { type: 'template', template: 'truss-three-bar' });
    f = { ...f, loads: [] };
    f = reduce(f, { type: 'add', list: 'loads' });
    expect(nodeLabel(f, f.loads[0].node)).toBe(1);
    f = reduce(f, { type: 'add', list: 'loads' });
    expect(nodeLabel(f, f.loads[1].node)).toBe(2);
  });
  it('point loads are given distinct positions, strictly inside their member, and the structure still solves', () => {
    let f = reduce(emptyStiffness(), { type: 'template', template: 'frame-propped' });
    f = { ...f, memberLoads: [] };
    for (let k = 0; k < 15; k++) f = reduce(f, { type: 'add', list: 'memberLoads', seed: { kind: 'point' } });
    const L = memberLength(f, f.members[0]);
    const at = f.memberLoads.map((l) => l.a);
    expect(new Set(at).size).toBe(15);
    for (const a of at) {
      expect(a).toBeGreaterThan(0);
      expect(a).toBeLessThan(L);
    }
    expect(analyseSafely(f).issues).toEqual([]);
  });
  it('a member load goes on the member with the fewest loads, the longest first; none in truss mode, and it says why', () => {
    let f = reduce(emptyStiffness(), { type: 'template', template: 'frame-l' });
    f = { ...f, memberLoads: [] };
    f = reduce(f, { type: 'add', list: 'memberLoads' });
    expect(memberLabel(f, f.memberLoads[0].member)).toBe(1); // the 12 ft column is longer than the 10 ft beam
    f = reduce(f, { type: 'add', list: 'memberLoads' });
    expect(memberLabel(f, f.memberLoads[1].member)).toBe(2);
    const t = reduce(f, { type: 'mode', mode: 'truss' });
    const refused = reduce(t, { type: 'add', list: 'memberLoads' });
    expect(refused.memberLoads).toHaveLength(2);
    expect(refused.notice).toEqual({ code: 'nothing-to-add', list: 'memberLoads', why: 'truss-mode' });
    expect(reduce(reduce(emptyStiffness('us', 'frame'), { type: 'add', list: 'nodes' }), { type: 'add', list: 'memberLoads' }).notice).toEqual({ code: 'nothing-to-add', list: 'memberLoads', why: 'no-member' });
  });
  it('a refused add past a cap says so and changes nothing else', () => {
    for (const list of ['nodes', 'members', 'supports', 'loads', 'memberLoads'] as const) {
      let f = reduce(emptyStiffness('us', 'frame'), { type: 'template', template: 'frame-portal' });
      // fill the list to its cap by hand
      const base = f[list];
      const rows = Array.from({ length: LIMITS[list] }, (_, k) => ({ ...(base[0] as object), id: 1000 + k }));
      f = { ...f, [list]: rows } as StiffnessForm;
      const g = reduce(f, { type: 'add', list });
      expect(g[list]).toHaveLength(LIMITS[list]);
      expect(g.notice).toEqual({ code: 'limit', list, max: LIMITS[list] });
      expect(g.nextId).toBe(f.nextId);
    }
  });
  it('the caps are the ones in the contract', () => {
    expect(LIMITS).toEqual({ nodes: 12, members: 20, supports: 12, loads: 40, memberLoads: 24 });
  });
});

describe('remove', () => {
  it('a node takes its members, their loads, its support and its loads with it, and the notice is true', () => {
    const f0 = reduce(emptyStiffness(), { type: 'template', template: 'truss-five-member' });
    // node 2 has: members 1, 3, 5; a roller; no load
    const node2 = f0.nodes[1];
    const f = reduce(f0, { type: 'remove', list: 'nodes', id: node2.id });
    expect(f.nodes).toHaveLength(3);
    expect(f.members).toHaveLength(2);
    expect(f.supports).toHaveLength(1);
    expect(f.notice).toEqual({ code: 'node-removed', node: 2, members: [1, 3, 5], supports: 1, loads: 0, memberLoads: 0, renumbered: true, membersRenumbered: true });
    // every row that remains refers to a node that is there
    for (const m of f.members) expect(f.nodes.some((n) => n.id === m.i) && f.nodes.some((n) => n.id === m.j)).toBe(true);
  });
  it('removing the last node renumbers nothing, and says so', () => {
    const f0 = defaultCase();
    const f = reduce(f0, { type: 'remove', list: 'nodes', id: f0.nodes[2].id });
    expect(f.notice).toEqual({ code: 'node-removed', node: 3, members: [1, 2], supports: 0, loads: 1, memberLoads: 0, renumbered: false, membersRenumbered: false });
  });
  it('removing a member takes its loads; the last member renumbers nothing', () => {
    const f0 = reduce(emptyStiffness(), { type: 'template', template: 'frame-l' });
    const f = reduce(f0, { type: 'remove', list: 'members', id: f0.members[0].id });
    expect(f.notice).toEqual({ code: 'member-removed', member: 1, memberLoads: 0, renumbered: true });
    const g = reduce(f0, { type: 'remove', list: 'members', id: f0.members[1].id });
    expect(g.notice).toEqual({ code: 'member-removed', member: 2, memberLoads: 1, renumbered: false });
    expect(g.memberLoads).toHaveLength(0);
  });
  it('a row of another list is simply removed', () => {
    const f0 = defaultCase();
    const f = reduce(f0, { type: 'remove', list: 'loads', id: f0.loads[0].id });
    expect(f.loads).toHaveLength(0);
    expect(f.notice).toBeNull();
  });
  it('a list that does not exist is ignored', () => {
    const f = defaultCase();
    expect(reduce(f, { type: 'remove', list: 'bogus' as never, id: 1 })).toBe(f);
    expect(reduce(f, { type: 'add', list: 'bogus' as never })).toBe(f);
    expect(reduce(f, { type: 'patch', list: 'bogus' as never, id: 1, patch: { x: 1 } })).toBe(f);
  });
});

describe('patch', () => {
  it('changes the fields a row has, ignores the rest, and keeps references to nodes that are there', () => {
    const f = defaultCase();
    const m = f.members[0];
    const g = reduce(f, { type: 'patch', list: 'members', id: m.id, patch: { A: 12, I: null, i: f.nodes[1].id, j: 12345, hax: 1, id: 77 } });
    const row = g.members[0];
    expect(row).toMatchObject({ id: m.id, A: 12, I: null, i: f.nodes[1].id, j: m.j });
    expect(Object.keys(row)).toEqual(Object.keys(m));
  });
  it('a restraint flag takes a boolean only, a number field a number only', () => {
    const f = defaultCase();
    const s = f.supports[0];
    expect(reduce(f, { type: 'patch', list: 'supports', id: s.id, patch: { rz: 1 } })).toBe(f);
    expect(reduce(f, { type: 'patch', list: 'supports', id: s.id, patch: { rz: true, dx: 0.5 } }).supports[0]).toMatchObject({ rz: true, dx: 0.5 });
    expect(reduce(f, { type: 'patch', list: 'nodes', id: f.nodes[0].id, patch: { x: '5' } })).toBe(f);
    expect(reduce(f, { type: 'patch', list: 'nodes', id: f.nodes[0].id, patch: { x: Number.NaN } }).nodes[0].x).toBeNaN();
  });
  it('changing the kind of a member load gives the new kind what it needs, so the load is not silently zero', () => {
    let f = reduce(emptyStiffness(), { type: 'template', template: 'frame-propped' });
    const id = f.memberLoads[0].id;
    f = reduce(f, { type: 'patch', list: 'memberLoads', id, patch: { kind: 'point' } });
    const L = memberLength(f, f.members[0]);
    expect(f.memberLoads[0].kind).toBe('point');
    expect(f.memberLoads[0].P).not.toBe(0);
    expect(f.memberLoads[0].a).toBeGreaterThan(0);
    expect(f.memberLoads[0].a).toBeLessThan(L);
    expect(f.memberLoads[0].w).toBe(-1.2); // kept: changing back finds it
    f = reduce(f, { type: 'patch', list: 'memberLoads', id, patch: { kind: 'axial' } });
    expect(f.memberLoads[0].q).not.toBe(0);
    f = reduce(f, { type: 'patch', list: 'memberLoads', id, patch: { kind: 'udl' } });
    expect(f.memberLoads[0].w).toBe(-1.2);
  });
  it('a point load moved to a member that is shorter is given a position that is on it', () => {
    let f = reduce(emptyStiffness(), { type: 'template', template: 'frame-l' });
    f = reduce(f, { type: 'add', list: 'memberLoads', seed: { member: f.members[0].id, kind: 'point', a: 11 } });
    const id = f.memberLoads[f.memberLoads.length - 1].id;
    f = reduce(f, { type: 'patch', list: 'memberLoads', id, patch: { member: f.members[1].id } }); // 10 ft beam
    const row = f.memberLoads.find((l) => l.id === id)!;
    expect(row.a).toBeGreaterThan(0);
    expect(row.a).toBeLessThan(10);
  });
  it('a repeated kind or member leaves the row alone', () => {
    const f = reduce(emptyStiffness(), { type: 'template', template: 'frame-fixed-point' });
    const row = f.memberLoads[0];
    const g = reduce(f, { type: 'patch', list: 'memberLoads', id: row.id, patch: { kind: 'point', member: row.member, a: 3 } });
    expect(g.memberLoads[0]).toEqual({ ...row, a: 3 });
  });
});

describe('free position', () => {
  it('is the middle, then the quarters, never a position a point load is at', () => {
    const f = reduce(emptyStiffness(), { type: 'template', template: 'frame-propped' });
    const member = f.members[0].id;
    expect(freePosition(f, member)).toBe(10);
    const g = reduce(f, { type: 'add', list: 'memberLoads', seed: { member, kind: 'point', a: 10 } });
    expect(freePosition(g, member)).toBe(5);
  });
});

describe('mode', () => {
  it('keeps every row while the other mode is shown, fills a blank I for a frame, and refuses a mode that is none', () => {
    let f = reduce(emptyStiffness(), { type: 'template', template: 'frame-l' });
    f = reduce(f, { type: 'section', patch: { I: null } });
    const t = reduce(f, { type: 'mode', mode: 'truss' });
    expect(t.mode).toBe('truss');
    expect(t.memberLoads).toEqual(f.memberLoads);
    expect(t.nodes).toEqual(f.nodes);
    const back = reduce(t, { type: 'mode', mode: 'frame' });
    expect(back.I).toBe(DEFAULT_SECTION.us.I);
    expect(back.memberLoads).toEqual(f.memberLoads);
    expect(reduce(t, { type: 'mode', mode: 'wing' as never })).toBe(t);
  });
  it('a blank I is not filled when the mode does not change to frame', () => {
    const f = reduce(defaultCase(), { type: 'section', patch: { I: null } });
    expect(reduce(f, { type: 'mode', mode: 'truss' }).I).toBeNull();
  });
});

describe('clear and template', () => {
  it('clear keeps the mode, units, material and section', () => {
    const f = reduce(emptyStiffness('si', 'frame'), { type: 'template', template: 'frame-portal' });
    const c = reduce(f, { type: 'clear' });
    expect(c).toMatchObject({ mode: 'frame', units: 'si', material: f.material, E: f.E, A: f.A, I: f.I, nodes: [], members: [], supports: [], loads: [], memberLoads: [], notice: null, nextId: 1 });
  });
  it('every template, in each unit system, is a whole structure the engine solves', () => {
    for (const units of ['us', 'si'] as const) {
      for (const template of TEMPLATE_IDS) {
        const f = reduce(emptyStiffness(units), { type: 'template', template });
        expect(f.units).toBe(units);
        expect(f.notice).toEqual({ code: 'template', template });
        const a = analyseSafely(f);
        expect(a.issues, `${template} ${units}`).toEqual([]);
        expect(a.results!.equilibrium.balanced).toBe(true);
        // its link reads back as itself
        expect(decode(encode(f))).toEqual({ ...f, notice: null });
        expect(normal(f)).toEqual({ ...f, notice: null });
      }
    }
  });
  it('a template is the structure and the mode and the section, the units stay', () => {
    const f = reduce(emptyStiffness('si', 'truss'), { type: 'template', template: 'frame-portal' });
    expect(f.mode).toBe('frame');
    expect(f.units).toBe('si');
    expect(f.E).toBe(200);
    const same = reduce(f, { type: 'template', template: 'nope' as never });
    expect(same).toBe(f);
  });
  it('leavesBehind: a structure nobody could get back, but not the example nor one that is the same', () => {
    const f = reduce(defaultCase(), { type: 'add', list: 'nodes' });
    expect(leavesBehind(f, defaultCase(), EXAMPLE)).toBe(true);
    expect(leavesBehind(defaultCase(), f, EXAMPLE)).toBe(false);
    expect(leavesBehind(f, f, EXAMPLE)).toBe(false);
  });
});

describe('units', () => {
  const quantities = (f: StiffnessForm): number[] => [
    ...f.nodes.flatMap((n) => [n.x, n.y]),
    ...f.members.flatMap((m) => [m.E, m.A, m.I].filter((v): v is number => v !== null)),
    ...f.supports.flatMap((s) => [s.dx, s.dy, s.dr]),
    ...f.loads.flatMap((l) => [l.fx, l.fy, l.m]),
    ...f.memberLoads.flatMap((l) => [l.w, l.P, l.a, l.q]),
    ...[f.E, f.A, f.I].filter((v): v is number => v !== null),
  ];
  it('a form goes to the other system and back as the very same numbers, 300 random forms', () => {
    for (let seed = 1; seed <= 300; seed++) {
      const f = normal(randomForm(seed));
      const there = convertStiffness(f, f.units === 'us' ? 'si' : 'us');
      const back = convertStiffness(there, f.units);
      expect(there.units).not.toBe(f.units);
      expect(quantities(back), `seed ${seed}`).toEqual(quantities(f));
      expect({ ...back, notice: null }).toEqual({ ...f, notice: null });
    }
  });
  it('10 ft is 3.048 m is 10 ft, and so is every typed quantity of up to eight figures', () => {
    const r = rng(77);
    for (let k = 0; k < 3000; k++) {
      let v = randomNumber(r);
      if (v === 0) v = 1.2345678;
      v = Number(v.toPrecision(8));
      const f = reduce(emptyStiffness('us', 'frame'), { type: 'add', list: 'nodes', seed: { x: v, y: -v } });
      const eightFigures = (x: number) => Number(x.toPrecision(8));
      const g = reduce(f, { type: 'add', list: 'loads', seed: { node: f.nodes[0].id, fx: v, fy: eightFigures(v / 3), m: eightFigures(v / 7) } });
      const h = reduce(g, { type: 'section', patch: { A: v, I: v, E: v } });
      expect(convertStiffness(convertStiffness(h, 'si'), 'us')).toEqual({ ...h, notice: null });
    }
    const ten = reduce(emptyStiffness(), { type: 'add', list: 'nodes', seed: { x: 10, y: 0 } });
    expect(convertStiffness(ten, 'si').nodes[0].x).toBe(3.048);
  });
  it('the listed materials stay the listed materials', () => {
    const f = defaultCase();
    expect(convertStiffness(f, 'si').E).toBe(200);
    expect(convertStiffness(convertStiffness(f, 'si'), 'us').E).toBe(29000);
    const al = reduce(f, { type: 'material', material: 'aluminum' });
    expect(al.E).toBe(10100);
    expect(convertStiffness(al, 'si').E).toBe(69.6);
    expect(STIFFNESS_MATERIALS.steel).toEqual({ us: 29000, si: 200 });
  });
  it('the same structure in the other system is the same physical answer', () => {
    for (const template of TEMPLATE_IDS) {
      // (a modulus that is a listed material's is the listed one in the other system, not its conversion: 28,000 ksi is nobody's listed value)
      const us = reduce(reduce(emptyStiffness('us'), { type: 'template', template }), { type: 'section', patch: { E: 28000 } });
      const si = convertStiffness(us, 'si');
      const a = analyseSafely(us);
      const b = analyseSafely(si);
      expect(a.issues).toEqual([]);
      expect(b.issues, template).toEqual([]);
      const ft = 0.3048;
      const kip = 4.4482216152605;
      // displacements shown: inches against millimetres
      a.results!.displacements.forEach((d, k) => {
        const e = b.results!.displacements[k];
        const scale = Math.max(a.results!.maxDisplacement, 1e-300);
        expect(Math.abs(d.ux * 25.4 - e.ux)).toBeLessThanOrEqual(1e-6 * scale * 25.4);
        expect(Math.abs(d.uy * 25.4 - e.uy)).toBeLessThanOrEqual(1e-6 * scale * 25.4);
        if (d.rotation !== null) expect(Math.abs(d.rotation - e.rotation!)).toBeLessThanOrEqual(1e-6 * Math.max(...a.results!.displacements.map((x) => Math.abs(x.rotation!))));
      });
      a.results!.reactions.forEach((r, k) => {
        const s = b.results!.reactions[k];
        const top = Math.max(...a.results!.reactions.map((x) => Math.abs(x.ry ?? 0) + Math.abs(x.rx ?? 0)), 1e-300);
        expect(Math.abs((r.rx ?? 0) * kip - (s.rx ?? 0))).toBeLessThanOrEqual(1e-6 * top * kip);
        expect(Math.abs((r.ry ?? 0) * kip - (s.ry ?? 0))).toBeLessThanOrEqual(1e-6 * top * kip);
        if (r.rm !== null) expect(Math.abs(r.rm * kip * ft - s.rm!)).toBeLessThanOrEqual(1e-6 * Math.max(...a.results!.reactions.map((x) => Math.abs(x.rm ?? 0))) * kip * ft);
      });
    }
  });
  it('the unit tables are the ones in the contract', () => {
    expect(STIFFNESS_UNITS.us).toMatchObject({ length: 'ft', force: 'kip', line: 'kip/ft', moment: 'kip·ft', area: 'in²', inertia: 'in⁴', E: 'ksi', displacement: 'in' });
    expect(STIFFNESS_UNITS.si).toMatchObject({ length: 'm', force: 'kN', line: 'kN/m', moment: 'kN·m', area: 'mm²', inertia: '10⁶ mm⁴', E: 'GPa', displacement: 'mm' });
    expect(CALCULATION_UNITS.us.length).toBe('ft');
    expect(TO_ENGINE.us).toEqual({ area: 1 / 144, inertia: 1 / 20736, E: 144, settlement: 1 / 12 });
    expect(FROM_ENGINE.si).toEqual({ displacement: 1000, stress: 1 / 1000 });
  });
});

describe('from the form to the engine', () => {
  it('brings the section across in one place, in feet and kips', () => {
    const f = reduce(emptyStiffness(), { type: 'template', template: 'frame-portal' });
    const { model, rows } = toEngine(f);
    expect(model.E).toBe(29000 * 144);
    expect(model.A).toBeCloseTo(14.1 / 144, 15);
    expect(model.I).toBeCloseTo(484 / 20736, 15);
    expect(model.members[0]).toEqual({ i: 0, j: 2 });
    expect(rows.nodes).toEqual(f.nodes.map((n) => n.id));
  });
  it('a member of its own, a blank, a reference to nothing: -1 for the engine to refuse', () => {
    let f = defaultCase();
    f = reduce(f, { type: 'patch', list: 'members', id: f.members[0].id, patch: { E: 100, A: null } });
    f = { ...f, members: [{ ...f.members[0], i: 999 }, f.members[1]] };
    const { model } = toEngine(f);
    expect(model.members[0]).toEqual({ i: -1, j: 2, E: 100 * 144 });
    const out = solve(model);
    expect(out.ok).toBe(false);
  });
  it('a settlement counts only on a restrained DOF; the form hides one that does not', () => {
    let f = reduce(emptyStiffness(), { type: 'template', template: 'frame-propped' });
    const s = f.supports[1]; // roller: uy only
    f = reduce(f, { type: 'patch', list: 'supports', id: s.id, patch: { dx: 3, dy: -0.5, dr: 0.1 } });
    expect(settlementOf(f.supports[1], 'frame')).toEqual({ dx: 0, dy: -0.5, dr: 0 });
    const { model } = toEngine(f);
    expect(model.supports[1]).toEqual({ node: 1, ux: false, uy: true, rz: false, dy: -0.5 / 12 });
    // an engine told of it warns; the form never does
    expect(solve(model).ok).toBe(true);
  });
  it('an issue is mapped to the row of the form that has the fault', () => {
    let f = defaultCase();
    f = reduce(f, { type: 'patch', list: 'loads', id: f.loads[0].id, patch: { fy: Number.NaN } });
    const { model, rows } = toEngine(f);
    const out = solve(model);
    expect(out.ok).toBe(false);
    if (!out.ok) {
      expect(issueRow(out.issues[0], rows)).toEqual({ list: 'loads', id: f.loads[0].id, field: 'fy' });
      expect(issueRow({ code: 'section', where: { list: 'model', index: 0, field: 'A' } }, rows)).toEqual({ list: 'model', field: 'A' });
      expect(issueRow({ code: 'no-members' }, rows)).toBeUndefined();
      expect(issueRow({ code: 'number', where: { list: 'loads', index: 9, field: 'fx' } }, rows)).toBeUndefined();
    }
  });
});

describe('the address', () => {
  it('random forms come back from their own address, bit for bit: 600', () => {
    for (let seed = 1; seed <= 600; seed++) {
      const f = randomForm(seed, 30);
      const text = encode(f);
      expect(text.length).toBeLessThanOrEqual(MAX_LINK);
      expect(decode(text), `seed ${seed}`).toEqual(normal(f));
    }
  });
  it('numbers that are not numbers come back as what they are', () => {
    let f = defaultCase();
    f = reduce(f, { type: 'patch', list: 'nodes', id: f.nodes[0].id, patch: { x: Number.NaN, y: Infinity } });
    f = reduce(f, { type: 'patch', list: 'loads', id: f.loads[0].id, patch: { fx: -Infinity } });
    const back = decode(encode(f))!;
    expect(back.nodes[0].x).toBeNaN();
    expect(back.nodes[0].y).toBe(Infinity);
    expect(back.loads[0].fx).toBe(-Infinity);
  });
  it('a double of any size, tiny or huge, is written and read as itself', () => {
    const r = rng(5);
    for (let k = 0; k < 2000; k++) {
      const v = (r() - 0.5) * 10 ** Math.floor(r() * 600 - 300);
      let f = defaultCase();
      f = reduce(f, { type: 'patch', list: 'nodes', id: f.nodes[0].id, patch: { x: v } });
      expect(decode(encode(f))!.nodes[0].x).toBe(v === 0 ? 0 : v);
    }
  });
  it('a blank section stays blank, an own section stays an own section', () => {
    let f = defaultCase();
    f = reduce(f, { type: 'section', patch: { A: null, I: null } });
    f = reduce(f, { type: 'patch', list: 'members', id: f.members[1].id, patch: { E: 100, A: 12.5, I: null } });
    const back = decode(encode(f))!;
    expect(back.A).toBeNull();
    expect(back.I).toBeNull();
    expect(back.members[1]).toMatchObject({ E: 100, A: 12.5, I: null });
    expect(back.members[0]).toMatchObject({ E: null, A: null, I: null });
  });
  it('the longest address a form can write is read back, and is under the bound', () => {
    const long = -1.2345678901234567e-300;
    let f = emptyStiffness('us', 'frame');
    for (let k = 0; k < LIMITS.nodes; k++) f = reduce(f, { type: 'add', list: 'nodes', seed: { x: long * (k + 1.1), y: long * (k + 2.2) } });
    for (let a = 0; a < LIMITS.members; a++) f = reduce(f, { type: 'add', list: 'members', seed: { i: f.nodes[a % 12].id, j: f.nodes[(a * 5 + 1) % 12 === a % 12 ? (a + 2) % 12 : (a * 5 + 1) % 12].id } });
    // (members are added by hand where the generator would stop: pairs that are joined are allowed here, the form holds whatever it is given)
    while (f.members.length < LIMITS.members) f = { ...f, members: [...f.members, { id: f.nextId, i: f.nodes[0].id, j: f.nodes[1].id, E: null, A: null, I: null }], nextId: f.nextId + 1 };
    const num = () => long * 1.0000000000000002;
    f = {
      ...f,
      members: f.members.map((m) => ({ ...m, E: num(), A: num(), I: num() })),
      supports: Array.from({ length: LIMITS.supports }, (_, k) => ({ id: 5000 + k, node: f.nodes[k].id, ux: true, uy: true, rz: true, dx: num(), dy: num(), dr: num() })),
      loads: Array.from({ length: LIMITS.loads }, (_, k) => ({ id: 6000 + k, node: f.nodes[k % 12].id, fx: num(), fy: num(), m: num() })),
      memberLoads: Array.from({ length: LIMITS.memberLoads }, (_, k) => ({ id: 7000 + k, member: f.members[k % 20].id, kind: 'point' as const, w: num(), P: num(), a: num(), q: num() })),
      E: num(),
      A: num(),
      I: num(),
    };
    const text = encode(f);
    expect(text.length).toBeLessThanOrEqual(MAX_LINK);
    expect(text.length).toBeGreaterThan(8000);
    expect(decode(text)).toEqual(normal(f));
    // (the longest the generated forms get, with ordinary numbers, is a few thousand)
  });
  it('a link longer than the bound is not read', () => {
    expect(decode('K' + 'x'.repeat(MAX_LINK + 1))).toBeNull();
    expect(decode(EXAMPLE + ';'.repeat(MAX_LINK))).toBeNull();
  });
  it('anything unreadable is null, and never throws', () => {
    for (const text of ['', ';', 'K', EXAMPLE.slice(0, -1), EXAMPLE + 'x', EXAMPLE.replace('us', 'si'), EXAMPLE.replace(';t;', ';x;'), 'us;t;1', 'hello', '1;2;3', ';;;;;;;;;']) expect(decode(text), text).toBeNull();
    expect(() => decode(undefined as never)).not.toThrow();
    expect(decode(undefined as never)).toBeNull();
    expect(decode(5 as never)).toBeNull();
  });
  it('a link made by hand with the right check is read when it is right, null when a node or a letter is not', () => {
    const make = (body: string) => `${checkOf(body)};${body}`;
    const good = '1;t;us;s,29000,10,100;0,0_10,0;1,2;1,3_2,2;2,0,-5;';
    expect(decode(make(good))).not.toBeNull();
    expect(decode(make(good.replace('1,2;', '1,3;')))).toBeNull(); // node 3 is not there
    expect(decode(make(good.replace('s,29000', 'z,29000')))).toBeNull(); // a material that is none
    expect(decode(make(good.replace('1,3_2,2', '1,8_2,2')))).toBeNull(); // restraint flags are 0 to 7
    expect(decode(make(good.replace('2,0,-5', '2,0,-5,1,2')))).toBeNull(); // too many fields
    expect(decode(make(good.replace('29000', '2.9e4')))).toEqual(decode(make(good)));
    expect(decode(make(good.replace('29000', '+29000')))).toBeNull(); // a number in a notation the page never writes
    expect(decode(make(good.replace('29000', '29000.')))).toBeNull();
    expect(decode(make(good.replace('29000', '.5')))).toBeNull();
    expect(decode(make(good.replace('29000', '0x10')))).toBeNull();
    expect(decode(make(good.replace('29000', 'NaN')))).toBeNull();
    expect(decode(make(good.replace('29000', 'nan')))).not.toBeNull();
  });
  it('a link with a character more, less or changed anywhere is not another structure', () => {
    const text = encode(reduce(emptyStiffness('si', 'frame'), { type: 'template', template: 'frame-portal' }));
    const alphabet = '0123456789,;_-.eKabcdxyzus';
    const r = rng(11);
    let tried = 0;
    for (let at = 0; at < text.length; at++) {
      expect(decode(text.slice(0, at) + text.slice(at + 1)), `deleted ${at}`).toBeNull();
      const c = alphabet[Math.floor(r() * alphabet.length)];
      if (c !== text[at]) {
        expect(decode(text.slice(0, at) + c + text.slice(at + 1)), `changed ${at} to ${c}`).toBeNull();
        tried++;
      }
      expect(decode(text.slice(0, at) + c + text.slice(at)), `inserted ${at}`).toBeNull();
    }
    expect(tried).toBeGreaterThan(50);
  });
  it('100,000 strings: random, mutated links and bodies with a right check; none throws, and what is read is a form that is written back as itself', () => {
    const r = rng(2026);
    const alphabet = '0123456789,;_-.eKabcdefghinfpqrstuxyzNA ';
    const seeds = [EXAMPLE, encode(reduce(emptyStiffness('si', 'frame'), { type: 'template', template: 'frame-portal' })), encode(reduce(emptyStiffness(), { type: 'template', template: 'truss-five-member' })), encode(reduce(emptyStiffness(), { type: 'template', template: 'frame-fixed-point' }))];
    let read = 0;
    for (let k = 0; k < 100000; k++) {
      let text: string;
      const roll = r();
      if (roll < 0.25) {
        const n = Math.floor(r() * 60);
        text = Array.from({ length: n }, () => alphabet[Math.floor(r() * alphabet.length)]).join('');
      } else if (roll < 0.6) {
        text = seeds[Math.floor(r() * seeds.length)];
        const edits = 1 + Math.floor(r() * 3);
        for (let e = 0; e < edits; e++) {
          const at = Math.floor(r() * (text.length + 1));
          const c = alphabet[Math.floor(r() * alphabet.length)];
          const how = Math.floor(r() * 3);
          text = how === 0 ? text.slice(0, at) + c + text.slice(at + 1) : how === 1 ? text.slice(0, at) + text.slice(at + 1) : text.slice(0, at) + c + text.slice(at);
        }
      } else {
        // A body of nine fields with a right check: the parser itself.
        const source = checkSplit(seeds[Math.floor(r() * seeds.length)]);
        const fields = source.split(';');
        const at = Math.floor(r() * fields.length);
        const junk = Array.from({ length: Math.floor(r() * 12) }, () => alphabet[Math.floor(r() * alphabet.length)]).join('');
        fields[at] = r() < 0.5 ? junk : fields[at] + junk;
        if (r() < 0.2) fields.splice(Math.floor(r() * fields.length), 1);
        const body = fields.join(';');
        text = `${checkOf(body)};${body}`;
      }
      const f = decode(text);
      if (f !== null) {
        read++;
        // a form that was read is a form that is written back as the very same text when it is written again
        expect(decode(encode(f))).toEqual(f);
      }
    }
    expect(read).toBeGreaterThan(1000);
  });
});

function checkSplit(text: string): string {
  return text.slice(text.indexOf(';') + 1);
}

describe('labels and lengths', () => {
  it('a label is the place in the list from 1, 0 for an id that is not there', () => {
    const f = defaultCase();
    expect(f.nodes.map((n) => nodeLabel(f, n.id))).toEqual([1, 2, 3]);
    expect(f.members.map((m) => memberLabel(f, m.id))).toEqual([1, 2]);
    expect(nodeLabel(f, 999)).toBe(0);
    expect(memberLabel(f, 999)).toBe(0);
  });
  it('a member length is the distance, 0 where a coordinate is not a number or a node is gone', () => {
    const f = defaultCase();
    expect(memberLength(f, f.members[0])).toBe(10);
    expect(memberLength(reduce(f, { type: 'patch', list: 'nodes', id: f.nodes[0].id, patch: { x: Number.NaN } }), f.members[0])).toBe(0);
    expect(memberLength(f, { ...f.members[0], i: 999 })).toBe(0);
  });
  it('a support is called what it is', () => {
    expect(presetOf({ ux: true, uy: true, rz: true })).toBe('fixed');
    expect(presetOf({ ux: true, uy: true, rz: false })).toBe('pin');
    expect(presetOf({ ux: false, uy: true, rz: false })).toBe('roller');
    expect(presetOf({ ux: true, uy: false, rz: false })).toBeNull();
    expect(presetOf({ ux: true, uy: true, rz: true }, 'truss')).toBe('pin');
  });
});
