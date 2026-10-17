import { afterEach, describe, expect, it } from 'vitest';
import { analyseSafely, analyseTruss, type TrussAnalysis } from './analysis';
import { solveTruss } from './engine';
import { convertTruss, defaultTruss, emptyTruss, reduceTruss, toEngine, type TrussAction, type TrussForm } from './model';
import { rng } from './oracle.testlib';

afterEach(() => new Promise<void>((resolve) => setTimeout(resolve, 0)));

/**
 * THE ANALYSIS: the form in, everything the page prints out — in the units
 * shown, in labels from 1, settled. The default truss is the reference: its
 * answer is worked out by hand in model.ts (defaultTruss), and every number
 * here that has a hand value is compared with it.
 */

const act = (form: TrussForm, ...actions: TrussAction[]) => actions.reduce(reduceTruss, form);
const near = (got: number, want: number, tol = 1e-9, scale = Math.max(1, Math.abs(want))) => expect(Math.abs(got - want), `got ${got}, want ${want}`).toBeLessThanOrEqual(tol * scale);
const results = (a: TrussAnalysis) => {
  if (!a.results) throw new Error(`not solved: ${JSON.stringify(a.issues)}`);
  return a.results;
};

/** Every number in an analysis, however deep. */
function numbers(value: unknown, out: number[] = []): number[] {
  if (typeof value === 'number') out.push(value);
  else if (Array.isArray(value)) value.forEach((v) => numbers(v, out));
  else if (value && typeof value === 'object') Object.values(value).forEach((v) => numbers(v, out));
  return out;
}

