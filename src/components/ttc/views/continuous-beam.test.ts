import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { createElement as h } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { UNITS, analyse, bendingStress, decodeBeam, deflectionFactor, encodeBeam, sectionProps, shearStress, stiffness, type SteelShape } from '@/lib/calc/beam/model';
import { SPAN_KEY } from '@/lib/calc/beam/span';
import { spanPage } from '@/lib/calc/beam/span-page-strings';
import { spanUi } from '@/lib/calc/beam/span-strings';
import { beamStrings } from '@/lib/calc/beam/strings';
import { analyseContinuous } from '@/lib/calc/continuous/analysis';
import { SHORT, STIFF, solveContinuous } from '@/lib/calc/continuous/engine';
import { envelopeContinuous } from '@/lib/calc/continuous/envelope';
import {
  CONTINUOUS_KEY,
  MAX_SPANS,
  decodeContinuous,
  defaultContinuous,
  encodeContinuous,
  formIssues,
  generalCode,
  oneSection,
  reduceContinuous,
  toBeamForm,
  toEngine,
  type ContinuousForm,
} from '@/lib/calc/continuous/model';
import { continuousPage } from '@/lib/calc/continuous/page-strings';
import { continuousUi } from '@/lib/calc/continuous/strings';
import type { ContinuousEnvelope, ContinuousModel, ContinuousSolution, Governing, SpanDistLoad } from '@/lib/calc/continuous/types';
import { calculatorFamilies } from '@/lib/ttc/calculators';
import { getContent, navLabelOf } from '@/lib/ttc/content';
import { localePath, type Lang } from '@/lib/ttc/i18n';
import { DESCRIPTION_LIMIT_PX, TITLE_BUDGET_PX, descriptionPx, repeatedWords, titlePx, unmeasured } from '@/lib/ttc/serp';
import { absoluteUrl } from '@/lib/ttc/site';
import { ContinuousCalculator } from '@/components/ttc/calc/continuous/ContinuousCalculator';
import { addressNow } from '@/components/ttc/mp/lang';
import { SiteChrome } from '@/components/ttc/mp/SiteChrome';
import { BEAM_PATH } from './BeamCalculatorView';
import { CalculatorPage, type CalculatorText } from './CalculatorPage';
import { CONTINUOUS_PATH, ContinuousBeamView } from './ContinuousBeamView';
import { pageMeta } from './meta';
import { SPAN_PATH } from './SingleSpanView';

/**
 * THE CONTINUOUS BEAM'S PAGE: /resources/continuous-beam and its /es twin.
 *
 * The third calculator has an engine of its own, tested where it lives
 * (lib/calc/continuous). What is tested here is the PAGE: that what
 * its notes say the tool does, it does — each such sentence beside the
 * behaviour and, where a word could be turned into its opposite with the
 * behaviour untouched (a direction, a sign, dead or live, how the
 * arrangements are reached), the clause itself read in BOTH languages: the
 * notes are what an engineer reads before trusting a number, and the owner
 * answers for them —;
 * that each closed form it gives to check the tool by is the one the tool
 * reproduces; that no sentence of the other two calculators' pages is said
 * again, which a search engine reads as one page twice; that the legal
 * words are taken, not retyped; and that the page around the tool is the
 * one every calculator shares, in both languages.
 *
 * In that order: the four closed forms; the method, the live load and the
 * notes, each sentence beside what the engine does; the words themselves;
 * then the page as the server sends it — what a search result shows, the
 * example solved (redone by hand with the three-moment equation), what the
 * form does on screen where the notes say it does something, the sheet on
 * paper, what the script carries, and the language link.
 *
 * The tool's own behaviour — every field, the address, the drawings — is its
 * own test's (calc/continuous).
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

/* ── The engine, asked as the notes describe it ───────────────────────── */

const solved = (model: ContinuousModel): ContinuousSolution => {
  const out = solveContinuous(model);
  if (!out.ok) throw new Error(`not solved: ${JSON.stringify(out.issues)}`);
  return out;
};
const enveloped = (model: ContinuousModel): ContinuousEnvelope => {
  const out = envelopeContinuous(model);
  if (!out.ok) throw new Error(`not solved: ${JSON.stringify(out.issues)}`);
  return out;
};
/** A uniform load over the whole of each span named. */
const uniform = (lengths: number[], w: number, live = false, on = lengths.map((_, i) => i)): SpanDistLoad[] => on.map((span) => ({ span, a1: 0, a2: lengths[span], w1: w, w2: w, live }));
/** Equal spans of one stiffness on simple supports: the beam of the four cases. */
const equal = (n: number, L: number, more: Partial<ContinuousModel> = {}): ContinuousModel => ({ spans: Array.from({ length: n }, () => ({ L, k: 1 })), left: 'pin', right: 'pin', ...more });
const near = (value: number, digits = 9) => expect.closeTo(value, digits);

describe('continuous beam: the closed forms it gives to check it by', () => {
  // The numbers of the four cases: spans of 20 ft under 1.5 kip/ft, so that
  // every fraction comes to a short decimal a reader can redo. Each formula
  // the page prints is written out as arithmetic AND as what it comes to by
  // hand; the engine's answer is held to both.
  const L = 20;
  const w = 1.5;

  it('two equal spans under w: −wL²/8 over the middle support, 3wL/8 and 5wL/4, 9wL²/128 at 3L/8', () => {
    const out = solved(equal(2, L, { dists: uniform([L, L], w) }));
    expect(out.joints.map((j) => j.M)).toEqual([0, near((-w * L ** 2) / 8), 0]);
    // 1.5 × 20² ÷ 8 = 75 kip·ft, hogging.
    expect(out.joints[1].M).toBeCloseTo(-75, 9);
    expect(out.reactions.map((r) => r.Rv)).toEqual([near((3 * w * L) / 8), near((5 * w * L) / 4), near((3 * w * L) / 8)]);
    // 3 × 1.5 × 20 ÷ 8 = 11.25 kip at each end, 5 × 1.5 × 20 ÷ 4 = 37.5 kip in the middle: 60 kip, the whole load.
    expect(out.reactions.map((r) => r.Rv)).toEqual([near(11.25), near(37.5), near(11.25)]);
    for (const [i, span] of out.spans.entries()) {
      expect(span.Mmax.value).toBeCloseTo((9 * w * L ** 2) / 128, 9);
      // 9 × 1.5 × 400 ÷ 128 = 42.1875 kip·ft, 7.5 ft from each end of the beam.
      expect(span.Mmax.value).toBeCloseTo(42.1875, 9);
      expect(span.Mmax.x).toBeCloseTo(i === 0 ? (3 * L) / 8 : 2 * L - (3 * L) / 8, 9);
    }
  });

  it('three equal spans under w: −wL²/10 over each interior support, 2wL/5 and 11wL/10, 2wL²/25 and wL²/40', () => {
    const out = solved(equal(3, L, { dists: uniform([L, L, L], w) }));
    expect(out.joints.map((j) => j.M)).toEqual([0, near((-w * L ** 2) / 10), near((-w * L ** 2) / 10), 0]);
    // 1.5 × 400 ÷ 10 = 60 kip·ft.
    expect(out.joints[1].M).toBeCloseTo(-60, 9);
    expect(out.reactions.map((r) => r.Rv)).toEqual([near((2 * w * L) / 5), near((11 * w * L) / 10), near((11 * w * L) / 10), near((2 * w * L) / 5)]);
    // 12 + 33 + 33 + 12 = 90 kip, the whole load.
    expect(out.reactions.map((r) => r.Rv)).toEqual([near(12), near(33), near(33), near(12)]);
    // 2 × 1.5 × 400 ÷ 25 = 48 kip·ft in the end spans, 1.5 × 400 ÷ 40 = 15 kip·ft in the middle one.
    expect(out.spans.map((s) => s.Mmax.value)).toEqual([near((2 * w * L ** 2) / 25), near((w * L ** 2) / 40), near((2 * w * L ** 2) / 25)]);
    expect(out.spans.map((s) => s.Mmax.value)).toEqual([near(48), near(15), near(48)]);
  });

  // Through the form, as a visitor enters it: half an inch at the middle
  // support of two 20 ft spans of the example's section. EI is 29,000 ksi ×
  // 843 in⁴ ÷ 144 = 169,770.83 kip·ft², δ is 0.5 ÷ 12 ft:
  // 3EIδ/L² = 3 × 169,770.83 × 0.0416667 ÷ 400 = 53.0534 kip·ft, and
  // 3EIδ/L³ = 2.6527 kip.
  it('two unloaded spans, the middle support settling by δ: 3EIδ/L² over it, 3EIδ/L³ more at each end and 6EIδ/L³ less in the middle', () => {
    const example = defaultContinuous();
    const form: ContinuousForm = { ...example, spans: [1, 2].map((id) => ({ id, L, k: 1, dead: 0, live: 0 })), settlements: [0, 0.5, 0] };
    const section = sectionProps(form);
    const EI = stiffness(form.units, section);
    expect(EI).toBeCloseTo((29000 * 843) / 144, 6);
    const delta = 0.5 / 12;
    const out = solved(toEngine(form, section, EI).model);
    expect(out.joints.map((j) => j.M)).toEqual([0, near((3 * EI * delta) / L ** 2), 0]);
    expect(out.joints[1].M).toBeCloseTo(53.0534, 4);
    // Sagging: the beam hangs from its two ends over the support that went down.
    expect(out.joints[1].M).toBeGreaterThan(0);
    expect(out.reactions.map((r) => r.Rv)).toEqual([near((3 * EI * delta) / L ** 3), near((-6 * EI * delta) / L ** 3), near((3 * EI * delta) / L ** 3)]);
    expect(out.reactions[0].Rv).toBeCloseTo(2.6527, 4);
    // No load: the three changes add up to nothing.
    expect(out.reactions.reduce((sum, r) => sum + r.Rv, 0)).toBeCloseTo(0, 9);
  });

  it('two equal spans, a live load w in every arrangement: 49wL²/512 at 7L/16 with one span loaded, −wL²/8 with both', () => {
    const out = enveloped(equal(2, L, { dists: uniform([L, L], w, true) }));
    for (const [i, span] of out.spans.entries()) {
      expect(span.Mmax.value).toBeCloseTo((49 * w * L ** 2) / 512, 9);
      // 49 × 1.5 × 400 ÷ 512 = 57.421875 kip·ft, 8.75 ft from the end of the beam — and that span alone is loaded.
      expect(span.Mmax.value).toBeCloseTo(57.421875, 9);
      expect(span.Mmax.x).toBeCloseTo(i === 0 ? (7 * L) / 16 : 2 * L - (7 * L) / 16, 9);
      expect(span.Mmax.spans).toEqual([i]);
    }
    // Over the middle support the lowest moment is the first case's, with both spans loaded.
    expect(out.joints[1].M.min.value).toBeCloseTo((-w * L ** 2) / 8, 9);
    expect(out.joints[1].M.min.spans).toEqual([0, 1]);
    // One span loaded is more sagging than both, by the engine's own two answers: 49/512 against the 9/128 = 36/512 of the first case, 57.42 against 42.19 kip·ft.
    expect(out.spans[0].Mmax.value - solved(equal(2, L, { dists: uniform([L, L], w) })).spans[0].Mmax.value).toBeCloseTo(((49 - 36) * w * L ** 2) / 512, 9);
    // …and that arrangement, solved on its own, is the textbook one: −wL²/16 over the support, 7wL/16 at the loaded end.
    const one = solved(equal(2, L, { dists: uniform([L, L], w, true, [0]) }));
    expect(one.joints[1].M).toBeCloseTo((-w * L ** 2) / 16, 9);
    expect(one.reactions.map((r) => r.Rv)).toEqual([near((7 * w * L) / 16), near((5 * w * L) / 8), near((-w * L) / 16)]);
    expect(one.spans[0].Mmax.value).toBeCloseTo(out.spans[0].Mmax.value, 9);
  });

  // The four cases close the method, each a paragraph of its own, after the
  // line that says what they have in common.
  const FORMS = [
    ['−wL²/8', '3wL/8', '5wL/4', '9wL²/128', '3L/8'],
    ['−wL²/10', '2wL/5', '11wL/10', '2wL²/25', 'wL²/40'],
    ['3EIδ/L²', '3EIδ/L³', '6EIδ/L³'],
    ['49wL²/512', '7L/16', '−wL²/8'],
  ];

  it('every one of them is on the page, as an engineer writes it, in both languages', () => {
    for (const lang of LANGS) {
      const paragraphs = continuousPage[lang].method.paragraphs;
      const cases = paragraphs.slice(-4);
      cases.forEach((p, i) => {
        for (const form of FORMS[i]) expect(p, `${lang} case ${i + 1}: ${form}`).toContain(form);
        // Read at a glance, not dug out of a sentence.
        expect(p.length, p).toBeLessThan(200);
      });
      // The line before them says what the four share: equal spans, one EI, simple supports.
      expect(paragraphs.at(-5)).toMatch(lang === 'en' ? /^Four results to verify by hand: equal spans L of one stiffness EI, on simple supports\.$/ : /^Cuatro resultados para verificar a mano: vanos iguales de longitud L y una misma rigidez EI, sobre apoyos simples\.$/);
      // A minus sign is a minus sign, not a hyphen: −wL²/8 is a hogging moment.
      for (const p of cases) expect(p, p).not.toMatch(/(^|[\s:;,])-\w/);
    }
  });

  // A formula found somewhere in its paragraph says nothing of the support it
  // belongs to. The engine above gives the reactions left to right — 11.25,
  // 37.5, 11.25 and 12, 33, 33, 12 — and so does the page; a settlement
  // raises the end reactions and lowers the middle one, not the reverse.
  it('each list of reactions is said left to right, and each change the right way round', () => {
    const [en, es] = LANGS.map((lang) => continuousPage[lang].method.paragraphs.slice(-4));
    expect(en[0]).toContain('reactions 3wL/8, 5wL/4 and 3wL/8;');
    expect(es[0]).toContain('reacciones 3wL/8, 5wL/4 y 3wL/8;');
    expect(en[1]).toContain('reactions 2wL/5, 11wL/10, 11wL/10 and 2wL/5;');
    expect(es[1]).toContain('reacciones 2wL/5, 11wL/10, 11wL/10 y 2wL/5;');
    expect(en[1]).toContain('2wL²/25 in the end spans and wL²/40 in the middle one');
    expect(es[1]).toContain('2wL²/25 en los vanos extremos y wL²/40 en el central');
    expect(en[2]).toContain('a sagging moment 3EIδ/L² over it; each end reaction rises by 3EIδ/L³ and the middle one falls by 6EIδ/L³');
    expect(es[2]).toContain('un momento positivo 3EIδ/L² sobre él; cada reacción extrema aumenta 3EIδ/L³ y la central disminuye 6EIδ/L³');
    expect(en[3]).toContain('49wL²/512, at 7L/16 from an end, with that span alone loaded; −wL²/8 over the middle support with both');
    expect(es[3]).toContain('49wL²/512, a 7L/16 de un extremo, con solo ese vano cargado; −wL²/8 sobre el apoyo central con ambos');
  });
});

