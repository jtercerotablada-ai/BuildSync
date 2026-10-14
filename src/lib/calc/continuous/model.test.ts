import { readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { fieldNumber } from '../format';
import {
  MATERIALS,
  MAX_ROWS,
  US_TO_SI,
  analyse,
  bendingStress,
  convertUnits,
  decodeBeam,
  defaultBeam,
  deflectionFactor,
  encodeBeam,
  reduceBeam,
  sectionProps,
  stiffness,
  type BeamForm,
  type SteelShape,
} from '../beam/model';
import { DEFAULT_LIMIT, SPAN_KEY, defaultSpan, encodeSpan } from '../beam/span';
import {
  CONTINUOUS_KEY,
  MAX_SPANS,
  convertContinuous,
  decodeContinuous,
  defaultContinuous,
  encodeContinuous,
  formIssues,
  generalCode,
  issueOnRow,
  jointPositions,
  oneSection,
  reduceContinuous,
  settles,
  toBeamForm,
  toEngine,
  type ContinuousAction,
  type ContinuousForm,
  type DistRow,
  type PointRow,
  type Section,
  type SpanRow,
} from './model';
import type { ContinuousIssue, EndKind } from './types';

/**
 * BETWEEN THE THIRD CALCULATOR'S FORM AND ITS ENGINE: the edits, the units,
 * what the engine is given, the same beam for the first calculator, and the
 * address.
 *
 * The engine has its own tests. What can go wrong here is what stands before
 * it: a load that ends up on another span when one is removed, a settlement
 * that is not its support's any more, a settlement in inches taken for feet,
 * a dead load sent as live, a position along the beam that is not the span's
 * start plus the place typed, a link that opens another beam.
 *
 * Where a beam is solved it is by the FIRST calculator's engine, on the beam
 * `toBeamForm` makes of the form, and against closed forms worked here in
 * plain arithmetic: nothing below asks this model what it should say.
 */

const shapes: SteelShape[] = JSON.parse(readFileSync(join(resolve(__dirname, '..', '..'), 'steel', 'aisc-shapes.json'), 'utf8')).shapes;
const shape = (name: string) => shapes.find((s) => s.designation === name)!;
const near = (got: number, want: number, tol = 1e-9) => expect(Math.abs(got - want), `got ${got}, want ${want}`).toBeLessThanOrEqual(tol * Math.max(1, Math.abs(want)));

/** The example with something else in it. */
const beam = (over: Partial<ContinuousForm>): ContinuousForm => ({ ...defaultContinuous(), ...over });
const section = (over: Partial<Section>): Section => ({ ...defaultContinuous().section, ...over });
const span = (id: number, L: number, k = 1, dead = 0, live = 0): SpanRow => ({ id, L, k, dead, live });
const point = (id: number, on: number, a: number, P: number, dir: 'down' | 'up' = 'down', live = false): PointRow => ({ id, span: on, a, P, dir, live });
const dist = (id: number, on: number, a1: number, a2: number, w1: number, w2: number, dir: 'down' | 'up' = 'down', live = false): DistRow => ({ id, span: on, a1, a2, w1, w2, dir, live });
const zeros = (n: number) => Array.from({ length: n }, () => 0);

/**
 * A beam with one of everything, in numbers that can be followed by hand:
 * spans of 20, 30 and 10 ft, built in at the left and free at the right (the
 * last span is an overhang), each span of another stiffness.
 */
const worked = (): ContinuousForm => ({
  units: 'us',
  spans: [span(11, 20, 1, 0.5, 0), span(12, 30, 2, 0, 1.5), span(13, 10, 0.5, 0.8, 1)],
  left: 'fixed',
  right: 'free',
  settlements: [0, 0.6, 0, 0.3],
  points: [point(21, 1, 12, 9, 'down', true), point(22, 2, 10, 4, 'up')],
  dists: [dist(31, 0, 5, 15, 1, 2, 'up'), dist(32, 1, 0, 30, 0.4, 0, 'down', true)],
  everyArrangement: true,
  section: section({ E: 29000, I: 1000 }),
  nextId: 40,
});

/** What a link carries of a form: each row by what it says (a link numbers the rows again), and the section in use. */
const carried = (f: ContinuousForm) => ({
  units: f.units,
  left: f.left,
  right: f.right,
  everyArrangement: f.everyArrangement,
  spans: f.spans.map((s) => [s.L, s.k, s.dead, s.live]),
  settlements: f.settlements,
  points: f.points.map((p) => [p.span, p.a, p.P, p.dir, p.live]),
  dists: f.dists.map((d) => [d.span, d.a1, d.a2, d.w1, d.w2, d.dir, d.live]),
  section:
    f.section.mode === 'shape'
      ? ['shape', f.section.shape, f.section.selfWeight]
      : f.section.mode === 'rect'
        ? ['rect', f.section.material, f.section.E, f.section.b, f.section.h]
        : ['props', f.section.material, f.section.E, f.section.I, f.section.S, f.section.Av],
});
/** A number as an address carries it: to the eight figures its field shows. */
const r8 = (v: number) => Number(fieldNumber(v));
/**
 * What the first calculator's link carries of ITS form, each position to the
 * eight figures a link writes: along the whole beam a place is a sum of span
 * lengths, and 7.3152 + 9.144 is 16.459200000000003.
 */
const carriedBeam = (f: BeamForm) => ({
  units: f.units,
  L: r8(f.L),
  supports: f.supports.map((s) => [s.kind, r8(s.x)]),
  hinges: f.hinges.map((h) => r8(h.x)),
  points: f.points.map((p) => [r8(p.x), p.P, p.dir]),
  dists: f.dists.map((d) => [r8(d.x1), r8(d.x2), d.w1, d.w2, d.dir]),
  couples: f.couples.map((c) => [r8(c.x), c.M, c.dir]),
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
/** These seven fields as the page would write them: behind their check. */
const sealed = (body: string) => `${checkOf(body)};${body}`;
/* The check of the links written before 14 October 2026, from ITS
   description: the length of the rest and a sum of its characters, in base
   36. Kept here to write such links, which must still open. */
const oldCheckOf = (body: string) => {
  let sum = 0;
  for (const ch of body) sum = (sum * 31 + ch.charCodeAt(0)) % 1296;
  return (body.length * 1296 + sum).toString(36);
};
/** These seven fields as the page wrote them before 14 October 2026. */
const oldSealed = (body: string) => `${oldCheckOf(body)};${body}`;
/** The seven fields of a link, without its check. */
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

/** A beam not chosen: any ends, one to eight spans, loads on any of them, settlements, any number a field can show, each kind of section, both systems. */
function randomContinuous(rnd: () => number, pick: <T>(list: readonly T[]) => T): ContinuousForm {
  // Any number, as a field holds it once it has been shown: to eight figures.
  const any = () => Number(fieldNumber(pick([0, 20, 12.5, -3, 1e21, 1e-7, 2e12, 123456789012, 5e-324, (rnd() - 0.3) * 100, (rnd() - 0.5) * 10 ** Math.round((rnd() - 0.5) * 600)])));
  const size = () => Math.abs(any());
  const units = pick(['us', 'si'] as const);
  const material = pick(['steel', 'aluminum', 'concrete', 'wood', 'custom'] as const);
  let id = 1;
  const spans = Array.from({ length: 1 + Math.floor(rnd() * MAX_SPANS) }, () => span(id++, any(), pick([1, 1, any()]), pick([0, any()]), pick([0, any()])));
  const on = () => Math.floor(rnd() * spans.length);
  const some = <T>(row: () => T): T[] => Array.from({ length: pick([0, 0, 1, 2, 3, MAX_ROWS]) }, row);
  return {
    units,
    spans,
    left: pick(['pin', 'fixed', 'free'] as const),
    right: pick(['pin', 'fixed', 'free'] as const),
    settlements: rnd() < 0.5 ? zeros(spans.length + 1) : Array.from({ length: spans.length + 1 }, () => pick([0, any()])),
    points: some(() => point(id++, on(), any(), size(), pick(['down', 'up'] as const), rnd() < 0.5)),
    dists: some(() => dist(id++, on(), any(), any(), size(), size(), pick(['down', 'up'] as const), rnd() < 0.5)),
    everyArrangement: rnd() < 0.5,
    section: {
      ...defaultContinuous().section,
      mode: pick(['props', 'rect', 'shape'] as const),
      material,
      E: material === 'custom' ? size() : MATERIALS[material][units],
      I: size(),
      S: size(),
      Av: size(),
      b: size(),
      h: size(),
      shape: pick(['W21X44', 'HSS6X4X3/8', 'Pipe5XS']),
      selfWeight: rnd() < 0.5,
    },
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
const idsOf = (f: ContinuousForm) => [...f.spans, ...f.points, ...f.dists].map((r) => r.id);
/** Each load with the id of the span it is on: the span itself, not its place among the spans. */
const spanOfLoads = (f: ContinuousForm) => new Map([...f.points.map((p) => [`p${p.id}`, f.spans[p.span]?.id] as const), ...f.dists.map((d) => [`d${d.id}`, f.spans[d.span]?.id] as const)]);

/** What every edit must leave true of a form. */
function expectSound(f: ContinuousForm, why: string) {
  expect(f.spans.length, why).toBeGreaterThanOrEqual(1);
  expect(f.spans.length, why).toBeLessThanOrEqual(MAX_SPANS);
  // One settlement per joint.
  expect(f.settlements, why).toHaveLength(f.spans.length + 1);
  expect(f.points.length, why).toBeLessThanOrEqual(MAX_ROWS);
  expect(f.dists.length, why).toBeLessThanOrEqual(MAX_ROWS);
  // Every load is on a span of the beam.
  for (const r of [...f.points, ...f.dists]) {
    expect(Number.isInteger(r.span) && r.span >= 0 && r.span < f.spans.length, `${why}: a load on span ${r.span} of ${f.spans.length}`).toBe(true);
  }
  const ids = idsOf(f);
  expect(new Set(ids).size, why).toBe(ids.length);
  expect(f.nextId, why).toBeGreaterThan(Math.max(...ids));
}

describe('continuous form: the beam the page opens with', () => {
  const d = defaultContinuous();

  it('is three spans on simple supports, a dead and a live load on each, the live load in every arrangement', () => {
    expect(d.units).toBe('us');
    expect(d.spans.map((s) => [s.L, s.k, s.dead, s.live])).toEqual([[24, 1, 0.9, 1.2], [30, 1, 0.9, 1.2], [24, 1, 0.9, 1.2]]);
    expect([d.left, d.right]).toEqual(['pin', 'pin']);
    expect(d.settlements).toEqual([0, 0, 0, 0]);
    expect([d.points, d.dists]).toEqual([[], []]);
    expect(d.everyArrangement).toBe(true);
    expectSound(d, 'the example');
    // Each call is a form of its own: an edit of one is not an edit of the next.
    expect(defaultContinuous()).not.toBe(defaultContinuous());
    expect(defaultContinuous().spans).not.toBe(defaultContinuous().spans);
  });

  it('its section is a W21×44’s, typed in — not the shape of either other calculator', () => {
    const w = shape('W21X44');
    expect(d.section).toMatchObject({ mode: 'props', material: 'steel', E: 29000, I: w.Ix, S: w.Sx, shape: 'W21X44', selfWeight: false });
    // The shear area is the web's, d·tw, to the four figures a result is printed with: "Steel shape" gives the same stress.
    expect(d.section.Av).toBe(Number((w.d * w.tw).toPrecision(4)));
    expect(d.section.Av).toBe(7.245);
    expect(defaultBeam().section.shape).not.toBe(d.section.shape);
    expect(defaultSpan().section.shape).not.toBe(d.section.shape);
    // The first calculator's own function takes this form as it is.
    const p = sectionProps(d);
    expect([p.E, p.I, p.S, p.Av, p.shearRule]).toEqual([29000, 843, 81.6, 7.245, 'area']);
    near(stiffness(d.units, p), (29000 * 843) / 144);
    const rolled = sectionProps(beam({ section: section({ mode: 'shape' }) }), w);
    expect([rolled.E, rolled.I, rolled.S]).toEqual([29000, 843, 81.6]);
    near(rolled.Av, 7.245);
  });

  // The three-moment equation for three spans L1, L2, L1 under one load w on
  // all of them, the two ends free to turn: by symmetry both support moments
  // are M, and  M·(2·L1 + 3·L2) = −w·(L1³ + L2³) / 4.
  it('under all its loads it is the beam of the three-moment equation', () => {
    const a = analyse(toBeamForm(d));
    const s = a.solution!;
    const M = (-2.1 * (24 ** 3 + 30 ** 3)) / (4 * (2 * 24 + 3 * 30));
    near(M, -155.3087, 1e-6);
    near(s.at(24).M, M);
    near(s.at(54).M, M);
    // …and the end reaction is what is left of the end span: w·L1/2 + M/L1.
    near(s.reactions[0].Rv, (2.1 * 24) / 2 + M / 24);
    near(s.totalLoad, 2.1 * 78);
  });

  // With the live load on the first two spans and off the third, the two
  // support moments are no longer equal:
  //     2·MB·(24 + 30) + MC·30 = −2.1·(24³ + 30³) / 4
  //     MB·30 + 2·MC·(30 + 24) = −(2.1·30³ + 0.9·24³) / 4
  it('with the live load off the third span: the largest moment over a support, by hand', () => {
    const [p, q] = [-(2.1 * (24 ** 3 + 30 ** 3)) / 4, -(2.1 * 30 ** 3 + 0.9 * 24 ** 3) / 4];
    const MB = (p * 108 - q * 30) / (108 * 108 - 30 * 30);
    near(MB, -166.867, 1e-5);
    const arranged = beam({ spans: d.spans.map((s, i) => (i === 2 ? { ...s, live: 0 } : s)) });
    near(analyse(toBeamForm(arranged)).solution!.at(24).M, MB);
  });

  // What the page will open on, worked out by the first calculator's engine:
  // one beam per arrangement of the live load, eight of them. It reads like
  // a floor beam — and that is all it is asked to: no limit is applied.
  it('reads like a floor beam: some tens of ksi, a deflection of about two hundredths of an inch per foot of span', () => {
    let hog = 0;
    let sag = 0;
    let shear = 0;
    const deflection = [0, 0, 0];
    for (let on = 0; on < 8; on++) {
      const a = analyse(toBeamForm(beam({ spans: d.spans.map((s, i) => (on & (1 << i) ? s : { ...s, live: 0 })) })));
      const e = a.solution!.extremes;
      hog = Math.min(hog, e.Mmin.value);
      sag = Math.max(sag, e.Mmax.value);
      shear = Math.max(shear, e.Vmax.value, -e.Vmin.value);
      a.spans.forEach((p, i) => (deflection[i] = Math.min(deflection[i], p.deflection)));
    }
    near(hog, -166.867, 1e-5);
    near(sag, 111.0, 1e-3);
    near(shear, 33.27, 1e-3);
    // 166.9 kip·ft on S = 81.6 in³.
    near(bendingStress('us', sectionProps(d), hog)!, (-166.867 * 12) / 81.6, 1e-5);
    near((166.867 * 12) / 81.6, 24.54, 1e-3);
    // The middle span with the live load on it alone, the end spans with it on both of them.
    near(deflection[1], -0.5695, 1e-3);
    near(deflection[0], -0.3986, 1e-3);
    near(deflection[2], deflection[0]);
    near((30 * 12) / 0.5695, 632, 2e-3);
    near((24 * 12) / 0.3986, 723, 2e-3);
  });

  it('is its own address read back, id for id', () => {
    expect(decodeContinuous(encodeContinuous(d))).toEqual(d);
    const si = convertContinuous(d, 'si');
    expect(decodeContinuous(encodeContinuous(si))).toEqual(si);
  });
});

describe('continuous form: the units', () => {
  it('switching units converts every quantity, each as its own', () => {
    const si = convertContinuous(worked(), 'si');
    expect(si.units).toBe('si');
    // Feet to metres, kip/ft to kN/m, kips to kilonewtons — and a settlement from inches to millimetres.
    expect(si.spans.map((s) => s.L)).toEqual([6.096, 9.144, 3.048]);
    near(si.spans[0].dead, 0.5 * 14.5939029372, 1e-5);
    near(si.spans[1].live, 1.5 * 14.5939029372, 1e-5);
    near(si.spans[2].dead, 0.8 * 14.5939029372, 1e-5);
    near(si.spans[2].live, 14.5939029372, 1e-5);
    expect(si.settlements).toEqual([0, 15.24, 0, 7.62]);
    near(si.points[0].a, 12 * 0.3048, 1e-5);
    near(si.points[0].P, 9 * 4.4482216152605, 1e-5);
    near(si.points[1].a, 10 * 0.3048, 1e-5);
    near(si.points[1].P, 4 * 4.4482216152605, 1e-5);
    expect([si.dists[0].a1, si.dists[0].a2]).toEqual([1.524, 4.572]);
    near(si.dists[0].w1, 14.5939029372, 1e-5);
    near(si.dists[0].w2, 2 * 14.5939029372, 1e-5);
    near(si.dists[1].w1, 0.4 * 14.5939029372, 1e-5);
    expect(si.dists[1].w2).toBe(0);
    // A stiffness factor has no unit, and nothing else of a row changes.
    expect(si.spans.map((s) => [s.id, s.k])).toEqual([[11, 1], [12, 2], [13, 0.5]]);
    expect(si.points.map((p) => [p.id, p.span, p.dir, p.live])).toEqual([[21, 1, 'down', true], [22, 2, 'up', false]]);
    expect(si.dists.map((p) => [p.id, p.span, p.dir, p.live])).toEqual([[31, 0, 'up', false], [32, 1, 'down', true]]);
    expect([si.left, si.right, si.everyArrangement, si.nextId]).toEqual(['fixed', 'free', true, 40]);
  });

  it('the section is converted by the first calculator, as its own is', () => {
    for (const sec of [section({}), section({ material: 'custom', E: 10000 }), section({ mode: 'rect', material: 'wood', E: 1600, b: 3.5, h: 11.25 }), section({ mode: 'shape', selfWeight: true })]) {
      const first = convertUnits({ ...defaultBeam(), section: sec }, 'si').section;
      expect(convertContinuous(beam({ section: sec }), 'si').section).toEqual(first);
    }
    // A listed material keeps its own round number in each system; another modulus is converted.
    expect(convertContinuous(defaultContinuous(), 'si').section.E).toBe(200000);
    near(convertContinuous(beam({ section: section({ material: 'custom', E: 10000 }) }), 'si').section.E, 10000 * 6.894757293, 1e-5);
    near(convertContinuous(defaultContinuous(), 'si').section.I, 843 * 0.416231426, 1e-5);
  });

  // Looking at a beam in the other system and coming back must not change it.
  it('and back again, to the very same numbers', () => {
    const d = defaultContinuous();
    expect(convertContinuous(convertContinuous(d, 'si'), 'us')).toEqual(d);
    expect(convertContinuous(d, 'us')).toBe(d);
    expect(convertContinuous(convertContinuous(worked(), 'si'), 'us')).toEqual(worked());
    const odd: ContinuousForm = {
      ...worked(),
      spans: [span(1, 37.25, 1.75, 0.85, 2.4), span(2, 28.5, 0.6, 0.35, 0), span(3, 6.125, 1, 0, 1.15)],
      settlements: [0.125, 0, 0.75, 0.0625],
      points: [point(4, 0, 33.125, 12.75, 'up', true), point(5, 2, 6.125, 3.5)],
      dists: [dist(6, 1, 2.5, 28.5, 0.85, 2.4, 'down', true)],
      section: section({ I: 1830, S: 154, Av: 9.48, b: 5.125, h: 13.5 }),
    };
    expect(convertContinuous(convertContinuous(odd, 'si'), 'us')).toEqual(odd);
    const metric = convertContinuous(odd, 'si');
    expect(convertContinuous(convertContinuous(metric, 'us'), 'si')).toEqual(metric);
    // A round metric beam, the other way.
    const round: ContinuousForm = { ...metric, spans: [span(1, 7.5, 1, 12, 15), span(2, 9, 1.5, 12, 15)], settlements: [0, 10, 2.5], points: [point(4, 1, 4.5, 50)], dists: [dist(6, 0, 0, 3.75, 15, 7.5)] };
    expect(convertContinuous(convertContinuous(round, 'us'), 'si')).toEqual(round);
  });

  it('switching units is the same edit as convertContinuous', () => {
    expect(reduceContinuous(worked(), { type: 'units', units: 'si' })).toEqual(convertContinuous(worked(), 'si'));
  });
});

describe('continuous form: what each edit does', () => {
  const start = defaultContinuous();
  /** Four spans, each with loads of its own, and every support pushed down by another amount. */
  const four = (): ContinuousForm =>
    beam({
      spans: [span(1, 10, 1, 1, 0), span(2, 20, 2, 0, 2), span(3, 30, 3, 3, 0), span(4, 40, 4, 0, 4)],
      settlements: [0.1, 0.2, 0.3, 0.4, 0.5],
      points: [point(11, 0, 1, 1), point(12, 1, 2, 2), point(13, 2, 3, 3), point(14, 3, 4, 4), point(15, 1, 5, 5)],
      dists: [dist(21, 3, 0, 4, 1, 1), dist(22, 0, 0, 1, 2, 2), dist(23, 2, 0, 3, 3, 3)],
      nextId: 30,
    });

  it('a new span is added after the last: its length and its two loads, the section’s own stiffness, a support that has not settled', () => {
    const f = reduceContinuous(start, { type: 'add', list: 'spans' });
    expect(f.spans).toHaveLength(4);
    expect(f.spans.slice(0, 3)).toEqual(start.spans);
    expect(f.spans[3]).toEqual({ id: 4, L: 24, k: 1, dead: 0.9, live: 1.2 });
    expect(f.settlements).toEqual([0, 0, 0, 0, 0]);
    expect(f.nextId).toBe(5);
    // The last span's own numbers, whatever they are — but not its stiffness factor.
    const odd = beam({ spans: [span(1, 18, 2.5, 0.4, 0.7)], settlements: [0.25, 0.5], nextId: 2 });
    const more = reduceContinuous(odd, { type: 'add', list: 'spans' });
    expect(more.spans[1]).toEqual({ id: 2, L: 18, k: 1, dead: 0.4, live: 0.7 });
    // The supports that were there keep what they had settled by.
    expect(more.settlements).toEqual([0.25, 0.5, 0]);
    // Its point loads and partial loads are not copied: they are rows of their own.
    const loaded = reduceContinuous(four(), { type: 'add', list: 'spans' });
    expect([loaded.points, loaded.dists]).toEqual([four().points, four().dists]);
    // The two ends are still held as they were.
    expect([reduceContinuous(worked(), { type: 'add', list: 'spans' }).left, reduceContinuous(worked(), { type: 'add', list: 'spans' }).right]).toEqual(['fixed', 'free']);
  });

  it('stops at eight spans', () => {
    let f = start;
    for (let i = 0; i < MAX_SPANS + 4; i++) f = reduceContinuous(f, { type: 'add', list: 'spans' });
    expect(f.spans).toHaveLength(MAX_SPANS);
    expect(MAX_SPANS).toBe(8);
    expectSound(f, 'eight spans');
    expect(reduceContinuous(f, { type: 'add', list: 'spans' })).toBe(f);
  });

  // The span goes with its loads and with one joint: the support at its
  // right end, or — for the first span — the one the beam began on.
  it('removing a span removes THAT span, its loads, and one support', () => {
    const f = four();
    const first = reduceContinuous(f, { type: 'remove', list: 'spans', id: 1 });
    expect(first.spans.map((s) => s.id)).toEqual([2, 3, 4]);
    expect(first.settlements).toEqual([0.2, 0.3, 0.4, 0.5]);
    expect(first.points.map((p) => [p.id, p.span])).toEqual([[12, 0], [13, 1], [14, 2], [15, 0]]);
    expect(first.dists.map((p) => [p.id, p.span])).toEqual([[21, 2], [23, 1]]);
    const second = reduceContinuous(f, { type: 'remove', list: 'spans', id: 2 });
    expect(second.spans.map((s) => s.id)).toEqual([1, 3, 4]);
    expect(second.settlements).toEqual([0.1, 0.2, 0.4, 0.5]);
    expect(second.points.map((p) => [p.id, p.span])).toEqual([[11, 0], [13, 1], [14, 2]]);
    expect(second.dists.map((p) => [p.id, p.span])).toEqual([[21, 2], [22, 0], [23, 1]]);
    const third = reduceContinuous(f, { type: 'remove', list: 'spans', id: 3 });
    expect(third.spans.map((s) => s.id)).toEqual([1, 2, 4]);
    expect(third.settlements).toEqual([0.1, 0.2, 0.3, 0.5]);
    expect(third.points.map((p) => [p.id, p.span])).toEqual([[11, 0], [12, 1], [14, 2], [15, 1]]);
    expect(third.dists.map((p) => [p.id, p.span])).toEqual([[21, 2], [22, 0]]);
    const last = reduceContinuous(f, { type: 'remove', list: 'spans', id: 4 });
    expect(last.spans.map((s) => s.id)).toEqual([1, 2, 3]);
    expect(last.settlements).toEqual([0.1, 0.2, 0.3, 0.4]);
    expect(last.points.map((p) => [p.id, p.span])).toEqual([[11, 0], [12, 1], [13, 2], [15, 1]]);
    expect(last.dists.map((p) => [p.id, p.span])).toEqual([[22, 0], [23, 2]]);
    for (const [name, g] of [['first', first], ['second', second], ['third', third], ['last', last]] as const) {
      expectSound(g, name);
      // Every load that is left is on the span it was on, and says the same of itself.
      const before = spanOfLoads(f);
      for (const [key, on] of spanOfLoads(g)) expect(on, `${name}: ${key}`).toBe(before.get(key));
      for (const p of g.points) expect({ ...p, span: 0 }, name).toEqual({ ...f.points.find((q) => q.id === p.id)!, span: 0 });
      for (const p of g.dists) expect({ ...p, span: 0 }, name).toEqual({ ...f.dists.find((q) => q.id === p.id)!, span: 0 });
      // The spans left are the rows they were, and nothing else of the form has moved.
      for (const s of g.spans) expect(s, name).toBe(f.spans.find((q) => q.id === s.id));
      expect([g.left, g.right, g.everyArrangement, g.section, g.nextId, g.units], name).toEqual([f.left, f.right, f.everyArrangement, f.section, f.nextId, f.units]);
    }
  });

  it('a beam is never left without a span, and a span that is not there is not removed', () => {
    const one = beam({ spans: [span(7, 12, 1, 1, 1)], settlements: [0, 0.5], points: [point(8, 0, 6, 2)], nextId: 9 });
    expect(reduceContinuous(one, { type: 'remove', list: 'spans', id: 7 })).toBe(one);
    expect(reduceContinuous(start, { type: 'remove', list: 'spans', id: 999 })).toBe(start);
    // Down to one, and no further.
    let f = start;
    for (const id of [1, 2, 3]) f = reduceContinuous(f, { type: 'remove', list: 'spans', id });
    expect(f.spans.map((s) => s.id)).toEqual([3]);
    expect(f.settlements).toEqual([0, 0]);
  });

  it('adding a span and taking it away again is the beam of before', () => {
    const f = four();
    const more = reduceContinuous(f, { type: 'add', list: 'spans' });
    const back = reduceContinuous(more, { type: 'remove', list: 'spans', id: more.spans[4].id });
    expect({ ...back, nextId: 0 }).toEqual({ ...f, nextId: 0 });
    // …and the id it had is not handed out again.
    expect(reduceContinuous(back, { type: 'add', list: 'spans' }).spans[4].id).toBeGreaterThan(more.spans[4].id);
  });

  it('a new load is the usual one of its kind, on the span asked for: always there, pointing down', () => {
    const p = reduceContinuous(start, { type: 'add', list: 'points' });
    expect(p.points).toEqual([{ id: 4, span: 0, a: 12, P: 10, dir: 'down', live: false }]);
    expect(p.nextId).toBe(5);
    const q = reduceContinuous(p, { type: 'add', list: 'dists', span: 1 });
    // Over the first half of its span: over all of it, it would be the span's uniform load again.
    expect(q.dists).toEqual([{ id: 5, span: 1, a1: 0, a2: 15, w1: 1, w2: 1, dir: 'down', live: false }]);
    expect(reduceContinuous(q, { type: 'add', list: 'points', span: 2 }).points[1]).toEqual({ id: 6, span: 2, a: 12, P: 10, dir: 'down', live: false });
    // A span that is not there is not a place for a load: the first span it is.
    for (const on of [3, -1, 1.5, Number.NaN]) expect(reduceContinuous(start, { type: 'add', list: 'points', span: on }).points[0].span, String(on)).toBe(0);
    // In SI the starting values are SI-sized, at the middle of a span in metres (to four figures).
    const si = convertContinuous(start, 'si');
    expect(reduceContinuous(si, { type: 'add', list: 'points', span: 1 }).points[0]).toEqual({ id: 4, span: 1, a: 4.572, P: 50, dir: 'down', live: false });
    expect(reduceContinuous(si, { type: 'add', list: 'dists' }).dists[0]).toEqual({ id: 4, span: 0, a1: 0, a2: 3.658, w1: 15, w2: 15, dir: 'down', live: false });
  });

  it('stops at twelve loads of each kind', () => {
    let f = start;
    for (let i = 0; i < MAX_ROWS + 5; i++) f = reduceContinuous(reduceContinuous(f, { type: 'add', list: 'points' }), { type: 'add', list: 'dists' });
    expect([f.points.length, f.dists.length]).toEqual([MAX_ROWS, MAX_ROWS]);
    expectSound(f, 'twelve of each');
    expect(reduceContinuous(f, { type: 'add', list: 'points' })).toBe(f);
  });

  it('removing a load removes THAT load, and its id is not handed out again', () => {
    const f = four();
    expect(reduceContinuous(f, { type: 'remove', list: 'points', id: 11 }).points.map((p) => p.id)).toEqual([12, 13, 14, 15]);
    expect(reduceContinuous(f, { type: 'remove', list: 'points', id: 13 }).points.map((p) => p.id)).toEqual([11, 12, 14, 15]);
    expect(reduceContinuous(f, { type: 'remove', list: 'points', id: 15 }).points.map((p) => p.id)).toEqual([11, 12, 13, 14]);
    expect(reduceContinuous(f, { type: 'remove', list: 'dists', id: 22 }).dists.map((p) => p.id)).toEqual([21, 23]);
    // The rows of the other lists are not its business, nor an id that is nobody's.
    const other = reduceContinuous(f, { type: 'remove', list: 'dists', id: 11 });
    expect([other.points, other.dists, other.spans]).toEqual([f.points, f.dists, f.spans]);
    expect(reduceContinuous(f, { type: 'remove', list: 'points', id: 999 }).points).toEqual(f.points);
    const less = reduceContinuous(f, { type: 'remove', list: 'points', id: 15 });
    expect(reduceContinuous(less, { type: 'add', list: 'points' }).points[4].id).toBe(30);
  });

  it('changes one row and leaves the others', () => {
    const f = reduceContinuous(start, { type: 'patch', list: 'spans', id: 2, patch: { L: 36, k: 1.5 } });
    expect(f.spans[1]).toEqual({ id: 2, L: 36, k: 1.5, dead: 0.9, live: 1.2 });
    expect([f.spans[0], f.spans[2]]).toEqual([start.spans[0], start.spans[2]]);
    expect(f.spans[0]).toBe(start.spans[0]);
    expect(f.settlements).toBe(start.settlements);
    const g = reduceContinuous(four(), { type: 'patch', list: 'points', id: 13, patch: { a: 7.5, P: 6, dir: 'up', live: true } });
    expect(g.points[2]).toEqual({ id: 13, span: 2, a: 7.5, P: 6, dir: 'up', live: true });
    expect(g.points.filter((p) => p.id !== 13)).toEqual(four().points.filter((p) => p.id !== 13));
    const h = reduceContinuous(four(), { type: 'patch', list: 'dists', id: 22, patch: { a2: 8, w2: 0, live: true } });
    expect(h.dists[1]).toEqual({ id: 22, span: 0, a1: 0, a2: 8, w1: 2, w2: 0, dir: 'down', live: true });
  });

  // A load goes to another span when the visitor says so, and to a span of
  // the beam: never to one that is not there.
  it('a load is moved to another span only when asked, and only to a span of the beam', () => {
    const f = four();
    const moved = reduceContinuous(f, { type: 'patch', list: 'points', id: 11, patch: { span: 3 } });
    expect(moved.points[0]).toEqual({ ...f.points[0], span: 3 });
    for (const on of [4, -1, 1.5, Number.NaN, '2', null, undefined]) {
      const g = reduceContinuous(f, { type: 'patch', list: 'dists', id: 23, patch: { span: on, w1: 9 } });
      // Where it was, with the rest of the edit taken.
      expect(g.dists[2], String(on)).toEqual({ ...f.dists[2], w1: 9 });
      expectSound(g, String(on));
    }
  });

  it('an end is held another way, and nothing else moves', () => {
    const f = four();
    const g = reduceContinuous(f, { type: 'end', side: 'left', kind: 'fixed' });
    expect([g.left, g.right]).toEqual(['fixed', 'pin']);
    const h = reduceContinuous(g, { type: 'end', side: 'right', kind: 'free' });
    expect([h.left, h.right]).toEqual(['fixed', 'free']);
    // The settlement kept for the end that is now free is still there when its support comes back.
    expect(h.settlements).toEqual(f.settlements);
    expect({ ...h, left: 'pin', right: 'pin' }).toEqual(f);
  });

  it('a settlement is its joint’s, and a joint that is not there has none', () => {
    const f = reduceContinuous(start, { type: 'settlement', joint: 2, value: 0.375 });
    expect(f.settlements).toEqual([0, 0, 0.375, 0]);
    expect(reduceContinuous(f, { type: 'settlement', joint: 0, value: 1 }).settlements).toEqual([1, 0, 0.375, 0]);
    expect(reduceContinuous(f, { type: 'settlement', joint: 3, value: -0.25 }).settlements).toEqual([0, 0, 0.375, -0.25]);
    for (const joint of [4, -1, 1.5, Number.NaN]) expect(reduceContinuous(f, { type: 'settlement', joint, value: 1 }), String(joint)).toBe(f);
    // The example is not written on: each form has its own list.
    expect(start.settlements).toEqual([0, 0, 0, 0]);
    // A form whose list is not one per joint is put in step by the first edit of it.
    expect(reduceContinuous(beam({ settlements: [0.5] }), { type: 'settlement', joint: 3, value: 1 }).settlements).toEqual([0.5, 0, 0, 1]);
  });

  it('the live load is taken on every span, or in every arrangement', () => {
    const f = reduceContinuous(start, { type: 'arrangements', every: false });
    expect(f.everyArrangement).toBe(false);
    expect({ ...f, everyArrangement: true }).toEqual(start);
    expect(reduceContinuous(f, { type: 'arrangements', every: true })).toEqual(start);
  });

  // The section and its material are the first calculator's: the same edit, made by it.
  it('the section and the material are edited as the first calculator edits them', () => {
    for (const units of ['us', 'si'] as const) {
      const f = convertContinuous(start, units);
      const first: BeamForm = { ...defaultBeam(), units, section: f.section };
      for (const action of [
        { type: 'material', material: 'aluminum' },
        { type: 'material', material: 'wood' },
        { type: 'material', material: 'custom' },
        { type: 'section', patch: { mode: 'rect', b: 8, h: 16 } },
        { type: 'section', patch: { E: 12345, material: 'custom' } },
        { type: 'section', patch: { mode: 'shape', shape: 'W24X55', selfWeight: true } },
      ] as const) {
        const g = reduceContinuous(f, action);
        expect(g.section, `${units} ${JSON.stringify(action)}`).toEqual(reduceBeam(first, action).section);
        expect({ ...g, section: f.section }).toEqual(f);
      }
    }
    expect(reduceContinuous(start, { type: 'material', material: 'aluminum' }).section).toMatchObject({ material: 'aluminum', E: 10100 });
    expect(reduceContinuous(convertContinuous(start, 'si'), { type: 'material', material: 'wood' }).section).toMatchObject({ material: 'wood', E: 11000 });
    const typed = reduceContinuous(start, { type: 'section', patch: { E: 12345, material: 'custom' } });
    expect(reduceContinuous(typed, { type: 'material', material: 'custom' }).section.E).toBe(12345);
    expect(reduceContinuous(start, { type: 'section', patch: { I: 1350 } }).section).toEqual({ ...start.section, I: 1350 });
  });

  it('a beam from a link replaces the whole form, and starting over is the example', () => {
    const other = decodeContinuous(encodeContinuous(worked()))!;
    expect(reduceContinuous(start, { type: 'load', form: other })).toBe(other);
    expect(reduceContinuous(worked(), { type: 'reset' })).toEqual(defaultContinuous());
  });

  // A span's length field reports every keystroke; what sat on the span's
  // right end follows only when the field is left. Typing 36 over 30 passes through 3.
  it('typing a new length moves no load; leaving the field carries what sat on the end of THAT span', () => {
    const f = beam({
      points: [point(11, 1, 30, 5), point(12, 1, 12, 5), point(13, 0, 24, 5), point(14, 2, 30, 5), point(15, 1, 3, 5)],
      dists: [dist(21, 1, 10, 30, 1, 1), dist(22, 1, 30, 0, 1, 1), dist(23, 2, 0, 24, 1, 1), dist(24, 0, 30, 5, 1, 1)],
      nextId: 30,
    });
    let g = reduceContinuous(f, { type: 'patch', list: 'spans', id: 2, patch: { L: 3 } });
    g = reduceContinuous(g, { type: 'patch', list: 'spans', id: 2, patch: { L: 36 } });
    expect([g.points, g.dists]).toEqual([f.points, f.dists]);
    g = reduceContinuous(g, { type: 'carry-end', id: 2, from: 30, to: 36 });
    // The load at 30 ft of the second span, and the two distributed loads that ran to it; the one at 3 ft is
    // still at 3, and so is whatever says 30 on another span.
    expect(g.points.map((p) => p.a)).toEqual([36, 12, 24, 30, 3]);
    expect(g.dists.map((d) => [d.a1, d.a2])).toEqual([[10, 36], [36, 0], [0, 24], [30, 5]]);
    // Shortening it brings them back the same way.
    const back = reduceContinuous({ ...g, spans: f.spans }, { type: 'carry-end', id: 2, from: 36, to: 30 });
    expect([back.points, back.dists]).toEqual([f.points, f.dists]);
    // Nothing is carried from or to a length that is not one, or for a span that is not there.
    for (const [from, to] of [[0, 30], [30, 0], [Number.NaN, 30], [30, 30], [-5, 30]]) expect(reduceContinuous(f, { type: 'carry-end', id: 2, from, to })).toBe(f);
    expect(reduceContinuous(f, { type: 'carry-end', id: 999, from: 30, to: 36 })).toBe(f);
  });

  // The edits above are chosen; these are not. Six thousand of them, one
  // after another, on whatever the last one left.
  it('six thousand edits in a row: settlements in step, every load on its own span, no id handed out twice', () => {
    const { rnd, pick } = dice(20261011);
    const length = () => pick([0, 3, 8, 12.5, 20, 24, 37.25, 6.096]);
    const size = () => pick([0, 0.35, 1, 2.5, 12, 50]);
    const way = () => pick(['down', 'up'] as const);
    const kind = () => pick(['pin', 'fixed', 'free'] as const);
    let f = defaultContinuous();
    let everSeen = new Set(idsOf(f));
    // What the walk came across, so that it is known to have come across it.
    const met = { spansRemoved: 0, loadsGoneWithTheirSpan: 0, loadsMoved: 0, reloads: 0, eightSpans: 0, twelveLoads: 0, oneSpan: 0 };
    const edit = (): ContinuousAction | 'reload' => {
      const spanId = () => pick([...f.spans.map((s) => s.id), 999]);
      const list = pick(['points', 'dists'] as const);
      const rowId = () => pick([...f[list].map((r) => r.id), 999]);
      const on = () => pick([...f.spans.map((_, i) => i), 8, -1, 0.5]);
      switch (pick(['add-span', 'add-span', 'remove-span', 'remove-span', 'add', 'add', 'add', 'remove', 'span', 'row', 'move', 'end', 'settlement', 'arrangements', 'units', 'section', 'material', 'carry-end', 'reload', 'reload'] as const)) {
        case 'add-span':
          return { type: 'add', list: 'spans' };
        case 'remove-span':
          return { type: 'remove', list: 'spans', id: spanId() };
        case 'add':
          return { type: 'add', list, span: pick([undefined, on()]) };
        case 'remove':
          return { type: 'remove', list, id: rowId() };
        case 'span':
          return { type: 'patch', list: 'spans', id: spanId(), patch: pick([{ L: length() }, { k: pick([1, 1, 0.5, 2.25, 0]) }, { dead: size() }, { live: size() }]) };
        case 'row':
          return { type: 'patch', list, id: rowId(), patch: list === 'points' ? pick([{ a: length() }, { P: size() }, { dir: way() }, { live: rnd() < 0.5 }]) : pick([{ a1: length() }, { a2: length() }, { w1: size(), w2: size() }, { dir: way() }, { live: rnd() < 0.5 }]) };
        case 'move':
          return { type: 'patch', list, id: rowId(), patch: { span: on() } };
        case 'end':
          return { type: 'end', side: pick(['left', 'right'] as const), kind: kind() };
        case 'settlement':
          return { type: 'settlement', joint: pick([...f.settlements.map((_, j) => j), 9, -1]), value: pick([0, 0, 0.25, 0.5, -0.125, 10]) };
        case 'arrangements':
          return { type: 'arrangements', every: rnd() < 0.5 };
        case 'units':
          return { type: 'units', units: pick(['us', 'si'] as const) };
        case 'section':
          return { type: 'section', patch: pick([{ mode: 'rect' as const }, { mode: 'props' as const }, { mode: 'shape' as const, shape: pick(['W21X44', 'HSS6X4X3/8']), selfWeight: rnd() < 0.5 }, { E: 12345, material: 'custom' as const }, { I: size(), S: size() }]) };
        case 'material':
          return { type: 'material', material: pick(['steel', 'aluminum', 'concrete', 'wood', 'custom'] as const) };
        case 'carry-end':
          return { type: 'carry-end', id: spanId(), from: length(), to: length() };
        case 'reload':
          return 'reload';
      }
    };
    for (let i = 0; i < 6000; i++) {
      const action = edit();
      const why = `edit ${i}: ${JSON.stringify(action)}`;
      if (action === 'reload') {
        // The address of the form on screen, opened again: the same beam, numbered afresh.
        const link = encodeContinuous(f);
        const back = decodeContinuous(link)!;
        expect(back, why).not.toBeNull();
        expect(carried(back), why).toEqual(carried(f));
        expect(encodeContinuous(back), why).toBe(link);
        f = reduceContinuous(f, { type: 'load', form: back });
        expectSound(f, why);
        everSeen = new Set(idsOf(f));
        met.reloads += 1;
        continue;
      }
      // No edit writes on the form it is given: it returns another.
      const before = frozen(f);
      f = reduceContinuous(before, action);
      expectSound(f, why);
      // An id that was not in the form a moment ago has never been in it.
      const had = new Set(idsOf(before));
      for (const id of idsOf(f)) {
        if (!had.has(id)) expect(everSeen.has(id), `${why}: id ${id} again`).toBe(false);
        everSeen.add(id);
      }
      // A load is on the span it was on, unless this very edit moved that load;
      // it is gone when its span is, and only then or when it was itself removed.
      const [was, is] = [spanOfLoads(before), spanOfLoads(f)];
      const live = new Set(f.spans.map((s) => s.id));
      for (const [key, on] of was) {
        const touched = (action.type === 'patch' || action.type === 'remove') && action.list !== 'spans' && key === `${action.list[0]}${action.id}`;
        if (!live.has(on!)) expect(is.has(key), `${why}: ${key} outlived its span`).toBe(false);
        else if (!touched) expect(is.get(key), `${why}: ${key}`).toBe(on);
      }
      // One more row at most, and only from an edit that adds one.
      expect(is.size - was.size, why).toBeLessThanOrEqual(action.type === 'add' && action.list !== 'spans' ? 1 : 0);
      if (f.spans.length < before.spans.length) {
        met.spansRemoved += 1;
        met.loadsGoneWithTheirSpan += was.size - is.size;
      }
      if (action.type === 'patch' && 'span' in action.patch) met.loadsMoved += Number([...is].some(([key, on]) => was.get(key) !== on));
      met.eightSpans += Number(f.spans.length === MAX_SPANS);
      met.oneSpan += Number(f.spans.length === 1);
      met.twelveLoads += Number(f.points.length === MAX_ROWS || f.dists.length === MAX_ROWS);
    }
    // The walk is as wide as it is said to be: hundreds of spans removed and of loads gone with them, loads
    // moved from span to span, reloads, and beams at both limits (one span, eight; twelve loads of a kind).
    expect(met.spansRemoved).toBeGreaterThan(300);
    expect(met.loadsGoneWithTheirSpan).toBeGreaterThan(400);
    expect(met.loadsMoved).toBeGreaterThan(50);
    expect(met.reloads).toBeGreaterThan(400);
    expect(met.eightSpans).toBeGreaterThan(500);
    expect(met.oneSpan).toBeGreaterThan(100);
    expect(met.twelveLoads).toBeGreaterThan(100);
  }, 30_000);
});

describe('continuous form: what the engine is given', () => {
  // E = 29,000 ksi and I = 1,000 in⁴: EI = 29,000,000 kip·in² = 201,388.9 kip·ft².
  const EI = (29000 * 1000) / 144;

  it('a beam worked out by hand', () => {
    const f = worked();
    const p = sectionProps(f);
    near(stiffness(f.units, p), EI);
    const { model, rows } = toEngine(f, p, stiffness(f.units, p));
    expect(model.spans).toEqual([{ L: 20, k: 1 }, { L: 30, k: 2 }, { L: 10, k: 0.5 }]);
    expect([model.left, model.right]).toEqual(['fixed', 'free']);
    // Up is negative. A load is on its span, from that span's left end, as it was typed.
    expect(model.points).toEqual([
      { span: 1, a: 12, P: 9, live: true },
      { span: 2, a: 10, P: -4, live: false },
    ]);
    // The uniform loads of the spans first — a load of zero is none — then the form's own.
    expect(model.dists).toEqual([
      { span: 0, a1: 0, a2: 20, w1: 0.5, w2: 0.5, live: false },
      { span: 1, a1: 0, a2: 30, w1: 1.5, w2: 1.5, live: true },
      { span: 2, a1: 0, a2: 10, w1: 0.8, w2: 0.8, live: false },
      { span: 2, a1: 0, a2: 10, w1: 1, w2: 1, live: true },
      { span: 0, a1: 5, a2: 15, w1: -1, w2: -2, live: false },
      { span: 1, a1: 0, a2: 30, w1: 0.4, w2: 0, live: true },
    ]);
    // 0.6 in is 0.05 ft: EI·δ = 201,388.9 × 0.05 kip·ft³. The right end is free: nothing holds it, nothing settles.
    expect(model.settlements).toHaveLength(4);
    near(model.settlements![1], EI * 0.05);
    near(model.settlements![1], 10069.4444, 1e-8);
    expect([model.settlements![0], model.settlements![2], model.settlements![3]]).toEqual([0, 0, 0]);
    expect(rows.spans).toEqual([{ list: 'spans', id: 11 }, { list: 'spans', id: 12 }, { list: 'spans', id: 13 }]);
    expect(rows.settlements).toEqual([0, 1, 2, 3].map((joint) => ({ list: 'settlements', joint })));
    expect(rows.points).toEqual([{ list: 'points', id: 21 }, { list: 'points', id: 22 }]);
    expect(rows.dists).toEqual([
      { list: 'spans', id: 11, field: 'dead' },
      { list: 'spans', id: 12, field: 'live' },
      { list: 'spans', id: 13, field: 'dead' },
      { list: 'spans', id: 13, field: 'live' },
      { list: 'dists', id: 31 },
      { list: 'dists', id: 32 },
    ]);
  });

  // A settlement is entered in the unit a deflection is shown in. The factor
  // of 12 (or of 1,000) between that and the engine's length is the one a
  // deflection crosses the other way.
  it('a settlement is a length in inches or millimetres, sent as EI·δ in the engine’s feet or metres', () => {
    const us = beam({ settlements: [0.25, 0.5, 0, 1], section: section({ E: 29000, I: 1000 }) });
    const sent = toEngine(us, sectionProps(us), EI).model.settlements!;
    near(sent[0], (EI * 0.25) / 12);
    near(sent[1], (EI * 0.5) / 12);
    expect(sent[2]).toBe(0);
    near(sent[3], EI / 12);
    // 200,000 MPa × 350 × 10⁶ mm⁴ = 70,000 kN·m²; 10 mm is 0.010 m: 700 kN·m³.
    const si = beam({ units: 'si', settlements: [0, 10, 0, 2.5], section: section({ E: 200000, I: 350 }) });
    const EIsi = stiffness('si', sectionProps(si));
    near(EIsi, 70000);
    const metric = toEngine(si, sectionProps(si), EIsi).model.settlements!;
    near(metric[1], 700);
    near(metric[3], 175);
    // Read back as a deflection is shown, each is the number that was typed.
    sent.forEach((v, j) => near(v * deflectionFactor('us', EI), us.settlements[j]));
    metric.forEach((v, j) => near(v * deflectionFactor('si', EIsi), si.settlements[j]));
    // The same support pushed down by the same amount is the same EI·δ in either system: 1 in = 25.4 mm.
    const inch = beam({ settlements: [0, 1, 0, 0], section: section({ material: 'custom', E: 10000, I: 500 }) });
    const mm = convertContinuous(inch, 'si');
    expect(mm.settlements[1]).toBe(25.4);
    const [a, b] = [toEngine(inch, sectionProps(inch), stiffness('us', sectionProps(inch))), toEngine(mm, sectionProps(mm), stiffness('si', sectionProps(mm)))];
    // kip·ft³ to kN·m³.
    near(b.model.settlements![1], a.model.settlements![1] * US_TO_SI.force * US_TO_SI.length ** 3, 1e-5);
  });

  it('a free end has no support to settle, whatever the form keeps for it', () => {
    const f = beam({ left: 'free', right: 'free', settlements: [0.5, 0.25, 0.25, 0.5], section: section({ E: 29000, I: 1000 }) });
    const sent = toEngine(f, sectionProps(f), EI).model.settlements!;
    expect([sent[0], sent[3]]).toEqual([0, 0]);
    near(sent[1], (EI * 0.25) / 12);
    near(sent[2], (EI * 0.25) / 12);
    // With its supports back, they are the settlements they were.
    const g = reduceContinuous(reduceContinuous(f, { type: 'end', side: 'left', kind: 'pin' }), { type: 'end', side: 'right', kind: 'fixed' });
    const again = toEngine(g, sectionProps(g), EI).model.settlements!;
    near(again[0], (EI * 0.5) / 12);
    near(again[3], (EI * 0.5) / 12);
    expect(settles(beam({ left: 'free', settlements: [0.5, 0, 0, 0] }))).toBe(false);
    expect(settles(beam({ left: 'fixed', settlements: [0.5, 0, 0, 0] }))).toBe(true);
    expect(settles(beam({ settlements: [0, 0, Number.NaN, 0] }))).toBe(true);
    expect(settles(defaultContinuous())).toBe(false);
  });

  // No modulus, or no moment of inertia: there is no force to make of a
  // length. The beam must not come back solved as if nothing had settled.
  it('a settlement with no EI is sent as no number, so that no engine solves the beam without it', () => {
    const f = beam({ settlements: [0, 0.5, 0, 0], section: section({ I: 0 }) });
    const p = sectionProps(f);
    expect(stiffness(f.units, p)).toBe(0);
    const sent = toEngine(f, p, 0).model.settlements!;
    expect(sent[1]).toBeNaN();
    expect([sent[0], sent[2], sent[3]]).toEqual([0, 0, 0]);
    // Where nothing settles there is nothing to turn into a force, EI or not.
    expect(toEngine(defaultContinuous(), p, 0).model.settlements).toEqual([0, 0, 0, 0]);
    // A settlement that is itself no number stays none, with EI or without.
    const lost = beam({ settlements: [0, Number.NaN, Infinity, 0] });
    for (const stiff of [0, EI]) {
      const s = toEngine(lost, sectionProps(lost), stiff).model.settlements!;
      expect(Number.isFinite(s[1]) || Number.isFinite(s[2]), String(stiff)).toBe(false);
    }
  });

  it('the beam’s own weight is a load that is always there, on every span, behind every row', () => {
    const w = shape('W21X44');
    const f = { ...worked(), section: section({ mode: 'shape', selfWeight: true }) };
    const p = sectionProps(f, w);
    // 44 lb/ft.
    near(p.selfWeight, 0.044);
    const { model, rows } = toEngine(f, p, stiffness(f.units, p));
    const without = toEngine(worked(), sectionProps(worked()), EI);
    expect(model.dists).toHaveLength(without.model.dists!.length + 3);
    // No row before it has changed place.
    expect(model.dists!.slice(0, 6)).toEqual(without.model.dists);
    expect(rows.dists.slice(0, 6)).toEqual(without.rows.dists);
    expect(model.dists!.slice(6)).toEqual([
      { span: 0, a1: 0, a2: 20, w1: p.selfWeight, w2: p.selfWeight, live: false },
      { span: 1, a1: 0, a2: 30, w1: p.selfWeight, w2: p.selfWeight, live: false },
      { span: 2, a1: 0, a2: 10, w1: p.selfWeight, w2: p.selfWeight, live: false },
    ]);
    expect(rows.dists.slice(6)).toEqual([null, null, null]);
    // Not asked for, or not a steel shape: no such load.
    const off = { ...f, section: section({ mode: 'shape', selfWeight: false }) };
    expect(toEngine(off, sectionProps(off, w), EI).model.dists).toHaveLength(6);
    // In SI: 44 lb/ft is 0.6421 kN/m.
    const si = convertContinuous(f, 'si');
    const q = sectionProps(si, w);
    near(q.selfWeight, 0.044 * US_TO_SI.line);
    expect(toEngine(si, q, stiffness('si', q)).model.dists!.slice(6).map((d) => [d.span, d.w1, d.w2, d.live])).toEqual([0, 1, 2].map((i) => [i, q.selfWeight, q.selfWeight, false]));
  });

  it('whatever the form holds is sent, for the engine to refuse: a length of zero, a load that is no number, a size typed with a minus', () => {
    const f = beam({
      spans: [span(1, 0, 0, -0.5, Number.NaN), span(2, 30, 1, 0, 0)],
      settlements: [0, 0, 0],
      points: [point(4, 1, 45, -3, 'up', true)],
      dists: [dist(5, 0, 12, 2, 0, 1.5, 'up')],
    });
    const { model, rows } = toEngine(f, sectionProps(f), EI);
    expect(model.spans).toEqual([{ L: 0, k: 0 }, { L: 30, k: 1 }]);
    expect(model.dists![0]).toEqual({ span: 0, a1: 0, a2: 0, w1: -0.5, w2: -0.5, live: false });
    expect(model.dists![1].w1).toBeNaN();
    expect(model.dists![2]).toMatchObject({ span: 0, a1: 12, a2: 2, w2: -1.5, live: false });
    expect(Math.abs(model.dists![2].w1)).toBe(0);
    // Three kips typed with a minus and pointed up: three kips down.
    expect(model.points).toEqual([{ span: 1, a: 45, P: 3, live: true }]);
    expect(rows.dists).toEqual([{ list: 'spans', id: 1, field: 'dead' }, { list: 'spans', id: 1, field: 'live' }, { list: 'dists', id: 5 }]);
  });

  it('an entry the engine refuses is named by its row, and by its field when it is a span’s', () => {
    const f = { ...worked(), section: section({ mode: 'shape', selfWeight: true }) };
    const { rows } = toEngine(f, sectionProps(f, shape('W21X44')), EI);
    const said = (issue: ContinuousIssue) => issueOnRow(issue, rows);
    expect(said({ code: 'length', where: { list: 'spans', index: 1 } })).toEqual({ code: 'length', row: { list: 'spans', id: 12, field: 'L' } });
    expect(said({ code: 'short-span', where: { list: 'spans', index: 2 } })).toEqual({ code: 'short-span', row: { list: 'spans', id: 13, field: 'L' } });
    expect(said({ code: 'stiffness', where: { list: 'spans', index: 0 } })).toEqual({ code: 'stiffness', row: { list: 'spans', id: 11, field: 'k' } });
    expect(said({ code: 'number', where: { list: 'settlements', index: 1 } })).toEqual({ code: 'number', row: { list: 'settlements', joint: 1 } });
    expect(said({ code: 'outside', where: { list: 'points', index: 1 } })).toEqual({ code: 'outside', row: { list: 'points', id: 22 } });
    // The engine's distributed loads are not the form's, one for one: the spans' own come first.
    expect(said({ code: 'number', where: { list: 'dists', index: 1 } })).toEqual({ code: 'number', row: { list: 'spans', id: 12, field: 'live' } });
    expect(said({ code: 'number', where: { list: 'dists', index: 2 } })).toEqual({ code: 'number', row: { list: 'spans', id: 13, field: 'dead' } });
    expect(said({ code: 'outside', where: { list: 'dists', index: 4 } })).toEqual({ code: 'outside', row: { list: 'dists', id: 31 } });
    expect(said({ code: 'outside', where: { list: 'dists', index: 5 } })).toEqual({ code: 'outside', row: { list: 'dists', id: 32 } });
    // The beam's own weight is nobody's row, nor an entry that is not there, nor an issue of the whole beam.
    expect(said({ code: 'number', where: { list: 'dists', index: 6 } })).toEqual({ code: 'number' });
    expect(said({ code: 'number', where: { list: 'dists', index: 99 } })).toEqual({ code: 'number' });
    expect(said({ code: 'unstable' })).toEqual({ code: 'unstable' });
    expect(said({ code: 'no-spans' })).toEqual({ code: 'no-spans' });
  });
});

describe('continuous form: what only the form can know is wrong', () => {
  const EI = (29000 * 843) / 144;

  it('a settlement needs E and I: without them it is named on its joint', () => {
    const f = beam({ settlements: [0, 0.5, 0, 0.25] });
    expect(formIssues(f, EI)).toEqual([]);
    expect(formIssues(f, 0)).toEqual([
      { code: 'settlement', row: { list: 'settlements', joint: 1 } },
      { code: 'settlement', row: { list: 'settlements', joint: 3 } },
    ]);
    // As the page has it: no I typed, no modulus, a rectangle of no depth, a steel shape whose table has not arrived.
    for (const sec of [section({ I: 0 }), section({ E: 0 }), section({ mode: 'rect', h: 0 }), section({ mode: 'shape' })]) {
      const g = beam({ settlements: [0, 0.5, 0, 0], section: sec });
      const stiff = stiffness(g.units, sectionProps(g, null));
      expect(stiff).toBe(0);
      expect(formIssues(g, stiff)).toEqual([{ code: 'settlement', row: { list: 'settlements', joint: 1 } }]);
    }
    const rolled = beam({ settlements: [0, 0.5, 0, 0], section: section({ mode: 'shape' }) });
    expect(formIssues(rolled, stiffness('us', sectionProps(rolled, shape('W21X44'))))).toEqual([]);
    // With no settlement, a beam needs neither: its reactions and moments do not depend on EI.
    expect(formIssues(defaultContinuous(), 0)).toEqual([]);
    // What is kept for a free end is no settlement; what is not a number is the engine's to name.
    expect(formIssues(beam({ right: 'free', settlements: [0, 0, 0, 0.5] }), 0)).toEqual([]);
    expect(formIssues(beam({ settlements: [0, Number.NaN, Infinity, 0] }), 0)).toEqual([]);
  });

  it('a negative or meaningless section value is named, not computed with', () => {
    for (const sec of [section({ E: -1 }), section({ I: Number.NaN }), section({ S: -1 }), section({ Av: Number.NaN }), section({ mode: 'rect', b: -2 }), section({ mode: 'rect', h: -2 })]) {
      expect(formIssues(beam({ section: sec }), EI)).toEqual([{ code: 'section' }]);
    }
    // Both at once: each is said.
    expect(formIssues(beam({ settlements: [0, 0.5, 0, 0], section: section({ I: -1 }) }), 0).map((i) => i.code)).toEqual(['settlement', 'section']);
  });

  // The rule is the first calculator's, and is written out in both files:
  // held together here, over every pair of section values, in each kind of
  // section. A leftover in a field that is not on screen is no problem.
  it('by the first calculator’s rule: only what the chosen kind of section uses', () => {
    const values = [-1, 0, 5, Number.NaN, Infinity];
    const fields = ['E', 'I', 'S', 'Av', 'b', 'h'] as const;
    let named = 0;
    for (const mode of ['props', 'rect', 'shape'] as const) {
      for (let i = 0; i < fields.length; i++) {
        for (let j = i + 1; j < fields.length; j++) {
          for (const p of values) {
            for (const q of values) {
              const sec = section({ mode, [fields[i]]: p, [fields[j]]: q });
              // A beam of nothing: the first calculator says what it says of the section, and of the length.
              const first = analyse({ ...defaultBeam(), L: 0, supports: [], points: [], dists: [], section: sec }).issues.some((issue) => issue.code === 'section');
              expect(formIssues(beam({ section: sec }), EI).some((issue) => issue.code === 'section'), `${mode} ${fields[i]}=${p} ${fields[j]}=${q}`).toBe(first);
              named += Number(first);
            }
          }
        }
      }
    }
    // Some are named and some are not: the comparison is not of nothing with
    // nothing. Three of the five values are no section value. Typed properties
    // use four of the six fields: of two that are used 21 pairs in 25 are
    // named (6 × 21), of one used and one not, 15 (8 × 15). A rectangle uses
    // three: 3 × 21 + 9 × 15. A steel shape uses none.
    expect(named).toBe(6 * 21 + 8 * 15 + 3 * 21 + 9 * 15);
    expect(named).toBe(444);
    expect(formIssues(beam({ section: section({ mode: 'shape', E: -1, I: -1, b: Number.NaN }) }), EI)).toEqual([]);
  });

  it('every span the section entered, or not', () => {
    expect(oneSection(defaultContinuous())).toBe(true);
    expect(oneSection(worked())).toBe(false);
    for (const k of [0.5, 2, 0, -1, Number.NaN, 1.0000001]) expect(oneSection(beam({ spans: [span(1, 24), span(2, 30, k)], settlements: zeros(3) })), String(k)).toBe(false);
  });
});

describe('continuous form: the same beam, as the first calculator holds one', () => {
  const supportsOf = (f: BeamForm) => f.supports.map((s) => [s.kind, s.x]);

  it('a beam worked out by hand: positions along the whole beam', () => {
    const f = worked();
    expect(jointPositions(f)).toEqual([0, 20, 50, 60]);
    const b = toBeamForm(f);
    expect(b.units).toBe('us');
    expect(b.L).toBe(60);
    // Built in at the left; the first simple support is the pin, the next a roller; nothing at the free end.
    expect(b.supports).toEqual([
      { id: -1, kind: 'fixed', x: 0 },
      { id: -2, kind: 'pin', x: 20 },
      { id: -3, kind: 'roller', x: 50 },
    ]);
    // 12 ft into the second span is 32 ft along the beam; 10 ft into the third is its tip.
    expect(b.points).toEqual([
      { id: 21, x: 32, P: 9, dir: 'down' },
      { id: 22, x: 60, P: 4, dir: 'up' },
    ]);
    // Each span's uniform loads over that span — none where it is zero — then the form's own loads.
    expect(b.dists).toEqual([
      { id: -1, x1: 0, x2: 20, w1: 0.5, w2: 0.5, dir: 'down' },
      { id: -4, x1: 20, x2: 50, w1: 1.5, w2: 1.5, dir: 'down' },
      { id: -5, x1: 50, x2: 60, w1: 0.8, w2: 0.8, dir: 'down' },
      { id: -6, x1: 50, x2: 60, w1: 1, w2: 1, dir: 'down' },
      { id: 31, x1: 5, x2: 15, w1: 1, w2: 2, dir: 'up' },
      { id: 32, x1: 20, x2: 50, w1: 0.4, w2: 0, dir: 'down' },
    ]);
    expect([b.hinges, b.couples]).toEqual([[], []]);
    // The section is the form's own, for the drawing's title and for the link.
    expect(b.section).toBe(f.section);
    // No two rows of a list share an id: the drawing tells them apart by it.
    for (const list of [b.supports, b.points, b.dists]) expect(new Set(list.map((r) => r.id)).size).toBe(list.length);
  });

  it('each way of holding the two ends is the supports it says', () => {
    const two = (left: EndKind, right: EndKind) => supportsOf(toBeamForm(beam({ spans: [span(1, 10), span(2, 15)], settlements: zeros(3), left, right })));
    expect(two('pin', 'pin')).toEqual([['pin', 0], ['roller', 10], ['roller', 25]]);
    expect(two('pin', 'fixed')).toEqual([['pin', 0], ['roller', 10], ['fixed', 25]]);
    expect(two('pin', 'free')).toEqual([['pin', 0], ['roller', 10]]);
    expect(two('fixed', 'pin')).toEqual([['fixed', 0], ['pin', 10], ['roller', 25]]);
    expect(two('fixed', 'fixed')).toEqual([['fixed', 0], ['pin', 10], ['fixed', 25]]);
    expect(two('fixed', 'free')).toEqual([['fixed', 0], ['pin', 10]]);
    expect(two('free', 'pin')).toEqual([['pin', 10], ['roller', 25]]);
    expect(two('free', 'fixed')).toEqual([['pin', 10], ['fixed', 25]]);
    expect(two('free', 'free')).toEqual([['pin', 10]]);
    const one = (left: EndKind, right: EndKind) => supportsOf(toBeamForm(beam({ spans: [span(1, 10)], settlements: zeros(2), left, right })));
    expect(one('pin', 'pin')).toEqual([['pin', 0], ['roller', 10]]);
    expect(one('fixed', 'pin')).toEqual([['fixed', 0], ['pin', 10]]);
    expect(one('fixed', 'fixed')).toEqual([['fixed', 0], ['fixed', 10]]);
    expect(one('fixed', 'free')).toEqual([['fixed', 0]]);
    expect(one('free', 'fixed')).toEqual([['fixed', 10]]);
    expect(one('pin', 'free')).toEqual([['pin', 0]]);
    expect(one('free', 'free')).toEqual([]);
    // Eight spans: nine joints, each at the sum of the spans before it.
    const eight = beam({ spans: [3, 4, 5, 6, 7, 8, 9, 10].map((L, i) => span(i + 1, L)), settlements: zeros(9) });
    expect(supportsOf(toBeamForm(eight))).toEqual([['pin', 0], ['roller', 3], ['roller', 7], ['roller', 12], ['roller', 18], ['roller', 25], ['roller', 33], ['roller', 42], ['roller', 52]]);
    expect(toBeamForm(eight).supports.map((s) => s.id)).toEqual([-1, -2, -3, -4, -5, -6, -7, -8, -9]);
  });

  // The beam tables, through the first calculator's engine: if a support
  // were of another kind, or a load a span along, these would not come out.
  it('the beams of the tables come out of it', () => {
    const solved = (f: ContinuousForm) => analyse(toBeamForm(f)).solution!;
    // Built in at the left, on a roller at the right, w over L: 5wL/8 and 3wL/8, and −wL²/8 at the wall.
    const propped = solved(beam({ spans: [span(1, 16, 1, 0.5, 1.5)], settlements: zeros(2), left: 'fixed' }));
    expect(propped.reactions.map((r) => r.kind)).toEqual(['fixed', 'pin']);
    near(propped.reactions[0].Rv, (5 * 2 * 16) / 8);
    near(propped.reactions[1].Rv, (3 * 2 * 16) / 8);
    near(propped.at(0).M, (-2 * 16 * 16) / 8);
    // Built in at both ends: wL/2 each, −wL²/12 at the walls, wL²/24 at midspan.
    const built = solved(beam({ spans: [span(1, 12, 1, 3, 0)], settlements: zeros(2), left: 'fixed', right: 'fixed' }));
    near(built.at(0).M, (-3 * 144) / 12);
    near(built.at(6).M, (3 * 144) / 24);
    // 20 ft and a 5 ft overhang at the right, w = 1 on both: the inner support carries w(L + a)²/2L.
    const overhang = solved(beam({ spans: [span(1, 20, 1, 1, 0), span(2, 5, 1, 0, 1)], settlements: zeros(3), right: 'free' }));
    expect(overhang.reactions).toHaveLength(2);
    near(overhang.reactions[1].Rv, 625 / 40);
    near(overhang.reactions[0].Rv, 25 - 625 / 40);
    // The same beam the other way round: the overhang at the left.
    const mirror = solved(beam({ spans: [span(1, 5, 1, 1, 0), span(2, 20, 1, 0, 1)], settlements: zeros(3), left: 'free' }));
    expect(mirror.reactions.map((r) => r.x)).toEqual([5, 25]);
    near(mirror.reactions[0].Rv, 625 / 40);
    near(mirror.reactions[1].Rv, 25 - 625 / 40);
    // 4 kip on the tip of that overhang — 5 ft into the SECOND span — lifts the far support: −P·a/L.
    const tip = solved(beam({ spans: [span(1, 20), span(2, 5)], settlements: zeros(3), right: 'free', points: [point(9, 1, 5, 4)] }));
    near(tip.reactions[0].Rv, -1);
    near(tip.reactions[1].Rv, 5);
    // …and a partial load on the second of two equal spans is on the second:
    // 2 kip/ft over its last 4 ft. A load P at x from the middle support
    // puts P·x·(L − x)·(2L − x)/L on the right of the three-moment equation;
    // summed from 6 to 10 ft that is (w/L)·[L²x² − Lx³ + x⁴/4] = 147.2, and
    // 2·MB·(10 + 10) = −147.2.
    const partial = solved(beam({ spans: [span(1, 10), span(2, 10)], settlements: zeros(3), dists: [dist(9, 1, 6, 10, 2, 2)] }));
    const term = (x: number) => 100 * x * x - 10 * x ** 3 + x ** 4 / 4;
    near((2 / 10) * (term(10) - term(6)), 147.2);
    near(partial.at(10).M, -147.2 / 40);
    // The first span carries nothing of its own: its end reaction is MB/L, downward.
    near(partial.reactions[0].Rv, -147.2 / 40 / 10);
  });

  it('a load that names no span is left out; a size typed with a minus is drawn as typed', () => {
    const f = beam({ spans: [span(1, 10, 1, -0.5, 0), span(2, 15)], settlements: zeros(3), points: [point(5, 2, 1, 1), point(6, 1, 20, 2), point(7, -1, 1, 1)], dists: [dist(8, 9, 0, 1, 1, 1), dist(9, 0, 8, 2, 1, -1)] });
    const b = toBeamForm(f);
    // The load 20 ft into a 15 ft span is drawn where its numbers put it: its row says it is off its span.
    expect(b.points).toEqual([{ id: 6, x: 30, P: 2, dir: 'down' }]);
    expect(b.dists).toEqual([
      { id: -1, x1: 0, x2: 10, w1: -0.5, w2: -0.5, dir: 'down' },
      { id: 9, x1: 8, x2: 2, w1: 1, w2: -1, dir: 'down' },
    ]);
  });

  it('the first calculator’s address of the example opens there as the same beam', () => {
    const d = defaultContinuous();
    const code = generalCode(d)!;
    expect(code).toBe(encodeBeam(toBeamForm(d)));
    // Written out: three spans end to end, their two loads each, the section.
    expect(code).toBe('K71e57yx83m;us;78;p0_r24_r54_r78;;;0,24,0.9,0.9_0,24,1.2,1.2_24,54,0.9,0.9_24,54,1.2,1.2_54,78,0.9,0.9_54,78,1.2,1.2;;p,s,29000,843,81.6,7.245');
    const opened = decodeBeam(code)!;
    expect(carriedBeam(opened)).toEqual(carriedBeam(toBeamForm(d)));
    expect(opened.section).toMatchObject({ mode: 'props', material: 'steel', E: 29000, I: 843, S: 81.6, Av: 7.245 });
    // Solved there, it is the beam under all its loads.
    const a = analyse(opened);
    expect(a.issues).toEqual([]);
    near(a.solution!.at(24).M, (-2.1 * (24 ** 3 + 30 ** 3)) / (4 * (2 * 24 + 3 * 30)));
    // In metres too, and with a steel shape carrying its own weight.
    const si = convertContinuous(d, 'si');
    expect(carriedBeam(decodeBeam(generalCode(si)!)!)).toEqual(carriedBeam(toBeamForm(si)));
    const rolled = beam({ section: section({ mode: 'shape', selfWeight: true }) });
    expect(decodeBeam(generalCode(rolled)!)!.section).toMatchObject({ mode: 'shape', shape: 'W21X44', selfWeight: true });
  });

  it('there is no such address where the first calculator cannot hold the beam', () => {
    const d = defaultContinuous();
    const spans = (over: Partial<SpanRow>, at = 1) => d.spans.map((s, i) => (i === at ? { ...s, ...over } : s));
    // A span of another stiffness: it has one EI along the beam.
    for (const k of [2, 0.5, 0, Number.NaN]) expect(generalCode(beam({ spans: spans({ k }) })), String(k)).toBeNull();
    // A support that settles: its supports do not move.
    for (const joint of [0, 1, 3]) expect(generalCode(reduceContinuous(d, { type: 'settlement', joint, value: 0.5 })), String(joint)).toBeNull();
    expect(generalCode(beam({ settlements: [0, Number.NaN, 0, 0] }))).toBeNull();
    // …but what is kept for a free end is no settlement.
    expect(generalCode(beam({ right: 'free', settlements: [0, 0, 0, 0.5] }))).not.toBeNull();
    // A length that is not one: two joints at one place would be one support there.
    for (const L of [0, -5, Number.NaN, Infinity]) expect(generalCode(beam({ spans: spans({ L }) })), String(L)).toBeNull();
    // A load off its span would land on the next one, or on none.
    expect(generalCode(beam({ points: [point(9, 0, 24, 5)] }))).not.toBeNull();
    for (const a of [24.5, -1, Number.NaN]) expect(generalCode(beam({ points: [point(9, 0, a, 5)] })), String(a)).toBeNull();
    expect(generalCode(beam({ points: [point(9, 3, 1, 5)] }))).toBeNull();
    expect(generalCode(beam({ dists: [dist(9, 1, 0, 30, 1, 1)] }))).not.toBeNull();
    // Entered from right to left it is the same load, there as here.
    expect(generalCode(beam({ dists: [dist(9, 1, 30, 0, 1, 1)] }))).not.toBeNull();
    for (const [a1, a2] of [[0, 30.5], [-1, 30], [31, 0], [0, Number.NaN]]) expect(generalCode(beam({ dists: [dist(9, 1, a1, a2, 1, 1)] })), `${a1} to ${a2}`).toBeNull();
    expect(generalCode(beam({ dists: [dist(9, -1, 0, 1, 1, 1)] }))).toBeNull();
    // More loads than it lists. Six spans with both loads are twelve rows there, and fit; one more row does not, nor a seventh span.
    const many = (n: number) => beam({ spans: Array.from({ length: n }, (_, i) => span(i + 1, 20, 1, 0.9, 1.2)), settlements: zeros(n + 1) });
    expect(decodeBeam(generalCode(many(6))!)!.dists).toHaveLength(MAX_ROWS);
    expect(generalCode({ ...many(6), dists: [dist(9, 0, 0, 5, 1, 1)] })).toBeNull();
    expect(generalCode(many(7))).toBeNull();
    // Eight spans with one load each, and four more: twelve.
    const eight = beam({ spans: Array.from({ length: 8 }, (_, i) => span(i + 1, 20, 1, 0.9, 0)), settlements: zeros(9), dists: [1, 2, 3, 4].map((i) => dist(20 + i, i, 0, 5, 1, 1)) });
    expect(decodeBeam(generalCode(eight)!)!.dists).toHaveLength(MAX_ROWS);
    expect(decodeBeam(generalCode(eight)!)!.supports).toHaveLength(9);
  });

  // The beams above are chosen; these are not. Any ends, one to six spans,
  // loads anywhere on them: the address opens in the first calculator as the
  // beam `toBeamForm` makes, to the eight figures an address carries.
  it('two hundred random beams each open in the first calculator as themselves', () => {
    const { rnd, pick } = dice(20261012);
    let withLoads = 0;
    for (let i = 0; i < 200; i++) {
      const units = pick(['us', 'si'] as const);
      let id = 1;
      const spans = Array.from({ length: 1 + Math.floor(rnd() * 6) }, () => span(id++, r8(pick([8, 12.5, 20, 24, 6.096, 0.75, 33.333333]) * (0.5 + rnd())), 1, pick([0, 0, r8(rnd() * 3)]), pick([0, r8(rnd() * 3)])));
      const on = () => Math.floor(rnd() * spans.length);
      const at = (i: number) => r8(pick([0, spans[i].L, spans[i].L / 2, rnd() * spans[i].L]));
      const some = <T>(row: () => T): T[] => Array.from({ length: Math.floor(rnd() * 3) }, row);
      const form: ContinuousForm = {
        ...defaultContinuous(),
        units,
        spans,
        left: pick(['pin', 'fixed', 'free'] as const),
        right: pick(['pin', 'fixed', 'free'] as const),
        settlements: zeros(spans.length + 1),
        points: some(() => {
          const i = on();
          return point(id++, i, at(i), r8(rnd() * 40), pick(['down', 'up'] as const), rnd() < 0.5);
        }),
        dists: some(() => {
          const i = on();
          return dist(id++, i, at(i), at(i), r8(rnd() * 4), r8(rnd() * 4), pick(['down', 'up'] as const), rnd() < 0.5);
        }),
        section: section({ E: MATERIALS.steel[units] }),
        nextId: id,
      };
      const code = generalCode(form);
      const drawn = toBeamForm(form);
      if (drawn.dists.length > MAX_ROWS) {
        expect(code, JSON.stringify(form.spans)).toBeNull();
        continue;
      }
      expect(code, JSON.stringify(form)).not.toBeNull();
      const opened = decodeBeam(code!)!;
      expect(opened, code!).not.toBeNull();
      expect(carriedBeam(opened), code!).toEqual(carriedBeam(drawn));
      // What it opens is what its link says, with nothing lost between the two: its own address is that address.
      expect(encodeBeam(opened), code!).toBe(code);
      // One joint per span and one more, less the free ends.
      expect(opened.supports).toHaveLength(spans.length + 1 - Number(form.left === 'free') - Number(form.right === 'free'));
      withLoads += Number(form.points.length + form.dists.length > 0);
    }
    expect(withLoads).toBeGreaterThan(100);
  });
});

describe('continuous form: a beam in an address', () => {
  const d = defaultContinuous();

  it('opens the same beam', () => {
    const text = encodeContinuous(worked());
    expect(text).toMatch(/^[A-Za-z0-9.,;_/-]+$/);
    const back = decodeContinuous(text)!;
    expect(back).not.toBeNull();
    expect(carried(back)).toEqual(carried(worked()));
    // What the engine is given is the same, to the last figure.
    const sent = (f: ContinuousForm) => toEngine(f, sectionProps(f), stiffness(f.units, sectionProps(f))).model;
    expect(sent(back)).toEqual(sent(worked()));
    // Every row has its own id, the spans first, and the next one is free.
    expect(back.spans.map((s) => s.id)).toEqual([1, 2, 3]);
    expect(idsOf(back)).toEqual([1, 2, 3, 4, 5, 6, 7]);
    expect(back.nextId).toBe(8);
    expectSound(back, 'read from a link');
  });

  // Written out, so that the rule is pinned by something other than itself:
  // the two sums of the example's 73 characters are 716,775 and 367,755 —
  // fd2f and 7vrf in base 36 — and 73 is 21 (2 × 36 + 1).
  it('the address of the example is short, and is this', () => {
    expect(encodeContinuous(d)).toBe('Kfd2f7vrf21;us;pp1;24,1,0.9,1.2_30,1,0.9,1.2_24,1,0.9,1.2;;;;p,s,29000,843,81.6,7.245');
    expect(encodeContinuous(d).length).toBeLessThan(90);
    expect(encodeContinuous(beam({ section: section({ mode: 'rect' }) }))).toBe('Knpg8xv411s;us;pp1;24,1,0.9,1.2_30,1,0.9,1.2_24,1,0.9,1.2;;;;r,s,29000,12,24');
    expect(encodeContinuous(beam({ section: section({ mode: 'shape' }) }))).toBe('Krpf19x1j1n;us;pp1;24,1,0.9,1.2_30,1,0.9,1.2_24,1,0.9,1.2;;;;s,W21X44,0');
    expect(encodeContinuous(beam({ section: section({ mode: 'shape', selfWeight: true }) }))).toBe('Kdye39pin1n;us;pp1;24,1,0.9,1.2_30,1,0.9,1.2_24,1,0.9,1.2;;;;s,W21X44,1');
    // One of everything: the ends, each span, the settlements, a live and a dead load of each kind, up and down.
    expect(encodeContinuous(worked())).toBe(sealed('us;fn1;20,1,0.5,0_30,2,0,1.5_10,0.5,0.8,1;0_0.6_0_0.3;l2,12,9_d3,10,-4;d1,5,15,-1,-2_l2,0,30,0.4,0;p,s,29000,1000,81.6,7.245'));
    for (const f of [d, worked(), convertContinuous(worked(), 'si')]) expect(encodeContinuous(f)).toBe(sealed(bodyOf(encodeContinuous(f))));
    expect(carried(decodeContinuous('Kfd2f7vrf21;us;pp1;24,1,0.9,1.2_30,1,0.9,1.2_24,1,0.9,1.2;;;;p,s,29000,843,81.6,7.245')!)).toEqual(carried(d));
    // The page's address before 14 October 2026, with the check of that day — 73 characters is 21, and their sum
    // was 393: ax. Links written then have been sent, and open as the same beam.
    expect(decodeContinuous('21ax;us;pp1;24,1,0.9,1.2_30,1,0.9,1.2_24,1,0.9,1.2;;;;p,s,29000,843,81.6,7.245')).toEqual(decodeContinuous(encodeContinuous(d)));
    expect(decodeContinuous('1s64;us;pp1;24,1,0.9,1.2_30,1,0.9,1.2_24,1,0.9,1.2;;;;r,s,29000,12,24')).toEqual(decodeContinuous(encodeContinuous(beam({ section: section({ mode: 'rect' }) }))));
    expect(decodeContinuous('1n8b;us;pp1;24,1,0.9,1.2_30,1,0.9,1.2_24,1,0.9,1.2;;;;s,W21X44,1')).toEqual(decodeContinuous(encodeContinuous(beam({ section: section({ mode: 'shape', selfWeight: true }) }))));
    expect(decodeContinuous('21ay;us;pp1;24,1,0.9,1.2_30,1,0.9,1.2_24,1,0.9,1.2;;;;p,s,29000,843,81.6,7.245')).toBeNull();
    // The page's key is its own: c, where the first calculator's is b and the second's s.
    expect(CONTINUOUS_KEY).toBe('c');
    expect(SPAN_KEY).not.toBe(CONTINUOUS_KEY);
  });

  it('carries each way of holding the ends, and how the live load is taken', () => {
    for (const left of ['pin', 'fixed', 'free'] as const) {
      for (const right of ['pin', 'fixed', 'free'] as const) {
        for (const everyArrangement of [true, false]) {
          const back = decodeContinuous(encodeContinuous(beam({ left, right, everyArrangement })))!;
          expect([back.left, back.right, back.everyArrangement]).toEqual([left, right, everyArrangement]);
        }
      }
    }
    expect(bodyOf(encodeContinuous(beam({ left: 'fixed', right: 'free', everyArrangement: false }))).split(';')[1]).toBe('fn0');
  });

  it('carries the settlements, one per joint — and nothing at all where no support moves', () => {
    expect(bodyOf(encodeContinuous(d)).split(';')[3]).toBe('');
    const moved = beam({ settlements: [0, 0.5, 0, -0.25] });
    expect(bodyOf(encodeContinuous(moved)).split(';')[3]).toBe('0_0.5_0_-0.25');
    expect(decodeContinuous(encodeContinuous(moved))!.settlements).toEqual([0, 0.5, 0, -0.25]);
    // What is kept for a free end travels too: it is in the form.
    const kept = beam({ right: 'free', settlements: [0, 0, 0, 0.75] });
    expect(decodeContinuous(encodeContinuous(kept))!.settlements).toEqual([0, 0, 0, 0.75]);
    // One span has two joints, eight have nine.
    for (const n of [1, 2, 8]) {
      const f = beam({ spans: Array.from({ length: n }, (_, i) => span(i + 1, 10 + i)), settlements: Array.from({ length: n + 1 }, (_, j) => j / 8) });
      expect(decodeContinuous(encodeContinuous(f))!.settlements, String(n)).toEqual(f.settlements);
      expect(decodeContinuous(encodeContinuous({ ...f, settlements: zeros(n + 1) }))!.settlements, String(n)).toEqual(zeros(n + 1));
    }
  });

  it('carries each kind of section, and a material of the visitor’s own', () => {
    const shaped = beam({ section: section({ mode: 'shape', shape: 'HSS6X4X3/8', selfWeight: true }) });
    expect(decodeContinuous(encodeContinuous(shaped))!.section).toMatchObject({ mode: 'shape', shape: 'HSS6X4X3/8', selfWeight: true });
    const custom = beam({ section: section({ material: 'custom', E: 12345 }) });
    expect(decodeContinuous(encodeContinuous(custom))!.section).toMatchObject({ mode: 'props', material: 'custom', E: 12345, I: 843, S: 81.6, Av: 7.245 });
    const concrete = beam({ section: section({ mode: 'rect', material: 'concrete', E: 3605, b: 14, h: 28 }) });
    expect(decodeContinuous(encodeContinuous(concrete))!.section).toMatchObject({ mode: 'rect', material: 'concrete', E: 3605, b: 14, h: 28 });
    // "Steel" beside another modulus would be a label that contradicts its number: it opens as the visitor's own.
    expect(decodeContinuous(encodeContinuous(beam({ section: section({ E: 29500 }) })))!.section).toMatchObject({ material: 'custom', E: 29500 });
    // Every name in the shape table goes through, a hyphen or a slash in it or not.
    for (const s of shapes.filter((x) => /[-/.]/.test(x.designation)).slice(0, 120)) {
      expect(decodeContinuous(encodeContinuous(beam({ section: section({ mode: 'shape', shape: s.designation }) })))?.section.shape, s.designation).toBe(s.designation);
    }
  });

  // What a link does not carry (the rectangle's sides when it gives
  // properties, a shape's name when it gives none) starts from THIS page's
  // example, in the link's own units — not from the first calculator's
  // W18×50, and not from inches under a millimetre label.
  it('what a link does not carry is this page’s example, in the link’s units', () => {
    const rect = decodeContinuous(encodeContinuous(beam({ section: section({ mode: 'rect', b: 10, h: 20 }) })))!;
    expect(rect.section).toEqual(section({ mode: 'rect', b: 10, h: 20 }));
    expect(rect.section.shape).toBe('W21X44');
    const si = convertContinuous(d, 'si');
    expect(decodeContinuous(encodeContinuous(si))!.section).toEqual(si.section);
    expect(si.section.b).toBeCloseTo(304.8, 6);
    const metric = decodeContinuous(encodeContinuous({ ...si, section: { ...si.section, mode: 'rect', b: 300, h: 600 } }))!;
    expect(metric.section.I).toBeCloseTo(si.section.I, 6);
    expect(metric.section.S).toBeCloseTo(si.section.S, 6);
    const rolled = decodeContinuous(encodeContinuous({ ...si, section: { ...si.section, mode: 'shape', shape: 'W24X55' } }))!;
    expect(rolled.section).toEqual({ ...si.section, mode: 'shape', shape: 'W24X55' });
  });

  // "Whatever is on screen is in the address": a field keeps eight figures,
  // and so does the link.
  it('carries the eight figures a field shows', () => {
    const form = beam({ spans: [span(1, 12.345678, 1.2345678, 0.12345678, 1234.5678), span(2, 10.000002)], settlements: [0.00012345678, 0, 123.45678], points: [point(4, 1, 9.8765432, 1234.567)] });
    expect(carried(decodeContinuous(encodeContinuous(form))!)).toEqual(carried(form));
    // Each number is written as its field shows it, whatever its size.
    for (const v of [20, 12.34567, 1234.567, 10.000002, 0.1 + 0.2, 1 / 3, 12.3456789, 29000, 1e-7, 0.000001234, 2e12, 123456789012, 1e21, 1.5e300, Number.MAX_VALUE, 5e-324]) {
      const f = beam({ spans: [span(1, v, v, v, v)], settlements: [v, v] });
      const body = bodyOf(encodeContinuous(f)).split(';');
      const text = fieldNumber(v).replace('+', '');
      expect(body[2], String(v)).toBe(`${text},${text},${text},${text}`);
      expect(body[3], String(v)).toBe(`${text}_${text}`);
      const back = decodeContinuous(encodeContinuous(f))!;
      expect([back.spans[0].L, back.spans[0].k, back.spans[0].dead, back.spans[0].live, ...back.settlements], String(v)).toEqual(Array.from({ length: 6 }, () => Number(fieldNumber(v))));
    }
    // A ninth figure is not on screen, and does not travel.
    expect(decodeContinuous(encodeContinuous(beam({ spans: [span(1, 12.3456789)], settlements: [0, 0] })))!.spans[0].L).toBe(12.345679);
  });

  // A field holds whatever number is typed: a length of 0 on its way to 0.5,
  // a stiffness factor of 0 on its way to 0.8. That beam's address, reloaded,
  // must be that beam with its warning — not the example.
  it('reopens as the form on screen, whatever a field holds', () => {
    for (const v of [0, -5, 2e12, 1e21, 1e-7]) {
      for (const over of [{ L: v }, { k: v }, { dead: v }, { live: v }]) {
        const form = { ...worked(), spans: worked().spans.map((s, i) => (i === 1 ? { ...s, ...over } : s)) };
        const link = encodeContinuous(form);
        expect(link, JSON.stringify(over)).toMatch(/^[A-Za-z0-9.,;_/-]+$/);
        expect(carried(decodeContinuous(link)!), JSON.stringify(over)).toEqual(carried(form));
      }
    }
    // Loads off their spans, entered right to left, of no length or no size; a settlement of any size.
    const odd: ContinuousForm = {
      ...worked(),
      settlements: [1e-9, -3, 2e12, 0],
      points: [point(4, 0, -4, 3e15, 'down', true), point(5, 2, 33.333333, 0, 'up'), point(6, 1, 0, 12.75, 'up', true)],
      dists: [dist(7, 2, 28.5, 2.5, 0.85, 2.4, 'up', true), dist(8, 0, 0, 37.25, 0.000012345678, 0), dist(9, 1, 5, 5, 1, 1)],
      section: section({ material: 'custom', E: 12345.678, I: 0, S: 1e-12, Av: 9.48 }),
    };
    expect(carried(decodeContinuous(encodeContinuous(odd))!)).toEqual(carried(odd));
    const rect: ContinuousForm = { ...odd, section: section({ mode: 'rect', material: 'wood', E: 1600, b: 0, h: 11.25 }) };
    expect(carried(decodeContinuous(encodeContinuous(rect))!)).toEqual(carried(rect));
  });

  // A size being retyped passes through 0. An upward load at 0 must not
  // reopen pointing down, for the digits typed next to make it a load in
  // the wrong direction.
  it('a load of size zero keeps its direction; a size typed with a minus reopens as the same load', () => {
    const zero = beam({
      points: [point(4, 0, 12, 0, 'up'), point(5, 1, 6, 0, 'down', true)],
      dists: [dist(6, 0, 0, 20, 0, 0, 'up'), dist(7, 1, 0, 20, 0, 3, 'up', true), dist(8, 2, 0, 20, 3, 0, 'up'), dist(9, 0, 0, 20, 0, 0, 'down'), dist(10, 1, 0, 20, 0, 3, 'down')],
    });
    // toEqual tells 0 from −0: none of the zeros that come back is a −0.
    expect(carried(decodeContinuous(encodeContinuous(zero))!)).toEqual(carried(zero));
    const minus = beam({
      spans: [span(1, 24, 1, -0.5, -1.2), span(2, 30)],
      settlements: [0, -0.5, 0],
      points: [point(4, 0, 12, -5, 'down'), point(5, 1, 6, -2, 'up', true)],
      dists: [dist(6, 0, 0, 20, -2, -1, 'down'), dist(7, 1, 0, 20, 2, -1, 'up', true), dist(8, 1, 0, 20, 0, -3, 'down'), dist(9, 0, 0, 20, 0, -3, 'up')],
    });
    const back = decodeContinuous(encodeContinuous(minus))!;
    // A span's own loads and a settlement have no direction of their own: the sign is theirs.
    expect(back.spans.map((s) => [s.dead, s.live])).toEqual([[-0.5, -1.2], [0, 0]]);
    expect(back.settlements).toEqual([0, -0.5, 0]);
    expect(back.points.map((p) => [p.P, p.dir, p.live])).toEqual([[5, 'up', false], [2, 'down', true]]);
    expect(back.dists.map((p) => [p.w1, p.w2, p.dir, p.live])).toEqual([[2, 1, 'up', false], [-2, 1, 'down', true], [0, 3, 'up', false], [0, 3, 'down', false]]);
    // The engine is given the same loads either way…
    const sent = (f: ContinuousForm) => toEngine(f, sectionProps(f), 1).model;
    const same = (a: ReturnType<typeof sent>, b: ReturnType<typeof sent>) => {
      expect(a.points!.map((p) => [p.span, p.a, p.P + 0, p.live])).toEqual(b.points!.map((p) => [p.span, p.a, p.P + 0, p.live]));
      expect(a.dists!.map((p) => [p.span, p.a1, p.a2, p.w1 + 0, p.w2 + 0, p.live])).toEqual(b.dists!.map((p) => [p.span, p.a1, p.a2, p.w1 + 0, p.w2 + 0, p.live]));
    };
    same(sent(back), sent(minus));
    // …and from there on it is the form that travels.
    expect(carried(decodeContinuous(encodeContinuous(back))!)).toEqual(carried(back));
  });

  // 10³⁰⁸ kip is a number; in kilonewtons it is past the largest there is,
  // and the field is left empty with its row marked. That is a form too.
  it('a value that is no longer a number is still the form that was on screen', () => {
    const huge = convertContinuous(beam({ points: [point(4, 1, 12, 1e308, 'up', true)], settlements: [0, 1e308, 0, 0] }), 'si');
    expect(huge.points[0].P).toBe(Infinity);
    expect(huge.settlements[1]).toBe(Infinity);
    const link = encodeContinuous(huge);
    expect(link).toMatch(/^[A-Za-z0-9.,;_/-]+$/);
    expect(carried(decodeContinuous(link)!)).toEqual(carried(huge));
    for (const v of [Infinity, -Infinity, Number.NaN]) {
      const back = decodeContinuous(encodeContinuous(beam({ spans: [span(1, v, v, v, v)], settlements: [v, 0] })))!;
      expect([back.spans[0].L, back.spans[0].k, back.spans[0].dead, back.spans[0].live, back.settlements[0]], String(v)).toEqual([v, v, v, v, v]);
    }
  });

  // The beams above are chosen; these are not. Any ends, one to eight spans,
  // loads on any of them, settlements, any number a field can show, each
  // kind of section, both systems.
  it('four hundred random forms each reopen as themselves', () => {
    const { rnd, pick } = dice(20261013);
    const seen = { spans: new Set<number>(), settled: 0, loads: 0, ends: new Set<string>(), sections: new Set<string>() };
    for (let i = 0; i < 400; i++) {
      const form = randomContinuous(rnd, pick);
      const { spans } = form;
      const link = encodeContinuous(form);
      expect(link).toMatch(/^[A-Za-z0-9.,;_/-]+$/);
      const back = decodeContinuous(link)!;
      expect(back, link).not.toBeNull();
      expect(carried(back), link).toEqual(carried(form));
      expectSound(back, link);
      // The address of the beam that came back is the address it came from: nothing drifts from reload to reload.
      expect(encodeContinuous(back), link).toBe(link);
      // What the form says is wrong with itself, it says again after the reload.
      expect(formIssues(back, 0), link).toEqual(formIssues(form, 0));
      // …with its last few characters gone it is no link at all, and it is not the first calculator's link either.
      expect(decodeContinuous(link.slice(0, -1 - Math.floor(rnd() * 8))), link).toBeNull();
      expect(decodeBeam(link), link).toBeNull();
      seen.spans.add(spans.length);
      seen.settled += Number(form.settlements.some((v) => v !== 0));
      seen.loads += form.points.length + form.dists.length;
      seen.ends.add(form.left + form.right);
      seen.sections.add(form.section.mode);
    }
    // The set is as wide as it is said to be.
    expect(seen.spans.size).toBe(MAX_SPANS);
    expect(seen.ends.size).toBe(9);
    expect(seen.sections.size).toBe(3);
    expect(seen.settled).toBeGreaterThan(100);
    expect(seen.loads).toBeGreaterThan(1000);
  });

  it('refuses anything that is not this page’s beam', () => {
    const plain = 'us;pp1;24,1,0.9,1.2_30,1,0.9,1.2;;l1,12,10;d2,0,15,1,2;p,s,29000,843,81.6,7.245';
    expect(carried(decodeContinuous(sealed(plain))!)).toEqual({
      units: 'us',
      left: 'pin',
      right: 'pin',
      everyArrangement: true,
      spans: [[24, 1, 0.9, 1.2], [30, 1, 0.9, 1.2]],
      settlements: [0, 0, 0],
      points: [[0, 12, 10, 'down', true]],
      dists: [[1, 0, 15, 1, 2, 'down', false]],
      section: ['props', 'steel', 29000, 843, 81.6, 7.245],
    });
    const spansOf = (n: number) => plain.replace('24,1,0.9,1.2_30,1,0.9,1.2', Array.from({ length: n }, () => '24,1,0.9,1.2').join('_')).replace('d2,', 'd1,');
    const loads = (n: number, row: string, where: string) => plain.replace(where, Array.from({ length: n }, () => row).join('_'));
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
      `${plain};extra`,
      swap(';;l1', ';l1'),
      // The two ends and the arrangement: two of three letters and a 0 or a 1, and nothing else.
      swap(';pp1;', ';pp;'),
      swap(';pp1;', ';pp2;'),
      swap(';pp1;', ';px1;'),
      swap(';pp1;', ';rp1;'),
      swap(';pp1;', ';ppp1;'),
      swap(';pp1;', ';PP1;'),
      swap(';pp1;', ';p1;'),
      swap(';pp1;', ';;'),
      swap(';pp1;', ';constructor;'),
      swap(';pp1;', ';pp1 ;'),
      // A beam of no span — with loads on the spans it has not, and with nothing at all — of nine, or with a
      // span short of a number or with one too many.
      swap('24,1,0.9,1.2_30,1,0.9,1.2', ''),
      'us;pp1;;;;;p,s,29000,843,81.6,7.245',
      'us;pp1;;0;;;p,s,29000,843,81.6,7.245',
      spansOf(MAX_SPANS + 1),
      swap('24,1,0.9,1.2_', '24,1,0.9_'),
      swap('24,1,0.9,1.2_', '24,1,0.9,1.2,7_'),
      swap('24,1,0.9,1.2_', '24,1,0.9,1.2__'),
      swap('24,1,0.9,1.2_', '_24,1,0.9,1.2_'),
      // A number in any notation but the page's own, or no number at all.
      swap(';24,', ';0x18,'),
      swap(';24,', ';2e+1,'),
      swap(';24,', ';24.,'),
      swap(';24,', ';.5,'),
      swap(';24,', '; 24,'),
      swap(';24,', ';2E1,'),
      swap(';24,', ';,'),
      swap(';24,', ';1e999,'),
      swap(';24,', ';Infinity,'),
      swap(';24,', ';NaN,'),
      swap(';24,', ';INF,'),
      swap(';24,', ';+inf,'),
      swap(',1,0.9,1.2_', ',1k,0.9,1.2_'),
      // Settlements: one per joint, three here, or none at all.
      swap(';;l1', ';0_0.5;l1'),
      swap(';;l1', ';0_0.5_0_0;l1'),
      swap(';;l1', ';0.5;l1'),
      swap(';;l1', ';x;l1'),
      swap(';;l1', ';0,0_0_0;l1'),
      swap(';;l1', ';0_0.5_;l1'),
      // A load: on a span of the beam, marked d or l, with all its numbers and no more.
      swap('l1,12,10', 'l3,12,10'),
      swap('l1,12,10', 'l0,12,10'),
      swap('l1,12,10', 'l9,12,10'),
      swap('l1,12,10', 'x1,12,10'),
      swap('l1,12,10', 'L1,12,10'),
      swap('l1,12,10', '1,12,10'),
      swap('l1,12,10', 'l,12,10'),
      swap('l1,12,10', 'l01,12,10'),
      swap('l1,12,10', 'l1.0,12,10'),
      swap('l1,12,10', 'l-1,12,10'),
      swap('l1,12,10', 'l11,12,10'),
      swap('l1,12,10', 'l1,12'),
      swap('l1,12,10', 'l1,12,10,1'),
      swap('l1,12,10', 'l1,12,+10'),
      swap('l1,12,10', 'l1,12,10kip'),
      swap('l1,12,10', 'l1,12,--10'),
      swap('l1,12,10', 'l1,12,10_'),
      swap('d2,0,15,1,2', 'd3,0,15,1,2'),
      swap('d2,0,15,1,2', 'd2,0,15,1'),
      swap('d2,0,15,1,2', 'd2,0,15,1,2,3'),
      swap('d2,0,15,1,2', '2,0,15,1,2'),
      swap('d2,0,15,1,2', 'constructor,0,15,1,2'),
      loads(MAX_ROWS + 1, 'l1,12,10', 'l1,12,10'),
      loads(MAX_ROWS + 1, 'd2,0,15,1,2', 'd2,0,15,1,2'),
      // The section is the first calculator's to read, and it refuses what it refuses there.
      swap('p,s,29000', 'p,z,29000'),
      swap('p,s,29000', 'q,s,29000'),
      swap('p,s,29000', 'p,constructor,29000'),
      swap('p,s,29000', 'p,toString,29000'),
      swap('p,s,29000', 'p,__proto__,29000'),
      swap(',81.6,7.245', ',81.6'),
      swap(',81.6,7.245', ',81.6,7.245,1'),
      swap('p,s,29000,843,81.6,7.245', 'r,s,29000,12'),
      swap('p,s,29000,843,81.6,7.245', 's,W21X44<b>,0'),
      swap('p,s,29000,843,81.6,7.245', 's,W21X44,2'),
      swap('p,s,29000,843,81.6,7.245', 's,W21X44'),
      swap('p,s,29000,843,81.6,7.245', ''),
      'x'.repeat(3000),
    ]) {
      // Behind a check that is right, so that it is the beam that is refused; and bare, with no check at all.
      expect(() => decodeContinuous(sealed(body)), body.slice(0, 70)).not.toThrow();
      expect(decodeContinuous(sealed(body)), body.slice(0, 70)).toBeNull();
      expect(decodeContinuous(body), body.slice(0, 70)).toBeNull();
    }
    // Eight spans, nine settlements and twelve loads of each kind are the limits, and are accepted.
    expect(decodeContinuous(sealed(spansOf(MAX_SPANS)))?.spans).toHaveLength(MAX_SPANS);
    expect(decodeContinuous(sealed(spansOf(MAX_SPANS).replace(';;l1', `;${zeros(9).join('_')};l1`)))?.settlements).toHaveLength(9);
    expect(decodeContinuous(sealed(loads(MAX_ROWS, 'l1,12,10', 'l1,12,10')))?.points).toHaveLength(MAX_ROWS);
    expect(decodeContinuous(sealed(loads(MAX_ROWS, 'd2,0,15,1,2', 'd2,0,15,1,2')))?.dists).toHaveLength(MAX_ROWS);
    // Zeros written out are still no settlement: such a link opens, though no form writes it.
    expect(decodeContinuous(sealed(plain.replace(';;l1', ';0_0_0;l1')))?.settlements).toEqual([0, 0, 0]);
    expect(decodeContinuous(sealed(plain.replace(';;l1', ';0_0.5_0;l1')))?.settlements).toEqual([0, 0.5, 0]);
  });

  // Each calculator's address is its own. One opened as another's would be
  // another beam: neither reads the other's.
  it('is not the address of either other calculator, nor they its own', () => {
    const first = encodeBeam(defaultBeam());
    expect(decodeContinuous(first)).toBeNull();
    expect(decodeContinuous(sealed(bodyOf(first)))).toBeNull();
    expect(decodeContinuous(encodeBeam(toBeamForm(d)))).toBeNull();
    expect(decodeContinuous(generalCode(d)!)).toBeNull();
    const second = encodeSpan(defaultSpan(), DEFAULT_LIMIT, 0);
    expect(decodeContinuous(second)).toBeNull();
    expect(decodeContinuous(sealed(second))).toBeNull();
    for (const f of [d, worked(), beam({ spans: [span(1, 20)], settlements: [0, 0] })]) {
      expect(decodeBeam(encodeContinuous(f))).toBeNull();
      expect(decodeBeam(bodyOf(encodeContinuous(f)))).toBeNull();
    }
  });

  // No form writes more than this: eight spans, nine settlements and twelve
  // loads of each kind, every number at its longest. It must open; and
  // nothing longer is looked at.
  it('reads the longest link a form can write, and nothing longer', () => {
    const big = -1.2345678e20;
    expect(String(big)).toHaveLength(22);
    const worst: ContinuousForm = {
      units: 'us',
      spans: Array.from({ length: MAX_SPANS }, (_, i) => span(i + 1, big, big, big, big)),
      left: 'fixed',
      right: 'free',
      settlements: Array.from({ length: MAX_SPANS + 1 }, () => big),
      // A size is written with its direction: the longest is an upward one.
      points: Array.from({ length: MAX_ROWS }, (_, i) => point(20 + i, 7, big, -big, 'up', true)),
      dists: Array.from({ length: MAX_ROWS }, (_, i) => dist(40 + i, 7, big, big, -big, -big, 'up', true)),
      everyArrangement: true,
      section: section({ material: 'custom', E: big, I: big, S: big, Av: big }),
      nextId: 100,
    };
    const link = encodeContinuous(worst);
    expect(link).toHaveLength(2786);
    expect(carried(decodeContinuous(link)!)).toEqual(carried(worst));
    // Zeros after a decimal point are still the number, so a link can be
    // padded to any length with every field in order: it is the length that
    // is refused.
    const padded = (n: number) => sealed(bodyOf(encodeContinuous(d)).replace(';24,', `;24.${'0'.repeat(n)},`));
    expect(decodeContinuous(padded(2900))?.spans[0].L).toBe(24);
    expect(padded(2950).length).toBeGreaterThan(3000);
    expect(decodeContinuous(padded(2950))).toBeNull();
  });
});

describe('continuous form: a link that lost part of itself', () => {
  const d = defaultContinuous();
  const si = convertContinuous(d, 'si');
  // Each kind of section, loads and settlements or none, both unit systems, one span and several.
  const forms: [string, ContinuousForm][] = [
    ['the example', d],
    ['the example, SI', si],
    ['a rectangle', beam({ section: section({ mode: 'rect' }) })],
    ['a steel shape with its own weight', beam({ section: section({ mode: 'shape', selfWeight: true }) })],
    ['one of everything', worked()],
    ['one of everything, SI', convertContinuous(worked(), 'si')],
    ['one span and nothing else', beam({ spans: [span(1, 20)], settlements: [0, 0], left: 'fixed', right: 'free' })],
  ];

  // …;r,s,29000,12,24 without its last character is …;r,s,29000,12,2 — a
  // rectangle 12 × 2 — and …_24,1,0.9,1.2 cut after its 1 is a span with a
  // tenth of its live load. The check counts the characters behind it.
  it('cut short anywhere, it is not a link to another beam', () => {
    for (const [name, form] of forms) {
      const link = encodeContinuous(form);
      expect(carried(decodeContinuous(link)!), name).toEqual(carried(form));
      for (let length = 0; length < link.length; length++) {
        const cut = link.slice(0, length);
        expect(decodeContinuous(cut), `${name}: ${cut}`).toBeNull();
      }
    }
    const rect = encodeContinuous(beam({ section: section({ mode: 'rect' }) }));
    expect(rect.endsWith(';r,s,29000,12,24')).toBe(true);
    expect(decodeContinuous(rect)?.section.h).toBe(24);
    expect(decodeContinuous(rect.slice(0, -1))).toBeNull();
  });

  it('nor with something added, one character changed, or two neighbours swapped', () => {
    const letters = '0123456789.,;_-/abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ';
    for (const [name, form] of forms.slice(0, 5)) {
      const link = encodeContinuous(form);
      const at = link.indexOf(';');
      const [check, body] = [link.slice(0, at), link.slice(at + 1)];
      for (const more of ['0', '.', ')', ';', ' ', '%20']) expect(decodeContinuous(link + more), `${name} + "${more}"`).toBeNull();
      for (let i = 0; i < body.length; i++) {
        for (const ch of letters) {
          if (ch === body[i]) continue;
          const changed = `${check};${body.slice(0, i)}${ch}${body.slice(i + 1)}`;
          expect(decodeContinuous(changed), `${name}: ${changed}`).toBeNull();
        }
        if (i + 1 < body.length && body[i] !== body[i + 1]) {
          const swapped = `${check};${body.slice(0, i)}${body[i + 1]}${body[i]}${body.slice(i + 2)}`;
          expect(decodeContinuous(swapped), `${name}: ${swapped}`).toBeNull();
        }
      }
      // The check itself is part of the link: another one is another link, and none at all is no link.
      for (const other of ['', '0', 'us', check.slice(0, -1), `${check}0`, check.toUpperCase() === check ? `${check}a` : check.toUpperCase()]) {
        expect(decodeContinuous(`${other};${body}`), `${name}: "${other}"`).toBeNull();
      }
      expect(decodeContinuous(body), name).toBeNull();
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

describe('continuous form: the check of its address, put to the test', () => {
  const d = defaultContinuous();
  const examples: ContinuousForm[] = [
    d,
    convertContinuous(d, 'si'),
    beam({ section: section({ mode: 'rect' }) }),
    beam({ section: section({ mode: 'shape', selfWeight: true }) }),
    worked(),
    convertContinuous(worked(), 'si'),
    beam({ spans: [span(1, 20)], settlements: [0, 0], left: 'fixed', right: 'free' }),
  ];
  /** Three hundred beams not chosen, from the generator the round trip is held to. */
  const drawn = (() => {
    const { rnd, pick } = dice(20261014);
    return { rnd, forms: Array.from({ length: 300 }, () => randomContinuous(rnd, pick)) };
  })();
  const links = [...examples, ...drawn.forms].map(encodeContinuous);

  it('every beam opens as itself, behind the check described, and writes the same address again', () => {
    for (const form of [...examples, ...drawn.forms]) {
      const link = encodeContinuous(form);
      expect(link).toBe(sealed(bodyOf(link)));
      const back = decodeContinuous(link)!;
      expect(back, link).not.toBeNull();
      expect(carried(back), link).toEqual(carried(form));
      expect(encodeContinuous(back), link).toBe(link);
    }
  });

  it('one character changed, added or taken away anywhere — the check included — is no link: the examples with every printable character, the random beams with characters drawn at every place', () => {
    let tried = 0;
    for (const [n, link] of links.entries()) {
      for (const text of n < examples.length ? oneAway(link, PRINTABLE) : oneAway(link, WRITTEN, { rnd: drawn.rnd, per: 1 })) {
        tried += 1;
        if (decodeContinuous(text) !== null) expect.fail(`opened: ${text}`);
      }
    }
    expect(tried).toBeGreaterThan(350000);
  }, 30_000);

  it('two characters changed are no link: twenty thousand drawn anywhere, and every pair 54 apart — each of which the check of before let through', () => {
    for (let n = 0; n < 20000; n++) {
      const text = twoChanged(links[n % links.length], n % 2 ? PRINTABLE : WRITTEN, drawn.rnd);
      if (decodeContinuous(text) !== null) expect.fail(`opened: ${text}`);
    }
    // The longest link a form writes: eight spans, nine settlements, twelve loads of each kind, every number at its longest.
    const big = -1.2345678e20;
    const longest = encodeContinuous({
      units: 'us',
      spans: Array.from({ length: MAX_SPANS }, (_, i) => span(i + 1, big, big, big, big)),
      left: 'fixed',
      right: 'free',
      settlements: Array.from({ length: MAX_SPANS + 1 }, () => big),
      points: Array.from({ length: MAX_ROWS }, (_, i) => point(20 + i, 7, big, -big, 'up', true)),
      dists: Array.from({ length: MAX_ROWS }, (_, i) => dist(40 + i, 7, big, big, -big, -big, 'up', true)),
      everyArrangement: true,
      section: section({ material: 'custom', E: big, I: big, S: big, Av: big }),
      nextId: 100,
    });
    let pairs = 0;
    for (const link of [longest, ...links.slice(0, examples.length)]) {
      const body = bodyOf(link);
      for (const changed of apart54(body)) {
        pairs += 1;
        // The check of before could not tell this body from the one written; this one can.
        expect(oldCheckOf(changed)).toBe(oldCheckOf(body));
        if (decodeContinuous(`${link.slice(0, link.indexOf(';'))};${changed}`) !== null) expect.fail(`opened: ${changed}`);
      }
    }
    expect(pairs).toBeGreaterThan(2700);
  });

  it('every one of those beams opens from a link with the check of before 14 October 2026, as the same beam', () => {
    for (const link of links) {
      const old = oldSealed(bodyOf(link));
      expect(old, link).not.toBe(link);
      expect(decodeContinuous(old), old).toEqual(decodeContinuous(link));
    }
  });
});
