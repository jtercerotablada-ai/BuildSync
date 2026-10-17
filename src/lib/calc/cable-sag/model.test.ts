import { afterEach, describe, expect, it, vi } from 'vitest';
import { checkOf } from '../beam/model';
import { solveHanging, solvePoints, solveState } from './engine';
import {
  CABLE_MATERIALS,
  CABLE_SAG_KEY,
  CABLE_UNITS,
  FROM_ENGINE,
  MAX_LINK,
  TO_ENGINE,
  convertCableSag,
  decode,
  decodeCableSag,
  defaultCase,
  defaultCaseFor,
  encode,
  encodeCableSag,
  issueField,
  metalArea,
  reduceCableSag,
  selfWeight,
  stiffness,
  toEngine,
  type CableSagAction,
  type CableSagForm,
  type CableSagMode,
  type MaterialId,
} from './model';
import { between, logBetween, rng } from './oracle.testlib';
import { MAX_POINT_LOADS } from './types';

// Heavy by design (thousands of generated forms, a hundred thousand fuzz strings).
vi.setConfig({ testTimeout: 120_000 });
afterEach(() => new Promise<void>((resolve) => setTimeout(resolve, 0)));

/**
 * THE FORM. What each edit does, what the engine is given, the two unit systems and the address that carries a case
 * from one engineer to another. The address is the part that must never let a visitor down, so it gets the most:
 * round trips on thousands of random forms, every kind of damage a link can suffer, and fuzz — decode answers a form
 * or null, and does not throw.
 */

const eight = (v: number) => Number(v.toPrecision(8));
const act = (form: CableSagForm, ...actions: CableSagAction[]) => actions.reduce(reduceCableSag, form);
const MODES: CableSagMode[] = ['hanging', 'state', 'points'];

/** A form without its notice and with its point ids as a link numbers them: what an address carries. */
const normal = (f: CableSagForm): CableSagForm => ({ ...f, notice: null, points: f.points.map((p, i) => ({ ...p, id: i + 1 })), nextId: f.points.length + 1 });

/** A random form, with numbers of at most eight figures (the most a field shows and an address carries). */
function randomForm(r: () => number): CableSagForm {
  const pick = <T,>(list: readonly T[]): T => list[Math.floor(r() * list.length)];
  const num = () => (r() < 0.04 ? pick([Number.NaN, Number.POSITIVE_INFINITY, Number.NEGATIVE_INFINITY, 0, -0.5]) : eight(r() < 0.5 ? between(r, -1000, 1000) : logBetween(r, 1e-9, 1e12) * (r() < 0.2 ? -1 : 1)));
  const count = Math.floor(r() * (MAX_POINT_LOADS + 1));
  return {
    units: pick(['us', 'si'] as const),
    mode: pick(MODES),
    span: num(),
    rise: num(),
    material: pick<MaterialId>(['steel', 'stainless', 'aluminum', 'strand', 'rope', 'spiral', 'locked', 'custom']),
    sectionBy: pick(['diameter', 'area'] as const),
    diameter: num(),
    area: num(),
    fill: num(),
    lay: num(),
    E: num(),
    alpha: num(),
    gamma: num(),
    elastic: r() < 0.5,
    weightFrom: pick(['section', 'typed', 'none'] as const),
    typedWeight: num(),
    q: num(),
    known: pick(['sag', 'H', 'T-high', 'T-low', 'length'] as const),
    sagKind: pick(['mid', 'low'] as const),
    sag: num(),
    H: num(),
    T: num(),
    length: num(),
    state: { q: num(), ice: num(), T1: num(), T2: num(), low: num(), high: num(), step: num(), factorLow: num(), factorHigh: num(), factorRows: num() },
    points: Array.from({ length: count }, (_, i) => ({ id: i + 1, x: num(), P: num() })),
    pointsKnown: pick(['sag', 'H', 'T-max'] as const),
    sagAt: num(),
    pointsSag: num(),
    pointsH: num(),
    pointsT: num(),
    notice: null,
    nextId: count + 1,
  };
}

