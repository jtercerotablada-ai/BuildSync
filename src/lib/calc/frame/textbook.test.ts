import { afterEach, describe, expect, it, vi } from 'vitest';
import { directionOf, solveFrame } from './engine';
import { pieceAt } from './element';
import type { FrameModel, FrameSolution } from './types';

vi.setConfig({ testTimeout: 120_000 });
afterEach(() => new Promise((r) => setTimeout(r, 0)));

/**
 * TEXTBOOK CASES with answers worked by hand (the comment of each says how). Units are whatever you like: kip and ft.
 * Signs are types.ts's: reaction moment counter-clockwise; M sagging positive; N tension positive.
 */

export const model = (o: Partial<FrameModel>): FrameModel => ({ nodes: [], members: [], supports: [], loads: [], memberLoads: [], E: 1000, A: 10, I: 100, ...o });
export function ok(m: FrameModel): FrameSolution {
  const r = solveFrame(m);
  if (!r.ok) throw new Error(`not solved: ${JSON.stringify(r.issues)}`);
  return r;
}
const near = (a: number, b: number, rel = 1e-9, abs = 1e-9) => expect(Math.abs(a - b)).toBeLessThanOrEqual(abs + rel * Math.abs(b));

const beam = (L: number, supports: FrameModel['supports'], extra: Partial<FrameModel> = {}): FrameModel =>
  model({ nodes: [{ x: 0, y: 0 }, { x: L, y: 0 }], members: [{ i: 0, j: 1 }], supports, ...extra });

