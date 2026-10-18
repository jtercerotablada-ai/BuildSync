import { createElement as h } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { beamStrings } from '@/lib/calc/beam/strings';
import { analyseSafely, type StiffnessAnalysis } from '@/lib/calc/stiffness/analysis';
import { reduceStiffness, type StiffnessForm, type StiffnessList } from '@/lib/calc/stiffness/model';
import { sharedWords, stiffnessUi } from '@/lib/calc/stiffness/strings';
import { StiffnessCalculator } from './StiffnessCalculator';
import { drawingFacts, everyWidth, stiffnessLayout, type Looks } from './layout';
import { formatCell } from './numfmt';
import { build, flat, girder, settling } from './fixtures.testlib';

vi.setConfig({ testTimeout: 240_000 });
afterEach(() => new Promise<void>((done) => setTimeout(done, 0)));

/**
 * THE PAGE IS TOTAL: a number of any size in any field - 1e17, 1e25, 1e308, a number of forty digits, a number the size of a hair. The figure is built
 * for every one, in a bounded time, and the page either solves the structure or says what is wrong with it; the worked solution never prints an
 * "NaN", a "-0" or an e-notation, and a table of numbers like these is still a table.
 */

const HUGE = [1e15, 1e17, 1e25, 1e30, 1e100, 1.7e308, Number('12345678901234567890123456789012345678901234567890'), -1e17, -1e300, 1e-17, 1e-300, 5e-324];
const FEW = [1e17, 1.7e308, Number('12345678901234567890123456789012345678901234567890'), -1e300, 1e-300];
const noise = /NaN|undefined|Infinity|\[object|(?:^|[\s>(=])-0(?![.\d])|−0(?![.\d])|\be[+-]\d|\{[a-zA-Z]+(\|[^}]*)?\}/;

const looksFor = (a: StiffnessAnalysis, over: Partial<Looks> = {}): Looks => ({ loads: true, reactions: a.results !== null, deformed: a.results !== null, dofs: true, nodeNumbers: true, memberNumbers: true, values: true, group: ',', flagged: [], ...over });

/** A portal frame carrying one of every kind of thing a number can be typed into. */
function fieldsForm(): StiffnessForm {
  let f = build({ mode: 'frame', nodes: [[0, 0], [20, 0], [0, 10], [20, 10]], members: [[1, 3], [2, 4], [3, 4]], supports: [[1, 'fixed'], [2, 'pin']], loads: [[3, 10, -4]] });
  f = reduceStiffness(f, { type: 'patch', list: 'loads', id: f.loads[0].id, patch: { m: 3 } });
  f = reduceStiffness(f, { type: 'add', list: 'memberLoads', seed: { member: f.members[2].id, kind: 'udl', w: -1 } });
  f = reduceStiffness(f, { type: 'add', list: 'memberLoads', seed: { member: f.members[2].id, kind: 'point', P: -5, a: 5 } });
  f = reduceStiffness(f, { type: 'add', list: 'memberLoads', seed: { member: f.members[0].id, kind: 'axial', q: 1 } });
  f = reduceStiffness(f, { type: 'patch', list: 'supports', id: f.supports[1].id, patch: { dy: -0.5, dx: 0.1 } });
  f = reduceStiffness(f, { type: 'patch', list: 'supports', id: f.supports[0].id, patch: { dr: 0.001 } });
  return f;
}

type Field = { list: StiffnessList; key: string; row: number } | { section: 'E' | 'A' | 'I' } | { member: 'E' | 'A' | 'I'; row: number };
const FIELDS: Field[] = [
  { list: 'nodes', key: 'x', row: 1 },
  { list: 'nodes', key: 'y', row: 2 },
  { list: 'nodes', key: 'x', row: 3 },
  { list: 'supports', key: 'dx', row: 1 },
  { list: 'supports', key: 'dy', row: 1 },
  { list: 'supports', key: 'dr', row: 0 },
  { list: 'loads', key: 'fx', row: 0 },
  { list: 'loads', key: 'fy', row: 0 },
  { list: 'loads', key: 'm', row: 0 },
  { list: 'memberLoads', key: 'w', row: 0 },
  { list: 'memberLoads', key: 'P', row: 1 },
  { list: 'memberLoads', key: 'a', row: 1 },
  { list: 'memberLoads', key: 'q', row: 2 },
  { section: 'E' },
  { section: 'A' },
  { section: 'I' },
  { member: 'E', row: 0 },
  { member: 'A', row: 1 },
  { member: 'I', row: 2 },
];

function set(form: StiffnessForm, field: Field, value: number): StiffnessForm {
  if ('section' in field) return reduceStiffness(form, { type: 'section', patch: { [field.section]: value } });
  if ('member' in field) return reduceStiffness(form, { type: 'patch', list: 'members', id: form.members[field.row].id, patch: { [field.member]: value } });
  return reduceStiffness(form, { type: 'patch', list: field.list, id: form[field.list][field.row].id, patch: { [field.key]: value } });
}

const show = (form: StiffnessForm, lang: 'en' | 'es' = 'en') => renderToStaticMarkup(h(StiffnessCalculator, { t: sharedWords(beamStrings[lang].ui), w: stiffnessUi[lang], initial: form }));

function figures(a: StiffnessAnalysis, widths = [320, 700]): number {
  const t0 = Date.now();
  for (const width of widths) {
    const looks = looksFor(a);
    const facts = drawingFacts(a.drawing, looks, width);
    const l = stiffnessLayout(a.drawing, { ...looks, width });
    expect(Number.isFinite(l.height), `height ${width}`).toBe(true);
    expect(l.height).toBeLessThan(5000);
    expect(l.placed.length).toBeLessThan(5000);
    for (const m of l.members) for (const v of [m.x1, m.y1, m.x2, m.y2]) expect(Number.isFinite(v)).toBe(true);
    for (const n of l.nodes) for (const v of [n.x, n.y]) expect(Number.isFinite(v)).toBe(true);
    if (facts.every) expect(everyWidth(a.drawing, looks, width).width).toBeLessThanOrEqual(6000);
  }
  return Date.now() - t0;
}

describe('a number of any size in any field', () => {
  it('every numeric field, 1e15 to 1e308, a hair and forty digits: solved or said, and the figure is built in a moment', () => {
    const base = fieldsForm();
    expect(analyseSafely(base).results).not.toBeNull();
    let worst = 0;
    for (const field of FIELDS) {
      for (const value of HUGE) {
        const form = set(base, field, value);
        const a = analyseSafely(form);
        const where = `${JSON.stringify(field)} = ${value}`;
        // Either a solution or at least one thing said about it.
        expect(a.solution !== null || a.issues.length > 0, where).toBe(true);
        const ms = figures(a);
        worst = Math.max(worst, ms);
        expect(ms, where).toBeLessThan(2500);
      }
    }
    expect(worst).toBeLessThan(2500);
  });

  it('the whole page renders for a field of every size, in both languages, with no NaN, no -0 and no e-notation', () => {
    const base = fieldsForm();
    for (const field of FIELDS) {
      for (const value of FEW) {
        const form = set(base, field, value);
        const html = show(form, value === 1e17 ? 'es' : 'en');
        const text = html.replace(/<[^>]+>/g, ' ').replace(/&[a-z#0-9]+;/g, ' ');
        expect(text, `${JSON.stringify(field)} = ${value}`).not.toMatch(noise);
      }
    }
  });

  it('the same in every unit system, and at the largest structure', () => {
    for (const value of FEW) {
      for (const form of [girder('frame'), girder('truss', 'si'), flat(), settling()]) {
        const nodes = form.nodes.map((n, k) => (k === 1 ? { ...n, x: value } : n));
        const bent = { ...form, nodes };
        const a = analyseSafely(bent);
        expect(a.solution !== null || a.issues.length > 0).toBe(true);
        figures(a, [390, 1200]);
      }
    }
  });

  it('a number of forty digits in every numeric field at once is a structure the page says it cannot solve, not a page that fails', () => {
    const wild = Number('12345678901234567890123456789012345678901234567890');
    let f = fieldsForm();
    for (const field of FIELDS) f = set(f, field, wild);
    const a = analyseSafely(f);
    expect(a.solution).toBeNull();
    expect(a.issues.length).toBeGreaterThan(0);
    for (const lang of ['en', 'es'] as const) expect(show(f, lang).replace(/<[^>]+>/g, ' ')).not.toMatch(noise);
  });

  it('writes any finite number in every style without throwing, and a number that cannot be written as a dash', () => {
    for (const style of ['auto', 'fixed', 'scientific'] as const) for (const v of [...HUGE, 0, -0, 1, -1, Number.MAX_VALUE, Number.MIN_VALUE]) expect(formatCell(v, { sig: 5, style, group: ',' }), `${style} ${v}`).not.toMatch(noise);
    expect(formatCell(Number.NaN)).toBe('—');
  });
});
