'use client';

import React, { memo, useCallback, useDeferredValue, useEffect, useId, useMemo, useReducer, useRef, useState } from 'react';
import { flushSync } from 'react-dom';
import { formatNumber } from '@/lib/calc/format';
import { round4, type Direction, type Rotation } from '@/lib/calc/beam/model';
import { analyseSafely, type ByPlanes, type ShaftAnalysisIssue, type ShaftDiagram, type ShaftPeaks, type ShaftSide, type ShaftValue } from '@/lib/calc/shaft/analysis';
import { STIFF } from '@/lib/calc/shaft/engine';
import {
  MAX_ROWS,
  MAX_SEGMENTS,
  SHAFT_KEY,
  SHAFT_UNITS,
  decodeShaft,
  defaultShaft,
  encodeShaft,
  reduceShaft,
  type ShaftForm,
  type ShaftList,
  type ShaftMaterial,
  type ShaftRow,
  type ShaftView,
  type Sideways,
} from '@/lib/calc/shaft/model';
import type { ShaftShared, ShaftUi } from '@/lib/calc/shaft/strings';
import { BeamPlot } from '../beam/BeamPlot';
import { NumField } from '../NumField';
import { Actions } from '../shell/Actions';
import { useAddress } from '../shell/address';
import { select } from '../shell/fields';
import { PAPER_PLOT, PAPER_WIDTH, usePlotHeight, useTooTall, useWidth } from '../shell/layout';
import { arrow } from '../shell/results';
import { SheetStamp, useSheet } from '../shell/sheet';
import { ShaftSchematic } from './ShaftSchematic';

/**
 * SHAFT ON BEARINGS - the calculator (/resources/shaft-on-bearings).
 *
 * The fourth calculator of the catalogue, and the third one's sibling
 * (continuous/ContinuousCalculator.tsx): the form on the left, the answer on
 * the right and nothing between them - every keystroke that leaves a number
 * in a field solves the shaft again, a moment after the key and not inside
 * it (`solved`, below); the address follows the shaft (`#h=...`); nothing
 * leaves the browser; its words are props; it renders on the server with its
 * example. What is the same from one calculator to the next is the shell's
 * (../shell), the number field and the three diagrams (../NumField,
 * ../beam/BeamPlot), used here as they are and not copied - but for one list,
 * the way a load acts in a plane, which is the shell's with a name of its own
 * for a screen reader (`sense`, below).
 *
 * WHAT IS THIS ONE'S. A round shaft entered SEGMENT BY SEGMENT - a length,
 * a diameter and, for a hollow one, a bore - on TWO BEARINGS, under forces
 * and applied moments that each have a part in the VERTICAL plane and a part
 * in the HORIZONTAL one. So the answer has three views: each plane, which is
 * a beam with signs, and the two together, where every value is a size. The
 * switch over the drawings chooses which of the three the drawing of the
 * shaft and the three diagrams show; the cards under them give both planes
 * and the two together whatever the switch says.
 *
 * All the arithmetic is in lib/calc/shaft: `model.ts` (the form, what each
 * edit does to it, the address), `engine.ts` (the shaft), and `analysis.ts`,
 * which hands this file every number it prints ALREADY SETTLED and in the
 * units shown - what is rounding is zero there, once - and the shaft as each
 * view draws it. This file is the form, the tables and the wiring: it
 * decides nothing about a number. What it does decide is how one is
 * written: to how many figures, with which word for its direction, and as
 * one value or as two where the two sides of a point print differently.
 *
 * TWO SETS OF WORDS. `t` is the part of the first calculator's that says the
 * same on any calculator (lib/calc/shaft/strings.ts, `ShaftShared`): how a
 * number is written, the row of actions, the names of the diagrams. `w` is
 * what is about a shaft. Neither file is imported here - both languages
 * would travel with the script.
 *
 * WHICH BEARING IS WHICH. The form has two fields, "Bearing 1" and "Bearing
 * 2", and takes them in either order along the shaft. The card of the
 * bearings lists them from left to right, as the drawing has them, and names
 * each by ITS FIELD: a bearing typed second and standing first is "2" in the
 * first row.
 */

/** The example shaft, as it is written in an address. */
const EXAMPLE = encodeShaft(defaultShaft());

/** The three views, in the order the switch offers them. */
const VIEWS: ShaftView[] = ['vertical', 'horizontal', 'both'];
/** The two planes a value is given in. */
const PLANES = ['vertical', 'horizontal'] as const;

/** The raised figures a unit of this page ends in, and the figure each of them is. */
const RAISED: Record<string, string> = { '³': '3', '⁴': '4' };
/**
 * A unit as the head of a column sets it. One that ends in a raised figure - in⁴, in³, mm⁴, mm³ - has that figure
 * as a figure of the page's own type, set up (<sup>), and not as the character: the mono every unit is set in has a
 * "³" and no "⁴", and the browser took that one character from a font of the system's - larger and heavier than the
 * "³" of the head beside it, and another on every machine. Both are written the same way, so that the two heads match.
 */
const raised = (unit: string) => {
  const figure = RAISED[unit.slice(-1)];
  return figure ? (
    <>
      {unit.slice(0, -1)}
      <sup>{figure}</sup>
    </>
  ) : (
    unit
  );
};

/**
 * THE FOUR DRAWINGS, KEPT FROM ONE DRAW TO THE NEXT. A key typed into the form draws the calculator again at once,
 * and the shaft is solved a moment later (`solved`, below): until it is, the three diagrams and the drawing of the
 * shaft are handed exactly what they were handed the time before, and drawing them again was a third of the key's
 * own work with the form at its fullest - three lines of some eight hundred points each, written out again to say
 * what they said. So each is kept for as long as EVERYTHING it is given is the same (`memo`, which compares all of
 * it): nothing can be kept that should have changed, and nothing here says what a drawing depends on.
 */
const Plot = memo(BeamPlot);
const Schematic = memo(ShaftSchematic);

/**
 * What the fragment of an address opens. `undefined`: it is not this
 * calculator's (`#main` is a place on the page; `#b=...` is the first
 * calculator's beam, which is not read here). `null`: it is, and cannot be
 * read - its key with nothing after it included: a link cut that short is a
 * link that cannot be read.
 */
function caseIn(hash: string): ShaftForm | null | undefined {
  const m = hash.match(new RegExp(`^#${SHAFT_KEY}=(.*)$`));
  if (!m) return undefined;
  let text = m[1];
  try {
    text = decodeURIComponent(text);
  } catch {
    /* not percent-encoded: read as it is */
  }
  return decodeShaft(text);
}

/**
 * A form but for the numbers in it: its units, its rows, every choice made
 * in it. Two forms with the same one differ only by what was typed into
 * their fields.
 */
const choicesOf = (form: ShaftForm) => JSON.stringify(form, (_key, value: unknown) => (typeof value === 'number' ? 0 : value));

/** A row of the form as one word: two issues are on the same row when theirs are the same. (A segment's field is not part of it: the row has one message.) */
const rowKey = (row: ShaftRow) => (row.list === 'bearings' ? `bearings${row.index}` : row.list === 'material' ? `material${row.field}` : `${row.list}${row.id}`);

