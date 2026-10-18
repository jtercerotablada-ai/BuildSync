'use client';

import React, { memo, startTransition, useCallback, useEffect, useId, useRef, useState } from 'react';
import type { StiffnessUi } from '@/lib/calc/stiffness/strings';
import type { HighlightReason } from '@/lib/calc/stiffness/types';
import type { ZeroStyle } from './numfmt';
import { Notation } from './Notation';
import { noticeTimer } from '../shell/Actions';
import { bandsOf, firstRows, nextRows } from './solution-state';
import type { CellModel, TableModel } from './table';
import { fill } from './text';

/**
 * A TABLE OF THE WORKED SOLUTION, written as HTML (table.ts makes what it writes).
 *
 *   A real table: the DOF labels are the headers of the rows and of the columns (`scope`), the caption names it, and a key can scroll
 *   it (the region takes the focus, but only where it does scroll). The row and column headers STAY while the table scrolls sideways
 *   or down (sticky headers in stiffness.css), so a number in the middle of a 36 × 36 matrix still has its DOF named.
 *   Numbers are in a monospaced face, each pushed by `pad` so that the decimal points of a column stand one over another.
 *   Zeros are what the visitor chose (a light 0, a dot, a plain 0): the pattern of a matrix reads when its zeros do not shout.
 *   A mark on an entry has a PATTERN and a colour and a name in the legend under the table: never colour alone. And the mark is a WORD
 *   as well, in the cell, for a reader who cannot see it (`marks`): "pivot", "shared by members 1, 2". In forced-colors mode the patterns
 *   become outlines (stiffness.css).
 *   Every table has a Copy button: its numbers, tab-separated with the labels, for a spreadsheet. The line that tells it worked is on
 *   the page before it has anything to say, and does not carry a number that changes with each press.
 *
 * THE PARTITION'S BLOCKS (K_FF, K_FR, K_RF, K_RR; P_F, P_R) are named in a thin row of their own over each group of rows, never in a
 * cell: a name inside a cell pushed its number down and broke the row's baseline.
 *
 * A TABLE OF MANY ENTRIES IS DRAWN A FEW ROWS AT A TIME after the page is up (`firstRows`, `nextRows`): a 36 × 36 matrix built in one go
 * is a task of a third of a second on a desktop and several times that on a phone.
 *
 * On paper a table wider than `bands` columns is written as bands of about that many columns, each under the same row labels, with the
 * heavy lines of a partition kept: a 36-column matrix prints at a size that reads instead of at a size that fits.
 */

export type MatrixForm = 'both' | 'symbolic' | 'numbers';

interface Props {
  model: TableModel;
  form: MatrixForm;
  zeros: ZeroStyle;
  w: StiffnessUi;
  /** On paper: the most columns of a band; null on screen. */
  bands: number | null;
}

function Entry({ cell, form, zeros }: { cell: CellModel; form: MatrixForm; zeros: ZeroStyle }) {
  const number = (
    <span className="mp-st__num" style={cell.pad > 0 ? { paddingInlineEnd: `${cell.pad}ch` } : undefined}>
      {cell.zero && zeros === 'dot' ? (
        <>
          <span aria-hidden="true">·</span>
          <span className="mp-st__sr">0</span>
        </>
      ) : (
        cell.text
      )}
    </span>
  );
  if (cell.sym === null || form === 'numbers') return number;
  const symbol = cell.sym === '0' && zeros !== 'plain' ? '0' : cell.sym;
  const sym = (
    <span className="mp-st__sym">
      <Notation text={symbol} />
    </span>
  );
  return form === 'symbolic' ? sym : (
    <>
      {sym}
      {number}
    </>
  );
}

const zeroClass = (cell: CellModel, form: MatrixForm, zeros: ZeroStyle): string => {
  const isZero = form === 'symbolic' && cell.sym !== null ? cell.sym === '0' : cell.zero;
  return isZero && zeros !== 'plain' ? ` mp-st__zero mp-st__zero--${zeros}` : '';
};

/** What a mark is called for a reader who cannot see it: "pivot", "shared by members 1, 2". */
export function markWord(reason: HighlightReason, members: readonly number[] | null, w: Pick<StiffnessUi, 'marks'>): string {
  if (reason === 'shared') return fill(w.marks.shared, { list: (members ?? []).join(', ') });
  return w.marks[reason];
}

