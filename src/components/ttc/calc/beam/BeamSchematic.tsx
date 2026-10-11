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
 * Every load has its value written by it, and no value is written over
 * another or past the side of the drawing: where two would meet, one moves
 * along its load or goes up a line (`arranged`), and a row of point loads
 * too close even for that, or that would go up line upon line, has each
 * value written up its own arrow's line.
 * None is left out to make room, as a dimension is — the loads' values are
 * what the drawing is for — and the drawing grows upward by what that takes.
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
const R_TURN = 7.3; // …and of a line that starts with ↻ or ↺, an arrow drawn 2 px wider than a digit: '↺ 58.33' is 50.4 px, not 48.3
const P_TOP = Y - HALF - 62; // where a point load's arrow starts
const C_R = 20; // the radius of an applied moment's arc
// A load's value is one line of that mono: what it fills above and below the
// line it is written on, and the step from one line to the next one up.
const V_UP = 12;
const V_DOWN = 3;
const V_LINE = 15;
const V_GAP = 10; // between two values on a line: more than the space inside "16 kip"
const V_EDGE = 2; // what a value keeps from each side of the drawing
const V_HEAD = 4; // and from its top
const V_TURN = 4; // a value written upward: from the line it is centred on to its baseline

const head = (x: number, y: number, dir: 1 | -1, size = 5) => `${x},${y} ${x - size},${y - dir * size * 1.7} ${x + size},${y - dir * size * 1.7}`;

type Anchor = 'start' | 'middle' | 'end';
/**
 * Where a value is written: the x its text hangs from, by which end, and its
 * baseline. Or `turned`, reading upward: the line it is centred on, and its foot.
 */
type Spot = { x: number; y: number; anchor: Anchor; turned?: boolean };
/** What a value fills, and the room it keeps along its reading: sideways (`gx`), or up and down (`gy`). */
type Box = { l: number; r: number; t: number; b: number; gx: number; gy: number };

const boxAt = (s: Spot, w: number): Box => {
  if (s.turned) return { l: s.x + V_TURN - V_UP, r: s.x + V_TURN + V_DOWN, t: s.y - w, b: s.y, gx: 0, gy: V_GAP / 2 };
  const l = s.anchor === 'start' ? s.x : s.anchor === 'end' ? s.x - w : s.x - w / 2;
  return { l, r: l + w, t: s.y - V_UP, b: s.y + V_DOWN, gx: V_GAP / 2, gy: 0 };
};
/** Two values that would read as one, or lie on each other. */
const meet = (p: Box, q: Box) => p.l - p.gx < q.r + q.gx && q.l - q.gx < p.r + p.gx && p.t - p.gy < q.b + q.gy && q.t - q.gy < p.b + p.gy;

/**
 * Where each load's value is written. Each comes with the places it would
 * take on its own line, the best first, and gets the first one clear of
 * every value placed before it; where its line has none, the same places one
 * line up, then two. So the order of the list is who keeps its place.
 *
 * `stem` is where the load's own drawing ends under its value. A value that
 * goes up is tied back to it by a line, and that line is kept clear too: no
 * later value is written across it.
 */
function arranged<T extends { text: string; spots: [Spot, ...Spot[]]; stem: { x: number; y: number } | null }>(values: T[]): (T & { spot: Spot; box: Box; up: number })[] {
  const taken: Box[] = [];
  return values.map((v) => {
    const w = v.text.length * R_CHAR;
    // Above every value already written there is room, so this ends.
    for (let up = 0; ; up += 1) {
      for (const s of v.spots) {
        const spot = { ...s, y: s.y - up * V_LINE };
        const box = boxAt(spot, w);
        if (taken.some((t) => meet(box, t))) continue;
        taken.push(box);
        if (up && v.stem) taken.push({ l: v.stem.x - 3, r: v.stem.x + 3, t: box.b, b: v.stem.y, gx: 0, gy: 0 });
        return { ...v, spot, box, up };
      }
    }
  });
}

/**
 * Labels along one line, dropped where they would run into one that is kept.
 * The first and the last keep their places before any between them: on the
 * dimension line those are the two ends of the beam, and a support a foot
 * before the end took the end's label — a 20 ft beam read "0 … 19 ft".
 */
