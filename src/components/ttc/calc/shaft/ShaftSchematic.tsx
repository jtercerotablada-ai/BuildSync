'use client';

import React, { useMemo } from 'react';
import { formatNumber } from '@/lib/calc/format';
import type { ShaftDrawing } from '@/lib/calc/shaft/types';
import { PLOT_PAD, xToPx } from '../beam/BeamPlot';

/**
 * The shaft as entered, in one of its three views: its profile, its two
 * bearings, every load of the view with its size, and - once solved - each
 * bearing's reaction under it. On the same x scale as the diagrams below it
 * (`xToPx`), so a shoulder, a bearing and the kink each makes line up down
 * the page.
 *
 * It is given a `ShaftDrawing` (lib/calc/shaft/types.ts) and knows nothing of
 * the form or of the engine. It is drawn by the hand that draws the beam
 * (beam/BeamSchematic.tsx) - the same supports, arrow heads, halos behind the
 * numbers and dimension line - and shares no code with it: that drawing is
 * another calculator's.
 *
 * WHAT IS RECKONED AND WHAT IS DRAWN are two functions. `shaftLayout` is
 * arithmetic from end to end: where every shape and every value goes.
 * `ShaftSchematic` writes what it returns as SVG and adds nothing of its
 * own. So the layout is held to its rules over thousands of shafts without
 * React (shaft-schematic.test.ts), and it is kept from one draw to the next
 * (`useMemo`): the pointer moving along a diagram moves one line of this
 * drawing, and nothing is reckoned again for that.
 *
 * THE PROFILE. Each segment is a rectangle as long as the segment, on the
 * diagrams' scale, and as tall as its diameter on ONE scale for the whole
 * shaft: a shoulder is drawn as the shoulder it is, and a journal half as
 * thick as the body is half as tall. That scale is the one along the shaft
 * wherever it gives the largest diameter between 24 and 52 px - the drawing
 * is then to scale both ways. A shaft forty diameters long would be a
 * hairline and one three diameters long would fill the page: there the
 * largest diameter is held to 24 or to 52 px, and the shaft is drawn thicker
 * or thinner than it is, every segment by the same ratio (`shaftHeight`).
 * A bore is dashed, as an edge that cannot be seen is drawn; the axis is a
 * chain line that runs a little past both ends.
 *
 * A BEARING is the triangle of a simple support, its tip on the under side
 * of the shaft where the bearing stands (at a step, of the thicker part:
 * the whole triangle is then seen). Both are drawn alike: each holds the
 * shaft across its axis and lets it turn, and which of the two locates it
 * along its axis is no part of this calculation. The triangles are drawn
 * BEHIND the shaft: beside a shoulder that reaches lower than the journal,
 * the shoulder hides the corner of the triangle it would cross, as a part in
 * front of a symbol does.
 *
 * A FORCE is an arrow from one level above the shaft down to its surface,
 * wherever the shaft is thick or thin: over a journal the arrow is longer,
 * and no length means a size. The head says which way it acts, as on the
 * beam. A COUPLE is an arc about the axis, with its head at the end it turns
 * towards: one size for all of them, wide enough to pass 14 px clear of the
 * thickest part - of the head of an arrow that ends there and of the band
 * below. THE SHAFT'S OWN WEIGHT is that band, light, along the top of the
 * shaft: taller over a heavier segment - by the metal in its section, the
 * density being one - and with no value by it. It is a weight per length
 * for every segment, and written along the shaft they would lie under every
 * other value: they are left to the page.
 *
 * BOTH PLANES AT ONCE (`resultants`). Every size is then the size of two
 * components together, and has no one direction in the plane of the paper:
 * NOTHING IS AN ARROW. A force is a line with a dot on the axis, a couple an
 * arc with no head, a bearing's radial load a number under its triangle.
 *
 * WHERE THE VALUES ARE WRITTEN. No value is written over another, over the
 * line of an arrow or its head, over an arc or past the side of the drawing
 * (one wider than the whole drawing is centred on it), and none is left out
 * to make room: the drawing grows upward by what they take.
 *   - A couple's value stands on the line just above the arcs, by its own
 *     arc: over its middle, or as near to it as the arrows and the values
 *     already there allow, never further than 8 px from the couple's line.
 *   - A force's value stands over the start of its arrow; where two would
 *     meet, each on its outer side; where there is no room, a line higher,
 *     tied back to its arrow by a thin line.
 *   - A couple's value with no room by its arc goes up too, tied to the arc.
 *     With a force at the same place it stands on that force's value, as two
 *     loads at one place are written on the beam.
 *   - Or the forces' values are written UPWARD, each along its own arrow's
 *     line, and with them those of the couples that had no room by their
 *     arcs - each standing on its own arc where the column over it is free.
 *     That is how the drawing is made wherever level lines would be worse:
 *     more ties passing behind a value, or as many and the drawing more than
 *     a line taller (`shaftLayout`, `turn`).
 *
 * A REACTION is an arrow on the bearing's own line, under it, and its value
 * beside the arrow: to four figures, as the tables write it. Each hangs from
 * its own bearing, so under a thin journal it stands higher than under a
 * thick one. A value is never nearer the other bearing's arrow than twice
 * what it is from its own: between two bearings close together it would be
 * anybody's. One with no such place is not written: the drawing has its
 * arrow, and the number is the page's to show in its tables.
 *
 * THE DIMENSION LINE has a tick at every place where something is - one
 * tick where two places are drawn within a tenth of a pixel of each other,
 * as a load typed on a shoulder and the sum of the lengths that makes the
 * shoulder can be - and writes the two ends, the bearings and the steps, in
 * that order of who keeps its place where two would run together. The length
 * is kept clear of the unit written after it.
 *
 * A drawing of the visitor's own data: every number on it is in the tables
 * beside it too, so the SVG is described in one sentence (`summary`) and its
 * shapes are hidden from a screen reader.
 */

