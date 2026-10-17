'use client';

import React, { useMemo } from 'react';
import { formatNumber } from '@/lib/calc/format';

/**
 * A small line chart for the tables of a change of state: one quantity of the cable (its sag, its
 * pretension) against the temperature or the load factor of the table's rows.
 *
 * WHAT IS RECKONED AND WHAT IS DRAWN are two functions, as in the cable's own drawing
 * (CableSchematic.tsx): `chartLayout` is arithmetic — the axes with their ticks and their numbers,
 * the line in runs (a row with no solution breaks it), the dots, the ring on the row that is state 2
 * — and `SweepChart` writes it as SVG. The chart is a picture of the table beside it: it carries a
 * sentence (`about`) that says where the line begins, ends, is least and is most, and the table is
 * the way to every number.
 *
 * Axes are honest: ticks at round numbers, labelled with the figures that tell them apart and no
 * more, never "-0" or an exponent; the vertical axis does not have to start at zero (it is a
 * line, not bars) and says so by its ticks.
 */

export interface ChartPoint {
  x: number;
  /** null: the row has no solution. */
  y: number | null;
  /** The row that is state 2 as set up. */
  current: boolean;
}

export interface ChartOptions {
  width: number;
  height: number;
  group: string;
}

export interface Tick {
  /** Pixels along its axis. */
  at: number;
  value: number;
  text: string;
}

export interface Dot {
  x: number;
  y: number;
  current: boolean;
}

export interface ChartLayout {
  width: number;
  height: number;
  /** The plotting area, in pixels. */
  plot: { x0: number; y0: number; x1: number; y1: number };
  xTicks: Tick[];
  yTicks: Tick[];
  /** The line, as one path for each run of rows that have a solution. */
  runs: string[];
  dots: Dot[];
  /** Where a row with no solution would stand on the horizontal axis. */
  gaps: number[];
  /** Least and most of the values drawn, with the x of the first row that has each; null where no row has a solution. */
  least: { x: number; y: number } | null;
  most: { x: number; y: number } | null;
}

const MARGIN = { left: 56, right: 14, top: 22, bottom: 34 };

const pixel = (v: number): string => String(Math.round(v * 100) / 100 || 0);

/** A round step that gives about `count` ticks over `range`. */
export function niceStep(range: number, count: number): number {
  if (!(range > 0) || !Number.isFinite(range)) return 1;
  const raw = range / Math.max(1, count);
  const magnitude = 10 ** Math.floor(Math.log10(raw));
  const n = raw / magnitude;
  return (n < 1.5 ? 1 : n < 3 ? 2 : n < 7 ? 5 : 10) * magnitude;
}

/** Round numbers from `min` to `max`, a step apart; the ends included only where they are on the grid. */
export function niceTicks(min: number, max: number, count: number): { step: number; values: number[] } {
  const step = niceStep(max - min, count);
  const first = Math.ceil(min / step - 1e-9);
  const last = Math.floor(max / step + 1e-9);
  const values: number[] = [];
  for (let i = first; i <= last; i++) values.push(Number((i * step).toPrecision(12)));
  return { step, values };
}

/** A tick's number: the decimals its step needs and no more, a true minus, no -0, thousands set apart with `group`. */
export function tickText(value: number, step: number, group: string): string {
  if (!Number.isFinite(value)) return '—';
  if (Math.abs(value) >= 1e15 || step < 1e-9) return formatNumber(value, 4, group);
  const decimals = Math.min(9, Math.max(0, -Math.floor(Math.log10(step) + 1e-9)));
  const fixed = Math.abs(value).toFixed(decimals);
  const [whole, fraction] = fixed.split('.');
  const grouped = whole.replace(/\B(?=(\d{3})+(?!\d))/g, group);
  const text = fraction ? `${grouped}.${fraction}` : grouped;
  return Number(fixed) === 0 ? '0' : `${value < 0 ? '−' : ''}${text}`;
}

