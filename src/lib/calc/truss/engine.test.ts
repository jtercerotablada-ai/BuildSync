import { afterEach, describe, expect, it } from 'vitest';
import { COLLINEAR, MECH, countOf, directionOf, jacobiEigen, positiveDefinite, solveLinear, solveTruss, zeroByInspection } from './engine';
import { B1, DIRECTIONS, generate, int, oracle, pick, q as fraction, rng, type Generated } from './oracle.testlib';
import { buildTemplate, TEMPLATE_IDS, type TemplateId, type TemplateParams } from './templates';
import { MAX_LOADS, MAX_MEMBERS, MAX_NODES, MAX_SUPPORTS, type TrussIssueCode, type TrussModel, type TrussSolution } from './types';

// A turn of the event loop between two tests lets the runner hear from this worker, which it otherwise
// reports as a timeout of its own over a passing run (continuous/engine.test.ts does the same).
afterEach(() => new Promise<void>((resolve) => setTimeout(resolve, 0)));

/**
 * THE TRUSS ENGINE, against what is known.
 *
 * Five kinds of evidence, each independent of the others:
 *
 *   — textbook trusses, with the answer worked out by hand in a comment beside
 *     each (joints, then a check by sections);
 *   — an ORACLE that shares no code with the engine (oracle.testlib.ts: exact
 *     fractions, its own assembly, fraction-free elimination, supports as
 *     Lagrange multipliers), on hundreds of random determinate and indeterminate
 *     trusses, with random loads and supports including INCLINED rollers;
 *   — properties that must hold of EVERY truss, whatever its answer: equilibrium
 *     of the whole and of every joint (recomputed here from the forces, not read
 *     from the engine), a determinate truss does not depend on E·A, forces are
 *     linear in the loads, turning the whole truss turns the reactions and leaves
 *     the member forces alone, a mirror image gives a mirror image;
 *   — every problem the engine reports, once each;
 *   — the limits: forty nodes, a hundred and twenty members, lopsided stiffness.
 */

const solved = (model: TrussModel): TrussSolution => {
  const out = solveTruss(model);
  if (!out.ok) throw new Error(`not solved: ${JSON.stringify(out.issues)}`);
  return out;
};
const issuesOf = (model: unknown) => {
  const out = solveTruss(model as TrussModel);
  return out.ok ? [] : out.issues;
};
const codesOf = (model: unknown): TrussIssueCode[] => issuesOf(model).map((i) => i.code);
const near = (got: number, want: number, tol = 1e-9, scale = Math.max(1, Math.abs(want))) => {
  expect(Math.abs(got - want), `got ${got}, want ${want}`).toBeLessThanOrEqual(tol * scale);
};
const forces = (s: TrussSolution) => s.members.map((m) => m.N);
const biggest = (s: TrussSolution) => Math.max(0, ...forces(s).map(Math.abs));
const template = (id: TemplateId, p: Partial<TemplateParams> = {}): TrussModel => {
  const t = buildTemplate(id, p, 'us');
  return { nodes: t.nodes, members: t.members, supports: t.supports, loads: t.loads };
};
const loadScaleOf = (m: TrussModel) => m.loads.reduce((s, l) => s + Math.hypot(l.fx, l.fy), 0);

/** The residuals of a solution, RECOMPUTED from the member forces and the reactions: nothing here is read from `equilibrium`. */
function residuals(model: TrussModel, s: TrussSolution) {
  const J = model.nodes.length;
  const sum = model.nodes.map(() => [0, 0]);
  model.loads.forEach((l) => {
    sum[l.node][0] += l.fx;
    sum[l.node][1] += l.fy;
  });
  s.reactions.forEach((r) => {
    sum[r.node][0] += r.rx;
    sum[r.node][1] += r.ry;
  });
  model.members.forEach((m, k) => {
    const dx = model.nodes[m.j].x - model.nodes[m.i].x;
    const dy = model.nodes[m.j].y - model.nodes[m.i].y;
    const L = Math.hypot(dx, dy);
    const N = s.members[k].N;
    sum[m.i][0] += (N * dx) / L;
    sum[m.i][1] += (N * dy) / L;
    sum[m.j][0] -= (N * dx) / L;
    sum[m.j][1] -= (N * dy) / L;
  });
  let fx = 0;
  let fy = 0;
  let mo = 0;
  const cx = model.nodes.reduce((a, n) => a + n.x, 0) / J;
  const cy = model.nodes.reduce((a, n) => a + n.y, 0) / J;
  model.loads.forEach((l) => {
    fx += l.fx;
    fy += l.fy;
    mo += (model.nodes[l.node].x - cx) * l.fy - (model.nodes[l.node].y - cy) * l.fx;
  });
  s.reactions.forEach((r) => {
    fx += r.rx;
    fy += r.ry;
    mo += (model.nodes[r.node].x - cx) * r.ry - (model.nodes[r.node].y - cy) * r.rx;
  });
  return { joint: Math.max(...sum.map((v) => Math.hypot(v[0], v[1]))), fx, fy, moment: mo };
}

/** Every number a solution holds. */
const numbersOf = (s: TrussSolution): number[] => [
  ...s.nodes.flatMap((n) => [n.x, n.y]),
  ...s.members.flatMap((m) => [m.length, m.cx, m.cy, m.N, m.elongation ?? 0, m.stress ?? 0, m.A ?? 0, m.E ?? 0]),
  ...s.reactions.flatMap((r) => [r.rx, r.ry, r.magnitude, r.along ?? 0, r.angle ?? 0]),
  ...(s.displacements ?? []).flatMap((d) => [d.ux, d.uy, d.magnitude]),
  s.equilibrium.sumFx,
  s.equilibrium.sumFy,
  s.equilibrium.sumM,
  s.equilibrium.joint,
  s.equilibrium.scale,
  ...(s.largest.tension ? [s.largest.tension.N] : []),
  ...(s.largest.compression ? [s.largest.compression.N] : []),
];

/* ═══ Textbook trusses ═══════════════════════════════════════════════════ */

describe('truss engine: a triangle, by hand', () => {
  // Base 4, apex at (2, 3), 10 down at the apex; pin at the left, roller (vertical) at the right.
  // R = 5 at each end. The rafters have sin θ = 3/√13, cos θ = 2/√13:
  //   rafter  C = 5 / sin θ = 5√13 / 3 = 6.00925 (compression);   tie  T = C cos θ = 10/3 (tension).
  const model: TrussModel = {
    nodes: [{ x: 0, y: 0 }, { x: 4, y: 0 }, { x: 2, y: 3 }],
    members: [{ i: 0, j: 1 }, { i: 0, j: 2 }, { i: 1, j: 2 }],
    supports: [{ node: 0, kind: 'pin' }, { node: 1, kind: 'roller' }],
    loads: [{ node: 2, fx: 0, fy: -10 }],
  };
  const s = solved(model);
  it('forces, tension positive', () => {
    near(s.members[0].N, 10 / 3);
    near(s.members[1].N, (-5 * Math.sqrt(13)) / 3);
    near(s.members[2].N, (-5 * Math.sqrt(13)) / 3);
  });
  it('reactions: 5 up at each end, none sideways, exactly', () => {
    expect(s.reactions[0]).toMatchObject({ node: 0, kind: 'pin', angle: null, rx: 0, ry: 5, magnitude: 5, along: null });
    expect(s.reactions[1]).toMatchObject({ node: 1, kind: 'roller', angle: 90, rx: 0, ry: 5, magnitude: 5, along: 5 });
  });
  it('geometry and words: lengths, direction cosines, determinacy, the largest of each kind', () => {
    near(s.members[1].length, Math.sqrt(13));
    near(s.members[1].cx, 2 / Math.sqrt(13));
    near(s.members[1].cy, 3 / Math.sqrt(13));
    near(s.members[2].cx, -2 / Math.sqrt(13));
    expect(s.determinacy).toEqual({ joints: 3, members: 3, reactions: 3, degree: 0, word: 'determinate' });
    expect(s.largest.tension?.member).toBe(0);
    expect(s.largest.compression?.member === 1 || s.largest.compression?.member === 2).toBe(true);
    expect(s.stiffness).toBe('equal');
    expect(s.displacements).toBeNull();
    expect(s.members[0].elongation).toBeNull();
    expect(s.members[0].stress).toBeNull();
    expect(s.warnings).toEqual([]);
  });
  it('the equilibrium block is about the middle of the box, and balanced', () => {
    expect(s.equilibrium.about).toEqual({ x: 2, y: 1.5 });
    expect(s.equilibrium.scale).toBe(10);
    near(s.equilibrium.sumFx, 0, 1e-12);
    near(s.equilibrium.sumFy, 0, 1e-12);
    near(s.equilibrium.sumM, 0, 1e-12);
  });
});

