import { afterEach, describe, expect, it } from 'vitest';
import { fieldNumber } from '../format';
import { MATERIALS, decodeBeam, defaultBeam, encodeBeam, tidy } from '../beam/model';
import { DEFAULT_LIMIT, SPAN_KEY, decodeSpan, defaultSpan, encodeSpan } from '../beam/span';
import { CONTINUOUS_KEY, decodeContinuous, defaultContinuous, encodeContinuous } from '../continuous/model';
import {
  MAX_ROWS,
  MAX_SEGMENTS,
  SEAT,
  SHAFT_KEY,
  SHAFT_MATERIALS,
  SHAFT_UNITS,
  SHAFT_US_TO_SI,
  TO_ENGINE,
  allIssues,
  convertShaft,
  decodeShaft,
  defaultShaft,
  drawingOf,
  encodeShaft,
  formIssues,
  issueOnRow,
  reduceShaft,
  seatOf,
  sectionOf,
  segmentEnds,
  shaftLength,
  shownMoment,
  shownStress,
  toEngine,
  type CoupleRow,
  type ForceRow,
  type SegmentRow,
  type ShaftAction,
  type ShaftForm,
  type ShaftFormIssue,
  type ShaftMaterial,
  type Sideways,
} from './model';
import type { ShaftIssue, ShaftModel } from './types';

// Arithmetic that never waits: a turn of the event loop between two tests lets the runner hear from this
// worker (continuous/engine.test.ts says what happens when it does not).
afterEach(() => new Promise<void>((resolve) => setTimeout(resolve, 0)));

/**
 * BETWEEN THE FOURTH CALCULATOR'S FORM AND ITS ENGINE: the units, the edits,
 * the round section, what the engine is given, what the form says is wrong,
 * the shaft as it is drawn, and the address.
 *
 * The engine has its own tests. What can go wrong here is what stands before
 * it: a modulus in ksi taken for lbf/in², a couple in N·m sent as N·mm or
 * not, a density in kg/m³ made a weight without g, a hollow section worked
 * as a solid one, an upward force sent downward, a bearing that moved when a
 * segment was removed, a link that opens another shaft.
 *
 * NOTHING BELOW ASKS THE ENGINE. Where a shaft is solved — the example, and
 * the same shaft in both systems — it is by the beam equation itself, worked
 * out in this file (`bent`): the reactions from the equilibrium of the whole
 * shaft, the slope and the deflection by integrating M ÷ EI piece by piece.
 * That yardstick is itself held against the closed forms of the beam tables
 * before anything is measured with it.
 */

const near = (got: number, want: number, tol = 1e-9) => expect(Math.abs(got - want), `got ${got}, want ${want}`).toBeLessThanOrEqual(tol * Math.max(1, Math.abs(want)));
/** Equal to so many parts of the value itself: for results far smaller than 1. */
const close = (got: number, want: number, tol = 1e-9) => expect(Math.abs(got - want), `got ${got}, want ${want}`).toBeLessThanOrEqual(tol * Math.abs(want));

const seg = (id: number, L: number, d: number, bore = 0): SegmentRow => ({ id, L, d, bore });
const force = (id: number, x: number, v: number, vDir: 'down' | 'up' = 'down', h = 0, hDir: Sideways = 'towards'): ForceRow => ({ id, x, v, vDir, h, hDir });
const couple = (id: number, x: number, v: number, vDir: 'ccw' | 'cw' = 'ccw', h = 0, hDir: 'ccw' | 'cw' = 'ccw'): CoupleRow => ({ id, x, v, vDir, h, hDir });
/** The example with something else in it. */
const shaft = (over: Partial<ShaftForm>): ShaftForm => ({ ...defaultShaft(), ...over });

/**
 * A shaft with one of everything, in numbers that can be followed by hand:
 * 18 in long — 6 in of 2 in bar, 8 in of 3 in tube bored 1.5 in, 4 in of
 * 1 in bar — on bearings at 3 in and at 16 in (the last 2 in overhang), a
 * material of the visitor's own, its own weight a load.
 */
const worked = (): ShaftForm => ({
  units: 'us',
  segments: [seg(11, 6, 2), seg(12, 8, 3, 1.5), seg(13, 4, 1)],
  bearings: [3, 16],
  forces: [force(21, 10, 500, 'down', 200, 'away'), force(22, 18, 150, 'up', 0, 'towards')],
  couples: [couple(31, 10, 300, 'cw', 120, 'ccw')],
  material: 'custom',
  E: 30000,
  density: 0.3,
  ownWeight: true,
  nextId: 40,
});

/** The same kind of shaft in round millimetres and newtons: 150 mm of 50 mm bar and 200 mm of 80 mm tube bored 40 mm, in steel. */
const metric = (): ShaftForm => ({
  units: 'si',
  segments: [seg(1, 150, 50), seg(2, 200, 80, 40)],
  bearings: [0, 300],
  forces: [force(3, 150, 2000, 'down', 500, 'towards')],
  couples: [couple(4, 250, 40, 'ccw', 15, 'cw')],
  material: 'steel',
  E: 200000,
  density: 7850,
  ownWeight: true,
  nextId: 5,
});

/** What a link carries of a form: each row by what it says (a link numbers the rows again). */
const carried = (f: ShaftForm) => ({
  units: f.units,
  bearings: f.bearings,
  segments: f.segments.map((s) => [s.L, s.d, s.bore]),
  forces: f.forces.map((p) => [p.x, p.v, p.vDir, p.h, p.hDir]),
  couples: f.couples.map((p) => [p.x, p.v, p.vDir, p.h, p.hDir]),
  material: [f.material, f.E, f.density, f.ownWeight],
});

/* The check a link begins with, worked out here a second time from its
   description in beam/model.ts — as a sum of powers, where the model
   multiplies as it goes: the mark K; the codes of the rest's characters, the
   last weighted by A, the one before by A², and so on, added up modulo the
   prime P; the same with the powers of A²; each sum in four characters of
   base 36; and the length of the rest in base 36. People keep the links they
   were sent, so the rule may not drift — and a test that asked the model for
   it could not tell. */
const P = 1679609;
const A = 1038055;
const checkOf = (body: string) => {
  const A2 = (A * A) % P;
  let [a, b, wa, wb] = [0, 0, 1, 1];
  for (let i = body.length - 1; i >= 0; i--) {
    [wa, wb] = [(wa * A) % P, (wb * A2) % P];
    a = (a + body.charCodeAt(i) * wa) % P;
    b = (b + body.charCodeAt(i) * wb) % P;
  }
  const four = (v: number) => v.toString(36).padStart(4, '0');
  return `K${four(a)}${four(b)}${body.length.toString(36)}`;
};
/** These six fields as the page would write them: behind their check. */
const sealed = (body: string) => `${checkOf(body)};${body}`;
/* The check of the links written before 14 October 2026, from ITS
   description: the length of the rest and a sum of its characters, in base
   36. Kept here to write such links, which must still open. */
const oldCheckOf = (body: string) => {
  let sum = 0;
  for (const ch of body) sum = (sum * 31 + ch.charCodeAt(0)) % 1296;
  return (body.length * 1296 + sum).toString(36);
};
/** These six fields as the page wrote them before 14 October 2026. */
const oldSealed = (body: string) => `${oldCheckOf(body)};${body}`;
/** What an address of this page is written in: the check — its mark, then base 36 — and the fields, in lower case. */
const WRITTEN_IN = /^K[a-z0-9]+;[a-z0-9.,;_-]+$/;
/** The six fields of a link, without its check. */
const bodyOf = (link: string) => link.slice(link.indexOf(';') + 1);

/** The same numbers in the same order, every time: a test that fails must fail again. */
const dice = (seed: number) => {
  let s = seed;
  const rnd = () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 2 ** 32;
  };
  const pick = <T>(list: readonly T[]): T => list[Math.floor(rnd() * list.length)];
  return { rnd, pick };
};

/** A shaft not chosen: one to eight segments, hollow or not, bearings anywhere, loads in every direction, any number a field can show, each material, both systems. */
function randomShaft(rnd: () => number, pick: <T>(list: readonly T[]) => T): ShaftForm {
  // Any number, as a field holds it once it has been shown: to eight figures.
  const any = () => Number(fieldNumber(pick([0, 20, 12.5, -3, 1e21, 1e-7, 2e12, 123456789012, 5e-324, (rnd() - 0.3) * 100, (rnd() - 0.5) * 10 ** Math.round((rnd() - 0.5) * 600)])));
  const size = () => pick([Math.abs(any()), Math.abs(any()), Math.abs(any()), Math.abs(any()), 0, Infinity, Number.NaN]);
  const units = pick(['us', 'si'] as const);
  const material = pick(['steel', 'stainless', 'aluminum', 'custom'] as const);
  let id = 1;
  const segments = Array.from({ length: 1 + Math.floor(rnd() * MAX_SEGMENTS) }, () => seg(id++, any(), any(), pick([0, 0, any()])));
  const some = <T>(row: () => T): T[] => Array.from({ length: pick([0, 0, 1, 2, 3, MAX_ROWS]) }, row);
  return {
    units,
    segments,
    bearings: [any(), any()],
    forces: some(() => force(id++, any(), size(), pick(['down', 'up'] as const), size(), pick(['towards', 'away'] as const))),
    couples: some(() => couple(id++, any(), size(), pick(['ccw', 'cw'] as const), size(), pick(['ccw', 'cw'] as const))),
    material,
    E: material === 'custom' ? size() : SHAFT_MATERIALS[material][units].E,
    density: material === 'custom' ? size() : SHAFT_MATERIALS[material][units].density,
    ownWeight: rnd() < 0.5,
    nextId: id,
  };
}

/** A form nothing can write on: an edit that changed its form in place, instead of returning another, would throw. */
const frozen = <T>(value: T): T => {
  if (value && typeof value === 'object' && !Object.isFrozen(value)) {
    Object.freeze(value);
    for (const inner of Object.values(value)) frozen(inner);
  }
  return value;
};

/** Every row of a form, and every id in it. */
const idsOf = (f: ShaftForm) => [...f.segments, ...f.forces, ...f.couples].map((r) => r.id);

/**
 * What every edit must leave true of a form — or rather, each thing that is
 * not: an empty list is a sound form. (One list and one comparison, not an
 * assertion a row: six thousand edits of thirty rows are asked this.)
 */
function unsound(f: ShaftForm): string[] {
  const said: string[] = [];
  const hold = (rule: boolean, what: string) => {
    if (!rule) said.push(what);
  };
  hold(f.segments.length >= 1 && f.segments.length <= MAX_SEGMENTS, `${f.segments.length} segments`);
  hold(f.forces.length <= MAX_ROWS && f.couples.length <= MAX_ROWS, `${f.forces.length} forces, ${f.couples.length} couples`);
  // Two bearings, each a number.
  hold(Array.isArray(f.bearings) && f.bearings.length === 2 && f.bearings.every((x) => typeof x === 'number'), 'the bearings are not two numbers');
  // Every row is whole: nothing was dropped from it, and nothing that is not its own was added.
  const keys = (row: object) => Object.keys(row).sort().join();
  const numbers = (...values: unknown[]) => values.every((v) => typeof v === 'number');
  for (const s of f.segments) hold(keys(s) === 'L,bore,d,id' && numbers(s.id, s.L, s.d, s.bore), `segment ${s.id} is not whole`);
  for (const p of f.forces) hold(keys(p) === 'h,hDir,id,v,vDir,x' && numbers(p.id, p.x, p.v, p.h) && ['down', 'up'].includes(p.vDir) && ['towards', 'away'].includes(p.hDir), `force ${p.id} is not whole`);
  for (const p of f.couples) hold(keys(p) === 'h,hDir,id,v,vDir,x' && numbers(p.id, p.x, p.v, p.h) && ['ccw', 'cw'].includes(p.vDir) && ['ccw', 'cw'].includes(p.hDir), `couple ${p.id} is not whole`);
  const ids = idsOf(f);
  hold(new Set(ids).size === ids.length, 'two rows share an id');
  hold(f.nextId > Math.max(...ids), 'the next id is one in use');
  // A listed material stands beside its own two numbers, in the form's units.
  hold(['steel', 'stainless', 'aluminum', 'custom'].includes(f.material), `${f.material} is no material`);
  if (f.material !== 'custom' && SHAFT_MATERIALS[f.material]) hold(f.E === SHAFT_MATERIALS[f.material][f.units].E && f.density === SHAFT_MATERIALS[f.material][f.units].density, `${f.material} beside E = ${f.E} and a density of ${f.density}`);
  hold(typeof f.ownWeight === 'boolean' && numbers(f.E, f.density, f.nextId), 'the material is not whole');
  return said;
}
const expectSound = (f: ShaftForm, why: string) => expect(unsound(f), why).toEqual([]);

/* ── The yardstick ────────────────────────────────────────────────────── */

/** ∫ f over [a, b], exact for a polynomial of the fifth degree: three Gauss points. */
const gauss = (f: (x: number) => number, a: number, b: number) => {
  const half = (b - a) / 2;
  const mid = (a + b) / 2;
  const r = Math.sqrt(0.6) * half;
  return (half * (5 * f(mid - r) + 8 * f(mid) + 5 * f(mid + r))) / 9;
};

/**
 * A stepped shaft on its two bearings, one plane at a time, from the beam
 * equation and nothing else. The two reactions are the equilibrium of the
 * whole shaft. The moment at x is that of everything to its left. Then
 *
 *     θ(x) = θ(0) + ∫ M/EI ds          v(x) = v(0) + θ(0)·x + ∫ (x − s)·M/EI ds
 *
 * each integral taken piece by piece between the places where something
 * changes — within one piece M/EI is a polynomial of the second degree at
 * most, and three Gauss points are exact — and θ(0), v(0) are what puts the
 * shaft back on its two bearings. Signs as types.ts has them: a force
 * positive downward, a couple positive counter-clockwise, a reaction and a
 * deflection positive upward, a moment positive sagging.
 */
function bent(model: ShaftModel) {
  const ends = [0];
  for (const s of model.segments) ends.push(ends[ends.length - 1] + s.L);
  const L = ends[ends.length - 1];
  const [a, b] = model.bearings;
  /** The stiffness at a place that is inside a segment. */
  const EIat = (x: number) => model.segments[ends.findIndex((e) => x < e) - 1].EI;
  const plane = (key: 'v' | 'h') => {
    const forces = (model.forces ?? []).map((f) => ({ x: f.x, P: f[key] }));
    const couples = (model.couples ?? []).map((c) => ({ x: c.x, C: c[key] }));
    const weights = key === 'v' ? model.segments.map((s, i) => ({ from: ends[i], to: ends[i + 1], w: s.w ?? 0 })) : [];
    // Moments about the first bearing, counter-clockwise positive: Rb·(b − a) − Σ P·(x − a) + Σ C = 0.
    let total = 0;
    let about = 0;
    for (const p of forces) {
      total += p.P;
      about += p.P * (p.x - a);
    }
    for (const q of weights) {
      const W = q.w * (q.to - q.from);
      total += W;
      about += W * ((q.from + q.to) / 2 - a);
    }
    for (const c of couples) about -= c.C;
    const Rb = about / (b - a);
    const Ra = total - Rb;
    const M = (x: number) => {
      let m = 0;
      if (a < x) m += Ra * (x - a);
      if (b < x) m += Rb * (x - b);
      for (const p of forces) if (p.x < x) m -= p.P * (x - p.x);
      for (const q of weights) {
        const on = Math.max(0, Math.min(x, q.to) - q.from);
        m -= q.w * on * (x - q.from - on / 2);
      }
      for (const c of couples) if (c.x < x) m -= c.C;
      return m;
    };
    const breaks = [...new Set([0, L, a, b, ...ends, ...forces.map((p) => p.x), ...couples.map((c) => c.x)])].filter((x) => x >= 0 && x <= L).sort((p, q) => p - q);
    const integral = (x: number, g: (s: number) => number) => {
      let sum = 0;
      for (let i = 0; i + 1 < breaks.length && breaks[i] < x; i++) {
        const to = Math.min(x, breaks[i + 1]);
        const EI = EIat((breaks[i] + to) / 2);
        sum += gauss((s) => (g(s) * M(s)) / EI, breaks[i], to);
      }
      return sum;
    };
    const turn = (x: number) => integral(x, () => 1);
    const drop = (x: number) => integral(x, (s) => x - s);
    const theta0 = -(drop(b) - drop(a)) / (b - a);
    const v0 = -drop(a) - theta0 * a;
    return { Ra, Rb, M, theta: (x: number) => theta0 + turn(x), v: (x: number) => v0 + theta0 * x + drop(x) };
  };
  const vertical = plane('v');
  const horizontal = plane('h');
  /** The two planes together at x: sizes. */
  const both = (x: number) => ({
    M: Math.hypot(vertical.M(x), horizontal.M(x)),
    theta: Math.hypot(vertical.theta(x), horizontal.theta(x)),
    v: Math.hypot(vertical.v(x), horizontal.v(x)),
  });
  return { L, vertical, horizontal, both, radial: [Math.hypot(vertical.Ra, horizontal.Ra), Math.hypot(vertical.Rb, horizontal.Rb)] };
}

describe('shaft form: the yardstick these tests measure with', () => {
  const EI = 2.5e6;
  const one = (L: number, over: Partial<ShaftModel>): ShaftModel => ({ segments: [{ L, EI }], bearings: [0, L], ...over });

  it('is the beam tables: a load at midspan, a load on an overhang, a couple at an end, a uniform weight', () => {
    // P at the middle of L: P·L³/48EI down, and P·L²/16EI at each end.
    const mid = bent(one(20, { forces: [{ x: 10, v: 300, h: 0 }] })).vertical;
    near(mid.Ra, 150);
    close(mid.v(10), (-300 * 20 ** 3) / (48 * EI), 1e-12);
    close(mid.theta(0), (-300 * 20 ** 2) / (16 * EI), 1e-12);
    close(mid.theta(20), (300 * 20 ** 2) / (16 * EI), 1e-12);
    near(mid.M(10), (300 * 20) / 4);
    // P on the tip of an overhang a past a span L: P·a²·(L + a)/3EI down at the tip, P·a·L²/(9√3·EI) up in the span, at L/√3.
    const tip = bent({ segments: [{ L: 26, EI }], bearings: [0, 20], forces: [{ x: 26, v: 300, h: 0 }] }).vertical;
    near(tip.Ra, (-300 * 6) / 20);
    near(tip.Rb, 300 * (1 + 6 / 20));
    close(tip.v(26), (-300 * 36 * 26) / (3 * EI), 1e-12);
    close(tip.v(20 / Math.sqrt(3)), (300 * 6 * 400) / (9 * Math.sqrt(3) * EI), 1e-12);
    near(tip.M(20), -300 * 6);
    // A counter-clockwise couple C at the left end: the shaft hogs, C·L/3EI of slope there and C·L/6EI at the far end.
    const end = bent(one(20, { couples: [{ x: 0, v: 900, h: 0 }] })).vertical;
    near(end.Ra, 900 / 20);
    near(end.M(1e-9), -900, 1e-6);
    close(end.theta(0), (900 * 20) / (3 * EI), 1e-12);
    close(end.theta(20), (-900 * 20) / (6 * EI), 1e-12);
    // Its own weight w over L: 5·w·L⁴/384EI.
    const own = bent({ segments: [{ L: 20, EI, w: 1.5 }], bearings: [0, 20] }).vertical;
    near(own.Ra, 15);
    close(own.v(10), (-5 * 1.5 * 20 ** 4) / (384 * EI), 1e-12);
    near(own.M(10), (1.5 * 400) / 8);
  });

  // A span whose outer quarters have EI₁ and whose middle half has EI₂, P at
  // the middle. By the unit load: δ = 2·∫ (P·x/2)(x/2)/EI dx over half the
  // span = P·L³/384 · (1/EI₁ + 7/EI₂).
  it('and a stepped shaft: a load at the middle of a span with a stiffer middle half', () => {
    const [EI1, EI2] = [1e6, 5e6];
    const stepped = bent({ segments: [{ L: 5, EI: EI1 }, { L: 10, EI: EI2 }, { L: 5, EI: EI1 }], bearings: [0, 20], forces: [{ x: 10, v: 0, h: 400 }] }).horizontal;
    close(stepped.v(10), ((-400 * 20 ** 3) / 384) * (1 / EI1 + 7 / EI2), 1e-12);
    // With one stiffness it is the table's again.
    near((8 / 384) * 20 ** 3, 20 ** 3 / 48);
  });
});

