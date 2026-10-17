import { afterEach, describe, expect, it, vi } from 'vitest';
import { solveFrame } from './engine';
import { defaultFrame, reduceFrame, toEngine } from './model';
import { TEMPLATE_DEFAULTS, TEMPLATE_IDS, buildTemplate, clampParams, type TemplateId } from './templates';
import { MAX_MEMBERS, MAX_NODES } from './types';

vi.setConfig({ testTimeout: 120_000 });
afterEach(() => new Promise((r) => setTimeout(r, 0)));

const solved = (id: TemplateId, units: 'us' | 'si', params = {}) => {
  const form = reduceFrame(defaultFrame(), { type: 'units', units });
  const f = reduceFrame(form, { type: 'template', template: id, params });
  const out = solveFrame(toEngine(f).model);
  if (!out.ok) throw new Error(`${id} ${units}: ${JSON.stringify(out.issues)}`);
  return out;
};

describe('every template, in both unit systems, with its defaults', () => {
  for (const id of TEMPLATE_IDS) {
    for (const units of ['us', 'si'] as const) {
      it(`${id} (${units}) builds a frame the engine solves, with no clamp`, () => {
        const t = buildTemplate(id, {}, units);
        expect(t.clamped).toEqual([]);
        expect(t.nodes.length).toBeGreaterThanOrEqual(2);
        expect(t.members.length).toBeGreaterThanOrEqual(1);
        expect(t.supports.length).toBeGreaterThanOrEqual(1);
        const s = solved(id, units);
        // Global equilibrium of the loads and the reactions.
        const e = s.equilibrium;
        expect(Math.abs(e.sumFx)).toBeLessThanOrEqual(1e-8 * Math.max(e.scale, 1e-9));
        expect(Math.abs(e.sumFy)).toBeLessThanOrEqual(1e-8 * Math.max(e.scale, 1e-9));
      });
    }
  }
  it('the portal default IS the example of the page', () => {
    const t = buildTemplate('portal', TEMPLATE_DEFAULTS.us.portal, 'us');
    expect(t.nodes).toEqual([{ x: 0, y: 0 }, { x: 20, y: 0 }, { x: 0, y: 10 }, { x: 20, y: 10 }]);
    expect(t.members).toEqual([{ i: 0, j: 2 }, { i: 1, j: 3 }, { i: 2, j: 3 }]);
    expect(t.supports).toEqual([{ node: 0, kind: 'fixed' }, { node: 1, kind: 'fixed' }]);
    expect(t.loads).toEqual([{ node: 2, fx: 10, fy: 0, m: 0 }]);
    expect(t.memberLoads).toEqual([{ member: 2, kind: 'udl', dir: 'global-y', w: -1.2 }]);
  });
});

