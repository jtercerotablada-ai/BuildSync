import { formatNumber } from '@/lib/calc/format';
import type { Diagram, DiagramMember, DiagramPoint, DrawingMemberLoad, FrameDrawing, Pt } from '@/lib/calc/frame/analysis';
import type { FrameSupportKind } from '@/lib/calc/frame/types';
import { signed } from './text';

/**
 * THE FRAME DRAWING, RECKONED. Where every line, symbol, arrow, hatch and word of the frame's drawing goes, in pixels - with no
 * React: `FrameSchematic.tsx` writes what `frameLayout` returns as SVG and adds nothing of its own, so the layout is held to its rules
 * without a browser (frame-schematic.test.ts).
 *
 * It is given a `FrameDrawing` (lib/calc/frame/analysis.ts: the frame, its supports, its loads, its reactions and the diagrams, all in
 * the units shown, y UP) and the looks asked for (which diagram, whether the loads, reactions, values and numbers are on), and
 * returns shapes in pixels (y DOWN). The drawing is built even when the frame cannot be solved: then it has no diagrams, and the
 * nodes that are part of a problem can be ringed.
 *
 * ONE DIAGRAM AT A TIME. The bending moment M (drawn on the TENSION side, diagonal hatching), the shear V (vertical hatching) and the
 * axial force N (dots) are told apart by their pattern and by the sign written inside them as well as by colour, so that a black and
 * white sheet and a reader who does not tell blue from green lose nothing. All three are drawn at ONE scale for the whole frame
 * (`scaleValue`: the value of one length unit of height, a clean number, divided by `amp`, the visitor's "larger / smaller").
 *
 * THE WORDS ARE KEPT CLEAR. Every number written on the drawing - a value at an extreme or at the end of a member, a load, a reaction,
 * the number of a member - is put where it touches no line, no node, no support, no arrow, no hatch outline and no other number.
 * The loads' and reactions' words are always written: they search outwards from their arrow until a place is clear. The words that
 * are the visitor's to ask for (diagram values, member numbers) are tried at 11 px and then smaller (10, 9, 8 px - one size for the
 * whole drawing, the largest at which every one finds a clear place); only when even 8 px leaves some without a place are the
 * lightest left off, and the count is stated (`thinned`): they are in the tables, and the switch "Show every value" draws the frame
 * wide enough for all of them (`everyWidth`). Nothing is ever drawn on a line "because there was no room".
 */

export type DiagramMode = 'none' | 'M' | 'V' | 'N' | 'deformed';
/** The factors "draw the diagrams smaller / larger" steps through: the diagram is amp times as tall as at the standard scale. */
export const AMPS = [0.5, 1, 2, 4] as const;

/** Pixel sizes at full scale. */
const NODE_R = 7;
const DOT_R = 3.2;
const HINGE_R = 4.2;
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
export const SIZES = [11, 10, 9, 8] as const;
const BASE_SIZE = 11;
const EVERY_MAX = 6000;
/** A value under this share of its diagram's largest is not worth a label. */
const MIN_SHARE = 0.02;

export type Point = { x: number; y: number };
export type Rect = { x0: number; y0: number; x1: number; y1: number };
type Seg = { x1: number; y1: number; x2: number; y2: number; pad: number };

export interface Looks {
  mode: DiagramMode;
  loads: boolean;
  reactions: boolean;
  values: boolean;
  nodeNumbers: boolean;
  memberNumbers: boolean;
  /** How many times taller than the standard scale the diagrams are drawn. */
  amp: number;
  /** What numbers are set apart with. */
  group: string;
  /** Nodes (labels) that are part of a problem: ringed. */
  flagged?: readonly number[];
  /** The node displacements, in the units shown, for the totals written beside the deformed shape. */
  displacements?: readonly { node: number; magnitude: number }[] | null;
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
  numbered: boolean;
  flagged: boolean;
}
export interface HingeShape {
  member: number;
  x: number;
  y: number;
  r: number;
}
export interface SupportMark {
  kind: 'x' | 'y' | 'r';
  rotation: number;
  depth: number;
}
export interface SupportShape {
  label: number;
  node: number;
  kind: FrameSupportKind;
  x: number;
  y: number;
  /** Degrees to turn the symbol - drawn pointing down the page - to its place. */
  rotation: number;
  /** Unit vector, on the page (y down), from the node towards the ground the symbol stands on. */
  side: Point;
  depth: number;
  angle: number | null;
  /** The box round the symbol and its marks, upright on the page. */
  box: Rect;
  /** Springs of a spring support, each its own mark. */
  marks: SupportMark[];
  badges: { x: number; y: number; glyph: 'k' | 'd' }[];
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
  kind: DrawingMemberLoad['kind'];
  arrows: { tail: Point; tip: Point }[];
  /** The line joining the tails of a distributed load. */
  line: Point[] | null;
  /** The two dashed lines of a temperature change. */
  heat: { x1: number; y1: number; x2: number; y2: number }[];
  arc: ArcShape | null;
  text: LabelBox | null;
}
export interface DiagramShape {
  mode: 'M' | 'V' | 'N';
  polygons: { points: string; sign: 1 | -1 }[];
  outlines: string[];
  signs: { x: number; y: number; glyph: '+' | '−' }[];
  labels: (LabelBox & { member: number; kind: 'start' | 'end' | 'max' | 'min' })[];
  /** The small arrows that show each member's direction, for the signs of V and N. */
  chevrons: { x: number; y: number; angle: number }[];
}
export interface DeformedShape {
  members: { member: number; points: string }[];
  totals: (LabelBox & { node: number })[];
}

export type LegendKey =
  | 'member'
  | 'node'
  | 'hinge'
  | 'fixed'
  | 'pin'
  | 'roller'
  | 'guide'
  | 'spring'
  | 'springBadge'
  | 'settle'
  | 'load'
  | 'loadMoment'
  | 'distributed'
  | 'temperature'
  | 'reaction'
  | 'reactionMoment'
  | 'moment'
  | 'shear'
  | 'axial'
  | 'positive'
  | 'direction'
  | 'deformed'
  | 'flagged';

