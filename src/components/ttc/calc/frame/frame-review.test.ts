import { createElement as h } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { beamStrings } from '@/lib/calc/beam/strings';
import { analyseSafely, type FrameAnalysis } from '@/lib/calc/frame/analysis';
import { defaultFrame, reduceFrame, type FrameForm, type FrameList } from '@/lib/calc/frame/model';
import { frameUi, sharedWords } from '@/lib/calc/frame/strings';
import type { TemplateId } from '@/lib/calc/frame/templates';
import { FNum, fieldSentences, pointThousands, refusedText, type FNumWords } from './FNum';
import { FrameCalculator } from './FrameCalculator';
import { FigureGuard, FrameSchematic, type FrameSchematicWords } from './FrameSchematic';
import { ampLimit, drawingFacts, figureWidth, frameLayout, roomWanted, type DiagramMode, type Looks } from './layout';
import { flaggedNodes, membersNeedingDepth, restartsRows } from './text';

vi.setConfig({ testTimeout: 120_000 });
afterEach(() => new Promise<void>((done) => setTimeout(done, 0)));

/**
 * Findings of the review of 2026-10-17 on the page: the figure (its room, its sizes, what it says, what it marks), what a number field says,
 * and the small rules of the form. Each test fails on the code of e026e4b. What only a browser can show is in the report that goes with this.
 */

