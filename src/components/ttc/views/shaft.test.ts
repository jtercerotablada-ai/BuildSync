import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { createElement as h } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { decodeBeam, defaultBeam, encodeBeam } from '@/lib/calc/beam/model';
import { SPAN_KEY } from '@/lib/calc/beam/span';
import { spanPage } from '@/lib/calc/beam/span-page-strings';
import { spanUi } from '@/lib/calc/beam/span-strings';
import { beamStrings } from '@/lib/calc/beam/strings';
import { CONTINUOUS_KEY, decodeContinuous, defaultContinuous, encodeContinuous } from '@/lib/calc/continuous/model';
import { continuousPage } from '@/lib/calc/continuous/page-strings';
import { continuousUi } from '@/lib/calc/continuous/strings';
import { formatNumber } from '@/lib/calc/format';
import { CLOSE, SHORT, STIFF, solveShaft } from '@/lib/calc/shaft/engine';
import {
  MAX_ROWS,
  MAX_SEGMENTS,
  SHAFT_KEY,
  SHAFT_MATERIALS,
  SHAFT_UNITS,
  TO_ENGINE,
  decodeShaft,
  defaultShaft,
  encodeShaft,
  reduceShaft,
  sectionOf,
  shownMoment,
  shownStress,
  toEngine,
  type ShaftForm,
} from '@/lib/calc/shaft/model';
import { shaftPage } from '@/lib/calc/shaft/page-strings';
import { shaftUi, sharedWords } from '@/lib/calc/shaft/strings';
import type { ShaftModel, ShaftSolution } from '@/lib/calc/shaft/types';
import { calculatorFamilies } from '@/lib/ttc/calculators';
import { openCalculatorPaths } from '@/lib/ttc/calculator-paths';
import { getContent, navLabelOf } from '@/lib/ttc/content';
import { localePath, type Lang } from '@/lib/ttc/i18n';
import { DESCRIPTION_LIMIT_PX, TITLE_BUDGET_PX, descriptionPx, repeatedWords, titlePx, unmeasured } from '@/lib/ttc/serp';
import { absoluteUrl } from '@/lib/ttc/site';
import { ShaftCalculator } from '@/components/ttc/calc/shaft/ShaftCalculator';
import { addressNow } from '@/components/ttc/mp/lang';
import { SiteChrome } from '@/components/ttc/mp/SiteChrome';
import { BEAM_PATH } from './BeamCalculatorView';
import { CalculatorPage, type CalculatorText } from './CalculatorPage';
import { CONTINUOUS_PATH } from './ContinuousBeamView';
import { pageMeta } from './meta';
import { SHAFT_PATH, ShaftView } from './ShaftView';
import { SPAN_PATH } from './SingleSpanView';

// As in the engines' own tests: much of this file is arithmetic that never waits. A turn of the event loop between two
// tests lets the runner hear from this worker, which it otherwise reports as a timeout of its own over a passing run.
afterEach(() => new Promise<void>((resolve) => setTimeout(resolve, 0)));

/**
 * THE SHAFT'S PAGE: /resources/shaft-on-bearings and its /es twin.
 *
 * The fourth calculator has an engine of its own, tested where it lives
 * (lib/calc/shaft). What is tested here is the PAGE: that what its notes say
 * the tool does, it does — each such sentence beside the behaviour and,
 * where a word could be turned into its opposite with the behaviour
 * untouched (a direction, a sign, which side of a shoulder, which bearing),
 * the clause itself read in BOTH languages: the notes are what an engineer
 * reads before trusting a number, and the owner answers for them —; that
 * each closed form it gives to check the tool by is the one the tool
 * reproduces, to the figures printed; that no sentence of the other three
 * calculators' pages is said again, which a search engine reads as one page
 * twice; that the legal words are taken, not retyped; and that the page
 * around the tool is the one every calculator shares, in both languages.
 *
 * In that order: the four closed forms, the last by the unit-load method
 * written out here; the method and the notes, each sentence beside what the
 * engine and the form's model do; the words themselves; then the page as the
 * server sends it — what a search result shows, the example solved (redone
 * here by statics and the unit-load method), what the form does on screen
 * where the notes say it does something, the sheet on paper, what the script
 * carries, and the language link.
 *
 * The tool's own behaviour — every field, the address, the drawings — is its
 * own test's (calc/shaft).
 */

const route = vi.hoisted(() => ({ pathname: '/' }));
vi.mock('next/navigation', () => ({ usePathname: () => route.pathname }));

const LANGS: Lang[] = ['en', 'es'];

/** Every string of a nested object, with the path to it. */
function leaves(value: unknown, path = ''): [string, string][] {
  if (typeof value === 'string') return [[path, value]];
  if (Array.isArray(value)) return value.flatMap((v, i) => leaves(v, `${path}[${i}]`));
  if (value && typeof value === 'object') return Object.entries(value).flatMap(([k, v]) => leaves(v, path ? `${path}.${k}` : k));
  return [];
}

/* Words as a reader sees them — no capitals, no punctuation — and every run
   of six of them: where a phrase stops being the language's and starts being
   a sentence's (single-span.test.ts). */
const wordsOf = (t: string) => t.toLowerCase().replace(/[^\p{L}\p{N}\s]/gu, ' ').split(/\s+/).filter(Boolean);
const runsOf = (t: string) => {
  const w = wordsOf(t);
  return w.length < 6 ? [] : w.slice(0, w.length - 5).map((_, i) => w.slice(i, i + 6).join(' '));
};
const sharedRuns = (ours: string[], theirs: string[]) => {
  const known = new Set(theirs.flatMap(runsOf));
  return [...new Set(ours.flatMap(runsOf).filter((run) => known.has(run)))];
};

/** The legal words, which are the first calculator's by design: said once, and so said the same. */
const LEGAL = /^(disclaimer\.|sheet\.)/;

/* The engine, asked as the notes describe it. */

const solved = (model: ShaftModel): ShaftSolution => {
  const out = solveShaft(model);
  if (!out.ok) throw new Error(`not solved: ${JSON.stringify(out.issues)}`);
  return out;
};
const codesOf = (model: ShaftModel) => {
  const out = solveShaft(model);
  return out.ok ? [] : out.issues.map((i) => [i.code, i.where?.list, i.where?.index]);
};
/** The form's shaft as the engine is given it, solved. */
const solvedForm = (form: ShaftForm) => solved(toEngine(form).model);
/** Two numbers that are one, to rounding: their difference beside the larger of them (two zeros are one number). */
const off = (got: number, want: number) => (got === want ? 0 : Math.abs(got - want) / Math.max(Math.abs(got), Math.abs(want)));
/** A value as the page prints one: four significant figures. */
const printed = (value: number) => formatNumber(value, 4);

/* STEEL, as the form lists it: 29,000 ksi is 29,000,000 lbf/in². A solid
   round of diameter d has I = πd⁴/64 and Z = πd³/32. */
const E = 29000e3;
const inertia = (d: number, bore = 0) => (Math.PI * (d ** 4 - bore ** 4)) / 64;
const modulus = (d: number, bore = 0) => (Math.PI * (d ** 4 - bore ** 4)) / (32 * d);
/** A segment of solid steel, as the engine takes one. */
const round = (L: number, d: number) => ({ L, EI: E * inertia(d), Z: modulus(d) });
/** A form of solid steel segments (length, diameter), in inches and pounds-force, with nothing on it yet. */
const formOf = (segments: [L: number, d: number][], bearings: [number, number]): ShaftForm => ({
  ...defaultShaft(),
  segments: segments.map(([L, d], i) => ({ id: i + 1, L, d, bore: 0 })),
  bearings,
  forces: [],
  couples: [],
  nextId: segments.length + 1,
});

/* The unit-load method, written out.

   Nothing of how engine.ts works is in it: the statics are the two equations
   of equilibrium, written here, and a slope or a deflection is ONE integral
   over the whole shaft — the bending moment of the loads, times the bending
   moment of a unit load put where the answer is wanted, over EI — with no
   constant of integration to fix and nothing carried from piece to piece. */

/** One plane of a shaft as statics sees it: forces positive downward, applied moments positive counter-clockwise, and a weight per length on each segment. Its bearings left to right. */
type Plane = { segments: { L: number; EI: number; w?: number }[]; bearings: [number, number]; forces?: { x: number; P: number }[]; moments?: { x: number; C: number }[] };

/**
 * Its two reactions (upward positive) and its bending moment at x (sagging
 * positive) by statics alone: every force to the left of the cut times its
 * arm. `past` reads just right of x, where an applied moment standing AT x
 * is already behind the cut.
 */
function staticsOf(plane: Plane) {
  const [A, B] = plane.bearings;
  const forces = plane.forces ?? [];
  const moments = plane.moments ?? [];
  const ends = plane.segments.reduce<number[]>((at, s) => [...at, at[at.length - 1] + s.L], [0]);
  const weights = plane.segments.map((s, i) => ({ from: ends[i], to: ends[i + 1], w: s.w ?? 0 }));
  // Moments about the left bearing: the right reaction times the distance between the two carries every force times its arm,
  // less what the applied moments turn the shaft by (counter-clockwise, as that reaction turns it).
  const about = forces.reduce((sum, f) => sum + f.P * (f.x - A), 0) + weights.reduce((sum, g) => sum + g.w * (g.to - g.from) * ((g.from + g.to) / 2 - A), 0) - moments.reduce((sum, m) => sum + m.C, 0);
  const RB = about / (B - A);
  // Forces across the shaft: the two reactions carry everything that pushes down.
  const RA = forces.reduce((sum, f) => sum + f.P, 0) + weights.reduce((sum, g) => sum + g.w * (g.to - g.from), 0) - RB;
  const M = (x: number, past = false): number => {
    const arm = (at: number) => Math.max(0, x - at);
    let sum = RA * arm(A) + RB * arm(B);
    for (const f of forces) sum -= f.P * arm(f.x);
    for (const g of weights) {
      const on = Math.min(x, g.to) - g.from;
      if (on > 0) sum -= g.w * on * (x - (g.from + on / 2));
    }
    for (const m of moments) if (m.x < x || (past && m.x === x)) sum -= m.C;
    return sum;
  };
  return { RA, RB, M, ends };
}

/**
 * The slope (counter-clockwise positive) and the deflection (upward
 * positive) of that plane at p, by virtual work: the integral of M × m ÷ EI,
 * m being the moment of a unit load at p — a unit moment, counter-clockwise,
 * for the slope; a unit force, downward, for the deflection, which is
 * therefore minus the integral. Between two places M is a parabola at most
 * and m a straight line: Simpson's rule is exact for their product.
 */
function unitLoad(plane: Plane, p: number): { theta: number; v: number } {
  const real = staticsOf(plane);
  const bare = { segments: plane.segments.map((s) => ({ L: s.L, EI: s.EI })), bearings: plane.bearings };
  const turned = staticsOf({ ...bare, moments: [{ x: p, C: 1 }] }).M;
  const pushed = staticsOf({ ...bare, forces: [{ x: p, P: 1 }] }).M;
  const places = [...new Set([...real.ends, ...plane.bearings, ...(plane.forces ?? []).map((f) => f.x), ...(plane.moments ?? []).map((m) => m.x), p])].sort((a, b) => a - b);
  let theta = 0;
  let down = 0;
  for (let i = 0; i < places.length - 1; i++) {
    const [a, b] = [places[i], places[i + 1]];
    const mid = (a + b) / 2;
    const EI = plane.segments[real.ends.findIndex((end, k) => k > 0 && mid < end) - 1].EI;
    // Each end of the piece read from inside it: an applied moment standing on a place belongs to one side of it.
    const simpson = (m: (x: number, past?: boolean) => number) => ((b - a) / 6) * (real.M(a, true) * m(a, true) + 4 * real.M(mid) * m(mid) + real.M(b) * m(b));
    theta += simpson(turned) / EI;
    down += simpson(pushed) / EI;
  }
  return { theta, v: -down };
}

/** The two planes of a model, each as the unit-load method takes one. */
const planesOf = (model: ShaftModel): { vertical: Plane; horizontal: Plane } => {
  const bearings = [...model.bearings].sort((a, b) => a - b) as [number, number];
  const plane = (of: 'v' | 'h'): Plane => ({
    segments: model.segments.map((s) => ({ L: s.L, EI: s.EI, w: of === 'v' ? s.w : 0 })),
    bearings,
    forces: (model.forces ?? []).map((f) => ({ x: f.x, P: f[of] })),
    moments: (model.couples ?? []).map((c) => ({ x: c.x, C: c[of] })),
  });
  return { vertical: plane('v'), horizontal: plane('h') };
};

