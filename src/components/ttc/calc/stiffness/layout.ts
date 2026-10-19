import { formatNumber } from '@/lib/calc/format';
import type { DrawingMember, StiffnessDrawing, SupportSymbol } from '@/lib/calc/stiffness/analysis';
import { drawFloor, FACTOR_CAP, loadSums, PRINT_FLOOR, signed, type NodeSum } from './text';

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
 * with its head on the node when it points at it, and with its tail on the node when it points away; it starts beyond the box of the node's
 * own support, on whichever side it stands, and never runs through it. Lengths are NOT to scale (two sizes only hint at which is the
 * larger); the number beside it is the size. A moment is a RING round the node, wide enough to clear the support's box, opening towards the
 * arrows of its node (they pass through the opening and cross no ring; the opening is widened where an arrow's head would touch the ring's
 * end) and carrying its number on the side most open; a node with a ring for a load and one for a reaction opens the outer one on the open
 * side, so that the number of the inner one stands in its opening. A force or a moment that is only rounding (under the print floor, or a
 * trillionth of the largest of its kind) is not drawn: no arrow carries a 0.
 *
 * THE WORDS ARE KEPT CLEAR AND TIED TO THEIR MARK. Every number written on the drawing - a load, a reaction, the number of a member, the
 * DOF numbers of a node - is put where it touches no line, no node, no support, no arrow and no other word. A load's or reaction's number
 * sits within `TIE` pixels of the INK of its own mark (the arrow; the arc of a ring, not the circle it is part of), with no other mark
 * nearer, at any of several places along it; the smaller text (10, 9, 8 px) is tried before it is moved further, and a number that can
 * only go further is joined to its mark by a hairline (`leader`) that starts on the mark's ink and crosses no mark, no word and no badge
 * (where there is no way across nothing, across a member or the deformed shape - the lines of the structure itself - and never across
 * more); none of that fitting, it is left off and counted.
 *
 * NOTHING LEAVES THE BOX. A drawing whose marks run beyond its box (a support above its node with its reaction and the number beside it, on
 * a phone) is made again with a margin that holds them, on that side only. The words that are the visitor's to ask for (member numbers, DOF numbers) are tried at 11 px and then smaller (one
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
/** How far, at most, a load's or a reaction's number sits from the ink of its own mark (px) before it is moved by a leader. */
export const TIE = 12;
/** The least a support symbol is drawn at beside its full size: where supports stand closer than that allows, they overlap (and the figure says so). */
const MIN_SYMBOL = 0.4;
/** How much of a hairline, from the mark it starts on, is not judged (px): it starts beside its own mark. */
export const HAIRLINE_FREE = 3;
/** Half the opening of a moment's ring (degrees): the ring is the rest of the circle. */
const RING_HALF = 45;
/** The most a ring's opening is widened to (half of it, degrees) to let the arrows of its node through. */
const RING_HALF_MAX = 75;

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
  /** The points the ring is drawn through, from its start to the head. */
  pts: Point[];
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
  /** The exaggeration the deformed shape is drawn at (never more than FACTOR_CAP); null when there is none (or it is off, or its movement is too small to draw). */
  factor: number | null;
  /** The analysis asked for more magnification than the cap allows: the shape is drawn at the cap. */
  capped: boolean;
  /** The deformed shape was asked for, and the biggest movement is under the print floor: nothing is drawn of it. */
  tiny: boolean;
  legend: LegendKey[];
  /** The nodes (labels) where several loads are drawn as their sum. */
  summed: number[];
  /** The nodes (labels) whose loads cancel one another: nothing is drawn there. */
  cancelled: number[];
  /** The nodes (labels) drawn as dots, though numbers were asked for, because they stand too close for a number. */
  dots: number[];
  /** Two support symbols overlap, though drawn as small as they go: supports stand closer than a symbol can be drawn. */
  supportsOverlap: boolean;
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
/** How far along the direction `u`, from a point p of a rectangle, the ray leaves it (0 when p is not in it). */
function exitDist(r: Rect, p: Point, u: Point): number {
  let t = Infinity;
  if (u.x > 1e-9) t = Math.min(t, (r.x1 - p.x) / u.x);
  else if (u.x < -1e-9) t = Math.min(t, (r.x0 - p.x) / u.x);
  if (u.y > 1e-9) t = Math.min(t, (r.y1 - p.y) / u.y);
  else if (u.y < -1e-9) t = Math.min(t, (r.y0 - p.y) / u.y);
  return Number.isFinite(t) ? Math.max(0, t) : 0;
}

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
const GAPS_LEADER = [14, 18, 24, 32, 42];
const GAPS_OPTIONAL = [2, 5, 9, 15, 23, 33];
const GAPS_BADGE = [3, 7, 12, 19, 28, 40];
/** The same round a ring: how far outside its line a number stands, tied (within TIE) and then with a hairline. */
const GAPS_RING = [2, 3.5, 5, 7, 9, 12];
const GAPS_RING_LEADER = [14, 18, 24, 32, 42];
/** The angles (from the side a ring's number prefers) a number is tried at round the ring. */
const RING_TURNS = [0, 20, -20, 40, -40, 60, -60, 80, -80, 100, -100, 120, -120, 140, -140, 160, -160, 180];
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

/**
 * The lines and boxes a word must stay clear of, in a grid, so that a word is tested against what is near it and not against the whole
 * drawing. Things may be added at any time (a hairline, once its word is placed, is a line the next words keep clear of): each is indexed
 * as it is added.
 */
