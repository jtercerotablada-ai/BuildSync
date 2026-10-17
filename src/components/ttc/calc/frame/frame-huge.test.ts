import { createElement as h } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { beamStrings } from '@/lib/calc/beam/strings';
import { analyseSafely, type FrameAnalysis } from '@/lib/calc/frame/analysis';
import { defaultFrame, reduceFrame, type FrameForm, type FrameList } from '@/lib/calc/frame/model';
import { frameUi, sharedWords } from '@/lib/calc/frame/strings';
import { TEMPLATE_IDS, type TemplateId } from '@/lib/calc/frame/templates';
import { FrameCalculator } from './FrameCalculator';
import { drawingFacts, everyWidth, frameLayout, type DiagramMode, type Looks } from './layout';

vi.setConfig({ testTimeout: 180_000 });
afterEach(() => new Promise<void>((done) => setTimeout(done, 0)));

/**
 * THE PAGE IS TOTAL: a number of any size in any field (1e17 froze a tab for twelve seconds, 1e25 for good, a number of forty digits
 * crashed it with "Invalid array length" and the visitor's work was lost). The figure is built for every one, in a bounded time, and
 * the page either solves the frame or says what is wrong with it.
 */

const HUGE = [1e15, 1e16, 1e17, 1e18, 1e25, 1e30, 1e100, 1e300, 1.7e308, Number('12345678901234567890123456789012345678901234567890'), -1e17, -1e300];
const MODES: DiagramMode[] = ['none', 'M', 'V', 'N', 'deformed'];
const looksFor = (a: FrameAnalysis, mode: DiagramMode, over: Partial<Looks> = {}): Looks => ({
  mode: a.results ? mode : 'none',
  loads: true,
  reactions: true,
  values: true,
  nodeNumbers: true,
  memberNumbers: true,
  amp: 1,
  group: ',',
  flagged: [],
  displacements: a.results?.displacements ? a.results.displacements.map((d) => ({ node: d.node, magnitude: d.magnitude })) : null,
  ...over,
});

const patchRow = (f: FrameForm, list: FrameList, k: number, patch: Record<string, unknown>) => reduceFrame(f, { type: 'patch', list, id: f[list][k].id, patch });

/** Every numeric field of a frame that has one of each. */
function fieldsFrame(): FrameForm {
  let f = defaultFrame();
  f = reduceFrame(f, { type: 'add', list: 'memberLoads', seed: { kind: 'trapezoid' } });
  for (const kind of ['point', 'moment', 'temperature', 'udl-projected'] as const) f = reduceFrame(f, { type: 'add', list: 'memberLoads', seed: { kind } });
  f = reduceFrame(f, { type: 'add', list: 'supports', seed: {} });
  return f;
}
const FIELDS: { list: FrameList; key: string; row: number }[] = [
  { list: 'nodes', key: 'x', row: 1 },
  { list: 'nodes', key: 'y', row: 2 },
  { list: 'nodes', key: 'x', row: 3 },
  { list: 'members', key: 'A', row: 0 },
  { list: 'members', key: 'I', row: 1 },
  { list: 'members', key: 'E', row: 2 },
  { list: 'members', key: 'h', row: 2 },
  { list: 'supports', key: 'angle', row: 0 },
  { list: 'supports', key: 'kx', row: 0 },
  { list: 'supports', key: 'ky', row: 1 },
  { list: 'supports', key: 'kr', row: 1 },
  { list: 'supports', key: 'dx', row: 0 },
  { list: 'supports', key: 'dy', row: 1 },
  { list: 'supports', key: 'dr', row: 0 },
  { list: 'loads', key: 'fx', row: 0 },
  { list: 'loads', key: 'fy', row: 0 },
  { list: 'loads', key: 'm', row: 0 },
  { list: 'memberLoads', key: 'w', row: 0 },
  { list: 'memberLoads', key: 'w', row: 1 },
  { list: 'memberLoads', key: 'w2', row: 1 },
  { list: 'memberLoads', key: 'a', row: 1 },
  { list: 'memberLoads', key: 'b', row: 1 },
  { list: 'memberLoads', key: 'P', row: 2 },
  { list: 'memberLoads', key: 'a', row: 2 },
  { list: 'memberLoads', key: 'M', row: 3 },
  { list: 'memberLoads', key: 'a', row: 3 },
  { list: 'memberLoads', key: 'dT', row: 4 },
  { list: 'memberLoads', key: 'dTg', row: 4 },
  { list: 'memberLoads', key: 'alpha', row: 4 },
  { list: 'memberLoads', key: 'w', row: 5 },
];