/**
 * THE WAY A LOAD ACTS IN ONE PLANE: a list. To the eye it is the shell's list
 * (../shell/fields.tsx, `select`), mark for mark, under the same word -
 * "Direction". What it adds is A NAME OF ITS OWN for whoever hears the form
 * and does not see it: a force and an applied moment each have two of these
 * lists, and two lists both called "Direction" - of a moment, with the same
 * two choices - cannot be told apart in a list of the form's controls, or
 * coming to them backwards; and which is which is the sign of the load. The
 * name begins with the word on screen and ends with the plane: "Direction,
 * vertical". (The shell's list takes no name but its label; the test holds
 * this one to it, mark for mark, so that the two cannot drift apart.)
 */
const sense = <T extends string>(label: string, plane: string, value: T, options: [T, string][], onChange: (v: T) => void) => (
  <label className="mp-num mp-num--select mp-num--dir">
    <span className="mp-num__label">{label}</span>
    <span className="mp-num__box">
      <select className="mp-num__input" aria-label={`${label}, ${plane.toLowerCase()}`} value={value} onChange={(e) => onChange(e.target.value as T)}>
        {options.map(([v, text]) => (
          <option key={v} value={v}>
            {text}
          </option>
        ))}
      </select>
    </span>
  </label>
);

/**
 * `initial`: the shaft it opens with, where that is not the example, and
 * `initialView`: the view, where that is not both planes - for the tests,
 * which can neither type nor press.
 */
