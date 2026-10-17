'use client';

import React, { useMemo } from 'react';
import { formatNumber } from '@/lib/calc/format';
import type { DrumDrawing } from '@/lib/calc/cable/analysis';
import type { CableUi } from '@/lib/calc/cable/strings';
import { FONT, Swatch, TagText, arcPath, clean, fitTag, hitsAny, polar, pt, tagBox, wrapLines, LINE, type Box, type LegendKey, type Pt, type Seg, type Tag } from './figure';

/**
 * THE DRUM - the capstan drawn the way it is drawn in a textbook.
 *
 * A drum (a circle with its centre marked). The cable comes in on its right
 * side and hangs DOWN: that is the LOAD END, carrying the large tension, in its
 * own colour. It is wrapped round the drum, counter-clockwise (the frame the
 * analysis fixes: lib/calc/cable/types.ts, "DRUM FRAME"), and leaves tangentially
 * where the wrap ends: that is the HOLDING END, carrying the small tension, pulled
 * away by whoever holds it. Both ends are named on the drawing in words, with
 * their tensions.
 *
 * THE WRAP is seen, not just said: the cable's contact is a thick line that
 * TAPERS from thick at the load end to thin at the holding end (the friction
 * the picture is about), a dimension arc inside the drum carries the angle in
 * degrees and turns, with the two radii it is measured between. More than one
 * turn is drawn as a COIL: a spiral whose loops are told apart (at most six
 * are drawn; the words give the true count). The size of each arrow, long and
 * thick or short and thin, follows the LOGARITHM of its tension - a ratio of
 * millions would otherwise leave the small end invisible - and the page says so.
 *
 * The force on the drum (the resultant) is not drawn: from the centre it lay on
 * the angle's own label. It is in the table.
 *
 * `drumLayout` is arithmetic from end to end; `DrumSchematic` writes it as SVG.
 * EVERY LABEL IS KEPT CLEAR OF EVERY LINE: each tag is put at the first of a few
 * places where its box touches no line of the drawing and no other tag
 * (`lines`, `tags`: the test holds it to that).
 */

const MIN_HEIGHT = 280;
const MAX_HEIGHT = 400;
const MAX_TURNS_DRAWN = 6;
const CHUNKS = 14;

export interface DrumOptions {
  width: number;
  group: string;
  unit: string;
  /** The page's words on the drawing; the numbers are in them already except the two tensions. */
  words: {
    load: string;
    hold: string;
    symbols: { big: string; small: string };
    /** "β = 720°" and "2 turns" (empty when the wrap is under a turn), "wrapped 2 turns" (empty when it is not more than one) and the sentence on the taper. */
    wrap: string;
    turns: string;
    coil: string;
    taper: string;
  };
  maxHeight?: number;
}

export interface DrumArrow {
  from: Pt;
  tip: Pt;
  dir: Pt;
  /** Line weight in pixels, and the head's three points. */
  width: number;
  head: Pt[];
  magnitude: number;
}

export interface DrumLayout {
  width: number;
  height: number;
  /** The drum: centre and radius in pixels. */
  drum: Pt & { r: number };
  /** The cable on the drum: a run of pieces, thick to thin, and how many loops are drawn. */
  cable: { chunks: { d: string; w: number }[]; loops: number; outer: number } | null;
  load: DrumArrow | null;
  hold: DrumArrow | null;
  /** The angle: an arc inside the drum with its head, the two radii it is measured between, and its words. */
  dim: { d: string; r: number; head: Pt[]; radials: Seg[]; tag: Tag } | null;
  tags: { id: 'load' | 'hold' | 'taper'; tag: Tag }[];
  /** The little lines from a tag to the cable it is about. */
  leaders: Seg[];
  /** Every line a tag must keep clear of. */
  lines: Seg[];
  legend: LegendKey[];
}

const ANGLES = [135, 225, 45, 315, 90, 270, 180, 0];
/** Where a tag may move to from a place that is not clear, nearest first. */
const SHIFTS: [number, number][] = [[0, 0], [0, -14], [0, 14], [14, 0], [-14, 0], [0, -28], [0, 28], [28, 0], [-28, 0], [14, -14], [-14, -14], [14, 14], [-14, 14], [0, -42], [0, 42]];

