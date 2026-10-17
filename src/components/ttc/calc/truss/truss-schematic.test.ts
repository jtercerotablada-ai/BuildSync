import { createElement as h } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { analyseSafely } from '@/lib/calc/truss/analysis';
import { defaultTruss, emptyTruss, reduceTruss, type TrussForm } from '@/lib/calc/truss/model';
import { TEMPLATE_IDS } from '@/lib/calc/truss/templates';
import { trussUi } from '@/lib/calc/truss/strings';
import { TrussSchematic, canDeform, forceText, trussLayout, wantedWidth, type Layout, type LayoutOptions, type Rect } from './TrussSchematic';

/**
 * THE TRUSS'S DRAWING — what is reckoned (`trussLayout`, held here without
 * React: where every line, symbol, arrow and number goes) and what is written
 * of it (`TrussSchematic`, as the server sends it).
 */

const OPTIONS: LayoutOptions = { width: 720, forces: true, numbers: false, deformed: false, group: ',' };
const drawingOf = (form: TrussForm) => analyseSafely(form).drawing;
const layoutOf = (form: TrussForm, over: Partial<LayoutOptions> = {}): Layout => trussLayout(drawingOf(form), { ...OPTIONS, ...over });
const template = (id: (typeof TEMPLATE_IDS)[number], units: 'us' | 'si' = 'us') => reduceTruss(units === 'us' ? defaultTruss() : reduceTruss(defaultTruss(), { type: 'units', units }), { type: 'template', template: id });
const show = (form: TrussForm, over: Record<string, unknown> = {}) =>
  renderToStaticMarkup(h(TrussSchematic, { drawing: drawingOf(form), width: 720, forces: true, numbers: false, deformed: false, group: ',', summary: 'A truss.', legend: trussUi.en.results.legend, ...over }));
const attr = (tag: string, name: string) => tag.match(new RegExp(` ${name}="([^"]*)"`))?.[1];

/** A truss with the beam's second node moved, so that nothing can be solved. */
const mechanism = (): TrussForm => {
  const f = defaultTruss();
  // Take away the first diagonal: the first panel of the Pratt is then a mechanism.
  const diagonals = f.members.slice(-4);
  return { ...f, members: f.members.filter((m) => m.id !== diagonals[0].id) };
};

