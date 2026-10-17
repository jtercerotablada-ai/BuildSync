import { describe, expect, it } from 'vitest';
import { analyseSafely } from './analysis';
import { CLAMP_WHY, ENGINE_ISSUE_CODES, ISSUE_CODES, NOTICE_CODES, WARNING_CODES } from './codes';
import { solveFrame } from './engine';
import { defaultFrame, reduceFrame } from './model';
import { clampParams } from './templates';
import type { FrameIssueCode, FrameModel } from './types';

/**
 * Every code the page has to write a sentence for is produced here, by a model made for it — a code nothing can produce is dead
 * weight in the page's strings, and a code nothing tests is a sentence nobody has read. (The details of each, and the numbers it
 * carries, are diagnostics.test.ts's.)
 */

const base = (o: Partial<FrameModel> = {}): FrameModel => ({ nodes: [{ x: 0, y: 0 }, { x: 10, y: 0 }], members: [{ i: 0, j: 1 }], supports: [{ node: 0, kind: 'fixed' }], loads: [], memberLoads: [], E: 1000, A: 10, I: 100, ...o });
const arch = (o: Partial<FrameModel> = {}): FrameModel => ({
  nodes: [{ x: 0, y: 0 }, { x: 12, y: 6 }, { x: 24, y: 0 }],
  members: [{ i: 0, j: 1, releases: { end: true } }, { i: 1, j: 2, releases: { start: true } }],
  supports: [{ node: 0, kind: 'pin' }, { node: 2, kind: 'pin' }],
  loads: [{ node: 1, fx: 0, fy: -10, m: 0 }],
  memberLoads: [],
  E: 1000,
  A: 10,
  I: 100,
  ...o,
});
const portal = (o: Partial<FrameModel> = {}): FrameModel => ({
  nodes: [{ x: 0, y: 0 }, { x: 20, y: 0 }, { x: 0, y: 10 }, { x: 20, y: 10 }],
  members: [{ i: 0, j: 2 }, { i: 1, j: 3 }, { i: 2, j: 3 }],
  supports: [{ node: 0, kind: 'pin' }, { node: 1, kind: 'pin' }],
  loads: [{ node: 2, fx: 10, fy: 0, m: 0 }],
  memberLoads: [],
  E: 1000,
  A: 10,
  I: 100,
  ...o,
});

const TRIGGERS: Record<FrameIssueCode, FrameModel> = {
  'few-nodes': base({ nodes: [{ x: 0, y: 0 }], members: [] }),
  'no-members': base({ members: [] }),
  'too-big': base({ supports: Array.from({ length: 41 }, () => ({ node: 0, kind: 'pin' as const })) }),
  number: base({ loads: [{ node: 0, fx: Number.NaN, fy: 0, m: 0 }] }),
  section: base({ E: -1 }),
  'member-node': base({ members: [{ i: 0, j: 4 }] }),
  'zero-length': base({ members: [{ i: 0, j: 0 }] }),
  'duplicate-node': base({ nodes: [{ x: 0, y: 0 }, { x: 10, y: 0 }, { x: 0, y: 0 }] }),
  'short-member': base({ nodes: [{ x: 0, y: 0 }, { x: 100, y: 0 }, { x: 100.0001, y: 0 }], members: [{ i: 0, j: 1 }, { i: 1, j: 2 }] }),
  'duplicate-member': base({ members: [{ i: 0, j: 1 }, { i: 1, j: 0 }] }),
  'node-unconnected': base({ nodes: [{ x: 0, y: 0 }, { x: 10, y: 0 }, { x: 5, y: 5 }] }),
  disconnected: base({ nodes: [{ x: 0, y: 0 }, { x: 10, y: 0 }, { x: 20, y: 0 }, { x: 30, y: 0 }], members: [{ i: 0, j: 1 }, { i: 2, j: 3 }] }),
  'support-node': base({ supports: [{ node: 9, kind: 'fixed' }] }),
  'support-kind': base({ supports: [{ node: 0, kind: 'wall' as never }] }),
  'duplicate-support': base({ supports: [{ node: 0, kind: 'fixed' }, { node: 0, kind: 'pin' }] }),
  spring: base({ supports: [{ node: 0, kind: 'spring', kx: -1 }] }),
  'load-node': base({ loads: [{ node: 7, fx: 1, fy: 0, m: 0 }] }),
  'load-member': base({ memberLoads: [{ kind: 'udl', member: 4, dir: 'global-y', w: 1 }] }),
  'load-kind': base({ memberLoads: [{ kind: 'udl', member: 0, dir: 'up' as never, w: 1 }] }),
  'load-position': base({ memberLoads: [{ kind: 'point', member: 0, dir: 'global-y', a: 11, P: 1 }] }),
  depth: base({ memberLoads: [{ kind: 'temperature', member: 0, dT: 0, dTg: 5, alpha: 1e-5 }] }),
  'few-supports': base({ supports: [{ node: 0, kind: 'pin' }] }),
  unrestrained: base({ supports: [{ node: 0, kind: 'pin' }, { node: 1, kind: 'roller', angle: 0 }] }),
  mechanism: portal({ members: [{ i: 0, j: 2 }, { i: 1, j: 3 }, { i: 2, j: 3, releases: { start: true, end: true } }] }),
  'hinged-joint-moment': arch({ loads: [{ node: 1, fx: 0, fy: -10, m: 5 }] }),
  sections: portal({ I: undefined }),
  'ill-conditioned': portal({ A: 1e25 }),
  size: { ...base({ memberLoads: [{ kind: 'udl', member: 0, dir: 'global-y', w: -1e30 }], E: 1e-30, A: 1e-30, I: 1e-30 }), nodes: [{ x: 0, y: 0 }, { x: 1e30, y: 0 }] },
  stopped: new Proxy({}, { get() { throw new Error('boom'); } }) as FrameModel,
};