describe('continuous beam: what the method says, the engine does', () => {
  const L = 20;
  const w = 1.5;

  // "At a support the deflection is known — zero, or the settlement entered —
  // and at a fixed end so is the rotation. The rotations that remain are the
  // unknowns, with one equation each: the end moments of the spans meeting at
  // that support add up to zero."
  it('at every support the deflection is the one given and the moment is one number; a fixed end does not turn', () => {
    const lengths = [18, 26, 22];
    const model: ContinuousModel = {
      spans: [{ L: 18, k: 1 }, { L: 26, k: 2.5 }, { L: 22, k: 0.6 }],
      left: 'fixed',
      right: 'pin',
      settlements: [0, 900, -400, 250],
      dists: uniform(lengths, w),
      points: [{ span: 1, a: 7, P: 12 }],
    };
    const out = solved(model);
    // Minus the settlement, to the last figure: nothing is solved for there.
    expect(out.joints.map((j) => j.EIv)).toEqual([-0, -900, 400, -250].map((v) => v + 0));
    // "Rigid supports: one moves only by the settlement entered for it" — each of the three that were given one, by its own. In Spanish, EACH: "uno solo" is "a single one".
    expect(continuousPage.en.assumes.items[2]).toContain('Rigid supports: one moves only by the settlement entered for it');
    expect(continuousPage.es.assumes.items[2]).toContain('Apoyos rígidos: cada uno se mueve únicamente lo que indique el asentamiento introducido para él');
    expect(continuousPage.es.assumes.items[2]).not.toMatch(/\buno solo\b/);
    for (const joint of out.joints.slice(1, -1)) {
      // The span before the support and the span after it say the same moment: their end moments balance.
      expect(out.at(joint.x, 'left').M).toBe(out.at(joint.x, 'right').M);
      expect(out.at(joint.x, 'left').M).toBe(joint.M);
      // …and the beam does not kink there: one rotation for both spans.
      expect(out.at(joint.x, 'left').EItheta).toBeCloseTo(out.at(joint.x, 'right').EItheta, 6);
    }
    // The fixed end: no rotation, and a moment; the simply supported end: a rotation, and no moment.
    expect(out.joints[0].EItheta).toBeCloseTo(0, 9);
    expect(out.joints[0].M).not.toBe(0);
    expect(out.joints[3].M).toBe(0);
    expect(Math.abs(out.joints[3].EItheta)).toBeGreaterThan(1);
  });

  // "a point load P, a from one end and b from the other, gives Pab²/L² at
  // the first, and a load varying linearly over any part of the span gives
  // that expression integrated."
  it('the fixed-end moments are the closed forms: Pab²/L², and its integral for a load that varies over part of a span', () => {
    const P = 9;
    const a = 6;
    const b = L - a;
    const point = solved({ spans: [{ L, k: 3 }], left: 'fixed', right: 'fixed', points: [{ span: 0, a, P }] });
    // 9 × 6 × 14² ÷ 400 = 26.46 kip·ft at the end the load is 6 ft from, 9 × 6² × 14 ÷ 400 = 11.34 at the other: both hogging.
    expect(point.joints.map((j) => j.M)).toEqual([near((-P * a * b ** 2) / L ** 2), near((-P * a ** 2 * b) / L ** 2)]);
    expect(point.joints.map((j) => j.M)).toEqual([near(-26.46), near(-11.34)]);

    // 0.5 kip/ft at 4 ft rising to 2 kip/ft at 15 ft. Its fixed-end moments by Simpson's rule on ∫ w(x)·x·(L − x)²/L² dx,
    // which is exact for the quartic under the integral only in the limit: 2,000 strips leave nothing at nine figures.
    const [a1, a2, w1, w2] = [4, 15, 0.5, 2];
    const wAt = (x: number) => w1 + ((w2 - w1) * (x - a1)) / (a2 - a1);
    const simpson = (f: (x: number) => number, strips = 2000) => {
      const h = (a2 - a1) / strips;
      let sum = f(a1) + f(a2);
      for (let i = 1; i < strips; i++) sum += (i % 2 ? 4 : 2) * f(a1 + i * h);
      return (sum * h) / 3;
    };
    const varying = solved({ spans: [{ L, k: 1 }], left: 'fixed', right: 'fixed', dists: [{ span: 0, a1, a2, w1, w2 }] });
    expect(varying.joints[0].M).toBeCloseTo(-simpson((x) => (wAt(x) * x * (L - x) ** 2) / L ** 2), 9);
    expect(varying.joints[1].M).toBeCloseTo(-simpson((x) => (wAt(x) * x ** 2 * (L - x)) / L ** 2), 9);
    // The page writes it for the end the load is `a` from, as it is worked out above: b is the one squared.
    expect(continuousPage.en.method.paragraphs[1]).toContain('a point load P, a from one end and b from the other, gives Pab²/L² at the first');
    expect(continuousPage.es.method.paragraphs[1]).toContain('una carga puntual P situada a la distancia a de un extremo y b del otro da Pab²/L² en el primero');
  });

  // "a span whose supports move apart by δ, its ends held against rotation,
  // takes 6kEIδ/L² at each end, k being its stiffness factor."
  it('a settlement between two fixed ends: 6kEIδ/L² at each end, and 12kEIδ/L³ of shear', () => {
    const k = 2;
    const EIdelta = 1000;
    const out = solved({ spans: [{ L, k }], left: 'fixed', right: 'fixed', settlements: [0, EIdelta] });
    // 6 × 2 × 1,000 ÷ 400 = 30: hogging where the support stayed, sagging where it went down.
    expect(out.joints.map((j) => j.M)).toEqual([near((-6 * k * EIdelta) / L ** 2), near((6 * k * EIdelta) / L ** 2)]);
    expect(out.joints.map((j) => j.M)).toEqual([near(-30), near(30)]);
    expect(out.reactions.map((r) => r.Rv)).toEqual([near((12 * k * EIdelta) / L ** 3), near((-12 * k * EIdelta) / L ** 3)]);
    // Twice as stiff a span takes twice the moment: the factor is in the formula.
    const soft = solved({ spans: [{ L, k: 1 }], left: 'fixed', right: 'fixed', settlements: [0, EIdelta] });
    expect(out.joints[1].M).toBeCloseTo(2 * soft.joints[1].M, 9);
    // The k of the formula is the field the form calls by that name.
    const factor = (lang: Lang) => continuousUi[lang].spans.stiffness.toLowerCase();
    expect(continuousPage.en.method.paragraphs[1]).toContain(`takes 6kEIδ/L² at each end, k being its ${factor('en')}.`);
    expect(continuousPage.es.method.paragraphs[1]).toContain(`recibe 6kEIδ/L² en cada extremo, siendo k su ${factor('es')}.`);
  });

  // "An end span whose end is free is a cantilever from its support; statics
  // gives the moment it brings there, and it adds no unknown."
  it('an overhang brings its support the moment of its own loads, whatever the rest of the beam is', () => {
    const c = 6;
    const loads = { dists: [{ span: 0, a1: 0, a2: c, w1: w, w2: w }], points: [{ span: 0, a: 1.5, P: 4 }] };
    // About the support, 6 ft from the free end: 1.5 × 6 × 3 + 4 × 4.5 = 45 kip·ft, hogging.
    const byStatics = -(w * c * (c / 2) + 4 * (c - 1.5));
    expect(byStatics).toBe(-45);
    const beams: ContinuousModel[] = [
      { spans: [{ L: c, k: 1 }, { L, k: 1 }], left: 'free', right: 'pin', ...loads },
      { spans: [{ L: c, k: 40 }, { L, k: 0.3 }, { L: 31, k: 5 }], left: 'free', right: 'fixed', ...loads },
      { spans: [{ L: c, k: 1 }, { L, k: 1 }], left: 'free', right: 'pin', dists: [...loads.dists, { span: 1, a1: 0, a2: L, w1: 9, w2: 9 }], points: loads.points },
    ];
    for (const model of beams) {
      const out = solved(model);
      expect(out.spans[0].kind).toBe('cantilever');
      expect(out.joints[1].M).toBeCloseTo(byStatics, 9);
      // At the free end itself: no support, no shear and no moment.
      expect(out.joints[0].support).toBeNull();
      expect(out.joints[0].M).toBe(0);
    }
  });

  // "With its two end moments known, each span is a simply supported beam
  // under its own loads and those two moments, and shear, moment, slope and
  // deflection inside it are closed forms worked out at the point asked for.
  // Nothing is interpolated between joints."
  it('inside a span the values are formulas worked out at the point: at places that are no station of the drawing', () => {
    const out = solved(equal(2, L, { dists: uniform([L, L], w) }));
    const stations = new Set(out.stations.map((s) => s.x));
    // By symmetry each span is propped: on a simple support at its outer end, held level over the middle one.
    // From the outer end: V = 3wL/8 − wx, M = 3wLx/8 − wx²/2, EI·v = −wx(L³ − 3Lx² + 2x³)/48 — the bracket
    // written (L − x)²(L + 2x), which is what it is and loses nothing beside the middle support.
    const largest = Math.abs(out.extremes.EIvMin.value);
    for (const x of [0.7310001, 3.3333331, 7.5000002, 12.3456789, 19.9990003]) {
      expect(stations.has(x), `${x} is a station`).toBe(false);
      const here = out.at(x);
      expect(here.V).toBeCloseTo((3 * w * L) / 8 - w * x, 10);
      expect(here.M).toBeCloseTo((3 * w * L * x) / 8 - (w * x ** 2) / 2, 10);
      expect((here.EIv - (-w * x * (L - x) ** 2 * (L + 2 * x)) / 48) / largest, `EI·v at ${x}`).toBeCloseTo(0, 12);
    }
  });

  // "A largest value is located on the polynomial itself, where its
  // derivative changes sign, and worked out there."
  it('a largest value is where the diagram turns, not at the nearest station: 3L/8 for the moment, L(1 + √33)/16 for the deflection', () => {
    const out = solved(equal(2, L, { dists: uniform([L, L], w) }));
    expect(out.spans[0].Mmax.x).toBeCloseTo((3 * L) / 8, 10);
    // The propped span's largest deflection: 8x³ − 9Lx² + L³ = 0 has the root x = L(1 + √33)/16 = 0.4215 L.
    const x = (L * (1 + Math.sqrt(33))) / 16;
    expect(8 * x ** 3 - 9 * L * x ** 2 + L ** 3).toBeCloseTo(0, 8);
    expect(out.spans[0].EIvChord.x).toBeCloseTo(x, 8);
    expect(out.spans[0].EIvChord.value).toBeCloseTo((-w * x * (L ** 3 - 3 * L * x ** 2 + 2 * x ** 3)) / 48, 8);
    // wL⁴ ÷ 184.6, as the tables give it.
    expect((w * L ** 4) / -out.spans[0].EIvChord.value).toBeCloseTo(184.6, 1);
    // Neither place is a station: 240 cells along the beam do not land on them.
    const stations = new Set(out.stations.map((s) => s.x));
    expect(stations.has(out.spans[0].EIvChord.x)).toBe(false);
  });

  // "between two joints an unloaded span bends into a cubic, which is the
  // element's own shape, and what the loads add inside the span is put back
  // in closed form."
  it('an unloaded span bends into a cubic: its moment is a straight line and the fourth difference of its deflection is nothing', () => {
    const out = solved(equal(2, L, { dists: uniform([L, L], w, false, [0]) }));
    const at = (x: number) => out.at(L + x);
    const h = 3.1;
    const v = [1, 2, 3, 4, 5].map((i) => at(i * h).EIv);
    const scale = Math.max(...v.map(Math.abs));
    // A cubic through five equally spaced points: v₁ − 4v₂ + 6v₃ − 4v₄ + v₅ = 0.
    expect((v[0] - 4 * v[1] + 6 * v[2] - 4 * v[3] + v[4]) / scale).toBeCloseTo(0, 11);
    // …and it is a cubic, not less: the third difference is the shear, which is not zero.
    expect(Math.abs(-v[0] + 3 * v[1] - 3 * v[2] + v[3]) / scale).toBeGreaterThan(1e-3);
    const M = [1, 2, 3].map((i) => at(i * h).M);
    expect(M[0] - 2 * M[1] + M[2]).toBeCloseTo(0, 10);
    // The loaded span is not one: there the load adds its own quartic.
    const loaded = [1, 2, 3, 4, 5].map((i) => out.at(i * h).EIv);
    expect(Math.abs(loaded[0] - 4 * loaded[1] + 6 * loaded[2] - 4 * loaded[3] + loaded[4]) / scale).toBeGreaterThan(1e-3);
  });

  // "Beam reactions and diagrams reaches the same result with no elements at
  // all, as its page says; on a beam that both can describe, the two
  // calculators agree, except where a value is so small that the other page
  // prints it as 0."
  it('on a beam both calculators can describe, the two engines give the same numbers', () => {
    const example = defaultContinuous();
    const forms: ContinuousForm[] = [
      example,
      {
        ...example,
        left: 'fixed',
        right: 'free',
        spans: [
          { id: 1, L: 17, k: 1, dead: 0.7, live: 0 },
          { id: 2, L: 26, k: 1, dead: 0.7, live: 1.1 },
          { id: 3, L: 8, k: 1, dead: 0.7, live: 0.4 },
        ],
        points: [{ id: 4, span: 1, a: 9.5, P: 14, dir: 'down', live: true }, { id: 5, span: 2, a: 8, P: 3, dir: 'up', live: false }],
        dists: [{ id: 6, span: 0, a1: 2, a2: 11, w1: 0.2, w2: 1.9, dir: 'down', live: false }],
        nextId: 7,
      },
    ];
    for (const form of forms) {
      const section = sectionProps(form);
      const ours = solved(toEngine(form, section, stiffness(form.units, section)).model);
      // The same beam as the first calculator holds one, solved by its own engine.
      const first = analyse(toBeamForm(form)).solution!;
      expect(first).toBeTruthy();
      const top = (of: (s: { V: number; M: number; EIv: number }) => number) => Math.max(...first.stations.map((s) => Math.abs(of(s))));
      const [V, M, Y] = [top((s) => s.V), top((s) => s.M), top((s) => s.EIv)];
      expect(ours.reactions.map((r) => r.Rv / V)).toEqual(first.reactions.map((r) => near(r.Rv / V)));
      for (let i = 0; i <= 200; i++) {
        const x = (ours.L * i) / 200 + 0.0123;
        if (x >= ours.L) continue;
        const [p, q] = [ours.at(x), first.at(x)];
        expect((p.V - q.V) / V, `V at ${x}`).toBeCloseTo(0, 9);
        expect((p.M - q.M) / M, `M at ${x}`).toBeCloseTo(0, 9);
        expect((p.EIv - q.EIv) / Y, `EIv at ${x}`).toBeCloseTo(0, 9);
      }
    }
    // The exception. Eight spans of 30 ft but the second, 3 in long; 1 kip/ft on the first alone. Past the loaded span each reaction is 2 − √3 =
    // 0.268 of the one before it, and the last two are under a millionth of the 467 kip beside the short span: what the first calculator's page
    // takes for rounding and prints as 0 (BeamCalculator.tsx, `noise`). The two ENGINES give them alike, and they are far over this page's own
    // floor, a billionth of the loads (analysis.ts) — hundreds of times over it — so this page prints them.
    const far: ContinuousForm = { ...example, everyArrangement: false, spans: [30, 0.25, 30, 30, 30, 30, 30, 30].map((L, i) => ({ id: i + 1, L, k: 1, dead: i === 0 ? 1 : 0, live: 0 })), settlements: Array.from({ length: 9 }, () => 0), nextId: 9 };
    const farSection = sectionProps(far);
    const here = solved(toEngine(far, farSection, stiffness(far.units, farSection)).model);
    const there = analyse(toBeamForm(far)).solution!;
    const largest = Math.max(...there.reactions.map((r) => Math.abs(r.Rv)));
    expect(largest).toBeCloseTo(467.1, 1);
    expect(here.reactions[4].Rv / here.reactions[3].Rv).toBeCloseTo(-(2 - Math.sqrt(3)), 4);
    const small = here.reactions.map((r, i) => ({ ours: r.Rv, theirs: there.reactions[i].Rv })).filter((r) => Math.abs(r.theirs) < 1e-6 * largest);
    expect(small.map((r) => r.ours)).toEqual([near(0.00013633, 8), near(-0.000022722, 9)]);
    for (const r of small) {
      expect(r.ours / r.theirs).toBeCloseTo(1, 5);
      expect(Math.abs(r.ours)).toBeGreaterThan(100 * 1e-9 * here.loadScale);
    }
    // A deflection as well as a force, and on the page's own example taken as one case: a thousandth of a foot past its second support the
    // beam has gone down 2.329 millionths of an inch, by both engines. The first calculator's page takes a deflection under a billionth of
    // the loads × L³ ÷ EI for rounding (BeamCalculator.tsx, `noise`: 5.5 millionths of an inch on this beam) and prints 0 there; this page's
    // floor for a deflection is lower (analysis.ts, `floors`), and it prints the value. So the sentence names no quantity the value is small beside.
    const one = analyseContinuous({ ...example, everyArrangement: false });
    const other = analyse(toBeamForm({ ...example, everyArrangement: false }));
    const down = other.solution!.at(24.001).EIv;
    expect(Math.abs(down)).toBeLessThan(1e-9 * other.loadScale * 78 ** 3);
    expect(Math.abs(down)).toBeGreaterThan(one.results!.floors.EIv);
    expect(one.results!.at(24.001).deflection).toEqual({ max: near(-2.3288e-6, 9), min: near(-2.3288e-6, 9) });
    expect(one.results!.at(24.001).deflection!.max / (down * other.toDeflection)).toBeCloseTo(1, 6);
    expect(continuousPage.en.method.paragraphs[3]).toContain('the two calculators agree, except where a value is so small that the other page prints it as 0.');
    expect(continuousPage.es.method.paragraphs[3]).toContain('las dos calculadoras coinciden, salvo donde un valor es tan pequeño que la otra página lo da como 0.');
    // …and the page's link to that calculator carries this very beam, when it can hold it.
    expect(decodeBeam(generalCode(example)!)!.supports.map((s) => [s.kind, s.x])).toEqual([['pin', 0], ['roller', 24], ['roller', 54], ['roller', 78]]);
  });
});

