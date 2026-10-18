import { createElement as h } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { readFileSync } from 'node:fs';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { analyseSafely } from '@/lib/calc/stiffness/analysis';
import { decodeStiffness, defaultStiffness, emptyStiffness, reduceStiffness, type StiffnessForm } from '@/lib/calc/stiffness/model';
import { stiffnessUi } from '@/lib/calc/stiffness/strings';
import { TEMPLATE_IDS, type TemplateId } from '@/lib/calc/stiffness/templates';
import { build, girder, settling, tall } from './fixtures.testlib';
import { distPointRect, distRectSeg, figureWidth, nodeRadius, rectsNear, segNear, stiffnessLayout, TIE, type Layout, type Looks, type Rect, type Seg } from './layout';
import { StiffnessSchematic } from './Schematic';
import { flaggedNodes } from './text';

vi.setConfig({ testTimeout: 120_000 });
afterEach(() => new Promise<void>((done) => setTimeout(done, 0)));

/**
 * THE FIGURE, held to what it says. Where a mark stands (a support on the axis it holds, an arrow clear of the symbol, a number beside its own arrow),
 * what it is told apart by (a load from a reaction, without colour), and what the legend and the notes say of it (only what is drawn), over the
 * structures the review of the drawing reproduced them on, the seven templates, and random structures. What only the eye can judge - whether it
 * reads - is judged on rendered pictures, in the report that goes with this file.
 */

/** The structures the review of the drawing reproduced its findings on (addresses of the page). */
const ADDR: Record<string, string> = {
  symbols: 'Kvpybnux44v;1;f;us;s,29000,10,100;0,0_10,0_20,0_30,0_40,0_50,0_60,0_70,0;1,2_2,3_3,4_4,5_5,6_6,7_7,8;1,7_2,3_3,2_4,1_5,6_6,5_7,4_8,0;2,5,-8_3,0,-10_4,0,-10,20_5,0,-10,-20_6,0,-10_7,-12,0;',
  rollerX: 'K64nm33ku1r;1;t;us;s,29000,10,100;0,0_10,0_5,8;1,2_1,3_2,3;1,3_2,1;3,0,-10;',
  rxMid: 'K9ownl1821y;1;f;us;s,29000,10,100;0,0_10,0_20,0;1,2_2,3;1,7_2,1_3,2;2,4,-6_3,0,-3;',
  ryTop: 'Kgdh7ciog1e;1;f;us;s,29000,10,100;0,0_0,12;1,2;1,7_2,2;2,3,-6;',
  ryApex: 'K50qwfxii1t;1;t;us;s,29000,10,100;0,0_8,0_4,12;1,2_1,3_2,3;1,3_2,2_3,2;3,5,0;',
  guideX: 'Ky6jqar311p;1;f;us;s,29000,10,100;0,0_0,10_12,10;1,2_2,3;1,7_3,5;2,0,-10;',
  upliftPin: 'Krnxwrp2a22;1;t;us;s,29000,10,100;0,0_16,0_8,6;1,3_2,3_1,2;1,3_2,2;1,0,5_2,-4,6_3,0,8;',
  momentsFrame: 'Kofwyid0q2p;1;f;us;s,29000,10,100;0,0_15,0_15,12_0,12;1,2_2,3_3,4_4,1;1,3_2,2;3,10,-5,40_4,-6,0,-40_2,0,0,25;',
  memberLoadsFrame: 'Kyiuhbsph3l;1;f;us;s,29000,10,100;0,0_0,12_18,12_18,0_9,20;1,2_2,3_3,4_2,5_5,3;1,7_4,3;;u,2,-2_p,4,0,-15,6_u,5,1.5_a,1,0,0,0,1_a,3,0,0,0,-1.5',
  inclinedPoint: 'Kzztn2g2g1j;1;f;us;s,29000,10,100;0,0_12,9;1,2;1,7_2,2;;p,1,0,-20,5',
  inclinedUdl: 'Kso33cl651e;1;f;us;s,29000,10,100;0,0_12,9;1,2;1,7_2,2;;u,1,-2',
  inclinedAxial: 'Koyn8zaan1k;1;f;us;s,29000,10,100;0,0_12,9;1,2;1,7_2,3;;a,1,0,0,0,-2',
  lotsOfLoadsOneNode: 'Ki1vca6xg1z;1;f;us;s,29000,10,100;0,0_20,0;1,2;1,7_2,2;2,3,-4,5_2,-3,-4,-5_2,10,-1;',
  settleTruss: 'K963htl4c2j;1;t;us;s,29000,10,100;0,0_16,0_8,6_24,6;1,2_1,3_2,3_3,4_2,4;1,3_2,2,0,-0.75;3,12,0_4,0,-15;',
  settleFrame: 'Kr6x1w3cf2a;1;f;us;s,29000,10,100;0,0_20,0_0,10_20,10;1,3_2,4_3,4;1,7_2,7,0,-0.5,0.002;3,10,0;',
  tall: 'Kw88i60rq28;1;t;us;s,29000,10,100;0,0_1,0_0,50_1,50;1,3_2,4_3,4_1,4_2,3;1,3_2,2;3,5,0_4,5,0;',
  flat50: 'Kbb8cnl012u;1;t;us;s,29000,10,100;0,0_25,0.5_50,0_75,0.5_100,0;1,2_2,3_3,4_4,5_2,4_1,3_3,5;1,3_5,2;3,0,-10_2,0,-5;',
  ratio1000: 'K0bm5qujo1v;1;t;us;s,29000,10,100;0,0_1000,0_500,1;1,2_1,3_2,3;1,3_2,2;3,0,-10;',
  close: 'Klophplxz1q;1;t;us;s,29000,10,100;0,0_0.001,0_5,4;1,3_2,3;1,3_2,3;3,0,-10;',
  closeFrame: 'Ko1ixu3dv1q;1;f;us;s,29000,10,100;0,0_0.01,0_10,0;1,2_2,3;1,7_3,2;2,0,-10;',
  collinear: 'Kdj3zji9f25;1;f;us;s,29000,10,100;0,0_10,0_20,0_30,0;1,2_2,3_3,4;1,7_4,2;2,0,-10_3,0,-10;',
  single: 'Kk0q4pkoa1d;1;t;us;s,29000,10,100;0,0_10,5;1,2;1,3_2,2;2,5,0;',
  singleFrame: 'Kqkh0d2fn1a;1;f;us;s,29000,10,100;0,0_10,5;1,2;1,7;2,0,-5;',
  vertical: 'Ks0i4ql6l1d;1;f;us;s,29000,10,100;0,0_0,10;1,2;1,7;2,5,-3,10;',
  bigCoord: 'Kkwr8iks22q;1;t;us;s,29000,10,100;1000000,1000000_1000010,1000000_1000005,1000008;1,2_1,3_2,3;1,3_2,2;3,0,-10;',
  tinyCoord: 'Kxwuh83f323;1;t;us;s,29000,10,100;0,0_0.000001,0_5e-7,8e-7;1,2_1,3_2,3;1,3_2,2;3,0,-10;',
  negCoord: 'Kbsjas7hc21;1;t;us;s,29000,10,100;-30,-20_-10,-20_-20,-6;1,2_1,3_2,3;1,3_2,2;3,4,-10;',
  hugeLoad: 'K7dcszc5j2l;1;f;us;s,29000,10,100;0,0_20,0;1,2;1,7_2,2;2,0,1000000000000,1000000000000;u,1,-1000000000000',
  hugeLoadTruss: 'Kmyvw21u92a;1;t;us;s,29000,10,100;0,0_16,0_8,6;1,3_2,3;1,3_2,3;3,1000000000000,-1000000000000;',
  coord1e30: 'Kb93jug2l1z;1;t;us;s,29000,10,100;0,0_1e30,0_5e29,1e30;1,2_1,3_2,3;1,3_2,2;3,0,-10;',
  coord1e300: 'Kes0bikgt22;1;t;us;s,29000,10,100;0,0_1e300,0_5e299,1e300;1,2_1,3_2,3;1,3_2,2;3,0,-10;',
  coordTiny: 'Kwzd4es9q25;1;t;us;s,29000,10,100;0,0_1e-300,0_5e-301,1e-300;1,2_1,3_2,3;1,3_2,2;3,0,-10;',
  load1e30: 'K7a0pwcoi1w;1;t;us;s,29000,10,100;0,0_10,0_5,8;1,2_1,3_2,3;1,3_2,2;3,1e30,-1e30;',
  load1e300: 'Kem1vuxmc1y;1;t;us;s,29000,10,100;0,0_10,0_5,8;1,2_1,3_2,3;1,3_2,2;3,1e300,-1e300;',
  mechTruss: 'K2scpwndz1x;1;t;us;s,29000,10,100;0,0_10,0_20,0_10,8;1,2_2,3_2,4;1,3_3,2;2,0,-10;',
  mechFrame: 'Kwf85hy1e1o;1;f;us;s,29000,10,100;0,0_10,0_20,0;1,2_2,3;1,3_3,2;2,0,-10;',
  mechRigid: 'Kxbnu76oh1v;1;t;us;s,29000,10,100;0,0_10,0_5,8;1,2_2,3_1,3;1,2_2,2_3,2;3,5,-10;',
  noLoad: 'Kxz8wv95918;1;f;us;s,29000,10,100;0,0_20,0;1,2;1,7_2,2;;',
  noMoveLoaded: 'Ksy97nbus1e;1;f;us;s,29000,10,100;0,0_20,0;1,2;1,7_2,7;;u,1,-2',
  noSupports: 'Kc9rrpaor1k;1;t;us;s,29000,10,100;0,0_10,0_5,8;1,2_1,3_2,3;;3,5,-10;',
  oneNode: 'Kleinkuynt;1;t;us;s,29000,10,100;0,0;;;;',
  allSame: 'K3o7jxtea13;1;f;us;s,29000,10,100;0,0_0,0;1,2;1,7;;',
  dup: 'Kvixue2bz1w;1;t;us;s,29000,10,100;0,0_10,0_10,0_5,6;1,4_2,4_3,4;1,3_2,2;4,0,-10;',
  oblique: 'K3rxnbukd1x;1;t;us;s,29000,10,100;0,0_16,0_8,6;1,3_2,3_1,2;1,3_2,2;3,6,-8_2,-3,0;',
  big: 'K80sm7xpm5a;1;f;us;s,29000,10,100;0,0_8,0_16,0_24,0_32,0_40,0_0,6_8,6_16,6_24,6_32,6_40,6;1,2_2,3_3,4_4,5_5,6_7,8_8,9_9,10_10,11_11,12_1,7_2,8_3,9_4,10_5,11_6,12_1,8_2,9_3,10_4,11;1,7_6,3;7,6,-10;u,7,-2',
};
const addr = (key: string): StiffnessForm => {
  const form = decodeStiffness(ADDR[key]);
  if (!form) throw new Error(`no such address: ${key}`);
  return form;
};