const P_TOP = 53; // where the arrow of a force starts, whatever part of the shaft is under it
const P_MIN = 52; // the shortest of those arrows: the one over the thickest part
const P_HEAD = 5; // half the width of its head, which is 8.5 long
const D_MIN = 24; // the largest diameter as drawn: never under this - a long shaft is not a hairline
const D_MAX = 52; // nor over this - a short one does not fill the page
const C_OUT = 14; // the arc of a couple stands this far outside the thickest part: clear of the head of an arrow that ends there, and of the band of the shaft's own weight
const C_SIDE = 8; // how far from the line of its own couple a value may begin
const W_MIN = 3; // the band of the shaft's own weight: over its lightest segment
const W_MAX = 10; // and over its heaviest
const S_H = 17; // the triangle of a bearing: its height
const S_HALF = 10; // half its base
const S_BASE = 14; // half the line it stands on
const R_GAP = 12; // from the foot of that triangle to the arrow of the reaction
const R_LEN = 24; // that arrow
const R_HEAD = 4.5; // half the width of its head
const R_TEXT = 9; // from its line to its value
const R_CHAR = 6.9; // one character of the labels' 11.5px mono
// A value is one line of that mono: what it fills above and below the line
// it is written on, and the step from one line to the next one up.
const V_UP = 12;
const V_DOWN = 3;
const V_LINE = 15;
const V_GAP = 10; // between two values on a line: more than the space inside "360 lbf"
const V_EDGE = 2; // what a value keeps from each side of the drawing
const V_HEAD = 4; // and from its top
const V_TURN = 4; // a value written upward: from the line it is centred on to its baseline
const D_CHAR = 6.8; // one character of the dimension line's 11px mono, and a little
const D_CLEAR = 4; // between the length of the shaft and the unit after it
const D_GAP = 8; // between two positions written on the dimension line

/**
 * How tall the largest diameter is drawn, in px, for a shaft `L` long drawn
 * `width` wide: to the scale of its length where that is between 24 and 52
 * px, and held to those where it is not. A whole number of pixels each side
 * of the axis. Every other diameter is drawn by the same ratio.
 */
export function shaftHeight(dMax: number, L: number, width: number): number {
  const along = L > 0 ? Math.max(1, width - 2 * PLOT_PAD) / L : 0;
  return 2 * Math.round(Math.min(D_MAX, Math.max(D_MIN, dMax * along)) / 2);
}

const head = (x: number, y: number, dir: 1 | -1, size = P_HEAD) => `${x},${y} ${x - size},${y - dir * size * 1.7} ${x + size},${y - dir * size * 1.7}`;

/**
 * Where a value is written: the x its text is centred on and its baseline.
 * Or `turned`, reading upward: the line it is centred on, and its foot.
 */
type Spot = { x: number; y: number; turned?: boolean };
/** What a value fills, and the room it keeps along its reading: sideways (`gx`), or up and down (`gy`). */
type Box = { l: number; r: number; t: number; b: number; gx: number; gy: number };
/** A load of the view as the drawing has it: where it is, which way it acts, and what is written by it. */
type Load = { key: string; kind: 'force' | 'couple'; at: number; sign: number; tip: number; text: string; w: number };
/** A value in its place: `up` lines above where it would stand of its own, and where the line that ties it back ends. */
type Value = { key: string; kind: 'force' | 'couple'; at: number; text: string; spot: Spot; box: Box; up: number; stem: { x: number; y: number } | null };

const boxAt = (s: Spot, w: number): Box =>
  s.turned ? { l: s.x + V_TURN - V_UP, r: s.x + V_TURN + V_DOWN, t: s.y - w, b: s.y, gx: 0, gy: V_GAP / 2 } : { l: s.x - w / 2, r: s.x + w / 2, t: s.y - V_UP, b: s.y + V_DOWN, gx: V_GAP / 2, gy: 0 };
/** Two values that would read as one, or lie on each other. */
const meet = (p: Box, q: Box) => p.l - p.gx < q.r + q.gx && q.l - q.gx < p.r + p.gx && p.t - p.gy < q.b + q.gy && q.t - q.gy < p.b + p.gy;

const tenth = (v: number) => Math.round(v * 10) / 10;

/**
 * Along one line, where a value `w` wide is centred: on the first of `aims`
 * that is free as it stands; else - unless only those places will do
 * (`strict`) - as near to the first of them as what is `taken` allows,
 * between `lo` and `hi`. Null where the line has no such room.
 */
function slide(aims: number[], lo: number, hi: number, w: number, y: number, taken: Box[], strict = false): number | null {
  if (!(lo <= hi)) return null;
  const line = boxAt({ x: 0, y }, w);
  // Each thing on this line, as the stretch of centres it rules out.
  const shut = taken.filter((o) => o.t - o.gy < line.b && line.t < o.b + o.gy).map((o) => [o.l - o.gx - line.gx - w / 2, o.r + o.gx + line.gx + w / 2]);
  const open = (c: number) => c >= lo && c <= hi && shut.every(([a, b]) => c <= a || c >= b);
  // To a tenth of a pixel where that is as free: the drawing's markup is read by people too.
  const settled = (c: number) => (open(tenth(c)) ? tenth(c) : open(c) ? c : null);
  const within = (c: number) => Math.min(hi, Math.max(lo, c));
  for (const aim of aims) {
    const c = settled(within(aim));
    if (c !== null) return c;
  }
  if (strict) return null;
  // What is left between the stretches ruled out, as the place in each that is nearest to where the value would
  // have stood; and of those, the nearest. (Every edge of every stretch tried against every stretch was a
  // hundredth of a second for a shaft with all its loads, at each key pressed.)
  const from = within(aims[0]);
  const gaps: number[] = [];
  let reached = lo;
  for (const [a, b] of [...shut].sort((p, q) => p[0] - q[0])) {
    if (a - 0.1 >= reached) gaps.push(Math.min(a - 0.1, Math.max(reached, from)));
    reached = Math.max(reached, b + 0.1);
    if (reached > hi) break;
  }
  if (reached <= hi) gaps.push(Math.min(hi, Math.max(reached, from)));
  for (const gap of gaps.sort((p, q) => Math.abs(p - from) - Math.abs(q - from))) {
    const c = settled(gap);
    if (c !== null) return c;
  }
  return null;
}