export function drumLayout(d: DrumDrawing | null, o: DrumOptions): DrumLayout {
  const maxH = o.maxHeight ?? MAX_HEIGHT;
  const height = clean(Math.max(MIN_HEIGHT, Math.min(maxH, o.width * 0.9)));
  const empty: DrumLayout = { width: o.width, height, drum: { x: clean(o.width / 2), y: clean(height / 2), r: 40 }, cable: null, load: null, hold: null, dim: null, tags: [], leaders: [], lines: [], legend: [] };
  if (!d) return empty;

  const big = d.arrows.find((a) => a.id === 'big')?.magnitude ?? 0;
  const small = d.arrows.find((a) => a.id === 'small')?.magnitude ?? 0;
  const ratio = small > 0 ? big / small : 1;
  // How much the two ends differ, from nothing to a thousandfold (or more): what the length and the weight of the arrows follow.
  const f = ratio > 1 ? Math.min(1, Math.log(ratio) / Math.log(1000)) : 0;
  const wBig = 3.6;
  const wSmall = 3.6 - 2.1 * f;

  // The wrap: whole turns (at most six drawn) and the part of a turn after them.
  const whole = Math.floor(d.wrap / 360 + 1e-9);
  const frac = Math.max(0, d.wrap - whole * 360);
  const exit = frac < 1e-9 ? 0 : frac;
  const drawnWrap = Math.min(whole, MAX_TURNS_DRAWN) * 360 + exit;
  const turnsDrawn = drawnWrap / 360;
  // The world: the drum has radius 1; the cable lies at 1.06 and spirals out by `pw` a turn.
  const pw = drawnWrap > 360 ? Math.min(0.14, 0.5 / turnsDrawn) : 0;
  const rho = (a: number) => 1.06 + pw * (a / 360);
  const world = (a: number, r: number) => ({ x: r * Math.cos((a * Math.PI) / 180), y: r * Math.sin((a * Math.PI) / 180) });
  const Lmax = 1.5;
  const Lb = Lmax;
  const Ls = Lmax * (1 - 0.5 * f);
  const bigFrom = world(0, rho(0));
  const bigTip = { x: bigFrom.x, y: bigFrom.y - Lb };
  const exitRad = (exit * Math.PI) / 180;
  const smallFrom = world(drawnWrap, rho(drawnWrap));
  const smallDir = { x: -Math.sin(exitRad), y: Math.cos(exitRad) };
  const smallTip = { x: smallFrom.x + smallDir.x * Ls, y: smallFrom.y + smallDir.y * Ls };
  const outerW = rho(drawnWrap) + 0.06;
  const xs = [-outerW, outerW, bigTip.x, smallTip.x];
  const ys = [-outerW, outerW, bigTip.y, smallTip.y];
  const xmin = Math.min(...xs);
  const xmax = Math.max(...xs);
  const ymin = Math.min(...ys);
  const ymax = Math.max(...ys);
  // Room is kept above the drawing for the sentence about the friction (and the coil), which has to lie clear of the cable.
  const sayLines = [...(o.words.coil ? [o.words.coil] : []), ...(drawnWrap > 0 ? wrapLines(o.words.taper, 24) : [])];
  const padTop = Math.max(46, sayLines.length ? sayLines.length * LINE + 16 : 0);
  const padBottom = 50;
  const scale = Math.min(84, (o.width - 2 * 58) / (xmax - xmin), (height - padTop - padBottom) / (ymax - ymin));
  const cx = o.width / 2 - ((xmin + xmax) / 2) * scale;
  const cy = padTop + (height - padTop - padBottom) / 2 + ((ymin + ymax) / 2) * scale;
  const P = (v: { x: number; y: number }): Pt => pt(cx + v.x * scale, cy - v.y * scale);
  const c = pt(cx, cy);
  const r = clean(scale);
  const num = (v: number) => formatNumber(v, 4, o.group);

  const lines: Seg[] = [];
  const segOf = (a: Pt, b: Pt): Seg => [a.x, a.y, b.x, b.y];
  // The drum, as chords.
  for (let a = 0; a < 360; a += 15) lines.push(segOf(polar(c, r, a), polar(c, r, a + 15)));

  // The cable on the drum, thick at the load end and thin at the holding end.
  let cable: DrumLayout['cable'] = null;
  if (drawnWrap > 0) {
    const chunks: { d: string; w: number }[] = [];
    let prev: Pt | null = null;
    for (let k = 0; k < CHUNKS; k++) {
      const a0 = (drawnWrap * k) / CHUNKS;
      const a1 = (drawnWrap * (k + 1)) / CHUNKS;
      const n = Math.max(2, Math.ceil((a1 - a0) / 5));
      const pts: Pt[] = [];
      for (let i = 0; i <= n; i++) {
        const a = a0 + ((a1 - a0) * i) / n;
        pts.push(P(world(a, rho(a))));
      }
      if (prev) lines.push(segOf(prev, pts[0]));
      for (let i = 1; i < pts.length; i++) lines.push(segOf(pts[i - 1], pts[i]));
      prev = pts[pts.length - 1];
      const mid = (a0 + a1) / 2;
      chunks.push({ d: `M ${pts.map((q) => `${q.x} ${q.y}`).join(' L ')}`, w: clean(wBig - (wBig - wSmall) * (mid / drawnWrap)) });
    }
    cable = { chunks, loops: Math.ceil(turnsDrawn - 1e-9), outer: clean(rho(drawnWrap) * scale) };
  }

  // The two ends, as arrows: length and weight follow the logarithm of the tension.
  const arrowOf = (from: { x: number; y: number }, tip: { x: number; y: number }, width: number, magnitude: number): DrumArrow => {
    const a = P(from);
    const b = P(tip);
    const len = Math.hypot(b.x - a.x, b.y - a.y) || 1;
    const dir = { x: (b.x - a.x) / len, y: (b.y - a.y) / len };
    const hl = 8 + width * 1.6;
    const base = { x: b.x - dir.x * hl, y: b.y - dir.y * hl };
    const hw = 3 + width * 0.9;
    lines.push(segOf(a, b));
    return { from: a, tip: b, dir: pt(dir.x, dir.y), width: clean(width), head: [b, pt(base.x - dir.y * hw, base.y + dir.x * hw), pt(base.x + dir.y * hw, base.y - dir.x * hw)], magnitude };
  };
  const load = big > 0 ? arrowOf(bigFrom, bigTip, wBig, big) : null;
  const hold = small > 0 ? arrowOf(smallFrom, smallTip, wSmall, small) : null;

  // The angle, inside the drum: an arc with its head, the two radii it is measured between, and its words at the centre.
  let dim: DrumLayout['dim'] = null;
  const boxes: Box[] = [];
  if (d.wrap > 0) {
    const ri = 0.78 * r;
    const sweep = d.wrap >= 360 ? 360 : d.wrap;
    const path = sweep >= 360 ? `${arcPath(c, ri, 0, 180)} ${arcPath(c, ri, 180, 360)}` : arcPath(c, ri, 0, sweep);
    for (let a = 0; a < sweep; a += 10) lines.push(segOf(polar(c, ri, a), polar(c, ri, Math.min(a + 10, sweep))));
    const tipAt = polar(c, ri, sweep);
    const t = (sweep * Math.PI) / 180;
    const tan = { x: -Math.sin(t), y: -Math.cos(t) };
    const base = { x: tipAt.x - tan.x * 9, y: tipAt.y - tan.y * 9 };
    const head = [tipAt, pt(base.x - tan.y * 3.6, base.y + tan.x * 3.6), pt(base.x + tan.y * 3.6, base.y - tan.x * 3.6)];
    const radial = (a: number): Seg => segOf(polar(c, 0.5 * r, a), polar(c, 0.95 * r, a));
    const radials: Seg[] = [radial(0)];
    if (sweep < 360) radials.push(radial(sweep));
    for (const s of radials) lines.push(s);
    const textLines = [o.words.wrap, ...(o.words.turns ? [o.words.turns] : [])];
    const tag: Tag = fitTag({ lines: textLines, x: c.x, y: c.y + 17, anchor: 'middle', named: false }, o.width, height);
    boxes.push(tagBox(tag));
    dim = { d: path, r: clean(ri), head, radials, tag };
  }

  // The words: where each is put is the first of a few places where it touches no line and no other tag.
  const tags: DrumLayout['tags'] = [];
  const leaders: Seg[] = [];
  const free = (t: Tag) => {
    const b = tagBox(t);
    return b.x0 >= 3 && b.x1 <= o.width - 3 && b.y0 >= 3 && b.y1 <= height - 3 && !hitsAny(b, lines) && !boxes.some((x) => b.x0 < x.x1 + 2 && x.x0 < b.x1 + 2 && b.y0 < x.y1 + 2 && x.y0 < b.y1 + 2);
  };
  const accept = (id: DrumLayout['tags'][number]['id'], candidates: Tag[]) => {
    const all = candidates.flatMap((t) => SHIFTS.map(([dx, dy]) => ({ ...t, x: t.x + dx, y: t.y + dy })));
    const chosen = all.find(free) ?? fitTag(candidates[0], o.width, height);
    boxes.push(tagBox(chosen));
    tags.push({ id, tag: chosen });
    return chosen;
  };
  const endCandidates = (a: DrumArrow, lns: string[]): Tag[] => {
    const h = (lns.length - 1) * LINE;
    const anchor = a.dir.x > 0.35 ? 'start' : a.dir.x < -0.35 ? 'end' : 'middle';
    const beyondY = a.dir.y > 0.35 ? a.tip.y + 12 + FONT : a.dir.y < -0.35 ? a.tip.y - 10 - h - 3 : a.tip.y + 4 - h / 2;
    const beyond: Tag = { lines: lns, x: a.tip.x + a.dir.x * 10, y: beyondY, anchor, named: true };
    const mid = { x: (a.from.x + a.tip.x) / 2, y: (a.from.y + a.tip.y) / 2 };
    return [
      beyond,
      { ...beyond, x: a.tip.x - 8, anchor: 'end' },
      { ...beyond, x: a.tip.x + 8, anchor: 'start' },
      { ...beyond, x: a.tip.x + a.dir.x * 10, y: beyondY + 18 },
      { lines: lns, x: mid.x + 12, y: mid.y + 4 - h / 2, anchor: 'start', named: true },
      { lines: lns, x: mid.x - 12, y: mid.y + 4 - h / 2, anchor: 'end', named: true },
      { lines: lns, x: a.tip.x + 14, y: a.tip.y + 4 - h / 2, anchor: 'start', named: true },
      { lines: lns, x: a.tip.x - 14, y: a.tip.y + 4 - h / 2, anchor: 'end', named: true },
      // Far from the arrow, in a corner of the drawing, with a leader to it: for a long number beside a drum that fills the width.
      { lines: lns, x: o.width - 6, y: 14, anchor: 'end', named: true },
      { lines: lns, x: o.width - 6, y: height - 8 - h, anchor: 'end', named: true },
      { lines: lns, x: 6, y: height - 8 - h, anchor: 'start', named: true },
    ];
  };
  // A name set far from its arrow is tied to it by a leader.
  const tie = (a: DrumArrow, t: Tag) => {
    const b = tagBox(t);
    const near = pt(Math.min(Math.max(a.tip.x, b.x0), b.x1), Math.min(Math.max(a.tip.y, b.y0), b.y1));
    if (Math.hypot(near.x - a.tip.x, near.y - a.tip.y) > 24) leaders.push(segOf(near, a.tip));
  };
  if (load) tie(load, accept('load', endCandidates(load, [o.words.load, `${o.words.symbols.big} = ${num(big)} ${o.unit}`])));
  if (hold) tie(hold, accept('hold', endCandidates(hold, [o.words.hold, `${o.words.symbols.small} = ${num(small)} ${o.unit}`])));

  // The friction sentence (with the coil's name first, when there is a coil): in the band above the drawing, with a leader to the cable.
  if (cable && sayLines.length) {
    const outer = cable.outer + 3;
    const h = (sayLines.length - 1) * LINE;
    const top = 14;
    const mk = (x: number, anchor: Tag['anchor']): Tag => ({ lines: sayLines, x, y: top, anchor, named: Boolean(o.words.coil) });
    const chosen = accept('taper', [mk(6, 'start'), mk(o.width - 6, 'end'), mk(o.width / 2, 'middle'), ...ANGLES.map((ang): Tag => {
      const p = polar(c, outer + 30, ang);
      const cs = Math.cos((ang * Math.PI) / 180);
      return { lines: sayLines, x: p.x, y: p.y + 4 - h / 2, anchor: cs > 0.35 ? 'start' : cs < -0.35 ? 'end' : 'middle', named: Boolean(o.words.coil) };
    })]);
    const b = tagBox(chosen);
    const mid = { x: (b.x0 + b.x1) / 2, y: (b.y0 + b.y1) / 2 };
    const ang = (Math.atan2(c.y - mid.y, mid.x - c.x) * 180) / Math.PI;
    const from = polar(c, outer, ang);
    leaders.push(segOf(from, pt(Math.min(Math.max(from.x, b.x0), b.x1), Math.min(Math.max(from.y, b.y0), b.y1))));
  }

  const legend: LegendKey[] = ['drum', 'centre'];
  if (cable) legend.push('taper', 'dimension');
  if (load) legend.push('loadEnd');
  if (hold) legend.push('holdEnd');
  return { width: o.width, height, drum: { ...c, r }, cable, load, hold, dim, tags, leaders, lines, legend };
}

