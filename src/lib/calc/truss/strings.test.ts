import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { beamStrings } from '../beam/strings';
import { TEMPLATE_IDS } from './templates';
import { sharedWords, trussUi, type TrussUi } from './strings';

/**
 * THE TRUSS CALCULATOR'S WORDS (strings.ts): complete in both languages, the
 * same shape in both, a sentence for every code the library can report, and
 * none of the words this calculator does not say.
 *
 * What the sentences print is held with the tool that prints them
 * (components/ttc/calc/truss/truss-calculator.test.ts).
 */

const LANGS = ['en', 'es'] as const;
const read = (file: string) => readFileSync(join(__dirname, file), 'utf8');

function leaves(value: unknown, path = ''): [string, string][] {
  if (typeof value === 'string') return [[path, value]];
  if (value && typeof value === 'object') return Object.entries(value).flatMap(([k, v]) => leaves(v, path ? `${path}.${k}` : k));
  return [];
}
/** The names of the holes in a sentence: `{count}` and `{count|motion|motions}` both name `count`. */
const holes = (s: string) => [...new Set([...s.matchAll(/\{(\w+)(?:\|[^|}]*\|[^|}]*)?\}/g)].map((m) => m[1]))].sort();
/** The members of a union written `'a' | 'b' | 'c'` in a source, after `export type Name =`. */
const unionOf = (source: string, name: string): string[] => {
  const body = source.match(new RegExp(`export type ${name} =([^;]*);`))?.[1] ?? '';
  return [...body.matchAll(/'([\w-]+)'/g)].map((m) => m[1]);
};

describe('the same words in both languages', () => {
  it('has the same keys in English and in Spanish, all the way down', () => {
    expect(leaves(trussUi.es).map(([p]) => p)).toEqual(leaves(trussUi.en).map(([p]) => p));
  });

  it('leaves no sentence empty, untrimmed, doubled in its spaces or unfinished', () => {
    for (const lang of LANGS) {
      for (const [path, s] of leaves(trussUi[lang])) {
        expect(s.trim(), `${lang} ${path}`).toBe(s);
        expect(s, `${lang} ${path}`).not.toBe('');
        expect(s, `${lang} ${path}`).not.toMatch(/ {2}|\bTODO\b|\bFIXME\b|lorem ipsum|\bundefined\b|\[object|\bNaN\b/);
      }
    }
  });

  it('puts the same holes in the same sentence, whichever the language', () => {
    const es = new Map(leaves(trussUi.es));
    for (const [path, s] of leaves(trussUi.en)) expect(holes(es.get(path)!), path).toEqual(holes(s));
  });

  it('closes every brace it opens', () => {
    for (const lang of LANGS) for (const [path, s] of leaves(trussUi[lang])) expect((s.match(/\{/g) ?? []).length, `${lang} ${path}`).toBe((s.match(/\}/g) ?? []).length);
  });

  it('writes Spanish in Spanish: the words of the domain are the ones a civil engineer uses', () => {
    const english = /\b(the|and|with|this|truss|node|nodes|member|members|support|supports|load|loads|span|depth|panels|template|force|tension|compression|reaction)\b/i;
    for (const [path, s] of leaves(trussUi.es)) {
      // Names that are the same in both languages.
      if (/^template\.names\./.test(path) || path === 'toolbar.si') continue;
      expect(s.replace(/\{[^}]*\}/g, ''), `es ${path}`).not.toMatch(english);
      expect(s, `es ${path}`).not.toMatch(/\b(armadura|armaduras|miembro|miembros|nodo|nodos|soporte|soportes|elemento|elementos|fuerza axial)\b/i);
    }
    const all = leaves(trussUi.es).map(([, s]) => s).join(' ');
    for (const word of ['cercha', 'barra', 'nudo', 'apoyo', 'rodillo', 'reacción', 'tensión', 'compresión', 'articulado']) expect(all.toLowerCase(), word).toContain(word);
  });

  it('writes English as the other calculators do: tension and compression, pin and roller', () => {
    const all = leaves(trussUi.en).map(([, s]) => s).join(' ').toLowerCase();
    for (const word of ['truss', 'member', 'node', 'tension', 'compression', 'pin', 'roller', 'reaction', 'span', 'depth']) expect(all, word).toContain(word);
  });
});