const looks = (rest: Partial<Looks> = {}): Looks => ({ loads: true, reactions: true, deformed: true, dofs: true, nodeNumbers: true, memberNumbers: true, values: true, group: ',', ...rest });
const tpl = (id: TemplateId, units: 'us' | 'si' = 'us') => reduceStiffness(emptyStiffness(units), { type: 'template', template: id });
const lay = (form: StiffnessForm, width = 650, rest: Partial<Looks> = {}): Layout => {
  const a = analyseSafely(form);
  return stiffnessLayout(a.drawing, { ...looks({ reactions: a.results !== null, deformed: a.results !== null, ...rest }), width });
};
const finite = (v: unknown): boolean => (typeof v === 'number' ? Number.isFinite(v) : Array.isArray(v) ? v.every(finite) : v && typeof v === 'object' ? Object.values(v).every(finite) : true);

/* ── D1: a support stands on the axis it holds ────────────────────────────── */

type Flags = { ux: boolean; uy: boolean; rz: boolean };
const SYMBOLS: Record<string, { flags: Flags; axis: 'x' | 'y' | 'any' }> = {
  pin: { flags: { ux: true, uy: true, rz: false }, axis: 'any' },
  fixed: { flags: { ux: true, uy: true, rz: true }, axis: 'any' },
  'roller-y': { flags: { ux: false, uy: true, rz: false }, axis: 'y' },
  'roller-x': { flags: { ux: true, uy: false, rz: false }, axis: 'x' },
  'guide-y': { flags: { ux: false, uy: true, rz: true }, axis: 'y' },
  'guide-x': { flags: { ux: true, uy: false, rz: true }, axis: 'x' },
};
/** A node at the origin with a member running to the left (L), the right (R), up (U) and down (D) as asked, and the support on it. */
function star(arms: string, flags: Flags): StiffnessForm {
  const at: Record<string, [number, number]> = { L: [-10, 0], R: [10, 0], U: [0, 10], D: [0, -10] };
  const nodes: [number, number][] = [[0, 0], ...[...arms].map((c) => at[c])];
  const members = [...arms].map((_, k) => [1, k + 2] as [number, number]);
  const f = build({ mode: 'frame', nodes, members, supports: [[1, 'pin']] });
  return reduceStiffness(f, { type: 'patch', list: 'supports', id: f.supports[0].id, patch: flags });
}
const ARMS = ['', 'L', 'R', 'U', 'D', 'LR', 'UD', 'ULR', 'DLR', 'LRUD'];
const PAGE: Record<string, { x: number; y: number }> = { D: { x: 0, y: 1 }, U: { x: 0, y: -1 }, L: { x: -1, y: 0 }, R: { x: 1, y: 0 } };

