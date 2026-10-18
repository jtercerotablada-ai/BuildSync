import { formatNumber } from '@/lib/calc/format';
import type { DrawingMember, StiffnessDrawing, SupportSymbol } from '@/lib/calc/stiffness/analysis';
import { signed } from './text';

/**
 * THE STRUCTURE DRAWING, RECKONED. Where every line, symbol, arrow and word of the drawing goes, in pixels - with no React:
 * `Schematic.tsx` writes what `stiffnessLayout` returns as SVG and adds nothing of its own, so the layout is held to its rules without
 * a browser (schematic.test.ts).
 *
 * It is given a `StiffnessDrawing` (lib/calc/stiffness/analysis.ts: nodes with their DOF numbers, members, supports by the DOFs they
 * hold, loads, reactions and the deformed shape, all in the length unit shown, y UP) and the looks asked for (which marks are on), and
 * returns shapes in pixels (y DOWN). The drawing is built even when the structure cannot be solved: then it has no reactions and no
 * deformed shape, and the nodes that are part of a problem can be ringed.
 *
 * A SUPPORT STANDS ON THE AXIS IT HOLDS. A roller or a guide that holds y stands below the node or above it, one that holds x stands to the
 * left or to the right; where every side of that axis has a member it stands on the least crowded one and is drawn over the member with a
 * halo (`blocked`), never turned onto the other axis (a symbol on the wrong axis says that the support holds the other movement).
 *
 * THE LOADS AT ONE NODE ARE DRAWN AS THEIR SUM (the form says that several loads on a node add up, and so does the engine): one arrow for
 * each component, one ring, and `summed` names the nodes where that was done.
 *
 * AN ARROW SHOWS THE DIRECTION OF A FORCE. It stands on the side of the node (or of the support) that is free of members and of the symbol:
 * with its head on the node when it points at it, and with its tail on the node when it points away. Lengths are NOT to scale (two sizes
 * only hint at which is the larger); the number beside it is the size.
 *
 * THE WORDS ARE KEPT CLEAR AND TIED TO THEIR MARK. Every number written on the drawing - a load, a reaction, the number of a member, the
 * DOF numbers of a node - is put where it touches no line, no node, no support, no arrow and no other word. A load's or reaction's number
 * sits within `TIE` pixels of its own arrow's far end (or of the opening of its ring), the smaller text (10, 9, 8 px) is tried before it is
 * moved further, and a number that can only go further is joined to its mark by a hairline (`leader`); none of that fitting, it is left
 * off and counted. The words that are the visitor's to ask for (member numbers, DOF numbers) are tried at 11 px and then smaller (one
 * size for the whole drawing, the largest at which every one finds a clear place); only when even 8 px leaves some without a place are the
 * lightest left off, and the count is stated (`thinned`): they are in the tables, and the switch "Show every word" draws the structure wide
 * enough for all of them. Nothing is ever drawn on a line "because there was no room".
 *
 * TOTAL. Whatever numbers the drawing is made of - 10^17, 10^300, forty digits, a node typed twice - this returns, and fast: an extent
 * that is not a finite size is a `broken` layout (the page says so), and everything else is scaled to the page.
 */

/** Pixel sizes at full scale. */
const NODE_R = 7;
const DOT_R = 3.2;
const MEMBER_W = 4;
const GAP = 3;
const HEAD_LEN = 8;
const HEAD_HALF = 3.6;
const MAX_HEIGHT = 560;
const CHAR = 6.6;
const LABEL_H = 13;
const FROM_LINE = 1.5;
const FROM_BOX = 1.5;
const FROM_LABEL = 2.5;
/** The settlement badge: its radius, and the box it asks for (the circle and the line round it). */
export const BADGE_R = 9;
const BADGE_BOX = 2 * BADGE_R + 3;
export const SIZES = [11, 10, 9, 8] as const;
const BASE_SIZE = 11;
const EVERY_MAX = 6000;
/** How far, at most, a load's or a reaction's number sits from the end of its own arrow (px) before it is moved by a leader. */
export const TIE = 12;

export type Point = { x: number; y: number };
export type Rect = { x0: number; y0: number; x1: number; y1: number };
export type Seg = { x1: number; y1: number; x2: number; y2: number; pad: number };

export interface Looks {
  loads: boolean;
  reactions: boolean;
  deformed: boolean;
  dofs: boolean;
  nodeNumbers: boolean;
  memberNumbers: boolean;
  /** The numbers written beside loads and reactions. */
  values: boolean;
  /** What numbers are set apart with. */
  group: string;
  /** Nodes (labels) that are part of a problem: ringed. */
  flagged?: readonly number[];
}

export interface LayoutOptions extends Looks {
  /** The drawing's width in pixels. */
  width: number;
  /** The tallest the drawing may be (px). */
  maxHeight?: number;
  /** The size (px) the optional words are set at; without it, the largest of `SIZES` at which every one fits. */
  fontSize?: number;
  /** Stop at the first word that finds no place: only `thinned` of the result is to be trusted. */
  probe?: boolean;
}

export interface LabelBox {
  value: string;
  x: number;
  y: number;
  anchor: 'middle';
  rect: Rect;
  /** The text size, px. */
  size: number;
  /** A hairline from the word to the end of its mark, when the word could not stand within `TIE` of it. */
  leader: { x1: number; y1: number; x2: number; y2: number } | null;
}

export interface MemberShape {
  label: number;
  i: number;
  j: number;
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  /** Where the member's number is written, when numbers are asked for and a clear place was found. */
  tag: LabelBox | null;
}
export interface NodeShape {
  label: number;
  x: number;
  y: number;
  r: number;
  /** Whether its number is written in it (a circle) or not (a dot). */
  numbered: boolean;
  flagged: boolean;
  /** The DOF numbers beside the node, with a line under each that is held. */
  dofTag: { box: LabelBox; underlines: { x1: number; x2: number; y: number }[] } | null;
}
export type SupportKind = 'fixed' | 'pin' | 'roller' | 'guide' | 'rotation';
export interface SupportShape {
  label: number;
  node: number;
  kind: SupportKind;
  symbol: SupportSymbol;
  x: number;
  y: number;
  /** Degrees to turn the symbol - drawn pointing down the page - to its place. */
  rotation: number;
  /** How large the symbol is drawn beside its full size (1; less where supports stand close together). */
  scale: number;
  /** Unit vector, on the page (y down), from the node towards the ground the symbol stands on. */
  side: Point;
  depth: number;
  /** The box round the symbol and its mark, upright on the page. */
  box: Rect;
  /** Every side it may stand on has a member: it is drawn over one, with a halo. */
  blocked: boolean;
  /** A settlement badge beside the node. */
  badge: { x: number; y: number; r: number; leader: { x1: number; y1: number; x2: number; y2: number } | null } | null;
}
export interface ArrowShape {
  tail: Point;
  tip: Point;
  text: LabelBox | null;
}
export interface ArcShape {
  cx: number;
  cy: number;
  r: number;
  path: string;
  /** The arrow head at the end of the arc. */
  head: string;
  text: LabelBox | null;
}
export interface MemberLoadShape {
  label: number;
  member: number;
  kind: 'udl' | 'point' | 'axial';
  arrows: { tail: Point; tip: Point }[];
  /** The line joining the tails of a distributed load. */
  line: Point[] | null;
  text: LabelBox | null;
}
export interface DeformedShape {
  members: { member: number; points: string }[];
}

export type LegendKey =
  | 'member'
  | 'ghost'
  | 'node'
  | 'nodeDot'
  | 'deformed'
  | 'fixed'
  | 'pin'
  | 'roller'
  | 'guide'
  | 'rotation'
  | 'settle'
  | 'load'
  | 'loadMoment'
  | 'distributed'
  | 'pointLoad'
  | 'axialLoad'
  | 'reaction'
  | 'reactionMoment'
  | 'values'
  | 'leader'
  | 'dofTag'
  | 'tag'
  | 'flagged';

export interface Layout {
  width: number;
  height: number;
  /** Pixels per unit of length. */
  scale: number;
  /** The size (px) of the optional words. */
  fontSize: number;
  /** Whether the drawing's size follows its width (a wider drawing is a larger one). False for a tall structure, whose size follows its height. */
  widthBound: boolean;
  members: MemberShape[];
  nodes: NodeShape[];
  supports: SupportShape[];
  /** One entry for each node that carries a load: the sum of the loads on it (`count` of them). */
  loads: { label: number; node: number; count: number; arrows: ArrowShape[]; arc: ArcShape | null }[];
  memberLoads: MemberLoadShape[];
  reactions: { label: number; arrows: ArrowShape[]; arc: ArcShape | null }[];
  deformed: DeformedShape | null;
  /** The exaggeration of the deformed shape; null when there is none (or it is off). */
  factor: number | null;
  legend: LegendKey[];
  /** The nodes (labels) where several loads are drawn as their sum. */
  summed: number[];
  /** How many nodes are drawn as dots, though numbers were asked for, because they stand too close for a number. */
  dotted: number;
  /** How many words that were asked for have no place on the drawing. */
  thinned: number;
  /** The drawing could not be built for these numbers (a coordinate that is not a finite number, or a structure so large that its parts cannot be told apart): it is empty. */
  broken: boolean;
  /** Every word placed, as the rectangles they take: for the checks of clearance. */
  placed: Rect[];
  /** Every line and box a word must stay clear of. */
  obstacles: { segs: Seg[]; boxes: Rect[] };
}

const clean = (v: number): number => {
  const r = Math.round(v * 1e6) / 1e6;
  // (a number too large to be rounded at the sixth decimal is left as it is: never Infinity)
  if (!Number.isFinite(r)) return v;
  return r === 0 ? 0 : r;
};
const pt = (p: Point): Point => ({ x: clean(p.x), y: clean(p.y) });
const poly = (points: readonly Point[]): string => points.map((p) => `${clean(p.x)},${clean(p.y)}`).join(' ');