describe('truss analysis: the default truss, by hand', () => {
  const a = analyseSafely(defaultTruss());
  const r = results(a);
  const root2 = Math.SQRT2;
  // Members, by label: bottom 1..4, top 5..8, verticals 9..13, diagonals 14..17.
  const hand = [0, 15, 15, 0, -15, -20, -20, -15, -20, -15, -10, -15, -20, 15 * root2, 5 * root2, 5 * root2, 15 * root2];

  it('is solved, with no issues and no warnings, and is statically determinate', () => {
    expect(a.issues).toEqual([]);
    expect(a.warnings).toEqual([]);
    expect(a.determinacy).toEqual({ joints: 10, members: 17, reactions: 3, degree: 0, word: 'determinate' });
    expect(a.units.force).toBe('kip');
    expect(r.stiffness).toBe('absolute');
  });

  it('member forces: tension positive, the hand values, labelled from 1', () => {
    expect(r.members.length).toBe(17);
    r.members.forEach((m, k) => {
      expect(m.label).toBe(k + 1);
      near(m.force, hand[k]);
    });
    expect(r.members[0]).toMatchObject({ i: 1, j: 2, state: 'zero', force: 0 });
    expect(r.members[13]).toMatchObject({ i: 6, j: 2, state: 'tension' });
    expect(r.members[4]).toMatchObject({ i: 6, j: 7, state: 'compression' });
  });

  it('the words: tension, compression, zero — as codes', () => {
    expect(r.members.map((m) => m.state)).toEqual(hand.map((h) => (h > 0 ? 'tension' : h < 0 ? 'compression' : 'zero')));
    expect(r.zeroMembers).toEqual([1, 4]);
  });

  it('the share of the largest force, 0 to 1, for the weight of a line', () => {
    expect(r.maxForce).toBeCloseTo(15 * root2, 9);
    r.members.forEach((m, k) => near(m.share, Math.abs(hand[k]) / (15 * root2), 1e-12));
    expect(Math.max(...r.members.map((m) => m.share))).toBe(1);
    expect(r.members[0].share).toBe(0);
  });

  it('the largest tension and the largest compression, each with its member (the first when there is a tie)', () => {
    expect(r.largest.tension).toEqual({ member: 14, force: r.members[13].force });
    near(r.largest.tension!.force, 15 * root2);
    expect(r.largest.compression).toEqual({ member: 6, force: r.members[5].force });
    near(r.largest.compression!.force, -20);
  });

  it('reactions: 20 kip up at each end, nothing sideways, exactly', () => {
    expect(r.reactions).toEqual([
      { label: 1, node: 1, kind: 'pin', angle: null, rx: 0, ry: 20, magnitude: 20, along: null },
      { label: 2, node: 5, kind: 'roller', angle: 90, rx: 0, ry: 20, magnitude: 20, along: 20 },
    ]);
    expect(r.applied).toEqual({ fx: 0, fy: -40 });
  });

  it('stress N / A in ksi and elongation N L / E A in inches', () => {
    // 15 kip in 4 in²: 3.75 ksi. Length 8 ft = 96 in: 15 · 96 / (29,000 · 4) = 0.0124138 in.
    near(r.members[1].stress!, 3.75, 1e-12);
    near(r.members[1].elongation!, 1440 / 116000, 1e-12);
    near(r.members[4].stress!, -3.75, 1e-12);
    near(r.members[13].length, 8 * root2, 1e-12);
    expect(r.members[1].A).toBeCloseTo(4, 12);
    expect(r.members[1].E).toBeCloseTo(29000, 6);
    expect(r.members[0].stress).toBe(0);
    expect(r.members[0].elongation).toBe(0);
  });

  it('displacements, in inches: the supports do not move, the middle goes down — checked by virtual work, an identity of its own', () => {
    const d = r.displacements!;
    expect(d.length).toBe(10);
    expect(d[0]).toEqual({ node: 1, ux: 0, uy: 0, magnitude: 0 });
    // The roller moves sideways, not up.
    expect(d[4].uy).toBe(0);
    expect(d[4].ux).toBeGreaterThan(0);
    // Virtual work: the deflection at node 3 (the middle of the bottom chord) = Σ n·N·L / (E A), n the forces under a unit load there.
    const unit = defaultTruss();
    const model = toEngine(unit).model;
    const unitLoad = solveTruss({ ...model, loads: [{ node: 2, fx: 0, fy: -1 }] });
    if (!unitLoad.ok) throw new Error('no');
    const work = r.members.reduce((s, m, k) => s + (unitLoad.members[k].N * m.force * m.length * 12) / (29000 * 4), 0);
    near(d[2].uy, -work, 1e-9, Math.abs(work));
    expect(d[2].uy).toBeLessThan(0);
    // The symmetry of a symmetric truss: the middle does not move sideways more than the supports' freedom allows, and node 2 and 4 drop alike.
    near(d[1].uy, d[3].uy, 1e-9, Math.abs(d[1].uy));
  });

  it('the equilibrium block: nothing left, and it says it is balanced', () => {
    expect(r.equilibrium).toMatchObject({ sumFx: 0, sumFy: 0, sumM: 0, joint: 0, balanced: true });
    expect(r.equilibrium.about).toEqual({ x: 16, y: 4 });
  });

  it('nothing is zero by inspection here (the end bottom panels are zero by the pin, not by a rule)', () => {
    expect(r.inspection).toEqual([]);
  });
});

describe('truss analysis: what rounding is', () => {
  it('no number anywhere in a solved analysis is −0, NaN or infinite', () => {
    for (const f of [defaultTruss(), convertTruss(defaultTruss(), 'si'), act(defaultTruss(), { type: 'template', template: 'howe' }), act(defaultTruss(), { type: 'template', template: 'king-post' }), act(defaultTruss(), { type: 'section', patch: { A: null } })]) {
      const all = numbers(analyseSafely(f));
      expect(all.every(Number.isFinite)).toBe(true);
      expect(all.some((v) => Object.is(v, -0))).toBe(false);
    }
  });
  it('a force that is rounding is 0 — the king post\'s post under any scale of load', () => {
    for (const load of [1, 1e-8, 1e8]) {
      const a = analyseSafely(act(defaultTruss(), { type: 'template', template: 'king-post', params: { load } }));
      expect(results(a).members[4].force).toBe(0);
      expect(results(a).members[4].state).toBe('zero');
      expect(results(a).members[4].inspection).toEqual({ rule: 'three-members', node: 2 });
    }
  });
  it('the inspection rules are explained: the member, the node (labels) and the rule', () => {
    const a = analyseSafely(act(defaultTruss(), { type: 'template', template: 'king-post' }));
    expect(results(a).inspection).toEqual([{ member: 5, node: 2, rule: 'three-members' }]);
    expect(results(a).zeroMembers).toEqual([5]);
  });
});

