import React from 'react';

/**
 * What the cable calculator's four drawings (SlingSchematic, PullSchematic,
 * PullCurve, DrumSchematic) have in common: small geometry on the page's
 * pixels, a label that is kept inside its drawing, an arrow, and the legend's
 * swatches. No words and no numbers of its own: a drawing is given both.
 *
 * Every drawing has two halves, as the truss's does: a LAYOUT function that is
 * arithmetic from end to end (where each line, arrow and label goes, in pixels)
 * and is held to its rules without React, and a component that writes what the
 * layout returned as SVG and adds nothing of its own.
 *
 * PIXELS. x to the right, y DOWN, as SVG has them. The calculators' own frame
 * (analysis.ts) has y UP; each layout flips it once, at the edge, with `flip`.
 */

export type Pt = { x: number; y: number };
export type Anchor = 'start' | 'middle' | 'end';
export interface Label {
  text: string;
  x: number;
  y: number;
  anchor: Anchor;
}

/** Pixel sizes of an arrow's head, the label's type and the width of one character of it (the mono of the page's drawings). */
export const HEAD_LEN = 9;
export const HEAD_HALF = 3.8;
export const FONT = 11;
export const GLYPH = 6.8;

/** A pixel value kept to a millionth, and never -0: what a layout returns. */
export const clean = (v: number): number => {
  const r = Math.round(v * 1e6) / 1e6;
  return r === 0 ? 0 : r;
};
export const pt = (x: number, y: number): Pt => ({ x: clean(x), y: clean(y) });

/** The unit vector of a direction given in the calculators' frame (y up), on the page (y down). */
export const flip = (dx: number, dy: number): Pt => pt(dx, -dy);

/** The point at distance r from c in the direction `deg`, an angle measured counter-clockwise on the page as a reader sees it. */
export function polar(c: Pt, r: number, deg: number): Pt {
  const a = (deg * Math.PI) / 180;
  return pt(c.x + r * Math.cos(a), c.y - r * Math.sin(a));
}

/** The path of an arc about c, radius r, from one angle to another (degrees, counter-clockwise as seen; the sweep is the shorter way unless |to - from| is more than 180). */
export function arcPath(c: Pt, r: number, from: number, to: number): string {
  const a = polar(c, r, from);
  const b = polar(c, r, to);
  const large = Math.abs(to - from) > 180 ? 1 : 0;
  // SVG's sweep flag 1 is clockwise on the page; an increasing angle runs the other way.
  const sweep = to > from ? 0 : 1;
  return `M ${a.x} ${a.y} A ${clean(r)} ${clean(r)} 0 ${large} ${sweep} ${b.x} ${b.y}`;
}

/** The anchor a label has for a direction it sits along: the side it is pushed to. */
export const anchorOf = (x: number): Anchor => (x > 0.35 ? 'start' : x < -0.35 ? 'end' : 'middle');

/** The horizontal extent a label takes. */
export function labelSpan(l: Label): [number, number] {
  const w = l.text.length * GLYPH;
  return l.anchor === 'start' ? [l.x, l.x + w] : l.anchor === 'end' ? [l.x - w, l.x] : [l.x - w / 2, l.x + w / 2];
}

/** A label moved sideways until it lies inside the drawing; one wider than the drawing starts at its edge. */
export function fitLabel(l: Label, width: number, pad = 4): Label {
  const [x0, x1] = labelSpan(l);
  const w = x1 - x0;
  if (w > width - 2 * pad) return { ...l, anchor: 'start', x: pad };
  let dx = 0;
  if (x0 < pad) dx = pad - x0;
  else if (x1 > width - pad) dx = width - pad - x1;
  return dx === 0 ? l : { ...l, x: clean(l.x + dx) };
}

/** A label of a drawing: kept inside it both ways. */
export function place(text: string, x: number, y: number, anchor: Anchor, width: number, height: number, pad = 4): Label {
  const fitted = fitLabel({ text, x: clean(x), y: clean(y), anchor }, width, pad);
  return { ...fitted, y: clean(Math.min(Math.max(fitted.y, FONT), height - 3)) };
}

