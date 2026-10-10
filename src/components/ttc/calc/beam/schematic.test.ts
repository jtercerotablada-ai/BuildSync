import { createElement as h } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { analyse, defaultBeam, type BeamForm } from '@/lib/calc/beam/model';
import type { BeamReaction } from '@/lib/calc/beam/solver';
import { xToPx } from './BeamPlot';
import { BeamSchematic } from './BeamSchematic';

/**
 * THE DRAWING OF THE BEAM: where a reaction is drawn.
 *
 * A reaction is a force at a support, so its arrow stands on the support's
 * own line — not beside it, as it did when the arrow was a character of a
 * centred label. Its value goes beside the arrow, on the side that has room.
 */

const WIDTH = 700;
const draw = (form: BeamForm, reactions: BeamReaction[] | null) => renderToStaticMarkup(h(BeamSchematic, { form, reactions, width: WIDTH, probeX: null, summary: 'a beam' }));
const attr = (tag: string, name: string) => Number(tag.match(new RegExp(` ${name}="([^"]*)"`))?.[1]);
/** Each reaction of the drawing: its arrow's line, its head, and what is written beside it. */
const marks = (svg: string) =>
  [...svg.matchAll(/<g class="mp-beam__reaction">([\s\S]*?)<\/g>/g)].map((m) => {
    const line = m[1].match(/<line[^>]*>/)?.[0];
    const headPoints = m[1].match(/<polygon class="mp-beam__head" points="([^"]*)"/)?.[1];
    const texts = [...m[1].matchAll(/<text x="([^"]*)" y="([^"]*)" text-anchor="([^"]*)">([^<]*)<\/text>/g)].map((t) => ({ x: Number(t[1]), y: Number(t[2]), anchor: t[3], text: t[4] }));
    return {
      x: line ? attr(line, 'x1') : null,
      straight: line ? attr(line, 'x1') === attr(line, 'x2') : null,
      // The head's first point is its tip; the other two are its base.
      tip: headPoints ? headPoints.split(' ')[0].split(',').map(Number) : null,
      base: headPoints ? Number(headPoints.split(' ')[1].split(',')[1]) : null,
      texts,
    };
  });
const reactionsOf = (form: BeamForm) => analyse(form).solution!.reactions;

