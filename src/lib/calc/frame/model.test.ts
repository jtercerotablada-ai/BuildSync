import { afterEach, describe, expect, it, vi } from 'vitest';
import { checkOf } from '../beam/model';
import { LISTS, normal, randomForm } from './forms.testlib';
import {
  FRAME_KEY,
  FRAME_MATERIALS,
  FRAME_UNITS,
  FRAME_US_TO_SI,
  LIMITS,
  MAX_LINK,
  SECTION_PRESETS,
  TO_ENGINE,
  convertFrame,
  convertTemplateParams,
  decode,
  decodeFrame,
  defaultCase,
  defaultFrame,
  emptyFrame,
  encode,
  encodeFrame,
  issueRow,
  leavesBehind,
  memberLabel,
  memberLength,
  nodeLabel,
  presetValues,
  reduceFrame,
  toEngine,
  type FrameAction,
  type FrameForm,
} from './model';
import { rng } from './oracle.testlib';
import { solveFrame } from './engine';

// Heavy by design (thousands of generated forms, a fuzz of a hundred thousand strings): a loaded machine runs past the 5 s default.
vi.setConfig({ testTimeout: 120_000 });
afterEach(() => new Promise((r) => setTimeout(r, 0)));

const run = (form: FrameForm, ...actions: FrameAction[]): FrameForm => actions.reduce(reduceFrame, form);

describe('the example', () => {
  it('is a 20 × 10 ft portal, fixed feet, W14×48 steel, with the loads of the hand answer', () => {
    const f = defaultFrame();
    expect(defaultCase().nodes).toEqual(f.nodes);
    expect(f.units).toBe('us');
    expect(f.nodes.map((n) => [n.x, n.y])).toEqual([[0, 0], [20, 0], [0, 10], [20, 10]]);
    expect(f.members.map((m) => [m.i, m.j])).toEqual([[1, 3], [2, 4], [3, 4]]);
    expect(f.members.map((m) => m.id)).toEqual([5, 6, 7]);
    expect(f.supports.map((s) => [s.node, s.kind])).toEqual([[1, 'fixed'], [2, 'fixed']]);
    expect(f.loads).toEqual([{ id: 10, node: 3, fx: 10, fy: 0, m: 0 }]);
    expect(f.memberLoads).toMatchObject([{ id: 11, member: 7, kind: 'udl', dir: 'global-y', w: -1.2 }]);
    expect([f.material, f.E, f.A, f.I]).toEqual(['steel', 29000, 14.1, 484]);
    expect(f.nextId).toBe(12);
  });
  it('reads back from its own address, id for id', () => {
    const f = defaultFrame();
    expect(decode(encode(f))).toEqual(f);
    expect(encode(decode(encode(f))!)).toBe(encode(f));
  });
  it('has the key the shell needs and a check at the head of its address', () => {
    expect(FRAME_KEY).toBe('f');
    const text = encode(defaultFrame());
    expect(text.startsWith('K')).toBe(true);
    expect(text.slice(text.indexOf(';') + 1).split(';')).toHaveLength(8);
    expect(text.slice(0, text.indexOf(';'))).toBe(checkOf(text.slice(text.indexOf(';') + 1)));
  });
  it('solves, and statics gives the numbers of the hand answer in its comment', () => {
    // Axially rigid members (A = 10⁷ in²), as the hand answer takes them.
    const { model } = toEngine({ ...defaultFrame(), A: 1e7 });
    const s = solveFrame(model);
    expect(s.ok).toBe(true);
    if (!s.ok) return;
    const near = (a: number, b: number) => expect(Math.abs(a - b)).toBeLessThanOrEqual(1e-4 + 1e-5 * Math.abs(b));
    near(s.reactions[0].rx, -0.2);
    near(s.reactions[1].rx, -9.8);
    near(s.reactions[0].ry, 10.125);
    near(s.reactions[1].ry, 13.875);
    near(s.members[2].start.M, -13.25);
    near(s.members[2].end.M, -50.75);
    // Moments at the feet: 31.25 from the lateral load, 16 from the gravity, in opposite senses at the left foot.
    near(Math.abs(s.reactions[0].rm), 31.25 - 16);
    near(Math.abs(s.reactions[1].rm), 31.25 + 16);
  });
});

