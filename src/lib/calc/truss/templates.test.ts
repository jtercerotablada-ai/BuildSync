import { afterEach, describe, expect, it, vi } from 'vitest';

// Heavy by design (thousands of generated cases, whole-tool renders): a loaded machine runs a full suite past the 5 s default.
vi.setConfig({ testTimeout: 120_000 });
import { solveTruss } from './engine';
import { rng } from './oracle.testlib';
import {
  TEMPLATE_DEFAULTS,
  TEMPLATE_IDS,
  TEMPLATE_SPECS,
  buildTemplate,
  validateTemplate,
  type TemplateId,
  type TemplateParams,
} from './templates';
import { MAX_MEMBERS, MAX_NODES, type TrussModel, type TrussSolution } from './types';

afterEach(() => new Promise<void>((resolve) => setTimeout(resolve, 0)));

/**
 * THE TEMPLATES. A template is a truss made from a few numbers, so what has to
 * hold is: it is the truss it says it is (counts, numbering, geometry), it is
 * a STABLE truss at every size it is willing to build, it is held as asked, it
 * is loaded as the header says, and asking for what it cannot build gets the
 * nearest it can, with the change SAID.
 */

const modelOf = (id: TemplateId, p: Partial<TemplateParams> = {}, units: 'us' | 'si' = 'us'): TrussModel => {
  const t = buildTemplate(id, p, units);
  return { nodes: t.nodes, members: t.members, supports: t.supports, loads: t.loads };
};
const solved = (m: TrussModel): TrussSolution => {
  const out = solveTruss(m);
  if (!out.ok) throw new Error(JSON.stringify(out.issues));
  return out;
};
const near = (a: number, b: number, tol = 1e-9, scale = Math.max(1, Math.abs(b))) => expect(Math.abs(a - b)).toBeLessThanOrEqual(tol * scale);

/** Nodes and members each template must have, by panels n. */
const COUNTS: Record<TemplateId, (n: number) => { nodes: number; members: number }> = {
  triangle: () => ({ nodes: 3, members: 3 }),
  'king-post': () => ({ nodes: 4, members: 5 }),
  'queen-post': () => ({ nodes: 6, members: 9 }),
  pratt: (n) => ({ nodes: 2 * n + 2, members: 4 * n + 1 }),
  howe: (n) => ({ nodes: 2 * n + 2, members: 4 * n + 1 }),
  'warren-verticals': (n) => ({ nodes: 2 * n + 2, members: 4 * n + 1 }),
  warren: (n) => ({ nodes: 2 * n + 1, members: 4 * n - 1 }),
  fink: () => ({ nodes: 7, members: 11 }),
  cantilever: (n) => ({ nodes: 2 * n + 2, members: 4 * n + 1 }),
};

