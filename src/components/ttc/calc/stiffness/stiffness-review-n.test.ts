import { afterEach, describe, expect, it, vi } from 'vitest';
import { analyseSafely } from '@/lib/calc/stiffness/analysis';
import { defaultStiffness, emptyStiffness, reduceStiffness, type StiffnessForm } from '@/lib/calc/stiffness/model';
import { stiffnessPage } from '@/lib/calc/stiffness/page-strings';
import { stiffnessUi } from '@/lib/calc/stiffness/strings';
import { TEMPLATE_IDS, type TemplateId } from '@/lib/calc/stiffness/templates';
import type { MatrixBlock, Step } from '@/lib/calc/stiffness/types';
import type { Lang } from '@/lib/ttc/i18n';
import { DEFAULT_FORMAT } from './numfmt';
import { labelsOf, stepBody, stepView, type StepContext } from './steps';
import { issueSentence, warningSentence } from './text';

vi.setConfig({ testTimeout: 120_000 });
afterEach(() => new Promise<void>((done) => setTimeout(done, 0)));

/**
 * THE REVIEW ROUND OF THE WORDS AND TABLES OF THE STEPS: each test is a defect of the adversarial review (two tables with one name, "pass" for the round of the
 * elimination and for a check that is met, a sentence about loads alone where a settlement is the load, a unit list that reads as one, a zero pivot said to be zero
 * where it was only lost in rounding, a Copy that gives no units), with the case that showed it.
 */

const LANGS: Lang[] = ['en', 'es'];
const tpl = (id: TemplateId, units: 'us' | 'si' = 'us') => reduceStiffness(emptyStiffness(units), { type: 'template', template: id });
const ctxOf = (form: StiffnessForm, lang: Lang = 'en'): StepContext => ({ w: stiffnessUi[lang], system: form.units, mode: form.mode, format: DEFAULT_FORMAT });
const stepsOf = (form: StiffnessForm): Step[] => {
  const a = analyseSafely(form);
  return a.solution?.steps ?? a.partial;
};
const views = (form: StiffnessForm, lang: Lang = 'en') => {
  const steps = stepsOf(form);
  const labels = labelsOf(steps);
  const c = ctxOf(form, lang);
  return steps.map((s) => ({ step: s, view: stepView(s, labels, c) }));
};
const text = (form: StiffnessForm, id: Step['id'], lang: Lang = 'en') => views(form, lang).filter((v) => v.step.id === id).map((v) => v.view.paragraphs.join(' '));
function leaves(value: unknown, path = ''): [string, string][] {
  if (typeof value === 'string') return [[path, value]];
  if (Array.isArray(value)) return value.flatMap((v, i) => leaves(v, `${path}[${i}]`));
  if (value && typeof value === 'object') return Object.entries(value).flatMap(([k, v]) => leaves(v, path ? `${path}.${k}` : k));
  return [];
}

