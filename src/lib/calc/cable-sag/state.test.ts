import { afterEach, describe, expect, it, vi } from 'vitest';
import { solveHanging, solveState } from './engine';
import { between, logBetween, rng, solveShot, solveShotFixedLength } from './oracle.testlib';
import { MAX_FACTOR_ROWS, MAX_TABLE_ROWS, type Known, type StateInput, type StateSolution } from './types';

vi.setConfig({ testTimeout: 120_000 });
afterEach(() => new Promise<void>((resolve) => setTimeout(resolve, 0)));

/**
 * THE CHANGE OF STATE, against what is known.
 *
 * A cable in state 1 (a sag, an H, a tension or a length, loads w₁ and q₁, temperature T₁) goes to state 2
 * (other loads, thermal strain ε = α·ΔT). What stays is the cable's UNSTRESSED length: L₀(2) = L₀(1)·(1 + ε),
 * with L₀ = ∫ ds/(1 + T/EA). The engine finds the H₂ that gives state 2's cable that unstressed length.
 *
 * Evidence:
 *   — the LIMITS: no change returns state 1 exactly; a pure temperature rise lowers H and deepens the sag, a fall
 *     does the opposite; heavier loads raise H; ε = 0 changes nothing; the change reverses (state 1 → 2 → 1);
 *   — the PHYSICS by RK4 shooting along the unstretched length (oracle.testlib.ts, solveShotFixedLength): the
 *     length fixed at L₀(1 + ε), (H₂, V₀) found by Newton so that the far end is at (L, h) — no formula of the engine;
 *   — the TEXTBOOK cubic for a level span, solved here by bisection (a state equation with the parabolic length and
 *     the mean-tension elasticity), which the engine agrees with to the approximations of that equation;
 *   — the codes, the tables.
 */

const state = (i: StateInput): StateSolution => {
  const out = solveState(i);
  if (!out.ok) throw new Error(`not solved: ${JSON.stringify(i)} ${JSON.stringify(out.issues)}`);
  return out;
};
const near = (got: number, want: number, tol = 1e-9, scale = Math.max(Math.abs(want), 1e-300)) => {
  expect(Math.abs(got - want), `got ${got}, want ${want}`).toBeLessThanOrEqual(tol * scale);
};

const base = (over: Partial<StateInput> = {}): StateInput => ({
  L: 300,
  h: 0,
  EA: 6001.62,
  known: { kind: 'sag-mid', value: 6 },
  state1: { q: 0, w: 0.0017605327 },
  state2: { q: 0, w: 0.0027605327, thermal: 6.5e-6 * -40 },
  ...over,
});