describe('shaft on bearings: the closed forms it gives to check it by', () => {
  // The numbers of the four cases: a steel shaft 2 in across on bearings
  // 20 in apart, under 1,000 lbf. I = π × 2⁴ ÷ 64 = 0.7854 in⁴ and
  // EI = 29,000,000 × 0.7854 = 22,776,547 lbf·in². Each formula the page
  // prints is written out as arithmetic AND as what it comes to by hand; the
  // engine's answer is held to both, and printed as the page prints a value.
  const [L, P, D] = [20, 1000, 2];
  const EI = E * inertia(D);

  it('the stiffness of the cases: I = πD⁴/64 of a solid round, as the form works it out', () => {
    expect(inertia(D)).toBeCloseTo(Math.PI / 4, 14);
    expect(printed(EI)).toBe('2.278 × 10^7');
    // The form's own section, and what it hands the engine: the same EI.
    const form = formOf([[L, D]], [0, L]);
    expect(sectionOf(form.segments[0])!.I).toBeCloseTo(inertia(D), 14);
    expect(off(toEngine(form).model.segments[0].EI, EI)).toBeLessThan(1e-15);
    for (const lang of LANGS) expect(shaftPage[lang].method.paragraphs.at(-5)).toContain('I = πD⁴/64');
  });

  it('one diameter, a force midway: each reaction P/2, PL³/(48EI) under the force, PL²/(16EI) at each bearing', () => {
    // As a visitor enters it: one segment, the bearings at its two ends, the force at 10 in, downward.
    const form: ShaftForm = { ...formOf([[L, D]], [0, L]), forces: [{ id: 2, x: L / 2, v: P, vDir: 'down', h: 0, hDir: 'towards' }], nextId: 3 };
    const out = solvedForm(form);
    expect(out.bearings.map((b) => b.radial)).toEqual([P / 2, P / 2]);
    // 1,000 × 20³ ÷ (48 × 22,776,547) = 0.007317 in.
    expect(off(out.at(L / 2).v, (P * L ** 3) / (48 * EI))).toBeLessThan(1e-12);
    expect(printed(out.at(L / 2).v)).toBe('0.007317');
    // It goes DOWN under a downward force: negative in the vertical plane, where upward is positive.
    expect(out.at(L / 2).vertical.v).toBeLessThan(0);
    // 1,000 × 20² ÷ (16 × 22,776,547) = 0.001098 rad at each bearing: clockwise at the left one, counter-clockwise at the right.
    for (const b of out.bearings) {
      expect(off(b.theta, (P * L ** 2) / (16 * EI))).toBeLessThan(1e-12);
      expect(printed(b.theta)).toBe('0.001098');
    }
    expect(out.bearings.map((b) => Math.sign(b.thetaVertical))).toEqual([-1, 1]);
    // Under the force the shaft is level, and nowhere lower.
    expect(out.at(L / 2).theta).toBe(0);
    expect(out.extremes.v).toEqual({ value: out.at(L / 2).v, x: L / 2 });
  });

  it('one diameter, a force on an overhang: P(L + a)/L at the near bearing and Pa/L the opposite way at the other, Pa over the near one, Pa²(L + a)/(3EI) under the force', () => {
    const a = 6;
    const form: ShaftForm = { ...formOf([[L + a, D]], [0, L]), forces: [{ id: 2, x: L + a, v: P, vDir: 'down', h: 0, hDir: 'towards' }], nextId: 3 };
    const out = solvedForm(form);
    const [far, near] = out.bearings;
    // The near bearing is the one beside the overhang, 20 in from the left end; the force is 6 in past it.
    expect([far.x, near.x]).toEqual([0, L]);
    // 1,000 × 26 ÷ 20 = 1,300 lbf, upward: more than the force itself.
    expect(near.vertical).toBeCloseTo((P * (L + a)) / L, 9);
    expect(printed(near.radial)).toBe('1,300');
    // 1,000 × 6 ÷ 20 = 300 lbf the other way: that bearing holds the shaft DOWN.
    expect(far.vertical).toBeCloseTo((-P * a) / L, 9);
    expect(printed(far.radial)).toBe('300');
    // 1,000 × 6 = 6,000 lbf·in over the near bearing, hogging; nothing over the other.
    expect(out.at(L).vertical.M).toBeCloseTo(-P * a, 9);
    expect(out.at(L).M).toBeCloseTo(P * a, 9);
    expect(out.extremes.M).toEqual({ value: P * a, x: L });
    expect(out.at(0).M).toBe(0);
    // 1,000 × 6² × 26 ÷ (3 × 22,776,547) = 0.0137 in under the force, downward.
    expect(off(out.at(L + a).v, (P * a ** 2 * (L + a)) / (3 * EI))).toBeLessThan(1e-12);
    expect(printed(out.at(L + a).v)).toBe('0.0137');
    expect(out.at(L + a).vertical.v).toBeLessThan(0);
  });

  it('the first case at 45° between the planes: P/√2 in each, 1/√2 of that deflection and slope in each — and the resultants are the first case’s, whole', () => {
    const c = P / Math.SQRT2;
    const one = solved({ segments: [round(L, D)], bearings: [0, L], forces: [{ x: L / 2, v: P, h: 0 }] });
    const out = solved({ segments: [round(L, D)], bearings: [0, L], forces: [{ x: L / 2, v: c, h: c }] });
    // 1,000 ÷ √2 = 707.1 lbf in each plane: half of it at each bearing.
    expect(printed(c)).toBe('707.1');
    for (const b of out.bearings) {
      expect(b.vertical).toBeCloseTo(c / 2, 9);
      expect(b.horizontal).toBeCloseTo(c / 2, 9);
      // 0.001098 ÷ √2 = 0.0007761 rad in each plane.
      expect(off(Math.abs(b.thetaVertical), (P * L ** 2) / (16 * EI) / Math.SQRT2)).toBeLessThan(1e-12);
      expect(off(Math.abs(b.thetaHorizontal), (P * L ** 2) / (16 * EI) / Math.SQRT2)).toBeLessThan(1e-12);
    }
    const mid = out.at(L / 2);
    // 0.007317 ÷ √2 = 0.005174 in in each plane.
    expect(off(-mid.vertical.v, (P * L ** 3) / (48 * EI) / Math.SQRT2)).toBeLessThan(1e-12);
    expect(off(-mid.horizontal.v, (P * L ** 3) / (48 * EI) / Math.SQRT2)).toBeLessThan(1e-12);
    expect(printed(mid.vertical.v)).toBe('-0.005174');
    // The two together: the first case, to the last figures — the radial load, the moment, the deflection, the slope.
    expect(out.bearings.map((b) => off(b.radial, P / 2) < 1e-14)).toEqual([true, true]);
    expect(off(mid.M, one.at(L / 2).M)).toBeLessThan(1e-14);
    expect(off(mid.v, one.at(L / 2).v)).toBeLessThan(1e-14);
    expect(out.bearings.map((b, i) => off(b.theta, one.bearings[i].theta) < 1e-14)).toEqual([true, true]);
    expect(printed(mid.v)).toBe('0.007317');
  });

  /* THE STEPPED CASE, BY THE UNIT-LOAD METHOD. Bearings at the two ends, L
     apart; EI in the two end quarters, nEI in the middle half; P at the
     middle. From either bearing M = Px/2, and by symmetry each integral is
     twice its left half.

     The deflection under the force — a unit force there, m = x/2:

         δ = 2 [ ∫ from 0 to L/4 of (Px/2)(x/2) dx ÷ EI + ∫ from L/4 to L/2 of the same ÷ nEI ]
           = (P/2) [ (L/4)³/3 ÷ EI + ((L/2)³ − (L/4)³)/3 ÷ nEI ]
           = PL³ (1 + 7/n) ÷ (384 EI)

     The slope at a bearing — a unit moment there, m = 1 − x/L, and by
     symmetry the integral of M·m is half the integral of M:

         θ = ½ · 2 [ ∫ from 0 to L/4 of (Px/2) dx ÷ EI + ∫ from L/4 to L/2 of the same ÷ nEI ]
           = (P/4) [ (L/4)² ÷ EI + ((L/2)² − (L/4)²) ÷ nEI ]
           = PL² (1 + 3/n) ÷ (64 EI)

     With n = 1 they are the first case's PL³/48EI and PL²/16EI. */
  it('the first case on a stepped shaft, nEI in its middle half: PL³(1 + 7/n)/(384EI) under the force, PL²(1 + 3/n)/(64EI) at each bearing', () => {
    // The integrals above, as arithmetic.
    const delta = (n: number, ei: number) => (P / 2) * ((L / 4) ** 3 / 3 / ei + ((L / 2) ** 3 - (L / 4) ** 3) / 3 / (n * ei));
    const theta = (n: number, ei: number) => (P / 4) * ((L / 4) ** 2 / ei + ((L / 2) ** 2 - (L / 4) ** 2) / (n * ei));
    // …they come to the formulas printed, and with n = 1 to the first case's.
    for (const n of [1, 2, 3, 16]) {
      expect(off(delta(n, EI), (P * L ** 3 * (1 + 7 / n)) / (384 * EI))).toBeLessThan(1e-14);
      expect(off(theta(n, EI), (P * L ** 2 * (1 + 3 / n)) / (64 * EI))).toBeLessThan(1e-14);
    }
    expect(off(delta(1, EI), (P * L ** 3) / (48 * EI))).toBeLessThan(1e-14);
    expect(off(theta(1, EI), (P * L ** 2) / (16 * EI))).toBeLessThan(1e-14);

    // The engine, with a stiffness three times as large in the middle half: n = 3.
    const stepped = (n: number): ShaftModel => ({ segments: [{ L: L / 4, EI }, { L: L / 2, EI: n * EI }, { L: L / 4, EI }], bearings: [0, L], forces: [{ x: L / 2, v: P, h: 0 }] });
    for (const n of [1, 3, 16, 0.25]) {
      const out = solved(stepped(n));
      expect(off(out.at(L / 2).v, (P * L ** 3 * (1 + 7 / n)) / (384 * EI)), `n = ${n}`).toBeLessThan(1e-12);
      for (const b of out.bearings) expect(off(b.theta, (P * L ** 2 * (1 + 3 / n)) / (64 * EI)), `n = ${n}`).toBeLessThan(1e-12);
      // …and the unit-load method as a function, which knows no symmetry, says the same at both.
      const plane = planesOf(stepped(n)).vertical;
      expect(off(unitLoad(plane, L / 2).v, out.at(L / 2).vertical.v)).toBeLessThan(1e-12);
      expect(off(unitLoad(plane, 0).theta, out.bearings[0].thetaVertical)).toBeLessThan(1e-12);
      expect(off(unitLoad(plane, L).theta, out.bearings[1].thetaVertical)).toBeLessThan(1e-12);
    }

    // As a visitor enters it: journals of 1.5 in over the end quarters, 2 in over the middle half. The stiffness
    // goes as the fourth power of the diameter: n = (2 ÷ 1.5)⁴ = 256/81 = 3.1605, and EI is that of the 1.5 in ends,
    // 29,000,000 × π × 1.5⁴ ÷ 64 = 7,206,642 lbf·in².
    const n = (2 / 1.5) ** 4;
    const ends = E * inertia(1.5);
    expect(n).toBeCloseTo(256 / 81, 12);
    expect(printed(ends)).toBe('7,207,000');
    const form: ShaftForm = { ...formOf([[5, 1.5], [10, 2], [5, 1.5]], [0, L]), forces: [{ id: 4, x: 10, v: P, vDir: 'down', h: 0, hDir: 'towards' }], nextId: 5 };
    const out = solvedForm(form);
    // 8,000,000 × (1 + 7 ÷ 3.1605) ÷ (384 × 7,206,642) = 0.009294 in; 400,000 × (1 + 3 ÷ 3.1605) ÷ (64 × 7,206,642) = 0.00169 rad.
    expect(off(out.at(10).v, (P * L ** 3 * (1 + 7 / n)) / (384 * ends))).toBeLessThan(1e-12);
    expect(printed(out.at(10).v)).toBe('0.009294');
    for (const b of out.bearings) {
      expect(off(b.theta, (P * L ** 2 * (1 + 3 / n)) / (64 * ends))).toBeLessThan(1e-12);
      expect(printed(b.theta)).toBe('0.00169');
    }
    // The same shaft all of 1.5 in would deflect by PL³/48EI = 0.02313 in: the 2 in body takes it down to four tenths of that.
    expect(printed((P * L ** 3) / (48 * ends))).toBe('0.02313');
  });

  // The unit-load method of this file is held to the two closed forms that
  // need no symmetry before it is trusted with the example further down.
  it('the unit-load method written here gives the tables’ own answers: a force anywhere on a span, and a force on an overhang', () => {
    // A force P at a from the left bearing and b from the right: Pab(L + b)/(6LEI) is the slope at the left bearing, clockwise;
    // Pa²b²/(3LEI) the deflection under the force.
    const [a, b] = [7, 13];
    const span: Plane = { segments: [{ L, EI }], bearings: [0, L], forces: [{ x: a, P }] };
    expect(off(unitLoad(span, 0).theta, (-P * a * b * (L + b)) / (6 * L * EI))).toBeLessThan(1e-13);
    expect(off(unitLoad(span, a).v, (-P * a ** 2 * b ** 2) / (3 * L * EI))).toBeLessThan(1e-13);
    // The overhang of the second case: Pa²(L + a)/(3EI) under the force, PaL/(3EI) the slope over the near bearing.
    const c = 6;
    const hung: Plane = { segments: [{ L: L + c, EI }], bearings: [0, L], forces: [{ x: L + c, P }] };
    expect(off(unitLoad(hung, L + c).v, (-P * c ** 2 * (L + c)) / (3 * EI))).toBeLessThan(1e-13);
    expect(off(unitLoad(hung, L).theta, (-P * c * L) / (3 * EI))).toBeLessThan(1e-13);
    // An applied moment C, counter-clockwise, on the left bearing: that end turns by CL/(3EI) the way it is turned, the far one by CL/(6EI) the other way.
    const C = 5000;
    const turned: Plane = { segments: [{ L, EI }], bearings: [0, L], moments: [{ x: 0, C }] };
    expect(off(unitLoad(turned, 0).theta, (C * L) / (3 * EI))).toBeLessThan(1e-13);
    expect(off(unitLoad(turned, L).theta, (-C * L) / (6 * EI))).toBeLessThan(1e-13);
    // The shaft's own weight w per length: 5wL⁴/(384EI) at the middle.
    const heavy: Plane = { segments: [{ L, EI, w: 0.9 }], bearings: [0, L] };
    expect(off(unitLoad(heavy, L / 2).v, (-5 * 0.9 * L ** 4) / (384 * EI))).toBeLessThan(1e-13);
  });

  // The four cases close the method, each a paragraph of its own, after the
  // line that says what they have in common.
  const FORMS = [
    ['P/2', 'PL³/(48EI)', 'PL²/(16EI)'],
    ['P(L + a)/L', 'Pa/L', 'Pa²(L + a)/(3EI)'],
    ['45°', 'P/√2', '1/√2'],
    ['nEI', 'PL³(1 + 7/n)/(384EI)', 'PL²(1 + 3/n)/(64EI)'],
  ];

  it('every one of them is on the page, as an engineer writes it, in both languages', () => {
    for (const lang of LANGS) {
      const paragraphs = shaftPage[lang].method.paragraphs;
      const cases = paragraphs.slice(-4);
      cases.forEach((p, i) => {
        for (const form of FORMS[i]) expect(p, `${lang} case ${i + 1}: ${form}`).toContain(form);
        // Read at a glance, not dug out of a sentence.
        expect(p.length, p).toBeLessThan(225);
      });
      // The line before them says what the four share: what L is, and the I of a solid round.
      expect(paragraphs.at(-5)).toBe(
        lang === 'en'
          ? 'To check the page by hand, four shafts with a closed form. L is the distance between the two bearings, and a shaft of one solid diameter D has I = πD⁴/64.'
          : 'Para comprobar la página a mano, cuatro ejes con fórmula cerrada. L es la distancia entre los dos cojinetes, y un eje de un solo diámetro macizo D tiene I = πD⁴/64.',
      );
      // A minus sign would be a minus sign, not a hyphen — and no case has one: every value given is a size.
      for (const p of cases) expect(p, p).not.toMatch(/(^|[\s:;,])[-−]\w/);
    }
  });

  // A formula found somewhere in its paragraph says nothing of the bearing
  // it belongs to, nor of what it is the formula of. Turned round — the
  // larger reaction at the far bearing, the slope under the force — each
  // of these clauses would still hold its formulas.
  it('each formula is said of the right thing: which bearing, which way, where', () => {
    const [en, es] = LANGS.map((lang) => shaftPage[lang].method.paragraphs.slice(-4));
    expect(en[0]).toContain('each reaction P/2; deflection under the force PL³/(48EI); slope at each bearing PL²/(16EI).');
    expect(es[0]).toContain('cada reacción P/2; deflexión bajo la fuerza PL³/(48EI); giro en cada cojinete PL²/(16EI).');
    expect(en[1]).toContain('a force P on an overhang, a beyond one bearing: that bearing carries P(L + a)/L, the other Pa/L the opposite way; moment Pa at the near bearing; deflection under the force Pa²(L + a)/(3EI).');
    expect(es[1]).toContain('una fuerza P en un voladizo, separada a de un cojinete: ese cojinete recibe P(L + a)/L y el otro Pa/L en sentido contrario; momento Pa en el cojinete cercano; deflexión bajo la fuerza Pa²(L + a)/(3EI).');
    expect(en[2]).toContain('each plane carries P/√2 and gives 1/√2 of that deflection and slope; the resultants are the first case’s, whole.');
    expect(es[2]).toContain('cada plano recibe P/√2 y da 1/√2 de aquella deflexión y de aquel giro; las resultantes son las del primer caso, enteras.');
    expect(en[3]).toContain('its middle half of stiffness nEI and its two end quarters of EI: deflection under the force PL³(1 + 7/n)/(384EI); slope at each bearing PL²(1 + 3/n)/(64EI).');
    expect(es[3]).toContain('con rigidez nEI en su mitad central y EI en sus dos cuartos extremos: deflexión bajo la fuerza PL³(1 + 7/n)/(384EI); giro en cada cojinete PL²(1 + 3/n)/(64EI).');
  });
});

/* THE EXAMPLE, which the page opens with and the method points at: a steel
   countershaft of 23 in, turned 1.5 in over its first 4 in, 2 in over the
   next 10, 1.5 in over 4 more and 1.25 in over the last 5; bearings 2 in and
   16 in from the left end; a gear at 9 in pushing 1,000 lbf down and 360 lbf
   towards the viewer; a pulley at 21 in pulled 400 lbf down. */
const EXAMPLE = defaultShaft();

