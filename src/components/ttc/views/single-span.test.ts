import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { createElement as h } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { UNITS, analyse, decodeBeam, encodeBeam, sectionProps, type BeamForm, type SteelShape } from '@/lib/calc/beam/model';
import { solveBeam, type BeamModel } from '@/lib/calc/beam/solver';
import { DEFAULT_LIMIT, SPAN_KEY, byLoad, defaultSpan, sizing } from '@/lib/calc/beam/span';
import { spanPage } from '@/lib/calc/beam/span-page-strings';
import { spanUi } from '@/lib/calc/beam/span-strings';
import { beamStrings } from '@/lib/calc/beam/strings';
import { calculatorFamilies } from '@/lib/ttc/calculators';
import { getContent, navLabelOf } from '@/lib/ttc/content';
import { localePath, type Lang } from '@/lib/ttc/i18n';
import { DESCRIPTION_LIMIT_PX, TITLE_BUDGET_PX, descriptionPx, repeatedWords, titlePx, unmeasured } from '@/lib/ttc/serp';
import { absoluteUrl } from '@/lib/ttc/site';
import { addressNow } from '@/components/ttc/mp/lang';
import { SiteChrome } from '@/components/ttc/mp/SiteChrome';
import { BEAM_PATH } from './BeamCalculatorView';
import { CalculatorPage, type CalculatorText } from './CalculatorPage';
import { pageMeta } from './meta';
import { SPAN_PATH, SingleSpanView } from './SingleSpanView';

/**
 * THE SINGLE-SPAN BEAM'S PAGE: /resources/single-span-beam and its /es twin.
 *
 * The second calculator is the first one's component in another mode, on
 * the page every calculator shares (CalculatorPage). What can go wrong is
 * therefore not arithmetic — that is tested where it lives (lib/calc/beam) —
 * but the page: a sentence of the first calculator's left in place, which a
 * search engine reads as one page twice; a legal line retyped and then
 * corrected in one place only; an H1 or a title the owner's on-page check
 * reports; a closed form printed wrong on a page engineers check the tool
 * against. These hold the page to what it says it is, in both languages.
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
/** The page as the layout serves it: header, footer and all. */
const render = (lang: Lang) => {
  route.pathname = localePath(SPAN_PATH, lang);
  return renderToStaticMarkup(h(SiteChrome, null, h(SingleSpanView, { lang })));
};
const mainOf = (html: string) => html.match(/<main\b[\s\S]*<\/main>/)?.[0] ?? '';
/** A calculator's page WITHOUT its tool: the words that are the page's own. */
const around = (lang: Lang, path: string, page: CalculatorText) => {
  route.pathname = localePath(path, lang);
  // The line of the tool's frame is the form's (`linkOpening`), not the page's: left empty here.
  return renderToStaticMarkup(h(CalculatorPage, { lang, path, page, opening: '', children: null }));
};

/* The cards of numbers, read as a visitor reads them (see beam-calculator.test.ts). */
const cardsOf = (html: string) => html.split(/<div class="mp-app__card(?: [^"]*)?">/).slice(1);
const cardOf = (html: string, title: string) => cardsOf(html).find((card) => new RegExp(`<h3\\b[^>]*>${esc(title).replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}</h3>`).test(card)) ?? '';
const rowsOf = (card: string) => [...(card.match(/<tbody\b[^>]*>[\s\S]*?<\/tbody>/)?.[0] ?? '').matchAll(/<tr\b[^>]*>([\s\S]*?)<\/tr>/g)].map((r) => [...r[1].matchAll(/<t[hd][^>]*>([\s\S]*?)<\/t[hd]>/g)].map((c) => text(c[1])));
const pairsOf = (card: string) => [...card.matchAll(/<dt>([\s\S]*?)<\/dt><dd>([\s\S]*?)<\/dd>/g)].map((m) => [text(m[1]), text(m[2])]);

/** Every string of a nested object, with the path to it. */
function leaves(value: unknown, path = ''): [string, string][] {
  if (typeof value === 'string') return [[path, value]];
  if (Array.isArray(value)) return value.flatMap((v, i) => leaves(v, `${path}[${i}]`));
  if (value && typeof value === 'object') return Object.entries(value).flatMap(([k, v]) => leaves(v, path ? `${path}.${k}` : k));
  return [];
}

/* Words as a reader sees them — no capitals, no punctuation — and every run
   of six of them. Six is where a phrase stops being the language's and
   starts being a sentence's: "the moment of inertia" is anybody's, "is
   exact along the whole beam, not" is one page's. */
const wordsOf = (t: string) => t.toLowerCase().replace(/[^\p{L}\p{N}\s]/gu, ' ').split(/\s+/).filter(Boolean);
const runsOf = (t: string) => {
  const w = wordsOf(t);
  return w.length < 6 ? [] : w.slice(0, w.length - 5).map((_, i) => w.slice(i, i + 6).join(' '));
};
const sharedRuns = (ours: string[], theirs: string[]) => {
  const known = new Set(theirs.flatMap(runsOf));
  return [...new Set(ours.flatMap(runsOf).filter((run) => known.has(run)))];
};

/** The legal words, which are the first calculator's by design: said once, and so said the same. */
const LEGAL = /^(disclaimer\.|sheet\.)/;
/** This calculator's row of the catalogue. */
const ROW = calculatorFamilies.flatMap((f) => f.items).filter((x) => x.href === SPAN_PATH);

