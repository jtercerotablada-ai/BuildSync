import { createElement as h } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import { analyseSafely } from '@/lib/calc/stiffness/analysis';
import { emptyStiffness, reduceStiffness } from '@/lib/calc/stiffness/model';
import { stiffnessUi } from '@/lib/calc/stiffness/strings';
import { HIGHLIGHT_REASONS } from '@/lib/calc/stiffness/codes';
import type { Step } from '@/lib/calc/stiffness/types';
import { MatrixTable, heldColumn, markWord, type MatrixForm } from './MatrixTable';
import { stepBody, type StepContext } from './steps';
import type { TableModel } from './table';
import type { ZeroStyle } from './numfmt';

vi.setConfig({ testTimeout: 120_000 });

/**
 * THE MARKS ON THE MATRICES, as a reader who cannot see them gets them, and the blocks of a partition: a mark is a word in its cell as well as a
 * pattern (so that it is not lost in forced colors or to a screen reader), the names of the blocks stand in rows of their own, and the held columns
 * are marked as the held rows are.
 */

const portal = reduceStiffness(emptyStiffness('us'), { type: 'template', template: 'frame-portal' });
const analysis = analyseSafely(portal);
const steps = analysis.solution!.steps;
const w = stiffnessUi.en;
const ctx: StepContext = { w, system: 'us', mode: 'frame', format: { sig: 4, style: 'auto', group: ',' } };

const modelsOf = (step: Step): TableModel[] => stepBody(step, ctx).flatMap((i) => (i.kind === 'table' ? [i.model] : []));
const html = (model: TableModel, o: { form?: MatrixForm; zeros?: ZeroStyle; bands?: number | null; lang?: 'en' | 'es' } = {}) =>
  renderToStaticMarkup(h(MatrixTable, { model, form: o.form ?? 'both', zeros: o.zeros ?? 'light', w: stiffnessUi[o.lang ?? 'en'], bands: o.bands ?? null }));
const srOf = (markup: string) => [...markup.matchAll(/<span class="mp-st__sr">([^<]*)<\/span>/g)].map((m) => m[1].trim());

