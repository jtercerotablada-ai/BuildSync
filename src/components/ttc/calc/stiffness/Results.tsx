'use client';

import React from 'react';
import { TOLERANCES, type StiffnessAnalysis } from '@/lib/calc/stiffness/analysis';
import type { StiffnessShared, StiffnessUi } from '@/lib/calc/stiffness/strings';
import { fill, type Fmt } from './text';
import { formatCell } from './numfmt';

/**
 * The tables of the answer, above the worked solution: the displacements of the nodes, the reactions, and the forces in the members
 * (the bars' axial force, state, stress and elongation; or a frame member's N, V and M at both ends) - each a card with a heading the
 * table is named by - and the equilibrium check, with the one word that says whether it holds.
 *
 * It decides nothing about a number: `analysis.ts` hands over every value settled (what is rounding is zero there, once) and in the units
 * shown, and this file only writes it. Never a "-0", never a NaN, never an e-notation: a value is a number with its sign or a dash for a
 * movement a support does not hold.
 */

export interface ResultsProps {
  a: StiffnessAnalysis;
  w: StiffnessUi;
  t: StiffnessShared;
  fmt: Fmt;
  /** The id the whole block is reached by (the "skip to the results" link). */
  id: string;
  /** The tables are of the structure as it was a moment ago. */
  busy: boolean;
}

/** A head of a table: what the column is and, after it, its unit. */
const head = (title: string, unit?: string) => (
  <>
    {title}
    {unit ? <span className="mp-plot__unit"> ({unit})</span> : null}
  </>
);
/** The same head inside a cell, for a phone: there a row is laid out as lines of its own and each cell stands under its head. Silent: the table's own heads are read. */
const under = (title: string, unit?: string) => (
  <span className="mp-st__head" aria-hidden="true">
    {head(title, unit)}
  </span>
);