describe('a support stands on the axis it holds (a roller that holds y is not drawn as one that holds x)', () => {
  for (const [name, { flags, axis }] of Object.entries(SYMBOLS)) {
    it(`${name}: on its own axis whichever sides have a member, on a free side when there is one`, () => {
      for (const arms of ARMS) {
        const l = lay(star(arms, flags), 650, { reactions: false, deformed: false });
        const s = l.supports[0];
        const where = `${name} with members ${arms || 'none'}`;
        if (axis === 'y') expect(Math.abs(s.side.x), where).toBeLessThan(1e-9);
        if (axis === 'x') expect(Math.abs(s.side.y), where).toBeLessThan(1e-9);
        const order = axis === 'y' ? ['D', 'U'] : axis === 'x' ? ['L', 'R'] : ['D', 'U', 'L', 'R'];
        const free = order.find((c) => !arms.includes(c));
        if (free) {
          expect(s.side, where).toEqual(PAGE[free]);
          expect(s.blocked, where).toBe(false);
        } else {
          // Every side of the axis has a member: the symbol stands over one, with a halo, on its own axis still.
          expect(s.blocked, where).toBe(true);
        }
      }
    });
  }
  it('the repros of the review: roller-x in a chain, roller-y at the top of a member, at the apex of a truss, a guide-x in a chain of eight nodes', () => {
    const sym = (key: string, node: number) => lay(addr(key)).supports.find((s) => s.node === node)!;
    expect(Math.abs(sym('rxMid', 2).side.y)).toBeLessThan(1e-9);
    expect(sym('rxMid', 2).symbol).toBe('roller-x');
    expect(sym('ryTop', 2).side).toEqual({ x: 0, y: -1 });
    expect(sym('ryApex', 3).side).toEqual({ x: 0, y: -1 });
    const chain = lay(addr('symbols'));
    expect(Math.abs(chain.supports.find((s) => s.symbol === 'guide-x')!.side.y)).toBeLessThan(1e-9);
    expect(Math.abs(chain.supports.find((s) => s.symbol === 'roller-x')!.side.y)).toBeLessThan(1e-9);
    expect(Math.abs(chain.supports.find((s) => s.symbol === 'roller-y')!.side.x)).toBeLessThan(1e-9);
    expect(Math.abs(chain.supports.find((s) => s.symbol === 'guide-y')!.side.x)).toBeLessThan(1e-9);
  });
});

/* ── D19 (the arrow through its own symbol) ───────────────────────────────── */

describe('an arrow stands clear of the symbol of its own support and of the members at its node', () => {
  const marks = (l: Layout) =>
    [...l.loads.flatMap((x) => x.arrows.map((a) => ({ node: x.node, a }))), ...l.reactions.flatMap((x) => x.arrows.map((a) => ({ node: x.label, a, reaction: true })))].map((m) => ({ ...m, seg: { x1: m.a.tail.x, y1: m.a.tail.y, x2: m.a.tip.x, y2: m.a.tip.y, pad: 0 } as Seg }));
  it('a load that comes from the side the symbol stands on is drawn on the other side (the uplift case, a load on the top of a roller)', () => {
    for (const key of ['upliftPin', 'ryTop', 'ryApex']) {
      const l = lay(addr(key));
      for (const m of marks(l)) {
        if ('reaction' in m) continue;
        for (const s of l.supports) expect(segNear(m.seg, s.box, 0), `${key}: the load at node ${m.node} runs through the symbol of node ${s.node}`).toBe(false);
      }
    }
  });
  it('and not along a member either', () => {
    for (const key of ['upliftPin', 'ryTop', 'ryApex', 'rxMid', 'symbols', 'momentsFrame', 'memberLoadsFrame']) {
      const l = lay(addr(key));
      for (const m of marks(l)) {
        if ('reaction' in m) continue;
        for (const member of l.members) {
          const d = Math.min(...[member].map((q) => distRectSeg({ x0: Math.min(m.seg.x1, m.seg.x2), y0: Math.min(m.seg.y1, m.seg.y2), x1: Math.max(m.seg.x1, m.seg.x2), y1: Math.max(m.seg.y1, m.seg.y2) }, { x1: q.x1, y1: q.y1, x2: q.x2, y2: q.y2, pad: 0 })));
          // (a member that ends on the arrow's own node touches it at the node; an arrow along it would lie on it for its length)
          const along = Math.hypot(m.seg.x2 - m.seg.x1, m.seg.y2 - m.seg.y1) > 0 && distSegOverlap(m.seg, { x1: member.x1, y1: member.y1, x2: member.x2, y2: member.y2, pad: 0 }) > 8;
          expect(along, `${key}: the arrow at node ${m.node} lies along member ${member.label} (${d.toFixed(1)})`).toBe(false);
        }
      }
    }
  });
});
/** How much of segment `a` lies within 2.5 px of segment `b`, px (sampled): an arrow along a member. */
function distSegOverlap(a: Seg, b: Seg): number {
  const len = Math.hypot(a.x2 - a.x1, a.y2 - a.y1);
  let n = 0;
  const steps = 40;
  for (let k = 0; k <= steps; k++) {
    const x = a.x1 + ((a.x2 - a.x1) * k) / steps;
    const y = a.y1 + ((a.y2 - a.y1) * k) / steps;
    const dx = b.x2 - b.x1;
    const dy = b.y2 - b.y1;
    const l2 = dx * dx + dy * dy;
    const t = l2 === 0 ? 0 : Math.max(0, Math.min(1, ((x - b.x1) * dx + (y - b.y1) * dy) / l2));
    if (Math.hypot(x - (b.x1 + t * dx), y - (b.y1 + t * dy)) < 2.5) n++;
  }
  return (n / (steps + 1)) * len;
}

