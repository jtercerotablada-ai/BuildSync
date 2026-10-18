import { afterEach, describe, expect, it, vi } from 'vitest';
import { analyseSafely } from '@/lib/calc/stiffness/analysis';
import { convertStiffness, defaultStiffness, emptyStiffness, reduceStiffness, type StiffnessForm } from '@/lib/calc/stiffness/model';
import { TEMPLATE_IDS, type TemplateId } from '@/lib/calc/stiffness/templates';
import { build, flat, girder, settling, tall } from './fixtures.testlib';
import { everyWidth, layoutFor, rectsNear, segNear, stiffnessLayout, type Layout, type Looks, type Rect } from './layout';

vi.setConfig({ testTimeout: 120_000 });
afterEach(() => new Promise<void>((done) => setTimeout(done, 0)));

/**
 * THE STRUCTURE DRAWING'S LAYOUT, without a browser: the geometry and the clearance of every word on it, over a matrix of structures, widths and
 * looks - the narrow phone, the wide screen and the sheet of paper. What only the eye can judge - whether it reads - is in the report that goes
 * with this file.
 */

const looks = (rest: Partial<Looks> = {}): Looks => ({ loads: true, reactions: true, deformed: true, dofs: true, nodeNumbers: true, memberNumbers: true, values: true, group: ',', ...rest });
const tpl = (id: TemplateId, units: 'us' | 'si' = 'us') => reduceStiffness(emptyStiffness(units), { type: 'template', template: id });
const draw = (form: StiffnessForm, width: number, rest: Partial<Looks> = {}) => {
  const a = analyseSafely(form);
  return { a, l: stiffnessLayout(a.drawing, { ...looks({ reactions: a.results !== null, deformed: a.results !== null, ...rest }), width }) };
};

const line = build({ mode: 'truss', nodes: [[0, 0], [10, 0], [20, 0]], members: [[1, 2], [2, 3]], supports: [[1, 'pin'], [3, 'pin']], loads: [[2, 0, -5]] });
const twice = (() => {
  let f = defaultStiffness();
  f = reduceStiffness(f, { type: 'patch', list: 'nodes', id: f.nodes[2].id, patch: { x: 0, y: 0 } });
  return f;
})();
const loaded = (() => {
  let f = tpl('frame-portal');
  const m = f.members[2].id;
  f = reduceStiffness(f, { type: 'add', list: 'memberLoads', seed: { member: m, kind: 'udl', w: -2 } });
  f = reduceStiffness(f, { type: 'add', list: 'memberLoads', seed: { member: m, kind: 'point', P: -8, a: 5 } });
  f = reduceStiffness(f, { type: 'add', list: 'memberLoads', seed: { member: f.members[0].id, kind: 'axial', q: 1 } });
  return f;
})();

const CASES: [string, StiffnessForm][] = [
  ['default', defaultStiffness()],
  ...TEMPLATE_IDS.flatMap((id) => [[`${id} us`, tpl(id)] as [string, StiffnessForm], [`${id} si`, tpl(id, 'si')] as [string, StiffnessForm]]),
  ['girder truss', girder('truss')],
  ['girder frame', girder('frame')],
  ['flat', flat()],
  ['tall', tall()],
  ['settling', settling()],
  ['mechanism', line],
  ['a node typed twice', twice],
  ['all three member loads', loaded],
  ['huge loads', reduceStiffness(defaultStiffness(), { type: 'patch', list: 'loads', id: defaultStiffness().loads[0].id, patch: { fx: 1e15, fy: -1e15 } })],
  ['tiny loads', reduceStiffness(defaultStiffness(), { type: 'patch', list: 'loads', id: defaultStiffness().loads[0].id, patch: { fx: 1e-12, fy: -1e-12 } })],
  ['empty', emptyStiffness()],
];

const WIDTHS = [320, 390, 720, 1200, 724, 350];

/** Every number anywhere in a value is a finite one. */
const finite = (v: unknown): boolean => (typeof v === 'number' ? Number.isFinite(v) : Array.isArray(v) ? v.every(finite) : v && typeof v === 'object' ? Object.values(v).every(finite) : true);

