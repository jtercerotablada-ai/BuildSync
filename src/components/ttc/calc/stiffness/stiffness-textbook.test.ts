import { describe, expect, it } from 'vitest';
import { emptyStiffness, reduceStiffness, type UnitSystem } from '@/lib/calc/stiffness/model';
import { stiffnessUi } from '@/lib/calc/stiffness/strings';
import { analyseSafely } from '@/lib/calc/stiffness/analysis';
import { TEMPLATE_IDS } from '@/lib/calc/stiffness/templates';
import type { Lang } from '@/lib/ttc/i18n';
import { INEXTENSIBLE, TOLERANCE, answerLine, checkTextbook, compareValues, gapText, textbookOf, toolValues, unitOfAnswer, verdictLine, type TextbookCheck } from './textbook';

/**
 * THE TEXTBOOK ANSWERS, which are the tool's own proof that it is right: seven problems with an answer a student finds by hand, written out as
 * formulas of the problem's numbers, and the check that the engine - which knows nothing of them - lands on the same values.
 */

const LANGS: Lang[] = ['en', 'es'];
const noise = /NaN|undefined|Infinity|\[object|(?:^|[\s>(=])-0(?![.\d])|−0(?![.\d])|\be[+-]\d|\{[a-zA-Z]+(\|[^}]*)?\}/;
const num = (v: number, sig = 4) => String(Number(v.toPrecision(sig))).replace('-', '−');
const close = (got: number, want: number) => expect(got).toBeCloseTo(want, 9);

describe('the answers as a student finds them by hand', () => {
  it('two-bar truss: forces from two equations of equilibrium at the loaded node', () => {
    const a = textbookOf('truss-two-bar', 'us');
    expect(a).toEqual({ N1: -12.5, N2: -37.5, R1x: 10, R1y: 7.5, R2x: -30, R2y: 22.5 });
    // Equilibrium of the whole truss: the reactions cancel the load (20, −30), and their moment about node 1 cancels the load’s.
    close(a.R1x + a.R2x + 20, 0);
    close(a.R1y + a.R2y - 30, 0);
    close(a.R2y * 16 - 30 * 8 - 20 * 6, 0);
  });

  it('three-bar truss (indeterminate): the vertical bar takes 5000/179 of the 40 kip, the inclined ones 1800/179', () => {
    const a = textbookOf('truss-three-bar', 'us');
    close(a.Nv, 5000 / 179);
    close(a.Ni, 1800 / 179);
    // Vertical equilibrium of the loaded node: the vertical bar plus the vertical parts of the two inclined ones (3-4-5 triangles) carry 40.
    close(a.Nv + 2 * a.Ni * 0.6 - 40, 0);
    expect(a.drop).toBeGreaterThan(0);
    expect(a.drop).toBeLessThan(0.01);
  });

  it('five-bar truss: the method of joints', () => {
    const a = textbookOf('truss-five-member', 'us');
    expect(a).toEqual({ N1: -4, N2: 20, N3: -20, N4: 20, N5: -25, R1x: -12, R1y: -12, R2y: 27 });
    close(a.R1y + a.R2y - 15, 0);
    close(a.R1x + 12, 0);
  });

  it('propped cantilever under a uniform load: 5wL/8 at the wall, 3wL/8 at the prop, wL²/8 of moment', () => {
    const a = textbookOf('frame-propped', 'us');
    close(a.Rl, 15);
    close(a.Rr, 9);
    close(a.Ml, 60);
    close(a.Rl + a.Rr, 1.2 * 20);
    // In metric units the same formulas, with the metric span and load.
    const si = textbookOf('frame-propped', 'si');
    close(si.Rl, 75);
    close(si.Rr, 45);
    close(si.Ml, 90);
    expect(si.theta).toBeGreaterThan(0);
  });

  it('L-shaped frame: the wall carries the whole load, and the moment of the load about the wall', () => {
    const a = textbookOf('frame-l', 'us');
    expect(a).toEqual({ Rx: 0, Ry: 10, Mb: 50, Nc: -10 });
  });

  it('portal frame with rigid columns: half the side load in each foot, moments from the stiffness ratio', () => {
    const a = textbookOf('frame-portal', 'us');
    close(a.H, 5);
    close(a.Mf, 31.25);
    close(a.Mt, 18.75);
    close(a.Vr, 1.875);
    close(a.Vl, -1.875);
    // Moment equilibrium of the whole frame: the side load at the beam’s height against the feet’s moments and the vertical pair.
    close(10 * 10 - 2 * a.Mf - a.Vr * 20, 0);
  });

  it('beam fixed at both ends under a point load: Pab²/L², Pa²b/L², and the two shears', () => {
    const a = textbookOf('frame-fixed-point', 'us');
    close(a.Ml, 57.6);
    close(a.Mr, -38.4);
    close(a.Rl, 12.96);
    close(a.Rr, 7.04);
    close(a.Rl + a.Rr, 20);
  });

  it('every answer is a finite number with a unit class, in either unit system', () => {
    for (const id of TEMPLATE_IDS) {
      for (const units of ['us', 'si'] as UnitSystem[]) {
        const a = textbookOf(id, units);
        expect(Object.keys(a).length, `${id} ${units}`).toBeGreaterThan(2);
        for (const [key, v] of Object.entries(a)) {
          expect(Number.isFinite(v), `${id} ${units} ${key}`).toBe(true);
          expect(['force', 'moment', 'rotation', 'small']).toContain(unitOfAnswer(key));
        }
      }
    }
  });
});

describe('the tool against the textbook', () => {
  for (const id of TEMPLATE_IDS) {
    it(`${id}: the engine lands on the hand answer, value by value, in both unit systems`, () => {
      for (const units of ['us', 'si'] as UnitSystem[]) {
        const c = checkTextbook(id, units);
        const where = `${id} ${units}`;
        expect(c.got, where).not.toBeNull();
        expect(Object.keys(c.got!).sort(), where).toEqual(Object.keys(c.expected).sort());
        expect(c.worst, where).toBeLessThanOrEqual(c.tolerance);
        expect(c.agrees, where).toBe(true);
        expect(c.tolerance, where).toBe(TOLERANCE[id]);
        expect(c.inextensible, where).toBe(INEXTENSIBLE[id]);
      }
    });
  }

  it('the portal is the one place the two differ in method, by a few thousandths and not by a rounding error; every other problem agrees to the figures', () => {
    const portal = checkTextbook('frame-portal', 'us');
    expect(portal.worst).toBeGreaterThan(1e-4);
    expect(portal.worst).toBeLessThan(0.03);
    expect(portal.tolerance).toBe(0.03);
    expect(portal.inextensible).toBe(true);
    for (const id of TEMPLATE_IDS.filter((x) => x !== 'frame-portal')) {
      expect(INEXTENSIBLE[id], id).toBe(false);
      expect(TOLERANCE[id], id).toBe(1e-6);
      expect(checkTextbook(id, 'us').worst, id).toBeLessThan(1e-9);
    }
  });

  it('is held against the problem alone: the same object comes back for the same question, and a fresh solve gives the same numbers', () => {
    expect(checkTextbook('frame-l', 'us')).toBe(checkTextbook('frame-l', 'us'));
    const again = toolValues('frame-l', analyseSafely(reduceStiffness(emptyStiffness('us'), { type: 'template', template: 'frame-l' })));
    expect(again).toEqual(checkTextbook('frame-l', 'us').got);
  });

  it('says nothing for a structure that was not solved', () => {
    expect(toolValues('truss-two-bar', analyseSafely(emptyStiffness()))).toBeNull();
  });

  it('would catch a wrong engine: a value off by more than the tolerance is a difference, a missing one is the largest', () => {
    const want = textbookOf('truss-two-bar', 'us');
    expect(compareValues(want, want)).toBe(0);
    expect(compareValues(want, { ...want, N2: want.N2 * 1.05 })).toBeCloseTo((0.05 * 37.5) / 37.5, 9);
    expect(compareValues(want, { ...want, N1: Number.NaN })).toBe(Infinity);
    const { N1: _gone, ...rest } = want;
    void _gone;
    expect(compareValues(want, rest)).toBe(Infinity);
    // A force is judged against the largest force, a moment against the largest moment: a small moment is not judged by a big force.
    expect(compareValues({ N1: 1000, Ml: 1 }, { N1: 1000, Ml: 1.1 })).toBeCloseTo(0.1, 9);
    expect(compareValues({ N1: 1000, Ml: 1 }, { N1: 1001, Ml: 1 })).toBeCloseTo(0.001, 9);
  });
});

describe('the sentences about the answers', () => {
  const units = { us: { force: 'kip', moment: 'kip·ft', displacement: 'in' }, si: { force: 'kN', moment: 'kN·m', displacement: 'mm' } };
  for (const id of TEMPLATE_IDS) {
    it(`${id}: the textbook’s line and the tool’s line carry every value in a hole, and the units, in both languages`, () => {
      for (const lang of LANGS) {
        const w = stiffnessUi[lang];
        for (const system of ['us', 'si'] as UnitSystem[]) {
          const c = checkTextbook(id, system);
          const where = `${id} ${system} ${lang}`;
          const book = answerLine(w, id, c.expected, units[system], num);
          const tool = answerLine(w, id, c.got!, units[system], num);
          expect(book, where).not.toMatch(noise);
          expect(tool, where).not.toMatch(noise);
          expect(book, where).toContain(units[system].force);
          // The two sentences are the same sentence about two sets of numbers, and the numbers agree to the figures shown.
          const frame = (line: string) => line.replace(/[−\d.]+/g, '#');
          expect(frame(tool), where).toBe(frame(book));
          for (const [key, v] of Object.entries(c.expected)) {
            const shown = num(v);
            expect(book.includes(shown) || key === 'Rx' || v === 0, `${where} ${key} = ${shown} in "${book}"`).toBe(true);
          }
        }
      }
    });
  }

  it('the portal’s moments are sizes, and the sentence says so; the two-bar sentence has bars and reactions, word for word', () => {
    const c = checkTextbook('frame-portal', 'us');
    const en = answerLine(stiffnessUi.en, 'frame-portal', c.expected, units.us, num);
    expect(en).toContain('31.25');
    expect(en).toContain('18.75');
    expect(en).toMatch(/in size/);
    expect(answerLine(stiffnessUi.es, 'frame-portal', c.expected, units.us, num)).toMatch(/en magnitud/);
    expect(answerLine(stiffnessUi.en, 'truss-two-bar', checkTextbook('truss-two-bar', 'us').expected, units.us, num)).toBe(
      'bar 1 carries −12.5 kip and bar 2 −37.5 kip (a minus sign is compression); the reactions are (10, 7.5) kip at node 1 and (−30, 22.5) kip at node 2.',
    );
    expect(answerLine(stiffnessUi.es, 'truss-two-bar', checkTextbook('truss-two-bar', 'us').expected, units.us, num)).toContain('barra 1');
  });

  it('how far apart is a share of the largest value, or a percent once it is a few thousandths', () => {
    expect(gapText(1e-6, ',')).toBe('1 × 10^−6');
    expect(gapText(0.03, ',')).toBe('3 %');
    expect(gapText(0.0125, ',')).toBe('1.3 %');
    expect(gapText(2.3e-4, ',')).toBe('2.3 × 10^−4');
    expect(gapText(1.234e-9, ',')).toBe('1.2 × 10^−9');
    expect(gapText(0, ',')).toBe('0');
  });

  it('the verdict: agrees (to what), differs (by how much), could not be solved; and the portal’s reason, once', () => {
    const base: TextbookCheck = { expected: { N1: 1 }, got: { N1: 1 }, worst: 0, tolerance: 1e-6, agrees: true, inextensible: false };
    expect(verdictLine(stiffnessUi.en, base, ',')).toBe('The check passes: the tool solved this problem and every value agrees with the textbook’s to within 1 × 10^−6 of the largest value of its kind.');
    const bad: TextbookCheck = { ...base, got: { N1: 1.1 }, worst: 0.1, agrees: false };
    const said = verdictLine(stiffnessUi.en, bad, ',');
    expect(said).toContain('10 %');
    expect(said).not.toContain('The check passes');
    expect(said).not.toMatch(noise);
    const none: TextbookCheck = { ...base, got: null, worst: Infinity, agrees: false };
    expect(verdictLine(stiffnessUi.en, none, ',')).toBe(stiffnessUi.en.template.unsolved);
    const portal = verdictLine(stiffnessUi.en, checkTextbook('frame-portal', 'us'), ',');
    expect(portal).toContain('to within 3 %');
    expect(portal.endsWith(stiffnessUi.en.template.inextensible)).toBe(true);
    expect(portal.split(stiffnessUi.en.template.inextensible).length).toBe(2);
    expect(verdictLine(stiffnessUi.en, checkTextbook('truss-two-bar', 'us'), ',')).not.toContain(stiffnessUi.en.template.inextensible);
    for (const lang of LANGS) for (const id of TEMPLATE_IDS) expect(verdictLine(stiffnessUi[lang], checkTextbook(id, 'us'), ','), `${lang} ${id}`).not.toMatch(noise);
  });
});
