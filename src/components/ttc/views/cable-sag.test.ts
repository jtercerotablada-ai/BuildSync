import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { spanPage } from '@/lib/calc/beam/span-page-strings';
import { spanUi } from '@/lib/calc/beam/span-strings';
import { beamStrings } from '@/lib/calc/beam/strings';
import { cableSagPage } from '@/lib/calc/cable-sag/page-strings';
import { cableSagUi } from '@/lib/calc/cable-sag/strings';
import { solveHanging, solvePoints, solveState } from '@/lib/calc/cable-sag/engine';
import {
  MAX_FACTOR_ROWS,
  MAX_POINT_LOADS,
  MAX_TABLE_ROWS,
  PARABOLA_TOLERANCE,
  STRAIN_WARNING,
  type HangingInput,
  type PointLoad,
  type PointsInput,
  type StateInput,
} from '@/lib/calc/cable-sag/types';
import { continuousPage } from '@/lib/calc/continuous/page-strings';
import { continuousUi } from '@/lib/calc/continuous/strings';
import { shaftPage } from '@/lib/calc/shaft/page-strings';
import { trussPage } from '@/lib/calc/truss/page-strings';
import { trussUi } from '@/lib/calc/truss/strings';
import { calculatorFamilies } from '@/lib/ttc/calculators';
import { openCalculatorPaths } from '@/lib/ttc/calculator-paths';
import type { Lang } from '@/lib/ttc/i18n';
import { DESCRIPTION_LIMIT_PX, TITLE_BUDGET_PX, descriptionPx, titlePx } from '@/lib/ttc/serp';

/**
 * The cable sag calculator's PAGE words (lib/calc/cable-sag/page-strings.ts),
 * held to the engine and to the other calculators' pages. The tool's own
 * behaviour is tested where it lives (lib/calc/cable-sag, calc/cable-sag); this
 * file does not render the form.
 */

const LANGS: Lang[] = ['en', 'es'];

/** The page's address; CableSagView.tsx exports the same constant (read as text, so that this file does not need the form). */
const CABLE_SAG_PATH = '/resources/cable-sag-pretension';

function leaves(value: unknown, path = ''): [string, string][] {
  if (typeof value === 'string') return [[path, value]];
  if (Array.isArray(value)) return value.flatMap((v, i) => leaves(v, `${path}[${i}]`));
  if (value && typeof value === 'object') return Object.entries(value).flatMap(([k, v]) => leaves(v, path ? `${path}.${k}` : k));
  return [];
}
const wordsOf = (t: string) => t.toLowerCase().replace(/[^\p{L}\p{N}\s]/gu, ' ').split(/\s+/).filter(Boolean);
const runsOf = (t: string) => {
  const w = wordsOf(t);
  return w.length < 6 ? [] : Array.from({ length: w.length - 5 }, (_, i) => w.slice(i, i + 6).join(' '));
};
const sharedRuns = (ours: string[], theirs: string[]) => {
  const known = new Set(theirs.flatMap(runsOf));
  return [...new Set(ours.flatMap(runsOf).filter((run) => known.has(run)))];
};
const LEGAL = /^(disclaimer\.|sheet\.)/;

const hang = (i: HangingInput) => {
  const out = solveHanging(i);
  if (!out.ok) throw new Error(JSON.stringify(out.issues));
  return out;
};
const state = (i: StateInput) => {
  const out = solveState(i);
  if (!out.ok) throw new Error(JSON.stringify(out.issues));
  return out;
};
const points = (i: PointsInput) => {
  const out = solvePoints(i);
  if (!out.ok) throw new Error(JSON.stringify(out.issues));
  return out;
};
const near = (got: number, want: number, tol = 1e-9) => {
  expect(Math.abs(got - want), `got ${got}, want ${want}`).toBeLessThanOrEqual(tol * Math.max(Math.abs(want), 1e-300));
};

