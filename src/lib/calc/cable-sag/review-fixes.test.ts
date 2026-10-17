import { afterEach, describe, expect, it, vi } from 'vitest';
import { parabolaSetup, shapeAt, solveHanging, solvePoints, solveState } from './engine';
import { CABLE_MATERIALS, convertCableSag, defaultCaseFor, reduceCableSag, tidy7, toEngine, type CableSagForm } from './model';
import { rng } from './oracle.testlib';
import { refForward, refSolve } from './reference.testlib';
import { MAX_POINT_LOADS, MAX_TABLE_ROWS } from './types';

// The reference is an adaptive RK4 shooting solver: slow by design.
vi.setConfig({ testTimeout: 120_000 });
afterEach(() => new Promise<void>((resolve) => setTimeout(resolve, 0)));

/**
 * What the adversarial review of the calculator found, as behaviour: each test fails on the code before the fix.
 * The numbers come from the independent solver (reference.testlib.ts) or from a closed form, never from the engine.
 */

const near = (got: number, want: number, tol: number) => expect(Math.abs(got - want), `got ${got}, want ${want}`).toBeLessThanOrEqual(tol * Math.max(Math.abs(want), 1e-300));

describe('A1: on an inclined span the parabola column spreads the weight over the CHORD', () => {
  const L = 100;
  const w = 1;
  const d = 1; // a sag of 1 % of the span
  for (const h of [0, 20, 50, 100, 300]) {
    it(`h = ${h}: q' = w·√(1 + (h/L)²), H = q'L²/8d, and the exact H (independent solver) is within 0.02 %`, () => {
      const out = solveHanging({ L, h, q: 0, w, EA: null, known: { kind: 'sag-mid', value: d } });
      expect(out.ok).toBe(true);
      if (!out.ok) return;
      const qPrime = w * Math.hypot(1, h / L);
      const hand = (qPrime * L * L) / (8 * d);
      near(out.parabolic!.H, hand, 1e-9);
      // the independent solver: the exact cable for the same sag
      const ref = refSolve({ L, h, q: 0, w, EA: null }, (r) => r.sagMid, d, true, 1, 1e5, 1e-11)!;
      near(out.exact.H, ref.H, 1e-7);
      expect(Math.abs(hand / ref.H - 1), `hand ${hand} against exact ${ref.H}`).toBeLessThan(2e-4);
      // so the page does not claim a difference that a hand calculation does not have
      expect(out.warnings.map((x) => x.code)).not.toContain('parabola-differs');
      expect(out.difference!.worst).toBeLessThan(2e-4);
    });
  }

  it('the old column (the weight over the horizontal) would be off by the chord factor: 29 % at a rise equal to the span', () => {
    const set = { L: 100, h: 100, q: 0, w: 1, EA: null };
    expect(parabolaSetup(set).q).toBeCloseTo(Math.SQRT2, 14);
    expect(parabolaSetup({ ...set, q: 0.5 }).q).toBeCloseTo(0.5 + Math.SQRT2, 14);
    expect(parabolaSetup({ ...set, h: 0 }).q).toBe(1);
    expect(parabolaSetup(set).w).toBe(0);
  });

  it('a change of state on an inclined span: the parabola of both states uses the chord too (both states within 0.1 % of the exact)', () => {
    const out = solveState({
      L: 100,
      h: 60,
      EA: null,
      known: { kind: 'sag-mid', value: 1.5 },
      state1: { q: 0, w: 1 },
      state2: { q: 0, w: 1.4, thermal: 0 },
    });
    expect(out.ok).toBe(true);
    if (!out.ok) return;
    near(out.parabolic!.state1.H, out.exact.state1.H, 1e-3);
    near(out.parabolic!.state2.H, out.exact.state2.H, 1e-3);
    near(out.parabolic!.state1.H, (Math.hypot(1, 0.6) * 100 * 100) / (8 * 1.5), 1e-9);
    expect(out.warnings.map((x) => x.code)).not.toContain('parabola-differs');
  });
});

