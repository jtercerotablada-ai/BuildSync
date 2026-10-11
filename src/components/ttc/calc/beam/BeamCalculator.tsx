'use client';

import React, { useCallback, useEffect, useId, useLayoutEffect, useMemo, useReducer, useRef, useState } from 'react';
import { agree, formatNumber } from '@/lib/calc/format';
import {
  LAYOUTS,
  MATERIALS,
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
  type MaterialKey,
  type RowList,
  type SectionMode,
  type SteelShape,
  type SupportLayout,
} from '@/lib/calc/beam/model';
import type { BeamState, SupportKind } from '@/lib/calc/beam/solver';
import type { BeamUi } from '@/lib/calc/beam/strings';
import { NumField } from '../NumField';
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
 */

/** The example beam, as it is written in an address. */
const EXAMPLE = encodeBeam(defaultBeam());

/*
 * Sent to the window each time this page rewrites its own address: nothing
 * else tells the header, whose language link is built from the address
 * (mp/lang.tsx listens, under the same name). An event and not an import:
 * that file reads the site's whole copy, which this script must not carry.
 */
const ADDRESS_EVENT = 'mp:address';

/** A value that is rounding, not a result, is zero. */
const settle = (value: number, floor: number) => (Math.abs(value) <= floor ? 0 : value);

/** A largest value and where it occurs — or zero, nowhere, when it is rounding. */
type Peak = { value: number; x: number | null };
const peak = (p: { value: number; x: number }, floor: number): Peak => (Math.abs(p.value) <= floor ? { value: 0, x: null } : p);
const larger = (p: Peak, q: Peak) => (Math.abs(p.value) >= Math.abs(q.value) ? p : q);

/* A layout effect in the browser (the drawings must be at their real width
   before the first paint), a plain effect where there is no layout. */
const useIsoLayoutEffect = typeof window === 'undefined' ? useEffect : useLayoutEffect;

/** The width of an element, as it is laid out — 720 until it has been measured. */
function useWidth<T extends HTMLElement>(): [React.RefObject<T | null>, number] {
  const ref = useRef<T>(null);
  const [width, setWidth] = useState(720);
  useIsoLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const measure = () => setWidth(Math.max(280, Math.round(el.clientWidth)));
    measure();
    if (typeof ResizeObserver === 'undefined') return;
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  return [ref, width];
}

/**
 * How tall each of the three diagrams is. On a desktop the drawings follow
 * the form down the page (calc.css, .mp-app__out is sticky), which only
 * helps if all four fit under the header: 150px each on a tall window, less
 * on a laptop, never under 96. At 96 they need a window some 790px tall;
 * in a shorter one they do not fit at any size worth drawing, and the sheet
 * lets the column scroll with the page instead of pinning it half out of
 * sight.
 */
function usePlotHeight(): number {
  const [h, setH] = useState(150);
  useEffect(() => {
    // 500px is everything else in the column: the header above it, the
    // schematic, four captions and the note on signs.
    const fit = () => setH(Math.round(Math.min(150, Math.max(96, (window.innerHeight - 500) / 3))));
    fit();
    window.addEventListener('resize', fit);
    return () => window.removeEventListener('resize', fit);
  }, []);
  return h;
}

/**
 * Whether the drawings' column is taller than the window has room for under
 * the header — in which case the sheet does not pin it (.mp-app__out--tall).
 * The heights above are reckoned for a drawing of the beam at its plain
 * size. It grows with what is on the beam (twelve loads close together, their
 * values stacked), and a notice may stand over it: pinned then, the foot of
 * the deflection diagram stayed under the fold for as long as the form was
 * on screen. So the column is measured, each time its size or the window's
 * changes. Not on the server, and not before the first measure: the page
 * arrives pinned, as the sheet has it. Being let go does not change the
 * column's height, so the measure cannot chase itself.
 */
function useTooTall<T extends HTMLElement>(): [React.RefObject<T | null>, boolean] {
  const ref = useRef<T>(null);
  const [tooTall, setTooTall] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el || typeof ResizeObserver === 'undefined') return;
    // Where the sheet pins it: its `top`, which is a length whether or not it is pinned now.
    const measure = () => setTooTall(el.getBoundingClientRect().height + (parseFloat(getComputedStyle(el).top) || 0) > window.innerHeight);
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    window.addEventListener('resize', measure);
    return () => {
      ro.disconnect();
      window.removeEventListener('resize', measure);
    };
  }, []);
  return [ref, tooTall];
}

const arrow = (v: number, up: string, down: string) => (v < 0 ? down : up);