describe('shaft form: the shaft the page opens with', () => {
  const d = defaultShaft();

  it('is a countershaft in four diameters on two bearings: a gear between them, a pulley on the overhang', () => {
    expect(d.units).toBe('us');
    expect(d.segments.map((s) => [s.L, s.d, s.bore])).toEqual([[4, 1.5, 0], [10, 2, 0], [4, 1.5, 0], [5, 1.25, 0]]);
    expect(segmentEnds(d)).toEqual([0, 4, 14, 18, 23]);
    expect(shaftLength(d)).toBe(23);
    // Each bearing at the middle of its journal; the last 7 in overhang.
    expect(d.bearings).toEqual([2, 16]);
    expect(d.forces.map((p) => [p.x, p.v, p.vDir, p.h, p.hDir])).toEqual([[9, 1000, 'down', 360, 'towards'], [21, 400, 'down', 0, 'towards']]);
    // The gear is midway between the bearings, the pulley 5 in past the second.
    expect(d.forces[0].x).toBe((d.bearings[0] + d.bearings[1]) / 2);
    expect(d.forces[1].x - d.bearings[1]).toBe(5);
    expect(d.couples).toEqual([]);
    expect([d.material, d.E, d.density, d.ownWeight]).toEqual(['steel', 29000, 0.2836, false]);
    expectSound(d, 'the example');
    expect(formIssues(d)).toEqual([]);
    // Each call is a form of its own: an edit of one is not an edit of the next.
    expect(defaultShaft()).not.toBe(defaultShaft());
    expect(defaultShaft().segments).not.toBe(defaultShaft().segments);
    expect(defaultShaft().bearings).not.toBe(defaultShaft().bearings);
  });

  // What the page will open on, by the yardstick above. Equilibrium first,
  // which a pencil follows: the gear is midway, so it loads both bearings
  // alike; the pulley's 400 lbf, 5 in past the second bearing of a 14 in
  // span, takes 400·5/14 off the first and puts 400·19/14 on the second.
  it('its reactions and its moments are equilibrium, by hand', () => {
    const s = bent(toEngine(d).model);
    near(s.vertical.Ra, 500 - (400 * 5) / 14);
    near(s.vertical.Rb, 500 + (400 * 19) / 14);
    near(s.horizontal.Ra, 180);
    near(s.horizontal.Rb, 180);
    near(s.vertical.Ra + s.vertical.Rb, 1400);
    // The radial load on each bearing: the size of the two together.
    near(s.radial[0], Math.hypot(2500 / 7, 180));
    near(s.radial[0], 399.94, 1e-5);
    near(s.radial[1], 1058.28, 1e-5);
    // The largest moment is under the gear: 7 in from the first bearing in each plane.
    near(s.vertical.M(9), 2500);
    near(s.horizontal.M(9), 1260);
    near(s.both(9).M, 2799.57, 1e-6);
    // Over the second bearing only the pulley bends the shaft: 400 lbf × 5 in, hogging; and 3 in from the pulley, 1,200.
    near(s.vertical.M(16), -2000);
    near(s.horizontal.M(16), 0);
    near(s.vertical.M(18), -1200);
  });

  // It reads like a machine shaft — and that is all it is asked to: no limit
  // is applied to any of these. The nominal stress is the moment over the
  // section modulus of the segment it is in: where the diameter steps, the
  // smaller one.
  it('reads like a machine shaft: a few ksi, a few thousandths of an inch, some ten-thousandths of a radian at the bearings', () => {
    const model = toEngine(d).model;
    const s = bent(model);
    const Z = model.segments.map((p) => p.Z!);
    const ksi = (M: number, segment: number) => shownStress('us', M / Z[segment]);
    // The first journal at its shoulder, the body under the gear, the second journal over its bearing, the end at its shoulder.
    close(ksi(s.both(4).M, 0), 2.4141, 1e-4);
    close(ksi(s.both(9).M, 1), 3.5645, 1e-4);
    close(ksi(s.both(16).M, 2), 6.0361, 1e-4);
    close(ksi(s.both(18).M, 3), 6.2582, 1e-4);
    // The largest moment is in the 2 in body and the largest stress in the 1.25 in end, under less than half that moment.
    expect(s.both(18).M).toBeLessThan(s.both(9).M / 2);
    close(1200 / ((Math.PI * 1.25 ** 3) / 32) / 1000, 6.2582, 1e-4);
    // What each bearing must take as misalignment.
    close(s.both(2).theta, 4.4197e-4, 1e-4);
    close(s.both(16).theta, 2.5185e-4, 1e-4);
    // At the gear's mesh and at the pulley: how far the shaft has moved, and how far it has turned.
    close(s.both(9).v, 1.6674e-3, 1e-4);
    close(s.both(9).theta, 7.3162e-5, 1e-4);
    close(s.both(21).v, 3.5727e-3, 1e-4);
    close(s.both(21).theta, 1.0934e-3, 1e-4);
    // The most it moves anywhere is at the free end.
    close(s.both(23).v, 5.7506e-3, 1e-4);
    // Under the gear it goes down and towards the viewer; on the overhang, down and — levered about the second bearing — away.
    expect(s.vertical.v(9)).toBeLessThan(0);
    expect(s.horizontal.v(9)).toBeLessThan(0);
    expect(s.vertical.v(23)).toBeLessThan(0);
    expect(s.horizontal.v(23)).toBeGreaterThan(0);
    // On its bearings it does not move at all.
    for (const x of d.bearings) expect(Math.abs(s.vertical.v(x)) + Math.abs(s.horizontal.v(x))).toBeLessThan(1e-15);
  });

  it('weighs a hundredth of what it carries: its own weight is left out, and can be asked for', () => {
    const heavy = toEngine(shaft({ ownWeight: true })).model;
    const weight = heavy.segments.reduce((sum, p) => sum + p.w! * p.L, 0);
    near(weight, 0.2836 * (Math.PI / 4) * (1.5 ** 2 * 4 + 2 ** 2 * 10 + 1.5 ** 2 * 4 + 1.25 ** 2 * 5));
    near(weight, 14.659, 1e-5);
    expect(toEngine(d).model.segments.every((p) => !('w' in p))).toBe(true);
    // With it the two bearings carry 1,400 lbf and the shaft.
    const s = bent(heavy);
    near(s.vertical.Ra + s.vertical.Rb, 1400 + weight);
  });

  it('is its own address read back, id for id', () => {
    expect(decodeShaft(encodeShaft(d))).toEqual(d);
    const si = convertShaft(d, 'si');
    expect(decodeShaft(encodeShaft(si))).toEqual(si);
  });
});

describe('shaft form: the units', () => {
  it('each system has every label the page writes, and a slope is in radians in both', () => {
    expect(SHAFT_UNITS.us).toEqual({ length: 'in', diameter: 'in', force: 'lbf', moment: 'lbf·in', stress: 'ksi', E: 'ksi', deflection: 'in', slope: 'rad', density: 'lb/in³', line: 'lbf/in', I: 'in⁴', Z: 'in³' });
    expect(SHAFT_UNITS.si).toEqual({ length: 'mm', diameter: 'mm', force: 'N', moment: 'N·m', stress: 'MPa', E: 'MPa', deflection: 'mm', slope: 'rad', density: 'kg/m³', line: 'N/mm', I: 'mm⁴', Z: 'mm³' });
    expect(Object.keys(SHAFT_UNITS.us)).toEqual(Object.keys(SHAFT_UNITS.si));
  });

  // The definitions: 1 in = 25.4 mm, 1 lbf = 4.4482216152605 N (one pound,
  // 0.45359237 kg, under standard gravity, 9.80665 m/s²).
  it('the factors between the two are the exact ones', () => {
    expect(SHAFT_US_TO_SI.length).toBe(25.4);
    expect(SHAFT_US_TO_SI.force).toBe(4.4482216152605);
    near(SHAFT_US_TO_SI.force, 0.45359237 * 9.80665, 1e-15);
    // lbf·in to N·m: 4.448… N × 0.0254 m.
    near(SHAFT_US_TO_SI.moment, 0.1129848290276167, 1e-15);
    // ksi to MPa: 1,000 lbf over a square inch, 645.16 mm².
    near(SHAFT_US_TO_SI.E, 6.894757293168361, 1e-15);
    // lb/in³ to kg/m³: 0.45359237 kg in 16.387064 cm³.
    near(SHAFT_US_TO_SI.density, 27679.904710203125, 1e-15);
    near(SHAFT_US_TO_SI.density, 0.45359237 / 16.387064e-6, 1e-15);
  });

  it('switching units converts every quantity, each as its own', () => {
    const si = convertShaft(worked(), 'si');
    expect(si.units).toBe('si');
    // Inches to millimetres: lengths, diameters, bores, and every position.
    expect(si.segments.map((s) => [s.L, s.d, s.bore])).toEqual([[152.4, 50.8, 0], [203.2, 76.2, 38.1], [101.6, 25.4, 0]]);
    expect(si.bearings).toEqual([76.2, 406.4]);
    expect(si.forces.map((p) => p.x)).toEqual([254, 457.2]);
    expect(si.couples[0].x).toBe(254);
    // Pounds-force to newtons, lbf·in to N·m.
    near(si.forces[0].v, 500 * 4.4482216152605, 1e-5);
    near(si.forces[0].h, 200 * 4.4482216152605, 1e-5);
    near(si.forces[1].v, 150 * 4.4482216152605, 1e-5);
    expect(si.forces[1].h).toBe(0);
    near(si.couples[0].v, 300 * 0.1129848290276167, 1e-5);
    near(si.couples[0].h, 120 * 0.1129848290276167, 1e-5);
    // A material of the visitor's own: ksi to MPa, lb/in³ to kg/m³.
    near(si.E, 30000 * 6.894757293168361, 1e-5);
    near(si.density, 0.3 * 27679.904710203125, 1e-5);
    // Nothing else of a row changes, and nothing else of the form.
    expect(si.segments.map((s) => s.id)).toEqual([11, 12, 13]);
    expect(si.forces.map((p) => [p.id, p.vDir, p.hDir])).toEqual([[21, 'down', 'away'], [22, 'up', 'towards']]);
    expect(si.couples.map((p) => [p.id, p.vDir, p.hDir])).toEqual([[31, 'cw', 'ccw']]);
    expect([si.material, si.ownWeight, si.nextId]).toEqual(['custom', true, 40]);
  });

  // 29,000 ksi is 199,948 MPa, and nobody types that: steel is 200,000 MPa
  // on a metric drawing. Each listed material has its round numbers in each
  // system; only what the visitor typed is converted.
  it('a listed material keeps its own round numbers in each system', () => {
    for (const material of ['steel', 'stainless', 'aluminum'] as const) {
      const us = reduceShaft(defaultShaft(), { type: 'material', material });
      const si = convertShaft(us, 'si');
      expect([si.material, si.E, si.density], material).toEqual([material, SHAFT_MATERIALS[material].si.E, SHAFT_MATERIALS[material].si.density]);
      expect(convertShaft(si, 'us'), material).toEqual(us);
      // The two columns are the same metal: within a percent of one another.
      near(SHAFT_MATERIALS[material].us.E * SHAFT_US_TO_SI.E, SHAFT_MATERIALS[material].si.E, 0.01);
      near(SHAFT_MATERIALS[material].us.density * SHAFT_US_TO_SI.density, SHAFT_MATERIALS[material].si.density, 0.01);
    }
    expect(SHAFT_MATERIALS.steel).toEqual({ us: { E: 29000, density: 0.2836 }, si: { E: 200000, density: 7850 } });
    expect(SHAFT_MATERIALS.stainless).toEqual({ us: { E: 28000, density: 0.289 }, si: { E: 193000, density: 8000 } });
    expect(SHAFT_MATERIALS.aluminum).toEqual({ us: { E: 10100, density: 0.0975 }, si: { E: 69600, density: 2700 } });
    // "Steel" and "Aluminum" are one modulus across the catalogue.
    for (const material of ['steel', 'aluminum'] as const) {
      for (const units of ['us', 'si'] as const) expect(SHAFT_MATERIALS[material][units].E, `${material} ${units}`).toBe(MATERIALS[material][units]);
    }
  });

  // Looking at a shaft in the other system and coming back must not change it.
  it('and back again, to the very same numbers', () => {
    const d = defaultShaft();
    expect(convertShaft(convertShaft(d, 'si'), 'us')).toEqual(d);
    expect(convertShaft(d, 'us')).toBe(d);
    expect(convertShaft(convertShaft(worked(), 'si'), 'us')).toEqual(worked());
    const odd: ShaftForm = {
      ...worked(),
      segments: [seg(1, 3.125, 0.875), seg(2, 12.75, 2.4375, 1.0625), seg(3, 0.5625, 1.1875, 0.25)],
      bearings: [1.5625, 15.875],
      forces: [force(4, 8.375, 1250, 'up', 455, 'away'), force(5, 16.4375, 0.85, 'down', 37.25, 'towards')],
      couples: [couple(6, 8.375, 2400, 'cw', 87.5, 'cw')],
      E: 16500,
      density: 0.16,
    };
    expect(convertShaft(convertShaft(odd, 'si'), 'us')).toEqual(odd);
    const mm = convertShaft(odd, 'si');
    expect(convertShaft(convertShaft(mm, 'us'), 'si')).toEqual(mm);
    // A round metric shaft, the other way.
    expect(convertShaft(convertShaft(metric(), 'us'), 'si')).toEqual(metric());
    const round: ShaftForm = { ...metric(), segments: [seg(1, 120, 35), seg(2, 250, 60, 22.5), seg(3, 75, 30)], bearings: [60, 407.5], forces: [force(4, 245, 3500, 'up', 1250, 'away')], couples: [couple(5, 245, 85, 'cw', 12.5)], material: 'custom', E: 114000, density: 4430 };
    expect(convertShaft(convertShaft(round, 'us'), 'si')).toEqual(round);
  });

  // A shaft dimensioned in inches is in sixteenths, and 16 7/16 in is
  // 16.4375: six figures, and exactly 417.5125 mm. A length is converted to
  // the eight figures a field shows — at the six of every other quantity it
  // was 417.51 mm, and 16.4374 in on the way back.
  it('a length in fractions of an inch is the same length in millimetres, and the same fraction on the way back', () => {
    /** One length there, and there and back: through a bearing, which is nothing but a length. */
    const there = (x: number, units: 'us' | 'si') => convertShaft(shaft({ units, segments: [seg(1, 1, 1)], bearings: [x, x], forces: [] }), units === 'us' ? 'si' : 'us');
    const back = (x: number, units: 'us' | 'si') => convertShaft(there(x, units), units).bearings[0];
    expect(there(16.4375, 'us').bearings[0]).toBe(417.5125);
    expect(back(16.4375, 'us')).toBe(16.4375);
    expect([tidy(16.4375 * 25.4), tidy(417.51 / 25.4)]).toEqual([417.51, 16.4374]);
    expect(there(1.015625, 'us').bearings[0]).toBe(25.796875);
    expect(back(1.015625, 'us')).toBe(1.015625);
    // Every quantity that is a length: a segment's three, a bearing, a load's place.
    const f = convertShaft(shaft({ segments: [seg(1, 16.4375, 2.4375, 1.03125)], bearings: [0.09375, 16.4375], forces: [force(2, 12.0625, 5)], couples: [couple(3, 15.9375, 5)] }), 'si');
    expect([f.segments[0].L, f.segments[0].d, f.segments[0].bore, ...f.bearings, f.forces[0].x, f.couples[0].x]).toEqual([417.5125, 61.9125, 26.19375, 2.38125, 417.5125, 306.3875, 404.8125]);
    // Counted: every length by sixteenths of an inch up to 40 in, by thousandths up to 30 in, by twentieths of a
    // millimetre up to a metre.
    let [sixteenths, sixFigures, thousandths, twentieths] = [0, 0, 0, 0];
    for (let k = 1; k <= 640; k++) {
      sixteenths += Number(back(k / 16, 'us') !== k / 16);
      // …of which the six figures of the other quantities would have changed 189.
      sixFigures += Number(tidy(tidy((k / 16) * 25.4) * (1 / 25.4)) !== k / 16);
    }
    for (let k = 1; k <= 30000; k++) thousandths += Number(back(k / 1000, 'us') !== k / 1000);
    for (let k = 1; k <= 20000; k++) twentieths += Number(back(k / 20, 'si') !== k / 20);
    expect([sixteenths, thousandths, twentieths]).toEqual([0, 0, 0]);
    expect(sixFigures).toBe(189);
    // A round length is a round length: no figure is added to make eight.
    expect([4, 1.5, 10, 1.25, 21].map((x) => there(x, 'us').bearings[0])).toEqual([101.6, 38.1, 254, 31.75, 533.4]);
    expect(there(50, 'si').bearings[0]).toBe(1.968504);
    expect(back(50, 'si')).toBe(50);
    // What is not a number stays what it is, and nothing is nothing.
    expect([0, Infinity, -Infinity, Number.NaN].map((x) => there(x, 'us').bearings[0])).toEqual([0, Infinity, -Infinity, Number.NaN]);
    // A force is converted as every calculator converts one (beam/model.ts, `tidy`): to six figures, or to fewer that say the same.
    expect(convertShaft(shaft({ forces: [force(2, 9, 1000, 'down', 360)] }), 'si').forces[0]).toMatchObject({ v: 4448.2, h: 1601.36 });
    expect([tidy(1000 * 4.4482216152605), tidy(360 * 4.4482216152605)]).toEqual([4448.2, 1601.36]);
  });

  it('switching units is the same edit as convertShaft', () => {
    expect(reduceShaft(worked(), { type: 'units', units: 'si' })).toEqual(convertShaft(worked(), 'si'));
    expect(reduceShaft(worked(), { type: 'units', units: 'us' })).toEqual(worked());
  });

  // What the engine works in, and how its two results that are not shown as
  // they come are brought back.
  it('the engine’s moment and stress come back in the units shown', () => {
    expect(TO_ENGINE.us).toEqual({ E: 1000, moment: 1, density: 1 });
    expect(TO_ENGINE.si.E).toBe(1);
    expect(TO_ENGINE.si.moment).toBe(1000);
    // kg/m³ × 9.80665 m/s² is N/m³; a cubic metre is 10⁹ mm³.
    near(TO_ENGINE.si.density * 1e9, 9.80665, 1e-15);
    // 2,500 lbf·in is shown as that; 250,000 N·mm is 250 N·m.
    expect(shownMoment('us', 2500)).toBe(2500);
    expect(shownMoment('si', 250000)).toBe(250);
    // 6,258 lbf/in² is 6.258 ksi; 43.15 N/mm² is 43.15 MPa.
    expect(shownStress('us', 6258)).toBe(6.258);
    expect(shownStress('si', 43.15)).toBe(43.15);
  });
});

/* ── A position on an end of a segment ────────────────────────────────── */