describe('continuous beam: what it says of the live load, the envelope does', () => {
  const example = defaultContinuous();
  const section = sectionProps(example);
  const { model } = toEngine(example, section, stiffness(example.units, section));
  const env = enveloped(model);
  /** The model with the live load of these spans only, solved on its own. */
  const arrangement = (base: ContinuousModel, on: number[]) => solved({ ...base, points: (base.points ?? []).filter((p) => !p.live || on.includes(p.span)), dists: (base.dists ?? []).filter((d) => !d.live || on.includes(d.span)) });
  /** Every arrangement of a model whose live load is on `spans`. */
  const everyArrangement = (base: ContinuousModel, spans: number[]) => Array.from({ length: 2 ** spans.length }, (_, mask) => arrangement(base, spans.filter((_, i) => mask & (1 << i))));

  // "2ⁿ arrangements for n spans with live load, 256 for eight."
  it('eight spans is the most the form takes, and 2⁸ = 256 arrangements', () => {
    expect(MAX_SPANS).toBe(8);
    for (const lang of LANGS) expect(continuousPage[lang].method.paragraphs[4]).toContain(lang === 'en' ? '2ⁿ arrangements for n spans with live load' : '2ⁿ disposiciones para n vanos con carga viva');
    for (const lang of LANGS) {
      expect(continuousPage[lang].method.paragraphs.filter((p) => p.includes(lang === 'en' ? '256 for eight' : '256 para ocho'))).toHaveLength(1);
      expect(continuousPage[lang].sub).toContain(lang === 'en' ? 'up to eight' : 'hasta ocho');
    }
    // "One span or several, up to eight": a ninth is not added, and the last one is not removed.
    let form = example;
    for (let i = 0; i < 12; i++) form = reduceContinuous(form, { type: 'add', list: 'spans' });
    expect(form.spans).toHaveLength(8);
    // 2⁸: each new span took the live load of the one before it, and the form counts a span that carries one.
    expect(2 ** analyseContinuous(form).liveSpans.length).toBe(256);
    for (const span of [...form.spans]) form = reduceContinuous(form, { type: 'remove', list: 'spans', id: span.id });
    expect(form.spans).toHaveLength(1);
  });

  // "At any point the highest value of a response is the first of those plus
  // every span's effect that raises it there, and the lowest is the first
  // plus every effect that lowers it: the extremes of all the arrangements,
  // exactly." The example has three spans with live load: eight arrangements,
  // each solved here in full, one by one — which the page does not do.
  it('the band is the highest and the lowest of all the arrangements, at every point asked', () => {
    const all = everyArrangement(model, [0, 1, 2]);
    expect(all).toHaveLength(8);
    for (let i = 0; i <= 156; i++) {
      const x = 0.5 * i + 0.0371;
      if (x >= env.L) continue;
      const band = env.at(x);
      const each = all.map((s) => s.at(x));
      const scale = { V: 33, M: 167, EIv: 8057 };
      for (const r of ['V', 'M', 'EIv'] as const) {
        expect((band[r].max - Math.max(...each.map((s) => s[r]))) / scale[r], `${r} max at ${x}`).toBeCloseTo(0, 11);
        expect((band[r].min - Math.min(...each.map((s) => s[r]))) / scale[r], `${r} min at ${x}`).toBeCloseTo(0, 11);
      }
    }
    // …and it is reached as the method says, not by those eight: "It is solved once under what is always there and once under each span's
    // live load alone" — four beams — and the highest is the first plus every effect that raises it, the lowest the first plus every one that lowers it.
    const always = solved({ ...model, dists: model.dists!.filter((d) => !d.live) });
    const alone = [0, 1, 2].map((i) => solved({ ...model, dists: model.dists!.filter((d) => d.live && d.span === i) }));
    const size = { V: 33, M: 167, EIv: 8057 };
    for (const x of [5.3, 17, 24, 31.9, 47.2, 60, 71.4]) {
      const band = env.at(x);
      for (const r of ['V', 'M', 'EIv'] as const) {
        const effects = alone.map((s) => s.at(x)[r]);
        const sum = (sign: 1 | -1) => effects.filter((e) => sign * e > 0).reduce((total, e) => total + e, always.at(x)[r]);
        expect((band[r].max - sum(1)) / size[r], `${r} max at ${x}`).toBeCloseTo(0, 11);
        expect((band[r].min - sum(-1)) / size[r], `${r} min at ${x}`).toBeCloseTo(0, 11);
      }
    }
    expect(continuousPage.en.method.paragraphs[5]).toContain('It is solved once under what is always there and once under each span’s live load alone.');
    expect(continuousPage.es.method.paragraphs[5]).toContain('Se resuelve una vez con lo que siempre está y una vez con la carga viva de cada vano por separado.');
  });

  // "Dead loads and settlements are in all of them." With no live load there
  // is one arrangement, and the band has no width.
  it('what is not live is in every arrangement: with no live load the band is the one solution', () => {
    const dead: ContinuousModel = { ...model, settlements: [0, 2000, 0, -500], dists: model.dists!.map((d) => ({ ...d, live: false })) };
    const band = enveloped(dead);
    const one = solved(dead);
    for (const x of [3, 11.7, 24, 40.2, 54, 77]) {
      const [b, s] = [band.at(x), one.at(x)];
      expect([b.V.max, b.V.min, b.M.max, b.M.min, b.EIv.max, b.EIv.min]).toEqual([s.V, s.V, s.M, s.M, s.EIv, s.EIv]);
    }
    // …and with a live load, the dead load and the settlement are in the arrangement with no live load at all.
    const mixed: ContinuousModel = { ...model, settlements: [0, 2000, 0, -500] };
    const none = arrangement(mixed, []);
    expect(none.joints.map((j) => j.EIv)).toEqual([0, -2000, 0, 500]);
    expect(none.totalLoad).toBeCloseTo(0.9 * 78, 9);
  });

  // "Each largest value over the arrangements comes with the spans whose
  // live load is on when it occurs."
  it('each largest value names its arrangement: solved on its own, that arrangement gives the value', () => {
    const check = (g: Governing, of: (s: ContinuousSolution) => number) => expect(of(arrangement(model, g.spans)), JSON.stringify(g)).toBeCloseTo(g.value, 8);
    for (const [j, joint] of env.joints.entries()) {
      for (const g of [joint.M.max, joint.M.min]) check(g, (s) => s.joints[j].M);
      for (const g of [joint.Rv.max, joint.Rv.min]) check(g, (s) => s.reactions[j].Rv);
    }
    for (const span of env.spans) {
      check(span.Mmax, (s) => s.at(span.Mmax.x).M);
      check(span.Mmin, (s) => s.at(span.Mmin.x, span.Mmin.x === span.to ? 'left' : 'right').M);
    }
    // The pattern every engineer knows, on the page's own example. Hogging over
    // a support: the two spans beside it. Sagging in a span: that span and every
    // second one from it. A reaction: the same spans as the hogging moment there.
    expect(env.joints[1].M.min.spans).toEqual([0, 1]);
    expect(env.joints[2].M.min.spans).toEqual([1, 2]);
    expect(env.spans.map((s) => s.Mmax.spans)).toEqual([[0, 2], [1], [0, 2]]);
    expect(env.joints.map((j) => j.Rv.max.spans)).toEqual([[0, 2], [0, 1], [1, 2], [0, 2]]);
    // The example by hand, under all its loads: 2.1 kip/ft on 24, 30 and 24 ft. The three-moment equation at
    // either interior support, M the same at both by symmetry: M(2(24 + 30) + 30) = −(2.1 ÷ 4)(24³ + 30³),
    // M = −21,432.6 ÷ 138 = −155.3 kip·ft. With the live load of the third span off it is lower still: −166.9.
    expect(env.all.joints[1].M).toBeCloseTo(-21432.6 / 138, 9);
    expect(env.joints[1].M.min.value).toBeCloseTo(-166.867, 3);
  });

  // "The two edges, and two points of one edge, are in general from different
  // arrangements."
  it('one edge of a band is not one arrangement: the largest sagging moment of each span has its own', () => {
    const top = env.spans.map((s) => s.Mmax.spans.join());
    expect(new Set(top).size).toBeGreaterThan(1);
    // No single arrangement reaches the upper edge everywhere: each falls short of it somewhere.
    for (const one of everyArrangement(model, [0, 1, 2])) {
      const short = env.spans.some((s) => one.at(s.Mmax.x).M < s.Mmax.value - 1);
      expect(short).toBe(true);
    }
  });

  // "A span's live load is all on or all off: no part of it is taken on its
  // own." Two live loads on one span that undo each other at
  // midspan: 10 kip down at the quarter point and 10 kip up at the three-
  // quarter point. Taken one at a time the first alone would give
  // 10 × 20 ÷ 8 = 25 kip·ft at midspan; taken as the span's live load, they
  // are both on or both off, and the moment there is nothing either way.
  it('every live load on a span goes on and off with it: no part of a span is loaded alone', () => {
    const L = 20;
    const band = enveloped({ spans: [{ L, k: 1 }], left: 'pin', right: 'pin', points: [{ span: 0, a: L / 4, P: 10, live: true }, { span: 0, a: (3 * L) / 4, P: -10, live: true }] });
    expect(band.at(L / 2).M.max).toBeCloseTo(0, 9);
    expect(band.at(L / 2).M.min).toBeCloseTo(0, 9);
    // The first load by itself, which no arrangement here is: PL/8.
    const alone = solved({ spans: [{ L, k: 1 }], left: 'pin', right: 'pin', points: [{ span: 0, a: L / 4, P: 10 }] });
    expect(alone.at(L / 2).M).toBeCloseTo(25, 9);
    // A live load that covers part of a span IS that span's live load, whole: the span is named with what it causes, as on or off.
    const part = enveloped({ spans: [{ L, k: 1 }, { L, k: 1 }], left: 'pin', right: 'pin', dists: [{ span: 1, a1: 0, a2: 5, w1: 2, w2: 2, live: true }] });
    expect(part.spans[1].Mmax.spans).toEqual([1]);
    expect(part.joints[1].M.min.spans).toEqual([1]);
    expect(continuousPage.en.limits.items[1]).toContain('A span’s live load is all on or all off: no part of it is taken on its own');
    expect(continuousPage.es.limits.items[1]).toContain('Cada vano tiene su carga viva entera o no la tiene: no se toma por separado una parte de ella');
  });

  // "A span whose live load has no effect on a value is not listed with it:
  // no load on another span puts shear or moment in an overhang, for one."
  it('no load on another span reaches an overhang, and none is named with its values', () => {
    const lengths = [6, 20, 20];
    const beam: ContinuousModel = { spans: lengths.map((L) => ({ L, k: 1 })), left: 'free', right: 'pin', dists: uniform(lengths, 1, true) };
    const others = solved({ ...beam, dists: uniform(lengths, 1, true, [1, 2]) });
    for (const x of [0, 1.3, 4.1, 5.999]) expect([others.at(x).V, others.at(x).M]).toEqual([0, 0]);
    const band = enveloped(beam);
    expect(band.spans[0].kind).toBe('cantilever');
    // 1 kip/ft on 6 ft: −6 kip and −18 kip·ft at the support, with the overhang's own load and no other.
    expect([band.spans[0].Vmin.value, band.spans[0].Vmin.spans]).toEqual([near(-6), [0]]);
    expect([band.spans[0].Mmin.value, band.spans[0].Mmin.spans]).toEqual([near(-18), [0]]);
    // The other way round it does reach: the overhang's load is in the arrangement of the next span's largest shear.
    expect(band.spans[1].Vmax.spans).toContain(0);
  });
});