describe('E9/U10/B8/D14: no two tables of a card share a name', () => {
  it('every card of every problem, in both unit systems and both languages: the captions, which are the names the Copy buttons carry, are all different, and no table is empty', () => {
    for (const id of TEMPLATE_IDS) {
      for (const units of ['us', 'si'] as const) {
        for (const lang of LANGS) {
          const form = tpl(id, units);
          for (const step of stepsOf(form)) {
            const tables = stepBody(step, ctxOf(form, lang)).flatMap((item) => (item.kind === 'table' ? [item.model] : []));
            const captions = tables.map((t) => t.caption);
            expect(new Set(captions).size, `${id} ${units} ${lang} ${step.key}: ${captions.join(' | ')}`).toBe(captions.length);
            expect(new Set(tables.map((t) => t.name)).size, `${id} ${units} ${lang} ${step.key}`).toBe(tables.length);
            expect(new Set(tables.map((t) => t.id)).size, `${id} ${units} ${lang} ${step.key}`).toBe(tables.length);
            for (const t of tables) expect(t.rowLabels.length, `${id} ${units} ${lang} ${step.key} ${t.id}`).toBeGreaterThan(0);
          }
        }
      }
    }
  });
  it('the solution of step 10 and the checks of step 14 name each of their two tables for what it is', () => {
    const form = tpl('frame-portal');
    const body = (key: string, lang: Lang = 'en') => stepBody(stepsOf(form).find((s) => s.key === key)!, ctxOf(form, lang)).flatMap((i) => (i.kind === 'table' ? [i.model.caption] : []));
    expect(body('solution')).toEqual(['Solution u_F', 'Residual of each equation, K_FF·u_F − rhs']);
    expect(body('checks')).toEqual(['Joint imbalance at each DOF', 'Residual K·u − P − R at each DOF']);
    expect(body('solution', 'es')).toEqual(['Solución u_F', 'Residuo de cada ecuación, K_FF·u_F − rhs']);
    expect(body('checks', 'es')).toEqual(['Desequilibrio del nudo en cada GDL', 'En cada GDL, el residuo K·u − P − R']);
    // a structure with nothing free has no unknown to tabulate, and its solution step prints no empty table
    expect(stepBody(stepsOf(tpl('frame-fixed-point')).find((s) => s.key === 'solution')!, ctxOf(tpl('frame-fixed-point'))).filter((i) => i.kind === 'table')).toHaveLength(0);
  });
});

describe('E10/T6/B16/U11/T19: the round of the elimination is a column, and a check is within its tolerance', () => {
  it('the tool’s words do not say pass, passes or pasada for anything, and say column / columna where they number the elimination', () => {
    // (a hole is not a word: “{pass}” is the number of the column, which the library calls the pass it records)
    const spoken = (s: string) => s.replace(/\{[^}]*\}/g, '');
    for (const [path, s] of leaves(stiffnessUi.en)) expect(spoken(s), path).not.toMatch(/\bpass(es|ed)?\b/i);
    for (const [path, s] of leaves(stiffnessUi.es)) expect(spoken(s), path).not.toMatch(/\bpasadas?\b/i);
    const form = tpl('frame-portal');
    const v = views(form);
    expect(v.find((x) => x.step.key === 'forward-pass#3')!.view.title).toBe('Forward elimination, column 3');
    expect(views(form, 'es').find((x) => x.step.key === 'forward-pass#3')!.view.title).toBe('Eliminación hacia adelante, columna 3');
    const matrix = (key: string) => stepBody(stepsOf(form).find((s) => s.key === key)!, ctxOf(form)).flatMap((i) => (i.kind === 'table' ? [i.model.caption] : []));
    expect(matrix('forward-pass#2')).toEqual(['Multipliers of column 2', 'Augmented matrix after column 2']);
    expect(text(form, 'forward-pass')[0]).toMatch(/^Column 1 takes the diagonal entry/);
    expect(stiffnessUi.en.highlights.eliminated).toBe('entries under the pivot that this column makes zero');
    expect(stiffnessUi.en.highlights.updated).toBe('entries this column changes');
  });
  it('step 14 says the checks are within their tolerance, never that they pass, fail or are independent', () => {
    for (const lang of LANGS) {
      const checks = leaves(stiffnessUi[lang].steps.checks).map(([, s]) => s).join(' ');
      expect(checks, lang).not.toMatch(/\b(pass(es)?|fails?|independent\w*|independiente\w*|verificaci\w*|falla\w*|se cumple\w*)\b/i);
    }
    const t = text(tpl('truss-two-bar'), 'checks')[0];
    expect(t).toContain('Three checks catch a mistake.');
    // the force scale is the loads added up (20 + 30 kip), the largest reaction (30) or the largest end force (37.5): 50 kip. It is not inflated by the sum of the sizes of the terms of an equation
    expect(t).toContain('the force scale, 50 kip (the largest of the loads added up, the largest reaction and the largest end force)');
    expect(t).not.toContain('sum of the sizes of the terms in one equation');
    expect(t).not.toContain('problem’s force scale');
    expect(text(tpl('truss-two-bar'), 'checks', 'es')[0]).toContain('Tres comprobaciones detectan un error');
  });
});