/* ── D2: a number stands beside its own mark ──────────────────────────────── */

interface Labelled {
  name: string;
  box: Layout['placed'][number];
  leader: boolean;
  leaderLine: { x1: number; y1: number; x2: number; y2: number } | null;
  own: { seg?: Seg; ring?: { cx: number; cy: number; r: number } }[];
  others: { seg?: Seg; ring?: { cx: number; cy: number; r: number } }[];
  isRing: boolean;
}
const seg = (t: { x: number; y: number }, u: { x: number; y: number }): Seg => ({ x1: t.x, y1: t.y, x2: u.x, y2: u.y, pad: 0 });
const ringDistance = (r: Rect, c: { cx: number; cy: number; r: number }): number => {
  let best = Infinity;
  for (let k = 0; k < 72; k++) {
    const a = (k / 72) * 2 * Math.PI;
    best = Math.min(best, distPointRect(c.cx + c.r * Math.cos(a), c.cy + c.r * Math.sin(a), r));
  }
  return best;
};
/** Every number of a load, a reaction or a load on a member, with the mark it belongs to and every other mark. */
function labelled(l: Layout): Labelled[] {
  type M = { id: string; seg?: Seg; ring?: { cx: number; cy: number; r: number }; word: Layout['loads'][number]['arrows'][number]['text'] };
  const marks: M[] = [];
  l.loads.forEach((x) => {
    x.arrows.forEach((a, k) => marks.push({ id: `load${x.node}.${k}`, seg: seg(a.tail, a.tip), word: a.text }));
    if (x.arc) marks.push({ id: `loadring${x.node}`, ring: { cx: x.arc.cx, cy: x.arc.cy, r: x.arc.r }, word: x.arc.text });
  });
  l.reactions.forEach((x) => {
    x.arrows.forEach((a, k) => marks.push({ id: `react${x.label}.${k}`, seg: seg(a.tail, a.tip), word: a.text }));
    if (x.arc) marks.push({ id: `reactring${x.label}`, ring: { cx: x.arc.cx, cy: x.arc.cy, r: x.arc.r }, word: x.arc.text });
  });
  const out: Labelled[] = [];
  for (const m of marks) {
    if (!m.word) continue;
    out.push({ name: m.id, box: m.word.rect, leader: m.word.leader != null, leaderLine: m.word.leader ?? null, own: [{ seg: m.seg, ring: m.ring }], others: marks.filter((o) => o !== m).map((o) => ({ seg: o.seg, ring: o.ring })), isRing: m.ring !== undefined });
  }
  l.memberLoads.forEach((x) => {
    if (!x.text) return;
    const own = [...x.arrows.map((a) => ({ seg: seg(a.tail, a.tip) })), ...(x.line ?? []).slice(1).map((p, k) => ({ seg: seg(x.line![k], p) }))];
    out.push({ name: `member load ${x.label}`, box: x.text.rect, leader: x.text.leader != null, leaderLine: x.text.leader ?? null, own, others: marks.map((o) => ({ seg: o.seg, ring: o.ring })), isRing: false });
  });
  return out;
}
const distTo = (box: Rect, m: { seg?: Seg; ring?: { cx: number; cy: number; r: number } }): number => (m.seg ? distRectSeg(box, m.seg) : ringDistance(box, m.ring!));

/** A small seeded generator, so that a failure can be reproduced. */
function rng(seed: number) {
  let s = seed >>> 0;
  return () => {
    s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
    return s / 4294967296;
  };
}
/** A random structure: a connected tree of 2 to 9 nodes with a few extra members, supports of every kind, loads and moments, loads on members. */
function randomForm(seed: number): StiffnessForm {
  const r = rng(seed);
  const pick = (n: number) => Math.floor(r() * n);
  const frame = r() < 0.6;
  const count = 2 + pick(8);
  const used = new Set<string>();
  const nodes: [number, number][] = [];
  while (nodes.length < count) {
    const p: [number, number] = [pick(7) * 5, pick(5) * 4];
    if (!used.has(p.join())) {
      used.add(p.join());
      nodes.push(p);
    }
  }
  const pairs = new Set<string>();
  const members: [number, number][] = [];
  const connect = (i: number, j: number) => {
    const key = `${Math.min(i, j)}-${Math.max(i, j)}`;
    if (i === j || pairs.has(key)) return;
    pairs.add(key);
    members.push([i, j]);
  };
  for (let k = 2; k <= count; k++) connect(k, 1 + pick(k - 1));
  for (let k = 0; k < pick(3); k++) connect(1 + pick(count), 1 + pick(count));
  let f = build({ mode: frame ? 'frame' : 'truss', nodes, members, supports: [] });
  const flags: Flags[] = frame
    ? [SYMBOLS.pin.flags, SYMBOLS.fixed.flags, SYMBOLS['roller-y'].flags, SYMBOLS['roller-x'].flags, SYMBOLS['guide-y'].flags, SYMBOLS['guide-x'].flags]
    : [SYMBOLS.pin.flags, SYMBOLS['roller-y'].flags, SYMBOLS['roller-x'].flags];
  const held = new Set<number>();
  for (let k = 0; k < 1 + pick(3); k++) {
    const n = 1 + pick(count);
    if (held.has(n)) continue;
    held.add(n);
    f = reduceStiffness(f, { type: 'add', list: 'supports', seed: { node: f.nodes[n - 1].id, ...flags[pick(flags.length)] } });
  }
  const val = () => (pick(41) - 20) / 2;
  for (let k = 0; k < 1 + pick(4); k++) f = reduceStiffness(f, { type: 'add', list: 'loads', seed: { node: f.nodes[pick(count)].id, fx: val(), fy: val(), m: frame && r() < 0.4 ? val() : 0 } });
  if (frame) {
    for (let k = 0; k < pick(3); k++) {
      const m = f.members[pick(f.members.length)].id;
      const kind = pick(3);
      f = reduceStiffness(f, { type: 'add', list: 'memberLoads', seed: kind === 0 ? { member: m, kind: 'udl', w: val() || 1 } : kind === 1 ? { member: m, kind: 'point', P: val() || 2, a: 1 } : { member: m, kind: 'axial', q: val() || 1 } });
    }
  }
  return f;
}

