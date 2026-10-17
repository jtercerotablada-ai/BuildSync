'use client';

import React, { useMemo } from 'react';
import { formatNumber } from '@/lib/calc/format';
import type { DrumDrawing } from '@/lib/calc/cable/analysis';
import type { CableUi } from '@/lib/calc/cable/strings';
import { ArrowGlyph, Swatch, anchorOf, arcPath, arrowFrom, clean, declutter, flip, place, polar, pt, type ArrowShape, type Label, type LegendKey, type Pt } from './figure';

/**
 * THE DRUM - a cable wrapped round a drum, with the two tensions.
 *
 * The drum is a circle; the cable lies on it from the point where the LARGE
 * tension leaves, counter-clockwise through the wrap to the point where the
 * SMALL tension leaves (the frame the analysis fixes: lib/calc/cable/types.ts,
 * "DRUM FRAME"). Each tension is an arrow on the free cable, pointing away
 * from the drum, as long as the tension is large next to the largest of the
 * three arrows; the force the drum feels is the third, from its centre. More
 * than one turn is drawn as the full circle and one ring for each turn beyond
 * the first (at most four), and the wrap written beside it in degrees and
 * turns; the drawing does not try to follow a spiral.
 *
 * `drumLayout` is arithmetic from end to end; `DrumSchematic` writes it as SVG.
 */

const MAX_HEIGHT = 340;
const MIN_HEIGHT = 240;
const RING = 3;

export interface DrumOptions {
  width: number;
  group: string;
  unit: string;
  /** The names written on the arrows ("T big", "T small", "R") and the wrap as the page says it ("β = 720° (2 turns)"): the page's words. */
  names: { big: string; small: string; resultant: string };
  wrap: string;
  maxHeight?: number;
}

export interface DrumLayout {
  width: number;
  height: number;
  /** The drum: centre and radius in pixels. */
  drum: Pt & { r: number };
  /** The cable on the drum: the path of its last (or only) turn, and the radius of each ring beyond the first. */
  wrap: { d: string; r: number; rings: number[] } | null;
  /** The two points where the tensions leave. */
  big: Pt;
  small: Pt;
  arrows: ArrowShape[];
  wrapLabel: Label | null;
  legend: LegendKey[];
}

