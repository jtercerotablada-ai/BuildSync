'use client';

import React, { memo, useCallback, useDeferredValue, useId, useMemo, useReducer, useRef, useState } from 'react';
import { flushSync } from 'react-dom';
import { formatNumber } from '@/lib/calc/format';
import { analyseSafely, type AnalysisIssue, type ShapeLine, type StateTableRow } from '@/lib/calc/cable-sag/analysis';
import {
  CABLE_SAG_KEY,
  CABLE_UNITS,
  MATERIAL_IDS,
  MAX_FACTOR_ROWS,
  MAX_POINT_LOADS,
  MODES,
  decodeCableSag,
  defaultCase,
  defaultCaseFor,
  encodeCableSag,
  reduceCableSag,
  type CableSagAction,
  type CableSagForm,
  type CableSagMode,
  type MaterialId,
} from '@/lib/calc/cable-sag/model';
import type { CableSagShared, CableSagUi } from '@/lib/calc/cable-sag/strings';
import { NumField } from '../NumField';
import { Actions } from '../shell/Actions';
import { useAddress } from '../shell/address';
import { select } from '../shell/fields';
import { PAPER_WIDTH, useTooTall, useWidth } from '../shell/layout';
import { arrow, settle } from '../shell/results';
import { SheetStamp, useSheet } from '../shell/sheet';
import { CableSchematic } from './CableSchematic';
import { SweepChart, type ChartPoint } from './SweepChart';
import { fieldKey, fill, issueSentence, percent, readingOf, rowSentence, signed, tableNote, warningSentence, type Context, type TableName } from './text';
import './cable-sag.css';

/**
 * CABLE SAG AND PRETENSION - the calculator (/resources/cable-sag).
 *
 * The seventh calculator of the catalogue, and the truss's sibling
 * (truss/TrussCalculator.tsx): the form on the left, the answer on the right and nothing
 * between them - every keystroke that leaves a number in a field solves the cable again, a
 * moment after the key and not inside it (`solved`, below: a pathological cable is some
 * three quarters of a second of arithmetic); the address follows the cable (`#g=...`);
 * nothing leaves the browser; its words are props; it renders on the server with its
 * example. What is the same from one calculator to the next is the shell's (../shell) and
 * the number field (../NumField), used here as they are and not copied.
 *
 * WHAT IS THIS ONE'S. Three modes of one cable, chosen at the top and kept apart in the
 * form (switching loses nothing):
 *
 *   hanging   a cable between two supports under its own weight, a load along the span, or
 *             both; one thing known (a sag, the pretension, a tension at a support, the
 *             length); the tension at both supports, the reactions, the angles, the lowest
 *             point, the lengths and the stretch; the parabola against the exact cable.
 *   state     the same cable in a second state (another load, another temperature): the new
 *             pretension, sag, tensions and length, with two tables - over temperature and
 *             over load - each as numbers and as two small charts.
 *   points    up to 12 point loads, the cable's weight left out: the funicular polygon, every
 *             joint, every piece's tension, angle and length, the reactions.
 *
 * All the arithmetic is in lib/calc/cable-sag: `model.ts` (the form, what each edit does to
 * it, the address), `engine.ts` (the cable), and `analysis.ts`, which hands this file every
 * number it prints ALREADY SETTLED and in the units shown - what is rounding is zero there,
 * once. This file is the form, the tables and the wiring: it decides nothing about a number.
 * What it does decide is how one is written, and the sentence that goes with each code.
 *
 * TWO SETS OF WORDS. `t` is the part of the first calculator's that says the same on any
 * calculator (lib/calc/cable-sag/strings.ts, `CableSagShared`). `w` is what is about a cable.
 * Neither file is imported here - both languages would travel with the script.
 */

/** The example cable, as it is written in an address. */
const EXAMPLE = encodeCableSag(defaultCase());

const Schematic = memo(CableSchematic);

/**
 * What the fragment of an address opens. `undefined`: it is not this calculator's (`#main` is
 * a place on the page; `#t=...` is the truss's). `null`: it is, and cannot be read - its key
 * with nothing after it included.
 */
function caseIn(hash: string): CableSagForm | null | undefined {
  const m = hash.match(new RegExp(`^#${CABLE_SAG_KEY}=(.*)$`));
  if (!m) return undefined;
  let text = m[1];
  try {
    text = decodeURIComponent(text);
  } catch {
    /* not percent-encoded: read as it is */
  }
  return decodeCableSag(text);
}

/**
 * A form but for the numbers typed into it: its units, its mode, every choice made in it - and
 * the ids of the point loads, which are numbers but not typed ones: a load added or removed is
 * a different cable, solved in the render that shows it.
 */
const IDENTIFIERS = new Set(['id', 'nextId']);
const choicesOf = (form: CableSagForm) => JSON.stringify(form, (key, value: unknown) => (typeof value === 'number' && !IDENTIFIERS.has(key) ? 0 : value));

/* What is known in a hanging cable, as one list: the form holds a kind and, for a sag, which sag. */
type KnownChoice = 'sag-mid' | 'sag-low' | 'H' | 'T-high' | 'T-low' | 'length';
const KNOWN_CHOICES: readonly KnownChoice[] = ['sag-mid', 'sag-low', 'H', 'T-high', 'T-low', 'length'];
const choiceOf = (f: CableSagForm): KnownChoice => (f.known === 'sag' ? (f.sagKind === 'low' ? 'sag-low' : 'sag-mid') : f.known);
const knownPatch = (c: KnownChoice): Extract<CableSagAction, { type: 'known' }>['patch'] => (c === 'sag-mid' ? { known: 'sag', sagKind: 'mid' } : c === 'sag-low' ? { known: 'sag', sagKind: 'low' } : { known: c });

const POINTS_KNOWN = ['sag', 'H', 'T-max'] as const;

/** A value that cannot be one where a size is asked for: not a number, or not above zero. */
const bad = (v: number) => !Number.isFinite(v) || v <= 0;

/* ── Tables ───────────────────────────────────────────────────────────── */

type Col = { title: string; unit?: string };
type Cell = React.ReactNode | { span: number; node: React.ReactNode };
interface TableRow {
  key: string | number;
  cells: Cell[];
  className?: string;
}
const isSpan = (c: Cell): c is { span: number; node: React.ReactNode } => typeof c === 'object' && c !== null && 'span' in c && 'node' in c;

/** A head of a table: what the column is and, after it, its unit - in the mono of every unit on the page. */
const head = (col: Col) => (
  <>
    {col.title}
    {col.unit ? <span className="mp-plot__unit"> ({col.unit})</span> : null}
  </>
);
/** The same head inside a cell, for a phone: there a row is laid out as lines of its own and each cell stands under its head. Out of sight anywhere else, and silent everywhere. */
const under = (col: Col) => (
  <span className="mp-cs__head" aria-hidden="true">
    {head(col)}
  </span>
);

