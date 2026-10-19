import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { spanPage } from '@/lib/calc/beam/span-page-strings';
import { spanUi } from '@/lib/calc/beam/span-strings';
import { beamStrings } from '@/lib/calc/beam/strings';
import { cablePage } from '@/lib/calc/cable/page-strings';
import { cableUi } from '@/lib/calc/cable/strings';
import { cableSagPage } from '@/lib/calc/cable-sag/page-strings';
import { cableSagUi } from '@/lib/calc/cable-sag/strings';
import { continuousPage } from '@/lib/calc/continuous/page-strings';
import { continuousUi } from '@/lib/calc/continuous/strings';
import { framePage } from '@/lib/calc/frame/page-strings';
import { frameUi } from '@/lib/calc/frame/strings';
import { shaftPage } from '@/lib/calc/shaft/page-strings';
import { shaftUi } from '@/lib/calc/shaft/strings';
import { trussPage } from '@/lib/calc/truss/page-strings';
import { trussUi } from '@/lib/calc/truss/strings';
import { TOLERANCES, stagesOf } from '@/lib/calc/stiffness/analysis';
import { fixedEndForces, localStiffness, solve, transformation } from '@/lib/calc/stiffness/engine';
import { matMul, matVec, positiveDefinite, transpose } from '@/lib/calc/stiffness/linalg';
import { CALCULATION_UNITS, STIFFNESS_KEY, defaultCase, emptyStiffness, reduce, toEngine, unitOf } from '@/lib/calc/stiffness/model';
import { compare, real } from '@/lib/calc/stiffness/families.testlib';
import { stiffnessPage } from '@/lib/calc/stiffness/page-strings';
import { TEMPLATE_IDS } from '@/lib/calc/stiffness/templates';
import {
  MAX_DOFS,
  MAX_LOADS,
  MAX_MEMBERS,
  MAX_MEMBER_LOADS,
  MAX_NODES,
  MAX_SUPPORTS,
  RECORD_LIMIT,
  type Block,
  type Failure,
  type Solution,
  type Step,
  type StiffnessModel,
} from '@/lib/calc/stiffness/types';
import { calculatorFamilies } from '@/lib/ttc/calculators';
import { openCalculatorPaths } from '@/lib/ttc/calculator-paths';
import type { Lang } from '@/lib/ttc/i18n';
import { DESCRIPTION_LIMIT_PX, TITLE_BUDGET_PX, descriptionPx, repeatedWords, titlePx, unmeasured } from '@/lib/ttc/serp';

/**
 * The stiffness matrix calculator's PAGE words (lib/calc/stiffness/page-strings.ts), held to the engine and to the other
 * calculators' pages. The tool's own behaviour is tested where it lives (lib/calc/stiffness, calc/stiffness); this file does
 * not render the form, and reads the form's words (strings.ts) only in the one test that compares them with the page's.
 *
 * EVERY CASE THE PAGE PRINTS IS SOLVED HERE with the engine, and each number written in the text is compared with the one the
 * engine gives: the two-bar truss at each of its steps, the cantilever, the fixed-end forces, the sign case drawn both ways, the
 * sway of a portal, a rigid-body movement, the mechanisms, the limits and the tolerances.
 */

const LANGS: Lang[] = ['en', 'es'];

/** The page's address; StiffnessView.tsx exports the same constant (read as text, so that this file does not need the form). */
const STIFFNESS_PATH = '/resources/stiffness-matrix-step-by-step';

function leaves(value: unknown, path = ''): [string, string][] {
  if (typeof value === 'string') return [[path, value]];
  if (Array.isArray(value)) return value.flatMap((v, i) => leaves(v, `${path}[${i}]`));
  if (value && typeof value === 'object') return Object.entries(value).flatMap(([k, v]) => leaves(v, path ? `${path}.${k}` : k));
  return [];
}
/**
 * THE SIX-WORD RULE, FOR A TEXT FULL OF FORMULAS. The other pages compare their sentences by runs of six words. This page and its form
 * explain one method with the same formulas (the engine writes them once, in its steps), and a formula is not a sentence said twice:
 * `K ← K + K_e` is the same in every language and on every page that shows it. So a formula is MASKED before the comparison: a chunk of
 * the text with a mathematical character in it (`_ ^ = ← · / [ ] ( ) × ² ³ ½ Σ σ θ δ − + ;` or ȳ, x̄), and the chunks of two characters
 * or fewer next to it ("of", "a", "3n", "1"), become one marker, and a run that has the marker in it is not counted. What is left are the
 * words of the prose, and six of them in a row on two texts is a sentence said twice, as it is for every other calculator.
 */
const MATH = /[_^=←·/[\]()×²³½Σσθδ−+;]|ȳ|x̄/;
const short = (chunk: string) => chunk.replace(/[^\p{L}\p{N}]/gu, '').length <= 2;
function masked(text: string): string {
  const chunks = text.split(/\s+/).filter(Boolean);
  const math = chunks.map((c) => MATH.test(c));
  for (let again = true; again; ) {
    again = false;
    chunks.forEach((c, i) => {
      if (!math[i] && short(c) && (math[i - 1] || math[i + 1])) {
        math[i] = true;
        again = true;
      }
    });
  }
  return chunks.map((c, i) => (math[i] ? 'mathrun' : c)).join(' ');
}
const wordsOf = (t: string) => masked(t).toLowerCase().replace(/[^\p{L}\p{N}\s]/gu, ' ').split(/\s+/).filter(Boolean);
const runsOf = (t: string) => {
  const w = wordsOf(t);
  return w.length < 6 ? [] : Array.from({ length: w.length - 5 }, (_, i) => w.slice(i, i + 6)).filter((run) => !run.includes('mathrun')).map((run) => run.join(' '));
};
const sharedRuns = (ours: string[], theirs: string[]) => {
  const known = new Set(theirs.flatMap(runsOf));
  return [...new Set(ours.flatMap(runsOf).filter((run) => known.has(run)))];
};
const LEGAL = /^(disclaimer\.|sheet\.)/;
const NNBSP = ' ';

const near = (a: number, b: number, rel = 1e-9, abs = 1e-9) => expect(Math.abs(a - b)).toBeLessThanOrEqual(abs + rel * Math.abs(b));
function solved(model: StiffnessModel): Solution {
  const out = solve(model);
  if (!out.ok) throw new Error(JSON.stringify(out.issues));
  return out;
}
const failed = (model: StiffnessModel): Failure => {
  const out = solve(model);
  if (out.ok) throw new Error('expected a refusal');
  return out;
};
const codes = (model: StiffnessModel) => failed(model).issues.map((i) => i.code);
const step = (s: Solution, key: string): Step => {
  const found = s.steps.find((x) => x.key === key);
  if (!found) throw new Error(`no step ${key}`);
  return found;
};
function block<T extends Block['type']>(s: Solution, key: string, name: string, type: T, tag?: string): Extract<Block, { type: T }> {
  const b = step(s, key).blocks.find((x) => x.type === type && x.name === name && x.tag === tag);
  if (!b) throw new Error(`no ${type} ${name} in ${key}`);
  return b as Extract<Block, { type: T }>;
}
const matrix = (s: Solution, key: string, name: string, tag?: string) => block(s, key, name, 'matrix', tag).values;
const vector = (s: Solution, key: string, name: string, tag?: string) => block(s, key, name, 'vector', tag).values;
const scalar = (s: Solution, key: string, name: string, tag?: string) => block(s, key, name, 'scalar', tag).value;

const FIX = { ux: true, uy: true, rz: true };
const frameModel = (o: Partial<StiffnessModel>): StiffnessModel => ({ mode: 'frame', nodes: [], members: [], supports: [], loads: [], memberLoads: [], E: 1000, A: 10, I: 100, ...o });

/** A figure as the page writes it: the thousands grouped by a comma in English and by a narrow no-break space in Spanish. */
const grouped = (n: number, lang: Lang) => String(n).replace(/\B(?=(\d{3})+(?!\d))/g, lang === 'en' ? ',' : NNBSP);
const prose = (lang: Lang, part: 'method' | 'assumes' | 'limits' | 'signs') => {
  const p = stiffnessPage[lang][part];
  return ('paragraphs' in p ? p.paragraphs : p.items).join('\n');
};