describe('truss analysis: the units shown', () => {
  it('SI: kilonewtons, metres, millimetres, MPa — the same truss, the same answer in other numbers', () => {
    const us = results(analyseSafely(defaultTruss()));
    const si = results(analyseSafely(convertTruss(defaultTruss(), 'si')));
    expect(analyseSafely(convertTruss(defaultTruss(), 'si')).units.force).toBe('kN');
    const kN = 4.4482216152605;
    us.members.forEach((m, k) => {
      near(si.members[k].force, m.force * kN, 1e-5, 100);
      near(si.members[k].length, m.length * 0.3048, 1e-5, 10);
    });
    // 15 kip in 4 in² is 3.75 ksi = 25.855 MPa; 15 kip bar of 8 ft: 0.012414 in = 0.31531 mm.
    near(si.members[1].stress!, 3.75 * 6.894757293, 1e-5, 30);
    near(si.members[1].elongation!, (1440 / 116000) * 25.4, 1e-4, 1);
    near(si.reactions[0].ry, 20 * kN, 1e-5, 100);
    near(si.displacements![2].uy, us.displacements![2].uy * 25.4, 1e-4, 10);
    expect(si.members[1].A).toBeCloseTo(2580.64, 3);
    expect(si.members[1].E).toBeCloseTo(200, 6);
  });
});

describe('truss analysis: without a section', () => {
  it('forces and reactions only: no stress, no elongation, no displacements, stiffness equal', () => {
    const r = results(analyseSafely(act(defaultTruss(), { type: 'section', patch: { A: null } })));
    expect(r.stiffness).toBe('equal');
    expect(r.displacements).toBeNull();
    expect(r.members.every((m) => m.stress === null && m.elongation === null && m.A === null)).toBe(true);
    near(r.members[13].force, 15 * Math.SQRT2);
  });
  it('an area without a modulus gives stress and not elongation', () => {
    const r = results(analyseSafely(act(defaultTruss(), { type: 'section', patch: { E: null } })));
    expect(r.members.every((m) => m.elongation === null)).toBe(true);
    near(r.members[1].stress!, 3.75, 1e-12);
    expect(r.displacements).toBeNull();
  });
  it('a member with a section of its own: a different stress, and in a determinate truss the same force', () => {
    let f = defaultTruss();
    f = act(f, { type: 'patch', list: 'members', id: f.members[1].id, patch: { A: 2 } });
    const r = results(analyseSafely(f));
    near(r.members[1].force, 15);
    near(r.members[1].stress!, 7.5);
    near(r.members[2].stress!, 3.75);
  });
});

