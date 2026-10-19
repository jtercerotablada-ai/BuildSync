import { createElement as h } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { beamStrings } from '@/lib/calc/beam/strings';
import { analyseSafely, type StiffnessAnalysis } from '@/lib/calc/stiffness/analysis';
import { defaultStiffness, emptyStiffness, reduceStiffness, type StiffnessForm } from '@/lib/calc/stiffness/model';
import { sharedWords, stiffnessUi } from '@/lib/calc/stiffness/strings';
import { TEMPLATE_IDS, type TemplateId } from '@/lib/calc/stiffness/templates';
import type { Lang } from '@/lib/ttc/i18n';
import { StiffnessCalculator } from './StiffnessCalculator';
import { Solution } from './Solution';
import { build, girder } from './fixtures.testlib';
import { reactionDirection, reactionSymbol } from './headline';
import { FRESH, SIGHT_EVERY, holdsLine, holdsOf, movedLine, openReducer, settleSight, spokenTitle, type OpenAction, type OpenState } from './solution-state';
import { stepBody, type StepContext } from './steps';

vi.setConfig({ testTimeout: 120_000 });
afterEach(() => new Promise<void>((done) => setTimeout(done, 0)));

/**
 * THE INTERFACE'S SMALL RULES, as the server sends them and as functions: what a card that is not drawn says it holds (to a reader of
 * the page and to one without scripts), the line that tells where Previous and Next took the reader, the two navigation landmarks that have names of their own, the
 * reaction a headline quotes and which way it points. What only a browser can show - the jump that lands, the counter that follows the scroll, the drawing that is
 * pinned at a laptop's height, the bar at 200 % text - is checked in a browser, and by stiffness-place.test.ts and stiffness-pin.test.ts as rules.
 */

