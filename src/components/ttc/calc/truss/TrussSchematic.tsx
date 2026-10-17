'use client';

import React, { useMemo } from 'react';
import { formatNumber } from '@/lib/calc/format';
import type { DrawingArrow, DrawingMember, MemberState, TrussDrawing } from '@/lib/calc/truss/analysis';
import type { TrussUi } from '@/lib/calc/truss/strings';
import { fill, signed } from './text';

/**
 * The truss as entered and — once solved — as it carries its load: members
 * coloured and weighted by their force, the nodes with their numbers, the
 * supports, the loads and the reactions with their sizes, and on request the
 * deformed shape.
 *
 * It is given a `TrussDrawing` (lib/calc/truss/analysis.ts) and knows nothing of
 * the form or of the engine; the drawing is built even when the truss cannot be
 * solved (then the members have no force and are drawn plain, and nodes that
 * are part of a problem can be ringed).
 *
 * WHAT IS RECKONED AND WHAT IS DRAWN are two functions. `trussLayout` is
 * arithmetic from end to end: where every line, symbol, arrow and number goes,
 * in pixels. `TrussSchematic` writes what it returns as SVG and adds nothing of
 * its own, so the layout is held to its rules without React
 * (truss-schematic.test.ts), and it is kept from one draw to the next
 * (`useMemo`).
 *
 * THE WORDS ARE KEPT CLEAR. Every number written on the drawing — a force on a
 * member, a load, a reaction, a displaced node's number — is put where it
 * touches no line, no node, no support, no arrow and no other number. For each
 * member the layout tries the middle of the member and then the places along it,
 * on one side and on the other, the largest force first; a number that finds no
 * clear place is NOT written on the drawing (`MemberShape.text` is null and the
 * drawing says how many were left out): it is in the table, and it is written
 * on the drawing the moment its member is picked (`MemberShape.spare` is where).
 * A load and a reaction are always written: they search outwards from their
 * arrow until a place is clear. Nothing is ever drawn on a line "because there
 * was no room".
 *
 * ROOM. A truss with short members (a dense one, with many panels) is drawn
 * wider than the column that holds it (`wantedWidth`: the shortest panel at least
 * a label and a margin wide, up to four times the column and 2,600 px), and the
 * column scrolls sideways; on paper, which cannot scroll, the labels are
 * thinned instead. The margins round the truss are pixels, not a share of the
 * truss, so a very flat truss is not given a drawing as tall as it is long and a
 * very tall one is not made wider than it is.
 *
 * THE SIZE OF THE NUMBERS. A number on a member is set at 11 px; when a dense
 * truss has no room for them all at that size they are set smaller, in steps
 * (11, 10, 9, 8 px), the largest size at which every one finds a clear place -
 * one size for the whole drawing, so that it stays uniform. Only when even 8 px
 * leaves some without a place are those left off (the lightest forces; the
 * count is stated). `everyWidth` is the width at which all of them fit at 8 px:
 * the switch "Show every force" draws the truss that wide.
 *
 * A VERY FLAT (or very tall) TRUSS is drawn true to scale unless the visitor asks
 * for `stretch`: its heights (or widths) are then drawn N times larger. Only the
 * node positions and the member lines are stretched; every mark (supports,
 * arrows, circles, numbers) is built in pixels and is not, and the drawing says
 * that its angles are not true.
 *
 * TENSION AND COMPRESSION ARE TOLD APART BY THREE THINGS, so that it works on a
 * black-and-white sheet and for a reader who does not see colour: the COLOUR
 * (blue for tension, red for compression), the PATTERN (a tension is a solid
 * line, a compression a hollow one — an outline with the page showing through
 * the middle, always at least 2 px of it, however small the force) and the SIGN
 * written with the value (+ and −). A member with no force is a thin dashed grey
 * line. The weight of a line follows the size of its force, to the largest of
 * the truss.
 *
 * SUPPORTS. A pin is a triangle with its apex on the node; a roller is a smaller
 * triangle on two wheels. Both stand on a ground line, on the side of the node
 * away from the members (a pin) or against the line of action (a roller:
 * a roller whose reaction is vertical stands under its node, one against a wall
 * stands beside it, an inclined one is drawn at its angle). The reaction is an
 * arrow beyond the symbol, on the same side, with its size beside it.
 *
 * LOADS are arrows whose head touches the node, with the size at the tail.
 *
 * THE DEFORMED SHAPE is the members drawn between the displaced nodes, in a
 * dash-dot line of its own, with each displaced node marked by a diamond and
 * its number, and the displacements multiplied by `drawing.deformScale` (the
 * legend states by how much).
 *
 * A drawing of the visitor's own data: every number on it is in the tables
 * beside it too, so the SVG is described in one sentence (`summary`) and its
 * shapes are hidden from a screen reader. The pointer, though, can pick a
 * member out of it (hover, press), which marks the same member in the tables;
 * the tables carry the way for a keyboard.
 */

/** Pixel sizes at full scale; `k` (0.9 to 1) takes them down when the margin round the truss is narrow. */
const PIN_DEPTH = 22;
const ROLLER_DEPTH = 24;
const GAP = 3;
const LOAD_MIN = 16;
const LOAD_SPAN = 18;
const REACTION_LEN = 22;
const HEAD_LEN = 8;
const HEAD_HALF = 3.6;
const MAX_HEIGHT = 560;
/** One character of the 11 px mono the numbers are set in, and a line of it. */
const CHAR = 6.6;
const LABEL_H = 13;
const TAG_CHAR = 5.8;
const TAG_H = 11;
/** The narrowest a panel may be drawn, between two columns of nodes, and the most the drawing widens for it. */
const MIN_PITCH = 54;
const MAX_ZOOM = 4;
const MAX_DRAWN = 2600;
/** Room kept clear round a label, from a line / a box / another label. */
const FROM_LINE = 1.5;
const FROM_BOX = 1.5;
const FROM_LABEL = 2.5;
/** The sizes (px) a member's number is tried at, the largest first; 11 is the size the CSS sets. */
export const SIZES = [11, 10, 9, 8] as const;
const BASE_SIZE = 11;
/** The widest "Show every force" draws, in pixels. */
const EVERY_MAX = 6000;
/** A truss wider than this many times its height (or taller than this many times its width) is offered a stretch. */
export const FLAT_RATIO = 8;
export const TALL_RATIO = 3;
/** The clean multipliers, and the share of the drawing's long side the short side should reach with one. */
const STRETCH_STEPS = [2, 3, 4, 5, 6, 8, 10];
const STRETCH_TARGET = 0.2;

