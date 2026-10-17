import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { spanPage } from '@/lib/calc/beam/span-page-strings';
import { spanUi } from '@/lib/calc/beam/span-strings';
import { beamStrings } from '@/lib/calc/beam/strings';
import { cablePage } from '@/lib/calc/cable/page-strings';
import { areaOfDiameter, solveDrum, solveLoad, solvePull } from '@/lib/calc/cable/engine';
import type { CableSection, LoadInput, PullInput } from '@/lib/calc/cable/types';
import { continuousPage } from '@/lib/calc/continuous/page-strings';
import { continuousUi } from '@/lib/calc/continuous/strings';
import { shaftPage } from '@/lib/calc/shaft/page-strings';
import { trussPage } from '@/lib/calc/truss/page-strings';
import { calculatorFamilies } from '@/lib/ttc/calculators';
import { openCalculatorPaths } from '@/lib/ttc/calculator-paths';
import type { Lang } from '@/lib/ttc/i18n';
import { DESCRIPTION_LIMIT_PX, TITLE_BUDGET_PX, descriptionPx, titlePx } from '@/lib/ttc/serp';

/**
 * The cable calculator's PAGE words (lib/calc/cable/page-strings.ts), held to
 * the engine and to the other calculators' pages. The tool's own behaviour is
 * tested where it lives (lib/calc/cable, calc/cable); this file does not
 * render the form, and reaches the form's words (cableUi) only for the one
 * comparison that needs them.
 */

const LANGS: Lang[] = ['en', 'es'];

/** The page's address; CableView.tsx exports the same constant (read as text, so that this file does not need the form). */
const CABLE_PATH = '/resources/cable-tension-elongation';

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
const DEG = Math.PI / 180;

const section = (A = 0.05, E = 29000, alpha = 6.5e-6): CableSection => ({ A, E, alpha });
const load = (input: Partial<LoadInput> & Pick<LoadInput, 'W' | 'legs'>): LoadInput => ({ H: 0, ...input });
const solvedLoad = (input: LoadInput) => {
  const out = solveLoad(input);
  if (!out.ok) throw new Error(JSON.stringify(out.issues));
  return out;
};
const solvedPull = (input: PullInput) => {
  const out = solvePull(input);
  if (!out.ok) throw new Error(JSON.stringify(out.issues));
  return out;
};
const solvedDrum = (input: Parameters<typeof solveDrum>[0]) => {
  const out = solveDrum(input);
  if (!out.ok) throw new Error(JSON.stringify(out.issues));
  return out;
};

