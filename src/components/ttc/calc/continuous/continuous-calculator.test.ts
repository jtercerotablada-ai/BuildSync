import { readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { createElement as h } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { formatNumber } from '@/lib/calc/format';
import { decodeBeam } from '@/lib/calc/beam/model';
import { spanPage } from '@/lib/calc/beam/span-page-strings';
import { spanUi } from '@/lib/calc/beam/span-strings';
import { beamStrings } from '@/lib/calc/beam/strings';
import { SHORT, STIFF } from '@/lib/calc/continuous/engine';
import { MAX_SPANS, defaultContinuous, generalCode, type ContinuousForm, type DistRow, type PointRow, type Section, type SpanRow } from '@/lib/calc/continuous/model';
import { continuousPage } from '@/lib/calc/continuous/page-strings';
import { continuousUi } from '@/lib/calc/continuous/strings';
import { calculatorFamilies } from '@/lib/ttc/calculators';
import { localePath, type Lang } from '@/lib/ttc/i18n';
import { BeamPlot } from '../beam/BeamPlot';
import { BeamSchematic } from '../beam/BeamSchematic';
import { ContinuousCalculator } from './ContinuousCalculator';

/**
 * THE CONTINUOUS BEAM CALCULATOR — the tool of /resources/continuous-beam,
 * as the server sends it: what a visitor sees before the script arrives, or
 * without it.
 *
 * The page around it (its hero, its notes, its address in the site) is held
 * with its view. The arithmetic is held where it is done:
 * lib/calc/continuous/engine.test.ts, envelope.test.ts, model.test.ts and
 * analysis.test.ts. This is the component: its form, its four cards read
 * cell by cell AGAINST VALUES WORKED HERE BY HAND (the three-moment
 * equation, in plain arithmetic), its drawings, its faults on their rows,
 * its words — and that the two pieces it borrows from the first calculator
 * (BeamPlot, BeamSchematic) are as they were for whoever does not ask for
 * the new.
 *
 * What only a browser can show — typing, the address after the #, the
 * pointer on a band, the phone's layout, the printed sheet — is in the
 * regression script cont-check.mjs, run against the page itself.
 */

const LANGS: Lang[] = ['en', 'es'];
const SRC = resolve(__dirname, '..', '..', '..', '..');
/** The first calculator's address, where the form's link leads. */
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

const show = (lang: Lang, initial?: ContinuousForm, generalPath: string | undefined = localePath(GENERAL, lang)) =>
  renderToStaticMarkup(h(ContinuousCalculator, { t: beamStrings[lang].ui, c: continuousUi[lang], generalPath, initial }));

/*
 * The cards of numbers, read as a visitor reads them and found by their
 * title: the rows of a table cell by cell, a list of values pair by pair.
 * A number that is merely somewhere on the page proves nothing.
 *
 * Beside a value the miniature of the beam says which spans are loaded: it
 * is read here as its words, in brackets, where the value has one.
 */
const cardsOf = (html: string) => {
  const cards = html.split(/<div class="mp-app__card(?: mp-app__card--wide)?">/).slice(1);
  return { titles: cards.map((c) => text(c.match(/<h3\b[^>]*>([\s\S]*?)<\/h3>/)?.[1] ?? '')), of: (title: string) => cards.find((c) => text(c.match(/<h3\b[^>]*>([\s\S]*?)<\/h3>/)?.[1] ?? '') === title) ?? '' };
};
const spoken = (inner: string) =>
  inner.replace(/<svg class="mp-cont__pattern"([^>]*)>[\s\S]*?<\/svg>/g, (_, attrs: string) => {
    const said = attr(attrs, 'aria-label');
    return said ? ` [${said}] ` : ' ';
  });
const cells = (row: string) => [...row.matchAll(/<t[hd]\b[^>]*>([\s\S]*?)<\/t[hd]>/g)].map((c) => text(spoken(c[1])));
const headOf = (card: string) => cells(card.match(/<thead\b[^>]*>([\s\S]*?)<\/thead>/)?.[1] ?? '');
const rowsOf = (card: string) => [...(card.match(/<tbody\b[^>]*>([\s\S]*?)<\/tbody>/)?.[1] ?? '').matchAll(/<tr\b[^>]*>([\s\S]*?)<\/tr>/g)].map((r) => cells(r[1]));
const pairsOf = (card: string) => [...card.matchAll(/<dt>([\s\S]*?)<\/dt><dd>([\s\S]*?)<\/dd>/g)].map((m) => [text(m[1]), text(spoken(m[2]))]);
const notesOf = (part: string) => [...part.matchAll(/<p class="mp-app__note(?: [^"]*)?">([\s\S]*?)<\/p>/g)].map((m) => text(spoken(m[1])));
const groupsOf = (html: string) => [...html.matchAll(/<fieldset class="mp-app__group"><legend>([\s\S]*?)<\/legend>([\s\S]*?)(?=<fieldset class="mp-app__group">|<div class="mp-app__actions">)/g)].map((m) => ({ legend: text(m[1]), html: m[2] }));
const drawingsOf = (html: string) => [...html.matchAll(/<svg class="mp-plot__svg"[^>]*>/g)].map((m) => attr(m[0], 'aria-label') ?? '');
const issuesOf = (html: string) => text(html.match(/<div class="mp-app__issues" role="alert" aria-live="assertive">([\s\S]*?)<\/div>/)?.[1] ?? '');
/** The fields of a piece of the form: each one's label, the value it shows, its unit, and what it is marked with. */
const fieldsOf = (part: string) =>
  [...part.matchAll(/<label class="mp-num[^"]*"([^>]*)>([\s\S]*?)<\/label>/g)]
    .filter((m) => /<input\b/.test(m[2]))
    .map((m) => {
      const input = m[2].match(/<input\b[^>]*>/)?.[0] ?? '';
      return { label: text(m[2].match(/<span class="mp-num__label">([\s\S]*?)<\/span><span class="mp-num__box">/)?.[1] ?? ''), value: attr(input, 'value') ?? '', unit: text(m[2].match(/<span class="mp-num__unit">([\s\S]*?)<\/span>/)?.[1] ?? ''), invalid: attr(input, 'aria-invalid') === 'true', describedBy: attr(input, 'aria-describedby') };
    });
const selectsOf = (part: string) => [...part.matchAll(/<label class="mp-num mp-num--select[^"]*">([\s\S]*?)<\/label>/g)].map((m) => ({ label: text(m[1].match(/<span class="mp-num__label">([\s\S]*?)<\/span>/)?.[1] ?? ''), chosen: text(m[1].match(/<option[^>]* selected=""[^>]*>([\s\S]*?)<\/option>/)?.[1] ?? ''), options: [...m[1].matchAll(/<option[^>]*>([\s\S]*?)<\/option>/g)].map((o) => text(o[1])) }));

/** The example with something else in it. */
const beam = (over: Partial<ContinuousForm>): ContinuousForm => ({ ...defaultContinuous(), ...over });
const section = (over: Partial<Section>): Section => ({ ...defaultContinuous().section, ...over });
const span = (id: number, L: number, k = 1, dead = 0, live = 0): SpanRow => ({ id, L, k, dead, live });
const point = (id: number, on: number, a: number, P: number, dir: 'down' | 'up' = 'down', live = false): PointRow => ({ id, span: on, a, P, dir, live });
const dist = (id: number, on: number, a1: number, a2: number, w1: number, w2: number, dir: 'down' | 'up' = 'down', live = false): DistRow => ({ id, span: on, a1, a2, w1, w2, dir, live });

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

/*
 * THE EXAMPLE, BY HAND. Three spans of 24, 30 and 24 ft on simple supports;
 * on each, 0.9 kip/ft dead and 1.2 kip/ft live; E = 29,000 ksi, I = 843 in⁴,
 * S = 81.6 in³, shear area 7.245 in².
 *
 * Clapeyron, for spans L1, L2, L3 under w1, w2, w3 and nothing at the ends:
 *     2(L1 + L2)·MB + L2·MC = −(w1·L1³ + w2·L2³)/4
 *     L2·MB + 2(L2 + L3)·MC = −(w2·L2³ + w3·L3³)/4
 * and statics for the rest. Under all the loads (2.1 on each span) the beam
 * is symmetric: MB(2·54 + 30) = −2.1(24³ + 30³)/4, MB = −21,432.6/138 =
 * −155.3 kip·ft; the end reaction 2.1·12 − 155.3/24 = 18.73 kip, the inner
 * one 2.1·39 − 18.73 = 63.17 kip.
 */
const [L1, L2, L3] = [24, 30, 24];
const EI = (29000 * 843) / 144;
function clapeyron(w1: number, w2: number, w3: number) {
  const [a, b, d] = [2 * (L1 + L2), L2, 2 * (L2 + L3)];
  const [p, q] = [-(w1 * L1 ** 3 + w2 * L2 ** 3) / 4, -(w2 * L2 ** 3 + w3 * L3 ** 3) / 4];
  const det = a * d - b * b;
  const MB = (p * d - b * q) / det;
  const MC = (a * q - b * p) / det;
  const RA = (w1 * L1) / 2 + MB / L1;
  const RD = (w3 * L3) / 2 + MC / L3;
  const VB = (w2 * L2) / 2 + (MC - MB) / L2;
  return {
    MB,
    MC,
    R: [RA, w1 * L1 - RA + VB, w2 * L2 - VB + w3 * L3 - RD, RD],
    // Each span's largest sagging moment, where its shear is zero.
    sag: [RA ** 2 / (2 * w1), MB + VB ** 2 / (2 * w2), RD ** 2 / (2 * w3)],
    sagAt: [RA / w1, L1 + VB / w2, L1 + L2 + L3 - RD / w3],
    shear: Math.max(RA, w1 * L1 - RA, VB, w2 * L2 - VB, w3 * L3 - RD, RD),
    // At the middle of the middle span: shear, moment, and EI times the deflection (downward) and the slope.
    mid: { V: (MC - MB) / L2, M: (w2 * L2 ** 2) / 8 + (MB + MC) / 2, down: (5 * w2 * L2 ** 4) / 384 + ((MB + MC) * L2 ** 2) / 16, turn: ((MB - MC) * L2) / 24 },
  };
}
/** The eight arrangements of the live load: each span's 1.2 on or off, over 0.9 everywhere. */
const EIGHT = Array.from({ length: 8 }, (_, mask) => {
  const on = [0, 1, 2].filter((i) => mask & (1 << i));
  return { on, ...clapeyron(...([0, 1, 2].map((i) => 0.9 + (on.includes(i) ? 1.2 : 0)) as [number, number, number])) };
});
const best = (of: (c: (typeof EIGHT)[number]) => number, sign: 1 | -1) => EIGHT.reduce((top, c) => (sign * of(c) > sign * of(top) ? c : top));

describe('continuous beam calculator: the words it adds', () => {
  const en = leaves(continuousUi.en);
  const es = leaves(continuousUi.es);

  it('says the same things in both languages, and leaves nothing blank', () => {
    expect(es.map(([p]) => p)).toEqual(en.map(([p]) => p));
    for (const [path, s] of [...en, ...es]) expect(s.trim().length, path).toBeGreaterThan(0);
    expect(en.length).toBeGreaterThan(40);
  });

  it('the Spanish is Spanish: no sentence is the English one left in place', () => {
    expect(en.filter(([, s], i) => s === es[i][1]).map(([path]) => path)).toEqual([]);
    // No number written into a Spanish sentence has a grouping comma: that reader takes it for the decimal mark.
    for (const [path, s] of es) expect(s, path).not.toMatch(/\d,\d{3}(?!\d)/);
    // "Usted", never "tú": "complete", "vacíe", "alárguelo".
    for (const [path, s] of es) expect(s, path).not.toMatch(/\b(completa|vacía|alárgalo|quítalo|elige|tu|tus|tienes|puedes)\b/i);
    expect(continuousUi.es.issues.settlement).toMatch(/Complete la sección o vacíe el campo/);
    expect(continuousUi.es.issues['short-span']).toMatch(/Alárguelo o quítelo/);
  });

  // The page gives moments, reactions, deflections and elastic stresses. Whether
  // any of them will do is the engineer's to say, under a design code: no word
  // of the tool says it for them, and none names a code.
  it('gives numbers and no verdict, and names no code', () => {
    for (const [path, s] of [...en, ...es]) {
      expect(s, path).not.toMatch(/\b(ok|okay|pass|passes|passed|fail|fails|failed|adequate|inadequate|sufficient|insufficient|enough|acceptable|complies|satisf\w*|safe|unsafe)\b/i);
      expect(s, path).not.toMatch(/\b(cumple|cumplen|no cumple|falla|fallan|aprobad\w*|suficiente|insuficiente|adecuad\w*|inadecuad\w*|aceptable|basta|segur[oa]|satisf\w*|verifica)\b/i);
      expect(s, path).not.toMatch(/[✓✔✗✘]/);
      expect(s, path).not.toMatch(/\b(ACI|AISC|ASCE|IBC|NDS|Eurocode|Eurocódigo|LRFD|ASD)\b|\b318\b|\b360\b/);
    }
  });

  it('names no other company’s product, no price, no date', () => {
    for (const [path, s] of [...en, ...es]) {
      expect(s, path).not.toMatch(/skyciv|quick design|clearcalcs|enercalc|tedds/i);
      expect(s, path).not.toMatch(/\bgratis\b|\bgratuit|\$|\bprice\b|\bprecio\b|\b20\d\d\b/i);
    }
    // "Free" here is an end of the beam that nothing holds, and nothing else: the kind's own name, and "a free end".
    expect(en.filter(([, s]) => /\bfree\b/i.test(s)).map(([path]) => path)).toEqual(['ends.kinds.free', 'ends.note']);
    expect(continuousUi.en.ends.note).toMatch(/with a free end is an overhang/);
    expect(continuousUi.en.ends.note.match(/\bfree\b/gi)).toHaveLength(1);
  });

  it('each line has the places its values go in, and the link names the first calculator as that page is called', () => {
    const PLACES: Record<string, string[]> = {
      'live.count': ['{spans}', '{count}'],
      'results.range': ['{min}', '{max}'],
      'results.pattern.one': ['{spans}'],
      'results.pattern.many': ['{spans}'],
      'results.key': ['{on}', '{off}'],
      'issues.stiffness': ['{min}', '{max}'],
    };
    for (const lang of LANGS) {
      for (const [path, s] of leaves(continuousUi[lang])) expect(s.match(/\{\w+\}/g) ?? [], `${lang} ${path}`).toEqual(PLACES[path] ?? []);
      expect(continuousUi[lang].generalLink, lang).toContain(beamStrings[lang].page.h1);
    }
  });

  // Each text of the site has one home. These lines are this tool's: not the
  // first calculator's said again (those come from `t`), nor the second's,
  // nor this page's own text around the tool, nor the catalogue's line.
  it('says nothing the other calculators, this page’s text or the catalogue already say, six words running', () => {
    const rows = calculatorFamilies.flatMap((f) => f.items).filter((x) => x.href);
    expect(rows.length).toBeGreaterThanOrEqual(2);
    for (const lang of LANGS) {
      const theirs = [beamStrings[lang], spanUi[lang], spanPage[lang], continuousPage[lang]].flatMap((set) => leaves(set).map(([, s]) => s)).concat(rows.map((r) => r.does[lang])).join(' . ');
      for (const [path, s] of leaves(continuousUi[lang])) expect(sharedRuns(s, theirs), `${lang} ${path}`).toEqual([]);
    }
  });

  it('what it says of the engine’s limits is what the engine’s limits are', () => {
    // "One thousandth of all the spans together"; a stiffness factor "from 0.001 to 1,000", written by the page from the constant.
    expect([SHORT, STIFF, MAX_SPANS]).toEqual([1e-3, 1e3, 8]);
    expect(continuousUi.en.issues['short-span']).toMatch(/shorter than one thousandth of all the spans together/);
    expect(continuousUi.es.issues['short-span']).toMatch(/no llega a la milésima parte de la suma de todos los vanos/);
    expect(continuousUi.en.spans.limit).toMatch(/^Eight /);
    expect(continuousUi.es.spans.limit).toMatch(/^Ocho /);
  });

  // The words reach the tool as a prop from the server view. Imported by the
  // component — or by anything it imports — both languages would be in the
  // script every visitor downloads.
  it('are a prop: the component imports neither set of words, only their types', () => {
    const source = readFileSync(join(SRC, 'components', 'ttc', 'calc', 'continuous', 'ContinuousCalculator.tsx'), 'utf8');
    expect(source.startsWith("'use client';")).toBe(true);
    const imports = [...source.matchAll(/^import (type )?[\s\S]*? from '([^']+)';/gm)].map((m) => ({ typeOnly: Boolean(m[1]), from: m[2] }));
    expect(imports.length).toBeGreaterThan(10);
    for (const i of imports.filter((x) => /strings$/.test(x.from))) expect(i.typeOnly, i.from).toBe(true);
    expect(imports.filter((x) => /strings$/.test(x.from)).map((x) => x.from)).toEqual(['@/lib/calc/beam/strings', '@/lib/calc/continuous/strings']);
    // …and nothing of the site's own copy, which every public page's script would then share with it.
    expect(imports.filter((x) => /lib\/ttc\//.test(x.from))).toEqual([]);
  });
});

describe('continuous beam calculator: the form', () => {
  for (const lang of LANGS) {
    const t = beamStrings[lang].ui;
    const c = continuousUi[lang];
    const html = show(lang);
    const groups = groupsOf(html);
    const group = (legend: string) => groups.find((g) => g.legend === legend)?.html ?? '';

    it(`${lang}: seven groups — spans, ends, supports, the two kinds of load, the live load, the section`, () => {
      expect(groups.map((g) => g.legend)).toEqual([c.spans.title, c.ends.title, t.supports.title, t.loads.point, t.loads.dist, c.live.title, t.section.title]);
      // Nothing of the first calculator that this beam has not: no hinges, no applied moments, no list of layouts, no length of the whole beam.
      for (const gone of [t.hinges.title, t.loads.couple, t.toolbar.layout, t.supports.add, t.hinges.add, t.loads.addCouple, t.supports.note]) expect(text(html), gone).not.toContain(gone);
      expect(html).not.toContain('name="beam-layout"');
    });

    it(`${lang}: a span is its length, its stiffness factor, and a dead and a live load — three of them, each with its number`, () => {
      const spans = group(c.spans.title);
      expect(fieldsOf(spans).map((f) => [f.label, f.value, f.unit])).toEqual(
        [[24], [30], [24]].flatMap(([L]) => [[t.beam.length, String(L), 'ft'], [c.spans.stiffness, '1', ''], [c.spans.dead, '0.9', 'kip/ft'], [c.spans.live, '1.2', 'kip/ft']]),
      );
      const rows = [...html.matchAll(/<div class="mp-app__item" role="group" aria-label="([^"]*)"/g)].map((m) => m[1]);
      expect(rows).toEqual([1, 2, 3].map((n) => `${t.results.span} ${n}`));
      // The number is on screen too, not only in the group's name.
      expect([...spans.matchAll(/<p class="mp-cont__name" aria-hidden="true">([\s\S]*?)<\/p>/g)].map((m) => text(m[1]))).toEqual(rows);
      expect([...html.matchAll(/<button\b[^>]*class="mp-app__remove"[^>]*>/g)].map((m) => [attr(m[0], 'aria-label'), / disabled=""/.test(m[0])])).toEqual(rows.map((r) => [`${t.row.remove}: ${r}`, false]));
      expect(notesOf(spans)).toEqual([c.spans.note]);
      // What 1 means is said.
      expect(c.spans.note).toMatch(lang === 'en' ? /1 is that section/ : /1 es esa sección/);
      expect(text(spans)).toContain(c.spans.add);
    });

    it(`${lang}: each end is on a simple support, fixed or free`, () => {
      const ends = group(c.ends.title);
      const kinds = [c.ends.kinds.pin, c.ends.kinds.fixed, c.ends.kinds.free];
      expect(selectsOf(ends)).toEqual([{ label: c.ends.left, chosen: kinds[0], options: kinds }, { label: c.ends.right, chosen: kinds[0], options: kinds }]);
      expect(notesOf(ends)).toEqual([c.ends.note]);
      const other = groupsOf(show(lang, beam({ left: 'fixed', right: 'free' }))).find((g) => g.legend === c.ends.title)!.html;
      expect(selectsOf(other).map((s) => s.chosen)).toEqual([kinds[1], kinds[2]]);
    });

    it(`${lang}: each support has its place, worked out from the spans, and a settlement that may be left empty`, () => {
      const supports = group(t.supports.title);
      expect(fieldsOf(supports).map((f) => [f.label, f.value, f.unit])).toEqual([0, 24, 54, 78].map((x, i) => [`${t.results.support} ${i + 1} · x = ${x} ft`, '', 'in']));
      expect(supports).toContain(`role="group" aria-label="${esc(c.settlements.name)}"`);
      expect(notesOf(supports)).toEqual([c.settlements.note]);
      // A free end has no support, and no field; the others keep their numbers from the left.
      const hung = groupsOf(show(lang, beam({ left: 'free', settlements: [0.75, 0, 0.5, 0] }))).find((g) => g.legend === t.supports.title)!.html;
      expect(fieldsOf(hung).map((f) => [f.label, f.value])).toEqual([[`${t.results.support} 1 · x = 24 ft`, ''], [`${t.results.support} 2 · x = 54 ft`, '0.5'], [`${t.results.support} 3 · x = 78 ft`, '']]);
    });

    it(`${lang}: a further load names its span, its direction and whether it is dead or live, and is placed in its span`, () => {
      expect([text(group(t.loads.point)), text(group(t.loads.dist))].map((s) => s.startsWith(t.loads.none))).toEqual([true, true]);
      const loaded = show(lang, beam({ points: [point(4, 1, 12, 9, 'up', true)], dists: [dist(5, 2, 3, 15, 0.4, 1.1)], nextId: 6 }));
      const [points, dists] = [t.loads.point, t.loads.dist].map((legend) => groupsOf(loaded).find((g) => g.legend === legend)!.html);
      const numbers = ['1', '2', '3'];
      expect(selectsOf(points)).toEqual([
        { label: t.results.span, chosen: '2', options: numbers },
        { label: t.loads.direction, chosen: t.loads.up, options: [t.loads.down, t.loads.up] },
        { label: t.supports.kind, chosen: c.loads.kinds.live, options: [c.loads.kinds.dead, c.loads.kinds.live] },
      ]);
      expect(fieldsOf(points).map((f) => [f.label, f.value, f.unit])).toEqual([[t.loads.load, '9', 'kip'], [t.loads.at, '12', 'ft']]);
      expect(selectsOf(dists).map((s) => s.chosen)).toEqual(['3', t.loads.down, c.loads.kinds.dead]);
      expect(fieldsOf(dists).map((f) => [f.label, f.value, f.unit])).toEqual([[t.loads.start, '0.4', 'kip/ft'], [t.loads.end, '1.1', 'kip/ft'], [t.loads.from, '3', 'ft'], [t.loads.to, '15', 'ft']]);
      // Where a position is measured from is said once there is one.
      expect([notesOf(points), notesOf(dists)]).toEqual([[c.loads.note], [c.loads.note]]);
      expect(notesOf(group(t.loads.point))).toEqual([]);
    });

    it(`${lang}: the live load is taken on every span, or in every arrangement — the example opens with the second, and says how many that is`, () => {
      const live = group(c.live.title);
      const radios = [...live.matchAll(/<label class="mp-seg__item"><input type="radio" name="beam-live"([^>]*)\/><span>([\s\S]*?)<\/span>/g)].map((m) => [text(m[2]), / checked=""/.test(m[1])]);
      expect(radios).toEqual([[c.live.all, false], [c.live.every, true]]);
      // Three spans with a live load: 2³ arrangements.
      expect(notesOf(live)).toEqual([c.live.everyNote, c.live.count.replace('{spans}', '3').replace('{count}', '8')]);
      const all = groupsOf(show(lang, beam({ everyArrangement: false }))).find((g) => g.legend === c.live.title)!.html;
      expect(notesOf(all)).toEqual([c.live.allNote]);
      // With no live load on any span there is nothing to arrange, and the page says so.
      const none = groupsOf(show(lang, beam({ spans: defaultContinuous().spans.map((s) => ({ ...s, live: 0 })) }))).find((g) => g.legend === c.live.title)!.html;
      expect(notesOf(none)).toEqual([c.live.everyNote, c.live.none]);
    });

    it(`${lang}: the section is the shared group, with a first line of this page’s own: here a settlement depends on it too`, () => {
      const sec = group(t.section.title);
      expect(notesOf(sec)).toEqual([c.section.intro]);
      expect(text(html)).not.toContain(t.section.intro);
      expect(fieldsOf(sec).map((f) => [f.label, f.value, f.unit])).toEqual([[t.section.E, '29000', 'ksi'], [t.section.I, '843', 'in⁴'], [`${t.section.S} (${t.section.optional})`, '81.6', 'in³'], [`${t.section.Av} (${t.section.optional})`, '7.245', 'in²']]);
    });

    it(`${lang}: …and leads to the first calculator, in this language, with the beam on screen — while that calculator can hold it`, () => {
      const line = html.match(/<p class="mp-app__elsewhere">([\s\S]*?)<\/p>/)?.[1] ?? '';
      expect(text(line)).toBe(`${c.general} ${c.generalLink} →`);
      const links = [...html.matchAll(/<a\b[^>]*>/g)].map((m) => m[0]);
      expect(links).toHaveLength(1);
      const href = (attr(links[0], 'href') ?? '').replace(/&amp;/g, '&');
      expect(href).toBe(`${localePath(GENERAL, lang)}#b=${generalCode(defaultContinuous())}`);
      // A beam that calculator reads: four supports, and each span's two loads as rows of its own.
      const there = decodeBeam(href.slice(href.indexOf('#b=') + 3))!;
      expect(there.supports.map((x) => [x.kind, x.x])).toEqual([['pin', 0], ['roller', 24], ['roller', 54], ['roller', 78]]);
      expect(there.dists.map((d) => [d.x1, d.x2, d.w1])).toEqual([[0, 24, 0.9], [0, 24, 1.2], [24, 54, 0.9], [24, 54, 1.2], [54, 78, 0.9], [54, 78, 1.2]]);
      expect(there.section.I).toBe(843);
      expect(href).not.toMatch(/^https?:|^\/\//);
      // It has one EI and supports that do not move: a span of another stiffness, or a settlement, and there is no link.
      const stiff = show(lang, beam({ spans: [span(1, 24, 1, 0.9, 1.2), span(2, 30, 2, 0.9, 1.2), span(3, 24, 1, 0.9, 1.2)] }));
      const sunk = show(lang, beam({ settlements: [0, 0.5, 0, 0] }));
      for (const page of [stiff, sunk, show(lang, undefined, '')]) expect(page).not.toMatch(/<a\b|mp-app__elsewhere/);
    });

    it(`${lang}: every field has a name, no button submits anything, and nothing is marked on a beam with nothing wrong`, () => {
      const controls = [...html.matchAll(/<(input|select)\b[^>]*>/g)].map((m) => m[0]);
      // Units (2), three spans (12), the ends (2), four settlements, the live load (2), the section (3 + 5), the place asked about.
      expect(controls).toHaveLength(31);
      const labelled = [...html.matchAll(/<label\b[^>]*>([\s\S]*?)<\/label>/g)];
      expect(labelled.reduce((n, m) => n + (m[1].match(/<(input|select)\b/g) ?? []).length, 0)).toBe(controls.length);
      for (const m of labelled) expect(text(m[1].replace(/<select\b[\s\S]*?<\/select>/g, '')).length, m[0].slice(0, 80)).toBeGreaterThan(0);
      for (const b of html.matchAll(/<button\b[^>]*>/g)) expect(attr(b[0], 'type'), b[0]).toBe('button');
      expect(html).not.toMatch(/aria-invalid|aria-describedby|mp-app__row-error|mp-num__hint|data-invalid/);
      expect(html).toMatch(/<div class="mp-app__issues" role="alert" aria-live="assertive"><\/div>/);
      // The same actions as the other calculators, and their privacy line.
      for (const said of [t.toolbar.copy, t.toolbar.print, t.toolbar.reset, t.results.privacy]) expect(text(html)).toContain(said);
    });
  }

  it('a beam has a span: the last one cannot be removed, and the ninth cannot be added', () => {
    const one = show('en', beam({ spans: [span(1, 20, 1, 1, 1)], settlements: [0, 0] }));
    expect([...one.matchAll(/<button\b[^>]*class="mp-app__remove"[^>]*>/g)].map((m) => / disabled=""/.test(m[0]))).toEqual([true]);
    const eight = show('en', beam({ spans: Array.from({ length: 8 }, (_, i) => span(i + 1, 20, 1, 1, 1)), settlements: Array.from({ length: 9 }, () => 0) }));
    const add = [...eight.matchAll(/<button type="button" class="mp-app__add"([^>]*)>/g)].map((m) => [/ disabled=""/.test(m[1]), attr(m[0], 'title')]);
    expect(add).toEqual([[true, 'Eight at most.'], [false, undefined], [false, undefined]]);
    // Eight spans, all with a live load: 256 arrangements.
    expect(text(eight)).toContain('Spans with a live load: 8. Arrangements: 256.');
  });
});

describe('continuous beam calculator: the example, cell by cell', () => {
  const n4 = (lang: Lang) => (v: number) => formatNumber(v, 4, beamStrings[lang].ui.numbers.group);

  // What each language calls things: the first calculator's words, and this one's.
  const WORDS = {
    en: { up: 'upward', down: 'downward', at: 'at', to: 'to', on: (s: string) => `live load on ${s}`, span: 'span', spans: 'spans', and: ' and ', none: 'no live load' },
    es: { up: 'hacia arriba', down: 'hacia abajo', at: 'en', to: 'a', on: (s: string) => `carga viva en ${s}`, span: 'el vano', spans: 'los vanos', and: ' y ', none: 'sin carga viva' },
  };

  for (const lang of LANGS) {
    const t = beamStrings[lang].ui;
    const c = continuousUi[lang];
    const W = WORDS[lang];
    const num = n4(lang);
    const html = show(lang);
    const cards = cardsOf(html);
    /** "live load on spans 1 and 3", from the spans of an arrangement. */
    const loaded = (on: number[]) => (on.length === 0 ? W.none : W.on(`${on.length === 1 ? W.span : W.spans} ${on.length === 1 ? on[0] + 1 : `${on.slice(0, -1).map((i) => i + 1).join(', ')}${W.and}${on[on.length - 1] + 1}`}`));

    it(`${lang}: four cards — the supports, span by span, the largest values, the values at a point`, () => {
      expect(cards.titles).toEqual([t.supports.title, c.results.bySpan, t.results.maxima, t.results.point]);
      expect([...html.matchAll(/<h3\b[^>]*>([\s\S]*?)<\/h3>/g)].map((m) => text(m[1]))).toEqual(cards.titles);
      expect(html).not.toMatch(/<h[12456]\b/);
      // The two tables take the whole row of cards; the last card is the one whose hint paper leaves out.
      expect([...html.matchAll(/<div class="(mp-app__card(?: mp-app__card--wide)?)">/g)].map((m) => m[1].endsWith('--wide'))).toEqual([true, true, false, false]);
      expect(html).toMatch(new RegExp(`<p class="mp-app__note">${esc(t.results.pointHint)}</p></div></div><p class="mp-app__privacy">`));
    });

    it(`${lang}: the supports — each reaction and the moment over it, highest and lowest, with the spans loaded for each`, () => {
      const card = cards.of(t.supports.title);
      expect(headOf(card)).toEqual([
        t.results.support,
        `${t.results.position} (ft)`,
        `${c.results.reaction}, ${t.plot.max} (kip)`,
        `${c.results.reaction}, ${t.plot.min} (kip)`,
        `${c.results.momentOver}, ${t.plot.max} (kip·ft)`,
        `${c.results.momentOver}, ${t.plot.min} (kip·ft)`,
      ]);
      const R = (j: number, sign: 1 | -1) => {
        const top = best((x) => x.R[j], sign);
        return `${num(top.R[j])} ${W.up} [${loaded(top.on)}]`;
      };
      const M = (of: 'MB' | 'MC', sign: 1 | -1) => {
        const top = best((x) => x[of], sign);
        return `${num(top[of])} [${loaded(top.on)}]`;
      };
      expect(rowsOf(card)).toEqual([
        ['1', '0', R(0, 1), R(0, -1), '0', '0'],
        ['2', '24', R(1, 1), R(1, -1), M('MB', 1), M('MB', -1)],
        ['3', '54', R(2, 1), R(2, -1), M('MC', 1), M('MC', -1)],
        ['4', '78', R(3, 1), R(3, -1), '0', '0'],
      ]);
      // The figures themselves, and the arrangements, as an engineer expects them: an end reaction is highest with
      // the two end spans loaded; the moment over the second support is most hogging with the two spans beside it.
      const second = rowsOf(card)[1];
      expect([rowsOf(card)[0][2], second[2], second[3], second[4], second[5]]).toEqual(
        lang === 'en'
          ? ['21.17 upward [live load on spans 1 and 3]', '65.43 upward [live load on spans 1 and 2]', '24.82 upward [live load on span 3]', '-55 [live load on span 3]', '-166.9 [live load on spans 1 and 2]']
          : ['21.17 hacia arriba [carga viva en los vanos 1 y 3]', '65.43 hacia arriba [carga viva en los vanos 1 y 2]', '24.82 hacia arriba [carga viva en el vano 3]', '-55 [carga viva en el vano 3]', '-166.9 [carga viva en los vanos 1 y 2]'],
      );
      // Over every arrangement there is no one sum of reactions to give: the card closes with the key to the miniatures.
      expect(text(card)).not.toContain(t.results.equilibrium);
      expect(notesOf(card)).toEqual([c.results.key.replace('{on}', '').replace('{off}', '').replace(/\s+/g, ' ')]);
      // The miniature beside a value is the beam left to right: a block over each loaded span, 11px to a span, a
      // tick under each of the four supports. "Span 3" alone is the third block, not the first.
      const drawn = [...card.matchAll(/<svg class="mp-cont__pattern"[^>]*aria-label="([^"]*)"[^>]*>([\s\S]*?)<\/svg>/g)].map((m) => ({ said: m[1], blocks: [...m[2].matchAll(/<rect x="([\d.]+)"/g)].map((b) => Number(b[1])), ticks: [...m[2].matchAll(/<line x1="([\d.]+)" x2="\1" y1="9" y2="13"/g)].map((b) => Number(b[1])) }));
      expect(drawn).toHaveLength(12);
      for (const d of drawn) expect(d.ticks, d.said).toEqual([0.5, 11.5, 22.5, 33.5]);
      expect(Object.fromEntries(drawn.map((d) => [d.said, d.blocks]))).toEqual({ [esc(loaded([0, 2]))]: [1.5, 23.5], [esc(loaded([1]))]: [12.5], [esc(loaded([0, 1]))]: [1.5, 12.5], [esc(loaded([2]))]: [23.5], [esc(loaded([1, 2]))]: [12.5, 23.5], [esc(loaded([0]))]: [1.5] });
      // On a phone each cell is under its own head (calc.css): it carries it.
      const labels = [...card.matchAll(/<t[hd] [^>]*data-label="([^"]*)"/g)].map((m) => m[1]);
      expect(labels.slice(0, 6)).toEqual(headOf(card).map(esc));
      expect(labels).toHaveLength(24);
    });

    it(`${lang}: span by span — the largest sagging moment, the deflection from the span’s own supports, and the span over it`, () => {
      const card = cards.of(c.results.bySpan);
      expect(headOf(card)).toEqual([`${t.results.span} (ft)`, `${c.results.sagging} (kip·ft)`, `${c.results.fromSupports} (in)`, t.results.ratio]);
      const rows = rowsOf(card);
      rows.forEach((row, i) => {
        const top = best((x) => x.sag[i], 1);
        expect(row[0]).toBe(`${i + 1} ${[0, 24, 54][i]} – ${[24, 54, 78][i]}`);
        expect(row[1]).toBe(`${num(top.sag[i])} ${W.at} x = ${num(top.sagAt[i])} ft [${loaded(top.on)}]`);
      });
      // The middle span is lowest at its middle, with its own live load alone: 5wL⁴/384EI less what its end moments lift it.
      const alone = EIGHT.find((x) => x.on.length === 1 && x.on[0] === 1)!;
      const inches = alone.mid.down * (12 / EI);
      expect(rows[1].slice(2)).toEqual([`${num(inches)} ${W.down}, ${W.at} x = 39 ft [${loaded([1])}]`, `L/${Math.round((L2 * 12) / inches)}`]);
      expect(rows.map((r) => r[3])).toEqual(['L/723', 'L/632', 'L/723']);
      expect(rows.map((r) => r[1].split(' ')[0])).toEqual(['106.8', '111', '106.8']);
      expect(rows[0][2].startsWith(`0.3986 ${W.down}, ${W.at} x = 11.08 ft [${loaded([0, 2])}]`)).toBe(true);
      // No overhang, no note about one; and the key.
      expect(notesOf(card)).toEqual([c.results.key.replace('{on}', '').replace('{off}', '').replace(/\s+/g, ' ')]);
    });

    it(`${lang}: the largest values, each with its arrangement in words; the stresses of the section`, () => {
      const card = cards.of(t.results.maxima);
      const shear = best((x) => x.shear, 1);
      const sag = best((x) => Math.max(...x.sag), 1);
      const hog = best((x) => Math.min(x.MB, x.MC), -1);
      const alone = EIGHT.find((x) => x.on.length === 1 && x.on[0] === 1)!;
      expect(pairsOf(card)).toEqual([
        [t.results.maxShear, `${num(shear.shear)} kip ${W.at} x = 24 ft ${loaded([0, 1])}`],
        [t.results.maxSagging, `${num(Math.max(...sag.sag))} kip·ft ${W.at} x = 39 ft ${loaded([1])}`],
        [t.results.maxHogging, `${num(Math.abs(Math.min(hog.MB, hog.MC)))} kip·ft ${W.at} x = 54 ft ${loaded([1, 2])}`],
        [t.results.maxDeflection, `${num(alone.mid.down * (12 / EI))} in ${W.down}, ${W.at} x = 39 ft ${loaded([1])}`],
        [t.results.bendingStress, `${num((Math.abs(Math.min(hog.MB, hog.MC)) * 12) / 81.6)} ksi`],
        [t.results.shearStress, `${num(shear.shear / 7.245)} ksi`],
      ]);
      expect(pairsOf(card).map((p) => p[1].split(' ')[0])).toEqual(['33.27', '111', '166.9', '0.5695', '24.54', '4.592']);
      // In this card the miniature stands beside its sentence, and is silent: the sentence is read.
      expect((card.match(/<svg class="mp-cont__pattern"[^>]*aria-hidden="true"/g) ?? []).length).toBe(4);
      expect(card).not.toMatch(/<svg class="mp-cont__pattern"[^>]*aria-label/);
      expect(notesOf(card)).toEqual([`${t.results.shearRule.area} ${t.results.elastic}`]);
    });

    it(`${lang}: the values at the middle of the beam, each a range over the eight arrangements`, () => {
      const card = cards.of(t.results.point);
      expect(fieldsOf(card).map((f) => [f.label, f.value, f.unit])).toEqual([['x', '39', 'ft']]);
      const range = (of: (x: (typeof EIGHT)[number]) => number, unit: string, k = 1) => `${num(of(best(of, -1)) * k)} ${W.to} ${num(of(best(of, 1)) * k)} ${unit}`;
      const stress = (x: (typeof EIGHT)[number]) => (x.mid.M * 12) / 81.6;
      expect(pairsOf(card)).toEqual([
        [t.results.shear, range((x) => x.mid.V, 'kip')],
        [t.results.moment, range((x) => x.mid.M, 'kip·ft')],
        [t.results.deflection, range((x) => -x.mid.down, 'in', 12 / EI)],
        [t.results.slope, range((x) => x.mid.turn, 'rad', 1 / EI)],
        // The moment there sags in every arrangement: the stress runs from the least of them to the most.
        [t.results.bendingStress, range(stress, 'ksi')],
      ]);
      expect(pairsOf(card).map((p) => p[1])).toEqual(
        lang === 'en'
          ? ['-1.772 to 1.772 kip', '4.637 to 111 kip·ft', '-0.5695 to 0.09732 in', '-0.0003915 to 0.0003915 rad', '0.6819 to 16.32 ksi']
          : ['-1.772 a 1.772 kip', '4.637 a 111 kip·ft', '-0.5695 a 0.09732 in', '-0.0003915 a 0.0003915 rad', '0.6819 a 16.32 ksi'],
      );
    });

    it(`${lang}: the drawings — the beam with one block of load and no arrow for a reaction, and three bands`, () => {
      const shear = best((x) => x.shear, 1);
      const hog = best((x) => Math.min(x.MB, x.MC), -1);
      const said = drawingsOf(html);
      expect(said).toHaveLength(4);
      expect(said[0]).toBe(esc(`${t.results.schematic}: 78 ft; ${t.supports.kinds.pin} 0, ${t.supports.kinds.roller} 24, ${t.supports.kinds.roller} 54, ${t.supports.kinds.roller} 78.`));
      expect(said[1]).toBe(esc(`${t.results.shear}: ${t.plot.max} ${num(shear.shear)} kip ${W.at} x = 24 ft; ${t.plot.min} ${num(-shear.shear)} kip ${W.at} x = 54 ft.`));
      expect(said[2]).toBe(esc(`${t.results.moment}: ${t.plot.max} 111 kip·ft ${W.at} x = 39 ft; ${t.plot.min} ${num(Math.min(hog.MB, hog.MC))} kip·ft ${W.at} x = 54 ft.`));
      expect(said[3]).toMatch(new RegExp(`^${esc(t.results.deflection)}: ${esc(t.plot.max)} 0\\.09985 in .*; ${esc(t.plot.min)} -0\\.5695 in ${W.at} x = 39 ft\\.$`));
      // One block for the three spans' dead and live load, written as they were typed; the title says which is which.
      const beamSvg = html.match(/<figure class="mp-plot mp-beam">[\s\S]*?<\/figure>/)?.[0] ?? '';
      expect([...beamSvg.matchAll(/<text class="mp-beam__label"[^>]*>([\s\S]*?)<\/text>/g)].map((m) => text(m[1]))).toEqual(['0.9 + 1.2 kip/ft']);
      expect(text(html.match(/<p class="mp-plot__title mp-plot__title--first">([\s\S]*?)<\/p>/)?.[1] ?? '')).toBe(`${t.results.schematic} · ${c.results.uniform}`);
      expect((beamSvg.match(/class="mp-beam__pin"/g) ?? []).length).toBe(4);
      // A reaction is a range here, and an arrow has one length.
      expect(beamSvg).not.toContain('mp-beam__reaction');
      // Each diagram: two edges, what is between them tinted, and the two peaks labelled.
      const plots = [...html.matchAll(/<figure class="mp-plot">[\s\S]*?<\/figure>/g)].map((m) => m[0]);
      expect(plots).toHaveLength(3);
      for (const plot of plots) {
        expect((plot.match(/<path class="mp-plot__line"/g) ?? []).length).toBe(2);
        expect((plot.match(/<path class="mp-plot__area"/g) ?? []).length).toBe(1);
        expect((plot.match(/<circle class="mp-plot__dot"/g) ?? []).length).toBe(2);
      }
      expect([...plots[1].matchAll(/<text class="mp-plot__value"[^>]*>([\s\S]*?)<\/text>/g)].map((m) => text(m[1]))).toEqual(['111', num(Math.min(hog.MB, hog.MC))]);
      // Under them: the signs, and what a band is.
      expect(notesOf(html.match(/<div class="mp-app__plots">[\s\S]*?<\/section>/)?.[0] ?? '')).toEqual([`${t.results.signs} ${c.results.band}`]);
    });
  }

  it('the Spanish page writes its numbers the Spanish way: a narrow space between thousands, never a comma', () => {
    // The example ten times as long and ten times as loaded: reactions a hundred times larger, moments a thousand.
    const big = beam({ spans: [span(1, 240, 1, 9, 12), span(2, 300, 1, 9, 12), span(3, 240, 1, 9, 12)], section: section({ I: 843000, S: 8160, Av: 724.5 }) });
    const most = best((x) => x.MB, -1);
    // The second support’s row as the server writes it, cell by cell — not through `text`, which takes the narrow space for a plain one.
    const [en, es] = LANGS.map((lang) => [...(cardsOf(show(lang, big)).of(beamStrings[lang].ui.supports.title).match(/<tbody\b[^>]*>([\s\S]*?)<\/tbody>/)?.[1] ?? '').matchAll(/<tr\b[^>]*>([\s\S]*?)<\/tr>/g)].map((r) => [...r[1].matchAll(/<td\b[^>]*>([^<]*)/g)].map((cell) => cell[1].trim()))[1]);
    expect(en[4]).toBe(formatNumber(most.MB * 1000, 4));
    expect([en[4], es[4]]).toEqual(['-166,900', '-166\u202f900']);
    expect([en[1], es[1]]).toEqual(['6,543', '6\u202f543']);
    const spanish = show('es', big).replace(/<(input|option)\b[^>]*>/g, ' ').replace(/<[^>]+>/g, ' ');
    expect(spanish).toMatch(/\d\u202f\d{3}/);
    expect(spanish).not.toMatch(/\d,\d{3}(?!\d)/);
    // The stiffness factor's limits, in a sentence of the page: 0.001 to 1,000 — "1 000" in Spanish.
    const stiff = (lang: Lang) => show(lang, beam({ spans: [span(1, 24, 0, 1, 1), span(2, 30, 1, 1, 1)], settlements: [0, 0, 0] }));
    expect(stiff('en')).toContain('The stiffness factor must be a number from 0.001 to 1,000.');
    expect(stiff('es')).toContain('El factor de rigidez debe ser un número entre 0.001 y 1\u202f000.');
  });
});

describe('continuous beam calculator: the live load on every span — one case', () => {
  const all = clapeyron(2.1, 2.1, 2.1);
  for (const lang of LANGS) {
    const t = beamStrings[lang].ui;
    const c = continuousUi[lang];
    const num = (v: number) => formatNumber(v, 4, t.numbers.group);
    const html = show(lang, beam({ everyArrangement: false }));
    const cards = cardsOf(html);
    const [up, down, at] = [t.results.upward, t.results.downward, t.results.at];

    it(`${lang}: the supports, one value each, and the reactions add up to the load`, () => {
      const card = cards.of(t.supports.title);
      expect(headOf(card)).toEqual([t.results.support, `${t.results.position} (ft)`, `${c.results.reaction} (kip)`, `${c.results.momentOver} (kip·ft)`]);
      expect(rowsOf(card)).toEqual([
        ['1', '0', `${num(all.R[0])} ${up}`, '0'],
        ['2', '24', `${num(all.R[1])} ${up}`, num(all.MB)],
        ['3', '54', `${num(all.R[2])} ${up}`, num(all.MC)],
        ['4', '78', `${num(all.R[3])} ${up}`, '0'],
      ]);
      expect(rowsOf(card).map((r) => [r[2].split(' ')[0], r[3]])).toEqual([['18.73', '0'], ['63.17', '-155.3'], ['63.17', '-155.3'], ['18.73', '0']]);
      // 2.1 kip/ft over 78 ft.
      expect(notesOf(card)).toEqual([`${t.results.equilibrium} 163.8 = 163.8 kip.`]);
    });

    it(`${lang}: no arrangement is named anywhere, each diagram is one line, and the reactions are drawn`, () => {
      expect(html).not.toContain('mp-cont__pattern');
      expect(html).not.toContain('mp-cont__key');
      expect(text(html)).not.toContain(c.results.band);
      const plots = [...html.matchAll(/<figure class="mp-plot">[\s\S]*?<\/figure>/g)].map((m) => m[0]);
      for (const plot of plots) expect((plot.match(/<path class="mp-plot__line"/g) ?? []).length).toBe(1);
      const beamSvg = html.match(/<figure class="mp-plot mp-beam">[\s\S]*?<\/figure>/)?.[0] ?? '';
      expect([...beamSvg.matchAll(/<g class="mp-beam__reaction">[\s\S]*?<\/g>/g)].map((m) => text(m[0]))).toEqual([all.R[0], all.R[1], all.R[2], all.R[3]].map(num));
    });

    it(`${lang}: span by span, the largest values and the values at a point, as single values`, () => {
      const rows = rowsOf(cards.of(c.results.bySpan));
      rows.forEach((row, i) => expect(row[1]).toBe(`${num(all.sag[i])} ${at} x = ${num(all.sagAt[i])} ft`));
      expect(rows[1][2]).toBe(`${num(all.mid.down * (12 / EI))} ${down}, ${at} x = 39 ft`);
      expect(pairsOf(cards.of(t.results.maxima)).slice(0, 3)).toEqual([
        // 31.67 kip either side of each interior support, by symmetry: the one printed is the positive one, just right of the third.
        [t.results.maxShear, `${num(all.shear)} kip ${at} x = 54 ft`],
        // The end spans sag most: 18.73² ÷ (2 × 2.1) = 83.52 kip·ft, at 8.918 ft from the end.
        [t.results.maxSagging, `${num(all.sag[0])} kip·ft ${at} x = ${num(all.sagAt[0])} ft`],
        [t.results.maxHogging, `${num(-all.MB)} kip·ft ${at} x = 24 ft`],
      ]);
      expect(num(all.sag[0])).toBe('83.52');
      expect(pairsOf(cards.of(t.results.point))).toEqual([
        [t.results.shear, '0 kip'],
        [t.results.moment, `${num(all.mid.M)} kip·ft`],
        [t.results.deflection, `${num(-all.mid.down * (12 / EI))} in`],
        [t.results.slope, '0 rad'],
        [t.results.bendingStress, `${num((all.mid.M * 12) / 81.6)} ksi`],
      ]);
    });
  }
});

describe('continuous beam calculator: other beams', () => {
  const t = beamStrings.en.ui;
  const c = continuousUi.en;

  // One span built in at both ends under w = 2 kip/ft over 24 ft: wL²/12 = 96 kip·ft at each wall, wL/2 = 24 kip,
  // wL²/24 = 48 kip·ft at the middle, and wL⁴/384EI = 2·24⁴/(384·169,770.8) ft = 0.1221 in.
  it('a fixed end: its support is named as one, and the moment over it is the wall’s', () => {
    const html = show('en', beam({ spans: [span(1, 24, 1, 2, 0)], left: 'fixed', right: 'fixed', settlements: [0, 0] }));
    const cards = cardsOf(html);
    expect(rowsOf(cards.of('Supports'))).toEqual([['1 Fixed', '0', '24 upward', '-96'], ['2 Fixed', '24', '24 upward', '-96']]);
    expect(rowsOf(cards.of('Span by span'))).toEqual([['1 0 – 24', '48 at x = 12 ft', `${formatNumber(((2 * 24 ** 4) / 384 / EI) * 12)} downward, at x = 12 ft`, `L/${formatNumber(Math.round(288 / (((2 * 24 ** 4) / 384 / EI) * 12)), 6)}`]]);
    expect(pairsOf(cards.of('Largest values')).slice(0, 3)).toEqual([['Shear', '24 kip at x = 0 ft'], ['Sagging moment', '48 kip·ft at x = 12 ft'], ['Hogging moment', '96 kip·ft at x = 0 ft']]);
    // No live load on its one span: asked for every arrangement, there is one, and the page is that of one case.
    expect(html).not.toContain('mp-cont__pattern');
    expect(notesOf(cards.of('Supports'))).toEqual(['The reactions add up to the load: 48 = 48 kip.']);
    // The drawing has two walls, each with its force and the moment it holds.
    const beamSvg = html.match(/<figure class="mp-plot mp-beam">[\s\S]*?<\/figure>/)?.[0] ?? '';
    expect((beamSvg.match(/class="mp-beam__wall"/g) ?? []).length).toBe(2);
    expect([...beamSvg.matchAll(/<g class="mp-beam__reaction">[\s\S]*?<\/g>/g)].map((m) => text(m[0]))).toEqual(['24 ↺ 96', '24 ↻ 96']);
    expect(drawingsOf(html)[0]).toBe('Loads and supports: 24 ft; Fixed 0, Fixed 24.');
  });

  // 20 ft on two supports and 6 ft past the second, 1.5 kip/ft dead all along: w·a²/2 = 27 kip·ft over the second
  // support, which carries w(L + a)²/2L = 25.35 kip; the first, 39 − 25.35 = 13.65 kip.
  it('an overhang: a free end has no support, its span is named an overhang, and its length is taken twice', () => {
    const html = show('en', beam({ spans: [span(1, 20, 1, 1.5, 0), span(2, 6, 1, 1.5, 0)], right: 'free', settlements: [0, 0, 0] }));
    const cards = cardsOf(html);
    expect(rowsOf(cards.of('Supports'))).toEqual([['1', '0', '13.65 upward', '0'], ['2', '20', '25.35 upward', '-27']]);
    const rows = rowsOf(cards.of('Span by span'));
    expect(rows.map((r) => r[0])).toEqual(['1 0 – 20', '2 Overhang, 20 – 26']);
    // The overhang hogs all along: it has no sagging moment. Its tip: w·a(4a²L − L³ + 3a³)/24EI — upward here, the span lifts it.
    const tip = ((1.5 * 6 * (4 * 36 * 20 - 8000 + 3 * 216)) / 24 / EI) * 12;
    expect(tip).toBeLessThan(0);
    expect(rows[1].slice(1)).toEqual(['none', `${formatNumber(Math.abs(tip))} upward, at x = 26 ft`, `L/${formatNumber(Math.round(144 / Math.abs(tip)), 6)}`]);
    // The span's own: 13.65² ÷ (2 × 1.5) = 62.11 kip·ft at 9.1 ft.
    expect(rows[0][1]).toBe('62.11 at x = 9.1 ft');
    expect(notesOf(cards.of('Span by span'))).toEqual([t.results.ratioNote]);
    expect(drawingsOf(html)[0]).toBe('Loads and supports: 26 ft; Pin 0, Roller 20.');
  });

  // Two spans of 20 ft, nothing on them, the middle support pushed down 0.6 in; E = 29,000 ksi, I = 1,000 in⁴:
  // EI = 201,388.9 kip·ft², δ = 0.05 ft. 3EIδ/L² = 75.52 kip·ft over the support; each end reaction 3EIδ/L³ =
  // 3.776 kip upward, and the middle one 6EIδ/L³ = 7.552 kip downward.
  it('a settlement and no load: the moment it puts in the beam, the reactions it takes, and the support 0.6 in down', () => {
    const sunk = beam({ spans: [span(1, 20), span(2, 20)], settlements: [0, 0.6, 0], section: section({ I: 1000 }), everyArrangement: false });
    const html = show('en', sunk);
    const cards = cardsOf(html);
    expect(rowsOf(cards.of('Supports'))).toEqual([['1', '0', '3.776 upward', '0'], ['2', '20', '7.552 downward', '75.52'], ['3', '40', '3.776 upward', '0']]);
    expect(notesOf(cards.of('Supports'))).toEqual(['The reactions add up to the load: 0 = 0 kip.']);
    expect(pairsOf(cards.of('Largest values')).slice(0, 4)).toEqual([['Shear', '3.776 kip at x = 0 ft'], ['Sagging moment', '75.52 kip·ft at x = 20 ft'], ['Hogging moment', 'none'], ['Deflection', '0.6 in downward, at x = 20 ft']]);
    // From its own supports each span is δ/(3√3) = 0.1155 in under their line, at 20/√3 = 11.55 ft from its outer end.
    expect(rowsOf(cards.of('Span by span')).map((r) => r.slice(2))).toEqual([['0.1155 downward, at x = 11.55 ft', 'L/2,078'], ['0.1155 downward, at x = 28.45 ft', 'L/2,078']]);
    // The form shows the settlement where it was typed.
    expect(fieldsOf(groupsOf(html).find((g) => g.legend === 'Supports')!.html).map((f) => f.value)).toEqual(['', '0.6', '']);
    expect(issuesOf(html)).toBe('');
  });

  it('a settlement needs E and I: without them nothing is solved, and the support’s field says why', () => {
    for (const lang of LANGS) {
      const tt = beamStrings[lang].ui;
      const cc = continuousUi[lang];
      const html = show(lang, beam({ settlements: [0, 0.6, 0, 0], section: section({ I: 0 }) }));
      expect(issuesOf(html)).toBe(`${tt.issuesTitle} ${cc.issues.settlement}`);
      expect(cardsOf(html).titles).toEqual([]);
      expect(text(html)).toContain(tt.results.waiting);
      const fields = fieldsOf(groupsOf(html).find((g) => g.legend === tt.supports.title)!.html);
      expect(fields.map((f) => f.invalid)).toEqual([false, true, false, false]);
      // The field is tied to its own line, which says the same.
      const line = html.match(new RegExp(`<p class="mp-app__row-error" id="${fields[1].describedBy}">([\\s\\S]*?)</p>`))?.[1] ?? '';
      expect(text(line)).toBe(cc.issues.settlement);
      // The beam is still drawn: the visitor sees what they are entering.
      expect(html).toContain('<figure class="mp-plot mp-beam">');
    }
    // While a steel shape's table is on its way there is no E or I yet: the page says that, not "complete the section".
    const waiting = show('en', beam({ settlements: [0, 0.6, 0, 0], section: section({ mode: 'shape', shape: 'W21X44' }) }));
    expect(issuesOf(waiting)).toBe(`${t.issuesTitle} ${t.section.loading}`);
  });

  // Two spans of 20 and 30 ft under 1.2 kip/ft, the second 2.5 times as stiff. Clapeyron with each length over its
  // stiffness: 2·MB(20 + 12) = −0.3(8,000 + 10,800), MB = −88.125 kip·ft; reactions 12 − 4.406 = 7.594 and 18 − 2.9375 = 15.06 kip.
  it('a stiffness factor that is not 1: the moments follow it, no stress is given, and the note says why', () => {
    const form = beam({ spans: [span(1, 20, 1, 1.2, 0), span(2, 30, 2.5, 1.2, 0)], settlements: [0, 0, 0], everyArrangement: false });
    const html = show('en', form);
    const cards = cardsOf(html);
    expect(rowsOf(cards.of('Supports'))).toEqual([['1', '0', '7.594 upward', '0'], ['2', '20', '37.34 upward', '-88.13'], ['3', '50', '15.06 upward', '0']]);
    const largest = cards.of('Largest values');
    expect(pairsOf(largest).map((p) => p[0])).toEqual(['Shear', 'Sagging moment', 'Hogging moment', 'Deflection']);
    expect(notesOf(largest)).toEqual([c.results.noStress]);
    expect(pairsOf(cards.of('Values at a point')).map((p) => p[0])).toEqual(['Shear, V', 'Bending moment, M', 'Deflection', 'Slope']);
    expect(text(html)).not.toContain(t.results.elastic);
    // No card has a value in ksi: the only one on the page is the modulus, in the form.
    for (const title of cards.titles) expect(text(cards.of(title)), title).not.toMatch(/\bksi\b/);
    for (const lang of LANGS) expect(notesOf(cardsOf(show(lang, form)).of(beamStrings[lang].ui.results.maxima))).toEqual([continuousUi[lang].results.noStress]);
    // With the factor back at 1 the two stresses are back, and the first calculator's note with them.
    const plain = cardsOf(show('en', { ...form, spans: [span(1, 20, 1, 1.2, 0), span(2, 30, 1, 1.2, 0)] })).of('Largest values');
    expect(pairsOf(plain).map((p) => p[0])).toEqual(['Shear', 'Sagging moment', 'Hogging moment', 'Deflection', 'Bending stress', 'Shear stress']);
  });

  it('without E or I: shear and moment are there, and the page says what to enter for the rest', () => {
    const html = show('en', beam({ section: section({ I: 0, S: 0, Av: 0 }) }));
    const cards = cardsOf(html);
    expect(headOf(cards.of('Span by span'))).toEqual(['Span (ft)', 'Largest sagging moment (kip·ft)']);
    expect(pairsOf(cards.of('Largest values')).slice(3)).toEqual([['Deflection', t.results.need.props.deflection], ['Bending stress', t.results.need.props.bending], ['Shear stress', t.results.need.props.shear]]);
    expect(pairsOf(cards.of('Values at a point')).map((p) => p[0])).toEqual(['Shear, V', 'Bending moment, M']);
    expect(drawingsOf(html)).toHaveLength(3);
    expect(text(html)).toContain(t.results.need.props.deflection);
  });

  it('further loads on the drawing: a live one is marked, and spans with other loads are other blocks', () => {
    for (const lang of LANGS) {
      const live = continuousUi[lang].results.live;
      const html = show(lang, beam({ spans: [span(1, 24, 1, 0.9, 1.2), span(2, 30, 1, 0.9, 0), span(3, 24, 1, 0.9, 1.2)], points: [point(4, 1, 12, 9, 'down', true), point(5, 0, 6, 5)], dists: [dist(6, 2, 3, 15, 0.4, 0.4, 'down', true)], nextId: 7 }));
      const beamSvg = html.match(/<figure class="mp-plot mp-beam">[\s\S]*?<\/figure>/)?.[0] ?? '';
      expect([...beamSvg.matchAll(/<text class="mp-beam__label"[^>]*>([\s\S]*?)<\/text>/g)].map((m) => text(m[1])).sort()).toEqual(['0.4 kip/ft, ' + live, '0.9 + 0 kip/ft', '0.9 + 1.2 kip/ft', '0.9 + 1.2 kip/ft', '5 kip', '9 kip, ' + live].sort());
    }
  });
});

describe('continuous beam calculator: the faults, on their rows', () => {
  const t = beamStrings.en.ui;
  const c = continuousUi.en;
  const spansOf = (html: string) => fieldsOf(groupsOf(html).find((g) => g.legend === 'Spans')!.html);
  /** The line under a row that a field is tied to. */
  const lineOf = (html: string, id: string | undefined) => text(html.match(new RegExp(`<p class="mp-app__row-error" id="${id}">([\\s\\S]*?)</p>`))?.[1] ?? '');
  const three = (change: (spans: SpanRow[]) => void) => {
    const spans = defaultContinuous().spans;
    change(spans);
    return show('en', beam({ spans }));
  };

  it('a length, a stiffness factor or a load of a span: that field is marked, and tied to the line under its row', () => {
    const cases: [(s: SpanRow[]) => void, number, string][] = [
      [(s) => (s[1].L = 0), 4, c.issues.length],
      [(s) => (s[1].L = 1e61), 4, c.issues.size],
      [(s) => (s[2].k = 0), 9, 'The stiffness factor must be a number from 0.001 to 1,000.'],
      [(s) => (s[2].k = 5000), 9, 'The stiffness factor must be a number from 0.001 to 1,000.'],
      [(s) => (s[0].dead = Number.NaN), 2, t.issues.number],
      [(s) => (s[0].live = 1e61), 3, c.issues.size],
      [(s) => (s[1].L = 0.04), 4, c.issues['short-span']],
    ];
    for (const [change, field, says] of cases) {
      const html = three(change);
      const fields = spansOf(html);
      expect(fields.map((f) => f.invalid), says).toEqual(fields.map((_, i) => i === field));
      expect(lineOf(html, fields[field].describedBy), says).toBe(says);
      expect(issuesOf(html), says).toBe(`${t.issuesTitle} ${says}`);
      // Its row is marked, and no other; nothing is solved.
      expect([...html.matchAll(/<div class="mp-app__item" role="group" aria-label="([^"]*)" data-invalid="true"/g)].map((m) => m[1]), says).toEqual([`Span ${Math.floor(field / 4) + 1}`]);
      expect(cardsOf(html).titles).toEqual([]);
    }
  });

  it('a load off its span: its place is marked, not its size; a size that is not a number marks both', () => {
    const off = show('en', beam({ points: [point(4, 0, 25, 5)], dists: [dist(5, 1, 10, 31, 1, 1)], nextId: 6 }));
    const [points, dists] = ['Point loads', 'Distributed loads'].map((legend) => fieldsOf(groupsOf(off).find((g) => g.legend === legend)!.html));
    expect(points.map((f) => [f.label, f.invalid])).toEqual([['Load', false], ['At', true]]);
    expect(dists.map((f) => [f.label, f.invalid])).toEqual([['At the start', false], ['At the end', false], ['From', true], ['To', true]]);
    expect(lineOf(off, points[1].describedBy)).toBe(c.issues.outside);
    expect(lineOf(off, dists[2].describedBy)).toBe(c.issues.outside);
    // Said once in the results box, though two rows have it.
    expect(issuesOf(off)).toBe(`${t.issuesTitle} ${c.issues.outside}`);
    const nan = show('en', beam({ points: [point(4, 0, 5, Number.NaN)], nextId: 5 }));
    expect(fieldsOf(groupsOf(nan).find((g) => g.legend === 'Point loads')!.html).map((f) => f.invalid)).toEqual([true, true]);
    expect(issuesOf(nan)).toBe(`${t.issuesTitle} ${t.issues.number}`);
  });

  it('ends that do not hold the beam: no row is at fault, and the page says what it takes', () => {
    const html = show('en', beam({ spans: [span(1, 20, 1, 1, 1)], right: 'free', settlements: [0, 0] }));
    expect(issuesOf(html)).toBe(`${t.issuesTitle} ${c.issues.unstable}`);
    expect(html).not.toContain('mp-app__row-error');
    expect(c.issues.unstable).toMatch(/two supports, or one fixed end/);
    // Fixed instead, the same span is a cantilever, and is solved.
    expect(cardsOf(show('en', beam({ spans: [span(1, 20, 1, 1, 1)], left: 'fixed', right: 'free', settlements: [0, 0] }))).titles).toHaveLength(4);
  });

  it('a section value that is not one leaves the beam solved: the page asks for the section to be checked', () => {
    const html = show('en', beam({ section: section({ I: -5 }) }));
    expect(issuesOf(html)).toBe(`${t.issuesSection} ${t.issues.section}`);
    expect(cardsOf(html).titles).toHaveLength(4);
    const sec = fieldsOf(groupsOf(html).find((g) => g.legend === t.section.title)!.html);
    expect(sec.map((f) => f.invalid)).toEqual([false, true, false, false]);
    // The field is tied to the line in the results box, which has that id.
    expect(html).toContain(`<li id="${sec[1].describedBy}">${t.issues.section}</li>`);
  });

  it('several faults are each said once, in both languages', () => {
    for (const lang of LANGS) {
      const tt = beamStrings[lang].ui;
      const cc = continuousUi[lang];
      const html = show(lang, beam({ spans: [span(1, 0, 1, 1, 1), span(2, 30, 1, 1, 1), span(3, 0, 1, 1, 1)], points: [point(4, 1, 40, 5)], nextId: 5 }));
      const list = [...(html.match(/<div class="mp-app__issues"[^>]*>([\s\S]*?)<\/div>/)?.[1] ?? '').matchAll(/<li[^>]*>([\s\S]*?)<\/li>/g)].map((m) => text(m[1]));
      expect(list).toEqual([cc.issues.length, cc.issues.outside]);
      expect(text(html)).toContain(tt.issuesTitle);
    }
  });
});

describe('continuous beam calculator: what it borrows from the first calculator is as it was', () => {
  const points = [{ x: 0, y: 0 }, { x: 5, y: 12 }, { x: 5, y: -4 }, { x: 10, y: 0 }];
  const base = { title: 'Shear, V', unit: 'kip', points, marks: [{ x: 5, y: 12 }], breaks: [0, 5, 10], L: 10, width: 400, height: 120, probe: { x: 5, y: 12 }, onProbe: () => {}, summary: 'a diagram' };

  it('a diagram without a band is one line over its own area, with one dot under the pointer', () => {
    const html = renderToStaticMarkup(h(BeamPlot, base));
    expect((html.match(/<path class="mp-plot__line"/g) ?? []).length).toBe(1);
    // From the axis, along the line, and back to the axis.
    const zero = html.match(/<line class="mp-plot__axis"[^>]* y1="([\d.]+)"/)?.[1];
    expect(html).toMatch(new RegExp(`<path class="mp-plot__area" d="M30\\.0 ${Number(zero).toFixed(1)} L30\\.0 `));
    expect((html.match(/<g class="mp-plot__probe">[\s\S]*?<\/g>/)?.[0].match(/<circle/g) ?? []).length).toBe(1);
  });

  it('with a band: both edges, what is between them and nothing else tinted, a dot on each edge, and a scale that holds both', () => {
    const lower = [{ x: 0, y: 0 }, { x: 5, y: 3 }, { x: 5, y: -20 }, { x: 10, y: -2 }];
    const html = renderToStaticMarkup(h(BeamPlot, { ...base, band: { points: lower, probe: 3 } }));
    const lines = [...html.matchAll(/<path class="mp-plot__line" d="([^"]*)"/g)].map((m) => m[1]);
    expect(lines).toHaveLength(2);
    // The tint runs along the upper edge and back along the lower one: it starts where the upper edge does and closes on itself.
    const area = html.match(/<path class="mp-plot__area" d="([^"]*)"/)?.[1] ?? '';
    expect(area.startsWith(lines[0])).toBe(true);
    expect(area.endsWith('Z')).toBe(true);
    // …back from the END of the lower edge: taken forward again, the tint would cross itself from one end of the beam to the other.
    const back = [...lines[1].matchAll(/[ML]([\d.]+ [\d.]+)/g)].map((m) => m[1]).reverse();
    expect([...area.slice(lines[0].length).matchAll(/L([\d.]+ [\d.]+)/g)].map((m) => m[1])).toEqual(back);
    expect(area.split('L').length - 1).toBe(points.length - 1 + lower.length);
    // The lowest point of the lower edge is on the drawing: the scale reaches −20, where the line alone stopped at −4.
    const ys = (d: string) => [...d.matchAll(/[ML][\d.]+ ([\d.]+)/g)].map((m) => Number(m[1]));
    expect(Math.max(...ys(lines[1]))).toBeLessThanOrEqual(120 - 20);
    expect(Math.max(...ys(lines[1]))).toBeGreaterThan(Math.max(...ys(lines[0])));
    expect((html.match(/<g class="mp-plot__probe">[\s\S]*?<\/g>/)?.[0].match(/<circle/g) ?? []).length).toBe(2);
    // No pointer on the lower edge, one dot.
    const away = renderToStaticMarkup(h(BeamPlot, { ...base, band: { points: lower, probe: null } }));
    expect((away.match(/<g class="mp-plot__probe">[\s\S]*?<\/g>/)?.[0].match(/<circle/g) ?? []).length).toBe(1);
  });

  it('the drawing of a beam writes each load’s value and unit, unless a page gives it other words', () => {
    const form = { ...decodeBeam('us;20;p0_r20;;12,8;0,20,1.2,1.2;;p,s,29000,800,88.9,6.39')!, nextId: 9 };
    const draw = (label?: (load: { kind: 'point' | 'dist'; id: number; text: string }) => string) => renderToStaticMarkup(h(BeamSchematic, { form, reactions: null, width: 600, probeX: null, summary: 'a beam', label }));
    const labels = (html: string) => [...html.matchAll(/<text class="mp-beam__label"[^>]*>([\s\S]*?)<\/text>/g)].map((m) => text(m[1]));
    expect(labels(draw())).toEqual(['8 kip', '1.2 kip/ft']);
    // Given the value that would be written, and which load it is.
    const seen: string[] = [];
    const told = draw((load) => {
      seen.push(`${load.kind} ${load.id} ${load.text}`);
      return load.kind === 'point' ? `${load.text}, live` : load.text;
    });
    expect(labels(told)).toEqual(['8 kip, live', '1.2 kip/ft']);
    expect([...new Set(seen)].sort()).toEqual([`dist ${form.dists[0].id} 1.2 kip/ft`, `point ${form.points[0].id} 8 kip`]);
    // A label that says nothing new changes nothing at all.
    expect(draw((load) => load.text)).toBe(draw());
  });

  // calc.css is loaded by all three calculators. What this one adds begins
  // with a class of its own, so that no rule of it can reach the other two.
  it('every rule this calculator adds to the shared sheet begins with a class of its own', () => {
    const css = readFileSync(join(SRC, 'components', 'ttc', 'calc', 'calc.css'), 'utf8');
    const from = css.indexOf('/* THE CONTINUOUS BEAM (.mp-cont)');
    expect(from).toBeGreaterThan(0);
    // Nothing of the other two comes after it.
    const mine = css.slice(from).replace(/\/\*[\s\S]*?\*\//g, '');
    const selectors = [...mine.matchAll(/(^|[{}])\s*([^{}@]+?)\s*\{/g)].flatMap((m) => m[2].split(',').map((s) => s.trim())).filter(Boolean);
    expect(selectors.length).toBeGreaterThan(20);
    for (const s of selectors) expect(s, s).toMatch(/^\.mp-cont(__[a-z]+)?(?![\w-])/);
    // …and the sheet before it has no rule about this calculator's classes.
    expect(css.slice(0, from)).not.toMatch(/\.mp-cont(__|[^\w-])/);
  });
});