describe('shaft on bearings: what the method says, the engine does', () => {
  const example = solvedForm(EXAMPLE);
  const { model } = toEngine(EXAMPLE);

  it('the example is the shaft the notes are checked on', () => {
    expect(EXAMPLE.segments.map((s) => [s.L, s.d, s.bore])).toEqual([[4, 1.5, 0], [10, 2, 0], [4, 1.5, 0], [5, 1.25, 0]]);
    expect(EXAMPLE.bearings).toEqual([2, 16]);
    expect(EXAMPLE.forces.map((f) => [f.x, f.v, f.vDir, f.h, f.hDir])).toEqual([[9, 1000, 'down', 360, 'towards'], [21, 400, 'down', 0, 'towards']]);
    expect([EXAMPLE.units, EXAMPLE.material, EXAMPLE.E, EXAMPLE.ownWeight, EXAMPLE.couples.length]).toEqual(['us', 'steel', 29000, false, 0]);
    expect(example.L).toBe(23);
  });

  // "In each, the two bearings are simple supports and the loads are that
  // plane's components … the two reactions follow from the two equations of
  // equilibrium, and the shear and the bending moment at a section from the
  // forces on one side of it."
  it('each plane by its own two equations of equilibrium: the example by hand', () => {
    const [A, B] = example.bearings;
    // Vertical plane, moments about the left bearing, the bearings 14 in apart: 14·R = 1,000 × 7 + 400 × 19 = 14,600.
    expect(B.vertical).toBeCloseTo(14600 / 14, 9);
    expect(A.vertical).toBeCloseTo(1400 - 14600 / 14, 9);
    expect([printed(A.vertical), printed(B.vertical)]).toEqual(['357.1', '1,043']);
    // Horizontal plane: the gear alone, midway between the bearings — 180 lbf at each.
    expect([A.horizontal, B.horizontal]).toEqual([expect.closeTo(180, 9), expect.closeTo(180, 9)]);
    // Each plane's reactions carry that plane's loads and nothing else: 1,400 lbf down, 360 lbf towards the viewer.
    expect(A.vertical + B.vertical).toBeCloseTo(1400, 9);
    expect(A.horizontal + B.horizontal).toBeCloseTo(360, 9);
    expect(example.totalLoad).toEqual({ vertical: 1400, horizontal: 360 });
    // The moment at the gear from the forces to its left: the left reaction, 7 in away. 357.14 × 7 = 2,500 and 180 × 7 = 1,260 lbf·in.
    expect(example.at(9).vertical.M).toBeCloseTo(2500, 9);
    expect(example.at(9).horizontal.M).toBeCloseTo(1260, 9);
    // …and at the right bearing from the forces to its RIGHT: the pulley, 5 in away, hogging.
    expect(example.at(16).vertical.M).toBeCloseTo(-400 * 5, 9);
    // The shear between the gear and the right bearing: the left reaction less the gear's force, 357.14 − 1,000 = −642.9 lbf.
    expect(example.at(12).vertical.V).toBeCloseTo(A.vertical - 1000, 9);
    expect(printed(example.at(12).vertical.V)).toBe('-642.9');
    // This file's own statics say the same of both planes, everywhere.
    const planes = planesOf(model);
    for (const x of [0.5, 3, 6.25, 9, 11, 15.5, 17, 19.75, 22]) {
      expect(example.at(x).vertical.M).toBeCloseTo(staticsOf(planes.vertical).M(x), 8);
      expect(example.at(x).horizontal.M).toBeCloseTo(staticsOf(planes.horizontal).M(x), 8);
    }
  });

  // "The diameters do not enter any of these, except through the weight of
  // the shaft."
  it('the diameters change no reaction, shear or moment — until the shaft’s own weight is a load', () => {
    const thick: ShaftForm = { ...EXAMPLE, segments: EXAMPLE.segments.map((s) => ({ ...s, d: 2 * s.d })) };
    const other = solvedForm(thick);
    expect(other.bearings.map((b) => [b.vertical, b.horizontal])).toEqual(example.bearings.map((b) => [b.vertical, b.horizontal]));
    for (const x of [1, 5.5, 9, 13, 16, 20.5]) {
      expect([other.at(x).vertical.V, other.at(x).vertical.M, other.at(x).horizontal.V, other.at(x).horizontal.M]).toEqual([example.at(x).vertical.V, example.at(x).vertical.M, example.at(x).horizontal.V, example.at(x).horizontal.M]);
    }
    // …and every slope and deflection is another: twice the diameter is sixteen times the stiffness.
    expect(off(other.extremes.v.value, example.extremes.v.value / 16)).toBeLessThan(1e-12);
    expect(off(other.bearings[0].theta, example.bearings[0].theta / 16)).toBeLessThan(1e-12);
    // With its own weight the shaft carries more, and how much more depends on its diameters.
    const heavy = solvedForm({ ...EXAMPLE, ownWeight: true });
    const heavier = solvedForm({ ...thick, ownWeight: true });
    expect(heavy.bearings[0].vertical).toBeGreaterThan(example.bearings[0].vertical);
    expect(heavier.bearings[0].vertical).toBeGreaterThan(heavy.bearings[0].vertical);
    // In the vertical plane only: the horizontal reactions are what they were.
    expect(heavy.bearings.map((b) => b.horizontal)).toEqual(example.bearings.map((b) => b.horizontal));
    for (const lang of LANGS) {
      expect(shaftPage[lang].method.paragraphs[0]).toMatch(lang === 'en' ? /The diameters do not enter any of these, except through the weight of the shaft\.$/ : /Los diámetros no entran en nada de esto, salvo por el peso del eje\.$/);
    }
  });

  // "…of every force, of every applied moment and, in the vertical plane,
  // the shaft's own weight where it is counted."
  it('a plane carries its own components and no other: a force, an applied moment, and the weight in the vertical one', () => {
    const bare = formOf([[20, 2]], [0, 20]);
    // An applied moment in the horizontal plane alone: 600 lbf·in over 20 in is 30 lbf at each bearing, one each way — and nothing in the vertical plane.
    const turned = solvedForm({ ...bare, couples: [{ id: 2, x: 10, v: 0, vDir: 'ccw', h: 600, hDir: 'ccw' }], nextId: 3 });
    expect(turned.bearings.map((b) => b.vertical)).toEqual([0, 0]);
    expect(turned.bearings.map((b) => b.horizontal)).toEqual([expect.closeTo(30, 9), expect.closeTo(-30, 9)]);
    // A force in the vertical plane alone leaves the horizontal one empty.
    const pushed = solvedForm({ ...bare, forces: [{ id: 2, x: 5, v: 800, vDir: 'down', h: 0, hDir: 'towards' }], nextId: 3 });
    expect(pushed.bearings.map((b) => b.horizontal)).toEqual([0, 0]);
    expect(pushed.stations.every((s) => s.horizontal.M === 0 && s.horizontal.v === 0)).toBe(true);
    // The weight alone: all of it in the vertical plane, half at each bearing of a shaft that is the same from end to end.
    const heavy = solvedForm({ ...bare, ownWeight: true });
    const weight = 0.2836 * ((Math.PI * 2 ** 2) / 4) * 20;
    expect(heavy.totalLoad.vertical).toBeCloseTo(weight, 9);
    expect(heavy.totalLoad.horizontal).toBe(0);
    expect(heavy.bearings.map((b) => [b.vertical, b.horizontal])).toEqual([[expect.closeTo(weight / 2, 9), 0], [expect.closeTo(weight / 2, 9), 0]]);
  });

  // "The shaft is cut at every shoulder, bearing, force and applied moment,
  // and on each piece a plane's bending moment is one polynomial — a
  // straight line, or a parabola under the shaft's own weight".
  it('the shaft is cut at every shoulder, bearing, force and applied moment; between two cuts the moment is a straight line, or a parabola under the weight', () => {
    // The example: ends 0 and 23, shoulders 4, 14 and 18, bearings 2 and 16, forces 9 and 21.
    expect(example.breaks).toEqual([0, 2, 4, 9, 14, 16, 18, 21, 23]);
    // An applied moment is a cut of its own.
    const withMoment = solvedForm({ ...EXAMPLE, couples: [{ id: 7, x: 12, v: 500, vDir: 'ccw', h: 0, hDir: 'ccw' }], nextId: 8 });
    expect(withMoment.breaks).toEqual([0, 2, 4, 9, 12, 14, 16, 18, 21, 23]);
    // Between the gear and the next shoulder, 9 to 14 in: three points a stride apart — the middle one is the mean of the other two.
    const line = [10, 11.5, 13].map((x) => example.at(x));
    for (const plane of ['vertical', 'horizontal'] as const) expect(line[0][plane].M - 2 * line[1][plane].M + line[2][plane].M).toBeCloseTo(0, 9);
    // With the weight, the second difference is the weight per length times the stride squared, and the third is nothing: a parabola.
    const heavy = solvedForm({ ...EXAMPLE, ownWeight: true });
    const w = 0.2836 * ((Math.PI * 2 ** 2) / 4);
    const curve = [9.5, 10.5, 11.5, 12.5].map((x) => heavy.at(x).vertical.M);
    expect(curve[0] - 2 * curve[1] + curve[2]).toBeCloseTo(-w, 9);
    expect(-curve[0] + 3 * curve[1] - 3 * curve[2] + curve[3]).toBeCloseTo(0, 8);
    // …and only in the vertical plane: the horizontal one is still a straight line there.
    const flat = [9.5, 10.5, 11.5].map((x) => heavy.at(x).horizontal.M);
    expect(flat[0] - 2 * flat[1] + flat[2]).toBeCloseTo(0, 9);
  });

  // "…over one flexural stiffness EI, with I = π(D⁴ − d⁴)/64 for an outer
  // diameter D and a bore d." — and, of the stress, "Z = π(D⁴ − d⁴)/(32D)".
  it('a segment’s section is the round’s: I = π(D⁴ − d⁴)/64 and Z = π(D⁴ − d⁴)/(32D), solid or bored', () => {
    for (const [D, d] of [[2, 0], [1.5, 0], [3, 2], [50, 30], [1.25, 1.2]]) {
      const section = sectionOf({ d: D, bore: d })!;
      expect(off(section.I, inertia(D, d)), `I of ${D} / ${d}`).toBeLessThan(1e-13);
      expect(off(section.Z, modulus(D, d)), `Z of ${D} / ${d}`).toBeLessThan(1e-13);
    }
    // 3 in bored 2 in: I = π × (81 − 16) ÷ 64 = 3.191 in⁴ and Z = π × 65 ÷ 96 = 2.127 in³.
    expect([printed(sectionOf({ d: 3, bore: 2 })!.I), printed(sectionOf({ d: 3, bore: 2 })!.Z)]).toEqual(['3.191', '2.127']);
    // The engine is given E × I and Z of each segment, the modulus the same for all of them ("a single modulus E for every segment").
    const given = toEngine({ ...EXAMPLE, segments: EXAMPLE.segments.map((s, i) => (i === 1 ? { ...s, bore: 1 } : s)) }).model.segments;
    expect(given.map((s, i) => off(s.EI / inertia(EXAMPLE.segments[i].d, i === 1 ? 1 : 0), E) < 1e-13)).toEqual([true, true, true, true]);
    expect(off(given[1].Z!, modulus(2, 1))).toBeLessThan(1e-13);
    for (const lang of LANGS) {
      expect(shaftPage[lang].method.paragraphs[1]).toContain(lang === 'en' ? 'with I = π(D⁴ − d⁴)/64 for an outer diameter D and a bore d.' : 'con I = π(D⁴ − d⁴)/64 para un diámetro exterior D y un diámetro interior d.');
      expect(shaftPage[lang].method.paragraphs[3]).toContain('Z = π(D⁴ − d⁴)/(32D)');
    }
  });

  // "Integrating M/EI once gives the slope, a cubic at most, and once more
  // the deflection, a quartic at most".
  it('the curvature is M/EI of the segment the point is in; the slope is its integral and the deflection the slope’s', () => {
    const heavy = solvedForm({ ...EXAMPLE, ownWeight: true });
    const EIs = toEngine(EXAMPLE).model.segments.map((s) => s.EI);
    for (const [out, name] of [[example, 'the example'], [heavy, 'with its weight']] as const) {
      // One point inside each segment, away from every cut.
      for (const x of [1.1, 6.3, 11.7, 15.2, 17.1, 19.4, 22.2]) {
        const here = out.at(x);
        const step = 0.02;
        const [before, after] = [out.at(x - step), out.at(x + step)];
        const top = out.extremes;
        for (const plane of ['vertical', 'horizontal'] as const) {
          // The second difference of the deflection is the curvature, and M/EI is that: of THIS segment's EI.
          const curvature = (before[plane].v - 2 * here[plane].v + after[plane].v) / step ** 2;
          expect(Math.abs(curvature - here[plane].M / EIs[here.segment]) / (top.M.value / EIs[here.segment]), `${name}, ${plane} at ${x}`).toBeLessThan(1e-6);
          // The slope is how fast the deflection rises along the shaft: a hair to the right the shaft is higher by the slope times the hair.
          const rise = (after[plane].v - before[plane].v) / (2 * step);
          expect(Math.abs(rise - here[plane].theta) / top.theta.value, `${name}, ${plane} slope at ${x}`).toBeLessThan(1e-5);
        }
      }
    }
    // A cubic and no more, where there is no weight: the fourth difference of the deflection is nothing, and the third is the shear over EI.
    const v = [9.5, 10.5, 11.5, 12.5, 13.5].map((x) => example.at(x).vertical.v);
    const size = example.extremes.v.value;
    expect(Math.abs(v[0] - 4 * v[1] + 6 * v[2] - 4 * v[3] + v[4]) / size).toBeLessThan(1e-11);
    expect(off(-v[0] + 3 * v[1] - 3 * v[2] + v[3], example.at(11).vertical.V / EIs[1])).toBeLessThan(1e-8);
    // A quartic under the weight: the fourth difference is the weight per length over EI, and the fifth is nothing.
    const q = [9.25, 10, 10.75, 11.5, 12.25, 13].map((x) => heavy.at(x).vertical.v);
    const w = 0.2836 * ((Math.PI * 2 ** 2) / 4);
    expect(off(q[0] - 4 * q[1] + 6 * q[2] - 4 * q[3] + q[4], (-w * 0.75 ** 4) / EIs[1])).toBeLessThan(1e-4);
    for (const lang of LANGS) {
      expect(shaftPage[lang].method.paragraphs[1]).toContain(lang === 'en' ? 'Integrating M/EI once gives the slope, a cubic at most, and once more the deflection, a quartic at most' : 'Integrar M/EI una vez da el giro, a lo sumo una cúbica, y otra vez la deflexión, a lo sumo de cuarto grado');
    }
  });

  // "…closed forms, written out term by term and evaluated where they are
  // asked for, with no numerical integration and no interpolation."
  it('a value is the formula at the point asked for: at places that are no point of the drawing, the closed form itself', () => {
    const [L, P, D] = [20, 1000, 2];
    const EI = E * inertia(D);
    const out = solved({ segments: [round(L, D)], bearings: [0, L], forces: [{ x: L / 2, v: P, h: 0 }] });
    const stations = new Set(out.stations.map((s) => s.x));
    // Left of the force: v = −Px(3L² − 4x²)/(48EI), θ = −P(L² − 4x²)/(16EI), M = Px/2.
    for (const x of [0.7310001, 3.3333331, 6.0000002, 8.7654321, 9.9990003]) {
      expect(stations.has(x), `${x} is a station`).toBe(false);
      const here = out.at(x).vertical;
      expect(off(here.v, (-P * x * (3 * L ** 2 - 4 * x ** 2)) / (48 * EI)), `v at ${x}`).toBeLessThan(1e-12);
      expect(off(here.theta, (-P * (L ** 2 - 4 * x ** 2)) / (16 * EI)), `θ at ${x}`).toBeLessThan(1e-9);
      expect(here.M).toBeCloseTo((P * x) / 2, 9);
    }
    // On the example, anywhere: the unit-load method of this file, which integrates nothing piece by piece.
    const planes = planesOf(toEngine(EXAMPLE).model);
    for (const x of [0, 1.234, 5.4321, 9, 12.3456, 16.5, 18, 20.202, 23]) {
      const here = example.at(x);
      for (const plane of ['vertical', 'horizontal'] as const) {
        const by = unitLoad(planes[plane], x);
        expect(Math.abs(here[plane].v - by.v) / example.extremes.v.value, `${plane} v at ${x}`).toBeLessThan(1e-12);
        expect(Math.abs(here[plane].theta - by.theta) / example.extremes.theta.value, `${plane} θ at ${x}`).toBeLessThan(1e-12);
      }
    }
  });

  // "Slope and deflection carry over unbroken from one piece into the next,
  // across a shoulder as across an applied moment, and the two constants of
  // integration are fixed by the deflection being zero at the two bearings."
  it('slope and deflection are one value on both sides of a shoulder and of an applied moment; the deflection is zero at each bearing', () => {
    const out = solvedForm({ ...EXAMPLE, couples: [{ id: 7, x: 12, v: 500, vDir: 'ccw', h: 250, hDir: 'cw' }], nextId: 8 });
    for (const x of [4, 12, 14, 18]) {
      const [left, right] = [out.at(x, 'left'), out.at(x, 'right')];
      for (const plane of ['vertical', 'horizontal'] as const) expect([left[plane].theta, left[plane].v], `${plane} at ${x}`).toEqual([right[plane].theta, right[plane].v]);
    }
    // What does jump: the moment at the applied moment, by its own size in each plane; the section, and so the stress, at a shoulder.
    expect(out.at(12, 'left').vertical.M - out.at(12, 'right').vertical.M).toBeCloseTo(500, 9);
    expect(out.at(12, 'left').horizontal.M - out.at(12, 'right').horizontal.M).toBeCloseTo(-250, 9);
    expect(out.at(18, 'left').sigma).not.toBe(out.at(18, 'right').sigma);
    // At each bearing: nothing, in either plane — not a small number.
    for (const shaft of [example, out]) {
      for (const b of shaft.bearings) expect([shaft.at(b.x).vertical.v, shaft.at(b.x).horizontal.v, shaft.at(b.x).v]).toEqual([0, 0, 0]);
    }
  });

  // "The resultant — the square root of the sum of the squares of the two
  // components — is taken of the shear, the bending moment, the slope and
  // the deflection alike … a bearing's radial load is the resultant of its
  // two reactions."
  it('the two planes together are the root of the sum of their squares: shear, moment, slope, deflection — and a bearing’s radial load', () => {
    for (const s of example.stations) {
      expect(s.V).toBe(Math.hypot(s.vertical.V, s.horizontal.V));
      expect(s.M).toBe(Math.hypot(s.vertical.M, s.horizontal.M));
      expect(s.theta).toBe(Math.hypot(s.vertical.theta, s.horizontal.theta));
      expect(s.v).toBe(Math.hypot(s.vertical.v, s.horizontal.v));
    }
    for (const b of example.bearings) {
      expect(b.radial).toBe(Math.hypot(b.vertical, b.horizontal));
      expect(b.theta).toBe(Math.hypot(b.thetaVertical, b.thetaHorizontal));
    }
    // By hand: √(357.14² + 180²) = 399.9 lbf and √(1,042.86² + 180²) = 1,058 lbf; at the gear √(2,500² + 1,260²) = 2,800 lbf·in.
    expect(example.bearings.map((b) => printed(b.radial))).toEqual(['399.9', '1,058']);
    expect(Math.sqrt((1400 - 14600 / 14) ** 2 + 180 ** 2)).toBeCloseTo(example.bearings[0].radial, 9);
    expect(printed(example.at(9).M)).toBe('2,800');
    expect(Math.sqrt(2500 ** 2 + 1260 ** 2)).toBeCloseTo(example.at(9).M, 9);
  });

  // "For a round section that is exact: its moment of inertia is the same
  // about every diameter, so the moments of the two planes are one moment
  // about one diameter."
  it('turned about its axis, with every load turned with it, the shaft has the same resultants everywhere: no direction is stiffer', () => {
    const turn = (m: ShaftModel, degrees: number): ShaftModel => {
      const [c, s] = [Math.cos((degrees * Math.PI) / 180), Math.sin((degrees * Math.PI) / 180)];
      const about = <T extends { v: number; h: number }>(load: T): T => ({ ...load, v: load.v * c - load.h * s, h: load.v * s + load.h * c });
      return { ...m, forces: (m.forces ?? []).map(about), couples: (m.couples ?? []).map(about) };
    };
    const loaded: ShaftModel = { ...model, couples: [{ x: 12, v: 700, h: -300 }] };
    const base = solved(loaded);
    for (const degrees of [17, 45, 90, 203]) {
      const out = solved(turn(loaded, degrees));
      for (const x of [0, 1.5, 4, 7.7, 9, 12, 13.3, 16, 18, 21.4, 23]) {
        for (const side of ['left', 'right'] as const) {
          const [p, q] = [out.at(x, side), base.at(x, side)];
          expect(Math.abs(p.V - q.V) / base.extremes.V.value, `V at ${x}, ${degrees}°`).toBeLessThan(1e-12);
          expect(Math.abs(p.M - q.M) / base.extremes.M.value, `M at ${x}, ${degrees}°`).toBeLessThan(1e-12);
          expect(Math.abs(p.theta - q.theta) / base.extremes.theta.value, `θ at ${x}, ${degrees}°`).toBeLessThan(1e-12);
          expect(Math.abs(p.v - q.v) / base.extremes.v.value, `v at ${x}, ${degrees}°`).toBeLessThan(1e-12);
          expect(Math.abs((p.sigma ?? 0) - (q.sigma ?? 0)) / base.extremes.sigma!.value, `σ at ${x}, ${degrees}°`).toBeLessThan(1e-12);
        }
      }
      expect(out.bearings.map((b, i) => off(b.radial, base.bearings[i].radial) < 1e-12 && off(b.theta, base.bearings[i].theta) < 1e-12)).toEqual([true, true]);
    }
    // The gear's two components as ONE force of √(1,000² + 360²) = 1,063 lbf in one plane: the moment under it is that force's, 1,063 × 7 ÷ 2 = 3,720 lbf·in with the pulley gone.
    const gear = Math.hypot(1000, 360);
    const [split, whole] = [{ x: 9, v: 1000, h: 360 }, { x: 9, v: gear, h: 0 }].map((force) => solved({ ...model, forces: [force] }));
    expect(off(split.at(9).M, whole.at(9).M)).toBeLessThan(1e-14);
    expect(whole.at(9).M).toBeCloseTo((gear * 7) / 2, 9);
    expect(off(split.extremes.v.value, whole.extremes.v.value)).toBeLessThan(1e-13);
  });

  // "The bending stress is the resultant moment over the section modulus of
  // the segment the section is in … At a shoulder the moment is one value
  // and the section is two, so the stress there is two values, the higher on
  // the side of the smaller modulus."
  it('the stress at a point is the resultant moment over that segment’s Z; at a shoulder it is two values, the higher on the side of the smaller modulus', () => {
    const Z = EXAMPLE.segments.map((s) => modulus(s.d));
    for (const x of [1, 3, 6.5, 9, 12, 15, 17, 20]) {
      const here = example.at(x);
      expect(off(here.sigma!, here.M / Z[here.segment]), `σ at ${x}`).toBeLessThan(1e-13);
    }
    // The shoulder at 18 in, 3 in from the pulley: 400 × 3 = 1,200 lbf·in on both sides of it.
    const [left, right] = [example.at(18, 'left'), example.at(18, 'right')];
    expect([left.M, right.M]).toEqual([expect.closeTo(1200, 9), expect.closeTo(1200, 9)]);
    expect([left.segment, right.segment]).toEqual([2, 3]);
    // Z = π × 1.5³ ÷ 32 = 0.3313 in³ on the left and π × 1.25³ ÷ 32 = 0.1917 in³ on the right: 3,622 and 6,258 lbf/in².
    expect([printed(Z[2]), printed(Z[3])]).toEqual(['0.3313', '0.1917']);
    expect([printed(left.sigma!), printed(right.sigma!)]).toEqual(['3,622', '6,258']);
    expect(right.sigma!).toBeCloseTo(1200 / ((Math.PI * 1.25 ** 3) / 32), 6);
    // The higher is on the side of the smaller modulus — at every shoulder of the example that carries a moment.
    for (const x of [4, 14, 18]) {
      const [l, r] = [example.at(x, 'left'), example.at(x, 'right')];
      expect(l.sigma! > r.sigma!, `at ${x}`).toBe(Z[l.segment] < Z[r.segment]);
    }
    for (const lang of LANGS) {
      expect(shaftPage[lang].method.paragraphs[3]).toContain(lang === 'en' ? 'so the stress there is two values, the higher on the side of the smaller modulus.' : 'así que el esfuerzo tiene allí dos valores, el mayor del lado del módulo menor.');
    }
  });

  // "Each segment is given the largest moment within its own length over its
  // own modulus, and the largest stress on the shaft is the largest of
  // those: it may be at a shoulder, far from the largest moment, as in the
  // example the page opens with."
  it('each segment has the largest moment within it over its own Z; the shaft’s largest stress is the largest of those — in the example at a shoulder, 9 in from the largest moment', () => {
    const Z = EXAMPLE.segments.map((s) => modulus(s.d));
    // By hand, segment by segment. The first ends at 4 in, 2 in past the left bearing: 399.94 × 2 = 799.9 lbf·in. The second holds the
    // gear: 2,800. The third holds the right bearing: 2,000. The fourth starts 3 in from the pulley: 1,200.
    expect(example.segments.map((s) => printed(s.M.value))).toEqual(['799.9', '2,800', '2,000', '1,200']);
    expect(example.segments.map((s) => s.M.x)).toEqual([4, 9, 16, 18]);
    example.segments.forEach((s, i) => {
      expect(off(s.sigma!.value, s.M.value / Z[i]), `segment ${i + 1}`).toBeLessThan(1e-13);
      expect(s.sigma!.x).toBe(s.M.x);
      // No point of the segment has more: both sides of its ends, and every station inside.
      const inside = example.stations.filter((st) => st.segment === i);
      expect(Math.max(...inside.map((st) => st.M))).toBeLessThanOrEqual(s.M.value);
    });
    // In ksi, as the page shows a stress: 2.414, 3.565, 6.036 and 6.258.
    expect(example.segments.map((s) => printed(shownStress('us', s.sigma!.value)))).toEqual(['2.414', '3.565', '6.036', '6.258']);
    // The largest on the shaft is the last of them: on the 1.25 in side of the shoulder at 18 in — where the moment is 1,200 lbf·in, well under half the largest.
    expect(example.extremes.sigma).toEqual(example.segments[3].sigma);
    expect(example.extremes.sigma!.x).toBe(18);
    expect(example.extremes.M.x).toBe(9);
    expect(example.extremes.sigma!.x - example.extremes.M.x).toBe(9);
    expect(example.at(18).M / example.extremes.M.value).toBeLessThan(0.45);
    // At the largest moment itself the stress is little more than half the largest stress.
    expect(example.at(9).sigma! / example.extremes.sigma!.value).toBeLessThan(0.6);
    for (const lang of LANGS) {
      expect(shaftPage[lang].method.paragraphs[3]).toContain(lang === 'en' ? 'it may be at a shoulder, far from the largest moment, as in the example the page opens with.' : 'puede estar en un hombro, lejos del momento máximo, como en el ejemplo con que se abre la página.');
    }
  });

  // "The largest resultant is not, in general, where either plane's own
  // diagram peaks. On each piece the sum of the squares of the two planes'
  // values is a polynomial, and the largest moment, slope and deflection are
  // looked for at the sign changes of its derivative, and at the ends of the
  // pieces: each is the value at the place it is printed with, not the
  // largest of the points plotted."
  it('a largest resultant is where the sum of the two squares turns — between the two planes’ own peaks, and at no point of the drawing', () => {
    // One diameter on bearings 20 in apart: 1,000 lbf down at 5 in, 700 lbf towards the viewer at 13 in.
    const out = solved({ segments: [round(20, 2)], bearings: [0, 20], forces: [{ x: 5, v: 1000, h: 0 }, { x: 13, v: 0, h: 700 }] });
    const top = out.extremes.v;
    // Each plane's own deflection is largest elsewhere: the vertical one at 8.82 in, the horizontal one at 10.82 in.
    const own = [out.extremes.vertical.vMin.x, out.extremes.horizontal.vMin.x];
    expect(own.map((x) => printed(x))).toEqual(['8.82', '10.82']);
    expect(printed(top.x)).toBe('9.724');
    expect(top.x).toBeGreaterThan(own[0] + 0.5);
    expect(top.x).toBeLessThan(own[1] - 0.5);
    // There the derivative of v² + h² is nothing: v·θ of one plane undoes v·θ of the other.
    const here = out.at(top.x);
    expect(Math.abs(here.vertical.v * here.vertical.theta + here.horizontal.v * here.horizontal.theta) / (out.extremes.v.value * out.extremes.theta.value)).toBeLessThan(1e-12);
    // It is the value AT that place, and more than at any point the drawing is made of — none of which is that place.
    expect(here.v).toBe(top.value);
    expect(out.stations.some((s) => s.x === top.x)).toBe(false);
    expect(Math.max(...out.stations.map((s) => s.v))).toBeLessThan(top.value);
    // …nor does a sampling a hundred times finer find more.
    for (let i = 0; i <= 24000; i++) expect(out.at((20 * i) / 24000).v).toBeLessThanOrEqual(top.value);
    // The largest moment of that shaft is at the end of a piece — under the first force, where the diagram has a corner.
    expect(out.extremes.M.x).toBe(5);
    // Inside a piece, with the weight of the shaft and a small force across it: where M·V of one plane undoes M·V of the other.
    const w = 0.2836 * ((Math.PI * 2 ** 2) / 4);
    const heavy = solved({ segments: [{ ...round(40, 2), w }], bearings: [0, 40], forces: [{ x: 31, v: 0, h: 5 }] });
    const peak = heavy.extremes.M;
    // The weight's own moment peaks at the middle, 20 in; the force's at the force, 31 in; the two together in between.
    expect([heavy.extremes.vertical.Mmax.x, heavy.extremes.horizontal.Mmax.x]).toEqual([20, 31]);
    expect(peak.x).toBeGreaterThan(20.05);
    expect(peak.x).toBeLessThan(30);
    const there = heavy.at(peak.x);
    expect(Math.abs(there.vertical.M * there.vertical.V + there.horizontal.M * there.horizontal.V) / (heavy.extremes.M.value * heavy.extremes.V.value)).toBeLessThan(1e-12);
    expect(there.M).toBe(peak.value);
    expect(heavy.stations.some((s) => s.x === peak.x)).toBe(false);
    expect(Math.max(...heavy.stations.map((s) => s.M))).toBeLessThan(peak.value);
    for (const lang of LANGS) {
      expect(shaftPage[lang].method.paragraphs[4]).toContain(lang === 'en' ? 'are looked for at the sign changes of its derivative, and at the ends of the pieces: each is the value at the place it is printed with, not the largest of the points plotted.' : 'se buscan en los cambios de signo de su derivada, y en los extremos de los trozos: cada uno es el valor en el punto con que se da, no el mayor de los puntos dibujados.');
    }
  });

  // The rest of the example, by the unit-load method of this file: the
  // numbers the page opens on.
  it('the example’s slopes and deflections, by the unit-load method: at each bearing, at each force, at the free end', () => {
    const planes = planesOf(model);
    const at = (x: number) => {
      const [v, h] = [unitLoad(planes.vertical, x), unitLoad(planes.horizontal, x)];
      return { theta: Math.hypot(v.theta, h.theta), v: Math.hypot(v.v, h.v) };
    };
    // The slope the shaft has in each bearing: 4.420 and 2.519 ten-thousandths of a radian.
    expect(example.bearings.map((b) => formatNumber(b.theta * 1e4, 4))).toEqual(['4.42', '2.519']);
    example.bearings.forEach((b) => expect(off(b.theta, at(b.x).theta)).toBeLessThan(1e-12));
    // Under the gear 0.001667 in, with a slope of 7.316 hundred-thousandths; under the pulley 0.003573 in and 0.001093 rad.
    expect([printed(example.at(9).v), formatNumber(example.at(9).theta * 1e5, 4)]).toEqual(['0.001667', '7.316']);
    expect([printed(example.at(21).v), printed(example.at(21).theta)]).toEqual(['0.003573', '0.001093']);
    for (const x of [9, 21]) {
      expect(off(example.at(x).v, at(x).v)).toBeLessThan(1e-12);
      expect(off(example.at(x).theta, at(x).theta)).toBeLessThan(1e-12);
    }
    // The largest deflection is at the free end past the pulley: 0.005751 in.
    expect(example.extremes.v.x).toBe(23);
    expect(printed(example.extremes.v.value)).toBe('0.005751');
    expect(off(example.extremes.v.value, at(23).v)).toBeLessThan(1e-12);
  });
});

