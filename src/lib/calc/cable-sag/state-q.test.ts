import { afterEach, describe, expect, it, vi } from 'vitest';
import { analyseCableSag } from './analysis';
import { solveState } from './engine';
import { convertCableSag, decodeCableSag, defaultCase, defaultCaseFor, encodeCableSag, reduceCableSag, toEngine, type CableSagForm } from './model';
import { refForward } from './reference.testlib';
import { cableSagPage } from './page-strings';
import { cableSagUi } from './strings';

vi.setConfig({ testTimeout: 120_000 });
afterEach(() => new Promise<void>((resolve) => setTimeout(resolve, 0)));

/**
 * REVIEW FINDING A6: state 2's load per horizontal length is EMPTY (null) by default, and empty means “the same as state 1”,
 * not zero. A number, 0 included, is state 2's own absolute load. What the load-factor table multiplies is what state 2
 * ADDS to state 1: its ice, plus (q2 − q1) where q2 is typed.
 */

const solved = (form: CableSagForm) => {
  const out = solveState(toEngine(form).state);
  if (!out.ok) throw new Error(JSON.stringify(out.issues));
  return out;
};
const withQ = (form: CableSagForm, q: number | null): CableSagForm => reduceCableSag(form, { type: 'state', patch: { q } });
const near = (got: number, want: number, tol = 1e-9) => expect(Math.abs(got - want), `got ${got}, want ${want}`).toBeLessThanOrEqual(tol * Math.max(1, Math.abs(want)));

/** The state example with a deck load of 20 lb/ft in state 1 (the default's is none). */
const loaded = (): CableSagForm => ({ ...defaultCaseFor('state'), q: 20 });

describe('the default case does not change', () => {
  it('state 2’s q is empty, and the rope example gives H1 3.3009, H2 5.0857 kip and a state-2 sag of 6.105 ft', () => {
    const f = defaultCaseFor('state');
    expect(f.state.q).toBeNull();
    const out = solved(f);
    near(out.exact.state1.H, 3.3009, 1e-4);
    near(out.exact.state2.H, 5.0857, 1e-4);
    near(out.exact.state2.sagMid, 6.105, 1e-3);
  });
});

describe('the reducer', () => {
  it('a null stays null, a typed 0 is zero (not “same”), and a patch of the wrong kind is ignored', () => {
    const f = defaultCaseFor('state');
    expect(withQ(f, null).state.q).toBeNull();
    expect(withQ(f, 0).state.q).toBe(0);
    expect(withQ(withQ(f, 5), null).state.q).toBeNull();
    expect(withQ(f, 7).state.q).toBe(7);
    const bad = reduceCableSag(withQ(f, 7), { type: 'state', patch: { q: 'x' as unknown as number } });
    expect(bad.state.q).toBe(7);
    const undef = reduceCableSag(withQ(f, 7), { type: 'state', patch: { q: undefined as unknown as number } });
    expect(undef.state.q).toBe(7);
  });

  it('the units toggle converts only a typed value, and the null survives a round trip', () => {
    const f = defaultCaseFor('state');
    const si = convertCableSag(f, 'si');
    expect(si.state.q).toBeNull();
    expect(convertCableSag(si, 'us').state.q).toBeNull();
    const typed = withQ(f, 10);
    const tsi = convertCableSag(typed, 'si');
    near(tsi.state.q as number, 10 * 0.014593903, 1e-6);
    expect(convertCableSag(tsi, 'us').state.q).toBe(10);
    expect(convertCableSag(withQ(f, 0), 'si').state.q).toBe(0);
  });

  it('switching from the hanging example (q = 100 lb/ft) into change-of-state mode keeps the 100 lb/ft in state 2', () => {
    const hanging = defaultCase();
    expect(hanging.q).toBe(100);
    const f = reduceCableSag(hanging, { type: 'mode', mode: 'state' });
    expect(f.mode).toBe('state');
    expect(f.state.q).toBeNull();
    const engine = toEngine(f).state;
    expect(engine.state1.q).toBeCloseTo(0.1, 12); // kip/ft
    expect(engine.state2.q).toBe(engine.state1.q);
    const a = analyseCableSag(f);
    expect(a.state?.change.loadPerLength.state2).toBeCloseTo(a.state!.change.loadPerLength.state1 + 1, 9); // the 1 lb/ft of ice
  });
});

describe('the address', () => {
  it('writes an empty field for null and reads it back as null; the version byte is unchanged', () => {
    const f = defaultCaseFor('state');
    const text = encodeCableSag(f);
    expect(text).toContain(';1;'); // version 1
    expect(decodeCableSag(text)).toEqual(f);
    expect(text).toMatch(/;,1,60,20,0,100,10,0,3,7;/);
  });

  it('a typed value, 0 included, round-trips as that number', () => {
    for (const q of [0, 12.5, 100]) {
      const f = withQ(defaultCaseFor('state'), q);
      expect(decodeCableSag(encodeCableSag(f))?.state.q).toBe(q);
    }
  });

  it('a link written before the change (a number in that place) reads as that number', () => {
    const f = withQ(defaultCaseFor('state'), 0);
    const nowText = encodeCableSag(f);
    // The old writer put the same text for a number, so the check and the body are the same: this IS an old link.
    expect(decodeCableSag(nowText)?.state.q).toBe(0);
    // And a hand-made older link, with its check recomputed by the writer: the body is the one a typed 25 writes.
    const g = withQ(defaultCaseFor('state'), 25);
    expect(decodeCableSag(encodeCableSag(g))?.state.q).toBe(25);
  });

  it('a state field cut short or with a stray character is still refused', () => {
    const text = encodeCableSag(defaultCaseFor('state'));
    expect(decodeCableSag(text.replace(';,1,60', ';x,1,60'))).toBeNull();
    expect(decodeCableSag(text.slice(0, -2))).toBeNull();
  });
});