/** A size written on the drawing: the page's own number. */
export const plain = (v: number, group: string, sig = 4): string => formatNumber(Math.abs(v), sig, group);
export const withSign = (v: number, group: string, sig = 4): string => signed(formatNumber(Math.abs(v), sig, group), v);

/** The radius of a node's circle: wide enough for the digits written in it; a dot when numbers are off. */
export const nodeRadius = (label: number, numbered: boolean): number => (!numbered ? DOT_R : label >= 100 ? 10.6 : label >= 10 ? 8.8 : NODE_R);

/* ── Geometry ───────────────────────────────────────────────────────────── */

export function distPointRect(px: number, py: number, r: Rect): number {
  return Math.hypot(Math.max(r.x0 - px, 0, px - r.x1), Math.max(r.y0 - py, 0, py - r.y1));
}
export function distPointSeg(px: number, py: number, s: Seg): number {
  const dx = s.x2 - s.x1;
  const dy = s.y2 - s.y1;
  const l2 = dx * dx + dy * dy;
  const t = l2 === 0 ? 0 : Math.max(0, Math.min(1, ((px - s.x1) * dx + (py - s.y1) * dy) / l2));
  return Math.hypot(px - (s.x1 + t * dx), py - (s.y1 + t * dy));
}
/** Whether the segment passes through the rectangle (Liang-Barsky). */
function segCrossesRect(s: Seg, r: Rect): boolean {
  let t0 = 0;
  let t1 = 1;
  const dx = s.x2 - s.x1;
  const dy = s.y2 - s.y1;
  const p = [-dx, dx, -dy, dy];
  const q = [s.x1 - r.x0, r.x1 - s.x1, s.y1 - r.y0, r.y1 - s.y1];
  for (let i = 0; i < 4; i++) {
    if (p[i] === 0) {
      if (q[i] < 0) return false;
    } else {
      const t = q[i] / p[i];
      if (p[i] < 0) {
        if (t > t1) return false;
        if (t > t0) t0 = t;
      } else {
        if (t < t0) return false;
        if (t < t1) t1 = t;
      }
    }
  }
  return true;
}
/** Whether a line of the drawing (with its own half width) comes within `extra` of a rectangle. */
export function segNear(s: Seg, r: Rect, extra: number): boolean {
  const lim = s.pad + extra;
  if (Math.max(s.x1, s.x2) < r.x0 - lim || Math.min(s.x1, s.x2) > r.x1 + lim || Math.max(s.y1, s.y2) < r.y0 - lim || Math.min(s.y1, s.y2) > r.y1 + lim) return false;
  if (segCrossesRect(s, r)) return true;
  if (distPointRect(s.x1, s.y1, r) < lim || distPointRect(s.x2, s.y2, r) < lim) return true;
  return distPointSeg(r.x0, r.y0, s) < lim || distPointSeg(r.x1, r.y0, s) < lim || distPointSeg(r.x1, r.y1, s) < lim || distPointSeg(r.x0, r.y1, s) < lim;
}
/** The distance from a rectangle to a line (the line's own half width not counted); 0 when it passes through. */
export function distRectSeg(r: Rect, s: Seg): number {
  if (segCrossesRect(s, r)) return 0;
  return Math.min(distPointRect(s.x1, s.y1, r), distPointRect(s.x2, s.y2, r), distPointSeg(r.x0, r.y0, s), distPointSeg(r.x1, r.y0, s), distPointSeg(r.x1, r.y1, s), distPointSeg(r.x0, r.y1, s));
}
/** The distance from a rectangle to a circle (its line, not its disc); 0 where they meet. */
export function distRectRing(r: Rect, c: { cx: number; cy: number; r: number }): number {
  const near = distPointRect(c.cx, c.cy, r);
  if (near >= c.r) return near - c.r;
  const far = Math.max(Math.hypot(r.x0 - c.cx, r.y0 - c.cy), Math.hypot(r.x1 - c.cx, r.y0 - c.cy), Math.hypot(r.x0 - c.cx, r.y1 - c.cy), Math.hypot(r.x1 - c.cx, r.y1 - c.cy));
  return far <= c.r ? c.r - far : 0;
}
/** The least distance between two lines (their own half widths not counted). */
export function distSegSeg(a: Seg, b: Seg): number {
  const cross = (ax: number, ay: number, bx: number, by: number) => ax * by - ay * bx;
  const d1 = cross(a.x2 - a.x1, a.y2 - a.y1, b.x1 - a.x1, b.y1 - a.y1);
  const d2 = cross(a.x2 - a.x1, a.y2 - a.y1, b.x2 - a.x1, b.y2 - a.y1);
  const d3 = cross(b.x2 - b.x1, b.y2 - b.y1, a.x1 - b.x1, a.y1 - b.y1);
  const d4 = cross(b.x2 - b.x1, b.y2 - b.y1, a.x2 - b.x1, a.y2 - b.y1);
  if (((d1 > 0 && d2 < 0) || (d1 < 0 && d2 > 0)) && ((d3 > 0 && d4 < 0) || (d3 < 0 && d4 > 0))) return 0;
  return Math.min(distPointSeg(a.x1, a.y1, b), distPointSeg(a.x2, a.y2, b), distPointSeg(b.x1, b.y1, a), distPointSeg(b.x2, b.y2, a));
}
export const rectsNear = (a: Rect, b: Rect, pad: number): boolean => a.x0 < b.x1 + pad && b.x0 < a.x1 + pad && a.y0 < b.y1 + pad && b.y0 < a.y1 + pad;
const boxOf = (x: number, y: number, hx: number, hy: number): Rect => ({ x0: x - hx, y0: y - hy, x1: x + hx, y1: y + hy });
const unit = (x: number, y: number): Point => {
  const l = Math.hypot(x, y);
  return l === 0 ? { x: 0, y: 0 } : { x: x / l, y: y / l };
};

type Dir = 'r' | 'l' | 'u' | 'd' | 'ur' | 'ul' | 'dr' | 'dl';
const DIRS: { dir: Dir; v: Point }[] = [
  { dir: 'r', v: { x: 1, y: 0 } },
  { dir: 'l', v: { x: -1, y: 0 } },
  { dir: 'u', v: { x: 0, y: -1 } },
  { dir: 'd', v: { x: 0, y: 1 } },
  { dir: 'ur', v: { x: 0.7071, y: -0.7071 } },
  { dir: 'ul', v: { x: -0.7071, y: -0.7071 } },
  { dir: 'dr', v: { x: 0.7071, y: 0.7071 } },
  { dir: 'dl', v: { x: -0.7071, y: 0.7071 } },
];
/** The distances a number tries from the end of its mark: within `TIE`, and then - with a hairline - further. */
const GAPS_TIED = [2, 4, 6, 9, 12];
const GAPS_LEADER = [16, 22, 30, 40];
const GAPS_OPTIONAL = [2, 5, 9, 15, 23, 33];
const GAPS_BADGE = [3, 7, 12, 19, 28, 40];
/** A rectangle of w x h standing off a point, in a direction, by a gap. */
function spot(dir: Dir, p: Point, g: number, w: number, h: number): Rect {
  const d = g * 0.7;
  switch (dir) {
    case 'r':
      return { x0: p.x + g, y0: p.y - h / 2, x1: p.x + g + w, y1: p.y + h / 2 };
    case 'l':
      return { x0: p.x - g - w, y0: p.y - h / 2, x1: p.x - g, y1: p.y + h / 2 };
    case 'u':
      return { x0: p.x - w / 2, y0: p.y - g - h, x1: p.x + w / 2, y1: p.y - g };
    case 'd':
      return { x0: p.x - w / 2, y0: p.y + g, x1: p.x + w / 2, y1: p.y + g + h };
    case 'ur':
      return { x0: p.x + d, y0: p.y - d - h, x1: p.x + d + w, y1: p.y - d };
    case 'ul':
      return { x0: p.x - d - w, y0: p.y - d - h, x1: p.x - d, y1: p.y - d };
    case 'dr':
      return { x0: p.x + d, y0: p.y + d, x1: p.x + d + w, y1: p.y + d + h };
    case 'dl':
      return { x0: p.x - d - w, y0: p.y + d, x1: p.x - d, y1: p.y + d + h };
  }
}
const labelAt = (value: string, rect: Rect, f = 1): LabelBox => ({ value, x: clean((rect.x0 + rect.x1) / 2), y: clean(rect.y1 - 3.5 * f), anchor: 'middle', rect, size: BASE_SIZE * f, leader: null });
const widthOf = (value: string, char = CHAR, pad = 4): number => {
  // A power of ten is written as 10 and a raised exponent (Schematic.tsx): the exponent's digits take about 0.6 of a character.
  const m = /^(.*) × 10\^(−?\d+)$/.exec(value);
  return m ? (m[1].length + 4 + 0.6 * m[2].length) * char + pad : value.length * char + pad;
};

/* ── The obstacles, indexed ─────────────────────────────────────────────── */

const CELL = 48;
/** How far from the page's corner an obstacle is indexed: the widest drawing is 6,000 px (EVERY_MAX), and nothing is drawn outside it. */
const REACH = 8000;
const cellKey = (cx: number, cy: number) => cx * 4099 + cy;