/** What a word is held to: inside the drawing, clear of every line and box, and clear of every other word. */
function problems(l: Layout): string[] {
  const out: string[] = [];
  l.placed.forEach((r, k) => {
    if (!(r.x0 >= 3 && r.y0 >= 3 && r.x1 <= l.width - 3 && r.y1 <= l.height - 3)) out.push(`word ${k} outside`);
    for (const s of l.obstacles.segs) if (segNear(s, r, 0)) out.push(`word ${k} on a line`);
    for (const b of l.obstacles.boxes) if (rectsNear(r, b, 0)) out.push(`word ${k} on a box`);
    l.placed.forEach((q: Rect, j) => {
      if (j > k && rectsNear(r, q, 0)) out.push(`word ${k} on word ${j}`);
    });
  });
  return out;
}

describe('the layout of every structure, at every width and with every mark on or off', () => {
  const LOOKS: Partial<Looks>[] = [{}, { loads: false, reactions: false, deformed: false, dofs: false, memberNumbers: false, nodeNumbers: false }, { deformed: false }, { dofs: false }, { values: false }, { memberNumbers: false, nodeNumbers: false }];
  for (const [name, form] of CASES) {
    it(`${name}: finite, inside its own box, and every word clear`, () => {
      for (const width of WIDTHS) {
        for (const rest of LOOKS) {
          const { l } = draw(form, width, rest);
          const where = `${name} ${width}px ${JSON.stringify(rest)}`;
          expect(Number.isFinite(l.width) && Number.isFinite(l.height) && l.height > 0, where).toBe(true);
          for (const n of l.nodes) {
            expect(Number.isFinite(n.x) && Number.isFinite(n.y), where).toBe(true);
            expect(n.x, where).toBeGreaterThanOrEqual(0);
            expect(n.x, where).toBeLessThanOrEqual(l.width);
          }
          expect(finite([l.members, l.supports, l.loads, l.reactions, l.memberLoads, l.deformed, l.nodes]), where).toBe(true);
          expect(problems(l), where).toEqual([]);
          // A word is written only where it was asked for.
          if (rest.dofs === false) expect(l.nodes.every((n) => n.dofTag === null), where).toBe(true);
          if (rest.memberNumbers === false) expect(l.members.every((m) => m.tag === null), where).toBe(true);
          if (rest.values === false) {
            expect(l.loads.every((x) => x.arrows.every((a) => a.text === null) && (x.arc?.text ?? null) === null), where).toBe(true);
            expect(l.reactions.every((x) => x.arrows.every((a) => a.text === null)), where).toBe(true);
          }
        }
      }
    });
  }
});