export type Point = { x: number; y: number };
export type Rect = { x0: number; y0: number; x1: number; y1: number };
type Seg = { x1: number; y1: number; x2: number; y2: number; pad: number };

/** Which way the drawing is stretched, and by how many times: heights (a flat truss) or widths (a tall one). */
export interface Stretch {
  axis: 'heights' | 'widths';
  n: number;
}

export interface LayoutOptions {
  /** The drawing's width in pixels. */
  width: number;
  /** The value written on each member. */
  forces: boolean;
  /** The member's number written on it. */
  numbers: boolean;
  /** Draw the deformed shape (if the drawing has one). */
  deformed: boolean;
  /** What numbers are set apart with. */
  group: string;
  /** Nodes (labels) that are part of a problem: ringed. */
  flagged?: readonly number[];
  /** The tallest the drawing may be (px). */
  maxHeight?: number;
  /** Heights (or widths) drawn N times larger than the other: node positions and member lines only. */
  stretch?: Stretch | null;
  /** The size (px) the members' numbers are set at; without it, the largest of `SIZES` at which every one fits. */
  fontSize?: number;
  /** Stop at the first number that finds no place: only `thinned` of the result is to be trusted. */
  probe?: boolean;
}

/** Words on the drawing: where they are and where they are written. */
export interface LabelBox {
  value: string;
  x: number;
  y: number;
  anchor: 'start' | 'middle' | 'end';
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
  state: MemberState | null;
  /** The line's width, and for a compression the width of the page-coloured core that makes it hollow (never under 2 px). */
  strokeWidth: number;
  core: number | null;
  /** The text on the member: its force and/or its number; null when none, or when no clear place was found for it. */
  text: LabelBox | null;
  /** Where that text goes when its member is picked and it found no clear place: the least bad place. Null when there is `text` or none is wanted. */
  spare: LabelBox | null;
}

export interface NodeShape {
  label: number;
  x: number;
  y: number;
  r: number;
  flagged: boolean;
}

export interface SupportShape {
  node: number;
  kind: 'pin' | 'roller';
  x: number;
  y: number;
  /** Degrees to turn the symbol — drawn pointing down the page — to its place. */
  rotation: number;
  /** The unit vector, on the page (y down), from the node towards the ground the symbol stands on. */
  side: Point;
  /** How far from the node's centre the symbol reaches. */
  depth: number;
  /** A roller's line of action in degrees [0, 180); null for a pin. */
  angle: number | null;
  /** The box round the symbol, upright on the page. */
  box: Rect;
}

export interface ArrowShape {
  /** The label of the row it is of (load, or support). */
  label: number;
  node: number;
  /** Where the shaft starts and where the head's tip is. */
  tail: Point;
  tip: Point;
  /** The size written by it, and where. */
  text: LabelBox;
  magnitude: number;
}

export type LegendKey = 'tension' | 'compression' | 'zero' | 'unsolved' | 'load' | 'reaction' | 'node' | 'flagged' | 'deformed' | 'stretched';

export interface DeformedShape {
  members: { label: number; x1: number; y1: number; x2: number; y2: number }[];
  /** The nodes that moved far enough to see, at their displaced places, with their numbers where there was room. */
  nodes: { label: number; x: number; y: number; tag: LabelBox | null }[];
}

export interface Layout {
  width: number;
  height: number;
  /** Pixels per unit of length, true to scale; `scaleX` and `scaleY` are what was drawn (they differ when the drawing is stretched). */
  scale: number;
  scaleX: number;
  scaleY: number;
  /** The size (px) of the numbers on the members. */
  fontSize: number;
  /** The stretch drawn, if any. */
  stretch: Stretch | null;
  /** Whether the drawing's size follows its width: a wider drawing is then a larger one. False for a tall truss, whose size follows its height. */
  widthBound: boolean;
  members: MemberShape[];
  nodes: NodeShape[];
  supports: SupportShape[];
  loads: ArrowShape[];
  reactions: ArrowShape[];
  /** The deformed shape, in pixels; null when the drawing has no displacements or they are not asked for. */
  deformed: DeformedShape | null;
  /** How many times the displacements are multiplied; null when there is no deformed shape. */
  deformScale: number | null;
  legend: LegendKey[];
  /** How many members wanted a number written on them and have none, for want of a clear place. */
  thinned: number;
}

const clean = (v: number): number => {
  const r = Math.round(v * 1e6) / 1e6;
  return r === 0 ? 0 : r;
};

/** The sign of a force with its size: "+15", "−20", "0" — the same for the drawing and the tables. */
export const forceText = (v: number, group: string, significant = 4): string => signed(formatNumber(Math.abs(v), significant, group), v);

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
/** Whether the segment passes through the rectangle (Liang–Barsky). */
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
function segNear(s: Seg, r: Rect, extra: number): boolean {
  const lim = s.pad + extra;
  if (Math.max(s.x1, s.x2) < r.x0 - lim || Math.min(s.x1, s.x2) > r.x1 + lim || Math.max(s.y1, s.y2) < r.y0 - lim || Math.min(s.y1, s.y2) > r.y1 + lim) return false;
  if (segCrossesRect(s, r)) return true;
  if (distPointRect(s.x1, s.y1, r) < lim || distPointRect(s.x2, s.y2, r) < lim) return true;
  return distPointSeg(r.x0, r.y0, s) < lim || distPointSeg(r.x1, r.y0, s) < lim || distPointSeg(r.x1, r.y1, s) < lim || distPointSeg(r.x0, r.y1, s) < lim;
}
const rectsNear = (a: Rect, b: Rect, pad: number): boolean => a.x0 < b.x1 + pad && b.x0 < a.x1 + pad && a.y0 < b.y1 + pad && b.y0 < a.y1 + pad;

const boxOf = (x: number, y: number, hx: number, hy: number): Rect => ({ x0: x - hx, y0: y - hy, x1: x + hx, y1: y + hy });

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
/** A rectangle of w × h standing off a point, in a direction, by a gap. */
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

/** The characters a number takes: its exponent's caret and minus are one narrow glyph each, near enough. */
const widthOf = (value: string, char = CHAR, pad = 4): number => value.length * char + pad;