/** The bending moment at x of the point loads on a simply supported beam of span L: what the page says H times the sag equals. */
const beamMoment = (loads: PointLoad[], L: number, x: number) => {
  const left = loads.reduce((s, l) => s + (l.P * (L - l.x)) / L, 0);
  return left * x - loads.filter((l) => l.x < x).reduce((s, l) => s + l.P * (x - l.x), 0);
};
/** The beam's shear just right of x. */
const beamShear = (loads: PointLoad[], L: number, x: number) => loads.reduce((s, l) => s + (l.P * (L - l.x)) / L, 0) - loads.filter((l) => l.x <= x).reduce((s, l) => s + l.P, 0);

describe('cable sag page: the two cases it gives to check by hand', () => {
  it('one load P at mid-span, a sag d under it: H = PL/(4d), a vertical component P/2 in each segment, T = √(H² + (P/2)²)', () => {
    const L = 60;
    const d = 6;
    const P = 20;
    const out = points({ L, h: 0, loads: [{ x: L / 2, P }], known: { kind: 'sag', x: L / 2, value: d } });
    const H = (P * L) / (4 * d);
    near(out.H, H, 1e-12);
    for (const segment of out.segments) {
      near(Math.abs(segment.vertical), P / 2, 1e-12);
      near(segment.tension, Math.sqrt(H ** 2 + (P / 2) ** 2), 1e-12);
    }
    near(out.reaction.A, P / 2, 1e-12);
    near(out.reaction.B, P / 2, 1e-12);
  });

  it('a level catenary with L/(2a) = 1: d = a(cosh 1 − 1), S = 2a sinh 1, T_max = wa cosh 1', () => {
    const a = 10;
    const w = 0.5;
    const out = hang({ L: 2 * a, h: 0, q: 0, w, EA: null, known: { kind: 'H', value: w * a } });
    expect(out.family).toBe('catenary');
    near(out.exact.sagMid, a * (Math.cosh(1) - 1), 1e-12);
    near(out.exact.length, 2 * a * Math.sinh(1), 1e-12);
    near(out.exact.tension.max, w * a * Math.cosh(1), 1e-12);
  });
});

describe('cable sag page: what the notes say of the parabola, the engine does', () => {
  it('level: H = qL²/(8d), reactions qL/2, T_max = √(H² + (qL/2)²), and the length S = L(1 + 8/3 (d/L)² − 32/5 (d/L)⁴ + …)', () => {
    for (const [L, d, q] of [[100, 10, 0.1], [250, 4, 0.02], [40, 5, 1.3]] as const) {
      const out = hang({ L, h: 0, q, w: 0, EA: null, known: { kind: 'sag-mid', value: d } });
      const H = (q * L * L) / (8 * d);
      near(out.exact.H, H, 1e-10);
      near(out.exact.reaction.A, (q * L) / 2, 1e-10);
      near(out.exact.tension.max, Math.sqrt(H ** 2 + (q * L / 2) ** 2), 1e-10);
    }
    const r = 0.05;
    const L = 100;
    const out = hang({ L, h: 0, q: 0.1, w: 0, EA: null, known: { kind: 'sag-mid', value: r * L } });
    const series = L * (1 + (8 / 3) * r ** 2 - (32 / 5) * r ** 4);
    // The next term of the series is (256/7)(d/L)⁶ of the span: here about 6e-7.
    expect(Math.abs(out.exact.length - series) / out.exact.length).toBeLessThan(1e-6);
    // The first term alone is off by the second: the page writes both.
    expect(Math.abs(out.exact.length - L * (1 + (8 / 3) * r ** 2))).toBeGreaterThan(Math.abs(out.exact.length - series));
  });

  it('inclined: the sag is vertical at mid-span, H = qL²/(8d) unchanged, the supports carry qL/2 ± Hh/L, T = √(H² + V²), and the lower one is negative for h > 4d', () => {
    const L = 100;
    const q = 0.2;
    const d = 8;
    for (const h of [0, 10, -10, 25, 31, 33]) {
      const out = hang({ L, h, q, w: 0, EA: null, known: { kind: 'sag-mid', value: d } });
      const H = (q * L * L) / (8 * d);
      near(out.exact.H, H, 1e-10);
      near(out.exact.sagMid, d, 1e-10);
      const high = (q * L) / 2 + (H * Math.abs(h)) / L;
      const low = (q * L) / 2 - (H * Math.abs(h)) / L;
      const [reactionHigh, reactionLow] = h >= 0 ? [out.exact.reaction.B, out.exact.reaction.A] : [out.exact.reaction.A, out.exact.reaction.B];
      near(reactionHigh, high, 1e-9);
      near(reactionLow, low, 1e-8);
      near(out.exact.tension.high, Math.sqrt(H ** 2 + high ** 2), 1e-9);
      near(out.exact.tension.low, Math.sqrt(H ** 2 + low ** 2), 1e-9);
      // The lower reaction is negative exactly when h is greater than 4d.
      if (Math.abs(h) > 4 * d + 1e-9) expect(reactionLow).toBeLessThan(0);
      if (Math.abs(h) < 4 * d - 1e-9) expect(reactionLow).toBeGreaterThan(0);
    }
  });
});