describe('continuous beam: what the notes say of the tool, the tool does', () => {
  const example = defaultContinuous();
  const form = (over: Partial<ContinuousForm> = {}): ContinuousForm => ({ ...example, ...over });
  const engine = (f: ContinuousForm, shape?: SteelShape) => {
    const section = sectionProps(f, shape);
    const EI = stiffness(f.units, section);
    return { section, EI, ...toEngine(f, section, EI) };
  };

  // "Each span has one flexural stiffness along its length: the section's EI
  // times that span's factor."
  it('a span’s stiffness is the section’s EI times its factor: 5wL⁴/(384·k·EI) at midspan, and Clapeyron with two stiffnesses', () => {
    const [L, w, k] = [20, 1.5, 2.5];
    const one = solveContinuous({ spans: [{ L, k }], left: 'pin', right: 'pin', dists: [{ span: 0, a1: 0, a2: L, w1: w, w2: w }] });
    if (!one.ok) throw new Error('not solved');
    // EI·v of the reference section: 5 × 1.5 × 20⁴ ÷ 384 = 3,125, over the factor.
    expect(one.extremes.EIvMin.value).toBeCloseTo((-5 * w * L ** 4) / (384 * k), 8);
    expect(one.extremes.EIvMin.value).toBeCloseTo(-3125 / 2.5, 8);
    // Bending alone, and nothing added for shear: "with shear deformation left out".
    expect(continuousPage.en.assumes.items[3]).toContain('with shear deformation left out');
    expect(continuousPage.es.assumes.items[3]).toContain('la deformación por cortante queda fuera');
    // The form's own line on the factor: "1 is that section, 2 a span twice as stiff" — at 2 the same span deflects half as much as at 1.
    const [stiff, plain] = [2, 1].map((factor) => solved({ spans: [{ L, k: factor }], left: 'pin', right: 'pin', dists: [{ span: 0, a1: 0, a2: L, w1: w, w2: w }] }).extremes.EIvMin.value);
    expect(stiff / plain).toBeCloseTo(0.5, 12);
    expect(continuousUi.en.spans.note).toContain('1 is that section, 2 a span twice as stiff');
    expect(continuousUi.es.spans.note).toContain('1 es esa sección; 2, un vano el doble de rígido');
    // Two spans of 20 and 30 ft, the second twice as stiff. The three-moment equation with a stiffness in each span:
    // 2M(L₁/k₁ + L₂/k₂) = −(w/4)(L₁³/k₁ + L₂³/k₂) → M = −1.5 × (8,000 + 13,500) ÷ (8 × 35) = −115.1786 kip·ft.
    const two = solveContinuous({ spans: [{ L: 20, k: 1 }, { L: 30, k: 2 }], left: 'pin', right: 'pin', dists: [{ span: 0, a1: 0, a2: 20, w1: w, w2: w }, { span: 1, a1: 0, a2: 30, w1: w, w2: w }] });
    if (!two.ok) throw new Error('not solved');
    expect(two.joints[1].M).toBeCloseTo((-w * (20 ** 3 / 1 + 30 ** 3 / 2)) / (8 * (20 / 1 + 30 / 2)), 9);
    expect(two.joints[1].M).toBeCloseTo(-115.1786, 4);
    // With one stiffness it is another moment: the factor is not decoration. −1.5 × 35,000 ÷ 400 = −131.25.
    const same = solveContinuous({ spans: [{ L: 20, k: 1 }, { L: 30, k: 1 }], left: 'pin', right: 'pin', dists: [{ span: 0, a1: 0, a2: 20, w1: w, w2: w }, { span: 1, a1: 0, a2: 30, w1: w, w2: w }] });
    if (!same.ok) throw new Error('not solved');
    expect(same.joints[1].M).toBeCloseTo(-131.25, 9);
    // The form hands the factor over as it is.
    expect(engine(form({ spans: example.spans.map((s, i) => ({ ...s, k: i + 0.5 })) })).model.spans.map((s) => s.k)).toEqual([0.5, 1.5, 2.5]);
  });

  // "Every joint between two spans is a simple support. Each end of the beam
  // is on a simple support, fixed, or free." — and "a simple support does not
  // restrain rotation".
  it('the joints between spans are simple supports; an end is a simple support, fixed or free', () => {
    const kinds = (left: ContinuousForm['left'], right: ContinuousForm['right']) => {
      const out = solveContinuous(engine(form({ left, right })).model);
      if (!out.ok) throw new Error('not solved');
      return out;
    };
    expect(kinds('pin', 'pin').joints.map((j) => j.support)).toEqual(['pin', 'roller', 'roller', 'roller']);
    expect(kinds('fixed', 'free').joints.map((j) => j.support)).toEqual(['fixed', 'pin', 'roller', null]);
    expect(kinds('free', 'fixed').joints.map((j) => j.support)).toEqual([null, 'pin', 'roller', 'fixed']);
    // Only a fixed end takes a moment from the beam; a simple support takes a force and nothing else.
    expect(kinds('fixed', 'pin').reactions.map((r) => r.Rm !== 0)).toEqual([true, false, false, false]);
    // Free at both ends, on its two interior supports: held. A single span with a free end and no wall: not held.
    expect(kinds('free', 'free').reactions).toHaveLength(2);
    const loose = solveContinuous({ spans: [{ L: 20, k: 1 }], left: 'pin', right: 'free' });
    expect(loose.ok ? [] : loose.issues.map((i) => i.code)).toEqual(['unstable']);
  });

  // "The effects of loads add, which is what allows the arrangements to be
  // combined."
  it('the effects of loads add: two sets of loads solved apart are the two together', () => {
    const { model } = engine(form({ left: 'fixed' }));
    const dead = solveContinuous({ ...model, dists: model.dists!.filter((d) => !d.live) });
    const live = solveContinuous({ ...model, dists: model.dists!.filter((d) => d.live) });
    const both = solveContinuous(model);
    if (!dead.ok || !live.ok || !both.ok) throw new Error('not solved');
    for (const x of [4.4, 19, 24, 38.123, 60, 77.5]) {
      for (const r of ['V', 'M', 'EItheta', 'EIv'] as const) expect(dead.at(x)[r] + live.at(x)[r], `${r} at ${x}`).toBeCloseTo(both.at(x)[r], 8);
    }
  });

  // "It applies no design code and no load factor … Dead and live loads are
  // used as entered, and an arrangement is their plain sum."
  it('the loads are used as entered: every reaction of the example adds up to 2.1 kip/ft on 78 ft, no more', () => {
    const { model } = engine(example);
    // What the form sends is what was typed: 0.9 and 1.2 on each span, the second marked live.
    expect(model.dists!.map((d) => [d.span, d.w1, d.w2, d.live])).toEqual([[0, 0.9, 0.9, false], [0, 1.2, 1.2, true], [1, 0.9, 0.9, false], [1, 1.2, 1.2, true], [2, 0.9, 0.9, false], [2, 1.2, 1.2, true]]);
    const env = envelopeContinuous(model);
    if (!env.ok) throw new Error('not solved');
    // (0.9 + 1.2) × 78 = 163.8 kip.
    expect(env.all.reactions.reduce((sum, r) => sum + r.Rv, 0)).toBeCloseTo(163.8, 9);
    expect(env.all.totalLoad).toBeCloseTo(163.8, 9);
  });

  // "No internal hinges and no applied moments. Beam reactions and diagrams
  // has both, and the form links to it with this beam when that calculator
  // can hold it."
  it('the link to the first calculator is there when that calculator can hold the beam, and only then', () => {
    expect(generalCode(example)).not.toBeNull();
    // One EI along the beam there, and supports that do not move.
    expect(generalCode(form({ spans: example.spans.map((s, i) => (i === 1 ? { ...s, k: 2 } : s)) }))).toBeNull();
    expect(generalCode(form({ settlements: [0, 0.25, 0, 0] }))).toBeNull();
    // A settlement kept for an end that is free is nobody's: the beam can still be opened there.
    expect(generalCode(form({ right: 'free', settlements: [0, 0, 0, 0.25] }))).not.toBeNull();
    // What that calculator has and this one has not: its form carries hinges and applied moments, this one's none.
    const there = decodeBeam(generalCode(example)!)!;
    expect([there.hinges, there.couples]).toEqual([[], []]);
    expect(Object.keys(example)).not.toEqual(expect.arrayContaining(['hinges']));
    expect(Object.keys(example)).not.toEqual(expect.arrayContaining(['couples']));
  });

  // "A settlement is a length you enter … and it needs E and I to become
  // forces." — and, under Signs: "entered as a length downward, in inches or
  // millimetres; the support's deflection is then that length, downward."
  it('a settlement is a length, downward, in the unit a deflection is shown in — and nothing is solved for it without E and I', () => {
    expect([UNITS.us.dim, UNITS.si.dim]).toEqual(['in', 'mm']);
    expect([UNITS.us.deflection, UNITS.si.deflection]).toEqual(['in', 'mm']);
    const settled = form({ settlements: [0, 0.5, 0, 0] });
    const { model, EI } = engine(settled);
    expect(formIssues(settled, EI)).toEqual([]);
    const out = solveContinuous(model);
    if (!out.ok) throw new Error('not solved');
    // Positive upward in the results: half an inch down is −0.5 in at that support, and nothing at the others.
    expect(out.joints.map((j) => j.EIv * deflectionFactor('us', EI))).toEqual([near(0), near(-0.5), near(0), near(0)]);
    // Without I there is no EI: the form says so on that support, and an engine asked all the same refuses the beam.
    const bare = form({ settlements: [0, 0.5, 0, 0], section: { ...example.section, I: 0 } });
    const none = engine(bare);
    expect(none.EI).toBe(0);
    expect(formIssues(bare, none.EI)).toEqual([{ code: 'settlement', row: { list: 'settlements', joint: 1 } }]);
    const refused = solveContinuous(none.model);
    expect(refused.ok ? [] : refused.issues).toEqual([{ code: 'number', where: { list: 'settlements', index: 1 } }]);
    // Without a settlement, the same beam is solved: reactions and moments ask for no EI.
    expect(solveContinuous(engine(form({ section: { ...example.section, I: 0 } })).model).ok).toBe(true);
    // The form's line on the section: "Where no support settles, shear and moment are the same for any section" — a tenth of the I, the same moment over
    // the second support; and where one does settle, on a beam with no load, a tenth of the moment.
    const thin = { ...example.section, I: 84.3 };
    const unloaded = example.spans.map((s) => ({ ...s, dead: 0, live: 0 }));
    const over = (f: ContinuousForm) => solved(engine(f).model).joints[1].M;
    expect(over(form({ section: thin }))).toBeCloseTo(over(example), 9);
    expect(over(form({ spans: unloaded, settlements: [0, 0.5, 0, 0], section: thin })) / over(form({ spans: unloaded, settlements: [0, 0.5, 0, 0] }))).toBeCloseTo(0.1, 9);
    expect(continuousUi.en.section.intro).toContain('Where no support settles, shear and moment are the same for any section');
    expect(continuousUi.es.section.intro).toContain('Si ningún apoyo se asienta, el cortante y el momento son los mismos con cualquier sección');
    // Which way, in the form's words and in the notes': downward.
    expect(continuousUi.en.settlements.note).toContain('as a length downward');
    expect(continuousUi.es.settlements.note).toContain('como longitud hacia abajo');
    expect(continuousPage.en.signs.items[2]).toContain('A settlement is entered as a length downward');
    expect(continuousPage.es.signs.items[2]).toContain('Un asentamiento se introduce como una longitud hacia abajo');
  });

  // "Stresses are of the section entered: M/S in bending and, for shear, the
  // rule printed with the value — V over a shear area, 1.5V/A for a
  // rectangle. Where any span's stiffness factor is not 1, that span is
  // another section and no stress is printed at all."
  it('the stresses are M/S and the shear rule of the section — 1.5V/A for a rectangle — and the section is every span’s only while every factor is 1', () => {
    expect(oneSection(example)).toBe(true);
    expect(oneSection(form({ spans: example.spans.map((s, i) => (i === 2 ? { ...s, k: 1.5 } : s)) }))).toBe(false);
    // A rectangle 12 in wide and 24 in deep: S = 12 × 24² ÷ 6 = 1,152 in³, A = 288 in². 96 kip·ft is 96 × 12 ÷ 1,152 = 1 ksi;
    // 28.8 kip is 1.5 × 28.8 ÷ 288 = 0.15 ksi — not the 0.1 ksi of V ÷ A.
    const rect = sectionProps(form({ section: { ...example.section, mode: 'rect', b: 12, h: 24 } }));
    expect(bendingStress('us', rect, 96)).toBeCloseTo(1, 12);
    expect(shearStress('us', rect, 28.8)).toBeCloseTo(0.15, 12);
    // Any other section: V over its shear area. The example's is 7.245 in².
    expect(shearStress('us', sectionProps(example), 7.245)).toBeCloseTo(1, 12);
    for (const lang of LANGS) {
      const line = continuousPage[lang].limits.items.filter((x) => x.includes('M/S'));
      expect(line).toHaveLength(1);
      expect(line[0]).toContain(lang === 'en' ? 'V over a shear area, 1.5V/A for a rectangle' : 'V entre un área de cortante, 1.5V/A en un rectángulo');
      expect(line[0]).toContain(lang === 'en' ? 'Where any span’s stiffness factor is not 1, that span is another section and no stress is printed at all' : 'Si el factor de rigidez de algún vano no es 1, ese vano es otra sección y no se da ningún esfuerzo en toda la viga');
      // The sentence that was here gave V/Av for every section: a rectangle's is not that.
      expect(line[0]).not.toContain('V/Av');
    }
  });

  // "A span under 1/1000 of the whole length, or a stiffness factor outside
  // 0.001 to 1,000, is refused."
  it('the two limits the notes give are the engine’s: a thousandth of the length, and a factor from 0.001 to 1,000', () => {
    expect(SHORT).toBe(1 / 1000);
    expect([1 / STIFF, STIFF]).toEqual([0.001, 1000]);
    const codes = (spans: { L: number; k: number }[]) => {
      const out = solveContinuous({ spans, left: 'pin', right: 'pin', dists: [{ span: 0, a1: 0, a2: spans[0].L, w1: 1, w2: 1 }] });
      return out.ok ? [] : out.issues.map((i) => [i.code, i.where?.index]);
    };
    // 1 in 1,000 of the whole length is taken; a little under it is not, and the span is named.
    expect(codes([{ L: 1, k: 1 }, { L: 999, k: 1 }])).toEqual([]);
    expect(codes([{ L: 0.99, k: 1 }, { L: 999.01, k: 1 }])).toEqual([['short-span', 0]]);
    expect(codes([{ L: 20, k: 0.001 }, { L: 20, k: 1000 }])).toEqual([]);
    expect(codes([{ L: 20, k: 0.00099 }, { L: 20, k: 1 }])).toEqual([['stiffness', 0]]);
    expect(codes([{ L: 20, k: 1 }, { L: 20, k: 1001 }])).toEqual([['stiffness', 1]]);
    for (const lang of LANGS) {
      const line = continuousPage[lang].limits.items.filter((x) => x.includes('1/1000'));
      expect(line).toHaveLength(1);
      expect(line[0]).toContain(lang === 'en' ? '0.001 to 1,000' : '0.001 a 1000');
    }
  });

  // "With a steel shape and its own-weight box ticked, that weight is a dead
  // load on every span."
  it('own weight is a load only for a steel shape with its box ticked: the shape’s own, on every span, and never live', () => {
    const W21X44: SteelShape = { designation: 'W21X44', family: 'W', weight: 44, A: 13, d: 20.7, tw: 0.35, Ix: 843, Sx: 81.6 };
    const own = (f: ContinuousForm, shape?: SteelShape) => engine(f, shape).model.dists!.filter((d) => d.w1 !== 0.9 && d.w1 !== 1.2);
    expect(own(example)).toEqual([]);
    expect(own(form({ section: { ...example.section, mode: 'rect' } }))).toEqual([]);
    expect(own(form({ section: { ...example.section, mode: 'shape', selfWeight: false } }), W21X44)).toEqual([]);
    // 44 lb/ft is 0.044 kip/ft, over the whole of each span.
    expect(own(form({ section: { ...example.section, mode: 'shape', selfWeight: true } }), W21X44)).toEqual([24, 30, 24].map((L, span) => ({ span, a1: 0, a2: L, w1: near(0.044, 12), w2: near(0.044, 12), live: false })));
    expect(continuousPage.en.limits.items[7]).toContain('that weight is a dead load on every span');
    expect(continuousPage.es.limits.items[7]).toContain('ese peso es una carga muerta en todos los vanos');
  });

  // "Each span's two uniform loads, dead and live, are positive downward: a
  // minus sign turns one upward. The further loads have a direction of their
  // own, and each is marked dead or live." —
  // and "A further load is placed from the left end of its own span, not of
  // the beam. In the results x runs along the whole beam, from its left end."
  it('signs and places: a span’s two loads push down, a further load has its own direction and is placed in its own span', () => {
    const loaded = form({
      points: [{ id: 4, span: 1, a: 5, P: 7, dir: 'up', live: true }],
      dists: [{ id: 5, span: 2, a1: 3, a2: 9, w1: 0.4, w2: 0.8, dir: 'down', live: false }],
      nextId: 6,
    });
    const { model } = engine(loaded);
    // Down is positive for the engine: the spans' own loads as typed, the upward point load with a minus.
    for (const d of model.dists!.slice(0, 6)) expect(d.w1).toBeGreaterThan(0);
    expect(model.points).toEqual([{ span: 1, a: 5, P: -7, live: true }]);
    expect(model.dists!.at(-1)).toEqual({ span: 2, a1: 3, a2: 9, w1: 0.4, w2: 0.8, live: false });
    const out = solveContinuous(model);
    if (!out.ok) throw new Error('not solved');
    // 5 ft into the second span is 24 + 5 = 29 ft along the beam; 3 and 9 ft into the third are 57 and 63.
    expect(out.breaks).toEqual([0, 24, 29, 54, 57, 63, 78]);
    // The upward load lifts the beam there: the shear rises by 7 kip across it.
    expect(out.at(29, 'right').V - out.at(29, 'left').V).toBeCloseTo(7, 9);
    // A span's own load typed with a minus sign reaches the engine with it: upward.
    expect(engine(form({ spans: example.spans.map((s) => ({ ...s, dead: -0.9 })) })).model.dists!.filter((d) => !d.live).map((d) => d.w1)).toEqual([-0.9, -0.9, -0.9]);
    expect(continuousPage.en.signs.items[0]).toContain('are positive downward: a minus sign turns one upward');
    expect(continuousPage.es.signs.items[0]).toContain('son positivas hacia abajo: con signo menos, una actúa hacia arriba');
  });

  // "A sagging moment is positive, so the hogging moment that gravity loads
  // usually cause over an interior support is negative; an arrangement of the
  // live load, or an overhang, can make the moment there positive. Shear is
  // positive when the forces to the left of a cut add up to an upward one."
  it('a sagging moment is positive; over an interior support the moment is usually negative, not always; and shear is the upward sum of what is to the left', () => {
    const out = solveContinuous(engine(example).model);
    if (!out.ok) throw new Error('not solved');
    expect(out.joints.slice(1, -1).every((j) => j.M < 0)).toBe(true);
    expect(out.spans.every((s) => s.Mmax.value > 0)).toBe(true);
    // Just right of the left support: its reaction, upward, and nothing else yet.
    expect(out.at(0, 'right').V).toBeCloseTo(out.reactions[0].Rv, 9);
    // 10 ft along: that reaction less 2.1 kip/ft over 10 ft.
    expect(out.at(10).V).toBeCloseTo(out.reactions[0].Rv - 21, 9);
    // "Usually". Three equal spans of 20 ft, no dead load, 1 kip/ft live on the first alone. Clapeyron: 4·MB + MC = −wL²/4 and MB + 4·MC = 0
    // give MB = −wL²/15 and MC = +wL²/60: the far interior support SAGS, 400 ÷ 60 = 6.667 kip·ft, under a load that only pushes down.
    const lone = solved(equal(3, 20, { dists: uniform([20, 20, 20], 1, true, [0]) }));
    expect(lone.joints.map((j) => j.M)).toEqual([0, near(-400 / 15), near(400 / 60), 0]);
    const band = enveloped(equal(3, 20, { dists: uniform([20, 20, 20], 1, true) }));
    expect([band.joints[2].M.max.value, band.joints[2].M.max.spans]).toEqual([near(400 / 60), [0]]);
    // And an overhang: the example with its right end free, the live load on the overhang alone. 2.1 × 24² ÷ 2 = 604.8 kip·ft hogging over its
    // support, and 108·MB = −0.225 × (24³ + 30³) + 30 × 604.8 = 8,958.6: MB = +82.95 kip·ft over the second support.
    const hung = enveloped(engine(form({ right: 'free' })).model);
    expect([hung.joints[1].M.max.value, hung.joints[1].M.max.spans]).toEqual([near(8958.6 / 108), [2]]);
    expect(continuousPage.en.signs.items[3]).toContain('the hogging moment that gravity loads usually cause over an interior support is negative; an arrangement of the live load, or an overhang, can make the moment there positive');
    expect(continuousPage.es.signs.items[3]).toContain('el momento que las cargas de gravedad suelen producir sobre un apoyo intermedio es negativo; una disposición de la carga viva, o un voladizo, puede volverlo positivo');
    expect(continuousPage.en.signs.items[3]).toContain('Shear is positive when the forces to the left of a cut add up to an upward one');
    expect(continuousPage.es.signs.items[3]).toContain('El cortante es positivo cuando las fuerzas a la izquierda de un corte suman una fuerza hacia arriba');
  });

  // "The deflection of a span is measured from the straight line through its
  // two supports, so that a settlement is not counted as bending; an
  // overhang's is measured from its support. The deflection diagram, the
  // largest deflection and the one at a point are the movement of the beam
  // itself, a settlement included. Where a deflection is printed with a sign,
  // upward is positive; a slope is positive counter-clockwise, in radians."
  it('a span’s deflection is from the line through its supports, an overhang’s from its support: a settlement alone bends neither', () => {
    // One span whose right support goes down: the beam tilts and stays straight.
    const tilted = solveContinuous({ spans: [{ L: 20, k: 1 }], left: 'pin', right: 'pin', settlements: [0, 800] });
    if (!tilted.ok) throw new Error('not solved');
    expect(tilted.at(10).EIv).toBeCloseTo(-400, 9);
    expect(tilted.spans[0].EIvChord.value).toBe(0);
    expect(tilted.extremes.Mmax.value).toBe(0);
    // A cantilever of 10 ft whose wall goes down by the same, with 3 kip at its tip: the tip drops PL³/3 = 1,000
    // from the wall, and 1,800 in all.
    const hung = solveContinuous({ spans: [{ L: 10, k: 1 }], left: 'fixed', right: 'free', settlements: [800], points: [{ span: 0, a: 10, P: 3 }] });
    if (!hung.ok) throw new Error('not solved');
    expect(hung.spans[0].kind).toBe('cantilever');
    expect(hung.spans[0].EIvChord).toEqual({ value: near(-1000), x: 10 });
    expect(hung.at(10).EIv).toBeCloseTo(-1800, 9);
    expect(continuousPage.en.signs.items[4]).toContain('measured from the straight line through its two supports, so that a settlement is not counted as bending; an overhang’s is measured from its support.');
    expect(continuousPage.es.signs.items[4]).toContain('se mide respecto a la recta que une sus dos apoyos, para que un asentamiento no cuente como flexión; la de un voladizo, respecto a su apoyo.');
    // What that column leaves out, the other three places count. The example under all its loads, its second support 1 in down:
    const sunk = analyseContinuous(form({ everyArrangement: false, settlements: [0, 1, 0, 0] })).results!;
    // at that support the beam is 1 in DOWN, and the value at a point says so with a minus — upward is positive;
    expect(sunk.at(24).deflection).toEqual({ max: near(-1), min: near(-1) });
    // the largest deflection is the beam's own movement, more than the settlement and more than any span's deflection from its supports;
    const most = sunk.largest.deflection!.value;
    expect(most).toBeLessThan(-1);
    for (const span of sunk.spans) expect(Math.abs(span.deflection!.value)).toBeLessThan(0.5);
    // the diagram labels that same movement, with its sign;
    expect(sunk.diagrams.D!.marks.map((mark) => mark.y)).toContain(most);
    // and the second span, which climbs to the right from the support that went down, turns counter-clockwise: a positive slope.
    expect(sunk.at(39).slope!.max).toBeGreaterThan(0);
    // One span of 24 ft under 2.1 kip/ft turns clockwise at its left end, by wL³/24EI = 2.1 × 24³ ÷ (24 × 169,770.83) = 0.007125 rad: negative.
    const single = analyseContinuous(form({ everyArrangement: false, spans: [{ id: 1, L: 24, k: 1, dead: 2.1, live: 0 }], settlements: [0, 0] })).results!;
    expect(single.at(0).slope!.max).toBeCloseTo((-2.1 * 24 ** 3) / (24 * ((29000 * 843) / 144)), 9);
    expect(continuousPage.en.signs.items[4]).toContain('The deflection diagram, the largest deflection and the one at a point are the movement of the beam itself, a settlement included. Where a deflection is printed with a sign, upward is positive; a slope is positive counter-clockwise, in radians.');
    expect(continuousPage.es.signs.items[4]).toContain('El diagrama de deflexión, la deflexión máxima y la de un punto son el movimiento de la propia viga, asentamientos incluidos. Donde una deflexión lleva signo, hacia arriba es positivo; un giro es positivo en sentido antihorario, en radianes.');
  });

  // "Where a deflection is printed with a sign, upward is positive; a slope
  // is positive counter-clockwise, in radians." The same sentence as above,
  // held here to the engine's own two signs and to what the page prints.
  it('a deflection with a sign is positive upward, and a positive slope rises to the right', () => {
    // One span of 20 ft under 1 kip/ft: it goes down, 5wL⁴/384 at its middle; it falls away from its left support
    // (wL³/24, turning clockwise) and rises to its right one by as much.
    const sagging = solveContinuous({ spans: [{ L: 20, k: 1 }], left: 'pin', right: 'pin', dists: [{ span: 0, a1: 0, a2: 20, w1: 1, w2: 1 }] });
    if (!sagging.ok) throw new Error('not solved');
    expect(sagging.at(10).EIv).toBeCloseTo((-5 * 20 ** 4) / 384, 9);
    expect(sagging.at(0, 'right').EItheta).toBeCloseTo(-(20 ** 3) / 24, 9);
    expect(sagging.at(20, 'left').EItheta).toBeCloseTo(20 ** 3 / 24, 9);
    // The slope is the rise of the deflection per length along the beam: a hair to the right of 5 ft the beam is lower.
    // Counter-clockwise, with x running to the right, is that rise.
    const step = 1e-4;
    expect((sagging.at(5 + step).EIv - sagging.at(5 - step).EIv) / (2 * step)).toBeCloseTo(sagging.at(5).EItheta, 4);
    expect(sagging.at(5).EItheta).toBeLessThan(0);
    // The page prints both with that sign, where it prints one: at the middle of the example the beam is below its
    // line in every arrangement but the one that lifts it, and a settlement entered downward comes back with a minus.
    const tool = (lang: Lang, initial?: ContinuousForm) => renderToStaticMarkup(h(ContinuousCalculator, { t: beamStrings[lang].ui, c: continuousUi[lang], initial }));
    expect(tool('en')).toContain('-0.5695 to 0.09732 in');
    expect(tool('es')).toContain('-0.5695 a 0.09732 in');
    const sunk = tool('en', form({ spans: example.spans.map((s) => ({ ...s, dead: 0, live: 0 })), settlements: [0.25, 0.25, 0.25, 0.25] }));
    expect(sunk).toContain('<dd>-0.25 in</dd>');
    // The note ends on that sentence, in both languages: turned round — "downward", "clockwise" — it is no longer the page's.
    for (const lang of LANGS) expect(continuousPage[lang].signs.items[4]).toMatch(lang === 'en' ? /Where a deflection is printed with a sign, upward is positive; a slope is positive counter-clockwise, in radians\.$/ : /Donde una deflexión lleva signo, hacia arriba es positivo; un giro es positivo en sentido antihorario, en radianes\.$/);
  });

  // "Spans and positions in feet or metres, loads in kips or kilonewtons; a
  // settlement, like the section, in inches or millimetres."
  it('the units the notes name are the form’s own, in both systems', () => {
    expect([UNITS.us.length, UNITS.si.length, UNITS.us.force, UNITS.si.force]).toEqual(['ft', 'm', 'kip', 'kN']);
    expect(continuousPage.en.signs.items.at(-1)).toMatch(/in feet or metres, loads in kips or kilonewtons; a settlement, like the section, in inches or millimetres\./);
    expect(continuousPage.es.signs.items.at(-1)).toMatch(/en pies o metros, cargas en kips o kilonewtons; un asentamiento, igual que la sección, se da en pulgadas o en milímetros\./);
  });
});