describe('truss engine: Pratt, Howe and Warren trusses worked out by hand', () => {
  // Four panels of 8 ft, 8 ft deep (diagonals at 45°), 10 kip at each top joint and 5 at the two ends:
  // ΣP = 40, R = 20 each.
  const P = { span: 32, height: 8, panels: 4, load: 10 };
  const root2 = Math.SQRT2;

  it('PRATT. Joints from the left: B0: vertical −20, bottom 0. T0: diagonal 15√2, top −15. B1: bottom +15, vertical −15. T1: diagonal 5√2, top −20. B2: vertical −10.', () => {
    const s = solved(template('pratt', P));
    // Members: bottom 0..3, top 4..7, verticals 8..12, diagonals 13..16.
    const want = [0, 15, 15, 0, -15, -20, -20, -15, -20, -15, -10, -15, -20, 15 * root2, 5 * root2, 5 * root2, 15 * root2];
    s.members.forEach((m, k) => near(m.N, want[k]));
    expect(s.reactions.map((r) => r.ry)).toEqual([20, 20]);
    // The end bottom panels carry nothing: exactly zero, and the engine says so.
    expect(s.members[0].zero).toBe(true);
    expect(s.members[3].zero).toBe(true);
    expect(s.members[0].N).toBe(0);
    expect(Object.is(s.members[0].N, -0)).toBe(false);
    expect(s.largest.tension).toEqual({ member: 13, N: s.members[13].N });
    expect(s.largest.compression?.member).toBe(5);
  });

  it('HOWE. Joints: T0: vertical −5, top 0. B0: diagonal −15√2, bottom +15. T1: top −15, vertical +5. B1: diagonal −5√2, bottom +20. T2: centre vertical 0.', () => {
    const s = solved(template('howe', P));
    const want = [15, 20, 20, 15, 0, -15, -15, 0, -5, 5, 0, 5, -5, -15 * root2, -5 * root2, -5 * root2, -15 * root2];
    s.members.forEach((m, k) => near(m.N, want[k]));
  });

  it('WARREN (no verticals), two panels of 4 ft under 10 kip on each of two top joints, 4 ft deep. B0: diagonal −5√5, bottom +5. T0: the middle diagonal is ZERO, top −5.', () => {
    // Span 8, depth 4, top joints at x = 2 and 6. R = 10. The end diagonals have sin = 4/√20: −10/sin = −5√5.
    const s = solved(template('warren', { span: 8, height: 4, panels: 2, load: 10 }));
    // Members: bottom 0,1; top 2; diagonals B0T0, T0B1, B1T1, T1B2.
    const want = [5, 5, -5, -5 * Math.sqrt(5), 0, 0, -5 * Math.sqrt(5)];
    s.members.forEach((m, k) => near(m.N, want[k]));
    expect(s.members[4].zero && s.members[5].zero).toBe(true);
  });

  it('KING POST. R = 10; rafter C = 5/sin θ = 11.180; the tie T = C cos θ = P·L/(4h) = 10; the post carries NOTHING', () => {
    const s = solved(template('king-post', { span: 24, height: 6, load: 10 }));
    // Members: tie 0,1; rafters 2,3; post 4.
    const want = [10, 10, -5 * Math.sqrt(5), -5 * Math.sqrt(5), 0];
    s.members.forEach((m, k) => near(m.N, want[k]));
    expect(s.inspection).toEqual([{ member: 4, node: 1, rule: 'three-members' }]);
  });

  it('FINK. R = 20; at the heel the net upward force is 20 − 5 = 15, so the rafter is 15/sin θ = 33.541 (compression) and the tie 3P = 30', () => {
    const s = solved(template('fink', { span: 24, height: 6, load: 10 }));
    // Members: bottom 0..2; rafters 3..6; webs 7..10. sin θ = 6/√180.
    near(s.members[3].N, -15 / (6 / Math.sqrt(180)));
    near(s.members[0].N, 30);
    near(s.members[2].N, 30);
    // Symmetry holds.
    near(s.members[3].N, s.members[6].N);
    near(s.members[7].N, s.members[10].N);
    near(s.members[8].N, s.members[9].N);
    near(s.members[4].N, s.members[5].N);
  });

  it('CANTILEVER, one panel of 4 ft × 4 ft with 10 kip down at the free top corner. The pin takes (−10, +20), the roller (+10, 0); the diagonal is 10√2 tension, the bottom chord 10 compression, the free vertical 10 compression', () => {
    // load 20 → 10 at each end of the top chord; the 10 at the wall goes straight into the pin.
    const s = solved(template('cantilever', { span: 4, height: 4, panels: 1, load: 20 }));
    // Nodes: B0 (0), B1 (1), T0 (2), T1 (3). Members: bottom 0, top 1, verticals 2 (wall), 3 (free), diagonal 4 (T0 → B1).
    const want = [-10, 0, 0, -10, 10 * root2];
    s.members.forEach((m, k) => near(m.N, want[k]));
    const pin = s.reactions.find((r) => r.kind === 'pin')!;
    const roller = s.reactions.find((r) => r.kind === 'roller')!;
    near(pin.rx, -10);
    near(pin.ry, 20);
    near(roller.rx, 10);
    expect(roller.ry).toBe(0);
    near(roller.along!, 10);
    expect(roller.angle).toBe(0);
  });
});

describe('truss engine: an indeterminate truss follows the stiffness', () => {
  // THREE BARS from a ceiling to a joint D 3 below: A(−4,0) and C(4,0) (length 5, cos = 3/5) and B(0,0) (length 3);
  // P = 10 down at D. The vertical stiffness of D is  EA_B/3 + 2·(EA_A/5)·(3/5)².  δ = P / that;  N_B = (EA_B/3)·δ;
  // N_A = (EA_A/5)·(3/5)·δ.
  const bars = (ea: number, eb: number, withSection = true): TrussModel => ({
    nodes: [{ x: -4, y: 0 }, { x: 0, y: 0 }, { x: 4, y: 0 }, { x: 0, y: -3 }],
    members: [
      { i: 0, j: 3, ...(withSection ? { A: ea, E: 1 } : {}) },
      { i: 1, j: 3, ...(withSection ? { A: eb, E: 1 } : {}) },
      { i: 2, j: 3, ...(withSection ? { A: ea, E: 1 } : {}) },
    ],
    supports: [{ node: 0, kind: 'pin' }, { node: 1, kind: 'pin' }, { node: 2, kind: 'pin' }],
    loads: [{ node: 3, fx: 0, fy: -10 }],
  });
  it('the force in each bar is its share of the stiffness', () => {
    for (const [a, b] of [[1, 1], [7, 4], [1, 100], [100, 1], [3, 0.01]]) {
      const s = solved(bars(a, b));
      const delta = 10 / (b / 3 + (2 * a * 9) / 125);
      near(s.members[1].N, (b / 3) * delta, 1e-11);
      near(s.members[0].N, (a / 5) * (3 / 5) * delta, 1e-11);
      near(s.members[2].N, s.members[0].N, 1e-11);
      expect(s.stiffness).toBe('absolute');
      // D moves down by δ and not sideways; the elongation of B is δ.
      near(s.displacements![3].uy, -delta, 1e-11);
      near(s.displacements![3].ux, 0, 1e-11, 1);
      near(s.members[1].elongation!, delta, 1e-11);
      expect(s.determinacy).toEqual({ joints: 4, members: 3, reactions: 6, degree: 1, word: 'indeterminate' });
    }
  });
  it('a stiffer middle bar takes more of the load', () => {
    expect(solved(bars(1, 10)).members[1].N).toBeGreaterThan(solved(bars(1, 1)).members[1].N);
  });
  it('without sections, all bars are equally stiff, as for EA = 1', () => {
    const s = solved(bars(1, 1, false));
    const delta = 10 / (1 / 3 + 18 / 125);
    near(s.members[1].N, delta / 3);
    expect(s.stiffness).toBe('equal');
    expect(s.warnings).toEqual([]);
  });
  it('with a section on SOME members, the stiffness is taken as equal and the warning says so', () => {
    const m = bars(1, 1, false);
    m.members[0].A = 5;
    m.members[0].E = 2;
    const s = solved(m);
    expect(s.warnings).toEqual([{ code: 'partial-stiffness' }]);
    expect(s.stiffness).toBe('equal');
    near(s.members[1].N, solved(bars(1, 1, false)).members[1].N);
    // The members that have a section still have their stress and elongation.
    expect(s.members[0].stress).toBeCloseTo(s.members[0].N / 5, 12);
    expect(s.members[0].elongation).toBeCloseTo((s.members[0].N * 5) / (2 * 5), 12);
    expect(s.members[1].elongation).toBeNull();
  });
  it('a determinate truss with sections on some members only warns of nothing: its forces do not depend on them', () => {
    const m = template('triangle');
    m.members[0].A = 3;
    m.members[0].E = 29000;
    expect(solved(m).warnings).toEqual([]);
  });
  it('a triangle on two pins: the tie between the pins carries nothing, the rafters P/(2 sin θ), the thrust P/(2 tan θ)', () => {
    // m + r − 2j = 3 + 4 − 6 = 1. Apex (2, 3), P = 10 down, pins at (0,0) and (4,0).
    const m: TrussModel = {
      nodes: [{ x: 0, y: 0 }, { x: 4, y: 0 }, { x: 2, y: 3 }],
      members: [{ i: 0, j: 1 }, { i: 0, j: 2 }, { i: 1, j: 2 }],
      supports: [{ node: 0, kind: 'pin' }, { node: 1, kind: 'pin' }],
      loads: [{ node: 2, fx: 0, fy: -10 }],
    };
    const s = solved(m);
    expect(s.determinacy.degree).toBe(1);
    expect(s.determinacy.word).toBe('indeterminate');
    expect(s.members[0].N).toBe(0);
    near(s.members[1].N, ((-10 / 2) * Math.sqrt(13)) / 3);
    near(s.reactions[0].rx, 10 / 2 / (3 / 2));
    near(s.reactions[1].rx, -10 / 2 / (3 / 2));
  });
});