describe('the reducer', () => {
  it("'load' and 'reset' return the form they are given, itself", () => {
    const base = defaultFrame();
    const other = randomForm(7);
    expect(reduceFrame(base, { type: 'load', form: other })).toBe(other);
    expect(reduceFrame(base, { type: 'reset', form: other })).toBe(other);
    expect(reduceFrame(other, { type: 'reset' })).toEqual(defaultFrame());
    const withNotice = { ...other, notice: { code: 'limit' as const, list: 'nodes' as const, max: 50 } };
    expect(reduceFrame(base, { type: 'load', form: withNotice })).toBe(withNotice);
  });
  it("'clear' empties the frame and keeps units, material and section", () => {
    const f = run(defaultFrame(), { type: 'units', units: 'si' }, { type: 'section', patch: { A: 9000 } });
    const c = reduceFrame(f, { type: 'clear' });
    expect(c).toMatchObject({ units: 'si', nodes: [], members: [], supports: [], loads: [], memberLoads: [], material: f.material, E: f.E, A: 9000, I: f.I, nextId: 1 });
  });
  it('adds nodes at free places: fifty adds, no two together, then the cap says so', () => {
    let f = emptyFrame();
    for (let k = 0; k < 50; k++) f = reduceFrame(f, { type: 'add', list: 'nodes' });
    expect(f.nodes).toHaveLength(50);
    const keys = new Set(f.nodes.map((n) => `${n.x},${n.y}`));
    expect(keys.size).toBe(50);
    const more = reduceFrame(f, { type: 'add', list: 'nodes' });
    expect(more.nodes).toHaveLength(50);
    expect(more.notice).toEqual({ code: 'limit', list: 'nodes', max: 50 });
  });
  it('a new node does not land on a node that is where it would go (the default frame, five adds)', () => {
    let f = defaultFrame();
    for (let k = 0; k < 5; k++) f = reduceFrame(f, { type: 'add', list: 'nodes' });
    expect(new Set(f.nodes.map((n) => `${n.x},${n.y}`)).size).toBe(9);
  });
  it('adds a member between two nodes that are not joined, never twice the same pair, and says when there is no pair left', () => {
    let f = run(emptyFrame(), { type: 'add', list: 'nodes' }, { type: 'add', list: 'nodes' }, { type: 'add', list: 'nodes' });
    for (let k = 0; k < 3; k++) f = reduceFrame(f, { type: 'add', list: 'members' });
    expect(f.members).toHaveLength(3);
    const pairs = new Set(f.members.map((m) => [m.i, m.j].sort().join('-')));
    expect(pairs.size).toBe(3);
    const full = reduceFrame(f, { type: 'add', list: 'members' });
    expect(full.members).toHaveLength(3);
    expect(full.notice).toEqual({ code: 'nothing-to-add', list: 'members', why: 'pairs' });
  });
  it('adds supports at the lowest free node, the first fixed, then pins; refuses when every node has one', () => {
    let f = defaultFrame();
    f = { ...f, supports: [] };
    f = reduceFrame(f, { type: 'add', list: 'supports' });
    f = reduceFrame(f, { type: 'add', list: 'supports' });
    expect(f.supports.map((s) => [s.node, s.kind])).toEqual([[1, 'fixed'], [2, 'pin']]);
    f = reduceFrame(f, { type: 'add', list: 'supports' });
    f = reduceFrame(f, { type: 'add', list: 'supports' });
    expect(f.supports).toHaveLength(4);
    const full = reduceFrame(f, { type: 'add', list: 'supports' });
    expect(full.supports).toHaveLength(4);
    expect(full.notice).toEqual({ code: 'nothing-to-add', list: 'supports', why: 'nodes' });
    expect(reduceFrame(emptyFrame(), { type: 'add', list: 'supports' }).notice).toEqual({ code: 'nothing-to-add', list: 'supports', why: 'no-node' });
  });
  it('adds a nodal load on the highest node without one', () => {
    const f = reduceFrame({ ...defaultFrame(), loads: [] }, { type: 'add', list: 'loads' });
    expect(f.loads[0]).toMatchObject({ node: 3, fx: 0, fy: -10, m: 0 });
    const g = reduceFrame(f, { type: 'add', list: 'loads' });
    expect(g.loads[1].node).toBe(4);
  });
  it('adds member loads at distinct positions: the same point load pressed five times lands on five places', () => {
    let f = defaultFrame();
    f = { ...f, memberLoads: [] };
    for (let k = 0; k < 5; k++) f = reduceFrame(f, { type: 'add', list: 'memberLoads', seed: { kind: 'point', member: 7 } });
    expect(new Set(f.memberLoads.map((l) => l.a)).size).toBe(5);
    expect(f.memberLoads[0].a).toBe(10);
    expect(f.memberLoads.every((l) => l.a > 0 && l.a < 20)).toBe(true);
    expect(reduceFrame({ ...defaultFrame(), members: [], memberLoads: [] }, { type: 'add', list: 'memberLoads' }).notice).toEqual({ code: 'nothing-to-add', list: 'memberLoads', why: 'no-member' });
  });
  it('adds each kind of member load with values that make sense in both unit systems, and the engine accepts them', () => {
    for (const units of ['us', 'si'] as const) {
      for (const kind of ['udl', 'udl-projected', 'trapezoid', 'point', 'moment', 'temperature'] as const) {
        let f = run(defaultFrame(), { type: 'units', units });
        f = { ...f, memberLoads: [], loads: [] };
        f = reduceFrame(f, { type: 'add', list: 'memberLoads', seed: { kind, member: 7 } });
        if (kind === 'temperature') f = reduceFrame(f, { type: 'patch', list: 'members', id: 7, patch: { h: units === 'us' ? 14 : 350 } });
        expect(f.memberLoads, `${units} ${kind}`).toHaveLength(1);
        const s = solveFrame(toEngine(f).model);
        expect(s.ok, `${units} ${kind}: ${JSON.stringify(s.ok ? '' : s.issues)}`).toBe(true);
      }
    }
  });
  it('past the cap of any list an add is refused with the list and the cap', () => {
    for (const list of LISTS) {
      let f = defaultFrame();
      f = { ...f, [list]: Array.from({ length: LIMITS[list] }, (_, k) => ({ ...(f[list][0] ?? {}), id: 100 + k })) } as FrameForm;
      const g = reduceFrame(f, { type: 'add', list });
      expect(g.notice, list).toEqual({ code: 'limit', list, max: LIMITS[list] });
      expect(g[list], list).toHaveLength(LIMITS[list]);
    }
  });
  it('deleting a node takes its members, their loads, its supports and loads, and the notice says what and what moved', () => {
    const f = defaultFrame();
    // Node 1 (id 1): member 1 (1–3) and its loads (none); the support on it. The nodes after it move up.
    const g = reduceFrame(f, { type: 'remove', list: 'nodes', id: 1 });
    expect(g.nodes).toHaveLength(3);
    expect(g.members.map((m) => m.id)).toEqual([6, 7]);
    expect(g.supports).toHaveLength(1);
    expect(g.notice).toEqual({ code: 'node-removed', node: 1, members: [1], supports: 1, loads: 0, memberLoads: 0, renumbered: true, membersRenumbered: true });
    // Node 3 carries the load and meets the beam (member 3) with its load: all go. Members 1 and 3 leave; member 2 becomes member 1.
    const h = reduceFrame(f, { type: 'remove', list: 'nodes', id: 3 });
    expect(h.notice).toEqual({ code: 'node-removed', node: 3, members: [1, 3], supports: 0, loads: 1, memberLoads: 1, renumbered: true, membersRenumbered: true });
    expect(h.memberLoads).toHaveLength(0);
    // The last node: nothing after it moves ("numbered as before"), and neither do the members that stay before it.
    const last = reduceFrame(f, { type: 'remove', list: 'nodes', id: 4 });
    expect(last.notice).toMatchObject({ code: 'node-removed', node: 4, members: [2, 3], renumbered: false, membersRenumbered: false });
  });
  it('deleting a member takes its loads and says how many; the last member leaves everything else numbered as before', () => {
    const f = defaultFrame();
    const g = reduceFrame(f, { type: 'remove', list: 'members', id: 7 });
    expect(g.memberLoads).toHaveLength(0);
    expect(g.notice).toEqual({ code: 'member-removed', member: 3, memberLoads: 1, renumbered: false });
    const h = reduceFrame(f, { type: 'remove', list: 'members', id: 5 });
    expect(h.notice).toEqual({ code: 'member-removed', member: 1, memberLoads: 0, renumbered: true });
    expect(h.memberLoads[0].member).toBe(7);
    expect(reduceFrame(f, { type: 'remove', list: 'members', id: 999 })).toBe(f);
  });
  it('patch changes only what a row has, refuses references to rows that are not there and junk kinds', () => {
    const f = defaultFrame();
    expect(reduceFrame(f, { type: 'patch', list: 'nodes', id: 1, patch: { x: 3, bogus: 9 } }).nodes[0]).toEqual({ id: 1, x: 3, y: 0 });
    expect(reduceFrame(f, { type: 'patch', list: 'members', id: 5, patch: { i: 999 } })).toBe(f);
    expect(reduceFrame(f, { type: 'patch', list: 'supports', id: 8, patch: { kind: 'wall' } })).toBe(f);
    expect(reduceFrame(f, { type: 'patch', list: 'nodes', id: 99, patch: { x: 1 } })).toBe(f);
    expect(reduceFrame(f, { type: 'patch', list: 'members', id: 5, patch: { hingeEnd: true } }).members[0].hingeEnd).toBe(true);
    expect(reduceFrame(f, { type: 'patch', list: 'members', id: 5, patch: { hingeEnd: 'yes' } })).toBe(f);
    // A projected load is never local.
    const projected = run(f, { type: 'patch', list: 'memberLoads', id: 11, patch: { dir: 'local-y' } }, { type: 'patch', list: 'memberLoads', id: 11, patch: { kind: 'udl-projected' } });
    expect(projected.memberLoads[0]).toMatchObject({ kind: 'udl-projected', dir: 'global-y' });
  });
  it('a modulus typed over steel is the visitor\'s own; the material buttons put the listed ones back, with the α of the temperature loads', () => {
    const f = run(defaultFrame(), { type: 'section', patch: { E: 30000 } });
    expect(f.material).toBe('custom');
    const g = run(f, { type: 'material', material: 'aluminum' });
    expect(g).toMatchObject({ material: 'aluminum', E: 10100 });
    const t = run(defaultFrame(), { type: 'add', list: 'memberLoads', seed: { kind: 'temperature' } });
    expect(t.memberLoads[1].alpha).toBe(6.5e-6);
    expect(run(t, { type: 'material', material: 'aluminum' }).memberLoads[1].alpha).toBe(13e-6);
  });
  it('a preset sets A and I of the frame or of one member, in the units shown', () => {
    const w = SECTION_PRESETS.find((p) => p.id === 'W24x55')!;
    expect(run(defaultFrame(), { type: 'preset', preset: 'W24x55' })).toMatchObject({ A: w.A, I: w.I });
    const m = run(defaultFrame(), { type: 'preset', preset: 'W24x55', member: 7 });
    expect(m.members[2]).toMatchObject({ A: w.A, I: w.I });
    expect(m.A).toBe(14.1);
    const si = presetValues('W24x55', 'si')!;
    expect(si.A).toBeCloseTo(16.2 * 645.16, 6);
    expect(si.I).toBeCloseTo(1350 * 0.4162314256, 6);
    expect(run(defaultFrame(), { type: 'preset', preset: 'nope' }).A).toBe(14.1);
  });
  it('a template replaces geometry, supports and loads and keeps units and section; a clamp is told', () => {
    const f = run(defaultFrame(), { type: 'section', patch: { A: 20 } }, { type: 'template', template: 'portal', params: { bays: 9, storeys: 2, width: -3 } });
    expect(f.A).toBe(20);
    expect(f.nodes).toHaveLength(21);
    expect(f.notice).toMatchObject({ code: 'template', template: 'portal' });
    expect(f.notice && f.notice.code === 'template' ? f.notice.clamped.map((c) => c.param).sort() : []).toEqual(['bays', 'width']);
    expect(decode(encode(f))).toEqual({ ...f, notice: null });
  });
  it('the next action replaces the notice', () => {
    const f = reduceFrame(defaultFrame(), { type: 'remove', list: 'members', id: 5 });
    expect(f.notice).not.toBeNull();
    expect(reduceFrame(f, { type: 'patch', list: 'nodes', id: 1, patch: { x: 1 } }).notice).toBeNull();
  });
  it('labels', () => {
    const f = defaultFrame();
    expect(nodeLabel(f, 3)).toBe(3);
    expect(nodeLabel(f, 99)).toBe(0);
    expect(memberLabel(f, 7)).toBe(3);
    expect(memberLength(f, f.members[2])).toBe(20);
  });
  it('leavesBehind says when a frame is thrown away that nobody could get back', () => {
    const example = encode(defaultFrame());
    const other = run(defaultFrame(), { type: 'patch', list: 'nodes', id: 3, patch: { y: 12 } });
    expect(leavesBehind(defaultFrame(), other, example)).toBe(false);
    expect(leavesBehind(other, defaultFrame(), example)).toBe(true);
    expect(leavesBehind(other, other, example)).toBe(false);
  });
});