/**
 * Labels along one line, dropped where they would run into one that is
 * kept. Who keeps its place is said by `rank`: the two ends of the shaft
 * before the bearings, the bearings before the steps - the last number of
 * the line, beside the unit, is read as the length of the shaft.
 *
 * `at` is where a label is written, `place` where the thing it names is,
 * when the two differ (the length, moved clear of the unit).
 */
function spaced<T extends { at: number; place: number; rank: number; text: string }>(labels: T[]): T[] {
  const half = (l: T) => (l.text.length * D_CHAR) / 2;
  const kept: T[] = [];
  const clear = (l: T) => kept.every((k) => l.at + half(l) + D_GAP <= k.at - half(k) || k.at + half(k) + D_GAP <= l.at - half(l));
  for (const l of [...labels].sort((p, q) => p.rank - q.rank || p.place - q.place)) if (clear(l)) kept.push(l);
  return kept.sort((p, q) => p.place - q.place);
}

/** Everything of the drawing, in px of an SVG `width` wide and `height` tall whose top is `rise` above 0. */
export interface ShaftLayout {
  width: number;
  /** As tall as its shaft needs, and the lines the values took above that. */
  height: number;
  /** Those lines, in px: the drawing's top is this far above its own 0. */
  rise: number;
  /** The length the drawing reckons with: the drawing's own, or 1 where that is not a length. */
  L: number;
  /** Down the drawing: the axis of the shaft, and the dimension line. */
  axis: number;
  dim: number;
  /** Along it: the two ends of the shaft. */
  from: number;
  to: number;
  /** The radius of every couple's arc. */
  arc: number;
  /** Each segment that has a diameter: where it starts, how long it is, and half its height. */
  segments: { x: number; width: number; r: number }[];
  /** The edges of the bores: along a hollow segment each side of the axis, and across where a bore ends or changes. */
  bores: { x1: number; x2: number; y1: number; y2: number }[];
  /** The band of the shaft's own weight over each segment, and where its small arrows are. None: no band. */
  weight: { x: number; y: number; width: number; height: number; arrows: number[] }[];
  /** Each bearing on the shaft, left to right: where it stands and where the tip of its triangle is. */
  bearings: { at: number; apex: number }[];
  /** Each force: its line from `top` to `tip`, and whether its head is at the tip (it acts downward) or at the top. */
  forces: { key: string; at: number; top: number; tip: number; down: boolean }[];
  /** Each couple: its arc as a path, and its head as the points of a triangle. */
  couples: { key: string; at: number; d: string; head: string }[];
  /** Each load's value: its text, where it is written, whether it reads upward, and the box it fills. */
  values: { key: string; text: string; x: number; y: number; turned: boolean; l: number; r: number; t: number; b: number }[];
  /** The line from a value that went up to its load: at x, in the pieces that are drawn of it. */
  ties: { key: string; x: number; pieces: [number, number][] }[];
  /** Each bearing's reaction: its arrow from `top`, 24 px long, up (1), down (-1) or none (0); its value, and where, if it is written. */
  reactions: { at: number; top: number; dir: number; text: string; shown: boolean; x: number; y: number; anchor: 'start' | 'middle' | 'end' }[];
  /** The dimension line: a tick at each of these - no two of them within a tenth of a pixel - and each of these numbers. */
  ticks: number[];
  positions: { at: number; text: string }[];
  unit: string;
}