/** The box a label takes on the page. */
export interface Box {
  x0: number;
  x1: number;
  y0: number;
  y1: number;
}
export function boxOf(l: Label): Box {
  const [x0, x1] = labelSpan(l);
  return { x0, x1, y0: l.y - FONT, y1: l.y + 3 };
}
const overlap = (a: Box, b: Box, pad = 1): boolean => a.x0 < b.x1 + pad && b.x0 < a.x1 + pad && a.y0 < b.y1 + pad && b.y0 < a.y1 + pad;

/** Where a label may go instead of where it was put, nearest first. */
const NUDGES: [number, number][] = [
  [0, 0],
  [0, -13],
  [0, 13],
  [14, 0],
  [-14, 0],
  [0, -26],
  [0, 26],
  [14, -13],
  [-14, -13],
  [14, 13],
  [-14, 13],
  [0, -39],
  [0, 39],
  [28, 0],
  [-28, 0],
];

/**
 * Labels that do not lie on one another. Taken in order - the first is where it
 * was put - each later one is moved to the nearest of a few places where it
 * touches none of the labels before it (and stays inside the drawing); one that
 * finds no place stays where it was put. The labels are the layout's own, made for
 * this drawing, and are moved in place.
 */
export function declutter(labels: Label[], width: number, height: number): void {
  const placed: Box[] = [];
  for (const l of labels) {
    const home = { x: l.x, y: l.y, anchor: l.anchor };
    let chosen: Label | null = null;
    for (const [dx, dy] of NUDGES) {
      const c = place(l.text, home.x + dx, home.y + dy, home.anchor, width, height);
      if (!placed.some((b) => overlap(boxOf(c), b))) {
        chosen = c;
        break;
      }
    }
    const c = chosen ?? place(l.text, home.x, home.y, home.anchor, width, height);
    l.x = c.x;
    l.y = c.y;
    placed.push(boxOf(l));
  }
}

export interface ArrowShape {
  id: string;
  /** Where the shaft starts and where the head's tip is. */
  tail: Pt;
  tip: Pt;
  label: Label;
  /** The unit vector on the page it points along. */
  dir: Pt;
  /** The magnitude it stands for (the force unit shown). */
  magnitude: number;
}

/** An arrow from `from`, along `dir` (page frame), `length` long, with its label beyond the tip. */
export function arrowFrom(id: string, from: Pt, dir: Pt, length: number, text: string, magnitude: number, width: number, height: number): ArrowShape {
  const tip = pt(from.x + dir.x * length, from.y + dir.y * length);
  const gap = 7;
  const x = tip.x + dir.x * gap;
  const y = tip.y + dir.y * gap + (dir.y > 0.35 ? FONT : dir.y < -0.35 ? -2 : 4);
  return { id, tail: pt(from.x, from.y), tip, dir: pt(dir.x, dir.y), magnitude, label: place(text, x, y, anchorOf(dir.x), width, height) };
}

export function ArrowGlyph({ a, className }: { a: ArrowShape; className: string }) {
  const len = Math.hypot(a.tip.x - a.tail.x, a.tip.y - a.tail.y) || 1;
  const u = { x: (a.tip.x - a.tail.x) / len, y: (a.tip.y - a.tail.y) / len };
  const base = { x: a.tip.x - u.x * HEAD_LEN, y: a.tip.y - u.y * HEAD_LEN };
  const head = `${a.tip.x},${a.tip.y} ${base.x - u.y * HEAD_HALF},${base.y + u.x * HEAD_HALF} ${base.x + u.y * HEAD_HALF},${base.y - u.x * HEAD_HALF}`;
  return (
    <g className={className} data-arrow={a.id}>
      <line x1={a.tail.x} y1={a.tail.y} x2={base.x} y2={base.y} />
      <polygon points={head} />
      <text x={a.label.x} y={a.label.y} textAnchor={a.label.anchor}>
        {a.label.text}
      </text>
    </g>
  );
}

/** Whether a value is usable as a coordinate. */
export const finite = (...v: number[]): boolean => v.every((x) => Number.isFinite(x));