describe('shaft form: a position on an end of a segment', () => {
  // The two shafts the page got wrong when its units were switched: 120 + 300 + 80 mm with a bearing on each end, and
  // 250 + 105 + 155 + 250 + 188 mm with an applied moment on the shoulder at 510 mm.
  const onEnds = (): ShaftForm => ({ ...metric(), segments: [seg(1, 120, 40), seg(2, 300, 50), seg(3, 80, 40)], bearings: [0, 500], forces: [force(4, 250, 1000)], couples: [], ownWeight: false, nextId: 5 });
  const onShoulder = (): ShaftForm => ({ ...metric(), segments: [seg(1, 250, 30), seg(2, 105, 50), seg(3, 155, 20), seg(4, 250, 25), seg(5, 188, 35)], bearings: [95, 853], forces: [force(6, 304, 2676, 'down', 1490)], couples: [couple(7, 510, 418, 'cw')], ownWeight: false, nextId: 8 });

  it('the units switched, each length is written to its own eight figures: they no longer add up to the place that stood on their end', () => {
    const us = convertShaft(onEnds(), 'us');
    expect(us.segments.map((s) => s.L)).toEqual([4.7244094, 11.811024, 3.1496063]);
    expect(us.bearings).toEqual([0, 19.68504]);
    // 19.6850397 in. The bearing is held 3 × 10⁻⁷ in past it: fifteen billionths of the shaft, where an engine takes one.
    near(shaftLength(us), 19.6850397, 1e-12);
    expect((us.bearings[1] - shaftLength(us)) / shaftLength(us)).toBeGreaterThan(1.5e-8);
    // And the applied moment that stood on the shoulder stands 2.6 × 10⁻⁷ in inside the segment before it.
    const stepped = convertShaft(onShoulder(), 'us');
    expect(stepped.couples[0].x).toBe(20.07874);
    near(segmentEnds(stepped)[3], 20.0787403, 1e-12);
    expect((segmentEnds(stepped)[3] - stepped.couples[0].x) / shaftLength(stepped)).toBeGreaterThan(5e-9);
  });

  it('the engine is given each ON its end: the end of the shaft, the shoulder', () => {
    const us = convertShaft(onEnds(), 'us');
    expect(toEngine(us).model.bearings).toEqual([0, shaftLength(us)]);
    const stepped = convertShaft(onShoulder(), 'us');
    expect(toEngine(stepped).model.couples![0].x).toBe(segmentEnds(stepped)[3]);
    // What stands on no end is sent as it is held.
    expect(toEngine(stepped).model.bearings).toEqual([3.7401575, 33.582677]);
    expect(toEngine(stepped).model.forces![0].x).toBe(11.968504);
    // The form is not written on: its fields and its link are what they were.
    const held = frozen(convertShaft(onShoulder(), 'us'));
    toEngine(held);
    drawingOf(held, 'vertical');
    expect([held.couples[0].x, held.bearings[1]]).toEqual([20.07874, 33.582677]);
    // The link the page wrote for the switched shaft opens on the same shaft, given to the engine the same way.
    const again = decodeShaft(encodeShaft(us))!;
    expect(again.bearings).toEqual([0, 19.68504]);
    expect(toEngine(again).model.bearings).toEqual([0, shaftLength(again)]);
    // In the units it was typed in nothing was moved, and nothing is.
    expect(toEngine(onEnds()).model.bearings).toEqual([0, 500]);
    expect(toEngine(onShoulder()).model.couples![0].x).toBe(510);
  });

  it('and the drawing has each there: the bearing on the end of the shaft, the applied moment on its shoulder', () => {
    const us = convertShaft(onEnds(), 'us');
    expect(drawingOf(us, 'vertical').bearings.map((b) => b.x)).toEqual([0, shaftLength(us)]);
    const stepped = convertShaft(onShoulder(), 'us');
    expect(drawingOf(stepped, 'vertical').couples.map((c) => c.x)).toEqual([segmentEnds(stepped)[3]]);
    // A force on the end of the shaft: 570 mm of 100 + 250 + 100 + 120.
    const tip = convertShaft({ ...metric(), segments: [seg(1, 100, 40), seg(2, 250, 50), seg(3, 100, 40), seg(4, 120, 30)], bearings: [50, 400], forces: [force(5, 570, 1800)], couples: [], nextId: 6 }, 'us');
    expect(tip.forces[0].x).not.toBe(shaftLength(tip));
    expect(drawingOf(tip, 'vertical').forces.map((p) => p.x)).toEqual([shaftLength(tip)]);
    expect(toEngine(tip).model.forces![0].x).toBe(shaftLength(tip));
  });

  it('seatOf: the nearest end within SEAT of the shaft’s length, and nothing else', () => {
    expect(SEAT).toBe(4e-7);
    // The example: ends at 0, 4, 14, 18 and 23 in. Four ten-millionths of 23 in are 9.2 × 10⁻⁶ in.
    const seat = seatOf(defaultShaft());
    // On an end, and anywhere that is near none: itself.
    expect([0, 4, 14, 18, 23, 2, 9, 16, 21, 30, -1].map(seat)).toEqual([0, 4, 14, 18, 23, 2, 9, 16, 21, 30, -1]);
    // Within that of an end, either side of it: that end.
    expect([4 + 9e-6, 4 - 9e-6, 14 + 1e-9, 18 - 3e-7, 23 + 9e-6, 23 - 9e-6, 9e-6, -9e-6].map(seat)).toEqual([4, 4, 14, 18, 23, 23, 0, 0]);
    // Past it, it is where it is — off the shaft, when that is past an end of it.
    const far = [4 + 9.5e-6, 4 - 9.5e-6, 23 + 9.5e-6, -9.5e-6];
    expect(far.map(seat)).toEqual(far);
    // What is not a number stays what it is.
    expect([Number.NaN, Infinity, -Infinity].map(seat)).toEqual([Number.NaN, Infinity, -Infinity]);
    // Of two ends that near one another (no engine solves a segment that short), the nearer.
    const pair = seatOf({ segments: [seg(1, 10, 1), seg(2, 2e-6, 1), seg(3, 10, 1)] });
    expect([pair(10 + 0.5e-6), pair(10 + 1.5e-6), pair(10)]).toEqual([10, 10 + 2e-6, 10]);
    // A length that is none counts for nothing (`segmentEnds`); on a shaft with no length, or with one past every number, nothing is moved.
    expect(seatOf({ segments: [seg(1, 6, 1), seg(2, Number.NaN, 1), seg(3, 4, 1)] })(6 + 1e-6)).toBe(6);
    expect(seatOf({ segments: [seg(1, 0, 1), seg(2, Number.NaN, 1)] })(1e-300)).toBe(1e-300);
    expect(seatOf({ segments: [seg(1, 1e308, 1), seg(2, 1e308, 1)] })(5)).toBe(5);
    // It is under half the shortest segment the engine solves, a millionth of the shaft: no position is within it of two ends of a shaft that is solved.
    expect(SEAT).toBeLessThan(1e-6 / 2);
  });

  // How far the units leave a position from the end it stood on. One rounding of a length is at most 6 × 10⁻⁸ of it
  // (`tidyLength`); a position has its own, and the lengths before it theirs: 1.2 × 10⁻⁷ of the shaft after one switch.
  // One read from a link was the eight figures of their sum to begin with, 5 × 10⁻⁸ more; and lengths of eight figures
  // do not all come back to the number typed, so there and back is further than there.
  it(
    'counted: a bearing on each end and an applied moment on every shoulder, the units switched one to four times — each is given to the engine on its end',
    () => {
      const { rnd } = dice(20261013);
      const families: [string, 'us' | 'si', () => number][] = [
        ['whole millimetres', 'si', () => 10 + Math.floor(rnd() * 400)],
        ['sixty-fourths of an inch', 'us', () => (32 + Math.floor(rnd() * 64 * 14)) / 64],
        ['sixty-fourths, 10 in and more', 'us', () => (640 + Math.floor(rnd() * 64 * 30)) / 64],
        ['eight figures, in inches', 'us', () => Number((2 + rnd() * 38).toPrecision(8))],
        ['eight figures, in millimetres', 'si', () => Number((20 + rnd() * 900).toPrecision(8))],
      ];
      const same = (p: number[], q: number[]) => p.length === q.length && p.every((v, i) => v === q[i]);
      const wrong: string[] = [];
      let [forms, moved, furthest] = [0, 0, 0];
      for (const [name, units, length] of families) {
        for (let i = 0; i < 300; i++) {
          const segments = Array.from({ length: 2 + Math.floor(rnd() * 7) }, (_, k) => seg(k + 1, length(), 1));
          const ends = segmentEnds({ segments });
          // As a link holds it: every number to the eight figures a field shows.
          let form = decodeShaft(encodeShaft({ ...(units === 'us' ? worked() : metric()), segments, bearings: [0, ends[ends.length - 1]], forces: [], couples: ends.slice(1, -1).map((x, k) => couple(20 + k, x, 10)) }))!;
          for (let turn = 0; turn <= 4; turn++) {
            if (turn > 0) form = convertShaft(form, form.units === 'us' ? 'si' : 'us');
            const at = segmentEnds(form);
            const L = at[at.length - 1];
            const off = [form.bearings[1] - L, ...form.couples.map((c, k) => c.x - at[k + 1])].map((d) => Math.abs(d) / L);
            forms += 1;
            furthest = Math.max(furthest, ...off);
            // (More than a billionth of the shaft from its end: what the engine would have taken for another place.)
            moved += Number(off.some((d) => d > 1e-9));
            const { model } = toEngine(form);
            if (!same(model.bearings, [0, L]) || !same(model.couples!.map((c) => c.x), at.slice(1, -1))) wrong.push(`${name} ${i}, switched ${turn} times: ${encodeShaft(form)}`);
          }
        }
      }
      expect(wrong).toEqual([]);
      // Of the 7,500 forms, those with a position off its end by more than the engine takes: without `seatOf`, each a
      // shaft refused or a shoulder's applied moment given to the segment beside it.
      expect([forms, moved]).toEqual([7500, 5475]);
      // The furthest of them, of the shaft's length: past what one switch of a shaft as typed can do, and well under SEAT.
      expect(furthest).toBeGreaterThan(1.5e-7);
      expect(furthest).toBeLessThan(2.5e-7);
    },
    30_000,
  );
});

describe('shaft form: what each edit does', () => {
  const start = defaultShaft();

  // The rules every edit is held to below, held themselves: a list that could never say anything would test nothing.
  it('a form that is not sound is said not to be', () => {
    expect(unsound(start)).toEqual([]);
    expect(unsound(worked())).toEqual([]);
    expect(unsound(metric())).toEqual([]);
    const broken: [string, ShaftForm][] = [
      ['no segment', shaft({ segments: [] })],
      ['nine segments', shaft({ segments: Array.from({ length: 9 }, (_, i) => seg(20 + i, 1, 1)), nextId: 40 })],
      ['thirteen forces', shaft({ forces: Array.from({ length: 13 }, (_, i) => force(20 + i, 1, 1)), nextId: 40 })],
      ['thirteen couples', shaft({ couples: Array.from({ length: 13 }, (_, i) => couple(20 + i, 1, 1)), nextId: 40 })],
      ['one bearing', shaft({ bearings: [2] as unknown as [number, number] })],
      ['a bearing that is no number', shaft({ bearings: [2, '16'] as unknown as [number, number] })],
      ['a segment short of a field', shaft({ segments: [{ id: 1, L: 4, d: 2 } as SegmentRow] })],
      ['a segment with a field of another row', shaft({ segments: [{ ...seg(1, 4, 2), x: 3 } as SegmentRow] })],
      ['a force with no direction', shaft({ forces: [{ ...force(5, 9, 1), vDir: 'left' as 'up' }] })],
      ['a couple pointing like a force', shaft({ couples: [{ ...couple(7, 9, 1), hDir: 'away' as 'cw' }] })],
      ['two rows with one id', shaft({ forces: [force(4, 9, 1)] })],
      ['a next id in use', shaft({ nextId: 6 })],
      ['steel beside another modulus', shaft({ E: 30000 })],
      ['steel beside another density', shaft({ density: 0.283 })],
      ['steel in millimetres beside its numbers in inches', shaft({ units: 'si' })],
      ['a material that is none', shaft({ material: 'wood' as ShaftMaterial })],
      ['a weight that is neither asked for nor not', shaft({ ownWeight: 1 as unknown as boolean })],
    ];
    for (const [what, f] of broken) expect(unsound(f).length, what).toBeGreaterThan(0);
  });

  it('a new segment is added after the last, a copy of it — and nothing else moves', () => {
    const f = reduceShaft(start, { type: 'add', list: 'segments' });
    expect(f.segments).toHaveLength(5);
    expect(f.segments.slice(0, 4)).toEqual(start.segments);
    expect(f.segments[4]).toEqual({ id: 7, L: 5, d: 1.25, bore: 0 });
    expect(f.nextId).toBe(8);
    expect(shaftLength(f)).toBe(28);
    expect({ ...f, segments: start.segments, nextId: start.nextId }).toEqual(start);
    // The last one's own numbers, whatever they are: its bore too.
    const tube = reduceShaft(worked(), { type: 'patch', list: 'segments', id: 13, patch: { L: 7.5, d: 2.5, bore: 1.25 } });
    expect(reduceShaft(tube, { type: 'add', list: 'segments' }).segments[3]).toEqual({ id: 40, L: 7.5, d: 2.5, bore: 1.25 });
    // The rows that were there are the rows they were.
    for (const [i, s] of start.segments.entries()) expect(f.segments[i]).toBe(s);
    expect(f.forces).toBe(start.forces);
    expect(f.bearings).toBe(start.bearings);
  });

  it('stops at eight segments', () => {
    let f = start;
    for (let i = 0; i < MAX_SEGMENTS + 4; i++) f = reduceShaft(f, { type: 'add', list: 'segments' });
    expect(f.segments).toHaveLength(MAX_SEGMENTS);
    expect(MAX_SEGMENTS).toBe(8);
    expectSound(f, 'eight segments');
    expect(reduceShaft(f, { type: 'add', list: 'segments' })).toBe(f);
  });

  // Only the segment goes. A bearing and a load are placed from the left
  // end of the shaft, and keep the distance that was typed: one that is
  // then past the end is for the engine to name, not for the form to move.
  it('removing a segment removes THAT segment: the bearings and the loads keep their distances from the left end', () => {
    for (const id of [1, 2, 3, 4]) {
      const f = reduceShaft(start, { type: 'remove', list: 'segments', id });
      expect(f.segments.map((s) => s.id), String(id)).toEqual([1, 2, 3, 4].filter((i) => i !== id));
      for (const s of f.segments) expect(s, String(id)).toBe(start.segments.find((q) => q.id === s.id));
      expect(f.bearings, String(id)).toBe(start.bearings);
      expect(f.forces, String(id)).toBe(start.forces);
      expect(f.couples, String(id)).toBe(start.couples);
      expect({ ...f, segments: start.segments }, String(id)).toEqual(start);
      expectSound(f, `without segment ${id}`);
    }
    // Without its 10 in body the shaft is 13 in long: the second bearing, at 16 in, and the pulley, at 21 in, are
    // where they were typed — off it. Nothing has been brought back onto the shaft.
    const short = reduceShaft(start, { type: 'remove', list: 'segments', id: 2 });
    expect(shaftLength(short)).toBe(13);
    expect(short.bearings[1]).toBe(16);
    expect(short.forces[1].x).toBe(21);
    expect(toEngine(short).model.bearings).toEqual([2, 16]);
    expect(toEngine(short).model.forces!.map((p) => p.x)).toEqual([9, 21]);
    // The drawing leaves out what it cannot place; the model does not.
    expect(drawingOf(short, 'vertical').bearings.map((p) => p.x)).toEqual([2]);
    expect(drawingOf(short, 'vertical').forces.map((p) => p.x)).toEqual([9]);
  });

  it('a shaft is never left without a segment, and a segment that is not there is not removed', () => {
    const one = shaft({ segments: [seg(7, 12, 1.5)], nextId: 9 });
    expect(reduceShaft(one, { type: 'remove', list: 'segments', id: 7 })).toBe(one);
    expect(reduceShaft(start, { type: 'remove', list: 'segments', id: 999 })).toBe(start);
    // A force's id is no segment's.
    expect(reduceShaft(start, { type: 'remove', list: 'segments', id: 5 })).toBe(start);
    // Down to one, and no further.
    let f = start;
    for (const id of [1, 2, 3, 4]) f = reduceShaft(f, { type: 'remove', list: 'segments', id });
    expect(f.segments.map((s) => s.id)).toEqual([4]);
  });

  it('adding a segment and taking it away again is the shaft of before', () => {
    const f = worked();
    const more = reduceShaft(f, { type: 'add', list: 'segments' });
    const back = reduceShaft(more, { type: 'remove', list: 'segments', id: more.segments[3].id });
    expect({ ...back, nextId: 0 }).toEqual({ ...f, nextId: 0 });
    // …and the id it had is not handed out again.
    expect(reduceShaft(back, { type: 'add', list: 'segments' }).segments[3].id).toBeGreaterThan(more.segments[3].id);
  });

  it('a new load is the usual one of its kind, at the middle of the shaft: all in the vertical plane, pointing the positive way', () => {
    const p = reduceShaft(start, { type: 'add', list: 'forces' });
    expect(p.forces[2]).toEqual({ id: 7, x: 11.5, v: 100, vDir: 'down', h: 0, hDir: 'towards' });
    expect(p.nextId).toBe(8);
    const q = reduceShaft(p, { type: 'add', list: 'couples' });
    expect(q.couples).toEqual([{ id: 8, x: 11.5, v: 100, vDir: 'ccw', h: 0, hDir: 'ccw' }]);
    expect(q.nextId).toBe(9);
    // The engine is given each as a positive number.
    expect(toEngine(q).model.forces![2]).toEqual({ x: 11.5, v: 100, h: 0 });
    expect(toEngine(q).model.couples![0]).toEqual({ x: 11.5, v: 100, h: 0 });
    // In SI the starting values are SI-sized, at the middle of a shaft in millimetres (to four figures).
    const si = convertShaft(start, 'si');
    expect(shaftLength(si)).toBeCloseTo(584.2, 9);
    expect(reduceShaft(si, { type: 'add', list: 'forces' }).forces[2]).toEqual({ id: 7, x: 292.1, v: 500, vDir: 'down', h: 0, hDir: 'towards' });
    expect(reduceShaft(si, { type: 'add', list: 'couples' }).couples[0]).toEqual({ id: 7, x: 292.1, v: 10, vDir: 'ccw', h: 0, hDir: 'ccw' });
    // A length that is not one counts for nothing: the load is put on the rest of the shaft.
    const broken = reduceShaft(start, { type: 'patch', list: 'segments', id: 2, patch: { L: Number.NaN } });
    expect(reduceShaft(broken, { type: 'add', list: 'forces' }).forces[2].x).toBe(6.5);
  });

  it('stops at twelve forces and at twelve couples', () => {
    let f = start;
    for (let i = 0; i < MAX_ROWS + 5; i++) f = reduceShaft(reduceShaft(f, { type: 'add', list: 'forces' }), { type: 'add', list: 'couples' });
    expect([f.forces.length, f.couples.length]).toEqual([MAX_ROWS, MAX_ROWS]);
    expect(MAX_ROWS).toBe(12);
    expectSound(f, 'twelve of each');
    expect(reduceShaft(f, { type: 'add', list: 'forces' })).toBe(f);
    expect(reduceShaft(f, { type: 'add', list: 'couples' })).toBe(f);
  });

  it('removing a load removes THAT load, and its id is not handed out again', () => {
    const f = shaft({ forces: [force(11, 1, 1), force(12, 2, 2), force(13, 3, 3)], couples: [couple(21, 1, 1), couple(22, 2, 2)], nextId: 30 });
    expect(reduceShaft(f, { type: 'remove', list: 'forces', id: 11 }).forces.map((p) => p.id)).toEqual([12, 13]);
    expect(reduceShaft(f, { type: 'remove', list: 'forces', id: 12 }).forces.map((p) => p.id)).toEqual([11, 13]);
    expect(reduceShaft(f, { type: 'remove', list: 'forces', id: 13 }).forces.map((p) => p.id)).toEqual([11, 12]);
    expect(reduceShaft(f, { type: 'remove', list: 'couples', id: 21 }).couples.map((p) => p.id)).toEqual([22]);
    // The rows of the other lists are not its business, nor an id that is nobody's.
    const other = reduceShaft(f, { type: 'remove', list: 'couples', id: 11 });
    expect([other.forces, other.couples, other.segments]).toEqual([f.forces, f.couples, f.segments]);
    expect(reduceShaft(f, { type: 'remove', list: 'forces', id: 999 }).forces).toEqual(f.forces);
    const less = reduceShaft(f, { type: 'remove', list: 'forces', id: 13 });
    expect(reduceShaft(less, { type: 'add', list: 'forces' }).forces[2].id).toBe(30);
  });

  it('changes one row and leaves the others — and a row keeps its id', () => {
    const f = reduceShaft(start, { type: 'patch', list: 'segments', id: 2, patch: { L: 12, bore: 0.75 } });
    expect(f.segments[1]).toEqual({ id: 2, L: 12, d: 2, bore: 0.75 });
    expect([f.segments[0], f.segments[2], f.segments[3]]).toEqual([start.segments[0], start.segments[2], start.segments[3]]);
    expect(f.segments[0]).toBe(start.segments[0]);
    // The body is 2 in longer: the bearing and the pulley past it are where they were typed.
    expect(f.bearings).toBe(start.bearings);
    expect(f.forces).toBe(start.forces);
    const g = reduceShaft(start, { type: 'patch', list: 'forces', id: 6, patch: { x: 22, v: 250, vDir: 'up', h: 120, hDir: 'away' } });
    expect(g.forces[1]).toEqual({ id: 6, x: 22, v: 250, vDir: 'up', h: 120, hDir: 'away' });
    expect(g.forces[0]).toBe(start.forces[0]);
    const h = reduceShaft(worked(), { type: 'patch', list: 'couples', id: 31, patch: { h: 75, hDir: 'cw' } });
    expect(h.couples[0]).toEqual({ id: 31, x: 10, v: 300, vDir: 'cw', h: 75, hDir: 'cw' });
    // No edit of a row makes it another row.
    expect(reduceShaft(start, { type: 'patch', list: 'segments', id: 2, patch: { id: 99, d: 3 } }).segments[1]).toEqual({ id: 2, L: 10, d: 3, bore: 0 });
    expect(reduceShaft(start, { type: 'patch', list: 'forces', id: 999, patch: { v: 1 } })).toEqual(start);
  });

  it('a bearing is moved, the first or the second, and there is no third', () => {
    const f = reduceShaft(start, { type: 'bearing', index: 0, x: 1.5 });
    expect(f.bearings).toEqual([1.5, 16]);
    expect(reduceShaft(f, { type: 'bearing', index: 1, x: 20 }).bearings).toEqual([1.5, 20]);
    // To the right of the other, or off the shaft: as typed. The engine takes them in either order.
    expect(reduceShaft(start, { type: 'bearing', index: 0, x: 19 }).bearings).toEqual([19, 16]);
    expect(reduceShaft(start, { type: 'bearing', index: 1, x: -3 }).bearings).toEqual([2, -3]);
    for (const index of [2, -1, 0.5, Number.NaN]) expect(reduceShaft(start, { type: 'bearing', index, x: 5 }), String(index)).toBe(start);
    // The example is not written on: each form has its own pair.
    expect(start.bearings).toEqual([2, 16]);
    expect({ ...f, bearings: start.bearings }).toEqual(start);
  });

  it('a material is chosen with its modulus and its density, in the form’s units; the visitor’s own keeps what is typed', () => {
    const al = reduceShaft(start, { type: 'material', material: 'aluminum' });
    expect([al.material, al.E, al.density]).toEqual(['aluminum', 10100, 0.0975]);
    expect({ ...al, material: 'steel', E: 29000, density: 0.2836 }).toEqual(start);
    expect(reduceShaft(convertShaft(start, 'si'), { type: 'material', material: 'stainless' })).toMatchObject({ material: 'stainless', E: 193000, density: 8000 });
    const own = reduceShaft(al, { type: 'material', material: 'custom' });
    expect([own.material, own.E, own.density]).toEqual(['custom', 10100, 0.0975]);
    // Back to a listed one: its numbers, not the ones typed.
    expect(reduceShaft({ ...own, E: 16500, density: 0.16 }, { type: 'material', material: 'steel' })).toMatchObject({ material: 'steel', E: 29000, density: 0.2836 });
    // What is no material is not one: "constructor" is a property of every object.
    for (const material of ['constructor', 'toString', '__proto__', 'wood', '']) expect(reduceShaft(start, { type: 'material', material: material as ShaftMaterial }), material).toBe(start);
  });

  // "Steel" beside 30,000 ksi would be a label that contradicts its number,
  // and switching units would then put 200,000 MPa in the place of what was
  // typed.
  it('a modulus or a density typed over a listed material’s makes it the visitor’s own', () => {
    const f = reduceShaft(start, { type: 'modulus', E: 30000 });
    expect([f.material, f.E, f.density]).toEqual(['custom', 30000, 0.2836]);
    near(convertShaft(f, 'si').E, 30000 * SHAFT_US_TO_SI.E, 1e-5);
    const g = reduceShaft(start, { type: 'density', density: 0.283 });
    expect([g.material, g.E, g.density]).toEqual(['custom', 29000, 0.283]);
    // The listed number typed again changes nothing; any other on the way to it does.
    expect(reduceShaft(start, { type: 'modulus', E: 29000 })).toEqual(start);
    expect(reduceShaft(start, { type: 'density', density: 0.2836 })).toEqual(start);
    expect(reduceShaft(start, { type: 'modulus', E: 2 }).material).toBe('custom');
    // Typing the listed numbers into a material of one's own does not name it: only choosing it does.
    const typed = reduceShaft(reduceShaft(f, { type: 'modulus', E: 29000 }), { type: 'density', density: 0.2836 });
    expect([typed.material, typed.E, typed.density]).toEqual(['custom', 29000, 0.2836]);
    expect({ ...f, material: 'steel', E: 29000 }).toEqual(start);
  });

  it('the shaft’s own weight is a load, or is not', () => {
    const f = reduceShaft(start, { type: 'own-weight', on: true });
    expect(f.ownWeight).toBe(true);
    expect({ ...f, ownWeight: false }).toEqual(start);
    expect(reduceShaft(f, { type: 'own-weight', on: false })).toEqual(start);
  });

  it('a shaft from a link replaces the whole form, and starting over is the example', () => {
    const other = decodeShaft(encodeShaft(worked()))!;
    expect(reduceShaft(start, { type: 'load', form: other })).toBe(other);
    expect(reduceShaft(worked(), { type: 'reset' })).toEqual(defaultShaft());
  });

  // The edits above are chosen; these are not. Six thousand of them, one
  // after another, on whatever the last one left.
  it('six thousand edits in a row: nothing moves that was not edited, no id is handed out twice, a material stands beside its own numbers', () => {
    const { rnd, pick } = dice(20261013);
    const length = () => pick([0, 0.5, 3, 4, 8, 12.5, 37.25, 101.6]);
    const size = () => pick([0, 0.35, 1, 2.5, 120, 1500]);
    let f = defaultShaft();
    let everSeen = new Set(idsOf(f));
    // What the walk came across, so that it is known to have come across it.
    const met = { segmentsRemoved: 0, offTheShaft: 0, reloads: 0, eight: 0, one: 0, twelve: 0, custom: 0, listed: 0, si: 0 };
    const edit = (): ShaftAction | 'reload' => {
      const list = pick(['forces', 'couples'] as const);
      const segmentId = () => pick([...f.segments.map((s) => s.id), 999]);
      const rowId = () => pick([...f[list].map((r) => r.id), 999]);
      switch (pick(['add-segment', 'add-segment', 'remove-segment', 'remove-segment', 'add', 'add', 'add', 'remove', 'segment', 'row', 'bearing', 'units', 'material', 'modulus', 'density', 'own-weight', 'reload', 'reload'] as const)) {
        case 'add-segment':
          return { type: 'add', list: 'segments' };
        case 'remove-segment':
          return { type: 'remove', list: 'segments', id: segmentId() };
        case 'add':
          return { type: 'add', list };
        case 'remove':
          return { type: 'remove', list, id: rowId() };
        case 'segment':
          return { type: 'patch', list: 'segments', id: segmentId(), patch: pick([{ L: length() }, { d: pick([0, 0.75, 1.5, 2, 50]) }, { bore: pick([0, 0, 0.5, 1, 3]) }]) };
        case 'row':
          return {
            type: 'patch',
            list,
            id: rowId(),
            patch: list === 'forces' ? pick([{ x: length() }, { v: size() }, { h: size() }, { vDir: pick(['down', 'up']) }, { hDir: pick(['towards', 'away']) }]) : pick([{ x: length() }, { v: size() }, { h: size() }, { vDir: pick(['ccw', 'cw']) }, { hDir: pick(['ccw', 'cw']) }]),
          };
        case 'bearing':
          return { type: 'bearing', index: pick([0, 1, 1, 2, -1]), x: length() };
        case 'units':
          return { type: 'units', units: pick(['us', 'si'] as const) };
        case 'material':
          return { type: 'material', material: pick(['steel', 'stainless', 'aluminum', 'custom'] as const) };
        case 'modulus':
          return { type: 'modulus', E: pick([29000, 200000, 30000, 0, 16500]) };
        case 'density':
          return { type: 'density', density: pick([0.2836, 7850, 0.16, 0, 4430]) };
        case 'own-weight':
          return { type: 'own-weight', on: rnd() < 0.5 };
        case 'reload':
          return 'reload';
      }
    };
    for (let i = 0; i < 6000; i++) {
      const action = edit();
      const why = `edit ${i}: ${JSON.stringify(action)}`;
      if (action === 'reload') {
        // The address of the form on screen, opened again: the same shaft, numbered afresh.
        const link = encodeShaft(f);
        const back = decodeShaft(link)!;
        expect(back, why).not.toBeNull();
        expect(carried(back), why).toEqual(carried(f));
        expect(encodeShaft(back), why).toBe(link);
        f = reduceShaft(f, { type: 'load', form: back });
        expectSound(f, why);
        everSeen = new Set(idsOf(f));
        met.reloads += 1;
        continue;
      }
      // No edit writes on the form it is given: it returns another.
      const before = frozen(f);
      f = reduceShaft(before, action);
      expectSound(f, why);
      // What this edit did that it should not have: nothing.
      const wrong: string[] = [];
      // An id that was not in the form a moment ago has never been in it.
      const had = new Set(idsOf(before));
      for (const id of idsOf(f)) {
        if (!had.has(id) && everSeen.has(id)) wrong.push(`id ${id} handed out again`);
        everSeen.add(id);
      }
      // One more row at most, and only from an edit that adds one; one fewer at most, and only from one that removes.
      const more = idsOf(f).length - idsOf(before).length;
      if (more > (action.type === 'add' ? 1 : 0) || more < (action.type === 'remove' ? -1 : 0)) wrong.push(`${more} rows more`);
      if (action.type !== 'units') {
        // A row that this edit did not name is the very row it was.
        const named = action.type === 'patch' || action.type === 'remove' ? action.id : null;
        for (const list of ['segments', 'forces', 'couples'] as const) {
          for (const row of f[list]) {
            const was = before[list].find((r) => r.id === row.id);
            if (was && row.id !== named && row !== was) wrong.push(`${list} ${row.id} is another row`);
          }
        }
        // The bearings stand where they stood unless one was moved; a segment added, changed or removed moves neither.
        if (action.type !== 'bearing' && f.bearings !== before.bearings) wrong.push('the bearings moved');
        // Nothing but the material's own edits touches its numbers.
        if (!['material', 'modulus', 'density'].includes(action.type) && (f.material !== before.material || !Object.is(f.E, before.E) || !Object.is(f.density, before.density))) wrong.push('the material changed');
      }
      expect(wrong, why).toEqual([]);
      if (f.segments.length < before.segments.length) {
        met.segmentsRemoved += 1;
        const end = shaftLength(f);
        met.offTheShaft += Number(f.bearings.some((x) => x > end) || f.forces.some((p) => p.x > end));
      }
      met.eight += Number(f.segments.length === MAX_SEGMENTS);
      met.one += Number(f.segments.length === 1);
      met.twelve += Number(f.forces.length === MAX_ROWS || f.couples.length === MAX_ROWS);
      met.custom += Number(f.material === 'custom');
      met.listed += Number(f.material !== 'custom');
      met.si += Number(f.units === 'si');
    }
    // The walk is as wide as it is said to be.
    expect(met.segmentsRemoved).toBeGreaterThan(300);
    expect(met.offTheShaft).toBeGreaterThan(100);
    expect(met.reloads).toBeGreaterThan(400);
    expect(met.eight).toBeGreaterThan(200);
    expect(met.one).toBeGreaterThan(100);
    expect(met.twelve).toBeGreaterThan(100);
    expect(met.custom).toBeGreaterThan(500);
    expect(met.listed).toBeGreaterThan(500);
    expect(met.si).toBeGreaterThan(1000);
  }, 30_000);
});

