'use client';

import React from 'react';
import { formatNumber } from '@/lib/calc/format';
import { UNITS, type BeamForm } from '@/lib/calc/beam/model';
import type { BeamReaction } from '@/lib/calc/beam/solver';
import { xToPx } from './BeamPlot';

/**
 * The beam as entered: the member, its supports and hinges, every load with
 * its value, and — once solved — each reaction under its support. On the
 * same x scale as the three diagrams below it.
 *
 * A reaction is an ARROW ON THE SUPPORT'S OWN LINE, where the force acts, and
 * its value beside the arrow: to the right, or to the left where the right
 * has no room (the last support of a beam) or is taken by a neighbour. It
 * used to be one centred line of text, "↑ 2.592": the arrow was a character
 * of that text and so stood beside the support, not under it.
 *
 * Loads are drawn above the beam whichever way they point; the arrowhead
 * says which. A distributed load's height is its intensity against the
 * largest one on the beam, so two loads can be compared by eye.
 *
 * A drawing of the visitor's own data, not an illustration: nothing here is
 * decorative, and every number on it is in the tables beside it too — so the
 * SVG is described in one sentence (`summary`) rather than read out shape by
 * shape.
 */

const H = 216;
const Y = 118; // the beam's axis
const HALF = 3; // half its thickness
// A reaction's arrow: clear of the support's base above, of the dimension line below.
const R_TOP = Y + 32;
const R_BOTTOM = Y + 56;
const R_HEAD = 4.5; // half the width of its head
const R_CLEAR = 6; // the room each side of its line that an arrow keeps to itself
const R_TEXT = 9; // from its line to its value
const R_CHAR = 6.9; // one character of the labels' 11.5px mono

const head = (x: number, y: number, dir: 1 | -1, size = 5) => `${x},${y} ${x - size},${y - dir * size * 1.7} ${x + size},${y - dir * size * 1.7}`;

/** Labels along one line, dropped where they would run into the one before. */
function spaced<T extends { at: number; text: string }>(labels: T[], charWidth = 6.4, gap = 8): T[] {
  const kept: T[] = [];
  let edge = -Infinity;
  for (const l of [...labels].sort((p, q) => p.at - q.at)) {
    const half = (l.text.length * charWidth) / 2;
    if (l.at - half < edge + gap) continue;
    kept.push(l);
    edge = l.at + half;
  }
  return kept;
}