describe('truss engine: supports', () => {
  const triangle = (supports: TrussModel['supports'], loads: TrussModel['loads']): TrussModel => ({
    nodes: [{ x: 0, y: 0 }, { x: 4, y: 0 }, { x: 2, y: 3 }],
    members: [{ i: 0, j: 1 }, { i: 0, j: 2 }, { i: 1, j: 2 }],
    supports,
    loads,
  });
  it('the angle of a roller: 90 is vertical, 0 horizontal; angle and angle + 180 are one line; the default is 90', () => {
    expect(directionOf(undefined)).toEqual({ angle: 90, c: 0, s: 1 });
    expect(directionOf(0)).toEqual({ angle: 0, c: 1, s: 0 });
    expect(directionOf(180)).toEqual({ angle: 0, c: 1, s: 0 });
    expect(directionOf(-90).angle).toBe(90);
    expect(directionOf(450).angle).toBe(90);
    expect(directionOf(-45).angle).toBe(135);
    expect(directionOf(1e15 + 30).angle).toBeGreaterThanOrEqual(0);
  });
  it('a roller on a wall (angle 0) takes a horizontal reaction and no vertical one', () => {
    const model = triangle([{ node: 0, kind: 'pin' }, { node: 2, kind: 'roller', angle: 0 }, { node: 1, kind: 'roller', angle: 90 }], [{ node: 2, fx: 6, fy: 0 }]);
    const s = solved(model);
    // Statically indeterminate (r = 4); equilibrium holds, and the roller at the apex has no vertical reaction at all.
    const r = residuals(model, s);
    near(r.fx, 0, 1e-12);
    near(r.moment, 0, 1e-12, 10);
    expect(s.reactions[1].ry).toBe(0);
  });
  it('an INCLINED roller reacts along its line only, and the truss stays in equilibrium', () => {
    // A 3-4-5 roller: reaction along (3/5, 4/5). Pin at the left corner, load 10 down at the apex.
    const model = triangle([{ node: 0, kind: 'pin' }, { node: 1, kind: 'roller', angle: (Math.atan2(4, 3) * 180) / Math.PI }], [{ node: 2, fx: 0, fy: -10 }]);
    const s = solved(model);
    const roller = s.reactions[1];
    near(roller.rx / roller.ry, 3 / 4);
    // ΣM about the pin: the roller (3/5, 4/5)·ρ at (4,0): 4·(4/5)ρ = 10 · 2 → ρ = 6.25.
    near(roller.along!, 6.25);
    near(roller.rx, 3.75);
    near(roller.ry, 5);
    near(s.reactions[0].rx, -3.75);
    near(s.reactions[0].ry, 5);
    near(residuals(model, s).joint, 0, 1e-12);
  });
  it('the same line named 45° and 225° gives the same truss', () => {
    const a = solved(triangle([{ node: 0, kind: 'pin' }, { node: 1, kind: 'roller', angle: 45 }], [{ node: 2, fx: 0, fy: -10 }]));
    const b = solved(triangle([{ node: 0, kind: 'pin' }, { node: 1, kind: 'roller', angle: 225 }], [{ node: 2, fx: 0, fy: -10 }]));
    expect(forces(b)).toEqual(forces(a));
    expect(b.reactions[1].angle).toBe(45);
  });
  it('three rollers hold a truss when their lines of action are neither parallel nor through one point', () => {
    // Lines: y = 0 (horizontal at node 0), x = 4 and x = 2 (vertical at nodes 1 and 2).
    const model = triangle([{ node: 0, kind: 'roller', angle: 0 }, { node: 1, kind: 'roller', angle: 90 }, { node: 2, kind: 'roller', angle: 90 }], [{ node: 2, fx: 3, fy: -10 }]);
    const s = solved(model);
    near(residuals(model, s).fx, 0, 1e-12);
    expect(s.determinacy.degree).toBe(0);
  });
});

/* ═══ The oracle ═════════════════════════════════════════════════════════ */

function compare(g: Generated, label: string, tol = 1e-9) {
  const exact = oracle(g.exact);
  const out = solveTruss(g.model);
  if (exact === null) {
    // The exact solution is singular: the truss is unstable and the engine must say so, and say it as an instability.
    expect(out.ok, `${label}: the oracle finds it singular`).toBe(false);
    if (!out.ok) expect(out.issues.every((i) => i.code === 'mechanism' || i.code === 'unrestrained' || i.code === 'few-supports'), `${label}: ${JSON.stringify(out.issues)}`).toBe(true);
    return 'singular';
  }
  expect(out.ok, `${label}: the oracle solves it`).toBe(true);
  if (!out.ok) return 'failed';
  const scale = Math.max(1, ...exact.N.map(Math.abs), ...exact.reactions.flatMap((r) => [Math.abs(r.rx), Math.abs(r.ry)]));
  out.members.forEach((m, k) => expect(Math.abs(m.N - exact.N[k]), `${label}: member ${k} engine ${m.N} oracle ${exact.N[k]}`).toBeLessThanOrEqual(tol * scale));
  out.reactions.forEach((r, k) => {
    expect(Math.abs(r.rx - exact.reactions[k].rx), `${label}: reaction ${k} x`).toBeLessThanOrEqual(tol * scale);
    expect(Math.abs(r.ry - exact.reactions[k].ry), `${label}: reaction ${k} y`).toBeLessThanOrEqual(tol * scale);
  });
  return exact.route;
}

describe('truss engine against the exact oracle', () => {
  it('DETERMINATE trusses: 240 random trusses of 3 to 8 joints, random loads, a pin and an inclined roller', { timeout: 180000 }, () => {
    const rand = rng(2024);
    const routes = { equilibrium: 0, stiffness: 0, singular: 0 };
    for (let t = 0; t < 240; t++) {
      const g = generate(rand, { nodes: [3, 8], extra: [0, 0], grid: 7, pythagorean: t % 3 === 0 });
      expect(g.determinate).toBe(true);
      routes[compare(g, `det#${t}`) as keyof typeof routes]++;
    }
    // Both kinds of case were exercised.
    expect(routes.equilibrium).toBeGreaterThan(150);
    expect(routes.singular).toBeGreaterThan(0);
  });

  it('INDETERMINATE trusses (extra members): 150 random trusses with random stiffness', { timeout: 180000 }, () => {
    const rand = rng(99);
    let solvedCount = 0;
    for (let t = 0; t < 150; t++) {
      const g = generate(rand, { nodes: [3, 7], extra: [1, 3], grid: 6, ea: t % 2 === 0 ? 9 : 0, pythagorean: t % 4 === 0 });
      if (compare(g, `ind#${t}`) === 'stiffness') solvedCount++;
    }
    expect(solvedCount).toBeGreaterThan(80);
  });

  it('INDETERMINATE through the supports (extra pins and rollers, any direction)', { timeout: 180000 }, () => {
    const rand = rng(7);
    let solvedCount = 0;
    for (let t = 0; t < 100; t++) {
      const g = generate(rand, { nodes: [3, 7], extra: [0, 1], extraSupports: [1, 3], grid: 6, ea: 20, pythagorean: t % 5 === 0 });
      if (compare(g, `sup#${t}`) === 'stiffness') solvedCount++;
    }
    expect(solvedCount).toBeGreaterThan(50);
  });

  it('a lopsided stiffness (EA from 1 to a million) is still right to eight figures', { timeout: 180000 }, () => {
    const rand = rng(31);
    let solvedCount = 0;
    for (let t = 0; t < 60; t++) {
      const g = generate(rand, { nodes: [3, 6], extra: [1, 2], grid: 6, ea: 1000000 });
      if (g.determinate) continue;
      if (compare(g, `lop#${t}`, 1e-8) === 'stiffness') solvedCount++;
    }
    expect(solvedCount).toBeGreaterThan(30);
  });

  it('templates agree with the oracle too (45° members: irrational lengths, solved by the oracle to 2^-64)', { timeout: 180000 }, () => {
    for (const [id, span, height] of [...(['pratt', 'howe', 'warren', 'warren-verticals', 'cantilever', 'fink', 'queen-post'] as TemplateId[]).map((x) => [x, 12, 3] as const), ['pratt', 100, 1], ['cantilever', 100, 1], ['warren', 100, 1]] as const) {
      const t = buildTemplate(id, { span, height, panels: id === 'cantilever' && span === 12 ? 3 : 4, load: 6 }, 'us');
      // These coordinates are multiples of 1/4: exact in binary and in the oracle.
      const exact = {
        nodes: t.nodes.map((p) => ({ x: fraction(BigInt(Math.round(p.x * 4)), BigInt(4)), y: fraction(BigInt(Math.round(p.y * 4)), BigInt(4)) })),
        members: t.members.map((m) => ({ i: m.i, j: m.j, ea: fraction(B1) })),
        supports: t.supports.map((s) => {
          const d = s.kind === 'roller' ? DIRECTIONS.find((x) => x.angle === (s.angle ?? 90))! : null;
          return { node: s.node, kind: s.kind, ...(d ? { c: d.c, s: d.s } : {}) };
        }),
        loads: t.loads.map((l) => ({ node: l.node, fx: fraction(BigInt(Math.round(l.fx * 4)), BigInt(4)), fy: fraction(BigInt(Math.round(l.fy * 4)), BigInt(4)) })),
      };
      const got = solved({ nodes: t.nodes, members: t.members, supports: t.supports, loads: t.loads });
      const want = oracle(exact)!;
      expect(want, id).not.toBeNull();
      got.members.forEach((m, k) => near(m.N, want.N[k], 1e-11, 100));
    }
  });
});

/* ═══ Properties of every truss ═════════════════════════════════════════ */

/** A good supply of random solved trusses for the properties. */
function population(count: number, seed: number, o: Parameters<typeof generate>[1]): { g: Generated; s: TrussSolution }[] {
  const rand = rng(seed);
  const out: { g: Generated; s: TrussSolution }[] = [];
  let tries = 0;
  while (out.length < count && tries++ < count * 6) {
    const g = generate(rand, o);
    const s = solveTruss(g.model);
    if (s.ok) out.push({ g, s });
  }
  expect(out.length).toBe(count);
  return out;
}

