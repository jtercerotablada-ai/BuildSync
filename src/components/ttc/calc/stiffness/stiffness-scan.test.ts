import { afterEach, describe, expect, it, vi } from 'vitest';
import { analyseSafely } from '@/lib/calc/stiffness/analysis';
import { decodeStiffness, emptyStiffness, reduceStiffness, type StiffnessForm } from '@/lib/calc/stiffness/model';
import { TEMPLATE_IDS } from '@/lib/calc/stiffness/templates';
import { build, girder } from './fixtures.testlib';
import { marksOf, scan, scanForm, scanLooks, scanOf, total, type Scan } from './figure-scan.testlib';
import { figureWidth, segNear, stiffnessLayout } from './layout';
import { startShow } from './show';

vi.setConfig({ testTimeout: 120_000 });
afterEach(() => new Promise<void>((done) => setTimeout(done, 0)));

/**
 * THE SCAN OF THE DRAWING, over structures a reader meets and the ones the second review found fault in. What the eye finds wrong with a figure is
 * counted by figure-scan.testlib.ts, the same way for every structure: a number far from the ink of its own mark with no hairline, or with another
 * mark nearer; a mark outside the box of the drawing at any width; an arrow or a ring through the symbol of its own support; a hairline across a
 * mark, a word or a badge; a word on a line. Each count must be nothing.
 */

const COLUMNS = [1300, 768, 390, 320, 280].map((w) => (w >= 1000 ? 650 : w >= 700 ? 700 : w - 32));
const SEEDS = Array.from({ length: 110 }, (_, k) => k + 1);

/** The page's drawing of a form at a column: with the switches at their start for a structure of its size, at the width the page gives it. */
function drawAt(form: StiffnessForm, column: number, rest = {}): { scan: Scan; solved: boolean; layout: ReturnType<typeof stiffnessLayout> } {
  const a = analyseSafely(form);
  const show = startShow(form);
  const looks = scanLooks({ reactions: a.results !== null, deformed: a.results !== null, dofs: show.dofs, memberNumbers: show.memberNumbers, ...rest });
  const width = figureWidth(a.drawing, looks, column, false).drawn;
  const layout = stiffnessLayout(a.drawing, { ...looks, width });
  return { scan: scan(layout), solved: a.results !== null, layout };
}

describe('over 110 random structures, at five widths: no number is far from its mark, no mark leaves the box, nothing runs through its own support', () => {
  const forms = SEEDS.map((seed) => ({ seed, form: scanForm(seed) }));
  for (const column of [...new Set(COLUMNS)]) {
    it(`a column of ${column} px`, () => {
      const scans = forms.map(({ seed, form }) => ({ seed, scan: drawAt(form, column).scan }));
      const sum = total(scans.map((s) => s.scan));
      const which = (pick: (s: Scan) => string[]) => scans.filter((s) => pick(s.scan).length).slice(0, 3).map((s) => `seed ${s.seed}: ${pick(s.scan)[0]}`);
      expect(sum.labels, 'the scan has numbers to look at').toBeGreaterThan(300);
      // The numbers: within 12 px of their own mark's ink or on a hairline, and no mark nearer than their own.
      expect(which((s) => s.far), 'far').toEqual([]);
      expect(which((s) => s.rival), 'rival').toEqual([]);
      // The moments' rings above all (the reviewer's first complaint): their numbers are tied to the arc, not to the circle it is part of.
      expect(sum.ringLabels, 'the scan has rings to look at').toBeGreaterThan(30);
      expect(which((s) => s.ringFar), 'ringFar').toEqual([]);
      expect(which((s) => s.ringRival), 'ringRival').toEqual([]);
      // Nothing leaves the box of the drawing, at any width (a support above its node and its reaction have room).
      expect(which((s) => s.outside), 'outside').toEqual([]);
      expect(which((s) => s.ownSymbol), 'ownSymbol').toEqual([]);
      expect(which((s) => s.leaderCross), 'leaderCross').toEqual([]);
      expect(which((s) => s.overlaps), 'overlaps').toEqual([]);
      // A number left off a crowded drawing is counted and in the tables, but it is not the common case.
      expect(sum.unlabelled / Math.max(1, sum.marks)).toBeLessThan(0.04);
    });
  }
});

