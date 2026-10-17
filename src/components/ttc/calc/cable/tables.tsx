import React from 'react';

/**
 * The cable calculator's tables of numbers: a real table, a head to every
 * column and a head to every row, in the page's own classes (calc.css) and the
 * unit of a column set after its title in the mono of every unit on the page.
 *
 * `stack` lays a row out on a phone as lines of two cells, each under its own
 * head (cable.css): a table of nine columns was three times the width of its
 * card. The head is then written a second time inside each cell, out of sight
 * everywhere else and silent always (`aria-hidden`): the table's own heads are
 * what is read.
 */

export interface Column {
  key: string;
  title: string;
  unit?: string;
}

export interface Row {
  key: string;
  /** The first cell is the row's head (`th scope="row"`); the rest are cells. */
  cells: React.ReactNode[];
  className?: string;
}

/** A head of a table: what the column is and, after it, its unit. */
export function Head({ title, unit }: { title: string; unit?: string }) {
  return (
    <>
      {title}
      {unit ? <span className="mp-plot__unit"> ({unit})</span> : null}
    </>
  );
}

export function DataTable({ columns, rows, stack = false, className = '' }: { columns: Column[]; rows: Row[]; stack?: boolean; className?: string }) {
  return (
    <table className={`mp-app__table mp-cable__table${stack ? ' mp-cable__table--stack' : ''} ${className}`.trim()}>
      <thead>
        <tr>
          {columns.map((c) => (
            <th key={c.key} scope="col">
              <Head title={c.title} unit={c.unit} />
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {rows.map((r) => (
          <tr key={r.key} className={r.className}>
            {r.cells.map((cell, i) => {
              const under = stack ? (
                <span className="mp-cable__head" aria-hidden="true">
                  <Head title={columns[i].title} unit={columns[i].unit} />
                </span>
              ) : null;
              return i === 0 ? (
                <th key={columns[i].key} scope="row">
                  {under}
                  {cell}
                </th>
              ) : (
                <td key={columns[i].key}>
                  {under}
                  {cell}
                </td>
              );
            })}
          </tr>
        ))}
      </tbody>
    </table>
  );
}