describe('single-span beam: the words of its page', () => {
  const en = leaves(spanPage.en);
  const es = leaves(spanPage.es);

  it('says the same things in both languages, and leaves nothing blank', () => {
    expect(es.map(([p]) => p)).toEqual(en.map(([p]) => p));
    for (const [path, s] of [...en, ...es]) expect(s.trim().length, path).toBeGreaterThan(0);
    // The same things as the first calculator's page says of itself, part for part: one view prints both.
    const parts = (page: CalculatorText) => leaves(page).map(([p]) => p.replace(/\[\d+\]/g, '[]'));
    expect([...new Set(parts(spanPage.en))]).toEqual([...new Set(parts(beamStrings.en.page))]);
  });

  it('the Spanish is Spanish: no sentence is the English one left in place', () => {
    const same = en.filter(([, s], i) => s === es[i][1] && s.split(/\s+/).length > 3).map(([path]) => path);
    expect(same).toEqual([]);
    // …and it writes no number with a grouping comma, which its reader takes for the decimal.
    for (const [path, s] of es) expect(s, path).not.toMatch(/\d,\d{3}(?!\d)/);
  });

  it('names no other company’s product, no price, no date', () => {
    for (const [path, s] of [...en, ...es]) {
      expect(s, path).not.toMatch(/skyciv|quick design|clearcalcs|enercalc|tedds/i);
      expect(s, path).not.toMatch(/\bfree\b|\bgratis\b|\bgratuit|\$|\bprice\b|\bprecio\b|\b20\d\d\b/i);
      // The firm's name is written with "and".
      expect(s, path).not.toMatch(/Civil\s*&\s*Structural/i);
    }
  });

  // A disclaimer typed twice is corrected once. The page takes the first
  // calculator's — the very object — and so cannot differ from it by a word.
  it('the legal words are the first calculator’s own, not a copy of them', () => {
    for (const lang of LANGS) {
      const ours = spanPage[lang];
      const first = beamStrings[lang].page;
      expect(ours.disclaimer).toBe(first.disclaimer);
      expect(ours.sheet.kind).toBe(first.sheet.kind);
      expect(ours.sheet.margin).toBe(first.sheet.margin);
      // The source says so too: nothing of them is typed in this page's file.
      const code = readFileSync(join(SRC, 'lib/calc/beam/span-page-strings.ts'), 'utf8');
      expect(code).toContain(`disclaimer: beamStrings.${lang}.page.disclaimer,`);
      expect(code).toContain(`kind: beamStrings.${lang}.page.sheet.kind,`);
      expect(code).toContain(`margin: beamStrings.${lang}.page.sheet.margin,`);
    }
  });

  it('the credit of the printed sheet names this calculator, the firm and the address', () => {
    for (const lang of LANGS) {
      const credit = spanPage[lang].sheet.credit;
      for (const key of ['{firm}', '{address}']) expect(credit, `${lang} ${key}`).toContain(key);
      expect(credit).not.toBe(beamStrings[lang].page.sheet.credit);
      expect(credit).toMatch(lang === 'en' ? /single-span beam calculator/ : /calculadora de viga de un solo vano/);
    }
  });

  // Two pages that say one thing in the same words are, to a search engine,
  // one page twice. Everything this page says of itself is compared with
  // everything the first calculator's page says — its hero, its notes, its
  // title and description, and the form's own lines — six words at a time.
  it('no sentence of the first calculator’s page is said again here, beyond the legal words', () => {
    for (const lang of LANGS) {
      const ours = leaves(spanPage[lang]).filter(([path]) => !LEGAL.test(path));
      const first = [...leaves(beamStrings[lang].page), ...leaves(beamStrings[lang].ui)].map(([, s]) => s);
      for (const [path, s] of ours) expect(sharedRuns([s], first), `${lang} ${path}`).toEqual([]);
      // What the single-span mode adds to the form is new as well: none of it is the first page's notes.
      const added = leaves(spanUi[lang]);
      for (const [path, s] of added) expect(sharedRuns([s], leaves(beamStrings[lang].page).map(([, t]) => t)), `${lang} span.${path}`).toEqual([]);
      // The comparison can fail: the legal words, which ARE shared, are found by it.
      expect(sharedRuns([spanPage[lang].disclaimer.body], first).length).toBeGreaterThan(20);
    }
  });

  // The page and the tool are written in two files. Where the notes point at
  // a card, they call it what the card is called.
  it('the notes call the two new cards what the tool calls them', () => {
    for (const lang of LANGS) {
      const s = spanPage[lang];
      const t = spanUi[lang];
      expect(s.facts.at(-1)!.k).toBe(t.sizing.title);
      expect(s.method.paragraphs[2]).toContain(t.sizing.title);
      expect(s.method.paragraphs[1].toLowerCase()).toContain(t.loads.title.toLowerCase());
      expect(s.signs.items.join(' ').toLowerCase()).toContain(t.loads.title.toLowerCase().replace(/ /g, lang === 'en' ? '-' : ' '));
    }
  });
});