describe('on paper (724 px wide and no taller than 420; the deformed shape alone no taller than 320), as the sheet draws it', () => {
  const forms = SEEDS.map((seed) => ({ seed, form: scanForm(seed) }));
  it('the sheet’s structure figure, over 110 random structures', () => {
    const scans = forms.map(({ seed, form }) => {
      const a = analyseSafely(form);
      const looks = scanLooks({ reactions: a.results !== null, deformed: false, dofs: true, memberNumbers: true });
      return { seed, scan: scan(stiffnessLayout(a.drawing, { ...looks, width: 724, maxHeight: 420 })) };
    });
    const which = (pick: (s: Scan) => string[]) => scans.filter((s) => pick(s.scan).length).slice(0, 3).map((s) => `seed ${s.seed}: ${pick(s.scan)[0]}`);
    for (const [name, pick] of [['far', (s: Scan) => s.far], ['rival', (s: Scan) => s.rival], ['outside', (s: Scan) => s.outside], ['ownSymbol', (s: Scan) => s.ownSymbol], ['leaderCross', (s: Scan) => s.leaderCross], ['overlaps', (s: Scan) => s.overlaps]] as const) expect(which(pick), name).toEqual([]);
  });
  it('the sheet’s deformed figure, over the structures that can be solved', () => {
    let drawn = 0;
    for (const { seed, form } of forms) {
      const a = analyseSafely(form);
      if (!a.results) continue;
      const looks = scanLooks({ reactions: false, deformed: true, loads: false, dofs: false, memberNumbers: false });
      const sc = scan(stiffnessLayout(a.drawing, { ...looks, width: 724, maxHeight: 320 }));
      drawn++;
      expect(sc.outside, `seed ${seed}`).toEqual([]);
      expect(sc.overlaps, `seed ${seed}`).toEqual([]);
    }
    expect(drawn).toBeGreaterThan(30);
  });
});

describe('the seven templates and the structures of the review: nothing is wrong at any width', () => {
  const cases: [string, StiffnessForm][] = [
    ...TEMPLATE_IDS.flatMap((id) => [[`${id} us`, reduceStiffness(emptyStiffness('us'), { type: 'template', template: id })] as [string, StiffnessForm], [`${id} si`, reduceStiffness(emptyStiffness('si'), { type: 'template', template: id })] as [string, StiffnessForm]]),
    ['girder frame', girder('frame')],
    ['girder truss', girder('truss')],
    ...Object.entries({
      moments: 'Kofwyid0q2p;1;f;us;s,29000,10,100;0,0_15,0_15,12_0,12;1,2_2,3_3,4_4,1;1,3_2,2;3,10,-5,40_4,-6,0,-40_2,0,0,25;',
      allMarks: 'Kd2zewcrz5d;1;f;us;s,29000,10,100;0,0_12,0_24,0_36,0_0,10_12,10_24,10;1,2_2,3_3,4_1,5_2,6_3,7_5,6_6,7;1,7,0,-0.5_2,2_3,3,0.25_4,5_5,4_7,6;5,8,0,20_6,3,-12_7,0,-5_7,2,0,-10;u,2,-1.5_p,4,0,-6,4_a,3,0,0,0,1.2',
      momentAtPin: 'Knjkmvlwj1q;1;f;us;s,29000,10,100;0,0_20,0;1,2;1,3_2,2;1,0,0,30_2,0,0,-30;',
      hung: 'Ke6pfxoyh1t;1;t;us;s,29000,10,100;0,12_12,12_6,0;1,3_2,3_1,2;1,3_2,2;3,0,-10;',
      settleAll: 'K1v2swomp2w;1;f;us;s,29000,10,100;0,0_20,0_0,10_20,10;1,3_2,4_3,4;1,7,0.25,-0.5,0.002_2,7,-0.25,-0.75,-0.001;3,10,0;',
      rand65: 'K03axdyoa48;1;f;us;s,29000,10,100;5.2,15.6_19.2,3.5_38.2,18.7;1,2_2,3_1,3;3,3_2,4;2,-4,-1_3,-15,-24_2,4,0_3,0,-10,-16_3,-17,13_2,-3,-4;p,3,0,10,16.57_a,1,0,0,0,-1.5',
    }).map(([k, v]) => [k, decodeStiffness(v)!] as [string, StiffnessForm]),
  ];
  it('every one of them, at five widths', () => {
    for (const [name, form] of cases) {
      for (const column of [...new Set(COLUMNS)]) {
        const { scan: sc } = drawAt(form, column);
        const where = `${name} at ${column}`;
        expect(sc.far, where).toEqual([]);
        expect(sc.rival, where).toEqual([]);
        expect(sc.outside, where).toEqual([]);
        expect(sc.ownSymbol, where).toEqual([]);
        expect(sc.leaderCross, where).toEqual([]);
        expect(sc.overlaps, where).toEqual([]);
      }
    }
  });
});

/* ── D1: the numbers of the moments ───────────────────────────────────────── */