export interface DrumSchematicProps extends DrumOptions {
  drawing: DrumDrawing | null;
  summary: string;
  legend: CableUi['results']['legend'];
}

function Arrow({ a, className }: { a: DrumArrow; className: string }) {
  const mid = { x: (a.head[1].x + a.head[2].x) / 2, y: (a.head[1].y + a.head[2].y) / 2 };
  return (
    <g className={className}>
      <line x1={a.from.x} y1={a.from.y} x2={mid.x} y2={mid.y} strokeWidth={a.width} />
      <polygon points={a.head.map((p) => `${p.x},${p.y}`).join(' ')} />
    </g>
  );
}

export function DrumSchematic({ drawing, width, group, unit, words, maxHeight, summary, legend: legendWords }: DrumSchematicProps) {
  const layout = useMemo(() => drumLayout(drawing, { width, group, unit, words, maxHeight }), [drawing, width, group, unit, words, maxHeight]);
  return (
    <figure className="mp-cable-fig">
      <svg className="mp-plot__svg mp-cable-fig__svg" role="img" aria-label={summary} viewBox={`0 0 ${layout.width} ${layout.height}`} width={layout.width} height={layout.height}>
        <g aria-hidden="true">
          <circle className="mp-cable-fig__drum" cx={layout.drum.x} cy={layout.drum.y} r={layout.drum.r} />
          {layout.dim ? (
            <g className="mp-cable-fig__dim">
              {layout.dim.radials.map((s, i) => (
                <line key={i} className="mp-cable-fig__refline" x1={s[0]} y1={s[1]} x2={s[2]} y2={s[3]} />
              ))}
              <path d={layout.dim.d} />
              <polygon points={layout.dim.head.map((p) => `${p.x},${p.y}`).join(' ')} />
              <TagText t={layout.dim.tag} className="mp-cable-fig__value" />
            </g>
          ) : null}
          <circle className="mp-cable-fig__node" cx={layout.drum.x} cy={layout.drum.y} r="2.5" />
          {layout.cable ? (
            <g className="mp-cable-fig__wrap">
              {layout.cable.chunks.map((ch, i) => (
                <path key={i} d={ch.d} strokeWidth={ch.w} />
              ))}
            </g>
          ) : null}
          {layout.load ? <Arrow a={layout.load} className="mp-cable-fig__load-end" /> : null}
          {layout.hold ? <Arrow a={layout.hold} className="mp-cable-fig__hold-end" /> : null}
          {layout.leaders.map((s, i) => (
            <line key={i} className="mp-cable-fig__refline" x1={s[0]} y1={s[1]} x2={s[2]} y2={s[3]} />
          ))}
          {layout.tags.map((t) => (
            <TagText key={t.id} t={t.tag} className={`mp-cable-fig__value mp-cable-fig__tag mp-cable-fig__tag--${t.id}`} />
          ))}
        </g>
      </svg>
      {layout.legend.length > 0 ? (
        <ul className="mp-cable-fig__legend">
          {layout.legend.map((key) => (
            <li key={key} className="mp-cable-fig__key">
              <Swatch kind={key} />
              <span>{legendWords[key]}</span>
            </li>
          ))}
        </ul>
      ) : null}
    </figure>
  );
}