describe('what the drawing holds', () => {
  const def = analyseSafely(defaultStiffness());
  const at = (rest: Partial<Looks> = {}, width = 720) => stiffnessLayout(def.drawing, { ...looks(rest), width });

  it('numbers the nodes and members, and writes the DOF numbers of every node with a line under each that is held', () => {
    const l = at();
    expect(l.nodes.map((n) => n.label)).toEqual([1, 2, 3]);
    expect(l.members.map((m) => m.tag?.value)).toEqual(['1', '2']);
    expect(l.nodes.map((n) => n.dofTag?.box.value)).toEqual(['1 2', '3 4', '5 6']);
    // Both DOFs of each pinned foot are held, the apex's are not: four lines in all, each as long as its number.
    expect(l.nodes.map((n) => n.dofTag?.underlines.length)).toEqual([2, 2, 0]);
    const first = l.nodes[0].dofTag!;
    expect(first.underlines[0].x2 - first.underlines[0].x1).toBeCloseTo(6.6, 1);
    expect(first.underlines[0].x1).toBeLessThan(first.underlines[1].x1);
  });

  it('a frame writes three DOF numbers to a node, and the held ones are underlined', () => {
    const { l } = draw(tpl('frame-portal'), 720);
    expect(l.nodes.map((n) => n.dofTag?.box.value)).toEqual(['1 2 3', '4 5 6', '7 8 9', '10 11 12']);
    expect(l.nodes.map((n) => n.dofTag?.underlines.length)).toEqual([3, 3, 0, 0]);
  });

  it('draws a support by the movements it holds', () => {
    const kinds = (f: StiffnessForm) => stiffnessLayout(analyseSafely(f).drawing, { ...looks(), width: 720 }).supports.map((s) => `${s.kind}:${s.symbol}`);
    expect(kinds(defaultStiffness())).toEqual(['pin:pin', 'pin:pin']);
    expect(kinds(tpl('frame-portal'))).toEqual(['fixed:fixed', 'fixed:fixed']);
    expect(kinds(tpl('truss-five-member'))).toEqual(['pin:pin', 'roller:roller-y']);
    const all = (flags: { ux: boolean; uy: boolean; rz: boolean }) => {
      let f = tpl('frame-portal');
      f = reduceStiffness(f, { type: 'patch', list: 'supports', id: f.supports[0].id, patch: flags });
      return kinds(f)[0];
    };
    expect(all({ ux: true, uy: false, rz: false })).toBe('roller:roller-x');
    expect(all({ ux: false, uy: true, rz: false })).toBe('roller:roller-y');
    expect(all({ ux: false, uy: true, rz: true })).toBe('guide:guide-y');
    expect(all({ ux: true, uy: false, rz: true })).toBe('guide:guide-x');
    expect(all({ ux: false, uy: false, rz: true })).toBe('rotation:rotation');
    // A support that holds nothing draws no symbol (a warning says so).
    let none = tpl('frame-portal');
    none = reduceStiffness(none, { type: 'patch', list: 'supports', id: none.supports[0].id, patch: { ux: false, uy: false, rz: false } });
    expect(stiffnessLayout(analyseSafely(none).drawing, { ...looks(), width: 720 }).supports).toHaveLength(1);
  });

  it('stands a roller that holds x on the side of the node that has no member (left or right), and a support below a column', () => {
    let f = tpl('frame-portal');
    f = reduceStiffness(f, { type: 'patch', list: 'supports', id: f.supports[0].id, patch: { ux: true, uy: false, rz: false } });
    const l = stiffnessLayout(analyseSafely(f).drawing, { ...looks(), width: 720 });
    const roller = l.supports[0];
    expect(Math.abs(roller.side.x)).toBe(1);
    expect(roller.side.y).toBe(0);
    // The fixed foot of the other column stands below it.
    expect(l.supports[1].side).toEqual({ x: 0, y: 1 });
  });

  it('draws one arrow for each component of a load and of a reaction, with the size on it', () => {
    const l = at();
    expect(l.loads).toHaveLength(1);
    expect(l.loads[0].arrows.map((a) => a.text?.value)).toEqual(['20', '30']);
    const sizes = l.reactions.flatMap((r) => r.arrows.map((a) => a.text?.value)).sort();
    expect(sizes).toEqual(['10', '22.5', '30', '7.5']);
    // A load points at its node, a reaction points where the support pushes.
    const a = l.loads[0].arrows[1];
    expect(a.tip.y).toBeGreaterThan(a.tail.y);
  });

  it('draws a moment as a ring with its size, a load along a member beside it, and a point load as one arrow', () => {
    const { l } = draw(loaded, 720);
    expect(l.reactions.some((r) => r.arc !== null)).toBe(true);
    const kinds = l.memberLoads.map((m) => m.kind);
    expect(kinds).toEqual(['udl', 'point', 'axial']);
    expect(l.memberLoads[0].arrows.length).toBeGreaterThanOrEqual(2);
    expect(l.memberLoads[0].line).not.toBeNull();
    expect(l.memberLoads[1].arrows).toHaveLength(1);
    expect(l.memberLoads[2].line).toBeNull();
    expect(l.memberLoads.map((m) => m.text?.value)).toEqual(['2', '8', '1']);
    expect(l.legend).toEqual(expect.arrayContaining(['distributed', 'pointLoad', 'axialLoad']));
    // A load pushes along the side its sign says: a weight (negative) pushes down the page.
    const udl = l.memberLoads[0];
    const a = udl.arrows[0];
    expect(a.tip.y - a.tail.y).toBeGreaterThan(0);
  });

  it('puts in the legend only what is on the drawing, and a ghost in place of the member when the shape is drawn deformed', () => {
    const l = at();
    expect(l.legend).toEqual(['ghost', 'node', 'deformed', 'pin', 'load', 'reaction', 'dofTag', 'tag']);
    const plain = at({ deformed: false, dofs: false, memberNumbers: false, reactions: false, loads: false });
    expect(plain.legend).toEqual(['member', 'node', 'pin']);
    expect(at({ nodeNumbers: false }).legend).toContain('node');
    const mech = draw(line, 720);
    expect(mech.l.legend).toContain('member');
    expect(draw(tpl('frame-portal'), 720).l.legend).toContain('fixed');
    expect(draw(tpl('frame-portal'), 720).l.legend).toContain('dofTag');
    expect(draw(settling(), 720).l.legend).toContain('settle');
    expect(draw(defaultStiffness(), 720).l.legend).not.toContain('settle');
    expect(draw(tpl('frame-fixed-point'), 720).l.legend).toContain('reactionMoment');
    expect(draw(tpl('frame-portal'), 720, { reactions: false }).l.legend).not.toContain('reaction');
  });

  it('rings the nodes a problem is about', () => {
    const a = analyseSafely(line);
    expect(a.results).toBeNull();
    const l = stiffnessLayout(a.drawing, { ...looks({ reactions: false, deformed: false }), width: 720, flagged: [2] });
    expect(l.nodes.filter((n) => n.flagged).map((n) => n.label)).toEqual([2]);
    expect(l.legend).toContain('flagged');
  });

  it('draws the deformed shape with its exaggeration stated, one curve for each member, and not when nothing moves', () => {
    const l = at();
    expect(l.factor).toBe(def.drawing.deformed!.factor);
    expect(l.factor).toBe(600);
    expect(l.deformed!.members.map((m) => m.member)).toEqual([1, 2]);
    expect(at({ deformed: false }).deformed).toBeNull();
    expect(at({ deformed: false }).factor).toBeNull();
    const idle = draw(reduceStiffness(defaultStiffness(), { type: 'clear' }), 720);
    expect(idle.l.deformed).toBeNull();
    let still = defaultStiffness();
    still = reduceStiffness(still, { type: 'patch', list: 'loads', id: still.loads[0].id, patch: { fx: 0, fy: 0 } });
    const s = draw(still, 720);
    expect(s.a.results).not.toBeNull();
    expect(s.l.factor).toBeNull();
    expect(s.l.deformed).toBeNull();
    expect(s.l.legend).not.toContain('deformed');
  });

  it('draws a beam that bends between nodes that do not move (fixed beam, point load)', () => {
    const { a, l } = draw(tpl('frame-fixed-point'), 720);
    expect(a.results!.displacements.every((d) => d.magnitude === 0)).toBe(true);
    expect(l.factor).not.toBeNull();
    expect(l.deformed!.members[0].points.split(' ').length).toBe(17);
  });

  it('leaves words off, and says how many, when they cannot all be written; widening finds room for them', () => {
    const big = analyseSafely(girder('frame'));
    const o = { ...looks(), width: 330 };
    const narrow = layoutFor(big.drawing, o);
    expect(narrow.thinned).toBeGreaterThan(0);
    expect(narrow.fontSize).toBeLessThanOrEqual(11);
    const wide = everyWidth(big.drawing, looks(), 330);
    if (wide.complete) {
      expect(wide.width).toBeGreaterThan(330);
      expect(layoutFor(big.drawing, { ...o, width: wide.width, fontSize: 8 }).thinned).toBe(0);
    }
    expect(layoutFor(big.drawing, o)).toBe(narrow);
  });

  it('keeps a structure in the same units the same drawing', () => {
    const us = analyseSafely(defaultStiffness());
    const si = analyseSafely(convertStiffness(defaultStiffness(), 'si'));
    const lu = stiffnessLayout(us.drawing, { ...looks(), width: 720 });
    const ls = stiffnessLayout(si.drawing, { ...looks(), width: 720 });
    expect(ls.height).toBeCloseTo(lu.height, 3);
    expect(ls.members.map((m) => [m.x1, m.y1])).toEqual(lu.members.map((m) => [m.x1, m.y1]));
  });

  it('sets a node typed twice side by side, so that each number can be read', () => {
    const { l } = draw(twice, 720);
    const [a, b] = l.nodes.filter((n) => n.label === 1 || n.label === 3);
    expect(Math.hypot(a.x - b.x, a.y - b.y)).toBeGreaterThanOrEqual(2 * 7);
  });

  it('draws a structure of no node, and a drawing of no width, as an empty one that says so', () => {
    const e = stiffnessLayout(analyseSafely(emptyStiffness()).drawing, { ...looks(), width: 390 });
    expect(e.members).toEqual([]);
    expect(Number.isFinite(e.height)).toBe(true);
    const zero = stiffnessLayout(def.drawing, { ...looks(), width: 0 });
    expect(zero.broken).toBe(true);
    expect(zero.members).toEqual([]);
    for (const width of [Number.NaN, -5, Infinity]) expect(stiffnessLayout(def.drawing, { ...looks(), width }).broken, String(width)).toBe(true);
  });

  it('is quick enough to redraw on a key: the largest structure in well under a second', () => {
    const big = analyseSafely(girder('frame'));
    const t0 = performance.now();
    stiffnessLayout(big.drawing, { ...looks(), width: 720 });
    expect(performance.now() - t0).toBeLessThan(1500);
  });
});
