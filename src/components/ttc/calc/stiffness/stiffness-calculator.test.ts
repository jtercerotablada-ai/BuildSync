import { createElement as h } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { beamStrings } from '@/lib/calc/beam/strings';
import { analyseSafely, type AnalysisIssue } from '@/lib/calc/stiffness/analysis';
import { ISSUE_CODES, NOTHING_TO_ADD_WHY, WARNING_CODES } from '@/lib/calc/stiffness/codes';
import {
  LIMITS,
  choicesOf,
  convertStiffness,
  decodeStiffness,
  defaultStiffness,
  emptyStiffness,
  encodeStiffness,
  reduceStiffness,
  type StiffnessForm,
  type StiffnessList,
} from '@/lib/calc/stiffness/model';
import { sharedWords, stiffnessUi } from '@/lib/calc/stiffness/strings';
import { TEMPLATE_IDS, type TemplateId } from '@/lib/calc/stiffness/templates';
import { autoOpen } from './solution-state';
import type { Lang } from '@/lib/ttc/i18n';
import { EXAMPLE, StiffnessCalculator, caseIn } from './StiffnessCalculator';
import { build, girder, settling } from './fixtures.testlib';
import { fill, flaggedNodes, focusAddedRow, formToSolve, issueSentence, keepsMarks, largestNode, largestReaction, leaveBehind, listOf, noticeText, openWhole, readingSentence, restartsRows, signed, warningSentence } from './text';

vi.setConfig({ testTimeout: 120_000 });
afterEach(() => new Promise<void>((done) => setTimeout(done, 0)));

/**
 * THE STIFFNESS CALCULATOR as the server sends it (what a visitor sees before the script arrives, or without it): its tables, its template
 * group, its answer, its worked solution, every state of the structure, its two languages - and the small rules of the form as pure functions.
 * What only a browser can show (typing, a card opened, the address after the #, a row added with the keyboard, the phone's layout, the printed
 * sheet) is listed in the report that goes with this file.
 */