describe('the layout of the example', () => {
  const layout = layoutOf(defaultTruss());

  it('has a shape for every member, node, support, load and reaction', () => {
    expect(layout.members).toHaveLength(17);
    expect(layout.nodes).toHaveLength(10);
    expect(layout.supports).toHaveLength(2);
    expect(layout.loads).toHaveLength(5);
    expect(layout.reactions).toHaveLength(2);
    expect(layout.members.map((m) => m.label)).toEqual(Array.from({ length: 17 }, (_, k) => k + 1));
  });

  it('is as wide as it was asked to be, and as tall as the truss and its margin are', () => {
    expect(layout.width).toBe(720);
    // 32 ft by 8 ft with a margin of 64 px all round (pixels, not a share of the truss): the truss fills the width less its margins.
    expect(layout.scale).toBeCloseTo((720 - 128) / 32, 3);
    expect(layout.height).toBeCloseTo(8 * layout.scale + 128, 3);
    // It stands in the middle of its width.
    const xs = layout.nodes.map((n) => n.x);
    expect((Math.min(...xs) + Math.max(...xs)) / 2).toBeCloseTo(360, 3);
  });

  it('draws y upward: a top node is above a bottom node on the page', () => {
    const at = (label: number) => layout.nodes.find((n) => n.label === label)!;
    expect(at(6).y).toBeLessThan(at(1).y);
    expect(at(2).x).toBeGreaterThan(at(1).x);
    // 8 ft of 17 ft + margin is the same fraction of the height as of the scale.
    expect(at(1).y - at(6).y).toBeCloseTo(8 * layout.scale, 3);
  });

  it('puts the pin under node 1 and the roller under node 5, both standing straight', () => {
    const [pin, roller] = layout.supports;
    expect([pin.node, pin.kind, roller.node, roller.kind]).toEqual([1, 'pin', 5, 'roller']);
    for (const s of layout.supports) {
      expect(s.side).toEqual({ x: 0, y: 1 });
      expect(s.rotation).toBe(0);
    }
    expect(roller.angle).toBe(90);
    expect(pin.angle).toBeNull();
    const n = (label: number) => layout.nodes.find((x) => x.label === label)!;
    expect([pin.x, pin.y]).toEqual([n(1).x, n(1).y]);
    expect([roller.x, roller.y]).toEqual([n(5).x, n(5).y]);
  });

  it('draws a load as an arrow whose head ends at its node and whose tail is above it', () => {
    for (const load of layout.loads) {
      const node = layout.nodes.find((n) => n.label === load.node)!;
      expect(load.tip.x).toBeCloseTo(node.x, 3);
      expect(load.tip.y).toBeLessThan(node.y);
      expect(load.tip.y).toBeGreaterThan(load.tail.y);
      expect(load.tail.x).toBeCloseTo(node.x, 3);
    }
    // 5 kip at the ends, 10 kip between: the ends' arrows are the shorter.
    const length = (a: (typeof layout.loads)[number]) => a.tip.y - a.tail.y;
    const sized = [...layout.loads].sort((p, q) => p.magnitude - q.magnitude);
    expect(sized.map((a) => a.text.value)).toEqual(['5', '5', '10', '10', '10']);
    expect(length(sized[0])).toBeLessThan(length(sized[4]));
    // The size is written by the tail, above it.
    for (const load of layout.loads) expect(load.text.y).toBeLessThan(load.tail.y);
  });

  it('draws each reaction under its support, pointing up at it, with its size', () => {
    for (const reaction of layout.reactions) {
      const support = layout.supports.find((s) => s.node === reaction.node)!;
      // Beyond the symbol, on its side of the node.
      expect(reaction.tip.y - support.y).toBeGreaterThan(support.depth);
      expect(reaction.tip.y - support.y).toBeLessThan(support.depth + 6);
      expect(reaction.tail.y).toBeGreaterThan(reaction.tip.y);
      expect(reaction.text.value).toBe('20');
      expect(reaction.tail.x).toBeCloseTo(support.x, 3);
    }
  });

  it('writes the signed force on each member, the true minus for a compression', () => {
    const text = (label: number) => layout.members.find((m) => m.label === label)!.text?.value;
    expect([text(1), text(2), text(5), text(6), text(14)]).toEqual(['0', '+15', '−15', '−20', '+21.21']);
  });

  it('weights and patterns each member by its state', () => {
    const m = (label: number) => layout.members.find((x) => x.label === label)!;
    expect(m(1).state).toBe('zero');
    expect(m(2).state).toBe('tension');
    expect(m(6).state).toBe('compression');
    // The thickest line is a largest force: 21.213 kip, the end diagonals.
    const widest = Math.max(...layout.members.map((x) => x.strokeWidth));
    expect(m(14).strokeWidth).toBe(widest);
    expect(m(14).strokeWidth).toBeCloseTo(9, 5);
    // A zero member is the thinnest, and has no core; a compression has one, narrower than its line and above zero; a tension has none.
    expect(m(1).strokeWidth).toBeLessThan(m(2).strokeWidth);
    expect(m(1).core).toBeNull();
    expect(m(2).core).toBeNull();
    expect(m(6).core).toBeGreaterThan(0);
    expect(m(6).core!).toBeLessThan(m(6).strokeWidth);
    // A bigger force is a heavier line.
    expect(m(6).strokeWidth).toBeGreaterThan(m(2).strokeWidth);
  });

  it('explains what it shows in its legend, and only that', () => {
    expect(layout.legend).toEqual(['tension', 'compression', 'zero', 'load', 'reaction', 'node']);
    expect(layoutOf(defaultTruss(), { deformed: true }).legend).toContain('deformed');
    expect(layoutOf(mechanism()).legend).toEqual(['unsolved', 'load', 'node']);
  });
});

describe('supports of every kind, at the right place and angle', () => {
  it('stands a roller against a wall on the left side of the node, turned a quarter', () => {
    const layout = layoutOf(template('cantilever'));
    const roller = layout.supports.find((s) => s.kind === 'roller')!;
    const pin = layout.supports.find((s) => s.kind === 'pin')!;
    expect(roller.angle).toBe(0);
    expect(roller.side).toEqual({ x: -1, y: 0 });
    expect(roller.rotation).toBe(90);
    // The pin stands out of the way of the members that meet at its node: not under it, where the post is.
    expect(pin.side.y).not.toBe(1);
    expect(pin.side).toEqual({ x: -1, y: 0 });
  });

  it('draws an inclined roller at its angle', () => {
    const form = reduceTruss(template('triangle'), { type: 'patch', list: 'supports', id: 0, patch: {} });
    const roller = form.supports.find((s) => s.kind === 'roller')!;
    for (const [angle, side, rotation] of [
      [45, { x: -Math.SQRT1_2, y: Math.SQRT1_2 }, 45],
      [135, { x: Math.SQRT1_2, y: Math.SQRT1_2 }, -45],
      [90, { x: 0, y: 1 }, 0],
      [0, { x: -1, y: 0 }, 90],
    ] as const) {
      const f = reduceTruss(form, { type: 'patch', list: 'supports', id: roller.id, patch: { angle } });
      const s = layoutOf(f).supports.find((x) => x.kind === 'roller')!;
      expect(s.angle).toBe(angle);
      expect(s.side.x).toBeCloseTo(side.x, 6);
      expect(s.side.y).toBeCloseTo(side.y, 6);
      expect(s.rotation).toBeCloseTo(rotation, 6);
    }
  });

  it('puts the reaction of an inclined roller on the line of its support, beyond the symbol', () => {
    const base = template('triangle');
    const roller = base.supports.find((s) => s.kind === 'roller')!;
    const f = reduceTruss(base, { type: 'patch', list: 'supports', id: roller.id, patch: { angle: 45 } });
    const layout = layoutOf(f);
    const s = layout.supports.find((x) => x.kind === 'roller')!;
    const r = layout.reactions.find((x) => x.node === s.node)!;
    const along = (r.tip.x - s.x) * s.side.x + (r.tip.y - s.y) * s.side.y;
    expect(along).toBeGreaterThan(s.depth);
  });

  it('draws nothing of a support for a node that has none, and a pin and a roller for the two-pin layout as two pins', () => {
    const layout = layoutOf(reduceTruss(defaultTruss(), { type: 'template', template: 'pratt', params: { supports: 'two-pins' } }));
    expect(layout.supports.map((s) => s.kind)).toEqual(['pin', 'pin']);
  });
});