describe('templates: what each one is', () => {
  it('every template at its defaults, in both unit systems, builds a truss the engine solves', () => {
    for (const units of ['us', 'si'] as const) {
      for (const id of TEMPLATE_IDS) {
        const t = buildTemplate(id, {}, units);
        expect(t.clamped, `${id} ${units}`).toEqual([]);
        const s = solved({ nodes: t.nodes, members: t.members, supports: t.supports, loads: t.loads });
        expect(s.determinacy.word, `${id} ${units}`).toBe('determinate');
      }
    }
  });

  it('the node and member counts of every template at every panel count it offers', () => {
    for (const id of TEMPLATE_IDS) {
      const spec = TEMPLATE_SPECS[id];
      for (let n = spec.panels.min; n <= spec.panels.max; n += spec.panels.even ? 2 : 1) {
        const t = buildTemplate(id, { panels: n }, 'us');
        const want = COUNTS[id](t.used.panels);
        expect(t.nodes.length, `${id} ${n} nodes`).toBe(want.nodes);
        expect(t.members.length, `${id} ${n} members`).toBe(want.members);
        expect(t.nodes.length).toBeLessThanOrEqual(MAX_NODES);
        expect(t.members.length).toBeLessThanOrEqual(MAX_MEMBERS);
      }
    }
  });

  it('every template, at every panel count and several shapes, is a STABLE, DETERMINATE truss in equilibrium', () => {
    for (const id of TEMPLATE_IDS) {
      const spec = TEMPLATE_SPECS[id];
      for (let n = spec.panels.min; n <= spec.panels.max; n += spec.panels.even ? 2 : 1) {
        for (const [span, height] of [[30, 6], [100, 1], [10, 10], [24, 0.24]]) {
          const m = modelOf(id, { span, height, panels: n, load: 5 });
          const s = solved(m);
          expect(s.determinacy.degree, `${id} n=${n}`).toBe(0);
          const e = s.equilibrium;
          const top = Math.max(...s.members.map((x) => Math.abs(x.N)));
          near(e.sumFx, 0, 1e-9, e.scale + top);
          near(e.sumFy, 0, 1e-9, e.scale + top);
          near(e.joint, 0, 1e-9, e.scale + top);
        }
      }
    }
  });

  it('NUMBERING: the bottom chord left to right first, then the rest of the top chord left to right; members bottom chord, top chord, verticals, diagonals', () => {
    for (const id of ['pratt', 'howe', 'warren-verticals', 'cantilever'] as const) {
      const n = 6;
      const t = buildTemplate(id, { span: 30, height: 5, panels: n }, 'us');
      for (let i = 0; i <= n; i++) {
        expect(t.nodes[i]).toEqual({ x: (i * 30) / n, y: 0 });
        expect(t.nodes[n + 1 + i]).toEqual({ x: (i * 30) / n, y: 5 });
      }
      // Bottom chord members (both ends on y = 0), then top chord (both on y = 5), then verticals (same x), then diagonals.
      const kind = t.members.map((m) => {
        const a = t.nodes[m.i];
        const b = t.nodes[m.j];
        return a.y === 0 && b.y === 0 ? 'bottom' : a.y === 5 && b.y === 5 ? 'top' : a.x === b.x ? 'vertical' : 'diagonal';
      });
      expect(kind.slice(0, n)).toEqual(Array(n).fill('bottom'));
      expect(kind.slice(n, 2 * n)).toEqual(Array(n).fill('top'));
      expect(kind.slice(2 * n, 3 * n + 1)).toEqual(Array(n + 1).fill('vertical'));
      expect(kind.slice(3 * n + 1)).toEqual(Array(n).fill('diagonal'));
      // Left to right inside the bottom chord.
      for (let i = 0; i < n; i++) expect(t.members[i]).toEqual({ i, j: i + 1 });
    }
    const w = buildTemplate('warren', { span: 8, height: 4, panels: 2 }, 'us');
    expect(w.nodes.slice(0, 3).map((p) => [p.x, p.y])).toEqual([[0, 0], [4, 0], [8, 0]]);
    expect(w.nodes.slice(3).map((p) => [p.x, p.y])).toEqual([[2, 4], [6, 4]]);
    // The nodes are strictly left to right inside each chord, for every template.
    for (const id of TEMPLATE_IDS) {
      const t = buildTemplate(id, {}, 'us');
      const bottom = t.nodes.filter((p) => p.y === 0).map((p) => p.x);
      expect(bottom).toEqual([...bottom].sort((a, b) => a - b));
      expect(t.nodes.slice(0, bottom.length).every((p) => p.y === 0)).toBe(true);
    }
  });

  it('GEOMETRY of each, from the header', () => {
    const L = 24;
    const h = 6;
    const at = (id: TemplateId) => buildTemplate(id, { span: L, height: h, panels: 4 }, 'us').nodes.map((p) => [p.x, p.y]);
    expect(at('triangle')).toEqual([[0, 0], [24, 0], [12, 6]]);
    expect(at('king-post')).toEqual([[0, 0], [12, 0], [24, 0], [12, 6]]);
    expect(at('queen-post')).toEqual([[0, 0], [6, 0], [18, 0], [24, 0], [6, 6], [18, 6]]);
    expect(at('fink')).toEqual([[0, 0], [8, 0], [16, 0], [24, 0], [6, 3], [12, 6], [18, 3]]);
    // The Pratt's diagonals fall towards the centre; the Howe's rise.
    const pr = buildTemplate('pratt', { span: L, height: h, panels: 4 }, 'us');
    const diagonals = pr.members.slice(13);
    expect(diagonals).toEqual([{ i: 5, j: 1 }, { i: 6, j: 2 }, { i: 2, j: 8 }, { i: 3, j: 9 }]);
    const ho = buildTemplate('howe', { span: L, height: h, panels: 4 }, 'us');
    expect(ho.members.slice(13)).toEqual([{ i: 0, j: 6 }, { i: 1, j: 7 }, { i: 7, j: 3 }, { i: 8, j: 4 }]);
    // Warren with verticals alternates.
    const wv = buildTemplate('warren-verticals', { span: L, height: h, panels: 4 }, 'us');
    expect(wv.members.slice(13)).toEqual([{ i: 0, j: 6 }, { i: 6, j: 2 }, { i: 2, j: 8 }, { i: 8, j: 4 }]);
  });
});