describe('cable page: the cases it gives to check by hand', () => {
  it('a vertical cable holds W with T = W, σ = W/A, δ = WL/(AE); held at both ends and cooled it carries EAαΔT; two legs at θ carry W/(2 sin θ), which is W at 30°', () => {
    const W = 12;
    const L = 40;
    const s = section(0.3, 10000, 12.8e-6);
    const leg = { angle: 90, side: 'left' as const, length: L, section: s };
    const one = solvedLoad(load({ W, legs: [leg] }));
    const line = one.legs[0].line;
    expect(line.T).toBeCloseTo(W, 12);
    expect(line.stress).toBeCloseTo(W / s.A, 12);
    expect(line.elastic).toBeCloseTo((W * L) / (s.A * s.E), 12);
    // Cooled by 40 degrees: the force the held cable would carry (tension when it cools, compression when it warms).
    const cooled = solvedLoad(load({ W, dT: -40, legs: [leg] })).legs[0].line;
    expect(cooled.restrainedForce).toBeCloseTo(s.E * s.A * s.alpha * 40, 12);
    expect(cooled.thermal).toBeCloseTo(s.alpha * L * -40, 12);
    const warmed = solvedLoad(load({ W, dT: 40, legs: [leg] })).legs[0].line;
    expect(warmed.restrainedForce).toBeCloseTo(-s.E * s.A * s.alpha * 40, 12);
    expect(warmed.thermal).toBeCloseTo(s.alpha * L * 40, 12);
    expect(warmed.stretch).toBeCloseTo((W * L) / (s.A * s.E) + s.alpha * L * 40, 12);
    // The strain is σ/E.
    expect(line.strain).toBeCloseTo(line.stress / s.E, 15);
    // The symmetric sling.
    const pair = (theta: number) => load({ W, legs: [{ angle: theta, side: 'left', length: L, section: s }, { angle: theta, side: 'right', length: L, section: s }] });
    for (const theta of [20, 30, 45, 60, 80, 89]) {
      for (const l of solvedLoad(pair(theta)).legs) expect(l.line.T, `${theta}°`).toBeCloseTo(W / (2 * Math.sin(theta * DEG)), 9);
    }
    solvedLoad(pair(30)).legs.forEach((l) => expect(l.line.T).toBeCloseTo(W, 9));
    // Nearer to vertical, nearer to half of W; exactly vertical, two legs on one line, refused.
    expect(solvedLoad(pair(89.9)).legs[0].line.T).toBeCloseTo(W / 2, 4);
    const vertical = solveLoad(pair(90));
    expect(vertical.ok).toBe(false);
    if (!vertical.ok) expect(vertical.issues.map((i) => i.code)).toContain('parallel-legs');
    // …and the flatter, the more, without limit.
    expect(solvedLoad(pair(1)).legs[0].line.T).toBeGreaterThan(20 * W);
  });

  it('a single leg lies along the resultant of W and H: T = √(W² + H²), the angle an output, a positive H sloping the leg up to the left', () => {
    const out = solvedLoad(load({ W: 3, H: 4, legs: [{ angle: 10, side: 'right', length: 5, section: section() }] }));
    expect(out.legs[0].line.T).toBeCloseTo(5, 12);
    expect(out.legs[0].angle).toBeCloseTo(Math.atan2(3, 4) / DEG, 9);
    expect(out.legs[0].side).toBe('left');
  });

  it('the load point moves by −u·d = δ to first order, and the exact position is the intersection of the stretched circles', () => {
    const s = section(0.05, 29000, 0);
    const out = solvedLoad(load({ W: 2000, legs: [{ angle: 60, side: 'left', length: 120, section: s }, { angle: 60, side: 'right', length: 120, section: s }] }));
    const { linear, exact } = out.displacement;
    expect(exact).not.toBeNull();
    for (const leg of out.legs) {
      expect(-(leg.ux * linear.dx + leg.uy * linear.dy)).toBeCloseTo(leg.line.stretch as number, 12);
      // The distance from the anchor to the exact position is the stretched length.
      const d = Math.hypot(leg.anchorX - (exact?.dx as number), leg.anchorY - (exact?.dy as number));
      expect(d).toBeCloseTo(120 + (leg.line.stretch as number), 9);
    }
    expect(out.secondOrder).not.toBeNull();
    // A single leg moves along itself by its stretch, exactly.
    const one = solvedLoad(load({ W: 100, legs: [{ angle: 90, side: 'left', length: 50, section: s }] }));
    expect(one.displacement.exact?.dy).toBeCloseTo(-(one.legs[0].line.stretch as number), 12);
    expect(one.displacement.linear.dy).toBeCloseTo(one.displacement.exact?.dy as number, 12);
  });

  it('the pull against friction: T = (sin θ + μ cos θ)W/(cos φ + μ sin φ), from the two equilibrium equations', () => {
    const cases = [
      { W: 100, theta: 0, mu: 0.4, phi: 30 },
      { W: 250, theta: 15, mu: 0.3, phi: 10 },
      { W: 80, theta: 30, mu: 0.5, phi: -20 },
      { W: 80, theta: 45, mu: 0.2, phi: 25 },
      { W: 1, theta: 5, mu: 1.2, phi: 0 },
    ];
    for (const c of cases) {
      const out = solvedPull({ W: c.W, theta: c.theta, muS: c.mu, muK: c.mu, phi: c.phi, aOverG: null, travel: 'along' });
      const run = out.regimes.find((r) => r.id === 'run')!;
      expect(run.status).toBe('pull');
      const T = run.T as number;
      const th = c.theta * DEG;
      const ph = c.phi * DEG;
      expect(T).toBeCloseTo(((Math.sin(th) + c.mu * Math.cos(th)) * c.W) / (Math.cos(ph) + c.mu * Math.sin(ph)), 9);
      // The two equations the derivation starts from, satisfied by the answer.
      const N = c.W * Math.cos(th) - T * Math.sin(ph);
      expect(run.N).toBeCloseTo(N, 9);
      expect(T * Math.cos(ph) - c.W * Math.sin(th) - c.mu * N).toBeCloseTo(0, 9);
      expect(run.F).toBeCloseTo(c.mu * N, 9);
    }
  });

  it('with an acceleration a/g in the direction of travel, T = (sin θ + μ cos θ + a/g)W/(cos φ + μ sin φ); held back going the other way, T = (sin θ − μ cos θ − a/g)W/(cos φ − μ sin φ)', () => {
    const W = 120;
    const mu = 0.35;
    const phi = 15;
    const ph = phi * DEG;
    const a = 0.25;
    const th = 20 * DEG;
    const along = solvedPull({ W, theta: 20, muS: mu, muK: mu, phi, aOverG: a, travel: 'along' }).regimes.find((r) => r.id === 'accel')!;
    expect(along.T).toBeCloseTo(((Math.sin(th) + mu * Math.cos(th) + a) * W) / (Math.cos(ph) + mu * Math.sin(ph)), 9);
    // Newton: T cos φ − W sin θ − μN = (W/g)a.
    const Na = W * Math.cos(th) - (along.T as number) * Math.sin(ph);
    expect((along.T as number) * Math.cos(ph) - W * Math.sin(th) - mu * Na).toBeCloseTo(W * a, 9);
    // Going down the slope, held back by a cable up the slope (the block's travel is opposite to the pull).
    const b = 0.1;
    const t40 = 40 * DEG;
    const against = solvedPull({ W, theta: 40, muS: mu, muK: mu, phi, aOverG: b, travel: 'against' }).regimes.find((r) => r.id === 'accel')!;
    expect(against.status).toBe('pull');
    expect(against.T).toBeCloseTo(((Math.sin(t40) - mu * Math.cos(t40) - b) * W) / (Math.cos(ph) - mu * Math.sin(ph)), 9);
    const Nb = W * Math.cos(t40) - (against.T as number) * Math.sin(ph);
    // Block sliding down the slope with acceleration b: W sin θ − T cos φ − μN = (W/g)b.
    expect(W * Math.sin(t40) - (against.T as number) * Math.cos(ph) - mu * Nb).toBeCloseTo(W * b, 9);
  });

  it('the best angle is φ = arctan μ above the surface, whatever the slope, and the least pull there is (sin θ + μ cos θ)W/√(1 + μ²); on level ground T = μW/√(1 + μ²) and N = W/(1 + μ²)', () => {
    for (const [theta, mu, a] of [[0, 0.4, null], [0, 1.5, null], [25, 0.3, null], [10, 0.6, 0.2], [-5, 0.8, null]] as const) {
      const W = 90;
      const out = solvedPull({ W, theta, muS: mu, muK: mu, phi: 0, aOverG: a, travel: 'along' });
      const run = out.regimes.find((r) => r.id === (a === null ? 'run' : 'accel'))!;
      expect(run.optimum.phi).toBeCloseTo(Math.atan(mu) / DEG, 9);
      const th = theta * DEG;
      const least = ((Math.sin(th) + mu * Math.cos(th) + (a ?? 0)) * W) / Math.sqrt(1 + mu * mu);
      expect(run.optimum.closedForm).toBeCloseTo(least, 9);
      expect(run.optimum.T).toBeCloseTo(least, 9);
      // Nothing on the curve is lower than the least.
      const curve = out.curves.find((c) => c.regime === run.id)!;
      for (const p of curve.points) if (p.valid && p.T !== null) expect(p.T).toBeGreaterThanOrEqual(least - 1e-9);
      if (theta === 0 && a === null) {
        expect(run.optimum.N).toBeCloseTo(W / (1 + mu * mu), 9);
        expect(run.optimum.T).toBeCloseTo((mu * W) / Math.sqrt(1 + mu * mu), 9);
      }
    }
  });

  it('three things make the formula mean nothing: lift-off past the vertical cable, a cable that jams, a block that moves by itself', () => {
    // Lift-off: at rest or at constant speed N = 0 where the cable is vertical, θ + φ = 90°, whatever μ.
    for (const mu of [0.1, 0.9]) {
      const at = solvedPull({ W: 50, theta: 20, muS: mu, muK: mu, phi: 70, aOverG: null, travel: 'along' }).regimes[1];
      expect(at.N as number).toBeCloseTo(0, 9);
      expect(at.T).toBeCloseTo(50, 9);
      expect(at.phiLift).toBeCloseTo(70, 9);
      const past = solvedPull({ W: 50, theta: 20, muS: mu, muK: mu, phi: 75, aOverG: null, travel: 'along' }).regimes[1];
      expect(past.status).toBe('leaves-surface');
      expect(past.T).toBeNull();
    }
    // Jams: cos φ + μ sin φ ≤ 0 for a cable pressing the block into the surface.
    const jam = solvedPull({ W: 50, theta: 0, muS: 0.5, muK: 0.5, phi: -80, aOverG: null, travel: 'along' }).regimes[1];
    expect(Math.cos(-80 * DEG) + 0.5 * Math.sin(-80 * DEG)).toBeLessThan(0);
    expect(jam.status).toBe('self-locking');
    // Moves by itself: pulled down a slope steeper than the friction angle.
    const itself = solvedPull({ W: 50, theta: -30, muS: 0.3, muK: 0.3, phi: 0, aOverG: null, travel: 'along' }).regimes[1];
    expect(Math.tan(30 * DEG)).toBeGreaterThan(0.3);
    expect(itself.status).toBe('slides-on-its-own');
    expect(itself.hold).not.toBeNull();
  });

  it('the start uses the static coefficient, the run the kinetic one, and the largest governs', () => {
    const out = solvedPull({ W: 100, theta: 0, muS: 0.5, muK: 0.4, phi: 30, aOverG: null, travel: 'along' });
    const start = out.regimes.find((r) => r.id === 'start')!;
    const run = out.regimes.find((r) => r.id === 'run')!;
    expect(start.T).toBeCloseTo((0.5 * 100) / (Math.cos(30 * DEG) + 0.5 * Math.sin(30 * DEG)), 9);
    expect(run.T).toBeCloseTo((0.4 * 100) / (Math.cos(30 * DEG) + 0.4 * Math.sin(30 * DEG)), 9);
    expect(out.governing).toBe('start');
  });

  it('the capstan: T_big = e^(μβ) T_small; each full turn multiplies the ratio by e^(2πμ), and the ratio for two turns is the square of that for one', () => {
    const mu = 0.3;
    const one = solvedDrum({ Tbig: null, Tsmall: 10, mu, beta: 2 * Math.PI });
    const two = solvedDrum({ Tbig: null, Tsmall: 10, mu, beta: 4 * Math.PI });
    expect(one.solved).toBe('Tbig');
    expect(one.ratio).toBeCloseTo(Math.exp(2 * Math.PI * mu), 12);
    expect(two.ratio).toBeCloseTo(one.ratio ** 2, 9);
    expect(solvedDrum({ Tbig: null, Tsmall: 10, mu, beta: 6 * Math.PI }).ratio).toBeCloseTo(one.ratio ** 3, 7);
    expect(one.Tbig).toBeCloseTo(10 * Math.exp(2 * Math.PI * mu), 9);
    // Each of the four can be the unknown, and the others come back.
    expect(solvedDrum({ Tbig: one.Tbig, Tsmall: null, mu, beta: 2 * Math.PI }).Tsmall).toBeCloseTo(10, 9);
    expect(solvedDrum({ Tbig: one.Tbig, Tsmall: 10, mu: null, beta: 2 * Math.PI }).mu).toBeCloseTo(mu, 12);
    expect(solvedDrum({ Tbig: one.Tbig, Tsmall: 10, mu, beta: null }).beta).toBeCloseTo(2 * Math.PI, 12);
    // Exactly one blank.
    expect(solveDrum({ Tbig: 1, Tsmall: 1, mu: 1, beta: 1 }).ok).toBe(false);
    expect(solveDrum({ Tbig: null, Tsmall: null, mu: 1, beta: 1 }).ok).toBe(false);
    // The force on the drum is the vector sum of the two tensions: for a half wrap the two pull the same way.
    const half = solvedDrum({ Tbig: null, Tsmall: 10, mu: 0.2, beta: Math.PI });
    expect(half.resultant).toBeCloseTo(half.Tbig + half.Tsmall, 9);
  });

  it('the rope’s area is kd², and πd²/4 for a solid round', () => {
    expect(areaOfDiameter(2)).toBeCloseTo(Math.PI, 12);
    expect(areaOfDiameter(2, 0.4)).toBeCloseTo(1.6, 12);
  });
});