describe('T3: the reactions come out of the loads and the settlements when a support settles', () => {
  it('a fixed beam with nothing free to move: the loads alone, until a support settles; then the loads and the settlements, in step 1 and in step 9', () => {
    const plain = tpl('frame-fixed-point');
    const settled = reduceStiffness(plain, { type: 'patch', list: 'supports', id: plain.supports[1].id, patch: { dy: -0.5 } });
    for (const lang of LANGS) {
      const loadsAlone = lang === 'en' ? 'the reactions will come out of the loads alone' : 'las reacciones salen solo de las cargas';
      const withSettlements = lang === 'en' ? 'the reactions will come out of the loads and the settlements' : 'las reacciones salen de las cargas y de los asentamientos';
      expect(text(plain, 'structure', lang)[0], lang).toContain(loadsAlone);
      expect(text(plain, 'structure', lang)[0], lang).not.toContain(withSettlements);
      expect(text(settled, 'structure', lang)[0], lang).toContain(withSettlements);
      expect(text(settled, 'structure', lang)[0], lang).not.toContain(loadsAlone);
      const alone9 = lang === 'en' ? 'follow from the loads alone' : 'salen directamente de las cargas.';
      expect(text(plain, 'reduced', lang)[0], lang).toContain(alone9);
      expect(text(settled, 'reduced', lang)[0], lang).toContain(lang === 'en' ? 'follow from the loads and the settlements' : 'salen directamente de las cargas y de los asentamientos');
    }
    // and the reactions do change, which is what the old sentence denied
    const r = (f: StiffnessForm) => analyseSafely(f).results!.reactions.map((x) => x.ry);
    expect(r(settled)).not.toEqual(r(plain));
  });
});

describe('T13: the units of the section stand each with its symbol; displacements are in a unit with a name', () => {
  it('E in ksi, A in in², I in in⁴ — and the calculation’s — in both systems and both languages; “gives them in inches”, never “in in”', () => {
    expect(text(tpl('truss-two-bar'), 'structure')[0]).toContain('entered with E in ksi, A in in²; the calculation works with E in kip/ft², A in ft².');
    expect(text(tpl('frame-portal'), 'structure')[0]).toContain('entered with E in ksi, A in in², I in in⁴; the calculation works with E in kip/ft², A in ft², I in ft⁴.');
    expect(text(tpl('frame-portal', 'si'), 'structure', 'es')[0]).toContain('se escribió con E en GPa, A en mm², I en 10⁶ mm⁴; el cálculo trabaja con E en kN/m², A en m², I en m⁴.');
    expect(text(tpl('frame-portal'), 'displacements')[0]).toContain('gives them in inches.');
    expect(text(tpl('frame-portal', 'si'), 'displacements')[0]).toContain('gives them in millimetres.');
    expect(text(tpl('frame-portal'), 'displacements', 'es')[0]).toContain('los da en pulgadas.');
    for (const id of TEMPLATE_IDS) for (const lang of LANGS) for (const t of text(tpl(id), 'displacements', lang)) expect(t, id).not.toMatch(/\bin in\b|\ben in\b/);
  });
});

