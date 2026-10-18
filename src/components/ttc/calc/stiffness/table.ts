import { CALCULATION_UNITS, type UnitSystem } from '@/lib/calc/stiffness/model';
import type { StiffnessUi } from '@/lib/calc/stiffness/strings';
import type { Highlight, HighlightReason, MatrixBlock, VectorBlock } from '@/lib/calc/stiffness/types';
import { fill } from './text';
import { formatCell, pointPadding, spreadsheetNumber, type NumFormat } from './numfmt';

/**
 * A TABLE OF THE WORKED SOLUTION, as data. Every matrix and every vector of a step becomes a `TableModel` here, with no React: the
 * row and column labels the screen reader reads as headers, the caption that names it, each entry as the text the page prints (in
 * the format asked for) and the symbol the library gave it, why an entry is marked, how far each is pushed to line the decimal
 * points up, the line of units, and the tab-separated text the Copy button puts on the clipboard. The component that writes it as
 * HTML (MatrixTable.tsx) decides nothing about a number; this file is what the tests hold to the rules.
 *
 *   One table can hold SEVERAL VECTORS that stand on the same labels (the reactions: K_RF·u_F, K_RR·u_R, P_R and R), one to a column.
 *   The partition is ONE table: K with the free DOFs first, the held ones last, the four blocks named in their corners.
 *   Every mark has a reason (the library's codes); `markOf` is the one place a cell with two reasons is settled.
 */

export type Kind = 'x' | 'y' | 'θ';

/** What kind of movement a DOF label names: '3x' and 'u3' along x, '3y' and 'v3' along y, '3θ' and 'θ3' a rotation; null for any other label ('rhs', 'N', '1'). */
export function labelKind(label: string): Kind | null {
  const last = label.charAt(label.length - 1);
  if (last === 'x') return 'x';
  if (last === 'y') return 'y';
  if (last === 'θ') return 'θ';
  const first = label.charAt(0);
  if (first === 'u' && /^u\d+$/.test(label)) return 'x';
  if (first === 'v' && /^v\d+$/.test(label)) return 'y';
  if (first === 'θ') return 'θ';
  return null;
}

export type Quantity = 'stiffness' | 'displacement' | 'force' | 'length' | 'sections' | 'ends' | 'augmented' | 'none';

export interface CellModel {
  /** The number as the page prints it. */
  text: string;
  /** The symbol the library gave this entry (null where it gave none, or where every entry of the column has the same one). */
  sym: string | null;
  /** Why the entry is marked, or null. */
  hl: HighlightReason | null;
  /** The members that contributed to the cell (assembly and the assembled matrix). */
  members: number[] | null;
  /** The entry is exactly zero. */
  zero: boolean;
  /** Characters to leave after the number so that the decimal points of a column stand one over another. */
  pad: number;
}

export interface TableModel {
  /** Unique within its step. */
  id: string;
  /** A name for the Copy button and the scrolling region, plain text. */
  name: string;
  caption: string;
  rowLabels: string[];
  /** What the columns are called, in the library's math alphabet (a matrix: its column labels; a vector table: the vectors' names). */
  colHeads: string[];
  cells: CellModel[][];
  /** A mark that is the whole ROW's (a vector's held DOF), by row. */
  rowMarks: (HighlightReason | null)[];
  /** The partition: rows and columns before which a heavy line is drawn, and the names of the four blocks. */
  split: { rows: number; cols: number; names: [string, string, string, string] } | null;
  /** Every entry is this factor times its symbol (a bar's closed form). */
  factor: { symbol: string; value: string; unit: string } | null;
  /** The line of units under the table, with its "Units:" in front; empty when the entries have none. */
  units: string;
  /** The reasons that appear, in the order of `PRIORITY`: the legend names exactly these. */
  legend: HighlightReason[];
  /** Whether any entry carries a symbol the page can show in place of its number. */
  hasSymbols: boolean;
  /** The tab-separated text of the table (the numbers, to twelve figures), with its labels. */
  tsv: string;
}

/** Which mark wins where one cell has two: the more particular first. */
export const PRIORITY: HighlightReason[] = ['pivot', 'zero-pivot', 'eliminated', 'updated', 'shared', 'contributed', 'position', 'axial', 'bending', 'prescribed', 'restrained'];
const RANK = new Map(PRIORITY.map((r, k) => [r, k]));