describe('every number of a load or a reaction stands beside its own mark (within the cap, or on a hairline), never nearer another', () => {
  const cases: [string, StiffnessForm][] = [
    ...TEMPLATE_IDS.flatMap((id) => [[`${id} us`, tpl(id)] as [string, StiffnessForm], [`${id} si`, tpl(id, 'si')] as [string, StiffnessForm]]),
    ...['upliftPin', 'symbols', 'momentsFrame', 'memberLoadsFrame', 'inclinedPoint', 'inclinedUdl', 'inclinedAxial', 'lotsOfLoadsOneNode', 'settleTruss', 'settleFrame', 'oblique', 'ryApex', 'rxMid', 'big', 'hugeLoad'].map((k) => [k, addr(k)] as [string, StiffnessForm]),
    ['girder frame', girder('frame')],
    ['girder truss', girder('truss')],
    ['settling', settling()],
  ];
  const run = (name: string, form: StiffnessForm, width: number, tally: { n: number; leaders: number }) => {
    const l = lay(form, width);
    for (const m of labelled(l)) {
      tally.n++;
      const own = Math.min(...m.own.map((o) => distTo(m.box, o)));
      if (m.leader) {
        tally.leaders++;
        continue;
      }
      expect(own, `${name} at ${width}px: the number of ${m.name} stands ${own.toFixed(1)} px from it`).toBeLessThanOrEqual(TIE + 0.5);
      // (the two rings of a node are one inside the other: a ring's number is held to its cap only, as against other rings)
      const others = m.others.filter((o) => !(m.isRing && o.ring));
      if (others.length) {
        const near = Math.min(...others.map((o) => distTo(m.box, o)));
        expect(own, `${name} at ${width}px: the number of ${m.name} is ${own.toFixed(1)} px from its own mark and ${near.toFixed(1)} px from another`).toBeLessThanOrEqual(near + 0.75);
      }
    }
  };
  it('on the templates, the structures of the review and the girder, at three widths', () => {
    const tally = { n: 0, leaders: 0 };
    for (const [name, form] of cases) for (const width of [320, 650, 1200]) run(name, form, width, tally);
    expect(tally.n).toBeGreaterThan(300);
  });
  it('on 150 random structures', () => {
    const tally = { n: 0, leaders: 0 };
    for (let seed = 1; seed <= 150; seed++) run(`random ${seed}`, randomForm(seed), 650, tally);
    expect(tally.n).toBeGreaterThan(300);
  });
  it('a number that cannot stand within the cap is tied to its mark by a hairline that starts on the mark and ends at the number (never a number far off, alone)', () => {
    let tied = 0;
    for (const [key, width] of [['hugeLoad', 650], ['big', 650], ['hugeLoad', 320], ['symbols', 320]] as [string, number][]) {
      for (const m of labelled(lay(addr(key), width))) {
        if (!m.leader) continue;
        tied++;
        const line = m.leaderLine!;
        const own = Math.min(...m.own.map((o) => (o.seg ? distPointSeg2(line.x1, line.y1, o.seg) : Math.abs(Math.hypot(line.x1 - o.ring!.cx, line.y1 - o.ring!.cy) - o.ring!.r))));
        expect(own, `${key} ${width}: the hairline of ${m.name} does not start on its mark`).toBeLessThan(1.5);
        expect(distPointRect(line.x2, line.y2, m.box), `${key} ${width}: the hairline of ${m.name} does not end at its number`).toBeLessThan(1);
        expect(Math.hypot(line.x2 - line.x1, line.y2 - line.y1), `${key} ${width}: the hairline of ${m.name} is long`).toBeLessThanOrEqual(46);
      }
    }
    expect(tied).toBeGreaterThan(0);
  });
  it('the number of a reaction beside a load at the same node is not taken for the load (the uplift case)', () => {
    const l = lay(addr('upliftPin'));
    const at1 = labelled(l).filter((m) => m.name.endsWith('1.0') || m.name.endsWith('1.1'));
    expect(at1.length).toBeGreaterThan(1);
    for (const m of at1) expect(Math.min(...m.own.map((o) => distTo(m.box, o))), m.name).toBeLessThanOrEqual(TIE + 0.5);
  });
});

/* ── D3: a reaction is not a load, in black and white ─────────────────────── */

const mainSvg = (html: string): string => /<svg class="mp-plot__svg mp-st-fig__svg"[\s\S]*?<\/svg>/.exec(html)?.[0] ?? '';
const legendHtml = (html: string): string => /<ul class="mp-st-fig__legend">[\s\S]*?<\/ul>/.exec(html)?.[0] ?? '';
function figure(form: StiffnessForm, rest: Partial<Looks> = {}, o: { lang?: 'en' | 'es'; width?: number; paper?: boolean; describedBy?: string; summary?: string } = {}): string {
  const a = analyseSafely(form);
  const w = stiffnessUi[o.lang ?? 'en'];
  return renderToStaticMarkup(
    h(StiffnessSchematic, {
      drawing: a.drawing,
      width: o.width ?? 650,
      widen: !o.paper,
      paper: o.paper === true,
      looks: looks({ reactions: a.results !== null, deformed: a.results !== null, flagged: flaggedNodes(a), ...rest }),
      summary: o.summary ?? 'A structure',
      describedBy: o.describedBy,
      words: { legend: w.drawing.legend, notes: w.drawing.notes, broken: w.drawing.broken },
      units: { length: a.units.length, displacement: a.units.displacement },
    }),
  );
}
const countOf = (html: string, pattern: RegExp): number => (html.match(pattern) ?? []).length;

