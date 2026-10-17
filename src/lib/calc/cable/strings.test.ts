import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it, vi } from 'vitest';
import { calculatorFamilies } from '@/lib/ttc/calculators';
import { spanPage } from '../beam/span-page-strings';
import { spanUi } from '../beam/span-strings';
import { beamStrings } from '../beam/strings';
import { continuousPage } from '../continuous/page-strings';
import { continuousUi } from '../continuous/strings';
import { shaftPage } from '../shaft/page-strings';
import { shaftUi } from '../shaft/strings';
import { trussPage } from '../truss/page-strings';
import { trussUi } from '../truss/strings';
import { ROPE_IDS, MATERIAL_IDS, MODES } from './types';
import { cableUi, sharedWords, type CableUi } from './strings';

// Heavy by design (the other calculators' words, six words at a time): a loaded machine runs a full suite past the 5 s default.
vi.setConfig({ testTimeout: 120_000 });

/**
 * THE CABLE CALCULATOR'S WORDS (strings.ts): complete in both languages, the
 * same shape in both, a sentence for every code the library can report, one
 * home for each text of the site, and none of the words this calculator does
 * not say.
 *
 * What the sentences print is held with the tool that prints them
 * (components/ttc/calc/cable/cable-calculator.test.ts, text.test.ts).
 */

const LANGS = ['en', 'es'] as const;
const read = (file: string) => readFileSync(join(__dirname, file), 'utf8').replace(/\r\n/g, '\n');

function leaves(value: unknown, path = ''): [string, string][] {
  if (typeof value === 'string') return [[path, value]];
  if (value && typeof value === 'object') return Object.entries(value).flatMap(([k, v]) => leaves(v, path ? `${path}.${k}` : k));
  return [];
}
/** The names of the holes in a sentence: `{count}` and `{count|way|ways}` both name `count`. */
const holes = (s: string) => [...new Set([...s.matchAll(/\{(\w+)(?:\|[^|}]*\|[^|}]*)?\}/g)].map((m) => m[1]))].sort();
/** The members of a union written `'a' | 'b'` in a source, after `export type Name =`. */
const unionOf = (source: string, name: string): string[] => {
  const body = source.match(new RegExp(`export type ${name} =([^;]*);`))?.[1] ?? '';
  return [...body.matchAll(/'([\w-]+)'/g)].map((m) => m[1]);
};

describe('the same words in both languages', () => {
  it('has the same keys in English and in Spanish, all the way down', () => {
    expect(leaves(cableUi.es).map(([p]) => p)).toEqual(leaves(cableUi.en).map(([p]) => p));
  });

  it('leaves no sentence empty, untrimmed, doubled in its spaces or unfinished', () => {
    for (const lang of LANGS) {
      for (const [path, s] of leaves(cableUi[lang])) {
        expect(s.trim(), `${lang} ${path}`).toBe(s);
        expect(s, `${lang} ${path}`).not.toBe('');
        expect(s, `${lang} ${path}`).not.toMatch(/ {2}|\bTODO\b|\bFIXME\b|lorem ipsum|\bundefined\b|\[object|\bNaN\b/);
      }
    }
  });

  it('puts the same holes in the same sentence, whichever the language', () => {
    const es = new Map(leaves(cableUi.es));
    for (const [path, s] of leaves(cableUi.en)) expect(holes(es.get(path)!), path).toEqual(holes(s));
  });

  it('closes every brace it opens', () => {
    for (const lang of LANGS) for (const [path, s] of leaves(cableUi[lang])) expect((s.match(/\{/g) ?? []).length, `${lang} ${path}`).toBe((s.match(/\}/g) ?? []).length);
  });

  it('writes Spanish in Spanish: the words of the domain are the ones an engineer in Latin America uses', () => {
    const english = /\b(the|and|with|this|from|than|when|which|that|are|is|it|its|an|of|for|your|you|to)\b/i;
    for (const [path, s] of leaves(cableUi.es)) {
      // The rope that keeps its English name beside the Spanish one.
      if (path === 'section.ropes.locked') continue;
      expect(s.replace(/\{[^}]*\}/g, ''), `es ${path}`).not.toMatch(english);
      expect(s.replace(/\{[^}]*\}/g, ''), `es ${path}`).not.toMatch(/\b(rozamiento|roce|stress|strain|elongaci[óo]n|polea de cable|winche|torque)\b/i);
    }
    const all = leaves(cableUi.es).map(([, s]) => s).join(' ').toLowerCase();
    for (const word of ['cable', 'eslinga', 'tensión', 'esfuerzo', 'alargamiento', 'deformación unitaria', 'carga de rotura mínima', 'fricción', 'tambor', 'cabrestante', 'ángulo de envolvimiento']) expect(all, word).toContain(word);
  });

  it('writes English as the other calculators do', () => {
    const all = leaves(cableUi.en).map(([, s]) => s).join(' ').toLowerCase();
    for (const word of ['cable', 'sling', 'tension', 'stress', 'strain', 'stretch', 'minimum breaking force', 'friction', 'drum', 'wrap']) expect(all, word).toContain(word);
  });

  it('uses one word for friction in Spanish and one for stress, and keeps tension and stress apart', () => {
    const es = leaves(cableUi.es).map(([, s]) => s).join(' ');
    expect(es).toMatch(/fricción/);
    expect(es).not.toMatch(/rozamiento/i);
    expect(cableUi.es.results.legs.stress).toBe('Esfuerzo, σ');
    expect(cableUi.es.results.legs.tension).toBe('Tensión, T');
  });
});