export function ShaftCalculator({ t, w, initial, initialView }: { t: ShaftShared; w: ShaftUi; initial?: ShaftForm; initialView?: ShaftView }) {
  const [form, dispatch] = useReducer(reduceShaft, initial, (given) => given ?? defaultShaft());
  // Which of the three views the drawing and the diagrams show. Not part of
  // the case: a link opens the shaft, and the page shows it as it shows the
  // example - both planes together, the view no force is missing from.
  const [view, setView] = useState<ShaftView>(initialView ?? 'both');
  const [probeX, setProbeX] = useState<number | null>(null);
  const [typedX, setTypedX] = useState<number | null>(null);
  // The shaft last put on screen whole - opened from the address, or the
  // example on "Start over": that one is solved in the render that shows it
  // (`solved`, below), never a moment later under the results of the shaft before.
  const [whole, setWhole] = useState<ShaftForm | null>(null);
  // The x field of "Values at a point" has the focus: until it is left, the
  // position is the one in the field. A pointer resting on a diagram gave
  // the card the values under it, beside the x that had been typed.
  const typingX = useRef(false);
  const probe = useCallback((x: number | null) => {
    if (!typingX.current) setProbeX(x);
  }, []);
  // A press on a drawing is the visitor reaching for it: the x field is left
  // first (the capture runs before the diagram's own handler), and the
  // place pressed is then the position - in the field too.
  const leaveX = () => {
    const focused = document.activeElement;
    if (typingX.current && focused instanceof HTMLElement) focused.blur();
  };
  const [plotRef, windowWidth] = useWidth<HTMLDivElement>();
  const [outRef, tooTall] = useTooTall<HTMLElement>();
  const windowPlotHeight = usePlotHeight();
  const u = SHAFT_UNITS[form.units];
  const group = t.numbers.group;
  // What the ids of this form's messages begin with.
  const uid = useId();
  // The calculator itself: a shaft opened from the address asks whether the focus is in one of its fields.
  const root = useRef<HTMLDivElement>(null);

  // THE ADDRESS FOLLOWS THE SHAFT (../shell/address.ts). The case as the
  // address is to write it, at the moment it is written: the same function
  // for as long as the shaft is the same.
  const code = useCallback(() => encodeShaft(form), [form]);
  const address = useAddress<ShaftForm>({
    key: SHAFT_KEY,
    example: EXAMPLE,
    code,
    read: caseIn,
    blank: defaultShaft,
    // A shaft in the address opens as that shaft.
    open: (found) => {
      // An edit in progress is an edit of the shaft before, and ends here. The
      // field with the focus is left FIRST: it would go on showing what was
      // typed into that shaft, and fall back on that shaft's value at the
      // first key that is not a number (NumField).
      const focused = document.activeElement;
      if (focused instanceof HTMLInputElement && root.current?.contains(focused)) focused.blur();
      dispatch({ type: 'load', form: found });
      setWhole(found);
      // A place pointed at on the shaft before is not a place on this one.
      setProbeX(null);
      setTypedX(null);
    },
  });
  const { linkError } = address;
  // A RELOAD FROM THE KEYBOARD. The shell writes the address 300 ms after the last change, and a reload comes back
  // to the address as it stood when the browser began it: a key, then F5 inside that wait, and the shaft came back
  // without that key - "1234" typed, "123" on screen - and so with a choice in a list, a row added, the units. The
  // page hears the reload key before the browser acts on it (F5, Ctrl+R or Cmd+R, with Shift or Ctrl for the hard
  // one), so what is waiting is written at that key: the shell's own `flush`, which is there for a page about to
  // be loaded again. Where a browser does not hand the key to the page, nothing changes. (The wait is the shell's,
  // and the same on every calculator: when the shell writes at this key itself, these lines go.)
  const flushAddress = useRef(address.flush);
  useEffect(() => {
    flushAddress.current = address.flush;
  });
  useEffect(() => {
    const reloading = (press: KeyboardEvent) => {
      if (press.key === 'F5' || ((press.ctrlKey || press.metaKey) && !press.altKey && (press.key === 'r' || press.key === 'R'))) flushAddress.current();
    };
    window.addEventListener('keydown', reloading, true);
    return () => window.removeEventListener('keydown', reloading, true);
  }, []);
  // The printed sheet gives the address that opens this very shaft, and while
  // it prints the drawings are the sheet's size (../shell/sheet.tsx).
  const { stamp, onPaper } = useSheet({ locale: t.sheet.locale, url: () => address.link(encodeShaft(form)) });
  // On screen each diagram is 31 px shorter than the shell reckons (../shell/layout.ts, usePlotHeight), and never
  // shorter than on paper. The shell fits a column of four drawings under the header for a BEAM's drawing; the
  // drawing of a shaft is taller, and the switch of views stands over it: ninety-one pixels more, measured. At
  // the shell's height the column was two pixels shorter than the window at every height of a laptop's, so with
  // the header over it it never fitted, and was never pinned beside the form. A third of the difference off each
  // of the three, and it is pinned in a window 880 px tall or more.
  const plotHeight = onPaper ? PAPER_PLOT : Math.max(PAPER_PLOT, windowPlotHeight - 31);
  const width = onPaper ? PAPER_WIDTH : windowWidth;

  // WHICH SHAFT IS SOLVED. A shaft of eight segments under twelve forces and
  // twelve moments is some thirty milliseconds of arithmetic on a desktop and
  // several times that on a phone, and inside the keystroke that kept the key
  // off the screen for as long. So while only NUMBERS change, the answer is
  // of the form as it was a moment ago (`useDeferredValue`): the key shows at
  // once, and the shaft is solved in a render of its own, which the next key
  // may interrupt. The results say so while they are behind (`aria-busy`).
  // Anything else - the units, a row added or removed, a choice in a list,
  // the box of the shaft's own weight, a shaft opened whole - is solved in
  // the same render as ever: the answer must never stand under other units,
  // beside rows it was not solved for, or under a shaft it is not of. And on
  // paper it is the form itself: a sheet is never printed with the answer of
  // the shaft before.
  const behind = useDeferredValue(form);
  const solved = onPaper || form === whole || choicesOf(behind) !== choicesOf(form) ? form : behind;
  const catching = solved !== form;

  // Everything the page prints (lib/calc/shaft/analysis.ts) - through the
  // door that never throws: an exception in the arithmetic is a shaft that
  // could not be solved, said in the results box, and not the end of the
  // page with whatever was typed into it.
  const a = useMemo(() => analyseSafely(solved, group), [solved, group]);
  const r = a.results;
  // The x field goes with the results: nobody is typing in a field that is
  // not there. Gone with the focus still in it - a segment removed by a tap
  // that does not take the focus - it is never left, and its flag stood: the
  // diagrams then answered neither the pointer nor a finger.
  // The same when the sheet is printed: the cards are put under the form for paper (`cards`), and the field goes
  // with them, unleft.
  useEffect(() => {
    if (!r || onPaper) typingX.current = false;
  }, [r, onPaper]);
  // The shaft as the view shown draws it, and that view's three diagrams.
  const drawing = a.drawings[view];
  const shown = r ? r.views[view] : null;

  // Every number this page prints, with the page's own mark between thousands. One written with a power of ten
  // ("7.316 × 10^-5": any slope under a ten-thousandth of a radian, and the example has one) is ONE number: the
  // spaces round its × are set as spaces a line cannot end at. With plain ones a narrow cell ended its line inside
  // the number, and "7.316 ×" over "10^-5" reads as two.
  const num = (v: number, sig = 4) => formatNumber(v, sig, group).replace(' × ', ' × ');
  // A PLACE THAT WAS ENTERED - an end of a segment, a bearing, a load: the lengths typed, added up - is written
  // as it was entered, to six figures, like every typed value on the drawing: a bearing at 16.4375 in stands at
  // 16.4375, not at 16.44, and a shoulder at 21.3125 in not at 21.31. A place that was worked out (where the
  // moment is largest inside a segment) keeps the four figures of a result.
  const placed = (x: number) => num(x, 6);
  const entered = (x: number) => (r ? r.breaks.some((b) => Math.abs(b - x) <= 1e-9 * r.L) : false);
  const where = (x: number) => `${t.results.at} x = ${entered(x) ? placed(x) : num(x)} ${u.length}`;
  // A size and, in words, the way it points: a zero points no way.
  const pointed = (v: number, plus: string, minus: string) => (
    <>
      {num(Math.abs(v))} <span className="mp-app__dir">{v === 0 ? '' : arrow(v, plus, minus)}</span>
    </>
  );
  // Which words go with a plane's sign: what is positive in the results is upward in the vertical plane and
  // away from the viewer in the horizontal one (lib/calc/shaft/types.ts).
  const ways = { vertical: [t.results.upward, t.results.downward], horizontal: [w.results.away, w.results.towards] } as const;

  /* -- The faults, by row -- */
  const says = (issue: ShaftAnalysisIssue): string => {
    if (issue.code === 'number') return t.issues.number;
    if (issue.code === 'stiffness') return w.issues.stiffness.replace('{max}', num(STIFF, 7));
    return w.issues[issue.code];
  };
  const issuesOf = (row: ShaftRow) => a.issues.filter((i) => i.row && rowKey(i.row) === rowKey(row));
  const idOf = (row: ShaftRow) => `${uid}${rowKey(row)}`;
  // A field of a row at fault: marked, and tied to the row's message. Of a
  // segment, the field the fault is about - every field, when it names none;
  // of a load, its place when it is off the shaft, and every number of the
  // row when one of them is not one.
  const fault = (row: ShaftRow, field?: 'L' | 'd' | 'bore' | 'x' | 'size') => {
    const mine = issuesOf(row).filter((i) => {
      if (field === undefined || !i.row) return true;
      if (i.row.list === 'segments') return i.row.field === undefined || i.row.field === field;
      return field === 'x' || i.code !== 'outside';
    });
    return mine.length ? { invalid: true, describedBy: idOf(row) } : {};
  };
  // A row's own message. Not a live region: the results box announces every
  // problem, once; this one is read with the field it is tied to.
  const rowIssue = (row: ShaftRow) => {
    const texts = [...new Set(issuesOf(row).map(says))];
    return texts.length ? (
      <p className="mp-app__row-error" id={idOf(row)}>
        {texts.join(' ')}
      </p>
    ) : null;
  };
  // What the results box says, each thing once: the problems that are no row's, then those of the rows.
  const notices = [...a.issues.filter((i) => !i.row).map((i) => ({ id: `${uid}${i.code}`, text: says(i) })), ...a.issues.filter((i) => i.row).map((i) => ({ id: undefined, text: says(i) }))].filter(
    (n, i, all) => all.findIndex((m) => m.text === n.text) === i,
  );

  /* -- The rows of the form -- */
  const patch = (list: ShaftList, id: number, p: Record<string, unknown>) => dispatch({ type: 'patch', list, id, patch: p });
  const segmentName = (i: number) => `${w.shaft.segment} ${i + 1}`;
  const bearingName = (i: number) => `${w.bearings.name} ${i + 1}`;
  const forceName = (i: number) => `${w.forces.name} ${i + 1}`;
  const coupleName = (i: number) => `${t.row.names.couples} ${i + 1}`;
  // A row removed WITH THE KEYBOARD took the focus away with it, and the browser left it on nothing. It is given
  // to the first control of the row that takes the place - the next one, else the one before - or to the group's
  // "add" button when no row is left. Not after a click or a tap (`detail` counts them, and is 0 for a key): a
  // phone would open its keyboard on a field nobody touched.
  const removeRow = (list: ShaftList, id: number) => (press: React.MouseEvent<HTMLButtonElement>) => {
    const row = press.currentTarget.closest('.mp-app__item');
    const near = [row?.nextElementSibling, row?.previousElementSibling].find((el) => el?.classList.contains('mp-app__item'));
    const next = press.detail === 0 ? (near?.querySelector<HTMLElement>('input, select') ?? press.currentTarget.closest('fieldset')?.querySelector<HTMLElement>('.mp-app__add')) : null;
    dispatch({ type: 'remove', list, id });
    next?.focus();
  };
  const removeButton = (list: ShaftList, id: number, what: string, fixed = false) => (
    <button type="button" className="mp-app__remove" onClick={removeRow(list, id)} disabled={fixed} aria-label={`${t.row.remove}: ${what}`} title={t.row.remove}>
      <span aria-hidden="true">×</span>
    </button>
  );
  // A row added WITH THE KEYBOARD is handed the focus, in its first field - the rule of `removeRow`, the other way
  // round. Left on the button, nothing said that a row had come (no field was entered, and no line of the page
  // speaks of it), and its first field was four stops back for a segment and six for a load. The row is put on
  // screen first (`flushSync`): until then there is no field to take the focus. Not after a click or a tap
  // (`detail`, as above): a phone would open its keyboard on a field nobody touched.
  const addRow = (list: ShaftList) => (press: React.MouseEvent<HTMLButtonElement>) => {
    if (press.detail !== 0) {
      dispatch({ type: 'add', list });
      return;
    }
    const group = press.currentTarget.closest('fieldset');
    flushSync(() => dispatch({ type: 'add', list }));
    const rows = group?.querySelectorAll('.mp-app__item');
    const added = rows?.[rows.length - 1]?.querySelector<HTMLElement>('input, select');
    added?.focus();
  };
  // A list at its limit: the button stays where it is and does nothing, and the limit is a line of the page under
  // it. `disabled`, it dropped the focus of whoever had just added the last row with a key, and said why only in a
  // tooltip that a finger, a keyboard and a screen reader cannot reach. (Not on the printed sheet: calc.css.)
  const addButton = (list: ShaftList, label: string, full: boolean, limit: string) => (
    <>
      <button type="button" className="mp-app__add" onClick={full ? undefined : addRow(list)} aria-disabled={full || undefined} aria-describedby={full ? `${uid}${list}limit` : undefined}>
        <span aria-hidden="true">+</span> {label}
      </button>
      {full ? (
        <p className="mp-shaft__limit" id={`${uid}${list}limit`} role="status">
          {limit}
        </p>
      ) : null}
    </>
  );

  /* -- Where the values are read -- */
  // Under the pointer, else where typed, else the middle of the shaft - and
  // always ON the shaft, which may have got shorter since.
  const asked = probeX ?? typedX;
  const x0 = r ? (asked === null ? round4(r.L / 2) : Math.min(r.L, Math.max(0, asked))) : null;
  const here = useMemo(() => (r && x0 !== null ? r.at(x0) : null), [r, x0]);
  // A value that is two - just left of the point and just right of it - where the analysis says it jumps there
  // AND the two print differently: a force all in one plane leaves the other plane's shear one number.
  // In a table the unit is in the row's head, and a cell has none. Outside one - the stress, under the table - the
  // unit is handed in and follows EACH value, as it does in the line of the diameters above it: "3.622 ksi just
  // left, 6.258 ksi just right". Written once, after the words, it belonged to neither number.
  const sided = (left: number, right: number, jumps: boolean, unit?: string) => {
    const one = (v: number) => (unit ? `${num(v)} ${unit}` : num(v));
    return jumps && num(left) !== num(right) ? (
      <>
        {one(left)} <span className="mp-app__dir">{t.results.left}</span>, {one(right)} <span className="mp-app__dir">{t.results.right}</span>
      </>
    ) : (
      one(right)
    );
  };
  // A head of a table: what the column is and, after it, its unit - in the mono of every unit on the page and
  // never in capitals, which a head's own words are set in: "MPA" and "N·M" are not units.
  const head = (title: string, unit?: string) => (
    <>
      {title}
      {unit ? <span className="mp-plot__unit"> ({raised(unit)})</span> : null}
    </>
  );
  // A head over values that are OF THE TWO PLANES TOGETHER - a bearing's slope, a force's deflection and its slope -
  // says so, in the words of the switch of views and of the last column of "Values at a point". Beside a "Vertical
  // reaction" or a "Vertical deflection" a bare "Slope" read as the vertical plane's, which it is not.
  const together = (title: string) => `${title}, ${w.planes.both.toLowerCase()}`;
  // The same head inside a cell, for a phone: there a row is laid out as lines of its own and each cell stands
  // under its head (calc.css). Out of sight anywhere else, and silent everywhere: the table's own heads are read.
  const under = (title: string, unit?: string) => (
    <span className="mp-shaft__head" aria-hidden="true">
      {head(title, unit)}
    </span>
  );
  // A row of "Values at a point": a quantity in each plane and of the two together.
  const pointRow = (title: string, unit: string, left: ByPlanes, right: ByPlanes, jumps: boolean) => (
    <tr role="row">
      <th scope="row" role="rowheader">
        {head(title, unit)}
      </th>
      {VIEWS.map((plane) => (
        <td key={plane} role="cell">
          {under(w.planes[plane])}
          {sided(left[plane], right[plane], jumps)}
        </td>
      ))}
    </tr>
  );
  // The section on one side of a point: its diameter and, of a hollow one, its bore - as they were entered.
  const sectionOn = (side: ShaftSide) => `${num(side.d, 6)} ${u.diameter}${side.bore ? `, ${w.shaft.bore.toLowerCase()} ${num(side.bore, 6)} ${u.diameter}` : ''}`;

  /* -- The drawings in words -- */
  // A largest value that is zero is said as zero, at no place; a diagram
  // that is zero all along, in one word. Of the two planes together only
  // the largest is said: a size has no lowest value worth naming.
  const spoken = (title: string, unit: string, peaks: ShaftPeaks) => {
    const one = (p: ShaftValue) => `${num(p.value)} ${unit}${p.x === null ? '' : ` ${where(p.x)}`}`;
    if (peaks.max.value === 0 && peaks.min.value === 0) return `${title}: ${t.plot.zero}.`;
    return view === 'both' ? `${title}: ${t.plot.max} ${one(peaks.max)}.` : `${title}: ${t.plot.max} ${one(peaks.max)}; ${t.plot.min} ${one(peaks.min)}.`;
  };
  // What the three diagrams are called. In one plane, the first calculator's names. Of the two planes together
  // each diagram is a RESULTANT - a size, never under its axis - and its title says so: under the plain
  // "Deflection" a shaft pushed down was drawn humped upward, the mirror of the vertical plane's own diagram.
  const titles: { shear: string; moment: string; deflection: string } = view === 'both' ? w.results.resultant : t.results;
  const summary = {
    shaft: `${w.results.schematic}, ${w.planes[view]}: ${placed(drawing.L)} ${u.length}; ${drawing.bearings.map((b) => `${w.bearings.name} x = ${placed(b.x)} ${u.length}`).join(', ')}.`,
    V: shown ? spoken(titles.shear, u.force, shown.peaks.V) : '',
    M: shown ? spoken(titles.moment, u.moment, shown.peaks.M) : '',
    D: shown ? spoken(titles.deflection, u.deflection, shown.peaks.D) : '',
  };
  // One diagram of the view shown, and under the pointer its own value there.
  const plot = (title: string, unit: string, d: ShaftDiagram, text: string, read: number | null) =>
    r ? (
      <Plot
        title={title}
        unit={unit}
        points={d.points}
        marks={d.marks}
        breaks={r.breaks}
        L={r.L}
        width={width}
        height={plotHeight}
        probe={probeX !== null && read !== null && x0 !== null ? { x: x0, y: read } : null}
        onProbe={probe}
        summary={text}
        group={group}
      />
    ) : null;

  /* -- The numbers -- */
  // The five cards. A value and not a part of the page's markup, because they stand in one of two places: on
  // screen under the form and the drawings, across the page; ON PAPER straight under the form, before the
  // drawings. A shaft's form is short and its drawing tall: with the cards last, as on the other calculators'
  // sheets, the four drawings either went overleaf together and left the first sheet half empty, or parted and
  // left one diagram alone at the head of the second. Under the form, the cards fill the first sheet with every
  // number, and the shaft and its three diagrams follow together.
  const cards =
    r && here && x0 !== null ? (
      <div className="mp-app__tables" aria-busy={catching ? true : undefined}>
        <div className="mp-app__card mp-app__card--wide">
          <h3 className="mp-app__h">{w.bearings.title}</h3>
          {/* Each cell says what it is (`under`): on a phone a row is laid out as
              lines of its own (calc.css), and a browser that reads a table's
              meaning from its layout would lose it there - so the roles too. */}
          <table className="mp-app__table mp-shaft__table" role="table">
            <thead role="rowgroup">
              <tr role="row">
                <th scope="col" role="columnheader">
                  {head(w.bearings.name)}
                </th>
                <th scope="col" role="columnheader">
                  {head(t.results.position, u.length)}
                </th>
                <th scope="col" role="columnheader">
                  {head(w.results.reactionV, u.force)}
                </th>
                <th scope="col" role="columnheader">
                  {head(w.results.reactionH, u.force)}
                </th>
                <th scope="col" role="columnheader">
                  {head(w.results.radial, u.force)}
                </th>
                <th scope="col" role="columnheader">
                  {head(together(t.results.slope), u.slope)}
                </th>
              </tr>
            </thead>
            <tbody role="rowgroup">
              {r.bearings.map((b) => (
                <tr key={b.index} role="row">
                  <th scope="row" role="rowheader">
                    {under(w.bearings.name)}
                    {b.index + 1}
                  </th>
                  <td role="cell">
                    {under(t.results.position, u.length)}
                    {placed(b.x)}
                  </td>
                  <td role="cell">
                    {under(w.results.reactionV, u.force)}
                    {pointed(b.reaction.vertical, ...ways.vertical)}
                  </td>
                  <td role="cell">
                    {under(w.results.reactionH, u.force)}
                    {pointed(b.reaction.horizontal, ...ways.horizontal)}
                  </td>
                  <td role="cell">
                    {under(w.results.radial, u.force)}
                    {num(b.reaction.both)}
                  </td>
                  <td role="cell">
                    {under(together(t.results.slope), u.slope)}
                    {num(b.slope.both)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {/* Each plane's forces, added up, as a size and the way it points: a positive one is downward, and
              towards the viewer. (An applied moment adds nothing to them: lib/calc/shaft/strings.ts, `balance`.)
              Said of both planes only when both do balance; where one does not, that is what is said, in the
              first calculator's words. */}
          {PLANES.every((plane) => r.balance[plane].ok) ? (
            <p className="mp-app__note">
              {PLANES.reduce((line, plane) => {
                const load = r.balance[plane].load;
                const way = load === 0 ? '' : ` ${arrow(load, ways[plane][1], ways[plane][0])}`;
                return line.replace(`{${plane}}`, `${num(Math.abs(load))} ${u.force}${way}`);
              }, w.results.balance)}
            </p>
          ) : (
            PLANES.filter((plane) => !r.balance[plane].ok).map((plane) => (
              <p key={plane} className="mp-app__row-error">
                {w.planes[plane]}: {t.results.unbalanced.replace('{sum}', num(r.balance[plane].reactions)).replace('{load}', num(r.balance[plane].load)).replace(/\{unit\}/g, u.force)}
              </p>
            ))
          )}
        </div>

        <div className="mp-app__card mp-app__card--wide">
          <h3 className="mp-app__h">{w.results.bySegment}</h3>
          <table className="mp-app__table mp-shaft__table" role="table">
            <thead role="rowgroup">
              <tr role="row">
                <th scope="col" role="columnheader">
                  {head(w.shaft.segment, u.length)}
                </th>
                <th scope="col" role="columnheader">
                  {head(w.shaft.diameter, u.diameter)}
                </th>
                <th scope="col" role="columnheader">
                  {head(t.section.I, u.I)}
                </th>
                <th scope="col" role="columnheader">
                  {head(w.results.modulus, u.Z)}
                </th>
                {r.ownWeight !== null ? (
                  <th scope="col" role="columnheader">
                    {head(w.results.weight, u.line)}
                  </th>
                ) : null}
                <th scope="col" role="columnheader">
                  {head(w.results.largestMoment, u.moment)}
                </th>
                <th scope="col" role="columnheader">
                  {head(w.results.stress, u.stress)}
                </th>
              </tr>
            </thead>
            <tbody role="rowgroup">
              {r.segments.map((s) => (
                <tr key={s.id} role="row">
                  <th scope="row" role="rowheader">
                    {under(w.shaft.segment, u.length)}
                    {/* The segment's number, a colon, then where it runs. With a space alone between them a count and a
                        length read as one run of digits — "2 4 – 14", "3 14 – 18" — on paper most of all, where both are black. */}
                    {s.index + 1}:{' '}
                    <span className="mp-app__dir">
                      {placed(s.from)} – {placed(s.to)}
                    </span>
                  </th>
                  <td role="cell">
                    {under(w.shaft.diameter, u.diameter)}
                    {num(s.d, 6)}
                    {s.bore ? (
                      <span className="mp-app__dir">
                        {' '}
                        {w.shaft.bore.toLowerCase()} {num(s.bore, 6)}
                      </span>
                    ) : null}
                  </td>
                  <td role="cell">
                    {under(t.section.I, u.I)}
                    {num(s.section.I)}
                  </td>
                  <td role="cell">
                    {under(w.results.modulus, u.Z)}
                    {num(s.section.Z)}
                  </td>
                  {s.w !== null ? (
                    <td role="cell">
                      {under(w.results.weight, u.line)}
                      {num(s.w)}
                    </td>
                  ) : null}
                  <td role="cell">
                    {under(w.results.largestMoment, u.moment)}
                    {num(s.moment.value)}
                    {/* The place is one thing, and a line never ends inside it (calc.css) - but one may end BEFORE
                        it: the space is outside. Inside, the value and its place were one word, wider than half a
                        card on a narrow phone, and were written over the stress beside them. */}
                    {s.moment.x === null ? null : (
                      <>
                        {' '}
                        <span className="mp-app__dir mp-shaft__where">{where(s.moment.x)}</span>
                      </>
                    )}
                  </td>
                  <td role="cell">
                    {under(w.results.stress, u.stress)}
                    {num(s.stress.value)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="mp-app__note">{w.results.nominal}</p>
        </div>

        {r.forces.length ? (
          <div className="mp-app__card mp-app__card--wide">
            <h3 className="mp-app__h">{w.results.atForces}</h3>
            <table className="mp-app__table mp-shaft__table" role="table">
              <thead role="rowgroup">
                <tr role="row">
                  <th scope="col" role="columnheader">
                    {head(w.forces.name)}
                  </th>
                  <th scope="col" role="columnheader">
                    {head(t.results.position, u.length)}
                  </th>
                  <th scope="col" role="columnheader">
                    {head(together(t.results.deflection), u.deflection)}
                  </th>
                  <th scope="col" role="columnheader">
                    {head(w.results.deflectionV, u.deflection)}
                  </th>
                  <th scope="col" role="columnheader">
                    {head(w.results.deflectionH, u.deflection)}
                  </th>
                  <th scope="col" role="columnheader">
                    {head(together(t.results.slope), u.slope)}
                  </th>
                </tr>
              </thead>
              <tbody role="rowgroup">
                {r.forces.map((f) => (
                  <tr key={f.id} role="row">
                    <th scope="row" role="rowheader">
                      {under(w.forces.name)}
                      {f.index + 1}
                    </th>
                    <td role="cell">
                      {under(t.results.position, u.length)}
                      {placed(f.x)}
                    </td>
                    <td role="cell">
                      {under(together(t.results.deflection), u.deflection)}
                      {num(f.deflection.both)}
                    </td>
                    <td role="cell">
                      {under(w.results.deflectionV, u.deflection)}
                      {pointed(f.deflection.vertical, ...ways.vertical)}
                    </td>
                    <td role="cell">
                      {under(w.results.deflectionH, u.deflection)}
                      {pointed(f.deflection.horizontal, ...ways.horizontal)}
                    </td>
                    <td role="cell">
                      {under(together(t.results.slope), u.slope)}
                      {num(f.slope.both)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : null}

        <div className="mp-app__card">
          <h3 className="mp-app__h">{t.results.maxima}</h3>
          <dl className="mp-app__dl">
            <div>
              <dt>{t.results.moment}</dt>
              <dd>
                {num(r.largest.moment.value)} {u.moment} <span className="mp-app__dir">{r.largest.moment.x === null ? '' : where(r.largest.moment.x)}</span>
              </dd>
            </div>
            <div>
              <dt>{w.results.stress}</dt>
              <dd>
                {num(r.largest.stress.value)} {u.stress}{' '}
                {/* At a shoulder the place alone does not say which side: the segment does. */}
                <span className="mp-app__dir">
                  {r.largest.stress.x === null ? '' : where(r.largest.stress.x)}
                  {r.largest.stress.segment === null ? '' : `, ${w.shaft.segment.toLowerCase()} ${r.largest.stress.segment + 1}`}
                </span>
              </dd>
            </div>
            <div>
              <dt>{t.results.deflection}</dt>
              <dd>
                {num(r.largest.deflection.value)} {u.deflection} <span className="mp-app__dir">{r.largest.deflection.x === null ? '' : where(r.largest.deflection.x)}</span>
              </dd>
            </div>
            <div>
              <dt>{t.results.slope}</dt>
              <dd>
                {num(r.largest.slope.value)} {u.slope} <span className="mp-app__dir">{r.largest.slope.x === null ? '' : where(r.largest.slope.x)}</span>
              </dd>
            </div>
          </dl>
          <p className="mp-app__note">{w.results.sizes}</p>
        </div>

        {/* The last card: the sheet leaves its hint off paper by its place (calc.css). */}
        <div className="mp-app__card">
          <h3 className="mp-app__h">{t.results.point}</h3>
          <div className="mp-app__row mp-app__row--one">
            {/* The position as it is held, never rounded for show: the values
                below are read at THIS x. One from a diagram arrives already
                rounded (BeamPlot). */}
            <NumField
              numbers={t.numbers}
              label="x"
              unit={u.length}
              value={x0}
              // Taking the field holds the position where it is: the pointer
              // leaving a diagram on its way here must not move it.
              onEdit={() => {
                typingX.current = true;
                setTypedX(x0);
                setProbeX(null);
              }}
              onCommit={() => {
                typingX.current = false;
              }}
              onChange={(x) => {
                setProbeX(null);
                setTypedX(x);
              }}
            />
          </div>
          <table className="mp-app__table mp-shaft__table mp-shaft__table--point" role="table">
            <thead role="rowgroup">
              <tr role="row">
                <td role="cell" />
                {VIEWS.map((plane) => (
                  <th key={plane} scope="col" role="columnheader">
                    {w.planes[plane]}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody role="rowgroup">
              {pointRow(t.results.shear, u.force, here.left.shear, here.right.shear, here.jumps.shear)}
              {pointRow(t.results.moment, u.moment, here.left.moment, here.right.moment, here.jumps.moment)}
              {pointRow(t.results.deflection, u.deflection, here.deflection, here.deflection, false)}
              {pointRow(t.results.slope, u.slope, here.slope, here.slope, false)}
            </tbody>
          </table>
          <dl className="mp-app__dl">
            <div>
              <dt>{w.shaft.diameter}</dt>
              <dd>
                {here.jumps.section ? (
                  <>
                    {sectionOn(here.left)} <span className="mp-app__dir">{t.results.left}</span>, {sectionOn(here.right)} <span className="mp-app__dir">{t.results.right}</span>
                  </>
                ) : (
                  sectionOn(here.right)
                )}
              </dd>
            </div>
            <div>
              <dt>{w.results.stress}</dt>
              <dd>
                {sided(here.left.stress, here.right.stress, here.jumps.stress, u.stress)}
              </dd>
            </div>
          </dl>
          <p className="mp-app__note">{t.results.pointHint}</p>
        </div>
      </div>
    ) : null;

  // The box of notices. A value too, because of the one case in which it has cards to stand before: a link that
  // could not be read, where the example is shown, solved. On screen the box is at the head of the answer, over
  // the drawings. On paper the cards go under the form (above): left where it was, the box came after them - three
  // cards of the example's numbers on the first sheet, and the line that says they are not the shaft that was sent
  // on the second, where it also took the room the drawings needed and sent them a sheet further. So on paper,
  // when it has something to say and there are cards, it stands over them (`boxFirst`). A shaft at fault has no
  // cards, and a shaft with nothing to be said an empty box: both stay where they are.
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
  const boxFirst = onPaper && cards !== null && (notices.length > 0 || linkError);

  return (
    <div className={onPaper ? 'mp-app mp-shaft mp-shaft--sheet' : 'mp-app mp-shaft'} ref={root}>
      <div className="mp-app__top">
        {/* -- the form -- */}
        <form className="mp-app__form" onSubmit={(e) => e.preventDefault()} noValidate>
          <div className="mp-app__bar">
            <fieldset className="mp-seg">
              <legend className="mp-num__label">{t.toolbar.units}</legend>
              {(['us', 'si'] as const).map((unit) => (
                <label key={unit} className="mp-seg__item">
                  <input
                    type="radio"
                    name="shaft-units"
                    checked={form.units === unit}
                    onChange={() => {
                      dispatch({ type: 'units', units: unit });
                      // A position typed in inches is not that many millimetres.
                      setTypedX(null);
                      setProbeX(null);
                    }}
                  />
                  <span>{w.toolbar[unit]}</span>
                </label>
              ))}
            </fieldset>
          </div>

          <fieldset className="mp-app__group">
            <legend>{w.shaft.title}</legend>
            {form.segments.map((s, i) => {
              const row: ShaftRow = { list: 'segments', id: s.id };
              return (
                <div key={s.id} className="mp-app__item" role="group" aria-label={segmentName(i)} data-invalid={issuesOf(row).length ? 'true' : undefined}>
                  {/* Which segment this is, for the eye: the results name a segment by this number. */}
                  <p className="mp-shaft__name" aria-hidden="true">
                    {segmentName(i)}
                  </p>
                  <div className="mp-app__row mp-app__row--rm">
                    <div className="mp-app__fields mp-shaft__segment">
                      <NumField numbers={t.numbers} label={t.beam.length} unit={u.length} value={s.L} onChange={(L) => patch('segments', s.id, { L })} {...fault(row, 'L')} />
                      <NumField numbers={t.numbers} label={w.shaft.diameter} unit={u.diameter} value={s.d} onChange={(d) => patch('segments', s.id, { d })} {...fault(row, 'd')} />
                      {/* A solid segment is an empty field, not a bore of 0. Named for the printed sheet, which leaves an empty one out (calc.css). */}
                      <NumField
                        numbers={t.numbers}
                        label={w.shaft.bore}
                        unit={u.diameter}
                        value={s.bore}
                        emptyIs={0}
                        onChange={(bore) => patch('segments', s.id, { bore })}
                        className={s.bore === 0 ? 'mp-shaft__solid' : ''}
                        {...fault(row, 'bore')}
                      />
                    </div>
                    {/* A shaft has a segment: the last one stays. */}
                    {removeButton('segments', s.id, segmentName(i), form.segments.length < 2)}
                  </div>
                  {rowIssue(row)}
                </div>
              );
            })}
            {addButton('segments', w.shaft.add, form.segments.length >= MAX_SEGMENTS, w.shaft.limit)}
            {/* The segments end to end: what every position is measured along. */}
            {/* To the eight figures a field holds, not the six of a place: 10 1/64 + 13 5/32 in is 23.171875 in, and "23.1719"
                typed back as the place of a bearing was past the end of that shaft. */}
            <p className="mp-app__computed">{w.shaft.total.replace('{length}', `${num(a.L, 8)} ${u.length}`)}</p>
            <p className="mp-app__note">{w.shaft.note}</p>
          </fieldset>

          <fieldset className="mp-app__group">
            <legend>{w.bearings.title}</legend>
            <div className="mp-app__row mp-app__row--two">
              {([0, 1] as const).map((index) => (
                <NumField
                  key={index}
                  numbers={t.numbers}
                  label={bearingName(index)}
                  unit={u.length}
                  value={form.bearings[index]}
                  onChange={(x) => dispatch({ type: 'bearing', index, x })}
                  {...fault({ list: 'bearings', index })}
                />
              ))}
            </div>
            {([0, 1] as const).map((index) => (
              <React.Fragment key={index}>{rowIssue({ list: 'bearings', index })}</React.Fragment>
            ))}
            <p className="mp-app__note">{w.bearings.note}</p>
          </fieldset>

          <fieldset className="mp-app__group">
            <legend>{w.forces.title}</legend>
            {/* Over the rows, not after them: the first row offers "Towards viewer", and this is the line that says
                where the viewer stands. Under twelve forces it was three windows further down. */}
            <p className="mp-app__note">{w.forces.note}</p>
            {form.forces.length === 0 ? <p className="mp-app__none">{t.loads.none}</p> : null}
            {form.forces.map((f, i) => {
              const row: ShaftRow = { list: 'forces', id: f.id };
              return (
                <div key={f.id} className="mp-app__item" role="group" aria-label={forceName(i)} data-invalid={issuesOf(row).length ? 'true' : undefined}>
                  {/* Which force this is, for the eye: the card "At each force" names it by this number. */}
                  <p className="mp-shaft__name" aria-hidden="true">
                    {forceName(i)}
                  </p>
                  <div className="mp-app__row mp-app__row--rm">
                    {/* Its place, then each plane's size beside the way it points: a line to a plane (calc.css). */}
                    <div className="mp-app__fields mp-shaft__load">
                      <NumField numbers={t.numbers} label={t.results.position} unit={u.length} value={f.x} onChange={(x) => patch('forces', f.id, { x })} {...fault(row, 'x')} />
                      <NumField numbers={t.numbers} label={w.forces.vertical} unit={u.force} value={f.v} onChange={(v) => patch('forces', f.id, { v })} {...fault(row, 'size')} />
                      {sense<Direction>(t.loads.direction, w.forces.vertical, f.vDir, [['down', t.loads.down], ['up', t.loads.up]], (vDir) => patch('forces', f.id, { vDir }))}
                      <NumField numbers={t.numbers} label={w.forces.horizontal} unit={u.force} value={f.h} onChange={(h) => patch('forces', f.id, { h })} className="mp-shaft__second" {...fault(row, 'size')} />
                      {sense<Sideways>(t.loads.direction, w.forces.horizontal, f.hDir, [['towards', w.forces.towards], ['away', w.forces.away]], (hDir) => patch('forces', f.id, { hDir }))}
                    </div>
                    {removeButton('forces', f.id, forceName(i))}
                  </div>
                  {rowIssue(row)}
                </div>
              );
            })}
            {addButton('forces', w.forces.add, form.forces.length >= MAX_ROWS, t.row.limit)}
          </fieldset>

          <fieldset className="mp-app__group">
            <legend>{t.loads.couple}</legend>
            {/* Over the rows too: each row asks for a sense, and this is the line that says how a sense is read. */}
            <p className="mp-app__note">{w.couples.note}</p>
            {form.couples.length === 0 ? <p className="mp-app__none">{t.loads.noneCouple}</p> : null}
            {form.couples.map((c, i) => {
              const row: ShaftRow = { list: 'couples', id: c.id };
              return (
                <div key={c.id} className="mp-app__item" role="group" aria-label={coupleName(i)} data-invalid={issuesOf(row).length ? 'true' : undefined}>
                  <p className="mp-shaft__name" aria-hidden="true">
                    {coupleName(i)}
                  </p>
                  <div className="mp-app__row mp-app__row--rm">
                    {/* A force's row, with a size whose unit is twice as long ("lbf·in"): on a phone it is given
                        more of the line, and on the narrowest a line of its own (calc.css). */}
                    <div className="mp-app__fields mp-shaft__load mp-shaft__load--moment">
                      <NumField numbers={t.numbers} label={t.results.position} unit={u.length} value={c.x} onChange={(x) => patch('couples', c.id, { x })} {...fault(row, 'x')} />
                      <NumField numbers={t.numbers} label={w.planes.vertical} unit={u.moment} value={c.v} onChange={(v) => patch('couples', c.id, { v })} {...fault(row, 'size')} />
                      {sense<Rotation>(t.loads.direction, w.planes.vertical, c.vDir, [['ccw', t.loads.ccw], ['cw', t.loads.cw]], (vDir) => patch('couples', c.id, { vDir }))}
                      <NumField numbers={t.numbers} label={w.planes.horizontal} unit={u.moment} value={c.h} onChange={(h) => patch('couples', c.id, { h })} className="mp-shaft__second" {...fault(row, 'size')} />
                      {sense<Rotation>(t.loads.direction, w.planes.horizontal, c.hDir, [['ccw', t.loads.ccw], ['cw', t.loads.cw]], (hDir) => patch('couples', c.id, { hDir }))}
                    </div>
                    {removeButton('couples', c.id, coupleName(i))}
                  </div>
                  {rowIssue(row)}
                </div>
              );
            })}
            {addButton('couples', t.loads.addCouple, form.couples.length >= MAX_ROWS, t.row.limit)}
          </fieldset>

          <fieldset className="mp-app__group">
            <legend>{w.material.title}</legend>
            {/* The list is as wide as its longest word, "Other (enter E)": on a narrow phone it has a line to itself (calc.css). */}
            <div className="mp-app__row mp-app__row--two mp-shaft__material">
              {select<ShaftMaterial>(
                t.section.material,
                form.material,
                [
                  ['steel', t.section.materials.steel],
                  ['stainless', w.material.stainless],
                  ['aluminum', t.section.materials.aluminum],
                  ['custom', t.section.materials.custom],
                ],
                (material) => dispatch({ type: 'material', material }),
              )}
              <NumField numbers={t.numbers} label={t.section.E} unit={u.E} value={form.E} onChange={(E) => dispatch({ type: 'modulus', E })} {...fault({ list: 'material', field: 'E' })} />
            </div>
            {rowIssue({ list: 'material', field: 'E' })}
            <p className="mp-app__note">{w.material.note}</p>
            <label className="mp-app__check">
              <input type="checkbox" checked={form.ownWeight} onChange={(e) => dispatch({ type: 'own-weight', on: e.target.checked })} />
              <span>{w.material.ownWeight}</span>
            </label>
            {/* The density is what the weight is made of, and of nothing else: asked for with the weight. */}
            {form.ownWeight ? (
              <>
                {/* Named for the sheet of styles: its unit, "lb/in³", is the longest of the form (calc.css). */}
                <div className="mp-app__row mp-app__row--one mp-shaft__density">
                  <NumField numbers={t.numbers} label={w.material.density} unit={u.density} value={form.density} onChange={(density) => dispatch({ type: 'density', density })} {...fault({ list: 'material', field: 'density' })} />
                </div>
                {rowIssue({ list: 'material', field: 'density' })}
                {r && r.ownWeight !== null ? <p className="mp-app__computed">{w.material.weight.replace('{weight}', `${num(r.ownWeight)} ${u.force}`)}</p> : null}
              </>
            ) : null}
          </fieldset>

          <Actions
            t={{ ...t.toolbar, copy: w.toolbar.copy }}
            copy={() => {
              // The address is brought to this shaft too, and a link that could not
              // be read has nothing left to say: the one copied is the shaft on screen.
              address.take(encodeShaft(form));
              return address.link(encodeShaft(form));
            }}
            reset={() => {
              // One press throws away whatever was typed, and nothing is asked. So the shaft that goes — unless it is the
              // example — is left one step behind in the browser's history: Back brings it back, as the page opens any
              // shaft its address holds (../shell/address.ts), and Forward returns to the example. The address is brought
              // to that shaft first: the entry left behind is the one on screen. Where a browser refuses another entry
              // (Safari, past a hundred changes in thirty seconds) Start over still starts over.
              const thrown = encodeShaft(form);
              if (thrown !== EXAMPLE) {
                address.take(thrown);
                try {
                  window.history.pushState(window.history.state, '', window.location.href);
                } catch {
                  /* the way back is a convenience; the calculator works without it */
                }
              }
              const example = defaultShaft();
              dispatch({ type: 'load', form: example });
              setWhole(example);
              // As the page opens: both planes together.
              setView('both');
              setTypedX(null);
              setProbeX(null);
              // The address goes bare - if what is after the # is a shaft.
              address.take(EXAMPLE);
            }}
          />
        </form>

        {/* On paper only: the cards, between the input and the drawings (`cards`, above) - and over them what the box says, when it says something (`box`, above). */}
        {boxFirst ? box : null}
        {onPaper ? cards : null}

        {/* -- the answer -- */}
        <section className={tooTall ? 'mp-app__out mp-app__out--tall' : 'mp-app__out'} aria-label={t.results.title} ref={outRef} aria-busy={catching ? true : undefined}>
          {boxFirst ? null : box}

          {/* Which view the drawings below are of. Real radios, as the units are: on paper the one chosen is
              printed as its words, so a sheet says which plane its diagrams show. */}
          <fieldset className="mp-seg mp-shaft__view">
            <legend className="mp-num__label">{w.view.title}</legend>
            {VIEWS.map((v) => (
              <label key={v} className="mp-seg__item">
                <input type="radio" name="shaft-view" checked={view === v} onChange={() => setView(v)} />
                <span>{w.planes[v]}</span>
              </label>
            ))}
          </fieldset>

          <div className="mp-app__plots" ref={plotRef} onPointerDownCapture={leaveX}>
            <p className="mp-plot__title mp-plot__title--first">
              {w.results.schematic}
              {/* How the view is seen: the drawing cannot say that down the page is towards the viewer. */}
              <span className="mp-plot__unit"> · {w.results.seen[view]}</span>
              {/* The band along the shaft has no number by it: the whole weight is written here. It is a load of the
                  vertical plane, and so of the two together, where it is among the loads and is not drawn. */}
              {r && r.ownWeight !== null && view !== 'horizontal' ? (
                <span className="mp-plot__unit">
                  {' '}
                  · {t.results.ownWeight} {num(r.ownWeight)} {u.force}
                </span>
              ) : null}
            </p>
            <Schematic drawing={drawing} resultants={view === 'both'} width={width} probeX={probeX !== null ? x0 : null} summary={summary.shaft} group={group} />
            {r && shown ? (
              <>
                {plot(titles.shear, u.force, shown.diagrams.V, summary.V, here ? here.right.shear[view] : null)}
                {plot(titles.moment, u.moment, shown.diagrams.M, summary.M, here ? here.right.moment[view] : null)}
                {plot(titles.deflection, u.deflection, shown.diagrams.D, summary.D, here ? here.deflection[view] : null)}
                <p className="mp-app__note">{w.results.signs[view]}</p>
              </>
            ) : (
              <p className="mp-app__need">{w.results.waiting}</p>
            )}
          </div>
        </section>
      </div>

      {/* -- the numbers: here on screen, under the form and the drawings; on paper they are under the form (above) -- */}
      {onPaper ? null : cards}

      <p className="mp-app__privacy">{t.results.privacy}</p>
      {/* On paper only: when the sheet was printed, and the address that opens this very shaft again. */}
      <SheetStamp stamp={stamp} t={{ printed: t.sheet.printed, link: w.sheet.link }} />
    </div>
  );
}
