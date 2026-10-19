import { createElement as h } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { analyseSafely, stagesOf, type StiffnessAnalysis } from '@/lib/calc/stiffness/analysis';
import { convertStiffness, defaultStiffness, emptyStiffness, reduceStiffness, type StiffnessForm } from '@/lib/calc/stiffness/model';
import { stiffnessUi } from '@/lib/calc/stiffness/strings';
import { TEMPLATE_IDS, type TemplateId } from '@/lib/calc/stiffness/templates';
import type { Lang } from '@/lib/ttc/i18n';
import { PAPER_BANDS, Solution } from './Solution';
import { build, girder } from './fixtures.testlib';
import { OPEN_CARD, PRINT_BUDGET, PRINT_SKIPPED, SEED_CARDS, autoOpen, weightOf } from './solution-state';
import { stepWeight } from './steps';

vi.setConfig({ testTimeout: 120_000 });
afterEach(() => new Promise<void>((done) => setTimeout(done, 0)));

/**
 * THE WORKED SOLUTION AS THE SERVER SENDS IT: the outline, the cards, the way a long solution starts, the page on paper, a mechanism's partial
 * solution, a structure with nothing to work out - and the links between them, which must lead somewhere. What each press does to the cards is
 * stiffness-state.test.ts (the rules as functions); what a browser alone shows (a card drawn as it comes into view, the bar at the foot of a phone)
 * is in the report that goes with the calculator.
 *
 * The server draws the TABLES of the first few cards only: the others are open (their words are in the page) and keep the room their tables will
 * take, which the browser fills as each comes near the screen.
 */