describe('cable sag page: what the notes say of the catenary, the engine does', () => {
  it('level: a = H/w, d = a(cosh(L/2a) − 1), S = 2a sinh(L/2a), T = H + wy, T_max = H + wd', () => {
    for (const [L, H, w] of [[100, 40, 0.5], [300, 12, 0.3], [60, 200, 1]] as const) {
      const a = H / w;
      const out = hang({ L, h: 0, q: 0, w, EA: null, known: { kind: 'H', value: H } });
      near(out.exact.sagMid, a * (Math.cosh(L / (2 * a)) - 1), 1e-11);
      near(out.exact.length, 2 * a * Math.sinh(L / (2 * a)), 1e-11);
      near(out.exact.tension.max, H + w * out.exact.sagMid, 1e-11);
      near(out.exact.tension.max, w * a * Math.cosh(L / (2 * a)), 1e-11);
      // Given the sag, the same a comes back: there is no closed form, and the engine finds it.
      const back = hang({ L, h: 0, q: 0, w, EA: null, known: { kind: 'sag-mid', value: out.exact.sagMid } });
      near(back.exact.H, H, 1e-9);
    }
  });

  it('on an inclined chord T = H + w·y holds at each support, y its height over the lowest point', () => {
    const out = hang({ L: 80, h: 12, q: 0, w: 0.4, EA: null, known: { kind: 'sag-mid', value: 5 } });
    expect(out.exact.vertex.inside).toBe(true);
    near(out.exact.tension.low, out.exact.H + 0.4 * (0 - out.exact.vertex.z), 1e-10);
    near(out.exact.tension.high, out.exact.H + 0.4 * (12 - out.exact.vertex.z), 1e-10);
  });

  it('the parabola and the catenary part by 1 % near a sag of 0.085 of the span, for a level cable under its own weight', () => {
    expect(PARABOLA_TOLERANCE).toBe(0.01);
    const at = (ratio: number) => {
      const out = hang({ L: 100, h: 0, q: 0, w: 0.3, EA: null, known: { kind: 'sag-mid', value: ratio * 100 } });
      return { worst: out.difference!.worst, noted: out.warnings.some((x) => x.code === 'parabola-differs') };
    };
    expect(at(0.08).noted).toBe(false);
    expect(at(0.09).noted).toBe(true);
    expect(Math.abs(at(0.085).worst - 0.01)).toBeLessThan(0.001);
    expect(at(0.03).worst).toBeLessThan(0.002);
  });

  it('with the weight and a load along the span together, the exact shape lies between the catenary and the parabola of q + w', () => {
    const both = hang({ L: 100, h: 0, q: 0.2, w: 0.2, EA: null, known: { kind: 'sag-mid', value: 12 } });
    expect(both.family).toBe('combined');
    expect(both.parabolic).not.toBeNull();
    // Same sag given: the exact H is the one of neither curve alone, and the parabola of q + w is the shallow approximation of it.
    const parabola = (0.4 * 100 * 100) / (8 * 12);
    near(both.parabolic!.H, parabola, 1e-9);
    expect(Math.abs(both.exact.H - parabola) / parabola).toBeLessThan(0.02);
    expect(both.exact.H).not.toBe(parabola);
  });
});