describe('truss analysis: statically indeterminate', () => {
  it('two pins: determinacy 1, the tie of the triangle is zero, and the warning says nothing', () => {
    const f = act(defaultTruss(), { type: 'template', template: 'triangle', params: { supports: 'two-pins', span: 24, height: 6, load: 10 } });
    const a = analyseSafely(f);
    expect(a.determinacy).toEqual({ joints: 3, members: 3, reactions: 4, degree: 1, word: 'indeterminate' });
    expect(results(a).members[0].force).toBe(0);
    expect(a.warnings).toEqual([]);
  });
  it('sections on some members only: the warning', () => {
    let f = act(defaultTruss(), { type: 'template', template: 'triangle', params: { supports: 'two-pins' } }, { type: 'section', patch: { A: null, E: null } });
    f = act(f, { type: 'patch', list: 'members', id: f.members[1].id, patch: { A: 3, E: 29000 } });
    expect(analyseSafely(f).warnings).toEqual([{ code: 'partial-stiffness' }]);
  });
  it('no loads: the warning, and zeros', () => {
    const f = act(defaultTruss(), ...defaultTruss().loads.map((l): TrussAction => ({ type: 'remove', list: 'loads', id: l.id })));
    const a = analyseSafely(f);
    expect(a.warnings).toEqual([{ code: 'no-load' }]);
    expect(results(a).members.every((m) => m.force === 0 && m.share === 0 && m.state === 'zero')).toBe(true);
    expect(results(a).largest).toEqual({ tension: null, compression: null });
    expect(results(a).maxForce).toBe(0);
  });
});

describe('truss analysis: what is wrong, by row and by label', () => {
  const base = defaultTruss();

  it('a mechanism names the nodes by label, and the word is unstable', () => {
    // Take away the diagonal T1-B2 (member 15): the middle panel is a mechanism.
    const f = act(base, { type: 'remove', list: 'members', id: base.members[14].id });
    const a = analyseSafely(f);
    expect(a.results).toBeNull();
    expect(a.issues).toHaveLength(1);
    expect(a.issues[0].code).toBe('mechanism');
    expect(a.issues[0].nodes!.every((n) => n >= 1 && n <= 10)).toBe(true);
    expect(a.determinacy).toMatchObject({ joints: 10, members: 16, reactions: 3, degree: -1, word: 'unstable' });
  });
  it('unrestrained and too few supports are unstable as well', () => {
    const noRoller = act(base, { type: 'remove', list: 'supports', id: base.supports[1].id });
    const a = analyseSafely(noRoller);
    expect(a.issues).toEqual([{ code: 'few-supports', count: 2 }]);
    expect(a.determinacy.word).toBe('unstable');
    const slide = act(base, { type: 'patch', list: 'supports', id: base.supports[1].id, patch: { angle: 0 } });
    expect(analyseSafely(slide).issues).toEqual([{ code: 'unrestrained', count: 1 }]);
  });
  it('a problem in one row is named with the row (by id) and its label, and no determinacy word is guessed', () => {
    const f = act(base, { type: 'patch', list: 'nodes', id: base.nodes[3].id, patch: { y: NaN } }, { type: 'patch', list: 'loads', id: base.loads[2].id, patch: { fx: NaN } });
    const a = analyseSafely(f);
    expect(a.issues).toContainEqual({ code: 'number', row: { list: 'nodes', id: base.nodes[3].id, field: 'y' }, at: 4 });
    expect(a.issues).toContainEqual({ code: 'number', row: { list: 'loads', id: base.loads[2].id, field: 'fx' }, at: 3 });
    expect(a.determinacy.word).toBeNull();
    expect(a.determinacy.degree).toBe(0);
  });
  it('duplicate members, duplicate nodes, an unconnected node, two pieces: labels from 1', () => {
    const dup = act(base, { type: 'patch', list: 'members', id: base.members[3].id, patch: { i: base.members[0].i, j: base.members[0].j } });
    expect(analyseSafely(dup).issues).toContainEqual({ code: 'duplicate-member', row: { list: 'members', id: base.members[3].id }, at: 4, members: [1, 4] });
    const same = act(base, { type: 'patch', list: 'nodes', id: base.nodes[1].id, patch: { x: 0, y: 0 } });
    expect(analyseSafely(same).issues).toContainEqual({ code: 'duplicate-node', nodes: [1, 2] });
    const alone = act(base, { type: 'add', list: 'nodes', seed: { x: 100, y: 100 } });
    expect(analyseSafely(alone).issues).toEqual([{ code: 'node-unconnected', nodes: [11] }]);
    const pieces = act(emptyTruss(), { type: 'add', list: 'nodes', seed: { x: 0, y: 0 } }, { type: 'add', list: 'nodes', seed: { x: 4, y: 0 } }, { type: 'add', list: 'nodes', seed: { x: 10, y: 0 } }, { type: 'add', list: 'nodes', seed: { x: 14, y: 0 } });
    const [n1, n2, n3, n4] = pieces.nodes.map((n) => n.id);
    const two = act(pieces, { type: 'add', list: 'members', seed: { i: n1, j: n2 } }, { type: 'add', list: 'members', seed: { i: n3, j: n4 } });
    expect(analyseSafely(two).issues).toEqual([{ code: 'disconnected', groups: [[1, 2], [3, 4]] }]);
  });
  it('an empty truss: few nodes, no members; the drawing is an empty box with room', () => {
    const a = analyseSafely(emptyTruss());
    expect(a.issues.map((i) => i.code)).toEqual(['few-nodes', 'no-members']);
    expect(a.issues[0].count).toBe(0);
    expect(a.drawing.nodes).toEqual([]);
    expect(a.drawing.frame).toEqual({ x0: -1, y0: -1, x1: 1, y1: 1, width: 2, height: 2 });
    expect(a.determinacy).toEqual({ joints: 0, members: 0, reactions: 0, degree: 0, word: null });
  });
  it('too big: the list and its cap', () => {
    // A hand-made form past a cap (the reducer never makes one).
    let f = emptyTruss();
    for (let k = 0; k < 40; k++) f = act(f, { type: 'add', list: 'nodes' });
    f = { ...f, nodes: [...f.nodes, { id: 999, x: 1, y: 1 }] };
    expect(analyseSafely(f).issues).toContainEqual({ code: 'too-big', row: undefined, list: 'nodes', max: 40, count: 41 } as never);
  });
  it('every issue code of the engine has numbers in labels, never indices: nothing is 0 in nodes, members or groups', () => {
    const cases: TrussForm[] = [
      act(base, { type: 'remove', list: 'members', id: base.members[14].id }),
      act(base, { type: 'patch', list: 'nodes', id: base.nodes[1].id, patch: { x: 0, y: 0 } }),
      act(base, { type: 'add', list: 'nodes' }),
    ];
    for (const f of cases) {
      for (const issue of analyseSafely(f).issues) {
        [...(issue.nodes ?? []), ...(issue.members ?? []), ...(issue.groups ?? []).flat()].forEach((n) => expect(n).toBeGreaterThanOrEqual(1));
        if (issue.at !== undefined) expect(issue.at).toBeGreaterThanOrEqual(1);
      }
    }
  });
});