/** Whether a column of the table is a held DOF, as the rows of a partition are: the partition is square, its columns are its rows' DOFs in the same order. */
export function heldColumn(model: Pick<TableModel, 'split' | 'colHeads' | 'rowLabels'>, c: number): boolean {
  const split = model.split;
  return split !== null && split.cols > 0 && model.colHeads.length === model.rowLabels.length && c >= split.cols;
}

function Grid({ model, form, zeros, w, from, to, shownRows, labelled }: { model: TableModel; form: MatrixForm; zeros: ZeroStyle; w: StiffnessUi; from: number; to: number; shownRows: number; labelled: string }) {
  const split = model.split;
  const total = model.colHeads.length;
  const cols = Array.from({ length: to - from }, (_, k) => from + k);
  const cutAt = split !== null && split.cols > 0 && split.cols < total ? split.cols : -1;
  // The four blocks are named in a row over each group of rows: the free rows (K_FF, K_FR) and the held ones (K_RF, K_RR).
  const named = split !== null && split.rows > 0 && split.rows < model.rowLabels.length && split.names.some(Boolean);
  const blockRow = (key: string, left: string, right: string, held: boolean) => {
    const leftSpan = cutAt > 0 ? Math.max(0, Math.min(to, cutAt) - from) : to - from;
    const rightSpan = cutAt > 0 ? Math.max(0, to - Math.max(from, cutAt)) : 0;
    return (
      <tr key={key} className={held ? 'mp-st__blockrow mp-st__cut-row' : 'mp-st__blockrow'} aria-hidden="true">
        <td className="mp-st__blockhead" />
        {leftSpan > 0 ? (
          <td colSpan={leftSpan} className="mp-st__blockname">
            <Notation text={left} />
          </td>
        ) : null}
        {rightSpan > 0 ? (
          <td colSpan={rightSpan} className="mp-st__blockname mp-st__cut-col">
            <Notation text={right} />
          </td>
        ) : null}
      </tr>
    );
  };
  const rows: React.ReactNode[] = [];
  for (let r = 0; r < shownRows; r++) {
    const row = model.cells[r];
    const mark = model.rowMarks[r];
    if (named && split && r === 0) rows.push(blockRow('b-free', split.names[0], split.names[1], false));
    if (named && split && r === split.rows) rows.push(blockRow('b-held', split.names[2], split.names[3], true));
    rows.push(
      <tr key={r}>
        <th scope="row" className={mark ? `mp-st__rowmark mp-st__rowmark--${mark}` : undefined} data-mark={mark ?? undefined}>
          {mark ? <span className="mp-st__sr">{w.marks[mark]} </span> : null}
          {model.rowLabels[r]}
        </th>
        {cols.map((c) => {
          const cell = row[c];
          const word = cell.hl ? markWord(cell.hl, cell.members, w) : '';
          const members = cell.members && cell.members.length > 1 ? cell.members.join(', ') : undefined;
          const classes = [cell.hl ? `mp-st__hl mp-st__hl--${cell.hl}` : '', zeroClass(cell, form, zeros), c === cutAt ? 'mp-st__cut-col' : ''].filter(Boolean).join(' ');
          return (
            <td key={c} className={classes || undefined} data-hl={cell.hl ?? undefined} title={cell.hl === 'shared' ? members : undefined}>
              {word ? <span className="mp-st__sr">{word} </span> : null}
              <Entry cell={cell} form={form} zeros={zeros} />
            </td>
          );
        })}
      </tr>,
    );
  }
  return (
    <table className="mp-st__matrix" aria-labelledby={labelled} data-split={split ? 'true' : undefined}>
      <caption className="mp-st__sr">{model.caption}</caption>
      <thead>
        <tr>
          <td className="mp-st__corner" />
          {cols.map((c) => {
            const held = heldColumn(model, c);
            return (
              <th key={c} scope="col" className={[c === cutAt ? 'mp-st__cut-col' : '', held ? 'mp-st__rowmark mp-st__rowmark--restrained' : ''].filter(Boolean).join(' ') || undefined} data-mark={held ? 'restrained' : undefined}>
                {held ? <span className="mp-st__sr">{w.marks.restrained} </span> : null}
                <Notation text={model.colHeads[c]} />
              </th>
            );
          })}
        </tr>
      </thead>
      <tbody>{rows}</tbody>
    </table>
  );
}

/**
 * The box a wide or tall table scrolls in. It takes the keyboard focus (so that a key can scroll it) only when it does scroll: a table
 * that fits has nothing for the keys to do, and is not a stop to Tab through.
 */
