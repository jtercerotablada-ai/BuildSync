'use client';

import React, { useMemo } from 'react';
import { formatNumber } from '@/lib/calc/format';
import type { SlingDrawing } from '@/lib/calc/cable/analysis';
import type { CableUi } from '@/lib/calc/cable/strings';
import { ArrowGlyph, Swatch, anchorOf, arcPath, arrowFrom, clean, declutter, flip, place, polar, pt, type ArrowShape, type Label, type LegendKey, type Pt } from './figure';

/**
 * THE SLING - the load on one cable or two, as the calculator found it.
 *
 * The load point with its weight W (down) and horizontal force H, each leg
 * from the load point up to its anchor with the tension written along it, the
 * angle of each leg from the horizontal as an arc, and - on request - where the
 * load point ends up after the legs stretch: the position drawn with the move
 * EXAGGERATED by `moved.factor` (a stretch of a thousandth of the sling would
 * not show), the factor written on the drawing and in the page's note under it.
 *
 * It is given a `SlingDrawing` (lib/calc/cable/analysis.ts) and knows nothing of
 * the form or of the engine. `slingLayout` is arithmetic from end to end - where
 * every line, arrow, arc and label goes, in pixels - and `SlingSchematic` writes
 * what it returns as SVG and adds nothing of its own, so the layout is held to
 * its rules without React (cable-schematic.test.ts).
 *
 * Tension is told by the number on the leg, not by colour or weight: every leg
 * is the same line, which is what a printed sheet keeps.
 */

const NODE_R = 6;
const MAX_HEIGHT = 440;

export interface SlingOptions {
  width: number;
  /** Draw where the load point ends up (if the drawing has a move to show). */
  moved: boolean;
  /** What numbers are set apart with. */
  group: string;
  /** The force unit written after a size. */
  unit: string;
  /** The tallest the drawing may be (px). */
  maxHeight?: number;
}

export interface LegShape {
  leg: 1 | 2;
  /** The load point end and the anchor end, in pixels. */
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  angle: number;
  side: 'left' | 'right';
  tension: Label;
  /** The arc between the horizontal and the leg at the load point, with its label and the dotted horizontal it is measured from; null for a horizontal leg. */
  arc: { d: string; r: number; label: Label; ref: { x1: number; y1: number; x2: number; y2: number } } | null;
  /** The anchor: a plate across the leg's end and the hatching beyond it. */
  anchor: { plate: [Pt, Pt]; ticks: [Pt, Pt][] };
}

export interface MovedShape {
  /** Where the load point is drawn after the stretch, and the exaggeration it is drawn with. */
  point: Pt;
  factor: number;
  /** The legs as they would reach it, anchor to point. */
  links: { x1: number; y1: number; x2: number; y2: number }[];
  /** From the load point to where it goes. */
  move: { x1: number; y1: number; x2: number; y2: number };
  label: Label;
}

export interface SlingLayout {
  width: number;
  height: number;
  /** Pixels per unit of length. */
  scale: number;
  node: Pt & { r: number };
  legs: LegShape[];
  arrows: ArrowShape[];
  moved: MovedShape | null;
  legend: LegendKey[];
}