/** The lines and boxes a word must stay clear of, in a grid, so that a word is tested against what is near it and not against the whole drawing. */
class Obstacles {
  readonly segs: Seg[] = [];
  readonly boxes: Rect[] = [];
  private cells = new Map<number, number[]>();
  private stamp: Int32Array = new Int32Array(0);
  private round = 0;
  private built = false;
  addSeg(s: Seg) {
    this.segs.push(s);
  }
  addBox(r: Rect) {
    this.boxes.push(r);
  }
  /** Indexes everything added. Items are 0..segs.length-1 for lines, then boxes. */
  build() {
    // Whatever an item's coordinates, the cells it is put in are those of the page's reach: an item outside it is put at the edge, and a
    // list can never be longer than the drawing is large.
    const reach = (v: number) => Math.max(-REACH, Math.min(REACH, Number.isFinite(v) ? v : 0));
    const put = (id: number, ax0: number, ay0: number, ax1: number, ay1: number) => {
      const x0 = reach(ax0);
      const y0 = reach(ay0);
      const x1 = reach(ax1);
      const y1 = reach(ay1);
      for (let cx = Math.floor(x0 / CELL); cx <= Math.floor(x1 / CELL); cx++) {
        for (let cy = Math.floor(y0 / CELL); cy <= Math.floor(y1 / CELL); cy++) {
          const k = cellKey(cx, cy);
          const list = this.cells.get(k);
          if (list) list.push(id);
          else this.cells.set(k, [id]);
        }
      }
    };
    this.segs.forEach((s, id) => put(id, Math.min(s.x1, s.x2) - s.pad, Math.min(s.y1, s.y2) - s.pad, Math.max(s.x1, s.x2) + s.pad, Math.max(s.y1, s.y2) + s.pad));
    this.boxes.forEach((b, k) => put(this.segs.length + k, b.x0, b.y0, b.x1, b.y1));
    this.stamp = new Int32Array(this.segs.length + this.boxes.length);
    this.built = true;
  }
  /** How many of them the rectangle touches, counting up to `ceiling`. */
  touches(rect: Rect, ceiling: number): number {
    if (!this.built) this.build();
    this.round++;
    const margin = 4 + FROM_LINE;
    let hits = 0;
    // A word outside the page's reach touches nothing here (and its cells are not counted: a loop over cells beyond 2^53 never ends).
    if (!(Math.abs(rect.x0) <= REACH && Math.abs(rect.x1) <= REACH && Math.abs(rect.y0) <= REACH && Math.abs(rect.y1) <= REACH)) return ceiling;
    for (let cx = Math.floor((rect.x0 - margin) / CELL); cx <= Math.floor((rect.x1 + margin) / CELL); cx++) {
      for (let cy = Math.floor((rect.y0 - margin) / CELL); cy <= Math.floor((rect.y1 + margin) / CELL); cy++) {
        const list = this.cells.get(cellKey(cx, cy));
        if (!list) continue;
        for (const id of list) {
          if (this.stamp[id] === this.round) continue;
          this.stamp[id] = this.round;
          const near = id < this.segs.length ? segNear(this.segs[id], rect, FROM_LINE) : rectsNear(rect, this.boxes[id - this.segs.length], FROM_BOX);
          if (near && ++hits >= ceiling) return hits;
        }
      }
    }
    return hits;
  }
}

/** The words already placed, in a grid: a new word is tested against those near it and not against all of them. */
class PlacedIndex {
  private cells = new Map<number, { r: Rect; stamp: number }[]>();
  private round = 0;
  add(r: Rect) {
    const entry = { r, stamp: 0 };
    for (let cx = Math.floor(r.x0 / CELL); cx <= Math.floor(r.x1 / CELL); cx++) {
      for (let cy = Math.floor(r.y0 / CELL); cy <= Math.floor(r.y1 / CELL); cy++) {
        const k = cellKey(cx, cy);
        const list = this.cells.get(k);
        if (list) list.push(entry);
        else this.cells.set(k, [entry]);
      }
    }
  }
  /** How many words are within `pad` of the rectangle, counting up to `ceiling`. */
  near(rect: Rect, pad: number, ceiling: number): number {
    this.round++;
    let hits = 0;
    for (let cx = Math.floor((rect.x0 - pad) / CELL); cx <= Math.floor((rect.x1 + pad) / CELL); cx++) {
      for (let cy = Math.floor((rect.y0 - pad) / CELL); cy <= Math.floor((rect.y1 + pad) / CELL); cy++) {
        const list = this.cells.get(cellKey(cx, cy));
        if (!list) continue;
        for (const e of list) {
          if (e.stamp === this.round) continue;
          e.stamp = this.round;
          if (rectsNear(rect, e.r, pad) && ++hits >= ceiling) return hits;
        }
      }
    }
    return hits;
  }
}

/* ── The room a drawing wants ───────────────────────────────────────────── */

/** The margin round the structure, in pixels: room for the supports and reactions below it, the loads above it and the numbers beside both. */
const marginFor = (avail: number): number => Math.round(Math.max(54, Math.min(70, avail * 0.12)));

interface Extent {
  x0: number;
  y0: number;
  x1: number;
  y1: number;
}
/** The structure and, when asked for, its deformed shape, in the length unit. */
function extentOf(d: StiffnessDrawing, deformed: boolean): Extent {
  const e: Extent = { x0: d.box.x0, y0: d.box.y0, x1: d.box.x1, y1: d.box.y1 };
  const grow = (p: Point) => {
    e.x0 = Math.min(e.x0, p.x);
    e.y0 = Math.min(e.y0, p.y);
    e.x1 = Math.max(e.x1, p.x);
    e.y1 = Math.max(e.y1, p.y);
  };
  if (deformed && d.deformed && d.deformed.factor !== null) {
    for (const m of d.deformed.members) for (const p of m.points) grow(p);
    for (const n of d.deformed.nodes) grow(n);
  }
  return e;
}

/** The least width of a bay on the page, px: narrower and the loads, labels and tags of neighbouring bays run into each other. */
const MIN_BAY_PX = 64;
/** The least height of a storey on the page, px. */
const MIN_STOREY_PX = 54;
/** The widest a drawing is made for the sake of its bays; past it the bays are as they are. */
const BAY_WIDTH_MAX = 1400;
/** A drawing that wants no more than this much beyond its column is drawn in the column, with its bays a little narrower, and does not scroll for a few pixels. */
const ROOM_SLACK = 1.04;

/** The gaps between the distinct x of the nodes, and between the distinct y, each as long as 2 % of the structure (a sliver is a node that is nearly on another). */
function gapsOf(drawing: StiffnessDrawing): { x: number; y: number } {
  const gap = (values: number[], side: number): number => {
    const unit = Math.max(side * 1e-6, 1e-300);
    const sorted = [...new Set(values.map((v) => Math.round(v / unit)))].sort((a, b) => a - b);
    let least = Infinity;
    for (let k = 1; k < sorted.length; k++) {
      const g = (sorted[k] - sorted[k - 1]) * unit;
      if (g >= 0.02 * side) least = Math.min(least, g);
    }
    return least;
  };
  const side = Math.max(drawing.side, 1e-300);
  return { x: gap(drawing.nodes.map((n) => n.x), side), y: gap(drawing.nodes.map((n) => n.y), side) };
}

/**
 * The width a drawing has to be for its bays to read: the narrowest bay (the least gap between the nodes' x) at 64 px, up to 1,400 px.
 * A drawing that is wider than the column it sits in scrolls sideways, and says so; the smaller of the two is what a drawing in a
 * narrow column is given. 0 when the drawing has no width to speak of.
 */
export function roomWanted(drawing: StiffnessDrawing, deformed: boolean): number {
  const e = extentOf(drawing, deformed);
  const ew = e.x1 - e.x0;
  const eh = e.y1 - e.y0;
  const { x, y } = gapsOf(drawing);
  if (!(ew > 0) || !Number.isFinite(ew) || !Number.isFinite(eh)) return 0;
  let need = Math.max(Number.isFinite(x) ? MIN_BAY_PX / x : 0, Number.isFinite(y) ? MIN_STOREY_PX / y : 0);
  if (eh > 0) need = Math.min(need, (MAX_HEIGHT - 2 * 70) / eh);
  return need > 0 ? Math.round(Math.min(BAY_WIDTH_MAX, need * ew + 2 * 70)) : 0;
}

/** The width a drawing in a column of `column` px is given for its bays: the column's own, or - when the bays want a good deal more - what they want. */
export function roomFor(drawing: StiffnessDrawing, deformed: boolean, column: number): number {
  const wanted = roomWanted(drawing, deformed);
  return wanted > column && wanted <= column * ROOM_SLACK ? column : Math.max(column, wanted);
}

/** The layout of a drawing that cannot be drawn: nothing in it, the room of a margin all round, and `broken` set. */
function brokenLayout(W: number): Layout {
  const side = Math.max(1, Number.isFinite(W) ? W : 1);
  return {
    width: side,
    height: Math.min(side, 120),
    scale: 1,
    fontSize: BASE_SIZE,
    widthBound: true,
    members: [],
    nodes: [],
    supports: [],
    loads: [],
    memberLoads: [],
    reactions: [],
    deformed: null,
    factor: null,
    legend: [],
    summed: [],
    dotted: 0,
    thinned: 0,
    broken: true,
    placed: [],
    obstacles: { segs: [], boxes: [] },
  };
}

/* ── The layout ─────────────────────────────────────────────────────────── */

/** The sides a support may stand on, in the order tried: the axis it holds (a roller or a guide holds one), or any side (a pin or a clamp holds both). */
const SIDES: Record<'x' | 'y' | 'any', Point[]> = {
  y: [
    { x: 0, y: 1 },
    { x: 0, y: -1 },
  ],
  x: [
    { x: -1, y: 0 },
    { x: 1, y: 0 },
  ],
  // A pin or a clamp: under the node, else above it (a structure hung from its supports), else beside it.
  any: [
    { x: 0, y: 1 },
    { x: 0, y: -1 },
    { x: -1, y: 0 },
    { x: 1, y: 0 },
  ],
};
const DEPTH: Record<SupportKind, number> = { fixed: 15, pin: 22, roller: 24, guide: 21, rotation: 14 };
const HALF: Record<SupportKind, number> = { fixed: 14, pin: 15, roller: 13, guide: 14, rotation: 12 };