/** Where everything of the drawing goes. Arithmetic only: what is drawn of it is `ShaftSchematic`'s. */
export function shaftLayout(drawing: ShaftDrawing, { resultants, width, group = ',', figures = 6 }: { resultants: boolean; width: number; group?: string; figures?: number }): ShaftLayout {
  const L = drawing.L > 0 && Number.isFinite(drawing.L) ? drawing.L : 1;
  const on = (x: number) => Number.isFinite(x) && x >= 0 && x <= L;
  const px = (x: number) => xToPx(Math.min(L, Math.max(0, x)), L, width);

  /* The profile. A segment whose diameter is not a positive number has a place and nothing to draw: its row says so. */
  const stretches = drawing.segments.filter((s) => on(s.from) && on(s.to) && s.to > s.from);
  const round = stretches.filter((s) => Number.isFinite(s.d) && s.d > 0);
  const dMax = Math.max(0, ...round.map((s) => s.d));
  const R = dMax > 0 ? shaftHeight(dMax, L, width) / 2 : D_MIN / 2; // half the largest diameter, as drawn
  // One scale across for the whole shaft, taken as each diameter's SHARE of the largest (0 to 1) times R - not as
  // px to a unit of diameter: 2R / dMax is past the largest number there is for a largest diameter under 3e-307,
  // and d * d for a diameter of 1.4e154 or more. Such a diameter is no shaft's and its row says so; the drawing
  // is still made of numbers.
  const share = (d: number) => (dMax > 0 ? d / dMax : 0);
  const body = round.map((s) => {
    const bore = Number.isFinite(s.bore) && s.bore > 0 && s.bore < s.d ? s.bore : 0;
    return { from: s.from, to: s.to, a: px(s.from), b: px(s.to), r: share(s.d) * R, bore: share(bore) * R, metal: share(s.d) ** 2 - share(bore) ** 2 };
  });

  /* Down the drawing: the axis, the arcs, the line the couples' values stand on, the lowest the shaft reaches, the dimension line. */
  const Y = P_TOP + P_MIN + R;
  const C_R = R + C_OUT;
  const HOME = Y - C_R - 8;
  const LOW = Y + R;
  const DIM = LOW + S_H + R_GAP + R_LEN + 20;
  const H = DIM + 22;

  /** How far the shaft reaches from its axis at a place: at a step, the thicker of the two. */
  const reach = (x: number) => Math.max(0, ...body.filter((s) => s.from <= x && x <= s.to).map((s) => s.r));
  /**
   * Where the tip of a bearing's triangle is, from the axis: on the shaft
   * where the bearing stands - at a step, on the thicker part, so that the
   * shoulder hides none of the triangle. Unless a thicker part stands within
   * the triangle's width on BOTH sides - a groove narrower than the symbol:
   * the tip is then at the mouth of the groove, and neither side hides all
   * of it.
   */
  const seat = (x: number, at: number) => {
    const side = (a: number, b: number) => Math.max(0, ...body.filter((s) => s.a < b && s.b > a).map((s) => s.r));
    return Math.max(reach(x), Math.min(side(at - S_HALF, at), side(at, at + S_HALF)));
  };

  const wide = (text: string) => [...text].length * R_CHAR;
  const loads = (kind: Load['kind'], list: ShaftDrawing['forces']): Load[] =>
    list
      .map((p, i) => ({ p, key: `${kind[0]}${i}` }))
      // What is not a number, or is nothing, is nothing to draw: the drawing never writes NaN.
      .filter(({ p }) => on(p.x) && Number.isFinite(p.value) && p.value !== 0)
      .map(({ p, key }) => ({ key, kind, at: px(p.x), sign: Math.sign(p.value), tip: resultants ? Y : Y - reach(p.x), text: p.label, w: wide(p.label) }))
      .sort((p, q) => p.at - q.at);
  const forces = loads('force', drawing.forces);
  const couples = loads('couple', drawing.couples);
  /** The height of a couple's arc at `s` to the side of the couple's own line. */
  const arc = (s: number) => Y - Math.sqrt(C_R * C_R - s * s);

  /* Where the loads' values are written. */
  // The line of each force's arrow, and its head, which is wider: no value is written across either.
  const lines: Box[] = forces.flatMap((f) => [
    { l: f.at - 1, r: f.at + 1, t: P_TOP, b: f.tip, gx: 0, gy: 0 },
    ...(resultants ? [] : [f.sign > 0 ? { l: f.at - P_HEAD, r: f.at + P_HEAD, t: f.tip - 8.5, b: f.tip, gx: 0, gy: 0 } : { l: f.at - P_HEAD, r: f.at + P_HEAD, t: P_TOP, b: P_TOP + 8.5, gx: 0, gy: 0 }]),
  ]);
  /** Between which centres a value `w` wide may stand so as to come within `near` of the place it is hung by, inside the drawing. */
  const between = (at: number, near: number, w: number): [number, number] => {
    const [lo, hi] = [V_EDGE + w / 2, width - V_EDGE - w / 2];
    // Wider than the drawing: on its middle, a little past both sides.
    return lo > hi ? [width / 2, width / 2] : [Math.max(lo, at - near), Math.min(hi, at + near)];
  };
  /**
   * A row of values, each over its own load: where two neighbours would
   * meet, each aims for its outer side first. (Two loads at one place are on
   * neither side of each other: their values go one above the other.)
   */
  const beside = (row: Load[], y: number) => {
    const own = row.map((p) => {
      const [lo, hi] = between(p.at, p.w / 2, p.w);
      const c = Math.min(hi, Math.max(lo, p.at));
      return { p, c, box: boxAt({ x: c, y }, p.w) };
    });
    return own.map(({ p, c, box }) => {
      const left = own.some((q) => q.p.at < p.at && meet(box, q.box));
      const right = own.some((q) => q.p.at > p.at && meet(box, q.box));
      // The neighbour on the left is written first, and may have moved out of the way: beside it only if it is still there.
      return { ...p, aims: left === right ? [c] : left ? [c, p.at + p.w / 2] : [p.at - p.w / 2, c] };
    });
  };

  /**
   * Every value in its place. Who is written first keeps its place: the
   * couples' values that have room by their own arcs, then the forces', then
   * the couples' that had none. `upright`: the forces' values are written
   * upward instead, each along its own arrow's line, and so are those of the
   * couples that have no room by their arcs.
   */
  const written = (upright: boolean): Value[] => {
    const taken: Box[] = [...lines];
    const out: Value[] = [];
    const clear = (box: Box) => !taken.some((t) => meet(box, t));
    const put = (v: Load, spot: Spot, up: number, stem: Value['stem']): Value => {
      const box = boxAt(spot, v.w);
      taken.push(box);
      // The line that ties a value back to its load is kept clear too: no later value is written across it.
      if (up && stem) taken.push({ l: stem.x - 3, r: stem.x + 3, t: box.b, b: stem.y, gx: 0, gy: 0 });
      const value: Value = { key: v.key, kind: v.kind, at: v.at, text: v.text, spot, box, up, stem };
      out.push(value);
      return value;
    };

    // The couples, by their arcs: in the order of the arcs, so no value stands left of one written before it.
    const crowded: Load[] = [];
    let edge = -Infinity;
    for (const c of beside(couples, HOME)) {
      const [lo, hi] = between(c.at, c.w / 2 + C_SIDE, c.w);
      const x = slide(c.aims, Math.max(lo, edge + V_GAP + c.w / 2), hi, c.w, HOME, taken);
      if (x === null) crowded.push(c);
      else edge = put(c, { x, y: HOME }, 0, null).box.r;
    }

    // The forces: over the start of each arrow, or a line higher - above every value already written there is room, so this ends.
    for (const f of beside(forces, P_TOP - 7)) {
      for (let up = 0; ; up += 1) {
        if (upright) {
          const spot: Spot = { x: f.at, y: P_TOP - 6 - up * V_LINE, turned: true };
          if (!clear(boxAt(spot, f.w))) continue;
          put(f, spot, up, { x: f.at, y: P_TOP });
          break;
        }
        const y = P_TOP - 7 - up * V_LINE;
        // Over its arrow a value is centred on it or hangs from it by an end, and nowhere between: one that
        // drifted along the line took the room of the next, whose own then went up behind it. A line up, it
        // stands as near over the arrow as there is room, the line that ties it back meeting it inside.
        const x = slide(up ? [f.at] : f.aims, ...between(f.at, up ? Math.max(0, f.w / 2 - 3) : f.w / 2, f.w), f.w, y, taken, !up);
        if (x === null) continue;
        put(f, { x, y }, up, { x: f.at, y: P_TOP });
        break;
      }
    }

    for (const c of crowded) {
      // A force at the same place: the couple's value stands on that force's, and needs no line.
      const twin = out.filter((v) => v.kind === 'force' && Math.abs(v.at - c.at) < 0.5).sort((p, q) => p.box.t - q.box.t)[0];
      if (twin) {
        for (let up = 1; ; up += 1) {
          if (twin.spot.turned) {
            const spot: Spot = { x: c.at, y: twin.box.t - V_GAP - (up - 1) * V_LINE, turned: true };
            if (!clear(boxAt(spot, c.w))) continue;
            put(c, spot, up, { x: c.at, y: P_TOP });
            break;
          }
          const x = slide([twin.spot.x], ...between(c.at, c.w / 2, c.w), c.w, twin.spot.y - up * V_LINE, taken);
          if (x === null) continue;
          put(c, { x, y: twin.spot.y - up * V_LINE }, up, { x: c.at, y: P_TOP });
          break;
        }
        continue;
      }
      // Tied to its arc by a line that keeps 5 px from every arrow: from the top of the arc, or from a little to one side of it.
      const sides = [0, -6, 6, -12, 12, -18, 18, -24, 24].filter((s) => Math.abs(s) <= C_R - 8 && c.at + s >= 12 && c.at + s <= width - 12);
      const off = (s: number, by: number) => forces.every((f) => Math.abs(f.at - c.at - s) >= by);
      if (upright) {
        // Standing on its own arc, near its top, where a column is free of arrows and of values from the arc
        // to the value's top. Its foot is 6 px above the highest the arc comes under it: the arc falls away
        // to the sides, and a value stood on its slope would have the arc through its corner.
        const stood = sides
          .filter((s) => Math.abs(s) <= 12)
          .map((s): Spot => ({ x: c.at + s, y: tenth(arc(Math.max(0, Math.abs(s) - 8))) - 6, turned: true }))
          .find((spot) => clear(boxAt(spot, c.w)));
        if (stood) {
          put(c, stood, 0, null);
          continue;
        }
        const s = sides.find((s) => off(s, 5)) ?? 0;
        for (let up = 1; ; up += 1) {
          const spot: Spot = { x: c.at + s, y: Y - C_R - 6 - up * V_LINE, turned: true };
          if (!clear(boxAt(spot, c.w))) continue;
          put(c, spot, up, { x: c.at + s, y: tenth(arc(s)) - 1 });
          break;
        }
        continue;
      }
      const free = (s: number) => clear({ l: c.at + s - 3, r: c.at + s + 3, t: HOME - V_UP, b: arc(s), gx: 0, gy: 0 });
      const s = sides.find((s) => off(s, 5) && free(s)) ?? sides.find((s) => off(s, 5)) ?? 0;
      for (let up = 1; ; up += 1) {
        // The line above the couples' own, between the arrows; then the lines above the arrows.
        const y = up === 1 ? HOME - V_LINE : P_TOP - 7 - (up - 2) * V_LINE;
        const x = slide([c.at + s], ...between(c.at + s, Math.max(0, c.w / 2 - 3), c.w), c.w, y, taken);
        if (x === null) continue;
        put(c, { x, y }, up, { x: c.at + s, y: tenth(arc(s)) - 1 });
        break;
      }
    }
    return out;
  };

  /**
   * The thin line from a value that went up to its load, in the pieces that
   * are drawn of it. Behind a value on its way the line is left out
   * (`broken`): it would show through the space of "360 lbf" and read as
   * part of it.
   */
  const tied = (values: Value[]) =>
    values.flatMap((v) => {
      if (!v.up || !v.stem) return [];
      const { x, y } = v.stem;
      const under = values.filter((o) => o !== v && x > o.box.l - 3 && x < o.box.r + 3 && o.box.b > v.box.b && o.box.t < y);
      // Two loads at one place: the upper value stands on the lower one, and needs no line.
      if (under.some((o) => Math.abs(o.at - v.at) < 0.5)) return [];
      const pieces: [number, number][] = [];
      let from = v.box.b + 2;
      for (const o of under.sort((p, q) => p.box.t - q.box.t)) {
        if (o.box.t - 1 > from) pieces.push([from, o.box.t - 1]);
        from = Math.max(from, o.box.b + 1);
      }
      if (from < y) pieces.push([from, y]);
      return [{ key: v.key, x, broken: under.length > 0, pieces: pieces.filter(([a, b]) => b - a >= 2).map(([a, b]): [number, number] => [tenth(a), tenth(b)]) }];
    });
  // The lines some values need above the drawing's own height.
  const riseOf = (vs: Value[]) => Math.max(0, Math.ceil(V_HEAD - Math.min(V_HEAD, ...vs.map((v) => v.box.t))));
  // Level where that reads: no line passing behind a value, and not more than
  // a line taller than the same values written upward. Twelve forces a few
  // pixels apart went up a line each, and equal loads looked like a ramp.
  const level = written(false);
  const upright = forces.length ? written(true) : level;
  const [levelTies, uprightTies] = [tied(level), upright === level ? [] : tied(upright)];
  const [levelBroken, uprightBroken] = [levelTies, uprightTies].map((ts) => ts.filter((t) => t.broken).length);
  const turn = upright !== level && (uprightBroken < levelBroken || (uprightBroken === levelBroken && riseOf(level) > riseOf(upright) + V_LINE));
  const values = turn ? upright : level;
  const rise = riseOf(values);

  /* The bearings, and the reaction under each. */
  const bearings = drawing.bearings
    .filter((b) => on(b.x))
    .map((b) => {
      const at = px(b.x);
      const apex = Y + seat(b.x, at);
      const given = b.reaction !== null && Number.isFinite(b.reaction);
      const text = given ? formatNumber(Math.abs(b.reaction as number), 4, group) : '';
      // No force, no arrow: its value alone, under the bearing. So is a resultant, which points no one way.
      const dir = !given || resultants || text === '0' ? 0 : (b.reaction as number) > 0 ? 1 : -1;
      return { at, apex, top: apex + S_H + R_GAP, given, text, dir };
    })
    .sort((p, q) => p.at - q.at);
  /**
   * Where each reaction's value is written. Every arrow keeps its place
   * whatever is written. A value is beside its own arrow, 9 px from it - on
   * the side that has room, inside the drawing at its two ends - or one line
   * lower, still beside its arrow. One with no arrow is under its bearing.
   *
   * Whose a value is must not be a guess. So it keeps twice that far, 18 px,
   * from the other bearing's arrow: "5,400" stood between two bearings 53 px
   * apart, 9 px from each arrow. And it is never over or under the other
   * bearing's value: two numbers one above the other between two arrows read
   * as one bearing's. A value with no such place is left to the table.
   */
  const reactions = (() => {
    type Area = { l: number; r: number; t: number; b: number };
    type Mark = (typeof bearings)[number] & { shown: boolean; x: number; y: number; anchor: 'start' | 'middle' | 'end' };
    const placed = (order: number[]): Mark[] => {
      const taken: (Area & { of: number })[] = [];
      const free = (s: Area, of: number) =>
        s.l >= V_EDGE &&
        s.r <= width - V_EDGE &&
        taken.every((v) => {
          const apart = s.t < v.b && v.t < s.b ? 3 : 0;
          return v.of === of || s.l >= v.r + apart - 1e-6 || s.r <= v.l - apart + 1e-6;
        }) &&
        bearings.every((o, i) => {
          if (i === of) return true;
          if (o.dir && s.l < o.at + 2 * R_TEXT - 1e-6 && s.r > o.at - 2 * R_TEXT + 1e-6) return false;
          // …nor on the other bearing's triangle, where that one hangs as low as this value is written.
          return s.t >= o.apex + S_H + 2 || s.l >= o.at + S_BASE + 2 || s.r <= o.at - S_BASE - 2;
        });
      const out: Mark[] = bearings.map((r) => ({ ...r, shown: false, x: r.at, y: 0, anchor: 'middle' }));
      for (const of of order) {
        const r = bearings[of];
        if (!r.given) continue;
        const w = r.text.length * R_CHAR;
        // With no arrow, under the bearing: inside the drawing where that would cross a side of it.
        const under = Math.min(width - V_EDGE - w, Math.max(V_EDGE, r.at - w / 2));
        const right = { l: r.at + R_TEXT, r: r.at + R_TEXT + w, anchor: 'start' as const, x: r.at + R_TEXT };
        const left = { l: r.at - R_TEXT - w, r: r.at - R_TEXT, anchor: 'end' as const, x: r.at - R_TEXT };
        // Which side comes first is decided by WHERE THE BEARING IS, not by how long its number happens to be.
        const sides = r.dir === 0 ? [{ l: under, r: under + w, anchor: 'middle' as const, x: under + w / 2 }] : r.at + R_TEXT + 6 * R_CHAR > width - V_EDGE ? [left, right] : [right, left];
        const found = [0, 1]
          .flatMap((row) => sides.map((side) => ({ ...side, y: (r.dir === 0 ? r.top + 8 : r.top + R_LEN / 2 + 4) + row * 14 })))
          .map((spot) => ({ ...spot, t: spot.y - V_UP, b: spot.y + V_DOWN }))
          .find((spot) => free(spot, of));
        if (!found) continue;
        taken.push({ l: found.l, r: found.r, t: found.t, b: found.b, of });
        out[of] = { ...r, shown: true, x: found.x, y: found.y, anchor: found.anchor };
      }
      return out;
    };
    // The one written first has the choice of places: in the order that leaves fewer to the table.
    const forward = placed(bearings.map((_, i) => i));
    const backward = placed(bearings.map((_, i) => i).reverse());
    return backward.filter((r) => r.shown).length > forward.filter((r) => r.shown).length ? backward : forward;
  })();

  /* The dimension line. */
  const places = (list: number[]) => list.filter(on);
  const steps = places(stretches.flatMap((s) => [s.from, s.to])).filter((x) => x > 0 && x < L);
  const unit = drawing.lengthUnit;
  const positions = spaced(
    [
      ...[0, L].map((x) => ({ x, rank: 0 })),
      ...places(drawing.bearings.map((b) => b.x)).map((x) => ({ x, rank: 1 })),
      ...steps.map((x) => ({ x, rank: 2 })),
    ]
      // A bearing at an end or at a step is one place: named once, by the first that names it.
      .filter((p, i, all) => all.findIndex((q) => q.x === p.x) === i)
      .map(({ x, rank }) => {
        const text = formatNumber(x, figures, group);
        // The length is the last number of the line and the unit stands right after it, at the edge of the
        // drawing: where the two would come within 4 px the length is written that much to the left, still
        // under its tick.
        const clear = width - 2 - [...unit].length * D_CHAR - D_CLEAR - (text.length * D_CHAR) / 2;
        return { at: x === L ? Math.min(px(x), clear) : px(x), place: px(x), rank, text };
      }),
  );
  // One tick to a place AS DRAWN. Two places can be two numbers and one position on the line: a shoulder that is
  // the sum 12.7 + 25.4 (38.099999999999994) and a bearing typed at 38.1. Told apart by their numbers they were
  // two ticks at one pixel - and two lines with one name for React, which then left one of them on the drawing
  // at every later change of it, on screen and on the sheet. So: each place where it is drawn, and no tick
  // within a tenth of a pixel of one that is there already.
  const ticks: number[] = [];
  for (const at of [0, L, ...steps, ...places([...drawing.bearings, ...drawing.forces, ...drawing.couples].map((p) => p.x))].map(px)) {
    if (!ticks.some((t) => Math.abs(t - at) < 0.1)) ticks.push(at);
  }

  /* The shaft's own weight: a band on its top, as tall over each segment as the metal in its section. */
  const metalMax = Math.max(0, ...body.map((s) => s.metal));
  const weight = !drawing.ownWeight || !(metalMax > 0)
    ? []
    : body.map((s) => {
        const height = W_MIN + (W_MAX - W_MIN) * (s.metal / metalMax);
        const n = Math.max(1, Math.round((s.b - s.a) / 26));
        // Small arrows where the band is tall enough to hold one, and never at a step. A resultant has none.
        const arrows = !resultants && height >= 9 && s.b - s.a >= 10 ? Array.from({ length: n }, (_, j) => s.a + ((s.b - s.a) * (j + 0.5)) / n) : [];
        return { x: s.a, y: Y - s.r - height, width: s.b - s.a, height, arrows };
      });

  /* The bores: along each hollow segment; and across, where one begins, ends or changes - the step inside is an edge too. */
  const bores = [
    ...body.flatMap((s) => (s.bore > 0 ? [-1, 1].map((side) => ({ x1: s.a, x2: s.b, y1: Y + side * s.bore, y2: Y + side * s.bore })) : [])),
    ...body.slice(1).flatMap((s, i) => {
      const before = body[i];
      const [small, large] = [Math.min(before.bore, s.bore), Math.max(before.bore, s.bore)];
      if (before.to !== s.from || small === large) return [];
      // The bottom of a hole is one line across it; a change of bore, a short one each side of the axis.
      return small > 0 ? [{ x1: s.a, x2: s.a, y1: Y - large, y2: Y - small }, { x1: s.a, x2: s.a, y1: Y + small, y2: Y + large }] : [{ x1: s.a, x2: s.a, y1: Y - large, y2: Y + large }];
    }),
  ];

  return {
    width,
    height: H + rise,
    rise,
    L,
    axis: Y,
    dim: DIM,
    from: px(0),
    to: px(L),
    arc: C_R,
    segments: body.map((s) => ({ x: s.a, width: s.b - s.a, r: s.r })),
    bores,
    weight,
    bearings: bearings.map((b) => ({ at: b.at, apex: b.apex })),
    forces: forces.map((f) => ({ key: f.key, at: f.at, top: P_TOP, tip: f.tip, down: f.sign > 0 })),
    // A couple: an arc over the shaft, from 20 degrees below the horizontal on one side to 20 degrees below it
    // on the other, drawn clockwise on screen. The head is at the end the couple turns towards, along the
    // tangent there.
    couples: couples.map((c) => {
      const ccw = c.sign > 0;
      const at = (deg: number) => ({ x: c.at + C_R * Math.cos((deg * Math.PI) / 180), y: Y + C_R * Math.sin((deg * Math.PI) / 180) });
      const start = at(160);
      const end = at(20);
      const tip = ccw ? start : end;
      const phi = ((ccw ? 160 : 20) * Math.PI) / 180;
      const t = ccw ? { x: Math.sin(phi), y: -Math.cos(phi) } : { x: -Math.sin(phi), y: Math.cos(phi) };
      const n = { x: -t.y, y: t.x };
      const pt = (along: number, side: number) => `${(tip.x + t.x * along + n.x * side).toFixed(1)},${(tip.y + t.y * along + n.y * side).toFixed(1)}`;
      return { key: c.key, at: c.at, d: `M${start.x.toFixed(1)} ${start.y.toFixed(1)} A${C_R} ${C_R} 0 1 1 ${end.x.toFixed(1)} ${end.y.toFixed(1)}`, head: `${pt(6, 0)} ${pt(-4, 4.6)} ${pt(-4, -4.6)}` };
    }),
    values: values.map((v) => ({ key: v.key, text: v.text, x: v.spot.x, y: v.spot.y, turned: Boolean(v.spot.turned), l: v.box.l, r: v.box.r, t: v.box.t, b: v.box.b })),
    ties: (turn ? uprightTies : levelTies).filter((t) => t.pieces.length).map((t) => ({ key: t.key, x: t.x, pieces: t.pieces })),
    reactions: reactions.filter((r) => r.given).map((r) => ({ at: r.at, top: r.top, dir: r.dir, text: r.text, shown: r.shown, x: r.x, y: r.y, anchor: r.anchor })),
    ticks,
    positions: positions.map((p) => ({ at: p.at, text: p.text })),
    unit,
  };
}