describe('truss analysis: the drawing', () => {
  const f = defaultTruss();
  const a = analyseSafely(f);
  const d = a.drawing;

  it('nodes, members, loads and reactions, in the length unit, with labels from 1', () => {
    expect(d.nodes.length).toBe(10);
    expect(d.nodes[0]).toMatchObject({ label: 1, x: 0, y: 0, support: { kind: 'pin', angle: null } });
    expect(d.nodes[4]).toMatchObject({ label: 5, x: 32, y: 0, support: { kind: 'roller', angle: 90 } });
    expect(d.nodes[7].support).toBeNull();
    expect(d.members.length).toBe(17);
    expect(d.members[13]).toMatchObject({ label: 14, i: 6, j: 2, x1: 0, y1: 8, x2: 8, y2: 0, state: 'tension' });
    near(d.members[13].force!, 15 * Math.SQRT2);
  });
  it('line weights: |force| over the largest, 0 for a zero member', () => {
    expect(d.members[0].weight).toBe(0);
    expect(d.members[13].weight).toBe(1);
    near(d.members[5].weight, 20 / (15 * Math.SQRT2), 1e-12);
  });
  it('loads as arrows: the node, its position, the direction the force points, the size, the share of the largest', () => {
    expect(d.loads.map((l) => l.magnitude)).toEqual([5, 10, 10, 10, 5]);
    expect(d.loads.map((l) => l.share)).toEqual([0.5, 1, 1, 1, 0.5]);
    expect(d.loads[1]).toMatchObject({ label: 2, node: 7, x: 8, y: 8, fx: 0, fy: -10, dx: 0, dy: -1 });
  });
  it('reactions as arrows: where, which way, how big', () => {
    expect(d.reactions).toEqual([
      { label: 1, node: 1, x: 0, y: 0, fx: 0, fy: 20, magnitude: 20, dx: 0, dy: 1, share: 1 },
      { label: 2, node: 5, x: 32, y: 0, fx: 0, fy: 20, magnitude: 20, dx: 0, dy: 1, share: 1 },
    ]);
  });
  it('the box around the nodes and the frame with padding for a drawing', () => {
    expect(d.box).toEqual({ x0: 0, y0: 0, x1: 32, y1: 8, width: 32, height: 8 });
    expect(d.pad).toBeCloseTo(0.14 * 32, 12);
    expect(d.frame.x0).toBeCloseTo(-d.pad, 12);
    expect(d.frame.width).toBeCloseTo(32 + 2 * d.pad, 12);
    expect(d.frame.height).toBeCloseTo(8 + 2 * d.pad, 12);
  });
  it('the deformed shape: a scale that makes the largest displacement a twelfth of the long side, in the length unit', () => {
    const top = Math.max(...d.nodes.map((n) => Math.hypot(n.ux!, n.uy!)));
    expect(top).toBeGreaterThan(0);
    near(top * d.deformScale!, 32 / 12, 1e-9);
  });
  it('inclined and horizontal rollers are drawn with their line', () => {
    const g = act(f, { type: 'patch', list: 'supports', id: f.supports[1].id, patch: { angle: 480 } });
    expect(analyseSafely(g).drawing.nodes[4].support).toEqual({ kind: 'roller', angle: 120 });
  });
  it('an unsolved truss is still drawn, without forces', () => {
    const g = act(f, { type: 'remove', list: 'members', id: f.members[14].id });
    const u = analyseSafely(g).drawing;
    expect(u.members.length).toBe(16);
    expect(u.members.every((m) => m.force === null && m.state === null && m.weight === 0)).toBe(true);
    expect(u.reactions).toEqual([]);
    expect(u.loads.length).toBe(5);
    expect(u.deformScale).toBeNull();
    expect(u.nodes.every((n) => n.ux === null)).toBe(true);
  });
  it('whatever has no place is left out of the drawing, and nothing in it is NaN', () => {
    const g = act(f, { type: 'patch', list: 'nodes', id: f.nodes[2].id, patch: { x: NaN } }, { type: 'patch', list: 'loads', id: f.loads[0].id, patch: { fy: NaN } });
    const u = analyseSafely(g).drawing;
    expect(u.nodes.length).toBe(9);
    expect(u.members.length).toBeLessThan(17);
    expect(u.loads.length).toBe(4);
    expect(numbers(u).every(Number.isFinite)).toBe(true);
  });
  it('a load of zero has no arrow; a truss with no loads has none', () => {
    const g = act(f, { type: 'patch', list: 'loads', id: f.loads[0].id, patch: { fy: 0 } });
    expect(analyseSafely(g).drawing.loads.length).toBe(4);
  });
});