describe('A2: the parabola warning says WHY it differs', () => {
  it('a deep rigid cable: the sag (depth)', () => {
    const out = solveHanging({ L: 100, h: 0, q: 0, w: 1, EA: null, known: { kind: 'sag-mid', value: 20 } });
    expect(out.ok && out.warnings.find((x) => x.code === 'parabola-differs')?.cause).toBe('depth');
  });

  it('a shallow cable that stretches by 2 %: the elasticity, not the depth (a rigid one agrees to 0.1 %)', () => {
    const L = 100;
    const d = 2;
    // T/EA of 2 %: the largest tension of the 0.02-deep catenary is about wL²/8d + wd = 626.5 -> EA = 626.5/0.02
    const EA = 626.5 / 0.02;
    const out = solveHanging({ L, h: 0, q: 0, w: 1, EA, known: { kind: 'sag-mid', value: d } });
    expect(out.ok).toBe(true);
    if (!out.ok) return;
    const warning = out.warnings.find((x) => x.code === 'parabola-differs');
    expect(warning?.cause).toBe('elasticity');
    // the independent solver agrees that the weight per horizontal length is reduced by 1/(1 + T/EA): the exact H is the lower one
    const rigid = solveHanging({ L, h: 0, q: 0, w: 1, EA: null, known: { kind: 'sag-mid', value: d } });
    expect(rigid.ok && rigid.difference!.worst).toBeLessThan(2e-3);
    const ref = refSolve({ L, h: 0, q: 0, w: 1, EA }, (r) => r.sagMid, d, true, 10, 1e5, 1e-11)!;
    near(out.exact.H, ref.H, 1e-7);
    expect(out.exact.H).toBeLessThan(rigid.ok ? rigid.exact.H : 0);
    expect(out.warnings.map((x) => x.code)).toContain('strain-high');
  });
});

describe('A3: a tension just above the least is a real cable, and is found', () => {
  it('q only, level, T-high = 50.001: H = √(T² − (qL/2)²) = 0.3162, 39.5 spans deep (the window began at 1e-2 of the load scale)', () => {
    const out = solveHanging({ L: 100, h: 0, q: 1, w: 0, EA: null, known: { kind: 'T-high', value: 50.001 } });
    expect(out.ok).toBe(true);
    if (!out.ok) return;
    near(out.exact.H, Math.sqrt(50.001 ** 2 - 2500), 1e-6);
    near(out.exact.tension.high, 50.001, 1e-9);
  });

  it('the slack cable of a tension is reported when it is far down the window: h = L, q only, T-low = 49.99 has H = 49.99 and H = 0.01', () => {
    const out = solveHanging({ L: 100, h: 100, q: 1, w: 0, EA: null, known: { kind: 'T-low', value: 49.99 } });
    expect(out.ok).toBe(true);
    if (!out.ok) return;
    expect(out.warnings.map((x) => x.code)).toContain('tension-two-roots');
    near(out.alternative!.H, 0.01, 2e-3);
    // each of the two is a cable with that tension (checked by shapeAt, not by the search)
    near(shapeAt({ L: 100, h: 100, q: 1, w: 0, EA: null }, out.alternative!.H)!.tension.low, 49.99, 1e-6);
    near(shapeAt({ L: 100, h: 100, q: 1, w: 0, EA: null }, out.exact.H)!.tension.low, 49.99, 1e-9);
  });

  it('a tension below what any cable can have is still refused, with the least', () => {
    const out = solveHanging({ L: 100, h: 0, q: 1, w: 0, EA: null, known: { kind: 'T-high', value: 49.9 } });
    expect(out.ok).toBe(false);
    expect(!out.ok && out.issues[0].code).toBe('tension-below-minimum');
    expect(!out.ok && out.issues[0].min).toBeGreaterThanOrEqual(50);
    expect(!out.ok && out.issues[0].min).toBeLessThan(50.0001);
  });
});

describe('A4: a funicular cable with the largest tension given has two answers, and says so', () => {
  const input = { L: 60, h: -30, loads: [{ x: 50, P: 10 }] };

  it('L = 60, h = −30, 10 kip at x = 50, T-max = 8: H = 5.933 (taut) and H = 0.7336 (slack): 1.25H² − 8.333H + 69.44 = 64', () => {
    const out = solvePoints({ ...input, known: { kind: 'T-max', value: 8 } });
    expect(out.ok).toBe(true);
    if (!out.ok) return;
    const disc = Math.sqrt(8.3333333333 ** 2 - 4 * 1.25 * (69.4444444444 - 64));
    near(out.H, (8.3333333333 + disc) / 2.5, 1e-6);
    expect(out.alternative).not.toBeNull();
    near(out.alternative!.H, (8.3333333333 - disc) / 2.5, 1e-6);
    expect(out.warnings.find((x) => x.code === 'tension-two-roots')?.value).toBe(out.alternative!.H);
    // both are cables with a largest tension of 8
    const slack = solvePoints({ ...input, known: { kind: 'H', value: out.alternative!.H } });
    expect(slack.ok && slack.tensionMax.value).toBeCloseTo(8, 9);
    expect(solvePoints({ ...input, known: { kind: 'H', value: out.H } }).ok).toBe(true);
  });

  it('a case with one answer has none to report (the default points case, T-max = 42.5)', () => {
    const out = solvePoints({ L: 60, h: 0, loads: [{ x: 15, P: 10 }, { x: 30, P: 20 }, { x: 45, P: 10 }], known: { kind: 'T-max', value: 42.5 } });
    expect(out.ok && out.alternative).toBeNull();
    expect(out.ok && out.warnings.map((x) => x.code)).not.toContain('tension-two-roots');
  });
});

