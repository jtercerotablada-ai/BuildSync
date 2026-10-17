import { describe, expect, it } from 'vitest';
import { formatNumber } from '@/lib/calc/format';
import type { AnalysisIssue, AnalysisWarning } from '@/lib/calc/cable-sag/analysis';
import { ISSUE_CODES, WARNING_CODES } from '@/lib/calc/cable-sag/types';
import { cableSagUi } from '@/lib/calc/cable-sag/strings';
import { fieldKey, fill, issueSentence, percent, rowSentence, signed, tableNote, warningSentence, type Context } from './text';

/**
 * The cable calculator's text machinery (text.ts): the holes of a sentence, a signed value, one sentence for every
 * code the analysis can report in both languages with the numbers the code carries, the table notes and the rows
 * that have no solution.
 */

const LANGS = ['en', 'es'] as const;
const ctx = (group = ','): Context => ({ num: (v, sig = 4) => formatNumber(v, sig, group).replace(/^-/, '−'), length: 'ft', force: 'kip', span: 100 });
const noise = /NaN|undefined|Infinity|\[object|\{|\}|(?:^|[\s>(=])-0(?![.\d])|−0(?![.\d])|\be[+-]\d/;

describe('fill', () => {
  it('puts a value in its hole and leaves a hole it has no value for', () => {
    expect(fill('{a} and {b}', { a: 3 })).toBe('3 and {b}');
  });
  it('chooses the singular for 1 and the plural for the rest, zero included', () => {
    const s = '{count} {count|load|loads}';
    expect([0, 1, 2, 12].map((count) => fill(s, { count }))).toEqual(['0 loads', '1 load', '2 loads', '12 loads']);
  });
  it('makes one pass: what is put in a hole is not taken for another hole', () => {
    expect(fill('{a} {b}', { a: '{b}', b: 'x' })).toBe('{b} x');
  });
});

describe('signed', () => {
  it('writes a sign, a true minus, and no sign on zero', () => {
    expect(signed('5', 5)).toBe('+5');
    expect(signed('5', -5)).toBe('−5');
    expect(signed('0', 0)).toBe('0');
    expect(signed('0', 1e-14)).toBe('0');
  });
});

describe('percent', () => {
  const p = (v: number) => percent(v, cableSagUi.en, ',', formatNumber);
  it('writes a difference as a signed percent to three figures', () => {
    expect(p(0.0648)).toBe('+6.48 %');
    expect(p(-0.01234)).toBe('−1.23 %');
  });
  it('writes zero as zero, and a difference below what is shown in words, never an exponent', () => {
    expect(p(0)).toBe('0 %');
    expect(p(1e-7)).toBe('less than 0.001 %');
    expect(p(-1e-7)).toBe('less than 0.001 %');
    expect(percent(1e-7, cableSagUi.es, ' ', formatNumber)).toBe('menos de 0.001 %');
    expect(p(Number.NaN)).toBe('— %');
  });
});

describe('fieldKey', () => {
  it('names the part of the form a problem is about', () => {
    expect(fieldKey(undefined)).toBe('');
    expect(fieldKey('span')).toBe('span');
    expect(fieldKey({ point: 7 })).toBe('point7');
  });
});

/** Every issue, with the numbers its code carries. */
const ISSUES: Record<string, AnalysisIssue> = {
  number: { code: 'number', field: 'span' },
  span: { code: 'span', field: 'span' },
  rise: { code: 'rise', field: 'rise', ratio: 250.5, max: 100 },
  'load-zero': { code: 'load-zero' },
  section: { code: 'section', field: 'section' },
  'known-value': { code: 'known-value', field: 'known' },
  'sag-range': { code: 'sag-range', field: 'known', ratio: 2e-7, min: 1e-6, max: 100 },
  'length-below-chord': { code: 'length-below-chord', field: 'known', chord: 100, length: 99 },
  'tension-below-minimum': { code: 'tension-below-minimum', field: 'known', min: 5.5, value: 1 },
  'state2-load-zero': { code: 'state2-load-zero', state: 2, chord: 300, length: 300.3 },
  'state2-too-short': { code: 'state2-too-short', state: 2, chord: 300, length: 296.3 },
  thermal: { code: 'thermal', field: 'thermal', value: -2 },
  table: { code: 'table', field: 'table.thermal', count: 60, max: 41 },
  'too-many-loads': { code: 'too-many-loads', field: 'points', count: 13, max: 12 },
  'load-position': { code: 'load-position', field: { point: 3 }, at: 2, value: 120 },
  'duplicate-position': { code: 'duplicate-position', field: { point: 3 }, ats: [1, 2] },
  'no-loads': { code: 'no-loads', field: 'points' },
  'sag-position': { code: 'sag-position', field: 'sagAt', value: 0 },
  'negative-tension': { code: 'negative-tension', field: 'known', value: -90 },
  solver: { code: 'solver' },
  size: { code: 'size' },
  stopped: { code: 'stopped' },
};

describe('a sentence for every problem, with its numbers', () => {
  it('covers every code the library lists, and the one the analysis adds', () => {
    expect(Object.keys(ISSUES).sort()).toEqual([...ISSUE_CODES, 'stopped'].sort());
  });

  for (const lang of LANGS) {
    it(`writes each one in ${lang} with no hole left, no noise and one full stop at its end`, () => {
      for (const [code, issue] of Object.entries(ISSUES)) {
        const s = issueSentence(issue, cableSagUi[lang], ctx());
        expect(s, `${lang} ${code}`).not.toMatch(noise);
        expect(s.endsWith('.'), `${lang} ${code}`).toBe(true);
        expect(s.trim(), `${lang} ${code}`).toBe(s);
      }
    });
  }

  it('puts the numbers the code carries into the English sentence', () => {
    const w = cableSagUi.en;
    const s = (code: string) => issueSentence(ISSUES[code], w, ctx());
    expect(s('rise')).toBe('The height difference is 250.5 times the span, and the calculation stops at 100. A cable that steep has no sag in the usual sense.');
    expect(s('sag-range')).toBe('The sag is 2 × 10^−7 times the span. The calculation takes a sag from 0.000001 to 100 times the span.');
    expect(s('length-below-chord')).toBe('The cable length, 99 ft, is not longer than the straight distance between the supports, 100 ft, so the cable cannot hang between them.');
    expect(s('tension-below-minimum')).toContain('The tension 1 kip is below the least this cable can have in this span and load, 5.5 kip.');
    expect(s('state2-too-short')).toContain('the cable, 296.3 ft long, cannot reach across 300 ft.');
    expect(s('state2-load-zero')).toContain('below 300 ft');
    expect(s('too-many-loads')).toBe('No more than 12 point loads can go on a cable, and this one has 13.');
    expect(s('load-position')).toBe('The position 120 ft is not inside the span, from 0 to 100 ft. Move the load between the supports.');
    expect(s('duplicate-position')).toBe('Load 1 and load 2 sit at one position. Move one of them, or add them into one.');
    expect(s('negative-tension')).toContain('a horizontal tension of −90 kip');
    expect(s('table')).toBe('The temperature table would have 60 rows, and a table holds 41 at most.');
  });

  it('names the input a “number” problem is about, in both languages', () => {
    const w = cableSagUi;
    const field = (f: AnalysisIssue['field'], lang: 'en' | 'es') => issueSentence({ code: 'number', field: f }, w[lang], ctx());
    expect(field('span', 'en')).toBe('The span is not a number the calculation can read.');
    expect(field('state.q', 'en')).toContain('The added load of state 2');
    expect(field('state.ice', 'en')).toContain('ice');
    expect(field({ point: 1 }, 'en')).toContain('The position or the load');
    expect(field('table.loads', 'en')).toContain('The load table');
    expect(field(undefined, 'en')).toContain('A value');
    expect(field('span', 'es')).toBe('La luz no es un valor que el cálculo pueda leer.');
    expect(field('weight', 'es')).toContain('El peso del cable por longitud');
  });

  it('writes the page’s own grouping mark in the numbers of the Spanish page', () => {
    const es = issueSentence({ code: 'length-below-chord', chord: 12500, length: 12400 }, cableSagUi.es, ctx(' '));
    expect(es).toContain('12 400 ft');
    expect(es).toContain('12 500 ft');
  });
});

const WARNINGS: Record<string, AnalysisWarning> = {
  'parabola-differs': { code: 'parabola-differs', difference: 0.0648, tolerance: 0.01, ratio: 0.2 },
  'strain-high': { code: 'strain-high', strain: 0.0171 },
  'vertex-outside': { code: 'vertex-outside', x: -150 },
  'tension-two-roots': { code: 'tension-two-roots', value: 0.0218 },
  'upward-load': { code: 'upward-load', count: 2 },
  'zero-load': { code: 'zero-load', count: 1 },
  'sag-not-at-load': { code: 'sag-not-at-load', value: 20 },
};

describe('a sentence for every warning, with its numbers', () => {
  it('covers every warning the library lists', () => {
    expect(Object.keys(WARNINGS).sort()).toEqual([...WARNING_CODES].sort());
  });
  for (const lang of LANGS) {
    it(`writes each one in ${lang} with no hole left and no noise`, () => {
      for (const [code, warning] of Object.entries(WARNINGS)) {
        const s = warningSentence(warning, cableSagUi[lang], ctx());
        expect(s, `${lang} ${code}`).not.toMatch(noise);
        expect(s.endsWith('.'), `${lang} ${code}`).toBe(true);
      }
    });
  }
  it('says the numbers in percent, and the count in the right number', () => {
    const w = cableSagUi.en;
    expect(warningSentence(WARNINGS['parabola-differs'], w, ctx())).toContain('differs from the exact cable by 6.48 %');
    expect(warningSentence(WARNINGS['parabola-differs'], w, ctx())).toContain('more than 1 %');
    expect(warningSentence(WARNINGS['parabola-differs'], w, ctx())).toContain('The sag is 20 % of the span');
    expect(warningSentence(WARNINGS['strain-high'], w, ctx())).toContain('1.71 %');
    expect(warningSentence(WARNINGS['upward-load'], w, ctx())).toBe('2 point loads pull up. The polygon may rise above its chord.');
    expect(warningSentence({ code: 'upward-load', count: 1 }, w, ctx())).toBe('1 point load pulls up. The polygon may rise above its chord.');
    expect(warningSentence(WARNINGS['zero-load'], w, ctx())).toBe('1 point load is 0 and changes nothing.');
    expect(warningSentence({ code: 'zero-load', count: 3 }, w, ctx())).toBe('3 point loads are 0 and change nothing.');
    expect(warningSentence({ code: 'zero-load', count: 3 }, cableSagUi.es, ctx())).toBe('3 cargas puntuales valen 0 y no cambian nada.');
    expect(warningSentence({ code: 'zero-load', count: 1 }, cableSagUi.es, ctx())).toBe('1 carga puntual vale 0 y no cambia nada.');
  });
});

describe('the notes of a table that cannot be made', () => {
  it('says which table, and what is wrong with it', () => {
    const w = cableSagUi.en;
    expect(tableNote({ code: 'number' }, 'thermal', w)).toBe('The temperature table needs numbers in all its fields.');
    expect(tableNote({ code: 'table', field: 'table.thermal', count: 0, max: 41 }, 'thermal', w)).toBe('The temperature table needs a step above zero and an upper end that is not below the lower one.');
    expect(tableNote({ code: 'table', field: 'table.thermal', count: 60, max: 41 }, 'thermal', w)).toBe('The temperature table would have 60 rows, and a table holds 41 at most.');
    expect(tableNote({ code: 'table', field: 'table.loads', count: 0.5, max: 21 }, 'loads', w)).toBe('The load table needs a whole number of rows, from 1 to 21.');
    expect(tableNote({ code: 'table', field: 'table.loads', count: 40, max: 21 }, 'loads', cableSagUi.es)).toBe('La tabla de cargas tendría 40 filas, y una tabla admite 21 como máximo.');
    expect(tableNote({ code: 'number' }, 'loads', cableSagUi.es)).toBe('La tabla de cargas necesita números en todos sus campos.');
  });
});

describe('the rows that have no solution', () => {
  it('has a sentence for each code a row can carry, and the general one for the rest', () => {
    for (const lang of LANGS) {
      const w = cableSagUi[lang];
      for (const code of ['thermal', 'number', 'state2-load-zero', 'state2-too-short', 'solver', 'size']) {
        expect(rowSentence(code, w)).toBe(w.tables.rowCodes[code as 'thermal']);
        expect(rowSentence(code, w)).not.toBe(w.tables.rowCodes.other);
      }
      for (const code of ['length-below-chord', 'sag-range', undefined]) expect(rowSentence(code, w)).toBe(w.tables.rowCodes.other);
    }
  });
});