describe('every code can be produced', () => {
  it('the engine: one model for each of its codes, and the table has no other', () => {
    expect(Object.keys(TRIGGERS).sort()).toEqual([...ENGINE_ISSUE_CODES].sort());
    for (const code of ENGINE_ISSUE_CODES) {
      const out = solveFrame(TRIGGERS[code]);
      expect(out.ok, code).toBe(false);
      if (!out.ok) expect(out.issues.map((i) => i.code), code).toContain(code);
    }
  });
  it('the analysis: the two it adds, and each of the others reaches the page with its label', () => {
    const f = reduceFrame(reduceFrame(defaultFrame(), { type: 'add', list: 'nodes', seed: { x: 0, y: 0 } }), { type: 'add', list: 'nodes', seed: { x: 0, y: 0 } });
    expect(analyseSafely(f).issues.map((i) => i.code)).toContain('duplicate-nodes');
    const g = analyseSafely({ ...defaultFrame(), nodes: [...defaultFrame().nodes.slice(0, 3), { id: 4, x: 1e-3, y: 0 }, { id: 90, x: 1e12, y: 0 }] });
    expect(g.issues.map((i) => i.code)).toContain('scale');
    expect(ISSUE_CODES).toHaveLength(ENGINE_ISSUE_CODES.length + 2);
  });
  it('the warnings: no-load, no-stiffness, bar, free-rotation', () => {
    const seen = new Set<string>();
    const note = (m: FrameModel) => {
      const out = solveFrame(m);
      expect(out.ok).toBe(true);
      if (out.ok) for (const w of out.warnings) seen.add(w.code);
      return out;
    };
    note(base());
    note({ ...arch({ loads: [{ node: 1, fx: 0, fy: -10, m: 0 }] }), E: undefined });
    const bar = note(portal({ members: [{ i: 0, j: 2 }, { i: 1, j: 3 }, { i: 2, j: 3, releases: { start: true } }, { i: 0, j: 3, releases: { start: true, end: true } }] }));
    expect(bar.ok && bar.warnings.find((w) => w.code === 'bar')).toEqual({ code: 'bar', members: [3] });
    expect([...seen].sort()).toEqual([...WARNING_CODES].sort());
  });
  it('the notices and the clamps are the lists the page holds', () => {
    expect([...NOTICE_CODES].sort()).toEqual(['limit', 'member-removed', 'node-removed', 'nothing-to-add', 'template']);
    const why = new Set<string>();
    for (const p of [{ bays: 9 }, { bays: 0 }, { bays: 2.2 }, { width: -1 }, { width: Number.NaN }, { base: 'pinned' as const }]) clampParams(p.base ? 'two-hinged' : 'portal', { ...p, ...(p.base ? { base: 'fixed' as const } : {}) }, 'us').clamped.forEach((c) => why.add(c.why));
    clampParams('cantilever-column', { base: 'pinned' }, 'us').clamped.forEach((c) => why.add(c.why));
    expect([...why].sort()).toEqual([...CLAMP_WHY].sort());
  });
});