const LANGS: Lang[] = ['en', 'es'];
const text = (html: string) =>
  html
    .replace(/<(script|style|noscript)\b[\s\S]*?<\/\1>/g, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&')
    .replace(/&#x27;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/[ \t\n\r\f\v]+/g, ' ')
    .trim();
const show = (lang: Lang, initial?: StiffnessForm) => renderToStaticMarkup(h(StiffnessCalculator, { t: sharedWords(beamStrings[lang].ui), w: stiffnessUi[lang], initial }));
const noise = /NaN|undefined|Infinity|\[object|(?:^|[\s>(=])-0(?![.\d])|−0(?![.\d])|\be[+-]\d|\{[a-zA-Z]+(\|[^}]*)?\}/;
const tpl = (id: TemplateId, units: 'us' | 'si' = 'us') => reduceStiffness(emptyStiffness(units), { type: 'template', template: id });
const base = defaultStiffness();
const frameOf = (f: StiffnessForm) => reduceStiffness(f, { type: 'mode', mode: 'frame' });
const cardHeads = (html: string) => [...html.matchAll(/<h3 class="mp-st__cardhead"[^>]*><button[^>]*aria-expanded="(true|false)"[^>]*>/g)].map((m) => m[1] === 'true');
const cardTitles = (html: string) => [...html.matchAll(/<h3 class="mp-st__cardhead"[^>]*><button[^>]*>([\s\S]*?)<\/button><\/h3>/g)].map((m) => text(m[1]));
const issueList = (html: string) => [...(html.match(/<div class="mp-app__issues"[^>]*>([\s\S]*?)<\/div>/)?.[1] ?? '').matchAll(/<li[^>]*>([\s\S]*?)<\/li>/g)].map((m) => text(m[1]));
const reading = (html: string) => text(html.match(/<p id="[^"]+" class="mp-st__reading">([\s\S]*?)<\/p>/)?.[1] ?? '');
const cells = (row: string) => [...row.matchAll(/<t[hd]\b[^>]*>([\s\S]*?)<\/t[hd]>/g)].map((c) => text(c[1].replace(/<span class="mp-st__head"[\s\S]*?<\/span><\/span>|<span class="mp-st__head" aria-hidden="true">[\s\S]*?<\/span>/g, '')));
const answerCard = (html: string, title: string) => {
  const cards = html.split(/<div class="mp-app__card mp-app__card--wide">/).slice(1);
  return cards.find((c) => text(c.match(/<h3\b[^>]*>([\s\S]*?)<\/h3>/)?.[1] ?? '') === title) ?? '';
};
const rowsOf = (card: string) => [...(card.match(/<tbody\b[^>]*>([\s\S]*?)<\/tbody>/)?.[1] ?? '').matchAll(/<tr\b[^>]*>([\s\S]*?)<\/tr>/g)].map((r) => cells(r[1]));

describe('the default structure, as the server sends it', () => {
  const html = show('en');
  const t = text(html);

  it('gives the answer of the two-bar truss: displacements, reactions, bar forces and the balance', () => {
    expect(t).toContain('Statically determinate');
    expect(t).toContain('degree = bars + reactions − 2 × nodes = 2 + 4 − 2 × 3 = 0');
    expect(rowsOf(answerCard(html, 'Node displacements'))).toEqual([
      ['1', '0', '0', '0'],
      ['2', '0', '0', '0'],
      ['3', '+0.006466', '−0.01724', '0.01841'],
    ]);
    expect(rowsOf(answerCard(html, 'Reactions'))).toEqual([
      ['1', '1', '+10', '+7.5'],
      ['2', '2', '−30', '+22.5'],
    ]);
    expect(rowsOf(answerCard(html, 'Bar forces'))).toEqual([
      ['1', '1 – 3', '10', '−12.5', 'compression', '−1.25', '−0.005172'],
      ['2', '2 – 3', '10', '−37.5', 'compression', '−3.75', '−0.01552'],
    ]);
    expect(text(answerCard(html, 'Equilibrium check'))).toContain('Balanced');
    expect(t).not.toContain('Not balanced');
    expect(t).toContain('0.01841 in at node 3');
    expect(t).toContain('37.5 kip at node 2');
    expect(t).toContain('−37.5 kip in member 2');
  });

  it('opens on the worked solution, every card open, in the order of the method', () => {
    const titles = cardTitles(html);
    expect(titles).toHaveLength(26);
    expect(titles.map((x) => x.replace(/^Step [\d.]+/, '').replace(/[−+]$/, '').trim())).toEqual([
      'The structure and its degrees of freedom',
      'Geometry of member 1',
      'Geometry of member 2',
      'Local stiffness of member 1',
      'Local stiffness of member 2',
      'Transformation of member 1',
      'Transformation of member 2',
      'Member 1 in global axes',
      'Member 2 in global axes',
      'Assembly: adding member 1 to K',
      'Assembly: adding member 2 to K',
      'The assembled stiffness matrix K',
      'Loads at the nodes',
      'The load vector P',
      'Free and held degrees of freedom',
      'The reduced equations',
      'The augmented matrix',
      'Forward elimination, column 1',
      'Back-substitution: unknown 2',
      'Back-substitution: unknown 1',
      'The solution and its residual',
      'The displacement vector u',
      'Reactions at the supports',
      'Forces at the ends of member 1',
      'Forces at the ends of member 2',
      'Checks',
    ]);
    expect(cardHeads(html)).toEqual(Array(26).fill(true));
    expect(t).not.toContain('start closed');
  });

  it('names every table, gives it row and column headers with a scope, and every id is in the page once', () => {
    const ids = [...html.matchAll(/ id="([^"]+)"/g)].map((m) => m[1]);
    expect(new Set(ids).size).toBe(ids.length);
    for (const m of html.matchAll(/aria-labelledby="([^"]+)"/g)) expect(ids, m[1]).toContain(m[1]);
    for (const m of html.matchAll(/aria-controls="([^"]+)"/g)) expect(ids, m[1]).toContain(m[1]);
    const tables = [...html.matchAll(/<table\b[\s\S]*?<\/table>/g)].map((x) => x[0]);
    // The server draws the tables of the first few cards of the worked solution (the others come as they near the screen), and the answer's own.
    expect(tables.length).toBeGreaterThan(8);
    expect(tables.length).toBeLessThan(40);
    for (const table of tables) {
      expect(table).toMatch(/<table[^>]*aria-labelledby="[^"]+"/);
      if (table.includes('mp-st__matrix')) {
        expect(table).toMatch(/<caption class="mp-st__sr">[^<]{6,}<\/caption>/);
        expect(table).toMatch(/<th scope="col"/);
        expect(table).toMatch(/<th scope="row"/);
      }
    }
    // The answer’s own tables have their heads and their row heads too.
    for (const title of ['Node displacements', 'Reactions', 'Bar forces']) {
      const card = answerCard(html, title);
      expect(card, title).toMatch(/<th scope="col" role="columnheader">/);
      expect(card, title).toMatch(/<th scope="row" role="rowheader"/);
    }
  });

  it('puts the links to the drawing, the results and the solution before the form, to ids that take the focus', () => {
    for (const lang of LANGS) {
      const out = show(lang);
      const nav = out.match(/<nav class="mp-st__jumps" aria-label="([^"]*)">([\s\S]*?)<\/nav>/)!;
      expect(nav[1]).toBe(stiffnessUi[lang].jump.label);
      const links = [...nav[2].matchAll(/<a href="#([^"]+)">([^<]*)<\/a>/g)];
      expect(links.map((l) => l[2])).toEqual([stiffnessUi[lang].jump.drawing, stiffnessUi[lang].jump.results, stiffnessUi[lang].jump.steps]);
      for (const [, id] of links) expect(out).toMatch(new RegExp(`id="${id.replace(/:/g, '\\:')}"[^>]*tabindex="-1"|tabindex="-1"[^>]*id="${id.replace(/:/g, '\\:')}"`));
      expect(out.indexOf('mp-st__jumps')).toBeLessThan(out.indexOf('<form'));
    }
  });

  it('writes the one sentence under the drawing from the numbers, in both languages', () => {
    expect(reading(html)).toBe(
      'Reading the drawing: lines are members, circles are nodes with their numbers, and the supports stand where the held movements are. The line of dashes and dots is the deformed shape, magnified 600 times. Node 3 moves most, by 0.01841 in. Largest reaction: 37.5 kip, at node 2.',
    );
    expect(reading(show('es'))).toBe(
      'Cómo leer el dibujo: las líneas son barras, los círculos son nudos con sus números, y los apoyos están donde están los movimientos restringidos. La línea de rayas y puntos es la deformada, ampliada 600 veces. El nudo 3 es el que más se mueve: 0.01841 in. Mayor reacción: 37.5 kip (nudo 2).',
    );
  });

  it('keeps every line for what has just happened on the page mounted and empty, before it has anything to say', () => {
    const lines = [...html.matchAll(/<p class="(mp-st__notice|mp-st__limit|mp-app__computed mp-st__said|mp-st__filled)"[^>]*role="status"[^>]*>([\s\S]*?)<\/p>/g)];
    // Four lists (nodes, members, supports, loads) with their notice and their limit, the "loaded" line and the shape picker’s line.
    expect(lines.length).toBe(4 + 4 + 1 + 1);
    expect(lines.every((l) => text(l[2]) === '')).toBe(true);
    // The box of problems, the warnings and the copy line are in the page too, empty.
    expect(html).toMatch(/<div class="mp-app__issues" role="status" aria-live="polite"><\/div>/);
    expect(html).toMatch(/<div class="mp-st__warnings" role="status" data-empty="true"><\/div>/);
    expect(html).toMatch(/<p class="mp-app__copied" role="status" aria-live="polite"><\/p>/);
    // Every matrix that is drawn has its copy line mounted before it is pressed.
    const figures = (html.match(/<figure class="mp-st__fig"/g) ?? []).length;
    expect(figures).toBeGreaterThan(3);
    expect((html.match(/<p class="mp-st__copied" role="status"><\/p>/g) ?? []).length).toBe(figures);
  });

  it('is the same page every time it is sent (nothing in it depends on the clock or on chance)', () => {
    expect(show('en')).toBe(html);
    expect(show('es')).toBe(show('es'));
  });

  it('prints no -0, NaN or e-notation, in either language or either unit system', () => {
    for (const lang of LANGS) for (const f of [base, convertStiffness(base, 'si'), tpl('frame-portal'), settling()]) expect(text(show(lang, f)), lang).not.toMatch(noise);
  });
});

describe('every textbook problem, in both unit systems and both languages', () => {
  for (const id of TEMPLATE_IDS) {
    it(`${id}: the structure it loads is solved, balanced, drawn and written out without a mark of trouble`, () => {
      for (const units of ['us', 'si'] as const) {
        for (const lang of LANGS) {
          const f = tpl(id, units);
          const a = analyseSafely(f);
          const where = `${id} ${units} ${lang}`;
          expect(a.results, where).not.toBeNull();
          expect(a.results!.equilibrium.balanced, where).toBe(true);
          const html = show(lang, f);
          const t = text(html);
          expect(t, where).not.toMatch(noise);
          expect(t, where).toContain(units === 'us' ? 'kip' : 'kN');
          expect(t, where).toContain(stiffnessUi[lang].results.summary.equilibrium.title);
          expect(t, where).not.toContain(stiffnessUi[lang].steps.checks.unbalanced);
          expect(t, where).not.toContain(stiffnessUi[lang].results.summary.equilibrium.unbalanced.split('{tol}')[0]);
          expect(cardTitles(html).length, where).toBeGreaterThan(5);
          expect(cardHeads(html).some(Boolean), where).toBe(true);
        }
      }
    });
  }
  const groupOf = (html: string) => html.match(/<fieldset class="mp-app__group mp-st__template">([\s\S]*?)<\/fieldset>/)![1];
  const selectedOf = (html: string) => text(groupOf(html).match(/<option value="[^"]*" selected="">([^<]*)<\/option>/)?.[1] ?? '');
  it('the group offers every problem by name, and shows the first one’s hand answer and the tool’s beside it, in both languages: they are about the structure on screen', () => {
    for (const lang of LANGS) {
      const w = stiffnessUi[lang];
      const html = show(lang);
      const group = groupOf(html);
      for (const id of TEMPLATE_IDS) expect(text(group), `${lang} ${id}`).toContain(w.template.names[id]);
      expect(text(group)).toContain(text(w.template.answer.replace('{answer}', '')).trim());
      expect(text(group)).toContain(text(w.template.got.replace('{answer}', '')).trim());
      expect(text(group)).toContain(lang === 'en' ? 'agrees with the hand answer' : 'coincide con la respuesta a mano');
      expect(text(group)).not.toMatch(/passes|fails|se cumple|falla/);
      expect(group).toContain('data-agrees="true"');
      expect(group).toContain('role="status"');
      expect(selectedOf(html)).toBe(w.template.names['truss-two-bar']);
    }
  });
  it('once the structure is not the problem, no answer is quoted beside it: one line says so (an edit, the other units, the other kind of structure)', () => {
    const edited = reduceStiffness(base, { type: 'patch', list: 'loads', id: base.loads[0].id, patch: { fy: -999 } });
    const w = stiffnessUi.en.template;
    for (const f of [edited, convertStiffness(base, 'si'), reduceStiffness(base, { type: 'mode', mode: 'frame' })]) {
      const html = show('en', f);
      const g = text(groupOf(html));
      expect(g).not.toContain('Hand answer');
      expect(g).not.toContain('This tool gives');
      expect(g).not.toContain('agrees with the hand answer');
      expect(groupOf(html)).not.toContain('data-agrees');
      // …whatever it did to the results beside it: they are of the structure on screen.
      expect(text(html)).toContain('Largest reaction');
    }
    // The list stays on the problem the structure was when the structure is the page's own edit of it; one that was never a problem says "your own".
    expect(text(groupOf(show('en', convertStiffness(base, 'si'))))).toContain(w.pickOne);
    expect(selectedOf(show('en', convertStiffness(base, 'si')))).toBe(w.own);
    // The Spanish page says the same in its words.
    expect(text(groupOf(show('es', edited)))).not.toContain('Respuesta a mano');
  });
  it('the metric problem, loaded, is compared with its own hand answer (-50 kN, not the US -12.5 kip), and the list stands on it', () => {
    const si = tpl('truss-two-bar', 'si');
    const html = show('en', si);
    const g = text(groupOf(html));
    expect(g).toContain('Hand answer: bar 1 carries −50 kN and bar 2 −150 kN');
    expect(g).toContain('This tool gives: bar 1 carries −50 kN and bar 2 −150 kN');
    expect(selectedOf(html)).toBe(stiffnessUi.en.template.names['truss-two-bar']);
    // …and the results beside it are the same numbers.
    expect(text(html)).toContain('−150 kN in member 2');
  });
  it('a structure opened from an address that is one of the problems has the list on that problem; one that is none of them, on "your own structure", with the way to compare', () => {
    const portal = tpl('frame-portal');
    expect(selectedOf(show('en', portal))).toBe(stiffnessUi.en.template.names['frame-portal']);
    expect(text(groupOf(show('en', portal)))).toContain('the tool agrees with the hand answer');
    const own = reduceStiffness(portal, { type: 'patch', list: 'loads', id: portal.loads[0].id, patch: { fx: 11 } });
    expect(selectedOf(show('en', own))).toBe(stiffnessUi.en.template.own);
    expect(text(groupOf(show('en', own)))).toContain(stiffnessUi.en.template.pickOne);
    // With nothing on the list there is nothing to load: the button says so by being disabled.
    expect(groupOf(show('en', own))).toMatch(/<button[^>]*disabled=""[^>]*>Load problem<\/button>/);
    expect(groupOf(show('en', portal))).not.toMatch(/<button[^>]*disabled=""[^>]*>Load problem<\/button>/);
  });
});

describe('truss and frame show what each uses, and hide what it does not', () => {
  const truss = show('en');
  const frame = show('en', frameOf(base));
  it('a truss has no rotation checkbox, no moment, no inertia and no member loads group', () => {
    expect(truss).not.toContain('>Rotation<');
    expect(truss).not.toContain('Moment, M');
    expect(truss).not.toContain('Inertia, I');
    expect(truss).not.toContain('Loads on members');
    expect(truss).not.toContain('Moment of inertia');
    expect(truss).toContain('Along x');
  });
  it('a frame has all of them, and its member loads group, with the way to add one', () => {
    expect(frame).toContain('Rotation');
    expect(frame).toContain('Moment, M');
    expect(frame).toContain('Inertia, I');
    expect(frame).toContain('Loads on members');
    expect(frame).toContain('Add a member load');
  });
  it('member loads kept in a truss are shown, and said to be unused, so that they can be deleted', () => {
    let f = frameOf(base);
    f = reduceStiffness(f, { type: 'add', list: 'memberLoads', seed: {} });
    const back = reduceStiffness(f, { type: 'mode', mode: 'truss' });
    const html = show('en', back);
    expect(html).toContain('Loads on members');
    expect(html).toContain('kept but not used');
    expect(html).not.toContain('Add a member load');
    expect(text(html)).toContain('1 member load is ignored');
  });
  it('a settlement is hidden behind its own button until there is one, and then it is shown for the support that has it', () => {
    expect(truss).toContain('>Settlement<');
    expect(truss).not.toContain('Settlement along');
    const settled = reduceStiffness(base, { type: 'patch', list: 'supports', id: base.supports[0].id, patch: { dy: -0.25 } });
    const html = text(show('en', settled));
    // The pinned support holds both directions, so both fields are there; the other support has no settlement and keeps its button.
    expect(html).toContain('Settlement along x in');
    expect(html).toContain('Settlement along y in');
    expect((html.match(/Settlement along x/g) ?? []).length).toBe(1);
    expect(show('en', settled)).toContain('>Settlement<');
    // A settlement typed on a movement the support no longer holds is not shown as a field.
    const roller = reduceStiffness(settled, { type: 'patch', list: 'supports', id: base.supports[0].id, patch: { uy: false } });
    expect(show('en', roller)).not.toContain('Settlement along y');
  });
  it('each row is a group with its name, the remove button names the row, and a field at fault is tied to its row’s message', () => {
    expect(truss).toContain('role="group" aria-label="Node 2"');
    expect(truss).toContain('aria-label="Remove: Member 1"');
    const f = reduceStiffness(base, { type: 'patch', list: 'nodes', id: base.nodes[1].id, patch: { x: Number.NaN } });
    const html = show('en', f);
    const input = html.match(/<input[^>]*aria-invalid="true"[^>]*>/)![0];
    const id = input.match(/aria-describedby="([^"]+)"/)![1];
    expect(html).toContain(`<p class="mp-app__row-error" id="${id}">`);
    expect(html).toContain('aria-label="Node 2" data-invalid="true"');
  });
});

describe('a structure that cannot be solved', () => {
  const withNode = (f: StiffnessForm, k: number, patch: Record<string, number>) => reduceStiffness(f, { type: 'patch', list: 'nodes', id: f.nodes[k].id, patch });
  const PROBLEMS: { code: string; form: () => StiffnessForm; en: RegExp }[] = [
    { code: 'few-nodes', form: () => reduceStiffness(emptyStiffness(), { type: 'add', list: 'nodes' }), en: /^Two nodes is the least a structure can have; here there are 1\.$/ },
    { code: 'no-members', form: () => reduceStiffness(reduceStiffness(emptyStiffness(), { type: 'add', list: 'nodes' }), { type: 'add', list: 'nodes' }), en: /^No member joins the nodes yet; add some\.$/ },
    { code: 'number', form: () => withNode(base, 1, { x: Number.NaN }), en: /^Node 2: The x coordinate needs a number, not beyond 1 × 10\^30 in size\.$/ },
    { code: 'duplicate-node', form: () => withNode(base, 1, { x: 0, y: 0 }), en: /^Nodes 1 and 2 are in the same place/ },
    { code: 'section', form: () => ({ ...base, E: 1e40 }), en: /^Section and material: The modulus \(E\) / },
    { code: 'section-missing', form: () => ({ ...base, A: null }), en: /^Member 1: The area \(A\) is missing for member 1: the member gives none of its own, and the structure gives none either\./ },
    { code: 'node-unconnected', form: () => reduceStiffness(base, { type: 'add', list: 'nodes' }), en: /^Nothing is attached to node 4\. Attach it to the structure, or remove it\.$/ },
    { code: 'few-supports', form: () => ({ ...base, supports: [] }), en: /^The supports hold 0 movements, and at least 3 are needed/ },
    { code: 'duplicate-support', form: () => reduceStiffness(base, { type: 'patch', list: 'supports', id: base.supports[1].id, patch: { node: base.supports[0].node } }), en: /^Support 2: Node 1 has one support, and a second cannot be added there\./ },
  ];
  it('says each problem in one sentence on its row and in the box, with the numbers it carries', () => {
    for (const p of PROBLEMS) {
      const f = p.form();
      const a = analyseSafely(f);
      expect(a.issues.map((i) => i.code), p.code).toContain(p.code);
      const html = show('en', f);
      expect(issueList(html).some((i) => p.en.test(i)), `${p.code}: ${issueList(html).join(' | ')}`).toBe(true);
      expect(text(html), p.code).not.toMatch(noise);
    }
  });
  it('says a position that is not inside the member on the load’s own row', () => {
    let f = frameOf(base);
    f = reduceStiffness(f, { type: 'add', list: 'memberLoads', seed: { kind: 'point' } });
    f = reduceStiffness(f, { type: 'patch', list: 'memberLoads', id: f.memberLoads[0].id, patch: { a: 99 } });
    const html = show('en', f);
    expect(issueList(html).some((i) => /^Member load 1: The distance has to fall strictly inside the member: more than 0 and less than 10 ft/.test(i))).toBe(true);
    expect(html).toContain('aria-label="Member load 1" data-invalid="true"');
  });
  it('says a mechanism by the DOF and the node, and what to add, and has no results', () => {
    const line = build({ mode: 'truss', nodes: [[0, 0], [10, 0], [20, 0]], members: [[1, 2], [2, 3]], supports: [[1, 'pin'], [3, 'pin']], loads: [[2, 0, -5]] });
    const html = show('en', line);
    const t = text(html);
    expect(t).toContain('The structure is a mechanism: DOF 2y of node 2 can move, and no member has to deform for it.');
    expect(t).toContain('Add a bar, or a support');
    expect(t).toContain('Unstable');
    expect(reading(html)).toMatch(/^Reading the drawing: a mechanism has neither a deformed shape nor reactions, and this structure is one\. Node 2 is free to move\./);
    expect(html).not.toContain('Node displacements');
    expect(html.match(/mp-st-fig__ring/g)?.length ?? 0).toBeGreaterThan(0);
    // The worked solution stops at the column that found the lost pivot, and says so.
    expect(t).toContain('The elimination stops at the column marked below');
    expect(html).toContain('data-singular="true"');
  });
  it('a structure whose supports cannot hold it says so, and is not called a mechanism', () => {
    const f = { ...base, supports: [] };
    const t = text(show('en', f));
    expect(t).toContain('Unstable');
    expect(reading(show('en', f))).toContain('these supports cannot hold the structure');
    expect(t).toContain('The worked solution will appear here when the structure is complete enough to start one.');
    expect(cardTitles(show('en', f))).toHaveLength(0);
  });
  it('shows an empty structure with progressive empty states, not errors about numbers', () => {
    for (const lang of LANGS) {
      const html = show(lang, emptyStiffness());
      expect(text(html)).not.toMatch(noise);
      expect([...html.matchAll(/<p class="mp-app__none">/g)].length).toBe(4);
      expect(reading(html)).toBe('');
      expect(text(html)).toContain(lang === 'en' ? 'The worked solution will appear here' : 'La solución paso a paso aparecerá aquí');
      expect(show(lang, emptyStiffness('si', 'frame')).match(/<p class="mp-app__none">/g)).toHaveLength(5);
    }
  });
  it('says “None.” in the gender of the list, in Spanish', () => {
    const t = text(show('es', emptyStiffness('us', 'frame')));
    expect((t.match(/Ninguno\./g) ?? []).length).toBe(2);
    expect((t.match(/Ninguna\./g) ?? []).length).toBe(3);
  });
  it('every worked-out thing is of the structure on screen: a structure of twelve nodes starts with its very large tables closed, says how many, and draws no table it has no room for', () => {
    const html = show('en', girder('frame'));
    const heads = cardHeads(html);
    expect(heads.length).toBeGreaterThan(100);
    expect(heads).toEqual(autoOpen(analyseSafely(girder('frame')).solution!.steps));
    expect(heads.filter((open) => !open).length).toBeGreaterThan(10);
    expect(text(html)).toContain('This solution has 130 steps and');
    expect(text(html)).toMatch(/Steps with a very large table start closed \(\d+ of 130\)/);
    // Not a table of the closed cards is built, nor of the open ones that are not yet near the screen.
    expect((html.match(/<table\b/g) ?? []).length).toBeLessThan(40);
  });
});

describe('every code has its sentence, in both languages', () => {
  const issue = (code: AnalysisIssue['code']): AnalysisIssue => ({
    code,
    row: { list: 'members', id: 1, field: 'A' },
    at: 2,
    nodes: [1, 2],
    members: [1, 2],
    groups: [[1, 2], [3]],
    count: 2,
    kind: 'sway',
    length: 3,
    distance: 4,
    size: 5,
    list: 'nodes',
    max: 12,
    dof: 4,
    dofLabel: '2y',
    node: 2,
    ratio: 1e-12,
    residual: 1e-5,
    limit: 1e-8,
    shape: [0, 1],
  });
  it('issues: no hole is left, no number is missing, every sentence ends like a sentence', () => {
    for (const lang of LANGS) {
      for (const code of ISSUE_CODES) {
        for (const mode of ['truss', 'frame'] as const) {
          const s = issueSentence(issue(code), stiffnessUi[lang], { number: (v) => String(v), unit: 'ft', mode });
          expect(s, `${lang} ${code}`).not.toMatch(noise);
          expect(s, `${lang} ${code}`).toMatch(/[.)]$/);
          expect(s.length, `${lang} ${code}`).toBeGreaterThan(20);
        }
      }
    }
  });
  it('a mechanism names its DOF, its node and what to add, in the plural and the singular, truss or frame, sway or rigid body', () => {
    const one = issueSentence({ code: 'mechanism', dof: 4, dofLabel: '2y', node: 2, nodes: [2], kind: 'sway', count: 1 }, stiffnessUi.en, { mode: 'truss' });
    expect(one).toBe('The structure is a mechanism: DOF 2y of node 2 can move, and no member has to deform for it. Add a bar, or a support, so that every node is held in both directions by bars that are not in one line.');
    const many = issueSentence({ code: 'mechanism', dof: 4, dofLabel: '2y', node: 2, nodes: [2, 3, 4], kind: 'sway', count: 2 }, stiffnessUi.es, { mode: 'frame' });
    expect(many).toContain('el GDL 2y del nudo 2 puede moverse');
    expect(many).toContain('Los nudos que se mueven son los nudos 2–4.');
    expect(many).toContain('Hay 2 movimientos independientes.');
    expect(many).toContain('Agregue una barra o un apoyo');
    const rigid = issueSentence({ code: 'mechanism', dof: 1, dofLabel: '1x', node: 1, nodes: [1, 2], kind: 'rigid-body', count: 1 }, stiffnessUi.en, { mode: 'truss' });
    expect(rigid).toBe('The structure is a mechanism: the whole structure can slide or turn as one piece, and no member has to deform for it. Change a support so that the held directions are not all parallel, nor meet at one point.');
  });
  it('quotes the library’s own tolerances, so that a sentence can never say another number than the engine uses', () => {
    expect(issueSentence({ code: 'duplicate-node', nodes: [1, 2], distance: 0, size: 10 }, stiffnessUi.en)).toContain('to within 1 × 10^−9 of the structure’s size');
    expect(issueSentence({ code: 'short-member', length: 1e-6, size: 10 }, stiffnessUi.en)).toContain('under 1 × 10^−5 of the structure’s size');
    expect(warningSentence({ code: 'near-mechanism', dofs: [5], ratio: 3e-8, count: 8 }, stiffnessUi.en, { mode: 'truss' })).toMatch(/DOF 3x.*3 × 10\^−8.*1 × 10\^−6/);
  });
  it('warnings: each in both languages with its numbers, a plural and a singular', () => {
    for (const lang of LANGS) {
      for (const code of WARNING_CODES) {
        const s = warningSentence({ code, count: 2, dofs: [3, 4], nodes: [1, 2], ratio: 1e-7 }, stiffnessUi[lang], { mode: 'frame' });
        expect(s, `${lang} ${code}`).not.toMatch(noise);
        expect(s, `${lang} ${code}`).toMatch(/[.)]$/);
        const one = warningSentence({ code, count: 1, dofs: [3], nodes: [1], ratio: 1e-7 }, stiffnessUi[lang], { mode: 'frame' });
        expect(one, `${lang} ${code}`).not.toMatch(noise);
      }
    }
    expect(warningSentence({ code: 'member-loads-ignored', count: 1 }, stiffnessUi.en)).toBe('1 member load is ignored: truss bars carry loads at their nodes only. Switch to frame members to use it.');
    expect(warningSentence({ code: 'member-loads-ignored', count: 3 }, stiffnessUi.es)).toBe('3 cargas sobre barras se ignoran: las barras de una cercha reciben cargas solo en sus nudos. Pase a pórtico para usarlas.');
    expect(warningSentence({ code: 'settlement-ignored', dofs: [5, 6] }, stiffnessUi.en, { mode: 'truss' })).toContain('A settlement is typed on DOFs 3x, 3y, which no support holds, so it has no effect.');
    expect(warningSentence({ code: 'settlement-ignored', dofs: [5] }, stiffnessUi.es, { mode: 'truss' })).toContain('GDL 3x');
  });
  it('every code the library can produce is shown in the page when it happens', () => {
    const cases: Record<string, StiffnessForm> = {
      'few-nodes': reduceStiffness(emptyStiffness(), { type: 'add', list: 'nodes' }),
      'few-supports': { ...base, supports: [] },
      'node-unconnected': reduceStiffness(base, { type: 'add', list: 'nodes' }),
      'duplicate-node': reduceStiffness(base, { type: 'patch', list: 'nodes', id: base.nodes[1].id, patch: { x: 0, y: 0 } }),
      disconnected: build({ mode: 'truss', nodes: [[0, 0], [10, 0], [20, 0], [30, 0]], members: [[1, 2], [3, 4]], supports: [[1, 'pin'], [2, 'roller'], [3, 'pin']] }),
      'duplicate-member': reduceStiffness(base, { type: 'patch', list: 'members', id: base.members[1].id, patch: { i: base.nodes[0].id } }),
    };
    for (const [code, form] of Object.entries(cases)) {
      const a = analyseSafely(form);
      expect(a.issues.map((i) => i.code), code).toContain(code);
      const items = issueList(show('en', form));
      expect(items.length, code).toBeGreaterThan(0);
      for (const item of items) expect(item, code).not.toMatch(noise);
    }
  });
});

describe('what a reading of the drawing says, in every case', () => {
  const how = { num: (v: number, sig = 4) => String(Number(v.toPrecision(sig))), val: (v: number) => signed(String(Math.abs(v)), v), mode: 'truss' as const };
  const w = stiffnessUi.en;
  const frame = tpl('frame-portal');
  it('says nothing for an empty drawing', () => {
    expect(readingSentence(analyseSafely(emptyStiffness()), { deformed: true }, w, how)).toBe('');
  });
  it('says what moves most and which reaction is largest, from the numbers', () => {
    const a = analyseSafely(base);
    expect(largestNode(a)).toEqual({ node: 3, magnitude: a.results!.displacements[2].magnitude });
    expect(largestReaction(a)).toEqual({ node: 2, value: 37.5, moment: false });
    expect(readingSentence(a, { deformed: true }, w, how)).toContain('Node 3 moves most, by 0.01841 in.');
    expect(readingSentence(a, { deformed: true }, w, how)).toContain('Largest reaction: 37.5 kip, at node 2.');
  });
  it('says the deformed shape only when it is drawn', () => {
    const a = analyseSafely(base);
    expect(readingSentence(a, { deformed: true }, w, how)).toContain('magnified 600 times');
    expect(readingSentence(a, { deformed: false }, w, how)).not.toContain('magnified');
    expect(readingSentence(a, { deformed: false }, w, how)).toContain('Node 3 moves most');
  });
  it('a structure under no load: nothing moves, every reaction is zero, and the sentence says it in both cases of the switch', () => {
    const none = reduceStiffness(base, { type: 'patch', list: 'loads', id: base.loads[0].id, patch: { fx: 0, fy: 0 } });
    const a = analyseSafely(none);
    expect(a.warnings.map((x) => x.code)).toContain('no-load');
    expect(largestNode(a)).toBeNull();
    expect(largestReaction(a)).toBeNull();
    // (no load at all: the sentence does not speak of "these loads", and no shape is said to lie anywhere, since none is drawn)
    expect(readingSentence(a, { deformed: true }, w, how)).toContain('No load is applied, so nothing moves and no deformed shape is drawn.');
    expect(readingSentence(a, { deformed: false }, w, how)).toContain('No load is applied, so nothing moves.');
    expect(readingSentence(a, { deformed: false }, w, how)).not.toContain('deformed shape');
    expect(readingSentence(a, { deformed: true }, w, how)).toContain('Every reaction is zero.');
    expect(readingSentence(a, { deformed: true }, w, how)).not.toContain('magnified');
  });
  it('a beam that bends between nodes that do not move is not said to be still', () => {
    const a = analyseSafely(tpl('frame-fixed-point'));
    expect(largestNode(a)).toBeNull();
    const s = readingSentence(a, { deformed: true }, w, { ...how, mode: 'frame' });
    expect(s).toContain('No node moves, but the loaded members bend between their nodes.');
    expect(s).toContain('magnified');
    expect(s).not.toContain('move nothing');
    expect(readingSentence(a, { deformed: false }, w, { ...how, mode: 'frame' })).toContain('No node moves, but the loaded members bend');
  });
  it('the only reactions being moments is said so', () => {
    const f = build({ mode: 'frame', nodes: [[0, 0], [10, 0]], members: [[1, 2]], supports: [[1, 'fixed']], loads: [] });
    const a = analyseSafely(reduceStiffness(f, { type: 'add', list: 'loads', seed: { node: f.nodes[1].id, fx: 0, fy: 0, m: 5 } }));
    expect(a.results).not.toBeNull();
    const big = largestReaction(a);
    expect(big).toMatchObject({ moment: true, node: 1 });
    expect(readingSentence(a, { deformed: true }, w, { ...how, mode: 'frame' })).toContain('Only moments react, the biggest being 5 kip·ft at node 1.');
  });
  it('a settlement that moves nothing else is a movement of its own (the nodes that move are named)', () => {
    const a = analyseSafely(settling());
    expect(a.results).not.toBeNull();
    expect(readingSentence(a, { deformed: true }, w, { ...how, mode: 'frame' })).toContain('moves most');
  });
  it('says a mechanism and an unstable structure, and an unsolved one, with the fix, and the nodes ringed', () => {
    const line = build({ mode: 'truss', nodes: [[0, 0], [10, 0], [20, 0]], members: [[1, 2], [2, 3]], supports: [[1, 'pin'], [3, 'pin']], loads: [[2, 0, -5]] });
    expect(readingSentence(analyseSafely(line), { deformed: true }, w, how)).toBe(
      'Reading the drawing: a mechanism has neither a deformed shape nor reactions, and this structure is one. Node 2 is free to move. A ring marks it on the drawing. Add a bar, or a support, so that every node is held in both directions by bars that are not in one line.',
    );
    const rigid = build({ mode: 'truss', nodes: [[0, 0], [10, 0], [10, 5]], members: [[1, 2], [2, 3], [1, 3]], supports: [[1, 'roller'], [2, 'roller'], [3, 'roller']], loads: [[3, 5, -5]] });
    const ar = analyseSafely(rigid);
    expect(ar.issues.map((i) => i.kind)).toContain('rigid-body');
    expect(readingSentence(ar, { deformed: true }, w, how)).toBe(
      'Reading the drawing: a mechanism has neither a deformed shape nor reactions, and this structure is one. The whole structure is free to slide or turn as one piece. Change a support so that the held directions are not all parallel, nor meet at one point.',
    );
    expect(readingSentence(analyseSafely({ ...base, supports: [] }), { deformed: true }, w, how)).toContain('these supports cannot hold the structure');
    expect(readingSentence(analyseSafely({ ...base, A: null }), { deformed: true }, w, how)).toContain('this is the structure as entered, with no results drawn');
    expect(flaggedNodes(analyseSafely(line))).toEqual([2]);
    expect(flaggedNodes(analyseSafely(base))).toEqual([]);
    void frame;
  });
});

describe('the little rules of the form', () => {
  it('fill: a hole, a plural, a number in a hole that looks like another hole', () => {
    expect(fill('{n} {n|node|nodes}', { n: 1 })).toBe('1 node');
    expect(fill('{n} {n|node|nodes}', { n: 2 })).toBe('2 nodes');
    expect(fill('{a}', { a: '{b}', b: 'x' })).toBe('{b}');
    expect(fill('{missing}', {})).toBe('{missing}');
    expect(listOf([1, 2, 3, 5, 7, 8], 'and')).toBe('1–3, 5, 7 and 8');
    expect(listOf([4], 'and')).toBe('4');
    expect(signed('0', 0)).toBe('0');
    expect(signed('3', -3)).toBe('−3');
  });
  it('choicesOf: a number typed is not a choice, an id, a kind and a restraint are', () => {
    const edited = reduceStiffness(base, { type: 'patch', list: 'loads', id: base.loads[0].id, patch: { fx: 21 } });
    expect(choicesOf(edited)).toBe(choicesOf(base));
    expect(choicesOf(reduceStiffness(base, { type: 'patch', list: 'members', id: base.members[0].id, patch: { j: base.nodes[1].id } }))).not.toBe(choicesOf(base));
    expect(choicesOf(reduceStiffness(base, { type: 'patch', list: 'supports', id: base.supports[0].id, patch: { uy: false } }))).not.toBe(choicesOf(base));
    expect(choicesOf(reduceStiffness(base, { type: 'mode', mode: 'frame' }))).not.toBe(choicesOf(base));
    expect(choicesOf(reduceStiffness(base, { type: 'units', units: 'si' }))).not.toBe(choicesOf(base));
    expect(choicesOf(reduceStiffness(base, { type: 'section', patch: { A: null } }))).not.toBe(choicesOf(base));
    expect(choicesOf(reduceStiffness(base, { type: 'add', list: 'nodes' }))).not.toBe(choicesOf(base));
    // A notice is not part of the case.
    expect(choicesOf({ ...base, notice: { code: 'limit', list: 'nodes', max: 12 } })).toBe(choicesOf(base));
    // A choice among the member loads is seen too.
    const f = reduceStiffness(frameOf(base), { type: 'add', list: 'memberLoads', seed: { kind: 'udl' } });
    expect(choicesOf(reduceStiffness(f, { type: 'patch', list: 'memberLoads', id: f.memberLoads[0].id, patch: { kind: 'axial' } }))).not.toBe(choicesOf(f));
  });
  it('formToSolve: numbers are solved a moment later, anything else in the same render, and paper at once', () => {
    const typed = reduceStiffness(base, { type: 'patch', list: 'loads', id: base.loads[0].id, patch: { fx: 25 } });
    const choices = choicesOf;
    expect(formToSolve({ form: typed, behind: base, whole: null, onPaper: false, choices })).toBe(base);
    expect(formToSolve({ form: typed, behind: base, whole: null, onPaper: true, choices })).toBe(typed);
    expect(formToSolve({ form: typed, behind: base, whole: typed, onPaper: false, choices })).toBe(typed);
    const rowed = reduceStiffness(typed, { type: 'add', list: 'nodes' });
    expect(formToSolve({ form: rowed, behind: base, whole: null, onPaper: false, choices })).toBe(rowed);
    const si = reduceStiffness(typed, { type: 'units', units: 'si' });
    expect(formToSolve({ form: si, behind: typed, whole: null, onPaper: false, choices })).toBe(si);
    // The reducer hands the form given to 'load' and 'reset' back as itself: that identity is what the page tells “opened whole” by.
    const opened = decodeStiffness(encodeStiffness(tpl('frame-portal')))!;
    expect(reduceStiffness(base, { type: 'load', form: opened })).toBe(opened);
    expect(reduceStiffness(base, { type: 'reset', form: opened })).toBe(opened);
    expect(formToSolve({ form: opened, behind: base, whole: opened, onPaper: false, choices })).toBe(opened);
  });
  it('restartsRows and keepsMarks say which edits renumber the rows and which keep what is marked', () => {
    for (const type of ['template', 'reset', 'load', 'clear']) expect(restartsRows(type), type).toBe(true);
    for (const type of ['patch', 'add', 'remove', 'mode', 'units', 'section', 'material']) expect(restartsRows(type), type).toBe(false);
    for (const type of ['patch', 'section', 'material']) expect(keepsMarks(type), type).toBe(true);
    for (const type of ['add', 'remove', 'template', 'load', 'reset', 'units', 'mode', 'clear']) expect(keepsMarks(type), type).toBe(false);
  });
  it('a row added with the keyboard is handed the focus, and only if one was added', () => {
    const made: string[] = [];
    const row = (name: string) => ({ querySelector: () => ({ focus: () => made.push(name) }) });
    const fieldset = (n: number) => ({ querySelectorAll: () => Array.from({ length: n }, (_, k) => row(`row${k}`)) });
    expect(focusAddedRow(fieldset(3), 2)).toBe(true);
    expect(made).toEqual(['row2']);
    expect(focusAddedRow(fieldset(2), 2)).toBe(false);
    expect(focusAddedRow(null, 0)).toBe(false);
    expect(made).toEqual(['row2']);
  });
  it('opens a structure from the address in the order that matters: the field is left first, then loaded, remembered, the group reset', () => {
    const order: string[] = [];
    openWhole('found', { blur: () => order.push('blur'), load: (f) => order.push(`load ${f}`), remember: (f) => order.push(`remember ${f}`), template: (f) => order.push(`template ${f}`) });
    expect(order).toEqual(['blur', 'load found', 'remember found', 'template found']);
  });
  it('leaves the structure that goes one step behind in the history, unless it is the example or the same', () => {
    const io = () => {
      const calls: string[] = [];
      return { calls, take: (c: string) => calls.push(`take ${c.slice(0, 3)}`), push: () => calls.push('push') };
    };
    const a = io();
    expect(leaveBehind(base, tpl('frame-portal'), EXAMPLE, a)).toBe(false);
    expect(a.calls).toEqual([]);
    const b = io();
    expect(leaveBehind(tpl('frame-portal'), base, EXAMPLE, b)).toBe(true);
    expect(b.calls).toHaveLength(2);
    expect(b.calls[1]).toBe('push');
    const c = io();
    expect(leaveBehind(tpl('frame-portal'), tpl('frame-portal'), EXAMPLE, c)).toBe(false);
  });
});

describe('what the last edit has to tell', () => {
  const w = stiffnessUi.en;
  it('says the node or member that went, what went with it, and what was renumbered', () => {
    const removed = reduceStiffness(tpl('truss-five-member'), { type: 'remove', list: 'nodes', id: tpl('truss-five-member').nodes[1].id });
    const n = noticeText(removed.notice, w)!;
    expect(n.where).toBe('nodes');
    expect(n.text).toContain('Node 2 deleted.');
    expect(n.text).toContain('members 1, 3 and 5');
    expect(n.text).toContain('The nodes after it have moved up one place.');
    const m = reduceStiffness(frameOf(base), { type: 'remove', list: 'members', id: base.members[0].id });
    expect(noticeText(m.notice, w)).toEqual({ where: 'members', text: 'Member 1 deleted. The members after it have moved up one place.' });
    const last = reduceStiffness(base, { type: 'remove', list: 'members', id: base.members[1].id });
    expect(noticeText(last.notice, w)!.text).toBe('Member 2 deleted.');
  });
  it('says why an add had nothing to add, and says it for every reason, in both languages, and the limit of every list', () => {
    for (const lang of LANGS) {
      for (const why of NOTHING_TO_ADD_WHY) {
        const n = noticeText({ code: 'nothing-to-add', list: 'members', why }, stiffnessUi[lang]);
        expect(n?.text.length, `${lang} ${why}`).toBeGreaterThan(20);
        expect(n?.text, `${lang} ${why}`).not.toMatch(noise);
      }
      for (const list of Object.keys(LIMITS) as StiffnessList[]) expect(noticeText({ code: 'limit', list, max: LIMITS[list] }, stiffnessUi[lang])?.text, `${lang} ${list}`).toContain(String(LIMITS[list]));
    }
    expect(noticeText({ code: 'limit', list: 'nodes', max: 12 }, w)?.text).toBe('This tool holds 12 nodes at most.');
    expect(noticeText({ code: 'template', template: 'frame-l' }, w)).toBeNull();
    expect(noticeText(null, w)).toBeNull();
  });
  it('a refused add leaves the form as it was but for the notice, and picks free valid values for the second add', () => {
    let f = tpl('truss-two-bar');
    f = reduceStiffness(f, { type: 'add', list: 'members' });
    f = reduceStiffness(f, { type: 'add', list: 'members' });
    expect(f.notice).toMatchObject({ code: 'nothing-to-add', list: 'members', why: 'pairs' });
    expect(f.members).toHaveLength(3);
    const g = reduceStiffness(frameOf(base), { type: 'add', list: 'memberLoads', seed: { kind: 'point' } });
    const h2 = reduceStiffness(g, { type: 'add', list: 'memberLoads', seed: { kind: 'point', member: g.memberLoads[0].member } });
    expect(h2.memberLoads[1].a).not.toBe(h2.memberLoads[0].a);
    expect(analyseSafely(h2).issues).toEqual([]);
  });
});

describe('the address', () => {
  it('reads what is after #m=, whole, percent-encoded or not; and says which fragments are not its own', () => {
    expect(caseIn('#main')).toBeUndefined();
    expect(caseIn('')).toBeUndefined();
    expect(caseIn('#t=abc')).toBeUndefined();
    expect(caseIn('#f=abc')).toBeUndefined();
    const code = encodeStiffness(tpl('frame-portal'));
    expect(encodeStiffness(caseIn(`#m=${code}`)!)).toBe(code);
    expect(encodeStiffness(caseIn(`#m=${encodeURIComponent(code)}`)!)).toBe(code);
    expect(caseIn('#m=')).toBeNull();
    expect(caseIn('#m=garbage')).toBeNull();
    expect(caseIn(`#m=${code.slice(0, -1)}`)).toBeNull();
    expect(caseIn(`#m=%E0%A4%A`)).toBeNull();
    expect(caseIn(`#m=${'9'.repeat(20000)}`)).toBeNull();
  });
  it('the example is the bare address: its code is the default structure’s, and round-trips to it', () => {
    expect(EXAMPLE).toBe(encodeStiffness(defaultStiffness()));
    expect(encodeStiffness(caseIn(`#m=${EXAMPLE}`)!)).toBe(EXAMPLE);
  });
  it('any structure of any template, in either units, comes back from its own address as itself', () => {
    for (const id of TEMPLATE_IDS) {
      for (const units of ['us', 'si'] as const) {
        const f = tpl(id, units);
        const back = caseIn(`#m=${encodeStiffness(f)}`)!;
        expect(encodeStiffness(back), `${id} ${units}`).toBe(encodeStiffness(f));
        // The page itself is the same for the two (rendering is the slow part, so three of the problems stand for all).
        if (units === 'si' && ['truss-two-bar', 'frame-l', 'frame-fixed-point'].includes(id)) expect(text(show('en', back)), `${id} ${units}`).toBe(text(show('en', f)));
      }
    }
  });
  it('the Spanish page and the English page carry the same case', () => {
    const f = tpl('frame-l');
    expect(encodeStiffness(caseIn(`#m=${encodeStiffness(f)}`)!)).toBe(encodeStiffness(f));
  });
});

describe('where things are in the page, for a reader who does not see it laid out', () => {
  const html = show('en');

  it('puts the drawing and the sentence that reads it in the part that stays in view, after the notices, the status, the headline numbers and the switches, which scroll away', () => {
    const at = (needle: string) => html.indexOf(needle);
    expect(html).toMatch(/<section class="mp-app__out mp-st__out" aria-label="Results"/);
    expect(html).not.toContain('mp-app__out--tall');
    expect(at('mp-app__issues')).toBeLessThan(at('mp-st__status'));
    expect(at('mp-st__status')).toBeLessThan(at('mp-st__largest'));
    expect(at('mp-st__largest')).toBeLessThan(at('mp-st__options'));
    expect(at('mp-st__options')).toBeLessThan(at('class="mp-st__pin"'));
    expect(at('class="mp-st__pin"')).toBeLessThan(at('mp-st__reading'));
    // The pin holds the whole drawing and its sentence, and nothing of what scrolls.
    const pin = html.match(/<div class="mp-st__pin">([\s\S]*?)<\/section>/)![1];
    expect(pin).toContain('mp-st-fig');
    expect(pin).toContain('mp-st__reading');
    expect(pin).not.toContain('mp-st__status');
    expect(pin).not.toContain('mp-st__options');
  });

  it('gives the form a place a link can lead back to, and ends the page’s calculator with the way back: to the form and to the drawing, both reachable', () => {
    const form = html.match(/<form class="mp-app__form mp-st__target" id="([^"]+)" tabindex="-1"/)!;
    expect(form).not.toBeNull();
    const back = html.match(/<nav class="mp-st__back mp-st__target" id="([^"]+)" tabindex="-1" aria-label="On this page">([\s\S]*?)<\/nav>/)!;
    const links = [...back[2].matchAll(/<a href="#([^"]+)">([^<]*)<\/a>/g)];
    expect(links.map((l) => l[2])).toEqual(['Back to the form', 'Jump to the drawing']);
    expect(links[0][1]).toBe(form[1]);
    for (const [, id] of links) expect(html, id).toMatch(new RegExp(`id="${id.replace(/:/g, '\\:')}"[^>]*tabindex="-1"|tabindex="-1"[^>]*id="${id.replace(/:/g, '\\:')}"`));
    // The way back comes after the whole of the worked solution, and the skip link before it leads to it.
    expect(html.indexOf('mp-st__back')).toBeGreaterThan(html.lastIndexOf('mp-st__card'));
    expect(html).toContain(`<a class="mp-st__skip" href="#${back[1]}">Skip the worked solution</a>`);
  });

  it('is not a landmark for every card: one section for the answer, one for the solution, none for a card, no aside', () => {
    const sections = html.match(/<section\b/g) ?? [];
    expect(sections.length).toBe(2);
    expect(html).not.toContain('<aside');
  });

  it('keeps the hand answer panel out of the printed sheet’s way: its group carries the class the sheet hides', () => {
    expect(html).toContain('<fieldset class="mp-app__group mp-st__template">');
  });
});
