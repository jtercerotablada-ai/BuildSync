'use client';

import React, { useMemo } from 'react';
import { formatNumber } from '@/lib/calc/format';
import type { CurveId, Dimension, Drawing } from '@/lib/calc/cable-sag/analysis';
import type { CableSagUi } from '@/lib/calc/cable-sag/strings';
import { niceStep } from './SweepChart';
import { fill } from './text';

/**
 * The cable as entered and — once solved — as it hangs: its curve, the supports, the chord
 * between them, the sags as dimension lines, the load as arrows, the pretension at the lowest
 * point and the tensions at the supports. One drawing in three modes:
 *
 *   hanging   the exact cable as a solid line and, when it differs from it, the parabola as a
 *             dashed one; the two sags (the usual one at midspan, and the depth of the lowest
 *             point below the lower support) as two dimension lines; the load as a row of
 *             arrows onto the cable.
 *   state     the cable in state 1 (dashed) and in state 2 (solid), a sag line for each tagged
 *             1 and 2, and a block of words above the drawing that gives the figures of each.
 *   points    the funicular polygon, its joints numbered, the loads as arrows with their sizes
 *             (longer for the larger), a line weight that follows the tension of each piece.
 *
 * It is given a `Drawing` (lib/calc/cable-sag/analysis.ts) and knows nothing of the form or of
 * the engine. The drawing is built even when the cable cannot be solved (then it is the two
 * supports and the chord).
 *
 * WHAT IS RECKONED AND WHAT IS DRAWN are two functions. `cableLayout` is arithmetic from end to
 * end: where every line, symbol, arrow and word goes, in pixels. `CableSchematic` writes what it
 * returns as SVG and adds nothing of its own, so the layout is held to its rules without React
 * (cable-sag-schematic.test.ts), and it is kept from one draw to the next (`useMemo`).
 *
 * VERTICAL EXAGGERATION. A real cable is shallow (a sag of a fiftieth of the span is ordinary) and
 * drawn true to scale it is a flat line. As in every textbook drawing of a cable, the vertical
 * scale is made larger than the horizontal one — the SAME factor everywhere, so nothing is
 * distorted but the proportion of height to width — until the cable's sag is about a quarter of
 * the drawing's width, never beyond 25 times, and not at all for a cable already deep (a sag
 * over 15 % of the span). The factor is whole (or a half) and is SAID under the drawing, in its
 * legend and on its scale bar, which measures the horizontal direction only.
 *
 * THREE CASES DEPART FROM THAT, each said under the drawing:
 *   - an INCLINED chord that leaves no room for the stretch (a rise that is a third of the span at 1:1 already
 *     fills the height): the chord is drawn true and only the SAG is stretched, measured straight down from the
 *     chord (`chordRelative`); the sag below the lower support is then not drawn, as its level line would slant.
 *   - a cable DEEPER THAN IT IS WIDE (a sag or a rise of several spans): the heights are drawn smaller than the
 *     widths (`compression`), so that the supports stay apart and their words do not pile up.
 *   - a sag too small to see even so (under 6 px: a millionth of the span, or the stretch is capped): the drawing
 *     says it is drawn as a straight line (`tooSmall`), not that the stretch lets the sag be seen.
 *
 * NO WORD TOUCHES ANOTHER OR ANY LINE. Words are placed one at a time by `place`: each tries the
 * spots around the thing it names, nearest first and in the direction it prefers, and takes the
 * first where it touches no line (the cable, the chord, a sag line, an arrow, a support, another
 * word). A word that has to stand away from what it names is tied to it by a thin leader line.
 * The drawing is then cropped to what is on it (the view box), so a spot far from the cable costs
 * no empty page where there is none.
 *
 * THE KINDS OF LINE ARE TOLD APART BY PATTERN AS WELL AS BY COLOUR, so that it works on a
 * black-and-white sheet and for a reader who does not see colour: a solid line is the exact
 * cable (or state 2), a dashed one the parabola (or state 1), a thin dashed one the chord.
 * Every number on it is in the tables beside it too, so the SVG is described in one sentence
 * (`summary`) and its shapes are hidden from a screen reader.
 */

/** Pixel sizes at full scale; `k` (0.6 to 1) takes them down on a narrow drawing. */
const SUPPORT_DEPTH = 22;
const LOAD_MIN = 16;
const LOAD_SPAN = 18;
const SHORT_ARROW = 18;
const H_ARROW = 28;
const HEAD_LEN = 8;
const HEAD_HALF = 3.6;
/** A character of the drawing's 11 px mono, and the height of a line of it. */
const CHAR = 6.6;
const WORD_H = 13;
const MAX_HEIGHT = 560;
/** The most the vertical scale is stretched, and the share of the drawing's width the sag is brought up to. */
const EXAGGERATION_CAP = 25;
const SAG_SHARE = 0.24;
/** A sag bar shorter than this many pixels cannot be seen. */
const TOO_SMALL = 6;
/** Where an inclined chord's own stretch leaves the sag shorter than this, only the sag is stretched. */
const SAG_ENOUGH = 14;
/** A cable whose heights would leave the supports closer than this share of the width is drawn with its heights compressed. */
const NARROW = 0.2;
/** Beyond this share of the span the cable is deep and is not stretched. */
const DEEP = 0.15;
const GAPS = [5, 11, 20, 34, 52, 76, 104, 140, 190, 250];

export type Point = { x: number; y: number };
export type Rect = { x0: number; y0: number; x1: number; y1: number };
export type Seg = { x1: number; y1: number; x2: number; y2: number };

