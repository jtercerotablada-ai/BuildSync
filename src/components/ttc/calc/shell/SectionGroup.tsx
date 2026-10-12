'use client';

import React from 'react';
import { formatNumber } from '@/lib/calc/format';
import { MATERIALS, UNITS, type BeamForm, type MaterialKey, type SectionMode, type SectionProps, type UnitSystem } from '@/lib/calc/beam/model';
import type { BeamUi } from '@/lib/calc/beam/strings';
import { NumField } from '../NumField';
import { off, select } from './fields';
import type { SteelShapes } from './steel';

/**
 * THE CALCULATORS' SHELL — the "Section and material" group of a form.
 * (What the shell is, and a calculator built on it: index.ts.)
 *
 * The section a calculator turns its EI·v into a deflection with, and its
 * moments and shears into stresses: given by its properties (E, I, and the
 * optional S and shear area), as a rectangle, or as a rolled steel shape —
 * whose own weight may then be one of the loads. The same group on every
 * calculator that has a section, and the same `section` in its form
 * (lib/calc/beam/model.ts, `BeamForm['section']`; `sectionProps` works it
 * out, and `encodeBeam` shows how one is written in an address).
 *
 * It holds nothing: the section is the form's, edited through the two
 * callbacks; the shape table and what is typed to search it are the
 * calculator's (steel.ts), so that "Start over" can clear them.
 *
 * ITS FAULTS. A value that cannot be one (not a number, below zero) marks
 * its field here; the line that says so is the calculator's, in its results
 * box, and `describedBy` is that line's id while it is on screen. A shape
 * the table does not have is said twice — in that box, and here under the
 * list, at the id `${uid}shape` — in the same words (`unknownText`).
 */