describe('the cases the page opens with', () => {
  it('there is one per mode, in either system, and defaultCase() is the hanging cable in US units', () => {
    expect(defaultCase()).toEqual(defaultCaseFor('hanging', 'us'));
    for (const mode of MODES) {
      for (const units of ['us', 'si'] as const) {
        const f = defaultCaseFor(mode, units);
        expect(f.mode).toBe(mode);
        expect(f.units).toBe(units);
        expect(f.notice).toBeNull();
        expect(f.points.map((p) => p.id)).toEqual(f.points.map((_, i) => i + 1));
        expect(f.nextId).toBe(f.points.length + 1);
      }
    }
  });

  it('each default solves in its own mode and gives the hand answer', () => {
    // hanging: H = qL²/8d = 12.5 kip, T_max = √(12.5² + 5²) = 13.463 kip
    const h = defaultCaseFor('hanging');
    const hang = solveHanging(toEngine(h).hanging);
    expect(hang.ok && hang.exact.H).toBeCloseTo(12.5, 10);
    expect(hang.ok && hang.exact.tension.max).toBeCloseTo(13.46291201783626, 10);
    // state: 6 ft sag at 60 °F, then 20 °F with ice: H1 ≈ 3.3010 kip (wL²/8d), H2 ≈ 5.0857 kip (an independent RK4 solver: 5.08566)
    const st = solveState(toEngine(defaultCaseFor('state')).state);
    expect(st.ok && st.exact.state1.H).toBeCloseTo(3.3009, 3);
    expect(st.ok && st.exact.state2.H).toBeCloseTo(5.0857, 3);
    // points: H = 37.5 kip
    const pt = solvePoints(toEngine(defaultCaseFor('points')).points);
    expect(pt.ok && pt.H).toBeCloseTo(37.5, 12);
  });

  it('the SI defaults are the US ones in the other units (to the figures a field shows) and give the same cable', () => {
    for (const mode of MODES) {
      const us = defaultCaseFor(mode, 'us');
      const si = defaultCaseFor(mode, 'si');
      expect(si).toEqual(convertCableSag(us, 'si'));
      const a = toEngine(us);
      const b = toEngine(si);
      // engine inputs, each in its own system: lengths and forces differ by the exact factors
      expect(b.hanging.L / a.hanging.L).toBeCloseTo(0.3048, 5);
      if (mode === 'hanging') {
        const ha = solveHanging(a.hanging);
        const hb = solveHanging(b.hanging);
        if (ha.ok && hb.ok) expect(hb.exact.H / ha.exact.H).toBeCloseTo(4.4482216152605, 4);
      }
      if (mode === 'points') {
        const pa = solvePoints(a.points);
        const pb = solvePoints(b.points);
        if (pa.ok && pb.ok) expect(pb.H / pa.H).toBeCloseTo(4.4482216152605, 4);
      }
      if (mode === 'state') {
        const sa = solveState(a.state);
        const sb = solveState(b.state);
        if (sa.ok && sb.ok) {
          expect(sb.ratioH).toBeCloseTo(sa.ratioH, 3);
          expect(sb.exact.state2.sagMid / sa.exact.state2.sagMid).toBeCloseTo(0.3048, 3);
        }
      }
    }
  });

  it('units round trip: US → SI → US returns the default, field for field', () => {
    for (const mode of MODES) {
      const us = defaultCaseFor(mode, 'us');
      expect(convertCableSag(convertCableSag(us, 'si'), 'us')).toEqual(us);
    }
  });
});

describe('units', () => {
  it('a listed material takes its listed numbers in the other system (29,000 ksi is 200 GPa, not 199.948)', () => {
    const f = defaultCaseFor('hanging');
    const si = convertCableSag(f, 'si');
    expect(si.E).toBe(200);
    expect(si.alpha).toBe(11.7);
    expect(si.gamma).toBe(77);
    expect(convertCableSag(si, 'us').E).toBe(29000);
    // a typed number is converted
    const custom = act(f, { type: 'material', material: 'custom' }, { type: 'section', patch: { E: 30000 } });
    expect(custom.material).toBe('custom');
    near(convertCableSag(custom, 'si').E, 30000 * 0.0068947572932, 1e-5);
  });

  it('temperatures carry their offset, a temperature STEP and a coefficient do not: ΔT is a difference', () => {
    const f = defaultCaseFor('state');
    const si = convertCableSag(f, 'si');
    expect(si.state.T1).toBeCloseTo(15.5556, 3); // 60 °F
    expect(si.state.T2).toBeCloseTo(-6.6667, 3); // 20 °F
    expect(si.state.step).toBeCloseTo(10 / 1.8, 4); // a 10 °F step is 5.556 °C, not −12.2
    expect(si.state.low).toBeCloseTo(-17.7778, 3); // 0 °F
    expect(si.alpha).toBe(11.7); // 6.5 per °F is 11.7 per °C
    // the thermal strain α·ΔT is the same number in both systems
    const strain = (g: CableSagForm) => toEngine(g).state.state2.thermal;
    expect(strain(si)).toBeCloseTo(strain(f), 6);
    expect(strain(f)).toBeCloseTo(6.5e-6 * -40, 12);
  });

  it('the conversion table is the one place: US and SI engine inputs of the same random cable agree', () => {
    const r = rng(51);
    for (let n = 0; n < 200; n++) {
      const us: CableSagForm = {
        ...defaultCaseFor(MODES[n % 3], 'us'),
        span: eight(logBetween(r, 10, 800)),
        rise: eight(between(r, -50, 50)),
        diameter: eight(logBetween(r, 0.2, 4)),
        q: eight(logBetween(r, 1, 500)),
        typedWeight: eight(logBetween(r, 0.1, 10)),
        weightFrom: (['section', 'typed', 'none'] as const)[n % 3],
        material: 'custom',
        E: eight(logBetween(r, 5000, 30000)),
        alpha: eight(logBetween(r, 5, 15)),
        gamma: eight(logBetween(r, 100, 500)),
      };
      const si = convertCableSag(us, 'si');
      const a = toEngine(us);
      const b = toEngine(si);
      const k = 4.4482216152605;
      const f = 0.3048;
      // line loads: kip/ft ↔ kN/m
      expect(b.hanging.q / a.hanging.q).toBeCloseTo(k / f, 3);
      if (a.hanging.w > 0) expect(Math.abs(b.hanging.w / a.hanging.w / (k / f) - 1)).toBeLessThan(5e-5);
      if (a.EA !== null && b.EA !== null) expect(Math.abs(b.EA / a.EA / k - 1)).toBeLessThan(5e-5);
      expect(Math.abs(b.state.state2.thermal / a.state.state2.thermal - 1)).toBeLessThan(1e-4);
      // and back: nothing is lost beyond the figures a field shows
      const back = convertCableSag(si, 'us');
      expect(Math.abs(back.span / us.span - 1)).toBeLessThan(3e-5);
      expect(Math.abs(back.q / us.q - 1)).toBeLessThan(3e-5);
    }
  });

  it('TO_ENGINE and FROM_ENGINE are the only constants: 12, 144, 1000 and 1e6 are in them', () => {
    expect(TO_ENGINE.us).toEqual({ line: 1 / 1000, gamma: 1 / 1000, area: 1 / 144, dim: 1 / 12, E: 144, alpha: 1e-6 });
    expect(TO_ENGINE.si).toEqual({ line: 1, gamma: 1, area: 1e-6, dim: 1e-3, E: 1e6, alpha: 1e-6 });
    expect(FROM_ENGINE.us).toEqual({ elongation: 12, stress: 1 / 144, line: 1000 });
    expect(FROM_ENGINE.si).toEqual({ elongation: 1000, stress: 1 / 1000, line: 1 });
    expect(CABLE_UNITS.us.line).toBe('lb/ft');
    expect(CABLE_UNITS.si.line).toBe('kN/m');
  });
});

