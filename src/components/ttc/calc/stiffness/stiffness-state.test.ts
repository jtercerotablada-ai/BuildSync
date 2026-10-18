import { afterEach, describe, expect, it, vi } from 'vitest';
import { analyseSafely } from '@/lib/calc/stiffness/analysis';
import { defaultStiffness, emptyStiffness, reduceStiffness, convertStiffness } from '@/lib/calc/stiffness/model';
import { TEMPLATE_IDS } from '@/lib/calc/stiffness/templates';
import { girder } from './fixtures.testlib';
import { anchorFor, scrollTarget } from './print-place';
import { startShow, showFor, sizeClass } from './show';
import {
  FRESH,
  OPEN_CARD,
  PRINT_BUDGET,
  PRINT_SKIPPED,
  SEED_CARDS,
  applyNear,
  autoOpen,
  bandsOf,
  currentOf,
  estimateBody,
  firstRows,
  groupDigits,
  isOpen,
  nextRows,
  openReducer,
  positionLine,
  printSteps,
  sameCard,
  sameWords,
  seedNear,
  solutionOf,
  startClosed,
  startScope,
  stepTarget,
  systemOf,
  weightOf,
  type OpenAction,
  type OpenState,
  type SameCardProps,
} from './solution-state';
import { labelsOf, stepView, stepWeight } from './steps';
import { stiffnessUi } from '@/lib/calc/stiffness/strings';

vi.setConfig({ testTimeout: 120_000 });
afterEach(() => new Promise<void>((done) => setTimeout(done, 0)));

/**
 * THE WORKED SOLUTION'S BEHAVIOUR, run as functions: what the cards do when the visitor presses Expand all, Collapse all, a card, Next, Previous or
 * a stage; which cards are near the screen; the counter; the sheet; the units. These are the rules a click goes through - nothing here reads a source
 * file for a word - and each fails on the code that stood before them (the sequences at the end are the failures that were seen).
 */

const run = (state: OpenState, ...actions: OpenAction[]): OpenState => actions.reduce(openReducer, state);
const tpl = (id: (typeof TEMPLATE_IDS)[number]) => reduceStiffness(emptyStiffness('us'), { type: 'template', template: id });
const stepsOf = (form = defaultStiffness()) => {
  const a = analyseSafely(form);
  return a.solution?.steps ?? a.partial;
};
// The structure of twelve nodes is solved once for the whole file (it is the slow part of every test that needs it).
const BIG = stepsOf(girder('frame'));

describe('which cards start open', () => {
  it('every card of every textbook problem and of the example starts open (their tables are all of a size to read)', () => {
    for (const id of TEMPLATE_IDS) {
      const open = autoOpen(stepsOf(tpl(id)));
      expect(open.every(Boolean), id).toBe(true);
      expect(startClosed(open), id).toBe(0);
    }
    expect(autoOpen(stepsOf()).every(Boolean)).toBe(true);
  });

  it('a card whose tables are very large starts closed, and the others of the same solution stay open: the cliff is a step, not a wall', () => {
    const steps = BIG;
    const open = autoOpen(steps);
    expect(open[0]).toBe(true);
    steps.forEach((s, k) => {
      if (k > 0) expect(open[k], `${s.key} (${stepWeight(s)} entries)`).toBe(stepWeight(s) <= OPEN_CARD);
    });
    // The 36 × 36 matrices of the assembly (and of the assembled K and the partition) are the closed ones; most of the solution is open.
    expect(startClosed(open)).toBeGreaterThan(10);
    expect(startClosed(open)).toBeLessThan(steps.length / 2);
    expect(steps.filter((_, k) => !open[k]).every((s) => ['assembly', 'assembled', 'partition'].includes(s.id))).toBe(true);
  });

  it('the first card is open however large', () => {
    const asm = BIG.find((s) => s.id === 'assembly')!;
    expect(stepWeight(asm)).toBeGreaterThan(OPEN_CARD);
    expect(autoOpen([asm])[0]).toBe(true);
  });
});

