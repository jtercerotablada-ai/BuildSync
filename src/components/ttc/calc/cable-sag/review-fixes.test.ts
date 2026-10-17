import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { createElement as h } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { beamStrings } from '@/lib/calc/beam/strings';
import { analyseSafely } from '@/lib/calc/cable-sag/analysis';
import { defaultCase, defaultCaseFor, reduceCableSag, type CableSagAction, type CableSagForm } from '@/lib/calc/cable-sag/model';
import { cableSagPage } from '@/lib/calc/cable-sag/page-strings';
import { cableSagUi, sharedWords } from '@/lib/calc/cable-sag/strings';
import type { Lang } from '@/lib/ttc/i18n';
import { CableSagCalculator } from './CableSagCalculator';
import { cableLayout, type Layout, type LayoutOptions } from './CableSchematic';
import { refusedText } from './CsNum';
import { SweepChart, chartLayout } from './SweepChart';
import { warningSentence } from './text';

/**
 * What the adversarial review of the drawing, the words and the form found, as behaviour (the arithmetic is in
 * lib/calc/cable-sag/review-fixes.test.ts). Each test fails on the code before the fixes.
 */

const act = (form: CableSagForm, ...actions: CableSagAction[]) => actions.reduce(reduceCableSag, form);
const show = (lang: Lang, initial?: CableSagForm) => renderToStaticMarkup(h(CableSagCalculator, { t: sharedWords(beamStrings[lang].ui), w: cableSagUi[lang], initial }));
const plain = (html: string) => html.replace(/<[^>]+>/g, ' ').replace(/&#x27;/g, "'").replace(/\s+/g, ' ');
const reading = (html: string) => plain(html.match(/<p class="mp-cs__reading">([^<]*)<\/p>/)?.[1] ?? '');

const OPTIONS: LayoutOptions = {
  width: 720,
  group: ',',
  unit: 'ft',
  labels: cableSagUi.en.results.labels,
  texts: { A: 'tension 5 kip', B: 'tension 5 kip', H: 'pretension H 1 kip' },
  tensions: true,
  dims: true,
  load: true,
  parabola: true,
};
const hanging = (span: number, rise: number, sag: number): CableSagForm => act(defaultCase(), { type: 'geometry', patch: { span, rise } }, { type: 'known', patch: { known: 'sag', sagKind: 'mid', sag } });
const layoutOf = (form: CableSagForm): Layout => {
  const a = analyseSafely(form);
  return cableLayout(a.drawing, { ...OPTIONS, shares: a.points?.segments.map((x) => x.share) });
};
const sagBar = (l: Layout) => {
  const d = l.dims.find((x) => x.id === 'mid')!;
  return Math.abs(d.y2 - d.y1);
};

describe('C2: the drawing makes the sag visible, or says it cannot', () => {
  it('a strongly inclined cable (rise = span, sag 2 %): only the sag is stretched, from a chord that keeps its true slope, and the bar is long enough to see', () => {
    const l = layoutOf(hanging(100, 100, 2));
    expect(l.chordRelative).toBe(true);
    expect(l.exaggeration).toBeGreaterThan(5);
    expect(sagBar(l)).toBeGreaterThanOrEqual(14);
    // the sag bar is exactly the sag (2 ft) times the scale times the stretch
    expect(sagBar(l)).toBeCloseTo(2 * l.scale * l.exaggeration, 1);
    // the chord is drawn true: a rise equal to the span is a slope of 1
    const dy = l.chord.y1 - l.chord.y2;
    const dx = l.chord.x2 - l.chord.x1;
    expect(dy / dx).toBeCloseTo(1, 3);
    expect(l.legend).toContain('verticalSag');
    expect(l.legend).not.toContain('vertical');
    expect(l.tooSmall).toBe(false);
  });

  it('a falling chord (rise −30, a sag of 0.44 ft): the bar is no longer 1–2 px', () => {
    const l = layoutOf(act(defaultCase(), { type: 'geometry', patch: { span: 100, rise: -30 } }, { type: 'known', patch: { known: 'H', H: 8 } }, { type: 'loads', patch: { weightFrom: 'section' } }));
    expect(sagBar(l)).toBeGreaterThanOrEqual(14);
  });

  it('a level cable keeps the textbook stretch of the whole drawing (the sag stays the number on the drawing to the pixel)', () => {
    const l = layoutOf(hanging(100, 0, 2));
    expect(l.chordRelative).toBe(false);
    expect(l.compression).toBe(1);
    expect(sagBar(l)).toBeCloseTo(2 * l.scale * l.exaggeration, 1);
  });

  it('a sag of a hundred-thousandth of the span is too small to see even at 25 times: the drawing says so', () => {
    const l = layoutOf(hanging(100, 0, 0.001));
    expect(l.tooSmall).toBe(true);
    const html = show('en', hanging(100, 0, 0.001));
    expect(plain(html)).toContain('the sag is still too small to show, so the cable looks straight');
    expect(plain(html)).not.toContain('so that the sag can be seen');
    // and a sag that can be seen does not say it
    expect(layoutOf(hanging(100, 0, 0.5)).tooSmall).toBe(false);
  });

  it('a cable much deeper than wide (a sag of 50 spans) is drawn as wide as the page with its heights compressed: its supports are apart and no word is lost', () => {
    const l = layoutOf(hanging(100, 0, 5000));
    expect(l.compression).toBeGreaterThan(10);
    expect(l.supports[1].x - l.supports[0].x).toBeGreaterThan(600);
    expect(l.labels.every((x) => x.clear)).toBe(true);
    expect(l.legend).toContain('verticalSmall');
    const a = l.labels.find((x) => x.id === 'A')!;
    const b = l.labels.find((x) => x.id === 'B')!;
    expect(Math.abs(a.x - b.x)).toBeGreaterThan(300);
    const steep = layoutOf(hanging(100, 100, 500));
    expect(steep.compression).toBeGreaterThan(1);
    expect(steep.labels.every((x) => x.clear)).toBe(true);
  });
});

describe('C4–C6: the state drawing, the point-load sag bar and the legend promises', () => {
  it('the two sag bars of a change of state carry their figures, and the tensions at the supports are on the drawing', () => {
    const html = show('en', defaultCaseFor('state'));
    expect(html).toContain('>1: 6 ft<');
    expect(html).toContain('>2: 6.105 ft<');
    expect(html).toContain('>state 2 tension 5.102 kip<');
    expect((html.match(/>state 2 tension 5\.102 kip</g) ?? []).length).toBe(2);
  });

  it('the sag bar that stands aside from a load’s arrow is tied to the position it measures by a short dotted line, and its word stands on the bar’s far side', () => {
    const form = defaultCaseFor('points');
    const l = layoutOf(form);
    const bar = l.dims[0];
    const joint = l.joints[1];
    expect(bar.reach).not.toBeNull();
    expect(bar.reach!.x1).toBe(bar.x);
    expect(bar.reach!.x2).toBeCloseTo(joint.x, 1);
    const word = l.labels.find((x) => x.kind === 'dim')!;
    expect(word.x).toBeLessThan(bar.x);
    // a bar that is nowhere near a load needs none
    expect(layoutOf(act(form, { type: 'points', patch: { sagAt: 22 } })).dims[0].reach).toBeNull();
  });

  it('the pieces of the polygon are drawn visibly heavier or lighter: from 2 to 5.5 px, whatever the tensions are', () => {
    const l = layoutOf(defaultCaseFor('points'));
    const widths = l.segments.map((s) => s.width);
    expect(Math.min(...widths)).toBe(2);
    expect(Math.max(...widths)).toBe(5.5);
    expect(widths[0]).toBeGreaterThan(widths[1]);
    // the largest tension is the heaviest piece
    let many = defaultCaseFor('points');
    for (let i = 0; i < 9; i++) many = reduceCableSag(many, { type: 'point-add' });
    const w2 = layoutOf(many).segments.map((s) => s.width);
    expect(new Set(w2).size).toBeGreaterThan(3);
    expect(Math.max(...w2)).toBeLessThanOrEqual(5.5);
    expect(Math.min(...w2)).toBeGreaterThanOrEqual(2);
  });

  it('the legend says it is not to scale, in both languages', () => {
    expect(cableSagUi.en.results.legend.polygon).toContain('not to scale');
    expect(cableSagUi.es.results.legend.polygon).toContain('sin escala');
  });
});

describe('B4: the note under the drawing is true of the arrows it is under', () => {
  it('says the arrows are all one size for a hanging cable and a change of state, and that they are not to scale (longer when larger) for point loads', () => {
    for (const lang of ['en', 'es'] as const) {
      const w = cableSagUi[lang].results;
      expect(plain(show(lang, defaultCaseFor('hanging')))).toContain(w.scale);
      expect(plain(show(lang, defaultCaseFor('points')))).toContain(w.scalePoints);
      expect(plain(show(lang, defaultCaseFor('points')))).not.toContain(w.scale);
    }
    expect(cableSagUi.en.results.scalePoints).toContain('longer arrow is a larger load');
  });
});

describe('B5 and B6: the sentence under the drawing', () => {
  it('speaks of the span as the span and of the cable as the cable, and does not say a rigid cable “stretches”', () => {
    const lengthGiven = act(defaultCase(), { type: 'known', patch: { known: 'length', length: 102.5 } });
    const elastic = reading(show('en', lengthGiven));
    expect(elastic).toMatch(/^Cut to 102\.5 ft before it stretches, the cable hangs over a 100 ft span with/);
    const rigid = reading(show('en', act(lengthGiven, { type: 'section', patch: { elastic: false } })));
    expect(rigid).toMatch(/^Cut to 102\.5 ft, the cable hangs over a 100 ft span with/);
    expect(rigid).not.toContain('stretches');
    expect(reading(show('es', act(lengthGiven, { type: 'section', patch: { elastic: false } })))).not.toContain('estirarse');
    expect(reading(show('en'))).not.toContain('this 100 ft cable');
  });

  it('a tension at a level span’s supports is “at each support”, not “at its higher support”', () => {
    const level = act(defaultCase(), { type: 'known', patch: { known: 'T-high', T: 13.5 } });
    expect(reading(show('en', level))).toMatch(/^With 13\.5 kip at each support,/);
    expect(reading(show('en', act(level, { type: 'geometry', patch: { rise: 20 } })))).toMatch(/^With 13\.5 kip at its higher support,/);
  });

  it('the lowest joint of a funicular cable that IS support A is not said to be level with support A', () => {
    // one load pulling up: the polygon rises above its chord and its lowest joint is support A
    const form = act(defaultCaseFor('points'), { type: 'point-remove', id: 1 }, { type: 'point-remove', id: 3 }, { type: 'point-patch', id: 2, patch: { P: -5 } }, { type: 'points', patch: { pointsKnown: 'H', pointsH: 20 } });
    const a = analyseSafely(form);
    expect(a.points!.joints[a.points!.lowest.joint].kind).toBe('A');
    const sentence = reading(show('en', form));
    expect(sentence).toContain('the cable’s lowest point is support A');
    expect(sentence).not.toContain('level with support A');
    expect(reading(show('es', form))).not.toContain('a nivel con el apoyo A');
    // the example's lowest joint is a load: the full sentence stays
    expect(reading(show('en', act(defaultCaseFor('points'), { type: 'points', patch: { pointsKnown: 'H', pointsH: 37.5 } })))).toMatch(/lowest point, load 2, is 12 ft below support A/);
    // and the words themselves carry both forms in both languages
    for (const lang of ['en', 'es'] as const) {
      const r = cableSagUi[lang].results.reading.points;
      expect(r.HAtSupport).not.toContain('{z}');
      expect(r.TAtSupport).not.toContain('{z}');
    }
  });
});

describe('A2: the warning says why', () => {
  it('depth and elasticity have their own sentence in both languages, and the numbers fill it', () => {
    for (const lang of ['en', 'es'] as const) {
      const w = cableSagUi[lang];
      const ctx = { num: (v: number) => String(v), length: 'ft', force: 'kip', span: 100, temp: '°F', line: 'lb/ft' };
      const depth = warningSentence({ code: 'parabola-differs', difference: 0.05, tolerance: 0.01, ratio: 0.2, cause: 'depth' }, w, ctx);
      const elastic = warningSentence({ code: 'parabola-differs', difference: 0.02, tolerance: 0.01, ratio: 0.02, cause: 'elasticity' }, w, ctx);
      expect(depth).not.toMatch(/\{|\}/);
      expect(elastic).not.toMatch(/\{|\}/);
      expect(depth).not.toBe(elastic);
      expect(depth).toContain('20');
      expect(elastic).not.toContain('{ratio}');
    }
    expect(cableSagUi.en.results.compare.whyElastic).toContain('stretch');
    expect(cableSagUi.en.results.compare.whyDepth).toContain('deep enough');
  });

  it('the page says the weight is spread over the CHORD, in both languages, and the compare notes say so', () => {
    for (const lang of ['en', 'es'] as const) {
      const page = JSON.stringify(cableSagPage[lang]);
      expect(page).toContain('√(1 + (h/L)²)');
      expect(page).not.toContain('q + w por unidad,');
    }
    expect(cableSagUi.en.results.compare.catenaryIs).toContain('chord');
    expect(cableSagUi.es.results.compare.combinedIs).toContain('cuerda');
  });
});

describe('A5, A6, A7, A8, A13: the notes say only what is true', () => {
  it('the largest tension is “at a support” only while every load pulls down; a given tension “can” belong to two cables', () => {
    expect(cableSagUi.en.points.known.notes['T-max']).toContain('when every load pulls down');
    expect(cableSagUi.es.points.known.notes['T-max']).toContain('mientras todas las cargas tiran hacia abajo');
    for (const lang of ['en', 'es'] as const) {
      expect(cableSagUi[lang].known.notes['T-high']).toMatch(/can belong|puede corresponder/);
      expect(cableSagUi[lang].known.notes['T-low']).toMatch(/can belong|puede corresponder/);
    }
  });

  it('the load-factor note names what is multiplied (state 2’s own load and ice, not an increment on state 1)', () => {
    const items = cableSagPage.en.signs.items.join(' ');
    expect(items).not.toContain('that state 2 adds to state 1');
    expect(items).toContain('not as an increment on state 1');
    expect(cableSagPage.es.signs.items.join(' ')).not.toContain('que el estado 2 añade al estado 1');
  });

  it('the page says that an anchor feels the tension at the support, T, and not H', () => {
    expect(cableSagPage.en.method.paragraphs[0]).toContain('must resist T');
    expect(cableSagPage.es.method.paragraphs[0]).toContain('debe resistir T');
    expect(cableSagUi.en.known.notes.H).toContain('tension at the support');
  });

  it('the two languages agree on the words: “tenso” for taut, “tramos” for the segments, “sube, o baja” for the lowest point outside', () => {
    const es = JSON.stringify(cableSagPage.es);
    expect(es).not.toContain('tirante');
    expect(cableSagPage.es.limits.items.join(' ')).toContain('cargas sobre los tramos');
    expect(cableSagUi.es.results.shape.lowestOutside).toContain('sube, o baja');
    expect(cableSagUi.en.results.shape.lowestOutside).toContain('rises, or falls');
  });

  it('the state-equation paragraph says what its q is', () => {
    expect(cableSagPage.en.method.paragraphs.join(' ')).toContain('the whole load per unit of horizontal length (the cable’s weight included, that is q + w)');
  });
});

describe('C10: every result has its unit, and the angles say which support', () => {
  it('the vertical forces carry their unit in every mode, and the angles of state 2 say A and B', () => {
    const state = plain(show('en', defaultCaseFor('state')));
    expect(state).toMatch(/Vertical force at A [\d.]+ kip (upward|downward)/);
    expect(state).toMatch(/Angle below horizontal [+−\d.]+° at A · [+−\d.]+° at B/);
    expect(plain(show('en', defaultCaseFor('points')))).toMatch(/Vertical force at A 20 kip upward/);
    expect(plain(show('en', defaultCaseFor('hanging')))).toMatch(/5 kip upward/);
  });

  it('the change column has four figures, as the others', () => {
    const html = show('en', defaultCaseFor('state'));
    expect(html).not.toMatch(/<td[^>]*>[^<]*\+0\.0\d{5,}[^<]*<\/td>/);
  });
});

describe('C3: junk and empty text in a number field are said at once, alike', () => {
  it('a text that is not a number and an empty field are both refused; a number, a number with a comma meaning decimal, and a text that reads two ways are not', () => {
    expect(refusedText('abc', ',', false)).toBe('abc');
    expect(refusedText('5e', ',', false)).toBe('5e');
    expect(refusedText('', ',', false)).toBe('');
    expect(refusedText('  ', ',', false)).toBe('  ');
    expect(refusedText('12', ',', false)).toBeNull();
    expect(refusedText('1.5', ',', false)).toBeNull();
    expect(refusedText('-3', ',', false)).toBeNull();
    expect(refusedText('', ',', true)).toBeNull();
    // “1,250” reads two ways: the shared field has a line for that
    expect(refusedText('1,250', '', false)).toBeNull();
  });

  it('every number field of the form is wrapped, and none is the bare shared one', () => {
    const html = show('en', defaultCaseFor('state'));
    const fields = (html.match(/<input class="mp-num__input"/g) ?? []).length;
    const wrapped = (html.match(/<span class="mp-cs__f">/g) ?? []).length;
    expect(fields).toBeGreaterThan(10);
    expect(wrapped).toBe(fields);
  });
});

describe('C1 and B8: a chart draws itself at the width of the box it stands in', () => {
  it('draws at the width it is given until it has measured (the server’s, and paper’s), and the layout follows the width to the pixel', () => {
    const points = [0, 1, 2, 3].map((x) => ({ x, y: x * 2, current: false }));
    for (const width of [337, 664, 699, 722]) {
      const l = chartLayout(points, { width, height: 200, group: ',' });
      expect(l.width).toBe(width);
      expect(l.plot.x1).toBe(width - 14);
    }
    const html = renderToStaticMarkup(h(SweepChart, { points, width: 337, group: ',', title: 't', xTitle: 'x', yTitle: 'y', about: 'a', measure: true }));
    expect(html).toContain('viewBox="0 0 337 200"');
    expect(html).toContain('width="337"');
  });
});

describe('B9: the printed sheet names the calculation', () => {
  it('the mode’s tabs are not hidden on paper (the shell prints the chosen one as words), and the example button is', () => {
    // read by the stylesheet's rules
    const css = readFileSync(join(__dirname, 'cable-sag.css'), 'utf8').replace(/\r\n/g, '\n');
    const print = css.slice(css.indexOf('@media print'));
    expect(print).not.toMatch(/\.mp-cs__modes\s*,/);
    expect(print).toContain('.mp-cs .mp-cs__example');
  });
});
