import { afterEach, describe, expect, it, vi } from 'vitest';
import { analyseSafely, stagesOf } from '@/lib/calc/stiffness/analysis';
import { CALCULATION_UNITS, emptyStiffness, reduceStiffness, type StiffnessForm } from '@/lib/calc/stiffness/model';
import { stiffnessUi } from '@/lib/calc/stiffness/strings';
import { TEMPLATE_IDS, type TemplateId } from '@/lib/calc/stiffness/templates';
import type { Step } from '@/lib/calc/stiffness/types';
import type { Lang } from '@/lib/ttc/i18n';
import { build, girder, settling } from './fixtures.testlib';
import { DEFAULT_FORMAT } from './numfmt';
import { labelsOf, scalarUnit, stepBody, stepView, stepWeight, titleOf, type StepContext } from './steps';

vi.setConfig({ testTimeout: 120_000 });
afterEach(() => new Promise<void>((done) => setTimeout(done, 0)));

/**
 * THE STEPS AS DATA: for every step the library records, its number, title, paragraphs, formulas and body - walked for every template in both
 * unit systems and both languages - and the rule that each sentence is TRUE in the branch it is written in: a structure with a settlement and
 * one without, a member with loads and one without, a bar and a member, an elimination that is recorded and one that is too long, a mechanism.
 */