export function BeamSchematic({
  form,
  reactions,
  ownWeight = 0,
  width,
  probeX,
  summary,
}: {
  form: BeamForm;
  reactions: BeamReaction[] | null;
  /** The beam's own weight per length, when it is one of the loads (kip/ft, kN/m). Drawn; its value is in the title above. */
  ownWeight?: number;
  width: number;
  probeX: number | null;
  summary: string;
}) {
  const u = UNITS[form.units];
  const L = form.L > 0 && Number.isFinite(form.L) ? form.L : 1;
  const on = (x: number) => Number.isFinite(x) && x >= 0 && x <= L;
  const px = (x: number) => xToPx(Math.min(L, Math.max(0, x)), L, width);
  const top = Y - HALF;

  // What is typed is shown as typed; what is computed, to the four figures of the tables.
  const typed = (v: number) => formatNumber(Math.abs(v), 6);
  const wMax = Math.max(1e-12, Math.abs(ownWeight), ...form.dists.flatMap((d) => [Math.abs(d.w1), Math.abs(d.w2)]));
  const hOf = (w: number) => (w === 0 ? 0 : 10 + (Math.abs(w) / wMax) * 34);
  // Each distributed load with its two intensities SIGNED, positive downward.
  const dists = [
    ...form.dists
      .filter((d) => on(d.x1) && on(d.x2) && d.x1 !== d.x2 && (d.w1 !== 0 || d.w2 !== 0))
      .map((d) => {
        const [a, b, wa, wb] = d.x1 < d.x2 ? [d.x1, d.x2, d.w1, d.w2] : [d.x2, d.x1, d.w2, d.w1];
        const sign = d.dir === 'down' ? 1 : -1;
        return { id: String(d.id), a, b, wa: sign * wa, wb: sign * wb, own: false };
      }),
    // The beam's own weight is a load like the others, and is drawn as one.
    ...(ownWeight > 0 ? [{ id: 'own', a: 0, b: L, wa: ownWeight, wb: ownWeight, own: true }] : []),
  ].map((d) => {
    const ha = hOf(d.wa);
    const hb = hOf(d.wb);
    // Where a load whose ends differ in sign passes through zero (0 to 1 along it), or null.
    const t0 = d.wa * d.wb < 0 ? d.wa / (d.wa - d.wb) : null;
    const heightAt = (t: number) => (t0 === null ? ha + (hb - ha) * t : t <= t0 ? ha * (1 - t / t0) : (hb * (t - t0)) / (1 - t0));
    return { ...d, ha, hb, t0, heightAt };
  });

  const dimLabels = spaced(
    [0, L, ...form.supports.map((s) => s.x), ...form.hinges.map((h) => h.x)]
      .filter(on)
      .filter((x, i, arr) => arr.indexOf(x) === i)
      .map((x) => ({ at: px(x), text: formatNumber(x) })),
  );
  const reactionMarks = (() => {
    const list = (reactions ?? [])
      .filter((r) => on(r.x))
      .map((r) => ({
        at: px(r.x),
        // No force, no arrow: its value alone, under the support.
        dir: r.Rv === 0 ? 0 : r.Rv > 0 ? 1 : -1,
        // The force, and under it the moment of a fixed support with the way it turns.
        lines: [formatNumber(Math.abs(r.Rv)), ...(r.kind === 'fixed' && r.Rm !== 0 ? [`${r.Rm < 0 ? '↻' : '↺'} ${formatNumber(Math.abs(r.Rm))}`] : [])],
      }))
      .sort((p, q) => p.at - q.at);
    // Every arrow keeps its place whatever is written; a value goes where
    // there is room for it, and is left to the table where there is none.
    const taken: [number, number][] = list.map((r) => [r.at - R_CLEAR, r.at + R_CLEAR]);
    const free = (a: number, b: number) => a >= 2 && b <= width - 2 && taken.every(([p, q]) => b + 3 <= p || a - 3 >= q);
    return list.map((r) => {
      const w = Math.max(...r.lines.map((s) => s.length)) * R_CHAR;
      if (r.dir === 0) return { ...r, side: 0, shown: true };
      const right: [number, number] = [r.at + R_TEXT, r.at + R_TEXT + w];
      const left: [number, number] = [r.at - R_TEXT - w, r.at - R_TEXT];
      // Which side comes first is decided by WHERE THE SUPPORT IS, not by how
      // long its number happens to be: at the far end of the drawing, where a
      // value of six characters would not fit outside, it goes inside.
      const inside = r.at + R_TEXT + 6 * R_CHAR > width - 2;
      const [first, second] = inside ? ([left, right] as const) : ([right, left] as const);
      const span = free(...first) ? first : free(...second) ? second : null;
      const side = span === null ? 0 : span === right ? 1 : -1;
      if (span) taken.push(span);
      return { ...r, side, shown: side !== 0 };
    });
  })();

  return (
    <figure className="mp-plot mp-beam">
      <svg className="mp-plot__svg" width={width} height={H} viewBox={`0 0 ${width} ${H}`} role="img" aria-label={summary}>
        {/* distributed loads */}
        {dists.map((d) => {
          const xa = px(d.a);
          const xb = px(d.b);
          const n = Math.max(1, Math.round((xb - xa) / 26));
          const arrows = Array.from({ length: n + 1 }, (_, i) => {
            const t = i / n;
            const x = xa + (xb - xa) * t;
            const w = d.wa + (d.wb - d.wa) * t;
            // As tall as the load is there, and pointing the way it acts there:
            // a load whose ends differ in sign tapers to nothing and turns round.
            return { x, h: d.heightAt(t), down: w > 0, zero: w === 0 };
          });
          const way = (w: number) => (w > 0 ? '↓' : '↑');
          const label = d.own
            ? ''
            : d.t0 !== null
              ? `${typed(d.wa)} ${way(d.wa)} – ${typed(d.wb)} ${way(d.wb)}`
              : d.wa === d.wb
                ? typed(d.wa)
                : `${typed(d.wa)} – ${typed(d.wb)}`;
          const x0 = d.t0 === null ? null : xa + (xb - xa) * d.t0;
          const outline = x0 === null ? `${xa},${top} ${xa},${top - d.ha} ${xb},${top - d.hb} ${xb},${top}` : `${xa},${top} ${xa},${top - d.ha} ${x0},${top} ${xb},${top - d.hb} ${xb},${top}`;
          return (
            <g key={d.id} className="mp-beam__dist">
              <polygon points={outline} />
              {arrows.map((a, i) =>
                a.zero || a.h < 9 ? null : (
                  <g key={i}>
                    <line x1={a.x} x2={a.x} y1={top - a.h} y2={top} />
                    <polygon className="mp-beam__head" points={a.down ? head(a.x, top, 1, 3.4) : head(a.x, top - a.h, -1, 3.4)} />
                  </g>
                ),
              )}
              {/* The weight carries no label here: it runs the whole beam, under every
                  other label, and wherever it was put it sat on one of them. Its
                  value is in the drawing's title (BeamCalculator.tsx). */}
              {d.own ? null : (
                <text className="mp-beam__label" x={xa + 2} y={top - Math.max(d.ha, d.hb) - 6} textAnchor="start">
                  {label} {u.line}
                </text>
              )}
            </g>
          );
        })}

        {/* the member */}
        <rect className="mp-beam__member" x={px(0)} y={Y - HALF} width={Math.max(1, px(L) - px(0))} height={2 * HALF} />

        {/* supports */}
        {form.supports.filter((s) => on(s.x)).map((s) => {
          const x = px(s.x);
          const y = Y + HALF;
          if (s.kind === 'fixed') {
            // A wall beside an end of the beam; a clamp around it anywhere else.
            const side = s.x <= 0 ? -1 : s.x >= L ? 1 : 0;
            const x0 = side === 0 ? x - 5 : side < 0 ? x - 10 : x;
            return (
              <g key={s.id} className="mp-beam__support">
                <rect className="mp-beam__wall" x={x0} y={Y - 24} width={10} height={48} />
                {[0, 1, 2, 3, 4].map((i) => (
                  <line key={i} x1={x0} x2={x0 + 10} y1={Y - 14 + i * 9} y2={Y - 23 + i * 9} />
                ))}
              </g>
            );
          }
          return (
            <g key={s.id} className="mp-beam__support">
              <polygon className="mp-beam__pin" points={`${x},${y} ${x - 10},${y + 17} ${x + 10},${y + 17}`} />
              {s.kind === 'roller' ? (
                <>
                  <circle cx={x - 5.5} cy={y + 20.5} r={3} />
                  <circle cx={x + 5.5} cy={y + 20.5} r={3} />
                  <line x1={x - 14} x2={x + 14} y1={y + 24.5} y2={y + 24.5} />
                </>
              ) : (
                <line x1={x - 14} x2={x + 14} y1={y + 17.5} y2={y + 17.5} />
              )}
            </g>
          );
        })}

        {/* hinges */}
        {form.hinges.filter((h) => on(h.x)).map((h) => (
          <circle key={h.id} className="mp-beam__hinge" cx={px(h.x)} cy={Y} r={5.5} />
        ))}

        {/* point loads */}
        {form.points.filter((p) => on(p.x) && p.P !== 0).map((p) => {
          const x = px(p.x);
          const down = (p.dir === 'down') === p.P > 0;
          const y0 = top - 62;
          return (
            <g key={p.id} className="mp-beam__point">
              <line x1={x} x2={x} y1={y0} y2={top} />
              <polygon className="mp-beam__head" points={down ? head(x, top, 1) : head(x, y0, -1)} />
              <text className="mp-beam__label" x={x} y={y0 - 7} textAnchor={x < 48 ? 'start' : x > width - 48 ? 'end' : 'middle'}>
                {typed(p.P)} {u.force}
              </text>
            </g>
          );
        })}

        {/* applied moments */}
        {form.couples.filter((c) => on(c.x) && c.M !== 0).map((c) => {
          const x = px(c.x);
          const ccw = (c.dir === 'ccw') === c.M > 0;
          const r = 20;
          // An arc over the beam, from 20° below the horizontal on one side to
          // 20° below it on the other, drawn clockwise on screen. The arrowhead
          // is at the end the couple turns towards, along the tangent there.
          const at = (deg: number) => ({ x: x + r * Math.cos((deg * Math.PI) / 180), y: Y + r * Math.sin((deg * Math.PI) / 180) });
          const start = at(160);
          const end = at(20);
          const tip = ccw ? start : end;
          const phi = ((ccw ? 160 : 20) * Math.PI) / 180;
          const t = ccw ? { x: Math.sin(phi), y: -Math.cos(phi) } : { x: -Math.sin(phi), y: Math.cos(phi) };
          const n = { x: -t.y, y: t.x };
          const arc = `M${start.x.toFixed(1)} ${start.y.toFixed(1)} A${r} ${r} 0 1 1 ${end.x.toFixed(1)} ${end.y.toFixed(1)}`;
          const pt = (along: number, across: number) => `${(tip.x + t.x * along + n.x * across).toFixed(1)},${(tip.y + t.y * along + n.y * across).toFixed(1)}`;
          return (
            <g key={c.id} className="mp-beam__couple">
              <path className="mp-beam__halo" d={arc} />
              <path d={arc} />
              <polygon className="mp-beam__head" points={`${pt(6, 0)} ${pt(-4, 4.6)} ${pt(-4, -4.6)}`} />
              <text className="mp-beam__label" x={x} y={Y - r - 8} textAnchor={x < 48 ? 'start' : x > width - 48 ? 'end' : 'middle'}>
                {typed(c.M)} {u.moment}
              </text>
            </g>
          );
        })}

        {/* reactions */}
        {reactionMarks.map((r, i) => (
          <g key={i} className="mp-beam__reaction">
            {r.dir > 0 ? (
              <>
                <line x1={r.at} x2={r.at} y1={R_BOTTOM} y2={R_TOP + R_HEAD} />
                <polygon className="mp-beam__head" points={head(r.at, R_TOP, -1, R_HEAD)} />
              </>
            ) : r.dir < 0 ? (
              <>
                <line x1={r.at} x2={r.at} y1={R_TOP} y2={R_BOTTOM - R_HEAD} />
                <polygon className="mp-beam__head" points={head(r.at, R_BOTTOM, 1, R_HEAD)} />
              </>
            ) : null}
            {r.shown
              ? r.lines.map((line, k) => (
                  <text key={k} x={r.at + r.side * R_TEXT} y={(R_TOP + R_BOTTOM) / 2 + 4 + k * 14} textAnchor={r.side > 0 ? 'start' : r.side < 0 ? 'end' : 'middle'}>
                    {line}
                  </text>
                ))
              : null}
          </g>
        ))}

        {/* positions */}
        <g className="mp-beam__dim">
          <line x1={px(0)} x2={px(L)} y1={H - 22} y2={H - 22} />
          {[0, L, ...form.supports.map((s) => s.x), ...form.hinges.map((h) => h.x), ...form.points.map((p) => p.x), ...form.couples.map((c) => c.x), ...form.dists.flatMap((d) => [d.x1, d.x2])]
            .filter(on)
            .filter((x, i, arr) => arr.indexOf(x) === i)
            .map((x) => (
              <line key={x} x1={px(x)} x2={px(x)} y1={H - 26} y2={H - 18} />
            ))}
          {dimLabels.map((l) => (
            <text key={l.at} x={l.at} y={H - 5} textAnchor="middle">
              {l.text}
            </text>
          ))}
          <text className="mp-beam__unit" x={width - 2} y={H - 5} textAnchor="end">
            {u.length}
          </text>
        </g>

        {probeX !== null ? <line className="mp-plot__probe-line" x1={px(probeX)} x2={px(probeX)} y1={8} y2={H - 26} /> : null}
      </svg>
    </figure>
  );
}
