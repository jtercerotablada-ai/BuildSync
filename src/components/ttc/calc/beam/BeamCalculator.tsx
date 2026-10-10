'use client';

import React, { useEffect, useLayoutEffect, useMemo, useReducer, useRef, useState } from 'react';
import { formatNumber } from '@/lib/calc/format';
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
  type FormIssue,
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
 * all come back to the same beam. The example beam leaves the address bare.
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

/** A value that is rounding, not a result, is zero. */
const settle = (value: number, floor: number) => (Math.abs(value) <= floor ? 0 : value);

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
 * the form down the page (mp.css, .mp-app__out is sticky), which only helps
 * if all four fit under the header: 150px each on a tall window, less on a
 * laptop, never under 96.
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

const arrow = (v: number, up: string, down: string) => (v < 0 ? down : up);

export function BeamCalculator({ t }: { t: BeamUi }) {
  const [form, dispatch] = useReducer(reduceBeam, undefined, defaultBeam);
  const [shapes, setShapes] = useState<SteelShape[] | null>(null);
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
  // The last length the visitor settled on, for carrying the end support along.
  const settledL = useRef(form.L);
  const editingL = useRef(false);
  useEffect(() => {
    if (!editingL.current && form.L > 0 && Number.isFinite(form.L)) settledL.current = form.L;
  }, [form.L]);
  const plotHeight = usePlotHeight();
  const u = UNITS[form.units];

  // A beam in the address opens as that beam.
  useEffect(() => {
    const read = () => {
      const m = window.location.hash.match(/^#b=(.+)$/);
      if (!m) return;
      let text = m[1];
      try {
        text = decodeURIComponent(text);
      } catch {
        /* not percent-encoded: read as it is */
      }
      const loaded = decodeBeam(text);
      // Not a beam: the example is shown, and the page says so — a recipient
      // must not take the example for the beam that was sent.
      dispatch({ type: 'load', form: loaded ?? defaultBeam() });
      unread.current = !loaded;
      setLinkError(!loaded);
    };
    read();
    window.addEventListener('hashchange', read);
    return () => window.removeEventListener('hashchange', read);
  }, []);

  // The address follows the beam. Waited for, not written on every
  // keystroke: Safari refuses more than a hundred history changes in thirty
  // seconds, and a field being typed in passes through values nobody meant.
  useEffect(() => {
    const write = () => {
      pending.current = null;
      const code = encodeBeam(form);
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
    };
    pending.current = write;
    const id = window.setTimeout(write, 300);
    return () => window.clearTimeout(id);
  }, [form]);
  // …and is brought up to date at once when the visitor reaches for something
  // else: the language link reads the address as it is pressed or focused
  // (lang.tsx, useCarriedHash), and must not read the beam of a moment ago.
  useEffect(() => {
    const flush = () => pending.current?.();
    window.addEventListener('pointerdown', flush, true);
    window.addEventListener('focusin', flush, true);
    return () => {
      window.removeEventListener('pointerdown', flush, true);
      window.removeEventListener('focusin', flush, true);
    };
  }, []);

  // The shape table, the first time it is wanted.
  const wantsShapes = form.section.mode === 'shape';
  useEffect(() => {
    if (!wantsShapes || shapes) return;
    let live = true;
    void import('@/lib/steel/aisc-shapes.json').then((m) => {
      if (live) setShapes((m.default ?? m).shapes as SteelShape[]);
    });
    return () => {
      live = false;
    };
  }, [wantsShapes, shapes]);

  const shape = useMemo(() => (wantsShapes ? (shapes?.find((s) => s.designation === form.section.shape) ?? null) : null), [wantsShapes, shapes, form.section.shape]);
  const a = useMemo(() => analyse(form, shape), [form, shape]);
  const sol = a.solution;

  const issueOf = (list: RowList, id: number) => a.issues.find((i) => i.row?.list === list && i.row.id === id);
  const invalid = (list: RowList, id: number) => Boolean(issueOf(list, id));
  const patch = (list: RowList, id: number, p: Record<string, unknown>) => dispatch({ type: 'patch', list, id, patch: p });
  const full = (list: RowList) => form[list].length >= MAX_ROWS;

  /* ── What counts as zero ────────────────────────────────────────────── */
  // Measured against the size of the PROBLEM (the loads, the length), not
  // of each diagram: a shear that is zero everywhere has nothing of its own
  // to be measured against, and was drawn at full height from rounding.
  const noise = useMemo(() => {
    const F = 1e-9 * a.loadScale;
    const L = sol ? sol.L : 0;
    return { V: F, M: F * L, EIv: F * L * L * L };
  }, [a.loadScale, sol]);
  // On the drawing as in the table: a reaction that is rounding is none, and gets no arrow.
  const drawnReactions = useMemo(() => (sol ? sol.reactions.map((r) => ({ ...r, Rv: settle(r.Rv, noise.V), Rm: settle(r.Rm, noise.M) })) : null), [sol, noise]);

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

  const absMax = (p: { value: number; x: number }, q: { value: number; x: number }) => (Math.abs(p.value) >= Math.abs(q.value) ? p : q);
  const vMax = sol ? absMax(sol.extremes.Vmax, sol.extremes.Vmin) : null;
  const mAbs = sol ? absMax(sol.extremes.Mmax, sol.extremes.Mmin) : null;
  const dAbs = sol && a.toDeflection ? absMax(sol.extremes.EIvMax, sol.extremes.EIvMin) : null;
  const sigma = mAbs ? bendingStress(form.units, a.section, Math.abs(mAbs.value)) : null;
  const tau = vMax ? shearStress(form.units, a.section, Math.abs(vMax.value)) : null;

  const num = (v: number, sig = 4) => formatNumber(v, sig);
  const where = (x: number) => `${t.results.at} x = ${num(x)} ${u.length}`;

  /* ── The drawings in words ──────────────────────────────────────────── */
  const says = {
    beam: `${t.results.schematic}: ${num(form.L)} ${u.length}; ${form.supports.map((s) => `${t.supports.kinds[s.kind]} ${num(s.x)}`).join(', ')}.`,
    V: sol ? `${t.results.shear}: ${t.plot.max} ${num(sol.extremes.Vmax.value)} ${u.force} ${where(sol.extremes.Vmax.x)}; ${t.plot.min} ${num(sol.extremes.Vmin.value)} ${u.force} ${where(sol.extremes.Vmin.x)}.` : '',
    M: sol ? `${t.results.moment}: ${t.plot.max} ${num(sol.extremes.Mmax.value)} ${u.moment} ${where(sol.extremes.Mmax.x)}; ${t.plot.min} ${num(sol.extremes.Mmin.value)} ${u.moment} ${where(sol.extremes.Mmin.x)}.` : '',
    D: sol && dAbs ? `${t.results.deflection}: ${num(dAbs.value * a.toDeflection)} ${u.deflection} ${where(dAbs.x)}.` : '',
  };

  const copyLink = async () => {
    const hash = `#b=${encodeBeam(form)}`;
    // The page and the beam, and nothing else: not the query string the
    // visitor arrived with (an ad's click identifier, a campaign tag), which
    // would travel to everyone the link is sent to.
    const link = `${window.location.origin}${window.location.pathname}${hash}`;
    try {
      window.history.replaceState(window.history.state, '', window.location.pathname + window.location.search + hash);
    } catch {
      /* see above */
    }
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
  const general = a.issues.filter((i) => !i.row);
  const rowIssue = (list: RowList, id: number) => {
    const issue = issueOf(list, id);
    return issue ? (
      <p className="mp-app__row-error" role="alert">
        {t.issues[issue.code]}
      </p>
    ) : null;
  };
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
  const select = <T extends string>(label: string, value: T, options: [T, string][], onChange: (v: T) => void) => (
    <label className="mp-num mp-num--select">
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
          <div className="mp-app__row mp-app__row--one">
            <NumField
              label={t.beam.length}
              unit={u.length}
              value={form.L}
              onChange={(L) => dispatch({ type: 'length', L })}
              invalid={a.issues.some((i) => i.code === 'length')}
              onEdit={() => {
                editingL.current = true;
              }}
              onCommit={() => {
                editingL.current = false;
                if (!(form.L > 0) || !Number.isFinite(form.L)) return;
                dispatch({ type: 'carry-end', from: settledL.current, to: form.L });
                settledL.current = form.L;
              }}
            />
          </div>
        </fieldset>

        <fieldset className="mp-app__group">
          <legend>{t.supports.title}</legend>
          {form.supports.map((s, i) => (
            <div key={s.id} className="mp-app__item" data-invalid={invalid('supports', s.id) ? 'true' : undefined}>
              <div className="mp-app__row mp-app__row--rm">
                <div className="mp-app__fields">
                {select<SupportKind>(t.supports.kind, s.kind, [['pin', t.supports.kinds.pin], ['roller', t.supports.kinds.roller], ['fixed', t.supports.kinds.fixed]], (kind) => patch('supports', s.id, { kind }))}
                <NumField label={t.supports.position} unit={u.length} value={s.x} onChange={(x) => patch('supports', s.id, { x })} invalid={invalid('supports', s.id)} />
                </div>
                {removeButton('supports', s.id, `${t.supports.title} ${i + 1}`)}
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
            <div key={h.id} className="mp-app__item" data-invalid={invalid('hinges', h.id) ? 'true' : undefined}>
              <div className="mp-app__row mp-app__row--rm">
                <div className="mp-app__fields">
                <NumField label={t.hinges.position} unit={u.length} value={h.x} onChange={(x) => patch('hinges', h.id, { x })} invalid={invalid('hinges', h.id)} />
                </div>
                {removeButton('hinges', h.id, `${t.hinges.title} ${i + 1}`)}
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
            <div key={p.id} className="mp-app__item" data-invalid={invalid('points', p.id) ? 'true' : undefined}>
              <div className="mp-app__row mp-app__row--rm">
                <div className="mp-app__fields">
                <NumField label={t.loads.load} unit={u.force} value={p.P} onChange={(P) => patch('points', p.id, { P })} />
                {select(t.loads.direction, p.dir, [['down', t.loads.down], ['up', t.loads.up]], (dir) => patch('points', p.id, { dir }))}
                <NumField label={t.loads.at} unit={u.length} value={p.x} onChange={(x) => patch('points', p.id, { x })} invalid={invalid('points', p.id)} />
                </div>
                {removeButton('points', p.id, `${t.loads.point} ${i + 1}`)}
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
            <div key={d.id} className="mp-app__item" data-invalid={invalid('dists', d.id) ? 'true' : undefined}>
              <div className="mp-app__row mp-app__row--rm">
                <div className="mp-app__fields">
                <NumField label={t.loads.start} unit={u.line} value={d.w1} onChange={(w1) => patch('dists', d.id, { w1 })} />
                <NumField label={t.loads.end} unit={u.line} value={d.w2} onChange={(w2) => patch('dists', d.id, { w2 })} />
                {select(t.loads.direction, d.dir, [['down', t.loads.down], ['up', t.loads.up]], (dir) => patch('dists', d.id, { dir }))}
                <NumField label={t.loads.from} unit={u.length} value={d.x1} onChange={(x1) => patch('dists', d.id, { x1 })} invalid={invalid('dists', d.id)} />
                <NumField label={t.loads.to} unit={u.length} value={d.x2} onChange={(x2) => patch('dists', d.id, { x2 })} invalid={invalid('dists', d.id)} />
                </div>
                {removeButton('dists', d.id, `${t.loads.dist} ${i + 1}`)}
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
            <div key={c.id} className="mp-app__item" data-invalid={invalid('couples', c.id) ? 'true' : undefined}>
              <div className="mp-app__row mp-app__row--rm">
                <div className="mp-app__fields">
                <NumField label={t.loads.moment} unit={u.moment} value={c.M} onChange={(M) => patch('couples', c.id, { M })} />
                {select(t.loads.direction, c.dir, [['cw', t.loads.cw], ['ccw', t.loads.ccw]], (dir) => patch('couples', c.id, { dir }))}
                <NumField label={t.loads.at} unit={u.length} value={c.x} onChange={(x) => patch('couples', c.id, { x })} invalid={invalid('couples', c.id)} />
                </div>
                {removeButton('couples', c.id, `${t.loads.couple} ${i + 1}`)}
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
                label={t.section.E}
                unit={u.E}
                value={sec.E}
                onChange={(E) => dispatch({ type: 'section', patch: { E, material: sec.material !== 'custom' && E !== MATERIALS[sec.material][form.units] ? 'custom' : sec.material } })}
                invalid={!Number.isFinite(sec.E) || sec.E < 0}
              />
            </div>
          ) : null}

          {sec.mode === 'props' ? (
            <div className="mp-app__row mp-app__row--three">
              <NumField label={t.section.I} unit={u.I} value={sec.I} onChange={(I) => dispatch({ type: 'section', patch: { I } })} invalid={sec.I < 0} />
              <NumField label={t.section.S} unit={u.S} value={sec.S} onChange={(S) => dispatch({ type: 'section', patch: { S } })} optional={t.section.optional} invalid={sec.S < 0} />
              <NumField label={t.section.Av} unit={u.A} value={sec.Av} onChange={(Av) => dispatch({ type: 'section', patch: { Av } })} optional={t.section.optional} invalid={sec.Av < 0} />
            </div>
          ) : null}

          {sec.mode === 'rect' ? (
            <>
              <div className="mp-app__row mp-app__row--two">
                <NumField label={t.section.b} unit={u.dim} value={sec.b} onChange={(b) => dispatch({ type: 'section', patch: { b } })} invalid={sec.b < 0} />
                <NumField label={t.section.h} unit={u.dim} value={sec.h} onChange={(h) => dispatch({ type: 'section', patch: { h } })} invalid={sec.h < 0} />
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
                  <label className="mp-num mp-num--select">
                    <span className="mp-num__label">{t.section.shape}</span>
                    <span className="mp-num__box">
                      <select className="mp-num__input" value={sec.shape} onChange={(e) => dispatch({ type: 'section', patch: { shape: e.target.value } })}>
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
                {filtered.length === 0 ? <p className="mp-app__none">{t.section.noMatch}</p> : null}
                {shape ? (
                  <p className="mp-app__computed">
                    {shape.designation}: E = {num(a.section.E, 6)} {u.E}, I = {num(a.section.I, 6)} {u.I}, S = {num(a.section.S, 6)} {u.S}
                  </p>
                ) : null}
                <label className="mp-app__check">
                  <input type="checkbox" checked={sec.selfWeight} onChange={(e) => dispatch({ type: 'section', patch: { selfWeight: e.target.checked } })} />
                  <span>
                    {t.section.selfWeight}
                    {shape ? ` (${num(form.units === 'us' ? shape.weight : shape.weight * 1.48816394, 4)} ${u.weight})` : ''}
                  </span>
                </label>
              </>
            ) : (
              <p className="mp-app__none" role="status">
                {t.section.loading}
              </p>
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
              setLinkError(false);
              if (window.location.hash) window.history.replaceState(window.history.state, '', window.location.pathname + window.location.search);
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
      <section className="mp-app__out" aria-label={t.results.title}>
        <div className="mp-app__issues" role="alert" aria-live="assertive">
          {a.issues.length ? (
            <>
              {/* With the beam solved, what is wrong is a value of the section. */}
              <p className="mp-app__issues-title">{sol ? t.issuesSection : t.issuesTitle}</p>
              <ul>
                {general.map((i: FormIssue) => (
                  <li key={i.code}>{t.issues[i.code]}</li>
                ))}
                {a.issues.some((i) => i.row) ? [...new Set(a.issues.filter((i) => i.row).map((i) => t.issues[i.code]))].map((text) => <li key={text}>{text}</li>) : null}
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
                · {t.results.ownWeight} {formatNumber(a.section.selfWeight, 6)} {u.line}
              </span>
            ) : null}
          </p>
          <BeamSchematic form={form} reactions={drawnReactions} ownWeight={a.section.selfWeight} width={width} probeX={sol ? probeX : null} summary={says.beam} />
          {sol && series ? (
            <>
              <BeamPlot title={t.results.shear} unit={u.force} points={series.V} marks={series.marksV} breaks={sol.breaks} L={sol.L} width={width} height={plotHeight} probe={probeX !== null && here ? { x: probeX, y: here.right.V } : null} onProbe={setProbeX} summary={says.V} />
              <BeamPlot title={t.results.moment} unit={u.moment} points={series.M} marks={series.marksM} breaks={sol.breaks} L={sol.L} width={width} height={plotHeight} probe={probeX !== null && here ? { x: probeX, y: here.right.M } : null} onProbe={setProbeX} summary={says.M} />
              {series.D ? (
                <BeamPlot title={t.results.deflection} unit={u.deflection} points={series.D} marks={series.marksD} breaks={sol.breaks} L={sol.L} width={width} height={plotHeight} probe={probeX !== null && here ? { x: probeX, y: here.right.EIv * a.toDeflection } : null} onProbe={setProbeX} summary={says.D} />
              ) : (
                <p className="mp-app__need">{t.results.needEI}</p>
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
      {sol && vMax && mAbs ? (
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
                  {sol.reactions.map((r) => (
                    <tr key={r.x}>
                      <th scope="row">{t.supports.kinds[r.kind]}</th>
                      <td>{num(r.x)}</td>
                      <td>
                        {num(Math.abs(settle(r.Rv, noise.V)))} <span className="mp-app__dir">{Math.abs(r.Rv) <= noise.V ? '' : arrow(r.Rv, t.results.upward, t.results.downward)}</span>
                      </td>
                      <td>
                        {r.kind === 'fixed' ? (
                          <>
                            {num(Math.abs(settle(r.Rm, noise.M)))} <span className="mp-app__dir">{Math.abs(r.Rm) <= noise.M ? '' : arrow(r.Rm, t.results.ccw, t.results.cw)}</span>
                          </>
                        ) : (
                          '—'
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <p className="mp-app__note">
                {t.results.equilibrium} {num(settle(sol.reactions.reduce((sum, r) => sum + r.Rv, 0), noise.V))} = {num(settle(sol.totalLoad, noise.V))} {u.force}.
              </p>
            </div>

            <div className="mp-app__card">
              <h3 className="mp-app__h">{t.results.maxima}</h3>
              <dl className="mp-app__dl">
                <div>
                  <dt>{t.results.maxShear}</dt>
                  <dd>
                    {num(Math.abs(settle(vMax.value, noise.V)))} {u.force} <span className="mp-app__dir">{Math.abs(vMax.value) <= noise.V ? '' : where(vMax.x)}</span>
                  </dd>
                </div>
                <div>
                  <dt>{t.results.maxSagging}</dt>
                  <dd>{sol.extremes.Mmax.value > noise.M ? (
                    <>
                      {num(sol.extremes.Mmax.value)} {u.moment} <span className="mp-app__dir">{where(sol.extremes.Mmax.x)}</span>
                    </>
                  ) : (
                    t.results.none
                  )}</dd>
                </div>
                <div>
                  <dt>{t.results.maxHogging}</dt>
                  <dd>{sol.extremes.Mmin.value < -noise.M ? (
                    <>
                      {num(Math.abs(sol.extremes.Mmin.value))} {u.moment} <span className="mp-app__dir">{where(sol.extremes.Mmin.x)}</span>
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
                        {num(Math.abs(settle(dAbs.value, noise.EIv) * a.toDeflection))} {u.deflection}{' '}
                        <span className="mp-app__dir">{Math.abs(dAbs.value) <= noise.EIv ? '' : `${arrow(dAbs.value, t.results.upward, t.results.downward)}, ${where(dAbs.x)}`}</span>
                      </>
                    ) : (
                      <span className="mp-app__dir">{t.results.needEI}</span>
                    )}
                  </dd>
                </div>
                <div>
                  <dt>{t.results.bendingStress}</dt>
                  <dd>{sigma !== null ? `${num(sigma)} ${u.stress}` : <span className="mp-app__dir">{t.results.needS}</span>}</dd>
                </div>
                <div>
                  <dt>{t.results.shearStress}</dt>
                  <dd>{tau !== null ? `${num(tau)} ${u.stress}` : <span className="mp-app__dir">{t.results.needAv}</span>}</dd>
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
                        <td>{s.ratio === null || Math.abs(s.EIv.value) <= noise.EIv ? '—' : s.ratio > 99999 ? '> 99,999' : `L/${Math.round(s.ratio).toLocaleString('en-US')}`}</td>
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
                  <NumField
                    label="x"
                    unit={u.length}
                    value={round4(x0)}
                    // Taking the field holds the position where it is: the pointer
                    // leaving a diagram on its way here must not move it.
                    onEdit={() => {
                      setTypedX(round4(x0));
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
                          {two(here.left.EItheta, here.right.EItheta) ? `${num(here.left.EItheta * a.toSlope)} / ${num(here.right.EItheta * a.toSlope)}` : num(here.right.EItheta * a.toSlope)} rad
                        </dd>
                      </div>
                    </>
                  ) : null}
                  {a.section.S ? (
                    <div>
                      <dt>{t.results.bendingStress}</dt>
                      <dd>
                        {num(bendingStress(form.units, a.section, Math.max(Math.abs(here.left.M), Math.abs(here.right.M))) ?? 0)} {u.stress}
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