describe('shaft on bearings: what the notes say of the tool, the tool does', () => {
  const example = solvedForm(EXAMPLE);

  // "A straight shaft of round section, solid or with a concentric bore. Its
  // diameters change at a point: each segment has one section from end to
  // end, with no taper and no fillet."
  it('a segment is a length, a diameter and a bore — one section from end to end; a bore takes stiffness away as the fourth power', () => {
    expect(Object.keys(EXAMPLE.segments[0]).sort()).toEqual(['L', 'bore', 'd', 'id']);
    // Inside a segment the stress follows the moment alone: one Z from one end to the other.
    const [p, q] = [example.at(5), example.at(13)];
    expect([p.segment, q.segment]).toEqual([1, 1]);
    expect(off(p.sigma! / p.M, q.sigma! / q.M)).toBeLessThan(1e-13);
    // The 2 in body bored 1 in: (2⁴ − 1⁴) ÷ 2⁴ = 15/16 of the stiffness. A shaft of one such section deflects 16/15 as much as the solid one.
    const one = (bore: number) => solvedForm({ ...formOf([[20, 2]], [0, 20]), segments: [{ id: 1, L: 20, d: 2, bore }], forces: [{ id: 2, x: 10, v: 1000, vDir: 'down', h: 0, hDir: 'towards' }], nextId: 3 });
    expect(off(one(1).at(10).v, (one(0).at(10).v * 16) / 15)).toBeLessThan(1e-13);
    // The most the form takes: eight segments — "up to eight", the form's own line says.
    expect(MAX_SEGMENTS).toBe(8);
    let form = EXAMPLE;
    for (let i = 0; i < 12; i++) form = reduceShaft(form, { type: 'add', list: 'segments' });
    expect(form.segments).toHaveLength(8);
    expect(shaftUi.en.shaft.limit).toBe('Eight at most.');
    expect(shaftUi.es.shaft.limit).toBe('Ocho como máximo.');
  });

  // "Two bearings, each a simple support at one point of the axis: it holds
  // the shaft against moving across its axis and does not give, and it lets
  // the shaft turn there."
  it('a bearing holds the shaft where it is and takes no moment: at a bearing on the end of the shaft the moment is nothing and the slope is not', () => {
    const out = solved({ segments: [round(20, 2)], bearings: [0, 20], forces: [{ x: 7, v: 1000, h: -400 }] });
    for (const b of out.bearings) {
      expect([out.at(b.x).vertical.M, out.at(b.x).horizontal.M]).toEqual([0, 0]);
      expect(out.at(b.x).v).toBe(0);
      expect(b.theta).toBeGreaterThan(1e-4);
    }
    // It does not give: ten times the load, and the bearings are still where they were.
    const pushed = solved({ segments: [round(20, 2)], bearings: [0, 20], forces: [{ x: 7, v: 10000, h: -4000 }] });
    expect(pushed.bearings.map((b) => pushed.at(b.x).v)).toEqual([0, 0]);
    // A moment applied ON a bearing goes into the shaft whole: the bearing takes none of it, only the force that balances it over the 20 in.
    const turned = solved({ segments: [round(20, 2)], bearings: [0, 20], couples: [{ x: 0, v: 6000, h: 0 }] });
    expect(turned.at(0, 'right').vertical.M).toBeCloseTo(-6000, 9);
    expect(turned.bearings.map((b) => b.vertical)).toEqual([expect.closeTo(300, 9), expect.closeTo(-300, 9)]);
    // Two of them, and the form holds no third.
    expect(EXAMPLE.bearings).toHaveLength(2);
    expect(decodeShaft(encodeShaft(EXAMPLE))!.bearings).toEqual([2, 16]);
    for (const lang of LANGS) {
      expect(shaftPage[lang].assumes.items[2]).toBe(
        lang === 'en'
          ? 'Two bearings, each a simple support at one point of the axis: it holds the shaft against moving across its axis and does not give, and it lets the shaft turn there.'
          : 'Dos cojinetes, cada uno un apoyo simple en un punto del eje: impide que el eje se desplace de través y no cede, y lo deja girar allí.',
      );
    }
  });

  // "Small deflections, and bending alone (Euler–Bernoulli): the shear force
  // adds nothing to the deflection." — and, under the limits, "No shear
  // deformation, which a short, thick shaft has more of".
  it('the deflection is bending’s alone: a shaft as thick as it is long still deflects by PL³/(48EI), with nothing added for shear', () => {
    const [L, D, P] = [2, 2, 1000];
    const out = solved({ segments: [round(L, D)], bearings: [0, L], forces: [{ x: L / 2, v: P, h: 0 }] });
    expect(off(out.at(L / 2).v, (P * L ** 3) / (48 * E * inertia(D)))).toBeLessThan(1e-12);
    // What shear would add to it — PL/(4·κ·G·A), with G = E/2.6 and κ = 0.9 for a round — is more than twice that deflection on this shaft, and is nowhere in the result.
    const shear = (P * L) / (4 * 0.9 * (E / 2.6) * ((Math.PI * D ** 2) / 4));
    expect(shear / out.at(L / 2).v).toBeGreaterThan(2);
    expect(shaftPage.en.assumes.items[3]).toContain('the shear force adds nothing to the deflection');
    expect(shaftPage.es.assumes.items[3]).toContain('la fuerza cortante no añade nada a la deflexión');
  });

  // "Loads across the axis only: forces and moments applied at points, and
  // the weight of the shaft where it is counted. No axial force and no
  // torque is carried; a gear's axial force is entered as the moment it
  // makes at the gear's radius." — and, under the limits, "No torsion. A
  // torque is not entered".
  it('a load is a force or an applied moment, by its two components: the form has nowhere to enter an axial force, a torque or a speed', () => {
    const form = { ...EXAMPLE, couples: reduceShaft(EXAMPLE, { type: 'add', list: 'couples' }).couples };
    expect(Object.keys(form.forces[0]).sort()).toEqual(['h', 'hDir', 'id', 'v', 'vDir', 'x']);
    expect(Object.keys(form.couples[0]).sort()).toEqual(['h', 'hDir', 'id', 'v', 'vDir', 'x']);
    expect(Object.keys(form).sort()).toEqual(['E', 'bearings', 'couples', 'density', 'forces', 'material', 'nextId', 'ownWeight', 'segments', 'units']);
    // Twelve forces and twelve applied moments at most.
    expect(MAX_ROWS).toBe(12);
    // A helical gear at 9 in pushed 200 lbf along the shaft at a pitch radius of 3 in: an applied moment of 600 lbf·in there. On bearings
    // 14 in apart that is 600 ÷ 14 = 42.86 lbf at each, one each way, and a step of 600 lbf·in in the moment diagram.
    const out = solvedForm({ ...EXAMPLE, forces: [], couples: [{ id: 7, x: 9, v: 200 * 3, vDir: 'ccw', h: 0, hDir: 'ccw' }], nextId: 8 });
    expect(out.bearings.map((b) => b.vertical)).toEqual([expect.closeTo(600 / 14, 9), expect.closeTo(-600 / 14, 9)]);
    expect(out.at(9, 'left').vertical.M - out.at(9, 'right').vertical.M).toBeCloseTo(600, 9);
    // The only stress the engine returns is the bending one: no shear stress of a torque beside it.
    expect(Object.keys(example.at(9)).sort()).toEqual(['M', 'V', 'horizontal', 'segment', 'sigma', 'theta', 'v', 'vertical', 'x']);
  });

  // "It is mechanics and nothing more: no design code, no factor on a load
  // or on a stress, no verdict."
  it('the loads are used as entered and the stress is the moment over the modulus: no factor is on either', () => {
    const given = toEngine(EXAMPLE).model;
    expect(given.forces).toEqual([{ x: 9, v: 1000, h: 360 }, { x: 21, v: 400, h: 0 }]);
    // The reactions of each plane add up to its loads, no more.
    expect(example.bearings[0].vertical + example.bearings[1].vertical).toBeCloseTo(1000 + 400, 9);
    expect(example.bearings[0].horizontal + example.bearings[1].horizontal).toBeCloseTo(360, 9);
    // σ × Z is the moment, at every point: nominal, with nothing raised at a shoulder.
    for (const s of example.stations) expect(Math.abs(s.sigma! * modulus(EXAMPLE.segments[s.segment].d) - s.M)).toBeLessThan(1e-9);
    for (const lang of LANGS) {
      expect(shaftPage[lang].limits.items[0]).toMatch(lang === 'en' ? /^It is mechanics and nothing more: no design code, no factor on a load or on a stress, no verdict\./ : /^Es mecánica y nada más: ninguna norma de diseño, ningún factor sobre una carga ni sobre un esfuerzo, ningún veredicto\./);
      expect(shaftPage[lang].limits.items[3]).toContain(lang === 'en' ? 'The stress is nominal — the moment over the modulus of the plain section —' : 'El esfuerzo es nominal — el momento entre el módulo de la sección lisa —');
    }
  });

  // "A segment under a millionth of the shaft's length, a segment more than
  // a million times as stiff as another, and two bearings within a
  // thousandth of that length of each other are not solved".
  it('the three limits the notes give are the engine’s: a millionth of the length, a million times the stiffness, a thousandth between the bearings', () => {
    expect([SHORT, STIFF, CLOSE]).toEqual([1e-6, 1e6, 1e-3]);
    const seg = (L: number, EI = 1e6) => ({ L, EI });
    const force = [{ x: 30, v: 1, h: 0 }];
    // A segment a millionth of a 100 in shaft is taken; a little under it is not, and it is the one named.
    expect(codesOf({ segments: [seg(1e-4), seg(100 - 1e-4)], bearings: [0, 100], forces: force })).toEqual([]);
    expect(codesOf({ segments: [seg(0.99e-4), seg(100 - 0.99e-4)], bearings: [0, 100], forces: force })).toEqual([['short-segment', 'segments', 0]]);
    // A million times as stiff is taken; a little over it is not, and both segments are named, the stiffer first.
    expect(codesOf({ segments: [seg(50, 1e6), seg(50, 1)], bearings: [0, 100], forces: force })).toEqual([]);
    expect(codesOf({ segments: [seg(50, 1), seg(50, 1.001e6)], bearings: [0, 100], forces: force })).toEqual([['stiffness', 'segments', 1], ['stiffness', 'segments', 0]]);
    // Bearings a thousandth of the shaft apart are taken; closer, or at one place, they are not.
    expect(codesOf({ segments: [seg(100)], bearings: [50, 50.1], forces: force })).toEqual([]);
    expect(codesOf({ segments: [seg(100)], bearings: [50, 50.099], forces: force })).toEqual([['bearings', 'bearings', 1]]);
    expect(codesOf({ segments: [seg(100)], bearings: [50, 50], forces: force })).toEqual([['bearings', 'bearings', 1]]);
    // What is taken at each limit is solved: the shaft is in equilibrium there.
    const close = solved({ segments: [seg(100)], bearings: [50, 50.1], forces: force });
    expect(close.bearings[0].vertical + close.bearings[1].vertical).toBeCloseTo(1, 6);
    // The form's own lines give the same three numbers, each in its own words.
    expect(shaftUi.en.issues['short-segment']).toContain('a millionth of the shaft');
    expect(shaftUi.es.issues['short-segment']).toContain('una millonésima del eje');
    expect(shaftUi.en.issues.bearings).toContain('one thousandth of the shaft’s length');
    expect(shaftUi.es.issues.bearings).toContain('la milésima parte de la longitud del eje');
    for (const lang of LANGS) {
      expect(shaftUi[lang].issues.stiffness).toContain('{max}');
      const line = shaftPage[lang].limits.items.filter((x) => (lang === 'en' ? /a millionth/ : /una millonésima/).test(x));
      expect(line).toHaveLength(1);
      expect(line[0]).toBe(
        lang === 'en'
          ? 'A segment under a millionth of the shaft’s length, a segment more than a million times as stiff as another, and two bearings within a thousandth of that length of each other are not solved: the entry is marked in the form, and the results are withheld.'
          : 'Un tramo de menos de una millonésima de la longitud del eje, un tramo con más de un millón de veces la rigidez de otro y dos cojinetes separados menos de una milésima de lo que mide el eje no se resuelven: el dato queda señalado en el formulario y los resultados no se dan.',
      );
    }
  });

  // "The shaft's own weight is a load only when you include it. Each segment
  // then weighs its density times its area of metal, a uniform load in the
  // vertical plane: the weight of a shaft that lies horizontal." — and, of
  // its units, "A density in lb/in³ is read as a weight, lbf/in³; one in
  // kg/m³ is multiplied by standard gravity, 9.80665 m/s²."
  it('own weight is a load only when included: each segment’s density times its area of metal, in the vertical plane — a bore weighs nothing', () => {
    expect(toEngine(EXAMPLE).model.segments.every((s) => !('w' in s))).toBe(true);
    const heavy = toEngine({ ...EXAMPLE, ownWeight: true }).model;
    // 0.2836 lb/in³ × π × 2² ÷ 4 = 0.891 lbf per inch of the 2 in body: the 10.69 lb/ft of a stock table.
    expect(heavy.segments.map((s) => printed(s.w!))).toEqual(['0.5012', '0.891', '0.5012', '0.348']);
    heavy.segments.forEach((s, i) => expect(off(s.w!, 0.2836 * ((Math.PI * EXAMPLE.segments[i].d ** 2) / 4))).toBeLessThan(1e-13));
    expect(printed(heavy.segments[1].w! * 12)).toBe('10.69');
    // The whole shaft: 0.5012 × 4 + 0.891 × 10 + 0.5012 × 4 + 0.348 × 5 = 14.66 lbf, on top of the 1,400 it carries — and none of it sideways.
    const out = solved(heavy);
    expect(printed(out.totalLoad.vertical - 1400)).toBe('14.66');
    expect(out.totalLoad.horizontal).toBe(360);
    // A bore takes its metal out of the weight: 2 in bored 1 in weighs three quarters of the solid bar.
    const bored = toEngine({ ...EXAMPLE, ownWeight: true, segments: EXAMPLE.segments.map((s, i) => (i === 1 ? { ...s, bore: 1 } : s)) }).model;
    expect(off(bored.segments[1].w!, 0.75 * heavy.segments[1].w!)).toBeLessThan(1e-13);
    // In millimetres and newtons: 7,850 kg/m³ × 9.80665 m/s² is 76,982 N/m³, and a 50 mm bar has 1,963.5 mm² — 0.1512 N per mm, 15.41 kg per metre.
    const si: ShaftForm = { ...EXAMPLE, units: 'si', segments: [{ id: 1, L: 500, d: 50, bore: 0 }], bearings: [0, 500], forces: [], E: 200000, density: 7850, ownWeight: true };
    const w = toEngine(si).model.segments[0].w!;
    expect(off(w, 7850 * 9.80665 * 1e-9 * ((Math.PI * 50 ** 2) / 4))).toBeLessThan(1e-13);
    expect([printed(w), printed((w * 1000) / 9.80665)]).toEqual(['0.1512', '15.41']);
    expect(TO_ENGINE.us.density).toBe(1);
    expect(TO_ENGINE.si.density).toBe(9.80665e-9);
    // The form's box says what the note says: the weight is INCLUDED, or it is not a load.
    expect(shaftUi.en.material.ownWeight).toBe('Include the shaft’s own weight');
    expect(shaftUi.es.material.ownWeight).toBe('Incluir el peso propio del eje');
    for (const lang of LANGS) {
      expect(shaftPage[lang].limits.items.at(-1)).toMatch(lang === 'en' ? /^The shaft’s own weight is a load only when you include it\./ : /^El peso propio del eje es una carga solo cuando usted lo incluye\./);
      expect(shaftPage[lang].signs.items.at(-1)).toContain('9.80665 m/s²');
    }
  });

  // "Every position is measured along the shaft from its left end" — and "A
  // force is a size in each plane with the way it points: down or up;
  // towards the viewer, who stands beside the shaft, or away from the
  // viewer." — and "An applied moment is a size in each plane with the way
  // it turns, counter-clockwise or clockwise".
  it('signs and places: a force is a size and a way in each plane, a position a distance from the left end', () => {
    const form: ShaftForm = {
      ...EXAMPLE,
      forces: [
        { id: 5, x: 9, v: 1000, vDir: 'down', h: 360, hDir: 'towards' },
        { id: 6, x: 21, v: 400, vDir: 'up', h: 150, hDir: 'away' },
      ],
      couples: [{ id: 7, x: 12, v: 500, vDir: 'ccw', h: 250, hDir: 'cw' }],
      nextId: 8,
    };
    const { model } = toEngine(form);
    // Down and towards the viewer are the engine's positive; up and away carry a minus. Counter-clockwise is positive, clockwise is not.
    expect(model.forces).toEqual([{ x: 9, v: 1000, h: 360 }, { x: 21, v: -400, h: -150 }]);
    expect(model.couples).toEqual([{ x: 12, v: 500, h: -250 }]);
    // Each is where it was typed, counted from the left end — and so are the bearings, whatever the segments are.
    const out = solved(model);
    expect(out.breaks).toEqual([0, 2, 4, 9, 12, 14, 16, 18, 21, 23]);
    expect(out.bearings.map((b) => b.x)).toEqual([2, 16]);
    // A downward force is carried by reactions that push up, and the shaft goes down under it: the vertical plane's "upward is positive".
    expect(example.bearings.every((b) => b.vertical > 0)).toBe(true);
    expect(example.at(9).vertical.v).toBeLessThan(0);
    // The upward force at 21 in lifts the shear by its 400 lbf across it; the one pointing away pushes the horizontal shear the other way from the gear's.
    expect(out.at(21, 'right').vertical.V - out.at(21, 'left').vertical.V).toBeCloseTo(400, 9);
    expect(out.at(21, 'right').horizontal.V - out.at(21, 'left').horizontal.V).toBeCloseTo(150, 9);
    expect(out.at(9, 'right').horizontal.V - out.at(9, 'left').horizontal.V).toBeCloseTo(-360, 9);
    // "A size entered with a minus sign acts the other way, for a force as for a moment." 400 lbf typed as −400 and pointed down is 400 lbf up;
    // 500 lbf·in typed as −500 and turned counter-clockwise is 500 clockwise — to the engine, the very same shaft.
    const minus: ShaftForm = { ...form, forces: [form.forces[0], { ...form.forces[1], v: -400, vDir: 'down', h: -150, hDir: 'towards' }], couples: [{ id: 7, x: 12, v: -500, vDir: 'cw', h: -250, hDir: 'ccw' }] };
    expect(toEngine(minus).model).toEqual(model);
    expect(shaftPage.en.signs.items[2]).toMatch(/A size entered with a minus sign acts the other way, for a force as for a moment\.$/);
    expect(shaftPage.es.signs.items[2]).toMatch(/Una magnitud escrita con signo menos actúa en el sentido contrario, tanto en una fuerza como en un momento\.$/);
    // The words for the two ways of a horizontal force are the form's own.
    const low = (t: string) => t.toLowerCase();
    expect(shaftPage.en.signs.items[1].replace(/the viewer/g, 'viewer')).toContain(`${low(shaftUi.en.forces.towards)}, who stands beside the shaft, or ${low(shaftUi.en.forces.away)}.`);
    expect(shaftPage.es.signs.items[1]).toContain(`${low(shaftUi.es.forces.towards)}, que está junto al eje, o ${low(shaftUi.es.forces.away)}.`);
    for (const lang of LANGS) {
      const t = beamStrings[lang].ui.loads;
      expect(shaftPage[lang].signs.items[1]).toContain(lang === 'en' ? `${low(t.down)} or ${low(t.up)};` : `${low(t.down)} o ${low(t.up)};`);
      expect(shaftPage[lang].signs.items[2]).toContain(lang === 'en' ? `${low(t.ccw)} or ${low(t.cw)}` : `${low(t.ccw)} u ${low(t.cw)}`);
    }
  });

  // "Both planes shows sizes: every value there is of the two planes together
  // and never negative" — and "The radial load of a bearing is its two
  // reactions taken together as one size; the slope there is its two slopes
  // taken the same way, in radians."
  it('the two planes together are sizes: no resultant is negative anywhere, whichever way the loads point', () => {
    const form: ShaftForm = { ...EXAMPLE, forces: EXAMPLE.forces.map((f) => ({ ...f, vDir: 'up', hDir: 'away' })) };
    for (const out of [example, solvedForm(form)]) {
      for (const s of out.stations) expect([s.V >= 0, s.M >= 0, s.theta >= 0, s.v >= 0, s.sigma! >= 0]).toEqual([true, true, true, true, true]);
      for (const b of out.bearings) expect([b.radial > 0, b.theta > 0]).toEqual([true, true]);
    }
    // In a plane they do have a sign: with every load turned round, each plane's reactions and deflections change theirs — and the sizes do not move.
    const turned = solvedForm(form);
    expect(turned.bearings.map((b) => b.vertical)).toEqual(example.bearings.map((b) => expect.closeTo(-b.vertical, 9)));
    expect(turned.bearings.map((b) => b.radial)).toEqual(example.bearings.map((b) => expect.closeTo(b.radial, 9)));
    expect(turned.at(23).vertical.v).toBeCloseTo(-example.at(23).vertical.v, 12);
    expect(turned.at(23).v).toBeCloseTo(example.at(23).v, 12);
    // The note names the view as the switch does.
    for (const lang of LANGS) expect(shaftPage[lang].signs.items.filter((x) => x.startsWith(`${shaftUi[lang].planes.both} `))).toHaveLength(1);
  });

  // "A deflection is the movement of the axis off the line that joins the
  // two bearings, and they do not move."
  it('a deflection is counted from the line through the two bearings: an unloaded shaft has none anywhere, and an overhang’s is not counted from its own bearing’s tangent', () => {
    const bare = solvedForm({ ...EXAMPLE, forces: [] });
    expect(bare.stations.every((s) => s.v === 0 && s.theta === 0)).toBe(true);
    // The free end of the example: what the tangent at the right bearing carries out over 7 in, and the bending of the overhang on top of it.
    const tangent = example.bearings[1].thetaVertical * 7;
    expect(Math.abs(example.at(23).vertical.v)).toBeGreaterThan(Math.abs(tangent));
    expect(example.at(23).vertical.v).toBeLessThan(tangent);
  });

  // "Lengths, diameters and deflections in inches or millimetres; forces in
  // pounds-force or newtons; moments in lbf·in or N·m; the modulus E and
  // every stress in ksi or MPa; slopes in radians in both systems."
  it('the units the notes name are the form’s own, in both systems', () => {
    expect([SHAFT_UNITS.us.length, SHAFT_UNITS.us.diameter, SHAFT_UNITS.us.deflection]).toEqual(['in', 'in', 'in']);
    expect([SHAFT_UNITS.si.length, SHAFT_UNITS.si.diameter, SHAFT_UNITS.si.deflection]).toEqual(['mm', 'mm', 'mm']);
    expect([SHAFT_UNITS.us.force, SHAFT_UNITS.si.force]).toEqual(['lbf', 'N']);
    expect([SHAFT_UNITS.us.moment, SHAFT_UNITS.si.moment]).toEqual(['lbf·in', 'N·m']);
    expect([SHAFT_UNITS.us.E, SHAFT_UNITS.us.stress, SHAFT_UNITS.si.E, SHAFT_UNITS.si.stress]).toEqual(['ksi', 'ksi', 'MPa', 'MPa']);
    expect([SHAFT_UNITS.us.slope, SHAFT_UNITS.si.slope]).toEqual(['rad', 'rad']);
    expect([SHAFT_UNITS.us.density, SHAFT_UNITS.si.density]).toEqual(['lb/in³', 'kg/m³']);
    // A moment the engine has in N·mm is shown in N·m, and a stress it has in lbf/in² in ksi.
    expect([shownMoment('si', 316307), shownMoment('us', 2800)]).toEqual([316.307, 2800]);
    expect([shownStress('us', 6258), shownStress('si', 43.15)]).toEqual([6.258, 43.15]);
    // The steel the example is made of, in each system.
    expect(SHAFT_MATERIALS.steel).toEqual({ us: { E: 29000, density: 0.2836 }, si: { E: 200000, density: 7850 } });
    expect(shaftPage.en.signs.items.at(-2)).toBe('Lengths, diameters and deflections in inches or millimetres; forces in pounds-force or newtons; moments in lbf·in or N·m; the modulus E and every stress in ksi or MPa; slopes in radians in both systems.');
    expect(shaftPage.es.signs.items.at(-2)).toBe('Longitudes, diámetros y deflexiones en pulgadas o milímetros; fuerzas en libras-fuerza o newtons; momentos en lbf·in o N·m; el módulo E y cada esfuerzo en ksi o MPa; giros en radianes en ambos sistemas.');
  });

  // The case travels after `#h=`: the first calculator keeps its beam after
  // `#b=`, the second after `#s=`, the third after `#c=`.
  it('the page’s case is kept after #h=, and comes back as the shaft that was sent', () => {
    expect(SHAFT_KEY).toBe('h');
    const edited: ShaftForm = { ...EXAMPLE, bearings: [3, 16], ownWeight: true };
    expect(decodeShaft(encodeShaft(edited))).toEqual(edited);
  });
});

