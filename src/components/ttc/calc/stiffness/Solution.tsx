'use client';

import React, { memo, useCallback, useEffect, useId, useMemo, useRef, useState } from 'react';
import { stagesOf, type StiffnessAnalysis } from '@/lib/calc/stiffness/analysis';
import type { UnitSystem } from '@/lib/calc/stiffness/model';
import type { StiffnessUi } from '@/lib/calc/stiffness/strings';
import type { Mode, Step } from '@/lib/calc/stiffness/types';
import { MatrixTable, type MatrixForm } from './MatrixTable';
import { Notation } from './Notation';
import { SIG_MAX, SIG_MIN, type NumFormat, type NumStyle, type ZeroStyle } from './numfmt';
import { labelsOf, stepBody, stepView, stepWeight, type BodyItem, type StepContext, type StepView, type ValueRow } from './steps';
import { fill } from './text';

/**
 * THE WORKED SOLUTION: the main content of the page. Every step the library recorded is a card - its number and title, a short plain
 * explanation of what the step does and why (the formula first, then this structure's numbers), the formulas in math notation, its
 * values and its tables - and the cards are reached from an outline (a list beside them on a wide screen, a menu on a phone), a
 * Previous and a Next, and open and close one by one or all at once.
 *
 * EVERY CARD IS OPEN BY DEFAULT: the page is a full printable solution as it stands. A card that is closed is its heading and nothing
 * else (its tables are not built), so a solution of a hundred and fifty steps costs nothing until it is opened; a solution so large
 * that opening it all would be tens of thousands of entries (a structure of twelve nodes and twenty members) starts with the first
 * card open and says so. On paper every card is open, whatever was chosen on screen.
 *
 * HOW THE NUMBERS ARE SHOWN is chosen here, once, for every table: symbols, numbers or both; significant figures 3 to 8; plain or
 * powers of ten; how a zero is written.
 */

/** The most entries a solution may hold and still open every card at first. */
export const OPEN_BUDGET = 12000;

/** Columns of one band of a wide matrix on paper. */
export const PAPER_BANDS = 12;

export interface SolutionProps {
  w: StiffnessUi;
  analysis: StiffnessAnalysis;
  system: UnitSystem;
  mode: Mode;
  /** What the page sets thousands apart with. */
  group: string;
  onPaper: boolean;
  /** The solution on screen is of the structure a moment ago. */
  busy: boolean;
  /** The id the whole section is reached by (the "skip to the worked solution" link). */
  id: string;
  /** Changes whenever a structure replaces the one before (a template, a link, start over): the cards go back to their first state. */
  epoch: number;
}

const stepKey = (key: string) => key.replace(/[^A-Za-z0-9-]/g, '-');

/* ── A value row, and the values of a step ────────────────────────────── */

function Values({ rows, form }: { rows: ValueRow[]; form: MatrixForm }) {
  return (
    <dl className="mp-st__values">
      {rows.map((r) => {
        // What stands before the "=": the symbol, then the formula the library gave it, then the number and its unit.
        const formula = r.formula !== null && r.formula !== r.symbol && form !== 'numbers' ? r.formula : null;
        const showNumber = !(form === 'symbolic' && r.formula !== null && r.formula !== r.symbol);
        const parts: React.ReactNode[] = [];
        if (r.symbol) parts.push(<Notation key="s" text={r.symbol} />);
        if (formula) parts.push(<Notation key="f" text={formula} />);
        if (showNumber) {
          parts.push(
            <React.Fragment key="v">
              <span className="mp-st__value">{r.text}</span>
              {r.unit ? <span className="mp-st__unit"> {r.unit}</span> : null}
            </React.Fragment>,
          );
        }
        return (
          <div key={r.key}>
            <dt>{r.gloss}</dt>
            <dd>
              {parts.map((p, k) => (
                <React.Fragment key={k}>
                  {k > 0 ? ' = ' : null}
                  {p}
                </React.Fragment>
              ))}
            </dd>
          </div>
        );
      })}
    </dl>
  );
}

/* ── One card ─────────────────────────────────────────────────────────── */

interface CardProps {
  step: Step;
  view: StepView;
  open: boolean;
  onToggle: (key: string) => void;
  ctx: StepContext;
  form: MatrixForm;
  zeros: ZeroStyle;
  w: StiffnessUi;
  bands: number | null;
  domId: string;
  current: boolean;
  singular: boolean;
}

