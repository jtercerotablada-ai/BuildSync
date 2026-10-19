import { analyseSafely } from '@/lib/calc/stiffness/analysis';
import { reduceStiffness, type StiffnessForm } from '@/lib/calc/stiffness/model';
import { build } from './fixtures.testlib';
import { distPointRect, distRectSeg, distSegSeg, HAIRLINE_FREE, rectsNear, segNear, stiffnessLayout, TIE, type Layout, type Looks, type Rect, type Seg } from './layout';

/**
 * Test library: the SCAN of a drawing. It reads a `Layout` as the page draws it (arrows, rings, symbols, badges, words, hairlines) and counts
 * what a reader would call a fault: a number far from its own mark without a hairline, or nearer another mark; a mark outside the box of the
 * drawing; an arrow or a ring through the symbol of its own support; a hairline across another mark; a word on a line, a box or another word.
 * It is the same measure over the seven templates, the structures of the review and a few hundred random ones, so that "fixed" is a number.
 */

type P = { x: number; y: number };
export interface Leader {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
}
export interface ScanMark {
  id: string;
  node: number;
  kind: 'arrow' | 'ring' | 'mload';
  reaction: boolean;
  /** The ink of the mark, as lines. */
  segs: Seg[];
  text: { rect: Rect; leader: Leader | null; value: string } | null;
}

/** The points of a ring as the page draws it, read from its path (so that the scan does not depend on how the layout built it). */
export function arcPoints(a: { cx: number; cy: number; r: number; path: string }, steps = 36): P[] {
  const m = /^M (\S+) (\S+) A (\S+) (\S+) 0 (\d) (\d) (\S+) (\S+)$/.exec(a.path);
  if (!m) return [];
  const [ax, ay, sweep, bx, by] = [Number(m[1]), Number(m[2]), Number(m[6]), Number(m[7]), Number(m[8])];
  const a0 = Math.atan2(ay - a.cy, ax - a.cx);
  const a1 = Math.atan2(by - a.cy, bx - a.cx);
  const TAU = 2 * Math.PI;
  const delta = sweep === 1 ? (((a1 - a0) % TAU) + TAU) % TAU : -((((a0 - a1) % TAU) + TAU) % TAU);
  const out: P[] = [];
  for (let k = 0; k <= steps; k++) out.push({ x: a.cx + a.r * Math.cos(a0 + (delta * k) / steps), y: a.cy + a.r * Math.sin(a0 + (delta * k) / steps) });
  return out;
}
const chain = (pts: P[], pad: number): Seg[] => pts.slice(1).map((q, k) => ({ x1: pts[k].x, y1: pts[k].y, x2: q.x, y2: q.y, pad }));
const line = (t: P, u: P, pad = 0): Seg => ({ x1: t.x, y1: t.y, x2: u.x, y2: u.y, pad });

/** Every load, reaction and load on a member, with the ink it is made of and the number written beside it. */
export function marksOf(l: Layout): ScanMark[] {
  const out: ScanMark[] = [];
  const word = (b: { rect: Rect; leader: Leader | null; value: string } | null) => (b ? { rect: b.rect, leader: b.leader, value: b.value } : null);
  l.loads.forEach((x) => {
    x.arrows.forEach((a, k) => out.push({ id: `load ${x.node}.${k}`, node: x.node, kind: 'arrow', reaction: false, segs: [line(a.tail, a.tip)], text: word(a.text) }));
    if (x.arc) out.push({ id: `load ring ${x.node}`, node: x.node, kind: 'ring', reaction: false, segs: chain(arcPoints(x.arc), 0), text: word(x.arc.text) });
  });
  l.reactions.forEach((x) => {
    x.arrows.forEach((a, k) => out.push({ id: `react ${x.label}.${k}`, node: x.label, kind: 'arrow', reaction: true, segs: [line(a.tail, a.tip)], text: word(a.text) }));
    if (x.arc) out.push({ id: `react ring ${x.label}`, node: x.label, kind: 'ring', reaction: true, segs: chain(arcPoints(x.arc), 0), text: word(x.arc.text) });
  });
  l.memberLoads.forEach((x) => out.push({ id: `member load ${x.label}`, node: 0, kind: 'mload', reaction: false, segs: [...x.arrows.map((a) => line(a.tail, a.tip)), ...(x.line ?? []).slice(1).map((q, k) => line(x.line![k], q))], text: word(x.text) }));
  return out;
}

const inkDistance = (r: Rect, m: ScanMark): number => Math.min(...m.segs.map((s) => distRectSeg(r, s)));