describe('beams', () => {
  it('propped cantilever under a UDL: R_B = 3wL/8, R_A = 5wL/8, M_A = wL²/8', () => {
    // L = 10, w = 2 kip/ft down: R_B = 7.5, R_A = 12.5, wall moment 25 kip·ft, hogging at the wall (M = −25), sagging max 9wL²/128 = 14.0625 at 3L/8 from the roller.
    const s = ok(beam(10, [{ node: 0, kind: 'fixed' }, { node: 1, kind: 'roller' }], { memberLoads: [{ kind: 'udl', member: 0, dir: 'global-y', w: -2 }] }));
    near(s.reactions[1].ry, 7.5);
    near(s.reactions[0].ry, 12.5);
    near(s.reactions[0].rm, 25); // counter-clockwise on the beam at the left wall
    near(s.members[0].start.M, -25);
    near(s.members[0].maxima.M.max.value, 9 * 2 * 100 / 128);
    near(s.members[0].maxima.M.max.x, 10 - 3.75, 1e-9);
    expect(s.determinacy).toMatchObject({ degree: 1, word: 'indeterminate' });
  });

  it('fixed-fixed beam under a UDL: M = −wL²/12 at the ends, +wL²/24 at the middle', () => {
    const s = ok(beam(12, [{ node: 0, kind: 'fixed' }, { node: 1, kind: 'fixed' }], { memberLoads: [{ kind: 'udl', member: 0, dir: 'local-y', w: -1.5 }] }));
    near(s.members[0].start.M, -1.5 * 144 / 12);
    near(s.members[0].end.M, -1.5 * 144 / 12);
    near(s.members[0].maxima.M.max.value, 1.5 * 144 / 24);
    near(s.reactions[0].ry, 9);
    near(s.reactions[0].rm, 18); // CCW at the left wall
    near(s.reactions[1].rm, -18);
    // Deflection at midspan: wL⁴/(384 EI), downward.
    const mid = pieceAt(s.members[0].pieces, 6);
    near(mid.v!, -1.5 * 12 ** 4 / (384 * 1000 * 100), 1e-9);
  });

  it('two-span continuous beam on pins under a UDL: 3wL/8, 10wL/8, 3wL/8', () => {
    const s = ok(
      model({
        nodes: [{ x: 0, y: 0 }, { x: 10, y: 0 }, { x: 20, y: 0 }],
        members: [{ i: 0, j: 1 }, { i: 1, j: 2 }],
        supports: [{ node: 0, kind: 'pin' }, { node: 1, kind: 'roller' }, { node: 2, kind: 'roller' }],
        memberLoads: [{ kind: 'udl', member: 0, dir: 'global-y', w: -2 }, { kind: 'udl', member: 1, dir: 'global-y', w: -2 }],
      }),
    );
    near(s.reactions[0].ry, 3 * 2 * 10 / 8);
    near(s.reactions[1].ry, 10 * 2 * 10 / 8);
    near(s.reactions[2].ry, 3 * 2 * 10 / 8);
    near(s.members[0].end.M, -2 * 100 / 8); // −wL²/8 over the middle support
  });

  it('cantilever with a tip load: M = −PL at the wall, tip deflection −PL³/3EI, tip rotation −PL²/2EI', () => {
    const s = ok(beam(8, [{ node: 0, kind: 'fixed' }], { loads: [{ node: 1, fx: 0, fy: -5, m: 0 }] }));
    near(s.members[0].start.M, -40);
    near(s.reactions[0].ry, 5);
    near(s.reactions[0].rm, 40);
    near(s.displacements![1].uy, -5 * 512 / (3 * 1000 * 100));
    near(s.displacements![1].rotation!, -5 * 64 / (2 * 1000 * 100));
    expect(s.determinacy).toMatchObject({ degree: 0, word: 'determinate' });
  });

  it('point load at midspan of a simple beam: M = PL/4, V = ±P/2', () => {
    const s = ok(beam(10, [{ node: 0, kind: 'pin' }, { node: 1, kind: 'roller' }], { memberLoads: [{ kind: 'point', member: 0, dir: 'global-y', a: 5, P: -8 }] }));
    near(s.members[0].maxima.M.max.value, 20);
    near(s.members[0].maxima.V.max.value, 4);
    near(s.members[0].maxima.V.min.value, -4);
    const stations = s.members[0].stations;
    expect(stations.filter((t) => t.x === 5).map((t) => t.side)).toEqual(['left', 'right']);
  });

  it('a Gerber beam (hinge in the middle of a two-span beam): statics only', () => {
    // A pin at 0, roller at 10, hinge at 15, roller at 20? Use: fixed at 0, hinge at node 1 (x = 10), roller at 20; UDL w on all.
    // Right piece (10..20): simple beam hinge–roller: V at the hinge = wL/2 = 10 (w = 2), roller R = 10. Left piece: cantilever carrying 10 more at its tip.
    const s = ok(
      model({
        nodes: [{ x: 0, y: 0 }, { x: 10, y: 0 }, { x: 20, y: 0 }],
        members: [{ i: 0, j: 1, releases: { end: true } }, { i: 1, j: 2 }],
        supports: [{ node: 0, kind: 'fixed' }, { node: 2, kind: 'roller' }],
        memberLoads: [{ kind: 'udl', member: 0, dir: 'global-y', w: -2 }, { kind: 'udl', member: 1, dir: 'global-y', w: -2 }],
      }),
    );
    near(s.reactions[1].ry, 10);
    near(s.reactions[0].ry, 30);
    near(s.reactions[0].rm, 2 * 100 / 2 + 10 * 10); // wL²/2 + 10·10 = 200, counter-clockwise
    expect(Math.abs(s.members[0].end.M)).toBeLessThan(1e-9); // M = 0 at the hinge
    expect(s.members[0].forces[5]).toBe(0);
    expect(s.determinacy).toMatchObject({ degree: 0, word: 'determinate' });
  });

  it('inclined roller at 45°: the reaction acts along the roller line', () => {
    // Pin at A, roller at B whose line is at 45°; vertical load P = 8 at midspan of the 10 ft beam.
    // R_By = P/2 = 4 so R = 4/sin 45° = 5.657, R_Bx = 4; A = (−4, +4); the beam is in tension N = +4.
    const s = ok(beam(10, [{ node: 0, kind: 'pin' }, { node: 1, kind: 'roller', angle: 45 }], { memberLoads: [{ kind: 'point', member: 0, dir: 'global-y', a: 5, P: -8 }] }));
    near(s.reactions[1].rx, 4);
    near(s.reactions[1].ry, 4);
    near(s.reactions[1].along!, 4 * Math.SQRT2);
    near(s.reactions[1].across!, 0, 1e-9, 1e-9);
    near(s.reactions[0].rx, -4);
    near(s.members[0].start.N, 4);
  });
});