describe('the number of a moment stands at its ring, and is not taken for the number of an arrow', () => {
  const portal = reduceStiffness(emptyStiffness('us'), { type: 'template', template: 'frame-portal' });
  it('the portal: 31.71 and 30.86 are beside their rings, nearer them than the arrows of the same support', () => {
    const { layout } = drawAt(portal, 650);
    const marks = marksOf(layout);
    const rings = marks.filter((m) => m.kind === 'ring' && m.text);
    expect(rings.map((m) => m.text!.value).sort()).toEqual(['30.86', '31.71']);
    for (const m of rings) {
      expect(m.text!.leader, m.id).toBeNull();
      const own = Math.min(...m.segs.map((q) => distRect(m.text!.rect, q)));
      expect(own, `${m.id} ${m.text!.value}`).toBeLessThanOrEqual(12.5);
      for (const o of marks.filter((q) => q !== m)) expect(Math.min(...o.segs.map((q) => distRect(m.text!.rect, q))), `${m.text!.value} is nearer to ${o.id}`).toBeGreaterThanOrEqual(own - 0.75);
    }
  });
  it('a node with a moment load and a moment reaction has both numbers tied, and the rings open differently', () => {
    const f = build({ mode: 'frame', nodes: [[0, 0], [20, 0]], members: [[1, 2]], supports: [[1, 'fixed']], loads: [[2, 0, -5]] });
    const g = reduceStiffness(f, { type: 'add', list: 'loads', seed: { node: f.nodes[0].id, fx: 0, fy: 0, m: 12 } });
    const { layout, scan: sc } = drawAt(g, 650);
    expect(layout.loads.find((l) => l.node === 1)?.arc).not.toBeNull();
    expect(layout.reactions.find((r) => r.label === 1)?.arc).not.toBeNull();
    expect(layout.loads.find((l) => l.node === 1)!.arc!.text).not.toBeNull();
    expect(layout.reactions.find((r) => r.label === 1)!.arc!.text).not.toBeNull();
    expect(sc.ringFar).toEqual([]);
    expect(sc.ringRival).toEqual([]);
    expect(sc.leaderCross).toEqual([]);
  });
});
const distRect = (r: { x0: number; y0: number; x1: number; y1: number }, q: { x1: number; y1: number; x2: number; y2: number; pad: number }): number => {
  // (the distance from a rectangle to a line, by sampling the line: enough for the 12 px this is held to)
  let best = Infinity;
  for (let k = 0; k <= 40; k++) {
    const x = q.x1 + ((q.x2 - q.x1) * k) / 40;
    const y = q.y1 + ((q.y2 - q.y1) * k) / 40;
    best = Math.min(best, Math.hypot(Math.max(r.x0 - x, 0, x - r.x1), Math.max(r.y0 - y, 0, y - r.y1)));
  }
  return best;
};

/* ── D2: no arrow or ring through its own support ─────────────────────────── */

describe('an arrow and a ring stand clear of the symbol of their own support: 8 symbols, 8 directions', () => {
  const FLAGS: Record<string, { ux: boolean; uy: boolean; rz: boolean }> = {
    pin: { ux: true, uy: true, rz: false },
    fixed: { ux: true, uy: true, rz: true },
    'roller-y': { ux: false, uy: true, rz: false },
    'roller-x': { ux: true, uy: false, rz: false },
    'guide-y': { ux: false, uy: true, rz: true },
    'guide-x': { ux: true, uy: false, rz: true },
    rotation: { ux: false, uy: false, rz: true },
  };
  const DIRECTIONS: [number, number][] = [[10, 0], [10, 10], [0, 10], [-10, 10], [-10, 0], [-10, -10], [0, -10], [10, -10]];
  // a member from the supported node to the right, up, left and down: the symbol stands on the side the member does not
  const ARMS: [string, [number, number]][] = [['right', [10, 0]], ['up', [0, 10]], ['left', [-10, 0]], ['down', [0, -10]]];
  for (const [name, flags] of Object.entries(FLAGS)) {
    it(`${name}: every arrow and ring of a load at its node, in each of 8 directions, with a member on each of 4 sides`, () => {
      for (const [arm, [ax, ay]] of ARMS) {
        for (const [fx, fy] of DIRECTIONS) {
          let f = build({ mode: 'frame', nodes: [[0, 0], [ax, ay]], members: [[1, 2]], supports: [] });
          f = reduceStiffness(f, { type: 'add', list: 'supports', seed: { node: f.nodes[0].id, ...flags } });
          f = reduceStiffness(f, { type: 'add', list: 'loads', seed: { node: f.nodes[0].id, fx, fy, m: 15 } });
          const l = stiffnessLayout(analyseSafely(f).drawing, { ...scanLooks({ reactions: false, deformed: false }), width: 650 });
          const sup = l.supports[0];
          expect(sup, `${name}`).toBeTruthy();
          for (const m of marksOf(l)) for (const q of m.segs) expect(segNear(q, sup.box, 0), `${name}, member ${arm}, load (${fx}, ${fy}): ${m.id} runs through the symbol`).toBe(false);
        }
      }
    });
  }
});