const patchRow = (f: FrameForm, list: FrameList, k: number, patch: Record<string, unknown>) => reduceFrame(f, { type: 'patch', list, id: f[list][k].id, patch });
const tpl = (id: TemplateId, params: Record<string, number | boolean | string> = {}) => reduceFrame(defaultFrame(), { type: 'template', template: id, params });
const looks = (a: FrameAnalysis, mode: DiagramMode, over: Partial<Looks> = {}): Looks => ({
  mode: a.results ? mode : 'none',
  loads: true,
  reactions: true,
  values: true,
  nodeNumbers: true,
  memberNumbers: false,
  amp: 1,
  group: ',',
  extremes: frameUi.en.results.drawing.extremes,
  displacements: a.results?.displacements?.map((d) => ({ node: d.node, magnitude: d.magnitude })) ?? null,
  ...over,
});
const words: FrameSchematicWords = {
  legend: frameUi.en.results.legend,
  notes: frameUi.en.results.drawingNotes,
  scaleLine: frameUi.en.results.scaleLine,
  zeroDiagram: frameUi.en.results.zeroDiagram,
  broken: frameUi.en.results.drawing.broken,
  limited: frameUi.en.results.options.limited,
};
const units = { length: 'ft', moment: 'kip·ft', force: 'kip', displacement: 'in' };
const text = (html: string) => html.replace(/<[^>]+>/g, ' ').replace(/&#x27;/g, "'").replace(/\s+/g, ' ');

describe('C3 and B2: the note under the drawing names only what the page offers', () => {
  const six = analyseSafely(tpl('portal', { bays: 6, storeys: 6 }));
  const render = (canWiden: boolean | null) => renderToStaticMarkup(h(FrameSchematic, { drawing: six.drawing, width: 390, looks: looks(six, 'M'), summary: 's', words, units, canWiden }));
  it('where widening would not help, the note does not say “show every value”', () => {
    expect(text(render(false))).not.toMatch(/show every value/);
    expect(text(render(false))).toMatch(/Choose a member to read it, or use the tables below/);
  });
  it('while it is not known, and where it helps, the note is the one that names the switch', () => {
    expect(text(render(null))).toMatch(/show every value/);
    expect(text(render(true))).toMatch(/show every value/);
  });
  it('the page offers the switch from the same truth: the 6 × 6 portal at 390 px has values left off and nothing widens it, so its note has no switch', () => {
    const l = frameLayout(six.drawing, { ...looks(six, 'M'), width: figureWidth(six.drawing, looks(six, 'M'), 390, false).drawn });
    expect(l.thinned).toBeGreaterThan(0);
    expect(figureWidth(six.drawing, looks(six, 'M'), 390, true).widened).toBe(false);
  });
});

describe('C4: the figure has the room its bays need, a size its bays take, and one number for a run of equal loads', () => {
  const six = analyseSafely(tpl('portal', { bays: 6, storeys: 6 }));
  const example = analyseSafely(defaultFrame());
  it('six bays on a phone are drawn wider than the screen (and say so); the example is drawn as wide as its column', () => {
    expect(roomWanted(six.drawing, 'M', 1)).toBeGreaterThan(450);
    expect(figureWidth(six.drawing, looks(six, 'M'), 390, false).drawn).toBeGreaterThan(450);
    expect(figureWidth(example.drawing, looks(example, 'M'), 390, false).drawn).toBe(390);
    const html = renderToStaticMarkup(h(FrameSchematic, { drawing: six.drawing, width: 390, looks: looks(six, 'M'), summary: 's', words, units }));
    expect(html).toContain('mp-frame-fig__scroll--wide');
    expect(text(html)).toMatch(/drawing runs wider than the screen/);
    expect(renderToStaticMarkup(h(FrameSchematic, { drawing: example.drawing, width: 390, looks: looks(example, 'M'), summary: 's', words, units }))).not.toContain('scroll--wide');
  });
  it('a diagram is held to the bays: parallel members closer than their two diagrams are tall give a size under 1; an L, or one bay, gives room to spare', () => {
    expect(ampLimit(six.drawing, 'M')).toBeLessThan(1);
    expect(ampLimit(six.drawing, 'M')).toBeGreaterThanOrEqual(1 / 3);
    expect(ampLimit(example.drawing, 'M')).toBeGreaterThan(2);
    expect(ampLimit(analyseSafely(tpl('gable')).drawing, 'M')).toBeGreaterThan(2);
    expect(ampLimit(analyseSafely(tpl('l-frame')).drawing, 'M')).toBe(Infinity);
    expect(ampLimit(six.drawing, 'none')).toBe(Infinity);
    // The layout draws no larger than that, and says so on the scale line: the value of a length unit is for the size drawn.
    const cap = ampLimit(six.drawing, 'M');
    const l = frameLayout(six.drawing, { ...looks(six, 'M', { amp: 4 }), width: 900 });
    expect(l.ampUsed).toBeCloseTo(cap, 9);
    const standard = frameLayout(six.drawing, { ...looks(six, 'M', { amp: 1 }), width: 900 });
    expect(l.scaleValue! * l.ampUsed).toBeCloseTo(standard.scaleValue! * standard.ampUsed, 9);
    expect(text(renderToStaticMarkup(h(FrameSchematic, { drawing: six.drawing, width: 900, looks: looks(six, 'M', { amp: 4 }), summary: 's', words, units })))).toMatch(/Larger diagrams would run over the next bay/);
  });
  it('the 1.2 of six beams end to end is written once on each floor, not on every beam', () => {
    const l = frameLayout(six.drawing, { ...looks(six, 'M'), width: 900 });
    const written = l.memberLoads.filter((m) => m.text !== null);
    expect(written.length).toBeLessThanOrEqual(6);
    expect(written.length).toBeGreaterThanOrEqual(1);
    expect(l.memberLoads).toHaveLength(36);
    // A single beam keeps its number.
    expect(frameLayout(example.drawing, { ...looks(example, 'M'), width: 600 }).memberLoads.filter((m) => m.text !== null)).toHaveLength(1);
  });
});

describe('C6: a value that is the largest inside its member is told from the values at its ends', () => {
  const gable = analyseSafely(tpl('gable'));
  it('with the words, “max” (or “min”) comes before it; without them the value stands alone', () => {
    const withWords = frameLayout(gable.drawing, { ...looks(gable, 'M'), width: 900 });
    const labels = withWords.diagram!.labels;
    const inner = labels.filter((b) => b.kind === 'max' || b.kind === 'min');
    expect(inner.length).toBeGreaterThan(0);
    for (const b of inner) expect(b.value).toMatch(/^(max|min) [+−]/);
    for (const b of labels.filter((b) => b.kind === 'start' || b.kind === 'end')) expect(b.value).toMatch(/^[+−]?[\d]/);
    const plain = frameLayout(gable.drawing, { ...looks(gable, 'M', { extremes: undefined }), width: 900 });
    for (const b of plain.diagram!.labels) expect(b.value).not.toMatch(/^(max|min)/);
    expect(frameUi.es.results.drawing.extremes).toEqual({ max: 'máx', min: 'mín' });
  });
});

describe('C8: every mark is in the legend, and a load at a node is drawn as its components', () => {
  it('the deformed view names the thin frame before loading and the number beside a node, in place of the thick member', () => {
    const a = analyseSafely(defaultFrame());
    const l = frameLayout(a.drawing, { ...looks(a, 'deformed'), width: 700 });
    expect(l.legend).toContain('ghost');
    expect(l.legend).toContain('displacement');
    expect(l.legend).not.toContain('member');
    expect(frameLayout(a.drawing, { ...looks(a, 'M'), width: 700 }).legend).toContain('member');
    const html = text(renderToStaticMarkup(h(FrameSchematic, { drawing: a.drawing, width: 700, looks: looks(a, 'deformed'), summary: 's', words, units })));
    expect(html).toContain('The frame before loading');
    expect(html).toContain('Number beside a node: how far the node moves (in)');
  });
  it('a temperature mark is explained: ΔT and ∇, and the legend says what max and min are', () => {
    expect(frameUi.en.results.legend.temperature).toMatch(/ΔT.*∇/);
    expect(frameUi.es.results.legend.temperature).toMatch(/ΔT.*∇/);
    expect(frameUi.en.results.legend.positive).toMatch(/max or min/);
  });
  it('Fx 5 and Fy −20 at a node are two arrows with their own sizes, as a reaction is', () => {
    const f = reduceFrame(defaultFrame(), { type: 'add', list: 'loads', seed: { node: defaultFrame().nodes[3].id, fx: 5, fy: -20 } });
    const a = analyseSafely(f);
    const l = frameLayout(a.drawing, { ...looks(a, 'none'), width: 700 });
    const both = l.loads[1];
    expect(both.arrows).toHaveLength(2);
    expect(both.arrows.map((x) => x.text?.value).sort()).toEqual(['20', '5']);
    expect(l.loads[0].arrows).toHaveLength(1);
  });
  it('how far a support settles is said in a line under the drawing', () => {
    const f = patchRow(patchRow(defaultFrame(), 'supports', 0, { dy: -0.5, dx: 0.2 }), 'supports', 1, { kind: 'pin' });
    const html = text(renderToStaticMarkup(h(FrameCalculator, { t: sharedWords(beamStrings.en.ui), w: frameUi.en, initial: f })));
    expect(html).toContain('Settlements: the support at node 1 moves x +0.2 in, y −0.5 in.');
    const es = text(renderToStaticMarkup(h(FrameCalculator, { t: sharedWords(beamStrings.es.ui), w: frameUi.es, initial: f })));
    expect(es).toContain('Asentamientos: el apoyo del nudo 1 se mueve x +0.2 in, y −0.5 in.');
  });
});

describe('C10: nodes at one place are told apart, and a part that swings is marked', () => {
  it('two nodes on one place are drawn side by side, each with its own number', () => {
    const f = patchRow(defaultFrame(), 'nodes', 3, { x: 0, y: 10 });
    const a = analyseSafely(f);
    const l = frameLayout(a.drawing, { ...looks(a, 'none', { flagged: flaggedNodes(a) }), width: 700 });
    const [n3, n4] = [l.nodes[2], l.nodes[3]];
    expect(Math.hypot(n3.x - n4.x, n3.y - n4.y)).toBeGreaterThanOrEqual(2 * n3.r);
    expect(n3.flagged && n4.flagged).toBe(true);
  });
});

describe('C5: the place being read is marked on the drawing, and said in its corner', () => {
  const a = analyseSafely(defaultFrame());
  const render = (probe: { member: number; share: number } | null) =>
    renderToStaticMarkup(h(FrameSchematic, { drawing: a.drawing, width: 700, looks: looks(a, 'M'), summary: 's', words, units, probe, readout: 'Member 3, 5 ft from node 3: N = 1.' }));
  it('a ring on the member, the sentence over the figure, and the mark in the legend', () => {
    const html = render({ member: 3, share: 0.25 });
    expect(html).toContain('mp-frame-fig__station');
    expect(html).toContain('mp-frame-fig__readout');
    expect(text(html)).toContain('Member 3, 5 ft from node 3');
    expect(text(html)).toContain('The place being read, below the drawing');
  });
  it('nothing is marked, said or explained when nothing is being read', () => {
    const html = render(null);
    expect(html).not.toContain('mp-frame-fig__station');
    expect(html).not.toContain('mp-frame-fig__readout');
    expect(text(html)).not.toContain('The place being read');
  });
});

describe('C1: a fault in the figure is a line, not the end of the page', () => {
  it('the guard turns an error into the sentence and tries again when the drawing changes', () => {
    expect(FigureGuard.getDerivedStateFromError()).toEqual({ failed: true });
    const guard = new FigureGuard({ children: null, message: 'the drawing could not be built', reset: 1 });
    guard.state = { failed: true, at: 1 };
    const failed = guard.render() as { props: { children: string } };
    expect(failed.props.children).toBe('the drawing could not be built');
    // The same drawing: still failed. Another one: tried again.
    expect(FigureGuard.getDerivedStateFromProps({ reset: 1 }, { failed: true, at: 1 })).toBeNull();
    expect(FigureGuard.getDerivedStateFromProps({ reset: 2 }, { failed: true, at: 1 })).toEqual({ failed: false, at: 2 });
    expect(frameUi.en.results.drawing.failed).toMatch(/could not be built/);
    expect(frameUi.es.results.drawing.failed).toMatch(/No se pudo construir/);
  });
});

describe('B7, B6 and C12: what a number field says of a text that is not a number', () => {
  const numbers = beamStrings.en.ui.numbers;
  const w = frameUi.en.fieldWords;
  const format = (v: number) => String(v);
  const base = { typed: null, left: null, point: null, standing: true, value: 10, format, numbers, words: w };
  it('a field that holds no number (a member section left blank) says it stays empty when junk is typed, and after it is left', () => {
    const typing = fieldSentences({ ...base, standing: false, value: Number.NaN, typed: 'abc' });
    expect(typing.line).toBe('The field stays empty: “abc” is not a number.');
    expect(fieldSentences({ ...base, standing: false, value: Number.NaN, left: 'abc' }).line).toBe(typing.line);
    expect(fieldSentences({ ...base, standing: false, value: Number.NaN, typed: '' }).line).toBe(w.blankEmptied);
    // Where there is a value, the shared field's own sentence, with it.
    expect(fieldSentences({ ...base, typed: 'abc' }).line).toBe('“abc” is not a number: the value is still 10.');
  });
  it('the sentence a screen reader is told does not change with the text, so it is not read again at every key', () => {
    const live = (t: string) => fieldSentences({ ...base, typed: t }).live;
    expect(live('abc')).toBe(live('abcdef'));
    expect(live('abc')).toBe('That is not a number; 10 stays in use.');
    expect(live('abc')).not.toContain('abc');
    expect(fieldSentences({ ...base, typed: null }).live).toBe('');
    expect(fieldSentences({ ...base, standing: false, value: Number.NaN, typed: 'ab' }).live).toBe(fieldSentences({ ...base, standing: false, value: Number.NaN, typed: 'abcdefg' }).live);
  });
  it('the status region is on the page before it has anything to say', () => {
    const html = renderToStaticMarkup(h(FNum, { numbers, words: w, format, label: 'Area', unit: 'in²', value: Number.NaN, emptyIs: Number.NaN, onChange: () => undefined, placeholder: 'frame’s' }));
    expect(html).toMatch(/<span class="mp-frame__sr" role="status"><\/span>/);
    expect(html).not.toContain('mp-num__hint');
  });
  it('a point in a Spanish number is said to be read as the decimal mark, with the way to write thousands; the English page says nothing of it', () => {
    expect(pointThousands('1.000', ' ')).toEqual({ text: '1.000', grouped: '1000', value: '1.000' });
    expect(pointThousands('12.500', ' ')?.grouped).toBe('12500');
    expect(pointThousands('1.000', ',')).toBeNull();
    expect(pointThousands('0.125', ' ')).toBeNull();
    expect(pointThousands('1.25', ' ')).toBeNull();
    const es = frameUi.es.fieldWords;
    expect(fieldSentences({ ...base, words: es, numbers: beamStrings.es.ui.numbers, point: pointThousands('1.000', ' ') }).hint).toBe('«1.000» se lee como 1.000, porque aquí el punto es el decimal. Para miles, escriba 1000.');
  });
  it('a text that reads two ways is the shared field’s to say, not this one’s', () => {
    expect(refusedText('1,250', ' ', false)).toBeNull();
    expect(refusedText('abc', ',', false)).toBe('abc');
    expect(refusedText('', ',', true)).toBeNull();
    expect(refusedText('', ',', false)).toBe('');
  });
  it('every language has every sentence', () => {
    for (const lang of ['en', 'es'] as const) for (const key of Object.keys(frameUi.en.fieldWords) as (keyof FNumWords)[]) expect(frameUi[lang].fieldWords[key].length).toBeGreaterThan(10);
  });
});

describe('B6: a line that tells what happened is on the page before it has anything to tell', () => {
  it('the warnings are there, empty and hidden, when there are none', () => {
    const html = renderToStaticMarkup(h(FrameCalculator, { t: sharedWords(beamStrings.en.ui), w: frameUi.en }));
    expect(html).toContain('class="mp-frame__warnings" role="status" data-empty="true"');
    const cold = renderToStaticMarkup(h(FrameCalculator, { t: sharedWords(beamStrings.en.ui), w: frameUi.en, initial: { ...defaultFrame(), nodes: defaultFrame().nodes } }));
    expect(cold).toContain('role="status"');
  });
  it('a warning fills the region that was there', () => {
    const f = reduceFrame(reduceFrame(defaultFrame(), { type: 'patch', list: 'memberLoads', id: defaultFrame().memberLoads[0].id, patch: { kind: 'temperature' } }), { type: 'patch', list: 'memberLoads', id: defaultFrame().memberLoads[0].id, patch: { alpha: 0 } });
    const html = renderToStaticMarkup(h(FrameCalculator, { t: sharedWords(beamStrings.en.ui), w: frameUi.en, initial: f }));
    expect(html).toMatch(/class="mp-frame__warnings" role="status"><p class="mp-app__issues-title">/);
    expect(text(html)).toContain('The temperature change on member 3 has an expansion coefficient α of 0, so it has no effect.');
  });
});

describe('B9, C13: the small rules of the form', () => {
  it('a template, a start over, an opened link and a cleared frame number the rows from 1 again; an edit does not', () => {
    for (const type of ['template', 'reset', 'load', 'clear']) expect(restartsRows(type)).toBe(true);
    for (const type of ['patch', 'add', 'remove', 'units', 'section', 'material', 'preset']) expect(restartsRows(type)).toBe(false);
  });
  it('a shape puts the section depth into the members whose gradient asks for it', () => {
    let f = reduceFrame(defaultFrame(), { type: 'add', list: 'memberLoads', seed: { kind: 'temperature', member: defaultFrame().members[2].id } });
    f = patchRow(f, 'memberLoads', f.memberLoads.length - 1, { dTg: 20 });
    expect(membersNeedingDepth(f, 'frame')).toEqual([f.members[2].id]);
    expect(membersNeedingDepth(f, f.members[2].id)).toEqual([f.members[2].id]);
    expect(membersNeedingDepth(f, f.members[0].id)).toEqual([]);
    // A member that has its own depth, or its own section, is left alone when the shape goes to the frame.
    expect(membersNeedingDepth(patchRow(f, 'members', 2, { h: 14 }), 'frame')).toEqual([]);
    expect(membersNeedingDepth(patchRow(f, 'members', 2, { A: 9 }), 'frame')).toEqual([]);
    expect(membersNeedingDepth(defaultFrame(), 'frame')).toEqual([]);
  });
});

describe('B1 and B14: what a key costs on the 6 × 6 portal (49 nodes, 78 members), the pure parts of it', () => {
  const six = tpl('portal', { bays: 6, storeys: 6 });
  it('a key changes one row of the form and hands every other back as it was: that is what lets a row be skipped', () => {
    const after = patchRow(six, 'nodes', 3, { x: 20.1 });
    expect(after.nodes.filter((n, k) => n !== six.nodes[k])).toHaveLength(1);
    expect(after.members.every((m, k) => m === six.members[k])).toBe(true);
    expect(after.supports.every((x, k) => x === six.supports[k])).toBe(true);
    expect(after.loads.every((x, k) => x === six.loads[k])).toBe(true);
    expect(after.memberLoads.every((x, k) => x === six.memberLoads[k])).toBe(true);
  });
  it('analysis and the figure, in every diagram and at the width of a phone and of a desktop, are a few tenths of a second a key (the figure alone was most of it)', () => {
    const timeIt = (mode: DiagramMode, width: number) => {
      const t0 = performance.now();
      const a = analyseSafely(patchRow(six, 'nodes', 3, { x: 20 + Math.random() }));
      const t1 = performance.now();
      const lk = looks(a, mode);
      const f = figureWidth(a.drawing, lk, width, false);
      frameLayout(a.drawing, { ...lk, width: f.drawn });
      return [t1 - t0, performance.now() - t1];
    };
    const costs: number[] = [];
    for (const mode of ['M', 'V', 'N', 'deformed'] as DiagramMode[]) for (const width of [390, 720]) costs.push(...timeIt(mode, width).slice(1));
    const worst = Math.max(...costs);
    // The review measured 390 to 440 ms for this layout at 390 px (M); a loaded machine is given a wide margin over what it takes now (some 60 ms).
    expect(worst).toBeLessThan(300);
  });
  it('the facts the page needs at once do not search over widths: that question is asked after a pause', () => {
    const a = analyseSafely(six);
    const t0 = performance.now();
    drawingFacts(a.drawing, looks(a, 'M'), 390, false);
    const quick = performance.now() - t0;
    expect(drawingFacts(a.drawing, looks(a, 'M'), 390, false).every).toBe(false);
    expect(quick).toBeLessThan(300);
  });
  it('rows added are free ones in every kind of frame, from every start: no node on another, no point load on another on its member', () => {
    for (const id of ['portal', 'gable', 'l-frame', 'cantilever-column', 'beam-on-columns', 'two-hinged'] as TemplateId[]) {
      let f = tpl(id);
      for (let k = 0; k < 6; k++) f = reduceFrame(f, { type: 'add', list: 'nodes' });
      expect(new Set(f.nodes.map((n) => `${n.x},${n.y}`)).size, id).toBe(f.nodes.length);
      for (let k = 0; k < 4; k++) f = reduceFrame(f, { type: 'add', list: 'memberLoads', seed: { kind: 'point', member: f.members[0].id } });
      const same = f.memberLoads.filter((l) => l.kind === 'point' && l.member === f.members[0].id);
      expect(new Set(same.map((l) => l.a)).size, id).toBe(same.length);
      // The solved frame has no fault from the rows that were added (the new nodes have no member: that is the one fault, named once).
      const codes = analyseSafely(f).issues.map((i) => i.code);
      expect(codes.every((c) => c === 'node-unconnected' || c === 'load-position'), `${id} ${codes}`).toBe(true);
    }
  });
});
