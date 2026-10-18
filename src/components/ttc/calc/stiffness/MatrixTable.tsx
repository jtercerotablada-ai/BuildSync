'use client';

import React, { memo, useEffect, useId, useRef, useState } from 'react';
import type { StiffnessUi } from '@/lib/calc/stiffness/strings';
import type { ZeroStyle } from './numfmt';
import { Notation } from './Notation';
import { noticeTimer } from '../shell/Actions';
import type { CellModel, TableModel } from './table';
import { fill } from './text';

/**
 * A TABLE OF THE WORKED SOLUTION, written as HTML (table.ts makes what it writes).
 *
 *   A real table: the DOF labels are the headers of the rows and of the columns (`scope`), the caption names it, and a key can scroll
 *   it (the region takes the focus). The row and column headers STAY while the table scrolls sideways or down (calc.css-style sticky
 *   headers in stiffness.css), so a number in the middle of a 36 × 36 matrix still has its DOF named.
 *   Numbers are in a monospaced face, each pushed by `pad` so that the decimal points of a column stand one over another.
 *   Zeros are what the visitor chose (a light 0, a dot, a plain 0): the pattern of a matrix reads when its zeros do not shout.
 *   A mark on an entry has a PATTERN and a colour and a name in the legend under the table: never colour alone.
 *   Every table has a Copy button: its numbers, tab-separated with the labels, for a spreadsheet. The line that tells it worked is on
 *   the page before it has anything to say, and does not carry a number that changes with each press.
 *
 * On paper a table wider than `bands` columns is written as bands of that many columns, each under the same row labels, with the
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
      {cell.zero ? (
        zeros === 'dot' ? (
          <>
            <span aria-hidden="true">·</span>
            <span className="mp-st__sr">0</span>
          </>
        ) : (
          cell.text
        )
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

function Grid({ model, form, zeros, from, to, labelled }: { model: TableModel; form: MatrixForm; zeros: ZeroStyle; from: number; to: number; labelled: string }) {
  const split = model.split;
  const total = model.colHeads.length;
  const cols = Array.from({ length: to - from }, (_, k) => from + k);
  const cutAt = split !== null && split.cols > 0 && split.cols < total ? split.cols : -1;
  // The name of a block of a partition stands in its top-left entry (and only where there is more than one block to tell apart).
  const nameAt = (r: number, c: number): string => {
    if (!split || split.rows === 0) return '';
    const [ff, fr, rf, rr] = split.names;
    if (r === 0 && c === 0) return ff;
    if (r === 0 && c === cutAt) return fr;
    if (r === split.rows && c === 0) return rf;
    if (r === split.rows && c === cutAt) return rr;
    return '';
  };
  return (
    <table className="mp-st__matrix" aria-labelledby={labelled} data-split={split ? 'true' : undefined}>
      <caption className="mp-st__sr">{model.caption}</caption>
      <thead>
        <tr>
          <td className="mp-st__corner" />
          {cols.map((c) => (
            <th key={c} scope="col" className={c === cutAt ? 'mp-st__cut-col' : undefined}>
              <Notation text={model.colHeads[c]} />
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {model.cells.map((row, r) => {
          const mark = model.rowMarks[r];
          const cutRow = split !== null && split.rows > 0 && r === split.rows;
          return (
            <tr key={r} className={cutRow ? 'mp-st__cut-row' : undefined}>
              <th scope="row" className={mark ? `mp-st__rowmark mp-st__rowmark--${mark}` : undefined} data-mark={mark ?? undefined}>
                {model.rowLabels[r]}
              </th>
              {cols.map((c) => {
                const cell = row[c];
                const name = nameAt(r, c);
                const members = cell.members && cell.members.length > 1 ? cell.members.join(', ') : undefined;
                const classes = [cell.hl ? `mp-st__hl mp-st__hl--${cell.hl}` : '', zeroClass(cell, form, zeros), c === cutAt ? 'mp-st__cut-col' : '', name ? 'mp-st__named' : ''].filter(Boolean).join(' ');
                return (
                  <td key={c} className={classes || undefined} data-hl={cell.hl ?? undefined} title={members}>
                    {name ? (
                      <span className="mp-st__block" aria-hidden="true">
                        <Notation text={name} />
                      </span>
                    ) : null}
                    <Entry cell={cell} form={form} zeros={zeros} />
                  </td>
                );
              })}
            </tr>
          );
        })}
      </tbody>
    </table>
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
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(model.tsv);
      setStatus(fill(w.matrix.copied, { name: model.name }));
    } catch {
      // No clipboard (an old browser, a page not served over https): the table is there to be selected.
      setStatus(fill(w.matrix.failed, { name: model.name }));
    }
    timer.current?.start();
  };
  const wide = total > 6;
  const titleId = `${uid}t`;
  const pieces = bands !== null && total > bands ? Array.from({ length: Math.ceil(total / bands) }, (_, k) => [k * bands, Math.min(total, (k + 1) * bands)] as const) : ([[0, total]] as const);
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
          <div className="mp-st__scroll" role="group" aria-labelledby={titleId} tabIndex={0}>
            <Grid model={model} form={form} zeros={zeros} from={from} to={to} labelled={titleId} />
          </div>
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