const LANGS: Lang[] = ['en', 'es'];
const noise = /NaN|undefined|Infinity|\[object|(?:^|[\s>(=])-0(?![.\d])|−0(?![.\d])|\be[+-]\d|\{[a-zA-Z]+(\|[^}]*)?\}|\$\{/;
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
/** The paragraphs of each step of one kind, joined: one string to a step. */
const text = (form: StiffnessForm, id: Step['id'], lang: Lang = 'en') => views(form, lang).filter((v) => v.step.id === id).map((v) => v.view.paragraphs.join(' '));
/** The paragraphs of the k-th step of one kind, one by one. */
const para = (form: StiffnessForm, id: Step['id'], k = 0, lang: Lang = 'en') => views(form, lang).filter((v) => v.step.id === id)[k]?.view.paragraphs ?? [];

describe('labels and titles', () => {
  it('numbers a step by its place in its stage, so that no two steps share a label', () => {
    for (const id of TEMPLATE_IDS) {
      const steps = stepsOf(tpl(id));
      const labels = labelsOf(steps);
      expect(new Set(labels.values()).size, id).toBe(steps.length);
      for (const s of steps) expect(labels.get(s.key), `${id} ${s.key}`).toMatch(new RegExp(`^${s.number}(\\.\\d+)?$`));
    }
    const labels = labelsOf(stepsOf(tpl('truss-two-bar')));
    expect(labels.get('structure')).toBe('1');
    expect(labels.get('geometry#2')).toBe('2.2');
    expect(labels.get('assembled')).toBe('6.3');
    expect(labels.get('displacements')).toBe('11');
    expect(labels.get('checks')).toBe('14');
  });
  it('gives every step a title in both languages, with its member, column or unknown in it', () => {
    const v = views(tpl('frame-portal'));
    expect(v.find((x) => x.step.key === 'geometry#2')!.view.title).toBe('Geometry of member 2');
    expect(v.find((x) => x.step.key === 'forward-pass#3')!.view.title).toBe('Forward elimination, column 3');
    expect(v.find((x) => x.step.key === 'back-substitution#1')!.view.title).toBe('Back-substitution: unknown 6');
    const es = views(tpl('frame-portal'), 'es');
    expect(es.find((x) => x.step.key === 'assembly#1')!.view.title).toBe('Ensamblaje: se agrega la barra 1 a K');
    for (const lang of LANGS) for (const { step, view } of views(tpl('frame-portal'), lang)) expect(titleOf(step, stiffnessUi[lang]), `${lang} ${step.key}`).toBe(view.title);
  });
  it('the outline groups the steps by stage, in order, the way the page lists them', () => {
    const steps = stepsOf(tpl('frame-portal'));
    const stages = stagesOf(steps);
    expect(stages.map((s) => s.number)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14]);
    expect(stages.reduce((n, s) => n + s.steps.length, 0)).toBe(steps.length);
  });
});

describe('every step of every template, in both unit systems and both languages', () => {
  for (const id of TEMPLATE_IDS) {
    it(`${id}: sentences with no hole left and no noise, formulas that are equations, a body of rectangular tables`, () => {
      for (const units of ['us', 'si'] as const) {
        for (const lang of LANGS) {
          const form = tpl(id, units);
          const steps = stepsOf(form);
          expect(steps.length, id).toBeGreaterThan(10);
          const labels = labelsOf(steps);
          const c = ctxOf(form, lang);
          for (const s of steps) {
            const v = stepView(s, labels, c);
            const where = `${id} ${units} ${lang} ${s.key}`;
            expect(v.paragraphs.length, where).toBeGreaterThan(0);
            for (const p of v.paragraphs) {
              expect(p, where).not.toMatch(noise);
              expect(p.trim().length, where).toBeGreaterThan(20);
              expect(p, where).toMatch(/[.)\]]$/);
            }
            expect(v.title, where).not.toMatch(noise);
            for (const f of v.formulas) expect(f, where).toMatch(/[=←]/);
            const body = stepBody(s, c);
            for (const item of body) {
              if (item.kind === 'values') {
                for (const r of item.rows) {
                  expect(r.text, where).not.toMatch(noise);
                  expect(r.gloss.length, where).toBeGreaterThan(0);
                }
                continue;
              }
              const t = item.model;
              expect(t.caption, `${where} ${item.id}`).not.toMatch(noise);
              expect(t.caption.length, `${where} ${item.id}`).toBeGreaterThan(5);
              expect(t.cells.length, `${where} ${item.id}`).toBe(t.rowLabels.length);
              for (const row of t.cells) {
                expect(row.length, `${where} ${item.id}`).toBe(t.colHeads.length);
                for (const cell of row) expect(cell.text, `${where} ${item.id}`).not.toMatch(noise);
              }
              expect(t.tsv.split('\n'), `${where} ${item.id}`).toHaveLength(t.rowLabels.length + 1);
              for (const line of t.tsv.split('\n')) expect(line.split('\t'), `${where} ${item.id}`).toHaveLength(t.colHeads.length + 1);
              // The numbers of a spreadsheet are plain: the head may be a formula, the rows are digits.
              const body2 = t.tsv.split(String.fromCharCode(10)).slice(1).join(String.fromCharCode(10));
              expect(body2, `${where} ${item.id}`).not.toMatch(/NaN|undefined|−|×/);
              // The ids of one step are one each.
            }
            expect(new Set(body.map((b) => b.id)).size, where).toBe(body.length);
          }
        }
      }
    });
  }

  it('gives a unit to every value that has one, in the calculation’s units', () => {
    const form = tpl('frame-portal');
    const calc = CALCULATION_UNITS.us;
    expect(scalarUnit('L', 'us')).toBe(calc.length);
    expect(scalarUnit('EA/L', 'us')).toBe(calc.stiffness);
    expect(scalarUnit('6EI/L²', 'us')).toBe(calc.stiffnessCoupling);
    expect(scalarUnit('4EI/L', 'si')).toBe(CALCULATION_UNITS.si.stiffnessRotation);
    expect(scalarUnit('pivot', 'us', 'θ')).toBe(calc.stiffnessRotation);
    expect(scalarUnit('pivot', 'us', 'x')).toBe(calc.stiffness);
    expect(scalarUnit('c', 'us')).toBe('');
    expect(scalarUnit('θ', 'us')).toBe('°');
    const geometry = stepBody(stepsOf(form).find((s) => s.key === 'geometry#1')!, ctxOf(form));
    const rows = geometry.flatMap((i) => (i.kind === 'values' ? i.rows : []));
    expect(rows.find((r) => r.symbol === 'L')).toMatchObject({ text: '10', unit: 'ft', formula: '√(dx² + dy²)' });
    expect(rows.find((r) => r.symbol === 'E')).toMatchObject({ unit: 'kip/ft²' });
    expect(rows.find((r) => r.symbol === 'I')).toMatchObject({ unit: 'ft⁴' });
    expect(rows.find((r) => r.symbol === 'EI')).toMatchObject({ unit: 'kip·ft²' });
    const si = tpl('frame-portal', 'si');
    const siRows = stepBody(stepsOf(si).find((s) => s.key === 'geometry#1')!, ctxOf(si)).flatMap((i) => (i.kind === 'values' ? i.rows : []));
    expect(siRows.find((r) => r.symbol === 'L')).toMatchObject({ unit: 'm' });
    expect(siRows.find((r) => r.symbol === 'E')).toMatchObject({ unit: 'kN/m²' });
  });

  it('puts the pivot, a word and not a symbol, under its own formula', () => {
    const form = tpl('frame-portal');
    const pass = stepBody(stepsOf(form).find((s) => s.key === 'forward-pass#1')!, ctxOf(form));
    const pivot = pass.flatMap((i) => (i.kind === 'values' ? i.rows : [])).find((r) => r.gloss === 'Pivot')!;
    expect(pivot).toMatchObject({ symbol: '', formula: 'a_kk', unit: 'kip/ft' });
  });
});