describe('A12: a cable that does not close on its own boundary conditions is never returned', () => {
  it('h = −100·L, w only, EA = 50, sag-low 0.1: the cable has the run and the rise of its span, and the slope at B of the independent solver', () => {
    const set = { L: 100, h: -10000, q: 0, w: 1, EA: 50 };
    const out = solveHanging({ ...set, known: { kind: 'sag-low', value: 0.1 } });
    expect(out.ok).toBe(true);
    if (!out.ok) return;
    near(out.exact.sagLow, 0.1, 1e-6);
    const ref = refForward(set, out.exact.H)!;
    expect(Math.abs(out.exact.slope.B - ref.pB)).toBeLessThan(1e-6);
    near(out.exact.length, ref.S, 1e-6);
  });
});

describe('B1: the reducer hands back the very form that is loaded (the page tells a case opened whole by identity)', () => {
  it('load of a decoded or example form returns that object; a form with a notice comes back without it', () => {
    const a = defaultCaseFor('hanging');
    const b = defaultCaseFor('state', 'si');
    expect(reduceCableSag(a, { type: 'load', form: b })).toBe(b);
    const noisy: CableSagForm = { ...b, notice: { code: 'limit', list: 'points', max: 12 } };
    const loaded = reduceCableSag(a, { type: 'load', form: noisy });
    expect(loaded.notice).toBeNull();
    expect(loaded).toEqual(b);
  });
});

describe('B2: "Add a load" always picks a free position', () => {
  const run = (units: 'us' | 'si') => {
    let f = defaultCaseFor('points', units);
    for (let i = f.points.length; i < MAX_POINT_LOADS; i++) {
      f = reduceCableSag(f, { type: 'point-add' });
      const xs = f.points.map((p) => p.x);
      expect(new Set(xs).size, `after ${i + 1} loads: ${xs}`).toBe(xs.length);
      for (const x of xs) {
        expect(x).toBeGreaterThan(0);
        expect(x).toBeLessThan(f.span);
      }
      const out = solvePoints(toEngine(f).points);
      expect(out.ok, `${i + 1} loads: ${JSON.stringify(!out.ok && out.issues)}`).toBe(true);
    }
    return f;
  };
  it('US example (60 ft; loads at 15, 30, 45): twelve loads, every position different, every cable solvable', () => {
    expect(run('us').points).toHaveLength(12);
  });
  it('SI example: the same', () => {
    expect(run('si').points).toHaveLength(12);
  });
  it('the first one still goes a quarter of the span past the last', () => {
    const f = reduceCableSag(defaultCaseFor('points'), { type: 'point-add' });
    expect(f.points[3].x).toBe(59.4);
  });
  it('with loads in every other place, after a short span, and with none at all', () => {
    let f = { ...defaultCaseFor('points'), points: [], nextId: 1 } as CableSagForm;
    f = reduceCableSag(f, { type: 'point-add' });
    expect(f.points.map((p) => p.x)).toEqual([30]);
    f = reduceCableSag(f, { type: 'point-add' });
    expect(f.points[1].x).not.toBe(30);
  });
});

