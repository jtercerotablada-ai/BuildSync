'use client';

import React, { useMemo } from 'react';
import { formatNumber } from '@/lib/calc/format';
import type { DrawingArrow, DrawingMember, MemberState, TrussDrawing } from '@/lib/calc/truss/analysis';
import type { TrussUi } from '@/lib/calc/truss/strings';
import { signed } from './text';

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
 * TENSION AND COMPRESSION ARE TOLD APART BY THREE THINGS, so that it works on a
 * black-and-white sheet and for a reader who does not see colour: the COLOUR
 * (blue for tension, red for compression), the PATTERN (a tension is a solid
 * line, a compression a hollow one — an outline with the page showing through
 * the middle) and the SIGN written with the value (+ and −). A member with no
 * force is a thin dashed grey line. The weight of a line follows the size of its
 * force, to the largest of the truss.
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
 * THE DEFORMED SHAPE is the members drawn between the displaced nodes, dashed,
 * with the displacements multiplied by `drawing.deformScale` (the page says by
 * how much).
 *
 * A drawing of the visitor's own data: every number on it is in the tables
 * beside it too, so the SVG is described in one sentence (`summary`) and its
 * shapes are hidden from a screen reader. The pointer, though, can pick a
 * member out of it (hover, press), which marks the same member in the tables;
 * the tables carry the way for a keyboard.
 */

/** Pixel sizes at full scale; `k` (0.5 to 1) takes them down when the margin round the truss is narrow. */
const PIN_DEPTH = 22;
const ROLLER_DEPTH = 24;
const GAP = 3;
const LOAD_MIN = 16;
const LOAD_SPAN = 18;
const REACTION_LEN = 22;
const HEAD_LEN = 8;
const HEAD_HALF = 3.6;
const LABEL_OFFSET = 9;
const MAX_HEIGHT = 560;

export type Point = { x: number; y: number };

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
  /** The line's width, and for a compression the width of the page-coloured core that makes it hollow. */
  strokeWidth: number;
  core: number | null;
  /** The text on the member: its force and/or its number; null when none. */
  text: { value: string; x: number; y: number; anchor: 'start' | 'middle' | 'end' } | null;
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
}

export interface ArrowShape {
  /** The label of the row it is of (load, or support). */
  label: number;
  node: number;
  /** Where the shaft starts and where the head's tip is. */
  tail: Point;
  tip: Point;
  /** The size written by it, and where. */
  text: { value: string; x: number; y: number; anchor: 'start' | 'middle' | 'end' };
  magnitude: number;
}

export type LegendKey = 'tension' | 'compression' | 'zero' | 'unsolved' | 'load' | 'reaction' | 'node' | 'flagged' | 'deformed';

export interface Layout {
  width: number;
  height: number;
  /** Pixels per unit of length. */
  scale: number;
  members: MemberShape[];
  nodes: NodeShape[];
  supports: SupportShape[];
  loads: ArrowShape[];
  reactions: ArrowShape[];
  /** The deformed members, in pixels; null when the drawing has no displacements or they are not asked for. */
  deformed: { label: number; x1: number; y1: number; x2: number; y2: number }[] | null;
  /** How many times the displacements are multiplied; null when there is no deformed shape. */
  deformScale: number | null;
  legend: LegendKey[];
}

const clean = (v: number): number => {
  const r = Math.round(v * 1e6) / 1e6;
  return r === 0 ? 0 : r;
};

/** The sign of a force with its size: "+15", "−20", "0" — the same for the drawing and the tables. */
export const forceText = (v: number, group: string, significant = 4): string => signed(formatNumber(Math.abs(v), significant, group), v);

function anchorOf(x: number): 'start' | 'middle' | 'end' {
  return x > 0.5 ? 'start' : x < -0.5 ? 'end' : 'middle';
}

/** Where a number goes by an arrow's tail: beyond it, on the line it comes along. */
function tailText(tail: Point, dir: Point, value: string): ArrowShape['text'] {
  const away = { x: -dir.x, y: -dir.y };
  return { value, x: clean(tail.x + away.x * 6), y: clean(tail.y + away.y * 6 + (away.y < -0.5 ? -2 : away.y > 0.5 ? 9 : 4)), anchor: anchorOf(away.x) };
}

