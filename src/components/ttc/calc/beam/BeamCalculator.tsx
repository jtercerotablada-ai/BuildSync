'use client';

import React, { useCallback, useEffect, useId, useMemo, useReducer, useRef, useState } from 'react';
import { agree, formatNumber } from '@/lib/calc/format';
import {
  LAYOUTS,
  MAX_ROWS,
  UNITS,
  analyse,
  bendingStress,
  decodeBeam,
  defaultBeam,
  encodeBeam,
  reduceBeam,
  round4,
  shearStress,
  type BeamForm,
  type RowList,
  type SupportLayout,
} from '@/lib/calc/beam/model';
import type { BeamState, SupportKind } from '@/lib/calc/beam/solver';
import { DEFAULT_LIMIT, SPAN_KEY, adoptBeam, byLoad, convertStress, decodeSpan, defaultSpan, encodeSpan, pinEnds, reduceSpan, sizing, type SpanCase } from '@/lib/calc/beam/span';
import type { SpanUi } from '@/lib/calc/beam/span-strings';
import type { BeamUi } from '@/lib/calc/beam/strings';
import { NumField } from '../NumField';
import { Actions } from '../shell/Actions';
import { useAddress } from '../shell/address';
import { off, select } from '../shell/fields';
import { PAPER_PLOT, PAPER_WIDTH, usePlotHeight, useTooTall, useWidth } from '../shell/layout';
import { arrow, larger, peak, settle, two, type Peak } from '../shell/results';
import { SectionGroup } from '../shell/SectionGroup';
import { SheetStamp, useSheet } from '../shell/sheet';
import { useSteelShapes } from '../shell/steel';
import { BeamPlot, type PlotPoint } from './BeamPlot';
import { BeamSchematic } from './BeamSchematic';

/**
 * BEAM REACTIONS AND DIAGRAMS — the calculator (/resources/beam).
 *
 * The form on the left, the answer on the right, and nothing between them:
 * every keystroke that leaves a number in a field solves the beam again (a
 * millisecond — lib/calc/beam/solver.ts) and redraws the four drawings.
 * There is no "Calculate" button to forget.
 *
 * All the arithmetic is in lib/calc/beam (`model.ts`: units, section,
 * checks, the link, and what each edit does to the form; `solver.ts`: the
 * beam). This file is the form, the tables and the wiring.
 *
 * WHAT IS NOT A BEAM'S IS THE SHELL'S (../shell): the address following the
 * case, the printed sheet's moment, the table of steel shapes, the "Section
 * and material" group, the row of actions, how wide and how tall the
 * drawings are, what a table asks of a value before printing it. One copy
 * for every calculator of the catalogue. What is special to this one — the
 * Length field while it is being typed in, the single-span page reading the
 * first calculator's key — stays here, and is handed to it.
 *
 * NOTHING LEAVES THE BROWSER. No request is made with what is typed; the
 * steel shape table is a static file fetched the first time "Steel shape"
 * is chosen.
 *
 * THE ADDRESS FOLLOWS THE BEAM. Whatever is on screen is in the address
 * after the `#` (`#b=…`, which a browser does not send to a server): a
 * reload, a tab the phone discarded, the language switch and "Copy link"
 * all come back to the same beam. The example beam leaves the address bare,
 * and a bare address is the example beam.
 *
 * ITS WORDS ARE A PROP (`t`), from the server view: importing strings.ts
 * here would put both languages and the page's own text in this script.
 *
 * It renders on the server with the default beam (so the page is not an
 * empty box before the script arrives, or without it), then measures its
 * column and reads the address.
 *
 * TWO PAGES, ONE COMPONENT. "Single-span beam" (/resources/single-span-beam)
 * is this calculator with the `span` prop — the words of what that page
 * adds — and nothing else of its own: a copy of this file would have drifted
 * from it within a month. In that mode (lib/calc/beam/span.ts):
 *   — the supports are a pin at 0 and a roller at L, after every edit and
 *     in every link opened (a link whose beam held more than that is
 *     opened so, and the results box says what was left out); the groups
 *     for supports, hinges and applied moments and the list of layouts are
 *     not rendered, and a line in the Beam group leads to the first
 *     calculator, with the beam on screen, for those;
 *   — two cards are added under the drawings: each load alone ("Load by
 *     load") and the section two limits ask for ("Section needed");
 *   — the address is `#s=…`: those two limits, then the beam.
 * Without the prop, none of it: every difference below is behind `single`.
 */

/** The example beam, as it is written in an address. */
const EXAMPLE = encodeBeam(defaultBeam());
/** …and the single-span page's example: its own beam, the limits it opens with. */
const EXAMPLE_SPAN = encodeSpan(defaultSpan(), DEFAULT_LIMIT, 0);

/**
 * What the fragment of an address opens. `undefined`: it is not a
 * calculator's (`#main` is a place on the page). `null`: it is, and cannot
 * be read. On the first calculator a beam after `#b=`. On the single-span
 * page its own case after `#s=` — and the first calculator's `#b=…` too,
 * which an engineer may bring over by hand: that beam's loads, on the span.
 */
