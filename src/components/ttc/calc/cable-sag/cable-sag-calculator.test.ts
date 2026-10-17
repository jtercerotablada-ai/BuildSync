import { readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { createElement as h } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { afterEach, describe, expect, it, vi } from 'vitest';

// Heavy by design (every code in both languages, a sweep of generated cables, whole-tool renders): a loaded machine runs a full suite past the 5 s default.
vi.setConfig({ testTimeout: 120_000 });
import { spanPage } from '@/lib/calc/beam/span-page-strings';
import { spanUi } from '@/lib/calc/beam/span-strings';
import { beamStrings } from '@/lib/calc/beam/strings';
import { cableSagPage } from '@/lib/calc/cable-sag/page-strings';
import { continuousPage } from '@/lib/calc/continuous/page-strings';
import { continuousUi } from '@/lib/calc/continuous/strings';
import { shaftPage } from '@/lib/calc/shaft/page-strings';
import { shaftUi } from '@/lib/calc/shaft/strings';
import { trussPage } from '@/lib/calc/truss/page-strings';
import { trussUi } from '@/lib/calc/truss/strings';
import { analyseSafely } from '@/lib/calc/cable-sag/analysis';
import { CABLE_SAG_KEY, MAX_POINT_LOADS, convertCableSag, decodeCableSag, defaultCase, defaultCaseFor, encodeCableSag, reduceCableSag, type CableSagForm, type CableSagMode, type PointRow } from '@/lib/calc/cable-sag/model';
import { cableSagUi, sharedWords } from '@/lib/calc/cable-sag/strings';
import { calculatorFamilies } from '@/lib/ttc/calculators';
import type { Lang } from '@/lib/ttc/i18n';
import { CableSagCalculator, solvedFor } from './CableSagCalculator';

// A turn of the event loop between two tests: every test here solves a cable or several, and never waits.
afterEach(() => new Promise<void>((done) => setTimeout(done, 0)));

/**
 * THE CABLE CALCULATOR — the tool of /resources/cable-sag-pretension, as the server sends it: what a visitor sees
 * before the script arrives, or without it.
 *
 * The arithmetic is held where it is done (lib/calc/cable-sag: engine, model and analysis tests, 168 of them). This
 * is the component: its three modes and their forms, its results cell by cell, every state of the cable (each
 * mode's example, each problem, each warning, an empty case, a full-size one), its two languages and its two unit
 * systems, and the shell's rules as they stand in its source.
 *
 * What only a browser can show — typing, a mode chosen, the example button, a row added or removed with the
 * keyboard, the switches over the drawing, the address after the #, the phone's layout, the printed sheet — is
 * listed in the report that goes with this file.
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

const show = (lang: Lang, initial?: CableSagForm) => renderToStaticMarkup(h(CableSagCalculator, { t: sharedWords(beamStrings[lang].ui), w: cableSagUi[lang], initial }));

/* The cards of numbers, read as a visitor reads them and found by their title. A cell carries its column's head a second time, for a phone, out of sight and silent: taken out before it is read. */
const HEAD = /<span class="mp-cs__head" aria-hidden="true">(?:[^<]|<span class="mp-plot__unit">[^<]*<\/span>)*<\/span>/g;
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
const warningList = (html: string) => [...(html.match(/<div class="mp-cs__warnings"[^>]*>([\s\S]*?)<\/div>/)?.[1] ?? '').matchAll(/<li[^>]*>([\s\S]*?)<\/li>/g)].map((m) => text(m[1]));
const legends = (html: string) => [...html.matchAll(/<fieldset class="mp-app__group[^"]*"><legend>([^<]*)<\/legend>/g)].map((m) => m[1]);
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
const field = (html: string, label: string) => fieldsOf(html).find((f) => f.label === label);
const selectsOf = (part: string) =>
  [...part.matchAll(/<label class="mp-num mp-num--select[^"]*"[^>]*>([\s\S]*?)<\/label>/g)].map((m) => ({
    label: text(m[1].match(/<span class="mp-num__label">([\s\S]*?)<\/span>/)?.[1] ?? ''),
    chosen: text(m[1].match(/<option[^>]* selected=""[^>]*>([\s\S]*?)<\/option>/)?.[1] ?? ''),
    options: [...m[1].matchAll(/<option[^>]*>([\s\S]*?)<\/option>/g)].map((o) => text(o[1])),
  }));