describe('cable page: the words', () => {
  const en = leaves(cablePage.en);
  const es = leaves(cablePage.es);
  const OTHERS = (lang: Lang) => [beamStrings[lang].page, spanPage[lang], continuousPage[lang], shaftPage[lang], trussPage[lang]];

  it('says the same things in both languages, and leaves nothing blank', () => {
    expect(es.map(([p]) => p)).toEqual(en.map(([p]) => p));
    for (const [path, s] of [...en, ...es]) expect(s.trim().length, path).toBeGreaterThan(0);
    const parts = (page: unknown) => leaves(page).map(([p]) => p.replace(/\[\d+\]/g, '[]'));
    expect([...new Set(parts(cablePage.en))]).toEqual([...new Set(parts(beamStrings.en.page))]);
  });

  it('the Spanish is Spanish: no sentence is the English one left in place, no grouping comma, “usted”', () => {
    const same = en.filter(([, s], i) => s === es[i][1] && s.split(/\s+/).length > 3).map(([path]) => path);
    expect(same).toEqual([]);
    for (const [path, s] of es) {
      expect(s, path).not.toMatch(/\d,\d{3}(?!\d)/);
      expect(s, path).not.toMatch(/\b(introduces|escribes|eliges|incluyes|pides|puedes|tienes|quieres|tu|tus|ti|te)\b/);
      // The catalogue’s word is “fricción”.
      expect(s, path).not.toMatch(/rozamiento|roce\b/i);
    }
  });

  it('the formulas are the same in both languages (a symbol is not translated; “sin” is “sen” in Spanish)', () => {
    const FORMULA =
      /T = W\/\(2 sin θ\)|T = √\(W² \+ H²\)|σ = T\/A|ε = σ\/E|δ = TL\/\(AE\)|A = kd²|πd²\/4|δ = αLΔT|EAαΔT|−u · d = δ|N = W cos θ − T sin φ|T cos φ = W sin θ \+ μN|T = \(sin θ \+ μ cos θ\)W\/\(cos φ \+ μ sin φ\)|T = \(sin θ \+ μ cos θ \+ a\/g\)W\/\(cos φ \+ μ sin φ\)|T = \(sin θ − μ cos θ − a\/g\)W\/\(cos φ − μ sin φ\)|φ = arctan μ|tan φ = μ|T = \(sin θ \+ μ cos θ\)W\/√\(1 \+ μ²\)|T_big = e\^\(μβ\) T_small|dT = μT dβ|e\^\(2πμ\)|e\^\(2πnμ\)|T = μW\/√\(1 \+ μ²\)|N = W\/\(1 \+ μ²\)|T = W|σ = W\/A|δ = WL\/\(AE\)|cos φ \+ μ sin φ/g;
    const formulas = (s: string) => s.replace(/\bsen\b/g, 'sin').replace(/T_mayor/g, 'T_big').replace(/T_menor/g, 'T_small').match(FORMULA) ?? [];
    en.forEach(([path, s], i) => expect(formulas(es[i][1]), path).toEqual(formulas(s)));
    expect(en.flatMap(([, s]) => formulas(s)).length).toBeGreaterThanOrEqual(30);
    // Every formula the engine tests above check is written on the page.
    const text = en.map(([, s]) => s).join(' ');
    for (const f of [
      'T = W/(2 sin θ)',
      'T = √(W² + H²)',
      'δ = TL/(AE)',
      'T = (sin θ + μ cos θ)W/(cos φ + μ sin φ)',
      'T = (sin θ + μ cos θ + a/g)W/(cos φ + μ sin φ)',
      'T = (sin θ − μ cos θ − a/g)W/(cos φ − μ sin φ)',
      'φ = arctan μ',
      'T = μW/√(1 + μ²)',
      'N = W/(1 + μ²)',
      'T_big = e^(μβ) T_small',
      'e^(2πnμ)',
      'EAαΔT',
    ]) {
      expect(text, f).toContain(f);
    }
  });

  it('names no other company’s product, no price, no date, no standard, no verdict', () => {
    for (const [path, s] of [...en, ...es]) {
      expect(s, path).not.toMatch(/skyciv|ftool|sap2000|etabs|robot|risa|staad|autodesk|enercalc|clearcalcs|crosby/i);
      expect(s, path).not.toMatch(/\bfree\b|\bgratis\b|\bgratuit|\$|\bprice\b|\bprecio\b|\b20\d\d\b/i);
      expect(s, path).not.toMatch(/Civil\s*&\s*Structural/i);
      expect(s, path).not.toMatch(/\b(ACI|AISC|ASCE|ASME|ANSI|ISO|DIN|IBC|OSHA|Eurocode|Eurocódigo|LRFD|ASD|NDS|AWS|API)\b/);
      if (LEGAL.test(path)) continue;
      expect(s, path).not.toMatch(/\b(ok|okay|pass|passes|passed|fail|fails|failed|adequate|inadequate|sufficient|insufficient|enough|acceptable|complies|satisf\w*|safe|safely|unsafe|safety|allowable|permissible|recommended|verified|certified|approved|guarantee\w*)\b/i);
      expect(s, path).not.toMatch(/\b(cumple|cumplen|no cumple|falla|fallan|aprobad\w*|suficiente|insuficiente|adecuad\w*|inadecuad\w*|aceptable|basta|segur[oa]|seguridad|satisf\w*|verifica|admisible|permisible|recomendad\w*|certificad\w*|garantiz\w*)\b/i);
    }
  });

  it('writes no figure but those of its formulas and its angles', () => {
    const written = (lang: Lang) =>
      leaves(cablePage[lang])
        .filter(([path]) => !LEGAL.test(path))
        .map(([, s]) => s)
        .join(' ');
    for (const lang of LANGS) {
      const numbers = written(lang).match(/\d+(\.\d+)?/g) ?? [];
      expect([...new Set(numbers)].sort()).toEqual(['0', '1', '2', '30', '4', '90']);
    }
  });

  it('says what it leaves out, each by name: verdict, fittings, constructional stretch, strain, legs, one block, one drum, restraint, no answer', () => {
    const limits = (lang: Lang) => cablePage[lang].limits.items;
    const NOT: [RegExp, RegExp][] = [
      [/^It gives numbers and no verdict\./, /^Da números y ningún veredicto\./],
      [/^No end fittings, no terminations and no sheaves\./, /^Sin herrajes de extremo, sin terminales y sin poleas\./],
      [/^Only the elastic stretch is given/, /^Solo se da el alargamiento elástico/],
      [/^A strain of more than one per cent is flagged/, /^Una deformación unitaria de más de uno por ciento se señala/],
      [/^A sling has two legs at most/, /^Una eslinga tiene dos ramales como máximo/],
      [/^The pull is of one block on one straight surface/, /^El tiro es el de un bloque sobre una superficie recta/],
      [/^The drum is one fixed drum/, /^El tambor es un tambor fijo/],
      [/^The force that a restrained cable would carry/, /^La fuerza que llevaría un cable restringido/],
      [/^A case with no answer is not solved/, /^Un caso sin respuesta no se resuelve/],
    ];
    for (const [inEnglish, inSpanish] of NOT) {
      expect(limits('en').filter((x) => inEnglish.test(x)), String(inEnglish)).toHaveLength(1);
      expect(limits('es').filter((x) => inSpanish.test(x)), String(inSpanish)).toHaveLength(1);
    }
    expect(limits('en')).toHaveLength(limits('es').length);
  });

  it('says that the typical values are typical, that a wire rope has about half of steel’s modulus, and that the manufacturer’s are the ones to use', () => {
    const text = (lang: Lang) => cablePage[lang].method.paragraphs.join(' ');
    expect(text('en')).toMatch(/typical values[\s\S]*first estimate[\s\S]*manufacturer’s/);
    expect(text('en')).toMatch(/about half that of the steel of its wires/);
    expect(text('es')).toMatch(/valores típicos[\s\S]*primera estimación[\s\S]*fabricante/);
    expect(text('es')).toMatch(/ronda la mitad del acero de sus alambres/);
  });

  it('leaves the sagging cable to its sister calculator, by the catalogue’s own name', () => {
    const row = calculatorFamilies.flatMap((f) => f.items).find((i) => i.name.en === 'Cable sag and pretension')!;
    expect(row).toBeDefined();
    expect(cablePage.en.assumes.items[0]).toContain('cable sag and pretension');
    expect(cablePage.es.assumes.items[0]).toContain('flecha y pretensión de cables');
    expect(row.name.es.toLowerCase()).toBe('flecha y pretensión de cables');
  });

  it('the legal words are the first calculator’s own, and the credit names this calculator', () => {
    for (const lang of LANGS) {
      const ours = cablePage[lang];
      const first = beamStrings[lang].page;
      expect(ours.disclaimer).toBe(first.disclaimer);
      expect(ours.sheet.kind).toBe(first.sheet.kind);
      expect(ours.sheet.margin).toBe(first.sheet.margin);
      for (const key of ['{firm}', '{address}']) expect(ours.sheet.credit, `${lang} ${key}`).toContain(key);
      for (const other of OTHERS(lang)) expect(ours.sheet.credit).not.toBe(other.sheet.credit);
      expect(ours.sheet.credit).toMatch(lang === 'en' ? /cable calculator/ : /calculadora de cables/);
    }
  });

  it('no sentence of the other calculators’ pages, nor a line of the catalogue, is said again here, beyond the legal words', () => {
    const rows = calculatorFamilies.flatMap((f) => f.items);
    for (const lang of LANGS) {
      const ours = leaves(cablePage[lang]).filter(([path]) => !LEGAL.test(path));
      const theirs = [...OTHERS(lang).flatMap((page) => leaves(page)), ...leaves(beamStrings[lang].ui), ...leaves(spanUi[lang]), ...leaves(continuousUi[lang])].map(([, s]) => s);
      for (const [path, s] of ours) {
        expect(sharedRuns([s], theirs), `${lang} ${path}`).toEqual([]);
        expect(sharedRuns([s], rows.map((r) => r.does[lang])), `${lang} ${path}`).toEqual([]);
      }
      expect(sharedRuns([cablePage[lang].disclaimer.body], theirs).length).toBeGreaterThan(20);
    }
  });

  // The form's own words (strings.ts) are another hand's: a sentence said in both is said twice on one page.
  // Imported here and nowhere else, so that the rest of this file does not need the form's words.
  it('no sentence of the form’s own words is said again on the page', async () => {
    const { cableUi } = await import('@/lib/calc/cable/strings');
    for (const lang of LANGS) {
      const form = leaves(cableUi[lang]).map(([, s]) => s);
      for (const [path, s] of leaves(cablePage[lang]).filter(([p]) => !LEGAL.test(p))) {
        // The signs and the facts are the form's own conventions, written in the notes on purpose: they may agree word for word.
        if (/^(signs|facts)/.test(path)) continue;
        expect(sharedRuns([s], form), `${lang} ${path} (form)`).toEqual([]);
      }
    }
  });

  it('the view declares the same address', () => {
    expect(readFileSync(join(__dirname, 'CableView.tsx'), 'utf8')).toContain(`CABLE_PATH = '${CABLE_PATH}'`);
  });

  it('the h1 begins with the catalogue’s name for the row, which links here', () => {
    const row = calculatorFamilies.flatMap((f) => f.items).find((i) => i.href === CABLE_PATH)!;
    expect(row).toBeDefined();
    expect(openCalculatorPaths).toContain(CABLE_PATH);
    for (const lang of LANGS) expect(cablePage[lang].h1.startsWith(row.name[lang]), lang).toBe(true);
  });

  it('a search result fits: the title and the description are within their pixel budgets', () => {
    for (const lang of LANGS) {
      expect(titlePx(cablePage[lang].title), lang).toBeLessThanOrEqual(TITLE_BUDGET_PX);
      expect(descriptionPx(cablePage[lang].description), lang).toBeLessThanOrEqual(DESCRIPTION_LIMIT_PX);
    }
  });
});