export function chartLayout(points: readonly ChartPoint[], o: ChartOptions): ChartLayout {
  const plot = { x0: MARGIN.left, y0: MARGIN.top, x1: Math.max(MARGIN.left + 40, o.width - MARGIN.right), y1: Math.max(MARGIN.top + 40, o.height - MARGIN.bottom) };
  const xs = points.map((p) => p.x).filter(Number.isFinite);
  const ys = points.flatMap((p) => (p.y !== null && Number.isFinite(p.y) ? [p.y] : []));
  let xMin = xs.length ? Math.min(...xs) : 0;
  let xMax = xs.length ? Math.max(...xs) : 1;
  if (xMax === xMin) {
    xMin -= 1;
    xMax += 1;
  }
  let yMin = ys.length ? Math.min(...ys) : 0;
  let yMax = ys.length ? Math.max(...ys) : 1;
  // A line that is level but for rounding is level: its axis is a little over and under it, not a ladder of ticks a billionth apart.
  if (yMax - yMin <= 1e-9 * Math.max(Math.abs(yMin), Math.abs(yMax), 1e-12)) {
    const pad = Math.abs(yMin) * 0.05 || 1;
    yMin -= pad;
    yMax += pad;
  }
  const xt = niceTicks(xMin, xMax, Math.max(2, Math.floor((plot.x1 - plot.x0) / 70)));
  const yt = niceTicks(yMin, yMax, 4);
  // The vertical axis runs from the round number under the least to the one over the most.
  const yLo = yt.values.length ? Math.min(yt.step * Math.floor(yMin / yt.step + 1e-9), yMin) : yMin;
  const yHi = yt.values.length ? Math.max(yt.step * Math.ceil(yMax / yt.step - 1e-9), yMax) : yMax;
  const yTickValues = niceTicks(yLo, yHi, 4);
  const X = (x: number) => plot.x0 + ((x - xMin) / (xMax - xMin)) * (plot.x1 - plot.x0);
  const Y = (y: number) => plot.y1 - ((y - yLo) / (yHi - yLo)) * (plot.y1 - plot.y0);

  const runs: string[] = [];
  const dots: Dot[] = [];
  const gaps: number[] = [];
  let run: string[] = [];
  const flush = () => {
    if (run.length > 1) runs.push(run.join(' '));
    run = [];
  };
  let least: ChartLayout['least'] = null;
  let most: ChartLayout['most'] = null;
  for (const p of points) {
    if (p.y === null || !Number.isFinite(p.y) || !Number.isFinite(p.x)) {
      if (Number.isFinite(p.x)) gaps.push(Number(pixel(X(p.x))));
      flush();
      continue;
    }
    const px = Number(pixel(X(p.x)));
    const py = Number(pixel(Y(p.y)));
    run.push(`${run.length === 0 ? 'M' : 'L'}${pixel(px)} ${pixel(py)}`);
    dots.push({ x: px, y: py, current: p.current });
    if (!least || p.y < least.y) least = { x: p.x, y: p.y };
    if (!most || p.y > most.y) most = { x: p.x, y: p.y };
  }
  flush();
  return {
    width: o.width,
    height: o.height,
    plot,
    xTicks: xt.values.map((v) => ({ at: Number(pixel(X(v))), value: v, text: tickText(v, xt.step, o.group) })),
    yTicks: yTickValues.values.map((v) => ({ at: Number(pixel(Y(v))), value: v, text: tickText(v, yTickValues.step, o.group) })),
    runs,
    dots,
    gaps,
    least,
    most,
  };
}

export interface SweepChartProps {
  points: readonly ChartPoint[];
  width: number;
  height?: number;
  group: string;
  title: string;
  /** What the axes are, with their units: "Temperature (°F)". */
  xTitle: string;
  yTitle: string;
  /** The sentence that says what the chart shows. */
  about: string;
}

export function SweepChart({ points, width, height = 200, group, title, xTitle, yTitle, about }: SweepChartProps) {
  const layout = useMemo(() => chartLayout(points, { width, height, group }), [points, width, height, group]);
  const { plot } = layout;
  return (
    <figure className="mp-cs-chart">
      <figcaption className="mp-plot__title">{title}</figcaption>
      <svg className="mp-plot__svg mp-cs-chart__svg" role="img" aria-label={about} viewBox={`0 0 ${layout.width} ${layout.height}`} width={layout.width} height={layout.height}>
        <g aria-hidden="true">
          {layout.yTicks.map((t) => (
            <g key={`y${t.value}`}>
              <line className="mp-plot__guide" x1={plot.x0} y1={t.at} x2={plot.x1} y2={t.at} />
              <text className="mp-cs-chart__tick" x={plot.x0 - 6} y={t.at + 4} textAnchor="end">
                {t.text}
              </text>
            </g>
          ))}
          {layout.xTicks.map((t) => (
            <g key={`x${t.value}`}>
              <line className="mp-plot__axis" x1={t.at} y1={plot.y1} x2={t.at} y2={plot.y1 + 4} />
              <text className="mp-cs-chart__tick" x={t.at} y={plot.y1 + 16} textAnchor="middle">
                {t.text}
              </text>
            </g>
          ))}
          <line className="mp-plot__axis" x1={plot.x0} y1={plot.y1} x2={plot.x1} y2={plot.y1} />
          <line className="mp-plot__axis" x1={plot.x0} y1={plot.y0} x2={plot.x0} y2={plot.y1} />
          {layout.runs.map((d, i) => (
            <path key={i} className="mp-cs-chart__line" d={d} />
          ))}
          {layout.dots.map((d, i) => (
            <g key={i}>
              <circle className="mp-cs-chart__dot" cx={d.x} cy={d.y} r={d.current ? 3.5 : 2.5} />
              {d.current ? <circle className="mp-cs-chart__ring" cx={d.x} cy={d.y} r={7} /> : null}
            </g>
          ))}
          {layout.gaps.map((x, i) => (
            <text key={i} className="mp-cs-chart__gap" x={x} y={plot.y1 - 4} textAnchor="middle">
              ×
            </text>
          ))}
          <text className="mp-cs-chart__axis" x={(plot.x0 + plot.x1) / 2} y={layout.height - 4} textAnchor="middle">
            {xTitle}
          </text>
          <text className="mp-cs-chart__axis" x={plot.x0} y={12} textAnchor="start">
            {yTitle}
          </text>
        </g>
      </svg>
    </figure>
  );
}
