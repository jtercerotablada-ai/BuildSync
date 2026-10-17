'use client';

import React, { useMemo } from 'react';
import { formatNumber } from '@/lib/calc/format';
import type { CurveLine, RegimeLine } from '@/lib/calc/cable/analysis';
import type { PullRegimeId } from '@/lib/calc/cable/types';
import { Mark, Swatch, clean, place, pt, type Label, type LegendKey, type Pt } from './figure';

/**
 * THE CURVE T(φ) - the cable tension against the cable angle, −90° to +90°.
 *
 * One curve for each case the analysis solved (to start the block moving, to
 * keep it moving, accelerating), drawn over the whole range of the cable angle
 * with real axes: a tick and a number every 30° along the angle, a tick and a
 * number at a round step up the tension. A curve stops where the cable cannot
 * pull the block (the block would lift, or the cable would have to push); a
 * curve that rises past the top of the chart leaves it through the top, cut at
 * the border and not squeezed against it.
 *
 * MARKED on it: the least tension of each curve (a hollow diamond, at the
 * analytic best angle φ* = atan μ), the cable angle the visitor chose (a dashed
 * vertical, with a mark on each curve where it crosses), and where the block
 * would lift off (a dotted vertical). The three curves are told apart by
 * PATTERN as well as colour - solid, dashed, dotted - and by the shape of their
 * mark (circle, square, triangle), so that a black-and-white sheet loses
 * nothing.
 *
 * `curveLayout` is arithmetic from end to end (axes, ticks, the polylines
 * clipped to the chart, the marks); `PullCurve` writes it as SVG. The same
 * numbers are in the table the page prints under it, for a screen reader and
 * for anyone who wants them.
 */

const MIN_HEIGHT = 230;
const MAX_HEIGHT = 340;
const TICK_STEP = 30;

export interface CurveOptions {
  width: number;
  group: string;
  /** The words along the two axes, filled by the caller (the unit is in the second). */
  axisX: string;
  axisY: string;
  /** The cable angle the visitor chose, degrees. */
  phi: number;
  /** The label on the lift-off line, with {phi}: written by the caller. */
  lift: (phi: number) => string;
  maxHeight?: number;
}

export interface Tick {
  value: number;
  /** Pixels along its axis. */
  at: number;
  label: string;
}

export interface CurveShape {
  regime: PullRegimeId;
  /** The runs of the curve inside the chart, in pixels (a curve with a gap is several). */
  runs: Pt[][];
  /** The path of all of them. */
  d: string;
  /** The least tension: at the analytic best angle when that is a pull, else at the least point of the 1° grid. */
  minimum: (Pt & { phi: number; T: number }) | null;
  /** Where the chosen angle meets this curve (null: the block is not pulled there, or it is above the chart). */
  at: (Pt & { T: number }) | null;
}

export interface CurveLayout {
  width: number;
  height: number;
  /** The plot area, in pixels. */
  plot: { x0: number; y0: number; x1: number; y1: number };
  /** The top of the tension axis (a round number), and null when no curve has a valid point. */
  yMax: number | null;
  xTicks: Tick[];
  yTicks: Tick[];
  curves: CurveShape[];
  chosen: { x: number; label: Label };
  lift: { x: number; phi: number; label: Label } | null;
  titleX: Label;
  titleY: { text: string; x: number; y: number };
  legend: LegendKey[];
}

/** A round top for an axis that must hold `max`, and the step between its ticks (1, 2, 2.5 or 5 times a power of ten; at most six steps). */
export function niceScale(max: number): { top: number; step: number } {
  const raw = max / 5;
  const mag = 10 ** Math.floor(Math.log10(raw));
  const norm = raw / mag;
  const step = (norm <= 1 ? 1 : norm <= 2 ? 2 : norm <= 2.5 ? 2.5 : norm <= 5 ? 5 : 10) * mag;
  const steps = Math.ceil(max / step - 1e-9);
  return { top: Number((steps * step).toPrecision(12)), step };
}

/** A run of the curve cut where it crosses `top`: the part inside, as (φ, T) pairs. The segment that leaves or enters is cut at the border. */
export function clipRun(run: { phi: number; T: number }[], top: number): { phi: number; T: number }[][] {
  const out: { phi: number; T: number }[][] = [];
  let cur: { phi: number; T: number }[] = [];
  const cross = (p: { phi: number; T: number }, q: { phi: number; T: number }) => ({ phi: p.phi + ((top - p.T) / (q.T - p.T)) * (q.phi - p.phi), T: top });
  for (let i = 0; i < run.length; i++) {
    const p = run[i];
    const inside = p.T <= top;
    const prev = i > 0 ? run[i - 1] : null;
    if (prev) {
      const prevInside = prev.T <= top;
      if (prevInside && !inside) {
        cur.push(cross(prev, p));
        out.push(cur);
        cur = [];
      } else if (!prevInside && inside) cur.push(cross(p, prev));
    }
    if (inside) cur.push(p);
  }
  if (cur.length) out.push(cur);
  return out;
}

