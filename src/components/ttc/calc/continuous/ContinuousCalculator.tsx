'use client';

import React, { useCallback, useEffect, useId, useMemo, useReducer, useRef, useState } from 'react';
import { formatNumber } from '@/lib/calc/format';
import { MAX_ROWS, UNITS, round4, type Direction } from '@/lib/calc/beam/model';
import type { BeamUi } from '@/lib/calc/beam/strings';
import { analyseContinuous, drawingOf, type AnalysisIssue, type Both, type Diagram, type Value } from '@/lib/calc/continuous/analysis';
import { STIFF } from '@/lib/calc/continuous/engine';
import {
  CONTINUOUS_KEY,
  MAX_SPANS,
  decodeContinuous,
  defaultContinuous,
  encodeContinuous,
  generalCode,
  jointPositions,
  reduceContinuous,
  type ContinuousForm,
  type ContinuousRow,
  type LoadList,
} from '@/lib/calc/continuous/model';
import type { ContinuousUi } from '@/lib/calc/continuous/strings';
import type { EndKind, Range } from '@/lib/calc/continuous/types';
import { BeamPlot } from '../beam/BeamPlot';
import { BeamSchematic } from '../beam/BeamSchematic';
import { NumField } from '../NumField';
import { Actions } from '../shell/Actions';
import { useAddress } from '../shell/address';
import { select } from '../shell/fields';
import { PAPER_PLOT, PAPER_WIDTH, usePlotHeight, useTooTall, useWidth } from '../shell/layout';
import { arrow, two } from '../shell/results';
import { SectionGroup } from '../shell/SectionGroup';
import { SheetStamp, useSheet } from '../shell/sheet';
import { useSteelShapes } from '../shell/steel';

/**
 * CONTINUOUS BEAM — the calculator (/resources/continuous-beam).
 *
 * The third calculator of the catalogue, and the first one's sibling
 * (beam/BeamCalculator.tsx): the form on the left, the answer on the right
 * and nothing between them — every keystroke that leaves a number in a field
 * solves the beam again; the address follows the beam (`#c=…`); nothing
 * leaves the browser; its words are props; it renders on the server with its
 * example. What is the same from one calculator to the next is the shell's
 * (../shell), used here and not copied; the drawing of the beam and the
 * three diagrams are the first calculator's own components.
 *
 * WHAT IS THIS ONE'S. The beam is entered SPAN BY SPAN: each span with its
 * length, its stiffness as a multiple of the section's EI, and a uniform
 * dead and live load; the two ends on a simple support, fixed or free; a
 * settlement for any support; further loads on one span each, dead or live.
 * And the live load can be taken in EVERY ARRANGEMENT, span by span: each
 * diagram is then a band between its two edges, and each value of the cards
 * a pair — the highest and the lowest — with the spans whose live load is on
 * in the arrangement that gives it.
 *
 * All the arithmetic is in lib/calc/continuous: `model.ts` (the form, what
 * each edit does to it, the address), `engine.ts` and `envelope.ts` (the
 * beam, and every arrangement of it), and `analysis.ts`, which hands this
 * file every number it prints ALREADY SETTLED — what is rounding is zero
 * there, once. This file is the form, the tables and the wiring: it decides
 * nothing about a number.
 *
 * TWO SETS OF WORDS. `t` is the first calculator's (beam/strings.ts): the
 * pieces the two share say the same things. `c` is what a continuous beam
 * adds (continuous/strings.ts). Neither file is imported here — both
 * languages would travel with the script.
 *
 * WHICH SPANS ARE LOADED is drawn, not written out, beside a value: the
 * beam in miniature, with a block over each span whose live load is on
 * (`LivePattern`). A sentence for each of four values in a row of a table
 * ran off a phone; the miniature is as wide for eight spans as "live load
 * on" is, and reads at a glance down a column. It says the sentence to a
 * screen reader, and the card of largest values has room for both.
 */

/** The example beam, as it is written in an address. */
const EXAMPLE = encodeContinuous(defaultContinuous());

/**
 * What the fragment of an address opens. `undefined`: it is not this
 * calculator's (`#main` is a place on the page; `#b=…` is the first
 * calculator's beam, which is not read here). `null`: it is, and cannot be
 * read — its key with nothing after it included: a link cut that short is a
 * link that cannot be read.
 */
function caseIn(hash: string): ContinuousForm | null | undefined {
  const m = hash.match(new RegExp(`^#${CONTINUOUS_KEY}=(.*)$`));
  if (!m) return undefined;
  let text = m[1];
  try {
    text = decodeURIComponent(text);
  } catch {
    /* not percent-encoded: read as it is */
  }
  return decodeContinuous(text);
}

/**
 * The beam in miniature, for which spans carry their live load: a line, a
 * tick under each support, and a block over each span whose live load is on.
 * `held`: whether each joint has a support (a free end has none). `said`:
 * the same in words, for whoever cannot see it — left out where the words
 * stand beside it.
 */
function LivePattern({ on, held, said }: { on: number[]; held: boolean[]; said?: string }) {
  const n = held.length - 1;
  const step = 11;
  return (
    <svg className="mp-cont__pattern" width={n * step + 1} height={13} viewBox={`0 0 ${n * step + 1} 13`} role={said ? 'img' : undefined} aria-label={said} aria-hidden={said ? undefined : true} focusable="false">
      {on.map((i) => (
        <rect key={i} x={i * step + 1.5} y={1.5} width={step - 2} height={6} />
      ))}
      <line x1={0} x2={n * step + 1} y1={9} y2={9} />
      {held.map((is, j) => (is ? <line key={j} x1={j * step + 0.5} x2={j * step + 0.5} y1={9} y2={13} /> : null))}
    </svg>
  );
}

