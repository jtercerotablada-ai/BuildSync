import { createElement as h } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import { beamStrings } from '@/lib/calc/beam/strings';
import { analyseSafely } from '@/lib/calc/stiffness/analysis';
import { choicesOf, defaultStiffness, emptyStiffness, reduceStiffness, type StiffnessForm } from '@/lib/calc/stiffness/model';
import { sharedWords, stiffnessUi } from '@/lib/calc/stiffness/strings';
import { TEMPLATE_IDS } from '@/lib/calc/stiffness/templates';
import { StiffnessCalculator } from './StiffnessCalculator';
import { faultIsAbout, straySettlements } from './Rows';
import { filledLine, keepOpen, settlementOpen, settles } from './rows-state';
import { templatePlan } from './textbook';
import { formToSolve, noticeText } from './text';

vi.setConfig({ testTimeout: 120_000 });

/**
 * THE ROWS OF THE FORM and what an edit does to them: a settlement being typed, a settlement kept on a movement the support does not hold, the
 * fault that is about two fields and not about the others, a problem loaded over a copy of itself, and the sentences of the notice that tells what
 * a deleted node took with it.
 */

const base = defaultStiffness();
const show = (form: StiffnessForm, lang: 'en' | 'es' = 'en') => renderToStaticMarkup(h(StiffnessCalculator, { t: sharedWords(beamStrings[lang].ui), w: stiffnessUi[lang], initial: form }));
const text = (html: string) => html.replace(/<[^>]+>/g, ' ').replace(/&#x27;/g, "'").replace(/\s+/g, ' ').trim();
const patchSupport = (f: StiffnessForm, k: number, patch: Record<string, unknown>) => reduceStiffness(f, { type: 'patch', list: 'supports', id: f.supports[k].id, patch });

describe('a settlement being typed keeps its fields open', () => {
  const none = new Set<number>();

  it('a support with a settlement shows its fields, and cannot hide them while it moves the structure', () => {
    const s = patchSupport(base, 0, { dy: -0.5 }).supports[0];
    expect(settles(s, false)).toBe(true);
    expect(settlementOpen(none, s, false)).toEqual({ open: true, forced: true });
    const still = base.supports[0];
    expect(settlementOpen(none, still, false)).toEqual({ open: false, forced: false });
  });

  it('the sequence that wiped the field: an opened link with a settlement, then the value typed through 0 on its way to 0.25 - the row stays open, with its fields and its way to close them', () => {
    // The row is open because there is a settlement (forced). The visitor selects the value and types "0": the form now holds no settlement.
    let f = patchSupport(base, 0, { dy: -0.5 });
    let more: ReadonlySet<number> = none;
    expect(settlementOpen(more, f.supports[0], false).open).toBe(true);
    // The edit goes through the page's own rule (the calculator calls `keepOpen` on every patch):
    more = keepOpen(more, 'supports', f.supports[0].id, { dy: 0 });
    f = patchSupport(f, 0, { dy: 0 });
    expect(settles(f.supports[0], false)).toBe(false);
    const after = settlementOpen(more, f.supports[0], false);
    expect(after).toEqual({ open: true, forced: false });
    // …and the next key, ".25", lands in a field that is still there, then the value is a settlement again.
    more = keepOpen(more, 'supports', f.supports[0].id, { dy: 0.25 });
    f = patchSupport(f, 0, { dy: 0.25 });
    expect(settlementOpen(more, f.supports[0], false)).toEqual({ open: true, forced: true });
    // Without the rule - what the page did - the row was closed at the "0".
    expect(settlementOpen(none, patchSupport(f, 0, { dy: 0 }).supports[0], false).open).toBe(false);
  });

  it('only a settlement keeps a row open: a typed coordinate, a restraint, another list or a support already open change nothing', () => {
    const id = base.supports[0].id;
    expect(keepOpen(none, 'nodes', id, { x: 3 })).toBe(none);
    expect(keepOpen(none, 'supports', id, { ux: false })).toBe(none);
    expect(keepOpen(none, 'loads', id, { dy: 3 })).toBe(none);
    const open = new Set([id]);
    expect(keepOpen(open, 'supports', id, { dx: 1 })).toBe(open);
    expect([...keepOpen(none, 'supports', id, { dr: 0.01 })]).toEqual([id]);
    expect([...keepOpen(none, 'supports', id, { dx: 0 })]).toEqual([id]);
  });

  it('a rotation counts only in a frame', () => {
    const f = reduceStiffness(base, { type: 'mode', mode: 'frame' });
    const s = patchSupport(patchSupport(f, 0, { rz: true }), 0, { dr: 0.01 }).supports[0];
    expect(settles(s, true)).toBe(true);
    expect(settles(s, false)).toBe(false);
  });
});

describe('a settlement typed on a movement the support does not hold', () => {
  const unit = { displacement: 'in', rotation: 'rad' };
  it('is told on the support’s row, with the DOF it is typed for, so that it is not a number kept in the structure and shown nowhere', () => {
    // Along y is ticked and a settlement typed, then Along y is unticked: the value stays, hidden.
    let f = patchSupport(base, 0, { dy: -1 });
    f = patchSupport(f, 0, { uy: false });
    expect(straySettlements(f.supports[0], 1, false, unit)).toEqual([{ field: 'dy', dof: '1y', value: -1, unit: 'in' }]);
    // A held movement's settlement is not stray (it is the one that moves the structure), and a value of 0 is nothing.
    expect(straySettlements(patchSupport(base, 0, { dy: -1 }).supports[0], 1, false, unit)).toEqual([]);
    expect(straySettlements(patchSupport(f, 0, { dy: 0 }).supports[0], 1, false, unit)).toEqual([]);
    expect(straySettlements(patchSupport(f, 0, { dy: Number.NaN }).supports[0], 1, false, unit)).toEqual([]);
  });

  it('names a rotation too, in a frame only', () => {
    const frame = reduceStiffness(base, { type: 'mode', mode: 'frame' });
    const s = patchSupport(frame, 0, { dr: 0.01 }).supports[0];
    expect(straySettlements(s, 2, true, unit)).toEqual([{ field: 'dr', dof: '2θ', value: 0.01, unit: 'rad' }]);
    expect(straySettlements(s, 2, false, unit)).toEqual([]);
  });

  it('is on the page when it exists, in both languages, with a button that clears it, and is not when it does not', () => {
    let f = patchSupport(base, 0, { dy: -1 });
    f = patchSupport(f, 0, { uy: false });
    const en = text(show(f));
    expect(en).toContain('A settlement of −1 in is typed for DOF 1y, which this support does not hold, so it has no effect.');
    expect(show(f)).toMatch(/<button type="button" class="mp-app__btn mp-app__btn--quiet">Clear it<\/button>/);
    expect(text(show(f, 'es'))).toContain('Hay escrito un asentamiento de −1 in para el GDL 1y, que este apoyo no restringe, así que no tiene efecto.');
    expect(text(show(base))).not.toContain('does not hold');
  });

  it('is gone when the movement is held again (the value counts then, and is shown as the settlement it is)', () => {
    let f = patchSupport(patchSupport(base, 0, { dy: -1 }), 0, { uy: false });
    f = patchSupport(f, 0, { uy: true });
    expect(text(show(f))).not.toContain('does not hold');
    expect(text(show(f))).toContain('Settlement along y');
  });
});

describe('a fault that is about some fields marks those and not the others', () => {
  const issue = (code: string, field?: string) => ({ code, row: field ? { list: 'members', id: 1, field } : undefined }) as unknown as Parameters<typeof faultIsAbout>[0];

  it('a member from a node to itself is about its two nodes: not its modulus, its area or its inertia', () => {
    for (const code of ['zero-length', 'short-member', 'duplicate-member']) {
      expect(faultIsAbout(issue(code), 'i'), code).toBe(true);
      expect(faultIsAbout(issue(code), 'j'), code).toBe(true);
      for (const other of ['E', 'A', 'I']) expect(faultIsAbout(issue(code), other), `${code} ${other}`).toBe(false);
    }
  });

  it('a fault that names its field is about that field alone, and a code that is not listed is about every field of its row', () => {
    expect(faultIsAbout(issue('number', 'x'), 'x')).toBe(true);
    expect(faultIsAbout(issue('number', 'x'), 'y')).toBe(false);
    expect(faultIsAbout(issue('something-else'), 'anything')).toBe(true);
    expect(faultIsAbout(issue('duplicate-support'), 'node')).toBe(true);
    expect(faultIsAbout(issue('duplicate-support'), 'ux')).toBe(false);
  });

  it('on the page a member from a node to itself marks its two node fields invalid and no other', () => {
    const f = reduceStiffness(base, { type: 'patch', list: 'members', id: base.members[0].id, patch: { j: base.members[0].i } });
    const html = show(f);
    const row = html.match(/<div class="mp-app__item mp-st__item" role="group" aria-label="Member 1" data-invalid="true">[\s\S]*?(?=<div class="mp-app__item mp-st__item" role="group" aria-label="Member 2")/)![0];
    const invalid = [...row.matchAll(/<(?:input|select)[^>]*aria-invalid="true"[^>]*>/g)].map((m) => m[0]);
    expect(invalid).toHaveLength(2);
    for (const tag of invalid) expect(tag).toMatch(/aria-label="(First node|Second node), Member 1"/);
  });
});

describe('a problem loaded over a copy of itself is the structure on screen at once', () => {
  const id = TEMPLATE_IDS[0];
  const loaded = reduceStiffness(emptyStiffness('us'), { type: 'template', template: id });
  const edited = reduceStiffness(loaded, { type: 'patch', list: 'nodes', id: loaded.nodes[2].id, patch: { y: 7 } });

  it('hands back one structure that is both what the form becomes and the one the page remembers as opened whole', () => {
    const plan = templatePlan(edited, id);
    expect(plan.action.type).toBe('load');
    const next = reduceStiffness(edited, plan.action);
    expect(next).toBe(plan.whole);
    expect(encodeStructure(plan.whole)).toBe(encodeStructure(loaded));
  });

  it('is solved in the render that shows it - the numbers differ only by typed values, which the page otherwise solves a moment later under the results of the structure before', () => {
    // Only numbers changed: the structure before and the problem make the same "choices".
    expect(choicesOf(edited)).toBe(choicesOf(loaded));
    const plan = templatePlan(edited, id);
    const solved = (whole: StiffnessForm | null, form: StiffnessForm) => formToSolve({ form, behind: edited, whole, onPaper: false, choices: choicesOf });
    // What the page did: the action 'template' (a new object), nothing remembered - the form before was solved again.
    expect(solved(null, reduceStiffness(edited, { type: 'template', template: id }))).toBe(edited);
    // What it does: the form is the one remembered, so it is the one solved.
    expect(solved(plan.whole, reduceStiffness(edited, plan.action))).toBe(plan.whole);
    expect(analyseSafely(solved(plan.whole, plan.whole)).results!.displacements[2].uy).toBeCloseTo(analyseSafely(loaded).results!.displacements[2].uy, 12);
  });
});
const encodeStructure = (f: StiffnessForm) => JSON.stringify(f.nodes.map((n) => [n.x, n.y]));

describe('the notice of what a deleted node took with it agrees with its count, in both languages', () => {
  const del = (lang: 'en' | 'es', patch: Partial<Extract<NonNullable<StiffnessForm['notice']>, { code: 'node-removed' }>>) =>
    noticeText({ code: 'node-removed', node: 3, members: [], supports: 0, loads: 0, memberLoads: 0, renumbered: false, membersRenumbered: false, ...patch }, stiffnessUi[lang])!.text;

  it('one load, one member load, one member: singular verb and singular pronoun (Spanish "que estaba", English "the number it had")', () => {
    expect(del('es', { loads: 1 })).toBe('Se borró el nudo 3. Se llevó consigo 1 carga que estaba en ese nudo.');
    expect(del('es', { loads: 3 })).toBe('Se borró el nudo 3. Se llevó consigo 3 cargas que estaban en ese nudo.');
    expect(del('es', { memberLoads: 1 })).toContain('1 carga que estaba sobre esas barras');
    expect(del('es', { memberLoads: 2 })).toContain('2 cargas que estaban sobre esas barras');
    expect(del('es', { members: [2] })).toContain('Salió con él la barra 2; su número es el de antes del borrado.');
    expect(del('es', { members: [2, 4] })).toContain('Salieron con él las barras 2 y 4; sus números son los de antes del borrado.');
    expect(del('en', { members: [2] })).toContain('Also removed: member 2 (the number it had before the deletion).');
    expect(del('en', { members: [2, 4] })).toContain('Also removed: members 2 and 4 (the numbers they had before the deletion).');
  });

  it('a deleted member’s own loads agree too', () => {
    const own = (lang: 'en' | 'es', n: number) => noticeText({ code: 'member-removed', member: 2, memberLoads: n, renumbered: false }, stiffnessUi[lang])!.text;
    expect(own('es', 1)).toContain('1 carga que estaba sobre esa barra');
    expect(own('es', 2)).toContain('2 cargas que estaban sobre esa barra');
  });
});

describe('the line that says a steel shape went into a section', () => {
  it('names the structure or the member as a place in the sentence, with its article, in both languages ("for the structure", not "for The structure")', () => {
    const w = stiffnessUi;
    expect(filledLine(w.en, 'W14x22', 'structure')).toBe('W14x22 filled in for the structure (members without their own).');
    expect(filledLine(w.en, 'W14x22', 3)).toBe('W14x22 filled in for member 3.');
    expect(filledLine(w.es, 'W14x22', 'structure')).toBe('Se llenó W14x22 para la estructura (las barras sin sección propia).');
    expect(filledLine(w.es, 'W14x22', 3)).toBe('Se llenó W14x22 para la barra 3.');
    // No capital in the middle of a sentence, and no hole left.
    for (const lang of ['en', 'es'] as const) for (const t of ['structure', 2] as const) expect(filledLine(w[lang], 'W8x10', t)).not.toMatch(/ (The|La|Barra|Member)\b|\{/);
  });
});

describe('the words that have to fit a phone', () => {
  it('a member’s own section says what a blank means in a word that fits a field 78 px wide, in both languages', () => {
    for (const lang of ['en', 'es'] as const) expect(stiffnessUi[lang].members.sameAsStructure.length).toBeLessThanOrEqual(12);
  });

  it('the kinds of member load are short enough for the select of a phone (the Spanish ones were cut at "Puntual, transversal a la b…")', () => {
    for (const lang of ['en', 'es'] as const) {
      for (const [kind, label] of Object.entries(stiffnessUi[lang].memberLoads.kinds)) expect(label.length, `${lang} ${kind}`).toBeLessThanOrEqual(lang === 'es' ? 22 : 26);
    }
    expect(stiffnessUi.es.memberLoads.kinds).toEqual({ udl: 'Uniforme, transversal', point: 'Puntual, transversal', axial: 'Uniforme, axial' });
  });
});