const StepCard = memo(function StepCard({ step, view, open, onToggle, ctx, form, zeros, w, bands, domId, current, singular }: CardProps) {
  const items: BodyItem[] = useMemo(() => (open ? stepBody(step, ctx) : []), [open, step, ctx]);
  const head = `${domId}-h`;
  const body = `${domId}-b`;
  return (
    <section className="mp-st__card" id={domId} aria-labelledby={head} data-step={step.id} data-current={current ? 'true' : undefined} data-singular={singular ? 'true' : undefined}>
      <h3 className="mp-st__cardhead" id={head}>
        <button type="button" className="mp-st__toggle" aria-expanded={open} aria-controls={body} onClick={() => onToggle(step.key)}>
          <span className="mp-st__stepnum">{fill(w.solution.stage, { label: view.label })}</span>
          <span className="mp-st__title">
            <Notation text={view.title} />
          </span>
          <span className="mp-st__chev" aria-hidden="true">
            {open ? '−' : '+'}
          </span>
        </button>
      </h3>
      <div id={body} className="mp-st__body" hidden={!open}>
        {open ? (
          <>
            {view.paragraphs.map((p, k) => (
              <p key={k} className="mp-st__text">
                <Notation text={p} />
              </p>
            ))}
            {view.formulas.length > 0 ? (
              <ul className="mp-st__formulas">
                {view.formulas.map((f) => (
                  <li key={f}>
                    <Notation text={f} />
                  </li>
                ))}
              </ul>
            ) : null}
            <div className="mp-st__items">
              {items.map((item) => (item.kind === 'values' ? <Values key={item.id} rows={item.rows} form={form} /> : <MatrixTable key={item.id} model={item.model} form={form} zeros={zeros} w={w} bands={bands} />))}
            </div>
          </>
        ) : null}
      </div>
    </section>
  );
});

/* ── The solution ─────────────────────────────────────────────────────── */

const FORMS: MatrixForm[] = ['both', 'symbolic', 'numbers'];
const STYLES: NumStyle[] = ['auto', 'fixed', 'scientific'];
const ZEROS: ZeroStyle[] = ['light', 'dot', 'plain'];

/**
 * The short name an outline chip carries. In a stage whose steps are all one kind (the members' geometry, the members' end forces) it is the
 * member's number; in a stage of several kinds (the assembly and the assembled K, the elimination's passes and back-substitutions) it is the
 * step's own label, '6.3', which cannot be taken for a member.
 */
function chipOf(step: Step, view: StepView, uniform: boolean): string {
  if (uniform && step.scope.kind === 'member') return String(step.scope.member);
  if (uniform && step.id === 'forward-pass') return String(step.facts.pass ?? view.label);
  if (uniform && step.id === 'back-substitution') return String(step.facts.unknown ?? view.label);
  return view.label;
}

