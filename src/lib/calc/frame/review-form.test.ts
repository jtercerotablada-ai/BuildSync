import { describe, expect, it } from 'vitest';
import { analyseSafely } from './analysis';
import { FRAME_MATERIALS, defaultFrame, emptyFrame, reduceFrame, settlementOf, toEngine, type FrameForm } from './model';
import { framePage } from './page-strings';
import { frameUi } from './strings';
import { TEMPLATE_DEFAULTS, carryParams } from './templates';

/**
 * Findings of the review of 2026-10-17 that live in the form's model and its words: the reasons an add is refused, a member load whose kind is
 * changed, what a hidden field sends, what is kept when the template shape is changed, one Spanish for one thing, what the check is measured against.
 * Each test fails on the code of e026e4b.
 */

describe('B3: an add of a member that cannot be made says why', () => {
  it('fewer than two nodes, nodes at one place, and every pair joined are three different reasons', () => {
    const one = reduceFrame(emptyFrame(), { type: 'add', list: 'nodes' });
    expect(reduceFrame(one, { type: 'add', list: 'members' }).notice).toEqual({ code: 'nothing-to-add', list: 'members', why: 'few-nodes' });
    expect(reduceFrame(emptyFrame(), { type: 'add', list: 'members' }).notice).toEqual({ code: 'nothing-to-add', list: 'members', why: 'few-nodes' });
    const twice = reduceFrame(one, { type: 'add', list: 'nodes', seed: { x: 0, y: 0 } });
    expect(twice.nodes).toHaveLength(2);
    expect(reduceFrame(twice, { type: 'add', list: 'members' }).notice).toEqual({ code: 'nothing-to-add', list: 'members', why: 'coincident' });
    expect(reduceFrame(defaultFrame(), { type: 'add', list: 'members' }).notice?.code).toBeUndefined();
    const full = [[1, 2], [1, 4], [2, 3]].reduce((f, [i, j]) => reduceFrame(f, { type: 'add', list: 'members', seed: { i, j } }), defaultFrame());
    expect(full.members).toHaveLength(6);
    expect(reduceFrame(full, { type: 'add', list: 'members' }).notice).toEqual({ code: 'nothing-to-add', list: 'members', why: 'pairs' });
    for (const why of ['few-nodes', 'coincident', 'pairs'] as const) for (const lang of ['en', 'es'] as const) expect(frameUi[lang].cannotAdd[why].length).toBeGreaterThan(20);
  });
});

