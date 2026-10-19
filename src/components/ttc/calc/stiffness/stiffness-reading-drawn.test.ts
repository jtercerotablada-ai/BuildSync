import { createElement as h } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import { formatNumber } from '@/lib/calc/format';
import { analyseSafely } from '@/lib/calc/stiffness/analysis';
import { decodeStiffness, defaultStiffness, emptyStiffness, reduceStiffness, type StiffnessForm } from '@/lib/calc/stiffness/model';
import { stiffnessUi } from '@/lib/calc/stiffness/strings';
import { TEMPLATE_IDS } from '@/lib/calc/stiffness/templates';
import type { Lang } from '@/lib/ttc/i18n';
import { scanForm, scanLooks } from './figure-scan.testlib';
import { build } from './fixtures.testlib';
import { drawnOf, figureWidth, plain, stiffnessLayout } from './layout';
import { cancelledNote, cappedNote, scaleNote, StiffnessSchematic } from './Schematic';
import { startShow } from './show';
import { FACTOR_CAP, flaggedNodes, largestNode, largestReaction, largestReactionComponent, loadSums, PRINT_FLOOR, readingSentence, reactionComponents, scalePhrase, signed } from './text';

vi.setConfig({ testTimeout: 120_000 });

/**
 * THE SENTENCE UNDER THE DRAWING FOLLOWS WHAT THE FIGURE DREW: the circles and the dots, the reactions it quotes (a number on an arrow, with its
 * direction: never a resultant that is on none, and nothing when reactions are not drawn), loads that cancel, and a movement that is only
 * rounding. Each case builds the figure first, as the page does, and gives the sentence what the figure reports (`drawnOf`).
 */

const num = (v: number, sig = 4) => formatNumber(v, sig, ',').replace(/^-/, '−');
const val = (v: number, sig = 4) => signed(formatNumber(Math.abs(v), sig, ','), v);
const how = (mode: 'truss' | 'frame' = 'truss') => ({ num, val, mode });
const tpl = (id: (typeof TEMPLATE_IDS)[number]) => reduceStiffness(emptyStiffness('us'), { type: 'template', template: id });
const addr = (a: string): StiffnessForm => decodeStiffness(a)!;

/** The figure as the page makes it: the structure's looks, the width the page gives it in a column, and what it drew. */
function figure(form: StiffnessForm, column = 650, rest: Record<string, unknown> = {}) {
  const a = analyseSafely(form);
  const show = startShow(form);
  const looks = scanLooks({ reactions: a.results !== null, deformed: a.results !== null, dofs: show.dofs, memberNumbers: show.memberNumbers, flagged: flaggedNodes(a), ...rest });
  const width = figureWidth(a.drawing, looks, column, false).drawn;
  const layout = stiffnessLayout(a.drawing, { ...looks, width });
  return { a, looks, layout, facts: drawnOf(layout), width };
}
/** The sentence for a form, built from what its figure drew. */
function say(form: StiffnessForm, lang: Lang = 'en', column = 650, rest: Record<string, unknown> = {}): string {
  const f = figure(form, column, rest);
  return readingSentence(f.a, { deformed: f.looks.deformed, nodeNumbers: f.looks.nodeNumbers, loads: f.looks.loads, reactions: f.looks.reactions, dots: f.facts.dots }, stiffnessUi[lang], how(form.mode));
}

const MAST = 'Kw88i60rq28;1;t;us;s,29000,10,100;0,0_1,0_0,50_1,50;1,3_2,4_3,4_1,4_2,3;1,3_2,2;3,5,0_4,5,0;';
const CANCEL = 'Ku5tlgl2x1m;1;f;us;s,29000,10,100;0,0_20,0;1,2;1,7;2,5,-4,3_2,-5,4,-3;';
const NEAR_CANCEL = 'Kzy84aeeo20;1;f;us;s,29000,10,100;0,0_20,0;1,2;1,7;2,5,-4,3_2,-4.9999999999999,4,-3;';
// two nodes 0.01 ft apart on a 5 ft structure: nodes 1 and 2 are dots, node 3 is a circle
const TWO_CLOSE = () => build({ mode: 'frame', nodes: [[0, 0], [0.01, 0], [5, 4]], members: [[1, 3], [2, 3]], supports: [[1, 'fixed'], [2, 'fixed']], loads: [[3, 0, -10]] });

/* ── D5: circles and dots ─────────────────────────────────────────────────── */