describe('a load and a reaction differ by shape, so that they differ on a sheet printed in black', () => {
  const css = readFileSync(new URL('./stiffness.css', import.meta.url), 'utf8').replace(/\r\n/g, '\n');
  it('a load is a solid arrow with a solid head; a reaction a dashed arrow with an open head (the drawing and the legend)', () => {
    const html = figure(tpl('frame-portal'));
    const svg = mainSvg(html);
    const reactions = [...svg.matchAll(/<g class="mp-st-fig__reaction" data-mark="reaction[^"]*">([\s\S]*?)<\/g>/g)].map((m) => m[1]);
    const loads = [...svg.matchAll(/<g class="mp-st-fig__load" data-mark="load[^"]*">([\s\S]*?)<\/g>/g)].map((m) => m[1]);
    expect(reactions.length).toBeGreaterThan(2);
    expect(loads.length).toBeGreaterThan(0);
    for (const r of reactions) {
      expect(r).toContain('mp-st-fig__open');
      expect(r).toContain('mp-st-fig__shaft');
      expect(r).not.toContain('<polygon');
    }
    for (const l of loads) {
      expect(l).toContain('<polygon');
      expect(l).not.toContain('mp-st-fig__open');
      expect(l).not.toContain('mp-st-fig__shaft');
    }
    // The legend's swatches are the same marks.
    const legend = legendHtml(html);
    const swatch = (key: string, from = legend) => new RegExp(`<li class="mp-st-fig__key mp-st-fig__key--${key}">[\\s\\S]*?</li>`).exec(from)?.[0] ?? '';
    expect(swatch('reaction')).toContain('mp-st-fig__open');
    expect(swatch('reaction')).not.toContain('<polygon');
    expect(swatch('reactionMoment')).toContain('mp-st-fig__open');
    expect(swatch('reactionMoment')).not.toContain('<polygon');
    expect(swatch('load')).toContain('<polygon');
    expect(swatch('load')).not.toContain('mp-st-fig__open');
    // (a ring of a moment load: a frame with moments at its nodes)
    const moments = legendHtml(figure(addr('momentsFrame')));
    expect(swatch('loadMoment', moments)).toContain('<polygon');
    expect(swatch('loadMoment', moments)).not.toContain('mp-st-fig__open');
    expect(mainSvg(figure(addr('momentsFrame')))).toMatch(/<g class="mp-st-fig__load" data-mark="load-moment"><path d="[^"]*" fill="none"><\/path><polygon/);
  });
  it('the dash is the stylesheet’s, and the sheet does not take it away or paint a reaction a load', () => {
    expect(css).toMatch(/\.mp-st-fig__reaction \.mp-st-fig__shaft\s*\{[^}]*stroke-dasharray:\s*\d/);
    const print = css.slice(css.indexOf('@media print'));
    expect(print).not.toMatch(/mp-st-fig__shaft[^}]*stroke-dasharray:\s*none/);
    expect(print).not.toMatch(/mp-st-fig__reaction[^}]*stroke-dasharray:\s*none/);
  });
});

/* ── D4: the legend and the notes say what is drawn ───────────────────────── */

const MARKS: Record<string, RegExp> = {
  member: /<line class="mp-st-fig__member"/g,
  ghost: /class="mp-st-fig__ghost"/g,
  node: /<g class="mp-st-fig__node(?: mp-st-fig__node--flagged)?">/g,
  nodeDot: /<g class="mp-st-fig__node mp-st-fig__node--dot/g,
  deformed: /class="mp-st-fig__deformed"/g,
  fixed: /<g class="mp-st-fig__support mp-st-fig__support--fixed"/g,
  pin: /<g class="mp-st-fig__support mp-st-fig__support--pin"/g,
  roller: /<g class="mp-st-fig__support mp-st-fig__support--roller"/g,
  guide: /<g class="mp-st-fig__support mp-st-fig__support--guide"/g,
  rotation: /<g class="mp-st-fig__support mp-st-fig__support--rotation"/g,
  settle: /<g class="mp-st-fig__badge"/g,
  load: /data-mark="load"/g,
  loadMoment: /data-mark="load-moment"/g,
  distributed: /data-mark="udl"/g,
  pointLoad: /data-mark="point"/g,
  axialLoad: /data-mark="axial"/g,
  reaction: /data-mark="reaction"/g,
  reactionMoment: /data-mark="reaction-moment"/g,
  values: /data-mark="value"/g,
  leader: /<line class="mp-st-fig__leader"/g,
  dofTag: /<g class="mp-st-fig__dof"/g,
  tag: /<g class="mp-st-fig__tag"/g,
  flagged: /mp-st-fig__node--flagged/g,
};
const legendKeys = (html: string): string[] => [...legendHtml(html).matchAll(/mp-st-fig__key mp-st-fig__key--(\w+)/g)].map((m) => m[1]);

describe('the legend explains the marks that are drawn and no others, under every combination of the switches', () => {
  const SWITCHES = ['loads', 'reactions', 'deformed', 'dofs', 'nodeNumbers', 'memberNumbers', 'values'] as const;
  const forms: [string, StiffnessForm][] = [
    ['a portal with member loads and a settling foot', (() => { let f = tpl('frame-portal'); f = reduceStiffness(f, { type: 'patch', list: 'supports', id: f.supports[1].id, patch: { dy: -0.5 } }); return reduceStiffness(f, { type: 'add', list: 'memberLoads', seed: { member: f.members[2].id, kind: 'udl', w: -2 } }); })()],
    ['a truss with a settlement', addr('settleTruss')],
  ];
  for (const [name, form] of forms) {
    it(`${name}: all 128 combinations`, () => {
      for (let mask = 0; mask < 1 << SWITCHES.length; mask++) {
        const set: Partial<Looks> = {};
        SWITCHES.forEach((k, i) => (set[k] = ((mask >> i) & 1) === 1));
        const html = figure(form, set);
        const svg = mainSvg(html);
        const keys = legendKeys(html);
        const where = `${name} ${JSON.stringify(set)}`;
        for (const [key, pattern] of Object.entries(MARKS)) {
          const drawn = countOf(svg, pattern) > 0;
          expect(keys.includes(key), `${where}: ${key} is ${drawn ? 'drawn' : 'not drawn'} and the legend ${keys.includes(key) ? 'has' : 'lacks'} it`).toBe(drawn);
        }
        // The two descriptions of a node: with its number, or a dot.
        expect(keys.includes('node') && keys.includes('nodeDot')).toBe(false);
      }
    });
  }
  it('a drawing with no node numbers and no values says "Node" and not "with its number", and has no entry about sizes', () => {
    const html = figure(tpl('frame-portal'), { nodeNumbers: false, values: false, dofs: false, memberNumbers: false });
    const legend = legendHtml(html);
    expect(legend).not.toContain('with its number');
    expect(legend).not.toContain('with its size');
    expect(legend).not.toContain('number beside');
    expect(legendKeys(html)).toContain('nodeDot');
    const on = figure(tpl('frame-portal'));
    expect(legendHtml(on)).toContain('Node, with its number');
    expect(legendHtml(on)).toContain('number beside an arrow');
  });
  it('and in Spanish the same', () => {
    const off = legendHtml(figure(tpl('frame-portal'), { nodeNumbers: false, values: false }, { lang: 'es' }));
    expect(off).not.toContain('con su número');
    expect(off).not.toContain('con su valor');
    expect(off).toContain('Nudo<');
  });
});