/**
 * `generalPath`: the first calculator's address in the page's language, for
 * the line that leads to it with this beam. `initial`: the beam it opens
 * with, where that is not the example — for the tests, which cannot type.
 */
export function ContinuousCalculator({ t, c, generalPath, initial }: { t: BeamUi; c: ContinuousUi; generalPath?: string; initial?: ContinuousForm }) {
  const [form, dispatch] = useReducer(reduceContinuous, initial, (given) => given ?? defaultContinuous());
  const [probeX, setProbeX] = useState<number | null>(null);
  const [typedX, setTypedX] = useState<number | null>(null);
  const [plotRef, windowWidth] = useWidth<HTMLDivElement>();
  const [outRef, tooTall] = useTooTall<HTMLElement>();
  const windowPlotHeight = usePlotHeight();
  const u = UNITS[form.units];
  // What the ids of this form's messages begin with.
  const uid = useId();

  // The last length the visitor settled on for each span (by its id), and
  // the span whose length is being typed: what sat on the right end of a
  // span follows its new length once the field is left (model.ts,
  // `carry-end`) — never while 30 is being typed over 24, which passes
  // through 3.
  const settledL = useRef(new Map<number, number>());
  const editingL = useRef<number | null>(null);
  useEffect(() => {
    const kept = new Map<number, number>();
    for (const s of form.spans) {
      const before = settledL.current.get(s.id);
      if (editingL.current !== s.id && s.L > 0 && Number.isFinite(s.L)) kept.set(s.id, s.L);
      else if (before !== undefined) kept.set(s.id, before);
    }
    settledL.current = kept;
  }, [form.spans]);

  // THE ADDRESS FOLLOWS THE BEAM (../shell/address.ts). As in the first
  // calculator, the beam with a length half typed and its loads not yet
  // carried along is never written: what is written meanwhile is the beam
  // that leaving the field makes of it.
  const leaving = useCallback(() => {
    const typed = form.spans.find((s) => s.id === editingL.current);
    return typed && typed.L > 0 && Number.isFinite(typed.L) ? reduceContinuous(form, { type: 'carry-end', id: typed.id, from: settledL.current.get(typed.id) ?? 0, to: typed.L }) : form;
  }, [form]);
  // The case as the address is to write it, at the moment it is written: the
  // same function for as long as the beam is the same.
  const code = useCallback(() => encodeContinuous(leaving()), [leaving]);
  const address = useAddress<ContinuousForm>({
    key: CONTINUOUS_KEY,
    example: EXAMPLE,
    code,
    read: caseIn,
    blank: defaultContinuous,
    // A beam in the address opens as that beam.
    open: (found) => {
      dispatch({ type: 'load', form: found });
      // A place pointed at on the beam before is not a place on this one.
      setProbeX(null);
      setTypedX(null);
    },
    // A press inside the length field being typed in is part of typing in it.
    typing: (press) => editingL.current !== null && press.target instanceof Node && Boolean(document.activeElement?.contains(press.target)),
  });
  const { linkError } = address;
  // The printed sheet gives the address that opens this very beam, and while
  // it prints the drawings are the sheet's size (../shell/sheet.tsx).
  const { stamp, onPaper } = useSheet({ locale: t.sheet.locale, url: () => address.link(encodeContinuous(form)) });
  const plotHeight = onPaper ? PAPER_PLOT : windowPlotHeight;
  const width = onPaper ? PAPER_WIDTH : windowWidth;

  // The shape table, the first time it is wanted, and the shape in use — as
  // the table spells it, which the form then holds too (../shell/steel.ts).
  const wantsShapes = form.section.mode === 'shape';
  const respell = useCallback((designation: string) => dispatch({ type: 'section', patch: { shape: designation } }), []);
  const steel = useSteelShapes({ wanted: wantsShapes, name: form.section.shape, onName: respell });
  const { shapes, shape } = steel;

  // Everything the page prints (lib/calc/continuous/analysis.ts).
  const a = useMemo(() => analyseContinuous(form, shape), [form, shape]);
  const r = a.results;
  // The same beam as the first calculator's drawing takes one, and what is written by its loads.
  const drawing = useMemo(() => drawingOf(form), [form]);
  const beam = drawing.beam;
  // Which joints have a support, and where each joint is.
  const held = useMemo(() => jointPositions(form).map((_, j) => (j === 0 ? form.left : j === form.spans.length ? form.right : 'pin') !== 'free'), [form]);
  const at = useMemo(() => jointPositions(form), [form]);

  // Every number this page prints, with the page's own mark between thousands.
  const num = (v: number, sig = 4) => formatNumber(v, sig, t.numbers.group);
  const where = (x: number) => `${t.results.at} x = ${num(x)} ${u.length}`;
  // What is missing for a result, in the fields the chosen kind of section
  // has. With the shape table on its way, or lost, that is what is missing.
  const awaited = wantsShapes && !shapes ? (steel.failed ? t.section.loadFailed : t.section.loading) : null;
  const need = (what: 'deflection' | 'bending' | 'shear') => awaited ?? t.results.need[form.section.mode][what];

  /* ── The faults, by row ─────────────────────────────────────────────── */
  const says = (issue: AnalysisIssue): string => {
    if (issue.code === 'number' || issue.code === 'section') return t.issues[issue.code];
    if (issue.code === 'stiffness') return c.issues.stiffness.replace('{min}', num(1 / STIFF)).replace('{max}', num(STIFF));
    // A settlement waits for E and I, and a steel shape's are in a table that may still be on its way.
    if (issue.code === 'settlement' && awaited) return awaited;
    return c.issues[issue.code];
  };
  const same = (p: ContinuousRow, q: ContinuousRow) => p.list === q.list && (p.list === 'settlements' ? q.list === 'settlements' && p.joint === q.joint : q.list !== 'settlements' && p.id === q.id);
  const issuesOf = (row: ContinuousRow) => a.issues.filter((i) => i.row && same(i.row, row));
  const idOf = (row: ContinuousRow) => `${uid}${row.list}${row.list === 'settlements' ? row.joint : row.id}`;
  // A field of a row at fault: marked, and tied to the row's message. Of a
  // span, the field the fault is about; of a load, its place when it is off
  // its span, and every number of the row when one of them is not one.
  const fault = (row: ContinuousRow, field?: 'L' | 'k' | 'dead' | 'live' | 'size') => {
    const mine = issuesOf(row).filter((i) => (field === undefined ? true : field === 'size' ? i.code !== 'outside' : i.row?.list === 'spans' && i.row.field === field));
    return mine.length ? { invalid: true, describedBy: idOf(row) } : {};
  };
  // A row's own message. Not a live region: the results box announces every
  // problem, once; this one is read with the field it is tied to.
  const rowIssue = (row: ContinuousRow) => {
    const texts = [...new Set(issuesOf(row).map(says))];
    return texts.length ? (
      <p className="mp-app__row-error" id={idOf(row)}>
        {texts.join(' ')}
      </p>
    ) : null;
  };
  // What the results box says, each thing once: the problems that are no
  // row's, then those of the rows, then a shape the table does not have.
  const unknownText = steel.unknown ? t.section.unknownShape.replace('{shape}', form.section.shape) : '';
  const notices = [
    ...a.issues.filter((i) => !i.row).map((i) => ({ id: `${uid}${i.code}`, text: says(i) })),
    ...a.issues.filter((i) => i.row).map((i) => ({ id: undefined, text: says(i) })),
    ...(steel.unknown ? [{ id: undefined, text: unknownText }] : []),
  ].filter((n, i, all) => all.findIndex((m) => m.text === n.text) === i);
  const sectionFault = a.issues.some((i) => i.code === 'section');

  /* ── The rows of the form ───────────────────────────────────────────── */
  const patch = (list: 'spans' | LoadList, id: number, p: Record<string, unknown>) => dispatch({ type: 'patch', list, id, patch: p });
  const spanName = (i: number) => `${t.results.span} ${i + 1}`;
  const loadName = (list: LoadList, i: number) => `${t.row.names[list]} ${i + 1}`;
  const removeButton = (list: 'spans' | LoadList, id: number, what: string, fixed = false) => (
    <button type="button" className="mp-app__remove" onClick={() => dispatch({ type: 'remove', list, id })} disabled={fixed} aria-label={`${t.row.remove}: ${what}`} title={t.row.remove}>
      <span aria-hidden="true">×</span>
    </button>
  );
  const addButton = (list: 'spans' | LoadList, label: string, full: boolean, limit: string) => (
    <button type="button" className="mp-app__add" onClick={() => dispatch({ type: 'add', list })} disabled={full} title={full ? limit : undefined}>
      <span aria-hidden="true">+</span> {label}
    </button>
  );
  // The fields every load has: the span it is on, by its number, and whether it is dead or live.
  const whichSpan = (list: LoadList, id: number, span: number) =>
    select(t.results.span, String(span), form.spans.map((_, i) => [String(i), String(i + 1)] as [string, string]), (v) => patch(list, id, { span: Number(v) }), 'mp-cont__which');
  const whichKind = (list: LoadList, id: number, live: boolean) =>
    select<'dead' | 'live'>(t.supports.kind, live ? 'live' : 'dead', [['dead', c.loads.kinds.dead], ['live', c.loads.kinds.live]], (v) => patch(list, id, { live: v === 'live' }), 'mp-cont__which');
  const whichWay = (list: LoadList, id: number, dir: Direction) => select<Direction>(t.loads.direction, dir, [['down', t.loads.down], ['up', t.loads.up]], (v) => patch(list, id, { dir: v }), 'mp-num--dir');

  /* ── Which spans are loaded, in words and drawn ─────────────────────── */
  const listed = (numbers: string[]) => (numbers.length < 2 ? numbers.join('') : `${numbers.slice(0, -1).join(', ')}${c.results.pattern.and}${numbers[numbers.length - 1]}`);
  const loaded = (on: number[]) => (on.length === 0 ? c.results.pattern.none : (on.length === 1 ? c.results.pattern.one : c.results.pattern.many).replace('{spans}', listed(on.map((i) => String(i + 1)))));
  // Beside a value of a table: the miniature alone, which says its sentence to a screen reader.
  const pattern = (v: Value, show = true) => (show && v.on ? <LivePattern on={v.on} held={held} said={loaded(v.on)} /> : null);
  // In the card of largest values: the miniature and the sentence.
  const patternLine = (v: Value) =>
    v.on ? (
      <span className="mp-cont__loaded">
        <LivePattern on={v.on} held={held} /> {loaded(v.on)}
      </span>
    ) : null;
  // The key under a card whose values name their arrangement.
  const patternKey = () => {
    const [before, rest] = c.results.key.split('{on}');
    const [between, after] = (rest ?? '').split('{off}');
    return (
      <p className="mp-app__note mp-cont__key">
        {before}
        <LivePattern on={[0]} held={[true, true]} />
        {between}
        <LivePattern on={[]} held={[true, true]} />
        {after}
      </p>
    );
  };

  /* ── Where the values are read ──────────────────────────────────────── */
  // Under the pointer, else where typed, else the middle of the beam — and
  // always ON the beam, which may have got shorter since.
  const asked = probeX ?? typedX;
  const x0 = r ? (asked === null ? round4(r.L / 2) : Math.min(r.L, Math.max(0, asked))) : null;
  const here = useMemo(() => (r && x0 !== null ? r.at(x0) : null), [r, x0]);
  const ranged = Boolean(r?.ranged);
  // A value over every arrangement: one number when its two ends print as one.
  const fromTo = (range: Range, sig = 4) => (num(range.min, sig) === num(range.max, sig) ? num(range.max, sig) : c.results.range.replace('{min}', num(range.min, sig)).replace('{max}', num(range.max, sig)));
  const jump = (l: Range, rt: Range) => two(l.max, rt.max) || two(l.min, rt.min);

  /* ── The drawings in words ──────────────────────────────────────────── */
  // A largest value that is zero is said as zero, at no place; a diagram
  // that is zero all along, in one word.
  const spoken = (title: string, unit: string, [hi, lo]: [Value, Value]) => {
    const one = (p: Value) => `${num(p.value)} ${unit}${p.x === null ? '' : ` ${where(p.x)}`}`;
    return hi.x === null && lo.x === null ? `${title}: ${t.plot.zero}.` : `${title}: ${t.plot.max} ${one(hi)}; ${t.plot.min} ${one(lo)}.`;
  };
  const summary = {
    beam: `${t.results.schematic}: ${num(beam.L)} ${u.length}; ${beam.supports.map((s) => `${t.supports.kinds[s.kind]} ${num(s.x)}`).join(', ')}.`,
    V: r ? spoken(t.results.shear, u.force, r.largest.peaks.V) : '',
    M: r ? spoken(t.results.moment, u.moment, r.largest.peaks.M) : '',
    D: r?.largest.peaks.D ? spoken(t.results.deflection, u.deflection, r.largest.peaks.D) : '',
  };
  // By a load of the drawing: the two uniform loads of a span as they were
  // typed, dead then live (the drawing's title says which is which); and
  // after the value of a further load that is live, the word.
  const loadLabel = ({ kind, id, text }: { kind: 'point' | 'dist'; id: number; text: string }) => {
    const both = kind === 'dist' ? drawing.uniform.find((b) => b.id === id) : undefined;
    if (both) return `${num(both.dead, 6)} + ${num(both.live, 6)} ${u.line}`;
    return drawing.live[kind === 'point' ? 'points' : 'dists'].includes(id) ? `${text}, ${c.results.live}` : text;
  };
  // One diagram: a line, or — over every arrangement — a band between its two edges.
  const plot = (title: string, unit: string, d: Diagram, text: string, read: Range | null) =>
    r ? (
      <BeamPlot
        title={title}
        unit={unit}
        points={d.upper}
        band={d.lower ? { points: d.lower, probe: probeX !== null && read ? read.min : null } : undefined}
        marks={d.marks}
        breaks={r.breaks}
        L={r.L}
        width={width}
        height={plotHeight}
        probe={probeX !== null && read && x0 !== null ? { x: x0, y: read.max } : null}
        onProbe={setProbeX}
        summary={text}
        group={t.numbers.group}
      />
    ) : null;

  // A reaction and a moment of the "Supports" card: the value and, where it is one of a pair that differ, the miniature of its arrangement.
  const reaction = (v: Value, named: boolean) => (
    <>
      {num(Math.abs(v.value))} <span className="mp-app__dir">{v.value === 0 ? '' : arrow(v.value, t.results.upward, t.results.downward)}</span> {pattern(v, named)}
    </>
  );
  const moment = (v: Value, named: boolean) => (
    <>
      {num(v.value)} {pattern(v, named)}
    </>
  );
  // The two ends of a pair, in the two cells they have over every arrangement; the one value, in a single case.
  const cells = (both: Both, head: string, unit: string, print: (v: Value, named: boolean) => React.ReactNode) =>
    ranged ? (
      <>
        <td role="cell" data-label={`${head}, ${t.plot.max} (${unit})`}>
          {print(both.max, !both.one)}
        </td>
        <td role="cell" data-label={`${head}, ${t.plot.min} (${unit})`}>
          {print(both.min, !both.one)}
        </td>
      </>
    ) : (
      <td role="cell" data-label={`${head} (${unit})`}>
        {print(both.max, false)}
      </td>
    );
  const heads = (head: string, unit: string) =>
    ranged ? (
      <>
        <th scope="col" role="columnheader">
          {head}, {t.plot.max} ({unit})
        </th>
        <th scope="col" role="columnheader">
          {head}, {t.plot.min} ({unit})
        </th>
      </>
    ) : (
      <th scope="col" role="columnheader">
        {head} ({unit})
      </th>
    );

  // The line to the first calculator: given the beam that leaving a length
  // field makes, at the moment it is used — when that calculator can hold it.
  const general = generalPath ? generalCode(form) : null;
  const aim = (e: { currentTarget: HTMLAnchorElement }) => {
    const there = generalCode(leaving());
    if (there) e.currentTarget.href = `${generalPath}#b=${there}`;
  };

  return (
    <div className="mp-app mp-cont">
      <div className="mp-app__top">
        {/* ── the form ───────────────────────────────────────────────── */}
        <form className="mp-app__form" onSubmit={(e) => e.preventDefault()} noValidate>
          <div className="mp-app__bar">
            <fieldset className="mp-seg">
              <legend className="mp-num__label">{t.toolbar.units}</legend>
              {(['us', 'si'] as const).map((unit) => (
                <label key={unit} className="mp-seg__item">
                  <input
                    type="radio"
                    name="beam-units"
                    checked={form.units === unit}
                    onChange={() => {
                      dispatch({ type: 'units', units: unit });
                      // A position typed in feet is not that many metres.
                      setTypedX(null);
                      setProbeX(null);
                    }}
                  />
                  <span>{t.toolbar[unit]}</span>
                </label>
              ))}
            </fieldset>
          </div>

          <fieldset className="mp-app__group">
            <legend>{c.spans.title}</legend>
            {form.spans.map((s, i) => {
              const row: ContinuousRow = { list: 'spans', id: s.id };
              return (
                <div key={s.id} className="mp-app__item" role="group" aria-label={spanName(i)} data-invalid={issuesOf(row).length ? 'true' : undefined}>
                  {/* Which span this is, for the eye: the loads and the results name a span by this number. */}
                  <p className="mp-cont__name" aria-hidden="true">
                    {spanName(i)}
                  </p>
                  <div className="mp-app__row mp-app__row--rm">
                    <div className="mp-app__fields mp-cont__span">
                      <NumField
                        numbers={t.numbers}
                        label={t.beam.length}
                        unit={u.length}
                        value={s.L}
                        onChange={(L) => patch('spans', s.id, { L })}
                        {...fault(row, 'L')}
                        onEdit={() => {
                          editingL.current = s.id;
                        }}
                        onCommit={() => {
                          editingL.current = null;
                          // The edit is final: what sat on the span's end is carried, and
                          // the address is written now — whatever reads it next must find
                          // this beam, not wait 300 ms for it.
                          if (!(s.L > 0) || !Number.isFinite(s.L)) return address.write(encodeContinuous(form));
                          const carry = { type: 'carry-end', id: s.id, from: settledL.current.get(s.id) ?? 0, to: s.L } as const;
                          dispatch(carry);
                          settledL.current.set(s.id, s.L);
                          address.write(encodeContinuous(reduceContinuous(form, carry)));
                        }}
                      />
                      <NumField numbers={t.numbers} label={c.spans.stiffness} value={s.k} onChange={(k) => patch('spans', s.id, { k })} {...fault(row, 'k')} />
                      <NumField numbers={t.numbers} label={c.spans.dead} unit={u.line} value={s.dead} onChange={(dead) => patch('spans', s.id, { dead })} {...fault(row, 'dead')} />
                      <NumField numbers={t.numbers} label={c.spans.live} unit={u.line} value={s.live} onChange={(live) => patch('spans', s.id, { live })} {...fault(row, 'live')} />
                    </div>
                    {/* A beam has a span: the last one stays. */}
                    {removeButton('spans', s.id, spanName(i), form.spans.length < 2)}
                  </div>
                  {rowIssue(row)}
                </div>
              );
            })}
            {addButton('spans', c.spans.add, form.spans.length >= MAX_SPANS, c.spans.limit)}
            <p className="mp-app__note">{c.spans.note}</p>
          </fieldset>

          <fieldset className="mp-app__group">
            <legend>{c.ends.title}</legend>
            <div className="mp-app__row mp-app__row--two">
              {(['left', 'right'] as const).map((side) => (
                <React.Fragment key={side}>
                  {select<EndKind>(c.ends[side], form[side], [['pin', c.ends.kinds.pin], ['fixed', c.ends.kinds.fixed], ['free', c.ends.kinds.free]], (kind) => dispatch({ type: 'end', side, kind }))}
                </React.Fragment>
              ))}
            </div>
            <p className="mp-app__note">{c.ends.note}</p>
            {/* The first calculator, opened on this beam, for what this one has not:
                a plain link, and so a page load — that calculator reads its beam
                from the address as it starts. Only while it can hold this beam
                (model.ts, `generalCode`). Not on the printed sheet (calc.css). */}
            {generalPath && general ? (
              <p className="mp-app__elsewhere">
                {c.general}{' '}
                <a className="mp-link" href={`${generalPath}#b=${general}`} onPointerDown={aim} onClick={aim}>
                  {c.generalLink}
                  <i aria-hidden="true">→</i>
                </a>
              </p>
            ) : null}
          </fieldset>

          <fieldset className="mp-app__group">
            <legend>{t.supports.title}</legend>
            <p className="mp-app__note">{c.settlements.note}</p>
            {/* One field to a support, named by its number and its place along the
                beam, which is worked out from the spans. A free end has no support. */}
            <div className="mp-app__row mp-cont__settle" role="group" aria-label={c.settlements.name}>
              {held.flatMap((is, joint) => (is ? [joint] : [])).map((joint, i) => (
                <NumField
                  key={joint}
                  numbers={t.numbers}
                  label={`${t.results.support} ${i + 1} · x = ${num(at[joint])} ${u.length}`}
                  unit={u.deflection}
                  value={form.settlements[joint] ?? 0}
                  emptyIs={0}
                  onChange={(value) => dispatch({ type: 'settlement', joint, value })}
                  // Named for the printed sheet, which writes 0 where the screen has an empty field (calc.css).
                  className={form.settlements[joint] ? '' : 'mp-cont__unset'}
                  {...fault({ list: 'settlements', joint })}
                />
              ))}
            </div>
            {held.map((is, joint) => (is ? <React.Fragment key={joint}>{rowIssue({ list: 'settlements', joint })}</React.Fragment> : null))}
          </fieldset>

          <fieldset className="mp-app__group">
            <legend>{t.loads.point}</legend>
            {form.points.length === 0 ? <p className="mp-app__none">{t.loads.none}</p> : null}
            {form.points.map((p, i) => {
              const row: ContinuousRow = { list: 'points', id: p.id };
              return (
                <div key={p.id} className="mp-app__item" role="group" aria-label={loadName('points', i)} data-invalid={issuesOf(row).length ? 'true' : undefined}>
                  <div className="mp-app__row mp-app__row--rm">
                    <div className="mp-app__fields">
                      {whichSpan('points', p.id, p.span)}
                      <NumField numbers={t.numbers} label={t.loads.load} unit={u.force} value={p.P} onChange={(P) => patch('points', p.id, { P })} {...fault(row, 'size')} />
                      {whichWay('points', p.id, p.dir)}
                      <NumField numbers={t.numbers} label={t.loads.at} unit={u.length} value={p.a} onChange={(at) => patch('points', p.id, { a: at })} {...fault(row)} />
                      {whichKind('points', p.id, p.live)}
                    </div>
                    {removeButton('points', p.id, loadName('points', i))}
                  </div>
                  {rowIssue(row)}
                </div>
              );
            })}
            {addButton('points', t.loads.addPoint, form.points.length >= MAX_ROWS, t.row.limit)}
            {form.points.length ? <p className="mp-app__note">{c.loads.note}</p> : null}
          </fieldset>

          <fieldset className="mp-app__group">
            <legend>{t.loads.dist}</legend>
            {form.dists.length === 0 ? <p className="mp-app__none">{t.loads.none}</p> : null}
            {form.dists.map((d, i) => {
              const row: ContinuousRow = { list: 'dists', id: d.id };
              return (
                <div key={d.id} className="mp-app__item" role="group" aria-label={loadName('dists', i)} data-invalid={issuesOf(row).length ? 'true' : undefined}>
                  <div className="mp-app__row mp-app__row--rm">
                    <div className="mp-app__fields">
                      {whichSpan('dists', d.id, d.span)}
                      <NumField numbers={t.numbers} label={t.loads.start} unit={u.line} value={d.w1} onChange={(w1) => patch('dists', d.id, { w1 })} className="mp-num--wide" {...fault(row, 'size')} />
                      <NumField numbers={t.numbers} label={t.loads.end} unit={u.line} value={d.w2} onChange={(w2) => patch('dists', d.id, { w2 })} className="mp-num--wide" {...fault(row, 'size')} />
                      {whichWay('dists', d.id, d.dir)}
                      <NumField numbers={t.numbers} label={t.loads.from} unit={u.length} value={d.a1} onChange={(a1) => patch('dists', d.id, { a1 })} {...fault(row)} />
                      <NumField numbers={t.numbers} label={t.loads.to} unit={u.length} value={d.a2} onChange={(a2) => patch('dists', d.id, { a2 })} {...fault(row)} />
                      {whichKind('dists', d.id, d.live)}
                    </div>
                    {removeButton('dists', d.id, loadName('dists', i))}
                  </div>
                  {rowIssue(row)}
                </div>
              );
            })}
            {addButton('dists', t.loads.addDist, form.dists.length >= MAX_ROWS, t.row.limit)}
            {form.dists.length ? <p className="mp-app__note">{c.loads.note}</p> : null}
          </fieldset>

          <fieldset className="mp-app__group">
            <legend>{c.live.title}</legend>
            <fieldset className="mp-seg">
              <legend className="mp-num__label">{c.live.taken}</legend>
              {[false, true].map((every) => (
                <label key={String(every)} className="mp-seg__item">
                  <input type="radio" name="beam-live" checked={form.everyArrangement === every} onChange={() => dispatch({ type: 'arrangements', every })} />
                  <span>{every ? c.live.every : c.live.all}</span>
                </label>
              ))}
            </fieldset>
            <p className="mp-app__note">{form.everyArrangement ? c.live.everyNote : c.live.allNote}</p>
            {/* How many arrangements that is: two for each span that carries a live load. */}
            {form.everyArrangement ? (
              <p className="mp-app__note">{a.liveSpans.length ? c.live.count.replace('{spans}', num(a.liveSpans.length)).replace('{count}', num(2 ** a.liveSpans.length)) : c.live.none}</p>
            ) : null}
          </fieldset>

          <SectionGroup
            t={{ ...t.section, intro: c.section.intro }}
            numbers={t.numbers}
            units={form.units}
            section={form.section}
            worked={a.section}
            steel={steel}
            uid={uid}
            describedBy={sectionFault ? `${uid}section` : undefined}
            unknownText={unknownText}
            onSection={(change) => dispatch({ type: 'section', patch: change })}
            onMaterial={(material) => dispatch({ type: 'material', material })}
            flush={address.flush}
          />

          <Actions
            t={t.toolbar}
            copy={() => {
              // The address is brought to this beam too, and a link that could not
              // be read has nothing left to say: the one copied is the beam on screen.
              address.take(encodeContinuous(form));
              return address.link(encodeContinuous(form));
            }}
            reset={() => {
              dispatch({ type: 'load', form: defaultContinuous() });
              steel.setFilter('');
              setTypedX(null);
              setProbeX(null);
              // The address goes bare — if what is after the # is a beam.
              address.take(EXAMPLE);
            }}
          />
        </form>

        {/* ── the answer ─────────────────────────────────────────────── */}
        <section className={tooTall ? 'mp-app__out mp-app__out--tall' : 'mp-app__out'} aria-label={t.results.title} ref={outRef}>
          <div className="mp-app__issues" role="alert" aria-live="assertive">
            {notices.length ? (
              <>
                {/* With the beam solved, what is wrong is a value of the section. */}
                <p className="mp-app__issues-title">{r ? t.issuesSection : t.issuesTitle}</p>
                <ul>
                  {notices.map((n) => (
                    <li key={n.text} id={n.id}>
                      {n.text}
                    </li>
                  ))}
                </ul>
              </>
            ) : linkError ? (
              <p className="mp-app__issues-title">{t.linkError}</p>
            ) : null}
          </div>

          <div className="mp-app__plots" ref={plotRef}>
            <p className="mp-plot__title mp-plot__title--first">
              {t.results.schematic}
              {/* What the two numbers by a block of uniform load are. */}
              {drawing.uniform.length ? <span className="mp-plot__unit"> · {c.results.uniform}</span> : null}
              {/* The band of small arrows along the whole beam, when the shape's weight is one of the loads. */}
              {a.section.selfWeight > 0 ? (
                <span className="mp-plot__unit">
                  {' '}
                  · {t.results.ownWeight} {num(a.section.selfWeight, 6)} {u.line}
                </span>
              ) : null}
            </p>
            {/* Over every arrangement a reaction is a range, and an arrow has one length: none is drawn. */}
            <BeamSchematic form={beam} reactions={r?.reactions ?? null} ownWeight={a.section.selfWeight} width={width} probeX={probeX !== null ? x0 : null} summary={summary.beam} group={t.numbers.group} label={loadLabel} />
            {r ? (
              <>
                {plot(t.results.shear, u.force, r.diagrams.V, summary.V, here ? here.V.right : null)}
                {plot(t.results.moment, u.moment, r.diagrams.M, summary.M, here ? here.M.right : null)}
                {r.diagrams.D ? plot(t.results.deflection, u.deflection, r.diagrams.D, summary.D, here ? here.deflection : null) : <p className="mp-app__need">{need('deflection')}</p>}
                <p className="mp-app__note">
                  {t.results.signs}
                  {ranged ? ` ${c.results.band}` : ''}
                </p>
              </>
            ) : (
              <p className="mp-app__need">{t.results.waiting}</p>
            )}
          </div>
        </section>
      </div>

      {/* ── the numbers ──────────────────────────────────────────────── */}
      {r && here && x0 !== null ? (
        <div className="mp-app__tables">
          <div className="mp-app__card mp-app__card--wide">
            <h3 className="mp-app__h">{t.supports.title}</h3>
            {/* Each cell says what it is: on a phone a row is laid out as lines of
                its own (calc.css), and a browser that reads a table's meaning from
                its layout would lose it there. */}
            <table className="mp-app__table mp-cont__table" role="table">
              <thead role="rowgroup">
                <tr role="row">
                  <th scope="col" role="columnheader">
                    {t.results.support}
                  </th>
                  <th scope="col" role="columnheader">
                    {t.results.position} ({u.length})
                  </th>
                  {heads(c.results.reaction, u.force)}
                  {heads(c.results.momentOver, u.moment)}
                </tr>
              </thead>
              <tbody role="rowgroup">
                {r.supports.map((s) => (
                  <tr key={s.joint} role="row">
                    <th scope="row" role="rowheader" data-label={t.results.support}>
                      {s.number}
                      {s.kind === 'fixed' ? <span className="mp-app__dir"> {c.ends.kinds.fixed}</span> : null}
                    </th>
                    <td role="cell" data-label={`${t.results.position} (${u.length})`}>
                      {num(s.x)}
                    </td>
                    {cells(s.Rv, c.results.reaction, u.force, reaction)}
                    {cells(s.M, c.results.momentOver, u.moment, moment)}
                  </tr>
                ))}
              </tbody>
            </table>
            {r.balance ? (
              r.balance.ok ? (
                <p className="mp-app__note">
                  {/* The load is what was typed, added up: one figure on both sides, never "9.875 = 10". */}
                  {t.results.equilibrium} {num(r.balance.load)} = {num(r.balance.load)} {u.force}.
                </p>
              ) : (
                <p className="mp-app__row-error">{t.results.unbalanced.replace('{sum}', num(r.balance.reactions)).replace('{load}', num(r.balance.load)).replace(/\{unit\}/g, u.force)}</p>
              )
            ) : (
              patternKey()
            )}
          </div>

          <div className="mp-app__card mp-app__card--wide">
            <h3 className="mp-app__h">{c.results.bySpan}</h3>
            <table className="mp-app__table mp-cont__table" role="table">
              <thead role="rowgroup">
                <tr role="row">
                  <th scope="col" role="columnheader">
                    {t.results.span} ({u.length})
                  </th>
                  <th scope="col" role="columnheader">
                    {c.results.sagging} ({u.moment})
                  </th>
                  {a.toDeflection ? (
                    <>
                      <th scope="col" role="columnheader">
                        {c.results.fromSupports} ({u.deflection})
                      </th>
                      <th scope="col" role="columnheader">
                        {t.results.ratio}
                      </th>
                    </>
                  ) : null}
                </tr>
              </thead>
              <tbody role="rowgroup">
                {r.spans.map((s) => (
                  <tr key={s.index} role="row">
                    <th scope="row" role="rowheader" data-label={`${t.results.span} (${u.length})`}>
                      {s.index + 1}{' '}
                      <span className="mp-app__dir">
                        {s.kind === 'cantilever' ? `${t.results.cantilever}, ` : ''}
                        {num(s.from)} – {num(s.to)}
                      </span>
                    </th>
                    <td role="cell" data-label={`${c.results.sagging} (${u.moment})`}>
                      {s.sagging.x !== null ? (
                        <>
                          {num(s.sagging.value)} <span className="mp-app__dir mp-cont__where">{where(s.sagging.x)}</span> {pattern(s.sagging)}
                        </>
                      ) : (
                        t.results.none
                      )}
                    </td>
                    {s.deflection ? (
                      <>
                        <td role="cell" data-label={`${c.results.fromSupports} (${u.deflection})`}>
                          {num(Math.abs(s.deflection.value))}{' '}
                          {s.deflection.x === null ? null : (
                            <>
                              <span className="mp-app__dir">{arrow(s.deflection.value, t.results.upward, t.results.downward)},</span> <span className="mp-app__dir mp-cont__where">{where(s.deflection.x)}</span>
                            </>
                          )}{' '}
                          {pattern(s.deflection, s.deflection.x !== null)}
                        </td>
                        <td role="cell" data-label={t.results.ratio}>
                          {s.ratio === null ? '—' : s.ratio > 99999 ? `> ${num(99999, 6)}` : `L/${num(Math.round(s.ratio), 6)}`}
                        </td>
                      </>
                    ) : null}
                  </tr>
                ))}
              </tbody>
            </table>
            {a.toDeflection && r.spans.some((s) => s.kind === 'cantilever') ? <p className="mp-app__note">{t.results.ratioNote}</p> : null}
            {ranged ? patternKey() : null}
          </div>

          <div className="mp-app__card">
            <h3 className="mp-app__h">{t.results.maxima}</h3>
            <dl className="mp-app__dl">
              <div>
                <dt>{t.results.maxShear}</dt>
                <dd>
                  {num(Math.abs(r.largest.shear.value))} {u.force} <span className="mp-app__dir">{r.largest.shear.x === null ? '' : where(r.largest.shear.x)}</span>
                  {r.largest.shear.x === null ? null : patternLine(r.largest.shear)}
                </dd>
              </div>
              <div>
                <dt>{t.results.maxSagging}</dt>
                <dd>
                  {r.largest.sagging.x !== null ? (
                    <>
                      {num(r.largest.sagging.value)} {u.moment} <span className="mp-app__dir">{where(r.largest.sagging.x)}</span>
                      {patternLine(r.largest.sagging)}
                    </>
                  ) : (
                    t.results.none
                  )}
                </dd>
              </div>
              <div>
                <dt>{t.results.maxHogging}</dt>
                <dd>
                  {r.largest.hogging.x !== null ? (
                    <>
                      {num(Math.abs(r.largest.hogging.value))} {u.moment} <span className="mp-app__dir">{where(r.largest.hogging.x)}</span>
                      {patternLine(r.largest.hogging)}
                    </>
                  ) : (
                    t.results.none
                  )}
                </dd>
              </div>
              <div>
                <dt>{t.results.maxDeflection}</dt>
                <dd>
                  {r.largest.deflection ? (
                    <>
                      {num(Math.abs(r.largest.deflection.value))} {u.deflection}{' '}
                      <span className="mp-app__dir">{r.largest.deflection.x === null ? '' : `${arrow(r.largest.deflection.value, t.results.upward, t.results.downward)}, ${where(r.largest.deflection.x)}`}</span>
                      {r.largest.deflection.x === null ? null : patternLine(r.largest.deflection)}
                    </>
                  ) : (
                    <span className="mp-app__dir">{need('deflection')}</span>
                  )}
                </dd>
              </div>
              {/* The two stresses are the section's: where a span is another section, neither is given, and the note says why. */}
              {a.sameSection ? (
                <>
                  <div>
                    <dt>{t.results.bendingStress}</dt>
                    <dd>{r.largest.sigma !== null ? `${num(r.largest.sigma)} ${u.stress}` : <span className="mp-app__dir">{need('bending')}</span>}</dd>
                  </div>
                  <div>
                    <dt>{t.results.shearStress}</dt>
                    <dd>{r.largest.tau !== null ? `${num(r.largest.tau)} ${u.stress}` : <span className="mp-app__dir">{need('shear')}</span>}</dd>
                  </div>
                </>
              ) : null}
            </dl>
            {!a.sameSection ? (
              <p className="mp-app__note">{c.results.noStress}</p>
            ) : r.largest.sigma !== null || r.largest.tau !== null ? (
              <p className="mp-app__note">
                {r.largest.tau !== null && a.section.shearRule !== 'none' ? `${t.results.shearRule[a.section.shearRule]} ` : ''}
                {t.results.elastic}
              </p>
            ) : null}
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
                  setTypedX(x0);
                  setProbeX(null);
                }}
                onChange={(x) => {
                  setProbeX(null);
                  setTypedX(x);
                }}
              />
            </div>
            <dl className="mp-app__dl">
              <div>
                <dt>{t.results.shear}</dt>
                <dd>
                  {jump(here.V.left, here.V.right) ? (
                    <>
                      {fromTo(here.V.left)} <span className="mp-app__dir">{t.results.left}</span>, {fromTo(here.V.right)} <span className="mp-app__dir">{t.results.right}</span> {u.force}
                    </>
                  ) : (
                    `${fromTo(here.V.right)} ${u.force}`
                  )}
                </dd>
              </div>
              <div>
                <dt>{t.results.moment}</dt>
                <dd>
                  {jump(here.M.left, here.M.right) ? (
                    <>
                      {fromTo(here.M.left)} <span className="mp-app__dir">{t.results.left}</span>, {fromTo(here.M.right)} <span className="mp-app__dir">{t.results.right}</span> {u.moment}
                    </>
                  ) : (
                    `${fromTo(here.M.right)} ${u.moment}`
                  )}
                </dd>
              </div>
              {here.deflection && here.slope ? (
                <>
                  <div>
                    <dt>{t.results.deflection}</dt>
                    <dd>
                      {fromTo(here.deflection)} {u.deflection}
                    </dd>
                  </div>
                  <div>
                    <dt>{t.results.slope}</dt>
                    <dd>{fromTo(here.slope)} rad</dd>
                  </div>
                </>
              ) : null}
              {here.sigma ? (
                <div>
                  <dt>{t.results.bendingStress}</dt>
                  <dd>
                    {fromTo(here.sigma)} {u.stress}
                  </dd>
                </div>
              ) : null}
            </dl>
            <p className="mp-app__note">{t.results.pointHint}</p>
          </div>
        </div>
      ) : null}

      <p className="mp-app__privacy">{t.results.privacy}</p>
      {/* On paper only: when the sheet was printed, and the address that opens this very beam again. */}
      <SheetStamp stamp={stamp} t={t.sheet} />
    </div>
  );
}