describe('units', () => {
  it('converts the example, quantity by quantity', () => {
    const si = convertFrame(defaultFrame(), 'si');
    expect(si.units).toBe('si');
    expect(si.nodes[3]).toMatchObject({ x: 6.096, y: 3.048 });
    expect(si.E).toBe(200);
    expect(si.A).toBeCloseTo(14.1 * 645.16, 9);
    expect(si.I).toBeCloseTo(484 * FRAME_US_TO_SI.inertia, 9);
    expect(si.loads[0].fx).toBeCloseTo(10 * 4.4482216152605, 12);
    expect(si.memberLoads[0].w).toBeCloseTo(-1.2 * 4.4482216152605 / 0.3048, 10);
    expect(FRAME_UNITS.si.inertia).toBe('10⁶ mm⁴');
  });
  it('a temperature is a DIFFERENCE (9 °F is 5 °C, not −12.8), α goes the other way, and a listed α stays listed', () => {
    const f = run(defaultFrame(), { type: 'add', list: 'memberLoads', seed: { kind: 'temperature', dT: 9 } }, { type: 'patch', list: 'memberLoads', id: 12, patch: { dTg: 18 } });
    const si = convertFrame(f, 'si');
    expect(si.memberLoads[1]).toMatchObject({ dT: 5, dTg: 10, alpha: 11.7e-6 });
    expect(convertFrame(si, 'us').memberLoads[1]).toMatchObject({ dT: 9, dTg: 18, alpha: 6.5e-6 });
  });
  it('listed moduli stay listed (29,000 ksi is 200 GPa, not 199.95), a member\'s own too', () => {
    const f = run(defaultFrame(), { type: 'patch', list: 'members', id: 5, patch: { E: 10100 } });
    const si = convertFrame(f, 'si');
    expect(si.members[0].E).toBe(69.6);
    expect(convertFrame(si, 'us')).toEqual({ ...f, notice: null });
  });
  it('settlements are inches and millimetres, depths too; springs convert as line loads and moments', () => {
    let f = run(defaultFrame(), { type: 'patch', list: 'supports', id: 8, patch: { dy: -0.5, kx: 100, kr: 2000, dr: 0.001 } }, { type: 'patch', list: 'members', id: 7, patch: { h: 13.8 } });
    f = reduceFrame(f, { type: 'patch', list: 'members', id: 5, patch: { h: 10 } });
    const si = convertFrame(f, 'si');
    expect(si.supports[0]).toMatchObject({ dy: -12.7, dr: 0.001 });
    expect(si.supports[0].kx).toBeCloseTo(100 * 4.4482216152605 / 0.3048, 10);
    expect(si.supports[0].kr).toBeCloseTo(2000 * 4.4482216152605 * 0.3048, 10);
    expect(si.members[0].h).toBe(254);
    expect(toEngine(si).model.supports[0].dy).toBeCloseTo(-0.0127, 15);
    expect(toEngine(f).model.supports[0].dy).toBeCloseTo(-0.5 / 12, 15);
  });
  it('a typed value goes to the other system and back as itself: 3,000 random forms of typed numbers (eight figures at most)', () => {
    for (let seed = 1; seed <= 3000; seed++) {
      const f = normal(randomForm(seed, 12, false));
      const there = convertFrame(f, f.units === 'us' ? 'si' : 'us');
      const back = convertFrame(there, f.units);
      expect(back, `seed ${seed}`).toEqual(f);
      expect(there.nodes.length).toBe(f.nodes.length);
    }
  });
  it('a frame that has been converted already (numbers of fifteen figures) settles: one more round trip changes nothing', () => {
    for (let seed = 1; seed <= 1000; seed++) {
      const g = normal(randomForm(seed, 14));
      const there = (f: FrameForm) => convertFrame(f, f.units === 'us' ? 'si' : 'us');
      const once = there(there(g));
      const twice = there(there(once));
      // Within a hair (a number of fifteen figures has no more to give); never a visible change.
      const flat = (f: FrameForm) => JSON.stringify(f, (_k, v) => (typeof v === 'number' ? Number(v.toPrecision(12)) : v));
      expect(flat(twice), `seed ${seed}`).toBe(flat(once));
    }
  });
  it('the same frame in the other system is the same physical frame: the engine gives the same forces and moments (scaled)', () => {
    const us = defaultFrame();
    const si = convertFrame(us, 'si');
    const a = solveFrame(toEngine(us).model);
    const b = solveFrame(toEngine(si).model);
    expect(a.ok && b.ok).toBe(true);
    if (!a.ok || !b.ok) return;
    const kip = FRAME_US_TO_SI.force;
    expect(b.reactions[0].rx / kip).toBeCloseTo(a.reactions[0].rx, 6);
    expect(b.reactions[1].ry / kip).toBeCloseTo(a.reactions[1].ry, 6);
    expect(b.members[2].end.M / FRAME_US_TO_SI.moment).toBeCloseTo(a.members[2].end.M, 6);
    // The displacement in mm is the displacement in inches times 25.4: the frame in SI has the listed modulus (200 GPa, 29,000 ksi is 199.95) so a 0.03% difference.
    expect(b.displacements![2].ux * 1000 / (a.displacements![2].ux * 12 * 25.4)).toBeCloseTo(1, 2);
  });
  it('template parameters convert; the counts, the base and the hinge stay', () => {
    const p = { bays: 2, width: 20, height: 10, rise: 5, gravity: 1.2, lateral: 10, axial: 20, base: 'fixed' as const, hinge: true };
    const si = convertTemplateParams(p, 'us', 'si');
    expect(si).toMatchObject({ bays: 2, width: 6.096, height: 3.048, rise: 1.524, base: 'fixed', hinge: true });
    expect(si.gravity).toBeCloseTo(1.2 * 4.4482216152605 / 0.3048, 10);
    expect(convertTemplateParams(si, 'si', 'us')).toEqual(p);
    expect(convertTemplateParams(p, 'us', 'us')).toBe(p);
  });
  it('the engine conversions are in one place: 144, 20736 and 1e6 (US), 1e6 and 1e-3 (SI)', () => {
    expect(TO_ENGINE.us).toEqual({ area: 1 / 144, inertia: 1 / 20736, E: 144, depth: 1 / 12 });
    expect(TO_ENGINE.si).toEqual({ area: 1e-6, inertia: 1e-6, E: 1e6, depth: 1e-3 });
    expect(FRAME_MATERIALS.steel.E).toEqual({ us: 29000, si: 200 });
  });
  it('the model the engine is given is in feet and kips: the section crosses once', () => {
    const { model, rows } = toEngine(defaultFrame());
    expect(model.A).toBeCloseTo(14.1 / 144, 15);
    expect(model.I).toBeCloseTo(484 / 20736, 15);
    expect(model.E).toBe(29000 * 144);
    expect(model.members[0]).toEqual({ i: 0, j: 2 });
    expect(model.memberLoads[0]).toEqual({ kind: 'udl', member: 2, dir: 'global-y', w: -1.2 });
    expect(rows.members).toEqual([5, 6, 7]);
    const si = toEngine(convertFrame(defaultFrame(), 'si')).model;
    expect(si.A).toBeCloseTo(14.1 * 645.16 * 1e-6, 12);
    expect(si.E).toBe(200e6);
  });
  it('a hinge and a depth reach the engine; a null section does not', () => {
    const f = run(defaultFrame(), { type: 'patch', list: 'members', id: 7, patch: { hingeStart: true, h: 13.8 } }, { type: 'section', patch: { I: null } });
    const { model } = toEngine(f);
    expect(model.members[2]).toMatchObject({ i: 2, j: 3, releases: { start: true, end: false } });
    expect(model.members[2].h).toBeCloseTo(13.8 / 12, 14);
    expect('I' in model).toBe(false);
  });
  it('an issue is traced to the row that caused it', () => {
    const f = run(defaultFrame(), { type: 'patch', list: 'nodes', id: 2, patch: { x: Number.NaN } });
    const { model, rows } = toEngine(f);
    const out = solveFrame(model);
    expect(out.ok).toBe(false);
    if (out.ok) return;
    expect(issueRow(out.issues[0], rows)).toEqual({ list: 'nodes', id: 2, field: 'x' });
    expect(issueRow({ code: 'section', where: { list: 'model', index: 0, field: 'I' } }, rows)).toEqual({ list: 'model', field: 'I' });
    expect(issueRow({ code: 'no-members' }, rows)).toBeUndefined();
  });
});