describe('a sentence for every code the library can report', () => {
  const types = read('types.ts');
  const analysis = read('analysis.ts');

  it('has a line for every problem the library lists, and for the one analysis.ts adds', () => {
    const codes = [...new Set([...unionOf(types, 'LoadIssueCode'), ...unionOf(types, 'PullIssueCode'), ...unionOf(types, 'DrumIssueCode'), 'stopped'])];
    expect(analysis).toContain("| 'stopped'");
    for (const lang of LANGS) expect(Object.keys(cableUi[lang].issues).sort()).toEqual([...codes].sort());
  });

  it('has a line for every warning the library lists', () => {
    const codes = [...unionOf(types, 'LoadWarningCode'), ...unionOf(types, 'PullWarningCode'), 'no-friction', 'no-wrap'];
    for (const lang of LANGS) expect(Object.keys(cableUi[lang].warnings).sort()).toEqual([...codes].sort());
  });

  it('has a status word and a sentence for every state of a pull', () => {
    const statuses = unionOf(types, 'PullStatus');
    expect(statuses).toEqual(['pull', 'slides-on-its-own', 'stays-put', 'self-locking', 'leaves-surface']);
    for (const lang of LANGS) {
      expect(Object.keys(cableUi[lang].results.statusWords).sort()).toEqual(['leaves', 'locks', 'pull', 'slides', 'stays']);
      expect(Object.keys(cableUi[lang].results.status).sort()).toEqual(['holds', 'holdsNot', 'leaves', 'leavesAt', 'locks', 'pull', 'slides', 'stays']);
    }
  });

  it('names every field a problem can be about', () => {
    const rows = analysis.slice(analysis.indexOf('export type CableRow ='), analysis.indexOf('export interface AnalysisIssue'));
    const fields = [...new Set([...rows.matchAll(/field: ((?:'\w+'(?: \| )?)+)/g)].flatMap((m) => [...m[1].matchAll(/'(\w+)'/g)].map((x) => x[1])))];
    expect(fields.length).toBeGreaterThan(20);
    for (const lang of LANGS) {
      for (const f of fields) expect(Object.keys(cableUi[lang].fields), `${lang} ${f}`).toContain(f);
      // …and the ones a form shows differently.
      for (const f of ['mass', 'value']) expect(Object.keys(cableUi[lang].fields)).toContain(f);
      expect(Object.keys(cableUi[lang].where).sort()).toEqual(['design', 'dT', 'drum', 'leg1', 'leg2', 'leg2section', 'load', 'pull', 'section'].sort());
    }
  });

  it('puts into each sentence the numbers its code carries', () => {
    const needs: Record<string, string[]> = {
      number: ['field'],
      range: ['bounds', 'field'],
      'parallel-legs': ['between'],
      'slack-leg': ['T', 'leg', 'unit'],
      underdetermined: ['count'],
      order: ['Tbig', 'Tsmall', 'unit'],
      degenerate: ['Tbig', 'Tsmall', 'need', 'unit', 'unknown', 'zero'],
      overflow: ['exponent'],
    };
    for (const lang of LANGS) {
      for (const [code, sentence] of Object.entries(cableUi[lang].issues)) expect(holes(sentence), `${lang} ${code}`).toEqual((needs[code] ?? []).sort());
    }
    const warnNeeds: Record<string, string[]> = { 'restrained-slack': ['leg'], 'large-strain': ['strain'], 'kinetic-above-static': ['muK', 'muS'] };
    for (const lang of LANGS) for (const [code, sentence] of Object.entries(cableUi[lang].warnings)) expect(holes(sentence), `${lang} ${code}`).toEqual((warnNeeds[code] ?? []).sort());
  });

  it('has a line for every bound a range can have', () => {
    for (const lang of LANGS) {
      expect(Object.keys(cableUi[lang].bounds).sort()).toEqual(['above', 'atLeast', 'atMost', 'between', 'other']);
      expect(holes(cableUi[lang].bounds.between)).toEqual(['max', 'min', 'unit']);
      expect(holes(cableUi[lang].bounds.above)).toEqual(['min', 'unit']);
      expect(holes(cableUi[lang].bounds.atMost)).toEqual(['max', 'unit']);
    }
  });

  it('names every mode, rope and material the form offers', () => {
    for (const lang of LANGS) {
      expect(Object.keys(cableUi[lang].modes)).toEqual([...MODES]);
      expect(Object.keys(cableUi[lang].section.ropes)).toEqual([...ROPE_IDS]);
      expect(Object.keys(cableUi[lang].section.materials)).toEqual([...MATERIAL_IDS]);
    }
  });

  it('gives each unit system its own words for the units line', () => {
    expect(cableUi.en.toolbar).toMatchObject({ us: 'US (ft, in)', si: 'SI (m, mm)' });
    expect(cableUi.es.toolbar).toMatchObject({ us: 'EE. UU. (ft, in)', si: 'SI (m, mm)' });
  });
});