export interface Layout {
  width: number;
  height: number;
  /** Pixels per unit of length. */
  scale: number;
  /** The size (px) of the optional words. */
  fontSize: number;
  /** Whether the drawing's size follows its width (a wider drawing is a larger one). False for a tall frame, whose size follows its height. */
  widthBound: boolean;
  members: MemberShape[];
  nodes: NodeShape[];
  hinges: HingeShape[];
  supports: SupportShape[];
  loads: { label: number; arrow: ArrowShape | null; arc: ArcShape | null }[];
  memberLoads: MemberLoadShape[];
  reactions: { label: number; arrows: ArrowShape[]; arc: ArcShape | null }[];
  diagram: DiagramShape | null;
  deformed: DeformedShape | null;
  /** The diagram asked for has nothing to draw: it is zero everywhere (or there is no solution). */
  empty: boolean;
  /** The value of one length unit of the diagram's height at the scale drawn (clean number over amp); null without a diagram. */
  scaleValue: number | null;
  /** The exaggeration of the deformed shape; null when there is none. */
  factor: number | null;
  legend: LegendKey[];
  /** How many words that were asked for have no place on the drawing. */
  thinned: number;
  /** Every word placed, as the rectangles they take: for the checks of clearance. */
  placed: Rect[];
  /** Every line and box a word must stay clear of. */
  obstacles: { segs: Seg[]; boxes: Rect[] };
}

const clean = (v: number): number => {
  const r = Math.round(v * 1e6) / 1e6;
  return r === 0 ? 0 : r;
};
const pt = (p: Point): Point => ({ x: clean(p.x), y: clean(p.y) });
const poly = (points: readonly Point[]): string => points.map((p) => `${clean(p.x)},${clean(p.y)}`).join(' ');

/** A size written on the drawing: the page's own number, with its sign when it has one to show. */
export const plain = (v: number, group: string, sig = 4): string => formatNumber(Math.abs(v), sig, group);
export const withSign = (v: number, group: string, sig = 4): string => signed(formatNumber(Math.abs(v), sig, group), v);

/* ── Geometry ───────────────────────────────────────────────────────────── */