const LANGS: Lang[] = ['en', 'es'];
const tpl = (id: TemplateId, units: 'us' | 'si' = 'us') => reduceStiffness(emptyStiffness(units), { type: 'template', template: id });
const run = (state: OpenState, ...actions: OpenAction[]): OpenState => actions.reduce(openReducer, state);
const stepsOf = (a: StiffnessAnalysis) => a.solution?.steps ?? a.partial;
const BIG = analyseSafely(girder('frame'));
const text = (html: string) =>
  html
    .replace(/<(script|style)\b[\s\S]*?<\/\1>/g, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&#x27;/g, "'")
    .replace(/\s+/g, ' ')
    .trim();

function solutionHtml(form: StiffnessForm, o: { lang?: Lang; analysis?: StiffnessAnalysis; onPaper?: boolean } = {}): string {
  const lang = o.lang ?? 'en';
  return renderToStaticMarkup(h(Solution, { w: stiffnessUi[lang], analysis: o.analysis ?? analyseSafely(form), group: lang === 'es' ? ' ' : ',', onPaper: o.onPaper ?? false, busy: false, id: 'steps', epoch: 0 }));
}
const calculatorHtml = (lang: Lang, initial?: StiffnessForm) => renderToStaticMarkup(h(StiffnessCalculator, { t: sharedWords(beamStrings[lang].ui), w: stiffnessUi[lang], initial }));

/* ── What a card holds, said before it is drawn ───────────────────────── */

describe('what a step holds is counted without building it, by the rules the card is built by', () => {
  const format = { sig: 4, style: 'auto', group: ',' } as const;
  const ctxOf = (a: StiffnessAnalysis, lang: Lang = 'en'): StepContext => ({ w: stiffnessUi[lang], system: 'us', mode: a.mode, format });
  const check = (label: string, a: StiffnessAnalysis) => {
    const ctx = ctxOf(a);
    for (const step of stepsOf(a)) {
      const body = stepBody(step, ctx);
      const tables = body.flatMap((item) => (item.kind === 'table' ? [item.model] : []));
      const largest = tables.reduce<{ rows: number; cols: number } | null>((best, t) => {
        const rows = t.rowLabels.length;
        const cols = t.colHeads.length;
        return !best || rows * cols > best.rows * best.cols ? { rows, cols } : best;
      }, null);
      const values = body.reduce((n, item) => n + (item.kind === 'values' ? item.rows.length : 0), 0);
      const held = holdsOf(step);
      expect(held.tables, `${label} ${step.key}`).toBe(tables.length);
      expect(held.values, `${label} ${step.key}`).toBe(values);
      expect(held.largest, `${label} ${step.key}`).toEqual(largest);
    }
  };

  it('every step of every textbook problem, in both modes and unit systems: the same tables, the same largest, the same values as the body that is built', () => {
    for (const id of TEMPLATE_IDS) check(id, analyseSafely(tpl(id)));
    check('si', analyseSafely(tpl('frame-portal', 'si')));
  });

  it('every step of a structure of twelve nodes (a 36 × 36 matrix among them), and of a mechanism’s partial solution', () => {
    check('big', BIG);
    const mechanism = build({ mode: 'truss', nodes: [[0, 0], [10, 0], [20, 0]], members: [[1, 2], [2, 3]], supports: [[1, 'pin'], [3, 'pin']], loads: [[2, 0, -5]] });
    const a = analyseSafely(mechanism);
    expect(a.solution).toBeNull();
    check('mechanism', a);
  });

  it('knows the 36 × 36 matrix of the big structure, and that the partition is one table of the size of K', () => {
    const steps = stepsOf(BIG);
    const biggest = steps.map((s) => holdsOf(s).largest).reduce((m, x) => (x && (!m || x.rows * x.cols > m.rows * m.cols) ? x : m), null as { rows: number; cols: number } | null);
    expect(biggest).toEqual({ rows: 36, cols: 36 });
    const partition = steps.find((s) => s.id === 'partition')!;
    expect(holdsOf(partition).largest).toEqual({ rows: 36, cols: 36 });
  });
});

describe('the sentence that says what a card holds', () => {
  it('names the tables and the values, with the right plural and the largest size, in both languages', () => {
    const en = stiffnessUi.en;
    const es = stiffnessUi.es;
    expect(holdsLine(en, { tables: 2, largest: { rows: 36, cols: 36 }, values: 0 })).toBe('This step holds 2 tables (the largest 36 × 36).');
    expect(holdsLine(en, { tables: 1, largest: { rows: 2, cols: 2 }, values: 1 })).toBe('This step holds a table of 2 × 2 and 1 value.');
    expect(holdsLine(en, { tables: 0, largest: null, values: 9 })).toBe('This step holds 9 values.');
    expect(holdsLine(es, { tables: 2, largest: { rows: 36, cols: 36 }, values: 0 })).toBe('Este paso contiene 2 tablas (la mayor de 36 × 36).');
    expect(holdsLine(es, { tables: 1, largest: { rows: 2, cols: 2 }, values: 1 })).toBe('Este paso contiene una tabla de 2 × 2 y 1 valor.');
    expect(holdsLine(es, { tables: 0, largest: null, values: 9 })).toBe('Este paso contiene 9 valores.');
  });

  it('says nothing for a card that holds neither (nothing is waited for there)', () => {
    expect(holdsLine(stiffnessUi.en, { tables: 0, largest: null, values: 0 })).toBe('');
  });
});

describe('a card that is not drawn tells whoever reads the page what it holds, and whoever has no scripts that it is not drawn', () => {
  for (const lang of LANGS) {
    it(`${lang}: every far open card has its sentence, which is the sentence its own step gives, and no card is hidden from assistive technology`, () => {
      const html = solutionHtml(defaultStiffness(), { lang, analysis: BIG });
      const cards = html.split('<div class="mp-st__card"').slice(1);
      const later = cards.filter((c) => c.includes('mp-st__later'));
      expect(later.length).toBeGreaterThan(50);
      const steps = stepsOf(BIG);
      cards.forEach((card, k) => {
        const hold = holdsLine(stiffnessUi[lang], holdsOf(steps[k]));
        if (!card.includes('mp-st__later')) return;
        // (the text is the page's, inside the room kept: an apostrophe or a plus sign would be written as an entity)
        expect(text(card), steps[k].key).toContain(hold);
      });
      for (const c of later) {
        expect(c).toContain(`<span class="mp-st__when">${stiffnessUi[lang].solution.holdsLater}</span>`);
        expect(c).toContain(`<noscript> ${stiffnessUi[lang].solution.holdsOff}</noscript>`);
        expect(c).not.toMatch(/mp-st__later[^>]*aria-hidden/);
      }
    });
  }

  it('says once, for the whole solution and only without scripts, that the first steps have their tables and the others their words and formulas', () => {
    for (const lang of LANGS) {
      const html = solutionHtml(defaultStiffness(), { lang });
      expect(html).toContain(`<noscript><p class="mp-app__note mp-st__noscript">${stiffnessUi[lang].solution.noScripts}</p></noscript>`);
    }
  });

  it('says none of it on paper, where every card is drawn, nor for a structure with no solution', () => {
    const paper = solutionHtml(defaultStiffness(), { onPaper: true });
    expect(paper).not.toContain('mp-st__later');
    const none = solutionHtml(emptyStiffness());
    expect(none).not.toContain('mp-st__noscript');
  });

  it('has no sentence about tables for a card that is open but holds none, and keeps no empty room for it', () => {
    const html = solutionHtml(defaultStiffness(), { analysis: BIG });
    const cards = html.split('<div class="mp-st__card"').slice(1);
    const steps = stepsOf(BIG);
    steps.forEach((s, k) => {
      const none = holdsLine(stiffnessUi.en, holdsOf(s)) === '';
      if (none && cards[k].includes('aria-expanded="true"')) expect(cards[k]).not.toContain('mp-st__later');
    });
  });
});

/* ── What the short sheet leaves out ─────────────────────────────────── */

describe('the note about the short sheet names what this solution leaves out, and nothing it has not got', () => {
  const small = analyseSafely(defaultStiffness());
  const withIds = (a: StiffnessAnalysis, keep: (id: string) => boolean) => ({ ...a, solution: { ...a.solution!, steps: stepsOf(a).filter((s) => keep(s.id)) } }) as StiffnessAnalysis;
  /** The big solution with steps of other kinds added: re-keyed copies of the small structure's. */
  const mixed = (extra: (id: string) => boolean, drop: (id: string) => boolean = () => false): StiffnessAnalysis => {
    const added = stepsOf(small).filter((s) => extra(s.id)).map((s) => ({ ...s, key: `extra-${s.key}` }));
    const base = stepsOf(BIG).filter((s) => !drop(s.id));
    return { ...BIG, solution: { ...BIG.solution!, steps: [...base, ...added] } } as StiffnessAnalysis;
  };
  const note = (html: string) => text(html.match(/<p class="mp-app__note mp-st__printnote">([\s\S]*?)<\/p>/)![1]);

  it('a solution of twelve nodes has the adding of each member to K to leave out and no elimination (that is written only up to twelve free DOFs): the note does not speak of one', () => {
    expect(stepsOf(BIG).some((s) => ['augmented', 'forward-pass', 'back-substitution'].includes(s.id))).toBe(false);
    const n = note(solutionHtml(girder('frame'), { analysis: BIG }));
    expect(n).toContain('that add each member to K;');
    expect(n).not.toContain('elimination');
    for (const lang of LANGS) {
      const m = note(solutionHtml(girder('frame'), { analysis: BIG, lang }));
      if (lang === 'es') expect(m).not.toContain('eliminación');
    }
  });

  it('one that has both says both, and one that has only the elimination says only that', () => {
    const both = mixed((id) => ['forward-pass', 'back-substitution'].includes(id));
    expect(note(solutionHtml(girder('frame'), { analysis: both }))).toContain('that add each member to K and carry out the elimination;');
    const only = mixed((id) => ['forward-pass', 'back-substitution'].includes(id), (id) => id === 'assembly');
    const html = solutionHtml(girder('frame'), { analysis: only });
    if (html.includes('mp-st__printnote')) expect(note(html)).toContain('that carry out the elimination;');
  });

  it('on paper the line says the same: the count and the kinds that are left out', () => {
    const paper = solutionHtml(girder('frame'), { analysis: BIG, onPaper: true });
    const line = text(paper.match(/<p class="mp-st__skipped">([\s\S]*?)<\/p>/)![1]);
    expect(line).toContain(': the adding of each member to K. The page has them');
    expect(line).not.toContain('elimination');
    const es = text(solutionHtml(girder('frame'), { analysis: BIG, onPaper: true, lang: 'es' }).match(/<p class="mp-st__skipped">([\s\S]*?)<\/p>/)![1]);
    expect(es).toContain(': la suma de cada barra a K. La página los tiene');
    void withIds;
  });
});

/* ── The reader is at a card, and told where Previous and Next took them ── */

describe('where the reader is, and what is told of it', () => {
  const keys = ['a', 'b', 'c', 'd'];
  it('the card at the top of the screen becomes the step the reader is at, opens nothing, and tells nothing', () => {
    const s = run(FRESH, { type: 'expand' }, { type: 'at', key: 'c' });
    expect(s.current).toBe('c');
    expect(s.said).toBe('expanded');
    expect(s.toggled).toEqual({});
    expect(s.movedTo).toBeNull();
  });

  it('the same card again is the very same state (nothing is drawn again for it), and above the first card is no step', () => {
    const s = run(FRESH, { type: 'at', key: 'b' });
    expect(openReducer(s, { type: 'at', key: 'b' })).toBe(s);
    expect(run(s, { type: 'at', key: null }).current).toBeNull();
  });

  it('a press that leaves the focus where it was is announced with the card it went to, and the announcement does not follow the scroll that comes after', () => {
    const s = run(FRESH, { type: 'go', key: 'c', announce: true });
    expect(s.movedTo).toBe('c');
    expect(s.current).toBe('c');
    const scrolled = run(s, { type: 'at', key: 'd' });
    expect(scrolled.current).toBe('d');
    expect(scrolled.movedTo).toBe('c');
  });

  it('a link of the outline moves the focus to the card, so it is not announced as well; and any other press takes the announcement away', () => {
    expect(run(FRESH, { type: 'go', key: 'c' }).movedTo).toBeNull();
    const told = run(FRESH, { type: 'go', key: 'c', announce: true });
    for (const next of [{ type: 'expand' }, { type: 'collapse' }, { type: 'toggle', key: 'a', wasOpen: true }, { type: 'go', key: 'b' }] as OpenAction[]) expect(run(told, next).movedTo, next.type).toBeNull();
    expect(run(told, { type: 'reset' })).toEqual(FRESH);
    void keys;
  });

  it('writes the arrival in both languages with the title as it is spoken: the number, the place among all, the title with its subscripts said', () => {
    expect(movedLine(stiffnessUi.en.solution, '4.2', 6, 26, 'Local stiffness of member 2')).toBe('Step 4.2, 7 of 26: Local stiffness of member 2');
    expect(movedLine(stiffnessUi.es.solution, '10.1', 16, 26, 'La matriz ampliada')).toBe('Paso 10.1, 17 de 26: La matriz ampliada');
    expect(spokenTitle('Partition of K_FF', stiffnessUi.en.solution)).toBe('Partition of K sub FF');
    expect(spokenTitle('Partición de K_FF', stiffnessUi.es.solution)).toBe('Partición de K subíndice FF');
    expect(spokenTitle('T^T k T', stiffnessUi.en.solution)).toBe('T transpose k T');
    expect(spokenTitle('T^T k T', stiffnessUi.es.solution)).toBe('T traspuesta k T');
    expect(spokenTitle('Forces in f_FE_global', stiffnessUi.en.solution)).toBe('Forces in f sub FE global');
    expect(movedLine(stiffnessUi.en.solution, '8', 7, 26, spokenTitle('The partition of K_FF', stiffnessUi.en.solution))).toContain('K sub FF');
  });

  it('keeps the line that tells it in the page before it has anything to say, and the way into the card only once there is a card to go to', () => {
    const html = solutionHtml(defaultStiffness());
    expect(html).toContain('<p class="mp-st__sr" role="status"></p>');
    expect(html).not.toContain('Go to this step');
  });
});

/* ── The cards in sight ───────────────────────────────────────────────── */

describe('the cards in sight are drawn when the scroll has settled', () => {
  it('is the cards that are in sight when it settles, and the very same set when none changed (nothing is drawn again for it)', () => {
    const prev = new Set(['a', 'b']);
    expect(settleSight(prev, new Set(['b', 'a']))).toBe(prev);
    const next = settleSight(prev, new Set(['b', 'c']));
    expect([...next].sort()).toEqual(['b', 'c']);
    expect(next).not.toBe(prev);
    expect([...settleSight(prev, new Set())]).toEqual([]);
    expect([...settleSight(new Set(), new Set(['x']))]).toEqual(['x']);
  });

  it('is a copy: the set the observer goes on changing does not change the one the page holds', () => {
    const live = new Set(['a']);
    const held = settleSight(new Set(), live);
    live.add('b');
    expect([...held]).toEqual(['a']);
  });

  it('is drawn at a pace a phone can keep up with, and not so slowly that a reader who stops is kept waiting', () => {
    expect(SIGHT_EVERY).toBeGreaterThanOrEqual(80);
    expect(SIGHT_EVERY).toBeLessThanOrEqual(200);
  });
});

/* ── Landmarks ────────────────────────────────────────────────────────── */

describe('two navigations of the page do not share a name', () => {
  for (const lang of LANGS) {
    it(`${lang}: every nav has its own accessible name`, () => {
      for (const form of [defaultStiffness(), tpl('frame-portal')]) {
        const html = calculatorHtml(lang, form);
        const navs = [...html.matchAll(/<nav\b[^>]*aria-label="([^"]+)"/g)].map((m) => m[1]);
        expect(navs.length).toBeGreaterThanOrEqual(3);
        expect(new Set(navs).size, navs.join(' | ')).toBe(navs.length);
        expect(navs).toContain(stiffnessUi[lang].jump.label);
        expect(navs).toContain(stiffnessUi[lang].jump.back);
        expect(stiffnessUi[lang].jump.back).not.toBe(stiffnessUi[lang].jump.label);
      }
    });
  }

  it('names every group and region the same way, once: the groups of the solution and its bar are not landmarks and may share nothing with a nav', () => {
    const html = calculatorHtml('en');
    const labels = [...html.matchAll(/<(?:nav|section)\b[^>]*aria-label="([^"]+)"/g)].map((m) => m[1]);
    expect(new Set(labels).size).toBe(labels.length);
  });
});

/* ── The largest reaction, as the drawing shows it ────────────────────── */

describe('the headline quotes a number that is on an arrow of the drawing, and says which way the arrow points', () => {
  const reactions = (a: StiffnessAnalysis) => a.results!.reactions;
  it('names the component: Rx, Ry or M', () => {
    expect(reactionSymbol('x')).toBe('Rx');
    expect(reactionSymbol('y')).toBe('Ry');
    expect(reactionSymbol('m')).toBe('M');
  });

  it('gives the direction from the sign the table gives: +x right, −x left, +y up, −y down, a moment counter-clockwise when positive', () => {
    const a = analyseSafely(defaultStiffness());
    // node 1: Rx +10, Ry +7.5; node 2: Rx −30, Ry +22.5
    expect(reactionDirection(reactions(a), { node: 1, kind: 'x' })).toBe('right');
    expect(reactionDirection(reactions(a), { node: 2, kind: 'x' })).toBe('left');
    expect(reactionDirection(reactions(a), { node: 2, kind: 'y' })).toBe('up');
    expect(reactionDirection(reactions(a), { node: 9, kind: 'y' })).toBeNull();
    // a component the support does not hold, or that is zero, has no direction
    const roller = [{ label: 1, node: 4, rx: null, ry: 5, rm: null, magnitude: 5 }, { label: 2, node: 5, rx: 0, ry: -2, rm: 0, magnitude: 2 }];
    expect(reactionDirection(roller, { node: 4, kind: 'x' })).toBeNull();
    expect(reactionDirection(roller, { node: 4, kind: 'm' })).toBeNull();
    expect(reactionDirection(roller, { node: 5, kind: 'x' })).toBeNull();
    expect(reactionDirection(roller, { node: 5, kind: 'y' })).toBe('down');
    const portal = analyseSafely(tpl('frame-portal'));
    for (const r of reactions(portal)) {
      if (r.rm !== null && r.rm !== 0) expect(reactionDirection(reactions(portal), { node: r.node, kind: 'm' }), `M at ${r.node}`).toBe(r.rm > 0 ? 'ccw' : 'cw');
      if (r.ry !== null && r.ry < 0) expect(reactionDirection(reactions(portal), { node: r.node, kind: 'y' })).toBe('down');
    }
  });

  for (const lang of LANGS) {
    it(`${lang}: the default structure says its largest single reaction with its direction, and not the resultant at the node (37.5) that is on no arrow`, () => {
      const html = calculatorHtml(lang);
      const dd = [...html.matchAll(/<dt>([^<]+)<\/dt><dd>([^<]*)<\/dd>/g)].find((m) => m[1] === stiffnessUi[lang].results.headline.reaction)![2];
      const w = stiffnessUi[lang].results.headline;
      expect(dd).toBe(w.component.replace('{symbol}', 'Rx').replace('{value}', '30').replace('{unit}', 'kip').replace('{direction}', w.directions.left).replace('{node}', '2'));
      expect(dd).not.toContain('37.5');
    });
  }

  it('the portal frame quotes a force on an arrow and not the 5.392 of two arrows; a structure that is not solved quotes none', () => {
    const html = calculatorHtml('en', tpl('frame-portal'));
    const dd = [...html.matchAll(/<dt>Largest reaction<\/dt><dd>([^<]*)<\/dd>/g)][0][1];
    expect(dd).not.toContain('5.392');
    expect(dd).toMatch(/^(Rx|Ry|M) = [\d.,]+ [^,]+, at node \d+$/);
  });
});

/* ── The line that says the drawing is being widened ──────────────────── */

describe('the words of the page-level controls exist in both languages', () => {
  it('has the line that tells the drawing is being widened, the way into a card, and the two ends of the arrival', () => {
    for (const lang of LANGS) {
      const w = stiffnessUi[lang];
      for (const word of [w.drawing.options.widening, w.solution.readThis, w.solution.moved, w.solution.holds, w.solution.holdsTable, w.solution.holdsTables, w.solution.holdsValues, w.solution.holdsLater, w.solution.holdsOff, w.solution.noScripts, w.jump.back]) {
        expect(word.length, lang).toBeGreaterThan(5);
        expect(word).not.toMatch(/undefined|\[object/);
      }
      expect(Object.keys(w.results.headline.directions).sort()).toEqual(['ccw', 'cw', 'down', 'left', 'right', 'up']);
    }
    expect(stiffnessUi.en.drawing.options.widening).not.toBe(stiffnessUi.es.drawing.options.widening);
  });
});