/** `initial`: the beam it opens with, where that is not the example — for the tests, which cannot type. */
export function BeamCalculator({ t, initial }: { t: BeamUi; initial?: BeamForm }) {
  const [form, dispatch] = useReducer(reduceBeam, initial, (given) => given ?? defaultBeam());
  const [shapes, setShapes] = useState<SteelShape[] | null>(null);
  const [shapesFailed, setShapesFailed] = useState(false);
  const [shapeFilter, setShapeFilter] = useState('');
  const [probeX, setProbeX] = useState<number | null>(null);
  const [typedX, setTypedX] = useState<number | null>(null);
  const [copied, setCopied] = useState<'' | 'ok' | 'failed'>('');
  const [linkError, setLinkError] = useState(false);
  // A link that could not be read is left in the address, for the visitor to look at.
  const unread = useRef(false);
  // The address still to be written, if the beam has changed since the last time.
  const pending = useRef<(() => void) | null>(null);
  const [plotRef, width] = useWidth<HTMLDivElement>();
  const [outRef, tooTall] = useTooTall<HTMLElement>();
  // The last length the visitor settled on, for carrying the end support along.
  const settledL = useRef(form.L);
  const editingL = useRef(false);
  const lengthRow = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!editingL.current && form.L > 0 && Number.isFinite(form.L)) settledL.current = form.L;
  }, [form.L]);
  const plotHeight = usePlotHeight();
  const u = UNITS[form.units];
  // What the ids of this form's messages begin with.
  const uid = useId();

  // A beam in the address opens as that beam.
  useEffect(() => {
    const open = (beam: BeamForm, failed: boolean) => {
      dispatch({ type: 'load', form: beam });
      // What was waiting to be written is the beam of before: it is not to
      // land on the address this one came from.
      pending.current = null;
      unread.current = failed;
      setLinkError(failed);
      // A place pointed at on the beam before is not a place on this one.
      setProbeX(null);
      setTypedX(null);
    };
    const read = (changed?: Event) => {
      const m = window.location.hash.match(/^#b=(.+)$/);
      if (!m) {
        // Back to the bare address is back to the example beam: that is what
        // a bare address opens. Any other fragment (`#main`) is a place on
        // this page, reached from the beam on screen: the beam stays.
        if (changed && window.location.hash === '') open(defaultBeam(), false);
        return;
      }
      let text = m[1];
      try {
        text = decodeURIComponent(text);
      } catch {
        /* not percent-encoded: read as it is */
      }
      const loaded = decodeBeam(text);
      // Not a beam: the example is shown, and the page says so — a recipient
      // must not take the example for the beam that was sent.
      open(loaded ?? defaultBeam(), !loaded);
    };
    read();
    window.addEventListener('hashchange', read);
    return () => window.removeEventListener('hashchange', read);
  }, []);

  // The address follows the beam.
  const write = useCallback((beam: BeamForm) => {
    const code = encodeBeam(beam);
    const want = code === EXAMPLE ? '' : `#b=${code}`;
    if (want) {
      unread.current = false;
      setLinkError(false);
    }
    // Only a fragment that is this calculator's: `#main` is a place on the
    // page, and is nobody's to remove.
    const have = window.location.hash.startsWith('#b=') ? window.location.hash : '';
    if (have === want || (!want && unread.current)) return;
    try {
      window.history.replaceState(window.history.state, '', window.location.pathname + window.location.search + want);
    } catch {
      /* the address is a convenience; the calculator works without it */
    }
    window.dispatchEvent(new Event(ADDRESS_EVENT));
  }, []);
  // Waited for, not written on every keystroke: Safari refuses more than a
  // hundred history changes in thirty seconds, and a field being typed in
  // passes through values nobody meant.
  //
  // The Length field most of all. Until it is left, what sat on the right
  // end has not been carried along (`carry-end`): a 20 ft span being made 27
  // has its roller at 20 still. That beam is never written. What is written
  // meanwhile, by the timer or at once if the visitor reaches for something
  // else, is the beam that leaving the field makes of it. (The timer once
  // kept out of the Length field altogether: a page reloaded with the caret
  // still in it came back with the length of before, and no word of it.)
  useEffect(() => {
    const now = () => {
      pending.current = null;
      const carried = editingL.current && form.L > 0 && Number.isFinite(form.L);
      write(carried ? reduceBeam(form, { type: 'carry-end', from: settledL.current, to: form.L }) : form);
    };
    pending.current = now;
    const id = window.setTimeout(() => {
      // Still the one waiting: not written already, not overtaken by a link.
      if (pending.current === now) now();
    }, 300);
    return () => window.clearTimeout(id);
  }, [form, write]);
  // …and is brought up to date at once when the visitor reaches for something
  // else: the language link is built from the address (lang.tsx,
  // useCarriedHash) and must not open the beam of a moment ago; a phone may
  // discard a tab that is put away, and reloads it from its address. On the
  // click as well as the press: not every browser moves the focus to a link
  // that is clicked, and a tap need not take it from the field.
  useEffect(() => {
    const flush = (e?: Event) => {
      // A press inside the Length field is part of typing in it.
      if (editingL.current && e?.target instanceof Node && lengthRow.current?.contains(e.target)) return;
      pending.current?.();
    };
    const hidden = () => {
      if (document.visibilityState === 'hidden') flush();
    };
    window.addEventListener('pointerdown', flush, true);
    window.addEventListener('focusin', flush, true);
    window.addEventListener('click', flush, true);
    document.addEventListener('visibilitychange', hidden);
    return () => {
      window.removeEventListener('pointerdown', flush, true);
      window.removeEventListener('focusin', flush, true);
      window.removeEventListener('click', flush, true);
      document.removeEventListener('visibilitychange', hidden);
    };
  }, []);

  // The shape table, the first time it is wanted.
  const wantsShapes = form.section.mode === 'shape';
  useEffect(() => {
    if (!wantsShapes || shapes || shapesFailed) return;
    let live = true;
    void import('@/lib/steel/aisc-shapes.json').then(
      (m) => {
        if (live) setShapes((m.default ?? m).shapes as SteelShape[]);
      },
      // The table is a piece of the page's script, and a piece that did not
      // arrive is not asked for a second time: the page has to be loaded
      // again, and has to say so. Left alone, "Loading…" stayed for the visit.
      () => {
        if (live) setShapesFailed(true);
      },
    );
    return () => {
      live = false;
    };
  }, [wantsShapes, shapes, shapesFailed]);

  // The shape in use: as the table spells it, or in any case — a link typed
  // by hand says w18x50.
  const shape = useMemo(() => {
    if (!wantsShapes || !shapes) return null;
    const name = form.section.shape;
    return shapes.find((s) => s.designation === name) ?? shapes.find((s) => s.designation.toUpperCase() === name.toUpperCase()) ?? null;
  }, [wantsShapes, shapes, form.section.shape]);
  // The form then holds the table's spelling, and so does the address. (Not
  // capitals: the table has Pipe1/2STD.)
  useEffect(() => {
    if (shape && shape.designation !== form.section.shape) dispatch({ type: 'section', patch: { shape: shape.designation } });
  }, [shape, form.section.shape]);
  // A name the table does not have: no section, and the page says which name.
  const unknownShape = wantsShapes && shapes !== null && !shape;
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
  const two = (l: number, r: number) => Math.abs(l - r) > 1e-9 * Math.max(1, Math.abs(l), Math.abs(r));

  const vMax = peaks ? larger(peaks.Vmax, peaks.Vmin) : null;
  const mAbs = peaks ? larger(peaks.Mmax, peaks.Mmin) : null;
  const dAbs = peaks && a.toDeflection ? larger(peaks.EIvMax, peaks.EIvMin) : null;
  const sigma = mAbs ? bendingStress(form.units, a.section, Math.abs(mAbs.value)) : null;
  const tau = vMax ? shearStress(form.units, a.section, Math.abs(vMax.value)) : null;

  // Every number this page prints, with the page's own mark between thousands.
  const num = (v: number, sig = 4) => formatNumber(v, sig, t.numbers.group);
  const where = (x: number) => `${t.results.at} x = ${num(x)} ${u.length}`;
  // What is missing for a result, in the fields the chosen kind of section
  // has: "enter the section modulus" is no help beside a list of shapes.
  // With the shape table on its way, or lost, that is what is missing.
  const need = (what: 'deflection' | 'bending' | 'shear') => (wantsShapes && !shapes ? (shapesFailed ? t.section.loadFailed : t.section.loading) : t.results.need[form.section.mode][what]);

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

  const copyLink = async () => {
    // The page and the beam, and nothing else: not the query string the
    // visitor arrived with (an ad's click identifier, a campaign tag), which
    // would travel to everyone the link is sent to.
    const link = `${window.location.origin}${window.location.pathname}#b=${encodeBeam(form)}`;
    // The address is brought to this beam too — which for the example beam
    // is the bare address — and a link that could not be read has nothing
    // left to say: the one being copied is the beam on screen.
    unread.current = false;
    setLinkError(false);
    pending.current = null;
    write(form);
    try {
      await navigator.clipboard.writeText(link);
      setCopied('ok');
    } catch {
      // No clipboard (an old browser, a page not served over https): the address bar has it.
      setCopied('failed');
    }
    window.setTimeout(() => setCopied(''), 4000);
  };

  const filtered = useMemo(() => {
    if (!shapes) return [];
    const q = shapeFilter.trim().toUpperCase().replace(/\s+/g, '');
    const list = q ? shapes.filter((s) => s.designation.toUpperCase().includes(q)) : shapes;
    return list.slice(0, 120);
  }, [shapes, shapeFilter]);

  const sec = form.section;
  // A value of the section that cannot be one.
  const off = (v: number) => !Number.isFinite(v) || v < 0;
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
  const select = <T extends string>(label: string, value: T, options: [T, string][], onChange: (v: T) => void, kind = '') => (
    <label className={`mp-num mp-num--select ${kind}`.trim()}>
      <span className="mp-num__label">{label}</span>
      <span className="mp-num__box">
        <select className="mp-num__input" value={value} onChange={(e) => onChange(e.target.value as T)}>
          {options.map(([v, text]) => (
            <option key={v} value={v}>
              {text}
            </option>
          ))}
        </select>
      </span>
    </label>
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
                    // A position typed in feet is not that many metres.
                    setTypedX(null);
                    setProbeX(null);
                  }}
                />
                <span>{t.toolbar[key]}</span>
              </label>
            ))}
          </fieldset>
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
                pending.current = null;
                if (!(form.L > 0) || !Number.isFinite(form.L)) return write(form);
                const carry = { type: 'carry-end', from: settledL.current, to: form.L } as const;
                dispatch(carry);
                settledL.current = form.L;
                write(reduceBeam(form, carry));
              }}
            />
          </div>
        </fieldset>

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

        <fieldset className="mp-app__group">
          <legend>{t.section.title}</legend>
          <p className="mp-app__note">{t.section.intro}</p>
          <fieldset className="mp-seg">
            <legend className="mp-num__label">{t.section.mode}</legend>
            {(['props', 'rect', 'shape'] as SectionMode[]).map((key) => (
              <label key={key} className="mp-seg__item">
                <input type="radio" name="beam-section" checked={sec.mode === key} onChange={() => dispatch({ type: 'section', patch: { mode: key } })} />
                <span>{t.section.modes[key]}</span>
              </label>
            ))}
          </fieldset>

          {sec.mode !== 'shape' ? (
            <div className="mp-app__row mp-app__row--two">
              {select<MaterialKey>(
                t.section.material,
                sec.material,
                (['steel', 'aluminum', 'concrete', 'wood', 'custom'] as MaterialKey[]).map((key) => [key, t.section.materials[key]] as [MaterialKey, string]),
                (material) => dispatch({ type: 'material', material }),
              )}
              <NumField
                numbers={t.numbers}
                label={t.section.E}
                unit={u.E}
                value={sec.E}
                onChange={(E) => dispatch({ type: 'section', patch: { E, material: sec.material !== 'custom' && E !== MATERIALS[sec.material][form.units] ? 'custom' : sec.material } })}
                invalid={off(sec.E)}
                describedBy={said('section', off(sec.E))}
              />
            </div>
          ) : null}
          {/* What a listed modulus assumes, while it is the one in use. Under
              the fields, not in the list: a closed list cuts a long name off,
              on screen and on paper. */}
          {sec.mode !== 'shape' && (sec.material === 'concrete' || sec.material === 'wood') && sec.E === MATERIALS[sec.material][form.units] ? <p className="mp-app__note">{t.section.materialNote[sec.material]}</p> : null}

          {sec.mode === 'props' ? (
            <div className="mp-app__row mp-app__row--three">
              <NumField numbers={t.numbers} label={t.section.I} unit={u.I} value={sec.I} onChange={(I) => dispatch({ type: 'section', patch: { I } })} invalid={off(sec.I)} describedBy={said('section', off(sec.I))} />
              <NumField numbers={t.numbers} label={t.section.S} unit={u.S} value={sec.S} onChange={(S) => dispatch({ type: 'section', patch: { S } })} optional={t.section.optional} invalid={off(sec.S)} describedBy={said('section', off(sec.S))} />
              <NumField numbers={t.numbers} label={t.section.Av} unit={u.A} value={sec.Av} onChange={(Av) => dispatch({ type: 'section', patch: { Av } })} optional={t.section.optional} invalid={off(sec.Av)} describedBy={said('section', off(sec.Av))} />
            </div>
          ) : null}

          {sec.mode === 'rect' ? (
            <>
              <div className="mp-app__row mp-app__row--two">
                <NumField numbers={t.numbers} label={t.section.b} unit={u.dim} value={sec.b} onChange={(b) => dispatch({ type: 'section', patch: { b } })} invalid={off(sec.b)} describedBy={said('section', off(sec.b))} />
                <NumField numbers={t.numbers} label={t.section.h} unit={u.dim} value={sec.h} onChange={(h) => dispatch({ type: 'section', patch: { h } })} invalid={off(sec.h)} describedBy={said('section', off(sec.h))} />
              </div>
              <p className="mp-app__computed">
                {t.section.computed}: I = {num(a.section.I, 6)} {u.I}, S = {num(a.section.S, 6)} {u.S}
              </p>
            </>
          ) : null}

          {sec.mode === 'shape' ? (
            shapes ? (
              <>
                <div className="mp-app__row mp-app__row--two">
                  <label className="mp-num">
                    <span className="mp-num__label">{t.section.filter}</span>
                    <span className="mp-num__box">
                      <input className="mp-num__input" type="text" value={shapeFilter} onChange={(e) => setShapeFilter(e.target.value)} placeholder={t.section.filterHint} autoComplete="off" spellCheck={false} />
                    </span>
                  </label>
                  <label className="mp-num mp-num--select" data-invalid={unknownShape ? 'true' : undefined}>
                    <span className="mp-num__label">{t.section.shape}</span>
                    <span className="mp-num__box">
                      <select
                        className="mp-num__input"
                        value={sec.shape}
                        onChange={(e) => dispatch({ type: 'section', patch: { shape: e.target.value } })}
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
                {filtered.length === 0 ? <p className="mp-app__none">{t.section.noMatch}</p> : null}
                {shape ? (
                  <p className="mp-app__computed">
                    {shape.designation}: E = {num(a.section.E, 6)} {u.E}, I = {num(a.section.I, 6)} {u.I}, S = {num(a.section.S, 6)} {u.S}
                  </p>
                ) : null}
                {/* Without a shape there is no weight to include: the box is not shown ticked for one. */}
                <label className="mp-app__check">
                  <input type="checkbox" checked={sec.selfWeight && shape !== null} disabled={!shape} onChange={(e) => dispatch({ type: 'section', patch: { selfWeight: e.target.checked } })} />
                  <span>
                    {t.section.selfWeight}
                    {shape ? ` (${num(form.units === 'us' ? shape.weight : shape.weight * 1.48816394, 4)} ${u.weight})` : ''}
                  </span>
                </label>
              </>
            ) : (
              <>
                <p className="mp-app__none" role="status">
                  {shapesFailed ? t.section.loadFailed : t.section.loading}
                </p>
                {shapesFailed ? (
                  <button
                    type="button"
                    className="mp-app__btn"
                    onClick={() => {
                      // The beam and "Steel shape" are in the address: the page comes back to both.
                      pending.current?.();
                      window.location.reload();
                    }}
                  >
                    {t.section.reload}
                  </button>
                ) : null}
              </>
            )
          ) : null}
        </fieldset>

        <div className="mp-app__actions">
          <button type="button" className="mp-app__btn" onClick={copyLink}>
            {t.toolbar.copy}
          </button>
          <button type="button" className="mp-app__btn" onClick={() => window.print()}>
            {t.toolbar.print}
          </button>
          <button
            type="button"
            className="mp-app__btn mp-app__btn--quiet"
            onClick={() => {
              dispatch({ type: 'load', form: defaultBeam() });
              setShapeFilter('');
              setTypedX(null);
              setProbeX(null);
              unread.current = false;
              setLinkError(false);
              // The address goes bare — if what is after the # is a beam.
              pending.current = null;
              write(defaultBeam());
            }}
          >
            {t.toolbar.reset}
          </button>
          <p className="mp-app__copied" role="status" aria-live="polite">
            {copied === 'ok' ? t.toolbar.copied : copied === 'failed' ? t.toolbar.copyFailed : ''}
          </p>
        </div>
      </form>

      {/* ── the answer ───────────────────────────────────────────────── */}
      <section className={tooTall ? 'mp-app__out mp-app__out--tall' : 'mp-app__out'} aria-label={t.results.title} ref={outRef}>
        <div className="mp-app__issues" role="alert" aria-live="assertive">
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
    </div>
  );
}