describe('templates: the way each one carries load', () => {
  it('PRATT under gravity: diagonals in tension, verticals and top chord in compression, bottom chord in tension — for every even panel count', () => {
    for (let n = 2; n <= 18; n += 2) {
      const s = solved(modelOf('pratt', { span: 6 * n, height: 6, panels: n, load: 10 }));
      for (const m of s.members.slice(0, n)) expect(m.N, `bottom n=${n}`).toBeGreaterThanOrEqual(0);
      for (const m of s.members.slice(n, 2 * n)) expect(m.N, `top n=${n}`).toBeLessThan(0);
      for (const m of s.members.slice(2 * n, 3 * n + 1)) expect(m.N, `vertical n=${n}`).toBeLessThanOrEqual(1e-9);
      for (const m of s.members.slice(3 * n + 1)) expect(m.N, `diagonal n=${n}`).toBeGreaterThan(0);
    }
  });

  it('HOWE under gravity: diagonals in compression, and every interior vertical in tension (or nothing)', () => {
    for (let n = 2; n <= 18; n += 2) {
      const s = solved(modelOf('howe', { span: 6 * n, height: 6, panels: n, load: 10 }));
      for (const m of s.members.slice(3 * n + 1)) expect(m.N, `diagonal n=${n}`).toBeLessThan(0);
      for (const m of s.members.slice(2 * n + 1, 3 * n)) expect(m.N, `interior vertical n=${n}`).toBeGreaterThanOrEqual(-1e-9);
    }
  });

  it('Pratt and Howe carry the same load to the same reactions, and differ in the chords: by hand the top chord is -15, -20, -20, -15 in the Pratt and 0, -15, -15, 0 in the Howe', () => {
    const p = solved(modelOf('pratt', { panels: 4, span: 32, height: 8, load: 10 }));
    const h = solved(modelOf('howe', { panels: 4, span: 32, height: 8, load: 10 }));
    expect(p.reactions.map((r) => r.ry)).toEqual(h.reactions.map((r) => r.ry));
    expect(p.members.slice(4, 8).map((m) => Math.round(m.N))).toEqual([-15, -20, -20, -15]);
    expect(h.members.slice(4, 8).map((m) => Math.round(m.N) + 0)).toEqual([0, -15, -15, 0]);
  });

  it('every symmetric template under symmetric load has symmetric reactions: half the total load each', () => {
    for (const id of ['triangle', 'king-post', 'queen-post', 'pratt', 'howe', 'warren', 'warren-verticals', 'fink'] as TemplateId[]) {
      const t = buildTemplate(id, { load: 10 }, 'us');
      const s = solved({ nodes: t.nodes, members: t.members, supports: t.supports, loads: t.loads });
      const total = -t.loads.reduce((a, l) => a + l.fy, 0);
      if (id === 'warren-verticals') continue; // its alternating diagonals are not symmetric, and neither are the member forces; the reactions are
      near(s.reactions[0].ry, total / 2, 1e-9, 100);
      near(s.reactions[1].ry, total / 2, 1e-9, 100);
    }
    const t = buildTemplate('warren-verticals', { load: 10 }, 'us');
    const s = solved({ nodes: t.nodes, members: t.members, supports: t.supports, loads: t.loads });
    near(s.reactions[0].ry, s.reactions[1].ry, 1e-9, 100);
  });

  it('CANTILEVER under gravity: the top chord pulls, the bottom chord pushes, the diagonals pull', () => {
    for (let n = 1; n <= 19; n += 3) {
      const s = solved(modelOf('cantilever', { span: 4 * n, height: 4, panels: n, load: 10 }));
      for (const m of s.members.slice(n, 2 * n)) expect(m.N, `top n=${n}`).toBeGreaterThanOrEqual(0);
      for (const m of s.members.slice(0, n)) expect(m.N, `bottom n=${n}`).toBeLessThanOrEqual(0);
      for (const m of s.members.slice(3 * n + 1)) expect(m.N, `diagonal n=${n}`).toBeGreaterThan(0);
      // The wall: a pin at the top of the wall and a horizontal roller at the bottom.
      const pin = s.reactions.find((r) => r.kind === 'pin')!;
      const roller = s.reactions.find((r) => r.kind === 'roller')!;
      expect(roller.ry).toBe(0);
      near(pin.rx, -roller.rx, 1e-9, 1000);
      // The moment of the load about the wall is carried by the couple of the two reactions: R_h · depth.
      expect(Math.abs(roller.rx)).toBeGreaterThan(0);
    }
  });

  it('the KING POST carries nothing in its post; the QUEEN POST nothing in its diagonal — and both are said to be zero members', () => {
    const k = solved(modelOf('king-post'));
    expect(k.members[4].N).toBe(0);
    const q = solved(modelOf('queen-post'));
    expect(q.members[8].N).toBe(0);
    expect(q.members[8].zero).toBe(true);
  });

  it('WARREN with no verticals under a load on every top joint: the diagonals alternate between compression and tension', () => {
    const s = solved(modelOf('warren', { span: 40, height: 5, panels: 5, load: 10 }));
    const diagonals = s.members.slice(5 + 4);
    const first = Math.sign(diagonals[0].N);
    expect(first).toBe(-1);
    // Left half: B(i)→T(i) in compression, T(i)→B(i+1) in tension, alternately, until the centre.
    expect(diagonals.slice(0, 4).map((m) => Math.sign(m.N))).toEqual([-1, 1, -1, 1]);
  });
});