const KIND_OF: Record<SupportSymbol, { kind: SupportKind; axis: 'x' | 'y' | 'any' } | null> = {
  fixed: { kind: 'fixed', axis: 'any' },
  pin: { kind: 'pin', axis: 'any' },
  'roller-y': { kind: 'roller', axis: 'y' },
  'roller-x': { kind: 'roller', axis: 'x' },
  'guide-y': { kind: 'guide', axis: 'y' },
  'guide-x': { kind: 'guide', axis: 'x' },
  rotation: { kind: 'rotation', axis: 'any' },
  none: null,
};

/** The loads at a node, added; a component that cancels to rounding is zero. */
interface NodeLoad {
  node: number;
  fx: number;
  fy: number;
  m: number;
  count: number;
}

export function stiffnessLayout(drawing: StiffnessDrawing, o: LayoutOptions): Layout {
  const W = o.width;
  // TOTAL: whatever numbers the drawing is made of, this returns, and fast. A width that is not a width, or an extent that is not a finite
  // size, is not drawn (the page says so); everything else is scaled to the page, so every pixel below is within it.
  if (!(W > 0) || !Number.isFinite(W)) return brokenLayout(300);
  const maxHeight = o.maxHeight ?? MAX_HEIGHT;
  const M = marginFor(W);
  const e = extentOf(drawing, o.deformed);
  const ew = e.x1 - e.x0;
  const eh = e.y1 - e.y0;
  if (![e.x0, e.y0, e.x1, e.y1, ew, eh].every(Number.isFinite)) return brokenLayout(W);
  const sx = ew > 0 ? (W - 2 * M) / ew : Infinity;
  const sy = eh > 0 ? (maxHeight - 2 * M) / eh : Infinity;
  const scale = ew > 0 || eh > 0 ? Math.min(sx, sy) : 1;
  if (!(scale > 0) || !Number.isFinite(scale)) return brokenLayout(W);
  const drawnW = ew * scale;
  const offX = (W - drawnW) / 2;
  const H = clean(Math.max(eh * scale + 2 * M, 2 * M));
  const X = (x: number) => offX + (x - e.x0) * scale;
  const Y = (y: number) => M + (e.y1 - y) * scale;
  const P = (p: Point): Point => ({ x: X(p.x), y: Y(p.y) });
  const inside = (rect: Rect) => rect.x0 >= 3 && rect.x1 <= W - 3 && rect.y0 >= 3 && rect.y1 <= H - 3;
  const flagged = new Set(o.flagged ?? []);
  const obstacles = new Obstacles();

  /* Members and nodes. */
  const nodePos = new Map<number, Point>();
  for (const n of drawing.nodes) nodePos.set(n.label, { x: X(n.x), y: Y(n.y) });
  const members: MemberShape[] = drawing.members.map((m) => ({ label: m.label, i: m.i, j: m.j, x1: clean(X(m.x1)), y1: clean(Y(m.y1)), x2: clean(X(m.x2)), y2: clean(Y(m.y2)), tag: null }));
  for (const m of members) obstacles.addSeg({ x1: m.x1, y1: m.y1, x2: m.x2, y2: m.y2, pad: MEMBER_W / 2 });
  const nodes: NodeShape[] = drawing.nodes.map((n) => ({ label: n.label, x: clean(X(n.x)), y: clean(Y(n.y)), r: nodeRadius(n.label, o.nodeNumbers), numbered: o.nodeNumbers, flagged: flagged.has(n.label), dofTag: null }));
  // Nodes that fall on one place (a node typed twice) are set side by side, so that each number can be read and each ringed.
  {
    const stacks = new Map<string, NodeShape[]>();
    for (const n of nodes) {
      const key = `${Math.round(n.x / 3)},${Math.round(n.y / 3)}`;
      stacks.set(key, [...(stacks.get(key) ?? []), n]);
    }
    for (const stack of stacks.values()) {
      if (stack.length < 2) continue;
      const step = 2 * Math.max(...stack.map((n) => n.r)) + 3;
      stack.sort((p, q) => p.label - q.label).forEach((n, k) => (n.x = clean(n.x + (k - (stack.length - 1) / 2) * step)));
    }
  }
  // Nodes that stand too close for their numbers (a very tall or very flat structure) are dots: the numbers are in the tables.
  let dotted = 0;
  if (o.nodeNumbers) {
    const crowded = new Set<NodeShape>();
    for (let a = 0; a < nodes.length; a++) {
      for (let b = a + 1; b < nodes.length; b++) {
        if (Math.hypot(nodes[a].x - nodes[b].x, nodes[a].y - nodes[b].y) < nodes[a].r + nodes[b].r + 3) {
          crowded.add(nodes[a]);
          crowded.add(nodes[b]);
        }
      }
    }
    for (const n of crowded) {
      n.r = DOT_R;
      n.numbered = false;
      dotted++;
    }
  }
  const radius = new Map(nodes.map((n) => [n.label, n.r]));
  const radiusOf = (node: number): number => radius.get(node) ?? NODE_R;
  for (const n of nodes) {
    const rr = n.r + (n.flagged ? 4 : 0) + 0.75;
    obstacles.addBox(boxOf(n.x, n.y, rr, rr));
  }
  const around = (node: number): Point[] =>
    drawing.members.flatMap((m) => {
      const other = m.i === node ? m.j : m.j === node ? m.i : 0;
      const a = nodePos.get(node);
      const b = other ? nodePos.get(other) : undefined;
      if (!a || !b) return [];
      const u = unit(b.x - a.x, b.y - a.y);
      return u.x === 0 && u.y === 0 ? [] : [u];
    });
  /** How far a member lies along the direction `s` from a node: 1 when it runs straight that way, -1 when none is on that side. */
  const clearance = (node: number, s: Point) => Math.max(-1, ...around(node).map((t) => t.x * s.x + t.y * s.y));

  /* Supports: which side of its node each stands on - on the axis it holds - and its symbol. */
  const sideFor = (node: number, candidates: Point[]): { side: Point; blocked: boolean } => {
    const free = candidates.find((s) => clearance(node, s) < 0.5);
    if (free) return { side: free, blocked: false };
    const least = candidates.reduce((best, s) => (clearance(node, s) < clearance(node, best) ? s : best));
    return { side: least, blocked: true };
  };
  const rotationOf = (sd: Point) => clean((Math.atan2(-sd.x, sd.y) * 180) / Math.PI);
  /** The upright box round a symbol drawn pointing down from the node (half width hw, reaching depth) and turned by `rotation`. */
  const symbolBox = (p: Point, rotation: number, hw: number, depth: number): Rect => {
    const th = (rotation * Math.PI) / 180;
    const corners = [
      [-hw, -1],
      [hw, -1],
      [hw, depth + 1],
      [-hw, depth + 1],
    ].map(([px, py]) => ({ x: p.x + px * Math.cos(th) - py * Math.sin(th), y: p.y + px * Math.sin(th) + py * Math.cos(th) }));
    return { x0: Math.min(...corners.map((c) => c.x)), y0: Math.min(...corners.map((c) => c.y)), x1: Math.max(...corners.map((c) => c.x)), y1: Math.max(...corners.map((c) => c.y)) };
  };
  const settles = new Set(drawing.supports.filter((s) => s.settle).map((s) => s.label));
  // The symbols are drawn smaller (to 0.55 of their size) where two supports stand nearer than a symbol is wide: the feet of a tall mast, a close pair.
  const symbolScale = (() => {
    const at = drawing.supports.flatMap((s) => {
      const p = nodePos.get(s.node);
      return p && KIND_OF[s.symbol] ? [p] : [];
    });
    let k = 1;
    for (let a = 0; a < at.length; a++) {
      for (let b = a + 1; b < at.length; b++) {
        const dx = Math.abs(at[a].x - at[b].x);
        if (dx > 1e-6 && dx < 34 && Math.abs(at[a].y - at[b].y) < 32) k = Math.min(k, Math.max(0.55, dx / 34));
      }
    }
    return k;
  })();
  const supports: SupportShape[] = drawing.supports.flatMap((s) => {
    const p = nodePos.get(s.node);
    const info = KIND_OF[s.symbol];
    if (!p || !info) return [];
    const pick = info.kind === 'rotation' ? { side: { x: 0, y: 1 }, blocked: false } : sideFor(s.node, SIDES[info.axis]);
    const sd = pick.side;
    const rotation = info.kind === 'rotation' ? 0 : rotationOf(sd);
    const depth = DEPTH[info.kind] * symbolScale;
    const box = info.kind === 'rotation' ? boxOf(p.x, p.y, 14 * symbolScale, 14 * symbolScale) : symbolBox(p, rotation, (HALF[info.kind] + 4) * symbolScale, depth);
    return [{ label: s.label, node: s.node, kind: info.kind, symbol: s.symbol, x: clean(p.x), y: clean(p.y), rotation, scale: clean(symbolScale), side: sd, depth, box: { x0: clean(box.x0), y0: clean(box.y0), x1: clean(box.x1), y1: clean(box.y1) }, blocked: pick.blocked, badge: null }];
  });
  for (const s of supports) obstacles.addBox(s.box);
  const supportAt = new Map(supports.map((s) => [s.node, s]));
  /* Arrow heads, arcs. */
  const headBox = (tail: Point, tip: Point): Rect => {
    const u = unit(tip.x - tail.x, tip.y - tail.y);
    const bx = tip.x - u.x * HEAD_LEN;
    const by = tip.y - u.y * HEAD_LEN;
    return { x0: Math.min(tip.x, bx) - HEAD_HALF, y0: Math.min(tip.y, by) - HEAD_HALF, x1: Math.max(tip.x, bx) + HEAD_HALF, y1: Math.max(tip.y, by) + HEAD_HALF };
  };
  /** Every arrow and ring drawn so far at each node, as lines: a new arrow at the same node keeps clear of them. */
  const arrowSegs = new Map<number, Seg[]>();
  const keepArrow = (node: number, s: Seg) => arrowSegs.set(node, [...(arrowSegs.get(node) ?? []), s]);
  const arrowObstacle = (tail: Point, tip: Point, node = 0) => {
    const s: Seg = { x1: tail.x, y1: tail.y, x2: tip.x, y2: tip.y, pad: 1.5 };
    obstacles.addSeg(s);
    if (node > 0) keepArrow(node, s);
    obstacles.addBox(headBox(tail, tip));
  };
  /** The members as lines on the page, for an arrow to keep clear of. */
  const memberSegs: Seg[] = members.map((m) => ({ x1: m.x1, y1: m.y1, x2: m.x2, y2: m.y2, pad: 0 }));
  /**
   * What is wrong with an arrow standing here at a node: it runs through a support symbol (100), a node (40), a member (40: nearer than a
   * node's own circle and a hair) or another arrow of the node (30). 0 is a clear place. `own`: the node's own symbol is not counted (a
   * reaction is built against it).
   */
  const penalty = (node: number, tail: Point, tip: Point, own: boolean): number => {
    const seg: Seg = { x1: tail.x, y1: tail.y, x2: tip.x, y2: tip.y, pad: 0 };
    const near = Math.min(5.5, radiusOf(node) + 1.2);
    let pen = 0;
    for (const sp of supports) if (!(own && sp.node === node) && segNear(seg, sp.box, 3)) pen += 100;
    for (const m of memberSegs) if (distSegSeg(seg, m) < near) pen += 40;
    for (const nd of nodes) if (nd.label !== node && segNear(seg, boxOf(nd.x, nd.y, nd.r + 3, nd.r + 3), 0)) pen += 40;
    for (const other of arrowSegs.get(node) ?? []) if (distSegSeg(seg, other) < 10) pen += 30;
    // The end of the arrow away from the node needs room for its number: an arrow that runs off the edge of the drawing is the last choice but one.
    const p0 = nodePos.get(node);
    if (p0) {
      const far = Math.hypot(tail.x - p0.x, tail.y - p0.y) >= Math.hypot(tip.x - p0.x, tip.y - p0.y) ? tail : tip;
      if (far.x < 16 || far.x > W - 16 || far.y < 10 || far.y > H - 10) pen += 25;
    }
    return pen;
  };
  /** The arrow of those offered that is clearest (the least penalty; the earlier of two alike). */
  const pickArrow = (node: number, offered: { tail: Point; tip: Point; out?: boolean }[], own: boolean): { tail: Point; tip: Point; out: boolean } => {
    let best = offered[0];
    let bestPen = Infinity;
    for (const c of offered) {
      const pen = penalty(node, c.tail, c.tip, own);
      if (pen < bestPen) {
        bestPen = pen;
        best = c;
        if (pen === 0) break;
      }
    }
    return { tail: pt(best.tail), tip: pt(best.tip), out: best.out === true };
  };
  /** The same arrow moved along its own perpendicular: the places it is tried at, nearest to its own first. */
  const shifted = (tail: Point, tip: Point, out?: boolean): { tail: Point; tip: Point; out?: boolean }[] => {
    const u = unit(tip.x - tail.x, tip.y - tail.y);
    return [0, 9, -9, 18, -18].map((off) => ({ tail: { x: tail.x - u.y * off, y: tail.y + u.x * off }, tip: { x: tip.x - u.y * off, y: tip.y + u.x * off }, out }));
  };
  /** The ring of a moment, as a path and as the lines it is made of. gap: the page angle (math, degrees) the opening is centred on. */
  const arcShape = (c: Point, r: number, gap: number, ccw: boolean): { path: string; head: string; segs: Seg[]; mid: Point } => {
    const rad = (deg: number) => (deg * Math.PI) / 180;
    const at = (deg: number): Point => ({ x: c.x + r * Math.cos(rad(deg)), y: c.y - r * Math.sin(rad(deg)) });
    const start = ccw ? gap + 45 : gap - 45;
    const end = ccw ? gap + 315 : gap - 315;
    const a = at(start);
    const b = at(end);
    const path = `M ${clean(a.x)} ${clean(a.y)} A ${r} ${r} 0 1 ${ccw ? 0 : 1} ${clean(b.x)} ${clean(b.y)}`;
    // The head: the arc's direction of travel at its end.
    const th = rad(end);
    const t = ccw ? { x: -Math.sin(th), y: -Math.cos(th) } : { x: Math.sin(th), y: Math.cos(th) };
    const base = { x: b.x - t.x * HEAD_LEN, y: b.y - t.y * HEAD_LEN };
    const head = poly([b, { x: base.x - t.y * HEAD_HALF, y: base.y + t.x * HEAD_HALF }, { x: base.x + t.y * HEAD_HALF, y: base.y - t.x * HEAD_HALF }]);
    const segs: Seg[] = [];
    let prev = a;
    const steps = 16;
    for (let k = 1; k <= steps; k++) {
      const q = at(start + ((end - start) * k) / steps);
      segs.push({ x1: prev.x, y1: prev.y, x2: q.x, y2: q.y, pad: 1.5 });
      prev = q;
    }
    return { path, head, segs, mid: { x: c.x + Math.cos(rad(gap)) * r, y: c.y - Math.sin(rad(gap)) * r } };
  };
  /** The page angle (math degrees, counter-clockwise) of the most open side of a node, for a ring's opening. */
  const openSide = (node: number): number => {
    let best = 90;
    let bestClear = Infinity;
    for (const deg of [45, 135, 225, 315, 90, 270, 0, 180]) {
      const s = { x: Math.cos((deg * Math.PI) / 180), y: -Math.sin((deg * Math.PI) / 180) };
      const c = clearance(node, s);
      if (c < bestClear - 1e-9) {
        bestClear = c;
        best = deg;
      }
    }
    return best;
  };

  /** The lines of a load or a reaction (an arrow, a ring, the arrows of a load on a member): what a number beside it is the size of. */
  type Mark = { segs: Seg[]; ring: { cx: number; cy: number; r: number } | null };
  const markDistance = (rect: Rect, m: Mark): number => Math.min(...m.segs.map((q) => distRectSeg(rect, q)), m.ring ? distRectRing(rect, m.ring) : Infinity);
  const marks: Mark[] = [];
  /** A number that goes with a mark: where it hugs (the end of its arrow, the opening of its ring) and the way it prefers to stand. */
  type Pending = { text: string; anchor: Point; prefer: Point; mark: Mark; set: (box: LabelBox) => void };
  const mandatory: Pending[] = [];
  const markOf = (segs: Seg[], ring: Mark['ring'] = null): Mark => {
    const m: Mark = { segs, ring };
    marks.push(m);
    return m;
  };
  const lineOf = (tail: Point, tip: Point): Seg => ({ x1: tail.x, y1: tail.y, x2: tip.x, y2: tip.y, pad: 0 });

  /* Nodal loads: the loads at one node are drawn as their sum, a component along each axis, as a reaction is drawn. */
  const sums = new Map<number, NodeLoad>();
  const terms = new Map<number, { fx: number; fy: number; m: number }>();
  for (const l of drawing.loads) {
    const s = sums.get(l.node) ?? { node: l.node, fx: 0, fy: 0, m: 0, count: 0 };
    const t = terms.get(l.node) ?? { fx: 0, fy: 0, m: 0 };
    s.fx += l.fx;
    s.fy += l.fy;
    s.m += l.m;
    s.count++;
    t.fx += Math.abs(l.fx);
    t.fy += Math.abs(l.fy);
    t.m += Math.abs(l.m);
    sums.set(l.node, s);
    terms.set(l.node, t);
  }
  const loadsAt: NodeLoad[] = [...sums.values()]
    .sort((a, b) => a.node - b.node)
    .map((s) => {
      const t = terms.get(s.node)!;
      const zero = (v: number, scale: number) => (Math.abs(v) <= 1e-12 * scale ? 0 : v);
      return { ...s, fx: zero(s.fx, t.fx), fy: zero(s.fy, t.fy), m: zero(s.m, t.m) };
    });
  const summed = loadsAt.filter((s) => s.count > 1).map((s) => s.node);
  const maxLoad = Math.max(0, ...loadsAt.flatMap((l) => [Math.abs(l.fx), Math.abs(l.fy)]));
  /**
   * A force's arrow at a node: it stands on the side the force comes from (head on the node) unless a member, another arrow or the symbol
   * of the support is there; then on the side it goes to (tail on the node); then beside the node. Of these, the first that is clear.
   */
  const forceArrow = (node: number, p: Point, r: number, dir: Point, len: number): { tail: Point; tip: Point; far: Point; toward: Point } => {
    const back = { x: -dir.x, y: -dir.y };
    const inFrom = { x: p.x + back.x * (r + 2), y: p.y + back.y * (r + 2) };
    const outFrom = { x: p.x + dir.x * (r + 2), y: p.y + dir.y * (r + 2) };
    const inArrow = { tail: { x: inFrom.x - dir.x * len, y: inFrom.y - dir.y * len }, tip: inFrom };
    const outArrow = { tail: outFrom, tip: { x: outFrom.x + dir.x * len, y: outFrom.y + dir.y * len } };
    const lat = { x: -dir.y, y: dir.x };
    const beside = [lat, { x: -lat.x, y: -lat.y }].map((side) => {
      const from = { x: p.x + side.x * (r + 9), y: p.y + side.y * (r + 9) };
      return { tail: { x: from.x - dir.x * len, y: from.y - dir.y * len }, tip: from };
    });
    const offered = [...shifted(inArrow.tail, inArrow.tip, false).slice(0, 1), ...shifted(outArrow.tail, outArrow.tip, true).slice(0, 1), ...shifted(inArrow.tail, inArrow.tip, false).slice(1, 3), ...shifted(outArrow.tail, outArrow.tip, true).slice(1, 3), ...beside.map((b) => ({ ...b, out: false }))];
    const f = pickArrow(node, offered, false);
    return { tail: f.tail, tip: f.tip, far: f.out ? f.tip : f.tail, toward: f.out ? dir : back };
  };
  const loads: Layout['loads'] = [];
  if (o.loads) {
    for (const l of loadsAt) {
      const p = nodePos.get(l.node);
      if (!p) continue;
      const r = radiusOf(l.node);
      const arrows: ArrowShape[] = [];
      let arc: ArcShape | null = null;
      for (const [cx, cy, size] of [[Math.sign(l.fx), 0, Math.abs(l.fx)], [0, Math.sign(l.fy), Math.abs(l.fy)]] as const) {
        if (!(size > 0)) continue;
        const len = 18 + 18 * (maxLoad > 0 ? size / maxLoad : 0);
        const f = forceArrow(l.node, p, r, { x: cx, y: -cy }, len);
        const arrow: ArrowShape = { tail: f.tail, tip: f.tip, text: null };
        arrows.push(arrow);
        arrowObstacle(f.tail, f.tip, l.node);
        const mark = markOf([lineOf(f.tail, f.tip)]);
        if (o.values) mandatory.push({ text: plain(size, o.group), anchor: f.far, prefer: f.toward, mark, set: (b) => (arrow.text = b) });
      }
      if (l.m !== 0) {
        const gap = openSide(l.node);
        const radiusRing = r + 10;
        const a = arcShape(p, radiusRing, gap, l.m > 0);
        for (const s of a.segs) {
          obstacles.addSeg(s);
          keepArrow(l.node, s);
        }
        arc = { cx: clean(p.x), cy: clean(p.y), r: radiusRing, path: a.path, head: a.head, text: null };
        const target = arc;
        const mark = markOf([], { cx: p.x, cy: p.y, r: radiusRing });
        if (o.values) mandatory.push({ text: plain(l.m, o.group), anchor: a.mid, prefer: { x: Math.cos((gap * Math.PI) / 180), y: -Math.sin((gap * Math.PI) / 180) }, mark, set: (b) => (target.text = b) });
      }
      loads.push({ label: l.node, node: l.node, count: l.count, arrows, arc });
    }
  }

  /* Reactions: a component along each axis beside the symbol; a ring for a moment. */
  const reactions: Layout['reactions'] = [];
  if (o.reactions) {
    const topComp = Math.max(0, ...drawing.reactions.flatMap((r) => [Math.abs(r.rx), Math.abs(r.ry)]));
    for (const r of drawing.reactions) {
      const p = nodePos.get(r.node);
      if (!p) continue;
      const rn = radiusOf(r.node);
      const sup = supportAt.get(r.node);
      const sd = sup?.side ?? { x: 0, y: 1 };
      const depth = sup?.depth ?? 8;
      const hwid = sup ? Math.max(6, (sup.box.x1 - sup.box.x0) / 2) : 8;
      const arrows: ArrowShape[] = [];
      const one = (fx: number, fy: number, magnitude: number) => {
        if (!(magnitude > 0)) return;
        const dir = unit(fx, -fy);
        const len = 18 + 14 * (topComp > 0 ? magnitude / topComp : 0);
        const parallel = dir.x * sd.x + dir.y * sd.y;
        let tip: Point;
        let tail: Point;
        let mirrored: { tail: Point; tip: Point } | null = null;
        if (Math.abs(parallel) > 0.7) {
          const start = { x: p.x + sd.x * (depth + GAP), y: p.y + sd.y * (depth + GAP) };
          const toNode = parallel < 0;
          tip = toNode ? start : { x: start.x + dir.x * len, y: start.y + dir.y * len };
          tail = toNode ? { x: start.x - dir.x * len, y: start.y - dir.y * len } : start;
        } else {
          // Across the symbol's axis: beside it, on the side the force points away from, pointing at the node.
          const lat = { x: -dir.x, y: -dir.y };
          const centre = { x: p.x + sd.x * depth * 0.5, y: p.y + sd.y * depth * 0.5 };
          tip = { x: centre.x + lat.x * (hwid + GAP), y: centre.y + lat.y * (hwid + GAP) };
          tail = { x: tip.x + lat.x * len, y: tip.y + lat.y * len };
          // The same force on the other side of the symbol, leaving it: where the first has no room (a foot at the edge of the drawing) or is taken.
          const from = { x: centre.x + dir.x * (hwid + GAP), y: centre.y + dir.y * (hwid + GAP) };
          mirrored = { tail: from, tip: { x: from.x + dir.x * len, y: from.y + dir.y * len } };
        }
        // Clear of a load that stands at the same node, and of the edge of the drawing.
        const n = pickArrow(r.node, [...shifted(tail, tip), ...(mirrored ? shifted(mirrored.tail, mirrored.tip) : [])], true);
        const a: ArrowShape = { tail: n.tail, tip: n.tip, text: null };
        arrows.push(a);
        arrowObstacle(a.tail, a.tip, r.node);
        // The number hugs the end of the arrow that is away from the node, on its line.
        const farTail = Math.hypot(a.tail.x - p.x, a.tail.y - p.y) >= Math.hypot(a.tip.x - p.x, a.tip.y - p.y);
        const far = farTail ? a.tail : a.tip;
        const near = farTail ? a.tip : a.tail;
        const mark = markOf([lineOf(a.tail, a.tip)]);
        if (o.values) mandatory.push({ text: plain(magnitude, o.group), anchor: far, prefer: unit(far.x - near.x, far.y - near.y), mark, set: (b) => (a.text = b) });
      };
      one(r.rx, 0, Math.abs(r.rx));
      one(0, r.ry, Math.abs(r.ry));
      let arc: ArcShape | null = null;
      if (r.rm !== 0) {
        const gap = openSide(r.node);
        const radiusRing = rn + 17;
        const a = arcShape(p, radiusRing, gap, r.rm > 0);
        for (const s of a.segs) {
          obstacles.addSeg(s);
          keepArrow(r.node, s);
        }
        arc = { cx: clean(p.x), cy: clean(p.y), r: radiusRing, path: a.path, head: a.head, text: null };
        const target = arc;
        const mark = markOf([], { cx: p.x, cy: p.y, r: radiusRing });
        if (o.values) mandatory.push({ text: plain(r.rm, o.group), anchor: a.mid, prefer: { x: Math.cos((gap * Math.PI) / 180), y: -Math.sin((gap * Math.PI) / 180) }, mark, set: (b) => (target.text = b) });
      }
      reactions.push({ label: r.node, arrows, arc });
    }
  }

  /* Member loads. */
  const memberAt = new Map(drawing.members.map((m, k) => [m.label, { m, s: members[k] }]));
  const memberLoads: MemberLoadShape[] = [];
  if (o.loads) {
    for (const l of drawing.memberLoads) {
      const found = memberAt.get(l.member);
      if (!found) continue;
      const { m: wm, s: ms } = found;
      const Lw = Math.hypot(wm.x2 - wm.x1, wm.y2 - wm.y1);
      if (!(Lw > 0)) continue;
      const a0 = { x: ms.x1, y: ms.y1 };
      const t = unit(ms.x2 - ms.x1, ms.y2 - ms.y1);
      const nrm = { x: t.y, y: -t.x };
      const Lpx = Math.hypot(ms.x2 - ms.x1, ms.y2 - ms.y1);
      // A load placed past an end of its member (which is a fault the page names) is drawn at that end: nothing is drawn off the page.
      const at = (pos: number): Point => {
        const share = Number.isFinite(pos) ? Math.min(1, Math.max(0, pos / Lw)) : 0;
        return { x: a0.x + t.x * Lpx * share, y: a0.y + t.y * Lpx * share };
      };
      const shape: MemberLoadShape = { label: l.label, member: l.member, kind: l.kind, arrows: [], line: null, text: null };
      // The direction a load pushes, on the page: the unit vector of a positive value, reversed for a negative one.
      const sgn = l.value < 0 ? -1 : 1;
      const push = { x: l.dx * sgn, y: -l.dy * sgn };
      if (l.kind === 'udl') {
        const p1 = at(l.a);
        const p2 = at(l.b);
        const segLen = Math.hypot(p2.x - p1.x, p2.y - p1.y);
        const count = Math.max(2, Math.min(14, Math.round(segLen / 20) + 1));
        const tails: Point[] = [];
        const h = 9 + 15 * l.share;
        let textAt: Point | null = null;
        let textPrefer: Point = { x: -push.x, y: -push.y };
        for (let k = 0; k < count; k++) {
          const u = k / (count - 1);
          const base = { x: p1.x + (p2.x - p1.x) * u, y: p1.y + (p2.y - p1.y) * u };
          const tip = { x: base.x - push.x * 3, y: base.y - push.y * 3 };
          const tail = { x: tip.x - push.x * h, y: tip.y - push.y * h };
          shape.arrows.push({ tail: pt(tail), tip: pt(tip) });
          tails.push(tail);
          if (k === Math.floor((count - 1) / 2)) {
            textAt = tail;
            textPrefer = { x: -push.x, y: -push.y };
          }
        }
        if (tails.length >= 2) shape.line = tails.map(pt);
        for (const ar of shape.arrows) arrowObstacle(ar.tail, ar.tip);
        if (shape.line) for (let k = 1; k < shape.line.length; k++) obstacles.addSeg({ x1: shape.line[k - 1].x, y1: shape.line[k - 1].y, x2: shape.line[k].x, y2: shape.line[k].y, pad: 1 });
        const mark = markOf([...shape.arrows.map((q) => lineOf(q.tail, q.tip)), ...(shape.line ?? []).slice(1).map((q, k) => lineOf(shape.line![k], q))]);
        if (textAt && o.values) mandatory.push({ text: plain(l.value, o.group), anchor: textAt, prefer: textPrefer, mark, set: (b) => (shape.text = b) });
      } else if (l.kind === 'point') {
        const base = at(l.a);
        const len = 20 + 14 * l.share;
        const tip = { x: base.x - push.x * 3, y: base.y - push.y * 3 };
        const tail = { x: tip.x - push.x * len, y: tip.y - push.y * len };
        shape.arrows.push({ tail: pt(tail), tip: pt(tip) });
        arrowObstacle(tail, tip);
        const mark = markOf([lineOf(tail, tip)]);
        if (o.values) mandatory.push({ text: plain(l.value, o.group), anchor: tail, prefer: { x: tail.x - tip.x, y: tail.y - tip.y }, mark, set: (b) => (shape.text = b) });
      } else {
        // Along the member: the arrows run beside it.
        const p1 = at(l.a);
        const p2 = at(l.b);
        const segLen = Math.hypot(p2.x - p1.x, p2.y - p1.y);
        const count = Math.max(2, Math.min(8, Math.round(segLen / 36) + 1));
        const off = { x: nrm.x * 10, y: nrm.y * 10 };
        const len = 14 + 6 * l.share;
        let textAt: Point | null = null;
        for (let k = 0; k < count; k++) {
          const u = k / (count - 1);
          const base = { x: p1.x + (p2.x - p1.x) * u + off.x, y: p1.y + (p2.y - p1.y) * u + off.y };
          const tipPoint = { x: base.x + push.x * len * 0.5, y: base.y + push.y * len * 0.5 };
          const tailPoint = { x: base.x - push.x * len * 0.5, y: base.y - push.y * len * 0.5 };
          shape.arrows.push({ tail: pt(tailPoint), tip: pt(tipPoint) });
          arrowObstacle(tailPoint, tipPoint);
          if (k === Math.floor((count - 1) / 2)) textAt = { x: base.x, y: base.y };
        }
        const mark = markOf(shape.arrows.map((q) => lineOf(q.tail, q.tip)));
        if (textAt && o.values) mandatory.push({ text: plain(l.value, o.group), anchor: textAt, prefer: nrm, mark, set: (b) => (shape.text = b) });
      }
      memberLoads.push(shape);
    }
  }

  /* The deformed shape, in pixels. */
  let deformed: DeformedShape | null = null;
  let factor: number | null = null;
  if (o.deformed && drawing.deformed && drawing.deformed.factor !== null) {
    factor = drawing.deformed.factor;
    const shape: DeformedShape = { members: [] };
    for (const dm of drawing.deformed.members) {
      const line = dm.points.map((q) => pt(P(q)));
      shape.members.push({ member: dm.member, points: poly(line) });
      for (let k = 1; k < line.length; k++) obstacles.addSeg({ x1: line[k - 1].x, y1: line[k - 1].y, x2: line[k].x, y2: line[k].y, pad: 1 });
    }
    deformed = shape;
  }

  /* The words the visitor asks for: member numbers, and the DOF numbers of each node. */
  interface Wanted {
    text: string;
    anchor: Point;
    prefer: Point;
    weight: number;
    keep: (box: LabelBox, size: number) => void;
  }
  const wanted: Wanted[] = [];
  if (o.memberNumbers) {
    for (const ms of members) {
      const mid = { x: (ms.x1 + ms.x2) / 2, y: (ms.y1 + ms.y2) / 2 };
      const t = unit(ms.x2 - ms.x1, ms.y2 - ms.y1);
      const prefer = t.x === 0 && t.y === 0 ? { x: 1, y: 0 } : { x: t.y, y: -t.x };
      wanted.push({ text: String(ms.label), anchor: mid, prefer, weight: 1.5, keep: (box) => (ms.tag = { ...box, value: String(ms.label) }) });
    }
  }
  if (o.dofs) {
    drawing.nodes.forEach((dn, k) => {
      const ns = nodes[k];
      const text = dn.dofs.join(' ');
      // Away from the members that meet at the node (and from its support).
      const away = around(dn.label).reduce((acc, u) => ({ x: acc.x - u.x, y: acc.y - u.y }), { x: 0, y: 0 });
      const sup = supportAt.get(dn.label);
      const from = sup ? { x: away.x - sup.side.x, y: away.y - sup.side.y } : away;
      const prefer = unit(from.x, from.y);
      wanted.push({
        text,
        anchor: { x: ns.x, y: ns.y },
        prefer: prefer.x === 0 && prefer.y === 0 ? { x: 1, y: -1 } : prefer,
        weight: 1.2,
        keep: (box, size) => {
          // A line under each number that is held: the characters are of one width, so the line is where the number is.
          const f = size / BASE_SIZE;
          const char = CHAR * f;
          const total = text.length * char;
          const start = box.x - total / 2;
          const underlines: { x1: number; x2: number; y: number }[] = [];
          let at = 0;
          dn.dofs.forEach((d, q) => {
            const len = String(d).length * char;
            if (dn.restrained[q]) underlines.push({ x1: clean(start + at), x2: clean(start + at + len), y: clean(box.y + 2) });
            at += len + char;
          });
          ns.dofTag = { box, underlines };
        },
      });
    });
  }

  obstacles.build();
  const placed: Rect[] = [];
  // The words that are always written are indexed once; the optional ones in an index of their own, begun again by each size tried.
  const fixedWords = new PlacedIndex();
  let optionalWords = new PlacedIndex();
  let fixedPhase = true;
  const put = (r: Rect) => {
    placed.push(r);
    if (fixedPhase) fixedWords.add(r);
    else optionalWords.add(r);
  };
  const touches = (rect: Rect, ceiling = Infinity): number => {
    if (!inside(rect)) return 1000;
    let hits = obstacles.touches(rect, ceiling);
    if (hits >= ceiling) return hits;
    hits += fixedWords.near(rect, FROM_LABEL, ceiling - hits);
    if (hits >= ceiling) return hits;
    return hits + optionalWords.near(rect, FROM_LABEL, ceiling - hits);
  };
  /** Searches outwards from a point for a clear place, preferring the directions nearest `prefer`; the least bad one when none is clear. */
  const search = (p: Point, prefer: Point, w: number, h: number, gaps: readonly number[], accept?: (rect: Rect) => boolean): { rect: Rect; hits: number; gap: number } => {
    const ranked = [...DIRS].sort((a, b) => b.v.x * prefer.x + b.v.y * prefer.y - (a.v.x * prefer.x + a.v.y * prefer.y));
    const spots = gaps.flatMap((g) => ranked.map((d, i) => ({ g, dir: d.dir, cost: g + 9 * i }))).sort((a, b) => a.cost - b.cost);
    // A word is written only where NOTHING is touched, so a place is clear or it is not: the count stops at the first thing it touches.
    let first: Rect | null = null;
    let firstGap = 0;
    for (const sp of spots) {
      const rect = spot(sp.dir, p, sp.g, w, h);
      if (touches(rect, 1) === 0 && (!accept || accept(rect))) return { rect, hits: 0, gap: sp.g };
      if (first === null) {
        first = rect;
        firstGap = sp.g;
      }
    }
    return { rect: first!, hits: 1, gap: firstGap };
  };

  // The settlement badges: the first marks placed on the clear paper, each beside its node and clear of every line; the value is in the sentence under the drawing.
  for (const s of supports) {
    if (!settles.has(s.label)) continue;
    const away = around(s.node).reduce((acc, u) => ({ x: acc.x - u.x, y: acc.y - u.y }), { x: 0, y: 0 });
    const from = s.kind === 'rotation' ? away : { x: away.x - s.side.x, y: away.y - s.side.y };
    const toward = unit(from.x, from.y);
    const prefer = toward.x === 0 && toward.y === 0 ? { x: -1, y: -1 } : toward;
    const reach = radiusOf(s.node);
    const found = search({ x: s.x, y: s.y }, prefer, BADGE_BOX, BADGE_BOX, GAPS_BADGE.map((g) => g + reach));
    const rect = found.rect;
    const cx = clean((rect.x0 + rect.x1) / 2);
    const cy = clean((rect.y0 + rect.y1) / 2);
    // The badge stands off the node; a short line ties it to the node when it is not next to it.
    const dist = Math.hypot(cx - s.x, cy - s.y);
    const ux = (s.x - cx) / (dist || 1);
    const uy = (s.y - cy) / (dist || 1);
    const leader = dist > radiusOf(s.node) + BADGE_R + 6 ? { x1: clean(cx + ux * BADGE_R), y1: clean(cy + uy * BADGE_R), x2: clean(s.x - ux * radiusOf(s.node)), y2: clean(s.y - uy * radiusOf(s.node)) } : null;
    s.badge = { x: cx, y: cy, r: BADGE_R, leader };
    put(rect);
  }

  // The words that are always written: a load's, a reaction's, a member load's. Each hugs the end of its mark (within `TIE`); the smaller
  // text is tried before it is moved; a number that can only go further is tied to its mark by a hairline; one that finds no place on a
  // crowded drawing is not written on it (never on a line "because there was no room"): it is counted, and it is in the tables.
  let mandatoryLeft = 0;
  for (const m of mandatory) {
    let done = false;
    // A number belongs to the mark it is nearest: no other mark of the drawing is nearer to it than its own (a ring's number is not measured
    // against the rings round the same node, which lie one in another). Only the marks near the number's own are looked at.
    const near = (q: Mark): boolean => {
      const c = q.ring ? { x: q.ring.cx, y: q.ring.cy } : { x: (q.segs[0].x1 + q.segs[0].x2) / 2, y: (q.segs[0].y1 + q.segs[0].y2) / 2 };
      const reach = q.ring ? q.ring.r : Math.max(0, ...q.segs.map((z) => Math.hypot(z.x2 - z.x1, z.y2 - z.y1)));
      return Math.hypot(c.x - m.anchor.x, c.y - m.anchor.y) < 90 + reach;
    };
    const rivals = marks.filter((q) => q !== m.mark && !(m.mark.ring && q.ring) && near(q));
    const belongs = (rect: Rect): boolean => {
      const own = markDistance(rect, m.mark);
      return rivals.every((q) => markDistance(rect, q) >= own - 0.75);
    };
    for (const size of SIZES) {
      const f = size / BASE_SIZE;
      const found = search(m.anchor, m.prefer, widthOf(m.text, CHAR * f, 4 * f), LABEL_H * f, GAPS_TIED, belongs);
      if (found.hits === 0) {
        put(found.rect);
        m.set(labelAt(m.text, found.rect, f));
        done = true;
        break;
      }
    }
    if (done) continue;
    const far = search(m.anchor, m.prefer, widthOf(m.text), LABEL_H, GAPS_LEADER);
    if (far.hits > 0) {
      mandatoryLeft++;
      continue;
    }
    // The hairline runs from the end of the mark to the nearest point of the word.
    const nx = Math.min(Math.max(m.anchor.x, far.rect.x0), far.rect.x1);
    const ny = Math.min(Math.max(m.anchor.y, far.rect.y0), far.rect.y1);
    const box = labelAt(m.text, far.rect);
    box.leader = { x1: clean(m.anchor.x), y1: clean(m.anchor.y), x2: clean(nx), y2: clean(ny) };
    put(far.rect);
    // The hairline is a line later words keep clear of.
    fixedWords.add({ x0: Math.min(m.anchor.x, nx) - 1.5, y0: Math.min(m.anchor.y, ny) - 1.5, x1: Math.max(m.anchor.x, nx) + 1.5, y1: Math.max(m.anchor.y, ny) + 1.5 });
    m.set(box);
  }
  const keptPlaced = placed.length;
  fixedPhase = false;
  wanted.sort((p, q) => q.weight - p.weight);
  // Takes back what a size placed: the words it set in the drawing's shapes are written again by the next.
  const reset = () => {
    placed.length = keptPlaced;
    optionalWords = new PlacedIndex();
    for (const ms of members) ms.tag = null;
    for (const ns of nodes) ns.dofTag = null;
  };
  const placeWords = (size: number, probe: boolean): number => {
    const f = size / BASE_SIZE;
    reset();
    let left = 0;
    for (const w of wanted) {
      const found = search(w.anchor, w.prefer, widthOf(w.text, CHAR * f, 4 * f), LABEL_H * f, GAPS_OPTIONAL);
      if (found.hits === 0) {
        put(found.rect);
        w.keep(labelAt(w.text, found.rect, f), size);
      } else {
        left++;
        if (probe) return left;
      }
    }
    return left;
  };
  let fontSize: number = BASE_SIZE;
  let thinned: number;
  if (o.fontSize !== undefined) {
    fontSize = o.fontSize;
    thinned = placeWords(fontSize, o.probe === true);
  } else {
    let bestLeft = Infinity;
    let lastTried: number = BASE_SIZE;
    for (const size of SIZES) {
      const left = placeWords(size, false);
      lastTried = size;
      if (left < bestLeft) {
        bestLeft = left;
        fontSize = size;
      }
      if (left === 0) break;
    }
    thinned = bestLeft === Infinity ? 0 : bestLeft;
    if (lastTried !== fontSize) placeWords(fontSize, false);
  }
  thinned += mandatoryLeft;

  /* What the legend has to explain: only what is drawn. */
  const legend: LegendKey[] = [];
  const kinds = new Set(supports.map((s) => s.kind));
  if (members.length > 0 && !deformed) legend.push('member');
  if (members.length > 0 && deformed) legend.push('ghost');
  if (nodes.some((n) => n.numbered)) legend.push('node');
  if (nodes.some((n) => !n.numbered)) legend.push('nodeDot');
  if (deformed) legend.push('deformed');
  for (const k of ['fixed', 'pin', 'roller', 'guide', 'rotation'] as const) if (kinds.has(k)) legend.push(k);
  if (supports.some((s) => s.badge)) legend.push('settle');
  if (loads.some((l) => l.arrows.length > 0)) legend.push('load');
  if (loads.some((l) => l.arc)) legend.push('loadMoment');
  if (memberLoads.some((l) => l.kind === 'udl')) legend.push('distributed');
  if (memberLoads.some((l) => l.kind === 'point')) legend.push('pointLoad');
  if (memberLoads.some((l) => l.kind === 'axial')) legend.push('axialLoad');
  if (reactions.some((r) => r.arrows.length > 0)) legend.push('reaction');
  if (reactions.some((r) => r.arc)) legend.push('reactionMoment');
  const valued = (b: LabelBox | null) => b !== null;
  if (loads.some((l) => l.arrows.some((a) => valued(a.text)) || valued(l.arc?.text ?? null)) || memberLoads.some((l) => valued(l.text)) || reactions.some((r) => r.arrows.some((a) => valued(a.text)) || valued(r.arc?.text ?? null))) legend.push('values');
  const tied = (b: LabelBox | null) => b !== null && b.leader !== null;
  if (loads.some((l) => l.arrows.some((a) => tied(a.text)) || tied(l.arc?.text ?? null)) || memberLoads.some((l) => tied(l.text)) || reactions.some((r) => r.arrows.some((a) => tied(a.text)) || tied(r.arc?.text ?? null)) || supports.some((s) => s.badge?.leader)) legend.push('leader');
  if (nodes.some((n) => n.dofTag)) legend.push('dofTag');
  if (members.some((m) => m.tag)) legend.push('tag');
  if (nodes.some((n) => n.flagged)) legend.push('flagged');

  return {
    width: W,
    height: H,
    scale: clean(scale),
    fontSize,
    widthBound: sx <= sy,
    members,
    nodes,
    supports,
    loads,
    memberLoads,
    reactions,
    deformed,
    factor,
    legend,
    summed: o.loads ? summed : [],
    dotted,
    thinned,
    broken: false,
    placed,
    obstacles: { segs: obstacles.segs, boxes: obstacles.boxes },
  };
}