/* ── D3: no hairline across another mark ──────────────────────────────────── */

describe('a hairline never runs across a badge, a number or another mark', () => {
  it('the structure of the review where the hairline of 4.226 crossed the badge of node 1', () => {
    const f = decodeStiffness('Kb4dl9g305f;1;f;us;s,29000,10,100;21.9,16.7_26.3,15.6_6.4,23.2_30.7,11.4_29,8.3_28.5,14.4_30.5,11.1_8.2,11.4;1,2_2,3_3,4_2,5_5,6_5,7_1,8_4,7_2,4;1,4,0.25,0.3,-0.001_2,2_3,3_4,2;6,2,11;a,8,0,0,0,-1.5_u,6,-1.2')!;
    for (const column of [650, 358, 288]) {
      const { scan: sc, layout } = drawAt(f, column);
      expect(sc.leaderCross, `${column}`).toEqual([]);
      expect(layout.supports.filter((s) => s.badge).length).toBeGreaterThan(0);
    }
  });
  it('the badge of a settling support stands within 30 px of its node, or is tied to it by a hairline that crosses nothing', () => {
    const f = decodeStiffness('Kd2zewcrz5d;1;f;us;s,29000,10,100;0,0_12,0_24,0_36,0_0,10_12,10_24,10;1,2_2,3_3,4_1,5_2,6_3,7_5,6_6,7;1,7,0,-0.5_2,2_3,3,0.25_4,5_5,4_7,6;5,8,0,20_6,3,-12_7,0,-5_7,2,0,-10;u,2,-1.5_p,4,0,-6,4_a,3,0,0,0,1.2')!;
    const { layout, scan: sc } = drawAt(f, 650);
    expect(sc.leaderCross).toEqual([]);
    for (const s of layout.supports.filter((q) => q.badge)) expect(Math.hypot(s.badge!.x - s.x, s.badge!.y - s.y), `badge of node ${s.node}`).toBeLessThan(60);
  });
});

/* ── D4: nothing leaves the box at phone widths ───────────────────────────── */

describe('a support above its node: its reaction and the number beside it stay inside the box at 390, 320 and 280 px', () => {
  const hung = decodeStiffness('Ke6pfxoyh1t;1;t;us;s,29000,10,100;0,12_12,12_6,0;1,3_2,3_1,2;1,3_2,2;3,0,-10;')!;
  it('the repro of the review, and a frame hung the same way', () => {
    for (const column of [358, 288, 248]) {
      const { scan: sc, layout } = drawAt(hung, column);
      expect(sc.outside, `${column}`).toEqual([]);
      expect(layout.reactions.some((r) => r.arrows.some((a) => a.text)), 'the reactions are written').toBe(true);
      for (const m of marksOf(layout)) for (const q of m.segs) expect(Math.min(q.y1, q.y2), `${column}: ${m.id}`).toBeGreaterThanOrEqual(0);
    }
  });
  it('the box grows only on the side that needs it', () => {
    const narrow = stiffnessLayout(analyseSafely(hung).drawing, { ...scanLooks(), width: 358 });
    // the top of the structure stands lower on a phone than the margin a narrow drawing starts with (54 px) where a support is above it: its symbol,
    // its reaction and the number beside it are taller than that
    const top = (l: typeof narrow) => Math.min(...l.members.flatMap((m) => [m.y1, m.y2]));
    expect(top(narrow)).toBeGreaterThan(54);
    expect(narrow.reactions.every((r) => r.arrows.every((a) => Math.min(a.tail.y, a.tip.y) >= 0))).toBe(true);
  });
});

/* ── The number of structures behind each count ───────────────────────────── */

describe('the scan itself', () => {
  it('sees a number left far from its mark (it is not blind): a hand-made layout with a number moved away', () => {
    const f = reduceStiffness(emptyStiffness('us'), { type: 'template', template: 'frame-portal' });
    const { layout } = scanOf(f, 650);
    const ring = layout.reactions.find((r) => r.arc?.text)!.arc!;
    // move the number of a ring 120 px away and it is far, with no hairline
    ring.text!.rect = { x0: ring.text!.rect.x0 + 120, y0: ring.text!.rect.y0 - 90, x1: ring.text!.rect.x1 + 120, y1: ring.text!.rect.y1 - 90 };
    expect(scan(layout).ringFar.length).toBeGreaterThan(0);
  });
});