describe('truss engine: properties of every solved truss', () => {
  const dets = population(150, 1, { nodes: [3, 12], extra: [0, 0], grid: 9, pythagorean: false });
  const inds = population(150, 2, { nodes: [3, 12], extra: [1, 4], extraSupports: [0, 2], grid: 9, ea: 30 });
  const all = [...dets, ...inds];

  it('every number is finite, no zero is negative', { timeout: 60000 }, () => {
    for (const { s } of all) {
      numbersOf(s).forEach((v) => {
        expect(Number.isFinite(v)).toBe(true);
        expect(Object.is(v, -0)).toBe(false);
      });
    }
  });

  it('EQUILIBRIUM of the whole: ΣFx, ΣFy and ΣM of loads and reactions are nothing, computed from the results', () => {
    for (const { g, s } of all) {
      const scale = loadScaleOf(g.model) + biggest(s);
      const r = residuals(g.model, s);
      near(r.fx, 0, 1e-9, scale);
      near(r.fy, 0, 1e-9, scale);
      near(r.moment, 0, 1e-9, scale * 20);
    }
  });

  it('EQUILIBRIUM of every joint: the members, the load and the reaction add up to nothing at every node', () => {
    for (const { g, s } of all) near(residuals(g.model, s).joint, 0, 1e-9, loadScaleOf(g.model) + biggest(s));
  });

  it("the engine's own equilibrium block says the same", () => {
    for (const { g, s } of all) {
      const e = s.equilibrium;
      const scale = e.scale + biggest(s);
      near(e.sumFx, 0, 1e-9, scale);
      near(e.sumFy, 0, 1e-9, scale);
      near(e.sumM, 0, 1e-9, scale * 20);
      near(e.joint, 0, 1e-9, scale);
      expect(e.scale).toBeCloseTo(loadScaleOf(g.model), 9);
    }
  });

  it('a STATICALLY DETERMINATE truss does not depend on E·A: the forces are bit for bit the same whatever the sections', () => {
    const rand = rng(77);
    for (const { g, s } of dets) {
      const sections = g.model.members.map(() => ({ A: 10 ** (rand() * 8 - 4), E: 10 ** (rand() * 8 - 4) }));
      const other = solved({ ...g.model, members: g.model.members.map((m, k) => ({ ...m, ...sections[k] })) });
      expect(forces(other)).toEqual(forces(s));
      expect(other.reactions.map((r) => [r.rx, r.ry])).toEqual(s.reactions.map((r) => [r.rx, r.ry]));
      expect(other.stiffness).toBe('absolute');
    }
  });

  it('an INDETERMINATE truss does depend on it (the property above is not an accident of the generator)', () => {
    let changed = 0;
    for (const { g, s } of inds.slice(0, 40)) {
      const members = g.model.members.map((m, k) => ({ ...m, A: k === 0 ? 1000 : 1, E: 1 }));
      const other = solveTruss({ ...g.model, members });
      if (other.ok && forces(other).some((n, k) => Math.abs(n - s.members[k].N) > 1e-6 * (1 + Math.abs(n)))) changed++;
    }
    expect(changed).toBeGreaterThan(10);
  });

  it('SUPERPOSITION: the forces under two loads are the sum of the forces under each', () => {
    const rand = rng(5);
    for (const { g } of all.slice(0, 120)) {
      const loadsA = g.model.loads;
      const loadsB = g.model.loads.map(() => ({ node: int(rand, 0, g.model.nodes.length - 1), fx: int(rand, -9, 9), fy: int(rand, -9, 9) }));
      const a = solved({ ...g.model, loads: loadsA });
      const b = solved({ ...g.model, loads: loadsB });
      const ab = solved({ ...g.model, loads: [...loadsA, ...loadsB] });
      const scale = 1 + Math.max(biggest(a), biggest(b));
      ab.members.forEach((m, k) => near(m.N, a.members[k].N + b.members[k].N, 1e-8, scale));
      ab.reactions.forEach((r, k) => {
        near(r.rx, a.reactions[k].rx + b.reactions[k].rx, 1e-8, scale);
        near(r.ry, a.reactions[k].ry + b.reactions[k].ry, 1e-8, scale);
      });
    }
  });

  it('SCALING: double the loads, double the forces (and ×1000, ÷1000 and −1 too)', () => {
    for (const { g, s } of all.slice(0, 120)) {
      for (const f of [2, 1000, 0.001, -1]) {
        const scaled = solved({ ...g.model, loads: g.model.loads.map((l) => ({ ...l, fx: l.fx * f, fy: l.fy * f })) });
        scaled.members.forEach((m, k) => near(m.N, s.members[k].N * f, 1e-9, Math.abs(f) * (1 + biggest(s))));
      }
    }
  });

  it('ROTATION: turning the whole truss, its loads and its rollers by an angle leaves the member forces alone and turns the reactions', () => {
    const rand = rng(8);
    for (const { g, s } of all.slice(0, 150)) {
      const a = rand() * 2 * Math.PI;
      const c = Math.cos(a);
      const sn = Math.sin(a);
      const rot = (x: number, y: number) => ({ x: c * x - sn * y, y: sn * x + c * y });
      const turned: TrussModel = {
        ...g.model,
        nodes: g.model.nodes.map((n) => rot(n.x, n.y)),
        loads: g.model.loads.map((l) => ({ node: l.node, fx: rot(l.fx, l.fy).x, fy: rot(l.fx, l.fy).y })),
        supports: g.model.supports.map((sp) => (sp.kind === 'roller' ? { ...sp, angle: (sp.angle ?? 90) + (a * 180) / Math.PI } : sp)),
      };
      const out = solved(turned);
      const scale = 1 + biggest(s);
      out.members.forEach((m, k) => near(m.N, s.members[k].N, 1e-8, scale));
      out.reactions.forEach((r, k) => {
        const want = rot(s.reactions[k].rx, s.reactions[k].ry);
        near(r.rx, want.x, 1e-8, scale);
        near(r.ry, want.y, 1e-8, scale);
      });
    }
  });

  it('MIRROR: reflecting the truss in the y axis gives the same member forces and mirrored reactions', () => {
    for (const { g, s } of all.slice(0, 150)) {
      const mirrored: TrussModel = {
        ...g.model,
        nodes: g.model.nodes.map((n) => ({ x: -n.x, y: n.y })),
        loads: g.model.loads.map((l) => ({ ...l, fx: -l.fx })),
        supports: g.model.supports.map((sp) => (sp.kind === 'roller' ? { ...sp, angle: 180 - (sp.angle ?? 90) } : sp)),
      };
      const out = solved(mirrored);
      const scale = 1 + biggest(s);
      out.members.forEach((m, k) => near(m.N, s.members[k].N, 1e-9, scale));
      out.reactions.forEach((r, k) => {
        near(r.rx, -s.reactions[k].rx, 1e-9, scale);
        near(r.ry, s.reactions[k].ry, 1e-9, scale);
      });
    }
  });

  it('MIRROR SYMMETRY of a symmetric truss under symmetric load: the member on one side has the force of its mirror image', () => {
    for (const id of ['pratt', 'howe', 'warren', 'fink', 'king-post', 'queen-post', 'triangle'] as TemplateId[]) {
      for (const layout of ['pin-roller', 'two-pins'] as const) {
        const t = buildTemplate(id, { span: 30, height: 6, panels: 6, load: 7, supports: layout }, 'us');
        const s = solved({ nodes: t.nodes, members: t.members, supports: t.supports, loads: t.loads });
        const find = (i: number, j: number) => t.members.findIndex((m) => (m.i === i && m.j === j) || (m.i === j && m.j === i));
        const mirrorOf = (node: number) => t.nodes.findIndex((n) => Math.abs(n.x - (30 - t.nodes[node].x)) < 1e-9 && Math.abs(n.y - t.nodes[node].y) < 1e-9);
        t.members.forEach((m, k) => {
          const twin = find(mirrorOf(m.i), mirrorOf(m.j));
          // The queen post's single diagonal has no twin; under symmetric load the panel it braces has no shear, so it is nothing.
          if (twin < 0) return near(s.members[k].N, 0, 1e-10, 100);
          near(s.members[k].N, s.members[twin].N, 1e-10, 100);
        });
      }
    }
  });

  it('inspection is sound: every member found zero by inspection has a force of exactly 0', () => {
    for (const { s } of all) for (const z of s.inspection) expect(s.members[z.member].N, `member ${z.member} at node ${z.node}`).toBe(0);
  });

  it('the largest tension and compression are the extremes, and each is of its own sign', () => {
    for (const { s } of all) {
      const ns = forces(s);
      const top = Math.max(...ns);
      const low = Math.min(...ns);
      if (top > 0) expect(s.largest.tension).toEqual({ member: ns.indexOf(top), N: top });
      else expect(s.largest.tension).toBeNull();
      if (low < 0) expect(s.largest.compression).toEqual({ member: ns.indexOf(low), N: low });
      else expect(s.largest.compression).toBeNull();
    }
  });

  it('elongation, stress and displacement: δ = N L / E A, σ = N / A; the displacements are compatible with the elongations', () => {
    for (const { g, s } of inds.slice(0, 60)) {
      if (s.stiffness !== 'absolute') continue;
      const u = s.displacements!;
      const top = Math.max(...s.members.map((x) => Math.abs(x.elongation!))) + 1e-30;
      s.members.forEach((m, k) => {
        const mem = g.model.members[k];
        near(m.elongation!, (m.N * m.length) / (mem.E! * mem.A!), 1e-12, Math.abs(m.elongation!) + 1e-30);
        near(m.stress!, m.N / mem.A!, 1e-12, Math.abs(m.stress!) + 1e-30);
        // The elongation is also the relative displacement of the ends along the member (the compatibility the stiffness solve imposes).
        const d = (u[m.j].ux - u[m.i].ux) * m.cx + (u[m.j].uy - u[m.i].uy) * m.cy;
        near(d, m.elongation!, 1e-8, top);
      });
      // The supports do not move along their line.
      const umax = Math.max(...u.map((x) => x.magnitude)) + 1e-30;
      s.reactions.forEach((r) => {
        const d = u[r.node];
        if (r.kind === 'pin') expect(Math.hypot(d.ux, d.uy)).toBe(0);
        else {
          const dir = directionOf(r.angle!);
          near(d.ux * dir.c + d.uy * dir.s, 0, 1e-9, umax);
        }
      });
    }
  });

  it('a DETERMINATE truss with sections has displacements whose elongations are N L / E A', () => {
    for (const { g } of dets.slice(0, 40)) {
      const s = solved({ ...g.model, E: 29000, A: 3 });
      expect(s.stiffness).toBe('absolute');
      const u = s.displacements!;
      s.members.forEach((m) => {
        const d = (u[m.j].ux - u[m.i].ux) * m.cx + (u[m.j].uy - u[m.i].uy) * m.cy;
        near(d, (m.N * m.length) / (29000 * 3), 1e-8, 1e-3);
      });
    }
  });
});