describe('Expand all, Collapse all and a click on a card', () => {
  const keys = BIG.map((s) => s.key);
  const autos = autoOpen(BIG);
  const open = (state: OpenState, k: number) => isOpen(state, keys[k], autos[k], false);

  it('starts as each card’s own start says, and on paper every card is open', () => {
    const closed = autos.findIndex((x) => !x);
    expect(closed).toBeGreaterThan(0);
    expect(open(FRESH, closed)).toBe(false);
    expect(open(FRESH, 0)).toBe(true);
    expect(isOpen(FRESH, keys[closed], false, true)).toBe(true);
  });

  it('Expand all opens every card and says so; Collapse all closes every card and says so', () => {
    const all = run(FRESH, { type: 'expand' });
    expect(keys.every((_, k) => open(all, k))).toBe(true);
    expect(all.said).toBe('expanded');
    const none = run(FRESH, { type: 'collapse' });
    expect(keys.some((_, k) => open(none, k))).toBe(false);
    expect(none.said).toBe('collapsed');
  });

  it('a card closed by hand stays closed after Expand all is pressed again, then opened when pressed after it (what is chosen last wins)', () => {
    let s = run(FRESH, { type: 'expand' });
    s = run(s, { type: 'toggle', key: keys[3], wasOpen: true });
    expect(open(s, 3)).toBe(false);
    expect(open(s, 4)).toBe(true);
    s = run(s, { type: 'expand' });
    expect(open(s, 3)).toBe(true);
  });

  it('a click toggles from what the card shows: a closed card opens, an open card closes, and the line about Expand all goes', () => {
    const closed = autos.findIndex((x) => !x);
    let s = run(FRESH, { type: 'expand' }, { type: 'toggle', key: keys[0], wasOpen: true });
    expect(s.said).toBeNull();
    expect(open(s, 0)).toBe(false);
    s = run(FRESH, { type: 'toggle', key: keys[closed], wasOpen: false });
    expect(open(s, closed)).toBe(true);
  });

  it('going to a card opens it and makes it the one the reader is at, whatever Collapse all said', () => {
    const s = run(FRESH, { type: 'collapse' }, { type: 'go', key: keys[20] });
    expect(open(s, 20)).toBe(true);
    expect(open(s, 21)).toBe(false);
    expect(s.current).toBe(keys[20]);
  });

  it('a structure put in place of the one before sends the cards back to their first state', () => {
    const s = run(FRESH, { type: 'expand' }, { type: 'go', key: keys[7] }, { type: 'reset' });
    expect(s).toEqual(FRESH);
  });
});

describe('Previous, Next and the counter', () => {
  const keys = ['structure', 'geometry#1', 'geometry#2', 'checks'];

  it('Next from nowhere goes to the first card, and Previous from nowhere goes nowhere (it is not a jump to the last)', () => {
    expect(stepTarget(null, keys, 1)).toBe('structure');
    expect(stepTarget(null, keys, -1)).toBeNull();
  });

  it('moves one card at a time, and stops at both ends', () => {
    expect(stepTarget('geometry#1', keys, 1)).toBe('geometry#2');
    expect(stepTarget('geometry#1', keys, -1)).toBe('structure');
    expect(stepTarget('structure', keys, -1)).toBeNull();
    expect(stepTarget('checks', keys, 1)).toBeNull();
    expect(stepTarget(null, [], 1)).toBeNull();
  });

  it('a card that is no longer in the solution is nowhere: the counter is not left reading a place that is gone', () => {
    const s = run(FRESH, { type: 'go', key: 'forward-pass#5' });
    expect(currentOf(s, keys)).toBeNull();
    expect(currentOf(run(FRESH, { type: 'go', key: 'geometry#2' }), keys)).toBe('geometry#2');
    // …and Next from it goes to the first card, as from the start.
    expect(stepTarget(currentOf(s, keys), keys, 1)).toBe('structure');
  });

  it('says the card’s own number, as its heading writes it, and its place among all - never "Step 0"', () => {
    const w = stiffnessUi.en.solution;
    expect(positionLine(w, null, -1, 26)).toBe('26 steps, none chosen yet');
    expect(positionLine(w, '10.6', 26, 40)).toBe('Step 10.6: 27 of 40');
    expect(positionLine(w, '1', 0, 26)).toBe('Step 1: 1 of 26');
    for (const lang of ['en', 'es'] as const) {
      expect(positionLine(stiffnessUi[lang].solution, null, -1, 26)).not.toMatch(/\b0\b/);
    }
    expect(positionLine(stiffnessUi.es.solution, '10.6', 26, 40)).toBe('Paso 10.6: 27 de 40');
  });
});