describe('what this calculator does not say', () => {
  const everything = LANGS.flatMap((lang) => leaves(cableUi[lang]).map(([path, s]) => [`${lang} ${path}`, s] as const));

  it('names no standard, no program, no vendor', () => {
    const named = /\b(AISC|ASCE|ACI|AASHTO|NDS|IBC|OSHA|ASME|ISO|EN ?12385|ASTM|API|Eurocode|LRFD|ASD|SkyCiv|Crosby|Wire Rope Technology|Autodesk|Bentley|Excel|Python)\b/i;
    for (const [path, s] of everything) expect(s, path).not.toMatch(named);
  });

  it('gives no verdict, no rating and no design check - but for the one sentence that says there is none', () => {
    const verdict = /\b(safe|unsafe|adequate|inadequate|passes|pass|fails|fail|satisf(?:y|ies)|complies|compliant|code[- ]check|factor of safety|safety factor|working load|WLL|rated|rating|cumple|seguro|insegura?|adecuad[oa]|aprobad[oa]|falla|factor de seguridad|capacidad)\b/i;
    for (const [path, s] of everything) {
      // The sentences that say there is no check are the ones that name the things there is none of.
      if (/^(en|es) (notes\.noVerdict|results\.sizing\.note|section\.designNote)$/.test(path)) continue;
      expect(s, path).not.toMatch(verdict);
    }
    expect(cableUi.en.notes.noVerdict).toContain('numbers only: no verdict and no design check');
    expect(cableUi.es.notes.noVerdict).toContain('solo números: sin veredicto ni verificación de diseño');
    // Said once.
    for (const lang of LANGS) expect(leaves(cableUi[lang]).filter(([, s]) => /verdict|veredicto/i.test(s)).map(([p]) => p)).toEqual(['notes.noVerdict']);
  });

  it('says that the values of ropes are typical, in both languages, and that a wire rope is about half of steel', () => {
    expect(cableUi.en.section.typical).toBe('Typical values: use the manufacturer’s.');
    expect(cableUi.es.section.typical).toBe('Valores típicos: use los del fabricante.');
    expect(cableUi.en.section.ropeModulus).toMatch(/about half of steel/);
    expect(cableUi.es.section.ropeModulus).toMatch(/cerca de la mitad del acero/);
  });

  it('never says “beam” or “viga”, in its own words or in the ones it borrows', () => {
    const beam = { en: /\bbeams?\b/i, es: /\bvigas?\b/i };
    for (const lang of LANGS) {
      for (const [path, s] of [...leaves(cableUi[lang]), ...leaves(sharedWords(beamStrings[lang].ui))]) expect(s, `${lang} ${path}`).not.toMatch(beam[lang]);
    }
  });

  it('never says “calculator”, as the others avoid it', () => {
    for (const lang of LANGS) expect(leaves(cableUi[lang]).filter(([, t]) => /calculator|calculadora/i.test(t)).map(([p]) => p)).toEqual([]);
  });

  it('leaves the page’s own text - its hero, its notes - to the page', () => {
    const keys = leaves(cableUi.en).map(([p]) => p.split('.')[0]);
    for (const page of ['hero', 'assumes', 'method', 'faq', 'meta', 'title', 'disclaimer']) expect(keys).not.toContain(page);
  });
});