export function SectionGroup({
  t,
  numbers,
  units,
  section: sec,
  worked,
  steel,
  uid,
  describedBy,
  unknownText,
  onSection,
  onMaterial,
  flush,
}: {
  /** The group's words, in the page's language: a prop from the server view, as all of a calculator's words are. */
  t: BeamUi['section'];
  /** How the page writes numbers (`formatNumber`, NumField). */
  numbers: BeamUi['numbers'];
  units: UnitSystem;
  /** The section as the form holds it. */
  section: BeamForm['section'];
  /** …and as worked out from it and the shape in use (`sectionProps`): for the line that shows what a rectangle or a shape comes to. */
  worked: SectionProps;
  steel: SteelShapes;
  /** What the ids of this form's messages begin with (the calculator's `useId`). */
  uid: string;
  /** The id of the line that says a value of the section cannot be one, while that line is on screen. */
  describedBy?: string;
  /** The line for a shape the table does not have, with its name in it: read only while `steel.unknown`. */
  unknownText: string;
  /** Some values of the section are to change. */
  onSection: (patch: Partial<BeamForm['section']>) => void;
  /** A material was chosen from the list: its modulus comes with it, in the form's units (model.ts, the `material` action). */
  onMaterial: (material: MaterialKey) => void;
  /** Brings the address up to date at once (address.ts, `flush`): the page is about to be loaded again, and comes back to its address. */
  flush: () => void;
}) {
  const u = UNITS[units];
  const num = (v: number, sig = 4) => formatNumber(v, sig, numbers.group);
  const { shapes, shape, filtered } = steel;
  const unknownShape = steel.unknown;
  // The id of the line about the section, for a field at fault.
  const said = (on: boolean) => (on ? describedBy : undefined);
  return (
    <fieldset className="mp-app__group">
      <legend>{t.title}</legend>
      <p className="mp-app__note">{t.intro}</p>
      <fieldset className="mp-seg">
        <legend className="mp-num__label">{t.mode}</legend>
        {(['props', 'rect', 'shape'] as SectionMode[]).map((key) => (
          <label key={key} className="mp-seg__item">
            <input type="radio" name="beam-section" checked={sec.mode === key} onChange={() => onSection({ mode: key })} />
            <span>{t.modes[key]}</span>
          </label>
        ))}
      </fieldset>

      {sec.mode !== 'shape' ? (
        <div className="mp-app__row mp-app__row--two">
          {select<MaterialKey>(
            t.material,
            sec.material,
            (['steel', 'aluminum', 'concrete', 'wood', 'custom'] as MaterialKey[]).map((key) => [key, t.materials[key]] as [MaterialKey, string]),
            (material) => onMaterial(material),
          )}
          <NumField
            numbers={numbers}
            label={t.E}
            unit={u.E}
            value={sec.E}
            onChange={(E) => onSection({ E, material: sec.material !== 'custom' && E !== MATERIALS[sec.material][units] ? 'custom' : sec.material })}
            invalid={off(sec.E)}
            describedBy={said(off(sec.E))}
          />
        </div>
      ) : null}
      {/* What a listed modulus assumes, while it is the one in use. Under
          the fields, not in the list: a closed list cuts a long name off,
          on screen and on paper. */}
      {sec.mode !== 'shape' && (sec.material === 'concrete' || sec.material === 'wood') && sec.E === MATERIALS[sec.material][units] ? <p className="mp-app__note">{t.materialNote[sec.material]}</p> : null}

      {sec.mode === 'props' ? (
        <div className="mp-app__row mp-app__row--three">
          <NumField numbers={numbers} label={t.I} unit={u.I} value={sec.I} onChange={(I) => onSection({ I })} invalid={off(sec.I)} describedBy={said(off(sec.I))} />
          <NumField numbers={numbers} label={t.S} unit={u.S} value={sec.S} onChange={(S) => onSection({ S })} optional={t.optional} invalid={off(sec.S)} describedBy={said(off(sec.S))} />
          <NumField numbers={numbers} label={t.Av} unit={u.A} value={sec.Av} onChange={(Av) => onSection({ Av })} optional={t.optional} invalid={off(sec.Av)} describedBy={said(off(sec.Av))} />
        </div>
      ) : null}

      {sec.mode === 'rect' ? (
        <>
          <div className="mp-app__row mp-app__row--two">
            <NumField numbers={numbers} label={t.b} unit={u.dim} value={sec.b} onChange={(b) => onSection({ b })} invalid={off(sec.b)} describedBy={said(off(sec.b))} />
            <NumField numbers={numbers} label={t.h} unit={u.dim} value={sec.h} onChange={(h) => onSection({ h })} invalid={off(sec.h)} describedBy={said(off(sec.h))} />
          </div>
          <p className="mp-app__computed">
            {t.computed}: I = {num(worked.I, 6)} {u.I}, S = {num(worked.S, 6)} {u.S}
          </p>
        </>
      ) : null}

      {sec.mode === 'shape' ? (
        shapes ? (
          <>
            <div className="mp-app__row mp-app__row--two">
              {/* A tool for finding a shape, not a value of the beam: left off the printed sheet (calc.css). */}
              <label className="mp-num mp-num--filter">
                <span className="mp-num__label">{t.filter}</span>
                <span className="mp-num__box">
                  <input className="mp-num__input" type="text" value={steel.filter} onChange={(e) => steel.setFilter(e.target.value)} placeholder={t.filterHint} autoComplete="off" spellCheck={false} />
                </span>
              </label>
              <label className="mp-num mp-num--select" data-invalid={unknownShape ? 'true' : undefined}>
                <span className="mp-num__label">{t.shape}</span>
                <span className="mp-num__box">
                  <select
                    className="mp-num__input"
                    value={sec.shape}
                    onChange={(e) => onSection({ shape: e.target.value })}
                    aria-invalid={unknownShape ? true : undefined}
                    aria-describedby={unknownShape ? `${uid}shape` : undefined}
                  >
                    {/* A name the table does not have is shown as it came, and can only be left:
                        without it the list fell on its first shape, which then looked chosen. */}
                    {unknownShape ? (
                      <option value={sec.shape} disabled>
                        {sec.shape}
                      </option>
                    ) : null}
                    {/* The shape in use stays listed while the filter narrows the rest. */}
                    {shape && !filtered.includes(shape) ? <option value={shape.designation}>{shape.designation}</option> : null}
                    {filtered.map((s) => (
                      <option key={s.designation} value={s.designation}>
                        {s.designation}
                      </option>
                    ))}
                  </select>
                </span>
              </label>
            </div>
            {unknownShape ? (
              <p className="mp-app__row-error" id={`${uid}shape`}>
                {unknownText}
              </p>
            ) : null}
            {filtered.length === 0 ? <p className="mp-app__none">{t.noMatch}</p> : null}
            {shape ? (
              <p className="mp-app__computed">
                {shape.designation}: E = {num(worked.E, 6)} {u.E}, I = {num(worked.I, 6)} {u.I}, S = {num(worked.S, 6)} {u.S}
              </p>
            ) : null}
            {/* Without a shape there is no weight to include: the box is not shown ticked for one. */}
            <label className="mp-app__check">
              <input type="checkbox" checked={sec.selfWeight && shape !== null} disabled={!shape} onChange={(e) => onSection({ selfWeight: e.target.checked })} />
              <span>
                {t.selfWeight}
                {shape ? ` (${num(units === 'us' ? shape.weight : shape.weight * 1.48816394, 4)} ${u.weight})` : ''}
              </span>
            </label>
          </>
        ) : (
          <>
            <p className="mp-app__none" role="status">
              {steel.failed ? t.loadFailed : t.loading}
            </p>
            {steel.failed ? (
              <button
                type="button"
                className="mp-app__btn"
                onClick={() => {
                  // The case and "Steel shape" are in the address: the page comes back to both.
                  flush();
                  window.location.reload();
                }}
              >
                {t.reload}
              </button>
            ) : null}
          </>
        )
      ) : null}
    </fieldset>
  );
}