describe('C2 and B10: changing the kind of a member load starts the new kind with something to act', () => {
  const kindTo = (f: FrameForm, kind: string) => reduceFrame(f, { type: 'patch', list: 'memberLoads', id: f.memberLoads[0].id, patch: { kind } });
  it('a temperature load made of another kind has the material α (steel), in either system, and a change in degrees; and it acts', () => {
    const us = kindTo(defaultFrame(), 'temperature').memberLoads[0];
    expect(us.alpha).toBe(FRAME_MATERIALS.steel.alpha.us);
    expect(us.dT).toBe(50);
    const si = kindTo(reduceFrame(defaultFrame(), { type: 'units', units: 'si' }), 'temperature').memberLoads[0];
    expect(si.alpha).toBe(FRAME_MATERIALS.steel.alpha.si);
    // The load acts: with the α it has the frame is not the frame with α = 0 (the review saw the same −31.71 kip·ft with and without it).
    const warm = analyseSafely(kindTo(defaultFrame(), 'temperature'));
    const cold = analyseSafely(reduceFrame(kindTo(defaultFrame(), 'temperature'), { type: 'patch', list: 'memberLoads', id: defaultFrame().memberLoads[0].id, patch: { alpha: 0 } }));
    expect(warm.warnings.some((w) => w.code === 'no-expansion')).toBe(false);
    expect(warm.results!.extremes.M.min!.value).not.toBeCloseTo(cold.results!.extremes.M.min!.value, 3);
  });
  it('a temperature change typed with α = 0 is said to do nothing, and does nothing', () => {
    const f = reduceFrame(kindTo(defaultFrame(), 'temperature'), { type: 'patch', list: 'memberLoads', id: defaultFrame().memberLoads[0].id, patch: { alpha: 0 } });
    const a = analyseSafely(f);
    expect(a.warnings.find((w) => w.code === 'no-expansion')).toEqual({ code: 'no-expansion', members: [3] });
    // It does nothing: the frame is the frame without the load.
    const without = analyseSafely(reduceFrame(defaultFrame(), { type: 'remove', list: 'memberLoads', id: defaultFrame().memberLoads[0].id }));
    expect(a.results!.extremes.M.min!.value).toBeCloseTo(without.results!.extremes.M.min!.value, 9);
    expect(frameUi.en.warnings['no-expansion']).toMatch(/α of 0/);
    expect(frameUi.es.warnings['no-expansion']).toMatch(/α igual a 0/);
  });
  it('a point load, a couple and a trapezoid made of a line load are not zero', () => {
    const point = kindTo(defaultFrame(), 'point').memberLoads[0];
    expect(point.P).toBe(-10);
    expect(point.a).toBe(10);
    const trapezoid = kindTo(defaultFrame(), 'trapezoid').memberLoads[0];
    expect(trapezoid.w).toBe(-1.2);
    expect(trapezoid.w2).toBe(-1.2);
    expect([trapezoid.a, trapezoid.b]).toEqual([0, 20]);
    expect(kindTo(defaultFrame(), 'moment').memberLoads[0].M).toBe(10);
    for (const kind of ['point', 'moment', 'trapezoid']) expect(analyseSafely(kindTo(defaultFrame(), kind)).issues).toEqual([]);
  });
  it('what was typed before in a field of the new kind is kept (changing back and forth finds it)', () => {
    let f = reduceFrame(defaultFrame(), { type: 'patch', list: 'memberLoads', id: defaultFrame().memberLoads[0].id, patch: { P: -3, a: 4 } });
    f = kindTo(f, 'point');
    expect([f.memberLoads[0].P, f.memberLoads[0].a]).toEqual([-3, 4]);
  });
  it('a settlement typed for a rotation at a pin or a roller (a field the form hides there) does not reach the engine or the drawing', () => {
    const f = reduceFrame(defaultFrame(), { type: 'patch', list: 'supports', id: defaultFrame().supports[0].id, patch: { kind: 'pin', dr: 0.01 } });
    expect(settlementOf(f.supports[0])).toEqual({ dx: 0, dy: 0, dr: 0 });
    expect(toEngine(f).model.supports[0].dr).toBeUndefined();
    expect(analyseSafely(f).drawing.supports[0].settles).toBe(false);
    const fixed = reduceFrame(defaultFrame(), { type: 'patch', list: 'supports', id: defaultFrame().supports[0].id, patch: { dr: 0.01 } });
    expect(toEngine(fixed).model.supports[0].dr).toBe(0.01);
    expect(analyseSafely(fixed).drawing.supports[0].settles).toBe(true);
  });
});

describe('B8: another shape keeps what was typed for the one before', () => {
  it('a width typed for a portal is the gable one; a number left at its start stays the new shape own; the counts stay the portal one', () => {
    const portal = { template: 'portal' as const, params: { ...TEMPLATE_DEFAULTS.us.portal, width: 33, bays: 3 } };
    const gable = carryParams(portal, 'gable', 'us');
    expect(gable.params.width).toBe(33);
    expect(gable.params.lateral).toBe(TEMPLATE_DEFAULTS.us.gable.lateral);
    expect(gable.params.height).toBe(TEMPLATE_DEFAULTS.us.gable.height);
    expect(gable.params.bays).toBe(1);
    // A parameter the new shape does not have is dropped, and one it has that the old shape did not ask for is its own.
    const column = carryParams({ template: 'gable', params: { ...TEMPLATE_DEFAULTS.us.gable, rise: 9, height: 21 } }, 'cantilever-column', 'us');
    expect(column.params.height).toBe(21);
    expect(column.params.rise).toBe(TEMPLATE_DEFAULTS.us['cantilever-column'].rise);
  });
});

describe('A9: one Spanish for the depth and the determinacy, on the form and on the page', () => {
  const leaves = (v: unknown): string[] => (typeof v === 'string' ? [v] : Array.isArray(v) ? v.flatMap(leaves) : v && typeof v === 'object' ? Object.values(v).flatMap(leaves) : []);
  it('peralte, isostático and hiperestático; never canto for a depth nor determinado for the frame', () => {
    const text = [...leaves(frameUi.es), ...leaves(framePage.es)].join(' | ');
    expect(text).not.toMatch(/\bcanto\b/i);
    expect(text).not.toMatch(/(estáticamente|pórtico|sistema) (in)?determinad[oa]/i);
    expect(text).not.toMatch(/gravitatori|elevación de la cumbrera/i);
    expect(text).toMatch(/peralte/);
    expect(text).toMatch(/isostático/);
    expect(text).toMatch(/hiperestático/);
  });
});

describe('A6: the check says what the tolerance is measured against', () => {
  it('a millionth of the largest force, not of the loads', () => {
    expect(frameUi.en.results.equilibrium.balanced).toMatch(/millionth of the largest force/);
    expect(frameUi.es.results.equilibrium.balanced).toMatch(/millonésima de la mayor fuerza/);
  });
});