const LANGS: Lang[] = ['en', 'es'];
const noise = /NaN|undefined|Infinity|\[object|(?:^|[\s>(=])-0(?![.\d])|−0(?![.\d])|\be[+-]\d|\{[a-zA-Z]+(\|[^}]*)?\}/;
const text = (html: string) =>
  html
    .replace(/<[^>]+>/g, ' ')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&')
    .replace(/&#x27;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/\s+/g, ' ')
    .trim();
const tpl = (id: TemplateId, units: 'us' | 'si' = 'us') => reduceStiffness(emptyStiffness(units), { type: 'template', template: id });

function view(form: StiffnessForm, o: { lang?: Lang; onPaper?: boolean; busy?: boolean; analysis?: StiffnessAnalysis; group?: string } = {}): string {
  const a = o.analysis ?? analyseSafely(form);
  const lang = o.lang ?? 'en';
  return renderToStaticMarkup(h(Solution, { w: stiffnessUi[lang], analysis: a, group: o.group ?? (lang === 'es' ? ' ' : ','), onPaper: o.onPaper ?? false, busy: o.busy ?? false, id: 'steps', epoch: 0 }));
}
const heads = (html: string) => [...html.matchAll(/<h3 class="mp-st__cardhead"[^>]*><button[^>]*aria-expanded="(true|false)"/g)].map((m) => m[1] === 'true');
const ids = (html: string) => [...html.matchAll(/ id="([^"]+)"/g)].map((m) => m[1]);
const cardsOf = (html: string) => html.split('<div class="mp-st__card"').slice(1);
const stepsWeight = (a: StiffnessAnalysis) => weightOf(a.solution?.steps ?? a.partial);

const mechanism = build({ mode: 'truss', nodes: [[0, 0], [10, 0], [20, 0]], members: [[1, 2], [2, 3]], supports: [[1, 'pin'], [3, 'pin']], loads: [[2, 0, -5]] });
const BIG = girder('frame');
const BIG_A = analyseSafely(BIG);

describe('the outline and the cards of a solved structure', () => {
  const form = tpl('truss-five-member');
  const a = analyseSafely(form);
  const html = view(form);
  const steps = a.solution!.steps;
  const stages = stagesOf(steps);

  it('is a section with a name, reached by the id the page gives it, and takes the focus when jumped to', () => {
    expect(html).toMatch(/^<section class="mp-st__solution" id="steps" tabindex="-1" aria-labelledby="([^"]+)">/);
    const label = html.match(/aria-labelledby="([^"]+)"/)![1];
    expect(html).toContain(`<h2 class="mp-st__h" id="${label}">The worked solution</h2>`);
    expect(html).not.toContain('aria-busy');
    expect(view(form, { busy: true })).toContain('aria-busy="true"');
  });

  it('has one card for every step, in the order of the library, each with its number and its title; a card is a named group, not a landmark', () => {
    const cards = [...html.matchAll(/<div class="mp-st__card" id="([^"]+)" role="group" aria-labelledby="([^"]+)" data-step="([^"]+)"/g)];
    expect(cards.map((c) => c[3])).toEqual(steps.map((s) => s.id));
    for (const [, , head] of cards) expect(html).toContain(`<h3 class="mp-st__cardhead" id="${head}">`);
    expect(heads(html)).toEqual(Array(steps.length).fill(true));
    // Nothing of the solution is a landmark but the section itself: no <aside>, no <section> per card.
    expect(html).not.toContain('<aside');
    expect((html.match(/<section/g) ?? []).length).toBe(1);
  });

  it('has one link in the outline for every stage, to the stage’s first card, and a chip for every step of a stage of many', () => {
    const outline = html.match(/<nav class="mp-st__nav" aria-label="Outline of the steps">([\s\S]*?)<\/nav>/)![1];
    const stageLinks = [...outline.matchAll(/<a href="#([^"]+)" class="mp-st__stagelink">/g)];
    expect(stageLinks).toHaveLength(stages.length);
    const cards = [...html.matchAll(/<div class="mp-st__card" id="([^"]+)"/g)].map((m) => m[1]);
    stageLinks.forEach((l, k) => expect(l[1]).toBe(cards[steps.indexOf(stages[k].steps[0])]));
    const chips = [...outline.matchAll(/<a href="#([^"]+)" class="mp-st__chip" aria-label="([^"]+)" title="([^"]+)">([^<]*)<\/a>/g)];
    expect(chips).toHaveLength(stages.filter((s) => s.steps.length > 1).reduce((n, s) => n + s.steps.length, 0));
    // A chip says what it leads to: the step’s number and its title, so that “1” is not all a screen reader hears.
    for (const [, , label, title] of chips) {
      expect(label).toMatch(/^Step \d+(\.\d+)?: /);
      expect(label.endsWith(title)).toBe(true);
    }
  });

  it('every link leads to a card or a control that is in the page, and no id is used twice', () => {
    const all = ids(html);
    expect(new Set(all).size).toBe(all.length);
    for (const m of html.matchAll(/href="#([^"]+)"/g)) expect(all, m[1]).toContain(m[1]);
    for (const m of html.matchAll(/aria-controls="([^"]+)"/g)) expect(all, m[1]).toContain(m[1]);
    for (const m of html.matchAll(/aria-labelledby="([^"]+)"/g)) expect(all, m[1]).toContain(m[1]);
  });

  it('chips are a member’s number in a stage of members and a step’s label where the stage holds several kinds', () => {
    const outline = html.match(/<nav class="mp-st__nav"[\s\S]*?<\/nav>/)![0];
    const chipsOf = (title: string) => {
      const at = outline.indexOf(`</span> ${title}</a>`);
      const from = outline.indexOf('<ol class="mp-st__chips">', at);
      const next = outline.indexOf('<a href', at);
      if (at < 0 || from < 0 || (next >= 0 && next < from)) return [];
      const part = outline.slice(from, outline.indexOf('</ol>', from));
      return [...part.matchAll(/class="mp-st__chip"[^>]*>([^<]*)</g)].map((m) => m[1]);
    };
    expect(chipsOf('Geometry')).toEqual(['1', '2', '3', '4', '5']);
    expect(chipsOf('End forces')).toEqual(['1', '2', '3', '4', '5']);
    expect(chipsOf('Assembly')).toEqual(['6.1', '6.2', '6.3', '6.4', '6.5', '6.6']);
    // The elimination holds passes and back-substitutions: its chips are the steps’ own labels, which cannot be taken for a member.
    const elimination = chipsOf('Elimination');
    expect(elimination.length).toBeGreaterThan(2);
    expect(elimination.every((c) => /^10\.\d+$/.test(c))).toBe(true);
  });

  it('offers Previous and Next, expand and collapse, a menu of every step, and says where it is: no step is current, so there is no Previous and no "Step 0"', () => {
    expect(html).toContain('>Previous step<');
    expect(html).toContain('>Next step<');
    expect(html).toContain('>Expand all steps<');
    expect(html).toContain('>Collapse all steps<');
    expect(html).toContain(`<p class="mp-st__position mp-st__position--aside">${steps.length} steps, none chosen yet</p>`);
    expect(html).not.toMatch(/Step 0\b/);
    // Previous is not offered where there is nowhere before: both copies of it (the column’s and the bar at the foot of a phone) are marked so; Next is not. They are
    // marked, not disabled: a control that is pressed to the last step must not take the keyboard focus away with it (a disabled button loses it).
    const buttons = [...html.matchAll(/<button type="button" class="mp-app__btn"( aria-disabled="true")?[^>]*>(Previous step|Next step|Previous|Next)<\/button>/g)];
    expect(buttons.filter((b) => b[2].startsWith('Previous')).map((b) => b[1])).toEqual([' aria-disabled="true"', ' aria-disabled="true"']);
    expect(buttons.filter((b) => b[2].startsWith('Next')).map((b) => b[1])).toEqual([undefined, undefined]);
    expect(html).not.toMatch(/<button[^>]* disabled=/);
    const menu = html.match(/<label class="mp-st__jump">[\s\S]*?<select>([\s\S]*?)<\/select>/)![1];
    expect([...menu.matchAll(/<option/g)]).toHaveLength(steps.length + 1);
  });

  it('keeps a bar for a tablet or a phone that holds Previous, the step and Next, after the cards, in a group with a name', () => {
    const bar = html.match(/<div class="mp-st__stepbar" role="group" aria-label="Move between the steps">([\s\S]*?)<\/div><\/div><\/div>/)!;
    expect(bar).not.toBeNull();
    expect(html.indexOf('mp-st__stepbar')).toBeGreaterThan(html.lastIndexOf('<div class="mp-st__card"'));
    // The words on the buttons are short, to leave the menu its room; the name each is read by is the full one.
    expect(bar[1]).toContain('aria-label="Previous step"');
    expect(bar[1]).toContain('aria-label="Next step"');
    expect(bar[1]).toMatch(/>Previous<\/button>/);
    expect(bar[1]).toMatch(/>Next<\/button>/);
    expect(bar[1]).toContain('<select');
  });

  it('puts the explanation first and then the numbers: a paragraph, the formulas, the tables, in each open card', () => {
    const first = cardsOf(html)[1];
    expect(first.indexOf('mp-st__text')).toBeGreaterThan(-1);
    expect(first.indexOf('mp-st__text')).toBeLessThan(first.indexOf('mp-st__formulas'));
    expect(first.indexOf('mp-st__formulas')).toBeLessThan(first.search(/mp-st__values|mp-st__figure|<table|mp-st__later/));
  });

  it('is the solution of this structure and says how many stages it has, with no hole left and no -0, NaN or e-notation', () => {
    expect(text(html)).toContain(`written out in ${stages.length} stages`);
    expect(text(html)).not.toMatch(noise);
  });

  it('keeps the lines that are told when they arrive mounted and empty', () => {
    expect(html).toContain('<p class="mp-st__partial" role="status" data-empty="true"></p>');
    expect(html).toContain('<p class="mp-st__announce" role="status"></p>');
  });

  it('offers the four ways of looking at the numbers, in a group with a name: symbols or numbers, figures, plain or powers, the zeros', () => {
    const w = stiffnessUi.en.look;
    expect(html).toContain(`<div class="mp-st__looks" role="group" aria-label="${w.title}">`);
    for (const word of [w.form, w.figures, w.style, w.zeros, ...Object.values(w.forms), ...Object.values(w.styles), ...Object.values(w.zeroStyles)]) expect(html, word).toContain(word);
    expect(html).toContain('<option value="3">3</option>');
    expect(html).toContain('<option value="8">8</option>');
    expect(html).not.toContain('<option value="9">9</option>');
    expect(html).not.toContain('<option value="2">2</option>');
    // The symbols-and-numbers form is the one chosen at first.
    expect(html).toMatch(/<input type="radio" name="[^"]+form" checked=""\/><span>Symbols and numbers<\/span>/);
  });

  it('is given the skip link when the page says where the solution ends, and not otherwise', () => {
    expect(html).not.toContain('mp-st__skip');
    const a2 = analyseSafely(form);
    const withSkip = renderToStaticMarkup(h(Solution, { w: stiffnessUi.en, analysis: a2, group: ',', onPaper: false, busy: false, id: 'steps', epoch: 0, after: { id: 'end', go: () => undefined } }));
    expect(withSkip).toContain('<a class="mp-st__skip" href="#end">Skip the worked solution</a>');
  });
});