export interface Scan {
  /** Marks that carry a number, and the marks that should but do not (left off a crowded drawing). */
  marks: number;
  unlabelled: number;
  unlabelledIds: string[];
  labels: number;
  tied: number;
  /** A number farther than the cap from its own mark's ink, with no hairline. */
  far: string[];
  /** A number with another mark nearer than its own, with no hairline. */
  rival: string[];
  ringLabels: number;
  ringFar: string[];
  ringRival: string[];
  /** Ink outside the box of the drawing. */
  outside: string[];
  /** An arrow or a ring that runs through the symbol of its own support. */
  ownSymbol: string[];
  /** A hairline across a mark, a word, a badge, a symbol, a node or another hairline that is not its own. */
  leaderCross: string[];
  /** A hairline across a member (allowed where it has no way round: the line of the structure is not a mark). */
  leaderMember: string[];
  /** A word on a line, a box or another word. */
  overlaps: string[];
}

const EMPTY = (): Scan => ({ marks: 0, unlabelled: 0, unlabelledIds: [], labels: 0, tied: 0, far: [], rival: [], ringLabels: 0, ringFar: [], ringRival: [], outside: [], ownSymbol: [], leaderCross: [], leaderMember: [], overlaps: [] });

/** Whether a hairline touches an obstacle: lines within `clear`, rectangles within `clear`. */
function leaderHits(h: Leader, others: { segs: Seg[]; rects: Rect[]; name: string }[], clear: number): string[] {
  // (it starts on its own mark, which may stand a hair from something else: it is judged from 3 px out)
  const len = Math.hypot(h.x2 - h.x1, h.y2 - h.y1);
  const f = len > HAIRLINE_FREE + 1 ? HAIRLINE_FREE / len : 0;
  const s: Seg = { x1: h.x1 + (h.x2 - h.x1) * f, y1: h.y1 + (h.y2 - h.y1) * f, x2: h.x2, y2: h.y2, pad: 0 };
  const hits: string[] = [];
  for (const o of others) {
    if (o.segs.some((q) => distSegSeg(s, q) < q.pad + clear) || o.rects.some((r) => segNear(s, r, clear))) hits.push(o.name);
  }
  return hits;
}