export function slingLayout(d: SlingDrawing | null, o: SlingOptions): SlingLayout {
  if (!d) return { width: o.width, height: 120, scale: 0, node: { x: clean(o.width / 2), y: 60, r: NODE_R }, legs: [], arrows: [], moved: null, legend: [] };
  const maxH = o.maxHeight ?? MAX_HEIGHT;
  const factor = o.moved && d.displaced && d.moveScale !== null ? d.moveScale : null;
  const shown = factor !== null && d.displaced ? { x: d.displaced.x * factor, y: d.displaced.y * factor } : null;

  // The world: the load point at the origin, the anchors above it, the exaggerated position wherever it lands.
  const xs = [0, ...d.anchors.map((a) => a.x), ...(shown ? [shown.x] : [])];
  const ys = [0, ...d.anchors.map((a) => a.y), ...(shown ? [shown.y] : [])];
  const xmin = Math.min(...xs);
  const xmax = Math.max(...xs);
  const ymin = Math.min(...ys);
  const ymax = Math.max(...ys);
  const span = Math.max(xmax - xmin, ymax - ymin, 1e-12);
  const ww = Math.max(xmax - xmin, 0.35 * span);
  const wh = Math.max(ymax - ymin, 0.35 * span);
  const hasW = d.arrows.some((a) => a.id === 'W');
  const padX = 44;
  const padTop = 40;
  const padBottom = hasW ? 82 : 36;
  const scale = Math.min((o.width - 2 * padX) / ww, (maxH - padTop - padBottom) / wh);
  const X = (x: number) => clean(o.width / 2 + (x - (xmin + xmax) / 2) * scale);
  const Y = (y: number) => clean(padTop + (ymax - y) * scale);
  const height = clean(Math.max(190, wh * scale + padTop + padBottom));
  const node = { x: X(0), y: Y(0), r: NODE_R };
  const num = (v: number, sig = 4) => formatNumber(v, sig, o.group);

  const legs: LegShape[] = d.anchors.map((a) => {
    const A = pt(X(a.x), Y(a.y));
    const len = Math.hypot(A.x - node.x, A.y - node.y) || 1;
    const u = { x: (A.x - node.x) / len, y: (A.y - node.y) / len };
    // The number stands beside the middle of the leg, on the side away from the sling's middle.
    let p = { x: -u.y, y: u.x };
    const outward = a.side === 'left' ? -1 : 1;
    if (Math.abs(p.x) < 0.2 ? p.y > 0 : p.x * outward < 0) p = { x: -p.x, y: -p.y };
    const mid = { x: (node.x + A.x) / 2, y: (node.y + A.y) / 2 };
    const name = d.anchors.length === 1 ? 'T' : `T${a.leg}`;
    const tension = place(`${name} = ${num(a.tension)} ${o.unit}`, mid.x + p.x * 14, mid.y + p.y * 14 + 4, anchorOf(p.x), o.width, height);
    // The angle from the horizontal on the leg's own side.
    const r = Math.max(10, Math.min(26, 0.35 * len));
    const dir = a.side === 'left' ? -1 : 1;
    const from = a.side === 'left' ? 180 : 0;
    const to = a.side === 'left' ? 180 - a.angle : a.angle;
    const mark = polar(node, r + 13, (from + to) / 2);
    const arc =
      a.angle >= 0.5
        ? {
            d: arcPath(node, r, from, to),
            r: clean(r),
            label: place(`${num(a.angle, 3)}°`, mark.x, mark.y + 4, anchorOf(mark.x - node.x), o.width, height),
            ref: { x1: node.x, y1: node.y, x2: clean(node.x + dir * (r + 16)), y2: node.y },
          }
        : null;
    // The plate across the anchor and the hatching beyond it, away from the load.
    const n = { x: -u.y, y: u.x };
    const plate: [Pt, Pt] = [pt(A.x + n.x * 13, A.y + n.y * 13), pt(A.x - n.x * 13, A.y - n.y * 13)];
    const ticks = [-9, -3, 3, 9].map((k): [Pt, Pt] => [pt(A.x + n.x * k, A.y + n.y * k), pt(A.x + n.x * k + u.x * 8 - n.x * 5, A.y + n.y * k + u.y * 8 - n.y * 5)]);
    return { leg: a.leg, x1: node.x, y1: node.y, x2: A.x, y2: A.y, angle: a.angle, side: a.side, tension, arc, anchor: { plate, ticks } };
  });

  // The loads: each from the load point, in the direction it acts.
  const arrows: ArrowShape[] = d.arrows.map((a) => {
    const dir = flip(a.dx, a.dy);
    const from = pt(node.x + dir.x * (NODE_R + 1), node.y + dir.y * (NODE_R + 1));
    return arrowFrom(a.id, from, dir, 26 + 20 * a.share, `${a.id} = ${num(a.magnitude)} ${o.unit}`, a.magnitude, o.width, height);
  });

  let moved: MovedShape | null = null;
  if (shown && factor !== null) {
    const P = pt(X(shown.x), Y(shown.y));
    moved = {
      point: P,
      factor,
      links: legs.map((l) => ({ x1: l.x2, y1: l.y2, x2: P.x, y2: P.y })),
      move: { x1: node.x, y1: node.y, x2: P.x, y2: P.y },
      label: place(`×${num(factor, 3)}`, P.x + NODE_R + 5, P.y + 4, 'start', o.width, height),
    };
  }

  // The loads' names first, then the legs', then the angles': a later one gives way.
  declutter([...arrows.map((a) => a.label), ...legs.map((l) => l.tension), ...legs.flatMap((l) => (l.arc ? [l.arc.label] : [])), ...(moved ? [moved.label] : [])], o.width, height);

  const legend: LegendKey[] = ['cable', 'anchor'];
  if (arrows.length) legend.push('load');
  if (legs.some((l) => l.arc)) legend.push('angle');
  if (moved) legend.push('moved');
  return { width: o.width, height, scale: clean(scale), node, legs, arrows, moved, legend };
}