describe('what it borrows of the first calculator', () => {
  it('is a small part of it, every piece the same as the first calculator’s', () => {
    for (const lang of LANGS) {
      const ui = beamStrings[lang].ui;
      const shared = sharedWords(ui);
      expect(Object.keys(shared).sort()).toEqual(['numbers', 'results', 'section', 'sheet', 'toolbar']);
      expect(shared.numbers).toBe(ui.numbers);
      expect(shared.section.optional).toBe(ui.section.optional);
      expect(shared.results).toEqual({ title: ui.results.title, privacy: ui.results.privacy });
      expect(Object.keys(shared.toolbar).sort()).toEqual(['copied', 'copyFailed', 'print', 'reset', 'units']);
      expect(Object.keys(shared.sheet).sort()).toEqual(['locale', 'printed']);
      expect(JSON.stringify(shared).length).toBeLessThan(JSON.stringify(ui).length / 6);
    }
  });
});

describe('the link', () => {
  it('has a line while the page opens a case from its address, and one for a link that cannot be read, that say what is in the link', () => {
    expect(cableUi.en.linkOpening).toMatch(/\bcable case\b/);
    expect(cableUi.es.linkOpening).toMatch(/\bcaso de cable\b/);
    expect(cableUi.en.linkError).toMatch(/\bcable case\b/);
    expect(cableUi.es.linkError).toMatch(/\bcaso de cable\b/);
    for (const lang of LANGS) expect(cableUi[lang].sheet.link).toContain('{url}');
  });

  it('is exported with the shape the page’s view codes against', () => {
    const ui: Record<'en' | 'es', CableUi> = cableUi;
    expect(typeof ui.en.linkOpening).toBe('string');
    expect(typeof sharedWords).toBe('function');
  });
});

describe('each text has one home', () => {
  const rows = calculatorFamilies.flatMap((f) => f.items).filter((x) => x.href);
  const words = (s: string) => s.toLowerCase().replace(/[^\p{L}\p{N}\s]/gu, ' ').split(/\s+/).filter(Boolean);
  const sharedRuns = (a: string, b: string) => {
    const there = ` ${words(b).join(' ')} `;
    const mine = words(a);
    return mine.map((_, i) => mine.slice(i, i + 6)).filter((run) => run.length === 6 && there.includes(` ${run.join(' ')} `)).map((run) => run.join(' '));
  };

  // These lines are this tool's: not the other calculators' said again (what is theirs and fits comes from `t`), nor the catalogue's.
  it('says nothing the other calculators or the catalogue already say, six words running', () => {
    expect(rows.length).toBeGreaterThanOrEqual(3);
    for (const lang of LANGS) {
      const theirs = [beamStrings[lang], spanUi[lang], spanPage[lang], continuousUi[lang], continuousPage[lang], shaftUi[lang], shaftPage[lang], trussUi[lang], trussPage[lang]]
        .flatMap((set) => leaves(set).map(([, s]) => s))
        .concat(rows.map((r) => r.does[lang]))
        .join(' . ');
      for (const [path, s] of leaves(cableUi[lang])) expect(sharedRuns(s, theirs), `${lang} ${path}`).toEqual([]);
    }
  });
});