/** The stronger of two reasons. */
export function markOf(a: HighlightReason | null, b: HighlightReason | null): HighlightReason | null {
  if (a === null) return b;
  if (b === null) return a;
  return (RANK.get(a) ?? 99) <= (RANK.get(b) ?? 99) ? a : b;
}

/* ── Units ────────────────────────────────────────────────────────────── */

const kindsOf = (labels: readonly string[]): Set<Kind> => new Set(labels.map(labelKind).filter((k): k is Kind => k !== null));

/** The unit of a stiffness entry from the kinds of its row and column DOFs. */
function stiffnessUnit(system: UnitSystem, row: Kind, col: Kind): string {
  const u = CALCULATION_UNITS[system];
  const rot = (row === 'θ' ? 1 : 0) + (col === 'θ' ? 1 : 0);
  return rot === 0 ? u.stiffness : rot === 1 ? u.stiffnessCoupling : u.stiffnessRotation;
}

/** The line "Units: …" for a table of this quantity on these labels; '' when the entries have no unit. */
export function unitsLine(w: StiffnessUi, system: UnitSystem, quantity: Quantity, rowLabels: readonly string[], colLabels: readonly string[]): string {
  const body = unitsBody(w, system, quantity, rowLabels, colLabels);
  return body ? fill(w.matrix.unitsLine, { units: body }) : '';
}

/** The units themselves, without the line's "Units:" and its full stop; '' when the entries have none. */
export function unitsBody(w: StiffnessUi, system: UnitSystem, quantity: Quantity, rowLabels: readonly string[], colLabels: readonly string[]): string {
  const u = CALCULATION_UNITS[system];
  const rows = kindsOf(rowLabels);
  const cols = kindsOf(colLabels);
  const m = w.matrix;
  const translation = (unit: string, rot: string) => {
    const hasT = rows.has('x') || rows.has('y') || rows.size === 0;
    const hasR = rows.has('θ');
    if (hasT && hasR) return `${fill(m.unitX, { unit })}; ${fill(m.unitTheta, { unit: rot })}`;
    return hasR ? rot : unit;
  };
  const stiffness = () => {
    const rowsT = rows.has('x') || rows.has('y');
    const colsT = cols.has('x') || cols.has('y');
    // Which of the three kinds of entry the table holds, each with its unit.
    const entries: [string, string][] = [];
    if (rowsT && colsT) entries.push([m.unitXX, stiffnessUnit(system, 'x', 'x')]);
    if ((rowsT && cols.has('θ')) || (rows.has('θ') && colsT)) entries.push([m.unitXT, stiffnessUnit(system, 'x', 'θ')]);
    if (rows.has('θ') && cols.has('θ')) entries.push([m.unitTT, stiffnessUnit(system, 'θ', 'θ')]);
    if (entries.length <= 1) return entries[0]?.[1] ?? '';
    return entries.map(([text, unit]) => fill(text, { unit })).join('; ');
  };
  let body = '';
  switch (quantity) {
    case 'stiffness':
      body = stiffness();
      break;
    case 'displacement':
      body = translation(u.length, u.rotation);
      break;
    case 'force':
      body = translation(u.force, u.moment);
      break;
    case 'length':
      body = u.length;
      break;
    case 'sections': {
      const list = colLabels.map((c) => (c === 'E' ? fill(m.unitIn, { symbol: 'E', unit: u.E }) : c === 'A' ? fill(m.unitIn, { symbol: 'A', unit: u.area }) : c === 'I' ? fill(m.unitIn, { symbol: 'I', unit: u.inertia }) : ''));
      body = list.filter(Boolean).join('; ');
      break;
    }
    case 'ends':
      body = `${fill(m.unitIn, { symbol: 'N, V', unit: u.force })}; ${fill(m.unitIn, { symbol: 'M', unit: u.moment })}`;
      break;
    case 'augmented': {
      const s = stiffness();
      const f = translation(u.force, u.moment);
      body = `${s}; ${fill(m.unitRhs, { units: f })}`;
      break;
    }
    case 'none':
      body = '';
  }
  return body;
}

/* ── The tables ───────────────────────────────────────────────────────── */

interface Spec {
  id: string;
  name: string;
  caption: string;
  rowLabels: string[];
  colHeads: string[];
  /** Plain heads for the spreadsheet (default: colHeads). */
  tsvHeads?: string[];
  values: number[][];
  symbolic?: (string | null)[][];
  marks?: Map<number, { reason: HighlightReason; members: number[] | null }>;
  rowMarks?: (HighlightReason | null)[];
  split?: TableModel['split'];
  factor?: TableModel['factor'];
  units: string;
}