describe('the section and the weight', () => {
  it('a 1 in steel bar: A = π/4 in², w = 490 lb/ft³ × A = 2.673 lb/ft, EA = 29,000 × A', () => {
    const f = act(defaultCaseFor('hanging'), { type: 'loads', patch: { weightFrom: 'section' } });
    near(metalArea(f), Math.PI / 4 / 144, 1e-12);
    near(selfWeight(f) * 1000, 2.6725354, 1e-6);
    near(stiffness(f) ?? 0, 29000 * (Math.PI / 4), 1e-12);
  });

  it('a 1 in 6×19 IWRC rope: metallic area 0.4139 in² (0.414·d²), E on it 14,500 ksi, w = 1.7605 lb/ft (the published 1.76·d²), EA = 6,002 kip', () => {
    const f = act(defaultCaseFor('hanging'), { type: 'material', material: 'rope' }, { type: 'loads', patch: { weightFrom: 'section' } });
    near(metalArea(f) * 144, 0.527 * (Math.PI / 4), 1e-12);
    near(selfWeight(f) * 1000, 1.7605327, 1e-6);
    // the published weight of a 6×19 IWRC rope is 1.76·d² lb/ft (1 in: 1.76, 1/2 in: 0.44)
    near(selfWeight(f) * 1000, 1.76, 1e-3);
    near(selfWeight(act(f, { type: 'section', patch: { diameter: 0.5 } })) * 1000, 0.44, 1e-3);
    near(stiffness(f) ?? 0, 6001.62, 1e-5);
  });

  it('a 7-wire strand of 0.5 in: area 0.153 in² and 0.52 lb/ft (published values)', () => {
    const f = act(defaultCaseFor('hanging'), { type: 'material', material: 'strand' }, { type: 'section', patch: { diameter: 0.5 } }, { type: 'loads', patch: { weightFrom: 'section' } });
    near(metalArea(f) * 144, 0.1531, 2e-3);
    near(selfWeight(f) * 1000, 0.5213, 3e-3);
  });

  it('by area: the area typed is the metallic area; the weight is unit weight × area × lay', () => {
    const f = act(defaultCaseFor('hanging'), { type: 'material', material: 'rope' }, { type: 'section', patch: { sectionBy: 'area', area: 0.4 } }, { type: 'loads', patch: { weightFrom: 'section' } });
    near(metalArea(f) * 144, 0.4, 1e-12);
    near(selfWeight(f), (490 / 1000) * (0.4 / 144) * 1.25, 1e-12);
  });

  it('typed weight is used as given (lb/ft → kip/ft), none is 0; EA is null for an inextensible cable', () => {
    const base = defaultCaseFor('hanging');
    expect(selfWeight(act(base, { type: 'loads', patch: { weightFrom: 'typed', typedWeight: 1.6 } }))).toBeCloseTo(0.0016, 12);
    expect(selfWeight(act(base, { type: 'loads', patch: { weightFrom: 'none' } }))).toBe(0);
    expect(stiffness(act(base, { type: 'section', patch: { elastic: false } }))).toBeNull();
    expect(Number.isNaN(stiffness(act(base, { type: 'section', patch: { diameter: Number.NaN } })) ?? 0)).toBe(true);
  });

  it('SI: the same rope in mm and kN/m gives the same EA and weight', () => {
    const us = act(defaultCaseFor('hanging'), { type: 'material', material: 'rope' }, { type: 'loads', patch: { weightFrom: 'section' } });
    const si = convertCableSag(us, 'si');
    expect(Math.abs((stiffness(si) ?? 0) / (stiffness(us) ?? 1) / 4.4482216152605 - 1)).toBeLessThan(5e-3);
    expect(Math.abs(selfWeight(si) / selfWeight(us) / (4.4482216152605 / 0.3048) - 1)).toBeLessThan(5e-3);
  });

  it('every preset carries E, alpha and unit weight in both systems that agree to the figures quoted, and a fill and lay that make sense', () => {
    for (const [id, p] of Object.entries(CABLE_MATERIALS)) {
      expect(Math.abs(p.E.si / (p.E.us * 0.0068947572932) - 1), `${id} E`).toBeLessThan(0.01);
      expect(Math.abs(p.alpha.si / (p.alpha.us * 1.8) - 1), `${id} alpha`).toBeLessThan(0.01);
      expect(Math.abs(p.gamma.si / (p.gamma.us * 0.157087461) - 1), `${id} gamma`).toBeLessThan(0.02);
      expect(p.fill).toBeGreaterThan(0.4);
      expect(p.fill).toBeLessThanOrEqual(1);
      expect(p.lay).toBeGreaterThanOrEqual(1);
      expect(p.lay).toBeLessThan(1.3);
      expect(p.range[0]).toBeLessThanOrEqual(p.E.us);
      expect(p.range[1]).toBeGreaterThanOrEqual(p.E.us);
    }
    // the trap: a rope's modulus is not steel's - about half of it
    expect(CABLE_MATERIALS.rope.E.us / CABLE_MATERIALS.steel.E.us).toBeGreaterThan(0.45);
    expect(CABLE_MATERIALS.rope.E.us / CABLE_MATERIALS.steel.E.us).toBeLessThanOrEqual(0.5);
    expect(CABLE_MATERIALS.rope.E.us).toBeLessThan(CABLE_MATERIALS.spiral.E.us);
    expect(CABLE_MATERIALS.spiral.E.us).toBeLessThan(CABLE_MATERIALS.locked.E.us);
    expect(CABLE_MATERIALS.locked.E.us).toBeLessThan(CABLE_MATERIALS.strand.E.us);
  });

  it('the verified presets (EN 1993-1-11 Table 3.1 and Annex C, the rope makers, the 6061-T6 data sheets): the numbers are pinned', () => {
    const m = CABLE_MATERIALS;
    expect([m.rope.E.us, m.rope.E.si, m.rope.fill, m.rope.lay, m.rope.range]).toEqual([14500, 100, 0.527, 1.25, [13000, 15500]]);
    expect([m.spiral.E.us, m.spiral.E.si, m.spiral.fill, m.spiral.lay, m.spiral.range]).toEqual([21800, 150, 0.75, 1.04, [20000, 23200]]);
    expect([m.locked.E.us, m.locked.E.si, m.locked.fill, m.locked.range]).toEqual([23200, 160, 0.84, [21800, 24700]]);
    expect([m.stainless.alpha.us, m.stainless.alpha.si]).toEqual([9.2, 16.6]);
    expect([m.aluminum.alpha.us, m.aluminum.alpha.si]).toEqual([13, 23.4]);
    // what is kept: steel, strand
    expect([m.steel.E.us, m.steel.E.si, m.steel.alpha.us, m.steel.alpha.si, m.steel.gamma.us, m.steel.gamma.si]).toEqual([29000, 200, 6.5, 11.7, 490, 77]);
    expect([m.strand.E.us, m.strand.E.si, m.strand.fill]).toEqual([28500, 196, 0.78]);
    // the metallic area of a rope: 0.414·d² (EN Annex C, 6×19), its weight 1.76·d² lb/ft
    near(m.rope.fill * (Math.PI / 4), 0.414, 5e-3);
    near(m.rope.gamma.us * m.rope.fill * (Math.PI / 4) * m.rope.lay, 1.76 * 144, 1e-3);
    // the SI numbers are the round figures of the same physical value, to 0.5 %
    for (const id of ['rope', 'spiral', 'locked'] as const) expect(Math.abs(m[id].E.si / (m[id].E.us * 0.0068947572932) - 1), id).toBeLessThan(5e-3);
  });
});