function spaced<T extends { at: number; text: string }>(labels: T[], charWidth = 6.4, gap = 8): T[] {
  const sorted = [...labels].sort((p, q) => p.at - q.at);
  const half = (l: T) => (l.text.length * charWidth) / 2;
  const kept: T[] = [];
  const clear = (l: T) => kept.every((k) => l.at + half(l) + gap <= k.at - half(k) || k.at + half(k) + gap <= l.at - half(l));
  for (const l of [sorted[0], sorted[sorted.length - 1], ...sorted.slice(1, -1)]) if (l && !kept.includes(l) && clear(l)) kept.push(l);
  return kept.sort((p, q) => p.at - q.at);
}

export function BeamSchematic({
  form,
  reactions,
  ownWeight = 0,
  width,
  probeX,
  summary,
  group = ',',
}: {
  form: BeamForm;
  reactions: BeamReaction[] | null;
  /** The beam's own weight per length, when it is one of the loads (kip/ft, kN/m). Drawn; its value is in the title above. */
  ownWeight?: number;
  width: number;
  probeX: number | null;
  summary: string;
  /** What sets the thousands apart in every number of the drawing: the page's, as in its tables. */
  group?: string;
}) {
  const u = UNITS[form.units];
  const L = form.L > 0 && Number.isFinite(form.L) ? form.L : 1;
  const on = (x: number) => Number.isFinite(x) && x >= 0 && x <= L;
  const px = (x: number) => xToPx(Math.min(L, Math.max(0, x)), L, width);
  const top = Y - HALF;

  // What is typed is shown as typed; what is computed, to the four figures of the tables.
  const typed = (v: number) => formatNumber(Math.abs(v), 6, group);
  const wMax = Math.max(1e-12, Math.abs(ownWeight), ...form.dists.flatMap((d) => [Math.abs(d.w1), Math.abs(d.w2)]).filter(Number.isFinite));
  const hOf = (w: number) => (w === 0 ? 0 : 10 + (Math.abs(w) / wMax) * 34);
  // Each distributed load with its two intensities SIGNED, positive downward.
  const dists = [
    ...form.dists
      // A size that is not a number — 1e308 kip/ft turned into kN/m — is named
      // in its row and is nothing to draw: it wrote NaN into the drawing.
      .filter((d) => on(d.x1) && on(d.x2) && d.x1 !== d.x2 && Number.isFinite(d.w1) && Number.isFinite(d.w2) && (d.w1 !== 0 || d.w2 !== 0))
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
    const way = (w: number) => (w > 0 ? '↓' : '↑');
    const value = t0 !== null ? `${typed(d.wa)} ${way(d.wa)} – ${typed(d.wb)} ${way(d.wb)}` : d.wa === d.wb ? typed(d.wa) : `${typed(d.wa)} – ${typed(d.wb)}`;
    return { ...d, ha, hb, t0, heightAt, xa: px(d.a), xb: px(d.b), text: `${value} ${u.line}` };
  });
  const points = form.points.filter((p) => on(p.x) && Number.isFinite(p.P) && p.P !== 0).map((p) => ({ ...p, at: px(p.x) }));
  const couples = form.couples.filter((c) => on(c.x) && Number.isFinite(c.M) && c.M !== 0).map((c) => ({ ...c, at: px(c.x) }));

  /* ── Where the loads' values are written ────────────────────────────── */
  const fits = (s: Spot, w: number) => boxAt(s, w).l >= V_EDGE && boxAt(s, w).r <= width - V_EDGE;
  // A place that would cross a side of the drawing, hung from that side instead.
  const kept = (s: Spot, w: number): Spot => (fits(s, w) ? s : boxAt(s, w).l >= V_EDGE && w <= width - 2 * V_EDGE ? { ...s, x: width - V_EDGE, anchor: 'end' } : { ...s, x: V_EDGE, anchor: 'start' });
  // The values of a row of point loads, or of applied moments: each centred
  // over its own (hung from it near an end of the drawing, as it always was),
  // and where two neighbours would meet, each on its outer side. `turned`: the
  // whole row written upward instead, each value along its own load's line.
  const over = (kind: 'point' | 'couple', row: { key: string; at: number; text: string }[], y: number, stem: number, turned = false) => {
    const own = [...row]
      .sort((p, q) => p.at - q.at)
      .map((p) => {
        const w = p.text.length * R_CHAR;
        const hung = (anchor: Anchor): Spot => ({ x: p.at, y, anchor });
        const first = hung(p.at < 48 ? 'start' : p.at > width - 48 ? 'end' : 'middle');
        const spot = [first, hung('middle'), hung('start'), hung('end')].find((s) => fits(s, w)) ?? kept(first, w);
        return { ...p, w, hung, spot, box: boxAt(spot, w) };
      });
    return own.map((p) => {
      // A neighbour on one side only. (Two loads at one place are on neither: their values go one above the other.)
      const left = own.some((q) => q.at < p.at && meet(p.box, q.box));
      const right = own.some((q) => q.at > p.at && meet(p.box, q.box));
      const away = left === right ? null : p.hung(left ? 'start' : 'end');
      // The neighbour on the left is written first, and may have gone up: beside it only if it is still in the way.
      const beside: [Spot, ...Spot[]] = away && fits(away, p.w) ? (left ? [p.spot, away] : [away, p.spot]) : [p.spot];
      const spots: [Spot, ...Spot[]] = turned ? [{ x: p.at, y: stem - 6, anchor: 'start', turned }] : beside;
      return { kind, key: p.key, text: p.text, spots, stem: { x: p.at, y: stem } };
    });
  };
  // A distributed load's value: over its left end, as it always was; else over
  // its right end or its middle. A place a point load's arrow would run
  // through comes after the ones that are clear of them all.
  const along = dists
    .filter((d) => !d.own)
    .map((d) => ({ ...d, y: top - Math.max(d.ha, d.hb) - 6 }))
    // The lowest first: of two values that would meet, the taller load's is the one that goes up.
    .sort((p, q) => q.y - p.y)
    .map((d) => {
      const w = d.text.length * R_CHAR;
      const ends: Spot[] = [
        { x: d.xa + 2, y: d.y, anchor: 'start' },
        { x: d.xb - 2, y: d.y, anchor: 'end' },
        { x: (d.xa + d.xb) / 2, y: d.y, anchor: 'middle' },
      ];
      const crossed = (s: Spot) => points.some((p) => p.at > boxAt(s, w).l - 2 && p.at < boxAt(s, w).r + 2);
      const [best = kept(ends[0], w), ...rest] = ends.filter((s) => fits(s, w)).sort((p, q) => Number(crossed(p)) - Number(crossed(q)));
      const spots: [Spot, ...Spot[]] = [best, ...rest];
      return { kind: 'dist' as const, key: `d${d.id}`, text: d.text, spots, stem: null };
    });
  // Who keeps its place: the moments' values and the distributed loads' are
  // written first. A point load's can go up its own arrow's line and still
  // be read as that arrow's, so it is the one that gives way.
  const written = (turned: boolean) =>
    arranged([
      ...over('couple', couples.map((c) => ({ key: `c${c.id}`, at: c.at, text: `${typed(c.M)} ${u.moment}` })), Y - C_R - 8, Y - C_R - 3),
      ...along,
      ...over('point', points.map((p) => ({ key: `p${p.id}`, at: p.at, text: `${typed(p.P)} ${u.force}` })), P_TOP - 7, P_TOP, turned),
    ]);
  // A value that went up is tied back to its load by a thin line from the
  // load to it. Behind a value written before it, on its way, the line is
  // left out: it showed through the space of "2.5 kip" and read as part of it.
  const tied = (values: ReturnType<typeof written>) =>
    values.flatMap((v) => {
      if (!v.up || !v.stem) return [];
      const { x, y } = v.stem;
      const under = values.filter((o) => o !== v && x > o.box.l - 3 && x < o.box.r + 3 && o.box.b > v.box.b && o.box.t < y);
      // Two loads at one place: the upper value stands on the lower one, and needs no line.
      if (under.some((o) => o.stem?.x === x)) return [];
      // From the value down to the load, in the pieces left between the values it passes.
      const pieces: [number, number][] = [];
      let from = v.box.b + 2;
      for (const o of under.sort((p, q) => p.box.t - q.box.t)) {
        if (o.box.t - 1 > from) pieces.push([from, o.box.t - 1]);
        from = Math.max(from, o.box.b + 1);
      }
      if (from < y) pieces.push([from, y]);
      return [{ key: v.key, crowded: under.some((o) => o.kind === 'point' && v.kind === 'point'), d: pieces.filter(([a, b]) => b - a >= 2).map(([a, b]) => `M${x} ${a}V${b}`).join('') }];
    });
  // A row of point loads too close for lines one above the other — a value's
  // line would pass behind its neighbours' values, and which arrow a value
  // belonged to was a guess: every value of the row is written up its own
  // arrow's line. So is a row that would climb: twelve joists 12 in apart,
  // each value a few pixels too long to stand beside the line of the one
  // before, went up a line each — eleven lines, 120 px of drawing, and
  // equal loads that looked like a ramp of growing arrows. Written upward
  // they take one row, so that is the choice wherever the level lines would
  // be more than one line taller than it.
  const level = written(false);
  const upright = written(true);
  // The lines some values need above the drawing's own height.
  const riseOf = (vs: typeof level) => Math.max(0, Math.ceil(V_HEAD - Math.min(...vs.map((v) => v.box.t))));
  const values = tied(level).some((t) => t.crowded) || riseOf(level) > riseOf(upright) + V_LINE ? upright : level;
  const ties = tied(values).filter((t) => t.d);
  const valueOf = new Map(values.map((v) => [v.key, v]));
  const rise = riseOf(values);

  const dimLabels = spaced(
    [0, L, ...form.supports.map((s) => s.x), ...form.hinges.map((h) => h.x)]
      .filter(on)
      .filter((x, i, arr) => arr.indexOf(x) === i)
      .map((x) => ({ at: px(x), text: formatNumber(x, 4, group) })),
  );
  const reactionMarks = (() => {
    const list = (reactions ?? [])
      .filter((r) => on(r.x) && Number.isFinite(r.Rv) && Number.isFinite(r.Rm))
      .map((r) => ({
        at: px(r.x),
        // No force, no arrow: its value alone, under the support.
        dir: r.Rv === 0 ? 0 : r.Rv > 0 ? 1 : -1,
        // The force, and under it the moment of a fixed support with the way it turns.
        lines: [formatNumber(Math.abs(r.Rv), 4, group), ...(r.kind === 'fixed' && r.Rm !== 0 ? [`${r.Rm < 0 ? '↻' : '↺'} ${formatNumber(Math.abs(r.Rm), 4, group)}`] : [])],
      }))
      .sort((p, q) => p.at - q.at);
    // Every arrow keeps its place whatever is written. A value is written
    // beside its arrow; where a neighbour's value comes within 3 px of it
    // there, one LINE LOWER, still beside its arrow (two '23.65' in a span of
    // 89 px miss each other by 2 px on a phone, and one of them went
    // unwritten). Never under a neighbour's value or over it, though: two
    // numbers one above the other between two arrows read as one support's
    // force and moment, and which arrow each belonged to was a guess. An
    // arrow takes both lines; a force with its moment under it takes both too.
    //
    // A value with no such place is left to the table, which has them all.
    // That is every value of a span too short for one — 9 from its arrow, the
    // value, 3, and the 6 the next arrow keeps: about 52 px for five
    // characters, so seven supports on a phone are arrows alone; one of the
    // two in a span too short for both end to end; and the value of an end
    // support whose inside is taken by a neighbour's arrow — a support 1 ft
    // before the end of a 20 ft beam, on a desk as on a phone.
    type Span = { a: number; b: number; rows: readonly number[] };
    const taken: Span[] = list.map((r) => ({ a: r.at - R_CLEAR, b: r.at + R_CLEAR, rows: [0, 1] }));
    // What is on a line keeps 3 px from whatever else is on it; what is on
    // the other line has only to end before this begins. A hair of slack: a
    // value stands exactly 3 clear of its own arrow, and 119.33 + 9 − 3 is not
    // always 119.33 + 6 — which sent the value of a support inside the beam
    // to the other side, or left it out.
    const free = (s: Span) =>
      s.a >= 2 &&
      s.b <= width - 2 &&
      taken.every((t) => {
        const apart = t.rows.some((row) => s.rows.includes(row)) ? 3 : 0;
        return s.b + apart <= t.a + 1e-6 || s.a - apart >= t.b - 1e-6;
      });
    const place = (r: (typeof list)[number]) => {
      const w = Math.max(...r.lines.map((s) => s.length * (/^[↻↺]/.test(s) ? R_TURN : R_CHAR)));
      if (r.dir === 0) return { ...r, side: 0, row: 0, shown: true };
      const right = { a: r.at + R_TEXT, b: r.at + R_TEXT + w };
      const left = { a: r.at - R_TEXT - w, b: r.at - R_TEXT };
      // Which side comes first is decided by WHERE THE SUPPORT IS, not by how
      // long its number happens to be: at the far end of the drawing, where a
      // value of six characters would not fit outside, it goes inside.
      const inside = r.at + R_TEXT + 6 * R_CHAR > width - 2;
      const sides = inside ? [left, right] : [right, left];
      const lines: (readonly number[])[] = r.lines.length > 1 ? [[0, 1]] : [[0], [1]];
      const span = lines.flatMap((rows) => sides.map((side) => ({ ...side, rows }))).find(free);
      if (!span) return { ...r, side: 0, row: 0, shown: false };
      taken.push(span);
      return { ...r, side: span.a > r.at ? 1 : -1, row: span.rows[0], shown: true };
    };
    // The supports at the two ends of the drawing have one side to write on,
    // the inside; the ones between have two. So the ends take their places
    // first, and a neighbour goes to its other side or, with neither free,
    // is the one left to the table — placed left to right, the support
    // before the last took the room and the last one, on a phone, was an
    // arrow with no value.
    const order = list.map((_, i) => i).sort((p, q) => Number(q === 0 || q === list.length - 1) - Number(p === 0 || p === list.length - 1) || p - q);
    const placed: ReturnType<typeof place>[] = [];
    for (const i of order) placed[i] = place(list[i]);
    return placed;
  })();

  return (
    <figure className="mp-plot mp-beam">
      {/* Taller by the lines the values took, upward: nothing else moves. */}
      <svg className="mp-plot__svg" width={width} height={H + rise} viewBox={`0 ${-rise} ${width} ${H + rise}`} role="img" aria-label={summary}>
        {/* The lines that tie a value which went up back to its load: thin, in the
            colour of the text, and first of all — whatever is drawn is drawn over them. */}
        {ties.length ? (
          <g stroke="currentColor" strokeWidth={1} fill="none">
            {ties.map((t) => (
              <path key={t.key} d={t.d} />
            ))}
          </g>
        ) : null}

        {/* distributed loads */}
        {dists.map((d) => {
          const { xa, xb } = d;
          const n = Math.max(1, Math.round((xb - xa) / 26));
          const arrows = Array.from({ length: n + 1 }, (_, i) => {
            const t = i / n;
            const x = xa + (xb - xa) * t;
            const w = d.wa + (d.wb - d.wa) * t;
            // As tall as the load is there, and pointing the way it acts there:
            // a load whose ends differ in sign tapers to nothing and turns round.
            return { x, h: d.heightAt(t), down: w > 0, zero: w === 0 };
          });
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
        {points.map((p) => {
          const x = p.at;
          const down = (p.dir === 'down') === p.P > 0;
          const y0 = P_TOP;
          const value = valueOf.get(`p${p.id}`)!;
          return (
            <g key={p.id} className="mp-beam__point">
              <line x1={x} x2={x} y1={y0} y2={top} />
              <polygon className="mp-beam__head" points={down ? head(x, top, 1) : head(x, y0, -1)} />
              {value.spot.turned ? (
                <text className="mp-beam__label" x={value.spot.x + V_TURN} y={value.spot.y} textAnchor="start" transform={`rotate(-90 ${value.spot.x + V_TURN} ${value.spot.y})`}>
                  {value.text}
                </text>
              ) : (
                <text className="mp-beam__label" x={value.spot.x} y={value.spot.y} textAnchor={value.spot.anchor}>
                  {value.text}
                </text>
              )}
            </g>
          );
        })}

        {/* applied moments */}
        {couples.map((c) => {
          const x = c.at;
          const ccw = (c.dir === 'ccw') === c.M > 0;
          const r = C_R;
          const value = valueOf.get(`c${c.id}`)!;
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
              <text className="mp-beam__label" x={value.spot.x} y={value.spot.y} textAnchor={value.spot.anchor}>
                {value.text}
              </text>
            </g>
          );
        })}

        {/* The distributed loads' values, after every arrow: one that crosses a
            value goes behind it. The beam's own weight has none: it runs the
            whole beam, under every other value, and wherever it was put it sat
            on one of them. Its value is in the drawing's title
            (BeamCalculator.tsx). */}
        {along.length ? (
          <g className="mp-beam__dist">
            {along.map(({ key }) => {
              const value = valueOf.get(key)!;
              return (
                <text key={key} className="mp-beam__label" x={value.spot.x} y={value.spot.y} textAnchor={value.spot.anchor}>
                  {value.text}
                </text>
              );
            })}
          </g>
        ) : null}

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
                  <text key={k} x={r.at + r.side * R_TEXT} y={(R_TOP + R_BOTTOM) / 2 + 4 + (r.row + k) * 14} textAnchor={r.side > 0 ? 'start' : r.side < 0 ? 'end' : 'middle'}>
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

        {probeX !== null ? <line className="mp-plot__probe-line" x1={px(probeX)} x2={px(probeX)} y1={8 - rise} y2={H - 26} /> : null}
      </svg>
    </figure>
  );
}