describe('shaft form: the round section', () => {
  it('a solid bar is the textbook’s: π·d⁴/64, π·d³/32, π·d²/4', () => {
    for (const d of [0.5, 1, 1.25, 2, 3.5, 25, 50, 80]) {
      const p = sectionOf({ d, bore: 0 })!;
      near(p.I, (Math.PI * d ** 4) / 64, 1e-14);
      near(p.Z, (Math.PI * d ** 3) / 32, 1e-14);
      near(p.A, (Math.PI * d ** 2) / 4, 1e-14);
    }
    // In figures: a 2 in bar has I = Z = π/4, and its area is π.
    const two = sectionOf({ d: 2, bore: 0 })!;
    near(two.I, 0.7853981634);
    near(two.Z, 0.7853981634);
    near(two.A, 3.1415926536);
    // 50 mm: 306,796 mm⁴ and 12,272 mm³.
    near(sectionOf({ d: 50, bore: 0 })!.I, 306796.1576, 1e-9);
    near(sectionOf({ d: 50, bore: 0 })!.Z, 12271.84630, 1e-9);
  });

  it('a hollow one is the bar less its bore — and its modulus is over the OUTER radius', () => {
    for (const [d, b] of [[3, 1.5], [2, 0.5], [80, 40], [1, 0.999], [100, 1]]) {
      const p = sectionOf({ d, bore: b })!;
      near(p.I, (Math.PI * (d ** 4 - b ** 4)) / 64, 1e-12);
      near(p.Z, (Math.PI * (d ** 4 - b ** 4)) / (32 * d), 1e-12);
      near(p.A, (Math.PI * (d ** 2 - b ** 2)) / 4, 1e-12);
      near(p.Z, p.I / (d / 2), 1e-14);
    }
    // 3 in bored 1.5 in: 15/16 of the bar's stiffness with three quarters of its metal.
    const bar = sectionOf({ d: 3, bore: 0 })!;
    const tube = sectionOf({ d: 3, bore: 1.5 })!;
    near(tube.I / bar.I, 15 / 16);
    near(tube.Z / bar.Z, 15 / 16);
    near(tube.A / bar.A, 3 / 4);
    near(tube.I, 3.727573, 1e-6);
    // 80 mm bored 40 mm: I = 600,000·π mm⁴.
    near(sectionOf({ d: 80, bore: 40 })!.I, 600000 * Math.PI, 1e-13);
  });

  // A thin tube is the difference of two numbers nearly equal. Of mean
  // radius r and wall t it is, exactly, I = π·r·t·(r² + t²/4) and
  // A = 2π·r·t: neither has a difference in it.
  it('a thin tube keeps its figures', () => {
    for (const t of [1e-3, 1e-6, 1e-9, 1e-12]) {
      const r = 1;
      const p = sectionOf({ d: 2 * r + t, bore: 2 * r - t })!;
      // The wall itself is known to 1e-16 of the diameter: so many of its figures are left.
      const figures = 4e-16 / t;
      close(p.I, Math.PI * r * t * (r * r + (t * t) / 4), figures + 1e-14);
      close(p.A, 2 * Math.PI * r * t, figures + 1e-14);
      expect(p.I).toBeGreaterThan(0);
    }
  });

  it('twice the diameters: sixteen times the stiffness, eight times the modulus, four times the metal', () => {
    const p = sectionOf({ d: 1.75, bore: 0.625 })!;
    const q = sectionOf({ d: 3.5, bore: 1.25 })!;
    near(q.I / p.I, 16);
    near(q.Z / p.Z, 8);
    near(q.A / p.A, 4);
    // In millimetres the same section is the same section: 25.4⁴, 25.4³, 25.4².
    const mm = sectionOf({ d: 1.75 * 25.4, bore: 0.625 * 25.4 })!;
    near(mm.I / p.I, 25.4 ** 4);
    near(mm.Z / p.Z, 25.4 ** 3);
    near(mm.A / p.A, 25.4 ** 2);
  });

  it('two diameters that are no section are none', () => {
    for (const [d, b] of [[0, 0], [-2, 0], [Number.NaN, 0], [Infinity, 0], [2, 2], [2, 2.5], [2, -0.5], [2, Number.NaN], [2, Infinity], [Infinity, Infinity], [0, -1]]) {
      expect(sectionOf({ d, bore: b }), `${d} bored ${b}`).toBeNull();
    }
    // The thinnest wall there is, is one.
    expect(sectionOf({ d: 2, bore: 2 - 4e-16 })).not.toBeNull();
    expect(sectionOf({ d: 2, bore: 0 })).not.toBeNull();
  });
});

