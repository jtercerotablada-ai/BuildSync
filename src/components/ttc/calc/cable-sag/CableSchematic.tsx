'use client';

import React, { useMemo } from 'react';
import { formatNumber } from '@/lib/calc/format';
import type { CurveId, Dimension, Drawing } from '@/lib/calc/cable-sag/analysis';
import type { CableSagUi } from '@/lib/calc/cable-sag/strings';
import { niceStep } from './SweepChart';

/**
 * The cable as entered and — once solved — as it hangs: its curve, the supports, the chord
 * between them, the sags as dimension lines, the load as arrows, the pretension at the lowest
 * point and the tensions at the supports. One drawing in three modes:
 *
 *   hanging   the exact cable as a solid line and, when it differs from it, the parabola as a
 *             dashed one; the two sags (the usual one at midspan, and the depth of the lowest
 *             point below the lower support) as two dimension lines; the load as a row of
 *             arrows onto the cable.
 *   state     the cable in state 1 (dashed) and in state 2 (solid), with a sag line for each.
 *   points    the funicular polygon, its joints numbered, the loads as arrows with their sizes
 *             (longer for the larger), a line weight that follows the tension of each piece.
 *
 * It is given a `Drawing` (lib/calc/cable-sag/analysis.ts) and knows nothing of the form or of
 * the engine. The drawing is built even when the cable cannot be solved (then it is the two
 * supports and the chord).
 *
 * WHAT IS RECKONED AND WHAT IS DRAWN are two functions. `cableLayout` is arithmetic from end to
 * end: where every line, symbol, arrow and number goes, in pixels. `CableSchematic` writes what
 * it returns as SVG and adds nothing of its own, so the layout is held to its rules without
 * React (cable-sag-schematic.test.ts), and it is kept from one draw to the next (`useMemo`).
 *
 * THE KINDS OF LINE ARE TOLD APART BY PATTERN AS WELL AS BY COLOUR, so that it works on a
 * black-and-white sheet and for a reader who does not see colour: a solid line is the exact
 * cable (or state 2), a dashed one the parabola (or state 1), a thin dashed one the chord.
 * Every number on it is in the tables beside it too, so the SVG is described in one sentence
 * (`summary`) and its shapes are hidden from a screen reader.
 */

/** Pixel sizes at full scale; `k` (0.5 to 1) takes them down when the margin round the cable is narrow. */
const SUPPORT_DEPTH = 22;
const LOAD_MIN = 16;
const LOAD_SPAN = 18;
const SHORT_ARROW = 18;
const H_ARROW = 28;
const HEAD_LEN = 8;
const HEAD_HALF = 3.6;
/** A character of the drawing's 11 px mono, and what a label is kept clear of the edge by. */
const CHAR = 6.6;
const MAX_HEIGHT = 560;
/** The row under the drawing that holds its scale bar. */
const SCALE_ROW = 22;

export type Point = { x: number; y: number };
export type TextShape = { value: string; x: number; y: number; anchor: 'start' | 'middle' | 'end' };

export interface LayoutOptions {
  /** The drawing's width in pixels. */
  width: number;
  /** What numbers are set apart with, and the length unit written after a sag. */
  group: string;
  unit: string;
  /** The words written before each sag: the sag where the two are one, the usual one, the one below the lower support, and the sag of each state. */
  labels: { sag: string; sagMid: string; sagLow: string; state1: string; state2: string };
  /** The words beside the supports and at the lowest point, already written ("T = 13.46 kip"); none where null or left out. */
  texts?: { A?: string | null; B?: string | null; H?: string | null };
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
  text: TextShape;
}

export interface SupportShape {
  id: 'A' | 'B';
  x: number;
  y: number;
  /** How far under its point the symbol reaches, and its half width. */
  depth: number;
  half: number;
  letter: TextShape;
}

export interface DimShape {
  id: 'mid' | 'low' | 'state1';
  /** One line for the two sags, because they are the same line (a level span). */
  both: boolean;
  /** The sag the visitor gave. */
  given: boolean;
  x: number;
  y1: number;
  y2: number;
  /** The level line a sag below the lower support is measured from; null for the others. */
  level: { x1: number; x2: number; y: number } | null;
  text: TextShape;
}