describe('every template, in both unit systems, at every width', () => {
  for (const units of ['us', 'si'] as const) {
    for (const id of TEMPLATE_IDS) {
      it(`${id} (${units}) stays inside its box and prints no NaN`, () => {
        const form = template(id, units);
        for (const width of [280, 390, 720, 1200]) {
          const layout = layoutOf(form, { width, numbers: true });
          const within = (x: number, y: number, slack: number, what: string) => {
            expect(Number.isFinite(x) && Number.isFinite(y), `${what} is a number`).toBe(true);
            expect(x, `${id} ${width} ${what} x`).toBeGreaterThanOrEqual(-slack);
            expect(x, `${id} ${width} ${what} x`).toBeLessThanOrEqual(width + slack);
            expect(y, `${id} ${width} ${what} y`).toBeGreaterThanOrEqual(-slack);
            expect(y, `${id} ${width} ${what} y`).toBeLessThanOrEqual(layout.height + slack);
          };
          for (const n of layout.nodes) within(n.x, n.y, 0.01, 'node');
          for (const n of layout.nodes) {
            within(n.x - n.r, n.y - n.r, 0.01, 'node edge');
            within(n.x + n.r, n.y + n.r, 0.01, 'node edge');
          }
          for (const m of layout.members) {
            within(m.x1, m.y1, 0.01, 'member');
            within(m.x2, m.y2, 0.01, 'member');
            if (m.text) within(m.text.x, m.text.y, 18, 'member value');
          }
          for (const s of layout.supports) within(s.x + s.side.x * s.depth, s.y + s.side.y * s.depth, 1, 'support');
          for (const a of [...layout.loads, ...layout.reactions]) {
            within(a.tail.x, a.tail.y, 1, 'arrow tail');
            within(a.tip.x, a.tip.y, 1, 'arrow tip');
            within(a.text.x, a.text.y, 18, 'arrow value');
          }
          expect(layout.height).toBeLessThanOrEqual(560.01);
        }
      });
    }
  }
});