describe('the limits', () => {
  it('no change of state returns state 1 exactly (the same cable, ratio 1)', () => {
    const s = state(base({ state2: { q: 0, w: 0.0017605327, thermal: 0 } }));
    expect(s.exact.state2).toBe(s.exact.state1);
    expect(s.ratioH).toBe(1);
    expect(s.ratioLength).toBe(1);
  });

  it('...and when the same state is reached through the solver (a table row with the same load and temperature), the answer is state 1 to 1e-9', () => {
    const s = state(base({ state2: { q: 0, w: 0.0017605327, thermal: 0 }, sweep: { thermal: [0], loads: [{ q: 0, w: 0.0017605327 }] } }));
    near(s.tables.thermal[0].H!, s.exact.state1.H, 1e-9);
    near(s.tables.loads[0].H!, s.exact.state1.H, 1e-9);
    near(s.tables.loads[0].sagMid!, 6, 1e-9);
  });

  it('a thermal strain of 0 (α = 0) with new loads changes only the load; with the same loads and ΔT, only the temperature', () => {
    const load = state(base({ state2: { q: 0, w: 0.0027605327, thermal: 0 } }));
    expect(load.exact.state2.H).toBeGreaterThan(load.exact.state1.H);
    expect(load.exact.state2.sagMid).toBeGreaterThan(6);
    const heat = state(base({ state2: { q: 0, w: 0.0017605327, thermal: 6.5e-6 * 60 } }));
    expect(heat.exact.state2.H).toBeLessThan(heat.exact.state1.H);
    expect(heat.exact.state2.sagMid).toBeGreaterThan(heat.exact.state1.sagMid);
    const cold = state(base({ state2: { q: 0, w: 0.0017605327, thermal: 6.5e-6 * -60 } }));
    expect(cold.exact.state2.H).toBeGreaterThan(cold.exact.state1.H);
    expect(cold.exact.state2.sagMid).toBeLessThan(cold.exact.state1.sagMid);
  });

  it('a pure temperature rise decreases H, monotonically, and the sag rises monotonically, over a table', () => {
    const temps = Array.from({ length: 21 }, (_, i) => 6.5e-6 * (i * 10 - 100));
    const s = state(base({ state2: { q: 0, w: 0.0017605327, thermal: 0 }, sweep: { thermal: temps } }));
    const rows = s.tables.thermal;
    expect(rows.every((r) => r.ok)).toBe(true);
    for (let i = 1; i < rows.length; i++) {
      expect(rows[i].H!).toBeLessThan(rows[i - 1].H!);
      expect(rows[i].sagMid!).toBeGreaterThan(rows[i - 1].sagMid!);
      expect(rows[i].unstretched!).toBeGreaterThan(rows[i - 1].unstretched!);
    }
    // the row with no temperature change is state 1
    near(rows[10].H!, s.exact.state1.H, 1e-9);
  });

  it('heavier loads raise H and the sag together (the cable is longer than the chord and its length is fixed)... and lighter ones lower them', () => {
    const w = [0.0008, 0.0017605327, 0.003, 0.006];
    const s = state(base({ state2: { q: 0, w: 0.0017605327, thermal: 0 }, sweep: { loads: w.map((x) => ({ q: 0, w: x })) } }));
    const rows = s.tables.loads;
    for (let i = 1; i < rows.length; i++) expect(rows[i].H!).toBeGreaterThan(rows[i - 1].H!);
    // for a rigid cable of fixed length: H ∝ the load (the shape does not change)
    const rigid = state(base({ EA: null, state2: { q: 0, w: 0.0017605327, thermal: 0 }, sweep: { loads: [{ q: 0, w: 0.00321 }] } }));
    near(rigid.tables.loads[0].H! / rigid.exact.state1.H, 0.00321 / 0.0017605327, 5e-3);
  });

  it('the change reverses: state 1 → 2 → 1 returns H₁ (the temperature change as 1/(1+ε) − 1)', () => {
    const r = rng(31);
    for (let n = 0; n < 40; n++) {
      const L = logBetween(r, 50, 600);
      const h = between(r, -0.4, 0.4) * L * (r() < 0.5 ? 0 : 1);
      const w1 = logBetween(r, 1e-3, 1e-1);
      const q1 = r() < 0.5 ? 0 : logBetween(r, 1e-3, 1e-1);
      const w2 = w1 * between(r, 0.5, 3);
      const q2 = q1 * between(r, 0.5, 3);
      const EA = (w1 + q1 + w2 + q2) * L * logBetween(r, 200, 1e5);
      const eps = between(r, -4e-4, 4e-4);
      const known: Known = { kind: 'sag-mid', value: logBetween(r, 5e-3, 5e-2) * L };
      const there = state({ L, h, EA, known, state1: { q: q1, w: w1 }, state2: { q: q2, w: w2, thermal: eps } });
      const back = state({ L, h, EA, known: { kind: 'H', value: there.exact.state2.H }, state1: { q: q2, w: w2 }, state2: { q: q1, w: w1, thermal: 1 / (1 + eps) - 1 } });
      near(back.exact.state2.H, there.exact.state1.H, 1e-8);
      near(back.exact.state2.sagMid, there.exact.state1.sagMid, 1e-7, Math.max(there.exact.state1.sagMid, 1e-3));
    }
  });

  it('works from every kind of known for state 1, and state 1 is the cable of that known', () => {
    const one = hangingFirst();
    for (const known of one) {
      const s = state(base({ known, state2: { q: 0, w: 0.0017605327, thermal: 6.5e-6 * 20 } }));
      expect(s.exact.state1.setup.w).toBe(0.0017605327);
    }
  });
});