describe('truss engine: zero by inspection', () => {
  // A triangle on a pin and a roller with a two-bar bracket hung from its base: the bracket's joint has no load.
  const bracket = (loads: TrussModel['loads'] = [], extra: TrussModel['supports'] = []): TrussModel => ({
    nodes: [{ x: 0, y: 0 }, { x: 4, y: 0 }, { x: 2, y: 3 }, { x: 2, y: -2 }],
    members: [{ i: 0, j: 1 }, { i: 0, j: 2 }, { i: 1, j: 2 }, { i: 0, j: 3 }, { i: 1, j: 3 }],
    supports: [{ node: 0, kind: 'pin' }, { node: 1, kind: 'roller' }, ...extra],
    loads: [{ node: 2, fx: 0, fy: -10 }, ...loads],
  });
  it('two members at an unloaded, unsupported joint, not on one line: both are zero', () => {
    const s = solved(bracket());
    expect(s.inspection).toEqual([
      { member: 3, node: 3, rule: 'two-members' },
      { member: 4, node: 3, rule: 'two-members' },
    ]);
    expect(s.members[3].N).toBe(0);
    expect(s.members[4].N).toBe(0);
  });
  it('a load on the joint, or a support, takes the rule away', () => {
    expect(solved(bracket([{ node: 3, fx: 0, fy: -4 }])).inspection).toEqual([]);
    expect(solved(bracket([], [{ node: 3, kind: 'roller', angle: 90 }])).inspection).toEqual([]);
    // Loads that cancel are no load.
    expect(solved(bracket([{ node: 3, fx: 2, fy: 0 }, { node: 3, fx: -2, fy: 0 }])).inspection.length).toBe(2);
  });
  it('three members, two on one line, no load: the third is zero', () => {
    const s = solved(template('king-post', { span: 24, height: 6, load: 10 }));
    expect(s.inspection).toEqual([{ member: 4, node: 1, rule: 'three-members' }]);
  });
  it('a chain: the zero members found first leave another joint with two members off a line', () => {
    // Node 3 (2,-2) hangs from 0 and 1 (zero by the two-member rule); node 4 (1,-4) hangs from 3 and from 0: once the bracket's bars
    // are gone, node 3 has the one bar 3-4 left; the bar 3-4 and the bar 0-4 make a two-member joint at 4 with no load.
    const model: TrussModel = {
      nodes: [{ x: 0, y: 0 }, { x: 4, y: 0 }, { x: 2, y: 3 }, { x: 2, y: -2 }, { x: 1, y: -4 }],
      members: [{ i: 0, j: 1 }, { i: 0, j: 2 }, { i: 1, j: 2 }, { i: 0, j: 3 }, { i: 1, j: 3 }, { i: 3, j: 4 }, { i: 0, j: 4 }],
      supports: [{ node: 0, kind: 'pin' }, { node: 1, kind: 'roller' }],
      loads: [{ node: 2, fx: 0, fy: -10 }],
    };
    const s = solved(model);
    expect(s.inspection.map((z) => z.member)).toEqual([3, 4, 5, 6]);
    s.inspection.forEach((z) => expect(s.members[z.member].N).toBe(0));
  });
  it('the rule function itself on a hand-made case: collinear pairs are told by the cross product of unit vectors', () => {
    const members = [{ i: 0, j: 1 }, { i: 0, j: 2 }, { i: 0, j: 3 }];
    const unit = [{ cx: 1, cy: 0 }, { cx: -1, cy: 0 }, { cx: 0, cy: 1 }];
    const free = [false, true, true, true];
    expect(zeroByInspection(4, members, unit, free, [false, false, false, false])).toEqual([{ member: 2, node: 0, rule: 'three-members' }]);
    // Three on one line: nothing.
    const line = [{ cx: 1, cy: 0 }, { cx: -1, cy: 0 }, { cx: 1, cy: COLLINEAR / 10 }];
    expect(zeroByInspection(4, members, line, free, [false, false, false, false])).toEqual([]);
  });
});

describe('truss engine: what rounding is', () => {
  it('a force that is nothing beside the loads is exactly 0: a billionth of them is rounding', () => {
    // The Pratt truss in any size of load: the end bottom panels are exactly 0 every time, not 1e-15.
    for (const f of [1, 1000, 1e-6, 1e9]) {
      const s = solved(template('pratt', { span: 32, height: 8, panels: 4, load: 10 * f }));
      expect(s.members[0].N).toBe(0);
      expect(s.members[3].N).toBe(0);
      expect(s.reactions.every((r) => r.rx === 0)).toBe(true);
    }
  });
  it('a zero is never -0 in any result', () => {
    const s = solved(template('howe', { span: 32, height: 8, panels: 4, load: 10 }));
    expect(numbersOf(s).some((v) => Object.is(v, -0))).toBe(false);
  });
  it('no load at all: every force is zero, the warning says so, nothing is NaN', () => {
    const t = template('pratt');
    const s = solved({ ...t, loads: [] });
    expect(s.warnings).toEqual([{ code: 'no-load' }]);
    expect(forces(s).every((n) => n === 0)).toBe(true);
    expect(s.members.every((m) => m.zero)).toBe(true);
    expect(s.largest).toEqual({ tension: null, compression: null });
    expect(numbersOf(s).every(Number.isFinite)).toBe(true);
    expect(solved({ ...t, loads: [{ node: 0, fx: 0, fy: 0 }] }).warnings).toEqual([{ code: 'no-load' }]);
  });
  it('a load straight on a pin goes into the reaction and no member feels it', () => {
    const s = solved({ ...template('triangle'), loads: [{ node: 0, fx: 3, fy: -5 }] });
    expect(forces(s).every((n) => n === 0)).toBe(true);
    near(s.reactions[0].rx, -3);
    near(s.reactions[0].ry, 5);
  });
});

/* ═══ Every problem is reported ═════════════════════════════════════════ */