describe('shaft form: what the engine is given', () => {
  it('a shaft worked out by hand, in inches and pounds-force', () => {
    const { model, rows } = toEngine(worked());
    expect(model.segments).toHaveLength(3);
    // E = 30,000 ksi is 30,000,000 lbf/in². The 2 in bar: I = π/4 in⁴, Z = π/4 in³, and π in² of metal at 0.3 lb/in³.
    expect(model.segments[0].L).toBe(6);
    near(model.segments[0].EI, 30e6 * (Math.PI / 4));
    near(model.segments[0].EI, 23561944.9, 1e-9);
    near(model.segments[0].Z!, Math.PI / 4);
    near(model.segments[0].w!, 0.3 * Math.PI);
    // The 3 in tube bored 1.5 in: I = π·(81 − 5.0625)/64, over a radius of 1.5 in; π·(9 − 2.25)/4 of metal.
    expect(model.segments[1].L).toBe(8);
    near(model.segments[1].EI, (30e6 * Math.PI * 75.9375) / 64);
    near(model.segments[1].Z!, (Math.PI * 75.9375) / 64 / 1.5);
    near(model.segments[1].w!, (0.3 * Math.PI * 6.75) / 4);
    near(model.segments[1].w!, 1.590431, 1e-6);
    // The 1 in end.
    expect(model.segments[2].L).toBe(4);
    near(model.segments[2].EI, (30e6 * Math.PI) / 64);
    near(model.segments[2].Z!, Math.PI / 32);
    near(model.segments[2].w!, (0.3 * Math.PI) / 4);
    // The bearings where they were typed, in the order typed.
    expect(model.bearings).toEqual([3, 16]);
    // Down and towards the viewer are positive; up and away are negative. In lbf, as typed.
    expect(model.forces).toEqual([
      { x: 10, v: 500, h: -200 },
      { x: 18, v: -150, h: 0 },
    ]);
    // Counter-clockwise is positive; clockwise negative. In lbf·in, as typed.
    expect(model.couples).toEqual([{ x: 10, v: -300, h: 120 }]);
    expect(rows.segments).toEqual([{ list: 'segments', id: 11 }, { list: 'segments', id: 12 }, { list: 'segments', id: 13 }]);
    expect(rows.bearings).toEqual([{ list: 'bearings', index: 0 }, { list: 'bearings', index: 1 }]);
    expect(rows.forces).toEqual([{ list: 'forces', id: 21 }, { list: 'forces', id: 22 }]);
    expect(rows.couples).toEqual([{ list: 'couples', id: 31 }]);
  });

  it('a shaft worked out by hand, in millimetres and newtons — a couple in N·mm, a stiffness in N·mm²', () => {
    const { model } = toEngine(metric());
    // 200,000 MPa is 200,000 N/mm² as it stands. The 50 mm bar: I = π·50⁴/64 = 306,796 mm⁴.
    expect(model.segments[0].L).toBe(150);
    near(model.segments[0].EI, (200000 * Math.PI * 50 ** 4) / 64);
    near(model.segments[0].EI, 6.135923152e10, 1e-9);
    near(model.segments[0].Z!, (Math.PI * 50 ** 3) / 32);
    // The 80 mm tube bored 40 mm: I = 600,000·π mm⁴, over a radius of 40 mm.
    expect(model.segments[1].L).toBe(200);
    near(model.segments[1].EI, 200000 * 600000 * Math.PI);
    near(model.segments[1].Z!, 15000 * Math.PI);
    // 7,850 kg/m³ × 9.80665 m/s² = 76,982 N/m³ = 7.6982 × 10⁻⁵ N/mm³; times 1,963.5 mm² and 3,769.9 mm² of metal.
    near(model.segments[0].w!, 7850 * 9.80665 * 1e-9 * Math.PI * 625);
    near(model.segments[1].w!, 7850 * 9.80665 * 1e-9 * Math.PI * 1200);
    near(model.segments[1].w!, 0.2902161, 1e-6);
    expect(model.bearings).toEqual([0, 300]);
    // Newtons as typed; 40 N·m is 40,000 N·mm, and 15 N·m clockwise is −15,000.
    expect(model.forces).toEqual([{ x: 150, v: 2000, h: 500 }]);
    expect(model.couples).toEqual([{ x: 250, v: 40000, h: -15000 }]);
  });

  // The two figures a stockholder's table gives for round steel bar.
  it('the weight per length of a 2 in steel bar, and of a 50 mm one', () => {
    const inch = toEngine(shaft({ segments: [seg(1, 12, 2)], ownWeight: true })).model.segments[0];
    // 0.2836 lb/in³ × π in² = 0.8910 lbf/in: 10.69 lb to the foot.
    near(inch.w!, 0.2836 * Math.PI);
    near(inch.w!, 0.8909557, 1e-7);
    near(inch.w! * 12, 10.6915, 1e-5);
    const mm = toEngine({ ...metric(), segments: [seg(1, 1000, 50)] }).model.segments[0];
    // 7,850 kg/m³ × 1,963.5 mm² = 15.41 kg to the metre, which weighs 151.15 N: 0.15115 N/mm.
    near(mm.w!, 0.1511542, 1e-7);
    near((mm.w! * 1000) / 9.80665, 15.41344, 1e-6);
    near((mm.w! * 1000) / 9.80665, 7850 * Math.PI * 0.025 ** 2, 1e-12);
    // The same bar in aluminum: its weight is in the ratio of the densities.
    const al = toEngine(reduceShaft(shaft({ segments: [seg(1, 12, 2)], ownWeight: true }), { type: 'material', material: 'aluminum' })).model.segments[0];
    near(al.w! / inch.w!, 0.0975 / 0.2836);
    near(al.EI / inch.EI, 10100 / 29000);
  });

  // Whatever system it is entered in, it is one shaft. A material of the
  // visitor's own, so that the modulus and the density are converted and not
  // replaced by round ones: the figures differ by the rounding of a
  // converted value, six figures.
  it('in either system it is the same shaft: the engine’s numbers differ by the units alone', () => {
    const us = worked();
    const si = convertShaft(us, 'si');
    const [a, b] = [toEngine(us).model, toEngine(si).model];
    const [inch, lbf] = [25.4, 4.4482216152605];
    a.segments.forEach((p, i) => {
      const q = b.segments[i];
      near(q.L, p.L * inch, 1e-5);
      // lbf·in² to N·mm², in³ to mm³, lbf/in to N/mm.
      near(q.EI, p.EI * lbf * inch ** 2, 2e-5);
      near(q.Z!, p.Z! * inch ** 3, 2e-5);
      near(q.w!, (p.w! * lbf) / inch, 2e-5);
    });
    a.forces!.forEach((p, i) => {
      near(b.forces![i].x, p.x * inch, 1e-5);
      near(b.forces![i].v, p.v * lbf, 1e-5);
      near(b.forces![i].h, p.h * lbf, 1e-5);
    });
    // lbf·in to N·mm.
    near(b.couples![0].v, a.couples![0].v * lbf * inch, 1e-5);
    near(b.couples![0].h, a.couples![0].h * lbf * inch, 1e-5);
    // Solved, each by the yardstick: the reactions in newtons are those in pounds-force, a deflection in
    // millimetres is the one in inches, a slope is the same angle, and the stress shown is one stress.
    const [p, q] = [bent(a), bent(b)];
    near(q.vertical.Ra, p.vertical.Ra * lbf, 1e-4);
    near(q.vertical.Rb, p.vertical.Rb * lbf, 1e-4);
    near(q.horizontal.Rb, p.horizontal.Rb * lbf, 1e-4);
    for (const x of [0, 5, 10, 12, 18]) {
      close(q.both(x * inch).v, p.both(x).v * inch, 1e-4);
      close(q.both(x * inch).theta, p.both(x).theta, 1e-4);
    }
    const M = p.both(9).M;
    close(shownMoment('si', q.both(9 * inch).M), shownMoment('us', M) * SHAFT_US_TO_SI.moment, 1e-4);
    close(shownStress('si', q.both(9 * inch).M / b.segments[1].Z!), shownStress('us', M / a.segments[1].Z!) * SHAFT_US_TO_SI.E, 1e-4);
  });

  it('every direction is a sign, and a size of zero is a plain zero either way', () => {
    const f = shaft({
      forces: [force(1, 5, 7, 'down', 3, 'towards'), force(2, 5, 7, 'up', 3, 'away'), force(3, 5, 0, 'up', 0, 'away')],
      couples: [couple(4, 5, 7, 'ccw', 3, 'ccw'), couple(5, 5, 7, 'cw', 3, 'cw'), couple(6, 5, 0, 'cw', 0, 'cw')],
    });
    const { model } = toEngine(f);
    // toEqual tells 0 from −0: none of these zeros is a −0.
    expect(model.forces).toEqual([{ x: 5, v: 7, h: 3 }, { x: 5, v: -7, h: -3 }, { x: 5, v: 0, h: 0 }]);
    expect(model.couples).toEqual([{ x: 5, v: 7, h: 3 }, { x: 5, v: -7, h: -3 }, { x: 5, v: 0, h: 0 }]);
    // In SI too, where a couple is multiplied on its way.
    expect(toEngine({ ...f, units: 'si', E: 200000, density: 7850 }).model.couples).toEqual([{ x: 5, v: 7000, h: 3000 }, { x: 5, v: -7000, h: -3000 }, { x: 5, v: 0, h: 0 }]);
    // A size typed with a minus is that size the other way: 7 lbf "down" typed as −7 pushes up.
    expect(toEngine(shaft({ forces: [force(1, 5, -7, 'down', -3, 'away')] })).model.forces).toEqual([{ x: 5, v: -7, h: 3 }]);
  });

  it('its own weight is each segment’s, when asked for and only then — and the weight of the metal that is there', () => {
    const off = toEngine({ ...worked(), ownWeight: false }).model;
    expect(off.segments.map((p) => 'w' in p)).toEqual([false, false, false]);
    expect(off.segments.map((p) => Object.keys(p).sort())).toEqual([['EI', 'L', 'Z'], ['EI', 'L', 'Z'], ['EI', 'L', 'Z']]);
    const on = toEngine(worked()).model;
    expect(on.segments.map((p) => Object.keys(p).sort())).toEqual([['EI', 'L', 'Z', 'w'], ['EI', 'L', 'Z', 'w'], ['EI', 'L', 'Z', 'w']]);
    // Nothing else of the model changes with it.
    expect(on.segments.map(({ L, EI, Z }) => ({ L, EI, Z }))).toEqual(off.segments);
    expect([on.bearings, on.forces, on.couples]).toEqual([off.bearings, off.forces, off.couples]);
    // The tube weighs three quarters of the 3 in bar it was bored from.
    const bar = toEngine({ ...worked(), segments: [seg(1, 8, 3)] }).model.segments[0];
    near(on.segments[1].w! / bar.w!, 3 / 4);
    // The whole shaft: 0.3 lb/in³ × (6π + 8·π·6.75/4 + 4·π/4) in³.
    near(on.segments.reduce((sum, p) => sum + p.w! * p.L, 0), 0.3 * Math.PI * (6 + 13.5 + 1));
  });

  // With no modulus there is no EI; with two diameters that are no section
  // there is no EI, no Z and no weight; with the weight asked for and no
  // density there is no weight. None of them is a zero: an engine asked all
  // the same must refuse the shaft, not solve another one.
  it('what the form cannot work out is sent as no number, so that no engine solves the shaft without it', () => {
    for (const E of [0, -29000, Number.NaN, Infinity]) {
      const { model } = toEngine({ ...worked(), E });
      expect(model.segments.map((p) => p.EI), String(E)).toEqual([Number.NaN, Number.NaN, Number.NaN]);
      // The section modulus and the weight do not need it.
      expect(model.segments.every((p) => p.Z! > 0 && p.w! > 0), String(E)).toBe(true);
    }
    for (const density of [0, -1, Number.NaN, Infinity]) {
      const { model } = toEngine({ ...worked(), density });
      expect(model.segments.map((p) => p.w), String(density)).toEqual([Number.NaN, Number.NaN, Number.NaN]);
      expect(model.segments.every((p) => p.EI > 0 && p.Z! > 0), String(density)).toBe(true);
      // Not asked for, the density is not used: whatever it holds, the shaft is the shaft without its weight.
      expect(toEngine({ ...worked(), density, ownWeight: false }).model, String(density)).toEqual(toEngine({ ...worked(), ownWeight: false }).model);
    }
    for (const over of [{ d: 0 }, { d: Number.NaN }, { d: -3 }, { bore: 3 }, { bore: 4 }, { bore: -1 }, { bore: Number.NaN }]) {
      const f = reduceShaft(worked(), { type: 'patch', list: 'segments', id: 12, patch: over });
      const { model } = toEngine(f);
      expect([model.segments[1].EI, model.segments[1].Z, model.segments[1].w], JSON.stringify(over)).toEqual([Number.NaN, Number.NaN, Number.NaN]);
      // The segments beside it are what they were.
      expect([model.segments[0], model.segments[2]], JSON.stringify(over)).toEqual([toEngine(worked()).model.segments[0], toEngine(worked()).model.segments[2]]);
      expect(toEngine({ ...f, ownWeight: false }).model.segments[1], JSON.stringify(over)).toEqual({ L: 8, EI: Number.NaN, Z: Number.NaN });
    }
    // A diameter that is a number, and whose fourth power is past the largest there is: no fault of the form's —
    // and no stiffness, where infinity would have been one to an engine that asked only for a positive number.
    const vast = { ...worked(), segments: [seg(1, 6, 2), seg(2, 8, 1e80)] };
    expect(formIssues(vast)).toEqual([]);
    expect(sectionOf(vast.segments[1])!.I).toBe(Infinity);
    const sent = toEngine(vast).model.segments[1];
    expect([sent.EI, sent.Z]).toEqual([Number.NaN, Number.NaN]);
    expect(Number.isFinite(sent.w)).toBe(true);
    for (const p of toEngine({ ...vast, segments: [seg(1, 6, 2), seg(2, 8, 1e160)] }).model.segments.slice(1)) expect([p.EI, p.Z, p.w]).toEqual([Number.NaN, Number.NaN, Number.NaN]);
    // No number the model holds for a segment's section is ever infinite.
    for (const d of [1e-200, 1e-80, 1, 1e60, 1e80, 1e200, Number.MAX_VALUE]) {
      for (const E of [1e-300, 29000, 1e300]) {
        const p = toEngine({ ...worked(), segments: [seg(1, 6, d)], E, density: 1e300 }).model.segments[0];
        for (const v of [p.EI, p.Z!, p.w!]) expect(v === Infinity || v === -Infinity, `${d} ${E}`).toBe(false);
      }
    }
  });

  it('whatever else the form holds is sent, for the engine to refuse: a length of zero, a load that is no number, a bearing off the shaft', () => {
    const f = shaft({
      segments: [seg(1, 0, 1.5), seg(2, -4, 2), seg(3, Number.NaN, 2), seg(4, 6, 2)],
      bearings: [-2, 40],
      forces: [force(5, 99, Number.NaN, 'up', Infinity, 'away')],
      couples: [couple(6, Number.NaN, 5)],
    });
    const { model } = toEngine(f);
    expect(model.segments.map((p) => p.L)).toEqual([0, -4, Number.NaN, 6]);
    expect(model.bearings).toEqual([-2, 40]);
    expect(model.forces).toEqual([{ x: 99, v: Number.NaN, h: -Infinity }]);
    expect(model.couples).toEqual([{ x: Number.NaN, v: 5, h: 0 }]);
    // The model never shares a list with the form: an engine that sorted its bearings would not sort the form's.
    expect(model.bearings).not.toBe(f.bearings);
  });

  it('an entry the engine refuses is named by its row, and by its field when it is a segment’s', () => {
    const { rows } = toEngine(worked());
    const said = (issue: ShaftIssue) => issueOnRow(issue, rows);
    expect(said({ code: 'length', where: { list: 'segments', index: 1 } })).toEqual({ code: 'length', row: { list: 'segments', id: 12, field: 'L' } });
    expect(said({ code: 'short-segment', where: { list: 'segments', index: 2 } })).toEqual({ code: 'short-segment', row: { list: 'segments', id: 13, field: 'L' } });
    expect(said({ code: 'stiffness', where: { list: 'segments', index: 0 } })).toEqual({ code: 'stiffness', row: { list: 'segments', id: 11, field: 'd' } });
    // A weight or a section modulus that is no number: the segment, whole.
    expect(said({ code: 'number', where: { list: 'segments', index: 2 } })).toEqual({ code: 'number', row: { list: 'segments', id: 13 } });
    expect(said({ code: 'outside', where: { list: 'bearings', index: 1 } })).toEqual({ code: 'outside', row: { list: 'bearings', index: 1 } });
    expect(said({ code: 'bearings', where: { list: 'bearings', index: 0 } })).toEqual({ code: 'bearings', row: { list: 'bearings', index: 0 } });
    expect(said({ code: 'outside', where: { list: 'forces', index: 1 } })).toEqual({ code: 'outside', row: { list: 'forces', id: 22 } });
    expect(said({ code: 'number', where: { list: 'forces', index: 0 } })).toEqual({ code: 'number', row: { list: 'forces', id: 21 } });
    expect(said({ code: 'outside', where: { list: 'couples', index: 0 } })).toEqual({ code: 'outside', row: { list: 'couples', id: 31 } });
    // An entry that is not there is nobody's row, nor an issue of the whole shaft.
    expect(said({ code: 'number', where: { list: 'forces', index: 9 } })).toEqual({ code: 'number' });
    expect(said({ code: 'outside', where: { list: 'bearings', index: 2 } })).toEqual({ code: 'outside' });
    expect(said({ code: 'bearings' })).toEqual({ code: 'bearings' });
    expect(said({ code: 'no-segments' })).toEqual({ code: 'no-segments' });
    // The rows are not written on by being named.
    expect(rows.segments[0]).toEqual({ list: 'segments', id: 11 });
  });
});

describe('shaft form: what only the form can know is wrong', () => {
  const at = (id: number, field: 'L' | 'd' | 'bore') => ({ list: 'segments' as const, id, field });

  it('a length and a diameter are positive numbers, and each that is not is named on its row', () => {
    expect(formIssues(worked())).toEqual([]);
    expect(formIssues(metric())).toEqual([]);
    for (const v of [0, -1, Number.NaN, Infinity, -Infinity]) {
      const long = reduceShaft(worked(), { type: 'patch', list: 'segments', id: 12, patch: { L: v } });
      expect(formIssues(long), String(v)).toEqual([{ code: 'length', row: at(12, 'L') }]);
      // The bore is as large as a diameter of zero or less; only against a diameter that is one is that said.
      const thick = reduceShaft(worked(), { type: 'patch', list: 'segments', id: 12, patch: { d: v, bore: 0 } });
      expect(formIssues(thick), String(v)).toEqual([{ code: 'diameter', row: at(12, 'd') }]);
      expect(formIssues(reduceShaft(worked(), { type: 'patch', list: 'segments', id: 12, patch: { d: v } })), String(v)).toEqual([{ code: 'diameter', row: at(12, 'd') }]);
    }
  });

  it('a bore leaves a wall: one as large as the diameter, or larger, or that is no bore, is named', () => {
    const bored = (d: number, bore: number) => formIssues(shaft({ segments: [seg(1, 10, d, bore)] }));
    expect(bored(2, 0)).toEqual([]);
    expect(bored(2, 1.999)).toEqual([]);
    for (const bore of [2, 2.5, 100, -0.5, Number.NaN, Infinity, -Infinity]) expect(bored(2, bore), String(bore)).toEqual([{ code: 'bore', row: at(1, 'bore') }]);
    // Beside a diameter that is none, a bore that is a number is not the fault; one that is not, is another.
    expect(bored(0, 1)).toEqual([{ code: 'diameter', row: at(1, 'd') }]);
    expect(bored(Number.NaN, -1)).toEqual([{ code: 'diameter', row: at(1, 'd') }, { code: 'bore', row: at(1, 'bore') }]);
  });

  it('the modulus is a positive number; the density too, when the weight is asked for and only then', () => {
    for (const v of [0, -1, Number.NaN, Infinity]) {
      expect(formIssues({ ...worked(), E: v }), String(v)).toEqual([{ code: 'modulus', row: { list: 'material', field: 'E' } }]);
      expect(formIssues({ ...worked(), density: v }), String(v)).toEqual([{ code: 'density', row: { list: 'material', field: 'density' } }]);
      // The weight not asked for, the density is not on screen: a leftover in it is no problem.
      expect(formIssues({ ...worked(), density: v, ownWeight: false }), String(v)).toEqual([]);
    }
  });

  it('every fault at once, by row: the segments in order, each by its fields as they are typed, then the material', () => {
    const f: ShaftForm = { ...worked(), segments: [seg(1, 0, 2, 2), seg(2, 5, 1), seg(3, Number.NaN, -1, Number.NaN)], E: 0, density: 0 };
    expect(formIssues(f)).toEqual([
      { code: 'length', row: at(1, 'L') },
      { code: 'bore', row: at(1, 'bore') },
      { code: 'length', row: at(3, 'L') },
      { code: 'diameter', row: at(3, 'd') },
      { code: 'bore', row: at(3, 'bore') },
      { code: 'modulus', row: { list: 'material', field: 'E' } },
      { code: 'density', row: { list: 'material', field: 'density' } },
    ]);
  });

  it('is not about what the engine names: a load that is no number, a position off the shaft, two bearings at one place', () => {
    const f = shaft({ bearings: [5, 5], forces: [force(5, 99, Number.NaN, 'down', Infinity)], couples: [couple(6, -3, Number.NaN)] });
    expect(formIssues(f)).toEqual([]);
    expect(formIssues(shaft({ bearings: [Number.NaN, 400] }))).toEqual([]);
  });

  // The two halves of one rule, held together over every combination of a
  // good and a bad value in every field: what the form names is exactly what
  // the model holds as "not a number", segment by segment — so a shaft the
  // form finds nothing wrong with is sent whole, and one it faults cannot be
  // solved behind its back.
  it('what it names is exactly what the engine is sent as no number', () => {
    const values = [-1, 0, 2, 5, Number.NaN, Infinity];
    let faulty = 0;
    let whole = 0;
    for (const L of [4, 0, Number.NaN]) {
      for (const d of values) {
        for (const bore of values) {
          for (const E of [29000, 0, Number.NaN]) {
            for (const density of [0.2836, 0, Number.NaN]) {
              for (const ownWeight of [true, false]) {
                const f = shaft({ segments: [seg(1, 6, 2, 1), seg(2, L, d, bore)], E, density, ownWeight, material: 'custom' });
                const why = JSON.stringify([L, d, bore, E, density, ownWeight]);
                const own = formIssues(f);
                const codes = own.map((i) => `${i.code}:${i.row && 'id' in i.row ? i.row.id : ''}`);
                const sent = toEngine(f).model.segments;
                const noSection = codes.includes('diameter:2') || codes.includes('bore:2');
                expect(Number.isNaN(sent[1].EI), why).toBe(noSection || codes.includes('modulus:'));
                expect(Number.isNaN(sent[1].Z), why).toBe(noSection);
                expect('w' in sent[1], why).toBe(ownWeight);
                if (ownWeight) expect(Number.isNaN(sent[1].w), why).toBe(noSection || codes.includes('density:'));
                expect(codes.includes('length:2'), why).toBe(!(sent[1].L > 0 && Number.isFinite(sent[1].L)));
                // The segment beside it has a section: only the material's faults reach it.
                expect(Number.isNaN(sent[0].EI), why).toBe(codes.includes('modulus:'));
                expect(sent[0].Z, why).toBeGreaterThan(0);
                // Nothing wrong: every number of the model is one, and positive.
                if (own.length === 0) {
                  for (const p of sent) expect(p.L > 0 && p.EI > 0 && p.Z! > 0 && Number.isFinite(p.EI) && (!ownWeight || (p.w! > 0 && Number.isFinite(p.w))), why).toBe(true);
                  whole += 1;
                } else faulty += 1;
              }
            }
          }
        }
      }
    }
    // The comparison is not of nothing with nothing: 1,944 shafts, of which one section in 36 is one (2 bored 0,
    // 5 bored 0 and 5 bored 2), with one length in three, one modulus in three, and a density that is one or is not asked for.
    expect(whole + faulty).toBe(3 * 6 * 6 * 3 * 3 * 2);
    expect(whole).toBe(3 * 1 * 1 * (1 + 3));
  });

  describe('with what the engine says: every fault once', () => {
    const own = (f: ShaftForm) => formIssues(f);
    const segment = (id: number, field?: 'L' | 'd' | 'bore') => ({ list: 'segments' as const, id, ...(field ? { field } : {}) });
    const off: ShaftFormIssue = { code: 'outside', row: { list: 'forces', id: 22 } };
    const lost: ShaftFormIssue = { code: 'number', row: { list: 'forces', id: 21 } };

    it('a form with nothing wrong of its own: the engine’s issues, as they come', () => {
      const said: ShaftFormIssue[] = [{ code: 'stiffness', row: segment(12, 'd') }, off, { code: 'bearings' }, { code: 'number', row: segment(13) }];
      expect(allIssues([], said)).toEqual(said);
      expect(allIssues([], [])).toEqual([]);
      // The same thing said twice is said once.
      expect(allIssues([], [off, off, { code: 'bearings' }, { code: 'bearings' }])).toEqual([off, { code: 'bearings' }]);
      // The same thing: the same word of the same row and field. Two forces off the shaft are two faults, and so
      // are a bearing and a force; a segment named for its diameter and named whole are not one naming.
      const each: ShaftFormIssue[] = [
        off,
        { code: 'outside', row: { list: 'forces', id: 21 } },
        { code: 'outside', row: { list: 'couples', id: 21 } },
        { code: 'outside', row: { list: 'bearings', index: 0 } },
        { code: 'outside', row: { list: 'bearings', index: 1 } },
        { code: 'outside' },
        { code: 'stiffness', row: segment(12, 'd') },
        { code: 'stiffness', row: segment(12) },
        { code: 'stiffness', row: segment(13, 'd') },
        { code: 'short-segment', row: segment(12, 'L') },
        { code: 'length', row: segment(12, 'L') },
      ];
      expect(allIssues([], each)).toEqual(each);
      expect(allIssues([], [...each, ...each])).toEqual(each);
    });

    it('the engine’s word for what the form has named is not said again', () => {
      // No modulus: every EI is no number, and the engine says so of every segment.
      const noE = own({ ...worked(), E: 0 });
      expect(allIssues(noE, [11, 12, 13].map((id) => ({ code: 'stiffness' as const, row: segment(id, 'd') })))).toEqual(noE);
      // A bore that leaves no wall: no EI, no Z, no weight for that segment.
      const noWall = own(reduceShaft(worked(), { type: 'patch', list: 'segments', id: 12, patch: { bore: 3 } }));
      expect(allIssues(noWall, [{ code: 'stiffness', row: segment(12, 'd') }, { code: 'number', row: segment(12) }])).toEqual(noWall);
      // The weight asked for and no density: every weight is no number.
      const noDensity = own({ ...worked(), density: 0 });
      expect(allIssues(noDensity, [{ code: 'number', row: segment(11) }, { code: 'number', row: segment(12) }, { code: 'number' }])).toEqual(noDensity);
      // What is news is still said, after the form's own.
      expect(allIssues(noE, [{ code: 'stiffness', row: segment(11, 'd') }, off, lost, { code: 'bearings', row: { list: 'bearings', index: 1 } }])).toEqual([...noE, off, lost, { code: 'bearings', row: { list: 'bearings', index: 1 } }]);
    });

    it('a length that is not one is said by both, once — and nothing is then said of where things are', () => {
      const noLength = own(reduceShaft(worked(), { type: 'patch', list: 'segments', id: 12, patch: { L: 0 } }));
      expect(noLength).toEqual([{ code: 'length', row: segment(12, 'L') }]);
      const { rows } = toEngine(worked());
      const same = issueOnRow({ code: 'length', where: { list: 'segments', index: 1 } }, rows);
      expect(same).toEqual(noLength[0]);
      expect(allIssues(noLength, [same])).toEqual(noLength);
      // Nothing can be placed on a shaft whose length is not known; a force that is no number is still no number.
      expect(allIssues(noLength, [same, off, { code: 'outside', row: { list: 'bearings', index: 1 } }, { code: 'bearings' }, { code: 'short-segment', row: segment(13, 'L') }, { code: 'length', row: segment(13, 'L') }, lost])).toEqual([...noLength, lost]);
      // With the lengths known, each of those is news.
      const noE = own({ ...worked(), E: 0 });
      expect(allIssues(noE, [off, { code: 'short-segment', row: segment(13, 'L') }, { code: 'length', row: segment(13, 'L') }])).toEqual([...noE, off, { code: 'short-segment', row: segment(13, 'L') }, { code: 'length', row: segment(13, 'L') }]);
    });

    it('neither list is written on', () => {
      const mine = frozen(own({ ...worked(), E: 0 }));
      const said = frozen<ShaftFormIssue[]>([off, lost]);
      expect(allIssues(mine, said)).toEqual([...mine, off, lost]);
    });
  });
});