const lineOf = (html: string, id: string | undefined) => text(html.match(new RegExp(`<p class="mp-app__row-error" id="${id}">([\\s\\S]*?)</p>`))?.[1] ?? '');
const radiosOf = (html: string, name: string) => [...html.matchAll(new RegExp(`<input type="radio" name="${name}"( checked="")?[^>]*/><span>([^<]*)</span>`, 'g'))].map((m) => [m[2], Boolean(m[1])] as const);
const noise = /NaN|undefined|Infinity|\[object|(?:^|[\s>(=])-0(?![.\d])|−0(?![.\d])|\be[+-]\d|\{\w+[|}]/;

/* ── cables to render ──────────────────────────────────────────────────── */

const base = defaultCase();
const state = defaultCaseFor('state');
const points = defaultCaseFor('points');
const row = (id: number, x: number, P: number): PointRow => ({ id, x, P });
const withPoints = (f: CableSagForm, rows: PointRow[]): CableSagForm => ({ ...f, points: rows, nextId: rows.length + 1 });

const combined: CableSagForm = { ...base, weightFrom: 'section', q: 0, sag: 20 };
const tensionTwo: CableSagForm = { ...base, weightFrom: 'section', q: 0, known: 'T-high', T: 5 };
const steep: CableSagForm = { ...base, rise: 80, sag: 5 };
const inclined: CableSagForm = { ...base, rise: 20, known: 'sag', sagKind: 'low', sag: 12 };

/** Every problem that stops a solution, one cable that has it, the sentence it must be given in English, and the fields it marks. */
const PROBLEMS: { code: string; form: () => CableSagForm; en: RegExp; es: RegExp; marks?: string[] }[] = [
  { code: 'number', form: () => ({ ...base, span: Number.NaN }), en: /^Span and supports: The span is not a number the calculation can read\.$/, es: /^Luz y apoyos: La luz no es un valor que el cálculo pueda leer\.$/, marks: ['Span, L'] },
  { code: 'span', form: () => ({ ...base, span: 0 }), en: /^Span and supports: The span has to be greater than zero\.$/, es: /^Luz y apoyos: La luz tiene que ser mayor que cero\.$/, marks: ['Span, L'] },
  {
    code: 'rise',
    form: () => ({ ...base, rise: 1e5 }),
    en: /^Span and supports: The height difference is 1,000 times the span, and the calculation stops at 100\. A cable that steep has no sag in the usual sense\.$/,
    es: /^Luz y apoyos: La diferencia de altura es 1[  ]000 veces la luz, y el cálculo se detiene en 100\./,
    marks: ['Height of the right support over the left'],
  },
  { code: 'load-zero', form: () => ({ ...base, weightFrom: 'none', q: 0 }), en: /^There is no load: neither the cable’s weight nor an added load\. With nothing to carry the cable would be straight\.$/, es: /^No hay carga: ni el peso del cable ni una carga añadida\./ },
  {
    code: 'section',
    form: () => ({ ...base, E: -5 }),
    en: /^Section and material: A value of the section \(the diameter or area, the modulus, the fill or weight factor, or the unit weight\) has to be greater than zero\.$/,
    es: /^Sección y material: Un valor de la sección \(el diámetro o el área, el módulo, el factor de relleno o de peso, o el peso unitario\) tiene que ser mayor que cero\.$/,
    marks: ['Modulus of elasticity, E'],
  },
  { code: 'known-value', form: () => ({ ...base, sag: 0 }), en: /^What is known: The value you know has to be greater than zero\.$/, es: /^Dato conocido: El dato conocido tiene que ser mayor que cero\.$/, marks: ['Sag at midspan, d'] },
  {
    code: 'sag-range',
    form: () => ({ ...base, sag: 1e5 }),
    en: /^What is known: The sag is 1,000 times the span\. The calculation takes a sag from 0\.000001 to 100 times the span\.$/,
    es: /^Dato conocido: La flecha es 1[  ]000 veces la luz\. El cálculo admite una flecha de 0\.000001 a 100 veces la luz\.$/,
    marks: ['Sag at midspan, d'],
  },
  {
    code: 'length-below-chord',
    form: () => ({ ...base, elastic: false, known: 'length', length: 99 }),
    en: /^What is known: The cable length, 99 ft, is not longer than the straight distance between the supports, 100 ft, so the cable cannot hang between them\.$/,
    es: /^Dato conocido: La longitud del cable, 99 ft, no es mayor que la distancia recta entre los apoyos, 100 ft, así que el cable no puede colgar entre ellos\.$/,
    marks: ['Length of the cable, unstretched'],
  },
  {
    code: 'tension-below-minimum',
    form: () => ({ ...base, known: 'T-high', T: 1 }),
    en: /^What is known: The tension 1 kip is below the least this cable can have in this span and load, [\d.]+ kip\. Give a larger one\.$/,
    es: /^Dato conocido: La tensión 1 kip es menor que la mínima que puede tener este cable en esta luz y con esta carga, [\d.]+ kip\. Dé una mayor\.$/,
    marks: ['Tension at the higher support'],
  },
  {
    code: 'state2-load-zero',
    form: () => ({ ...state, weightFrom: 'none', q: 100, state: { ...state.state, q: 0, ice: 0 } }),
    en: /^State 2 has no load\. The cable would be straight, so there is no sag to give: it is taut if its unstretched length is below 300 ft, and slack above it\.$/,
    es: /^El estado 2 no tiene carga\. El cable quedaría recto/,
  },
  {
    code: 'state2-too-short',
    form: () => ({ ...state, elastic: false, state: { ...state.state, T2: -2000 } }),
    en: /^At state 2’s temperature the cable, [\d.]+ ft long, cannot reach across 300 ft\. Let it stretch, or give it more length or a higher temperature\.$/,
    es: /^A la temperatura del estado 2 el cable, de [\d.]+ ft de largo, no alcanza a cruzar 300 ft\./,
  },
  {
    code: 'thermal',
    form: () => ({ ...state, alpha: Number.NaN }),
    en: /^The temperature change is not a usable number: α times the change must be a number above −1\.$/,
    es: /^El cambio de temperatura no es utilizable: α por el cambio tiene que quedar por encima de −1\.$/,
    marks: ['Temperature in state 1', 'Temperature in state 2', 'Thermal expansion, α'],
  },
  {
    code: 'too-many-loads',
    form: () => withPoints(points, Array.from({ length: 13 }, (_, i) => row(i + 1, 4 * (i + 1), 1))),
    en: /^Point loads: No more than 12 point loads can go on a cable, and this one has 13\.$/,
    es: /^Cargas puntuales: Un cable admite 12 cargas puntuales como máximo, y este tiene 13\.$/,
  },
  {
    code: 'load-position',
    form: () => withPoints(points, [row(1, 70, 1)]),
    en: /^Load 1: The position 70 ft is not inside the span, from 0 to 60 ft\. Move the load between the supports\.$/,
    es: /^Carga 1: La posición 70 ft queda fuera de la luz, que va de 0 a 60 ft\. Ponga la carga entre los apoyos\.$/,
    marks: ['Position from support A', 'Load'],
  },
  {
    code: 'duplicate-position',
    form: () => withPoints(points, [row(1, 10, 1), row(2, 10, 1)]),
    en: /^Load 1: Load 1 and load 2 sit at one position\. Move one of them, or add them into one\.$/,
    es: /^Carga 1: Las cargas 1 y 2 están en la misma posición\./,
  },
  { code: 'no-loads', form: () => withPoints(points, []), en: /^Point loads: There is no point load, or every one is 0\. With nothing to carry the cable would be straight\.$/, es: /^Cargas puntuales: No hay ninguna carga puntual, o todas valen 0\./ },
  {
    code: 'sag-position',
    form: () => ({ ...points, sagAt: 0 }),
    en: /^What is known: The position of the sag, 0 ft, must be inside the span, from 0 to 60 ft, and the loads must have a moment there\.$/,
    es: /^Dato conocido: La posición de la flecha, 0 ft, debe estar dentro de la luz, de 0 a 60 ft/,
    marks: ['Position of the sag'],
  },
  {
    code: 'negative-tension',
    form: () => ({ ...points, pointsSag: -5 }),
    en: /^What is known: With that sag the cable would need a horizontal tension of −90 kip, which is not a tension\. The sag must be positive, below the chord\.$/,
    es: /^Dato conocido: Con esa flecha el cable necesitaría una tensión horizontal de −90 kip/,
    marks: ['Sag there'],
  },
  { code: 'solver', form: () => ({ ...base, known: 'length', length: 1e12 }), en: /^The calculation did not close for this cable\. Try a less extreme value\.$/, es: /^El cálculo no cerró para este cable\./ },
  { code: 'size', form: () => ({ ...points, pointsSag: 5e-324 }), en: /^One of the results is too large for the calculation to hold\.$/, es: /^Uno de los resultados es demasiado grande para el cálculo\.$/ },
];

/** Every warning, one cable that has it, and the start of its sentence. */
const WARNINGS: { code: string; form: () => CableSagForm; en: RegExp; es: RegExp }[] = [
  { code: 'parabola-differs', form: () => combined, en: /^The parabola differs from the exact cable by 6\.48 %.*more than 1 %\. The sag is 20 % of the span/, es: /^La parábola difiere del cable exacto en un 6\.48 %/ },
  { code: 'strain-high', form: () => ({ ...base, E: 1 }), en: /^The strain at the largest tension is 1,710 %, high for a working cable\./, es: /^La deformación con la mayor tensión es del 1[  ]710 %/ },
  { code: 'vertex-outside', form: () => steep, en: /^The cable’s lowest point would fall outside the span, −150 ft from A:/, es: /^El punto inferior del cable caería fuera de la luz, a −150 ft de A:/ },
  { code: 'tension-two-roots', form: () => tensionTwo, en: /^The tension you gave belongs to two cables, a taut one \(shown\) and a slack one with a pretension of 0\.0218 kip\.$/, es: /^La tensión dada corresponde a dos cables/ },
  { code: 'upward-load', form: () => withPoints(points, [row(1, 15, -4), row(2, 30, 20), row(3, 45, 0)]), en: /^1 point load pulls up\. The polygon may rise above its chord\.$/, es: /^1 carga puntual tira hacia arriba\./ },
  { code: 'zero-load', form: () => withPoints(points, [row(1, 15, -4), row(2, 30, 20), row(3, 45, 0)]), en: /^1 point load is 0 and changes nothing\.$/, es: /^1 carga puntual vale 0 y no cambia nada\.$/ },
  { code: 'sag-not-at-load', form: () => ({ ...withPoints(points, [row(1, 15, 10), row(2, 30, 20), row(3, 45, 10)]), sagAt: 20, pointsSag: 10 }), en: /^The sag you gave is at 20 ft from A, where no load acts/, es: /^La flecha dada está a 20 ft de A, donde no actúa ninguna carga/ },
];

describe('the hanging example, as the server sends it', () => {
  const html = show('en');

  it('is the level cable of the textbook, solved: a pure parabola, 12.5 kip of pretension', () => {
    expect(pairsOf(html.match(/<dl class="mp-app__dl mp-cs__headline">[\s\S]*?<\/dl>/)![0])).toEqual([
      ['Pretension, H', '12.5 kip'],
      ['Largest tension', '13.46 kip at both supports'],
      ['Sag at midspan, d', '10 ft'],
      ['Length of the cable', '102.61 ft'],
    ]);
    expect(issueList(html)).toEqual([]);
    expect(warningList(html)).toEqual([]);
    // The live region is always on the page (what is put in it is announced) and is hidden while it is empty.
    expect(html).toMatch(/<div class="mp-cs__warnings" role="status" hidden=""><\/div>/);
  });

  it('opens bare: the example is the address of no case', () => {
    expect(CABLE_SAG_KEY).toBe('g');
    expect(encodeCableSag(base)).toMatch(/^[^;]+;1;h,us;100,0;/);
    expect(decodeCableSag(encodeCableSag(base))).toEqual(base);
  });

  it('gives the tension at each support, the vertical force and the angle, read against the hand answer', () => {
    const card = cardsOf(html).of('Tensions at the supports');
    expect(headOf(card)).toEqual(['Support', 'Tension (kip)', 'Vertical force (kip)', 'Angle below horizontal (°)']);
    // qL/2 = 5 kip; T = √(12.5² + 5²) = 13.46 kip; atan(5/12.5) = 21.80°.
    expect(rowsOf(card)).toEqual([
      ['A, left', '13.46', '5 kip upward', '+21.8'],
      ['B, right', '13.46', '5 kip upward', '+21.8'],
    ]);
  });

  it('gives the shape: pretension, the extreme tensions, both sags, the lowest point and the chord', () => {
    expect(pairsOf(cardsOf(html).of('Pretension and shape'))).toEqual([
      ['Pretension, H', '12.5 kip'],
      ['Largest tension', '13.46 kip at both supports'],
      ['Smallest tension', '12.5 kip at the lowest point'],
      ['Sag at midspan, d', '10 ft'],
      ['Sag ÷ span', '0.1'],
      ['Sag below the lower support, s', '10 ft'],
      ['Lowest point', '50 ft from A, 10 ft below A'],
      ['Chord length', '100 ft'],
      ['Chord angle', '0°'],
    ]);
  });

  it('gives the length under load and unstretched, and the stretch and strain of the elastic cable', () => {
    const card = cardsOf(html).of('Length and stretch');
    const pairs = pairsOf(card);
    // L(1 + 8/3 r² − 32/5 r⁴ + …) = 102.606 ft; E·A = 29,000 × 0.7854 = 22,777 kip; stretch ≈ 0.693 in.
    expect(pairs[0]).toEqual(['Length under load', '102.61 ft']);
    expect(pairs[1][0]).toBe('Unstretched length');
    expect(pairs[2]).toEqual(['Elastic stretch', '0.6933 in']);
    expect(pairs[3]).toEqual(['Strain at the largest tension', '0.0591 %']);
    expect(text(card)).toContain('Lengths are measured along the cable.');
  });

  it('says what the section is: the metal, its weight (none: the cable’s own weight is left out) and its stiffness', () => {
    expect(pairsOf(cardsOf(html).of('Section'))).toEqual([
      ['Nominal diameter', '1 in'],
      ['Metal area', '0.7854 in²'],
      ['Weight per length', 'none (weightless)'],
      ['Stiffness, E·A', '22,780 kip'],
    ]);
  });

  it('says that the parabola is the exact answer where the load is per horizontal length, and shows no second cable', () => {
    const card = cardsOf(html).of('Parabola and catenary');
    expect(text(card)).toContain('the parabola is the exact answer');
    expect(card).not.toContain('<table');
    expect(cardsOf(html).titles).toEqual(['Tensions at the supports', 'Pretension and shape', 'Length and stretch', 'Section', 'Parabola and catenary']);
  });

  it('draws the cable with a sentence for whoever cannot see the drawing, and its legend', () => {
    const svg = html.match(/<svg class="mp-plot__svg mp-cs-fig__svg"[^>]*>/)![0];
    expect(attr(svg, 'aria-label')).toBe('Cable over a span of 100 ft, in the shape of a parabola. Pretension 12.5 kip, largest tension 13.46 kip, sag at midspan 10 ft, length 102.61 ft.');
    expect(html).toContain('<span>Cable (exact): solid line</span>');
    expect(html).toContain('>sag 10 ft<');
  });

  it('says once that these are numbers and not a verdict, and that the values are typical', () => {
    expect(text(html)).toContain('These are numbers, not a verdict. Nothing here is a design check, and no capacity, breaking load or factor is used. Material values are typical.');
    expect(text(html).match(/not a verdict/g)).toHaveLength(1);
    expect(text(html)).toContain('These values are typical. Use the maker’s for the cable you mean to build with.');
  });

  it('has no noise anywhere in it', () => {
    expect(noise.test(text(html))).toBe(false);
  });
});

describe('the form of a hanging cable', () => {
  const html = show('en');

  it('has the five groups of a hanging cable, in the order of the work', () => {
    expect(legends(html)).toEqual(['What to calculate', 'Span and supports', 'Load', 'What is known', 'Section and material']);
  });

  it('chooses the mode and the units with real radios, the example’s checked', () => {
    expect(radiosOf(html, 'cable-mode')).toEqual([['Hanging cable', true], ['Change of state', false], ['Cable with point loads', false]]);
    expect(radiosOf(html, 'cable-units')).toEqual([['US (ft, kip)', true], ['SI (m, kN)', false]]);
    expect(text(html)).toContain('A cable between two supports, carrying its own weight');
    expect(html).toContain('Load the example for this mode');
  });

  it('holds the example’s numbers, each with its unit', () => {
    expect(field(html, 'Span, L')).toMatchObject({ value: '100', unit: 'ft' });
    expect(field(html, 'Height of the right support over the left')).toMatchObject({ value: '0', unit: 'ft' });
    expect(field(html, 'Added load per horizontal length')).toMatchObject({ value: '100', unit: 'lb/ft' });
    expect(field(html, 'Sag at midspan, d')).toMatchObject({ value: '10', unit: 'ft' });
    expect(field(html, 'Nominal diameter, d')).toMatchObject({ value: '1', unit: 'in' });
    expect(field(html, 'Modulus of elasticity, E')).toMatchObject({ value: '29000', unit: 'ksi' });
    expect(fieldsOf(html).every((f) => !f.invalid && f.describedBy === undefined)).toBe(true);
  });

  it('offers each known there is, and says in plain words which sag is which', () => {
    const known = selectsOf(html).find((s) => s.label === 'Known')!;
    expect(known.options).toEqual(['Sag at midspan, d', 'Sag below the lower support, s', 'Pretension (horizontal tension), H', 'Tension at the higher support', 'Tension at the lower support', 'Length of the cable, unstretched']);
    expect(known.chosen).toBe('Sag at midspan, d');
    expect(text(html)).toContain('How far the cable hangs under the chord, the straight line joining the supports, measured straight down at midspan.');
  });

  it('offers the eight materials, and says a rope’s modulus is not steel’s once a rope is chosen', () => {
    const material = selectsOf(html).find((s) => s.label === 'Material')!;
    expect(material.options).toEqual(['Steel', 'Stainless steel', 'Aluminum', 'Seven-wire strand', 'Wire rope, 6×19 or 6×36', 'Spiral strand', 'Locked-coil strand', 'Other (enter the values)']);
    expect(html).not.toContain('well below steel’s');
    const rope = show('en', { ...base, material: 'rope', E: 13000, fill: 0.51, lay: 1.18 });
    expect(text(rope)).toContain('well below steel’s');
    expect(selectsOf(rope).find((s) => s.label === 'Material')!.chosen).toBe('Wire rope, 6×19 or 6×36');
  });

  it('shows the weight from the section when it is the weight in use, and the fields that make it', () => {
    const own = show('en', { ...base, weightFrom: 'section', q: 0 });
    expect(text(own)).toMatch(/Weight per length from the section: 2\.67\d lb\/ft\./);
    expect(field(own, 'Unit weight of the metal')).toMatchObject({ value: '490', unit: 'lb/ft³' });
    expect(field(own, 'Weight factor of the lay')).toMatchObject({ value: '1' });
    expect(field(html, 'Unit weight of the metal')).toBeUndefined();
    const typed = show('en', { ...base, weightFrom: 'typed', typedWeight: 3, q: 0 });
    expect(field(typed, 'Cable weight per length')).toMatchObject({ value: '3', unit: 'lb/ft' });
  });

  it('takes the modulus away when the cable is not allowed to stretch, and says what that means', () => {
    const rigid = show('en', { ...base, elastic: false });
    expect(field(rigid, 'Modulus of elasticity, E')).toBeUndefined();
    expect(text(rigid)).toContain('keeps its length whatever it pulls with');
    expect(text(rigid)).toContain('The cable does not stretch.');
    expect(pairsOf(cardsOf(rigid).of('Length and stretch'))).toHaveLength(2);
    expect(text(rigid)).toContain('so both lengths are the same');
  });
});

describe('a cable under its own weight and a load together', () => {
  const html = show('en', combined);

  it('warns that the parabola is no longer a good stand-in, and says it in the comparison too', () => {
    expect(warningList(html)).toHaveLength(1);
    expect(warningList(html)[0]).toMatch(/^The parabola differs from the exact cable by 6\.48 %, in the worst of the pretension, the largest tension and the sag, which is more than 1 %\./);
    expect(text(cardsOf(html).of('Parabola and catenary'))).toContain('The parabola differs from the exact cable by 6.48 %');
  });

  it('puts the exact cable and the parabola side by side with the difference of each quantity', () => {
    const card = cardsOf(html).of('Parabola and catenary');
    expect(headOf(card)).toEqual(['Quantity', 'Exact cable', 'Parabola', 'Difference']);
    const rows = rowsOf(card);
    expect(rows.map((r) => r[0])).toEqual(['Pretension, H (kip)', 'Largest tension (kip)', 'Sag at midspan (ft)', 'Length (ft)']);
    // The sag is the given one, so the parabola agrees with it exactly; the pretension is what differs.
    expect(rows[2][3]).toMatch(/^(0|less than 0\.001) %$|^[+−]0\.0\d+ %$/);
    expect(rows[0][3]).toMatch(/^[+−]\d+(\.\d+)? %$/);
    expect(rows.flat().every((c) => !noise.test(c))).toBe(true);
    expect(text(card)).toContain('Under its own weight the cable hangs as a catenary.');
  });

  it('draws the parabola too, dashed, with a switch to take it off', () => {
    expect(html).toContain('mp-cs-fig__curve--parabola');
    expect(html).toContain('<span>Parabola, dashed</span>');
    expect(html).toContain('<span>Parabola (approximate): dashed line</span>');
    expect(show('en').includes('mp-cs-fig__curve--parabola')).toBe(false);
    expect(show('en')).not.toContain('<span>Parabola, dashed</span>');
  });

  it('says the cable’s own weight is a catenary, and a load with it neither', () => {
    const both = show('en', { ...base, weightFrom: 'section', q: 20, sag: 1 });
    expect(text(cardsOf(both).of('Parabola and catenary'))).toContain('neither curve');
  });
});

describe('what is known, other than the mid-span sag', () => {
  it('solves for the pretension given: the sag follows, and the example comes back', () => {
    const html = show('en', { ...base, known: 'H', H: 12.5 });
    expect(pairsOf(html.match(/<dl class="mp-app__dl mp-cs__headline">[\s\S]*?<\/dl>/)![0])[2]).toEqual(['Sag at midspan, d', '10 ft']);
    expect(selectsOf(html).find((s) => s.label === 'Known')!.chosen).toBe('Pretension (horizontal tension), H');
    expect(field(html, 'Pretension (horizontal tension), H')).toMatchObject({ value: '12.5', unit: 'kip' });
  });

  it('solves for the length given: the unstretched one', () => {
    const html = show('en', { ...base, known: 'length', length: 102.5482 });
    expect(text(html)).toContain('Length of the cable, unstretched');
    expect(pairsOf(html.match(/<dl class="mp-app__dl mp-cs__headline">[\s\S]*?<\/dl>/)![0])[2][1]).toMatch(/^(9\.99|10\.0)\d* ft$|^10 ft$/);
  });

  it('draws the sag below the lower support and the one at midspan on a sloping span, and says which was given', () => {
    const html = show('en', inclined);
    expect(issueList(html)).toEqual([]);
    expect(html).toContain('mp-cs-fig__dim--low mp-cs-fig__dim--given');
    expect(html).toMatch(/>sag below lower support 12 ft</);
    expect(html).toMatch(/>sag at midspan [\d.]+ ft</);
    expect(html).toContain('<span>Sag at midspan</span>');
    expect(html).toContain('<span>Sag below the lower support</span>');
    const shape = pairsOf(cardsOf(html).of('Pretension and shape'));
    expect(shape.find((p) => p[0] === 'Sag below the lower support, s')![1]).toBe('12 ft');
    expect(shape.find((p) => p[0] === 'Chord angle')![1]).toBe('+11.31°');
  });

  it('gives two cables for a tension, the taut one shown and the slack one explained', () => {
    const html = show('en', tensionTwo);
    expect(warningList(html)).toEqual(['The tension you gave belongs to two cables, a taut one (shown) and a slack one with a pretension of 0.0218 kip.']);
    const card = cardsOf(html).of('The slack cable');
    expect(pairsOf(card)[0]).toEqual(['Pretension, H', '0.0218 kip']);
    expect(text(card)).toContain('The one above is the taut one.');
  });

  it('warns when the lowest point is outside the span, and says so instead of giving a sag below the lower support', () => {
    const html = show('en', steep);
    expect(warningList(html)).toHaveLength(1);
    const shape = pairsOf(cardsOf(html).of('Pretension and shape'));
    expect(shape.find((p) => p[0] === 'Lowest point')![1]).toBe('Outside the span: the cable rises, or falls, all the way from one support to the other.');
    expect(shape.find((p) => p[0] === 'Sag below the lower support, s')![1]).toBe('0: the lowest point is the lower support.');
    expect(html).not.toContain('class="mp-cs-fig__harrow"');
    const angles = rowsOf(cardsOf(html).of('Tensions at the supports')).map((r) => r[3]);
    expect(angles.some((a) => a.startsWith('−'))).toBe(true);
  });
});

describe('a change of state, as the server sends it', () => {
  const html = show('en', state);

  it('is the 300 ft rope cooled by 40 °F and loaded with ice: its pretension rises by 1.541', () => {
    expect(pairsOf(html.match(/<dl class="mp-app__dl mp-cs__headline">[\s\S]*?<\/dl>/)![0])).toEqual([
      ['Pretension in state 2, H', '5.086 kip'],
      ['State 2 ÷ state 1, H', '1.541'],
      ['Sag at midspan in state 2', '6.105 ft'],
      ['Largest tension in state 2', '5.102 kip at both supports'],
    ]);
    expect(issueList(html)).toEqual([]);
    expect(warningList(html)).toEqual([]);
  });

  it('agrees with the textbook’s cubic to its own approximations (5.0873 kip)', () => {
    const h2 = Number(pairsOf(html.match(/<dl class="mp-app__dl mp-cs__headline">[\s\S]*?<\/dl>/)![0])[0][1].replace(' kip', ''));
    expect(Math.abs(h2 - 5.0873) / 5.0873).toBeLessThan(5e-4);
    expect(Math.abs(3.301 - 0.0017605 * 300 ** 2 / 48)).toBeLessThan(2e-3);
  });

  it('has the groups of a change of state, in order', () => {
    expect(legends(html)).toEqual(['What to calculate', 'Span and supports', 'State 1: the cable as first set up', 'State 2: the cable afterwards', 'Section and material', 'Tables']);
    expect(radiosOf(html, 'cable-mode')).toEqual([['Hanging cable', false], ['Change of state', true], ['Cable with point loads', false]]);
    expect(field(html, 'Temperature in state 1')).toMatchObject({ value: '60', unit: '°F' });
    expect(field(html, 'Temperature in state 2')).toMatchObject({ value: '20', unit: '°F' });
    expect(field(html, 'Ice or extra weight on the cable, per length')).toMatchObject({ value: '1', unit: 'lb/ft' });
    expect(field(html, 'Thermal expansion, α')).toMatchObject({ value: '6.5', unit: '10⁻⁶/°F' });
    expect(fieldsOf(html.slice(html.indexOf('Tables</legend>'))).map((f) => [f.label, f.value])).toEqual([
      ['From', '0'],
      ['To', '100'],
      ['Step', '10'],
      ['Load factor from', '0'],
      ['To', '3'],
      ['Rows', '7'],
    ]);
  });

  it('puts state 1 and state 2 side by side, with the change', () => {
    const card = cardsOf(html).of('State 1 and state 2');
    expect(headOf(card)).toEqual(['Quantity', 'State 1', 'State 2', 'Change']);
    const rows = rowsOf(card);
    expect(rows.map((r) => r[0])).toEqual([
      'Load per length, own weight included (lb/ft)',
      'Temperature (°F)',
      'Pretension, H (kip)',
      'Sag at midspan (ft)',
      'Tension at support A (kip)',
      'Tension at support B (kip)',
      'Largest tension (kip)',
      'Length under load (ft)',
      'Unstretched length (ft)',
    ]);
    // 1.761 lb/ft of rope, 1 lb/ft of ice; 60 °F to 20 °F.
    expect(rows[0].slice(1)).toEqual(['1.761', '2.761', '+1']);
    expect(rows[1].slice(1)).toEqual(['60', '20', '−40']);
    expect(rows[2].slice(1)).toEqual(['3.301', '5.086', '+1.785']);
    expect(rows[3].slice(1)).toEqual(['6', '6.105', '+0.1048']);
    // The cable is shorter in the cold (6.5e-6 × −40 × 300 ft = −0.078 ft) and longer under the ice's load.
    expect(rows[8][3]).toMatch(/^−0\.078/);
    expect(rows.flat().every((c) => !noise.test(c))).toBe(true);
  });

  it('says what changed: the temperature, the thermal strain and the ratio', () => {
    expect(pairsOf(cardsOf(html).of('What changed'))).toEqual([
      ['Temperature change', '−40 °F'],
      ['Thermal strain, α·ΔT', '−0.026 %'],
      ['Pretension, state 2 ÷ state 1', '1.541'],
    ]);
  });

  it('gives state 2 in detail: the supports’ forces, the angle, the stretch', () => {
    const pairs = pairsOf(cardsOf(html).of('State 2 in detail'));
    expect(pairs.map((p) => p[0])).toEqual(['Sag ÷ span', 'Sag below the lower support, s', 'Vertical force at A', 'Vertical force at B', 'Angle below horizontal', 'Elastic stretch', 'Strain at the largest tension']);
    expect(pairs[0][1]).toBe('0.0203');
  });

  it('tabulates the cable over temperature: 11 rows from 0 to 100 °F, the one that is state 2 marked', () => {
    const card = cardsOf(html).of('Over temperature');
    expect(headOf(card)).toEqual(['Temperature (°F)', 'Pretension, H (kip)', 'H ÷ H in state 1', 'Sag at midspan (ft)', 'Largest tension (kip)', 'Length under load (ft)']);
    const rows = rowsOf(card);
    expect(rows).toHaveLength(11);
    expect(rows.map((r) => r[0])).toEqual(['0', '10', '20 · state 2', '30', '40', '50', '60', '70', '80', '90', '100']);
    // The row of state 2 is the state 2 above.
    expect(rows[2].slice(1)).toEqual(['5.086', '1.541', '6.105', '5.102', rows[2][5]]);
    // Colder is tighter and shallower; warmer is looser and deeper.
    const hs = rows.map((r) => Number(r[1]));
    const ds = rows.map((r) => Number(r[3]));
    for (let i = 1; i < 11; i++) {
      expect(hs[i]).toBeLessThan(hs[i - 1]);
      expect(ds[i]).toBeGreaterThan(ds[i - 1]);
    }
    expect(card.match(/<tr role="row" class="mp-cs__current">/g)).toHaveLength(1);
  });

  it('tabulates the cable over load: 7 factors from 0 to 3, the one that is state 2 marked, the cable’s weight kept', () => {
    const card = cardsOf(html).of('Over load');
    expect(headOf(card)[0]).toBe('Load factor');
    const rows = rowsOf(card);
    expect(rows.map((r) => r[0])).toEqual(['0', '0.5', '1 · state 2', '1.5', '2', '2.5', '3']);
    // With no ice the cable still has its own weight, so the first row is not slack.
    expect(Number(rows[0][1])).toBeGreaterThan(0);
    expect(rows[2].slice(1, 5)).toEqual(['5.086', '1.541', '6.105', '5.102']);
    const hs = rows.map((r) => Number(r[1]));
    for (let i = 1; i < 7; i++) expect(hs[i]).toBeGreaterThan(hs[i - 1]);
  });

  it('draws four small charts, each a sentence of its own, and the tables are the way to every number', () => {
    const charts = [...html.matchAll(/<svg class="mp-plot__svg mp-cs-chart__svg" role="img" aria-label="([^"]*)"/g)].map((m) => m[1]);
    expect(charts).toHaveLength(4);
    expect(charts[0]).toBe('Sag against temperature: 5.843 ft at 0 °F, 7.126 ft at 100 °F; least 5.843 ft at 0 °F, most 7.126 ft at 100 °F. The ring marks state 2.');
    expect(charts[1]).toMatch(/^Pretension against temperature: 5\.313 kip at 0 °F/);
    expect(charts[2]).toMatch(/^Sag against load factor: 5\.407 ft at 0, 7\.136 ft at 3;/);
    expect(charts[3]).toMatch(/^Pretension against load factor: 3\.662 kip at 0, 7\.502 kip at 3;/);
    expect(html.match(/<figcaption class="mp-plot__title">/g)).toHaveLength(4);
    expect(html).toContain('>Temperature (°F)<');
    expect(html).toContain('>Load factor<');
    expect(html).toContain('>Pretension, H (kip)<');
  });

  it('draws both cables, state 1 dashed, with a sag line each', () => {
    expect(html).toContain('mp-cs-fig__curve--state1');
    expect(html).toContain('mp-cs-fig__curve--state2');
    // The sag lines are tagged 1 and 2, and the figures are in a block above the drawing, not on the curves.
    expect(html).toMatch(/<text class="mp-cs-fig__label mp-cs-fig__label--dim"[^>]*>1: 6 ft<\/text>/);
    expect(html).toMatch(/<text class="mp-cs-fig__label mp-cs-fig__label--dim"[^>]*>2: 6\.105 ft<\/text>/);
    expect(html).toContain('>1 – State 1 (dashed line): sag 6 ft, pretension H 3.301 kip, tension 3.311 kip<');
    expect(html).toContain('>2 – State 2 (solid line): sag 6.105 ft, pretension H 5.086 kip, tension 5.102 kip<');
    expect(html).toContain('>state 2 pretension H 5.086 kip<');
    // The tensions at the two supports are state 2's, said so.
    expect(html).toContain('>state 2 tension 5.102 kip<');
    expect(html).toContain('Vertical scale drawn 11 times larger than the horizontal one');
    const svg = html.match(/<svg class="mp-plot__svg mp-cs-fig__svg"[^>]*>/)![0];
    expect(attr(svg, 'aria-label')).toBe('Cable over a span of 300 ft in two states. State 1: pretension 3.301 kip, sag 6 ft. State 2: pretension 5.086 kip, sag 6.105 ft.');
    expect(html).not.toContain('<span>Load arrows</span>');
  });

  it('says what a table of rows with no solution is, row by row, in plain words', () => {
    const short = show('en', { ...state, elastic: false, state: { ...state.state, T1: 60, T2: 60, low: -2000, high: 100, step: 500 } });
    const card = cardsOf(short).of('Over temperature');
    const rows = rowsOf(card);
    expect(rows.map((r) => r.length)).toEqual([2, 2, 2, 2, 6]);
    expect(rows[0]).toEqual(['−2,000', 'The cable is too short to reach across the span at this temperature.']);
    expect(rows[4][0]).toBe('0');
    expect(card.match(/colSpan="5"/g)).toHaveLength(4);
    // The chart leaves them out and says so.
    expect(short).toMatch(/aria-label="Sag against temperature:[^"]*4 rows have no solution and are left out\./);
  });

  it('puts a table that cannot be made in words, on the fields that make it, and leaves it out', () => {
    const cases: [string, CableSagForm, string, string[]][] = [
      ['a temperature step of zero', { ...state, state: { ...state.state, step: 0 } }, 'The temperature table needs a step above zero and an upper end that is not below the lower one.', ['From', 'To', 'Step']],
      ['too many rows', { ...state, state: { ...state.state, step: 1 } }, 'The temperature table would have 101 rows, and a table holds 41 at most.', ['From', 'To', 'Step']],
      ['a fraction of a row', { ...state, state: { ...state.state, factorRows: 0.5 } }, 'The load table needs a whole number of rows, from 1 to 21.', ['Load factor from', 'Rows']],
      ['a field that is not a number', { ...state, state: { ...state.state, low: Number.NaN } }, 'The temperature table needs numbers in all its fields.', ['From', 'To', 'Step']],
    ];
    for (const [name, form, sentence, marked] of cases) {
      const out = show('en', form);
      expect(text(out), name).toContain(sentence);
      const fieldset = out.slice(out.indexOf('Tables</legend>'));
      const flagged = fieldsOf(fieldset).filter((f) => f.invalid).map((f) => f.label);
      for (const label of marked) expect(flagged, `${name} ${label}`).toContain(label);
      // Tied to its message.
      const f = fieldsOf(fieldset).find((x) => x.invalid)!;
      expect(lineOf(out, f.describedBy), name).toBe(sentence);
      expect(issueList(out), name).toEqual([]);
      expect(text(out), name).toContain('Not shown: fix the fields of this table first.');
    }
    // Only the table at fault is left out.
    expect(cardsOf(show('en', { ...state, state: { ...state.state, step: 0 } })).titles).toContain('Over load');
    expect(show('en', { ...state, state: { ...state.state, step: 0 } }).match(/mp-cs-chart__svg/g)).toHaveLength(2);
  });
});

describe('a cable with point loads, as the server sends it', () => {
  const html = show('en', points);

  it('is the 60 ft cable with 10, 20 and 10 kip, 12 ft deep under the middle one: 37.5 kip of pretension', () => {
    expect(pairsOf(html.match(/<dl class="mp-app__dl mp-cs__headline">[\s\S]*?<\/dl>/)![0])).toEqual([
      ['Pretension, H', '37.5 kip'],
      ['Largest tension', '42.5 kip piece 1'],
      ['Length of the cable', '65.048 ft'],
      ['Lowest point', 'Load 2 12 ft below support A'],
    ]);
    expect(issueList(html)).toEqual([]);
    expect(warningList(html)).toEqual([]);
  });

  it('has the groups of a cable with point loads, three load rows, and the known', () => {
    expect(legends(html)).toEqual(['What to calculate', 'Span and supports', 'Point loads', 'What is known']);
    expect(radiosOf(html, 'cable-mode')[2]).toEqual(['Cable with point loads', true]);
    expect(html.match(/class="mp-app__item mp-cs__item" role="group" aria-label="Load \d"/g)).toHaveLength(3);
    expect(field(html, 'Position of the sag')).toMatchObject({ value: '30', unit: 'ft' });
    expect(field(html, 'Sag there')).toMatchObject({ value: '12', unit: 'ft' });
    const rows = [...html.matchAll(/aria-label="Load (\d)"[\s\S]*?<\/div><\/div>(?=<div class="mp-app__item|<button)/g)];
    expect(rows).toHaveLength(3);
    expect(text(html)).toContain('+ Add a load');
    expect(selectsOf(html).find((s) => s.label === 'Known')!.options).toEqual(['Sag at a position', 'Pretension (horizontal tension), H', 'Largest tension']);
    expect(html).not.toContain('aria-disabled="true"');
  });

  it('gives every joint: its place, its level under the supports, its load', () => {
    const card = cardsOf(html).of('Joints of the funicular polygon');
    expect(headOf(card)).toEqual(['Joint', 'Position from A (ft)', 'Level, up from A (ft)', 'Below the chord (ft)', 'Load (kip)']);
    // M₀(15) = 20 · 15 = 300; 300 / 37.5 = 8 ft; M₀(30) = 450; 450 / 37.5 = 12 ft.
    expect(rowsOf(card)).toEqual([
      ['Support A', '0', '0', '0', '—'],
      ['Load 1', '15', '−8', '8', '+10'],
      ['Load 2', '30', '−12', '12', '+20'],
      ['Load 3', '45', '−8', '8', '+10'],
      ['Support B', '60', '0', '0', '—'],
    ]);
  });

  it('gives every piece: its run, its rise, its length, its angle and its tension, the largest marked', () => {
    const card = cardsOf(html).of('Pieces of cable');
    expect(headOf(card)).toEqual(['Piece', 'Between', 'Horizontal run (ft)', 'Rise (ft)', 'Length (ft)', 'Angle (°)', 'Tension (kip)']);
    // 8-15-17 triangles at the ends: 17 ft, 37.5 × 17/15 = 42.5 kip; 15.524 ft, 38.81 kip at the middle.
    expect(rowsOf(card)).toEqual([
      ['1', 'A – 1', '15', '−8', '17', '−28.07', '42.5 · largest'],
      ['2', '1 – 2', '15', '−4', '15.52', '−14.93', '38.81'],
      ['3', '2 – 3', '15', '+4', '15.52', '+14.93', '38.81'],
      ['4', '3 – B', '15', '+8', '17', '+28.07', '42.5'],
    ]);
  });

  it('gives the totals and checks the equilibrium', () => {
    expect(pairsOf(cardsOf(html).of('Pretension and totals'))).toEqual([
      ['Pretension, H', '37.5 kip'],
      ['Vertical force at A', '20 kip upward'],
      ['Vertical force at B', '20 kip upward'],
      ['Loads added up', '40 kip'],
      ['Length of the cable', '65.048 ft'],
      ['Largest tension', '42.5 kip · piece 1'],
      ['Lowest joint', 'Load 2, 12 ft below A'],
      ['Sag given', '12 ft at 30 ft from A'],
    ]);
    const card = cardsOf(html).of('Equilibrium check');
    expect(pairsOf(card)).toEqual([
      ['Σ vertical forces, loads and supports', '0 kip'],
      ['Σ moments about A', '0 kip·ft'],
      ['Largest force left unbalanced at a joint', '0 kip'],
    ]);
    expect(text(card)).toContain('In balance: the loads and the supports cancel out, and every joint is in equilibrium too.');
  });

  it('draws the polygon with its joints and loads, and its sentence', () => {
    const svg = html.match(/<svg class="mp-plot__svg mp-cs-fig__svg"[^>]*>/)![0];
    expect(attr(svg, 'aria-label')).toBe('Cable over a span of 60 ft with 3 point loads. Pretension 37.5 kip, largest tension 42.5 kip, lowest point Load 2, 12 ft below A.');
    expect(html).toContain('>sag 12 ft<');
    expect(html).toContain('<span>Point load: a longer arrow is a larger load</span>');
    expect(html).not.toContain('<span>Load arrows</span>');
  });

  it('solves for the pretension given, and for the largest tension given', () => {
    const h = show('en', { ...points, pointsKnown: 'H', pointsH: 37.5 });
    expect(pairsOf(cardsOf(h).of('Pretension and totals'))[0]).toEqual(['Pretension, H', '37.5 kip']);
    expect(pairsOf(cardsOf(h).of('Pretension and totals')).some((p) => p[0] === 'Sag given')).toBe(false);
    expect(field(h, 'Pretension, H')).toMatchObject({ value: '37.5', unit: 'kip' });
    const t = show('en', { ...points, pointsKnown: 'T-max', pointsT: 42.5 });
    expect(pairsOf(cardsOf(t).of('Pretension and totals'))[0][1]).toMatch(/^37\.5\d* kip$|^37\.5 kip$/);
    expect(field(t, 'Largest tension')).toMatchObject({ value: '42.5', unit: 'kip' });
  });

  it('shows a load that pulls up with its minus sign, and warns', () => {
    const html2 = show('en', withPoints(points, [row(1, 15, -4), row(2, 30, 20), row(3, 45, 10)]));
    expect(warningList(html2)).toEqual(['1 point load pulls up. The polygon may rise above its chord.']);
    expect(rowsOf(cardsOf(html2).of('Joints of the funicular polygon'))[1][4]).toBe('−4');
  });
});

describe('twelve point loads, and one more than that', () => {
  const twelve = withPoints({ ...points, span: 130, sagAt: 60, pointsSag: 12 }, Array.from({ length: 12 }, (_, i) => row(i + 1, 10 * (i + 1), 5)));

  it('solves twelve loads: every joint and piece is listed, and the button that adds a thirteenth is held and says why', () => {
    const html = show('en', twelve);
    expect(MAX_POINT_LOADS).toBe(12);
    expect(issueList(html)).toEqual([]);
    expect(html.match(/class="mp-app__item mp-cs__item" role="group" aria-label="Load \d+"/g)).toHaveLength(12);
    expect(rowsOf(cardsOf(html).of('Joints of the funicular polygon'))).toHaveLength(14);
    expect(rowsOf(cardsOf(html).of('Pieces of cable'))).toHaveLength(13);
    expect(html).toMatch(/<button type="button" class="mp-app__add" aria-disabled="true" aria-describedby="[^"]+">/);
    expect(text(html)).toContain('A cable holds 12 point loads at most.');
    const id = attr(html.match(/<button type="button" class="mp-app__add"[^>]*>/)![0], 'aria-describedby');
    expect(html).toContain(`id="${id}"`);
    expect(html.match(/aria-label="Remove: Load \d+"/g)).toHaveLength(12);
    expect(html.match(/<svg class="mp-plot__svg mp-cs-fig__svg"[^>]*aria-label="([^"]*)"/)![1]).toContain('with 12 point loads');
    expect(noise.test(text(html))).toBe(false);
  });

  it('draws twelve joints and twelve arrows', () => {
    const html = show('en', twelve);
    const drawn = html.slice(0, html.indexOf('<ul class="mp-cs-fig__legend">'));
    expect(drawn.match(/class="mp-cs-fig__pointload"/g)).toHaveLength(12);
    expect(drawn.match(/class="mp-cs-fig__joint"/g)).toHaveLength(12);
  });

  it('refuses a thirteenth, in words, on the list and in the box', () => {
    const html = show('en', withPoints(twelve, Array.from({ length: 13 }, (_, i) => row(i + 1, 9 * (i + 1), 5))));
    expect(issueList(html)).toEqual(['Point loads: No more than 12 point loads can go on a cable, and this one has 13.']);
    expect(text(html)).toContain('No more than 12 point loads can go on a cable, and this one has 13.');
    expect(text(html)).toContain('This cable cannot be solved yet');
  });

  it('says the limit when the add button was pressed at the limit', () => {
    const html = show('en', { ...withPoints(points, [row(1, 15, 10)]), notice: { code: 'limit', list: 'points', max: 12 } });
    expect(text(html)).toContain('A cable holds 12 point loads at most.');
  });

  it('copes with a cable with no loads at all: the example form, empty, with its reason', () => {
    const html = show('en', withPoints(points, []));
    expect(text(html)).toContain('No point load yet. Add one.');
    expect(issueList(html)).toHaveLength(1);
    expect(cardsOf(html).titles).toEqual([]);
    expect(text(html)).toContain('Results show up here once the cable has a solution.');
  });
});

/** The sentence under the drawing, or null where there is none. */
const readingOf = (html: string) => {
  const m = html.match(/<p class="mp-cs__reading">([^<]*)<\/p>/);
  return m ? text(m[1]) : null;
};

describe('the reading under each drawing', () => {
  const stateOf = (over: Partial<CableSagForm['state']>, form: Partial<CableSagForm> = {}): CableSagForm => ({ ...state, ...form, state: { ...state.state, ...over } });

  it('reads the hanging example in plain words, from the numbers, in both languages', () => {
    expect(readingOf(show('en'))).toBe('To hang with a 10 ft sag at midspan over a 100 ft span, the cable must be pulled with 12.5 kip horizontally (the pretension); it pulls on each support with 13.46 kip.');
    expect(readingOf(show('es'))).toBe('Para colgar con una flecha de 10 ft en el centro de una luz de 100 ft, el cable debe tensarse con 12.5 kip en horizontal (la pretensión); tira de cada apoyo con 13.46 kip.');
  });

  const HANGING: [string, CableSagForm, RegExp, RegExp][] = [
    ['the sag at midspan given', base, /^To hang with a 10 ft sag at midspan over a 100 ft span, the cable must be pulled with 12\.5 kip horizontally \(the pretension\); it pulls on each support with 13\.46 kip\.$/, /^Para colgar con una flecha de 10 ft en el centro de una luz de 100 ft, el cable debe tensarse con 12\.5 kip/],
    ['the sag below the lower support given, on a sloping span', inclined, /^To dip 12 ft below its lower support over a 100 ft span, the cable must be pulled with 6\.01\d* kip horizontally \(the pretension\); it pulls on support A with 7\.11\d* kip and on support B with 8\.636 kip\.$/, /^Para bajar 12 ft por debajo de su apoyo más bajo en una luz de 100 ft, el cable debe tensarse con 6\.01/],
    ['the pretension given', { ...base, known: 'H', H: 12.5 }, /^Pulled with 12\.5 kip horizontally \(the pretension\), the cable hangs with a 10 ft sag at midspan over a 100 ft span; it pulls on each support with 13\.46 kip\.$/, /^Tensado con 12\.5 kip en horizontal \(la pretensión\), el cable cuelga con una flecha de 10 ft en el centro de una luz de 100 ft; tira de cada apoyo con 13\.46 kip\.$/],
    ['the tension at the higher support given', { ...base, known: 'T-high', T: 13.5 }, /^With 13\.5 kip at each support, the cable hangs over a 100 ft span with a 9\.96\d* ft sag at midspan and is pulled with 12\.5\d* kip horizontally \(the pretension\); it pulls on each support with 13\.5 kip\.$/, /^Con 13\.5 kip en cada apoyo, el cable cuelga en una luz de 100 ft con una flecha de 9\.96/],
    ['the tension at the lower support given, on a sloping span', { ...base, rise: 20, known: 'T-low', T: 8 }, /^With 8 kip at its lower support, the cable hangs over a 100 ft span with a [\d.]+ ft sag at midspan and is pulled with [\d.]+ kip horizontally \(the pretension\); it pulls on support A with 8 kip and on support B with [\d.]+ kip\.$/, /^Con 8 kip en su apoyo más bajo, el cable cuelga en una luz de 100 ft con una flecha de/],
    ['the length given', { ...base, known: 'length', length: 102.5 }, /^Cut to 102\.5 ft before it stretches, the cable hangs over a 100 ft span with a 9\.9\d* ft sag at midspan and is pulled with 12\.6\d* kip horizontally \(the pretension\); it pulls on each support with 13\.5\d* kip\.$/, /^Cortado a 102\.5 ft antes de estirarse, el cable cuelga en una luz de 100 ft con una flecha de 9\.9/],
    ['a cable under its own weight and a load', combined, /^To hang with a 20 ft sag at midspan over a 100 ft span, the cable must be pulled with [\d.]+ kip horizontally/, /^Para colgar con una flecha de 20 ft en el centro/],
    ['a lowest point outside the span', steep, /^To hang with a 5 ft sag at midspan over a 100 ft span, the cable must be pulled with 25 kip horizontally \(the pretension\); it pulls on support A with 29\.15 kip and on support B with 35\.36 kip\.$/, /^Para colgar con una flecha de 5 ft en el centro de una luz de 100 ft, el cable debe tensarse con 25 kip en horizontal \(la pretensión\); tira del apoyo A con 29\.15 kip y del apoyo B con 35\.36 kip\.$/],
    ['a cable that does not stretch', { ...base, elastic: false }, /^To hang with a 10 ft sag at midspan/, /^Para colgar con una flecha de 10 ft/],
    ['a typed weight and no added load', { ...base, weightFrom: 'typed', typedWeight: 2, q: 0, sag: 2 }, /^To hang with a 2 ft sag at midspan over a 100 ft span, the cable/, /^Para colgar con una flecha de 2 ft/],
    ['the example in metres and kilonewtons', defaultCaseFor('hanging', 'si'), /^To hang with a 3\.048 m sag at midspan over a 30\.48 m span, the cable must be pulled with 55\.6\d* kN horizontally \(the pretension\); it pulls on each support with 59\.8\d* kN\.$/, /^Para colgar con una flecha de 3\.048 m en el centro de una luz de 30\.48 m/],
  ];
  for (const [name, form, en, es] of HANGING) {
    it(`reads a hanging cable with ${name}`, () => {
      const a = readingOf(show('en', form));
      const b = readingOf(show('es', form));
      expect(a, name).toMatch(en);
      expect(b, name).toMatch(es);
      for (const s of [a!, b!]) {
        expect(s).not.toMatch(noise);
        expect(s.endsWith('.')).toBe(true);
        expect(s).not.toMatch(/\{|\}|undefined/);
      }
    });
  }

  it('agrees with the numbers of the page: the pretension and the tension of the reading are those of the headline', () => {
    for (const [, form] of HANGING) {
      const html = show('en', form);
      const head = pairsOf(html.match(/<dl class="mp-app__dl mp-cs__headline">[\s\S]*?<\/dl>/)![0]);
      const reading = readingOf(html)!;
      expect(reading.toLowerCase()).toContain(`pulled with ${head[0][1]} horizontally`.toLowerCase());
    }
  });

  it('reads a change of state in the direction each thing really goes', () => {
    expect(readingOf(show('en', state))).toBe('When the temperature goes from 60 °F to 20 °F and the load per length goes from 1.761 lb/ft to 2.761 lb/ft, the pretension rises from 3.301 kip to 5.086 kip and the sag at midspan grows from 6 ft to 6.105 ft. At midspan the two cables are 0.1048 ft apart.');
    expect(readingOf(show('es', state))).toBe('Cuando la temperatura pasa de 60 °F a 20 °F y la carga por longitud pasa de 1.761 lb/ft a 2.761 lb/ft, la pretensión sube de 3.301 kip a 5.086 kip y la flecha en el centro crece de 6 ft a 6.105 ft. En el centro los dos cables quedan a 0.1048 ft de distancia.');
    // A warmer cable with the same load: the pretension falls and the sag grows.
    const warm = readingOf(show('en', stateOf({ T2: 100, ice: 0 })))!;
    expect(warm).toMatch(/^When the temperature goes from 60 °F to 100 °F, the pretension falls from 3\.30\d* kip to [\d.]+ kip and the sag at midspan grows from 6 ft to [\d.]+ ft\. At midspan the two cables are [\d.]+ ft apart\.$/);
    // Heavy ice on a cold cable: the pretension rises while the sag shrinks.
    expect(readingOf(show('en', stateOf({ ice: 3 }, { span: 100, sag: 15 })))).toMatch(/the pretension rises from [\d.]+ kip to [\d.]+ kip and the sag at midspan shrinks from 15 ft to 14\.9\d* ft\. At midspan the two cables are [\d.]+ ft apart\.$/);
    expect(readingOf(show('es', stateOf({ ice: 3 }, { span: 100, sag: 15 })))).toMatch(/la pretensión sube de [\d.]+ kip a [\d.]+ kip y la flecha en el centro disminuye de 15 ft a 14\.9\d* ft\. En el centro los dos cables quedan a [\d.]+ ft de distancia\.$/);
    // Only the load changes.
    expect(readingOf(show('en', stateOf({ T2: 60 })))).toMatch(/^When the load per length goes from 1\.761 lb\/ft to 2\.761 lb\/ft, the pretension rises/);
    // Nothing changes.
    expect(readingOf(show('en', stateOf({ T2: 60, ice: 0 })))).toBe('When neither temperature nor load changes, the pretension stays at 3.301 kip and the sag at midspan stays at 6 ft.');
    expect(readingOf(show('es', stateOf({ T2: 60, ice: 0 })))).toBe('Cuando no cambian ni la temperatura ni la carga, la pretensión se mantiene en 3.301 kip y la flecha en el centro se mantiene en 6 ft.');
  });

  it('reads a change of state whatever is known of state 1', () => {
    for (const form of [stateOf({}, { known: 'H', H: 3 }), stateOf({}, { known: 'T-high', T: 3.1 }), stateOf({}, { known: 'length', length: 300.3 }), stateOf({}, { known: 'sag', sagKind: 'low', sag: 6 }), stateOf({}, { elastic: false, rise: 20 })]) {
      for (const lang of LANGS) {
        const s = readingOf(show(lang, form))!;
        expect(s, `${lang} ${form.known}`).toMatch(lang === 'en' ? /^When the temperature goes from 60 °F to 20 °F/ : /^Cuando la temperatura pasa de 60 °F a 20 °F/);
        expect(s).not.toMatch(noise);
      }
    }
  });

  it('reads the temperatures of a metric change of state in degrees Celsius', () => {
    expect(readingOf(show('en', defaultCaseFor('state', 'si')))).toMatch(/^When the temperature goes from 15\.56 °C to −6\.667 °C and the load per length goes from/);
  });

  it('reads a cable with point loads, from the sag given, and from the pretension or the largest tension given', () => {
    expect(readingOf(show('en', points))).toBe('With a 12 ft sag at 30 ft from support A, the cable is pulled with 37.5 kip horizontally; the steepest piece, between support A and load 1, carries 42.5 kip.');
    expect(readingOf(show('es', points))).toBe('Con una flecha de 12 ft a 30 ft del apoyo A, el cable se tensa con 37.5 kip en horizontal; el tramo más inclinado, entre apoyo A y carga 1, soporta 42.5 kip.');
    expect(readingOf(show('en', { ...points, pointsKnown: 'H', pointsH: 30 }))).toBe('Pulled with 30 kip horizontally, the cable’s lowest point, load 2, is 15 ft below support A; the steepest piece, between support A and load 1, carries 36.06 kip.');
    expect(readingOf(show('es', { ...points, pointsKnown: 'H', pointsH: 30 }))).toBe('Tensado con 30 kip en horizontal, el punto inferior del cable, carga 2, queda 15 ft bajo el apoyo A; el tramo más inclinado, entre apoyo A y carga 1, soporta 36.06 kip.');
    expect(readingOf(show('en', { ...points, pointsKnown: 'T-max', pointsT: 42.5 }))).toMatch(/^With 42\.5 kip as its largest tension, the cable is pulled with 37\.5\d* kip horizontally and its lowest point, load 2, is 12 ft below support A; the steepest piece, between support A and load 1, carries 42\.5 kip\.$/);
  });

  it('reads a point-load cable whose lowest point is not at the middle, and one whose lowest point is a support', () => {
    const off = withPoints({ ...points, pointsKnown: 'T-max', pointsT: 50 }, [row(1, 10, 10), row(2, 20, 30), row(3, 50, 10)]);
    expect(readingOf(show('en', off))).toBe('With 50 kip as its largest tension, the cable is pulled with 40 kip horizontally and its lowest point, load 2, is 12.5 ft below support A; the steepest piece, between support A and load 1, carries 50 kip.');
    // A load that pulls up can leave a support the lowest joint.
    const up = withPoints({ ...points, pointsKnown: 'H', pointsH: 40 }, [row(1, 15, -4), row(2, 30, 20), row(3, 45, 0)]);
    for (const lang of LANGS) {
      const s = readingOf(show(lang, up))!;
      expect(s).toBeTruthy();
      expect(s).not.toMatch(noise);
      expect(s.endsWith('.')).toBe(true);
    }
    // A cable with one load, and one with twelve.
    expect(readingOf(show('en', withPoints(points, [row(1, 30, 10)])))).toMatch(/^With a 12 ft sag at 30 ft from support A/);
    const twelve = withPoints({ ...points, span: 130, sagAt: 60, pointsSag: 12 }, Array.from({ length: 12 }, (_, i) => row(i + 1, 10 * (i + 1), 5)));
    expect(readingOf(show('en', twelve))).toMatch(/^With a 12 ft sag at 60 ft from support A, the cable is pulled with [\d.]+ kip horizontally; the steepest piece, between support A and load 1, carries [\d.]+ kip\.$/);
  });

  it('says nothing where there is no solution: the box of problems speaks', () => {
    for (const problem of PROBLEMS) for (const lang of LANGS) expect(readingOf(show(lang, problem.form())), `${lang} ${problem.code}`).toBeNull();
    expect(show('en', { ...base, span: 0 })).not.toContain('mp-cs__reading');
  });

  it('says it for every cable that has a solution, every warning included, with no noise', () => {
    for (const warning of WARNINGS) for (const lang of LANGS) {
      const s = readingOf(show(lang, warning.form()));
      expect(s, `${lang} ${warning.code}`).toBeTruthy();
      expect(s, `${lang} ${warning.code}`).not.toMatch(noise);
    }
  });

  it('stands under its drawing, before the line that says the drawing is to scale', () => {
    for (const form of [base, state, points]) {
      const html = show('en', form);
      const at = html.indexOf('class="mp-cs__reading"');
      expect(at).toBeGreaterThan(html.indexOf('mp-cs-fig__legend'));
      expect(at).toBeLessThan(html.indexOf('Horizontal distances are to scale'));
    }
  });
});

describe('what the drawing says in words', () => {
  it('names the two sags, and the pretension, on the drawing', () => {
    const level = show('en');
    expect(level).toContain('>sag 10 ft<');
    expect(level).toContain('>pretension H 12.5 kip<');
    expect(level).not.toMatch(/>d = |>s = |>H = |>T = /);
    const sloping = show('en', inclined);
    expect(sloping).toMatch(/>sag at midspan [\d.]+ ft</);
    expect(sloping).toMatch(/>sag below lower support 12 ft</);
    const es = show('es', inclined);
    expect(es).toMatch(/>flecha en el centro [\d.]+ ft</);
    expect(es).toMatch(/>flecha bajo el apoyo más bajo 12 ft</);
    expect(show('es')).toContain('>pretensión H 12.5 kip<');
  });

  it('puts a title above each chart in words, and says what the ring is where it can be seen', () => {
    const html = show('en', state);
    expect([...html.matchAll(/<figcaption class="mp-plot__title">([^<]*)<\/figcaption>/g)].map((m) => m[1])).toEqual(['Sag against temperature', 'Pretension against temperature', 'Sag against load factor', 'Pretension against load factor']);
    expect(html.match(/<p class="mp-app__note">The ring marks state 2\.<\/p>/g)).toHaveLength(2);
    const es = show('es', state);
    expect([...es.matchAll(/<figcaption class="mp-plot__title">([^<]*)<\/figcaption>/g)].map((m) => m[1])).toEqual(['Flecha según la temperatura', 'Pretensión según la temperatura', 'Flecha según el factor de carga', 'Pretensión según el factor de carga']);
    expect(es).toContain('El anillo marca el estado 2.');
  });

  it('tells the two states apart by a legend and by pattern, and says whose figures the labels carry', () => {
    const html = show('en', state);
    expect(html).toContain('<span>State 1: dashed line</span>');
    expect(html).toContain('<span>State 2: solid line</span>');
    expect(html).toContain('>2 – State 2 (solid line): sag 6.105 ft, pretension H 5.086 kip, tension 5.102 kip<');
    const css = readFileSync(join(SRC, 'components/ttc/calc/cable-sag/cable-sag.css'), 'utf8').replace(/\r\n/g, '\n');
    expect(css).toMatch(/\.mp-cs-fig__curve--state1,\s*\.mp-cs-fig__curve--state1 path \{[^}]*stroke-dasharray: 3 4;/);
  });

  it('says under each drawing that the vertical scale is stretched, by how much, and that the scale bar is the horizontal one', () => {
    const level = show('en');
    expect(level).toContain('Vertical scale drawn 2 times larger than the horizontal one');
    expect(level).toContain('>20 ft horizontal<');
    const shallow = show('en', state);
    expect(shallow).toContain('<p class="mp-cs-fig__stretch">Vertical scale drawn 11 times larger than the horizontal one, so that the sag can be seen. Widths are to scale; heights are not.</p>');
    expect(shallow).toContain('<span>Vertical scale stretched 11 times, so the sag shows</span>');
    expect(shallow).toContain('>50 ft horizontal<');
    const es = show('es', state);
    expect(es).toContain('Escala vertical dibujada 11 veces mayor que la horizontal');
    expect(es).toContain('>50 ft en horizontal<');
    // A deep cable is drawn true.
    expect(show('en', { ...base, sag: 30 })).not.toContain('Vertical scale drawn');
  });

  it('writes numbers as long as 1,234.56 kip in the block and on the drawing without a hole or an exponent', () => {
    const heavy = show('en', { ...state, state: { ...state.state, ice: 3000, T2: 20 }, span: 3000, sag: 60 });
    expect(heavy).not.toMatch(/NaN|undefined|Infinity|\{\w+\}/);
    expect(heavy).toContain('<g class="mp-cs-fig__block">');
  });

  it('explains every mark: the tension swatch is a number, the load arrows and the point loads have their words', () => {
    const html = show('en', points);
    expect(html).toContain('<span>Tension at a support: how hard the cable pulls on it</span>');
    expect(html).toContain('<span>Point load: a longer arrow is a larger load</span>');
    expect(html).toContain('<span>Joint number</span>');
    expect(html).toContain('<span>Support A on the left, B on the right</span>');
    expect(show('en')).toContain('<span>Pretension H: the horizontal pull, drawn at the lowest point</span>');
  });
});

describe('every problem, on its field and in the box', () => {
  for (const problem of PROBLEMS) {
    it(`${problem.code}: ${problem.en.source.slice(1, 50)}…`, () => {
      const en = show('en', problem.form());
      expect(issueList(en), problem.code).toHaveLength(1);
      expect(issueList(en)[0], problem.code).toMatch(problem.en);
      expect(text(en), problem.code).toContain('This cable cannot be solved yet');
      // Nothing is solved, so no result is printed.
      expect(en, problem.code).not.toContain('mp-cs__headline');
      expect(cardsOf(en).titles, problem.code).toEqual([]);
      expect(text(en), problem.code).toContain('Results show up here once the cable has a solution.');
      expect(en.match(/<svg class="mp-plot__svg mp-cs-fig__svg"[^>]*aria-label="([^"]*)"/)![1], problem.code).toBe('No solution yet for this cable: the list beside the drawing says what to fix.');
      // Said in Spanish too.
      const es = show('es', problem.form());
      expect(issueList(es), problem.code).toHaveLength(1);
      expect(issueList(es)[0], problem.code).toMatch(problem.es);
      for (const html of [en, es]) {
        expect(issueList(html)[0], problem.code).not.toMatch(noise);
        expect(text(html), problem.code).not.toMatch(/\{\w+(\|[^}]*)?\}/);
      }
    });
  }

  it('ties each field at fault to its message, by aria-describedby, and marks nothing else', () => {
    for (const problem of PROBLEMS.filter((p) => p.marks)) {
      const html = show('en', problem.form());
      const flagged = fieldsOf(html).filter((f) => f.invalid);
      expect(flagged.map((f) => f.label), problem.code).toEqual(expect.arrayContaining(problem.marks!));
      expect(flagged.length, problem.code).toBeLessThanOrEqual(problem.marks!.length);
      for (const f of flagged) {
        expect(f.describedBy, `${problem.code} ${f.label}`).toBeTruthy();
        const line = lineOf(html, f.describedBy);
        expect(line.length, `${problem.code} ${f.label}`).toBeGreaterThan(10);
        // The message on the field is the box’s, less the name of the group.
        expect(issueList(html)[0].endsWith(line), `${problem.code} ${f.label}`).toBe(true);
      }
    }
  });

  it('marks the row of a load that is at fault, and only that row', () => {
    const html = show('en', withPoints(points, [row(1, 15, 10), row(2, 70, 5), row(3, 45, 10)]));
    expect([...html.matchAll(/aria-label="(Load \d)"( data-invalid="true")?>/g)].map((m) => [m[1], Boolean(m[2])])).toEqual([['Load 1', false], ['Load 2', true], ['Load 3', false]]);
    expect(issueList(html)[0]).toMatch(/^Load 2: The position 70 ft is not inside the span/);
  });

  it('says every problem once in the box even if two things are wrong', () => {
    const html = show('en', { ...base, span: 0, sag: 0 });
    const items = issueList(html);
    expect(new Set(items).size).toBe(items.length);
    expect(items.length).toBeGreaterThanOrEqual(1);
  });

  it('has no noise in any problem’s page', () => {
    for (const problem of PROBLEMS) for (const lang of LANGS) expect(noise.test(text(show(lang, problem.form()))), `${lang} ${problem.code}`).toBe(false);
  });

  it('has exactly the codes the library lists, once each', () => {
    expect([...new Set(PROBLEMS.map((p) => p.code))].sort()).toEqual(
      ['number', 'span', 'rise', 'load-zero', 'section', 'known-value', 'sag-range', 'length-below-chord', 'tension-below-minimum', 'state2-load-zero', 'state2-too-short', 'thermal', 'too-many-loads', 'load-position', 'duplicate-position', 'no-loads', 'sag-position', 'negative-tension', 'solver', 'size'].sort(),
    );
    // 'table' is the one the form cannot make: it makes notes instead (above). 'stopped' is the one no form can make; its sentence is held in text.test.ts.
  });
});

describe('every warning, with the cable solved', () => {
  for (const warning of WARNINGS) {
    it(`${warning.code}: ${warning.en.source.slice(1, 50)}…`, () => {
      for (const [lang, pattern] of [['en', warning.en], ['es', warning.es]] as const) {
        const html = show(lang, warning.form());
        expect(issueList(html), `${lang} ${warning.code}`).toEqual([]);
        const found = warningList(html).filter((w) => pattern.test(w));
        expect(found, `${lang} ${warning.code}`).toHaveLength(1);
        expect(found[0], `${lang} ${warning.code}`).not.toMatch(noise);
        expect(html, `${lang} ${warning.code}`).toContain('mp-cs__headline');
        expect(text(html), `${lang} ${warning.code}`).toContain(lang === 'en' ? 'To note' : 'A tener en cuenta');
      }
    });
  }
  it('has exactly the codes the library lists', () => {
    expect(WARNINGS.map((w) => w.code).sort()).toEqual(['parabola-differs', 'sag-not-at-load', 'strain-high', 'tension-two-roots', 'upward-load', 'vertex-outside', 'zero-load']);
  });
});

describe('the units', () => {
  const si = defaultCaseFor('hanging', 'si');

  it('prints the SI example in kilonewtons and metres, the same cable', () => {
    const html = show('en', si);
    const pairs = pairsOf(html.match(/<dl class="mp-app__dl mp-cs__headline">[\s\S]*?<\/dl>/)![0]);
    // 12.5 kip × 4.44822 = 55.60 kN; 100 ft = 30.48 m; sag 3.048 m.
    expect(pairs[0]).toEqual(['Pretension, H', '55.6 kN']);
    expect(pairs[2][1]).toBe('3.048 m');
    expect(pairs[3][1]).toBe('31.274 m');
    expect(field(html, 'Span, L')).toMatchObject({ value: '30.48', unit: 'm' });
    expect(field(html, 'Added load per horizontal length')).toMatchObject({ unit: 'kN/m' });
    expect(field(html, 'Nominal diameter, d')).toMatchObject({ value: '25.4', unit: 'mm' });
    expect(field(html, 'Modulus of elasticity, E')).toMatchObject({ value: '200', unit: 'GPa' });
    expect(pairsOf(cardsOf(html).of('Length and stretch'))[2][1]).toMatch(/^17\.6\d* mm$/);
    expect(radiosOf(html, 'cable-units')).toEqual([['US (ft, kip)', false], ['SI (m, kN)', true]]);
    expect(text(html)).toContain('SI (m, kN)');
  });

  it('prints every mode’s example in the other units as the same numbers, the way the unit factors say', () => {
    const kip = 4.4482216152605;
    const ft = 0.3048;
    for (const mode of ['hanging', 'state', 'points'] as CableSagMode[]) {
      const us = show('en', defaultCaseFor(mode, 'us'));
      const sisi = show('en', defaultCaseFor(mode, 'si'));
      const numbers = (html: string, unit: string) => [...text(html).matchAll(new RegExp(`(\\d[\\d,]*(?:\\.\\d+)?) ${unit}\\b`, 'g'))].map((m) => Number(m[1].replace(/,/g, '')));
      const usForces = numbers(pairsOfHeadline(us), 'kip');
      const siForces = numbers(pairsOfHeadline(sisi), 'kN');
      expect(siForces.length, mode).toBe(usForces.length);
      usForces.forEach((v, i) => expect(Math.abs(siForces[i] / (v * kip) - 1), `${mode} force ${i}`).toBeLessThan(2e-3));
      const usLengths = numbers(pairsOfHeadline(us), 'ft');
      const siLengths = numbers(pairsOfHeadline(sisi), 'm');
      expect(siLengths.length, mode).toBe(usLengths.length);
      usLengths.forEach((v, i) => expect(Math.abs(siLengths[i] / (v * ft) - 1), `${mode} length ${i}`).toBeLessThan(2e-3));
    }
  });

  it('comes back from the other units to the same page, every mode', () => {
    for (const mode of ['hanging', 'state', 'points'] as CableSagMode[]) {
      const original = defaultCaseFor(mode, 'us');
      const back = convertCableSag(convertCableSag(original, 'si'), 'us');
      expect(text(show('en', back)), mode).toBe(text(show('en', original)));
      expect(encodeCableSag(back), mode).toBe(encodeCableSag(original));
    }
  });

  it('writes the temperatures of the SI state example in °C and the expansion per °C', () => {
    const html = show('en', defaultCaseFor('state', 'si'));
    expect(field(html, 'Temperature in state 1')).toMatchObject({ unit: '°C' });
    expect(field(html, 'Thermal expansion, α')).toMatchObject({ unit: '10⁻⁶/°C' });
    expect(headOf(cardsOf(html).of('Over temperature'))[0]).toBe('Temperature (°C)');
    expect(headOf(cardsOf(html).of('Over temperature'))[1]).toBe('Pretension, H (kN)');
  });
});

/** The headline of a page, as text. */
function pairsOfHeadline(html: string): string {
  return text(html.match(/<dl class="mp-app__dl mp-cs__headline">[\s\S]*?<\/dl>/)![0]);
}

describe('the two languages', () => {
  it('prints each mode’s example in Spanish, in Spanish', () => {
    const english = /\b(Pretension|Sag|Span|Support|Tension|Length|Load|Results|Table|Over|Cable colgante)\b/;
    const heard = [
      ['hanging', ['Cable colgante', 'Luz y apoyos', 'Dato conocido', 'Sección y material', 'Tensiones en los apoyos', 'Parábola y catenaria', 'Longitud y alargamiento']],
      ['state', ['Cambio de estado', 'Estado 1 y estado 2', 'Qué cambió', 'Según la temperatura', 'Según la carga', 'estado 2']],
      ['points', ['Cable con cargas puntuales', 'Nudos del polígono funicular', 'Tramos de cable', 'Pretensión y totales', 'Comprobación del equilibrio']],
    ] as const;
    for (const [mode, words] of heard) {
      const html = show('es', defaultCaseFor(mode));
      for (const word of words) expect(text(html), `${mode} ${word}`).toContain(word);
      expect(text(html).replace(/Cable colgante/g, ''), mode).not.toMatch(english);
      expect(noise.test(text(html)), mode).toBe(false);
    }
  });

  it('writes numbers in Spanish with a narrow space between thousands and a point for the decimal', () => {
    const html = show('es', { ...base, E: 29000, span: 1500, sag: 150, q: 2000 });
    expect(pairsOf(html.match(/<dl class="mp-app__dl mp-cs__headline">[\s\S]*?<\/dl>/)![0])[0][1]).toMatch(/^\d{1,3}(\u202f\d{3})* kip$/);
    expect(field(html, 'Luz, L')).toMatchObject({ value: '1500', unit: 'ft' });
  });

  it('says the same things in the tables in both languages: the same count of rows and cards', () => {
    for (const mode of ['hanging', 'state', 'points'] as CableSagMode[]) {
      const en = cardsOf(show('en', defaultCaseFor(mode)));
      const es = cardsOf(show('es', defaultCaseFor(mode)));
      expect(es.titles.length).toBe(en.titles.length);
      en.titles.forEach((title, i) => expect(rowsOf(es.of(es.titles[i])).length, `${mode} ${title}`).toBe(rowsOf(en.of(title)).length));
    }
  });

  it('keeps the sheet’s line, the privacy line and the verdict line in each language', () => {
    for (const lang of LANGS) {
      const html = show(lang);
      expect(text(html)).toContain(beamStrings[lang].ui.results.privacy);
      expect(text(html)).toContain(cableSagUi[lang].results.note);
    }
  });
});

describe('the never-prints-noise rule', () => {
  /** A small deterministic generator, so that a failure is the same cable next time. */
  const generator = (seed: number) => () => ((seed = (seed * 1664525 + 1013904223) % 4294967296) / 4294967296);
  const range = (rand: () => number, lo: number, hi: number) => lo + rand() * (hi - lo);

  it('prints no NaN, no −0, no exponent and no hole in a hundred cables of every mode, in both units and both languages', () => {
    const rand = generator(20261016);
    for (let n = 0; n < 100; n++) {
      const mode = (['hanging', 'state', 'points'] as const)[n % 3];
      const units = n % 2 === 0 ? 'us' : 'si';
      const k = units === 'us' ? 1 : 0.3;
      const form: CableSagForm = {
        ...defaultCaseFor(mode, units),
        span: Number(range(rand, 5, 800).toPrecision(3)) * k,
        rise: n % 5 === 0 ? 0 : Number(range(rand, -60, 60).toPrecision(3)) * k,
        sag: Number(range(rand, 0.2, 40).toPrecision(3)) * k,
        q: n % 4 === 0 ? 0 : Number(range(rand, 0, 500).toPrecision(3)),
        weightFrom: n % 4 === 0 ? 'section' : n % 7 === 0 ? 'typed' : 'none',
        elastic: n % 6 !== 0,
        known: (['sag', 'H', 'T-high', 'T-low', 'length'] as const)[n % 5],
      };
      for (const lang of LANGS) {
        const html = text(show(lang, form));
        expect(noise.test(html), `#${n} ${mode} ${units} ${lang}`).toBe(false);
        expect(html, `#${n} ${mode} ${units} ${lang}`).not.toMatch(/\{\w+(\|[^}]*)?\}/);
      }
    }
  });

  it('prints no noise at the edges: a billionth of a foot, a thousand miles, zero loads, a level cable with a rise of rounding', () => {
    const forms: CableSagForm[] = [
      { ...base, span: 1e-9, sag: 1e-12, q: 1 },
      { ...base, span: 5e6, sag: 5e5, q: 1e-3 },
      { ...base, rise: 1e-13 },
      { ...base, sag: 1e-5 },
      { ...base, weightFrom: 'section', q: 0, E: 1e9 },
      { ...state, state: { ...state.state, T2: state.state.T1 } },
      { ...state, state: { ...state.state, q: 0, ice: 0, factorLow: 0, factorHigh: 0, factorRows: 1 } },
      { ...state, state: { ...state.state, low: 60, high: 60, step: 1 } },
      withPoints({ ...points, pointsKnown: 'H', pointsH: 1e-6 }, [row(1, 30, 1e-6)]),
      withPoints(points, [row(1, 1e-9, 5), row(2, 59.999999999, 5)]),
      withPoints(points, [row(1, 20, 1e-14), row(2, 40, 1e-14)]),
    ];
    for (const form of forms) for (const lang of LANGS) expect(noise.test(text(show(lang, form))), `${lang} ${encodeCableSag(form).slice(0, 60)}`).toBe(false);
  });
});

describe('the address, at component level', () => {
  const source = readFileSync(join(SRC, 'components/ttc/calc/cable-sag/CableSagCalculator.tsx'), 'utf8').replace(/\r\n/g, '\n');

  it('is written for this calculator’s key, read from the page’s address, and the example leaves it bare', () => {
    expect(source).toMatch(/useAddress<CableSagForm>\(\{\s*key: CABLE_SAG_KEY,\s*example: EXAMPLE,/);
    expect(source).toContain('const EXAMPLE = encodeCableSag(defaultCase());');
    expect(source).toContain('address.take(EXAMPLE)');
    expect(source).toContain('new RegExp(`^#${CABLE_SAG_KEY}=(.*)$`)');
    expect(source).toContain('return decodeCableSag(text);');
    expect(source).toMatch(/blank: defaultCase,/);
  });

  it('leaves the field with the focus FIRST when a case arrives, then loads it, whole', () => {
    const open = source.slice(source.indexOf('open: (found) =>'), source.indexOf('const { linkError }'));
    expect(open.indexOf('focused.blur()')).toBeGreaterThan(-1);
    expect(open.indexOf('focused.blur()')).toBeLessThan(open.indexOf("dispatch({ type: 'load', form: found })"));
    expect(open).toContain('root.current?.contains(focused)');
    expect(open).toContain('setWhole(found)');
  });

  // The decision itself, run on real forms and the real reducer (it was a pattern in the source, and the reducer never made it come true:
  // a 'load' handed back a COPY of the form, so a case opened whole was never told from a number typed).
  it('solves a case opened whole in the render that shows it, and defers only the typing of numbers', () => {
    const a = defaultCaseFor('hanging');
    const b = convertCableSag(defaultCaseFor('state'), 'si');
    // A case opened whole (an address, "Load the example", Start over): the reducer gives back the very form, so it is solved NOW, not a render behind.
    const opened = reduceCableSag(a, { type: 'load', form: b });
    expect(opened).toBe(b);
    expect(solvedFor(opened, a, b, false)).toBe(opened);
    // The same cable that differs only in NUMBERS (what a link carries so often): still told whole.
    const other = { ...a, span: 150, sag: 12 };
    const openedOther = reduceCableSag(a, { type: 'load', form: other });
    expect(openedOther).toBe(other);
    expect(solvedFor(openedOther, a, other, false)).toBe(openedOther);
    // A number typed afterwards is deferred: the answer is the cable of a moment ago.
    const typed = reduceCableSag(openedOther, { type: 'geometry', patch: { span: 151 } });
    expect(typed).not.toBe(other);
    expect(solvedFor(typed, openedOther, other, false)).toBe(openedOther);
    // A choice, the units, a load added: never behind. And paper is never behind.
    for (const action of [{ type: 'units', units: 'si' }, { type: 'mode', mode: 'hanging' }, { type: 'known', patch: { known: 'H' } }, { type: 'point-add' }] as const) {
      const before = defaultCaseFor('points');
      const next = reduceCableSag(before, action);
      expect(solvedFor(next, before, null, false), action.type).toBe(next);
    }
    expect(solvedFor(typed, openedOther, null, true)).toBe(typed);
    // The ids of the point loads are choices, not typed numbers.
    expect(source).toContain("const IDENTIFIERS = new Set(['id', 'nextId']);");
    expect(source).toContain('aria-busy={catching || staleTables ? true : undefined}');
  });

  it('puts the tables behind a typed number and not the cable: the cable first, the tables when the typing pauses', () => {
    const f = defaultCaseFor('state');
    const lean = analyseSafely(f, { tables: false });
    const whole = analyseSafely(f);
    expect(lean.state!.tables.skipped).toBe(true);
    expect(lean.state!.tables.thermal).toEqual([]);
    expect(lean.state!.tables.loads).toEqual([]);
    expect(whole.state!.tables.skipped).toBe(false);
    expect(whole.state!.tables.thermal).toHaveLength(11);
    // The cable itself is the same one, to the last figure.
    expect(lean.state!.state2).toEqual(whole.state!.state2);
    expect(lean.state!.state1).toEqual(whole.state!.state1);
    expect(lean.issues).toEqual([]);
  });

  it('brings the address to the cable on screen before copying, and before Start over throws one away', () => {
    expect(source).toMatch(/address\.take\(encodeCableSag\(form\)\);\s*return address\.link\(encodeCableSag\(form\)\);/);
    expect(source).toContain('window.history.pushState');
    expect(source).toContain('setWhole(example)');
  });

  it('prints through the shell’s sheet, with the address that reopens the case', () => {
    expect(source).toContain('useSheet({ locale: t.sheet.locale, url: () => address.link(encodeCableSag(form)) })');
    expect(source).toContain('<SheetStamp stamp={stamp} t={{ printed: t.sheet.printed, link: w.sheet.link }} />');
    for (const lang of LANGS) expect(cableSagUi[lang].sheet.link).toContain('{url}');
    expect(source).toContain('const width = onPaper ? PAPER_WIDTH : windowWidth;');
  });

  it('reads an address back into the very same page, every mode, and opens nothing for what it cannot read', () => {
    const forms: CableSagForm[] = [base, state, points, combined, inclined, tensionTwo, defaultCaseFor('state', 'si'), withPoints(points, Array.from({ length: 12 }, (_, i) => row(i + 1, 4 * (i + 1), 2)))];
    for (const form of forms) {
      const read = decodeCableSag(encodeCableSag(form))!;
      expect(read).not.toBeNull();
      expect(text(show('en', read))).toBe(text(show('en', form)));
    }
    expect(decodeCableSag('')).toBeNull();
    expect(decodeCableSag('garbage')).toBeNull();
    expect(decodeCableSag(encodeCableSag(base).slice(0, -3))).toBeNull();
  });

  it('opens a mode’s example when the mode is chosen on a cable nobody has edited, and keeps an edited cable’s numbers', () => {
    expect(source).toContain("dispatch({ type: 'mode', mode, example: untouched });");
    expect(source).toContain('encodeCableSag(form) === encodeCableSag(defaultCaseFor(form.mode, form.units))');
    expect(source).toContain('setWhole(example)');
  });
});

describe('the rules of the tool, as they stand in its source', () => {
  const read = (file: string) => readFileSync(join(SRC, 'components/ttc/calc/cable-sag', file), 'utf8').replace(/\r\n/g, '\n');
  const source = read('CableSagCalculator.tsx');
  const schematic = read('CableSchematic.tsx');
  const chart = read('SweepChart.tsx');
  const css = read('cable-sag.css');

  it('carries neither language: its words are props, and the strings are imported as types only', () => {
    for (const file of [source, schematic, chart]) {
      expect(file).not.toMatch(/import (?!type)[^;]*from '@\/lib\/calc\/cable-sag\/strings'/);
      expect(file).not.toMatch(/from '@\/lib\/calc\/(beam|shaft|continuous|truss)\/strings'/);
    }
    expect(source).toContain("'use client';");
    expect(schematic).toContain("'use client';");
    expect(chart).toContain("'use client';");
    expect(source).toContain("import './cable-sag.css';");
  });

  it('solves through the door that never throws, and decides no number of its own', () => {
    expect(source).toContain('analyseSafely(solved, { tables: tablesNow })');
    expect(source).not.toMatch(/\b(solveHanging|solveState|solvePoints)\b/);
    expect(source).not.toMatch(/\bMath\.(sqrt|hypot|atan2|cosh|exp|log)\b/);
  });

  it('uses the shell’s pieces and not copies of them', () => {
    for (const piece of ["from '../shell/Actions'", "from '../shell/address'", "from '../shell/layout'", "from '../shell/sheet'", "from '../shell/fields'", "from './CsNum'"]) expect(source).toContain(piece);
    // The number field is the shared one, wrapped for what it leaves to the page (a line under a text that is not a number, at once).
    expect(read('CsNum.tsx')).toContain("from '../NumField'");
    expect(source).not.toContain("from '../NumField'");
  });

  it('hands the keyboard its focus when a row is added or removed with it, as the others do', () => {
    expect(source).toContain('press.detail === 0');
    expect(source).toContain("flushSync(() => dispatch({ type: 'point-add' }))");
    expect(source).toContain('next?.focus()');
  });

  it('measures the tables’ container and the drawing’s once each, from elements that are always there', () => {
    expect(source).toContain('const [tablesRef, tablesWidth] = useWidth<HTMLDivElement>();');
    expect(source).toMatch(/<div className="mp-app__tables mp-cs__tables" ref=\{tablesRef\}/);
    expect(source).toMatch(/<div className="mp-app__plots" ref=\{plotRef\}>/);
  });

  it('takes the mode’s tabs, the example button, the switches and the limit line off the sheet, and holds the drawing whole', () => {
    const print = css.slice(css.indexOf('@media print'));
    for (const hidden of ['.mp-cs .mp-cs__example', '.mp-cs .mp-cs__options', '.mp-cs .mp-cs__limit']) expect(print).toContain(hidden);
    // The mode's tabs are NOT hidden: the shell prints the one chosen as plain words, and the sheet says what was calculated.
    expect(print).not.toMatch(/\.mp-cs \.mp-cs__modes,/);
    expect(print).not.toMatch(/\.mp-cs__modes\s*\{[^}]*display:\s*none/);
    expect(print).toContain('.mp-cs .mp-app__plots,\n  .mp-cs .mp-cs-chart {\n    break-inside: avoid;');
    expect(print).toContain('.mp-cs .mp-app__card {\n    break-inside: avoid;');
  });

  it('tells the kinds of line apart by pattern as well as by colour, and sends every colour to black on paper', () => {
    expect(css).toMatch(/\.mp-cs-fig__curve--parabola,\s*\.mp-cs-fig__curve--parabola path \{[^}]*stroke-dasharray: 8 5;/);
    expect(css).toMatch(/\.mp-cs-fig__curve--state1,\s*\.mp-cs-fig__curve--state1 path \{[^}]*stroke-dasharray: 3 4;/);
    expect(css).toMatch(/\.mp-cs-fig__chord \{[^}]*stroke-dasharray: 5 4;/);
    const print = css.slice(css.indexOf('@media print'));
    expect(print).toContain('--mp-cs-cable: #000;');
    expect(print).toContain('--mp-cs-parabola: #000;');
    expect(print).toContain('stroke: none !important;');
  });

  it('keeps every rule of its sheet at the weight of two classes, so that it holds whichever sheet is read last', () => {
    const rules = css.replace(/\/\*[\s\S]*?\*\//g, '').match(/[^{}]+(?=\{)/g)!;
    const single = rules.map((r) => r.trim()).filter((r) => /^\.mp-[\w-]+$/.test(r) && !r.startsWith('.mp-cs-fig__') && !r.startsWith('.mp-cs-chart__') && r !== '.mp-cs');
    expect(single).toEqual([]);
  });

  it('gives every control 44px to be pressed with, and no row wider than the phone', () => {
    expect(css).toContain('grid-template-columns: minmax(0, 1fr) 44px;');
    // Each tab of the mode keeps the shell’s 44px height and may take two lines on a phone.
    expect(css).toMatch(/\.mp-cs \.mp-cs__modes \.mp-seg__item span \{\s*white-space: normal;/);
    expect(css).toMatch(/\.mp-cs \.mp-cs__modes > \.mp-seg__item \{\s*flex: 1 1 9rem;/);
    // A wide card scrolls inside itself; the page does not.
    expect(css).toMatch(/\.mp-cs \.mp-app__card--wide \{\s*overflow-x: auto;/);
    // On a phone a table is laid out as lines, each cell under its head.
    expect(css).toContain('@media screen and (max-width: 640px)');
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
      const theirs = [beamStrings[lang], spanUi[lang], spanPage[lang], continuousUi[lang], continuousPage[lang], shaftUi[lang], shaftPage[lang], trussUi[lang], trussPage[lang]]
        .flatMap((set) => leaves(set).map(([, s]) => s))
        .concat(rows.map((r) => r.does[lang]))
        .join(' . ');
      for (const [path, s] of leaves(cableSagUi[lang])) expect(sharedRuns(s, theirs), `${lang} ${path}`).toEqual([]);
    }
  });

  it('says nothing the page around the tool says, six words running', () => {
    for (const lang of LANGS) {
      const page = leaves(cableSagPage[lang]).map(([, s]) => s).join(' . ');
      for (const [path, s] of leaves(cableSagUi[lang])) {
        // The one line this tool says on purpose and the page may repeat is the verdict line's.
        if (path === 'results.note') continue;
        expect(sharedRuns(s, page), `${lang} ${path}`).toEqual([]);
      }
    }
  });

  it('says “cable”, never “beam”, in what it borrows and in what it prints', () => {
    const beam = { en: /\bbeams?\b/i, es: /\bvigas?\b/i };
    for (const lang of LANGS) {
      const borrowed = leaves(sharedWords(beamStrings[lang].ui));
      expect(borrowed.length).toBeGreaterThan(10);
      for (const [path, s] of [...borrowed, ...leaves(cableSagUi[lang])]) expect(s, `${lang} ${path}`).not.toMatch(beam[lang]);
      for (const mode of ['hanging', 'state', 'points'] as CableSagMode[]) expect(text(show(lang, defaultCaseFor(mode)))).not.toMatch(beam[lang]);
    }
  });

  it('borrows only the shared pieces, and the page can hand over exactly those', () => {
    for (const lang of LANGS) {
      const shared = sharedWords(beamStrings[lang].ui);
      expect(Object.keys(shared).sort()).toEqual(['numbers', 'results', 'row', 'section', 'sheet', 'toolbar']);
      expect(JSON.stringify(shared).length).toBeLessThan(JSON.stringify(beamStrings[lang].ui).length / 4);
    }
  });
});