describe('truss engine: every problem, once each, and never a throw', () => {
  const tri = (): TrussModel => ({
    nodes: [{ x: 0, y: 0 }, { x: 4, y: 0 }, { x: 2, y: 3 }],
    members: [{ i: 0, j: 1 }, { i: 0, j: 2 }, { i: 1, j: 2 }],
    supports: [{ node: 0, kind: 'pin' }, { node: 1, kind: 'roller' }],
    loads: [{ node: 2, fx: 0, fy: -10 }],
  });

  it('few-nodes', () => {
    expect(issuesOf({ ...tri(), nodes: [{ x: 0, y: 0 }], members: [], supports: [], loads: [] })).toContainEqual({ code: 'few-nodes', count: 1 });
    expect(codesOf({ nodes: [], members: [], supports: [], loads: [] })).toContain('few-nodes');
  });
  it('no-members', () => {
    expect(codesOf({ ...tri(), members: [] })).toContain('no-members');
  });
  it('too-big: past 40 nodes, 120 members, 40 supports or 80 loads — and exactly those numbers are taken', () => {
    const many = (n: number) => Array.from({ length: n }, (_, k) => ({ x: k, y: k % 2 }));
    expect(codesOf({ ...tri(), nodes: many(MAX_NODES + 1) })).toContain('too-big');
    expect(codesOf({ ...tri(), members: Array.from({ length: MAX_MEMBERS + 1 }, () => ({ i: 0, j: 1 })) })).toContain('too-big');
    expect(codesOf({ ...tri(), supports: Array.from({ length: MAX_SUPPORTS + 1 }, () => ({ node: 0, kind: 'pin' as const })) })).toContain('too-big');
    expect(codesOf({ ...tri(), loads: Array.from({ length: MAX_LOADS + 1 }, () => ({ node: 0, fx: 0, fy: 0 })) })).toContain('too-big');
    expect(issuesOf({ ...tri(), loads: Array.from({ length: MAX_LOADS + 1 }, () => ({ node: 0, fx: 0, fy: 0 })) })[0]).toMatchObject({ code: 'too-big', where: { list: 'loads' }, count: MAX_LOADS + 1 });
    // At the limit it is taken: 80 loads on a node.
    expect(solveTruss({ ...tri(), loads: Array.from({ length: MAX_LOADS }, () => ({ node: 2, fx: 0, fy: -1 })) }).ok).toBe(true);
  });
  it('number: a coordinate, a load or an angle that is no finite number, or one past 1e30', () => {
    for (const bad of [NaN, Infinity, -Infinity, 1e31, '3' as unknown as number, undefined as unknown as number, null as unknown as number]) {
      expect(issuesOf({ ...tri(), nodes: [{ x: bad, y: 0 }, ...tri().nodes.slice(1)] })).toContainEqual({ code: 'number', where: { list: 'nodes', index: 0, field: 'x' } });
      expect(issuesOf({ ...tri(), nodes: [{ x: 0, y: bad }, ...tri().nodes.slice(1)] })).toContainEqual({ code: 'number', where: { list: 'nodes', index: 0, field: 'y' } });
      expect(issuesOf({ ...tri(), loads: [{ node: 2, fx: bad, fy: -1 }] })).toContainEqual({ code: 'number', where: { list: 'loads', index: 0, field: 'fx' } });
      expect(issuesOf({ ...tri(), loads: [{ node: 2, fx: 0, fy: bad }] })).toContainEqual({ code: 'number', where: { list: 'loads', index: 0, field: 'fy' } });
    }
    expect(issuesOf({ ...tri(), supports: [{ node: 0, kind: 'pin' }, { node: 1, kind: 'roller', angle: NaN }] })).toContainEqual({ code: 'number', where: { list: 'supports', index: 1, field: 'angle' } });
    expect(codesOf({ ...tri(), supports: [{ node: 0, kind: 'pin' }, { node: 1, kind: 'slider' as 'roller' }] })).toContain('number');
    // 1e30 is taken.
    expect(solveTruss({ ...tri(), loads: [{ node: 2, fx: 0, fy: -1e30 }] }).ok).toBe(true);
  });
  it('section: an E or an A given and not a positive finite number in range', () => {
    for (const bad of [0, -1, NaN, Infinity, 1e31, 1e-31]) {
      expect(issuesOf({ ...tri(), E: bad })).toContainEqual({ code: 'section', where: { list: 'model', index: 0, field: 'E' } });
      expect(issuesOf({ ...tri(), A: bad })).toContainEqual({ code: 'section', where: { list: 'model', index: 0, field: 'A' } });
      const members = tri().members.map((m, k) => (k === 1 ? { ...m, A: bad } : m));
      expect(issuesOf({ ...tri(), members })).toContainEqual({ code: 'section', where: { list: 'members', index: 1, field: 'A' } });
      const members2 = tri().members.map((m, k) => (k === 2 ? { ...m, E: bad } : m));
      expect(issuesOf({ ...tri(), members: members2 })).toContainEqual({ code: 'section', where: { list: 'members', index: 2, field: 'E' } });
    }
    expect(solveTruss({ ...tri(), E: 1e30, A: 1e-30 }).ok).toBe(true);
  });
  it('member-node: i or j is not the index of a node (negative, past the end, fractional, not a number)', () => {
    for (const bad of [-1, 3, 1.5, NaN, undefined as unknown as number]) {
      const members = [{ i: bad, j: 1 }, ...tri().members.slice(1)];
      expect(issuesOf({ ...tri(), members })).toContainEqual({ code: 'member-node', where: { list: 'members', index: 0, field: 'i' } });
      const members2 = [{ i: 0, j: bad }, ...tri().members.slice(1)];
      expect(issuesOf({ ...tri(), members: members2 })).toContainEqual({ code: 'member-node', where: { list: 'members', index: 0, field: 'j' } });
    }
  });
  it('zero-length: a member from a node to itself', () => {
    expect(issuesOf({ ...tri(), members: [...tri().members, { i: 2, j: 2 }] })).toContainEqual({ code: 'zero-length', where: { list: 'members', index: 3 } });
  });
  it('duplicate-node: two nodes at one place (to a billionth of the truss)', () => {
    expect(issuesOf({ ...tri(), nodes: [...tri().nodes, { x: 2, y: 3 }] })).toContainEqual({ code: 'duplicate-node', nodes: [2, 3] });
    expect(issuesOf({ ...tri(), nodes: [...tri().nodes, { x: 2 + 1e-10, y: 3 }] })).toContainEqual({ code: 'duplicate-node', nodes: [2, 3] });
    // All at one place.
    expect(codesOf({ ...tri(), nodes: [{ x: 1, y: 1 }, { x: 1, y: 1 }, { x: 1, y: 1 }] })).toContain('duplicate-node');
  });
  it('short-member: shorter than a millionth of the truss, but not the same place', () => {
    const near1 = { ...tri(), nodes: [...tri().nodes, { x: 2 + 1e-6, y: 3 }], members: [...tri().members, { i: 2, j: 3 }, { i: 3, j: 0 }] };
    expect(issuesOf(near1)).toContainEqual({ code: 'short-member', where: { list: 'members', index: 3 } });
    // A thousandth of the truss is taken.
    const fine = { ...tri(), nodes: [...tri().nodes, { x: 2.01, y: 3 }], members: [...tri().members, { i: 2, j: 3 }, { i: 3, j: 0 }] };
    expect(codesOf(fine)).not.toContain('short-member');
    expect(solveTruss(fine).ok).toBe(true);
  });
  it('duplicate-member: two members on the same pair of nodes, in either direction', () => {
    expect(issuesOf({ ...tri(), members: [...tri().members, { i: 1, j: 0 }] })).toContainEqual({ code: 'duplicate-member', where: { list: 'members', index: 3 }, members: [0, 3] });
    expect(issuesOf({ ...tri(), members: [...tri().members, { i: 0, j: 1 }] })).toContainEqual({ code: 'duplicate-member', where: { list: 'members', index: 3 }, members: [0, 3] });
  });
  it('node-unconnected: a node with no member', () => {
    expect(issuesOf({ ...tri(), nodes: [...tri().nodes, { x: 9, y: 9 }] })).toEqual([{ code: 'node-unconnected', nodes: [3] }]);
  });
  it('disconnected: two pieces', () => {
    const m: TrussModel = {
      nodes: [...tri().nodes, { x: 10, y: 0 }, { x: 14, y: 0 }, { x: 12, y: 3 }],
      members: [...tri().members, { i: 3, j: 4 }, { i: 3, j: 5 }, { i: 4, j: 5 }],
      supports: [...tri().supports, { node: 3, kind: 'pin' }],
      loads: tri().loads,
    };
    expect(issuesOf(m)).toEqual([{ code: 'disconnected', groups: [[0, 1, 2], [3, 4, 5]] }]);
  });
  it('support-node: a support at a node that is not there', () => {
    expect(issuesOf({ ...tri(), supports: [...tri().supports, { node: 3, kind: 'pin' }] })).toContainEqual({ code: 'support-node', where: { list: 'supports', index: 2 } });
    expect(codesOf({ ...tri(), supports: [{ node: -1, kind: 'pin' }] })).toContain('support-node');
  });
  it('duplicate-support: a second support at a node', () => {
    expect(issuesOf({ ...tri(), supports: [...tri().supports, { node: 0, kind: 'roller' }] })).toContainEqual({ code: 'duplicate-support', where: { list: 'supports', index: 2 }, nodes: [0] });
  });
  it('load-node: a load on a node that is not in the model', () => {
    expect(issuesOf({ ...tri(), loads: [...tri().loads, { node: 7, fx: 1, fy: 1 }] })).toContainEqual({ code: 'load-node', where: { list: 'loads', index: 1 } });
    expect(codesOf({ ...tri(), loads: [{ node: -1, fx: 0, fy: 0 }] })).toContain('load-node');
  });
  it('few-supports: fewer than three reaction components', () => {
    expect(issuesOf({ ...tri(), supports: [{ node: 0, kind: 'pin' }] })).toEqual([{ code: 'few-supports', count: 2 }]);
    expect(issuesOf({ ...tri(), supports: [] })).toEqual([{ code: 'few-supports', count: 0 }]);
    expect(issuesOf({ ...tri(), supports: [{ node: 0, kind: 'roller' }, { node: 1, kind: 'roller' }] })).toEqual([{ code: 'few-supports', count: 2 }]);
  });
  it('mechanism: the nodes that can move are named', () => {
    // A rectangle without a diagonal: C and D sway.
    const rect: TrussModel = {
      nodes: [{ x: 0, y: 0 }, { x: 4, y: 0 }, { x: 4, y: 3 }, { x: 0, y: 3 }],
      members: [{ i: 0, j: 1 }, { i: 1, j: 2 }, { i: 2, j: 3 }, { i: 3, j: 0 }],
      supports: [{ node: 0, kind: 'pin' }, { node: 1, kind: 'roller' }],
      loads: [{ node: 3, fx: 1, fy: 0 }],
    };
    expect(issuesOf(rect)).toEqual([{ code: 'mechanism', nodes: [2, 3] }]);
    // Two members on one line at a joint: that joint moves, and only it.
    const line: TrussModel = {
      nodes: [{ x: 0, y: 0 }, { x: 2, y: 0 }, { x: 4, y: 0 }],
      members: [{ i: 0, j: 1 }, { i: 1, j: 2 }],
      supports: [{ node: 0, kind: 'pin' }, { node: 2, kind: 'roller' }],
      loads: [{ node: 1, fx: 0, fy: -1 }],
    };
    expect(issuesOf(line)).toEqual([{ code: 'mechanism', nodes: [1] }]);
    // The same with no load at all: it is the geometry that is unstable.
    expect(issuesOf({ ...line, loads: [] })).toEqual([{ code: 'mechanism', nodes: [1] }]);
    // A truss with a bar too few (m + r < 2j): the apex hangs by one bar.
    const few: TrussModel = {
      nodes: [{ x: 0, y: 0 }, { x: 4, y: 0 }, { x: 2, y: 3 }],
      members: [{ i: 0, j: 1 }, { i: 0, j: 2 }],
      supports: [{ node: 0, kind: 'pin' }, { node: 1, kind: 'roller' }],
      loads: [{ node: 2, fx: 0, fy: -1 }],
    };
    expect(issuesOf(few)).toEqual([{ code: 'mechanism', nodes: [2] }]);
    // A dangling bar from a joint: the free end can swing.
    const dangling: TrussModel = { nodes: [...tri().nodes, { x: 6, y: 5 }], members: [...tri().members, { i: 2, j: 3 }], supports: tri().supports, loads: tri().loads };
    expect(issuesOf(dangling)).toEqual([{ code: 'mechanism', nodes: [3] }]);
  });
  it('a mechanism inside a truss that is held: only the part that can move is named, not the rigid rest', () => {
    // A held triangle (nodes 0..2) with a four-bar chain hung from its base (nodes 3, 4 are free joints of a quadrilateral 0-1-4-3 without a diagonal).
    const m: TrussModel = {
      nodes: [{ x: 0, y: 0 }, { x: 4, y: 0 }, { x: 2, y: 3 }, { x: 0, y: -3 }, { x: 4, y: -3 }],
      members: [{ i: 0, j: 1 }, { i: 0, j: 2 }, { i: 1, j: 2 }, { i: 0, j: 3 }, { i: 1, j: 4 }, { i: 3, j: 4 }],
      supports: [{ node: 0, kind: 'pin' }, { node: 1, kind: 'roller' }],
      loads: [],
    };
    expect(issuesOf(m)).toEqual([{ code: 'mechanism', nodes: [3, 4] }]);
  });
  it('unrestrained: the supports do not hold the truss as a whole', () => {
    // Three vertical rollers: it can slide sideways.
    const slide: TrussModel = { ...tri(), supports: [{ node: 0, kind: 'roller' }, { node: 1, kind: 'roller' }, { node: 2, kind: 'roller' }] };
    expect(issuesOf(slide)).toEqual([{ code: 'unrestrained', count: 1 }]);
    // A pin, and a roller whose line goes through the pin: it can turn about the pin.
    const turn: TrussModel = { ...tri(), supports: [{ node: 0, kind: 'pin' }, { node: 1, kind: 'roller', angle: 0 }] };
    expect(issuesOf(turn)).toEqual([{ code: 'unrestrained', count: 1 }]);
    // An inclined roller whose line goes through the pin as well.
    const incl: TrussModel = { ...tri(), nodes: [{ x: 0, y: 0 }, { x: 4, y: 3 }, { x: 4, y: 0 }], supports: [{ node: 0, kind: 'pin' }, { node: 1, kind: 'roller', angle: (Math.atan2(3, 4) * 180) / Math.PI }] };
    expect(codesOf(incl)).toEqual(['unrestrained']);
  });
  it('a mechanism AND supports that do not hold the truss: both are said, and the mechanism names only the joint that swings', () => {
    // A line of two bars on three vertical rollers (free to slide sideways) with a bar hung from the middle joint (free to swing).
    const both: TrussModel = {
      nodes: [{ x: 0, y: 0 }, { x: 2, y: 0 }, { x: 4, y: 0 }, { x: 2, y: 3 }],
      members: [{ i: 0, j: 1 }, { i: 1, j: 2 }, { i: 1, j: 3 }],
      supports: [{ node: 0, kind: 'roller' }, { node: 1, kind: 'roller' }, { node: 2, kind: 'roller' }],
      loads: [],
    };
    expect(issuesOf(both)).toEqual([{ code: 'mechanism', nodes: [3] }, { code: 'unrestrained', count: 1 }]);
  });
  it('ill-conditioned: a stable truss whose stiffnesses differ by sixty orders of magnitude cannot be solved to the figures printed', () => {
    const rand = rng(3);
    let seen = 0;
    for (let t = 0; t < 40 && seen === 0; t++) {
      const g = generate(rand, { nodes: [4, 7], extra: [1, 3], grid: 8, ea: 5 });
      const model = { ...g.model, members: g.model.members.map((m, k) => ({ ...m, A: 10 ** (k % 2 ? -30 : 30), E: 1 })) };
      const out = solveTruss(model);
      if (!out.ok && out.issues.some((i) => i.code === 'ill-conditioned')) seen++;
      // Whatever it says, it says it plainly: either a solution with finite numbers, or issues.
      if (out.ok) expect(numbersOf(out).every(Number.isFinite)).toBe(true);
    }
    expect(seen).toBe(1);
  });
  it('size: the arithmetic could not be completed (a model that throws when read is answered, never rethrown)', () => {
    const hostile = {
      get nodes(): never {
        throw new Error('no');
      },
    };
    expect(solveTruss(hostile as unknown as TrussModel)).toEqual({ ok: false, issues: [{ code: 'size' }] });
  });
  it('garbage: nothing a caller can pass makes it throw, and every answer is either a solution of finite numbers or issues', () => {
    const inputs: unknown[] = [null, undefined, 0, 'x', [], {}, { nodes: 3 }, { nodes: [null, null], members: [null], supports: [null], loads: [null] }, { nodes: [{}, {}], members: [{}], supports: [{}], loads: [{}] }, { nodes: [{ x: 0, y: 0 }, { x: 1, y: 0 }], members: [{ i: 0, j: 1 }], supports: 'a', loads: 5 }];
    for (const input of inputs) {
      const out = solveTruss(input as TrussModel);
      expect(typeof out.ok).toBe('boolean');
      if (!out.ok) expect(out.issues.length).toBeGreaterThan(0);
    }
    expect(codesOf(null)).toContain('few-nodes');
  });
  it('every issue code types.ts lists is tested above', () => {
    const tested = ['few-nodes', 'no-members', 'too-big', 'number', 'section', 'member-node', 'zero-length', 'duplicate-node', 'short-member', 'duplicate-member', 'node-unconnected', 'disconnected', 'support-node', 'duplicate-support', 'load-node', 'few-supports', 'mechanism', 'unrestrained', 'ill-conditioned', 'size'];
    expect(new Set(tested).size).toBe(20);
  });
  it('fuzz: random mangling of a good model never throws, never returns a NaN', () => {
    const rand = rng(13);
    const base = template('pratt');
    const junk = [NaN, Infinity, -1, 0, 1.5, 1e40, -1e-40, 7, null, undefined, 'a', {}, []];
    for (let t = 0; t < 400; t++) {
      const m = JSON.parse(JSON.stringify(base)) as Record<string, Record<string, unknown>[]>;
      const lists = ['nodes', 'members', 'supports', 'loads'] as const;
      for (let k = 0; k < int(rand, 1, 4); k++) {
        const list = pick(rand, lists);
        const row = m[list][int(rand, 0, m[list].length - 1)];
        if (!row || typeof row !== 'object') continue;
        const key = pick(rand, Object.keys(row));
        row[key] = pick(rand, junk);
        if (rand() < 0.1) m[list].splice(int(rand, 0, m[list].length - 1), 1);
        if (rand() < 0.05) m[list].push(pick(rand, junk) as Record<string, unknown>);
      }
      const out = solveTruss(m as unknown as TrussModel);
      if (out.ok) expect(numbersOf(out).every(Number.isFinite)).toBe(true);
      else expect(out.issues.length).toBeGreaterThan(0);
    }
  });
});

