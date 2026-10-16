import { readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { createElement as h } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { afterEach, describe, expect, it, vi } from 'vitest';

// Heavy by design (thousands of generated cases, whole-tool renders): a loaded machine runs a full suite past the 5 s default.
vi.setConfig({ testTimeout: 120_000 });
import { formatNumber } from '@/lib/calc/format';
import { spanPage } from '@/lib/calc/beam/span-page-strings';
import { spanUi } from '@/lib/calc/beam/span-strings';
import { beamStrings } from '@/lib/calc/beam/strings';
import { continuousPage } from '@/lib/calc/continuous/page-strings';
import { continuousUi } from '@/lib/calc/continuous/strings';
import { shaftPage } from '@/lib/calc/shaft/page-strings';
import { shaftUi } from '@/lib/calc/shaft/strings';
import { analyseSafely } from '@/lib/calc/truss/analysis';
import { MAX_NODES, TRUSS_KEY, convertTruss, decodeTruss, defaultTruss, emptyTruss, encodeTruss, reduceTruss, type MemberRow, type NodeRow, type TrussForm } from '@/lib/calc/truss/model';
import { sharedWords, trussUi } from '@/lib/calc/truss/strings';
import { TEMPLATE_IDS, type TemplateId } from '@/lib/calc/truss/templates';
import { calculatorFamilies } from '@/lib/ttc/calculators';
import type { Lang } from '@/lib/ttc/i18n';
import { TrussCalculator } from './TrussCalculator';
import { issueSentence, sortMembers } from './text';

// A turn of the event loop between two tests: every test here solves a truss or several, and never waits.
afterEach(() => new Promise<void>((done) => setTimeout(done, 0)));

/**
 * THE TRUSS CALCULATOR — the tool of /resources/truss, as the server sends it:
 * what a visitor sees before the script arrives, or without it.
 *
 * The arithmetic is held where it is done (lib/calc/truss: engine, model,
 * templates and analysis tests, 210 of them). This is the component: its four
 * tables and its template group, its results cell by cell, every state of the
 * truss (each template, each problem, an empty case, a full-size one), its two
 * languages, and the shell's rules as they stand in its source.
 *
 * What only a browser can show — typing, the order of the member table, the
 * member marked from the table and from the drawing, the address after the #, a
 * row added or removed with the keyboard, the phone's layout, the printed sheet
 * — is listed in the report that goes with this file.
 */

const LANGS: Lang[] = ['en', 'es'];
const SRC = resolve(__dirname, '..', '..', '..', '..');

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
    .replace(/ ,/g, ',')
    .trim();
const attr = (tag: string, name: string) => tag.match(new RegExp(` ${name}="([^"]*)"`))?.[1];

const show = (lang: Lang, initial?: TrussForm) => renderToStaticMarkup(h(TrussCalculator, { t: sharedWords(beamStrings[lang].ui), w: trussUi[lang], initial }));

/* The cards of numbers, read as a visitor reads them and found by their title. A cell carries its column's head a second time, for a phone, out of sight and silent: taken out before it is read. */
const HEAD = /<span class="mp-truss__head" aria-hidden="true">(?:[^<]|<span class="mp-plot__unit">[^<]*<\/span>)*<\/span>/g;
const cardsOf = (html: string) => {
  const cards = html.split(/<div class="mp-app__card(?: mp-app__card--wide)?">/).slice(1);
  const title = (c: string) => text(c.match(/<h3\b[^>]*>([\s\S]*?)<\/h3>/)?.[1] ?? '');
  return { titles: cards.map(title), of: (name: string) => cards.find((c) => title(c) === name) ?? '' };
};
const cells = (row: string) => [...row.matchAll(/<t[hd]\b[^>]*>([\s\S]*?)<\/t[hd]>/g)].map((c) => text(c[1].replace(HEAD, '')));
const headOf = (card: string) => cells(card.match(/<thead\b[^>]*>([\s\S]*?)<\/thead>/)?.[1] ?? '');
const bodyOf = (card: string) => [...(card.match(/<tbody\b[^>]*>([\s\S]*?)<\/tbody>/)?.[1] ?? '').matchAll(/<tr\b[^>]*>([\s\S]*?)<\/tr>/g)].map((r) => r[1]);
const rowsOf = (card: string) => bodyOf(card).map(cells);
const pairsOf = (card: string) => [...card.matchAll(/<dt>([\s\S]*?)<\/dt><dd>([\s\S]*?)<\/dd>/g)].map((m) => [text(m[1]), text(m[2])]);
const issueList = (html: string) => [...(html.match(/<div class="mp-app__issues"[^>]*>([\s\S]*?)<\/div>/)?.[1] ?? '').matchAll(/<li[^>]*>([\s\S]*?)<\/li>/g)].map((m) => text(m[1]));
const issuesTitle = (html: string) => text(html.match(/<p class="mp-app__issues-title">([\s\S]*?)<\/p>/)?.[1] ?? '');
const groupsOf = (html: string) => [...html.matchAll(/<fieldset class="mp-app__group[^"]*"><legend>([\s\S]*?)<\/legend>([\s\S]*?)<\/fieldset>/g)].map((m) => ({ legend: text(m[1]), html: m[2] }));
const itemsOf = (part: string) => [...part.matchAll(/<div class="mp-app__item mp-truss__item" role="group" aria-label="([^"]*)"( data-invalid="true")?>/g)].map((m) => ({ name: m[1], invalid: Boolean(m[2]) }));
/** The fields of a piece of the form: label, value shown, unit, and what it is marked with. */
const fieldsOf = (part: string) =>
  [...part.matchAll(/<label class="mp-num[^"]*"([^>]*)>([\s\S]*?)<\/label>/g)]
    .filter((m) => /<input\b/.test(m[2]))
    .map((m) => {
      const input = m[2].match(/<input\b[^>]*>/)?.[0] ?? '';
      return {
        label: text(m[2].match(/<span class="mp-num__label">([\s\S]*?)<\/span><span class="mp-num__box">/)?.[1] ?? ''),
        value: attr(input, 'value') ?? '',
        unit: text(m[2].match(/<span class="mp-num__unit">([\s\S]*?)<\/span>/)?.[1] ?? ''),
        invalid: attr(input, 'aria-invalid') === 'true',
        describedBy: attr(input, 'aria-describedby'),
      };
    });
const selectsOf = (part: string) =>
  [...part.matchAll(/<label class="mp-num mp-num--select[^"]*"[^>]*>([\s\S]*?)<\/label>/g)].map((m) => ({
    label: text(m[1].match(/<span class="mp-num__label">([\s\S]*?)<\/span>/)?.[1] ?? ''),
    heard: attr(m[1].match(/<select\b[^>]*>/)?.[0] ?? '', 'aria-label'),
    invalid: attr(m[1].match(/<select\b[^>]*>/)?.[0] ?? '', 'aria-invalid') === 'true',
    chosen: text(m[1].match(/<option[^>]* selected=""[^>]*>([\s\S]*?)<\/option>/)?.[1] ?? ''),
    options: [...m[1].matchAll(/<option[^>]*>([\s\S]*?)<\/option>/g)].map((o) => text(o[1])),
  }));
const lineOf = (html: string, id: string | undefined) => text(html.match(new RegExp(`<p class="mp-app__row-error" id="${id}">([\\s\\S]*?)</p>`))?.[1] ?? '');
const noise = /NaN|undefined|Infinity|\[object|(?:^|[\s>(=])-0(?![.\d])|−0(?![.\d])|\be[+-]\d/;

/* ── trusses to render ─────────────────────────────────────────────────── */

const base = defaultTruss();
const template = (id: TemplateId, units: 'us' | 'si' = 'us') => reduceTruss(reduceTruss(defaultTruss(), { type: 'units', units }), { type: 'template', template: id });
const nodeIds = base.nodes.map((n) => n.id);
const withMember = (f: TrussForm, k: number, patch: Partial<MemberRow>): TrussForm => ({ ...f, members: f.members.map((m, i) => (i === k ? { ...m, ...patch } : m)) });
const withNode = (f: TrussForm, k: number, patch: Partial<NodeRow>): TrussForm => ({ ...f, nodes: f.nodes.map((n, i) => (i === k ? { ...n, ...patch } : n)) });

/** The nodes, members, supports and loads that make up the example, kept apart: a problem is the example with one thing changed. */
const withoutMember = (f: TrussForm, label: number): TrussForm => ({ ...f, members: f.members.filter((_, i) => i !== label - 1) });

/** Every problem, one truss that has it, and the sentence it must be given in English. */
const PROBLEMS: { code: string; form: () => TrussForm; en: RegExp; row?: { list: 'node' | 'member' | 'support' | 'load' | 'model'; name?: string } }[] = [
  { code: 'few-nodes', form: () => reduceTruss(emptyTruss(), { type: 'add', list: 'nodes' }), en: /^A truss needs at least two nodes, and this one has 1\.$/ },
  {
    code: 'no-members',
    form: () => reduceTruss(reduceTruss(emptyTruss(), { type: 'add', list: 'nodes' }), { type: 'add', list: 'nodes' }),
    en: /^The truss has no member\. Add members between the nodes\.$/,
  },
  {
    code: 'too-big',
    form: () => ({ ...base, nodes: Array.from({ length: MAX_NODES + 1 }, (_, k) => ({ id: k + 1, x: k, y: 0 })), members: [], supports: [], loads: [], nextId: 100 }),
    en: /^A truss holds 40 nodes at most, and this one has 41\.$/,
  },
  { code: 'number', form: () => withNode(base, 1, { x: Number.NaN }), en: /^Node 2: The x coordinate needs a number the calculation can use\.$/, row: { list: 'node', name: 'Node 2' } },
  { code: 'section', form: () => ({ ...base, E: -5 }), en: /^Section and material: The modulus of elasticity \(E\) must be a number above zero\.$/, row: { list: 'model' } },
  { code: 'section', form: () => withMember(base, 2, { A: 0 }), en: /^Member 3: The area \(A\) must be a number above zero\.$/, row: { list: 'member', name: 'Member 3' } },
  { code: 'member-node', form: () => withMember(base, 0, { j: 999 }), en: /^Member 1: This member joins a node that is not in the list\. Choose both of its nodes\.$/, row: { list: 'member', name: 'Member 1' } },
  { code: 'zero-length', form: () => withMember(base, 0, { j: nodeIds[0] }), en: /^Member 1: This member goes from a node to itself\. Choose two different nodes\.$/, row: { list: 'member', name: 'Member 1' } },
  { code: 'duplicate-node', form: () => withNode(base, 1, { x: 0, y: 0 }), en: /^Nodes 1 and 2 are at the same place\. Move one of them, or remove it\.$/ },
  {
    code: 'short-member',
    form: () => withNode(base, 1, { x: 3.2e-6 }),
    en: /^Member 1: This member is under a millionth of the truss in length, too short for a sound solution\. Move a node, or remove the member\.$/,
    row: { list: 'member', name: 'Member 1' },
  },
  {
    code: 'duplicate-member',
    form: () => ({ ...base, members: [...base.members, { id: 500, i: nodeIds[0], j: nodeIds[1], A: null, E: null }], nextId: 501 }),
    en: /^Member 18: Members 1 and 18 join the same two nodes\. Remove one of them\.$/,
    row: { list: 'member', name: 'Member 18' },
  },
  { code: 'node-unconnected', form: () => reduceTruss(base, { type: 'add', list: 'nodes' }), en: /^Node 11 has no member\. Join it to the truss, or remove it\.$/ },
  {
    code: 'disconnected',
    form: () => ({
      ...base,
      nodes: [...base.nodes, { id: 301, x: 50, y: 0 }, { id: 302, x: 58, y: 0 }, { id: 303, x: 54, y: 6 }],
      members: [...base.members, { id: 311, i: 301, j: 302, A: null, E: null }, { id: 312, i: 302, j: 303, A: null, E: null }, { id: 313, i: 303, j: 301, A: null, E: null }],
      nextId: 400,
    }),
    en: /^The members form separate pieces: nodes 1–10; nodes 11–13\. Join them with a member, or remove the piece that is not part of the truss\.$/,
  },
  { code: 'support-node', form: () => ({ ...base, supports: [...base.supports, { id: 600, node: 999, kind: 'pin', angle: 90 }], nextId: 601 }), en: /^Support 3: This support is on a node that is not in the list\. Choose its node\.$/, row: { list: 'support', name: 'Support 3' } },
  {
    code: 'duplicate-support',
    form: () => ({ ...base, supports: [...base.supports, { id: 600, node: nodeIds[0], kind: 'roller', angle: 90 }], nextId: 601 }),
    en: /^Support 3: Node 1 already has a support\. A node holds one: a pin or a roller\.$/,
    row: { list: 'support', name: 'Support 3' },
  },
  { code: 'load-node', form: () => ({ ...base, loads: [...base.loads, { id: 700, node: 999, fx: 0, fy: -1 }], nextId: 701 }), en: /^Load 6: This load is on a node that is not in the list\. Choose its node\.$/, row: { list: 'load', name: 'Load 6' } },
  { code: 'few-supports', form: () => ({ ...base, supports: base.supports.slice(1) }), en: /^The supports give 1 reaction component, and a truss needs at least 3 to stand \(a pin gives 2, a roller 1\)\. Add a support\.$/ },
  { code: 'mechanism', form: () => withoutMember(base, 14), en: /^The truss is a mechanism: nodes? [\d, –and]+ can move with no member changing length\. Add a member or a support\.$/ },
  {
    code: 'unrestrained',
    form: () => {
      const t = template('triangle');
      return { ...t, supports: t.supports.map((s) => (s.kind === 'roller' ? { ...s, angle: 0 } : s)) };
    },
    en: /^The supports do not hold the truss as a whole: it can move as a rigid body in 1 way, because their lines of action are all parallel or meet at one point\. Change the type, the angle or the place of a support\.$/,
  },
];

describe('the example, as the server sends it', () => {
  const html = show('en');

  it('is the 4-panel Pratt truss, solved: determinate, with its two largest forces', () => {
    expect(text(html.match(/<div class="mp-truss__status[\s\S]*?<\/div>/)![0])).toBe('Statically determinate m + r − 2j = 17 + 3 − 2 × 10 = 0 The forces follow from equilibrium alone. m members, r reaction components (a pin 2, a roller 1), j nodes.');
    expect(pairsOf(html.match(/<dl class="mp-app__dl mp-truss__largest-forces">[\s\S]*?<\/dl>/)![0])).toEqual([
      ['Largest tension', 'Member 14, +21.21 kip'],
      ['Largest compression', 'Member 6, −20 kip'],
    ]);
    expect(issueList(html)).toEqual([]);
    expect(html).not.toContain('mp-truss__warnings');
  });

  it('opens bare: the example is the address of no case', () => {
    expect(encodeTruss(base)).toMatch(/^[^;]+;1;us;s,29000,4;/);
    expect(TRUSS_KEY).toBe('t');
    expect(decodeTruss(encodeTruss(base))).toEqual(base);
  });

  it('lists the reactions with their parts, size, and the roller’s along its line', () => {
    const card = cardsOf(html).of('Reactions');
    expect(headOf(card)).toEqual(['Support', 'Node', 'Type', 'x component (kip)', 'y component (kip)', 'Size (kip)', 'Along the roller’s line (kip)']);
    expect(rowsOf(card)).toEqual([
      ['1', '1', 'Pin', '0', '20 upward', '20', '—'],
      ['2', '5', 'Roller, 90°', '0', '20 upward', '20', '+20'],
    ]);
  });

  it('gives the force in every member, read against the joints worked by hand', () => {
    const card = cardsOf(html).of('Member forces');
    expect(headOf(card)).toEqual(['Member', 'Nodes', 'Length (ft)', 'Force (kip)', 'State', 'Stress, N ÷ A (ksi)', 'Elongation (in)']);
    const rows = rowsOf(card);
    expect(rows).toHaveLength(17);
    // bottom chord, top chord, verticals, diagonals — tension positive
    expect(rows.map((r) => r[3])).toEqual(['0', '+15', '+15', '0', '−15', '−20', '−20', '−15', '−20', '−15', '−10', '−15', '−20', '+21.21', '+7.071', '+7.071', '+21.21']);
    expect(rows.map((r) => r[4].replace(/ · .*/, ''))).toEqual([
      'Zero', 'Tension', 'Tension', 'Zero', 'Compression', 'Compression', 'Compression', 'Compression', 'Compression', 'Compression', 'Compression', 'Compression', 'Compression', 'Tension', 'Tension', 'Tension', 'Tension',
    ]);
    // Member 2: 15 kip over 4 in²: 3.75 ksi; 15 × 96 in ÷ (29,000 × 4) = 0.012414 in.
    expect(rows[1]).toEqual(['2', '2 – 3', '8', '+15', 'Tension', '+3.75', '+0.01241']);
    // Member 14, the first diagonal, is 8√2 ft long, from the top of the end post (node 6) down to node 2.
    expect(rows[13].slice(0, 3)).toEqual(['14', '6 – 2', '11.31']);
    expect(rows[3]).toEqual(['4', '4 – 5', '8', '0', 'Zero', '0', '0']);
    expect(rows.every((r) => !noise.test(r.join(' ')))).toBe(true);
  });

  it('marks a largest tension and a largest compression in the member table, and says what the signs are', () => {
    const card = cardsOf(html).of('Member forces');
    expect(text(card)).toContain('Compression · largest compression');
    expect(text(card)).toContain('Tension · largest tension');
    expect(card.match(/largest tension/g)).toHaveLength(1);
    expect(card.match(/largest compression/g)).toHaveLength(1);
    expect(text(card)).toContain('Tension is positive (+): the member pulls on its nodes. Compression is negative (−): it pushes on them.');
    expect(text(card)).toContain('It is not a check of the member: no capacity, no buckling, no factors.');
  });

  it('gives every member a button that marks it, tied to its table row', () => {
    const buttons = [...html.matchAll(/<button type="button" class="mp-truss__pick" aria-pressed="false" aria-label="Member (\d+)" title="Mark this member on the drawing">(\d+)<\/button>/g)];
    // 17 in the member table, and the 2 members with no force in the list of those.
    expect(buttons).toHaveLength(17 + 2);
    for (const b of buttons) expect(b[1]).toBe(b[2]);
  });

  it('lists the displacements of the ten nodes, to the right and upward', () => {
    const card = cardsOf(html).of('Node displacements');
    expect(headOf(card)).toEqual(['Node', 'x displacement (in)', 'y displacement (in)', 'Total (in)']);
    const rows = rowsOf(card);
    expect(rows).toHaveLength(10);
    // The pin does not move; the roller moves right by the stretch of the bottom chord: 2 × 0.012414 in.
    expect(rows[0]).toEqual(['1', '0', '0', '0']);
    expect(rows[4][1]).toBe('+0.02483');
    expect(rows[4][2]).toBe('0');
  });

  it('checks the equilibrium, in its own words, with the point the moments are about', () => {
    const card = cardsOf(html).of('Equilibrium check');
    expect(pairsOf(card)).toEqual([
      ['Loads added up', 'Fx 0 · Fy −40 kip'],
      ['Σ Fx, loads and reactions', '0 kip'],
      ['Σ Fy, loads and reactions', '0 kip'],
      ['Σ M about x = 16, y = 4', '0 kip·ft'],
      ['Largest force left over at a node', '0 kip'],
    ]);
    expect(text(card)).toContain('Balanced: the loads and the reactions are in equilibrium, and so is every node.');
  });

  it('lists the two members that carry nothing, with the reason', () => {
    const card = cardsOf(html).of('Members with no force');
    expect(card.match(/<li\b/g)).toHaveLength(2);
    expect(text(card)).toContain('1 (1 – 2) Carries no force under this load.');
    expect(text(card)).toContain('4 (4 – 5) Carries no force under this load.');
  });

  it('describes the drawing in a sentence a screen reader can use', () => {
    const label = attr(html.match(/<svg class="mp-plot__svg mp-truss-fig__svg"[^>]*>/)![0], 'aria-label')!;
    expect(label).toBe('Truss: 10 nodes, 17 members, 2 supports, 5 loads. Largest tension: Member 14, +21.21 kip. Largest compression: Member 6, −20 kip. Reactions: Node 1: 20 kip; Node 5: 20 kip.');
  });

  it('has a heading over the answer, over the numbers a head to each, and the privacy line', () => {
    expect(html).toContain('<section class="mp-app__out" aria-label="Results"');
    expect(cardsOf(html).titles).toEqual(['Reactions', 'Member forces', 'Node displacements', 'Equilibrium check', 'Members with no force']);
    expect(html).toContain(beamStrings.en.ui.results.privacy);
    expect(html.match(/<th scope="col" role="columnheader">/g)!.length).toBeGreaterThanOrEqual(7 + 7 + 4);
  });

  it('prints nothing noisy: no minus zero, no NaN, no e-notation, no placeholder', () => {
    for (const lang of LANGS) {
      const t = text(show(lang));
      expect(t).not.toMatch(noise);
      expect(t).not.toMatch(/\{[a-z|]+\}/i);
    }
  });
});

describe('the form', () => {
  const html = show('en');
  const groups = groupsOf(html);

  it('has a group for the template, the four tables and the section, in that order', () => {
    expect(groups.map((g) => g.legend)).toEqual(['Start from a template', 'Nodes', 'Members', 'Supports', 'Loads', 'Section and material']);
  });

  it('lists the nodes, each with x and y in feet, and a way to remove it', () => {
    const nodes = groups[1].html;
    expect(itemsOf(nodes).map((i) => i.name)).toEqual(Array.from({ length: 10 }, (_, k) => `Node ${k + 1}`));
    const fields = fieldsOf(nodes);
    expect(fields).toHaveLength(20);
    expect(fields.slice(0, 4)).toMatchObject([
      { label: 'x', value: '0', unit: 'ft' },
      { label: 'y', value: '0', unit: 'ft' },
      { label: 'x', value: '8', unit: 'ft' },
      { label: 'y', value: '0', unit: 'ft' },
    ]);
    expect(nodes.match(/class="mp-app__remove" aria-label="Remove: Node \d+"/g)).toHaveLength(10);
    expect(nodes).toContain('Add a node');
  });

  it('shows a member’s two nodes by their labels, and its own area and modulus empty (the section’s are used)', () => {
    const members = groups[2].html;
    expect(itemsOf(members)).toHaveLength(17);
    const selects = selectsOf(members);
    expect(selects).toHaveLength(34);
    expect(selects.slice(0, 2)).toMatchObject([
      { label: 'From node', heard: 'From node, Member 1', chosen: '1' },
      { label: 'To node', heard: 'To node, Member 1', chosen: '2' },
    ]);
    // Member 14 is the first diagonal: from node 6 to node 2.
    expect(selects[26]).toMatchObject({ heard: 'From node, Member 14', chosen: '6' });
    expect(selects[27]).toMatchObject({ heard: 'To node, Member 14', chosen: '2' });
    expect(selects[0].options).toEqual(['1', '2', '3', '4', '5', '6', '7', '8', '9', '10']);
    const fields = fieldsOf(members);
    expect(fields.slice(0, 2)).toEqual([
      { label: 'Area, A (optional)', value: '', unit: 'in²', invalid: false, describedBy: undefined },
      { label: 'Modulus, E (optional)', value: '', unit: 'ksi', invalid: false, describedBy: undefined },
    ]);
  });

  it('lists the supports with their type, and a roller’s line of action only for a roller', () => {
    const supports = groups[3].html;
    expect(itemsOf(supports).map((i) => i.name)).toEqual(['Support 1', 'Support 2']);
    const selects = selectsOf(supports);
    expect(selects.map((s) => [s.heard, s.chosen])).toEqual([
      ['Node, Support 1', '1'],
      ['Type, Support 1', 'Pin'],
      ['Node, Support 2', '5'],
      ['Type, Support 2', 'Roller'],
    ]);
    expect(selects[1].options).toEqual(['Pin', 'Roller']);
    expect(fieldsOf(supports)).toMatchObject([{ label: 'Line of action', value: '90', unit: '°' }]);
    expect(text(supports)).toContain('90° is the usual roller on a horizontal surface, 0° one against a vertical wall.');
  });

  it('lists the loads by node with Fx and Fy, a weight being a negative Fy', () => {
    const loads = groups[4].html;
    expect(itemsOf(loads)).toHaveLength(5);
    const fields = fieldsOf(loads);
    expect(fields.slice(0, 2)).toMatchObject([
      { label: 'Fx', value: '0', unit: 'kip' },
      { label: 'Fy', value: '-5', unit: 'kip' },
    ]);
    expect(selectsOf(loads)[0]).toMatchObject({ heard: 'Node, Load 1', chosen: '6' });
    expect(text(loads)).toContain('a weight is a negative Fy');
  });

  it('puts the section in its own group, and says what it is for', () => {
    const section = groups[5].html;
    expect(selectsOf(section)[0]).toMatchObject({ label: 'Material', chosen: 'Steel', options: ['Steel', 'Aluminum', 'Other (enter E)'] });
    expect(fieldsOf(section).map((f) => [f.label, f.value, f.unit])).toEqual([
      ['Modulus of elasticity, E', '29000', 'ksi'],
      ['Area, A', '4', 'in²'],
    ]);
    expect(text(section)).toContain('E and A give the stresses, the elongations and the displacements, and they decide the forces of an indeterminate truss. For a determinate one the forces do not depend on them.');
  });

  it('has a template picker with the nine templates, its parameters in the unit shown, and an action', () => {
    const g = groups[0].html;
    const selects = selectsOf(g);
    expect(selects[0]).toMatchObject({ label: 'Template', chosen: 'Pratt', options: TEMPLATE_IDS.map((id) => trussUi.en.template.names[id]) });
    expect(selects[1]).toMatchObject({ label: 'Supports', chosen: 'Pin left, roller right', options: ['Pin left, roller right', 'Roller left, pin right', 'Pin at both ends (indeterminate)'] });
    expect(fieldsOf(g).map((f) => [f.label, f.value, f.unit])).toEqual([
      ['Span', '32', 'ft'],
      ['Depth', '8', 'ft'],
      ['Panels', '4', ''],
      ['Load per top joint', '10', 'kip'],
    ]);
    expect(text(g)).toContain('Load template');
    // A template is a way to start: it is not part of the sheet.
    expect(html).toContain('class="mp-app__group mp-truss__template"');
  });

  it('has the units, the three actions and the privacy line', () => {
    expect(html).toContain('<legend class="mp-num__label">Units</legend>');
    expect(text(html)).toContain('US (ft, kip)');
    expect(text(html)).toContain('SI (m, kN)');
    for (const label of ['Copy link to this truss', 'Print', 'Start over']) expect(text(html)).toContain(label);
  });

  it('puts a label on every field and a name on every list, and never an id on a row that is not tied', () => {
    for (const lang of LANGS) {
      const out = show(lang);
      const inputs = [...out.matchAll(/<label class="mp-num[^"]*"[^>]*>([\s\S]*?)<\/label>/g)];
      expect(inputs.length).toBeGreaterThan(80);
      for (const label of inputs) expect(text(label[1].match(/<span class="mp-num__label">([\s\S]*?)<\/span><span class="mp-num__box">/)?.[1] ?? '')).not.toBe('');
      for (const select of out.matchAll(/<select\b[^>]*>/g)) {
        const tag = select[0];
        // A list inside a row is named for its row; the others by the label they sit in.
        if (/aria-label=/.test(tag)) expect(attr(tag, 'aria-label')).toMatch(/, \S/);
      }
      expect(out).not.toMatch(/aria-describedby=""/);
    }
  });
});

describe('every template', () => {
  for (const id of TEMPLATE_IDS) {
    for (const units of ['us', 'si'] as const) {
      it(`${id} in ${units}: solved, determinate, a row for every member and node, nothing noisy`, () => {
        const form = template(id, units);
        const a = analyseSafely(form);
        expect(a.issues).toEqual([]);
        for (const lang of LANGS) {
          const html = show(lang, form);
          expect(text(html)).not.toMatch(noise);
          expect(text(html)).not.toMatch(/\{[a-z|]+\}/i);
          expect(issueList(html)).toEqual([]);
          const cards = cardsOf(html);
          const members = rowsOf(cards.of(trussUi[lang].results.forces.title));
          expect(members).toHaveLength(form.members.length);
          expect(rowsOf(cards.of(beamStrings[lang].ui.results.reactions))).toHaveLength(form.supports.length);
          expect(rowsOf(cards.of(trussUi[lang].results.displacements.title))).toHaveLength(form.nodes.length);
          expect(html).toContain(`mp-truss__status--${a.determinacy.word}`);
          expect(a.determinacy.word).toBe('determinate');
          expect(itemsOf(groupsOf(html)[1].html)).toHaveLength(form.nodes.length);
          // The drawing has one group for every member.
          expect(html.match(/ data-member="\d+"/g)).toHaveLength(form.members.length);
        }
      });
    }
  }

  it('the king post’s post carries nothing, and the sheet says why: three members at its node, two on a line', () => {
    const form = template('king-post');
    const a = analyseSafely(form);
    expect(a.results!.inspection).toEqual([{ member: 5, node: 2, rule: 'three-members' }]);
    expect(text(cardsOf(show('en', form)).of('Members with no force'))).toContain('5 (2 – 4) Zero by inspection: at node 2 three members meet, two of them along one line, and no load or support acts there, so the third carries no force.');
    expect(text(cardsOf(show('es', form)).of('Barras sin fuerza'))).toContain('5 (2 – 4) Nula por inspección: en el nudo 2 concurren tres barras, dos de ellas alineadas, y allí no actúa ninguna carga ni hay apoyo, así que la tercera no soporta fuerza.');
  });

  it('a truss with a joint of two members, not on a line, and nothing else says so in both languages', () => {
    // A Pratt with its right support and its right-hand load taken off node 5's neighbour leaves no joint of two; build one directly:
    // a triangle with a short strut hung from the apex to a node that has no load or support.
    const t = template('triangle');
    const strutNode: NodeRow = { id: 90, x: 12, y: 3 };
    const form: TrussForm = {
      ...t,
      nodes: [...t.nodes, strutNode],
      members: [...t.members, { id: 91, i: t.nodes[2].id, j: 90, A: null, E: null }, { id: 92, i: 90, j: t.nodes[0].id, A: null, E: null }],
      nextId: 93,
    };
    const a = analyseSafely(form);
    const two = a.results?.inspection.filter((z) => z.rule === 'two-members') ?? [];
    expect(two.map((z) => z.node)).toEqual([4, 4]);
    expect(text(cardsOf(show('en', form)).of('Members with no force'))).toContain('Zero by inspection: at node 4 only two members meet, not along one line, and no load or support acts there, so both carry no force.');
    expect(text(cardsOf(show('es', form)).of('Barras sin fuerza'))).toContain('Nula por inspección: en el nudo 4 concurren solo dos barras, no alineadas, y allí no actúa ninguna carga ni hay apoyo, así que ninguna de las dos soporta fuerza.');
  });

  it('a truss pinned at both ends is indeterminate, says so with its degree and why, and warns of unequal sections', () => {
    const two = reduceTruss(defaultTruss(), { type: 'template', template: 'pratt', params: { supports: 'two-pins' } });
    const a = analyseSafely(two);
    expect(a.determinacy).toMatchObject({ word: 'indeterminate', degree: 1, members: 17, reactions: 4, joints: 10 });
    const html = show('en', two);
    expect(text(html.match(/<div class="mp-truss__status[\s\S]*?<\/div>/)![0])).toContain('Statically indeterminate to degree 1 m + r − 2j = 17 + 4 − 2 × 10 = 1 Equilibrium alone does not give the forces: they depend on the stiffness, E·A, of the members.');
    // One member with a section of its own and the others without: the forces cannot be told.
    const partial = { ...two, A: null, E: null, members: two.members.map((m, k) => (k === 0 ? { ...m, A: 4, E: 29000 } : m)) };
    const out = show('en', partial);
    expect(a.warnings).toEqual([]);
    expect(analyseSafely(partial).warnings).toEqual([{ code: 'partial-stiffness' }]);
    expect(text(out.match(/<div class="mp-truss__warnings"[\s\S]*?<\/div>/)![0])).toBe(`To note ${trussUi.en.warnings['partial-stiffness']}`);
    expect(text(show('es', partial))).toContain(trussUi.es.warnings['partial-stiffness']);
  });
});

describe('without a section', () => {
  const noSection: TrussForm = { ...base, A: null };

  it('leaves out the stress and the elongation, and the displacements, and says why', () => {
    const html = show('en', noSection);
    const card = cardsOf(html).of('Member forces');
    expect(headOf(card)).toEqual(['Member', 'Nodes', 'Length (ft)', 'Force (kip)', 'State']);
    expect(cardsOf(html).titles).not.toContain('Node displacements');
    expect(text(card)).toContain('Not shown: displacements need an area and a modulus for every member.');
    expect(html).not.toContain('Deformed shape</span>');
    expect(rowsOf(card).map((r) => r[3])).toEqual(['0', '+15', '+15', '0', '−15', '−20', '−20', '−15', '−20', '−15', '−10', '−15', '−20', '+21.21', '+7.071', '+7.071', '+21.21']);
  });

  it('shows the stress of a member that has an area of its own, and dashes for the members that have none', () => {
    // The truss has a modulus and member 2 an area of its own: member 2 has a stress and an elongation, the others neither.
    const partial = withMember(noSection, 1, { A: 2 });
    const card = cardsOf(show('en', partial)).of('Member forces');
    expect(headOf(card)).toContain('Stress, N ÷ A (ksi)');
    expect(headOf(card)).toContain('Elongation (in)');
    expect(rowsOf(card)[1]).toEqual(['2', '2 – 3', '8', '+15', 'Tension', '+7.5', '+0.02483']);
    expect(rowsOf(card)[0]).toEqual(['1', '1 – 2', '8', '0', 'Zero', '—', '—']);
    // Without a modulus too, there is the stress and no elongation.
    const noModulus = cardsOf(show('en', { ...partial, E: null })).of('Member forces');
    expect(headOf(noModulus)).toContain('Stress, N ÷ A (ksi)');
    expect(headOf(noModulus)).not.toContain('Elongation (in)');
    expect(rowsOf(noModulus)[1]).toEqual(['2', '2 – 3', '8', '+15', 'Tension', '+7.5']);
  });

  it('offers the deformed shape only where there is one to offer', () => {
    expect(show('en')).toContain('<span>Deformed shape</span>');
    expect(show('en', noSection)).not.toContain('<span>Deformed shape</span>');
  });
});

describe('a load that is zero', () => {
  it('solves to zero everywhere and says there is no load', () => {
    const form = { ...base, loads: base.loads.map((l) => ({ ...l, fy: 0 })) };
    const html = show('en', form);
    expect(text(html.match(/<div class="mp-truss__warnings"[\s\S]*?<\/div>/)![0])).toBe(`To note ${trussUi.en.warnings['no-load']}`);
    const rows = rowsOf(cardsOf(html).of('Member forces'));
    expect(rows.every((r) => r[3] === '0' && r[4] === 'Zero')).toBe(true);
    expect(pairsOf(html.match(/<dl class="mp-app__dl mp-truss__largest-forces">[\s\S]*?<\/dl>/)![0])).toEqual([
      ['Largest tension', 'none'],
      ['Largest compression', 'none'],
    ]);
    expect(cardsOf(html).of('Members with no force').match(/<li\b/g)).toHaveLength(17);
    expect(text(html)).not.toMatch(noise);
  });
});

describe('every problem, on its row and in the box', () => {
  for (const problem of PROBLEMS) {
    it(`${problem.code}: ${problem.en.source.slice(1, 50)}…`, () => {
      const form = problem.form();
      const a = analyseSafely(form);
      expect(a.issues.map((i) => i.code), 'the analysis reports the code').toContain(problem.code);
      expect(a.results).toBeNull();
      const html = show('en', form);
      const box = issueList(html);
      expect(box.filter((line) => problem.en.test(line)), box.join(' | ')).toHaveLength(1);
      expect(issuesTitle(html)).toBe('This truss cannot be solved yet');
      // Nothing is solved: the numbers are not there, and the drawing says so.
      expect(cardsOf(html).titles).toEqual([]);
      expect(html).toContain(trussUi.en.results.waiting);
      expect(attr(html.match(/<svg class="mp-plot__svg mp-truss-fig__svg"[^>]*>/)![0], 'aria-label')).toMatch(/not|cannot|Todavía no|todavía/i);
      expect(text(html)).not.toMatch(noise);
      expect(text(html)).not.toMatch(/\{[a-z|]+\}/i);

      // The row at fault is marked, and its message is tied to its field.
      if (problem.row && problem.row.list !== 'model' && problem.row.name) {
        const group = groupsOf(html).find((g) => g.html.includes(`aria-label="${problem.row!.name}"`))!;
        expect(itemsOf(group.html).find((i) => i.name === problem.row!.name)!.invalid, `${problem.row.name} is marked`).toBe(true);
        const item = group.html.split('<div class="mp-app__item').find((p) => p.includes(`aria-label="${problem.row!.name}"`))!;
        const ids = [...item.matchAll(/aria-describedby="([^"]+)"/g)].map((m) => m[1]);
        const message = item.match(/<p class="mp-app__row-error" id="([^"]+)">/)?.[1];
        expect(message, 'the row has its message').toBeTruthy();
        expect(ids.length).toBeGreaterThan(0);
        expect(ids.every((id) => id === message)).toBe(true);
        expect(item).toMatch(/aria-invalid="true"/);
      }
      if (problem.row?.list === 'model') {
        const section = groupsOf(html).find((g) => g.legend === 'Section and material')!;
        const field = fieldsOf(section.html).find((f) => f.invalid)!;
        expect(field.label).toBe('Modulus of elasticity, E');
        expect(lineOf(section.html, field.describedBy)).toBe('The modulus of elasticity (E) must be a number above zero.');
      }

      // The Spanish page says the same, in Spanish: no hole left, no English word from the sentence.
      const es = show('es', form);
      const lines = issueList(es);
      expect(lines.length).toBeGreaterThan(0);
      for (const line of lines) {
        expect(line).not.toMatch(/[{}]/);
        expect(line).not.toMatch(/\b(the|and|truss|node|nodes|member|members|support|load|this)\b/);
      }
      expect(issuesTitle(es)).toBe('Esta cercha todavía no se puede resolver');
    });
  }

  it('flags two nodes at one place on both of their rows', () => {
    const html = show('en', PROBLEMS.find((p) => p.code === 'duplicate-node')!.form());
    const nodes = itemsOf(groupsOf(html)[1].html);
    expect(nodes.filter((n) => n.invalid).map((n) => n.name)).toEqual(['Node 1', 'Node 2']);
  });

  it('flags an unconnected node on its row, and rings it on the drawing', () => {
    const html = show('en', PROBLEMS.find((p) => p.code === 'node-unconnected')!.form());
    expect(itemsOf(groupsOf(html)[1].html).filter((n) => n.invalid).map((n) => n.name)).toEqual(['Node 11']);
    expect(html).toContain('mp-truss-fig__node--flagged');
    expect(html).toContain('Node with a problem');
  });

  it('names the nodes of a mechanism, rings them, and tells what to add', () => {
    const form = PROBLEMS.find((p) => p.code === 'mechanism')!.form();
    const a = analyseSafely(form);
    const movable = a.issues.find((i) => i.code === 'mechanism')!.nodes!;
    expect(movable.length).toBeGreaterThan(0);
    const html = show('en', form);
    expect(issueList(html)[0]).toContain(movable.length === 1 ? `node ${movable[0]} can move` : 'can move');
    expect(html.match(/mp-truss-fig__node--flagged/g)!.length).toBeGreaterThanOrEqual(movable.length);
    // The drawing still shows the truss, its loads and its supports, without forces.
    expect(html.match(/ data-member="\d+"/g)).toHaveLength(16);
    expect(html).toContain('Not solved: members are drawn without forces');
    // And the count of the determinacy line is there: the truss is unstable by it.
    expect(html).toContain('mp-truss__status--unstable');
    expect(text(html.match(/<div class="mp-truss__status[\s\S]*?<\/div>/)![0])).toContain('Unstable m + r − 2j = 16 + 3 − 2 × 10 = −1');
  });

  it('says every problem once, even when two rows have it', () => {
    const form = { ...base, nodes: base.nodes.map((n, k) => (k === 1 || k === 2 ? { ...n, x: Number.NaN } : n)) };
    const box = issueList(show('en', form));
    expect(box).toEqual(['Node 2: The x coordinate needs a number the calculation can use.', 'Node 3: The x coordinate needs a number the calculation can use.']);
  });
});

describe('every code has a sentence, with its numbers', () => {
  const at = (code: string, over: object = {}) => ({ code, ...over }) as Parameters<typeof issueSentence>[0];
  const cases: [string, object, Record<Lang, RegExp>][] = [
    ['few-nodes', { count: 1 }, { en: /has 1\.$/, es: /tiene 1\.$/ }],
    ['no-members', {}, { en: /no member/, es: /ninguna barra/ }],
    ['too-big', { list: 'members', max: 120, count: 130 }, { en: /120 members at most.*130/, es: /120 barras como máximo.*130/ }],
    ['number', { row: { list: 'loads', id: 1, field: 'fy' }, at: 2 }, { en: /Fy needs a number/, es: /La Fy necesita un número/ }],
    ['section', { row: { list: 'model', field: 'A' } }, { en: /area \(A\) must/, es: /área \(A\) debe/ }],
    ['member-node', {}, { en: /not in the list/, es: /no está en la lista/ }],
    ['zero-length', {}, { en: /to itself/, es: /a sí mismo/ }],
    ['duplicate-node', { nodes: [3, 7] }, { en: /Nodes 3 and 7/, es: /nudos 3 y 7/ }],
    ['short-member', {}, { en: /millionth/, es: /millonésima/ }],
    ['duplicate-member', { members: [4, 9] }, { en: /Members 4 and 9/, es: /barras 4 y 9/ }],
    ['node-unconnected', { nodes: [12] }, { en: /Node 12/, es: /nudo 12/ }],
    ['disconnected', { groups: [[1, 2, 3, 4], [5, 6]] }, { en: /nodes 1–4; nodes 5 and 6/, es: /nudos 1–4; nudos 5 y 6/ }],
    ['support-node', {}, { en: /not in the list/, es: /no está en la lista/ }],
    ['duplicate-support', { nodes: [5] }, { en: /Node 5 already/, es: /nudo 5 ya/ }],
    ['load-node', {}, { en: /not in the list/, es: /no está en la lista/ }],
    ['few-supports', { count: 2 }, { en: /give 2 reaction components/, es: /dan 2 componentes de reacción/ }],
    ['mechanism', { nodes: [3, 4] }, { en: /nodes 3 and 4 can move/, es: /en los nudos 3 y 4\./ }],
    ['unrestrained', { count: 2 }, { en: /in 2 ways/, es: /de 2 maneras/ }],
    ['ill-conditioned', {}, { en: /factor of a trillion/, es: /billón/ }],
    ['size', {}, { en: /beyond the range/, es: /fuera del rango/ }],
    ['stopped', {}, { en: /calculation stop/, es: /se detuvo/ }],
  ];
  for (const [code, over, expected] of cases) {
    it(code, () => {
      for (const lang of LANGS) {
        const line = issueSentence(at(code, over), trussUi[lang]);
        expect(line).toMatch(expected[lang]);
        expect(line).not.toMatch(/[{}]|undefined|NaN/);
      }
    });
  }
  it('says one node and several in the singular and the plural', () => {
    expect(issueSentence(at('mechanism', { nodes: [3] }), trussUi.en)).toContain('node 3 can move');
    expect(issueSentence(at('mechanism', { nodes: [3] }), trussUi.es)).toContain('en el nudo 3.');
    expect(issueSentence(at('mechanism', { nodes: [1, 2, 3, 4, 6] }), trussUi.en)).toContain('nodes 1–4 and 6 can move');
    expect(issueSentence(at('few-supports', { count: 1 }), trussUi.en)).toContain('give 1 reaction component,');
    expect(issueSentence(at('unrestrained', { count: 1 }), trussUi.es)).toContain('de 1 manera');
  });
});

describe('what the form says of what it just did', () => {
  it('says a deleted node, the members, supports and loads that went with it, and that the rest were renumbered', () => {
    const form = reduceTruss(base, { type: 'remove', list: 'nodes', id: 7 });
    expect(form.notice).toMatchObject({ code: 'node-removed', node: 7, supports: 0, loads: 1, renumbered: true });
    const html = show('en', form);
    const nodes = groupsOf(html)[1].html;
    expect((form.notice as { members: number[] }).members).toEqual([5, 6, 10, 15]);
    expect(text(nodes.match(/<p class="mp-truss__notice"[^>]*>([\s\S]*?)<\/p>/)![1])).toBe('Node 7 removed. Members 5, 6, 10 and 15 went with it. 1 load went with it. The nodes after it move up one number.');
    expect(itemsOf(nodes)).toHaveLength(9);
    const es = text(groupsOf(show('es', form))[1].html.match(/<p class="mp-truss__notice"[^>]*>([\s\S]*?)<\/p>/)![1]);
    expect(es).toBe('Se quitó el nudo 7. Con él se fueron las barras 5, 6, 10 y 15. Con él se fue 1 carga. Los nudos siguientes suben un número.');
  });

  it('says nothing about renumbering when the last node goes, and a single member in the singular', () => {
    const t = template('triangle');
    const form = reduceTruss(t, { type: 'remove', list: 'nodes', id: t.nodes[2].id });
    const html = show('en', form);
    const note = text(html.match(/<p class="mp-truss__notice"[^>]*>([\s\S]*?)<\/p>/)![1]);
    expect(note).toBe('Node 3 removed. Members 2 and 3 went with it. 1 load went with it.');
    const endOnly = reduceTruss(reduceTruss(emptyTruss(), { type: 'add', list: 'nodes' }), { type: 'add', list: 'nodes' });
    const last = reduceTruss(endOnly, { type: 'remove', list: 'nodes', id: endOnly.nodes[1].id });
    expect(text(show('en', last).match(/<p class="mp-truss__notice"[^>]*>([\s\S]*?)<\/p>/)![1])).toBe('Node 2 removed.');
  });

  it('says a list is full, under its add button, which then does nothing', () => {
    const full = reduceTruss(base, { type: 'template', template: 'warren-verticals', params: { panels: 19 } });
    expect(full.nodes).toHaveLength(40);
    for (const form of [full, reduceTruss(full, { type: 'add', list: 'nodes' })]) {
      expect(form.nodes).toHaveLength(40);
      const nodes = groupsOf(show('en', form))[1].html;
      expect(text(nodes.match(/<p class="mp-truss__limit"[^>]*>([\s\S]*?)<\/p>/)![1])).toBe('A truss holds 40 nodes at most.');
      expect(nodes).toMatch(/<button type="button" class="mp-app__add" aria-disabled="true" aria-describedby="[^"]+">/);
    }
    expect(text(groupsOf(show('es', full))[1].html)).toContain('Una cercha admite 40 nudos como máximo.');
    // A list with room has no such line and a plain button.
    expect(groupsOf(show('en'))[1].html).not.toContain('mp-truss__limit');
    expect(groupsOf(show('en'))[1].html).toContain('<button type="button" class="mp-app__add"><span');
  });

  it('says a template had to change what it was asked for', () => {
    const form = reduceTruss(base, { type: 'template', template: 'pratt', params: { span: -5, panels: 5, load: Number.NaN } });
    expect(form.notice).toMatchObject({ code: 'template' });
    const note = text(groupsOf(show('en', form))[0].html.match(/<p class="mp-truss__notice"[^>]*>([\s\S]*?)<\/p>/)![1]);
    expect(note).toBe('The span -5 cannot be used; 32 ft was used. This shape cannot be built with 5 panels; 6 was used. The load — is not a number; 10 kip was used.');
    const es = text(groupsOf(show('es', form))[0].html.match(/<p class="mp-truss__notice"[^>]*>([\s\S]*?)<\/p>/)![1]);
    expect(es).toBe('La luz -5 no se puede usar; se usó 32 ft. Esta forma no se puede construir con 5 paneles; se usaron 6. La carga — no es un número; se usó 10 kip.');
    const layout = reduceTruss(base, { type: 'template', template: 'cantilever', params: { supports: 'two-pins' } });
    expect(text(groupsOf(show('en', layout))[0].html)).toContain('This shape does not have the “Pin at both ends (indeterminate)” layout; “Held by a wall on the left” was used.');
  });

  it('says nothing when a template was built as asked', () => {
    expect(groupsOf(show('en', reduceTruss(base, { type: 'template', template: 'howe' })))[0].html).not.toContain('mp-truss__notice');
  });
});

describe('the units', () => {
  const si = convertTruss(base, 'si');

  it('prints the same truss in kilonewtons and metres, in the unit shown', () => {
    const html = show('en', si);
    const members = rowsOf(cardsOf(html).of('Member forces'));
    expect(headOf(cardsOf(html).of('Member forces'))).toEqual(['Member', 'Nodes', 'Length (m)', 'Force (kN)', 'State', 'Stress, N ÷ A (MPa)', 'Elongation (mm)']);
    // 15 kip is 66.72 kN; the diagonals √2 × that; 3.75 ksi is 25.86 MPa (the area converts exactly: 4 in² is 2,580.64 mm²).
    expect(members[1].slice(3, 6)).toEqual(['+66.72', 'Tension', '+25.86']);
    expect(members[13][3]).toBe(`+${formatNumber(15 * Math.SQRT2 * 4.4482216152605, 4)}`);
    expect(members[13][2]).toBe(formatNumber(8 * Math.SQRT2 * 0.3048, 4));
    const reactions = rowsOf(cardsOf(html).of('Reactions'));
    expect(reactions[0][5]).toBe(formatNumber(20 * 4.4482216152605, 4));
    expect(text(html)).toContain('SI (m, kN)');
    expect(text(html).replace('US (ft, kip)', '')).not.toMatch(/\bkip\b|\bksi\b|\bft\b/);
    const section = groupsOf(html).find((g) => g.legend === 'Section and material')!;
    expect(fieldsOf(section.html).map((f) => [f.label, f.unit])).toEqual([['Modulus of elasticity, E', 'GPa'], ['Area, A', 'mm²']]);
    expect(text(html)).not.toMatch(noise);
  });

  it('comes back to the same printed numbers after a round trip through the other system', () => {
    const there = convertTruss(base, 'si');
    const back = convertTruss(there, 'us');
    for (const lang of LANGS) {
      const a = cardsOf(show(lang, base));
      const b = cardsOf(show(lang, back));
      expect(b.titles).toEqual(a.titles);
      for (const title of a.titles) expect(rowsOf(b.of(title)), title).toEqual(rowsOf(a.of(title)));
    }
  });

  it('keeps every force and reaction the same up to the factor, whatever the unit', () => {
    const usRows = rowsOf(cardsOf(show('en', base)).of('Member forces'));
    const siRows = rowsOf(cardsOf(show('en', si)).of('Member forces'));
    usRows.forEach((row, k) => {
      const kip = Number(row[3].replace('−', '-'));
      const kn = Number(siRows[k][3].replace('−', '-'));
      // Four figures are printed on each side: the two agree to within the rounding of both.
      expect(Math.abs(kn / 4.4482216152605 - kip)).toBeLessThanOrEqual(Math.max(Math.abs(kip) * 6e-4, 1e-3));
    });
  });
});

describe('an empty case and a full-size one', () => {
  it('shows an empty truss as empty: its two lists of nothing, its rows of problems, no table of numbers', () => {
    const html = show('en', emptyTruss());
    expect(issueList(html)[0]).toBe('A truss needs at least two nodes, and this one has 0.');
    expect(groupsOf(html).slice(1, 5).map((g) => text(g.html).includes('None.'))).toEqual([true, true, true, true]);
    expect(cardsOf(html).titles).toEqual([]);
    expect(attr(html.match(/<svg class="mp-plot__svg mp-truss-fig__svg"[^>]*>/)![0], 'aria-label')).toBe('Truss: no nodes yet.');
    expect(html).toContain('mp-app__need');
    expect(text(html)).not.toMatch(noise);
    for (const lang of LANGS) expect(text(show(lang, emptyTruss()))).not.toMatch(/\{[a-z|]+\}/i);
  });

  it('opens a truss of 40 nodes and 120 members, solved, with every row in its table', () => {
    let form = reduceTruss(base, { type: 'template', template: 'warren-verticals', params: { panels: 19 } });
    while (form.members.length < 120) {
      const next = reduceTruss(form, { type: 'add', list: 'members' });
      if (next === form) break;
      form = next;
    }
    expect(form.members).toHaveLength(120);
    const a = analyseSafely(form);
    const html = show('en', form);
    if (a.results) {
      expect(rowsOf(cardsOf(html).of('Member forces'))).toHaveLength(120);
      expect(rowsOf(cardsOf(html).of('Node displacements'))).toHaveLength(40);
    } else {
      expect(issueList(html).length).toBeGreaterThan(0);
    }
    expect(itemsOf(groupsOf(html)[1].html)).toHaveLength(40);
    expect(itemsOf(groupsOf(html)[2].html)).toHaveLength(120);
    expect(text(html)).not.toMatch(noise);
    // A list at its limit says so.
    expect(groupsOf(html)[1].html).toContain('A truss holds 40 nodes at most.');
  });
});

describe('the order of the member table', () => {
  const rows = analyseSafely(base).results!.members;
  it('by member number, by the size of the force, and tension first, a tie going to the lower number', () => {
    expect(sortMembers(rows, 'member').map((m) => m.label)).toEqual(Array.from({ length: 17 }, (_, k) => k + 1));
    expect(sortMembers(rows, 'largest').map((m) => m.label)).toEqual([14, 17, 6, 7, 9, 13, 2, 3, 5, 8, 10, 12, 11, 15, 16, 1, 4]);
    expect(sortMembers(rows, 'tension').map((m) => m.label)).toEqual([14, 17, 2, 3, 15, 16, 1, 4, 11, 5, 8, 10, 12, 6, 7, 9, 13]);
    // A copy: the list it was given is as it was.
    expect(rows.map((m) => m.label)).toEqual(Array.from({ length: 17 }, (_, k) => k + 1));
  });
});

describe('the address, at component level', () => {
  const source = readFileSync(join(SRC, 'components/ttc/calc/truss/TrussCalculator.tsx'), 'utf8');

  it('is written for this calculator’s key, read from the page’s address, and the example leaves it bare', () => {
    expect(source).toMatch(/useAddress<TrussForm>\(\{\s*key: TRUSS_KEY,\s*example: EXAMPLE,/);
    expect(source).toContain('const EXAMPLE = encodeTruss(defaultTruss());');
    expect(source).toContain('address.take(EXAMPLE)');
    expect(source).toContain('new RegExp(`^#${TRUSS_KEY}=(.*)$`)');
    expect(source).toContain('return decodeTruss(text);');
    expect(source).toMatch(/blank: defaultTruss,/);
  });

  it('leaves the field with the focus FIRST when a case arrives, then loads it, whole', () => {
    const open = source.slice(source.indexOf('open: (found) =>'), source.indexOf('const { linkError }'));
    expect(open.indexOf('focused.blur()')).toBeGreaterThan(-1);
    expect(open.indexOf('focused.blur()')).toBeLessThan(open.indexOf("dispatch({ type: 'load', form: found })"));
    expect(open).toContain('root.current?.contains(focused)');
    expect(open).toContain('setWhole(found)');
  });

  it('solves a case opened whole in the render that shows it, and defers only the typing of numbers', () => {
    expect(source).toContain('const behind = useDeferredValue(form);');
    expect(source).toMatch(/const solved = onPaper \|\| form === whole \|\| choicesOf\(behind\) !== choicesOf\(form\) \? form : behind;/);
    // The ids by which a member names its nodes are choices, not typed numbers.
    expect(source).toContain("const IDENTIFIERS = new Set(['id', 'i', 'j', 'node', 'nextId']);");
  });

  it('brings the address to the truss on screen before copying, and before Start over throws one away', () => {
    expect(source).toMatch(/address\.take\(encodeTruss\(form\)\);\s*return address\.link\(encodeTruss\(form\)\);/);
    expect(source).toContain('window.history.pushState');
    expect(source).toContain('setWhole(example)');
  });

  it('prints through the shell’s sheet, with the address that reopens the case', () => {
    expect(source).toContain("useSheet({ locale: t.sheet.locale, url: () => address.link(encodeTruss(form)) })");
    expect(source).toContain('<SheetStamp stamp={stamp} t={{ printed: t.sheet.printed, link: w.sheet.link }} />');
    for (const lang of LANGS) expect(trussUi[lang].sheet.link).toContain('{url}');
    expect(source).toContain('const width = onPaper ? PAPER_WIDTH : windowWidth;');
  });

  it('round-trips every template through its address into the very same page', () => {
    for (const id of TEMPLATE_IDS) {
      const form = template(id);
      const read = decodeTruss(encodeTruss(form))!;
      expect(read).not.toBeNull();
      const a = cardsOf(show('en', form));
      const b = cardsOf(show('en', read));
      expect(b.titles).toEqual(a.titles);
      for (const title of a.titles) expect(rowsOf(b.of(title)), `${id} ${title}`).toEqual(rowsOf(a.of(title)));
    }
  }, 30000);

  it('opens a truss the link cannot give as nothing at all', () => {
    expect(decodeTruss('')).toBeNull();
    expect(decodeTruss('garbage')).toBeNull();
    expect(decodeTruss(encodeTruss(base).slice(0, -3))).toBeNull();
  });
});

describe('the rules of the tool, as they stand in its source', () => {
  const source = readFileSync(join(SRC, 'components/ttc/calc/truss/TrussCalculator.tsx'), 'utf8');
  const schematic = readFileSync(join(SRC, 'components/ttc/calc/truss/TrussSchematic.tsx'), 'utf8');
  const css = readFileSync(join(SRC, 'components/ttc/calc/truss/truss.css'), 'utf8');

  it('carries neither language: its words are props, and the strings are imported as types only', () => {
    for (const file of [source, schematic]) {
      expect(file).not.toMatch(/import (?!type)[^;]*from '@\/lib\/calc\/truss\/strings'/);
      expect(file).not.toMatch(/from '@\/lib\/calc\/(beam|shaft|continuous)\/strings'/);
    }
    expect(source).toContain("'use client';");
  });

  it('solves through the door that never throws, and decides no number of its own', () => {
    expect(source).toContain('analyseSafely(solved)');
    expect(source).not.toMatch(/\bsolveTruss\b/);
    expect(source).not.toMatch(/\bMath\.(sqrt|hypot|atan2)\b/);
  });

  it('uses the shell’s pieces and not copies of them', () => {
    for (const piece of ["from '../shell/Actions'", "from '../shell/address'", "from '../shell/layout'", "from '../shell/sheet'", "from '../NumField'"]) expect(source).toContain(piece);
  });

  it('hands the keyboard its focus when a row is added or removed with it, as the others do', () => {
    expect(source).toContain('press.detail === 0');
    expect(source).toContain('flushSync(() => dispatch({ type: \'add\', list }))');
    expect(source).toContain('next?.focus()');
  });

  it('keeps the member marks off every action but a number typed, and drops them with the edit that renumbers', () => {
    expect(source).toMatch(/action\.type !== 'patch' && action\.type !== 'section' && action\.type !== 'material'/);
  });

  it('takes the template group, the switches and the order off the sheet, and holds the drawing whole on one page', () => {
    const print = css.slice(css.indexOf('@media print'));
    for (const hidden of ['.mp-truss .mp-truss__template', '.mp-truss .mp-truss__options', '.mp-truss .mp-truss__order', '.mp-truss .mp-truss-fig__hits']) expect(print).toContain(hidden);
    expect(print).toContain('.mp-truss .mp-app__plots {\n    break-inside: avoid;');
    // Tension and compression are told apart on paper by the pattern: the colours go to black.
    expect(print).toContain('--mp-truss-tension: #000;');
    expect(print).toContain('--mp-truss-compression: #000;');
  });

  it('tells a tension from a compression by colour, pattern and sign — never by colour alone', () => {
    expect(css).toContain('.mp-truss-fig__member--compression .mp-truss-fig__bar');
    expect(css).toMatch(/\.mp-truss-fig__core \{\s*fill: none;\s*stroke: var\(--mp-paper\);/);
    expect(css).toMatch(/\.mp-truss-fig__member--zero \.mp-truss-fig__bar \{[^}]*stroke-dasharray: 5 4;/);
    expect(schematic).toContain("signed(formatNumber(Math.abs(v), significant, group), v)");
  });

  it('keeps every rule of its sheet at the weight of two classes, so that it holds whichever sheet is read last', () => {
    const rules = css.replace(/\/\*[\s\S]*?\*\//g, '').match(/[^{}]+(?=\{)/g)!;
    const single = rules.map((r) => r.trim()).filter((r) => /^\.mp-[\w-]+$/.test(r) && !r.startsWith('.mp-truss-fig__') && r !== '.mp-truss');
    expect(single).toEqual([]);
  });

  it('gives every control 44px to be pressed with', () => {
    expect(css).toMatch(/\.mp-truss \.mp-truss__pick \{\s*min-width: 44px;\s*min-height: 44px;/);
    expect(css).toContain('grid-template-columns: minmax(0, 1fr) 44px;');
  });
});

describe('the words around the tool', () => {
  const rows = calculatorFamilies.flatMap((f) => f.items).filter((x) => x.href);
  const leaves = (value: unknown, path = ''): [string, string][] => {
    if (typeof value === 'string') return [[path, value]];
    if (value && typeof value === 'object') return Object.entries(value).flatMap(([k, v]) => leaves(v, path ? `${path}.${k}` : k));
    return [];
  };
  const words = (s: string) => s.toLowerCase().replace(/[^\p{L}\p{N}\s]/gu, ' ').split(/\s+/).filter(Boolean);
  const sharedRuns = (a: string, b: string) => {
    const there = ` ${words(b).join(' ')} `;
    const mine = words(a);
    return mine.map((_, i) => mine.slice(i, i + 6)).filter((run) => run.length === 6 && there.includes(` ${run.join(' ')} `)).map((run) => run.join(' '));
  };

  // Each text of the site has one home. These lines are this tool's: not the other calculators' said again (what is theirs and fits comes from `t`), nor this page's own text around the tool.
  it('says nothing the other calculators or the catalogue already say, six words running', () => {
    expect(rows.length).toBeGreaterThanOrEqual(3);
    for (const lang of LANGS) {
      const theirs = [beamStrings[lang], spanUi[lang], spanPage[lang], continuousUi[lang], continuousPage[lang], shaftUi[lang], shaftPage[lang]].flatMap((set) => leaves(set).map(([, s]) => s)).concat(rows.map((r) => r.does[lang])).join(' . ');
      for (const [path, s] of leaves(trussUi[lang])) expect(sharedRuns(s, theirs), `${lang} ${path}`).toEqual([]);
    }
  });

  it('says “truss”, never “beam”, in what it borrows and in what it prints', () => {
    const beam = { en: /\bbeams?\b/i, es: /\bvigas?\b/i };
    for (const lang of LANGS) {
      const borrowed = leaves(sharedWords(beamStrings[lang].ui));
      expect(borrowed.length).toBeGreaterThan(20);
      for (const [path, s] of [...borrowed, ...leaves(trussUi[lang])]) expect(s, `${lang} ${path}`).not.toMatch(beam[lang]);
      for (const html of [show(lang), show(lang, template('cantilever')), show(lang, emptyTruss())]) expect(text(html)).not.toMatch(beam[lang]);
    }
  });

  it('borrows only the shared pieces, and the page can hand over exactly those', () => {
    for (const lang of LANGS) {
      const shared = sharedWords(beamStrings[lang].ui);
      expect(Object.keys(shared).sort()).toEqual(['beam', 'loads', 'numbers', 'results', 'row', 'section', 'sheet', 'supports', 'toolbar']);
      expect(Object.keys(shared.results).sort()).toEqual(['downward', 'privacy', 'reactions', 'support', 'title', 'upward']);
      expect(JSON.stringify(shared).length).toBeLessThan(JSON.stringify(beamStrings[lang].ui).length / 4);
    }
  });
});