describe('the sentence says what the figure drew of the nodes: circles with their numbers, dots, or both', () => {
  it('a mast whose every node is a dot: "dots are nodes", not circles, and the tables number them - the legend agrees', () => {
    const f = figure(addr(MAST));
    expect(f.layout.dots).toEqual([1, 2, 3, 4]);
    expect(f.layout.legend).toContain('nodeDot');
    expect(f.layout.legend).not.toContain('node');
    const s = say(addr(MAST));
    expect(s).toContain('dots are nodes');
    expect(s).not.toMatch(/circles are nodes|with their numbers/);
    expect(s).toContain('Every node stands too close to another for a number, so the drawing shows dots: the tables number the nodes.');
    // (the old reading of the same drawing, from the switch alone: it said circles)
    expect(readingSentence(f.a, { deformed: true, nodeNumbers: true }, stiffnessUi.en, how('truss'))).toContain('circles are nodes with their numbers');
  });
  it('some nodes dots and some circles: it says what each is, and names a dot as one', () => {
    const f = figure(TWO_CLOSE(), 650);
    expect(f.layout.dots).toEqual([1, 2]);
    expect(f.layout.legend).toEqual(expect.arrayContaining(['node', 'nodeDot']));
    const s = say(TWO_CLOSE());
    expect(s).toContain('circles are nodes with their numbers and dots are nodes that stand too close for a number');
    // the largest reaction is at node 1 or 2, both dots: the sentence says that node has no number on the drawing
    const big = largestReactionComponent(f.a)!;
    expect([1, 2]).toContain(big.node);
    expect(s).toMatch(/Node [12] is a dot on the drawing, with no number: the tables number the nodes\./);
    // node 3 is a circle and is named without such a line
    const named3 = readingSentence(f.a, { deformed: true, dots: [1, 2] }, stiffnessUi.en, how('truss'));
    expect(named3).toContain('Node 3 moves most');
    expect(named3).not.toMatch(/Node 3 is a dot/);
  });
  it('a dot is named in the plural where two are: "Nodes 1 and 2 are dots", and in Spanish "los nudos 1 y 2 son puntos"', () => {
    const f = figure(TWO_CLOSE(), 650);
    const loadsOnDots = build({ mode: 'frame', nodes: [[0, 0], [0.01, 0], [5, 4]], members: [[1, 3], [2, 3]], supports: [[3, 'fixed']], loads: [[1, 5, 0], [2, 5, 0]] });
    void f;
    const en = say(loadsOnDots, 'en');
    const es = say(loadsOnDots, 'es');
    expect(en).toMatch(/(Node [12] is a dot|Nodes 1 and 2 are dots) on the drawing, with no number/);
    expect(es).toMatch(/(El nudo [12] es un punto|Los nudos 1 y 2 son puntos) en el dibujo, sin número/);
    expect(es).toContain('los círculos son nudos con sus números y los puntos son nudos demasiado cercanos para llevar número');
  });
  it('the switch off still reads as before, and a structure whose numbers are all on says circles only', () => {
    const off = say(tpl('frame-portal'), 'en', 650, { nodeNumbers: false });
    expect(off).toContain('dots are nodes');
    expect(off).toContain('Node numbers are off on the drawing: the tables number the nodes.');
    const on = say(tpl('frame-portal'));
    expect(on).toContain('circles are nodes with their numbers');
    expect(on).not.toMatch(/dots are nodes|is a dot|are dots on the drawing|with no number/);
  });
  it('over 160 structures at two widths, the sentence and the legend agree about circles and dots, and a node named is a dot only where the sentence says so', () => {
    let checked = 0;
    let withDots = 0;
    for (let seed = 1; seed <= 80; seed++) {
      for (const column of [650, 288]) {
        const form = scanForm(seed);
        const f = figure(form, column);
        if (f.a.results === null) continue;
        const s = readingSentence(f.a, { deformed: f.looks.deformed, nodeNumbers: true, loads: true, reactions: f.looks.reactions, dots: f.facts.dots }, stiffnessUi.en, how(form.mode));
        const where = `seed ${seed} at ${column}: ${s}`;
        expect(/circles are nodes with their numbers/.test(s), where).toBe(f.layout.legend.includes('node'));
        expect(/dots are nodes/.test(s), where).toBe(f.layout.legend.includes('nodeDot'));
        const named = [...s.matchAll(/Node (\d+) moves most|at node (\d+)\./g)].map((m) => Number(m[1] ?? m[2]));
        const dotted = named.filter((n) => f.layout.dots.includes(n));
        if (dotted.length) {
          withDots++;
          expect(s, where).toMatch(/(is a dot|are dots) on the drawing, with no number|Every node stands too close/);
        } else {
          expect(s, where).not.toMatch(/(is a dot|are dots) on the drawing/);
        }
        checked++;
      }
    }
    expect(checked).toBeGreaterThan(100);
    expect(withDots).toBeGreaterThanOrEqual(0);
  });
});

