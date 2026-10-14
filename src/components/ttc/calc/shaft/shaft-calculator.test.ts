import { readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { createElement as h } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { afterEach, describe, expect, it } from 'vitest';
import { formatNumber } from '@/lib/calc/format';
import { MAX_ROWS as BEAM_ROWS } from '@/lib/calc/beam/model';
import { spanPage } from '@/lib/calc/beam/span-page-strings';
import { spanUi } from '@/lib/calc/beam/span-strings';
import { beamStrings } from '@/lib/calc/beam/strings';
import { continuousPage } from '@/lib/calc/continuous/page-strings';
import { continuousUi } from '@/lib/calc/continuous/strings';
import { CLOSE, SHORT, STIFF } from '@/lib/calc/shaft/engine';
import { MAX_ROWS, MAX_SEGMENTS, SHAFT_KEY, convertShaft, defaultShaft, type CoupleRow, type ForceRow, type SegmentRow, type ShaftForm, type ShaftView } from '@/lib/calc/shaft/model';
import { shaftPage } from '@/lib/calc/shaft/page-strings';
import { shaftUi, sharedWords } from '@/lib/calc/shaft/strings';
import { calculatorFamilies } from '@/lib/ttc/calculators';
import type { Lang } from '@/lib/ttc/i18n';
import { select } from '../shell/fields';
import { ShaftCalculator } from './ShaftCalculator';

// A turn of the event loop between two tests: every test here solves a shaft or several, and never waits. It
// lets the runner hear from this worker, which it otherwise reports as a timeout of its own over a passing run.
afterEach(() => new Promise<void>((done) => setTimeout(done, 0)));

/**
 * THE SHAFT CALCULATOR — the tool of /resources/shaft-on-bearings, as the
 * server sends it: what a visitor sees before the script arrives, or
 * without it.
 *
 * The page around it is held with its view (views/shaft.test.ts). The
 * arithmetic is held where it is done: lib/calc/shaft/engine.test.ts,
 * model.test.ts and analysis.test.ts. This is the component: its form, its
 * five cards read cell by cell AGAINST A SHAFT WORKED HERE BY ANOTHER METHOD
 * (`hand`, below: equilibrium, and M/EI integrated by Simpson's rule — held
 * itself against the closed forms of every textbook), its three views, its
 * faults on their rows, its words, and the shell's rules as they stand in
 * its source.
 *
 * What only a browser can show — typing, the address after the #, the
 * pointer on a diagram, the phone's layout, the printed sheet — is in the
 * regression script shaft-check.mjs, run against the page itself.
 */

const LANGS: Lang[] = ['en', 'es'];
const SRC = resolve(__dirname, '..', '..', '..', '..');

const text = (html: string) =>
  html
    .replace(/<(script|style|noscript)\b[\s\S]*?<\/\1>/g, ' ')
    // A figure set up after a unit (<sup>) is read as what it is: "in" and a raised 4 is in⁴.
    .replace(/<sup>3<\/sup>/g, '³')
    .replace(/<sup>4<\/sup>/g, '⁴')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&')
    .replace(/&#x27;/g, "'")
    .replace(/&quot;/g, '"')
    // (Not \s: the narrow space the Spanish page sets thousands apart with is white space to a regular expression, and is kept.)
    .replace(/[ \t\n\r\f\v]+/g, ' ')
    // A comma after words the markup sets apart ("just left", then a comma) is written as it is read.
    .replace(/ ,/g, ',')
    .trim();
const attr = (tag: string, name: string) => tag.match(new RegExp(` ${name}="([^"]*)"`))?.[1];

const show = (lang: Lang, initial?: ShaftForm, initialView?: ShaftView) => renderToStaticMarkup(h(ShaftCalculator, { t: sharedWords(beamStrings[lang].ui), w: shaftUi[lang], initial, initialView }));

/*
 * The cards of numbers, read as a visitor reads them and found by their
 * title: the rows of a table cell by cell, a list of values pair by pair. A
 * number that is merely somewhere on the page proves nothing.
 *
 * A cell of a table carries its column's head a second time, for a phone,
 * out of sight and silent (`mp-shaft__head`): taken out before it is read.
 */
const HEAD = /<span class="mp-shaft__head" aria-hidden="true">(?:[^<]|<span class="mp-plot__unit">(?:[^<]|<sup>[34]<\/sup>)*<\/span>)*<\/span>/g;
const cardsOf = (html: string) => {
  const cards = html.split(/<div class="mp-app__card(?: mp-app__card--wide| mp-shaft__point)?">/).slice(1);
  const title = (c: string) => text(c.match(/<h3\b[^>]*>([\s\S]*?)<\/h3>/)?.[1] ?? '');
  return { titles: cards.map(title), of: (name: string) => cards.find((c) => title(c) === name) ?? '' };
};
const cells = (row: string) => [...row.matchAll(/<t[hd]\b[^>]*>([\s\S]*?)<\/t[hd]>/g)].map((c) => text(c[1].replace(HEAD, '')));
/** What a phone shows over each cell of a row: the head it carries. */
const under = (row: string) => [...row.matchAll(/<t[hd]\b[^>]*>([\s\S]*?)<\/t[hd]>/g)].map((c) => text(c[1].match(HEAD)?.[0] ?? ''));
const headOf = (card: string) => cells(card.match(/<thead\b[^>]*>([\s\S]*?)<\/thead>/)?.[1] ?? '');
const bodyOf = (card: string) => [...(card.match(/<tbody\b[^>]*>([\s\S]*?)<\/tbody>/)?.[1] ?? '').matchAll(/<tr\b[^>]*>([\s\S]*?)<\/tr>/g)].map((r) => r[1]);
const rowsOf = (card: string) => bodyOf(card).map(cells);
const pairsOf = (card: string) => [...card.matchAll(/<dt>([\s\S]*?)<\/dt><dd>([\s\S]*?)<\/dd>/g)].map((m) => [text(m[1]), text(m[2])]);
const notesOf = (part: string) => [...part.matchAll(/<p class="mp-app__note">([\s\S]*?)<\/p>/g)].map((m) => text(m[1]));
const groupsOf = (html: string) => [...html.matchAll(/<fieldset class="mp-app__group"><legend>([\s\S]*?)<\/legend>([\s\S]*?)(?=<fieldset class="mp-app__group">|<div class="mp-app__actions">)/g)].map((m) => ({ legend: text(m[1]), html: m[2] }));
const drawingsOf = (html: string) => [...html.matchAll(/<svg class="mp-plot__svg"[^>]*>/g)].map((m) => attr(m[0], 'aria-label') ?? '');
const issuesOf = (html: string) => text(html.match(/<div class="mp-app__issues" role="alert" aria-live="assertive">([\s\S]*?)<\/div>/)?.[1] ?? '');
const issueList = (html: string) => [...(html.match(/<div class="mp-app__issues"[^>]*>([\s\S]*?)<\/div>/)?.[1] ?? '').matchAll(/<li[^>]*>([\s\S]*?)<\/li>/g)].map((m) => text(m[1]));
/** The fields of a piece of the form: each one's label, the value it shows, its unit, and what it is marked with. */
const fieldsOf = (part: string) =>
  [...part.matchAll(/<label class="mp-num[^"]*"([^>]*)>([\s\S]*?)<\/label>/g)]
    .filter((m) => /<input\b/.test(m[2]))
    .map((m) => {
      const input = m[2].match(/<input\b[^>]*>/)?.[0] ?? '';
      return { label: text(m[2].match(/<span class="mp-num__label">([\s\S]*?)<\/span><span class="mp-num__box">/)?.[1] ?? ''), value: attr(input, 'value') ?? '', unit: text(m[2].match(/<span class="mp-num__unit">([\s\S]*?)<\/span>/)?.[1] ?? ''), invalid: attr(input, 'aria-invalid') === 'true', describedBy: attr(input, 'aria-describedby') };
    });
const selectsOf = (part: string) => [...part.matchAll(/<label class="mp-num mp-num--select[^"]*">([\s\S]*?)<\/label>/g)].map((m) => ({ label: text(m[1].match(/<span class="mp-num__label">([\s\S]*?)<\/span>/)?.[1] ?? ''), chosen: text(m[1].match(/<option[^>]* selected=""[^>]*>([\s\S]*?)<\/option>/)?.[1] ?? ''), options: [...m[1].matchAll(/<option[^>]*>([\s\S]*?)<\/option>/g)].map((o) => text(o[1])) }));
/** What each list of a piece of the form is HEARD as: its own name where it has one, else the word over it. */
const heardOf = (part: string) => [...part.matchAll(/<label class="mp-num mp-num--select[^"]*">([\s\S]*?)<\/label>/g)].map((m) => attr(m[1].match(/<select\b[^>]*>/)?.[0] ?? '', 'aria-label') ?? text(m[1].match(/<span class="mp-num__label">([\s\S]*?)<\/span>/)?.[1] ?? ''));
const itemsOf = (part: string) => [...part.matchAll(/<div class="mp-app__item" role="group" aria-label="([^"]*)"( data-invalid="true")?>/g)].map((m) => ({ name: m[1], invalid: Boolean(m[2]) }));
/** The line under a row that a field is tied to. */
const lineOf = (html: string, id: string | undefined) => text(html.match(new RegExp(`<p class="mp-app__row-error" id="${id}">([\\s\\S]*?)</p>`))?.[1] ?? '');
/** Which of the three views is chosen, as the switch says it. */
const viewOf = (html: string) => text(html.match(/<input type="radio" name="shaft-view" checked=""\/><span>([\s\S]*?)<\/span>/)?.[1] ?? '');
const titleOf = (html: string) => text(html.match(/<p class="mp-plot__title mp-plot__title--first">([\s\S]*?)<\/p>/)?.[1] ?? '');
/** The titles of the three diagrams, each with its unit, as they stand over them. */
const captionsOf = (html: string) => [...html.matchAll(/<figcaption class="mp-plot__title">([\s\S]*?)<\/figcaption>/g)].map((m) => text(m[1]));

/** The example with something else in it. */
const shaft = (over: Partial<ShaftForm>): ShaftForm => ({ ...defaultShaft(), ...over });
const segment = (id: number, L: number, d: number, bore = 0): SegmentRow => ({ id, L, d, bore });
const force = (id: number, x: number, v: number, h = 0, vDir: 'down' | 'up' = 'down', hDir: 'towards' | 'away' = 'towards'): ForceRow => ({ id, x, v, vDir, h, hDir });
const couple = (id: number, x: number, v: number, h = 0, vDir: 'ccw' | 'cw' = 'ccw', hDir: 'ccw' | 'cw' = 'ccw'): CoupleRow => ({ id, x, v, vDir, h, hDir });

/** Every string of a nested object, with the path to it. */
function leaves(value: unknown, path = ''): [string, string][] {
  if (typeof value === 'string') return [[path, value]];
  if (value && typeof value === 'object') return Object.entries(value).flatMap(([k, v]) => leaves(v, path ? `${path}.${k}` : k));
  return [];
}
const words = (t: string) => t.toLowerCase().replace(/[^\p{L}\p{N}\s]/gu, ' ').split(/\s+/).filter(Boolean);
/** The runs of six words two texts share. */
const sharedRuns = (a: string, b: string) => {
  const there = ` ${words(b).join(' ')} `;
  const mine = words(a);
  return mine.map((_, i) => mine.slice(i, i + 6)).filter((run) => run.length === 6 && there.includes(` ${run.join(' ')} `)).map((run) => run.join(' '));
};

/*
 * THE SHAFT, BY ANOTHER METHOD. The page solves each plane with the first
 * calculator's engine and integrates M/EI in closed form, piece by piece.
 * None of that is used here. Each plane from first principles: the two
 * reactions from the two equations of equilibrium; shear and moment at a
 * section as the sum of what acts to its left; slope and deflection by
 * NUMERICAL integration of M/EI — Simpson's rule, nested, piece by piece
 * (exact for the parabola a curvature is and for the cubic a slope is, so
 * nothing is lost to the method) — and the two constants from the deflection
 * being zero at the two bearings. Largest values by sampling.
 *
 * It takes the form as the page shows it and answers in the units printed:
 * in, lbf, lbf·in, ksi — or mm, N, N·m, MPa. Signs as the page's: a reaction
 * and a deflection positive upward (away from the viewer), moment positive
 * sagging, slope positive counter-clockwise.
 */
type Planes = { vertical: number; horizontal: number; both: number };
type Side = 'left' | 'right';
function hand(form: ShaftForm) {
  const us = form.units === 'us';
  const E = us ? form.E * 1000 : form.E;
  const unitWeight = us ? form.density : form.density * 9.80665e-9;
  const k = us ? 1 : 1000; // a couple: lbf·in as typed; N·m is N·mm × 1,000
  let end = 0;
  const segs = form.segments.map((s) => {
    const I = (Math.PI * (s.d ** 4 - s.bore ** 4)) / 64;
    const seg = { from: end, to: end + s.L, d: s.d, bore: s.bore, I, Z: I / (s.d / 2), EI: E * I, w: form.ownWeight ? (unitWeight * Math.PI * (s.d * s.d - s.bore * s.bore)) / 4 : 0 };
    end += s.L;
    return seg;
  });
  const L = end;
  const [a, b] = [...form.bearings].sort((p, q) => p - q);
  const segAt = (x: number, side: Side) => segs.find((s) => (side === 'right' ? x >= s.from && x < s.to : x > s.from && x <= s.to)) ?? segs[side === 'right' ? segs.length - 1 : 0];
  const plane = (forces: { x: number; P: number }[], couples: { x: number; C: number }[], weighed: boolean) => {
    const dist = weighed ? segs.filter((s) => s.w !== 0) : [];
    const total = forces.reduce((sum, f) => sum + f.P, 0) + dist.reduce((sum, s) => sum + s.w * (s.to - s.from), 0);
    // About the left bearing, counter-clockwise positive: a downward load to its right turns the other way.
    const about = forces.reduce((sum, f) => sum + f.P * (f.x - a), 0) + dist.reduce((sum, s) => sum + s.w * (s.to - s.from) * ((s.from + s.to) / 2 - a), 0) - couples.reduce((sum, c) => sum + c.C, 0);
    const Rb = about / (b - a);
    const Ra = total - Rb;
    const acts = (at: number, x: number, side: Side) => (side === 'right' ? at <= x : at < x);
    const V = (x: number, side: Side) => {
      let v = (acts(a, x, side) ? Ra : 0) + (acts(b, x, side) ? Rb : 0);
      for (const f of forces) if (acts(f.x, x, side)) v -= f.P;
      for (const s of dist) v -= s.w * Math.max(0, Math.min(x, s.to) - s.from);
      return v;
    };
    const M = (x: number, side: Side) => {
      let m = (acts(a, x, side) ? Ra * (x - a) : 0) + (acts(b, x, side) ? Rb * (x - b) : 0);
      for (const f of forces) if (acts(f.x, x, side)) m -= f.P * (x - f.x);
      for (const c of couples) if (acts(c.x, x, side)) m -= c.C;
      for (const s of dist) {
        const len = Math.max(0, Math.min(x, s.to) - s.from);
        m -= s.w * len * (x - s.from - len / 2);
      }
      return m;
    };
    const cuts = [...new Set([0, L, a, b, ...segs.map((s) => s.to), ...forces.map((f) => f.x), ...couples.map((c) => c.x)])].sort((p, q) => p - q);
    // The curvature inside the piece [p, q]: both the moment and the stiffness read from inside it.
    const kappa = (p: number, q: number, x: number) => (x <= p ? M(p, 'right') / segAt(p, 'right').EI : x >= q ? M(q, 'left') / segAt(q, 'left').EI : M(x, 'right') / segAt(x, 'right').EI);
    const simpson = (f: (s: number) => number, lo: number, hi: number) => ((hi - lo) / 6) * (f(lo) + 4 * f((lo + hi) / 2) + f(hi));
    const slopeIn = (p: number, q: number, x: number) => simpson((s) => kappa(p, q, s), p, x);
    const deflIn = (p: number, q: number, x: number) => simpson((s) => slopeIn(p, q, s), p, x);
    const raw = (x: number) => {
      let [theta, v] = [0, 0];
      for (let i = 0; i + 1 < cuts.length; i++) {
        const [p, q] = [cuts[i], cuts[i + 1]];
        if (x <= p) break;
        const to = Math.min(x, q);
        v += theta * (to - p) + deflIn(p, q, to);
        theta += slopeIn(p, q, to);
      }
      return { theta, v };
    };
    const [ra, rb] = [raw(a), raw(b)];
    const theta0 = -(rb.v - ra.v) / (b - a);
    const v0 = -ra.v - theta0 * a;
    return { Ra, Rb, total, V, M, cuts, theta: (x: number) => raw(x).theta + theta0, v: (x: number) => raw(x).v + theta0 * x + v0 };
  };
  const pv = plane(form.forces.map((f) => ({ x: f.x, P: f.vDir === 'down' ? f.v : -f.v })), form.couples.map((c) => ({ x: c.x, C: (c.vDir === 'ccw' ? c.v : -c.v) * k })), true);
  const ph = plane(form.forces.map((f) => ({ x: f.x, P: f.hDir === 'towards' ? f.h : -f.h })), form.couples.map((c) => ({ x: c.x, C: (c.hDir === 'ccw' ? c.h : -c.h) * k })), false);
  const both = (vertical: number, horizontal: number): Planes => ({ vertical, horizontal, both: Math.hypot(vertical, horizontal) });
  const at = (x: number, side: Side = 'right') => {
    const seg = segAt(x, side);
    const moment = both(pv.M(x, side) / k, ph.M(x, side) / k);
    return { x, segment: segs.indexOf(seg), d: seg.d, bore: seg.bore, shear: both(pv.V(x, side), ph.V(x, side)), moment, slope: both(pv.theta(x), ph.theta(x)), deflection: both(pv.v(x), ph.v(x)), stress: ((moment.both * k) / seg.Z) * (us ? 1 / 1000 : 1) };
  };
  const cuts = [...new Set([...pv.cuts, ...ph.cuts])].sort((p, q) => p - q);
  const samples: ReturnType<typeof at>[] = [];
  for (let i = 0; i + 1 < cuts.length; i++) {
    const [p, q] = [cuts[i], cuts[i + 1]];
    samples.push(at(p, 'right'));
    for (let j = 1; j < 200; j++) samples.push(at(p + ((q - p) * j) / 200, 'right'));
    samples.push(at(q, 'left'));
  }
  type Sample = ReturnType<typeof at>;
  // The first of the largest: two places a rounding apart are one place.
  const peak = (of: (s: Sample) => number, among = samples) => {
    let best = among[0];
    for (const s of among) if (of(s) > of(best) + 1e-9 * Math.abs(of(best))) best = s;
    return { value: of(best), x: best.x };
  };
  return {
    L,
    at,
    bearings: [
      { x: a, reaction: both(pv.Ra, ph.Ra), slope: at(a).slope },
      { x: b, reaction: both(pv.Rb, ph.Rb), slope: at(b).slope },
    ],
    loads: { vertical: pv.total, horizontal: ph.total },
    ownWeight: segs.reduce((sum, s) => sum + s.w * (s.to - s.from), 0),
    segments: segs.map((seg, i) => {
      const moment = peak((s) => s.moment.both, samples.filter((s) => s.segment === i));
      return { ...seg, moment, stress: ((moment.value * k) / seg.Z) * (us ? 1 / 1000 : 1) };
    }),
    forces: form.forces.map((f) => at(f.x)),
    largest: { moment: peak((s) => s.moment.both), stress: peak((s) => s.stress), deflection: peak((s) => s.deflection.both), slope: peak((s) => s.slope.both) },
    peaks: (p: 'vertical' | 'horizontal') => ({
      V: [peak((s) => s.shear[p]), peak((s) => -s.shear[p])],
      M: [peak((s) => s.moment[p]), peak((s) => -s.moment[p])],
      D: [peak((s) => s.deflection[p]), peak((s) => -s.deflection[p])],
    }),
  };
}

/**
 * A number as the page of a language prints it: the site's own writing of
 * one, and round the × of a power of ten the spaces a line cannot end at
 * (the page sets them so: a number is never on two lines).
 */
const printer = (lang: Lang) => (v: number, figures = 4) => formatNumber(v, figures, beamStrings[lang].ui.numbers.group).replace(' × ', ' × ');
/** A size and the word for the way it points, as a cell of a plane prints it. */
const pointed = (lang: Lang, plane: 'vertical' | 'horizontal', v: number) => {
  const [plus, minus] = plane === 'vertical' ? [beamStrings[lang].ui.results.upward, beamStrings[lang].ui.results.downward] : [shaftUi[lang].results.away, shaftUi[lang].results.towards];
  const n = printer(lang)(Math.abs(v));
  return n === '0' ? '0' : `${n} ${v < 0 ? minus : plus}`;
};

describe('shaft calculator: the yardstick of this file, against the closed forms', () => {
  const [E, d, L, P] = [29e6, 2, 20, 1000];
  const I = (Math.PI * d ** 4) / 64;
  const one = (over: Partial<ShaftForm>) => shaft({ segments: [segment(1, L, d)], bearings: [0, L], forces: [], couples: [], ...over });

  it('a force midway between the bearings: PL³/48EI under it, PL²/16EI at each bearing, PL/4', () => {
    const s = hand(one({ forces: [force(2, L / 2, P)] }));
    expect(s.bearings[0].reaction.vertical).toBeCloseTo(P / 2, 9);
    expect(s.at(L / 2).deflection.vertical / ((-P * L ** 3) / (48 * E * I))).toBeCloseTo(1, 10);
    expect(s.bearings[0].slope.vertical / ((-P * L ** 2) / (16 * E * I))).toBeCloseTo(1, 10);
    expect(s.bearings[1].slope.vertical / ((P * L ** 2) / (16 * E * I))).toBeCloseTo(1, 10);
    expect(s.at(L / 2).moment.vertical).toBeCloseTo((P * L) / 4, 8);
  });

  it('a force on an overhang: Pa²(L + a)/3EI under it; the near bearing carries P(L + a)/L, the far one Pa/L the other way', () => {
    const a = 5;
    const s = hand(one({ segments: [segment(1, L + a, d)], forces: [force(2, L + a, P)] }));
    expect(s.bearings[1].reaction.vertical).toBeCloseTo((P * (L + a)) / L, 9);
    expect(s.bearings[0].reaction.vertical).toBeCloseTo((-P * a) / L, 9);
    expect(s.at(L + a, 'left').deflection.vertical / ((-P * a * a * (L + a)) / (3 * E * I))).toBeCloseTo(1, 10);
    expect(s.at(L, 'left').moment.vertical).toBeCloseTo(-P * a, 8);
  });

  it('the same force at 45° between the planes: the resultants are the one-plane values', () => {
    const s = hand(one({ forces: [force(2, L / 2, P / Math.SQRT2, P / Math.SQRT2)] }));
    expect(s.at(L / 2).deflection.both / ((P * L ** 3) / (48 * E * I))).toBeCloseTo(1, 10);
    expect(s.bearings[1].reaction.both).toBeCloseTo(P / 2, 9);
  });

  it('a stepped shaft, its middle half twice as stiff: PL³(1 + 7/n)/384EI and PL²(1 + 3/n)/64EI', () => {
    const s = hand(one({ segments: [segment(1, L / 4, d), segment(2, L / 2, d * 2 ** 0.25), segment(3, L / 4, d)], forces: [force(4, L / 2, P)] }));
    expect(s.at(L / 2).deflection.both / ((P * L ** 3 * (1 + 7 / 2)) / (384 * E * I))).toBeCloseTo(1, 10);
    expect(s.bearings[0].slope.both / ((P * L ** 2 * (1 + 3 / 2)) / (64 * E * I))).toBeCloseTo(1, 10);
  });

  it('a counter-clockwise moment midway: C/L up at the left, the moment drops by C across it, CL/24EI at the bearings', () => {
    const C = 6000;
    const s = hand(one({ couples: [couple(2, L / 2, C)] }));
    expect(s.bearings[0].reaction.vertical).toBeCloseTo(C / L, 9);
    expect(s.bearings[1].reaction.vertical).toBeCloseTo(-C / L, 9);
    expect([s.at(L / 2, 'left').moment.vertical, s.at(L / 2, 'right').moment.vertical].map((m) => Math.round(m * 1e6) / 1e6)).toEqual([C / 2, -C / 2]);
    expect(s.bearings[0].slope.vertical / ((-C * L) / (24 * E * I))).toBeCloseTo(1, 10);
    expect(Math.abs(s.at(L / 2).deflection.vertical)).toBeLessThan(1e-15);
  });

  it('its own weight: wL/2 at each bearing, 5wL⁴/384EI at the middle', () => {
    const w = 0.2836 * ((Math.PI * d * d) / 4);
    const s = hand(one({ ownWeight: true }));
    expect(s.ownWeight).toBeCloseTo(w * L, 10);
    expect(s.bearings[0].reaction.vertical).toBeCloseTo((w * L) / 2, 9);
    expect(s.at(L / 2).deflection.vertical / ((-5 * w * L ** 4) / (384 * E * I))).toBeCloseTo(1, 10);
  });
});

describe('shaft calculator: its words', () => {
  const en = leaves(shaftUi.en);
  const es = leaves(shaftUi.es);

  it('says the same things in both languages, and leaves nothing blank', () => {
    expect(es.map(([p]) => p)).toEqual(en.map(([p]) => p));
    for (const [path, s] of [...en, ...es]) expect(s.trim().length, path).toBeGreaterThan(0);
    expect(en.length).toBeGreaterThan(60);
  });

  it('the Spanish is Spanish: no sentence is the English one left in place', () => {
    // Three are one word in both languages: SI is SI, and vertical and horizontal are spelled alike.
    expect(en.filter(([, s], i) => s === es[i][1]).map(([path]) => path)).toEqual(['toolbar.si', 'forces.vertical', 'forces.horizontal']);
    // No number written into a Spanish sentence has a grouping comma: that reader takes it for the decimal mark.
    for (const [path, s] of es) expect(s, path).not.toMatch(/\d,\d{3}(?!\d)/);
    // "Usted", never "tú": "mueva", "quítelo", "hágalo".
    for (const [path, s] of es) expect(s, path).not.toMatch(/\b(mueve|quítalo|hazlo|introduces|escribes|eliges|incluyes|puedes|tienes|tu|tus)\b/i);
    expect(shaftUi.es.issues.bearings).toMatch(/Mueva uno de ellos\.$/);
    expect(shaftUi.es.issues['short-segment']).toMatch(/Quítelo o hágalo más largo\.$/);
  });

  // The page gives reactions, moments, slopes, deflections and a nominal stress. Whether any of them will do is
  // the engineer's to say: no word of the tool says it for them, none names a code, and no limit is a rule.
  it('gives numbers and no verdict, names no code, and quotes no limit', () => {
    for (const [path, s] of [...en, ...es]) {
      expect(s, path).not.toMatch(/\b(ok|okay|pass|passes|passed|fail|fails|failed|adequate|inadequate|sufficient|insufficient|enough|acceptable|allowable|permissible|complies|satisf\w*|safe|unsafe|should not exceed|must not exceed|limit)\b/i);
      expect(s, path).not.toMatch(/\b(cumple|cumplen|no cumple|falla|fallan|aprobad\w*|suficiente|insuficiente|adecuad\w*|inadecuad\w*|aceptable|admisible|basta|segur[oa]|satisf\w*|verifica|límite|no debe exceder)\b/i);
      expect(s, path).not.toMatch(/[✓✔✗✘]/);
      expect(s, path).not.toMatch(/\b(ACI|AISC|ASCE|ASME|AGMA|ANSI|ABMA|ISO|DIN|IBC|Eurocode|Eurocódigo|LRFD|ASD)\b/);
    }
    // The figures of the tool's words are those of one line — a stiffness a million times another is "about 32 diameters to 1" — and they are counted: a
    // limit that came with a number would be a figure more, whatever its unit. One said wholly in words no pattern can catch.
    for (const set of [en, es]) expect(set.map(([, s]) => s).join(' ').match(/\d+(\.\d+)?/g)).toEqual(['32', '1']);
  });

  it('names no other company’s product, no price, no date', () => {
    for (const [path, s] of [...en, ...es]) {
      expect(s, path).not.toMatch(/skyciv|quick design|clearcalcs|calcbook|enercalc|tedds|mitcalc|skf|timken|shigley/i);
      expect(s, path).not.toMatch(/\bfree\b|\bgratis\b|\bgratuit|\$|\bprice\b|\bprecio\b|\b20\d\d\b/i);
      expect(s, path).not.toMatch(/Civil\s*&\s*Structural/i);
    }
  });

  it('each line has the places its values go in', () => {
    const PLACES: Record<string, string[]> = {
      'sheet.link': ['{url}'],
      'shaft.total': ['{length}'],
      'material.weight': ['{weight}'],
      'results.balance': ['{vertical}', '{horizontal}'],
      'issues.stiffness': ['{max}'],
    };
    for (const lang of LANGS) for (const [path, s] of leaves(shaftUi[lang])) expect(s.match(/\{\w+\}/g) ?? [], `${lang} ${path}`).toEqual(PLACES[path] ?? []);
  });

  // Each text of the site has one home. These lines are this tool's: not the other calculators' said again (what
  // is theirs and fits comes from `t`), nor this page's own text around the tool, nor the catalogue's line.
  it('says nothing the other calculators, this page’s text or the catalogue already say, six words running', () => {
    const rows = calculatorFamilies.flatMap((f) => f.items).filter((x) => x.href);
    expect(rows.length).toBeGreaterThanOrEqual(3);
    for (const lang of LANGS) {
      const theirs = [beamStrings[lang], spanUi[lang], spanPage[lang], continuousUi[lang], continuousPage[lang], shaftPage[lang]].flatMap((set) => leaves(set).map(([, s]) => s)).concat(rows.map((r) => r.does[lang])).join(' . ');
      for (const [path, s] of leaves(shaftUi[lang])) expect(sharedRuns(s, theirs), `${lang} ${path}`).toEqual([]);
    }
  });

  // A shaft's page says "shaft". What it borrows of the first calculator's words is the list `sharedWords`
  // picks, and no line of that list is about a beam; what the tool then prints is not either.
  it('a shaft’s page says “shaft”: neither the borrowed words nor its own, nor anything it prints, says “beam”', () => {
    const beam = { en: /\bbeams?\b/i, es: /\bvigas?\b/i };
    for (const lang of LANGS) {
      const borrowed = leaves(sharedWords(beamStrings[lang].ui));
      expect(borrowed.length).toBeGreaterThan(50);
      for (const [path, s] of [...borrowed, ...leaves(shaftUi[lang])]) expect(s, `${lang} ${path}`).not.toMatch(beam[lang]);
      for (const html of [show(lang), show(lang, shaft({ ownWeight: true, couples: [couple(7, 9, 500, 200)], nextId: 8 }), 'vertical'), show(lang, shaft({ segments: [segment(1, 0, 1)] }))]) expect(text(html)).not.toMatch(beam[lang]);
    }
    // The list is a part of the first calculator's set, never the whole of it: its sentences about a beam stay behind.
    const all = leaves(beamStrings.en.ui).length;
    expect(leaves(sharedWords(beamStrings.en.ui)).length).toBeLessThan(all / 2);
    for (const gone of ['linkError', 'linkOpening', 'issuesTitle', 'supports', 'hinges', 'layouts']) expect(Object.keys(sharedWords(beamStrings.en.ui))).not.toContain(gone);
  });

  it('what it says of the engine’s limits is what the engine’s limits are', () => {
    expect([SHORT, STIFF, CLOSE, MAX_SEGMENTS, MAX_ROWS]).toEqual([1e-6, 1e6, 1e-3, 8, 12]);
    expect(shaftUi.en.issues['short-segment']).toMatch(/shorter than a millionth of the shaft/);
    expect(shaftUi.es.issues['short-segment']).toMatch(/más corto que una millonésima del eje/);
    expect(shaftUi.en.issues.bearings).toMatch(/less than one thousandth of the shaft’s length apart/);
    expect(shaftUi.es.issues.bearings).toMatch(/menos de la milésima parte de la longitud del eje/);
    // A stiffness goes as the fourth power of a solid diameter: a million times is 31.6 diameters to 1.
    expect(Math.round(STIFF ** 0.25)).toBe(32);
    expect(shaftUi.en.issues.stiffness).toMatch(/over \{max\} times as stiff .* about 32 diameters to 1/);
    expect(shaftUi.es.issues.stiffness).toMatch(/más de \{max\} veces más rígido .* unos 32 diámetros a 1/);
    expect(shaftUi.en.shaft.limit).toMatch(/^Eight /);
    expect(shaftUi.es.shaft.limit).toMatch(/^Ocho /);
    // The line under a full list of loads is the first calculator's, and its number is this form's too.
    expect(BEAM_ROWS).toBe(MAX_ROWS);
    expect(beamStrings.en.ui.row.limit).toMatch(/^Twelve /);
    expect(beamStrings.es.ui.row.limit).toMatch(/^Doce /);
  });

  it('the line for a case still to be opened is true for as long as it shows, and names no example as the shaft', () => {
    expect(shaftUi.en.linkOpening).toMatch(/^A shaft came with this link\. The page opens it when its script has loaded; meanwhile the tool is kept out of sight/);
    expect(shaftUi.es.linkOpening).toMatch(/^Este enlace trae un eje\. La página lo abre cuando su script termina de cargar; mientras tanto la herramienta no se muestra/);
    expect(shaftUi.en.linkError).toMatch(/could not be read: what is shown is the example/);
    expect(shaftUi.es.linkError).toMatch(/no se ha podido leer: lo que se muestra es el ejemplo/);
  });

  // A SENTENCE TURNED ROUND IS STILL A SENTENCE. What the tool DOES is held below, card by card and view by view — and almost always
  // through these words by their KEY, so that a line changed into its opposite ("from above" into "from below", "smaller" into
  // "larger", "upward" into "downward") is compared with itself and passes. Each clause here says a direction, a sign, a plane, an
  // end, a unit or what must be: read by the very words that carry it, in BOTH languages, at its own key (the path is `leaves`' own).
  // A clause that is reworded is reworded here too, on purpose.
  const HELD: [at: string, en: string, es: string][] = [
    ['toolbar.us', 'US (in, lbf)', 'EE. UU. (in, lbf)'],
    ['toolbar.si', 'SI (mm, N)', 'SI (mm, N)'],
    ['shaft.note', 'Segments follow one another from the left end.', 'Los tramos van uno tras otro desde el extremo izquierdo.'],
    ['shaft.note', 'Every position below is a distance from that left end, and stays as typed when a segment changes.', 'Toda posición de más abajo es una distancia a ese extremo izquierdo, y queda como se escribió cuando un tramo cambia.'],
    ['bearings.note', 'so the shaft can tilt in it', 'de modo que el eje puede inclinarse en él'],
    ['forces.note', 'The viewer stands beside the shaft, with its left end on the left.', 'con el extremo izquierdo de este a su izquierda; «hacia el fondo» es alejándose de él.'],
    ['couples.note', 'an axial force on a gear, acting at its radius, makes one', 'lo produce la fuerza axial de un engranaje, que actúa en su radio'],
    ['couples.note', 'the vertical plane from the side, the horizontal plane from above', 'el vertical, visto de lado; el horizontal, desde arriba'],
    ['material.weight', 'a load spread along it, in the vertical plane', 'una carga repartida a lo largo de él, en el plano vertical'],
    ['material.note', 'reactions, shears and moments do not depend on it', 'las reacciones, los cortantes y los momentos no dependen de él'],
    ['results.seen.vertical', 'seen from the side', 'visto de lado'],
    ['results.seen.horizontal', 'seen from above: down the page is towards the viewer', 'visto desde arriba: hacia abajo en el dibujo es hacia el observador'],
    ['results.seen.both', 'as one size each, with no direction', 'como una sola magnitud cada una, sin dirección'],
    ['results.signs.vertical', 'Vertical plane: a positive shear pushes the part left of the cut upward, a positive moment sags the shaft, and a positive deflection is upward.', 'Plano vertical: un cortante positivo empuja hacia arriba la parte a la izquierda del corte, un momento positivo comba el eje hacia abajo y una deflexión positiva es hacia arriba.'],
    ['results.signs.both', 'the size of the two planes’ values at that point, √(vertical² + horizontal²)', 'la magnitud de los valores de los dos planos en ese punto, √(vertical² + horizontal²)'],
    ['results.towards', 'towards viewer', 'hacia el observador'],
    ['results.away', 'away from viewer', 'hacia el fondo'],
    ['results.nominal', 'a segment’s largest moment over that segment’s own section modulus', 'el mayor momento de un tramo entre el módulo de sección, Z, de ese mismo tramo'],
    ['results.sizes', 'Each is the size of the two planes together.', 'Cada uno es la magnitud de los dos planos juntos.'],
    ['issues.length', 'must be a positive number', 'debe ser un número positivo'],
    ['issues.diameter', 'must be a positive number', 'debe ser un número positivo'],
    ['issues.bore', 'The bore must be smaller than the diameter, and not negative.', 'El diámetro interior debe ser menor que el diámetro, y no negativo.'],
    ['issues.modulus', 'must be a positive number', 'debe ser un número positivo'],
    ['issues.density', 'the density must be a positive number', 'la densidad debe ser un número positivo'],
  ];

  it('each clause that says a direction, a sign, a plane, an end, a unit or what must be is in the tool’s words as it is written here, in both languages', () => {
    const missing = LANGS.flatMap((lang) => {
      const said = Object.fromEntries(leaves(shaftUi[lang]));
      return HELD.filter(([at, en, es]) => !(said[at] ?? '').includes(lang === 'en' ? en : es)).map(([at, en, es]) => `${lang} ${at}: ${lang === 'en' ? en : es}`);
    });
    expect(missing).toEqual([]);
    expect(new Set(HELD.map(([at, en]) => `${at}|${en}`)).size).toBe(HELD.length);
  });

  // The words reach the tool as a prop from the server view. Imported by the component — or by anything it
  // imports — both languages would be in the script every visitor downloads.
  it('are a prop: the component imports neither set of words, only their types', () => {
    const source = readFileSync(join(SRC, 'components', 'ttc', 'calc', 'shaft', 'ShaftCalculator.tsx'), 'utf8');
    expect(source.startsWith("'use client';")).toBe(true);
    const imports = [...source.matchAll(/^import (type )?[\s\S]*? from '([^']+)';/gm)].map((m) => ({ typeOnly: Boolean(m[1]), from: m[2] }));
    expect(imports.length).toBeGreaterThan(10);
    expect(imports.filter((x) => /strings$/.test(x.from))).toEqual([{ typeOnly: true, from: '@/lib/calc/shaft/strings' }]);
    // …and nothing of the site's own copy, which every public page's script would then share with it.
    expect(imports.filter((x) => /lib\/ttc\//.test(x.from))).toEqual([]);
    // Nor do the pieces under it: the drawing and the arithmetic carry no words.
    for (const file of ['components/ttc/calc/shaft/ShaftSchematic.tsx', 'lib/calc/shaft/analysis.ts', 'lib/calc/shaft/model.ts', 'lib/calc/shaft/engine.ts']) {
      expect(readFileSync(join(SRC, file), 'utf8'), file).not.toMatch(/^import (?!type )[^;]*strings';/m);
    }
  });
});

describe('shaft calculator: the form', () => {
  for (const lang of LANGS) {
    const t = beamStrings[lang].ui;
    const w = shaftUi[lang];
    const html = show(lang);
    const groups = groupsOf(html);
    const group = (legend: string) => groups.find((g) => g.legend === legend)?.html ?? '';

    it(`${lang}: five groups — the shaft, its bearings, the forces, the applied moments, the material`, () => {
      expect(groups.map((g) => g.legend)).toEqual([w.shaft.title, w.bearings.title, w.forces.title, t.loads.couple, w.material.title]);
      // The units are this page's own, and the example is in inches and pounds.
      expect([...html.matchAll(/<input type="radio" name="shaft-units"( checked="")?\/><span>([\s\S]*?)<\/span>/g)].map((m) => [text(m[2]), Boolean(m[1])])).toEqual([[w.toolbar.us, true], [w.toolbar.si, false]]);
      // No button to calculate: the answer follows the form.
      expect([...html.matchAll(/<button\b[^>]*class="mp-app__btn[^"]*"[^>]*>([\s\S]*?)<\/button>/g)].map((m) => text(m[1]))).toEqual([w.toolbar.copy, t.toolbar.print, t.toolbar.reset]);
      expect(html).not.toMatch(/type="submit"/);
    });

    it(`${lang}: a segment is its length, its diameter and a bore that may be left empty — four of them, each with its number`, () => {
      const part = group(w.shaft.title);
      expect(fieldsOf(part).map((f) => [f.label, f.value, f.unit])).toEqual(
        [[4, 1.5], [10, 2], [4, 1.5], [5, 1.25]].flatMap(([L, d]) => [[t.beam.length, String(L), 'in'], [w.shaft.diameter, String(d), 'in'], [w.shaft.bore, '', 'in']]),
      );
      const rows = itemsOf(part).map((i) => i.name);
      expect(rows).toEqual([1, 2, 3, 4].map((n) => `${w.shaft.segment} ${n}`));
      // The number is on screen too, not only in the group's name.
      expect([...part.matchAll(/<p class="mp-shaft__name" aria-hidden="true">([\s\S]*?)<\/p>/g)].map((m) => text(m[1]))).toEqual(rows);
      expect([...part.matchAll(/<button\b[^>]*class="mp-app__remove"[^>]*>/g)].map((m) => [attr(m[0], 'aria-label'), / disabled=""/.test(m[0])])).toEqual(rows.map((r) => [`${t.row.remove}: ${r}`, false]));
      // The segments end to end, said under them — and what an empty bore is.
      expect(text(part)).toContain(w.shaft.total.replace('{length}', '23 in'));
      // …to the eight figures a field holds, not the six of a place: 10 1/64 + 13 5/32 in is 23.171875 in, and "23.1719" typed back as a bearing's place was past the end of that shaft.
      const long = groupsOf(show(lang, shaft({ segments: [segment(1, 10.015625, 1.5), segment(2, 13.15625, 2)] })))[0].html;
      expect(text(long)).toContain(w.shaft.total.replace('{length}', '23.171875 in'));
      expect(text(long)).not.toContain('23.1719 in');
      // In millimetres, with the page's own mark between thousands: 1,397 mm, and 588.56562 mm.
      const metric = (lengths: number[]) => text(groupsOf(show(lang, shaft({ units: 'si', segments: lengths.map((L, i) => segment(i + 1, L, 40)), bearings: [0, 100], forces: [], E: 200000, density: 7850 })))[0].html);
      expect(metric([347, 198, 156, 157, 358, 181])).toContain(w.shaft.total.replace('{length}', `${lang === 'en' ? '1,397' : '1\u202f397'} mm`));
      expect(metric([254.39687, 334.16875])).toContain(w.shaft.total.replace('{length}', '588.56562 mm'));
      expect(notesOf(part)).toEqual([w.shaft.note]);
      expect(w.shaft.note).toMatch(lang === 'en' ? /A bore left empty is a solid segment\./ : /Si el diámetro interior se deja vacío, el tramo es macizo\./);
      expect(text(part)).toContain(w.shaft.add);
      // A solid segment's bore is named for the printed sheet, which leaves an empty field out; a hollow one's is not.
      expect(part.match(/<label class="mp-num mp-shaft__solid">/g)).toHaveLength(4);
      const hollow = groupsOf(show(lang, shaft({ segments: [segment(1, 12, 2, 1.25), segment(2, 11, 1.5)] })))[0].html;
      expect(fieldsOf(hollow).map((f) => f.value)).toEqual(['12', '2', '1.25', '11', '1.5', '']);
      expect(hollow.match(/<label class="mp-num mp-shaft__solid">/g)).toHaveLength(1);
    });

    it(`${lang}: a shaft has a segment — the last one cannot be removed, and the ninth cannot be added`, () => {
      const one = groupsOf(show(lang, shaft({ segments: [segment(1, 23, 2)] })))[0].html;
      expect([...one.matchAll(/<button\b[^>]*class="mp-app__remove"[^>]*>/g)].map((m) => / disabled=""/.test(m[0]))).toEqual([true]);
      expect(one).not.toContain('mp-shaft__limit');
      const eight = groupsOf(show(lang, shaft({ segments: Array.from({ length: 8 }, (_, i) => segment(i + 1, 23 / 8, 2)), nextId: 20 })))[0].html;
      const add = eight.match(/<button type="button" class="mp-app__add"[^>]*>/)?.[0] ?? '';
      expect(attr(add, 'aria-disabled')).toBe('true');
      expect(add).not.toContain(' disabled=""');
      expect(text(eight.match(new RegExp(`<p class="mp-shaft__limit" id="${attr(add, 'aria-describedby')}" role="status">([\\s\\S]*?)</p>`))?.[1] ?? '')).toBe(w.shaft.limit);
      // Twelve forces, twelve moments: the first calculator's line, which says twelve.
      const full = show(lang, shaft({ forces: Array.from({ length: 12 }, (_, i) => force(10 + i, 1 + i, 10)), couples: Array.from({ length: 12 }, (_, i) => couple(30 + i, 1 + i, 10)), nextId: 50 }));
      expect([...full.matchAll(/<p class="mp-shaft__limit"[^>]*>([\s\S]*?)<\/p>/g)].map((m) => text(m[1]))).toEqual([t.row.limit, t.row.limit]);
    });

    it(`${lang}: two bearings, each by its distance from the left end`, () => {
      const part = group(w.bearings.title);
      expect(fieldsOf(part).map((f) => [f.label, f.value, f.unit])).toEqual([[`${w.bearings.name} 1`, '2', 'in'], [`${w.bearings.name} 2`, '16', 'in']]);
      expect(notesOf(part)).toEqual([w.bearings.note]);
      expect(w.bearings.note).toMatch(lang === 'en' ? /a radial load and no moment/ : /carga radial y ningún momento/);
    });

    it(`${lang}: a force is its place and, in each plane, a size and the way it points`, () => {
      const part = group(w.forces.title);
      expect(itemsOf(part).map((i) => i.name)).toEqual([`${w.forces.name} 1`, `${w.forces.name} 2`]);
      expect(fieldsOf(part).map((f) => [f.label, f.value, f.unit])).toEqual([
        [t.results.position, '9', 'in'], [w.forces.vertical, '1000', 'lbf'], [w.forces.horizontal, '360', 'lbf'],
        [t.results.position, '21', 'in'], [w.forces.vertical, '400', 'lbf'], [w.forces.horizontal, '0', 'lbf'],
      ]);
      const up = [t.loads.down, t.loads.up];
      const side = [w.forces.towards, w.forces.away];
      expect(selectsOf(part)).toEqual([
        { label: t.loads.direction, chosen: up[0], options: up }, { label: t.loads.direction, chosen: side[0], options: side },
        { label: t.loads.direction, chosen: up[0], options: up }, { label: t.loads.direction, chosen: side[0], options: side },
      ]);
      // Each of the two is HEARD by a name of its own — the word on screen, then the plane it is of: two lists both
      // called "Direction" in one row cannot be told apart by whoever hears the form, and which is which is the sign of the load.
      const heard = [`${t.loads.direction}, ${w.forces.vertical.toLowerCase()}`, `${t.loads.direction}, ${w.forces.horizontal.toLowerCase()}`];
      expect(heardOf(part)).toEqual([...heard, ...heard]);
      expect(heard).toEqual(lang === 'en' ? ['Direction, vertical', 'Direction, horizontal'] : ['Sentido, vertical', 'Sentido, horizontal']);
      // To the eye it is the shell's own list, mark for mark: the name is all this page adds to it.
      const first = part.match(/<label class="mp-num mp-num--select[^"]*">[\s\S]*?<\/label>/)?.[0] ?? '';
      expect(first).toContain(` aria-label="${heard[0]}"`);
      expect(first.replace(/ aria-label="[^"]*"/, '')).toBe(renderToStaticMarkup(select(t.loads.direction, 'down', [['down', t.loads.down], ['up', t.loads.up]], () => {}, 'mp-num--dir')));
      expect(notesOf(part)).toEqual([w.forces.note]);
      // Where the viewer stands is said: "towards" and "away" mean nothing without it. And it is said OVER the rows,
      // straight under the group's title: the first row offers "Towards viewer", and under twelve forces the line
      // stood three windows further down.
      expect(part.startsWith('<p class="mp-app__note">')).toBe(true);
      expect(part.indexOf('<p class="mp-app__note">')).toBeLessThan(part.indexOf('<div class="mp-app__item"'));
      expect(w.forces.note).toMatch(lang === 'en' ? /The viewer stands beside the shaft, with its left end on the left\./ : /El observador está junto al eje, con el extremo izquierdo de este a su izquierda/);
      const other = groupsOf(show(lang, shaft({ forces: [force(5, 3.5, 250, 75, 'up', 'away')], nextId: 6 })))[2].html;
      expect(selectsOf(other).map((s) => s.chosen)).toEqual([up[1], side[1]]);
      expect(fieldsOf(other).map((f) => f.value)).toEqual(['3.5', '250', '75']);
    });

    it(`${lang}: an applied moment likewise — none in the example, and each sense as its plane is drawn`, () => {
      const part = group(t.loads.couple);
      // The note first, over the rows (how a sense is read, before a row asks for one), then the line that says there is none.
      expect(part.startsWith('<p class="mp-app__note">')).toBe(true);
      expect(text(part).startsWith(`${text(w.couples.note)} ${t.loads.noneCouple} `)).toBe(true);
      expect(text(part)).toContain(t.loads.addCouple);
      expect(notesOf(part)).toEqual([w.couples.note]);
      // Torque is not a load of this page, and the form says so where a "moment" is entered.
      expect(w.couples.note).toMatch(lang === 'en' ? /Torque about the shaft’s axis is not entered\.$/ : /El par de torsión en torno al eje no se introduce\.$/);
      const some = groupsOf(show(lang, shaft({ couples: [couple(7, 9, 1500, 600, 'cw', 'ccw')], nextId: 8 })))[3].html;
      expect(itemsOf(some).map((i) => i.name)).toEqual([`${t.row.names.couples} 1`]);
      expect(some.indexOf('<p class="mp-app__note">')).toBeLessThan(some.indexOf('<div class="mp-app__item"'));
      expect(fieldsOf(some).map((f) => [f.label, f.value, f.unit])).toEqual([[t.results.position, '9', 'in'], [w.planes.vertical, '1500', 'lbf·in'], [w.planes.horizontal, '600', 'lbf·in']]);
      const turn = [t.loads.ccw, t.loads.cw];
      expect(selectsOf(some)).toEqual([{ label: t.loads.direction, chosen: turn[1], options: turn }, { label: t.loads.direction, chosen: turn[0], options: turn }]);
      // The same word over both and the same two choices in both: only its name says which plane a list is of.
      expect(heardOf(some)).toEqual([`${t.loads.direction}, ${w.planes.vertical.toLowerCase()}`, `${t.loads.direction}, ${w.planes.horizontal.toLowerCase()}`]);
      expect(heardOf(some)).toEqual(lang === 'en' ? ['Direction, vertical plane', 'Direction, horizontal plane'] : ['Sentido, plano vertical', 'Sentido, plano horizontal']);
    });

    it(`${lang}: in a row of the form no two controls are heard by one name`, () => {
      const html = show(lang, shaft({ couples: [couple(7, 9, 1500, 600, 'cw', 'ccw')], nextId: 8 }));
      const rows = html.split('<div class="mp-app__item" role="group"').slice(1).map((row) => row.slice(0, row.indexOf('class="mp-app__remove"')));
      expect(rows).toHaveLength(7);
      for (const row of rows) {
        const names = [...fieldsOf(row).map((f) => `${f.label} ${f.unit}`), ...heardOf(row)];
        expect(names.length, names.join(' | ')).toBeGreaterThanOrEqual(3);
        expect(new Set(names).size, names.join(' | ')).toBe(names.length);
      }
    });

    it(`${lang}: the material, its modulus, and the shaft’s own weight with the density it takes`, () => {
      const part = group(w.material.title);
      expect(selectsOf(part)).toEqual([{ label: t.section.material, chosen: t.section.materials.steel, options: [t.section.materials.steel, w.material.stainless, t.section.materials.aluminum, t.section.materials.custom] }]);
      expect(heardOf(part)).toEqual([t.section.material]);
      expect(fieldsOf(part).map((f) => [f.label, f.value, f.unit])).toEqual([[t.section.E, '29000', 'ksi']]);
      expect(notesOf(part)).toEqual([w.material.note]);
      expect(part).toMatch(new RegExp(`<label class="mp-app__check"><input type="checkbox"/><span>${w.material.ownWeight.replace('’', '’')}</span></label>`));
      // Asked for: the density, and the whole weight under it.
      const weighed = groupsOf(show(lang, shaft({ ownWeight: true })))[4].html;
      expect(weighed).toContain('<input type="checkbox" checked=""/>');
      expect(fieldsOf(weighed).map((f) => [f.label, f.value, f.unit])).toEqual([[t.section.E, '29000', 'ksi'], [w.material.density, '0.2836', 'lb/in³']]);
      expect(text(weighed)).toContain(w.material.weight.replace('{weight}', '14.66 lbf'));
    });
  }
});

describe('shaft calculator: the example, cell by cell', () => {
  /*
   * The example by hand, where a hand suffices — statics. Bearings at 2 and
   * 16 in (14 apart); a gear at 9 in pushing 1,000 lbf down and 360 lbf
   * towards the viewer; a pulley at 21 in pulled 400 lbf down.
   *   vertical     RB·14 = 1,000·7 + 400·19 = 14,600 → RB = 1,042.86, RA = 1,400 − RB = 357.14 lbf
   *   horizontal   RB·14 = 360·7 → RB = 180, RA = 180 lbf
   *   radial       √(357.14² + 180²) = 399.9;  √(1,042.86² + 180²) = 1,058 lbf
   *   moments      at 9: 357.14·7 = 2,500 and 180·7 = 1,260 → 2,800 lbf·in;  at 16: −2,000 and 0;  at 18: −1,200
   *                at 4: 357.14·2 = 714.3 and 360 → 799.9
   *   Z = πd³/32   1.5 in: 0.3313;  2 in: 0.7854;  1.25 in: 0.1917 in³
   *   stress       799.9/0.3313 = 2.414;  2,800/0.7854 = 3.565;  2,000/0.3313 = 6.036;  1,200/0.1917 = 6.258 ksi
   * The slopes and deflections are the yardstick's (`hand`).
   */
  const BY_HAND = {
    bearings: [['357.1', '180', '399.9'], ['1,043', '180', '1,058']],
    moments: ['799.9', '2,800', '2,000', '1,200'],
    stresses: ['2.414', '3.565', '6.036', '6.258'],
    I: ['0.2485', '0.7854', '0.2485', '0.1198'],
    Z: ['0.3313', '0.7854', '0.3313', '0.1917'],
  };

  it('the statics written above are the yardstick’s', () => {
    const s = hand(defaultShaft());
    const n = printer('en');
    expect(s.bearings.map((b) => [n(b.reaction.vertical), n(b.reaction.horizontal), n(b.reaction.both)])).toEqual(BY_HAND.bearings);
    expect(s.segments.map((x) => n(x.moment.value))).toEqual(BY_HAND.moments);
    expect(s.segments.map((x) => n(x.stress))).toEqual(BY_HAND.stresses);
    expect(s.segments.map((x) => [n(x.I), n(x.Z)])).toEqual(BY_HAND.I.map((I, i) => [I, BY_HAND.Z[i]]));
    expect([1000 * 7 + 400 * 19, 14600 / 14, 357.142857 * 7, Math.hypot(2500, 1260)].map((v) => n(v))).toEqual(['14,600', '1,043', '2,500', '2,800']);
  });

  for (const lang of LANGS) {
    const t = beamStrings[lang].ui;
    const w = shaftUi[lang];
    const n = printer(lang);
    const html = show(lang);
    const cards = cardsOf(html);
    const s = hand(defaultShaft());
    const where = (x: number, figures = 6) => `${t.results.at} x = ${n(x, figures)} in`;

    it(`${lang}: five cards, in this order, and the page opens on both planes`, () => {
      expect(cards.titles).toEqual([w.bearings.title, w.results.bySegment, w.results.atForces, t.results.maxima, t.results.point]);
      expect(viewOf(html)).toBe(w.planes.both);
      expect(issuesOf(html)).toBe('');
      expect(html).not.toContain('aria-busy');
    });

    it(`${lang}: the bearings — where, the reaction in each plane, the radial load, the slope there`, () => {
      const card = cards.of(w.bearings.title);
      // The slope is of the two planes together, and its head says so in the switch's own words: "Slope, both planes".
      expect(headOf(card)).toEqual([w.bearings.name, `${t.results.position} (in)`, `${w.results.reactionV} (lbf)`, `${w.results.reactionH} (lbf)`, `${w.results.radial} (lbf)`, `${t.results.slope}, ${w.planes.both.toLowerCase()} (rad)`]);
      expect(headOf(card)[5]).toBe(lang === 'en' ? 'Slope, both planes (rad)' : 'Giro, ambos planos (rad)');
      expect(rowsOf(card)).toEqual(s.bearings.map((b, i) => [String(i + 1), n(b.x, 6), pointed(lang, 'vertical', b.reaction.vertical), pointed(lang, 'horizontal', b.reaction.horizontal), n(b.reaction.both), n(b.slope.both)]));
      // …which are the numbers worked by hand: upward, and away from the viewer, against a gear that pushes down and towards.
      if (lang === 'en') expect(rowsOf(card).map((r) => r.slice(2, 5))).toEqual(BY_HAND.bearings.map(([v, hz, r]) => [`${v} upward`, `${hz} away from viewer`, r]));
      expect(rowsOf(card).map((r) => r[5])).toEqual(['0.000442', '0.0002519']);
      // On a phone each cell stands under its own head, unit and all.
      expect(under(bodyOf(card)[0])).toEqual(headOf(card));
      // The reactions against the loads, plane by plane, each as a size and the way it points.
      const load = (v: number, word: string) => `${n(v)} lbf ${word}`;
      expect(notesOf(card)).toEqual([w.results.balance.replace('{vertical}', load(1400, t.results.downward)).replace('{horizontal}', load(360, w.results.towards))]);
      expect(card).not.toContain('mp-app__row-error');
    });

    it(`${lang}: segment by segment — from, to and diameter; I and Z; the largest moment and where; the nominal stress there`, () => {
      const card = cards.of(w.results.bySegment);
      expect(headOf(card)).toEqual([`${w.shaft.segment} (in)`, `${w.shaft.diameter} (in)`, `${t.section.I} (in⁴)`, `${w.results.modulus} (in³)`, `${w.results.largestMoment} (lbf·in)`, `${w.results.stress} (ksi)`]);
      expect(rowsOf(card)).toEqual(
        s.segments.map((x, i) => [`${i + 1}: ${n(x.from, 6)} – ${n(x.to, 6)}`, n(x.d, 6), n(x.I), n(x.Z), `${n(x.moment.value)} ${where(x.moment.x)}`, n(x.stress)]),
      );
      // A segment is named by its number, a colon, then where it runs: with a space alone between them the two read as one run of digits ("2 4 – 14", "3 14 – 18").
      expect(rowsOf(card).map((r) => r[0])).toEqual(['1: 0 – 4', '2: 4 – 14', '3: 14 – 18', '4: 18 – 23']);
      // …the number and its colon in the weight of a row's name, the range in the lighter type of a qualifier.
      expect(text(bodyOf(card)[2].match(/<\/span>([^<]*(?:<!-- -->[^<]*)*)<span class="mp-app__dir">/)?.[1] ?? '').trim()).toBe('3:');
      // At a shoulder the moment is one number and the stress is each side's own: 1,200 lbf·in at 18 in is 3.622 ksi in the 1.5 in journal and 6.258 in the 1.25 in end.
      expect(rowsOf(card).map((r) => r[4])).toEqual([4, 9, 16, 18].map((x, i) => `${n(Number(BY_HAND.moments[i].replace(',', '')))} ${where(x)}`));
      expect(rowsOf(card).map((r) => r[5])).toEqual(BY_HAND.stresses);
      expect(under(bodyOf(card)[0])).toEqual(headOf(card));
      // The stress is nominal, and the card says what is not in it.
      expect(notesOf(card)).toEqual([w.results.nominal]);
      expect(w.results.nominal).toMatch(lang === 'en' ? /no stress raiser — not a shoulder’s fillet, a groove or a keyway/ : /ningún concentrador de esfuerzos: ni el radio de acuerdo de un hombro, ni una ranura, ni un chavetero/);
    });

    it(`${lang}: at each force — the deflection there, its size and by planes, and the slope there`, () => {
      const card = cards.of(w.results.atForces);
      // The two columns that are sizes are headed as of the two planes together; the two between them name their plane.
      expect(headOf(card)).toEqual([w.forces.name, `${t.results.position} (in)`, `${t.results.deflection}, ${w.planes.both.toLowerCase()} (in)`, `${w.results.deflectionV} (in)`, `${w.results.deflectionH} (in)`, `${t.results.slope}, ${w.planes.both.toLowerCase()} (rad)`]);
      expect([headOf(card)[2], headOf(card)[5]]).toEqual(lang === 'en' ? ['Deflection, both planes (in)', 'Slope, both planes (rad)'] : ['Deflexión, ambos planos (in)', 'Giro, ambos planos (rad)']);
      // On a phone each cell stands under its own head, as in the card of the bearings.
      expect(under(bodyOf(card)[0])).toEqual(headOf(card));
      expect(rowsOf(card)).toEqual(s.forces.map((f, i) => [String(i + 1), n(f.x, 6), n(f.deflection.both), pointed(lang, 'vertical', f.deflection.vertical), pointed(lang, 'horizontal', f.deflection.horizontal), n(f.slope.both)]));
      // The gear goes down and towards the viewer, as it is pushed; the pulley, past the second bearing, down and away.
      if (lang === 'en') expect(rowsOf(card)).toEqual([['1', '9', '0.001667', '0.001371 downward', '0.0009491 towards viewer', '7.316 × 10^-5'], ['2', '21', '0.003573', '0.003386 downward', '0.001139 away from viewer', '0.001093']]);
      // The gear's slope is the one number of the example written with a power of ten, and it is ONE number: in a
      // narrow cell a line ended after its "×" while the spaces round it were plain ones.
      expect(rowsOf(card)[0][5]).toMatch(/^7\.316 × 10\^-5$/);
      expect(card).not.toMatch(/\d × 10\^/);
    });

    // A cell may end a line between a value and its place, never inside either: the place is one piece that does
    // not wrap (calc.css), and the space before it is outside that piece. Inside, the two were one word, wider
    // than half a card on a narrow phone, and were written over the stress in the cell beside them.
    it(`${lang}: a segment’s largest moment and its place are two pieces, with the space between them outside both`, () => {
      const card = cards.of(w.results.bySegment);
      const places = [...card.matchAll(/([^<>]*)<span class="mp-app__dir mp-shaft__where">([^<]*)<\/span>/g)];
      expect(places).toHaveLength(4);
      for (const m of places) {
        expect(m[1].endsWith(' '), m[0]).toBe(true);
        expect(m[2], m[0]).toMatch(/^\S.*\S$/);
      }
    });

    it(`${lang}: the largest values, each a size of the two planes together, each with its place`, () => {
      const card = cards.of(t.results.maxima);
      expect(pairsOf(card)).toEqual([
        [t.results.moment, `${n(s.largest.moment.value)} lbf·in ${where(s.largest.moment.x)}`],
        [w.results.stress, `${n(s.largest.stress.value)} ksi ${where(s.largest.stress.x)}, ${w.shaft.segment.toLowerCase()} 4`],
        [t.results.deflection, `${n(s.largest.deflection.value)} in ${where(s.largest.deflection.x)}`],
        [t.results.slope, `${n(s.largest.slope.value)} rad ${where(s.largest.slope.x)}`],
      ]);
      // The largest stress is not where the largest moment is: it is on the thin side of the last shoulder.
      expect(pairsOf(card).map((p) => p[1].replace(/ /g, ','))).toEqual([`2,800 lbf·in ${where(9)}`, `6.258 ksi ${where(18)}, ${w.shaft.segment.toLowerCase()} 4`, `0.005751 in ${where(23)}`, `0.001093 rad ${where(21)}`]);
      expect(notesOf(card)).toEqual([w.results.sizes]);
    });

    it(`${lang}: the values at a point — each plane and the two together, the diameter and the stress there`, () => {
      const card = cards.of(t.results.point);
      expect(fieldsOf(card).map((f) => [f.label, f.value, f.unit])).toEqual([['x', '11.5', 'in']]);
      expect(headOf(card)).toEqual(['', w.planes.vertical, w.planes.horizontal, w.planes.both]);
      const p = s.at(11.5);
      const row = (name: string, unit: string, q: Planes) => [`${name} (${unit})`, n(q.vertical), n(q.horizontal), n(q.both)];
      expect(rowsOf(card)).toEqual([row(t.results.shear, 'lbf', p.shear), row(t.results.moment, 'lbf·in', p.moment), row(t.results.deflection, 'in', p.deflection), row(t.results.slope, 'rad', p.slope)]);
      // By hand: 357.14 − 1,000 and 180 − 360; 357.14·9.5 − 1,000·2.5 and 180·9.5 − 360·2.5.
      expect(rowsOf(card).slice(0, 2).map((r) => r.slice(1))).toEqual([['-642.9', '-180', '667.6'], ['892.9', '810', n(Math.hypot(892.857, 810))]]);
      expect(under(bodyOf(card)[0])).toEqual(['', w.planes.vertical, w.planes.horizontal, w.planes.both]);
      expect(pairsOf(card)).toEqual([[w.shaft.diameter, '2 in'], [w.results.stress, `${n(p.stress)} ksi`]]);
      expect(notesOf(card)).toEqual([t.results.pointHint]);
    });

    it(`${lang}: the Spanish page writes its numbers the Spanish way — a narrow space between thousands, never a comma`, () => {
      const page = text(html);
      if (lang === 'es') {
        expect(page).toContain('1 043');
        expect(page).toContain('2 800');
        expect(page).not.toMatch(/\d,\d{3}(?!\d)/);
      } else {
        expect(page).toContain('1,043');
        expect(page).not.toContain(' ');
      }
      // Every number has a decimal point in both.
      expect(page).not.toMatch(/\d,\d{1,2}(?!\d)/);
    });
  }
});

describe('shaft calculator: the three views', () => {
  for (const lang of LANGS) {
    const t = beamStrings[lang].ui;
    const w = shaftUi[lang];
    const n = printer(lang);
    const s = hand(defaultShaft());
    const where = (x: number) => `${t.results.at} x = ${n(x, 6)} in`;
    const labels = (html: string) => [...(html.match(/<svg class="mp-plot__svg"[\s\S]*?<\/svg>/)?.[0] ?? '').matchAll(/<text\b[^>]*>([\s\S]*?)<\/text>/g)].map((m) => text(m[1]));

    it(`${lang}: the switch names the three, and each view says how it is seen`, () => {
      const html = show(lang);
      expect([...html.matchAll(/<input type="radio" name="shaft-view"(?: checked="")?\/><span>([\s\S]*?)<\/span>/g)].map((m) => text(m[1]))).toEqual([w.planes.vertical, w.planes.horizontal, w.planes.both]);
      for (const view of ['vertical', 'horizontal', 'both'] as const) {
        const page = show(lang, undefined, view);
        expect(viewOf(page)).toBe(w.planes[view]);
        expect(titleOf(page)).toBe(`${w.results.schematic} · ${w.results.seen[view]}`);
        expect(notesOf(page.slice(page.indexOf('mp-app__plots'), page.indexOf('mp-app__tables')))).toEqual([w.results.signs[view]]);
        expect(drawingsOf(page)).toHaveLength(4);
        // A diagram is read by its title. In a plane it is the first calculator's name; of the two planes together
        // it is a resultant — a size, drawn above its axis whichever way the shaft goes — and the title says so.
        const names = view === 'both' ? w.results.resultant : t.results;
        expect(captionsOf(page)).toEqual([`${names.shear} (lbf)`, `${names.moment} (lbf·in)`, `${names.deflection} (in)`]);
        expect(drawingsOf(page).slice(1).map((said) => said.split(':')[0])).toEqual([names.shear, names.moment, names.deflection]);
        expect(drawingsOf(page)[0]).toBe(`${w.results.schematic}, ${w.planes[view]}: 23 in; ${w.bearings.name} x = 2 in, ${w.bearings.name} x = 16 in.`);
        // The cards are of both planes whatever the switch says.
        expect(cardsOf(page).of(w.bearings.title)).toBe(cardsOf(html).of(w.bearings.title));
      }
      // Seen from above, down the page is towards the viewer: the drawing cannot say it, so its title does.
      expect(w.results.seen.horizontal).toMatch(lang === 'en' ? /down the page is towards the viewer/ : /hacia abajo en el dibujo es hacia el observador/);
      // The word for a diagram of both planes is the one this page's method uses for it, and no plane's title has it.
      expect(w.results.resultant).toEqual(
        lang === 'en'
          ? { shear: 'Resultant shear', moment: 'Resultant bending moment', deflection: 'Resultant deflection' }
          : { shear: 'Cortante resultante', moment: 'Momento flector resultante', deflection: 'Deflexión resultante' },
      );
      for (const plain of [t.results.shear, t.results.moment, t.results.deflection]) expect(plain).not.toMatch(/resultant/i);
      expect(shaftPage[lang].method.paragraphs.join(' ')).toMatch(lang === 'en' ? /The resultant — the square root of the sum of the squares of the two components — is taken of the shear, the bending moment, the slope and the deflection alike/ : /La resultante — la raíz cuadrada de la suma de los cuadrados de las dos componentes — se toma por igual del cortante, del momento flector, del giro y de la deflexión/);
    });

    it(`${lang}: the vertical plane — its loads and reactions on the drawing, and each diagram’s highest and lowest`, () => {
      const page = show(lang, undefined, 'vertical');
      const drawn = labels(page);
      for (const value of [`${n(1000, 6)} lbf`, '400 lbf', n(s.bearings[0].reaction.vertical), n(s.bearings[1].reaction.vertical)]) expect(drawn, value).toContain(value);
      const p = s.peaks('vertical');
      const said = (title: string, unit: string, [hi, lo]: { value: number; x: number }[]) => `${title}: ${t.plot.max} ${n(hi.value)} ${unit} ${where(hi.x)}; ${t.plot.min} ${n(-lo.value)} ${unit} ${where(lo.x)}.`;
      expect(drawingsOf(page).slice(1)).toEqual([said(t.results.shear, 'lbf', p.V), said(t.results.moment, 'lbf·in', p.M), said(t.results.deflection, 'in', p.D)]);
      // By hand: 400 lbf past the second bearing and 357.14 − 1,000 under the gear; 2,500 lbf·in under the gear, −2,000 over the second bearing.
      if (lang === 'en') expect(drawingsOf(page).slice(1, 3)).toEqual(['Shear, V: max 400 lbf at x = 16 in; min -642.9 lbf at x = 9 in.', 'Bending moment, M: max 2,500 lbf·in at x = 9 in; min -2,000 lbf·in at x = 16 in.']);
    });

    it(`${lang}: the horizontal plane — only what acts in it`, () => {
      const page = show(lang, undefined, 'horizontal');
      const drawn = labels(page);
      expect(drawn).toContain('360 lbf');
      // The pulley's pull is all vertical: nothing of it in this plane. Both bearings carry 180 lbf.
      expect(drawn).not.toContain('400 lbf');
      expect(drawn.filter((x) => x === '180')).toHaveLength(2);
      expect(drawingsOf(page)[2]).toBe(`${t.results.moment}: ${t.plot.max} ${n(1260)} lbf·in ${where(9)}; ${t.plot.min} 0 lbf·in.`);
      // What is positive in this plane is said under its diagrams WHOLE, in this plane's own words — not as another view's line with
      // a word changed: whoever reads this view, or prints it, has no other view's line beside it. And it is what the diagrams show.
      // The gear pushes 360 lbf towards the viewer and each bearing holds 180 lbf away from the viewer: left of a cut between the
      // first bearing and the gear there is that bearing's 180 lbf alone, away from the viewer — a shear of +180 — and past the
      // gear 180 − 360 = −180. Between the bearings the shaft bows towards the viewer: the moment is positive all along. Under
      // the gear it has moved towards the viewer: the lowest deflection, a negative one, as the card "At each force" says in words.
      expect(drawingsOf(page)[1]).toBe(`${t.results.shear}: ${t.plot.max} 180 lbf ${where(2)}; ${t.plot.min} -180 lbf ${where(9)}.`);
      const lowest = s.peaks('horizontal').D[1];
      expect([lowest.x, n(-lowest.value)]).toEqual([9, '-0.0009491']);
      expect(drawingsOf(page)[3]).toContain(`${t.plot.min} -0.0009491 in ${where(9)}.`);
      expect(rowsOf(cardsOf(page).of(w.results.atForces))[0][4]).toBe(`0.0009491 ${w.results.towards}`);
      expect(w.results.signs.horizontal).toBe(
        lang === 'en'
          ? 'Horizontal plane: a positive shear pushes the part left of the cut away from the viewer, a positive moment bows the shaft towards the viewer, and a positive deflection is away from the viewer.'
          : 'Plano horizontal: un cortante positivo empuja hacia el fondo la parte a la izquierda del corte, un momento positivo comba el eje hacia el observador y una deflexión positiva es hacia el fondo.',
      );
    });

    it(`${lang}: both planes — sizes: the radial loads on the drawing, no arrow, no lowest value, no negative label`, () => {
      const page = show(lang);
      const first = page.match(/<svg class="mp-plot__svg"[\s\S]*?<\/svg>/)?.[0] ?? '';
      const drawn = labels(page);
      for (const value of [`${n(Math.hypot(1000, 360))} lbf`, '400 lbf', n(s.bearings[0].reaction.both), n(s.bearings[1].reaction.both)]) expect(drawn, value).toContain(value);
      expect(first).not.toContain('mp-shaft-fig__head');
      expect(show(lang, undefined, 'vertical').match(/<svg class="mp-plot__svg"[\s\S]*?<\/svg>/)?.[0]).toContain('mp-shaft-fig__head');
      const said = (title: string, unit: string, top: { value: number; x: number }) => `${title}: ${t.plot.max} ${n(top.value)} ${unit} ${where(top.x)}.`;
      expect(drawingsOf(page).slice(1)).toEqual([said(w.results.resultant.shear, 'lbf', { value: Math.hypot(642.857, 180), x: 9 }), said(w.results.resultant.moment, 'lbf·in', s.largest.moment), said(w.results.resultant.deflection, 'in', s.largest.deflection)]);
      // The page opens on this view, and under 1,400 lbf of downward load its third diagram rises: it is titled as what it is.
      if (lang === 'en') expect(captionsOf(page)[2]).toBe('Resultant deflection (in)');
      if (lang === 'en') expect(captionsOf(show(lang, undefined, 'vertical'))[2]).toBe('Deflection (in)');
      const plots = [...page.matchAll(/<svg class="mp-plot__svg"[\s\S]*?<\/svg>/g)].slice(1).map((m) => [...m[0].matchAll(/<text class="mp-plot__value"[^>]*>([\s\S]*?)<\/text>/g)].map((x) => text(x[1])));
      expect(plots.flat().length).toBe(3);
      for (const label of plots.flat()) expect(label).not.toMatch(/^-/);
      // Every point of the three lines is at or above the axis: a size is never negative.
      expect(w.results.signs.both).toMatch(lang === 'en' ? /A size is never negative\.$/ : /Una magnitud nunca es negativa\.$/);
    });
  }
});

describe('shaft calculator: other shafts', () => {
  const t = beamStrings.en.ui;
  const w = shaftUi.en;
  const n = printer('en');

  it('a hollow segment: its bore beside its diameter, I and Z of the tube, and the same statics', () => {
    const form = shaft({ segments: [segment(1, 4, 1.5), segment(2, 10, 2, 1.25), segment(3, 4, 1.5), segment(4, 5, 1.25)] });
    const s = hand(form);
    const html = show('en', form);
    const rows = rowsOf(cardsOf(html).of(w.results.bySegment));
    // π(2⁴ − 1.25⁴)/64 = 0.6656 in⁴; over 1 in: 0.6656 in³.
    expect(rows[1].slice(0, 4)).toEqual(['2: 4 – 14', '2 bore 1.25', '0.6656', '0.6656']);
    expect([n((Math.PI * (2 ** 4 - 1.25 ** 4)) / 64), n(2800 / 1000 / 0.66555)]).toEqual(['0.6656', '4.207']);
    expect(rows.map((r) => r[5])).toEqual(s.segments.map((x) => n(x.stress)));
    expect(rows[1][5]).toBe('4.206');
    // Reactions and moments do not know the bore; the slopes and the deflections do.
    const solid = hand(defaultShaft());
    expect(rowsOf(cardsOf(html).of(w.bearings.title)).map((r) => r.slice(2, 5))).toEqual(rowsOf(cardsOf(show('en')).of(w.bearings.title)).map((r) => r.slice(2, 5)));
    expect(rowsOf(cardsOf(html).of(w.bearings.title)).map((r) => r[5])).toEqual(s.bearings.map((b) => n(b.slope.both)));
    expect(s.forces[0].deflection.both).toBeGreaterThan(solid.forces[0].deflection.both);
    expect(s.bearings[0].slope.both).toBeGreaterThan(solid.bearings[0].slope.both);
    expect(pairsOf(cardsOf(html).of(t.results.maxima))[2][1]).toBe(`${n(s.largest.deflection.value)} in at x = 23 in`);
    expect(pairsOf(cardsOf(html).of(t.results.point))[0]).toEqual([w.shaft.diameter, '2 in, bore 1.25 in']);
  });

  it('the shaft’s own weight: a load of the vertical plane, said by the drawing, in the balance and segment by segment', () => {
    const form = shaft({ ownWeight: true });
    const s = hand(form);
    const html = show('en', form);
    // 0.2836 lb/in³ × π/4 × (1.5²·4 + 2²·10 + 1.5²·4 + 1.25²·5) = 14.66 lbf.
    expect(n(0.2836 * (Math.PI / 4) * (1.5 ** 2 * 8 + 2 ** 2 * 10 + 1.25 ** 2 * 5))).toBe('14.66');
    expect(n(s.ownWeight)).toBe('14.66');
    const card = cardsOf(html).of(w.results.bySegment);
    expect(headOf(card)[4]).toBe(`${w.results.weight} (lbf/in)`);
    expect(rowsOf(card).map((r) => r[4])).toEqual(['0.5012', '0.891', '0.5012', '0.348']);
    expect(rowsOf(card).map((r) => [r[5].split(' ')[0], r[6]])).toEqual(s.segments.map((x) => [n(x.moment.value), n(x.stress)]));
    expect(under(bodyOf(card)[0])).toEqual(headOf(card));
    expect(notesOf(cardsOf(html).of(w.bearings.title))).toEqual([w.results.balance.replace('{vertical}', '1,415 lbf downward').replace('{horizontal}', '360 lbf towards viewer')]);
    expect(rowsOf(cardsOf(html).of(w.bearings.title)).map((r) => [r[2], r[4], r[5]])).toEqual(s.bearings.map((b) => [pointed('en', 'vertical', b.reaction.vertical), n(b.reaction.both), n(b.slope.both)]));
    // By the drawing: in the vertical view, where its band is drawn, and with both planes, where it is among the loads; not in the horizontal one.
    expect(titleOf(show('en', form, 'vertical'))).toBe(`${w.results.schematic} · ${w.results.seen.vertical} · ${t.results.ownWeight} 14.66 lbf`);
    expect(titleOf(html)).toBe(`${w.results.schematic} · ${w.results.seen.both} · ${t.results.ownWeight} 14.66 lbf`);
    expect(titleOf(show('en', form, 'horizontal'))).toBe(`${w.results.schematic} · ${w.results.seen.horizontal}`);
    expect(show('en', form, 'vertical')).toContain('mp-shaft-fig__weight');
    expect(show('en', form, 'horizontal')).not.toContain('mp-shaft-fig__weight');
    // Without it the column and the line are not there.
    expect(headOf(cardsOf(show('en')).of(w.results.bySegment))).toHaveLength(6);
    expect(titleOf(show('en'))).not.toContain(t.results.ownWeight);
  });

  it('in SI: millimetres, newtons, N·m and MPa — the same shaft, and every head in its unit', () => {
    for (const lang of LANGS) {
      const form = convertShaft(shaft({ ownWeight: true }), 'si');
      const s = hand(form);
      const html = show(lang, form);
      const m = printer(lang);
      const [tt, ww] = [beamStrings[lang].ui, shaftUi[lang]];
      expect(fieldsOf(groupsOf(html)[0].html).slice(0, 3).map((f) => [f.value, f.unit])).toEqual([['101.6', 'mm'], ['38.1', 'mm'], ['', 'mm']]);
      expect(fieldsOf(groupsOf(html)[2].html).slice(0, 3).map((f) => [f.value, f.unit])).toEqual([['228.6', 'mm'], [String(form.forces[0].v), 'N'], [String(form.forces[0].h), 'N']]);
      expect(fieldsOf(groupsOf(html)[4].html).map((f) => [f.value, f.unit])).toEqual([['200000', 'MPa'], ['7850', 'kg/m³']]);
      const seg = cardsOf(html).of(ww.results.bySegment);
      expect(headOf(seg)).toEqual([`${ww.shaft.segment} (mm)`, `${ww.shaft.diameter} (mm)`, `${tt.section.I} (mm⁴)`, `${ww.results.modulus} (mm³)`, `${ww.results.weight} (N/mm)`, `${ww.results.largestMoment} (N·m)`, `${ww.results.stress} (MPa)`]);
      expect(rowsOf(seg).map((r) => [r[2], r[3], r[4], r[5].split(` ${tt.results.at} `)[0], r[6]])).toEqual(s.segments.map((x) => [m(x.I), m(x.Z), m(x.w), m(x.moment.value), m(x.stress)]));
      expect(rowsOf(cardsOf(html).of(ww.bearings.title)).map((r) => [r[1], r[4], r[5]])).toEqual(s.bearings.map((b) => [m(b.x, 6), m(b.reaction.both), m(b.slope.both)]));
      expect(pairsOf(cardsOf(html).of(tt.results.maxima)).map((p) => p[1].split(` ${tt.results.at} `)[0])).toEqual([`${m(s.largest.moment.value)} N·m`, `${m(s.largest.stress.value)} MPa`, `${m(s.largest.deflection.value)} mm`, `${m(s.largest.slope.value)} rad`]);
      // 2,800 lbf·in is 316.3 N·m; 6.258 ksi is 43.15 MPa; the slopes are the US ones.
      expect([m(2799.5714 * 0.1129848290276167), m(6.258 * 6.894757293168361)]).toEqual(['316.3', '43.15']);
    }
  });

  it('bearings typed right to left: listed left to right, each named by its own field', () => {
    const form = shaft({ bearings: [16, 2] });
    const html = show('en', form);
    expect(fieldsOf(groupsOf(html)[1].html).map((f) => [f.label, f.value])).toEqual([['Bearing 1', '16'], ['Bearing 2', '2']]);
    const rows = rowsOf(cardsOf(html).of(w.bearings.title));
    expect(rows.map((r) => r.slice(0, 2))).toEqual([['2', '2'], ['1', '16']]);
    // The same shaft: every number is the example's.
    expect(rows.map((r) => r.slice(2))).toEqual(rowsOf(cardsOf(show('en')).of(w.bearings.title)).map((r) => r.slice(2)));
  });

  it('a step, a force and an applied moment at the point read: both sides of the shear, the moment, the diameter and the stress', () => {
    // Two segments of 10 in; at the step between them a force and a moment; the values are read at mid-length, which is that step.
    const form = shaft({ segments: [segment(1, 10, 2), segment(2, 10, 1.5)], bearings: [0, 20], forces: [force(3, 10, 800)], couples: [couple(4, 10, 3000)], nextId: 5 });
    const s = hand(form);
    const card = cardsOf(show('en', form)).of(t.results.point);
    const [l, r] = [s.at(10, 'left'), s.at(10, 'right')];
    const two = (a: number, b: number) => `${n(a)} ${t.results.left}, ${n(b)} ${t.results.right}`;
    const rows = rowsOf(card);
    // By hand: RA = 400 + 3,000/20 = 550 lbf; the shear falls by 800, the moment by 3,000 from 5,500.
    expect(rows[0]).toEqual(['Shear, V (lbf)', two(550, -250), '0', two(550, 250)]);
    expect(rows[1]).toEqual(['Bending moment, M (lbf·in)', two(5500, 2500), '0', two(5500, 2500)]);
    expect([l.shear.vertical, r.shear.vertical, l.moment.vertical, r.moment.vertical].map((v) => Math.round(v * 1e6) / 1e6)).toEqual([550, -250, 5500, 2500]);
    // Deflection and slope are one value whichever side.
    expect(rows[2]).toEqual(['Deflection (in)', n(r.deflection.vertical), '0', n(r.deflection.both)]);
    expect(rows[3]).toEqual(['Slope (rad)', n(r.slope.vertical), '0', n(r.slope.both)]);
    // Under the table each value has its unit after it, the stress as the diameter: in the table the unit is in the row's head, and a cell has none.
    expect(pairsOf(card)).toEqual([[w.shaft.diameter, `2 in ${t.results.left}, 1.5 in ${t.results.right}`], [w.results.stress, `${n(l.stress)} ksi ${t.results.left}, ${n(r.stress)} ksi ${t.results.right}`]]);
    // 5,500 lbf·in over π·2³/32 and 2,500 over π·1.5³/32.
    expect([n(5.5 / ((Math.PI * 8) / 32)), n(2.5 / ((Math.PI * 3.375) / 32))]).toEqual([n(l.stress), n(r.stress)]);
    // A force all in one plane leaves the other plane's cells one number each.
    expect(rows.every((row) => !row[2].includes(t.results.left))).toBe(true);
  });

  it('a shaft with no load: every value is zero, at no place, and no card of forces', () => {
    const html = show('en', shaft({ forces: [], couples: [] }));
    const cards = cardsOf(html);
    expect(cards.titles).toEqual([w.bearings.title, w.results.bySegment, t.results.maxima, t.results.point]);
    expect(rowsOf(cards.of(w.bearings.title)).map((r) => r.slice(2))).toEqual([['0', '0', '0', '0'], ['0', '0', '0', '0']]);
    expect(pairsOf(cards.of(t.results.maxima)).map((p) => p[1])).toEqual(['0 lbf·in', '0 ksi', '0 in', '0 rad']);
    expect(rowsOf(cards.of(w.results.bySegment)).map((r) => r.slice(4))).toEqual([['0', '0'], ['0', '0'], ['0', '0'], ['0', '0']]);
    expect(drawingsOf(html).slice(1)).toEqual(['Resultant shear: zero.', 'Resultant bending moment: zero.', 'Resultant deflection: zero.']);
    expect(drawingsOf(show('en', shaft({ forces: [], couples: [] }), 'vertical')).slice(1)).toEqual(['Shear, V: zero.', 'Bending moment, M: zero.', 'Deflection: zero.']);
    expect(notesOf(cards.of(w.bearings.title))).toEqual([w.results.balance.replace('{vertical}', '0 lbf').replace('{horizontal}', '0 lbf')]);
    expect(text(html)).not.toMatch(/NaN|undefined|Infinity/);
    // No dash for a value that is not there: every cell is a number.
    for (const row of [...rowsOf(cards.of(w.bearings.title)), ...rowsOf(cards.of(w.results.bySegment)), ...rowsOf(cards.of(t.results.point))]) expect(row.join(' ')).not.toContain('—');
  });

  // What the line under the bearings adds up is FORCES. An applied moment is carried by two reactions that are a pair:
  // they add up to nothing, and so do the forces — which is not to be said of the shaft's loads, for it has one.
  it('applied moments only: the two reactions are equal and opposite, and the line under them speaks of forces, which are none', () => {
    const form = shaft({ forces: [], couples: [couple(1, 9, 2500)], nextId: 2 });
    const card = cardsOf(show('en', form)).of(w.bearings.title);
    // 2,500 lbf·in over the 14 in between the bearings: 178.6 lbf, up at one and down at the other.
    expect(n(2500 / 14)).toBe('178.6');
    expect(rowsOf(card).map((r) => r[2])).toEqual(['178.6 upward', '178.6 downward']);
    expect(notesOf(card)).toEqual(['The reactions balance the forces in each plane: 0 lbf in the vertical one, 0 lbf in the horizontal one.']);
    expect(notesOf(cardsOf(show('es', form)).of(shaftUi.es.bearings.title))).toEqual(['Las reacciones equilibran las fuerzas en cada plano: 0 lbf en el vertical y 0 lbf en el horizontal.']);
  });

  it('a place that was entered is written as entered: a bearing at 16.4375 in is not at 16.44, and a step at 21.3125 is not at 21.31', () => {
    const form = shaft({ segments: [segment(1, 5.3125, 1.5), segment(2, 16, 2), segment(3, 4.6875, 1.25)], bearings: [2.125, 16.4375], forces: [force(4, 9.0625, 500)], nextId: 5 });
    const html = show('en', form);
    expect(rowsOf(cardsOf(html).of(w.bearings.title)).map((r) => r[1])).toEqual(['2.125', '16.4375']);
    expect(rowsOf(cardsOf(html).of(w.results.bySegment)).map((r) => r[0])).toEqual(['1: 0 – 5.3125', '2: 5.3125 – 21.3125', '3: 21.3125 – 26']);
    expect(rowsOf(cardsOf(html).of(w.results.atForces))[0][1]).toBe('9.0625');
    expect(pairsOf(cardsOf(html).of(t.results.maxima))[0][1]).toMatch(/ at x = 9\.0625 in$/);
  });
});

describe('shaft calculator: the faults, on their rows', () => {
  const t = beamStrings.en.ui;
  const w = shaftUi.en;
  const TITLE = w.issuesTitle;
  const segmentsOf = (html: string) => fieldsOf(groupsOf(html)[0].html);

  it('a length, a diameter or a bore of a segment: that field is marked, and tied to the line under its row', () => {
    const cases: [(s: SegmentRow[]) => void, number, string][] = [
      [(s) => (s[1].L = 0), 3, w.issues.length],
      [(s) => (s[1].L = Number.NaN), 3, w.issues.length],
      [(s) => (s[2].d = 0), 7, w.issues.diameter],
      [(s) => (s[0].d = -1), 1, w.issues.diameter],
      [(s) => (s[1].bore = 2), 5, w.issues.bore],
      [(s) => (s[1].bore = -0.5), 5, w.issues.bore],
      // (A fifth segment, past the last load: a segment of the example made that short leaves a force off the shaft, which is said first.)
      [(s) => s.push(segment(9, 1e-5, 1.25)), 12, w.issues['short-segment']],
      [(s) => (s[0].L = 1e61), 0, w.issues.size],
    ];
    for (const [change, field, says] of cases) {
      const segments = defaultShaft().segments;
      change(segments);
      const html = show('en', shaft({ segments }));
      const fields = segmentsOf(html);
      expect(fields.map((f) => f.invalid), says).toEqual(fields.map((_, i) => i === field));
      expect(lineOf(html, fields[field].describedBy), says).toBe(says);
      expect(issuesOf(html), says).toBe(`${TITLE} ${says}`);
      // Its row is marked, and no other; nothing is solved, and the page says where the results will be.
      expect(itemsOf(html).filter((i) => i.invalid).map((i) => i.name), says).toEqual([`Segment ${Math.floor(field / 3) + 1}`]);
      expect(cardsOf(html).titles).toEqual([]);
      expect(text(html)).toContain(w.results.waiting);
      expect(drawingsOf(html)).toHaveLength(1);
    }
  });

  it('a segment too stiff beside another: both are named, each at its diameter, and the line gives the limit as the engine has it', () => {
    const segments = defaultShaft().segments;
    segments[1].d = 60; // (60/1.25)⁴ = 5.3 million
    const html = show('en', shaft({ segments }));
    const says = 'The stiffest segment is over 1,000,000 times as stiff as the most flexible one — for solid segments, about 32 diameters to 1. A shaft like that is not solved.';
    const fields = segmentsOf(html);
    expect(fields.map((f) => f.invalid)).toEqual(fields.map((_, i) => i === 4 || i === 10));
    expect([lineOf(html, fields[4].describedBy), lineOf(html, fields[10].describedBy)]).toEqual([says, says]);
    // Said once in the results box, though two rows have it.
    expect(issueList(html)).toEqual([says]);
    expect(issueList(show('es', shaft({ segments })))).toEqual([shaftUi.es.issues.stiffness.replace('{max}', '1 000 000')]);
    // At 39 in to 1.25 (under a million times) it is solved.
    segments[1].d = 39;
    expect(cardsOf(show('en', shaft({ segments }))).titles).toHaveLength(5);
  });

  it('a bearing off the shaft, or the two at one place: the bearing is marked, and tied to its line', () => {
    const bearingsOf = (html: string) => fieldsOf(groupsOf(html)[1].html);
    const off = show('en', shaft({ bearings: [2, 30] }));
    expect(bearingsOf(off).map((f) => f.invalid)).toEqual([false, true]);
    expect(lineOf(off, bearingsOf(off)[1].describedBy)).toBe(w.issues.outside);
    expect(issuesOf(off)).toBe(`${TITLE} ${w.issues.outside}`);
    // 0.02 in apart on a shaft of 23: under a thousandth of its length.
    const close = show('en', shaft({ bearings: [2, 2.02] }));
    expect(bearingsOf(close).filter((f) => f.invalid)).toHaveLength(1);
    expect(lineOf(close, bearingsOf(close).find((f) => f.invalid)?.describedBy)).toBe(w.issues.bearings);
    expect(issuesOf(close)).toBe(`${TITLE} ${w.issues.bearings}`);
    expect(cardsOf(close).titles).toEqual([]);
    // 0.03 in apart is solved.
    expect(cardsOf(show('en', shaft({ bearings: [2, 2.03] }))).titles).toHaveLength(5);
  });

  it('a load off the shaft: its place is marked, not its sizes; a size that is not a number marks the row', () => {
    const off = show('en', shaft({ forces: [force(5, 40, 1000, 360)], couples: [couple(6, -1, 500)], nextId: 7 }));
    const [forces, couples] = [fieldsOf(groupsOf(off)[2].html), fieldsOf(groupsOf(off)[3].html)];
    expect(forces.map((f) => [f.label, f.invalid])).toEqual([['Position', true], ['Vertical', false], ['Horizontal', false]]);
    expect(couples.map((f) => [f.label, f.invalid])).toEqual([['Position', true], ['Vertical plane', false], ['Horizontal plane', false]]);
    expect(lineOf(off, forces[0].describedBy)).toBe(w.issues.outside);
    expect(lineOf(off, couples[0].describedBy)).toBe(w.issues.outside);
    // Said once in the results box, though two rows have it.
    expect(issuesOf(off)).toBe(`${TITLE} ${w.issues.outside}`);
    const nan = show('en', shaft({ forces: [force(5, 9, Number.NaN, 360)], nextId: 6 }));
    expect(fieldsOf(groupsOf(nan)[2].html).map((f) => f.invalid)).toEqual([true, true, true]);
    expect(issuesOf(nan)).toBe(`${TITLE} ${t.issues.number}`);
    expect(itemsOf(nan).filter((i) => i.invalid).map((i) => i.name)).toEqual(['Force 1']);
  });

  it('the material: a modulus that is not one; and a density that is not one only when the weight is asked for', () => {
    const material = (html: string) => fieldsOf(groupsOf(html)[4].html);
    const noE = show('en', shaft({ E: 0, material: 'custom' }));
    expect(material(noE).map((f) => f.invalid)).toEqual([true]);
    expect(lineOf(noE, material(noE)[0].describedBy)).toBe(w.issues.modulus);
    expect(issuesOf(noE)).toBe(`${TITLE} ${w.issues.modulus}`);
    const noDensity = show('en', shaft({ density: 0, material: 'custom', ownWeight: true }));
    expect(material(noDensity).map((f) => f.invalid)).toEqual([false, true]);
    expect(lineOf(noDensity, material(noDensity)[1].describedBy)).toBe(w.issues.density);
    expect(issuesOf(noDensity)).toBe(`${TITLE} ${w.issues.density}`);
    // Not asked for, the density is not on screen and is no fault.
    const unasked = show('en', shaft({ density: 0, material: 'custom' }));
    expect(issuesOf(unasked)).toBe('');
    expect(cardsOf(unasked).titles).toHaveLength(5);
  });

  it('several faults are each said once, in both languages, and nothing of the page is a non-number', () => {
    for (const lang of LANGS) {
      const ww = shaftUi[lang];
      const html = show(lang, shaft({ segments: [segment(1, 0, 1.5), segment(2, 10, 2, 3), segment(3, 4, Number.NaN), segment(4, 0, 1.25)], E: 0, ownWeight: true, density: -1, material: 'custom' }));
      expect(issueList(html)).toEqual([ww.issues.length, ww.issues.bore, ww.issues.diameter, ww.issues.modulus, ww.issues.density]);
      expect(text(html)).toContain(ww.issuesTitle);
      expect(text(html)).not.toMatch(/NaN|undefined|Infinity/);
      // Every line under a row is one a field is tied to.
      const ids = [...html.matchAll(/<p class="mp-app__row-error" id="([^"]*)">/g)].map((m) => m[1]);
      expect(ids).toHaveLength(6);
      for (const id of ids) expect(html, id).toContain(`aria-describedby="${id}"`);
    }
  });
});

describe('shaft calculator: its rules of the shared sheet', () => {
  const css = readFileSync(join(SRC, 'components', 'ttc', 'calc', 'calc.css'), 'utf8');
  const from = css.indexOf('/* SHAFT ON BEARINGS (.mp-shaft) — THE FORM AND THE TABLES');
  const to = css.indexOf('/* THE CONTINUOUS BEAM (.mp-cont)');
  const mine = css.slice(from, to).replace(/\/\*[\s\S]*?\*\//g, '');

  // calc.css is loaded by all four calculators. What this one adds begins with a class of its own, so that no
  // rule of it can reach the other three.
  it('every rule this calculator adds begins with a class of its own', () => {
    expect(from).toBeGreaterThan(0);
    expect(to).toBeGreaterThan(from);
    const selectors = [...mine.matchAll(/(^|[{}])\s*([^{}@]+?)\s*\{/g)].flatMap((m) => m[2].split(',').map((s) => s.trim())).filter(Boolean);
    expect(selectors.length).toBeGreaterThan(30);
    for (const s of selectors) expect(s, s).toMatch(/^\.mp-shaft(__[a-z]+(--[a-z]+)?)?(?![\w-])/);
    // …and outside this section and the drawing's, before it, the sheet has no rule about this calculator's classes.
    const drawing = css.indexOf('/* SHAFT ON BEARINGS (/resources/shaft-on-bearings) — THE DRAWING OF THE SHAFT');
    expect(drawing).toBeGreaterThan(0);
    expect(drawing).toBeLessThan(from);
    expect(css.slice(0, drawing)).not.toMatch(/\.mp-shaft/);
    expect(css.slice(to)).not.toMatch(/\.mp-shaft/);
    // Every class of its own that the component writes has a rule, or is one of the sheet's.
    const source = readFileSync(join(SRC, 'components', 'ttc', 'calc', 'shaft', 'ShaftCalculator.tsx'), 'utf8');
    const used = [...new Set([...source.matchAll(/mp-shaft(?:__[a-z]+(?:--[a-z]+)?)?/g)].map((m) => m[0]))];
    expect(used.sort()).toEqual(['mp-shaft', 'mp-shaft__density', 'mp-shaft__head', 'mp-shaft__limit', 'mp-shaft__load', 'mp-shaft__load--moment', 'mp-shaft__material', 'mp-shaft__name', 'mp-shaft__second', 'mp-shaft__segment', 'mp-shaft__solid', 'mp-shaft__table', 'mp-shaft__table--point', 'mp-shaft__view', 'mp-shaft__where']);
    for (const name of used) expect(mine, name).toMatch(new RegExp(`\\.${name}(?![\\w-])`));
  });

  // What these rules do is held in a browser (the regression script measures every field and prints the sheet).
  // That they are there, and where, is held here: a rule lost in an edit of the sheet would be lost in silence.
  it('a value too long for its field ends in “…”, a load is a line to a plane, a phone has a row’s button by its number, and on paper a solid segment has no bore and each drawing is whole', () => {
    const screen = mine.slice(mine.indexOf('@media screen {'), mine.indexOf('.mp-shaft .mp-app__add[aria-disabled'));
    expect(screen).toMatch(/\.mp-shaft \.mp-num__input \{\s*text-overflow: ellipsis;\s*\}/);
    expect(screen).toMatch(/\.mp-shaft \.mp-app__fields\.mp-shaft__load \{\s*display: grid;\s*grid-template-columns: minmax\(0, 0\.7fr\) minmax\(0, 0\.95fr\) minmax\(0, 1\.35fr\);\s*\}/);
    expect(screen).toMatch(/\.mp-shaft \.mp-shaft__load > \.mp-shaft__second \{\s*grid-column-start: 2;\s*\}/);
    const phone = mine.slice(mine.indexOf('@media screen and (max-width: 640px)'), mine.indexOf('@media print'));
    expect(phone).toMatch(/\.mp-shaft \.mp-app__item:has\(> \.mp-shaft__name\) \{\s*display: grid;\s*grid-template-columns: minmax\(0, 1fr\) 44px;/);
    expect(phone).toMatch(/\.mp-shaft \.mp-shaft__name \+ \.mp-app__row--rm > \.mp-app__remove \{\s*grid-area: 1 \/ 2;\s*\}/);
    expect(phone).toMatch(/\.mp-shaft__table \.mp-shaft__head \{\s*display: block;/);
    // A cell's own head is out of sight wherever the table has its heads.
    expect(mine).toMatch(/\n\.mp-shaft__head \{\s*display: none;\s*\}/);
    const paper = mine.slice(mine.lastIndexOf('@media print'));
    // The shaft and its three diagrams stay together on the sheet the calculator has laid out for paper (its cards under the form: the wiring, below);
    // on a page printed before its script ran they may part, each of them whole by the sheet's own rule.
    expect(paper).toMatch(/\.mp-shaft \.mp-app__plots \{\s*break-inside: auto;\s*\}\s*\.mp-shaft\.mp-shaft--sheet \.mp-app__plots \{\s*break-inside: avoid;\s*\}/);
    expect(css).toMatch(/@media print \{[\s\S]*?\n  \.mp-plot \{\s*break-inside: avoid;/);
    // The name of the view is the heading of the drawings: on paper it is not left at the foot of one sheet with the
    // drawings overleaf — it is not parted from what follows it, and on the sheet laid out for paper the answer is one block.
    expect(paper).toMatch(/\.mp-shaft \.mp-shaft__view \{\s*break-after: avoid;\s*\}\s*\.mp-shaft\.mp-shaft--sheet \.mp-app__out \{\s*break-inside: avoid;\s*\}/);
    // The markup those two rules are written for: in the answer, the switch of views and, right after it, the drawings.
    for (const lang of LANGS) expect(show(lang)).toMatch(/<section class="mp-app__out"[^>]*>(?:(?!<\/section>)[\s\S])*<fieldset class="mp-seg mp-shaft__view">(?:(?!<\/fieldset>)[\s\S])*<\/fieldset><div class="mp-app__plots">/);
    expect(paper).toMatch(/\.mp-shaft \.mp-shaft__solid \{\s*display: none;\s*\}/);
    // A list of five rows or more runs on from column to column. Its title goes with its first row — and with the note
    // that stands between them in the forces' and the applied moments' groups, which is never cut by the foot of a column.
    expect(paper).toMatch(
      /\.mp-shaft \.mp-app__group:has\(> \.mp-app__item:nth-of-type\(5\)\) > legend \{\s*break-after: avoid;\s*\}\s*\.mp-shaft \.mp-app__group:has\(> \.mp-app__item:nth-of-type\(5\)\) > legend \+ \.mp-app__note \{\s*break-inside: avoid;\s*break-after: avoid;\s*\}/,
    );
    expect(paper).not.toMatch(/text-overflow/);
  });

  // On a desktop the form is a column of 30rem at every width, and the type of a field grows with the window. With
  // the row's button in a column of its own a load's place had 70px for its value at each of them: eight characters
  // were cut from 1101px, the Spanish example's own "Hacia el observador" from 1500, a place of seven from 2210.
  it('from 1101px a row’s button stands by its number, as on a phone, and a load’s three fields share the whole column — a force’s and a moment’s by their own shares', () => {
    const desktop = mine.slice(mine.indexOf('@media screen and (min-width: 1101px)'), mine.indexOf('@media screen and (max-width: 640px)'));
    expect(desktop).toMatch(/^@media screen and \(min-width: 1101px\) \{/);
    expect(desktop).toMatch(/\.mp-shaft \.mp-app__item:has\(> \.mp-shaft__name\) \{\s*display: grid;\s*grid-template-columns: minmax\(0, 1fr\) 44px;\s*align-items: center;\s*column-gap: var\(--mp-4\);\s*\}/);
    expect(desktop).toMatch(/\.mp-shaft \.mp-shaft__name \{\s*margin: 0;\s*\}/);
    expect(desktop).toMatch(/\.mp-shaft \.mp-shaft__name \+ \.mp-app__row--rm \{\s*display: contents;\s*\}/);
    expect(desktop).toMatch(/\.mp-shaft \.mp-shaft__name \+ \.mp-app__row--rm > \.mp-app__remove \{\s*grid-area: 1 \/ 2;\s*\}/);
    expect(desktop).toMatch(/\.mp-shaft \.mp-shaft__name \+ \.mp-app__row--rm > \.mp-app__fields,\s*\.mp-shaft \.mp-app__item:has\(> \.mp-shaft__name\) > \.mp-app__row-error \{\s*grid-column: 1 \/ -1;\s*\}/);
    expect(desktop).toMatch(/\.mp-shaft \.mp-app__fields\.mp-shaft__load \{\s*grid-template-columns: minmax\(0, 0\.8fr\) minmax\(0, 0\.87fr\) minmax\(0, 1\.53fr\);\s*\}/);
    expect(desktop).toMatch(/\.mp-shaft \.mp-app__fields\.mp-shaft__load--moment \{\s*grid-template-columns: minmax\(0, 0\.78fr\) minmax\(0, 1\.02fr\) minmax\(0, 1\.4fr\);\s*\}/);
    // Seven rules and no more: nothing else of the page changes at that width.
    expect(desktop.match(/\{/g)).toHaveLength(8);
    // The width is the sheet's own: where the form stops being as wide as the page and becomes a column of 30rem.
    expect(css).toMatch(/\.mp-app__top \{\s*display: grid;\s*grid-template-columns: minmax\(0, 30rem\) minmax\(0, 1fr\);/);
    expect(css).toMatch(/@media \(max-width: 1100px\) \{\s*\.mp-app \{[^}]*\}\s*\.mp-app__top \{\s*grid-template-columns: minmax\(0, 1fr\);\s*\}/);
    // Between a phone and a desktop the button keeps its column: these rules are in no other block of a screen but the phone's.
    const between = mine.slice(mine.indexOf('@media screen {'), mine.indexOf('@media screen and (min-width: 1101px)'));
    expect(between).not.toMatch(/mp-app__row--rm|:has\(> \.mp-shaft__name\)/);
  });

  // Five faults of layout the browser script found on the finished screen (a value cut in its field, a number on
  // two lines, a cell over its neighbour, a table wider than its card, a direction astray on the sheet). What
  // mends each is a rule of this section; the script measures that it does, and this holds that it is there.
  it('the density has the width of a field alone; a moment’s size has more of a phone’s line, and a line of its own on the narrowest; the last two cards are placed by this page; on paper a load is a line to a plane', () => {
    const screen = mine.slice(mine.indexOf('@media screen {'), mine.indexOf('.mp-shaft .mp-app__add[aria-disabled'));
    expect(screen).toMatch(/\.mp-shaft \.mp-shaft__density > \.mp-num \{\s*flex-basis: 12rem;\s*\}/);
    const phone = mine.slice(mine.indexOf('@media screen and (max-width: 640px)'), mine.indexOf('@media screen and (max-width: 339px)'));
    expect(phone).toMatch(/\.mp-shaft \.mp-app__fields\.mp-shaft__load \{\s*grid-template-columns: minmax\(0, 0\.7fr\) minmax\(0, 1\.3fr\);\s*\}/);
    expect(phone).toMatch(/\.mp-shaft \.mp-app__fields\.mp-shaft__load--moment \{\s*grid-template-columns: minmax\(0, 0\.85fr\) minmax\(0, 1\.15fr\);\s*\}/);
    // A value of "Values at a point" is a third of a phone's line and never narrower than the number in it.
    expect(phone).toMatch(/\.mp-shaft__table--point tbody td \{\s*flex-basis: 33\.333%;\s*min-width: auto;\s*\}/);
    const narrowest = mine.slice(mine.indexOf('@media screen and (max-width: 339px)'), mine.indexOf('@media print'));
    expect(narrowest).toMatch(/^@media screen and \(max-width: 339px\) \{\s*\.mp-shaft \.mp-app__fields\.mp-shaft__load--moment \{\s*grid-template-columns: minmax\(0, 1fr\);\s*\}\s*\}\s*$/);
    // One card to a row under 1024px, and from there "Largest values" beside "Values at a point", which has two thirds.
    expect(mine).toMatch(/@media screen and \(max-width: 1023px\) \{\s*\.mp-shaft \.mp-app__tables \{\s*grid-template-columns: minmax\(0, 1fr\);\s*\}\s*\}\s*@media screen and \(min-width: 1024px\) \{\s*\.mp-shaft \.mp-app__tables \{\s*grid-template-columns: minmax\(0, 1fr\) minmax\(0, 2fr\);\s*\}\s*\}/);
    // The component names what these rules are about: the density's row, and a moment's row among the loads'.
    const source = readFileSync(join(SRC, 'components', 'ttc', 'calc', 'shaft', 'ShaftCalculator.tsx'), 'utf8');
    expect(source.match(/className="mp-app__row mp-app__row--one mp-shaft__density"/g)).toHaveLength(1);
    expect(source.match(/className="mp-app__fields mp-shaft__load mp-shaft__load--moment"/g)).toHaveLength(1);
    expect(source.match(/className="mp-app__fields mp-shaft__load"/g)).toHaveLength(1);
    for (const lang of LANGS) {
      const html = show(lang, shaft({ couples: [couple(9, 9, 100, 50)], ownWeight: true }));
      expect(html.match(/<div class="mp-app__fields mp-shaft__load mp-shaft__load--moment">/g)).toHaveLength(1);
      expect(html.match(/<div class="mp-app__fields mp-shaft__load">/g)).toHaveLength(2);
      expect(html.match(/<div class="mp-app__row mp-app__row--one mp-shaft__density">/g)).toHaveLength(1);
    }
    const paper = mine.slice(mine.lastIndexOf('@media print'));
    // On paper a load is its own grid of two columns — its name and its place, then each plane's size and the way
    // it acts — and the row and the fields between it and them are passed through.
    const load = String.raw`\.mp-shaft \.mp-app__item:has\(> \.mp-app__row--rm > \.mp-shaft__load\)`;
    expect(paper).toMatch(new RegExp(String.raw`${load} \{\s*display: grid;\s*grid-template-columns: minmax\(0, 1fr\) minmax\(0, 1\.3fr\);\s*gap: 0\.5mm 2\.5mm;\s*align-items: end;\s*\}`));
    expect(paper).toMatch(new RegExp(String.raw`${load} > \.mp-app__row--rm,\s*\.mp-shaft \.mp-app__fields\.mp-shaft__load \{\s*display: contents;\s*\}`));
    expect(paper).toMatch(new RegExp(String.raw`${load} > \.mp-app__row-error \{\s*grid-column: 1 \/ -1;\s*\}`));
    expect(paper).toMatch(new RegExp(String.raw`@supports \(field-sizing: content\) \{\s*${load} \{\s*grid-template-columns: max-content minmax\(0, 1fr\);\s*column-gap: 4mm;\s*justify-items: start;\s*\}\s*\}`));
    // The markup those rules are written for: a load's item holds its name, then the row, whose first child is the fields.
    for (const lang of LANGS) expect(show(lang).match(/<div class="mp-app__item" role="group" aria-label="[^"]*"><p class="mp-shaft__name" aria-hidden="true">[^<]*<\/p><div class="mp-app__row mp-app__row--rm"><div class="mp-app__fields mp-shaft__load">/g)).toHaveLength(2);
  });

  // A number is never on two lines, so a table has a least width - and with every value a power of ten that was wider
  // than a card between 641 and some 745px: the last column stood past the window's edge, which does not scroll.
  it('a table wider than its card is reached by moving the card sideways: the three cards that are a table, on a screen', () => {
    expect(mine).toMatch(/\n@media screen \{\s*\.mp-shaft \.mp-app__card--wide \{\s*overflow-x: auto;\s*\}\s*\}/);
    // Not on paper, and not the two cards that are not all table: "Values at a point" holds a field.
    expect(mine.slice(mine.lastIndexOf('@media print'))).not.toMatch(/overflow/);
    expect(mine.match(/overflow-x: auto/g)).toHaveLength(1);
    for (const lang of LANGS) {
      const html = show(lang);
      const wide = html.split('<div class="mp-app__card mp-app__card--wide">').slice(1);
      expect(wide).toHaveLength(3);
      // Each of the three is a title, a table and at most a line under it: nothing in it takes the focus, so nothing has an outline to cut.
      for (const card of wide.map((c) => c.split('<div class="mp-app__card')[0])) {
        expect(card).toMatch(/^<h3 class="mp-app__h">[^<]*<\/h3><table class="mp-app__table mp-shaft__table" role="table">/);
        expect(card).not.toMatch(/<(input|select|button|a)\b/);
      }
    }
  });

  it('a unit in a head keeps its own letters: “MPa” and “N·m” are never set in capitals', () => {
    // The unit of a head is the sheet's own class for a unit, which sets no capitals; on a phone the head a cell carries is that same markup.
    expect(css).toMatch(/\.mp-plot__unit \{[^}]*text-transform: none;/);
    const html = show('en', convertShaft(defaultShaft(), 'si'));
    expect(html).toContain('<th scope="col" role="columnheader">Largest bending moment<span class="mp-plot__unit"> (N·m)</span></th>');
    expect(html).toContain('<span class="mp-shaft__head" aria-hidden="true">Nominal bending stress<span class="mp-plot__unit"> (MPa)</span></span>');
    expect(html).not.toMatch(/data-label=/);
  });

  // The mono the page sets its units in has "²" and "³" and no "⁴": written as that character, the 4 of "in⁴" was
  // drawn by a font of the system's, larger and heavier than the "³" of the next head (the browser script asks the
  // browser which font drew each). A head writes the raised figure of a unit as a figure of its own type, set up.
  it('the raised figure of a unit in a head is a figure of the page’s own type, set up - both “³” and “⁴”, so that two heads match', () => {
    for (const lang of LANGS) {
      for (const [form, length] of [
        [shaft({ ownWeight: true }), 'in'],
        [convertShaft(shaft({ ownWeight: true }), 'si'), 'mm'],
      ] as const) {
        const html = show(lang, form);
        const card = cardsOf(html).of(shaftUi[lang].results.bySegment);
        // In the head of the table and, for a phone, in the head each cell carries: once and once a row.
        expect(card.split(`<span class="mp-plot__unit"> (${length}<sup>4</sup>)</span>`)).toHaveLength(2 + form.segments.length);
        expect(card.split(`<span class="mp-plot__unit"> (${length}<sup>3</sup>)</span>`)).toHaveLength(2 + form.segments.length);
        expect(html.split('<sup>')).toHaveLength(1 + 2 * (1 + form.segments.length));
        // Read, the heads say what they said.
        expect(headOf(card).slice(2, 4)).toEqual([`${sharedWords(beamStrings[lang].ui).section.I} (${length}⁴)`, `${shaftUi[lang].results.modulus} (${length}³)`]);
        // The character the page's type does not have is nowhere in the tool; the "³" it does have is the density's, in its field.
        expect(html).not.toMatch(/[⁰⁴-⁹]/);
        expect(html.match(/³/g)).toHaveLength(1);
        expect(fieldsOf(html).map((f) => f.unit).filter((u) => u.includes('³'))).toEqual([length === 'in' ? 'lb/in³' : 'kg/m³']);
      }
    }
  });
});

describe('shaft calculator: what only its source can show of the wiring (the browser script holds what it does)', () => {
  const source = readFileSync(join(SRC, 'components', 'ttc', 'calc', 'shaft', 'ShaftCalculator.tsx'), 'utf8');
  const code = source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');

  it('it is built on the shared pieces as they are: the shell, the number field, the diagrams', () => {
    for (const piece of ["from '../shell/Actions'", "from '../shell/address'", "from '../shell/fields'", "from '../shell/layout'", "from '../shell/results'", "from '../shell/sheet'", "from '../NumField'", "from '../beam/BeamPlot'", "from './ShaftSchematic'"]) expect(code, piece).toContain(piece);
    // The address keeps the case after "#h=", and follows the form.
    expect(SHAFT_KEY).toBe('h');
    expect(code).toContain('const EXAMPLE = encodeShaft(defaultShaft());');
    expect(code).toContain('const code = useCallback(() => encodeShaft(form), [form]);');
    expect(code).toMatch(/useAddress<ShaftForm>\(\{\s*key: SHAFT_KEY,\s*example: EXAMPLE,\s*code,\s*read: caseIn,\s*blank: defaultShaft,/);
    expect(code).toContain('const m = hash.match(new RegExp(`^#${SHAFT_KEY}=(.*)$`));');
    // The printed sheet: the stamp with the address of the shaft on screen, and the drawings at paper width.
    expect(code).toContain('const { stamp, onPaper } = useSheet({ locale: t.sheet.locale, url: () => address.link(encodeShaft(form)) });');
    expect(code).toContain('const width = onPaper ? PAPER_WIDTH : windowWidth;');
    // (On screen a diagram is a little shorter than the shell reckons, for the shaft's taller drawing: the browser script measures that the column is pinned.)
    expect(code).toContain('const plotHeight = onPaper ? PAPER_PLOT : Math.max(PAPER_PLOT, windowPlotHeight - 31);');
    // As the server sends it: 150 less 31.
    expect([...show('en').matchAll(/<svg class="mp-plot__svg" width="720" height="(\d+)"/g)].map((m) => m[1]).slice(1)).toEqual(['119', '119', '119']);
    expect(code).toContain('<SheetStamp stamp={stamp} t={{ printed: t.sheet.printed, link: w.sheet.link }} />');
    // No file of the tree sends anything anywhere from here.
    expect(code).not.toMatch(/\bfetch\(|XMLHttpRequest|sendBeacon|localStorage|sessionStorage/);
  });

  // A shaft arriving in the address (Back, Forward, a pasted link) while a field has the focus: the field kept the
  // text and the fall-back value of the shaft before.
  it('a shaft opened from the address ends the edit in progress first: the field is left, then the shaft is put on screen, whole, and the place pointed at is forgotten', () => {
    const open = code.slice(code.indexOf('open: (found) => {'), code.indexOf('const { linkError } = address;'));
    const steps = ['if (focused instanceof HTMLInputElement && root.current?.contains(focused)) focused.blur();', "dispatch({ type: 'load', form: found });", 'setWhole(found);', 'setProbeX(null);', 'setTypedX(null);'];
    const at = steps.map((step) => open.indexOf(step));
    expect(at.every((i) => i >= 0), JSON.stringify(at)).toBe(true);
    expect([...at].sort((p, q) => p - q)).toEqual(at);
    expect(code).toContain("<div className={onPaper ? 'mp-app mp-shaft mp-shaft--sheet' : 'mp-app mp-shaft'} ref={root}>");
    // A link that cannot be read is said in the results box, in this page's own words.
    expect(code).toMatch(/\) : linkError \? \(\s*<p className="mp-app__issues-title">\{w\.linkError\}<\/p>\s*\) : null\}/);
  });

  // The keyboard. A row removed with a key hands the focus to the row that takes its place; a row added with one,
  // to its own first field: left on the button, nothing said that a row had come. Neither after a click or a tap
  // (`detail` is 0 for a key alone): a phone would open its keyboard on a field nobody touched.
  it('a row added with a key is put on screen and given the focus; a row removed with one hands it on; a click moves none', () => {
    expect(code).toContain("import { flushSync } from 'react-dom';");
    expect(code).toMatch(
      /const addRow = \(list: ShaftList\) => \(press: React\.MouseEvent<HTMLButtonElement>\) => \{\s*if \(press\.detail !== 0\) \{\s*dispatch\(\{ type: 'add', list \}\);\s*return;\s*\}\s*const group = press\.currentTarget\.closest\('fieldset'\);\s*flushSync\(\(\) => dispatch\(\{ type: 'add', list \}\)\);\s*const rows = group\?\.querySelectorAll\('\.mp-app__item'\);\s*const added = rows\?\.\[rows\.length - 1\]\?\.querySelector<HTMLElement>\('input, select'\);\s*added\?\.focus\(\);\s*\};/,
    );
    // At its limit the button is still there and still does nothing.
    expect(code).toContain('onClick={full ? undefined : addRow(list)}');
    expect(code.match(/type: 'add'/g)).toHaveLength(2);
    expect(code).toMatch(/const next = press\.detail === 0 \? \(near\?\.querySelector<HTMLElement>\('input, select'\) \?\? /);
    expect(code).toMatch(/dispatch\(\{ type: 'remove', list, id \}\);\s*next\?\.focus\(\);/);
  });

  // A key, then the browser's reload key inside the shell's 300 ms wait: the reload came back to the address of
  // before that key ("1234" typed, "123" on screen). The wait is the shell's; this calculator writes at the key.
  it('a reload from the keyboard finds the address written: what was waiting is written at the reload key', () => {
    expect(code).toContain('const flushAddress = useRef(address.flush);');
    expect(code).toMatch(/useEffect\(\(\) => \{\s*flushAddress\.current = address\.flush;\s*\}\);/);
    expect(code).toMatch(
      /useEffect\(\(\) => \{\s*const reloading = \(press: KeyboardEvent\) => \{\s*if \(press\.key === 'F5' \|\| \(\(press\.ctrlKey \|\| press\.metaKey\) && !press\.altKey && \(press\.key === 'r' \|\| press\.key === 'R'\)\)\) flushAddress\.current\(\);\s*\};\s*window\.addEventListener\('keydown', reloading, true\);\s*return \(\) => window\.removeEventListener\('keydown', reloading, true\);\s*\}, \[\]\);/,
    );
    // It writes through the shell's own door and nowhere else: no address is written from this file. (The one entry
    // this file adds to the history, Start over's, carries the address already in the bar: held in its own test.)
    expect(code).not.toMatch(/replaceState|location\.hash\s*=/);
    expect(code.match(/\bpushState\b/g)).toHaveLength(1);
  });

  // "Values at a point": with the focus in x, a pointer resting on a diagram gave the values under it beside the x typed.
  it('while x is being typed the pointer does not move the position; a press on a drawing leaves the field first; the flag goes with the results', () => {
    expect(code).toMatch(/const probe = useCallback\(\(x: number \| null\) => \{\s*if \(!typingX\.current\) setProbeX\(x\);\s*\}, \[\]\);/);
    expect(code.match(/onProbe=\{probe\}/g)).toHaveLength(1);
    expect(code).not.toContain('onProbe={setProbeX}');
    expect(code).toMatch(/const leaveX = \(\) => \{\s*const focused = document\.activeElement;\s*if \(typingX\.current && focused instanceof HTMLElement\) focused\.blur\(\);\s*\};/);
    expect(code).toContain('<div className="mp-app__plots" ref={plotRef} onPointerDownCapture={leaveX}>');
    expect(code).toMatch(/onEdit=\{\(\) => \{\s*typingX\.current = true;\s*setTypedX\(x0\);\s*setProbeX\(null\);\s*\}\}\s*onCommit=\{\(\) => \{\s*typingX\.current = false;\s*\}\}/);
    // The x field is in a card of the results: when they go with the focus still in it, it is never left, and
    // the flag is dropped with them — or the diagrams would stop answering for the rest of the visit.
    // The same when the cards are put under the form for paper, the field among them.
    expect(code).toMatch(/const r = a\.results;\s*useEffect\(\(\) => \{\s*if \(!r \|\| onPaper\) typingX\.current = false;\s*\}, \[r, onPaper\]\);/);
    // A place pointed at is not one in other units either.
    expect(code).toMatch(/dispatch\(\{ type: 'units', units: unit \}\);\s*setTypedX\(null\);\s*setProbeX\(null\);/);
  });

  // The shaft is solved a moment after a key, not inside it — but only while numbers alone change, never on paper, and never for a shaft opened whole.
  it('what is solved is the form of a moment ago only while it differs from the form by numbers alone', () => {
    expect(code).toContain("const choicesOf = (form: ShaftForm) => JSON.stringify(form, (_key, value: unknown) => (typeof value === 'number' ? 0 : value));");
    expect(code).toContain('const behind = useDeferredValue(form);');
    expect(code).toContain('const solved = onPaper || form === whole || choicesOf(behind) !== choicesOf(form) ? form : behind;');
    expect(code).toContain('const a = useMemo(() => analyseSafely(solved, group), [solved, group]);');
    // The results and the cards say so while they are behind.
    expect(code.match(/aria-busy=\{catching \? true : undefined\}/g)).toHaveLength(2);
    // Start over is a shaft put on screen whole, like one opened from the address — and the view is the one the page opens on.
    expect(code).toMatch(/const example = defaultShaft\(\);\s*dispatch\(\{ type: 'load', form: example \}\);\s*setWhole\(example\);\s*setView\('both'\);\s*setTypedX\(null\);\s*setProbeX\(null\);\s*address\.take\(EXAMPLE\);/);
    // As the server sends it, nothing is behind.
    for (const lang of LANGS) expect(show(lang)).not.toContain('aria-busy');
  });

  // "Start over" throws the shaft on screen away at one press, and asks nothing. Unless it is the example, the shaft
  // is left one step behind in the browser's history, so that Back brings it back (the browser script presses both).
  it('Start over leaves the shaft it throws away one step Back — never the example — and starts over whether or not the browser takes the entry', () => {
    expect(code).toMatch(/reset=\{\(\) => \{\s*const thrown = encodeShaft\(form\);\s*if \(thrown !== EXAMPLE\) \{\s*address\.take\(thrown\);\s*try \{\s*window\.history\.pushState\(window\.history\.state, '', window\.location\.href\);\s*\} catch \{\s*\}\s*\}\s*const example = defaultShaft\(\);/);
    // The one place this file touches the history, and all it does there is add an entry for the address as it stands: the address itself is the shell's to write.
    expect(code.match(/\bhistory\.\w+/g)).toEqual(['history.pushState', 'history.state']);
    expect(code).not.toMatch(/replaceState|location\.(assign|replace|reload)\(|location\.(hash|href|search|pathname)\s*=[^=]/);
  });

  // A key draws the calculator again before the shaft is solved again: the four drawings are then handed what they
  // were handed the time before, and are not drawn again - a third of the key's own work with the form at its fullest.
  // Kept by `memo`, which compares everything a drawing is given: nothing can be kept that should have changed.
  // (That a drawing is never of the shaft before is the browser script's to see, frame by frame.)
  it('the three diagrams and the drawing of the shaft are kept while everything they are given is the same', () => {
    expect(code).toMatch(/import React, \{ memo, /);
    expect(code).toContain('const Plot = memo(BeamPlot);');
    expect(code).toContain('const Schematic = memo(ShaftSchematic);');
    // No comparison of this file's own: one would say what a drawing depends on, and could leave something out.
    expect(code.match(/\bmemo\(/g)).toHaveLength(2);
    expect(code.match(/<Plot\b/g)).toHaveLength(1);
    expect(code.match(/<Schematic\b/g)).toHaveLength(1);
    expect(code).not.toMatch(/<BeamPlot\b|<ShaftSchematic\b/);
    // What a diagram is given is the same from one draw to the next while the answer is: the analysis is kept (above),
    // there is no dot while the pointer is nowhere, and what tells of the pointer is one function for the life of the page.
    expect(code).toContain('probe={probeX !== null && read !== null && x0 !== null ? { x: x0, y: read } : null}');
    expect(code).toMatch(/const probe = useCallback\(\(x: number \| null\) => \{\s*if \(!typingX\.current\) setProbeX\(x\);\s*\}, \[\]\);/);
    // As the server sends it the page is what it was: the shaft and its three diagrams.
    for (const lang of LANGS) expect(drawingsOf(show(lang))).toHaveLength(4);
  });

  // A shaft's form is short and its drawing tall. With the cards last on paper, as on screen, the four drawings
  // went overleaf together and left the first sheet half empty, or parted and left a diagram alone overleaf.
  it('on paper the cards stand under the form, before the drawings, and the calculator says it has laid itself out so; on screen they are last', () => {
    expect(code).toMatch(/<\/form>\s*(\{\}\s*)*\{boxFirst \? box : null\}\s*\{onPaper \? cards : null\}\s*(\{\}\s*)*<section className=\{tooTall/);
    expect(code).toMatch(/\{onPaper \? null : cards\}\s*<p className="mp-app__privacy">/);
    // (The fourth is in `boxFirst`, below: whether there are cards for the box to stand before.)
    expect(code.match(/\bcards\b/g)).toHaveLength(4);
    expect(code).toMatch(/const cards =\s*r && here && x0 !== null \? \(\s*<div className="mp-app__tables" aria-busy=\{catching \? true : undefined\}>/);
    // As the server sends it — and so on a page printed before its script ran — the cards are last and the page is not marked.
    for (const lang of LANGS) {
      const html = show(lang);
      expect(html.startsWith('<div class="mp-app mp-shaft"><div class="mp-app__top"><form ')).toBe(true);
      expect(html.indexOf('<div class="mp-app__tables">')).toBeGreaterThan(html.indexOf('</section></div>'));
      expect(html).not.toContain('mp-shaft--sheet');
    }
  });

  // A link that could not be read shows the example, solved: on paper its five cards stood before the line that says
  // they are not the shaft that was sent - three of them on the first sheet, the line on the second.
  it('on paper what the box of notices says stands over the cards, when there are cards and it says something; there is one box, and on screen it is at the head of the answer', () => {
    expect(code).toContain('const boxFirst = onPaper && cards !== null && (notices.length > 0 || linkError);');
    expect(code).toMatch(/const box = \(\s*<div className="mp-app__issues" role="alert" aria-live="assertive">/);
    // One box, in one of two places: before the cards, or first in the answer.
    expect(code.match(/className="mp-app__issues"/g)).toHaveLength(1);
    expect(code.match(/\bbox\b/g)).toHaveLength(3);
    expect(code.match(/\bboxFirst\b/g)).toHaveLength(3);
    expect(code).toMatch(/<section className=\{tooTall[^\n]*>\s*\{boxFirst \? null : box\}\s*(\{\}\s*)*<fieldset className="mp-seg mp-shaft__view">/);
    // As the server sends it, the box is the first thing in the answer, and empty.
    for (const lang of LANGS) expect(show(lang)).toMatch(/<section class="mp-app__out"[^>]*><div class="mp-app__issues" role="alert" aria-live="assertive"><\/div><fieldset class="mp-seg mp-shaft__view">/);
  });

  it('two forms that differ by a number are the same choices; by a unit, a row, a direction, a material, the weight’s box, they are not', () => {
    const choicesOf = (form: ShaftForm) => JSON.stringify(form, (_key, value: unknown) => (typeof value === 'number' ? 0 : value));
    const base = defaultShaft();
    const same = (other: ShaftForm) => choicesOf(other) === choicesOf(base);
    expect(same({ ...base, segments: base.segments.map((s, i) => (i ? s : { ...s, L: 31.5, d: Number.NaN, bore: 0.5 })) })).toBe(true);
    expect(same({ ...base, bearings: [1, 22], E: 1, density: 2, forces: base.forces.map((f) => ({ ...f, x: 3, v: -9 })) })).toBe(true);
    expect(same({ ...base, units: 'si' })).toBe(false);
    expect(same({ ...base, segments: base.segments.slice(0, 3) })).toBe(false);
    expect(same({ ...base, forces: base.forces.map((f) => ({ ...f, vDir: 'up' as const })) })).toBe(false);
    expect(same({ ...base, forces: base.forces.map((f) => ({ ...f, hDir: 'away' as const })) })).toBe(false);
    expect(same({ ...base, couples: [couple(9, 1, 1)] })).toBe(false);
    expect(same({ ...base, material: 'custom' })).toBe(false);
    expect(same({ ...base, ownWeight: true })).toBe(false);
  });

  it('the arithmetic is reached through the door that never throws, and the screen works nothing out', () => {
    expect(code).toMatch(/import \{ analyseSafely, type [^}]*\} from '@\/lib\/calc\/shaft\/analysis';/);
    expect(code).not.toMatch(/\banalyseShaft\b|\bsolveShaft\b|\bsolveBeam\b|\bsectionOf\b|\btoEngine\b|\bdrawingOf\b/);
    // The only arithmetic in the file: a size without its sign, a position kept on the shaft and the middle of it, whether a place was entered.
    expect(code).not.toMatch(/Math\.(hypot|sqrt|pow|PI|sin|cos|atan)/);
    expect(code.match(/Math\.\w+/g)?.sort().filter((m, i, all) => all.indexOf(m) === i)).toEqual(['Math.abs', 'Math.max', 'Math.min']);
    expect(shaftUi.en.issues.stopped).toBe('The calculation broke off on this shaft and has nothing to show. The fault is this calculator’s, not the shaft’s.');
    expect(shaftUi.es.issues.stopped).toBe('El cálculo se interrumpió con este eje y no hay nada que mostrar. El fallo es de esta calculadora, no del eje.');
  });
});