/**
 * Whether a truss is flat enough (width : height over 8) or tall enough (height : width over 3) to offer a stretched drawing,
 * and by how many times: the clean number (2, 3, 4, 5, 6, 8, 10) that brings the short side nearest a fifth of the long one.
 */
export function stretchOffer(drawing: TrussDrawing): Stretch | null {
  const { width, height } = drawing.box;
  // A truss on a line (all nodes level, or all upright) has no proportion to distort.
  if (!(width > 0) || !(height > 0)) return null;
  const flat = width / height > FLAT_RATIO;
  const tall = height / width > TALL_RATIO;
  if (!flat && !tall) return null;
  const ratio = flat ? width / height : height / width;
  const want = STRETCH_TARGET * ratio;
  let n = STRETCH_STEPS[0];
  for (const step of STRETCH_STEPS) if (Math.abs(Math.log(step / want)) < Math.abs(Math.log(n / want))) n = step;
  return { axis: flat ? 'heights' : 'widths', n };
}

/* ── The room a drawing wants ───────────────────────────────────────────── */

/** The margin round the truss, in pixels: room for the supports and reactions below it, the loads above it and the numbers beside both. */
const marginFor = (avail: number): number => Math.round(Math.max(54, Math.min(64, avail * 0.12)));

/**
 * How wide the drawing should be, in pixels, for a column `avail` wide: the
 * column's width, or wider — up to four times, and never over 2,600 px
 * — when the narrowest gap between two columns of nodes would otherwise be drawn
 * narrower than a number and a margin. The column then scrolls sideways. A
 * drawing with fewer than two columns of nodes is as wide as the column.
 */
export function wantedWidth(drawing: TrussDrawing, o: { forces: boolean; numbers: boolean; group: string }, avail: number): number {
  const xs = [...new Set(drawing.nodes.map((n) => n.x))].sort((a, b) => a - b);
  const box = drawing.box;
  let gap = Infinity;
  for (let i = 1; i < xs.length; i++) {
    const d = xs[i] - xs[i - 1];
    if (d > 1e-9 * Math.max(box.width, 1e-300)) gap = Math.min(gap, d);
  }
  if (!Number.isFinite(gap) || !(box.width > 0)) return avail;
  let chars = 0;
  for (const m of drawing.members) {
    const value = [o.numbers ? String(m.label) : '', o.forces && m.force !== null ? forceText(m.force, o.group) : ''].filter(Boolean).join(o.numbers && o.forces && m.force !== null ? ': ' : '');
    chars = Math.max(chars, value.length);
  }
  // A diagonal's number stands in the corner of its panel, clear of the verticals either side: the panel wants about 1.7 numbers' width.
  const pitch = Math.max(MIN_PITCH, chars * CHAR * 1.7 + 24);
  const need = (box.width * pitch) / gap + 2 * marginFor(avail);
  return Math.round(Math.max(avail, Math.min(need, avail * MAX_ZOOM, MAX_DRAWN)));
}

/* ── The layout ─────────────────────────────────────────────────────────── */