export function scan(l: Layout): Scan {
  const out = EMPTY();
  if (l.broken) return out;
  const marks = marksOf(l);
  const W = l.width;
  const H = l.height;

  /* Numbers: tied to their own mark. */
  for (const m of marks) {
    out.marks++;
    if (!m.text) {
      out.unlabelled++;
      out.unlabelledIds.push(m.id);
      continue;
    }
    out.labels++;
    const isRing = m.kind === 'ring';
    if (isRing) out.ringLabels++;
    if (m.text.leader) {
      out.tied++;
      continue;
    }
    const own = inkDistance(m.text.rect, m);
    const rivals = marks.filter((q) => q !== m);
    const near = rivals.length ? Math.min(...rivals.map((q) => inkDistance(m.text!.rect, q))) : Infinity;
    const where = `${m.id} "${m.text.value}" own ${own.toFixed(1)} other ${near.toFixed(1)}`;
    if (own > TIE + 0.5) {
      out.far.push(where);
      if (isRing) out.ringFar.push(where);
    }
    if (own > near + 0.75) {
      out.rival.push(where);
      if (isRing) out.ringRival.push(where);
    }
  }

  /* Ink outside the box. */
  const outside = (name: string, ...pts: P[]) => {
    for (const p of pts) if (!(p.x >= 0 && p.x <= W && p.y >= 0 && p.y <= H)) {
      out.outside.push(`${name} at ${p.x.toFixed(1)},${p.y.toFixed(1)} (box ${W.toFixed(0)}x${H.toFixed(0)})`);
      return;
    }
  };
  for (const m of l.members) outside(`member ${m.label}`, { x: m.x1, y: m.y1 }, { x: m.x2, y: m.y2 });
  for (const n of l.nodes) outside(`node ${n.label}`, { x: n.x - n.r, y: n.y - n.r }, { x: n.x + n.r, y: n.y + n.r });
  for (const s of l.supports) {
    outside(`support ${s.label}`, { x: s.box.x0, y: s.box.y0 }, { x: s.box.x1, y: s.box.y1 });
    if (s.badge) outside(`badge ${s.label}`, { x: s.badge.x - s.badge.r, y: s.badge.y - s.badge.r }, { x: s.badge.x + s.badge.r, y: s.badge.y + s.badge.r });
  }
  for (const m of marks) {
    const pts: P[] = [];
    for (const s of m.segs) pts.push({ x: s.x1, y: s.y1 }, { x: s.x2, y: s.y2 });
    if (m.kind === 'arrow' && m.segs.length === 1) {
      // The head: 8 px back from the tip, 3.6 px to either side.
      const s = m.segs[0];
      const len = Math.hypot(s.x2 - s.x1, s.y2 - s.y1) || 1;
      const u = { x: (s.x2 - s.x1) / len, y: (s.y2 - s.y1) / len };
      const b = { x: s.x2 - u.x * 8, y: s.y2 - u.y * 8 };
      pts.push({ x: b.x - u.y * 3.6, y: b.y + u.x * 3.6 }, { x: b.x + u.y * 3.6, y: b.y - u.x * 3.6 });
    }
    outside(m.id, ...pts);
    if (m.text) {
      outside(`${m.id} number`, { x: m.text.rect.x0, y: m.text.rect.y0 }, { x: m.text.rect.x1, y: m.text.rect.y1 });
      if (m.text.leader) outside(`${m.id} hairline`, { x: m.text.leader.x1, y: m.text.leader.y1 }, { x: m.text.leader.x2, y: m.text.leader.y2 });
    }
  }
  for (const s of l.supports) if (s.badge?.leader) outside(`badge ${s.label} hairline`, { x: s.badge.leader.x1, y: s.badge.leader.y1 }, { x: s.badge.leader.x2, y: s.badge.leader.y2 });
  if (l.deformed) {
    for (const d of l.deformed.members) {
      const pts = d.points.split(' ').map((q) => {
        const [x, y] = q.split(',').map(Number);
        return { x, y };
      });
      outside(`deformed ${d.member}`, ...pts);
    }
  }
  for (const n of l.nodes) {
    if (n.dofTag) outside(`dof ${n.label}`, { x: n.dofTag.box.rect.x0, y: n.dofTag.box.rect.y0 }, { x: n.dofTag.box.rect.x1, y: n.dofTag.box.rect.y1 });
  }
  for (const m of l.members) if (m.tag) outside(`tag ${m.label}`, { x: m.tag.rect.x0, y: m.tag.rect.y0 }, { x: m.tag.rect.x1, y: m.tag.rect.y1 });

  /* An arrow or a ring through the symbol of its own support. */
  for (const m of marks) {
    if (m.node === 0) continue;
    const sup = l.supports.find((s) => s.node === m.node);
    if (!sup) continue;
    for (const s of m.segs) {
      if (segNear(s, sup.box, 0)) {
        out.ownSymbol.push(`${m.id} runs through the ${sup.symbol} of node ${m.node}`);
        break;
      }
    }
  }

  /* A hairline across something that is not its own. */
  const words: { rect: Rect; owner: string }[] = [];
  for (const m of marks) if (m.text) words.push({ rect: m.text.rect, owner: m.id });
  const hairlines: { h: Leader; owner: string; ownNode: number }[] = [];
  for (const m of marks) if (m.text?.leader) hairlines.push({ h: m.text.leader, owner: m.id, ownNode: m.node });
  for (const s of l.supports) if (s.badge?.leader) hairlines.push({ h: s.badge.leader, owner: `badge ${s.label}`, ownNode: s.node });
  for (const hl of hairlines) {
    const others: { segs: Seg[]; rects: Rect[]; name: string }[] = [];
    // (a settlement's hairline ends at its node: the rings round that node are on its way)
    for (const m of marks) if (m.id !== hl.owner && !(hl.owner.startsWith('badge') && m.kind === 'ring' && m.node === hl.ownNode)) others.push({ segs: m.segs, rects: [], name: m.id });
    for (const w of words) if (w.owner !== hl.owner) others.push({ segs: [], rects: [w.rect], name: `number of ${w.owner}` });
    const ownBadge = hl.owner.startsWith('badge');
    for (const s of l.supports) {
      if (s.badge && !(ownBadge && s.node === hl.ownNode)) others.push({ segs: [], rects: [{ x0: s.badge.x - s.badge.r, y0: s.badge.y - s.badge.r, x1: s.badge.x + s.badge.r, y1: s.badge.y + s.badge.r }], name: `badge ${s.label}` });
      if (!(hl.ownNode === s.node)) others.push({ segs: [], rects: [s.box], name: `symbol ${s.label}` });
    }
    for (const m of l.members) others.push({ segs: [{ x1: m.x1, y1: m.y1, x2: m.x2, y2: m.y2, pad: 2 }], rects: [], name: `member ${m.label}` });
    for (const o of hairlines) if (o !== hl) others.push({ segs: [{ x1: o.h.x1, y1: o.h.y1, x2: o.h.x2, y2: o.h.y2, pad: 0 }], rects: [], name: `hairline of ${o.owner}` });
    for (const n of l.nodes) if (n.label !== hl.ownNode) others.push({ segs: [], rects: [{ x0: n.x - n.r, y0: n.y - n.r, x1: n.x + n.r, y1: n.y + n.r }], name: `node ${n.label}` });
    const hits = leaderHits(hl.h, others, 0.75);
    const hard = [...new Set(hits.filter((q) => !/^member \d+$/.test(q)))];
    if (hard.length) out.leaderCross.push(`${hl.owner}: ${hard.join(', ')}`);
    if (hits.some((q) => /^member \d+$/.test(q))) out.leaderMember.push(`${hl.owner}: ${[...new Set(hits.filter((q) => /^member \d+$/.test(q)))].join(', ')}`);
  }

  /* Words on lines, boxes and words. */
  l.placed.forEach((r, k) => {
    if (!(r.x0 >= 3 && r.y0 >= 3 && r.x1 <= W - 3 && r.y1 <= H - 3)) out.overlaps.push(`word ${k} outside`);
    for (const s of l.obstacles.segs) if (segNear(s, r, 0)) out.overlaps.push(`word ${k} on a line`);
    for (const b of l.obstacles.boxes) if (rectsNear(r, b, 0)) out.overlaps.push(`word ${k} on a box`);
    l.placed.forEach((q, j) => {
      if (j > k && rectsNear(r, q, 0)) out.overlaps.push(`word ${k} on word ${j}`);
    });
  });
  return out;
}