describe('stiffness page: the two-bar truss it works through, step by step', () => {
  const form = defaultCase();
  const { model } = toEngine(form);
  const s = solved(model);

  it('is the structure the page opens with: nodes at (0, 0), (16, 0), (8, 6) ft, two pinned feet, E = 29,000 ksi, A = 10 in², 20 kip right and 30 kip down at node 3', () => {
    expect(form.mode).toBe('truss');
    expect(form.units).toBe('us');
    expect(model.nodes).toEqual([{ x: 0, y: 0 }, { x: 16, y: 0 }, { x: 8, y: 6 }]);
    expect(model.members).toEqual([{ i: 0, j: 2 }, { i: 1, j: 2 }]);
    expect(model.supports).toEqual([{ node: 0, ux: true, uy: true, rz: false }, { node: 1, ux: true, uy: true, rz: false }]);
    expect(model.loads).toEqual([{ node: 2, fx: 20, fy: -30, m: 0 }]);
    expect([form.E, form.A]).toEqual([29000, 10]);
    expect(form.members.every((m) => m.E === null && m.A === null)).toBe(true);
  });

  it('each bar is 10 ft: EA = 290,000 kip and EA/L = 29,000 kip/ft; bar 1 has c = 0.8 and s = 0.6, bar 2 c = −0.8 and s = 0.6', () => {
    for (const k of [1, 2]) {
      near(scalar(s, `geometry#${k}`, 'L'), 10);
      near(scalar(s, `geometry#${k}`, 'EA'), 290000);
      near(scalar(s, `local-stiffness#${k}`, 'EA/L'), 29000);
      near(scalar(s, `geometry#${k}`, 's'), 0.6);
    }
    near(scalar(s, 'geometry#1', 'c'), 0.8);
    near(scalar(s, 'geometry#2', 'c'), -0.8);
    near(matrix(s, 'local-stiffness#1', 'k')[0][0], 29000);
  });

  it('the DOFs are 1, 2 | 3, 4 | 5, 6 and the code vectors are [1 2 5 6] and [3 4 5 6]', () => {
    expect(s.nodes.map((n) => n.dofs)).toEqual([[1, 2], [3, 4], [5, 6]]);
    expect(vector(s, 'global-member#1', 'code')).toEqual([1, 2, 5, 6]);
    expect(vector(s, 'global-member#2', 'code')).toEqual([3, 4, 5, 6]);
    expect(matrix(s, 'structure', 'dof-numbers')).toEqual([[1, 2], [3, 4], [5, 6]]);
    // the page says them
    expect(prose('en', 'method')).toContain('so the code vectors are [1 2 5 6] and [3 4 5 6]');
    expect(prose('es', 'method')).toContain('de modo que los vectores de código son [1 2 5 6] y [3 4 5 6]');
    for (const lang of LANGS) expect(prose(lang, 'method')).toContain('[1 2 5 6]');
    expect(prose('en', 'method')).toContain('The DOFs are 1 and 2 at node 1, 3 and 4 at node 2, and 5 and 6 at node 3');
    expect(prose('es', 'method')).toContain('Los GDL son 1 y 2 en el nudo 1, 3 y 4 en el nudo 2, y 5 y 6 en el nudo 3');
  });

  it('at DOFs 5 and 6 bar 1 adds 29,000 × [0.64 0.48; 0.48 0.36] and bar 2 adds 29,000 × [0.64 −0.48; −0.48 0.36]; the cross terms cancel and K_FF = [37,120 0; 0 20,880]', () => {
    const block56 = (key: string) => [4, 5].map((r) => [4, 5].map((c) => matrix(s, key, 'contribution')[r][c]));
    const unit = (m: number[][]) => m.map((row) => row.map((v) => v / 29000));
    unit(block56('assembly#1')).forEach((row, r) => row.forEach((v, c) => near(v, [[0.64, 0.48], [0.48, 0.36]][r][c])));
    unit(block56('assembly#2')).forEach((row, r) => row.forEach((v, c) => near(v, [[0.64, -0.48], [-0.48, 0.36]][r][c])));
    const kff = matrix(s, 'partition', 'K_FF');
    near(kff[0][0], 37120);
    near(kff[1][1], 20880);
    near(kff[0][1], 0, 0, 1e-9);
    near(kff[1][0], 0, 0, 1e-9);
    // …and the closed form the tool prints beside the product is the product
    for (const k of [1, 2]) expect(step(s, `global-member#${k}`).facts.agree).toBe(true);
    // the page writes them with these digits
    for (const lang of LANGS) {
      const text = prose(lang, 'method');
      expect(text).toContain(`K_FF = [${grouped(37120, lang)} 0; 0 ${grouped(20880, lang)}] kip/ft`);
      expect(text).toContain(`${grouped(29000, lang)} × [0.64 0.48; 0.48 0.36]`);
      expect(text).toContain(`${grouped(29000, lang)} × [0.64 −0.48; −0.48 0.36]`);
      expect(text).toContain(`EA = ${grouped(290000, lang)} kip ${lang === 'en' ? 'and' : 'y'} EA/L = ${grouped(29000, lang)} kip/ft`);
    }
  });

  it('with P_F = [20; −30] nothing lies under the diagonal to eliminate: the multiplier is 0, u_5 = 20/37,120 and u_6 = −30/20,880, that is 0.00647 in and 0.01724 in down', () => {
    expect(vector(s, 'partition', 'P_F')).toEqual([20, -30]);
    expect(vector(s, 'forward-pass#1', 'multipliers', 'pass#1')).toEqual([0]);
    near(s.u[4], 20 / 37120);
    near(s.u[5], -30 / 20880);
    expect((s.u[4] * 12).toFixed(5)).toBe('0.00647');
    expect((-s.u[5] * 12).toFixed(5)).toBe('0.01724');
    for (const lang of LANGS) {
      const text = prose(lang, 'method');
      expect(text).toContain(`u_5 = 20/${grouped(37120, lang)} ${lang === 'en' ? 'and' : 'y'} u_6 = −30/${grouped(20880, lang)}`);
      expect(text).toContain('0.00647 in');
      expect(text).toContain('0.01724 in');
    }
  });

  it('the reactions are R_1 = 10, R_2 = 7.5, R_3 = −30, R_4 = 22.5 kip; N is −12.5 kip in bar 1 and −37.5 kip in bar 2; ΣFx = 20 + 10 − 30 = 0 and ΣFy = −30 + 7.5 + 22.5 = 0', () => {
    expect(s.reactions.map((r) => r.label)).toEqual(['1x', '1y', '2x', '2y']);
    s.reactions.forEach((r, k) => near(r.value, [10, 7.5, -30, 22.5][k]));
    near(s.forces[0].bar!.N, -12.5);
    near(s.forces[1].bar!.N, -37.5);
    expect(20 + 10 - 30).toBe(0);
    expect(-30 + 7.5 + 22.5).toBe(0);
    near(scalar(s, 'checks', 'ΣFx'), 0, 0, 1e-12);
    near(scalar(s, 'checks', 'ΣFy'), 0, 0, 1e-12);
    for (const lang of LANGS) {
      const text = prose(lang, 'method');
      expect(text).toContain('R_1 = 10, R_2 = 7.5, R_3 = −30');
      expect(text).toContain('R_4 = 22.5 kip');
      expect(text).toContain('−12.5 kip');
      expect(text).toContain('−37.5 kip');
      expect(text).toContain('ΣFx = 20 + 10 − 30 = 0');
      expect(text).toContain('ΣFy = −30 + 7.5 + 22.5 = 0');
    }
  });

  it('joint equilibrium at node 3, −0.8·N_1 + 0.8·N_2 + 20 = 0 and −0.6·N_1 − 0.6·N_2 − 30 = 0, gives the same two forces', () => {
    // N_1 + N_2 = −50 and −N_1 + N_2 = −25
    const N2 = (-50 + -25) / 2;
    const N1 = -50 - N2;
    near(N1, s.forces[0].bar!.N);
    near(N2, s.forces[1].bar!.N);
    expect(-0.8 * N1 + 0.8 * N2 + 20).toBeCloseTo(0, 12);
    expect(-0.6 * N1 - 0.6 * N2 - 30).toBeCloseTo(0, 12);
  });

  it('the opening structure is one of seven problems, and it is the first', () => {
    expect(TEMPLATE_IDS).toHaveLength(7);
    expect(TEMPLATE_IDS[0]).toBe('truss-two-bar');
    expect(toEngine(defaultCase()).model).toEqual(toEngine(reduce(emptyStiffness(), { type: 'template', template: 'truss-two-bar' })).model);
    expect(stiffnessPage.en.sub).toContain('seven textbook problems');
    expect(stiffnessPage.es.sub).toContain('siete problemas de libro de texto');
  });
});

describe('stiffness page: the cantilever it works through', () => {
  // L = 10, P = 7, EI = 1000 · 100: the page's formulas are dimensionless in all three, so more than one set is tried.
  for (const [L, P, E, I] of [
    [10, 7, 1000, 100],
    [4.5, 12, 29000 * 144, 0.0125],
    [20, 0.3, 200, 8],
  ] as const) {
    it(`L = ${L}, P = ${P}, EI = ${E * I}: multiplier −L/2, EI/L under the second pivot, θ_2 = −PL²/(2EI), v_2 = −PL³/(3EI), reactions P and PL`, () => {
      const s = solved(frameModel({ E, A: 10, I, nodes: [{ x: 0, y: 0 }, { x: L, y: 0 }], members: [{ i: 0, j: 1 }], supports: [{ node: 0, ...FIX }], loads: [{ node: 1, fx: 0, fy: -P, m: 0 }] }));
      const EI = E * I;
      // the free DOFs are u_2, v_2, θ_2 (4, 5, 6): the axial row has only EA/L, and the other two are the page's K_FF
      const kff = matrix(s, 'partition', 'K_FF');
      near(kff[0][0], (E * 10) / L);
      near(kff[0][1], 0, 0, 1e-9 * kff[0][0]);
      near(kff[0][2], 0, 0, 1e-9 * kff[0][0]);
      near(kff[1][1], (12 * EI) / L ** 3);
      near(kff[1][2], (-6 * EI) / L ** 2);
      near(kff[2][2], (4 * EI) / L);
      expect(vector(s, 'partition', 'P_F')).toEqual([0, -P, 0]);
      // pass 2: the multiplier on the rotation row, l = (−6EI/L²)/(12EI/L³) = −L/2; then EI/L where 4EI/L stood, −PL/2 on the right
      near(vector(s, 'forward-pass#2', 'multipliers', 'pass#2')[0], -L / 2);
      const aug = matrix(s, 'forward-pass#2', 'augmented', 'pass#2');
      near(aug[2][2], EI / L);
      near(aug[2][3], (-P * L) / 2);
      near(s.u[5], (-P * L * L) / (2 * EI));
      near(s.u[4], (-P * L ** 3) / (3 * EI));
      near(s.u[3], 0, 0, 1e-15);
      near(s.reactions[0].value, 0, 0, 1e-9 * P);
      near(s.reactions[1].value, P);
      near(s.reactions[2].value, P * L);
    });
  }

  it('the page writes those answers: K_FF, the multiplier, EI/L, −PL/2, θ_2, v_2 and the reactions', () => {
    for (const lang of LANGS) {
      const text = prose(lang, 'method');
      for (const written of [
        `K_FF = [12EI/L³ −6EI/L²; −6EI/L² 4EI/L] ${lang === 'en' ? 'with' : 'con'} P_F = [−P; 0]`,
        'm = (−6EI/L²)/(12EI/L³) = −L/2',
        'EI/L',
        '−PL/2',
        'θ_2 = −PL²/(2EI) and v_2 = −PL³/(3EI)'.replace(' and ', lang === 'en' ? ' and ' : ' y '),
      ]) {
        expect(text, `${lang} ${written}`).toContain(written);
      }
    }
  });

  it('the first-pass multipliers of the axial row are zero: nothing couples it to the other two', () => {
    const s = solved(frameModel({ nodes: [{ x: 0, y: 0 }, { x: 10, y: 0 }], members: [{ i: 0, j: 1 }], supports: [{ node: 0, ...FIX }], loads: [{ node: 1, fx: 0, fy: -7, m: 0 }] }));
    expect(vector(s, 'forward-pass#1', 'multipliers', 'pass#1')).toEqual([0, 0]);
  });
});