describe('single-span beam: the closed forms it gives to check it by', () => {
  /** A span on a pin and a roller, as the page fixes it, solved by the engine. */
  const solve = (L: number, loads: Partial<BeamModel>) => {
    const out = solveBeam({ L, supports: [{ x: 0, kind: 'pin' }, { x: L, kind: 'roller' }], ...loads });
    if (!out.ok) throw new Error('the span was not solved');
    return out;
  };
  const L = 24;
  const w = 0.8;
  const P = 6;
  const a = 8;
  const b = L - a;

  // Each formula the page prints, written out as arithmetic, and what it
  // comes to for these numbers by hand: the engine's answer for the same span
  // is held to both. The last test of the group finds every one of them on
  // the page, spelled as it is in the titles of these three.
  it('a uniform load: wL/2, wL²/8 and 5wL⁴/(384EI) at midspan', () => {
    const out = solve(L, { dists: [{ x1: 0, x2: L, w1: w, w2: w }] });
    const [left, right] = out.reactions.map((r) => r.Rv);
    expect([left, right]).toEqual([expect.closeTo((w * L) / 2, 9), expect.closeTo((w * L) / 2, 9)]);
    // 0.8 × 24 ÷ 2 = 9.6 kip on each support.
    expect([left, right]).toEqual([expect.closeTo(9.6, 9), expect.closeTo(9.6, 9)]);
    expect(out.extremes.Mmax.value).toBeCloseTo((w * L ** 2) / 8, 9);
    // 0.8 × 24² ÷ 8 = 57.6 kip·ft.
    expect(out.extremes.Mmax.value).toBeCloseTo(57.6, 9);
    expect(out.extremes.Mmax.x).toBeCloseTo(L / 2, 6);
    // EI·v, downward: 5 × 0.8 × 24⁴ ÷ 384 = 3,456 kip·ft³.
    expect(out.extremes.EIvMin.value).toBeCloseTo((-5 * w * L ** 4) / 384, 6);
    expect(out.extremes.EIvMin.value).toBeCloseTo(-3456, 6);
    expect(out.extremes.EIvMin.x).toBeCloseTo(L / 2, 6);
  });

  it('a point load: Pb/L and Pa/L, and Pab/L under it', () => {
    const out = solve(L, { points: [{ x: a, P }] });
    const [left, right] = out.reactions.map((r) => r.Rv);
    expect([left, right]).toEqual([expect.closeTo((P * b) / L, 9), expect.closeTo((P * a) / L, 9)]);
    // 6 × 16 ÷ 24 = 4 kip on the left, 6 × 8 ÷ 24 = 2 kip on the right.
    expect([left, right]).toEqual([expect.closeTo(4, 9), expect.closeTo(2, 9)]);
    expect(out.extremes.Mmax.value).toBeCloseTo((P * a * b) / L, 9);
    // 6 × 8 × 16 ÷ 24 = 32 kip·ft.
    expect(out.extremes.Mmax.value).toBeCloseTo(32, 9);
    expect(out.extremes.Mmax.x).toBeCloseTo(a, 9);
  });

  it('a load rising from zero to w: wL/6 and wL/3, and wL²/(9√3) at L/√3', () => {
    const out = solve(L, { dists: [{ x1: 0, x2: L, w1: 0, w2: w }] });
    const [left, right] = out.reactions.map((r) => r.Rv);
    expect([left, right]).toEqual([expect.closeTo((w * L) / 6, 9), expect.closeTo((w * L) / 3, 9)]);
    // 0.8 × 24 ÷ 6 = 3.2 kip under the low end, 0.8 × 24 ÷ 3 = 6.4 kip under the high one.
    expect([left, right]).toEqual([expect.closeTo(3.2, 9), expect.closeTo(6.4, 9)]);
    expect(out.extremes.Mmax.value).toBeCloseTo((w * L ** 2) / (9 * Math.sqrt(3)), 9);
    // 0.8 × 24² ÷ (9 × 1.7321) = 29.5603 kip·ft.
    expect(out.extremes.Mmax.value).toBeCloseTo(29.5603, 4);
    expect(out.extremes.Mmax.x).toBeCloseTo(L / Math.sqrt(3), 6);
  });

  // The example the page opens on is the first two cases added together:
  // 9.6 + 4 = 13.6 kip on the left, 9.6 + 2 = 11.6 kip on the right.
  it('…and the example beam is the first two together: 13.6 and 11.6 kip', () => {
    const form = defaultSpan();
    expect([form.L, form.points.map((p) => [p.x, p.P]), form.dists.map((d) => [d.x1, d.x2, d.w1, d.w2])]).toEqual([L, [[a, P]], [[0, L, w, w]]]);
    const out = solve(L, { points: [{ x: a, P }], dists: [{ x1: 0, x2: L, w1: w, w2: w }] });
    expect(out.reactions.map((r) => r.Rv)).toEqual([expect.closeTo(13.6, 9), expect.closeTo(11.6, 9)]);
    // The shear crosses zero at 13.6 − 6 − 0.8x = 0, x = 9.5 ft; M = 13.6 × 9.5 − 0.4 × 9.5² − 6 × 1.5 = 84.1 kip·ft.
    expect(out.extremes.Mmax.x).toBeCloseTo(9.5, 6);
    expect(out.extremes.Mmax.value).toBeCloseTo(84.1, 9);
  });

  it('every one of them is on the page, as an engineer writes it, in both languages', () => {
    // A denominator of more than one factor is in parentheses, in the first case as in the third.
    const FORMS = ['wL/2', 'wL²/8', '5wL⁴/(384EI)', 'Pb/L', 'Pa/L', 'Pab/L', 'wL/6', 'wL/3', 'wL²/(9√3)', 'L/√3'];
    for (const lang of LANGS) {
      const said = spanPage[lang].method.paragraphs.join(' ');
      for (const form of FORMS) expect(said, `${lang} ${form}`).toContain(form);
      // Each case is a paragraph of its own: read at a glance, not dug out of a sentence.
      const cases = spanPage[lang].method.paragraphs.slice(-3);
      expect(cases.map((p) => FORMS.filter((form) => p.includes(form)))).toEqual([['wL/2', 'wL²/8', '5wL⁴/(384EI)'], ['Pb/L', 'Pa/L', 'Pab/L'], ['wL/6', 'wL/3', 'wL²/(9√3)', 'L/√3']]);
      for (const p of cases) expect(p.length, p).toBeLessThan(170);
    }
  });

  // A formula found somewhere in its paragraph says nothing of the support it
  // belongs to, and the engine above gives the left reaction first: 4 and 2
  // kip for the point load, 3.2 and 6.4 for the rising one. The page names
  // them in that order, measured from the same end, in both languages.
  it('each pair of reactions is said left first, and each place from the left support', () => {
    for (const lang of LANGS) {
      const cases = spanPage[lang].method.paragraphs.slice(-3);
      expect(cases[1], lang).toMatch(lang === 'en' ? /P at a from the left support and b from the right: reactions Pb\/L and Pa\/L;/ : /P a una distancia a del apoyo izquierdo y b del derecho: reacciones Pb\/L y Pa\/L;/);
      expect(cases[2], lang).toMatch(lang === 'en' ? /from zero at the left support to w at the right: reactions wL\/6 and wL\/3;/ : /de cero en el apoyo izquierdo a w en el derecho: reacciones wL\/6 y wL\/3;/);
      expect(cases[2], lang).toContain(`wL²/(9√3), ${lang === 'en' ? 'at L/√3 from the left' : 'a L/√3 del apoyo izquierdo'}`);
    }
  });
});