describe('portal frames', () => {
  const near6 = (a: number, b: number, rel = 1e-5, abs = 1e-5) => near(a, b, rel, abs);
  const portal = (h: number, L: number, base: 'fixed' | 'pin', H: number, Ib = 100, w = 0): FrameModel =>
    model({
      A: 1e9, // axially rigid, as the hand formulas assume (near6: a relative 1e-5 is what that costs)
      nodes: [{ x: 0, y: 0 }, { x: 0, y: h }, { x: L, y: h }, { x: L, y: 0 }],
      members: [{ i: 0, j: 1 }, { i: 1, j: 2, I: Ib }, { i: 2, j: 3 }],
      supports: [{ node: 0, kind: base }, { node: 3, kind: base }],
      loads: H === 0 ? [] : [{ node: 1, fx: H, fy: 0, m: 0 }],
      memberLoads: w === 0 ? [] : [{ kind: 'udl', member: 1, dir: 'global-y', w: -w }],
    });

  it('fixed-base portal, lateral H at the beam level, equal I: M_base = Hh(1+3r)/(2(1+6r)), M_top = 3rHh/(2(1+6r)), r = (Ib/L)/(Ic/h)', () => {
    // h = 10, L = 20, H = 10, equal I so r = h/L = 0.5: M_base = 100·2.5/8 = 31.25; M_top = 100·1.5/8 = 18.75; column shear H/2 = 5;
    // overturning: V·L = H·h − 2·31.25 → V = 1.875. Sway Δ = H h³ (2+3r) / (12 EI (1+6r)).
    const s = ok(portal(10, 20, 'fixed', 10));
    near6(s.reactions[0].rx, -5);
    near6(s.reactions[1].rx, -5);
    near6(s.reactions[0].ry, -1.875);
    near6(s.reactions[1].ry, 1.875);
    near6(Math.abs(s.reactions[0].rm), 31.25);
    near6(Math.abs(s.reactions[1].rm), 31.25);
    near6(Math.abs(s.members[0].end.M), 18.75);
    near6(Math.abs(s.members[1].start.M), 18.75);
    near6(s.displacements![1].ux, (10 * 1000 * 3.5) / (12 * 1000 * 100 * 4));
  });

  it('fixed-base portal with an (almost) rigid beam: both column ends carry Hh/4, sway Hh³/(24EI)', () => {
    const s = ok(portal(10, 20, 'fixed', 10, 1e9));
    near6(Math.abs(s.reactions[0].rm), 25, 1e-6);
    near6(Math.abs(s.members[0].end.M), 25, 1e-6);
    near6(s.displacements![1].ux, (10 * 1000) / (24 * 1000 * 100), 1e-6);
  });

  it('pinned-base portal: M_top = Hh/2 whatever the stiffness, V = Hh/L, sway Hh³(1+2r)/(12 EI r)', () => {
    // Each column carries H/2 with a pinned foot, so the moment at its top is (H/2)·h = 50; the beam end moment is the same.
    // r = 0.5: Δ = H h³ · 2 / (12 EI · 0.5) = H h³/(3 EI).
    const s = ok(portal(10, 20, 'pin', 10));
    near6(Math.abs(s.members[0].end.M), 50);
    near6(Math.abs(s.members[1].start.M), 50);
    near6(s.reactions[0].ry, -5);
    near6(s.reactions[1].ry, 5);
    near6(s.displacements![1].ux, (10 * 1000) / (3 * 1000 * 100));
    expect(s.determinacy).toMatchObject({ degree: 1, word: 'indeterminate' });
    const stiff = ok(portal(10, 20, 'pin', 10, 1e5));
    near6(Math.abs(stiff.members[0].end.M), 50);
  });

  it('the default case of the page: lateral 10 kip + 1.2 kip/ft on a 20 × 10 fixed-base portal (superposition of the two hand answers)', () => {
    // Gravity alone (FEM = wL²/12 = 40; carry-over factor 2/(2+r) = 0.8): beam ends −32, midspan +60 − 32 = +28, column tops 32 and bases 16;
    // vertical reactions 12 each; thrust (16+32)/10 = 4.8 kip towards the centre at each base.
    // Lateral alone: see the first test. Together: left base Rx = +4.8 − 5 = −0.2, right base −4.8 − 5 = −9.8; Ry = 12 ∓ 1.875.
    const s = ok(portal(10, 20, 'fixed', 10, 100, 1.2));
    near6(s.reactions[0].rx, -0.2);
    near6(s.reactions[1].rx, -9.8);
    near6(s.reactions[0].ry, 12 - 1.875);
    near6(s.reactions[1].ry, 12 + 1.875);
    // Moments at the beam ends: −32 + 18.75 on the left (the sway makes the left end less hogging) and −32 − 18.75 on the right.
    near6(s.members[1].start.M, -32 + 18.75);
    near6(s.members[1].end.M, -32 - 18.75);
    near6(Math.abs(s.reactions[0].rm), Math.abs(16 - 31.25), 1e-9); // 15.25 and 47.25
    near6(Math.abs(s.reactions[1].rm), 16 + 31.25, 1e-9);
  });
});