describe('a truss that cannot be solved', () => {
  it('draws its members plain, with no force, and rings the nodes that are part of the problem', () => {
    const form = mechanism();
    const a = analyseSafely(form);
    expect(a.results).toBeNull();
    const layout = trussLayout(a.drawing, { ...OPTIONS, flagged: [2, 7] });
    expect(layout.members).toHaveLength(16);
    expect(layout.members.every((m) => m.state === null && m.core === null && m.text === null)).toBe(true);
    expect(new Set(layout.members.map((m) => m.strokeWidth))).toEqual(new Set([2.5]));
    expect(layout.reactions).toEqual([]);
    expect(layout.nodes.filter((n) => n.flagged).map((n) => n.label)).toEqual([2, 7]);
    expect(layout.legend).toEqual(['unsolved', 'load', 'node', 'flagged']);
    const html = show(form, { flagged: [2, 7] });
    expect(html.match(/mp-truss-fig__ring/g)).toHaveLength(2 + 1 /* the legend's */);
  });

  it('draws what a model has, even a node with no member and a member to nowhere', () => {
    const f = reduceTruss(defaultTruss(), { type: 'add', list: 'nodes' });
    const bad = { ...f, nodes: [...f.nodes, { id: 99, x: Number.NaN, y: 3 }], supports: [...f.supports, { id: 98, node: 99, kind: 'pin' as const, angle: 90 }] };
    const html = show(bad);
    expect(html).not.toMatch(/NaN|undefined|Infinity/);
    // Eleven nodes with a place, and the legend's one.
    expect(html.match(/<g class="mp-truss-fig__node/g)).toHaveLength(11 + 1);
  });

  it('draws an empty case as an empty frame, not an error', () => {
    const layout = layoutOf(emptyTruss());
    expect(layout.members).toEqual([]);
    expect(layout.nodes).toEqual([]);
    expect(layout.legend).toEqual([]);
    expect(layout.height).toBeGreaterThan(0);
    const html = show(emptyTruss());
    expect(html).toContain('<svg');
    expect(html).not.toMatch(/NaN|undefined|Infinity/);
    expect(html).not.toContain('mp-truss-fig__legend');
  });

  it('draws one node, and two nodes with a member and nothing else', () => {
    const one = reduceTruss(emptyTruss(), { type: 'add', list: 'nodes' });
    expect(show(one)).not.toMatch(/NaN|undefined|Infinity/);
    expect(layoutOf(one).nodes).toHaveLength(1);
    let two = reduceTruss(one, { type: 'add', list: 'nodes' });
    two = reduceTruss(two, { type: 'add', list: 'members' });
    expect(layoutOf(two).members).toHaveLength(1);
    expect(show(two)).not.toMatch(/NaN|undefined|Infinity/);
  });
});

describe('the deformed shape', () => {
  it('is drawn between displaced nodes, by the scale the analysis gives, when it is asked for', () => {
    const form = defaultTruss();
    const drawing = drawingOf(form);
    expect(canDeform(drawing)).toBe(true);
    expect(layoutOf(form).deformed).toBeNull();
    const layout = layoutOf(form, { deformed: true });
    expect(layout.deformed!.members).toHaveLength(17);
    expect(layout.deformScale).toBe(drawing.deformScale);
    expect(layout.deformScale).toBeGreaterThan(1);
    // The roller end moves to the right under this load, so the deformed node 5 is right of node 5.
    const node5 = layout.nodes.find((n) => n.label === 5)!;
    const bottom = layout.deformed!.members.find((m) => m.label === 4)!; // member 4 ends at node 5
    expect(Math.max(bottom.x1, bottom.x2)).toBeGreaterThan(node5.x);
    // The largest displacement is a twelfth of the truss's larger side.
    const moved = drawing.nodes.map((n) => Math.hypot(n.ux! * drawing.deformScale!, n.uy! * drawing.deformScale!));
    expect(Math.max(...moved)).toBeCloseTo(32 / 12, 6);
  });

  it('is not offered without a section on every member, and not drawn for a truss that is not solved', () => {
    const noSection = { ...defaultTruss(), A: null };
    expect(canDeform(drawingOf(noSection))).toBe(false);
    expect(layoutOf(noSection, { deformed: true }).deformed).toBeNull();
    expect(canDeform(drawingOf(mechanism()))).toBe(false);
  });

  it('is in the markup as dashed lines, one to a member, and in the legend', () => {
    const html = show(defaultTruss(), { deformed: true });
    expect(html.match(/<line class="mp-truss-fig__deformed"/g)).toHaveLength(17 + 1);
    expect(html).toContain(trussUi.en.results.legend.deformed);
    expect(show(defaultTruss())).not.toContain(trussUi.en.results.legend.deformed);
  });
});

describe('the markup', () => {
  const html = show(defaultTruss());

  it('is one image with a text alternative, whose shapes a screen reader does not read', () => {
    const svg = html.match(/<svg class="mp-plot__svg mp-truss-fig__svg"[^>]*>/)![0];
    expect(attr(svg, 'role')).toBe('img');
    expect(attr(svg, 'aria-label')).toBe('A truss.');
    expect(attr(svg, 'viewBox')).toBe(`0 0 720 ${attr(svg, 'height')}`);
    expect(html).toContain('<g aria-hidden="true">');
  });

  it('has a member group and a target for each of the 17 members, marked by number', () => {
    expect([...html.matchAll(/ data-member="(\d+)"/g)].map((m) => Number(m[1]))).toEqual(Array.from({ length: 17 }, (_, k) => k + 1));
    expect(html.match(/class="mp-truss-fig__hit"/g)).toHaveLength(17);
    expect(html.match(/mp-truss-fig__member--tension/g)!.length).toBeGreaterThanOrEqual(6 + 1);
    expect(html.match(/mp-truss-fig__member--compression/g)!.length).toBeGreaterThanOrEqual(9 + 1);
    expect(html.match(/mp-truss-fig__member--zero/g)!.length).toBeGreaterThanOrEqual(2 + 1);
  });

  it('draws a compression twice, the second line the page’s colour, and a tension once', () => {
    const groups = [...html.matchAll(/<g class="mp-truss-fig__member mp-truss-fig__member--(\w+)[^"]*" data-member="\d+">([\s\S]*?)<\/g>/g)];
    expect(groups).toHaveLength(17);
    for (const [, state, body] of groups) expect(body.match(/<line/g)!.length, state).toBe(state === 'compression' ? 2 : 1);
    expect(groups.filter((g) => g[1] === 'compression')).toHaveLength(9);
    expect(groups.filter((g) => g[1] === 'tension')).toHaveLength(6);
    expect(groups.filter((g) => g[1] === 'zero')).toHaveLength(2);
  });

  it('numbers the nodes, and writes the sizes of the loads and the reactions', () => {
    expect([...html.matchAll(/<g class="mp-truss-fig__node[^"]*"><circle[^>]*><\/circle><text[^>]*>(\d+)<\/text>/g)].map((m) => m[1])).toEqual(['1', '2', '3', '4', '5', '6', '7', '8', '9', '10']);
    const loadSizes = [...html.matchAll(/<g class="mp-truss-fig__load">[\s\S]*?<text[^>]*>([^<]*)<\/text>/g)].map((m) => m[1]);
    expect(loadSizes.sort()).toEqual(['10', '10', '10', '5', '5']);
    const reactionSizes = [...html.matchAll(/<g class="mp-truss-fig__reaction">[\s\S]*?<text[^>]*>([^<]*)<\/text>/g)].map((m) => m[1]);
    expect(reactionSizes).toEqual(['20', '20']);
  });

  it('has a legend for exactly the marks drawn, each with a picture and its words', () => {
    const items = [...html.matchAll(/<li class="mp-truss-fig__key mp-truss-fig__key--(\w+)">[\s\S]*?<span>([^<]*)<\/span><\/li>/g)];
    const words = trussUi.en.results.legend;
    expect(items.map((m) => [m[1], m[2]])).toEqual([
      ['tension', words.tension],
      ['compression', words.compression],
      ['zero', words.zero],
      ['load', words.load],
      ['reaction', words.reaction],
      ['node', words.node],
    ]);
  });

  it('marks the member in focus on the drawing, and its two nodes', () => {
    const marked = show(defaultTruss(), { active: 6 });
    expect(marked).toContain('mp-truss-fig__halo');
    expect(marked.match(/mp-truss-fig__member--active/g)).toHaveLength(1);
    expect(marked.match(/mp-truss-fig__node--active/g)).toHaveLength(2);
    expect(html).not.toContain('mp-truss-fig__halo');
    // A member that is not there is marked nowhere.
    expect(show(defaultTruss(), { active: 99 })).not.toContain('mp-truss-fig__halo');
  });

  it('shows the member numbers when asked, with or without the forces', () => {
    const value = (src: string) => [...src.matchAll(/<text class="mp-truss-fig__value"[^>]*>([^<]*)<\/text>/g)].map((m) => m[1]);
    expect(value(show(defaultTruss(), { forces: true, numbers: true })).slice(0, 3)).toEqual(['1: 0', '2: +15', '3: +15']);
    expect(value(show(defaultTruss(), { forces: false, numbers: true })).slice(0, 3)).toEqual(['1', '2', '3']);
    expect(value(show(defaultTruss(), { forces: true, numbers: false })).slice(0, 3)).toEqual(['0', '+15', '+15']);
    expect(value(show(defaultTruss(), { forces: false, numbers: false }))).toEqual([]);
  });

  it('never prints a minus zero, NaN or an exponent that is noise, for any template', () => {
    for (const id of TEMPLATE_IDS) {
      const out = show(template(id), { numbers: true });
      expect(out, id).not.toMatch(/NaN|undefined|Infinity/);
      expect(out, id).not.toMatch(/[>\s"-]-0(?![.\d])/);
      expect(out, id).not.toMatch(/e[+-]\d/);
      expect(out, id).not.toContain('−0<');
    }
  });
});

describe('the forces as written', () => {
  it('signs a force, and writes a zero with none', () => {
    expect(forceText(15, ',')).toBe('+15');
    expect(forceText(-20, ',')).toBe('−20');
    expect(forceText(0, ',')).toBe('0');
    expect(forceText(-0, ',')).toBe('0');
    expect(forceText(21.21320343, ',')).toBe('+21.21');
    expect(forceText(1234.5678, ',')).toBe('+1,235');
    expect(forceText(1234.5678, ' ')).toBe('+1 235');
    expect(forceText(1e-14, ',')).toBe('0');
    expect(forceText(-3.5e-5, ',')).toBe('−3.5 × 10^−5');
  });
});

describe('a full-size truss', () => {
  it('lays out 40 nodes and 120 members, in a box, without a number out of place', () => {
    let form = template('warren-verticals');
    form = reduceTruss(form, { type: 'template', template: 'warren-verticals', params: { panels: 19 } });
    expect(form.nodes).toHaveLength(40);
    while (form.members.length < 120) {
      const next = reduceTruss(form, { type: 'add', list: 'members' });
      if (next === form) break;
      form = next;
    }
    expect(form.members.length).toBe(120);
    const layout = layoutOf(form, { numbers: true });
    expect(layout.nodes).toHaveLength(40);
    expect(layout.members).toHaveLength(120);
    expect(show(form, { numbers: true })).not.toMatch(/NaN|undefined|Infinity/);
  });
});

/* ═══ Review fixes: the words kept clear (C1–C8), the hollow cue (B6) ═══════ */

/** The same truss in X-braced bays: 19 bays of 10 ft is 40 nodes, 96 members. */
const braced = (bays = 19): TrussForm => {
  const base = defaultTruss();
  let id = 1;
  const nodes: TrussForm['nodes'] = [];
  const bottom: number[] = [];
  const top: number[] = [];
  for (let i = 0; i <= bays; i++) {
    nodes.push({ id, x: i * 10, y: 0 });
    bottom.push(id++);
  }
  for (let i = 0; i <= bays; i++) {
    nodes.push({ id, x: i * 10, y: 10 });
    top.push(id++);
  }
  const members: TrussForm['members'] = [];
  const add = (i: number, j: number) => members.push({ id: id++, i, j, A: null, E: null });
  for (let i = 0; i < bays; i++) {
    add(bottom[i], bottom[i + 1]);
    add(top[i], top[i + 1]);
    add(bottom[i], top[i + 1]);
    add(top[i], bottom[i + 1]);
  }
  for (let i = 0; i <= bays; i++) add(bottom[i], top[i]);
  const supports: TrussForm['supports'] = [
    { id: id++, node: bottom[0], kind: 'pin', angle: 90 },
    { id: id++, node: bottom[bays], kind: 'roller', angle: 90 },
  ];
  const loads: TrussForm['loads'] = top.map((node) => ({ id: id++, node, fx: 0, fy: -10 }));
  return { ...base, nodes, members, supports, loads, nextId: id };
};
/** A template stops at twice its span in depth; this one is 4 ft wide and 60 ft tall, as a visitor can make it by typing the nodes. */
const tall = (): TrussForm => {
  const f = pratt({ span: 4, height: 8, panels: 4, load: 10 });
  return { ...f, nodes: f.nodes.map((n) => ({ ...n, y: n.y * 7.5 })) };
};
const pratt = (params: Record<string, number>, units: 'us' | 'si' = 'us') => reduceTruss(units === 'us' ? defaultTruss() : reduceTruss(defaultTruss(), { type: 'units', units }), { type: 'template', template: 'pratt', params });

/** The distance from a point to a rectangle (0 inside it). */
const toRect = (x: number, y: number, r: Rect) => Math.hypot(Math.max(r.x0 - x, 0, x - r.x1), Math.max(r.y0 - y, 0, y - r.y1));
/** The least distance from a segment to a rectangle, by walking along the segment a pixel at a time: it shares no code with the layout. */
function gap(seg: { x1: number; y1: number; x2: number; y2: number }, r: Rect): number {
  if (Math.max(seg.x1, seg.x2) < r.x0 - 30 || Math.min(seg.x1, seg.x2) > r.x1 + 30 || Math.max(seg.y1, seg.y2) < r.y0 - 30 || Math.min(seg.y1, seg.y2) > r.y1 + 30) return Infinity;
  const length = Math.hypot(seg.x2 - seg.x1, seg.y2 - seg.y1);
  const steps = Math.max(1, Math.ceil(length));
  let best = Infinity;
  for (let i = 0; i <= steps; i++) best = Math.min(best, toRect(seg.x1 + ((seg.x2 - seg.x1) * i) / steps, seg.y1 + ((seg.y2 - seg.y1) * i) / steps, r));
  return best;
}

/**
 * EVERY WORD ON THE DRAWING IS CLEAR OF EVERYTHING: of every member's line (by its own half width), every node, every
 * support, every arrow and every other word, and inside the drawing. Returns what is not, as sentences.
 */
function crowding(layout: Layout, what: string): string[] {
  const words: { name: string; rect: Rect }[] = [];
  for (const m of layout.members) if (m.text) words.push({ name: `member ${m.label}`, rect: m.text.rect });
  for (const a of layout.loads) words.push({ name: `load ${a.label}`, rect: a.text.rect });
  for (const a of layout.reactions) words.push({ name: `reaction ${a.label}`, rect: a.text.rect });
  for (const d of layout.deformed?.nodes ?? []) if (d.tag) words.push({ name: `tag ${d.label}`, rect: d.tag.rect });
  const bad: string[] = [];
  for (const w of words) {
    const r = w.rect;
    if (r.x0 < 0 || r.y0 < 0 || r.x1 > layout.width || r.y1 > layout.height) bad.push(`${what}: ${w.name} leaves the drawing`);
    for (const m of layout.members) if (gap(m, r) < m.strokeWidth / 2 + 0.5) bad.push(`${what}: ${w.name} touches member ${m.label}`);
    for (const n of layout.nodes) if (toRect(n.x, n.y, r) < n.r) bad.push(`${what}: ${w.name} touches node ${n.label}`);
    for (const s of layout.supports) if (r.x0 < s.box.x1 && s.box.x0 < r.x1 && r.y0 < s.box.y1 && s.box.y0 < r.y1) bad.push(`${what}: ${w.name} on the support at node ${s.node}`);
    for (const a of [...layout.loads, ...layout.reactions]) if (gap({ x1: a.tail.x, y1: a.tail.y, x2: a.tip.x, y2: a.tip.y }, r) < 1.5) bad.push(`${what}: ${w.name} on an arrow of node ${a.node}`);
    for (const other of words) if (other !== w && r.x0 < other.rect.x1 && other.rect.x0 < r.x1 && r.y0 < other.rect.y1 && other.rect.y0 < r.y1) bad.push(`${what}: ${w.name} over ${other.name}`);
  }
  return bad;
}

describe('every word on the drawing is clear of every line, node, support, arrow and other word', () => {
  const cases: [string, TrussForm][] = [['example', defaultTruss()]];
  for (const units of ['us', 'si'] as const) for (const id of TEMPLATE_IDS) cases.push([`${id} ${units}`, template(id, units)]);
  cases.push(['pratt, 18 panels', pratt({ span: 144, height: 12, panels: 18, load: 5 })]);
  cases.push(['very flat (span 200, depth 1)', pratt({ span: 200, height: 1, panels: 8, load: 10 })]);
  cases.push(['very tall (span 4, depth 60)', tall()]);
  cases.push(['load 1e9', reduceTruss(defaultTruss(), { type: 'patch', list: 'loads', id: defaultTruss().loads[1].id, patch: { fy: -1e9 } })]);
  cases.push(['40 nodes, 96 members', braced()]);
  const roller = (angle: number) => {
    const f = defaultTruss();
    return reduceTruss(f, { type: 'patch', list: 'supports', id: f.supports.find((s) => s.kind === 'roller')!.id, patch: { angle } });
  };
  cases.push(['roller at 30°', roller(30)], ['roller at 45°', roller(45)], ['roller at 0°', roller(0)]);

  for (const [name, form] of cases) {
    it(`${name}: at 320, 390, 720 and 1200 px, with and without the numbers, and deformed`, () => {
      for (const width of [320, 390, 720, 1200]) {
        for (const [numbers, deformed] of [[false, false], [true, false], [true, true]] as const) {
          // As the page draws it: as wide as the column, or as wide as the words want.
          const drawn = wantedWidth(drawingOf(form), { forces: true, numbers, group: ',' }, width);
          const layout = layoutOf(form, { width: drawn, numbers, deformed });
          expect(crowding(layout, `${name} ${width}${numbers ? ' numbers' : ''}${deformed ? ' deformed' : ''}`)).toEqual([]);
        }
      }
    });
  }

  it('the checker itself sees a word on a line (it is not vacuous)', () => {
    const layout = layoutOf(defaultTruss());
    const m = layout.members[1];
    const forged: Layout = { ...layout, loads: [{ ...layout.loads[0], text: { ...layout.loads[0].text, rect: { x0: m.x1 + 5, y0: m.y1 - 6, x1: m.x1 + 40, y1: m.y1 + 6 } } }] };
    expect(crowding(forged, 'forged').some((s) => s.includes('touches member'))).toBe(true);
  });
});

describe('a dense truss thins its words, the largest force first', () => {
  const dense = braced();
  const drawing = drawingOf(dense);
  // As the page draws it: wider than a 733 px column, as wide as the words want.
  const drawn = wantedWidth(drawing, { forces: true, numbers: false, group: ',' }, 733);
  const layout = layoutOf(dense, { width: drawn });

  it('leaves off the words that have no clear place, and says how many', () => {
    expect(layout.members.length).toBe(96);
    const left = layout.members.filter((m) => m.text === null);
    expect(layout.thinned).toBe(left.length);
    expect(layout.thinned).toBeGreaterThan(10);
    expect(layout.thinned).toBeLessThan(96);
  });

  it('keeps the words of the members that carry the most', () => {
    const forces = drawing.members.map((m) => ({ label: m.label, size: Math.abs(m.force!) })).sort((p, q) => q.size - p.size);
    const shown = (label: number) => layout.members.find((m) => m.label === label)!.text !== null;
    // Of the ten heaviest, most are written; of the ten lightest, no more than of the ten heaviest.
    expect(forces.slice(0, 10).filter((f) => shown(f.label)).length).toBeGreaterThanOrEqual(7);
    expect(forces.slice(-10).filter((f) => shown(f.label)).length).toBeLessThanOrEqual(forces.slice(0, 10).filter((f) => shown(f.label)).length);
  });

  it('keeps the word of a thinned member for the moment it is picked, with its value', () => {
    const left = layout.members.filter((m) => m.text === null);
    expect(left.length).toBeGreaterThan(0);
    for (const m of left) {
      expect(m.spare, `member ${m.label}`).not.toBeNull();
      expect(m.spare!.value).toBe(forceText(drawing.members[m.label - 1].force!, ','));
    }
    expect(layout.members.filter((m) => m.text !== null).every((m) => m.spare === null)).toBe(true);
  });

  it('writes a picked member’s word on the drawing, and says how many are left off', () => {
    const left = layout.members.find((m) => m.text === null)!;
    const words = { thinned: trussUi.en.results.drawingNotes.thinned, scroll: trussUi.en.results.drawingNotes.scroll, region: trussUi.en.results.drawingNotes.region };
    const plain = show(dense, { width: drawn, widen: false, notes: words });
    expect(plain).toMatch(/\d+ labels are left off the drawing/);
    const picked = show(dense, { width: drawn, widen: false, notes: words, active: left.label });
    expect(picked.match(/mp-truss-fig__value--picked/g)).toHaveLength(1);
    expect(plain).not.toContain('mp-truss-fig__value--picked');
  });
});

describe('a drawing wide enough for its words', () => {
  const O = { forces: true, numbers: false, group: ',' };
  it('is as wide as its column when the panels are wide enough, and wider when they are not', () => {
    expect(wantedWidth(drawingOf(defaultTruss()), O, 720)).toBe(720);
    const many = drawingOf(pratt({ span: 144, height: 12, panels: 18, load: 5 }));
    const wide = wantedWidth(many, O, 390);
    expect(wide).toBeGreaterThan(390);
    expect(wide).toBeLessThanOrEqual(390 * 4);
    // Longer words want more room.
    expect(wantedWidth(many, { ...O, numbers: true }, 390)).toBeGreaterThanOrEqual(wide);
    // And never more than 4 columns, nor 2,600 px.
    expect(wantedWidth(drawingOf(braced()), O, 1200)).toBeLessThanOrEqual(2600);
    expect(wantedWidth(drawingOf(braced()), O, 280)).toBeLessThanOrEqual(1120);
  });

  it('is exactly the column on paper (it cannot scroll), and scrolls and says so on a screen', () => {
    const many = pratt({ span: 144, height: 12, panels: 18, load: 5 });
    const notes = { thinned: 'x', scroll: 'Scroll sideways.', region: 'Drawing, scrolls' };
    const screen = show(many, { width: 390, notes });
    expect(screen).toContain('mp-truss-fig__scroll mp-truss-fig__scroll--wide');
    expect(screen).toContain('role="group"');
    expect(screen).toContain('tabindex="0"');
    expect(screen).toContain('Scroll sideways.');
    expect(screen).toContain('aria-label="Drawing, scrolls"');
    expect(Number(attr(screen.match(/<svg class="mp-plot__svg[^>]*>/)![0], 'width'))).toBeGreaterThan(390);
    const paper = show(many, { width: 724, widen: false, notes });
    expect(attr(paper.match(/<svg class="mp-plot__svg[^>]*>/)![0], 'width')).toBe('724');
    expect(paper).not.toContain('role="group"');
    expect(paper).not.toContain('Scroll sideways.');
  });

  it('draws a very flat truss no taller than its margins and members need, and a very tall one no wider than it is', () => {
    const flat = layoutOf(pratt({ span: 200, height: 1, panels: 8, load: 10 }), { width: 1600 });
    expect(flat.height).toBeLessThan(230);
    const high = layoutOf(tall(), { width: 720 });
    expect(high.height).toBeLessThanOrEqual(560.01);
    const xs = high.nodes.map((n) => n.x);
    // 4 ft of a 60 ft depth, in a drawing at most 560 px tall: a few tens of pixels, not the width of the column.
    expect(Math.max(...xs) - Math.min(...xs)).toBeLessThan(40);
  });
});

describe('the cue that a line is hollow survives a small force (B6)', () => {
  it('leaves at least 2 px of the page showing through every compression, and a wall of 1.5 px each side, whatever its force', () => {
    // A load of 1e9 on one joint beside loads of 5 to 10: the light members have a weight near zero.
    let f = defaultTruss();
    f = reduceTruss(f, { type: 'patch', list: 'loads', id: f.loads[1].id, patch: { fy: -1e9 } });
    const layout = layoutOf(f);
    const compressed = layout.members.filter((m) => m.state === 'compression');
    expect(compressed.length).toBeGreaterThan(3);
    const widest = compressed.reduce((s, m) => Math.max(s, m.strokeWidth), 0);
    expect(Math.min(...compressed.map((m) => m.strokeWidth))).toBeLessThan(widest);
    for (const m of compressed) {
      expect(m.core!, `member ${m.label}`).toBeGreaterThanOrEqual(2 - 1e-9);
      expect((m.strokeWidth - m.core!) / 2, `member ${m.label}`).toBeGreaterThanOrEqual(1.5 - 1e-9);
    }
    for (const m of layout.members.filter((x) => x.state === 'tension')) expect(m.strokeWidth).toBeGreaterThanOrEqual(5 - 1e-9);
  });
});

describe('the deformed shape is marked and its scale is stated (C8)', () => {
  const form = defaultTruss();
  const layout = layoutOf(form, { deformed: true });
  it('marks every node that moved far enough to see, with its number', () => {
    const marked = layout.deformed!.nodes;
    expect(marked.length).toBeGreaterThanOrEqual(5);
    // The pin does not move: it is not marked.
    expect(marked.find((n) => n.label === 1)).toBeUndefined();
    expect(marked.filter((n) => n.tag !== null).length).toBeGreaterThanOrEqual(3);
    for (const n of marked) if (n.tag) expect(n.tag.value).toBe(String(n.label));
  });
  it('states how many times larger beside the swatch, and draws a diamond for each marked node', () => {
    const html = show(form, { deformed: true, group: ',' });
    expect(html).toMatch(new RegExp(`${trussUi.en.results.legend.deformed} ×[\\d.,]+`));
    expect(html.match(/<g class="mp-truss-fig__moved">/g)!.length).toBe(layout.deformed!.nodes.length + 1 /* the legend's */);
  });
});