describe('the units are those the analysis was computed in', () => {
  it('writes the numbers and the units of the analysis it is given, in feet and kips or metres and kilonewtons, with no other word of the form in it', () => {
    const us = view(defaultStiffness());
    const si = view(convertStiffness(defaultStiffness(), 'si'));
    expect(text(us)).toContain('Units: ft.');
    expect(text(si)).toContain('Units: m.');
    expect(text(us)).not.toContain('Units: m.');
    expect(text(si)).not.toContain('Units: ft.');
    // …and the coordinates are the analysis’s: 16 ft stays 4.877 m only in the solution of the SI analysis.
    expect(text(si)).toContain('4.877');
    expect(text(us)).not.toContain('4.877');
  });
});

describe('every problem, both languages: all cards open, the first drawn in full, nothing broken', () => {
  for (const id of TEMPLATE_IDS) {
    it(`${id}`, () => {
      for (const lang of LANGS) {
        for (const units of ['us', 'si'] as const) {
          const form = tpl(id, units);
          const a = analyseSafely(form);
          const html = view(form, { lang, analysis: a });
          const where = `${id} ${lang} ${units}`;
          expect(heads(html), where).toEqual(Array(a.solution!.steps.length).fill(true));
          expect(autoOpen(a.solution!.steps).every(Boolean), where).toBe(true);
          expect(text(html), where).not.toMatch(noise);
          expect(html, where).not.toContain('mp-st__long');
          // The tables of the first cards are in the page; those of the others are to come, and their room is kept.
          expect((html.match(/<table\b/g) ?? []).length, where).toBeGreaterThan(0);
          expect((html.match(/class="mp-st__later"/g) ?? []).length, where).toBeGreaterThan(0);
        }
      }
    });
  }
});