/* ── What the page asks of a drawing before it draws it ─────────────────── */

const layouts = new WeakMap<StiffnessDrawing, Map<string, Layout>>();
/** `stiffnessLayout`, kept for the drawing it was made of: the page asks for the same layout twice (to draw it and to know whether to offer a switch). */
export function layoutFor(drawing: StiffnessDrawing, o: LayoutOptions): Layout {
  if (o.probe) return stiffnessLayout(drawing, o);
  const key = JSON.stringify([o.width, o.loads, o.reactions, o.deformed, o.dofs, o.nodeNumbers, o.memberNumbers, o.values, o.group, o.flagged ?? null, o.maxHeight ?? null, o.fontSize ?? null]);
  let held = layouts.get(drawing);
  if (!held) layouts.set(drawing, (held = new Map()));
  const found = held.get(key);
  if (found) return found;
  const made = stiffnessLayout(drawing, o);
  if (held.size >= 24) held.clear();
  held.set(key, made);
  return made;
}

/**
 * The width that "Show every word" draws the structure at: the column's own (`base`) when every word already has a place, else the least
 * width, up to 6,000 px, at which every word fits at the smallest size. `complete` is whether that was found: a drawing that is not wider
 * for being wider (a tall structure) or that no width suits is left as it is (`width` is `base`, `complete` false).
 */