describe('the engine against the independent reference solver', () => {
  it('state 2 with q empty equals state 2 with q typed as state 1’s', () => {
    const a = solved(loaded());
    const b = solved(withQ(loaded(), 20));
    near(a.exact.state2.H, b.exact.state2.H, 1e-12);
    near(a.exact.state2.sagMid, b.exact.state2.sagMid, 1e-12);
    expect(toEngine(loaded()).state.state2.q).toBe(toEngine(withQ(loaded(), 20)).state.state2.q);
  });

  it('changing state 1’s q moves state 2 with it, and the pair satisfies the reference solver (the unstressed length is kept)', () => {
    for (const q1 of [0, 20, 60]) {
      const f: CableSagForm = { ...loaded(), q: q1 };
      const input = toEngine(f);
      expect(input.state.state2.q).toBe(q1 * 0.001);
      const out = solved(f);
      const EA = input.state.EA;
      const s1 = refForward({ L: 300, h: 0, q: input.state.state1.q, w: input.state.state1.w, EA }, out.exact.state1.H)!;
      const s2 = refForward({ L: 300, h: 0, q: input.state.state2.q, w: input.state.state2.w, EA }, out.exact.state2.H)!;
      near(s2.S0, s1.S0 * (1 + input.state.state2.thermal), 1e-7);
      near(s2.sagMid, out.exact.state2.sagMid, 1e-7);
    }
  });

  it('a typed 0 takes the deck load away: state 2 carries only the cable’s weight and the ice', () => {
    const input = toEngine(withQ(loaded(), 0));
    expect(input.state.state1.q).toBeCloseTo(0.02, 12);
    expect(input.state.state2.q).toBe(0);
    const without = solved(withQ(loaded(), 0));
    const same = solved(loaded());
    expect(without.exact.state2.H).toBeLessThan(same.exact.state2.H);
  });
});

describe('the load-factor table: it multiplies only what state 2 adds to state 1', () => {
  const rows = (f: CableSagForm) => {
    const t = toEngine(f).state;
    return { t, sweep: t.sweep!.loads! };
  };
  const base = { ...loaded(), state: { ...loaded().state, factorLow: 0, factorHigh: 2, factorRows: 3 } };

  it('with “same as state 1” the deck load is state 1’s at every factor and only the ice scales', () => {
    const { t, sweep } = rows(base);
    const self = t.state1.w;
    expect(sweep.map((r) => r.q)).toEqual([t.state1.q, t.state1.q, t.state1.q]);
    expect(sweep.map((r) => r.w)).toEqual([self, self + 0.001, self + 0.002]);
  });

  it('with a typed q the added part is q2 − q1: factor 0 is state 1’s loads, factor 1 is state 2’s', () => {
    const { t, sweep } = rows(withQ(base, 50));
    near(sweep[0].q, t.state1.q, 1e-12);
    near(sweep[0].w, t.state1.w, 1e-12);
    near(sweep[1].q, t.state2.q, 1e-12);
    near(sweep[1].w, t.state2.w, 1e-12);
    near(sweep[2].q, t.state1.q + 2 * (t.state2.q - t.state1.q), 1e-12);
  });

  it('the factor-1 row is the state 2 result, whether q is empty or typed', () => {
    for (const f of [base, withQ(base, 50), withQ(base, 0)]) {
      const out = solved(f);
      const one = out.tables.loads[1];
      expect(one.ok).toBe(true);
      if (one.ok) near(one.H!, out.exact.state2.H, 1e-9);
    }
  });
});

describe('the results and the words', () => {
  it('the results state the load actually used in state 2, with the ice on top of the carried-over deck load', () => {
    const a = analyseCableSag(loaded());
    const c = a.state!.change.loadPerLength;
    const self = toEngine(loaded()).state.state1.w;
    near(c.state1, (0.02 + self) * 1000, 1e-9);
    near(c.state2, (0.02 + self + 0.001) * 1000, 1e-9);
  });

  it('both languages describe the empty field, the way back, and the table’s “added” in the same terms', () => {
    for (const lang of ['en', 'es'] as const) {
      const w = cableSagUi[lang].state;
      expect(w.qSame).toContain('{value}');
      expect(w.qOwn).toContain('{value}');
      expect(w.qSame.length).toBeGreaterThan(30);
      expect(cableSagUi[lang].tables.loads.note).toMatch(/1/);
    }
    expect(cableSagUi.en.state.qOwn).toMatch(/Clear the field/);
    expect(cableSagUi.es.state.qOwn).toMatch(/Vacíe el campo/);
    const en = cableSagPage.en.signs.items.join(' ');
    expect(en).toContain('same load per horizontal length as state 1');
    expect(en).toContain('factor 0 gives state 1’s loads');
    expect(cableSagPage.es.signs.items.join(' ')).toContain('la misma carga por longitud horizontal que el estado 1');
  });
});