describe('templates: supports and loads', () => {
  it('the support layouts: a pin at the left and a roller (vertical) at the right; the other way round; two pins', () => {
    for (const id of TEMPLATE_IDS.filter((x) => x !== 'cantilever')) {
      const l = buildTemplate(id, { supports: 'pin-roller' }, 'us');
      const r = buildTemplate(id, { supports: 'roller-pin' }, 'us');
      const p = buildTemplate(id, { supports: 'two-pins' }, 'us');
      const left = l.supports[0].node;
      const right = l.supports[1].node;
      expect(l.nodes[left].x).toBe(0);
      expect(l.nodes[right].x).toBe(l.used.span);
      expect(l.supports).toEqual([{ node: left, kind: 'pin' }, { node: right, kind: 'roller', angle: 90 }]);
      expect(r.supports).toEqual([{ node: left, kind: 'roller', angle: 90 }, { node: right, kind: 'pin' }]);
      expect(p.supports).toEqual([{ node: left, kind: 'pin' }, { node: right, kind: 'pin' }]);
      // Two pins make it indeterminate by one.
      const s = solved({ nodes: p.nodes, members: p.members, supports: p.supports, loads: p.loads });
      expect(s.determinacy.degree).toBe(1);
    }
  });

  it('the cantilever is held by a wall: a pin at the top and a roller at the bottom with a horizontal reaction; no other layout', () => {
    const c = buildTemplate('cantilever', { panels: 3, supports: 'pin-roller' }, 'us');
    expect(c.used.supports).toBe('wall');
    expect(c.clamped).toContainEqual({ field: 'supports', asked: 'pin-roller', used: 'wall' });
    expect(c.supports).toEqual([{ node: 4 + 0, kind: 'pin' }, { node: 0, kind: 'roller', angle: 0 }]);
    expect(c.nodes[c.supports[0].node]).toEqual({ x: 0, y: c.used.height });
    expect(c.nodes[c.supports[1].node]).toEqual({ x: 0, y: 0 });
  });

  it('the wall layout is not offered to the others', () => {
    for (const id of TEMPLATE_IDS.filter((x) => x !== 'cantilever')) {
      const t = buildTemplate(id, { supports: 'wall' }, 'us');
      expect(t.used.supports).toBe('pin-roller');
      expect(t.clamped).toContainEqual({ field: 'supports', asked: 'wall', used: 'pin-roller' });
    }
  });

  it('LOADS: gravity (negative fy) on the top chord, half at its ends — except Warren without verticals, where every top joint is a whole one', () => {
    for (const id of TEMPLATE_IDS) {
      const t = buildTemplate(id, { load: 8 }, 'us');
      expect(t.loads.every((l) => l.fx === 0 && l.fy < 0)).toBe(true);
      expect(t.loads.every((l) => !Object.is(l.fx, -0))).toBe(true);
      const fys = t.loads.map((l) => -l.fy);
      if (id === 'warren') expect(fys.every((v) => v === 8)).toBe(true);
      else {
        expect(fys[0]).toBe(4);
        expect(fys[fys.length - 1]).toBe(4);
        expect(fys.slice(1, -1).every((v) => v === 8)).toBe(true);
      }
      // Each load is on a node of the top chord: a node that exists, once.
      expect(new Set(t.loads.map((l) => l.node)).size).toBe(t.loads.length);
      t.loads.forEach((l) => expect(l.node).toBeLessThan(t.nodes.length));
    }
  });

  it('the load per node can be anything finite: zero is a truss with no load; negative is uplift', () => {
    expect(buildTemplate('pratt', { load: 0 }, 'us').loads.every((l) => l.fy === 0 && !Object.is(l.fy, -0))).toBe(true);
    const up = buildTemplate('pratt', { load: -5 }, 'us');
    expect(up.loads.every((l) => l.fy > 0)).toBe(true);
    expect(up.clamped).toEqual([]);
  });

  it('the total load is the load of a node times the number of top panels, for every size', () => {
    for (let n = 2; n <= 18; n += 2) {
      const t = buildTemplate('pratt', { panels: n, load: 3 }, 'us');
      near(-t.loads.reduce((a, l) => a + l.fy, 0), 3 * n, 1e-12);
    }
    const w = buildTemplate('warren', { panels: 7, load: 3 }, 'us');
    near(-w.loads.reduce((a, l) => a + l.fy, 0), 3 * 7, 1e-12);
  });
});