describe('stiffness page: the member matrices it writes', () => {
  const EA = 7300;
  const EI = 910;
  const L = 6.5;

  it('a frame member is 6 × 6 and made of five numbers, EA/L, 12EI/L³, 6EI/L², 4EI/L and 2EI/L, each cell with the sign its position gives', () => {
    const k = localStiffness('frame', EA, EI, L);
    expect(k).toHaveLength(6);
    const sizes = new Set(k.flat().map((v) => Math.abs(v)).filter((v) => v !== 0).map((v) => v.toPrecision(12)));
    expect(sizes).toEqual(new Set([EA / L, (12 * EI) / L ** 3, (6 * EI) / L ** 2, (4 * EI) / L, (2 * EI) / L].map((v) => v.toPrecision(12))));
    // moved sideways one unit at the first end: a shear of 12EI/L³ and a moment of 6EI/L² there; turned one unit: 4EI/L there and 2EI/L at the far end
    near(k[1][1], (12 * EI) / L ** 3);
    near(k[2][1], (6 * EI) / L ** 2);
    near(k[2][2], (4 * EI) / L);
    near(k[5][2], (2 * EI) / L);
    // the axial terms and the bending terms share no cell in local axes
    for (const a of [0, 3]) for (const b of [1, 2, 4, 5]) expect(k[a][b]).toBe(0);
  });

  it('a bar is (EA/L)·[1 −1; −1 1]; its first column is a push of EA/L on each end, shortening the bar one unit', () => {
    const k = localStiffness('truss', EA, 0, L);
    expect(k).toEqual([[EA / L, -(EA / L)], [-(EA / L), EA / L]]);
    // end i moves one unit toward j and end j is held: the forces on the bar are +EA/L at i (towards j) and −EA/L at j (towards i)
    expect([k[0][0], k[1][0]]).toEqual([EA / L, -(EA / L)]);
  });

  it('T is [c s 0; −s c 0; 0 0 1] at each end, and a bar’s K_e = T^T·k·T is (EA/L)·[c² cs −c² −cs; …]', () => {
    for (const angle of [0, 0.3, 1.1, 2.6, -2, Math.PI / 2]) {
      const c = Math.cos(angle);
      const sn = Math.sin(angle);
      const T = transformation('frame', c, sn);
      for (const o of [0, 3]) {
        [[c, sn, 0], [-sn, c, 0], [0, 0, 1]].forEach((row, r) => row.forEach((v, q) => expect(T[o + r][o + q] + 0).toBe(v + 0)));
        // …and nothing outside the two 3 × 3 blocks
        for (let q = 0; q < 6; q++) if (q < o || q >= o + 3) for (let r = 0; r < 3; r++) expect(T[o + r][q]).toBe(0);
      }
      const Tb = transformation('truss', c, sn);
      const Ke = matMul(transpose(Tb), matMul(localStiffness('truss', EA, 0, L), Tb));
      const f = EA / L;
      const closed = [
        [c * c, c * sn, -c * c, -c * sn],
        [c * sn, sn * sn, -c * sn, -sn * sn],
        [-c * c, -c * sn, c * c, c * sn],
        [-c * sn, -sn * sn, c * sn, sn * sn],
      ];
      Ke.forEach((row, r) => row.forEach((v, q) => near(v, f * closed[r][q], 1e-12, 1e-9)));
    }
  });
});

describe('stiffness page: the fixed-end forces and the signs it writes', () => {
  it('a uniform load w gives wL/2 and wL²/12; an axial load q gives qL/2 at each end; a point load P at a and b gives Pb²(3a+b)/L³, Pab²/L², Pa²(a+3b)/L³ and Pa²b/L²', () => {
    for (const [L, w, P, a, q] of [[10, -2, 6, 3, 0.8], [7.25, 1.4, -9, 5, -2.5], [24, -0.45, 33, 11.5, 4]]) {
      const u = fixedEndForces({ kind: 'udl', w }, L);
      near(Math.abs(u[1]), Math.abs((w * L) / 2));
      near(Math.abs(u[2]), Math.abs((w * L * L) / 12));
      near(Math.abs(u[4]), Math.abs((w * L) / 2));
      near(Math.abs(u[5]), Math.abs((w * L * L) / 12));
      const x = fixedEndForces({ kind: 'axial', q }, L);
      near(Math.abs(x[0]), Math.abs((q * L) / 2));
      near(Math.abs(x[3]), Math.abs((q * L) / 2));
      const b = L - a;
      const p = fixedEndForces({ kind: 'point', a, P }, L);
      near(Math.abs(p[1]), Math.abs((P * b * b * (3 * a + b)) / L ** 3));
      near(Math.abs(p[2]), Math.abs((P * a * b * b) / (L * L)));
      near(Math.abs(p[4]), Math.abs((P * a * a * (a + 3 * b)) / L ** 3));
      near(Math.abs(p[5]), Math.abs((P * a * a * b) / (L * L)));
      // …and the two reactions of a point load add up to the load
      near(p[1] + p[4], -P);
    }
  });

  it('the sign case: fixed at both ends under w = −2, f_FE = [0, 10, 16.667, 0, 10, −16.667]; V = 10 and M = −16.667 at the first end, V = −10 and M = −16.667 at the second', () => {
    const beam = (nodes: { x: number; y: number }[], w: number) => solved(frameModel({ nodes, members: [{ i: 0, j: 1 }], supports: [{ node: 0, ...FIX }, { node: 1, ...FIX }], memberLoads: [{ kind: 'udl', member: 0, w }] }));
    const fwd = beam([{ x: 0, y: 0 }, { x: 10, y: 0 }], -2);
    fwd.forces[0].fixedEnd!.forEach((v, k) => near(v, [0, 10, 100 / 6, 0, 10, -100 / 6][k]));
    near(fwd.forces[0].start.V, 10);
    near(fwd.forces[0].start.M, -100 / 6);
    near(fwd.forces[0].end.V, -10);
    near(fwd.forces[0].end.M, -100 / 6);
    near(fwd.forces[0].start.N, 0, 0, 1e-12);
    // the same member drawn from right to left: ȳ points down, the same load is w = +2, V = −10 then 10 and M = 16.667 at both
    const back = beam([{ x: 10, y: 0 }, { x: 0, y: 0 }], 2);
    near(back.forces[0].start.V, -10);
    near(back.forces[0].end.V, 10);
    near(back.forces[0].start.M, 100 / 6);
    near(back.forces[0].end.M, 100 / 6);
    // …which is the same tension on the top face: −ȳ is up for the member drawn the other way
    expect(back.nodes[0].x).toBeGreaterThan(back.nodes[1].x);
    for (const lang of LANGS) {
      const text = prose(lang, 'signs');
      expect(text).toContain('f_FE = [0, 10, 16.667, 0, 10, −16.667]');
      expect(text).toContain('w = −2 kip/ft');
      expect(text).toContain('V = −10 y M = −16.667'.replace(' y ', lang === 'en' ? ' and ' : ' y '));
      expect(text).toContain('w = +2');
      expect(text).toContain('M = 16.667');
    }
  });

  it('the end-force convention: N = −Fx_i, V = Fy_i, M = −M_i at the first end and N = Fx_j, V = −Fy_j, M = M_j at the second', () => {
    const s = solved(frameModel({ nodes: [{ x: 0, y: 0 }, { x: 8, y: 6 }], members: [{ i: 0, j: 1 }], supports: [{ node: 0, ...FIX }], loads: [{ node: 1, fx: 3, fy: -5, m: 2 }], memberLoads: [{ kind: 'udl', member: 0, w: -0.7 }] }));
    const f = s.forces[0];
    near(f.start.N, -f.f[0]);
    near(f.start.V, f.f[1]);
    near(f.start.M, -f.f[2]);
    near(f.end.N, f.f[3]);
    near(f.end.V, -f.f[4]);
    near(f.end.M, f.f[5]);
    // a bar: N = (EA/L)(u_j − u_i) in local axes, the stress N/A and the elongation u_j − u_i
    const t = solved(toEngine(defaultCase()).model);
    for (const force of t.forces) {
      near(force.bar!.N, ((t.members[force.member - 1].E * t.members[force.member - 1].A) / t.members[force.member - 1].length) * (force.uLocal[1] - force.uLocal[0]));
      near(force.bar!.stress, force.bar!.N / t.members[force.member - 1].A);
      near(force.bar!.elongation, force.uLocal[1] - force.uLocal[0]);
    }
    // the stress is in ksi in the form: 12.5 kip over 10 in² is 1.25 ksi
    near(t.forces[0].bar!.stress / 144, -1.25);
  });
});