describe('statics-only frames', () => {
  it('a three-hinged frame: V = P/2, H = PL/(4f) from the crown hinge, no moment in the members', () => {
    // Pinned feet at (0,0) and (24,0), crown hinge at (12, 6) loaded with P = 20 down: V = 10; moments about the crown of the left half:
    // H·6 = 10·12 → H = 20. The two members are straight bars (M = 0), N = √(V²+H²) = 22.36 compression.
    const s = ok(
      model({
        nodes: [{ x: 0, y: 0 }, { x: 12, y: 6 }, { x: 24, y: 0 }],
        members: [{ i: 0, j: 1, releases: { end: true } }, { i: 1, j: 2, releases: { start: true } }],
        supports: [{ node: 0, kind: 'pin' }, { node: 2, kind: 'pin' }],
        loads: [{ node: 1, fx: 0, fy: -20, m: 0 }],
      }),
    );
    near(s.reactions[0].ry, 10);
    near(s.reactions[0].rx, 20);
    near(s.reactions[1].rx, -20);
    near(s.members[0].start.N, -Math.hypot(10, 20));
    expect(Math.abs(s.members[0].maxima.M.max.value)).toBeLessThan(1e-9);
    expect(s.determinacy).toMatchObject({ degree: 0, word: 'determinate', freeJoints: 1 });
    expect(s.displacements![1].rotation).toBeNull();
  });

  it('a three-hinged frame under a UDL on the horizontal projection: H = wL²/(8f)', () => {
    // w = 1.5 per horizontal foot, L = 24, f = 6: V = 18, H = 1.5·576/48 = 18; the members bend: M = ½·w·x(L/2 − x) about the chord, here the moment at the hinge is 0.
    const s = ok(
      model({
        nodes: [{ x: 0, y: 0 }, { x: 12, y: 6 }, { x: 24, y: 0 }],
        members: [{ i: 0, j: 1, releases: { end: true } }, { i: 1, j: 2, releases: { start: true } }],
        supports: [{ node: 0, kind: 'pin' }, { node: 2, kind: 'pin' }],
        memberLoads: [{ kind: 'udl-projected', member: 0, dir: 'global-y', w: -1.5 }, { kind: 'udl-projected', member: 1, dir: 'global-y', w: -1.5 }],
      }),
    );
    near(s.reactions[0].ry, 18);
    near(s.reactions[0].rx, 18);
    near(s.reactions[1].rx, -18);
    near(s.members[0].end.M, 0, 1e-9, 1e-9);
    expect(s.reactions[0].ry + s.reactions[1].ry).toBeCloseTo(36, 9);
  });

  it('forces of a determinate frame do not depend on E, A, I', () => {
    const base = beam(10, [{ node: 0, kind: 'pin' }, { node: 1, kind: 'roller' }], { memberLoads: [{ kind: 'udl', member: 0, dir: 'global-y', w: -2 }, { kind: 'point', member: 0, dir: 'local-y', a: 3, P: -4 }] });
    const a = ok(base);
    const b = ok({ ...base, E: 7, A: 1e4, I: 3e-3 });
    near(a.members[0].end.M, b.members[0].end.M, 1e-9, 1e-9);
    near(a.members[0].maxima.M.max.value, b.members[0].maxima.M.max.value, 1e-9);
    near(a.reactions[0].ry, b.reactions[0].ry, 1e-9);
    const none = ok({ ...base, E: undefined, A: undefined, I: undefined });
    expect(none.stiffness).toBe('none');
    expect(none.displacements).toBeNull();
    near(none.members[0].maxima.M.max.value, a.members[0].maxima.M.max.value, 1e-9);
    expect(none.warnings.map((w) => w.code)).toContain('no-stiffness');
  });
});

