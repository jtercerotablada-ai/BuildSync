'use client';

import React, { useMemo } from 'react';
import type { FrameAnalysis, MemberLine } from '@/lib/calc/frame/analysis';
import type { FrameShared, FrameUi } from '@/lib/calc/frame/strings';
import { fill, largerExtreme, sortMembers, type Fmt, type Order } from './text';

/**
 * The tables of the answer, under the form and the drawing: the reactions, the member end forces, the extremes along each member,
 * the node displacements and the equilibrium check - each a card with a heading the table is named by.
 *
 * It decides nothing about a number: `analysis.ts` hands over every value settled (what is rounding is zero there, once) and in the
 * units shown, and this file only writes it. A member is a button that marks it on the drawing, and the drawing marks it back.
 */

export interface FrameResultsProps {
  a: FrameAnalysis;
  w: FrameUi;
  t: FrameShared;
  fmt: Fmt;
  order: Order;
  onOrder: (order: Order) => void;
  active: number | null;
  picked: number | null;
  onPick: (label: number) => void;
  onHover: (label: number | null) => void;
  /** The id the whole block is reached by (the "skip to the results" link). */
  id: string;
  /** The tables are of the frame as it was a moment ago. */
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
  <span className="mp-frame__head" aria-hidden="true">
    {head(title, unit)}
  </span>
);