describe('shaft form: the shaft as it is drawn', () => {
  const d = defaultShaft();

  it('the example, seen from the side: positions worked out by hand', () => {
    const drawing = drawingOf(d, 'vertical');
    expect(drawing.L).toBe(23);
    expect(drawing.lengthUnit).toBe('in');
    // 4 in of journal, 10 in of body, 4 in of journal, 5 in of end: each starts where the one before ends.
    expect(drawing.segments).toEqual([
      { from: 0, to: 4, d: 1.5, bore: 0 },
      { from: 4, to: 14, d: 2, bore: 0 },
      { from: 14, to: 18, d: 1.5, bore: 0 },
      { from: 18, to: 23, d: 1.25, bore: 0 },
    ]);
    // Not solved: there is no reaction to write.
    expect(drawing.bearings).toEqual([{ x: 2, reaction: null }, { x: 16, reaction: null }]);
    // Both forces push down: positive, and written as typed.
    expect(drawing.forces).toEqual([
      { id: '5', x: 9, value: 1000, label: '1,000 lbf' },
      { id: '6', x: 21, value: 400, label: '400 lbf' },
    ]);
    expect(drawing.couples).toEqual([]);
    expect(drawing.ownWeight).toBe(false);
  });

  it('seen from above there is only what acts in that plane; with both together, each force is its resultant', () => {
    // The pulley's pull is all vertical: from above it is not a force.
    expect(drawingOf(d, 'horizontal').forces).toEqual([{ id: '5', x: 9, value: 360, label: '360 lbf' }]);
    const both = drawingOf(d, 'both');
    // √(1,000² + 360²) = 1,062.8: nobody typed it, and it is written to the four figures of the tables.
    expect(both.forces[0].id).toBe('5');
    near(both.forces[0].value, Math.hypot(1000, 360));
    expect(both.forces[0].label).toBe('1,063 lbf');
    // All in one plane, a resultant IS the number typed.
    expect(both.forces[1]).toEqual({ id: '6', x: 21, value: 400, label: '400 lbf' });
    // The shaft itself is the same from every side.
    for (const view of ['horizontal', 'both'] as const) {
      expect(drawingOf(d, view).segments, view).toEqual(drawingOf(d, 'vertical').segments);
      expect(drawingOf(d, view).bearings, view).toEqual(drawingOf(d, 'vertical').bearings);
      expect([drawingOf(d, view).L, drawingOf(d, view).lengthUnit], view).toEqual([23, 'in']);
    }
  });

  it('a direction is a sign in its own plane, and a resultant has none', () => {
    const f = worked();
    const side = drawingOf(f, 'vertical');
    // 500 lbf down and 150 lbf up; the couple turns clockwise in this plane.
    expect(side.forces).toEqual([{ id: '21', x: 10, value: 500, label: '500 lbf' }, { id: '22', x: 18, value: -150, label: '150 lbf' }]);
    expect(side.couples).toEqual([{ id: '31', x: 10, value: -300, label: '300 lbf·in' }]);
    const above = drawingOf(f, 'horizontal');
    // 200 lbf away from the viewer; the second force has nothing in this plane. The couple turns counter-clockwise.
    expect(above.forces).toEqual([{ id: '21', x: 10, value: -200, label: '200 lbf' }]);
    expect(above.couples).toEqual([{ id: '31', x: 10, value: 120, label: '120 lbf·in' }]);
    const both = drawingOf(f, 'both');
    expect(both.forces.map((p) => p.id)).toEqual(['21', '22']);
    near(both.forces[0].value, Math.hypot(500, 200));
    expect(both.forces[0].label).toBe('538.5 lbf');
    // An upward force, all in one plane: its resultant is its size, 150 — not −150.
    expect(both.forces[1]).toEqual({ id: '22', x: 18, value: 150, label: '150 lbf' });
    near(both.couples[0].value, Math.hypot(300, 120));
    expect(both.couples[0].label).toBe('323.1 lbf·in');
    for (const p of [...both.forces, ...both.couples]) expect(p.value).toBeGreaterThan(0);
    // The profile: the tube is drawn with its bore.
    expect(side.segments).toEqual([{ from: 0, to: 6, d: 2, bore: 0 }, { from: 6, to: 14, d: 3, bore: 1.5 }, { from: 14, to: 18, d: 1, bore: 0 }]);
    expect(side.bearings.map((p) => p.x)).toEqual([3, 16]);
  });

  it('in millimetres and newtons: a couple is written in N·m, as it is typed', () => {
    const side = drawingOf(metric(), 'vertical');
    expect([side.L, side.lengthUnit]).toEqual([350, 'mm']);
    expect(side.segments).toEqual([{ from: 0, to: 150, d: 50, bore: 0 }, { from: 150, to: 350, d: 80, bore: 40 }]);
    expect(side.forces).toEqual([{ id: '3', x: 150, value: 2000, label: '2,000 N' }]);
    // 40 N·m, not the 40,000 N·mm the engine is given.
    expect(side.couples).toEqual([{ id: '4', x: 250, value: 40, label: '40 N·m' }]);
    expect(drawingOf(metric(), 'horizontal').couples).toEqual([{ id: '4', x: 250, value: -15, label: '15 N·m' }]);
    expect(drawingOf(metric(), 'both').couples[0].label).toBe('42.72 N·m');
  });

  // The Spanish page sets thousands apart with a narrow space: a reader who
  // writes decimals with a comma took "1,000" for 1.
  it('a size is written as the page writes numbers', () => {
    const narrow = ' ';
    expect(drawingOf(d, 'vertical', null, narrow).forces.map((p) => p.label)).toEqual([`1${narrow}000 lbf`, '400 lbf']);
    expect(drawingOf(d, 'both', null, narrow).forces[0].label).toBe(`1${narrow}063 lbf`);
    // What was typed is written as typed, to six figures: a resultant to four.
    const fine = shaft({ forces: [force(5, 9, 1234.56, 'down', 0.125, 'away')] });
    expect(drawingOf(fine, 'vertical').forces[0].label).toBe('1,234.56 lbf');
    expect(drawingOf(fine, 'horizontal').forces[0].label).toBe('0.125 lbf');
    expect(drawingOf(fine, 'both').forces[0].label).toBe('1,235 lbf');
    // A size typed with a minus is drawn the other way, and written as a size.
    const minus = drawingOf(shaft({ forces: [force(5, 9, -250, 'down')] }), 'vertical').forces[0];
    expect([minus.value, minus.label]).toEqual([-250, '250 lbf']);
  });

  it('once solved, each bearing has its reaction in the view shown: upward, away from the viewer, or the radial load', () => {
    const solved = [
      { x: 2, vertical: 357.1, horizontal: 180, radial: 399.9 },
      { x: 16, vertical: 1043, horizontal: -180.5, radial: 1058 },
    ];
    expect(drawingOf(d, 'vertical', solved).bearings).toEqual([{ x: 2, reaction: 357.1 }, { x: 16, reaction: 1043 }]);
    expect(drawingOf(d, 'horizontal', solved).bearings).toEqual([{ x: 2, reaction: 180 }, { x: 16, reaction: -180.5 }]);
    expect(drawingOf(d, 'both', solved).bearings).toEqual([{ x: 2, reaction: 399.9 }, { x: 16, reaction: 1058 }]);
    // Each is found by where it stands: an engine that hands them back left to right, for bearings typed right to left.
    const swapped = shaft({ bearings: [16, 2] });
    expect(drawingOf(swapped, 'vertical', solved).bearings).toEqual([{ x: 16, reaction: 1043 }, { x: 2, reaction: 357.1 }]);
    expect(drawingOf(swapped, 'both', solved).bearings).toEqual([{ x: 16, reaction: 1058 }, { x: 2, reaction: 399.9 }]);
    // …and each where the engine placed it, which is not always the number typed: a bearing a hair from a step is
    // on the step. Paired by which is nearer which — in whatever order they come, and in whatever order they were typed.
    const moved = [{ ...solved[0], x: 2.0000000004 }, { ...solved[1], x: 15.9999999997 }];
    expect(drawingOf(d, 'vertical', moved).bearings).toEqual([{ x: 2, reaction: 357.1 }, { x: 16, reaction: 1043 }]);
    expect(drawingOf(swapped, 'vertical', moved).bearings).toEqual([{ x: 16, reaction: 1043 }, { x: 2, reaction: 357.1 }]);
    expect(drawingOf(d, 'vertical', [moved[1], moved[0]]).bearings).toEqual([{ x: 2, reaction: 357.1 }, { x: 16, reaction: 1043 }]);
    expect(drawingOf(swapped, 'horizontal', [moved[1], moved[0]]).bearings).toEqual([{ x: 16, reaction: -180.5 }, { x: 2, reaction: 180 }]);
    // Two bearings close together are still two: 4 and 4.5 in, handed back as 4 and 4.5.
    const close = [{ x: 4, vertical: 1, horizontal: 2, radial: 3 }, { x: 4.5, vertical: 10, horizontal: 20, radial: 30 }];
    expect(drawingOf(shaft({ bearings: [4.5, 4] }), 'vertical', close).bearings).toEqual([{ x: 4.5, reaction: 10 }, { x: 4, reaction: 1 }]);
    expect(drawingOf(shaft({ bearings: [4, 4.5] }), 'vertical', close).bearings).toEqual([{ x: 4, reaction: 1 }, { x: 4.5, reaction: 10 }]);
    // One reaction, or three, is not this shaft's two.
    expect(drawingOf(d, 'vertical', [solved[0]]).bearings).toEqual([{ x: 2, reaction: null }, { x: 16, reaction: null }]);
    expect(drawingOf(d, 'vertical', [...solved, solved[0]]).bearings).toEqual([{ x: 2, reaction: null }, { x: 16, reaction: null }]);
    // A reaction that is no number is none to write; nor is there one when nothing is given.
    expect(drawingOf(d, 'vertical', [{ ...solved[0], vertical: Number.NaN }, solved[1]]).bearings).toEqual([{ x: 2, reaction: null }, { x: 16, reaction: 1043 }]);
    expect(drawingOf(d, 'vertical', []).bearings).toEqual([{ x: 2, reaction: null }, { x: 16, reaction: null }]);
    expect(drawingOf(d, 'vertical', undefined).bearings).toEqual(drawingOf(d, 'vertical', null).bearings);
    // A reaction of zero is one: a bearing that carries nothing in this plane is written 0.
    expect(drawingOf(d, 'horizontal', [{ ...solved[0], horizontal: 0 }, solved[1]]).bearings[0]).toEqual({ x: 2, reaction: 0 });
  });

  it('what has no place, or no size in this view, is left out — and nothing that is not a number is drawn', () => {
    const f = shaft({
      bearings: [-1, 23],
      forces: [force(5, 0, 10), force(6, 23, 10), force(7, 23.01, 10), force(8, -0.01, 10), force(9, Number.NaN, 10), force(10, 9, Number.NaN, 'down', 5), force(11, 9, Infinity), force(12, 9, 0, 'up', 0, 'away')],
      couples: [couple(13, 12, 0, 'cw', 7), couple(14, 30, 7), couple(15, 12, Number.NaN, 'ccw', Number.NaN)],
    });
    const side = drawingOf(f, 'vertical');
    // At either end of the shaft a force is on it; a hair past, it is not.
    expect(side.forces.map((p) => p.id)).toEqual(['5', '6']);
    expect(side.couples).toEqual([]);
    expect(side.bearings).toEqual([{ x: 23, reaction: null }]);
    const above = drawingOf(f, 'horizontal');
    expect(above.forces.map((p) => p.id)).toEqual(['10']);
    expect(above.couples.map((p) => p.id)).toEqual(['13']);
    // A force with one plane's size no number has no resultant.
    expect(drawingOf(f, 'both').forces.map((p) => p.id)).toEqual(['5', '6']);
    for (const view of ['vertical', 'horizontal', 'both'] as const) {
      const drawing = drawingOf(f, view);
      for (const v of [drawing.L, ...drawing.segments.flatMap((s) => [s.from, s.to, s.d, s.bore]), ...drawing.bearings.map((p) => p.x), ...[...drawing.forces, ...drawing.couples].flatMap((p) => [p.x, p.value])]) {
        expect(Number.isFinite(v), view).toBe(true);
      }
    }
  });

  // Lengths typed as 0.1 and 0.7 add up to 0.7999999999999999. A bearing
  // typed at 0.8 is at the end of that shaft: an engine takes a
  // position to within a billionth of the length, solves the shaft with the
  // bearing there — and a drawing that left it out would show a shaft on
  // one bearing beside the results of a shaft on two.
  it('a place a hair past an end is the end, as the engine takes it; a place further off is off', () => {
    const f = shaft({ segments: [seg(1, 0.1, 0.2), seg(2, 0.7, 0.2)], bearings: [0, 0.8], forces: [force(5, 0.8, 10), force(6, 0.5, 10)], couples: [couple(7, 0.8, 3)] });
    const L = shaftLength(f);
    expect(L).toBeLessThan(0.8);
    expect(0.8 - L).toBeLessThan(1e-15);
    const drawing = drawingOf(f, 'vertical', [{ x: 0, vertical: 1, horizontal: 0, radial: 1 }, { x: L, vertical: 2, horizontal: 0, radial: 2 }]);
    // On the shaft, and placed on it: nothing of the drawing is past its end.
    expect(drawing.bearings).toEqual([{ x: 0, reaction: 1 }, { x: L, reaction: 2 }]);
    expect(drawing.forces.map((p) => [p.id, p.x])).toEqual([['5', L], ['6', 0.5]]);
    expect(drawing.couples.map((p) => [p.id, p.x])).toEqual([['7', L]]);
    // The same a hair before the start; a millionth of the length is not a hair.
    const start = drawingOf(shaft({ bearings: [-1e-11, 16], forces: [force(5, -2e-8, 10), force(6, 23 * (1 + 1e-10), 10), force(7, 23 * (1 + 1e-6), 10), force(8, -23e-6, 10)] }), 'vertical');
    expect(start.bearings.map((p) => p.x)).toEqual([0, 16]);
    expect(start.forces.map((p) => [p.id, p.x])).toEqual([['5', 0], ['6', 23]]);
  });

  // Lengths typed as 21.7, 20.9 and 5.61 add up to 48.209999999999994, and
  // 1.1 and 2.2 to 3.3000000000000003. What is typed at 48.21 or at 3.3 is
  // typed on that shoulder, or at that end: the engine solves it there, and
  // a drawing that kept the number typed stood a bearing beside its
  // shoulder — on the thinner part, half behind the thicker. Each is SEATED
  // (`seatOf`), for the engine and for the drawing alike.
  it('a place a hair from a step is the step, and a hair short of the end is the end, as the engine is given them; a place further off is where it was typed', () => {
    const f = shaft({ segments: [seg(1, 21.7, 2), seg(2, 20.9, 2), seg(3, 5.61, 4), seg(4, 1.74, 1.5), seg(5, 2.59, 1.5)], bearings: [10, 48.21], forces: [force(6, 48.21, 10), force(7, 42.6, 10), force(8, 48.2, 10)], couples: [couple(9, 48.21, 3)] });
    const step = segmentEnds(f)[3];
    expect(step).not.toBe(48.21);
    expect(Math.abs(step - 48.21)).toBeLessThan(1e-13);
    expect(segmentEnds(f)[2]).not.toBe(42.6);
    const drawing = drawingOf(f, 'vertical');
    expect(drawing.bearings.map((p) => p.x)).toEqual([10, step]);
    expect(drawing.forces.map((p) => [p.id, p.x])).toEqual([['6', step], ['7', segmentEnds(f)[2]], ['8', 48.2]]);
    expect(drawing.couples.map((p) => [p.id, p.x])).toEqual([['9', step]]);
    // What is drawn on the step is solved on it: the engine is given the very same places.
    const { model } = toEngine(f);
    expect([model.bearings, model.forces!.map((p) => p.x), model.couples!.map((p) => p.x)]).toEqual([[10, step], [step, segmentEnds(f)[2], 48.2], [step]]);
    // A hair short of the end.
    const short = shaft({ segments: [seg(1, 1.1, 2), seg(2, 2.2, 2)], bearings: [0, 3.3], forces: [force(5, 3.3, 10), force(6, 1.1 * (1 + 1e-10), 10), force(7, 1.1 * (1 + 1e-5), 10)], couples: [] });
    const L = shaftLength(short);
    expect(L).toBeGreaterThan(3.3);
    expect(drawingOf(short, 'vertical').bearings.map((p) => p.x)).toEqual([0, L]);
    // …and eleven millionths of an inch on this shaft are not a hair: past `SEAT` of its length, a place is where it was typed.
    expect(1.1 * (1 + 1e-5) - 1.1).toBeGreaterThan(SEAT * L);
    expect(drawingOf(short, 'vertical').forces.map((p) => [p.id, p.x])).toEqual([['5', L], ['6', 1.1], ['7', 1.1 * (1 + 1e-5)]]);
  });

  it('a segment with no length has no place; a diameter that is none is drawn as none, a bore that is no bore as solid', () => {
    const f = shaft({ segments: [seg(1, 4, 1.5), seg(2, 0, 2), seg(3, Number.NaN, 2), seg(4, 6, Number.NaN, 1), seg(5, 3, 2, 2), seg(6, 3, 2, -1), seg(7, 2, 2, 0.5), seg(8, Infinity, 2)] });
    const drawing = drawingOf(f, 'vertical');
    expect(drawing.segments).toEqual([
      { from: 0, to: 4, d: 1.5, bore: 0 },
      { from: 4, to: 10, d: 0, bore: 0 },
      { from: 10, to: 13, d: 2, bore: 0 },
      { from: 13, to: 16, d: 2, bore: 0 },
      { from: 16, to: 18, d: 2, bore: 0.5 },
    ]);
    expect(drawing.L).toBe(18);
    expect(segmentEnds(f)).toEqual([0, 4, 4, 4, 10, 13, 16, 18, 18]);
    // A shaft none of whose lengths is one has no length, and nothing is on it.
    const none = drawingOf(shaft({ segments: [seg(1, 0, 2), seg(2, Number.NaN, 2)] }), 'vertical');
    expect([none.L, none.segments, none.forces]).toEqual([0, [], []]);
    // …but for what stands at its very start.
    expect(none.bearings).toEqual([]);
    expect(drawingOf(shaft({ segments: [seg(1, 0, 2)], bearings: [0, 0] }), 'vertical').bearings.map((p) => p.x)).toEqual([0, 0]);
  });

  it('its own weight is drawn along it from the side, when it is a load that can be worked out', () => {
    const heavy = shaft({ ownWeight: true });
    expect(drawingOf(heavy, 'vertical').ownWeight).toBe(true);
    // It acts in the vertical plane: from above there is none of it, and it is no force's resultant.
    expect(drawingOf(heavy, 'horizontal').ownWeight).toBe(false);
    expect(drawingOf(heavy, 'both').ownWeight).toBe(false);
    for (const density of [0, -1, Number.NaN, Infinity]) expect(drawingOf({ ...heavy, material: 'custom', density }, 'vertical').ownWeight, String(density)).toBe(false);
    expect(drawingOf(d, 'vertical').ownWeight).toBe(false);
  });

  it('no two things drawn share an id, and the form is not written on', () => {
    const f = frozen(shaft({ forces: Array.from({ length: MAX_ROWS }, (_, i) => force(10 + i, i, 5, 'down', 5)), couples: Array.from({ length: MAX_ROWS }, (_, i) => couple(40 + i, i, 5, 'cw', 5)), nextId: 60 }));
    for (const view of ['vertical', 'horizontal', 'both'] as const) {
      const drawing = drawingOf(f, view);
      const ids = [...drawing.forces, ...drawing.couples].map((p) => p.id);
      expect(ids).toHaveLength(2 * MAX_ROWS);
      expect(new Set(ids).size).toBe(ids.length);
      // Each is its row's id, as text.
      expect(drawing.forces.map((p) => Number(p.id))).toEqual(f.forces.map((p) => p.id));
      expect(drawing.couples.map((p) => Number(p.id))).toEqual(f.couples.map((p) => p.id));
    }
  });
});

