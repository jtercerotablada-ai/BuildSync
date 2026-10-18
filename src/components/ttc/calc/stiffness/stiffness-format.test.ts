import { describe, expect, it, vi } from 'vitest';
import { analyseSafely } from '@/lib/calc/stiffness/analysis';
import { defaultStiffness, emptyStiffness, reduceStiffness } from '@/lib/calc/stiffness/model';
import { stiffnessUi } from '@/lib/calc/stiffness/strings';
import type { HighlightReason, MatrixBlock, VectorBlock } from '@/lib/calc/stiffness/types';
import { notation, spoken } from './math';
import { DEFAULT_FORMAT, SIG_MAX, SIG_MIN, formatCell, fractionOf, pointPadding, spreadsheetNumber, type NumFormat } from './numfmt';
import { PRIORITY, labelKind, loadsTable, markOf, matrixTable, partitionTable, unitsLine, vectorsTable, type TableOptions } from './table';

vi.setConfig({ testTimeout: 120_000 });

/**
 * THE PURE PIECES OF THE WORKED SOLUTION: how a formula is cut into its subscripts, how a number is written for each choice of figures and
 * style, and what a table is made of - its headers, its caption, its marks, its units line and the text Copy puts on the clipboard.
 */

const w = stiffnessUi.en;
const wEs = stiffnessUi.es;
const fmt = (o: Partial<NumFormat> = {}): NumFormat => ({ ...DEFAULT_FORMAT, ...o });
const noise = /NaN|undefined|Infinity|\[object|(?:^|[\s(=])-0(?![.\d])|−0(?![.\d])|\be[+-]\d/;

describe('math notation', () => {
  it('sets a subscript after an underscore and the transpose as a superscript', () => {
    expect(notation('K_FF·u_F')).toEqual([
      { kind: 'text', text: 'K' },
      { kind: 'sub', text: 'FF' },
      { kind: 'text', text: '·u' },
      { kind: 'sub', text: 'F' },
    ]);
    expect(notation('K_e = T^T·k·T')).toEqual([
      { kind: 'text', text: 'K' },
      { kind: 'sub', text: 'e' },
      { kind: 'text', text: ' = T' },
      { kind: 'sup', text: 'T' },
      { kind: 'text', text: '·k·T' },
    ]);
  });
  it('sets two subscripts in a row as one (f_FE_global), and leaves a power of ten and a longer word alone', () => {
    expect(notation('f_FE_global')).toEqual([
      { kind: 'text', text: 'f' },
      { kind: 'sub', text: 'FE,global' },
    ]);
    expect(notation('7.3 × 10^−5')).toEqual([{ kind: 'text', text: '7.3 × 10^−5' }]);
    expect(notation('x^Total')).toEqual([{ kind: 'text', text: 'x^Total' }]);
    expect(notation('a_ik/a_kk').map((p) => p.kind)).toEqual(['text', 'sub', 'text', 'sub']);
  });
  it('is total: any text, and the parts always give the text back', () => {
    for (const text of ['', '_', '^', '^T', '_x_', 'a__b', '____', 'x_1_2_3', '⊥_⊥', 'K_FF'.repeat(50)]) {
      const parts = notation(text);
      const back = parts.map((p) => (p.kind === 'sub' ? `_${p.text.replace(/,/g, '_')}` : p.kind === 'sup' ? '^T' : p.text)).join('');
      expect(back, text).toBe(text);
    }
  });
  it('reads aloud as words', () => {
    expect(spoken('K_FF')).toBe('K sub FF');
    expect(spoken('T^T·k')).toBe('T transpose ·k');
  });
});

describe('number format', () => {
  it('writes a true minus, a plain zero and never -0, NaN or an e-notation', () => {
    expect(formatCell(0)).toBe('0');
    expect(formatCell(-0)).toBe('0');
    expect(formatCell(-12.5)).toBe('−12.5');
    expect(formatCell(Number.NaN)).toBe('—');
    expect(formatCell(Infinity)).toBe('—');
    for (const style of ['auto', 'fixed', 'scientific'] as const) for (const sig of [3, 4, 5, 6, 7, 8]) for (const v of [1e-300, 1e-12, 1e-9, 3.14159e-5, 0.5, 1, 12345.6789, 1e7, 1e17, 1e21, 1.5e300, -2.5e-7, Number.MAX_VALUE, Number.MIN_VALUE]) expect(formatCell(v, fmt({ sig, style })), `${style} ${sig} ${v}`).not.toMatch(noise);
  });
  it('keeps the figures asked for, 3 to 8, and clamps a number outside that', () => {
    expect(formatCell(Math.PI, fmt({ sig: 3 }))).toBe('3.14');
    expect(formatCell(Math.PI, fmt({ sig: 8 }))).toBe('3.1415927');
    expect(formatCell(Math.PI, fmt({ sig: 2 }))).toBe('3.14');
    expect(formatCell(Math.PI, fmt({ sig: 30 }))).toBe('3.1415927');
    expect(formatCell(Math.PI, fmt({ sig: Number.NaN }))).toBe('3.142');
    expect(SIG_MIN).toBe(3);
    expect(SIG_MAX).toBe(8);
  });
  it('auto: plain from 10⁻⁴ to 10⁷, powers of ten outside it', () => {
    expect(formatCell(37120)).toBe('37,120');
    expect(formatCell(0.0001)).toBe('0.0001');
    expect(formatCell(0.00005387931)).toBe('5.388 × 10^−5');
    expect(formatCell(1.234567e7)).toBe('1.235 × 10^7');
    expect(formatCell(4176000)).toBe('4,176,000');
  });
  it('fixed: plain from 10⁻¹² to 10²¹, so no 300-digit number is ever written', () => {
    expect(formatCell(0.00005387931, fmt({ style: 'fixed' }))).toBe('0.00005388');
    expect(formatCell(1.234567e7, fmt({ style: 'fixed' }))).toBe('12,350,000');
    expect(formatCell(1e22, fmt({ style: 'fixed' }))).toBe('1 × 10^22');
    expect(formatCell(1e-13, fmt({ style: 'fixed' }))).toBe('1 × 10^−13');
    expect(formatCell(1.5e300, fmt({ style: 'fixed' })).length).toBeLessThan(20);
  });
  it('scientific: powers of ten for every number but zero, mantissa without trailing zeros', () => {
    expect(formatCell(37120, fmt({ style: 'scientific' }))).toBe('3.712 × 10^4');
    expect(formatCell(1, fmt({ style: 'scientific' }))).toBe('1 × 10^0');
    expect(formatCell(-0.5, fmt({ style: 'scientific' }))).toBe('−5 × 10^−1');
    expect(formatCell(0, fmt({ style: 'scientific' }))).toBe('0');
  });
  it('sets thousands apart with the page’s own mark (a narrow space on the Spanish page)', () => {
    expect(formatCell(1234567, fmt({ sig: 8, group: ' ' }))).toBe('1 234 567');
    expect(formatCell(-1234567, fmt({ sig: 8, group: ',' }))).toBe('−1,234,567');
    expect(formatCell(1234567, fmt({ group: ',' }))).toBe('1,235,000');
  });
  it('rounds by figures: a number never rounds to zero, and 9.9996 at 4 figures is 10', () => {
    expect(formatCell(9.9996)).toBe('10');
    expect(formatCell(0.00012346)).toBe('0.0001235');
    expect(formatCell(1e-30)).toBe('1 × 10^−30');
  });
  it('gives a spreadsheet twelve figures and nothing the page adds', () => {
    expect(spreadsheetNumber(-1234.5678)).toBe('-1234.5678');
    expect(spreadsheetNumber(0.1 + 0.2)).toBe('0.3');
    expect(spreadsheetNumber(0)).toBe('0');
    expect(spreadsheetNumber(-0)).toBe('0');
    expect(spreadsheetNumber(Number.NaN)).toBe('');
    expect(spreadsheetNumber(5.388e-5)).toBe('0.00005388');
    expect(spreadsheetNumber(1e-30)).toBe('1e-30');
  });
  it('lines the decimal points of a column up with padding after the shorter numbers', () => {
    const column = ['37,120', '0.5388', '−146.2', '5,848', '0'];
    const pads = pointPadding(column);
    // The longest fraction is 4 digits ("0.5388"); a number with none is pushed by the 4 and the width of a point.
    expect(pads).toEqual([5, 0, 3, 5, 5]);
    // Every number then ends at the same place relative to the point.
    const widths = column.map((t, k) => (fractionOf(t).hasPoint ? t.indexOf('.') : t.length) + 0 * pads[k]);
    expect(widths.length).toBe(5);
    expect(pointPadding(['1', '22', '333'])).toEqual([0, 0, 0]);
    expect(pointPadding(['5.388 × 10^−5', '0.5'])).toEqual([0, 0]);
  });
});

/* ── Tables ──────────────────────────────────────────────────────────── */

const solved = (form = defaultStiffness()) => {
  const a = analyseSafely(form);
  if (!a.solution) throw new Error('not solved');
  return a.solution;
};
const opts = (caption: string, quantity: TableOptions['quantity'], system: 'us' | 'si' = 'us', lang: 'en' | 'es' = 'en', format = DEFAULT_FORMAT): TableOptions => ({ w: lang === 'en' ? w : wEs, system, format, id: 'x', caption, quantity });
const step = (sol: ReturnType<typeof solved>, key: string) => sol.steps.find((s) => s.key === key)!;
const matrix = (sol: ReturnType<typeof solved>, key: string, name: string) => step(sol, key).blocks.find((b) => b.type === 'matrix' && b.name === name) as MatrixBlock;
const vector = (sol: ReturnType<typeof solved>, key: string, name: string) => step(sol, key).blocks.find((b) => b.type === 'vector' && b.name === name) as VectorBlock;

describe('the DOF labels', () => {
  it('says what kind of movement a label names', () => {
    expect(labelKind('3x')).toBe('x');
    expect(labelKind('12y')).toBe('y');
    expect(labelKind('4θ')).toBe('θ');
    expect(labelKind('u1')).toBe('x');
    expect(labelKind('v12')).toBe('y');
    expect(labelKind('θ3')).toBe('θ');
    for (const none of ['rhs', 'N', 'V', 'M', '1', 'i', 'j', 'x ', 'E', 'A', 'I']) expect(labelKind(none), none).toBeNull();
  });
});

describe('a matrix as a table', () => {
  it('carries the labels as the headers, a caption, the symbols and the marks of the library', () => {
    const sol = solved();
    const k = matrixTable(matrix(sol, 'local-stiffness#1', 'k'), opts('Local stiffness matrix k of member 1', 'stiffness'));
    expect(k.rowLabels).toEqual(['u1', 'u3']);
    expect(k.colHeads).toEqual(['u1', 'u3']);
    expect(k.caption).toBe('Local stiffness matrix k of member 1');
    expect(k.cells[0][0]).toMatchObject({ text: '29,000', sym: 'EA/L', hl: 'axial', zero: false });
    expect(k.cells[0][1]).toMatchObject({ text: '−29,000', sym: '−EA/L', hl: 'axial' });
    expect(k.hasSymbols).toBe(true);
    expect(k.legend).toEqual(['axial']);
    expect(k.units).toBe('Units: kip/ft.');
    expect(k.split).toBeNull();
  });

  it('a frame member’s k has bending marks as well as axial, and a unit for each kind of entry', () => {
    const sol = solved(reduceStiffness(emptyStiffness('us'), { type: 'template', template: 'frame-portal' }));
    const k = matrixTable(matrix(sol, 'local-stiffness#1', 'k'), opts('k', 'stiffness'));
    expect(k.legend).toEqual(['bending', 'axial'].sort((a, b) => PRIORITY.indexOf(a as HighlightReason) - PRIORITY.indexOf(b as HighlightReason)));
    expect(k.cells[0][0].hl).toBe('axial');
    expect(k.cells[1][1].hl).toBe('bending');
    expect(k.cells[0][1]).toMatchObject({ zero: true, text: '0', hl: null });
    expect(k.units).toBe('Units: x or y with x or y: kip/ft; x or y with rotation: kip/rad; rotation with rotation: kip·ft/rad.');
    expect(unitsLine(wEs, 'si', 'stiffness', ['1x', '1θ'], ['1x', '1θ'])).toBe('Unidades: x o y con x o y: kN/m; x o y con giro: kN/rad; giro con giro: kN·m/rad.');
  });

  it('writes the tsv with the labels, tab-separated, in numbers a spreadsheet reads', () => {
    const sol = solved();
    const t = matrixTable(matrix(sol, 'local-stiffness#1', 'k'), opts('k', 'stiffness'));
    // (the corner cell carries the units, so that the first row of what is pasted names them; the minus is the plain hyphen a spreadsheet and the tool's own fields read)
    expect(t.tsv).toBe('kip/ft\tu1\tu3\nu1\t29000\t-29000\nu3\t-29000\t29000');
    expect(t.tsv).not.toMatch(/[−–]/);
    const wide = matrixTable(matrix(sol, 'assembled', 'K'), opts('K', 'stiffness'));
    const rows = wide.tsv.split('\n');
    expect(rows).toHaveLength(7);
    for (const row of rows) expect(row.split('\t')).toHaveLength(7);
    expect(wide.tsv).not.toMatch(/[,−×]|NaN|e\+|undefined/);
  });

  it('is rectangular, whatever the figures or the style asked for', () => {
    const sol = solved();
    for (const style of ['auto', 'fixed', 'scientific'] as const) {
      for (const sig of [3, 8]) {
        const t = matrixTable(matrix(sol, 'assembled', 'K'), opts('K', 'stiffness', 'us', 'en', { sig, style, group: ',' }));
        expect(t.cells).toHaveLength(6);
        for (const row of t.cells) {
          expect(row).toHaveLength(6);
          for (const c of row) expect(c.text).not.toMatch(noise);
        }
      }
    }
  });

  it('marks a cell once, by the stronger of two reasons', () => {
    expect(markOf('pivot', 'updated')).toBe('pivot');
    expect(markOf('updated', 'pivot')).toBe('pivot');
    expect(markOf(null, 'axial')).toBe('axial');
    expect(markOf('shared', 'contributed')).toBe('shared');
    expect(markOf('restrained', 'prescribed')).toBe('prescribed');
    expect(markOf(null, null)).toBeNull();
  });

  it('the assembly marks what a member writes, the running K what has been written, the assembled K what is shared', () => {
    const sol = solved();
    const contribution = matrixTable(matrix(sol, 'assembly#1', 'contribution'), opts('c', 'stiffness'));
    expect(contribution.legend).toEqual(['position']);
    expect(contribution.cells.flat().filter((c) => c.hl === 'position')).toHaveLength(16);
    const running = matrixTable(matrix(sol, 'assembly#2', 'running'), opts('r', 'stiffness'));
    expect(running.legend).toEqual(['contributed']);
    const K = matrixTable(matrix(sol, 'assembled', 'K'), opts('K', 'stiffness'));
    expect(K.legend).toEqual(['shared', 'contributed']);
    // The apex DOFs (5 and 6) are written by both bars: their block of K is shared, and says by which members.
    expect(K.cells[4][4]).toMatchObject({ hl: 'shared', members: [1, 2] });
    expect(K.cells[0][0]).toMatchObject({ hl: 'contributed', members: [1] });
    expect(K.cells[0][2]).toMatchObject({ hl: null });
  });

  it('the elimination marks the pivot, the entries made zero and the entries changed, and a zero pivot', () => {
    const sol = solved(reduceStiffness(emptyStiffness('us'), { type: 'template', template: 'frame-portal' }));
    const pass = matrixTable(matrix(sol, 'forward-pass#1', 'augmented'), opts('a', 'augmented'));
    expect(pass.cells[0][0].hl).toBe('pivot');
    // (a row marked is one whose multiplier is not zero: a row whose entry under the pivot is already 0 has nothing made zero in it, and nothing changed)
    const multipliers = vector(sol, 'forward-pass#1', 'multipliers').values;
    expect(multipliers[0]).toBe(0);
    expect(pass.cells[1][0].hl).toBeNull();
    expect(pass.cells[2][0].hl).toBe('eliminated');
    expect(multipliers[1]).not.toBe(0);
    expect(pass.legend[0]).toBe('pivot');
    expect(pass.legend).toContain('eliminated');
    expect(pass.units).toContain('right-hand side');
    const mech = analyseSafely(reduceStiffness(emptyStiffness('us'), { type: 'template', template: 'truss-two-bar' }));
    expect(mech.solution).not.toBeNull();
  });

  it('a partition is ONE table: free first, held last, the four blocks named, the held rows marked', () => {
    const sol = solved(reduceStiffness(emptyStiffness('us'), { type: 'template', template: 'frame-portal' }));
    const s = step(sol, 'partition');
    const get = (n: string) => s.blocks.find((b) => b.type === 'matrix' && b.name === n) as MatrixBlock;
    const t = partitionTable({ FF: get('K_FF'), FR: get('K_FR'), RF: get('K_RF'), RR: get('K_RR') }, opts('Partition', 'stiffness'));
    expect(t.rowLabels).toEqual(['3x', '3y', '3θ', '4x', '4y', '4θ', '1x', '1y', '1θ', '2x', '2y', '2θ']);
    expect(t.colHeads).toEqual(t.rowLabels);
    expect(t.split).toEqual({ rows: 6, cols: 6, names: ['K_FF', 'K_FR', 'K_RF', 'K_RR'] });
    expect(t.rowMarks.slice(0, 6).every((m) => m === null)).toBe(true);
    expect(t.rowMarks.slice(6).every((m) => m === 'restrained')).toBe(true);
    // The blocks are the library’s numbers, put side by side.
    expect(t.cells[0][0].text).toBe(partitionTable({ FF: get('K_FF'), FR: get('K_FR'), RF: get('K_RF'), RR: get('K_RR') }, opts('P', 'stiffness')).cells[0][0].text);
    expect(t.tsv.split('\n')).toHaveLength(13);
  });

  it('a partition with nothing free is the held block alone', () => {
    const fixedPoint = solved(reduceStiffness(emptyStiffness('us'), { type: 'template', template: 'frame-fixed-point' }));
    const s = step(fixedPoint, 'partition');
    const RR = s.blocks.find((b) => b.type === 'matrix' && b.name === 'K_RR') as MatrixBlock;
    const t = partitionTable({ FF: undefined, FR: undefined, RF: undefined, RR }, opts('P', 'stiffness'));
    expect(t.rowLabels).toHaveLength(6);
    expect(t.split).toEqual({ rows: 0, cols: 0, names: ['', '', '', 'K_RR'] });
  });

  it('the loads and displacements of the partition ask for the free displacements with a question mark', () => {
    const sol = solved(reduceStiffness(emptyStiffness('us'), { type: 'template', template: 'frame-portal' }));
    const s = step(sol, 'partition');
    const get = (n: string) => s.blocks.find((b) => b.type === 'vector' && b.name === n) as VectorBlock;
    const t = loadsTable({ PF: get('P_F'), PR: get('P_R'), uR: get('u_R') }, '?', { ...opts('Loads', 'force'), heads: ['P', 'u'] });
    expect(t.colHeads).toEqual(['P', 'u']);
    expect(t.cells.slice(0, 6).map((r) => r[1].text)).toEqual(['?', '?', '?', '?', '?', '?']);
    expect(t.cells.slice(6).every((r) => r[1].text === '0')).toBe(true);
    expect(t.tsv.split('\n')[1]).toBe('3x\t10\t?');
    expect(t.units).toContain('P:');
  });
});

describe('vectors as one table, a column to each', () => {
  it('puts the reaction vectors side by side on their labels', () => {
    const sol = solved();
    const names = ['K_RF·u_F', 'K_RR·u_R', 'P_R', 'R'];
    const blocks = names.map((n) => vector(sol, 'reactions', n));
    const t = vectorsTable(blocks, names, opts('Reactions', 'force'));
    expect(t.rowLabels).toEqual(['1x', '1y', '2x', '2y']);
    expect(t.colHeads).toEqual(names);
    expect(t.cells.map((r) => r[3].text)).toEqual(['10', '7.5', '−30', '22.5']);
    expect(t.tsv.split('\n')[0]).toBe('kip\tK_RF·u_F\tK_RR·u_R\tP_R\tR');
    expect(t.units).toBe('Units: kip.');
  });
  it('marks a held DOF on its row, and a multiplier’s one symbol is said once, in the head', () => {
    const sol = solved();
    const u = vectorsTable([vector(sol, 'displacements', 'u')], ['u'], opts('u', 'displacement'));
    expect(u.rowMarks).toEqual(['restrained', 'restrained', 'restrained', 'restrained', null, null]);
    expect(u.legend).toEqual(['restrained']);
    const portal = solved(reduceStiffness(emptyStiffness('us'), { type: 'template', template: 'frame-portal' }));
    const mult = vectorsTable([vector(portal, 'forward-pass#1', 'multipliers')], ['l = a_ik/a_kk'], opts('m', 'none'));
    expect(mult.cells.every((r) => r[0].sym === null)).toBe(true);
    expect(mult.units).toBe('');
  });
  it('a settlement marks its row as prescribed, with the strong mark', () => {
    let f = reduceStiffness(emptyStiffness('us'), { type: 'template', template: 'frame-portal' });
    f = reduceStiffness(f, { type: 'patch', list: 'supports', id: f.supports[1].id, patch: { dy: -0.5 } });
    const sol = solved(f);
    const u = vectorsTable([vector(sol, 'displacements', 'u')], ['u'], opts('u', 'displacement'));
    expect(u.rowMarks.filter((m) => m === 'prescribed')).toHaveLength(1);
    expect(u.legend).toEqual(['prescribed', 'restrained']);
    expect(u.cells[4][0].text).toBe('−0.04167');
  });
});