describe('E1/T1: the pivot the elimination stops at is described for what it is', () => {
  const line = () => {
    let f = emptyStiffness('us', 'truss');
    for (const [x, y] of [[0, 0], [10, 0], [20, 0]]) f = reduceStiffness(f, { type: 'add', list: 'nodes', seed: { x, y } });
    f = reduceStiffness(f, { type: 'add', list: 'members', seed: { i: f.nodes[0].id, j: f.nodes[1].id } });
    f = reduceStiffness(f, { type: 'add', list: 'members', seed: { i: f.nodes[1].id, j: f.nodes[2].id } });
    f = reduceStiffness(f, { type: 'add', list: 'supports', seed: { node: f.nodes[0].id, preset: 'pin' } });
    f = reduceStiffness(f, { type: 'add', list: 'supports', seed: { node: f.nodes[2].id, preset: 'pin' } });
    return reduceStiffness(f, { type: 'add', list: 'loads', seed: { node: f.nodes[1].id, fy: -5 } });
  };
  it('two collinear bars: the pivot is exactly zero and nothing resists the movement; no “under a billionth of the stiffness it started with”', () => {
    const last = text(line(), 'forward-pass').at(-1)!;
    expect(last).toContain('is 0 kip/ft: nothing in the structure resists this movement');
    expect(last).not.toMatch(/started with|which is zero|10\^−9/);
    expect(last).toContain('The structure can move at this DOF without any member deforming');
  });
  it('a portal of 10³⁰ in² beside its bending (beyond even thirty figures): the pivot is lost in rounding, the structure is not called a mechanism, and the card gives the pivot and the rounding with their unit', () => {
    const f = reduceStiffness(tpl('frame-portal'), { type: 'section', patch: { A: 1e30 } });
    const a = analyseSafely(f);
    expect(a.issues.map((i) => i.code)).toEqual(['stiffness-range']);
    const last = text(f, 'forward-pass').at(-1)!;
    expect(last).toMatch(/^The pivot of DOF 4x is −?[\d.,]+( × 10[⁻⁰¹²³⁴⁵⁶⁷⁸⁹]+)? kip\/ft, and the rounding in the terms that made it is as large as [\d.,]+( × 10[⁻⁰¹²³⁴⁵⁶⁷⁸⁹]+)? kip\/ft: the pivot is lost in it\./);
    // a movement that strains no member was looked for and not found: it is said so, and not that it is "most likely" not a mechanism
    expect(last).toContain('searched for and not found, so this is not a mechanism');
    expect(last).not.toContain('most likely');
    expect(last).not.toMatch(/The structure can move at this DOF without any member deforming/);
    // the same, in Spanish
    expect(text(f, 'forward-pass', 'es').at(-1)!).toContain('no se encontró, así que no es un mecanismo');
    expect(text(f, 'forward-pass', 'es').at(-1)!).not.toContain('lo más probable');
  });
  it('a solved structure with a pivot the arithmetic knows to few figures: the warning counts them and says what causes it, in both languages, with its numbers', () => {
    const w = (lang: Lang, count: number) => warningSentence({ code: 'near-mechanism', dofs: [10], count, ratio: 0.00003 }, stiffnessUi[lang], { mode: 'frame' });
    // (the power of ten is the formatter's: a caret or a raised exponent; here both are read as the raised one)
    const raised = (t: string) => t.replace(/10\^−(\d)/g, (_m, d: string) => `10⁻${'⁰¹²³⁴⁵⁶⁷⁸⁹'[Number(d)]}`);
    expect(raised(w('en', 4))).toBe('These results are certain to only 4 figures: counting the rounding in the arithmetic at its worst, the result at DOF 4x could be off by 3 × 10⁻⁵ of the largest of its kind, more than 1 × 10⁻⁶. The structure is stable and is solved; a very large A or I, a very short member, or members almost in line cause it.');
    expect(w('en', 1)).toContain('certain to only 1 figure:');
    expect(w('es', 4)).toContain('seguros solo hasta 4 cifras: contando el redondeo de la aritmética en el peor caso, el resultado en el GDL 4x');
    expect(w('es', 1)).toContain('seguros solo hasta 1 cifra:');
    // the other warnings of the round
    expect(warningSentence({ code: 'large-displacements', count: 2, ratio: 0.37, nodes: [1, 3] }, stiffnessUi.en)).toBe(
      'The chord of member 2 turns by 0.37 rad, more than a tenth: its ends move across it by more than a tenth of its length. The analysis is of first order, for small movements: the numbers describe that theory, not how the structure would really move.',
    );
    expect(warningSentence({ code: 'large-rotation', count: 3, ratio: 0.21, nodes: [2, 3] }, stiffnessUi.en)).toBe(
      'An end of member 3 turns 0.21 rad away from its chord, more than a tenth of a radian. First-order theory takes slopes as small, so the numbers describe that theory, not how the member would really bend.',
    );
    expect(warningSentence({ code: 'large-stretch', count: 1, ratio: 0.5, nodes: [1, 2] }, stiffnessUi.es)).toContain('La barra 1 se alarga o se acorta 0.5 veces su longitud, más de una décima de ella.');
    expect(warningSentence({ code: 'settlement-ignored', dofs: [4, 6] }, stiffnessUi.es, { mode: 'frame' })).toBe(
      'Se escribió un asentamiento en los GDL 2x, 2θ, que ningún apoyo restringe, así que no tiene ningún efecto. Se queda en la fila del apoyo y vuelve a contar si se marca ese movimiento.',
    );
    expect(warningSentence({ code: 'settlement-ignored', dofs: [4] }, stiffnessUi.es, { mode: 'frame' })).toContain('en el GDL 2x,');
  });
});