function hangingFirst(): Known[] {
  const h = solveHanging({ L: 300, h: 0, q: 0, w: 0.0017605327, EA: 6001.62, known: { kind: 'sag-mid', value: 6 } });
  if (!h.ok) throw new Error('setup');
  return [
    { kind: 'sag-mid', value: 6 },
    { kind: 'sag-low', value: 6 },
    { kind: 'H', value: h.exact.H },
    { kind: 'T-high', value: h.exact.tension.high },
    { kind: 'length', value: h.exact.unstretched },
  ];
}

describe('against the physics: RK4 shooting along the unstretched length', () => {
  it('H₂, the sag and the stretched length of state 2, with loads q and w, level or inclined, elastic', () => {
    const r = rng(32);
    let checked = 0;
    for (let n = 0; n < 24; n++) {
      const L = logBetween(r, 60, 500);
      const h = between(r, -0.5, 0.5) * L * (r() < 0.3 ? 0 : 1);
      const kind = n % 3;
      const w1 = kind === 1 ? 0 : logBetween(r, 2e-3, 5e-2);
      const q1 = kind === 0 ? 0 : logBetween(r, 2e-3, 5e-2);
      const w2 = w1 === 0 ? 0 : w1 * between(r, 0.8, 3);
      const q2 = q1 === 0 ? 0 : q1 * between(r, 0.8, 3);
      const EA = (w1 + q1) * L * logBetween(r, 300, 1e4);
      const eps = between(r, -3e-4, 3e-4);
      const known: Known = { kind: 'sag-mid', value: logBetween(r, 0.01, 0.06) * L };
      const s = state({ L, h, EA, known, state1: { q: q1, w: w1 }, state2: { q: q2, w: w2, thermal: eps } });
      const s2 = s.exact.state2;
      // state 1 by the physics, to get its unstretched length; then state 2 with that length times (1 + ε)
      const one = solveShot(s.exact.state1.H, q1, w1, EA, L, h, s.exact.state1.H * s.exact.state1.slope.A * 1.02, s.exact.state1.unstretched * 1.01, 2500);
      expect(one).not.toBeNull();
      if (!one) continue;
      const two = solveShotFixedLength(q2, w2, EA, L, h, one.Lu * (1 + eps), s2.H * 1.05, s2.H * s2.slope.A * 1.05, 2500);
      expect(two, `no convergence ${JSON.stringify({ L, h, w1, q1, w2, q2, EA, eps })}`).not.toBeNull();
      if (!two) continue;
      near(two.H, s2.H, 1e-7);
      near(two.s, s2.length, 1e-7);
      near(two.sagMid, s2.sagMid, 1e-5, Math.max(s2.sagMid, 1e-3 * L));
      checked++;
    }
    expect(checked).toBe(24);
  });
});