function build(spec: Spec, format: NumFormat): TableModel {
  const rows = spec.values.length;
  const cols = spec.colHeads.length;
  const texts = spec.values.map((r) => r.map((v) => formatCell(v, format)));
  // The points of a column are lined up on the point.
  const pads: number[][] = texts.map((r) => r.map(() => 0));
  for (let c = 0; c < cols; c++) {
    const column = pointPadding(texts.map((r) => r[c]));
    for (let r = 0; r < rows; r++) pads[r][c] = column[r];
  }
  const legend = new Set<HighlightReason>();
  const rowMarks = spec.rowMarks ?? new Array(rows).fill(null);
  for (const mark of rowMarks) if (mark) legend.add(mark);
  let hasSymbols = false;
  const cells: CellModel[][] = spec.values.map((row, r) =>
    row.map((value, c) => {
      const found = spec.marks?.get(r * cols + c);
      const sym = spec.symbolic?.[r]?.[c] ?? null;
      if (found) legend.add(found.reason);
      if (sym !== null) hasSymbols = true;
      return { text: texts[r][c], sym, hl: found?.reason ?? null, members: found?.members ?? null, zero: value === 0, pad: pads[r][c] };
    }),
  );
  const heads = spec.tsvHeads ?? spec.colHeads;
  const tsv = [['', ...heads].join('\t'), ...spec.values.map((row, r) => [spec.rowLabels[r], ...row.map(spreadsheetNumber)].join('\t'))].join('\n');
  return {
    id: spec.id,
    name: spec.name,
    caption: spec.caption,
    rowLabels: spec.rowLabels,
    colHeads: spec.colHeads,
    cells,
    rowMarks,
    split: spec.split ?? null,
    factor: spec.factor ?? null,
    units: spec.units,
    legend: PRIORITY.filter((r) => legend.has(r)),
    hasSymbols,
    tsv,
  };
}

/** The marks of a matrix, one to a cell (the stronger where the library gave two). */
function marksOf(highlights: readonly Highlight[] | undefined, cols: number): Map<number, { reason: HighlightReason; members: number[] | null }> {
  const marks = new Map<number, { reason: HighlightReason; members: number[] | null }>();
  for (const h of highlights ?? []) {
    const key = h.row * cols + h.col;
    const had = marks.get(key);
    const reason = markOf(had?.reason ?? null, h.reason) as HighlightReason;
    marks.set(key, { reason, members: reason === h.reason ? (h.members ?? null) : (had?.members ?? null) });
  }
  return marks;
}

export interface TableOptions {
  w: StiffnessUi;
  system: UnitSystem;
  format: NumFormat;
  id: string;
  caption: string;
  quantity: Quantity;
  /** Plain name for Copy; defaults to the caption. */
  name?: string;
}

/** A matrix of a step as a table. */
export function matrixTable(block: MatrixBlock, o: TableOptions): TableModel {
  const cols = block.colLabels.length;
  const factor =
    block.factor !== undefined && block.factorValue !== undefined
      ? { symbol: block.factor, value: formatCell(block.factorValue, o.format), unit: CALCULATION_UNITS[o.system].stiffness }
      : null;
  return build(
    {
      id: o.id,
      name: o.name ?? o.caption,
      caption: o.caption,
      rowLabels: block.rowLabels,
      colHeads: block.colLabels,
      values: block.values,
      symbolic: block.symbolic,
      marks: marksOf(block.highlights, cols),
      factor,
      units: unitsLine(o.w, o.system, o.quantity, block.rowLabels, block.colLabels),
    },
    o.format,
  );
}

/**
 * Several vectors that stand on the same labels as ONE table, a column to each. `heads` names the columns (math alphabet). A vector
 * with a symbol for every entry shows it, unless the same one stands for them all (the multipliers: the head says it once).
 */
