import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { beamStrings } from '../beam/strings';
import { CABLE_MATERIALS, MATERIAL_IDS } from './model';
import { cableSagUi, sharedWords, type CableSagUi } from './strings';

/**
 * THE CABLE CALCULATOR'S WORDS (strings.ts): complete in both languages, the same shape in both, a sentence for
 * every code the library can report, and none of the words this calculator does not say.
 *
 * What the sentences print is held with the tool that prints them
 * (components/ttc/calc/cable-sag/cable-sag-calculator.test.ts).
 */

const LANGS = ['en', 'es'] as const;
const read = (file: string) => readFileSync(join(__dirname, file), 'utf8').replace(/\r\n/g, '\n');

function leaves(value: unknown, path = ''): [string, string][] {
  if (typeof value === 'string') return [[path, value]];
  if (value && typeof value === 'object') return Object.entries(value).flatMap(([k, v]) => leaves(v, path ? `${path}.${k}` : k));
  return [];
}
/** The names of the holes in a sentence: `{count}` and `{count|load|loads}` both name `count`. */
const holes = (s: string) => [...new Set([...s.matchAll(/\{(\w+)(?:\|[^|}]*\|[^|}]*)?\}/g)].map((m) => m[1]))].sort();
/** The members of a union written `'a' | 'b' | 'c'` in a source, after `export type Name =`. */
const unionOf = (source: string, name: string): string[] => {
  const body = source.match(new RegExp(`export type ${name} =([^;]*);`))?.[1] ?? '';
  return [...body.matchAll(/'([\w-]+)'/g)].map((m) => m[1]);
};

describe('the same words in both languages', () => {
  it('has the same keys in English and in Spanish, all the way down', () => {
    expect(leaves(cableSagUi.es).map(([p]) => p)).toEqual(leaves(cableSagUi.en).map(([p]) => p));
  });

  it('leaves no sentence empty, untrimmed, doubled in its spaces or unfinished', () => {
    for (const lang of LANGS) {
      for (const [path, s] of leaves(cableSagUi[lang])) {
        expect(s.trim(), `${lang} ${path}`).toBe(s);
        expect(s, `${lang} ${path}`).not.toBe('');
        expect(s, `${lang} ${path}`).not.toMatch(/ {2}|\bTODO\b|\bFIXME\b|lorem ipsum|\bundefined\b|\[object|\bNaN\b/);
      }
    }
  });

  it('puts the same holes in the same sentence, whichever the language', () => {
    const es = new Map(leaves(cableSagUi.es));
    for (const [path, s] of leaves(cableSagUi.en)) expect(holes(es.get(path)!), path).toEqual(holes(s));
  });

  it('closes every brace it opens', () => {
    for (const lang of LANGS) for (const [path, s] of leaves(cableSagUi[lang])) expect((s.match(/\{/g) ?? []).length, `${lang} ${path}`).toBe((s.match(/\}/g) ?? []).length);
  });

  it('writes Spanish in Spanish: the words of the domain are the ones a civil engineer uses', () => {
    const english = /\b(the|and|with|this|sag|span|load|loads|support|supports|tension|length|point|table|state|ice|results?)\b/i;
    for (const [path, s] of leaves(cableSagUi.es)) {
      if (path === 'toolbar.si') continue;
      expect(s.replace(/\{[^}]*\}/g, ''), `es ${path}`).not.toMatch(english);
      // “luz” is the span, as on the other calculators; “vano” is not said beside it.
      expect(s, `es ${path}`).not.toMatch(/\b(vano|vanos|soporte|soportes|armadura|nodo|nodos)\b/i);
    }
    const all = leaves(cableSagUi.es).map(([, s]) => s).join(' ').toLowerCase();
    for (const word of ['cable', 'flecha', 'pretensión', 'tensión horizontal', 'catenaria', 'parábola', 'cambio de estado', 'luz', 'apoyo', 'cargas puntuales', 'polígono funicular']) expect(all, word).toContain(word);
  });

  it('writes English as the other calculators do: span, sag, pretension, catenary', () => {
    const all = leaves(cableSagUi.en).map(([, s]) => s).join(' ').toLowerCase();
    for (const word of ['cable', 'sag', 'pretension', 'horizontal tension', 'catenary', 'parabola', 'change of state', 'span', 'support', 'point loads', 'funicular polygon']) expect(all, word).toContain(word);
  });

  it('names the three modes and the two units as the catalogue does', () => {
    expect(cableSagUi.en.mode.names).toEqual({ hanging: 'Hanging cable', state: 'Change of state', points: 'Cable with point loads' });
    expect(cableSagUi.es.mode.names).toEqual({ hanging: 'Cable colgante', state: 'Cambio de estado', points: 'Cable con cargas puntuales' });
    expect(cableSagUi.en.toolbar).toMatchObject({ us: 'US (ft, kip)', si: 'SI (m, kN)' });
    expect(cableSagUi.es.toolbar).toMatchObject({ us: 'EE. UU. (ft, kip)', si: 'SI (m, kN)' });
  });
});

