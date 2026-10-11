import { readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { fieldNumber } from '../format';
import { MATERIALS, US_TO_SI, analyse, bendingStress, convertUnits, decodeBeam, defaultBeam, encodeBeam, reduceBeam, type BeamAction, type BeamForm, type SteelShape } from './model';
import { DEFAULT_LIMIT, SPAN_KEY, adoptBeam, beyondSpan, byLoad, convertStress, decodeSpan, defaultSpan, encodeSpan, pinEnds, reduceSpan, sizing } from './span';

/**
 * THE SINGLE-SPAN PAGE'S OWN ARITHMETIC: the supports it fixes, each load
 * alone, the section a limit asks for, and its case in an address.
 *
 * The engine and the form are held in solver.test.ts and model.test.ts.
 * What can go wrong here is what is new: a row of the table that is not its
 * load's share, a factor of 12 or of 1,000 in a section needed, a link that
 * opens on another limit — or on supports this page does not have.
 *
 * The closed forms are the beam tables' (a simply supported span), worked
 * here in plain arithmetic: nothing below asks span.ts what it should say.
 */

const shapes: SteelShape[] = JSON.parse(readFileSync(join(resolve(__dirname, '..', '..'), 'steel', 'aisc-shapes.json'), 'utf8')).shapes;
const shape = (name: string) => shapes.find((s) => s.designation === name)!;
const near = (got: number, want: number, tol = 1e-9) => expect(Math.abs(got - want), `got ${got}, want ${want}`).toBeLessThanOrEqual(tol * Math.max(1, Math.abs(want)));

/** The example span with other loads, length or section. */
const span = (over: Partial<BeamForm>): BeamForm => pinEnds({ ...defaultSpan(), ...over });
const section = (over: Partial<BeamForm['section']>): BeamForm['section'] => ({ ...defaultSpan().section, ...over });
const point = (x: number, P: number, dir: 'down' | 'up' = 'down', id = 11) => ({ id, x, P, dir });
const dist = (x1: number, x2: number, w1: number, w2: number, dir: 'down' | 'up' = 'down', id = 21) => ({ id, x1, x2, w1, w2, dir });
/** A beam of the first calculator that this page has no fields for: a wall, a third support, a hinge, an applied moment. */
const foreign = (): BeamForm => ({
  ...defaultBeam(),
  supports: [{ id: 1, kind: 'fixed', x: 0 }, { id: 2, kind: 'roller', x: 12 }, { id: 3, kind: 'roller', x: 20 }],
  hinges: [{ id: 4, x: 6 }],
  points: [{ id: 5, x: 12, P: 8, dir: 'down' }],
  dists: [{ id: 6, x1: 0, x2: 20, w1: 1.2, w2: 1.2, dir: 'down' }],
  couples: [{ id: 7, x: 15, M: 50, dir: 'cw' }],
  nextId: 8,
});
const supportsOf = (f: BeamForm) => f.supports.map((s) => [s.kind, s.x]);

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
/** A span as a visitor could have it: any length, a few loads of each kind, anywhere on it, either way up. */
function randomSpan(rnd: () => number, pick: <T>(list: readonly T[]) => T): BeamForm {
  const L = Number(fieldNumber(pick([8, 20, 24, 37.5, 6.096, 0.75, 120]) * (0.5 + rnd())));
  const at = () => Number(fieldNumber(pick([0, L, L / 2, rnd() * L, rnd() * L])));
  const size = () => Number(fieldNumber(pick([0, 1, 0.35, 12, 250]) * rnd()));
  const dir = () => pick(['down', 'down', 'up'] as const);
  let id = 1;
  const some = <T>(row: () => T): T[] => Array.from({ length: Math.floor(rnd() * 5) }, row);
  const units = pick(['us', 'si'] as const);
  return pinEnds({
    ...defaultSpan(),
    units,
    // Steel's modulus in the system the span is in: a listed material is the listed one only with its listed E.
    section: { ...defaultSpan().section, E: MATERIALS.steel[units] },
    L,
    points: some(() => ({ id: id++, x: at(), P: size(), dir: dir() })),
    // Uniform, triangular either way, trapezoidal; over the whole span, a part of it, entered right to left, or of no length.
    dists: some(() => ({ id: id++, x1: at(), x2: at(), w1: pick([size(), 0]), w2: pick([size(), 0]), dir: dir() })),
    nextId: id,
  });
}

describe('single span: the beam the page opens with, by hand', () => {
  // 24 ft; 0.8 kip/ft over all of it; 6 kip at 8 ft. E = 29,000 ksi, I = 518 in⁴, S = 64.7 in³ (a W16×40).
  const form = defaultSpan();
  const a = analyse(form);
  const s = a.solution!;

  it('is that beam, and not the first calculator’s', () => {
    expect(form.units).toBe('us');
    expect(form.L).toBe(24);
    expect(form.points.map((p) => [p.x, p.P, p.dir])).toEqual([[8, 6, 'down']]);
    expect(form.dists.map((d) => [d.x1, d.x2, d.w1, d.w2, d.dir])).toEqual([[0, 24, 0.8, 0.8, 'down']]);
    expect([form.section.mode, form.section.E, form.section.I, form.section.S, form.section.Av]).toEqual(['props', 29000, 518, 64.7, 4.88]);
    // Those properties are the W16×40's own: I, S, and the web d × t_w for the shear area.
    const w = shape('W16X40');
    expect([w.Ix, w.Sx]).toEqual([518, 64.7]);
    near(w.d * w.tw, 4.88);
    expect(form.section.shape).toBe('W16X40');
    expect(encodeBeam(form)).not.toBe(encodeBeam(defaultBeam()));
    expect(a.issues).toEqual([]);
  });

  // Uniform: 0.8 × 24 ÷ 2 = 9.6 each. Point: 6 × 16 ÷ 24 = 4 on the left, 6 × 8 ÷ 24 = 2 on the right.
  it('reactions 13.6 and 11.6 kip', () => {
    expect(supportsOf(form)).toEqual([['pin', 0], ['roller', 24]]);
    near(s.reactions[0].Rv, 13.6);
    near(s.reactions[1].Rv, 11.6);
    near(s.totalLoad, 0.8 * 24 + 6);
  });

  // Right of the load the shear is 13.6 − 6 − 0.8x: zero at x = 7.6 ÷ 0.8 = 9.5 ft.
  // M(9.5) = 13.6 × 9.5 − 0.8 × 9.5² ÷ 2 − 6 × 1.5 = 129.2 − 36.1 − 9 = 84.1 kip·ft
  // (from the right: 11.6 × 14.5 − 0.8 × 14.5² ÷ 2 = 168.2 − 84.1 = 84.1).
  it('the largest moment is 84.1 kip·ft, at 9.5 ft', () => {
    near(s.extremes.Mmax.x, 9.5, 1e-7);
    near(s.extremes.Mmax.value, 84.1);
    near(13.6 * 9.5 - (0.8 * 9.5 ** 2) / 2 - 6 * 1.5, 84.1);
  });

  // The slope is zero where, with u = w(L³ − 6Lx² + 4x³)/24 and p = Pa(3x² − 6Lx + 2L² + a²)/6L, u + p = 0.
  // At x = 11.5: u = (13824 − 19044 + 6083.5)/30 = 28.78, p = (396.75 − 1656 + 1216)/3 = −14.42: still going down.
  // At x = 11.7: u = (13824 − 19712.16 + 6406.45)/30 = 17.28, p = (410.67 − 1684.8 + 1216)/3 = −19.38: coming up.
  // Between them, at 11.5 + 0.2 × 14.37 ÷ (14.37 + 2.10) = 11.67 ft. There, by the beam tables:
  //   uniform  wx(L³ − 2Lx² + x³)/24      = 0.8 × 11.674 × (13824 − 6541.9 + 1591.1) ÷ 24      = 3,452.9 kip·ft³
  //   point    Pa(L − x)(2Lx − x² − a²)/6L = 48 × 12.326 × (560.37 − 136.29 − 64) ÷ 144         = 1,479.4 kip·ft³
  // EI = 29,000 × 518 ÷ 144 = 104,319.4 kip·ft², so v = 4,932.3 ÷ 104,319.4 ft = 0.047281 ft = 0.5674 in: L/508.
  it('the largest deflection is 0.5674 in, at 11.67 ft: L/508', () => {
    const x = s.extremes.EIvMin.x;
    near(x, 11.674, 1e-4);
    const uniform = (0.8 * x * (24 ** 3 - 2 * 24 * x ** 2 + x ** 3)) / 24;
    const under = (6 * 8 * (24 - x) * (2 * 24 * x - x ** 2 - 8 ** 2)) / (6 * 24);
    near(uniform, 3452.9, 1e-4);
    near(under, 1479.4, 1e-4);
    near(s.extremes.EIvMin.value, -(uniform + under));
    near(a.EI, (29000 * 518) / 144);
    expect(a.spans).toHaveLength(1);
    near(a.spans[0].deflection, -0.5674, 1e-4);
    near(a.spans[0].ratio!, 507.6, 1e-4);
    near((24 * 12) / 0.5674, 507.6, 1e-4);
  });
});

describe('single span: the supports are not the visitor’s to place', () => {
  it('a pin at 0 and a roller at L, no hinge and no applied moment — the loads untouched', () => {
    const f = foreign();
    const pinned = pinEnds(f);
    expect(supportsOf(pinned)).toEqual([['pin', 0], ['roller', 20]]);
    expect(pinned.hinges).toEqual([]);
    expect(pinned.couples).toEqual([]);
    expect(pinned.points).toBe(f.points);
    expect(pinned.dists).toBe(f.dists);
    expect(pinned.section).toBe(f.section);
    expect([pinned.units, pinned.L, pinned.nextId]).toEqual([f.units, f.L, f.nextId]);
    // The form given is not written on.
    expect(f.supports).toHaveLength(3);
    expect(analyse(pinned).issues).toEqual([]);
  });

  it('whatever the length, the roller is on the end', () => {
    for (const L of [24, 0.3, 7.3152, 1e-7, 1e21]) expect(supportsOf(span({ L })), String(L)).toEqual([['pin', 0], ['roller', L]]);
  });

  // No end to put the roller on. The form then says what is wrong with the length, as on the first calculator.
  it('with a length that is not a positive number the supports stay where they were', () => {
    for (const L of [0, -5, Number.NaN, Infinity, -Infinity]) {
      const f = { ...foreign(), L };
      const pinned = pinEnds(f);
      expect(pinned.supports, String(L)).toBe(f.supports);
      expect(pinned.hinges).toEqual([]);
      expect(pinned.couples).toEqual([]);
      expect(analyse(pinned).issues.map((i) => i.code), String(L)).toContain('length');
      // …and they are put right by the edit that makes the length one.
      expect(supportsOf(reduceSpan(pinned, { type: 'length', L: 30 }))).toEqual([['pin', 0], ['roller', 30]]);
    }
  });

  it('a span that is already so comes back as the very same form', () => {
    const f = defaultSpan();
    expect(pinEnds(f)).toBe(f);
    const again = pinEnds(foreign());
    expect(pinEnds(again)).toBe(again);
    // A length that cannot hold a roller, with nothing to take away, likewise.
    const none = { ...defaultSpan(), L: 0 };
    expect(pinEnds(none)).toBe(none);
  });

  // A row's key on the page is its id. Loads get theirs from nextId, upward from wherever a link left it.
  it('no load is ever given the id of a support', () => {
    let f = pinEnds(decodeBeam(encodeBeam(foreign()))!);
    const ids = () => [...f.points, ...f.dists].map((r) => r.id);
    for (let i = 0; i < 30; i++) f = reduceSpan(f, { type: 'add', list: i % 2 ? 'points' : 'dists' });
    expect(ids().length).toBeGreaterThan(20);
    for (const s of f.supports) expect(ids()).not.toContain(s.id);
    expect(new Set(ids()).size).toBe(ids().length);
    expect(new Set(f.supports.map((s) => s.id)).size).toBe(2);
    for (const s of defaultSpan().supports) expect([...defaultSpan().points, ...defaultSpan().dists].map((r) => r.id)).not.toContain(s.id);
  });

  it('every edit leaves the span pinned at its two ends', () => {
    const actions: BeamAction[] = [
      { type: 'load', form: foreign() },
      { type: 'units', units: 'si' },
      { type: 'length', L: 31.5 },
      { type: 'carry-end', from: 24, to: 31.5 },
      { type: 'layout', layout: 'cantilever' },
      { type: 'layout', layout: 'three-span' },
      { type: 'add', list: 'supports' },
      { type: 'add', list: 'hinges' },
      { type: 'add', list: 'couples' },
      { type: 'add', list: 'points' },
      { type: 'add', list: 'dists' },
      { type: 'remove', list: 'supports', id: -1 },
      { type: 'patch', list: 'supports', id: -2, patch: { kind: 'fixed', x: 3 } },
      { type: 'section', patch: { mode: 'rect' } },
      { type: 'material', material: 'wood' },
    ];
    for (const action of actions) {
      const next = reduceSpan(defaultSpan(), action);
      expect(supportsOf(next), action.type).toEqual([['pin', 0], ['roller', next.L]]);
      expect([next.hinges, next.couples], action.type).toEqual([[], []]);
      // What the edit does to the loads and the section is what it does on the first calculator.
      const plain = reduceBeam(defaultSpan(), action);
      expect([next.units, next.L, next.points, next.dists, next.section], action.type).toEqual([plain.units, plain.L, plain.points, plain.dists, plain.section]);
    }
    // In metres the roller is on the converted end, to the figure the length field shows.
    expect(supportsOf(reduceSpan(defaultSpan(), { type: 'units', units: 'si' }))).toEqual([['pin', 0], ['roller', 7.3152]]);
  });

  // Typing 30 over 24 makes the length 3 on the way. The roller follows it at
  // once; what a load's end does is the Length field's to say when it is left.
  it('the roller follows the length as it is typed; a load on the end is carried when the field is left', () => {
    const typing = reduceSpan(defaultSpan(), { type: 'length', L: 30 });
    expect(supportsOf(typing)).toEqual([['pin', 0], ['roller', 30]]);
    expect(typing.dists[0].x2).toBe(24);
    const left = reduceSpan(typing, { type: 'carry-end', from: 24, to: 30 });
    expect(left.dists[0].x2).toBe(30);
    expect(left.points[0].x).toBe(8);
  });
});

describe('single span: each kind of load alone, against the beam tables', () => {
  const EI = (29000 * 518) / 144; // kip·ft²
  const inches = (EIv: number) => (EIv / EI) * 12;
  /** One load alone on the example's span and section, read at a section and at a point. */
  const alone = (over: Partial<BeamForm>, xM: number, xD: number) => {
    const out = byLoad(span({ points: [], dists: [], ...over }), null, xM, xD)!;
    expect(out.rows).toHaveLength(1);
    return out.rows[0];
  };

  // w = 0.8 kip/ft, L = 24 ft: wL/2 = 9.6 kip; wL²/8 = 0.8 × 576 ÷ 8 = 57.6 kip·ft;
  // 5wL⁴/384 = 5 × 0.8 × 331,776 ÷ 384 = 3,456 kip·ft³, which over EI and × 12 is 0.3975 in.
  it('a uniform load over the span: wL/2, wL²/8, 5wL⁴/384EI', () => {
    const r = alone({ dists: [dist(0, 24, 0.8, 0.8)] }, 12, 12);
    near(r.left, 9.6);
    near(r.right, 9.6);
    near(r.M, 57.6);
    near(r.EIv, -3456);
    near(r.deflection, -inches(3456));
    near(r.deflection, -0.3975, 1e-4);
    // In inches throughout: 5 × (0.8/12) × 288⁴ ÷ (384 × 29,000 × 518) = 0.3975 in.
    near((5 * (0.8 / 12) * 288 ** 4) / (384 * 29000 * 518), 0.3975, 1e-4);
  });

  // P = 6 kip at a = 8 ft, b = 16 ft: Pb/L = 4, Pa/L = 2, Pab/L = 6 × 8 × 16 ÷ 24 = 32 kip·ft under it;
  // under it Pa²b²/3L = 6 × 64 × 256 ÷ 72 = 1,365.33 kip·ft³: 0.1571 in.
  it('a point load at a: Pb/L, Pa/L, Pab/L under it, Pa²b²/3EIL under it', () => {
    const r = alone({ points: [point(8, 6)] }, 8, 8);
    near(r.left, 4);
    near(r.right, 2);
    near(r.M, 32);
    near(r.EIv, -(6 * 64 * 256) / 72);
    near(r.deflection, -0.1571, 1e-3);
    // Anywhere else along the span, the moment is the nearer reaction times its arm.
    near(alone({ points: [point(8, 6)] }, 3, 8).M, 4 * 3);
    near(alone({ points: [point(8, 6)] }, 20, 8).M, 2 * 4);
  });

  // Rising from 0 to w = 1.5 kip/ft over L = 24 ft: W = 18 kip at 2L/3. wL/6 = 6, wL/3 = 12;
  // the shear is zero at L/√3 = 13.856 ft, where M = wL²/9√3 = 1.5 × 576 ÷ 15.588 = 55.43 kip·ft.
  it('a triangular load rising to w: wL/6, wL/3, wL²/9√3 at L/√3', () => {
    const form = span({ points: [], dists: [dist(0, 24, 0, 1.5)] });
    const peak = analyse(form).solution!.extremes.Mmax;
    near(peak.x, 24 / Math.sqrt(3), 1e-7);
    near(peak.value, (1.5 * 576) / (9 * Math.sqrt(3)));
    near(peak.value, 55.43, 1e-4);
    const r = alone({ dists: [dist(0, 24, 0, 1.5)] }, peak.x, 12);
    near(r.left, 6);
    near(r.right, 12);
    near(r.M, 55.43, 1e-4);
    // The same load entered the other way round rises to the left: the reactions change places.
    const mirrored = alone({ dists: [dist(0, 24, 1.5, 0)] }, 12, 12);
    near(mirrored.left, 12);
    near(mirrored.right, 6);
  });

  // 2 kip/ft from 6 to 14 ft: W = 16 kip at 10 ft. Right: 16 × 10 ÷ 24 = 6.667; left: 9.333.
  // At 18 ft, past the load, M = 6.667 × 6 = 40; at 10 ft, inside it, M = 9.333 × 10 − 2 × 4² ÷ 2 = 77.33.
  it('a uniform load over part of the span, by statics', () => {
    const load = { dists: [dist(6, 14, 2, 2)] };
    near(alone(load, 18, 12).left, 16 - 160 / 24);
    near(alone(load, 18, 12).right, 160 / 24);
    near(alone(load, 18, 12).M, (160 / 24) * 6);
    near(alone(load, 10, 12).M, (16 - 160 / 24) * 10 - (2 * 4 ** 2) / 2);
    near(alone(load, 3, 12).M, (16 - 160 / 24) * 3);
    // Entered right to left it is the same load.
    near(alone({ dists: [dist(14, 6, 2, 2)] }, 10, 12).M, alone(load, 10, 12).M);
  });

  // 1 → 3 kip/ft from 0 to 12 ft: a rectangle of 12 kip at 6 ft and a triangle of 12 kip at 8 ft.
  // Right: (72 + 96) ÷ 24 = 7; left: 17.
  it('a trapezoidal load is its rectangle and its triangle', () => {
    const r = alone({ dists: [dist(0, 12, 1, 3)] }, 12, 12);
    near(r.left, 17);
    near(r.right, 7);
    near(r.M, 7 * 12);
  });

  it('an upward load lifts the span off both supports', () => {
    const r = alone({ points: [point(8, 6, 'up')] }, 8, 8);
    near(r.left, -4);
    near(r.right, -2);
    near(r.M, -32);
    expect(r.deflection).toBeGreaterThan(0);
    near(r.deflection, 0.1571, 1e-3);
  });

  it('a load on a support goes straight into it', () => {
    for (const [x, left, right] of [[0, 6, 0], [24, 0, 6]] as const) {
      const r = alone({ points: [point(x, 6)] }, 12, 12);
      near(r.left, left);
      near(r.right, right);
      near(r.M, 0);
      near(r.EIv, 0);
    }
  });
});

describe('single span: load by load', () => {
  const form = defaultSpan();
  const s = analyse(form).solution!;
  const xM = s.extremes.Mmax.x;
  const xD = s.extremes.EIvMin.x;

  // At the section of the largest moment, 9.5 ft:
  //   uniform alone  wx(L − x)/2 = 0.8 × 9.5 × 14.5 ÷ 2 = 55.1 kip·ft
  //   point alone    past the load, its right reaction times what is left of the span: 2 × 14.5 = 29 kip·ft
  // and 55.1 + 29 = 84.1. At the point of the largest deflection, 11.67 ft: 3,452.9 and 1,479.4 kip·ft³
  // (the arithmetic is with the example, above), which over EI = 104,319.4 and × 12 are 0.3972 and 0.1702 in.
  it('the example: 4 and 2 kip from the point load, 9.6 and 9.6 from the uniform one; 29 + 55.1 = 84.1 kip·ft', () => {
    const { rows, sum } = byLoad(form, null, xM, xD)!;
    expect(rows.map((r) => [r.list, r.index])).toEqual([['points', 0], ['dists', 0]]);
    const [p, u] = rows;
    near(p.left, 4);
    near(p.right, 2);
    near(p.M, 29);
    near(p.EIv, -1479.4, 1e-4);
    near(p.deflection, -0.1702, 1e-3);
    near(u.left, 9.6);
    near(u.right, 9.6);
    near(u.M, 55.1);
    near(u.EIv, -3452.9, 1e-4);
    near(u.deflection, -0.3972, 1e-3);
    near(sum.left, 13.6);
    near(sum.right, 11.6);
    near(sum.M, 84.1);
    near(sum.deflection, -0.5674, 1e-4);
  });

  it('the point loads in their order, then the distributed loads, then the beam’s own weight when it is a load', () => {
    const f = span({
      points: [point(4, 1, 'down', 11), point(20, 2, 'up', 12)],
      dists: [dist(0, 24, 0.5, 0.5, 'down', 21), dist(2, 6, 0, 3, 'down', 22), dist(10, 20, 1, 1, 'up', 23)],
      section: section({ mode: 'shape', selfWeight: true }),
    });
    const order = (shape?: SteelShape | null) => byLoad(f, shape, 12, 12)!.rows.map((r) => `${r.list}${r.index}`);
    expect(order(shape('W16X40'))).toEqual(['points0', 'points1', 'dists0', 'dists1', 'dists2', 'own0']);
    // Without the shape there is no weight to count (its table has not arrived, or the name is not in it).
    expect(order(null)).toEqual(['points0', 'points1', 'dists0', 'dists1', 'dists2']);
    // …nor when the box is not ticked.
    expect(byLoad({ ...f, section: section({ mode: 'shape', selfWeight: false }) }, shape('W16X40'), 12, 12)!.rows.map((r) => r.list)).not.toContain('own');
  });

  // A W16×40 weighs 40 lb/ft = 0.04 kip/ft: 0.04 × 24 ÷ 2 = 0.48 kip a side, 0.04 × 576 ÷ 8 = 2.88 kip·ft at midspan.
  it('the beam’s own weight is a uniform load like any other', () => {
    const own = byLoad(span({ section: section({ mode: 'shape', selfWeight: true }) }), shape('W16X40'), 12, 12)!.rows.at(-1)!;
    expect(own.list).toBe('own');
    near(own.left, 0.48);
    near(own.right, 0.48);
    near(own.M, 2.88);
    // In SI the weight is kN/m, and its share comes out in kN: 0.48 kip = 2.135 kN.
    const si = convertUnits(span({ section: section({ mode: 'shape', selfWeight: true }) }), 'si');
    near(byLoad(si, shape('W16X40'), si.L / 2, si.L / 2)!.rows.at(-1)!.left, 0.48 * US_TO_SI.force, 1e-5);
  });

  it('a load that is no load is a row of zeros, not an error', () => {
    const f = span({ points: [point(8, 0), point(8, 6)], dists: [dist(5, 5, 2, 2), dist(0, 24, 0, 0), dist(0, 24, 0.8, 0.8)] });
    const { rows, sum } = byLoad(f, null, xM, xD)!;
    expect(rows).toHaveLength(5);
    for (const i of [0, 2, 3]) for (const key of ['left', 'right', 'M', 'EIv', 'deflection'] as const) expect(Math.abs(rows[i][key]), `row ${i} ${key}`).toBe(0);
    near(sum.left, 13.6);
    near(sum.M, 84.1);
    // No loads at all: no rows, and nothing to add up.
    expect(byLoad(span({ points: [], dists: [] }), null, 12, 12)).toEqual({ rows: [], sum: { left: 0, right: 0, M: 0, EIv: 0, deflection: 0 } });
  });

  it('without E or I the shares are still there, with no deflection among them', () => {
    const { rows } = byLoad(span({ section: section({ I: 0 }) }), null, xM, xD)!;
    near(rows[0].EIv, -1479.4, 1e-4);
    expect(rows.map((r) => r.deflection)).toEqual([0, 0]);
  });

  it('there is nothing to share out of a span that is not solved', () => {
    expect(byLoad({ ...defaultSpan(), L: 0 }, null, 0, 0)).toBeNull();
    // …with no load on it either: no rows is not the same as a span that stands.
    expect(byLoad({ ...defaultSpan(), L: 0, points: [], dists: [] }, null, 0, 0)).toBeNull();
    expect(byLoad({ ...defaultSpan(), L: Number.NaN, points: [], dists: [] }, null, 0, 0)).toBeNull();
    expect(byLoad(span({ points: [point(30, 6)] }), null, 12, 12)).toBeNull();
    expect(byLoad(span({ dists: [dist(0, 24, Number.NaN, 1)] }), null, 12, 12)).toBeNull();
  });

  it('whatever supports a form came with, the loads are shared out on the span', () => {
    const { rows } = byLoad(foreign(), null, 10, 10)!;
    // 8 kip at 12 of 20 ft: 3.2 and 4.8. 1.2 kip/ft over 20 ft: 12 and 12. The applied moment is not a load of this page.
    expect(rows.map((r) => r.list)).toEqual(['points', 'dists']);
    near(rows[0].left, 3.2);
    near(rows[0].right, 4.8);
    near(rows[1].left, 12);
  });

  // The table's last row is the whole beam's own answer. That the rows above
  // it add up to that row is the beam being linear and the engine being right
  // about each load: held here on spans nobody chose.
  it('two hundred random spans: the rows add up to the whole beam', () => {
    const { rnd, pick } = dice(20261010);
    let rows = 0;
    for (let i = 0; i < 200; i++) {
      const drawn = randomSpan(rnd, pick);
      const f = { ...drawn, section: { ...drawn.section, ...pick([{}, { mode: 'shape', selfWeight: true } as const, { I: 0 }]) } };
      const own = f.section.mode === 'shape' ? shape('W16X40') : null;
      const a = analyse(f, own);
      const whole = a.solution!;
      expect(a.issues, encodeBeam(f)).toEqual([]);
      const x = [rnd() * f.L, rnd() * f.L];
      const out = byLoad(f, own, x[0], x[1])!;
      expect(out.rows).toHaveLength(f.points.length + f.dists.length + (own ? 1 : 0));
      rows += out.rows.length;
      // Rounding, against the size of the problem: the loads as forces, times the length for a moment, cubed for EI·v.
      const F = 1e-9 * Math.max(a.loadScale, 1e-300);
      const close = (got: number, want: number, floor: number, what: string) => expect(Math.abs(got - want), `${what}: got ${got}, want ${want} — ${encodeBeam(f)}`).toBeLessThanOrEqual(floor);
      close(out.sum.left, whole.reactions[0].Rv, F, 'left');
      close(out.sum.right, whole.reactions[1].Rv, F, 'right');
      close(out.sum.M, whole.at(x[0]).M, F * f.L, 'moment');
      close(out.sum.EIv, whole.at(x[1]).EIv, F * f.L ** 3, 'EI·v');
      close(out.sum.deflection, whole.at(x[1]).EIv * a.toDeflection, F * f.L ** 3 * a.toDeflection, 'deflection');
      // Each row is its own load's: a span under that load alone has those reactions.
      for (const r of out.rows.filter((row) => row.list !== 'own')) {
        const one = analyse({ ...f, points: r.list === 'points' ? [f.points[r.index]] : [], dists: r.list === 'dists' ? [f.dists[r.index]] : [], section: drawn.section }).solution!;
        close(r.left, one.reactions[0].Rv, F, 'a row’s left');
        close(r.right, one.reactions[1].Rv, F, 'a row’s right');
      }
    }
    // The dice did not come up empty.
    expect(rows).toBeGreaterThan(400);
  });
});

describe('single span: the section a limit asks for', () => {
  const form = defaultSpan();
  const a = analyse(form);

  // US. The largest EI·v is 4,932.35 kip·ft³ on 24 ft. For L/360 the beam needs
  //   E·I = 4,932.35 × 360 ÷ 24 = 73,985.2 kip·ft²  = 73,985.2 × 144 = 10,653,870 kip·in²
  //   I = 10,653,870 ÷ 29,000 = 367.4 in⁴.
  // The same from the deflection the page prints: 518 in⁴ gives L/507.6, so L/360 needs 518 × 360 ÷ 507.6 = 367.4 in⁴.
  it('US: the moment of inertia for L/360 is 367.4 in⁴', () => {
    const I = sizing(a, form, 360, 0).I!;
    near(I, 367.4, 1e-4);
    near((4932.35 * 360 * 144) / (24 * 29000), 367.4, 1e-4);
    near((518 * 360) / a.spans[0].ratio!, I);
    // Twice as strict a limit asks for twice the stiffness.
    near(sizing(a, form, 720, 0).I!, 2 * I);
  });

  // US. The largest moment is 84.1 kip·ft = 1,009.2 kip·in. For 24 ksi: S = 1,009.2 ÷ 24 = 42.05 in³.
  it('US: the section modulus for 24 ksi is 42.05 in³', () => {
    near(sizing(a, form, 360, 24).S!, 42.05);
    near((84.1 * 12) / 24, 42.05);
    // The stress the section entered has under that moment, 84.1 × 12 ÷ 64.7 = 15.6 ksi, asks for the section entered.
    near(sizing(a, form, 360, bendingStress('us', a.section, 84.1)!).S!, 64.7);
  });

  // SI. 10 kN/m on 6 m, E = 200,000 MPa. 5wL⁴/384 = 5 × 10 × 1,296 ÷ 384 = 168.75 kN·m³.
  // For L/250 the deflection is 6,000 ÷ 250 = 24 mm, and in newtons and millimetres
  //   I = 5 × 10 × 6,000⁴ ÷ (384 × 200,000 × 24) = 6.48e16 ÷ 1.8432e9 = 35,156,250 mm⁴ = 35.16 × 10⁶ mm⁴.
  // wL²/8 = 45 kN·m = 45,000,000 N·mm. For 165 MPa: S = 45,000,000 ÷ 165 = 272,727 mm³ = 272.7 × 10³ mm³.
  it('SI: 35.16 × 10⁶ mm⁴ for L/250 and 272.7 × 10³ mm³ for 165 MPa', () => {
    const si = pinEnds({ ...convertUnits(defaultSpan(), 'si'), L: 6, points: [], dists: [dist(0, 6, 10, 10)] });
    expect(si.section.E).toBe(200000);
    const need = sizing(analyse(si), si, 250, 165);
    near(need.I!, 35.15625);
    near((5 * 10 * 6000 ** 4) / (384 * 200000 * 24) / 1e6, 35.15625);
    near(need.S!, 45000 / 165);
    near(45e6 / 165 / 1e3, 272.727, 1e-5);
  });

  // The check that does not go through this file's own formula: put the
  // value in the form, and the page's other cards say L/limit and the stress.
  it('with the section it asks for, the span deflects exactly L over the limit and is stressed exactly as typed', () => {
    const { rnd, pick } = dice(7);
    let asked = 0;
    for (let i = 0; i < 60; i++) {
      const f = randomSpan(rnd, pick);
      const limit = pick([180, 240, 360, 480, 600.5]);
      const stress = pick([24, 21.6, 165, 0.9, 30000]);
      const base = analyse(f);
      const need = sizing(base, f, limit, stress);
      const top = base.solution!.extremes;
      // A span that nothing bends (no load, or every load on a support) needs
      // no section: none for the stress, and for the limit what rounding
      // leaves of a deflection, which the page settles before it prints.
      if (Math.max(Math.abs(top.Mmax.value), Math.abs(top.Mmin.value)) === 0) {
        expect(need.S, encodeBeam(f)).toBe(0);
        expect(Math.abs(need.I!), encodeBeam(f)).toBeLessThan(1e-6);
        continue;
      }
      asked += 1;
      const sized = analyse({ ...f, section: section({ E: f.section.E, I: need.I!, S: need.S! }) });
      near(sized.spans[0].ratio!, limit, 1e-9);
      const s = sized.solution!.extremes;
      near(bendingStress(f.units, sized.section, Math.max(Math.abs(s.Mmax.value), Math.abs(s.Mmin.value)))!, stress, 1e-9);
    }
    expect(asked).toBeGreaterThan(30);
  });

  it('is given with no I and no S entered: it needs the modulus E and the loads, nothing else', () => {
    const bare = span({ section: section({ I: 0, S: 0, Av: 0 }) });
    const need = sizing(analyse(bare), bare, 360, 24);
    near(need.I!, 367.4, 1e-4);
    near(need.S!, 42.05);
    // A rectangle brings E from its own field, a steel shape steel's — whether or not its table has arrived.
    const rect = span({ section: section({ mode: 'rect', material: 'wood', E: 1600 }) });
    near(sizing(analyse(rect), rect, 360, 0).I!, (367.4 * 29000) / 1600, 1e-4);
    const rolled = span({ section: section({ mode: 'shape' }) });
    near(sizing(analyse(rolled), rolled, 360, 0).I!, 367.4, 1e-4);
    near(sizing(analyse(rolled, shape('W16X40')), rolled, 360, 0).I!, 367.4, 1e-4);
  });

  it('is not given without what it is worked out from', () => {
    const noE = span({ section: section({ material: 'custom', E: 0 }) });
    expect(sizing(analyse(noE), noE, 360, 24).I).toBeNull();
    near(sizing(analyse(noE), noE, 360, 24).S!, 42.05);
    for (const limit of [0, -360, Number.NaN, Infinity]) expect(sizing(a, form, limit, 24).I, String(limit)).toBeNull();
    // No stress typed is zero, as an optional value of the section is: no section modulus is asked for.
    for (const stress of [0, -24, Number.NaN, Infinity]) expect(sizing(a, form, 360, stress).S, String(stress)).toBeNull();
    near(sizing(a, form, 0, 24).S!, 42.05);
    // A span that is not solved asks for nothing.
    const none = { ...defaultSpan(), L: 0 };
    expect(sizing(analyse(none), none, 360, 24)).toEqual({ I: null, S: null });
  });

  // The same beam in metres: the same section, in its own units. (With a
  // modulus of the visitor's own — steel's listed one is 29,000 ksi in one
  // system and 200,000 MPa in the other, which are not the same number.)
  it('the same span in the other system asks for the same section', () => {
    const us = span({ section: section({ material: 'custom', E: 29000 }) });
    const si = convertUnits(us, 'si');
    const inUs = sizing(analyse(us), us, 360, 24);
    const inSi = sizing(analyse(si), si, 360, convertStress(24, 'us', 'si'));
    near(inSi.I!, inUs.I! * US_TO_SI.I, 1e-5);
    near(inSi.S!, inUs.S! * US_TO_SI.S, 1e-5);
    // 367.4 in⁴ × 25.4⁴ ÷ 10⁶ = 152.9 × 10⁶ mm⁴; 42.05 in³ × 25.4³ ÷ 10³ = 689.1 × 10³ mm³.
    near(inSi.I!, 152.9, 1e-3);
    near(inSi.S!, 689.1, 1e-3);
  });
});

describe('single span: the stress limit goes with the units', () => {
  // 1 ksi = 4,448.2216 N ÷ 645.16 mm² = 6.894757 MPa. 24 ksi = 165.474 MPa.
  it('24 ksi is 165.474 MPa, and comes back as 24', () => {
    expect(convertStress(24, 'us', 'si')).toBe(165.474);
    expect(convertStress(165.474, 'si', 'us')).toBe(24);
    near(24 * US_TO_SI.E, 165.474, 1e-5);
    for (const ksi of [21.6, 0.6, 36, 50, 33.25]) expect(convertStress(convertStress(ksi, 'us', 'si'), 'si', 'us'), String(ksi)).toBe(ksi);
    // A converted value keeps six figures at most, as every converted value of the form does: eight typed come back as six.
    near(convertStress(convertStress(1.2345678, 'us', 'si'), 'si', 'us'), 1.2345678, 2e-5);
    for (const mpa of [165, 250, 0.4, 345]) expect(convertStress(convertStress(mpa, 'si', 'us'), 'us', 'si'), String(mpa)).toBe(mpa);
  });

  it('none stays none, and nothing changes within one system', () => {
    expect(convertStress(0, 'us', 'si')).toBe(0);
    expect(convertStress(0, 'si', 'us')).toBe(0);
    expect(convertStress(24, 'us', 'us')).toBe(24);
    expect(convertStress(165, 'si', 'si')).toBe(165);
    // Not steel's listed modulus put in its place: a stress is nobody's material.
    expect(convertStress(29000, 'us', 'si')).not.toBe(MATERIALS.steel.si);
  });
});

describe('single span: its case in an address', () => {
  const beamOf = (link: string) => link.split('~')[2];

  it('the key is s, and the limit the page opens with is L/360', () => {
    expect(SPAN_KEY).toBe('s');
    expect(DEFAULT_LIMIT).toBe(360);
  });

  // People keep the links they are sent: this string may not drift.
  it('the limit, the stress or nothing, then the beam as the first calculator writes it', () => {
    expect(encodeSpan(defaultSpan(), 360, 0)).toBe('360~~1j4z;us;24;p0_r24;;8,6;0,24,0.8,0.8;;p,s,29000,518,64.7,4.88');
    expect(encodeSpan(defaultSpan(), 240, 21.6)).toBe('240~21.6~1j4z;us;24;p0_r24;;8,6;0,24,0.8,0.8;;p,s,29000,518,64.7,4.88');
    expect(beamOf(encodeSpan(defaultSpan(), 360, 0))).toBe(encodeBeam(defaultSpan()));
  });

  it('the example read back from its own address is the example, id for id', () => {
    expect(decodeSpan(encodeSpan(defaultSpan(), 360, 0))).toEqual({ form: defaultSpan(), limit: 360, stress: 0 });
    expect(decodeSpan(encodeSpan(defaultSpan(), 480, 24))).toEqual({ form: defaultSpan(), limit: 480, stress: 24 });
  });

  it('opens the same case, and writes the same address again', () => {
    const { rnd, pick } = dice(99);
    for (let i = 0; i < 200; i++) {
      const drawn = randomSpan(rnd, pick);
      const form = { ...drawn, section: { ...drawn.section, ...pick([{}, { mode: 'rect', b: 10, h: 20 } as const, { mode: 'shape', shape: 'HSS6X4X3/8', selfWeight: true } as const, { material: 'custom', E: 12345.5 } as const]) } };
      const limit = Number(fieldNumber(pick([360, 240, 0, -5, 0.5, 1e21, rnd() * 1000])));
      const stress = Number(fieldNumber(pick([0, 24, 165.474, -3, 1e-7, rnd() * 50])));
      const link = encodeSpan(form, limit, stress);
      const back = decodeSpan(link)!;
      expect(back, link).not.toBeNull();
      expect([back.limit, back.stress], link).toEqual([limit, stress]);
      expect(encodeSpan(back.form, back.limit, back.stress), link).toBe(link);
      expect(encodeBeam(back.form)).toBe(encodeBeam(form));
      expect(supportsOf(back.form)).toEqual([['pin', 0], ['roller', form.L]]);
    }
  });

  // Whatever the two fields hold is written, as for a beam: a reload comes
  // back to what was on screen, with its mark, and not to L/360.
  it('whatever the limits hold is written and read back, a number that is none included', () => {
    // What is held, what is written of it, and what comes back: the eight figures a field shows.
    for (const [limit, stress, head, back] of [
      [0, 0, '0~~', [0, 0]],
      [-240, -1.5, '-240~-1.5~', [-240, -1.5]],
      [1e21, 1e-7, '1e21~1e-7~', [1e21, 1e-7]],
      [123456789012, 0.1 + 0.2, '123456790000~0.3~', [123456790000, 0.3]],
      [Infinity, -Infinity, 'inf~-inf~', [Infinity, -Infinity]],
      [Number.NaN, Number.NaN, 'nan~nan~', [Number.NaN, Number.NaN]],
    ] as const) {
      const link = encodeSpan(defaultSpan(), limit, stress);
      expect(link.startsWith(head), link).toBe(true);
      const read = decodeSpan(link)!;
      expect([read.limit, read.stress], link).toEqual(back);
      expect(encodeSpan(read.form, read.limit, read.stress)).toBe(link);
    }
    // A zero written with a minus is a plain zero.
    expect(Object.is(decodeSpan(`-0~-0~${encodeBeam(defaultSpan())}`)!.limit, 0)).toBe(true);
    // A stress of 0 written out is no stress, the same case as nothing there.
    expect(decodeSpan(`360~0~${encodeBeam(defaultSpan())}`)).toEqual(decodeSpan(`360~~${encodeBeam(defaultSpan())}`));
  });

  // The two limits come first because the beam's own check counts what is
  // BEHIND it. At the end they would be what a link cut short loses: it
  // would open, on another stress, without a word.
  it('cut short anywhere, it is not a link to another case', () => {
    const si = convertUnits(defaultSpan(), 'si');
    const cases: [string, BeamForm, number, number][] = [
      ['the example', defaultSpan(), 360, 0],
      ['with a stress', defaultSpan(), 240, 21.6],
      ['in SI', si, 250, 165.474],
      ['a rectangle', span({ section: section({ mode: 'rect' }) }), 360, 24],
      ['a steel shape with its own weight', span({ section: section({ mode: 'shape', selfWeight: true }) }), 600, 0],
      ['twelve loads', span({ points: Array.from({ length: 12 }, (_, i) => point(i * 2, 1.5 + i, i % 2 ? 'up' : 'down', 30 + i)) }), 360, 30],
    ];
    for (const [name, form, limit, stress] of cases) {
      const link = encodeSpan(form, limit, stress);
      expect(decodeSpan(link), name).not.toBeNull();
      for (let length = 0; length < link.length; length++) expect(decodeSpan(link.slice(0, length)), `${name}: ${link.slice(0, length)}`).toBeNull();
      // Nor with something after it.
      for (const more of ['0', ';', '~', '~1', ' ']) expect(decodeSpan(link + more), `${name} + "${more}"`).toBeNull();
    }
  });

  it('refuses anything that is not two limits and a beam', () => {
    const beam = encodeBeam(defaultSpan());
    for (const bad of [
      '',
      '360',
      '360~',
      '360~~',
      beam,
      `~~${beam}`,
      `~24~${beam}`,
      `abc~~${beam}`,
      `360~x~${beam}`,
      `360~24~7~${beam}`,
      `360 ~~${beam}`,
      `+360~~${beam}`,
      `3,60~~${beam}`,
      `1e999~~${beam}`,
      `360~1e999~${beam}`,
      `0x10~~${beam}`,
      `360~~${beam.slice(1)}`,
      `360~~${beam.replace(';24;', ';25;')}`,
      '360~~us;24;p0_r24;;8,6;;;p,s,29000,518,64.7',
      `360;;${beam}`,
    ]) {
      expect(decodeSpan(bad), bad).toBeNull();
    }
    expect(adoptBeam('')).toBeNull();
    expect(adoptBeam(beam.slice(0, -1))).toBeNull();
    expect(adoptBeam(`360~~${beam}`)).toBeNull();
  });

  // What stands between the fields is in no beam's own string: a beam is
  // numbers, a few letters and ; , _ — and a shape's name, which the first
  // calculator reads only when it is letters, digits and . / -.
  it('no beam is written with a tilde in it', () => {
    const { rnd, pick } = dice(3);
    for (let i = 0; i < 100; i++) expect(encodeBeam(randomSpan(rnd, pick))).not.toContain('~');
    for (const s of shapes) expect(s.designation).not.toContain('~');
    expect(encodeBeam(span({ section: section({ mode: 'shape', shape: 'W~16' }) }))).not.toContain('~');
    expect(decodeSpan(`360~~${encodeBeam(defaultSpan()).replace('p,s,', 's~,')}`)).toBeNull();
  });

  // The first calculator's beams have walls, hinges and moments this page has
  // no field for. Brought here — in this page's link, or as that calculator's
  // own — they open as the span under their loads, not as "cannot be read".
  it('a beam of the first calculator opens as the pinned span with its loads', () => {
    const f = foreign();
    for (const [how, opened] of [
      ['in a link of this page', decodeSpan(`480~24~${encodeBeam(f)}`)],
      ['as that calculator’s own link', adoptBeam(encodeBeam(f))],
    ] as const) {
      expect(opened, how).not.toBeNull();
      expect(supportsOf(opened!.form), how).toEqual([['pin', 0], ['roller', 20]]);
      expect([opened!.form.hinges, opened!.form.couples], how).toEqual([[], []]);
      expect(opened!.form.points.map((p) => [p.x, p.P, p.dir]), how).toEqual([[12, 8, 'down']]);
      expect(opened!.form.dists.map((d) => [d.x1, d.x2, d.w1, d.w2]), how).toEqual([[0, 20, 1.2, 1.2]]);
      expect(analyse(opened!.form).issues, how).toEqual([]);
      // 8 kip at 12 of 20 ft and 1.2 kip/ft: the example of the first calculator, 15.2 and 16.8 kip.
      near(analyse(opened!.form).solution!.reactions[0].Rv, 15.2);
      near(analyse(opened!.form).solution!.reactions[1].Rv, 16.8);
    }
    expect([decodeSpan(`480~24~${encodeBeam(f)}`)!.limit, decodeSpan(`480~24~${encodeBeam(f)}`)!.stress]).toEqual([480, 24]);
    // Brought over by its own address it has no limits of its own: the page's.
    expect([adoptBeam(encodeBeam(f))!.limit, adoptBeam(encodeBeam(f))!.stress]).toEqual([DEFAULT_LIMIT, 0]);
    // A link from before the first calculator's links had a check opens too, as it does there.
    const old = adoptBeam('us;30;f0;10;15,5;;20,50;p,s,29000,800,88.9,6.39')!;
    expect(supportsOf(old.form)).toEqual([['pin', 0], ['roller', 30]]);
    near(analyse(old.form).solution!.reactions[0].Rv, 2.5);
    // And once open it is this page's case: its address is written under this page's key, pinned.
    expect(beamOf(encodeSpan(old.form, old.limit, old.stress))).toContain(';us;30;p0_r30;;15,5;;;');
  });

  // …but not in silence. An applied moment is a load, and a wall carries what
  // a pin does not: the span shown is not the beam the link was made for. The
  // case says so (`lost`), for the page to say so. The first calculator's
  // example with 40 kip·ft at its left end is 17.2 and 14.8 kip there
  // (Rr × 20 − 8 × 12 − 24 × 10 + 40 = 0), and 15.2 and 16.8 here.
  it('and the case says when the link held what this span has not', () => {
    const plain = defaultBeam();
    const held = (over: Partial<BeamForm>) => encodeBeam({ ...plain, ...over });
    const more: [string, string][] = [
      ['an applied moment', held({ couples: [{ id: 9, x: 0, M: 40, dir: 'ccw' }] })],
      ['a hinge', held({ hinges: [{ id: 9, x: 6 }] })],
      ['a wall for a support', held({ supports: [{ id: 1, kind: 'fixed', x: 0 }, { id: 2, kind: 'roller', x: 20 }] })],
      ['one wall alone', held({ supports: [{ id: 1, kind: 'fixed', x: 0 }] })],
      ['a third support', held({ supports: [{ id: 1, kind: 'pin', x: 0 }, { id: 2, kind: 'roller', x: 10 }, { id: 3, kind: 'roller', x: 20 }] })],
      ['an overhang', held({ supports: [{ id: 1, kind: 'pin', x: 0 }, { id: 2, kind: 'roller', x: 15 }] })],
      ['everything at once', encodeBeam(foreign())],
    ];
    for (const [what, beam] of more) {
      expect(beyondSpan(decodeBeam(beam)!), what).toBe(true);
      expect(adoptBeam(beam)!.lost, what).toBe(true);
      expect(decodeSpan(`480~24~${beam}`)!.lost, what).toBe(true);
    }
    // The same loads on a pin and a roller at the two ends are this page's span: nothing was left out, and nothing is said.
    const same: [string, string][] = [
      ['the first calculator’s example', encodeBeam(plain)],
      ['the roller on the left', held({ supports: [{ id: 1, kind: 'roller', x: 0 }, { id: 2, kind: 'pin', x: 20 }] })],
      ['a moment of size zero', held({ couples: [{ id: 9, x: 10, M: 0, dir: 'cw' }] })],
      ['this page’s own beam', encodeBeam(defaultSpan())],
    ];
    for (const [what, beam] of same) {
      expect(beyondSpan(decodeBeam(beam)!), what).toBe(false);
      expect('lost' in adoptBeam(beam)!, what).toBe(false);
      expect('lost' in decodeSpan(`480~24~${beam}`)!, what).toBe(false);
    }
  });

  // A link gives the section in use and nothing of the other two kinds. What
  // it leaves out is this page's example, in the link's own units — not the
  // first calculator's W18×50 under a span that opened on a W16×40.
  it('what a link does not carry starts from this page’s example', () => {
    const typed = decodeSpan(encodeSpan(span({ points: [point(10, 3)] }), 360, 0))!.form.section;
    expect([typed.shape, typed.b, typed.h, typed.selfWeight]).toEqual(['W16X40', 12, 24, false]);
    const rect = decodeSpan(encodeSpan(span({ section: section({ mode: 'rect', b: 8, h: 16 }) }), 360, 0))!.form.section;
    expect([rect.mode, rect.b, rect.h, rect.I, rect.S, rect.Av, rect.shape]).toEqual(['rect', 8, 16, 518, 64.7, 4.88, 'W16X40']);
    const rolled = decodeSpan(encodeSpan(span({ section: section({ mode: 'shape', shape: 'W24X76', selfWeight: true }) }), 360, 0))!.form.section;
    expect([rolled.mode, rolled.shape, rolled.selfWeight, rolled.I, rolled.S, rolled.E]).toEqual(['shape', 'W24X76', true, 518, 64.7, 29000]);
    // In SI: the example's own properties in millimetres, never inches under a millimetre label.
    const si = convertUnits(defaultSpan(), 'si');
    const inSi = decodeSpan(encodeSpan({ ...si, section: { ...si.section, mode: 'rect' } }, 360, 0))!.form.section;
    expect([inSi.I, inSi.S, inSi.Av, inSi.shape]).toEqual([si.section.I, si.section.S, si.section.Av, 'W16X40']);
    expect(inSi.I).toBeCloseTo(518 * US_TO_SI.I, 2);
  });
});