/* ── D9: several loads on one node are drawn as their sum ─────────────────── */

describe('the loads at one node are drawn as their sum, and the drawing says so', () => {
  it('three loads at node 2 are one arrow along x and one along y, and the node is named as one where a sum was drawn', () => {
    const l = lay(addr('lotsOfLoadsOneNode'));
    expect(l.loads).toHaveLength(1);
    expect(l.loads[0].node).toBe(2);
    expect(l.loads[0].count).toBe(3);
    // 3 + (-3) + 10 along x, -4 + -4 + -1 along y; the moments 5 and -5 cancel.
    expect(l.loads[0].arrows.map((a) => a.text?.value)).toEqual(['10', '9']);
    expect(l.loads[0].arc).toBeNull();
    expect(l.summed).toEqual([2]);
    // Seven numbers were written where there is one arrow for each component now.
    expect(l.placed.length).toBeLessThan(7 + 4);
    expect(figure(addr('lotsOfLoadsOneNode'))).toContain('Where several loads act on one node, the drawing shows their sum.');
    expect(figure(addr('hugeLoad'))).not.toContain('their sum');
  });
  it('loads that cancel leave nothing to draw, and a sum that is rounding is zero', () => {
    const f = build({ mode: 'truss', nodes: [[0, 0], [10, 0], [5, 5]], members: [[1, 3], [2, 3]], supports: [[1, 'pin'], [2, 'roller']], loads: [[3, 0.1, -5], [3, 0.2, 5], [3, -0.3, 0]] });
    const l = lay(f);
    expect(l.loads).toHaveLength(1);
    expect(l.loads[0].arrows).toEqual([]);
    expect(l.loads[0].count).toBe(3);
  });
});

/* ── D10: the settlement badge ────────────────────────────────────────────── */

describe('the settlement badge stands clear of every line and can be read', () => {
  const cases: [string, StiffnessForm][] = [['a truss, member 3 over the old place', addr('settleTruss')], ['a portal frame', addr('settleFrame')], ['the template-like settling frame', settling()]];
  for (const [name, form] of cases) {
    it(name, () => {
      for (const width of [320, 650, 1200]) {
        const l = lay(form, width);
        const badged = l.supports.filter((s) => s.badge);
        expect(badged.length, name).toBeGreaterThan(0);
        for (const s of badged) {
          const b = s.badge!;
          // 18 px round, a glyph of 11 px.
          expect(b.r, name).toBeGreaterThanOrEqual(8.5);
          const rect: Rect = { x0: b.x - b.r - 1.5, y0: b.y - b.r - 1.5, x1: b.x + b.r + 1.5, y1: b.y + b.r + 1.5 };
          for (const m of l.members) expect(distPointSegment(b.x, b.y, { x1: m.x1, y1: m.y1, x2: m.x2, y2: m.y2, pad: 0 }), `${name} ${width}px: member ${m.label} runs through the badge`).toBeGreaterThan(b.r + 2.5);
          for (const o of l.supports) if (o !== s) expect(rectsNear(rect, o.box, 0), `${name} ${width}px: the badge is on the symbol of node ${o.node}`).toBe(false);
          // Not on a load or reaction arrow.
          for (const x of [...l.loads.flatMap((q) => q.arrows), ...l.reactions.flatMap((q) => q.arrows)]) expect(distRectSeg(rect, { x1: x.tail.x, y1: x.tail.y, x2: x.tip.x, y2: x.tip.y, pad: 0 }), `${name} ${width}px: an arrow runs through the badge`).toBeGreaterThan(0);
        }
        expect(l.legend).toContain('settle');
      }
    });
  }
});
const distPointSeg2 = (px: number, py: number, s: Seg): number => distPointSegment(px, py, s);
function distPointSegment(px: number, py: number, s: Seg): number {
  const dx = s.x2 - s.x1;
  const dy = s.y2 - s.y1;
  const l2 = dx * dx + dy * dy;
  const t = l2 === 0 ? 0 : Math.max(0, Math.min(1, ((px - s.x1) * dx + (py - s.y1) * dy) / l2));
  return Math.hypot(px - (s.x1 + t * dx), py - (s.y1 + t * dy));
}

/* ── D11: the digits fit the circle ───────────────────────────────────────── */

describe('a node’s number fits its circle', () => {
  it('a circle is wide enough for the digits written in it (10, 11 and 12 on the largest structure), and a dot is 3.2 px', () => {
    const l = lay(addr('big'));
    for (const n of l.nodes) {
      const digits = String(n.label).length;
      // 9.5 px digits of a monospace face are 5.7 px wide; the circle's own line takes 1.5.
      expect(2 * n.r - 1.5, `node ${n.label}`).toBeGreaterThanOrEqual(digits * 5.7 + 2);
    }
    expect(Math.max(...l.nodes.map((n) => n.r))).toBeGreaterThan(8);
    expect(nodeRadius(7, true)).toBe(7);
    expect(nodeRadius(12, true)).toBeGreaterThan(8);
    expect(nodeRadius(12, false)).toBe(3.2);
    for (const n of lay(addr('big'), 650, { nodeNumbers: false }).nodes) expect(n.r).toBe(3.2);
  });
});