describe('a sentence for every code the library can report', () => {
  const types = read('types.ts');
  const analysis = read('analysis.ts');

  it('has a line for every problem types.ts lists, and for the one analysis.ts adds', () => {
    const codes = [...unionOf(types, 'CableIssueCode'), 'stopped'];
    expect(codes.length).toBe(22);
    expect(analysis).toContain("export type AnalysisIssueCode = CableIssueCode | 'stopped';");
    for (const lang of LANGS) expect(Object.keys(cableSagUi[lang].issues).sort()).toEqual([...codes].sort());
  });

  it('has a line for every warning', () => {
    for (const lang of LANGS) expect(Object.keys(cableSagUi[lang].warnings).sort()).toEqual(unionOf(types, 'CableWarningCode').sort());
  });

  it('has a line for every code a table row can carry, and one for the rest', () => {
    // Read off solveState's rows: 'thermal', 'number', 'state2-load-zero', and whatever the solve itself returns.
    for (const lang of LANGS) {
      const rows = Object.keys(cableSagUi[lang].tables.rowCodes).sort();
      expect(rows).toEqual(['number', 'other', 'size', 'solver', 'state2-load-zero', 'state2-too-short', 'thermal']);
    }
  });

  it('has a name for every field a problem is tied to, every material, every known and every legend key', () => {
    const model = read('model.ts');
    const form = [...(model.match(/export type FormField =([\s\S]*?);\n/)?.[1] ?? '').matchAll(/'([\w.]+)'/g)].map((m) => m[1]);
    expect(form.length).toBe(14);
    const renamed: Record<string, string> = { 'state.q': 'stateQ', 'state.ice': 'stateIce', 'state.T': 'stateT', 'table.thermal': 'tableThermal', 'table.loads': 'tableLoads' };
    const mapped = form.map((f) => renamed[f] ?? f);
    for (const lang of LANGS) {
      const words = cableSagUi[lang];
      for (const key of [...mapped, 'point', 'other']) expect(Object.keys(words.fields), key).toContain(key);
      expect(Object.keys(words.section.materials).sort()).toEqual([...MATERIAL_IDS].sort());
      expect(Object.keys(words.known.kinds)).toEqual(['sag-mid', 'sag-low', 'H', 'T-high', 'T-low', 'length']);
      expect(Object.keys(words.known.notes)).toEqual(Object.keys(words.known.kinds));
      expect(Object.keys(words.points.known.kinds)).toEqual(['sag', 'H', 'T-max']);
      expect(Object.keys(words.results.drawing.families)).toEqual(['parabola', 'catenary', 'combined']);
      for (const key of ['cable', 'parabola', 'chord', 'sagMid', 'sagLow', 'sagBoth', 'sagAt', 'load', 'tension', 'H', 'state1', 'state2', 'polygon', 'pointLoad', 'joint', 'support']) expect(Object.keys(words.results.legend), key).toContain(key);
    }
  });

  it('puts into each sentence the numbers its code carries, and no other', () => {
    const needs: Record<string, string[]> = {
      number: ['field'],
      rise: ['max', 'ratio'],
      section: ['field'],
      'sag-range': ['max', 'min', 'ratio'],
      'length-below-chord': ['chord', 'length', 'unit'],
      'tension-below-minimum': ['force', 'min', 'value'],
      'state2-load-zero': ['chord', 'unit'],
      'state2-too-short': ['chord', 'length', 'unit'],
      table: ['count', 'max', 'which'],
      'too-many-loads': ['count', 'max'],
      'load-position': ['span', 'unit', 'value'],
      'duplicate-position': ['a', 'b'],
      'sag-position': ['span', 'unit', 'value'],
      'negative-tension': ['force', 'value'],
    };
    for (const lang of LANGS) {
      for (const [code, sentence] of Object.entries(cableSagUi[lang].issues)) expect(holes(sentence), `${lang} ${code}`).toEqual((needs[code] ?? []).sort());
    }
    const warns: Record<string, string[]> = {
      'parabola-differs': ['difference', 'ratio', 'tolerance'],
      'strain-high': ['strain'],
      'vertex-outside': ['unit', 'x'],
      'tension-two-roots': ['force', 'value'],
      'upward-load': ['count'],
      'zero-load': ['count'],
      'sag-not-at-load': ['unit', 'value'],
    };
    for (const lang of LANGS) {
      for (const [code, sentence] of Object.entries(cableSagUi[lang].warnings)) expect(holes(sentence), `${lang} ${code}`).toEqual((warns[code] ?? []).sort());
    }
    // The codes whose sentence says how many have it singular and plural.
    for (const lang of LANGS) for (const code of ['upward-load', 'zero-load'] as const) expect(cableSagUi[lang].warnings[code], `${lang} ${code}`).toMatch(/\{count\|[^|}]+\|[^|}]+\}/);
  });

  it('says in the sentence what to do about the problem, where there is something to do', () => {
    expect(cableSagUi.en.issues['load-position']).toContain('Move the load between the supports');
    expect(cableSagUi.es.issues['load-position']).toContain('Ponga la carga entre los apoyos');
    expect(cableSagUi.en.issues['tension-below-minimum']).toContain('Give a larger one');
    expect(cableSagUi.en.issues['state2-too-short']).toContain('Let it stretch');
    expect(cableSagUi.en.issues['length-below-chord']).toContain('{chord}');
  });
});