export interface LayoutOptions {
  /** The drawing's width in pixels. */
  width: number;
  /** What numbers are set apart with, and the length unit written after a sag. */
  group: string;
  unit: string;
  /** The words written on the drawing, before each number. */
  labels: { sag: string; sagMid: string; sagLow: string; horizontal: string };
  /** The words beside the supports and at the lowest point, already written ("tension 13.46 kip"); none where null or left out. */
  texts?: { A?: string | null; B?: string | null; H?: string | null };
  /** For a change of state: the figures of each state, one paragraph each, written above the drawing. */
  block?: readonly string[];
  /** Which pieces are drawn: the tensions, the sag dimension lines, the load arrows of a hanging cable, the parabola. */
  tensions: boolean;
  dims: boolean;
  load: boolean;
  parabola: boolean;
  /** For the funicular polygon: the weight of each piece, 0 to 1 (the tension over the largest). */
  shares?: readonly number[];
  /** The tallest the drawing may be (px). */
  maxHeight?: number;
}

export interface CurveShape {
  id: CurveId;
  /** The path, in pixels. */
  d: string;
  /** The same points. */
  points: Point[];
}

export interface SegmentShape {
  label: number;
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  width: number;
}

export interface JointShape {
  label: number;
  x: number;
  y: number;
  r: number;
}

export interface SupportShape {
  id: 'A' | 'B';
  x: number;
  y: number;
  /** How far under its point the symbol reaches, and its half width. */
  depth: number;
  half: number;
}

export interface DimShape {
  id: 'mid' | 'low' | 'state1';
  /** A short dotted line from the foot of the bar to the position it measures, where the bar stands aside from it (a load's arrow is there); null otherwise. */
  reach: { x1: number; x2: number; y: number } | null;
  /** One line for the two sags, because they are the same line (a level span). */
  both: boolean;
  /** The sag the visitor gave. */
  given: boolean;
  x: number;
  y1: number;
  y2: number;
  /** The level line a sag below the lower support is measured from; null for the others. */
  level: { x1: number; x2: number; y: number } | null;
}

export interface ArrowShape {
  label: number;
  tail: Point;
  tip: Point;
  magnitude: number;
}

/** A word on the drawing: where it is, the box it takes, and the leader that ties it to what it names where it stands away from it. */
export interface LabelShape {
  kind: 'dim' | 'tension' | 'H' | 'support' | 'joint' | 'load';
  id: string;
  value: string;
  /** The middle of the word and its baseline. */
  x: number;
  y: number;
  anchor: 'middle';
  rect: Rect;
  leader: Seg | null;
  /** Whether it stands where it was wanted: false only if no free spot was found (never expected, and held by the tests). */
  clear: boolean;
}

export type LegendKey = 'cable' | 'parabola' | 'chord' | 'sagMid' | 'sagLow' | 'sagBoth' | 'sagAt' | 'load' | 'tension' | 'H' | 'state1' | 'state2' | 'polygon' | 'pointLoad' | 'joint' | 'support' | 'vertical' | 'verticalSag' | 'verticalSmall';

export interface Layout {
  width: number;
  /** The drawing's height, and where its view starts (the drawing is cropped to what is on it). */
  height: number;
  viewTop: number;
  /** Pixels per unit of length across the page. */
  scale: number;
  /** How many times larger the vertical scale is than the horizontal one (of the whole drawing, or of the sag alone with `chordRelative`): 1 where the cable is drawn true. */
  exaggeration: number;
  /** Only the sag is stretched, measured down from the chord, which keeps its true slope. */
  chordRelative: boolean;
  /** How many times SMALLER the heights are drawn than the widths (a cable much deeper than wide): 1 where they are not. */
  compression: number;
  /** The sag is under a few pixels even so: the cable looks straight. */
  tooSmall: boolean;
  chord: Seg;
  supports: SupportShape[];
  curves: CurveShape[];
  segments: SegmentShape[];
  joints: JointShape[];
  dims: DimShape[];
  labels: LabelShape[];
  /** The arrow under the lowest point; null where the lowest point is a support or the pretension is not asked for. */
  H: { x: number; y: number; arrow: { x1: number; x2: number; y: number } } | null;
  /** A bar as long as a round length, under the drawing at its left, with its words: it measures the horizontal direction only. */
  scaleBar: { x1: number; x2: number; y: number; length: number; text: { value: string; x: number; y: number; anchor: 'start' } };
  /** The figures of a change of state, in lines (each paragraph wrapped to the width), above the drawing. */
  block: { lines: { value: string; x: number; y: number }[]; rect: Rect } | null;
  loadArrows: ArrowShape[];
  pointLoads: ArrowShape[];
  /** Every line that words are kept clear of, for the tests. */
  obstacles: Seg[];
  legend: LegendKey[];
}

const clean = (v: number): number => {
  const r = Math.round(v * 1e6) / 1e6;
  return r === 0 ? 0 : r;
};
/** A coordinate written into a path: two decimals are a hundredth of a pixel. */
const pixel = (v: number): string => String(Math.round(v * 100) / 100 || 0);

/** A value with its sign, a true minus, a zero with none. */
const withSign = (v: number, group: string): string => (v === 0 ? '0' : `${v < 0 ? '−' : ''}${formatNumber(Math.abs(v), 4, group)}`);