describe('continuous beam: the words of its page', () => {
  const en = leaves(continuousPage.en);
  const es = leaves(continuousPage.es);

  it('says the same things in both languages, and leaves nothing blank', () => {
    expect(es.map(([p]) => p)).toEqual(en.map(([p]) => p));
    for (const [path, s] of [...en, ...es]) expect(s.trim().length, path).toBeGreaterThan(0);
    // The same things as the first calculator's page says of itself, part for part: one view prints all three.
    const parts = (page: unknown) => leaves(page).map(([p]) => p.replace(/\[\d+\]/g, '[]'));
    expect([...new Set(parts(continuousPage.en))]).toEqual([...new Set(parts(beamStrings.en.page))]);
  });

  it('the Spanish is Spanish: no sentence is the English one left in place', () => {
    const same = en.filter(([, s], i) => s === es[i][1] && s.split(/\s+/).length > 3).map(([path]) => path);
    expect(same).toEqual([]);
    // …and it writes no number with a grouping comma, which its reader takes for the decimal.
    for (const [path, s] of es) expect(s, path).not.toMatch(/\d,\d{3}(?!\d)/);
    // It speaks to "usted": no "tú" form of the verbs a note uses.
    for (const [path, s] of es) expect(s, path).not.toMatch(/\b(introduces|escribes|eliges|puedes|tienes|quieres|tu|tus|ti|te)\b/);
  });

  // "Free" on this page is an end of the beam that nothing holds. Taken out
  // with the words it stands in, what is left must not have the word at all.
  it('names no other company’s product, no price, no date', () => {
    for (const [path, s] of [...en, ...es]) {
      expect(s, path).not.toMatch(/skyciv|quick design|clearcalcs|enercalc|tedds/i);
      const structural = s.replace(/\bfixed,? or free\b|\bwhose end is free\b/g, '');
      expect(structural, path).not.toMatch(/\bfree\b|\bgratis\b|\bgratuit|\$|\bprice\b|\bprecio\b|\b20\d\d\b/i);
      // The firm's name is written with "and".
      expect(s, path).not.toMatch(/Civil\s*&\s*Structural/i);
    }
    // The exemption exempts something: the word is on the English page, for an end of the beam.
    expect(en.filter(([, s]) => /\bfree\b/.test(s)).map(([path]) => path)).toEqual(['facts[0].v', 'method.paragraphs[1]', 'assumes.items[1]']);
  });

  // Mechanics only. The page gives moments, reactions and deflections; whether
  // they will do is the engineer's to say, under the code the design answers to.
  it('gives numbers and no verdict', () => {
    for (const [path, s] of [...en, ...es].filter(([p]) => !LEGAL.test(p))) {
      expect(s, path).not.toMatch(/\b(ok|okay|pass|passes|passed|fail|fails|failed|adequate|inadequate|sufficient|insufficient|enough|acceptable|complies|satisf\w*|safe|unsafe)\b/i);
      expect(s, path).not.toMatch(/\b(cumple|cumplen|no cumple|falla|fallan|aprobad\w*|suficiente|insuficiente|adecuad\w*|inadecuad\w*|aceptable|basta|segur[oa]|satisf\w*|verifica)\b/i);
      expect(s, path).not.toMatch(/[✓✔✗✘]/);
    }
    expect(continuousPage.en.limits.items[0]).toMatch(/^It applies no design code and no load factor, and gives no verdict\./);
    expect(continuousPage.es.limits.items[0]).toMatch(/^No aplica normas de diseño ni mayora las cargas, y no emite veredicto alguno\./);
  });

  // A disclaimer typed twice is corrected once. The page takes the first
  // calculator's — the very object — and so cannot differ from it by a word.
  it('the legal words are the first calculator’s own, not a copy of them', () => {
    for (const lang of LANGS) {
      const ours = continuousPage[lang];
      const first = beamStrings[lang].page;
      expect(ours.disclaimer).toBe(first.disclaimer);
      expect(ours.sheet.kind).toBe(first.sheet.kind);
      expect(ours.sheet.margin).toBe(first.sheet.margin);
    }
  });

  it('the credit of the printed sheet names this calculator, the firm and the address', () => {
    for (const lang of LANGS) {
      const credit = continuousPage[lang].sheet.credit;
      for (const key of ['{firm}', '{address}']) expect(credit, `${lang} ${key}`).toContain(key);
      expect(credit).not.toBe(beamStrings[lang].page.sheet.credit);
      expect(credit).not.toBe(spanPage[lang].sheet.credit);
      expect(credit).toMatch(lang === 'en' ? /continuous beam calculator/ : /calculadora de viga continua/);
    }
  });

  // Two pages that say one thing in the same words are, to a search engine,
  // one page twice — and now there are three. Everything this page says of
  // itself is compared with everything the other two say: their heroes, their
  // notes, their titles and descriptions, and their forms' own lines — six
  // words at a time.
  it('no sentence of the other two calculators’ pages is said again here, beyond the legal words', () => {
    for (const lang of LANGS) {
      const ours = leaves(continuousPage[lang]).filter(([path]) => !LEGAL.test(path));
      const theirs = [...leaves(beamStrings[lang].page), ...leaves(beamStrings[lang].ui), ...leaves(spanPage[lang]), ...leaves(spanUi[lang])].map(([, s]) => s);
      for (const [path, s] of ours) expect(sharedRuns([s], theirs), `${lang} ${path}`).toEqual([]);
      // The comparison can fail: the legal words, which ARE shared, are found by it.
      expect(sharedRuns([continuousPage[lang].disclaimer.body], theirs).length).toBeGreaterThan(20);
    }
  });

  // The catalogue's line for this calculator is the catalogue's, and no other
  // row's line is this page's either.
  it('no line of the catalogue is said again here', () => {
    const rows = calculatorFamilies.flatMap((f) => f.items);
    for (const lang of LANGS) {
      const ours = leaves(continuousPage[lang]).filter(([path]) => !LEGAL.test(path));
      for (const [path, s] of ours) expect(sharedRuns([s], rows.map((r) => r.does[lang])), `${lang} ${path}`).toEqual([]);
    }
  });

  // The other calculator is named as the catalogue and its own page name it.
  it('names the first calculator by its name, where it sends the reader to it', () => {
    for (const lang of LANGS) {
      const name = beamStrings[lang].page.h1;
      const s = continuousPage[lang];
      expect(s.method.paragraphs.filter((p) => p.includes(name))).toHaveLength(1);
      expect(s.limits.items.filter((x) => x.includes(name))).toHaveLength(1);
      // …as the form's own link names it.
      expect(continuousUi[lang].generalLink).toContain(name);
    }
  });

  // The page and the tool are written in two files, by two hands. Where the
  // notes speak of something the form has a field or a card for, they call
  // it what the form calls it — an engineer who reads "stiffness factor"
  // under the tool looks for those words in it.
  it('the notes call the form’s fields and cards what the form calls them', () => {
    for (const lang of LANGS) {
      const s = continuousPage[lang];
      const c = continuousUi[lang];
      const or = lang === 'en' ? 'or' : 'o';
      const low = (t: string) => t.toLowerCase();
      // The three ways an end is held, and the way of taking the live load that this page is for: the hero's facts are the form's choices.
      expect(c.ends.title.startsWith(s.facts[0].k)).toBe(true);
      expect(s.facts[0].v).toBe(`${c.ends.kinds.pin}, ${low(c.ends.kinds.fixed)} ${or} ${low(c.ends.kinds.free)}`);
      expect(s.facts[1].k).toBe(c.live.title);
      expect(s.facts[1].v).toBe(c.live.every);
      // …and the third names the method as the method's first sentence does.
      expect(s.facts[2].k).toBe(s.method.label);
      expect(low(s.method.paragraphs[0])).toContain(lang === 'en' ? `${low(s.facts[2].v)} method` : `${low(s.facts[2].k)} ${low(s.facts[2].v)}`);
      expect(low(continuousPage.es.method.paragraphs[0])).toContain('método directo de la rigidez');
      const notes = [...s.method.paragraphs, ...s.assumes.items, ...s.limits.items, ...s.signs.items].join(' ');
      for (const word of [c.spans.stiffness, c.settlements.name, c.spans.dead, c.spans.live, c.live.every, c.ends.kinds.pin]) expect(low(notes), `${lang} ${word}`).toContain(low(word));
      // The cases give each span's largest sagging moment under the name its column has.
      const cases = s.method.paragraphs.slice(-4);
      expect(cases.filter((p) => low(p).includes(low(c.results.sagging)))).toHaveLength(lang === 'en' ? 3 : 2);
      // What the form refuses, the notes say it refuses — a thousandth, in both.
      expect(c.issues['short-span']).toMatch(lang === 'en' ? /one thousandth/ : /milésima parte/);
      expect(s.limits.items.join(' ')).toContain('1/1000');
    }
  });

  // Neither says the other's sentences: what the form prints beside a field
  // is not printed again under the tool.
  it('no sentence of the form is said again in the notes, nor a sentence of the notes in the form', () => {
    for (const lang of LANGS) {
      const ours = leaves(continuousPage[lang]).filter(([path]) => !LEGAL.test(path));
      const form = leaves(continuousUi[lang]).map(([, s]) => s);
      expect(form.length).toBeGreaterThan(40);
      for (const [path, s] of ours) expect(sharedRuns([s], form), `${lang} ${path}`).toEqual([]);
    }
  });
});