export function total(scans: Scan[]): Record<string, number> {
  const sum = (f: (s: Scan) => number) => scans.reduce((n, s) => n + f(s), 0);
  const some = (f: (s: Scan) => unknown[]) => scans.filter((s) => f(s).length > 0).length;
  return {
    structures: scans.length,
    marks: sum((s) => s.marks),
    unlabelled: sum((s) => s.unlabelled),
    labels: sum((s) => s.labels),
    tied: sum((s) => s.tied),
    far: sum((s) => s.far.length),
    rival: sum((s) => s.rival.length),
    ringLabels: sum((s) => s.ringLabels),
    ringFar: sum((s) => s.ringFar.length),
    ringRival: sum((s) => s.ringRival.length),
    outside: sum((s) => s.outside.length),
    outsideStructures: some((s) => s.outside),
    ownSymbol: sum((s) => s.ownSymbol.length),
    ownSymbolStructures: some((s) => s.ownSymbol),
    leaderCross: sum((s) => s.leaderCross.length),
    leaderCrossStructures: some((s) => s.leaderCross),
    leaderMember: sum((s) => s.leaderMember.length),
    overlaps: sum((s) => s.overlaps.length),
    overlapStructures: some((s) => s.overlaps),
  };
}

/* ── Random structures ─────────────────────────────────────────────────────── */