describe('stiffness page: how the method goes, step by step', () => {
  const STAGES = [
    // [engine step id, a phrase of the English text that opens its paragraph, one of the Spanish]
    ['structure', 'Degrees of freedom (DOFs) come first', 'Primero van los grados de libertad'],
    ['local-stiffness', 'Each member is first taken in axes of its own', 'Cada barra se toma primero en ejes propios'],
    ['transformation', 'Members point every way', 'Las barras apuntan en todas direcciones'],
    ['assembly', 'Assembly adds the members up', 'El ensamblaje suma las barras'],
    ['nodal-loads', 'Loads come next', 'Siguen las cargas'],
    ['partition', 'The DOFs are then split into free (F) and restrained (R)', 'Los GDL se separan después en libres (F) y restringidos (R)'],
    ['forward-pass', 'This reduced equation is solved by Gaussian elimination', 'Esta ecuación reducida se resuelve por eliminación de Gauss'],
    ['displacements', 'The free displacements and the prescribed ones', 'Los desplazamientos de los GDL libres y los prescritos'],
    ['end-forces', 'Each member then reads its end movements', 'Cada barra toma luego sus movimientos de extremo'],
    ['checks', 'Step 14 tests the answer', 'El paso 14 somete la respuesta a prueba'],
  ] as const;

  it('the paragraphs follow the order of the engine’s steps, from the numbering of the DOFs to the checks', () => {
    const s = solved(toEngine(reduce(emptyStiffness(), { type: 'template', template: 'frame-portal' })).model);
    const order = (id: string) => s.steps.findIndex((x) => x.id === id);
    const ids = STAGES.map(([id]) => id);
    expect(ids.map(order)).toEqual([...ids.map(order)].sort((a, b) => a - b));
    expect(ids.every((id) => order(id) >= 0)).toBe(true);
    // the stages are the 14 of the contract, in order
    expect(stagesOf(s.steps).map((g) => g.number)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14]);
    for (const [lang, col] of [['en', 1], ['es', 2]] as const) {
      const text = prose(lang, 'method');
      const at = STAGES.map((row) => text.indexOf(row[col]));
      expect(at.every((i) => i >= 0), `${lang} ${JSON.stringify(at)}`).toBe(true);
      expect(at).toEqual([...at].sort((a, b) => a - b));
    }
  });

  it('the paragraphs name the number of the step they are about, as the tool numbers it: the stage of each step id', () => {
    // a frame with a load on a member, so that every kind of step is there
    const s = solved(toEngine(reduce(emptyStiffness(), { type: 'template', template: 'frame-l' })).model);
    const stage = (id: string) => s.steps.find((x) => x.id === id)!.number;
    // the numbers the page writes, and the step each is of
    const WRITTEN: [number, string][] = [
      [1, 'structure'],
      [2, 'geometry'],
      [3, 'local-stiffness'],
      [4, 'transformation'],
      [5, 'global-member'],
      [6, 'assembly'],
      [7, 'nodal-loads'],
      [8, 'partition'],
      [9, 'reduced'],
      [10, 'forward-pass'],
      [11, 'displacements'],
      [12, 'reactions'],
      [13, 'end-forces'],
      [14, 'checks'],
    ];
    for (const [n, id] of WRITTEN) expect(stage(id), id).toBe(n);
    expect(stage('member-loads')).toBe(7);
    expect(stage('load-vector')).toBe(7);
    expect(stage('assembled')).toBe(6);
    expect(stage('augmented')).toBe(10);
    expect(stage('back-substitution')).toBe(10);
    expect(stage('solution')).toBe(10);
    const en = prose('en', 'method');
    const es = prose('es', 'method');
    for (const written of ['(step 1)', '(steps 2 and 3)', '(steps 4 and 5)', '(step 6)', '(step 7)', '(step 8)', '(step 9)', '(step 10)', '(step 11)', '(step 12)', '(step 13)', 'Step 14 tests']) expect(en, written).toContain(written);
    for (const written of ['paso 1.', '(pasos 2 y 3)', '(pasos 4 y 5)', '(paso 6)', '(paso 7)', '(paso 8)', '(paso 9)', '(paso 10)', '(paso 11)', '(paso 12)', '(paso 13)', 'El paso 14 somete']) expect(es, written).toContain(written);
    // the step numbers appear in the order of the steps
    const order = (text: string, re: RegExp) => [...text.matchAll(re)].map((m) => Number(m[1]));
    expect(order(en, /\(step (\d+)\)/g)).toEqual([1, 6, 7, 8, 9, 10, 11, 12, 13]);
    expect(order(es, /\(paso (\d+)\)/g)).toEqual([6, 7, 8, 9, 10, 11, 12, 13]);
  });

  it('the DOFs are numbered 2n − 1, 2n (truss) and 3n − 2, 3n − 1, 3n (frame), and that is the order of every global matrix', () => {
    // every node of every problem offered, truss or frame, in both unit systems
    for (const units of ['us', 'si'] as const) {
      for (const template of TEMPLATE_IDS) {
        const s = solved(toEngine(reduce(reduce(emptyStiffness(), { type: 'units', units }), { type: 'template', template })).model);
        s.nodes.forEach((node, k) => {
          const n = k + 1;
          expect(node.dofs, `${template} node ${n}`).toEqual(s.mode === 'truss' ? [2 * n - 1, 2 * n] : [3 * n - 2, 3 * n - 1, 3 * n]);
          expect(s.dofs.filter((d) => d.node === n).map((d) => d.label), `${template} node ${n}`).toEqual(s.mode === 'truss' ? [`${n}x`, `${n}y`] : [`${n}x`, `${n}y`, `${n}θ`]);
        });
      }
    }
    // …and a frame of the most nodes there can be
    const n = MAX_NODES;
    const chain = solved(frameModel({ nodes: Array.from({ length: n }, (_, k) => ({ x: 10 * k, y: 0 })), members: Array.from({ length: n - 1 }, (_, k) => ({ i: k, j: k + 1 })), supports: [{ node: 0, ...FIX }] }));
    expect(chain.nodes[n - 1].dofs).toEqual([3 * n - 2, 3 * n - 1, 3 * n]);
    expect(chain.dofs).toHaveLength(MAX_DOFS);
  });

  it('assembly: K ← K + K_e at row code(a) and column code(b); two members meeting at a node both add into its cells', () => {
    const s = solved(toEngine(reduce(emptyStiffness(), { type: 'template', template: 'frame-portal' })).model);
    const K = s.K.map((row) => row.map(() => 0));
    for (const m of s.members) {
      const Ke = matrix(s, `global-member#${m.label}`, 'K_e');
      m.code.forEach((da, a) => m.code.forEach((db, b) => (K[da - 1][db - 1] += Ke[a][b])));
    }
    K.forEach((row, r) => row.forEach((v, c) => near(v, s.K[r][c], 1e-12, 1e-9)));
    // the running K after the last member is the K
    const running = matrix(s, `assembly#${s.members.length}`, 'running');
    running.forEach((row, r) => row.forEach((v, c) => near(v, s.K[r][c], 1e-12, 1e-9)));
    // node 3 of the portal (DOFs 7, 8, 9) is reached by the left column and the beam: the cells of its own DOFs are shared
    const shared = step(s, 'assembled').blocks.find((b) => b.type === 'matrix')!;
    expect('highlights' in shared && shared.highlights!.some((h) => h.reason === 'shared' && h.row >= 6 && h.row <= 8 && h.members!.length > 1)).toBe(true);
  });

  it('the load on a member is replaced by its fixed-end forces, and the equivalent nodal loads are −T^T·f_FE, in global axes', () => {
    const s = solved(frameModel({ nodes: [{ x: 0, y: 0 }, { x: 8, y: 6 }], members: [{ i: 0, j: 1 }], supports: [{ node: 0, ...FIX }], memberLoads: [{ kind: 'udl', member: 0, w: -1.5 }, { kind: 'point', member: 0, a: 4, P: -3 }] }));
    const fe = vector(s, 'member-loads#1', 'f_FE', 'total');
    const T = transformation('frame', 0.8, 0.6);
    const equivalent = matVec(transpose(T), fe).map((v) => 0 - v);
    vector(s, 'member-loads#1', 'equivalent').forEach((v, k) => near(v, equivalent[k], 1e-12, 1e-12));
    // …and the load vector P is the nodal loads plus those
    s.P.forEach((v, k) => near(v, vector(s, 'load-vector', 'P_nodal')[k] + vector(s, 'load-vector', 'P_equivalent')[k], 1e-12, 1e-12));
    // …and the member’s end forces take f_FE back: f = k·u_local + f_FE
    const f = s.forces[0];
    const kk = localStiffness('frame', s.members[0].E * s.members[0].A, s.members[0].E * (s.members[0].I as number), s.members[0].length);
    matVec(kk, f.uLocal).forEach((v, k) => near(f.f[k], v + fe[k], 1e-9, 1e-9));
  });

  it('the partition: K_FF·u_F = P_F − K_FR·u_R, and a settlement acts as a load; R = K_RF·u_F + K_RR·u_R − P_R', () => {
    const base = frameModel({ nodes: [{ x: 0, y: 0 }, { x: 10, y: 0 }, { x: 20, y: 0 }], members: [{ i: 0, j: 1 }, { i: 1, j: 2 }], supports: [{ node: 0, ...FIX }, { node: 2, ux: false, uy: true, rz: false, dy: -0.02 }], loads: [] });
    const s = solved(base);
    const KFF = matrix(s, 'partition', 'K_FF');
    const KFR = matrix(s, 'partition', 'K_FR');
    const uR = vector(s, 'partition', 'u_R');
    expect(uR.some((v) => v !== 0)).toBe(true);
    // with no load at all, the settlement is the only load: P_F − K_FR·u_R = −K_FR·u_R, not zero
    expect(vector(s, 'partition', 'P_F').every((v) => v === 0)).toBe(true);
    const rhs = vector(s, 'reduced', 'rhs');
    matVec(KFR, uR).forEach((v, k) => near(rhs[k], 0 - v, 1e-12, 1e-12));
    expect(rhs.some((v) => v !== 0)).toBe(true);
    // the free displacements solve it
    const uF = s.free.map((d) => s.u[d - 1]);
    matVec(KFF, uF).forEach((v, k) => near(v, rhs[k], 1e-9, 1e-9));
    // reactions
    const R = matVec(matrix(s, 'partition', 'K_RF'), uF).map((v, k) => v + matVec(matrix(s, 'partition', 'K_RR'), uR)[k] - vector(s, 'partition', 'P_R')[k]);
    s.reactions.forEach((r, k) => near(r.value, R[k], 1e-9, 1e-9));
  });

  it('the elimination: m_ik = a_ik/a_kk and a_ij ← a_ij − m_ik·a_kj, then u_k = (b_k − Σ a_kj·u_j)/a_kk from the bottom up; every pivot is positive and K_FF is positive definite', () => {
    const s = solved(toEngine(reduce(emptyStiffness(), { type: 'template', template: 'frame-portal' })).model);
    const n = s.free.length;
    let aug = matrix(s, 'augmented', 'augmented');
    expect(positiveDefinite(matrix(s, 'partition', 'K_FF'))).toBe(true);
    for (let k = 0; k < n - 1; k++) {
      const pass = `forward-pass#${k + 1}`;
      const pivot = scalar(s, pass, 'pivot', `pass#${k + 1}`);
      near(pivot, aug[k][k], 1e-12, 1e-9);
      expect(pivot).toBeGreaterThan(0);
      const multipliers = vector(s, pass, 'multipliers', `pass#${k + 1}`);
      const next = aug.map((row) => row.slice());
      for (let i = k + 1; i < n; i++) {
        const l = aug[i][k] / aug[k][k];
        near(multipliers[i - k - 1], l, 1e-12, 1e-12);
        for (let j = k + 1; j <= n; j++) next[i][j] = aug[i][j] - l * aug[k][j];
        next[i][k] = 0;
      }
      const shown = matrix(s, pass, 'augmented', `pass#${k + 1}`);
      shown.forEach((row, r) => row.forEach((v, c) => near(v, next[r][c], 1e-9, 1e-6)));
      aug = shown;
    }
    // the unknowns from the bottom up
    const uF = s.free.map((d) => s.u[d - 1]);
    for (let k = n - 1; k >= 0; k--) {
      let sum = aug[k][n];
      for (let j = k + 1; j < n; j++) sum -= aug[k][j] * uF[j];
      near(uF[k], sum / aug[k][k], 1e-9, 1e-12);
    }
    // the last pivot is positive too
    expect(aug[n - 1][n - 1]).toBeGreaterThan(0);
  });

  it('the checks: the sums, the joints, the energy ½·u^T·K·u = ½·u^T·P + ½·u_R^T·R, and K·u − P − R, each within a hundred-millionth of its own scale and the rounding of its terms', () => {
    const settle = frameModel({ nodes: [{ x: 0, y: 0 }, { x: 10, y: 0 }, { x: 10, y: 8 }], members: [{ i: 0, j: 1 }, { i: 1, j: 2 }], supports: [{ node: 0, ...FIX }, { node: 2, ux: true, uy: true, rz: false, dy: -0.03, dx: 0.01 }], loads: [{ node: 1, fx: 0, fy: -6, m: 0 }], memberLoads: [{ kind: 'udl', member: 0, w: -1 }] });
    const s = solved(settle);
    expect(s.checks.map((c) => c.id)).toEqual(['sum-fx', 'sum-fy', 'sum-moment', 'joints', 'energy', 'system', 'solve']);
    for (const c of s.checks) expect(Math.abs(c.value), c.id).toBeLessThanOrEqual(TOLERANCES.residual * c.scale + c.allowance + 1e-300);
    expect(s.checks.every((c) => c.ok)).toBe(true);
    const Ku = matVec(s.K, s.u);
    const U = 0.5 * s.u.reduce((acc, v, k) => acc + v * Ku[k], 0);
    const W = 0.5 * s.u.reduce((acc, v, k) => acc + v * s.P[k], 0) + 0.5 * s.reactions.reduce((acc, r) => acc + s.u[r.dof - 1] * r.value, 0);
    near(U, W, 1e-9, 1e-12);
    expect(U).toBeGreaterThan(0);
  });

  it('K is symmetric, no diagonal entry is negative and K_FF is positive definite, in every problem offered, in both unit systems', () => {
    for (const units of ['us', 'si'] as const) {
      for (const template of TEMPLATE_IDS) {
        const f = reduce(reduce(emptyStiffness(), { type: 'units', units }), { type: 'template', template });
        const s = solved(toEngine(f).model);
        expect(step(s, 'assembled').facts.symmetric, `${template} ${units}`).toBe(true);
        // …and K_FF is positive definite, which is why no rows are exchanged
        expect(positiveDefinite(matrix(s, 'partition', 'K_FF')), `${template} ${units}`).toBe(true);
        s.K.forEach((row, r) => {
          expect(row[r], `${template} ${units}`).toBeGreaterThanOrEqual(0);
          row.forEach((v, c) => near(v, s.K[c][r], 1e-12, 1e-9));
        });
      }
    }
  });

  it('a zero off the diagonal: no member joins the nodes, a horizontal bar has no stiffness across it, or terms cancelled (the cross terms of the two-bar truss)', () => {
    // no member joins node 1 and node 2 of the two-bar truss: DOFs 1 and 3
    const two = solved(toEngine(defaultCase()).model);
    expect(two.K[0][2]).toBe(0);
    expect(two.K[1][3]).toBe(0);
    // terms that cancelled: the cross terms of the apex, DOFs 5 and 6
    expect(two.K[4][5]).toBeCloseTo(0, 9);
    expect(matrix(two, 'assembly#1', 'contribution')[4][5]).toBeGreaterThan(0);
    expect(matrix(two, 'assembly#2', 'contribution')[4][5]).toBeLessThan(0);
    // a horizontal bar (member 1 of the five-bar truss joins nodes 1 and 2 on y = 0): joined along x, no stiffness across it
    const five = solved(toEngine(reduce(emptyStiffness(), { type: 'template', template: 'truss-five-member' })).model);
    expect(five.members[0].s).toBe(0);
    expect(five.K[0][2]).not.toBe(0);
    expect(matrix(five, 'global-member#1', 'K_e')[0][1]).toBe(0);
    expect(matrix(five, 'global-member#1', 'K_e')[1][1]).toBe(0);
    for (const lang of LANGS) expect(prose(lang, 'method')).toContain(lang === 'en' ? 'a horizontal bar and a movement across it' : 'una barra horizontal y un movimiento transversal a ella');
  });

  it('before the supports K has no inverse: a movement of the whole structure as a rigid body takes no force, in a truss and in a frame', () => {
    for (const template of ['truss-five-member', 'frame-portal'] as const) {
      const s = solved(toEngine(reduce(emptyStiffness(), { type: 'template', template })).model);
      const nd = s.mode === 'frame' ? 3 : 2;
      const field = (kind: 'x' | 'y' | 'turn') => {
        const u = new Array<number>(s.K.length).fill(0);
        s.nodes.forEach((n, k) => {
          if (kind === 'x') u[nd * k] = 1;
          else if (kind === 'y') u[nd * k + 1] = 1;
          else {
            u[nd * k] = -n.y;
            u[nd * k + 1] = n.x;
            if (nd === 3) u[nd * k + 2] = 1;
          }
        });
        return u;
      };
      const top = Math.max(...s.K.flat().map(Math.abs));
      for (const kind of ['x', 'y', 'turn'] as const) {
        const u = field(kind);
        const size = Math.max(...u.map(Math.abs));
        for (const v of matVec(s.K, u)) expect(Math.abs(v), `${template} ${kind}`).toBeLessThanOrEqual(1e-9 * top * size);
      }
    }
  });

  it('the units of an entry: a force per length, a force per radian, a moment per radian', () => {
    expect(unitOf('us', 'stiffness', 'x', 'y')).toBe('kip/ft');
    expect(unitOf('us', 'stiffness', 'y', 'θ')).toBe('kip/rad');
    expect(unitOf('us', 'stiffness', 'θ', 'θ')).toBe('kip·ft/rad');
    expect(unitOf('si', 'stiffness', 'x', 'x')).toBe('kN/m');
    expect(unitOf('si', 'stiffness', 'x', 'θ')).toBe('kN/rad');
    expect(unitOf('si', 'stiffness', 'θ', 'θ')).toBe('kN·m/rad');
    for (const lang of LANGS) {
      const text = prose(lang, 'method');
      for (const unit of ['kip/ft', 'kN/m', 'kip/rad', 'kN/rad', 'kip·ft/rad', 'kN·m/rad']) expect(text).toContain(unit);
    }
    // the steps are in calculation units: E in kip/ft² and A in ft², kN/m² and m²
    expect([CALCULATION_UNITS.us.E, CALCULATION_UNITS.us.area, CALCULATION_UNITS.si.E, CALCULATION_UNITS.si.area]).toEqual(['kip/ft²', 'ft²', 'kN/m²', 'm²']);
    expect(prose('en', 'signs')).toContain('with E in kip/ft² and A in ft² (kN/m² and m²)');
    expect(prose('es', 'signs')).toContain('con E en kip/ft² y A en ft² (kN/m² y m²)');
  });

  it('the sway of a portal: 12EI/h³ for a column fixed at its foot, 24EI/h³ for two under a beam that cannot turn and columns that cannot shorten, so H sways it Hh³/(24EI)', () => {
    for (const [h, W, H, E, I] of [[12, 20, 5, 1000, 100], [3.6, 6, 40, 200, 0.0002], [30, 45, 2, 29000 * 144, 0.02]] as const) {
      // columns that cannot shorten: the rocking of the beam they allow is 48I/(A·W²) of the sway, so A is 10⁷·I/W² (a ratio of 5·10⁻⁶ at the most);
      // a beam that cannot turn: its I is a million times a column's
      const A = (1e7 * I) / (W * W);
      const s = solved(
        frameModel({
          E,
          A,
          I,
          nodes: [{ x: 0, y: 0 }, { x: W, y: 0 }, { x: 0, y: h }, { x: W, y: h }],
          members: [{ i: 0, j: 2 }, { i: 1, j: 3 }, { i: 2, j: 3, I: I * 1e6 }],
          supports: [{ node: 0, ...FIX }, { node: 1, ...FIX }],
          loads: [{ node: 2, fx: H, fy: 0, m: 0 }],
        }),
      );
      near(s.u[6], (H * h ** 3) / (24 * E * I), 1e-4);
      near(s.u[9], s.u[6], 1e-4);
      // the stiffness of one column against sway is the 12EI/h³ of its matrix
      near(localStiffness('frame', 1, E * I, h)[1][1], (12 * E * I) / h ** 3);
    }
    for (const lang of LANGS) {
      const text = prose(lang, 'method');
      for (const written of ['12EI/h³', '24EI/h³', 'Hh³/(24EI)']) expect(text, `${lang} ${written}`).toContain(written);
    }
  });
});

