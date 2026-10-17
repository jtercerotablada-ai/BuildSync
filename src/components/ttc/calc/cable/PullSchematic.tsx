'use client';

import React, { useMemo } from 'react';
import { formatNumber } from '@/lib/calc/format';
import type { PullResults, RegimeLine } from '@/lib/calc/cable/analysis';
import type { CableUi } from '@/lib/calc/cable/strings';
import { ArrowGlyph, Swatch, anchorOf, arcPath, arrowFrom, clean, declutter, flip, place, polar, pt, type ArrowShape, type Label, type LegendKey, type Pt, type Seg } from './figure';

/**
 * THE FREE BODY - the block on its surface with the four forces on it.
 *
 * A block of weight W on a surface inclined at θ, pulled by a cable at φ above
 * that surface: the cable tension T along θ + φ, the weight W straight down,
 * the normal force N perpendicular to the surface and the friction F along it,
 * against the travel. Each arrow is as long as its force is large next to the
 * largest of the four (never shorter than a third of the longest, so that a
 * small one is still an arrow), with its size written beyond its tip. The two
 * angles are arcs: φ between the surface and the cable, θ between the horizontal
 * and the surface.
 *
 * The arrows are the analysis's own (`RegimeLine.arrows`: components in the
 * frame x right, y up, in the force unit); this file flips them to the page and
 * fits them to the drawing. A case in which the cable cannot pull the block
 * (`stays-put`, `self-locking`, a block that slides on its own, a pull that
 * would lift it off) has no T, N or F: only the weight is drawn, and the
 * page's sentence says why.
 */

const MIN_HEIGHT = 230;
const MAX_HEIGHT = 330;

export interface BodyOptions {
  width: number;
  group: string;
  unit: string;
  maxHeight?: number;
}

export interface BodyLayout {
  width: number;
  height: number;
  /** The block's centre, where the arrows start. */
  centre: Pt;
  /** The block's four corners, turned with the surface. */
  block: Pt[];
  /** The surface, clipped to the drawing, and the hatching under it. */
  surface: { x1: number; y1: number; x2: number; y2: number };
  hatch: [Pt, Pt][];
  arrows: ArrowShape[];
  /** The cable angle above the surface, between the surface direction (dotted) and the cable. */
  phiArc: { d: string; r: number; label: Label; ref: { x1: number; y1: number; x2: number; y2: number } } | null;
  /** The slope angle, between a horizontal and the surface. */
  thetaArc: { d: string; r: number; label: Label; at: Pt; ref: { x1: number; y1: number; x2: number; y2: number } } | null;
  legend: LegendKey[];
  /** Every line a label must keep clear of. */
  lines: Seg[];
}

