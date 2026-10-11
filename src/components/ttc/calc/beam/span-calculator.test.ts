import { readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { createElement as h } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { LAYOUTS, convertUnits, decodeBeam, defaultBeam, encodeBeam, type BeamForm } from '@/lib/calc/beam/model';
import { defaultSpan } from '@/lib/calc/beam/span';
import { spanUi } from '@/lib/calc/beam/span-strings';
import { beamStrings } from '@/lib/calc/beam/strings';
import { calculatorFamilies } from '@/lib/ttc/calculators';
import { localePath, type Lang } from '@/lib/ttc/i18n';
import { NumField } from '../NumField';
import { BeamCalculator } from './BeamCalculator';

/**
 * THE BEAM CALCULATOR IN ITS SINGLE-SPAN MODE — the tool of
 * /resources/single-span-beam, as the server sends it.
 *
 * The page around it (its hero, its notes, its address in the site) is held
 * with its view. The arithmetic of what the mode adds is in
 * lib/calc/beam/span.test.ts. This is the component with the `span` prop:
 * what it leaves out of the form, the two cards it adds — read cell by cell
 * against values worked by hand — and that WITHOUT the prop it is the first
 * calculator, with none of this.
 *
 * What only a browser can show — typing, the address after the #, the link
 * that opens the first calculator on the same beam, the phone's layout, the
 * printed sheet — is in the regression script span-check.mjs, run against
 * the page itself. So is the row of the beam's own weight: it needs the
 * table of steel shapes, which arrives in a browser and never on the server
 * (its arithmetic is held in span.test.ts).
 */

const LANGS: Lang[] = ['en', 'es'];
const SRC = resolve(__dirname, '..', '..', '..', '..');
/** The first calculator's address, where this mode's link leads. */
const GENERAL = '/resources/beam';

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

/** The calculator in its single-span mode, on a beam and two limits that are not the example's. */
const show = (lang: Lang, initial?: BeamForm, initialLimits?: { limit: number; stress: number }) =>
  renderToStaticMarkup(h(BeamCalculator, { t: beamStrings[lang].ui, span: spanUi[lang], generalPath: localePath(GENERAL, lang), initial, initialLimits }));
/** …and without the prop: the first calculator. */
const plain = (lang: Lang, initial?: BeamForm) => renderToStaticMarkup(h(BeamCalculator, { t: beamStrings[lang].ui, initial }));

/*
 * The cards of numbers, read as a visitor reads them and found by their
 * title: the rows of a table cell by cell, a list of values pair by pair.
 * A number that is merely somewhere on the page proves nothing.
 */
const cardsOf = (html: string) => {
  const cards = html.split(/<div class="mp-app__card(?: mp-app__card--wide)?">/).slice(1);
  return { titles: cards.map((c) => text(c.match(/<h3\b[^>]*>([\s\S]*?)<\/h3>/)?.[1] ?? '')), of: (title: string) => cards.find((c) => text(c.match(/<h3\b[^>]*>([\s\S]*?)<\/h3>/)?.[1] ?? '') === title) ?? '' };
};
const cells = (row: string) => [...row.matchAll(/<t[hd]\b[^>]*>([\s\S]*?)<\/t[hd]>/g)].map((c) => text(c[1]));
const headOf = (card: string) => cells(card.match(/<thead\b[^>]*>([\s\S]*?)<\/thead>/)?.[1] ?? '');
const rowsOf = (card: string) => [...(card.match(/<tbody\b[^>]*>([\s\S]*?)<\/tbody>/)?.[1] ?? '').matchAll(/<tr\b[^>]*>([\s\S]*?)<\/tr>/g)].map((r) => cells(r[1]));
const pairsOf = (card: string) => [...card.matchAll(/<dt>([\s\S]*?)<\/dt><dd>([\s\S]*?)<\/dd>/g)].map((m) => [text(m[1]), text(m[2])]);
const notesOf = (card: string) => [...card.matchAll(/<p class="mp-app__note">([\s\S]*?)<\/p>/g)].map((m) => text(m[1]));
const legendsOf = (html: string) => [...html.matchAll(/<fieldset class="mp-app__group"><legend>([\s\S]*?)<\/legend>/g)].map((m) => text(m[1]));
const drawingsOf = (html: string) => [...html.matchAll(/<svg\b[^>]*role="img"[^>]*>/g)].map((m) => attr(m[0], 'aria-label') ?? '');

/** The example span with other loads, length or section. */
const span = (over: Partial<BeamForm>): BeamForm => ({ ...defaultSpan(), ...over });
const section = (over: Partial<BeamForm['section']>): BeamForm['section'] => ({ ...defaultSpan().section, ...over });

/** Every string of a nested object, with the path to it. */
function leaves(value: unknown, path = ''): [string, string][] {
  if (typeof value === 'string') return [[path, value]];
  if (value && typeof value === 'object') return Object.entries(value).flatMap(([k, v]) => leaves(v, path ? `${path}.${k}` : k));
  return [];
}
const words = (t: string) => t.toLowerCase().replace(/[^\p{L}\p{N}\s]/gu, ' ').split(/\s+/).filter(Boolean);
/** The runs of six words two texts share. */
const sharedRuns = (a: string, b: string) => {
  const there = ` ${words(b).join(' ')} `;
  const mine = words(a);
  return mine.map((_, i) => mine.slice(i, i + 6)).filter((run) => run.length === 6 && there.includes(` ${run.join(' ')} `)).map((run) => run.join(' '));
};

describe('single-span calculator: the words it adds', () => {
  const en = leaves(spanUi.en);
  const es = leaves(spanUi.es);

  it('says the same things in both languages, and leaves nothing blank', () => {
    expect(es.map(([p]) => p)).toEqual(en.map(([p]) => p));
    for (const [path, s] of [...en, ...es]) expect(s.trim().length, path).toBeGreaterThan(0);
    expect(en.length).toBeGreaterThan(15);
  });

  it('the Spanish is Spanish: no sentence is the English one left in place', () => {
    expect(en.filter(([, s], i) => s === es[i][1]).map(([path]) => path)).toEqual([]);
    // No number written into a Spanish sentence has a grouping comma: that reader takes it for the decimal mark.
    for (const [path, s] of es) expect(s, path).not.toMatch(/\d,\d{3}(?!\d)/);
  });

  // The page gives what a limit asks for and what the section has, side by
  // side. Which is enough is the engineer's to say, under a design code: no
  // word of the mode says it for them.
  it('gives numbers and no verdict', () => {
    for (const [path, s] of [...en, ...es]) {
      expect(s, path).not.toMatch(/\b(ok|okay|pass|passes|passed|fail|fails|failed|adequate|inadequate|sufficient|insufficient|enough|acceptable|complies|satisf\w*|safe|unsafe)\b/i);
      expect(s, path).not.toMatch(/\b(cumple|cumplen|no cumple|falla|fallan|aprobad\w*|suficiente|insuficiente|adecuad\w*|inadecuad\w*|aceptable|basta|segur[oa]|satisf\w*|verifica)\b/i);
      expect(s, path).not.toMatch(/[✓✔✗✘]/);
    }
    // What it does say of the two values: where they come from, and whose the comparison is.
    expect(spanUi.en.sizing.note).toMatch(/No design code, load factor or safety factor is applied/);
    expect(spanUi.es.sizing.note).toMatch(/No se aplica ninguna norma de diseño ni factor de carga o de seguridad/);
  });

  it('names no other company’s product, no price, no date', () => {
    for (const [path, s] of [...en, ...es]) {
      expect(s, path).not.toMatch(/skyciv|quick design|clearcalcs|enercalc|tedds/i);
      expect(s, path).not.toMatch(/\bfree\b|\bgratis\b|\bgratuit|\$|\bprice\b|\bprecio\b|\b20\d\d\b/i);
    }
  });

  it('each line has the place its value goes in, and the link names the first calculator as that page is called', () => {
    for (const lang of LANGS) {
      expect(spanUi[lang].sizing.has, lang).toContain('{value}');
      expect(spanUi[lang].generalLink, lang).toContain(beamStrings[lang].page.h1);
      expect(leaves(spanUi[lang]).filter(([, s]) => /\{\w+\}/.test(s.replace('{value}', ''))).map(([p]) => p), lang).toEqual([]);
    }
  });

  // Each text of the site has one home. These lines are this page's: not the
  // first calculator's said again, nor the catalogue's line for either.
  it('says nothing the first calculator or the catalogue already says, six words running', () => {
    const rows = calculatorFamilies.flatMap((f) => f.items).filter((x) => x.href);
    expect(rows.length).toBeGreaterThanOrEqual(2);
    for (const lang of LANGS) {
      const theirs = [...leaves(beamStrings[lang]).map(([, s]) => s), ...rows.map((r) => r.does[lang])].join(' . ');
      for (const [path, s] of leaves(spanUi[lang])) expect(sharedRuns(s, theirs), `${lang} ${path}`).toEqual([]);
    }
  });
});

describe('single-span calculator: the form', () => {
  for (const lang of LANGS) {
    const t = beamStrings[lang].ui;
    const s = spanUi[lang];
    const html = show(lang);

    it(`${lang}: no group for supports, hinges or applied moments, and no list of layouts`, () => {
      expect(legendsOf(html)).toEqual([t.beam.title, t.loads.point, t.loads.dist, t.section.title]);
      for (const gone of [t.supports.title, t.hinges.title, t.loads.couple, t.toolbar.layout, t.toolbar.layoutPick, t.supports.add, t.hinges.add, t.loads.addCouple, t.supports.note]) expect(text(html), gone).not.toContain(gone);
      for (const layout of LAYOUTS) expect(html, layout).not.toContain(`<option value="${layout}"`);
      for (const kind of ['pin', 'roller', 'fixed', 'cw', 'ccw']) expect(html, kind).not.toContain(`<option value="${kind}"`);
      // The units are still the visitor's to choose, and the two tabs of the section's three.
      expect((html.match(/<fieldset class="mp-seg">\s*<legend\b/g) ?? []).length).toBe(2);
      expect(html).toContain('name="beam-units"');
      // Its rows are the loads, and only they can be removed.
      const groups = [...html.matchAll(/<div class="mp-app__item" role="group" aria-label="([^"]*)"/g)].map((m) => m[1]);
      expect(groups).toEqual([`${t.row.names.points} 1`, `${t.row.names.dists} 1`]);
      expect([...html.matchAll(/<button\b[^>]*class="mp-app__remove"[^>]*>/g)].map((m) => attr(m[0], 'aria-label'))).toEqual(groups.map((g) => `${t.row.remove}: ${g}`));
    });

    it(`${lang}: the Beam group says what the span rests on, in one line`, () => {
      const beam = html.match(/<fieldset class="mp-app__group"><legend>[\s\S]*?<\/fieldset>/)?.[0] ?? '';
      expect(text(beam.match(/<legend>([\s\S]*?)<\/legend>/)?.[1] ?? '')).toBe(t.beam.title);
      expect(notesOf(beam)).toEqual([s.simple]);
      expect(s.simple).toMatch(lang === 'en' ? /single span, simply supported: a pin at the left end and a roller at the right end/ : /solo vano, simplemente apoyado: un apoyo articulado en el extremo izquierdo y un rodillo en el derecho/);
    });

    it(`${lang}: …and leads to the first calculator, in this language, with the beam on screen`, () => {
      const line = html.match(/<p class="mp-app__elsewhere">([\s\S]*?)<\/p>/)?.[1] ?? '';
      expect(text(line)).toBe(`${s.general} ${s.generalLink} →`);
      const links = [...html.matchAll(/<a\b[^>]*>/g)].map((m) => m[0]);
      expect(links).toHaveLength(1);
      const href = (attr(links[0], 'href') ?? '').replace(/&amp;/g, '&');
      // That calculator's own key, and a beam it reads: this span, its loads, its section.
      expect(href.startsWith(`${localePath(GENERAL, lang)}#b=`)).toBe(true);
      expect(href.slice(href.indexOf('#b=') + 3)).toBe(encodeBeam(defaultSpan()));
      const there = decodeBeam(href.slice(href.indexOf('#b=') + 3))!;
      expect(there.supports.map((x) => [x.kind, x.x])).toEqual([['pin', 0], ['roller', 24]]);
      expect([there.points.map((p) => [p.x, p.P]), there.dists.map((d) => [d.x1, d.x2, d.w1, d.w2]), there.section.I]).toEqual([[[8, 6]], [[0, 24, 0.8, 0.8]], 518]);
      // The link follows the form: another beam, another address.
      const other = show(lang, span({ L: 30, points: [] }));
      expect(other).toContain(`href="${localePath(GENERAL, lang)}#b=${encodeBeam({ ...span({ L: 30, points: [] }), supports: [{ id: 1, kind: 'pin', x: 0 }, { id: 2, kind: 'roller', x: 30 }] })}"`);
      // Nowhere outside the site, and no link at all where the page gives it no address to lead to.
      expect(href).not.toMatch(/^https?:|^\/\//);
      expect(renderToStaticMarkup(h(BeamCalculator, { t, span: s }))).not.toMatch(/<a\b|mp-app__elsewhere/);
    });

    it(`${lang}: every field has a name, and no button submits anything`, () => {
      const controls = [...html.matchAll(/<(input|select)\b[^>]*>/g)].map((m) => m[0]);
      // Units (2), length, a point load (3), a distributed load (5), the section (3 + 5), the two limits, the place asked about.
      expect(controls).toHaveLength(22);
      const labelled = [...html.matchAll(/<label\b[^>]*>([\s\S]*?)<\/label>/g)];
      expect(labelled.reduce((n, m) => n + (m[1].match(/<(input|select)\b/g) ?? []).length, 0)).toBe(controls.length);
      for (const m of labelled) expect(text(m[1].replace(/<select\b[\s\S]*?<\/select>/g, '')).length, m[0].slice(0, 80)).toBeGreaterThan(0);
      for (const b of html.matchAll(/<button\b[^>]*>/g)) expect(attr(b[0], 'type'), b[0]).toBe('button');
      // Nothing is marked or described on a span with nothing wrong.
      expect(html).not.toMatch(/aria-invalid|aria-describedby|mp-app__row-error|mp-num__hint/);
      expect(html).toMatch(/<div class="mp-app__issues" role="alert" aria-live="assertive"><\/div>/);
    });
  }

  // A link from the first calculator names walls, hinges and moments. Here it
  // is the span under that beam's loads — 8 kip at 12 of 20 ft and 1.2 kip/ft:
  // 15.2 and 16.8 kip — and not "this beam cannot be solved".
  it('a beam that came with other supports, a hinge and a moment is shown as the pinned span with its loads', () => {
    const foreign: BeamForm = {
      ...defaultBeam(),
      supports: [{ id: 1, kind: 'fixed', x: 0 }, { id: 2, kind: 'roller', x: 12 }, { id: 3, kind: 'fixed', x: 20 }],
      hinges: [{ id: 4, x: 6 }],
      couples: [{ id: 7, x: 15, M: 50, dir: 'cw' }],
    };
    const html = show('en', foreign);
    expect(rowsOf(cardsOf(html).of('Reactions'))).toEqual([['Pin', '0', '15.2 upward', '—'], ['Roller', '20', '16.8 upward', '—']]);
    expect(drawingsOf(html)[0]).toBe('Loads and supports: 20 ft; Pin 0, Roller 20.');
    expect(html).toMatch(/<div class="mp-app__issues" role="alert" aria-live="assertive"><\/div>/);
    expect(html).not.toContain('mp-beam__hinge');
    expect(html).not.toContain('mp-beam__couple');
    expect(html).not.toContain('mp-beam__wall');
    // The same form without the prop is the beam it says it is: two walls, three reactions.
    expect(rowsOf(cardsOf(plain('en', foreign)).of('Reactions'))).toHaveLength(3);
  });
});

describe('single-span calculator: the example, cell by cell', () => {
  // 24 ft; 0.8 kip/ft over all of it; 6 kip at 8 ft; E = 29,000 ksi, I = 518 in⁴, S = 64.7 in³, shear area 4.88 in².
  //
  // REACTIONS. Uniform: 0.8 × 24 ÷ 2 = 9.6 a side. Point: 6 × 16 ÷ 24 = 4 left, 6 × 8 ÷ 24 = 2 right.
  //   13.6 and 11.6 kip; 0.8 × 24 + 6 = 25.2 kip of load.
  // LARGEST MOMENT. Past the load V = 13.6 − 6 − 0.8x = 0 at x = 9.5 ft.
  //   M = 13.6 × 9.5 − 0.8 × 9.5² ÷ 2 − 6 × 1.5 = 129.2 − 36.1 − 9 = 84.1 kip·ft.
  //   Uniform alone there: 0.8 × 9.5 × 14.5 ÷ 2 = 55.1. Point alone: 2 × 14.5 = 29. 55.1 + 29 = 84.1.
  // LARGEST DEFLECTION. The slope is zero at x = 11.67 ft (span.test.ts has the bracketing). There, in kip·ft³,
  //   uniform  wx(L³ − 2Lx² + x³)/24       = 0.8 × 11.674 × 8,873.2 ÷ 24   = 3,452.9
  //   point    Pa(L − x)(2Lx − x² − a²)/6L = 48 × 12.326 × 360.08 ÷ 144    = 1,479.4
  //   EI = 29,000 × 518 ÷ 144 = 104,319.4 kip·ft²; × 12 for inches:
  //   0.3972 in and 0.1702 in; together 0.5674 in, and 288 in ÷ 0.5674 in = 508.
  // STRESSES. 84.1 × 12 ÷ 64.7 = 15.6 ksi; 13.6 ÷ 4.88 = 2.787 ksi.
  // SECTION NEEDED. For L/360: I = 518 × 360 ÷ 507.6 = 367.4 in⁴ (4,932.3 × 360 × 144 ÷ (24 × 29,000)).
  // AT MIDSPAN, x = 12 ft. V = 13.6 − 9.6 − 6 = −2 kip. M = 163.2 − 57.6 − 24 = 81.6 kip·ft.
  //   EI·v = 5wL⁴/384 + Pa(L − x)(2Lx − x² − a²)/6L = 3,456 + 48 × 12 × 368 ÷ 144 = 4,928: 0.5669 in.
  //   EI·θ: the uniform load's is zero at midspan; the point's is −Pa(3x² − 6Lx + 2L² + a²)/6L
  //   = −(432 − 1,728 + 1,216) ÷ 3 = +26.67 kip·ft²: 0.0002556 rad. Stress: 81.6 × 12 ÷ 64.7 = 15.13 ksi.
  const WORDS = {
    en: {
      titles: ['Reactions', 'Largest values', 'Deflection by span', 'Load by load', 'Section needed', 'Values at a point'],
      reactions: [['Pin', '0', '13.6 upward', '—'], ['Roller', '24', '11.6 upward', '—']],
      sum: 'The reactions add up to the load: 25.2 = 25.2 kip.',
      maxima: [['Shear', '13.6 kip at x = 0 ft'], ['Sagging moment', '84.1 kip·ft at x = 9.5 ft'], ['Hogging moment', 'none'], ['Deflection', '0.5674 in downward, at x = 11.67 ft'], ['Bending stress', '15.6 ksi'], ['Shear stress', '2.787 ksi']],
      spans: [['0 – 24', '0.5674 downward', 'L/508']],
      head: ['Load', 'Left support (kip)', 'Right support (kip)', 'Moment at x = 9.5 ft (kip·ft)', 'Deflection at x = 11.67 ft (in)'],
      loads: [['Point load 1', '4', '2', '29', '-0.1702'], ['Distributed load 1', '9.6', '9.6', '55.1', '-0.3972'], ['All loads', '13.6', '11.6', '84.1', '-0.5674']],
      sizing: [['Moment of inertia needed', '367.4 in⁴ the section entered has 518 in⁴'], ['Section modulus needed', 'Enter a bending stress limit to see the section modulus needed.']],
      limits: [['Deflection limit, L ÷', '360', ''], ['Bending stress limit (optional)', '', 'ksi']],
      point: [['Shear, V', '-2 kip'], ['Bending moment, M', '81.6 kip·ft'], ['Deflection', '-0.5669 in'], ['Slope', '0.0002556 rad'], ['Bending stress', '15.13 ksi']],
      drawings: ['Loads and supports: 24 ft; Pin 0, Roller 24.', 'Shear, V: max 13.6 kip at x = 0 ft; min -11.6 kip at x = 24 ft.', 'Bending moment, M: max 84.1 kip·ft at x = 9.5 ft; min 0 kip·ft.', 'Deflection: -0.5674 in at x = 11.67 ft.'],
    },
    es: {
      titles: ['Reacciones', 'Valores máximos', 'Deflexión por vano', 'Carga por carga', 'Sección necesaria', 'Valores en un punto'],
      reactions: [['Articulado', '0', '13.6 hacia arriba', '—'], ['Rodillo', '24', '11.6 hacia arriba', '—']],
      sum: 'Las reacciones suman la carga: 25.2 = 25.2 kip.',
      maxima: [['Cortante', '13.6 kip en x = 0 ft'], ['Momento positivo', '84.1 kip·ft en x = 9.5 ft'], ['Momento negativo', 'ninguno'], ['Deflexión', '0.5674 in hacia abajo, en x = 11.67 ft'], ['Esfuerzo de flexión', '15.6 ksi'], ['Esfuerzo cortante', '2.787 ksi']],
      spans: [['0 – 24', '0.5674 hacia abajo', 'L/508']],
      head: ['Carga', 'Apoyo izquierdo (kip)', 'Apoyo derecho (kip)', 'Momento en x = 9.5 ft (kip·ft)', 'Deflexión en x = 11.67 ft (in)'],
      loads: [['Carga puntual 1', '4', '2', '29', '-0.1702'], ['Carga distribuida 1', '9.6', '9.6', '55.1', '-0.3972'], ['Todas las cargas', '13.6', '11.6', '84.1', '-0.5674']],
      sizing: [['Momento de inercia necesario', '367.4 in⁴ la sección introducida tiene 518 in⁴'], ['Módulo de sección necesario', 'Introduzca un límite del esfuerzo de flexión para ver el módulo de sección necesario.']],
      limits: [['Límite de deflexión, L ÷', '360', ''], ['Límite del esfuerzo de flexión (opcional)', '', 'ksi']],
      point: [['Cortante, V', '-2 kip'], ['Momento flector, M', '81.6 kip·ft'], ['Deflexión', '-0.5669 in'], ['Giro', '0.0002556 rad'], ['Esfuerzo de flexión', '15.13 ksi']],
      drawings: ['Cargas y apoyos: 24 ft; Articulado 0, Rodillo 24.', 'Cortante, V: máx. 13.6 kip en x = 0 ft; mín. -11.6 kip en x = 24 ft.', 'Momento flector, M: máx. 84.1 kip·ft en x = 9.5 ft; mín. 0 kip·ft.', 'Deflexión: -0.5674 in en x = 11.67 ft.'],
    },
  };
  /** The fields of a card: each one's label, the value it shows and its unit. */
  const fieldsOf = (card: string) =>
    [...card.matchAll(/<label\b[^>]*>([\s\S]*?)<\/label>/g)].map((m) => [text(m[1].match(/<span class="mp-num__label">([\s\S]*?)<\/span><span class="mp-num__box">/)?.[1] ?? ''), attr(m[1].match(/<input\b[^>]*>/)?.[0] ?? '', 'value') ?? '', text(m[1].match(/<span class="mp-num__unit">([\s\S]*?)<\/span>/)?.[1] ?? '')]);

  for (const lang of LANGS) {
    const W = WORDS[lang];
    const s = spanUi[lang];
    const html = show(lang);
    const cards = cardsOf(html);

    it(`${lang}: the first calculator's three cards, the two this page adds, then the values at a point`, () => {
      expect(cards.titles).toEqual(W.titles);
      expect([...html.matchAll(/<h3\b[^>]*>([\s\S]*?)<\/h3>/g)].map((m) => text(m[1]))).toEqual(W.titles);
      expect(html).not.toMatch(/<h[12456]\b/);
    });

    it(`${lang}: reactions 13.6 and 11.6 kip, and the largest values`, () => {
      expect(rowsOf(cards.of(W.titles[0]))).toEqual(W.reactions);
      expect(text(cards.of(W.titles[0]))).toContain(W.sum);
      expect(pairsOf(cards.of(W.titles[1]))).toEqual(W.maxima);
      expect(rowsOf(cards.of(W.titles[2]))).toEqual(W.spans);
      expect(pairsOf(cards.of(W.titles[5]))).toEqual(W.point);
      expect(drawingsOf(html)).toEqual(W.drawings.map(esc));
    });

    it(`${lang}: load by load — each load's share, and a last row that is the whole beam`, () => {
      const card = cards.of(s.loads.title);
      expect(headOf(card)).toEqual(W.head);
      expect(rowsOf(card)).toEqual(W.loads);
      // The last row is the totals printed in the cards above it, figure for figure.
      const all = rowsOf(card).at(-1)!;
      expect(all[0]).toBe(s.loads.all);
      expect(W.reactions.map((r) => r[2].split(' ')[0])).toEqual([all[1], all[2]]);
      expect(W.maxima[1][1].startsWith(`${all[3]} kip·ft`)).toBe(true);
      expect(W.maxima[3][1].startsWith(`${all[4].replace('-', '')} in`)).toBe(true);
      // …and the rows above add up to it: 4 + 9.6, 2 + 9.6, 29 + 55.1, 0.1702 + 0.3972.
      const sums = [1, 2, 3, 4].map((c) => rowsOf(card).slice(0, -1).reduce((sum, r) => sum + Number(r[c]), 0));
      sums.forEach((sum, i) => expect(sum, String(i)).toBeCloseTo(Number(all[i + 1]), 3));
      expect(notesOf(card)).toEqual([`${s.loads.note} ${s.loads.noteDeflection}`]);
    });

    it(`${lang}: section needed — 367.4 in⁴ for L/360 beside the 518 in⁴ entered, and no section modulus until a stress is typed`, () => {
      const card = cards.of(s.sizing.title);
      expect(fieldsOf(card)).toEqual(W.limits);
      expect(pairsOf(card)).toEqual(W.sizing);
      expect(notesOf(card)).toEqual([s.sizing.note]);
      // The two fields are one named group, as a row of the form is.
      expect(card).toContain(`<div class="mp-app__row mp-app__row--two" role="group" aria-label="${esc(s.sizing.title)}">`);
    });
  }

  // For L/240 the span needs two thirds of what L/360 asks: 367.4 × 240 ÷ 360 = 244.9 in⁴.
  // For 24 ksi: 84.1 kip·ft × 12 ÷ 24 ksi = 42.05 in³.
  it('with a limit of L/240 and a stress of 24 ksi: 244.9 in⁴ and 42.05 in³, each beside what the section has', () => {
    for (const lang of LANGS) {
      const s = spanUi[lang];
      const card = cardsOf(show(lang, undefined, { limit: 240, stress: 24 })).of(s.sizing.title);
      expect(fieldsOf(card).map((f) => f[1])).toEqual(['240', '24']);
      expect(pairsOf(card)).toEqual([
        [s.sizing.inertia, `244.9 in⁴ ${s.sizing.has.replace('{value}', '518 in⁴')}`],
        [s.sizing.modulus, `42.05 in³ ${s.sizing.has.replace('{value}', '64.7 in³')}`],
      ]);
    }
  });

  // The same beam in metres and kilonewtons (1 kip = 4.4482 kN, 1 ft = 0.3048 m, 1 in = 25.4 mm):
  //   13.6 kip = 60.5 kN, 11.6 kip = 51.6 kN; 84.1 kip·ft × 1.3558 = 114 kN·m at 9.5 ft = 2.896 m.
  //   Point: 4 kip = 17.79 kN, 2 kip = 8.896 kN, 29 kip·ft = 39.32 kN·m. Uniform: 9.6 kip = 42.7 kN, 55.1 kip·ft = 74.71 kN·m.
  //   Deflections × 25.4, and × 29,000 ksi ÷ 200,000 MPa = 0.99974 (steel's listed modulus is a round number in each system):
  //   0.1702 in → 4.321 mm, 0.3972 in → 10.09 mm, 0.5674 in → 14.41 mm at 11.67 ft = 3.558 m.
  //   I: 367.4 in⁴ × 0.41623 × 0.99974 = 152.9 × 10⁶ mm⁴, beside 518 in⁴ = 215.608 × 10⁶ mm⁴.
  it('in SI: the same span in kN, kN·m and mm, the section in 10⁶ mm⁴', () => {
    const html = show('en', convertUnits(defaultSpan(), 'si'));
    const cards = cardsOf(html);
    expect(rowsOf(cards.of('Reactions'))).toEqual([['Pin', '0', '60.5 upward', '—'], ['Roller', '7.315', '51.6 upward', '—']]);
    expect(headOf(cards.of('Load by load'))).toEqual(['Load', 'Left support (kN)', 'Right support (kN)', 'Moment at x = 2.896 m (kN·m)', 'Deflection at x = 3.558 m (mm)']);
    expect(rowsOf(cards.of('Load by load'))).toEqual([['Point load 1', '17.79', '8.896', '39.32', '-4.321'], ['Distributed load 1', '42.7', '42.7', '74.71', '-10.09'], ['All loads', '60.5', '51.6', '114', '-14.41']]);
    // A unit that begins with a power of ten is joined to its figure by the sign: "152.9 10⁶" read as one run of digits.
    expect(pairsOf(cards.of('Section needed'))[0]).toEqual(['Moment of inertia needed', '152.9 × 10⁶ mm⁴ the section entered has 215.608 × 10⁶ mm⁴']);
    expect(fieldsOf(cards.of('Section needed'))[1]).toEqual(['Bending stress limit (optional)', '', 'MPa']);
    // 165 MPa: 114.02 kN·m × 1,000 ÷ 165 = 691.1 × 10³ mm³, beside 64.7 in³ = 1,060.24 × 10³ mm³.
    const withStress = cardsOf(show('en', convertUnits(defaultSpan(), 'si'), { limit: 360, stress: 165 })).of('Section needed');
    expect(pairsOf(withStress)[1]).toEqual(['Section modulus needed', '691.1 × 10³ mm³ the section entered has 1,060.24 × 10³ mm³']);
    // …and held to it by no-break spaces (read above, like any space, as plain ones): a line never ends between the figure and its power of ten.
    for (const whole of ['152.9 × 10⁶ mm⁴', '215.608 × 10⁶ mm⁴', '691.1 × 10³ mm³', '1,060.24 × 10³ mm³']) expect(withStress, whole).toContain(whole.replace(/ /g, '\u00a0'));
    // In Spanish too, where thousands are set apart by a space of their own: 1 060.24 × 10³ mm³.
    expect(pairsOf(cardsOf(show('es', convertUnits(defaultSpan(), 'si'), { limit: 360, stress: 165 })).of('Sección necesaria'))[1]).toEqual(['Módulo de sección necesario', '691.1 × 10³ mm³ la sección introducida tiene 1 060.24 × 10³ mm³']);
  });
});

describe('single-span calculator: spans other than the example', () => {
  const loads = (html: string, lang: Lang = 'en') => cardsOf(html).of(spanUi[lang].loads.title);
  const sizing = (html: string, lang: Lang = 'en') => cardsOf(html).of(spanUi[lang].sizing.title);

  // 6 kip UPWARD at 8 ft, alone. Reactions −4 and −2 kip; M = −Pab/L = −32 kip·ft under it.
  // The largest deflection is at L − √((L² − a²)/3) = 24 − √170.67 = 10.94 ft:
  //   Pa(L² − a²)^1.5 ÷ (9√3·L) = 48 × 11,585.2 ÷ 374.12 = 1,486.4 kip·ft³ = 0.171 in, upward.
  it('an upward load: its reactions pull down, its moment hogs, its deflection is up — signs and all', () => {
    const html = show('en', span({ points: [{ id: 3, x: 8, P: 6, dir: 'up' }], dists: [] }));
    expect(rowsOf(cardsOf(html).of('Reactions')).map((r) => r[2])).toEqual(['4 downward', '2 downward']);
    expect(headOf(loads(html)).slice(3)).toEqual(['Moment at x = 8 ft (kip·ft)', 'Deflection at x = 10.94 ft (in)']);
    expect(rowsOf(loads(html))).toEqual([['Point load 1', '-4', '-2', '-32', '0.171'], ['All loads', '-4', '-2', '-32', '0.171']]);
    // What a limit asks for does not depend on which way the span moves: 0.171 in is L/1,684, so L/360 needs 518 × 360 ÷ 1,684 = 110.7 in⁴.
    expect(pairsOf(sizing(html))[0][1]).toMatch(/^110\.7 in⁴ /);
  });

  // 6 kip down and 6 kip up, both at 8 ft: nothing is left on the span. Each
  // alone is still a load, read at midspan since no section has the largest
  // moment: M = 2 × 12 = 24 kip·ft, and EI·v = 48 × 12 × 368 ÷ 144 = 1,472 kip·ft³ = 0.1693 in.
  it('loads that cancel: each is shown, at midspan, and the last row is zero — as is the section needed', () => {
    const html = show('en', span({ points: [{ id: 3, x: 8, P: 6, dir: 'down' }, { id: 5, x: 8, P: 6, dir: 'up' }], dists: [] }), { limit: 360, stress: 24 });
    expect(headOf(loads(html)).slice(3)).toEqual(['Moment at x = 12 ft (kip·ft)', 'Deflection at x = 12 ft (in)']);
    expect(rowsOf(loads(html))).toEqual([['Point load 1', '4', '2', '24', '-0.1693'], ['Point load 2', '-4', '-2', '-24', '0.1693'], ['All loads', '0', '0', '0', '0']]);
    expect(pairsOf(sizing(html))).toEqual([['Moment of inertia needed', '0 in⁴ the section entered has 518 in⁴'], ['Section modulus needed', '0 in³ the section entered has 64.7 in³']]);
    expect(html).not.toContain('× 10^');
  });

  // What is not a share is 0. 6 kip standing on the left support goes into
  // it and bends nothing. A load of a billionth of a kip beside 25 kip of
  // others is under the page's floor for rounding (a billionth of the loads,
  // a millionth of the largest reaction): its own 6.7 × 10⁻¹⁰ kip on the left
  // support is printed as the first calculator prints such a shear, as 0.
  it('what is rounding is 0: a load on a support, of size zero, of a billionth of the others, of no length', () => {
    const html = show('en', span({ points: [{ id: 3, x: 0, P: 6, dir: 'down' }, { id: 5, x: 8, P: 0, dir: 'down' }, { id: 7, x: 8, P: 1e-9, dir: 'down' }], dists: [{ id: 4, x1: 5, x2: 5, w1: 2, w2: 2, dir: 'down' }, { id: 6, x1: 0, x2: 24, w1: 0.8, w2: 0.8, dir: 'down' }] }));
    // The uniform load alone: 9.6 a side, wL²/8 = 57.6 kip·ft and 5wL⁴/384EI = 0.3975 in, both at midspan.
    expect(rowsOf(loads(html))).toEqual([
      ['Point load 1', '6', '0', '0', '0'],
      ['Point load 2', '0', '0', '0', '0'],
      ['Point load 3', '0', '0', '0', '0'],
      ['Distributed load 1', '0', '0', '0', '0'],
      ['Distributed load 2', '9.6', '9.6', '57.6', '-0.3975'],
      ['All loads', '15.6', '9.6', '57.6', '-0.3975'],
    ]);
    // The drawing writes that load's value as it was typed, 1 × 10^-9 kip. No card has such a number.
    expect(html.slice(0, html.indexOf('<div class="mp-app__tables">'))).toContain('× 10^-9');
    expect(html.slice(html.indexOf('<div class="mp-app__tables">'))).not.toContain('× 10^');
    // With no load at all the table is its last row, and the span asks for no section.
    const bare = show('en', span({ points: [], dists: [] }), { limit: 360, stress: 24 });
    expect(rowsOf(loads(bare))).toEqual([['All loads', '0', '0', '0', '0']]);
    expect(pairsOf(sizing(bare)).map((p) => p[1].split(' the ')[0])).toEqual(['0 in⁴', '0 in³']);
  });

  // The page measures rounding against the size of the problem. A billion
  // kip standing on the left support makes a thousandth of a kip at midspan
  // rounding: its 0.006 kip·ft and its deflection are printed as 0 in
  // "Largest values", as the first calculator prints them. "Section needed"
  // is worked out from those two largest values and must say the same —
  // not 0.02 in⁴ for a deflection the card above it gives as zero.
  it('where the largest values are printed as 0, no section is asked for', () => {
    const html = show('en', span({ points: [{ id: 3, x: 0, P: 1e9, dir: 'down' }, { id: 5, x: 12, P: 0.001, dir: 'down' }], dists: [] }), { limit: 360, stress: 24 });
    const maxima = pairsOf(cardsOf(html).of('Largest values'));
    expect([maxima[1], maxima[3]]).toEqual([['Sagging moment', 'none'], ['Deflection', '0 in']]);
    expect(pairsOf(sizing(html)).map((p) => p[1].split(' the ')[0])).toEqual(['0 in⁴', '0 in³']);
    expect(rowsOf(loads(html)).at(-1)).toEqual(['All loads', '1 × 10^9', '0', '0', '0']);
    // The same small load with nothing beside it is a load like any other: PL/4 = 0.006 kip·ft,
    // PL³/48 = 0.288 kip·ft³, and for L/360 an I of 0.288 × 360 × 144 ÷ (24 × 29,000) = 0.02145 in⁴.
    const alone = show('en', span({ points: [{ id: 5, x: 12, P: 0.001, dir: 'down' }], dists: [] }), { limit: 360, stress: 24 });
    expect(pairsOf(cardsOf(alone).of('Largest values'))[1]).toEqual(['Sagging moment', '0.006 kip·ft at x = 12 ft']);
    expect(pairsOf(sizing(alone)).map((p) => p[1].split(' the ')[0])).toEqual(['0.02145 in⁴', '0.003 in³']);
  });

  // A row is settled as a whole. 0.00003 kip at the middle of 40 ft, beside
  // 2 kip/ft over all of it: its 0.000015 kip a side and its PL/4 = 0.0003 kip·ft
  // are under the floor of the reactions (a millionth of 40 kip) and are
  // printed as 0, while its PL³/48EI = 4.6 × 10⁻⁶ in is over the floor of the
  // deflections (a billionth of the loads). Printed, that was a deflection
  // caused by no reaction and no moment.
  // The uniform load: 2 × 40 ÷ 2 = 40 kip a side, wL²/8 = 400 kip·ft, 5wL⁴/384EI = 66,667 × 1,728 ÷ (29,000 × 518) = 7.669 in.
  it('a load whose reactions are rounding has no deflection either: its row is all zeros', () => {
    const html = show('en', span({ L: 40, points: [{ id: 3, x: 20, P: 0.00003, dir: 'down' }], dists: [{ id: 4, x1: 0, x2: 40, w1: 2, w2: 2, dir: 'down' }] }));
    expect(rowsOf(loads(html))).toEqual([['Point load 1', '0', '0', '0', '0'], ['Distributed load 1', '40', '40', '400', '-7.669'], ['All loads', '40', '40', '400', '-7.669']]);
    expect(html.slice(html.indexOf('<div class="mp-app__tables">'))).not.toContain('× 10^');
    // The same small load alone is a load like any other, deflection and all: P/2, PL/4, PL³/48EI.
    const alone = rowsOf(loads(show('en', span({ L: 40, points: [{ id: 3, x: 20, P: 0.00003, dir: 'down' }], dists: [] }))));
    expect(alone[0]).toEqual(['Point load 1', '1.5 × 10^-5', '1.5 × 10^-5', '0.0003', '-4.601 × 10^-6']);
  });

  // Which way is positive is said under the table, and the table must agree
  // with it: 6 kip UPWARD at 8 ft pulls both supports down, hogs the span and
  // lifts it — three minus signs and a plus.
  it('the notes under the table say the signs the table prints', () => {
    for (const lang of LANGS) {
      const t = spanUi[lang];
      const up = beamStrings[lang].ui.results.upward;
      const down = beamStrings[lang].ui.results.downward;
      const rows = rowsOf(loads(show(lang, span({ points: [{ id: 3, x: 8, P: 6, dir: 'up' }], dists: [] })), lang));
      expect(rows[0].slice(1).map((v) => Math.sign(Number(v)))).toEqual([-1, -1, -1, 1]);
      expect(t.loads.note).toContain(lang === 'en' ? `an ${up} reaction` : `una reacción ${up}`);
      expect(t.loads.note).toContain(lang === 'en' ? 'a sagging moment' : 'un momento que comba la viga hacia abajo');
      expect(t.loads.noteDeflection).toContain(lang === 'en' ? `positive ${up}` : `positiva ${up}`);
      expect(t.loads.noteDeflection).not.toContain(down);
    }
  });

  // The rows add up to the last one as numbers. As PRINTED, each value is
  // rounded on its own, to four figures, and a column added up by hand can
  // miss the last row in its last figure: the note says so, and promises no
  // exact sum of what is on screen. 30 ft, 6 kip at 8 ft and 0.8 kip/ft, in
  // SI: the shear is zero at 13 ft, where the point load's moment is
  // 1.6 × 17 = 27.2 kip·ft and the uniform load's 0.8 × 13 × 17 ÷ 2 = 88.4;
  // × 1.3558 they are 36.878, 119.854 and together 156.733 kN·m — printed
  // 36.88, 119.9 and 156.7, and 36.88 + 119.9 is 156.78.
  it('each value is rounded on its own: a column added up as printed can miss the last row by a figure, and the note says so', () => {
    const html = show('en', convertUnits(span({ L: 30, dists: [{ id: 4, x1: 0, x2: 30, w1: 0.8, w2: 0.8, dir: 'down' }] }), 'si'));
    expect(headOf(loads(html))[3]).toBe('Moment at x = 3.962 m (kN·m)');
    const moments = rowsOf(loads(html)).map((r) => r[3]);
    expect(moments).toEqual(['36.88', '119.9', '156.7']);
    expect(Number(moments[0]) + Number(moments[1])).toBeCloseTo(156.78, 6);
    expect(spanUi.en.loads.note).toContain('the rows add up to the last one, though each value is rounded on its own and the last figure of a sum may differ.');
    expect(spanUi.es.loads.note).toContain('las filas suman la última, aunque cada valor se redondea por separado y la última cifra de una suma puede diferir.');
  });

  it('with no I entered: no deflection column and no word of one, and the moment of inertia needed all the same', () => {
    for (const lang of LANGS) {
      const s = spanUi[lang];
      const t = beamStrings[lang].ui;
      const html = show(lang, span({ section: section({ I: 0 }) }));
      expect(cardsOf(html).titles).toEqual([t.results.reactions, t.results.maxima, s.loads.title, s.sizing.title, t.results.point]);
      expect(headOf(loads(html, lang))).toHaveLength(4);
      expect(rowsOf(loads(html, lang)).map((r) => r.slice(1))).toEqual([['4', '2', '29'], ['9.6', '9.6', '55.1'], ['13.6', '11.6', '84.1']]);
      expect(notesOf(loads(html, lang))).toEqual([s.loads.note]);
      // Nothing beside it: the section entered has no moment of inertia to show.
      expect(pairsOf(sizing(html, lang))[0]).toEqual([s.sizing.inertia, '367.4 in⁴']);
    }
  });

  it('what is missing for a value is asked for, and tied to the field at fault', () => {
    for (const lang of LANGS) {
      const s = spanUi[lang];
      // A limit of zero is no limit: the field is marked, and the line that says so is the one it points at.
      const none = sizing(show(lang, undefined, { limit: 0, stress: 0 }), lang);
      expect(pairsOf(none)[0]).toEqual([s.sizing.inertia, s.sizing.needLimit]);
      const limit = [...none.matchAll(/<input\b[^>]*aria-invalid="true"[^>]*>/g)].map((m) => m[0]);
      expect(limit).toHaveLength(1);
      expect(attr(limit[0], 'value')).toBe('0');
      const id = attr(limit[0], 'aria-describedby');
      expect(id).toBeTruthy();
      expect(none).toContain(`<span class="mp-app__dir" id="${id}">${esc(s.sizing.needLimit)}</span>`);
      // Nor is a minus, nor what a link may bring in place of a number: it is the limit that is asked for, not E.
      for (const bad of [-360, Number.NaN, Infinity]) expect(pairsOf(sizing(show(lang, undefined, { limit: bad, stress: 0 }), lang))[0][1], String(bad)).toBe(s.sizing.needLimit);
      // No modulus of elasticity: nothing to turn a deflection into a stiffness with. The limit is not at fault.
      const noE = sizing(show(lang, span({ section: section({ material: 'custom', E: 0 }) })), lang);
      expect(pairsOf(noE)[0]).toEqual([s.sizing.inertia, s.sizing.needE]);
      expect(noE).not.toMatch(/aria-invalid/);
      // A stress typed with a minus is not one: marked, and tied to a line that says what is wrong with it —
      // not to the one that asks for a stress, which the visitor has just entered.
      const minus = sizing(show(lang, undefined, { limit: 360, stress: -24 }), lang);
      expect(pairsOf(minus)[1]).toEqual([s.sizing.modulus, s.sizing.badStress]);
      const stress = [...minus.matchAll(/<input\b[^>]*aria-invalid="true"[^>]*>/g)].map((m) => m[0]);
      expect(stress).toHaveLength(1);
      expect(attr(stress[0], 'value')).toBe('-24');
      expect(minus).toContain(`<span class="mp-app__dir" id="${attr(stress[0], 'aria-describedby')}">${esc(s.sizing.badStress)}</span>`);
      // No stress at all is no fault: the field is empty and unmarked, and the line asks for one.
      expect(pairsOf(sizing(show(lang, undefined, { limit: 360, stress: 0 }), lang))[1]).toEqual([s.sizing.modulus, s.sizing.needStress]);
      // What a link may bring in place of a number is refused as the minus is.
      expect(pairsOf(sizing(show(lang, undefined, { limit: 360, stress: Infinity }), lang))[1]).toEqual([s.sizing.modulus, s.sizing.badStress]);
      // The field may be left empty, and the line says so: "greater than zero" alone would be false of an optional value.
      expect(s.sizing.badStress).toMatch(lang === 'en' ? /greater than zero, or leave the field empty\.$/ : /mayor que cero, o deje el campo vacío\.$/);
    }
  });

  // 6,000 kip at 8 ft: 4,000 and 2,000 kip, 4,000 × 8 = 32,000 kip·ft under it.
  it('numbers are written as the page writes them: 4,000 in English, 4 000 in Spanish', () => {
    const heavy = span({ points: [{ id: 3, x: 8, P: 6000, dir: 'down' }], dists: [] });
    expect(rowsOf(loads(show('en', heavy)))[0].slice(0, 4)).toEqual(['Point load 1', '4,000', '2,000', '32,000']);
    // A narrow no-break space in the markup (read here, like any space, as a plain one).
    expect(rowsOf(loads(show('es', heavy), 'es'))[0].slice(0, 4)).toEqual(['Carga puntual 1', '4 000', '2 000', '32 000']);
    for (const cell of ['4 000', '2 000', '32 000']) expect(loads(show('es', heavy), 'es'), cell).toContain(`<td role="cell">${cell}</td>`);
    expect(text(show('es', heavy))).not.toMatch(/\d,\d{3}/);
    // …the section's own value too: 12,345.6 in⁴ entered.
    expect(sizing(show('es', span({ section: section({ I: 12345.6 }) })), 'es')).toContain('12 345.6 in⁴');
    expect(pairsOf(sizing(show('en', span({ section: section({ I: 12345.6 }) }))))[0][1]).toContain('12,345.6 in⁴');
  });

  it('a span that is not solved has no cards, the two new ones included', () => {
    for (const bad of [span({ L: 0 }), span({ points: [{ id: 3, x: 30, P: 6, dir: 'down' }] })]) {
      const html = show('en', bad);
      expect(cardsOf(html).titles).toEqual([]);
      expect(html).not.toContain('mp-app__card');
      expect(text(html)).toContain(beamStrings.en.ui.issuesTitle);
    }
    // With the length at fault it is the length that is said: the supports are not this page's to blame.
    const issues = text(show('en', span({ L: 0 })).match(/<div class="mp-app__issues"[\s\S]*?<\/div>/)?.[0] ?? '');
    expect(issues).toContain(beamStrings.en.ui.issues.length);
    expect(issues).not.toContain(beamStrings.en.ui.issues.outside);
  });

  // "Values at a point" closes with a hint for the screen — move over a
  // diagram — that the printed sheet leaves out BY ITS PLACE: the last
  // paragraph of the last card (calc.css). A card added after it would lose
  // its own note on paper instead, and the hint would be printed.
  it('"Values at a point" is still the last card, and its hint its last line', () => {
    for (const lang of LANGS) {
      const t = beamStrings[lang].ui;
      const html = show(lang);
      const last = html.slice(html.lastIndexOf('<div class="mp-app__card'));
      expect(text(last.match(/<h3\b[^>]*>([\s\S]*?)<\/h3>/)?.[1] ?? '')).toBe(t.results.point);
      expect(notesOf(last).at(-1)).toBe(t.results.pointHint);
    }
    const css = readFileSync(join(SRC, 'components/ttc/calc/calc.css'), 'utf8');
    expect(css.slice(css.indexOf('@media print {'))).toContain('.mp-app__card:last-child > p:last-child');
  });

  // On a phone the table's rows are laid out as lines of their own, and some
  // browsers read a table's meaning from its layout: every cell says what it is.
  it('each cell of the load-by-load table carries its role', () => {
    const table = loads(show('en')).match(/<table\b[\s\S]*?<\/table>/)?.[0] ?? '';
    expect(attr(table.match(/<table\b[^>]*>/)![0], 'role')).toBe('table');
    const tags = [...table.matchAll(/<(thead|tbody|tr|th|td)\b[^>]*>/g)].map((m) => m[0]);
    expect(tags.length).toBeGreaterThan(20);
    for (const tag of tags) {
      const want = /^<(thead|tbody)/.test(tag) ? 'rowgroup' : /^<tr/.test(tag) ? 'row' : /^<td/.test(tag) ? 'cell' : attr(tag, 'scope') === 'col' ? 'columnheader' : 'rowheader';
      expect(attr(tag, 'role'), tag).toBe(want);
    }
  });
});

describe('single-span calculator: without the prop it is the first calculator', () => {
  for (const lang of LANGS) {
    it(`${lang}: none of the mode's words, cards, fields or classes`, () => {
      const t = beamStrings[lang].ui;
      // The example of each page, and this page's example given to the first calculator.
      for (const html of [plain(lang), plain(lang, defaultSpan()), renderToStaticMarkup(h(BeamCalculator, { t, generalPath: localePath(GENERAL, lang), initialLimits: { limit: 240, stress: 24 } }))]) {
        // Every line of the mode — but for its one-word column head, "Load", which the form's own fields say too.
        const lines = leaves(spanUi[lang]).filter(([path]) => path !== 'loads.load');
        expect(lines.length).toBe(leaves(spanUi[lang]).length - 1);
        for (const [path, s] of lines) expect(text(html), path).not.toContain(s.replace('{value}', '').trim());
        expect(cardsOf(html).titles).toEqual([t.results.reactions, t.results.maxima, t.results.spans, t.results.point]);
        expect(legendsOf(html)).toEqual([t.beam.title, t.supports.title, t.hinges.title, t.loads.point, t.loads.dist, t.loads.couple, t.section.title]);
        for (const cls of ['mp-app__card--wide', 'mp-app__table--loads', 'mp-app__total', 'mp-app__elsewhere', 'mp-link']) expect(html, cls).not.toContain(cls);
        expect(html).not.toMatch(/<a\b|role="(table|row|cell|rowgroup|columnheader|rowheader)"/);
        expect(html).toContain(`<span class="mp-num__label">${esc(t.toolbar.layout)}</span>`);
      }
      // It opens on its own beam, 20 ft and 15.2 / 16.8 kip, not on this page's.
      expect(rowsOf(cardsOf(plain(lang)).of(t.results.reactions)).map((r) => [r[1], r[2].split(' ')[0]])).toEqual([['0', '15.2'], ['20', '16.8']]);
      // Given a beam with a wall it shows the wall: nothing pins the ends there.
      const wall = plain(lang, { ...defaultBeam(), supports: [{ id: 1, kind: 'fixed', x: 0 }] });
      expect(rowsOf(cardsOf(wall).of(t.results.reactions))).toHaveLength(1);
    });
  }
});

describe('single-span calculator: what its script carries, and its styles', () => {
  const source = (rel: string) => readFileSync(join(SRC, rel), 'utf8');
  const code = (rel: string) => source(rel).replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');

  // The mode's words arrive as a prop, like the calculator's own: imported
  // for their value, both languages would travel with the script of both pages.
  it('the words of the mode are a prop: the calculator imports their type and nothing else', () => {
    const calculator = source('components/ttc/calc/beam/BeamCalculator.tsx');
    expect(calculator).toContain("import type { SpanUi } from '@/lib/calc/beam/span-strings';");
    expect(calculator.match(/from '@\/lib\/calc\/beam\/span-strings'/g)).toHaveLength(1);
    expect(source('lib/calc/beam/span.ts')).not.toMatch(/span-strings|\/strings'/);
    // …and what it does import of the mode is arithmetic, with no way to send anything anywhere.
    for (const f of ['lib/calc/beam/span.ts', 'lib/calc/beam/span-strings.ts']) {
      expect(source(f), f).not.toMatch(/\bfetch\(|sendBeacon|XMLHttpRequest|new WebSocket|\baction=|localStorage|sessionStorage|document\.cookie/);
      expect(source(f), f).not.toMatch(/from '@\/lib\/ttc\/(site|content|calculators|cities)/);
    }
  });

  // Every place that wrote "#b=" writes the page's own key now: the address
  // as it follows the form, the copied link, the printed sheet's line. What
  // is left of the literal is the first calculator's key where it is meant:
  // its own address, a beam of its own read here, and the link that leads
  // to it. (That the address is in fact written so, only a browser shows.)
  it('the page’s own address is written under the page’s own key', () => {
    const calculator = code('components/ttc/calc/beam/BeamCalculator.tsx');
    expect(calculator.match(/\$\{prefix\}\$\{codeOf\(form\)\}/g)).toHaveLength(2);
    expect(calculator).toContain("const prefix = `#${single ? SPAN_KEY : 'b'}=`;");
    expect(calculator).toContain('const want = code === example ? \'\' : `${prefix}${code}`;');
    // One thing in the component has that name. It was first called `mark`,
    // as the function that stamps the printed sheet is: inside that function
    // the name was the function, and the sheet gave its source for an address.
    expect(calculator.match(/\b(const|let|var|function) prefix\b/g)).toHaveLength(1);
    expect(calculator).not.toMatch(/pathname\}#b=/);
    expect([...calculator.matchAll(/#b=/g)]).toHaveLength(3);
    expect(calculator.match(/\$\{generalPath\}#b=\$\{encodeBeam\(/g)).toHaveLength(2);
    expect(calculator).toContain("window.location.hash.startsWith('#b=')");
    // Start over is the example's address, which is the bare one — the limits with it.
    expect(calculator).toMatch(/setLimit\(DEFAULT_LIMIT\);\s*setStress\(0\);/);
    expect(calculator).toContain('write(example);');
    // Two things of the mode run only in a browser, where no test of this file can follow them
    // (span-check.mjs does): the stress typed goes with the units — 24 left as it was under "MPa"
    // asked for a section modulus seven times too large — and a beam brought over under the first
    // calculator's own key is read, not refused.
    expect(calculator).toMatch(/dispatch\(\{ type: 'units', units: key \}\);\s*if \(single\) setStress\(\(typed\) => convertStress\(typed, form\.units, key\)\);/);
    expect(calculator).toContain('if (single) return m[1] === SPAN_KEY ? decodeSpan(text) : adoptBeam(text);');
    expect(calculator).toContain('hash.match(single ? /^#([sb])=(.*)$/ : /^#(b)=(.+)$/)');
  });

  // The first calculator is this component without the prop, and its tests
  // above read the markup the server sends: none of them runs the reducer,
  // Start over or the address. So the shape of the code is held here — these
  // are pins of the source, to be moved with it — and what the code DOES is
  // held by the two browser scripts (beam-check.mjs, span-check.mjs).
  it('every use of the span reducer and of the span example is behind `single`', () => {
    const calculator = code('components/ttc/calc/beam/BeamCalculator.tsx');
    expect(calculator).toContain('const reduce = single ? reduceSpan : reduceBeam;');
    expect(calculator.match(/\breduceSpan\b/g)).toHaveLength(2);
    expect(calculator).toContain('const example = single ? EXAMPLE_SPAN : EXAMPLE;');
    expect(calculator.match(/\bEXAMPLE_SPAN\b/g)).toHaveLength(2);
    // pinEnds: imported, and used once, for the beam the page opens with.
    expect(calculator.match(/\bpinEnds\b/g)).toHaveLength(2);
    // Every other name of the mode is called once (encodeSpan twice: the example, and codeOf).
    for (const name of ['byLoad', 'sizing', 'convertStress', 'encodeSpan', 'decodeSpan', 'adoptBeam']) expect(calculator.match(new RegExp('\\b' + name + '\\(', 'g')), name).toHaveLength(name === 'encodeSpan' ? 2 : 1);
    const lines = calculator.split('\n').filter((l) => /\bdefaultSpan\(\)/.test(l) && !/^const EXAMPLE_SPAN = /.test(l.trim()));
    expect(lines).toHaveLength(3);
    for (const l of lines) expect(l, l.trim()).toMatch(/single \? (pinEnds\(given \?\? )?defaultSpan\(\)\)? : (given \?\? )?defaultBeam\(\)/);
  });

  // A link that held more than this span has (span.test.ts, `lost`) is told
  // so in the results box. The notice has a state of its own: the one for a
  // link that cannot be read is withdrawn as soon as the address is written
  // again, which for an adopted beam is 300 ms after it opens. Set where a
  // link is opened, for every link; withdrawn by Start over; printed only in
  // the mode. (That it shows, and stays, only a browser can tell.)
  it('the notice for a link that held other supports, hinges or moments has its own state', () => {
    const calculator = code('components/ttc/calc/beam/BeamCalculator.tsx');
    expect(calculator).toContain('const [lost, setLost] = useState(false);');
    expect(calculator).toMatch(/setStress\(found\.stress\);\s*setLost\(Boolean\(found\.lost\)\);/);
    expect(calculator).toMatch(/setStress\(0\);\s*setLost\(false\);/);
    expect(calculator.match(/\bsetLost\(/g)).toHaveLength(2);
    expect(calculator).toMatch(/<div className="mp-app__issues" role="alert" aria-live="assertive">\s*\{span && lost \? <p className="mp-app__issues-title">\{span\.leftOut\}<\/p> : null\}/);
    for (const lang of LANGS) {
      // It names what is left out as the form's own link does, and what is shown instead.
      expect(spanUi[lang].leftOut).toMatch(lang === 'en' ? /other supports, internal hinges or applied moments\. This page leaves them out:/ : /otros apoyos, rótulas internas o momentos aplicados\. Esta página los omite:/);
      expect(spanUi[lang].leftOut).toMatch(lang === 'en' ? /point and distributed loads only\.$/ : /solo con las cargas puntuales y distribuidas de esa viga\.$/);
      // A beam handed to the component is not a link: nothing was opened, and nothing is said.
      expect(text(show(lang, { ...defaultBeam(), couples: [{ id: 7, x: 15, M: 50, dir: 'cw' }] })), lang).not.toContain(spanUi[lang].leftOut);
    }
  });

  const field = (props: Record<string, unknown>) => renderToStaticMarkup(h(NumField, { label: 'x', value: 0, onChange: () => {}, ...props } as never));
  const value = (html: string) => html.match(/<input\b[^>]* value="([^"]*)"/)?.[1];
  // `emptyIs` is the single-span page's alone. Given to every optional field
  // it would empty two fields of the first calculator that show their 0 today.
  it('an optional field at zero shows its zero; only with emptyIs is it empty', () => {
    expect(value(field({ optional: 'optional' }))).toBe('0');
    expect(value(field({ optional: 'optional', emptyIs: 0 }))).toBe('');
    expect(value(field({ optional: 'optional', emptyIs: 0, value: 24 }))).toBe('24');
  });
  it('the first calculator’s optional S and shear area still open on 0', () => {
    for (const lang of LANGS) {
      const html = plain(lang, { ...defaultBeam(), section: { ...defaultBeam().section, S: 0, Av: 0 } });
      const labels = [...html.matchAll(/<label class="mp-num[^"]*"[^>]*>([\s\S]*?)<\/label>/g)].map((m) => m[1]).filter((l) => l.includes('mp-num__opt'));
      expect(labels).toHaveLength(2);
      for (const l of labels) expect(l.match(/<input\b[^>]* value="([^"]*)"/)?.[1], text(l)).toBe('0');
    }
  });
  // Typing cannot be done here: the three lines an emptied field goes through
  // are held as they are written (span-check.mjs empties the field itself).
  it('an emptied field that may be empty reports its empty value', () => {
    const numfield = code('components/ttc/calc/NumField.tsx');
    expect(numfield).toContain("const read = (text: string) => (canBeEmpty && text.trim() === '' ? emptyIs : parseNumber(text, group));");
    expect(numfield).toContain('onChange(read(e.target.value) ?? before.current);');
    expect(numfield).toContain('const refused = draft !== null && read(draft) === null;');
    // …and a text that was not a number, dropped from a field that is empty again, leaves no line
    // naming "the value 0" under a field that shows none.
    expect(numfield).toContain('const lost = left !== null && !hint && numbers && !(canBeEmpty && Object.is(value, emptyIs)) ?');
  });

  it('every class the mode adds is styled in the calculator’s own sheet, on screen and on paper', () => {
    const own = source('components/ttc/calc/calc.css');
    const used = new Set<string>();
    for (const m of show('en').matchAll(/class="([^"]*)"/g)) for (const cls of m[1].split(/\s+/)) if (/^mp-(app|num|seg|plot|beam)(?![a-z0-9])/.test(cls)) used.add(cls);
    const before = new Set<string>();
    for (const m of plain('en').matchAll(/class="([^"]*)"/g)) for (const cls of m[1].split(/\s+/)) before.add(cls);
    const added = [...used].filter((cls) => !before.has(cls)).sort();
    expect(added).toEqual(['mp-app__card--wide', 'mp-app__elsewhere', 'mp-app__table--loads', 'mp-app__total']);
    for (const cls of added) expect(own, cls).toMatch(new RegExp(`\\.${cls}(?![a-zA-Z0-9_-])`));
    const screen = own.slice(0, own.indexOf('@page {')).replace(/\/\*[\s\S]*?\*\//g, '');
    const print = own.slice(own.indexOf('@media print {'));
    // The table of loads takes the whole row of cards, on a screen and across both columns of the sheet.
    expect(screen).toMatch(/\.mp-app__card--wide\s*\{\s*grid-column:\s*1 \/ -1;\s*\}/);
    // On a phone its rows are lines of their own: five columns do not fit 350px. On a
    // phone's SCREEN — a sheet of paper is as wide as the paper, and there it is a table.
    expect(screen).toContain('@media screen and (max-width: 640px)');
    const phone = screen.slice(screen.indexOf('@media screen and (max-width: 640px)'));
    expect(screen.slice(0, screen.indexOf('@media screen and (max-width: 640px)'))).not.toMatch(/\.mp-app__table--loads[^{]*\{[^}]*display:/);
    expect(print).not.toMatch(/\.mp-app__table--loads[^{]*\{[^}]*display:/);
    expect(phone).toMatch(/\.mp-app__table--loads tr\s*\{[^}]*display:\s*flex;[^}]*flex-wrap:\s*wrap;/);
    expect(phone).toMatch(/\.mp-app__table--loads tr > :first-child\s*\{[^}]*flex:\s*0 0 100%;/);
    // No number is broken inside itself: nothing in that table breaks "anywhere", and where four
    // values do not fit one line (a phone held upright) they go two to a line, under their heads.
    expect(screen).not.toMatch(/\.mp-app__table--loads[^{]*\{[^}]*overflow-wrap:\s*anywhere/);
    const narrow = phone.slice(phone.indexOf('@media screen and (max-width: 440px)'));
    expect(phone).toContain('@media screen and (max-width: 440px)');
    expect(narrow).toMatch(/\.mp-app__table--loads th,\s*\.mp-app__table--loads td\s*\{\s*flex:\s*0 0 50%;\s*\}/);
    // The link's answering area is 44px tall, by the site's own means: the rule stays under the words.
    expect(screen).toMatch(/\.mp-app__elsewhere \.mp-link::before\s*\{\s*inset-block:\s*-6px;\s*\}/);
    // The way to the other calculator is a link, and a link is no value: not on the sheet.
    expect(print.slice(0, print.indexOf('.mp-sheet {'))).toContain('.mp-app__elsewhere,');
    expect(print).toMatch(/\.mp-app__total > th,\s*\.mp-app__total > td\s*\{[^}]*border-block-start:\s*0\.75pt solid #000;/);
    // On this page's sheet none of the three columns of notes is split between two pages.
    expect(print).toMatch(/\.mp:has\(\.mp-app__card--wide\) \.mp-appnotes__grid > \*\s*\{\s*break-inside:\s*avoid;\s*\}/);
  });
});
