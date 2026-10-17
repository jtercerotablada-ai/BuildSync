'use client';

import React, { useMemo } from 'react';
import { formatNumber } from '@/lib/calc/format';
import type { CurveLine, RegimeLine } from '@/lib/calc/cable/analysis';
import type { PullRegimeId } from '@/lib/calc/cable/types';
import { Mark, Swatch, boxOf, clean, hitsAny, place, pt, type Label, type LegendKey, type Pt, type Seg } from './figure';

/**
 * THE CURVE T(φ) - the cable tension against the cable angle, −90° to +90°.
 *
 * One curve for each case that has any angle at which the cable can do its work (to
 * start the block moving, to keep it moving, accelerating), drawn over the whole range
 * of the cable angle with real axes: a tick and a number every 30° along the angle, a
 * tick and a number at a round step up the tension. A curve stops where the cable cannot
 * pull the block (the block would lift, or the cable would have to push); a curve that
 * rises past the top of the chart leaves it through the top, cut at the border and not
 * squeezed against it.
 *
 * ONLY WHAT EXISTS IS DRAWN, and only what is drawn is in the legend. A case with no angle
 * at which it works (a block that slides by itself, one that stays put, one that cannot be
 * held, a lock) has no curve and says why in its legend line, with no swatch; a chart with
 * no curve at all has no ticks, no lines and no marks - one sentence in the plot says why.
 * MARKED on it: the least tension of each curve (a hollow diamond, at the best angle - at
 * the lift-off angle itself when the block would lift off at φ*), the cable angle the
 * visitor chose (a dashed vertical, with a mark on each curve where it crosses), and where
 * the block would lift off (a dotted vertical for each distinct lift-off angle, named by
 * its case when there is more than one: a case with an acceleration lifts off at its own
 * angle). The three curves are told apart by PATTERN as well as colour - solid, dashed,
 * dotted - and by the shape of their mark (circle, square, triangle), so that a
 * black-and-white sheet loses nothing.
 *
 * `curveLayout` is arithmetic from end to end (axes, ticks, the polylines
 * clipped to the chart, the marks, every label kept clear of every line);
 * `PullCurve` writes it as SVG. The same numbers are in the table the page prints
 * under it, for a screen reader and for anyone who wants them.
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
  maxHeight?: number;
}

/** The page's words in the chart: what each legend line says, the words on a lift-off line, and what an empty chart says. */
export interface CurveWords {
  /** One line for each case, as it goes in the legend (the numbers are in it). */
  regime: Record<PullRegimeId, string>;
  minimum: string;
  chosen: string;
  lift: string;
  /** The words on a lift-off line, one string for each line of text: the angle and, for a line not shared by all the cases, the case it belongs to. */
  liftLabel: (phi: number, regime: PullRegimeId | null) => string[];
  /** One sentence for a chart with nothing to draw. */
  empty: string;
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
  /** The least tension, at the best angle (a lift-off angle where the block would lift off at φ*); null when no angle works or it is above the chart. */
  minimum: (Pt & { phi: number; T: number }) | null;
  /** Where the chosen angle meets this curve (null: the block is not pulled there, or it is above the chart). */
  at: (Pt & { T: number }) | null;
}

