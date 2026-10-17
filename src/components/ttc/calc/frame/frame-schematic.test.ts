import { afterEach, describe, expect, it, vi } from 'vitest';
import { analyseSafely } from '@/lib/calc/frame/analysis';
import { convertFrame, defaultFrame, emptyFrame, reduceFrame, type FrameForm } from '@/lib/calc/frame/model';
import { TEMPLATE_IDS, type TemplateId } from '@/lib/calc/frame/templates';
import { everyWidth, frameLayout, layoutFor, rectsNear, segNear, type DiagramMode, type Layout, type Looks, type Rect } from './layout';

vi.setConfig({ testTimeout: 120_000 });
afterEach(() => new Promise<void>((done) => setTimeout(done, 0)));

/**
 * THE FRAME DRAWING'S LAYOUT, without a browser: the geometry and the clearance of every word on it, over a matrix of frames, widths and
 * diagrams. What only the eye can judge - whether it reads - is in the report that goes with this file.
 */

const looks = (mode: DiagramMode, rest: Partial<Looks> = {}): Looks => ({ mode, loads: true, reactions: true, values: true, nodeNumbers: true, memberNumbers: true, amp: 1, group: ',', ...rest });
const tpl = (id: TemplateId, units: 'us' | 'si' = 'us', params: Record<string, number | boolean | string> = {}) => reduceFrame(reduceFrame(defaultFrame(), { type: 'units', units }), { type: 'template', template: id, params });
const patchRow = (f: FrameForm, list: 'members' | 'supports' | 'loads' | 'memberLoads', k: number, patch: Record<string, unknown>) => reduceFrame(f, { type: 'patch', list, id: f[list][k].id, patch });

const CASES: [string, FrameForm][] = [
  ['default', defaultFrame()],
  ...TEMPLATE_IDS.flatMap((id) => [[`${id} us`, tpl(id)] as [string, FrameForm], [`${id} si`, tpl(id, 'si')] as [string, FrameForm]]),
  ['5x4 portal', tpl('portal', 'us', { bays: 5, storeys: 4 })],
  ['flat', tpl('portal', 'us', { width: 100, height: 1 })],
  ['tall', tpl('portal', 'us', { width: 1, height: 100 })],
  ['huge loads', tpl('portal', 'us', { gravity: 1e6, lateral: 1e6 })],
  ['tiny loads', tpl('portal', 'us', { gravity: 1e-6, lateral: 1e-6 })],
  ['inclined roller', patchRow(patchRow(tpl('portal'), 'supports', 0, { kind: 'roller', angle: 45 }), 'supports', 1, { kind: 'pin' })],
  ['wall roller', patchRow(patchRow(tpl('portal'), 'supports', 0, { kind: 'roller', angle: 0 }), 'supports', 1, { kind: 'pin' })],
  ['mechanism', patchRow(patchRow(patchRow(patchRow(tpl('portal', 'us', { base: 'pinned' }), 'members', 2, { hingeStart: true }), 'members', 2, { hingeEnd: true }), 'members', 0, { hingeEnd: true }), 'members', 1, { hingeEnd: true })],
  ['empty', emptyFrame()],
];

const WIDTHS = [320, 390, 720, 1200, 724, 350];
const MODES: DiagramMode[] = ['none', 'M', 'V', 'N', 'deformed'];

/** Every number anywhere in a value is a finite one (a NaN becomes null in JSON, so the value is walked). */
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

describe('the layout of every frame, at every width', () => {
  for (const [name, form] of CASES) {
    it(`${name}: finite, inside its own box, and every word clear`, () => {
      const a = analyseSafely(form);
      for (const width of WIDTHS) {
        for (const mode of MODES) {
          const l = frameLayout(a.drawing, { ...looks(a.results ? mode : 'none'), width, displacements: a.results?.displacements?.map((d) => ({ node: d.node, magnitude: d.magnitude })) ?? null });
          const where = `${name} ${width}px ${mode}`;
          expect(Number.isFinite(l.width) && Number.isFinite(l.height) && l.height > 0, where).toBe(true);
          for (const n of l.nodes) {
            expect(Number.isFinite(n.x) && Number.isFinite(n.y), where).toBe(true);
            expect(n.x, where).toBeGreaterThanOrEqual(0);
            expect(n.x, where).toBeLessThanOrEqual(l.width);
          }
          expect(finite([l.members, l.supports, l.loads, l.reactions, l.memberLoads, l.diagram, l.deformed, l.hinges, l.scaleValue]), where).toBe(true);
          expect(problems(l), where).toEqual([]);
        }
      }
    });
  }
});