export function trussLayout(drawing: TrussDrawing, o: LayoutOptions): Layout {
  const box = drawing.box;
  const W = o.width;
  const maxHeight = o.maxHeight ?? MAX_HEIGHT;
  const M = marginFor(W);
  const k = Math.max(0.9, Math.min(1, M / 60));
  const side = Math.max(box.width, box.height);
  // A stretch multiplies the drawn height (or width) of the truss only: positions and lines, not the marks, which are pixels.
  const stretch = o.stretch && o.stretch.n > 1 && side > 0 ? o.stretch : null;
  const ax = stretch?.axis === 'widths' ? stretch.n : 1;
  const ay = stretch?.axis === 'heights' ? stretch.n : 1;
  const sx = box.width > 0 ? (W - 2 * M) / (box.width * ax) : Infinity;
  const sy = box.height > 0 ? (maxHeight - 2 * M) / (box.height * ay) : Infinity;
  const scale = side > 0 ? Math.max(1e-9, Math.min(sx, sy)) : 1;
  const scaleX = scale * ax;
  const scaleY = scale * ay;
  const drawnW = box.width * scaleX;
  const offX = (W - drawnW) / 2;
  const H = clean(box.height * scaleY + 2 * M);
  const X = (x: number) => offX + (x - box.x0) * scaleX;
  const Y = (y: number) => M + (box.y1 - y) * scaleY;
  const r = clean(6 + 2 * k);
  const flagged = new Set(o.flagged ?? []);
  const inside = (rect: Rect) => rect.x0 >= 3 && rect.x1 <= W - 3 && rect.y0 >= 3 && rect.y1 <= H - 3;

  const byLabel = new Map(drawing.nodes.map((n) => [n.label, n]));
  const at = (label: number): Point => {
    const n = byLabel.get(label)!;
    return { x: X(n.x), y: Y(n.y) };
  };

  /* Members. */
  const members: MemberShape[] = drawing.members.map((m: DrawingMember) => {
    const a = { x: clean(X(m.x1)), y: clean(Y(m.y1)) };
    const b = { x: clean(X(m.x2)), y: clean(Y(m.y2)) };
    const state = m.state;
    // A hollow line needs a page-coloured core at least 2 px wide and a wall of 1.5 px each side of it, whatever the force.
    const strokeWidth = state === null ? 2.5 : state === 'zero' ? 1.5 : clean(5 + 4 * m.weight);
    const core = state === 'compression' ? clean(strokeWidth - 3) : null;
    return { label: m.label, i: m.i, j: m.j, x1: a.x, y1: a.y, x2: b.x, y2: b.y, state, strokeWidth, core, text: null, spare: null };
  });
  const nodes: NodeShape[] = drawing.nodes.map((n) => ({ label: n.label, x: clean(X(n.x)), y: clean(Y(n.y)), r, flagged: flagged.has(n.label) }));

  /* Supports: which side of its node each stands on. */
  const around = (label: number): Point[] =>
    drawing.members.flatMap((m) => {
      const other = m.i === label ? m.j : m.j === label ? m.i : 0;
      if (!other || !byLabel.has(other)) return [];
      const p = at(label);
      const q = at(other);
      const len = Math.hypot(q.x - p.x, q.y - p.y);
      return len > 0 ? [{ x: (q.x - p.x) / len, y: (q.y - p.y) / len }] : [];
    });
  const PIN_SIDES: Point[] = [
    { x: 0, y: 1 }, // down the page
    { x: -1, y: 0 },
    { x: 1, y: 0 },
    { x: 0, y: -1 },
  ];
  const supports: SupportShape[] = drawing.nodes.flatMap((n) => {
    if (!n.support) return [];
    const p = at(n.label);
    let sd: Point;
    if (n.support.kind === 'roller' && n.support.angle !== null) {
      const a = (n.support.angle * Math.PI) / 180;
      // The ground is against the line of action: the reaction pushes the truss away from it.
      sd = { x: clean(-Math.cos(a)), y: clean(Math.sin(a)) };
    } else {
      const towards = around(n.label);
      const clearance = (s: Point) => Math.max(-1, ...towards.map((t) => t.x * s.x + t.y * s.y));
      sd = PIN_SIDES.find((s) => clearance(s) < 0.5) ?? PIN_SIDES.reduce((best, s) => (clearance(s) < clearance(best) ? s : best));
    }
    const rotation = clean((Math.atan2(-sd.x, sd.y) * 180) / Math.PI);
    const depth = clean((n.support.kind === 'pin' ? PIN_DEPTH : ROLLER_DEPTH) * k);
    // The symbol is drawn pointing down from its node and turned by `rotation`: its upright box is the box of its four corners.
    const hw = ((n.support.kind === 'pin' ? 11 : 9) + 4) * k + 1;
    const th = (rotation * Math.PI) / 180;
    const corners = [
      [-hw, -1],
      [hw, -1],
      [hw, depth + 1],
      [-hw, depth + 1],
    ].map(([px, py]) => ({ x: p.x + px * Math.cos(th) - py * Math.sin(th), y: p.y + px * Math.sin(th) + py * Math.cos(th) }));
    const sbox: Rect = { x0: Math.min(...corners.map((c) => c.x)), y0: Math.min(...corners.map((c) => c.y)), x1: Math.max(...corners.map((c) => c.x)), y1: Math.max(...corners.map((c) => c.y)) };
    return [{ node: n.label, kind: n.support.kind, x: clean(p.x), y: clean(p.y), rotation, side: sd, depth, angle: n.support.angle, box: { x0: clean(sbox.x0), y0: clean(sbox.y0), x1: clean(sbox.x1), y1: clean(sbox.y1) } }];
  });
  const supportAt = new Map(supports.map((s) => [s.node, s]));

  /* Arrows, without their words yet. */
  type Bare = { label: number; node: number; tail: Point; tip: Point; magnitude: number; value: string; away: Point };
  const loadsBare: Bare[] = drawing.loads.map((a: DrawingArrow) => {
    const p = at(a.node);
    const dir = { x: a.dx, y: -a.dy };
    const len = (LOAD_MIN + LOAD_SPAN * a.share) * k;
    const tip = { x: clean(p.x - dir.x * (r + 1)), y: clean(p.y - dir.y * (r + 1)) };
    const tail = { x: clean(tip.x - dir.x * len), y: clean(tip.y - dir.y * len) };
    return { label: a.label, node: a.node, tail, tip, magnitude: a.magnitude, value: formatNumber(a.magnitude, 4, o.group), away: { x: -dir.x, y: -dir.y } };
  });
  const reactionsBare: Bare[] = drawing.reactions.map((a: DrawingArrow) => {
    const p = at(a.node);
    const s = supportAt.get(a.node);
    const sd = s?.side ?? { x: 0, y: 1 };
    const depth = s?.depth ?? PIN_DEPTH * k;
    const dir = { x: a.dx, y: -a.dy };
    const len = REACTION_LEN * k;
    const start = { x: p.x + sd.x * (depth + GAP * k), y: p.y + sd.y * (depth + GAP * k) };
    const towardsNode = dir.x * sd.x + dir.y * sd.y < 0;
    const tip = towardsNode ? start : { x: start.x + dir.x * len, y: start.y + dir.y * len };
    const tail = towardsNode ? { x: start.x - dir.x * len, y: start.y - dir.y * len } : start;
    // The size stands beside the shaft, on the right of it, or under it when it runs across the page.
    let n = { x: dir.y, y: -dir.x };
    if (Math.abs(n.x) < 0.1 ? n.y < 0 : n.x < 0) n = { x: -n.x, y: -n.y };
    return { label: a.label, node: a.node, tail: { x: clean(tail.x), y: clean(tail.y) }, tip: { x: clean(tip.x), y: clean(tip.y) }, magnitude: a.magnitude, value: formatNumber(a.magnitude, 4, o.group), away: n };
  });

  /* The deformed shape, in pixels (its words come after). */
  const s = drawing.deformScale;
  let deformedLines: { label: number; x1: number; y1: number; x2: number; y2: number }[] | null = null;
  const movedAt = new Map<number, Point>();
  if (o.deformed && s !== null && drawing.nodes.some((n) => n.ux !== null)) {
    // The displacement is drawn at the true scale (the legend states how many times larger it is), from the node's drawn place.
    for (const n of drawing.nodes) if (n.ux !== null && n.uy !== null) movedAt.set(n.label, { x: clean(X(n.x) + n.ux * s * scale), y: clean(Y(n.y) - n.uy * s * scale) });
    deformedLines = drawing.members.flatMap((m) => {
      const a = movedAt.get(m.i);
      const b = movedAt.get(m.j);
      return a && b ? [{ label: m.label, x1: a.x, y1: a.y, x2: b.x, y2: b.y }] : [];
    });
  }

  /* ── What the words are kept clear of ── */
  const segs: Seg[] = [];
  const boxes: Rect[] = [];
  for (const m of members) segs.push({ x1: m.x1, y1: m.y1, x2: m.x2, y2: m.y2, pad: m.strokeWidth / 2 });
  for (const n of nodes) boxes.push(boxOf(n.x, n.y, n.r + (n.flagged ? 4 : 0) + 0.75, n.r + (n.flagged ? 4 : 0) + 0.75));
  for (const sp of supports) boxes.push(sp.box);
  const arrowObstacle = (a: Bare) => {
    const dx = a.tip.x - a.tail.x;
    const dy = a.tip.y - a.tail.y;
    const len = Math.hypot(dx, dy) || 1;
    segs.push({ x1: a.tail.x, y1: a.tail.y, x2: a.tip.x, y2: a.tip.y, pad: 1.5 });
    // The head: its box.
    const bx = a.tip.x - (dx / len) * HEAD_LEN;
    const by = a.tip.y - (dy / len) * HEAD_LEN;
    boxes.push({ x0: Math.min(a.tip.x, bx) - HEAD_HALF, y0: Math.min(a.tip.y, by) - HEAD_HALF, x1: Math.max(a.tip.x, bx) + HEAD_HALF, y1: Math.max(a.tip.y, by) + HEAD_HALF });
  };
  for (const a of loadsBare) arrowObstacle(a);
  for (const a of reactionsBare) arrowObstacle(a);
  if (deformedLines) for (const d of deformedLines) segs.push({ x1: d.x1, y1: d.y1, x2: d.x2, y2: d.y2, pad: 1 });
  // The nodes that moved far enough to see: marked with a diamond.
  const displaced: number[] = [];
  if (deformedLines) {
    for (const n of drawing.nodes) {
      const mv = movedAt.get(n.label);
      const home = at(n.label);
      if (mv && Math.hypot(mv.x - home.x, mv.y - home.y) >= 2.5) {
        displaced.push(n.label);
        boxes.push(boxOf(mv.x, mv.y, 5, 5));
      }
    }
  }

  /* ── The words ── */
  const placed: Rect[] = [];
  /** How many things a rectangle touches: 0 is clear. `ceiling` stops the count early once it cannot win. */
  const touches = (rect: Rect, ceiling = Infinity): number => {
    let hits = inside(rect) ? 0 : 1000;
    if (hits >= ceiling) return hits;
    for (const sg of segs) {
      if (segNear(sg, rect, FROM_LINE)) hits++;
      if (hits >= ceiling) return hits;
    }
    for (const b of boxes) {
      if (rectsNear(rect, b, FROM_BOX)) hits++;
      if (hits >= ceiling) return hits;
    }
    for (const p of placed) {
      if (rectsNear(rect, p, FROM_LABEL)) hits++;
      if (hits >= ceiling) return hits;
    }
    return hits;
  };
  /** Searches outwards from a point for a clear place, preferring the directions nearest `prefer`; the least bad one when none is clear. */
  const around2 = (p: Point, prefer: Point, w: number, h: number, gaps = GAPS): { rect: Rect; hits: number } => {
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
  const wordFor = (a: Bare, anchor: Point, prefer: Point): ArrowShape => {
    const w = widthOf(a.value);
    const found = around2(anchor, prefer, w, LABEL_H);
    placed.push(found.rect);
    return { label: a.label, node: a.node, tail: a.tail, tip: a.tip, text: labelAt(a.value, found.rect), magnitude: a.magnitude };
  };
  // Loads: beyond the tail, along the line the arrow comes from. Reactions: beside the middle of the shaft.
  const loads: ArrowShape[] = loadsBare.map((a) => wordFor(a, a.tail, a.away));
  const reactions: ArrowShape[] = reactionsBare.map((a) => wordFor(a, { x: (a.tail.x + a.tip.x) / 2, y: (a.tail.y + a.tip.y) / 2 }, a.away));

  /* The members' words: the largest force first, each along its member and on one side or the other. */
  const wanted = members
    .map((m, index) => {
      const src = drawing.members[index];
      const value = [o.numbers ? String(m.label) : '', o.forces && src.force !== null ? forceText(src.force, o.group) : ''].filter(Boolean).join(o.numbers && o.forces && src.force !== null ? ': ' : '');
      return { m, index, value, weight: src.weight, length: Math.hypot(m.x2 - m.x1, m.y2 - m.y1) };
    })
    .filter((w) => w.value !== '');
  wanted.sort((p, q) => q.weight - p.weight || q.length - p.length || p.index - q.index);
  const ALONG = [0.5, 0.36, 0.64, 0.24, 0.76, 0.14, 0.86];
  const keptPlaced = placed.length;
  /** Places the members' words at a size (px); returns how many found no clear place. The words that did are left in `placed`. */
  const placeWords = (size: number, probe: boolean): number => {
    const f = size / BASE_SIZE;
    const labelH = LABEL_H * f;
    placed.length = keptPlaced;
    for (const mm of members) {
      mm.text = null;
      mm.spare = null;
    }
    let left = 0;
    for (const { m, index, value, length } of wanted) {
      const w = widthOf(value, CHAR * f, 4 * f);
      const len = length || 1;
      const d = { x: (m.x2 - m.x1) / len, y: (m.y2 - m.y1) / len };
      const vertical = Math.abs(d.x) < 0.05;
      // The side the number prefers: above a member, to the right of an upright one.
      let n = { x: d.y, y: -d.x };
      if (vertical ? n.x < 0 : n.y > 0) n = { x: -n.x, y: -n.y };
      // How far from the member's axis a w x h box must stand to clear its line: half the box's extent across it, and the line's half width.
      const ext = Math.abs(n.x) * (w / 2) + Math.abs(n.y) * (labelH / 2);
      const off = m.strokeWidth / 2 + 3 + ext;
      let best: { rect: Rect; hits: number } | null = null;
      for (const t of ALONG) {
        const px = m.x1 + (m.x2 - m.x1) * t;
        const py = m.y1 + (m.y2 - m.y1) * t;
        for (const sgn of [1, -1]) {
          const cx = px + n.x * sgn * off;
          const cy = py + n.y * sgn * off;
          const rect = boxOf(cx, cy, w / 2, labelH / 2);
          const hits = touches(rect, best ? best.hits : Infinity);
          if (!best || hits < best.hits) best = { rect, hits };
          if (hits === 0) break;
        }
        if (best && best.hits === 0) break;
      }
      if (best && best.hits === 0) {
        placed.push(best.rect);
        members[index].text = labelAt(value, best.rect, f);
      } else {
        left++;
        if (probe) return left;
        if (best) members[index].spare = labelAt(value, best.rect, f);
      }
    }
    return left;
  };
  // One size for the whole drawing: the largest at which every number has a clear place; failing that, the size that leaves the fewest off.
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
    thinned = bestLeft;
    if (lastTried !== fontSize) placeWords(fontSize, false);
  }

  /* The deformed shape's words: each displaced node's number beside its diamond, the most displaced first. */
  let deformed: DeformedShape | null = null;
  if (deformedLines) {
    const shown = displaced
      .map((label) => ({ label, p: movedAt.get(label)!, home: at(label), off: Math.hypot(movedAt.get(label)!.x - at(label).x, movedAt.get(label)!.y - at(label).y) }))
      .sort((a, b) => b.off - a.off || a.label - b.label);
    const tagged = new Map<number, LabelBox | null>();
    for (const nd of shown) {
      const value = String(nd.label);
      const w = widthOf(value, TAG_CHAR, 3);
      // The tag stands on the side the node moved to.
      const away = { x: nd.p.x - nd.home.x, y: nd.p.y - nd.home.y };
      const found = around2(nd.p, away, w, TAG_H, [6, 10, 16, 24]);
      if (found.hits === 0) {
        placed.push(found.rect);
        tagged.set(nd.label, { value, x: clean((found.rect.x0 + found.rect.x1) / 2), y: clean(found.rect.y1 - 2.5), anchor: 'middle', rect: found.rect });
      } else tagged.set(nd.label, null);
    }
    deformed = { members: deformedLines, nodes: shown.sort((a, b) => a.label - b.label).map((nd) => ({ label: nd.label, x: nd.p.x, y: nd.p.y, tag: tagged.get(nd.label) ?? null })) };
  }

  /* What the legend has to explain. */
  const solved = drawing.members.some((m) => m.state !== null);
  const has = (state: MemberState) => drawing.members.some((m) => m.state === state);
  const legend: LegendKey[] = [];
  if (solved) {
    if (has('tension')) legend.push('tension');
    if (has('compression')) legend.push('compression');
    if (has('zero')) legend.push('zero');
  } else if (drawing.members.length > 0) legend.push('unsolved');
  if (drawing.loads.length > 0) legend.push('load');
  if (drawing.reactions.length > 0) legend.push('reaction');
  if (drawing.nodes.length > 0) legend.push('node');
  if (nodes.some((n) => n.flagged)) legend.push('flagged');
  if (deformed) legend.push('deformed');
  if (stretch) legend.push('stretched');

  return { width: W, height: H, scale: clean(scale), scaleX: clean(scaleX), scaleY: clean(scaleY), fontSize, stretch, widthBound: sx <= sy, members, nodes, supports, loads, reactions, deformed, deformScale: deformed ? s : null, legend, thinned };
}