describe('temperature, settlement, springs', () => {
  it('uniform temperature on a restrained member: N = −EAαΔT', () => {
    const s = ok(beam(10, [{ node: 0, kind: 'fixed' }, { node: 1, kind: 'fixed' }], { memberLoads: [{ kind: 'temperature', member: 0, dT: 50, dTg: 0, alpha: 1e-5 }] }));
    near(s.members[0].start.N, -1000 * 10 * 1e-5 * 50);
    near(s.members[0].end.N, -5);
    near(s.reactions[0].rx, 5);
    near(s.reactions[1].rx, -5);
    expect(Math.abs(s.members[0].maxima.M.max.value)).toBeLessThan(1e-9);
  });

  it('a free member grows by αΔTL and develops no force', () => {
    const s = ok(beam(10, [{ node: 0, kind: 'pin' }, { node: 1, kind: 'roller', angle: 90 }], { memberLoads: [{ kind: 'temperature', member: 0, dT: 50, dTg: 0, alpha: 1e-5 }] }));
    near(s.displacements![1].ux, 1e-5 * 50 * 10);
    expect(Math.abs(s.members[0].start.N)).toBeLessThan(1e-9);
  });

  it('a gradient on a fixed-fixed beam: M = EIαΔTg/h (sagging when the +ȳ face is warmer)', () => {
    const m = beam(10, [{ node: 0, kind: 'fixed' }, { node: 1, kind: 'fixed' }], { memberLoads: [{ kind: 'temperature', member: 0, dT: 0, dTg: 20, alpha: 1e-5 }] });
    m.members[0].h = 1;
    const s = ok(m);
    near(s.members[0].start.M, 1000 * 100 * 1e-5 * 20 / 1);
    near(s.members[0].end.M, 20);
    expect(Math.abs(s.reactions[0].ry)).toBeLessThan(1e-9);
  });

  it('a free beam with a gradient curves to κ = αΔTg/h (deflection αΔTgL²/8h at midspan, hogging for a warm +ȳ face)', () => {
    const m = beam(10, [{ node: 0, kind: 'pin' }, { node: 1, kind: 'roller' }], { memberLoads: [{ kind: 'temperature', member: 0, dT: 0, dTg: 20, alpha: 1e-5 }] });
    m.members[0].h = 1;
    const s = ok(m);
    near(pieceAt(s.members[0].pieces, 5).v!, 1e-5 * 20 * 100 / 8 / 1);
    expect(Math.abs(s.members[0].start.M)).toBeLessThan(1e-9);
  });

  it('a support settlement of a fixed-fixed beam: M = 6EIΔ/L², V = 12EIΔ/L³', () => {
    const s = ok(beam(10, [{ node: 0, kind: 'fixed' }, { node: 1, kind: 'fixed', dy: -0.1 }]));
    near(s.reactions[0].ry, 12 * 1000 * 100 * 0.1 / 1000);
    near(s.reactions[1].ry, -12 * 1000 * 100 * 0.1 / 1000);
    near(s.reactions[0].rm, 6 * 1000 * 100 * 0.1 / 100);
    near(s.reactions[1].rm, 6 * 1000 * 100 * 0.1 / 100);
    near(s.displacements![1].uy, -0.1);
    expect(s.warnings.map((w) => w.code)).not.toContain('no-load');
  });

  it('a settlement of a determinate frame moves it as a rigid body: no force', () => {
    const s = ok(beam(10, [{ node: 0, kind: 'pin' }, { node: 1, kind: 'roller', dy: -0.2 }]));
    expect(Math.abs(s.members[0].start.M)).toBeLessThan(1e-12);
    near(s.displacements![1].uy, -0.2);
    near(s.displacements![0].rotation!, -0.02, 1e-9, 1e-12);
  });

  it('a spring support: a simple beam with the right support a spring takes P/2 and sinks P/(2k)', () => {
    const s = ok(beam(10, [{ node: 0, kind: 'pin' }, { node: 1, kind: 'spring', ky: 50, kx: 1e6 }], { memberLoads: [{ kind: 'point', member: 0, dir: 'global-y', a: 5, P: -8 }] }));
    near(s.reactions[1].ry, 4);
    near(s.displacements![1].uy, -4 / 50);
    near(s.reactions[1].spring!.fy, 4);
  });

  it('a rotational spring at the foot of a (nearly) rigid column: θ = Hh/kr', () => {
    const s = ok(
      model({
        nodes: [{ x: 0, y: 0 }, { x: 0, y: 10 }],
        members: [{ i: 0, j: 1, I: 1e6 }],
        supports: [{ node: 0, kind: 'pin', kr: 500 }, { node: 1, kind: 'roller', angle: 90 }],
        loads: [{ node: 1, fx: 4, fy: 0, m: 0 }],
      }),
    );
    // The roller at the top holds it vertically only, so the column turns about its spring: M at the foot = k θ and statics gives Hh/ ... the pin and the roller leave a rigid rotation θ with kθ = H·h.
    near(s.reactions[0].rm, 40, 1e-9);
    near(s.displacements![0].rotation!, -40 / 500, 1e-6);
  });
});