function caseIn(hash: string, single: boolean): SpanCase | null | undefined {
  // The single-span page reads its key even with nothing after it: a link cut that short is a link that cannot be read.
  const m = hash.match(single ? /^#([sb])=(.*)$/ : /^#(b)=(.+)$/);
  if (!m) return undefined;
  let text = m[2];
  try {
    text = decodeURIComponent(text);
  } catch {
    /* not percent-encoded: read as it is */
  }
  if (single) return m[1] === SPAN_KEY ? decodeSpan(text) : adoptBeam(text);
  const beam = decodeBeam(text);
  return beam && { form: beam, limit: DEFAULT_LIMIT, stress: 0 };
}

/**
 * `span`: the words of the single-span page, which is this calculator in
 * that mode; `generalPath`: the first calculator's address in the page's
 * language, for that mode's link to it.
 *
 * `initial`: the beam it opens with, where that is not the example — for the
 * tests, which cannot type. `initialLimits`, the same for the single-span
 * page's two limits.
 */
export function BeamCalculator({
  t,
  span,
  generalPath,
  initial,
  initialLimits,
}: {
  t: BeamUi;
  span?: SpanUi;
  generalPath?: string;
  initial?: BeamForm;
  initialLimits?: { limit: number; stress: number };
}) {
  const single = Boolean(span);
  const reduce = single ? reduceSpan : reduceBeam;
  const [form, dispatch] = useReducer(reduce, initial, (given) => (single ? pinEnds(given ?? defaultSpan()) : given ?? defaultBeam()));
  // The single-span page's two limits: the deflection limit L/`limit`, and
  // the bending stress to size for — zero for none, as an optional value of
  // the section is. Part of the case with the beam: in the address, in a
  // copied link, on the printed sheet; back to the example's with the beam.
  const [limit, setLimit] = useState(initialLimits?.limit ?? DEFAULT_LIMIT);
  const [stress, setStress] = useState(initialLimits?.stress ?? 0);
  // What the address carries after the #: this page's key (given to the
  // shell, below), and the case on screen as that page writes it.
  const example = single ? EXAMPLE_SPAN : EXAMPLE;
  const codeOf = useCallback((beam: BeamForm) => (single ? encodeSpan(beam, limit, stress) : encodeBeam(beam)), [single, limit, stress]);
  const [probeX, setProbeX] = useState<number | null>(null);
  const [typedX, setTypedX] = useState<number | null>(null);
  // On the single-span page, a link whose beam held what this span has not —
  // other supports, hinges, applied moments (span.ts, `lost`): the span shown
  // is not that beam, and the results box says so. A state of its own, not
  // `linkError`: that one is withdrawn as soon as the address is written
  // again, which for a beam brought over is 300 ms after it opens. This one
  // stays through the edits that follow, until another link or Start over.
  const [lost, setLost] = useState(false);
  const [plotRef, windowWidth] = useWidth<HTMLDivElement>();
  const [outRef, tooTall] = useTooTall<HTMLElement>();
  // The last length the visitor settled on, for carrying the end support along.
  const settledL = useRef(form.L);
  const editingL = useRef(false);
  const lengthRow = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!editingL.current && form.L > 0 && Number.isFinite(form.L)) settledL.current = form.L;
  }, [form.L]);
  const windowPlotHeight = usePlotHeight();
  const u = UNITS[form.units];
  // What the ids of this form's messages begin with.
  const uid = useId();

  // THE ADDRESS FOLLOWS THE BEAM: read on load and whenever it changes,
  // written 300 ms after the beam last changed and at once when the visitor
  // reaches for something else (../shell/address.ts). What that is given of
  // this calculator's own:
  //
  // The Length field, most of all. Until it is left, what sat on the right
  // end has not been carried along (`carry-end`): a 20 ft span being made 27
  // has its roller at 20 still. That beam is never written. What is written
  // meanwhile, by the timer or at once if the visitor reaches for something
  // else, is the beam that leaving the field makes of it. (The timer once
  // kept out of the Length field altogether: a page reloaded with the caret
  // still in it came back with the length of before, and no word of it.)
  const leaving = useCallback(
    () => (editingL.current && form.L > 0 && Number.isFinite(form.L) ? reduce(form, { type: 'carry-end', from: settledL.current, to: form.L }) : form),
    [form, reduce],
  );
  // The case as the address is to write it, at the moment it is written. The
  // same function for as long as the beam and the limits are the same: the
  // address waits 300 ms from the last time this changed.
  const code = useCallback(() => codeOf(leaving()), [codeOf, leaving]);
  const address = useAddress<SpanCase>({
    key: single ? SPAN_KEY : 'b',
    example,
    code,
    read: (hash) => caseIn(hash, single),
    blank: () => ({ form: single ? defaultSpan() : defaultBeam(), limit: DEFAULT_LIMIT, stress: 0 }),
    // A beam in the address opens as that beam.
    open: (found) => {
      dispatch({ type: 'load', form: found.form });
      setLimit(found.limit);
      setStress(found.stress);
      setLost(Boolean(found.lost));
      // A place pointed at on the beam before is not a place on this one.
      setProbeX(null);
      setTypedX(null);
    },
    // On the single-span page a beam brought over under the first
    // calculator's key is this page's too: once read, it is written again
    // under the page's own.
    owns: single ? (hash) => /^#[sb]=/.test(hash) : undefined,
    // A press inside the Length field is part of typing in it.
    typing: (press) => Boolean(editingL.current && press.target instanceof Node && lengthRow.current?.contains(press.target)),
  });
  const { linkError } = address;
  // The printed sheet gives the address that opens this very beam, and while
  // it prints the drawings are the sheet's size, not the window's
  // (../shell/sheet.tsx).
  const { stamp, onPaper } = useSheet({ locale: t.sheet.locale, url: () => address.link(codeOf(form)) });
  const plotHeight = onPaper ? PAPER_PLOT : windowPlotHeight;
  const width = onPaper ? PAPER_WIDTH : windowWidth;

  // The shape table, the first time it is wanted, and the shape in use — as
  // the table spells it, which the form then holds too (../shell/steel.ts).
  const wantsShapes = form.section.mode === 'shape';
  const respell = useCallback((designation: string) => dispatch({ type: 'section', patch: { shape: designation } }), []);
  const steel = useSteelShapes({ wanted: wantsShapes, name: form.section.shape, onName: respell });
  const { shapes, shape } = steel;
  // A name the table does not have: no section, and the page says which name.
  const unknownShape = steel.unknown;
  const a = useMemo(() => analyse(form, shape), [form, shape]);
  const sol = a.solution;

  const issueOf = (list: RowList, id: number) => a.issues.find((i) => i.row?.list === list && i.row.id === id);
  const invalid = (list: RowList, id: number) => Boolean(issueOf(list, id));
  // A field of a row at fault: marked, and tied to the row's message.
  const errorId = (list: RowList, id: number) => `${uid}${list}${id}`;
  const fault = (list: RowList, id: number) => (invalid(list, id) ? { invalid: true, describedBy: errorId(list, id) } : {});
  const patch = (list: RowList, id: number, p: Record<string, unknown>) => dispatch({ type: 'patch', list, id, patch: p });
  const full = (list: RowList) => form[list].length >= MAX_ROWS;

  /* ── What counts as zero ────────────────────────────────────────────── */
  // Measured against the size of the PROBLEM (the loads, the length), not
  // of each diagram: a shear that is zero everywhere has nothing of its own
  // to be measured against, and was drawn at full height from rounding.
  //
  // Three floors, each for the rounding of one kind of number.
  //
  // F — a billionth of the loads. For what is added up from what was typed,
  // with no reaction in it: the total load in the line under the reactions
  // and, with the length, the slope and the deflection.
  //
  // V and M — a millionth of the largest REACTION as well, times the length
  // for the moment. Two supports close together carry forces far larger
  // than the load, and the rounding of those is far larger than a billionth
  // of the load: a roller that carries nothing was printed as 5 × 10⁻⁷ kip
  // upward. The shear and the moment are sums of those same reactions, so
  // they share this floor with them. It goes no higher for a close pair:
  // outside the pair the engine has both right to twelve figures, and a
  // floor of a ten-thousandth printed a real moment, a tenth of the beam's
  // largest, as 0.
  //
  // pair — a ten-thousandth of the largest reaction, for the FORCE OF THE
  // TWO SUPPORTS of a pair closer than a hundredth of the length (`paired`
  // holds where they stand), and for nothing else. How a load is shared
  // between those two is the one thing rounding loses there: a wall and a
  // roller that carry nothing came out as 6.5 × 10⁻⁴ kip each, beside
  // reactions of 21.
  //
  // That ten-thousandth removes rounding around zero. It does not make what
  // is above it right: near the engine's limits a reaction that is small
  // beside the largest one can be off in the figures printed, and no floor
  // repairs a number (the header of solver.ts says what was measured).
  const noise = useMemo(() => {
    const F = 1e-9 * a.loadScale;
    const L = sol ? sol.L : 0;
    const largest = Math.max(0, ...(sol ? sol.reactions.map((r) => Math.abs(r.Rv)) : []));
    const V = Math.max(F, 1e-6 * largest);
    const at = sol ? [...new Set(sol.reactions.map((r) => r.x))].sort((p, q) => p - q) : [];
    const paired = new Set(at.flatMap((x, i) => (i > 0 && x - at[i - 1] < 1e-2 * L ? [at[i - 1], x] : [])));
    return { F, V, M: V * L, pair: Math.max(F, 1e-4 * largest), paired, EItheta: F * L * L, EIv: F * L * L * L };
  }, [a.loadScale, sol]);
  // Settled ONCE, here, and everything that prints a reaction or a largest
  // value reads these: the table, the drawing, the stresses and the words
  // for a screen reader then cannot say different things. (The table said
  // "none" where the diagram's summary said 1.364 × 10⁻¹² kip·ft.)
  const reactions = useMemo(
    () => (sol ? sol.reactions.map((r) => ({ ...r, Rv: settle(r.Rv, noise.paired.has(r.x) ? noise.pair : noise.V), Rm: settle(r.Rm, noise.M) })) : null),
    [sol, noise],
  );
  const peaks = useMemo(() => {
    if (!sol) return null;
    const e = sol.extremes;
    return {
      Vmax: peak(e.Vmax, noise.V),
      Vmin: peak(e.Vmin, noise.V),
      Mmax: peak(e.Mmax, noise.M),
      Mmin: peak(e.Mmin, noise.M),
      EIvMax: peak(e.EIvMax, noise.EIv),
      EIvMin: peak(e.EIvMin, noise.EIv),
    };
  }, [sol, noise]);

  /* ── What the diagrams draw ─────────────────────────────────────────── */
  const series = useMemo(() => {
    if (!sol) return null;
    const stations = sol.stations;
    const span = sol.L;
    // A value a billionth of the largest in its diagram is rounding, not a
    // result: it is drawn and printed as zero. (A cantilever used to report
    // a "sagging moment" of 10⁻¹² kip·ft.)
    const of = (f: (s: BeamState) => number, floor: number): PlotPoint[] => stations.map((s) => ({ x: s.x, y: Math.abs(f(s)) > floor ? f(s) : 0 }));
    const e = sol.extremes;
    const distinct = (floor: number, ...m: { value: number; x: number }[]): PlotPoint[] =>
      m.filter((p, i) => Math.abs(p.value) > floor && m.findIndex((q) => Math.abs(q.value - p.value) <= floor && Math.abs(q.x - p.x) < 1e-9 * span) === i).map((p) => ({ x: p.x, y: p.value }));
    const k = a.toDeflection;
    return {
      V: of((s) => s.V, noise.V),
      M: of((s) => s.M, noise.M),
      D: k ? of((s) => s.EIv * k, noise.EIv * Math.abs(k)) : null,
      marksV: distinct(noise.V, e.Vmax, e.Vmin),
      marksM: distinct(noise.M, e.Mmax, e.Mmin),
      marksD: k ? distinct(noise.EIv * Math.abs(k), { value: e.EIvMax.value * k, x: e.EIvMax.x }, { value: e.EIvMin.value * k, x: e.EIvMin.x }) : [],
    };
  }, [sol, a.toDeflection, noise]);

  // Where the values are read: under the pointer, else where typed, else
  // midspan — and always ON the beam, which may have got shorter since.
  const asked = probeX ?? typedX;
  const x0 = sol ? (asked === null ? round4(sol.L / 2) : Math.min(sol.L, Math.max(0, asked))) : null;
  const here = sol && x0 !== null ? { left: sol.at(x0, 'left'), right: sol.at(x0, 'right') } : null;

  // Each held as the memo that made it holds it: two memos below depend on
  // them, and a value a memo depends on must be one that nothing touches
  // again. (The same values as worked out afresh at every draw — one of the
  // two peaks, itself. The lint's rule for memos asks for it, and reads this
  // component since the shape table's `import()` went to the shell: with one
  // in a component, it gave the component up unread.)
  const vMax = useMemo(() => (peaks ? larger(peaks.Vmax, peaks.Vmin) : null), [peaks]);
  const mAbs = useMemo(() => (peaks ? larger(peaks.Mmax, peaks.Mmin) : null), [peaks]);
  const dAbs = useMemo(() => (peaks && a.toDeflection ? larger(peaks.EIvMax, peaks.EIvMin) : null), [peaks, a.toDeflection]);
  const sigma = mAbs ? bendingStress(form.units, a.section, Math.abs(mAbs.value)) : null;
  const tau = vMax ? shearStress(form.units, a.section, Math.abs(vMax.value)) : null;

  /* ── The single-span page's two cards ───────────────────────────────── */
  // "Load by load": each load alone on the span. Its moments are read at the
  // section where the moment of all the loads is largest and its deflections
  // where their deflection is largest — the two places the card above gives
  // — or at midspan, when one of them is zero all along and has no place.
  const mid = sol ? round4(sol.L / 2) : 0;
  const xM = mAbs?.x ?? mid;
  const xD = dAbs?.x ?? mid;
  const shares = useMemo(() => (single && sol ? byLoad(form, shape, xM, xD) : null), [single, sol, form, shape, xM, xD]);
  // "Section needed": from the largest deflection and the largest moment. One
  // that is rounding asks for no section at all — settled as everything else
  // this page prints is, by the place its peak has or has not.
  const limited = limit > 0 && Number.isFinite(limit);
  const needs = useMemo(() => {
    if (!single || !peaks || !mAbs) return null;
    const raw = sizing(a, form, limit, stress);
    return { I: raw.I !== null && larger(peaks.EIvMax, peaks.EIvMin).x === null ? 0 : raw.I, S: raw.S !== null && mAbs.x === null ? 0 : raw.S };
  }, [single, peaks, mAbs, a, form, limit, stress]);

  // Every number this page prints, with the page's own mark between thousands.
  const num = (v: number, sig = 4) => formatNumber(v, sig, t.numbers.group);
  // A value of "Section needed" with its unit. Before a unit that begins
  // with a power of ten the multiplication sign is written, and no-break
  // spaces hold figure, sign and unit on one line: "11 400 10³ mm³" read as
  // one run of digits, and on a phone a line ended between the two.
  const sized = (v: number, unit: string, sig?: number) => (/^10/.test(unit) ? `${num(v, sig)} × ${unit}`.replace(/ /g, '\u00a0') : `${num(v, sig)} ${unit}`);
  const where =(x: number) => `${t.results.at} x = ${num(x)} ${u.length}`;
  // What is missing for a result, in the fields the chosen kind of section
  // has: "enter the section modulus" is no help beside a list of shapes.
  // With the shape table on its way, or lost, that is what is missing.
  const need = (what: 'deflection' | 'bending' | 'shear') => (wantsShapes && !shapes ? (steel.failed ? t.section.loadFailed : t.section.loading) : t.results.need[form.section.mode][what]);

  // The reactions add up to the load, or the page does not say they do: it
  // asks (`agree`, against the largest of the forces added up), and then
  // prints one figure on both sides — never "9.875 = 10".
  const sumR = sol ? sol.reactions.reduce((sum, r) => sum + r.Rv, 0) : 0;
  const balanced = !sol || agree(sumR, sol.totalLoad, Math.max(a.loadScale, ...sol.reactions.map((r) => Math.abs(r.Rv))));

  /* ── The drawings in words ──────────────────────────────────────────── */
  // A largest value that is zero is said as zero, at no place; a diagram
  // that is zero all along, in one word.
  const spoken = (title: string, unit: string, hi: Peak, lo: Peak) => {
    const one = (p: Peak) => `${num(p.value)} ${unit}${p.x === null ? '' : ` ${where(p.x)}`}`;
    return hi.x === null && lo.x === null ? `${title}: ${t.plot.zero}.` : `${title}: ${t.plot.max} ${one(hi)}; ${t.plot.min} ${one(lo)}.`;
  };
  const says = {
    beam: `${t.results.schematic}: ${num(form.L)} ${u.length}; ${form.supports.map((s) => `${t.supports.kinds[s.kind]} ${num(s.x)}`).join(', ')}.`,
    V: peaks ? spoken(t.results.shear, u.force, peaks.Vmax, peaks.Vmin) : '',
    M: peaks ? spoken(t.results.moment, u.moment, peaks.Mmax, peaks.Mmin) : '',
    D: dAbs ? (dAbs.x === null ? `${t.results.deflection}: ${t.plot.zero}.` : `${t.results.deflection}: ${num(dAbs.value * a.toDeflection)} ${u.deflection} ${where(dAbs.x)}.`) : '',
  };

  // The single-span page's link to the first calculator: given the beam that
  // leaving the Length field makes, at the moment it is used.
  const aim = (e: { currentTarget: HTMLAnchorElement }) => {
    e.currentTarget.href = `${generalPath}#b=${encodeBeam(leaving())}`;
  };

  const sec = form.section;
  // What the results box says, each thing once: the problems that are no
  // row's, then those of the rows, then a shape the table does not have.
  const unknownText = unknownShape ? t.section.unknownShape.replace('{shape}', sec.shape) : '';
  const notices = [
    ...a.issues.filter((i) => !i.row).map((i) => ({ id: `${uid}${i.code}`, text: t.issues[i.code] })),
    ...a.issues.filter((i) => i.row).map((i) => ({ id: undefined, text: t.issues[i.code] })),
    ...(unknownShape ? [{ id: undefined, text: unknownText }] : []),
  ].filter((n, i, all) => all.findIndex((m) => m.text === n.text) === i);
  // The id of a problem that is no row's, for the field it is about — when it is on screen.
  const said = (code: 'length' | 'section', on: boolean) => (on && a.issues.some((i) => i.code === code) ? `${uid}${code}` : undefined);
  // A row's own message. Not a live region: the results box announces every
  // problem, once; this one is read with the field it is tied to.
  const rowIssue = (list: RowList, id: number) => {
    const issue = issueOf(list, id);
    return issue ? (
      <p className="mp-app__row-error" id={errorId(list, id)}>
        {t.issues[issue.code]}
      </p>
    ) : null;
  };
  // One row of a list, by name: "Support 2". Two fields called "Position ft"
  // are then told apart by the group each is in.
  const rowName = (list: RowList, i: number) => `${t.row.names[list]} ${i + 1}`;
  const removeButton = (list: RowList, id: number, what: string) => (
    <button type="button" className="mp-app__remove" onClick={() => dispatch({ type: 'remove', list, id })} aria-label={`${t.row.remove}: ${what}`} title={t.row.remove}>
      <span aria-hidden="true">×</span>
    </button>
  );
  const addButton = (list: RowList, label: string) => (
    <button type="button" className="mp-app__add" onClick={() => dispatch({ type: 'add', list })} disabled={full(list)} title={full(list) ? t.row.limit : undefined}>
      <span aria-hidden="true">+</span> {label}
    </button>
  );

  return (
    <div className="mp-app">
      <div className="mp-app__top">
      {/* ── the form ─────────────────────────────────────────────────── */}
      <form className="mp-app__form" onSubmit={(e) => e.preventDefault()} noValidate>
        <div className="mp-app__bar">
          <fieldset className="mp-seg">
            <legend className="mp-num__label">{t.toolbar.units}</legend>
            {(['us', 'si'] as const).map((key) => (
              <label key={key} className="mp-seg__item">
                <input
                  type="radio"
                  name="beam-units"
                  checked={form.units === key}
                  onChange={() => {
                    dispatch({ type: 'units', units: key });
                    // The single-span page's stress limit is in the units' own (ksi, MPa), and goes with them.
                    if (single) setStress((typed) => convertStress(typed, form.units, key));
                    // A position typed in feet is not that many metres.
                    setTypedX(null);
                    setProbeX(null);
                  }}
                />
                <span>{t.toolbar[key]}</span>
              </label>
            ))}
          </fieldset>
          {/* The single-span page has one layout, and no list to choose another from. */}
          {single ? null : (
          <label className="mp-num mp-num--select">
            <span className="mp-num__label">{t.toolbar.layout}</span>
            <span className="mp-num__box">
              <select
                className="mp-num__input"
                value=""
                onChange={(e) => {
                  if (e.target.value) dispatch({ type: 'layout', layout: e.target.value as SupportLayout });
                }}
              >
                <option value="">{t.toolbar.layoutPick}</option>
                {LAYOUTS.map((key) => (
                  <option key={key} value={key}>
                    {t.layouts[key]}
                  </option>
                ))}
              </select>
            </span>
          </label>
          )}
        </div>

        <fieldset className="mp-app__group">
          <legend>{t.beam.title}</legend>
          <div className="mp-app__row mp-app__row--one" ref={lengthRow}>
            <NumField
              numbers={t.numbers}
              label={t.beam.length}
              unit={u.length}
              value={form.L}
              onChange={(L) => dispatch({ type: 'length', L })}
              invalid={a.issues.some((i) => i.code === 'length')}
              describedBy={said('length', true)}
              onEdit={() => {
                editingL.current = true;
              }}
              onCommit={() => {
                editingL.current = false;
                // The edit is final: the end is carried, and the address is
                // written now. Whatever reads it next — the language link, a
                // reload — must find this beam, not wait 300 ms for it.
                if (!(form.L > 0) || !Number.isFinite(form.L)) return address.write(codeOf(form));
                const carry = { type: 'carry-end', from: settledL.current, to: form.L } as const;
                dispatch(carry);
                settledL.current = form.L;
                address.write(codeOf(reduce(form, carry)));
              }}
            />
          </div>
          {span ? <p className="mp-app__note">{span.simple}</p> : null}
          {/* The first calculator, opened on this beam: for the supports, hinges
              and applied moments this page does not have. A plain link, and so a
              page load: that calculator reads its beam from the address as it
              starts. Not on the printed sheet (calc.css): a link is no value. */}
          {span && generalPath ? (
            <p className="mp-app__elsewhere">
              {span.general}{' '}
              {/* With the caret still in the Length field, what sat on the right
                  end has not been carried along yet: the link is given the beam
                  that leaving the field makes, as the address is — when it is
                  pressed (any button: a new tab is opened by the middle one) and
                  when it is followed from the keyboard. */}
              <a className="mp-link" href={`${generalPath}#b=${encodeBeam(form)}`} onPointerDown={aim} onClick={aim}>
                {span.generalLink}
                <i aria-hidden="true">→</i>
              </a>
            </p>
          ) : null}
        </fieldset>

        {/* The supports of the single-span page are not the visitor's to place, and it has no hinges. */}
        {single ? null : (
        <>
        <fieldset className="mp-app__group">
          <legend>{t.supports.title}</legend>
          {form.supports.map((s, i) => (
            <div key={s.id} className="mp-app__item" role="group" aria-label={rowName('supports', i)} data-invalid={invalid('supports', s.id) ? 'true' : undefined}>
              <div className="mp-app__row mp-app__row--rm">
                <div className="mp-app__fields">
                {select<SupportKind>(t.supports.kind, s.kind, [['pin', t.supports.kinds.pin], ['roller', t.supports.kinds.roller], ['fixed', t.supports.kinds.fixed]], (kind) => patch('supports', s.id, { kind }))}
                <NumField numbers={t.numbers} label={t.supports.position} unit={u.length} value={s.x} onChange={(x) => patch('supports', s.id, { x })} {...fault('supports', s.id)} />
                </div>
                {removeButton('supports', s.id, rowName('supports', i))}
              </div>
              {rowIssue('supports', s.id)}
            </div>
          ))}
          {addButton('supports', t.supports.add)}
          <p className="mp-app__note">{t.supports.note}</p>
        </fieldset>

        <fieldset className="mp-app__group">
          <legend>{t.hinges.title}</legend>
          {form.hinges.length === 0 ? <p className="mp-app__none">{t.hinges.none}</p> : null}
          {form.hinges.map((h, i) => (
            <div key={h.id} className="mp-app__item" role="group" aria-label={rowName('hinges', i)} data-invalid={invalid('hinges', h.id) ? 'true' : undefined}>
              <div className="mp-app__row mp-app__row--rm">
                <div className="mp-app__fields">
                <NumField numbers={t.numbers} label={t.hinges.position} unit={u.length} value={h.x} onChange={(x) => patch('hinges', h.id, { x })} {...fault('hinges', h.id)} />
                </div>
                {removeButton('hinges', h.id, rowName('hinges', i))}
              </div>
              {rowIssue('hinges', h.id)}
            </div>
          ))}
          {addButton('hinges', t.hinges.add)}
        </fieldset>
        </>
        )}

        <fieldset className="mp-app__group">
          <legend>{t.loads.point}</legend>
          {form.points.length === 0 ? <p className="mp-app__none">{t.loads.none}</p> : null}
          {form.points.map((p, i) => (
            <div key={p.id} className="mp-app__item" role="group" aria-label={rowName('points', i)} data-invalid={invalid('points', p.id) ? 'true' : undefined}>
              <div className="mp-app__row mp-app__row--rm">
                <div className="mp-app__fields">
                <NumField numbers={t.numbers} label={t.loads.load} unit={u.force} value={p.P} onChange={(P) => patch('points', p.id, { P })} />
                {select(t.loads.direction, p.dir, [['down', t.loads.down], ['up', t.loads.up]], (dir) => patch('points', p.id, { dir }), 'mp-num--dir')}
                <NumField numbers={t.numbers} label={t.loads.at} unit={u.length} value={p.x} onChange={(x) => patch('points', p.id, { x })} {...fault('points', p.id)} />
                </div>
                {removeButton('points', p.id, rowName('points', i))}
              </div>
              {rowIssue('points', p.id)}
            </div>
          ))}
          {addButton('points', t.loads.addPoint)}
        </fieldset>

        <fieldset className="mp-app__group">
          <legend>{t.loads.dist}</legend>
          {form.dists.length === 0 ? <p className="mp-app__none">{t.loads.none}</p> : null}
          {form.dists.map((d, i) => (
            <div key={d.id} className="mp-app__item" role="group" aria-label={rowName('dists', i)} data-invalid={invalid('dists', d.id) ? 'true' : undefined}>
              <div className="mp-app__row mp-app__row--rm">
                <div className="mp-app__fields">
                <NumField numbers={t.numbers} label={t.loads.start} unit={u.line} value={d.w1} onChange={(w1) => patch('dists', d.id, { w1 })} className="mp-num--wide" />
                <NumField numbers={t.numbers} label={t.loads.end} unit={u.line} value={d.w2} onChange={(w2) => patch('dists', d.id, { w2 })} className="mp-num--wide" />
                {select(t.loads.direction, d.dir, [['down', t.loads.down], ['up', t.loads.up]], (dir) => patch('dists', d.id, { dir }), 'mp-num--dir')}
                <NumField numbers={t.numbers} label={t.loads.from} unit={u.length} value={d.x1} onChange={(x1) => patch('dists', d.id, { x1 })} {...fault('dists', d.id)} />
                <NumField numbers={t.numbers} label={t.loads.to} unit={u.length} value={d.x2} onChange={(x2) => patch('dists', d.id, { x2 })} {...fault('dists', d.id)} />
                </div>
                {removeButton('dists', d.id, rowName('dists', i))}
              </div>
              {rowIssue('dists', d.id)}
            </div>
          ))}
          {addButton('dists', t.loads.addDist)}
        </fieldset>

        {/* …nor applied moments. */}
        {single ? null : (
        <fieldset className="mp-app__group">
          <legend>{t.loads.couple}</legend>
          {form.couples.length === 0 ? <p className="mp-app__none">{t.loads.noneCouple}</p> : null}
          {form.couples.map((c, i) => (
            <div key={c.id} className="mp-app__item" role="group" aria-label={rowName('couples', i)} data-invalid={invalid('couples', c.id) ? 'true' : undefined}>
              <div className="mp-app__row mp-app__row--rm">
                <div className="mp-app__fields">
                <NumField numbers={t.numbers} label={t.loads.moment} unit={u.moment} value={c.M} onChange={(M) => patch('couples', c.id, { M })} className="mp-num--wide" />
                {select(t.loads.direction, c.dir, [['cw', t.loads.cw], ['ccw', t.loads.ccw]], (dir) => patch('couples', c.id, { dir }), 'mp-num--dir')}
                <NumField numbers={t.numbers} label={t.loads.at} unit={u.length} value={c.x} onChange={(x) => patch('couples', c.id, { x })} {...fault('couples', c.id)} />
                </div>
                {removeButton('couples', c.id, rowName('couples', i))}
              </div>
              {rowIssue('couples', c.id)}
            </div>
          ))}
          {addButton('couples', t.loads.addCouple)}
        </fieldset>
        )}

        <SectionGroup
          t={t.section}
          numbers={t.numbers}
          units={form.units}
          section={sec}
          worked={a.section}
          steel={steel}
          uid={uid}
          describedBy={said('section', true)}
          unknownText={unknownText}
          onSection={(patch) => dispatch({ type: 'section', patch })}
          onMaterial={(material) => dispatch({ type: 'material', material })}
          flush={address.flush}
        />

        <Actions
          t={t.toolbar}
          copy={() => {
            // The address is brought to this beam too — which for the example beam
            // is the bare address — and a link that could not be read has nothing
            // left to say: the one being copied is the beam on screen.
            address.take(codeOf(form));
            return address.link(codeOf(form));
          }}
          reset={() => {
            dispatch({ type: 'load', form: single ? defaultSpan() : defaultBeam() });
            setLimit(DEFAULT_LIMIT);
            setStress(0);
            setLost(false);
            steel.setFilter('');
            setTypedX(null);
            setProbeX(null);
            // The address goes bare — if what is after the # is a beam.
            address.take(example);
          }}
        />
      </form>

      {/* ── the answer ───────────────────────────────────────────────── */}
      <section className={tooTall ? 'mp-app__out mp-app__out--tall' : 'mp-app__out'} aria-label={t.results.title} ref={outRef}>
        <div className="mp-app__issues" role="alert" aria-live="assertive">
          {span && lost ? <p className="mp-app__issues-title">{span.leftOut}</p> : null}
          {notices.length ? (
            <>
              {/* With the beam solved, what is wrong is a value of the section. */}
              <p className="mp-app__issues-title">{sol ? t.issuesSection : t.issuesTitle}</p>
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
            {/* The band of small arrows along the whole beam, when the shape's weight is one of the loads. */}
            {a.section.selfWeight > 0 ? (
              <span className="mp-plot__unit">
                {' '}
                · {t.results.ownWeight} {num(a.section.selfWeight, 6)} {u.line}
              </span>
            ) : null}
          </p>
          {/* The marker is drawn where the values are read (x0): on the beam, which may have got shorter under it. */}
          <BeamSchematic form={form} reactions={reactions} ownWeight={a.section.selfWeight} width={width} probeX={probeX !== null ? x0 : null} summary={says.beam} group={t.numbers.group} />
          {sol && series ? (
            <>
              <BeamPlot title={t.results.shear} unit={u.force} points={series.V} marks={series.marksV} breaks={sol.breaks} L={sol.L} width={width} height={plotHeight} probe={probeX !== null && here && x0 !== null ? { x: x0, y: here.right.V } : null} onProbe={setProbeX} summary={says.V} group={t.numbers.group} />
              <BeamPlot title={t.results.moment} unit={u.moment} points={series.M} marks={series.marksM} breaks={sol.breaks} L={sol.L} width={width} height={plotHeight} probe={probeX !== null && here && x0 !== null ? { x: x0, y: here.right.M } : null} onProbe={setProbeX} summary={says.M} group={t.numbers.group} />
              {series.D ? (
                <BeamPlot title={t.results.deflection} unit={u.deflection} points={series.D} marks={series.marksD} breaks={sol.breaks} L={sol.L} width={width} height={plotHeight} probe={probeX !== null && here && x0 !== null ? { x: x0, y: here.right.EIv * a.toDeflection } : null} onProbe={setProbeX} summary={says.D} group={t.numbers.group} />
              ) : (
                <p className="mp-app__need">{need('deflection')}</p>
              )}
              <p className="mp-app__note">{t.results.signs}</p>
            </>
          ) : (
            <p className="mp-app__need">{t.results.waiting}</p>
          )}
        </div>
      </section>
      </div>

      {/* ── the numbers ──────────────────────────────────────────────── */}
      {sol && reactions && peaks && vMax && mAbs ? (
          <div className="mp-app__tables">
            <div className="mp-app__card">
              <h3 className="mp-app__h">{t.results.reactions}</h3>
              <table className="mp-app__table">
                <thead>
                  <tr>
                    <th scope="col">{t.results.support}</th>
                    <th scope="col">
                      {t.results.position} ({u.length})
                    </th>
                    <th scope="col">
                      {t.results.force} ({u.force})
                    </th>
                    <th scope="col">
                      {t.results.momentCol} ({u.moment})
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {reactions.map((r) => (
                    <tr key={r.x}>
                      <th scope="row">{t.supports.kinds[r.kind]}</th>
                      <td>{num(r.x)}</td>
                      <td>
                        {num(Math.abs(r.Rv))} <span className="mp-app__dir">{r.Rv === 0 ? '' : arrow(r.Rv, t.results.upward, t.results.downward)}</span>
                      </td>
                      <td>
                        {r.kind === 'fixed' ? (
                          <>
                            {num(Math.abs(r.Rm))} <span className="mp-app__dir">{r.Rm === 0 ? '' : arrow(r.Rm, t.results.ccw, t.results.cw)}</span>
                          </>
                        ) : (
                          '—'
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {balanced ? (
                <p className="mp-app__note">
                  {/* The load is what was typed, added up: settled with the loads' own floor, never a reaction's. */}
                  {t.results.equilibrium} {num(settle(sol.totalLoad, noise.F))} = {num(settle(sol.totalLoad, noise.F))} {u.force}.
                </p>
              ) : (
                <p className="mp-app__row-error">{t.results.unbalanced.replace('{sum}', num(sumR)).replace('{load}', num(sol.totalLoad)).replace(/\{unit\}/g, u.force)}</p>
              )}
            </div>

            <div className="mp-app__card">
              <h3 className="mp-app__h">{t.results.maxima}</h3>
              <dl className="mp-app__dl">
                <div>
                  <dt>{t.results.maxShear}</dt>
                  <dd>
                    {num(Math.abs(vMax.value))} {u.force} <span className="mp-app__dir">{vMax.x === null ? '' : where(vMax.x)}</span>
                  </dd>
                </div>
                <div>
                  <dt>{t.results.maxSagging}</dt>
                  <dd>{peaks.Mmax.value > 0 && peaks.Mmax.x !== null ? (
                    <>
                      {num(peaks.Mmax.value)} {u.moment} <span className="mp-app__dir">{where(peaks.Mmax.x)}</span>
                    </>
                  ) : (
                    t.results.none
                  )}</dd>
                </div>
                <div>
                  <dt>{t.results.maxHogging}</dt>
                  <dd>{peaks.Mmin.value < 0 && peaks.Mmin.x !== null ? (
                    <>
                      {num(Math.abs(peaks.Mmin.value))} {u.moment} <span className="mp-app__dir">{where(peaks.Mmin.x)}</span>
                    </>
                  ) : (
                    t.results.none
                  )}</dd>
                </div>
                <div>
                  <dt>{t.results.maxDeflection}</dt>
                  <dd>
                    {dAbs ? (
                      <>
                        {num(Math.abs(dAbs.value * a.toDeflection))} {u.deflection}{' '}
                        <span className="mp-app__dir">{dAbs.x === null ? '' : `${arrow(dAbs.value, t.results.upward, t.results.downward)}, ${where(dAbs.x)}`}</span>
                      </>
                    ) : (
                      <span className="mp-app__dir">{need('deflection')}</span>
                    )}
                  </dd>
                </div>
                <div>
                  <dt>{t.results.bendingStress}</dt>
                  <dd>{sigma !== null ? `${num(sigma)} ${u.stress}` : <span className="mp-app__dir">{need('bending')}</span>}</dd>
                </div>
                <div>
                  <dt>{t.results.shearStress}</dt>
                  <dd>{tau !== null ? `${num(tau)} ${u.stress}` : <span className="mp-app__dir">{need('shear')}</span>}</dd>
                </div>
              </dl>
              {sigma !== null || tau !== null ? (
                <p className="mp-app__note">
                  {tau !== null && a.section.shearRule !== 'none' ? `${t.results.shearRule[a.section.shearRule]} ` : ''}
                  {t.results.elastic}
                </p>
              ) : null}
            </div>

            {a.toDeflection ? (
              <div className="mp-app__card">
                <h3 className="mp-app__h">{t.results.spans}</h3>
                <table className="mp-app__table">
                  <thead>
                    <tr>
                      <th scope="col">
                        {t.results.span} ({u.length})
                      </th>
                      <th scope="col">
                        {t.results.deflection} ({u.deflection})
                      </th>
                      <th scope="col">{t.results.ratio}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {a.spans.map((s) => (
                      <tr key={`${s.from}-${s.to}`}>
                        <th scope="row">
                          {s.kind === 'cantilever' ? `${t.results.cantilever} ` : ''}
                          {num(s.from)} – {num(s.to)}
                        </th>
                        <td>
                          {num(Math.abs(settle(s.EIv.value, noise.EIv) * a.toDeflection))} <span className="mp-app__dir">{Math.abs(s.EIv.value) <= noise.EIv ? '' : arrow(s.deflection, t.results.upward, t.results.downward)}</span>
                        </td>
                        <td>{s.ratio === null || Math.abs(s.EIv.value) <= noise.EIv ? '—' : s.ratio > 99999 ? `> ${num(99999, 6)}` : `L/${num(Math.round(s.ratio), 6)}`}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {a.spans.some((s) => s.kind === 'cantilever') ? <p className="mp-app__note">{t.results.ratioNote}</p> : null}
              </div>
            ) : null}

            {/* The single-span page's two cards. Before "Values at a point",
                which stays the last one: the sheet leaves its hint off paper
                by its place (calc.css). */}
            {span && shares ? (
              <div className="mp-app__card mp-app__card--wide">
                <h3 className="mp-app__h">{span.loads.title}</h3>
                {/* Each cell says what it is: on a phone the rows are laid out as
                    lines of their own (calc.css), and a browser that reads a
                    table's meaning from its layout would lose it there. */}
                <table className="mp-app__table mp-app__table--loads" role="table">
                  <thead role="rowgroup">
                    <tr role="row">
                      <th scope="col" role="columnheader">
                        {span.loads.load}
                      </th>
                      <th scope="col" role="columnheader">
                        {span.loads.left} ({u.force})
                      </th>
                      <th scope="col" role="columnheader">
                        {span.loads.right} ({u.force})
                      </th>
                      <th scope="col" role="columnheader">
                        {t.results.momentCol} {where(xM)} ({u.moment})
                      </th>
                      {a.toDeflection ? (
                        <th scope="col" role="columnheader">
                          {t.results.deflection} {where(xD)} ({u.deflection})
                        </th>
                      ) : null}
                    </tr>
                  </thead>
                  <tbody role="rowgroup">
                    {/* A row is named as the form names it: "Point load 1" is the first of the point loads.
                        And it is settled as a whole. The deflections' floor is lower than the reactions'
                        (a billionth of the loads, a millionth of the largest reaction): a load a millionth
                        of the others was printed with a deflection, beside no reaction and no moment. A
                        load whose two reactions are rounding has no deflection to show for them. */}
                    {shares.rows.map((r) => (
                      <tr key={`${r.list}${r.index}`} role="row">
                        <th scope="row" role="rowheader">
                          {r.list === 'own' ? span.loads.own : rowName(r.list, r.index)}
                        </th>
                        <td role="cell">{num(settle(r.left, noise.V))}</td>
                        <td role="cell">{num(settle(r.right, noise.V))}</td>
                        <td role="cell">{num(settle(r.M, noise.M))}</td>
                        {a.toDeflection ? <td role="cell">{num((Math.abs(r.left) <= noise.V && Math.abs(r.right) <= noise.V ? 0 : settle(r.EIv, noise.EIv)) * a.toDeflection)}</td> : null}
                      </tr>
                    ))}
                    {/* All of them: the reactions and the largest values printed above, never a second sum of the rows. */}
                    <tr className="mp-app__total" role="row">
                      <th scope="row" role="rowheader">
                        {span.loads.all}
                      </th>
                      <td role="cell">{num(reactions[0].Rv)}</td>
                      <td role="cell">{num(reactions[reactions.length - 1].Rv)}</td>
                      <td role="cell">{num(mAbs.value)}</td>
                      {a.toDeflection ? <td role="cell">{num((dAbs?.value ?? 0) * a.toDeflection)}</td> : null}
                    </tr>
                  </tbody>
                </table>
                <p className="mp-app__note">
                  {span.loads.note}
                  {a.toDeflection ? ` ${span.loads.noteDeflection}` : ''}
                </p>
              </div>
            ) : null}

            {span && needs ? (
              <div className="mp-app__card">
                <h3 className="mp-app__h">{span.sizing.title}</h3>
                <div className="mp-app__row mp-app__row--two" role="group" aria-label={span.sizing.title}>
                  <NumField numbers={t.numbers} label={span.sizing.limit} value={limit} onChange={setLimit} invalid={!limited} describedBy={limited ? undefined : `${uid}limit`} />
                  <NumField numbers={t.numbers} label={span.sizing.stress} unit={u.stress} value={stress} onChange={setStress} emptyIs={0} optional={t.section.optional} invalid={off(stress)} describedBy={off(stress) ? `${uid}stress` : undefined} />
                </div>
                <dl className="mp-app__dl">
                  <div>
                    <dt>{span.sizing.inertia}</dt>
                    <dd>
                      {needs.I !== null ? (
                        <>
                          {sized(needs.I, u.I)}
                          {a.section.I > 0 ? <span className="mp-app__dir"> {span.sizing.has.replace('{value}', sized(a.section.I, u.I, 6))}</span> : null}
                        </>
                      ) : (
                        <span className="mp-app__dir" id={`${uid}limit`}>
                          {limited ? span.sizing.needE : span.sizing.needLimit}
                        </span>
                      )}
                    </dd>
                  </div>
                  <div>
                    <dt>{span.sizing.modulus}</dt>
                    <dd>
                      {needs.S !== null ? (
                        <>
                          {sized(needs.S, u.S)}
                          {a.section.S > 0 ? <span className="mp-app__dir"> {span.sizing.has.replace('{value}', sized(a.section.S, u.S, 6))}</span> : null}
                        </>
                      ) : (
                        // A stress that was entered and cannot be one is told what is wrong with it, not asked for again.
                        <span className="mp-app__dir" id={`${uid}stress`}>
                          {off(stress) ? span.sizing.badStress : span.sizing.needStress}
                        </span>
                      )}
                    </dd>
                  </div>
                </dl>
                <p className="mp-app__note">{span.sizing.note}</p>
              </div>
            ) : null}

            {here && x0 !== null ? (
              <div className="mp-app__card">
                <h3 className="mp-app__h">{t.results.point}</h3>
                <div className="mp-app__row mp-app__row--one">
                  {/* The position as it is held, never rounded for show: the values
                      below are read at THIS x. (Shown to four figures, a typed
                      123.45 read "123.5" over the values at 123.45.) A position
                      from a diagram arrives already rounded (BeamPlot). */}
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
                      {two(here.left.V, here.right.V) ? (
                        <>
                          {num(settle(here.left.V, noise.V))} <span className="mp-app__dir">{t.results.left}</span>, {num(settle(here.right.V, noise.V))} <span className="mp-app__dir">{t.results.right}</span> {u.force}
                        </>
                      ) : (
                        `${num(settle(here.right.V, noise.V))} ${u.force}`
                      )}
                    </dd>
                  </div>
                  <div>
                    <dt>{t.results.moment}</dt>
                    <dd>
                      {two(here.left.M, here.right.M) ? (
                        <>
                          {num(settle(here.left.M, noise.M))} <span className="mp-app__dir">{t.results.left}</span>, {num(settle(here.right.M, noise.M))} <span className="mp-app__dir">{t.results.right}</span> {u.moment}
                        </>
                      ) : (
                        `${num(settle(here.right.M, noise.M))} ${u.moment}`
                      )}
                    </dd>
                  </div>
                  {a.toDeflection ? (
                    <>
                      <div>
                        <dt>{t.results.deflection}</dt>
                        <dd>
                          {num(settle(here.right.EIv, noise.EIv) * a.toDeflection)} {u.deflection}
                        </dd>
                      </div>
                      <div>
                        <dt>{t.results.slope}</dt>
                        <dd>
                          {two(here.left.EItheta, here.right.EItheta) ? `${num(settle(here.left.EItheta, noise.EItheta) * a.toSlope)} / ${num(settle(here.right.EItheta, noise.EItheta) * a.toSlope)}` : num(settle(here.right.EItheta, noise.EItheta) * a.toSlope)} rad
                        </dd>
                      </div>
                    </>
                  ) : null}
                  {a.section.S ? (
                    <div>
                      <dt>{t.results.bendingStress}</dt>
                      <dd>
                        {num(bendingStress(form.units, a.section, Math.max(Math.abs(settle(here.left.M, noise.M)), Math.abs(settle(here.right.M, noise.M)))) ?? 0)} {u.stress}
                      </dd>
                    </div>
                  ) : null}
                </dl>
                <p className="mp-app__note">{t.results.pointHint}</p>
              </div>
            ) : null}
          </div>
        ) : null}

      <p className="mp-app__privacy">{t.results.privacy}</p>
      {/* On paper only: when the sheet was printed, and the address that opens this very beam again. */}
      <SheetStamp stamp={stamp} t={t.sheet} />
    </div>
  );
}