/* ── What the page asks of a drawing before it draws it ─────────────────── */

const layouts = new WeakMap<TrussDrawing, Map<string, Layout>>();
/** `trussLayout`, kept for the drawing it was made of: the page asks for the same layout twice (to draw it and to know whether to offer a switch). */
export function layoutFor(drawing: TrussDrawing, o: LayoutOptions): Layout {
  if (o.probe) return trussLayout(drawing, o);
  const key = JSON.stringify([o.width, o.forces, o.numbers, o.deformed, o.group, o.flagged ?? null, o.maxHeight ?? null, o.stretch ?? null, o.fontSize ?? null]);
  let held = layouts.get(drawing);
  if (!held) layouts.set(drawing, (held = new Map()));
  const found = held.get(key);
  if (found) return found;
  const made = trussLayout(drawing, o);
  if (held.size >= 24) held.clear();
  held.set(key, made);
  return made;
}

export interface Looks {
  forces: boolean;
  numbers: boolean;
  deformed: boolean;
  group: string;
  flagged?: readonly number[];
  stretch?: Stretch | null;
}

/**
 * The width that "Show every force" draws the truss at: the column's own (`base`, from `wantedWidth`) when every number
 * already has a place, else the least width, up to 6,000 px, at which every number fits at the smallest size. `complete` is
 * whether that was found: a drawing that is not wider for being wider (a tall truss) or that no width suits is left as it is
 * (`width` is `base`, `complete` false), and then there is nothing to offer.
 */