describe('single-span beam: what the notes say of the tool, the tool does', () => {
  const form = (over: Partial<BeamForm> = {}): BeamForm => ({ ...defaultSpan(), ...over });
  const section = (over: Partial<BeamForm['section']>): BeamForm['section'] => ({ ...defaultSpan().section, ...over });
  // The example beam by hand: the largest moment is 84.1 kip·ft at 9.5 ft (above).
  // Its largest EI·v is the engine's; what the notes describe is what is done with it.
  const solved = analyse(form());
  const EIv = Math.abs(solved.solution!.extremes.EIvMin.value);

  // "Deflection is proportional to 1 ÷ EI, so the moment of inertia that holds
  // the largest deflection to L/n comes from one solution and the modulus E,
  // whether or not an I was entered."
  it('the moment of inertia needed: EI·v × n ÷ L ÷ E, with no I entered', () => {
    // E·I in kip·ft² is E (ksi) × I (in⁴) ÷ 144: I = EI·v × 360 ÷ 24 ft ÷ (29,000 ÷ 144).
    const byHand = (EIv * DEFAULT_LIMIT) / 24 / (29000 / 144);
    expect(byHand).toBeCloseTo(367.4, 1);
    expect(sizing(solved, form(), DEFAULT_LIMIT, 0).I).toBeCloseTo(byHand, 9);
    const bare = form({ section: section({ I: 0, S: 0, Av: 0 }) });
    expect(sizing(analyse(bare), bare, DEFAULT_LIMIT, 0).I).toBeCloseTo(byHand, 9);
    // Twice as strict a limit asks for twice the inertia; without E there is nothing to give.
    expect(sizing(solved, form(), 2 * DEFAULT_LIMIT, 0).I).toBeCloseTo(2 * byHand, 9);
    const noE = form({ section: section({ material: 'custom', E: 0 }) });
    expect(sizing(analyse(noE), noE, DEFAULT_LIMIT, 0).I).toBeNull();
  });

  // "The section modulus is the largest moment divided by the bending stress you type."
  it('the section modulus needed: the largest moment over the stress typed, and nothing when none is', () => {
    // 84.1 kip·ft × 12 in/ft ÷ 24 ksi = 42.05 in³.
    expect(sizing(solved, form(), DEFAULT_LIMIT, 24).S).toBeCloseTo(42.05, 9);
    expect(sizing(solved, form(), DEFAULT_LIMIT, 0).S).toBeNull();
  });

  // "L/n is the deflection allowed, the span over n: n = 360 on 24 ft is 0.8 in."
  it('the example the notes give for L/n is the page’s own: its span, the limit it opens with', () => {
    expect(DEFAULT_LIMIT).toBe(360);
    expect((form().L * 12) / DEFAULT_LIMIT).toBeCloseTo(0.8, 12);
    expect(spanPage.en.signs.items.filter((x) => x.includes(`n = ${DEFAULT_LIMIT} on ${form().L} ft is 0.8 in`))).toHaveLength(1);
    expect(spanPage.es.signs.items.filter((x) => x.includes(`n = ${DEFAULT_LIMIT} en ${form().L} ft son 0.8 in`))).toHaveLength(1);
  });

  // "E and stresses in ksi or MPa; I in in⁴ or 10⁶ mm⁴, S in in³ or 10³ mm³."
  // The powers of ten are part of the unit: a note that left them out would
  // be a million, or a thousand, away from the value it stands under.
  it('the units the notes name are the tool’s own, in both systems', () => {
    for (const lang of LANGS) {
      const line = spanPage[lang].signs.items.at(-1)!;
      const or = lang === 'en' ? 'or' : 'o';
      for (const k of ['stress', 'I', 'S'] as const) expect(line, `${lang} ${k}`).toContain(`${UNITS.us[k]} ${or} ${UNITS.si[k]}`);
    }
  });

  // "Each load is placed on the span by itself and solved again … So the rows
  // add up to the totals", and "an upward load subtracts".
  it('load by load: each row is that load alone, the rows add to the whole beam, and an upward load subtracts', () => {
    const table = byLoad(form(), null, 9.5, 12)!;
    // 6 kip at 8 ft alone: 4 and 2 kip, and 4 × 9.5 − 6 × 1.5 = 29 kip·ft at 9.5 ft. 0.8 kip/ft alone: 9.6 and 9.6, and 9.6 × 9.5 − 0.4 × 9.5² = 55.1.
    expect(table.rows.map((r) => [r.list, r.left, r.right, r.M].map((v) => (typeof v === 'number' ? Number(v.toFixed(9)) : v)))).toEqual([['points', 4, 2, 29], ['dists', 9.6, 9.6, 55.1]]);
    expect([table.sum.left, table.sum.right, table.sum.M].map((v) => Number(v.toFixed(9)))).toEqual([13.6, 11.6, 84.1]);
    const lifted = byLoad(form({ points: [{ id: 3, x: 8, P: 6, dir: 'up' }] }), null, 9.5, 12)!;
    expect([lifted.rows[0].left, lifted.rows[0].right, lifted.rows[0].M].map((v) => Number(v.toFixed(9)))).toEqual([-4, -2, -29]);
    expect(Number(lifted.sum.left.toFixed(9))).toBe(5.6);
  });

  // "Own weight counts only for a steel shape with its box ticked, and is that shape's."
  it('own weight is a load only for a steel shape with its box ticked — the shape’s own, 40 lb/ft for a W16×40', () => {
    const W16X40: SteelShape = { designation: 'W16X40', family: 'W', weight: 40, A: 11.8, d: 16, tw: 0.305, Ix: 518, Sx: 64.7 };
    expect(sectionProps(form()).selfWeight).toBe(0);
    expect(sectionProps(form({ section: section({ mode: 'rect' }) })).selfWeight).toBe(0);
    expect(sectionProps(form({ section: section({ mode: 'shape', selfWeight: false }) }), W16X40).selfWeight).toBe(0);
    const weighed = form({ section: section({ mode: 'shape', selfWeight: true }) });
    expect(sectionProps(weighed, W16X40).selfWeight).toBeCloseTo(0.04, 12);
    // …and it is a row of the table: 0.04 kip/ft × 24 ft ÷ 2 = 0.48 kip on each support.
    const own = byLoad(weighed, W16X40, 9.5, 12)!.rows.filter((r) => r.list === 'own');
    expect(own.map((r) => [Number(r.left.toFixed(9)), Number(r.right.toFixed(9))])).toEqual([[0.48, 0.48]]);
  });
});