describe('shaft form: a shaft in an address', () => {
  const d = defaultShaft();

  it('opens the same shaft', () => {
    const text = encodeShaft(worked());
    expect(text).toMatch(WRITTEN_IN);
    const back = decodeShaft(text)!;
    expect(back).not.toBeNull();
    expect(carried(back)).toEqual(carried(worked()));
    // What the engine is given is the same, to the last figure.
    expect(toEngine(back).model).toEqual(toEngine(worked()).model);
    // Every row has its own id, the segments first, and the next one is free.
    expect(back.segments.map((s) => s.id)).toEqual([1, 2, 3]);
    expect(idsOf(back)).toEqual([1, 2, 3, 4, 5, 6]);
    expect(back.nextId).toBe(7);
    expectSound(back, 'read from a link');
  });

  // Written out, so that the rule is pinned by something other than itself:
  // the two sums of the example's 69 characters are 322,976 and 1,357,902 —
  // 6x7k and t3ri in base 36 — and 69 is 1x (36 + 33).
  it('the address of the example is short, and is this', () => {
    expect(encodeShaft(d)).toBe('K6x7kt3ri1x;us;2,16;4,1.5_10,2_4,1.5_5,1.25;9,1000,360_21,400,0;;s,29000,0.2836,0');
    expect(encodeShaft(d).length).toBeLessThan(90);
    expect(encodeShaft(shaft({ ownWeight: true }))).toBe('Kt66fsw8m1x;us;2,16;4,1.5_10,2_4,1.5_5,1.25;9,1000,360_21,400,0;;s,29000,0.2836,1');
    // One of everything: a bore, an upward force, one away from the viewer, a couple each way, a material of the visitor's own.
    expect(encodeShaft(worked())).toBe(sealed('us;3,16;6,2_8,3,1.5_4,1;10,500,-200_18,-150,0;10,-300,120;u,30000,0.3,1'));
    expect(encodeShaft(metric())).toBe(sealed('si;0,300;150,50_200,80,40;150,2000,500;250,40,-15;s,200000,7850,1'));
    for (const f of [d, worked(), metric(), convertShaft(worked(), 'si')]) expect(encodeShaft(f)).toBe(sealed(bodyOf(encodeShaft(f))));
    expect(carried(decodeShaft('K6x7kt3ri1x;us;2,16;4,1.5_10,2_4,1.5_5,1.25;9,1000,360_21,400,0;;s,29000,0.2836,0')!)).toEqual(carried(d));
    // The page's address before 14 October 2026, with the check of that day — 69 characters is 1x, and their sum
    // was 1,013: s5. Links written then have been sent, and open as the same shaft.
    expect(decodeShaft('1xs5;us;2,16;4,1.5_10,2_4,1.5_5,1.25;9,1000,360_21,400,0;;s,29000,0.2836,0')).toEqual(decodeShaft(encodeShaft(d)));
    expect(decodeShaft('1xs6;us;2,16;4,1.5_10,2_4,1.5_5,1.25;9,1000,360_21,400,0;;s,29000,0.2836,1')).toEqual(decodeShaft(encodeShaft(shaft({ ownWeight: true }))));
    expect(decodeShaft('1xs6;us;2,16;4,1.5_10,2_4,1.5_5,1.25;9,1000,360_21,400,0;;s,29000,0.2836,0')).toBeNull();
    // The page's key is its own: h, where the other calculators' are b, s and c.
    expect(SHAFT_KEY).toBe('h');
    expect([SPAN_KEY, CONTINUOUS_KEY, 'b']).not.toContain(SHAFT_KEY);
  });

  it('carries a bore where there is one, and nothing in its place where there is none', () => {
    expect(bodyOf(encodeShaft(d)).split(';')[2]).toBe('4,1.5_10,2_4,1.5_5,1.25');
    const tube = shaft({ segments: [seg(1, 4, 1.5, 0.5), seg(2, 10, 2), seg(3, 4, 1.5, 1.5), seg(4, 5, 1.25, -1)] });
    expect(bodyOf(encodeShaft(tube)).split(';')[2]).toBe('4,1.5,0.5_10,2_4,1.5,1.5_5,1.25,-1');
    expect(decodeShaft(encodeShaft(tube))!.segments.map((s) => s.bore)).toEqual([0.5, 0, 1.5, -1]);
    // A bore of zero written out is still a solid segment: such a link opens, though no form writes it.
    expect(decodeShaft(sealed('us;2,16;4,1.5,0_10,2;;;s,29000,0.2836,0'))?.segments.map((s) => s.bore)).toEqual([0, 0]);
    // One segment, and eight.
    for (const n of [1, 2, MAX_SEGMENTS]) {
      const f = shaft({ segments: Array.from({ length: n }, (_, i) => seg(i + 1, 3 + i, 2 + i / 8, i % 2 ? i / 8 : 0)) });
      expect(decodeShaft(encodeShaft(f))!.segments.map((s) => [s.L, s.d, s.bore]), String(n)).toEqual(f.segments.map((s) => [s.L, s.d, s.bore]));
    }
  });

  it('carries the two bearings as typed, in the order typed', () => {
    for (const bearings of [[2, 16], [16, 2], [0, 23], [-3, 40], [5, 5]] as [number, number][]) {
      expect(decodeShaft(encodeShaft(shaft({ bearings })))!.bearings, String(bearings)).toEqual(bearings);
    }
    expect(bodyOf(encodeShaft(shaft({ bearings: [16, 2] }))).split(';')[1]).toBe('16,2');
  });

  it('carries every direction, of a force and of a couple, in each plane', () => {
    for (const vDir of ['down', 'up'] as const) {
      for (const hDir of ['towards', 'away'] as const) {
        const back = decodeShaft(encodeShaft(shaft({ forces: [force(5, 9, 7, vDir, 3, hDir)] })))!;
        expect([back.forces[0].vDir, back.forces[0].hDir]).toEqual([vDir, hDir]);
        expect(bodyOf(encodeShaft(shaft({ forces: [force(5, 9, 7, vDir, 3, hDir)] }))).split(';')[3]).toBe(`9,${vDir === 'up' ? '-' : ''}7,${hDir === 'away' ? '-' : ''}3`);
      }
    }
    for (const vDir of ['ccw', 'cw'] as const) {
      for (const hDir of ['ccw', 'cw'] as const) {
        const back = decodeShaft(encodeShaft(shaft({ couples: [couple(7, 9, 7, vDir, 3, hDir)] })))!;
        expect([back.couples[0].vDir, back.couples[0].hDir]).toEqual([vDir, hDir]);
        expect(bodyOf(encodeShaft(shaft({ couples: [couple(7, 9, 7, vDir, 3, hDir)] }))).split(';')[4]).toBe(`9,${vDir === 'cw' ? '-' : ''}7,${hDir === 'cw' ? '-' : ''}3`);
      }
    }
  });

  it('carries the material with its two numbers, and whether the shaft’s own weight is a load', () => {
    for (const units of ['us', 'si'] as const) {
      for (const material of ['steel', 'stainless', 'aluminum'] as const) {
        for (const ownWeight of [true, false]) {
          const f = { ...reduceShaft(convertShaft(d, units), { type: 'material', material }), ownWeight };
          const back = decodeShaft(encodeShaft(f))!;
          expect([back.material, back.E, back.density, back.ownWeight], `${units} ${material}`).toEqual([material, SHAFT_MATERIALS[material][units].E, SHAFT_MATERIALS[material][units].density, ownWeight]);
        }
      }
    }
    expect(bodyOf(encodeShaft(reduceShaft(d, { type: 'material', material: 'stainless' }))).split(';')[5]).toBe('i,28000,0.289,0');
    expect(bodyOf(encodeShaft(reduceShaft(d, { type: 'material', material: 'aluminum' }))).split(';')[5]).toBe('a,10100,0.0975,0');
    const own = shaft({ material: 'custom', E: 16500, density: 0.16, ownWeight: true });
    expect(bodyOf(encodeShaft(own)).split(';')[5]).toBe('u,16500,0.16,1');
    expect(decodeShaft(encodeShaft(own))).toMatchObject({ material: 'custom', E: 16500, density: 0.16, ownWeight: true });
    // The listed numbers under the visitor's own letter stay the visitor's own.
    expect(decodeShaft(encodeShaft(shaft({ material: 'custom' })))!.material).toBe('custom');
  });

  // "Steel" beside another modulus would be a label that contradicts its
  // number, and switching units would quietly put the listed one back. Such
  // a link — written by hand, or sent before a listed number was changed —
  // opens on the numbers it carries, as the visitor's own.
  it('a listed material beside numbers that are not its own opens as the visitor’s own, with those numbers', () => {
    expect(decodeShaft(sealed('us;2,16;4,1.5;;;s,30000,0.2836,0'))).toMatchObject({ material: 'custom', E: 30000, density: 0.2836 });
    expect(decodeShaft(sealed('us;2,16;4,1.5;;;s,29000,0.283,1'))).toMatchObject({ material: 'custom', E: 29000, density: 0.283, ownWeight: true });
    // Steel's US numbers in a metric link are not steel's.
    expect(decodeShaft(sealed('si;2,16;4,1.5;;;s,29000,0.2836,0'))).toMatchObject({ material: 'custom', E: 29000, density: 0.2836 });
    expect(decodeShaft(sealed('si;2,16;4,1.5;;;s,200000,7850,0'))).toMatchObject({ material: 'steel', E: 200000, density: 7850 });
    for (const f of [shaft({ E: 30000 }), shaft({ density: 0.283 }), shaft({ material: 'aluminum' })]) {
      const back = decodeShaft(encodeShaft(f))!;
      expect([back.material, back.E, back.density]).toEqual(['custom', f.E, f.density]);
      expectSound(back, 'a label beside another number');
    }
  });

  // "Whatever is on screen is in the address": a field keeps eight figures,
  // and so does the link.
  it('carries the eight figures a field shows', () => {
    const form = shaft({ segments: [seg(1, 12.345678, 1.2345678, 0.12345678), seg(2, 10.000002, 1234.5678)], bearings: [0.00012345678, 123.45678], forces: [force(4, 9.8765432, 1234.567, 'up', 0.000012345678, 'away')] });
    expect(carried(decodeShaft(encodeShaft(form))!)).toEqual(carried(form));
    // Each number is written as its field shows it, whatever its size.
    for (const v of [20, 12.34567, 1234.567, 10.000002, 0.1 + 0.2, 1 / 3, 12.3456789, 29000, 1e-7, 0.000001234, 2e12, 123456789012, 1e21, 1.5e300, Number.MAX_VALUE, 5e-324]) {
      const f = shaft({ segments: [seg(1, v, v, v)], bearings: [v, v], forces: [force(2, v, v, 'down', v)], couples: [couple(3, v, v, 'ccw', v)], material: 'custom', E: v, density: v });
      const body = bodyOf(encodeShaft(f)).split(';');
      const text = fieldNumber(v).replace('+', '');
      expect(body.slice(1), String(v)).toEqual([`${text},${text}`, `${text},${text},${text}`, `${text},${text},${text}`, `${text},${text},${text}`, `u,${text},${text},0`]);
      const back = decodeShaft(encodeShaft(f))!;
      const read = Number(fieldNumber(v));
      expect([back.segments[0].L, back.segments[0].d, back.segments[0].bore, ...back.bearings, back.forces[0].x, back.forces[0].v, back.forces[0].h, back.couples[0].x, back.couples[0].v, back.couples[0].h, back.E, back.density], String(v)).toEqual(Array.from({ length: 13 }, () => read));
    }
    // A ninth figure is not on screen, and does not travel.
    expect(decodeShaft(encodeShaft(shaft({ segments: [seg(1, 12.3456789, 2)] })))!.segments[0].L).toBe(12.345679);
  });

  // A field holds whatever number is typed: a length of 0 on its way to 0.5,
  // a bore larger than its diameter on its way to a smaller one. That
  // shaft's address, reloaded, must be that shaft with its warning — not the
  // example.
  it('reopens as the form on screen, whatever a field holds', () => {
    for (const v of [0, -5, 2e12, 1e21, 1e-7]) {
      for (const over of [{ L: v }, { d: v }, { bore: v }]) {
        const form = { ...worked(), segments: worked().segments.map((s, i) => (i === 1 ? { ...s, ...over } : s)) };
        const link = encodeShaft(form);
        expect(link, JSON.stringify(over)).toMatch(WRITTEN_IN);
        const back = decodeShaft(link)!;
        expect(carried(back), JSON.stringify(over)).toEqual(carried(form));
        // What the form says is wrong with itself, it says again after the reload — on the row it is now.
        expect(formIssues(back).map((i) => i.code), JSON.stringify(over)).toEqual(formIssues(form).map((i) => i.code));
      }
      for (const over of [{ E: v }, { density: v }, { bearings: [v, v] as [number, number] }]) {
        const form = { ...worked(), ...over };
        expect(carried(decodeShaft(encodeShaft(form))!), JSON.stringify(over)).toEqual(carried(form));
      }
    }
    // Loads off the shaft, of no size, at one place; bearings in any order.
    const odd: ShaftForm = {
      ...worked(),
      bearings: [40, -2],
      forces: [force(4, -4, 3e15, 'down', 0, 'away'), force(5, 33.333333, 0, 'up', 12.75, 'away'), force(6, 0, 0, 'up', 0, 'towards'), force(7, 0, 0.000012345678, 'down', 1e-9, 'towards')],
      couples: [couple(8, 99, 0, 'cw', 0, 'cw'), couple(9, 10, 2.5, 'ccw', 0, 'cw')],
      E: 12345.678,
      density: 1e-12,
    };
    expect(carried(decodeShaft(encodeShaft(odd))!)).toEqual(carried(odd));
  });

  // A size being retyped passes through 0. An upward force at 0 must not
  // reopen pointing down, for the digits typed next to make it a force in
  // the wrong direction.
  it('a size of zero keeps its direction; a size typed with a minus reopens as the same load', () => {
    const zero = shaft({
      forces: [force(4, 9, 0, 'up', 0, 'away'), force(5, 9, 0, 'down', 0, 'towards'), force(6, 9, 0, 'up', 5, 'towards'), force(7, 9, 5, 'down', 0, 'away')],
      couples: [couple(8, 9, 0, 'cw', 0, 'cw'), couple(9, 9, 0, 'ccw', 0, 'ccw'), couple(10, 9, 0, 'cw', 5, 'ccw')],
    });
    expect(bodyOf(encodeShaft(zero)).split(';').slice(3, 5)).toEqual(['9,-0,-0_9,0,0_9,-0,5_9,5,-0', '9,-0,-0_9,0,0_9,-0,5']);
    // toEqual tells 0 from −0: none of the zeros that come back is a −0.
    expect(carried(decodeShaft(encodeShaft(zero))!)).toEqual(carried(zero));
    const minus = shaft({ forces: [force(4, 9, -5, 'down', -2, 'away'), force(5, 9, -5, 'up', -2, 'towards')], couples: [couple(6, 9, -5, 'ccw', -2, 'cw')] });
    const back = decodeShaft(encodeShaft(minus))!;
    expect(back.forces.map((p) => [p.v, p.vDir, p.h, p.hDir])).toEqual([[5, 'up', 2, 'towards'], [5, 'down', 2, 'away']]);
    expect(back.couples.map((p) => [p.v, p.vDir, p.h, p.hDir])).toEqual([[5, 'cw', 2, 'ccw']]);
    // The engine is given the same loads either way…
    expect(toEngine(back).model).toEqual(toEngine(minus).model);
    // …and from there on it is the form that travels.
    expect(carried(decodeShaft(encodeShaft(back))!)).toEqual(carried(back));
  });

  // 10³⁰⁸ lbf is a number; in newtons it is past the largest there is, and
  // the field is left empty with its row marked. That is a form too.
  it('a value that is no longer a number is still the form that was on screen, with the way it pointed', () => {
    const huge = convertShaft(shaft({ segments: [seg(1, 1e308, 2)], forces: [force(4, 9, 1e308, 'up', 1e308, 'away')], couples: [couple(5, 9, 1e308, 'cw')] }), 'si');
    expect([huge.segments[0].L, huge.forces[0].v, huge.forces[0].h]).toEqual([Infinity, Infinity, Infinity]);
    const link = encodeShaft(huge);
    expect(link).toMatch(WRITTEN_IN);
    expect(carried(decodeShaft(link)!)).toEqual(carried(huge));
    for (const v of [Infinity, Number.NaN]) {
      for (const [vDir, hDir] of [['down', 'towards'], ['up', 'away'], ['up', 'towards']] as const) {
        const f = shaft({ segments: [seg(1, v, v, v)], bearings: [v, v], forces: [force(2, v, v, vDir, v, hDir)], couples: [couple(3, v, v, vDir === 'up' ? 'cw' : 'ccw', v, hDir === 'away' ? 'cw' : 'ccw')], material: 'custom', E: v, density: v });
        expect(carried(decodeShaft(encodeShaft(f))!), `${v} ${vDir} ${hDir}`).toEqual(carried(f));
      }
    }
    // A position or a length below every number, too.
    const below = shaft({ segments: [seg(1, -Infinity, -Infinity, -Infinity)], bearings: [-Infinity, 2] });
    expect(carried(decodeShaft(encodeShaft(below))!)).toEqual(carried(below));
    // What is not a number is written by name: a size pointing the other way with a minus before it.
    expect(bodyOf(encodeShaft(shaft({ forces: [force(2, 9, Number.NaN, 'up', Infinity, 'away')] }))).split(';')[3]).toBe('9,-nan,-inf');
    expect(bodyOf(encodeShaft(shaft({ forces: [force(2, 9, Number.NaN, 'down', Infinity, 'towards')] }))).split(';')[3]).toBe('9,nan,inf');
  });

  // The shafts above are chosen; these are not. One to eight segments,
  // hollow or not, bearings anywhere, loads in every direction, any number a
  // field can show, each material, both systems.
  it('four hundred random forms each reopen as themselves', () => {
    const { rnd, pick } = dice(20261014);
    const seen = { segments: new Set<number>(), hollow: 0, loads: 0, materials: new Set<string>(), weighed: 0, lost: 0 };
    for (let i = 0; i < 400; i++) {
      const form = randomShaft(rnd, pick);
      const { units, material, segments } = form;
      const link = encodeShaft(form);
      expect(link).toMatch(WRITTEN_IN);
      const back = decodeShaft(link)!;
      expect(back, link).not.toBeNull();
      expect(carried(back), link).toEqual(carried(form));
      // A form of whole rows numbered afresh: the same one, when the rows of this one were numbered that way.
      expect(back, link).toEqual(form);
      expectSound(back, link);
      // The address of the shaft that came back is the address it came from: nothing drifts from reload to reload.
      expect(encodeShaft(back), link).toBe(link);
      // What the form says is wrong with itself, it says again after the reload; and the engine is sent the same.
      expect(formIssues(back), link).toEqual(formIssues(form));
      expect(toEngine(back), link).toEqual(toEngine(form));
      // …with its last few characters gone it is no link at all, and it is not another calculator's link either.
      expect(decodeShaft(link.slice(0, -1 - Math.floor(rnd() * 8))), link).toBeNull();
      expect(decodeBeam(link), link).toBeNull();
      expect(decodeContinuous(link), link).toBeNull();
      seen.segments.add(segments.length);
      seen.hollow += segments.filter((s) => s.bore !== 0).length;
      seen.loads += form.forces.length + form.couples.length;
      seen.materials.add(`${units} ${material}`);
      seen.weighed += Number(form.ownWeight);
      seen.lost += [...form.forces, ...form.couples].filter((p) => !Number.isFinite(p.v) || !Number.isFinite(p.h)).length;
    }
    // The set is as wide as it is said to be.
    expect(seen.segments.size).toBe(MAX_SEGMENTS);
    expect(seen.materials.size).toBe(8);
    expect(seen.hollow).toBeGreaterThan(300);
    expect(seen.loads).toBeGreaterThan(1000);
    expect(seen.lost).toBeGreaterThan(200);
    expect(seen.weighed).toBeGreaterThan(100);
  });

  it('refuses anything that is not this page’s shaft', () => {
    const plain = 'us;2,16;4,1.5_10,2,0.5;9,1000,-360;21,-40,15;s,29000,0.2836,1';
    expect(carried(decodeShaft(sealed(plain))!)).toEqual({
      units: 'us',
      bearings: [2, 16],
      segments: [[4, 1.5, 0], [10, 2, 0.5]],
      forces: [[9, 1000, 'down', 360, 'away']],
      couples: [[21, 40, 'cw', 15, 'ccw']],
      material: ['steel', 29000, 0.2836, true],
    });
    const segmentsOf = (n: number) => plain.replace('4,1.5_10,2,0.5', Array.from({ length: n }, () => '4,1.5').join('_'));
    const loads = (n: number, row: string) => plain.replace(row, Array.from({ length: n }, () => row).join('_'));
    const swap = (from: string, to: string) => {
      // The text to change is in the link, once: a variant that changed nothing would test nothing.
      expect(plain.split(from), from).toHaveLength(2);
      return plain.replace(from, to);
    };
    for (const body of [
      '',
      'hello',
      swap('us;', 'xx;'),
      swap('us;', ''),
      swap('us;', 'US;'),
      swap('us;', 'in;'),
      `${plain};extra`,
      `${plain};`,
      swap(';9,1000,-360;', ';'),
      // The bearings: two numbers, and nothing else.
      swap(';2,16;', ';2;'),
      swap(';2,16;', ';;'),
      swap(';2,16;', ';2,16,20;'),
      swap(';2,16;', ';2,16_3,17;'),
      swap(';2,16;', ';2,;'),
      swap(';2,16;', ';,16;'),
      swap(';2,16;', ';2_16;'),
      swap(';2,16;', ';a,b;'),
      swap(';2,16;', ';2,16 ;'),
      swap(';2,16;', ';constructor,16;'),
      // A shaft of no segment — with nothing else, and with loads on the shaft it has not — of nine, or with a
      // segment short of a number or with one too many.
      swap('4,1.5_10,2,0.5', ''),
      'us;2,16;;;;s,29000,0.2836,1',
      segmentsOf(MAX_SEGMENTS + 1),
      swap('4,1.5_', '4_'),
      swap('4,1.5_', '4,1.5,0,0_'),
      swap('4,1.5_', '4,1.5__'),
      swap('4,1.5_', '_4,1.5_'),
      swap('4,1.5_', '4,1.5,_'),
      swap('4,1.5_', '4,,1.5_'),
      // A number in any notation but the page's own, or no number at all.
      swap(';4,', ';0x4,'),
      swap(';4,', ';4e+0,'),
      swap(';4,', ';4.,'),
      swap(';4,', ';.5,'),
      swap(';4,', '; 4,'),
      swap(';4,', ';4E0,'),
      swap(';4,', ';,'),
      swap(';4,', ';1e999,'),
      swap(';4,', ';Infinity,'),
      swap(';4,', ';NaN,'),
      swap(';4,', ';INF,'),
      swap(';4,', ';+inf,'),
      swap(';4,', ';4in,'),
      // −nan is a size pointing the other way, and nothing else: no length, no place, no modulus.
      swap(';4,', ';-nan,'),
      swap(';9,1000', ';-nan,1000'),
      swap('s,29000,', 's,-nan,'),
      swap(';2,16;', ';-nan,16;'),
      // A load: its place and its two sizes, and no more.
      swap('9,1000,-360', '9,1000'),
      swap('9,1000,-360', '9,1000,-360,1'),
      swap('9,1000,-360', '9,1000,--360'),
      swap('9,1000,-360', '9,1000,+360'),
      swap('9,1000,-360', '9,1000,-360lbf'),
      swap('9,1000,-360', '9,1000,-360_'),
      swap('9,1000,-360', 'd9,1000,-360'),
      swap('9,1000,-360', '9,1000,nan-'),
      swap('21,-40,15', '21,-40'),
      swap('21,-40,15', '21,-40,15,0'),
      swap('21,-40,15', 'constructor,-40,15'),
      swap('21,-40,15', '21,-40,cw'),
      loads(MAX_ROWS + 1, '9,1000,-360'),
      loads(MAX_ROWS + 1, '21,-40,15'),
      // The material: one of four letters, a modulus, a density, and a 0 or a 1.
      swap('s,29000', 'z,29000'),
      swap('s,29000', 'S,29000'),
      swap('s,29000', 'steel,29000'),
      swap('s,29000', 'constructor,29000'),
      swap('s,29000', 'toString,29000'),
      swap('s,29000', '__proto__,29000'),
      swap('s,29000', ',29000'),
      swap('s,29000', 'c,29000'),
      swap('s,29000', 'w,29000'),
      swap(',0.2836,1', ',0.2836'),
      swap(',0.2836,1', ',0.2836,2'),
      swap(',0.2836,1', ',0.2836,'),
      swap(',0.2836,1', ',0.2836,true'),
      swap(',0.2836,1', ',0.2836,1,1'),
      swap(',0.2836,1', ',1'),
      swap(',0.2836,1', ',,1'),
      swap('s,29000,0.2836,1', ''),
      swap('s,29000,0.2836,1', 's'),
      'x'.repeat(2500),
    ]) {
      // Behind a check that is right, so that it is the shaft that is refused; and bare, with no check at all.
      expect(() => decodeShaft(sealed(body)), body.slice(0, 70)).not.toThrow();
      expect(decodeShaft(sealed(body)), body.slice(0, 70)).toBeNull();
      expect(decodeShaft(body), body.slice(0, 70)).toBeNull();
    }
    // Eight segments and twelve loads of each kind are the limits, and are accepted; so is a shaft with no load at all.
    expect(decodeShaft(sealed(segmentsOf(MAX_SEGMENTS)))?.segments).toHaveLength(MAX_SEGMENTS);
    expect(decodeShaft(sealed(loads(MAX_ROWS, '9,1000,-360')))?.forces).toHaveLength(MAX_ROWS);
    expect(decodeShaft(sealed(loads(MAX_ROWS, '21,-40,15')))?.couples).toHaveLength(MAX_ROWS);
    expect(decodeShaft(sealed('us;2,16;4,1.5;;;s,29000,0.2836,0'))).toMatchObject({ forces: [], couples: [], nextId: 2 });
    // A size that is no number, pointing either way, is a form: it was on screen.
    expect(decodeShaft(sealed(swap('9,1000,-360', '9,-nan,nan')))?.forces[0]).toEqual({ id: 3, x: 9, v: Number.NaN, vDir: 'up', h: Number.NaN, hDir: 'towards' });
  });

  // Each calculator's address is its own. One opened as another's would be
  // another case: none reads another's.
  it('is not the address of any other calculator, nor they its own', () => {
    const first = encodeBeam(defaultBeam());
    expect(decodeShaft(first)).toBeNull();
    expect(decodeShaft(sealed(bodyOf(first)))).toBeNull();
    const second = encodeSpan(defaultSpan(), DEFAULT_LIMIT, 0);
    expect(decodeShaft(second)).toBeNull();
    expect(decodeShaft(sealed(second))).toBeNull();
    const third = encodeContinuous(defaultContinuous());
    expect(decodeShaft(third)).toBeNull();
    expect(decodeShaft(sealed(bodyOf(third)))).toBeNull();
    // A link of the first calculator from before there was a check begins with its units.
    expect(decodeShaft(bodyOf(first))).toBeNull();
    for (const f of [d, worked(), metric(), shaft({ segments: [seg(1, 20, 2)], forces: [], couples: [] })]) {
      const link = encodeShaft(f);
      for (const text of [link, bodyOf(link)]) {
        expect(decodeBeam(text)).toBeNull();
        expect(decodeContinuous(text)).toBeNull();
        expect(decodeSpan(text)).toBeNull();
      }
      expect(decodeSpan(`${DEFAULT_LIMIT}~~${link}`)).toBeNull();
    }
  });

  // No form writes more than this: eight hollow segments and twelve loads of
  // each kind, every number at its longest. It must open; and nothing longer
  // is looked at.
  it('reads the longest link a form can write, and nothing longer', () => {
    const big = -1.2345678e20;
    expect(String(big)).toHaveLength(22);
    const worst: ShaftForm = {
      units: 'us',
      segments: Array.from({ length: MAX_SEGMENTS }, (_, i) => seg(i + 1, big, big, big)),
      bearings: [big, big],
      // A size is written with its direction: the longest is one pointing the other way.
      forces: Array.from({ length: MAX_ROWS }, (_, i) => force(20 + i, big, -big, 'up', -big, 'away')),
      couples: Array.from({ length: MAX_ROWS }, (_, i) => couple(40 + i, big, -big, 'cw', -big, 'cw')),
      material: 'custom',
      E: big,
      density: big,
      ownWeight: true,
      nextId: 100,
    };
    const link = encodeShaft(worst);
    expect(link).toHaveLength(2319);
    expect(carried(decodeShaft(link)!)).toEqual(carried(worst));
    // Zeros after a decimal point are still the number, so a link can be
    // padded to any length with every field in order: it is the length that
    // is refused.
    const padded = (n: number) => sealed(bodyOf(encodeShaft(d)).replace(';4,', `;4.${'0'.repeat(n)},`));
    expect(decodeShaft(padded(2400))?.segments[0].L).toBe(4);
    expect(padded(2400).length).toBeLessThanOrEqual(2500);
    expect(padded(2450).length).toBeGreaterThan(2500);
    expect(decodeShaft(padded(2450))).toBeNull();
  });
});