/** Whether a segment touches a rectangle grown by `pad` all round. */
export function segHitsRect(s: Seg, r: Rect, pad: number): boolean {
  const x0 = r.x0 - pad;
  const y0 = r.y0 - pad;
  const x1 = r.x1 + pad;
  const y1 = r.y1 + pad;
  const dx = s.x2 - s.x1;
  const dy = s.y2 - s.y1;
  const p = [-dx, dx, -dy, dy];
  const q = [s.x1 - x0, x1 - s.x1, s.y1 - y0, y1 - s.y1];
  let t0 = 0;
  let t1 = 1;
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

/** Whether two rectangles, the first grown by `pad`, overlap. */
export function rectsHit(a: Rect, b: Rect, pad: number): boolean {
  return a.x0 - pad < b.x1 && a.x1 + pad > b.x0 && a.y0 - pad < b.y1 && a.y1 + pad > b.y0;
}

/** The cable's level at a position, by its points (left to right). */
function levelAt(points: readonly { x: number; z: number }[], x: number): number {
  if (points.length === 0) return 0;
  if (x <= points[0].x) return points[0].z;
  for (let i = 1; i < points.length; i++) {
    if (x <= points[i].x) {
      const a = points[i - 1];
      const b = points[i];
      return b.x === a.x ? b.z : a.z + ((x - a.x) / (b.x - a.x)) * (b.z - a.z);
    }
  }
  return points[points.length - 1].z;
}

/** A paragraph broken into lines of at most `chars` characters, at its spaces. */
export function wrap(text: string, chars: number): string[] {
  const lines: string[] = [];
  let line = '';
  for (const word of text.split(' ')) {
    if (line && (line + ' ' + word).length > chars) {
      lines.push(line);
      line = word;
    } else line = line ? `${line} ${word}` : word;
  }
  if (line) lines.push(line);
  return lines;
}

/** The directions a word may stand from the thing it names. */
type Dir = 'r' | 'l' | 'u' | 'd' | 'ur' | 'ul' | 'dr' | 'dl' | 'us' | 'ue' | 'ds' | 'de';
const ANY: Dir[] = ['r', 'l', 'u', 'd', 'ur', 'ul', 'dr', 'dl', 'us', 'ue', 'ds', 'de'];

function spot(dir: Dir, p: Point, g: number, w: number): Rect {
  const h = WORD_H;
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
      return { x0: p.x + g, y0: p.y - g - h, x1: p.x + g + w, y1: p.y - g };
    case 'ul':
      return { x0: p.x - g - w, y0: p.y - g - h, x1: p.x - g, y1: p.y - g };
    case 'dr':
      return { x0: p.x + g, y0: p.y + g, x1: p.x + g + w, y1: p.y + g + h };
    case 'dl':
      return { x0: p.x - g - w, y0: p.y + g, x1: p.x - g, y1: p.y + g + h };
    case 'us':
      return { x0: p.x, y0: p.y - g - h, x1: p.x + w, y1: p.y - g };
    case 'ue':
      return { x0: p.x - w, y0: p.y - g - h, x1: p.x, y1: p.y - g };
    case 'ds':
      return { x0: p.x, y0: p.y + g, x1: p.x + w, y1: p.y + g + h };
    case 'de':
      return { x0: p.x - w, y0: p.y + g, x1: p.x, y1: p.y + g + h };
  }
}