function near(got: number, want: number, tol: number): void {
  expect(Math.abs(got - want), `got ${got}, want ${want}`).toBeLessThanOrEqual(tol * Math.max(Math.abs(want), 1e-300));
}

describe('what each edit does', () => {
  const base = defaultCase();

  it('load replaces the case and clears the notice; reset is the hanging example in the units on show', () => {
    const si = defaultCaseFor('points', 'si');
    expect(act(base, { type: 'load', form: { ...si, notice: { code: 'limit', list: 'points', max: 12 } } })).toEqual(si);
    expect(act(defaultCaseFor('points', 'si'), { type: 'reset' })).toEqual(defaultCaseFor('hanging', 'si'));
  });

  it('mode switches and keeps what was typed; with example it replaces the case by that mode\'s example in the same units', () => {
    const typed = act(base, { type: 'geometry', patch: { span: 123 } });
    const m = act(typed, { type: 'mode', mode: 'points' });
    expect(m.mode).toBe('points');
    expect(m.span).toBe(123);
    expect(act(typed, { type: 'mode', mode: 'state', example: true })).toEqual(defaultCaseFor('state', 'us'));
    expect(act(convertCableSag(typed, 'si'), { type: 'mode', mode: 'state', example: true })).toEqual(defaultCaseFor('state', 'si'));
    expect(act(typed, { type: 'mode', mode: 'bogus' as CableSagMode })).toBe(typed);
  });

  it('units converts', () => {
    expect(act(base, { type: 'units', units: 'si' })).toEqual(convertCableSag(base, 'si'));
    expect(act(base, { type: 'units', units: 'us' })).toBe(base);
  });

  it('geometry, loads, known, state, points patches change what they name and ignore the rest and the wrong kinds', () => {
    expect(act(base, { type: 'geometry', patch: { span: 250, rise: 12 } })).toMatchObject({ span: 250, rise: 12 });
    expect(act(base, { type: 'geometry', patch: { span: 'x' as unknown as number, nope: 1 } as never })).toEqual(base);
    expect(act(base, { type: 'loads', patch: { weightFrom: 'typed', typedWeight: 2, q: 55 } })).toMatchObject({ weightFrom: 'typed', typedWeight: 2, q: 55 });
    expect(act(base, { type: 'loads', patch: { weightFrom: 'nonsense' as never } })).toEqual(base);
    expect(act(base, { type: 'known', patch: { known: 'length', length: 103, sagKind: 'low' } })).toMatchObject({ known: 'length', length: 103, sagKind: 'low' });
    expect(act(base, { type: 'known', patch: { known: 'T-low', T: 14 } })).toMatchObject({ known: 'T-low', T: 14 });
    expect(act(base, { type: 'state', patch: { T2: 5, ice: 2, factorRows: 9 } }).state).toMatchObject({ T2: 5, ice: 2, factorRows: 9, T1: 60 });
    expect(act(base, { type: 'state', patch: { T2: Number.NaN } }).state.T2).toBeNaN();
    expect(act(base, { type: 'points', patch: { pointsKnown: 'T-max', pointsT: 50, sagAt: 20 } })).toMatchObject({ pointsKnown: 'T-max', pointsT: 50, sagAt: 20 });
    expect(act(base, { type: 'points', patch: { pointsKnown: 'zzz' as never } })).toEqual(base);
  });

  it('material loads the preset (E, alpha, unit weight, fill, lay) in the units on show; typing over a preset number makes it custom', () => {
    const rope = act(base, { type: 'material', material: 'rope' });
    expect(rope).toMatchObject({ material: 'rope', E: 14500, alpha: 6.5, gamma: 490, fill: 0.527, lay: 1.25 });
    const si = act(convertCableSag(base, 'si'), { type: 'material', material: 'aluminum' });
    expect(si).toMatchObject({ material: 'aluminum', E: 69, alpha: 23.4, gamma: 26.6 });
    expect(act(base, { type: 'material', material: 'custom' })).toMatchObject({ material: 'custom', E: 29000 });
    expect(act(base, { type: 'material', material: 'unobtainium' as MaterialId })).toBe(base);
    const typed = act(rope, { type: 'section', patch: { E: 12500 } });
    expect(typed.material).toBe('custom');
    expect(typed.E).toBe(12500);
    // typing the preset's own number keeps it; section fields that are not material numbers keep it
    expect(act(rope, { type: 'section', patch: { E: 14500 } }).material).toBe('rope');
    expect(act(rope, { type: 'section', patch: { diameter: 1.5, sectionBy: 'area', area: 0.5, elastic: false } }).material).toBe('rope');
    expect(act(rope, { type: 'section', patch: { fill: 0.6 } }).material).toBe('custom');
  });

  it('point loads: add (a quarter span past the last, its size), remove, patch, and the cap of 12 with a notice', () => {
    let f = base;
    f = act(f, { type: 'point-add' });
    expect(f.points).toHaveLength(4);
    expect(f.points[3]).toEqual({ id: 4, x: 70, P: 10 }); // a quarter of the 100 ft span (25) past the last one, at 45; the last one's size
    expect(f.nextId).toBe(5);
    const before = f.points.length;
    f = act(f, { type: 'point-patch', id: 4, patch: { x: 80, P: 3 } });
    expect(f.points[before - 1]).toEqual({ id: 4, x: 80, P: 3 });
    f = act(f, { type: 'point-remove', id: 1 });
    expect(f.points.map((p) => p.id)).toEqual([2, 3, 4]);
    expect(act(f, { type: 'point-remove', id: 99 })).toBe(f);
    expect(act(f, { type: 'point-patch', id: 99, patch: { x: 1 } })).toBe(f);
    expect(act(f, { type: 'point-patch', id: 2, patch: { nope: 1 } as never })).toBe(f);
    while (f.points.length < MAX_POINT_LOADS) f = act(f, { type: 'point-add' });
    expect(f.points).toHaveLength(MAX_POINT_LOADS);
    const full = act(f, { type: 'point-add' });
    expect(full.points).toHaveLength(MAX_POINT_LOADS);
    expect(full.notice).toEqual({ code: 'limit', list: 'points', max: MAX_POINT_LOADS });
    expect(full.nextId).toBe(f.nextId);
    expect(act(full, { type: 'dismiss' }).notice).toBeNull();
    expect(act(full, { type: 'geometry', patch: { span: 5 } }).notice).toBeNull();
    expect(act(base, { type: 'dismiss' })).toBe(base);
    // ids only grow
    const ids = f.points.map((p) => p.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('a new load is placed inside the span even when the last one is near the end, and a removed row\'s id is never reused', () => {
    let f = act(base, { type: 'point-patch', id: 3, patch: { x: 99 } });
    f = act(f, { type: 'point-add' });
    const added = f.points[f.points.length - 1];
    expect(added.x).toBeGreaterThan(0);
    expect(added.x).toBeLessThan(100);
    f = act(f, { type: 'point-remove', id: added.id }, { type: 'point-add' });
    expect(f.points[f.points.length - 1].id).toBe(added.id + 1);
  });
});

describe('the engine inputs, by mode', () => {
  it('known: sag → mid or low; the others as they are', () => {
    const b = defaultCase();
    expect(toEngine(b).hanging.known).toEqual({ kind: 'sag-mid', value: 10 });
    expect(toEngine(act(b, { type: 'known', patch: { sagKind: 'low' } })).hanging.known).toEqual({ kind: 'sag-low', value: 10 });
    expect(toEngine(act(b, { type: 'known', patch: { known: 'H', H: 7 } })).hanging.known).toEqual({ kind: 'H', value: 7 });
    expect(toEngine(act(b, { type: 'known', patch: { known: 'T-high', T: 9 } })).hanging.known).toEqual({ kind: 'T-high', value: 9 });
    expect(toEngine(act(b, { type: 'known', patch: { known: 'T-low', T: 9 } })).hanging.known).toEqual({ kind: 'T-low', value: 9 });
    expect(toEngine(act(b, { type: 'known', patch: { known: 'length', length: 103 } })).hanging.known).toEqual({ kind: 'length', value: 103 });
    const p = defaultCaseFor('points');
    expect(toEngine(p).points.known).toEqual({ kind: 'sag', x: 30, value: 12 });
    expect(toEngine(act(p, { type: 'points', patch: { pointsKnown: 'H' } })).points.known).toEqual({ kind: 'H', value: 37.5 });
    expect(toEngine(act(p, { type: 'points', patch: { pointsKnown: 'T-max' } })).points.known).toEqual({ kind: 'T-max', value: 42.5 });
    expect(toEngine(p).points.loads).toEqual([{ x: 15, P: 10 }, { x: 30, P: 20 }, { x: 45, P: 10 }]);
    expect(toEngine(p).rows).toEqual([1, 2, 3]);
  });

  it('the hanging input: q in kip/ft, the weight from the section, EA only when elastic', () => {
    const e = toEngine(act(defaultCase(), { type: 'loads', patch: { q: 250 } }));
    expect(e.hanging).toMatchObject({ L: 100, h: 0, q: 0.25, w: 0 });
    expect(e.hanging.EA).toBeCloseTo(29000 * (Math.PI / 4), 9);
    expect(toEngine(act(defaultCase(), { type: 'section', patch: { elastic: false } })).hanging.EA).toBeNull();
  });

  it('the state input: state 1 is the form\'s load, state 2 is its own q plus the weight plus ice; thermal = α·ΔT', () => {
    const f = defaultCaseFor('state');
    const e = toEngine(f);
    expect(e.state.state1).toEqual({ q: 0, w: expect.closeTo(0.0017605327, 9) });
    expect(e.state.state2.q).toBe(0);
    expect(e.state.state2.w).toBeCloseTo(0.0017605327 + 0.001, 9);
    expect(e.state.state2.thermal).toBeCloseTo(-2.6e-4, 12);
  });

  it('the tables: temperatures from low to high by step (inclusive), factors evenly from low to high; a table that cannot be made says why', () => {
    const f = defaultCaseFor('state');
    const e = toEngine(f);
    expect(e.temps).toEqual([0, 10, 20, 30, 40, 50, 60, 70, 80, 90, 100]);
    expect(e.state.sweep?.thermal).toHaveLength(11);
    expect(e.state.sweep?.thermal?.[2]).toBeCloseTo(6.5e-6 * (20 - 60), 12);
    expect(e.factors).toEqual([0, 0.5, 1, 1.5, 2, 2.5, 3]);
    expect(e.state.sweep?.loads?.[2]).toEqual({ q: 0, w: expect.closeTo(0.0017605327 + 0.001, 9) });
    expect(e.state.sweep?.loads?.[0]).toEqual({ q: 0, w: expect.closeTo(0.0017605327, 9) });
    expect(e.tableIssues).toEqual([]);
    const bad = toEngine(act(f, { type: 'state', patch: { low: 0, high: 1000, step: 1, factorRows: 40 } }));
    expect(bad.temps).toEqual([]);
    expect(bad.factors).toEqual([]);
    expect(bad.tableIssues).toEqual([
      { code: 'table', field: 'thermal', count: 1001, max: 41 },
      { code: 'table', field: 'loads', count: 40, max: 21 },
    ]);
    expect(toEngine(act(f, { type: 'state', patch: { step: 0 } })).tableIssues[0]).toMatchObject({ code: 'table', field: 'thermal' });
    expect(toEngine(act(f, { type: 'state', patch: { high: -5 } })).tableIssues[0]).toMatchObject({ code: 'table', field: 'thermal' });
    expect(toEngine(act(f, { type: 'state', patch: { step: Number.NaN } })).tableIssues[0]).toEqual({ code: 'number', field: 'thermal' });
    expect(toEngine(act(f, { type: 'state', patch: { factorRows: 1 } })).factors).toEqual([0]);
    expect(toEngine(act(f, { type: 'state', patch: { factorRows: 2.5 } })).tableIssues[0]).toMatchObject({ code: 'table', field: 'loads' });
  });

  it('a field a mode does not use is ignored by it, NaN or not', () => {
    const f = { ...defaultCaseFor('points'), diameter: Number.NaN, q: Number.NaN, E: Number.NaN, state: { ...defaultCase().state, T2: Number.NaN } };
    const out = solvePoints(toEngine(f).points);
    expect(out.ok).toBe(true);
  });

  it('a field that is NaN is reported by the engine against its field, and issueField says where on the form', () => {
    const f = act(defaultCase(), { type: 'geometry', patch: { span: Number.NaN } });
    const out = solveHanging(toEngine(f).hanging);
    expect(out.ok).toBe(false);
    if (out.ok) return;
    expect(out.issues).toEqual([{ code: 'number', field: 'L' }]);
    expect(issueField(out.issues[0], f)).toBe('span');
    const g = act(defaultCase(), { type: 'loads', patch: { weightFrom: 'section' } }, { type: 'section', patch: { diameter: Number.NaN } });
    const out2 = solveHanging(toEngine(g).hanging);
    expect(out2.ok).toBe(false);
    if (!out2.ok) expect(issueField(out2.issues[0], g)).toBe('section');
    const p = act(defaultCaseFor('points'), { type: 'point-patch', id: 2, patch: { x: 500 } });
    const out3 = solvePoints(toEngine(p).points);
    expect(out3.ok).toBe(false);
    if (!out3.ok) expect(issueField(out3.issues[0], p)).toEqual({ point: 2 });
  });
});

describe('the address', () => {
  it('the key is g; an address begins with a check, then version 1 and nine fields; the default is short', () => {
    expect(CABLE_SAG_KEY).toBe('g');
    for (const mode of MODES) {
      const s = encode(defaultCaseFor(mode));
      const body = s.slice(s.indexOf(';') + 1);
      expect(body.startsWith('1;')).toBe(true);
      expect(body.split(';')).toHaveLength(9);
      expect(s.length).toBeLessThan(500);
      expect(s).toMatch(/^[A-Za-z0-9;,_.\-+]+$/);
    }
    expect(encodeCableSag).toBe(encode);
    expect(decodeCableSag).toBe(decode);
  });

  it('round trips the defaults and the edited defaults exactly', () => {
    for (const mode of MODES) {
      for (const units of ['us', 'si'] as const) {
        const f = defaultCaseFor(mode, units);
        expect(decode(encode(f))).toEqual(f);
      }
    }
    const edited = act(defaultCaseFor('points'), { type: 'point-remove', id: 2 }, { type: 'point-add' });
    expect(decode(encode(edited))).toEqual(normal(edited));
  });

  it('round trips thousands of random forms exactly (NaN, infinities, −0.5 and all)', () => {
    const r = rng(52);
    for (let n = 0; n < 4000; n++) {
      const f = randomForm(r);
      const s = encode(f);
      expect(s.length).toBeLessThanOrEqual(MAX_LINK);
      expect(decode(s), s).toEqual(normal(f));
    }
  });

  it('the longest address a form can write is under the cap', () => {
    const w = -1.2345678e-100; // 15 characters, the longest a field writes besides an exponent of three digits
    const numbers = (o: object) => Object.fromEntries(Object.entries(o).map(([k, v]) => [k, typeof v === 'number' ? w : v]));
    const f = defaultCase();
    const g = {
      ...f,
      ...numbers(f),
      state: numbers(f.state),
      points: Array.from({ length: MAX_POINT_LOADS }, (_, i) => ({ id: i + 1, x: w, P: w })),
      nextId: MAX_POINT_LOADS + 1,
    } as CableSagForm;
    const s = encode(g);
    expect(s.length).toBeLessThan(MAX_LINK);
    expect(decode(s)).toEqual(normal(g));
  });

  it('is null for anything that is not a link: cut short, a character more/less/changed, another version, other shapes', () => {
    const s = encode(defaultCase());
    for (let i = 0; i < s.length; i++) expect(decode(s.slice(0, i)), `cut at ${i}`).toBeNull();
    for (let i = 0; i < s.length; i++) {
      expect(decode(s.slice(0, i) + s.slice(i + 1)), `deleted ${i}`).toBeNull();
      expect(decode(s.slice(0, i) + 'x' + s.slice(i)), `inserted ${i}`).toBeNull();
      const swapped = s[i] === '7' ? '8' : '7';
      if (s[i] !== swapped) expect(decode(s.slice(0, i) + swapped + s.slice(i + 1)), `changed ${i}`).toBeNull();
    }
    // a well-sealed body that is wrong: its check is right, so only the reader can refuse it
    const seal = (body: string) => `${checkOf(body)};${body}`;
    const body = s.slice(s.indexOf(';') + 1);
    const good = body.split(';');
    expect(decode(seal(body))).not.toBeNull();
    expect(decode(seal(['2', ...good.slice(1)].join(';')))).toBeNull(); // version
    expect(decode(seal(good.slice(0, 8).join(';')))).toBeNull(); // too few fields
    expect(decode(seal([...good, 'x'].join(';')))).toBeNull(); // too many
    expect(decode(seal([good[0], 'q,us', ...good.slice(2)].join(';')))).toBeNull(); // mode
    expect(decode(seal([good[0], 'h,xx', ...good.slice(2)].join(';')))).toBeNull(); // units
    expect(decode(seal([good[0], good[1], '1', ...good.slice(3)].join(';')))).toBeNull(); // geometry has one number
    expect(decode(seal([good[0], good[1], good[2], good[3].replace(/^s/, 'z'), ...good.slice(4)].join(';')))).toBeNull(); // material
    expect(decode(seal([good[0], good[1], good[2], good[3].replace(/,1$/, ',2'), ...good.slice(4)].join(';')))).toBeNull(); // elastic flag
    expect(decode(seal([good[0], good[1], good[2], good[3], good[4].replace(/^n/, 'q'), ...good.slice(5)].join(';')))).toBeNull(); // weight from
    expect(decode(seal([good[0], good[1], good[2], good[3], good[4], good[5].replace(/^s/, 'q'), ...good.slice(6)].join(';')))).toBeNull(); // known
    expect(decode(seal([...good.slice(0, 7), '1,2,3', ...good.slice(8)].join(';')))).toBeNull(); // a point row of three numbers
    expect(decode(seal([...good.slice(0, 7), '1', ...good.slice(8)].join(';')))).toBeNull(); // a point row of one
    expect(decode(seal([...good.slice(0, 7), Array.from({ length: 13 }, () => '1,2').join('_'), ...good.slice(8)].join(';')))).toBeNull(); // 13 points
    expect(decode(seal([...good.slice(0, 8), 'q,1,2,3,4'].join(';')))).toBeNull(); // points known
    expect(decode(seal(body.replace('100,0', '1e5x,0')))).toBeNull(); // a number in the wrong notation
    expect(decode(seal(body.replace('100,0', '+100,0')))).toBeNull();
    expect(decode(seal(body.replace('100,0', '0x10,0')))).toBeNull();
    expect(decode(seal(body.replace('100,0', '1_0,0')))).toBeNull();
    expect(decode(seal(body.replace('100,0', '.5,0')))).toBeNull();
    expect(decode(seal(body.replace('100,0', ',0')))).toBeNull();
    expect(decode('')).toBeNull();
    expect(decode(';')).toBeNull();
    expect(decode(null as unknown as string)).toBeNull();
    expect(decode(undefined as unknown as string)).toBeNull();
    expect(decode(42 as unknown as string)).toBeNull();
    expect(decode('x'.repeat(MAX_LINK + 1))).toBeNull();
    // an address of the right check with no points reads: zero loads is a form
    const none = decode(seal([...good.slice(0, 7), '', good[8]].join(';')));
    expect(none?.points).toEqual([]);
    // the check is the first calculator's, and a link of another calculator is not ours
    expect(decode('1;h,us;100,0')).toBeNull();
  });

  it('fuzz: a hundred thousand strings never throw and almost none read', () => {
    const r = rng(53);
    const alphabet = '0123456789;,_.-+eE abcdefghijklmnopqrstuvwxyz';
    const valid = encode(defaultCase());
    let reads = 0;
    for (let n = 0; n < 100000; n++) {
      let s: string;
      const kind = n % 4;
      if (kind === 0) {
        s = Array.from({ length: Math.floor(r() * 80) }, () => alphabet[Math.floor(r() * alphabet.length)]).join('');
      } else if (kind === 1) {
        // a valid link with a few characters damaged
        const chars = valid.split('');
        for (let k = 0; k < 1 + Math.floor(r() * 3); k++) chars[Math.floor(r() * chars.length)] = alphabet[Math.floor(r() * alphabet.length)];
        s = chars.join('');
      } else if (kind === 2) {
        // a damaged body that is sealed again: the reader alone must refuse or accept it
        const chars = valid.slice(valid.indexOf(';') + 1).split('');
        for (let k = 0; k < 1 + Math.floor(r() * 3); k++) chars[Math.floor(r() * chars.length)] = alphabet[Math.floor(r() * alphabet.length)];
        const body = chars.join('');
        s = `${checkOf(body)};${body}`;
      } else {
        s = String.fromCharCode(...Array.from({ length: Math.floor(r() * 40) }, () => Math.floor(r() * 65536)));
      }
      let out: CableSagForm | null = null;
      expect(() => {
        out = decode(s);
      }).not.toThrow();
      if (out) reads++;
    }
    // the fuzz is not vacuous: some damaged-but-sealed bodies do read (a damaged field that is still a field), and most do not
    expect(reads).toBeGreaterThan(100);
    expect(reads).toBeLessThan(40000);
  });
});