describe('every mark is a word in its cell', () => {
  it('has a word for every reason a cell can be marked for, in both languages, with no hole but the members of a shared cell', () => {
    for (const lang of ['en', 'es'] as const) {
      for (const reason of HIGHLIGHT_REASONS) {
        const word = markWord(reason, [1, 3], stiffnessUi[lang]);
        expect(word.length, `${lang} ${reason}`).toBeGreaterThan(3);
        expect(word, `${lang} ${reason}`).not.toMatch(/\{|undefined/);
      }
    }
    expect(markWord('shared', [2, 5], w)).toBe('shared by members 2, 5');
    expect(markWord('pivot', null, w)).toBe('pivot');
  });

  it('the assembled K says which members a shared cell came from, and a cell that is not marked says nothing', () => {
    const assembled = steps.find((s) => s.id === 'assembled')!;
    const [K] = modelsOf(assembled);
    const out = html(K);
    const words = srOf(out);
    expect(words.some((x) => /^shared by members \d+(, \d+)+$/.test(x))).toBe(true);
    expect(words.some((x) => x === 'written by a member')).toBe(true);
    // Every marked cell carries its word, and no cell without a mark carries one.
    const marked = [...out.matchAll(/<td[^>]*data-hl="([^"]+)"[^>]*>(<span class="mp-st__sr">[^<]*<\/span>)?/g)];
    expect(marked.length).toBeGreaterThan(5);
    for (const m of marked) expect(m[2], m[1]).toBeDefined();
    const plain = [...out.matchAll(/<td(?![^>]*data-hl)[^>]*>(<span class="mp-st__sr">)?/g)].filter((m) => m[1]);
    expect(plain).toEqual([]);
  });

  it('an elimination step says which cell is the pivot, which entries were made zero and which changed', () => {
    const pass = steps.find((s) => s.id === 'forward-pass')!;
    const out = html(modelsOf(pass).find((m) => m.legend.includes('pivot'))!);
    const words = srOf(out);
    expect(words).toContain('pivot');
    expect(words.some((x) => x.startsWith('made zero'))).toBe(true);
    expect(words.some((x) => x.startsWith('changed'))).toBe(true);
  });

  it('a held DOF is said on its row head, in a vector and in a partition', () => {
    const structure = steps.find((s) => s.id === 'structure')!;
    const out = html(modelsOf(structure).find((m) => m.rowMarks.some(Boolean))!);
    expect(out).toMatch(/<th scope="row" class="mp-st__rowmark mp-st__rowmark--restrained" data-mark="restrained"><span class="mp-st__sr">held <\/span>1x<\/th>/);
  });
});

describe('the blocks of a partition', () => {
  const partition = steps.find((s) => s.id === 'partition')!;
  const [K, loads] = modelsOf(partition);
  const out = html(K);

  it('are named in a row of their own over each group of rows - K_FF and K_FR over the free rows, K_RF and K_RR over the held ones - and never inside a cell', () => {
    expect(K.split).not.toBeNull();
    const rows = [...out.matchAll(/<tr class="mp-st__blockrow( mp-st__cut-row)?" aria-hidden="true">([\s\S]*?)<\/tr>/g)];
    expect(rows).toHaveLength(2);
    const names = rows.map((r) => [...r[2].matchAll(/<td colSpan="(\d+)" class="mp-st__blockname[^"]*">([\s\S]*?)<\/td>/g)].map((c) => c[2].replace(/<[^>]+>/g, '')));
    expect(names).toEqual([['KFF', 'KFR'], ['KRF', 'KRR']]);
    // Only the held group's row carries the heavy line (it is where the partition cuts), and the spans are the blocks' own widths.
    expect(rows.map((r) => Boolean(r[1]))).toEqual([false, true]);
    const free = K.split!.cols;
    const spans = [...rows[0][2].matchAll(/colSpan="(\d+)"/g)].map((m) => Number(m[1]));
    expect(spans).toEqual([free, K.colHeads.length - free]);
    // No cell carries a name any more: nothing is pushed down inside a number's cell.
    expect(out).not.toContain('mp-st__named');
    expect(out).not.toContain('mp-st__block"');
    expect(out).toMatch(/<tbody><tr class="mp-st__blockrow"/);
  });

  it('keep the rows of numbers whole: every data row has one cell for each column, whatever is above it', () => {
    const dataRows = [...out.matchAll(/<tr><th scope="row"[\s\S]*?<\/tr>/g)];
    expect(dataRows).toHaveLength(K.rowLabels.length);
    for (const r of dataRows) expect((r[0].match(/<td/g) ?? []).length).toBe(K.colHeads.length);
  });

  it('the loads table of the partition names P_F and P_R the same way, over its two groups of rows', () => {
    const o = html(loads);
    const rows = [...o.matchAll(/<tr class="mp-st__blockrow( mp-st__cut-row)?" aria-hidden="true">([\s\S]*?)<\/tr>/g)];
    expect(rows.map((r) => r[2].replace(/<[^>]+>/g, ''))).toEqual(['PF', 'PR']);
  });

  it('mark the held COLUMNS as the held rows are marked (their heads are hatched and say "held")', () => {
    const held = K.colHeads.map((_, c) => heldColumn(K, c));
    expect(held.filter(Boolean)).toHaveLength(K.rowLabels.length - K.split!.cols);
    expect(held.slice(0, K.split!.cols).some(Boolean)).toBe(false);
    const heads = [...out.matchAll(/<th scope="col"([^>]*)>/g)].map((m) => m[1]);
    expect(heads.filter((a) => /data-mark="restrained"/.test(a))).toHaveLength(held.filter(Boolean).length);
    // Not a table that is not a partition, nor a vector.
    expect(heldColumn({ split: null, colHeads: ['a', 'b'], rowLabels: ['x', 'y'] }, 1)).toBe(false);
    expect(heldColumn({ split: { rows: 1, cols: 0, names: ['P_F', '', 'P_R', ''] }, colHeads: ['P', 'u'], rowLabels: ['1', '2'] }, 1)).toBe(false);
  });
});

describe('a table that scrolls is a tab stop, and one that does not is not', () => {
  it('the server draws no tab stop on a table (it cannot know whether the table overflows): the browser adds one where there is something to scroll', () => {
    const [K] = modelsOf(steps.find((s) => s.id === 'assembled')!);
    const out = html(K);
    expect(out).toMatch(/<div class="mp-st__scroll" role="group" aria-labelledby="[^"]+">/);
    expect(out).not.toContain('tabindex');
  });
});

describe('a large table on paper is cut into bands as even as can be', () => {
  it('bands of the most the sheet takes, each under the same row labels, covering every column once', () => {
    const [K] = modelsOf(steps.find((s) => s.id === 'assembled')!);
    const wide = { ...K, colHeads: Array.from({ length: 30 }, (_, k) => `c${k + 1}`), cells: K.cells.map((r) => Array.from({ length: 30 }, (_, k) => r[k % r.length])) } as TableModel;
    const out = html(wide, { bands: 12 });
    const bands = [...out.matchAll(/Columns (\d+) to (\d+) of (\d+)/g)].map((m) => [Number(m[1]), Number(m[2])]);
    expect(bands).toEqual([[1, 10], [11, 20], [21, 30]]);
  });
});
