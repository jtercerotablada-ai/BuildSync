'use client';

import React from 'react';
import { formatNumber } from '@/lib/calc/format';

/**
 * One diagram of the beam calculator: shear, moment or deflection along the
 * beam, drawn at the pixel width it is given (the calculator measures its
 * column — an SVG scaled by `viewBox` would shrink the numbers with it on a
 * phone).
 *
 * All three share one x scale with the schematic above them (`PLOT_PAD`), so
 * a support, a load and the kink it makes in each diagram line up down the
 * page. Positive is up: sagging moment above the axis, a beam deflecting
 * downward below it.
 *
 * The line passes through every station the engine returns, which includes
 * both sides of each jump — so a point load draws its step, not a slope.
 * The largest and smallest values are labelled where they occur; the value
 * under the pointer is the parent's to show (it moves a marker on all three
 * diagrams at once and prints the numbers in a table).
 */

/** Blank pixels left and right of the beam, in every diagram and in the schematic. */
export const PLOT_PAD = 30;

export const xToPx = (x: number, L: number, width: number) => PLOT_PAD + (L > 0 ? x / L : 0) * Math.max(1, width - 2 * PLOT_PAD);
export const pxToX = (px: number, L: number, width: number) => Math.min(L, Math.max(0, ((px - PLOT_PAD) / Math.max(1, width - 2 * PLOT_PAD)) * L));

export type PlotPoint = { x: number; y: number };

export function BeamPlot({
  title,
  unit,
  points,
  marks,
  breaks,
  L,
  width,
  height = 150,
  probe,
  onProbe,
  summary,
}: {
  title: string;
  unit: string;
  points: PlotPoint[];
  /** Values to label on the diagram: the extremes. */
  marks: PlotPoint[];
  /** Where something happens on the beam: a faint vertical guide at each. */
  breaks: number[];
  L: number;
  width: number;
  height?: number;
  /** The position under the pointer, and this diagram's value there. */
  probe: PlotPoint | null;
  onProbe: (x: number | null) => void;
  /** The diagram in words, for whoever cannot see it. */
  summary: string;
}) {
  const top = 22;
  const bottom = 20;
  let lo = 0;
  let hi = 0;
  for (const p of points) {
    if (p.y < lo) lo = p.y;
    if (p.y > hi) hi = p.y;
  }
  // A flat diagram still needs a scale; and a hair of noise is not a diagram.
  const span = hi - lo;
  const flat = !(span > 0);
  const y = (v: number) => (flat ? top + (height - top - bottom) / 2 : top + ((hi - v) / span) * (height - top - bottom));
  const px = (x: number) => xToPx(x, L, width);
  const zero = y(0);

  const line = points.map((p, i) => `${i ? 'L' : 'M'}${px(p.x).toFixed(1)} ${y(p.y).toFixed(1)}`).join(' ');
  const area = points.length ? `M${px(points[0].x).toFixed(1)} ${zero.toFixed(1)} ${line.replace(/^M/, 'L')} L${px(points[points.length - 1].x).toFixed(1)} ${zero.toFixed(1)} Z` : '';

  const move = (e: React.PointerEvent<SVGRectElement>) => {
    const box = e.currentTarget.getBoundingClientRect();
    // The overlay spans the beam exactly, so its own box is the scale.
    onProbe(box.width > 0 ? Math.min(L, Math.max(0, ((e.clientX - box.left) / box.width) * L)) : null);
  };

  return (
    <figure className="mp-plot">
      <figcaption className="mp-plot__title">
        {title} <span className="mp-plot__unit">({unit})</span>
      </figcaption>
      <svg className="mp-plot__svg" width={width} height={height} viewBox={`0 0 ${width} ${height}`} role="img" aria-label={summary}>
        {breaks.map((b) => (
          <line key={b} className="mp-plot__guide" x1={px(b)} x2={px(b)} y1={top - 6} y2={height - bottom + 6} />
        ))}
        {area ? <path className="mp-plot__area" d={area} /> : null}
        <line className="mp-plot__axis" x1={px(0)} x2={px(L)} y1={zero} y2={zero} />
        {line ? <path className="mp-plot__line" d={line} /> : null}
        {marks.map((m, i) => {
          const at = px(m.x);
          const above = m.y >= 0;
          const anchor = at < 70 ? 'start' : at > width - 70 ? 'end' : 'middle';
          return (
            <g key={`${i}-${m.x}`}>
              <circle className="mp-plot__dot" cx={at} cy={y(m.y)} r={3} />
              <text className="mp-plot__value" x={at} y={above ? y(m.y) - 8 : y(m.y) + 15} textAnchor={anchor}>
                {formatNumber(m.y)}
              </text>
            </g>
          );
        })}
        {probe ? (
          <g className="mp-plot__probe">
            <line x1={px(probe.x)} x2={px(probe.x)} y1={top - 6} y2={height - bottom + 6} />
            <circle cx={px(probe.x)} cy={y(probe.y)} r={4} />
          </g>
        ) : null}
        <rect
          className="mp-plot__hit"
          x={px(0)}
          y={0}
          width={Math.max(1, px(L) - px(0))}
          height={height}
          onPointerMove={move}
          onPointerDown={move}
          onPointerLeave={(e) => {
            // A finger lifting leaves the marker where it was; a mouse leaving clears it.
            if (e.pointerType === 'mouse') onProbe(null);
          }}
        />
      </svg>
    </figure>
  );
}