export function trussLayout(drawing: TrussDrawing, o: LayoutOptions): Layout {
  const f = drawing.frame;
  const maxHeight = o.maxHeight ?? MAX_HEIGHT;
  const scale = Math.min(o.width / f.width, maxHeight / f.height);
  const drawn = f.width * scale;
  const offX = (o.width - drawn) / 2;
  const height = clean(f.height * scale);
  const X = (x: number) => offX + (x - f.x0) * scale;
  const Y = (y: number) => (f.y1 - y) * scale;
  const k = Math.max(0.5, Math.min(1, (drawing.pad * scale) / 56));
  const r = clean(6 + 2 * k);
  const flagged = new Set(o.flagged ?? []);

  const byLabel = new Map(drawing.nodes.map((n) => [n.label, n]));
  const at = (label: number): Point => {
    const n = byLabel.get(label)!;
    return { x: X(n.x), y: Y(n.y) };
  };

  /* Members. */
  const members: MemberShape[] = drawing.members.map((m: DrawingMember) => {
    const a = { x: clean(X(m.x1)), y: clean(Y(m.y1)) };
    const b = { x: clean(X(m.x2)), y: clean(Y(m.y2)) };
    const len = Math.hypot(b.x - a.x, b.y - a.y) || 1;
    const d = { x: (b.x - a.x) / len, y: (b.y - a.y) / len };
    const state = m.state;
    const strokeWidth = state === null ? 2.5 : state === 'zero' ? 1.5 : clean(3.5 + 5 * m.weight);
    const core = state === 'compression' ? clean(strokeWidth - 3) : null;
    let text: MemberShape['text'] = null;
    const value = [o.numbers ? String(m.label) : '', o.forces && m.force !== null ? forceText(m.force, o.group) : ''].filter(Boolean).join(o.numbers && o.forces && m.force !== null ? ': ' : '');
    if (value) {
      const mid = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
      const vertical = Math.abs(d.x) < 0.05;
      let n = { x: d.y, y: -d.x };
      if (vertical ? n.x < 0 : n.y > 0) n = { x: -n.x, y: -n.y };
      const off = LABEL_OFFSET + strokeWidth / 2;
      text = vertical ? { value, x: clean(mid.x + off), y: clean(mid.y + 4), anchor: 'start' } : { value, x: clean(mid.x + n.x * off), y: clean(mid.y + n.y * off + 3), anchor: 'middle' };
    }
    return { label: m.label, i: m.i, j: m.j, x1: a.x, y1: a.y, x2: b.x, y2: b.y, state, strokeWidth, core, text };
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
    let side: Point;
    if (n.support.kind === 'roller' && n.support.angle !== null) {
      const a = (n.support.angle * Math.PI) / 180;
      // The ground is against the line of action: the reaction pushes the truss away from it.
      side = { x: clean(-Math.cos(a)), y: clean(Math.sin(a)) };
    } else {
      const towards = around(n.label);
      const clearance = (s: Point) => Math.max(-1, ...towards.map((t) => t.x * s.x + t.y * s.y));
      side = PIN_SIDES.find((s) => clearance(s) < 0.5) ?? PIN_SIDES.reduce((best, s) => (clearance(s) < clearance(best) ? s : best));
    }
    const rotation = clean((Math.atan2(-side.x, side.y) * 180) / Math.PI);
    return [{ node: n.label, kind: n.support.kind, x: clean(p.x), y: clean(p.y), rotation, side, depth: clean((n.support.kind === 'pin' ? PIN_DEPTH : ROLLER_DEPTH) * k), angle: n.support.angle }];
  });
  const supportAt = new Map(supports.map((s) => [s.node, s]));

  /* Arrows. */
  const loads: ArrowShape[] = drawing.loads.map((a: DrawingArrow) => {
    const p = at(a.node);
    const dir = { x: a.dx, y: -a.dy };
    const len = (LOAD_MIN + LOAD_SPAN * a.share) * k;
    const tip = { x: clean(p.x - dir.x * (r + 1)), y: clean(p.y - dir.y * (r + 1)) };
    const tail = { x: clean(tip.x - dir.x * len), y: clean(tip.y - dir.y * len) };
    return { label: a.label, node: a.node, tail, tip, text: tailText(tail, dir, formatNumber(a.magnitude, 4, o.group)), magnitude: a.magnitude };
  });
  const reactions: ArrowShape[] = drawing.reactions.map((a: DrawingArrow) => {
    const p = at(a.node);
    const s = supportAt.get(a.node);
    const side = s?.side ?? { x: 0, y: 1 };
    const depth = s?.depth ?? PIN_DEPTH * k;
    const dir = { x: a.dx, y: -a.dy };
    const len = REACTION_LEN * k;
    const start = { x: p.x + side.x * (depth + GAP * k), y: p.y + side.y * (depth + GAP * k) };
    const towardsNode = dir.x * side.x + dir.y * side.y < 0;
    const tip = towardsNode ? start : { x: start.x + dir.x * len, y: start.y + dir.y * len };
    const tail = towardsNode ? { x: start.x - dir.x * len, y: start.y - dir.y * len } : start;
    // The size stands beside the shaft, on the right of it, or under it when it runs across the page.
    const mid = { x: (tail.x + tip.x) / 2, y: (tail.y + tip.y) / 2 };
    let n = { x: dir.y, y: -dir.x };
    if (Math.abs(n.x) < 0.1 ? n.y < 0 : n.x < 0) n = { x: -n.x, y: -n.y };
    const text = { value: formatNumber(a.magnitude, 4, o.group), x: clean(mid.x + n.x * 8), y: clean(mid.y + n.y * 8 + (n.y > 0.5 ? 8 : 4)), anchor: anchorOf(n.x) };
    return { label: a.label, node: a.node, tail: { x: clean(tail.x), y: clean(tail.y) }, tip: { x: clean(tip.x), y: clean(tip.y) }, text, magnitude: a.magnitude };
  });

  /* The deformed shape. */
  const s = drawing.deformScale;
  let deformed: Layout['deformed'] = null;
  if (o.deformed && s !== null && drawing.nodes.some((n) => n.ux !== null)) {
    const moved = (label: number): Point | null => {
      const n = byLabel.get(label);
      return n && n.ux !== null && n.uy !== null ? { x: clean(X(n.x + n.ux * s)), y: clean(Y(n.y + n.uy * s)) } : null;
    };
    deformed = drawing.members.flatMap((m) => {
      const a = moved(m.i);
      const b = moved(m.j);
      return a && b ? [{ label: m.label, x1: a.x, y1: a.y, x2: b.x, y2: b.y }] : [];
    });
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

  return { width: o.width, height, scale: clean(scale), members, nodes, supports, loads, reactions, deformed, deformScale: deformed ? s : null, legend };
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

export interface TrussSchematicProps {
  drawing: TrussDrawing;
  width: number;
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
}

export function TrussSchematic({ drawing, width, forces, numbers, deformed, flagged, group, summary, active = null, onActive, onPick, legend: words }: TrussSchematicProps) {
  const layout = useMemo(() => trussLayout(drawing, { width, forces, numbers, deformed, group, flagged }), [drawing, width, forces, numbers, deformed, group, flagged]);
  const ends = active === null ? null : layout.members.find((m) => m.label === active);
  const mouse = (label: number | null) => (e: React.PointerEvent) => {
    if (e.pointerType === 'mouse' || label === null) onActive?.(label);
  };
  return (
    <figure className="mp-truss-fig">
      <svg className="mp-plot__svg mp-truss-fig__svg" role="img" aria-label={summary} viewBox={`0 0 ${layout.width} ${layout.height}`} width={layout.width} height={layout.height}>
        <g aria-hidden="true">
          {ends ? <line className="mp-truss-fig__halo" x1={ends.x1} y1={ends.y1} x2={ends.x2} y2={ends.y2} strokeWidth={ends.strokeWidth + 9} /> : null}
          {layout.deformed
            ? layout.deformed.map((m) => <line key={`d${m.label}`} className="mp-truss-fig__deformed" x1={m.x1} y1={m.y1} x2={m.x2} y2={m.y2} />)
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
          {layout.members.map((m) =>
            m.text ? (
              <text key={`t${m.label}`} className="mp-truss-fig__value" x={m.text.x} y={m.text.y} textAnchor={m.text.anchor}>
                {m.text.value}
              </text>
            ) : null,
          )}
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
      {layout.legend.length > 0 ? (
        <ul className="mp-truss-fig__legend">
          {layout.legend.map((key) => (
            <li key={key} className={`mp-truss-fig__key mp-truss-fig__key--${key}`}>
              <LegendSwatch kind={key} />
              <span>{words[key]}</span>
            </li>
          ))}
        </ul>
      ) : null}
    </figure>
  );
}

/** The small picture of a line or a mark, in the same classes as the drawing. */
function LegendSwatch({ kind }: { kind: LegendKey }) {
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
      ) : kind === 'deformed' ? (
        <line className="mp-truss-fig__deformed" x1="1" y1="7" x2="29" y2="7" />
      ) : (
        <g className={`mp-truss-fig__node${kind === 'flagged' ? ' mp-truss-fig__node--flagged' : ''}`}>
          <circle cx="15" cy="7" r="5" />
          {kind === 'flagged' ? <circle className="mp-truss-fig__ring" cx="15" cy="7" r="6.5" /> : null}
        </g>
      )}
    </svg>
  );
}