export function everyWidth(drawing: TrussDrawing, o: Looks, base: number): { width: number; complete: boolean } {
  const at = (width: number, extra: Partial<LayoutOptions> = {}) => ({ ...o, width, ...extra });
  const first = layoutFor(drawing, at(base));
  if (first.thinned === 0) return { width: base, complete: false };
  if (!first.widthBound) return { width: base, complete: false };
  const smallest = SIZES[SIZES.length - 1];
  const fits = (width: number) => trussLayout(drawing, at(width, { fontSize: smallest, probe: true })).thinned === 0;
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
 * What the page needs to know to offer its switches: the stretch the truss may be offered (null when its proportions are
 * ordinary), how many numbers the drawing, as it is drawn without "Show every force", leaves off, and whether widening it
 * would put them all on (`every`: only then is the switch offered).
 */
export function drawingFacts(drawing: TrussDrawing, o: Looks, avail: number, widen: boolean): { offer: Stretch | null; omitted: number; every: boolean } {
  const offer = stretchOffer(drawing);
  const drawn = widen ? wantedWidth(drawing, o, avail) : avail;
  const omitted = layoutFor(drawing, { ...o, width: drawn }).thinned;
  return { offer, omitted, every: widen && omitted > 0 && everyWidth(drawing, o, drawn).complete };
}

/** Whether the drawing has a deformed shape to offer at all. */
export const canDeform = (drawing: TrussDrawing): boolean => drawing.deformScale !== null && drawing.nodes.some((n) => n.ux !== null);

/* ── Drawing ────────────────────────────────────────────────────────────── */

function Arrow({ a, className }: { a: ArrowShape; className: string }) {
  const dx = a.tip.x - a.tail.x;
  const dy = a.tip.y - a.tail.y;
  const len = Math.hypot(dx, dy) || 1;
  const u = { x: dx / len, y: dy / len };
  const base = { x: a.tip.x - u.x * HEAD_LEN, y: a.tip.y - u.y * HEAD_LEN };
  const head = `${a.tip.x},${a.tip.y} ${base.x - u.y * HEAD_HALF},${base.y + u.x * HEAD_HALF} ${base.x + u.y * HEAD_HALF},${base.y - u.x * HEAD_HALF}`;
  return (
    <g className={className}>
      <line x1={a.tail.x} y1={a.tail.y} x2={base.x} y2={base.y} />
      <polygon points={head} />
      <text x={a.text.x} y={a.text.y} textAnchor={a.text.anchor}>
        {a.text.value}
      </text>
    </g>
  );
}

/** A support symbol, drawn pointing down the page from the origin and turned to its side. */
function SupportSymbol({ s }: { s: SupportShape }) {
  const d = s.depth;
  const k = d / (s.kind === 'pin' ? PIN_DEPTH : ROLLER_DEPTH);
  const half = (s.kind === 'pin' ? 11 : 9) * k;
  const ground = d;
  return (
    <g className={`mp-truss-fig__support mp-truss-fig__support--${s.kind}`} transform={`translate(${s.x} ${s.y}) rotate(${s.rotation})`}>
      {s.kind === 'pin' ? (
        <>
          <polygon points={`0,0 ${-half},${20 * k} ${half},${20 * k}`} />
          <line className="mp-truss-fig__ground" x1={-half - 4 * k} y1={ground} x2={half + 4 * k} y2={ground} />
        </>
      ) : (
        <>
          <polygon points={`0,0 ${-half},${15 * k} ${half},${15 * k}`} />
          <circle cx={-4.5 * k} cy={19.2 * k} r={3.4 * k} />
          <circle cx={4.5 * k} cy={19.2 * k} r={3.4 * k} />
          <line className="mp-truss-fig__ground" x1={-half - 4 * k} y1={ground} x2={half + 4 * k} y2={ground} />
        </>
      )}
    </g>
  );
}

/** What the drawing says about itself, beside the legend: the words are the page's. */
export interface DrawingNotes {
  /** {count} labels left off the drawing; pick a member, or read the table. */
  thinned: string;
  /** The drawing is wider than its column: scroll sideways. */
  scroll: string;
  /** The name of the scrolling region, for a screen reader. */
  region: string;
  /** The same as `thinned`, for paper: nothing to pick. */
  thinnedPaper: string;
  /** The drawing was widened by "Show every force". */
  every: string;
  /** Heights (or widths) are drawn {n} times larger: angles are not true. */
  stretchedHeights: string;
  stretchedWidths: string;
}

export interface TrussSchematicProps {
  drawing: TrussDrawing;
  /** The width of the column that holds the drawing; the drawing is wider when its panels would otherwise be crowded (`wantedWidth`). */
  width: number;
  /** False on paper, which cannot scroll: the drawing is then exactly `width`. */
  widen?: boolean;
  /** On paper: the notes do not tell the reader to pick a member. */
  paper?: boolean;
  /** Draw the heights (or widths) larger, when the truss is flat (or tall) enough to be offered it. */
  stretch?: boolean;
  /** Widen the drawing until every force is written on it. */
  every?: boolean;
  forces: boolean;
  numbers: boolean;
  deformed: boolean;
  /** Nodes with a problem: ringed. */
  flagged?: readonly number[];
  /** What numbers are set apart with. */
  group: string;
  /** The drawing in one sentence, for whoever cannot see it. */
  summary: string;
  /** The member the pointer or the tables are on (label), and the one picked. */
  active?: number | null;
  onActive?: (label: number | null) => void;
  onPick?: (label: number) => void;
  /** The legend's words. */
  legend: TrussUi['results']['legend'];
  /** The words about the drawing itself. */
  notes?: DrawingNotes;
  /** Where the drawing starts, for a link that jumps to it. */
  id?: string;
}

export function TrussSchematic({ drawing, width, widen = true, paper = false, stretch: stretched = false, every = false, forces, numbers, deformed, flagged, group, summary, active = null, onActive, onPick, legend: words, notes, id }: TrussSchematicProps) {
  const offer = useMemo(() => stretchOffer(drawing), [drawing]);
  const applied = stretched ? offer : null;
  const { drawn, layout, widened } = useMemo(() => {
    const looks: Looks = { forces, numbers, deformed, group, flagged, stretch: applied };
    const basic = widen ? wantedWidth(drawing, looks, width) : width;
    const wide = widen && every ? everyWidth(drawing, looks, basic).width : basic;
    return { drawn: wide, widened: wide > basic, layout: layoutFor(drawing, { ...looks, width: wide }) };
  }, [drawing, width, widen, every, forces, numbers, deformed, group, flagged, applied]);
  const ends = active === null ? null : layout.members.find((m) => m.label === active);
  const mouse = (label: number | null) => (e: React.PointerEvent) => {
    if (e.pointerType === 'mouse' || label === null) onActive?.(label);
  };
  const wide = drawn > width;
  const thinnedNote = notes && layout.thinned > 0 ? fill(paper ? notes.thinnedPaper : notes.thinned, { count: layout.thinned }) : '';
  const stretchNote = notes && layout.stretch ? fill(layout.stretch.axis === 'heights' ? notes.stretchedHeights : notes.stretchedWidths, { n: layout.stretch.n }) : '';
  return (
    <figure className="mp-truss-fig mp-truss__target" id={id} tabIndex={id ? -1 : undefined}>
      <div className={wide ? 'mp-truss-fig__scroll mp-truss-fig__scroll--wide' : 'mp-truss-fig__scroll'} role={wide ? 'group' : undefined} aria-label={wide ? notes?.region : undefined} tabIndex={wide ? 0 : undefined}>
        <svg className="mp-plot__svg mp-truss-fig__svg" role="img" aria-label={summary} viewBox={`0 0 ${layout.width} ${layout.height}`} width={layout.width} height={layout.height}>
          <g aria-hidden="true">
            {ends ? <line className="mp-truss-fig__halo" x1={ends.x1} y1={ends.y1} x2={ends.x2} y2={ends.y2} strokeWidth={ends.strokeWidth + 9} /> : null}
            {layout.deformed
              ? layout.deformed.members.map((m) => <line key={`d${m.label}`} className="mp-truss-fig__deformed" x1={m.x1} y1={m.y1} x2={m.x2} y2={m.y2} />)
              : null}
            {layout.supports.map((s) => (
              <SupportSymbol key={`s${s.node}`} s={s} />
            ))}
            {layout.members.map((m) => (
              <g key={`m${m.label}`} className={`mp-truss-fig__member mp-truss-fig__member--${m.state ?? 'plain'}${active === m.label ? ' mp-truss-fig__member--active' : ''}`} data-member={m.label}>
                <line className="mp-truss-fig__bar" x1={m.x1} y1={m.y1} x2={m.x2} y2={m.y2} strokeWidth={m.strokeWidth} />
                {m.core !== null ? <line className="mp-truss-fig__core" x1={m.x1} y1={m.y1} x2={m.x2} y2={m.y2} strokeWidth={m.core} /> : null}
              </g>
            ))}
            {layout.loads.map((a) => (
              <Arrow key={`l${a.label}`} a={a} className="mp-truss-fig__load" />
            ))}
            {layout.reactions.map((a) => (
              <Arrow key={`r${a.label}`} a={a} className="mp-truss-fig__reaction" />
            ))}
            {layout.deformed
              ? layout.deformed.nodes.map((n) => (
                  <g key={`dn${n.label}`} className="mp-truss-fig__moved">
                    <rect x={n.x - 3.5} y={n.y - 3.5} width="7" height="7" transform={`rotate(45 ${n.x} ${n.y})`} />
                    {n.tag ? (
                      <text x={n.tag.x} y={n.tag.y} textAnchor={n.tag.anchor}>
                        {n.tag.value}
                      </text>
                    ) : null}
                  </g>
                ))
              : null}
            {layout.members.map((m) => {
              const text = m.text ?? (active === m.label ? m.spare : null);
              return text ? (
                <text key={`t${m.label}`} className={`mp-truss-fig__value${m.text ? '' : ' mp-truss-fig__value--picked'}`} x={text.x} y={text.y} textAnchor={text.anchor} style={layout.fontSize === 11 ? undefined : { fontSize: layout.fontSize }}>
                  {text.value}
                </text>
              ) : null;
            })}
            {layout.nodes.map((n) => (
              <g key={`n${n.label}`} className={`mp-truss-fig__node${ends && (ends.i === n.label || ends.j === n.label) ? ' mp-truss-fig__node--active' : ''}${n.flagged ? ' mp-truss-fig__node--flagged' : ''}`}>
                <circle cx={n.x} cy={n.y} r={n.r} />
                {n.flagged ? <circle className="mp-truss-fig__ring" cx={n.x} cy={n.y} r={n.r + 4} /> : null}
                <text x={n.x} y={n.y + 3.2} textAnchor="middle">
                  {n.label}
                </text>
              </g>
            ))}
            {/* The press-and-hover targets: wide, clear, on top. They do not print. */}
            <g className="mp-truss-fig__hits">
              {layout.members.map((m) => (
                <line
                  key={`h${m.label}`}
                  className="mp-truss-fig__hit"
                  x1={m.x1}
                  y1={m.y1}
                  x2={m.x2}
                  y2={m.y2}
                  onPointerEnter={mouse(m.label)}
                  onPointerLeave={mouse(null)}
                  onClick={() => onPick?.(m.label)}
                />
              ))}
            </g>
          </g>
        </svg>
      </div>
      {wide && notes ? <p className="mp-truss-fig__note mp-truss-fig__note--scroll">{widened ? notes.every : notes.scroll}</p> : null}
      {stretchNote ? <p className="mp-truss-fig__note mp-truss-fig__note--stretched">{stretchNote}</p> : null}
      {thinnedNote ? <p className="mp-truss-fig__note mp-truss-fig__note--thinned">{thinnedNote}</p> : null}
      {layout.legend.length > 0 ? (
        <ul className="mp-truss-fig__legend">
          {layout.legend.map((key) => (
            <li key={key} className={`mp-truss-fig__key mp-truss-fig__key--${key}`}>
              <LegendSwatch kind={key} across={layout.stretch?.axis === 'widths'} />
              <span>
                {key === 'deformed' && layout.deformScale !== null
                  ? `${words[key]} ×${formatNumber(layout.deformScale, 3, group)}`
                  : key === 'stretched'
                    ? fill(layout.stretch?.axis === 'widths' ? words.stretchedWidths : words.stretchedHeights, { n: layout.stretch?.n ?? 1 })
                    : words[key]}
              </span>
            </li>
          ))}
        </ul>
      ) : null}
    </figure>
  );
}

/** The small picture of a line or a mark, in the same classes as the drawing. */
function LegendSwatch({ kind, across = false }: { kind: LegendKey; across?: boolean }) {
  return (
    <svg className="mp-truss-fig__swatch" width="30" height="14" viewBox="0 0 30 14" aria-hidden="true">
      {kind === 'tension' ? (
        <g className="mp-truss-fig__member mp-truss-fig__member--tension">
          <line className="mp-truss-fig__bar" x1="1" y1="7" x2="29" y2="7" strokeWidth="5" />
        </g>
      ) : kind === 'compression' ? (
        <g className="mp-truss-fig__member mp-truss-fig__member--compression">
          <line className="mp-truss-fig__bar" x1="1" y1="7" x2="29" y2="7" strokeWidth="6" />
          <line className="mp-truss-fig__core" x1="1" y1="7" x2="29" y2="7" strokeWidth="3" />
        </g>
      ) : kind === 'zero' ? (
        <g className="mp-truss-fig__member mp-truss-fig__member--zero">
          <line className="mp-truss-fig__bar" x1="1" y1="7" x2="29" y2="7" strokeWidth="1.5" />
        </g>
      ) : kind === 'unsolved' ? (
        <g className="mp-truss-fig__member mp-truss-fig__member--plain">
          <line className="mp-truss-fig__bar" x1="1" y1="7" x2="29" y2="7" strokeWidth="2.5" />
        </g>
      ) : kind === 'load' || kind === 'reaction' ? (
        <g className={kind === 'load' ? 'mp-truss-fig__load' : 'mp-truss-fig__reaction'}>
          <line x1="1" y1="7" x2="21" y2="7" />
          <polygon points="29,7 21,3.4 21,10.6" />
        </g>
      ) : kind === 'stretched' ? (
        <g className="mp-truss-fig__stretch">
          {across ? (
            <>
              <line x1="4" y1="7" x2="26" y2="7" />
              <polygon points="1,7 6,4 6,10" />
              <polygon points="29,7 24,4 24,10" />
            </>
          ) : (
            <>
              <line x1="15" y1="2" x2="15" y2="12" />
              <polygon points="15,0 12,4 18,4" />
              <polygon points="15,14 12,10 18,10" />
            </>
          )}
        </g>
      ) : kind === 'deformed' ? (
        <g>
          <line className="mp-truss-fig__deformed" x1="1" y1="7" x2="29" y2="7" />
          <g className="mp-truss-fig__moved">
            <rect x="11.5" y="3.5" width="7" height="7" transform="rotate(45 15 7)" />
          </g>
        </g>
      ) : (
        <g className={`mp-truss-fig__node${kind === 'flagged' ? ' mp-truss-fig__node--flagged' : ''}`}>
          <circle cx="15" cy="7" r="5" />
          {kind === 'flagged' ? <circle className="mp-truss-fig__ring" cx="15" cy="7" r="6.5" /> : null}
        </g>
      )}
    </svg>
  );
}