/** A table of numbers: the first column names the row, every other is a cell under its head. */
function DataTable({ cols, rows, className = '' }: { cols: Col[]; rows: TableRow[]; className?: string }) {
  return (
    <table className={`mp-app__table mp-cs__table ${className}`.trim()} role="table">
      <thead role="rowgroup">
        <tr role="row">
          {cols.map((c, i) => (
            <th key={i} scope="col" role="columnheader">
              {head(c)}
            </th>
          ))}
        </tr>
      </thead>
      <tbody role="rowgroup">
        {rows.map((r) => {
          let at = 0;
          return (
            <tr key={r.key} role="row" className={r.className}>
              {r.cells.map((c, i) => {
                const col = cols[Math.min(at, cols.length - 1)];
                const span = isSpan(c) ? c.span : 1;
                const node = isSpan(c) ? c.node : c;
                at += span;
                return i === 0 ? (
                  <th key={i} scope="row" role="rowheader">
                    {under(col)}
                    {node}
                  </th>
                ) : (
                  <td key={i} role="cell" colSpan={span > 1 ? span : undefined}>
                    {under(col)}
                    {node}
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

/**
 * `initial`: the cable it opens with, where that is not the example - for the tests, which can
 * neither type nor press.
 */
export function CableSagCalculator({ t, w, initial }: { t: CableSagShared; w: CableSagUi; initial?: CableSagForm }) {
  const [form, dispatch] = useReducer(reduceCableSag, initial, (given) => given ?? defaultCase());
  // The cable last put on screen whole - opened from the address, or the example on "Start over": that one is
  // solved in the render that shows it (`solved`, below), never a moment later under the results of the cable before.
  const [whole, setWhole] = useState<CableSagForm | null>(null);
  const [show, setShow] = useState({ tensions: true, dims: true, load: true, parabola: true });
  const uid = useId();
  // The calculator itself: a cable opened from the address asks whether the focus is in one of its fields.
  const root = useRef<HTMLDivElement>(null);
  const [plotRef, windowWidth] = useWidth<HTMLDivElement>();
  const [tablesRef, tablesWidth] = useWidth<HTMLDivElement>();
  const [outRef, tooTall] = useTooTall<HTMLElement>();
  const u = CABLE_UNITS[form.units];
  const group = t.numbers.group;

  // THE ADDRESS FOLLOWS THE CABLE (../shell/address.ts).
  const code = useCallback(() => encodeCableSag(form), [form]);
  const address = useAddress<CableSagForm>({
    key: CABLE_SAG_KEY,
    example: EXAMPLE,
    code,
    read: caseIn,
    blank: defaultCase,
    // A cable in the address opens as that cable.
    open: (found) => {
      // An edit in progress is an edit of the cable before, and ends here. The field with the focus is left FIRST:
      // it would go on showing what was typed into that cable, and fall back on that cable's value at the first key
      // that is not a number (NumField).
      const focused = document.activeElement;
      if (focused instanceof HTMLInputElement && root.current?.contains(focused)) focused.blur();
      dispatch({ type: 'load', form: found });
      setWhole(found);
    },
  });
  const { linkError } = address;
  // The printed sheet gives the address that opens this very cable, and while it prints the drawing is the sheet's size.
  const { stamp, onPaper } = useSheet({ locale: t.sheet.locale, url: () => address.link(encodeCableSag(form)) });
  const width = onPaper ? PAPER_WIDTH : windowWidth;
  const chartWidth = onPaper ? 350 : tablesWidth >= 700 ? Math.floor((tablesWidth - 24) / 2) : tablesWidth;

  // WHICH CABLE IS SOLVED. A cable at the far end of what the engine takes is some three quarters of a second of
  // arithmetic, and inside the keystroke that kept the key off the screen for as long. So while only NUMBERS change,
  // the answer is of the form as it was a moment ago (`useDeferredValue`): the key shows at once, and the cable is
  // solved in a render of its own, which the next key may interrupt. The results say so while they are behind
  // (`aria-busy`). Anything else - the units, the mode, a load added or removed, a choice in a list, a cable opened
  // whole - is solved in the same render as ever: the answer must never stand under other units, beside rows it was
  // not solved for, or under a cable it is not of. And on paper it is the form itself: a sheet is never printed with
  // the answer of the cable before.
  const behind = useDeferredValue(form);
  const solved = onPaper || form === whole || choicesOf(behind) !== choicesOf(form) ? form : behind;
  const catching = solved !== form;

  // Everything the page prints (lib/calc/cable-sag/analysis.ts) - through the door that never throws.
  const a = useMemo(() => analyseSafely(solved), [solved]);
  const ru = a.units;
  const hang = a.hanging;
  const st = a.state;
  const pts = a.points;

  // Every number this page prints, with the page's own mark between thousands.
  // A true minus, as the tables of the other calculators write one; the fields keep the hyphen they read back.
  const num = useCallback((v: number, sig = 4) => formatNumber(v, sig, group).replace(/^-/, '−'), [group]);
  const signedNum = (v: number, sig = 4) => signed(formatNumber(Math.abs(v), sig, group), v);
  const withUnit = (v: number, unit: string, sig = 4) => `${num(v, sig)} ${unit}`;
  // The support the largest tension is at, or both where the two are the same to the figures shown.
  const supportOf = (s: ShapeLine) => (num(s.tension.A) === num(s.tension.B) ? 'both' : s.tension.maxAt);
  const pointed = (v: number, plus: string, minus: string) => (
    <>
      {num(Math.abs(v))} <span className="mp-app__dir">{v === 0 ? '' : arrow(v, plus, minus)}</span>
    </>
  );
  const ctx: Context = { num, length: ru.length, force: ru.force, span: solved.span, temp: ru.temp, line: ru.line };
  const levelText = (z: number, below: string, above: string, level: string) => (z === 0 ? level : fill(z < 0 ? below : above, { value: withUnit(Math.abs(z), ru.length) }));

  /* -- The faults, by field -- */
  const idOf = (key: string) => `${uid}${key}`;
  const pointLabel = (id: number) => form.points.findIndex((p) => p.id === id) + 1;
  const prefixOf = (i: AnalysisIssue): string => {
    const k = fieldKey(i.field);
    if (/^point\d+$/.test(k)) return `${w.points.name} ${i.at ?? pointLabel(Number(k.slice(5)))}`.trim();
    switch (k) {
      case 'span':
      case 'rise':
        return w.geometry.title;
      case 'q':
      case 'weight':
        return w.load.title;
      case 'known':
        return solved.mode === 'points' ? w.points.known.title : w.known.title;
      case 'sagAt':
        return w.points.known.title;
      case 'section':
        return t.section.title;
      case 'table.thermal':
      case 'table.loads':
        return w.tables.title;
      case 'points':
        return w.points.title;
      default:
        return '';
    }
  };
  const says = (issue: AnalysisIssue, where = false): string => {
    const text = issueSentence(issue, w, ctx);
    const prefix = where ? prefixOf(issue) : '';
    return prefix ? `${prefix}: ${text}` : text;
  };
  const hasIssue = (key: string) => a.issues.some((i) => fieldKey(i.field) === key);
  // A field at fault: marked, and tied to the message that says so.
  const fault = (...keys: string[]) => {
    const key = keys.find(hasIssue);
    return key ? { invalid: true, describedBy: idOf(key) } : {};
  };
  const line = (key: string) => {
    const texts = [...new Set(a.issues.filter((i) => fieldKey(i.field) === key).map((i) => says(i)))];
    return texts.length ? (
      <p className="mp-app__row-error" id={idOf(key)}>
        {texts.join(' ')}
      </p>
    ) : null;
  };
  // The values of the section that cannot be one; with a fault in the section and none of them to blame, all of them.
  const sectionFault = hasIssue('section');
  const secBad = {
    diameter: solved.sectionBy === 'diameter' && bad(solved.diameter),
    fill: solved.sectionBy === 'diameter' && bad(solved.fill),
    area: solved.sectionBy === 'area' && bad(solved.area),
    E: solved.elastic && bad(solved.E),
    gamma: solved.weightFrom === 'section' && bad(solved.gamma),
    lay: solved.weightFrom === 'section' && bad(solved.lay),
  };
  const secMark = (k: keyof typeof secBad) => (sectionFault && (secBad[k] || !Object.values(secBad).some(Boolean)) ? { invalid: true, describedBy: idOf('section') } : {});
  // What the results box says, each thing once.
  const notices = a.issues.map((i) => ({ id: `${uid}box${i.code}`, text: says(i, true) })).filter((n, i, all) => all.findIndex((m) => m.text === n.text) === i);

  /* -- Rows of point loads -- */
  const removeRow = (id: number) => (press: React.MouseEvent<HTMLButtonElement>) => {
    // A row removed WITH THE KEYBOARD took the focus away with it, and the browser left it on nothing. It is given to the
    // first control of the row that takes the place - the next one, else the one before - or to the group's "add" button
    // when no row is left. Not after a click or a tap (`detail` counts them, and is 0 for a key).
    const row = press.currentTarget.closest('.mp-app__item');
    const near = [row?.nextElementSibling, row?.previousElementSibling].find((el) => el?.classList.contains('mp-app__item'));
    const next = press.detail === 0 ? (near?.querySelector<HTMLElement>('input, select') ?? press.currentTarget.closest('fieldset')?.querySelector<HTMLElement>('.mp-app__add')) : null;
    dispatch({ type: 'point-remove', id });
    next?.focus();
  };
  const addRow = (press: React.MouseEvent<HTMLButtonElement>) => {
    // A row added WITH THE KEYBOARD is handed the focus, in its first field. The row is put on screen first (`flushSync`).
    if (press.detail !== 0) {
      dispatch({ type: 'point-add' });
      return;
    }
    const fieldset = press.currentTarget.closest('fieldset');
    flushSync(() => dispatch({ type: 'point-add' }));
    const rows = fieldset?.querySelectorAll('.mp-app__item');
    rows?.[rows.length - 1]?.querySelector<HTMLElement>('input, select')?.focus();
  };
  const full = form.points.length >= MAX_POINT_LOADS;
  const limited = full || form.notice?.code === 'limit';

  /* -- Modes -- */
  const chooseMode = (mode: CableSagMode) => {
    if (mode === form.mode) return;
    // A cable nobody has edited has nothing to lose: the mode opens on its own example, not on the other mode's numbers.
    const untouched = encodeCableSag(form) === encodeCableSag(defaultCaseFor(form.mode, form.units));
    dispatch({ type: 'mode', mode, example: untouched });
  };
  const loadExample = () => {
    const example = defaultCaseFor(form.mode, form.units);
    dispatch({ type: 'load', form: example });
    setWhole(example);
  };

  /* -- The form, in pieces that more than one mode uses -- */
  const geometryGroup = (
    <fieldset className="mp-app__group">
      <legend>{w.geometry.title}</legend>
      <div className="mp-app__row mp-app__row--two">
        <NumField numbers={t.numbers} label={w.geometry.span} unit={u.length} value={form.span} onChange={(span) => dispatch({ type: 'geometry', patch: { span } })} {...fault('span')} />
        <NumField numbers={t.numbers} label={w.geometry.rise} unit={u.length} value={form.rise} onChange={(rise) => dispatch({ type: 'geometry', patch: { rise } })} {...fault('rise')} />
      </div>
      {line('span')}
      {line('rise')}
      <p className="mp-app__note">{w.geometry.note}</p>
    </fieldset>
  );

  const secSection = a.hanging?.section ?? a.state?.section ?? null;
  const loadFields = (
    <>
      <div className="mp-app__row mp-app__row--two">
        {select(w.load.from, form.weightFrom, (['section', 'typed', 'none'] as const).map((k) => [k, w.load.froms[k]] as [typeof k, string]), (weightFrom) => dispatch({ type: 'loads', patch: { weightFrom } }))}
        {form.weightFrom === 'typed' ? (
          <NumField numbers={t.numbers} label={w.load.typed} unit={u.line} value={form.typedWeight} onChange={(typedWeight) => dispatch({ type: 'loads', patch: { typedWeight } })} {...fault('weight')} />
        ) : null}
      </div>
      {line('weight')}
      {form.weightFrom === 'section' ? <p className="mp-app__computed">{fill(w.load.own, { weight: secSection ? num(secSection.selfWeight) : '—', unit: ru.line })}</p> : null}
      <div className="mp-app__row mp-app__row--two">
        <NumField numbers={t.numbers} label={w.load.q} unit={u.line} value={form.q} onChange={(q) => dispatch({ type: 'loads', patch: { q } })} {...fault('q')} />
      </div>
      {line('q')}
      <p className="mp-app__note">{w.load.note}</p>
    </>
  );

  const choice = choiceOf(form);
  const knownValue =
    choice === 'sag-mid' || choice === 'sag-low'
      ? { value: form.sag, unit: u.length, set: (sag: number) => dispatch({ type: 'known', patch: { sag } }) }
      : choice === 'H'
        ? { value: form.H, unit: u.force, set: (H: number) => dispatch({ type: 'known', patch: { H } }) }
        : choice === 'length'
          ? { value: form.length, unit: u.length, set: (length: number) => dispatch({ type: 'known', patch: { length } }) }
          : { value: form.T, unit: u.force, set: (T: number) => dispatch({ type: 'known', patch: { T } }) };
  const knownFields = (
    <>
      <div className="mp-app__row mp-app__row--two mp-cs__known">
        {select<KnownChoice>(w.known.pick, choice, KNOWN_CHOICES.map((k) => [k, w.known.kinds[k]] as [KnownChoice, string]), (c) => dispatch({ type: 'known', patch: knownPatch(c) }))}
        <NumField numbers={t.numbers} label={w.known.kinds[choice]} unit={knownValue.unit} value={knownValue.value} onChange={knownValue.set} {...fault('known')} />
      </div>
      {line('known')}
      <p className="mp-app__note">{w.known.notes[choice]}</p>
    </>
  );

  const rope = form.material === 'rope' || form.material === 'spiral' || form.material === 'locked';
  const sectionGroup = (
    <fieldset className="mp-app__group">
      <legend>{t.section.title}</legend>
      <fieldset className="mp-seg">
        <legend className="mp-num__label">{w.section.by}</legend>
        {(['diameter', 'area'] as const).map((by) => (
          <label key={by} className="mp-seg__item">
            <input type="radio" name="cable-by" checked={form.sectionBy === by} onChange={() => dispatch({ type: 'section', patch: { sectionBy: by } })} />
            <span>{w.section.bys[by]}</span>
          </label>
        ))}
      </fieldset>
      <div className="mp-app__row mp-app__row--two">
        {form.sectionBy === 'diameter' ? (
          <>
            <NumField numbers={t.numbers} label={w.section.diameter} unit={u.dim} value={form.diameter} onChange={(diameter) => dispatch({ type: 'section', patch: { diameter } })} {...secMark('diameter')} />
            <NumField numbers={t.numbers} label={w.section.fill} value={form.fill} onChange={(fillValue) => dispatch({ type: 'section', patch: { fill: fillValue } })} {...secMark('fill')} />
          </>
        ) : (
          <NumField numbers={t.numbers} label={w.section.area} unit={u.area} value={form.area} onChange={(area) => dispatch({ type: 'section', patch: { area } })} {...secMark('area')} />
        )}
      </div>
      <div className="mp-app__row mp-app__row--two">
        {select<MaterialId>(w.section.material, form.material, MATERIAL_IDS.map((m) => [m, w.section.materials[m]] as [MaterialId, string]), (material) => dispatch({ type: 'material', material }))}
        {form.elastic ? <NumField numbers={t.numbers} label={w.section.E} unit={u.E} value={form.E} onChange={(E) => dispatch({ type: 'section', patch: { E } })} {...secMark('E')} /> : null}
      </div>
      <div className="mp-app__row mp-app__row--two">
        {form.weightFrom === 'section' ? (
          <>
            <NumField numbers={t.numbers} label={w.section.gamma} unit={u.gamma} value={form.gamma} onChange={(gamma) => dispatch({ type: 'section', patch: { gamma } })} {...secMark('gamma')} />
            <NumField numbers={t.numbers} label={w.section.lay} value={form.lay} onChange={(lay) => dispatch({ type: 'section', patch: { lay } })} {...secMark('lay')} />
          </>
        ) : null}
        {form.mode === 'state' ? <NumField numbers={t.numbers} label={w.section.alpha} unit={u.alpha} value={form.alpha} onChange={(alpha) => dispatch({ type: 'section', patch: { alpha } })} {...fault('thermal')} /> : null}
      </div>
      {line('section')}
      <label className="mp-app__check">
        <input type="checkbox" checked={form.elastic} onChange={(e) => dispatch({ type: 'section', patch: { elastic: e.target.checked } })} />
        <span>{w.section.elastic}</span>
      </label>
      {form.elastic ? null : <p className="mp-app__note">{w.section.elasticNote}</p>}
      {secSection ? (
        <p className="mp-app__computed">
          {fill(secSection.EA === null ? w.section.workedRigid : w.section.worked, {
            area: num(secSection.area, 5),
            areaUnit: ru.area,
            weight: num(secSection.selfWeight),
            lineUnit: ru.line,
            EA: secSection.EA === null ? '—' : num(secSection.EA),
            force: ru.force,
          })}
        </p>
      ) : null}
      <p className="mp-app__note">{w.section.typical}</p>
      {rope ? <p className="mp-app__note">{w.section.ropeNote}</p> : null}
    </fieldset>
  );

  const stateGroups = (
    <>
      <fieldset className="mp-app__group">
        <legend>{w.state.title1}</legend>
        <p className="mp-app__note">{w.state.note1}</p>
        {loadFields}
        {knownFields}
        <div className="mp-app__row mp-app__row--two">
          <NumField numbers={t.numbers} label={w.state.T1} unit={u.temp} value={form.state.T1} onChange={(T1) => dispatch({ type: 'state', patch: { T1 } })} {...fault('thermal')} />
        </div>
      </fieldset>
      <fieldset className="mp-app__group">
        <legend>{w.state.title2}</legend>
        <p className="mp-app__note">{w.state.note2}</p>
        <div className="mp-app__row mp-app__row--two">
          <NumField numbers={t.numbers} label={w.state.q} unit={u.line} value={form.state.q} onChange={(q) => dispatch({ type: 'state', patch: { q } })} {...fault('state.q')} />
          <NumField numbers={t.numbers} label={w.state.ice} unit={u.line} value={form.state.ice} onChange={(ice) => dispatch({ type: 'state', patch: { ice } })} {...fault('state.ice')} />
          <NumField numbers={t.numbers} label={w.state.T2} unit={u.temp} value={form.state.T2} onChange={(T2) => dispatch({ type: 'state', patch: { T2 } })} {...fault('thermal')} />
        </div>
        {line('state.q')}
        {line('state.ice')}
        {line('thermal')}
      </fieldset>
    </>
  );

  // The notes of the tables, each with the table it is about; only where the cable is solved, which is where the tables are made.
  const whichTable = (n: AnalysisIssue): TableName => (n.field === 'table.loads' ? 'loads' : n.field === 'table.thermal' ? 'thermal' : [form.state.low, form.state.high, form.state.step].every(Number.isFinite) ? 'loads' : 'thermal');
  const noteOf = (which: TableName) => (st ? st.tables.notes.find((n) => whichTable(n) === which) : undefined);
  const thermalNote = noteOf('thermal');
  const loadsNote = noteOf('loads');
  const tableFault = (n: AnalysisIssue | undefined, which: TableName) => (n ? { invalid: true, describedBy: idOf(`table${which}`) } : {});
  const tableLine = (n: AnalysisIssue | undefined, which: TableName) =>
    n ? (
      <p className="mp-app__row-error" id={idOf(`table${which}`)}>
        {tableNote(n, which, w)}
      </p>
    ) : null;
  const tablesGroup = (
    <fieldset className="mp-app__group mp-cs__tablesgroup">
      <legend>{w.tables.title}</legend>
      <p className="mp-app__computed">{w.tables.thermal.title}</p>
      <div className="mp-app__row mp-app__row--three">
        <NumField numbers={t.numbers} label={w.tables.thermal.low} unit={u.temp} value={form.state.low} onChange={(low) => dispatch({ type: 'state', patch: { low } })} {...tableFault(thermalNote, 'thermal')} />
        <NumField numbers={t.numbers} label={w.tables.thermal.high} unit={u.temp} value={form.state.high} onChange={(high) => dispatch({ type: 'state', patch: { high } })} {...tableFault(thermalNote, 'thermal')} />
        <NumField numbers={t.numbers} label={w.tables.thermal.step} unit={u.temp} value={form.state.step} onChange={(step) => dispatch({ type: 'state', patch: { step } })} {...tableFault(thermalNote, 'thermal')} />
      </div>
      {tableLine(thermalNote, 'thermal')}
      <p className="mp-app__note">{w.tables.thermal.note}</p>
      <p className="mp-app__computed">{w.tables.loads.title}</p>
      <div className="mp-app__row mp-app__row--three">
        <NumField numbers={t.numbers} label={w.tables.loads.low} value={form.state.factorLow} onChange={(factorLow) => dispatch({ type: 'state', patch: { factorLow } })} {...tableFault(loadsNote, 'loads')} />
        <NumField numbers={t.numbers} label={w.tables.loads.high} value={form.state.factorHigh} onChange={(factorHigh) => dispatch({ type: 'state', patch: { factorHigh } })} {...tableFault(loadsNote, 'loads')} />
        <NumField numbers={t.numbers} label={w.tables.loads.rows} value={form.state.factorRows} onChange={(factorRows) => dispatch({ type: 'state', patch: { factorRows } })} {...tableFault(loadsNote, 'loads')} />
      </div>
      {tableLine(loadsNote, 'loads')}
      <p className="mp-app__note">{fill(w.tables.loads.note, { max: MAX_FACTOR_ROWS })}</p>
    </fieldset>
  );

  const pointsKnownField = form.pointsKnown;
  const pointsGroups = (
    <>
      <fieldset className="mp-app__group">
        <legend>{w.points.title}</legend>
        <p className="mp-app__note">{w.points.note}</p>
        {form.points.length === 0 ? <p className="mp-app__none">{w.points.none}</p> : null}
        {form.points.map((p, i) => {
          const name = `${w.points.name} ${i + 1}`;
          const key = `point${p.id}`;
          return (
            <div key={p.id} className="mp-app__item mp-cs__item" role="group" aria-label={name} data-invalid={hasIssue(key) ? 'true' : undefined}>
              <p className="mp-cs__name" aria-hidden="true">
                {name}
              </p>
              <div className="mp-app__row mp-app__row--rm">
                <div className="mp-app__fields mp-cs__fields">
                  <NumField numbers={t.numbers} label={w.points.x} unit={u.length} value={p.x} onChange={(x) => dispatch({ type: 'point-patch', id: p.id, patch: { x } })} {...fault(key)} />
                  <NumField numbers={t.numbers} label={w.points.P} unit={u.force} value={p.P} onChange={(P) => dispatch({ type: 'point-patch', id: p.id, patch: { P } })} {...fault(key)} />
                </div>
                <button type="button" className="mp-app__remove" onClick={removeRow(p.id)} aria-label={`${t.row.remove}: ${name}`} title={t.row.remove}>
                  <span aria-hidden="true">×</span>
                </button>
              </div>
              {line(key)}
            </div>
          );
        })}
        {line('points')}
        <button type="button" className="mp-app__add" onClick={full ? undefined : addRow} aria-disabled={full || undefined} aria-describedby={limited ? `${uid}pointslimit` : undefined}>
          <span aria-hidden="true">+</span> {w.points.add}
        </button>
        {limited ? (
          <p className="mp-cs__limit" id={`${uid}pointslimit`} role="status">
            {fill(w.points.limit, { max: MAX_POINT_LOADS })}
          </p>
        ) : null}
      </fieldset>
      <fieldset className="mp-app__group">
        <legend>{w.points.known.title}</legend>
        <div className="mp-app__row mp-app__row--two mp-cs__known">
          {select<(typeof POINTS_KNOWN)[number]>(w.points.known.pick, pointsKnownField, POINTS_KNOWN.map((k) => [k, w.points.known.kinds[k]] as [(typeof POINTS_KNOWN)[number], string]), (k) => dispatch({ type: 'points', patch: { pointsKnown: k } }))}
          {pointsKnownField === 'sag' ? (
            <>
              <NumField numbers={t.numbers} label={w.points.known.at} unit={u.length} value={form.sagAt} onChange={(sagAt) => dispatch({ type: 'points', patch: { sagAt } })} {...fault('sagAt')} />
              <NumField numbers={t.numbers} label={w.points.known.sag} unit={u.length} value={form.pointsSag} onChange={(pointsSag) => dispatch({ type: 'points', patch: { pointsSag } })} {...fault('known')} />
            </>
          ) : pointsKnownField === 'H' ? (
            <NumField numbers={t.numbers} label={w.points.known.H} unit={u.force} value={form.pointsH} onChange={(pointsH) => dispatch({ type: 'points', patch: { pointsH } })} {...fault('known')} />
          ) : (
            <NumField numbers={t.numbers} label={w.points.known.T} unit={u.force} value={form.pointsT} onChange={(pointsT) => dispatch({ type: 'points', patch: { pointsT } })} {...fault('known')} />
          )}
        </div>
        {line('sagAt')}
        {line('known')}
        <p className="mp-app__note">{w.points.known.notes[pointsKnownField]}</p>
      </fieldset>
    </>
  );

  /* -- What the drawing says -- */
  const shown: ShapeLine | null = hang ? hang.exact : st ? st.state2 : null;
  const texts = useMemo(() => {
    const unit = a.units.force;
    const words = w.results.labels;
    const lab = (name: string, v: number) => `${name} ${formatNumber(v, 4, group)} ${unit}`;
    if (a.points) {
      const first = a.points.segments[0];
      const last = a.points.segments[a.points.segments.length - 1];
      return { A: lab(words.tension, first.tension), B: lab(words.tension, last.tension), H: null };
    }
    // In a change of state the figures on the drawing are those of state 2, and say so.
    const two = Boolean(a.state);
    const s = a.hanging?.exact ?? a.state?.state2 ?? null;
    const T = two ? words.tension2 : words.tension;
    return s ? { A: lab(T, s.tension.A), B: lab(T, s.tension.B), H: lab(two ? words.H2 : words.H, s.H) } : undefined;
  }, [a, group, w]);
  const shares = useMemo(() => a.points?.segments.map((s) => s.share), [a]);

  // The drawing read aloud in plain words, under it; nothing where there is no solution (the box of problems speaks then).
  const reading = readingOf(a, w, ctx, { span: solved.span, T1: solved.state.T1, T2: solved.state.T2 });

  const summary = (() => {
    const span = withUnit(solved.span, ru.length);
    if (hang) return fill(w.results.drawing.hanging, { span, family: w.results.drawing.families[hang.family], H: withUnit(hang.exact.H, ru.force), T: withUnit(hang.exact.tension.max, ru.force), d: withUnit(hang.exact.sagMid, ru.length), length: withUnit(hang.exact.length, ru.length, 5) });
    if (st) return fill(w.results.drawing.state, { span, H1: withUnit(st.state1.H, ru.force), d1: withUnit(st.state1.sagMid, ru.length), H2: withUnit(st.state2.H, ru.force), d2: withUnit(st.state2.sagMid, ru.length) });
    if (pts) {
      const low = pts.joints[pts.lowest.joint];
      const z = pts.lowest.z;
      return fill(w.results.drawing.points, {
        span,
        count: solved.points.length,
        H: withUnit(pts.H, ru.force),
        T: withUnit(pts.tensionMax.value, ru.force),
        z: `${low.kind === 'load' ? `${w.points.name} ${low.label}` : low.kind}, ${levelText(z, w.results.totals.belowA, w.results.totals.aboveA, w.results.totals.levelA)}`,
      });
    }
    return w.results.drawing.unsolved;
  })();

  /* -- The box of notices, and the warnings -- */
  const box = (
    <div className="mp-app__issues" role="alert" aria-live="assertive">
      {notices.length ? (
        <>
          <p className="mp-app__issues-title">{w.issuesTitle}</p>
          <ul>
            {notices.map((n) => (
              <li key={n.text} id={n.id}>
                {n.text}
              </li>
            ))}
          </ul>
        </>
      ) : linkError ? (
        <p className="mp-app__issues-title">{w.linkError}</p>
      ) : null}
    </div>
  );
  const warnings = a.warnings.length ? (
    <div className="mp-cs__warnings" role="status">
      <p className="mp-app__issues-title">{w.results.warningsTitle}</p>
      <ul>
        {a.warnings.map((x, i) => (
          <li key={`${x.code}${i}`}>{warningSentence(x, w, ctx)}</li>
        ))}
      </ul>
    </div>
  ) : null;

  /* -- The headline -- */
  const pair = (label: string, value: React.ReactNode) => (
    <div key={label}>
      <dt>{label}</dt>
      <dd>{value}</dd>
    </div>
  );
  const atSupport = (s: ShapeLine) => (supportOf(s) === 'both' ? w.results.headline.atBoth : fill(w.results.headline.at, { support: supportOf(s) }));
  const headline = hang ? (
    <dl className="mp-app__dl mp-cs__headline">
      {pair(w.results.headline.H, withUnit(hang.exact.H, ru.force))}
      {pair(
        w.results.headline.tmax,
        <>
          {withUnit(hang.exact.tension.max, ru.force)} <span className="mp-app__dir">{atSupport(hang.exact)}</span>
        </>,
      )}
      {pair(w.results.headline.sag, withUnit(hang.exact.sagMid, ru.length))}
      {pair(w.results.headline.length, withUnit(hang.exact.length, ru.length, 5))}
    </dl>
  ) : st ? (
    <dl className="mp-app__dl mp-cs__headline">
      {pair(w.results.headline.H2, withUnit(st.state2.H, ru.force))}
      {pair(w.results.headline.ratio, num(st.change.ratioH))}
      {pair(w.results.headline.sag2, withUnit(st.state2.sagMid, ru.length))}
      {pair(
        w.results.headline.tmax2,
        <>
          {withUnit(st.state2.tension.max, ru.force)} <span className="mp-app__dir">{atSupport(st.state2)}</span>
        </>,
      )}
    </dl>
  ) : pts ? (
    <dl className="mp-app__dl mp-cs__headline">
      {pair(w.results.headline.H, withUnit(pts.H, ru.force))}
      {pair(
        w.results.headline.tmax,
        <>
          {withUnit(pts.tensionMax.value, ru.force)} <span className="mp-app__dir">{fill(w.results.totals.piece, { n: pts.tensionMax.segment })}</span>
        </>,
      )}
      {pair(w.results.totals.length, withUnit(pts.length, ru.length, 5))}
      {pair(
        w.results.headline.lowest,
        <>
          {(() => {
            const j = pts.joints[pts.lowest.joint];
            return j.kind === 'load' ? `${w.points.name} ${j.label}` : j.kind;
          })()}{' '}
          <span className="mp-app__dir">{levelText(pts.lowest.z, w.results.headline.belowA, w.results.headline.aboveA, w.results.headline.levelA)}</span>
        </>,
      )}
    </dl>
  ) : null;

  const hasParabola = a.drawing.curves.some((c) => c.id === 'parabola');

  /* -- The cards of numbers -- */
  const card = (title: string, children: React.ReactNode, wide = false) => (
    <div className={wide ? 'mp-app__card mp-app__card--wide' : 'mp-app__card'}>
      <h3 className="mp-app__h">{title}</h3>
      {children}
    </div>
  );

  const hangingCards = hang
    ? (() => {
        const e = hang.exact;
        const d = hang.difference;
        const sec = hang.section;
        const where = (s: ShapeLine) => (supportOf(s) === 'both' ? w.results.shape.atBoth : fill(w.results.shape.at, { support: supportOf(s) }));
        return (
          <>
            {card(
              w.results.supports.title,
              <>
                <DataTable
                  cols={[{ title: w.results.supports.support }, { title: w.results.supports.tension, unit: ru.force }, { title: w.results.supports.vertical, unit: ru.force }, { title: w.results.supports.angle, unit: '°' }]}
                  rows={[
                    { key: 'A', cells: [w.results.supports.left, num(e.tension.A), pointed(e.reaction.A, t.results.upward, t.results.downward), signedNum(e.angle.A)] },
                    { key: 'B', cells: [w.results.supports.right, num(e.tension.B), pointed(e.reaction.B, t.results.upward, t.results.downward), signedNum(e.angle.B)] },
                  ]}
                />
                <p className="mp-app__note">{w.results.supports.note}</p>
              </>,
              true,
            )}
            {card(
              w.results.shape.title,
              <dl className="mp-app__dl">
                {pair(w.results.shape.H, withUnit(e.H, ru.force))}
                {pair(
                  w.results.shape.tmax,
                  <>
                    {withUnit(e.tension.max, ru.force)} <span className="mp-app__dir">{where(e)}</span>
                  </>,
                )}
                {pair(
                  w.results.shape.tmin,
                  <>
                    {withUnit(e.tension.min, ru.force)} {e.vertex.inside ? <span className="mp-app__dir">{w.results.shape.lowestPoint}</span> : null}
                  </>,
                )}
                {pair(w.results.shape.sagMid, withUnit(e.sagMid, ru.length))}
                {pair(w.results.shape.sagRatio, num(e.sagRatio, 3))}
                {pair(w.results.shape.sagLow, e.vertex.inside ? withUnit(e.sagLow, ru.length) : w.results.shape.lowOutside)}
                {pair(
                  w.results.shape.lowest,
                  e.vertex.inside ? fill(w.results.shape.lowestAt, { x: withUnit(e.vertex.x, ru.length), z: levelText(e.vertex.z, w.results.totals.belowA, w.results.totals.aboveA, w.results.totals.levelA) }) : w.results.shape.lowestOutside,
                )}
                {pair(w.results.shape.chord, withUnit(hang.chord, ru.length, 5))}
                {pair(w.results.shape.chordAngle, `${signedNum(hang.chordAngle)}°`)}
              </dl>,
            )}
            {card(
              w.results.stretch.title,
              <>
                <dl className="mp-app__dl">
                  {pair(w.results.stretch.stretched, withUnit(e.length, ru.length, 5))}
                  {pair(w.results.stretch.unstretched, withUnit(e.unstretched, ru.length, 5))}
                  {e.strain === null ? null : pair(w.results.stretch.elongation, withUnit(e.elongation, ru.elongation))}
                  {e.strain === null ? null : pair(w.results.stretch.strain, `${num(e.strain * 100, 3)} %`)}
                </dl>
                <p className="mp-app__note">{e.strain === null ? w.results.stretch.rigid : w.results.stretch.note}</p>
              </>,
            )}
            {card(
              w.results.section.title,
              <dl className="mp-app__dl">
                {sec.diameter === null ? null : pair(w.results.section.diameter, withUnit(sec.diameter, ru.dim))}
                {pair(w.results.section.area, withUnit(sec.area, ru.area, 5))}
                {pair(w.results.section.weight, sec.weightFrom === 'none' ? w.results.section.none : withUnit(sec.selfWeight, ru.line))}
                {pair(w.results.section.EA, sec.EA === null ? w.results.section.rigid : withUnit(sec.EA, ru.force))}
              </dl>,
            )}
            {card(
              w.results.compare.title,
              <>
                <p className="mp-app__note">{hang.family === 'parabola' ? w.results.compare.parabolaIs : hang.family === 'catenary' ? w.results.compare.catenaryIs : w.results.compare.combinedIs}</p>
                {hang.parabolic && d ? (
                  <>
                    <DataTable
                      cols={[{ title: w.results.compare.quantity }, { title: w.results.compare.exact }, { title: w.results.compare.parabola }, { title: w.results.compare.difference }]}
                      rows={[
                        { key: 'H', cells: [`${w.results.compare.H} (${ru.force})`, num(e.H), num(hang.parabolic.H), percent(d.H, w, group, formatNumber)] },
                        { key: 'T', cells: [`${w.results.compare.tmax} (${ru.force})`, num(e.tension.max), num(hang.parabolic.tension.max), percent(d.tension, w, group, formatNumber)] },
                        { key: 'd', cells: [`${w.results.compare.sag} (${ru.length})`, num(e.sagMid), num(hang.parabolic.sagMid), percent(d.sagMid, w, group, formatNumber)] },
                        { key: 'L', cells: [`${w.results.compare.length} (${ru.length})`, num(e.length, 5), num(hang.parabolic.length, 5), percent(d.length, w, group, formatNumber)] },
                      ]}
                    />
                    {a.warnings.some((x) => x.code === 'parabola-differs') ? (
                      <p className="mp-app__note">{warningSentence(a.warnings.find((x) => x.code === 'parabola-differs')!, w, ctx)}</p>
                    ) : (
                      <p className="mp-app__note">{fill(w.results.compare.within, { tolerance: num(1) })}</p>
                    )}
                  </>
                ) : hang.family === 'parabola' ? null : (
                  <p className="mp-app__note">{w.results.compare.missing}</p>
                )}
              </>,
              true,
            )}
            {hang.alternative
              ? card(
                  w.results.alternative.title,
                  <>
                    <dl className="mp-app__dl">
                      {pair(w.results.alternative.H, withUnit(hang.alternative.H, ru.force))}
                      {pair(w.results.alternative.sag, withUnit(hang.alternative.sagMid, ru.length))}
                    </dl>
                    <p className="mp-app__note">{w.results.alternative.note}</p>
                  </>,
                )
              : null}
          </>
        );
      })()
    : null;

  /* A table over temperature or over load: its rows, and the same two quantities as charts. */
  const sweepRows = (rows: StateTableRow[]): TableRow[] =>
    rows.map((r) => {
      const value = num(r.value);
      const label = (
        <>
          {value}
          {r.isState2 ? <span className="mp-app__dir"> · {w.results.sweep.current}</span> : null}
        </>
      );
      if (!r.ok) return { key: r.index, className: 'mp-cs__failed', cells: [label, { span: 5, node: rowSentence(r.code, w) }] };
      return {
        key: r.index,
        className: r.isState2 ? 'mp-cs__current' : undefined,
        cells: [label, num(r.H ?? 0), num(r.ratioH ?? 0), num(r.sagMid ?? 0), num(r.tensionMax ?? 0), num(r.length ?? 0, 5)],
      };
    });
  const sweepCols = (first: Col): Col[] => [first, { title: w.results.sweep.H, unit: ru.force }, { title: w.results.sweep.ratio }, { title: w.results.sweep.sag, unit: ru.length }, { title: w.results.sweep.tmax, unit: ru.force }, { title: w.results.sweep.length, unit: ru.length }];
  const chartPoints = (rows: StateTableRow[], pick: (r: StateTableRow) => number | undefined): ChartPoint[] => rows.map((r) => ({ x: r.value, y: r.ok ? (pick(r) ?? null) : null, current: r.isState2 }));
  const aboutOf = (title: string, points: ChartPoint[], xText: (v: number) => string, yText: (v: number) => string): string => {
    const ok = points.filter((p) => p.y !== null) as { x: number; y: number; current: boolean }[];
    if (ok.length === 0) return `${title}.`;
    const least = ok.reduce((m, p) => (p.y < m.y ? p : m));
    const most = ok.reduce((m, p) => (p.y > m.y ? p : m));
    const first = ok[0];
    const last = ok[ok.length - 1];
    const gaps = points.length - ok.length;
    return [
      fill(w.results.sweep.chartAbout, { title, first: yText(first.y), firstAt: xText(first.x), last: yText(last.y), lastAt: xText(last.x), least: yText(least.y), leastAt: xText(least.x), most: yText(most.y), mostAt: xText(most.x) }),
      gaps ? fill(w.results.sweep.chartGaps, { count: gaps }) : '',
      ok.some((p) => p.current) ? w.results.sweep.chartCurrent : '',
    ]
      .filter(Boolean)
      .join(' ');
  };
  const sweepCard = (kind: TableName, rows: StateTableRow[], note: AnalysisIssue | undefined) => {
    const copy = w.results.sweep[kind];
    const first: Col = kind === 'thermal' ? { title: copy.first, unit: ru.temp } : { title: copy.first };
    const axisTitle = first.unit ? `${first.title} (${first.unit})` : first.title;
    const xText = (v: number) => (first.unit ? `${num(v)} ${first.unit}` : num(v));
    const sag = chartPoints(rows, (r) => r.sagMid);
    const H = chartPoints(rows, (r) => r.H);
    const sagTitle = fill(w.results.sweep.sagTitle, { axis: w.results.sweep.axes[kind] });
    const hTitle = fill(w.results.sweep.hTitle, { axis: w.results.sweep.axes[kind] });
    return card(
      copy.title,
      note || rows.length === 0 ? (
        <p className="mp-app__note">{w.results.sweep.none}</p>
      ) : (
        <>
          <div className="mp-cs__charts">
            <SweepChart
              points={sag}
              width={chartWidth}
              group={group}
              title={sagTitle}
              xTitle={axisTitle}
              yTitle={`${w.results.sweep.chartSag} (${ru.length})`}
              about={aboutOf(sagTitle, sag, xText, (v) => withUnit(v, ru.length))}
            />
            <SweepChart
              points={H}
              width={chartWidth}
              group={group}
              title={hTitle}
              xTitle={axisTitle}
              yTitle={`${w.results.sweep.chartH} (${ru.force})`}
              about={aboutOf(hTitle, H, xText, (v) => withUnit(v, ru.force))}
            />
          </div>
          {rows.some((r) => r.ok && r.isState2) ? <p className="mp-app__note">{w.results.sweep.chartCurrent}</p> : null}
          <DataTable cols={sweepCols(first)} rows={sweepRows(rows)} className="mp-cs__table--sweep" />
        </>
      ),
      true,
    );
  };

  const stateCards = st
    ? (() => {
        const c = st.change;
        const s1 = st.state1;
        const s2 = st.state2;
        // A difference of two settled numbers: zero where it is rounding.
        const diff = (p: number, q: number) => settle(q - p, 1e-9 * Math.max(Math.abs(p), Math.abs(q)));
        const row = (key: string, label: string, unit: string, p: number, q: number, change: number, sig = 4) => ({ key, cells: [`${label} (${unit})`, num(p, sig), num(q, sig), signedNum(change, sig)] });
        return (
          <>
            {card(
              w.results.change.title,
              <>
                <DataTable
                  cols={[{ title: w.results.change.quantity }, { title: w.results.change.state1 }, { title: w.results.change.state2 }, { title: w.results.change.change }]}
                  rows={[
                    row('load', w.results.change.load, ru.line, c.loadPerLength.state1, c.loadPerLength.state2, diff(c.loadPerLength.state1, c.loadPerLength.state2)),
                    row('temp', w.results.change.temperature, ru.temp, solved.state.T1, solved.state.T2, c.deltaT),
                    row('H', w.results.change.H, ru.force, s1.H, s2.H, c.deltaH),
                    row('sag', w.results.change.sag, ru.length, s1.sagMid, s2.sagMid, c.deltaSagMid),
                    row('tA', w.results.change.tA, ru.force, s1.tension.A, s2.tension.A, diff(s1.tension.A, s2.tension.A)),
                    row('tB', w.results.change.tB, ru.force, s1.tension.B, s2.tension.B, diff(s1.tension.B, s2.tension.B)),
                    row('tmax', w.results.change.tmax, ru.force, s1.tension.max, s2.tension.max, c.deltaTensionMax),
                    row('len', w.results.change.length, ru.length, s1.length, s2.length, c.deltaLength, 5),
                    row('unst', w.results.change.unstretched, ru.length, s1.unstretched, s2.unstretched, diff(s1.unstretched, s2.unstretched), 5),
                  ]}
                />
                <p className="mp-app__note">{w.results.change.note}</p>
              </>,
              true,
            )}
            {card(
              w.results.change.what,
              <dl className="mp-app__dl">
                {pair(w.results.change.deltaT, `${signedNum(c.deltaT)} ${ru.temp}`)}
                {pair(w.results.change.strain, `${signedNum(c.thermalStrain * 100, 3)} %`)}
                {pair(w.results.change.ratio, num(c.ratioH))}
              </dl>,
            )}
            {card(
              w.results.change.detail,
              <dl className="mp-app__dl">
                {pair(w.results.shape.sagRatio, num(s2.sagRatio, 3))}
                {pair(w.results.shape.sagLow, s2.vertex.inside ? withUnit(s2.sagLow, ru.length) : w.results.shape.lowOutside)}
                {pair(w.results.totals.reactionA, pointed(s2.reaction.A, t.results.upward, t.results.downward))}
                {pair(w.results.totals.reactionB, pointed(s2.reaction.B, t.results.upward, t.results.downward))}
                {pair(w.results.supports.angle, `${signedNum(s2.angle.A)}° · ${signedNum(s2.angle.B)}°`)}
                {s2.strain === null ? null : pair(w.results.stretch.elongation, withUnit(s2.elongation, ru.elongation))}
                {s2.strain === null ? null : pair(w.results.stretch.strain, `${num(s2.strain * 100, 3)} %`)}
              </dl>,
            )}
            {sweepCard('thermal', st.tables.thermal, thermalNote)}
            {sweepCard('loads', st.tables.loads, loadsNote)}
          </>
        );
      })()
    : null;

  const pointsCards = pts
    ? (() => {
        const nameOf = (i: number) => {
          const j = pts.joints[i];
          return j.kind === 'load' ? String(j.label) : j.kind;
        };
        const labelOf = (i: number) => {
          const j = pts.joints[i];
          return j.kind === 'load' ? fill(w.results.joints.load1, { n: j.label }) : fill(w.results.joints.support, { name: j.kind });
        };
        return (
          <>
            {card(
              w.results.joints.title,
              <DataTable
                cols={[{ title: w.results.joints.joint }, { title: w.results.joints.x, unit: ru.length }, { title: w.results.joints.z, unit: ru.length }, { title: w.results.joints.sag, unit: ru.length }, { title: w.results.joints.load, unit: ru.force }]}
                rows={pts.joints.map((j, i) => ({ key: i, cells: [labelOf(i), num(j.x), signedNum(j.z), num(j.sag), j.kind === 'load' ? signedNum(j.P) : '—'] }))}
              />,
              true,
            )}
            {card(
              w.results.segments.title,
              <>
                <DataTable
                  cols={[
                    { title: w.results.segments.segment },
                    { title: w.results.segments.between },
                    { title: w.results.segments.run, unit: ru.length },
                    { title: w.results.segments.rise, unit: ru.length },
                    { title: w.results.segments.length, unit: ru.length },
                    { title: w.results.segments.angle, unit: '°' },
                    { title: w.results.segments.tension, unit: ru.force },
                  ]}
                  rows={pts.segments.map((s) => ({
                    key: s.label,
                    cells: [
                      String(s.label),
                      `${nameOf(s.from)} – ${nameOf(s.to)}`,
                      num(s.dx),
                      signedNum(s.dz),
                      num(s.length),
                      signedNum(s.angle),
                      <>
                        {num(s.tension)}
                        {pts.tensionMax.segment === s.label ? <span className="mp-app__dir"> · {w.results.segments.largest}</span> : null}
                      </>,
                    ],
                  }))}
                />
                <p className="mp-app__note">{w.results.segments.note}</p>
              </>,
              true,
            )}
            {card(
              w.results.totals.title,
              <dl className="mp-app__dl">
                {pair(w.results.totals.H, withUnit(pts.H, ru.force))}
                {pair(w.results.totals.reactionA, pointed(pts.reaction.A, t.results.upward, t.results.downward))}
                {pair(w.results.totals.reactionB, pointed(pts.reaction.B, t.results.upward, t.results.downward))}
                {pair(w.results.totals.load, withUnit(pts.totalLoad, ru.force))}
                {pair(w.results.totals.length, withUnit(pts.length, ru.length, 5))}
                {pair(w.results.totals.tmax, `${withUnit(pts.tensionMax.value, ru.force)} · ${fill(w.results.totals.piece, { n: pts.tensionMax.segment })}`)}
                {pair(w.results.totals.lowest, fill(w.results.totals.lowestAt, { joint: labelOf(pts.lowest.joint), z: levelText(pts.lowest.z, w.results.totals.belowA, w.results.totals.aboveA, w.results.totals.levelA) }))}
                {pts.sagAt ? pair(w.results.totals.given, fill(w.results.totals.givenAt, { value: withUnit(pts.sagAt.value, ru.length), x: withUnit(pts.sagAt.x, ru.length) })) : null}
              </dl>,
            )}
            {card(
              w.results.equilibrium.title,
              <>
                <dl className="mp-app__dl">
                  {pair(w.results.equilibrium.fz, withUnit(pts.equilibrium.sumFz, ru.force))}
                  {pair(w.results.equilibrium.moment, `${num(pts.equilibrium.sumM)} ${ru.force}·${ru.length}`)}
                  {pair(w.results.equilibrium.joint, withUnit(pts.equilibrium.joint, ru.force))}
                </dl>
                {pts.equilibrium.balanced ? <p className="mp-app__note mp-cs__balanced">{w.results.equilibrium.balanced}</p> : <p className="mp-app__row-error">{w.results.equilibrium.unbalanced}</p>}
              </>,
            )}
          </>
        );
      })()
    : null;

  return (
    <div className={onPaper ? 'mp-app mp-cs mp-cs--sheet' : 'mp-app mp-cs'} ref={root}>
      <div className="mp-app__top">
        {/* -- the form -- */}
        <form className="mp-app__form" onSubmit={(e) => e.preventDefault()} noValidate>
          <div className="mp-app__bar">
            <fieldset className="mp-seg">
              <legend className="mp-num__label">{t.toolbar.units}</legend>
              {(['us', 'si'] as const).map((unit) => (
                <label key={unit} className="mp-seg__item">
                  <input type="radio" name="cable-units" checked={form.units === unit} onChange={() => dispatch({ type: 'units', units: unit })} />
                  <span>{w.toolbar[unit]}</span>
                </label>
              ))}
            </fieldset>
          </div>

          <fieldset className="mp-app__group mp-cs__mode">
            <legend>{w.mode.title}</legend>
            <fieldset className="mp-seg mp-cs__modes">
              <legend className="mp-num__label">{w.mode.title}</legend>
              {MODES.map((m) => (
                <label key={m} className="mp-seg__item">
                  <input type="radio" name="cable-mode" checked={form.mode === m} onChange={() => chooseMode(m)} />
                  <span>{w.mode.names[m]}</span>
                </label>
              ))}
            </fieldset>
            <p className="mp-app__note">{w.mode.hints[form.mode]}</p>
            <button type="button" className="mp-app__btn mp-app__btn--quiet mp-cs__example" onClick={loadExample}>
              {w.mode.example}
            </button>
            <p className="mp-app__note">{w.mode.note}</p>
          </fieldset>

          {geometryGroup}

          {form.mode === 'hanging' ? (
            <>
              <fieldset className="mp-app__group">
                <legend>{w.load.title}</legend>
                {loadFields}
              </fieldset>
              <fieldset className="mp-app__group">
                <legend>{w.known.title}</legend>
                {knownFields}
              </fieldset>
              {sectionGroup}
            </>
          ) : null}

          {form.mode === 'state' ? (
            <>
              {stateGroups}
              {sectionGroup}
              {tablesGroup}
            </>
          ) : null}

          {form.mode === 'points' ? pointsGroups : null}

          <Actions
            t={{ ...t.toolbar, copy: w.toolbar.copy }}
            copy={() => {
              // The address is brought to this cable too, and a link that could not be read has nothing left to say:
              // the one copied is the cable on screen.
              address.take(encodeCableSag(form));
              return address.link(encodeCableSag(form));
            }}
            reset={() => {
              // One press throws away whatever was typed, and nothing is asked. So the cable that goes - unless it is the
              // example - is left one step behind in the browser's history: Back brings it back, as the page opens any
              // cable its address holds (../shell/address.ts), and Forward returns to the example. The address is brought
              // to that cable first: the entry left behind is the one on screen.
              const thrown = encodeCableSag(form);
              if (thrown !== EXAMPLE) {
                address.take(thrown);
                try {
                  window.history.pushState(window.history.state, '', window.location.href);
                } catch {
                  /* the way back is a convenience; the calculator works without it */
                }
              }
              const example = defaultCase();
              dispatch({ type: 'load', form: example });
              setWhole(example);
              // The address goes bare - if what is after the # is a cable.
              address.take(EXAMPLE);
            }}
          />
        </form>

        {/* -- the answer -- */}
        <section className={tooTall ? 'mp-app__out mp-app__out--tall' : 'mp-app__out'} aria-label={t.results.title} ref={outRef} aria-busy={catching ? true : undefined}>
          {box}
          {warnings}
          {headline}

          <fieldset className="mp-cs__options">
            <legend className="mp-num__label">{w.results.options.title}</legend>
            <label className="mp-app__check">
              <input type="checkbox" checked={show.tensions} onChange={(e) => setShow({ ...show, tensions: e.target.checked })} />
              <span>{w.results.options.tensions}</span>
            </label>
            <label className="mp-app__check">
              <input type="checkbox" checked={show.dims} onChange={(e) => setShow({ ...show, dims: e.target.checked })} />
              <span>{w.results.options.dims}</span>
            </label>
            {form.mode === 'hanging' ? (
              <label className="mp-app__check">
                <input type="checkbox" checked={show.load} onChange={(e) => setShow({ ...show, load: e.target.checked })} />
                <span>{w.results.options.load}</span>
              </label>
            ) : null}
            {hasParabola ? (
              <label className="mp-app__check">
                <input type="checkbox" checked={show.parabola} onChange={(e) => setShow({ ...show, parabola: e.target.checked })} />
                <span>{w.results.options.parabola}</span>
              </label>
            ) : null}
          </fieldset>

          <div className="mp-app__plots" ref={plotRef}>
            <p className="mp-plot__title mp-plot__title--first">
              {w.results.schematic}
              <span className="mp-plot__unit">
                {' '}
                · {ru.length}, {ru.force}
              </span>
            </p>
            <Schematic
              drawing={a.drawing}
              width={width}
              group={group}
              unit={ru.length}
              labels={w.results.labels}
              texts={texts}
              tensions={show.tensions}
              dims={show.dims}
              load={show.load}
              parabola={show.parabola}
              shares={shares}
              summary={summary}
              legend={w.results.legend}
            />
            {reading ? <p className="mp-cs__reading">{reading}</p> : null}
            {shown || pts ? <p className="mp-app__note">{w.results.scale}</p> : <p className="mp-app__need">{w.results.waiting}</p>}
          </div>
        </section>
      </div>

      {/* -- the numbers: under the form and the drawing, on paper too -- */}
      <div className="mp-app__tables mp-cs__tables" ref={tablesRef} aria-busy={catching ? true : undefined}>
        {hangingCards}
        {stateCards}
        {pointsCards}
      </div>

      <p className="mp-app__note mp-cs__verdict">{w.results.note}</p>
      <p className="mp-app__privacy">{t.results.privacy}</p>
      {/* On paper only: when the sheet was printed, and the address that opens this very cable again. */}
      <SheetStamp stamp={stamp} t={{ printed: t.sheet.printed, link: w.sheet.link }} />
    </div>
  );
}