describe('stiffness page: what it refuses, and the numbers it says it refuses at', () => {
  const pin = { ux: true, uy: true, rz: false };
  const truss = (o: Partial<StiffnessModel> = {}): StiffnessModel => ({ ...toEngine(defaultCase()).model, ...o });

  it('two collinear bars meeting at a node with no support: a mechanism, the DOF named (2y) and the node that moves; a zero stands on the diagonal', () => {
    const m: StiffnessModel = { mode: 'truss', E: 1000, A: 10, nodes: [{ x: 0, y: 0 }, { x: 5, y: 0 }, { x: 10, y: 0 }], members: [{ i: 0, j: 1 }, { i: 1, j: 2 }], supports: [{ node: 0, ...pin }, { node: 2, ux: false, uy: true, rz: false }], loads: [{ node: 1, fx: 0, fy: -5, m: 0 }], memberLoads: [] };
    const out = failed(m);
    const mech = out.issues[0];
    expect(mech.code).toBe('mechanism');
    expect(mech.kind).toBe('sway');
    expect(mech.dof).toBe(4);
    expect(mech.nodes).toEqual([2]);
    // the zero on the diagonal: the first pivot of the DOF 2y is zero, and the steps up to it are returned
    const last = out.steps[out.steps.length - 1];
    expect(last.key).toBe('forward-pass#2');
    expect(last.facts.singular).toBe(true);
    expect(last.facts.pivot).toBe(0);
  });

  it('fewer than three restrained DOFs is refused before any solving, alone; three on parallel lines leave a movement of the whole structure', () => {
    const one = failed(truss({ supports: [{ node: 0, ...pin }] }));
    expect(one.issues).toEqual([{ code: 'few-supports', count: 2 }]);
    expect(one.steps).toEqual([]);
    const three = failed(frameModel({ nodes: [{ x: 0, y: 0 }, { x: 10, y: 0 }, { x: 20, y: 0 }], members: [{ i: 0, j: 1 }, { i: 1, j: 2 }], supports: [0, 1, 2].map((node) => ({ node, ux: false, uy: true, rz: false })) }));
    expect(three.issues[0].code).toBe('mechanism');
    expect(three.issues[0].kind).toBe('rigid-body');
  });

  it('a pivot that rounding cannot tell from zero is a mechanism when no member is strained by the movement; a solution whose results could be wrong by a millionth of the largest of their kind or more is solved with a warning that counts the figures', () => {
    expect([TOLERANCES.resolve, TOLERANCES.weak, TOLERANCES.residual]).toEqual([0.1, 1e-6, 1e-8]);
    // two bars on a line at 45° (a tilted one: nothing is exactly zero in it), their joint `e` ft off the line along the other diagonal: the stiffness across them is (e/L)² of the stiffness along them
    const model = (e: number): StiffnessModel => ({ mode: 'truss', E: 1000, A: 1, nodes: [{ x: 0, y: 0 }, { x: 20, y: 20 }, { x: 10 + e, y: 10 - e }], members: [{ i: 0, j: 2 }, { i: 1, j: 2 }], supports: [{ node: 0, ...pin }, { node: 1, ...pin }], loads: [{ node: 2, fx: 0, fy: -1, m: 0 }], memberLoads: [] });
    // 1e-14 ft off the line: the pivot is a trillion trillion trillionth of its diagonal, under its own rounding even in thirty figures, and the movement strains nothing to speak of: a mechanism
    expect(codes(model(1e-14))).toEqual(['mechanism']);
    // 1e-12 ft: a pivot of 1e-26 of its diagonal, which the arithmetic keeps with a handful of figures: it is stable, it is solved, and the warning counts the figures
    const loose = solved(model(1e-12));
    const w = loose.warnings.find((x) => x.code === 'near-mechanism');
    expect(w).toBeDefined();
    expect(w!.ratio!).toBeGreaterThan(TOLERANCES.weak);
    expect(w!.ratio!).toBeLessThan(TOLERANCES.resolve);
    expect(w!.count!).toBeGreaterThanOrEqual(1);
    // 0.05 ft off the line is a weak structure (a unit load moves it a length or so) but a well-scaled one: no figure is lost to rounding
    expect(solved(model(0.05)).warnings.map((x) => x.code)).not.toContain('near-mechanism');
  });

  it('each fault the page lists is refused with its entry named', () => {
    const base = toEngine(defaultCase()).model;
    const at = (extra: Partial<StiffnessModel>) => codes({ ...base, ...extra });
    // two nodes in one place
    expect(at({ nodes: [...base.nodes, { x: 8, y: 6 }], members: [...base.members, { i: 2, j: 3 }] })).toContain('duplicate-node');
    // a member from a node to itself
    expect(at({ members: [...base.members, { i: 2, j: 2 }] })).toContain('zero-length');
    // two members between the same pair of nodes
    expect(at({ members: [...base.members, { i: 2, j: 0 }] })).toContain('duplicate-member');
    // a node no member reaches
    expect(at({ nodes: [...base.nodes, { x: 30, y: 30 }] })).toContain('node-unconnected');
    // separate pieces of structure
    expect(at({ nodes: [...base.nodes, { x: 30, y: 30 }, { x: 40, y: 30 }], members: [...base.members, { i: 3, j: 4 }] })).toContain('disconnected');
    // a member under a hundred-thousandth of the structure's size in length
    const size = Math.hypot(16, 6);
    expect(TOLERANCES.short).toBe(1e-5);
    expect(at({ nodes: [...base.nodes, { x: 8 + 0.5 * 1e-5 * size, y: 6 }], members: [...base.members, { i: 2, j: 3 }] })).toContain('short-member');
    expect(at({ nodes: [...base.nodes, { x: 8 + 2 * 1e-5 * size, y: 6 }], members: [...base.members, { i: 2, j: 3 }] })).not.toContain('short-member');
    // a point load not strictly inside its member, in frame mode: at an end, past it, and in the middle (which is fine)
    const beam = (a: number) => codes(frameModel({ nodes: [{ x: 0, y: 0 }, { x: 10, y: 0 }], members: [{ i: 0, j: 1 }], supports: [{ node: 0, ...FIX }], memberLoads: [{ kind: 'point', member: 0, a, P: -1 }] }));
    expect(beam(0)).toContain('load-position');
    expect(beam(10)).toContain('load-position');
    expect(beam(11)).toContain('load-position');
    expect(solve(frameModel({ nodes: [{ x: 0, y: 0 }, { x: 10, y: 0 }], members: [{ i: 0, j: 1 }], supports: [{ node: 0, ...FIX }], memberLoads: [{ kind: 'point', member: 0, a: 5, P: -1 }] })).ok).toBe(true);
    // a section left blank where one is needed
    expect(at({ E: undefined })).toContain('section-missing');
    expect(codes(frameModel({ nodes: [{ x: 0, y: 0 }, { x: 10, y: 0 }], members: [{ i: 0, j: 1 }], supports: [{ node: 0, ...FIX }], I: undefined }))).toContain('section-missing');
    // a number too large for the arithmetic
    expect(at({ nodes: [{ x: 0, y: 0 }, { x: 16, y: 0 }, { x: 1e31, y: 6 }] })).toContain('number');
  });

  it('a truss keeps member loads typed in the form and does not use them, and says so; a settlement typed on a DOF the support leaves free has no effect, and says so', () => {
    const base = toEngine(defaultCase()).model;
    const loaded = solved({ ...base, memberLoads: [{ kind: 'udl', member: 0, w: -5 }] });
    expect(loaded.warnings).toEqual([{ code: 'member-loads-ignored', count: 1 }]);
    near(loaded.u[4], solved(base).u[4], 0, 0);
    // a support at the apex that holds nothing, with a settlement along x: nothing holds that DOF, so it does nothing
    const settle = solved({ ...base, supports: [...base.supports, { node: 2, ux: false, uy: false, rz: false, dx: 0.5 }] });
    expect(settle.warnings.map((w) => w.code)).toEqual(['settlement-ignored', 'empty-support']);
    settle.u.forEach((v, k) => near(v, solved(base).u[k], 0, 0));
  });

  it('the limits it states are the engine’s: 12 nodes, 20 members, 12 supports, 40 nodal loads and 24 member loads, at most 36 DOFs, the elimination printed up to 12 free DOFs', () => {
    expect([MAX_NODES, MAX_MEMBERS, MAX_SUPPORTS, MAX_LOADS, MAX_MEMBER_LOADS, MAX_DOFS, RECORD_LIMIT]).toEqual([12, 20, 12, 40, 24, 36, 12]);
    expect(MAX_NODES * 3).toBe(MAX_DOFS);
    for (const [lang, re] of [
      ['en', /^Up to 12 nodes, 20 members, 12 supports, 40 nodal loads and 24 member loads, which is at most 36 DOFs\./],
      ['es', /^Hasta 12 nudos, 20 barras, 12 apoyos, 40 cargas nodales y 24 cargas en barras, es decir, 36 GDL como máximo\./],
    ] as const) {
      expect(stiffnessPage[lang].limits.items.filter((x) => re.test(x))).toHaveLength(1);
    }
    expect(stiffnessPage.en.sub).toContain(`up to ${MAX_NODES} nodes`);
    expect(stiffnessPage.es.sub).toContain(`hasta ${MAX_NODES} nudos`);
    for (const lang of LANGS) expect(stiffnessPage[lang].limits.items.join(' ')).toMatch(/\b12 (free )?(DOFs|GDL libres)/);
    // one member past a cap is refused; the elimination is written out at 12 free DOFs and not at 15
    const chain = (n: number) => frameModel({ nodes: Array.from({ length: n }, (_, k) => ({ x: 10 * k, y: 0 })), members: Array.from({ length: n - 1 }, (_, k) => ({ i: k, j: k + 1 })), supports: [{ node: 0, ...FIX }], loads: [{ node: n - 1, fx: 0, fy: -1, m: 0 }] });
    const five = solved(chain(5));
    expect(five.free).toHaveLength(12);
    expect(five.steps.some((x) => x.id === 'forward-pass')).toBe(true);
    expect(step(five, 'solution').facts.recorded).toBe(true);
    const six = solved(chain(6));
    expect(six.free).toHaveLength(15);
    expect(six.steps.some((x) => x.id === 'forward-pass' || x.id === 'augmented' || x.id === 'back-substitution')).toBe(false);
    expect(step(six, 'solution').facts.recorded).toBe(false);
    expect(codes(chain(13))).toContain('too-big');
  });

  it('the tolerances said in words are the engine’s: a billionth, a millionth, a hundred-millionth, a hundred-thousandth, and a value under a billionth of its matrix is printed as 0', () => {
    expect(TOLERANCES.resolve).toBe(0.1);
    expect(TOLERANCES.weak).toBe(1e-6);
    expect(TOLERANCES.large).toBe(0.1);
    expect(TOLERANCES.residual).toBe(1e-8);
    expect(TOLERANCES.short).toBe(1e-5);
    expect(TOLERANCES.zero).toBe(1e-9);
    const method = prose('en', 'method');
    expect(method).toMatch(/a pivot no more than ten times its own error is taken as zero/);
    expect(method).toMatch(/A solution whose results could be wrong by a millionth of the largest of their kind or more, but by less than a tenth, is solved with a warning/);
    expect(method).toMatch(/Each is held to a hundred-millionth of a scale of its own, with an allowance for the rounding in its terms/);
    expect(prose('en', 'assumes')).toMatch(/the chord of a member turns past a tenth of a radian, when an end of a frame member turns past a tenth of a radian away from its chord, or when a member stretches or shortens by over a tenth of its own length/);
    // the one tolerance for “the same number”: the closed form of a bar against the product, K against its transpose
    expect(TOLERANCES.agree).toBe(1e-12);
    expect(method).toMatch(/the tool tests it to a millionth of a millionth of the largest entry/);
    expect(prose('en', 'limits')).toMatch(/under a hundred-thousandth of the structure’s size/);
    expect(prose('en', 'signs')).toMatch(/A number is printed as 0 only when it is no larger than the rounding of the terms it was made of/);
    expect(prose('en', 'signs')).toMatch(/a sum under a billionth of its scale is printed as 0/);
    const metodo = prose('es', 'method');
    expect(metodo).toMatch(/un pivote que no pasa de diez veces su propio error se toma como cero/);
    expect(metodo).toMatch(/Una solución cuyos resultados pudieran errar en una millonésima del mayor de su clase o más, pero en menos de una décima, se resuelve con una advertencia/);
    expect(metodo).toMatch(/Cada una se limita a una cienmillonésima de una escala propia, con un margen para el redondeo de sus términos/);
    expect(prose('es', 'assumes')).toMatch(/una barra gira su cuerda más allá de una décima de radián, cuando un extremo de una barra de pórtico se separa de su cuerda más allá de una décima de radián, o cuando una barra se alarga o se acorta por encima de una décima de su propia longitud/);
    expect(metodo).toMatch(/la herramienta lo comprueba con una diferencia máxima de una millonésima de millonésima del mayor término/);
    expect(prose('es', 'limits')).toMatch(/menor que una cienmilésima del tamaño de la estructura/);
    expect(prose('es', 'signs')).toMatch(/Un número se imprime como 0 solo cuando no es mayor que el redondeo de los términos con que se formó/);
    expect(prose('es', 'signs')).toMatch(/una suma menor que una milmillonésima de su escala se imprime como 0/);
  });

  it('the stiffness range it states is the engine’s: a member up to some twenty orders of magnitude stiffer is solved to eight figures or more; beyond, a warning counts the figures and the checks refuse what they cannot hold', () => {
    expect(stiffnessPage.en.limits.items.join(' ')).toContain('up to some twenty orders of magnitude stiffer than the rest is solved to eight figures or more');
    expect(stiffnessPage.es.limits.items.join(' ')).toContain('hasta unos veinte órdenes de magnitud más rígida que el resto se resuelve con ocho cifras o más');
    expect(stiffnessPage.en.limits.items.join(' ')).toContain('refused as ill-conditioned, and one with not a figure left as a stiffness range');
    // a hundred structures with one member made 10²⁰ times stiffer in its area, against the 120-digit oracle
    for (let s = 0; s < 50; s++) {
      for (const mode of ['truss', 'frame'] as const) {
        const c = compare(real(30000 + s, mode, 20, 'A', true));
        if (c.exact === 'singular') continue;
        expect(c.engine, `${mode} #${s}`).toBe('ok');
        expect(c.errU, `${mode} #${s}`).toBeLessThan(1e-8);
        expect(c.errR, `${mode} #${s}`).toBeLessThan(1e-8);
        expect(c.errF, `${mode} #${s}`).toBeLessThan(1e-8);
      }
    }
  });

  it('the address is written after the key the form uses', () => {
    expect(STIFFNESS_KEY).toBe('m');
    for (const lang of LANGS) expect(JSON.stringify(stiffnessPage[lang].signs)).toContain(`#${STIFFNESS_KEY}=`);
  });
});