describe('diagrams', () => {
  it('V = 0 at the moment extreme, dM/dx = V, dV/dx = q along a loaded member', () => {
    const s = ok(beam(10, [{ node: 0, kind: 'pin' }, { node: 1, kind: 'roller' }], { memberLoads: [{ kind: 'trapezoid', member: 0, dir: 'global-y', a: 2, b: 8, w1: -1, w2: -4 }] }));
    const m = s.members[0];
    const zero = m.stations.find((t) => t.kind === 'zero-shear')!;
    expect(zero).toBeDefined();
    near(zero.V, 0, 1e-9, 1e-9);
    near(zero.M, m.maxima.M.max.value, 1e-9);
    const h = 1e-6;
    for (const x of [1, 3, 5, 7, 9]) {
      const a = pieceAt(m.pieces, x - h);
      const b = pieceAt(m.pieces, x + h);
      near((b.M - a.M) / (2 * h), pieceAt(m.pieces, x).V, 1e-6, 1e-6);
    }
    near((pieceAt(m.pieces, 5 + h).V - pieceAt(m.pieces, 5 - h).V) / (2 * h), -1 - 3 * (5 - 2) / 6, 1e-5, 1e-5);
  });

  it('a moment load: M jumps by −C (counter-clockwise couple), the reactions form a couple', () => {
    const s = ok(beam(10, [{ node: 0, kind: 'pin' }, { node: 1, kind: 'roller' }], { memberLoads: [{ kind: 'moment', member: 0, a: 4, M: 20 }] }));
    // CCW couple C = 20 at x = 4: R_B·10 = −C·(−1)… moment about A: R_B·10 + 20 = 0 → R_B = −2, R_A = +2. M just left of the couple: 2·4 = 8, right: 8 − 20 = −12.
    near(s.reactions[1].ry, -2);
    near(s.reactions[0].ry, 2);
    near(pieceAt(s.members[0].pieces, 4, 'left').M, 8);
    near(pieceAt(s.members[0].pieces, 4, 'right').M, -12);
  });

  it('an inclined member with a projected load: the member bends with the component perpendicular to it', () => {
    // A 3-4-5 rafter from (0,0) to (12,9), L = 15, pinned at the foot and rolling at the top, snow w = 1 per horizontal foot (total 12).
    const s = ok(
      model({
        nodes: [{ x: 0, y: 0 }, { x: 12, y: 9 }],
        members: [{ i: 0, j: 1 }],
        supports: [{ node: 0, kind: 'pin' }, { node: 1, kind: 'roller' }],
        memberLoads: [{ kind: 'udl-projected', member: 0, dir: 'global-y', w: -1 }],
      }),
    );
    near(s.members[0].loadResultant.fy, -12);
    near(s.reactions[0].ry + s.reactions[1].ry, 12);
    // Vertical load per unit MEMBER length: 12/15 = 0.8; its component perpendicular to the rafter is 0.8·cos = 0.64, so M_max = 0.64·15²/8 = 18.
    near(s.members[0].maxima.M.max.value, 18);
  });
});