describe('single-span beam: what a search result shows', () => {
  // The rules of views/seo.test.ts, which reads every page of the sitemap.
  // Held here as well, so that this page's own test says what is wrong with
  // its own words.
  const words = (s: string) => (s.match(/[A-Za-zÁÉÍÓÚÜÑáéíóúüñ]{4,}/g) ?? []).map((w) => w.toLowerCase());
  const letters = (s: string) => s.toLowerCase().replace(/[^a-z0-9áéíóúüñ]/g, '');
  /* The shortest H1 the owner's on-page check let pass (seo.test.ts, H1_MIN). */
  const H1_MIN = 22;

  for (const lang of LANGS) {
    const s = spanPage[lang];
    const meta = pageMeta(lang, SPAN_PATH, { title: s.title, description: s.description });
    const title = (meta.title as { absolute: string }).absolute;

    it(`${lang}: the title fits a search result (${titlePx(title)} px of ${TITLE_BUDGET_PX}), and repeats no word`, () => {
      expect(unmeasured(title)).toEqual([]);
      expect(titlePx(title)).toBeLessThanOrEqual(TITLE_BUDGET_PX);
      expect(repeatedWords(title)).toEqual([]);
      // What the page is called comes first and whole: the brand follows only where it fits.
      expect(title.startsWith(s.title)).toBe(true);
    });

    it(`${lang}: the description fits one (${descriptionPx(s.description)} px of ${DESCRIPTION_LIMIT_PX})`, () => {
      expect(unmeasured(s.description)).toEqual([]);
      expect(descriptionPx(s.description)).toBeLessThanOrEqual(DESCRIPTION_LIMIT_PX);
      expect(meta.description).toBe(s.description);
    });

    it(`${lang}: neither is the first calculator’s, nor its own line in the catalogue`, () => {
      const first = beamStrings[lang].page;
      expect(s.title).not.toBe(first.title);
      expect(sharedRuns([s.title, s.description], [first.title, first.description, ROW[0].does[lang]])).toEqual([]);
    });

    it(`${lang}: the page declares its own address, with its twin, and may be indexed`, () => {
      expect(meta.alternates?.canonical).toBe(localePath(SPAN_PATH, lang));
      expect(meta.alternates?.languages).toEqual({ en: SPAN_PATH, es: `/es${SPAN_PATH}`, 'x-default': SPAN_PATH });
      expect(meta.robots).toBeUndefined();
    });

    it(`${lang}: one H1, long enough to say what the page is, in words the page uses — ${s.h1}`, () => {
      // As its route renders it: no header, no footer to lend it a word.
      route.pathname = localePath(SPAN_PATH, lang);
      const html = renderToStaticMarkup(h(SingleSpanView, { lang }));
      const h1s = html.match(/<h1\b[\s\S]*?<\/h1>/g) ?? [];
      expect(h1s.map((x) => text(x))).toEqual([s.h1]);
      expect(s.h1.length).toBeGreaterThanOrEqual(H1_MIN);
      const body = new Set(words(text(html.replace(/<h1\b[\s\S]*?<\/h1>/g, ' '))));
      expect(words(s.h1).filter((w) => !body.has(w))).toEqual([]);
      // …and not only in the breadcrumb and the letterhead, which repeat it whole.
      const notes = new Set(words([s.sub, ...s.method.paragraphs, ...s.assumes.items].join(' ')));
      expect(words(s.h1).filter((w) => !notes.has(w))).toEqual([]);
    });

    it(`${lang}: the H1 is not the title over again, and begins with the name the catalogue gives it`, () => {
      expect(letters(s.h1)).not.toBe(letters(s.title));
      expect(ROW).toHaveLength(1);
      expect(s.h1.startsWith(ROW[0].name[lang])).toBe(true);
    });
  }
});