describe('a solution with very large tables', () => {
  const a = BIG_A;
  const steps = a.solution!.steps;

  it('weighs more than a sheet will carry, and no textbook problem weighs a card more than the page opens', () => {
    expect(stepsWeight(a)).toBeGreaterThan(PRINT_BUDGET);
    for (const id of TEMPLATE_IDS) for (const s of analyseSafely(tpl(id)).solution!.steps) expect(stepWeight(s), `${id} ${s.key}`).toBeLessThanOrEqual(OPEN_CARD);
  });

  it('starts with the cards of very large tables closed and the rest open, and says how many, in the page’s own number format', () => {
    const html = view(BIG, { analysis: a });
    const open = heads(html);
    const auto = autoOpen(steps);
    expect(open).toEqual(auto);
    const closed = auto.filter((x) => !x).length;
    expect(closed).toBeGreaterThan(10);
    const line = text(html.match(/<p class="mp-app__note mp-st__long">([\s\S]*?)<\/p>/)![1]);
    expect(line).toBe(
      `This solution has ${steps.length} steps and ${stepsWeight(a).toLocaleString('en-US')} table entries. Steps with a very large table start closed (${closed} of ${steps.length}); open them from the outline, or choose Expand all steps. Each table is drawn as it comes into view, so opening many costs little.`,
    );
    // The Spanish page writes the thousands with its narrow space: 59 098, never 59,098.
    // (Raw, not through `text`, which would turn the narrow space into a plain one.)
    const es = view(BIG, { analysis: a, lang: 'es' }).match(/<p class="mp-app__note mp-st__long">([\s\S]*?)<\/p>/)![1];
    expect(es).toContain(`${String(stepsWeight(a)).replace(/\B(?=(\d{3})+(?!\d))/g, ' ')} entradas de tabla`);
    expect(es).not.toMatch(/\d,\d{3}/);
  });

  it('draws the tables of no more than the first few cards, keeps the room of the rest, and the page stays small however many steps there are', () => {
    const html = view(BIG, { analysis: a });
    const cards = cardsOf(html);
    expect(cards.length).toBe(steps.length);
    const drawn = cards.filter((c) => c.includes('<table'));
    expect(drawn.length).toBeGreaterThan(0);
    expect(drawn.length).toBeLessThanOrEqual(SEED_CARDS);
    // An open card that is not drawn holds a room of its own, with a height, and an empty one a closed card holds nothing.
    const later = cards.filter((c) => c.includes('mp-st__later'));
    expect(later.length).toBeGreaterThan(50);
    // …and says what it holds, in words that are in the page (no aria-hidden: a reader of the page is told, and so is whoever has no scripts).
    for (const c of later) expect(c).toMatch(/<div class="mp-st__later" style="min-height:\d+px"><p class="mp-st__holds">This step holds [^<]+\. <span class="mp-st__when">They are drawn when you reach this step\.<\/span><noscript> Scripts are off, so they are not drawn here\.<\/noscript><\/p><\/div>/);
    for (const c of later) expect(c).not.toContain('aria-hidden="true"><');
    const closed = cards.filter((c) => c.includes('aria-expanded="false"'));
    expect(closed.length).toBeGreaterThan(10);
    for (const c of closed) expect(c).toMatch(/<div id="[^"]+" class="mp-st__body" hidden=""><\/div>/);
    // The page before: 130 cards open, 36 × 36 tables shut inside, 100 KB+ of tables. Now it is words, an outline and a few tables.
    expect(html.length).toBeLessThan(250_000);
  });

  it('on paper every card is drawn in full, whatever the length, with its tables: the whole solution is the sheet', () => {
    const html = view(BIG, { analysis: a, onPaper: true });
    // A very long solution starts as a short sheet: it is the sheet without the assembly of each member and the passes of the elimination, and it says so.
    const kept = steps.filter((s) => !PRINT_SKIPPED.includes(s.id));
    expect(cardsOf(html).length).toBe(kept.length);
    expect(heads(html).every(Boolean)).toBe(true);
    expect(html).not.toContain('mp-st__later');
    expect(text(html)).toContain(`This sheet leaves out ${steps.length - kept.length} steps`);
    expect(text(html)).not.toMatch(noise);
  });

  it('offers to print every step as well, and says what the short sheet leaves out', () => {
    const html = view(BIG, { analysis: a });
    expect(html).toContain('>On paper<');
    expect(html).toContain('<option value="short" selected="">Without the assembly and elimination steps</option>');
    expect(html).toContain('<option value="all">Every step</option>');
    expect(text(html)).toContain('Printing every step of a solution this size can take minutes');
    // A solution that is not very long has no such choice: it is printed whole.
    expect(view(tpl('frame-portal'))).not.toContain('>On paper<');
  });

  it('a wide table is cut into bands on paper, none wider than the most the sheet takes, and every column is in one', () => {
    const html = view(BIG, { analysis: a, onPaper: true });
    const bands = [...html.matchAll(/<p class="mp-st__band">Columns (\d+) to (\d+) of (\d+)<\/p>/g)];
    expect(bands.length).toBeGreaterThan(5);
    for (const [, from, to, total] of bands) {
      expect(Number(to) - Number(from) + 1).toBeLessThanOrEqual(PAPER_BANDS);
      expect(Number(to)).toBeLessThanOrEqual(Number(total));
    }
    const of36 = bands.filter((b) => b[3] === '36').map((b) => `${b[1]}-${b[2]}`);
    expect(of36.length).toBeGreaterThan(0);
    expect(of36.length % Math.ceil(36 / PAPER_BANDS)).toBe(0);
  });

  it('a short solution on paper has no bands at all (nothing is wider than a band)', () => {
    expect(view(tpl('truss-five-member'), { onPaper: true })).not.toContain('mp-st__band');
  });
});