describe('the worked example of the contract (types.ts)', () => {
  it('a member from (0,0) to (10,0), pinned at both ends, UDL 2 kip/ft down: V = +10, 0, −10; M = 0, +25, 0; the same beam drawn right to left has the signs of V and M reversed', () => {
    const left = ok(beam(10, [{ node: 0, kind: 'pin' }, { node: 1, kind: 'roller' }], { memberLoads: [{ kind: 'udl', member: 0, dir: 'global-y', w: -2 }] }));
    const m = left.members[0];
    near(pieceAt(m.pieces, 0, 'right').V, 10);
    near(pieceAt(m.pieces, 5).V, 0, 1e-9, 1e-9);
    near(pieceAt(m.pieces, 10, 'left').V, -10);
    near(pieceAt(m.pieces, 5).M, 25);
    near(m.start.N, 0, 1e-9, 1e-9);
    // Defined from node 1 to node 0 the local axes turn with the member: ȳ points down, so the tension fibre (the −ȳ side) is the top.
    const right = ok(model({ nodes: [{ x: 0, y: 0 }, { x: 10, y: 0 }], members: [{ i: 1, j: 0 }], supports: [{ node: 0, kind: 'pin' }, { node: 1, kind: 'roller' }], memberLoads: [{ kind: 'udl', member: 0, dir: 'global-y', w: -2 }] }));
    near(pieceAt(right.members[0].pieces, 5).M, -25);
    near(pieceAt(right.members[0].pieces, 0, 'right').V, -10);
    near(right.reactions[0].ry, 10);
  });
});