describe('each sentence is true in the branch it is written in', () => {
  it('the structure step: a settlement is said when there is one, and only then', () => {
    expect(text(tpl('truss-two-bar'), 'structure')[0]).toContain('No support settles');
    expect(text(tpl('truss-two-bar'), 'structure')[0]).not.toContain('prescribed displacement');
    expect(text(settling(), 'structure')[0]).toContain('prescribed displacement');
    expect(text(settling(), 'structure')[0]).not.toContain('No support settles');
    // A DOF numbering that matches the mode.
    expect(text(tpl('truss-two-bar'), 'structure')[0]).toContain('x = 2n − 1 and y = 2n');
    expect(text(tpl('frame-portal'), 'structure')[0]).toContain('x = 3n − 2, y = 3n − 1 and rotation = 3n');
    // The counts are the structure’s.
    expect(text(tpl('frame-portal'), 'structure')[0]).toContain('Nodes: 4. Members: 3. DOFs: 12, of which 6 are held by supports and 6 are free to move.');
    expect(text(tpl('truss-two-bar'), 'structure')[0]).toContain('the DOFs of node n are x = 2n − 1');
  });
  it('says nothing is free to move only when nothing is', () => {
    expect(text(tpl('frame-fixed-point'), 'structure')[0]).toContain('Nothing is free to move');
    for (const id of TEMPLATE_IDS.filter((x) => x !== 'frame-fixed-point')) expect(text(tpl(id), 'structure')[0], id).not.toContain('Nothing is free to move');
  });
  it('the section’s units are the ones the form shows and the ones the steps work in', () => {
    // each unit stands with its symbol, so that the two lists cannot be read as one
    expect(text(tpl('truss-two-bar'), 'structure')[0]).toContain('entered with E in ksi, A in in²; the calculation works with E in kip/ft², A in ft².');
    expect(text(tpl('frame-portal', 'si'), 'structure')[0]).toContain('entered with E in GPa, A in mm², I in 10⁶ mm⁴; the calculation works with E in kN/m², A in m², I in m⁴.');
    expect(text(tpl('frame-portal', 'si'), 'structure')[0]).toContain('in kN and m');
  });
  it('geometry names the two nodes; the local stiffness of a bar and of a member say what they are', () => {
    expect(text(tpl('truss-two-bar'), 'geometry')[1]).toContain('Member 2 runs from node 2 to node 3');
    expect(text(tpl('truss-two-bar'), 'local-stiffness')[0]).toContain('behaves like a spring');
    expect(text(tpl('truss-two-bar'), 'local-stiffness')[0]).toContain('at node 1 and at node 3');
    expect(text(tpl('frame-portal'), 'local-stiffness')[0]).toContain('six DOFs');
    expect(text(tpl('frame-portal'), 'local-stiffness')[0]).not.toContain('behaves like a spring');
    expect(text(tpl('frame-portal'), 'transformation')[0]).toContain('keep a 1 on the diagonal');
    expect(text(tpl('truss-two-bar'), 'transformation')[0]).toContain('c = 0.8 and s = 0.6');
    expect(text(tpl('truss-two-bar'), 'transformation')[1]).toContain('c = −0.8 and s = 0.6');
  });
  it('the closed form is a bar’s alone, and its agreement is said from the numbers', () => {
    const bar = text(tpl('truss-two-bar'), 'global-member')[0];
    expect(bar).toContain('written once and for all');
    expect(bar).toContain('same numbers as the product');
    expect(bar).toContain('1x, 1y, 3x, 3y');
    expect(text(tpl('frame-portal'), 'global-member')[0]).not.toContain('written once and for all');
    // A step that says the two routes differ says by how much.
    const steps = stepsOf(tpl('truss-two-bar'));
    const bent = steps.map((s) => (s.key === 'global-member#1' ? { ...s, facts: { ...s.facts, agree: false, difference: 0.5 } } : s));
    const v = stepView(bent.find((s) => s.key === 'global-member#1')!, labelsOf(bent), ctxOf(tpl('truss-two-bar')));
    expect(v.paragraphs.join(' ')).toContain('differs from the product by 0.5 kip/ft');
    expect(v.paragraphs.join(' ')).not.toContain('same numbers as the product');
  });
  it('the assembly: the first member starts K, the next say how far K has got', () => {
    const t = text(tpl('truss-two-bar'), 'assembly');
    expect(t[0]).toContain('starts as its contribution alone');
    expect(t[0]).toContain('writes 16 numbers into K');
    expect(t[1]).toContain('members 1 to 2');
    expect(t[1]).not.toContain('starts as its contribution alone');
    expect(text(tpl('frame-portal'), 'assembly')[2]).toContain('writes 36 numbers');
  });
  it('the assembled matrix says K is symmetric, and says otherwise when it is not', () => {
    expect(text(tpl('frame-portal'), 'assembled')[0]).toContain('K is symmetric');
    const steps = stepsOf(tpl('truss-two-bar'));
    const bent = steps.map((s) => (s.id === 'assembled' ? { ...s, facts: { ...s.facts, symmetric: false, asymmetry: 3 } } : s));
    const v = stepView(bent.find((s) => s.id === 'assembled')!, labelsOf(bent), ctxOf(tpl('truss-two-bar')));
    expect(v.paragraphs.join(' ')).toContain('differs from its transpose by 3');
    expect(v.paragraphs.join(' ')).not.toContain('K is symmetric');
  });
  it('the loads: none, some, and the member loads only where a member carries one', () => {
    expect(text(tpl('frame-propped'), 'nodal-loads')[0]).toContain('No load is applied at a node');
    expect(text(tpl('truss-two-bar'), 'nodal-loads')[0]).toContain('1 load is applied at nodes');
    expect(text(tpl('truss-five-member'), 'nodal-loads')[0]).toContain('2 loads are applied at nodes');
    expect(views(tpl('frame-portal')).some((v) => v.step.id === 'member-loads')).toBe(false);
    expect(views(tpl('truss-two-bar')).some((v) => v.step.id === 'member-loads')).toBe(false);
    const loaded = text(tpl('frame-propped'), 'member-loads')[0];
    expect(loaded).toContain('Member 1 carries one load; its fixed-end forces are the whole of f_FE.');
    expect(loaded).toContain('fixed-end forces');
    expect(loaded).toContain('−T^T·f_FE');
    // The load vector: a bar’s is the nodal loads; a frame without member loads says so; one with them adds them.
    expect(para(tpl('truss-two-bar'), 'load-vector')[1]).toContain('P = P_nodal');
    expect(para(tpl('frame-portal'), 'load-vector')[1]).toContain('No member carries a load');
    expect(para(tpl('frame-propped'), 'load-vector')[1]).toContain('P = P_nodal + P_equivalent');
  });
  it('the member-loads step names each load by its kind and its row', () => {
    const form = tpl('frame-fixed-point');
    const step = stepsOf(form).find((s) => s.id === 'member-loads')!;
    const body = stepBody(step, ctxOf(form));
    const captions = body.flatMap((i) => (i.kind === 'table' ? [i.model.caption] : []));
    expect(captions).toContain('Fixed-end forces of point load 1');
    expect(captions).toContain('Fixed-end forces of member 1, all loads added');
    expect(captions).toContain('The same forces in global axes, and the equivalent nodal loads');
    const f = body.find((i) => i.id.includes('f_FE-point#1'));
    expect(f?.kind === 'table' && f.model.hasSymbols).toBe(true);
  });
  it('the partition and the reduced equations: a settlement is in the sentence when it is in the numbers', () => {
    expect(para(tpl('truss-two-bar'), 'partition')[2]).toBe('The held movements u_R are known: zero where the support holds still.');
    expect(para(settling(), 'partition')[2]).toContain('and the settlement where one is given');
    expect(para(tpl('truss-two-bar'), 'reduced')[1]).toContain('K_FR·u_R = 0 and rhs = P_F');
    expect(para(settling(), 'reduced')[1]).toContain('make K_FR·u_R different from zero');
    expect(para(tpl('frame-fixed-point'), 'partition')[2]).toContain('no K_FF and no u_F');
    expect(para(tpl('frame-fixed-point'), 'reduced')[0]).toContain('no free DOF');
    expect(para(tpl('truss-two-bar'), 'partition')[1]).toBe('Here 2 DOFs are free and 4 are held.');
    expect(para(tpl('frame-portal'), 'partition')[1]).toBe('Here 6 DOFs are free and 6 are held.');
    // A single free DOF: the singular of the sentence.
    const one = build({ mode: 'frame', nodes: [[0, 0], [10, 0]], members: [[1, 2]], supports: [[1, 'fixed']], loads: [[2, 0, -5]] });
    expect(para(one, 'partition')[1]).toBe('Here 3 DOFs are free and 3 are held.');
    const roller = build({ mode: 'truss', nodes: [[0, 0], [10, 0], [5, 5]], members: [[1, 2], [2, 3], [1, 3]], supports: [[1, 'pin'], [2, 'roller']], loads: [[3, 0, -5]] });
    expect(para(roller, 'partition')[1]).toBe('Here 3 DOFs are free and 3 are held.');
    // One free DOF: the singular of both sentences, and the elimination has nothing to reduce.
    const bar = build({ mode: 'truss', nodes: [[0, 0], [10, 0]], members: [[1, 2]], supports: [[1, 'pin'], [2, 'roller']], loads: [[2, 5, 0]] });
    expect(para(bar, 'partition')[1]).toBe('Here 1 DOF is free and 3 are held.');
    expect(para(bar, 'structure')[1]).toBe('Nodes: 2. Members: 1. DOFs: 4, of which 3 are held by supports and 1 is free to move.');
    expect(views(bar).filter((v) => v.step.id === 'forward-pass')).toHaveLength(0);
  });
  it('the elimination: every pass names its pivot DOF, a pass with no row below says nothing changes, and the rows below are counted', () => {
    const t = text(tpl('frame-portal'), 'forward-pass');
    // Six free DOFs, five passes: the last pivot is the last equation, and needs no pass of its own.
    expect(t).toHaveLength(5);
    expect(t[0]).toContain('DOF 3x as its pivot, a_kk = 21,610 kip/ft');
    expect(t[0]).toContain('5 rows below the pivot are reduced');
    expect(t[4]).toContain('1 row below the pivot is reduced');
    expect(t.every((x) => !x.includes('No row is left'))).toBe(true);
    // The rotation pivots are in kip·ft/rad.
    expect(t[2]).toContain('kip·ft/rad');
    expect(text(tpl('frame-portal'), 'back-substitution')[0]).toContain('Unknown 6, the DOF 4θ');
  });
  it('a mechanism says the zero pivot, and what it means', () => {
    const line = build({ mode: 'truss', nodes: [[0, 0], [10, 0], [20, 0]], members: [[1, 2], [2, 3]], supports: [[1, 'pin'], [3, 'pin']], loads: [[2, 0, -5]] });
    const a = analyseSafely(line);
    expect(a.solution).toBeNull();
    const v = views(line);
    const last = v[v.length - 1];
    expect(last.step.id).toBe('forward-pass');
    expect(last.step.facts.singular).toBe(true);
    expect(last.view.paragraphs).toHaveLength(1);
    expect(last.view.paragraphs[0]).toContain('nothing in the structure resists this movement');
    expect(last.view.paragraphs[0]).toContain('The structure can move at this DOF without any member deforming');
    expect(last.view.formulas).toEqual(['a_kk = 0']);
    // The steps before the zero pivot are those of a structure that can be solved: nothing in them is about a solution.
    for (const x of v.slice(0, -1)) expect(x.view.paragraphs.join(' '), x.step.key).not.toContain('is zero');
  });
  it('the solution step: recorded, too long to record, and nothing to solve', () => {
    expect(text(tpl('frame-portal'), 'solution')[0]).toContain('put back into the original equations');
    // (the residual has its unit: a force, and for a frame a moment too)
    expect(text(tpl('frame-portal'), 'solution').join(' ')).toMatch(/The largest residual is (zero to the figures shown|[\d.]+( × 10[⁻⁰¹²³⁴⁵⁶⁷⁸⁹]+)? kip or kip·ft, against equations whose terms are as large as [\d,.]+( × 10[⁻⁰¹²³⁴⁵⁶⁷⁸⁹]+)? kip or kip·ft)/);
    const big = girder('frame');
    const s = text(big, 'solution')[0];
    expect(s).toContain('30 free DOFs, more than the 12');
    expect(s).toContain('It was done all the same');
    expect(views(big).some((v) => v.step.id === 'forward-pass')).toBe(false);
    expect(views(big).some((v) => v.step.id === 'augmented')).toBe(false);
    expect(text(tpl('frame-fixed-point'), 'solution')[0]).toContain('nothing to solve');
    expect(views(tpl('frame-fixed-point')).some((v) => v.step.id === 'forward-pass')).toBe(false);
  });
  it('the end forces: a bar says tension, compression or nothing; a member says what is added by its own loads', () => {
    const t = text(tpl('truss-three-bar'), 'end-forces');
    expect(t[0]).toContain('Bar 1 is in tension: it is pulled and lengthens.');
    expect(text(tpl('truss-two-bar'), 'end-forces')[0]).toContain('Bar 1 is in compression: it is pushed and shortens.');
    const idle = build({ mode: 'truss', nodes: [[0, 0], [10, 0], [5, 5], [20, 5]], members: [[1, 2], [1, 3], [2, 3], [3, 4]], supports: [[1, 'pin'], [2, 'roller']], loads: [[3, 0, -5]] });
    const a = analyseSafely(idle);
    if (a.solution) expect(text(idle, 'end-forces').some((x) => x.includes('carries no force'))).toBe(true);
    expect(text(tpl('frame-propped'), 'end-forces')[0]).toContain('+ f_FE, adding the fixed-end forces of its own loads');
    expect(text(tpl('frame-portal'), 'end-forces')[0]).not.toContain('f_FE');
    expect(text(tpl('frame-portal'), 'end-forces')[0]).toContain('N_i = −f_1, V_i = f_2, M_i = −f_3');
    expect(text(tpl('frame-portal'), 'end-forces')[1]).toContain('N is positive in tension');
  });
  it('the checks quote the library’s tolerance, the centre of the structure and the balance', () => {
    const t = text(tpl('truss-two-bar'), 'checks')[0];
    expect(t).toContain('centre of the structure (8, 3)');
    // one tolerance, each check against its own scale: the force scale is the loads added up (20 + 30 kip), not the sum of the terms of an equation
    expect(t).toContain('is within its tolerance when it is at most 1 × 10⁻⁸ of that scale plus the rounding of its own terms. The scale is the force scale, 50 kip (the largest of the loads added up, the largest reaction and the largest end force)');
    expect(t).toContain('the work of the loads and the reactions added up in size, 0.02694 kip·ft, for the energy');
    expect(t).toMatch(/The rounding allowed is 100 roundings of the arithmetic times the sizes of the terms added up, at most [\d.]+ × 10[⁻⁰¹²³⁴⁵⁶⁷⁸⁹]+ kip here\./);
    expect(t).not.toContain('^');
    expect(t).toContain('Balanced: every check is within its tolerance.');
    expect(t).not.toMatch(/\bpass(es)?\b/i);
    expect(t).not.toContain('Not balanced');
    const steps = stepsOf(tpl('truss-two-bar'));
    const bent = steps.map((s) => (s.id === 'checks' ? { ...s, facts: { ...s.facts, allOk: false } } : s));
    const v = stepView(bent.find((s) => s.id === 'checks')!, labelsOf(bent), ctxOf(tpl('truss-two-bar')));
    expect(v.paragraphs.join(' ')).toContain('Not balanced');
    expect(v.paragraphs.join(' ')).not.toContain('Balanced: every check is within');
    expect(v.paragraphs.join(' ')).not.toMatch(/\bfails?\b/i);
  });
});

describe('a worked solution is cheap to make and honest about its size', () => {
  it('weighs a step by the entries of its tables, and a structure at the cap by tens of thousands', () => {
    const small = stepsOf(tpl('truss-two-bar')).reduce((n, s) => n + stepWeight(s), 0);
    const big = stepsOf(girder('frame')).reduce((n, s) => n + stepWeight(s), 0);
    expect(small).toBeLessThan(2000);
    expect(big).toBeGreaterThan(40000);
  });
  it('builds the views of all 130 steps of a 12-node, 20-member structure at once, and the body of one step on demand', () => {
    const form = girder('frame');
    const t0 = performance.now();
    const steps = stepsOf(form);
    const all = steps.map((s) => stepView(s, labelsOf(steps), ctxOf(form)));
    const t1 = performance.now();
    expect(steps).toHaveLength(130);
    expect(all).toHaveLength(130);
    // The views are the cheap part (paragraphs only); the bodies are made when a card is opened.
    expect(t1 - t0).toBeLessThan(2000);
    const K = stepBody(steps.find((s) => s.id === 'assembled')!, ctxOf(form));
    expect(K[0].kind === 'table' && K[0].model.cells).toHaveLength(36);
  });
});