export interface SlingSchematicProps extends SlingOptions {
  drawing: SlingDrawing | null;
  /** The drawing in one sentence, for whoever cannot see it. */
  summary: string;
  /** The legend's words. */
  legend: CableUi['results']['legend'];
}

export function SlingSchematic({ drawing, width, moved, group, unit, maxHeight, summary, legend: words }: SlingSchematicProps) {
  const layout = useMemo(() => slingLayout(drawing, { width, moved, group, unit, maxHeight }), [drawing, width, moved, group, unit, maxHeight]);
  return (
    <figure className="mp-cable-fig">
      <svg className="mp-plot__svg mp-cable-fig__svg" role="img" aria-label={summary} viewBox={`0 0 ${layout.width} ${layout.height}`} width={layout.width} height={layout.height}>
        <g aria-hidden="true">
          {layout.moved ? (
            <g className="mp-cable-fig__moved">
              {layout.moved.links.map((l, k) => (
                <line key={k} className="mp-cable-fig__ghost" x1={l.x1} y1={l.y1} x2={l.x2} y2={l.y2} />
              ))}
              <line className="mp-cable-fig__path" x1={layout.moved.move.x1} y1={layout.moved.move.y1} x2={layout.moved.move.x2} y2={layout.moved.move.y2} />
              <circle className="mp-cable-fig__ring" cx={layout.moved.point.x} cy={layout.moved.point.y} r={NODE_R} />
              <text className="mp-cable-fig__value" x={layout.moved.label.x} y={layout.moved.label.y} textAnchor={layout.moved.label.anchor}>
                {layout.moved.label.text}
              </text>
            </g>
          ) : null}
          {layout.legs.map((l) => (
            <g key={l.leg} className="mp-cable-fig__leg" data-leg={l.leg}>
              <g className="mp-cable-fig__anchor">
                <line x1={l.anchor.plate[0].x} y1={l.anchor.plate[0].y} x2={l.anchor.plate[1].x} y2={l.anchor.plate[1].y} />
                {l.anchor.ticks.map((t, k) => (
                  <line key={k} x1={t[0].x} y1={t[0].y} x2={t[1].x} y2={t[1].y} />
                ))}
              </g>
              <line className="mp-cable-fig__cable" x1={l.x1} y1={l.y1} x2={l.x2} y2={l.y2} />
              {l.arc ? (
                <g className="mp-cable-fig__angle">
                  <line className="mp-cable-fig__refline" x1={l.arc.ref.x1} y1={l.arc.ref.y1} x2={l.arc.ref.x2} y2={l.arc.ref.y2} />
                  <path className="mp-cable-fig__arc" d={l.arc.d} />
                  <text className="mp-cable-fig__value" x={l.arc.label.x} y={l.arc.label.y} textAnchor={l.arc.label.anchor}>
                    {l.arc.label.text}
                  </text>
                </g>
              ) : null}
              <text className="mp-cable-fig__value mp-cable-fig__value--tension" x={l.tension.x} y={l.tension.y} textAnchor={l.tension.anchor}>
                {l.tension.text}
              </text>
            </g>
          ))}
          {layout.arrows.map((a) => (
            <ArrowGlyph key={a.id} a={a} className="mp-cable-fig__load" />
          ))}
          <circle className="mp-cable-fig__node" cx={layout.node.x} cy={layout.node.y} r={layout.node.r} />
        </g>
      </svg>
      {layout.legend.length > 0 ? (
        <ul className="mp-cable-fig__legend">
          {layout.legend.map((key) => (
            <li key={key} className="mp-cable-fig__key">
              <Swatch kind={key} />
              <span>{words[key]}</span>
            </li>
          ))}
        </ul>
      ) : null}
    </figure>
  );
}