describe('templates: asking for what cannot be built', () => {
  it('panels are brought to the least, the most, and an even number where the shape needs one — and it is said', () => {
    expect(buildTemplate('pratt', { panels: 5 }, 'us').used.panels).toBe(6);
    expect(buildTemplate('pratt', { panels: 5 }, 'us').clamped).toContainEqual({ field: 'panels', asked: 5, used: 6 });
    expect(buildTemplate('pratt', { panels: 18 }, 'us').used.panels).toBe(18);
    expect(buildTemplate('pratt', { panels: 19 }, 'us').used.panels).toBe(18);
    expect(buildTemplate('pratt', { panels: 100 }, 'us').used.panels).toBe(18);
    expect(buildTemplate('howe', { panels: 1 }, 'us').used.panels).toBe(2);
    expect(buildTemplate('howe', { panels: -4 }, 'us').used.panels).toBe(2);
    expect(buildTemplate('warren', { panels: 1 }, 'us').used.panels).toBe(2);
    expect(buildTemplate('warren', { panels: 20 }, 'us').used.panels).toBe(19);
    expect(buildTemplate('cantilever', { panels: 0 }, 'us').used.panels).toBe(1);
    expect(buildTemplate('cantilever', { panels: 4.4 }, 'us').used.panels).toBe(4);
    expect(buildTemplate('cantilever', { panels: 4.4 }, 'us').clamped).toContainEqual({ field: 'panels', asked: 4.4, used: 4 });
    expect(buildTemplate('pratt', { panels: NaN }, 'us').used.panels).toBe(TEMPLATE_DEFAULTS.us.pratt.panels);
    expect(buildTemplate('pratt', { panels: 4 }, 'us').clamped).toEqual([]);
  });

  it('a shape with a fixed pattern ignores the panels and does not complain', () => {
    for (const id of ['triangle', 'king-post', 'queen-post', 'fink'] as TemplateId[]) {
      const a = buildTemplate(id, { panels: 9 }, 'us');
      const b = buildTemplate(id, {}, 'us');
      expect(a.nodes).toEqual(b.nodes);
      expect(a.clamped).toEqual([]);
    }
  });

  it('a span or height that is not a positive number is replaced by the default of the unit system; a height is kept between a hundredth of the span and twice it', () => {
    for (const bad of [0, -3, NaN, Infinity, undefined]) {
      const t = buildTemplate('pratt', { span: bad as number, height: bad as number }, 'us');
      expect(t.used.span).toBe(TEMPLATE_DEFAULTS.us.pratt.span);
      expect(t.used.height).toBe(TEMPLATE_DEFAULTS.us.pratt.height);
      expect(buildTemplate('pratt', { span: bad as number }, 'si').used.span).toBe(TEMPLATE_DEFAULTS.si.pratt.span);
    }
    expect(buildTemplate('pratt', { span: 100, height: 0.5 }, 'us').used.height).toBe(1);
    expect(buildTemplate('pratt', { span: 100, height: 500 }, 'us').used.height).toBe(200);
    expect(buildTemplate('pratt', { span: 100, height: 500 }, 'us').clamped).toContainEqual({ field: 'height', asked: 500, used: 200 });
    expect(buildTemplate('pratt', { span: 100, height: 1 }, 'us').clamped).toEqual([]);
    expect(buildTemplate('pratt', { span: -5 }, 'us').clamped).toContainEqual({ field: 'span', asked: -5, used: 32 });
  });

  it('a load that is not a number is replaced by the default; the rest is left alone', () => {
    expect(buildTemplate('pratt', { load: NaN }, 'us').used.load).toBe(10);
    expect(buildTemplate('pratt', { load: Infinity }, 'si').used.load).toBe(40);
    expect(buildTemplate('pratt', { load: 12.5 }, 'si').used.load).toBe(12.5);
  });

  it('validateTemplate is the same decision without building anything', () => {
    for (const id of TEMPLATE_IDS) {
      const a = validateTemplate(id, { span: 50, height: 7, panels: 5, load: 2 }, 'us');
      const b = buildTemplate(id, { span: 50, height: 7, panels: 5, load: 2 }, 'us');
      expect(a.used).toEqual(b.used);
      expect(a.clamped).toEqual(b.clamped);
    }
  });

  it('whatever it is asked, it builds a truss the engine can solve — random garbage in, a solved truss out', () => {
    const rand = rng(21);
    const junk = [NaN, Infinity, -Infinity, 0, -1, 1e-9, 1e9, 3.7, 2, 7, 19, 50, undefined, null, 'x', {}];
    const layouts: unknown[] = ['pin-roller', 'roller-pin', 'two-pins', 'wall', 'sideways', undefined, null, 5];
    for (let t = 0; t < 300; t++) {
      const id = TEMPLATE_IDS[Math.floor(rand() * TEMPLATE_IDS.length)];
      const ask = {
        span: junk[Math.floor(rand() * junk.length)],
        height: junk[Math.floor(rand() * junk.length)],
        panels: junk[Math.floor(rand() * junk.length)],
        load: junk[Math.floor(rand() * junk.length)],
        supports: layouts[Math.floor(rand() * layouts.length)],
      } as unknown as Partial<TemplateParams>;
      const built = buildTemplate(id, ask, rand() < 0.5 ? 'us' : 'si');
      const out = solveTruss({ nodes: built.nodes, members: built.members, supports: built.supports, loads: built.loads });
      expect(out.ok, `${id} ${JSON.stringify(ask)} → ${JSON.stringify(built.used)}`).toBe(true);
      expect(built.nodes.length).toBeLessThanOrEqual(MAX_NODES);
      expect(built.members.length).toBeLessThanOrEqual(MAX_MEMBERS);
    }
  });

  it('the defaults of both unit systems are the same trusses (feet and metres) in the number of panels, and the loads are about the same weight', () => {
    for (const id of TEMPLATE_IDS) {
      expect(TEMPLATE_DEFAULTS.us[id].panels).toBe(TEMPLATE_DEFAULTS.si[id].panels);
      const ratio = (TEMPLATE_DEFAULTS.us[id].span * 0.3048) / TEMPLATE_DEFAULTS.si[id].span;
      expect(ratio).toBeGreaterThan(0.6);
      expect(ratio).toBeLessThan(1.4);
    }
  });
});