describe('a sentence for every code the library can report', () => {
  const types = read('types.ts');
  const analysis = read('analysis.ts');
  const templates = read('templates.ts');

  it('has a line for every problem types.ts lists, and for the three analysis.ts adds', () => {
    const codes = [...unionOf(types, 'TrussIssueCode'), 'duplicate-nodes', 'scale', 'stopped'];
    expect(codes.length).toBe(23);
    expect(unionOf(analysis, 'AnalysisIssueCode')).toEqual(['duplicate-nodes', 'scale', 'stopped']); // written TrussIssueCode | …: the union above plus those
    for (const lang of LANGS) expect(Object.keys(trussUi[lang].issues).sort()).toEqual([...codes].sort());
  });

  it('has a line for every warning, every rule of the zero members and every kind of change a template makes', () => {
    for (const lang of LANGS) {
      expect(Object.keys(trussUi[lang].warnings).sort()).toEqual(unionOf(types, 'TrussWarningCode').sort());
      expect(Object.keys(trussUi[lang].results.zero.rule).sort()).toEqual(unionOf(types, 'ZeroRule').sort());
      expect(Object.keys(trussUi[lang].template.clamped).sort()).toEqual(['height', 'load', 'panels', 'span', 'supports']);
      expect(Object.keys(trussUi[lang].template.layouts).sort()).toEqual(unionOf(templates, 'SupportLayout').sort());
      expect(Object.keys(trussUi[lang].template.names)).toEqual([...TEMPLATE_IDS]);
      expect(Object.keys(trussUi[lang].results.determinacy).sort()).toEqual(['determinate', 'formula', 'indeterminate', 'legend', 'unstable']);
    }
  });

  it('puts into each sentence the numbers its code carries', () => {
    const needs: Record<string, string[]> = {
      'few-nodes': ['count'],
      'too-big': ['count', 'list', 'max'],
      number: ['field'],
      section: ['field'],
      'duplicate-node': ['a', 'b'],
      'duplicate-nodes': ['list'],
      scale: ['a', 'b', 'distance', 'size', 'unit'],
      'duplicate-member': ['a', 'b'],
      'node-unconnected': ['a'],
      'duplicate-support': ['a'],
      disconnected: ['groups'],
      'few-supports': ['count'],
      mechanism: ['nodes'],
      unrestrained: ['count'],
    };
    for (const lang of LANGS) {
      for (const [code, sentence] of Object.entries(trussUi[lang].issues)) expect(holes(sentence), `${lang} ${code}`).toEqual((needs[code] ?? []).sort());
    }
    // The codes whose sentence says how many have it singular and plural.
    for (const lang of LANGS) {
      for (const code of ['few-supports', 'unrestrained']) expect(trussUi[lang].issues[code as keyof TrussUi['issues']], `${lang} ${code}`).toMatch(/\{count\|[^|}]+\|[^|}]+\}/);
    }
  });

  it('says in the sentence of a mechanism what to do about it, and which nodes', () => {
    expect(trussUi.en.issues.mechanism).toMatch(/\{nodes\}.*(Add a member or a support)/);
    expect(trussUi.es.issues.mechanism).toMatch(/\{nodes\}.*(Añada una barra o un apoyo)/);
  });

  it('gives each unit system its own words for the units line', () => {
    expect(trussUi.en.toolbar).toMatchObject({ us: 'US (ft, kip)', si: 'SI (m, kN)' });
    expect(trussUi.es.toolbar).toMatchObject({ us: 'EE. UU. (ft, kip)', si: 'SI (m, kN)' });
  });
});