describe('the cards drawn in full are the ones near the screen', () => {
  it('seeds the first few cards only, deterministically (the server and the browser must agree), and never more than the cap', () => {
    for (const steps of [stepsOf(), stepsOf(tpl('frame-portal')), BIG]) {
      const seed = seedNear(steps);
      expect([...seed]).toEqual([...seedNear(steps)]);
      expect(seed.size).toBeGreaterThanOrEqual(2);
      expect(seed.size).toBeLessThanOrEqual(SEED_CARDS);
      expect([...seed]).toEqual(steps.slice(0, seed.size).map((s) => s.key));
    }
  });

  it('puts a card in the set when it comes into range and out when it leaves, and returns the very same set when nothing changed', () => {
    const a = new Set(['x', 'y']);
    const b = applyNear(a, [{ key: 'z', on: true }, { key: 'x', on: false }]);
    expect([...b].sort()).toEqual(['y', 'z']);
    expect(a.has('x')).toBe(true);
    expect(applyNear(a, [{ key: 'x', on: true }, { key: 'q', on: false }])).toBe(a);
    expect(applyNear(a, [])).toBe(a);
  });

  it('keeps room for the tables of a card that is not drawn, more for a larger table, never an absurd height', () => {
    const steps = BIG;
    const small = steps.find((s) => s.id === 'geometry')!;
    const big = steps.find((s) => s.id === 'assembly')!;
    expect(estimateBody(big)).toBeGreaterThan(estimateBody(small));
    for (const s of steps) {
      expect(estimateBody(s)).toBeGreaterThan(0);
      expect(estimateBody(s)).toBeLessThan(8000);
    }
  });
});

describe('a long table is drawn a few rows at a time', () => {
  it('a small table, and any table on paper, is drawn whole at once', () => {
    expect(firstRows(6, 6, false)).toBe(6);
    expect(firstRows(36, 36, true)).toBe(36);
  });

  it('a large table starts with a first chunk and reaches every row, a chunk at a time, none skipped and none past the end', () => {
    for (const [rows, cols] of [[36, 36], [24, 26], [40, 16], [30, 21]] as const) {
      let shown = firstRows(rows, cols, false);
      const seen = [shown];
      while (shown < rows) {
        const next = nextRows(shown, rows, cols);
        expect(next, `${rows}x${cols}`).toBeGreaterThan(shown);
        seen.push(next);
        shown = next;
      }
      expect(shown).toBe(rows);
      expect(seen[0] * cols, `${rows}x${cols}`).toBeLessThan(rows * cols);
      // Each chunk is a few hundred entries at most.
      for (let k = 1; k < seen.length; k++) expect((seen[k] - seen[k - 1]) * cols).toBeLessThanOrEqual(Math.max(4 * cols, 300));
    }
  });
});

describe('the sheet of a very long solution', () => {
  const big = BIG;
  const small = stepsOf();

  it('a short solution is printed whole; a very long one starts as a short sheet without the member-by-member assembly and the elimination', () => {
    expect(weightOf(small)).toBeLessThan(PRINT_BUDGET);
    expect(startScope(small)).toBe('all');
    expect(weightOf(big)).toBeGreaterThan(PRINT_BUDGET);
    expect(startScope(big)).toBe('short');
  });

  it('the short sheet leaves out exactly those steps, keeps every other, and is a small fraction of the entries; "all" keeps the sheet complete', () => {
    expect(printSteps(big, 'all')).toEqual(big);
    const short = printSteps(big, 'short');
    expect(short.some((s) => PRINT_SKIPPED.includes(s.id))).toBe(false);
    expect(short.length).toBe(big.filter((s) => !PRINT_SKIPPED.includes(s.id)).length);
    expect(short.length).toBeLessThan(big.length);
    expect(weightOf(short)).toBeLessThan(weightOf(big) / 5);
    // The results are all still there: the assembled K, the reduced equations, the displacements, the reactions, the end forces, the checks.
    for (const id of ['assembled', 'partition', 'displacements', 'reactions', 'end-forces', 'checks']) expect(short.some((s) => s.id === id), id).toBe(true);
  });
});