export interface ArrowShape {
  label: number;
  tail: Point;
  tip: Point;
  text: TextShape | null;
  magnitude: number;
}

export type LegendKey = 'cable' | 'parabola' | 'chord' | 'sagMid' | 'sagLow' | 'sagBoth' | 'sagAt' | 'load' | 'tension' | 'H' | 'state1' | 'state2' | 'polygon' | 'pointLoad' | 'joint' | 'support';

export interface Layout {
  width: number;
  height: number;
  /** Pixels per unit of length. */
  scale: number;
  chord: { x1: number; y1: number; x2: number; y2: number };
  supports: SupportShape[];
  curves: CurveShape[];
  segments: SegmentShape[];
  joints: JointShape[];
  dims: DimShape[];
  tensions: { id: 'A' | 'B'; text: TextShape }[];
  /** The pretension at the lowest point: a horizontal arrow under it and its words. Null where the lowest point is a support or none is wanted. */
  H: { x: number; y: number; arrow: { x1: number; x2: number; y: number }; text: TextShape } | null;
  /** A bar as long as a round length of the cable's own, under the drawing at its left. */
  scaleBar: { x1: number; x2: number; y: number; length: number; text: TextShape };
  loadArrows: ArrowShape[];
  pointLoads: ArrowShape[];
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

export function cableLayout(drawing: Drawing, o: LayoutOptions): Layout {
  const f = drawing.frame;
  const maxHeight = o.maxHeight ?? MAX_HEIGHT;
  const scale = Math.min(o.width / f.width, maxHeight / f.height);
  const drawn = f.width * scale;
  const offX = (o.width - drawn) / 2;
  const padPx = drawing.pad * scale;
  const k = Math.max(0.5, Math.min(1, padPx / 56));
  const r = clean(3.2 + 1.2 * k);

  const mode = drawing.mode;
  const points = mode === 'points';
  // The room above and under what the frame leaves: an arrow with its number, a label, the pretension under the lowest point.
  const topNeed = clean(Math.max(28, points ? (LOAD_MIN + LOAD_SPAN) * k + 22 : 0));
  const bottomNeed = clean(40 * k + 6);
  const top = Math.max(0, topNeed - padPx);
  const bottom = Math.max(0, bottomNeed - padPx);
  const X = (x: number) => offX + (x - f.x0) * scale;
  const Y = (z: number) => top + (f.z1 - z) * scale;
  const drawnHeight = clean(top + f.height * scale + bottom);
  const height = clean(drawnHeight + SCALE_ROW);
  const at = (p: { x: number; z: number }): Point => ({ x: clean(X(p.x)), y: clean(Y(p.z)) });

  const A = at(drawing.supports.A);
  const B = at(drawing.supports.B);
  const exact = drawing.curves.find((c) => c.id === 'exact' || c.id === 'state2' || c.id === 'polygon');

  /* Supports. */
  const half = clean(10 * k + 1);
  const depth = clean(SUPPORT_DEPTH * k);
  const supports: SupportShape[] = [
    { id: 'A', x: A.x, y: A.y, depth, half, letter: { value: 'A', x: A.x, y: clean(A.y + depth + 12), anchor: 'middle' } },
    { id: 'B', x: B.x, y: B.y, depth, half, letter: { value: 'B', x: B.x, y: clean(B.y + depth + 12), anchor: 'middle' } },
  ];

  /* Curves, and for a polygon its pieces. */
  const curves: CurveShape[] = drawing.curves
    .filter((c) => c.id !== 'parabola' || o.parabola)
    .map((c) => {
      const pts = c.points.map(at);
      return { id: c.id, points: pts, d: pts.map((p, i) => `${i === 0 ? 'M' : 'L'}${pixel(p.x)} ${pixel(p.y)}`).join(' ') };
    });
  const segments: SegmentShape[] = [];
  const polygon = curves.find((c) => c.id === 'polygon');
  if (polygon) {
    for (let i = 1; i < polygon.points.length; i++) {
      const share = o.shares?.[i - 1] ?? 0.5;
      segments.push({ label: i, x1: polygon.points[i - 1].x, y1: polygon.points[i - 1].y, x2: polygon.points[i].x, y2: polygon.points[i].y, width: clean(1.75 + 3 * share) });
    }
  }

  /* Joints of a polygon: a dot on each load, its number under it. */
  const joints: JointShape[] = drawing.loads.map((l) => {
    const p = at(l);
    return { label: l.label, x: p.x, y: p.y, r, text: { value: String(l.label), x: p.x, y: clean(p.y + r + 12), anchor: 'middle' } };
  });

  /* Dimension lines. */
  const dims: DimShape[] = [];
  const dimLine = (id: DimShape['id'], d: Dimension, label: string, anchor: 'start' | 'end', shift = 0): DimShape => {
    const x = clean(X(d.x) + shift);
    const y1 = clean(Y(d.zTop));
    const y2 = clean(Y(d.zBottom));
    // A line too short to hold its words beside it carries them over the chord instead, clear of every line.
    const short = Math.abs(y2 - y1) < 18;
    // A sag measured from the lower support's level has its words over the level line it is measured from.
    const textY = d.from !== undefined ? y1 - 6 : short ? Math.min(y1, y2) - 6 : (y1 + y2) / 2 + 4;
    const text: TextShape = { value: `${label} ${formatNumber(d.value, 4, o.group)} ${o.unit}`, x: clean(x + (anchor === 'start' ? 7 : -7)), y: clean(textY), anchor };
    return {
      id,
      both: false,
      given: false,
      x,
      y1,
      y2,
      level: d.from === undefined ? null : { x1: clean(X(d.from)), x2: x, y: y1 },
      text,
    };
  };
  if (o.dims) {
    const { mid, low, state1 } = drawing.sag;
    if (mode === 'state') {
      // What the visitor gave is state 1's sag.
      if (state1) dims.push({ ...dimLine('state1', state1, o.labels.state1, 'end', -6), given: drawing.sag.given === 'mid' });
      if (mid) dims.push({ ...dimLine('mid', mid, o.labels.state2, 'start'), given: false });
    } else if (mid && low) {
      const same = Math.abs(X(mid.x) - X(low.x)) < 1 && Math.abs(Y(mid.zTop) - Y(low.zTop)) < 0.5 && Math.abs(Y(mid.zBottom) - Y(low.zBottom)) < 0.5;
      if (same) {
        const d = dimLine('mid', mid, o.labels.sag, 'start');
        dims.push({ ...d, both: true, given: drawing.sag.given !== null });
      } else {
        // The two labels point away from each other.
        const midLeft = mid.x < low.x;
        dims.push({ ...dimLine('mid', mid, o.labels.sagMid, midLeft ? 'end' : 'start'), given: drawing.sag.given === 'mid' });
        dims.push({ ...dimLine('low', low, o.labels.sagLow, midLeft ? 'start' : 'end'), given: drawing.sag.given === 'low' });
      }
    } else if (mid) {
      // At a load's own position the sag line would run down its arrow: it stands a little to the left of it, its words on that side.
      const onLoad = points && joints.some((j) => Math.abs(j.x - X(mid.x)) < 12);
      dims.push({ ...dimLine('mid', mid, points ? o.labels.sag : o.labels.sagMid, onLoad ? 'end' : 'start', onLoad ? -12 : 0), given: drawing.sag.given === 'mid' });
    }
    else if (low) dims.push({ ...dimLine('low', low, o.labels.sagLow, 'start'), given: drawing.sag.given === 'low' });
  }

  /* The tensions beside the supports: outside where there is room, over the support where there is not. */
  const tensions: Layout['tensions'] = [];
  if (o.tensions) {
    for (const [id, p, side] of [['A', A, -1], ['B', B, 1]] as const) {
      const value = o.texts?.[id];
      if (!value) continue;
      const need = value.length * CHAR + 14;
      const room = side < 0 ? p.x : o.width - p.x;
      const outside = room >= need;
      const x = clean(outside ? p.x + side * 10 : p.x - side * 2);
      // Over the support it stands above the chord along all its length: a chord that climbs away from it would run through the words.
      const far = x + (side < 0 ? 1 : -1) * value.length * CHAR;
      const chordAt = B.x === A.x ? p.y : A.y + ((B.y - A.y) * (far - A.x)) / (B.x - A.x);
      tensions.push({
        id,
        text: { value, x, y: clean(outside ? p.y - 10 : Math.min(p.y, chordAt) - 9), anchor: outside ? (side < 0 ? 'end' : 'start') : side < 0 ? 'start' : 'end' },
      });
    }
  }

  /* The pretension: an arrow under the lowest point, and its words. */
  let H: Layout['H'] = null;
  const lowest = at(drawing.labels.H);
  const atSupport = (p: Point) => Math.abs(p.x - lowest.x) < 0.5 && Math.abs(p.y - lowest.y) < 0.5;
  if (o.tensions && o.texts?.H && !atSupport(A) && !atSupport(B)) {
    const arrowY = clean(lowest.y + 11 * k + 3);
    H = {
      x: lowest.x,
      y: lowest.y,
      arrow: { x1: clean(lowest.x - (H_ARROW * k) / 2), x2: clean(lowest.x + (H_ARROW * k) / 2), y: arrowY },
      text: { value: o.texts.H, x: lowest.x, y: clean(arrowY + 15), anchor: 'middle' },
    };
  }

  /* The scale: a bar of a round length, about a fifth of the drawing's width. */
  const barLength = niceStep(f.width * 0.2, 1);
  const barY = clean(drawnHeight + SCALE_ROW / 2 + 2);
  const barX1 = clean(Math.max(4, offX + 4));
  const barX2 = clean(barX1 + barLength * scale);
  const scaleBar: Layout['scaleBar'] = { x1: barX1, x2: barX2, y: barY, length: barLength, text: { value: `${formatNumber(barLength, 4, o.group)} ${o.unit}`, x: clean(barX2 + 8), y: clean(barY + 4), anchor: 'start' } };

  /* The load of a hanging cable: a row of arrows onto it. */
  const loadArrows: ArrowShape[] = [];
  if (mode === 'hanging' && o.load && exact) {
    const count = Math.max(4, Math.min(13, Math.floor(o.width / 56)));
    const L = drawing.supports.B.x - drawing.supports.A.x;
    const len = clean(SHORT_ARROW * k);
    // Clear of the sag lines and of the words beside them.
    const avoid: { lo: number; hi: number; top: number; bottom: number }[] = dims.flatMap((d) => {
      const w = d.text.value.length * CHAR;
      const words = d.text.anchor === 'start' ? { lo: d.text.x - 4, hi: d.text.x + w + 4 } : { lo: d.text.x - w - 4, hi: d.text.x + 4 };
      return [{ lo: d.x - 10, hi: d.x + 10, top: -Infinity, bottom: Infinity }, { ...words, top: d.text.y - 13, bottom: d.text.y + 4 }];
    });
    for (let i = 1; i <= count; i++) {
      const x = drawing.supports.A.x + (L * i) / (count + 1);
      const px = clean(X(x));
      const tip = { x: px, y: clean(Y(levelAt(exact.points, x)) - 2) };
      if (avoid.some((a) => px >= a.lo && px <= a.hi && tip.y >= a.top && tip.y - len <= a.bottom)) continue;
      loadArrows.push({ label: i, tail: { x: px, y: clean(tip.y - len) }, tip, text: null, magnitude: 0 });
    }
  }

  /* The point loads of a funicular cable: an arrow onto its joint, longer for the larger, with its size at the tail. */
  const pointLoads: ArrowShape[] = drawing.loads.map((l) => {
    const p = at(l);
    const len = clean((LOAD_MIN + LOAD_SPAN * l.share) * k);
    const down = l.P >= 0;
    const tip = { x: p.x, y: clean(down ? p.y - r - 1 : p.y + r + 1) };
    const tail = { x: p.x, y: clean(down ? tip.y - len : tip.y + len) };
    return { label: l.label, tail, tip, text: { value: withSign(l.P, o.group), x: p.x, y: clean(down ? tail.y - 5 : tail.y + 13), anchor: 'middle' }, magnitude: Math.abs(l.P) };
  });

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
  if (tensions.length > 0) legend.push('tension');
  if (H) legend.push('H');
  legend.push('support');

  return {
    width: o.width,
    height,
    scale: clean(scale),
    chord: { x1: A.x, y1: A.y, x2: B.x, y2: B.y },
    supports,
    curves,
    segments,
    joints,
    dims,
    tensions,
    H,
    scaleBar,
    loadArrows,
    pointLoads,
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
      {a.text ? (
        <text x={a.text.x} y={a.text.y} textAnchor={a.text.anchor}>
          {a.text.value}
        </text>
      ) : null}
    </g>
  );
}

export interface CableSchematicProps extends Omit<LayoutOptions, 'maxHeight'> {
  drawing: Drawing;
  /** The drawing in one sentence, for whoever cannot see it. */
  summary: string;
  /** The legend's words. */
  legend: CableSagUi['results']['legend'];
  maxHeight?: number;
}

export function CableSchematic({ drawing, summary, legend: words, ...options }: CableSchematicProps) {
  const { width, group, unit, labels, texts, tensions, dims, load, parabola, shares, maxHeight } = options;
  const layout = useMemo(() => cableLayout(drawing, { width, group, unit, labels, texts, tensions, dims, load, parabola, shares, maxHeight }), [drawing, width, group, unit, labels, texts, tensions, dims, load, parabola, shares, maxHeight]);
  return (
    <figure className="mp-cs-fig">
      <svg className="mp-plot__svg mp-cs-fig__svg" role="img" aria-label={summary} viewBox={`0 0 ${layout.width} ${layout.height}`} width={layout.width} height={layout.height}>
        <g aria-hidden="true">
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
              <line x1={d.x} y1={d.y1} x2={d.x} y2={d.y2} />
              <line x1={d.x - 4} y1={d.y1} x2={d.x + 4} y2={d.y1} />
              <line x1={d.x - 4} y1={d.y2} x2={d.x + 4} y2={d.y2} />
              <text x={d.text.x} y={d.text.y} textAnchor={d.text.anchor}>
                {d.text.value}
              </text>
            </g>
          ))}
          {layout.pointLoads.map((a) => (
            <Arrow key={`l${a.label}`} a={a} className="mp-cs-fig__pointload" />
          ))}
          {layout.joints.map((j) => (
            <g key={`j${j.label}`} className="mp-cs-fig__joint">
              <circle cx={j.x} cy={j.y} r={j.r} />
              <text x={j.text.x} y={j.text.y} textAnchor={j.text.anchor}>
                {j.text.value}
              </text>
            </g>
          ))}
          {layout.supports.map((s) => (
            <text key={`t${s.id}`} className="mp-cs-fig__letter" x={s.letter.x} y={s.letter.y} textAnchor={s.letter.anchor}>
              {s.letter.value}
            </text>
          ))}
          {layout.tensions.map((t) => (
            <text key={`T${t.id}`} className="mp-cs-fig__tension" x={t.text.x} y={t.text.y} textAnchor={t.text.anchor}>
              {t.text.value}
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
          {layout.H ? (
            <g className="mp-cs-fig__h">
              <circle cx={layout.H.x} cy={layout.H.y} r={3} />
              <Arrow a={{ label: 0, tail: { x: layout.H.arrow.x1, y: layout.H.arrow.y }, tip: { x: layout.H.arrow.x2, y: layout.H.arrow.y }, text: layout.H.text, magnitude: 0 }} className="mp-cs-fig__harrow" />
            </g>
          ) : null}
        </g>
      </svg>
      <ul className="mp-cs-fig__legend">
        {layout.legend.map((key) => (
          <li key={key} className={`mp-cs-fig__key mp-cs-fig__key--${key}`}>
            <LegendSwatch kind={key} />
            <span>{words[key]}</span>
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
        <line className="mp-cs-fig__piece" x1="1" y1="4" x2="15" y2="11" strokeWidth="3.5" />
      ) : kind === 'chord' ? (
        line('mp-cs-fig__chord')
      ) : kind === 'sagMid' || kind === 'sagLow' || kind === 'sagBoth' || kind === 'sagAt' ? (
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
        <text className="mp-cs-fig__tension" x="15" y="11" textAnchor="middle">
          12.3
        </text>
      )}
    </svg>
  );
}
