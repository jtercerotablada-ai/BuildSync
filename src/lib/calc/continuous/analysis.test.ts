import { readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { convertUnits, defaultBeam, sectionProps, stiffness, type SteelShape } from '../beam/model';
import { beamSpans, solveBeam, type BeamModel, type BeamSolution, type Side } from '../beam/solver';
import { analyseContinuous, analyseSafely, drawingOf, type AnalysisIssue, type ContinuousResults } from './analysis';
import { SHORT, STIFF } from './engine';
import { envelopeContinuous } from './envelope';
import { convertContinuous, defaultContinuous, jointPositions, toEngine, type ContinuousForm, type DistRow, type PointRow, type Section, type SpanRow } from './model';

/**
 * FROM THE FORM TO WHAT THE PAGE PRINTS — the third calculator's `analyse`.
 *
 * The engine and the envelope have their own tests (engine.test.ts,
 * envelope.test.ts), and so has the form (model.test.ts). What can go wrong
 * HERE is what stands between them and the page: a row of a table read from
 * the wrong joint, a highest value printed as the lowest, the arrangement of
 * one value named beside another, a deflection in feet under "in", a stress
 * given for a span that is not the section, rounding printed as a result —
 * or a result printed as zero.
 *
 * NOTHING BELOW ASKS THIS CALCULATOR'S ENGINE WHAT IT SHOULD SAY. A beam is
 * checked against
 *   — closed forms worked here in plain arithmetic (the three-moment
 *     equation, the beam tables), and
 *   — the FIRST calculator's engine (beam/solver.ts: another method, no
 *     elements at all), asked once for every arrangement of the live load,
 *     one by one: 2ⁿ beams, each solved whole.
 * (One test says of itself why it is the exception: the slope at a point
 * where spans are a million times apart in stiffness, which the first
 * calculator cannot hold.)
 */

const shapes: SteelShape[] = JSON.parse(readFileSync(join(resolve(__dirname, '..', '..'), 'steel', 'aisc-shapes.json'), 'utf8')).shapes;
const shape = (name: string) => shapes.find((s) => s.designation === name)!;
const near = (got: number, want: number, tol = 1e-9, scale = Math.max(1, Math.abs(want))) => expect(Math.abs(got - want), `got ${got}, want ${want}`).toBeLessThanOrEqual(tol * scale);

/** The example with something else in it. */
const beam = (over: Partial<ContinuousForm>): ContinuousForm => ({ ...defaultContinuous(), ...over });
const section = (over: Partial<Section>): Section => ({ ...defaultContinuous().section, ...over });
const span = (id: number, L: number, k = 1, dead = 0, live = 0): SpanRow => ({ id, L, k, dead, live });
const point = (id: number, on: number, a: number, P: number, dir: 'down' | 'up' = 'down', live = false): PointRow => ({ id, span: on, a, P, dir, live });
const dist = (id: number, on: number, a1: number, a2: number, w1: number, w2: number, dir: 'down' | 'up' = 'down', live = false): DistRow => ({ id, span: on, a1, a2, w1, w2, dir, live });
const zeros = (n: number) => Array.from({ length: n }, () => 0);
const solved = (form: ContinuousForm, steel?: SteelShape | null): ContinuousResults => {
  const a = analyseContinuous(form, steel);
  expect(a.issues, JSON.stringify(a.issues)).toEqual([]);
  return a.results!;
};
/** The codes of what is wrong, with the row each is on. */
const faults = (issues: AnalysisIssue[]) => issues.map((i) => (i.row ? [i.code, i.row] : [i.code]));

/* ── The first calculator's engine, one arrangement at a time ─────────── */

/** The spans whose live load is one, as the form has them. */
const liveOf = (form: ContinuousForm) => form.spans.map((_, i) => i).filter((i) => form.spans[i].live !== 0 || form.points.some((p) => p.span === i && p.live && p.P !== 0) || form.dists.some((d) => d.span === i && d.live && (d.w1 !== 0 || d.w2 !== 0) && d.a1 !== d.a2));

/** The beam with the live load of the spans in `on` and of no other, as the first engine takes one: positions along the whole beam. Its own weight per length, if any, on every span. */
function wholeBeam(form: ContinuousForm, on: number[], ownWeight = 0): BeamModel {
  const at = jointPositions(form);
  const n = form.spans.length;
  const supports: BeamModel['supports'] = [];
  at.forEach((x, j) => {
    const kind = j === 0 ? form.left : j === n ? form.right : 'pin';
    if (kind !== 'free') supports.push({ x, kind: kind === 'fixed' ? 'fixed' : 'roller' });
  });
  const there = (r: { span: number; live: boolean }) => !r.live || on.includes(r.span);
  const sign = (dir: 'down' | 'up') => (dir === 'down' ? 1 : -1);
  return {
    L: at[n],
    supports,
    points: form.points.filter(there).map((p) => ({ x: at[p.span] + p.a, P: sign(p.dir) * p.P })),
    dists: [
      ...form.spans.flatMap((s, i) => [
        { x1: at[i], x2: at[i + 1], w1: s.dead + ownWeight, w2: s.dead + ownWeight },
        ...(on.includes(i) ? [{ x1: at[i], x2: at[i + 1], w1: s.live, w2: s.live }] : []),
      ]),
      ...form.dists.filter(there).map((d) => ({ x1: at[d.span] + d.a1, x2: at[d.span] + d.a2, w1: sign(d.dir) * d.w1, w2: sign(d.dir) * d.w2 })),
    ],
  };
}

/** Every arrangement of the live load, each solved whole by the first engine: the spans loaded, and the beam. */
function everyArrangement(form: ContinuousForm, ownWeight = 0): { on: number[]; sol: BeamSolution }[] {
  const live = liveOf(form);
  return Array.from({ length: 2 ** live.length }, (_, mask) => {
    const on = live.filter((_, b) => mask & (1 << b));
    const sol = solveBeam(wholeBeam(form, on, ownWeight));
    if (!sol.ok) throw new Error(`the first engine refused the beam: ${JSON.stringify(sol.issues)}`);
    return { on, sol };
  });
}

/** Where a response of a solved beam crosses zero between two places, by bisection; null when it does not. */
function crossing(f: (x: number) => number, a: number, b: number): number | null {
  let [fa, fb] = [f(a), f(b)];
  if (!(fa * fb < 0)) return null;
  for (let i = 0; i < 80; i++) {
    const m = (a + b) / 2;
    const fm = f(m);
    if (fa * fm <= 0) [b, fb] = [m, fm];
    else [a, fa] = [m, fm];
  }
  return (a + b) / 2;
}

/** The highest moment of a solved beam between two places: at one of them, at a place where something happens, or where the shear crosses zero between two of those. */
function highestMoment(sol: BeamSolution, from: number, to: number): number {
  const marks = [from, ...sol.breaks.filter((x) => x > from && x < to), to];
  let best = -Infinity;
  marks.forEach((x, i) => {
    best = Math.max(best, sol.at(x, i === 0 ? 'right' : 'left').M);
    if (i === 0) return;
    const [a, b] = [marks[i - 1], x];
    const e = (b - a) * 1e-12;
    const turn = crossing((xx) => sol.at(xx, 'right').V, a + e, b - e);
    if (turn !== null) best = Math.max(best, sol.at(turn).M);
  });
  return best;
}

describe('continuous beam, analysed: the example', () => {
  // Three spans of 24, 30 and 24 ft on simple supports; dead 0.9 kip/ft and
  // live 1.2 kip/ft on each; E = 29,000 ksi, I = 843 in⁴, S = 81.6 in³,
  // shear area 7.245 in².
  //
  // CLAPEYRON, for spans L1, L2, L3 under w1, w2, w3 with nothing at the two
  // ends (MB over the second support, MC over the third):
  //     2(L1 + L2)·MB + L2·MC = −(w1·L1³ + w2·L2³)/4
  //     L2·MB + 2(L2 + L3)·MC = −(w2·L2³ + w3·L3³)/4
  // Then statics: the end reaction is w1·L1/2 + MB/L1, the shear leaving B is
  // w2·L2/2 + (MC − MB)/L2, and the largest sagging moment of a span is its
  // left moment plus (its left shear)²/2w.
  const [L1, L2, L3] = [24, 30, 24];
  const clapeyron = (w1: number, w2: number, w3: number) => {
    const [a, b, c, d] = [2 * (L1 + L2), L2, L2, 2 * (L2 + L3)];
    const [p, q] = [-(w1 * L1 ** 3 + w2 * L2 ** 3) / 4, -(w2 * L2 ** 3 + w3 * L3 ** 3) / 4];
    const det = a * d - b * c;
    const MB = (p * d - b * q) / det;
    const MC = (a * q - c * p) / det;
    const RA = (w1 * L1) / 2 + MB / L1;
    const RD = (w3 * L3) / 2 + MC / L3;
    const VB = (w2 * L2) / 2 + (MC - MB) / L2;
    const RB = w1 * L1 - RA + VB;
    const RC = w2 * L2 - VB + w3 * L3 - RD;
    return { MB, MC, R: [RA, RB, RC, RD], sag: [RA ** 2 / (2 * w1), MB + VB ** 2 / (2 * w2), RD ** 2 / (2 * w3)], shear: Math.max(RA, w1 * L1 - RA, VB, w2 * L2 - VB, w3 * L3 - RD, RD) };
  };
  /** The eight arrangements: each span's 1.2 on or off, over 0.9 everywhere. */
  const eight = Array.from({ length: 8 }, (_, mask) => {
    const on = [0, 1, 2].filter((i) => mask & (1 << i));
    const w = [0, 1, 2].map((i) => 0.9 + (on.includes(i) ? 1.2 : 0));
    return { on, ...clapeyron(w[0], w[1], w[2]) };
  });
  const best = (of: (c: (typeof eight)[number]) => number, sign: 1 | -1) => eight.reduce((top, c) => (sign * of(c) > sign * of(top) ? c : top));
  const EI = (29000 * 843) / 144;

  it('under all its loads at once: the three-moment equation, and the reactions carry the load', () => {
    const r = solved(beam({ everyArrangement: false }));
    const all = clapeyron(2.1, 2.1, 2.1);
    // By hand: MB(2·54 + 30) = −2.1(24³ + 30³)/4, so MB = −21,432.6/138.
    near(all.MB, -21432.6 / 138);
    expect(r.ranged).toBe(false);
    expect(r.supports.map((s) => [s.number, s.joint, s.x, s.kind])).toEqual([[1, 0, 0, 'pin'], [2, 1, 24, 'roller'], [3, 2, 54, 'roller'], [4, 3, 78, 'roller']]);
    r.supports.forEach((s, j) => {
      near(s.Rv.max.value, all.R[j]);
      near(s.M.max.value, [0, all.MB, all.MC, 0][j]);
      // One case: the two of a pair are one value, at the support, and no arrangement is named.
      expect([s.Rv.one, s.M.one, s.Rv.max.on, s.Rv.min.on, s.M.max.on]).toEqual([true, true, null, null, null]);
      expect(s.Rv.min).toEqual(s.Rv.max);
      expect(s.Rv.max.x).toBe(s.x);
    });
    r.spans.forEach((s, i) => {
      near(s.sagging.value, all.sag[i]);
      expect(s.sagging.on).toBeNull();
    });
    near(r.spans[0].sagging.x!, all.R[0] / 2.1);
    near(r.largest.hogging.value, all.MB);
    near(r.largest.shear.value, all.shear);
    // 2.1 × 78 = 163.8 kip, and the page may say the reactions add up to it.
    expect(r.balance).toEqual({ reactions: expect.any(Number), load: 163.8, ok: true });
    near(r.balance!.reactions, 163.8);
    // The drawing is given the reactions: four arrows.
    expect(r.reactions!.map((x) => x.kind)).toEqual(['pin', 'roller', 'roller', 'roller']);
    r.reactions!.forEach((x, j) => near(x.Rv, all.R[j]));
  });

  it('in every arrangement: each support’s highest and lowest reaction and moment, with the spans loaded for each', () => {
    const a = analyseContinuous(defaultContinuous());
    const r = a.results!;
    expect(a.liveSpans).toEqual([0, 1, 2]);
    expect(r.ranged).toBe(true);
    // No one sum of reactions, and no arrow of one length.
    expect([r.balance, r.reactions]).toEqual([null, null]);
    r.supports.forEach((s, j) => {
      const [top, low] = [best((c) => c.R[j], 1), best((c) => c.R[j], -1)];
      near(s.Rv.max.value, top.R[j]);
      near(s.Rv.min.value, low.R[j]);
      expect(s.Rv.max.on).toEqual(top.on);
      expect(s.Rv.min.on).toEqual(low.on);
      expect(s.Rv.one).toBe(false);
    });
    // Over the second support: most hogging with the two spans beside it loaded, least with the far one alone.
    const [most, least] = [best((c) => c.MB, -1), best((c) => c.MB, 1)];
    near(r.supports[1].M.min.value, most.MB);
    near(r.supports[1].M.max.value, least.MB);
    expect([r.supports[1].M.min.on, r.supports[1].M.max.on]).toEqual([[0, 1], [2]]);
    expect([most.on, least.on]).toEqual([[0, 1], [2]]);
    // A simple support at an end holds no moment in any arrangement: one value, zero.
    expect([r.supports[0].M.one, r.supports[0].M.max.value, r.supports[3].M.min.value]).toEqual([true, 0, 0]);
    // The figures the page opens with.
    expect(r.supports.map((s) => [Number(s.Rv.min.value.toPrecision(4)), Number(s.Rv.max.value.toPrecision(4))])).toEqual([[5.581, 21.17], [24.82, 65.43], [24.82, 65.43], [5.581, 21.17]]);
    expect(Number(most.MB.toPrecision(4))).toBe(-166.9);
  });

  it('in every arrangement: each span’s largest sagging moment, the largest values and the stresses', () => {
    const r = solved(defaultContinuous());
    r.spans.forEach((s, i) => {
      const top = best((c) => c.sag[i], 1);
      near(s.sagging.value, top.sag[i]);
      expect(s.sagging.on).toEqual(top.on);
      expect([s.index, s.kind]).toEqual([i, 'span']);
    });
    // An end span sags most with the two end spans loaded; the middle one with its own load alone.
    expect(r.spans.map((s) => s.sagging.on)).toEqual([[0, 2], [1], [0, 2]]);
    expect(r.spans.map((s) => Number(s.sagging.value.toPrecision(4)))).toEqual([106.8, 111, 106.8]);
    const sag = best((c) => Math.max(...c.sag), 1);
    const hog = best((c) => Math.min(c.MB, c.MC), -1);
    const shear = best((c) => c.shear, 1);
    near(r.largest.sagging.value, Math.max(...sag.sag));
    near(r.largest.hogging.value, Math.min(hog.MB, hog.MC));
    near(Math.abs(r.largest.shear.value), shear.shear);
    expect(r.largest.sagging.on).toEqual([1]);
    expect(r.largest.sagging.x).toBeCloseTo(39, 9);
    // The moment furthest from zero is the hogging one: 166.9 kip·ft × 12 ÷ 81.6 in³, and 33.27 kip ÷ 7.245 in².
    expect(r.largest.moment).toBe(r.largest.hogging);
    near(r.largest.sigma!, (Math.abs(Math.min(hog.MB, hog.MC)) * 12) / 81.6);
    near(r.largest.tau!, shear.shear / 7.245);
    expect([Number(r.largest.sigma!.toPrecision(4)), Number(r.largest.tau!.toPrecision(4))]).toEqual([24.54, 4.592]);
  });

  it('the middle span’s deflection, by the beam tables: 5wL⁴/384EI less what its two end moments lift it', () => {
    const r = solved(defaultContinuous());
    // With its own live load alone the beam is symmetric: MB = MC, and the span is lowest at its middle.
    const alone = eight.find((c) => c.on.length === 1 && c.on[0] === 1)!;
    near(alone.MB, alone.MC);
    const inches = ((5 * 2.1 * L2 ** 4) / 384 + ((alone.MB + alone.MC) * L2 ** 2) / 16) * (12 / EI);
    near(r.spans[1].deflection!.value, -inches);
    expect(r.spans[1].deflection!.on).toEqual([1]);
    near(r.spans[1].deflection!.x!, 39);
    near(r.spans[1].ratio!, (L2 * 12) / inches);
    expect([Number(inches.toPrecision(4)), Math.round(r.spans[1].ratio!)]).toEqual([0.5695, 632]);
    // No support settles: the lowest point of the whole beam is that one.
    expect(r.largest.deflection).toEqual(r.spans[1].deflection);
  });
});

describe('continuous beam, analysed: against the first calculator’s engine, arrangement by arrangement', () => {
  // A wall at the left, an overhang at the right, four spans, and every kind
  // of load: uniform dead and live, point loads up and down, a load that
  // varies over part of a span — some live, some not.
  const mixed = (): ContinuousForm => ({
    units: 'us',
    spans: [span(1, 18, 1, 0.6, 1), span(2, 26, 1, 0.8, 0), span(3, 22, 1, 0.5, 1.4), span(4, 7, 1, 0.4, 0.9)],
    left: 'fixed',
    right: 'free',
    settlements: zeros(5),
    points: [point(5, 0, 7, 12, 'down', true), point(6, 1, 10, 9), point(7, 1, 19, 6, 'up', true), point(8, 3, 7, 3, 'down', true)],
    dists: [dist(9, 2, 4, 15, 0.3, 1.6, 'down', true), dist(10, 1, 2, 12, 1.1, 0.2)],
    everyArrangement: true,
    section: section({ E: 29000, I: 1200, S: 96, Av: 8 }),
    nextId: 11,
  });
  const form = mixed();
  const cases = everyArrangement(form);
  const r = solved(form);
  const at = jointPositions(form);
  const EI = (29000 * 1200) / 144;
  /** Of every arrangement, the one where a value is highest (or lowest), and that value. */
  const over = (of: (sol: BeamSolution) => number, sign: 1 | -1) => cases.reduce((top, c) => (sign * of(c.sol) > sign * of(top.sol) ? c : top));
  // What the first engine is good to on such a beam, of the largest of each diagram.
  const tol = 1e-8;

  it('all four spans carry a live load: sixteen arrangements, each solved whole', () => {
    expect(liveOf(form)).toEqual([0, 1, 2, 3]);
    expect(analyseContinuous(form).liveSpans).toEqual([0, 1, 2, 3]);
    expect(cases).toHaveLength(16);
    expect(r.ranged).toBe(true);
    expect(r.L).toBe(73);
  });

  it('the supports: the reaction and the moment over each, highest and lowest', () => {
    // A wall, then three simple supports; the free end is a joint and no support.
    expect(r.supports.map((s) => [s.number, s.joint, s.x, s.kind])).toEqual([[1, 0, 0, 'fixed'], [2, 1, 18, 'pin'], [3, 2, 44, 'roller'], [4, 3, 66, 'roller']]);
    r.supports.forEach((s, j) => {
      const R = (sol: BeamSolution) => sol.reactions[j].Rv;
      // At the wall, on the side that is the beam; elsewhere the moment is one number.
      const M = (sol: BeamSolution) => sol.at(s.x, j === 0 ? 'right' : 'left').M;
      near(s.Rv.max.value, R(over(R, 1).sol), tol, 100);
      near(s.Rv.min.value, R(over(R, -1).sol), tol, 100);
      near(s.M.max.value, M(over(M, 1).sol), tol, 500);
      near(s.M.min.value, M(over(M, -1).sol), tol, 500);
      // The arrangement named gives the value: solved alone, by the other engine.
      const named = (on: number[]) => solveBeam(wholeBeam(form, on)) as BeamSolution;
      near(R(named(s.Rv.max.on!)), s.Rv.max.value, tol, 100);
      near(R(named(s.Rv.min.on!)), s.Rv.min.value, tol, 100);
      near(M(named(s.M.max.on!)), s.M.max.value, tol, 500);
      near(M(named(s.M.min.on!)), s.M.min.value, tol, 500);
    });
    // The overhang's support: its moment is the overhang's loads about it — statics, whatever the other spans carry.
    const hang = (live: boolean) => -((0.4 + (live ? 0.9 : 0)) * 7 * 3.5 + (live ? 3 * 7 : 0));
    near(r.supports[3].M.min.value, hang(true));
    near(r.supports[3].M.max.value, hang(false));
    expect([r.supports[3].M.min.on, r.supports[3].M.max.on]).toEqual([[3], []]);
  });

  it('the spans: the largest sagging moment and the largest deflection of each, over every arrangement', () => {
    r.spans.forEach((s, i) => {
      const sag = (sol: BeamSolution) => highestMoment(sol, at[i], at[i + 1]);
      const top = sag(over(sag, 1).sol);
      if (top > 1e-6) {
        near(s.sagging.value, top, tol, 500);
        near(highestMoment(solveBeam(wholeBeam(form, s.sagging.on!)) as BeamSolution, at[i], at[i + 1]), s.sagging.value, tol, 500);
      } else expect([s.sagging.value, s.sagging.x]).toEqual([0, null]);
      // The first engine's own largest deflection of each span; no support settles, so it is from the span's supports.
      const deflection = (sol: BeamSolution) => beamSpans(sol)[i].EIv.value * (12 / EI);
      const [down, up] = [deflection(over(deflection, -1).sol), deflection(over(deflection, 1).sol)];
      const want = Math.abs(down) > Math.abs(up) ? down : up;
      near(s.deflection!.value, want, 1e-7, 1);
      near(deflection(solveBeam(wholeBeam(form, s.deflection!.on!)) as BeamSolution), s.deflection!.value, 1e-7, 1);
      // A span against its length, an overhang against twice its length (inches over inches).
      near(s.ratio!, ((i === 3 ? 2 : 1) * form.spans[i].L * 12) / Math.abs(want), 1e-6);
    });
    expect(r.spans.map((s) => s.kind)).toEqual(['span', 'span', 'span', 'cantilever']);
    // The overhang hogs all along: it has no sagging moment.
    expect([r.spans[3].sagging.value, r.spans[3].sagging.x]).toEqual([0, null]);
  });

  it('the largest values, and the two edges of each diagram', () => {
    const peak = (of: (sol: BeamSolution) => number, sign: 1 | -1) => of(over(of, sign).sol);
    near(r.largest.peaks.V[0].value, peak((s) => s.extremes.Vmax.value, 1), tol, 100);
    near(r.largest.peaks.V[1].value, peak((s) => s.extremes.Vmin.value, -1), tol, 100);
    near(r.largest.peaks.M[0].value, peak((s) => s.extremes.Mmax.value, 1), tol, 500);
    near(r.largest.peaks.M[1].value, peak((s) => s.extremes.Mmin.value, -1), tol, 500);
    near(r.largest.peaks.D![0].value, peak((s) => s.extremes.EIvMax.value, 1) * (12 / EI), 1e-7, 1);
    near(r.largest.peaks.D![1].value, peak((s) => s.extremes.EIvMin.value, -1) * (12 / EI), 1e-7, 1);
    expect(r.largest.sagging).toBe(r.largest.peaks.M[0]);
    expect(r.largest.hogging).toBe(r.largest.peaks.M[1]);
    near(r.largest.sigma!, (Math.abs(r.largest.moment.value) * 12) / 96);
    near(r.largest.tau!, Math.abs(r.largest.shear.value) / 8);
    // Every point drawn is the highest and the lowest of the sixteen there — one in seven of them is asked.
    const d = r.diagrams;
    expect(d.V.lower).toHaveLength(d.V.upper.length);
    expect(d.V.upper.length).toBeGreaterThan(300);
    d.M.upper.forEach((p, n) => {
      if (n % 7) return;
      // A station is one side of its place; a jump is at a load or a support, where the moment is one number.
      const all = cases.map((c) => c.sol.at(p.x, p.x === 73 ? 'left' : 'right').M);
      near(p.y, Math.max(...all), tol, 500);
      near(d.M.lower![n].y, Math.min(...all), tol, 500);
      expect(d.M.lower![n].x).toBe(p.x);
      expect(d.D!.upper[n].y).toBeGreaterThanOrEqual(d.D!.lower![n].y);
    });
    // The values labelled are the two peaks, where they are.
    expect(d.M.marks).toEqual([{ x: r.largest.peaks.M[0].x, y: r.largest.peaks.M[0].value }, { x: r.largest.peaks.M[1].x, y: r.largest.peaks.M[1].value }]);
    expect(d.V.marks).toHaveLength(2);
    expect(d.D!.marks.map((m) => m.y)).toEqual(r.largest.peaks.D!.map((p) => p.value));
  });

  it('the values at a point: shear, moment, deflection and slope as ranges, on both sides of a jump', () => {
    // In a span, at a point load (the shear jumps), at a support, at the wall and at the free end.
    for (const x of [5, 7, 18, 28, 31.25, 44, 59, 66, 70, 0, 73]) {
      const here = r.at(x);
      const range = (of: (sol: BeamSolution, side: Side) => number, side: Side) => {
        const all = cases.map((c) => of(c.sol, side));
        return { max: Math.max(...all), min: Math.min(...all) };
      };
      for (const side of ['left', 'right'] as const) {
        const [V, M] = [range((s, sd) => s.at(x, sd).V, side), range((s, sd) => s.at(x, sd).M, side)];
        near(here.V[side].max, V.max, tol, 100);
        near(here.V[side].min, V.min, tol, 100);
        near(here.M[side].max, M.max, tol, 500);
        near(here.M[side].min, M.min, tol, 500);
      }
      const v = range((s) => s.at(x, 'right').EIv * (12 / EI), 'right');
      const turn = range((s) => s.at(x, 'right').EItheta / EI, 'right');
      near(here.deflection!.max, v.max, 1e-7, 1);
      near(here.deflection!.min, v.min, 1e-7, 1);
      near(here.slope!.max, turn.max, 1e-7, 0.01);
      near(here.slope!.min, turn.min, 1e-7, 0.01);
      expect(here.x).toBe(x);
    }
    // At the 12 kip live load on the first span the shear drops by 12 with it on, and by nothing with it off.
    const at7 = r.at(7);
    expect(at7.V.left.max - at7.V.right.min).toBeGreaterThan(11.9);
    // At the wall the moment is the wall's on the beam's side, and there is nothing past it.
    expect(r.at(0).M.left).toEqual({ max: 0, min: 0 });
    expect(r.at(0).M.right.min).toBeCloseTo(r.supports[0].M.min.value, 9);
    // A place off the beam is read at its end.
    expect(r.at(-5).x).toBe(0);
    expect(r.at(99).x).toBe(73);
  });

  it('the stress at a point: each end of its range is |M| ÷ S of one arrangement solved whole — never a nothing that no arrangement gives', () => {
    // Where the moment changes sign between arrangements, zero lies between the two ends of its range and is the
    // moment of none of them: the least stress is that of whichever arrangement bends the beam least there.
    const places = [5, 12, 28, 31.25, 44, 50, 59, 70];
    const changes = places.map((x) => {
      const here = r.at(x);
      const each = cases.map((c) => (Math.abs(c.sol.at(x, 'right').M) * 12) / 96);
      near(here.sigma!.max, Math.max(...each), tol, 100);
      near(here.sigma!.min, Math.min(...each), tol, 100);
      const M = here.M.right;
      near(here.sigma!.max, (Math.max(Math.abs(M.max), Math.abs(M.min)) * 12) / 96);
      const turns = M.min < 0 && M.max > 0;
      // Of one sign: the least is an end of the moment's range. Of two: it is neither, and it is not nothing.
      if (turns) expect(here.sigma!.min).toBeGreaterThan(0);
      else near(here.sigma!.min, (Math.min(Math.abs(M.max), Math.abs(M.min)) * 12) / 96);
      return turns;
    });
    // Somewhere on this beam the moment does change sign with the arrangement, and somewhere it does not.
    expect(changes).toContain(true);
    expect(changes).toContain(false);
    expect(r.at(44).sigma!.min).toBeGreaterThan(0);

    // BY HAND. Two spans of 24 ft, 0.3 kip/ft dead on both and 3 kip/ft live on the second, S = 81.6 in³: the
    // three-moment equation gives MB = −(w1 + w2)·24²/16. With no live load MB = −21.6 and the moment at 12 ft is
    // 0.3·12·12/2 − 10.8 = +10.8 kip·ft; with it MB = −129.6 and the moment there is 21.6 − 64.8 = −43.2. Two
    // arrangements, two stresses, and neither is nothing.
    const two = solved(beam({ spans: [span(1, 24, 1, 0.3, 0), span(2, 24, 1, 0.3, 3)], settlements: zeros(3), nextId: 3 }));
    expect(two.at(12).M.right.min).toBeCloseTo(-43.2, 9);
    expect(two.at(12).M.right.max).toBeCloseTo(10.8, 9);
    near(two.at(12).sigma!.min, (10.8 * 12) / 81.6);
    near(two.at(12).sigma!.max, (43.2 * 12) / 81.6);

    // …and nothing where an arrangement does leave the beam unbent. Two spans of 24 ft under 0.3 kip/ft dead and
    // 2 kip/ft live each: with no live load M(x) = 0.3·x·(18 − x)/2, nothing at 18 ft; live on the first span alone
    // sags it there (+54 kip·ft) and live on the second hogs it. One arrangement of the four gives a moment of zero.
    const flat = solved(beam({ spans: [span(1, 24, 1, 0.3, 2), span(2, 24, 1, 0.3, 2)], settlements: zeros(3), nextId: 3 }));
    expect(flat.at(18).M.right.max).toBeCloseTo(54, 9);
    expect(flat.at(18).M.right.min).toBeLessThan(0);
    expect(flat.at(18).sigma!.min).toBe(0);
    // Without E and I there is no slope to give, and the stress is the same: it is the envelope's own cases that are added up for it.
    const bare = solved(beam({ spans: [span(1, 24, 1, 0.3, 0), span(2, 24, 1, 0.3, 3)], settlements: zeros(3), nextId: 3, section: section({ E: 0, I: 0 }) }));
    expect(bare.at(12).slope).toBeNull();
    near(bare.at(12).sigma!.min, (10.8 * 12) / 81.6);
  });

  it('with the live load on every span instead: the one beam, as the first engine solves it', () => {
    const one = solved({ ...form, everyArrangement: false });
    const sol = cases[cases.length - 1].sol;
    expect(cases[cases.length - 1].on).toEqual([0, 1, 2, 3]);
    expect(one.ranged).toBe(false);
    one.supports.forEach((s, j) => near(s.Rv.max.value, sol.reactions[j].Rv, tol, 100));
    near(one.largest.peaks.M[0].value, sol.extremes.Mmax.value, tol, 500);
    near(one.largest.peaks.M[1].value, sol.extremes.Mmin.value, tol, 500);
    near(one.balance!.load, sol.totalLoad);
    expect(one.balance!.ok).toBe(true);
    // One line, no second edge; and the values at a point are one value each.
    expect([one.diagrams.V.lower, one.diagrams.M.lower, one.diagrams.D!.lower]).toEqual([null, null, null]);
    const here = one.at(31.25);
    expect(here.M.right.max).toBe(here.M.right.min);
    near(here.slope!.max, sol.at(31.25).EItheta / EI, 1e-7, 0.01);
    expect(here.slope!.max).toBe(here.slope!.min);
    expect(here.sigma!.max).toBe(here.sigma!.min);
  });
});

describe('continuous beam, analysed: the slope at a point, where spans are a million times apart in stiffness', () => {
  // The slope's range at a point is the envelope's, like the others — the one response it follows at a point and
  // no further (envelope.ts). The first calculator has one EI along the beam and cannot be asked about this beam; and
  // what is held here is not the beam but the ADDING UP — so, this once, the yardstick is the page's own analysis with
  // the live load "on every span", which adds nothing up: one arrangement at a time, each solved whole.
  it('each end of the range is the slope of one arrangement solved whole, to nine figures — in a stiff span too', () => {
    const lens = [24, 30, 18, 27, 22, 31];
    const ks = [0.001, 1000, 0.001, 1000, 0.001, 1000];
    const form = beam({ spans: lens.map((L, i) => span(i + 1, L, ks[i], 0.9, 1.2 + i / 10)), settlements: zeros(7), nextId: 20 });
    const a = analyseContinuous(form);
    expect(a.issues).toEqual([]);
    const r = a.results!;
    const at = jointPositions(form);
    // Sixty-four arrangements, each as the one case it is.
    const wholes = Array.from({ length: 64 }, (_, mask) => solved({ ...form, everyArrangement: false, spans: form.spans.map((s, i) => ((mask >> i) & 1 ? s : { ...s, live: 0 })) }));
    // Under the page's own floor a slope is printed as zero, by its rule: what is compared is above it, twice over.
    const floor = 2 * r.floors.EItheta * a.toSlope;
    let stiff = 0;
    let flexible = 0;
    for (let j = 1; j < 60; j++) {
      const x = (r.L * j) / 60 + 0.37;
      if (x >= r.L) continue;
      const got = r.at(x).slope!;
      const each = wholes.map((w) => w.at(x).slope!.max);
      const inStiff = ks[at.findIndex((from, i) => x >= from && x < at[i + 1])] === 1000;
      for (const [g, w] of [
        [got.max, Math.max(...each)],
        [got.min, Math.min(...each)],
      ]) {
        if (Math.abs(w) < floor) continue;
        near(g, w, 1e-9, Math.abs(w));
        if (inStiff) stiff += 1;
        else flexible += 1;
      }
    }
    // A slope in a stiff span is a millionth of one in the span beside it — and is still that span's slope. (With
    // rounding measured against the largest slope a live load causes anywhere, these were out in the sixth figure.)
    expect(stiff).toBeGreaterThan(20);
    expect(flexible).toBeGreaterThan(20);
  });

  // It was once made here, from the envelope's cases solved a second time on every analysis: about a third of what
  // an analysis of eight spans took, at every keystroke. One set of cases now: this file solves none of its own.
  it('the slope’s range is read off the envelope’s state with the others, and no case is solved here', () => {
    const source = readFileSync(join(resolve(__dirname), 'analysis.ts'), 'utf8');
    expect(source).not.toMatch(/\bsolveCase\b/);
    expect(source).toMatch(/if \(env\) return env\.at\(x, side\);/);
    expect(source).toMatch(/slope: toSlope \? settled\(right\.EItheta, floors\.EItheta, toSlope\) : null,/);
    // …and it is the same number: the envelope's range of EI·θ at the point, over E·I.
    const a = analyseContinuous(defaultContinuous());
    const state = envelopeContinuous(toEngine(defaultContinuous(), a.section, a.EI).model);
    if (!state.ok) throw new Error('the example was not solved');
    for (const x of [5, 20, 24, 39, 61.5]) {
      const turned = state.at(x, 'right').EItheta;
      expect(turned.max).toBeGreaterThan(turned.min);
      expect(a.results!.at(x).slope).toEqual({ max: turned.max * a.toSlope, min: turned.min * a.toSlope });
    }
  });
});

describe('continuous beam, analysed: one arrangement, or every one', () => {
  it('asked for every arrangement with no live load anywhere: there is one, and it is solved as one case', () => {
    const none = beam({ spans: defaultContinuous().spans.map((s) => ({ ...s, live: 0 })) });
    const a = analyseContinuous(none);
    expect(none.everyArrangement).toBe(true);
    expect(a.liveSpans).toEqual([]);
    expect(a.results!.ranged).toBe(false);
    expect(a.results!.balance!.ok).toBe(true);
    expect(a.results!.supports[1].Rv.max.on).toBeNull();
  });

  it('a live load of no size, or of no length, is none: its span is not counted', () => {
    const form = beam({
      spans: [span(1, 20, 1, 1, 0), span(2, 20, 1, 1, 0), span(3, 20, 1, 1, 0.5)],
      points: [point(4, 0, 5, 0, 'down', true)],
      dists: [dist(5, 1, 8, 8, 2, 2, 'down', true), dist(6, 1, 3, 9, 0, 0, 'down', true)],
      nextId: 7,
    });
    expect(analyseContinuous(form).liveSpans).toEqual([2]);
    // Given a size and a length, each is one.
    expect(analyseContinuous({ ...form, points: [point(4, 0, 5, 2, 'down', true)], dists: [dist(5, 1, 8, 9, 2, 2, 'down', true)] }).liveSpans).toEqual([0, 1, 2]);
  });

  it('the beam’s own weight is there in every arrangement, on every span', () => {
    // A W21X44 weighs 44 lb/ft: 0.044 kip/ft of dead load over the 0.9.
    const form = beam({ section: section({ mode: 'shape', shape: 'W21X44', selfWeight: true }) });
    const a = analyseContinuous(form, shape('W21X44'));
    expect(a.section.selfWeight).toBeCloseTo(0.044, 12);
    const cases = everyArrangement(form, 0.044);
    const r = a.results!;
    r.supports.forEach((s, j) => {
      near(s.Rv.max.value, Math.max(...cases.map((c) => c.sol.reactions[j].Rv)), 1e-8, 100);
      near(s.Rv.min.value, Math.min(...cases.map((c) => c.sol.reactions[j].Rv)), 1e-8, 100);
    });
    // Without the table of shapes there is no weight and no stiffness yet: the beam is still solved, with no deflection.
    const bare = analyseContinuous(form, null);
    expect([bare.section.selfWeight, bare.EI, bare.toDeflection]).toEqual([0, 0, 0]);
    expect([bare.results!.diagrams.D, bare.results!.spans[0].deflection, bare.results!.largest.deflection, bare.results!.at(10).slope]).toEqual([null, null, null, null]);
    expect(bare.results!.largest.sigma).toBeNull();
  });

  it('in metres and kilonewtons: the same beam, the same results in the other units', () => {
    // With a modulus of its own: a listed material keeps its round number in each system (29,000 ksi is 199,948 MPa, and steel is 200,000).
    const mine = beam({ section: section({ material: 'custom' }) });
    const us = solved(mine);
    const si = solved(convertContinuous(mine, 'si'));
    // The form converts to six figures; so do the results agree to about that.
    near(si.largest.hogging.value, us.largest.hogging.value * 4.4482216152605 * 0.3048, 2e-5);
    near(si.supports[1].Rv.max.value, us.supports[1].Rv.max.value * 4.4482216152605, 2e-5);
    near(si.spans[1].deflection!.value, us.spans[1].deflection!.value * 25.4, 5e-5);
    near(si.largest.sigma!, us.largest.sigma! * 6.894757293168361, 5e-5);
    near(si.spans[1].ratio!, us.spans[1].ratio!, 5e-5);
    expect(si.spans[1].deflection!.on).toEqual(us.spans[1].deflection!.on);
  });
});

describe('continuous beam, analysed: settlements and stiffness, by closed forms', () => {
  // Two spans of L, nothing on them, the middle support pushed down by δ:
  // the beam is a simple span of 2L bent down δ at its middle by the support
  // itself — a force of 48EIδ/(2L)³ = 6EIδ/L³, downward on the beam there.
  // Each end takes half of it, upward, and the moment over the middle is
  // 3EIδ/L², sagging.
  const L = 20;
  const sunk = (delta: number, over: Partial<ContinuousForm> = {}): ContinuousForm => beam({ spans: [span(1, L), span(2, L)], settlements: [0, delta, 0], section: section({ E: 29000, I: 1000, S: 0, Av: 0 }), nextId: 3, ...over });
  const EI = (29000 * 1000) / 144;

  it('a settlement with no load: 3EIδ/L² over the support, and the reactions it takes', () => {
    const delta = 0.6;
    const r = solved(sunk(delta));
    const d = delta / 12;
    near(r.supports[1].M.max.value, (3 * EI * d) / L ** 2);
    near(r.supports[0].Rv.max.value, (3 * EI * d) / L ** 3);
    near(r.supports[1].Rv.max.value, (-6 * EI * d) / L ** 3);
    near(r.supports[2].Rv.max.value, (3 * EI * d) / L ** 3);
    // The support is where it was put: 0.6 in down, the lowest point of the beam.
    near(r.at(L).deflection!.max, -delta);
    near(r.largest.deflection!.value, -delta);
    expect(r.largest.deflection!.x).toBe(L);
    // Each span from the line through ITS OWN supports. The half of a simple span under a load at its middle is
    // δ·ξ(3 − ξ²)/2 down at ξ of the way along; its chord is δ·ξ; between them δ·ξ(1 − ξ²)/2, largest at ξ = 1/√3:
    // δ/(3√3), below the chord — the moment sags all along.
    r.spans.forEach((s, i) => {
      near(s.deflection!.value, -delta / (3 * Math.sqrt(3)));
      near(s.deflection!.x!, i === 0 ? L / Math.sqrt(3) : 2 * L - L / Math.sqrt(3), 1e-7);
      near(s.ratio!, (L * 12) / (delta / (3 * Math.sqrt(3))));
    });
    // No load, and the reactions add up to none: 0 = 0.
    expect(r.balance).toEqual({ reactions: expect.any(Number), load: 0, ok: true });
    // The size of this problem is not zero — there is no load to measure against, and still its results are results.
    expect(r.loadScale).toBeGreaterThan(0);
    expect(r.largest.shear.x).not.toBeNull();
    near(Math.abs(r.largest.shear.value), (3 * EI * d) / L ** 3);
  });

  it('its size is the settlement’s: a thousandth of it is a thousandth of the results, not rounding', () => {
    const [big, small] = [solved(sunk(1)), solved(sunk(0.001))];
    near(small.loadScale, big.loadScale / 1000);
    near(small.supports[1].M.max.value, big.supports[1].M.max.value / 1000);
    near(small.floors.M, big.floors.M / 1000);
    expect(small.supports[1].M.max.value).toBeGreaterThan(1e6 * small.floors.M);
    // A billionth of the size of the problem, times L for a moment; times L² for a slope and L³ for a deflection,
    // and for those two a hundredth of that again where every span is the section entered (a factor of 1).
    const F = 1e-9 * big.loadScale;
    expect([big.floors.F, big.floors.V, big.floors.M]).toEqual([F, F, F * 40]);
    near(big.floors.EItheta, F * 1600 * 0.01, 1e-12, F * 16);
    near(big.floors.EIv, F * 64000 * 0.01, 1e-12, F * 640);
    // It follows the SMALLEST factor, which is what the engine's rounding of a deflection goes as: ten times the
    // section everywhere, a tenth of that; beside a span a hundred times more flexible than the section — or a
    // thousand — the billionth itself, and never more.
    const floorOf = (k1: number, k2: number) => {
      const r = solved(sunk(1, { spans: [span(1, L, k1), span(2, L, k2)] }));
      return r.floors.EIv / (1e-9 * r.loadScale * 64000);
    };
    near(floorOf(10, 10), 0.001, 1e-12);
    near(floorOf(1, 1000), 0.01, 1e-12);
    near(floorOf(0.5, 1), 0.02, 1e-12);
    near(floorOf(0.01, 1), 1, 1e-12);
    near(floorOf(0.001, 1), 1, 1e-12);
  });

  // Eight spans under 2.1 kip/ft, the fourth 10 ft long and a thousand times as stiff as the section. Clapeyron,
  // each span's length over its factor (a = L/k), for the seven moments over the inner supports:
  //     a[j]·M[j−1] + 2(a[j] + a[j+1])·M[j] + a[j+1]·M[j+1] = −w/4·(L[j]²·a[j] + L[j+1]²·a[j+1])
  // solved here by elimination; then the stiff span as a simple beam under its load and its two end moments:
  // at its middle (5wL⁴/384 + (Ml + Mr)·L²/16) ÷ (1000·EI) from its supports. A ten-thousandth of an inch, upward:
  // two parts in ten thousand of what the spans beside it deflect, and a result — its row is not "0" and "—".
  it('a span a thousand times as stiff as the rest has a deflection of its own, and a beam a hair from a support has left it', () => {
    const lens = [30, 30, 30, 10, 30, 30, 30, 30];
    const ks = [1, 1, 1, 1000, 1, 1, 1, 1];
    const w = 2.1;
    const a = lens.map((len, i) => len / ks[i]);
    const [lo, di, up, rhs]: number[][] = [[], [], [], []];
    for (let j = 1; j < 8; j++) {
      lo.push(j > 1 ? a[j - 1] : 0);
      di.push(2 * (a[j - 1] + a[j]));
      up.push(j < 7 ? a[j] : 0);
      rhs.push((-w / 4) * (lens[j - 1] ** 2 * a[j - 1] + lens[j] ** 2 * a[j]));
    }
    for (let i = 1; i < 7; i++) {
      const f = lo[i] / di[i - 1];
      di[i] -= f * up[i - 1];
      rhs[i] -= f * rhs[i - 1];
    }
    const over: number[] = Array.from({ length: 7 }, () => 0);
    for (let i = 6; i >= 0; i--) over[i] = (rhs[i] - (i < 6 ? up[i] * over[i + 1] : 0)) / di[i];
    const [Ml, Mr] = [over[2], over[3]];
    const EIref = (29000 * 843) / 144;
    const lift = (-((5 * w * 10 ** 4) / 384 + ((Ml + Mr) * 10 ** 2) / 16) / (1000 * EIref)) * 12;
    expect(Number(lift.toPrecision(4))).toBe(0.0001217);
    const stiff = solved(beam({ spans: lens.map((len, i) => span(i + 1, len, ks[i], 0.9, 1.2)), settlements: zeros(9), everyArrangement: false, nextId: 9 }));
    near(stiff.supports[3].M.max.value, Ml, 1e-9, 200);
    near(stiff.at(95).deflection!.max, lift, 1e-7, lift);
    near(stiff.spans[3].deflection!.value, lift, 1e-3, lift);
    expect(stiff.spans[3].deflection!.x).not.toBeNull();
    expect(stiff.spans[3].ratio).toBeGreaterThan(99999);
    // One span of 20 ft under 1 kip/ft, read two ten-millionths of a foot from its support: the beam falls away
    // at wL³/24EI, and is w·x·(L³ − 2Lx² + x³)/24EI below its support there — five billionths of an inch, and that.
    const plain = solved(beam({ spans: [span(1, 20, 1, 1, 0)], settlements: zeros(2), everyArrangement: false, nextId: 2 }));
    const x = 2e-7;
    const down = (-(x * (20 ** 3 - 2 * 20 * x * x + x ** 3)) / 24 / EIref) * 12;
    near(plain.at(x).deflection!.max, down, 1e-6, Math.abs(down));
    // On the support itself it has not moved: nothing, exactly.
    expect(plain.at(0).deflection).toEqual({ max: 0, min: 0 });
    expect(plain.at(20).deflection).toEqual({ max: 0, min: 0 });
  });

  it('supports that all go down together bend nothing: no shear, no moment, no reaction, and the deflection is the settlement', () => {
    const r = solved(sunk(0.5, { settlements: [0.5, 0.5, 0.5] }));
    expect(r.supports.map((s) => [s.Rv.max.value, s.M.max.value])).toEqual([[0, 0], [0, 0], [0, 0]]);
    expect([r.largest.shear, r.largest.moment, r.largest.sagging, r.largest.hogging].map((v) => [v.value, v.x])).toEqual([[0, null], [0, null], [0, null], [0, null]]);
    expect(r.diagrams.V.upper.every((p) => p.y === 0) && r.diagrams.M.upper.every((p) => p.y === 0)).toBe(true);
    expect(r.diagrams.V.marks).toEqual([]);
    expect(r.diagrams.D!.upper.every((p) => Math.abs(p.y + 0.5) < 1e-12)).toBe(true);
    near(r.largest.deflection!.value, -0.5);
    // The beam is as low everywhere: its largest deflection has no place — where rounding makes −0.5 a hair more
    // or a hair less is not a place — and the level line is labelled once.
    expect(r.largest.deflection!.x).toBeNull();
    expect(r.largest.peaks.D!.map((p) => p.x)).toEqual([null, null]);
    expect(r.largest.peaks.D![0].value).toBe(r.largest.peaks.D![1].value);
    expect(r.diagrams.D!.marks).toHaveLength(1);
    near(r.diagrams.D!.marks[0].y, -0.5);
    // On unequal spans too, where the two hairs fall at two places (24, 30 and 24 ft, each support 0.3 in down).
    const three = solved(beam({ spans: [span(1, 24), span(2, 30), span(3, 24)], settlements: [0.3, 0.3, 0.3, 0.3], nextId: 4 }));
    expect([three.largest.deflection!.x, three.largest.peaks.D![0].x, three.largest.peaks.D![1].x, three.diagrams.D!.marks.length]).toEqual([null, null, null, 1]);
    near(three.largest.deflection!.value, -0.3);
    // A support that goes down further than the others is a place again.
    const one = solved(beam({ spans: [span(1, 24), span(2, 30), span(3, 24)], settlements: [0.3, 0.3, 0.4, 0.3], nextId: 4 }));
    expect(one.largest.deflection!.x).not.toBeNull();
    expect(one.diagrams.D!.marks).toHaveLength(2);
    // From its own supports no span has moved.
    expect(r.spans.map((s) => [s.deflection!.value, s.deflection!.x, s.ratio])).toEqual([[0, null, null], [0, null, null]]);
    expect(r.at(7).V.right).toEqual({ max: 0, min: 0 });
  });

  it('supports that go down along one straight line turn the beam and bend nothing: what is left is rounding, and is zero', () => {
    const r = solved(sunk(0.5, { settlements: [0, 0.5, 1] }));
    // Here the engine has something to add up — each span's supports do move apart — and what cancels is not an exact zero.
    expect(r.loadScale).toBeGreaterThan(0);
    expect(r.supports.map((s) => [s.Rv.max.value, s.M.max.value])).toEqual([[0, 0], [0, 0], [0, 0]]);
    expect([r.largest.shear.x, r.largest.moment.x]).toEqual([null, null]);
    expect(r.spans.map((s) => s.ratio)).toEqual([null, null]);
    near(r.at(30).deflection!.max, -0.75);
    near(r.at(30).slope!.max, -(0.5 / 12) / L);
  });

  it('a settlement under load adds to it: the two-span beam’s −wL²/8 and +3EIδ/L²', () => {
    const w = 1.5;
    const r = solved(sunk(0.6, { spans: [span(1, L, 1, w), span(2, L, 1, w)] }));
    near(r.supports[1].M.max.value, (-w * L ** 2) / 8 + (3 * EI * (0.6 / 12)) / L ** 2);
    near(r.supports[1].Rv.max.value, (5 * w * L) / 4 - (6 * EI * (0.6 / 12)) / L ** 3);
    near(r.balance!.load, 2 * w * L);
    expect(r.balance!.ok).toBe(true);
  });

  it('a settlement needs E and I: without them the beam is not solved, and the support is named', () => {
    const a = analyseContinuous(sunk(0.6, { section: section({ E: 29000, I: 0 }) }));
    expect(faults(a.issues)).toEqual([['settlement', { list: 'settlements', joint: 1 }]]);
    expect(a.results).toBeNull();
    // …and whatever else is wrong is said with it, at once — not after the section is filled in.
    const two = analyseContinuous(sunk(0.6, { spans: [span(1, L), span(2, 0)], section: section({ E: 0, I: 1000 }) }));
    expect(faults(two.issues)).toEqual([['settlement', { list: 'settlements', joint: 1 }], ['length', { list: 'spans', id: 2, field: 'L' }]]);
    expect(two.results).toBeNull();
    // A settlement kept for an end that is free now is no support's: the beam is solved without E or I.
    const free = analyseContinuous(sunk(0, { spans: [span(1, L, 1, 1), span(2, L, 1, 1)], right: 'free', settlements: [0, 0, 0.6], section: section({ E: 0, I: 0 }) }));
    expect(free.issues).toEqual([]);
    expect(free.results!.supports.map((s) => s.joint)).toEqual([0, 1]);
  });

  // Two spans L1 and L2 of stiffness k1·EI and k2·EI under w: Clapeyron with
  // each span's length over its stiffness,
  //     2·MB·(L1/k1 + L2/k2) = −w/4·(L1³/k1 + L2³/k2).
  it('a stiffness factor: the moment over the support by the three-moment equation, and no stress', () => {
    const [La, Lb, ka, kb, w] = [20, 30, 1, 2.5, 1.2];
    const form = beam({ spans: [span(1, La, ka, w), span(2, Lb, kb, w)], settlements: [0, 0, 0], everyArrangement: false, nextId: 3 });
    const a = analyseContinuous(form);
    const r = a.results!;
    const MB = (-(w / 4) * (La ** 3 / ka + Lb ** 3 / kb)) / (2 * (La / ka + Lb / kb));
    near(r.supports[1].M.max.value, MB);
    near(r.supports[0].Rv.max.value, (w * La) / 2 + MB / La);
    near(r.supports[2].Rv.max.value, (w * Lb) / 2 + MB / Lb);
    // The second span is not the section entered: its S and its shear area are not known.
    expect(a.sameSection).toBe(false);
    expect([r.largest.sigma, r.largest.tau, r.at(10).sigma]).toEqual([null, null, null]);
    // Its deflection is its own: 2.5 times stiffer. At its middle, 5wL⁴/384 and the end moment's MB·L²/16, over 2.5·EI.
    const EIref = (29000 * 843) / 144;
    near(r.at(La + Lb / 2).deflection!.max, (-((5 * w * Lb ** 4) / 384 + (MB * Lb ** 2) / 16) / (kb * EIref)) * 12, 1e-9);
    // With every factor 1 the stresses are back.
    const plain = analyseContinuous({ ...form, spans: [span(1, La, 1, w), span(2, Lb, 1, w)] });
    expect(plain.sameSection).toBe(true);
    expect(plain.results!.largest.sigma).toBeGreaterThan(0);
  });

  it('a fixed end holds a moment: one fixed-fixed span is wL²/12 at each wall and wL²/24 at its middle', () => {
    const [w, span1] = [2, 24];
    const r = solved(beam({ spans: [span(1, span1, 1, w)], left: 'fixed', right: 'fixed', settlements: [0, 0], everyArrangement: false, nextId: 2 }));
    expect(r.supports.map((s) => s.kind)).toEqual(['fixed', 'fixed']);
    for (const s of r.supports) {
      near(s.M.max.value, (-w * span1 ** 2) / 12);
      near(s.Rv.max.value, (w * span1) / 2);
    }
    near(r.spans[0].sagging.value, (w * span1 ** 2) / 24);
    near(r.spans[0].sagging.x!, 12);
    // wL⁴/384EI at the middle.
    near(r.spans[0].deflection!.value, ((-w * span1 ** 4) / 384 / ((29000 * 843) / 144)) * 12);
    // The drawing's reactions carry each wall's moment, turning as it does on the beam.
    near(r.reactions![0].Rm, (w * span1 ** 2) / 12);
    near(r.reactions![1].Rm, (-w * span1 ** 2) / 12);
    // At the right wall the moment is on the left, and nothing is past the beam.
    near(r.at(span1).M.left.max, (-w * span1 ** 2) / 12);
    expect(r.at(span1).M.right).toEqual({ max: 0, min: 0 });
  });

  // The stress at a point is of the side that HAS the moment. At a wall on the right, "just right" is past the beam: nothing. One span built in
  // at both ends, 2 kip/ft on 24 ft: wL²/12 = 96 kip·ft at each wall, 96 × 12 ÷ 81.6 = 14.12 ksi — at x = 0 and at x = L alike.
  it('at a fixed end the stress is the wall moment’s, at the right end as at the left', () => {
    const r = solved(beam({ spans: [span(1, 24, 1, 2, 0)], left: 'fixed', right: 'fixed', settlements: zeros(2), everyArrangement: false }));
    for (const x of [0, 24]) {
      near(r.at(x).sigma!.max, (96 * 12) / 81.6);
      near(r.at(x).sigma!.min, (96 * 12) / 81.6);
    }
    expect([r.at(0).M.left, r.at(24).M.right]).toEqual([{ max: 0, min: 0 }, { max: 0, min: 0 }]);
    near(r.at(24).M.left.max, -96);
  });

  // Three spans of 30, 6 and 30 ft under w on the outer two. By symmetry MB = MC, and Clapeyron at B is
  // 2·MB(30 + 6) + 6·MB = −w·30³/4: MB = −27,000w/312. The short span between them carries no load, so its
  // moment is that all along: it hogs from end to end, and has no sagging moment at all.
  it('a span that hogs all along has no sagging moment: “none”, not a negative one', () => {
    const w = 1.3;
    const r = solved(beam({ spans: [span(1, 30, 1, w), span(2, 6, 1, 0), span(3, 30, 1, w)], everyArrangement: false }));
    const MB = (-27000 * w) / 312;
    near(r.supports[1].M.max.value, MB);
    near(r.supports[2].M.max.value, MB);
    near(r.at(33).M.right.max, MB);
    expect([r.spans[1].sagging.value, r.spans[1].sagging.x, r.spans[1].sagging.on]).toEqual([0, null, null]);
    // Its neighbours sag: (w·15 + MB/30)² ÷ 2w.
    near(r.spans[0].sagging.value, (w * 15 + MB / 30) ** 2 / (2 * w));
    // It is lifted by them: MB·L²/8EI upward at its middle, with no load of its own.
    near(r.spans[1].deflection!.value, ((-MB * 6 ** 2) / 8 / ((29000 * 843) / 144)) * 12);
    near(r.spans[1].deflection!.x!, 33);
    // Over every arrangement it is the same: with the live load anywhere, that span still hogs.
    const every = solved(beam({ spans: [span(1, 30, 1, 0.5, 0.8), span(2, 6, 1, 0, 0), span(3, 30, 1, 0.5, 0.8)] }));
    expect([every.ranged, every.spans[1].sagging.value, every.spans[1].sagging.x, every.spans[1].sagging.on]).toEqual([true, 0, null, []]);
  });

  it('an overhang: its support’s moment is wa²/2, and its deflection is taken against twice its length', () => {
    const [w, Ls, a] = [1.5, 20, 6];
    const r = solved(beam({ spans: [span(1, Ls, 1, w), span(2, a, 1, w)], right: 'free', settlements: [0, 0, 0], everyArrangement: false, nextId: 3 }));
    expect(r.supports.map((s) => [s.number, s.joint])).toEqual([[1, 0], [2, 1]]);
    near(r.supports[1].M.max.value, (-w * a ** 2) / 2);
    near(r.supports[1].Rv.max.value, (w * (Ls + a) ** 2) / (2 * Ls));
    expect(r.spans.map((s) => s.kind)).toEqual(['span', 'cantilever']);
    // The tip of an overhang under w along the whole beam: wa(4a²L − L³ + 3a³)/24EI, downward when positive.
    const tip = ((w * a * (4 * a ** 2 * Ls - Ls ** 3 + 3 * a ** 3)) / 24 / ((29000 * 843) / 144)) * 12;
    near(r.spans[1].deflection!.value, -tip);
    near(r.spans[1].ratio!, (2 * a * 12) / Math.abs(tip));
    expect(r.spans[1].deflection!.x).toBe(Ls + a);
  });
});

describe('continuous beam, analysed: what counts as zero', () => {
  it('a beam with no load and no settlement: everything is zero, at no place, and nothing is labelled', () => {
    const r = solved(beam({ spans: defaultContinuous().spans.map((s) => ({ ...s, dead: 0, live: 0 })) }));
    expect(r.loadScale).toBe(0);
    expect(r.supports.every((s) => s.Rv.max.value === 0 && s.M.max.value === 0)).toBe(true);
    expect([r.largest.shear, r.largest.moment, r.largest.deflection!].map((v) => [v.value, v.x])).toEqual([[0, null], [0, null], [0, null]]);
    expect(r.spans.map((s) => [s.sagging.x, s.deflection!.x, s.ratio])).toEqual([[null, null, null], [null, null, null], [null, null, null]]);
    expect([r.diagrams.V.marks, r.diagrams.M.marks, r.diagrams.D!.marks]).toEqual([[], [], []]);
    expect(r.balance).toEqual({ reactions: 0, load: 0, ok: true });
  });

  it('a span whose loads cancel at a support carries nothing there: the roller of a balanced beam reads zero, not 1e-15', () => {
    // Two equal spans, the same load up on one and down on the other: by antisymmetry the middle support carries nothing.
    const r = solved(beam({ spans: [span(1, 20, 1, 1.3), span(2, 20, 1, -1.3)], settlements: [0, 0, 0], everyArrangement: false, nextId: 3 }));
    expect(r.supports[1].Rv.max.value).toBe(0);
    near(r.supports[0].Rv.max.value, -r.supports[2].Rv.max.value);
    expect(Math.abs(r.supports[0].Rv.max.value)).toBeGreaterThan(5);
    expect(r.balance).toEqual({ reactions: expect.any(Number), load: 0, ok: true });
  });

  it('beside the two large reactions of a short span, a small one far along the beam is still a result', () => {
    // Eight spans, a load on the first, and a second span of 3 in between two of 30 ft: its two supports clamp the
    // beam, with forces fifteen times the load. What reaches the far end is a few millionths of the load — real, and
    // far above rounding. The first calculator's floor for a reaction, a millionth of the LARGEST one, would print the
    // last two as 0; this page's is a billionth of the loads, and prints them.
    const form = beam({ spans: [30, 0.25, 30, 30, 30, 30, 30, 30].map((L, i) => span(i + 1, L, 1, i === 0 ? 1 : 0)), settlements: zeros(9), everyArrangement: false, nextId: 9 });
    const r = solved(form);
    const R = r.supports.map((s) => s.Rv.max.value);
    const largest = Math.max(...R.map(Math.abs));
    expect(r.loadScale).toBe(30);
    expect(largest).toBeGreaterThan(15 * r.loadScale);
    expect(R.slice(-2).map((v) => Math.abs(v) < 1e-6 * largest && Math.abs(v) > 100 * r.floors.F)).toEqual([true, true]);
    // Statics holds them: the last span carries nothing, so its end reaction is the moment over its other support, over its length…
    near(R[8], r.supports[7].M.max.value / 30, 1e-6, Math.abs(R[8]));
    // …and along unloaded equal spans the moment over each support is −(2 − √3) times the one before it.
    near(r.supports[7].M.max.value / r.supports[6].M.max.value, -1 / 4, 1e-6);
    near(r.supports[5].M.max.value / r.supports[4].M.max.value, -(2 - Math.sqrt(3)), 1e-3);
    expect(r.balance!.ok).toBe(true);
  });
});

describe('continuous beam, analysed: the faults, by row', () => {
  const just = (over: Partial<ContinuousForm>) => analyseContinuous(beam(over));
  const three = (change: (spans: SpanRow[]) => void) => {
    const spans = defaultContinuous().spans;
    change(spans);
    return just({ spans });
  };

  it('a length that is not a positive number, on its span’s length', () => {
    for (const L of [0, -4, Number.NaN, Infinity]) {
      const a = three((s) => (s[1].L = L));
      // Its uniform loads run to the end of it, and are as they were entered: only the length is named.
      expect(faults(a.issues), String(L)).toEqual([['length', { list: 'spans', id: 2, field: 'L' }]]);
      expect(a.results).toBeNull();
    }
    // A load that is itself not a number is named with it.
    expect(faults(three((s) => Object.assign(s[1], { L: Number.NaN, live: Number.NaN })).issues)).toEqual([['length', { list: 'spans', id: 2, field: 'L' }], ['number', { list: 'spans', id: 2, field: 'live' }]]);
  });

  it('a number that is one, of a size nothing can be worked out with: said as that, not as “not a number”', () => {
    expect(faults(three((s) => (s[0].L = 1e61)).issues)).toEqual([['size', { list: 'spans', id: 1, field: 'L' }]]);
    expect(faults(three((s) => (s[0].L = 1e-61)).issues)).toEqual([['size', { list: 'spans', id: 1, field: 'L' }]]);
    expect(faults(three((s) => (s[2].live = 1e61)).issues)).toEqual([['size', { list: 'spans', id: 3, field: 'live' }]]);
    expect(faults(just({ points: [point(9, 1, 5, 1e61)] }).issues)).toEqual([['size', { list: 'points', id: 9 }]]);
    expect(faults(just({ settlements: [0, 1e70, 0, 0] }).issues)).toEqual([['size', { list: 'settlements', joint: 1 }]]);
    // …and one that is not a number, as that.
    expect(faults(three((s) => (s[2].dead = Number.NaN)).issues)).toEqual([['number', { list: 'spans', id: 3, field: 'dead' }]]);
    // Too small as well as too large, and on the field it was typed in. (A live load of 1e-316 on the middle span,
    // taken in every arrangement, was answered on the FIRST span's length: "shorter than one thousandth of all the spans".)
    for (const every of [true, false]) {
      const a = analyseContinuous({ ...defaultContinuous(), everyArrangement: every, spans: defaultContinuous().spans.map((s, i) => (i === 1 ? { ...s, live: 1e-316 } : s)) });
      expect(faults(a.issues), String(every)).toEqual([['size', { list: 'spans', id: 2, field: 'live' }]]);
      expect(a.results).toBeNull();
    }
    expect(faults(three((s) => (s[0].dead = 1e-61)).issues)).toEqual([['size', { list: 'spans', id: 1, field: 'dead' }]]);
    expect(faults(just({ points: [point(9, 1, 5, 1e-316, 'down', true)] }).issues)).toEqual([['size', { list: 'points', id: 9 }]]);
    expect(faults(just({ dists: [dist(9, 0, 2, 8, 1e-316, 0)] }).issues)).toEqual([['size', { list: 'dists', id: 9 }]]);
    expect(faults(just({ settlements: [0, 1e-316, 0, 0] }).issues)).toEqual([['size', { list: 'settlements', joint: 1 }]]);
    // At 1e-60 a load is taken; and an empty field, which is zero, is no load.
    expect(three((s) => (s[1].live = 1e-60)).issues).toEqual([]);
    expect(three((s) => (s[1].live = 0)).issues).toEqual([]);
    expect(faults(just({ points: [point(9, 1, 5, Infinity)] }).issues)).toEqual([['number', { list: 'points', id: 9 }]]);
    expect(faults(just({ dists: [dist(9, 0, 2, Number.NaN, 1, 1)] }).issues)).toEqual([['number', { list: 'dists', id: 9 }]]);
    expect(faults(just({ settlements: [0, 0, Number.NaN, 0] }).issues)).toEqual([['number', { list: 'settlements', joint: 2 }]]);
  });

  it('a stiffness factor that is not a positive number, or out of the engine’s range, on its span’s factor', () => {
    for (const k of [0, -1, Number.NaN, 1 / STIFF / 1.01, STIFF * 1.01]) expect(faults(three((s) => (s[2].k = k)).issues), String(k)).toEqual([['stiffness', { list: 'spans', id: 3, field: 'k' }]]);
    // At the two ends of the range it is taken: the page's line gives them as 0.001 and 1,000.
    expect([STIFF, three((s) => (s[2].k = STIFF)).issues, three((s) => (s[2].k = 1 / STIFF)).issues]).toEqual([1000, [], []]);
  });

  it('a load off its span, on its row', () => {
    expect(faults(just({ points: [point(9, 0, 24.5, 5)] }).issues)).toEqual([['outside', { list: 'points', id: 9 }]]);
    expect(faults(just({ dists: [dist(8, 1, 10, 31, 1, 1), dist(9, 2, -1, 5, 1, 1)] }).issues)).toEqual([['outside', { list: 'dists', id: 8 }], ['outside', { list: 'dists', id: 9 }]]);
    // On the end of its span it is on it.
    expect(just({ points: [point(9, 0, 24, 5)], dists: [dist(8, 1, 0, 30, 1, 1)] }).issues).toEqual([]);
  });

  it('a span too short beside the others, on its length: a thousandth of the beam is the limit the page states', () => {
    expect(SHORT).toBe(1e-3);
    const a = three((s) => (s[1].L = 0.04));
    expect(faults(a.issues)).toEqual([['short-span', { list: 'spans', id: 2, field: 'L' }]]);
    expect(a.results).toBeNull();
    expect(three((s) => (s[1].L = 0.06)).issues).toEqual([]);
  });

  it('ends that do not hold the beam: no row is named', () => {
    const one = [span(1, 20, 1, 1)];
    for (const [left, right] of [['pin', 'free'], ['free', 'pin'], ['free', 'free']] as const) expect(faults(just({ spans: one, left, right, settlements: [0, 0] }).issues), `${left} ${right}`).toEqual([['unstable']]);
    // Two spans, both ends free: one support.
    expect(faults(just({ spans: [span(1, 20), span(2, 20)], left: 'free', right: 'free', settlements: [0, 0, 0] }).issues)).toEqual([['unstable']]);
    // A wall holds a beam by itself; so do two supports.
    expect(just({ spans: one, left: 'fixed', right: 'free', settlements: [0, 0] }).issues).toEqual([]);
    expect(just({ spans: [span(1, 20, 1, 1), span(2, 8, 1, 1)], left: 'pin', right: 'free', settlements: [0, 0, 0] }).issues).toEqual([]);
  });

  it('a section value that is not one does not stop the beam: it is named, and the results stand without it', () => {
    const a = just({ section: section({ I: -5 }) });
    expect(faults(a.issues)).toEqual([['section']]);
    expect(a.results).not.toBeNull();
    expect([a.EI, a.results!.diagrams.D]).toEqual([0, null]);
    // The first calculator's rule, which this form shares: its own example with the same section says the same.
    expect(sectionProps({ ...convertUnits(defaultBeam(), 'us'), section: section({ I: -5 }) }).I).toBe(0);
    expect(stiffness('us', a.section)).toBe(0);
  });

  it('several things wrong at once are all said', () => {
    const a = just({ spans: [span(1, 0, 1, 1), span(2, 30, 0, 1), span(3, 24, 1, Number.NaN)], points: [point(9, 1, 40, 5)] });
    expect(faults(a.issues)).toEqual([
      ['length', { list: 'spans', id: 1, field: 'L' }],
      ['stiffness', { list: 'spans', id: 2, field: 'k' }],
      ['outside', { list: 'points', id: 9 }],
      ['number', { list: 'spans', id: 3, field: 'dead' }],
    ]);
  });
});

describe('continuous beam, analysed: the beam as it is drawn', () => {
  const ids = (f: ContinuousForm) => drawingOf(f).beam.dists.map((d) => [d.id, d.x1, d.x2, d.w1, d.w2]);

  it('the example: one block over the three spans, as tall as dead and live together, and both numbers kept', () => {
    const d = drawingOf(defaultContinuous());
    expect(ids(defaultContinuous())).toEqual([[-1, 0, 78, 0.9 + 1.2, 0.9 + 1.2]]);
    expect(d.uniform).toEqual([{ id: -1, dead: 0.9, live: 1.2 }]);
    expect(d.live).toEqual({ points: [], dists: [] });
    // The supports, the length and the section are the form's own beam.
    expect(d.beam.supports.map((s) => [s.kind, s.x])).toEqual([['pin', 0], ['roller', 24], ['roller', 54], ['roller', 78]]);
    expect(d.beam.L).toBe(78);
  });

  it('spans that carry other loads are other blocks; a span with none has no block', () => {
    const form = beam({ spans: [span(1, 10, 1, 0.5, 1), span(2, 10, 1, 0.5, 1), span(3, 10, 1, 0, 0), span(4, 10, 1, 0.5, 0), span(5, 10, 1, 0.5, 1)], settlements: zeros(6), nextId: 6 });
    expect(ids(form)).toEqual([[-1, 0, 20, 1.5, 1.5], [-7, 30, 40, 0.5, 0.5], [-9, 40, 50, 1.5, 1.5]]);
    expect(drawingOf(form).uniform).toEqual([{ id: -1, dead: 0.5, live: 1 }, { id: -7, dead: 0.5, live: 0 }, { id: -9, dead: 0.5, live: 1 }]);
  });

  it('two loads that point opposite ways are drawn apart, each with its own number, and the live one is marked', () => {
    const form = beam({ spans: [span(1, 10, 1, -0.5, 1), span(2, 10, 1, 0.5, 1)], settlements: zeros(3), points: [point(3, 0, 5, 4, 'down', true), point(4, 1, 5, 4)], dists: [dist(5, 1, 2, 6, 1, 2, 'up', true), dist(6, 0, 2, 6, 1, 2)], nextId: 7 });
    const d = drawingOf(form);
    expect(ids(form)).toEqual([[-1, 0, 10, -0.5, -0.5], [-2, 0, 10, 1, 1], [-3, 10, 20, 1.5, 1.5], [5, 12, 16, 1, 2], [6, 2, 6, 1, 2]]);
    expect(d.uniform).toEqual([{ id: -3, dead: 0.5, live: 1 }]);
    expect(d.live).toEqual({ points: [3], dists: [5, -2] });
    expect(d.beam.points.map((p) => [p.id, p.x])).toEqual([[3, 5], [4, 15]]);
  });
});

describe('continuous beam analysis: the door that never throws', () => {
  // Nothing is known to make the arithmetic throw. This holds what the page
  // would do if something did: one beam with no results and one line, not a
  // page taken away with whatever was typed into it.
  const broken = (): ContinuousForm => {
    const form = defaultContinuous();
    // A form whose loads cannot be read: the engine's input is built from them.
    Object.defineProperty(form, 'points', {
      get() {
        throw new Error('made to throw');
      },
    });
    return form;
  };

  it('an exception in the arithmetic is a beam with no results and the one issue "stopped", on no row', () => {
    expect(() => analyseContinuous(broken())).toThrow('made to throw');
    const a = analyseSafely(broken());
    expect(a.results).toBeNull();
    expect(a.issues).toEqual([{ code: 'stopped' }]);
    // What the form goes on showing: the section as it was entered.
    expect(a.section).toEqual(analyseContinuous(defaultContinuous()).section);
    expect([a.EI, a.toDeflection, a.toSlope]).toEqual([0, 0, 0]);
  });

  it('a fault in the values at a point is caught with the rest: they are read once before the analysis is handed over', () => {
    const source = readFileSync(join(resolve(__dirname), 'analysis.ts'), 'utf8');
    expect(source).toMatch(/const analysis = analyseContinuous\(form, shape\);\s*analysis\.results\?\.at\(analysis\.results\.L \/ 2\);\s*return analysis;/);
  });

  it('for every beam that does not throw it is analyseContinuous, to the last number', () => {
    const flat = (r: ContinuousResults | null) => (r ? JSON.stringify({ ...r, at: r.at(r.L / 3) }) : null);
    for (const form of [defaultContinuous(), { ...defaultContinuous(), everyArrangement: false }, convertContinuous(defaultContinuous(), 'si'), { ...defaultContinuous(), left: 'free' as const, right: 'free' as const }]) {
      const [safe, plain] = [analyseSafely(form), analyseContinuous(form)];
      expect(flat(safe.results)).toBe(flat(plain.results));
      expect(safe.issues).toEqual(plain.issues);
      expect(safe.liveSpans).toEqual(plain.liveSpans);
    }
  });
});