/* ── D15: a few pixels do not make the drawing scroll; a mast is said ────── */

describe('extreme proportions', () => {
  it('a drawing that wants 3 % more than its column is drawn in it, and one that wants much more still scrolls', () => {
    const five = analyseSafely(tpl('truss-five-member')).drawing;
    expect(figureWidth(five, looks(), 350, false).drawn).toBe(350);
    expect(figureWidth(five, looks(), 350, false).widened).toBe(false);
    expect(figureWidth(five, looks(), 320, false).drawn).toBeGreaterThan(320);
    const big = analyseSafely(girder('frame')).drawing;
    expect(figureWidth(big, looks(), 350, false).drawn).toBeGreaterThan(400);
  });
  it('a mast 1 ft by 50 ft: the nodes too close for a number are dots and the note says so; the supports are drawn smaller', () => {
    const l = lay(addr('tall'), 650);
    expect(l.dotted).toBeGreaterThan(0);
    expect(l.nodes.every((n) => !n.numbered)).toBe(true);
    expect(l.legend).toContain('nodeDot');
    expect(l.legend).not.toContain('node');
    expect(Math.min(...l.supports.map((s) => s.scale))).toBeLessThan(1);
    const html = figure(addr('tall'));
    expect(html).toContain('stand too close for a number');
    // A drawing with room for the numbers has no such note.
    expect(figure(tpl('truss-five-member'))).not.toContain('too close for a number');
  });
  it('is quick on every one of them', () => {
    const t0 = performance.now();
    for (const key of ['tall', 'flat50', 'ratio1000', 'close', 'big']) lay(addr(key), 390);
    expect(performance.now() - t0).toBeLessThan(2500);
  });
});

/* ── D18, D19: typography, the description, the notes ─────────────────────── */

describe('powers of ten are raised on the drawing, the figure is named briefly and described by the sentence under it', () => {
  it('1 × 10^12 is set as a raised 12, and no caret is left in the drawing', () => {
    const svg = mainSvg(figure(addr('hugeLoad')));
    expect(svg).toContain('<tspan class="mp-st-fig__exp"');
    expect(svg.replace(/<[^>]+>/g, '')).not.toContain('^');
    expect(svg).toMatch(/1 × 10<tspan class="mp-st-fig__exp"[^>]*>12<\/tspan>/);
  });
  it('the name is what was given and nothing more; the sentence is what describes it', () => {
    const html = figure(tpl('truss-five-member'), {}, { summary: 'Drawing of a structure', describedBy: 'reading-1' });
    const svg = mainSvg(html);
    expect(svg).toContain('aria-label="Drawing of a structure"');
    expect(svg).toContain('aria-describedby="reading-1"');
    expect(mainSvg(figure(tpl('truss-five-member')))).not.toContain('aria-describedby');
  });
  it('arrow lengths are said not to be to scale where there are arrows, and not where there are none', () => {
    expect(figure(tpl('truss-five-member'))).toContain('Arrow lengths are not to scale.');
    expect(figure(tpl('truss-five-member'), { loads: false, reactions: false })).not.toContain('not to scale');
  });
});

/* ── Every structure and extreme: finite, inside, clear ───────────────────── */

describe('the drawing of the extremes the review tried: finite, inside its box, every word clear, and it says what it did', () => {
  const keys = ['tall', 'flat50', 'ratio1000', 'close', 'closeFrame', 'collinear', 'single', 'singleFrame', 'vertical', 'bigCoord', 'tinyCoord', 'negCoord', 'hugeLoad', 'hugeLoadTruss', 'coord1e30', 'coord1e300', 'coordTiny', 'load1e30', 'load1e300', 'mechTruss', 'mechFrame', 'mechRigid', 'noLoad', 'noMoveLoaded', 'noSupports', 'oneNode', 'allSame', 'dup'];
  const problems = (l: Layout): string[] => {
    const out: string[] = [];
    l.placed.forEach((r, k) => {
      if (!(r.x0 >= 3 && r.y0 >= 3 && r.x1 <= l.width - 3 && r.y1 <= l.height - 3)) out.push(`word ${k} outside`);
      for (const s of l.obstacles.segs) if (segNear(s, r, 0)) out.push(`word ${k} on a line`);
      for (const b of l.obstacles.boxes) if (rectsNear(r, b, 0)) out.push(`word ${k} on a box`);
      l.placed.forEach((q, j) => {
        if (j > k && rectsNear(r, q, 0)) out.push(`word ${k} on word ${j}`);
      });
    });
    return out;
  };
  for (const key of keys) {
    it(key, () => {
      for (const width of [280, 320, 390, 650, 1200]) {
        const l = lay(addr(key), width);
        const where = `${key} ${width}px`;
        expect(finite([l.width, l.height, l.scale, l.members, l.nodes, l.supports, l.loads, l.reactions, l.memberLoads, l.deformed, l.placed]), where).toBe(true);
        expect(l.height, where).toBeGreaterThan(0);
        if (l.broken) continue;
        for (const n of l.nodes) expect(n.x >= 0 && n.x <= l.width && n.y >= 0 && n.y <= l.height, `${where}: node ${n.label} outside`).toBe(true);
        expect(problems(l), where).toEqual([]);
        // Whatever the numbers, the page can write it as markup with no NaN in it.
        expect(figure(addr(key), {}, { width }), where).not.toMatch(/NaN|undefined|Infinity/);
      }
    });
  }
  it('a drawing that cannot be made says so in a line', () => {
    const l = stiffnessLayout(analyseSafely(addr('coord1e300')).drawing, { ...looks(), width: 650 });
    if (l.broken) expect(figure(addr('coord1e300'))).toContain(stiffnessUi.en.drawing.broken);
  });
  it('is made of numbers only for a form of any size of number (1e17, forty digits)', () => {
    for (const v of [1e17, 1e40, 1e-17, -1e17]) {
      const f = build({ mode: 'truss', nodes: [[0, 0], [10, 0], [5, 8]], members: [[1, 3], [2, 3]], supports: [[1, 'pin'], [2, 'roller']], loads: [[3, v, -v]] });
      expect(finite(lay(f, 320)), String(v)).toBe(true);
    }
  });
});

void defaultStiffness;
void tall;