describe('single-span beam: the page', () => {
  for (const lang of LANGS) {
    const html = render(lang);
    const main = mainOf(html);
    const s = spanPage[lang];
    const ui = beamStrings[lang].ui;
    const t = spanUi[lang];
    const c = getContent(lang);

    it(`${lang}: one h1; the tool and the method are its two h2; the tables and the notes are h3`, () => {
      const heads = (n: number) => [...main.matchAll(new RegExp(`<h${n}\\b[^>]*>([\\s\\S]*?)</h${n}>`, 'g'))].map((m) => text(m[1]));
      expect(heads(1)).toEqual([s.h1]);
      expect(heads(2)).toEqual([s.toolHeading, s.method.title]);
      const h3 = heads(3);
      // The notes close the page, in this order; before them, the tool's tables.
      expect(h3.slice(-4)).toEqual([s.assumes.title, s.limits.title, s.signs.title, s.disclaimer.title]);
      const tables = h3.slice(0, -4);
      // The first calculator's four, and the two that make this a page of its own.
      expect([...tables].sort()).toEqual([ui.results.reactions, ui.results.maxima, ui.results.spans, ui.results.point, t.loads.title, t.sizing.title].sort());
      expect(main).not.toMatch(/<h[456]\b/);
    });

    // 0.8 kip/ft over 24 ft puts 9.6 kip on each support, and 6 kip at 8 ft
    // puts 6 × 16 ÷ 24 = 4 kip on the left and 2 on the right: 13.6 and 11.6.
    // The shear crosses zero at 9.5 ft, where M = 84.1 kip·ft.
    it(`${lang}: the server sends the example span solved — 13.6 and 11.6 kip — and not an empty box`, () => {
      const up = ui.results.upward;
      const reactions = cardOf(main, ui.results.reactions);
      expect(rowsOf(reactions).map((r) => r.slice(0, 3))).toEqual([[ui.supports.kinds.pin, '0', `13.6 ${up}`], [ui.supports.kinds.roller, '24', `11.6 ${up}`]]);
      expect(text(reactions)).toContain(`${ui.results.equilibrium} 25.2 = 25.2 kip.`);
      const maxima = pairsOf(cardOf(main, ui.results.maxima));
      expect(maxima.find(([k]) => k === ui.results.maxSagging)).toEqual([ui.results.maxSagging, `84.1 kip·ft ${ui.results.at} x = 9.5 ft`]);
      // No problem is announced for the example.
      expect(main).toMatch(/<div class="mp-app__issues" role="alert" aria-live="assertive"><\/div>/);
    });

    // The page every calculator shares names its tool's section after the
    // address: this one's heading is "single-span-beam-tool", not the first
    // calculator's. A section labelled by an id that is not on the page has,
    // for a screen reader, no name at all.
    it(`${lang}: whatever labels or describes an element is on the page — the tool’s section by its own heading`, () => {
      const ids = new Set([...html.matchAll(/ id="([^"]+)"/g)].map((m) => m[1]));
      const refs = [...html.matchAll(/ aria-(?:labelledby|describedby)="([^"]+)"/g)].flatMap((m) => m[1].split(/\s+/));
      expect(refs).toContain('single-span-beam-tool');
      expect(refs.filter((r) => !ids.has(r))).toEqual([]);
      expect(main).toMatch(/<section\b[^>]* aria-labelledby="single-span-beam-tool"/);
      expect(text(main.match(/<h2 id="single-span-beam-tool"[^>]*>([\s\S]*?)<\/h2>/)?.[1] ?? '')).toBe(s.toolHeading);
    });

    it(`${lang}: the tool is in its single-span mode — the supports are said, not chosen`, () => {
      expect(text(main)).toContain(t.simple);
      // No row of supports, hinges or applied moments to edit, and no list of layouts.
      const groups = [...main.matchAll(/<div class="mp-app__item" role="group" aria-label="([^"]*)"/g)].map((m) => m[1]);
      expect(groups).toEqual([`${ui.row.names.points} 1`, `${ui.row.names.dists} 1`]);
      for (const gone of [ui.supports.add, ui.hinges.add, ui.loads.addCouple, ui.toolbar.layoutPick]) expect(text(main), gone).not.toContain(gone);
      // The two cards this page exists for are there, with the example's numbers in them:
      // a row for each load and one for both, whose reactions are 4 + 9.6 and 2 + 9.6 kip…
      expect(rowsOf(cardOf(main, t.loads.title)).map((r) => r.slice(0, 3))).toEqual([[`${ui.row.names.points} 1`, '4', '2'], [`${ui.row.names.dists} 1`, '9.6', '9.6'], [t.loads.all, '13.6', '11.6']]);
      // …and the inertia that brings 0.5674 in to L/360 = 0.8 in: 518 × 0.5674 ÷ 0.8 = 367.4 in⁴.
      expect(pairsOf(cardOf(main, t.sizing.title)).find(([k]) => k === t.sizing.inertia)?.[1]).toMatch(/^367\.4 in⁴/);
    });

    // The row of the catalogue that opens this page says what it computes in
    // one line. That line is the catalogue's: said again here, a search
    // engine has two pages with the same sentence.
    it(`${lang}: its line in the catalogue is not printed here, nor six words running of it — nor the first calculator’s`, () => {
      expect(ROW).toHaveLength(1);
      const body = text(main);
      const rows = calculatorFamilies.flatMap((f) => f.items).filter((x) => x.href === SPAN_PATH || x.href === BEAM_PATH);
      expect(rows).toHaveLength(2);
      for (const row of rows) {
        expect(wordsOf(row.does[lang]).length, row.name.en).toBeGreaterThan(6);
        expect(body, row.name.en).not.toContain(row.does[lang]);
        expect(sharedRuns([row.does[lang]], [body]), row.name.en).toEqual([]);
      }
    });

    it(`${lang}: every field has a name, and no button submits anything`, () => {
      const controls = [...main.matchAll(/<(input|select)\b[^>]*>/g)].map((m) => m[0]);
      expect(controls.length).toBeGreaterThan(12);
      const labelled = [...main.matchAll(/<label\b[^>]*>([\s\S]*?)<\/label>/g)];
      expect(labelled.reduce((n, m) => n + (m[1].match(/<(input|select)\b/g) ?? []).length, 0)).toBe(controls.length);
      for (const m of labelled) expect(text(m[1].replace(/<select\b[\s\S]*?<\/select>/g, '')).length, m[0].slice(0, 80)).toBeGreaterThan(0);
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
      expect(list.itemListElement.map((i: { item: string }) => i.item)).toEqual(['/', '/resources', SPAN_PATH].map((p) => absoluteUrl(localePath(p, lang))));
      expect(list.itemListElement.map((i: { name: string }) => i.name)).toEqual([c.ui.home, navLabelOf(c, '/resources'), s.h1]);
    });

    it(`${lang}: says how it is solved, what it assumes, what it does not do — and on what terms`, () => {
      const body = text(main);
      for (const p of [s.eyebrow, s.sub, ...s.facts.flatMap((f) => [f.k, f.v]), s.toolHeading, s.method.label, s.method.title, ...s.method.paragraphs, ...s.assumes.items, ...s.limits.items, ...s.signs.items, s.disclaimer.title, s.disclaimer.body, s.back]) {
        expect(body, p.slice(0, 50)).toContain(text(esc(p)));
      }
      // The first paragraph of the method is its lead, as on the first calculator's page.
      expect(main).toContain(`<p class="mp-lead">${esc(s.method.paragraphs[0])}</p>`);
      expect(html).toContain(`<noscript><p class="mp-app__noscript">${esc(s.noscript)}</p></noscript>`);
      // The form's own promise is the first calculator's, and holds here: the same component prints it.
      expect(body).toContain(ui.results.privacy);
      // The line for a link still to be opened is NOT among the page's words as it is sent: an attribute of an empty
      // paragraph, which the stylesheet writes out only while the tool's frame is marked (calc/ToolFrame.tsx).
      expect(body).not.toContain(ui.linkOpening);
      expect(main).toContain(`<p class="mp-app__opening" data-line="${esc(ui.linkOpening)}"></p>`);
    });

    // "One span only" would be a dead end. The form's link opens the first
    // calculator on the beam that is on screen: the same loads, the same
    // section, on the pin and the roller it stands on here.
    it(`${lang}: leads back to the catalogue, and to the first calculator with this very beam — nowhere outside the site`, () => {
      const hrefs = [...main.matchAll(/<a\b[^>]*href="([^"]*)"/g)].map((m) => m[1]);
      expect(hrefs.filter((x) => x === localePath('/resources', lang)).length).toBe(2);
      expect(hrefs.filter((x) => /^https?:|^tel:|^mailto:/.test(x))).toEqual([]);
      const general = hrefs.filter((x) => x.split('#')[0] === localePath(BEAM_PATH, lang));
      expect(general).toHaveLength(1);
      const carried = general[0].split('#b=')[1] ?? '';
      const beam = decodeBeam(carried);
      expect(beam).not.toBeNull();
      expect(encodeBeam(beam!)).toBe(encodeBeam(defaultSpan()));
      expect(beam!.supports.map((x) => [x.kind, x.x])).toEqual([['pin', 0], ['roller', 24]]);
      // The notes say that the link is there, and do not name another way out.
      expect(s.limits.items.filter((x) => (lang === 'en' ? /the form links to the calculator that solves those/ : /el formulario enlaza con la calculadora que los resuelve/).test(x))).toHaveLength(1);
    });

    it(`${lang}: every image says what it is, and only the footer lockup is read out`, () => {
      const tags = [...html.matchAll(/<img\b[^>]*>/g)].map((m) => m[0]);
      // The header's two marks, the letterhead's lockup and the footer's.
      expect(tags.length).toBeGreaterThanOrEqual(4);
      for (const tag of tags) expect(attr(tag, 'alt')?.trim(), tag).toBeTruthy();
      expect(tags.filter((tag) => attr(tag, 'aria-hidden') !== 'true').map((tag) => attr(tag, 'src'))).toEqual([c.company.logo.lockupLightSm]);
    });

    it(`${lang}: no call bar lies over the form on a phone, and beside the disclaimer are the site's terms`, () => {
      expect(html).not.toContain('mp-bar');
      expect(main).toContain(`href="${localePath('/terms', lang)}"`);
      // The static page carries the plain twin: there is no address to read on the server.
      expect(html).toContain(`href="${localePath(SPAN_PATH, lang === 'en' ? 'es' : 'en')}"`);
    });
  }

  it('the two languages are the same page', () => {
    const shape = (lang: Lang) =>
      mainOf(render(lang))
        .replace(/>[^<]+</g, '><')
        .replace(/ (aria-label|title|placeholder|href|lang|d|points|x|y|x1|x2|y1|y2|cx|cy|width|height|text-anchor|viewBox)="[^"]*"/g, '')
        .match(/<\/?[a-z0-9]+/g)!
        .join('');
    expect(shape('es')).toBe(shape('en'));
  });
});

describe('single-span beam: one page for every calculator, with this one’s words', () => {
  const source = (rel: string) => readFileSync(join(SRC, rel), 'utf8');
  /** Text as it stands between two tags: one piece of the page. */
  const pieces = (html: string) =>
    [...html.replace(/<(script|style)\b[\s\S]*?<\/\1>/g, ' ').matchAll(/>([^<]+)</g)].map((m) => text(`<i>${m[1]}</i>`)).filter(Boolean);

  // Rendered, and without the tool: the hero, the notes, the terms. What a
  // crawler reads on both pages may be the legal words and nothing else.
  it('around the tool, the two pages share the legal words and no other sentence', () => {
    for (const lang of LANGS) {
      const c = getContent(lang);
      const ours = pieces(around(lang, SPAN_PATH, spanPage[lang]));
      const first = pieces(around(lang, BEAM_PATH, beamStrings[lang].page));
      expect(ours.length).toBeGreaterThan(30);
      const s = spanPage[lang];
      const address = `ttcivilstructural.com${localePath(SPAN_PATH, lang)}`;
      const legal = new Set([s.disclaimer.title, s.disclaimer.body, s.sheet.kind, s.sheet.credit.replace('{firm}', c.company.legalName).replace('{address}', address)]);
      // Each of them is on the page, so the exemption exempts something.
      for (const words of legal) expect(ours, words.slice(0, 40)).toContain(words);
      expect(sharedRuns(ours.filter((p) => !legal.has(p)), first)).toEqual([]);
    }
  });

  // The first calculator's view and this one are the same component with
  // other words: the same elements in the same order, however many
  // paragraphs and list items each has to say.
  it('around the tool, the two pages are built alike', () => {
    const frame = (html: string) =>
      (html.replace(/<(script|style)\b[\s\S]*?<\/\1>/g, '').match(/<\/?[a-z0-9]+/g) ?? [])
        .join('')
        .replace(/(<p<\/p)+/g, '<p</p')
        .replace(/(<li<\/li)+/g, '<li</li');
    for (const lang of LANGS) expect(frame(around(lang, SPAN_PATH, spanPage[lang]))).toBe(frame(around(lang, BEAM_PATH, beamStrings[lang].page)));
    // Neither view draws a page of its own: both hand their words to the shared one.
    for (const view of ['BeamCalculatorView.tsx', 'SingleSpanView.tsx']) {
      const code = source(`components/ttc/views/${view}`);
      expect(code, view).toContain("import { CalculatorPage } from './CalculatorPage';");
      expect(code, view).not.toMatch(/PageHero|JsonLd|mp-appnotes|mp-sheet|calc\.css/);
    }
    // The sheet of the calculators comes with the page that uses its classes.
    expect(source('components/ttc/views/CalculatorPage.tsx')).toContain("import '@/components/ttc/calc/calc.css';");
  });

  it('every class its markup uses is styled in the calculators’ sheet', () => {
    const own = source('components/ttc/calc/calc.css');
    const used = new Set<string>();
    for (const m of render('en').matchAll(/class="([^"]*)"/g)) {
      for (const cls of m[1].split(/\s+/)) if (/^mp-(app|appsec|appnotes|num|seg|plot|beam|sheet)(?![a-z0-9])/.test(cls)) used.add(cls);
    }
    expect(used.size).toBeGreaterThan(30);
    // Three name a thing without styling it (see beam-calculator.test.ts).
    const NAMES_ONLY = ['mp-beam', 'mp-beam__unit', 'mp-num--select'];
    expect([...used].filter((cls) => !NAMES_ONLY.includes(cls) && !new RegExp(`\\.${cls}(?![a-zA-Z0-9_-])`).test(own))).toEqual([]);
  });
});