export function cableLayout(drawing: Drawing, o: LayoutOptions): Layout {
  const W = o.width;
  const mx = 16;
  const box = drawing.box;
  const mode = drawing.mode;
  const points = mode === 'points';
  const k = Math.max(0.6, Math.min(1, W / 600));
  const lengthX = box.width > 0 ? box.width : 1;
  const maxHeight = o.maxHeight ?? MAX_HEIGHT;

  /* The scale: across the page, then the vertical stretch. */
  const plotW = Math.max(40, W - 2 * mx);
  const across = plotW / lengthX;
  const fit = (maxHeight * 0.8) / Math.max(box.height, 1e-9);
  // A cable much deeper than wide would leave its supports a few pixels apart: it is drawn as wide as the page, its heights compressed.
  const compressed = fit < NARROW * across;
  const scale = compressed ? across : Math.min(across, fit);
  const compression = compressed ? across / fit : 1;
  const offX = mx + (plotW - lengthX * scale) / 2;
  const ch = drawing.chord;
  const chordZ = (x: number) => (ch.x1 === ch.x0 ? ch.z0 : ch.z0 + ((ch.z1 - ch.z0) * (x - ch.x0)) / (ch.x1 - ch.x0));
  let dev = 0;
  for (const c of drawing.curves) for (const p of c.points) dev = Math.max(dev, chordZ(p.x) - p.z);
  const ratio = dev / lengthX;
  let ev = 1;
  let chordRelative = false;
  if (dev > 0 && ratio < DEEP && !compressed) {
    // Up to a tenth of the span the sag is brought to its share of the width; from there the stretch fades out, to none at DEEP.
    const share = ratio <= 0.1 ? SAG_SHARE : SAG_SHARE - ((SAG_SHARE - DEEP) * (ratio - 0.1)) / (DEEP - 0.1);
    // A factor that can be said: whole above two, a half below.
    const said = (v: number) => (v >= 2 ? Math.floor(v + 1e-9) : Math.floor(v * 2 + 1e-9) / 2);
    const wanted = said(Math.min(EXAGGERATION_CAP, share / ratio));
    // The whole drawing is stretched, so it must still fit the height.
    const whole = said(Math.min(wanted, Math.max(1, (maxHeight * 0.8) / Math.max(box.height * scale, 1e-9))));
    ev = whole < 1.5 ? 1 : whole;
    // A chord that already fills the height leaves the sag a few pixels: then only the sag is stretched, from the chord, which stays true.
    if (ch.z1 !== ch.z0 && dev * scale * ev < SAG_ENOUGH && wanted > 1.5 * ev) {
      chordRelative = true;
      ev = wanted;
    }
  }
  if (compressed) ev = 1 / compression;
  const X = (x: number) => offX + (x - box.x0) * scale;
  // The level of a point drawn: z up, stretched by `ev` from the top of the box - or, with `chordRelative`, the chord true and only the distance below it stretched.
  const Y = (z: number, x?: number) => (chordRelative && x !== undefined ? ((box.z1 - chordZ(x)) + (chordZ(x) - z) * ev) * scale : (box.z1 - z) * scale * ev);
  const at = (p: { x: number; z: number }): Point => ({ x: clean(X(p.x)), y: clean(Y(p.z, p.x)) });

  const A = at(drawing.supports.A);
  const B = at(drawing.supports.B);
  const exact = drawing.curves.find((c) => c.id === 'exact' || c.id === 'state2' || c.id === 'polygon');

  /* ── The things drawn ── */
  const half = clean(10 * k + 1);
  const depth = clean(SUPPORT_DEPTH * k);
  const supports: SupportShape[] = [
    { id: 'A', x: A.x, y: A.y, depth, half },
    { id: 'B', x: B.x, y: B.y, depth, half },
  ];

  const curves: CurveShape[] = drawing.curves
    .filter((c) => c.id !== 'parabola' || o.parabola)
    .map((c) => {
      const pts = c.points.map(at);
      return { id: c.id, points: pts, d: pts.map((p, i) => `${i === 0 ? 'M' : 'L'}${pixel(p.x)} ${pixel(p.y)}`).join(' ') };
    });
  const segments: SegmentShape[] = [];
  const polygon = curves.find((c) => c.id === 'polygon');
  if (polygon) {
    // The weight of a piece: from 2 px for the least tension to 5.5 px for the largest, whatever the two are (5 % apart is still seen).
    // It says which piece pulls harder and not by how much (the tensions are in the table, and the legend says so).
    const shares = o.shares ?? [];
    const least = shares.length ? Math.min(...shares) : 1;
    for (let i = 1; i < polygon.points.length; i++) {
      const share = o.shares?.[i - 1] ?? 0.5;
      const along = least < 0.999 ? (share - least) / (1 - least) : 1;
      segments.push({ label: i, x1: polygon.points[i - 1].x, y1: polygon.points[i - 1].y, x2: polygon.points[i].x, y2: polygon.points[i].y, width: clean(least < 0.999 ? 2 + 3.5 * along : 3.75) });
    }
  }
  const r = clean(3.2 + 1.2 * k);
  const joints: JointShape[] = drawing.loads.map((l) => {
    const p = at(l);
    return { label: l.label, x: p.x, y: p.y, r };
  });

  /* Dimension lines: the lines only; their words are placed with the others. */
  const dims: DimShape[] = [];
  const dimWords = new Map<string, string>();
  const dimLine = (id: DimShape['id'], d: Dimension, word: string, shift = 0): DimShape => {
    const x = clean(X(d.x) + shift);
    const y1 = clean(Y(d.zTop, d.x));
    const y2 = clean(Y(d.zBottom, d.x));
    dimWords.set(id, `${word} ${formatNumber(d.value, 4, o.group)} ${o.unit}`);
    return { id, both: false, given: false, x, y1, y2, level: d.from === undefined ? null : { x1: clean(X(d.from)), x2: x, y: y1 }, reach: shift === 0 || mode === 'state' ? null : { x1: x, x2: clean(X(d.x)), y: y2 } };
  };
  if (o.dims) {
    const { mid, low: lowSag, state1 } = drawing.sag;
    // Where the chord is stretched apart from the cable its "level" line would slant: the sag below the lower support is left to the tables.
    const low = chordRelative ? null : lowSag;
    if (mode === 'state') {
      // Each state's sag line carries its number and its figure: the two cables are nearly one line, and the bars are what tells them apart.
      if (state1) dims.push({ ...dimLine('state1', state1, '1:', -5), given: drawing.sag.given === 'mid' });
      if (mid) dims.push({ ...dimLine('mid', mid, '2:', 5), given: false });
    } else if (mid && low) {
      const same = Math.abs(X(mid.x) - X(low.x)) < 1 && Math.abs(Y(mid.zTop) - Y(low.zTop)) < 0.5 && Math.abs(Y(mid.zBottom) - Y(low.zBottom)) < 0.5;
      if (same) dims.push({ ...dimLine('mid', mid, o.labels.sag), both: true, given: drawing.sag.given !== null });
      else {
        dims.push({ ...dimLine('mid', mid, o.labels.sagMid), given: drawing.sag.given === 'mid' });
        dims.push({ ...dimLine('low', low, o.labels.sagLow), given: drawing.sag.given === 'low' });
      }
    } else if (mid) {
      // At a load's own position the sag line would run down its arrow: it stands a little to the left of it.
      const onLoad = points && joints.some((j) => Math.abs(j.x - X(mid.x)) < 12);
      dims.push({ ...dimLine('mid', mid, points ? o.labels.sag : o.labels.sagMid, onLoad ? -12 : 0), given: drawing.sag.given === 'mid' });
    } else if (low) dims.push({ ...dimLine('low', low, o.labels.sagLow), given: drawing.sag.given === 'low' });
  }

  /* The pretension: an arrow under the lowest point. */
  let H: Layout['H'] = null;
  const lowest = at(drawing.labels.H);
  const atSupport = (p: Point) => Math.abs(p.x - lowest.x) < 0.5 && Math.abs(p.y - lowest.y) < 0.5;
  if (o.tensions && o.texts?.H && !atSupport(A) && !atSupport(B)) {
    const arrowY = clean(lowest.y + 11 * k + 3);
    H = { x: lowest.x, y: lowest.y, arrow: { x1: clean(lowest.x - (H_ARROW * k) / 2), x2: clean(lowest.x + (H_ARROW * k) / 2), y: arrowY } };
  }

  /* Point loads: an arrow onto its joint, longer for the larger. */
  const pointLoads: ArrowShape[] = drawing.loads.map((l) => {
    const p = at(l);
    const len = clean((LOAD_MIN + LOAD_SPAN * l.share) * k);
    const down = l.P >= 0;
    const tip = { x: p.x, y: clean(down ? p.y - r - 1 : p.y + r + 1) };
    const tail = { x: p.x, y: clean(down ? tip.y - len : tip.y + len) };
    return { label: l.label, tail, tip, magnitude: Math.abs(l.P) };
  });

  /* ── What the words are kept clear of ── */
  const obstacles: Seg[] = [];
  const boxes: Rect[] = [];
  const line = (x1: number, y1: number, x2: number, y2: number) => obstacles.push({ x1, y1, x2, y2 });
  for (const c of curves) for (let i = 1; i < c.points.length; i++) line(c.points[i - 1].x, c.points[i - 1].y, c.points[i].x, c.points[i].y);
  line(A.x, A.y, B.x, B.y);
  for (const d of dims) {
    line(d.x, d.y1, d.x, d.y2);
    line(d.x - 4, d.y1, d.x + 4, d.y1);
    line(d.x - 4, d.y2, d.x + 4, d.y2);
    if (d.level) line(d.level.x1, d.level.y, d.level.x2, d.level.y);
    if (d.reach) line(d.reach.x1, d.reach.y, d.reach.x2, d.reach.y);
  }
  if (H) {
    line(H.arrow.x1, H.arrow.y, H.arrow.x2, H.arrow.y);
    boxes.push({ x0: H.x - 4, y0: H.y - 4, x1: H.x + 4, y1: H.y + 4 });
    boxes.push({ x0: H.arrow.x2 - HEAD_LEN, y0: H.arrow.y - HEAD_HALF, x1: H.arrow.x2, y1: H.arrow.y + HEAD_HALF });
  }
  for (const a of pointLoads) {
    line(a.tail.x, a.tail.y, a.tip.x, a.tip.y);
    boxes.push({ x0: a.tip.x - HEAD_HALF, y0: Math.min(a.tip.y, a.tip.y + (a.tail.y < a.tip.y ? -HEAD_LEN : HEAD_LEN)), x1: a.tip.x + HEAD_HALF, y1: Math.max(a.tip.y, a.tip.y + (a.tail.y < a.tip.y ? -HEAD_LEN : HEAD_LEN)) });
  }
  for (const s of supports) boxes.push({ x0: s.x - s.half - 4, y0: s.y - 1, x1: s.x + s.half + 4, y1: s.y + s.depth + 2 });
  for (const j of joints) boxes.push({ x0: j.x - j.r - 1, y0: j.y - j.r - 1, x1: j.x + j.r + 1, y1: j.y + j.r + 1 });

  /* The figures of a change of state, in a block above the drawing. */
  let block: Layout['block'] = null;
  if (o.block && o.block.length > 0) {
    const chars = Math.max(10, Math.floor((W - 2 * mx) / CHAR));
    const lines = o.block.flatMap((paragraph) => wrap(paragraph, chars));
    const rowH = 15;
    // Clear of the top of the drawing by room for the words that stand over the chord (the tags of the two sag lines).
    const y0 = -(lines.length * rowH) - 34;
    block = { lines: lines.map((value, i) => ({ value, x: mx, y: clean(y0 + (i + 1) * rowH - 4) })), rect: { x0: mx - 2, y0, x1: Math.min(W - 2, mx + Math.max(...lines.map((l) => l.length)) * CHAR + 2), y1: y0 + lines.length * rowH } };
    boxes.push(block.rect);
  }

  /* ── The words ── */
  const placed: LabelShape[] = [];
  const free = (rect: Rect, leader: Seg | null): number => {
    // The number of things the spot touches (0: it is clear).
    let hits = 0;
    if (rect.x0 < 2 || rect.x1 > W - 2) hits += 100;
    for (const s of obstacles) if (segHitsRect(s, rect, 2.5)) hits++;
    for (const b of boxes) if (rectsHit(rect, b, 2)) hits++;
    for (const p of placed) if (rectsHit(rect, p.rect, 3)) hits++;
    // A leader may cross a line but not a word.
    if (leader) {
      for (const p of placed) if (segHitsRect(leader, p.rect, 1)) hits++;
      // (It starts on what it names, which is itself in `boxes`: only the block above the drawing is kept clear of it.)
      if (block && segHitsRect(leader, block.rect, 1)) hits++;
    }
    return hits;
  };
  const place = (kind: LabelShape['kind'], id: string, value: string, p: Point, prefer: Dir[], first = 0): LabelShape => {
    const w = value.length * CHAR + 4;
    const order = [...prefer, ...ANY.filter((d) => !prefer.includes(d))];
    // The spots, the nearest first, a direction further down the list costing the same as a gap of twelve pixels more.
    const spots = GAPS.slice(first).flatMap((g) => order.map((dir, i) => ({ g, dir, cost: g + 12 * i }))).sort((a, b) => a.cost - b.cost);
    let best: { rect: Rect; leader: Seg | null; hits: number } | null = null;
    for (const { g, dir } of spots) {
      const rect = spot(dir, p, g, w);
      const cx = Math.min(Math.max(p.x, rect.x0), rect.x1);
      const cy = Math.min(Math.max(p.y, rect.y0), rect.y1);
      const leader: Seg | null = g > 12 ? { x1: p.x, y1: p.y, x2: cx, y2: cy } : null;
      const hits = free(rect, leader);
      if (!best || hits < best.hits) best = { rect, leader, hits };
      if (hits === 0) break;
    }
    const chosen = best!;
    if (chosen.leader) obstacles.push(chosen.leader);
    const label: LabelShape = { kind, id, value, x: clean((chosen.rect.x0 + chosen.rect.x1) / 2), y: clean(chosen.rect.y1 - 3.5), anchor: 'middle', rect: chosen.rect, leader: chosen.leader, clear: chosen.hits === 0 };
    placed.push(label);
    return label;
  };

  // The supports' letters under their ground lines, the joints' numbers, the loads' sizes: what the drawing is made of.
  for (const s of supports) place('support', s.id, s.id, { x: s.x, y: s.y + s.depth }, s.id === 'A' ? ['d', 'dl', 'dr'] : ['d', 'dr', 'dl'], 0);
  for (const j of joints) place('joint', String(j.label), String(j.label), { x: j.x, y: j.y }, ['d', 'dl', 'dr', 'ul', 'ur'], 0);
  drawing.loads.forEach((l, i) => {
    const a = pointLoads[i];
    place('load', String(l.label), withSign(l.P, o.group), a.tail, l.P >= 0 ? ['u', 'ul', 'ur'] : ['d', 'dl', 'dr'], 0);
  });
  // Each sag beside its line, on the side that is free.
  for (const d of dims) {
    const value = dimWords.get(d.id) ?? '';
    const middle = { x: d.x, y: (d.y1 + d.y2) / 2 };
    if (mode === 'state') place('dim', d.id, value, { x: d.x, y: Math.min(d.y1, d.y2) }, d.id === 'state1' ? ['ul', 'u'] : ['ur', 'u']);
    else place('dim', d.id, value, middle, d.level ? ['l', 'r'] : d.reach ? ['l', 'ul', 'r'] : ['r', 'l', 'ur', 'ul']);
  }
  // The pretension under the lowest point; the tensions below and outside the supports.
  if (H && o.texts?.H) place('H', 'H', o.texts.H, { x: H.x, y: H.arrow.y }, ['d', 'dl', 'dr', 'l', 'r']);
  if (o.tensions) {
    if (o.texts?.A) place('tension', 'A', o.texts.A, A, ['l', 'dl', 'd', 'ul', 'u']);
    if (o.texts?.B) place('tension', 'B', o.texts.B, B, ['r', 'dr', 'd', 'ur', 'u']);
  }
  const wordBoxes = placed.map((p) => p.rect);

  /* The load of a hanging cable: a row of arrows onto it, kept clear of every word and sag line. */
  const loadArrows: ArrowShape[] = [];
  if (mode === 'hanging' && o.load && exact) {
    const count = Math.max(4, Math.min(13, Math.floor(W / 56)));
    const L = drawing.supports.B.x - drawing.supports.A.x;
    const len = clean(SHORT_ARROW * k);
    for (let i = 1; i <= count; i++) {
      const x = drawing.supports.A.x + (L * i) / (count + 1);
      const px = clean(X(x));
      const tip = { x: px, y: clean(Y(levelAt(exact.points, x), x) - 2) };
      const arrow: Rect = { x0: px - HEAD_HALF, y0: tip.y - len, x1: px + HEAD_HALF, y1: tip.y };
      if (wordBoxes.some((b) => rectsHit(arrow, b, 3))) continue;
      if (obstacles.some((s) => s.x1 === s.x2 && segHitsRect(s, arrow, 4) && Math.abs(s.y2 - s.y1) > 0)) continue;
      if (boxes.some((b) => rectsHit(arrow, b, 2))) continue;
      loadArrows.push({ label: i, tail: { x: px, y: clean(tip.y - len) }, tip, magnitude: 0 });
    }
  }

  /* ── The view: cropped to what is on the drawing, with the scale bar under it ── */
  let top = 0;
  let bottom = 0;
  const grow = (y0: number, y1: number) => {
    top = Math.min(top, y0);
    bottom = Math.max(bottom, y1);
  };
  for (const c of curves) for (const p of c.points) grow(p.y, p.y);
  for (const s of supports) grow(s.y, s.y + s.depth + 2);
  for (const b of [...wordBoxes, ...boxes]) grow(b.y0, b.y1);
  for (const s of obstacles) grow(Math.min(s.y1, s.y2), Math.max(s.y1, s.y2));
  for (const a of loadArrows) grow(a.tail.y, a.tip.y);
  const barLength = niceStep(lengthX * 0.2, 1);
  const barY = clean(bottom + 22);
  const barX1 = clean(mx);
  const barX2 = clean(barX1 + barLength * scale);
  const barText = `${formatNumber(barLength, 4, o.group)} ${o.unit} ${o.labels.horizontal}`;
  const scaleBar: Layout['scaleBar'] = { x1: barX1, x2: barX2, y: barY, length: barLength, text: { value: barText, x: clean(barX2 + 8), y: clean(barY + 4), anchor: 'start' } };
  const viewTop = clean(top - 6);
  const height = clean(barY + 10 - viewTop);

  /* What the legend has to explain. */
  const legend: LegendKey[] = [];
  const has = (id: CurveId) => curves.some((c) => c.id === id);
  if (has('exact')) legend.push('cable');
  if (has('parabola')) legend.push('parabola');
  if (has('state1')) legend.push('state1');
  if (has('state2')) legend.push('state2');
  if (has('polygon')) legend.push('polygon');
  legend.push('chord');
  if (dims.some((d) => d.both)) legend.push('sagBoth');
  else {
    if (dims.some((d) => d.id === 'mid' || d.id === 'state1')) legend.push(points ? 'sagAt' : 'sagMid');
    if (dims.some((d) => d.id === 'low')) legend.push('sagLow');
  }
  if (loadArrows.length > 0) legend.push('load');
  if (pointLoads.length > 0) legend.push('pointLoad');
  if (joints.length > 0) legend.push('joint');
  if (placed.some((p) => p.kind === 'tension')) legend.push('tension');
  if (H) legend.push('H');
  legend.push('support');
  if (compression > 1) legend.push('verticalSmall');
  else if (ev > 1) legend.push(chordRelative ? 'verticalSag' : 'vertical');

  // The longest sag bar drawn, in pixels: under a few the cable looks like a line and the stretch has not shown the sag.
  const sagPixels = dev * scale * (compressed ? 1 / compression : ev);
  const tooSmall = dev > 0 && sagPixels < TOO_SMALL;

  return {
    width: W,
    height,
    viewTop,
    scale: clean(scale),
    exaggeration: compressed ? 1 : ev,
    chordRelative,
    compression: clean(compression),
    tooSmall,
    chord: { x1: A.x, y1: A.y, x2: B.x, y2: B.y },
    supports,
    curves,
    segments,
    joints,
    dims,
    labels: placed,
    H,
    scaleBar,
    block,
    loadArrows,
    pointLoads,
    obstacles,
    legend,
  };
}

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
    </g>
  );
}