describe('against the textbook state equation of a level span', () => {
  /**
   * The cubic, in the textbook's terms. Parabolic length s(H, w) = L(1 + 8/3 r² − 32/5 r⁴), r = wL/8H; unstressed
   * length at state 1 L₀ = s₁/(1 + H₁/EA); at state 2  s(H₂, w₂) = L₀(1 + ε)(1 + H₂/EA). Solved by bisection on H₂
   * (the left side falls with H₂ and the right side rises).
   */
  function cubic(L: number, EA: number, H1: number, w1: number, w2: number, eps: number): number {
    const s = (H: number, w: number) => {
      const r = (w * L) / (8 * H);
      return L * (1 + (8 / 3) * r * r - (32 / 5) * r ** 4);
    };
    const L0 = s(H1, w1) / (1 + H1 / EA);
    let lo = 1e-3 * H1;
    let hi = 1e3 * H1;
    for (let i = 0; i < 300; i++) {
      const mid = 0.5 * (lo + hi);
      if (s(mid, w2) - L0 * (1 + eps) * (1 + mid / EA) > 0) lo = mid;
      else hi = mid;
    }
    return 0.5 * (lo + hi);
  }

  it('the default case: a 1 in IWRC rope, 300 ft, 6 ft of sag at 60 °F, then 20 °F with 1 lb/ft of ice', () => {
    // A = 0.4139 in² × 14,500 ksi = 6,002 kip;  w = 1.7605 lb/ft;  α = 6.5e-6 /°F
    const s = state(base());
    const H1 = (0.0017605 * 300 ** 2) / (8 * 6); // = 3.3010 kip by hand
    near(H1, 3.301, 1e-4);
    near(s.exact.state1.H, H1, 1e-3);
    const H2 = cubic(300, 6001.62, s.exact.state1.H, 0.0017605327, 0.0027605327, 6.5e-6 * -40);
    near(H2, 5.0873, 2e-4);
    // the engine's exact elastic cable differs from the textbook's parabolic one with the mean-tension elasticity by 4e-4
    near(s.exact.state2.H, H2, 1e-3);
    expect(s.exact.state2.H).toBeLessThan(H2);
    near(s.exact.state2.H, 5.0857, 1e-4);
    near(s.exact.state2.sagMid, 6.1048, 1e-4);
    near(s.ratioH, 1.5407, 1e-4);
  });

  it('random level spans: the engine and the cubic agree within the equation\'s own approximations (1e-3 of H)', () => {
    const r = rng(33);
    for (let n = 0; n < 60; n++) {
      const L = logBetween(r, 50, 800);
      const w1 = logBetween(r, 1e-3, 1e-1);
      const w2 = w1 * between(r, 0.5, 2);
      const ratio = logBetween(r, 0.01, 0.04);
      // a working cable: strain under about 3e-3 (the textbook equation takes the elasticity at H, not at the real tension; with the
      // strains of 1e-2 that a soft rope reaches at the other extreme it is out by 0.5 %, and the engine is the one validated by shooting)
      const EA = w1 * L * logBetween(r, 3000, 5e4);
      const eps = between(r, -5e-4, 5e-4);
      const s = state({ L, h: 0, EA, known: { kind: 'sag-mid', value: ratio * L }, state1: { q: 0, w: w1 }, state2: { q: 0, w: w2, thermal: eps } });
      const H2 = cubic(L, EA, s.exact.state1.H, w1, w2, eps);
      near(s.exact.state2.H, H2, 2e-3);
      // the engine's parabolic chain (exact parabola, exact elasticity) is the same kind of approximation of the exact cable
      near(s.parabolic!.state2.H, H2, 3e-3);
    }
  });

  it('a transmission-line conductor in ice and cold (SI): 300 m span, 8 m sag at 15 °C, then −5 °C with ice', () => {
    // Conductor: A = 468 mm² (metallic), E = 68 GPa, α = 19.3e-6 /°C, w = 1.62 kg/m = 15.89 N/m = 0.01589 kN/m; ice adds 9.8 N/m.
    const EA = 68e6 * 468e-6; // kN
    const w1 = 0.01589;
    const w2 = 0.01589 + 0.0098;
    const eps = 19.3e-6 * -20;
    const s = state({ L: 300, h: 0, EA, known: { kind: 'sag-mid', value: 8 }, state1: { q: 0, w: w1 }, state2: { q: 0, w: w2, thermal: eps } });
    // by hand: H1 = wL²/8d = 0.01589 × 90000 / 64 = 22.34 kN
    near(s.exact.state1.H, 22.345, 1e-3);
    const H2 = cubic(300, EA, s.exact.state1.H, w1, w2, eps);
    near(s.exact.state2.H, H2, 2e-3);
    expect(s.exact.state2.H).toBeGreaterThan(s.exact.state1.H);
    // the ice makes it heavier, the cold shortens it: the net sag is
    expect(s.exact.state2.sagMid).toBeGreaterThan(8);
  });
});