describe('numbers in the page’s own way, and the units the analysis was computed in', () => {
  it('writes a count with the page’s group mark: a comma on the English page, a narrow space on the Spanish one, never the browser’s locale', () => {
    expect(groupDigits(59130, ',')).toBe('59,130');
    expect(groupDigits(59130, ' ')).toBe('59 130');
    expect(groupDigits(999, ' ')).toBe('999');
    expect(groupDigits(1000, ',')).toBe('1,000');
    expect(groupDigits(1234567, ' ')).toBe('1 234 567');
  });

  it('the unit system of a solution is the one it was computed in - not whatever the form says now', () => {
    const us = analyseSafely(defaultStiffness());
    const si = analyseSafely(convertStiffness(defaultStiffness(), 'si'));
    expect(systemOf(us)).toBe('us');
    expect(systemOf(si)).toBe('si');
  });
});

describe('the switches under the drawing, across the structures opened', () => {
  const small = defaultStiffness();
  const many = girder('frame');

  it('the two automatic switches start as the size of the structure says', () => {
    expect(startShow(small)).toMatchObject({ memberNumbers: true, dofs: true });
    expect(startShow(many)).toMatchObject({ memberNumbers: false, dofs: false });
    expect(sizeClass(many)).toEqual({ members: false, nodes: false });
  });

  it('a switch the visitor turned off stays off when another structure of the same size opens (it was undone silently)', () => {
    let s = startShow(small);
    s = { ...s, nodeNumbers: false, memberNumbers: false, dofs: false, values: false };
    const after = showFor(tpl('frame-portal'), s);
    expect(after).toMatchObject({ nodeNumbers: false, memberNumbers: false, dofs: false, values: false });
  });

  it('crossing the size where a tag has no room switches it off by itself, and back on when the structure is small again', () => {
    let s = startShow(small);
    s = showFor(many, s);
    expect(s).toMatchObject({ memberNumbers: false, dofs: false });
    // The visitor turns the member numbers on for the big structure, and opens another big one: their choice stays.
    s = { ...s, memberNumbers: true };
    s = showFor(girder('truss'), s);
    expect(s.memberNumbers).toBe(true);
    // Back to a small structure: the rule acts again.
    s = showFor(small, s);
    expect(s).toMatchObject({ memberNumbers: true, dofs: true });
  });
});

describe('printing keeps the reader’s place', () => {
  it('names the element the screen is at (the last that reached the top), else the first one still below it', () => {
    expect(anchorFor([-900, -40, 5, 300, 800])).toEqual({ index: 2, offset: 5 });
    expect(anchorFor([-900, -40, 20, 300])).toEqual({ index: 1, offset: -40 });
    expect(anchorFor([120, 500, 900])).toEqual({ index: 0, offset: 120 });
    expect(anchorFor([])).toBeNull();
  });

  it('puts it back where it stood: the scroll that brings the element to the same distance from the top, never above the page', () => {
    // Before the print the card stood 12 px under the top. After it the page is shorter and the browser left the page at 1,964, where the card is 48 px under the top:
    // the page is moved by the difference, which puts the card 12 px under the top again.
    expect(scrollTarget(1964, 48, 12)).toBe(2000);
    expect(scrollTarget(10, -500, 0)).toBe(0);
  });
});

describe('bands on paper', () => {
  it('cuts a wide table into the fewest bands no wider than the most, as even as can be, covering every column once', () => {
    expect(bandsOf(36, 12)).toEqual([[0, 12], [12, 24], [24, 36]]);
    expect(bandsOf(36, 8)).toEqual([[0, 8], [8, 16], [16, 24], [24, 32], [32, 36]]);
    expect(bandsOf(10, 12)).toEqual([[0, 10]]);
    for (const total of [13, 18, 25, 36, 37]) {
      const bands = bandsOf(total, 12);
      expect(bands[0][0]).toBe(0);
      expect(bands[bands.length - 1][1]).toBe(total);
      bands.forEach(([from, to], k) => {
        expect(to - from).toBeLessThanOrEqual(12);
        if (k > 0) expect(from).toBe(bands[k - 1][1]);
      });
    }
  });
});