export interface CableSchematicProps extends Omit<LayoutOptions, 'maxHeight'> {
  drawing: Drawing;
  /** The drawing in one sentence, for whoever cannot see it. */
  summary: string;
  /** The legend's words; `vertical` has {n} where the factor goes. */
  legend: CableSagUi['results']['legend'];
  /** The note under the drawing that says the vertical scale is stretched, with {n}. */
  stretch: string;
  /** The notes of the other three cases (see the header): only the sag stretched from a true chord, the heights compressed, a sag too small to show. Each has {n}; `stretch` stands in for one that is left out. */
  stretchNotes?: Partial<Record<'sag' | 'small' | 'tiny', string>>;
  maxHeight?: number;
}

/** The factor as it is said: whole, or with a half. */
const factorText = (n: number): string => (Number.isInteger(n) ? String(n) : n >= 10 ? String(Math.round(n)) : n.toFixed(1));

export function CableSchematic({ drawing, summary, legend: words, stretch, stretchNotes, ...options }: CableSchematicProps) {
  const { width, group, unit, labels, texts, block, tensions, dims, load, parabola, shares, maxHeight } = options;
  const layout = useMemo(() => cableLayout(drawing, { width, group, unit, labels, texts, block, tensions, dims, load, parabola, shares, maxHeight }), [drawing, width, group, unit, labels, texts, block, tensions, dims, load, parabola, shares, maxHeight]);
  const n = factorText(layout.compression > 1 ? layout.compression : layout.exaggeration);
  // Which sentence is true of this drawing: the sag is too small to show; the heights are compressed; only the sag is stretched; the whole is.
  const note = layout.tooSmall ? (stretchNotes?.tiny ?? stretch) : layout.compression > 1 ? (stretchNotes?.small ?? stretch) : layout.chordRelative ? (stretchNotes?.sag ?? stretch) : stretch;
  const noted = layout.tooSmall || layout.compression > 1 || layout.exaggeration > 1;
  return (
    <figure className="mp-cs-fig">
      <svg className="mp-plot__svg mp-cs-fig__svg" role="img" aria-label={summary} viewBox={`0 ${layout.viewTop} ${layout.width} ${layout.height}`} width={layout.width} height={layout.height}>
        <g aria-hidden="true">
          {layout.block ? (
            <g className="mp-cs-fig__block">
              {layout.block.lines.map((l, i) => (
                <text key={i} x={l.x} y={l.y} textAnchor="start">
                  {l.value}
                </text>
              ))}
            </g>
          ) : null}
          {layout.supports.map((s) => (
            <g key={`s${s.id}`} className="mp-cs-fig__support" transform={`translate(${s.x} ${s.y})`}>
              <polygon points={`0,0 ${-s.half},${s.depth - 2} ${s.half},${s.depth - 2}`} />
              <line className="mp-cs-fig__ground" x1={-s.half - 4} y1={s.depth} x2={s.half + 4} y2={s.depth} />
            </g>
          ))}
          <line className="mp-cs-fig__chord" x1={layout.chord.x1} y1={layout.chord.y1} x2={layout.chord.x2} y2={layout.chord.y2} />
          {layout.loadArrows.map((a) => (
            <Arrow key={`q${a.label}`} a={a} className="mp-cs-fig__load" />
          ))}
          {[...layout.curves].sort((p, q) => Number(p.id === 'state1') - Number(q.id === 'state1')).map((c) => (
            <path key={c.id} className={`mp-cs-fig__curve mp-cs-fig__curve--${c.id}`} d={c.d} />
          ))}
          {layout.segments.map((s) => (
            <line key={`p${s.label}`} className="mp-cs-fig__piece" x1={s.x1} y1={s.y1} x2={s.x2} y2={s.y2} strokeWidth={s.width} />
          ))}
          {layout.dims.map((d) => (
            <g key={d.id} className={`mp-cs-fig__dim mp-cs-fig__dim--${d.id}${d.given ? ' mp-cs-fig__dim--given' : ''}`}>
              {d.level ? <line className="mp-cs-fig__level" x1={d.level.x1} y1={d.level.y} x2={d.level.x2} y2={d.level.y} /> : null}
              {d.reach ? <line className="mp-cs-fig__level" x1={d.reach.x1} y1={d.reach.y} x2={d.reach.x2} y2={d.reach.y} /> : null}
              <line x1={d.x} y1={d.y1} x2={d.x} y2={d.y2} />
              <line x1={d.x - 4} y1={d.y1} x2={d.x + 4} y2={d.y1} />
              <line x1={d.x - 4} y1={d.y2} x2={d.x + 4} y2={d.y2} />
            </g>
          ))}
          {layout.pointLoads.map((a) => (
            <Arrow key={`l${a.label}`} a={a} className="mp-cs-fig__pointload" />
          ))}
          {layout.joints.map((j) => (
            <g key={`j${j.label}`} className="mp-cs-fig__joint">
              <circle cx={j.x} cy={j.y} r={j.r} />
            </g>
          ))}
          {layout.H ? (
            <g className="mp-cs-fig__h">
              <circle cx={layout.H.x} cy={layout.H.y} r={3} />
              <Arrow a={{ label: 0, tail: { x: layout.H.arrow.x1, y: layout.H.arrow.y }, tip: { x: layout.H.arrow.x2, y: layout.H.arrow.y }, magnitude: 0 }} className="mp-cs-fig__harrow" />
            </g>
          ) : null}
          {layout.labels.map((l) =>
            l.leader ? <line key={`k${l.kind}${l.id}`} className="mp-cs-fig__leader" x1={l.leader.x1} y1={l.leader.y1} x2={l.leader.x2} y2={l.leader.y2} /> : null,
          )}
          {layout.labels.map((l) => (
            <text key={`w${l.kind}${l.id}`} className={`mp-cs-fig__label mp-cs-fig__label--${l.kind}`} x={l.x} y={l.y} textAnchor={l.anchor}>
              {l.value}
            </text>
          ))}
          <g className="mp-cs-fig__scale">
            <line x1={layout.scaleBar.x1} y1={layout.scaleBar.y} x2={layout.scaleBar.x2} y2={layout.scaleBar.y} />
            <line x1={layout.scaleBar.x1} y1={layout.scaleBar.y - 4} x2={layout.scaleBar.x1} y2={layout.scaleBar.y + 4} />
            <line x1={layout.scaleBar.x2} y1={layout.scaleBar.y - 4} x2={layout.scaleBar.x2} y2={layout.scaleBar.y + 4} />
            <text x={layout.scaleBar.text.x} y={layout.scaleBar.text.y} textAnchor={layout.scaleBar.text.anchor}>
              {layout.scaleBar.text.value}
            </text>
          </g>
        </g>
      </svg>
      {noted ? <p className="mp-cs-fig__stretch">{fill(note, { n })}</p> : null}
      <ul className="mp-cs-fig__legend">
        {layout.legend.map((key) => (
          <li key={key} className={`mp-cs-fig__key mp-cs-fig__key--${key}`}>
            <LegendSwatch kind={key} />
            <span>{fill(words[key], { n })}</span>
          </li>
        ))}
      </ul>
    </figure>
  );
}