const minus = (v: number): string => (v < 0 ? `−${-v}` : `${v}`);

export function curveLayout(curves: CurveLine[], regimes: RegimeLine[], o: CurveOptions): CurveLayout {
  const maxH = o.maxHeight ?? MAX_HEIGHT;
  const height = clean(Math.max(MIN_HEIGHT, Math.min(maxH, o.width * 0.55)));
  const tops = curves.map((c) => c.plotMax).filter((v): v is number => v !== null && v > 0);
  const yMax = tops.length ? niceScale(Math.max(...tops)).top : null;
  const step = yMax === null ? 0 : niceScale(Math.max(...tops)).step;
  const yValues: number[] = [];
  if (yMax !== null) for (let k = 0; k * step <= yMax * (1 + 1e-9); k++) yValues.push(Number((k * step).toPrecision(12)));
  const yLabels = yValues.map((v) => formatNumber(v, 3, o.group));
  const left = Math.max(44, 30 + 6.8 * Math.max(1, ...yLabels.map((t) => t.length)));
  const plot = { x0: clean(left), y0: 16, x1: clean(o.width - 16), y1: clean(height - 46) };
  const X = (phi: number) => clean(plot.x0 + ((phi + 90) / 180) * (plot.x1 - plot.x0));
  const Y = (T: number) => (yMax === null ? plot.y1 : clean(plot.y1 - (T / yMax) * (plot.y1 - plot.y0)));

  const xTicks: Tick[] = [];
  for (let v = -90; v <= 90; v += TICK_STEP) xTicks.push({ value: v, at: X(v), label: minus(v) });
  const yTicks: Tick[] = yValues.map((v, i) => ({ value: v, at: Y(v), label: yLabels[i] }));

  const shapes: CurveShape[] = curves.map((c) => {
    // Runs of valid points: a break where the cable cannot pull the block.
    const runs: { phi: number; T: number }[][] = [];
    let cur: { phi: number; T: number }[] = [];
    for (const p of c.points) {
      if (p.valid && p.T !== null) cur.push({ phi: p.phi, T: p.T });
      else if (cur.length) {
        runs.push(cur);
        cur = [];
      }
    }
    if (cur.length) runs.push(cur);
    const clipped = yMax === null ? [] : runs.flatMap((r) => clipRun(r, yMax));
    const pixel = clipped.map((r) => r.map((p) => pt(X(p.phi), Y(p.T))));
    const d = pixel.map((r) => `M ${r.map((p) => `${p.x} ${p.y}`).join(' L ')}`).join(' ');
    const grid = c.minIndex === null ? null : c.points[c.minIndex];
    const best = c.optimum ?? (grid && grid.T !== null ? { phi: grid.phi, T: grid.T } : null);
    const regime = regimes.find((r) => r.id === c.regime);
    const here = regime?.T ?? null;
    return {
      regime: c.regime,
      runs: pixel,
      d,
      minimum: best && yMax !== null && best.T <= yMax ? { ...pt(X(best.phi), Y(best.T)), phi: best.phi, T: best.T } : null,
      at: here !== null && yMax !== null && here <= yMax ? { ...pt(X(o.phi), Y(here)), T: here } : null,
    };
  });

  const chosenX = X(Math.max(-90, Math.min(90, o.phi)));
  const chosen = { x: chosenX, label: place(`φ = ${formatNumber(o.phi, 4, o.group)}°`, chosenX, plot.y0 - 4, 'middle', o.width, height) };
  const first = regimes.find((r) => r.id === 'run' && r.phiLift !== null) ?? regimes.find((r) => r.phiLift !== null);
  const liftPhi = first && first.phiLift !== null && first.phiLift > -90 && first.phiLift <= 90 ? first.phiLift : null;
  const lift = liftPhi === null ? null : { x: X(liftPhi), phi: liftPhi, label: place(o.lift(liftPhi), X(liftPhi) - 4, plot.y0 + 12, 'end', o.width, height) };

  const legend: LegendKey[] = [...curves.map((c) => c.regime as LegendKey)];
  if (shapes.some((s) => s.minimum)) legend.push('minimum');
  legend.push('chosen');
  if (lift) legend.push('lift');
  return {
    width: o.width,
    height,
    plot,
    yMax,
    xTicks,
    yTicks,
    curves: shapes,
    chosen,
    lift,
    titleX: place(o.axisX, (plot.x0 + plot.x1) / 2, height - 6, 'middle', o.width, height),
    titleY: { text: o.axisY, x: 12, y: clean((plot.y0 + plot.y1) / 2) },
    legend,
  };
}

export interface PullCurveProps extends CurveOptions {
  curves: CurveLine[];
  regimes: RegimeLine[];
  summary: string;
  /** What each legend item says, in the order of the layout's legend. */
  legend: { key: LegendKey; text: string }[];
}