describe('cable sag page: elasticity and the change of state', () => {
  const EA = 5207;
  const L = 300;
  const q1 = 0.001608;
  const q2 = 0.002608;
  const run = (thermal: number, load2 = q2) =>
    state({ L, h: 0, EA, known: { kind: 'sag-mid', value: 6 }, state1: { q: q1, w: 0 }, state2: { q: load2, w: 0, thermal } });

  /** The cubic the page prints: (K/EA)H₂³ + (K − 1)H₂² − q₂²L²/24 = 0, K = (1 + αΔT)(1 + q₁²L²/(24H₁²))/(1 + H₁/EA). */
  const cubicRoot = (H1: number, thermal: number, load2: number) => {
    const K = ((1 + thermal) * (1 + (q1 * q1 * L * L) / (24 * H1 * H1))) / (1 + H1 / EA);
    const f = (H: number) => (K / EA) * H ** 3 + (K - 1) * H ** 2 - (load2 * load2 * L * L) / 24;
    let [lo, hi] = [1e-9, 1e9];
    for (let n = 0; n < 300; n++) {
      const mid = (lo + hi) / 2;
      if (f(mid) < 0) lo = mid;
      else hi = mid;
    }
    return (lo + hi) / 2;
  };

  it('the cubic in H₂ gives the exact answer to a few parts in a thousand, with load and temperature changing', () => {
    for (const [thermal, load2] of [[-2.6e-4, q2], [0, q2], [3e-4, q2], [0, q1], [-1e-3, q1 * 0.5], [4e-4, q2 * 2]] as const) {
      const out = run(thermal, load2);
      const H1 = out.exact.state1.H;
      const root = cubicRoot(H1, thermal, load2);
      expect(Math.abs(root - out.exact.state2.H) / out.exact.state2.H, `${thermal} ${load2}`).toBeLessThan(2e-3);
    }
  });

  it('a heavier load or a lower temperature raises H; a lighter load or a higher temperature lowers it', () => {
    const base = run(0, q1);
    near(base.ratioH, 1, 1e-9);
    expect(run(0, q2).ratioH).toBeGreaterThan(1);
    expect(run(-3e-4, q1).ratioH).toBeGreaterThan(1);
    expect(run(0, q1 / 2).ratioH).toBeLessThan(1);
    expect(run(3e-4, q1).ratioH).toBeLessThan(1);
  });

  it('the unstressed length changes only with temperature: L₀₂ = L₀₁(1 + αΔT)', () => {
    for (const thermal of [-2.6e-4, 0, 5e-4]) {
      const out = run(thermal);
      near(out.exact.state2.unstretched / out.exact.state1.unstretched, 1 + thermal, 1e-9);
      near(out.ratioLength, 1 + thermal, 1e-12);
    }
  });

  it('an element ds becomes ds(1 + T/EA): the stretched over the unstretched length lies between the extreme 1 + T/EA of the cable', () => {
    const out = hang({ L: 300, h: 0, q: 0.01, w: 0, EA: 800, known: { kind: 'sag-mid', value: 6 } });
    const ratio = out.exact.length / out.exact.unstretched;
    expect(ratio).toBeGreaterThan(1 + out.exact.tension.min / 800);
    expect(ratio).toBeLessThan(1 + out.exact.tension.max / 800);
    near(out.exact.elongation, out.exact.length - out.exact.unstretched, 1e-12);
  });

  it('the tables hold up to 41 rows of temperature and 21 of load factor, and the page says so; the strain warning is at 1 %', () => {
    expect([MAX_TABLE_ROWS, MAX_FACTOR_ROWS, MAX_POINT_LOADS, STRAIN_WARNING]).toEqual([41, 21, 12, 0.01]);
    const rows = (n: number) => Array.from({ length: n }, (_, i) => -1e-4 * i);
    const ok = solveState({ L, h: 0, EA, known: { kind: 'sag-mid', value: 6 }, state1: { q: q1, w: 0 }, state2: { q: q2, w: 0, thermal: 0 }, sweep: { thermal: rows(41) } });
    expect(ok.ok).toBe(true);
    const over = solveState({ L, h: 0, EA, known: { kind: 'sag-mid', value: 6 }, state1: { q: q1, w: 0 }, state2: { q: q2, w: 0, thermal: 0 }, sweep: { thermal: rows(42) } });
    expect(over.ok).toBe(false);
    for (const [lang, re] of [
      ['en', /Up to 12 point loads, .* up to 41 rows of temperature and 21 rows of load factor/],
      ['es', /Hasta 12 cargas puntuales, .* hasta 41 filas de temperatura y 21 de factor de carga/],
    ] as const) {
      expect(cableSagPage[lang].limits.items.filter((x) => re.test(x))).toHaveLength(1);
    }
    const strained = hang({ L: 100, h: 0, q: 0.1, w: 0, EA: 20, known: { kind: 'sag-mid', value: 5 } });
    expect(strained.exact.strain!).toBeGreaterThan(STRAIN_WARNING);
    expect(strained.warnings.map((x) => x.code)).toContain('strain-high');
  });

  it('a rigid cable cooled until it is shorter than its chord is refused', () => {
    const out = solveState({ L, h: 0, EA: null, known: { kind: 'sag-mid', value: 6 }, state1: { q: q1, w: 0 }, state2: { q: q2, w: 0, thermal: -0.01 } });
    expect(out.ok).toBe(false);
    if (!out.ok) expect(out.issues.map((i) => i.code)).toContain('state2-too-short');
  });
});