class Obstacles {
  readonly segs: Seg[] = [];
  readonly boxes: Rect[] = [];
  private items: { s: Seg | null; r: Rect | null }[] = [];
  private cells = new Map<number, number[]>();
  private stamp: Int32Array = new Int32Array(256);
  private round = 0;
  addSeg(s: Seg) {
    this.segs.push(s);
    this.index({ s, r: null }, Math.min(s.x1, s.x2) - s.pad, Math.min(s.y1, s.y2) - s.pad, Math.max(s.x1, s.x2) + s.pad, Math.max(s.y1, s.y2) + s.pad);
  }
  addBox(r: Rect) {
    this.boxes.push(r);
    this.index({ s: null, r }, r.x0, r.y0, r.x1, r.y1);
  }
  /** A hairline: a line the words after it keep clear of, and that is not one of `segs` (the lines a word is held to; its own word ends on it). */
  addHairline(s: Seg) {
    this.index({ s, r: null }, Math.min(s.x1, s.x2) - s.pad, Math.min(s.y1, s.y2) - s.pad, Math.max(s.x1, s.x2) + s.pad, Math.max(s.y1, s.y2) + s.pad);
  }
  /** Kept for the callers that index everything at once: each item is indexed as it is added, so there is nothing left to do. */
  build() {
    /* indexed as added */
  }
  private index(item: { s: Seg | null; r: Rect | null }, ax0: number, ay0: number, ax1: number, ay1: number) {
    // Whatever an item's coordinates, the cells it is put in are those of the page's reach: an item outside it is put at the edge, and a
    // list can never be longer than the drawing is large.
    const reach = (v: number) => Math.max(-REACH, Math.min(REACH, Number.isFinite(v) ? v : 0));
    const id = this.items.length;
    this.items.push(item);
    if (id >= this.stamp.length) {
      const grown = new Int32Array(this.stamp.length * 2);
      grown.set(this.stamp);
      this.stamp = grown;
    }
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
  }
  /** How many of them the rectangle touches, counting up to `ceiling`. */
  touches(rect: Rect, ceiling: number): number {
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
          const it = this.items[id];
          const near = it.s ? segNear(it.s, rect, FROM_LINE) : rectsNear(rect, it.r!, FROM_BOX);
          if (near && ++hits >= ceiling) return hits;
        }
      }
    }
    return hits;
  }
  /**
   * Whether a hairline passes within `clear` of a line or a box that is not one of `own` (what its own mark is made of). A line that is
   * nearer to it than its own width and `clear` is crossed by it.
   */
  crosses(h: Seg, clear: number, own: ReadonlySet<object>): boolean {
    this.round++;
    const lim = clear + 4;
    if (!(Math.abs(h.x1) <= REACH && Math.abs(h.x2) <= REACH && Math.abs(h.y1) <= REACH && Math.abs(h.y2) <= REACH)) return true;
    for (let cx = Math.floor((Math.min(h.x1, h.x2) - lim) / CELL); cx <= Math.floor((Math.max(h.x1, h.x2) + lim) / CELL); cx++) {
      for (let cy = Math.floor((Math.min(h.y1, h.y2) - lim) / CELL); cy <= Math.floor((Math.max(h.y1, h.y2) + lim) / CELL); cy++) {
        const list = this.cells.get(cellKey(cx, cy));
        if (!list) continue;
        for (const id of list) {
          if (this.stamp[id] === this.round) continue;
          this.stamp[id] = this.round;
          const it = this.items[id];
          const item = it.s ?? it.r!;
          if (own.has(item)) continue;
          if (it.s ? distSegSeg(h, it.s) < it.s.pad + clear : segNear(h, it.r!, clear)) return true;
        }
      }
    }
    return false;
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
  /** Whether a hairline passes within `clear` of a word. */
  crosses(h: Seg, clear: number): boolean {
    this.round++;
    const lim = clear + h.pad + 1;
    for (let cx = Math.floor((Math.min(h.x1, h.x2) - lim) / CELL); cx <= Math.floor((Math.max(h.x1, h.x2) + lim) / CELL); cx++) {
      for (let cy = Math.floor((Math.min(h.y1, h.y2) - lim) / CELL); cy <= Math.floor((Math.max(h.y1, h.y2) + lim) / CELL); cy++) {
        const list = this.cells.get(cellKey(cx, cy));
        if (!list) continue;
        for (const e of list) {
          if (e.stamp === this.round) continue;
          e.stamp = this.round;
          if (segNear(h, e.r, clear)) return true;
        }
      }
    }
    return false;
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
/**
 * The deformed shape as the drawing draws it: the analysis's, brought down to the cap (FACTOR_CAP) when its factor asks for more magnification, and
 * null when the biggest movement is under the print floor (rounding left by loads that cancel: nothing is drawn of it). The analysis draws every
 * point at `factor` times its movement from the member's straight line; the shape at another factor is the same movement at that.
 */
export function deformedShown(d: StiffnessDrawing): { factor: number; capped: boolean; nodes: { node: number; x: number; y: number }[]; members: { member: number; points: Point[] }[] } | null {
  const df = d.deformed;
  if (!df || df.factor === null || !(df.factor > 0) || !(df.maxDisplacement >= PRINT_FLOOR)) return null;
  const shownFactor = Math.min(df.factor, FACTOR_CAP);
  if (shownFactor === df.factor) return { factor: df.factor, capped: false, nodes: df.nodes, members: df.members };
  const k = shownFactor / df.factor;
  const home = new Map(d.nodes.map((n) => [n.label, n]));
  const nodes = df.nodes.map((n) => {
    const b = home.get(n.node);
    return b ? { node: n.node, x: b.x + (n.x - b.x) * k, y: b.y + (n.y - b.y) * k } : n;
  });
  const lines = new Map(d.members.map((m) => [m.label, m]));
  const members = df.members.map((dm) => {
    const m = lines.get(dm.member);
    if (!m) return dm;
    const last = Math.max(1, dm.points.length - 1);
    return { member: dm.member, points: dm.points.map((q, i) => ({ x: m.x1 + ((m.x2 - m.x1) * i) / last + (q.x - (m.x1 + ((m.x2 - m.x1) * i) / last)) * k, y: m.y1 + ((m.y2 - m.y1) * i) / last + (q.y - (m.y1 + ((m.y2 - m.y1) * i) / last)) * k })) };
  });
  return { factor: shownFactor, capped: true, nodes, members };
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
  const shown = deformed ? deformedShown(d) : null;
  if (shown) {
    for (const m of shown.members) for (const p of m.points) grow(p);
    for (const n of shown.nodes) grow(n);
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
    capped: false,
    tiny: false,
    legend: [],
    summed: [],
    cancelled: [],
    dots: [],
    supportsOverlap: false,
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

/** The room kept round the structure on each side (px): it grows on a side where a mark would leave the box. */
interface Margins {
  l: number;
  r: number;
  t: number;
  b: number;
}

/** The least width the structure itself is left, whatever the marks round it ask for. */
const LEAST_STRUCTURE_PX = 80;

/**
 * The rectangle that holds every mark of a layout: members, nodes, symbols, badges, arrows with their heads, rings, loads on members, the deformed
 * shape, every word and every hairline.
 */
function inkBounds(l: Layout): Rect {
  const b: Rect = { x0: Infinity, y0: Infinity, x1: -Infinity, y1: -Infinity };
  const at = (x: number, y: number) => {
    b.x0 = Math.min(b.x0, x);
    b.y0 = Math.min(b.y0, y);
    b.x1 = Math.max(b.x1, x);
    b.y1 = Math.max(b.y1, y);
  };
  const rect = (r: Rect) => {
    at(r.x0, r.y0);
    at(r.x1, r.y1);
  };
  const arrow = (a: { tail: Point; tip: Point }) => {
    at(a.tail.x, a.tail.y);
    at(a.tip.x, a.tip.y);
    const u = unit(a.tip.x - a.tail.x, a.tip.y - a.tail.y);
    const bx = a.tip.x - u.x * HEAD_LEN;
    const by = a.tip.y - u.y * HEAD_LEN;
    at(bx - u.y * HEAD_HALF, by + u.x * HEAD_HALF);
    at(bx + u.y * HEAD_HALF, by - u.x * HEAD_HALF);
  };
  const word = (t: LabelBox | null) => {
    if (!t) return;
    rect(t.rect);
    if (t.leader) {
      at(t.leader.x1, t.leader.y1);
      at(t.leader.x2, t.leader.y2);
    }
  };
  for (const m of l.members) {
    at(m.x1, m.y1);
    at(m.x2, m.y2);
    if (m.tag) rect(m.tag.rect);
  }
  for (const n of l.nodes) {
    const r = n.r + (n.flagged ? 4 : 0);
    at(n.x - r, n.y - r);
    at(n.x + r, n.y + r);
    if (n.dofTag) rect(n.dofTag.box.rect);
  }
  for (const s of l.supports) {
    rect(s.box);
    if (s.badge) {
      at(s.badge.x - s.badge.r, s.badge.y - s.badge.r);
      at(s.badge.x + s.badge.r, s.badge.y + s.badge.r);
      if (s.badge.leader) {
        at(s.badge.leader.x1, s.badge.leader.y1);
        at(s.badge.leader.x2, s.badge.leader.y2);
      }
    }
  }
  for (const x of [...l.loads, ...l.reactions]) {
    for (const a of x.arrows) {
      arrow(a);
      word(a.text);
    }
    if (x.arc) {
      for (const p of x.arc.pts) at(p.x, p.y);
      for (const q of x.arc.head.split(' ')) {
        const [px, py] = q.split(',').map(Number);
        if (Number.isFinite(px) && Number.isFinite(py)) at(px, py);
      }
      word(x.arc.text);
    }
  }
  for (const x of l.memberLoads) {
    for (const a of x.arrows) arrow(a);
    for (const p of x.line ?? []) at(p.x, p.y);
    word(x.text);
  }
  if (l.deformed) {
    for (const d of l.deformed.members) {
      for (const q of d.points.split(' ')) {
        const [px, py] = q.split(',').map(Number);
        if (Number.isFinite(px) && Number.isFinite(py)) at(px, py);
      }
    }
  }
  return b;
}

/** How far the marks of a layout run beyond its box on each side (px), or null when none does. */
function overshoot(l: Layout): Margins | null {
  const b = inkBounds(l);
  if (!Number.isFinite(b.x0 + b.y0 + b.x1 + b.y1)) return null;
  const over: Margins = { l: Math.max(0, -b.x0), r: Math.max(0, b.x1 - l.width), t: Math.max(0, -b.y0), b: Math.max(0, b.y1 - l.height) };
  return over.l > 0.01 || over.r > 0.01 || over.t > 0.01 || over.b > 0.01 ? over : null;
}

/**
 * THE LAYOUT OF A DRAWING. Whatever room the marks round the structure ask for, they get: a support above its node (a hung structure) with its
 * reaction and the number beside it is taller than the margin a narrow drawing starts with, so a layout that has a mark outside its box is made
 * again with a margin that holds it, on that side only (up to three times, and never leaving the structure itself less than 80 px).
 */
export function stiffnessLayout(drawing: StiffnessDrawing, o: LayoutOptions): Layout {
  const W = o.width;
  // TOTAL: whatever numbers the drawing is made of, this returns, and fast. A width that is not a width, or an extent that is not a finite
  // size, is not drawn (the page says so); everything else is scaled to the page, so every pixel below is within it.
  if (!(W > 0) || !Number.isFinite(W)) return brokenLayout(300);
  const base = marginFor(W);
  let m: Margins = { l: base, r: base, t: base, b: base };
  let out = layoutOnce(drawing, o, m);
  const room = Math.max(base, (W - LEAST_STRUCTURE_PX) / 2);
  for (let pass = 0; pass < 3 && !out.broken; pass++) {
    const over = overshoot(out);
    if (!over) break;
    const grow = (have: number, by: number) => (by > 0.01 ? Math.min(room, have + by + 2) : have);
    const next: Margins = { l: grow(m.l, over.l), r: grow(m.r, over.r), t: grow(m.t, over.t), b: grow(m.b, over.b) };
    if (next.l === m.l && next.r === m.r && next.t === m.t && next.b === m.b) break;
    m = next;
    out = layoutOnce(drawing, o, m);
  }
  return out;
}

function layoutOnce(drawing: StiffnessDrawing, o: LayoutOptions, M: Margins): Layout {
  const W = o.width;
  const maxHeight = o.maxHeight ?? MAX_HEIGHT;
  const shown = o.deformed ? deformedShown(drawing) : null;
  const e = extentOf(drawing, o.deformed);
  const ew = e.x1 - e.x0;
  const eh = e.y1 - e.y0;
  if (![e.x0, e.y0, e.x1, e.y1, ew, eh].every(Number.isFinite)) return brokenLayout(W);
  const aw = W - M.l - M.r;
  const sx = ew > 0 ? aw / ew : Infinity;
  const sy = eh > 0 ? (maxHeight - M.t - M.b) / eh : Infinity;
  const scale = ew > 0 || eh > 0 ? Math.min(sx, sy) : 1;
  if (!(scale > 0) || !Number.isFinite(scale)) return brokenLayout(W);
  const drawnW = ew * scale;
  const offX = M.l + (aw - drawnW) / 2;
  const H = clean(Math.max(eh * scale + M.t + M.b, M.t + M.b));
  const X = (x: number) => offX + (x - e.x0) * scale;
  const Y = (y: number) => M.t + (e.y1 - y) * scale;
  const P = (p: Point): Point => ({ x: X(p.x), y: Y(p.y) });
  const inside = (rect: Rect) => rect.x0 >= 3 && rect.x1 <= W - 3 && rect.y0 >= 3 && rect.y1 <= H - 3;
  const flagged = new Set(o.flagged ?? []);
  const obstacles = new Obstacles();

  /* Members and nodes. */
  const nodePos = new Map<number, Point>();
  for (const n of drawing.nodes) nodePos.set(n.label, { x: X(n.x), y: Y(n.y) });
  const members: MemberShape[] = drawing.members.map((m) => ({ label: m.label, i: m.i, j: m.j, x1: clean(X(m.x1)), y1: clean(Y(m.y1)), x2: clean(X(m.x2)), y2: clean(Y(m.y2)), tag: null }));
  /** The lines of the structure itself (the members, the deformed shape): a hairline may cross these, where it has no way that crosses none. */
  const structure = new Set<object>();
  for (const m of members) {
    const sg: Seg = { x1: m.x1, y1: m.y1, x2: m.x2, y2: m.y2, pad: MEMBER_W / 2 };
    obstacles.addSeg(sg);
    structure.add(sg);
  }
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
  const dots: number[] = [];
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
      dots.push(n.label);
    }
  }
  const dotted = dots.length;
  const radius = new Map(nodes.map((n) => [n.label, n.r]));
  const radiusOf = (node: number): number => radius.get(node) ?? NODE_R;
  const nodeBoxes = new Map<number, Rect>();
  for (const n of nodes) {
    const rr = n.r + (n.flagged ? 4 : 0) + 0.75;
    const box = boxOf(n.x, n.y, rr, rr);
    nodeBoxes.set(n.label, box);
    obstacles.addBox(box);
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
  // The symbols are drawn smaller (to 0.4 of their size) where two supports stand nearer than a symbol is wide: the feet of a tall mast, a close pair.
  const symbolScale = (() => {
    const at = drawing.supports.flatMap((s) => {
      const p = nodePos.get(s.node);
      return p && KIND_OF[s.symbol] ? [p] : [];
    });
    let k = 1;
    for (let a = 0; a < at.length; a++) {
      for (let b = a + 1; b < at.length; b++) {
        const dx = Math.abs(at[a].x - at[b].x);
        if (dx > 1e-6 && dx < 34 && Math.abs(at[a].y - at[b].y) < 32) k = Math.min(k, Math.max(MIN_SYMBOL, dx / 34));
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
  /** How far a node's own symbol reaches from the node (its box's farthest corner): a ring round the node keeps beyond it. */
  const reachOf = (node: number): number => {
    const s = supportAt.get(node);
    const p = nodePos.get(node);
    if (!s || !p) return 0;
    return Math.max(Math.hypot(s.box.x0 - p.x, s.box.y0 - p.y), Math.hypot(s.box.x1 - p.x, s.box.y0 - p.y), Math.hypot(s.box.x0 - p.x, s.box.y1 - p.y), Math.hypot(s.box.x1 - p.x, s.box.y1 - p.y));
  };
  /** How far from a node, along the direction `u`, its own symbol's box ends: an arrow along `u` starts beyond it. */
  const clearOf = (node: number, u: Point, least: number): number => {
    const s = supportAt.get(node);
    const p = nodePos.get(node);
    if (!s || !p) return least;
    return Math.max(least, exitDist(s.box, p, u) + 2);
  };
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
  /** The force arrows of each node as the direction they leave the node by (page, unit vectors): a ring opens towards them. */
  const arms = new Map<number, Point[]>();
  const keepArm = (node: number, tail: Point, tip: Point) => {
    const p = nodePos.get(node);
    if (!p) return;
    const far = Math.hypot(tail.x - p.x, tail.y - p.y) >= Math.hypot(tip.x - p.x, tip.y - p.y) ? tail : tip;
    const mid = { x: (tail.x + tip.x) / 2, y: (tail.y + tip.y) / 2 };
    const u = unit((far.x + mid.x) / 2 - p.x, (far.y + mid.y) / 2 - p.y);
    if (u.x !== 0 || u.y !== 0) arms.set(node, [...(arms.get(node) ?? []), u]);
  };
  /** What an arrow is made of in the index of obstacles: its line and its head. */
  const arrowObstacle = (tail: Point, tip: Point, node = 0): object[] => {
    const s: Seg = { x1: tail.x, y1: tail.y, x2: tip.x, y2: tip.y, pad: 1.5 };
    obstacles.addSeg(s);
    if (node > 0) {
      keepArrow(node, s);
      keepArm(node, tail, tip);
    }
    const head = headBox(tail, tip);
    obstacles.addBox(head);
    return [s, head];
  };
  /** The members as lines on the page, for an arrow to keep clear of. */
  const memberSegs: Seg[] = members.map((m) => ({ x1: m.x1, y1: m.y1, x2: m.x2, y2: m.y2, pad: 0 }));
  /**
   * What is wrong with an arrow standing here at a node: it runs through a support symbol (100: the node's own too), a node (40), a member
   * (40: nearer than a node's own circle and a hair) or another arrow of the node (30). 0 is a clear place. `own`: the node's own symbol is
   * given no more than a hair (a reaction is built against it, a few pixels from it).
   */
  const penalty = (node: number, tail: Point, tip: Point, own: boolean): number => {
    const seg: Seg = { x1: tail.x, y1: tail.y, x2: tip.x, y2: tip.y, pad: 0 };
    const near = Math.min(5.5, radiusOf(node) + 1.2);
    let pen = 0;
    for (const sp of supports) if (segNear(seg, sp.box, sp.node === node ? (own ? 0.5 : 2) : 3)) pen += 100;
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

  /**
   * The ring of a moment, as a path, the points it is drawn through and the lines it is made of. `gap`: the page angle (math, degrees) the opening
   * is centred on; `half`: half the opening (degrees).
   */
  const arcShape = (c: Point, r: number, gap: number, ccw: boolean, half = RING_HALF): { path: string; head: string; segs: Seg[]; pts: Point[]; mid: Point } => {
    const rad = (deg: number) => (deg * Math.PI) / 180;
    const at = (deg: number): Point => ({ x: c.x + r * Math.cos(rad(deg)), y: c.y - r * Math.sin(rad(deg)) });
    const start = ccw ? gap + half : gap - half;
    const end = ccw ? gap + (360 - half) : gap - (360 - half);
    const a = at(start);
    const b = at(end);
    const path = `M ${clean(a.x)} ${clean(a.y)} A ${clean(r)} ${clean(r)} 0 1 ${ccw ? 0 : 1} ${clean(b.x)} ${clean(b.y)}`;
    // The head: the arc's direction of travel at its end.
    const th = rad(end);
    const t = ccw ? { x: -Math.sin(th), y: -Math.cos(th) } : { x: Math.sin(th), y: Math.cos(th) };
    const base = { x: b.x - t.x * HEAD_LEN, y: b.y - t.y * HEAD_LEN };
    const head = poly([b, { x: base.x - t.y * HEAD_HALF, y: base.y + t.x * HEAD_HALF }, { x: base.x + t.y * HEAD_HALF, y: base.y - t.x * HEAD_HALF }]);
    const segs: Seg[] = [];
    const pts: Point[] = [a];
    let prev = a;
    const steps = 24;
    for (let k = 1; k <= steps; k++) {
      const q = at(start + ((end - start) * k) / steps);
      segs.push({ x1: prev.x, y1: prev.y, x2: q.x, y2: q.y, pad: 1.5 });
      pts.push(pt(q));
      prev = q;
    }
    return { path, head, segs, pts, mid: at(gap) };
  };
  /** The angle between two directions (degrees, 0 to 180). */
  const angleBetween = (aDeg: number, bDeg: number): number => {
    const d = Math.abs((((aDeg - bDeg) % 360) + 540) % 360 - 180);
    return d;
  };
  const degOf = (u: Point): number => (Math.atan2(-u.y, u.x) * 180) / Math.PI;
  const vecOf = (deg: number): Point => ({ x: Math.cos((deg * Math.PI) / 180), y: -Math.sin((deg * Math.PI) / 180) });
  /** The page angles a ring's opening, and its number, are tried at: the diagonals first, then the axes, then the rest. */
  const OPENINGS = [45, 135, 225, 315, 90, 270, 0, 180, 22.5, 67.5, 112.5, 157.5, 202.5, 247.5, 292.5, 337.5];
  /**
   * The page angle a ring's opening is centred on. It faces the force arrows of its node, so that they pass through the opening and cross no
   * ring; where there is none, the members (a beam's end: the beam passes through the opening); where there is none, the upper right.
   */
  const ringOpening = (node: number): number => {
    const ar = arms.get(node) ?? [];
    const mem = around(node);
    if (ar.length === 0 && mem.length === 0) return 45;
    let best = OPENINGS[0];
    let bestScore = -Infinity;
    for (const deg of OPENINGS) {
      const score = (list: Point[], weight: number) => list.reduce((acc, u) => acc + weight * Math.max(0, 1 - angleBetween(deg, degOf(u)) / (RING_HALF + 5)), 0);
      const total = score(ar, 3) + score(mem, 0.5);
      if (total > bestScore + 1e-9) {
        bestScore = total;
        best = deg;
      }
    }
    return best;
  };
  /**
   * How wide a ring's opening is at `gap` (half of it, degrees): the 90 degrees it has, and more where the arrows of its node that cross the ring
   * (or come within a few pixels of it, their heads) stand near its edge: the ring must not touch them.
   */
  const ringHalf = (node: number, gap: number, R: number): number => {
    const p = nodePos.get(node);
    if (!p) return RING_HALF;
    let spread = 0;
    for (const sg of arrowSegs.get(node) ?? []) {
      for (let k = 0; k <= 24; k++) {
        const q = { x: sg.x1 + ((sg.x2 - sg.x1) * k) / 24, y: sg.y1 + ((sg.y2 - sg.y1) * k) / 24 };
        const d = Math.hypot(q.x - p.x, q.y - p.y);
        if (Math.abs(d - R) <= 7) {
          const angle = angleBetween(gap, degOf(unit(q.x - p.x, q.y - p.y)));
          if (angle <= 100) spread = Math.max(spread, angle);
        }
      }
    }
    return spread === 0 ? RING_HALF : Math.min(RING_HALF_MAX, Math.max(RING_HALF, spread + 14));
  };
  /** The page angle on which a ring's number stands: the side of the node most open - farthest from its members and its arrows. */
  const ringSide = (node: number): number => {
    const blockers = [...(arms.get(node) ?? []), ...around(node)].map(degOf);
    if (blockers.length === 0) return OPENINGS[0];
    let best = OPENINGS[0];
    let bestFar = -1;
    for (const deg of OPENINGS) {
      const far = Math.min(...blockers.map((b) => angleBetween(deg, b)));
      if (far > bestFar + 1e-9) {
        bestFar = far;
        best = deg;
      }
    }
    return best;
  };

  /** The lines of a load or a reaction (an arrow, a ring, the arrows of a load on a member): what a number beside it is the size of. */
  type Mark = { segs: Seg[]; owned: Set<object>; box: Rect };
  const markDistance = (rect: Rect, m: Mark): number => Math.min(...m.segs.map((q) => distRectSeg(rect, q)));
  const marks: Mark[] = [];
  /** A number that goes with a mark: where it hugs (the end of its arrow), the way it prefers to stand, and - for a ring - the ring it stands round. */
  type Pending = { text: string; anchor: Point; prefer: Point; mark: Mark; ring: { c: Point; R: number; side: number } | null; set: (box: LabelBox) => void };
  const mandatory: Pending[] = [];
  /** A mark: its ink as lines (width 0), and what it is made of in the index of obstacles (a hairline from its number starts on it, and is not across it). */
  const markOf = (segs: Seg[], owned: readonly object[]): Mark => {
    const xs = segs.flatMap((q) => [q.x1, q.x2]);
    const ys = segs.flatMap((q) => [q.y1, q.y2]);
    const m: Mark = { segs, owned: new Set(owned), box: { x0: Math.min(...xs), y0: Math.min(...ys), x1: Math.max(...xs), y1: Math.max(...ys) } };
    marks.push(m);
    return m;
  };
  const lineOf = (tail: Point, tip: Point): Seg => ({ x1: tail.x, y1: tail.y, x2: tip.x, y2: tip.y, pad: 0 });
  const inkOf = (segs: readonly Seg[]): Seg[] => segs.map((q) => ({ x1: q.x1, y1: q.y1, x2: q.x2, y2: q.y2, pad: 0 }));

  /* Nodal loads: the loads at one node are drawn as their sum, a component along each axis, as a reaction is drawn. */
  const loadsAt: NodeSum[] = loadSums(drawing.loads);
  const summed = loadsAt.filter((s) => s.count > 1).map((s) => s.node);
  const cancelled = loadsAt.filter((s) => s.cancelled).map((s) => s.node);
  const maxLoad = Math.max(0, ...loadsAt.flatMap((l) => [Math.abs(l.fx), Math.abs(l.fy)]));
  const maxMoment = Math.max(0, ...loadsAt.map((l) => Math.abs(l.m)));
  /**
   * A force's arrow at a node: it stands on the side the force comes from (head on the node) unless a member, another arrow or the symbol
   * of the support is there; then on the side it goes to (tail on the node); then beside the node. Of these, the first that is clear. It starts
   * beyond the symbol of the node's own support, on whichever side it stands.
   */
  const forceArrow = (node: number, p: Point, r: number, dir: Point, len: number): { tail: Point; tip: Point; far: Point; toward: Point } => {
    const back = { x: -dir.x, y: -dir.y };
    const inAt = clearOf(node, back, r + 2);
    const outAt = clearOf(node, dir, r + 2);
    const inFrom = { x: p.x + back.x * inAt, y: p.y + back.y * inAt };
    const outFrom = { x: p.x + dir.x * outAt, y: p.y + dir.y * outAt };
    const inArrow = { tail: { x: inFrom.x - dir.x * len, y: inFrom.y - dir.y * len }, tip: inFrom };
    const outArrow = { tail: outFrom, tip: { x: outFrom.x + dir.x * len, y: outFrom.y + dir.y * len } };
    const lat = { x: -dir.y, y: dir.x };
    const beside = [lat, { x: -lat.x, y: -lat.y }].map((side) => {
      const off = clearOf(node, side, r + 9);
      const from = { x: p.x + side.x * off, y: p.y + side.y * off };
      return { tail: { x: from.x - dir.x * len, y: from.y - dir.y * len }, tip: from };
    });
    const offered = [...shifted(inArrow.tail, inArrow.tip, false).slice(0, 1), ...shifted(outArrow.tail, outArrow.tip, true).slice(0, 1), ...shifted(inArrow.tail, inArrow.tip, false).slice(1, 3), ...shifted(outArrow.tail, outArrow.tip, true).slice(1, 3), ...beside.map((b) => ({ ...b, out: false }))];
    const f = pickArrow(node, offered, false);
    return { tail: f.tail, tip: f.tip, far: f.out ? f.tip : f.tail, toward: f.out ? dir : back };
  };
  const loads: Layout['loads'] = [];
  /** The lines of the rings round each node: a settlement's hairline may pass through them (it ends at the node they are round). */
  const ringsAt = new Map<number, object[]>();
  /** The rings to draw - a load's, then a reaction's, at each node - once every arrow is drawn: they open towards the arrows of their node, and a node with two of them has them open differently. */
  const rings: { node: number; kind: 'load' | 'reaction'; m: number; entry: { arc: ArcShape | null } }[] = [];
  if (o.loads) {
    for (const l of loadsAt) {
      const p = nodePos.get(l.node);
      if (!p) continue;
      const r = radiusOf(l.node);
      const arrows: ArrowShape[] = [];
      for (const [cx, cy, size] of [[Math.sign(l.fx), 0, Math.abs(l.fx)], [0, Math.sign(l.fy), Math.abs(l.fy)]] as const) {
        if (!(size >= drawFloor(maxLoad))) continue;
        const len = 18 + 18 * (maxLoad > 0 ? size / maxLoad : 0);
        const f = forceArrow(l.node, p, r, { x: cx, y: -cy }, len);
        const arrow: ArrowShape = { tail: f.tail, tip: f.tip, text: null };
        arrows.push(arrow);
        const owned = arrowObstacle(f.tail, f.tip, l.node);
        const mark = markOf([lineOf(f.tail, f.tip)], owned);
        if (o.values) mandatory.push({ text: plain(size, o.group), anchor: f.far, prefer: f.toward, mark, ring: null, set: (b) => (arrow.text = b) });
      }
      const entry: Layout['loads'][number] = { label: l.node, node: l.node, count: l.count, arrows, arc: null };
      if (Math.abs(l.m) >= drawFloor(maxMoment) && l.m !== 0) rings.push({ node: l.node, kind: 'load', m: l.m, entry });
      loads.push(entry);
    }
  }

  /* Reactions: a component along each axis beside the symbol; a ring for a moment. */
  const reactions: Layout['reactions'] = [];
  if (o.reactions) {
    const topComp = Math.max(0, ...drawing.reactions.flatMap((r) => [Math.abs(r.rx), Math.abs(r.ry)]));
    const topMoment = Math.max(0, ...drawing.reactions.map((r) => Math.abs(r.rm)));
    for (const r of drawing.reactions) {
      const p = nodePos.get(r.node);
      if (!p) continue;
      const sup = supportAt.get(r.node);
      const sd = sup?.side ?? { x: 0, y: 1 };
      const depth = sup?.depth ?? 8;
      const arrows: ArrowShape[] = [];
      const one = (fx: number, fy: number, magnitude: number) => {
        if (!(magnitude >= drawFloor(topComp))) return;
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
          // Across the symbol's axis: beside it, on the side the force points away from, pointing at the node. (Beside it is beyond the box of the
          // symbol along the arrow's own line: the box is wider than deep on a symbol that stands to one side.)
          const lat = { x: -dir.x, y: -dir.y };
          const box = sup?.box ?? { x0: p.x - 8, y0: p.y, x1: p.x + 8, y1: p.y + depth };
          const centre = { x: (box.x0 + box.x1) / 2, y: (box.y0 + box.y1) / 2 };
          const half = Math.abs(lat.x) * ((box.x1 - box.x0) / 2) + Math.abs(lat.y) * ((box.y1 - box.y0) / 2);
          tip = { x: centre.x + lat.x * (half + GAP), y: centre.y + lat.y * (half + GAP) };
          tail = { x: tip.x + lat.x * len, y: tip.y + lat.y * len };
          // The same force on the other side of the symbol, leaving it: where the first has no room (a foot at the edge of the drawing) or is taken.
          const from = { x: centre.x + dir.x * (half + GAP), y: centre.y + dir.y * (half + GAP) };
          mirrored = { tail: from, tip: { x: from.x + dir.x * len, y: from.y + dir.y * len } };
        }
        // Clear of a load that stands at the same node, and of the edge of the drawing.
        const n = pickArrow(r.node, [...shifted(tail, tip), ...(mirrored ? shifted(mirrored.tail, mirrored.tip) : [])], true);
        const a: ArrowShape = { tail: n.tail, tip: n.tip, text: null };
        arrows.push(a);
        const owned = arrowObstacle(a.tail, a.tip, r.node);
        // The number hugs the end of the arrow that is away from the node, on its line.
        const farTail = Math.hypot(a.tail.x - p.x, a.tail.y - p.y) >= Math.hypot(a.tip.x - p.x, a.tip.y - p.y);
        const far = farTail ? a.tail : a.tip;
        const near = farTail ? a.tip : a.tail;
        const mark = markOf([lineOf(a.tail, a.tip)], owned);
        if (o.values) mandatory.push({ text: plain(magnitude, o.group), anchor: far, prefer: unit(far.x - near.x, far.y - near.y), mark, ring: null, set: (b) => (a.text = b) });
      };
      one(r.rx, 0, Math.abs(r.rx));
      one(0, r.ry, Math.abs(r.ry));
      const entry: Layout['reactions'][number] = { label: r.node, arrows, arc: null };
      if (r.rm !== 0 && Math.abs(r.rm) >= drawFloor(topMoment)) rings.push({ node: r.node, kind: 'reaction', m: r.rm, entry });
      reactions.push(entry);
    }
  }

  /* The rings of the moments. */
  {
    const both = new Set(rings.filter((j) => j.kind === 'reaction' && rings.some((q) => q.node === j.node && q.kind === 'load')).map((j) => j.node));
    const inner = new Map<number, number>();
    for (const job of rings) {
      const p = nodePos.get(job.node);
      if (!p) continue;
      const rn = radiusOf(job.node);
      const radiusRing = job.kind === 'load' ? Math.max(rn + 10, reachOf(job.node) + 3) : Math.max(rn + 17, (inner.get(job.node) ?? 0) + 7, reachOf(job.node) + 3);
      if (job.kind === 'load') inner.set(job.node, radiusRing);
      // A node with a ring of each: the inner one opens towards the arrows, the outer one on the open side, so that the number of the inner one
      // stands in the opening of the outer, and no hairline has a ring to cross.
      const side = ringSide(job.node);
      const gap = both.has(job.node) && job.kind === 'reaction' ? side : ringOpening(job.node);
      const a = arcShape(p, radiusRing, gap, job.m > 0, both.has(job.node) && job.kind === 'reaction' ? RING_HALF : ringHalf(job.node, gap, radiusRing));
      for (const sg of a.segs) obstacles.addSeg(sg);
      ringsAt.set(job.node, [...(ringsAt.get(job.node) ?? []), ...a.segs]);
      const arc: ArcShape = { cx: clean(p.x), cy: clean(p.y), r: clean(radiusRing), path: a.path, head: a.head, pts: a.pts, text: null };
      job.entry.arc = arc;
      const mark = markOf(inkOf(a.segs), a.segs);
      if (o.values) mandatory.push({ text: plain(job.m, o.group), anchor: a.mid, prefer: vecOf(side), mark, ring: { c: p, R: radiusRing, side }, set: (b) => (arc.text = b) });
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
        const owned: object[] = [];
        for (const ar of shape.arrows) owned.push(...arrowObstacle(ar.tail, ar.tip));
        if (shape.line) {
          for (let k = 1; k < shape.line.length; k++) {
            const s: Seg = { x1: shape.line[k - 1].x, y1: shape.line[k - 1].y, x2: shape.line[k].x, y2: shape.line[k].y, pad: 1 };
            obstacles.addSeg(s);
            owned.push(s);
          }
        }
        const mark = markOf([...shape.arrows.map((q) => lineOf(q.tail, q.tip)), ...(shape.line ?? []).slice(1).map((q, k) => lineOf(shape.line![k], q))], owned);
        if (textAt && o.values) mandatory.push({ text: plain(l.value, o.group), anchor: textAt, prefer: textPrefer, mark, ring: null, set: (b) => (shape.text = b) });
      } else if (l.kind === 'point') {
        const base = at(l.a);
        const len = 20 + 14 * l.share;
        const tip = { x: base.x - push.x * 3, y: base.y - push.y * 3 };
        const tail = { x: tip.x - push.x * len, y: tip.y - push.y * len };
        shape.arrows.push({ tail: pt(tail), tip: pt(tip) });
        const owned = arrowObstacle(tail, tip);
        const mark = markOf([lineOf(tail, tip)], owned);
        if (o.values) mandatory.push({ text: plain(l.value, o.group), anchor: tail, prefer: { x: tail.x - tip.x, y: tail.y - tip.y }, mark, ring: null, set: (b) => (shape.text = b) });
      } else {
        // Along the member: the arrows run beside it.
        const p1 = at(l.a);
        const p2 = at(l.b);
        const segLen = Math.hypot(p2.x - p1.x, p2.y - p1.y);
        const count = Math.max(2, Math.min(8, Math.round(segLen / 36) + 1));
        const off = { x: nrm.x * 10, y: nrm.y * 10 };
        const len = 14 + 6 * l.share;
        let textAt: Point | null = null;
        const owned: object[] = [];
        for (let k = 0; k < count; k++) {
          const u = k / (count - 1);
          const base = { x: p1.x + (p2.x - p1.x) * u + off.x, y: p1.y + (p2.y - p1.y) * u + off.y };
          const tipPoint = { x: base.x + push.x * len * 0.5, y: base.y + push.y * len * 0.5 };
          const tailPoint = { x: base.x - push.x * len * 0.5, y: base.y - push.y * len * 0.5 };
          shape.arrows.push({ tail: pt(tailPoint), tip: pt(tipPoint) });
          owned.push(...arrowObstacle(tailPoint, tipPoint));
          if (k === Math.floor((count - 1) / 2)) textAt = { x: base.x, y: base.y };
        }
        const mark = markOf(shape.arrows.map((q) => lineOf(q.tail, q.tip)), owned);
        if (textAt && o.values) mandatory.push({ text: plain(l.value, o.group), anchor: textAt, prefer: nrm, mark, ring: null, set: (b) => (shape.text = b) });
      }
      memberLoads.push(shape);
    }
  }

  /* The deformed shape, in pixels. */
  let deformed: DeformedShape | null = null;
  let factor: number | null = null;
  let capped = false;
  if (shown) {
    factor = shown.factor;
    capped = shown.capped;
    const shape: DeformedShape = { members: [] };
    for (const dm of shown.members) {
      const line = dm.points.map((q) => pt(P(q)));
      shape.members.push({ member: dm.member, points: poly(line) });
      for (let k = 1; k < line.length; k++) {
        const sg: Seg = { x1: line[k - 1].x, y1: line[k - 1].y, x2: line[k].x, y2: line[k].y, pad: 1 };
        obstacles.addSeg(sg);
        structure.add(sg);
      }
    }
    deformed = shape;
  }
  // The deformed shape was asked for, there is one, and it is too small to draw at any magnification the drawing uses.
  const tiny = o.deformed && drawing.deformed !== null && drawing.deformed.factor !== null && shown === null;

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
  /** The same round a ring: the places a word of w x h stands outside it, from the side `side` (page degrees) round, within `gaps` of its line. */
  const searchRing = (ring: { c: Point; R: number; side: number }, w: number, h: number, gaps: readonly number[], accept?: (rect: Rect) => boolean): { rect: Rect; hits: number } => {
    const spots: { rect: Rect; cost: number }[] = [];
    for (const g of gaps) {
      for (const d of RING_TURNS) {
        const u = vecOf(ring.side + d);
        const ext = Math.abs(u.x) * (w / 2) + Math.abs(u.y) * (h / 2);
        const centre = { x: ring.c.x + u.x * (ring.R + ext + g), y: ring.c.y + u.y * (ring.R + ext + g) };
        spots.push({ rect: { x0: centre.x - w / 2, y0: centre.y - h / 2, x1: centre.x + w / 2, y1: centre.y + h / 2 }, cost: g + Math.abs(d) * 0.1 });
      }
    }
    spots.sort((a, b) => a.cost - b.cost);
    for (const sp of spots) if (touches(sp.rect, 1) === 0 && (!accept || accept(sp.rect))) return { rect: sp.rect, hits: 0 };
    return { rect: spots[0].rect, hits: 1 };
  };
  /** The same all round a point, in 24 directions (every 15 degrees): the places a rectangle of w x h stands off `p`, nearest first, those towards `prefer` before others. */
  const searchAround = (p: Point, prefer: Point, w: number, h: number, gaps: readonly number[], accept?: (rect: Rect) => boolean): { rect: Rect; hits: number } => {
    const want = degOf(prefer);
    const spots: { rect: Rect; cost: number }[] = [];
    for (const g of gaps) {
      for (let k = 0; k < 24; k++) {
        const deg = k * 15;
        const u = vecOf(deg);
        const ext = Math.abs(u.x) * (w / 2) + Math.abs(u.y) * (h / 2);
        const centre = { x: p.x + u.x * (g + ext), y: p.y + u.y * (g + ext) };
        spots.push({ rect: { x0: centre.x - w / 2, y0: centre.y - h / 2, x1: centre.x + w / 2, y1: centre.y + h / 2 }, cost: g + angleBetween(deg, want) * 0.12 });
      }
    }
    spots.sort((a, b) => a.cost - b.cost);
    for (const sp of spots) if (touches(sp.rect, 1) === 0 && (!accept || accept(sp.rect))) return { rect: sp.rect, hits: 0 };
    return { rect: spots[0].rect, hits: 1 };
  };
  /** The hairline from a mark to a word: from the point of the mark nearest the word to the point of the word nearest that. */
  const hairline = (mark: Mark, rect: Rect): Seg => {
    const nearestInk = (q: Point): Point => {
      let best = { x: mark.segs[0].x1, y: mark.segs[0].y1 };
      let bestD = Infinity;
      for (const s of mark.segs) {
        const dx = s.x2 - s.x1;
        const dy = s.y2 - s.y1;
        const l2 = dx * dx + dy * dy;
        const t = l2 === 0 ? 0 : Math.max(0, Math.min(1, ((q.x - s.x1) * dx + (q.y - s.y1) * dy) / l2));
        const c = { x: s.x1 + t * dx, y: s.y1 + t * dy };
        const d = Math.hypot(q.x - c.x, q.y - c.y);
        if (d < bestD) {
          bestD = d;
          best = c;
        }
      }
      return best;
    };
    const onRect = (q: Point): Point => ({ x: Math.min(Math.max(q.x, rect.x0), rect.x1), y: Math.min(Math.max(q.y, rect.y0), rect.y1) });
    const first = nearestInk({ x: (rect.x0 + rect.x1) / 2, y: (rect.y0 + rect.y1) / 2 });
    const start = nearestInk(onRect(first));
    const end = onRect(start);
    return { x1: start.x, y1: start.y, x2: end.x, y2: end.y, pad: 0.75 };
  };
  /**
   * Whether a hairline runs across a line, a box or a word that is not its own. It starts on its own mark, which may stand a hair from a node or a
   * member: it is judged from 3 px out.
   */
  const hairlineCrosses = (h: Seg, own: ReadonlySet<object>): boolean => {
    const len = Math.hypot(h.x2 - h.x1, h.y2 - h.y1);
    const from = len > HAIRLINE_FREE + 1 ? HAIRLINE_FREE / len : 0;
    const test: Seg = { x1: h.x1 + (h.x2 - h.x1) * from, y1: h.y1 + (h.y2 - h.y1) * from, x2: h.x2, y2: h.y2, pad: h.pad };
    return obstacles.crosses(test, 0.75, own) || fixedWords.crosses(test, 0.75) || optionalWords.crosses(test, 0.75);
  };

  // The settlement badges: the first marks placed on the clear paper, each beside its node and clear of every line - and its hairline clear of every
  // mark; the value is in the sentence under the drawing.
  for (const s of supports) {
    if (!settles.has(s.label)) continue;
    const away = around(s.node).reduce((acc, u) => ({ x: acc.x - u.x, y: acc.y - u.y }), { x: 0, y: 0 });
    const from = s.kind === 'rotation' ? away : { x: away.x - s.side.x, y: away.y - s.side.y };
    const toward = unit(from.x, from.y);
    const prefer = toward.x === 0 && toward.y === 0 ? { x: -1, y: -1 } : toward;
    const reach = radiusOf(s.node);
    const own = new Set<object>([s.box]);
    const nb = nodeBoxes.get(s.node);
    if (nb) own.add(nb);
    /** The line that ties a badge standing at `rect` to its node, or null when it stands beside it. */
    const tie = (rect: Rect) => {
      const cx = clean((rect.x0 + rect.x1) / 2);
      const cy = clean((rect.y0 + rect.y1) / 2);
      const dist = Math.hypot(cx - s.x, cy - s.y);
      const ux = (s.x - cx) / (dist || 1);
      const uy = (s.y - cy) / (dist || 1);
      const leader = dist > radiusOf(s.node) + BADGE_R + 6 ? { x1: clean(cx + ux * BADGE_R), y1: clean(cy + uy * BADGE_R), x2: clean(s.x - ux * radiusOf(s.node)), y2: clean(s.y - uy * radiusOf(s.node)) } : null;
      return { cx, cy, leader };
    };
    // Across the rings round its own node is the way in to a node with a ring (it ends there), and is allowed where no way is clear of them too.
    const through = new Set<object>([...own, ...(ringsAt.get(s.node) ?? [])]);
    const crossed = (rect: Rect, owned: ReadonlySet<object>) => {
      const t = tie(rect);
      return t.leader !== null && hairlineCrosses({ x1: t.leader.x1, y1: t.leader.y1, x2: t.leader.x2, y2: t.leader.y2, pad: 0.75 }, owned);
    };
    // The nearest place with a hairline clear of every mark; failing that, one that crosses only its own node's rings; failing that, the nearest clear place.
    const gaps = GAPS_BADGE.map((g) => g + reach);
    const at = { x: s.x, y: s.y };
    let found = searchAround(at, prefer, BADGE_BOX, BADGE_BOX, gaps, (rect) => !crossed(rect, own));
    if (found.hits > 0) found = searchAround(at, prefer, BADGE_BOX, BADGE_BOX, gaps, (rect) => !crossed(rect, through));
    if (found.hits > 0) found = searchAround(at, prefer, BADGE_BOX, BADGE_BOX, gaps);
    const rect = found.rect;
    const t = tie(rect);
    s.badge = { x: t.cx, y: t.cy, r: BADGE_R, leader: t.leader };
    put(rect);
    if (t.leader) obstacles.addHairline({ x1: t.leader.x1, y1: t.leader.y1, x2: t.leader.x2, y2: t.leader.y2, pad: 0.75 });
  }

  // The words that are always written: a load's, a reaction's, a member load's. Each hugs its mark (within `TIE` of its ink); the smaller text
  // is tried before it is moved; a number that can only go further is tied to its mark by a hairline that crosses no other mark and no other
  // word; one that finds no place on a crowded drawing is not written on it (never on a line "because there was no room"): it is counted, and
  // it is in the tables.
  let mandatoryLeft = 0;
  /** Other places along a mark's ink to stand a number beside: its ends and middles, the nearest to the first choice first, none within 6 px of another. */
  const alternates = (mark: Mark, first: Point): Point[] => {
    const all: Point[] = [];
    for (const q of mark.segs) all.push({ x: (q.x1 + q.x2) / 2, y: (q.y1 + q.y2) / 2 }, { x: q.x1, y: q.y1 }, { x: q.x2, y: q.y2 });
    all.sort((a, b) => Math.hypot(a.x - first.x, a.y - first.y) - Math.hypot(b.x - first.x, b.y - first.y));
    const out: Point[] = [];
    for (const q of all) if ([first, ...out].every((o) => Math.hypot(o.x - q.x, o.y - q.y) >= 6) && out.length < 6) out.push(q);
    return out;
  };
  for (const m of mandatory) {
    // A number belongs to the mark it is nearest: no other mark of the drawing is nearer to it than its own. Only the marks near the number's are looked at.
    const rivals = marks.filter((q) => q !== m.mark && distPointRect(m.anchor.x, m.anchor.y, q.box) < 90);
    const belongs = (rect: Rect): boolean => {
      const own = markDistance(rect, m.mark);
      return own <= TIE + 0.25 && rivals.every((q) => markDistance(rect, q) >= own - 0.25);
    };
    const wantText = (size: number) => ({ w: widthOf(m.text, CHAR * (size / BASE_SIZE), 4 * (size / BASE_SIZE)), h: LABEL_H * (size / BASE_SIZE) });
    // Where a number may stand beside its mark: the place that suits it best (the end of the arrow away from the node, the opening of a ring)
    // and then others along its ink - the middle of the arrow, its other end, the stretch of a load across a member.
    const spots = m.ring ? [m.anchor] : [m.anchor, ...alternates(m.mark, m.anchor)];
    let done = false;
    for (const size of SIZES) {
      const f = size / BASE_SIZE;
      const { w, h } = wantText(size);
      for (const at of spots) {
        const found = m.ring ? searchRing(m.ring, w, h, GAPS_RING, belongs) : search(at, m.prefer, w, h, GAPS_TIED, belongs);
        if (found.hits === 0) {
          put(found.rect);
          m.set(labelAt(m.text, found.rect, f));
          done = true;
          break;
        }
      }
      if (done) break;
    }
    if (done) continue;
    // The hairline: from the mark to the word, across nothing; at the full size first, and smaller where that finds no way. Where there is no way
    // across nothing, one across the lines of the structure itself (a member, the deformed shape) - never across a mark, a word or a badge.
    for (const crossable of [m.mark.owned, new Set<object>([...m.mark.owned, ...structure])]) {
      for (const size of SIZES) {
        const f = size / BASE_SIZE;
        const { w, h } = wantText(size);
        for (const at of spots) {
          const got: { hl: Seg | null } = { hl: null };
          const ok = (rect: Rect) => {
            const hl = hairline(m.mark, rect);
            if (hairlineCrosses(hl, crossable)) return false;
            got.hl = hl;
            return true;
          };
          const far = m.ring ? searchRing(m.ring, w, h, GAPS_RING_LEADER, ok) : search(at, m.prefer, w, h, GAPS_LEADER, ok);
          const hl = got.hl;
          if (far.hits > 0 || hl === null) continue;
          const box = labelAt(m.text, far.rect, f);
          box.leader = { x1: clean(hl.x1), y1: clean(hl.y1), x2: clean(hl.x2), y2: clean(hl.y2) };
          put(far.rect);
          // The hairline is a line the words after it keep clear of.
          obstacles.addHairline(hl);
          m.set(box);
          done = true;
          break;
        }
        if (done) break;
      }
      if (done) break;
    }
    if (!done) mandatoryLeft++;
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
    capped,
    tiny,
    legend,
    summed: o.loads ? summed : [],
    cancelled: o.loads ? cancelled : [],
    dotted,
    dots: dots.sort((p, q) => p - q),
    supportsOverlap: supports.some((a, i) => supports.slice(i + 1).some((b) => a.box.x0 < b.box.x1 && b.box.x0 < a.box.x1 && a.box.y0 < b.box.y1 && b.box.y0 < a.box.y1 && a.scale < 1)),
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

/** What a drawing shows that the sentence under it must follow: which nodes it drew as dots, whether it drew loads and reactions, and how many words it left off. */
export interface DrawnFacts {
  dots: readonly number[];
  loads: boolean;
  reactions: boolean;
  thinned: number;
}
export const drawnOf = (l: Layout): DrawnFacts => ({ dots: l.dots, loads: l.loads.length > 0, reactions: l.reactions.length > 0, thinned: l.thinned });

const everyKept = new WeakMap<StiffnessDrawing, Map<string, { width: number; complete: boolean }>>();
/**
 * The width that "Show every word" draws the structure at: the column's own (`base`) when every word already has a place, else the least
 * width, up to 6,000 px, at which every word fits at the smallest size. `complete` is whether that was found: a drawing that is not wider
 * for being wider (a tall structure) or that no width suits is left as it is (`width` is `base`, `complete` false). The answer is kept for the
 * drawing it was found for: the page asks for it a moment after a key (to offer the switch), and the figure asks again when the switch is ticked.
 */
export function everyWidth(drawing: StiffnessDrawing, o: Looks, base: number): { width: number; complete: boolean } {
  const key = JSON.stringify([base, o.loads, o.reactions, o.deformed, o.dofs, o.nodeNumbers, o.memberNumbers, o.values, o.group, o.flagged ?? null]);
  let held = everyKept.get(drawing);
  if (!held) everyKept.set(drawing, (held = new Map()));
  const found = held.get(key);
  if (found) return found;
  const made = searchEvery(drawing, o, base);
  if (held.size >= 12) held.clear();
  held.set(key, made);
  return made;
}
function searchEvery(drawing: StiffnessDrawing, o: Looks, base: number): { width: number; complete: boolean } {
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
 * THE DRAWING THE PAGE MAKES for a structure in a column: its width, whether it was widened, the layout, and how many words it leaves off AT THE
 * WIDTH IT HAS WITHOUT THE SWITCH (`thinnedAtRoom`): the page offers "Show every word" by that count, and it must not fall to 0 because the
 * switch was used - the page would take the switch away, the drawing would narrow, the count would be back, and the drawing would go on
 * widening and narrowing.
 */
export function figureOf(drawing: StiffnessDrawing, looks: Looks, o: { width: number; widen: boolean; every: boolean; maxHeight?: number }): { drawn: number; widened: boolean; layout: Layout; thinnedAtRoom: number } {
  const f = o.widen ? figureWidth(drawing, looks, o.width, o.every) : { drawn: o.width, room: o.width, widened: false };
  const layout = layoutFor(drawing, { ...looks, width: f.drawn, maxHeight: o.maxHeight });
  const thinnedAtRoom = f.widened ? layoutFor(drawing, { ...looks, width: f.room, maxHeight: o.maxHeight }).thinned : layout.thinned;
  return { drawn: f.drawn, widened: f.widened, layout, thinnedAtRoom };
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