export function PullCurve({ curves, regimes, width, group, axisX, axisY, phi, lift, maxHeight, summary, legend }: PullCurveProps) {
  const layout = useMemo(() => curveLayout(curves, regimes, { width, group, axisX, axisY, phi, lift, maxHeight }), [curves, regimes, width, group, axisX, axisY, phi, lift, maxHeight]);
  const { plot } = layout;
  return (
    <figure className="mp-cable-fig">
      <svg className="mp-plot__svg mp-cable-fig__svg mp-cable-fig__chart" role="img" aria-label={summary} viewBox={`0 0 ${layout.width} ${layout.height}`} width={layout.width} height={layout.height}>
        <defs>
          <clipPath id={`mp-cable-clip-${width}`}>
            <rect x={plot.x0} y={plot.y0} width={plot.x1 - plot.x0} height={plot.y1 - plot.y0} />
          </clipPath>
        </defs>
        <g aria-hidden="true">
          {layout.yTicks.map((t) => (
            <g key={`y${t.value}`} className="mp-cable-fig__tick">
              <line className="mp-plot__guide" x1={plot.x0} y1={t.at} x2={plot.x1} y2={t.at} />
              <line className="mp-plot__axis" x1={plot.x0 - 4} y1={t.at} x2={plot.x0} y2={t.at} />
              <text x={plot.x0 - 7} y={t.at + 4} textAnchor="end">
                {t.label}
              </text>
            </g>
          ))}
          {layout.xTicks.map((t) => (
            <g key={`x${t.value}`} className="mp-cable-fig__tick">
              <line className="mp-plot__guide" x1={t.at} y1={plot.y0} x2={t.at} y2={plot.y1} />
              <line className="mp-plot__axis" x1={t.at} y1={plot.y1} x2={t.at} y2={plot.y1 + 4} />
              <text x={t.at} y={plot.y1 + 17} textAnchor="middle">
                {t.label}
              </text>
            </g>
          ))}
          <line className="mp-plot__axis" x1={plot.x0} y1={plot.y1} x2={plot.x1} y2={plot.y1} />
          <line className="mp-plot__axis" x1={plot.x0} y1={plot.y0} x2={plot.x0} y2={plot.y1} />
          <text className="mp-cable-fig__axis-title" x={layout.titleX.x} y={layout.titleX.y} textAnchor={layout.titleX.anchor}>
            {layout.titleX.text}
          </text>
          <text className="mp-cable-fig__axis-title" x={layout.titleY.x} y={layout.titleY.y} textAnchor="middle" transform={`rotate(-90 ${layout.titleY.x} ${layout.titleY.y})`}>
            {layout.titleY.text}
          </text>
          {layout.lift ? <line className="mp-cable-fig__lift" x1={layout.lift.x} y1={plot.y0} x2={layout.lift.x} y2={plot.y1} /> : null}
          {layout.lift ? (
            <text className="mp-cable-fig__value" x={layout.lift.label.x} y={layout.lift.label.y} textAnchor={layout.lift.label.anchor}>
              {layout.lift.label.text}
            </text>
          ) : null}
          <line className="mp-cable-fig__chosen" x1={layout.chosen.x} y1={plot.y0} x2={layout.chosen.x} y2={plot.y1} />
          <text className="mp-cable-fig__value" x={layout.chosen.label.x} y={layout.chosen.label.y} textAnchor={layout.chosen.label.anchor}>
            {layout.chosen.label.text}
          </text>
          <g clipPath={`url(#mp-cable-clip-${width})`}>
            {layout.curves.map((c) => (
              <path key={c.regime} className={`mp-cable-fig__curve mp-cable-fig__curve--${c.regime}`} d={c.d} data-regime={c.regime} fill="none" />
            ))}
          </g>
          {layout.curves.map((c) => (
            <g key={`m${c.regime}`} className={`mp-cable-fig__curve mp-cable-fig__curve--${c.regime}`}>
              {c.at ? <Mark kind={c.regime} x={c.at.x} y={c.at.y} /> : null}
              {c.minimum ? <polygon className="mp-cable-fig__minimum" data-regime={c.regime} points={`${c.minimum.x},${c.minimum.y - 6} ${c.minimum.x + 5},${c.minimum.y} ${c.minimum.x},${c.minimum.y + 6} ${c.minimum.x - 5},${c.minimum.y}`} /> : null}
            </g>
          ))}
        </g>
      </svg>
      {legend.length > 0 ? (
        <ul className="mp-cable-fig__legend mp-cable-fig__legend--curve">
          {legend.map((item) => (
            <li key={item.key} className="mp-cable-fig__key">
              <Swatch kind={item.key} />
              <span>{item.text}</span>
            </li>
          ))}
        </ul>
      ) : null}
    </figure>
  );
}