describe('cable sag page: the cable with point loads', () => {
  const loads: PointLoad[] = [{ x: 8, P: 3 }, { x: 22, P: 7 }, { x: 35, P: 4 }, { x: 52, P: 6 }];

  it('H s(x) = M(x): one sag fixes H = M(x₀)/s₀, whether or not a load sits at x₀; the sags are M/H and the tension is H√(1 + slope²)', () => {
    for (const h of [0, 9, -14]) {
      const L = 60;
      for (const x0 of [22, 30, 47]) {
        const s0 = 7;
        const out = points({ L, h, loads, known: { kind: 'sag', x: x0, value: s0 } });
        const H = beamMoment(loads, L, x0) / s0;
        near(out.H, H, 1e-11);
        for (const joint of out.joints) near(joint.sag, beamMoment(loads, L, joint.x) / H, 1e-9);
        out.segments.forEach((segment, k) => {
          const xm = (out.joints[k].x + out.joints[k + 1].x) / 2;
          // The slope: that of the chord less the beam's shear over H.
          near(segment.slope, h / L - beamShear(loads, L, xm) / H, 1e-9);
          near(segment.tension, H * Math.sqrt(1 + segment.slope ** 2), 1e-10);
        });
      }
    }
  });

  it('the horizontal component is H in every segment, and the largest tension is next to a support when every load is downward', () => {
    const out = points({ L: 60, h: 6, loads, known: { kind: 'sag', x: 30, value: 8 } });
    for (const segment of out.segments) near(segment.tension * Math.cos(Math.atan(segment.slope)), out.H, 1e-10);
    expect([0, out.segments.length - 1]).toContain(out.tensionMax.segment);
    near(out.tensionMax.value, Math.max(...out.segments.map((s) => s.tension)), 1e-12);
  });

  it('H, or the largest tension, can be given in place of a sag', () => {
    const base = points({ L: 60, h: 0, loads, known: { kind: 'sag', x: 30, value: 8 } });
    const byH = points({ L: 60, h: 0, loads, known: { kind: 'H', value: base.H } });
    const byT = points({ L: 60, h: 0, loads, known: { kind: 'T-max', value: base.tensionMax.value } });
    near(byH.length, base.length, 1e-10);
    near(byT.H, base.H, 1e-9);
  });

  it('its limits are the engine’s: 12 loads, and a load strictly between the supports', () => {
    const many = Array.from({ length: 13 }, (_, i) => ({ x: 1 + i * 4, P: 1 }));
    const out = solvePoints({ L: 60, h: 0, loads: many, known: { kind: 'H', value: 20 } });
    expect(out.ok).toBe(false);
    if (!out.ok) expect(out.issues.map((i) => i.code)).toContain('too-many-loads');
    const edge = solvePoints({ L: 60, h: 0, loads: [{ x: 60, P: 5 }], known: { kind: 'H', value: 20 } });
    expect(edge.ok).toBe(false);
  });
});