export function bodyLayout(pull: PullResults | null, regime: RegimeLine | null, o: BodyOptions): BodyLayout {
  const maxH = o.maxHeight ?? MAX_HEIGHT;
  const height = clean(Math.max(MIN_HEIGHT, Math.min(maxH, o.width * 0.62)));
  const centre = pt(o.width / 2, height * 0.5);
  if (!pull || !regime) return { width: o.width, height, centre, block: [], surface: { x1: 0, y1: 0, x2: 0, y2: 0 }, hatch: [], arrows: [], phiArc: null, thetaArc: null, legend: [], lines: [] };

  const k = Math.max(0.7, Math.min(1, o.width / 520));
  const a = 26 * k;
  const b = 16 * k;
  const theta = pull.surface.theta;
  const th = (theta * Math.PI) / 180;
  const s = { x: Math.cos(th), y: Math.sin(th) };
  // The surface direction on the page (y down)…
  const ps = { x: s.x, y: -s.y };
  // …and the upward normal of the surface, on the page.
  const norm = { x: -Math.sin(th), y: -Math.cos(th) };
  const at = (along: number, up: number): Pt => pt(centre.x + ps.x * along + norm.x * up, centre.y + ps.y * along + norm.y * up);

  const block = [at(-a, -b), at(a, -b), at(a, b), at(-a, b)];
  const S0 = at(0, -b);

  // The surface line through S0, clipped to the drawing.
  const m = 8;
  let tmin = -Infinity;
  let tmax = Infinity;
  const clip = (origin: number, dir: number, lo: number, hi: number) => {
    if (Math.abs(dir) < 1e-9) return;
    const t1 = (lo - origin) / dir;
    const t2 = (hi - origin) / dir;
    tmin = Math.max(tmin, Math.min(t1, t2));
    tmax = Math.min(tmax, Math.max(t1, t2));
  };
  clip(S0.x, ps.x, m, o.width - m);
  clip(S0.y, ps.y, m, height - m);
  const surface = { x1: clean(S0.x + ps.x * tmin), y1: clean(S0.y + ps.y * tmin), x2: clean(S0.x + ps.x * tmax), y2: clean(S0.y + ps.y * tmax) };
  const hatch: [Pt, Pt][] = [];
  for (let t = tmin + 10; t <= tmax - 6; t += 14) {
    const p = pt(S0.x + ps.x * t, S0.y + ps.y * t);
    hatch.push([p, pt(p.x - norm.x * 9 - ps.x * 6, p.y - norm.y * 9 - ps.y * 6)]);
  }

  // The forces.
  const num = (v: number) => formatNumber(v, 4, o.group);
  const maxLen = Math.min(height * 0.3, o.width * 0.28, 120);
  const arrows: ArrowShape[] = regime.arrows.map((f) => {
    const dir = flip(f.dx, f.dy);
    const length = maxLen * (0.33 + 0.67 * f.share);
    return arrowFrom(f.id, centre, dir, length, `${f.id} = ${num(f.magnitude)} ${o.unit}`, f.magnitude, o.width, height);
  });

  // The angles.
  const T = arrows.find((x) => x.id === 'T');
  let phiArc: BodyLayout['phiArc'] = null;
  if (T && Math.abs(pull.phi) >= 0.5) {
    const tl = Math.hypot(T.tip.x - T.tail.x, T.tip.y - T.tail.y);
    const r = Math.max(14, Math.min(34, tl * 0.6));
    const mid = polar(centre, r + 13, theta + pull.phi / 2);
    phiArc = {
      d: arcPath(centre, r, theta, theta + pull.phi),
      r: clean(r),
      label: place(`φ = ${num(pull.phi).replace('-', '−')}°`, mid.x, mid.y + 4, anchorOf(mid.x - centre.x), o.width, height),
      ref: { x1: centre.x, y1: centre.y, x2: clean(centre.x + ps.x * (r + 14)), y2: clean(centre.y + ps.y * (r + 14)) },
    };
  }
  let thetaArc: BodyLayout['thetaArc'] = null;
  if (Math.abs(theta) >= 0.5) {
    // On the upper end of the surface, where the angle is in the air: a horizontal back along the page and the surface beyond it.
    const rising = theta > 0;
    const t = rising ? Math.max(tmax * 0.8, 0) : Math.min(tmin * 0.8, 0);
    const Q = pt(S0.x + ps.x * t, S0.y + ps.y * t);
    const r = 40;
    const from = rising ? 180 : 0;
    const to = rising ? 180 + theta : theta;
    const mid = polar(Q, r + 14, (from + to) / 2);
    thetaArc = {
      d: arcPath(Q, r, from, to),
      r,
      label: place(`θ = ${num(theta).replace('-', '−')}°`, mid.x, mid.y + 4, anchorOf(mid.x - Q.x), o.width, height),
      at: Q,
      ref: { x1: Q.x, y1: Q.y, x2: clean(Q.x + (rising ? -1 : 1) * (r + 18)), y2: Q.y },
    };
  }

  // The forces' names first, then the angles': a later one gives way.
  const lines: Seg[] = [
    [surface.x1, surface.y1, surface.x2, surface.y2],
    ...block.map((p, i): Seg => [p.x, p.y, block[(i + 1) % block.length].x, block[(i + 1) % block.length].y]),
    ...arrows.map((a): Seg => [a.tail.x, a.tail.y, a.tip.x, a.tip.y]),
  ];
  declutter([...arrows.map((a) => a.label), ...(phiArc ? [phiArc.label] : []), ...(thetaArc ? [thetaArc.label] : [])], o.width, height, lines);

  const legend: LegendKey[] = ['weight'];
  if (arrows.some((x) => x.id === 'N')) legend.push('normal');
  if (arrows.some((x) => x.id === 'F')) legend.push('friction');
  if (T) legend.push('tension');
  legend.push('block', 'slope');
  if (phiArc || thetaArc) legend.push('angle');
  return { width: o.width, height, centre, block, surface, hatch, arrows, phiArc, thetaArc, legend, lines };
}