describe('what this calculator does not say', () => {
  const everything = LANGS.flatMap((lang) => leaves(cableSagUi[lang]).map(([path, s]) => [`${lang} ${path}`, s] as const));

  it('names no standard, no program, no vendor', () => {
    const named = /\b(AISC|ASCE|ACI|AASHTO|NDS|IBC|Eurocode|EN ?1993|LRFD|ASD|SkyCiv|Revit|SAP ?2000|RISA|STAAD|ETABS|Autodesk|Bentley|Tekla|Robot|Excel|Bridon|Pfeifer|Redaelli|Gustav|WRTL|ASTM|ISO|PCI|ADM)\b/i;
    for (const [path, s] of everything) expect(s, path).not.toMatch(named);
  });

  it('gives no verdict, no factor and no design check, except to say that there is none', () => {
    const verdict = /\b(safe|unsafe|adequate|inadequate|passes|pass|fails|fail|satisf(?:y|ies)|complies|compliant|code[- ]check|factor of safety|safety factor|capacity of|allowable|permissible|cumple|seguro|insegura?|adecuad[oa]|aprobad[oa]|falla|factor de seguridad|admisible)\b/i;
    for (const [path, s] of everything) {
      // The sentence that says there is no check is the one that names the things there is none of.
      if (path.endsWith('results.note')) continue;
      expect(s, path).not.toMatch(verdict);
      expect(s, path).not.toMatch(/\b(design check|breaking load|capacity|carga de rotura|capacidad)\b/i);
    }
    expect(cableSagUi.en.results.note).toContain('not a verdict');
    expect(cableSagUi.en.results.note).toContain('no capacity, breaking load or factor is used');
    expect(cableSagUi.en.results.note).toContain('Material values are typical');
    expect(cableSagUi.es.results.note).toContain('no un dictamen');
    expect(cableSagUi.es.results.note).toContain('no se usa ninguna capacidad, carga de rotura ni factor');
    expect(cableSagUi.es.results.note).toContain('Los valores de los materiales son típicos');
  });

  it('says that the values are typical and the maker’s should be used, and that a rope’s modulus is well below steel’s', () => {
    expect(cableSagUi.en.section.typical).toMatch(/typical.*maker’s/);
    expect(cableSagUi.es.section.typical).toMatch(/típicos.*fabricante/);
    expect(cableSagUi.en.section.ropeNote).toContain('well below steel’s');
    expect(cableSagUi.es.section.ropeNote).toContain('muy por debajo del del acero');
  });

  it('never says “beam” or “viga”, in its own words or in the ones it borrows', () => {
    const beam = { en: /\bbeams?\b/i, es: /\bvigas?\b/i };
    for (const lang of LANGS) {
      for (const [path, s] of [...leaves(cableSagUi[lang]), ...leaves(sharedWords(beamStrings[lang].ui))]) expect(s, `${lang} ${path}`).not.toMatch(beam[lang]);
    }
  });

  it('leaves the page’s own text — its hero, its notes — to the page', () => {
    const keys = leaves(cableSagUi.en).map(([p]) => p.split('.')[0]);
    for (const page of ['hero', 'notes', 'assumes', 'method', 'faq', 'meta', 'title']) expect(keys).not.toContain(page);
  });

  it('names each of the eight materials differently', () => {
    expect(Object.keys(CABLE_MATERIALS).length).toBe(7);
    for (const lang of LANGS) expect(new Set(Object.values(cableSagUi[lang].section.materials)).size).toBe(8);
  });
});