describe('beam drawing: a reaction is an arrow on its support', () => {
  it('the example beam: each arrow on its support’s line, pointing up at it, the value on the inside', () => {
    const form = defaultBeam();
    const got = marks(draw(form, reactionsOf(form)));
    expect(got).toHaveLength(2);
    const [left, right] = got;
    // On the very x of the support — the apex of its triangle.
    expect(left.x).toBe(xToPx(0, form.L, WIDTH));
    expect(right.x).toBe(xToPx(form.L, form.L, WIDTH));
    for (const r of got) {
      expect(r.straight).toBe(true);
      expect(r.tip![0]).toBe(r.x);
      // Upward: the tip is above the base of the head.
      expect(r.tip![1]).toBeLessThan(r.base!);
    }
    // The value: no arrow character in it any more, and beside the arrow, towards the span.
    expect(left.texts.map((t) => t.text)).toEqual(['15.2']);
    expect(left.texts[0].anchor).toBe('start');
    expect(left.texts[0].x).toBeGreaterThan(left.x!);
    expect(right.texts.map((t) => t.text)).toEqual(['16.8']);
    expect(right.texts[0].anchor).toBe('end');
    expect(right.texts[0].x).toBeLessThan(right.x!);
  });

  it('a support inside the beam has its value to the right of its arrow', () => {
    const form: BeamForm = { ...defaultBeam(), L: 24, supports: [{ id: 1, kind: 'pin', x: 0 }, { id: 2, kind: 'roller', x: 16 }] };
    const got = marks(draw(form, reactionsOf(form)));
    expect(got[1].x).toBe(xToPx(16, 24, WIDTH));
    expect(got[1].texts[0].anchor).toBe('start');
  });

  it('the side is decided by where the support is, not by how long its number is', () => {
    // The last support of a beam: its value goes inside whether it is "16" or "1,234.5".
    const form = defaultBeam();
    for (const Rv of [16, 1234.5, 0.004]) {
      const [left, right] = marks(draw(form, [{ x: 0, kind: 'pin', Rv, Rm: 0 }, { x: 20, kind: 'roller', Rv, Rm: 0 }]));
      expect(left.texts[0].anchor, String(Rv)).toBe('start');
      expect(right.texts[0].anchor, String(Rv)).toBe('end');
    }
    // …at any width of the drawing.
    for (const width of [300, 330, 520, 760, 1200]) {
      const svg = renderToStaticMarkup(h(BeamSchematic, { form, reactions: [{ x: 0, kind: 'pin', Rv: 16, Rm: 0 }, { x: 20, kind: 'roller', Rv: 16, Rm: 0 }], width, probeX: null, summary: 'a beam' }));
      expect(marks(svg).map((r) => r.texts[0].anchor), String(width)).toEqual(['start', 'end']);
    }
  });

  it('a reaction that pulls down points down', () => {
    // An overhang loaded at its tip lifts the far support.
    const form: BeamForm = { ...defaultBeam(), L: 24, supports: [{ id: 1, kind: 'pin', x: 0 }, { id: 2, kind: 'roller', x: 16 }], dists: [], points: [{ id: 3, x: 24, P: 10, dir: 'down' }] };
    const reactions = reactionsOf(form);
    expect(reactions[0].Rv).toBeLessThan(0);
    const [left, right] = marks(draw(form, reactions));
    expect(left.tip![1]).toBeGreaterThan(left.base!);
    expect(right.tip![1]).toBeLessThan(right.base!);
    expect(left.texts[0].text).toBe('5');
    expect(right.texts[0].text).toBe('15');
  });

  it('a fixed support: the force by its arrow, and its moment under the force with the way it turns', () => {
    const form: BeamForm = { ...defaultBeam(), supports: [{ id: 1, kind: 'fixed', x: 0 }], dists: [], points: [{ id: 3, x: 20, P: 10, dir: 'down' }] };
    const [wall] = marks(draw(form, reactionsOf(form)));
    expect(wall.x).toBe(xToPx(0, form.L, WIDTH));
    expect(wall.texts.map((t) => t.text)).toEqual(['10', '↺ 200']);
    expect(wall.texts[1].y).toBeGreaterThan(wall.texts[0].y);
    expect(new Set(wall.texts.map((t) => `${t.x} ${t.anchor}`)).size).toBe(1);
  });

  it('no force, no arrow: the value alone, under the support', () => {
    const form = defaultBeam();
    const [left, right] = marks(draw(form, [{ x: 0, kind: 'pin', Rv: 0, Rm: 0 }, { x: 20, kind: 'roller', Rv: 32, Rm: 0 }]));
    expect(left.x).toBeNull();
    expect(left.tip).toBeNull();
    expect(left.texts).toEqual([expect.objectContaining({ text: '0', anchor: 'middle', x: xToPx(0, form.L, WIDTH) })]);
    expect(right.x).toBe(xToPx(20, form.L, WIDTH));
  });

  it('supports crowded together keep every arrow, and write only the values that fit', () => {
    const form: BeamForm = { ...defaultBeam(), supports: [{ id: 1, kind: 'pin', x: 0 }, { id: 2, kind: 'roller', x: 0.3 }, { id: 3, kind: 'roller', x: 0.6 }, { id: 4, kind: 'roller', x: 20 }] };
    const got = marks(draw(form, reactionsOf(form)));
    expect(got.filter((r) => r.x !== null)).toHaveLength(4);
    // What is written does not run into another value, nor into an arrow.
    const spans = got.flatMap((r) => r.texts.map((t) => (t.anchor === 'start' ? [t.x, t.x + t.text.length * 6.9] : [t.x - t.text.length * 6.9, t.x])));
    const arrows = got.map((r) => r.x!);
    for (const [a, b] of spans) {
      expect(a).toBeGreaterThanOrEqual(0);
      expect(b).toBeLessThanOrEqual(WIDTH);
      expect(arrows.filter((x) => x > a && x < b)).toEqual([]);
    }
    spans.sort((p, q) => p[0] - q[0]);
    for (let i = 1; i < spans.length; i++) expect(spans[i][0]).toBeGreaterThanOrEqual(spans[i - 1][1]);
    expect(spans.length).toBeLessThan(4);
  });

  it('before the beam is solved there is no reaction to draw', () => {
    expect(marks(draw(defaultBeam(), null))).toEqual([]);
  });
});