describe('B3 and B7: a units toggle keeps the temperature table and the values you typed', () => {
  const rows = (f: CableSagForm) => toEngine(f).temps.length;
  const withTable = (low: number, high: number, step: number): CableSagForm => reduceCableSag(defaultCaseFor('state'), { type: 'state', patch: { low, high, step } });

  it('the typical tables have the same rows in °F and in °C, and back (US −40…140 step 10: 19 rows, was 18 in SI)', () => {
    const cases: [number, number, number][] = [[-40, 140, 10], [0, 140, 5], [-40, 80, 10], [0, 100, 10], [-20, 120, 20], [10, 110, 10], [-100, 300, 10], [0, 180, 15], [32, 212, 20]];
    for (const [low, high, step] of cases) {
      const us = withTable(low, high, step);
      const si = convertCableSag(us, 'si');
      expect(rows(si), `${low}…${high} step ${step}`).toBe(rows(us));
      const back = convertCableSag(si, 'us');
      expect(rows(back)).toBe(rows(us));
      // the last row is the end of the table, not a rounding of it
      const t = toEngine(si).temps;
      expect(t[t.length - 1]).toBe(si.state.high);
    }
  });

  it('a hundred random tables of whole-degree ends and steps keep their rows through the toggle', () => {
    const r = rng(77);
    let tested = 0;
    for (let n = 0; n < 200 && tested < 100; n++) {
      const step = [5, 10, 15, 20, 25, 2, 4, 8][Math.floor(r() * 8)];
      const low = Math.round((r() * 40 - 20) / step) * step;
      const count = 1 + Math.floor(r() * 30);
      const high = low + count * step;
      const us = withTable(low, high, step);
      if (rows(us) > MAX_TABLE_ROWS) continue;
      tested++;
      expect(rows(convertCableSag(us, 'si')), `${low}…${high} step ${step}`).toBe(rows(us));
    }
    expect(tested).toBe(100);
  });

  it('values typed to up to five figures come back unchanged from the other units, both ways', () => {
    const r = rng(5);
    for (let n = 0; n < 3000; n++) {
      const figures = 1 + Math.floor(r() * 5);
      const v = Number((10 ** (r() * 5 - 1) * (0.5 + r())).toPrecision(figures));
      let f = reduceCableSag(defaultCaseFor('hanging'), { type: 'geometry', patch: { span: v } });
      f = reduceCableSag(f, { type: 'known', patch: { sag: v, H: v, length: v } });
      const back = convertCableSag(convertCableSag(f, 'si'), 'us');
      expect([back.span, back.sag, back.H, back.length], `${v} (${figures} figures)`).toEqual([v, v, v, v]);
      const there = convertCableSag(convertCableSag(convertCableSag(f, 'si'), 'us'), 'si');
      expect(there.span).toBe(convertCableSag(f, 'si').span);
    }
  });

  it('938.03 ft and 197.959 ft, the two values that drifted, come back', () => {
    for (const v of [938.03, 197.959]) {
      const f = reduceCableSag(defaultCaseFor('hanging'), { type: 'geometry', patch: { span: v } });
      expect(convertCableSag(convertCableSag(f, 'si'), 'us').span).toBe(v);
    }
  });

  it('tidy7 is the shortest of up to seven figures within 2.2e-7, else eight', () => {
    expect(tidy7(30.48)).toBe(30.48);
    expect(tidy7(30.480000001)).toBe(30.48);
    expect(tidy7(285.9012345)).toBe(285.9012);
    expect(tidy7(1.2345674)).toBe(1.2345674);
    expect(tidy7(0)).toBe(0);
  });
});

describe('the materials, as the verified research gives them', () => {
  it('a 1 in IWRC rope hangs 1.7605 lb/ft (published 1.76·d²), and the state-mode default solves to the independent solver\'s numbers', () => {
    const f = defaultCaseFor('state');
    const e = toEngine(f);
    near(e.state.state1.w * 1000, 1.7605327, 1e-7);
    const out = solveState(e.state);
    expect(out.ok).toBe(true);
    if (!out.ok) return;
    // the independent solver: state 1 from the sag, state 2 from the same unstressed length, cooled and iced
    const set1 = { L: 300, h: 0, q: 0, w: e.state.state1.w, EA: e.EA };
    const r1 = refSolve(set1, (r) => r.sagMid, 6, true, 0.1, 100, 1e-11)!;
    near(out.exact.state1.H, r1.H, 1e-8);
    const target = r1.S0 * (1 + e.state.state2.thermal);
    const r2 = refSolve({ ...set1, w: e.state.state2.w }, (r) => r.S0, target, true, 0.1, 100, 1e-11)!;
    near(out.exact.state2.H, r2.H, 1e-8);
    near(out.exact.state2.sagMid, r2.sagMid, 1e-8);
    near(out.exact.state1.H, 3.3009, 1e-4);
    near(out.exact.state2.H, 5.0857, 1e-4);
    near(out.exact.state2.sagMid, 6.1048, 1e-4);
  });

  it('the rope\'s E is about half of steel\'s, and no preset says 45 %', () => {
    near(CABLE_MATERIALS.rope.E.us / CABLE_MATERIALS.steel.E.us, 0.5, 0.01);
  });
});