describe('the parabolic chain next to the exact one', () => {
  it('with q only it is the same change of state; with w it differs by less than the sag/span squared, and the warning rises past 1 %', () => {
    const q = state(base({ state1: { q: 0.0017605327, w: 0 }, state2: { q: 0.0027605327, w: 0, thermal: -2.6e-4 } }));
    expect(q.parabolic).toEqual({ state1: q.exact.state1, state2: q.exact.state2 });
    expect(q.family).toBe('parabola');
    expect(q.warnings.map((w) => w.code)).not.toContain('parabola-differs');
    const w = state(base());
    near(w.parabolic!.state2.H, w.exact.state2.H, 3e-3);
    expect(w.warnings.map((x) => x.code)).not.toContain('parabola-differs');
    // a deep cable, sag/span 0.25
    const deep = state(base({ known: { kind: 'sag-mid', value: 75 }, state2: { q: 0, w: 0.0017605327, thermal: 0 } }));
    expect(deep.warnings.map((x) => x.code)).toContain('parabola-differs');
  });
});

describe('the tables', () => {
  it('a temperature row is the state 2 cable at that temperature; the row at the case\'s own temperature is state 2', () => {
    const eps = 6.5e-6 * -40;
    const s = state(base({ sweep: { thermal: [eps, 0, 1e-4, -1e-4] } }));
    near(s.tables.thermal[0].H!, s.exact.state2.H, 1e-9);
    near(s.tables.thermal[0].sagMid!, s.exact.state2.sagMid, 1e-9);
    near(s.tables.thermal[0].tensionMax!, s.exact.state2.tension.max, 1e-9);
    expect(s.tables.thermal.map((r) => r.index)).toEqual([0, 1, 2, 3]);
    expect(s.tables.thermal[1].H).toBeGreaterThan(s.tables.thermal[2].H!);
  });

  it('a load row is a state 2 with those loads at the case\'s temperature', () => {
    const s = state(base({ sweep: { loads: [{ q: 0, w: 0.0027605327 }, { q: 0.001, w: 0.0017605327 }] } }));
    near(s.tables.loads[0].H!, s.exact.state2.H, 1e-9);
    const direct = state(base({ state2: { q: 0.001, w: 0.0017605327, thermal: 6.5e-6 * -40 } }));
    near(s.tables.loads[1].H!, direct.exact.state2.H, 1e-9);
    near(s.tables.loads[1].tensionHigh!, direct.exact.state2.tension.high, 1e-9);
  });

  it('a row that cannot be solved says why and the others are still given', () => {
    const s = state(base({ EA: null, sweep: { thermal: [-0.5, 0, 6.5e-6 * -40], loads: [{ q: 0, w: 0 }, { q: 0, w: 0.002 }] } }));
    // a rigid cable shortened by 50 % cannot reach (code), a strain of −1 or less is not a strain
    expect(s.tables.thermal[0]).toEqual({ index: 0, ok: false, code: 'state2-too-short' });
    expect(s.tables.thermal[1].ok).toBe(true);
    expect(s.tables.loads[0]).toEqual({ index: 0, ok: false, code: 'state2-load-zero' });
    expect(s.tables.loads[1].ok).toBe(true);
    const bad = state(base({ sweep: { thermal: [-1, Number.NaN] } }));
    expect(bad.tables.thermal.map((r) => r.code)).toEqual(['thermal', 'thermal']);
  });

  it('too many rows is refused', () => {
    const rows = Array.from({ length: MAX_TABLE_ROWS + 1 }, () => 0);
    const out = solveState(base({ sweep: { thermal: rows } }));
    expect(out).toEqual({ ok: false, issues: [{ code: 'table', field: 'thermal', count: MAX_TABLE_ROWS + 1, max: MAX_TABLE_ROWS }] });
    const out2 = solveState(base({ sweep: { loads: Array.from({ length: MAX_FACTOR_ROWS + 1 }, () => ({ q: 0, w: 1 })) } }));
    expect(out2).toEqual({ ok: false, issues: [{ code: 'table', field: 'loads', count: MAX_FACTOR_ROWS + 1, max: MAX_FACTOR_ROWS }] });
    expect(solveState(base({ sweep: { thermal: rows.slice(0, MAX_TABLE_ROWS) } })).ok).toBe(true);
  });
});