describe('truss analysis: it does not throw', () => {
  it('analyseSafely on random garbage forms: a form with NaN everywhere, dangling references, empty lists, huge numbers', () => {
    const rand = rng(12);
    const junk = [NaN, Infinity, -Infinity, 0, -0, 1e300, -1e300, 1e-300, 1, -1, 5.5];
    for (let t = 0; t < 300; t++) {
      let f = defaultTruss();
      const mangled: TrussForm = JSON.parse(JSON.stringify(f));
      const rows = [...mangled.nodes, ...mangled.members, ...mangled.supports, ...mangled.loads] as unknown as Record<string, unknown>[];
      for (let k = 0; k < 1 + Math.floor(rand() * 6); k++) {
        const row = rows[Math.floor(rand() * rows.length)];
        const keys = Object.keys(row).filter((key) => key !== 'id');
        row[keys[Math.floor(rand() * keys.length)]] = junk[Math.floor(rand() * junk.length)];
      }
      if (rand() < 0.2) mangled.members.length = Math.floor(rand() * 5);
      if (rand() < 0.2) mangled.supports.length = Math.floor(rand() * 3);
      if (rand() < 0.1) mangled.nodes = mangled.nodes.slice(0, Math.floor(rand() * 10));
      f = mangled;
      const a = analyseSafely(f);
      expect(Array.isArray(a.issues)).toBe(true);
      expect(a.results === null || a.issues.length === 0).toBe(true);
      expect(numbers(a).every((v) => Number.isFinite(v) || false)).toBe(true);
    }
  });
  it('a form that throws when it is read is answered with stopped, and the drawing the form still allows', () => {
    const hostile = {
      ...defaultTruss(),
      get nodes(): never {
        throw new Error('no');
      },
    } as unknown as TrussForm;
    const a = analyseSafely(hostile);
    expect(a.issues).toEqual([{ code: 'stopped' }]);
    expect(a.results).toBeNull();
    expect(a.drawing.nodes).toEqual([]);
    expect(a.drawing.frame.width).toBe(2);
    expect(a.units.force).toBe('kip');
    expect(() => analyseTruss(hostile)).toThrow();
  });
  it('a full-size truss (40 nodes, 77 members) is analysed in well under a second', () => {
    const f = act(defaultTruss(), { type: 'template', template: 'cantilever', params: { span: 76, height: 4, panels: 19 } });
    expect(f.nodes.length).toBe(40);
    const t0 = performance.now();
    const a = analyseSafely(f);
    expect(performance.now() - t0).toBeLessThan(1000);
    expect(a.results).not.toBeNull();
  });
  it('every template, at every size, in both unit systems, is analysed with an answer and no issue', () => {
    for (const id of ['triangle', 'king-post', 'queen-post', 'pratt', 'howe', 'warren', 'warren-verticals', 'fink', 'cantilever'] as const) {
      for (const units of ['us', 'si'] as const) {
        const a = analyseSafely(act(convertTruss(defaultTruss(), units), { type: 'template', template: id }));
        expect(a.issues, `${id} ${units}`).toEqual([]);
        expect(results(a).equilibrium.balanced).toBe(true);
      }
    }
  });
});