describe('geometry and numbering, as documented', () => {
  it('a 2 × 2 portal: floor by floor, left to right; columns floor by floor, then beams', () => {
    const t = buildTemplate('portal', { bays: 2, storeys: 2, width: 6, height: 4, gravity: 3, lateral: 7 }, 'us');
    expect(t.nodes.map((n) => [n.x, n.y])).toEqual([[0, 0], [6, 0], [12, 0], [0, 4], [6, 4], [12, 4], [0, 8], [6, 8], [12, 8]]);
    expect(t.members.map((m) => [m.i, m.j])).toEqual([[0, 3], [1, 4], [2, 5], [3, 6], [4, 7], [5, 8], [3, 4], [4, 5], [6, 7], [7, 8]]);
    expect(t.supports.map((s) => s.node)).toEqual([0, 1, 2]);
    expect(t.loads).toEqual([{ node: 3, fx: 7, fy: 0, m: 0 }, { node: 6, fx: 7, fy: 0, m: 0 }]);
    expect(t.memberLoads.map((l) => l.member)).toEqual([6, 7, 8, 9]);
    const s = solved('portal', 'us', { bays: 2, storeys: 2, width: 6, height: 4, gravity: 3, lateral: 7 });
    // Each beam carries 3·6 = 18 per bay: 4 bays × 18 = 72 down; reactions add up to it.
    expect(s.reactions.reduce((a, r) => a + r.ry, 0)).toBeCloseTo(72, 7);
    expect(s.reactions.reduce((a, r) => a + r.rx, 0)).toBeCloseTo(-14, 7);
  });
  it('pinned feet are pins; the engine says a pinned single-bay portal is indeterminate to the first degree', () => {
    const t = buildTemplate('portal', { base: 'pinned' }, 'us');
    expect(t.supports.every((s) => s.kind === 'pin')).toBe(true);
    expect(solved('portal', 'us', { base: 'pinned' }).determinacy).toMatchObject({ degree: 1, word: 'indeterminate' });
    expect(solved('portal', 'us').determinacy).toMatchObject({ degree: 3, word: 'indeterminate' });
  });
  it('a gable: eaves, ridge and rafters; the ridge hinge makes pinned feet a three-hinged frame, thrust H = wL²/(8f) with f the height of the ridge', () => {
    const t = buildTemplate('gable', { width: 40, height: 15, rise: 8, hinge: true, base: 'pinned', gravity: 0.8, lateral: 0 }, 'us');
    expect(t.nodes).toEqual([{ x: 0, y: 0 }, { x: 40, y: 0 }, { x: 0, y: 15 }, { x: 40, y: 15 }, { x: 20, y: 23 }]);
    expect(t.members).toEqual([{ i: 0, j: 2 }, { i: 1, j: 3 }, { i: 2, j: 4, hingeEnd: true }, { i: 4, j: 3, hingeStart: true }]);
    expect(t.memberLoads).toEqual([{ member: 2, kind: 'udl-projected', dir: 'global-y', w: -0.8 }, { member: 3, kind: 'udl-projected', dir: 'global-y', w: -0.8 }]);
    const s = solved('gable', 'us', { width: 40, height: 15, rise: 8, hinge: true, base: 'pinned', gravity: 0.8, lateral: 0 });
    expect(s.determinacy).toMatchObject({ degree: 0, word: 'determinate' });
    expect(s.reactions[0].ry).toBeCloseTo(16, 8);
    expect(Math.abs(s.reactions[0].rx)).toBeCloseTo((0.8 * 1600) / (8 * 23), 8);
    const two = solved('gable', 'us', { hinge: false, base: 'pinned', lateral: 0 });
    expect(two.determinacy.degree).toBe(1);
    expect(solved('gable', 'us', { hinge: false, base: 'fixed' }).determinacy.degree).toBe(3);
    expect(solved('gable', 'us', { hinge: true, base: 'fixed' }).determinacy.degree).toBe(2);
  });
  it('an L-frame: fixed foot = a cantilever (determinate); pinned foot = pin + a vertical roller at the tip', () => {
    const fixed = buildTemplate('l-frame', { width: 12, height: 10, gravity: 2, lateral: 3 }, 'us');
    expect(fixed.nodes).toEqual([{ x: 0, y: 0 }, { x: 0, y: 10 }, { x: 12, y: 10 }]);
    expect(fixed.supports).toEqual([{ node: 0, kind: 'fixed' }]);
    expect(solved('l-frame', 'us').determinacy.degree).toBe(0);
    const pinned = buildTemplate('l-frame', { base: 'pinned' }, 'us');
    expect(pinned.supports).toEqual([{ node: 0, kind: 'pin' }, { node: 2, kind: 'roller', angle: 90 }]);
    expect(solved('l-frame', 'us', { base: 'pinned' }).determinacy.degree).toBe(0);
    // Cantilever L under a UDL w on the beam of length b: M at the corner = w b²/2, the column carries it down.
    const s = solved('l-frame', 'us', { width: 12, height: 10, gravity: 2, lateral: 0 });
    expect(s.members[0].start.M).toBeCloseTo(-144, 7);
    expect(s.reactions[0].ry).toBeCloseTo(24, 8);
  });
  it('a cantilever column: lateral and axial load at the top, M = H·h at the foot, always fixed', () => {
    const t = buildTemplate('cantilever-column', { height: 12, lateral: 5, axial: 20, base: 'pinned' }, 'us');
    expect(t.supports).toEqual([{ node: 0, kind: 'fixed' }]);
    expect(t.clamped).toEqual([{ param: 'base', requested: 'pinned', used: 'fixed', why: 'base' }]);
    expect(t.loads).toEqual([{ node: 1, fx: 5, fy: -20, m: 0 }]);
    const s = solved('cantilever-column', 'us', { height: 12, lateral: 5, axial: 20 });
    expect(Math.abs(s.reactions[0].rm)).toBeCloseTo(60, 8);
    expect(s.reactions[0].ry).toBeCloseTo(20, 8);
    expect(s.determinacy.degree).toBe(0);
  });
  it('a beam on two columns: the beam hinged at both ends, the columns fixed; the beam is a simple beam', () => {
    const t = buildTemplate('beam-on-columns', { width: 24, height: 12, gravity: 1.5, lateral: 0 }, 'us');
    expect(t.members[2]).toEqual({ i: 2, j: 3, hingeStart: true, hingeEnd: true });
    const s = solved('beam-on-columns', 'us', { width: 24, height: 12, gravity: 1.5, lateral: 0 });
    // M at the middle of the beam = wL²/8 = 108, ends zero; each column carries wL/2 = 18.
    expect(s.members[2].maxima.M.max.value).toBeCloseTo(108, 7);
    expect(s.members[2].start.M).toBe(0);
    expect(s.reactions[0].ry).toBeCloseTo(18, 8);
    expect(s.determinacy.degree).toBe(1);
  });
  it('a two-hinged frame: pinned feet, rigid corners, one degree indeterminate, always pinned', () => {
    const t = buildTemplate('two-hinged', { base: 'fixed' }, 'us');
    expect(t.supports.every((s) => s.kind === 'pin')).toBe(true);
    expect(t.clamped).toEqual([{ param: 'base', requested: 'fixed', used: 'pinned', why: 'base' }]);
    expect(solved('two-hinged', 'us').determinacy).toMatchObject({ degree: 1, word: 'indeterminate' });
  });
});