describe('supports', () => {
  it('a guide (fixed in rotation, held along its line, free to slide across it): the fixed-guided beam has M = wL²/3 at the fixed end, wL²/6 at the guide, and sinks wL⁴/24EI', () => {
    // Fixed at the left, guide at the right restraining the HORIZONTAL (angle 0) and the rotation: it can move vertically. w = 2, L = 10.
    const s = ok(beam(10, [{ node: 0, kind: 'fixed' }, { node: 1, kind: 'guide', angle: 0 }], { memberLoads: [{ kind: 'udl', member: 0, dir: 'global-y', w: -2 }] }));
    near(s.reactions[0].ry, 20);
    near(s.reactions[1].ry, 0, 1e-9, 1e-9);
    near(s.members[0].start.M, -2 * 100 / 3);
    near(s.members[0].end.M, 2 * 100 / 6);
    near(s.displacements![1].uy, -2 * 10 ** 4 / (24 * 1000 * 100));
    near(s.displacements![1].rotation!, 0, 1e-9, 1e-12);
    near(s.reactions[1].along!, s.reactions[1].rx);
    // With the guide at angle 90 (held vertically and in rotation) the beam is fixed-fixed.
    const t = ok(beam(10, [{ node: 0, kind: 'fixed' }, { node: 1, kind: 'guide', angle: 90 }], { memberLoads: [{ kind: 'udl', member: 0, dir: 'global-y', w: -2 }] }));
    near(t.members[0].end.M, -2 * 100 / 12);
  });
  it('the angle of a roller is read modulo 180: 270 is 90, −45 is 135, 180 is 0, and the reaction is the same', () => {
    const at = (angle: number) => ok(beam(10, [{ node: 0, kind: 'pin' }, { node: 1, kind: 'roller', angle }], { memberLoads: [{ kind: 'point', member: 0, dir: 'global-y', a: 5, P: -8 }] }));
    const base = at(135);
    const other = at(-45);
    near(other.reactions[1].rx, base.reactions[1].rx, 1e-9, 1e-12);
    near(other.reactions[1].ry, base.reactions[1].ry, 1e-9, 1e-12);
    expect(other.reactions[1].angle).toBeCloseTo(135, 9);
    expect(at(270).reactions[1].angle).toBe(90);
    near(at(270).reactions[1].ry, 4);
    // 180 and a hair below zero are the horizontal line (here it passes through the pin: the frame turns about it).
    expect([directionOf(180).angle, directionOf(-1e-20).angle, directionOf(360).angle, directionOf(undefined).angle, directionOf(-90).angle]).toEqual([0, 0, 0, 90, 90]);
    expect(solveFrame(beam(10, [{ node: 0, kind: 'pin' }, { node: 1, kind: 'roller', angle: 180 }])).ok).toBe(false);
  });
  it('a spring that grows stiff becomes the rigid support: springs of 1e9 and 1e13 reproduce the fixed foot, a pin with a rotational spring of 1e12 the fixed one', () => {
    const frame = (supports: FrameModel['supports']) =>
      model({
        A: 1e6,
        nodes: [{ x: 0, y: 0 }, { x: 20, y: 0 }, { x: 0, y: 10 }, { x: 20, y: 10 }],
        members: [{ i: 0, j: 2 }, { i: 1, j: 3 }, { i: 2, j: 3 }],
        supports,
        loads: [{ node: 2, fx: 10, fy: 0, m: 0 }],
        memberLoads: [{ kind: 'udl', member: 2, dir: 'global-y', w: -1.2 }],
      });
    const fixed = ok(frame([{ node: 0, kind: 'fixed' }, { node: 1, kind: 'fixed' }]));
    for (const k of [1e9, 1e13]) {
      const s = ok(frame([{ node: 0, kind: 'spring', kx: k, ky: k, kr: k }, { node: 1, kind: 'spring', kx: k, ky: k, kr: k }]));
      near(s.reactions[0].rm, fixed.reactions[0].rm, 1e-4, 1e-4);
      near(s.members[2].end.M, fixed.members[2].end.M, 1e-4, 1e-4);
    }
    const semi = ok(frame([{ node: 0, kind: 'pin', kr: 1e12 }, { node: 1, kind: 'pin', kr: 1e12 }]));
    near(semi.reactions[0].rm, fixed.reactions[0].rm, 1e-6, 1e-6);
    // A moderate rotational spring is in between.
    const soft = ok(frame([{ node: 0, kind: 'pin', kr: 5000 }, { node: 1, kind: 'pin', kr: 5000 }]));
    expect(Math.abs(soft.reactions[0].rm)).toBeLessThan(Math.abs(fixed.reactions[0].rm));
    expect(Math.abs(soft.reactions[0].rm)).toBeGreaterThan(0);
  });
  it('where the frame stands does not matter: moved a million feet away it has the same moments', () => {
    const at = (dx: number, dy: number) =>
      ok(model({
        A: 1e6,
        nodes: [{ x: dx, y: dy }, { x: dx + 20, y: dy }, { x: dx, y: dy + 10 }, { x: dx + 20, y: dy + 10 }],
        members: [{ i: 0, j: 2 }, { i: 1, j: 3 }, { i: 2, j: 3 }],
        supports: [{ node: 0, kind: 'fixed' }, { node: 1, kind: 'pin' }],
        loads: [{ node: 2, fx: 10, fy: 0, m: 0 }],
        memberLoads: [{ kind: 'udl', member: 2, dir: 'global-y', w: -1.2 }],
      }));
    const a = at(0, 0);
    const b = at(1e6, -5e5);
    near(b.reactions[0].rm, a.reactions[0].rm, 1e-9, 1e-9);
    near(b.members[2].end.M, a.members[2].end.M, 1e-9, 1e-9);
    near(b.equilibrium.about.x, 1e6 + 10, 1e-12, 1e-6);
  });
});