/* ── The page, rendered ───────────────────────────────────────────────── */

const SRC = resolve(__dirname, '..', '..', '..');
const text = (html: string) =>
  html
    .replace(/<(script|style|noscript)\b[\s\S]*?<\/\1>/g, ' ')
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
  route.pathname = localePath(CONTINUOUS_PATH, lang);
  return renderToStaticMarkup(h(SiteChrome, null, h(ContinuousBeamView, { lang })));
};
const mainOf = (html: string) => html.match(/<main\b[\s\S]*<\/main>/)?.[0] ?? '';
/** A calculator's page WITHOUT its tool: the words that are the page's own. */
const around = (lang: Lang, path: string, page: CalculatorText) => {
  route.pathname = localePath(path, lang);
  // The line of the tool's frame is the form's (`linkOpening`), not the page's: left empty here.
  return renderToStaticMarkup(h(CalculatorPage, { lang, path, page, opening: '', children: null }));
};
/** This calculator's row of the catalogue. */
const ROW = calculatorFamilies.flatMap((f) => f.items).filter((x) => x.href === CONTINUOUS_PATH);

describe('continuous beam: what a search result shows', () => {
  // The rules of views/seo.test.ts, which reads every page of the sitemap.
  // Held here as well, so that this page's own test says what is wrong with
  // its own words.
  const words = (s: string) => (s.match(/[A-Za-zÁÉÍÓÚÜÑáéíóúüñ]{4,}/g) ?? []).map((w) => w.toLowerCase());
  const letters = (s: string) => s.toLowerCase().replace(/[^a-z0-9áéíóúüñ]/g, '');
  /* The shortest H1 the owner's on-page check let pass (seo.test.ts, H1_MIN). */
  const H1_MIN = 22;

  for (const lang of LANGS) {
    const s = continuousPage[lang];
    const meta = pageMeta(lang, CONTINUOUS_PATH, { title: s.title, description: s.description });
    const title = (meta.title as { absolute: string }).absolute;

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
      const others = [beamStrings[lang].page, spanPage[lang]];
      for (const other of others) expect(s.title).not.toBe(other.title);
      expect(ROW).toHaveLength(1);
      expect(sharedRuns([s.title, s.description], [...others.flatMap((o) => [o.title, o.description]), ROW[0].does[lang]])).toEqual([]);
    });

    it(`${lang}: the page declares its own address, with its twin, and may be indexed`, () => {
      expect(meta.alternates?.canonical).toBe(localePath(CONTINUOUS_PATH, lang));
      expect(meta.alternates?.languages).toEqual({ en: CONTINUOUS_PATH, es: `/es${CONTINUOUS_PATH}`, 'x-default': CONTINUOUS_PATH });
      expect(meta.robots).toBeUndefined();
    });

    it(`${lang}: one H1, long enough to say what the page is, in words the page uses — ${s.h1}`, () => {
      // As its route renders it: no header, no footer to lend it a word.
      route.pathname = localePath(CONTINUOUS_PATH, lang);
      const html = renderToStaticMarkup(h(ContinuousBeamView, { lang }));
      const h1s = html.match(/<h1\b[\s\S]*?<\/h1>/g) ?? [];
      expect(h1s.map((x) => text(x))).toEqual([s.h1]);
      expect(s.h1.length).toBeGreaterThanOrEqual(H1_MIN);
      const body = new Set(words(text(html.replace(/<h1\b[\s\S]*?<\/h1>/g, ' '))));
      expect(words(s.h1).filter((w) => !body.has(w))).toEqual([]);
      // …and not only in the breadcrumb and the letterhead, which repeat it whole.
      const notes = new Set(words([s.sub, ...s.method.paragraphs, ...s.assumes.items].join(' ')));
      expect(words(s.h1).filter((w) => !notes.has(w))).toEqual([]);
    });

    it(`${lang}: the H1 is not the title over again, and begins with the name the catalogue gives it`, () => {
      expect(letters(s.h1)).not.toBe(letters(s.title));
      expect(ROW).toHaveLength(1);
      expect(s.h1.startsWith(ROW[0].name[lang])).toBe(true);
    });
  }
});