/** The legend's kinds, shared by the four drawings. */
export type LegendKey =
  | 'cable'
  | 'load'
  | 'moved'
  | 'anchor'
  | 'angle'
  | 'weight'
  | 'normal'
  | 'friction'
  | 'tension'
  | 'slope'
  | 'drum'
  | 'wrap'
  | 'resultant'
  | 'minimum'
  | 'chosen'
  | 'lift'
  | 'start'
  | 'run'
  | 'accel';

/** The small picture of a line or a mark in a legend, in the same classes as the drawings. */
export function Swatch({ kind }: { kind: LegendKey }) {
  const arrow = (cls: string) => (
    <g className={cls}>
      <line x1="1" y1="7" x2="21" y2="7" />
      <polygon points="29,7 21,3.4 21,10.6" />
    </g>
  );
  return (
    <svg className="mp-cable-fig__swatch" width="30" height="14" viewBox="0 0 30 14" aria-hidden="true">
      {kind === 'cable' ? (
        <line className="mp-cable-fig__cable" x1="1" y1="7" x2="29" y2="7" />
      ) : kind === 'moved' ? (
        <line className="mp-cable-fig__ghost" x1="1" y1="7" x2="29" y2="7" />
      ) : kind === 'load' || kind === 'weight' ? (
        arrow('mp-cable-fig__load')
      ) : kind === 'tension' ? (
        arrow('mp-cable-fig__tension')
      ) : kind === 'normal' ? (
        arrow('mp-cable-fig__normal')
      ) : kind === 'friction' ? (
        arrow('mp-cable-fig__friction')
      ) : kind === 'resultant' ? (
        arrow('mp-cable-fig__resultant')
      ) : kind === 'anchor' ? (
        <g className="mp-cable-fig__anchor">
          <line x1="5" y1="9" x2="25" y2="9" />
          <line x1="8" y1="9" x2="4" y2="13" />
          <line x1="15" y1="9" x2="11" y2="13" />
          <line x1="22" y1="9" x2="18" y2="13" />
        </g>
      ) : kind === 'angle' ? (
        <path className="mp-cable-fig__arc" d="M 4 12 A 12 12 0 0 1 16 4" />
      ) : kind === 'slope' ? (
        <g className="mp-cable-fig__anchor">
          <line x1="1" y1="5" x2="29" y2="5" />
          <line x1="6" y1="5" x2="2" y2="10" />
          <line x1="14" y1="5" x2="10" y2="10" />
          <line x1="22" y1="5" x2="18" y2="10" />
        </g>
      ) : kind === 'drum' ? (
        <circle className="mp-cable-fig__drum" cx="15" cy="7" r="5.5" />
      ) : kind === 'wrap' ? (
        <path className="mp-cable-fig__wrap" d="M 6 12 A 10 10 0 0 1 24 12" />
      ) : kind === 'minimum' ? (
        <polygon className="mp-cable-fig__minimum" points="15,1.5 20,7 15,12.5 10,7" />
      ) : kind === 'chosen' ? (
        <line className="mp-cable-fig__chosen" x1="15" y1="0" x2="15" y2="14" />
      ) : kind === 'lift' ? (
        <line className="mp-cable-fig__lift" x1="15" y1="0" x2="15" y2="14" />
      ) : (
        <g className={`mp-cable-fig__curve mp-cable-fig__curve--${kind}`}>
          <line x1="1" y1="7" x2="29" y2="7" />
          <Mark kind={kind} x={15} y={7} />
        </g>
      )}
    </svg>
  );
}

/** The marker of a regime on its curve: a circle, a square or a triangle, so that the three are told apart without colour. */
export function Mark({ kind, x, y }: { kind: 'start' | 'run' | 'accel' | LegendKey; x: number; y: number }) {
  if (kind === 'run') return <rect className="mp-cable-fig__mark" x={x - 3.5} y={y - 3.5} width="7" height="7" />;
  if (kind === 'accel') return <polygon className="mp-cable-fig__mark" points={`${x},${y - 4.5} ${x + 4.2},${y + 3} ${x - 4.2},${y + 3}`} />;
  return <circle className="mp-cable-fig__mark" cx={x} cy={y} r="3.6" />;
}