export interface LiftLine {
  x: number;
  phi: number;
  regimes: PullRegimeId[];
  /** The lines of its words, one above the other. */
  label: Label[];
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
  /** Only the cases that have a curve. */
  curves: CurveShape[];
  /** The dashed vertical at the chosen angle (null on a chart with nothing to draw). */
  chosen: { x: number; label: Label } | null;
  /** A dotted vertical for each distinct angle at which the block lifts off. */
  lifts: LiftLine[];
  /** What an empty chart says, in the middle of the plot (null when there is a curve). */
  empty: Label | null;
  titleX: Label;
  titleY: { text: string; x: number; y: number };
  /** The legend: one line for each case - `absent` when it has no curve, so that it has no swatch - then the marks that are on the chart. */
  legend: { key: LegendKey; absent?: boolean; regime?: PullRegimeId }[];
  /** Every line a label must keep clear of. */
  lines: Seg[];
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

export function curveLayout(curves: CurveLine[], regimes: RegimeLine[], o: CurveOptions, words: Pick<CurveWords, 'liftLabel' | 'empty'>): CurveLayout {
  const maxH = o.maxHeight ?? MAX_HEIGHT;
  const height = clean(Math.max(MIN_HEIGHT, Math.min(maxH, o.width * 0.55)));
  const tops = curves.map((c) => c.plotMax).filter((v): v is number => v !== null && v > 0);
  const yMax = tops.length ? niceScale(Math.max(...tops)).top : null;
  const step = yMax === null ? 0 : niceScale(Math.max(...tops)).step;
  const yValues: number[] = [];
  if (yMax !== null) for (let k = 0; k * step <= yMax * (1 + 1e-9); k++) yValues.push(Number((k * step).toPrecision(12)));
  const yLabels = yValues.map((v) => formatNumber(v, 3, o.group));
  const left = yMax === null ? 24 : Math.max(44, 30 + 6.8 * Math.max(1, ...yLabels.map((t) => t.length)));
  const plot = { x0: clean(left), y0: 16, x1: clean(o.width - 16), y1: clean(height - 46) };
  const X = (phi: number) => clean(plot.x0 + ((phi + 90) / 180) * (plot.x1 - plot.x0));
  const Y = (T: number) => (yMax === null ? plot.y1 : clean(plot.y1 - (T / yMax) * (plot.y1 - plot.y0)));

  const xTicks: Tick[] = [];
  for (let v = -90; v <= 90; v += TICK_STEP) xTicks.push({ value: v, at: X(v), label: minus(v) });
  const yTicks: Tick[] = yValues.map((v, i) => ({ value: v, at: Y(v), label: yLabels[i] }));

  const lines: Seg[] = [];
  const shapes: CurveShape[] = [];
  for (const c of curves) {
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
    if (runs.length === 0 || yMax === null) continue;
    const clipped = runs.flatMap((r) => clipRun(r, yMax));
    const pixel = clipped.map((r) => r.map((p) => pt(X(p.phi), Y(p.T))));
    const d = pixel.map((r) => `M ${r.map((p) => `${p.x} ${p.y}`).join(' L ')}`).join(' ');
    for (const r of pixel) for (let i = 1; i < r.length; i++) lines.push([r[i - 1].x, r[i - 1].y, r[i].x, r[i].y]);
    const best = c.optimum;
    const regime = regimes.find((r) => r.id === c.regime);
    const here = regime?.T ?? null;
    shapes.push({
      regime: c.regime,
      runs: pixel,
      d,
      minimum: best && best.T <= yMax ? { ...pt(X(best.phi), Y(best.T)), phi: best.phi, T: best.T } : null,
      at: here !== null && here <= yMax ? { ...pt(X(o.phi), Y(here)), T: here } : null,
    });
  }

  const drawn = shapes.length > 0;
  const chosenX = X(Math.max(-90, Math.min(90, o.phi)));
  const chosen = drawn ? { x: chosenX, label: place(`φ = ${formatNumber(o.phi, 4, o.group).replace('-', '−')}°`, chosenX, plot.y0 - 4, 'middle', o.width, height) } : null;
  if (chosen) lines.push([chosenX, plot.y0, chosenX, plot.y1]);

  // Where the block lifts off: one line for each distinct angle, with its words; a case with an acceleration lifts off at its own.
  const lifts: LiftLine[] = [];
  if (drawn) {
    for (const r of regimes) {
      if (r.phiLift === null || !(r.phiLift > -90 && r.phiLift <= 90)) continue;
      if (!shapes.some((s) => s.regime === r.id)) continue;
      const found = lifts.find((l) => Math.abs(l.phi - (r.phiLift as number)) < 0.005);
      if (found) found.regimes.push(r.id);
      else lifts.push({ x: X(r.phiLift), phi: r.phiLift, regimes: [r.id], label: [] });
    }
    for (const l of lifts) lines.push([l.x, plot.y0, l.x, plot.y1]);
    // The line most cases share is named by its angle alone; each of the others by its angle and its own case.
    const most = Math.max(...lifts.map((l) => l.regimes.length));
    const labels: Label[] = [];
    let row = 0;
    for (const l of lifts) {
      const text = words.liftLabel(l.phi, lifts.length > 1 && l.regimes.length < most ? l.regimes[0] : null);
      // On the side of its line where no other line crosses its words (left first); stacked under the ones before it.
      const place2 = (side: 'end' | 'start') => text.map((t, k) => place(t, side === 'end' ? l.x - 4 : l.x + 4, plot.y0 + 12 + 13 * (row + k), side, o.width, height));
      const clear = (ls: Label[]) => ls.every((q) => !hitsAny(boxOf(q), lines.filter((g) => !(Math.abs(g[0] - l.x) < 1e-6 && Math.abs(g[2] - l.x) < 1e-6))));
      const left = place2('end');
      l.label = clear(left) ? left : place2('start');
      row += text.length;
      labels.push(...l.label);
    }
    // (Not moved about line by line: the words of one line stay together, stacked, one group under the other.)
    void labels;
  }

  const empty = drawn ? null : place(words.empty, (plot.x0 + plot.x1) / 2, (plot.y0 + plot.y1) / 2, 'middle', o.width, height);
  const legend: CurveLayout['legend'] = curves.map((c) => ({ key: c.regime as LegendKey, regime: c.regime, ...(shapes.some((s) => s.regime === c.regime) ? {} : { absent: true as const }) }));
  if (shapes.some((s) => s.minimum)) legend.push({ key: 'minimum' });
  if (chosen) legend.push({ key: 'chosen' });
  if (lifts.length) legend.push({ key: 'lift' });
  return {
    width: o.width,
    height,
    plot,
    yMax,
    xTicks,
    yTicks,
    curves: shapes,
    chosen,
    lifts,
    empty,
    titleX: place(o.axisX, (plot.x0 + plot.x1) / 2, height - 6, 'middle', o.width, height),
    titleY: { text: o.axisY, x: 12, y: clean((plot.y0 + plot.y1) / 2) },
    legend,
    lines,
  };
}

export interface PullCurveProps extends CurveOptions {
  curves: CurveLine[];
  regimes: RegimeLine[];
  summary: string;
  words: CurveWords;
}

export function PullCurve({ curves, regimes, width, group, axisX, axisY, phi, maxHeight, summary, words }: PullCurveProps) {
  const layout = useMemo(() => curveLayout(curves, regimes, { width, group, axisX, axisY, phi, maxHeight }, words), [curves, regimes, width, group, axisX, axisY, phi, maxHeight, words]);
  const { plot } = layout;
  // One line for each case, each on its own (they are sentences); then the marks, side by side.
  const cases = layout.legend.filter((i) => i.regime !== undefined);
  const marks = layout.legend.filter((i) => i.regime === undefined);
  const text = (key: LegendKey, regime?: PullRegimeId): string => (regime ? words.regime[regime] : key === 'minimum' ? words.minimum : key === 'chosen' ? words.chosen : words.lift);
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
          {layout.yMax !== null ? (
            <text className="mp-cable-fig__axis-title" x={layout.titleY.x} y={layout.titleY.y} textAnchor="middle" transform={`rotate(-90 ${layout.titleY.x} ${layout.titleY.y})`}>
              {layout.titleY.text}
            </text>
          ) : null}
          {layout.empty ? (
            <text className="mp-cable-fig__empty" x={layout.empty.x} y={layout.empty.y} textAnchor={layout.empty.anchor}>
              {layout.empty.text}
            </text>
          ) : null}
          {layout.lifts.map((l) => (
            <g key={`l${l.phi}`}>
              <line className="mp-cable-fig__lift" x1={l.x} y1={plot.y0} x2={l.x} y2={plot.y1} />
              {l.label.map((t, k) => (
                <text key={k} className="mp-cable-fig__value" x={t.x} y={t.y} textAnchor={t.anchor}>
                  {t.text}
                </text>
              ))}
            </g>
          ))}
          {layout.chosen ? (
            <>
              <line className="mp-cable-fig__chosen" x1={layout.chosen.x} y1={plot.y0} x2={layout.chosen.x} y2={plot.y1} />
              <text className="mp-cable-fig__value" x={layout.chosen.label.x} y={layout.chosen.label.y} textAnchor={layout.chosen.label.anchor}>
                {layout.chosen.label.text}
              </text>
            </>
          ) : null}
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
      {cases.length > 0 ? (
        <ul className="mp-cable-fig__legend mp-cable-fig__legend--cases">
          {cases.map((item) => (
            <li key={item.regime} className={item.absent ? 'mp-cable-fig__key mp-cable-fig__key--absent' : 'mp-cable-fig__key'} data-absent={item.absent ? 'true' : undefined}>
              {item.absent ? <span className="mp-cable-fig__swatch-gap" aria-hidden="true" /> : <Swatch kind={item.key} />}
              <span>{text(item.key, item.regime)}</span>
            </li>
          ))}
        </ul>
      ) : null}
      {marks.length > 0 ? (
        <ul className="mp-cable-fig__legend mp-cable-fig__legend--marks">
          {marks.map((item) => (
            <li key={item.key} className="mp-cable-fig__key">
              <Swatch kind={item.key} />
              <span>{text(item.key)}</span>
            </li>
          ))}
        </ul>
      ) : null}
    </figure>
  );
}