describe('shaft on bearings: the words of its page', () => {
  const en = leaves(shaftPage.en);
  const es = leaves(shaftPage.es);
  const OTHERS = (lang: Lang) => [beamStrings[lang].page, spanPage[lang], continuousPage[lang]];

  it('says the same things in both languages, and leaves nothing blank', () => {
    expect(es.map(([p]) => p)).toEqual(en.map(([p]) => p));
    for (const [path, s] of [...en, ...es]) expect(s.trim().length, path).toBeGreaterThan(0);
    // The same things as the first calculator's page says of itself, part for part: one view prints all four.
    const parts = (page: unknown) => leaves(page).map(([p]) => p.replace(/\[\d+\]/g, '[]'));
    expect([...new Set(parts(shaftPage.en))]).toEqual([...new Set(parts(beamStrings.en.page))]);
  });

  it('the Spanish is Spanish: no sentence is the English one left in place', () => {
    const same = en.filter(([, s], i) => s === es[i][1] && s.split(/\s+/).length > 3).map(([path]) => path);
    expect(same).toEqual([]);
    // …and it writes no number with a grouping comma, which its reader takes for the decimal.
    for (const [path, s] of es) expect(s, path).not.toMatch(/\d,\d{3}(?!\d)/);
    // It speaks to "usted": no "tú" form of the verbs a note uses.
    for (const [path, s] of es) expect(s, path).not.toMatch(/\b(introduces|escribes|eliges|incluyes|pides|puedes|tienes|quieres|tu|tus|ti|te)\b/);
    // The formulas are the same in both: a case's symbols are not translated.
    const formulas = (s: string) => s.match(/P[A-Za-z²³⁴()+/ 0-9]*\/\(?\d*EI\)?|π\([^)]*\)\/\(?\d+D?\)?/g) ?? [];
    en.forEach(([path, s], i) => expect(formulas(es[i][1]), path).toEqual(formulas(s)));
  });

  it('names no other company’s product, no price, no date', () => {
    for (const [path, s] of [...en, ...es]) {
      expect(s, path).not.toMatch(/skyciv|quick design|clearcalcs|calcbook|enercalc|tedds|mitcalc|skf|timken|shigley/i);
      expect(s, path).not.toMatch(/\bfree\b|\bgratis\b|\bgratuit|\$|\bprice\b|\bprecio\b|\b20\d\d\b/i);
      // The firm's name is written with "and".
      expect(s, path).not.toMatch(/Civil\s*&\s*Structural/i);
    }
  });

  // Mechanics only. The page gives reactions, moments, slopes, deflections
  // and a nominal stress; whether they will do is the engineer's to say.
  it('gives numbers and no verdict, and quotes no limit as a rule', () => {
    for (const [path, s] of [...en, ...es].filter(([p]) => !LEGAL.test(p))) {
      expect(s, path).not.toMatch(/\b(ok|okay|pass|passes|passed|fail|fails|failed|adequate|inadequate|sufficient|insufficient|enough|acceptable|complies|satisf\w*|safe|unsafe|allowable|permissible|recommended)\b/i);
      expect(s, path).not.toMatch(/\b(cumple|cumplen|no cumple|falla|fallan|aprobad\w*|suficiente|insuficiente|adecuad\w*|inadecuad\w*|aceptable|basta|segur[oa]|satisf\w*|verifica|admisible|permisible|recomendad\w*)\b/i);
      expect(s, path).not.toMatch(/[✓✔✗✘]/);
    }
    // No slope a kind of bearing tolerates and no deflection a mesh allows is printed: the only small numbers on the page are its own two limits and g.
    const notes = (lang: Lang) => [...shaftPage[lang].method.paragraphs, ...shaftPage[lang].assumes.items, ...shaftPage[lang].limits.items, ...shaftPage[lang].signs.items].join(' ');
    for (const lang of LANGS) {
      expect(notes(lang)).not.toMatch(/\b0\.0\d+\b|\b\d+(\.\d+)?\s*(rad|mrad|°|′|arc|minutes?|minutos?)\b/);
      expect(notes(lang).match(/\d+\.\d+/g)).toEqual(['9.80665']);
    }
  });

  // A shaft is designed against more than bending. Each thing this page
  // leaves out has a line of its own, by name, in both languages.
  it('says what it is not, each by name: torsion, fatigue, a stress raiser, critical speed, bearing life, a third bearing, shear deformation, a bearing that resists turning', () => {
    const limits = (lang: Lang) => shaftPage[lang].limits.items;
    const NOT: [en: RegExp, es: RegExp][] = [
      [/^No torsion\./, /^Sin torsión\./],
      [/^No fatigue\./, /^Sin fatiga\./],
      [/^No stress raiser\. The stress is nominal/, /^Sin concentración de esfuerzos\. El esfuerzo es nominal/],
      [/^No critical speed and no vibration; and no bearing life/, /^Sin velocidad crítica ni vibraciones; y sin vida de cojinetes/],
      [/^Two bearings and no more\./, /^Dos cojinetes y no más\./],
      [/nor is a bearing that resists turning/, /tampoco un cojinete que impide el giro/],
      [/^No shear deformation/, /^Sin deformación por cortante/],
      [/a shoulder, a keyway, a groove or a press fit/, /un hombro, un chavetero, una ranura o un ajuste a presión/],
    ];
    for (const [inEnglish, inSpanish] of NOT) {
      expect(limits('en').filter((x) => inEnglish.test(x)), String(inEnglish)).toHaveLength(1);
      expect(limits('es').filter((x) => inSpanish.test(x)), String(inSpanish)).toHaveLength(1);
    }
    // Nine lines, in the same order in both.
    expect(limits('en')).toHaveLength(9);
    expect(limits('es')).toHaveLength(9);
  });

  // A shaft's page says "shaft". The other three calculators are about beams
  // and their words say so; none of this page's does.
  it('a shaft’s page says shaft: the word “beam” is nowhere in it, in either language', () => {
    for (const [path, s] of en) expect(s, path).not.toMatch(/\bbeams?\b/i);
    for (const [path, s] of es) expect(s, path).not.toMatch(/\bvigas?\b/i);
    expect(en.filter(([, s]) => /\bshafts?\b/i.test(s)).length).toBeGreaterThan(20);
    expect(es.filter(([, s]) => /\bejes?\b/i.test(s)).length).toBeGreaterThan(20);
  });

  // A disclaimer typed twice is corrected once. The page takes the first
  // calculator's — the very object — and so cannot differ from it by a word.
  it('the legal words are the first calculator’s own, not a copy of them', () => {
    for (const lang of LANGS) {
      const ours = shaftPage[lang];
      const first = beamStrings[lang].page;
      expect(ours.disclaimer).toBe(first.disclaimer);
      expect(ours.sheet.kind).toBe(first.sheet.kind);
      expect(ours.sheet.margin).toBe(first.sheet.margin);
    }
  });

  it('the credit of the printed sheet names this calculator, the firm and the address', () => {
    for (const lang of LANGS) {
      const credit = shaftPage[lang].sheet.credit;
      for (const key of ['{firm}', '{address}']) expect(credit, `${lang} ${key}`).toContain(key);
      for (const other of OTHERS(lang)) expect(credit).not.toBe(other.sheet.credit);
      expect(credit).toMatch(lang === 'en' ? /shaft calculator/ : /calculadora de ejes/);
    }
  });

  // Two pages that say one thing in the same words are, to a search engine,
  // one page twice — and now there are four. Everything this page says of
  // itself is compared with everything the other three say: their heroes,
  // their notes, their titles and descriptions, and their forms' own lines —
  // six words at a time.
  it('no sentence of the other three calculators’ pages is said again here, beyond the legal words', () => {
    for (const lang of LANGS) {
      const ours = leaves(shaftPage[lang]).filter(([path]) => !LEGAL.test(path));
      const theirs = [...OTHERS(lang).flatMap((page) => leaves(page)), ...leaves(beamStrings[lang].ui), ...leaves(spanUi[lang]), ...leaves(continuousUi[lang])].map(([, s]) => s);
      for (const [path, s] of ours) expect(sharedRuns([s], theirs), `${lang} ${path}`).toEqual([]);
      // The comparison can fail: the legal words, which ARE shared, are found by it.
      expect(sharedRuns([shaftPage[lang].disclaimer.body], theirs).length).toBeGreaterThan(20);
    }
  });

  // The catalogue's line for this calculator is the catalogue's, and no other
  // row's line is this page's either.
  it('no line of the catalogue is said again here', () => {
    const rows = calculatorFamilies.flatMap((f) => f.items);
    for (const lang of LANGS) {
      const ours = leaves(shaftPage[lang]).filter(([path]) => !LEGAL.test(path));
      for (const [path, s] of ours) expect(sharedRuns([s], rows.map((r) => r.does[lang])), `${lang} ${path}`).toEqual([]);
    }
  });

  // The page and the tool are written in two files, by two hands. Where the
  // notes speak of something the form has a field or a card for, they call
  // it what the form calls it — an engineer who reads "radial load" under
  // the tool looks for those words in it.
  it('the notes call the form’s fields and cards what the form calls them', () => {
    for (const lang of LANGS) {
      const s = shaftPage[lang];
      const w = shaftUi[lang];
      const t = beamStrings[lang].ui;
      const and = lang === 'en' ? 'and' : 'y';
      const low = (x: string) => x.toLowerCase();
      // The hero's three facts are the form's own names: the shaft's group, its two kinds of load, and what its first card gives for each bearing.
      expect(s.facts[0].k).toBe(w.shaft.title);
      expect(s.facts[1].v.startsWith(`${w.forces.title} ${and} ${low(t.loads.couple)}, `)).toBe(true);
      expect(low(s.facts[2].k)).toContain(low(w.bearings.name));
      expect(s.facts[2].v).toBe(`${w.results.radial} ${and} ${low(t.results.slope)}`);
      // …and the heading over the tool is that group's name, with its article.
      expect(low(s.toolHeading)).toContain(low(w.shaft.title));
      const notes = low([s.sub, ...s.method.paragraphs, ...s.assumes.items, ...s.limits.items, ...s.signs.items].join(' '));
      for (const word of [w.shaft.segment, w.shaft.bore, w.bearings.name, w.forces.name, t.row.names.couples, w.results.radial, t.results.slope, w.planes.vertical, w.planes.horizontal, w.planes.both, w.material.density]) {
        expect(notes, `${lang} ${word}`).toContain(low(word));
      }
      // A couple is the form's "applied moment", and a torque is no load of this page: in Spanish "par" is the torque, and only that.
      // (Read by letters, not by \b: to a plain \b the á of "parábola" ends a word.)
      expect(notes).not.toMatch(lang === 'en' ? /\bcouples?\b/ : /(?<!\p{L})par(es)?(?!\p{L})(?! de torsión)/u);
    }
    expect(shaftPage.es.limits.items.join(' ')).toContain('par de torsión');
  });

  // Neither says the other's sentences: what the form prints beside a field
  // is not printed again under the tool.
  it('no sentence of the form is said again in the notes, nor a sentence of the notes in the form', () => {
    for (const lang of LANGS) {
      const ours = leaves(shaftPage[lang]).filter(([path]) => !LEGAL.test(path));
      const form = leaves(shaftUi[lang]).map(([, s]) => s);
      expect(form.length).toBeGreaterThan(60);
      for (const [path, s] of ours) expect(sharedRuns([s], form), `${lang} ${path}`).toEqual([]);
    }
  });
});