describe('what this calculator does not say', () => {
  const everything = LANGS.flatMap((lang) => leaves(trussUi[lang]).map(([path, s]) => [`${lang} ${path}`, s] as const));

  it('names no standard, no program, no vendor', () => {
    const named = /\b(AISC|ASCE|ACI|AASHTO|NDS|IBC|Eurocode|EN ?1993|LRFD|ASD|SkyCiv|Revit|SAP ?2000|RISA|STAAD|ETABS|Autodesk|Bentley|Tekla|Robot|Excel)\b/i;
    for (const [path, s] of everything) expect(s, path).not.toMatch(named);
  });

  it('gives no verdict, no factor and no design check', () => {
    const verdict = /\b(safe|unsafe|adequate|inadequate|passes|pass|fails|fail|satisf(?:y|ies)|complies|compliant|code[- ]check|factor of safety|safety factor|capacity of|allowable|permissible|cumple|seguro|insegura?|adecuad[oa]|aprobad[oa]|falla|factor de seguridad|admisible)\b/i;
    for (const [path, s] of everything) {
      // The sentence that says there is no check is the one that names the things there is none of.
      if (/\.(stressNote)$/.test(path)) continue;
      expect(s, path).not.toMatch(verdict);
    }
    expect(trussUi.en.results.forces.stressNote).toContain('not a check');
    expect(trussUi.en.results.forces.stressNote).toContain('no capacity, no buckling, no factors');
    expect(trussUi.es.results.forces.stressNote).toContain('No es una verificación');
    expect(trussUi.es.results.forces.stressNote).toContain('ni capacidad, ni pandeo, ni factores');
  });

  it('never says “beam” or “viga”, in its own words or in the ones it borrows', () => {
    const beam = { en: /\bbeams?\b/i, es: /\bvigas?\b/i };
    for (const lang of LANGS) {
      for (const [path, s] of [...leaves(trussUi[lang]), ...leaves(sharedWords(beamStrings[lang].ui))]) expect(s, `${lang} ${path}`).not.toMatch(beam[lang]);
    }
  });

  it('leaves the page’s own text — its hero, its notes — to the page', () => {
    // The words of a page are page-strings.ts's: nothing here is a heading of the page or a paragraph of its notes.
    const keys = leaves(trussUi.en).map(([p]) => p.split('.')[0]);
    for (const page of ['hero', 'notes', 'assumes', 'method', 'faq', 'meta', 'title']) expect(keys).not.toContain(page);
  });
});

describe('what it borrows of the first calculator', () => {
  it('is a small part of it, every piece the same as the first calculator’s', () => {
    for (const lang of LANGS) {
      const ui = beamStrings[lang].ui;
      const shared = sharedWords(ui);
      expect(shared.numbers).toBe(ui.numbers);
      expect(shared.section.title).toBe(ui.section.title);
      expect(shared.section.materials).toEqual({ steel: ui.section.materials.steel, aluminum: ui.section.materials.aluminum, custom: ui.section.materials.custom });
      expect(shared.results.reactions).toBe(ui.results.reactions);
      expect(shared.results.privacy).toBe(ui.results.privacy);
      expect(shared.row).toEqual({ remove: ui.row.remove });
      expect(shared.toolbar.reset).toBe(ui.toolbar.reset);
      // Nothing of it says what only a beam says.
      expect(Object.keys(shared.toolbar).sort()).toEqual(['copied', 'copyFailed', 'print', 'reset', 'units']);
    }
  });
});

describe('the link', () => {
  it('has a line while the page opens a truss from its address, and one for a link that cannot be read, that say “truss”', () => {
    expect(trussUi.en.linkOpening).toMatch(/\btruss\b/);
    expect(trussUi.es.linkOpening).toMatch(/\bcercha\b/);
    expect(trussUi.en.linkError).toMatch(/\btruss\b/);
    expect(trussUi.es.linkError).toMatch(/\bcercha\b/);
    for (const lang of LANGS) expect(trussUi[lang].sheet.link).toContain('{url}');
  });
});