describe('continuous beam: the page', () => {
  /* The cards of numbers, read as a visitor reads them (see beam-calculator.test.ts). */
  const cardsOf = (html: string) => html.split(/<div class="mp-app__card(?: [^"]*)?">/).slice(1);
  const cardOf = (html: string, title: string) => cardsOf(html).find((card) => new RegExp(`<h3\\b[^>]*>${esc(title).replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}</h3>`).test(card)) ?? '';
  const bodyRows = (card: string) => [...(card.match(/<tbody\b[^>]*>[\s\S]*?<\/tbody>/)?.[0] ?? '').matchAll(/<tr\b[^>]*>([\s\S]*?)<\/tr>/g)].map((r) => r[1]);
  const rowsOf = (card: string) => bodyRows(card).map((row) => [...row.matchAll(/<t[hd][^>]*>([\s\S]*?)<\/t[hd]>/g)].map((c) => text(c[1])));
  const pairsOf = (card: string) => [...card.matchAll(/<dt>([\s\S]*?)<\/dt><dd>([\s\S]*?)<\/dd>/g)].map((m) => [text(m[1]), text(m[2])]);
  /** Which spans a value's miniature says are loaded: what it says to a screen reader, row by row. */
  const patternsOf = (card: string) => bodyRows(card).map((row) => [...row.matchAll(/<svg class="mp-cont__pattern"[^>]*aria-label="([^"]*)"/g)].map((m) => m[1]));

  /* THE EXAMPLE BY HAND: 24, 30 and 24 ft on simple supports, 0.9 kip/ft dead
     and 1.2 kip/ft live on each span, the live load in every arrangement.
     The three-moment equations at the two interior supports B and C, with
     wᵢ the load on span i:

         108·M_B +  30·M_C = −(w₁·24³ + w₂·30³)/4
          30·M_B + 108·M_C = −(w₂·30³ + w₃·24³)/4

     solved here for the arrangement that gives each value printed. */
  const moments = (w: [number, number, number]): [number, number] => {
    const [p, q] = [-(w[0] * 24 ** 3 + w[1] * 30 ** 3) / 4, -(w[1] * 30 ** 3 + w[2] * 24 ** 3) / 4];
    const det = 108 * 108 - 30 * 30;
    return [(p * 108 - q * 30) / det, (q * 108 - p * 30) / det];
  };
  const [DEAD, ALL] = [0.9, 2.1];

  it('the example by hand, with Clapeyron: the numbers the page opens on', () => {
    // Live load on spans 1 and 2: the lowest moment over support 2, and its largest reaction.
    const [MB, MC] = moments([ALL, ALL, DEAD]);
    expect(MB).toBeCloseTo(-166.8672, 4);
    // The shear just right of support 2 is the largest on the beam: 2.1 × 15 + (M_C − M_B)/30.
    const right = ALL * 15 + (MC - MB) / 30;
    expect(right).toBeCloseTo(33.2723, 4);
    expect(ALL * 12 - MB / 24 + right).toBeCloseTo(65.4251, 4);
    // Live load on span 3 alone: the highest moment over support 2, −55.00 kip·ft, and its smallest reaction.
    const [LB, LC] = moments([DEAD, DEAD, ALL]);
    expect(LB).toBeCloseTo(-55.0023, 4);
    expect(DEAD * 12 - LB / 24 + DEAD * 15 + (LC - LB) / 30).toBeCloseTo(24.8195, 4);
    // Live load on span 2 alone: its largest sagging moment, at its middle by symmetry — 2.1 × 30² ÷ 8 + M —
    // and the smallest reaction of an end support, 0.9 × 12 + M ÷ 24.
    const [M] = moments([DEAD, ALL, DEAD]);
    expect((ALL * 30 ** 2) / 8 + M).toBeCloseTo(110.9935, 4);
    expect(DEAD * 12 + M / 24).toBeCloseTo(5.581, 3);
    // Live load on spans 1 and 3: the largest reaction of an end support, 2.1 × 12 + M ÷ 24.
    expect(ALL * 12 + moments([ALL, DEAD, ALL])[0] / 24).toBeCloseTo(21.1745, 4);
    // The stresses of the section entered: 166.867 kip·ft × 12 ÷ 81.6 in³, and 33.272 kip ÷ 7.245 in².
    expect((-MB * 12) / 81.6).toBeCloseTo(24.54, 2);
    expect(right / 7.245).toBeCloseTo(4.592, 3);
  });

  for (const lang of LANGS) {
    const html = render(lang);
    const main = mainOf(html);
    const s = continuousPage[lang];
    const t = beamStrings[lang].ui;
    const c = continuousUi[lang];
    const site = getContent(lang);

    it(`${lang}: one h1; the tool and the method are its two h2; the tables and the notes are h3`, () => {
      const heads = (n: number) => [...main.matchAll(new RegExp(`<h${n}\\b[^>]*>([\\s\\S]*?)</h${n}>`, 'g'))].map((m) => text(m[1]));
      expect(heads(1)).toEqual([s.h1]);
      expect(heads(2)).toEqual([s.toolHeading, s.method.title]);
      const h3 = heads(3);
      // The notes close the page, in this order; before them, the tool's four tables.
      expect(h3.slice(-4)).toEqual([s.assumes.title, s.limits.title, s.signs.title, s.disclaimer.title]);
      expect(h3.slice(0, -4)).toEqual([t.supports.title, c.results.bySpan, t.results.maxima, t.results.point]);
      expect(main).not.toMatch(/<h[456]\b/);
    });

    it(`${lang}: the server sends the example solved, over its eight arrangements — and not an empty box`, () => {
      const up = t.results.upward;
      const supports = cardOf(main, t.supports.title);
      // Support, position, then its reaction and the moment over it: of each, the larger end of its range and then the other.
      expect(rowsOf(supports)).toEqual([
        ['1', '0', `21.17 ${up}`, `5.581 ${up}`, '0', '0'],
        ['2', '24', `65.43 ${up}`, `24.82 ${up}`, '-166.9', '-55'],
        ['3', '54', `65.43 ${up}`, `24.82 ${up}`, '-166.9', '-55'],
        ['4', '78', `21.17 ${up}`, `5.581 ${up}`, '0', '0'],
      ]);
      // "Each largest value … comes with the spans whose live load is on when it occurs": beside each, in a drawing that says it.
      const on = (...spans: number[]) => (spans.length === 1 ? c.results.pattern.one : c.results.pattern.many).replace('{spans}', spans.length === 1 ? String(spans[0]) : `${spans.slice(0, -1).join(', ')}${c.results.pattern.and}${spans.at(-1)}`);
      expect(patternsOf(supports)).toEqual([
        [on(1, 3), on(2)],
        [on(1, 2), on(3), on(1, 2), on(3)],
        [on(2, 3), on(1), on(2, 3), on(1)],
        [on(1, 3), on(2)],
      ]);
      const bySpan = cardOf(main, c.results.bySpan);
      expect(rowsOf(bySpan).map((r) => r[1].split(' ')[0])).toEqual(['106.8', '111', '106.8']);
      expect(rowsOf(bySpan).map((r) => r[3])).toEqual(['L/723', 'L/632', 'L/723']);
      expect(patternsOf(bySpan).map((p) => p[0])).toEqual([on(1, 3), on(2), on(1, 3)]);
      const largest = Object.fromEntries(pairsOf(cardOf(main, t.results.maxima)));
      expect(largest[t.results.maxShear]).toBe(`33.27 kip ${t.results.at} x = 24 ft ${on(1, 2)}`);
      expect(largest[t.results.maxSagging]).toBe(`111 kip·ft ${t.results.at} x = 39 ft ${on(2)}`);
      expect(largest[t.results.maxHogging]).toBe(`166.9 kip·ft ${t.results.at} x = 54 ft ${on(2, 3)}`);
      expect(largest[t.results.bendingStress]).toBe('24.54 ksi');
      expect(largest[t.results.shearStress]).toBe('4.592 ksi');
      // The form says how many arrangements those are: three spans with a live load, eight.
      expect(text(main)).toContain(c.live.count.replace('{spans}', '3').replace('{count}', '8'));
      // No problem is announced for the example.
      expect(main).toMatch(/<div class="mp-app__issues" role="alert" aria-live="assertive"><\/div>/);
    });

    // The page every calculator shares names its tool's section after the
    // address: this one's heading is "continuous-beam-tool". A section
    // labelled by an id that is not on the page has, for a screen reader, no
    // name at all.
    it(`${lang}: whatever labels or describes an element is on the page — the tool’s section by its own heading`, () => {
      const ids = new Set([...html.matchAll(/ id="([^"]+)"/g)].map((m) => m[1]));
      const refs = [...html.matchAll(/ aria-(?:labelledby|describedby)="([^"]+)"/g)].flatMap((m) => m[1].split(/\s+/));
      expect(refs).toContain('continuous-beam-tool');
      expect(refs.filter((r) => !ids.has(r))).toEqual([]);
      expect(main).toMatch(/<section\b[^>]* aria-labelledby="continuous-beam-tool"/);
      expect(text(main.match(/<h2 id="continuous-beam-tool"[^>]*>([\s\S]*?)<\/h2>/)?.[1] ?? '')).toBe(s.toolHeading);
    });

    // What the notes describe is what the form offers: the spans one by one,
    // how each end is held, a settlement for each support, and the two ways
    // of taking the live load — the second chosen, as the page opens.
    it(`${lang}: the form is the one the notes describe — spans, ends, settlements, and the live load in every arrangement`, () => {
      const groups = [...main.matchAll(/<div class="mp-app__item" role="group" aria-label="([^"]*)"/g)].map((m) => m[1]);
      expect(groups).toEqual([1, 2, 3].map((n) => `${t.results.span} ${n}`));
      const legends = [...main.matchAll(/<legend[^>]*>([\s\S]*?)<\/legend>/g)].map((m) => text(m[1]));
      expect(legends).toEqual(expect.arrayContaining([c.spans.title, c.ends.title, c.settlements.title, t.loads.point, t.loads.dist, c.live.title, t.section.title]));
      // Three kinds of end, on each side.
      const ends = [...main.matchAll(/<select\b[^>]*>([\s\S]*?)<\/select>/g)].map((m) => [...m[1].matchAll(/<option\b[^>]*>([\s\S]*?)<\/option>/g)].map((o) => text(o[1]))).filter((options) => options.includes(c.ends.kinds.free));
      expect(ends).toEqual([Object.values(c.ends.kinds), Object.values(c.ends.kinds)]);
      // One settlement field to a support: four of them, each named by its support and where it is.
      const names = [...main.matchAll(/<label\b[^>]*>([\s\S]*?)<\/label>/g)].map((m) => text(m[1])).filter((name) => name.startsWith(`${t.results.support} `));
      expect(names).toEqual([0, 24, 54, 78].map((x, i) => `${t.results.support} ${i + 1} · x = ${x} ft in`));
      // The live load: two choices, and the one the example opens with.
      const taken = [...main.matchAll(/<input type="radio" name="beam-live"([^>]*)>\s*<span>([\s\S]*?)<\/span>/g)].map((m) => [text(m[2]), / checked/.test(m[1])]);
      expect(taken).toEqual([[c.live.all, false], [c.live.every, true]]);
      // No row of hinges or applied moments to edit: the first calculator has those.
      for (const gone of [t.hinges.add, t.loads.addCouple, t.supports.add, t.toolbar.layoutPick]) expect(text(main), gone).not.toContain(gone);
    });

    // The row of the catalogue that opens this page says what it computes in
    // one line. That line is the catalogue's: said again here, a search
    // engine has two pages with the same sentence.
    it(`${lang}: its line in the catalogue is not printed here, nor six words running of it — nor another calculator’s`, () => {
      const body = text(main);
      const rows = calculatorFamilies.flatMap((f) => f.items).filter((x) => x.href);
      expect(rows.map((x) => x.href)).toEqual([BEAM_PATH, SPAN_PATH, CONTINUOUS_PATH]);
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
      expect(list.itemListElement.map((i: { item: string }) => i.item)).toEqual(['/', '/resources', CONTINUOUS_PATH].map((p) => absoluteUrl(localePath(p, lang))));
      expect(list.itemListElement.map((i: { name: string }) => i.name)).toEqual([site.ui.home, navLabelOf(site, '/resources'), s.h1]);
    });

    it(`${lang}: says how it is solved, what it assumes, what it does not do — and on what terms`, () => {
      const body = text(main);
      for (const p of [s.eyebrow, s.sub, ...s.facts.flatMap((f) => [f.k, f.v]), s.toolHeading, s.method.label, s.method.title, ...s.method.paragraphs, ...s.assumes.items, ...s.limits.items, ...s.signs.items, s.disclaimer.title, s.disclaimer.body, s.back]) {
        expect(body, p.slice(0, 50)).toContain(text(esc(p)));
      }
      // The first paragraph of the method is its lead, as on the other calculators' pages.
      expect(main).toContain(`<p class="mp-lead">${esc(s.method.paragraphs[0])}</p>`);
      expect(html).toContain(`<noscript><p class="mp-app__noscript">${esc(s.noscript)}</p></noscript>`);
      // The form's own promise is the first calculator's, and holds here: nothing typed is sent.
      expect(body).toContain(t.results.privacy);
    });

    // "No internal hinges and no applied moments" would be a dead end. The
    // form's link opens the first calculator on the beam that is on screen:
    // the same spans as four supports, each span's two loads as two loads.
    it(`${lang}: leads back to the catalogue, and to the first calculator with this very beam — nowhere outside the site`, () => {
      const hrefs = [...main.matchAll(/<a\b[^>]*href="([^"]*)"/g)].map((m) => m[1]);
      expect(hrefs.filter((x) => x === localePath('/resources', lang)).length).toBe(2);
      expect(hrefs.filter((x) => /^https?:|^tel:|^mailto:/.test(x))).toEqual([]);
      const general = hrefs.filter((x) => x.split('#')[0] === localePath(BEAM_PATH, lang));
      expect(general).toHaveLength(1);
      const carried = general[0].split('#b=')[1] ?? '';
      expect(carried).toBe(generalCode(defaultContinuous()));
      const beam = decodeBeam(carried)!;
      expect(beam.supports.map((x) => [x.kind, x.x])).toEqual([['pin', 0], ['roller', 24], ['roller', 54], ['roller', 78]]);
      expect(beam.dists.map((d) => [d.x1, d.x2, d.w1])).toEqual([[0, 24, 0.9], [0, 24, 1.2], [24, 54, 0.9], [24, 54, 1.2], [54, 78, 0.9], [54, 78, 1.2]]);
      // The link is named for that calculator, and the notes say that it is there.
      expect(text(main)).toContain(`${c.general} ${c.generalLink}`);
      expect(s.limits.items.filter((x) => (lang === 'en' ? /the form links to it with this beam when that calculator can hold it/ : /el formulario lleva esta viga a esa calculadora cuando puede representarla/).test(x))).toHaveLength(1);
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
      expect(html).toContain(`href="${localePath(CONTINUOUS_PATH, lang === 'en' ? 'es' : 'en')}"`);
    });
  }

  it('the two languages are the same page', () => {
    const shape = (lang: Lang) =>
      mainOf(render(lang))
        .replace(/>[^<]+</g, '><')
        .replace(/ (aria-label|title|placeholder|href|lang|d|points|x|y|x1|x2|y1|y2|cx|cy|width|height|text-anchor|viewBox)="[^"]*"/g, '')
        .match(/<\/?[a-z0-9]+/g)!
        .join('');
    expect(shape('es')).toBe(shape('en'));
  });
});

describe('continuous beam: what the notes say the form does, it does on screen', () => {
  const example = defaultContinuous();
  /** The tool alone, opened on a beam that is not the example. */
  const tool = (lang: Lang, initial: ContinuousForm) => renderToStaticMarkup(h(ContinuousCalculator, { t: beamStrings[lang].ui, c: continuousUi[lang], generalPath: localePath(BEAM_PATH, lang), initial }));
  const cards = (html: string) => [...html.matchAll(/<h3 class="mp-app__h">([\s\S]*?)<\/h3>/g)].map((m) => text(m[1]));

  for (const lang of LANGS) {
    const t = beamStrings[lang].ui;
    const c = continuousUi[lang];

    // "Where any span's stiffness factor is not 1, that span is another
    // section and no stress is printed at all."
    it(`${lang}: with a stiffness factor that is not 1, no stress is printed and a line says why — and the link to the first calculator is gone`, () => {
      const html = tool(lang, { ...example, spans: example.spans.map((s, i) => (i === 1 ? { ...s, k: 1.5 } : s)) });
      const body = text(html);
      expect(cards(html)).toHaveLength(4);
      for (const stress of [t.results.bendingStress, t.results.shearStress]) expect(html, stress).not.toContain(`<dt>${esc(stress)}</dt>`);
      expect(body).toContain(c.results.noStress);
      // That calculator has one EI along the beam: it cannot hold this one.
      expect(body).not.toContain(c.generalLink);
      // With every factor back at 1 both are there, as on the page.
      const plain = tool(lang, example);
      for (const stress of [t.results.bendingStress, t.results.shearStress]) expect(plain, stress).toContain(`<dt>${esc(stress)}</dt>`);
      expect(text(plain)).not.toContain(c.results.noStress);
      expect(text(plain)).toContain(c.generalLink);
    });

    // "…for shear, the rule printed with the value — V over a shear area,
    // 1.5V/A for a rectangle." The example as a rectangle 12 in by 24 in: its
    // largest shear is 33.2723 kip, and 1.5 × 33.2723 ÷ 288 = 0.1733 ksi —
    // V ÷ A would be 0.1155.
    it(`${lang}: for a rectangle the shear stress is 1.5 × V ÷ A, and the card says so beside it`, () => {
      const html = tool(lang, { ...example, section: { ...example.section, mode: 'rect', b: 12, h: 24 } });
      const values = Object.fromEntries([...html.matchAll(/<dt>([\s\S]*?)<\/dt><dd>([\s\S]*?)<\/dd>/g)].map((m) => [text(m[1]), text(m[2])]));
      expect(values[t.results.maxShear].startsWith('33.27 kip')).toBe(true);
      expect(values[t.results.shearStress]).toBe('0.1733 ksi');
      expect((1.5 * 33.2723) / 288).toBeCloseTo(0.1733, 4);
      expect(text(html)).toContain(`${t.results.shearRule.rect} ${t.results.elastic}`);
      // The example's own section: V over the shear area entered, and the card says that.
      expect(text(tool(lang, example))).toContain(`${t.results.shearRule.area} ${t.results.elastic}`);
    });

    // "A settlement is a length you enter … and it needs E and I to become
    // forces."
    it(`${lang}: a settlement with no moment of inertia is not solved: the form says what it needs, and shows no numbers`, () => {
      const html = tool(lang, { ...example, settlements: [0, 0.5, 0, 0], section: { ...example.section, I: 0 } });
      expect(cards(html)).toEqual([]);
      expect(text(html)).toContain(c.issues.settlement);
      // The same beam with its I: solved — and no longer the first calculator's to open, whose supports do not move.
      const solved = tool(lang, { ...example, settlements: [0, 0.5, 0, 0] });
      expect(cards(solved)).toHaveLength(4);
      expect(text(solved)).not.toContain(c.issues.settlement);
      expect(text(solved)).not.toContain(c.generalLink);
    });

    // "A span under 1/1000 of the whole length, or a stiffness factor outside
    // 0.001 to 1,000, is refused: the form marks the entry and no result is
    // shown."
    it(`${lang}: a span too short, or a stiffness factor out of range, is marked on its row and no result is shown`, () => {
      const marked = (html: string, n: number) => new RegExp(`<div class="mp-app__item" role="group" aria-label="${esc(`${t.results.span} ${n}`)}" data-invalid="true">`).test(html);
      const short = tool(lang, { ...example, spans: example.spans.map((s, i) => (i === 0 ? { ...s, L: 0.05 } : s)) });
      expect(cards(short)).toEqual([]);
      expect(text(short)).toContain(c.issues['short-span']);
      expect([1, 2, 3].map((n) => marked(short, n))).toEqual([true, false, false]);
      const stiff = tool(lang, { ...example, spans: example.spans.map((s, i) => (i === 2 ? { ...s, k: 1001 } : s)) });
      expect(cards(stiff)).toEqual([]);
      // The limits it names are the engine's, written as this page writes numbers (read here with its thin space as a space).
      expect(text(stiff)).toContain(text(esc(c.issues.stiffness.replace('{min}', '0.001').replace('{max}', `1${t.numbers.group}000`))));
      expect(c.issues.stiffness).toMatch(/\{min\}.*\{max\}/);
      expect([1, 2, 3].map((n) => marked(stiff, n))).toEqual([false, false, true]);
      // The example has no entry marked.
      expect([1, 2, 3].map((n) => marked(tool(lang, example), n))).toEqual([false, false, false]);
    });

    // "Dead and live loads are used as entered": with the live load on every
    // span the example is one case, 2.1 kip/ft on 78 ft, and the page adds
    // its reactions up to that. Clapeyron, by symmetry: M × 138 = −21,432.6.
    it(`${lang}: with the live load on every span the example is one case: −155.3 kip·ft over each interior support, 163.8 kip in all`, () => {
      const html = tool(lang, { ...example, everyArrangement: false });
      const up = t.results.upward;
      const card = html.split(/<div class="mp-app__card(?: [^"]*)?">/)[1] ?? '';
      const rows = [...(card.match(/<tbody\b[^>]*>[\s\S]*?<\/tbody>/)?.[0] ?? '').matchAll(/<tr\b[^>]*>([\s\S]*?)<\/tr>/g)].map((r) => [...r[1].matchAll(/<t[hd][^>]*>([\s\S]*?)<\/t[hd]>/g)].map((x) => text(x[1])));
      // 0.9 + 1.2 = 2.1 kip/ft: end reactions 2.1 × 12 − 155.3087 ÷ 24 = 18.73 kip, interior ones 81.9 − 18.73 = 63.17.
      expect((2.1 * (24 ** 3 + 30 ** 3)) / 4 / 138).toBeCloseTo(155.3087, 4);
      expect(rows).toEqual([
        ['1', '0', `18.73 ${up}`, '0'],
        ['2', '24', `63.17 ${up}`, '-155.3'],
        ['3', '54', `63.17 ${up}`, '-155.3'],
        ['4', '78', `18.73 ${up}`, '0'],
      ]);
      expect(text(card)).toContain(`${t.results.equilibrium} 163.8 = 163.8 kip.`);
      // One case: no arrangement to name, no band to explain.
      expect(html).not.toContain('mp-cont__pattern');
      expect(text(html)).not.toContain(c.results.band);
      // Over every arrangement the note under the diagrams says what a band is, in the notes' own terms: lowest to highest.
      expect(text(tool(lang, example))).toContain(c.results.band);
    });

    // "Each span's two uniform loads, dead and live, are positive downward: a
    // minus sign turns one upward."
    it(`${lang}: a span’s load typed with a minus sign acts upward`, () => {
      const lifted: ContinuousForm = { ...example, everyArrangement: false, spans: example.spans.map((s) => ({ ...s, dead: -0.9, live: 0 })) };
      const section = sectionProps(lifted);
      const out = solved(toEngine(lifted, section, stiffness('us', section)).model);
      // The mirror of the dead load alone: every reaction pulls down, and the moment over a support sags.
      expect(out.reactions.every((r) => r.Rv < 0)).toBe(true);
      expect(out.joints[1].M).toBeCloseTo((0.9 * (24 ** 3 + 30 ** 3)) / 4 / 138, 9);
      // …and the page says so of each reaction, in its word for it.
      const card = tool(lang, lifted).split(/<div class="mp-app__card(?: [^"]*)?">/)[1] ?? '';
      expect(text(card).split(t.results.downward).length - 1).toBe(4);
      expect(text(card)).not.toContain(t.results.upward);
    });
  }
});

