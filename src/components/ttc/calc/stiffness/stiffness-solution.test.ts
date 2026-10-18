import { createElement as h } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { analyseSafely, stagesOf, type StiffnessAnalysis } from '@/lib/calc/stiffness/analysis';
import { emptyStiffness, reduceStiffness, type StiffnessForm } from '@/lib/calc/stiffness/model';
import { stiffnessUi } from '@/lib/calc/stiffness/strings';
import { TEMPLATE_IDS, type TemplateId } from '@/lib/calc/stiffness/templates';
import type { Lang } from '@/lib/ttc/i18n';
import { OPEN_BUDGET, PAPER_BANDS, Solution } from './Solution';
import { build, girder } from './fixtures.testlib';
import { stepWeight } from './steps';

vi.setConfig({ testTimeout: 120_000 });
afterEach(() => new Promise<void>((done) => setTimeout(done, 0)));

/**
 * THE WORKED SOLUTION AS THE SERVER SENDS IT: the outline, the cards, the way a long solution starts, the page on paper, a mechanism's partial
 * solution, a structure with nothing to work out - and the links between them, which must lead somewhere. What needs a browser (a card opened by
 * a click, Previous and Next moving the focus, the numbers shown as symbols) is listed in the report that goes with this file.
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

function view(form: StiffnessForm, o: { lang?: Lang; onPaper?: boolean; busy?: boolean; analysis?: StiffnessAnalysis } = {}): string {
  const a = o.analysis ?? analyseSafely(form);
  return renderToStaticMarkup(h(Solution, { w: stiffnessUi[o.lang ?? 'en'], analysis: a, system: form.units, mode: form.mode, group: ',', onPaper: o.onPaper ?? false, busy: o.busy ?? false, id: 'steps', epoch: 0 }));
}
const heads = (html: string) => [...html.matchAll(/<h3 class="mp-st__cardhead"[^>]*><button[^>]*aria-expanded="(true|false)"/g)].map((m) => m[1] === 'true');
const ids = (html: string) => [...html.matchAll(/ id="([^"]+)"/g)].map((m) => m[1]);

const mechanism = build({ mode: 'truss', nodes: [[0, 0], [10, 0], [20, 0]], members: [[1, 2], [2, 3]], supports: [[1, 'pin'], [3, 'pin']], loads: [[2, 0, -5]] });

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

  it('has one card for every step, in the order of the library, each with its number and its title', () => {
    const cards = [...html.matchAll(/<section class="mp-st__card" id="([^"]+)" aria-labelledby="([^"]+)" data-step="([^"]+)"/g)];
    expect(cards.map((c) => c[3])).toEqual(steps.map((s) => s.id));
    for (const [, , head] of cards) expect(html).toContain(`<h3 class="mp-st__cardhead" id="${head}">`);
    expect(heads(html)).toEqual(Array(steps.length).fill(true));
  });

  it('has one link in the outline for every stage, to the stage’s first card, and a chip for every step of a stage of many', () => {
    const outline = html.match(/<nav class="mp-st__nav" aria-label="Outline of the steps">([\s\S]*?)<\/nav>/)![1];
    const stageLinks = [...outline.matchAll(/<a href="#([^"]+)" class="mp-st__stagelink">/g)];
    expect(stageLinks).toHaveLength(stages.length);
    const cards = [...html.matchAll(/<section class="mp-st__card" id="([^"]+)"/g)].map((m) => m[1]);
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

  it('offers Previous and Next from the first, expand and collapse, a jump menu of every step, and says where it is', () => {
    expect(html).toContain('>Previous step<');
    expect(html).toContain('>Next step<');
    expect(html).toContain('>Expand all steps<');
    expect(html).toContain('>Collapse all steps<');
    expect(html).toContain('<p class="mp-st__position">Step 0 of ' + steps.length + '</p>');
    const menu = html.match(/<select class="mp-num__input" value="">([\s\S]*?)<\/select>/)?.[1] ?? html.match(/<span class="mp-num__label">Go to step<\/span>[\s\S]*?<select[^>]*>([\s\S]*?)<\/select>/)![1];
    expect([...menu.matchAll(/<option/g)]).toHaveLength(steps.length + 1);
    expect(html).not.toMatch(/<button[^>]*disabled=""[^>]*>(Previous|Next) step/);
  });

  it('puts the explanation first and then the numbers: a paragraph, the formulas, the tables, in each open card', () => {
    const first = html.split('<section class="mp-st__card"')[2];
    expect(first.indexOf('mp-st__text')).toBeGreaterThan(-1);
    expect(first.indexOf('mp-st__text')).toBeLessThan(first.indexOf('mp-st__formulas'));
    expect(first.indexOf('mp-st__formulas')).toBeLessThan(first.search(/mp-st__values|mp-st__figure|<table/));
  });

  it('is the solution of this structure and says how many stages it has, with no hole left and no -0, NaN or e-notation', () => {
    expect(text(html)).toContain(`written out in ${stages.length} stages`);
    expect(text(html)).not.toMatch(noise);
  });

  it('keeps the line for the partial solution mounted and empty, to be heard when it arrives', () => {
    expect(html).toContain('<p class="mp-st__partial" role="status" data-empty="true"></p>');
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
});

describe('every problem, both languages: all cards open and nothing broken', () => {
  for (const id of TEMPLATE_IDS) {
    it(`${id}`, () => {
      for (const lang of LANGS) {
        for (const units of ['us', 'si'] as const) {
          const form = tpl(id, units);
          const a = analyseSafely(form);
          const html = view(form, { lang, analysis: a });
          const where = `${id} ${lang} ${units}`;
          expect(stepsWeight(a), where).toBeLessThanOrEqual(OPEN_BUDGET);
          expect(heads(html), where).toEqual(Array(a.solution!.steps.length).fill(true));
          expect(text(html), where).not.toMatch(noise);
          expect(html, where).not.toContain('mp-st__long');
        }
      }
    });
  }
});

function stepsWeight(a: StiffnessAnalysis): number {
  return (a.solution?.steps ?? a.partial).reduce((n, s) => n + stepWeight(s), 0);
}

describe('a solution too long to open at once', () => {
  const form = girder('frame');
  const a = analyseSafely(form);

  it('weighs more than the budget, and the textbook problems weigh less (all cards open by default is for them)', () => {
    expect(stepsWeight(a)).toBeGreaterThan(OPEN_BUDGET);
    for (const id of TEMPLATE_IDS) expect(stepsWeight(analyseSafely(tpl(id))), id).toBeLessThan(OPEN_BUDGET);
  });

  it('starts with the first card open and the rest closed, and says why in a line, with the real counts', () => {
    const html = view(form, { analysis: a });
    const open = heads(html);
    expect(open.filter(Boolean)).toHaveLength(1);
    expect(open[0]).toBe(true);
    expect(open.length).toBe(a.solution!.steps.length);
    const line = text(html.match(/<p class="mp-app__note mp-st__long">([\s\S]*?)<\/p>/)![1]);
    expect(line).toBe(`This solution has ${a.solution!.steps.length} steps and ${stepsWeight(a).toLocaleString('en-US')} table entries, so the steps start closed to keep the page quick. Open one from the outline, or choose Expand all steps.`);
    expect(view(form, { analysis: a, lang: 'es' })).toContain('mp-st__long');
  });

  it('a closed card is a heading and nothing else: its tables are not built', () => {
    const html = view(form, { analysis: a });
    const closed = html.split('<section class="mp-st__card"').slice(2);
    expect(closed.length).toBeGreaterThan(100);
    for (const card of closed.slice(0, 40)) {
      expect(card).toContain('aria-expanded="false"');
      expect(card).not.toContain('<table');
      expect(card).not.toContain('mp-st__text');
      expect(card).toMatch(/<div id="[^"]+" class="mp-st__body" hidden=""><\/div>/);
    }
    // 130 cards, and a page whose size does not grow with the 36 × 36 tables of the cards that are shut.
    expect(html.length).toBeLessThan(400_000);
  });

  it('on paper every card is open, whatever the length, and a wide table is cut into bands of twelve columns', () => {
    const html = view(form, { analysis: a, onPaper: true });
    expect(heads(html).every(Boolean)).toBe(true);
    expect(PAPER_BANDS).toBe(12);
    const bands = [...html.matchAll(/<p class="mp-st__band">Columns (\d+) to (\d+) of (\d+)<\/p>/g)];
    expect(bands.length).toBeGreaterThan(30);
    for (const [, from, to, total] of bands) {
      expect(Number(to) - Number(from) + 1).toBeLessThanOrEqual(PAPER_BANDS);
      expect(Number(to)).toBeLessThanOrEqual(Number(total));
    }
    expect(bands.some((b) => b[3] === '36')).toBe(true);
    // Every band of a 36-column table: 1–12, 13–24, 25–36.
    const thirty6 = bands.filter((b) => b[3] === '36').map((b) => `${b[1]}-${b[2]}`);
    expect(new Set(thirty6)).toEqual(new Set(['1-12', '13-24', '25-36']));
    expect(text(html)).not.toMatch(noise);
  });

  it('a short solution on paper has no bands at all (nothing is wider than twelve columns)', () => {
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

  it('names the pivot that is zero, in both languages, with the figure it was compared with', () => {
    for (const lang of LANGS) {
      const t = text(view(mechanism, { analysis: a, lang }));
      expect(t).not.toMatch(noise);
      expect(t).toContain(lang === 'en' ? 'is zero' : 'es cero');
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