describe('single-span beam: on paper it is a calculation sheet', () => {
  for (const lang of LANGS) {
    const c = getContent(lang);
    const s = spanPage[lang];
    const html = render(lang);
    const main = mainOf(html);
    const address = `ttcivilstructural.com${localePath(SPAN_PATH, lang)}`;

    it(`${lang}: a letterhead with the firm's own lockup, this calculator's name and what the sheet is`, () => {
      const head = html.match(/<div class="mp-sheet mp-sheet__head">[\s\S]*?<\/div><\/div>/)?.[0] ?? '';
      const img = head.match(/<img\b[^>]*>/)?.[0] ?? '';
      // The real file, a straight resize of the dark lockup: never a drawing of the logo.
      expect(attr(img, 'src')).toBe('/ttc/img/logo-horizontal@640.webp');
      expect(attr(img, 'alt')).toBe(c.company.legalName);
      expect(text(head)).toContain(s.sheet.kind);
      expect(text(head)).toContain(text(esc(s.h1)));
      expect(text(head)).toContain(address);
      // Not the first calculator's address: the sheet says which page made it.
      expect(text(head)).not.toContain(`ttcivilstructural.com${localePath(BEAM_PATH, lang)}`);
    });

    it(`${lang}: the disclaimer is on the page whole, with the credit of THIS calculator under it`, () => {
      expect(text(main)).toContain(text(esc(s.disclaimer.body)));
      expect(s.disclaimer.body).toContain(c.company.legalName);
      const credit = text(main.match(/<p class="mp-sheet mp-sheet__credit">([\s\S]*?)<\/p>/)?.[1] ?? '');
      expect(credit).toBe(s.sheet.credit.replace('{firm}', c.company.legalName).replace('{address}', address));
      expect(credit).toContain(c.company.legalName);
      expect(credit.endsWith(address)).toBe(true);
    });

    it(`${lang}: every page's margin names the firm and this calculator, and carries the short disclaimer`, () => {
      const style = html.match(/<style>(:root\{--mp-sheet-top:[\s\S]*?)<\/style>/)?.[1] ?? '';
      // Three CSS strings, and nothing in them that could end the element or the string.
      const values = [...style.matchAll(/--mp-sheet-(top|name|bottom):"([^"]*)"/g)].map((m) => [m[1], m[2].replace(/\\([0-9a-f]+) /g, (_, hex) => String.fromCodePoint(parseInt(hex, 16)))]);
      expect(Object.fromEntries(values)).toEqual({ top: c.company.legalName, name: s.h1, bottom: beamStrings[lang].page.sheet.margin });
      expect(style).not.toMatch(/<|>/);
      // Set once: a second block would be a second calculator's words on this sheet.
      expect(html.split('--mp-sheet-top:').length - 1).toBe(1);
    });
  }
});

describe('single-span beam: what its script carries', () => {
  // The same walk as beam-calculator.test.ts: everything the client component
  // imports goes to the browser.
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

  it('the mode’s arithmetic, and no file of words: not the form’s, not the mode’s, not this page’s', () => {
    const files = reach(join(SRC, 'components/ttc/calc/beam/BeamCalculator.tsx'));
    expect(files).toEqual(expect.arrayContaining(['lib/calc/beam/solver.ts', 'lib/calc/beam/model.ts', 'lib/calc/beam/span.ts']));
    // Each of the three holds both languages; the last one, the page's own paragraphs as well.
    for (const words of ['lib/calc/beam/strings.ts', 'lib/calc/beam/span-strings.ts', 'lib/calc/beam/span-page-strings.ts']) expect(files, words).not.toContain(words);
    expect(files.filter((f) => /^lib\/ttc\/(site|site\.es|content|calculators|cities|city-)/.test(f) || /^components\/ttc\/views\//.test(f))).toEqual([]);
  });

  it('the page’s words reach the view on the server, and nothing a browser runs', () => {
    // Who imports this page's text, by name: the view, the two routes — and tests.
    const importers: string[] = [];
    const walk = (dir: string) => {
      for (const entry of readdirSync(dir, { withFileTypes: true })) {
        const full = join(dir, entry.name);
        if (entry.isDirectory()) walk(full);
        else if (/\.tsx?$/.test(entry.name) && !/\.test\.ts$/.test(entry.name) && /span-page-strings['"]/.test(readFileSync(full, 'utf8'))) importers.push(full.slice(SRC.length + 1).replace(/\\/g, '/'));
      }
    };
    walk(SRC);
    expect(importers.sort()).toEqual(['app/(public)/(site)/resources/single-span-beam/page.tsx', 'app/(public-es)/(site)/es/resources/single-span-beam/page.tsx', 'components/ttc/views/SingleSpanView.tsx']);
    for (const f of importers) expect(readFileSync(join(SRC, f), 'utf8'), f).not.toMatch(/^['"]use client['"]/m);
    // It reads every source file: a second and a half alone, past the default five beside the rest of the suite.
  }, 30_000);
});

describe('the language link carries the case of any calculator', () => {
  afterEach(() => vi.unstubAllGlobals());
  /** What the header's link would carry for an address ending in `hash`. */
  const carried = (hash: string) => {
    vi.stubGlobal('window', { location: { hash, search: '' } });
    return addressNow().carried;
  };

  // The first calculator keeps its beam after `#b=`, this one its case after
  // `#s=`. Reading `#b=` alone, the switch to Spanish opened this page on its
  // example: the visitor's span was gone.
  it('a fragment that is #, one lower-case letter and = goes with the link, whole', () => {
    const beam = `#b=${encodeBeam(defaultSpan())}`;
    const span = `#${SPAN_KEY}=360~~${encodeBeam(defaultSpan())}`;
    for (const hash of [beam, span, '#s=240~24~x', '#z=']) expect(carried(hash), hash).toBe(hash);
    // This page's own key is of that shape: a key of two letters would be dropped.
    expect(`#${SPAN_KEY}=`).toMatch(/^#[a-z]=$/);
  });

  it('a place on the page is not carried: the twin page need not have it', () => {
    for (const hash of ['', '#', '#main', '#beams', '#s', '#b', '#=x', '#S=1', '#B=us;20', '#ab=1', '#1=2', '#-=3', '#mp-phero-title']) expect(carried(hash), hash).toBe('');
  });

  it('the query is read at the same instant', () => {
    vi.stubGlobal('window', { location: { hash: '#s=360~~x', search: '?gclid=TEST' } });
    expect(addressNow()).toEqual({ search: '?gclid=TEST', carried: '#s=360~~x' });
  });
});