function ScrollBox({ labelled, children }: { labelled: string; children: React.ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  const [scrolls, setScrolls] = useState(false);
  // Measured when the observer first looks (after the layout, never forcing one inside the render: a layout read here, for every table that comes into view, was the
  // larger part of the time a card took to appear), and again whenever the box or the table in it changes size.
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const measure = () => setScrolls(el.scrollWidth > el.clientWidth + 1 || el.scrollHeight > el.clientHeight + 1);
    if (typeof ResizeObserver === 'undefined') {
      const id = window.setTimeout(measure, 0);
      return () => window.clearTimeout(id);
    }
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    if (el.firstElementChild) ro.observe(el.firstElementChild);
    return () => ro.disconnect();
  }, []);
  return (
    <div ref={ref} className="mp-st__scroll" role="group" aria-labelledby={labelled} tabIndex={scrolls ? 0 : undefined}>
      {children}
    </div>
  );
}

export const MatrixTable = memo(function MatrixTable({ model, form, zeros, w, bands }: Props) {
  const uid = useId();
  const [status, setStatus] = useState('');
  const timer = useRef<ReturnType<typeof noticeTimer> | null>(null);
  if (timer.current === null) timer.current = noticeTimer(() => setStatus(''));
  useEffect(() => () => timer.current?.stop(), []);
  const rows = model.rowLabels.length;
  const total = model.colHeads.length;

  // A large table is drawn a first chunk of rows, and the rest follow, a chunk per turn, once the page has room for them.
  const [shown, setShown] = useState(() => firstRows(rows, total, bands !== null));
  const target = bands !== null ? rows : Math.min(shown, rows);
  useEffect(() => {
    if (bands !== null || shown >= rows) return;
    const id = setTimeout(() => startTransition(() => setShown((s) => nextRows(s, rows, total))), 0);
    return () => clearTimeout(id);
  }, [shown, rows, total, bands]);

  const copy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(model.tsv);
      setStatus(fill(w.matrix.copied, { name: model.name }));
    } catch {
      // No clipboard (an old browser, a page not served over https): the table is there to be selected.
      setStatus(fill(w.matrix.failed, { name: model.name }));
    }
    timer.current?.start();
  }, [model, w]);
  const wide = total > 6;
  const titleId = `${uid}t`;
  const pieces = bands !== null && total > bands ? bandsOf(total, bands) : ([[0, total]] as [number, number][]);
  const hasZero = model.cells.some((r) => r.some((c) => c.zero));
  return (
    <figure className="mp-st__fig" data-wide={wide ? 'true' : undefined} data-cols={total} data-rows={rows}>
      <div className="mp-st__tabhead">
        <p className="mp-st__caption" id={titleId}>
          <Notation text={model.caption} /> <span className="mp-st__size">({fill(w.matrix.size, { rows, cols: total })})</span>
        </p>
        <button type="button" className="mp-app__btn mp-app__btn--quiet mp-st__copy" aria-label={fill(w.matrix.copyName, { name: model.name })} onClick={copy}>
          {w.matrix.copy}
        </button>
      </div>
      <p className="mp-st__copied" role="status">
        {status}
      </p>
      {model.factor ? (
        <p className="mp-st__factor">
          <Notation text={fill(w.matrix.factor, { factor: model.factor.symbol, value: model.factor.value, unit: model.factor.unit })} />
        </p>
      ) : null}
      {pieces.map(([from, to]) => (
        <React.Fragment key={from}>
          {pieces.length > 1 ? <p className="mp-st__band">{fill(w.matrix.band, { from: from + 1, to, total })}</p> : null}
          <ScrollBox labelled={titleId}>
            <Grid model={model} form={form} zeros={zeros} w={w} from={from} to={to} shownRows={target} labelled={titleId} />
          </ScrollBox>
        </React.Fragment>
      ))}
      {wide ? <p className="mp-st__scrollnote">{w.matrix.scroll}</p> : null}
      {model.split ? <p className="mp-st__note">{w.matrix.split}</p> : null}
      {model.units ? <p className="mp-st__units">{model.units}</p> : null}
      {model.legend.length > 0 || (hasZero && zeros !== 'plain') ? (
        <ul className="mp-st__legend" aria-label={w.matrix.legend}>
          {model.legend.map((reason) => (
            <li key={reason}>
              <span className={`mp-st__swatch mp-st__hl mp-st__hl--${reason}`} aria-hidden="true" />
              {w.highlights[reason]}
            </li>
          ))}
          {hasZero && zeros !== 'plain' ? <li>{w.zeroNote}</li> : null}
        </ul>
      ) : null}
    </figure>
  );
});