export function rng(seed: number) {
  let s = seed >>> 0;
  return () => {
    s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

type Flags = { ux: boolean; uy: boolean; rz: boolean };
const FRAME_SUPPORTS: Flags[] = [
  { ux: true, uy: true, rz: false },
  { ux: true, uy: true, rz: true },
  { ux: true, uy: true, rz: true },
  { ux: false, uy: true, rz: false },
  { ux: true, uy: false, rz: false },
  { ux: false, uy: true, rz: true },
  { ux: true, uy: false, rz: true },
  { ux: false, uy: false, rz: true },
];
const TRUSS_SUPPORTS: Flags[] = [
  { ux: true, uy: true, rz: false },
  { ux: true, uy: true, rz: false },
  { ux: false, uy: true, rz: false },
  { ux: true, uy: false, rz: false },
];

/**
 * A random structure of the kinds the page meets: a truss or a frame of 2 to 9 nodes on a grid or off it, tall, flat or square, tied together
 * by the nearest nodes (so that most can be solved), supports of every kind (some at the top of a member, hanging), nodal loads and moments, a
 * few that cancel, loads on members, and a settlement or two.
 */
export function scanForm(seed: number): StiffnessForm {
  const r = rng(seed * 7919 + 13);
  const pick = (n: number) => Math.floor(r() * n);
  const frame = r() < 0.6;
  const count = 2 + pick(8);
  const grid = r() < 0.6;
  const sx = [1, 1, 3, 0.3][pick(4)];
  const sy = [1, 1, 0.3, 3][pick(4)];
  const used = new Set<string>();
  const nodes: [number, number][] = [];
  while (nodes.length < count) {
    const p: [number, number] = grid ? [pick(7) * 5 * sx, pick(5) * 4 * sy] : [Math.round(r() * 300) / 10 * sx, Math.round(r() * 200) / 10 * sy];
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
  // each node to its nearest earlier nodes: a connected structure, triangulated more often than not
  for (let k = 1; k < count; k++) {
    const near = Array.from({ length: k }, (_, j) => j).sort((a, b) => Math.hypot(nodes[a][0] - nodes[k][0], nodes[a][1] - nodes[k][1]) - Math.hypot(nodes[b][0] - nodes[k][0], nodes[b][1] - nodes[k][1]));
    connect(k + 1, near[0] + 1);
    if (!frame || r() < 0.4) if (near[1] !== undefined) connect(k + 1, near[1] + 1);
  }
  let f = build({ mode: frame ? 'frame' : 'truss', nodes, members, supports: [] });
  const kinds = frame ? FRAME_SUPPORTS : TRUSS_SUPPORTS;
  const held = new Set<number>();
  const wanted = 1 + pick(3) + (frame ? 0 : 1);
  // supports at the top as often as at the foot: hung structures
  const byHeight = [...Array(count).keys()].sort((a, b) => nodes[a][1] - nodes[b][1]);
  for (let k = 0; k < wanted; k++) {
    const top = r() < 0.25;
    const n = (top ? byHeight[count - 1 - pick(Math.min(2, count))] : r() < 0.5 ? byHeight[pick(Math.min(3, count))] : pick(count)) + 1;
    if (held.has(n)) continue;
    held.add(n);
    const flags = k === 0 && frame ? kinds[1 + pick(2)] : kinds[pick(kinds.length)];
    f = reduceStiffness(f, { type: 'add', list: 'supports', seed: { node: f.nodes[n - 1].id, ...flags } });
    if (r() < 0.2) {
      const s = f.supports[f.supports.length - 1];
      f = reduceStiffness(f, { type: 'patch', list: 'supports', id: s.id, patch: { dx: flags.ux ? [0, 0.25][pick(2)] : 0, dy: flags.uy ? [0, -0.5, 0.3][pick(3)] : 0, dr: flags.rz && r() < 0.5 ? 0.002 : 0 } });
    }
  }
  const val = () => (pick(41) - 20) / 2;
  const nLoads = 1 + pick(4);
  for (let k = 0; k < nLoads; k++) {
    const n = f.nodes[pick(count)].id;
    f = reduceStiffness(f, { type: 'add', list: 'loads', seed: { node: n, fx: val(), fy: val(), m: frame && r() < 0.45 ? val() : 0 } });
    // a load that cancels another at the same node, now and then
    if (r() < 0.08) {
      const last = f.loads[f.loads.length - 1];
      f = reduceStiffness(f, { type: 'add', list: 'loads', seed: { node: n, fx: -last.fx, fy: -last.fy, m: -last.m } });
    }
  }
  if (frame) {
    for (let k = 0; k < pick(3); k++) {
      const m = f.members[pick(f.members.length)].id;
      const kind = pick(3);
      f = reduceStiffness(f, { type: 'add', list: 'memberLoads', seed: kind === 0 ? { member: m, kind: 'udl', w: val() || 1 } : kind === 1 ? { member: m, kind: 'point', P: val() || 2, a: 1 } : { member: m, kind: 'axial', q: val() || 1 } });
    }
  }
  return f;
}

export const scanLooks = (rest: Partial<Looks> = {}): Looks => ({ loads: true, reactions: true, deformed: true, dofs: true, nodeNumbers: true, memberNumbers: true, values: true, group: ',', ...rest });

/** The layout of a form as the page would draw it at a width, and its scan. */
export function scanOf(form: StiffnessForm, width: number, rest: Partial<Looks> = {}): { layout: Layout; scan: Scan; solved: boolean } {
  const a = analyseSafely(form);
  const layout = stiffnessLayout(a.drawing, { ...scanLooks({ reactions: a.results !== null, deformed: a.results !== null, ...rest }), width });
  return { layout, scan: scan(layout), solved: a.results !== null };
}

export { distPointRect };
