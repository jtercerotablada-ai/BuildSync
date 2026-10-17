import { createElement as h } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { beamStrings } from '@/lib/calc/beam/strings';
import { analyseSafely, type AnalysisIssue } from '@/lib/calc/frame/analysis';
import { ISSUE_CODES, WARNING_CODES } from '@/lib/calc/frame/codes';
import { MAX_NODES, convertFrame, decodeFrame, defaultFrame, emptyFrame, encodeFrame, reduceFrame, type FrameForm } from '@/lib/calc/frame/model';
import { frameUi, sharedWords } from '@/lib/calc/frame/strings';
import { TEMPLATE_IDS, type TemplateId } from '@/lib/calc/frame/templates';
import type { Lang } from '@/lib/ttc/i18n';
import { FrameCalculator } from './FrameCalculator';
import { choicesOf, fill, flaggedNodes, focusAddedRow, formToSolve, issueSentence, keepsMarks, largerExtreme, leaveBehind, listOf, noticeText, openWhole, readingSentence, signed, sortMembers, warningSentence, whereText } from './text';

vi.setConfig({ testTimeout: 120_000 });
afterEach(() => new Promise<void>((done) => setTimeout(done, 0)));

/**
 * THE FRAME CALCULATOR as the server sends it (what a visitor sees before the script arrives, or without it): its five tables and its
 * template group, its results cell by cell, every state of the frame, its two languages - and the small rules of the form as pure
 * functions. What only a browser can show (typing, a member picked in the drawing, the address after the #, a row added with the
 * keyboard, the phone's layout, the printed sheet) is listed in the report that goes with this file.
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
const show = (lang: Lang, initial?: FrameForm) => renderToStaticMarkup(h(FrameCalculator, { t: sharedWords(beamStrings[lang].ui), w: frameUi[lang], initial }));
const noise = /NaN|undefined|Infinity|\[object|(?:^|[\s>(=])-0(?![.\d])|−0(?![.\d])|\be[+-]\d|\{[a-zA-Z]+(\|[^}]*)?\}/;
const HEAD = /<span class="mp-frame__head" aria-hidden="true">(?:[^<]|<span class="mp-plot__unit">[^<]*<\/span>)*<\/span>/g;
const cardsOf = (html: string) => {
  const cards = html.split(/<div class="mp-app__card(?: mp-app__card--wide)?">/).slice(1);
  const title = (c: string) => text(c.match(/<h3\b[^>]*>([\s\S]*?)<\/h3>/)?.[1] ?? '');
  return { titles: cards.map(title), of: (name: string) => cards.find((c) => title(c) === name) ?? '' };
};
const cells = (row: string) => [...row.matchAll(/<t[hd]\b[^>]*>([\s\S]*?)<\/t[hd]>/g)].map((c) => text(c[1].replace(HEAD, '')));
const rowsOf = (card: string) => [...(card.match(/<tbody\b[^>]*>([\s\S]*?)<\/tbody>/)?.[1] ?? '').matchAll(/<tr\b[^>]*>([\s\S]*?)<\/tr>/g)].map((r) => cells(r[1]));
const issueList = (html: string) => [...(html.match(/<div class="mp-app__issues"[^>]*>([\s\S]*?)<\/div>/)?.[1] ?? '').matchAll(/<li[^>]*>([\s\S]*?)<\/li>/g)].map((m) => text(m[1]));
const reading = (html: string) => text(html.match(/<p class="mp-frame__reading">([\s\S]*?)<\/p>/)?.[1] ?? '');

const base = defaultFrame();
const tpl = (id: TemplateId, units: 'us' | 'si' = 'us') => reduceFrame(reduceFrame(defaultFrame(), { type: 'units', units }), { type: 'template', template: id });
const patchRow = (f: FrameForm, list: 'nodes' | 'members' | 'supports' | 'loads' | 'memberLoads', k: number, patch: Record<string, unknown>) => reduceFrame(f, { type: 'patch', list, id: f[list][k].id, patch });

describe('the default frame, as the server sends it', () => {
  it('gives the solver’s figures: reactions, end forces, extremes, displacements and the balance', () => {
    const html = show('en');
    const t = text(html);
    expect(t).toContain('Statically indeterminate to degree 3');
    expect(t).toContain('= 3 × 3 + 6 − 12 − 0 = 3');
    const cards = cardsOf(html);
    expect(cards.titles).toEqual(['Reactions', 'Member end forces', 'Extremes along each member', 'Node displacements', 'Equilibrium check']);
    expect(rowsOf(cards.of('Reactions'))).toEqual([
      ['1', '1', 'Fixed', '−0.3109', '+10.13', '+16.11', '10.13'],
      ['2', '2', 'Fixed', '−9.689', '+13.87', '+46.45', '16.92'],
    ]);
    expect(rowsOf(cards.of('Member end forces'))[2]).toEqual(['3', '3 – 4', '20', '−9.689', '+10.13', '−13.01', '−9.689', '−13.87', '−50.44']);
    const extremes = rowsOf(cards.of('Extremes along each member'));
    expect(extremes[2][1]).toContain('+29.74 at 8.44');
    expect(extremes[2][2]).toContain('−50.44 at 20');
    expect(extremes[2][3]).toBe('1.4, 15.48');
    // The largest of the frame is marked, in words for whoever does not see the mark.
    expect(extremes[2][2]).toContain('largest in the frame');
    expect(rowsOf(cards.of('Node displacements'))[2].slice(0, 4)).toEqual(['3', '+0.09282', '−0.002972', '0.09287']);
    expect(text(cards.of('Equilibrium check'))).toContain('In balance');
  });

  it('says the largest values, the units and the sign convention once', () => {
    const t = text(show('en'));
    expect(t).toContain('−50.44 kip·ft - Member 3, at node 4');
    expect(t).toContain('0.09287 in - node 3');
    expect(t.match(/Turn a member round and V and M change sign/g)).toHaveLength(1);
    expect(t).toContain('no design check');
  });

  it('is balanced to the figures: never a red alarm for noise, never -0, NaN or e-notation', () => {
    for (const lang of LANGS) {
      for (const f of [base, convertFrame(base, 'si'), tpl('gable'), tpl('two-hinged', 'si'), tpl('cantilever-column'), { ...base, loads: [], memberLoads: [] }]) {
        const t = text(show(lang, f));
        expect(t).not.toMatch(noise);
        expect(t).not.toContain('Out of balance');
      }
    }
  });

  it('names every table, and every id is in the page once', () => {
    const html = show('en');
    const ids = [...html.matchAll(/ id="([^"]+)"/g)].map((m) => m[1]);
    expect(new Set(ids).size).toBe(ids.length);
    for (const m of html.matchAll(/<table[^>]*aria-labelledby="([^"]+)"/g)) expect(ids).toContain(m[1]);
    expect([...html.matchAll(/<table\b/g)]).toHaveLength(4);
  });

  it('puts the links to the drawing and the results before the form, to ids that take the focus', () => {
    for (const lang of LANGS) {
      const html = show(lang);
      const nav = html.match(/<nav class="mp-frame__jump" aria-label="([^"]*)">([\s\S]*?)<\/nav>/)!;
      expect(nav[1]).toBe(frameUi[lang].jump.label);
      const links = [...nav[2].matchAll(/<a href="#([^"]+)">([^<]*)<\/a>/g)];
      expect(links.map((l) => l[2])).toEqual([frameUi[lang].jump.drawing, frameUi[lang].jump.results]);
      for (const [, id] of links) {
        const esc = id.replace(/:/g, '\\:');
        expect(html).toMatch(new RegExp(`id="${esc}"[^>]*tabindex="-1"|tabindex="-1"[^>]*id="${esc}"`));
      }
      expect(html.indexOf('mp-frame__jump')).toBeLessThan(html.indexOf('<form'));
    }
  });

  it('writes the one sentence under the drawing from the numbers, in both languages', () => {
    expect(reading(show('en'))).toBe('Reading the drawing: bending moment, drawn on the side of each member that is in tension. The largest bending moment is −50.44 kip·ft, in member 3, at node 4.');
    expect(reading(show('es'))).toBe('Cómo leer el dibujo: momento flector, dibujado del lado de cada barra que está en tracción. El mayor momento flector es −50.44 kip·ft, en la barra 3, en el nudo 4.');
  });

  it('keeps a line for what has just happened on the page, empty, before it has anything to say', () => {
    const html = show('en');
    const lines = [...html.matchAll(/<p class="(mp-frame__notice|mp-frame__limit|mp-app__computed mp-frame__said|mp-frame__filled)"[^>]*role="status"[^>]*>([\s\S]*?)<\/p>/g)];
    // The template, five lists and five limits, the "loaded" line and the shape picker's line.
    expect(lines.length).toBe(1 + 5 + 5 + 1 + 1);
    expect(lines.every((l) => text(l[2]) === '')).toBe(true);
  });
});

describe('every template, in both units and both languages', () => {
  for (const id of TEMPLATE_IDS) {
    it(`${id}: solves, balances, and prints no noise`, () => {
      for (const units of ['us', 'si'] as const) {
        for (const lang of LANGS) {
          const f = tpl(id, units);
          const html = show(lang, f);
          const t = text(html);
          expect(t, `${id} ${units} ${lang}`).not.toMatch(noise);
          expect(analyseSafely(f).results, id).not.toBeNull();
          expect(cardsOf(html).titles.length, id).toBe(5);
          expect(t).toContain(units === 'us' ? 'kip' : 'kN');
        }
      }
    });
  }
  it('the same frame in the other units prints the same case, converted: a round trip changes nothing', () => {
    for (const f of [base, tpl('gable'), tpl('l-frame')]) {
      const back = convertFrame(convertFrame(f, 'si'), 'us');
      expect(encodeFrame(back)).toBe(encodeFrame(f));
      expect(text(show('en', back))).toBe(text(show('en', f)));
    }
  });
});

describe('a frame that cannot be solved', () => {
  const withNode = (f: FrameForm, k: number, patch: Record<string, number>) => patchRow(f, 'nodes', k, patch);
  const PROBLEMS: { code: string; form: () => FrameForm; en: RegExp; row?: string }[] = [
    { code: 'few-nodes', form: () => reduceFrame(emptyFrame(), { type: 'add', list: 'nodes' }), en: /^A frame needs at least two nodes; this one has 1\.$/ },
    { code: 'no-members', form: () => reduceFrame(reduceFrame(emptyFrame(), { type: 'add', list: 'nodes' }), { type: 'add', list: 'nodes' }), en: /^There are no members yet/ },
    { code: 'number', form: () => withNode(base, 1, { x: Number.NaN }), en: /^Node 2: The x coordinate must be a number/, row: 'Node 2' },
    { code: 'duplicate-node', form: () => withNode(base, 1, { x: 0, y: 0 }), en: /^Node 1 and node 2 coincide/ },
    { code: 'section', form: () => ({ ...base, E: -5 }), en: /^Section and material: The modulus \(E\) has to be above zero/ },
    { code: 'sections', form: () => ({ ...base, A: null, I: null }), en: /^The frame is statically indeterminate and 3 members have no E, A or I/ },
    { code: 'node-unconnected', form: () => reduceFrame(base, { type: 'add', list: 'nodes' }), en: /^No member reaches node 5/, row: 'Node 5' },
    { code: 'few-supports', form: () => ({ ...base, supports: [] }), en: /^With these supports there are 0 reaction components/ },
    { code: 'duplicate-support', form: () => patchRow(base, 'supports', 1, { node: base.supports[0].node }), en: /^Support 2: Node 1 has a support already/, row: 'Support 2' },
    { code: 'load-position', form: () => patchRow(reduceFrame(base, { type: 'add', list: 'memberLoads', seed: { kind: 'point' } }), 'memberLoads', 1, { a: 99 }), en: /^Member load 2: The position must lie on the member, between 0 and/, row: 'Member load 2' },
  ];
  it('says each problem in one sentence on its row and in the box, with the numbers it carries', () => {
    for (const p of PROBLEMS) {
      const f = p.form();
      const a = analyseSafely(f);
      expect(a.issues.map((i) => i.code), p.code).toContain(p.code);
      const html = show('en', f);
      expect(issueList(html).some((i) => p.en.test(i)), `${p.code}: ${issueList(html).join(' | ')}`).toBe(true);
      expect(text(html), p.code).not.toMatch(noise);
      if (p.row) expect(html, `${p.code} row ${p.row}`).toContain(`aria-label="${p.row}" data-invalid="true"`);
    }
  });

  it('ties a field at fault to its row’s message', () => {
    const html = show('en', withNode(base, 1, { x: Number.NaN }));
    const input = html.match(/<input[^>]*aria-invalid="true"[^>]*>/)![0];
    const id = input.match(/aria-describedby="([^"]+)"/)![1];
    expect(html).toContain(`<p class="mp-app__row-error" id="${id}">`);
  });

  it('says a mechanism by the nodes that move, rings them, and has no results', () => {
    let f = tpl('portal');
    f = patchRow(f, 'members', 2, { hingeStart: true, hingeEnd: true });
    f = patchRow(f, 'supports', 0, { kind: 'pin' });
    f = patchRow(f, 'supports', 1, { kind: 'pin' });
    f = patchRow(f, 'members', 0, { hingeEnd: true });
    f = patchRow(f, 'members', 1, { hingeEnd: true });
    const a = analyseSafely(f);
    expect(a.results).toBeNull();
    const html = show('en', f);
    expect(text(html)).toContain('Unstable');
    expect(reading(html)).toMatch(/^Reading the drawing: the frame is a mechanism, so it has no diagrams\./);
    expect(html).not.toContain('Member end forces');
    expect(html.match(/mp-frame-fig__ring/g)?.length ?? 0).toBeGreaterThan(0);
  });

  it('shows an empty frame with progressive empty states, not errors about numbers', () => {
    for (const lang of LANGS) {
      const html = show(lang, emptyFrame());
      expect(text(html)).not.toMatch(noise);
      expect([...html.matchAll(/<p class="mp-app__none">/g)].length).toBe(5);
      expect(reading(html)).toBe('');
    }
  });

  it('says “None.” in the gender of the list, in Spanish', () => {
    const t = text(show('es', emptyFrame()));
    expect((t.match(/Ninguno\./g) ?? []).length).toBe(2);
    expect((t.match(/Ninguna\./g) ?? []).length).toBe(3);
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
    max: 50,
  });
  it('issues: no hole is left, no number is missing, every sentence ends like a sentence', () => {
    for (const lang of LANGS) {
      for (const code of ISSUE_CODES) {
        const s = issueSentence(issue(code), frameUi[lang], { number: (v) => String(v), unit: 'ft' });
        expect(s, `${lang} ${code}`).not.toMatch(noise);
        expect(s, `${lang} ${code}`).toMatch(/[.)]$/);
        expect(s.length).toBeGreaterThan(20);
      }
    }
  });
  it('a mechanism names its nodes and what to add, in the plural and the singular', () => {
    const one = issueSentence({ code: 'mechanism', nodes: [3], kind: 'sway', count: 1 }, frameUi.en);
    expect(one).toBe('The frame is a mechanism, and node 3 can sway. Add a diagonal member or a support, or make a joint rigid.');
    const many = issueSentence({ code: 'mechanism', nodes: [3, 4], kind: 'rotation', count: 2 }, frameUi.es);
    expect(many).toContain('los nudos 3 y 4 pueden girar libremente');
    expect(many).toContain('Hay 2 movimientos independientes.');
  });
  it('warnings: one sentence each', () => {
    for (const lang of LANGS) {
      for (const code of WARNING_CODES) {
        const s = warningSentence({ code, members: [2, 3], nodes: [1] }, frameUi[lang]);
        expect(s, `${lang} ${code}`).not.toMatch(noise);
        expect(s.length).toBeGreaterThan(30);
      }
    }
    expect(warningSentence({ code: 'bar', members: [2] }, frameUi.en)).toContain('Member 2 has a hinge at each end: it carries axial force');
    expect(warningSentence({ code: 'bar', members: [2, 3] }, frameUi.es)).toContain('Las barras 2 y 3 tienen una rótula en cada extremo: soportan');
  });
  it('renders the no-load warning with the results beside it', () => {
    const none = { ...base, loads: [], memberLoads: [] };
    expect(text(show('en', none))).toContain('every force and reaction is zero');
  });
});

describe('the notices of the form', () => {
  const how = { num: (v: number) => String(v), units: { length: 'ft', force: 'kip', line: 'kip/ft' } };
  it('a node deleted says what went with it and what was renumbered', () => {
    const f = reduceFrame(base, { type: 'remove', list: 'nodes', id: base.nodes[0].id });
    const n = noticeText(f.notice, frameUi.en, how)!;
    expect(n.where).toBe('nodes');
    expect(n.text).toBe('Node 1 deleted. Also taken away: member 1 (their numbers are those they had before). Also gone: 1 support. Later nodes now have a number one lower. Surviving members are renumbered as well.');
    expect(noticeText(f.notice, frameUi.es, how)!.text).toContain('Se borró el nudo 1.');
  });
  it('a member deleted, a refused add, a full list', () => {
    const f = reduceFrame(base, { type: 'remove', list: 'members', id: base.members[0].id });
    expect(noticeText(f.notice, frameUi.en, how)!.text).toBe('Member 1 deleted. Later members now have a number one lower.');
    const full = reduceFrame(emptyFrame(), { type: 'add', list: 'supports' });
    expect(noticeText(full.notice, frameUi.en, how)).toEqual({ where: 'supports', text: 'No node exists yet, so nothing could be added. Add a node first.' });
    const lim = { ...base, nodes: Array.from({ length: MAX_NODES }, (_, k) => ({ id: k + 1, x: k, y: 0 })), nextId: 100 };
    const refused = reduceFrame(lim, { type: 'add', list: 'nodes' });
    expect(refused.nodes).toHaveLength(MAX_NODES);
    expect(noticeText(refused.notice, frameUi.en, how)!.text).toBe('A frame holds 50 nodes at most.');
  });
  it('a template that had to change a number says which, why and to what', () => {
    const f = reduceFrame(base, { type: 'template', template: 'portal', params: { bays: 9, height: 100000 } });
    const n = noticeText(f.notice, frameUi.en, how)!;
    expect(n.where).toBe('template');
    expect(n.text).toContain('Bays: 9 is outside the range this shape takes (from 1 to 6); 6 was used.');
    expect(n.text).toContain('Height: 100000 is outside the range this shape takes (from 1/200 to 200 times the width); 4000 ft was used.');
    const g = reduceFrame(base, { type: 'template', template: 'two-hinged', params: { base: 'fixed' } });
    expect(noticeText(g.notice, frameUi.en, how)!.text).toBe('This shape cannot stand on Fixed feet; it was built on Pinned feet.');
    expect(noticeText(g.notice, frameUi.es, how)!.text).toContain('Esta forma no puede tener los pies Empotrados');
  });
  it('rows added are free ones, and a unit toggle keeps every row', () => {
    let f = tpl('portal');
    for (let k = 0; k < 4; k++) f = reduceFrame(f, { type: 'add', list: 'nodes' });
    expect(new Set(f.nodes.map((n) => `${n.x},${n.y}`)).size).toBe(f.nodes.length);
    let g = reduceFrame(f, { type: 'add', list: 'memberLoads', seed: { kind: 'point' } });
    g = reduceFrame(g, { type: 'add', list: 'memberLoads', seed: { kind: 'point', member: g.memberLoads[g.memberLoads.length - 1].member } });
    const last = g.memberLoads[g.memberLoads.length - 1].member;
    const same = g.memberLoads.filter((l) => l.kind === 'point' && l.member === last);
    expect(new Set(same.map((l) => l.a)).size).toBe(same.length);
    const there = convertFrame(g, 'si');
    expect([there.nodes.length, there.members.length, there.memberLoads.length]).toEqual([g.nodes.length, g.members.length, g.memberLoads.length]);
  });
});

describe('the rules of the form, as functions', () => {
  it('fills holes and plurals in one pass', () => {
    expect(fill('{n} {n|node|nodes} {x}', { n: 1, x: '{n}' })).toBe('1 node {n}');
    expect(listOf([1, 2, 3, 5, 9, 10], 'and')).toBe('1–3, 5, 9 and 10');
    expect(signed('0', 0)).toBe('0');
    expect(signed('2', -2)).toBe('−2');
  });

  it('opens a frame from the address by leaving the field first and keeping the very object', () => {
    const order: string[] = [];
    const found = decodeFrame(encodeFrame(tpl('gable')))!;
    openWhole(found, { blur: () => order.push('blur'), load: (x) => order.push(x === found ? 'load' : 'copy'), remember: () => order.push('remember'), template: () => order.push('template') });
    expect(order).toEqual(['blur', 'load', 'remember', 'template']);
    expect(reduceFrame(base, { type: 'load', form: found })).toBe(found);
    const again = defaultFrame();
    expect(reduceFrame(found, { type: 'reset', form: again })).toBe(again);
  });

  it('solves the form itself for anything but a number typed, and the one before for a number', () => {
    const typed = patchRow(base, 'nodes', 3, { x: 21 });
    expect(formToSolve({ form: typed, behind: base, whole: null, onPaper: false })).toBe(base);
    expect(formToSolve({ form: typed, behind: base, whole: typed, onPaper: false })).toBe(typed);
    expect(formToSolve({ form: typed, behind: base, whole: null, onPaper: true })).toBe(typed);
    const edits: FrameForm[] = [
      reduceFrame(base, { type: 'units', units: 'si' }),
      reduceFrame(base, { type: 'add', list: 'nodes' }),
      patchRow(base, 'members', 0, { hingeEnd: true }),
      patchRow(base, 'members', 0, { A: 10 }),
      patchRow(base, 'members', 0, { j: base.nodes[1].id }),
      patchRow(reduceFrame(base, { type: 'add', list: 'memberLoads' }), 'memberLoads', 1, { member: base.members[0].id }),
      patchRow(base, 'supports', 0, { kind: 'roller' }),
      reduceFrame(base, { type: 'material', material: 'aluminum' }),
    ];
    edits.forEach((edit, k) => expect(formToSolve({ form: edit, behind: base, whole: null, onPaper: false }), `edit ${k}`).toBe(edit));
    expect(choicesOf(patchRow(base, 'nodes', 0, { x: 5 }))).toBe(choicesOf(base));
  });

  it('keeps the member marks through a number typed, and drops them with every edit that can renumber', () => {
    for (const type of ['patch', 'section', 'material', 'preset']) expect(keepsMarks(type), type).toBe(true);
    for (const type of ['load', 'units', 'template', 'add', 'remove', 'reset', 'clear']) expect(keepsMarks(type), type).toBe(false);
  });

  it('hands a row added by the keyboard the focus, and only if one was added', () => {
    const focused: string[] = [];
    const row = { querySelector: () => ({ focus: () => focused.push('f') }) };
    const set = (n: number) => ({ querySelectorAll: () => Array.from({ length: n }, () => row) });
    expect(focusAddedRow(set(3), 2)).toBe(true);
    expect(focusAddedRow(set(2), 2)).toBe(false);
    expect(focused).toHaveLength(1);
  });

  it('leaves a frame behind in the history unless it is the example or the new one', () => {
    const calls: string[] = [];
    const hooks = { take: (c: string) => calls.push(`take:${c.slice(0, 3)}`), push: () => calls.push('push') };
    const example = encodeFrame(base);
    expect(leaveBehind(base, tpl('gable'), example, hooks)).toBe(false);
    expect(leaveBehind(tpl('gable'), base, example, hooks)).toBe(true);
    expect(leaveBehind(tpl('gable'), tpl('gable'), example, hooks)).toBe(false);
    expect(calls).toHaveLength(2);
  });

  it('orders the tables by the largest moment, shear or axial force, the number breaking ties', () => {
    const r = analyseSafely(base).results!;
    expect(sortMembers(r.members, 'member').map((m) => m.label)).toEqual([1, 2, 3]);
    expect(sortMembers(r.members, 'M').map((m) => m.label)).toEqual([2, 3, 1]);
    expect(sortMembers(r.members, 'N').map((m) => m.label)[0]).toBe(2);
    expect(largerExtreme({ value: 2 }, { value: -3 })).toEqual({ value: -3 });
    expect(largerExtreme({ value: 0 }, { value: 0 })).toBeNull();
    expect(largerExtreme(null, null)).toBeNull();
  });

  it('says where on a member in the member’s own words', () => {
    const line = { i: 3, j: 4, length: 20 };
    const how = { num: (v: number) => String(v), length: 'ft' };
    expect(whereText(line, 0, frameUi.en, how)).toBe('at node 3');
    expect(whereText(line, 20, frameUi.en, how)).toBe('at node 4');
    expect(whereText(line, 8.44, frameUi.es, how)).toBe('a 8.44 ft del nudo 3');
  });

  it('rings the nodes a problem is about', () => {
    expect(flaggedNodes(analyseSafely(reduceFrame(base, { type: 'add', list: 'nodes' })))).toEqual([5]);
    expect(flaggedNodes(analyseSafely(base))).toEqual([]);
  });
});

describe('the reading sentence is true in every case', () => {
  const how = { num: (v: number, sig = 4) => String(Number(v.toPrecision(sig))).replace('-', '−'), val: (v: number, sig = 4) => signed(String(Number(Math.abs(v).toPrecision(sig))), v), length: 'ft' };
  const say = (f: FrameForm, mode: 'none' | 'M' | 'V' | 'N' | 'deformed', lang: Lang = 'en') => readingSentence(analyseSafely(f), mode, frameUi[lang], how);
  it('gives each diagram’s largest value, with its member and place', () => {
    expect(say(base, 'V')).toContain('The largest shear force is −13.87 kip, in member 3, at node 4.');
    expect(say(base, 'N')).toContain('The largest axial force is −13.87 kip, in member 2, at node 2.');
    expect(say(base, 'deformed')).toContain('The largest displacement of a node is 0.09287 in, at node 3.');
    expect(say(base, 'deformed')).toContain('100 times larger');
    expect(say(base, 'none')).toContain('Choose a diagram above');
  });
  it('says so when a diagram is empty, or there are no sections, or nothing moves', () => {
    const none = { ...base, loads: [], memberLoads: [] };
    for (const m of ['M', 'V', 'N'] as const) expect(say(none, m)).toContain('anywhere under these loads, so the diagram is empty');
    expect(say(none, 'deformed')).toContain('nothing moves');
    const bare = analyseSafely({ ...reduceFrame(base, { type: 'template', template: 'gable', params: { hinge: true, base: 'pinned' } }), A: null, I: null, E: null });
    expect(bare.results).not.toBeNull();
    expect(bare.results!.displacements).toBeNull();
    expect(readingSentence(bare, 'deformed', frameUi.en, how)).toContain('no section');
  });
  it('is Spanish where the page is', () => {
    expect(say(base, 'V', 'es')).toContain('La mayor fuerza cortante es −13.87 kip, en la barra 3, en el nudo 4.');
  });
});

describe('a full-size frame, and the typing it must stay responsive under', () => {
  const full = reduceFrame(base, { type: 'template', template: 'portal', params: { bays: 6, storeys: 6 } });
  it('renders 49 nodes and 78 members, and solves them in a moment', () => {
    expect(full.nodes).toHaveLength(49);
    const t0 = performance.now();
    const a = analyseSafely(full);
    expect(a.results).not.toBeNull();
    expect(performance.now() - t0).toBeLessThan(1000);
    const t1 = performance.now();
    const html = show('en', full);
    expect(performance.now() - t1).toBeLessThan(5000);
    expect(text(html)).not.toMatch(noise);
    expect(cardsOf(html).of('Member end forces')).not.toBe('');
  });
});

describe('the words around the tool', () => {
  const leaves = (value: unknown, path = ''): [string, string][] => {
    if (typeof value === 'string') return [[path, value]];
    if (value && typeof value === 'object') return Object.entries(value).flatMap(([k, v]) => leaves(v, path ? `${path}.${k}` : k));
    return [];
  };
  it('has every key in both languages, none empty but the one that is', () => {
    const en = leaves(frameUi.en).map(([p]) => p).sort();
    const es = leaves(frameUi.es).map(([p]) => p).sort();
    expect(es).toEqual(en);
    for (const lang of LANGS) for (const [p, s] of leaves(frameUi[lang])) if (p !== 'results.reading.empty') expect(s.length, `${lang} ${p}`).toBeGreaterThan(0);
  });
  it('says “frame” (“pórtico”), never “truss” or “cable”, and “beam” only as a template’s name, in what it borrows and in what it prints', () => {
    const bad = { en: /\b(beams?|trusses|truss|cables?)\b/i, es: /\b(vigas?|cerchas?|cables?)\b/i };
    for (const lang of LANGS) {
      for (const [p, s] of leaves(sharedWords(beamStrings[lang].ui))) expect(s, `${lang} ${p}`).not.toMatch(bad[lang]);
      for (const [p, s] of leaves(frameUi[lang])) if (!p.startsWith('template.names') && !p.startsWith('template.note') && !p.startsWith('memberLoads.note')) expect(s, `${lang} ${p}`).not.toMatch(bad[lang]);
    }
  });
  it('hands over exactly the shared pieces', () => {
    for (const lang of LANGS) {
      const shared = sharedWords(beamStrings[lang].ui);
      expect(Object.keys(shared).sort()).toEqual(['numbers', 'results', 'row', 'section', 'sheet', 'supports', 'toolbar']);
      expect(JSON.stringify(shared).length).toBeLessThan(JSON.stringify(beamStrings[lang].ui).length / 3);
    }
  });
  it('writes the Spanish structural words the owner asked for, with the true minus', () => {
    const es = JSON.stringify(frameUi.es).toLowerCase();
    for (const word of ['pórtico', 'nudo', 'barra', 'rótula', 'momento flector', 'fuerza cortante', 'fuerza axial', 'reacciones', 'deformada', 'asentamiento', 'resorte', 'tracción', 'compresión']) expect(es, word).toContain(word);
    expect(text(show('es'))).toContain('−50.44');
  });
});