describe('shaft form: a link that lost part of itself', () => {
  const d = defaultShaft();
  // Hollow or not, loads or none, each material, both unit systems, one segment and several.
  const forms: [string, ShaftForm][] = [
    ['the example', d],
    ['the example, SI', convertShaft(d, 'si')],
    ['the example with its own weight', shaft({ ownWeight: true })],
    ['one of everything', worked()],
    ['one of everything, SI', convertShaft(worked(), 'si')],
    ['a metric tube', metric()],
    ['one segment and nothing else', shaft({ segments: [seg(1, 20, 2)], forces: [], couples: [], material: 'aluminum', E: 10100, density: 0.0975 })],
  ];

  // The check counts the characters behind it, and adds them up.
  it('cut short anywhere, it is not a link to another shaft', () => {
    for (const [name, form] of forms) {
      const link = encodeShaft(form);
      expect(carried(decodeShaft(link)!), name).toEqual(carried(form));
      for (let length = 0; length < link.length; length++) {
        const cut = link.slice(0, length);
        expect(decodeShaft(cut), `${name}: ${cut}`).toBeNull();
      }
    }
    const tube = encodeShaft(metric());
    expect(tube.endsWith(';s,200000,7850,1')).toBe(true);
    expect(decodeShaft(tube)?.ownWeight).toBe(true);
    expect(decodeShaft(tube.slice(0, -1))).toBeNull();
  });

  // …_10,2_… with one character gone is …_1,2_…: every field still in its
  // place, and a shaft 9 in shorter. Without the check that is a link, to
  // another shaft, with no notice.
  it('nor with one character lost in the middle of it', () => {
    const link = encodeShaft(d);
    const less = link.replace('_10,2_', '_1,2_');
    expect(less).toHaveLength(link.length - 1);
    expect(decodeShaft(less)).toBeNull();
    // Behind a check of its own it is a shaft, and not this one: that is what was refused.
    expect(decodeShaft(sealed(bodyOf(less)))?.segments.map((s) => s.L)).toEqual([4, 1, 4, 5]);
    for (const [name, form] of forms) {
      const whole = encodeShaft(form);
      const at = whole.indexOf(';');
      for (let i = at + 1; i < whole.length; i++) expect(decodeShaft(whole.slice(0, i) + whole.slice(i + 1)), `${name}: without character ${i}`).toBeNull();
    }
  });

  it('nor with something added, one character changed, or two neighbours swapped', () => {
    const letters = '0123456789.,;_-/abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ';
    for (const [name, form] of forms.slice(0, 5)) {
      const link = encodeShaft(form);
      const at = link.indexOf(';');
      const [check, body] = [link.slice(0, at), link.slice(at + 1)];
      for (const more of ['0', '.', ')', ';', ' ', '%20']) expect(decodeShaft(link + more), `${name} + "${more}"`).toBeNull();
      for (let i = 0; i < body.length; i++) {
        for (const ch of letters) {
          if (ch === body[i]) continue;
          const changed = `${check};${body.slice(0, i)}${ch}${body.slice(i + 1)}`;
          expect(decodeShaft(changed), `${name}: ${changed}`).toBeNull();
        }
        if (i + 1 < body.length && body[i] !== body[i + 1]) {
          const swapped = `${check};${body.slice(0, i)}${body[i + 1]}${body[i]}${body.slice(i + 2)}`;
          expect(decodeShaft(swapped), `${name}: ${swapped}`).toBeNull();
        }
      }
      // The check itself is part of the link: another one is another link, and none at all is no link.
      for (const other of ['', '0', 'us', check.slice(0, -1), `${check}0`, check.toUpperCase() === check ? `${check}a` : check.toUpperCase()]) {
        expect(decodeShaft(`${other};${body}`), `${name}: "${other}"`).toBeNull();
      }
      expect(decodeShaft(body), name).toBeNull();
    }
  });
});

/* ── The check, put to the test (beam/model.test.ts holds the check itself; these are this page's links) ── */

/** Printable ASCII: what a link typed over, or garbled on its way, is likeliest to hold. */
const PRINTABLE = Array.from({ length: 95 }, (_, i) => String.fromCharCode(32 + i)).join('');
/** What an address is written in, and a few characters it is not. */
const WRITTEN = '0123456789.,;_-/~abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ %';

/** Every text one character away from `link` — changed, added, taken away, at every place, the check included — with every character of `alphabet`, or `per` drawn at each place. */
function* oneAway(link: string, alphabet: string, draw?: { rnd: () => number; per: number }): Generator<string> {
  for (let i = 0; i <= link.length; i++) {
    const chars = draw ? Array.from({ length: draw.per }, () => alphabet[Math.floor(draw.rnd() * alphabet.length)]) : [...alphabet];
    for (const ch of chars) {
      yield link.slice(0, i) + ch + link.slice(i);
      if (i < link.length && ch !== link[i]) yield link.slice(0, i) + ch + link.slice(i + 1);
    }
    if (i < link.length) yield link.slice(0, i) + link.slice(i + 1);
  }
}

/** `link` with two of its characters, drawn at random anywhere in it, changed to others of `alphabet`. */
const twoChanged = (link: string, alphabet: string, rnd: () => number): string => {
  const chars = [...link];
  const i = Math.floor(rnd() * chars.length);
  let j = Math.floor(rnd() * (chars.length - 1));
  if (j >= i) j += 1;
  for (const at of [i, j]) {
    const was = chars[at];
    while (chars[at] === was) chars[at] = alphabet[Math.floor(rnd() * alphabet.length)];
  }
  return chars.join('');
};

/** Every pair of characters 54 apart in `body`, one moved a code up and the other down: what the check of before let through every time. */
function* apart54(body: string): Generator<string> {
  const printable = (c: number) => c >= 32 && c <= 126;
  for (let i = 0; i + 54 < body.length; i++) {
    const [p, q] = [body.charCodeAt(i), body.charCodeAt(i + 54)];
    const d = printable(p + 1) && printable(q - 1) ? 1 : printable(p - 1) && printable(q + 1) ? -1 : 0;
    if (d) yield body.slice(0, i) + String.fromCharCode(p + d) + body.slice(i + 1, i + 54) + String.fromCharCode(q - d) + body.slice(i + 55);
  }
}

describe('shaft form: the check of its address, put to the test', () => {
  const d = defaultShaft();
  const examples: ShaftForm[] = [
    d,
    convertShaft(d, 'si'),
    shaft({ ownWeight: true }),
    worked(),
    convertShaft(worked(), 'si'),
    metric(),
    shaft({ segments: [seg(1, 20, 2)], forces: [], couples: [], material: 'aluminum', E: 10100, density: 0.0975 }),
  ];
  /** Three hundred shafts not chosen, from the generator the round trip is held to. */
  const drawn = (() => {
    const { rnd, pick } = dice(20261015);
    return { rnd, forms: Array.from({ length: 300 }, () => randomShaft(rnd, pick)) };
  })();
  const links = [...examples, ...drawn.forms].map(encodeShaft);

  it('every shaft opens as itself, behind the check described, and writes the same address again', () => {
    for (const form of [...examples, ...drawn.forms]) {
      const link = encodeShaft(form);
      expect(link).toBe(sealed(bodyOf(link)));
      const back = decodeShaft(link)!;
      expect(back, link).not.toBeNull();
      expect(carried(back), link).toEqual(carried(form));
      expect(encodeShaft(back), link).toBe(link);
    }
  });

  it('one character changed, added or taken away anywhere — the check included — is no link: the examples with every printable character, the random shafts with characters drawn at every place', () => {
    let tried = 0;
    for (const [n, link] of links.entries()) {
      for (const text of n < examples.length ? oneAway(link, PRINTABLE) : oneAway(link, WRITTEN, { rnd: drawn.rnd, per: 1 })) {
        tried += 1;
        if (decodeShaft(text) !== null) expect.fail(`opened: ${text}`);
      }
    }
    expect(tried).toBeGreaterThan(250000);
  }, 30_000);

  it('two characters changed are no link: twenty thousand drawn anywhere, and every pair 54 apart — each of which the check of before let through', () => {
    for (let n = 0; n < 20000; n++) {
      const text = twoChanged(links[n % links.length], n % 2 ? PRINTABLE : WRITTEN, drawn.rnd);
      if (decodeShaft(text) !== null) expect.fail(`opened: ${text}`);
    }
    // The longest link a form writes: eight hollow segments, twelve loads of each kind, every number at its longest.
    const big = -1.2345678e20;
    const longest = encodeShaft({
      units: 'us',
      segments: Array.from({ length: MAX_SEGMENTS }, (_, i) => seg(i + 1, big, big, big)),
      bearings: [big, big],
      forces: Array.from({ length: MAX_ROWS }, (_, i) => force(20 + i, big, -big, 'up', -big, 'away')),
      couples: Array.from({ length: MAX_ROWS }, (_, i) => couple(40 + i, big, -big, 'cw', -big, 'cw')),
      material: 'custom',
      E: big,
      density: big,
      ownWeight: true,
      nextId: 100,
    });
    let pairs = 0;
    for (const link of [longest, ...links.slice(0, examples.length)]) {
      const body = bodyOf(link);
      for (const changed of apart54(body)) {
        pairs += 1;
        // The check of before could not tell this body from the one written; this one can.
        expect(oldCheckOf(changed)).toBe(oldCheckOf(body));
        if (decodeShaft(`${link.slice(0, link.indexOf(';'))};${changed}`) !== null) expect.fail(`opened: ${changed}`);
      }
    }
    expect(pairs).toBeGreaterThan(2300);
  });

  it('every one of those shafts opens from a link with the check of before 14 October 2026, as the same shaft', () => {
    for (const link of links) {
      const old = oldSealed(bodyOf(link));
      expect(old, link).not.toBe(link);
      expect(decodeShaft(old), old).toEqual(decodeShaft(link));
    }
  });
});