export function Solution({ w, analysis, system, mode, group, onPaper, busy, id, epoch }: SolutionProps) {
  const uid = useId().replace(/[^a-zA-Z0-9]/g, '');
  const solved = analysis.solution !== null;
  const steps: Step[] = useMemo(() => analysis.solution?.steps ?? analysis.partial, [analysis]);

  /* How the numbers are shown. */
  const [form, setForm] = useState<MatrixForm>('both');
  const [sig, setSig] = useState(4);
  const [style, setStyle] = useState<NumStyle>('auto');
  const [zeros, setZeros] = useState<ZeroStyle>('light');
  const format: NumFormat = useMemo(() => ({ sig, style, group }), [sig, style, group]);
  const ctx: StepContext = useMemo(() => ({ w, system, mode, format }), [w, system, mode, format]);

  /* The views of every step (cheap), and the weight of the whole. */
  const labels = useMemo(() => labelsOf(steps), [steps]);
  const views = useMemo(() => steps.map((s) => stepView(s, labels, ctx)), [steps, labels, ctx]);
  const weight = useMemo(() => steps.reduce((sum, s) => sum + stepWeight(s), 0), [steps]);
  const long = weight > OPEN_BUDGET;

  /* Which cards are open: by default all (but the first only, for a long solution); then what the visitor chose. */
  const [openMode, setOpenMode] = useState<'auto' | 'all' | 'none'>('auto');
  const [toggled, setToggled] = useState<Record<string, boolean>>({});
  const [current, setCurrent] = useState<string | null>(null);
  const [seen, setSeen] = useState(epoch);
  if (seen !== epoch) {
    setSeen(epoch);
    setOpenMode('auto');
    setToggled({});
    setCurrent(null);
  }
  const isOpen = (key: string, index: number): boolean => {
    if (onPaper) return true;
    const chosen = toggled[key];
    if (chosen !== undefined) return chosen;
    if (openMode === 'all') return true;
    if (openMode === 'none') return false;
    return !long || index === 0;
  };
  const toggle = useCallback(
    (key: string) =>
      setToggled((t) => {
        const index = steps.findIndex((s) => s.key === key);
        const now = t[key] !== undefined ? t[key] : openMode === 'all' ? true : openMode === 'none' ? false : !long || index === 0;
        return { ...t, [key]: !now };
      }),
    [steps, openMode, long],
  );

  /* Going to a card: it is opened, scrolled to and handed the focus. */
  const goal = useRef<string | null>(null);
  const domId = useCallback((key: string) => `${uid}-${stepKey(key)}`, [uid]);
  const go = useCallback(
    (key: string) => {
      goal.current = key;
      setCurrent(key);
      setToggled((t) => ({ ...t, [key]: true }));
    },
    [],
  );
  useEffect(() => {
    const key = goal.current;
    if (!key) return;
    const el = document.getElementById(domId(key));
    if (!el) return;
    goal.current = null;
    el.querySelector<HTMLElement>('button')?.focus({ preventScroll: true });
    el.scrollIntoView({ block: 'start' });
  });
  const position = Math.max(0, steps.findIndex((s) => s.key === current));
  const step = (delta: -1 | 1) => {
    const next = Math.min(steps.length - 1, Math.max(0, (current === null ? (delta === 1 ? -1 : steps.length) : position) + delta));
    if (steps[next]) go(steps[next].key);
  };

  const stages = useMemo(() => stagesOf(steps), [steps]);
  const stageTitle = (n: number) => (w.solution.stageTitles as Record<number, string>)[n] ?? String(n);
  const singularKey = steps.find((s) => s.id === 'forward-pass' && s.facts.singular === true)?.key ?? null;
  const bands = onPaper ? PAPER_BANDS : null;

  const radio = (name: string, value: string, label: string, checked: boolean, onChange: () => void) => (
    <label key={value} className="mp-seg__item">
      <input type="radio" name={name} checked={checked} onChange={onChange} />
      <span>{label}</span>
    </label>
  );

  return (
    <section className="mp-st__solution" id={id} tabIndex={-1} aria-labelledby={`${uid}-title`} aria-busy={busy ? true : undefined}>
      <h2 className="mp-st__h" id={`${uid}-title`}>
        {w.solution.title}
      </h2>
      <p className="mp-app__note mp-st__intro">{steps.length === 0 ? w.solution.noSteps : fill(solved ? w.solution.intro : w.solution.shortIntro, { stages: stages.length })}</p>
      {!solved && steps.length > 0 ? (
        <p className="mp-st__partial" role="status">
          {singularKey !== null ? w.solution.partial : w.solution.partialOther}
        </p>
      ) : (
        <p className="mp-st__partial" role="status" data-empty="true" />
      )}
      {steps.length > 0 ? (
        <>
          <div className="mp-st__looks" role="group" aria-label={w.look.title}>
            <fieldset className="mp-seg">
              <legend className="mp-num__label">{w.look.form}</legend>
              {FORMS.map((f) => radio(`${uid}form`, f, w.look.forms[f], form === f, () => setForm(f)))}
            </fieldset>
            <label className="mp-num mp-num--select">
              <span className="mp-num__label">{w.look.figures}</span>
              <span className="mp-num__box">
                <select className="mp-num__input" value={sig} onChange={(e) => setSig(Number(e.target.value))}>
                  {Array.from({ length: SIG_MAX - SIG_MIN + 1 }, (_, k) => SIG_MIN + k).map((n) => (
                    <option key={n} value={n}>
                      {n}
                    </option>
                  ))}
                </select>
              </span>
            </label>
            <label className="mp-num mp-num--select">
              <span className="mp-num__label">{w.look.style}</span>
              <span className="mp-num__box">
                <select className="mp-num__input" value={style} onChange={(e) => setStyle(e.target.value as NumStyle)}>
                  {STYLES.map((s) => (
                    <option key={s} value={s}>
                      {w.look.styles[s]}
                    </option>
                  ))}
                </select>
              </span>
            </label>
            <label className="mp-num mp-num--select">
              <span className="mp-num__label">{w.look.zeros}</span>
              <span className="mp-num__box">
                <select className="mp-num__input" value={zeros} onChange={(e) => setZeros(e.target.value as ZeroStyle)}>
                  {ZEROS.map((z) => (
                    <option key={z} value={z}>
                      {w.look.zeroStyles[z]}
                    </option>
                  ))}
                </select>
              </span>
            </label>
          </div>
          <p className="mp-app__note mp-st__looknote">{w.look.note}</p>
          {long ? <p className="mp-app__note mp-st__long">{fill(w.solution.long, { steps: steps.length, cells: weight.toLocaleString('en-US') })}</p> : null}

          <div className="mp-st__layout">
            <aside className="mp-st__aside">
              <div className="mp-st__bar">
                <button type="button" className="mp-app__btn" onClick={() => step(-1)} disabled={current !== null && position <= 0}>
                  {w.solution.previous}
                </button>
                <button type="button" className="mp-app__btn" onClick={() => step(1)} disabled={current !== null && position >= steps.length - 1}>
                  {w.solution.next}
                </button>
                <button
                  type="button"
                  className="mp-app__btn"
                  onClick={() => {
                    setOpenMode('all');
                    setToggled({});
                  }}
                >
                  {w.solution.expandAll}
                </button>
                <button
                  type="button"
                  className="mp-app__btn"
                  onClick={() => {
                    setOpenMode('none');
                    setToggled({});
                  }}
                >
                  {w.solution.collapseAll}
                </button>
              </div>
              <p className="mp-st__position">{fill(w.solution.position, { now: current === null ? 0 : position + 1, total: steps.length })}</p>
              <label className="mp-num mp-num--select mp-st__jump">
                <span className="mp-num__label">{w.solution.jump}</span>
                <span className="mp-num__box">
                  <select className="mp-num__input" value={current ?? ''} onChange={(e) => (e.target.value ? go(e.target.value) : undefined)}>
                    <option value="">—</option>
                    {views.map((v) => (
                      <option key={v.key} value={v.key}>
                        {v.label} {v.title}
                      </option>
                    ))}
                  </select>
                </span>
              </label>
              <nav className="mp-st__nav" aria-label={w.solution.outline}>
                <ol className="mp-st__stages">
                  {stages.map((stage) => {
                    const first = stage.steps[0];
                    const many = stage.steps.length > 1;
                    return (
                      <li key={stage.number}>
                        <a
                          href={`#${domId(first.key)}`}
                          className="mp-st__stagelink"
                          aria-current={current !== null && stage.steps.some((s) => s.key === current) ? 'step' : undefined}
                          onClick={(e) => {
                            e.preventDefault();
                            go(first.key);
                          }}
                        >
                          <span className="mp-st__stagenum">{stage.number}</span> {stageTitle(stage.number)}
                        </a>
                        {many ? (
                          <ol className="mp-st__chips">
                            {stage.steps.map((s) => {
                              const v = views[steps.indexOf(s)];
                              return (
                                <li key={s.key}>
                                  <a
                                    href={`#${domId(s.key)}`}
                                    className="mp-st__chip"
                                    aria-label={`${fill(w.solution.stage, { label: v.label })}: ${v.title}`}
                                    title={v.title}
                                    aria-current={current === s.key ? 'step' : undefined}
                                    onClick={(e) => {
                                      e.preventDefault();
                                      go(s.key);
                                    }}
                                  >
                                    {chipOf(s, v, stage.steps.every((q) => q.id === first.id))}
                                  </a>
                                </li>
                              );
                            })}
                          </ol>
                        ) : null}
                      </li>
                    );
                  })}
                </ol>
              </nav>
            </aside>
            <div className="mp-st__cards">
              {steps.map((s, k) => (
                <StepCard
                  key={s.key}
                  step={s}
                  view={views[k]}
                  open={isOpen(s.key, k)}
                  onToggle={toggle}
                  ctx={ctx}
                  form={form}
                  zeros={zeros}
                  w={w}
                  bands={bands}
                  domId={domId(s.key)}
                  current={current === s.key}
                  singular={s.key === singularKey}
                />
              ))}
            </div>
          </div>
        </>
      ) : null}
    </section>
  );
}