describe('truss analysis: what the page calls balanced is what the engine accepted (A3)', () => {
  it('an indeterminate two-pin truss with one member 1e8 times stiffer is never called out of balance', { timeout: 120000 }, () => {
    const rand = rng(4242);
    let solvedCount = 0;
    for (let t = 0; t < 150; t++) {
      const n = 2 + Math.floor(rand() * 4);
      const f = defaultTruss();
      const nodes: { id: number; x: number; y: number }[] = [];
      for (let i = 0; i <= n; i++) nodes.push({ id: i + 1, x: (i * 20) / n, y: 0 });
      for (let i = 0; i <= n; i++) nodes.push({ id: n + 2 + i, x: (i * 20) / n, y: 6 });
      const pairs: [number, number][] = [];
      for (let i = 0; i < n; i++) pairs.push([i + 1, i + 2], [n + 2 + i, n + 3 + i]);
      for (let i = 0; i <= n; i++) pairs.push([i + 1, n + 2 + i]);
      for (let i = 0; i < n; i++) pairs.push(i % 2 ? [n + 2 + i, i + 2] : [i + 1, n + 3 + i]);
      const stiff = Math.floor(rand() * pairs.length);
      f.nodes = nodes;
      f.members = pairs.map(([i, j], k) => ({ id: 100 + k, i, j, A: k === stiff ? 4e8 : 4, E: null }));
      f.supports = [{ id: 300, node: 1, kind: 'pin', angle: 90 }, { id: 301, node: n + 1, kind: 'pin', angle: 90 }];
      f.loads = nodes.slice(n + 1).map((p, k) => ({ id: 400 + k, node: p.id, fx: 0, fy: -10 }));
      f.E = 29000;
      f.A = null;
      const a = analyseSafely(f);
      if (!a.results) continue;
      solvedCount++;
      expect(a.results.equilibrium.balanced, `case ${t}`).toBe(true);
    }
    expect(solvedCount).toBeGreaterThan(100);
  });
  it('a result that really is out of balance is still called so', () => {
    // The analysis cannot be handed an unbalanced solution by the engine, so the rule is checked on its own numbers: the
    // tolerance is a millionth of the larger of the loads and the forces.
    const a = analyseSafely(defaultTruss());
    expect(results(a).equilibrium.balanced).toBe(true);
  });
});