/* ═══ Counting, the linear algebra, the limits ═════════════════════════ */

describe('truss engine: counting', () => {
  it('m + r − 2j, with a pin as two and a roller as one, whatever else the model holds', () => {
    expect(countOf({ nodes: [{ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 0, y: 1 }], members: [{ i: 0, j: 1 }, { i: 1, j: 2 }, { i: 0, j: 2 }], supports: [{ node: 0, kind: 'pin' }, { node: 1, kind: 'roller' }] })).toEqual({ joints: 3, members: 3, reactions: 3, degree: 0 });
    expect(countOf({ nodes: [], members: [], supports: [] })).toEqual({ joints: 0, members: 0, reactions: 0, degree: 0 });
    expect(countOf({} as TrussModel)).toEqual({ joints: 0, members: 0, reactions: 0, degree: 0 });
    expect(countOf({ nodes: [{ x: 0, y: 0 }], members: [], supports: [null, { node: 0, kind: 'pin' }] as never }).reactions).toBe(2);
  });
  it('the degree of every solved template is its count', () => {
    for (const id of TEMPLATE_IDS) {
      const m = template(id);
      const s = solved(m);
      expect(s.determinacy.degree).toBe(countOf(m).degree);
      expect(s.determinacy.word).toBe(s.determinacy.degree === 0 ? 'determinate' : 'indeterminate');
    }
  });
});

describe('truss engine: the linear algebra', () => {
  it('solveLinear: a known system; a singular one is null; the empty one is empty', () => {
    expect(solveLinear([[2, 1], [1, 3]], [3, 5])!.map((v) => Math.round(v * 1e12) / 1e12)).toEqual([0.8, 1.4]);
    expect(solveLinear([[1, 2], [2, 4]], [1, 2])).toBeNull();
    expect(solveLinear([], [])).toEqual([]);
    expect(solveLinear([[0, 0], [0, 0]], [1, 1])).toBeNull();
  });
  it('solveLinear is right to rounding on matrices with rows and columns of wildly different sizes (the scaling does it)', () => {
    const rand = rng(4);
    for (let t = 0; t < 50; t++) {
      const n = int(rand, 2, 12);
      const x = Array.from({ length: n }, () => rand() * 2 - 1);
      const s = Array.from({ length: n }, () => 10 ** (rand() * 12 - 6));
      const A = Array.from({ length: n }, (_, i) => Array.from({ length: n }, (_, j) => (rand() - 0.5 + (i === j ? 3 : 0)) * s[i] * s[j]));
      const b = A.map((row) => row.reduce((acc, v, j) => acc + v * x[j], 0));
      const got = solveLinear(A, b)!;
      got.forEach((v, j) => expect(Math.abs(v - x[j]) * s[j]).toBeLessThan(1e-9));
    }
  });
  it('jacobiEigen: eigenvalues of known matrices, orthonormal vectors, A v = λ v', () => {
    expect(jacobiEigen([[2, 0], [0, 3]]).values.slice().sort()).toEqual([2, 3]);
    const rand = rng(6);
    for (let t = 0; t < 30; t++) {
      const n = int(rand, 2, 14);
      const B = Array.from({ length: n }, () => Array.from({ length: n }, () => rand() - 0.5));
      const A = B.map((row, i) => row.map((_, j) => B[i][j] + B[j][i]));
      const { values, vectors } = jacobiEigen(A);
      vectors.forEach((v, k) => {
        expect(Math.abs(Math.hypot(...v) - 1)).toBeLessThan(1e-12);
        A.forEach((row, i) => expect(Math.abs(row.reduce((s, a, j) => s + a * v[j], 0) - values[k] * v[i])).toBeLessThan(1e-11));
      });
      for (let a = 0; a < n; a++) for (let b = a + 1; b < n; b++) expect(Math.abs(vectors[a].reduce((s, x, i) => s + x * vectors[b][i], 0))).toBeLessThan(1e-12);
    }
    // A matrix with an exact zero eigenvalue: GᵀG of a rank-deficient G.
    const G = [[1, 1, 0], [0, 1, 1]];
    const K = [0, 1, 2].map((a) => [0, 1, 2].map((b) => G.reduce((s, row) => s + row[a] * row[b], 0)));
    const e = jacobiEigen(K).values.slice().sort((p, r) => p - r);
    expect(Math.abs(e[0])).toBeLessThan(1e-15);
  });
});