export function ShaftSchematic({
  drawing,
  resultants,
  width,
  probeX,
  summary,
  group = ',',
  figures = 6,
}: {
  /** The shaft in the view shown (lib/calc/shaft/model.ts, `drawingOf`). */
  drawing: ShaftDrawing;
  /** The view is of both planes together: every size is a resultant, which has no one direction on paper - nothing is drawn as an arrow. */
  resultants: boolean;
  width: number;
  /** The position the pointer asks about, in the drawing's unit of length, or none. */
  probeX: number | null;
  /** The drawing in one sentence, for whoever cannot see it. */
  summary: string;
  /** What sets the thousands apart in every number the drawing writes itself: the page's, as in its tables. */
  group?: string;
  /** How many figures a position on the dimension line is written with: six, as a position that is a sum of the lengths typed is written; or as many as the page's tables write one with. */
  figures?: number;
}) {
  // Reckoned again when the shaft, the view or the width changes - not when the pointer moves: the place it asks
  // about is one line, drawn below. (That holds for as long as the page hands over the same `drawing` while the
  // shaft is the same: one made anew at every draw is reckoned anew at every draw, and is right all the same.)
  const g = useMemo(() => shaftLayout(drawing, { resultants, width, group, figures }), [drawing, resultants, width, group, figures]);
  const probe = probeX !== null && Number.isFinite(probeX) ? xToPx(Math.min(g.L, Math.max(0, probeX)), g.L, width) : null;

  return (
    <figure className="mp-plot mp-shaft-fig">
      {/* Taller by the lines the values took, upward: nothing else moves. */}
      <svg className="mp-plot__svg" width={width} height={g.height} viewBox={`0 ${-g.rise} ${width} ${g.height}`} role="img" aria-label={summary}>
        <g aria-hidden="true">
          {/* The lines that tie a value which went up back to its load: thin, and first of all - whatever is drawn is drawn over them. */}
          {g.ties.length ? (
            <g className="mp-shaft-fig__ties">
              {g.ties.map((t) => (
                <path key={t.key} d={t.pieces.map(([a, b]) => `M${t.x} ${a}V${b}`).join('')} />
              ))}
            </g>
          ) : null}

          {/* The shaft's own weight. */}
          {g.weight.length ? (
            <g className="mp-shaft-fig__weight">
              {g.weight.map((w, i) => (
                <React.Fragment key={i}>
                  <rect x={w.x} y={w.y} width={w.width} height={w.height} />
                  {w.arrows.map((x) => (
                    <React.Fragment key={x}>
                      <line x1={x} x2={x} y1={w.y} y2={w.y + w.height} />
                      <polygon className="mp-shaft-fig__head" points={head(x, w.y + w.height, 1, 3.4)} />
                    </React.Fragment>
                  ))}
                </React.Fragment>
              ))}
            </g>
          ) : null}

          {/* Each couple's arc in the page's colour, wider, under where the ink one will be: the band of the
              shaft's weight and its small arrows do not run through an arc drawn over them. Before the shaft
              itself, whose outline a dozen of these would rub out. */}
          {g.weight.length && g.couples.length ? (
            <g className="mp-shaft-fig__halo">
              {g.couples.map((c) => (
                <path key={c.key} d={c.d} />
              ))}
            </g>
          ) : null}

          {/* The bearings, behind the shaft: a shoulder that reaches lower than the journal hides what it would cross. */}
          {g.bearings.map((b, i) => (
            <g key={i} className="mp-shaft-fig__bearing">
              <polygon className="mp-shaft-fig__pin" points={`${b.at},${b.apex} ${b.at - S_HALF},${b.apex + S_H} ${b.at + S_HALF},${b.apex + S_H}`} />
              <line x1={b.at - S_BASE} x2={b.at + S_BASE} y1={b.apex + S_H + 0.5} y2={b.apex + S_H + 0.5} />
            </g>
          ))}

          {/* The shaft: its segments, the bore of a hollow one, its axis. */}
          <g className="mp-shaft-fig__body">
            {g.segments.map((s, i) => (
              <rect key={i} className="mp-shaft-fig__seg" x={s.x} y={g.axis - s.r} width={s.width} height={2 * s.r} />
            ))}
            {g.bores.map((b, i) => (
              <line key={i} className="mp-shaft-fig__bore" x1={b.x1} x2={b.x2} y1={b.y1} y2={b.y2} />
            ))}
            <line className="mp-shaft-fig__axis" x1={g.from - 10} x2={g.to + 10} y1={g.axis} y2={g.axis} />
          </g>

          {/* forces */}
          {g.forces.map((f) => (
            <g key={f.key} className="mp-shaft-fig__force">
              <line x1={f.at} x2={f.at} y1={f.top} y2={f.tip} />
              {resultants ? <circle className="mp-shaft-fig__dot" cx={f.at} cy={f.tip} r={2.75} /> : <polygon className="mp-shaft-fig__head" points={f.down ? head(f.at, f.tip, 1) : head(f.at, f.top, -1)} />}
            </g>
          ))}

          {/* couples */}
          {g.couples.map((c) => (
            <g key={c.key} className="mp-shaft-fig__couple">
              <path d={c.d} />
              {resultants ? null : <polygon className="mp-shaft-fig__head" points={c.head} />}
            </g>
          ))}

          {/* The values, after every arrow and arc. */}
          <g className="mp-shaft-fig__values">
            {g.values.map((v) =>
              v.turned ? (
                <text key={v.key} className="mp-shaft-fig__label" x={v.x + V_TURN} y={v.y} textAnchor="start" transform={`rotate(-90 ${v.x + V_TURN} ${v.y})`}>
                  {v.text}
                </text>
              ) : (
                <text key={v.key} className="mp-shaft-fig__label" x={v.x} y={v.y} textAnchor="middle">
                  {v.text}
                </text>
              ),
            )}
          </g>

          {/* reactions */}
          {g.reactions.map((r, i) => (
            <g key={i} className="mp-shaft-fig__reaction">
              {r.dir > 0 ? (
                <>
                  <line x1={r.at} x2={r.at} y1={r.top + R_LEN} y2={r.top + R_HEAD} />
                  <polygon className="mp-shaft-fig__head" points={head(r.at, r.top, -1, R_HEAD)} />
                </>
              ) : r.dir < 0 ? (
                <>
                  <line x1={r.at} x2={r.at} y1={r.top} y2={r.top + R_LEN - R_HEAD} />
                  <polygon className="mp-shaft-fig__head" points={head(r.at, r.top + R_LEN, 1, R_HEAD)} />
                </>
              ) : null}
              {r.shown ? (
                <text x={r.x} y={r.y} textAnchor={r.anchor}>
                  {r.text}
                </text>
              ) : null}
            </g>
          ))}

          {/* positions */}
          <g className="mp-shaft-fig__dim">
            <line x1={g.from} x2={g.to} y1={g.dim} y2={g.dim} />
            {/* By its number in the row, never by where it is: see `ticks`. */}
            {g.ticks.map((x, i) => (
              <line key={i} x1={x} x2={x} y1={g.dim - 4} y2={g.dim + 4} />
            ))}
            {g.positions.map((p) => (
              <text key={p.at} x={p.at} y={g.dim + 17} textAnchor="middle">
                {p.text}
              </text>
            ))}
            <text className="mp-shaft-fig__unit" x={width - 2} y={g.dim + 17} textAnchor="end">
              {g.unit}
            </text>
          </g>

          {probe !== null ? <line className="mp-plot__probe-line" x1={probe} x2={probe} y1={8 - g.rise} y2={g.dim - 4} /> : null}
        </g>
      </svg>
    </figure>
  );
}