describe('cable sag page: the words', () => {
  const en = leaves(cableSagPage.en);
  const es = leaves(cableSagPage.es);
  const OTHERS = (lang: Lang) => [beamStrings[lang].page, spanPage[lang], continuousPage[lang], shaftPage[lang], trussPage[lang]];

  it('says the same things in both languages, and leaves nothing blank', () => {
    expect(es.map(([p]) => p)).toEqual(en.map(([p]) => p));
    for (const [path, s] of [...en, ...es]) expect(s.trim().length, path).toBeGreaterThan(0);
    const parts = (page: unknown) => leaves(page).map(([p]) => p.replace(/\[\d+\]/g, '[]'));
    expect([...new Set(parts(cableSagPage.en))]).toEqual([...new Set(parts(beamStrings.en.page))]);
  });

  it('the Spanish is Spanish: no sentence is the English one left in place, no grouping comma, “usted”', () => {
    const same = en.filter(([, s], i) => s === es[i][1] && s.split(/\s+/).length > 3).map(([path]) => path);
    expect(same).toEqual([]);
    for (const [path, s] of es) {
      expect(s, path).not.toMatch(/\d,\d{3}(?!\d)/);
      expect(s, path).not.toMatch(/\b(introduces|escribes|eliges|incluyes|pides|puedes|tienes|quieres|tu|tus|ti|te)\b/);
    }
    // The formulas are the same in both: a case's symbols are not translated.
    const formulas = (s: string) =>
      s.match(/H = qL²\/\(8d\)|T_max = √\(H² \+ \(qL\/2\)²\)|S = L\(1 \+ 8\/3 \(d\/L\)² − 32\/5 \(d\/L\)⁴ \+ …\)|qL\/2 [+−] Hh\/L|y = a\(cosh\(x\/a\) − 1\)|a = H\/w|d = a\(cosh\(L\/2a\) − 1\)|S = 2a sinh\(L\/2a\)|T = wa cosh\(x\/a\) = H \+ wy|T_max = H \+ wd|H z″ = q \+ w√\(1 \+ z′²\)|L₀₂ = L₀₁\(1 \+ αΔT\)|\(K\/EA\)H₂³ \+ \(K − 1\)H₂² − q₂²L²\/24 = 0|H = PL\/\(4d\)|T = √\(H² \+ \(P\/2\)²\)|d = a\(cosh 1 − 1\)|S = 2a sinh 1|T_max = wa cosh 1|H s\(x\) = M\(x\)|H = M\(x₀\)\/s₀|T = H√\(1 \+ pendiente²\)|T = H√\(1 \+ slope²\)/g) ?? [];
    const norm = (list: string[]) => list.map((f) => f.replace('pendiente', 'slope'));
    en.forEach(([path, s], i) => expect(norm(formulas(es[i][1])), path).toEqual(norm(formulas(s))));
    expect(en.flatMap(([, s]) => formulas(s)).length).toBeGreaterThanOrEqual(20);
  });

  it('names no other company’s product, no price, no date, no standard, no verdict', () => {
    for (const [path, s] of [...en, ...es]) {
      expect(s, path).not.toMatch(/skyciv|ftool|sap2000|etabs|robot|risa|staad|autodesk|enercalc|clearcalcs/i);
      expect(s, path).not.toMatch(/\bfree\b|\bgratis\b|\bgratuit|\$|\bprice\b|\bprecio\b|\b20\d\d\b/i);
      expect(s, path).not.toMatch(/Civil\s*&\s*Structural/i);
      expect(s, path).not.toMatch(/\b(ACI|AISC|ASCE|ASME|ANSI|ISO|DIN|IBC|Eurocode|Eurocódigo|LRFD|ASD|NDS|AWS|PTI|ASTM)\b/);
      if (LEGAL.test(path)) continue;
      expect(s, path).not.toMatch(/\b(ok|okay|pass|passes|passed|fail|fails|failed|adequate|inadequate|sufficient|insufficient|enough|acceptable|complies|satisf\w*|safe|safely|unsafe|allowable|permissible|recommended|verified|reliable|rely)\b/i);
      expect(s, path).not.toMatch(/\b(cumple|cumplen|no cumple|falla|fallan|aprobad\w*|suficiente|insuficiente|adecuad\w*|inadecuad\w*|aceptable|basta|segur[oa]|satisf\w*|verifica|admisible|permisible|recomendad\w*|confiable)\b/i);
    }
  });

  it('writes no figure but those of its formulas, its limits and the one percent', () => {
    const written = (lang: Lang) =>
      leaves(cableSagPage[lang])
        .filter(([path]) => !LEGAL.test(path))
        .map(([, s]) => s)
        .join(' ');
    for (const lang of LANGS) {
      const numbers = written(lang).match(/\d+(\.\d+)?/g) ?? [];
      // 0 and 1 are the zero of a sag and the 1 of formulas; 2, 3, 4, 5, 8, 24 and 32 are in the formulas; 12, 21 and 41 are the limits;
      // 0.085 is the sag at which the parabola parts from the catenary by 1 %, held to the engine above.
      expect([...new Set(numbers)].sort()).toEqual(['0', '0.085', '1', '12', '2', '21', '24', '3', '32', '4', '41', '5', '8']);
    }
  });

  it('a cable page says cable: it names the catenary and the parabola, the pretension and the funicular polygon', () => {
    expect(en.filter(([, s]) => /\bcables?\b/i.test(s)).length).toBeGreaterThan(15);
    expect(es.filter(([, s]) => /\bcables?\b/i.test(s)).length).toBeGreaterThan(15);
    const all = (page: Lang) => JSON.stringify(cableSagPage[page]);
    for (const re of [/catenary/i, /parabola/i, /pretension/i, /funicular polygon/i, /change of state/i, /point loads/i, /horizontal tension/i]) expect(all('en')).toMatch(re);
    for (const re of [/catenaria/i, /parábola/i, /pretensión/i, /polígono funicular/i, /cambio de estado/i, /cargas puntuales/i, /tensión horizontal/i, /flecha/i]) expect(all('es')).toMatch(re);
    // The search words are in the title and the description, each in its own language.
    for (const re of [/cable/i, /sag/i, /pretension/i, /catenary/i]) expect(cableSagPage.en.title + cableSagPage.en.description).toMatch(re);
    for (const re of [/cable/i, /flecha/i, /pretensión/i, /catenaria/i]) expect(cableSagPage.es.title + cableSagPage.es.description).toMatch(re);
    expect(cableSagPage.en.description).toMatch(/point loads/);
    expect(cableSagPage.en.description).toMatch(/temperature/);
  });

  it('says what it leaves out, each by name: bending stiffness, wind, saddles, the one-percent strain, the two cables of a tension, the limits', () => {
    const assumes = (lang: Lang) => cableSagPage[lang].assumes.items;
    const limits = (lang: Lang) => cableSagPage[lang].limits.items;
    const NOT: [(l: Lang) => string[], RegExp, RegExp][] = [
      [assumes, /^A perfectly flexible cable: it has no bending stiffness/, /^Un cable perfectamente flexible: no tiene rigidez a la flexión/],
      [assumes, /Wind, a lateral load, vibration/, /El viento, una carga lateral, la vibración/],
      [assumes, /A saddle, a pulley, a clamp with a radius/, /Una silla, una polea, una abrazadera con radio/],
      [assumes, /effective modulus of a wire rope sits well under that of the steel/, /módulo efectivo resulta muy inferior al del acero/],
      [assumes, /Stretch from the first loading of a new rope, creep and relaxation are not modelled/, /estiramiento de la primera carga de un cable nuevo, la fluencia y la relajación no están modelados/],
      [limits, /^It gives tensions, shapes and lengths and stops there/, /^Da tensiones, formas y longitudes y se detiene ahí/],
      [limits, /fits two cables, one taut and one slack/, /la tienen dos cables, uno tirante y otro flojo/],
      [limits, /The change of state is for a cable under its own weight/, /El cambio de estado es para un cable bajo su peso/],
      [limits, /no elasticity and no temperature/, /no tiene elasticidad ni temperatura/],
      [limits, /The three modes are separate cases of one form/, /Los tres modos son casos separados de un mismo formulario/],
    ];
    for (const [list, inEnglish, inSpanish] of NOT) {
      expect(list('en').filter((x) => inEnglish.test(x)), String(inEnglish)).toHaveLength(1);
      expect(list('es').filter((x) => inSpanish.test(x)), String(inSpanish)).toHaveLength(1);
    }
    expect(limits('en')).toHaveLength(limits('es').length);
    expect(assumes('en')).toHaveLength(assumes('es').length);
  });

  it('the straight cable is the catalogue’s other calculator, named as the catalogue names it', () => {
    const other = calculatorFamilies.flatMap((f) => f.items).find((i) => i.name.en === 'Cable tension and elongation')!;
    expect(other).toBeDefined();
    expect(JSON.stringify(cableSagPage.en.assumes)).toContain(other.name.en);
    expect(JSON.stringify(cableSagPage.es.assumes)).toContain(other.name.es);
  });

  it('the legal words are the first calculator’s own, and the credit names this calculator', () => {
    for (const lang of LANGS) {
      const ours = cableSagPage[lang];
      const first = beamStrings[lang].page;
      expect(ours.disclaimer).toBe(first.disclaimer);
      expect(ours.sheet.kind).toBe(first.sheet.kind);
      expect(ours.sheet.margin).toBe(first.sheet.margin);
      for (const key of ['{firm}', '{address}']) expect(ours.sheet.credit, `${lang} ${key}`).toContain(key);
      for (const other of OTHERS(lang)) expect(ours.sheet.credit).not.toBe(other.sheet.credit);
      expect(ours.sheet.credit).toMatch(lang === 'en' ? /cable sag calculator/ : /calculadora de flecha de cables/);
    }
  });

  it('no sentence of the other calculators’ pages, nor a line of the catalogue, is said again here, beyond the legal words', () => {
    const rows = calculatorFamilies.flatMap((f) => f.items);
    for (const lang of LANGS) {
      const ours = leaves(cableSagPage[lang]).filter(([path]) => !LEGAL.test(path));
      const theirs = [...OTHERS(lang).flatMap((page) => leaves(page)), ...leaves(beamStrings[lang].ui), ...leaves(spanUi[lang]), ...leaves(continuousUi[lang]), ...leaves(trussUi[lang])].map(([, s]) => s);
      // The form's own words (strings.ts) are another hand's: a sentence said in both is said twice on one page.
      const form = leaves(cableSagUi[lang]).map(([, s]) => s);
      for (const [path, s] of ours) {
        expect(sharedRuns([s], theirs), `${lang} ${path}`).toEqual([]);
        // The signs and the facts are the form's own conventions, written in the notes on purpose: they may agree word for word.
        if (!/^(signs|facts)/.test(path)) expect(sharedRuns([s], form), `${lang} ${path} (form)`).toEqual([]);
        expect(sharedRuns([s], rows.map((r) => r.does[lang])), `${lang} ${path}`).toEqual([]);
      }
      expect(sharedRuns([cableSagPage[lang].disclaimer.body], theirs).length).toBeGreaterThan(20);
    }
  });

  it('the view declares the same address', () => {
    expect(readFileSync(join(__dirname, 'CableSagView.tsx'), 'utf8')).toContain(`CABLE_SAG_PATH = '${CABLE_SAG_PATH}'`);
  });

  it('the h1 begins with the catalogue’s name for the row, which links here', () => {
    const row = calculatorFamilies.flatMap((f) => f.items).find((i) => i.href === CABLE_SAG_PATH)!;
    expect(row).toBeDefined();
    expect(openCalculatorPaths).toContain(CABLE_SAG_PATH);
    for (const lang of LANGS) expect(cableSagPage[lang].h1.startsWith(row.name[lang]), lang).toBe(true);
  });

  it('a search result fits: the title and the description are within their pixel budgets', () => {
    for (const lang of LANGS) {
      expect(titlePx(cableSagPage[lang].title), lang).toBeLessThanOrEqual(TITLE_BUDGET_PX);
      expect(descriptionPx(cableSagPage[lang].description), lang).toBeLessThanOrEqual(DESCRIPTION_LIMIT_PX);
    }
  });
});