export function Results({ a, w, t, fmt, id, busy }: ResultsProps) {
  const r = a.results;
  if (!r) return null;
  const ru = a.units;
  const frame = a.mode === 'frame';
  const { num, val } = fmt;
  const s = w.results.summary;
  const hasMoment = frame && r.reactions.some((x) => x.rm !== null);
  const th = (key: string, children: React.ReactNode) => (
    <th key={key} scope="col" role="columnheader">
      {children}
    </th>
  );
  const eq = r.equilibrium;
  const tol = formatCell(TOLERANCES.residual, { sig: 1, style: 'scientific', group: ',' });
  return (
    <div className="mp-app__tables mp-st__tables-out mp-st__target" id={id} tabIndex={-1} aria-busy={busy ? true : undefined}>
      <div className="mp-app__card mp-app__card--wide">
        <h3 className="mp-app__h" id={`${id}-displacements`}>
          {s.displacements.title}
        </h3>
        <table className="mp-app__table mp-st__table" role="table" aria-labelledby={`${id}-displacements`}>
          <thead role="rowgroup">
            <tr role="row">
              {th('n', head(s.displacements.node))}
              {th('x', head(s.displacements.ux, ru.displacement))}
              {th('y', head(s.displacements.uy, ru.displacement))}
              {th('t', head(s.displacements.size, ru.displacement))}
              {frame ? th('r', head(s.displacements.rotation, ru.rotation)) : null}
              {frame ? th('d', head(s.displacements.degrees, '°')) : null}
            </tr>
          </thead>
          <tbody role="rowgroup">
            {r.displacements.map((d) => (
              <tr key={d.node} role="row">
                <th scope="row" role="rowheader">
                  {under(s.displacements.node)}
                  {d.node}
                </th>
                <td role="cell">
                  {under(s.displacements.ux, ru.displacement)}
                  {val(d.ux)}
                </td>
                <td role="cell">
                  {under(s.displacements.uy, ru.displacement)}
                  {val(d.uy)}
                </td>
                <td role="cell">
                  {under(s.displacements.size, ru.displacement)}
                  {num(d.magnitude)}
                </td>
                {frame ? (
                  <td role="cell">
                    {under(s.displacements.rotation, ru.rotation)}
                    {d.rotation === null ? '—' : val(d.rotation)}
                  </td>
                ) : null}
                {frame ? (
                  <td role="cell">
                    {under(s.displacements.degrees, '°')}
                    {d.rotationDegrees === null ? '—' : val(d.rotationDegrees)}
                  </td>
                ) : null}
              </tr>
            ))}
          </tbody>
        </table>
        <p className="mp-app__note">{s.displacements.note}</p>
      </div>

      <div className="mp-app__card mp-app__card--wide">
        <h3 className="mp-app__h" id={`${id}-reactions`}>
          {s.reactions.title}
        </h3>
        <table className="mp-app__table mp-st__table" role="table" aria-labelledby={`${id}-reactions`}>
          <thead role="rowgroup">
            <tr role="row">
              {th('s', head(t.supports.title))}
              {th('n', head(s.reactions.node))}
              {th('x', head(s.reactions.rx, ru.force))}
              {th('y', head(s.reactions.ry, ru.force))}
              {hasMoment ? th('m', head(s.reactions.rm, ru.moment)) : null}
            </tr>
          </thead>
          <tbody role="rowgroup">
            {r.reactions.map((x) => (
              <tr key={x.label} role="row">
                <th scope="row" role="rowheader">
                  {under(t.supports.title)}
                  {x.label}
                </th>
                <td role="cell">
                  {under(s.reactions.node)}
                  {x.node}
                </td>
                <td role="cell">
                  {under(s.reactions.rx, ru.force)}
                  {x.rx === null ? s.reactions.free : val(x.rx)}
                </td>
                <td role="cell">
                  {under(s.reactions.ry, ru.force)}
                  {x.ry === null ? s.reactions.free : val(x.ry)}
                </td>
                {hasMoment ? (
                  <td role="cell">
                    {under(s.reactions.rm, ru.moment)}
                    {x.rm === null ? s.reactions.free : val(x.rm)}
                  </td>
                ) : null}
              </tr>
            ))}
          </tbody>
        </table>
        <p className="mp-app__note">{s.reactions.note}</p>
      </div>

      {frame ? (
        <div className="mp-app__card mp-app__card--wide">
          <h3 className="mp-app__h" id={`${id}-members`}>
            {s.members.title}
          </h3>
          <table className="mp-app__table mp-st__table" role="table" aria-labelledby={`${id}-members`}>
            <thead role="rowgroup">
              <tr role="row">
                {th('m', head(s.members.member))}
                {th('n', head(s.members.nodes))}
                {th('l', head(s.members.length, ru.length))}
                {th('ni', head(s.members.Ni, ru.force))}
                {th('vi', head(s.members.Vi, ru.force))}
                {th('mi', head(s.members.Mi, ru.moment))}
                {th('nj', head(s.members.Nj, ru.force))}
                {th('vj', head(s.members.Vj, ru.force))}
                {th('mj', head(s.members.Mj, ru.moment))}
              </tr>
            </thead>
            <tbody role="rowgroup">
              {r.members.map((m) => (
                <tr key={m.label} role="row">
                  <th scope="row" role="rowheader">
                    {under(s.members.member)}
                    {m.label}
                  </th>
                  <td role="cell">
                    {under(s.members.nodes)}
                    {m.i} – {m.j}
                  </td>
                  <td role="cell">
                    {under(s.members.length, ru.length)}
                    {num(m.length)}
                  </td>
                  <td role="cell">
                    {under(s.members.Ni, ru.force)}
                    {val(m.start.N)}
                  </td>
                  <td role="cell">
                    {under(s.members.Vi, ru.force)}
                    {val(m.start.V)}
                  </td>
                  <td role="cell">
                    {under(s.members.Mi, ru.moment)}
                    {val(m.start.M)}
                  </td>
                  <td role="cell">
                    {under(s.members.Nj, ru.force)}
                    {val(m.end.N)}
                  </td>
                  <td role="cell">
                    {under(s.members.Vj, ru.force)}
                    {val(m.end.V)}
                  </td>
                  <td role="cell">
                    {under(s.members.Mj, ru.moment)}
                    {val(m.end.M)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="mp-app__note">{s.members.note}</p>
        </div>
      ) : (
        <div className="mp-app__card mp-app__card--wide">
          <h3 className="mp-app__h" id={`${id}-bars`}>
            {s.bars.title}
          </h3>
          <table className="mp-app__table mp-st__table" role="table" aria-labelledby={`${id}-bars`}>
            <thead role="rowgroup">
              <tr role="row">
                {th('m', head(s.bars.member))}
                {th('n', head(s.bars.nodes))}
                {th('l', head(s.bars.length, ru.length))}
                {th('f', head(s.bars.N, ru.force))}
                {th('s', head(s.bars.state))}
                {th('t', head(s.bars.stress, ru.stress))}
                {th('e', head(s.bars.elongation, ru.displacement))}
              </tr>
            </thead>
            <tbody role="rowgroup">
              {r.members.map((m) => (
                <tr key={m.label} role="row">
                  <th scope="row" role="rowheader">
                    {under(s.bars.member)}
                    {m.label}
                  </th>
                  <td role="cell">
                    {under(s.bars.nodes)}
                    {m.i} – {m.j}
                  </td>
                  <td role="cell">
                    {under(s.bars.length, ru.length)}
                    {num(m.length)}
                  </td>
                  <td role="cell">
                    {under(s.bars.N, ru.force)}
                    {m.bar ? val(m.bar.N) : '—'}
                  </td>
                  <td role="cell">
                    {under(s.bars.state)}
                    {m.bar ? s.bars.states[m.bar.state] : '—'}
                  </td>
                  <td role="cell">
                    {under(s.bars.stress, ru.stress)}
                    {m.bar ? val(m.bar.stress) : '—'}
                  </td>
                  <td role="cell">
                    {under(s.bars.elongation, ru.displacement)}
                    {m.bar ? val(m.bar.elongation) : '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="mp-app__note">{s.bars.note}</p>
        </div>
      )}

      <div className="mp-app__card mp-app__card--wide">
        <h3 className="mp-app__h" id={`${id}-equilibrium`}>
          {s.equilibrium.title}
        </h3>
        <dl className="mp-app__dl mp-st__equilibrium" aria-labelledby={`${id}-equilibrium`}>
          <div>
            <dt>{s.equilibrium.sumFx}</dt>
            <dd>
              {val(eq.sumFx)} {ru.force}
            </dd>
          </div>
          <div>
            <dt>{s.equilibrium.sumFy}</dt>
            <dd>
              {val(eq.sumFy)} {ru.force}
            </dd>
          </div>
          <div>
            <dt>{fill(s.equilibrium.sumM, { x: num(eq.about.x), y: num(eq.about.y) })}</dt>
            <dd>
              {val(eq.sumM)} {ru.moment}
            </dd>
          </div>
        </dl>
        <p className={eq.balanced ? 'mp-app__computed mp-st__balanced' : 'mp-app__computed mp-st__unbalanced'} data-balanced={eq.balanced ? 'true' : 'false'}>
          {fill(eq.balanced ? s.equilibrium.balanced : s.equilibrium.unbalanced, { tol })}
        </p>
      </div>
    </div>
  );
}