function figures(a: FrameAnalysis, widths = [320, 700]): number {
  const t0 = Date.now();
  for (const mode of MODES) {
    for (const width of widths) {
      const looks = looksFor(a, mode);
      const facts = drawingFacts(a.drawing, looks, width);
      const l = frameLayout(a.drawing, { ...looks, width });
      expect(Number.isFinite(l.height), `height ${mode} ${width}`).toBe(true);
      expect(l.height).toBeLessThan(5000);
      expect(l.placed.length).toBeLessThan(5000);
      for (const m of l.members) for (const v of [m.x1, m.y1, m.x2, m.y2]) expect(Number.isFinite(v)).toBe(true);
      if (facts.every) expect(everyWidth(a.drawing, looks, width).width).toBeLessThanOrEqual(6000);
    }
  }
  return Date.now() - t0;
}

describe('a number of any size in any field', () => {
  it('every numeric field, 1e15 to 1e308 and forty digits: the page solves the frame or says what is wrong, and the figure is built in a moment', () => {
    const base = fieldsFrame();
    let worst = 0;
    for (const field of FIELDS) {
      for (const v of HUGE) {
        const form = patchRow(base, field.list, field.row, { [field.key]: v });
        const a = analyseSafely(form);
        // Either solved (every number finite), or the reasons are listed.
        if (a.results) expect(JSON.stringify(a.results)).not.toMatch(/null.*NaN|NaN|Infinity/);
        else expect(a.issues.length, `${field.list}.${field.key}[${field.row}] = ${v}`).toBeGreaterThan(0);
        worst = Math.max(worst, figures(a, [390]));
      }
    }
    expect(worst).toBeLessThan(2000);
  });

  it('the template group: width, height, rise, gravity, lateral and axial of every template, 1e15 to 1e308 and forty digits', () => {
    let worst = 0;
    for (const id of TEMPLATE_IDS as TemplateId[]) {
      for (const key of ['width', 'height', 'rise', 'gravity', 'lateral', 'axial'] as const) {
        for (const v of HUGE) {
          const form = reduceFrame(defaultFrame(), { type: 'template', template: id, params: { [key]: v } });
          const a = analyseSafely(form);
          expect(a.results !== null || a.issues.length > 0, `${id} ${key} ${v}`).toBe(true);
          worst = Math.max(worst, figures(a, [390]));
        }
      }
    }
    expect(worst).toBeLessThan(2000);
  });

  it('the whole page, rendered, for a huge coordinate, load and template: no NaN or Infinity in it and a sentence for the visitor', () => {
    const show = (f: FrameForm) => renderToStaticMarkup(h(FrameCalculator, { t: sharedWords(beamStrings.en.ui), w: frameUi.en, initial: f }));
    const forms = [
      patchRow(defaultFrame(), 'nodes', 1, { x: 1e17 }),
      patchRow(defaultFrame(), 'nodes', 1, { x: Number('1' + '0'.repeat(39)) }),
      patchRow(defaultFrame(), 'nodes', 3, { y: 1e300 }),
      patchRow(defaultFrame(), 'loads', 0, { fx: 1e300 }),
      patchRow(defaultFrame(), 'memberLoads', 0, { w: -1e300 }),
      reduceFrame(defaultFrame(), { type: 'template', template: 'portal', params: { width: 1e17 } }),
      reduceFrame(defaultFrame(), { type: 'template', template: 'gable', params: { width: 1e300, rise: 1e300 } }),
    ];
    for (const f of forms) {
      const t0 = Date.now();
      const html = show(f);
      expect(Date.now() - t0).toBeLessThan(3000);
      expect(html.replace(/<(script|style)\b[\s\S]*?<\/\1>/g, '')).not.toMatch(/NaN|Infinity|undefined|\[object/);
      expect(html).toContain('mp-frame-fig');
    }
  });
});

describe('the layout is total', () => {
  it('a drawing whose extent is not a finite size is an empty, flagged layout; any finite one is scaled into the page', () => {
    const a = analyseSafely(patchRow(defaultFrame(), 'nodes', 1, { x: 1e308 }));
    const broken = patchRow(patchRow(defaultFrame(), 'nodes', 1, { x: 1.7e308 }), 'nodes', 0, { x: -1.7e308 });
    const b = analyseSafely(broken);
    const lb = frameLayout(b.drawing, { ...looksFor(b, 'M'), width: 600 });
    expect(lb.broken || lb.members.every((m) => Number.isFinite(m.x1))).toBe(true);
    const la = frameLayout(a.drawing, { ...looksFor(a, 'M'), width: 600 });
    for (const n of la.nodes) {
      expect(n.x).toBeGreaterThanOrEqual(-1);
      expect(n.x).toBeLessThanOrEqual(601);
    }
    expect(frameLayout(a.drawing, { ...looksFor(a, 'M'), width: Number.NaN }).broken).toBe(true);
    expect(frameLayout(a.drawing, { ...looksFor(a, 'M'), width: -5 }).broken).toBe(true);
  });
});