/** The small picture of a line or a mark, in the same classes as the drawing. */
function LegendSwatch({ kind }: { kind: LegendKey }) {
  const line = (cls: string) => <line className={cls} x1="1" y1="7" x2="29" y2="7" />;
  return (
    <svg className="mp-cs-fig__swatch" width="30" height="14" viewBox="0 0 30 14" aria-hidden="true">
      {kind === 'cable' || kind === 'state2' ? (
        <g className={`mp-cs-fig__curve mp-cs-fig__curve--${kind === 'cable' ? 'exact' : 'state2'}`}>
          <path d="M1 3 Q15 15 29 3" />
        </g>
      ) : kind === 'parabola' || kind === 'state1' ? (
        <g className={`mp-cs-fig__curve mp-cs-fig__curve--${kind === 'parabola' ? 'parabola' : 'state1'}`}>
          <path d="M1 3 Q15 15 29 3" />
        </g>
      ) : kind === 'polygon' ? (
        <line className="mp-cs-fig__piece" x1="4" y1="7" x2="26" y2="7" strokeWidth="5" />
      ) : kind === 'chord' ? (
        line('mp-cs-fig__chord')
      ) : kind === 'sagMid' || kind === 'sagLow' || kind === 'sagBoth' || kind === 'sagAt' || kind === 'vertical' || kind === 'verticalSag' || kind === 'verticalSmall' ? (
        <g className="mp-cs-fig__dim">
          <line x1="15" y1="1" x2="15" y2="13" />
          <line x1="11" y1="1" x2="19" y2="1" />
          <line x1="11" y1="13" x2="19" y2="13" />
        </g>
      ) : kind === 'load' || kind === 'pointLoad' || kind === 'H' ? (
        <g className={kind === 'load' ? 'mp-cs-fig__load' : kind === 'pointLoad' ? 'mp-cs-fig__pointload' : 'mp-cs-fig__harrow'}>
          <line x1="1" y1="7" x2="21" y2="7" />
          <polygon points="29,7 21,3.4 21,10.6" />
        </g>
      ) : kind === 'joint' ? (
        <g className="mp-cs-fig__joint">
          <circle cx="15" cy="7" r="4.5" />
        </g>
      ) : kind === 'support' ? (
        <g className="mp-cs-fig__support">
          <polygon points="15,1 9,12 21,12" />
        </g>
      ) : (
        <text className="mp-cs-fig__label" x="15" y="11" textAnchor="middle">
          12.3
        </text>
      )}
    </svg>
  );
}