export function vectorsTable(blocks: readonly VectorBlock[], heads: readonly string[], o: TableOptions): TableModel {
  const labels = blocks[0].labels;
  const rows = labels.length;
  const values = labels.map((_, r) => blocks.map((b) => b.values[r]));
  const symbolic = labels.map((_, r) =>
    blocks.map((b) => {
      const s = b.symbolic;
      if (!s || s.every((x) => x === s[0])) return null;
      return s[r] ?? null;
    }),
  );
  // A vector's own marks (a held DOF) are the row's.
  const rowMarks: (HighlightReason | null)[] = new Array(rows).fill(null);
  for (const b of blocks) for (const h of b.highlights ?? []) rowMarks[h.index] = markOf(rowMarks[h.index], h.reason);
  return build(
    {
      id: o.id,
      name: o.name ?? o.caption,
      caption: o.caption,
      rowLabels: labels,
      colHeads: [...heads],
      values,
      symbolic,
      rowMarks,
      units: unitsLine(o.w, o.system, o.quantity, labels, []),
    },
    o.format,
  );
}

/**
 * The partition as one matrix: K with the free DOFs first and the held ones last, split into K_FF, K_FR, K_RF and K_RR. Rows and
 * columns that are held carry the mark 'restrained' on their labels (a row mark), and the heavy lines are between the groups.
 */
export function partitionTable(blocks: { FF: MatrixBlock | undefined; FR: MatrixBlock | undefined; RF: MatrixBlock | undefined; RR: MatrixBlock }, o: TableOptions): TableModel {
  const { FF, FR, RF, RR } = blocks;
  const free = FF ? FF.rowLabels.length : 0;
  const held = RR.rowLabels.length;
  const rowLabels = [...(FF ? FF.rowLabels : []), ...RR.rowLabels];
  const colHeads = [...(FF ? FF.colLabels : []), ...RR.colLabels];
  const values: number[][] = [];
  for (let r = 0; r < free; r++) values.push([...(FF as MatrixBlock).values[r], ...(FR as MatrixBlock).values[r]]);
  for (let r = 0; r < held; r++) values.push([...(RF ? RF.values[r] : []), ...RR.values[r]]);
  const model = build(
    {
      id: o.id,
      name: o.name ?? o.caption,
      caption: o.caption,
      rowLabels,
      colHeads,
      values,
      rowMarks: rowLabels.map((_, r) => (r >= free ? 'restrained' : null)),
      split: { rows: free, cols: free, names: [free > 0 ? 'K_FF' : '', free > 0 ? 'K_FR' : '', free > 0 ? 'K_RF' : '', 'K_RR'] },
      units: unitsLine(o.w, o.system, 'stiffness', rowLabels, colHeads),
    },
    o.format,
  );
  // The held columns are marked as the held rows are, on their heads (the component reads `split`).
  return model;
}

/** The loads and displacements of the partition as a two-column table: P = [P_F; P_R] and u = [u_F; u_R] with "?" for the unknown u_F. */
export function loadsTable(
  parts: { PF: VectorBlock | undefined; PR: VectorBlock; uR: VectorBlock },
  unknown: string,
  o: TableOptions & { heads: [string, string] },
): TableModel {
  const { PF, PR, uR } = parts;
  const free = PF ? PF.labels.length : 0;
  const rowLabels = [...(PF ? PF.labels : []), ...PR.labels];
  const values = [...(PF ? PF.values.map((v) => [v, 0]) : []), ...PR.values.map((v, k) => [v, uR.values[k]])];
  const model = build(
    {
      id: o.id,
      name: o.name ?? o.caption,
      caption: o.caption,
      rowLabels,
      colHeads: [...o.heads],
      values,
      rowMarks: rowLabels.map((_, r) => (r >= free ? 'restrained' : null)),
      split: { rows: free, cols: 0, names: [free > 0 ? 'P_F' : '', '', 'P_R', ''] },
      // Two kinds of quantity in one table: each column says its own.
      units: fill(o.w.matrix.unitsLine, { units: `${o.heads[0]}: ${unitsBody(o.w, o.system, 'force', rowLabels, [])}; ${o.heads[1]}: ${unitsBody(o.w, o.system, 'displacement', rowLabels, [])}` }),
    },
    o.format,
  );
  // The displacements of the free DOFs are what is looked for: a question mark stands where the number would be.
  for (let r = 0; r < free; r++) {
    model.cells[r][1] = { ...model.cells[r][1], text: unknown, zero: false, pad: 0 };
  }
  model.tsv = [['', ...o.heads].join('\t'), ...values.map((row, r) => [rowLabels[r], spreadsheetNumber(row[0]), r < free ? unknown : spreadsheetNumber(row[1])].join('\t'))].join('\n');
  return model;
}