export function drumLayout(d: DrumDrawing | null, o: DrumOptions): DrumLayout {
  const maxH = o.maxHeight ?? MAX_HEIGHT;
  const height = clean(Math.max(MIN_HEIGHT, Math.min(maxH, o.width * 0.64)));
  if (!d) return { width: o.width, height, drum: { x: clean(o.width / 2), y: clean(height / 2), r: 30 }, wrap: null, big: pt(0, 0), small: pt(0, 0), arrows: [], wrapLabel: null, legend: [] };

  // The world: the drum has radius 1; arrows are 0.7 to 1.8 long (the resultant a little shorter).
  const len = (share: number) => 0.7 + 1.1 * share;
  const rings = Math.min(Math.max(Math.ceil(d.wrap / 360) - 1, 0), 4);
  const outer = 1 + 0.07 * (rings + 1);
  const world: { id: 'big' | 'small' | 'resultant'; from: Pt; dir: Pt; length: number }[] = [];
  for (const a of d.arrows) {
    if (a.magnitude === 0) continue;
    if (a.id === 'big') world.push({ id: 'big', from: d.bigPoint, dir: { x: a.dx, y: a.dy }, length: len(a.share) });
    else if (a.id === 'small') world.push({ id: 'small', from: d.smallPoint, dir: { x: a.dx, y: a.dy }, length: len(a.share) });
    else world.push({ id: 'resultant', from: { x: 0, y: 0 }, dir: { x: a.dx, y: a.dy }, length: 0.5 + 0.9 * a.share });
  }
  const xs = [-outer, outer, ...world.flatMap((w) => [w.from.x + w.dir.x * w.length])];
  const ys = [-outer, outer, ...world.flatMap((w) => [w.from.y + w.dir.y * w.length])];
  const xmin = Math.min(...xs);
  const xmax = Math.max(...xs);
  const ymin = Math.min(...ys);
  const ymax = Math.max(...ys);
  const padX = 66;
  const padY = 34;
  const scale = Math.min((o.width - 2 * padX) / (xmax - xmin), (height - 2 * padY) / (ymax - ymin));
  const X = (x: number) => clean(o.width / 2 + (x - (xmin + xmax) / 2) * scale);
  const Y = (y: number) => clean(height / 2 - (y - (ymin + ymax) / 2) * scale);
  const c = pt(X(0), Y(0));
  const r = clean(scale);
  const num = (v: number) => formatNumber(v, 4, o.group);

  const names = { big: o.names.big, small: o.names.small, resultant: o.names.resultant };
  const arrows: ArrowShape[] = world.map((w) => {
    const from = pt(X(w.from.x), Y(w.from.y));
    const magnitude = d.arrows.find((a) => a.id === w.id)?.magnitude ?? 0;
    return arrowFrom(w.id, from, flip(w.dir.x, w.dir.y), w.length * scale, `${names[w.id]} = ${num(magnitude)} ${o.unit}`, magnitude, o.width, height);
  });

  // The cable: from angle 0 through the wrap (a whole circle if it is a turn or more).
  let wrap: DrumLayout['wrap'] = null;
  if (d.wrap > 0) {
    const rc = r + RING;
    const sweep = Math.min(d.wrap, 360);
    const path = sweep >= 360 ? `${arcPath(c, rc, 0, 180)} ${arcPath(c, rc, 180, 360)}` : arcPath(c, rc, 0, sweep);
    wrap = { d: path, r: clean(rc), rings: Array.from({ length: rings }, (_, i) => clean(rc + RING * (i + 1))) };
  }
  const mid = d.wrap >= 360 ? 45 : d.wrap / 2;
  const at = polar(c, r + RING * (rings + 1) + 16, mid);
  const wrapLabel = d.wrap > 0 ? place(o.wrap, at.x, at.y + 4, anchorOf(at.x - c.x), o.width, height) : null;

  declutter([...arrows.map((a) => a.label), ...(wrapLabel ? [wrapLabel] : [])], o.width, height);

  const legend: LegendKey[] = ['drum'];
  if (wrap) legend.push('wrap');
  if (arrows.some((a) => a.id !== 'resultant')) legend.push('tension');
  if (arrows.some((a) => a.id === 'resultant')) legend.push('resultant');
  return { width: o.width, height, drum: { ...c, r }, wrap, big: pt(X(d.bigPoint.x), Y(d.bigPoint.y)), small: pt(X(d.smallPoint.x), Y(d.smallPoint.y)), arrows, wrapLabel, legend };
}

export interface DrumSchematicProps extends DrumOptions {
  drawing: DrumDrawing | null;
  summary: string;
  legend: CableUi['results']['legend'];
}

export function DrumSchematic({ drawing, width, group, unit, names, wrap, maxHeight, summary, legend: words }: DrumSchematicProps) {
  const layout = useMemo(() => drumLayout(drawing, { width, group, unit, names, wrap, maxHeight }), [drawing, width, group, unit, names, wrap, maxHeight]);
  return (
    <figure className="mp-cable-fig">
      <svg className="mp-plot__svg mp-cable-fig__svg" role="img" aria-label={summary} viewBox={`0 0 ${layout.width} ${layout.height}`} width={layout.width} height={layout.height}>
        <g aria-hidden="true">
          <circle className="mp-cable-fig__drum" cx={layout.drum.x} cy={layout.drum.y} r={layout.drum.r} />
          <circle className="mp-cable-fig__node" cx={layout.drum.x} cy={layout.drum.y} r="2.5" />
          {layout.wrap ? (
            <g className="mp-cable-fig__wrap">
              {layout.wrap.rings.map((rr) => (
                <circle key={rr} className="mp-cable-fig__ring-turn" cx={layout.drum.x} cy={layout.drum.y} r={rr} />
              ))}
              <path d={layout.wrap.d} />
            </g>
          ) : null}
          {layout.arrows.map((a) => (
            <ArrowGlyph key={a.id} a={a} className={a.id === 'resultant' ? 'mp-cable-fig__resultant' : 'mp-cable-fig__tension'} />
          ))}
          {layout.arrows.some((a) => a.id !== 'resultant') ? (
            <>
              <circle className="mp-cable-fig__node" cx={layout.big.x} cy={layout.big.y} r="3" />
              <circle className="mp-cable-fig__node" cx={layout.small.x} cy={layout.small.y} r="3" />
            </>
          ) : null}
          {layout.wrapLabel ? (
            <text className="mp-cable-fig__value" x={layout.wrapLabel.x} y={layout.wrapLabel.y} textAnchor={layout.wrapLabel.anchor}>
              {layout.wrapLabel.text}
            </text>
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
