'use client';

import React, { useMemo } from 'react';
import { formatNumber } from '@/lib/calc/format';
import type { PullResults, RegimeLine } from '@/lib/calc/cable/analysis';
import type { CableUi } from '@/lib/calc/cable/strings';
import { ArrowGlyph, Swatch, anchorOf, arcPath, arrowFrom, clean, declutter, flip, place, polar, pt, type ArrowShape, type Label, type LegendKey, type Pt, type Seg } from './figure';

/**
 * THE FREE BODY - the block on its surface with the forces on it.
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
 * THE MOTION IS DRAWN, too: a long thin arrow beside the surface, ahead of the
 * block, points the way the block goes (so the friction arrow is seen to oppose
 * something), and, when an acceleration is asked for, a second one carries a.
 *
 * A BLOCK THAT SLIDES BY ITSELF has, in place of the cable that pulls it, the cable that
 * HOLDS it back, pulling the other way (the arrow is dashed and is named so in the legend),
 * with the normal force and the friction that go with it. A case that needs no pull draws N
 * and F alone. Where the cable cannot do anything (the block stays put, locks, lifts off, or
 * cannot be held) only the weight is drawn, and the page's sentence says why.
 *
 * The arrows are the analysis's own (`RegimeLine.arrows`: components in the
 * frame x right, y up, in the force unit); this file flips them to the page and
 * fits them to the drawing.
 */

const MIN_HEIGHT = 250;
const MAX_HEIGHT = 340;

export interface BodyOptions {
  width: number;
  group: string;
  unit: string;
  maxHeight?: number;
  /** The words by the arrow of travel, and by the arrow of the acceleration ("a = 5.2 ft/s²"; null when there is none). */
  motionText?: string;
  accelText?: string | null;
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
  /** The direction of travel (and of the acceleration): thin arrows beside the surface, ahead of the block. */
  motion: ArrowShape | null;
  accel: ArrowShape | null;
  /** True when the arrow T is the cable that holds a sliding block back. */
  holdDrawn: boolean;
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
  const centre = pt(o.width / 2, height * 0.46);
  if (!pull || !regime) return { width: o.width, height, centre, block: [], surface: { x1: 0, y1: 0, x2: 0, y2: 0 }, hatch: [], arrows: [], motion: null, accel: null, holdDrawn: false, phiArc: null, thetaArc: null, legend: [], lines: [] };

  // The block grows with the drawing: a box 30 px wide was a speck on a wide canvas.
  const a = Math.max(24, Math.min(46, o.width * 0.062));
  const b = a * 0.62;
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
  const maxLen = Math.min(height * 0.32, o.width * 0.3, 130);
  const holdDrawn = regime.holdDrawn;
  const arrows: ArrowShape[] = regime.arrows.map((f) => {
    const dir = flip(f.dx, f.dy);
    const length = maxLen * (0.33 + 0.67 * f.share);
    return arrowFrom(f.id, centre, dir, length, `${f.id} = ${num(f.magnitude)} ${o.unit}`, f.magnitude, o.width, height);
  });

  // The travel: beside the surface, ahead of the block, on the side the surface hatching is - clear of the weight, which falls from the block's middle.
  const travel = flip(regime.travelDir.dx, regime.travelDir.dy);
  const inside = (p: Pt) => p.x >= 8 && p.x <= o.width - 8 && p.y >= 12 && p.y <= height - 24;
  const sign = regime.travelDir.dx * s.x + regime.travelDir.dy * s.y >= 0 ? 1 : -1;
  const lane = (depth: number, dir: Pt, len: number, id: string, text: string): ArrowShape | null => {
    for (const ahead of [true, false]) {
      const from = at(ahead ? sign * (a + 22) : -sign * (a + 22 + len), -b - depth);
      let tipPt = pt(from.x + dir.x * len, from.y + dir.y * len);
      let l = len;
      // Shorter, rather than off the drawing.
      while (l > 26 && !(inside(from) && inside(tipPt))) {
        l -= 6;
        tipPt = pt(from.x + dir.x * l, from.y + dir.y * l);
      }
      if (inside(from) && inside(tipPt)) {
        const shape = arrowFrom(id, from, dir, l, text, 0, o.width, height);
        // The words sit under the arrow, in the middle of it, where nothing else is.
        const mid = pt((from.x + tipPt.x) / 2, (from.y + tipPt.y) / 2);
        shape.label = place(text, mid.x, mid.y + 16, 'middle', o.width, height);
        return shape;
      }
    }
    return null;
  };
  const motion = o.motionText ? lane(20, travel, 58, 'motion', o.motionText) : null;
  const accelDir = regime.a >= 0 ? travel : pt(-travel.x, -travel.y);
  const accel = o.accelText && regime.a !== 0 ? lane(52, accelDir, 40, 'a', o.accelText) : null;