export function everyWidth(drawing: StiffnessDrawing, o: Looks, base: number): { width: number; complete: boolean } {
  const at = (width: number, extra: Partial<LayoutOptions> = {}) => ({ ...o, width, ...extra });
  const first = layoutFor(drawing, at(base));
  if (first.thinned === 0) return { width: base, complete: false };
  if (!first.widthBound) return { width: base, complete: false };
  const smallest = SIZES[SIZES.length - 1];
  const fits = (width: number) => stiffnessLayout(drawing, at(width, { fontSize: smallest, probe: true })).thinned === 0;
  let lo = base;
  let hi = Math.min(EVERY_MAX, Math.round(base * 1.35));
  while (!fits(hi)) {
    if (hi >= EVERY_MAX) return { width: base, complete: false };
    lo = hi;
    hi = Math.min(EVERY_MAX, Math.round(hi * 1.35));
  }
  for (let i = 0; i < 5 && hi - lo > 8; i++) {
    const mid = Math.round((lo + hi) / 2);
    if (fits(mid)) hi = mid;
    else lo = mid;
  }
  return { width: hi, complete: true };
}

/**
 * The width a drawing is made at: the column's own, or the room its bays want when that is a good deal more (it then scrolls sideways), or
 * - with "Show every word" on - the width that puts every word on it. `room` is the width before that switch.
 */
export function figureWidth(drawing: StiffnessDrawing, o: Looks, column: number, every: boolean): { drawn: number; room: number; widened: boolean } {
  const room = roomFor(drawing, o.deformed, column);
  const drawn = every ? Math.max(room, everyWidth(drawing, o, room).width) : room;
  return { drawn, room, widened: drawn > room };
}

/**
 * How many words the drawing, as drawn at the column's width, leaves off, and whether widening it would put them all on (`every`: only
 * then is the switch offered). The second answer costs a search over widths: `wantEvery` false skips it, and the page asks for it after a
 * pause and not inside a keystroke.
 */
export function drawingFacts(drawing: StiffnessDrawing, o: Looks, avail: number, wantEvery = true): { omitted: number; every: boolean } {
  const room = roomFor(drawing, o.deformed, avail);
  const omitted = layoutFor(drawing, { ...o, width: room }).thinned;
  return { omitted, every: wantEvery && omitted > 0 && everyWidth(drawing, o, room).complete };
}

export type { DrawingMember };