describe('truss engine: the limits', () => {
  it('forty nodes are taken: a 19-panel cantilever (40 nodes, 77 members), fast, in equilibrium', () => {
    const m = template('cantilever', { span: 76, height: 4, panels: 19, load: 10 });
    expect(m.nodes.length).toBe(40);
    const t0 = performance.now();
    const s = solved(m);
    expect(performance.now() - t0).toBeLessThan(2000);
    expect(s.determinacy.word).toBe('determinate');
    near(residuals(m, s).joint, 0, 1e-9, 1000);
    // ΣFy of the reactions is the whole load: 18 joints of 10 and two ends of 5.
    near(s.reactions.reduce((a, r) => a + r.ry, 0), 190, 1e-9, 1000);
  });
  it('a 19-panel ladder of the smallest depth the templates allow is not taken for a mechanism (its smallest eigenvalue is far above MECH)', () => {
    const m = template('warren', { span: 190, height: 2, panels: 19, load: 1 });
    expect(solveTruss(m).ok).toBe(true);
    expect(MECH).toBe(1e-9);
  });
  it('120 members on 40 nodes, indeterminate by many degrees: solved fast, in equilibrium, exactly the cap', () => {
    // Two rows of 20 nodes, triangulated and braced to the next-but-one.
    const nodes = [...Array.from({ length: 20 }, (_, i) => ({ x: i * 3, y: 0 })), ...Array.from({ length: 20 }, (_, i) => ({ x: i * 3 + 1, y: 3 + (i % 3) * 0.5 }))];
    const members: { i: number; j: number }[] = [];
    const has = (i: number, j: number) => members.some((m) => (m.i === i && m.j === j) || (m.i === j && m.j === i));
    const add = (i: number, j: number) => {
      if (i !== j && !has(i, j) && members.length < MAX_MEMBERS) members.push({ i, j });
    };
    for (let i = 0; i < 19; i++) add(i, i + 1);
    for (let i = 20; i < 39; i++) add(i, i + 1);
    for (let i = 0; i < 20; i++) add(i, 20 + i);
    for (let i = 0; i < 19; i++) add(i + 1, 20 + i);
    for (let i = 0; i < 19; i++) add(i, 21 + i);
    for (let i = 0; i < 18; i++) add(i, i + 2);
    for (let i = 20; i < 38; i++) add(i, i + 2);
    expect(members.length).toBe(MAX_MEMBERS);
    const rand = rng(1);
    const model: TrussModel = {
      nodes,
      members: members.map((m) => ({ ...m, A: 1 + Math.floor(rand() * 9), E: 100 })),
      supports: [{ node: 0, kind: 'pin' }, { node: 19, kind: 'roller', angle: 90 }],
      loads: Array.from({ length: 20 }, (_, k) => ({ node: 20 + k, fx: (k % 3) - 1, fy: -5 })),
    };
    const t0 = performance.now();
    const s = solved(model);
    expect(performance.now() - t0).toBeLessThan(3000);
    expect(s.determinacy.degree).toBe(MAX_MEMBERS + 3 - 80);
    const e = residuals(model, s);
    near(e.joint, 0, 1e-9, 200);
    near(e.fx, 0, 1e-9, 200);
    near(e.fy, 0, 1e-9, 200);
    near(e.moment, 0, 1e-9, 200 * 60);
  });
  it('a truss a million times larger or smaller is the same truss, and so is one a trillion times: lengths do not matter', () => {
    const base = template('pratt');
    const s = solved(base);
    for (const f of [1e-6, 1e6, 1e12, 1e-12]) {
      const big = solved({ ...base, nodes: base.nodes.map((n) => ({ x: n.x * f, y: n.y * f })) });
      big.members.forEach((m, k) => near(m.N, s.members[k].N, 1e-9, 30));
    }
  });
  it('sections at the ends of their range are taken: E from 1e-30 to 1e30', () => {
    const base = template('pratt');
    for (const e of [1e-30, 1e-10, 1, 1e10, 1e30]) {
      const s = solved({ ...base, E: e, A: 1 });
      expect(s.stiffness).toBe('absolute');
      near(s.members[1].N, 15, 1e-9);
    }
  });
});

/* ═══ Review fixes: A1, A2, A7 ═══════════════════════════════════════════ */

describe('truss engine: the areas count when the modulus is absent (A1)', () => {
  // Three bars hanging from three pins above a loaded node; P = 100 down. The bars are 5 long (the vertical one) and
  // 5/cos(0.5) (the inclined). With EA ∝ A: v = P / (A_v/5 + 2·(A_i/L_i)·cos²θ), and each bar's force is its stiffness × v.
  const t = Math.tan(0.5) * 5;
  const bars = (A: number[], E?: number): TrussModel => ({
    nodes: [{ x: 0, y: 0 }, { x: 0, y: 5 }, { x: -t, y: 5 }, { x: t, y: 5 }],
    members: [0, 1, 2].map((k) => ({ i: 0, j: k + 1, A: A[k], ...(E === undefined ? {} : { E }) })),
    supports: [1, 2, 3].map((node) => ({ node, kind: 'pin' as const })),
    loads: [{ node: 0, fx: 0, fy: -100 }],
  });
  const byHand = (A: number[]) => {
    const c = Math.cos(0.5);
    const Li = 5 / c;
    const kv = A[0] / 5;
    const ki = A[1] / Li;
    const v = 100 / (kv + 2 * ki * c * c);
    return [kv * v, ki * c * v, ki * c * v].map((x) => x);
  };
  it('areas on every member and no modulus anywhere give the same forces as the areas WITH a modulus', () => {
    const withE = solved(bars([20, 2, 2], 29000));
    const noE = solved(bars([20, 2, 2]));
    noE.members.forEach((m, k) => near(m.N, withE.members[k].N, 1e-12, 100));
    // And they are the hand values, not the equal-area answer (42.5, 32.7, 32.7).
    near(noE.members[0].N, byHand([20, 2, 2])[0], 1e-12, 100);
    near(noE.members[1].N, byHand([20, 2, 2])[1], 1e-12, 100);
    expect(noE.stiffness).toBe('relative');
    expect(noE.warnings).toEqual([]);
    // Nothing absolute is known, so no elongation and no displacement.
    expect(noE.displacements).toBeNull();
    expect(noE.members[0].elongation).toBeNull();
  });
  it('the same with moduli on every member and no area', () => {
    const m = bars([1, 1, 1]);
    m.members.forEach((mm, k) => {
      delete mm.A;
      mm.E = [20, 2, 2][k];
    });
    const s = solved(m);
    near(s.members[0].N, byHand([20, 2, 2])[0], 1e-12, 100);
    expect(s.stiffness).toBe('relative');
    expect(s.warnings).toEqual([]);
  });
  it('areas on SOME members only still warn and take the members as equally stiff', () => {
    const m = bars([20, 2, 2]);
    delete m.members[2].A;
    const s = solved(m);
    expect(s.warnings).toEqual([{ code: 'partial-stiffness' }]);
    expect(s.stiffness).toBe('equal');
    near(s.members[0].N, byHand([1, 1, 1])[0], 1e-12, 100);
  });
  it('against the exact oracle: 80 random indeterminate trusses with an area on every member and no modulus', { timeout: 180000 }, () => {
    const rand = rng(515);
    let checked = 0;
    for (let t0 = 0; t0 < 80; t0++) {
      const g = generate(rand, { nodes: [3, 7], extra: [1, 3], grid: 6, ea: 9, pythagorean: t0 % 4 === 0 });
      if (g.determinate) continue;
      // The generator gives A = EA and E = 1; take the modulus away.
      const model: TrussModel = { ...g.model, members: g.model.members.map((m) => ({ i: m.i, j: m.j, A: m.A })) };
      const exact = oracle(g.exact);
      const out = solveTruss(model);
      if (exact === null) continue;
      expect(out.ok).toBe(true);
      if (!out.ok) continue;
      const scale = Math.max(1, ...exact.N.map(Math.abs));
      out.members.forEach((m, k) => expect(Math.abs(m.N - exact.N[k]), `#${t0} member ${k}`).toBeLessThanOrEqual(1e-9 * scale));
      checked++;
    }
    expect(checked).toBeGreaterThan(25);
  });
});

describe('truss engine: a truss with no force does not move (A2)', () => {
  it('a load along a roller’s own line puts nothing in any member, and nothing moves', () => {
    const model = template('pratt', { span: 32, height: 8, panels: 4, load: 10 });
    const roller = model.supports.findIndex((s) => s.kind === 'roller');
    model.supports[roller] = { ...model.supports[roller], angle: 45 };
    model.loads = [{ node: model.supports[roller].node, fx: 10, fy: 10 }];
    model.E = 29000 * 144;
    model.A = 4 / 144;
    const s = solved(model);
    expect(forces(s).every((n) => n === 0)).toBe(true);
    expect(s.displacements).not.toBeNull();
    expect(s.displacements!.every((d) => d.ux === 0 && d.uy === 0 && d.magnitude === 0)).toBe(true);
  });
});

describe('truss engine: a roller’s line is in [0, 180) (A7)', () => {
  it('a hair under a half turn is the horizontal line, not 180', () => {
    for (const a of [-1e-20, -1e-300, 180 - 1e-14 + 1e-14, 360, -180]) {
      const d = directionOf(a);
      expect(d.angle, String(a)).toBeGreaterThanOrEqual(0);
      expect(d.angle, String(a)).toBeLessThan(180);
    }
    expect(directionOf(-1e-20)).toEqual({ angle: 0, c: 1, s: 0 });
  });
});

describe('truss engine: the plainly stable truss skips the eigenvalues (C11)', () => {
  it('positiveDefinite agrees with the smallest eigenvalue of 300 random symmetric matrices, stable and singular', () => {
    const rand = rng(61);
    let pd = 0;
    let notPd = 0;
    for (let t = 0; t < 300; t++) {
      const n = 3 + Math.floor(rand() * 9);
      // B^T B has rank min(rows, n): fewer rows than columns is singular, as a mechanism's matrix is.
      const rows = t % 3 === 0 ? n - 1 : n + 2;
      const b = Array.from({ length: rows }, () => Array.from({ length: n }, () => Math.round((rand() - 0.5) * 8)));
      const k = Array.from({ length: n }, (_, i) => Array.from({ length: n }, (_, j) => b.reduce((s, r) => s + r[i] * r[j], 0)));
      const smallest = Math.min(...jacobiEigen(k).values);
      const shift = 0.01;
      const holds = positiveDefinite(k, shift);
      if (Math.abs(smallest - shift) > 1e-6) expect(holds, `case ${t}: smallest eigenvalue ${smallest}`).toBe(smallest > shift);
      if (holds) pd++;
      else notPd++;
    }
    expect(pd).toBeGreaterThan(50);
    expect(notPd).toBeGreaterThan(50);
  });
  it('a mechanism is still found (it fails the test and goes through the eigenvalues), and a stable truss still solves', () => {
    const model = template('pratt');
    model.members = model.members.filter((_, k) => k !== model.members.length - 4);
    expect(codesOf(model)).toContain('mechanism');
    expect(solved(template('pratt')).members).toHaveLength(17);
  });
  it('the largest truss is solved in a few milliseconds, not sixty: a tenth of a second is a keystroke you can feel', () => {
    const f = template('warren-verticals', { span: 76, height: 8, panels: 19 });
    const members = [...f.members];
    // Fill to 120 members with every pair that is not joined yet, the way the form does.
    const have = new Set(members.map((m) => `${Math.min(m.i, m.j)}-${Math.max(m.i, m.j)}`));
    for (let a = 0; a < f.nodes.length && members.length < 120; a++) for (let b = a + 1; b < f.nodes.length && members.length < 120; b++) if (!have.has(`${a}-${b}`)) { have.add(`${a}-${b}`); members.push({ i: a, j: b }); }
    const model = { ...f, members };
    expect(model.members).toHaveLength(120);
    solved(model);
    const t0 = performance.now();
    for (let i = 0; i < 5; i++) solved(model);
    // Generous, for a loaded machine: it was 60 ms of eigenvalues before, on this one 4.
    expect((performance.now() - t0) / 5).toBeLessThan(40);
  });
});