/* The page, rendered. */

const SRC = resolve(__dirname, '..', '..', '..');
/** What a reader is shown of a piece of markup: no tags, no scripts, the page's own thin space as a space. */
const text = (html: string) =>
  html
    .replace(/<(script|style|noscript)\b[\s\S]*?<\/\1>/g, ' ')
    .replace(/<!-- -->/g, '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&')
    .replace(/&#x27;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/\s+/g, ' ')
    .trim();
const esc = (s: string) => renderToStaticMarkup(h('i', null, s)).slice(3, -4);
const attr = (tag: string, name: string) => tag.match(new RegExp(` ${name}="([^"]*)"`))?.[1];
/** The page as the layout serves it: header, footer and all. */
const render = (lang: Lang) => {
  route.pathname = localePath(SHAFT_PATH, lang);
  return renderToStaticMarkup(h(SiteChrome, null, h(ShaftView, { lang })));
};
const mainOf = (html: string) => html.match(/<main\b[\s\S]*<\/main>/)?.[0] ?? '';
/** A calculator's page WITHOUT its tool: the words that are the page's own. */
const around = (lang: Lang, path: string, page: CalculatorText) => {
  route.pathname = localePath(path, lang);
  // The line of the tool's frame is the form's (`linkOpening`), not the page's: left empty here.
  return renderToStaticMarkup(h(CalculatorPage, { lang, path, page, opening: '', children: null }));
};
/** The tool alone, with the words the view hands it, opened on a shaft that is not the example or in a view that is not both planes. */
const tool = (lang: Lang, initial?: ShaftForm, initialView?: 'vertical' | 'horizontal' | 'both') =>
  renderToStaticMarkup(h(ShaftCalculator, { t: sharedWords(beamStrings[lang].ui), w: shaftUi[lang], initial, initialView }));
/** This calculator's row of the catalogue. */
const ROW = calculatorFamilies.flatMap((f) => f.items).filter((x) => x.href === SHAFT_PATH);

/* The cards of numbers, read as a visitor reads them. A cell of the shaft's tables carries its column's head a second
   time, for a phone, out of sight and silent (`mp-shaft__head`, aria-hidden): it is taken out before the cell is read. */
const silent = (cell: string) => cell.replace(/<span class="mp-shaft__head" aria-hidden="true">(?:[^<]|<!-- -->|<span class="mp-plot__unit">(?:[^<]|<!-- -->)*<\/span>)*<\/span>/g, '');
const cardsOf = (html: string) => html.split(/<div class="mp-app__card(?: [^"]*)?">/).slice(1);
const cardOf = (html: string, title: string) => cardsOf(html).find((card) => card.includes(`<h3 class="mp-app__h">${esc(title)}</h3>`)) ?? '';
const titlesOf = (html: string) => [...html.matchAll(/<h3 class="mp-app__h">([\s\S]*?)<\/h3>/g)].map((m) => text(m[1]));
const cellsOf = (row: string) => [...row.matchAll(/<t[hd][^>]*>([\s\S]*?)<\/t[hd]>/g)].map((c) => text(silent(c[1])));
/** A card's table as rows of { head of the column: what the cell says }. */
const tableOf = (card: string): Record<string, string>[] => {
  const heads = cellsOf(card.match(/<thead\b[^>]*>[\s\S]*?<\/thead>/)?.[0] ?? '');
  const body = card.match(/<tbody\b[^>]*>[\s\S]*?<\/tbody>/)?.[0] ?? '';
  return [...body.matchAll(/<tr\b[^>]*>([\s\S]*?)<\/tr>/g)].map((r) => Object.fromEntries(cellsOf(r[1]).map((cell, i) => [heads[i], cell])));
};
/** A card's pairs of name and value; a value in two parts — "2 in just left, 1.5 in just right" — without the space a tag leaves before its comma. */
const pairsOf = (card: string) => Object.fromEntries([...card.matchAll(/<dt>([\s\S]*?)<\/dt><dd>([\s\S]*?)<\/dd>/g)].map((m) => [text(m[1]), text(m[2]).replace(/\s+,/g, ',')]));
/** Which rows of the form are marked as at fault, by the name of each. */
const markedRows = (html: string) => [...html.matchAll(/<div class="mp-app__item" role="group" aria-label="([^"]*)" data-invalid="true">/g)].map((m) => m[1]);

describe('shaft on bearings: what a search result shows', () => {
  // The rules of views/seo.test.ts, which reads every page of the sitemap.
  // Held here as well, so that this page's own test says what is wrong with
  // its own words.
  const words = (s: string) => (s.match(/[A-Za-zÁÉÍÓÚÜÑáéíóúüñ]{4,}/g) ?? []).map((w) => w.toLowerCase());
  const letters = (s: string) => s.toLowerCase().replace(/[^a-z0-9áéíóúüñ]/g, '');
  /* The shortest H1 the owner's on-page check let pass (seo.test.ts, H1_MIN). */
  const H1_MIN = 22;

  for (const lang of LANGS) {
    const s = shaftPage[lang];
    const meta = pageMeta(lang, SHAFT_PATH, { title: s.title, description: s.description });
    const title = (meta.title as { absolute: string }).absolute;
    const others = [beamStrings[lang].page, spanPage[lang], continuousPage[lang]];

    it(`${lang}: the title fits a search result (${titlePx(title)} px of ${TITLE_BUDGET_PX}), and repeats no word`, () => {
      expect(unmeasured(title)).toEqual([]);
      expect(titlePx(title)).toBeLessThanOrEqual(TITLE_BUDGET_PX);
      expect(repeatedWords(title)).toEqual([]);
      // What the page is called comes first and whole: the brand follows only where it fits.
      expect(title.startsWith(s.title)).toBe(true);
    });

    it(`${lang}: the description fits one (${descriptionPx(s.description)} px of ${DESCRIPTION_LIMIT_PX})`, () => {
      expect(unmeasured(s.description)).toEqual([]);
      expect(descriptionPx(s.description)).toBeLessThanOrEqual(DESCRIPTION_LIMIT_PX);
      expect(meta.description).toBe(s.description);
    });

    it(`${lang}: neither is another calculator’s, nor its own line in the catalogue`, () => {
      for (const other of others) expect(s.title).not.toBe(other.title);
      expect(ROW).toHaveLength(1);
      expect(sharedRuns([s.title, s.description], [...others.flatMap((o) => [o.title, o.description]), ROW[0].does[lang]])).toEqual([]);
    });

    it(`${lang}: the page declares its own address, with its twin, and may be indexed`, () => {
      expect(meta.alternates?.canonical).toBe(localePath(SHAFT_PATH, lang));
      expect(meta.alternates?.languages).toEqual({ en: SHAFT_PATH, es: `/es${SHAFT_PATH}`, 'x-default': SHAFT_PATH });
      expect(meta.robots).toBeUndefined();
    });

    it(`${lang}: one H1, long enough to say what the page is, in words the page uses — ${s.h1}`, () => {
      // As its route renders it: no header, no footer to lend it a word.
      route.pathname = localePath(SHAFT_PATH, lang);
      const html = renderToStaticMarkup(h(ShaftView, { lang }));
      const h1s = html.match(/<h1\b[\s\S]*?<\/h1>/g) ?? [];
      expect(h1s.map((x) => text(x))).toEqual([s.h1]);
      expect(s.h1.length).toBeGreaterThanOrEqual(H1_MIN);
      const body = new Set(words(text(html.replace(/<h1\b[\s\S]*?<\/h1>/g, ' '))));
      expect(words(s.h1).filter((w) => !body.has(w))).toEqual([]);
      // …and not only in the breadcrumb and the letterhead, which repeat it whole.
      const notes = new Set(words([s.sub, ...s.method.paragraphs, ...s.assumes.items].join(' ')));
      expect(words(s.h1).filter((w) => !notes.has(w))).toEqual([]);
    });

    // The lead's draft of the H1 had "two bearings" in it. The catalogue's row is "Shaft on bearings", and the page a
    // row opens begins with the words of that row's link (calculators.test.ts): the name is kept whole, and "two" is said
    // in the first line under it.
    it(`${lang}: the H1 is not the title over again, and begins with the name the catalogue gives it`, () => {
      expect(letters(s.h1)).not.toBe(letters(s.title));
      expect(ROW).toHaveLength(1);
      expect(s.h1.startsWith(ROW[0].name[lang])).toBe(true);
      expect(s.sub).toContain(lang === 'en' ? 'on two bearings' : 'sobre dos cojinetes');
    });
  }
});