describe('the address', () => {
  it('round-trips 3,000 random forms exactly (rows renumbered, notice gone) and writes the same text again', () => {
    for (let seed = 1; seed <= 3000; seed++) {
      const f = randomForm(seed, 20);
      const text = encode(f);
      const back = decode(text);
      expect(back, `seed ${seed}`).toEqual(normal(f));
      expect(encode(back!), `seed ${seed}`).toBe(text);
      expect(text.length).toBeLessThanOrEqual(MAX_LINK);
    }
  });
  it('carries what the form holds even when it is wrong: NaN, infinities, a member from a node to itself', () => {
    let f = run(defaultFrame(), { type: 'patch', list: 'nodes', id: 2, patch: { x: Number.NaN, y: Infinity } }, { type: 'patch', list: 'members', id: 5, patch: { j: 1 } }, { type: 'patch', list: 'loads', id: 10, patch: { fx: -Infinity } });
    f = reduceFrame(f, { type: 'patch', list: 'supports', id: 8, patch: { angle: 1e300, kx: 1e-300 } });
    expect(decode(encode(f))).toEqual(normal(f));
  });
  it('keeps the numbers to fifteen figures: a converted frame comes back unchanged through its own link', () => {
    const si = convertFrame(defaultFrame(), 'si');
    expect(decode(encode(si))).toEqual(si);
  });
  it('is bounded: the biggest form it can hold writes under MAX_LINK and reads back', () => {
    const long = -1.2345678912345e-100;
    const v = (k: number): number => Number((long * (k + 1)).toPrecision(15));
    const nodes = Array.from({ length: 50 }, (_, k) => ({ id: k + 1, x: v(k), y: -v(k) }));
    const members = Array.from({ length: 100 }, (_, k) => ({ id: 51 + k, i: 1 + (k % 50), j: 1 + ((k + 1) % 50), A: long, I: long, E: long, hingeStart: true, hingeEnd: true, h: long }));
    const supports = Array.from({ length: 40 }, (_, k) => ({ id: 151 + k, node: 1 + k, kind: 'spring' as const, angle: long, kx: long, ky: long, kr: long, dx: long, dy: long, dr: long }));
    const loads = Array.from({ length: 60 }, (_, k) => ({ id: 191 + k, node: 1 + (k % 50), fx: long, fy: long, m: long }));
    const memberLoads = Array.from({ length: 120 }, (_, k) => ({ id: 251 + k, member: 51 + (k % 100), kind: 'temperature' as const, dir: 'global-y' as const, w: long, w2: long, P: long, M: long, a: long, b: long, dT: long, dTg: long, alpha: long }));
    const f: FrameForm = { units: 'us', nodes, members, supports, loads, memberLoads, material: 'custom', E: long, A: long, I: long, notice: null, nextId: 371 };
    const text = encodeFrame(f);
    expect(text.length).toBeLessThan(MAX_LINK);
    expect(decodeFrame(text)).toEqual(normal(f));
    expect(decodeFrame(text + ' ')).toBeNull();
  });
  it('null on a check that is not the rest\'s, a cut-short link, a version, a count, a letter, a number in another notation', () => {
    const text = encode(defaultFrame());
    const body = text.slice(text.indexOf(';') + 1);
    const withCheck = (b: string) => `${checkOf(b)};${b}`;
    expect(decode(text)).not.toBeNull();
    expect(decode('')).toBeNull();
    expect(decode(text.slice(0, -1))).toBeNull();
    expect(decode(text.slice(1))).toBeNull();
    expect(decode(text.replace('K', 'L'))).toBeNull();
    expect(decode(withCheck(body.replace(/^1;/, '2;')))).toBeNull();
    expect(decode(withCheck(body.replace(';us;', ';uk;')))).toBeNull();
    expect(decode(withCheck(body + ';1'))).toBeNull();
    expect(decode(withCheck(body.split(';').slice(0, 7).join(';')))).toBeNull();
    expect(decode(withCheck(body.replace('s,29000', 'x,29000')))).toBeNull();
    // 2e1 is a notation the page reads (it writes 1e21 for a large number), as the number it is.
    expect(decode(withCheck(body.replace('20,0', '2e1,0')))).toEqual(defaultFrame());
    expect(decode(withCheck(body.replace('20,0', '+20,0')))).toBeNull();
    expect(decode(withCheck(body.replace('20,0', '0x14,0')))).toBeNull();
    expect(decode(withCheck(body.replace('1,3_2,4_3,4', '1,9_2,4_3,4')))).toBeNull();
    expect(decode(withCheck(body.replace(';f,1_f,2;', ';q,1_f,2;')))).toBeNull();
    expect(decode(withCheck(body.replace(/;u,3,3,/, ';u,3,9,')))).toBeNull();
    expect(decode(withCheck(body.replace(/;u,3,3,/, ';u,5,3,')))).toBeNull();
    expect(decode(withCheck(body.replace(/;u,3,3,/, ';z,3,3,')))).toBeNull();
  });
  it('fuzz: 100,000 strings, none throws, every one that reads is a form that writes and reads again', () => {
    const r = rng(2026);
    const seeds = [encode(defaultFrame()), encode(convertFrame(defaultFrame(), 'si')), ...Array.from({ length: 30 }, (_, k) => encode(randomForm(900 + k, 10)))];
    const alphabet = '0123456789.,;_-e+KkxXnaNiIfpPrgsjtmu ';
    const withCheck = (b: string) => `${checkOf(b)};${b}`;
    let read = 0;
    for (let k = 0; k < 100_000; k++) {
      let text: string;
      const roll = r();
      if (roll < 0.2) text = Array.from({ length: Math.floor(r() * 60) }, () => alphabet[Math.floor(r() * alphabet.length)]).join('');
      else {
        const src = seeds[Math.floor(r() * seeds.length)];
        let body = src.slice(src.indexOf(';') + 1);
        const edits = 1 + Math.floor(r() * 3);
        for (let e = 0; e < edits; e++) {
          const at = Math.floor(r() * body.length);
          const kind = Math.floor(r() * 4);
          if (kind === 0) body = body.slice(0, at) + body.slice(at + 1 + Math.floor(r() * 4));
          else if (kind === 1) body = body.slice(0, at) + alphabet[Math.floor(r() * alphabet.length)] + body.slice(at);
          else if (kind === 2) body = body.slice(0, at) + alphabet[Math.floor(r() * alphabet.length)] + body.slice(at + 1);
          else body = body.slice(0, at);
        }
        text = roll < 0.3 ? src.slice(0, Math.floor(r() * src.length)) : withCheck(body);
      }
      const form = decode(text);
      if (form === null) continue;
      read++;
      const again = decode(encode(form));
      expect(again).toEqual(normal(form));
    }
    expect(read).toBeGreaterThan(100);
  });
});