describe('stiffness page: the words', () => {
  const en = leaves(stiffnessPage.en);
  const es = leaves(stiffnessPage.es);
  const OTHERS = (lang: Lang) => [beamStrings[lang].page, spanPage[lang], continuousPage[lang], shaftPage[lang], trussPage[lang], cablePage[lang], cableSagPage[lang], framePage[lang]];
  const text = (lang: Lang) =>
    leaves(stiffnessPage[lang])
      .filter(([path]) => !LEGAL.test(path))
      .map(([, s]) => s);

  it('says the same things in both languages, and leaves nothing blank', () => {
    expect(es.map(([p]) => p)).toEqual(en.map(([p]) => p));
    for (const [path, s] of [...en, ...es]) expect(s.trim().length, path).toBeGreaterThan(0);
    const parts = (page: unknown) => leaves(page).map(([p]) => p.replace(/\[\d+\]/g, '[]'));
    expect([...new Set(parts(stiffnessPage.en))]).toEqual([...new Set(parts(beamStrings.en.page))]);
    // the same number of paragraphs and notes in each language
    for (const part of ['method', 'assumes', 'limits', 'signs'] as const) {
      const count = (lang: Lang) => ('paragraphs' in stiffnessPage[lang][part] ? (stiffnessPage[lang][part] as { paragraphs: string[] }).paragraphs : (stiffnessPage[lang][part] as { items: string[] }).items).length;
      expect(count('es'), part).toBe(count('en'));
    }
  });

  it('the Spanish is Spanish: no sentence is the English one left in place, no grouping comma, “usted”, no tuteo', () => {
    const same = en.filter(([, s], i) => s === es[i][1] && s.split(/\s+/).length > 3).map(([path]) => path);
    expect(same).toEqual([]);
    for (const [path, s] of es) {
      expect(s, path).not.toMatch(/\d,\d{3}(?!\d)/);
      expect(s, path).not.toMatch(/\b(introduces|escribes|eliges|incluyes|pides|puedes|tienes|quieres|tu|tus|ti|te)\b/);
      expect(s, path).not.toMatch(/(^|\s)-\d/);
    }
    for (const [path, s] of en) expect(s, path).not.toMatch(/(^|\s)-\d/);
    // the thousands of a figure: a comma in English, a narrow no-break space in Spanish
    expect(prose('en', 'method')).toMatch(/\d,\d{3}/);
    expect(prose('es', 'method')).toMatch(new RegExp(`\\d${NNBSP}\\d{3}`));
    // the Spanish says the words an engineer there says
    const spanish = JSON.stringify(stiffnessPage.es);
    for (const re of [/matriz de rigidez/, /grados de libertad/, /GDL/, /ensamblaje/, /eliminación de Gauss/, /sustitución hacia atrás/, /cercha/, /pórtico/, /barra/, /nudo/, /empotramiento/, /fuerzas de empotramiento perfecto/, /cargas nodales equivalentes/, /vector de código/, /asentamiento/, /mecanismo/, /mal condicionada/, /isostático|hiperestático|reacciones/, /desplazamientos/]) {
      expect(spanish).toMatch(re);
    }
    expect(spanish).not.toMatch(/\bmarco\b|\bjuntas?\b|\bmiembros?\b/i);
    // the formulas of the steps say DOF, and the text says so once, where it introduces GDL
    expect(spanish.match(/\bDOF\b/g)).toHaveLength(1);
    expect(stiffnessPage.es.method.paragraphs[1]).toContain('GDL; las fórmulas de la herramienta los llaman DOF');
    // the formulas are the same in both: a case's symbols are not translated
    const formulas = (s: string) =>
      s.match(/12EI\/L³|6EI\/L²|4EI\/L|2EI\/L|EA\/L|wL²\/12|wL\/2|qL\/2|Pb²\(3a\+b\)\/L³|Pab²\/L²|Pa²\(a\+3b\)\/L³|Pa²b\/L²|K_FF·u_F = P_F − K_FR·u_R|K_e = T\^T·k·T|u_local = T·u_global|u_local = T·u_e|f = k·u_local|K ← K \+ K_e|−T\^T·f_FE|R = K_RF·u_F \+ K_RR·u_R − P_R|K·u = P \+ R|K·u − P − R|m_ik = a_ik\/a_kk|a_ij ← a_ij − m_ik·a_kj|u_k = \(b_k − Σ a_kj·u_j\)\/a_kk|U = ½·u\^T·K·u|PL²\/\(2EI\)|PL³\/\(3EI\)|Hh³\/\(24EI\)|24EI\/h³|12EI\/h³|m = \(−6EI\/L²\)\/\(12EI\/L³\) = −L\/2|f_FE = \[0, 10, 16\.667, 0, 10, −16\.667\]/g) ?? [];
    en.forEach(([path, s], i) => expect(formulas(es[i][1]), path).toEqual(formulas(s)));
    expect(en.flatMap(([, s]) => formulas(s)).length).toBeGreaterThanOrEqual(45);
  });

  it('names no other company’s product, no price, no date, no standard, no verdict; “free” only as the free DOFs against the restrained ones', () => {
    for (const [path, s] of [...en, ...es]) {
      expect(s, path).not.toMatch(/skyciv|ftool|sap2000|etabs|robot|risa|staad|autodesk|enercalc|clearcalcs|midas|ansys|dlubal|tekla/i);
      // the engineering word: free DOFs against restrained ones
      const noFree = s.replace(/\bfree (and restrained|\(F\)|rows|DOFs?|displacements)|leaves free\b|other one is free\b/g, '');
      expect(noFree, path).not.toMatch(/\bfree\b|\bgratis\b|\bgratuit|\$|\bprice\b|\bprecio\b|\b20\d\d\b/i);
      expect(s, path).not.toMatch(/Civil\s*&\s*Structural/i);
      expect(s, path).not.toMatch(/\b(ACI|AISC|ASCE|ASME|ANSI|ISO|DIN|IBC|Eurocode|Eurocódigo|LRFD|ASD|NDS|AWS|ASTM|NSR|NTC)\b/);
      if (LEGAL.test(path)) continue;
      expect(s, path).not.toMatch(/\b(ok|okay|pass|passes|passed|fail|fails|failed|adequate|inadequate|sufficient|insufficient|enough|acceptable|complies|satisf\w*|safe|safely|unsafe|allowable|permissible|recommended|verified|reliable|rely|relied)\b/i);
      expect(s, path).not.toMatch(/\b(cumple|cumplen|no cumple|falla|fallan|aprobad\w*|suficiente|insuficiente|adecuad\w*|inadecuad\w*|aceptable|basta|segur[oa]|satisf\w*|verifica|admisible|permisible|recomendad\w*|confiable)\b/i);
    }
    // the one place “free” is said in the Spanish sense is “libres”, and the text says it
    expect(prose('es', 'method')).toMatch(/libres/);
  });

  it('writes no figure but those of its formulas, its limits, its cases and its 90 degrees', () => {
    const figures = (lang: Lang) => {
      const written = text(lang).join(' ');
      // the thousands of a figure are one figure
      const joined = written.replace(/(\d)[, ](\d{3})(?!\d)/g, '$1$2');
      return [...new Set(joined.match(/\d+(\.\d+)?/g) ?? [])].sort();
    };
    // Formulas and counts: 0, 1, 2, 3, 4, 5, 6 (the 6 × 6 matrix, the six movements, the DOFs of node 3) and 24 (24EI/h³, 24 member loads);
    // the limits: 12 (nodes, supports, free DOFs), 20, 40, 36; the 90° of the axes; the two-bar truss, each number held to the engine above:
    // 8, 16 (the coordinates), 10 (the bar length, A, V, the reaction), 29000, 290000 (E·A), 0.8, 0.6, 0.64, 0.48, 0.36 (c², cs, s²), 37120, 20880,
    // 30 (the load, a reaction), 0.00647, 0.01724 (inches), 7.5, 22.5, 12.5, 37.5 (reactions and bar forces), 50 does not appear;
    // the sign case: 2, 10, 16.667. 3, 4 and 5 are also node and DOF numbers. 6 is also the 6 ft.
    // The numbers of the steps the paragraphs name, 1 to 14 (held to the engine's stage numbers above): 7, 9, 11, 13 and 14 are the ones no other figure gives.
    const expected = ['0', '0.36', '0.48', '0.6', '0.64', '0.8', '0.00647', '0.01724', '1', '10', '11', '12', '12.5', '13', '14', '16', '16.667', '2', '20', '20880', '22.5', '24', '290000', '29000', '3', '30', '36', '37.5', '37120', '4', '40', '5', '6', '7', '7.5', '8', '9', '90'].sort();
    for (const lang of LANGS) expect(figures(lang), lang).toEqual(expected);
  });

  it('names the two calculators that solve whole structures without printing a matrix as the catalogue names them, and says what each one takes that this does not', () => {
    const rows = calculatorFamilies.flatMap((f) => f.items);
    for (const [en, es] of [['Truss member forces', 'Fuerzas en barras de cerchas'], ['Plane frame analysis', 'Análisis de pórticos planos']]) {
      const row = rows.find((r) => r.name.en === en)!;
      expect(row).toBeDefined();
      expect(row.name.es).toBe(es);
      expect(row.href, en).toBeDefined();
      expect(JSON.stringify(stiffnessPage.en.limits)).toContain(row.name.en);
      expect(JSON.stringify(stiffnessPage.es.limits)).toContain(row.name.es);
    }
    // what the second takes: hinges, springs, inclined supports, temperature loads and larger structures — all in that calculator's own notes
    const frame = JSON.stringify(framePage.en);
    for (const re of [/hinge/, /spring|elastic/, /inclined|any angle/, /temperature/, /50 nodes/]) expect(frame).toMatch(re);
    expect(stiffnessPage.en.limits.items.join(' ')).toMatch(/hinges, springs, inclined supports, temperature loads and larger structures/);
    expect(stiffnessPage.es.limits.items.join(' ')).toMatch(/rótulas, resortes, apoyos inclinados, cargas de temperatura y estructuras mayores/);
  });

  it('the search words are in the title and the description, each in its own language', () => {
    for (const re of [/stiffness/i, /matri/i, /truss/i, /frame/i, /step/i]) expect(stiffnessPage.en.title + stiffnessPage.en.h1).toMatch(re);
    for (const re of [/matriz/i, /rigidez/i, /cerchas/i, /pórticos/i, /paso/i]) expect(stiffnessPage.es.title + stiffnessPage.es.h1).toMatch(re);
    for (const re of [/^Stiffness matrix calculator for 2D trusses and frames, step by step/, /local and global matrices/, /assembly/, /displacements/, /reactions/, /truss/, /frame/, /member forces/]) expect(stiffnessPage.en.description).toMatch(re);
    // a title may not say a word twice, so “step by step” is in the h1 and the description, and the title says what the page is
    expect(stiffnessPage.en.title).toMatch(/Stiffness Matrix Calculator/);
    expect(stiffnessPage.es.title).toMatch(/Calculadora de matriz de rigidez/);
    for (const re of [/^Calculadora de matriz de rigidez de cerchas y pórticos 2D, paso a paso/, /matrices locales y globales/, /ensamblaje/, /desplazamientos/, /reacciones/, /cercha/, /pórtico/, /fuerzas/]) expect(stiffnessPage.es.description).toMatch(re);
  });

  it('says what it leaves out, each by name: second-order effects and buckling, prismatic members, shear deformation, no releases, member loads, settlements, typical moduli, a single case, no design check, the cap, the refusals', () => {
    const NOT: [(l: Lang) => string[], RegExp, RegExp][] = [
      [(l) => stiffnessPage[l].assumes.items, /second-order effects, P–Δ among them, and buckling are not modelled/, /los efectos de segundo orden, entre ellos P–Δ, y el pandeo no se modelan/],
      [(l) => stiffnessPage[l].assumes.items, /^Each member is prismatic: one section, and so one E, one A and one I, for its whole length/, /^Cada barra es prismática: una sola sección y, por tanto, un solo valor de E, de A y de I en toda su longitud/],
      [(l) => stiffnessPage[l].assumes.items, /the distortion shear would cause is left out/, /se deja fuera la distorsión que causaría el cortante/],
      [(l) => stiffnessPage[l].assumes.items, /Hinges and releases, springs and inclined supports are not offered here/, /Aquí no se ofrecen rótulas ni liberaciones, resortes ni apoyos inclinados/],
      [(l) => stiffnessPage[l].assumes.items, /Member loads typed in truss mode are kept and not used/, /Las cargas sobre barras que se escriban en modo cercha se conservan y no se usan/],
      [(l) => stiffnessPage[l].assumes.items, /a point load strictly between the ends/, /una carga puntual estrictamente entre los extremos/],
      [(l) => stiffnessPage[l].assumes.items, /There is no temperature load, and no self-weight unless it is entered as a load/, /No hay carga de temperatura ni peso propio, salvo que se introduzca como carga/],
      [(l) => stiffnessPage[l].assumes.items, /A value typed on a DOF the support leaves free has no effect/, /Un valor escrito en un GDL que el apoyo deja libre no tiene efecto/],
      [(l) => stiffnessPage[l].assumes.items, /typical values: enter the modulus and the section of what is actually specified/, /son valores típicos: introduzca el módulo y la sección de lo que realmente se especifique/],
      [(l) => stiffnessPage[l].assumes.items, /with no factor and no combination/, /sin factor ni combinación/],
      [(l) => stiffnessPage[l].limits.items, /^The results are displacements, reactions and member end forces, and that is all: no design code, no factored load, no member or connection sized\. Judging a member is left to you\./, /^Los resultados son desplazamientos, reacciones y fuerzas de extremo de las barras, y solo eso: no hay norma de diseño, ni carga mayorada, ni barra o conexión dimensionada\. Juzgar una barra le corresponde a usted\./],
      [(l) => stiffnessPage[l].limits.items, /^A structure in which some movement meets no resistance, because the members can swing without stretching or shortening, is refused/, /^Se rechaza una estructura en la que algún movimiento no encuentra resistencia, porque las barras pueden girar sin alargarse ni acortarse/],
      [(l) => stiffnessPage[l].limits.items, /^Fewer than three restrained DOFs is refused/, /^Menos de tres GDL restringidos se rechaza/],
      [(l) => stiffnessPage[l].limits.items, /^Each of these is refused, and the entry at fault is named: two nodes in one place;/, /^Cada una de estas faltas se rechaza, y se nombra la entrada que la causa: dos nudos coincidentes;/],
      [(l) => stiffnessPage[l].limits.items, /refused as ill-conditioned/, /se rechaza por mal condicionada/],
    ];
    for (const [list, inEnglish, inSpanish] of NOT) {
      expect(list('en').filter((x) => inEnglish.test(x)), String(inEnglish)).toHaveLength(1);
      expect(list('es').filter((x) => inSpanish.test(x)), String(inSpanish)).toHaveLength(1);
    }
    // “refused as ill-conditioned” is also in the method, where the checks are; the limits say it for the contrast of stiffnesses
    expect(prose('en', 'method')).toMatch(/refused as ill-conditioned/);
    expect(prose('es', 'method')).toMatch(/se rechaza por mal condicionada/);
    expect(stiffnessPage.en.limits.items).toHaveLength(stiffnessPage.es.limits.items.length);
    expect(stiffnessPage.en.assumes.items).toHaveLength(stiffnessPage.es.assumes.items.length);
    expect(stiffnessPage.en.signs.items).toHaveLength(stiffnessPage.es.signs.items.length);
  });

  it('a stiffness page says stiffness and DOF; it does not give the structure’s verdict anywhere', () => {
    expect(en.filter(([, s]) => /\bstiffness\b/i.test(s)).length).toBeGreaterThan(8);
    expect(es.filter(([, s]) => /\brigidez\b/i.test(s)).length).toBeGreaterThan(8);
    expect(en.filter(([, s]) => /\bDOFs?\b/.test(s)).length).toBeGreaterThan(12);
    expect(es.filter(([, s]) => /\bGDL\b/.test(s)).length).toBeGreaterThan(12);
  });

  it('the legal words are the first calculator’s own, and the credit names this calculator', () => {
    for (const lang of LANGS) {
      const ours = stiffnessPage[lang];
      const first = beamStrings[lang].page;
      expect(ours.disclaimer).toBe(first.disclaimer);
      expect(ours.sheet.kind).toBe(first.sheet.kind);
      expect(ours.sheet.margin).toBe(first.sheet.margin);
      for (const key of ['{firm}', '{address}']) expect(ours.sheet.credit, `${lang} ${key}`).toContain(key);
      for (const other of OTHERS(lang)) expect(ours.sheet.credit).not.toBe(other.sheet.credit);
      expect(ours.sheet.credit).toMatch(lang === 'en' ? /stiffness matrix calculator/ : /calculadora de matriz de rigidez/);
    }
  });

  it('no sentence of the other calculators’ pages or forms, nor a line of the catalogue, is said again here, beyond the legal words', () => {
    const rows = calculatorFamilies.flatMap((f) => f.items);
    for (const lang of LANGS) {
      const ours = leaves(stiffnessPage[lang]).filter(([path]) => !LEGAL.test(path));
      const theirs = [
        ...OTHERS(lang).flatMap((page) => leaves(page)),
        ...leaves(beamStrings[lang].ui),
        ...leaves(spanUi[lang]),
        ...leaves(continuousUi[lang]),
        ...leaves(shaftUi[lang]),
        ...leaves(trussUi[lang]),
        ...leaves(cableUi[lang]),
        ...leaves(cableSagUi[lang]),
        ...leaves(frameUi[lang]),
      ].map(([, s]) => s);
      for (const [path, s] of ours) {
        expect(sharedRuns([s], theirs), `${lang} ${path}`).toEqual([]);
        expect(sharedRuns([s], rows.map((r) => r.does[lang])), `${lang} ${path}`).toEqual([]);
      }
      expect(sharedRuns([stiffnessPage[lang].disclaimer.body], theirs).length).toBeGreaterThan(20);
    }
  });

  it('no sentence the form already says is said again here (the signs and the facts may agree word for word)', async () => {
    const { stiffnessUi } = await import('@/lib/calc/stiffness/strings');
    for (const lang of LANGS) {
      const form = leaves(stiffnessUi[lang]).map(([, s]) => s);
      for (const [path, s] of leaves(stiffnessPage[lang]).filter(([p]) => !LEGAL.test(p))) {
        if (/^(signs|facts)/.test(path)) continue;
        expect(sharedRuns([s], form), `${lang} ${path} (form)`).toEqual([]);
      }
    }
  });

  it('the view declares the same address', () => {
    expect(readFileSync(join(__dirname, 'StiffnessView.tsx'), 'utf8').replace(/\r\n/g, '\n')).toContain(`STIFFNESS_PATH = '${STIFFNESS_PATH}'`);
  });

  it('the h1 begins with the catalogue’s name for the row, which links here', () => {
    const row = calculatorFamilies.flatMap((f) => f.items).find((i) => i.href === STIFFNESS_PATH)!;
    expect(row).toBeDefined();
    expect(openCalculatorPaths).toContain(STIFFNESS_PATH);
    expect(openCalculatorPaths[openCalculatorPaths.length - 1]).toBe(STIFFNESS_PATH);
    for (const lang of LANGS) expect(stiffnessPage[lang].h1.startsWith(row.name[lang]), lang).toBe(true);
    expect(row.name).toEqual({ en: 'Stiffness matrix, step by step', es: 'Matriz de rigidez, paso a paso' });
  });

  it('a search result fits: the title and the description are within their pixel budgets, every character has a width, and the title repeats no word', () => {
    for (const lang of LANGS) {
      const { title, description } = stiffnessPage[lang];
      expect(unmeasured(title), lang).toEqual([]);
      expect(unmeasured(description), lang).toEqual([]);
      expect(titlePx(title), lang).toBeLessThanOrEqual(TITLE_BUDGET_PX);
      expect(descriptionPx(description), lang).toBeLessThanOrEqual(DESCRIPTION_LIMIT_PX);
      expect(repeatedWords(title), lang).toEqual([]);
    }
  });
});