describe('a card that is not drawn is written again only when its words change', () => {
  const words = { label: '2.1', title: 'Geometry of member 1', paragraphs: ['Member 1 runs from node 1 to node 2.'], formulas: ['L = √(dx² + dy²)'] };
  const register = () => undefined;
  const card = (over: Partial<SameCardProps> = {}): SameCardProps => ({ view: { ...words }, step: { k: 1 }, ctx: { c: 1 }, form: 'both', zeros: 'light', open: true, near: false, register, current: false, ...over });

  it('the same words in a new object, far from the screen: the card is left as it is, whatever happened to the data it was made from', () => {
    // A number typed into the form solves the structure again: a new step, a new view, the same words.
    expect(sameCard(card(), card({ step: { k: 2 }, view: { ...words, paragraphs: [...words.paragraphs] } }))).toBe(true);
    expect(sameCard(card({ open: false }), card({ open: false, step: { k: 2 }, ctx: { c: 2 } }))).toBe(true);
  });

  it('other words, a number of the explanation changed: the card is written again', () => {
    expect(sameCard(card(), card({ view: { ...words, paragraphs: ['Member 1 runs from node 1 to node 3.'] } }))).toBe(false);
    expect(sameCard(card(), card({ view: { ...words, title: 'Geometry of member 2' } }))).toBe(false);
    expect(sameCard(card(), card({ view: { ...words, label: '2.2' } }))).toBe(false);
    expect(sameCard(card(), card({ view: { ...words, formulas: [] } }))).toBe(false);
    expect(sameCard(card(), card({ view: { ...words, paragraphs: [] } }))).toBe(false);
  });

  it('a card that comes near, opens, is closed, is the one the reader is at, or has another handler is written again, with the data of the moment', () => {
    expect(sameCard(card(), card({ near: true }))).toBe(false);
    expect(sameCard(card({ near: true }), card({ near: false }))).toBe(false);
    expect(sameCard(card({ open: false }), card({ open: true }))).toBe(false);
    expect(sameCard(card(), card({ current: true }))).toBe(false);
    expect(sameCard(card(), card({ register: () => undefined }))).toBe(false);
  });

  it('a card that draws its tables is written again when any of its data changed, and not when none did', () => {
    const drawn = (over: Partial<SameCardProps> = {}) => card({ near: true, ...over });
    const same = drawn();
    expect(sameCard(same, { ...same })).toBe(true);
    expect(sameCard(drawn(), drawn({ step: { k: 2 } }))).toBe(false);
    expect(sameCard(drawn(), drawn({ ctx: { c: 2 } }))).toBe(false);
    expect(sameCard(drawn(), drawn({ form: 'numbers' }))).toBe(false);
    expect(sameCard(drawn(), drawn({ zeros: 'dot' }))).toBe(false);
    expect(sameCard(drawn(), drawn({ view: { ...words, paragraphs: ['x'] } }))).toBe(false);
  });

  it('on a real structure a number typed into a coordinate rewrites the words of few of its cards: the rest are the same', () => {
    const base = defaultStiffness();
    const edited = reduceStiffness(base, { type: 'patch', list: 'nodes', id: base.nodes[2].id, patch: { y: 7 } });
    // The same steps, solved for the two structures, written as the page writes them: the explanation of each, with this structure's numbers.
    const a = stepsOf(base);
    const b = stepsOf(edited);
    expect(b.map((s) => s.key)).toEqual(a.map((s) => s.key));
    const w = stiffnessUi.en;
    const textOf = (s: (typeof a)[number], all: typeof a) => {
      const view = stepView(s, labelsOf(all), { w, system: 'us', mode: 'truss', format: { sig: 4, style: 'auto', group: ',' } });
      return { label: view.label, title: view.title, paragraphs: view.paragraphs, formulas: view.formulas };
    };
    const unchanged = a.filter((s, k) => sameWords(textOf(s, a), textOf(b[k], b))).length;
    expect(unchanged).toBeGreaterThan(a.length / 2);
    expect(unchanged).toBeLessThan(a.length);
  });
});

describe('which analysis the worked solution is written from', () => {
  const fresh = { id: 'just solved' };
  const deferred = { id: 'a moment ago' };

  it('on screen the deferred one, and it is behind while it is not the fresh one', () => {
    expect(solutionOf({ fresh, deferred, onPaper: false })).toEqual({ analysis: deferred, behind: true });
    expect(solutionOf({ fresh, deferred: fresh, onPaper: false })).toEqual({ analysis: fresh, behind: false });
  });

  it('on paper always the one just solved - a sheet is never printed with the numbers of the structure before - and never behind', () => {
    expect(solutionOf({ fresh, deferred, onPaper: true })).toEqual({ analysis: fresh, behind: false });
    expect(solutionOf({ fresh, deferred, onPaper: true }).analysis).toBe(fresh);
  });
});