export interface PullSchematicProps extends BodyOptions {
  pull: PullResults | null;
  regime: RegimeLine | null;
  summary: string;
  legend: CableUi['results']['legend'];
}

const ARROW_CLASS: Record<string, string> = { T: 'mp-cable-fig__tension', W: 'mp-cable-fig__load', N: 'mp-cable-fig__normal', F: 'mp-cable-fig__friction' };

export function PullSchematic({ pull, regime, width, group, unit, maxHeight, summary, legend: words }: PullSchematicProps) {
  const layout = useMemo(() => bodyLayout(pull, regime, { width, group, unit, maxHeight }), [pull, regime, width, group, unit, maxHeight]);
  return (
    <figure className="mp-cable-fig">
      <svg className="mp-plot__svg mp-cable-fig__svg" role="img" aria-label={summary} viewBox={`0 0 ${layout.width} ${layout.height}`} width={layout.width} height={layout.height}>
        <g aria-hidden="true">
          {layout.block.length ? (
            <>
              <g className="mp-cable-fig__anchor">
                <line x1={layout.surface.x1} y1={layout.surface.y1} x2={layout.surface.x2} y2={layout.surface.y2} />
                {layout.hatch.map((h, i) => (
                  <line key={i} x1={h[0].x} y1={h[0].y} x2={h[1].x} y2={h[1].y} />
                ))}
              </g>
              {layout.thetaArc ? (
                <g className="mp-cable-fig__angle">
                  <line className="mp-cable-fig__refline" x1={layout.thetaArc.ref.x1} y1={layout.thetaArc.ref.y1} x2={layout.thetaArc.ref.x2} y2={layout.thetaArc.ref.y2} />
                  <path className="mp-cable-fig__arc" d={layout.thetaArc.d} />
                  <text className="mp-cable-fig__value" x={layout.thetaArc.label.x} y={layout.thetaArc.label.y} textAnchor={layout.thetaArc.label.anchor}>
                    {layout.thetaArc.label.text}
                  </text>
                </g>
              ) : null}
              <polygon className="mp-cable-fig__block" points={layout.block.map((p) => `${p.x},${p.y}`).join(' ')} />
              {layout.phiArc ? (
                <g className="mp-cable-fig__angle">
                  <line className="mp-cable-fig__refline" x1={layout.phiArc.ref.x1} y1={layout.phiArc.ref.y1} x2={layout.phiArc.ref.x2} y2={layout.phiArc.ref.y2} />
                  <path className="mp-cable-fig__arc" d={layout.phiArc.d} />
                  <text className="mp-cable-fig__value" x={layout.phiArc.label.x} y={layout.phiArc.label.y} textAnchor={layout.phiArc.label.anchor}>
                    {layout.phiArc.label.text}
                  </text>
                </g>
              ) : null}
              {layout.arrows.map((a) => (
                <ArrowGlyph key={a.id} a={a} className={ARROW_CLASS[a.id] ?? 'mp-cable-fig__load'} />
              ))}
            </>
          ) : null}
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
