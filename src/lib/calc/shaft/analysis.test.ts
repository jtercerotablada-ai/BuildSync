import { readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { formatNumber } from '../format';
import type { Direction, Rotation } from '../beam/model';
import type { Side } from '../beam/solver';
import { analyseSafely, analyseShaft, type ByPlanes, type ShaftAnalysis, type ShaftAnalysisIssue, type ShaftResults, type ShaftSide, type ShaftValue } from './analysis';
import { CLOSE, SHORT, STIFF, solveShaft } from './engine';
import { SEAT, SHAFT_US_TO_SI, convertShaft, decodeShaft, defaultShaft, encodeShaft, toEngine, type CoupleRow, type ForceRow, type SegmentRow, type ShaftForm, type ShaftView, type Sideways } from './model';
import type { ShaftModel, ShaftSolution, ShaftState } from './types';

// As in continuous/engine.test.ts: arithmetic that never waits. A turn of the event loop between two tests lets the
// runner hear from this worker, which it otherwise reports as a timeout of its own over a passing run.
afterEach(() => new Promise<void>((resolve) => setTimeout(resolve, 0)));

/* The engine, as it is — but for two tests that say so, which need of it what nothing is known to make it do: with
   `trap.on` set it throws (what the page must outlive is a fault in the arithmetic), and with `trap.tilt` set its
   left bearing carries that much more than it found, as a fraction, in the vertical plane (reactions that do not add
   up to the load: what the page must then not say). */
const trap = vi.hoisted(() => ({ on: false, tilt: 0 }));
vi.mock('./engine', async (original) => {
  const real = await original<typeof import('./engine')>();
  return {
    ...real,
    solveShaft: (model: ShaftModel) => {
      if (trap.on) throw new Error('made to throw');
      const out = real.solveShaft(model);
      if (!trap.tilt || !out.ok) return out;
      return { ...out, bearings: [{ ...out.bearings[0], vertical: out.bearings[0].vertical * (1 + trap.tilt) }, out.bearings[1]] };
    },
  };
});
afterEach(() => {
  trap.on = false;
  trap.tilt = 0;
});

/* What a describe of a few hundred shafts is allowed: the arithmetic is some seconds, and the machine may be doing other things. */
const LONG_RUN = 240_000;

/**
 * FROM THE FORM TO WHAT THE PAGE PRINTS — the fourth calculator's `analyse`.
 *
 * The engine has its own tests (engine.test.ts), and so has the form
 * (model.test.ts). What can go wrong HERE is what stands between them and
 * the page: a row of a table read from the wrong bearing, a plane's value
 * under the other plane's name, a moment in N·mm under "N·m", a stress over
 * the section modulus of the segment next door, the left side of a shoulder
 * printed as its right, rounding printed as a result — or a result printed
 * as zero.
 *
 * NOTHING BELOW ASKS THIS CALCULATOR'S ENGINE WHAT IT SHOULD SAY. A shaft is
 * checked against
 *   — statics by hand: the two equations of equilibrium of each plane,
 *     written out where the shaft is given;
 *   — the beam tables, for a shaft of one section; and
 *   — the UNIT-LOAD METHOD (virtual work), written here as a function of the
 *     FORM (`reference`): a deflection is the integral of M × m ÷ EI along
 *     the whole shaft, m the moment of a unit load where the answer is
 *     wanted; a slope the same with a unit couple. It has no constant of
 *     integration and carries nothing from piece to piece, it makes its own
 *     sections from the diameters and its own units from the form's — so a
 *     factor of 1,000 or of g that went wrong on the way to the engine, or
 *     on the way back, shows.
 * (Three tests say of themselves why they are the exception: the points of
 * the diagrams, which are the engine's stations one for one; the floors,
 * which are a billionth of the engine's own sizes of the problem; and the
 * stress, which is held to the engine's as well as to the yardstick's.)
 */

type Plane = 'vertical' | 'horizontal';
const PLANES: Plane[] = ['vertical', 'horizontal'];
const VIEWS: ShaftView[] = ['vertical', 'horizontal', 'both'];
const SIDES: Side[] = ['left', 'right'];

/** Equal to rounding: relative to the size of the numbers in play. With no size given, to the value itself — and a zero is then exactly zero. */
const near = (got: number, want: number, scale = Math.abs(want), tol = 1e-9) => expect(Math.abs(got - want), `got ${got}, want ${want}`).toBeLessThanOrEqual(tol * Math.abs(scale));
/** A quantity by planes: each plane's, and the root of the sum of their squares. */
const nearPlanes = (got: ByPlanes, vertical: number, horizontal: number, scale = Math.hypot(vertical, horizontal), tol = 1e-9) => {
  near(got.vertical, vertical, scale, tol);
  near(got.horizontal, horizontal, scale, tol);
  near(got.both, Math.hypot(vertical, horizontal), scale, tol);
};

/** The example with something else in it. */
const shaft = (over: Partial<ShaftForm>): ShaftForm => ({ ...defaultShaft(), ...over });
const seg = (id: number, L: number, d: number, bore = 0): SegmentRow => ({ id, L, d, bore });
const force = (id: number, x: number, v: number, h = 0, vDir: Direction = 'down', hDir: Sideways = 'towards'): ForceRow => ({ id, x, v, vDir, h, hDir });
const couple = (id: number, x: number, v: number, h = 0, vDir: Rotation = 'ccw', hDir: Rotation = 'ccw'): CoupleRow => ({ id, x, v, vDir, h, hDir });
const solved = (form: ShaftForm): ShaftResults => {
  const a = analyseShaft(form);
  expect(a.issues, JSON.stringify(a.issues)).toEqual([]);
  return a.results!;
};
/** The codes of what is wrong, with the row each is on. */
const faults = (issues: ShaftAnalysisIssue[]) => issues.map((i) => (i.row ? [i.code, i.row] : [i.code]));
/** A number as the page prints it: four figures. */
const printed = (v: number) => formatNumber(v);

/* ── The yardstick: statics and the unit-load method, from the form ───── */

/** ∫ f over [a, b], exact for a polynomial of the fifth degree: three Gauss points. */
const gauss = (f: (x: number) => number, a: number, b: number) => {
  const half = (b - a) / 2;
  const mid = (a + b) / 2;
  const t = Math.sqrt(3 / 5);
  return half * ((5 / 9) * f(mid - half * t) + (8 / 9) * f(mid) + (5 / 9) * f(mid + half * t));
};
const bracket = (x: number) => (x > 0 ? x : 0);

interface Reference {
  L: number;
  /** Where each segment starts; the last is the shaft's length. */
  ends: number[];
  /** By segments: moment of inertia, section modulus, area — in⁴, in³, in² or mm⁴, mm³, mm² — and weight per length (lbf/in, N/mm). */
  I: number[];
  Z: number[];
  A: number[];
  w: number[];
  /** The bearings, left and right. */
  a: number;
  b: number;
  /** How large the problem is, as a force (lbf, N): every force's size, every couple over the span, the whole weight. */
  size: number;
  /** Each plane's loads added up (lbf, N), and its two reactions, left and right. */
  load(plane: Plane): number;
  reactions(plane: Plane): [number, number];
  /** Shear (lbf, N) and moment IN THE UNITS SHOWN (lbf·in, N·m) at x, on a side. */
  V(plane: Plane, x: number, side: Side): number;
  M(plane: Plane, x: number, side: Side): number;
  /** Deflection (in, mm), positive against a positive force, and slope (rad), positive counter-clockwise. */
  v(plane: Plane, x: number): number;
  theta(plane: Plane, x: number): number;
  /** The segment a side of x is in, and the nominal stress there IN THE UNITS SHOWN (ksi, MPa): the two moments together over that segment's Z. */
  segment(x: number, side: Side): number;
  stress(x: number, side: Side): number;
  /** Every place where something happens, ascending, each once. */
  cuts: number[];
}

/**
 * A shaft as the FORM has it, worked out with nothing of this calculator's:
 * sections from the diameters (π(d⁴ − b⁴)/64), the modulus in lbf/in² or
 * N/mm², a couple in lbf·in or N·mm, the weight per length from the density
 * (lb/in³ is lbf/in³; kg/m³ × 9.80665 is N/m³, and a cubic metre is 10⁹ mm³),
 * the two equations of equilibrium of each plane, and the unit-load method
 * for every slope and deflection.
 */
function reference(form: ShaftForm): Reference {
  const us = form.units === 'us';
  const E = us ? form.E * 1000 : form.E;
  const unitWeight = us ? form.density : (form.density * 9.80665) / 1e9;
  const n = form.segments.length;
  const ends = [0];
  for (const s of form.segments) ends.push(ends[ends.length - 1] + s.L);
  const L = ends[n];
  const I = form.segments.map((s) => (Math.PI * (s.d ** 4 - s.bore ** 4)) / 64);
  const A = form.segments.map((s) => (Math.PI * (s.d ** 2 - s.bore ** 2)) / 4);
  const Z = form.segments.map((s, k) => I[k] / (s.d / 2));
  const w = A.map((area) => (form.ownWeight ? unitWeight * area : 0));
  const a = Math.min(form.bearings[0], form.bearings[1]);
  const b = Math.max(form.bearings[0], form.bearings[1]);
  /** A plane's loads, signed: down, towards the viewer and counter-clockwise are positive. A couple in lbf·in or N·mm. */
  const loadsOf = (plane: Plane) => ({
    forces: form.forces.map((f) => ({ x: f.x, P: plane === 'vertical' ? (f.vDir === 'down' ? f.v : -f.v) : f.hDir === 'towards' ? f.h : -f.h })),
    couples: form.couples.map((c) => ({ x: c.x, C: (plane === 'vertical' ? (c.vDir === 'ccw' ? c.v : -c.v) : c.hDir === 'ccw' ? c.h : -c.h) * (us ? 1 : 1000) })),
    w: plane === 'vertical' ? w : w.map(() => 0),
  });
  const made = { vertical: loadsOf('vertical'), horizontal: loadsOf('horizontal') };
  const loads = (plane: Plane) => made[plane];
  // How large the problem is, as a force: every force's size, every couple over the span, the whole weight.
  const size =
    made.vertical.forces.reduce((sum, f, i) => sum + Math.hypot(f.P, made.horizontal.forces[i].P), 0) +
    made.vertical.couples.reduce((sum, c, i) => sum + Math.hypot(c.C, made.horizontal.couples[i].C), 0) / (b - a) +
    w.reduce((sum, q, k) => sum + q * form.segments[k].L, 0);
  const load = (plane: Plane) => loads(plane).forces.reduce((sum, f) => sum + f.P, 0) + loads(plane).w.reduce((sum, q, k) => sum + q * form.segments[k].L, 0);
  /* Moments about the left bearing, counter-clockwise positive: the right reaction × the span, less each force × its
     arm, less each segment's weight × the arm of its middle, plus each couple — and all of that is nothing. */
  const reactions = (plane: Plane): [number, number] => {
    const p = loads(plane);
    let moment = 0;
    for (const f of p.forces) moment += f.P * (f.x - a);
    p.w.forEach((q, k) => (moment += q * form.segments[k].L * ((ends[k] + ends[k + 1]) / 2 - a)));
    for (const c of p.couples) moment -= c.C;
    const right = moment / (b - a);
    return [load(plane) - right, right];
  };
  const held = { vertical: reactions('vertical'), horizontal: reactions('horizontal') };
  /** What is to the left of a cut at x: on its right side, what stands AT x is counted. Moment in lbf·in or N·mm. */
  const cut = (plane: Plane, x: number, side: Side): { V: number; M: number } => {
    const p = loads(plane);
    const before = (at: number) => at < x || (side === 'right' && at === x);
    let [V, M] = [0, 0];
    [a, b].forEach((at, i) => {
      if (!before(at)) return;
      V += held[plane][i];
      M += held[plane][i] * (x - at);
    });
    for (const f of p.forces) {
      if (!before(f.x)) continue;
      V -= f.P;
      M -= f.P * (x - f.x);
    }
    for (const c of p.couples) if (before(c.x)) M -= c.C;
    p.w.forEach((q, k) => {
      const len = Math.min(Math.max(x - ends[k], 0), form.segments[k].L);
      V -= q * len;
      M -= q * len * (x - ends[k] - len / 2);
    });
    return { V, M };
  };
  const segment = (x: number, side: Side) => {
    let k = 0;
    while (k < n - 1 && (side === 'right' ? x >= ends[k + 1] : x > ends[k + 1])) k += 1;
    return k;
  };
  const cuts = [...new Set([...ends, a, b, ...form.forces.map((f) => f.x), ...form.couples.map((c) => c.x)])].filter((x) => x >= 0 && x <= L).sort((p, q) => p - q);
  /** ∫ M × m ÷ EI along the shaft, piece by piece between the places and the point the unit load stands at. */
  const work = (plane: Plane, at: number, m: (x: number) => number) => {
    const marks = [...new Set([...cuts, at])].sort((p, q) => p - q);
    let sum = 0;
    for (let i = 0; i + 1 < marks.length; i++) {
      const [p, q] = [marks[i], marks[i + 1]];
      sum += gauss((x) => cut(plane, x, 'right').M * m(x), p, q) / (E * I[segment((p + q) / 2, 'right')]);
    }
    return sum;
  };
  const toShown = us ? 1 : 1 / 1000;
  const M = (plane: Plane, x: number, side: Side) => cut(plane, x, side).M * toShown;
  return {
    L,
    ends,
    I,
    Z,
    A,
    w,
    a,
    b,
    size,
    load,
    reactions: (plane) => held[plane],
    V: (plane, x, side) => cut(plane, x, side).V,
    M,
    // A unit force at x, positive as a force is, on the two bearings: what it lowers the shaft by there. A deflection is positive the other way.
    v: (plane, x) => {
      const right = (x - a) / (b - a);
      return -work(plane, x, (t) => (1 - right) * bracket(t - a) + right * bracket(t - b) - bracket(t - x));
    },
    // A unit counter-clockwise couple at x: the bearings hold it with 1/(b − a), up at the left one and down at the right one.
    theta: (plane, x) => work(plane, x, (t) => (bracket(t - a) - bracket(t - b)) / (b - a) - (t > x ? 1 : 0)),
    segment,
    // lbf·in over in³ is lbf/in², a thousandth of a ksi; N·mm over mm³ is N/mm², a megapascal.
    stress: (x, side) => (Math.hypot(cut('vertical', x, side).M, cut('horizontal', x, side).M) / Z[segment(x, side)]) * (us ? 1 / 1000 : 1),
    cuts,
  };
}

describe('shaft analysis: the yardstick these tests measure with', () => {
  it('is the beam tables: a force at midspan, a force on an overhang, a couple at a bearing, a uniform weight', () => {
    const d = 2;
    const EI = (29000 * 1000 * Math.PI * d ** 4) / 64;
    const one = (over: Partial<ShaftForm>) => reference(shaft({ segments: [seg(1, 30, d)], bearings: [0, 30], forces: [], couples: [], ...over }));
    // PL³/48EI under a central force, PL²/16EI at the bearings.
    const mid = one({ forces: [force(2, 15, 900)] });
    near(mid.v('vertical', 15), (-900 * 30 ** 3) / (48 * EI));
    near(mid.theta('vertical', 0), (-900 * 30 ** 2) / (16 * EI));
    near(mid.theta('vertical', 30), (900 * 30 ** 2) / (16 * EI));
    near(mid.M('vertical', 15, 'left'), (900 * 30) / 4);
    // Overhung: Pc²(ℓ + c)/3EI at the tip, Pcℓ/6EI at the far bearing and Pcℓ/3EI at the near one.
    const over = one({ bearings: [0, 20], forces: [force(2, 30, 500)] });
    near(over.v('vertical', 30), (-500 * 10 ** 2 * (20 + 10)) / (3 * EI));
    near(over.theta('vertical', 0), (500 * 10 * 20) / (6 * EI));
    near(over.theta('vertical', 20), (-500 * 10 * 20) / (3 * EI));
    expect(over.reactions('vertical').map((v) => Math.round(v * 1e9) / 1e9)).toEqual([-250, 750]);
    // A counter-clockwise couple at the left bearing: held by C/L up there and down at the far one; the end turns WITH it by CL/3EI, the far end the other way by CL/6EI.
    const turned = one({ couples: [couple(2, 0, 6000)] });
    near(turned.reactions('vertical')[0], 6000 / 30);
    near(turned.reactions('vertical')[1], -6000 / 30);
    near(turned.theta('vertical', 0), (6000 * 30) / (3 * EI));
    near(turned.theta('vertical', 30), (-6000 * 30) / (6 * EI));
    near(turned.size, 6000 / 30);
    near(mid.size, 900);
    // Its own weight: 490 lb/ft³ of steel, 5wL⁴/384EI and wL³/24EI.
    const heavy = one({ ownWeight: true });
    const w = (0.2836 * Math.PI * d * d) / 4;
    near(heavy.w[0], w);
    near(heavy.v('vertical', 15), (-5 * w * 30 ** 4) / (384 * EI));
    near(heavy.theta('vertical', 0), (-w * 30 ** 3) / (24 * EI));
    near(heavy.M('vertical', 15, 'right'), (w * 30 ** 2) / 8);
    near(heavy.size, w * 30);
    // And the horizontal plane is a plane like the other: towards the viewer is its positive force.
    near(one({ forces: [force(2, 15, 0, 900)] }).v('horizontal', 15), (-900 * 30 ** 3) / (48 * EI));
  });
});

/* ── The example ──────────────────────────────────────────────────────── */

describe('shaft analysis: the example, number by number', () => {
  // A 23 in shaft in four diameters — 4 × 1.5, 10 × 2, 4 × 1.5, 5 × 1.25 in — on bearings at 2 in and 16 in; a gear at
  // 9 in pushing 1,000 lbf down and 360 lbf towards the viewer; a pulley at 21 in pulled 400 lbf down. Steel.
  const form = defaultShaft();
  const r = solved(form);
  const ref = reference(form);
  // BY HAND. Vertical plane, moments about the left bearing: R₂ × 14 = 1,000 × 7 + 400 × 19.
  const R2v = (1000 * 7 + 400 * 19) / 14;
  const R1v = 1000 + 400 - R2v;
  // Horizontal plane: 360 lbf at the middle of the span.
  const [R1h, R2h] = [180, 180];
  // The section modulus of a solid bar: π·d³/32.
  const Z = (d: number) => (Math.PI * d ** 3) / 32;

  it('the yardstick finds the same statics as the two equations written out', () => {
    near(ref.reactions('vertical')[0], R1v);
    near(ref.reactions('vertical')[1], R2v);
    near(ref.reactions('horizontal')[0], R1h);
    near(ref.reactions('horizontal')[1], R2h);
  });

  it('is solved, with nothing wrong and nothing left out', () => {
    expect(analyseShaft(form).issues).toEqual([]);
    expect([r.L, r.loaded, r.ownWeight]).toEqual([23, true, null]);
    expect(r.breaks).toEqual([0, 2, 4, 9, 14, 16, 18, 21, 23]);
    // Every force's size: the gear's two components are one force.
    near(r.loadScale, Math.hypot(1000, 360) + 400);
  });

  it('each bearing: its reaction in each plane and its radial load — 399.9 lbf and 1,058 lbf', () => {
    const [left, right] = r.bearings;
    expect([left.number, left.index, left.x, right.number, right.index, right.x]).toEqual([1, 0, 2, 2, 1, 16]);
    nearPlanes(left.reaction, R1v, R1h);
    nearPlanes(right.reaction, R2v, R2h);
    expect([printed(left.reaction.vertical), printed(left.reaction.horizontal), printed(left.reaction.both)]).toEqual(['357.1', '180', '399.9']);
    expect([printed(right.reaction.vertical), printed(right.reaction.horizontal), printed(right.reaction.both)]).toEqual(['1,043', '180', '1,058']);
  });

  it('each plane: its reactions add up to its loads, and the page may say so', () => {
    expect(r.balance.vertical.ok).toBe(true);
    expect(r.balance.horizontal.ok).toBe(true);
    near(r.balance.vertical.reactions, 1400);
    near(r.balance.vertical.load, 1400);
    near(r.balance.horizontal.reactions, 360);
    near(r.balance.horizontal.load, 360);
  });

  it('…and it is asked each time: reactions that did not add up would not be said to', () => {
    // No shaft is known whose reactions the engine gets wrong. Here its left bearing is made to carry a hundredth
    // more than it found, in the vertical plane: 360.7 lbf where there are 357.1.
    trap.tilt = 1e-2;
    const off = analyseShaft(form).results!;
    trap.tilt = 0;
    expect(off.balance.vertical.ok).toBe(false);
    near(off.balance.vertical.reactions, 1400 + R1v * 1e-2);
    near(off.balance.vertical.load, 1400);
    expect([printed(off.balance.vertical.reactions), printed(off.balance.vertical.load)]).toEqual(['1,404', '1,400']);
    expect(off.balance.horizontal.ok).toBe(true);
    // A last figure of rounding is another matter: the two are one number.
    trap.tilt = 1e-12;
    expect(analyseShaft(form).results!.balance.vertical.ok).toBe(true);
  });

  it('the slope at each bearing, by planes and as one angle: 0.000442 rad and 0.0002519 rad', () => {
    const [left, right] = r.bearings;
    nearPlanes(left.slope, ref.theta('vertical', 2), ref.theta('horizontal', 2));
    nearPlanes(right.slope, ref.theta('vertical', 16), ref.theta('horizontal', 16));
    // Both planes sag between the bearings: clockwise at the left one. In the horizontal plane the gear is at midspan, and the two slopes are one size.
    expect(left.slope.vertical).toBeLessThan(0);
    expect(left.slope.horizontal).toBeLessThan(0);
    near(right.slope.horizontal, -left.slope.horizontal);
    expect([printed(left.slope.both), printed(right.slope.both)]).toEqual(['0.000442', '0.0002519']);
  });

  it('the shear, stretch by stretch, is what is to the left of the cut', () => {
    const want: [number, number, number][] = [
      [1, 0, 0],
      [3, R1v, R1h],
      [5, R1v, R1h],
      [12, R1v - 1000, R1h - 360],
      [15, R1v - 1000, R1h - 360],
      [17, R1v - 1000 + R2v, 0],
      [20, 400, 0],
      [22, 0, 0],
    ];
    for (const [x, vertical, horizontal] of want) {
      const p = r.at(x);
      nearPlanes(p.left.shear, vertical, horizontal, 1400);
      nearPlanes(p.right.shear, vertical, horizontal, 1400);
      expect(p.jumps).toEqual({ shear: false, moment: false, section: false, stress: false });
    }
  });

  it('the bending moment at every place, by hand: 2,500 and 1,260 lbf·in at the gear, −2,000 lbf·in over the right bearing', () => {
    const want: [number, number, number][] = [
      [0, 0, 0],
      [2, 0, 0],
      [4, R1v * 2, R1h * 2],
      [9, R1v * 7, R1h * 7],
      [14, R1v * 12 - 1000 * 5, R1h * 12 - 360 * 5],
      [16, -400 * 5, 0],
      [18, -400 * 3, 0],
      [21, 0, 0],
      [23, 0, 0],
    ];
    for (const [x, vertical, horizontal] of want) {
      const p = r.at(x);
      for (const side of SIDES) nearPlanes(p[side].moment, vertical, horizontal, 2800);
      expect(p.jumps.moment).toBe(false);
    }
    near(R1v * 7, 2500);
    near(R1v * 14 - 1000 * 7, -2000);
    expect(printed(r.at(9).right.moment.both)).toBe('2,800');
  });

  it('each segment: its largest moment, where, and the nominal stress there over ITS OWN section modulus', () => {
    // 0–4 in, 1.5 in: the moment still rising at its right end.  4–14 in, 2 in: at the gear.
    // 14–18 in, 1.5 in: over the right bearing.  18–23 in, 1.25 in: at the shoulder it starts with.
    const want: [number, number, number][] = [
      [Math.hypot(R1v * 2, R1h * 2), 4, 1.5],
      [Math.hypot(2500, 1260), 9, 2],
      [2000, 16, 1.5],
      [1200, 18, 1.25],
    ];
    expect(r.segments).toHaveLength(4);
    r.segments.forEach((s, i) => {
      const [moment, x, d] = want[i];
      expect([s.index, s.id, s.from, s.to, s.d, s.bore, s.w]).toEqual([i, form.segments[i].id, ref.ends[i], ref.ends[i + 1], d, 0, null]);
      near(s.moment.value, moment);
      expect(s.moment.x).toBe(x);
      // lbf·in over in³ is lbf/in²: a thousandth of a ksi.
      near(s.stress.value, moment / Z(d) / 1000);
      expect(s.stress.x).toBe(x);
      near(s.section.Z, Z(d));
      near(s.section.I, (Math.PI * d ** 4) / 64);
      near(s.section.A, (Math.PI * d ** 2) / 4);
    });
    expect(r.segments.map((s) => printed(s.stress.value))).toEqual(['2.414', '3.565', '6.036', '6.258']);
    expect(r.segments.map((s) => printed(s.moment.value))).toEqual(['799.9', '2,800', '2,000', '1,200']);
  });

  it('each segment: its largest deflection, and where — the free end of each overhang, and near the gear between the bearings', () => {
    const size = (x: number) => Math.hypot(ref.v('vertical', x), ref.v('horizontal', x));
    r.segments.forEach((s) => {
      near(s.deflection.value, size(s.deflection.x!));
      // No point of the segment is past it, by the yardstick, every hundredth of an inch.
      for (let x = s.from; x <= s.to; x += 0.01) expect(size(x)).toBeLessThanOrEqual(s.deflection.value * (1 + 1e-9));
    });
    expect(r.segments.map((s) => s.deflection.x)).toEqual([0, r.segments[1].deflection.x, 18, 23]);
    // Between the bearings the shaft goes furthest a little left of the gear: the left journal is the longer way from a bearing.
    expect(r.segments[1].deflection.x).toBeGreaterThan(8);
    expect(r.segments[1].deflection.x).toBeLessThan(9);
    expect(r.segments.map((s) => printed(s.deflection.value))).toEqual(['0.0008839', '0.001683', '0.0008318', '0.005751']);
  });

  it('the largest values: 2,800 lbf·in at the gear; 6.258 ksi on the small side of the last shoulder, under a moment less than half of that', () => {
    expect(r.largest.moment.x).toBe(9);
    near(r.largest.moment.value, Math.hypot(2500, 1260));
    // The stress is not where the moment is largest: 1,200 lbf·in over the section modulus of a 1.25 in bar.
    expect([r.largest.stress.x, r.largest.stress.segment]).toEqual([18, 3]);
    near(r.largest.stress.value, 1200 / Z(1.25) / 1000);
    expect(printed(r.largest.stress.value)).toBe('6.258');
    // The shear is largest right of the gear, all the way to the right bearing: it is named where it starts.
    expect(r.largest.shear.x).toBe(9);
    near(r.largest.shear.value, Math.hypot(R1v - 1000, R1h - 360));
    expect(printed(r.largest.shear.value)).toBe('667.6');
  });

  it('the largest deflection is at the free end, 0.005751 in; the largest slope from the pulley on, 0.001093 rad', () => {
    const tip = Math.hypot(ref.v('vertical', 23), ref.v('horizontal', 23));
    expect(r.largest.deflection.x).toBe(23);
    near(r.largest.deflection.value, tip);
    expect(printed(r.largest.deflection.value)).toBe('0.005751');
    // Nothing bends the shaft past the pulley: one slope from 21 in to the end, named where it starts.
    expect(r.largest.slope.x).toBe(21);
    near(r.largest.slope.value, Math.hypot(ref.theta('vertical', 21), ref.theta('horizontal', 21)));
    near(r.largest.slope.value, Math.hypot(ref.theta('vertical', 23), ref.theta('horizontal', 23)));
    expect(printed(r.largest.slope.value)).toBe('0.001093');
    // No point of the shaft is past either, by the yardstick, every twentieth of an inch.
    for (let x = 0; x <= 23; x += 0.05) {
      expect(Math.hypot(ref.v('vertical', x), ref.v('horizontal', x))).toBeLessThanOrEqual(r.largest.deflection.value * (1 + 1e-9));
      expect(Math.hypot(ref.theta('vertical', x), ref.theta('horizontal', x))).toBeLessThanOrEqual(r.largest.slope.value * (1 + 1e-9));
    }
  });

  it('at each force, the deflection and the slope of the shaft: 0.001667 in and 7.316 × 10⁻⁵ rad at the gear, 0.003573 in and 0.001093 rad at the pulley', () => {
    expect(r.forces.map((f) => [f.id, f.index, f.x])).toEqual([
      [5, 0, 9],
      [6, 1, 21],
    ]);
    r.forces.forEach((f) => {
      nearPlanes(f.deflection, ref.v('vertical', f.x), ref.v('horizontal', f.x));
      nearPlanes(f.slope, ref.theta('vertical', f.x), ref.theta('horizontal', f.x), 1e-3);
    });
    const [gear, pulley] = r.forces;
    // The gear goes down and towards the viewer with its force; the pulley goes down, and away: the horizontal plane swings it about the right bearing.
    expect(gear.deflection.vertical).toBeLessThan(0);
    expect(gear.deflection.horizontal).toBeLessThan(0);
    expect(pulley.deflection.vertical).toBeLessThan(0);
    expect(pulley.deflection.horizontal).toBeGreaterThan(0);
    // The horizontal plane is symmetrical about the gear: no slope there, to the last figure the page would print.
    expect(gear.slope.horizontal).toBe(0);
    expect([printed(gear.deflection.both), printed(gear.slope.both)]).toEqual(['0.001667', '7.316 × 10^-5']);
    expect([printed(pulley.deflection.both), printed(pulley.slope.both)]).toEqual(['0.003573', '0.001093']);
  });

  it('the values at any point are the yardstick’s: shear, moment, deflection, slope, the diameter and the stress there', () => {
    for (const x of [0, 1, 2, 3.3, 4, 7, 9, 11.3, 14, 15, 16, 17, 18, 19.5, 21, 22, 23]) {
      const p = r.at(x);
      expect(p.x).toBe(x);
      for (const side of SIDES) {
        nearPlanes(p[side].shear, ref.V('vertical', x, side), ref.V('horizontal', x, side), 1400);
        nearPlanes(p[side].moment, ref.M('vertical', x, side), ref.M('horizontal', x, side), 2800);
        const k = ref.segment(x, side);
        expect([p[side].segment, p[side].d, p[side].bore]).toEqual([k, form.segments[k].d, 0]);
        near(p[side].stress, ref.stress(x, side), 6.3);
      }
      nearPlanes(p.deflection, ref.v('vertical', x), ref.v('horizontal', x), 5.8e-3);
      nearPlanes(p.slope, ref.theta('vertical', x), ref.theta('horizontal', x), 1.1e-3);
    }
    // No deflection at a bearing: not a small number, none.
    expect(r.at(2).deflection).toEqual({ vertical: 0, horizontal: 0, both: 0 });
    expect(r.at(16).deflection).toEqual({ vertical: 0, horizontal: 0, both: 0 });
  });

  it('a position off the shaft is its end', () => {
    expect(r.at(-5).x).toBe(0);
    expect(r.at(1e9).x).toBe(23);
    expect(JSON.stringify(r.at(40))).toBe(JSON.stringify(r.at(23)));
  });
});

/* ── Across a step, by the unit-load method written out ───────────────── */

describe('shaft analysis: a stepped shaft against the integrals written out', () => {
  // 30 in between bearings at its ends, 1.5 in over the outer thirds and 2.5 in over the middle one; 1,200 lbf down at
  // the middle. M = Px/2 up to the middle; m = x/2 for a unit force there. By symmetry, twice the integral over one half:
  //   δ = 2 × [ ∫₀¹⁰ (Px/2)(x/2) dx ÷ EI₁ + ∫₁₀¹⁵ (Px/2)(x/2) dx ÷ EI₂ ] = (P/6) × [ 10³ ÷ EI₁ + (15³ − 10³) ÷ EI₂ ]
  // and the slope at a bearing is half the area of M ÷ EI:
  //   θ = (P/4) × [ 10² ÷ EI₁ + (15² − 10²) ÷ EI₂ ]
  const P = 1200;
  const form = shaft({ segments: [seg(1, 10, 1.5), seg(2, 10, 2.5), seg(3, 10, 1.5)], bearings: [0, 30], forces: [force(4, 15, P)], couples: [], nextId: 5 });
  const E = 29000 * 1000;
  const EI1 = (E * Math.PI * 1.5 ** 4) / 64;
  const EI2 = (E * Math.PI * 2.5 ** 4) / 64;
  const delta = (P / 6) * (10 ** 3 / EI1 + (15 ** 3 - 10 ** 3) / EI2);
  const theta = (P / 4) * (10 ** 2 / EI1 + (15 ** 2 - 10 ** 2) / EI2);
  const r = solved(form);

  it('the deflection under the force, and the largest: one number', () => {
    near(r.forces[0].deflection.vertical, -delta);
    near(r.forces[0].deflection.both, delta);
    expect(r.forces[0].deflection.horizontal).toBe(0);
    near(r.largest.deflection.value, delta);
    near(r.largest.deflection.x!, 15);
    near(r.at(15).deflection.vertical, -delta);
    // A shaft of the smaller diameter all along would go down by PL³/48EI₁, and one of the larger by PL³/48EI₂: this one is between the two.
    expect(delta).toBeLessThan((P * 30 ** 3) / (48 * EI1));
    expect(delta).toBeGreaterThan((P * 30 ** 3) / (48 * EI2));
  });

  it('the slope at each bearing: clockwise at the left one, the same angle the other way at the right one', () => {
    nearPlanes(r.bearings[0].slope, -theta, 0);
    nearPlanes(r.bearings[1].slope, theta, 0);
    near(r.largest.slope.value, theta);
    expect(r.largest.slope.x).toBe(0);
  });

  it('the stress at a shoulder is two values — the same moment over two sections — and the small side is the segment’s largest', () => {
    const M = (P / 2) * 10;
    const at = r.at(10);
    expect(at.jumps).toEqual({ shear: false, moment: false, section: true, stress: true });
    expect([at.left.d, at.right.d, at.left.segment, at.right.segment]).toEqual([1.5, 2.5, 0, 1]);
    near(at.left.moment.both, M);
    near(at.right.moment.both, M);
    near(at.left.stress, M / ((Math.PI * 1.5 ** 3) / 32) / 1000);
    near(at.right.stress, M / ((Math.PI * 2.5 ** 3) / 32) / 1000);
    // The outer thirds: 6,000 lbf·in at the shoulder over the 1.5 in section. The middle: 9,000 lbf·in over the 2.5 in one — less.
    near(r.segments[0].stress.value, M / ((Math.PI * 1.5 ** 3) / 32) / 1000);
    expect(r.segments[0].stress.x).toBe(10);
    near(r.segments[1].stress.value, ((P / 2) * 15) / ((Math.PI * 2.5 ** 3) / 32) / 1000);
    expect(r.segments[1].stress.x).toBe(15);
    expect(r.segments[2].stress.x).toBe(20);
    // The largest moment is at the middle; the largest stress is at a shoulder, and it is the FIRST of the two that are as large.
    expect(r.largest.moment.x).toBe(15);
    expect([r.largest.stress.x, r.largest.stress.segment]).toEqual([10, 0]);
    near(r.largest.stress.value, r.segments[0].stress.value);
  });

  it('the same shoulder at both ends, and the second a last figure above the first by rounding: the largest stress is named at the first', () => {
    // 17.1 in, the same about its middle: 1.5 in journals of 5 in, a 2.5 in body of 7.1 in; bearings 2 in from each end;
    // a force at the middle, in both planes. One stress at the two shoulders, 5 in and 12.1 in.
    const even = shaft({ segments: [seg(1, 5, 1.5), seg(2, 7.1, 2.5), seg(3, 5, 1.5)], bearings: [2, 15.1], forces: [force(4, 8.55, 1200, 400)], couples: [], nextId: 5 });
    const twin = solved(even);
    const M = Math.hypot(600, 200) * 3;
    near(twin.segments[0].stress.value, M / ((Math.PI * 1.5 ** 3) / 32) / 1000);
    near(twin.segments[2].stress.value, twin.segments[0].stress.value);
    expect([twin.largest.stress.segment, twin.largest.stress.x]).toEqual([0, 5]);
    // THE PREMISE, asked of the engine: read from the other end of the shaft, the second shoulder's stress comes back a
    // last figure HIGHER (were it ever not so, this test would hold nothing: another such shaft is then to be found).
    const sol = solveShaft(toEngine(even).model) as ShaftSolution;
    expect(sol.segments[2].sigma!.value).toBeGreaterThan(sol.segments[0].sigma!.value);
    near(sol.segments[2].sigma!.value, sol.segments[0].sigma!.value, sol.segments[0].sigma!.value, 1e-14);
  });

  it('a couple standing ON a shoulder: each segment has the moment of its own side of it, and its own stress', () => {
    // 20 in between bearings at its ends, 1.5 in up to 8 in and 2 in after; 5,000 lbf·in counter-clockwise at the shoulder.
    // The bearings hold it with C/L: the moment climbs to 0.4 C at the shoulder, drops by C, and climbs back to nothing.
    const C = 5000;
    const turned = solved(shaft({ segments: [seg(1, 8, 1.5), seg(2, 12, 2)], bearings: [0, 20], forces: [], couples: [couple(3, 8, C)], nextId: 4 }));
    near(turned.segments[0].moment.value, 0.4 * C);
    near(turned.segments[1].moment.value, 0.6 * C);
    expect([turned.segments[0].moment.x, turned.segments[1].moment.x]).toEqual([8, 8]);
    near(turned.segments[0].stress.value, (0.4 * C) / ((Math.PI * 1.5 ** 3) / 32) / 1000);
    near(turned.segments[1].stress.value, (0.6 * C) / ((Math.PI * 2 ** 3) / 32) / 1000);
    // The larger moment is in the thicker segment, and the larger stress in the thinner one.
    expect([turned.largest.moment.x, turned.largest.stress.segment]).toEqual([8, 0]);
    near(turned.largest.moment.value, 0.6 * C);
    const at = turned.at(8);
    expect(at.jumps).toEqual({ shear: false, moment: true, section: true, stress: true });
    near(at.left.moment.vertical, 0.4 * C);
    near(at.right.moment.vertical, -0.6 * C);
    near(at.left.stress, turned.segments[0].stress.value);
    near(at.right.stress, turned.segments[1].stress.value);
  });

  it('two segments of one diameter are no shoulder: one section, one stress', () => {
    const plain = solved(shaft({ segments: [seg(1, 10, 2), seg(2, 20, 2)], bearings: [0, 30], forces: [force(3, 15, P)], couples: [], nextId: 4 }));
    const at = plain.at(10);
    expect([at.left.segment, at.right.segment]).toEqual([0, 1]);
    expect(at.jumps).toEqual({ shear: false, moment: false, section: false, stress: false });
    expect(at.left.stress).toBe(at.right.stress);
  });
});

/* ── A hollow segment, the shaft's own weight, the other units ────────── */

describe('shaft analysis: a hollow shaft', () => {
  // A tube of 3 in with a 2 in bore, 40 in between bearings at its ends, 2,000 lbf at the middle.
  const form = shaft({ segments: [seg(1, 40, 3, 2)], bearings: [0, 40], forces: [force(2, 20, 2000)], couples: [], nextId: 3 });
  const I = (Math.PI * (3 ** 4 - 2 ** 4)) / 64;
  const r = solved(form);

  it('bends with the stiffness of the metal that is there: PL³/48EI with I = π(D⁴ − d⁴)/64', () => {
    near(r.largest.deflection.value, (2000 * 40 ** 3) / (48 * 29000 * 1000 * I));
    near(r.bearings[0].slope.both, (2000 * 40 ** 2) / (16 * 29000 * 1000 * I));
    // Bored out, the bar is softer than the solid one by the fourth power of the bore over that of the diameter.
    const solid = solved({ ...form, segments: [seg(1, 40, 3)] });
    near(r.largest.deflection.value / solid.largest.deflection.value, 3 ** 4 / (3 ** 4 - 2 ** 4));
  });

  it('its stress is the moment over I ÷ the OUTER radius', () => {
    near(r.largest.moment.value, (2000 * 40) / 4);
    near(r.largest.stress.value, (2000 * 40) / 4 / (I / 1.5) / 1000);
    near(r.segments[0].section.Z, I / 1.5);
    near(r.segments[0].section.A, (Math.PI * (9 - 4)) / 4);
    expect([r.segments[0].d, r.segments[0].bore]).toEqual([3, 2]);
    expect([r.at(7).left.d, r.at(7).left.bore]).toEqual([3, 2]);
  });

  it('a hollow segment beside a solid one of the same diameter is a step: the section changes, and the stress with it', () => {
    const stepped = solved(shaft({ segments: [seg(1, 20, 3), seg(2, 20, 3, 2)], bearings: [0, 40], forces: [force(3, 25, 2000)], couples: [], nextId: 4 }));
    const at = stepped.at(20);
    expect(at.jumps).toEqual({ shear: false, moment: false, section: true, stress: true });
    near(at.right.stress / at.left.stress, 3 ** 4 / (3 ** 4 - 2 ** 4));
    const ref = reference(shaft({ segments: [seg(1, 20, 3), seg(2, 20, 3, 2)], bearings: [0, 40], forces: [force(3, 25, 2000)], couples: [], nextId: 4 }));
    near(stepped.forces[0].deflection.vertical, ref.v('vertical', 25));
    near(stepped.bearings[1].slope.vertical, ref.theta('vertical', 40));
  });
});

describe('shaft analysis: the shaft’s own weight', () => {
  // A 2 in steel bar, 60 in between bearings at its ends, and nothing on it but itself.
  const form = shaft({ segments: [seg(1, 60, 2)], bearings: [0, 60], forces: [], couples: [], ownWeight: true, nextId: 2 });
  const w = 0.2836 * Math.PI; // lb/in³ × π·2²/4 in²: lbf per inch
  const EI = (29000 * 1000 * Math.PI * 2 ** 4) / 64;
  const r = solved(form);

  it('is a uniform load in the vertical plane: wL/2 on each bearing, wL²/8, 5wL⁴/384EI, wL³/24EI', () => {
    near(r.ownWeight!, w * 60);
    expect(printed(r.ownWeight!)).toBe('53.46');
    near(r.segments[0].w!, w);
    // 10.69 lb per foot, as the tables of bar stock have a 2 in round.
    expect(printed(r.segments[0].w! * 12)).toBe('10.69');
    nearPlanes(r.bearings[0].reaction, (w * 60) / 2, 0);
    nearPlanes(r.bearings[1].reaction, (w * 60) / 2, 0);
    near(r.largest.moment.value, (w * 60 ** 2) / 8);
    near(r.largest.moment.x!, 30);
    near(r.largest.deflection.value, (5 * w * 60 ** 4) / (384 * EI));
    near(r.largest.deflection.x!, 30);
    near(r.bearings[0].slope.vertical, (-w * 60 ** 3) / (24 * EI));
    near(r.bearings[1].slope.vertical, (w * 60 ** 3) / (24 * EI));
    near(r.loadScale, w * 60);
    expect(r.loaded).toBe(true);
  });

  it('and in the vertical plane only: the horizontal one has nothing in it', () => {
    expect(r.balance.horizontal).toEqual({ reactions: 0, load: 0, ok: true });
    near(r.balance.vertical.load, w * 60);
    near(r.balance.vertical.reactions, w * 60);
    expect(r.balance.vertical.ok).toBe(true);
    expect(r.bearings[0].reaction.horizontal).toBe(0);
    expect(r.views.horizontal.peaks).toEqual({ V: { max: { value: 0, x: null }, min: { value: 0, x: null } }, M: { max: { value: 0, x: null }, min: { value: 0, x: null } }, D: { max: { value: 0, x: null }, min: { value: 0, x: null } } });
    expect(r.views.horizontal.diagrams.D.points.every((p) => p.y === 0)).toBe(true);
  });

  it('left out, it is not a load and has no number: a shaft with nothing on it', () => {
    const light = solved({ ...form, ownWeight: false });
    expect([light.ownWeight, light.segments[0].w, light.loaded]).toEqual([null, null, false]);
  });

  it('on the example it is 14.66 lbf beside the 1,400 lbf the shaft carries, each segment by its own section — and every result moves by that little', () => {
    const heavy = shaft({ ownWeight: true });
    const [heavier, without] = [solved(heavy), solved(defaultShaft())];
    const ref = reference(heavy);
    const weights = [1.5, 2, 1.5, 1.25].map((d) => (0.2836 * Math.PI * d * d) / 4);
    heavier.segments.forEach((s, i) => near(s.w!, weights[i]));
    near(heavier.ownWeight!, weights[0] * 4 + weights[1] * 10 + weights[2] * 4 + weights[3] * 5);
    expect(printed(heavier.ownWeight!)).toBe('14.66');
    near(heavier.balance.vertical.load, 1400 + heavier.ownWeight!);
    near(heavier.balance.horizontal.load, 360);
    nearPlanes(heavier.bearings[0].reaction, ref.reactions('vertical')[0], ref.reactions('horizontal')[0]);
    nearPlanes(heavier.bearings[1].reaction, ref.reactions('vertical')[1], ref.reactions('horizontal')[1]);
    for (const x of [0, 4, 9, 12.5, 16, 18, 23]) {
      const p = heavier.at(x);
      nearPlanes(p.right.moment, ref.M('vertical', x, 'right'), ref.M('horizontal', x, 'right'), 2800);
      nearPlanes(p.deflection, ref.v('vertical', x), ref.v('horizontal', x), 5.8e-3);
      nearPlanes(p.slope, ref.theta('vertical', x), ref.theta('horizontal', x), 1.1e-3);
    }
    expect(heavier.largest.deflection.value).toBeGreaterThan(without.largest.deflection.value);
    expect(heavier.largest.deflection.value).toBeLessThan(without.largest.deflection.value * 1.02);
  });

  it('in millimetres: a 50 mm steel bar weighs 15.41 kg per metre — 0.1512 N per millimetre — and bends under it by 5wL⁴/384EI', () => {
    const metric = shaft({ units: 'si', segments: [seg(1, 2000, 50)], bearings: [0, 2000], forces: [], couples: [], E: 200000, density: 7850, ownWeight: true, nextId: 2 });
    const s = solved(metric);
    const A = (Math.PI * 50 * 50) / 4;
    // 7,850 kg/m³ over 10⁹ mm³ to the cubic metre, times the area in mm²: kilograms per millimetre. Times g: newtons per millimetre.
    const perMm = (7850 / 1e9) * A * 9.80665;
    near(s.segments[0].w!, perMm);
    expect(printed(s.segments[0].w!)).toBe('0.1512');
    expect(printed(((7850 / 1e9) * A * 1000))).toBe('15.41');
    near(s.ownWeight!, perMm * 2000);
    const EI = (200000 * Math.PI * 50 ** 4) / 64;
    near(s.largest.deflection.value, (5 * perMm * 2000 ** 4) / (384 * EI));
    // N/mm × mm² ÷ 8 is N·mm: a thousandth of that in N·m.
    near(s.largest.moment.value, (perMm * 2000 ** 2) / 8 / 1000);
    // …and N·mm over mm³ is N/mm², which is the megapascal shown.
    near(s.largest.stress.value, (perMm * 2000 ** 2) / 8 / ((Math.PI * 50 ** 3) / 32));
  });
});

describe('shaft analysis: millimetres and newtons', () => {
  it('says which units it is in, and what the engine’s moment and stress are multiplied by to be shown', () => {
    const us = analyseShaft(defaultShaft());
    const si = analyseShaft(convertShaft(defaultShaft(), 'si'));
    expect(us.units).toBe('us');
    expect(si.units).toBe('si');
    // lbf·in is shown as it is, and lbf/in² as ksi; N·mm as N·m, and N/mm² as the MPa it is.
    expect(us.toShown).toEqual({ force: 1, length: 1, moment: 1, stress: 1 / 1000, deflection: 1, slope: 1 });
    expect(si.toShown).toEqual({ force: 1, length: 1, moment: 1 / 1000, stress: 1, deflection: 1, slope: 1 });
    expect(si.L).toBeCloseTo(23 * 25.4, 6);
  });

  it('the example switched to SI is solved in SI: every number against the yardstick in mm, N, N·m and MPa', () => {
    const form = convertShaft(defaultShaft(), 'si');
    const r = solved(form);
    const ref = reference(form);
    r.bearings.forEach((b, i) => {
      nearPlanes(b.reaction, ref.reactions('vertical')[i], ref.reactions('horizontal')[i]);
      nearPlanes(b.slope, ref.theta('vertical', b.x), ref.theta('horizontal', b.x));
    });
    for (const x of ref.cuts) {
      const p = r.at(x);
      for (const side of SIDES) {
        nearPlanes(p[side].shear, ref.V('vertical', x, side), ref.V('horizontal', x, side), 6300);
        nearPlanes(p[side].moment, ref.M('vertical', x, side), ref.M('horizontal', x, side), 320);
        near(p[side].stress, ref.stress(x, side), 44);
      }
      nearPlanes(p.deflection, ref.v('vertical', x), ref.v('horizontal', x), 0.15);
      nearPlanes(p.slope, ref.theta('vertical', x), ref.theta('horizontal', x), 1.1e-3);
    }
    // The same shaft, near enough — each number rounded as a field shows it, and the listed steel 200,000 MPa. By hand:
    // 4,448.2 N and 1,779.29 N down, 177.8 mm and 482.6 mm from the left bearing, on a span of 355.6 mm; 1,601.36 N sideways at midspan.
    expect(form.forces.map((f) => [f.x, f.v, f.h])).toEqual([
      [228.6, 4448.2, 1601.36],
      [533.4, 1779.29, 0],
    ]);
    expect(form.bearings).toEqual([50.8, 406.4]);
    const R2 = (4448.2 * 177.8 + 1779.29 * 482.6) / 355.6;
    nearPlanes(r.bearings[1].reaction, R2, 1601.36 / 2);
    nearPlanes(r.bearings[0].reaction, 4448.2 + 1779.29 - R2, 1601.36 / 2);
    expect([printed(r.bearings[0].reaction.both), printed(r.bearings[1].reaction.both)]).toEqual(['1,779', '4,707']);
    // The moment at the gear in N·m: the left reaction × 177.8 mm, over a thousand; and the stress at the last shoulder in MPa: 1,779.29 N × 76.2 mm over π·31.75³/32 mm³.
    nearPlanes(r.at(228.6).left.moment, ((4448.2 + 1779.29 - R2) * 177.8) / 1000, ((1601.36 / 2) * 177.8) / 1000);
    near(r.largest.stress.value, (1779.29 * 76.2) / ((Math.PI * 31.75 ** 3) / 32));
    expect([printed(r.largest.moment.value), printed(r.largest.stress.value)]).toEqual(['316.3', '43.15']);
  });

  it('the very same shaft in the other units — every length, force, modulus converted exactly — gives the very same answers, converted', () => {
    // The factors written out below are the exact ones, and the form's own.
    [
      [SHAFT_US_TO_SI.length, 25.4],
      [SHAFT_US_TO_SI.force, 4.4482216152605],
      [SHAFT_US_TO_SI.moment, 0.1129848290276167],
      [SHAFT_US_TO_SI.E, 6.894757293168361],
    ].forEach(([has, exact]) => near(has, exact, exact, 1e-15));
    const us = defaultShaft();
    const si: ShaftForm = {
      ...us,
      units: 'si',
      segments: us.segments.map((s) => ({ ...s, L: s.L * 25.4, d: s.d * 25.4, bore: s.bore * 25.4 })),
      bearings: [us.bearings[0] * 25.4, us.bearings[1] * 25.4],
      forces: us.forces.map((f) => ({ ...f, x: f.x * 25.4, v: f.v * 4.4482216152605, h: f.h * 4.4482216152605 })),
      material: 'custom',
      E: us.E * 6.894757293168361,
    };
    const [a, b] = [solved(us), solved(si)];
    a.bearings.forEach((bearing, i) => {
      nearPlanes(b.bearings[i].reaction, bearing.reaction.vertical * 4.4482216152605, bearing.reaction.horizontal * 4.4482216152605);
      nearPlanes(b.bearings[i].slope, bearing.slope.vertical, bearing.slope.horizontal);
      near(b.bearings[i].x, bearing.x * 25.4);
    });
    a.segments.forEach((s, i) => {
      // 1 lbf·in is 0.112984829 N·m; 1 ksi is 6.894757293 MPa.
      near(b.segments[i].moment.value, s.moment.value * 0.1129848290276167);
      near(b.segments[i].stress.value, s.stress.value * 6.894757293168361);
      near(b.segments[i].moment.x!, s.moment.x! * 25.4);
      near(b.segments[i].deflection.value, s.deflection.value * 25.4);
    });
    a.forces.forEach((f, i) => {
      nearPlanes(b.forces[i].deflection, f.deflection.vertical * 25.4, f.deflection.horizontal * 25.4);
      nearPlanes(b.forces[i].slope, f.slope.vertical, f.slope.horizontal, 1e-3);
    });
    near(b.largest.moment.value, a.largest.moment.value * 0.1129848290276167);
    near(b.largest.stress.value, a.largest.stress.value * 6.894757293168361);
    near(b.largest.deflection.value, a.largest.deflection.value * 25.4);
    near(b.largest.slope.value, a.largest.slope.value);
    near(b.largest.shear.value, a.largest.shear.value * 4.4482216152605);
    near(b.floors.F, a.floors.F * 4.4482216152605);
    near(b.floors.M, a.floors.M * 0.1129848290276167);
    near(b.floors.v, a.floors.v * 25.4);
    near(b.floors.theta, a.floors.theta);
  });

  it('a couple typed in N·m is a couple in N·m: 150 N·m at midspan of a 600 mm shaft, ±75 N·m either side of it and 250 N on each bearing', () => {
    const form = shaft({ units: 'si', segments: [seg(1, 600, 40)], bearings: [0, 600], forces: [], couples: [couple(2, 300, 150)], E: 200000, density: 7850, nextId: 3 });
    const r = solved(form);
    // A counter-clockwise couple is held by C/L up at the left bearing and C/L down at the right one.
    nearPlanes(r.bearings[0].reaction, 150000 / 600, 0);
    nearPlanes(r.bearings[1].reaction, -150000 / 600, 0);
    const at = r.at(300);
    expect(at.jumps).toEqual({ shear: false, moment: true, section: false, stress: false });
    near(at.left.moment.vertical, 75);
    near(at.right.moment.vertical, -75);
    // The same size on both sides: one stress, 75 N·m over π·40³/32 mm³.
    near(at.left.stress, 75000 / ((Math.PI * 40 ** 3) / 32));
    near(at.right.stress, at.left.stress);
    near(r.largest.moment.value, 75);
    near(r.loadScale, 150000 / 600);
    expect(r.balance.vertical).toEqual({ reactions: 0, load: 0, ok: true });
    // The shaft turns WITH the couple under it, by CL/12EI, and the other way at each bearing, by CL/24EI; under the couple it does not move.
    const EI = (200000 * Math.PI * 40 ** 4) / 64;
    near(at.slope.vertical, (150000 * 600) / (12 * EI));
    near(r.bearings[0].slope.vertical, (-150000 * 600) / (24 * EI));
    near(r.bearings[1].slope.vertical, (-150000 * 600) / (24 * EI));
    expect(at.deflection.vertical).toBe(0);
  });
});

/* ── The same shaft after the units are switched ──────────────────────── */

describe('shaft analysis: a shaft whose bearing or load stands on an end of a segment, after the units are switched', () => {
  // A length is converted to the eight figures a field shows, each on its own (model.ts, `tidyLength`): the lengths then
  // add up a rounding away from the converted place of what stood on their end. The page answered "This position is off
  // the shaft" to a shaft it had just solved, and gave a segment the moment of the far side of a shoulder.
  const lbf = 4.4482216152605;
  const [inch, lbfin, ksi] = [25.4, 0.1129848290276167, 6.894757293168361];
  const metric = (over: Partial<ShaftForm>): ShaftForm => shaft({ units: 'si', material: 'steel', E: 200000, density: 7850, couples: [], ...over });

  it('120 + 300 + 80 mm on a bearing at each end, 1,000 N at the middle: solved in inches too — 112.4 lbf on each', () => {
    const si = metric({ segments: [seg(1, 120, 40), seg(2, 300, 50), seg(3, 80, 40)], bearings: [0, 500], forces: [force(4, 250, 1000)], nextId: 5 });
    const us = convertShaft(si, 'us');
    // The bearing is held past the sum of the lengths, and is on the end of the shaft all the same.
    expect(us.bearings[1]).toBeGreaterThan(us.segments.reduce((sum, s) => sum + s.L, 0));
    const [a, b] = [solved(si), solved(us)];
    nearPlanes(a.bearings[1].reaction, 500, 0);
    // (224.81 lbf is what the field holds for 1,000 N: half of it on each bearing.)
    expect(us.forces[0].v).toBe(224.81);
    nearPlanes(b.bearings[0].reaction, 112.405, 0, 112.405, 1e-7);
    nearPlanes(b.bearings[1].reaction, 112.405, 0, 112.405, 1e-7);
    expect(printed(b.bearings[1].reaction.both)).toBe('112.4');
    expect(b.bearings[1].x).toBe(b.L);
    near(b.L, 500 / inch, 500 / inch, 1e-7);
    // Every segment's largest moment and stress: the metric ones, in lbf·in and ksi (to the six figures the force was converted to).
    a.segments.forEach((s, i) => {
      near(b.segments[i].moment.value, (s.moment.value / lbfin) * ((224.81 * lbf) / 1000), s.moment.value / lbfin, 1e-6);
      near(b.segments[i].stress.value, (s.stress.value / ksi) * ((224.81 * lbf) / 1000), s.stress.value / ksi, 1e-6);
    });
    // And the drawing has its two bearings, each with what it carries.
    expect(analyseShaft(us).drawings.vertical.bearings.map((p) => [p.x, printed(p.reaction!)])).toEqual([[0, '112.4'], [b.L, '112.4']]);
    // There and back: the shaft that was typed.
    expect(convertShaft(us, 'si')).toEqual(si);
  });

  it('an applied moment ON a shoulder: each segment keeps the moment of its own side of it, in either system', () => {
    // 250 × 30, 105 × 50, 155 × 20, 250 × 25, 188 × 35 mm on bearings at 95 and 853 mm; 2,676 N down and 1,490 N sideways at
    // 304 mm; 418 N·m clockwise at 510 mm, the shoulder between the third segment and the fourth. By hand, the vertical
    // plane: the right bearing carries (2,676 × 209 + 418,000) ÷ 758 = 1,289.3 N and the left one 1,386.7 N; at the
    // shoulder, from the left, 1,386.7 × 415 − 2,676 × 206 = 24,227 N·mm, and 418,000 more past the applied moment. The
    // horizontal plane: 1,490 × 209 ÷ 758 = 410.83 N on the right bearing, which is 410.83 × 343 = 140,915 N·mm there.
    // Together: 143.0 N·m on the third segment's side of the shoulder, 464.1 N·m on the fourth's.
    const si = metric({ segments: [seg(1, 250, 30), seg(2, 105, 50), seg(3, 155, 20), seg(4, 250, 25), seg(5, 188, 35)], bearings: [95, 853], forces: [force(6, 304, 2676, 1490)], couples: [couple(7, 510, 418, 0, 'cw')], nextId: 8 });
    const a = solved(si);
    const Rb = (2676 * 209 + 418000) / 758;
    const [before, after] = [Math.hypot((2676 - Rb) * 415 - 2676 * 206, 410.83113 * 343) / 1000, Math.hypot((2676 - Rb) * 415 - 2676 * 206 + 418000, 410.83113 * 343) / 1000];
    near(before, 142.98, 142.98, 1e-4);
    near(after, 464.14, 464.14, 1e-4);
    const at = a.at(510);
    near(at.left.moment.both, before, before, 1e-7);
    near(at.right.moment.both, after, after, 1e-7);
    // The third segment's largest is at its other end, 355 mm: 303.4 N·m, 386.3 MPa on its 20 mm — the largest stress of the shaft.
    expect([printed(a.segments[2].moment.value), a.segments[2].moment.x, printed(a.segments[2].stress.value)]).toEqual(['303.4', 355, '386.3']);
    expect([printed(a.segments[3].moment.value), a.segments[3].moment.x]).toEqual(['464.1', 510]);
    expect([printed(a.largest.stress.value), a.largest.stress.segment]).toEqual(['386.3', 2]);

    const us = convertShaft(si, 'us');
    // The applied moment is held a hair INSIDE the third segment: 20.07874 in, where the lengths add up to 20.0787403.
    expect(us.couples[0].x).toBe(20.07874);
    expect(us.couples[0].x).toBeLessThan(us.segments.slice(0, 3).reduce((sum, s) => sum + s.L, 0));
    const b = solved(us);
    // The same shaft: every segment's largest moment and its stress, and where — 2,686 lbf·in and 56.03 ksi in the third, not the 4,108 lbf·in of the far side of the shoulder.
    a.segments.forEach((s, i) => {
      near(b.segments[i].moment.value, s.moment.value / lbfin, s.moment.value / lbfin, 1e-5);
      near(b.segments[i].stress.value, s.stress.value / ksi, s.stress.value / ksi, 1e-5);
      near(b.segments[i].moment.x!, s.moment.x! / inch, a.L / inch, 1e-7);
    });
    expect([printed(b.segments[2].moment.value), printed(b.segments[2].stress.value)]).toEqual(['2,686', '56.03']);
    expect([printed(b.segments[3].moment.value), b.segments[3].moment.x]).toEqual(['4,108', b.segments[3].from]);
    expect([printed(b.largest.stress.value), b.largest.stress.segment]).toEqual(['56.03', 2]);
    // The values at the shoulder are two, one for each segment, as in millimetres.
    const there = b.at(b.segments[3].from);
    expect(there.jumps).toMatchObject({ moment: true, section: true });
    near(there.left.moment.both, before / lbfin, before / lbfin, 1e-5);
    near(there.right.moment.both, after / lbfin, after / lbfin, 1e-5);
    // And back in millimetres it is the shaft that was typed.
    expect(convertShaft(us, 'si')).toEqual(si);
  });

  it('a force on the end of the shaft is read where the engine has it: on that end', () => {
    const si = metric({ segments: [seg(1, 100, 40), seg(2, 250, 50), seg(3, 100, 40), seg(4, 120, 30)], bearings: [50, 400], forces: [force(5, 225, 4500, 1600), force(6, 570, 1800)], nextId: 7 });
    const us = convertShaft(si, 'us');
    const [a, b] = [solved(si), solved(us)];
    expect(us.forces[1].x).not.toBe(b.L);
    expect(b.forces.map((f) => f.x)).toEqual([us.forces[0].x, b.L]);
    near(b.forces[1].deflection.both, a.forces[1].deflection.both / inch, a.forces[1].deflection.both / inch, 1e-3);
    expect(analyseShaft(us).drawings.vertical.forces.map((p) => p.x)).toEqual([us.forces[0].x, b.L]);
  });

  it('a shaft in sixty-fourths of an inch read from its link, switched and switched back: still solved, with the same reactions', () => {
    // 179 27/64 in in seven segments, a bearing on each end. Its link holds the second bearing at 179.42188, the eight
    // figures of 179.421875; there and back the lengths add up to 179.421871 and the bearing is held at 179.4219 —
    // 1.6 × 10⁻⁷ of the shaft past its end, where one switch of a shaft as typed leaves 1.2 × 10⁻⁷ at the most.
    const typed = shaft({ segments: [17.234375, 31.359375, 10.921875, 39.03125, 21.984375, 32.46875, 26.421875].map((L, i) => seg(i + 1, L, 2)), bearings: [0, 179.421875], forces: [force(9, 59.8, 500)], nextId: 10 });
    const link = decodeShaft(encodeShaft(typed))!;
    expect(link.bearings[1]).toBe(179.42188);
    const back = convertShaft(convertShaft(link, 'si'), 'us');
    const L = back.segments.reduce((sum, s) => sum + s.L, 0);
    expect(back.bearings[1]).toBe(179.4219);
    expect((back.bearings[1] - L) / L).toBeGreaterThan(1.6e-7);
    // As typed, as its link holds it, and there and back: one shaft, 333.4 lbf and 166.6 lbf on its bearings.
    const [a, b, c] = [typed, link, back].map((f) => solved(f).bearings.map((p) => p.reaction.vertical));
    expect([a, b, c].map((r) => r.map(printed))).toEqual([['333.4', '166.6'], ['333.4', '166.6'], ['333.4', '166.6']]);
    near(c[1], a[1], 500, 1e-6);
  });

  it('further from an end than a rounding, a place is off the shaft as before — past the end, and before the start', () => {
    // 145 + 225 mm on a bearing at each end, 2,000 N down and 800 N sideways on the shoulder. In inches the lengths are
    // 5.7086614 and 8.858268, which add up to 14.5669294, and the bearing at 370 mm is held at 14.56693: solved, on the end.
    const us = convertShaft(metric({ segments: [seg(1, 145, 40), seg(2, 225, 50)], bearings: [0, 370], forces: [force(3, 145, 2000, 800)], nextId: 4 }), 'us');
    const L = 5.7086614 + 8.858268;
    expect(us.bearings).toEqual([0, 14.56693]);
    expect(us.bearings[1]).toBeGreaterThan(L * (1 + 1e-9));
    const b = solved(us);
    expect(b.bearings.map((p) => [p.index, p.x])).toEqual([[0, 0], [1, L]]);
    // By hand, in inches and pounds: 449.62 lbf and 179.847 lbf, 5.7086614 in along 14.5669294 in.
    nearPlanes(b.bearings[1].reaction, (449.62 * 5.7086614) / L, (179.847 * 5.7086614) / L);
    // What `SEAT` takes for an end is four ten-millionths of the shaft's length, either side of it, and no more: a place
    // further off is said to be off the shaft, on its row — a bearing, a force and an applied moment alike.
    expect(SEAT).toBe(4e-7);
    expect(faults(analyseShaft({ ...us, bearings: [0, L * (1 + 3.9e-7)] }).issues)).toEqual([]);
    expect(faults(analyseShaft({ ...us, bearings: [0, L * (1 + 4.1e-7)] }).issues)).toEqual([['outside', { list: 'bearings', index: 1 }]]);
    expect(faults(analyseShaft({ ...us, bearings: [0, L * (1 + 1e-6)] }).issues)).toEqual([['outside', { list: 'bearings', index: 1 }]]);
    expect(faults(analyseShaft({ ...us, bearings: [-3.9e-7 * L, L] }).issues)).toEqual([]);
    expect(faults(analyseShaft({ ...us, bearings: [-4.1e-7 * L, L] }).issues)).toEqual([['outside', { list: 'bearings', index: 0 }]]);
    expect(faults(analyseShaft({ ...us, forces: [force(3, L * (1 + 4.1e-7), 10)] }).issues)).toEqual([['outside', { list: 'forces', id: 3 }]]);
    expect(faults(analyseShaft({ ...us, couples: [couple(5, L * (1 + 4.1e-7), 10)] }).issues)).toEqual([['outside', { list: 'couples', id: 5 }]]);
  });
});

/* ── Both sides of a place ────────────────────────────────────────────── */

describe('shaft analysis: both sides of a force, of a couple, of a shoulder, of a bearing', () => {
  // Three diameters on bearings at 5 in and 25 in; a gear at 12 in with a force in each plane AND a couple in each plane
  // (an axial force at its radius); a second couple alone at 20 in; a force on the shoulder at 18 in.
  const form = shaft({
    segments: [seg(1, 8, 1.5), seg(2, 10, 2.25, 1), seg(3, 12, 1.75)],
    bearings: [5, 25],
    forces: [force(4, 12, 800, 300, 'down', 'away'), force(5, 18, 250, 0, 'up')],
    couples: [couple(6, 12, 900, 400, 'cw', 'ccw'), couple(7, 20, 0, 650, 'ccw', 'cw')],
    nextId: 8,
  });
  const r = solved(form);
  const ref = reference(form);

  it('every place: each side is the yardstick’s, in both planes', () => {
    for (const x of ref.cuts) {
      const p = r.at(x);
      for (const side of SIDES) {
        nearPlanes(p[side].shear, ref.V('vertical', x, side), ref.V('horizontal', x, side), 1500);
        nearPlanes(p[side].moment, ref.M('vertical', x, side), ref.M('horizontal', x, side), 9000);
        near(p[side].stress, ref.stress(x, side), 10);
        expect(p[side].segment).toBe(ref.segment(x, side));
      }
      nearPlanes(p.deflection, ref.v('vertical', x), ref.v('horizontal', x), 0.01);
      nearPlanes(p.slope, ref.theta('vertical', x), ref.theta('horizontal', x), 0.002);
    }
  });

  it('what is two values is said to be, and what is one is not', () => {
    const jumps = (x: number) => r.at(x).jumps;
    // The gear: its force jumps the shear, its couple the moment — and the stress with the moment.
    expect(jumps(12)).toEqual({ shear: true, moment: true, section: false, stress: true });
    // A couple alone, in the horizontal plane only.
    expect(jumps(20)).toEqual({ shear: false, moment: true, section: false, stress: true });
    // A force on a shoulder: the shear, the section, and the stress of one moment over two sections.
    expect(jumps(18)).toEqual({ shear: true, moment: false, section: true, stress: true });
    // A shoulder with nothing on it.
    expect(jumps(8)).toEqual({ shear: false, moment: false, section: true, stress: true });
    // A bearing: its reaction jumps the shear.
    expect(jumps(5)).toEqual({ shear: true, moment: false, section: false, stress: false });
    expect(jumps(25)).toEqual({ shear: true, moment: false, section: false, stress: false });
    // Between places, and at the ends with nothing on them: one value of everything.
    for (const x of [0, 3, 10, 15, 19, 22, 28, 30]) expect(jumps(x)).toEqual({ shear: false, moment: false, section: false, stress: false });
  });

  it('the jump is the load: the shear by the force, the moment by the couple, each in its own plane and its own unit', () => {
    const gear = r.at(12);
    // 800 lbf down lowers the shear by 800; 300 lbf AWAY from the viewer raises the horizontal one by 300.
    near(gear.right.shear.vertical - gear.left.shear.vertical, -800, 800);
    near(gear.right.shear.horizontal - gear.left.shear.horizontal, 300, 800);
    // A clockwise couple of 900 lbf·in raises the moment by 900; a counter-clockwise one of 400 lowers it by 400.
    near(gear.right.moment.vertical - gear.left.moment.vertical, 900, 9000);
    near(gear.right.moment.horizontal - gear.left.moment.horizontal, -400, 9000);
    const alone = r.at(20);
    expect(alone.right.moment.vertical).toBe(alone.left.moment.vertical);
    near(alone.right.moment.horizontal - alone.left.moment.horizontal, 650, 9000);
    // And at a bearing by its reaction.
    r.bearings.forEach((b) => {
      const p = r.at(b.x);
      near(p.right.shear.vertical - p.left.shear.vertical, b.reaction.vertical, 1500);
      near(p.right.shear.horizontal - p.left.shear.horizontal, b.reaction.horizontal, 1500);
    });
  });

  it('a segment whose largest moment is at a couple inside it has the larger of the two sides', () => {
    // The middle segment, 8 to 18 in, holds the gear and its couples.
    const s = r.segments[1];
    const sides = SIDES.map((side) => Math.hypot(ref.M('vertical', s.moment.x!, side), ref.M('horizontal', s.moment.x!, side)));
    near(s.moment.value, Math.max(...sides));
    for (let x = 8; x <= 18; x += 0.01) for (const side of SIDES) expect(Math.hypot(ref.M('vertical', x, side), ref.M('horizontal', x, side))).toBeLessThanOrEqual(s.moment.value * (1 + 1e-9));
    near(s.stress.value, s.moment.value / ref.Z[1] / 1000);
  });

  it('the stress is the engine’s own division, made here of the moment as it is printed: the two agree at every place, on both sides', () => {
    // THE EXCEPTION, with the two of the header: this file divides the moment by the section modulus itself, so that a
    // stress and the moment beside it cannot disagree — and what it gets is what the engine has (lbf/in², a thousandth of a ksi).
    const sol = solveShaft(toEngine(form).model) as ShaftSolution;
    for (const x of [...ref.cuts, 1, 6.5, 10, 15, 19, 22, 29]) for (const side of SIDES) near(r.at(x)[side].stress, sol.at(x, side).sigma! / 1000, 10, 1e-12);
    sol.segments.forEach((s, i) => near(r.segments[i].stress.value, s.sigma!.value / 1000, 10, 1e-12));
    near(r.largest.stress.value, sol.extremes.sigma!.value / 1000, 10, 1e-12);
    // And a stress is its moment over the section modulus shown, to the last figure: a row adds up as printed.
    r.segments.forEach((s) => near(s.stress.value, s.moment.value / s.section.Z / 1000, s.stress.value, 1e-12));
  });

  it('a force at the very end of the shaft: nothing before it, its own size after it', () => {
    const tip = solved(shaft({ segments: [seg(1, 20, 2)], bearings: [6, 20], forces: [force(2, 0, 500)], couples: [], nextId: 3 }));
    const at = tip.at(0);
    expect(at.left.shear.vertical).toBe(0);
    near(at.right.shear.vertical, -500);
    expect(at.jumps.shear).toBe(true);
    near(tip.at(6).left.moment.vertical, -500 * 6);
  });
});

/* ── The three views ──────────────────────────────────────────────────── */

describe('shaft analysis: what each view plots', { timeout: LONG_RUN }, () => {
  // The shaft of "both sides", in SI so that a moment that was left in N·mm would show; its own weight on.
  const form = shaft({
    units: 'si',
    segments: [seg(1, 200, 40), seg(2, 250, 60, 25), seg(3, 300, 45)],
    bearings: [125, 625],
    forces: [force(4, 300, 3500, 1300, 'down', 'away'), force(5, 450, 1100, 0, 'up')],
    couples: [couple(6, 300, 100, 45, 'cw', 'ccw'), couple(7, 500, 0, 75, 'ccw', 'cw')],
    E: 200000,
    density: 7850,
    ownWeight: true,
    nextId: 8,
  });
  const a = analyseShaft(form);
  const r = a.results!;
  // THE EXCEPTION: the points of a diagram are the engine's stations, one for one — which they are is the engine's to
  // say. What each is worth is checked against the yardstick in the next test.
  const sol = solveShaft(toEngine(form).model) as ShaftSolution;

  it('each diagram passes through every station of the engine, in its order: both sides of every place', () => {
    expect(sol.ok).toBe(true);
    const pick: Record<ShaftView, (s: ShaftState) => [number, number, number]> = {
      vertical: (s) => [s.vertical.V, s.vertical.M / 1000, s.vertical.v],
      horizontal: (s) => [s.horizontal.V, s.horizontal.M / 1000, s.horizontal.v],
      both: (s) => [Math.hypot(s.vertical.V, s.horizontal.V), Math.hypot(s.vertical.M, s.horizontal.M) / 1000, Math.hypot(s.vertical.v, s.horizontal.v)],
    };
    for (const view of VIEWS) {
      const d = r.views[view].diagrams;
      for (const [k, line] of [d.V, d.M, d.D].entries()) {
        expect(line.points).toHaveLength(sol.stations.length);
        const scale = Math.max(...sol.stations.map((s) => Math.abs(pick[view](s)[k])));
        line.points.forEach((p, i) => {
          expect(p.x).toBe(sol.stations[i].x);
          near(p.y, pick[view](sol.stations[i])[k], scale, 1e-12);
        });
      }
    }
    // Two points at every place inside the shaft, and one at each end.
    const xs = r.views.both.diagrams.V.points.map((p) => p.x);
    for (const place of r.breaks) expect(xs.filter((x) => x === place)).toHaveLength(place === 0 || place === r.L ? 1 : 2);
    expect(r.breaks).toEqual(sol.breaks);
  });

  it('every point of every diagram is the yardstick’s value there: the plane’s own, signed — or the size of the two', () => {
    const ref = reference(form);
    const scaleV = Math.max(...r.views.both.diagrams.V.points.map((p) => p.y));
    const scaleM = Math.max(...r.views.both.diagrams.M.points.map((p) => p.y));
    const scaleD = Math.max(...r.views.both.diagrams.D.points.map((p) => p.y));
    const points = r.views.both.diagrams.V.points;
    points.forEach((point, i) => {
      // Two points at one place: the first is its left side, the second its right. At the ends: the side that is on the shaft.
      const x = point.x;
      const side: Side = i + 1 < points.length && points[i + 1].x === x ? 'left' : 'right';
      if (i % 3 !== 0 && !(i > 0 && points[i - 1].x === x) && side === 'right') return;
      const at: Side = x === r.L ? 'left' : side;
      const [Vv, Vh] = [ref.V('vertical', x, at), ref.V('horizontal', x, at)];
      const [Mv, Mh] = [ref.M('vertical', x, at), ref.M('horizontal', x, at)];
      const [Dv, Dh] = [ref.v('vertical', x), ref.v('horizontal', x)];
      near(r.views.vertical.diagrams.V.points[i].y, Vv, scaleV);
      near(r.views.horizontal.diagrams.V.points[i].y, Vh, scaleV);
      near(r.views.both.diagrams.V.points[i].y, Math.hypot(Vv, Vh), scaleV);
      near(r.views.vertical.diagrams.M.points[i].y, Mv, scaleM);
      near(r.views.horizontal.diagrams.M.points[i].y, Mh, scaleM);
      near(r.views.both.diagrams.M.points[i].y, Math.hypot(Mv, Mh), scaleM);
      near(r.views.vertical.diagrams.D.points[i].y, Dv, scaleD);
      near(r.views.horizontal.diagrams.D.points[i].y, Dh, scaleD);
      near(r.views.both.diagrams.D.points[i].y, Math.hypot(Dv, Dh), scaleD);
    });
    // In N·m, not N·mm: the gear's couple alone is 100 N·m, and the largest moment of this shaft is some hundreds.
    expect(scaleM).toBeGreaterThan(100);
    expect(scaleM).toBeLessThan(1000);
  });

  it('the values labelled are the highest and the lowest of the line, each where the line has it; a diagram of sizes labels its largest only', () => {
    for (const view of VIEWS) {
      const { diagrams, peaks } = r.views[view];
      for (const key of ['V', 'M', 'D'] as const) {
        const ys = diagrams[key].points.map((p) => p.y);
        const [top, bottom] = [Math.max(...ys), Math.min(...ys)];
        const scale = Math.max(Math.abs(top), Math.abs(bottom));
        // Found, not picked from the stations: never under the highest station, and past it by no more than a parabola rises between two.
        expect(peaks[key].max.value).toBeGreaterThanOrEqual(top - 1e-9 * scale);
        expect(peaks[key].max.value).toBeLessThanOrEqual(top + 1e-3 * scale);
        if (view === 'both') {
          expect(peaks[key].min).toEqual({ value: 0, x: null });
          expect(diagrams[key].marks).toEqual([{ x: peaks[key].max.x, y: peaks[key].max.value }]);
          expect(bottom).toBeGreaterThanOrEqual(0);
        } else {
          expect(peaks[key].min.value).toBeLessThanOrEqual(bottom + 1e-9 * scale);
          expect(peaks[key].min.value).toBeGreaterThanOrEqual(bottom - 1e-3 * scale);
          const marks = [peaks[key].max, peaks[key].min].filter((p) => p.x !== null).map((p) => ({ x: p.x, y: p.value }));
          expect(diagrams[key].marks).toEqual(marks);
        }
      }
    }
    // With both planes together they are the largest values of the tables, the same objects' numbers.
    expect(r.views.both.peaks.V.max).toEqual(r.largest.shear);
    expect(r.views.both.peaks.M.max).toEqual(r.largest.moment);
    expect(r.views.both.peaks.D.max).toEqual(r.largest.deflection);
  });

  it('a plane’s peaks are the yardstick’s: no point of the shaft is past them, and each is the value at the place it names', () => {
    const ref = reference(form);
    for (const plane of PLANES) {
      const { V, M, D } = r.views[plane].peaks;
      let [topM, lowM, topD, lowD, topV, lowV] = [0, 0, 0, 0, 0, 0];
      for (let x = 0; x <= r.L; x += 0.25) {
        for (const side of SIDES) {
          topM = Math.max(topM, ref.M(plane, x, side));
          lowM = Math.min(lowM, ref.M(plane, x, side));
          topV = Math.max(topV, ref.V(plane, x, side));
          lowV = Math.min(lowV, ref.V(plane, x, side));
        }
        topD = Math.max(topD, ref.v(plane, x));
        lowD = Math.min(lowD, ref.v(plane, x));
      }
      const [sM, sD, sV] = [Math.max(topM, -lowM), Math.max(topD, -lowD), Math.max(topV, -lowV)];
      expect(M.max.value).toBeGreaterThanOrEqual(topM - 1e-9 * sM);
      expect(M.min.value).toBeLessThanOrEqual(lowM + 1e-9 * sM);
      expect(D.max.value).toBeGreaterThanOrEqual(topD - 1e-9 * sD);
      expect(D.min.value).toBeLessThanOrEqual(lowD + 1e-9 * sD);
      near(V.max.value, topV, sV);
      near(V.min.value, lowV, sV);
      const side = (p: ShaftValue, of: (x: number, side: Side) => number, want: (...v: number[]) => number) => want(...SIDES.map((s) => of(p.x!, s)));
      if (M.max.x !== null) near(M.max.value, side(M.max, (x, s) => ref.M(plane, x, s), Math.max), sM);
      if (M.min.x !== null) near(M.min.value, side(M.min, (x, s) => ref.M(plane, x, s), Math.min), sM);
      if (D.max.x !== null) near(D.max.value, ref.v(plane, D.max.x), sD);
      if (D.min.x !== null) near(D.min.value, ref.v(plane, D.min.x), sD);
    }
  });

  it('the drawing of each view has what each bearing carries in it: upward, away from the viewer, or the radial load', () => {
    const [left, right] = r.bearings;
    expect(a.drawings.vertical.bearings).toEqual([
      { x: 125, reaction: left.reaction.vertical },
      { x: 625, reaction: right.reaction.vertical },
    ]);
    expect(a.drawings.horizontal.bearings).toEqual([
      { x: 125, reaction: left.reaction.horizontal },
      { x: 625, reaction: right.reaction.horizontal },
    ]);
    expect(a.drawings.both.bearings).toEqual([
      { x: 125, reaction: left.reaction.both },
      { x: 625, reaction: right.reaction.both },
    ]);
    // Each view draws its own loads: the couple of 75 N·m is in the horizontal plane only, and the weight is drawn in the vertical one.
    expect(a.drawings.vertical.couples.map((c) => c.id)).toEqual(['6']);
    expect(a.drawings.horizontal.couples.map((c) => c.id)).toEqual(['6', '7']);
    expect([a.drawings.vertical.ownWeight, a.drawings.horizontal.ownWeight, a.drawings.both.ownWeight]).toEqual([true, false, false]);
    expect(a.drawings.vertical.lengthUnit).toBe('mm');
    expect(a.drawings.both.segments.map((s) => [s.from, s.to, s.d, s.bore])).toEqual([
      [0, 200, 40, 0],
      [200, 450, 60, 25],
      [450, 750, 45, 0],
    ]);
  });

  it('the labels of a drawing are written with the page’s own thousands: a comma, or the narrow space of the Spanish page', () => {
    expect(analyseShaft(form).drawings.vertical.forces[0].label).toBe('3,500 N');
    expect(analyseShaft(form, ' ').drawings.vertical.forces[0].label).toBe('3 500 N');
    expect(analyseSafely(form, ' ').drawings.vertical.forces[0].label).toBe('3 500 N');
    // Nothing else of an analysis is text: the same numbers whatever the page.
    const figures = (x: ShaftAnalysis) => JSON.stringify({ ...x.results, at: x.results!.at(333) });
    expect(figures(analyseShaft(form, ' '))).toBe(figures(analyseShaft(form)));
  });
});

/* ── The bearings as they were typed ──────────────────────────────────── */

describe('shaft analysis: the bearings in either order', () => {
  it('typed right to left, the shaft is the same shaft: the left bearing is number 1, and it is the form’s second', () => {
    const typed = shaft({ bearings: [16, 2] });
    const [a, b] = [solved(defaultShaft()), solved(typed)];
    expect(b.bearings.map((x) => [x.number, x.index, x.x])).toEqual([
      [1, 1, 2],
      [2, 0, 16],
    ]);
    expect(b.bearings.map((x) => [x.reaction, x.slope])).toEqual(a.bearings.map((x) => [x.reaction, x.slope]));
    expect(b.largest).toEqual(a.largest);
    // And the drawing has each reaction beside its own bearing.
    const drawn = analyseShaft(typed).drawings.vertical.bearings;
    expect(drawn.map((x) => [x.x, printed(x.reaction!)])).toEqual([
      [16, '1,043'],
      [2, '357.1'],
    ]);
  });
});

/* ── What is rounding, and what is not ────────────────────────────────── */

describe('shaft analysis: a value that is rounding is zero, measured against the size of the problem', () => {
  it('the floors are a billionth of the engine’s own sizes of the problem — the stiffest segment’s, for a slope and a deflection — in the units shown', () => {
    // THE EXCEPTION: what the size of a problem is, is the engine's to say (types.ts); this holds the floors to it.
    for (const form of [defaultShaft(), convertShaft(defaultShaft(), 'si')]) {
      const sol = solveShaft(toEngine(form).model) as ShaftSolution;
      const r = solved(form);
      expect(r.loadScale).toBe(sol.loadScale);
      near(r.floors.F, 1e-9 * sol.loadScale);
      near(r.floors.M, (1e-9 * sol.loadScale * sol.L) / (form.units === 'si' ? 1000 : 1));
      near(r.floors.theta, 1e-9 * sol.slopeScale);
      near(r.floors.v, 1e-9 * sol.deflectionScale);
    }
    // By hand, for the example: 1,462.8 lbf of loads, 23 in, and the 2 in body's EI.
    const r = solved(defaultShaft());
    const stiffest = (29000 * 1000 * Math.PI * 2 ** 4) / 64;
    near(r.floors.theta, (1e-9 * (Math.hypot(1000, 360) + 400) * 23 ** 2) / stiffest);
    near(r.floors.v, (1e-9 * (Math.hypot(1000, 360) + 400) * 23 ** 3) / stiffest);
  });

  it('a plane whose loads are a billionth of the other’s is nothing: its row reads zero, and the size is the other plane’s alone', () => {
    // A million pounds down at midspan, and 0.0008 lbf sideways: the horizontal reactions are 0.0004 lbf beside a floor of 0.001.
    const form = shaft({ segments: [seg(1, 20, 2)], bearings: [0, 20], forces: [force(2, 10, 1e6, 8e-4)], couples: [], nextId: 3 });
    const r = solved(form);
    near(r.floors.F, 1e-3, 1e-3, 1e-6);
    for (const b of r.bearings) {
      expect(b.reaction.horizontal).toBe(0);
      expect(b.reaction.both).toBe(b.reaction.vertical);
      expect(b.slope.horizontal).toBe(0);
      expect(b.slope.both).toBe(Math.abs(b.slope.vertical));
    }
    expect(r.forces[0].deflection.horizontal).toBe(0);
    expect(r.forces[0].deflection.both).toBe(Math.abs(r.forces[0].deflection.vertical));
    const at = r.at(5);
    expect([at.right.shear.horizontal, at.right.moment.horizontal, at.deflection.horizontal, at.slope.horizontal]).toEqual([0, 0, 0, 0]);
    expect(at.right.moment.both).toBe(at.right.moment.vertical);
    const none = { max: { value: 0, x: null }, min: { value: 0, x: null } };
    expect(r.views.horizontal.peaks).toEqual({ V: none, M: none, D: none });
    for (const key of ['V', 'M', 'D'] as const) {
      expect(r.views.horizontal.diagrams[key].marks).toEqual([]);
      expect(r.views.horizontal.diagrams[key].points.every((p) => p.y === 0)).toBe(true);
    }
    expect(r.balance.horizontal).toEqual({ reactions: 0, load: 0, ok: true });
    // The drawing writes what the table says.
    expect(analyseShaft(form).drawings.horizontal.bearings.map((b) => b.reaction)).toEqual([0, 0]);
  });

  it('…and a tenth of a pound sideways is a result, in every row', () => {
    const r = solved(shaft({ segments: [seg(1, 20, 2)], bearings: [0, 20], forces: [force(2, 10, 1e6, 0.1)], couples: [], nextId: 3 }));
    const EI = (29000 * 1000 * Math.PI * 2 ** 4) / 64;
    for (const b of r.bearings) near(b.reaction.horizontal, 0.05, 0.05, 1e-5);
    near(r.at(10).left.moment.horizontal, (0.1 * 20) / 4, 0.5, 1e-5);
    near(r.forces[0].deflection.horizontal, (-0.1 * 20 ** 3) / (48 * EI), (0.1 * 20 ** 3) / (48 * EI), 1e-5);
    near(r.bearings[0].slope.horizontal, (-0.1 * 20 ** 2) / (16 * EI), (0.1 * 20 ** 2) / (16 * EI), 1e-5);
    // A slope has its own floor, a twentieth of the deflection's on this shaft (1 ÷ L): this one is between the two, and is a result — at a bearing and at a point.
    expect(Math.abs(r.bearings[0].slope.horizontal)).toBeGreaterThan(r.floors.theta);
    expect(Math.abs(r.bearings[0].slope.horizontal)).toBeLessThan(r.floors.v);
    near(r.at(0).slope.horizontal, (-0.1 * 20 ** 2) / (16 * EI), (0.1 * 20 ** 2) / (16 * EI), 1e-5);
    near(r.at(20).slope.horizontal, (0.1 * 20 ** 2) / (16 * EI), (0.1 * 20 ** 2) / (16 * EI), 1e-5);
    expect(r.views.horizontal.diagrams.M.marks).toHaveLength(1);
  });

  it('a force standing on a bearing is in the size of the problem: beside a trillion pounds on a bearing, one pound at midspan bends nothing that can be told from rounding', () => {
    const r = solved(shaft({ segments: [seg(1, 20, 2)], bearings: [0, 20], forces: [force(2, 0, 1e12), force(3, 10, 1)], couples: [], nextId: 4 }));
    near(r.bearings[0].reaction.vertical, 1e12, 1e12);
    expect(r.bearings[1].reaction.vertical).toBe(0);
    const nothing = { value: 0, x: null };
    expect(r.largest).toEqual({ shear: nothing, moment: nothing, stress: { ...nothing, segment: null }, deflection: nothing, slope: nothing });
    expect(r.segments[0].moment).toEqual(nothing);
    expect(r.segments[0].stress).toEqual(nothing);
    expect(r.forces[1].deflection).toEqual({ vertical: 0, horizontal: 0, both: 0 });
    expect(r.at(10).left.stress).toBe(0);
  });

  it('a couple a trillionth of the loads jumps nothing that can be told from rounding: not the moment, and not the stress', () => {
    // A million pounds at midspan, and a millionth of a pound-inch a quarter of the way along: the moment there is
    // 2,500,000 lbf·in on one side and a millionth less on the other, and what is rounding is 0.02 lbf·in.
    const r = solved(shaft({ segments: [seg(1, 20, 2)], bearings: [0, 20], forces: [force(2, 10, 1e6)], couples: [couple(3, 5, 1e-6)], nextId: 4 }));
    expect(r.breaks).toContain(5);
    const at = r.at(5);
    near(r.floors.M, 0.02, 0.02, 1e-6);
    expect(at.jumps).toEqual({ shear: false, moment: false, section: false, stress: false });
    near(at.left.moment.vertical, 2.5e6);
    expect(printed(at.left.stress)).toBe(printed(at.right.stress));
    // …and a couple of a pound-inch, fifty times what is rounding, jumps both.
    const one = solved(shaft({ segments: [seg(1, 20, 2)], bearings: [0, 20], forces: [force(2, 10, 1e6)], couples: [couple(3, 5, 1)], nextId: 4 })).at(5);
    expect(one.jumps).toEqual({ shear: false, moment: true, section: false, stress: true });
  });

  it('what a floor hides: the deflection UNDER a force a thousandth of an inch from a bearing reads 0 — and the largest deflection of that shaft is printed all the same', () => {
    // 20 in of 2 in bar between bearings at its ends, 1,000 lbf at a from the left one. Under the force the shaft goes
    // down by P·a²·b² ÷ 3EIL, and furthest — near midspan — by P·a·(L² − a²)^1.5 ÷ 9√3·EIL: the first as the SQUARE of a.
    const EI = (29000 * 1000 * Math.PI * 2 ** 4) / 64;
    const under = (a: number) => (1000 * a ** 2 * (20 - a) ** 2) / (3 * EI * 20);
    const furthest = (a: number) => (1000 * a * (20 ** 2 - a ** 2) ** 1.5) / (9 * Math.sqrt(3) * EI * 20);
    const at = (a: number) => solved(shaft({ segments: [seg(1, 20, 2)], bearings: [0, 20], forces: [force(2, a, 1000)], couples: [], nextId: 3 }));
    // 0.0008 in: a twenty-five-thousandth of the shaft. Under the force, half a billionth of P·L³ ÷ EI: under the floor.
    const close = at(0.0008);
    near(close.floors.v, (1e-9 * 1000 * 20 ** 3) / EI);
    expect(under(0.0008)).toBeLessThan(close.floors.v);
    expect(close.forces[0].deflection).toEqual({ vertical: 0, horizontal: 0, both: 0 });
    // …and the shaft's largest deflection, three thousand times the floor, is there to its own figures.
    expect(furthest(0.0008)).toBeGreaterThan(1000 * close.floors.v);
    near(close.largest.deflection.value, furthest(0.0008), furthest(0.0008), 1e-7);
    // (Where a force near the left bearing bends the shaft most: √((L² − a²) ÷ 3) from the right one.)
    near(close.largest.deflection.x!, 20 - Math.sqrt((20 ** 2 - 0.0008 ** 2) / 3), 20, 1e-6);
    // The same of the plane's own lowest point, which its diagram labels: where the shaft goes furthest, not a tenth of an inch before it.
    near(close.views.vertical.peaks.D.min.x!, 20 - Math.sqrt((20 ** 2 - 0.0008 ** 2) / 3), 20, 1e-6);
    near(close.views.vertical.peaks.D.min.value, -furthest(0.0008), furthest(0.0008), 1e-7);
    // A fiftieth of an inch from the bearing — a thousandth of the shaft — the deflection under the force is a result.
    const further = at(0.02);
    expect(under(0.02)).toBeGreaterThan(100 * further.floors.v);
    near(further.forces[0].deflection.vertical, -under(0.02), under(0.02), 1e-7);
  });

  it('a size whose two planes are each rounding is rounding: no largest value is made of two zeros, and the largest that IS a result is named', () => {
    // A billion pounds standing on the left bearing: what is rounding is 1 lbf. Overhangs at both ends, a force on each tip:
    // 0.95 lbf in each plane on the left one — a shear of 1.34 lbf in size, each plane under the floor — and 1.2 lbf, all
    // vertical, on the right one. Between the bearings the vertical shear is 0.25 lbf and the horizontal one 0.95.
    const form = shaft({ segments: [seg(1, 30, 2)], bearings: [10, 20], forces: [force(2, 10, 1e9), force(3, 0, 0.95, 0.95), force(4, 30, 1.2)], couples: [], nextId: 5 });
    const r = solved(form);
    near(r.floors.F, 1, 1, 1e-6);
    const left = r.at(5);
    expect(left.right.shear).toEqual({ vertical: 0, horizontal: 0, both: 0 });
    near(r.at(25).right.shear.both, 1.2, 1.2, 1e-6);
    // The engine's own largest shear is on the left overhang, 1.34 lbf: the root of two numbers that are each rounding.
    const sol = solveShaft(toEngine(form).model) as ShaftSolution;
    near(sol.extremes.V.value, Math.hypot(0.95, 0.95), 1.34, 1e-6);
    expect(sol.extremes.V.x).toBeLessThan(10);
    // What the page says is largest is what its diagram draws highest: 1.2 lbf, from the right bearing on.
    near(r.largest.shear.value, 1.2, 1.2, 1e-6);
    expect(r.largest.shear.x).toBe(20);
    const ys = r.views.both.diagrams.V.points.map((p) => p.y);
    expect(Math.max(...ys)).toBe(r.largest.shear.value);
    expect(r.views.both.diagrams.V.marks).toEqual([{ x: 20, y: r.largest.shear.value }]);
  });

  it('a largest value on a stretch where it does not change is named where the stretch starts, not where a rounding favours', () => {
    // Between two forces the shear is one number, and past the last load of an overhang the slope is.
    const r = solved(shaft({ segments: [seg(1, 6, 1.5), seg(2, 12, 2.5), seg(3, 12, 1.25)], bearings: [3, 18], forces: [force(4, 7, 700, 200), force(5, 13.5, 300, 900, 'up'), force(6, 24, 150, 80)], couples: [], nextId: 7 }));
    expect(r.breaks).toContain(r.largest.shear.x);
    expect(r.breaks).toContain(r.views.vertical.peaks.V.max.x);
    expect(r.breaks).toContain(r.views.vertical.peaks.V.min.x);
    expect(r.breaks).toContain(r.views.horizontal.peaks.V.max.x);
    expect(r.breaks).toContain(r.views.horizontal.peaks.V.min.x);
    expect(r.largest.slope.x).toBe(24);
    // On the example: the vertical shear is −642.9 lbf from the gear to the right bearing, and is lowest "at" the gear.
    const example = solved(defaultShaft());
    expect(example.views.vertical.peaks.V.min.x).toBe(9);
    near(example.views.vertical.peaks.V.min.value, 357.142857142857 - 1000, 1000);
    expect(example.views.horizontal.peaks.V.min.x).toBe(9);
    expect(example.views.both.peaks.V.max.x).toBe(9);
    // The value is the largest all the same: nothing on the line is past it.
    for (const view of VIEWS) for (const p of r.views[view].diagrams.V.points) expect(Math.abs(p.y)).toBeLessThanOrEqual(r.largest.shear.value * (1 + 1e-12));
  });
});

describe('shaft analysis: a shaft with no load', () => {
  const empty = [shaft({ forces: [], couples: [] }), shaft({ forces: [force(5, 9, 0, 0)], couples: [couple(6, 12, 0, 0)] })];

  it('is solved, and is nothing all along: zeros, and no place for a largest value', () => {
    for (const form of empty) {
      const a = analyseShaft(form);
      expect(a.issues).toEqual([]);
      const r = a.results!;
      expect([r.loaded, r.loadScale, r.ownWeight]).toEqual([false, 0, null]);
      expect(r.floors).toEqual({ F: 0, M: 0, theta: 0, v: 0 });
      const zero = { vertical: 0, horizontal: 0, both: 0 };
      const nowhere = { value: 0, x: null };
      for (const b of r.bearings) expect([b.reaction, b.slope]).toEqual([zero, zero]);
      expect(r.balance).toEqual({ vertical: { reactions: 0, load: 0, ok: true }, horizontal: { reactions: 0, load: 0, ok: true } });
      for (const s of r.segments) expect([s.moment, s.stress, s.deflection]).toEqual([nowhere, nowhere, nowhere]);
      for (const f of r.forces) expect([f.deflection, f.slope]).toEqual([zero, zero]);
      expect(r.largest).toEqual({ shear: nowhere, moment: nowhere, stress: { ...nowhere, segment: null }, deflection: nowhere, slope: nowhere });
      for (const view of VIEWS) {
        for (const key of ['V', 'M', 'D'] as const) {
          expect(r.views[view].peaks[key]).toEqual({ max: nowhere, min: nowhere });
          expect(r.views[view].diagrams[key].marks).toEqual([]);
          expect(r.views[view].diagrams[key].points.length).toBeGreaterThan(20);
          expect(r.views[view].diagrams[key].points.every((p) => Object.is(p.y, 0))).toBe(true);
        }
      }
      const at = r.at(9);
      const side = { shear: zero, moment: zero, segment: 1, d: 2, bore: 0, stress: 0 };
      expect(at).toEqual({ x: 9, left: side, right: side, jumps: { shear: false, moment: false, section: false, stress: false }, deflection: zero, slope: zero });
      // The bearings carry nothing, and the drawing says 0 beside each.
      expect(a.drawings.both.bearings.map((b) => b.reaction)).toEqual([0, 0]);
    }
  });

  it('a force of no size still has its row: the shaft does not move there', () => {
    const r = solved(empty[1]);
    expect(r.forces.map((f) => [f.id, f.x])).toEqual([[5, 9]]);
  });

  it('…and beside loads that are, a force of no size has the deflection of the shaft where it stands', () => {
    const form = shaft({ forces: [...defaultShaft().forces, force(7, 12.5, 0, 0)], nextId: 8 });
    const r = solved(form);
    const ref = reference(form);
    nearPlanes(r.forces[2].deflection, ref.v('vertical', 12.5), ref.v('horizontal', 12.5));
    expect(solved(defaultShaft()).largest).toEqual(r.largest);
  });
});

/* ── What is wrong, and on which row ──────────────────────────────────── */

describe('shaft analysis: each fault on its row', () => {
  const said = (form: ShaftForm) => {
    const a = analyseShaft(form);
    // A shaft with a fault has no results — and is drawn all the same, with no reaction beside a bearing.
    if (a.issues.length) {
      expect(a.results).toBeNull();
      for (const view of VIEWS) expect(a.drawings[view].bearings.every((b) => b.reaction === null)).toBe(true);
    }
    return faults(a.issues);
  };
  const segments = (...rows: SegmentRow[]) => shaft({ segments: rows });
  const S = defaultShaft().segments;

  it('the example has none', () => {
    expect(said(defaultShaft())).toEqual([]);
  });

  it('the form’s own: a length, a diameter, a bore that is not one; no modulus; no density for a weight that is asked for', () => {
    for (const L of [0, -4, Number.NaN, Infinity]) expect(said(segments(S[0], { ...S[1], L }, S[2], S[3]))).toEqual([['length', { list: 'segments', id: 2, field: 'L' }]]);
    for (const d of [0, -2, Number.NaN, Infinity]) expect(said(segments(S[0], { ...S[1], d }, S[2], S[3]))).toEqual([['diameter', { list: 'segments', id: 2, field: 'd' }]]);
    for (const bore of [2, 2.5, -0.5, Number.NaN]) expect(said(segments(S[0], { ...S[1], bore }, S[2], S[3]))).toEqual([['bore', { list: 'segments', id: 2, field: 'bore' }]]);
    for (const E of [0, -29000, Number.NaN, Infinity]) expect(said(shaft({ E, material: 'custom' }))).toEqual([['modulus', { list: 'material', field: 'E' }]]);
    for (const density of [0, -1, Number.NaN]) {
      expect(said(shaft({ density, material: 'custom', ownWeight: true }))).toEqual([['density', { list: 'material', field: 'density' }]]);
      // Not asked for, the density is not on screen, and whatever it holds is no fault.
      expect(said(shaft({ density, material: 'custom', ownWeight: false }))).toEqual([]);
    }
  });

  it('a force, a couple or a bearing off the shaft', () => {
    expect(said(shaft({ forces: [force(5, 9, 1000, 360), force(6, 23.5, 400)] }))).toEqual([['outside', { list: 'forces', id: 6 }]]);
    expect(said(shaft({ forces: [force(5, -0.1, 1000, 360), force(6, 21, 400)] }))).toEqual([['outside', { list: 'forces', id: 5 }]]);
    expect(said(shaft({ couples: [couple(7, 40, 100)] }))).toEqual([['outside', { list: 'couples', id: 7 }]]);
    expect(said(shaft({ bearings: [2, 30] }))).toEqual([['outside', { list: 'bearings', index: 1 }]]);
    expect(said(shaft({ bearings: [-1, 16] }))).toEqual([['outside', { list: 'bearings', index: 0 }]]);
  });

  it('the two bearings at one place, or closer than a thousandth of the shaft: the one further right is named, whichever was typed first', () => {
    expect(said(shaft({ bearings: [16, 16] }))).toEqual([['bearings', { list: 'bearings', index: 1 }]]);
    expect(said(shaft({ bearings: [16, 16 + 23 * CLOSE * 0.9] }))).toEqual([['bearings', { list: 'bearings', index: 1 }]]);
    expect(said(shaft({ bearings: [16 + 23 * CLOSE * 0.9, 16] }))).toEqual([['bearings', { list: 'bearings', index: 0 }]]);
    expect(said(shaft({ bearings: [16, 16 + 23 * CLOSE * 1.1] }))).toEqual([]);
  });

  it('a segment under a millionth of the shaft: its length', () => {
    expect(said(segments(S[0], S[1], { ...S[2], L: 4 - 1e-5 }, seg(9, 23 * SHORT * 0.5, 1.4), S[3]))).toEqual([['short-segment', { list: 'segments', id: 9, field: 'L' }]]);
  });

  it('the stiffest segment over a million times the softest: both are named by their diameters, the stiffest first', () => {
    // 1.25 in beside 40 in: 32 to the fourth power is 1,048,576.
    expect(32 ** 4).toBeGreaterThan(STIFF);
    expect(said(segments(S[0], { ...S[1], d: 40 }, S[2], S[3]))).toEqual([
      ['stiffness', { list: 'segments', id: 2, field: 'd' }],
      ['stiffness', { list: 'segments', id: 4, field: 'd' }],
    ]);
    // 31 to the fourth is 923,521: taken.
    expect(said(segments(S[0], { ...S[1], d: 38.75 }, S[2], S[3]))).toEqual([]);
  });

  it('a force or a couple that is not a number, a bearing placed at none', () => {
    expect(said(shaft({ forces: [force(5, 9, Number.NaN, 360), force(6, 21, 400)] }))).toEqual([['number', { list: 'forces', id: 5 }]]);
    expect(said(shaft({ forces: [force(5, 9, 1000, 360), force(6, Number.NaN, 400)] }))).toEqual([['number', { list: 'forces', id: 6 }]]);
    expect(said(shaft({ forces: [force(5, 9, 1000, Infinity), force(6, 21, 400)] }))).toEqual([['number', { list: 'forces', id: 5 }]]);
    expect(said(shaft({ couples: [couple(7, 12, 100, Number.NaN)] }))).toEqual([['number', { list: 'couples', id: 7 }]]);
    expect(said(shaft({ bearings: [2, Number.NaN] }))).toEqual([['number', { list: 'bearings', index: 1 }]]);
  });

  it('a number that IS one, of a size the engine does not take, is said to be that — never "not a number" — on the field that holds it', () => {
    // A length.
    expect(said(shaft({ segments: [{ ...S[0], L: 1e61 }], bearings: [2, 16] }))).toEqual([['size', { list: 'segments', id: 1, field: 'L' }]]);
    // A force, a couple.
    expect(said(shaft({ forces: [force(5, 9, 1e61, 360)] }))).toEqual([['size', { list: 'forces', id: 5 }]]);
    expect(said(shaft({ forces: [force(5, 9, 1000, 1e-70)] }))).toEqual([['size', { list: 'forces', id: 5 }]]);
    expect(said(shaft({ couples: [couple(7, 12, 1e61)] }))).toEqual([['size', { list: 'couples', id: 7 }]]);
    // A diameter whose fourth power is past the largest number there is: no EI and no section modulus — one fault, said once.
    expect(said(segments(S[0], { ...S[1], d: 1e80 }, S[2], S[3]))).toEqual([['size', { list: 'segments', id: 2, field: 'd' }]]);
    // A diameter that makes an EI past what the engine takes: 10¹⁴ in to the fourth, times 29 million.
    expect(said(shaft({ segments: [{ ...S[0], d: 1e14 }], bearings: [1, 3], forces: [] }))).toEqual([['size', { list: 'segments', id: 1, field: 'd' }]]);
    // A modulus past what the engine takes, with diameters that are ordinary: the modulus, once, not every segment.
    expect(said(shaft({ E: 1e70, material: 'custom' }))).toEqual([['size', { list: 'material', field: 'E' }]]);
    expect(said(shaft({ E: 1e-70, material: 'custom' }))).toEqual([['size', { list: 'material', field: 'E' }]]);
    // A section modulus past it (π·d³/32 of a diameter of 10²¹) is the diameter's — whatever the density holds, which is not even a load here.
    expect(said(shaft({ segments: [seg(1, 1e22, 1e21)], bearings: [1e21, 9e21], forces: [], E: 1e-30, density: 1e-70, material: 'custom' }))).toEqual([['size', { list: 'segments', id: 1, field: 'd' }]]);
    // A density that makes a weight past it.
    expect(said(shaft({ density: 1e70, material: 'custom', ownWeight: true }))).toEqual([['size', { list: 'material', field: 'density' }]]);
    // Lengths that are each taken, and together are not: no one segment is at fault.
    expect(said(shaft({ segments: [seg(1, 6e59, 1e20), seg(2, 6e59, 1e20)], bearings: [1e59, 9e59], forces: [], E: 1e-33, material: 'custom' }))).toEqual([['size']]);
  });

  it('this file takes for "of a size the engine does not take" what the engine does: an EI of 10⁶⁰ is taken, and one past it is not', () => {
    // E·I with I = π·d⁴/64, in lbf·in².
    const formOf = (EI: number) => shaft({ segments: [seg(1, 20, 2)], bearings: [0, 20], forces: [force(2, 10, 100)], couples: [], E: EI / 1000 / ((Math.PI * 16) / 64), material: 'custom', nextId: 3 });
    expect(said(formOf(0.999e60))).toEqual([]);
    expect(said(formOf(1.001e60))).toEqual([['size', { list: 'material', field: 'E' }]]);
    expect(said(formOf(1.001e-60))).toEqual([]);
    expect(said(formOf(0.999e-60))).toEqual([['size', { list: 'material', field: 'E' }]]);
    const source = readFileSync(join(resolve(__dirname), 'engine.ts'), 'utf8');
    expect(source).toMatch(/const BIG = 1e60;\s*const SMALL = 1e-60;/);
    expect(readFileSync(join(resolve(__dirname), 'analysis.ts'), 'utf8')).toMatch(/const BIG = 1e60;\s*const SMALL = 1e-60;/);
  });

  it('a shaft of no segment', () => {
    expect(said(shaft({ segments: [] }))).toEqual([['no-segments']]);
  });

  it('everything that is wrong, at once: the form’s own first, then what the engine finds on other rows', () => {
    expect(said(shaft({ segments: [S[0], { ...S[1], d: 0 }, S[2], S[3]], forces: [force(5, 9, 1000, 360), force(6, 50, 400)], bearings: [2, 2] }))).toEqual([
      ['diameter', { list: 'segments', id: 2, field: 'd' }],
      ['outside', { list: 'forces', id: 6 }],
    ]);
    expect(said(shaft({ forces: [force(5, 9, Number.NaN, 360), force(6, 50, 400)], couples: [couple(7, -3, 20)], bearings: [2, 99] }))).toEqual([
      ['outside', { list: 'bearings', index: 1 }],
      ['number', { list: 'forces', id: 5 }],
      ['outside', { list: 'forces', id: 6 }],
      ['outside', { list: 'couples', id: 7 }],
    ]);
    // With a length at fault nothing can be placed: only the length is said, and the rest once it is mended.
    expect(said(shaft({ segments: [S[0], { ...S[1], L: 0 }, S[2], S[3]], forces: [force(5, 9, 1000, 360), force(6, 50, 400)] }))).toEqual([['length', { list: 'segments', id: 2, field: 'L' }]]);
  });

  it('what the form goes on showing of a shaft that is not solved: its length, each section that is one, its drawings', () => {
    const a = analyseShaft(segments(S[0], { ...S[1], d: 0 }, { ...S[2], bore: 1 }, S[3]));
    expect(a.results).toBeNull();
    expect(a.L).toBe(23);
    expect(a.sections.map((s) => (s ? printed(s.Z) : null))).toEqual(['0.3313', null, printed((Math.PI * (1.5 ** 4 - 1) / 64) / 0.75), '0.1917']);
    expect(a.drawings.vertical.segments).toHaveLength(4);
    expect(a.drawings.vertical.forces.map((f) => f.label)).toEqual(['1,000 lbf', '400 lbf']);
    // …written with the page's own thousands, solved or not.
    expect(analyseShaft(segments(S[0], { ...S[1], d: 0 }, S[2], S[3]), '\u202f').drawings.vertical.forces.map((f) => f.label)).toEqual(['1\u202f000 lbf', '400 lbf']);
    expect(analyseShaft(segments(S[0], { ...S[1], d: 0 }, S[2], S[3]), '\u202f').drawings.both.forces.map((f) => f.label)).toEqual(['1\u202f063 lbf', '400 lbf']);
    expect(a.toShown).toEqual({ force: 1, length: 1, moment: 1, stress: 1 / 1000, deflection: 1, slope: 1 });
    // A diameter whose fourth power is past the largest number there is has no section to print either.
    expect(analyseShaft(segments(S[0], { ...S[1], d: 1e308 }, S[2], S[3])).sections.map((s) => s === null)).toEqual([false, true, false, false]);
    expect(analyseShaft(segments(S[0], { ...S[1], d: 1e80 }, S[2], S[3])).sections.map((s) => s === null)).toEqual([false, true, false, false]);
  });
});

/* ── Any shaft ────────────────────────────────────────────────────────── */

/** Numbers from a seed, the same at every run. */
function numbers(seed: number) {
  let s = seed;
  return () => {
    s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * A shaft at random: one to five segments, some bored; the bearings anywhere, an eighth of the shaft apart or more, in
 * either order; up to four forces and two couples, in one plane or both, pointing either way; its own weight or not;
 * inches or millimetres. Every length and position is a whole number of eighths of an inch (of half-millimetres), so
 * that a load meant to stand on a shoulder or on a bearing stands on it exactly, for the engine and for the yardstick.
 */
function randomShaft(rand: () => number): ShaftForm {
  const us = rand() < 0.5;
  const q = us ? 0.125 : 0.5;
  const whole = (lo: number, hi: number) => lo + Math.floor(rand() * (hi - lo + 1));
  let id = 1;
  const segments = Array.from({ length: whole(1, 5) }, () => {
    const d = us ? whole(8, 24) / 8 : whole(20, 80);
    return seg(id++, q * whole(us ? 16 : 80, us ? 96 : 600), d, rand() < 0.3 ? d / 2 : 0);
  });
  const cells = Math.round(segments.reduce((sum, s) => sum + s.L, 0) / q);
  const ends = segments.reduce((at, s) => [...at, at[at.length - 1] + s.L], [0]);
  // A position: on a shoulder or an end one time in four, anywhere on the grid otherwise.
  const place = () => (rand() < 0.25 ? ends[whole(0, ends.length - 1)] : q * whole(0, cells));
  let bearings: [number, number] = [place(), place()];
  while (Math.abs(bearings[0] - bearings[1]) < (cells * q) / 8) bearings = [place(), place()];
  const size = (most: number) => (rand() < 0.3 ? 0 : Math.round(rand() * most * 100) / 100);
  const forces = Array.from({ length: whole(0, 4) }, () => force(id++, rand() < 0.15 ? bearings[whole(0, 1)] : place(), size(us ? 900 : 4000), size(us ? 900 : 4000), rand() < 0.7 ? 'down' : 'up', rand() < 0.5 ? 'towards' : 'away'));
  const couples = Array.from({ length: whole(0, 2) }, () => couple(id++, place(), size(us ? 2000 : 200), size(us ? 2000 : 200), rand() < 0.5 ? 'ccw' : 'cw', rand() < 0.5 ? 'ccw' : 'cw'));
  return { units: us ? 'us' : 'si', segments, bearings, forces, couples, material: 'custom', E: us ? 10000 + Math.round(rand() * 20000) : 70000 + Math.round(rand() * 140000), density: us ? 0.2836 : 7850, ownWeight: rand() < 0.4, nextId: id };
}

/**
 * What in a value is not sound: a number that is not one, a zero written −0 — and, under a key that is a size (`both`,
 * `largest`), a negative number. (Found and handed back, not asserted number by number: an analysis holds some ten
 * thousand.)
 */
function unsound(value: unknown, path: string, size = false, found: string[] = []): string[] {
  if (typeof value === 'number') {
    if (!Number.isFinite(value) || Object.is(value, -0) || (size && value < 0)) found.push(`${path} is ${Object.is(value, -0) ? '−0' : value}`);
  } else if (Array.isArray(value)) value.forEach((v, i) => unsound(v, `${path}[${i}]`, size, found));
  else if (value && typeof value === 'object') for (const [key, v] of Object.entries(value)) unsound(v, `${path}.${key}`, size || key === 'both' || key === 'largest', found);
  return found;
}

describe('shaft analysis: any shaft (150 random ones: stepped, bored, in two planes, with their weight, in either units)', { timeout: LONG_RUN }, () => {
  const rand = numbers(20261013);
  const forms = Array.from({ length: 150 }, () => randomShaft(rand));
  /** The sizes of a shaft's responses, by the yardstick: what "equal to rounding" is measured against. */
  const sizes = (ref: Reference) => {
    const xs = [...ref.cuts, ...ref.cuts.slice(1).map((x, i) => (x + ref.cuts[i]) / 2)];
    const most = (of: (x: number, side: Side) => number) => Math.max(...xs.flatMap((x) => SIDES.map((side) => Math.abs(of(x, side)))));
    return {
      xs,
      V: most((x, s) => Math.hypot(ref.V('vertical', x, s), ref.V('horizontal', x, s))),
      M: most((x, s) => Math.hypot(ref.M('vertical', x, s), ref.M('horizontal', x, s))),
      sigma: most((x, s) => ref.stress(x, s)),
      v: most((x) => Math.hypot(ref.v('vertical', x), ref.v('horizontal', x))),
      theta: most((x) => Math.hypot(ref.theta('vertical', x), ref.theta('horizontal', x))),
    };
  };
  const analysed = () =>
    forms.map((form) => {
      const a = analyseShaft(form);
      const ref = reference(form);
      const floors = a.results?.floors ?? { F: 0, M: 0, theta: 0, v: 0 };
      // What is rounding in a stress is what is in its moment, over the smallest section modulus: psi to ksi, N·m over mm³ to MPa.
      return { form, a, ref, scale: sizes(ref), floors: { ...floors, sigma: (floors.M / Math.min(...ref.Z)) * (form.units === 'us' ? 1 / 1000 : 1000) } };
    });
  // Analysed once, by the first test that asks: a hundred and fifty shafts, each with its yardstick.
  let kept: ReturnType<typeof analysed> | null = null;
  const cases = () => (kept ??= analysed());
  /*
   * EQUAL, here: to a hundred-millionth of the largest value of its kind on that shaft — AND to what the page takes
   * for rounding (`floors`), which this file holds to the size of the problem in a test of its own. A value under its
   * floor is printed as zero, and is then "wrong" by itself, which is no more than the floor: a deflection a billionth
   * of loads × L³ ÷ EI, on a shaft whose one force stands a hair from a bearing, is a ten-thousandth of that shaft's
   * largest.
   */
  const close = (got: number, want: number, scale: number, floor: number, what = '') => expect(Math.abs(got - want), `${what} got ${got}, want ${want}`).toBeLessThanOrEqual(1e-8 * scale + 1.5 * floor);
  const closePlanes = (got: ByPlanes, vertical: number, horizontal: number, scale: number, floor: number, what = '') => {
    close(got.vertical, vertical, scale, floor, what);
    close(got.horizontal, horizontal, scale, floor, what);
    close(got.both, Math.hypot(vertical, horizontal), scale, floor, what);
  };

  it('every one is solved, and the set has what it is meant to have', () => {
    for (const { a } of cases()) expect(a.issues).toEqual([]);
    expect(forms.some((f) => f.units === 'si' && f.ownWeight && f.couples.length > 0)).toBe(true);
    expect(forms.some((f) => f.units === 'us' && f.ownWeight)).toBe(true);
    expect(forms.some((f) => f.bearings[0] > f.bearings[1])).toBe(true);
    expect(forms.some((f) => f.segments.some((s) => s.bore > 0))).toBe(true);
    expect(forms.some((f) => f.forces.some((p) => f.bearings.includes(p.x) && (p.v !== 0 || p.h !== 0)))).toBe(true);
    expect(forms.some((f) => f.couples.some((c) => f.forces.some((p) => p.x === c.x)))).toBe(true);
  });

  it('the bearings: reactions by planes, the radial load, the slope there; each plane in balance', () => {
    for (const { a, ref, scale, floors } of cases()) {
      const r = a.results!;
      const most = Math.max(scale.V, ...PLANES.flatMap((p) => ref.reactions(p).map(Math.abs)));
      [ref.a, ref.b].forEach((x, i) => {
        expect(r.bearings[i].x).toBe(x);
        closePlanes(r.bearings[i].reaction, ref.reactions('vertical')[i], ref.reactions('horizontal')[i], most, floors.F, 'reaction');
        closePlanes(r.bearings[i].slope, ref.theta('vertical', x), ref.theta('horizontal', x), scale.theta, floors.theta, 'slope');
      });
      for (const plane of PLANES) {
        expect(r.balance[plane].ok).toBe(true);
        close(r.balance[plane].load, ref.load(plane), most, floors.F);
        close(r.balance[plane].reactions, ref.load(plane), most, floors.F);
      }
      const weight = ref.w.reduce((sum, q, k) => sum + q * (ref.ends[k + 1] - ref.ends[k]), 0);
      near(r.ownWeight ?? 0, weight, weight, 1e-12);
      expect(r.ownWeight === null).toBe(weight === 0);
    }
  });

  it('the values at every place, both sides, and between: by planes and together, with the section and the stress of each side', () => {
    for (const { form, a, ref, scale, floors } of cases()) {
      const r = a.results!;
      for (const x of scale.xs) {
        const p = r.at(x);
        for (const side of SIDES) {
          closePlanes(p[side].shear, ref.V('vertical', x, side), ref.V('horizontal', x, side), scale.V, floors.F, `shear at ${x} ${side}`);
          closePlanes(p[side].moment, ref.M('vertical', x, side), ref.M('horizontal', x, side), scale.M, floors.M, `moment at ${x} ${side}`);
          close(p[side].stress, ref.stress(x, side), scale.sigma, floors.sigma, `stress at ${x} ${side}`);
          const k = ref.segment(x, side);
          expect([p[side].segment, p[side].d, p[side].bore]).toEqual([k, form.segments[k].d, form.segments[k].bore]);
        }
        closePlanes(p.deflection, ref.v('vertical', x), ref.v('horizontal', x), scale.v, floors.v, `deflection at ${x}`);
        closePlanes(p.slope, ref.theta('vertical', x), ref.theta('horizontal', x), scale.theta, floors.theta, `slope at ${x}`);
      }
    }
  });

  it('what is two values at a place is said to be, by what stands there', () => {
    for (const { form, a, ref } of cases()) {
      const r = a.results!;
      // The size of the problem as a force, as a moment and as a stress, in the units shown.
      const [sizeV, sizeM] = [ref.size, ref.size * ref.L * (a.units === 'us' ? 1 : 1 / 1000)];
      const sizeS = (ref.size * ref.L) / Math.min(...ref.Z) / (a.units === 'us' ? 1000 : 1);
      for (const x of ref.cuts) {
        const p = r.at(x);
        const jumpOf = (of: (plane: Plane, side: Side) => number) => Math.max(...PLANES.map((plane) => Math.abs(of(plane, 'left') - of(plane, 'right'))));
        const [dV, dM] = [jumpOf((plane, side) => ref.V(plane, x, side)), jumpOf((plane, side) => ref.M(plane, x, side))];
        // A jump is one when it is a ten-thousandth of the size of the problem, and none when it is the rounding of
        // the yardstick's own sums. (Between the two — two loads at one place that all but cancel — it is not asked about.)
        if (dV > 1e-4 * sizeV) expect(p.jumps.shear, `shear at ${x}`).toBe(true);
        if (dV <= 1e-12 * sizeV) expect(p.jumps.shear, `shear at ${x}`).toBe(false);
        if (dM > 1e-4 * sizeM) expect(p.jumps.moment, `moment at ${x}`).toBe(true);
        if (dM <= 1e-12 * sizeM) expect(p.jumps.moment, `moment at ${x}`).toBe(false);
        const [l, k] = [ref.segment(x, 'left'), ref.segment(x, 'right')];
        expect(p.jumps.section).toBe(form.segments[l].d !== form.segments[k].d || form.segments[l].bore !== form.segments[k].bore);
        const dS = Math.abs(ref.stress(x, 'left') - ref.stress(x, 'right'));
        if (dS > 1e-4 * sizeS) expect(p.jumps.stress, `stress at ${x}`).toBe(true);
        if (dS <= 1e-12 * sizeS) expect(p.jumps.stress, `stress at ${x}`).toBe(false);
      }
    }
  });

  it('each segment: no moment in it is past its largest, which is the moment where it says, on the segment’s own side; its stress is that over its own Z', () => {
    for (const { a, ref, scale, floors } of cases()) {
      const r = a.results!;
      const M = (x: number, side: Side) => Math.hypot(ref.M('vertical', x, side), ref.M('horizontal', x, side));
      r.segments.forEach((s, k) => {
        const [from, to] = [ref.ends[k], ref.ends[k + 1]];
        expect([s.from, s.to]).toEqual([from, to]);
        // Its own side at each end; both sides of every place inside.
        const inside = [...ref.cuts.filter((x) => x > from && x < to), ...Array.from({ length: 39 }, (_, i) => from + ((to - from) * (i + 1)) / 40)];
        const all = [M(from, 'right'), M(to, 'left'), ...inside.flatMap((x) => SIDES.map((side) => M(x, side)))];
        for (const m of all) expect(m).toBeLessThanOrEqual(s.moment.value + 1e-8 * scale.M + 1.5 * floors.M);
        expect(s.moment.value).toBeLessThanOrEqual(Math.max(...all) * (1 + 5e-3) + 1e-8 * scale.M);
        if (s.moment.x !== null) {
          const x = s.moment.x;
          expect(x).toBeGreaterThanOrEqual(from);
          expect(x).toBeLessThanOrEqual(to);
          close(s.moment.value, x === from ? M(x, 'right') : x === to ? M(x, 'left') : Math.max(M(x, 'left'), M(x, 'right')), scale.M, floors.M, `segment ${k}`);
          // lbf·in over in³ is a thousandth of a ksi; N·m × 1,000 over mm³ is a megapascal.
          close(s.stress.value, (s.moment.value / ref.Z[k]) * (a.units === 'us' ? 1 / 1000 : 1000), scale.sigma, floors.sigma, `stress of segment ${k}`);
          expect(s.stress.x).toBe(x);
        } else expect(s.stress).toEqual({ value: 0, x: null });
        near(s.section.I, ref.I[k]);
        near(s.section.Z, ref.Z[k]);
        near(s.section.A, ref.A[k]);
        if (r.ownWeight !== null) near(s.w!, ref.w[k]);
        else expect(s.w).toBeNull();
        // And its largest deflection: no point of the segment past it, and the deflection where it says.
        const D = (x: number) => Math.hypot(ref.v('vertical', x), ref.v('horizontal', x));
        const lowest = Math.max(D(from), D(to), ...inside.map(D));
        expect(lowest).toBeLessThanOrEqual(s.deflection.value + 1e-8 * scale.v + 1.5 * floors.v);
        expect(s.deflection.value).toBeLessThanOrEqual(lowest * (1 + 5e-3) + 1e-8 * scale.v);
        if (s.deflection.x !== null) {
          expect(s.deflection.x).toBeGreaterThanOrEqual(from);
          expect(s.deflection.x).toBeLessThanOrEqual(to);
          close(s.deflection.value, D(s.deflection.x), scale.v, floors.v, `deflection of segment ${k}`);
        }
      });
      // The largest stress is the largest of those — the first, of two that are as large — and says which segment.
      const worst = Math.max(...r.segments.map((s) => s.stress.value));
      close(r.largest.stress.value, worst, scale.sigma, floors.sigma);
      if (worst > 0) {
        const named = r.largest.stress.segment!;
        expect(r.segments[named].stress).toEqual({ value: r.largest.stress.value, x: r.largest.stress.x });
        r.segments.slice(0, named).forEach((s) => expect(s.stress.value).toBeLessThan(r.largest.stress.value));
      } else expect(r.largest.stress).toEqual({ value: 0, x: null, segment: null });
    }
  });

  it(
    'the largest values: nothing on the shaft is past them, and each is the value at the place it names',
    () => {
      for (const { a, ref, scale, floors } of cases()) {
        const r = a.results!;
        const fine = [...scale.xs, ...Array.from({ length: 101 }, (_, i) => (ref.L * i) / 100)];
        const size = (of: (plane: Plane, x: number, side: Side) => number) => (x: number, side: Side) => Math.hypot(of('vertical', x, side), of('horizontal', x, side));
        const check = (found: ShaftValue, of: (x: number, side: Side) => number, most: number, floor: number, what: string, sides: Side[] = SIDES) => {
          const past = Math.max(...fine.flatMap((x) => sides.map((side) => of(x, side))));
          expect(past, `${what}: a point of the shaft is past the largest`).toBeLessThanOrEqual(found.value + 1e-8 * most + 1.5 * floor);
          if (found.x !== null) close(found.value, Math.max(...sides.map((side) => of(found.x!, side))), most, floor, what);
          else expect(most).toBeLessThanOrEqual(1.5 * floor);
        };
        check(r.largest.shear, size(ref.V), scale.V, floors.F, 'shear');
        check(r.largest.moment, size(ref.M), scale.M, floors.M, 'moment');
        // (A deflection and a slope are one value whichever side.)
        check(r.largest.deflection, size((plane, x) => ref.v(plane, x)), scale.v, floors.v, 'deflection', ['right']);
        check(r.largest.slope, size((plane, x) => ref.theta(plane, x)), scale.theta, floors.theta, 'slope', ['right']);
      }
    },
    LONG_RUN,
  );

  it('what a floor can hide is past the fourth figure of the largest value beside it: on every one of these shafts, under a ten-thousandth of it', () => {
    let bent = 0;
    for (const { a } of cases()) {
      const r = a.results!;
      const beside = (floor: number, largest: ShaftValue) => {
        if (largest.x === null) return;
        bent += 1;
        expect(floor / largest.value).toBeLessThan(1e-4);
      };
      beside(r.floors.F, r.largest.shear);
      beside(r.floors.M, r.largest.moment);
      beside(r.floors.v, r.largest.deflection);
      beside(r.floors.theta, r.largest.slope);
    }
    // (All but the few of them whose every load stands on a bearing, which bend nothing.)
    expect(bent).toBeGreaterThan(4 * 130);
  });

  it('at each force of the form, in the form’s order: the deflection and the slope of the shaft there', () => {
    for (const { form, a, ref, scale, floors } of cases()) {
      const r = a.results!;
      expect(r.forces.map((f) => [f.id, f.index, f.x])).toEqual(form.forces.map((f, i) => [f.id, i, f.x]));
      r.forces.forEach((f) => {
        closePlanes(f.deflection, ref.v('vertical', f.x), ref.v('horizontal', f.x), scale.v, floors.v);
        closePlanes(f.slope, ref.theta('vertical', f.x), ref.theta('horizontal', f.x), scale.theta, floors.theta);
      });
    }
  });

  it(
    'every number of an analysis is a number, no zero is written −0, and a size is never negative',
    () => {
      for (const { a } of cases()) {
        const r = a.results!;
        expect(unsound({ ...r, at: [0, r.L / 3, r.L].map((x) => r.at(x)) }, 'results')).toEqual([]);
        expect(unsound(a.drawings.both, 'drawings.both', true)).toEqual([]);
        expect(unsound([a.drawings.vertical, a.drawings.horizontal, a.L, a.sections, a.toShown], 'analysis')).toEqual([]);
      }
    },
    LONG_RUN,
  );

  it('a row of a table adds up as printed: the two together are the root of the sum of the squares of the two planes shown', () => {
    const adds = (p: ByPlanes) => near(p.both, Math.hypot(p.vertical, p.horizontal), Math.hypot(p.vertical, p.horizontal), 1e-12);
    const side = (s: ShaftSide) => [s.shear, s.moment].forEach(adds);
    for (const { a } of cases()) {
      const r = a.results!;
      r.bearings.forEach((b) => [b.reaction, b.slope].forEach(adds));
      r.forces.forEach((f) => [f.deflection, f.slope].forEach(adds));
      for (const x of [0, r.L / 7, r.L / 2, r.L]) {
        const p = r.at(x);
        side(p.left);
        side(p.right);
        [p.deflection, p.slope].forEach(adds);
      }
    }
  });

  it('the points of each view’s diagrams are the yardstick’s values: one in five of them, and both sides of every place', () => {
    for (const { a, ref, scale, floors } of cases().slice(0, 40)) {
      const r = a.results!;
      const points = r.views.both.diagrams.V.points;
      points.forEach((point, i) => {
        const x = point.x;
        const paired = (i + 1 < points.length && points[i + 1].x === x) || (i > 0 && points[i - 1].x === x);
        if (!paired && i % 5 !== 0) return;
        // Two points at one place: the first is its left side, the second its right. At the far end: the side that is on the shaft.
        const side: Side = (i + 1 < points.length && points[i + 1].x === x) || x === r.L ? 'left' : 'right';
        const [Vv, Vh, Mv, Mh, Dv, Dh] = [ref.V('vertical', x, side), ref.V('horizontal', x, side), ref.M('vertical', x, side), ref.M('horizontal', x, side), ref.v('vertical', x), ref.v('horizontal', x)];
        const want: Record<ShaftView, [number, number, number]> = { vertical: [Vv, Mv, Dv], horizontal: [Vh, Mh, Dh], both: [Math.hypot(Vv, Vh), Math.hypot(Mv, Mh), Math.hypot(Dv, Dh)] };
        for (const view of VIEWS) {
          const d = r.views[view].diagrams;
          expect(d.V.points[i].x).toBe(x);
          close(d.V.points[i].y, want[view][0], scale.V, floors.F, `${view} shear at ${x}`);
          close(d.M.points[i].y, want[view][1], scale.M, floors.M, `${view} moment at ${x}`);
          close(d.D.points[i].y, want[view][2], scale.v, floors.v, `${view} deflection at ${x}`);
        }
      });
    }
  });
});

/* ── The door that never throws ───────────────────────────────────────── */

describe('shaft analysis: the door that never throws', { timeout: LONG_RUN }, () => {
  // Nothing is known to make the arithmetic throw. This holds what the page
  // would do if something did: one shaft with no results and one line, not a
  // page taken away with whatever was typed into it.

  it('the engine made to throw: a shaft with no results and the one issue "stopped", on no row — and the form goes on being drawn', () => {
    trap.on = true;
    expect(() => analyseShaft(defaultShaft())).toThrow('made to throw');
    const a = analyseSafely(defaultShaft());
    trap.on = false;
    expect(a.results).toBeNull();
    expect(a.issues).toEqual([{ code: 'stopped' }]);
    // What the form goes on showing: its units, its length, its sections, its drawings — with no reaction on them.
    const plain = analyseShaft(defaultShaft());
    expect([a.units, a.L, a.sections, a.toShown]).toEqual([plain.units, plain.L, plain.sections, plain.toShown]);
    for (const view of VIEWS) {
      expect(a.drawings[view].segments).toEqual(plain.drawings[view].segments);
      expect(a.drawings[view].forces).toEqual(plain.drawings[view].forces);
      expect(a.drawings[view].bearings.map((b) => b.reaction)).toEqual([null, null]);
    }
  });

  it('a form that cannot even be read: nothing to draw, and the same one line', () => {
    const broken = (): ShaftForm => {
      const form = defaultShaft();
      Object.defineProperty(form, 'segments', {
        get() {
          throw new Error('made to throw');
        },
      });
      return form;
    };
    expect(() => analyseShaft(broken())).toThrow('made to throw');
    const a = analyseSafely(broken());
    expect(a.results).toBeNull();
    expect(a.issues).toEqual([{ code: 'stopped' }]);
    expect([a.units, a.L, a.sections]).toEqual(['us', 0, []]);
    const blank = { L: 0, lengthUnit: '', segments: [], bearings: [], forces: [], couples: [], ownWeight: false };
    expect(a.drawings).toEqual({ vertical: blank, horizontal: blank, both: blank });
  });

  it('a fault in the values at a point is caught with the rest: they are read once before the analysis is handed over', () => {
    const source = readFileSync(join(resolve(__dirname), 'analysis.ts'), 'utf8');
    expect(source).toMatch(/const analysis = analyseShaft\(form, group\);\s*analysis\.results\?\.at\(analysis\.results\.L \/ 2\);\s*return analysis;/);
  });

  it('for every shaft that does not throw it is analyseShaft, to the last number', () => {
    const flat = (a: ShaftAnalysis) => JSON.stringify({ ...a, results: a.results ? { ...a.results, at: a.results.at(a.results.L / 3) } : null });
    const rand = numbers(7);
    for (const form of [defaultShaft(), convertShaft(defaultShaft(), 'si'), shaft({ ownWeight: true }), shaft({ bearings: [16, 16] }), shaft({ E: 0 }), shaft({ forces: [], couples: [] }), ...Array.from({ length: 20 }, () => randomShaft(rand))]) {
      expect(flat(analyseSafely(form))).toBe(flat(analyseShaft(form)));
    }
  });

  it('whatever a link or a field puts in the form, it does not throw, and a shaft with a fault has no results — and one without has', () => {
    const rand = numbers(99);
    const odd = [0, -1, Number.NaN, Infinity, -Infinity, 1e-70, 1e70, 1e-320, 1e308, 1e-9, 23, 23.0000000001];
    const pick = () => odd[Math.floor(rand() * odd.length)];
    let [refused, taken] = [0, 0];
    for (let i = 0; i < 400; i++) {
      const form = randomShaft(rand);
      for (let edits = 1 + Math.floor(rand() * 3); edits > 0; edits--) {
        const what = Math.floor(rand() * 9);
        const s = form.segments[Math.floor(rand() * form.segments.length)];
        if (what === 0) s.L = pick();
        else if (what === 1) s.d = pick();
        else if (what === 2) s.bore = pick();
        else if (what === 3) form.bearings[rand() < 0.5 ? 0 : 1] = pick();
        else if (what === 4 && form.forces.length) form.forces[0] = { ...form.forces[0], [['x', 'v', 'h'][Math.floor(rand() * 3)]]: pick() };
        else if (what === 5 && form.couples.length) form.couples[0] = { ...form.couples[0], [['x', 'v', 'h'][Math.floor(rand() * 3)]]: pick() };
        else if (what === 6) form.E = pick();
        else if (what === 7) form.density = pick();
        else form.ownWeight = !form.ownWeight;
      }
      const a = analyseSafely(form);
      expect(a.issues.some((issue) => issue.code === 'stopped'), JSON.stringify(form)).toBe(false);
      expect(a.results === null, JSON.stringify([a.issues, form])).toBe(a.issues.length > 0);
      // No fault is said twice, and none is the engine's word for a number of the wrong size left as it came.
      const keys = a.issues.map((issue) => JSON.stringify(issue));
      expect(new Set(keys).size).toBe(keys.length);
      // Solved or not, the sections the form goes on showing are numbers, or none.
      expect(unsound([a.sections, a.toShown], 'analysis'), JSON.stringify(form)).toEqual([]);
      if (a.results) {
        taken += 1;
        const r = a.results;
        expect(unsound({ ...r, at: [r.at(0), r.at(r.L / 2), r.at(r.L)] }, 'results'), JSON.stringify(form)).toEqual([]);
      } else refused += 1;
    }
    expect(refused).toBeGreaterThan(100);
    expect(taken).toBeGreaterThan(20);
  });
});