describe('a structure with nothing to work out', () => {
  it('says that the solution will appear, and has no controls, outline or cards', () => {
    for (const lang of LANGS) {
      const html = view(emptyStiffness(), { lang });
      expect(text(html)).toContain(stiffnessUi[lang].solution.noSteps);
      expect(html).not.toContain('mp-st__layout');
      expect(html).not.toContain('mp-st__card');
      expect(html).not.toContain('<select');
      expect(html).toContain('<p class="mp-st__partial" role="status" data-empty="true"></p>');
    }
  });
});

describe('a mechanism: the solution up to the pass that found it', () => {
  const a = analyseSafely(mechanism);
  const html = view(mechanism, { analysis: a });

  it('shows the steps that could be worked out, with the shorter introduction and the reason in the line that is already in the page', () => {
    expect(a.solution).toBeNull();
    expect(a.partial.length).toBeGreaterThan(5);
    expect(text(html)).toContain(stiffnessUi.en.solution.shortIntro);
    expect(html).toContain(`<p class="mp-st__partial" role="status">${stiffnessUi.en.solution.partial}</p>`);
    expect(html).not.toContain('data-empty="true"');
  });

  it('marks the pass that found the zero pivot, once, and ends there', () => {
    expect((html.match(/data-singular="true"/g) ?? []).length).toBe(1);
    const cards = [...html.matchAll(/data-step="([^"]+)"( data-singular="true")?/g)];
    const last = cards[cards.length - 1];
    expect(last[1]).toBe('forward-pass');
    expect(last[2]).toBe(' data-singular="true"');
    expect(cards.map((c) => c[1])).not.toContain('back-substitution');
    expect(cards.map((c) => c[1])).not.toContain('reactions');
  });

  it('names the DOF whose pivot is lost, in both languages, and prints no hole, NaN or e-notation', () => {
    for (const lang of LANGS) {
      const t = text(view(mechanism, { analysis: a, lang }));
      expect(t).not.toMatch(noise);
      expect(t).toContain('2y');
    }
  });

  it('says another thing for a structure that stopped for another reason', () => {
    const other = { ...a, partial: a.partial.filter((s) => !(s.id === 'forward-pass' && s.facts.singular === true)) };
    const t = text(view(mechanism, { analysis: other }));
    expect(t).toContain(stiffnessUi.en.solution.partialOther);
    expect(t).not.toContain(stiffnessUi.en.solution.partial);
    expect(view(mechanism, { analysis: other })).not.toContain('data-singular');
  });
});