describe('shaft on bearings: the page', () => {
  for (const lang of LANGS) {
    const html = render(lang);
    const main = mainOf(html);
    const s = shaftPage[lang];
    const t = beamStrings[lang].ui;
    const w = shaftUi[lang];
    const site = getContent(lang);
    /** A number as this page prints one, read as `text` reads the page. */
    const num = (value: number, figures = 4) => text(esc(formatNumber(value, figures, t.numbers.group)));
    const said = (line: string) => text(esc(line));

    it(`${lang}: one h1; the tool and the method are its two h2; the tables and the notes are h3`, () => {
      const heads = (n: number) => [...main.matchAll(new RegExp(`<h${n}\\b[^>]*>([\\s\\S]*?)</h${n}>`, 'g'))].map((m) => text(m[1]));
      expect(heads(1)).toEqual([s.h1]);
      expect(heads(2)).toEqual([s.toolHeading, s.method.title]);
      const h3 = heads(3);
      // The notes close the page, in this order; before them, the tool's five tables.
      expect(h3.slice(-4)).toEqual([s.assumes.title, s.limits.title, s.signs.title, s.disclaimer.title]);
      expect(h3.slice(0, -4)).toEqual([w.bearings.title, w.results.bySegment, w.results.atForces, t.results.maxima, t.results.point]);
      expect(main).not.toMatch(/<h[456]\b/);
    });

    // The numbers are redone here, by this file's own statics and its unit-load method, and written as the page writes
    // a number: what the server sends is held to them, cell by cell.
    it(`${lang}: the server sends the example solved — each bearing’s reactions, its radial load and its slope — and not an empty box`, () => {
      const planes = planesOf(toEngine(EXAMPLE).model);
      const [vertical, horizontal] = [staticsOf(planes.vertical), staticsOf(planes.horizontal)];
      const rows = tableOf(cardOf(main, w.bearings.title));
      const col = { x: `${t.results.position} (in)`, v: `${w.results.reactionV} (lbf)`, h: `${w.results.reactionH} (lbf)`, radial: `${w.results.radial} (lbf)`, slope: `${t.results.slope} (rad)` };
      expect(rows).toHaveLength(2);
      [
        { x: 2, RV: vertical.RA, RH: horizontal.RA },
        { x: 16, RV: vertical.RB, RH: horizontal.RB },
      ].forEach((b, i) => {
        const slope = Math.hypot(unitLoad(planes.vertical, b.x).theta, unitLoad(planes.horizontal, b.x).theta);
        expect(rows[i][col.x]).toBe(String(b.x));
        // A downward load is carried by a reaction that points up; one towards the viewer, by a reaction that points away.
        expect(rows[i][col.v]).toBe(`${num(b.RV)} ${t.results.upward}`);
        expect(rows[i][col.h]).toBe(`${num(b.RH)} ${w.results.away}`);
        expect(rows[i][col.radial]).toBe(num(Math.hypot(b.RV, b.RH)));
        expect(rows[i][col.slope]).toBe(num(slope));
      });
      // By hand: 357.1 and 1,043 lbf upward, 180 lbf each away from the viewer; radial loads 399.9 and 1,058 lbf; slopes 0.000442 and 0.0002519 rad.
      expect(rows.map((r) => r[col.radial])).toEqual([num(399.9), num(1058)]);
      expect(rows.map((r) => r[col.slope])).toEqual(['0.000442', '0.0002519']);
      // The line under them: each plane's loads, which its two reactions carry.
      expect(text(cardOf(main, w.bearings.title))).toContain(said(w.results.balance.replace('{vertical}', `${num(1400)} lbf ${t.results.downward}`).replace('{horizontal}', `${num(360)} lbf ${w.results.towards}`).replace(/\{unit\}/g, 'lbf')));
      // No problem is announced for the example.
      expect(main).toMatch(/<div class="mp-app__issues" role="alert" aria-live="assertive"><\/div>/);
    });

    // "…the largest stress on the shaft is the largest of those: it may be at a shoulder, far from the largest moment,
    // as in the example the page opens with."
    it(`${lang}: the example it opens with has its largest stress at a shoulder, 9 in from its largest moment — as the method says of it`, () => {
      const rows = tableOf(cardOf(main, w.results.bySegment));
      const col = { moment: `${w.results.largestMoment} (lbf·in)`, stress: `${w.results.stress} (ksi)`, Z: `${w.results.modulus} (in³)` };
      const at = (x: number) => `${t.results.at} x = ${x} in`;
      // Segment by segment: the largest moment within it and where, and that moment over its own section modulus, in ksi.
      const byHand = [
        { d: 1.5, M: 2 * Math.hypot(1400 - 14600 / 14, 180), x: 4 },
        { d: 2, M: Math.hypot(2500, 1260), x: 9 },
        { d: 1.5, M: 400 * 5, x: 16 },
        { d: 1.25, M: 400 * 3, x: 18 },
      ];
      expect(rows).toHaveLength(4);
      byHand.forEach((seg, i) => {
        expect(rows[i][col.Z]).toBe(num(modulus(seg.d)));
        expect(rows[i][col.moment]).toBe(`${num(seg.M)} ${at(seg.x)}`);
        expect(rows[i][col.stress]).toBe(num(seg.M / modulus(seg.d) / 1000));
      });
      expect(rows.map((r) => r[col.stress])).toEqual(['2.414', '3.565', '6.036', '6.258']);
      const largest = pairsOf(cardOf(main, t.results.maxima));
      expect(largest[t.results.moment]).toBe(`${num(2800)} lbf·in ${at(9)}`);
      // At a shoulder the place alone does not say which side: the card names the segment — the 1.25 in one.
      expect(largest[w.results.stress]).toBe(`6.258 ksi ${at(18)}, ${w.shaft.segment.toLowerCase()} 4`);
      expect(largest[t.results.deflection]).toBe(`0.005751 in ${at(23)}`);
      expect(largest[t.results.slope]).toBe(`0.001093 rad ${at(21)}`);
    });

    // The page every calculator shares names its tool's section after the
    // address: this one's heading is "shaft-on-bearings-tool". A section
    // labelled by an id that is not on the page has, for a screen reader, no
    // name at all.
    it(`${lang}: whatever labels or describes an element is on the page — the tool’s section by its own heading`, () => {
      const ids = new Set([...html.matchAll(/ id="([^"]+)"/g)].map((m) => m[1]));
      const refs = [...html.matchAll(/ aria-(?:labelledby|describedby)="([^"]+)"/g)].flatMap((m) => m[1].split(/\s+/));
      expect(refs).toContain('shaft-on-bearings-tool');
      expect(refs.filter((r) => !ids.has(r))).toEqual([]);
      expect(main).toMatch(/<section\b[^>]* aria-labelledby="shaft-on-bearings-tool"/);
      expect(text(main.match(/<h2 id="shaft-on-bearings-tool"[^>]*>([\s\S]*?)<\/h2>/)?.[1] ?? '')).toBe(s.toolHeading);
    });

    // What the notes describe is what the form offers: the shaft segment by
    // segment, two bearings, forces and applied moments by their two planes,
    // the weight to include — and three views, the two planes together as
    // the page opens.
    it(`${lang}: the form is the one the notes describe — segments, two bearings, forces and applied moments in two planes, three views`, () => {
      const groups = [...main.matchAll(/<div class="mp-app__item" role="group" aria-label="([^"]*)"/g)].map((m) => m[1]);
      expect(groups).toEqual([...[1, 2, 3, 4].map((n) => `${w.shaft.segment} ${n}`), ...[1, 2].map((n) => `${w.forces.name} ${n}`)]);
      const legends = [...main.matchAll(/<legend[^>]*>([\s\S]*?)<\/legend>/g)].map((m) => text(m[1]));
      expect(legends).toEqual(expect.arrayContaining([w.shaft.title, w.bearings.title, w.forces.title, t.loads.couple, w.view.title]));
      const labels = [...main.matchAll(/<label\b[^>]*>([\s\S]*?)<\/label>/g)].map((m) => text(m[1].replace(/<select\b[\s\S]*?<\/select>/g, '')));
      // Two bearings, and no way to add a third.
      expect(labels.filter((name) => name.startsWith(`${w.bearings.name} `))).toEqual([`${w.bearings.name} 1 in`, `${w.bearings.name} 2 in`]);
      const adds = [...main.matchAll(/<button type="button" class="mp-app__add"[^>]*>([\s\S]*?)<\/button>/g)].map((m) => text(m[1]).replace(/^\+\s*/, ''));
      expect(adds).toEqual([w.shaft.add, w.forces.add, t.loads.addCouple]);
      // A force: a size in each plane, each with the way it points.
      expect(labels.filter((name) => name === `${w.forces.vertical} lbf`)).toHaveLength(2);
      expect(labels.filter((name) => name === `${w.forces.horizontal} lbf`)).toHaveLength(2);
      const choices = [...main.matchAll(/<select\b[^>]*>([\s\S]*?)<\/select>/g)].map((m) => [...m[1].matchAll(/<option\b[^>]*>([\s\S]*?)<\/option>/g)].map((o) => text(o[1])));
      expect(choices.filter((c) => c.join() === [t.loads.down, t.loads.up].join())).toHaveLength(2);
      expect(choices.filter((c) => c.join() === [w.forces.towards, w.forces.away].join())).toHaveLength(2);
      // The three views, and the one the page opens in: both planes together.
      const views = [...main.matchAll(/<input type="radio" name="shaft-view"([^>]*)>\s*<span>([\s\S]*?)<\/span>/g)].map((m) => [text(m[2]), / checked/.test(m[1])]);
      expect(views).toEqual([[w.planes.vertical, false], [w.planes.horizontal, false], [w.planes.both, true]]);
      // The weight is the visitor's to include: the box is there, and not ticked; the density is asked for with it, and not before.
      const box = main.match(/<label class="mp-app__check">([\s\S]*?)<\/label>/)?.[1] ?? '';
      expect(text(box)).toBe(w.material.ownWeight);
      expect(box).not.toMatch(/ checked/);
      expect(labels.filter((name) => name.startsWith(w.material.density))).toEqual([]);
      // Nowhere to type a torque, a speed or an axial force: no field is named for one.
      expect(labels.filter((name) => /torque|torsi[oó]n|speed|velocidad|rpm|axial/i.test(name))).toEqual([]);
    });

    // The row of the catalogue that opens this page says what it computes in
    // one line. That line is the catalogue's: said again here, a search
    // engine has two pages with the same sentence.
    it(`${lang}: its line in the catalogue is not printed here, nor six words running of it — nor another calculator’s`, () => {
      const body = text(main);
      const rows = calculatorFamilies.flatMap((f) => f.items).filter((x) => x.href);
      // Every open row, whichever calculators they are: the site keeps that list once (calculator-paths.ts), as the
      // third calculator's test reads it, so that a calculator opened later is held off this page without this test being touched.
      expect(rows.map((x) => x.href)).toEqual([...openCalculatorPaths]);
      expect(rows.map((x) => x.href)).toEqual(expect.arrayContaining([BEAM_PATH, SPAN_PATH, CONTINUOUS_PATH, SHAFT_PATH]));
      for (const row of rows) {
        expect(wordsOf(row.does[lang]).length, row.name.en).toBeGreaterThan(6);
        expect(body, row.name.en).not.toContain(row.does[lang]);
        expect(sharedRuns([row.does[lang]], [body]), row.name.en).toEqual([]);
      }
    });

    it(`${lang}: every field has a name, and no button submits anything`, () => {
      const controls = [...main.matchAll(/<(input|select)\b[^>]*>/g)].map((m) => m[0]);
      expect(controls.length).toBeGreaterThan(20);
      const labelled = [...main.matchAll(/<label\b[^>]*>([\s\S]*?)<\/label>/g)];
      expect(labelled.reduce((n, m) => n + (m[1].match(/<(input|select)\b/g) ?? []).length, 0)).toBe(controls.length);
      for (const m of labelled) expect(text(m[1].replace(/<select\b[\s\S]*?<\/select>/g, '')).length, m[0].slice(0, 80)).toBeGreaterThan(0);
      for (const b of main.matchAll(/<button\b[^>]*>/g)) expect(attr(b[0], 'type'), b[0]).toBe('button');
    });

    it(`${lang}: the path home is Home, Resources, this page — in the breadcrumb and for search engines`, () => {
      const crumbs = main.match(/<ol class="mp-breadcrumbs">[\s\S]*?<\/ol>/)?.[0] ?? '';
      expect([...crumbs.matchAll(/<a\b([^>]*)>([\s\S]*?)<\/a>/g)].map((m) => [attr(m[1], 'href'), text(m[2])])).toEqual([
        [localePath('/', lang), site.ui.home],
        [localePath('/resources', lang), navLabelOf(site, '/resources')],
      ]);
      expect(text(crumbs.match(/<span aria-current="page">([\s\S]*?)<\/span>/)?.[1] ?? '')).toBe(s.h1);
      const ld = [...html.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)].map((m) => JSON.parse(m[1]));
      const list = ld.find((x) => x['@type'] === 'BreadcrumbList');
      expect(list.itemListElement.map((i: { item: string }) => i.item)).toEqual(['/', '/resources', SHAFT_PATH].map((p) => absoluteUrl(localePath(p, lang))));
      expect(list.itemListElement.map((i: { name: string }) => i.name)).toEqual([site.ui.home, navLabelOf(site, '/resources'), s.h1]);
    });

    it(`${lang}: says how it is solved, what it assumes, what it does not do — and on what terms`, () => {
      const body = text(main);
      for (const p of [s.eyebrow, s.sub, ...s.facts.flatMap((f) => [f.k, f.v]), s.toolHeading, s.method.label, s.method.title, ...s.method.paragraphs, ...s.assumes.items, ...s.limits.items, ...s.signs.items, s.disclaimer.title, s.disclaimer.body, s.back]) {
        expect(body, p.slice(0, 50)).toContain(said(p));
      }
      // The first paragraph of the method is its lead, as on the other calculators' pages.
      expect(main).toContain(`<p class="mp-lead">${esc(s.method.paragraphs[0])}</p>`);
      expect(html).toContain(`<noscript><p class="mp-app__noscript">${esc(s.noscript)}</p></noscript>`);
      // The form's own promise is the first calculator's, and holds here: nothing typed is sent.
      expect(body).toContain(t.results.privacy);
    });

    it(`${lang}: leads back to the catalogue, and nowhere outside the site — nor to another calculator, which has no use for a shaft`, () => {
      const hrefs = [...main.matchAll(/<a\b[^>]*href="([^"]*)"/g)].map((m) => m[1]);
      expect(hrefs.filter((x) => x === localePath('/resources', lang)).length).toBe(2);
      expect(hrefs.filter((x) => /^https?:|^tel:|^mailto:/.test(x))).toEqual([]);
      expect(hrefs.filter((x) => x.startsWith(`${localePath('/resources', lang)}/`))).toEqual([]);
    });

    // A shaft's page says "shaft" in the tool as well: the words the view
    // hands it are the pieces of the first calculator's set that say the
    // same on any calculator, and none of them is a sentence about a beam.
    it(`${lang}: nothing a visitor reads on it says “beam”: not the notes, not the tool, not the line for a link still to be opened`, () => {
      const beam = lang === 'en' ? /\bbeams?\b/i : /\bvigas?\b/i;
      expect(text(main)).not.toMatch(beam);
      for (const [path, words] of leaves(sharedWords(t))) expect(words, path).not.toMatch(beam);
      for (const [path, words] of leaves(w)) expect(words, path).not.toMatch(beam);
      // …and the first calculator's set, handed over whole, would have brought a dozen such sentences with the page.
      expect(leaves(t).filter(([, words]) => beam.test(words)).length).toBeGreaterThan(10);
    });

    it(`${lang}: every image says what it is, and only the footer lockup is read out`, () => {
      const tags = [...html.matchAll(/<img\b[^>]*>/g)].map((m) => m[0]);
      // The header's two marks, the letterhead's lockup and the footer's.
      expect(tags.length).toBeGreaterThanOrEqual(4);
      for (const tag of tags) expect(attr(tag, 'alt')?.trim(), tag).toBeTruthy();
      expect(tags.filter((tag) => attr(tag, 'aria-hidden') !== 'true').map((tag) => attr(tag, 'src'))).toEqual([site.company.logo.lockupLightSm]);
    });

    it(`${lang}: no call bar lies over the form on a phone, and beside the disclaimer are the site's terms`, () => {
      expect(html).not.toContain('mp-bar');
      expect(main).toContain(`href="${localePath('/terms', lang)}"`);
      // The static page carries the plain twin: there is no address to read on the server.
      expect(html).toContain(`href="${localePath(SHAFT_PATH, lang === 'en' ? 'es' : 'en')}"`);
    });
  }

  it('the two languages are the same page', () => {
    const shape = (lang: Lang) =>
      mainOf(render(lang))
        .replace(/>[^<]+</g, '><')
        .replace(/ (aria-label|title|placeholder|href|lang|d|points|x|y|x1|x2|y1|y2|cx|cy|r|rx|ry|width|height|transform|text-anchor|viewBox)="[^"]*"/g, '')
        .match(/<\/?[a-z0-9]+/g)!
        .join('');
    expect(shape('es')).toBe(shape('en'));
  });
});