describe('continuous beam: one page for every calculator, with this one’s words', () => {
  const source = (rel: string) => readFileSync(join(SRC, rel), 'utf8');
  /** Text as it stands between two tags: one piece of the page. */
  const pieces = (html: string) =>
    [...html.replace(/<(script|style)\b[\s\S]*?<\/\1>/g, ' ').matchAll(/>([^<]+)</g)].map((m) => text(`<i>${m[1]}</i>`)).filter(Boolean);

  // Rendered, and without the tool: the hero, the notes, the terms. What a
  // crawler reads on this page and on either of the other two may be the
  // legal words and nothing else.
  it('around the tool, this page shares the legal words with the other two and no other sentence', () => {
    for (const lang of LANGS) {
      const site = getContent(lang);
      const ours = pieces(around(lang, CONTINUOUS_PATH, continuousPage[lang]));
      expect(ours.length).toBeGreaterThan(40);
      const s = continuousPage[lang];
      const address = `ttcivilstructural.com${localePath(CONTINUOUS_PATH, lang)}`;
      const legal = new Set([s.disclaimer.title, s.disclaimer.body, s.sheet.kind, s.sheet.credit.replace('{firm}', site.company.legalName).replace('{address}', address)]);
      // Each of them is on the page, so the exemption exempts something.
      for (const words of legal) expect(ours, words.slice(0, 40)).toContain(words);
      for (const [path, page] of [[BEAM_PATH, beamStrings[lang].page], [SPAN_PATH, spanPage[lang]]] as const) {
        expect(sharedRuns(ours.filter((p) => !legal.has(p)), pieces(around(lang, path, page))), `${lang} ${path}`).toEqual([]);
      }
    }
  });

  // The three views are the same component with other words: the same
  // elements in the same order, however many paragraphs and list items each
  // has to say.
  it('around the tool, the three pages are built alike', () => {
    const frame = (html: string) =>
      (html.replace(/<(script|style)\b[\s\S]*?<\/\1>/g, '').match(/<\/?[a-z0-9]+/g) ?? [])
        .join('')
        .replace(/(<p<\/p)+/g, '<p</p')
        .replace(/(<li<\/li)+/g, '<li</li');
    for (const lang of LANGS) expect(frame(around(lang, CONTINUOUS_PATH, continuousPage[lang]))).toBe(frame(around(lang, BEAM_PATH, beamStrings[lang].page)));
    // No view draws a page of its own: each hands its words to the shared one.
    const code = source('components/ttc/views/ContinuousBeamView.tsx');
    expect(code).toContain("import { CalculatorPage } from './CalculatorPage';");
    expect(code).not.toMatch(/PageHero|JsonLd|mp-appnotes|mp-sheet|calc\.css/);
    // The form's words go in as props, this language's only: the two sets it takes, and the first calculator's address.
    expect(code).toContain('<ContinuousCalculator t={beamStrings[lang].ui} c={continuousUi[lang]} generalPath={localePath(BEAM_PATH, lang)} />');
  });

  it('every class its markup uses is styled in the calculators’ sheet', () => {
    const own = source('components/ttc/calc/calc.css');
    const used = new Set<string>();
    for (const m of render('en').matchAll(/class="([^"]*)"/g)) {
      for (const cls of m[1].split(/\s+/)) if (/^mp-(app|appsec|appnotes|num|seg|plot|beam|sheet|cont)(?![a-z0-9])/.test(cls)) used.add(cls);
    }
    expect(used.size).toBeGreaterThan(30);
    // The third calculator's own classes are among them.
    expect([...used].filter((cls) => cls.startsWith('mp-cont')).length).toBeGreaterThan(3);
    // Three name a thing without styling it (see beam-calculator.test.ts).
    const NAMES_ONLY = ['mp-beam', 'mp-beam__unit', 'mp-num--select'];
    expect([...used].filter((cls) => !NAMES_ONLY.includes(cls) && !new RegExp(`\\.${cls}(?![a-zA-Z0-9_-])`).test(own))).toEqual([]);
  });
});

describe('continuous beam: on paper it is a calculation sheet', () => {
  for (const lang of LANGS) {
    const site = getContent(lang);
    const s = continuousPage[lang];
    const html = render(lang);
    const main = mainOf(html);
    const address = `ttcivilstructural.com${localePath(CONTINUOUS_PATH, lang)}`;

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

describe('continuous beam: what its script carries', () => {
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
    const files = reach(join(SRC, 'components/ttc/calc/continuous/ContinuousCalculator.tsx'));
    expect(files).toEqual(expect.arrayContaining(['lib/calc/continuous/engine.ts', 'lib/calc/continuous/envelope.ts', 'lib/calc/continuous/model.ts', 'lib/calc/continuous/analysis.ts']));
    // Each of these holds both languages; the page's own, its paragraphs as well.
    for (const words of ['lib/calc/continuous/strings.ts', 'lib/calc/continuous/page-strings.ts', 'lib/calc/beam/strings.ts', 'lib/calc/beam/span-strings.ts', 'lib/calc/beam/span-page-strings.ts']) expect(files, words).not.toContain(words);
    expect(files.filter((f) => /^lib\/ttc\/(site|site\.es|content|calculators|cities|city-)/.test(f) || /^components\/ttc\/views\//.test(f))).toEqual([]);
  });

  it('the page’s words reach the view on the server, and nothing a browser runs', () => {
    // Who imports this page's text, by name: the view, the two routes — and tests.
    const importers: string[] = [];
    const walk = (dir: string) => {
      for (const entry of readdirSync(dir, { withFileTypes: true })) {
        const full = join(dir, entry.name);
        if (entry.isDirectory()) walk(full);
        else if (/\.tsx?$/.test(entry.name) && !/\.test\.ts$/.test(entry.name) && /continuous\/page-strings['"]/.test(readFileSync(full, 'utf8'))) importers.push(full.slice(SRC.length + 1).replace(/\\/g, '/'));
      }
    };
    walk(SRC);
    expect(importers.sort()).toEqual(['app/(public)/(site)/resources/continuous-beam/page.tsx', 'app/(public-es)/(site)/es/resources/continuous-beam/page.tsx', 'components/ttc/views/ContinuousBeamView.tsx']);
    for (const f of importers) expect(readFileSync(join(SRC, f), 'utf8'), f).not.toMatch(/^['"]use client['"]/m);
    // The legal words are taken from the first calculator's text in the page's own file, not typed in it.
    const code = readFileSync(join(SRC, 'lib/calc/continuous/page-strings.ts'), 'utf8');
    for (const lang of LANGS) {
      expect(code).toContain(`disclaimer: beamStrings.${lang}.page.disclaimer,`);
      expect(code).toContain(`kind: beamStrings.${lang}.page.sheet.kind,`);
      expect(code).toContain(`margin: beamStrings.${lang}.page.sheet.margin,`);
    }
    // Every source file of the site is read: a second or two alone, more than the default five beside the other suites.
  }, 30_000);
});

describe('continuous beam: the language link carries its case', () => {
  afterEach(() => vi.unstubAllGlobals());

  // The first calculator keeps its beam after `#b=`, the second its case
  // after `#s=`, this one after `#c=`: a key of one lower-case letter, which
  // is what the header's link carries to the twin page (mp/lang.tsx).
  it('a beam after #c= goes with the link to the other language, whole', () => {
    expect(`#${CONTINUOUS_KEY}=`).toBe('#c=');
    expect(new Set([CONTINUOUS_KEY, SPAN_KEY, 'b']).size).toBe(3);
    const edited = reduceContinuous(defaultContinuous(), { type: 'end', side: 'left', kind: 'fixed' });
    const hash = `#${CONTINUOUS_KEY}=${encodeContinuous(edited)}`;
    vi.stubGlobal('window', { location: { hash, search: '' } });
    expect(addressNow().carried).toBe(hash);
    // …and what arrives is that beam: its left end fixed, the rest as it was.
    const arrived = decodeContinuous(addressNow().carried.slice(3))!;
    expect([arrived.left, arrived.right, arrived.spans.map((x) => x.L)]).toEqual(['fixed', 'pin', [24, 30, 24]]);
    // The first calculator's link is not this page's, and this page's is not the first's.
    expect(decodeContinuous(encodeBeam(toBeamForm(edited)))).toBeNull();
    expect(decodeBeam(encodeContinuous(edited))).toBeNull();
  });
});

describe('continuous beam: a page sent with its example, under an address that holds another beam', () => {
  // A server never sees what is after the #. Until the script has read it,
  // the example must not stand for the beam of a link: the tool is in a
  // frame that the page's own first script marks (calc/ToolFrame.tsx; what
  // a browser then shows is held in the regression script).
  for (const lang of LANGS) {
    it(`${lang}: the tool stands in its frame, after the frame's script and the form's own line for a link still to be opened`, () => {
      const html = mainOf(render(lang));
      const said = beamStrings[lang].ui.linkOpening;
      expect(html.match(/<div class="mp-app__frame">/g)).toHaveLength(1);
      // The script is the text of a holder, not an element of React's (ToolFrame.tsx says why): the frame is the holder's parent.
      expect(html).toContain(`<div class="mp-app__frame"><span hidden=""><script>(function(s){if(/^#[a-z]=./.test(location.hash))s.parentNode.parentNode.setAttribute('data-opening','')})(document.currentScript)</script></span><p class="mp-app__opening" data-line="${esc(said)}"></p><div class="mp-app mp-cont">`);
      // As served nothing is marked: the example is the page.
      expect(html).not.toMatch(/data-opening=/);
      // …and the line is not among its words: the sentence is an attribute of an empty paragraph, which the
      // stylesheet writes out only while the frame is marked. As text, one rule of that stylesheet was all that
      // kept it off the page, and without the rule it stood above the example under a bare address.
      expect(text(html)).not.toContain(said);
      expect(html.split(esc(said))).toHaveLength(2);
      // One sentence for the three calculators, in the form's words; true for as long as it shows, the script arriving or not.
      expect(said).toBe(lang === 'en' ? 'This link carries a beam of its own, which the page reads once it has finished loading. Until then nothing is shown here, so that the example is not taken for it.' : 'Este enlace trae su propia viga, que la página lee cuando termina de cargar. Hasta entonces no se muestra nada aquí, para que el ejemplo no se tome por ella.');
    });
  }

  it('each of the three views hands the page that line', () => {
    const source = (rel: string) => readFileSync(join(SRC, rel), 'utf8');
    expect(source('components/ttc/views/BeamCalculatorView.tsx')).toContain('<CalculatorPage lang={lang} path={BEAM_PATH} page={page} opening={ui.linkOpening}>');
    expect(source('components/ttc/views/SingleSpanView.tsx')).toContain('<CalculatorPage lang={lang} path={SPAN_PATH} page={spanPage[lang]} opening={beamStrings[lang].ui.linkOpening}>');
    expect(source('components/ttc/views/ContinuousBeamView.tsx')).toContain('<CalculatorPage lang={lang} path={CONTINUOUS_PATH} page={continuousPage[lang]} opening={beamStrings[lang].ui.linkOpening}>');
    expect(source('components/ttc/views/CalculatorPage.tsx')).toContain('<ToolFrame opening={opening}>{children}</ToolFrame>');
  });
});
