import { afterEach, describe, expect, it, vi } from 'vitest';
import { analyseSafely } from './analysis';
import { solve } from './engine';
import { emptyStiffness, reduce, toEngine } from './model';
import { randomSpec, stableSpec, toModel } from './oracle.testlib';
import { replay } from './replay.testlib';
import { TEMPLATE_IDS } from './templates';

vi.setConfig({ testTimeout: 120_000 });
afterEach(() => new Promise((r) => setTimeout(r, 0)));
const yieldNow = () => new Promise((r) => setTimeout(r, 0));

/**
 * THE DISPLAYED SOLUTION IS SELF-CONSISTENT. replay.testlib.ts recomputes each step from the steps before it (and the model's loads) and compares it with
 * the step as printed. On the engine's raw numbers the difference is rounding (1e-12 of the largest entry of the block); on the settled numbers the page prints,
 * where an entry under a billionth of its block's largest is zero, it is a few parts in 10⁷.
 */
function worst(deviations: ReturnType<typeof replay>): { error: number; where: string } {
  let w = { error: 0, where: '' };
  for (const d of deviations) if (!(d.error <= w.error)) w = { error: d.error, where: `${d.key}: ${d.what}` };
  return w;
}

describe('replay: every step from the ones before it', () => {
  it('the eight templates in both unit systems, raw: to 1e-12', () => {
    for (const units of ['us', 'si'] as const) {
      for (const template of TEMPLATE_IDS) {
        const form = reduce(emptyStiffness(units), { type: 'template', template });
        const { model } = toEngine(form);
        const out = solve(model);
        if (!out.ok) throw new Error('not solved');
        const w = worst(replay(out, model));
        expect(w.error, `${template} ${units}: ${w.where}`).toBeLessThanOrEqual(1e-12);
      }
    }
  });
  it('the same, settled as the page prints it: to 1e-6', () => {
    for (const template of TEMPLATE_IDS) {
      const form = reduce(emptyStiffness('us'), { type: 'template', template });
      const a = analyseSafely(form);
      const w = worst(replay(a.solution!, toEngine(form).model, { settled: true }));
      expect(w.error, `${template}: ${w.where}`).toBeLessThanOrEqual(1e-6);
    }
  });
  it('300 generated trusses and frames, with member loads and settlements', async () => {
    let solved = 0;
    for (let seed = 1; seed <= 300; seed++) {
      if (seed % 50 === 0) await yieldNow();
      const spec = seed % 3 === 0 ? stableSpec(seed, { settlements: true }) : randomSpec(seed, { settlements: seed % 3 === 1 });
      const model = toModel(spec);
      const out = solve(model);
      if (!out.ok) continue;
      solved++;
      const w = worst(replay(out, model));
      expect(w.error, `#${seed}: ${w.where}`).toBeLessThanOrEqual(1e-11);
    }
    expect(solved).toBeGreaterThan(100);
  });
  it('a structure over 12 free DOFs, where only the result is recorded, satisfies its equations', () => {
    let form = reduce(emptyStiffness('us', 'frame'), { type: 'template', template: 'frame-portal' });
    form = reduce(form, { type: 'clear' });
    for (let k = 0; k < 8; k++) form = reduce(form, { type: 'add', list: 'nodes' });
    form = { ...form, nodes: form.nodes.map((n, k) => ({ ...n, x: (k % 4) * 10, y: Math.floor(k / 4) * 10 })) };
    const ids = form.nodes.map((n) => n.id);
    for (const [a, b] of [[0, 1], [1, 2], [2, 3], [4, 5], [5, 6], [6, 7], [0, 4], [1, 5], [2, 6], [3, 7]]) form = reduce(form, { type: 'add', list: 'members', seed: { i: ids[a], j: ids[b] } });
    form = reduce(form, { type: 'add', list: 'supports', seed: { node: ids[0], preset: 'fixed' } });
    form = reduce(form, { type: 'add', list: 'supports', seed: { node: ids[3], preset: 'pin' } });
    form = reduce(form, { type: 'add', list: 'loads', seed: { node: ids[7], fx: 10, fy: -5 } });
    form = reduce(form, { type: 'add', list: 'memberLoads', seed: { member: form.members[3].id, kind: 'udl', w: -2 } });
    const { model } = toEngine(form);
    const out = solve(model);
    if (!out.ok) throw new Error(JSON.stringify(out.issues));
    expect(out.free.length).toBeGreaterThan(12);
    const w = worst(replay(out, model));
    expect(w.error, w.where).toBeLessThanOrEqual(1e-12);
  });
  it('the replay itself notices a step that is wrong (a number in a matrix changed by one part in a million)', () => {
    const form = reduce(emptyStiffness('us'), { type: 'template', template: 'frame-portal' });
    const { model } = toEngine(form);
    const out = solve(model);
    if (!out.ok) throw new Error('x');
    const bad = JSON.parse(JSON.stringify(out));
    const k = bad.steps.find((s: { key: string }) => s.key === 'local-stiffness#3').blocks.find((b: { name: string }) => b.name === 'k');
    k.values[1][2] *= 1 + 1e-6;
    k.values[2][1] = k.values[1][2];
    expect(worst(replay(bad, model)).error).toBeGreaterThan(1e-9);
    const bad2 = JSON.parse(JSON.stringify(out));
    const u = bad2.steps.find((s: { key: string }) => s.key === 'displacements').blocks[0];
    const at = u.values.findIndex((v: number) => v !== 0);
    u.values[at] *= 1.001;
    expect(worst(replay(bad2, model)).error).toBeGreaterThan(1e-6);
    const bad3 = JSON.parse(JSON.stringify(out));
    const pass = bad3.steps.find((s: { key: string }) => s.key === 'forward-pass#2').blocks.find((b: { type: string }) => b.type === 'matrix');
    pass.values[3][4] += 1;
    expect(worst(replay(bad3, model)).error).toBeGreaterThan(1e-9);
  });
});