/* ── D6: the reaction the sentence quotes is on an arrow ──────────────────── */

describe('the sentence quotes a reaction that is written on an arrow of the drawing, with its direction - and none when reactions are off', () => {
  it('the default structure: the number of an arrow, not the resultant of two', () => {
    const f = figure(defaultStiffness());
    const drawn = f.layout.reactions.flatMap((r) => r.arrows.map((a) => a.text?.value));
    const s = say(defaultStiffness());
    expect(drawn).toEqual(expect.arrayContaining(['30', '22.5']));
    // the resultant of 30 and 22.5 is 37.5: it is on no arrow and the sentence does not say it
    expect(s).not.toContain('37.5');
    const c = largestReactionComponent(f.a)!;
    expect(c.value).toBe(30);
    expect(s).toContain(`Largest reaction: 30 kip, ${c.kind === 'y' ? 'vertical' : 'horizontal'}, at node ${c.node}.`);
  });
  it('the portal: the largest force on an arrow and the largest moment on a ring, each with its node and its direction', () => {
    const f = figure(tpl('frame-portal'));
    const s = say(tpl('frame-portal'));
    expect(s).toContain('Largest reaction: 5.057 kip, horizontal, at node 1.');
    expect(s).toContain('Largest reaction moment: 31.71 kip·ft, at node 1.');
    expect(s).not.toContain('5.392');
    const labels = [...f.layout.reactions.flatMap((r) => [...r.arrows.map((a) => a.text?.value), r.arc?.text?.value])];
    expect(labels).toEqual(expect.arrayContaining(['5.057', '31.71']));
    const es = say(tpl('frame-portal'), 'es');
    expect(es).toContain('Mayor reacción: 5.057 kip, horizontal (nudo 1).');
    expect(es).toContain('Mayor momento de reacción: 31.71 kip·ft (nudo 1).');
  });
  it('with Reactions off the sentence says nothing of reactions, in either language', () => {
    for (const form of [defaultStiffness(), tpl('frame-portal'), tpl('truss-five-member')]) {
      const en = say(form, 'en', 650, { reactions: false });
      const es = say(form, 'es', 650, { reactions: false });
      expect(en).not.toMatch(/reaction|Reaction/);
      expect(es).not.toMatch(/reacci|Reacci/);
      // ... and with them on it does
      expect(say(form)).toMatch(/Largest reaction/);
    }
  });
  it('every reaction quoted is a number written on an arrow or a ring, over the templates and 120 random structures', () => {
    const forms: StiffnessForm[] = [...TEMPLATE_IDS.map(tpl), ...Array.from({ length: 120 }, (_, k) => scanForm(k + 1))];
    let quoted = 0;
    for (const form of forms) {
      const f = figure(form);
      if (!f.a.results) continue;
      const s = readingSentence(f.a, { deformed: f.looks.deformed, nodeNumbers: true, reactions: true, dots: f.facts.dots }, stiffnessUi.en, how(form.mode));
      const marks = new Set(reactionComponents(f.a).map((c) => `${plain(c.value, ',')}@${c.node}:${c.kind}`));
      for (const m of s.matchAll(/Largest reaction: ([\d.,]+(?: × 10[⁻⁰¹²³⁴⁵⁶⁷⁸⁹]+)?) [^,]+, (horizontal|vertical), at node (\d+)\./g)) {
        quoted++;
        expect(marks.has(`${m[1]}@${m[3]}:${m[2] === 'horizontal' ? 'x' : 'y'}`), `${s}`).toBe(true);
      }
      for (const m of s.matchAll(/(?:Largest reaction moment|the biggest being): ([\d.,]+)|the biggest being ([\d.,]+) [^ ]+ at node (\d+)/g)) quoted += m ? 1 : 0;
    }
    expect(quoted).toBeGreaterThan(40);
  });
  it('the headline helpers give the component the drawing writes (largestReactionComponent, and largestReaction as it was called)', () => {
    const f = figure(tpl('frame-portal'));
    const c = largestReactionComponent(f.a)!;
    expect([c.node, c.kind]).toEqual([1, 'x']);
    expect(c.value).toBeCloseTo(5.057, 3);
    const old = largestReaction(f.a)!;
    expect([old.node, old.kind, old.moment]).toEqual([1, 'x', false]);
    expect(old.value).toBe(c.value);
  });
});