describe('what it borrows of the first calculator', () => {
  it('is a small part of it, every piece the same as the first calculator’s', () => {
    for (const lang of LANGS) {
      const ui = beamStrings[lang].ui;
      const shared = sharedWords(ui);
      expect(shared.numbers).toBe(ui.numbers);
      expect(shared.section).toEqual({ title: ui.section.title, optional: ui.section.optional });
      expect(shared.row).toEqual({ remove: ui.row.remove });
      expect(shared.toolbar.reset).toBe(ui.toolbar.reset);
      expect(shared.results.privacy).toBe(ui.results.privacy);
      expect(Object.keys(shared).sort()).toEqual(['numbers', 'results', 'row', 'section', 'sheet', 'toolbar']);
      expect(Object.keys(shared.results).sort()).toEqual(['downward', 'privacy', 'title', 'upward']);
      expect(Object.keys(shared.toolbar).sort()).toEqual(['copied', 'copyFailed', 'print', 'reset', 'units']);
      expect(JSON.stringify(shared).length).toBeLessThan(JSON.stringify(ui).length / 4);
    }
  });
});

describe('the link', () => {
  it('has a line while the page opens a cable from its address, and one for a link that cannot be read, that say “cable”', () => {
    for (const lang of LANGS) {
      expect(cableSagUi[lang].linkOpening).toMatch(/\bcable\b/);
      expect(cableSagUi[lang].linkError).toMatch(/\bcable\b/);
      expect(cableSagUi[lang].sheet.link).toContain('{url}');
    }
    expect(cableSagUi.en.linkOpening).toContain('carries a cable');
    expect(cableSagUi.es.linkOpening).toContain('trae un cable');
  });

  it('is typed as the shape of the English, so that a missing key is a type error and not a hole', () => {
    const typed: CableSagUi = cableSagUi.es;
    expect(typed.issuesTitle).toBeTruthy();
  });
});