describe('shaft on bearings: what the notes say the form does, it does on screen', () => {
  const force = (x: number, v = 1000) => [{ id: 90, x, v, vDir: 'down' as const, h: 0, hDir: 'towards' as const }];

  for (const lang of LANGS) {
    const t = beamStrings[lang].ui;
    const w = shaftUi[lang];
    const num = (value: number, figures = 4) => text(esc(formatNumber(value, figures, t.numbers.group)));
    const segment = (n: number) => `${w.shaft.segment} ${n}`;

    // "A segment under a millionth of the shaft's length, a segment more than
    // a million times as stiff as another, and two bearings within a
    // thousandth of that length of each other are not solved: the entry is
    // marked in the form, and the results are withheld."
    it(`${lang}: a segment too short, one too stiff beside another, bearings too close: the entry is marked, a line says why, and no result is shown`, () => {
      // The example: five cards of numbers, and no row marked.
      expect(titlesOf(tool(lang))).toHaveLength(5);
      expect(markedRows(tool(lang))).toEqual([]);
      // A hundred-thousandth of an inch before 20 in of shaft: half a millionth of it.
      const short = tool(lang, { ...formOf([[0.00001, 1.5], [20, 2]], [0, 20]), forces: force(10) });
      expect(titlesOf(short)).toEqual([]);
      expect(text(short)).toContain(text(esc(w.issues['short-segment'])));
      expect(markedRows(short)).toEqual([segment(1)]);
      // A twentieth of an inch beside 2 in: 40 diameters to 1, which is 2,560,000 times the stiffness. Both segments are marked: neither is at fault alone.
      const stiff = tool(lang, { ...formOf([[10, 0.05], [10, 2]], [0, 20]), forces: force(15) });
      expect(titlesOf(stiff)).toEqual([]);
      expect(text(stiff)).toContain(text(esc(w.issues.stiffness.replace('{max}', formatNumber(STIFF, 7, t.numbers.group)))));
      expect(w.issues.stiffness).toContain('{max}');
      expect(markedRows(stiff)).toEqual([segment(1), segment(2)]);
      // Bearings a hundredth of an inch apart on 20 in of shaft: half a thousandth of it. The field of a bearing is marked.
      const close = tool(lang, { ...formOf([[20, 2]], [10, 10.01]), forces: force(15) });
      expect(titlesOf(close)).toEqual([]);
      expect(text(close)).toContain(text(esc(w.issues.bearings)));
      expect(close.match(/<label class="mp-num[^"]*" data-invalid="true">/g)?.length).toBeGreaterThanOrEqual(1);
      // …and with each of the three just inside its limit the shaft is solved, with nothing marked.
      for (const taken of [
        { ...formOf([[0.0001, 1.5], [20, 2]], [0.0001, 20.0001]), forces: force(10) },
        { ...formOf([[10, 0.1], [10, 2]], [0, 20]), forces: force(15) },
        { ...formOf([[20, 2]], [10, 10.05]), forces: force(15) },
      ]) {
        const html = tool(lang, taken);
        expect(titlesOf(html)).toHaveLength(5);
        expect(markedRows(html)).toEqual([]);
        expect(html).not.toContain('data-invalid="true"');
      }
    });

    // "The shaft's own weight is a load only when you include it. Each
    // segment then weighs its density times its area of metal, a uniform
    // load in the vertical plane".
    it(`${lang}: with its own weight included the shaft carries 14.66 lbf more, all of it in the vertical plane — and the page says how much`, () => {
      const heavy = tool(lang, { ...EXAMPLE, ownWeight: true });
      expect(text(heavy)).toContain(text(esc(w.material.weight.replace('{weight}', '14.66 lbf'))));
      // The reactions, by this file's own statics, with each segment's weight per length as density × area of metal.
      const weighed = planesOf({ ...toEngine(EXAMPLE).model, segments: toEngine(EXAMPLE).model.segments.map((seg, i) => ({ ...seg, w: 0.2836 * ((Math.PI * EXAMPLE.segments[i].d ** 2) / 4) })) });
      const [vertical, horizontal] = [staticsOf(weighed.vertical), staticsOf(weighed.horizontal)];
      const rows = tableOf(cardOf(heavy, w.bearings.title));
      expect(rows.map((r) => r[`${w.results.reactionV} (lbf)`])).toEqual([vertical.RA, vertical.RB].map((R) => `${num(R)} ${t.results.upward}`));
      // 363 and 1,052 lbf, where the bare example has 357.1 and 1,043: the 14.66 lbf of the shaft between them.
      expect([num(vertical.RA), num(vertical.RB)]).toEqual([num(363), num(1052)]);
      expect(vertical.RA + vertical.RB - 1400).toBeCloseTo(14.66, 2);
      // The horizontal plane has none of it.
      expect(rows.map((r) => r[`${w.results.reactionH} (lbf)`])).toEqual([horizontal.RA, horizontal.RB].map((R) => `${num(R)} ${w.results.away}`));
      expect([horizontal.RA, horizontal.RB]).toEqual([expect.closeTo(180, 9), expect.closeTo(180, 9)]);
      // Not included, it is not a load: the page opens without that line, and with the bare reactions.
      const bare = tool(lang);
      expect(text(bare)).not.toContain(text(esc(w.material.weight.split('{weight}')[0])));
      expect(tableOf(cardOf(bare, w.bearings.title)).map((r) => r[`${w.results.reactionV} (lbf)`])).toEqual([`${num(357.1)} ${t.results.upward}`, `${num(1043)} ${t.results.upward}`]);
    });

    // "A size entered with a minus sign acts the other way, for a force as
    // for a moment."
    it(`${lang}: a size entered with a minus sign acts the other way: −400 lbf pointed down is 400 lbf up, on the page as in the engine`, () => {
      const up = tool(lang, { ...EXAMPLE, forces: [EXAMPLE.forces[0], { ...EXAMPLE.forces[1], v: 400, vDir: 'up' }] });
      const minus = tool(lang, { ...EXAMPLE, forces: [EXAMPLE.forces[0], { ...EXAMPLE.forces[1], v: -400, vDir: 'down' }] });
      for (const card of [w.bearings.title, w.results.bySegment, w.results.atForces]) expect(tableOf(cardOf(minus, card)), card).toEqual(tableOf(cardOf(up, card)));
      // With the pulley's belt pulling up, the left bearing holds the shaft DOWN: 14·R = 1,000 × 7 − 400 × 19 = −600, so 600 − (−42.86) = 642.9 lbf at the left one and 42.86 lbf downward at the right.
      const rows = tableOf(cardOf(minus, w.bearings.title));
      expect(rows.map((r) => r[`${w.results.reactionV} (lbf)`])).toEqual([`${num(600 + 600 / 14)} ${t.results.upward}`, `${num(600 / 14)} ${t.results.downward}`]);
    });

    // "Under Values at a point each plane keeps its signs: for shear, moment
    // and deflection those written under the diagrams when that plane is the
    // view, and for a slope, positive counter-clockwise as that plane is
    // drawn."
    it(`${lang}: under Values at a point each plane keeps its signs — those written under the diagrams of that plane — and a slope is positive counter-clockwise`, () => {
      // The line under the diagrams is the view's own, one for each of the three.
      for (const view of ['vertical', 'horizontal', 'both'] as const) {
        const html = tool(lang, EXAMPLE, view);
        for (const other of ['vertical', 'horizontal', 'both'] as const) expect(text(html).includes(text(esc(w.results.signs[other]))), `${view}: ${other}`).toBe(other === view);
      }
      // The card, whatever the view: at the middle of the example, 11.5 in, between the gear and the right bearing.
      const point = cardOf(tool(lang, EXAMPLE, 'both'), t.results.point);
      expect(point).toMatch(/<input class="mp-num__input"[^>]* value="11\.5"\/>/);
      const rows = tableOf(point);
      const row = (title: string, unit: string) => rows.find((r) => Object.values(r)[0] === `${title} (${unit})`)!;
      const example = solvedForm(EXAMPLE);
      const here = example.at(11.5);
      // Shear: the left reaction less the gear's force, in each plane: 357.1 − 1,000 and 180 − 360 — the part left of the cut is pushed
      // down, and towards the viewer: negative in both, as the lines under the diagrams have it.
      expect([row(t.results.shear, 'lbf')[w.planes.vertical], row(t.results.shear, 'lbf')[w.planes.horizontal]]).toEqual([num(1400 - 14600 / 14 - 1000), num(180 - 360)]);
      // Moment: sagging in the vertical plane, and bowed towards the viewer in the horizontal one: positive in both.
      expect([row(t.results.moment, 'lbf·in')[w.planes.vertical], row(t.results.moment, 'lbf·in')[w.planes.horizontal]]).toEqual([num(here.vertical.M), num(here.horizontal.M)]);
      expect(here.vertical.M).toBeCloseTo((1400 - 14600 / 14) * 9.5 - 1000 * 2.5, 9);
      expect(here.horizontal.M).toBeCloseTo(180 * 9.5 - 360 * 2.5, 9);
      // Deflection: down, and towards the viewer — negative in both, where upward and away from the viewer are positive.
      expect([row(t.results.deflection, 'in')[w.planes.vertical], row(t.results.deflection, 'in')[w.planes.horizontal]]).toEqual([num(here.vertical.v), num(here.horizontal.v)]);
      expect([here.vertical.v < 0, here.horizontal.v < 0]).toEqual([true, true]);
      // Slope: printed positive in both planes there — and in both the shaft is on its way back up to the right bearing: rising to the
      // right, which is counter-clockwise as each plane is drawn.
      const slope = row(t.results.slope, 'rad');
      expect([slope[w.planes.vertical], slope[w.planes.horizontal]]).toEqual([num(here.vertical.theta), num(here.horizontal.theta)]);
      expect([slope[w.planes.vertical], slope[w.planes.horizontal]]).toEqual(['0.0002594', '0.0001136']);
      for (const plane of ['vertical', 'horizontal'] as const) expect(example.at(11.6)[plane].v).toBeGreaterThan(example.at(11.4)[plane].v);
      // The two together are sizes, with no sign to keep.
      for (const r of rows) expect(Object.values(r)[3].startsWith('-'), Object.values(r)[0]).toBe(false);
      // The note names the card as the card is named.
      expect(shaftPage[lang].signs.items.filter((x) => x.includes(t.results.point))).toHaveLength(1);
      expect(shaftPage[lang].signs.items[3]).toBe(
        lang === 'en'
          ? 'Under Values at a point each plane keeps its signs: for shear, moment and deflection those written under the diagrams when that plane is the view, and for a slope, positive counter-clockwise as that plane is drawn.'
          : 'En Valores en un punto cada plano conserva sus signos: para el cortante, el momento y la deflexión, los que se leen bajo los diagramas cuando ese plano es la vista; para un giro, positivo en sentido antihorario tal como se dibuja ese plano.',
      );
    });

    // "At a shoulder … the stress there is two values, the higher on the side
    // of the smaller modulus." A shaft whose middle is its one shoulder, so
    // that the card of values at a point opens on it.
    it(`${lang}: at a shoulder the card gives the two diameters and the two stresses, the higher beside the smaller diameter`, () => {
      const html = tool(lang, { ...formOf([[10, 2], [10, 1.5]], [0, 20]), forces: force(5) });
      const at = pairsOf(cardOf(html, t.results.point));
      // 1,000 lbf at 5 in of 20: 250 lbf at the right bearing, and 250 × 10 = 2,500 lbf·in at the shoulder. Over π × 2³ ÷ 32 that is 3.183 ksi; over π × 1.5³ ÷ 32, 7.545 ksi.
      expect(at[w.shaft.diameter]).toBe(`2 in ${t.results.left}, 1.5 in ${t.results.right}`);
      expect(at[w.results.stress]).toBe(`${num(2500 / modulus(2) / 1000)} ${t.results.left}, ${num(2500 / modulus(1.5) / 1000)} ${t.results.right} ksi`);
      expect([num(2500 / modulus(2) / 1000), num(2500 / modulus(1.5) / 1000)]).toEqual(['3.183', '7.545']);
    });
  }
});

describe('shaft on bearings: one page for every calculator, with this one’s words', () => {
  const source = (rel: string) => readFileSync(join(SRC, rel), 'utf8');
  /** Text as it stands between two tags: one piece of the page. */
  const pieces = (html: string) =>
    [...html.replace(/<(script|style)\b[\s\S]*?<\/\1>/g, ' ').matchAll(/>([^<]+)</g)].map((m) => text(`<i>${m[1]}</i>`)).filter(Boolean);

  // Rendered, and without the tool: the hero, the notes, the terms. What a
  // crawler reads on this page and on any of the other three may be the
  // legal words and nothing else.
  it('around the tool, this page shares the legal words with the other three and no other sentence', () => {
    for (const lang of LANGS) {
      const site = getContent(lang);
      const ours = pieces(around(lang, SHAFT_PATH, shaftPage[lang]));
      expect(ours.length).toBeGreaterThan(40);
      const s = shaftPage[lang];
      const address = `ttcivilstructural.com${localePath(SHAFT_PATH, lang)}`;
      const legal = new Set([s.disclaimer.title, s.disclaimer.body, s.sheet.kind, s.sheet.credit.replace('{firm}', site.company.legalName).replace('{address}', address)]);
      // Each of them is on the page, so the exemption exempts something.
      for (const words of legal) expect(ours, words.slice(0, 40)).toContain(words);
      for (const [path, page] of [[BEAM_PATH, beamStrings[lang].page], [SPAN_PATH, spanPage[lang]], [CONTINUOUS_PATH, continuousPage[lang]]] as const) {
        expect(sharedRuns(ours.filter((p) => !legal.has(p)), pieces(around(lang, path, page))), `${lang} ${path}`).toEqual([]);
      }
    }
  });

  // The four views are the same component with other words: the same
  // elements in the same order, however many paragraphs and list items each
  // has to say.
  it('around the tool, the four pages are built alike', () => {
    const frame = (html: string) =>
      (html.replace(/<(script|style)\b[\s\S]*?<\/\1>/g, '').match(/<\/?[a-z0-9]+/g) ?? [])
        .join('')
        .replace(/(<p<\/p)+/g, '<p</p')
        .replace(/(<li<\/li)+/g, '<li</li');
    for (const lang of LANGS) expect(frame(around(lang, SHAFT_PATH, shaftPage[lang]))).toBe(frame(around(lang, BEAM_PATH, beamStrings[lang].page)));
    // No view draws a page of its own: each hands its words to the shared one.
    const code = source('components/ttc/views/ShaftView.tsx');
    expect(code).toContain("import { CalculatorPage } from './CalculatorPage';");
    expect(code).not.toMatch(/PageHero|JsonLd|mp-appnotes|mp-sheet|calc\.css/);
    // The form's words go in as props, this language's only: the shaft's own, and of the first calculator's the pieces it borrows — not the set.
    expect(code).toContain('<ShaftCalculator t={sharedWords(beamStrings[lang].ui)} w={shaftUi[lang]} />');
  });
});

describe('shaft on bearings: on paper it is a calculation sheet', () => {
  for (const lang of LANGS) {
    const site = getContent(lang);
    const s = shaftPage[lang];
    const html = render(lang);
    const main = mainOf(html);
    const address = `ttcivilstructural.com${localePath(SHAFT_PATH, lang)}`;

    it(`${lang}: a letterhead with the firm's own lockup, this calculator's name and what the sheet is`, () => {
      const head = html.match(/<div class="mp-sheet mp-sheet__head">[\s\S]*?<\/div><\/div>/)?.[0] ?? '';
      const img = head.match(/<img\b[^>]*>/)?.[0] ?? '';
      // The real file, a straight resize of the dark lockup: never a drawing of the logo.
      expect(attr(img, 'src')).toBe('/ttc/img/logo-horizontal@640.webp');
      expect(attr(img, 'alt')).toBe(site.company.legalName);
      expect(text(head)).toContain(s.sheet.kind);
      expect(text(head)).toContain(text(esc(s.h1)));
      // Its own address, whole: the sheet says which page made it, and not another calculator's.
      expect(text(head.match(/<p class="mp-sheet__site">([\s\S]*?)<\/p>/)?.[1] ?? '')).toBe(address);
    });

    it(`${lang}: the disclaimer is on the page whole, with the credit of THIS calculator under it`, () => {
      expect(text(main)).toContain(text(esc(s.disclaimer.body)));
      expect(s.disclaimer.body).toContain(site.company.legalName);
      expect(site.company.legalName).toBe('Tercero Tablada Civil and Structural Engineering Inc.');
      const credit = text(main.match(/<p class="mp-sheet mp-sheet__credit">([\s\S]*?)<\/p>/)?.[1] ?? '');
      expect(credit).toBe(s.sheet.credit.replace('{firm}', site.company.legalName).replace('{address}', address));
      expect(credit).toContain(site.company.legalName);
      expect(credit.endsWith(address)).toBe(true);
    });

    it(`${lang}: every page's margin names the firm and this calculator, and carries the short disclaimer`, () => {
      const style = html.match(/<style>(:root\{--mp-sheet-top:[\s\S]*?)<\/style>/)?.[1] ?? '';
      // Three CSS strings, and nothing in them that could end the element or the string.
      const values = [...style.matchAll(/--mp-sheet-(top|name|bottom):"([^"]*)"/g)].map((m) => [m[1], m[2].replace(/\\([0-9a-f]+) /g, (_, hex) => String.fromCodePoint(parseInt(hex, 16)))]);
      expect(Object.fromEntries(values)).toEqual({ top: site.company.legalName, name: s.h1, bottom: beamStrings[lang].page.sheet.margin });
      expect(style).not.toMatch(/<|>/);
      // Set once: a second block would be a second calculator's words on this sheet.
      expect(html.split('--mp-sheet-top:').length - 1).toBe(1);
    });
  }
});

describe('shaft on bearings: what its script carries', () => {
  // The same walk as beam-calculator.test.ts: everything the client component
  // imports goes to the browser.
  const resolveImport = (from: string, spec: string): string | null => {
    const base = spec.startsWith('@/') ? join(SRC, spec.slice(2)) : spec.startsWith('.') ? join(dirname(from), spec) : null;
    if (!base) return null;
    for (const candidate of [base, `${base}.ts`, `${base}.tsx`, join(base, 'index.ts'), join(base, 'index.tsx')]) {
      if (existsSync(candidate) && /\.(tsx?|json)$/.test(candidate)) return candidate;
    }
    return null;
  };
  const reach = (entry: string): string[] => {
    const seen = new Set<string>();
    const walk = (file: string) => {
      if (seen.has(file) || file.endsWith('.json')) {
        seen.add(file);
        return;
      }
      seen.add(file);
      const code = readFileSync(file, 'utf8');
      // Value imports only: `import type` and `import { type X }` alone carry no code.
      for (const m of code.matchAll(/^\s*(import|export)\s+(?!type\b)([\s\S]*?)\s+from\s+['"]([^'"]+)['"]/gm)) {
        const names = m[2];
        if (/^\{[^}]*\}$/.test(names.trim()) && names.replace(/[{}]/g, '').split(',').every((n) => /^\s*type\s/.test(n) || n.trim() === '')) continue;
        const next = resolveImport(file, m[3]);
        if (next) walk(next);
      }
      for (const m of code.matchAll(/import\(\s*['"]([^'"]+)['"]\s*\)/g)) {
        const next = resolveImport(file, m[1]);
        if (next) walk(next);
      }
    };
    walk(entry);
    return [...seen].map((f) => f.slice(SRC.length + 1).replace(/\\/g, '/'));
  };

  it('its own arithmetic, and no file of words: not the form’s, not the first calculator’s, not this page’s', () => {
    const files = reach(join(SRC, 'components/ttc/calc/shaft/ShaftCalculator.tsx'));
    expect(files).toEqual(expect.arrayContaining(['lib/calc/shaft/engine.ts', 'lib/calc/shaft/model.ts', 'lib/calc/shaft/analysis.ts', 'lib/calc/beam/solver.ts']));
    // Each of these holds both languages; the page's own, its paragraphs as well.
    for (const words of ['lib/calc/shaft/strings.ts', 'lib/calc/shaft/page-strings.ts', 'lib/calc/beam/strings.ts', 'lib/calc/beam/span-strings.ts', 'lib/calc/beam/span-page-strings.ts', 'lib/calc/continuous/strings.ts', 'lib/calc/continuous/page-strings.ts']) {
      expect(files, words).not.toContain(words);
    }
    expect(files.filter((f) => /^lib\/ttc\/(site|site\.es|content|calculators|cities|city-)/.test(f) || /^components\/ttc\/views\//.test(f))).toEqual([]);
    // …and nothing in what it reaches can send what is typed anywhere.
    for (const f of files.filter((x) => !x.endsWith('.json'))) {
      expect(readFileSync(join(SRC, f), 'utf8'), f).not.toMatch(/\bfetch\(|sendBeacon|XMLHttpRequest|new WebSocket|\baction=|localStorage|sessionStorage|document\.cookie/);
    }
  });

  it('the page’s words reach the view on the server, and nothing a browser runs', () => {
    // Who imports this page's text, by name: the view, the two routes — and tests.
    const importers: string[] = [];
    const walk = (dir: string) => {
      for (const entry of readdirSync(dir, { withFileTypes: true })) {
        const full = join(dir, entry.name);
        if (entry.isDirectory()) walk(full);
        else if (/\.tsx?$/.test(entry.name) && !/\.test\.ts$/.test(entry.name) && /shaft\/page-strings['"]/.test(readFileSync(full, 'utf8'))) importers.push(full.slice(SRC.length + 1).replace(/\\/g, '/'));
      }
    };
    walk(SRC);
    expect(importers.sort()).toEqual(['app/(public)/(site)/resources/shaft-on-bearings/page.tsx', 'app/(public-es)/(site)/es/resources/shaft-on-bearings/page.tsx', 'components/ttc/views/ShaftView.tsx']);
    for (const f of importers) expect(readFileSync(join(SRC, f), 'utf8'), f).not.toMatch(/^['"]use client['"]/m);
    // The legal words are taken from the first calculator's text in the page's own file, not typed in it.
    const code = readFileSync(join(SRC, 'lib/calc/shaft/page-strings.ts'), 'utf8');
    for (const lang of LANGS) {
      expect(code).toContain(`disclaimer: beamStrings.${lang}.page.disclaimer,`);
      expect(code).toContain(`kind: beamStrings.${lang}.page.sheet.kind,`);
      expect(code).toContain(`margin: beamStrings.${lang}.page.sheet.margin,`);
    }
    // Every source file of the site is read: a second or two alone, more than the default five beside the other suites.
  }, 60_000);
});

describe('shaft on bearings: the language link carries its case', () => {
  afterEach(() => vi.unstubAllGlobals());

  // The first calculator keeps its beam after `#b=`, the second its case
  // after `#s=`, the third after `#c=`, this one after `#h=`: a key of one
  // lower-case letter, which is what the header's link carries to the twin
  // page (mp/lang.tsx).
  it('a shaft after #h= goes with the link to the other language, whole', () => {
    expect(`#${SHAFT_KEY}=`).toBe('#h=');
    expect(new Set([SHAFT_KEY, CONTINUOUS_KEY, SPAN_KEY, 'b']).size).toBe(4);
    const edited = reduceShaft(reduceShaft(EXAMPLE, { type: 'bearing', index: 0, x: 3 }), { type: 'own-weight', on: true });
    const hash = `#${SHAFT_KEY}=${encodeShaft(edited)}`;
    vi.stubGlobal('window', { location: { hash, search: '' } });
    expect(addressNow().carried).toBe(hash);
    // …and what arrives is that shaft: its first bearing at 3 in, its weight a load, the rest as it was.
    const arrived = decodeShaft(addressNow().carried.slice(3))!;
    expect([arrived.bearings, arrived.ownWeight, arrived.segments.map((x) => x.L)]).toEqual([[3, 16], true, [4, 10, 4, 5]]);
    // No other calculator's link is this page's, and this page's is none of theirs.
    expect(decodeShaft(encodeBeam(defaultBeam()))).toBeNull();
    expect(decodeShaft(encodeContinuous(defaultContinuous()))).toBeNull();
    expect(decodeBeam(encodeShaft(edited))).toBeNull();
    expect(decodeContinuous(encodeShaft(edited))).toBeNull();
  });
});

describe('shaft on bearings: a page sent with its example, under an address that holds another shaft', () => {
  // A server never sees what is after the #. Until the script has read it,
  // the example must not stand for the shaft of a link: the tool is in a
  // frame that the page's own first script marks (calc/ToolFrame.tsx; what
  // a browser then shows is held in the regression script).
  for (const lang of LANGS) {
    it(`${lang}: the tool stands in its frame, after the frame's script and the SHAFT's own line for a link still to be opened`, () => {
      const html = mainOf(render(lang));
      const line = shaftUi[lang].linkOpening;
      expect(html.match(/<div class="mp-app__frame">/g)).toHaveLength(1);
      // The script is the text of a holder, not an element of React's (ToolFrame.tsx says why): the frame is the holder's parent.
      expect(html).toContain(`<div class="mp-app__frame"><span hidden=""><script>(function(s){if(/^#[a-z]=./.test(location.hash))s.parentNode.parentNode.setAttribute('data-opening','')})(document.currentScript)</script></span><p class="mp-app__opening" data-line="${esc(line)}"></p><div class="mp-app mp-shaft"`);
      // As served nothing is marked: the example is the page.
      expect(html).not.toMatch(/data-opening=/);
      // …and the line is not among its words: an attribute of an empty paragraph, which the stylesheet writes out only while the frame is marked.
      expect(text(html)).not.toContain(line);
      expect(html.split(esc(line))).toHaveLength(2);
      // The other three pages hand the first calculator's line, which says the link carries a beam. This one says what this link carries.
      expect(line).not.toBe(beamStrings[lang].ui.linkOpening);
      expect(line).toMatch(lang === 'en' ? /\bshaft\b/ : /\beje\b/);
      expect(line).not.toMatch(lang === 'en' ? /\bbeam\b/i : /\bviga\b/i);
      expect(html).not.toContain(esc(beamStrings[lang].ui.linkOpening));
    });
  }

  it('the view hands the page that line, and the page hands it to the frame', () => {
    const source = (rel: string) => readFileSync(join(SRC, rel), 'utf8');
    expect(source('components/ttc/views/ShaftView.tsx')).toContain('<CalculatorPage lang={lang} path={SHAFT_PATH} page={shaftPage[lang]} opening={shaftUi[lang].linkOpening}>');
    expect(source('components/ttc/views/CalculatorPage.tsx')).toContain('<ToolFrame opening={opening}>{children}</ToolFrame>');
  });
});