describe('T17/B12/U17: the sentence about a section says what is the matter and how to mend it', () => {
  const sentence = (form: StiffnessForm, lang: Lang) => issueSentence(analyseSafely(form).issues[0], stiffnessUi[lang], { number: (v) => String(v), unit: 'ft' });
  it('the structure’s own field cannot be left blank, and zero is “greater than zero”; a member’s own can be blank', () => {
    const base = defaultStiffness();
    const own = reduceStiffness(base, { type: 'section', patch: { A: 0 } });
    expect(sentence(own, 'en')).toBe('The area (A) must be greater than zero. Members without their own take this value, so it cannot be left blank.');
    expect(sentence(own, 'es')).toBe('El área (A) debe ser mayor que cero. Las barras que no tienen valor propio toman este, así que no puede quedar en blanco.');
    const member = reduceStiffness(base, { type: 'patch', list: 'members', id: base.members[0].id, patch: { A: -3 } });
    expect(sentence(member, 'en')).toBe('The area (A) must be greater than zero. Enter a sensible value, or leave it blank to take the structure’s.');
    const huge = reduceStiffness(base, { type: 'patch', list: 'members', id: base.members[0].id, patch: { E: 1e40 } });
    expect(sentence(huge, 'en')).toBe('The modulus (E) is outside what the calculation can hold. Enter a sensible value, or leave it blank to take the structure’s.');
    for (const s of [sentence(own, 'en'), sentence(own, 'es'), sentence(member, 'en'), sentence(huge, 'es')]) expect(s).not.toMatch(/\{|undefined|NaN/);
  });
  it('the stiffness range and the ill-conditioned answer say what the arithmetic cannot do, and where, in both languages', () => {
    const f = reduceStiffness(tpl('frame-portal'), { type: 'section', patch: { A: 1e30 } });
    const issue = analyseSafely(f).issues[0];
    expect(issueSentence(issue, stiffnessUi.en, { mode: 'frame' })).toContain('at node 4, one movement is held by so little stiffness beside the rest that its size is lost in rounding');
    expect(issueSentence(issue, stiffnessUi.es, { mode: 'frame' })).toContain('en el nudo 4, un movimiento queda sujeto por tan poca rigidez frente al resto');
    const ill = { code: 'ill-conditioned' as const, residual: 3.6e-3, limit: 1e-8 };
    expect(issueSentence(ill, stiffnessUi.en)).toContain('so it cannot be relied on. The cause is the arithmetic: stiffnesses very far apart');
    expect(issueSentence(ill, stiffnessUi.en)).not.toContain('bring the sections closer');
  });
});

describe('B10/B11: what Copy puts on the clipboard', () => {
  it('the first row carries the units, the minus is the plain hyphen, the mark is a point and no thousands mark, in English and in Spanish; and the Copied line says so', () => {
    for (const lang of LANGS) {
      const form = tpl('frame-portal');
      const steps = stepsOf(form);
      const stiff = stepBody(steps.find((s) => s.key === 'assembled')!, ctxOf(form, lang)).flatMap((i) => (i.kind === 'table' ? [i.model] : []))[0];
      const corner = stiff.tsv.split('\n')[0].split('\t')[0];
      expect(corner, lang).toBe(lang === 'en' ? 'x or y with x or y: kip/ft; x or y with rotation: kip/rad; rotation with rotation: kip·ft/rad' : 'x o y con x o y: kip/ft; x o y con giro: kip/rad; giro con giro: kip·ft/rad');
      expect(stiff.tsv, lang).not.toMatch(/[−–]/);
      expect(stiff.tsv, lang).toMatch(/-\d/);
      for (const line of stiff.tsv.split('\n').slice(1)) for (const cell of line.split('\t').slice(1)) expect(cell, lang).toMatch(/^-?\d+(\.\d+)?(e-?\d+)?$/);
      expect(stiffnessUi[lang].matrix.copied, lang).toContain(lang === 'en' ? 'decimal point and no thousands mark' : 'punto decimal y no llevan marca de miles');
    }
    // a table of vectors says its unit in the corner too
    const form = tpl('truss-two-bar');
    const reactions = stepBody(stepsOf(form).find((s) => s.key === 'reactions')!, ctxOf(form)).flatMap((i) => (i.kind === 'table' ? [i.model] : []))[0];
    expect(reactions.tsv.split('\n')[0].split('\t')[0]).toBe('kip');
  });
});

describe('B13/D12: the notes under the tables say what is true', () => {
  it('a dot or a light 0 is a zero or a value too small to tell from rounding', () => {
    expect(stiffnessUi.en.zeroNote).toBe('A dot or a light 0 stands for zero: an exact zero, or a value too small to tell from rounding.');
    expect(stiffnessUi.es.zeroNote).toContain('o un valor demasiado pequeño para distinguirlo del redondeo');
    expect(stiffnessUi.en.zeroNote).not.toContain('exact zero.');
  });
  it('the cells marked as written into are the ones written into: member 1’s cells are marked in the running K after member 2, whatever the legend says', () => {
    const a = analyseSafely(tpl('truss-five-member'));
    const running = a.solution!.steps.find((s) => s.key === 'assembly#2')!.blocks.find((b) => b.type === 'matrix' && b.name === 'running') as MatrixBlock;
    const cells = new Set((running.highlights ?? []).map((h) => `${h.row},${h.col}`));
    const first = a.solution!.steps.find((s) => s.key === 'assembly#1')!.blocks.find((b) => b.type === 'matrix' && b.name === 'contribution') as MatrixBlock;
    for (const h of first.highlights ?? []) expect(cells.has(`${h.row},${h.col}`)).toBe(true);
    expect(stiffnessUi.en.highlights.contributed).toBe('cells that members have written into');
    expect(stiffnessUi.en.highlights.contributed).not.toContain('so far');
  });
});

describe('T14/T15: the Spanish uses the other calculators’ words, and says what is English in it', () => {
  it('apoyo de rodillo, comprobación, EE. UU., a prescribed displacement; and the formulas’ DOF, F and rhs are explained once', () => {
    const es = JSON.stringify(stiffnessUi.es);
    expect(es).not.toMatch(/apoyo móvil|Apoyo móvil|Verificaci|verificaci/);
    expect(stiffnessUi.es.supports.note).toContain('Apoyo de rodillo');
    expect(stiffnessUi.es.steps.titles.checks).toBe('Comprobaciones');
    expect(stiffnessUi.es.results.summary.equilibrium.title).toBe('Comprobación del equilibrio');
    expect(stiffnessUi.es.names.dx).toBe('Diferencia en x, dx');
    expect(stiffnessUi.es.steps.structure.truss).toContain('(GDL, que las fórmulas escriben DOF)');
    expect(stiffnessUi.es.steps.reduced.lead).toContain('se le llama rhs, de las siglas inglesas del lado derecho');
    expect(stiffnessUi.es.steps.partition.lead).toContain('libres (F, por la palabra inglesa free)');
  });
});

describe('second pass, D8/D9/D10/D13: the multiplier, the zero pivot of a mechanism, the page without scripts, the Spanish', () => {
  it('the multiplier is m_ik: its head is not an "l" (which the monospace face sets as a "1"), the card defines it, and the formulas of the engine and of the page say the same', () => {
    for (const lang of LANGS) {
      expect(stiffnessUi[lang].columns.multipliers, lang).toBe('m_ik');
      expect(JSON.stringify(stiffnessUi[lang]), lang).not.toMatch(/l_ik|"l = /);
      expect(JSON.stringify(stiffnessPage[lang]), lang).not.toMatch(/l_ik/);
    }
    expect(text(tpl('frame-portal'), 'forward-pass')[0]).toContain('gets a multiplier m_ik, its own entry in the pivot column divided by the pivot');
    expect(text(tpl('frame-portal'), 'forward-pass', 'es')[0]).toContain('recibe un multiplicador m_ik, su propia entrada en la columna del pivote dividida entre el pivote');
    const first = stepsOf(tpl('frame-portal')).find((x) => x.key === 'forward-pass#1')!;
    expect(first.formulas).toEqual(['m_ik = a_ik/a_kk', 'a_ij ← a_ij − m_ik·a_kj']);
  });
  it('the zero pivot of a mechanism is zero to the arithmetic, and is not said to be lost in rounding (that is for a stiffness range); the card of a mechanism says that nothing resists the movement', () => {
    for (const lang of LANGS) {
      const ui = stiffnessUi[lang];
      for (const s of [ui.highlights['zero-pivot'], ui.marks['zero-pivot'], ui.solution.partial]) expect(s, lang).not.toMatch(/rounding|redondeo/);
    }
    expect(stiffnessUi.en.highlights['zero-pivot']).toBe('the pivot, zero to the arithmetic');
    expect(stiffnessUi.en.solution.partial).toContain('where the pivot is zero as far as the arithmetic can tell');
    // the two collinear bars: the pivot is exactly zero and the card says nothing resists the movement; the stiffness range keeps its own words
    expect(stiffnessUi.en.steps['forward-pass'].singularZero).toContain('nothing in the structure resists this movement');
    expect(stiffnessUi.en.steps['forward-pass'].singularRange).toContain('lost in it');
  });
  it('the page without scripts says that the tool needs them and that most steps have no matrix, in both languages', () => {
    expect(stiffnessPage.en.noscript).toContain('The tool itself needs scripts');
    expect(stiffnessPage.en.noscript).toContain('the matrices are drawn for the first steps only, so most steps have none');
    expect(stiffnessPage.en.noscript).toContain('The method below and the worked example stay in full');
    expect(stiffnessPage.es.noscript).toContain('La herramienta misma necesita scripts');
    expect(stiffnessPage.es.noscript).toContain('las matrices se dibujan solo en los primeros pasos, así que la mayoría de los pasos no tiene ninguna');
  });
  it('the Spanish does not say "un A" or "un I" (it is an area A and an inertia I), nor "casi ningún largo" (a length almost nil), and the nodes that move are not named twice', () => {
    const es = JSON.stringify(stiffnessUi.es) + JSON.stringify(stiffnessPage.es);
    expect(es).not.toMatch(/un A|un I|casi ningún largo/);
    expect(es).toContain('una barra de longitud casi nula');
    const mechanism = { code: 'mechanism' as const, dof: 8, dofLabel: '4y', node: 4, nodes: [3, 4], kind: 'sway' as const, count: 1 };
    expect(issueSentence(mechanism, stiffnessUi.es, { mode: 'truss' })).toContain('El movimiento es de los nudos 3 y 4.');
    expect(issueSentence(mechanism, stiffnessUi.es, { mode: 'truss' })).not.toMatch(/Los nudos que se mueven son los nudos/);
    expect(issueSentence(mechanism, stiffnessUi.en, { mode: 'truss' })).toContain('The movement is of nodes 3 and 4.');
    expect(issueSentence(mechanism, stiffnessUi.en, { mode: 'truss' })).not.toMatch(/The nodes that move are nodes/);
  });
});