function distPointRect(px: number, py: number, r: Rect): number {
  return Math.hypot(Math.max(r.x0 - px, 0, px - r.x1), Math.max(r.y0 - py, 0, py - r.y1));
}
function distPointSeg(px: number, py: number, s: Seg): number {
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
const GAPS = [3, 6, 11, 18, 28, 40, 56, 76];
const GAPS_OPTIONAL = [2, 5, 9, 15, 23, 33];
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
const labelAt = (value: string, rect: Rect, f = 1): LabelBox => ({ value, x: clean((rect.x0 + rect.x1) / 2), y: clean(rect.y1 - 3.5 * f), anchor: 'middle', rect });
const widthOf = (value: string, char = CHAR, pad = 4): number => value.length * char + pad;

/* ── The obstacles, indexed ─────────────────────────────────────────────── */

const CELL = 48;
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
    const put = (id: number, x0: number, y0: number, x1: number, y1: number) => {
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

/* ── The room a drawing wants ───────────────────────────────────────────── */

/** The margin round the frame, in pixels: room for the supports and reactions below it, the loads above it and the numbers beside both. */
const marginFor = (avail: number): number => Math.round(Math.max(54, Math.min(70, avail * 0.12)));

/** A point of a diagram's outline, with its offset from the member's axis made `amp` times as large. */
function ampedPoint(m: DiagramMember, p: DiagramPoint, amp: number): Pt {
  const len = Math.hypot(m.x2 - m.x1, m.y2 - m.y1);
  if (len === 0 || amp === 1) return { x: p.x, y: p.y };
  const ax = m.x1 + ((m.x2 - m.x1) / len) * p.s;
  const ay = m.y1 + ((m.y2 - m.y1) / len) * p.s;
  return { x: ax + amp * (p.x - ax), y: ay + amp * (p.y - ay) };
}
/** A polygon point of a diagram (given in global axes), moved along its perpendicular to the member by amp. */
function ampedAny(m: DiagramMember, p: Pt, amp: number): Pt {
  if (amp === 1) return p;
  const dx = m.x2 - m.x1;
  const dy = m.y2 - m.y1;
  const l2 = dx * dx + dy * dy;
  if (l2 === 0) return p;
  const t = ((p.x - m.x1) * dx + (p.y - m.y1) * dy) / l2;
  const fx = m.x1 + t * dx;
  const fy = m.y1 + t * dy;
  return { x: fx + amp * (p.x - fx), y: fy + amp * (p.y - fy) };
}

const diagramOf = (d: FrameDrawing, mode: DiagramMode): Diagram | null => (mode === 'M' ? d.moment : mode === 'V' ? d.shear : mode === 'N' ? d.axial : null);

interface Extent {
  x0: number;
  y0: number;
  x1: number;
  y1: number;
}
/** The frame and whatever the diagram asked for adds to it, in the length unit. */
function extentOf(d: FrameDrawing, mode: DiagramMode, amp: number): Extent {
  const e: Extent = { x0: d.box.x0, y0: d.box.y0, x1: d.box.x1, y1: d.box.y1 };
  const grow = (p: Pt) => {
    e.x0 = Math.min(e.x0, p.x);
    e.y0 = Math.min(e.y0, p.y);
    e.x1 = Math.max(e.x1, p.x);
    e.y1 = Math.max(e.y1, p.y);
  };
  const diagram = diagramOf(d, mode);
  if (diagram && diagram.scale) for (const m of diagram.members) for (const p of m.outline) grow(ampedPoint(m, p, amp));
  if (mode === 'deformed' && d.deflected && d.deflected.factor !== null) {
    for (const m of d.deflected.members) for (const p of m.points) grow(p);
    for (const n of d.deflected.nodes) grow(n);
  }
  return e;
}

/* ── The layout ─────────────────────────────────────────────────────────── */

/** Which directions the members leave a node in, on the page. */
type Around = (node: number) => Point[];

export function frameLayout(drawing: FrameDrawing, o: LayoutOptions): Layout {
  const W = o.width;
  const maxHeight = o.maxHeight ?? MAX_HEIGHT;
  const M = marginFor(W);
  const amp = o.amp > 0 ? o.amp : 1;
  const mode = o.mode;
  const diagram = diagramOf(drawing, mode);
  const e = extentOf(drawing, mode, amp);
  const ew = e.x1 - e.x0;
  const eh = e.y1 - e.y0;
  const sx = ew > 0 ? (W - 2 * M) / ew : Infinity;
  const sy = eh > 0 ? (maxHeight - 2 * M) / eh : Infinity;
  const scale = ew > 0 || eh > 0 ? Math.max(1e-9, Math.min(sx, sy)) : 1;
  const drawnW = ew * scale;
  const offX = (W - drawnW) / 2;
  const H = clean(Math.max(eh * scale + 2 * M, 2 * M));
  const X = (x: number) => offX + (x - e.x0) * scale;
  const Y = (y: number) => M + (e.y1 - y) * scale;
  const P = (p: Pt): Point => ({ x: X(p.x), y: Y(p.y) });
  const inside = (rect: Rect) => rect.x0 >= 3 && rect.x1 <= W - 3 && rect.y0 >= 3 && rect.y1 <= H - 3;
  const flagged = new Set(o.flagged ?? []);
  const nodeR = o.nodeNumbers ? NODE_R : DOT_R;
  const obstacles = new Obstacles();

  /* Members and nodes. */
  const nodePos = new Map<number, Point>();
  for (const n of drawing.nodes) nodePos.set(n.label, { x: X(n.x), y: Y(n.y) });
  const members: MemberShape[] = drawing.members.map((m) => ({ label: m.label, i: m.i, j: m.j, x1: clean(X(m.x1)), y1: clean(Y(m.y1)), x2: clean(X(m.x2)), y2: clean(Y(m.y2)), tag: null }));
  for (const m of members) obstacles.addSeg({ x1: m.x1, y1: m.y1, x2: m.x2, y2: m.y2, pad: MEMBER_W / 2 });
  const nodes: NodeShape[] = drawing.nodes.map((n) => ({ label: n.label, x: clean(X(n.x)), y: clean(Y(n.y)), r: nodeR, numbered: o.nodeNumbers, flagged: flagged.has(n.label) }));
  for (const n of nodes) {
    const rr = n.r + (n.flagged ? 4 : 0) + 0.75;
    obstacles.addBox(boxOf(n.x, n.y, rr, rr));
  }
  const around: Around = (node) =>
    drawing.members.flatMap((m) => {
      const other = m.i === node ? m.j : m.j === node ? m.i : 0;
      const a = nodePos.get(node);
      const b = other ? nodePos.get(other) : undefined;
      if (!a || !b) return [];
      const u = unit(b.x - a.x, b.y - a.y);
      return u.x === 0 && u.y === 0 ? [] : [u];
    });
  const clearance = (node: number, s: Point) => Math.max(-1, ...around(node).map((t) => t.x * s.x + t.y * s.y));

  /* Hinges: a small open circle on the member, just beside its node. */
  const hinges: HingeShape[] = drawing.hinges.flatMap((h) => {
    const n = nodePos.get(h.node);
    if (!n) return [];
    const off = nodeR + HINGE_R + 1.5;
    // The hinge's direction is in the length unit with y up: on the page y is down.
    const x = n.x + h.dx * off;
    const y = n.y - h.dy * off;
    return [{ member: h.member, x: clean(x), y: clean(y), r: HINGE_R }];
  });
  for (const h of hinges) obstacles.addBox(boxOf(h.x, h.y, h.r + 0.8, h.r + 0.8));

  /* Supports: which side of its node each stands on, and its symbol. */
  const SIDES: Point[] = [
    { x: 0, y: 1 },
    { x: -1, y: 0 },
    { x: 1, y: 0 },
    { x: 0, y: -1 },
  ];
  const sideFor = (node: number, candidates: Point[]): Point => candidates.find((s) => clearance(node, s) < 0.5) ?? candidates.reduce((best, s) => (clearance(node, s) < clearance(node, best) ? s : best));
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
  const unite = (a: Rect, b: Rect): Rect => ({ x0: Math.min(a.x0, b.x0), y0: Math.min(a.y0, b.y0), x1: Math.max(a.x1, b.x1), y1: Math.max(a.y1, b.y1) });
  const DEPTH: Record<FrameSupportKind, number> = { fixed: 15, pin: 22, roller: 24, guide: 21, spring: 28 };
  const HALF: Record<FrameSupportKind, number> = { fixed: 14, pin: 15, roller: 13, guide: 14, spring: 12 };

  const supports: SupportShape[] = drawing.supports.flatMap((s) => {
    const p = nodePos.get(s.node);
    if (!p) return [];
    let sd: Point;
    if ((s.kind === 'roller' || s.kind === 'guide') && s.angle !== null) {
      const a = (s.angle * Math.PI) / 180;
      // The ground is against the line of action; of the two sides of that line, the one the members are not on.
      const one: Point = { x: clean(-Math.cos(a)), y: clean(Math.sin(a)) };
      const other: Point = { x: clean(-one.x), y: clean(-one.y) };
      sd = clearance(s.node, one) <= clearance(s.node, other) ? one : other;
    } else if (s.kind === 'spring') sd = sideFor(s.node, SIDES);
    else sd = sideFor(s.node, SIDES);
    let rotation = rotationOf(sd);
    let depth = DEPTH[s.kind];
    const hw = HALF[s.kind] + 4;
    const marks: SupportMark[] = [];
    let box: Rect;
    if (s.kind === 'spring') {
      // A spring support is the springs it has: one mark for each, along its own axis.
      const sides: [SupportMark['kind'], Point[]][] = [
        ['y', [SIDES[0], SIDES[3]]],
        ['x', [SIDES[1], SIDES[2]]],
      ];
      box = { x0: p.x, y0: p.y, x1: p.x, y1: p.y };
      for (const [kind, cands] of sides) {
        if (kind === 'x' ? !s.springs.x : !s.springs.y) continue;
        const side = sideFor(s.node, cands);
        const rot = rotationOf(side);
        marks.push({ kind, rotation: rot, depth: DEPTH.spring });
        box = unite(box, symbolBox(p, rot, HALF.spring + 4, DEPTH.spring));
        if (marks.length === 1) {
          sd = side;
          rotation = rot;
        }
      }
      if (s.springs.r) {
        marks.push({ kind: 'r', rotation: 0, depth: 18 });
        box = unite(box, boxOf(p.x, p.y, 20, 20));
        if (marks.length === 1) {
          sd = { x: 0, y: 1 };
          rotation = 0;
        }
      }
      if (marks.length === 0) {
        // A spring of no stiffness is a support of nothing: a short stub, so that the node can be seen to be named.
        depth = 8;
        box = symbolBox(p, rotation, 8, depth);
      } else depth = marks.length === 1 && marks[0].kind === 'r' ? 20 : DEPTH.spring;
    } else box = symbolBox(p, rotation, hw, depth);
    const badges: SupportShape['badges'] = [];
    if (s.kind !== 'spring' && (s.springs.x || s.springs.y || s.springs.r)) badges.push({ x: clean(p.x + 17), y: clean(p.y - 15), glyph: 'k' });
    if (s.settles) badges.push({ x: clean(p.x - 17), y: clean(p.y - 15), glyph: 'd' });
    for (const b of badges) box = unite(box, boxOf(b.x, b.y, 6.5, 6.5));
    return [{ label: s.label, node: s.node, kind: s.kind, x: clean(p.x), y: clean(p.y), rotation, side: sd, depth, angle: s.angle, box: { x0: clean(box.x0), y0: clean(box.y0), x1: clean(box.x1), y1: clean(box.y1) }, marks, badges }];
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
  const arrowObstacle = (tail: Point, tip: Point) => {
    obstacles.addSeg({ x1: tail.x, y1: tail.y, x2: tip.x, y2: tip.y, pad: 1.5 });
    obstacles.addBox(headBox(tail, tip));
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

  /* Nodal loads. */
  const maxLoad = Math.max(0, ...drawing.loads.map((l) => l.magnitude));
  type Pending = { owner: 'load' | 'reaction' | 'mload' | 'sign'; text: string; anchor: Point; prefer: Point; set: (box: LabelBox) => void };
  const mandatory: Pending[] = [];
  const loads: Layout['loads'] = [];
  if (o.loads) {
    for (const l of drawing.loads) {
      const p = nodePos.get(l.node);
      if (!p) continue;
      let arrow: ArrowShape | null = null;
      let arc: ArcShape | null = null;
      if (l.magnitude > 0) {
        const dir = { x: l.dx, y: -l.dy };
        const len = 18 + 18 * (maxLoad > 0 ? l.magnitude / maxLoad : 0);
        const tip = { x: clean(p.x - dir.x * (nodeR + 2)), y: clean(p.y - dir.y * (nodeR + 2)) };
        const tail = { x: clean(tip.x - dir.x * len), y: clean(tip.y - dir.y * len) };
        arrow = { tail, tip, text: null };
        arrowObstacle(tail, tip);
        const target = arrow;
        mandatory.push({ owner: 'load', text: plain(l.magnitude, o.group), anchor: tail, prefer: { x: -dir.x, y: -dir.y }, set: (b) => (target.text = b) });
      }
      if (l.m !== 0) {
        const gap = openSide(l.node);
        const a = arcShape(p, nodeR + 11, gap, l.m > 0);
        for (const s of a.segs) obstacles.addSeg(s);
        arc = { cx: clean(p.x), cy: clean(p.y), r: nodeR + 11, path: a.path, head: a.head, text: null };
        const target = arc;
        mandatory.push({ owner: 'load', text: plain(l.m, o.group), anchor: a.mid, prefer: { x: Math.cos((gap * Math.PI) / 180), y: -Math.sin((gap * Math.PI) / 180) }, set: (b) => (target.text = b) });
      }
      loads.push({ label: l.label, arrow, arc });
    }
  }

  /* Reactions: a component along each axis beside the symbol; along its line for a roller or a guide; a ring for a moment. */
  const reactions: Layout['reactions'] = [];
  if (o.reactions) {
    const comps = drawing.reactions.flatMap((r) => [Math.abs(r.rx), Math.abs(r.ry)]);
    const topComp = Math.max(0, ...comps, ...drawing.reactions.map((r) => r.magnitude));
    for (const r of drawing.reactions) {
      const p = nodePos.get(r.node);
      if (!p) continue;
      const sup = supportAt.get(r.node);
      const sd = sup?.side ?? { x: 0, y: 1 };
      const depth = sup?.depth ?? 8;
      const hwid = sup ? Math.max(6, (sup.box.x1 - sup.box.x0) / 2) : 8;
      const arrows: ArrowShape[] = [];
      const along = sup && (sup.kind === 'roller' || sup.kind === 'guide');
      const one = (fx: number, fy: number, magnitude: number) => {
        if (!(magnitude > 0)) return;
        const dir = unit(fx, -fy);
        const len = 18 + 14 * (topComp > 0 ? magnitude / topComp : 0);
        const parallel = dir.x * sd.x + dir.y * sd.y;
        let tip: Point;
        let tail: Point;
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
        }
        const a: ArrowShape = { tail: pt(tail), tip: pt(tip), text: null };
        arrows.push(a);
        arrowObstacle(a.tail, a.tip);
        const mid = { x: (a.tail.x + a.tip.x) / 2, y: (a.tail.y + a.tip.y) / 2 };
        let n = { x: dir.y, y: -dir.x };
        if (Math.abs(n.x) < 0.1 ? n.y < 0 : n.x < 0) n = { x: -n.x, y: -n.y };
        mandatory.push({ owner: 'reaction', text: plain(magnitude, o.group), anchor: mid, prefer: n, set: (b) => (a.text = b) });
      };
      if (along) one(r.rx, r.ry, r.magnitude);
      else {
        one(r.rx, 0, Math.abs(r.rx));
        one(0, r.ry, Math.abs(r.ry));
      }
      let arc: ArcShape | null = null;
      if (r.rm !== 0) {
        const gap = openSide(r.node);
        const radius = nodeR + 14;
        const a = arcShape(p, radius, gap, r.rm > 0);
        for (const s of a.segs) obstacles.addSeg(s);
        arc = { cx: clean(p.x), cy: clean(p.y), r: radius, path: a.path, head: a.head, text: null };
        const target = arc;
        mandatory.push({ owner: 'reaction', text: plain(r.rm, o.group), anchor: a.mid, prefer: { x: Math.cos((gap * Math.PI) / 180), y: -Math.sin((gap * Math.PI) / 180) }, set: (b) => (target.text = b) });
      }
      reactions.push({ label: r.label, arrows, arc });
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
      const at = (pos: number): Point => ({ x: a0.x + t.x * Lpx * (pos / Lw), y: a0.y + t.y * Lpx * (pos / Lw) });
      const shape: MemberLoadShape = { label: l.label, member: l.member, kind: l.kind, arrows: [], line: null, heat: [], arc: null, text: null };
      const push = { x: l.dx, y: -l.dy };
      const dn = push.x * nrm.x + push.y * nrm.y;
      const heavy = Math.max(l.v1, l.v2);
      if (l.kind === 'udl' || l.kind === 'udl-projected' || l.kind === 'trapezoid') {
        const p1 = at(l.a);
        const p2 = at(l.b);
        const segLen = Math.hypot(p2.x - p1.x, p2.y - p1.y);
        const sigma = Math.abs(l.signed.w1) >= Math.abs(l.signed.w2) ? Math.sign(l.signed.w1) : Math.sign(l.signed.w2);
        const count = Math.max(2, Math.min(14, Math.round(segLen / 20) + 1));
        const tails: Point[] = [];
        let textAt: Point | null = null;
        let textPrefer: Point = { x: -push.x, y: -push.y };
        for (let k = 0; k < count; k++) {
          const u = count === 1 ? 0 : k / (count - 1);
          const v = l.signed.w1 + (l.signed.w2 - l.signed.w1) * u;
          if (v === 0 || !(sigma !== 0)) continue;
          const ratio = heavy > 0 ? Math.abs(v) / heavy : 0;
          const sgn = Math.sign(v) * sigma;
          const dir = { x: push.x * sgn, y: push.y * sgn };
          const base = { x: p1.x + (p2.x - p1.x) * u, y: p1.y + (p2.y - p1.y) * u };
          if (Math.abs(dn) >= 0.3) {
            const h = 9 + 15 * l.share * ratio;
            const tip = { x: base.x - dir.x * 3, y: base.y - dir.y * 3 };
            const tail = { x: tip.x - dir.x * h, y: tip.y - dir.y * h };
            shape.arrows.push({ tail: pt(tail), tip: pt(tip) });
            tails.push(tail);
            if (k === Math.floor((count - 1) / 2)) {
              textAt = tail;
              textPrefer = { x: -dir.x, y: -dir.y };
            }
          } else {
            // Along the member: the arrows run beside it.
            const off = { x: nrm.x * 10, y: nrm.y * 10 };
            const len = 12 + 6 * l.share * ratio;
            const tipPoint = { x: base.x + off.x + dir.x * len * 0.5, y: base.y + off.y + dir.y * len * 0.5 };
            const tailPoint = { x: base.x + off.x - dir.x * len * 0.5, y: base.y + off.y - dir.y * len * 0.5 };
            shape.arrows.push({ tail: pt(tailPoint), tip: pt(tipPoint) });
            if (k === Math.floor((count - 1) / 2)) {
              textAt = { x: base.x + off.x, y: base.y + off.y };
              textPrefer = nrm;
            }
          }
        }
        if (Math.abs(dn) >= 0.3 && tails.length >= 2) shape.line = tails.map(pt);
        if (shape.arrows.length === 0) continue;
        for (const ar of shape.arrows) arrowObstacle(ar.tail, ar.tip);
        if (shape.line) for (let k = 1; k < shape.line.length; k++) obstacles.addSeg({ x1: shape.line[k - 1].x, y1: shape.line[k - 1].y, x2: shape.line[k].x, y2: shape.line[k].y, pad: 1 });
        const w1 = Math.abs(l.signed.w1);
        const w2 = Math.abs(l.signed.w2);
        const mixed = l.signed.w1 * l.signed.w2 < 0;
        const textValue = l.kind === 'trapezoid' && l.signed.w1 !== l.signed.w2 ? (mixed ? `${withSign(l.signed.w1, o.group)} → ${withSign(l.signed.w2, o.group)}` : `${plain(w1, o.group)} → ${plain(w2, o.group)}`) : plain(heavy, o.group);
        if (textAt) {
          const target = shape;
          mandatory.push({ owner: 'mload', text: textValue, anchor: textAt, prefer: textPrefer, set: (b) => (target.text = b) });
        }
      } else if (l.kind === 'point') {
        const base = at(l.a);
        const len = 20 + 14 * l.share;
        let tip: Point;
        let tail: Point;
        if (Math.abs(dn) >= 0.3) {
          tip = { x: base.x - push.x * 3, y: base.y - push.y * 3 };
          tail = { x: tip.x - push.x * len, y: tip.y - push.y * len };
        } else {
          const off = { x: nrm.x * 10, y: nrm.y * 10 };
          tip = { x: base.x + off.x + push.x * len * 0.5, y: base.y + off.y + push.y * len * 0.5 };
          tail = { x: base.x + off.x - push.x * len * 0.5, y: base.y + off.y - push.y * len * 0.5 };
        }
        shape.arrows.push({ tail: pt(tail), tip: pt(tip) });
        arrowObstacle(tail, tip);
        const target = shape;
        mandatory.push({ owner: 'mload', text: plain(l.v1, o.group), anchor: tail, prefer: { x: tail.x - tip.x, y: tail.y - tip.y }, set: (b) => (target.text = b) });
      } else if (l.kind === 'moment') {
        const base = at(l.a);
        const gap = Math.atan2(-nrm.y, nrm.x) * (180 / Math.PI);
        const a = arcShape(base, 13, gap, l.turn > 0);
        for (const s of a.segs) obstacles.addSeg(s);
        shape.arc = { cx: clean(base.x), cy: clean(base.y), r: 13, path: a.path, head: a.head, text: null };
        const target = shape;
        mandatory.push({ owner: 'mload', text: plain(l.v1, o.group), anchor: a.mid, prefer: nrm, set: (b) => (target.text = b) });
      } else {
        // A temperature change: two dashed lines beside the member, and the numbers.
        const off = 8;
        const p1 = at(0);
        const p2 = at(Lw);
        for (const sgn of [1, -1]) {
          const h = { x1: clean(p1.x + nrm.x * off * sgn), y1: clean(p1.y + nrm.y * off * sgn), x2: clean(p2.x + nrm.x * off * sgn), y2: clean(p2.y + nrm.y * off * sgn) };
          shape.heat.push(h);
          obstacles.addSeg({ x1: h.x1, y1: h.y1, x2: h.x2, y2: h.y2, pad: 1 });
        }
        const temp = l.temperature;
        const parts = [temp && temp.dT !== 0 ? `ΔT ${withSign(temp.dT, o.group)}` : '', temp && temp.dTg !== 0 ? `∇ ${withSign(temp.dTg, o.group)}` : ''].filter(Boolean);
        const mid = at(Lw / 2);
        const target = shape;
        if (parts.length) mandatory.push({ owner: 'mload', text: parts.join(' · '), anchor: { x: mid.x + nrm.x * off, y: mid.y + nrm.y * off }, prefer: nrm, set: (b) => (target.text = b) });
      }
      memberLoads.push(shape);
    }
  }

  /* The diagram asked for, in pixels. */
  let diagramShape: DiagramShape | null = null;
  let deformed: DeformedShape | null = null;
  let empty = false;
  let scaleValue: number | null = null;
  let factor: number | null = null;
  interface Wanted {
    text: string;
    anchor: Point;
    prefer: Point;
    weight: number;
    keep: (box: LabelBox) => void;
  }
  const wanted: Wanted[] = [];
  const signSpots: { polygon: { points: string; sign: 1 | -1 }; px: Point[]; spine: Point[]; index: number }[] = [];
  if (diagram && (mode === 'M' || mode === 'V' || mode === 'N')) {
    if (!diagram.scale) empty = true;
    else {
      scaleValue = diagram.scale.perUnit / amp;
      const shape: DiagramShape = { mode, polygons: [], outlines: [], signs: [], labels: [], chevrons: [] };
      for (const dm of diagram.members) {
        const poly0 = dm.polygons.map((g) => ({ sign: g.sign, px: g.points.map((q) => P(ampedAny(dm, q, amp))) }));
        for (const g of poly0) {
          const pxs = g.px.map(pt);
          shape.polygons.push({ points: poly(pxs), sign: g.sign });
        }
        const line = dm.outline.map((q) => P(ampedPoint(dm, q, amp)));
        shape.outlines.push(poly(line.map(pt)));
        for (let k = 1; k < line.length; k++) obstacles.addSeg({ x1: line[k - 1].x, y1: line[k - 1].y, x2: line[k].x, y2: line[k].y, pad: 1.25 });
        // Where a sign may be written inside each shaded piece: along the middle between the member and the outline.
        const mem = members.find((q) => q.label === dm.member);
        poly0.forEach((g, index) => {
          if (!mem) return;
          const dx = mem.x2 - mem.x1;
          const dy = mem.y2 - mem.y1;
          const l2 = dx * dx + dy * dy;
          const spine: Point[] = g.px.map((q) => {
            const tt = l2 === 0 ? 0 : ((q.x - mem.x1) * dx + (q.y - mem.y1) * dy) / l2;
            return { x: (q.x + mem.x1 + tt * dx) / 2, y: (q.y + mem.y1 + tt * dy) / 2 };
          });
          signSpots.push({ polygon: { points: poly(g.px.map(pt)), sign: g.sign }, px: g.px, spine, index });
        });
        if (mode !== 'M') {
          if (mem) {
            const len = Math.hypot(mem.x2 - mem.x1, mem.y2 - mem.y1);
            if (len >= 34) shape.chevrons.push({ x: clean((mem.x1 + mem.x2) / 2), y: clean((mem.y1 + mem.y2) / 2), angle: clean((Math.atan2(mem.y2 - mem.y1, mem.x2 - mem.x1) * 180) / Math.PI) });
          }
        }
      }
      diagramShape = shape;
      // The values: at each end and at each extreme of every member, weightiest first.
      if (o.values) {
        const seen = new Map<string, number>();
        for (const dm of diagram.members) {
          const wm = memberAt.get(dm.member)?.m;
          for (const lab of dm.labels) {
            if (lab.share < MIN_SHARE || lab.value === 0) continue;
            const text = withSign(lab.value, o.group);
            // At a rigid corner the two members' end moments are one number: written once.
            if (mode === 'M' && wm && (lab.kind === 'start' || lab.kind === 'end')) {
              const node = lab.kind === 'start' ? wm.i : wm.j;
              const key = `${node}|${text}`;
              if (seen.has(key)) continue;
              seen.set(key, dm.member);
            }
            const base = P({ x: lab.ax, y: lab.ay });
            const tip = P(ampedPoint(dm, { x: lab.x, y: lab.y, s: lab.s, value: lab.value }, amp));
            const off = unit(tip.x - base.x, tip.y - base.y);
            const prefer = off.x === 0 && off.y === 0 ? { x: -(Y(dm.y2) - Y(dm.y1)), y: X(dm.x2) - X(dm.x1) } : off;
            const kindBonus = lab.kind === 'max' || lab.kind === 'min' ? 0.5 : 0;
            const entry: DiagramShape['labels'][number] = { value: text, x: 0, y: 0, anchor: 'middle', rect: { x0: 0, y0: 0, x1: 0, y1: 0 }, member: dm.member, kind: lab.kind };
            wanted.push({ text, anchor: tip, prefer: unit(prefer.x, prefer.y), weight: lab.share + kindBonus, keep: (box) => shape.labels.push({ ...entry, ...box }) });
          }
        }
      }
    }
  } else if (mode === 'deformed' && drawing.deflected) {
    const d = drawing.deflected;
    factor = d.factor;
    if (d.factor !== null) {
      const shape: DeformedShape = { members: [], totals: [] };
      for (const dm of d.members) {
        const line = dm.points.map((q) => pt(P(q)));
        shape.members.push({ member: dm.member, points: poly(line) });
        for (let k = 1; k < line.length; k++) obstacles.addSeg({ x1: line[k - 1].x, y1: line[k - 1].y, x2: line[k].x, y2: line[k].y, pad: 1 });
      }
      deformed = shape;
      if (o.values && o.displacements) {
        const top = Math.max(0, ...o.displacements.map((q) => q.magnitude));
        for (const q of o.displacements) {
          const moved = d.nodes.find((n) => n.node === q.node);
          if (!moved || !(q.magnitude > 0) || top <= 0 || q.magnitude / top < 0.15) continue;
          const at = P(moved);
          const home = nodePos.get(q.node) ?? at;
          const entry: DeformedShape['totals'][number] = { value: '', x: 0, y: 0, anchor: 'middle', rect: { x0: 0, y0: 0, x1: 0, y1: 0 }, node: q.node };
          const text = plain(q.magnitude, o.group, 3);
          wanted.push({ text, anchor: at, prefer: unit(at.x - home.x, at.y - home.y), weight: q.magnitude / top, keep: (box) => shape.totals.push({ ...entry, ...box }) });
        }
      }
    }
  }
  if (mode === 'deformed' && (!drawing.deflected || drawing.deflected.factor === null)) empty = true;

  /* Member numbers: a small tag by each member. */
  if (o.memberNumbers) {
    for (const ms of members) {
      const mid = { x: (ms.x1 + ms.x2) / 2, y: (ms.y1 + ms.y2) / 2 };
      const t = unit(ms.x2 - ms.x1, ms.y2 - ms.y1);
      const prefer = t.x === 0 && t.y === 0 ? { x: 1, y: 0 } : { x: t.y, y: -t.x };
      wanted.push({ text: String(ms.label), anchor: mid, prefer, weight: 1.5, keep: (box) => (ms.tag = { ...box, value: String(ms.label) }) });
    }
  }

  obstacles.build();
  const placed: Rect[] = [];
  const touches = (rect: Rect, ceiling = Infinity): number => {
    let hits = inside(rect) ? 0 : 1000;
    if (hits >= ceiling) return hits;
    hits += obstacles.touches(rect, ceiling - hits);
    if (hits >= ceiling) return hits;
    for (const p of placed) {
      if (rectsNear(rect, p, FROM_LABEL)) hits++;
      if (hits >= ceiling) return hits;
    }
    return hits;
  };
  /** Searches outwards from a point for a clear place, preferring the directions nearest `prefer`; the least bad one when none is clear. */
  const search = (p: Point, prefer: Point, w: number, h: number, gaps: readonly number[]): { rect: Rect; hits: number } => {
    const ranked = [...DIRS].sort((a, b) => b.v.x * prefer.x + b.v.y * prefer.y - (a.v.x * prefer.x + a.v.y * prefer.y));
    const spots = gaps.flatMap((g) => ranked.map((d, i) => ({ g, dir: d.dir, cost: g + 9 * i }))).sort((a, b) => a.cost - b.cost);
    let best: { rect: Rect; hits: number } | null = null;
    for (const sp of spots) {
      const rect = spot(sp.dir, p, sp.g, w, h);
      const hits = touches(rect, best ? best.hits : Infinity);
      if (!best || hits < best.hits) best = { rect, hits };
      if (hits === 0) break;
    }
    return best!;
  };
  // The words that are always written: a load's, a reaction's, a member load's.
  // One that finds no clear place on a crowded drawing is not written on it (never on a line "because there was no room"): it is counted, and it is in the tables.
  let mandatoryLeft = 0;
  for (const m of mandatory) {
    const found = search(m.anchor, m.prefer, widthOf(m.text), LABEL_H, GAPS);
    if (found.hits > 0) {
      mandatoryLeft++;
      continue;
    }
    placed.push(found.rect);
    m.set(labelAt(m.text, found.rect));
  }
  const keptPlaced = placed.length;
  wanted.sort((p, q) => q.weight - p.weight);
  // Takes back what a size placed: the words it set in the drawing's shapes are written again by the next.
  const reset = () => {
    placed.length = keptPlaced;
    if (diagramShape) diagramShape.labels.length = 0;
    if (deformed) deformed.totals.length = 0;
    for (const ms of members) ms.tag = null;
  };
  const placeWords = (size: number, probe: boolean): number => {
    const f = size / BASE_SIZE;
    reset();
    let left = 0;
    for (const w of wanted) {
      const found = search(w.anchor, w.prefer, widthOf(w.text, CHAR * f, 4 * f), LABEL_H * f, GAPS_OPTIONAL);
      if (found.hits === 0) {
        placed.push(found.rect);
        w.keep(labelAt(w.text, found.rect, f));
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

  /* The signs inside the shaded pieces, in the clear room that is left. */
  if (diagramShape) {
    for (const s of signSpots) {
      const glyph: '+' | '−' = s.polygon.sign > 0 ? '+' : '−';
      const area = Math.abs(s.px.reduce((sum, q, k) => sum + (q.x * s.px[(k + 1) % s.px.length].y - s.px[(k + 1) % s.px.length].x * q.y), 0)) / 2;
      if (area < 150) continue;
      // Candidates: the polygon's centre, and the points of its spine, middle first.
      const cx = s.px.reduce((sum, q) => sum + q.x, 0) / s.px.length;
      const cy = s.px.reduce((sum, q) => sum + q.y, 0) / s.px.length;
      const spine = [...s.spine].sort((a, b) => Math.hypot(a.x - cx, a.y - cy) - Math.hypot(b.x - cx, b.y - cy));
      const candidates: Point[] = [{ x: cx, y: cy }, ...spine.slice(0, 6)];
      for (const c of candidates) {
        const rect = boxOf(c.x, c.y, 5.5, 6);
        if (!insidePolygon(c, s.px) || !insidePolygon({ x: rect.x0, y: rect.y0 }, s.px) || !insidePolygon({ x: rect.x1, y: rect.y0 }, s.px) || !insidePolygon({ x: rect.x0, y: rect.y1 }, s.px) || !insidePolygon({ x: rect.x1, y: rect.y1 }, s.px)) continue;
        if (touches(rect, 1) === 0) {
          placed.push(rect);
          diagramShape.signs.push({ x: clean(c.x), y: clean(c.y + 4), glyph });
          break;
        }
      }
    }
  }

  /* What the legend has to explain: only what is drawn. */
  const legend: LegendKey[] = [];
  const kinds = new Set(supports.map((s) => s.kind));
  if (members.length > 0) legend.push('member');
  if (nodes.length > 0) legend.push('node');
  if (hinges.length > 0) legend.push('hinge');
  for (const k of ['fixed', 'pin', 'roller', 'guide', 'spring'] as const) if (kinds.has(k)) legend.push(k);
  if (supports.some((s) => s.badges.some((b) => b.glyph === 'k'))) legend.push('springBadge');
  if (supports.some((s) => s.badges.some((b) => b.glyph === 'd'))) legend.push('settle');
  if (loads.some((l) => l.arrow) || memberLoads.some((l) => l.kind === 'point')) legend.push('load');
  if (loads.some((l) => l.arc) || memberLoads.some((l) => l.kind === 'moment')) legend.push('loadMoment');
  if (memberLoads.some((l) => l.kind === 'udl' || l.kind === 'udl-projected' || l.kind === 'trapezoid')) legend.push('distributed');
  if (memberLoads.some((l) => l.kind === 'temperature')) legend.push('temperature');
  if (reactions.some((r) => r.arrows.length > 0)) legend.push('reaction');
  if (reactions.some((r) => r.arc)) legend.push('reactionMoment');
  if (diagramShape) {
    legend.push(mode === 'M' ? 'moment' : mode === 'V' ? 'shear' : 'axial');
    if (diagramShape.signs.length > 0 || diagramShape.labels.length > 0) legend.push('positive');
    if (diagramShape.chevrons.length > 0) legend.push('direction');
  }
  if (deformed) legend.push('deformed');
  if (nodes.some((n) => n.flagged)) legend.push('flagged');

  return {
    width: W,
    height: H,
    scale: clean(scale),
    fontSize,
    widthBound: sx <= sy,
    members,
    nodes,
    hinges,
    supports,
    loads,
    memberLoads,
    reactions,
    diagram: diagramShape,
    deformed,
    empty,
    scaleValue,
    factor,
    legend,
    thinned,
    placed,
    obstacles: { segs: obstacles.segs, boxes: obstacles.boxes },
  };
}

function insidePolygon(p: Point, poly0: readonly Point[]): boolean {
  let inside = false;
  for (let i = 0, j = poly0.length - 1; i < poly0.length; j = i++) {
    const a = poly0[i];
    const b = poly0[j];
    if (a.y > p.y !== b.y > p.y && p.x < ((b.x - a.x) * (p.y - a.y)) / (b.y - a.y) + a.x) inside = !inside;
  }
  return inside;
}

/* ── What the page asks of a drawing before it draws it ─────────────────── */

const layouts = new WeakMap<FrameDrawing, Map<string, Layout>>();
/** `frameLayout`, kept for the drawing it was made of: the page asks for the same layout twice (to draw it and to know whether to offer a switch). */
export function layoutFor(drawing: FrameDrawing, o: LayoutOptions): Layout {
  if (o.probe) return frameLayout(drawing, o);
  const key = JSON.stringify([o.width, o.mode, o.loads, o.reactions, o.values, o.nodeNumbers, o.memberNumbers, o.amp, o.group, o.flagged ?? null, o.maxHeight ?? null, o.fontSize ?? null, o.displacements ?? null]);
  let held = layouts.get(drawing);
  if (!held) layouts.set(drawing, (held = new Map()));
  const found = held.get(key);
  if (found) return found;
  const made = frameLayout(drawing, o);
  if (held.size >= 24) held.clear();
  held.set(key, made);
  return made;
}

/**
 * The width that "Show every value" draws the frame at: the column's own (`base`) when every word already has a place, else the
 * least width, up to 6,000 px, at which every word fits at the smallest size. `complete` is whether that was found: a drawing that
 * is not wider for being wider (a tall frame) or that no width suits is left as it is (`width` is `base`, `complete` false).
 */
export function everyWidth(drawing: FrameDrawing, o: Looks, base: number): { width: number; complete: boolean } {
  const at = (width: number, extra: Partial<LayoutOptions> = {}) => ({ ...o, width, ...extra });
  const first = layoutFor(drawing, at(base));
  if (first.thinned === 0) return { width: base, complete: false };
  if (!first.widthBound) return { width: base, complete: false };
  const smallest = SIZES[SIZES.length - 1];
  const fits = (width: number) => frameLayout(drawing, at(width, { fontSize: smallest, probe: true })).thinned === 0;
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

/** How many words the drawing, as drawn at the column's width, leaves off, and whether widening it would put them all on (`every`: only then is the switch offered). */
export function drawingFacts(drawing: FrameDrawing, o: Looks, avail: number): { omitted: number; every: boolean } {
  const omitted = layoutFor(drawing, { ...o, width: avail }).thinned;
  return { omitted, every: omitted > 0 && everyWidth(drawing, o, avail).complete };
}