  // The angles.
  const T = arrows.find((x) => x.id === 'T');
  let phiArc: BodyLayout['phiArc'] = null;
  // The cable's own angle above the surface (φ); the hold-back cable is measured from the other direction along the surface.
  const phiShown = pull.phi;
  if (T && Math.abs(phiShown) >= 0.5) {
    const tl = Math.hypot(T.tip.x - T.tail.x, T.tip.y - T.tail.y);
    const r = Math.max(14, Math.min(34, tl * 0.6));
    const base = holdDrawn ? 180 + theta : theta;
    const to = holdDrawn ? 180 + theta - phiShown : theta + phiShown;
    const mid = polar(centre, r + 13, (base + to) / 2);
    phiArc = {
      d: arcPath(centre, r, base, to),
      r: clean(r),
      label: place(`φ = ${num(phiShown).replace('-', '−')}°`, mid.x, mid.y + 4, anchorOf(mid.x - centre.x), o.width, height),
      ref: { x1: centre.x, y1: centre.y, x2: clean(centre.x + (holdDrawn ? -1 : 1) * ps.x * (r + 14)), y2: clean(centre.y + (holdDrawn ? -1 : 1) * ps.y * (r + 14)) },
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
    ...arrows.map((q): Seg => [q.tail.x, q.tail.y, q.tip.x, q.tip.y]),
    ...(motion ? [[motion.tail.x, motion.tail.y, motion.tip.x, motion.tip.y] as Seg] : []),
    ...(accel ? [[accel.tail.x, accel.tail.y, accel.tip.x, accel.tip.y] as Seg] : []),
    ...hatch.map((h): Seg => [h[0].x, h[0].y, h[1].x, h[1].y]),
  ];
  declutter([...arrows.map((q) => q.label), ...(motion ? [motion.label] : []), ...(accel ? [accel.label] : []), ...(phiArc ? [phiArc.label] : []), ...(thetaArc ? [thetaArc.label] : [])], o.width, height, lines);

  const legend: LegendKey[] = ['weight'];
  if (arrows.some((x) => x.id === 'N')) legend.push('normal');
  if (arrows.some((x) => x.id === 'F')) legend.push('friction');
  if (T) legend.push(holdDrawn ? 'holdback' : 'tension');
  if (motion) legend.push('motion');
  if (accel) legend.push('accelArrow');
  legend.push('block', 'slope');
  if (phiArc || thetaArc) legend.push('angle');
  return { width: o.width, height, centre, block, surface, hatch, arrows, motion, accel, holdDrawn, phiArc, thetaArc, legend, lines };
}

export interface PullSchematicProps extends BodyOptions {
  pull: PullResults | null;
  regime: RegimeLine | null;
  summary: string;
  legend: CableUi['results']['legend'];
}

const ARROW_CLASS: Record<string, string> = { T: 'mp-cable-fig__tension', W: 'mp-cable-fig__load', N: 'mp-cable-fig__normal', F: 'mp-cable-fig__friction' };

export function PullSchematic({ pull, regime, width, group, unit, maxHeight, motionText, accelText, summary, legend: words }: PullSchematicProps) {
  const layout = useMemo(() => bodyLayout(pull, regime, { width, group, unit, maxHeight, motionText, accelText }), [pull, regime, width, group, unit, maxHeight, motionText, accelText]);
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
              {layout.motion ? <ArrowGlyph a={layout.motion} className="mp-cable-fig__motion" /> : null}
              {layout.accel ? <ArrowGlyph a={layout.accel} className="mp-cable-fig__motion mp-cable-fig__motion--accel" /> : null}
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
                <ArrowGlyph key={a.id} a={a} className={a.id === 'T' && layout.holdDrawn ? 'mp-cable-fig__tension mp-cable-fig__tension--hold' : (ARROW_CLASS[a.id] ?? 'mp-cable-fig__load')} />
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