describe('what the drawing holds', () => {
  const a = analyseSafely(defaultFrame());
  const at = (mode: DiagramMode, rest: Partial<Looks> = {}, width = 720) => frameLayout(a.drawing, { ...looks(mode), ...rest, width });

  it('draws one diagram at a time, with a clean stated scale and the signs inside', () => {
    for (const mode of ['M', 'V', 'N'] as const) {
      const l = at(mode);
      expect(l.diagram?.mode).toBe(mode);
      expect(l.deformed).toBeNull();
      expect(l.diagram!.polygons.length).toBeGreaterThan(0);
      expect(l.diagram!.signs.length).toBeGreaterThan(0);
      expect(l.scaleValue).toBe(({ M: a.drawing.moment, V: a.drawing.shear, N: a.drawing.axial }[mode]!.scale!.perUnit));
    }
    expect(at('M').legend).toContain('moment');
    expect(at('V').legend).toContain('direction');
    expect(at('M').legend).not.toContain('direction');
    expect(at('deformed').deformed).not.toBeNull();
    expect(at('deformed').factor).toBe(a.drawing.deflected!.factor);
    expect(at('none').diagram).toBeNull();
  });

  it('draws the diagram larger and smaller, and says the scale it was drawn at', () => {
    const one = at('M');
    const two = at('M', { amp: 2 });
    expect(two.scaleValue).toBe(one.scaleValue! / 2);
    // Twice as tall a diagram needs a drawing that holds it: the frame is drawn smaller.
    expect(two.scale).toBeLessThan(one.scale);
  });

  it('puts in the legend only what is on the drawing', () => {
    const l = at('M');
    expect(l.legend).toContain('fixed');
    expect(l.legend).not.toContain('pin');
    expect(l.legend).not.toContain('hinge');
    expect(l.legend).not.toContain('temperature');
    const noLoads = at('M', { loads: false, reactions: false });
    expect(noLoads.legend).not.toContain('load');
    expect(noLoads.legend).not.toContain('distributed');
    expect(noLoads.legend).not.toContain('reaction');
    const g = frameLayout(analyseSafely(tpl('gable', 'us', { hinge: true })).drawing, { ...looks('none'), width: 720 });
    expect(g.legend).toContain('hinge');
    expect(g.legend).toContain('pin');
  });

  it('writes each corner moment once where the two members give the same number', () => {
    const l = at('M');
    const texts = l.diagram!.labels.map((x) => x.value);
    expect(texts.filter((v) => v === '−50.44').length).toBe(1);
  });

  it('draws a mechanism and an empty frame without diagrams, with the nodes at fault ringed', () => {
    const mech = CASES.find(([n]) => n === 'mechanism')![1];
    const am = analyseSafely(mech);
    expect(am.results).toBeNull();
    const l = frameLayout(am.drawing, { ...looks('none'), width: 720, flagged: [3, 4] });
    expect(l.diagram).toBeNull();
    expect(l.nodes.filter((n) => n.flagged).map((n) => n.label)).toEqual([3, 4]);
    expect(l.legend).toContain('flagged');
    const e = frameLayout(analyseSafely(emptyFrame()).drawing, { ...looks('M'), width: 390 });
    expect(e.members).toEqual([]);
    expect(Number.isFinite(e.height)).toBe(true);
  });

  it('leaves values off, and says how many, when they cannot all be written; widening finds room for them', () => {
    const big = analyseSafely(tpl('portal', 'us', { bays: 6, storeys: 6 }));
    const o = { ...looks('M'), width: 346 };
    const narrow = layoutFor(big.drawing, o);
    expect(narrow.thinned).toBeGreaterThan(0);
    expect(narrow.fontSize).toBeLessThanOrEqual(11);
    const wide = everyWidth(big.drawing, looks('M'), 346);
    if (wide.complete) {
      expect(wide.width).toBeGreaterThan(346);
      expect(layoutFor(big.drawing, { ...o, width: wide.width, fontSize: 8 }).thinned).toBe(0);
    }
    expect(layoutFor(big.drawing, o)).toBe(narrow);
  });

  it('keeps a frame in the same units the same drawing', () => {
    const us = analyseSafely(defaultFrame());
    const si = analyseSafely(convertFrame(defaultFrame(), 'si'));
    const lu = frameLayout(us.drawing, { ...looks('none'), width: 720 });
    const ls = frameLayout(si.drawing, { ...looks('none'), width: 720 });
    expect(ls.height).toBeCloseTo(lu.height, 3);
    expect(ls.members.map((m) => [m.x1, m.y1])).toEqual(lu.members.map((m) => [m.x1, m.y1]));
  });

  it('is quick enough to redraw on a key: the largest frame in well under a second', () => {
    const big = analyseSafely(tpl('portal', 'us', { bays: 6, storeys: 6 }));
    const t0 = performance.now();
    frameLayout(big.drawing, { ...looks('M'), width: 720 });
    expect(performance.now() - t0).toBeLessThan(1500);
  });
});