describe('what cannot be built is built with what can, and the page is told', () => {
  it('counts are whole numbers from 1 to 6', () => {
    expect(clampParams('portal', { bays: 9, storeys: 0 }, 'us').clamped).toEqual([
      { param: 'bays', requested: 9, used: 6, why: 'max' },
      { param: 'storeys', requested: 0, used: 1, why: 'min' },
    ]);
    expect(clampParams('portal', { bays: 2.4 }, 'us')).toMatchObject({ params: { bays: 2 }, clamped: [{ param: 'bays', requested: 2.4, used: 2, why: 'integer' }] });
    expect(clampParams('portal', { bays: Number.NaN }, 'us')).toMatchObject({ params: { bays: 1 }, clamped: [{ param: 'bays', why: 'number', used: 1 }] });
  });
  it('widths and heights above zero; a rise held between a fiftieth of the span and the span; loads are any finite numbers', () => {
    const c = clampParams('gable', { width: -3, height: Number.POSITIVE_INFINITY, rise: 500, gravity: Number.NaN, lateral: -4 }, 'si');
    expect(c.params).toMatchObject({ width: 12, height: 4.5, rise: 12, gravity: 0, lateral: -4 });
    expect(c.clamped.map((x) => [x.param, x.why])).toEqual([['width', 'positive'], ['height', 'number'], ['gravity', 'number'], ['rise', 'max']]);
    expect(clampParams('gable', { rise: 0.1, width: 40 }, 'us').params.rise).toBe(0.8);
  });
  it('anything at all comes back as a frame: 400 random parameter sets, none throws, every one is within the caps and solves or is a legitimate mechanism', () => {
    let seed = 1;
    const next = () => {
      seed = (seed * 48271) % 2147483647;
      return seed / 2147483647;
    };
    const junk = [undefined, Number.NaN, Infinity, -Infinity, -5, 0, 0.5, 1, 2.5, 6, 7, 1e9, 20, 3.3, 'x' as never, null as never];
    for (let k = 0; k < 400; k++) {
      const id = TEMPLATE_IDS[k % TEMPLATE_IDS.length];
      const pick = () => junk[Math.floor(next() * junk.length)];
      const params = { bays: pick(), storeys: pick(), width: pick(), height: pick(), rise: pick(), gravity: pick(), lateral: pick(), axial: pick(), base: next() < 0.5 ? 'fixed' : 'pinned', hinge: next() < 0.5 } as never;
      const t = buildTemplate(id, params, k % 2 === 0 ? 'us' : 'si');
      expect(t.nodes.length).toBeLessThanOrEqual(MAX_NODES);
      expect(t.members.length).toBeLessThanOrEqual(MAX_MEMBERS);
      for (const n of t.nodes) expect(Number.isFinite(n.x) && Number.isFinite(n.y)).toBe(true);
      for (const l of t.loads) expect(Number.isFinite(l.fx) && Number.isFinite(l.fy)).toBe(true);
      const f = reduceFrame(defaultFrame(), { type: 'template', template: id, params });
      const out = solveFrame(toEngine(f).model);
      // A template is always stable (an L-frame and a gable included, with either base); a span of a billion feet on a W14 section is the one thing the
      // arithmetic may refuse, as ill-conditioned.
      const why = out.ok ? '' : out.issues.map((i) => i.code).join();
      expect(out.ok || why === 'ill-conditioned', `${id} ${JSON.stringify(params)} → ${why}`).toBe(true);
    }
  });
  it('the biggest portal, 6 bays × 6 storeys, is 49 nodes and 78 members and solves', () => {
    const t = buildTemplate('portal', { bays: 6, storeys: 6 }, 'us');
    expect(t.nodes).toHaveLength(49);
    expect(t.members).toHaveLength(78);
    const s = solved('portal', 'us', { bays: 6, storeys: 6 });
    expect(s.determinacy.degree).toBe(3 * 78 + 21 - 3 * 49);
  });
});