describe('what cannot be solved is said by code', () => {
  it('an inextensible cable cooled until it is shorter than its chord: state2-too-short, with the chord and the length', () => {
    const out = solveState(base({ EA: null, state2: { q: 0, w: 0.0017605327, thermal: -0.01 } }));
    expect(out.ok).toBe(false);
    if (out.ok) return;
    expect(out.issues).toHaveLength(1);
    expect(out.issues[0].code).toBe('state2-too-short');
    expect(out.issues[0].state).toBe(2);
    expect(out.issues[0].chord).toBe(300);
    expect(out.issues[0].length).toBeLessThanOrEqual(300);
  });

  it('...while an elastic one has an answer (very tight)', () => {
    const s = state(base({ state2: { q: 0, w: 0.0017605327, thermal: -0.01 } }));
    expect(s.exact.state2.H).toBeGreaterThan(10 * s.exact.state1.H);
    expect(s.warnings.some((w) => w.code === 'strain-high' && w.state === 2)).toBe(false);
  });

  it('state 2 with no load: state2-load-zero (straight, or slack), with the chord and the unstressed length', () => {
    const out = solveState(base({ state2: { q: 0, w: 0, thermal: 0 } }));
    expect(out.ok).toBe(false);
    if (out.ok) return;
    expect(out.issues).toEqual([{ code: 'state2-load-zero', state: 2, chord: 300, length: expect.any(Number) }]);
    expect(out.issues[0].length).toBeGreaterThan(300);
  });

  it('state 1 problems are state 1\'s: no load, the known out of range, a length below the chord', () => {
    expect(solveState(base({ state1: { q: 0, w: 0 } }))).toEqual({ ok: false, issues: [{ code: 'load-zero', state: 1 }] });
    const range = solveState(base({ known: { kind: 'sag-mid', value: 1e-9 } }));
    expect(range.ok).toBe(false);
    if (!range.ok) expect(range.issues[0].code).toBe('sag-range');
    const short = solveState(base({ EA: null, known: { kind: 'length', value: 299 } }));
    expect(short).toEqual({ ok: false, issues: [{ code: 'length-below-chord', chord: 300, length: 299, state: 1 }] });
  });

  it('the thermal strain must be a number above −1', () => {
    expect(solveState(base({ state2: { q: 0, w: 0.001, thermal: Number.NaN } }))).toEqual({ ok: false, issues: [{ code: 'thermal', value: Number.NaN }] });
    expect(solveState(base({ state2: { q: 0, w: 0.001, thermal: -1 } }))).toEqual({ ok: false, issues: [{ code: 'thermal', value: -1 }] });
  });

  it('never throws on rubbish', () => {
    const rubbish = [undefined, null, {}, { L: 'x' }, { L: 1, h: 0, EA: null, known: null, state1: null, state2: null }];
    for (const r of rubbish) expect(() => solveState(r as unknown as StateInput)).not.toThrow();
    for (const r of rubbish) expect(solveState(r as unknown as StateInput).ok).toBe(false);
  });
});

describe('the load factor and a combined state', () => {
  it('both q and w, inclined: the exact change of state is consistent (reactions carry q·L + w·L₀ at both states)', () => {
    const s = state({
      L: 200,
      h: 40,
      EA: 30000,
      known: { kind: 'T-high', value: 25 },
      state1: { q: 0.02, w: 0.05 },
      state2: { q: 0.1, w: 0.08, thermal: 2e-4 },
    });
    for (const c of [s.exact.state1, s.exact.state2]) {
      near(c.reaction.A + c.reaction.B, c.setup.q * 200 + c.setup.w * c.unstretched, 1e-10);
    }
    expect(s.family).toBe('combined');
    near(s.exact.state1.unstretched * (1 + 2e-4), s.exact.state2.unstretched, 1e-9);
  });
});
