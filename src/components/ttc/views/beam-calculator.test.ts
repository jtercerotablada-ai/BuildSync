import { existsSync, readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { createElement as h } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import { agree, ambiguousNumber, formatNumber, fieldNumber, parseNumber } from '@/lib/calc/format';
import { MATERIALS, convertUnits, defaultBeam, type BeamForm } from '@/lib/calc/beam/model';
import { beamStrings } from '@/lib/calc/beam/strings';
import { calculatorFamilies } from '@/lib/ttc/calculators';
import { getContent, navLabelOf } from '@/lib/ttc/content';
import { localePath, type Lang } from '@/lib/ttc/i18n';
import { absoluteUrl } from '@/lib/ttc/site';
import { BeamCalculator } from '@/components/ttc/calc/beam/BeamCalculator';
import { SiteChrome } from '@/components/ttc/mp/SiteChrome';
import { BEAM_PATH, BeamCalculatorView } from './BeamCalculatorView';

/**
 * THE BEAM CALCULATOR'S PAGE: /resources/beam and /es/resources/beam.
 *
 * The arithmetic is tested where it lives (lib/calc/beam). This is the page
 * around it: that both languages say the same things, that the server sends
 * a solved beam and not an empty box, that every field has a name, and that
 * the calculator's script carries the calculator and not the whole site.
 */

const route = vi.hoisted(() => ({ pathname: '/' }));
vi.mock('next/navigation', () => ({ usePathname: () => route.pathname }));

const LANGS: Lang[] = ['en', 'es'];
const SRC = resolve(__dirname, '..', '..', '..');
const text = (html: string) =>
  html
    .replace(/<(script|style|noscript)\b[\s\S]*?<\/\1>/g, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&')
    .replace(/&#x27;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/\s+/g, ' ')
    .trim();
const esc = (s: string) => renderToStaticMarkup(h('i', null, s)).slice(3, -4);
const attr = (tag: string, name: string) => tag.match(new RegExp(` ${name}="([^"]*)"`))?.[1];
const render = (lang: Lang) => {
  route.pathname = localePath(BEAM_PATH, lang);
  return renderToStaticMarkup(h(SiteChrome, null, h(BeamCalculatorView, { lang })));
};
/** The calculator alone, opened on a beam that is not the example. */
const show = (lang: Lang, initial: BeamForm) => renderToStaticMarkup(h(BeamCalculator, { t: beamStrings[lang].ui, initial }));

/*
 * The cards of numbers under the drawings, read as a visitor reads them: the
 * rows of a table cell by cell, a list of values pair by pair. A number that
 * is merely SOMEWHERE on the page proves nothing — "96" is also in "12.96
 * ksi", and 15.2 is written on the drawing whatever the table says.
 */
const cardsOf = (html: string) => html.split('<div class="mp-app__card">').slice(1);
const rowsOf = (card: string) => [...(card.match(/<tbody>[\s\S]*?<\/tbody>/)?.[0] ?? '').matchAll(/<tr>([\s\S]*?)<\/tr>/g)].map((r) => [...r[1].matchAll(/<t[hd][^>]*>([\s\S]*?)<\/t[hd]>/g)].map((c) => text(c[1])));
const pairsOf = (card: string) => [...card.matchAll(/<dt>([\s\S]*?)<\/dt><dd>([\s\S]*?)<\/dd>/g)].map((m) => [text(m[1]), text(m[2])]);
/** The drawings, each with its summary for a screen reader and its markup. */
const drawingsOf = (html: string) => [...html.matchAll(/<svg\b[^>]*role="img"[^>]*>[\s\S]*?<\/svg>/g)].map((m) => ({ label: attr(m[0], 'aria-label') ?? '', svg: m[0] }));
const numberOf = (tag: string, name: string) => Number(attr(tag, name));

/** The example beam with other supports, loads or section. */
const beam = (over: Partial<BeamForm>): BeamForm => ({ ...defaultBeam(), ...over });
const section = (over: Partial<BeamForm['section']>): BeamForm['section'] => ({ ...defaultBeam().section, ...over });

/** Every string of a nested object, with the path to it. */
function leaves(value: unknown, path = ''): [string, string][] {
  if (typeof value === 'string') return [[path, value]];
  if (Array.isArray(value)) return value.flatMap((v, i) => leaves(v, `${path}[${i}]`));
  if (value && typeof value === 'object') return Object.entries(value).flatMap(([k, v]) => leaves(v, path ? `${path}.${k}` : k));
  return [];
}

describe('beam calculator: the words', () => {
  const en = leaves(beamStrings.en);
  const es = leaves(beamStrings.es);

  it('says the same things in both languages, and leaves nothing blank', () => {
    expect(es.map(([p]) => p)).toEqual(en.map(([p]) => p));
    // One string is a mark and not a word: what each page sets thousands apart with.
    for (const [path, s] of [...en, ...es]) if (path !== 'ui.numbers.group') expect(s.trim().length, path).toBeGreaterThan(0);
  });

  // A comma on the English page. Not on the Spanish one, whose reader writes
  // decimals with a comma and took "53,670" for 53.67: a narrow space there.
  it('the English page groups thousands with a comma, the Spanish page with a narrow space', () => {
    expect(beamStrings.en.ui.numbers.group).toBe(',');
    expect(beamStrings.es.ui.numbers.group).toBe('\u202f');
    // No number written into a Spanish sentence has a grouping comma either.
    for (const [path, s] of es) expect(s, path).not.toMatch(/\d,\d{3}(?!\d)/);
  });

  it('the line for a number that reads two ways has a place for each way to write it', () => {
    for (const lang of LANGS) for (const key of ['{grouped}', '{decimal}', '{padded}']) expect(beamStrings[lang].ui.numbers.ambiguous, `${lang} ${key}`).toContain(key);
    for (const lang of LANGS) for (const key of ['{text}', '{value}']) expect(beamStrings[lang].ui.numbers.refused, `${lang} ${key}`).toContain(key);
    for (const lang of LANGS) expect(beamStrings[lang].ui.section.unknownShape).toContain('{shape}');
    for (const lang of LANGS) for (const key of ['{sum}', '{load}', '{unit}']) expect(beamStrings[lang].ui.results.unbalanced, `${lang} ${key}`).toContain(key);
  });

  // "Write 1250 or 1.250" read as two ways to write twelve hundred and fifty
  // to anyone who sets thousands apart with points — and the field took the
  // second for 1.25, with no mark. The line says what each spelling is
  // worth, and that a point is the decimal mark on this page.
  it('…and says which meaning each of them has: a point is the decimal mark here', () => {
    const { en: e, es: s } = beamStrings;
    expect(e.ui.numbers.ambiguous).toMatch(/For thousands, write \{grouped\}\./);
    expect(e.ui.numbers.ambiguous).toMatch(/If the comma is the decimal mark, write \{padded\} or, with a point, \{decimal\}: here a point is always the decimal mark\./);
    expect(s.ui.numbers.ambiguous).toMatch(/Si son miles, escriba \{grouped\}\./);
    expect(s.ui.numbers.ambiguous).toMatch(/Si la coma es el decimal, escriba \{padded\} o, con punto, \{decimal\}: aquí el punto es siempre el decimal\./);
    // A text left in a field that was not a number: named, with the value that stands.
    expect(e.ui.numbers.refused).toBe('“{text}” is not a number: the value is still {value}.');
    expect(s.ui.numbers.refused).toBe('«{text}» no es un número: el valor sigue siendo {value}.');
  });

  // The engine refuses two supports under a thousandth of the length apart,
  // and a hinge hard against its neighbour: the page says so in those words,
  // with the cure, and does not license reliance on a result.
  it('says what the engine refuses, and on whose check a decision rests', () => {
    const { en: e, es: s } = beamStrings;
    expect(e.ui.issues['close-supports']).toMatch(/thousandth of the beam’s length/);
    expect(e.ui.issues['close-supports']).toMatch(/one support there, or a fixed support/);
    expect(s.ui.issues['close-supports']).toMatch(/milésima de la longitud/);
    expect(s.ui.issues['close-supports']).toMatch(/un solo apoyo, o un empotramiento/);
    expect(e.ui.issues['close-hinges']).toMatch(/hinge/);
    expect(s.ui.issues['close-hinges']).toMatch(/rótula/);
    // …with its cure, which is the hinge's: not a support's, and not that of a hinge at an end.
    expect(e.ui.issues['close-hinges']).toMatch(/Move it away, or remove it/);
    expect(s.ui.issues['close-hinges']).toMatch(/Aléjela o quítela/);
    // Both refusals are also among what the page says it does not do, for whoever reads that before meeting one.
    expect(e.page.limits.items.filter((x) => /two supports closer together than a thousandth of the beam’s length, nor a hinge hard against the hinge or the support beside it/.test(x))).toHaveLength(1);
    expect(s.page.limits.items.filter((x) => /dos apoyos a menos de una milésima de la longitud de la viga, ni una rótula pegada a la rótula o al apoyo que tiene al lado/.test(x))).toHaveLength(1);
    expect(e.page.disclaimer.body).not.toMatch(/before relying|before you rely/i);
    expect(e.page.disclaimer.body).toMatch(/rests on your own check, never on this calculator/);
    expect(s.page.disclaimer.body).not.toMatch(/antes de apoyarse/i);
    expect(s.page.disclaimer.body).toMatch(/se apoya en su propia comprobación, nunca en esta calculadora/);
  });

  it('the Spanish is Spanish: no sentence is the English one left in place', () => {
    const same = en.filter(([, s], i) => s === es[i][1] && s.split(/\s+/).length > 3).map(([path]) => path);
    expect(same).toEqual([]);
  });

  it('names no other company’s product, no price, no date', () => {
    for (const [path, s] of [...en, ...es]) {
      expect(s, path).not.toMatch(/skyciv|quick design|clearcalcs|enercalc|tedds/i);
      expect(s, path).not.toMatch(/\bfree\b|\bgratis\b|\bgratuit|\$|\bprice\b|\bprecio\b|\b20\d\d\b/i);
    }
  });

  // What the page promises of the calculation, the code must do: nothing
  // typed goes anywhere. No fetch, no beacon, no form action in its files.
  it('promises that nothing is sent, and the calculator has no way to send', () => {
    expect(beamStrings.en.ui.results.privacy).toMatch(/Nothing you enter is sent/);
    expect(beamStrings.es.ui.results.privacy).toMatch(/Nada de lo que introduce se nos envía/);
    for (const f of ['components/ttc/calc/beam/BeamCalculator.tsx', 'components/ttc/calc/beam/BeamPlot.tsx', 'components/ttc/calc/beam/BeamSchematic.tsx', 'components/ttc/calc/NumField.tsx', 'lib/calc/beam/model.ts', 'lib/calc/beam/solver.ts']) {
      const code = readFileSync(join(SRC, f), 'utf8');
      expect(code, f).not.toMatch(/\bfetch\(|sendBeacon|XMLHttpRequest|new WebSocket|\baction=|localStorage|sessionStorage|document\.cookie/);
    }
  });
});

describe('beam calculator: numbers as they are printed and typed', () => {
  it('prints a few significant figures, with separators and a decimal point', () => {
    expect(formatNumber(15.2)).toBe('15.2');
    expect(formatNumber(0.186212)).toBe('0.1862');
    expect(formatNumber(1289.04)).toBe('1,289');
    expect(formatNumber(29000, 6)).toBe('29,000');
    expect(formatNumber(-16.8)).toBe('-16.8');
    expect(formatNumber(1234567)).toBe('1,235,000');
  });

  // Four FIGURES, also under a thousandth: six decimals cut a slope of
  // 0.0001192 rad to 0.000119, and 0.00010049 to 0.000101.
  it('keeps its significant figures in a small number', () => {
    expect(formatNumber(0.00012346)).toBe('0.0001235');
    expect(formatNumber(0.000119172)).toBe('0.0001192');
    expect(formatNumber(0.0002483)).toBe('0.0002483');
    expect(formatNumber(0.00010049)).toBe('0.0001005');
    expect(formatNumber(0.004321)).toBe('0.004321');
    expect(formatNumber(-0.0024826)).toBe('-0.002483');
    expect(formatNumber(0.000123456, 6)).toBe('0.000123456');
  });

  it('sets thousands apart with what the page asks for, and leaves the decimal point alone', () => {
    expect(formatNumber(53670.4, 4, '\u202f')).toBe('53\u202f670');
    expect(formatNumber(1234567, 4, '\u202f')).toBe('1\u202f235\u202f000');
    expect(formatNumber(29000, 6, '\u202f')).toBe('29\u202f000');
    expect(formatNumber(-1015.2, 4, '\u202f')).toBe('-1\u202f015');
    expect(formatNumber(1289.04, 6, '\u202f')).toBe('1\u202f289.04');
    // Nothing to set apart: the same in both.
    for (const v of [15.2, 0.1862, 857, -0.0001192, 0.0000123]) expect(formatNumber(v, 4, '\u202f'), String(v)).toBe(formatNumber(v));
    expect(formatNumber(1289.04, 6, '')).toBe('1289.04');
  });

  it('never prints a negative zero, a NaN or a row of zeros', () => {
    expect(formatNumber(-0)).toBe('0');
    expect(formatNumber(-1e-15)).toBe('0');
    expect(formatNumber(Number.NaN)).toBe('—');
    expect(formatNumber(Number.POSITIVE_INFINITY)).toBe('—');
    expect(formatNumber(0.0000123)).toBe('1.23 × 10^-5');
    expect(formatNumber(123456789)).toBe('1.235 × 10^8');
  });

  it('reads what an engineer types — a comma for the point included — and nothing else', () => {
    expect(parseNumber('12.5')).toBe(12.5);
    expect(parseNumber(' 12,5 ')).toBe(12.5);
    expect(parseNumber('-3')).toBe(-3);
    expect(parseNumber('.5')).toBe(0.5);
    expect(parseNumber('1.')).toBe(1);
    expect(parseNumber('2e3')).toBe(2000);
    for (const junk of ['', '-', '.', 'abc', '1,2,3', '1.2.3', '12 ft', '0x10', 'Infinity', '1e999', '--1']) expect(parseNumber(junk), junk).toBeNull();
  });

  // The page prints 29,000. Typed back the same way it was read as 29: a
  // modulus a thousand times too small, and a deflection a thousand times
  // too large, with nothing on screen to say so.
  it('reads a number typed with thousands separators as the page prints it', () => {
    expect(parseNumber('29,000')).toBe(29000);
    expect(parseNumber('1,234,567.5')).toBe(1234567.5);
    expect(parseNumber('-12,500')).toBe(-12500);
    expect(parseNumber('200,000')).toBe(200000);
    // What formatNumber prints, parseNumber reads back.
    for (const v of [29000, 1289.04, 13824, 200000, 0.1862, 15.2]) expect(parseNumber(formatNumber(v, 6)), String(v)).toBe(Number(v.toPrecision(6)));
    // A comma that is not a thousands separator is still a decimal point.
    expect(parseNumber('8,5')).toBe(8.5);
    expect(parseNumber('12,50')).toBe(12.5);
    expect(parseNumber('0,125')).toBe(0.125);
    expect(parseNumber('1,2345')).toBe(1.2345);
  });

  // The Spanish page prints 53 670 and its reader types 6,125 for six metres
  // and an eighth. Read as the English page reads it, that was 6125 m — and
  // the page then printed "53,670 kN", which he took for 53.67.
  const SPACE = '\u202f';
  it('on a page that prints no grouping comma, "1,250" is not a number until it is written one way', () => {
    for (const typed of ['1,250', '6,125', '12,500', '999,999', '-1,250', ' 2,500 ']) {
      expect(parseNumber(typed, SPACE), typed).toBeNull();
      expect(ambiguousNumber(typed, SPACE), typed).not.toBeNull();
    }
    expect(ambiguousNumber('6,125', SPACE)).toEqual({ grouped: '6125', decimal: '6.125', padded: '6,1250' });
    expect(ambiguousNumber('-1,250', SPACE)).toEqual({ grouped: '-1250', decimal: '-1.250', padded: '-1,2500' });
    // Each of the three ways it offers has one reading, and it is the right one.
    const ways = ambiguousNumber('6,125', SPACE)!;
    expect([parseNumber(ways.grouped, SPACE), parseNumber(ways.decimal, SPACE), parseNumber(ways.padded, SPACE)]).toEqual([6125, 6.125, 6.125]);
    // Everything else keeps its reading there: a decimal comma, and thousands where the text can be nothing else.
    for (const [typed, value] of [['12,5', 12.5], ['8,5', 8.5], ['0,125', 0.125], ['1,2345', 1.2345], ['1,25', 1.25], ['1,234,567', 1234567], ['29,000.5', 29000.5], ['1250', 1250], ['1.250', 1.25], ['1000,5', 1000.5]] as const) {
      expect(parseNumber(typed, SPACE), typed).toBe(value);
      expect(ambiguousNumber(typed, SPACE), typed).toBeNull();
    }
  });

  it('on the page that prints commas, "1,250" is the number it prints that way', () => {
    for (const [typed, value] of [['1,250', 1250], ['6,125', 6125], ['29,000', 29000], ['-12,500', -12500]] as const) {
      expect(parseNumber(typed), typed).toBe(value);
      expect(parseNumber(typed, ','), typed).toBe(value);
      expect(ambiguousNumber(typed), typed).toBeNull();
    }
  });

  it('reads back a plain number either page prints, and whatever a field shows, typed on that page', () => {
    for (const group of [',', SPACE]) {
      for (const v of [29000, 1289.04, 13824, 200000, 0.1862, 15.2, 53670.4, 1234567, -1015.2, 6125, 0.0001192]) {
        expect(parseNumber(formatNumber(v, 6, group), group), `${v} with "${group}"`).toBe(Number(v.toPrecision(6)));
      }
      // A field's own text, whatever its size. From 10²¹ a value is written
      // "1e+21", with the sign: refused, the field holding it was marked as
      // wrong the moment it was taken, with nothing typed in it.
      expect(fieldNumber(1e21)).toBe('1e+21');
      for (const v of [1e21, -1.5e21, 1.2345678e25, 1e-7, 12345678, 29123.45, 0.1 + 0.2]) {
        expect(parseNumber(fieldNumber(v), group), `${v} with "${group}"`).toBe(Number(v.toPrecision(8)));
      }
      // A spreadsheet writes the exponent that way too. Half of one is still not a number.
      for (const [typed, value] of [['1e+3', 1000], ['2.9E+04', 29000], ['-1e+21', -1e21], ['1e-3', 0.001]] as const) expect(parseNumber(typed, group), typed).toBe(value);
      for (const junk of ['1e+', 'e+3', '1e++3', '1e+-3', '1e+3.5', '+1e3']) expect(parseNumber(junk, group), junk).toBeNull();
      // What the tables print for such a value is not read back: refused, not taken for another number.
      expect(parseNumber(formatNumber(4e20, 4, group), group)).toBeNull();
    }
    // Typed with the space bar, or pasted with another kind of space; with a decimal part either way.
    for (const [typed, value] of [['53 670', 53670], ['1 234 567', 1234567], ['53\u00a0670', 53670], ['53\u2009670', 53670], ['-1 015', -1015], ['53 670.5', 53670.5], ['53 670,5', 53670.5], ['1 250,125', 1250.125]] as const) {
      expect(parseNumber(typed, SPACE), typed).toBe(value);
      expect(parseNumber(typed), typed).toBe(value);
    }
    // Spaces that set nothing apart are not a number.
    for (const junk of ['1 2', '12 34', '1 2345', '0 125', '1  250', '12 ft']) {
      expect(parseNumber(junk, SPACE), junk).toBeNull();
      expect(parseNumber(junk), junk).toBeNull();
    }
  });

  // The whole text or nothing: the field no longer keeps the last few
  // characters that happened to be a number ("1.250,5" ended as 1.25).
  it('reads the whole text or nothing, on either page', () => {
    for (const group of [',', SPACE]) for (const junk of ['1.250,5', '25 ft', '+5', '1,2,3', '12,5,', '1.2.3', '１２', '']) expect(parseNumber(junk, group), `${junk} with "${group}"`).toBeNull();
  });

  it('shows a stored value back without inventing digits', () => {
    expect(fieldNumber(20)).toBe('20');
    expect(fieldNumber(0.1 + 0.2)).toBe('0.3');
    expect(fieldNumber(6.096)).toBe('6.096');
    expect(fieldNumber(Number.NaN)).toBe('');
    // Eight figures, and no separator: what was typed is what comes back.
    expect(fieldNumber(12.3456)).toBe('12.3456');
    expect(fieldNumber(29123.45)).toBe('29123.45');
    expect(fieldNumber(123.456789012)).toBe('123.45679');
  });

  // "The reactions add up to the load: X = Y" is printed only where they do
  // (a short ramp once gave 9.875 = 10), and then with one figure on both
  // sides. Here is what "they do" means.
  it('two numbers that ought to be one: the same figures, or a millionth of their scale apart', () => {
    expect(agree(32, 32, 32)).toBe(true);
    expect(agree(9.875, 10, 10)).toBe(false);
    expect(agree(9.992188, 10, 10)).toBe(false);
    // The same four figures: nothing printed could tell them apart.
    expect(agree(24.004, 24.0001, 24)).toBe(true);
    // A hair either side of a rounding step: "2.5" and "2.501" as printed, and the same number.
    expect(formatNumber(2.50049999)).not.toBe(formatNumber(2.50050001));
    expect(agree(2.50049999, 2.50050001, 2.5)).toBe(true);
    // Rounding of forces far larger than their sum: measured against those forces, not against the sum.
    expect(agree(1.8e-12, 0, 6172.8)).toBe(true);
    // 0.004 is under a millionth of 6,172.8 and prints as 0.004: only the scale makes it rounding.
    expect(agree(0.004, 0, 6172.8)).toBe(true);
    expect(agree(0.03, 0, 6172.8)).toBe(false);
  });
});

describe('beam calculator: the page', () => {
  for (const lang of LANGS) {
    const html = render(lang);
    const main = html.match(/<main\b[\s\S]*<\/main>/)?.[0] ?? '';
    const s = beamStrings[lang].page;
    const ui = beamStrings[lang].ui;
    const c = getContent(lang);

    it(`${lang}: one h1; the tool and the method are its two h2; the tables and the notes are h3`, () => {
      const heads = (n: number) => [...main.matchAll(new RegExp(`<h${n}\\b[^>]*>([\\s\\S]*?)</h${n}>`, 'g'))].map((m) => text(m[1]));
      expect(heads(1)).toEqual([s.h1]);
      expect(heads(2)).toEqual([s.toolHeading, s.method.title]);
      expect(heads(3)).toEqual([ui.results.reactions, ui.results.maxima, ui.results.spans, ui.results.point, s.assumes.title, s.limits.title, s.signs.title, s.disclaimer.title]);
      expect(main).not.toMatch(/<h[456]\b/);
    });

    // The page opens on a 20 ft span with 1.2 kip/ft and 8 kip at 12 ft, on a
    // W18×50's properties. By hand: reactions 15.2 and 16.8 kip; M = 96 kip·ft
    // under the load; at midspan V = 15.2 − 12 = 3.2 kip and M = 152 − 60 = 92
    // kip·ft; 96 × 12 ÷ 88.9 = 12.96 ksi, 16.8 ÷ 6.39 = 2.629 ksi; and
    // 240 in ÷ 0.2801 in = 857.
    const WORDS = {
      en: {
        reactions: [['Pin', '0', '15.2 upward', '—'], ['Roller', '20', '16.8 upward', '—']],
        sum: 'The reactions add up to the load: 32 = 32 kip.',
        maxima: [['Shear', '16.8 kip at x = 20 ft'], ['Sagging moment', '96 kip·ft at x = 12 ft'], ['Hogging moment', 'none'], ['Deflection', '0.2801 in downward, at x = 10.21 ft'], ['Bending stress', '12.96 ksi'], ['Shear stress', '2.629 ksi']],
        spans: [['0 – 20', '0.2801 downward', 'L/857']],
        point: [['Shear, V', '3.2 kip'], ['Bending moment, M', '92 kip·ft'], ['Deflection', '-0.28 in'], ['Slope', '-0.0001192 rad'], ['Bending stress', '12.42 ksi']],
        drawings: ['Loads and supports: 20 ft; Pin 0, Roller 20.', 'Shear, V: max 15.2 kip at x = 0 ft; min -16.8 kip at x = 20 ft.', 'Bending moment, M: max 96 kip·ft at x = 12 ft; min 0 kip·ft.', 'Deflection: -0.2801 in at x = 10.21 ft.'],
      },
      es: {
        reactions: [['Articulado', '0', '15.2 hacia arriba', '—'], ['Rodillo', '20', '16.8 hacia arriba', '—']],
        sum: 'Las reacciones suman la carga: 32 = 32 kip.',
        maxima: [['Cortante', '16.8 kip en x = 20 ft'], ['Momento positivo', '96 kip·ft en x = 12 ft'], ['Momento negativo', 'ninguno'], ['Deflexión', '0.2801 in hacia abajo, en x = 10.21 ft'], ['Esfuerzo de flexión', '12.96 ksi'], ['Esfuerzo cortante', '2.629 ksi']],
        spans: [['0 – 20', '0.2801 hacia abajo', 'L/857']],
        point: [['Cortante, V', '3.2 kip'], ['Momento flector, M', '92 kip·ft'], ['Deflexión', '-0.28 in'], ['Giro', '-0.0001192 rad'], ['Esfuerzo de flexión', '12.42 ksi']],
        drawings: ['Cargas y apoyos: 20 ft; Articulado 0, Rodillo 20.', 'Cortante, V: máx. 15.2 kip en x = 0 ft; mín. -16.8 kip en x = 20 ft.', 'Momento flector, M: máx. 96 kip·ft en x = 12 ft; mín. 0 kip·ft.', 'Deflexión: -0.2801 in en x = 10.21 ft.'],
      },
    }[lang];

    it(`${lang}: the server sends a solved beam — each table read cell by cell, with its direction words`, () => {
      const cards = cardsOf(main);
      expect(cards).toHaveLength(4);
      // Each support once, with its force AND the way it acts.
      expect(rowsOf(cards[0])).toEqual(WORDS.reactions);
      expect(text(cards[0])).toContain(WORDS.sum);
      expect(pairsOf(cards[1])).toEqual(WORDS.maxima);
      expect(rowsOf(cards[2])).toEqual(WORDS.spans);
      expect(pairsOf(cards[3])).toEqual(WORDS.point);
      // No problem is announced for the default beam.
      expect(main).toMatch(/<div class="mp-app__issues" role="alert" aria-live="assertive"><\/div>/);
    });

    it(`${lang}: its four drawings, each said in words and each drawn the right way up`, () => {
      const drawings = drawingsOf(main);
      expect(drawings.map((d) => d.label)).toEqual(WORDS.drawings.map(esc));
      const [, shear, moment, deflection] = drawings.map((d) => {
        const axis = numberOf(d.svg.match(/<line class="mp-plot__axis"[^>]*>/)?.[0] ?? '', 'y1');
        const dots = [...d.svg.matchAll(/<circle class="mp-plot__dot"[^>]*>/g)].map((m) => ({ x: numberOf(m[0], 'cx'), y: numberOf(m[0], 'cy') }));
        const values = [...d.svg.matchAll(/<text class="mp-plot__value"[^>]*>([\s\S]*?)<\/text>/g)].map((m) => text(m[1]));
        // Every y of the curve: the pairs after each M or L of its path.
        const curve = [...(attr(d.svg.match(/<path class="mp-plot__line"[^>]*>/)?.[0] ?? '', 'd') ?? '').matchAll(/[ML]\s*(-?[\d.]+)[ ,](-?[\d.]+)/g)].map((m) => Number(m[2]));
        return { axis, dots, values, curve };
      });
      // Shear: +15.2 at the left end, above the axis; −16.8 at the right end, below it.
      expect(shear.values).toEqual(['15.2', '-16.8']);
      expect(shear.dots[0].x).toBeLessThan(shear.dots[1].x);
      expect(shear.dots[0].y).toBeLessThan(shear.axis);
      expect(shear.dots[1].y).toBeGreaterThan(shear.axis);
      // Moment: sagging is drawn above the axis.
      expect(moment.values).toEqual(['96']);
      expect(moment.dots[0].y).toBeLessThan(moment.axis);
      expect(Math.min(...moment.curve)).toBeGreaterThan(moment.dots[0].y - 1);
      // Deflection: down is down — the mark AND the line it sits on.
      expect(deflection.values).toEqual(['-0.2801']);
      expect(deflection.dots[0].y).toBeGreaterThan(deflection.axis);
      expect(Math.max(...deflection.curve)).toBeGreaterThan(deflection.axis);
      expect(Math.abs(Math.max(...deflection.curve) - deflection.dots[0].y)).toBeLessThan(1);
      expect(Math.min(...deflection.curve)).toBeGreaterThan(deflection.axis - 1);
    });

    // The row of the catalogue that opens this page says what it computes in
    // one line. That line is the catalogue's: said again here, a search
    // engine has two pages with the same sentence (the hero once was that line
    // with three words changed, which only a run of words catches).
    it(`${lang}: its line in the catalogue is not printed here, nor six words running of it`, () => {
      const rows = calculatorFamilies.flatMap((f) => f.items).filter((x) => x.href === BEAM_PATH);
      expect(rows).toHaveLength(1);
      const words = (t: string) => t.toLowerCase().replace(/[^\p{L}\p{N}\s]/gu, ' ').split(/\s+/).filter(Boolean);
      const body = text(main);
      expect(body).not.toContain(rows[0].does[lang]);
      const here = ` ${words(body).join(' ')} `;
      const line = words(rows[0].does[lang]);
      expect(line.length).toBeGreaterThan(6);
      const shared = line.map((_, i) => line.slice(i, i + 6)).filter((run) => run.length === 6 && here.includes(` ${run.join(' ')} `));
      expect(shared.map((run) => run.join(' '))).toEqual([]);
    });

    it(`${lang}: every field has a name`, () => {
      const controls = [...main.matchAll(/<(input|select)\b[^>]*>/g)].map((m) => m[0]);
      expect(controls.length).toBeGreaterThan(14);
      const labelled = [...main.matchAll(/<label\b[^>]*>([\s\S]*?)<\/label>/g)];
      // Each control sits in a <label> of its own, with words in it.
      expect(labelled.reduce((n, m) => n + (m[1].match(/<(input|select)\b/g) ?? []).length, 0)).toBe(controls.length);
      for (const m of labelled) expect(text(m[1].replace(/<select\b[\s\S]*?<\/select>/g, '')).length, m[0].slice(0, 80)).toBeGreaterThan(0);
      // Radios share a name within their group, and the group has a legend.
      expect((main.match(/<fieldset class="mp-seg">\s*<legend\b/g) ?? []).length).toBe(2);
      // A remove button says what it removes.
      const removes = [...main.matchAll(/<button\b[^>]*class="mp-app__remove"[^>]*>/g)].map((m) => attr(m[0], 'aria-label') ?? '');
      expect(removes.length).toBeGreaterThanOrEqual(4);
      expect(new Set(removes).size).toBe(removes.length);
      for (const label of removes) expect(label).toContain(esc(ui.row.remove));
      // …and no button submits anything.
      for (const b of main.matchAll(/<button\b[^>]*>/g)) expect(attr(b[0], 'type'), b[0]).toBe('button');
    });

    it(`${lang}: the path home is Home, Resources, this page — in the breadcrumb and for search engines`, () => {
      const crumbs = main.match(/<ol class="mp-breadcrumbs">[\s\S]*?<\/ol>/)?.[0] ?? '';
      expect([...crumbs.matchAll(/<a\b([^>]*)>([\s\S]*?)<\/a>/g)].map((m) => [attr(m[1], 'href'), text(m[2])])).toEqual([
        [localePath('/', lang), c.ui.home],
        [localePath('/resources', lang), navLabelOf(c, '/resources')],
      ]);
      expect(text(crumbs.match(/<span aria-current="page">([\s\S]*?)<\/span>/)?.[1] ?? '')).toBe(s.h1);
      const ld = [...html.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)].map((m) => JSON.parse(m[1]));
      const list = ld.find((x) => x['@type'] === 'BreadcrumbList');
      expect(list.itemListElement.map((i: { item: string }) => i.item)).toEqual(['/', '/resources', BEAM_PATH].map((p) => absoluteUrl(localePath(p, lang))));
    });

    it(`${lang}: says how it is solved, what it assumes, what it does not do — and on what terms`, () => {
      const body = text(main);
      for (const p of [...s.method.paragraphs, ...s.assumes.items, ...s.limits.items, ...s.signs.items, s.disclaimer.body, ui.results.privacy, ui.results.signs]) {
        expect(body, p.slice(0, 50)).toContain(text(esc(p)));
      }
      expect(html).toContain(`<noscript><p class="mp-app__noscript">${esc(s.noscript)}</p></noscript>`);
    });

    it(`${lang}: leads back to the catalogue, and nowhere outside the site`, () => {
      const hrefs = [...main.matchAll(/<a\b[^>]*href="([^"]*)"/g)].map((m) => m[1]);
      expect(hrefs.filter((x) => x === localePath('/resources', lang)).length).toBe(2);
      expect(hrefs.filter((x) => /^https?:|^tel:|^mailto:/.test(x))).toEqual([]);
    });
  }

  it('the two languages are the same page', () => {
    const shape = (lang: Lang) =>
      render(lang)
        .match(/<main\b[\s\S]*<\/main>/)![0]
        .replace(/>[^<]+</g, '><')
        .replace(/ (aria-label|title|placeholder|href|lang|d|points|x|y|x1|x2|y1|y2|cx|cy|width|height|text-anchor|viewBox)="[^"]*"/g, '')
        .match(/<\/?[a-z0-9]+/g)!
        .join('');
    expect(shape('es')).toBe(shape('en'));
  });
});

describe('beam calculator: beams other than the example', () => {
  const WALL_LEFT = beam({ supports: [{ id: 1, kind: 'fixed', x: 0 }, { id: 2, kind: 'roller', x: 20 }] });
  const WALL_RIGHT = beam({ supports: [{ id: 1, kind: 'pin', x: 0 }, { id: 2, kind: 'fixed', x: 20 }] });
  // 90 kip at 3.6 ft and 60 kip/ft over the first 4.8 ft of a 12 ft cantilever: 378 kip and 1,015.2 kip·ft at the wall.
  const CANTILEVER = beam({ L: 12, supports: [{ id: 1, kind: 'fixed', x: 0 }], points: [{ id: 3, x: 3.6, P: 90, dir: 'down' }], dists: [{ id: 4, x1: 0, x2: 4.8, w1: 60, w2: 60, dir: 'down' }] });
  // Two equal spans, equal and opposite loads at their middles: the middle support carries nothing, and M is zero over it.
  const OPPOSITE = beam({
    units: 'si',
    supports: [{ id: 1, kind: 'pin', x: 0 }, { id: 2, kind: 'roller', x: 10 }, { id: 5, kind: 'roller', x: 20 }],
    points: [{ id: 3, x: 5, P: 12345.6, dir: 'down' }, { id: 6, x: 15, P: 12345.6, dir: 'up' }],
    dists: [],
    section: section({ E: 200000 }),
  });

  // A propped cantilever, the example's loads. Roller: 3wL/8 + Pa²(3L − a)/2L³
  // = 9 + 3.456 = 12.456 kip with the wall on the left (a = 12), 9 + 1.664 =
  // 10.664 with it on the right (a = 8). The wall's moment holds the beam up:
  // it turns the left end counter-clockwise, the right end clockwise.
  it('a reaction moment is printed with the way it turns', () => {
    expect(rowsOf(cardsOf(show('en', WALL_LEFT))[0])).toEqual([['Fixed', '0', '19.54 upward', '86.88 counter-clockwise'], ['Roller', '20', '12.46 upward', '—']]);
    expect(rowsOf(cardsOf(show('en', WALL_RIGHT))[0])).toEqual([['Pin', '0', '10.66 upward', '—'], ['Fixed', '20', '21.34 upward', '90.72 clockwise']]);
    expect(rowsOf(cardsOf(show('es', WALL_LEFT))[0])).toEqual([['Empotrado', '0', '19.54 hacia arriba', '86.88 antihorario'], ['Rodillo', '20', '12.46 hacia arriba', '—']]);
    expect(rowsOf(cardsOf(show('es', WALL_RIGHT))[0])).toEqual([['Articulado', '0', '10.66 hacia arriba', '—'], ['Empotrado', '20', '21.34 hacia arriba', '90.72 horario']]);
  });

  it('a downward reaction is printed as downward', () => {
    // 10 kip on the tip of a 5 ft overhang of a 15 ft span: the far support is pulled down by 10 × 5 ÷ 15.
    const lifted = beam({ supports: [{ id: 1, kind: 'pin', x: 0 }, { id: 2, kind: 'roller', x: 15 }], points: [{ id: 3, x: 20, P: 10, dir: 'down' }], dists: [] });
    expect(rowsOf(cardsOf(show('en', lifted))[0])).toEqual([['Pin', '0', '3.333 downward', '—'], ['Roller', '15', '13.33 upward', '—']]);
    expect(rowsOf(cardsOf(show('es', lifted))[0])).toEqual([['Articulado', '0', '3.333 hacia abajo', '—'], ['Rodillo', '15', '13.33 hacia arriba', '—']]);
    // …and its overhang deflects down, the span between the supports up.
    expect(rowsOf(cardsOf(show('en', lifted))[2]).map((r) => [r[0], r[1].replace(/^[\d.]+ /, '')])).toEqual([['0 – 15', 'upward'], ['Overhang 15 – 20', 'downward']]);
  });

  // Rounding is not a result. The engine's zero is 10⁻¹² of something, and
  // every place that printed it unsettled said so differently: "none" in the
  // table, 1.364 × 10⁻¹² kip·ft to a screen reader, 2.046 × 10⁻¹⁰ MPa of stress.
  it('what is zero is printed as zero everywhere — table, stress and the words of each drawing', () => {
    const html = show('en', OPPOSITE);
    const cards = cardsOf(html);
    expect(rowsOf(cards[0])).toEqual([['Pin', '0', '6,173 upward', '—'], ['Roller', '10', '0', '—'], ['Roller', '20', '6,173 downward', '—']]);
    expect(text(cards[0])).toContain('The reactions add up to the load: 0 = 0 kN.');
    // At midspan, over the middle support: no moment, and so no stress.
    expect(pairsOf(cards[3]).filter(([k]) => /Bending/.test(k))).toEqual([['Bending moment, M', '0 kN·m'], ['Bending stress', '0 MPa']]);
    expect(html).not.toContain('× 10^');

    const wall = show('en', CANTILEVER);
    expect(wall).not.toContain('× 10^');
    expect(pairsOf(cardsOf(wall)[1]).slice(0, 3)).toEqual([['Shear', '378 kip at x = 0 ft'], ['Sagging moment', 'none'], ['Hogging moment', '1,015 kip·ft at x = 0 ft']]);
    // A largest value that is zero is said without a place: the place was where the rounding happened to peak.
    expect(drawingsOf(wall).map((d) => d.label).slice(1, 3)).toEqual(['Shear, V: max 378 kip at x = 0 ft; min 0 kip.', 'Bending moment, M: max 0 kip·ft; min -1,015 kip·ft at x = 0 ft.']);

    // A wall and a couple at the tip: no shear anywhere.
    const couple = show('en', beam({ supports: [{ id: 1, kind: 'fixed', x: 0 }], points: [], dists: [], couples: [{ id: 3, x: 20, M: 50, dir: 'cw' }] }));
    expect(drawingsOf(couple)[1].label).toBe('Shear, V: zero.');
    expect(rowsOf(cardsOf(couple)[0])).toEqual([['Fixed', '0', '0', '50 counter-clockwise']]);
    expect(pairsOf(cardsOf(couple)[1])[0]).toEqual(['Shear', '0 kip']);
    expect(pairsOf(cardsOf(couple)[1])[5]).toEqual(['Shear stress', '0 ksi']);
  });

  // Two supports a little over a thousandth of the length apart are solved,
  // and carry forces whose rounding is far above a billionth of the load: a
  // roller that carries nothing came out as 1.2 × 10⁻⁸ kip, upward.
  it('what rounding leaves on two supports close together is not a reaction, nor a shear beside them', () => {
    const pair = beam({ L: 100, supports: [{ id: 1, kind: 'fixed', x: 50 }, { id: 2, kind: 'roller', x: 50.11 }], points: [{ id: 3, x: 20, P: 10, dir: 'down' }], dists: [] });
    const html = show('en', pair);
    expect(rowsOf(cardsOf(html)[0])).toEqual([['Fixed', '50', '10 upward', '300 clockwise'], ['Roller', '50.11', '0', '—']]);
    expect(html).not.toContain('× 10^');
  });

  // The floor of a reaction is a millionth of the largest one. 10 kip a hair
  // past the second support pulls the first one down by 10 × 0.003 ÷ 15 =
  // 0.002 kip, and by 10 × 0.0006 ÷ 15 = 0.0004 kip: one twenty-five-
  // thousandth of the other reaction, and printed. (The ten-thousandth is
  // for two supports close together, and these are 15 ft apart.)
  it('a small reaction on supports well apart is a result', () => {
    const hair = beam({ supports: [{ id: 1, kind: 'pin', x: 0 }, { id: 2, kind: 'roller', x: 15 }], points: [{ id: 3, x: 15.003, P: 10, dir: 'down' }], dists: [] });
    expect(rowsOf(cardsOf(show('en', hair))[0])).toEqual([['Pin', '0', '0.002 downward', '—'], ['Roller', '15', '10 upward', '—']]);
    expect(pairsOf(cardsOf(show('en', hair))[1])[2]).toEqual(['Hogging moment', '0.03 kip·ft at x = 15 ft']);
    const far = beam({ L: 40, supports: [{ id: 1, kind: 'pin', x: 0 }, { id: 2, kind: 'roller', x: 15 }], points: [{ id: 3, x: 15.0006, P: 10, dir: 'down' }], dists: [] });
    expect(rowsOf(cardsOf(show('en', far))[0])).toEqual([['Pin', '0', '0.0004 downward', '—'], ['Roller', '15', '10 upward', '—']]);
  });

  // A pin and a roller 0.02 ft apart on 20 ft clamp the beam with 5,300 and
  // 5,290 kip. Past them it is a cantilever, and by hand: right of the 10 kip
  // at midspan the shear is the 0.4 kip at 15 ft, and the moment there is
  // −0.4 × 5 = −2 kip·ft. With the floor of the pair's reactions (0.53 kip,
  // 10.6 kip·ft) applied to the diagrams, both were printed as 0.
  const CLAMPED = beam({ supports: [{ id: 1, kind: 'pin', x: 0 }, { id: 2, kind: 'roller', x: 0.02 }], points: [{ id: 3, x: 10, P: 10, dir: 'down' }, { id: 4, x: 15, P: 0.4, dir: 'down' }], dists: [] });
  // A small load and a couple of 1,000 kip·ft on a pin and a roller 0.19 ft apart: reactions of some 5,250 kip, either way.
  const LEVERED = (P: number, dir: 'cw' | 'ccw') => beam({ supports: [{ id: 1, kind: 'pin', x: 0 }, { id: 2, kind: 'roller', x: 0.19 }], points: [{ id: 3, x: 10, P, dir: 'down' }], dists: [], couples: [{ id: 5, x: 15, M: 1000, dir }] });
  it('beside two supports close together, a small shear and a small moment are results', () => {
    const cards = cardsOf(show('en', CLAMPED));
    expect(rowsOf(cards[0])).toEqual([['Pin', '0', '5,290 downward', '—'], ['Roller', '0.02', '5,300 upward', '—']]);
    const at = pairsOf(cards[3]);
    expect(at[0]).toEqual(['Shear, V', '10.4 just left , 0.4 just right kip']);
    expect(at[1]).toEqual(['Bending moment, M', '-2 kip·ft']);
    // 10 kip on the tip, the pair 0.1 ft apart: the load itself is a two-hundredth of the largest reaction.
    const tip = beam({ supports: [{ id: 1, kind: 'pin', x: 0 }, { id: 2, kind: 'roller', x: 0.1 }], points: [{ id: 3, x: 20, P: 10, dir: 'down' }], dists: [] });
    expect(drawingsOf(show('en', tip))[1].label).toBe('Shear, V: max 10 kip at x = 0.1 ft; min -1,990 kip at x = 0 ft.');
    // …and a thirteen-thousandth of it: with the clockwise couple the pin pulls down with 5,284 kip, and the largest shear the other way is the 0.4 kip.
    expect(drawingsOf(show('en', LEVERED(0.4, 'cw')))[1].label).toBe('Shear, V: max 0.4 kip at x = 0.19 ft; min -5,284 kip at x = 0 ft.');
  });

  // The deflection has no reaction in it: its floor is the loads' and the
  // length's. Between the two supports of that pair the beam rises two
  // ten-millionths of an inch, and that is printed.
  it('a deflection is measured against the loads, not against the reactions', () => {
    expect(rowsOf(cardsOf(show('en', CLAMPED))[2])[0]).toEqual(['0 – 0.02', '2.022 × 10^-7 upward', '> 99,999']);
  });

  // The one place a ten-thousandth of the largest reaction is the floor: the
  // forces of two supports closer than a hundredth of the length. Here the
  // wall at 99.9 and the roller at 100 carry exactly nothing (the short piece
  // between the two hinges at 88.5 can hand no force on to theirs), and the
  // engine leaves 6.5 × 10⁻⁴ kip on each beside reactions of 21.
  it('two supports close together that carry nothing read 0', () => {
    const lever = beam({
      L: 100,
      supports: [{ id: 1, kind: 'roller', x: 0 }, { id: 2, kind: 'pin', x: 14.3 }, { id: 3, kind: 'pin', x: 56.9 }, { id: 4, kind: 'fixed', x: 99.9 }, { id: 5, kind: 'roller', x: 100 }],
      hinges: [{ id: 6, x: 50 }, { id: 7, x: 88.5 }, { id: 8, x: 88.485 }],
      points: [{ id: 9, x: 30, P: 10, dir: 'down' }],
      dists: [],
    });
    expect(rowsOf(cardsOf(show('en', lever))[0])).toEqual([['Roller', '0', '10.98 downward', '—'], ['Pin', '14.3', '20.98 upward', '—'], ['Pin', '56.9', '0', '—'], ['Fixed', '99.9', '0', '0'], ['Roller', '100', '0', '—']]);
    // …and no more than that: 10 kip a hair past a roller 0.1 ft from the
    // pin pulls the pin down by 10 × 0.0002 ÷ 0.1 = 0.02 kip, a five-hundredth
    // of the other reaction, and it is printed.
    const small = beam({ supports: [{ id: 1, kind: 'pin', x: 0 }, { id: 2, kind: 'roller', x: 0.1 }], points: [{ id: 3, x: 0.1002, P: 10, dir: 'down' }], dists: [] });
    expect(rowsOf(cardsOf(show('en', small))[0])).toEqual([['Pin', '0', '0.02 downward', '—'], ['Roller', '0.1', '10.02 upward', '—']]);
  });

  // With 0.4 kip and the couple counter-clockwise the reactions are 5,243 and
  // 5,242 kip, and the load is still 0.4 kip. Settled with a reaction's floor,
  // the line read "0 = 0 kip".
  it('the load in the line under the reactions is settled as a load, not as a reaction', () => {
    const card = cardsOf(show('en', LEVERED(0.4, 'ccw')))[0];
    expect(rowsOf(card)).toEqual([['Pin', '0', '5,243 upward', '—'], ['Roller', '0.19', '5,242 downward', '—']]);
    expect(text(card)).toContain('The reactions add up to the load: 0.4 = 0.4 kip.');
    expect(text(cardsOf(show('es', LEVERED(0.4, 'ccw')))[0])).toContain('Las reacciones suman la carga: 0.4 = 0.4 kip.');
    // A hundredth of that load is under a millionth of those reactions, and is still the load.
    expect(text(cardsOf(show('en', LEVERED(0.004, 'ccw')))[0])).toContain('The reactions add up to the load: 0.004 = 0.004 kip.');
  });

  it('the Spanish page prints no grouping comma: 1 015, not 1,015', () => {
    const html = show('es', CANTILEVER);
    expect(html).toContain('1\u202f015');
    expect(text(html)).not.toMatch(/\d,\d{3}/);
    for (const d of drawingsOf(html)) expect(d.label).not.toMatch(/\d,\d{3}/);
    // The drawing and its words too, and the table of ratios (ten times the example's stiffness: 240 in ÷ 0.028011 in = 8,568).
    expect(drawingsOf(html)[2].label).toBe('Momento flector, M: máx. 0 kip·ft; mín. -1\u202f015 kip·ft en x = 0 ft.');
    const stiff = show('es', beam({ section: section({ I: 8000 }) }));
    expect(rowsOf(cardsOf(stiff)[2])).toEqual([['0 – 20', '0.02801 hacia abajo', 'L/8 568']]);
    expect(rowsOf(cardsOf(show('en', beam({ section: section({ I: 8000 }) })))[2])).toEqual([['0 – 20', '0.02801 downward', 'L/8,568']]);
    // A rectangle's computed properties, to six figures.
    const rect = show('es', beam({ section: section({ mode: 'rect' }) }));
    expect(rect).toContain('13\u202f824');
    expect(show('en', beam({ section: section({ mode: 'rect' }) }))).toContain('13,824');
  });

  it('an error is announced once, by the results box, and the row’s line is tied to its field', () => {
    for (const lang of LANGS) {
      const ui = beamStrings[lang].ui;
      const html = show(lang, beam({ points: [{ id: 3, x: 25, P: 8, dir: 'down' }] }));
      // One live region speaks of it…
      const alerts = [...html.matchAll(/<[a-z]+\b[^>]*role="alert"[^>]*>/g)].map((m) => m[0]);
      expect(alerts).toHaveLength(1);
      expect(alerts[0]).toContain('class="mp-app__issues"');
      expect(text(html.match(/<div class="mp-app__issues"[\s\S]*?<\/div>/)?.[0] ?? '')).toContain(ui.issues.outside);
      // …and the row says it beside the field, which points at that line.
      const line = html.match(/<p class="mp-app__row-error"[^>]*>([\s\S]*?)<\/p>/);
      expect(text(line?.[1] ?? '')).toBe(ui.issues.outside);
      const id = attr(line?.[0] ?? '', 'id');
      expect(id).toBeTruthy();
      const marked = [...html.matchAll(/<input\b[^>]*aria-invalid="true"[^>]*>/g)].map((m) => m[0]);
      expect(marked).toHaveLength(1);
      expect(attr(marked[0], 'aria-describedby')).toBe(id);
      // Nothing is marked or described on a beam with nothing wrong, and no field has a line of its own.
      expect(show(lang, defaultBeam())).not.toMatch(/aria-invalid|aria-describedby|mp-app__row-error|mp-num__hint/);
    }
  });

  it('a problem that is no row’s is tied to its field too: the length, a value of the section', () => {
    const short = show('en', beam({ L: 0 }));
    const said = short.match(/<li id="([^"]+)">The length of the beam must be a positive number\.<\/li>/)?.[1];
    expect(said).toBeTruthy();
    expect(short).toContain(`aria-invalid="true" aria-describedby="${said}"`);
    const thin = show('en', beam({ section: section({ I: -1 }) }));
    const about = thin.match(/<li id="([^"]+)">A section value is negative or not a number\.<\/li>/)?.[1];
    expect(about).toBeTruthy();
    expect([...thin.matchAll(/aria-describedby="([^"]+)"/g)].map((m) => m[1])).toEqual([about]);
  });

  // What the engine refuses for being too close together comes back with the
  // row of the later of the two: the page says it there, in that row's words.
  it('two supports, or a hinge and its neighbour, too close to be solved: said at the row of the later one', () => {
    const flagged = (html: string) => [...html.matchAll(/<div class="mp-app__item" role="group" aria-label="([^"]*)" data-invalid="true">/g)].map((m) => m[1]);
    const line = (html: string) => text(html.match(/<p class="mp-app__row-error"[^>]*>([\s\S]*?)<\/p>/)?.[1] ?? '');
    const pair = beam({ supports: [{ id: 1, kind: 'pin', x: 0 }, { id: 2, kind: 'fixed', x: 10 }, { id: 5, kind: 'roller', x: 10.005 }, { id: 6, kind: 'roller', x: 20 }] });
    const hinges = beam({ supports: [{ id: 1, kind: 'fixed', x: 0 }, { id: 2, kind: 'fixed', x: 20 }], hinges: [{ id: 7, x: 8 }, { id: 8, x: 8.000002 }] });
    for (const lang of LANGS) {
      const ui = beamStrings[lang].ui;
      const names = ui.row.names;
      expect(flagged(show(lang, pair))).toEqual([`${names.supports} 3`]);
      expect(line(show(lang, pair))).toBe(ui.issues['close-supports']);
      expect(flagged(show(lang, hinges))).toEqual([`${names.hinges} 2`]);
      expect(line(show(lang, hinges))).toBe(ui.issues['close-hinges']);
      // No numbers are printed for a beam that is not solved.
      expect(cardsOf(show(lang, pair))).toHaveLength(0);
    }
  });

  // The form holds what arithmetic left it (0.1 + 0.2 is 0.30000000000000004,
  // and so is a length converted from metres); a field shows eight figures.
  it('a field shows eight figures of its value, not every digit the form holds', () => {
    expect(show('en', beam({ points: [{ id: 3, x: 0.1 + 0.2, P: 8, dir: 'down' }] }))).toContain('value="0.3"');
  });

  it('each row is a group with a name, so two fields called Position are told apart', () => {
    const groups = (lang: Lang) => [...show(lang, beam({ hinges: [{ id: 7, x: 5 }], couples: [{ id: 8, x: 4, M: 20, dir: 'cw' }] })).matchAll(/<div class="mp-app__item" role="group" aria-label="([^"]*)"/g)].map((m) => m[1]);
    expect(groups('en')).toEqual(['Support 1', 'Support 2', 'Hinge 1', 'Point load 1', 'Distributed load 1', 'Applied moment 1']);
    expect(groups('es')).toEqual(['Apoyo 1', 'Apoyo 2', 'Rótula 1', 'Carga puntual 1', 'Carga distribuida 1', 'Momento aplicado 1']);
    // The button that removes a row calls it by the same name.
    const html = show('en', defaultBeam());
    expect([...html.matchAll(/<button\b[^>]*class="mp-app__remove"[^>]*>/g)].map((m) => attr(m[0], 'aria-label'))).toEqual(['Remove: Support 1', 'Remove: Support 2', 'Remove: Point load 1', 'Remove: Distributed load 1']);
  });

  // The value a list stores and the word it shows for it: with the two words
  // of a list exchanged, choosing "Down" would apply an upward load.
  it('each option of a list is called what it does', () => {
    const options = (lang: Lang) => {
      const html = show(lang, beam({ couples: [{ id: 8, x: 4, M: 20, dir: 'cw' }] }));
      return Object.fromEntries([...html.matchAll(/<option value="(pin|roller|fixed|down|up|cw|ccw)"[^>]*>([^<]*)<\/option>/g)].map((m) => [m[1], m[2]]));
    };
    expect(options('en')).toEqual({ pin: 'Pin', roller: 'Roller', fixed: 'Fixed', down: 'Down', up: 'Up', cw: 'Clockwise', ccw: 'Counter-clockwise' });
    expect(options('es')).toEqual({ pin: 'Articulado', roller: 'Rodillo', fixed: 'Empotrado', down: 'Hacia abajo', up: 'Hacia arriba', cw: 'Horario', ccw: 'Antihorario' });
    // …and the one shown as chosen is the one the form holds.
    const html = show('en', beam({ points: [{ id: 3, x: 12, P: 8, dir: 'up' }], couples: [{ id: 8, x: 4, M: 20, dir: 'ccw' }] }));
    expect([...html.matchAll(/<option value="(down|up|cw|ccw)" selected="">/g)].map((m) => m[1])).toEqual(['up', 'down', 'ccw']);
  });

  // The list says "Concrete"; what its modulus assumes is a line under the
  // fields, where a closed list and a printed page still show it — and only
  // while that modulus is the one in the field.
  it('a listed material says what its modulus assumes, for as long as that modulus is in use', () => {
    const material = (lang: Lang, over: Partial<BeamForm['section']>, units: 'us' | 'si' = 'us') => show(lang, units === 'si' ? { ...convertUnits(defaultBeam(), 'si'), section: { ...convertUnits(defaultBeam(), 'si').section, ...over } } : beam({ section: section(over) }));
    const notes = beamStrings.en.ui.section.materialNote;
    expect(notes.concrete).toMatch(/4,000 psi \(28 MPa\)/);
    expect(notes.wood).toMatch(/Douglas Fir-Larch No\. 2.*2 to 4 in\. thick/);
    expect(beamStrings.es.ui.section.materialNote.concrete).toMatch(/4000 psi \(28 MPa\)/);
    expect(beamStrings.es.ui.section.materialNote.wood).toMatch(/Douglas Fir-Larch n\.º 2.*de 2 a 4 in de espesor/);
    for (const lang of LANGS) {
      const said = beamStrings[lang].ui.section.materialNote;
      const names = beamStrings[lang].ui.section.materials;
      const concrete = material(lang, { material: 'concrete', E: MATERIALS.concrete.us });
      expect(text(concrete)).toContain(said.concrete);
      expect(concrete).toContain(`<option value="concrete" selected="">${esc(names.concrete)}</option>`);
      expect(text(material(lang, { material: 'wood', E: MATERIALS.wood.us }))).toContain(said.wood);
      expect(text(material(lang, { material: 'wood', E: MATERIALS.wood.si }, 'si'))).toContain(said.wood);
      // Another modulus, another material, a steel shape: no such line.
      for (const other of [material(lang, { material: 'custom', E: 3000 }), material(lang, { material: 'concrete', E: 3000 }), material(lang, { material: 'steel', E: 29000 }), material(lang, { mode: 'shape', material: 'concrete', E: MATERIALS.concrete.us })]) {
        expect(text(other)).not.toContain(said.concrete);
        expect(text(other)).not.toContain(said.wood);
      }
      // The names in the list are short enough to be read in it.
      for (const name of Object.values(names)) expect(name.length, name).toBeLessThanOrEqual(22);
    }
  });

  it('what is missing for a result is asked for in the fields the section has', () => {
    const need = beamStrings.en.ui.results.need;
    const props = show('en', beam({ section: section({ I: 0, S: 0, Av: 0 }) }));
    for (const line of Object.values(need.props)) expect(text(props)).toContain(line);
    const rect = show('en', beam({ section: section({ mode: 'rect', b: 0 }) }));
    for (const line of Object.values(need.rect)) expect(text(rect)).toContain(line);
    for (const line of Object.values(need.props)) expect(text(rect)).not.toContain(line);
    expect(need.rect.bending).toMatch(/width and the depth/);
    expect(need.shape.deflection).toMatch(/Choose a shape/);
    expect(beamStrings.es.ui.results.need.rect.bending).toMatch(/el ancho y la altura/);
    expect(beamStrings.es.ui.results.need.shape.deflection).toMatch(/Elija un perfil/);
    // With "Steel shape" chosen and its table still on the way, that is what is missing — not E and I.
    const shape = show('en', beam({ section: section({ mode: 'shape' }) }));
    expect(pairsOf(cardsOf(shape)[1]).slice(3).map(([, v]) => v)).toEqual(Array(3).fill(beamStrings.en.ui.section.loading));
    for (const line of [...Object.values(need.props), ...Object.values(need.shape)]) expect(text(shape)).not.toContain(line);
  });
});

describe('beam calculator: what its script carries', () => {
  // The calculator is a client component: everything it imports goes to the
  // browser. Its own words and its engine, yes; the site's whole copy
  // (site.ts, read through content.ts), the catalogue or the city pages, no.
  const resolveImport = (from: string, spec: string): string | null => {
    const base = spec.startsWith('@/') ? join(SRC, spec.slice(2)) : spec.startsWith('.') ? join(dirname(from), spec) : null;
    if (!base) return null;
    for (const candidate of [base, `${base}.ts`, `${base}.tsx`, join(base, 'index.ts'), join(base, 'index.tsx')]) {
      if (existsSync(candidate) && /\.(tsx?|json)$/.test(candidate)) return candidate;
    }
    return null;
  };
  const reach = (entry: string): string[] => {
    const seen = new Set<string>();
    const walk = (file: string) => {
      if (seen.has(file) || file.endsWith('.json')) {
        seen.add(file);
        return;
      }
      seen.add(file);
      const code = readFileSync(file, 'utf8');
      // Value imports only: `import type` and `import { type X }` alone carry no code.
      for (const m of code.matchAll(/^\s*(import|export)\s+(?!type\b)([\s\S]*?)\s+from\s+['"]([^'"]+)['"]/gm)) {
        const names = m[2];
        if (/^\{[^}]*\}$/.test(names.trim()) && names.replace(/[{}]/g, '').split(',').every((n) => /^\s*type\s/.test(n) || n.trim() === '')) continue;
        const next = resolveImport(file, m[3]);
        if (next) walk(next);
      }
      for (const m of code.matchAll(/import\(\s*['"]([^'"]+)['"]\s*\)/g)) {
        const next = resolveImport(file, m[1]);
        if (next) walk(next);
      }
    };
    walk(entry);
    return [...seen].map((f) => f.slice(SRC.length + 1).replace(/\\/g, '/'));
  };

  it('its engine, its words, the shape table — and none of the site’s copy', () => {
    const files = reach(join(SRC, 'components/ttc/calc/beam/BeamCalculator.tsx'));
    expect(files).toEqual(
      expect.arrayContaining(['lib/calc/beam/solver.ts', 'lib/calc/beam/model.ts', 'lib/calc/format.ts', 'lib/steel/aisc-shapes.json', 'components/ttc/calc/NumField.tsx']),
    );
    // Its words come in as a prop from the server view. strings.ts holds both
    // languages and the page's own paragraphs: imported here, all of it would
    // travel with the calculator's script.
    expect(files).not.toContain('lib/calc/beam/strings.ts');
    const forbidden = files.filter((f) => /^lib\/ttc\/(site|site\.es|content|calculators|cities|city-)/.test(f) || /lib\/beam-analysis|lib\/beam\/|lib\/advanced-beam/.test(f));
    expect(forbidden).toEqual([]);
    // Nothing of the retired calculators' interface either.
    expect(files.filter((f) => /^components\/ttc\/(beam|advanced-beam|steel)\//.test(f))).toEqual([]);
  });

  it('the shape table is fetched when asked for, not with the page', () => {
    const code = readFileSync(join(SRC, 'components/ttc/calc/beam/BeamCalculator.tsx'), 'utf8');
    expect(code).toMatch(/import\('@\/lib\/steel\/aisc-shapes\.json'\)/);
    expect(code).not.toMatch(/^import .*aisc-shapes\.json/m);
  });
});

describe('beam calculator: the site around it', () => {
  const source = (rel: string) => readFileSync(join(SRC, rel), 'utf8');
  // The families of class that are a calculator's own.
  const OWN = /\.mp-(app|appsec|appnotes|num|seg|plot|beam)(?![a-z0-9])/g;

  it('its styles are a sheet of its own: the sheet of every public page has none of them', () => {
    const shared = source('app/(public)/mp.css').replace(/\/\*[\s\S]*?\*\//g, '');
    expect(shared.match(OWN) ?? []).toEqual([]);
    const own = source('components/ttc/calc/calc.css');
    for (const cls of ['.mp-app__top', '.mp-num__box', '.mp-seg__item', '.mp-plot', '.mp-beam', '.mp-appnotes__grid']) expect(own, cls).toContain(cls);
    // What must beat a shared class does it by weight, not by which sheet loads last.
    expect(own.replace(/\/\*[\s\S]*?\*\//g, '')).not.toMatch(/(^|[\s,}])\.mp-appsec\s*\{/);
    expect(source('components/ttc/views/BeamCalculatorView.tsx')).toContain("import '@/components/ttc/calc/calc.css';");
  });

  it('every class its markup uses is styled in that sheet', () => {
    const own = source('components/ttc/calc/calc.css');
    const used = new Set<string>();
    for (const m of render('en').matchAll(/class="([^"]*)"/g)) {
      for (const cls of m[1].split(/\s+/)) if (/^mp-(app|appsec|appnotes|num|seg|plot|beam)(?![a-z0-9])/.test(cls)) used.add(cls);
    }
    expect(used.size).toBeGreaterThan(30);
    // Three name a thing without styling it: the drawing among the plots, its
    // unit label (styled as one of the dimension texts) and a field that is a list.
    const NAMES_ONLY = ['mp-beam', 'mp-beam__unit', 'mp-num--select'];
    const missing = [...used].filter((cls) => !NAMES_ONLY.includes(cls) && !new RegExp(`\\.${cls}(?![a-zA-Z0-9_-])`).test(own));
    expect(missing).toEqual([]);
  });

  // A value whose unit is two units long (kip/ft, kip·ft) is left half a
  // field, and a number cut short reads as another number: 0.68522 kip/ft
  // showed "0.6852", a moment of 12500 showed "1250". What the widths come to
  // on a screen only a browser shows; that those three fields ask for theirs,
  // on a phone too, and that the form is wide enough for a moment's row, is
  // held here.
  it('the two intensities of a distributed load and an applied moment are the wide fields', () => {
    const html = show('en', beam({ couples: [{ id: 8, x: 4, M: 20, dir: 'cw' }] }));
    expect([...html.matchAll(/<label class="mp-num mp-num--wide"[^>]*><span class="mp-num__label">([^<]*)</g)].map((m) => m[1])).toEqual(['At the start', 'At the end', 'Moment']);
    const own = source('components/ttc/calc/calc.css').replace(/\/\*[\s\S]*?\*\//g, '');
    expect(own).toMatch(/\.mp-app__fields > \.mp-num\.mp-num--wide\s*\{\s*flex-basis:\s*7\.25rem;\s*\}/);
    expect(own).toMatch(/\.mp-app__top\s*\{[^}]*grid-template-columns:\s*minmax\(0, 30rem\) minmax\(0, 1fr\);/);
  });

  // The drawings follow the form down the page where they fit under the
  // header. The calculator measures their column against the window and
  // names the one that does not fit; the sheet does not pin that one. (What
  // is measured, only a browser shows.)
  it('a column of drawings taller than the window is named by the calculator, and the sheet lets it go', () => {
    const own = source('components/ttc/calc/calc.css').replace(/\/\*[\s\S]*?\*\//g, '');
    expect(own).toMatch(/\.mp-app__out\.mp-app__out--tall\s*\{\s*position:\s*static;\s*\}/);
    expect(source('components/ttc/calc/beam/BeamCalculator.tsx')).toContain("className={tooTall ? 'mp-app__out mp-app__out--tall' : 'mp-app__out'}");
    // Not before it has been measured: the server sends the column as the sheet has it.
    for (const lang of LANGS) expect(render(lang)).toMatch(/<section class="mp-app__out" aria-label="[^"]+">/);
  });

  for (const lang of LANGS) {
    it(`${lang}: no call bar lies over the form on a phone — and the other pages keep theirs`, () => {
      expect(render(lang)).not.toContain('mp-bar');
      route.pathname = localePath('/resources', lang);
      expect(renderToStaticMarkup(h(SiteChrome, null, h('p', null, 'x')))).toContain('class="mp-bar"');
    });

    it(`${lang}: beside the disclaimer, the site's terms — which speak of the calculators, as the privacy policy does`, () => {
      const main = render(lang).match(/<main\b[\s\S]*<\/main>/)![0];
      expect(main).toContain(`href="${localePath('/terms', lang)}"`);
      const c = getContent(lang);
      const about = /^Calcula(tors|doras)$/;
      for (const doc of [c.legal.terms, c.legal.privacy]) {
        const section = doc.sections.find((x) => about.test(x.h));
        expect(section, doc.title).toBeDefined();
        // Said once in each, and not the same sentence in both.
        expect(doc.sections.filter((x) => about.test(x.h))).toHaveLength(1);
      }
      const said = (doc: typeof c.legal.terms) => JSON.stringify(doc.sections.find((x) => about.test(x.h))!.p);
      expect(said(c.legal.terms)).not.toBe(said(c.legal.privacy));
      // The policy says what the calculator's own line says: nothing typed is sent.
      expect(said(c.legal.privacy)).toMatch(lang === 'en' ? /not sent to us/ : /no se nos envían/);
      // The terms say what the disclaimer says: a decision rests on the reader's
      // own check. No sentence there makes a result something to rely on, and
      // the first section counts the calculators among what is not advice.
      expect(said(c.legal.terms)).not.toMatch(/before you rely|antes de apoyarse/i);
      expect(said(c.legal.terms)).toMatch(lang === 'en' ? /rests on that check, not on the calculator/ : /se apoya en esa comprobación, no en la calculadora/);
      expect(JSON.stringify(c.legal.terms.sections[0].p)).toMatch(lang === 'en' ? /its calculators are working aids\. None of it is/ : /sus calculadoras son herramientas de trabajo\. Nada de ello es/);
    });
  }

  it('the language link carries the beam: the header reads the address after the #, for that key alone', () => {
    const lang = source('components/ttc/mp/lang.tsx');
    expect(lang).toContain("window.location.hash.startsWith('#b=') ? window.location.hash : ''");
    const header = source('components/ttc/mp/SiteHeader.tsx');
    expect(header).toContain('altPath(pathname, search) + carried');
    // The calculator rewrites its own address and tells the window so, under a
    // name the header's store listens for (by name: the calculator's script
    // must not import lang.tsx, which reads the site's whole copy).
    const calculator = source('components/ttc/calc/beam/BeamCalculator.tsx');
    const event = calculator.match(/const ADDRESS_EVENT = '([^']+)';/)?.[1];
    expect(event).toBeTruthy();
    expect(lang).toContain(`const ADDRESS_EVENT = '${event}';`);
    expect(lang).toContain('window.addEventListener(ADDRESS_EVENT, notify);');
    expect(calculator).toContain('window.dispatchEvent(new Event(ADDRESS_EVENT));');
    // …and the link reads the address once more at the click, and goes where it says.
    expect(header).toMatch(/onClick=\{\(e\) => \{\s*const now = addressNow\(\);\s*const fresh = altPath\(pathname, now\.search\) \+ now\.carried;/);
    expect(header).toContain('window.location.assign(fresh);');
    // On the server and while hydrating there is no address to read: the static page carries the plain twin.
    for (const l of LANGS) {
      const twin = localePath(BEAM_PATH, l === 'en' ? 'es' : 'en');
      expect(render(l)).toContain(`href="${twin}"`);
    }
  });
});