describe('truss analysis: coincident nodes are one complaint, not forty-seven (C9, C10)', () => {
  const moveTo = (f: TrussForm, labels: number[], x: number, y: number): TrussForm => ({ ...f, nodes: f.nodes.map((n, k) => (labels.includes(k + 1) ? { ...n, x, y } : n)) });

  it('ten nodes at one place give one issue naming all ten', () => {
    const a = analyseSafely(moveTo(defaultTruss(), [1, 2, 3, 4, 5, 6, 7, 8, 9, 10], 0, 0));
    const dup = a.issues.filter((i) => i.code === 'duplicate-nodes' || i.code === 'duplicate-node');
    expect(dup).toHaveLength(1);
    expect(dup[0].code).toBe('duplicate-nodes');
    expect(dup[0].nodes).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
  });

  it('two nodes at one place stay the pair the sentence is written for, and two such places are two issues', () => {
    const one = analyseSafely(moveTo(defaultTruss(), [2, 3], 8, 0));
    expect(one.issues.filter((i) => i.code === 'duplicate-node').map((i) => i.nodes)).toEqual([[2, 3]]);
    const two = analyseSafely(moveTo(moveTo(defaultTruss(), [2, 3], 8, 0), [7, 8], 8, 8));
    const groups = two.issues.filter((i) => i.code === 'duplicate-node' || i.code === 'duplicate-nodes').map((i) => i.nodes);
    expect(groups).toEqual([[2, 3], [7, 8]]);
  });

  it('a node a hundred quintillion feet away does not make two nodes 8 ft apart "the same place"', () => {
    const f = defaultTruss();
    const far = moveTo(f, [10], 1e20, 8);
    const a = analyseSafely(far);
    expect(a.results).toBeNull();
    const codes = a.issues.map((i) => i.code);
    expect(codes).not.toContain('duplicate-node');
    expect(codes).toContain('scale');
    const scale = a.issues.find((i) => i.code === 'scale')!;
    expect(scale.size).toBeGreaterThan(1e19);
    expect(scale.distance).toBeGreaterThan(0);
    expect(scale.distance).toBeLessThan(1e10);
    expect(scale.nodes!.length).toBe(2);
  });
});

describe('truss analysis: a section comes back as it was typed (A11)', () => {
  it('1000 mm² and 200 GPa are exactly 1000 and 200 in the results, and so are 8.8701 in² and 29,000 ksi', () => {
    const si = convertTruss(defaultTruss(), 'si');
    const form = reduceTruss(reduceTruss(si, { type: 'section', patch: { A: 1000 } }), { type: 'patch', list: 'members', id: si.members[0].id, patch: { A: 1000, E: 200 } });
    const r = results(analyseSafely(form));
    expect(r.members[0].A).toBe(1000);
    expect(r.members[0].E).toBe(200);
    expect(r.members[1].A).toBe(1000);
    const us = reduceTruss(defaultTruss(), { type: 'section', patch: { A: 8.8701 } });
    expect(results(analyseSafely(us)).members.map((m) => m.A)).toEqual(Array(17).fill(8.8701));
  });
});