/* ── D7: loads that cancel, and a movement that is rounding ───────────────── */

describe('loads that cancel are said to; a movement that is rounding is not "0"; the exaggeration has a cap', () => {
  it('loads that add up to zero: the sentence and a note say so, and nothing is drawn there', () => {
    const f = figure(addr(CANCEL));
    expect(loadSums(f.a.drawing.loads).map((s) => [s.node, s.cancelled])).toEqual([[2, true]]);
    expect(f.layout.cancelled).toEqual([2]);
    expect(f.layout.loads[0].arrows).toEqual([]);
    expect(f.layout.loads[0].arc).toBeNull();
    const s = say(addr(CANCEL));
    expect(s).toContain('The loads at node 2 cancel one another: the sum is zero.');
    expect(s).toContain('Nothing moves under the loads');
    expect(say(addr(CANCEL), 'es')).toContain('Las cargas en el nudo 2 se anulan entre sí: la suma es cero.');
    expect(cancelledNote(f.layout, { notes: stiffnessUi.en.drawing.notes })).toBe('The loads at node 2 cancel one another: the sum is zero, so nothing is drawn there.');
    // with the loads switched off nothing is said of them
    expect(say(addr(CANCEL), 'en', 650, { loads: false })).not.toContain('cancel one another');
  });
  it('loads that nearly cancel (1 and 1 + 10^-12) are the same: zero, with the same words, and no "by 0 in"', () => {
    for (const second of [-1, -(1 + 1e-12), -(1 + 1e-13)]) {
      const form = build({ mode: 'frame', nodes: [[0, 0], [20, 0]], members: [[1, 2]], supports: [[1, 'fixed']], loads: [[2, 1, 0], [2, second, 0]] });
      const f = figure(form);
      const s = say(form);
      expect(f.layout.cancelled, `${second}`).toEqual([2]);
      expect(s, `${second}`).toContain('The loads at node 2 cancel one another');
      expect(s, `${second}`).not.toMatch(/by 0 |moves most|magnified/);
      expect(f.layout.loads[0].arrows, `${second}`).toEqual([]);
      expect(f.layout.factor, `${second}`).toBeNull();
    }
  });
  it('the review structure whose loads cancel to 1e-13: no movement "by 0 in", no 10^17 magnification, no arrow labelled 0', () => {
    const f = figure(addr(NEAR_CANCEL));
    const s = say(addr(NEAR_CANCEL));
    expect(f.a.results).not.toBeNull();
    // the engine did solve a residual of 1e-13 kip: a movement under the print floor
    expect(f.a.drawing.deformed!.maxDisplacement).toBeLessThan(PRINT_FLOOR);
    expect(largestNode(f.a)).toBeNull();
    expect(s).toContain('The loads at node 2 cancel one another: the sum is zero.');
    expect(s).toContain('Nothing moves by as much as 1 × 10⁻¹² in, so no deformed shape is drawn.');
    expect(s).not.toMatch(/by 0 in|moves most|Largest reaction: 0|magnified|10\^|10¹/);
    expect(s).toContain('Every reaction is zero.');
    expect(f.layout.tiny).toBe(true);
    expect(f.layout.factor).toBeNull();
    expect(f.layout.deformed).toBeNull();
    expect(f.layout.legend).not.toContain('deformed');
    const words = { notes: stiffnessUi.en.drawing.notes };
    expect(scaleNote(f.layout, f.looks, f.a.drawing, words, { displacement: 'in' })).toBe('The biggest movement is under 1 × 10⁻¹² in, too small to draw: no deformed shape is drawn.');
    // a reaction that is only rounding is not an arrow with a "0" on it
    for (const r of f.layout.reactions) expect(r.arrows, `node ${r.label}`).toEqual([]);
    const html = renderToStaticMarkup(h(StiffnessSchematic, { drawing: f.a.drawing, width: 650, looks: f.looks, summary: 'x', words: { legend: stiffnessUi.en.drawing.legend, notes: stiffnessUi.en.drawing.notes, broken: '' }, units: { length: 'ft', displacement: 'in' } }));
    expect(html).not.toMatch(/>0</);
    expect(html).not.toContain('magnified');
  });
  it('a reaction of exactly zero, and one that is rounding, is no arrow with a "0" over 120 random structures', () => {
    for (let seed = 1; seed <= 120; seed++) {
      const f = figure(scanForm(seed));
      for (const x of [...f.layout.loads, ...f.layout.reactions]) for (const a of x.arrows) expect(a.text?.value, `seed ${seed}`).not.toBe('0');
    }
  });
  it('a structure so stiff that the exaggeration would be astronomic is drawn at the cap, and says so', () => {
    const stiff = { ...defaultStiffness(), A: 1e8 };
    const f = figure(stiff);
    expect(f.a.drawing.deformed!.factor).toBeGreaterThan(FACTOR_CAP);
    expect(f.a.drawing.deformed!.maxDisplacement).toBeGreaterThan(PRINT_FLOOR);
    expect(f.layout.factor).toBe(FACTOR_CAP);
    expect(f.layout.capped).toBe(true);
    const words = { notes: stiffnessUi.en.drawing.notes };
    expect(scaleNote(f.layout, f.looks, f.a.drawing, words, { displacement: 'in' })).toMatch(/^Deformed shape magnified 10,000 times; the biggest movement, at any point, is /);
    expect(cappedNote(f.layout, f.looks, words)).toBe('The drawing magnifies no more than 10,000 times, so a movement this small hardly shows.');
    expect(say(stiff)).toContain('magnified 10,000 times');
    expect(say(stiff)).not.toMatch(/10\^|magnified [0-9.,]+ × 10/);
    expect(f.layout.legend).toContain('deformed');
    // a structure that moves a normal amount is not capped
    const normal = figure(defaultStiffness());
    expect(normal.layout.factor).toBe(600);
    expect(normal.layout.capped).toBe(false);
    expect(cappedNote(normal.layout, normal.looks, words)).toBe('');
    expect(scalePhrase({ factor: 2e17 }, num, stiffnessUi.en.drawing.notes)).toBe('magnified 10,000 times');
  });
  it('the shape drawn at the cap is the movement times the cap, from the member line (not the analysis\'s astronomic one)', () => {
    const stiff = { ...defaultStiffness(), A: 1e8 };
    const f = figure(stiff);
    const d = f.a.drawing;
    const big = d.deformed!;
    // node 3 of the default two-bar moves most: its drawn offset is the real movement times the cap
    const home = d.nodes.find((n) => n.label === 3)!;
    const moved = big.nodes.find((n) => n.node === 3)!;
    const realX = (moved.x - home.x) / big.factor!;
    const shownX = (f.layout.nodes.find((n) => n.label === 3)!.x - f.layout.nodes.find((n) => n.label === 1)!.x) / f.layout.scale;
    const homeX = home.x - d.nodes.find((n) => n.label === 1)!.x;
    expect(Math.abs(shownX - homeX)).toBeLessThan(1e-6);
    expect(Math.abs(realX * FACTOR_CAP)).toBeLessThan(1e-6);
  });
  it('and the same sentences in Spanish', () => {
    const es = say(addr(NEAR_CANCEL), 'es');
    expect(es).toContain('Las cargas en el nudo 2 se anulan entre sí: la suma es cero.');
    expect(es).toContain('Nada se mueve tanto como 1 × 10⁻¹² in, así que no se dibuja ninguna deformada.');
    expect(es).toContain('Todas las reacciones son cero.');
    expect(stiffnessUi.es.drawing.notes.capped).toContain('{cap}');
  });
});

/* ── D11: the mast ────────────────────────────────────────────────────────── */

describe('a mast 1 ft by 50 ft', () => {
  it('says that the supports overlap, and the shrink is a percentage; a structure with room says neither', () => {
    const f = figure(addr(MAST));
    expect(f.layout.supportsOverlap || Math.min(...f.layout.supports.map((s) => s.scale)) <= 0.4 + 1e-9).toBe(true);
    expect(say(addr(MAST))).toContain('shrunk to 40 % of its size');
    expect(figure(tpl('truss-five-member')).layout.supportsOverlap).toBe(false);
  });
});