export function FrameResults({ a, w, t, fmt, order, onOrder, active, picked, onPick, onHover, id, busy }: FrameResultsProps) {
  const r = a.results;
  const ru = a.units;
  const sorted = useMemo<MemberLine[]>(() => (r ? sortMembers(r.members, order) : []), [r, order]);
  if (!r) return null;
  const { num, val } = fmt;
  const memberButton = (label: number) => (
    <button type="button" className="mp-frame__pick" aria-pressed={picked === label} aria-label={`${w.results.forces.member} ${label}`} title={w.results.forces.pick} onClick={() => onPick(label)} onFocus={() => onHover(label)} onBlur={() => onHover(null)}>
      {label}
    </button>
  );
  const rowMarks = (label: number) => ({
    'data-active': active === label ? 'true' : undefined,
    onPointerEnter: (e: React.PointerEvent) => {
      if (e.pointerType === 'mouse') onHover(label);
    },
    onPointerLeave: (e: React.PointerEvent) => {
      if (e.pointerType === 'mouse') onHover(null);
    },
  });
  const rx = w.results.reactions;
  const hasAlong = r.reactions.some((x) => x.along !== null);
  const hasSpring = r.reactions.some((x) => x.spring !== null);
  const hasDisp = r.displacements !== null;
  const topM = largerExtreme(r.extremes.M.max, r.extremes.M.min);
  const topV = largerExtreme(r.extremes.V.max, r.extremes.V.min);
  const topN = largerExtreme(r.extremes.N.max, r.extremes.N.min);
  const largestOf = (m: MemberLine, key: 'V' | 'N') => {
    const x = m.maxima[key];
    return Math.abs(x.max.value) >= Math.abs(x.min.value) ? x.max : x.min;
  };
  /** A value with the place it is at, marked when it is the largest of the whole frame. */
  const placed = (value: number, x: number, peak: boolean) => (
    <>
      <span className={peak ? 'mp-frame__peak' : undefined}>{val(value)}</span>
      {value === 0 ? null : <span className="mp-app__dir"> {fill(w.results.extremes.at, { x: num(x) })}</span>}
      {peak ? (
        <>
          <span aria-hidden="true" className="mp-frame__peak-mark">
            {' '}
            ●
          </span>
          <span className="mp-frame__sr"> ({w.results.extremes.peak})</span>
        </>
      ) : null}
    </>
  );
  const inflections = (m: MemberLine) => {
    const xs = [...new Set(m.stations.filter((s) => s.kind === 'zero-moment').map((s) => num(s.x)))];
    return xs.length ? xs.join(', ') : w.results.extremes.none;
  };

  return (
    <div className="mp-app__tables mp-frame__tables mp-frame__target" id={id} tabIndex={-1} aria-busy={busy ? true : undefined}>
      <div className="mp-app__card mp-app__card--wide">
        <h3 className="mp-app__h" id={`${id}-reactions`}>
          {t.results.reactions}
        </h3>
        <table className="mp-app__table mp-frame__table" role="table" aria-labelledby={`${id}-reactions`}>
          <thead role="rowgroup">
            <tr role="row">
              <th scope="col" role="columnheader">
                {head(t.results.support)}
              </th>
              <th scope="col" role="columnheader">
                {head(rx.node)}
              </th>
              <th scope="col" role="columnheader">
                {head(rx.type)}
              </th>
              <th scope="col" role="columnheader">
                {head(rx.rx, ru.force)}
              </th>
              <th scope="col" role="columnheader">
                {head(rx.ry, ru.force)}
              </th>
              <th scope="col" role="columnheader">
                {head(rx.rm, ru.moment)}
              </th>
              <th scope="col" role="columnheader">
                {head(rx.size, ru.force)}
              </th>
              {hasAlong ? (
                <th scope="col" role="columnheader">
                  {head(rx.along, ru.force)}
                </th>
              ) : null}
              {hasSpring ? (
                <th scope="col" role="columnheader">
                  {head(rx.spring)}
                </th>
              ) : null}
            </tr>
          </thead>
          <tbody role="rowgroup">
            {r.reactions.map((x) => (
              <tr key={x.label} role="row">
                <th scope="row" role="rowheader">
                  {under(t.results.support)}
                  {x.label}
                </th>
                <td role="cell">
                  {under(rx.node)}
                  {x.node}
                </td>
                <td role="cell">
                  {under(rx.type)}
                  {w.supports.kinds[x.kind]}
                  {x.angle !== null ? `, ${num(x.angle)}°` : ''}
                </td>
                <td role="cell">
                  {under(rx.rx, ru.force)}
                  {val(x.rx)}
                </td>
                <td role="cell">
                  {under(rx.ry, ru.force)}
                  {val(x.ry)}
                </td>
                <td role="cell">
                  {under(rx.rm, ru.moment)}
                  {val(x.rm)}
                </td>
                <td role="cell">
                  {under(rx.size, ru.force)}
                  {num(x.magnitude)}
                </td>
                {hasAlong ? (
                  <td role="cell">
                    {under(rx.along, ru.force)}
                    {x.along === null ? '—' : val(x.along)}
                  </td>
                ) : null}
                {hasSpring ? (
                  <td role="cell">
                    {under(rx.spring)}
                    {x.spring ? fill(rx.springValue, { fx: val(x.spring.fx), fy: val(x.spring.fy), m: val(x.spring.m) }) : '—'}
                  </td>
                ) : null}
              </tr>
            ))}
          </tbody>
        </table>
        <p className="mp-app__note">{rx.note}</p>
      </div>

      <div className="mp-app__card mp-app__card--wide">
        <h3 className="mp-app__h" id={`${id}-forces`}>
          {w.results.forces.title}
        </h3>
        <label className="mp-num mp-num--select mp-frame__order">
          <span className="mp-num__label">{w.results.forces.order}</span>
          <span className="mp-num__box">
            <select className="mp-num__input" value={order} onChange={(e) => onOrder(e.target.value as Order)}>
              <option value="member">{w.results.forces.orders.member}</option>
              <option value="M">{w.results.forces.orders.M}</option>
              <option value="V">{w.results.forces.orders.V}</option>
              <option value="N">{w.results.forces.orders.N}</option>
            </select>
          </span>
        </label>
        <table className="mp-app__table mp-frame__table mp-frame__table--forces" role="table" aria-labelledby={`${id}-forces`}>
          <thead role="rowgroup">
            <tr role="row">
              <th scope="col" role="columnheader">
                {head(w.results.forces.member)}
              </th>
              <th scope="col" role="columnheader">
                {head(w.results.forces.nodes)}
              </th>
              <th scope="col" role="columnheader">
                {head(w.results.forces.length, ru.length)}
              </th>
              <th scope="col" role="columnheader">
                {head(w.results.forces.Nstart, ru.force)}
              </th>
              <th scope="col" role="columnheader">
                {head(w.results.forces.Vstart, ru.force)}
              </th>
              <th scope="col" role="columnheader">
                {head(w.results.forces.Mstart, ru.moment)}
              </th>
              <th scope="col" role="columnheader">
                {head(w.results.forces.Nend, ru.force)}
              </th>
              <th scope="col" role="columnheader">
                {head(w.results.forces.Vend, ru.force)}
              </th>
              <th scope="col" role="columnheader">
                {head(w.results.forces.Mend, ru.moment)}
              </th>
            </tr>
          </thead>
          <tbody role="rowgroup">
            {sorted.map((m) => (
              <tr key={m.label} role="row" className="mp-frame__member" {...rowMarks(m.label)}>
                <th scope="row" role="rowheader">
                  {under(w.results.forces.member)}
                  {memberButton(m.label)}
                </th>
                <td role="cell">
                  {under(w.results.forces.nodes)}
                  {m.i} – {m.j}
                </td>
                <td role="cell">
                  {under(w.results.forces.length, ru.length)}
                  {num(m.length)}
                </td>
                <td role="cell">
                  {under(w.results.forces.Nstart, ru.force)}
                  {val(m.start.N)}
                </td>
                <td role="cell">
                  {under(w.results.forces.Vstart, ru.force)}
                  {val(m.start.V)}
                </td>
                <td role="cell">
                  {under(w.results.forces.Mstart, ru.moment)}
                  {val(m.start.M)}
                </td>
                <td role="cell">
                  {under(w.results.forces.Nend, ru.force)}
                  {val(m.end.N)}
                </td>
                <td role="cell">
                  {under(w.results.forces.Vend, ru.force)}
                  {val(m.end.V)}
                </td>
                <td role="cell">
                  {under(w.results.forces.Mend, ru.moment)}
                  {val(m.end.M)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        <p className="mp-app__note">{w.results.forces.signs}</p>
      </div>

      <div className="mp-app__card mp-app__card--wide">
        <h3 className="mp-app__h" id={`${id}-extremes`}>
          {w.results.extremes.title}
        </h3>
        <table className="mp-app__table mp-frame__table mp-frame__table--extremes" role="table" aria-labelledby={`${id}-extremes`}>
          <thead role="rowgroup">
            <tr role="row">
              <th scope="col" role="columnheader">
                {head(w.results.extremes.member)}
              </th>
              <th scope="col" role="columnheader">
                {head(w.results.extremes.maxM, ru.moment)}
              </th>
              <th scope="col" role="columnheader">
                {head(w.results.extremes.minM, ru.moment)}
              </th>
              <th scope="col" role="columnheader">
                {head(w.results.extremes.inflection, ru.length)}
              </th>
              <th scope="col" role="columnheader">
                {head(w.results.extremes.maxV, ru.force)}
              </th>
              <th scope="col" role="columnheader">
                {head(w.results.extremes.maxN, ru.force)}
              </th>
              {hasDisp ? (
                <th scope="col" role="columnheader">
                  {head(w.results.extremes.deflection, ru.displacement)}
                </th>
              ) : null}
            </tr>
          </thead>
          <tbody role="rowgroup">
            {sorted.map((m) => {
              const v = largestOf(m, 'V');
              const n = largestOf(m, 'N');
              return (
                <tr key={m.label} role="row" className="mp-frame__member" {...rowMarks(m.label)}>
                  <th scope="row" role="rowheader">
                    {under(w.results.extremes.member)}
                    {memberButton(m.label)}
                  </th>
                  <td role="cell">
                    {under(w.results.extremes.maxM, ru.moment)}
                    {placed(m.maxima.M.max.value, m.maxima.M.max.x, topM !== null && topM.member === m.label && topM.value === m.maxima.M.max.value)}
                  </td>
                  <td role="cell">
                    {under(w.results.extremes.minM, ru.moment)}
                    {placed(m.maxima.M.min.value, m.maxima.M.min.x, topM !== null && topM.member === m.label && topM.value === m.maxima.M.min.value && topM.value !== m.maxima.M.max.value)}
                  </td>
                  <td role="cell">
                    {under(w.results.extremes.inflection, ru.length)}
                    {inflections(m)}
                  </td>
                  <td role="cell">
                    {under(w.results.extremes.maxV, ru.force)}
                    {placed(v.value, v.x, topV !== null && topV.member === m.label && topV.value === v.value)}
                  </td>
                  <td role="cell">
                    {under(w.results.extremes.maxN, ru.force)}
                    {placed(n.value, n.x, topN !== null && topN.member === m.label && topN.value === n.value)}
                  </td>
                  {hasDisp ? (
                    <td role="cell">
                      {under(w.results.extremes.deflection, ru.displacement)}
                      {m.deflection === null ? '—' : placed(m.deflection.value, m.deflection.x, false)}
                    </td>
                  ) : null}
                </tr>
              );
            })}
          </tbody>
        </table>
        <p className="mp-app__note">{fill(w.results.extremes.note, { unit: ru.length })}</p>
      </div>

      {r.displacements ? (
        <div className="mp-app__card mp-app__card--wide">
          <h3 className="mp-app__h" id={`${id}-displacements`}>
            {w.results.displacements.title}
          </h3>
          <table className="mp-app__table mp-frame__table" role="table" aria-labelledby={`${id}-displacements`}>
            <thead role="rowgroup">
              <tr role="row">
                <th scope="col" role="columnheader">
                  {head(w.results.displacements.node)}
                </th>
                <th scope="col" role="columnheader">
                  {head(w.results.displacements.ux, ru.displacement)}
                </th>
                <th scope="col" role="columnheader">
                  {head(w.results.displacements.uy, ru.displacement)}
                </th>
                <th scope="col" role="columnheader">
                  {head(w.results.displacements.size, ru.displacement)}
                </th>
                <th scope="col" role="columnheader">
                  {head(w.results.displacements.rotation, 'rad')}
                </th>
              </tr>
            </thead>
            <tbody role="rowgroup">
              {r.displacements.map((d) => (
                <tr key={d.node} role="row">
                  <th scope="row" role="rowheader">
                    {under(w.results.displacements.node)}
                    {d.node}
                  </th>
                  <td role="cell">
                    {under(w.results.displacements.ux, ru.displacement)}
                    {val(d.ux)}
                  </td>
                  <td role="cell">
                    {under(w.results.displacements.uy, ru.displacement)}
                    {val(d.uy)}
                  </td>
                  <td role="cell">
                    {under(w.results.displacements.size, ru.displacement)}
                    {num(d.magnitude)}
                  </td>
                  <td role="cell">
                    {under(w.results.displacements.rotation, 'rad')}
                    {d.rotation === null || d.rotationDegrees === null ? w.results.displacements.free : `${val(d.rotation)} (${val(d.rotationDegrees, 3)}°)`}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="mp-app__note">{w.results.displacements.note}</p>
        </div>
      ) : (
        <div className="mp-app__card mp-app__card--wide">
          <h3 className="mp-app__h">{w.results.displacements.title}</h3>
          <p className="mp-app__note">{w.results.displacements.equal}</p>
        </div>
      )}

      <div className="mp-app__card">
        <h3 className="mp-app__h">{w.results.equilibrium.title}</h3>
        <dl className="mp-app__dl">
          <div>
            <dt>{w.results.equilibrium.applied}</dt>
            <dd>
              Fx {val(r.equilibrium.applied.fx)} · Fy {val(r.equilibrium.applied.fy)} {ru.force} · M {val(r.equilibrium.applied.m)} {ru.moment}
            </dd>
          </div>
          <div>
            <dt>{w.results.equilibrium.reacted}</dt>
            <dd>
              Fx {val(r.equilibrium.reacted.fx)} · Fy {val(r.equilibrium.reacted.fy)} {ru.force} · M {val(r.equilibrium.reacted.m)} {ru.moment}
            </dd>
          </div>
          <div>
            <dt>{w.results.equilibrium.sumFx}</dt>
            <dd>
              {num(r.equilibrium.sumFx)} {ru.force}
            </dd>
          </div>
          <div>
            <dt>{w.results.equilibrium.sumFy}</dt>
            <dd>
              {num(r.equilibrium.sumFy)} {ru.force}
            </dd>
          </div>
          <div>
            <dt>{fill(w.results.equilibrium.sumM, { x: num(r.equilibrium.about.x), y: num(r.equilibrium.about.y) })}</dt>
            <dd>
              {num(r.equilibrium.sumM)} {ru.moment}
            </dd>
          </div>
          <div>
            <dt>{w.results.equilibrium.joint}</dt>
            <dd>
              {num(r.equilibrium.joint)} {ru.force}
            </dd>
          </div>
        </dl>
        {r.equilibrium.balanced ? <p className="mp-app__note mp-frame__balanced">{w.results.equilibrium.balanced}</p> : <p className="mp-app__row-error">{w.results.equilibrium.unbalanced}</p>}
      </div>
    </div>
  );
}
