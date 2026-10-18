'use client';

import React, { memo, startTransition, useCallback, useEffect, useId, useLayoutEffect, useMemo, useReducer, useRef, useState } from 'react';
import { stagesOf, type StiffnessAnalysis } from '@/lib/calc/stiffness/analysis';
import type { StiffnessUi } from '@/lib/calc/stiffness/strings';
import type { Step } from '@/lib/calc/stiffness/types';
import { MatrixTable, type MatrixForm } from './MatrixTable';
import { Notation } from './Notation';
import { SIG_MAX, SIG_MIN, type NumFormat, type NumStyle, type ZeroStyle } from './numfmt';
import {
  FRESH,
  PRINT_BUDGET,
  PRINT_SKIPPED,
  applyNear,
  autoOpen,
  currentOf,
  estimateBody,
  groupDigits,
  isOpen,
  openReducer,
  positionLine,
  printSteps,
  sameCard,
  seedNear,
  startClosed,
  startScope,
  stepTarget,
  systemOf,
  weightOf,
  type PrintScope,
  type SameCardProps,
} from './solution-state';
import { labelsOf, stepBody, stepView, type BodyItem, type StepContext, type StepView, type ValueRow } from './steps';
import { fill } from './text';

/**
 * THE WORKED SOLUTION: the main content of the page. Every step the library recorded is a card - its number and title, a short plain
 * explanation of what the step does and why (the formula first, then this structure's numbers), the formulas in math notation, its
 * values and its tables - and the cards are reached from an outline (a list beside them on a wide screen), a Previous and a Next (a
 * bar at the foot of the screen on a tablet or a phone, where the cards are a long scroll), and open and close one by one or all at once.
 *
 * EVERY CARD IS OPEN BY DEFAULT but the few whose tables are very large (a 36 × 36 matrix shown twice): the page is a full printable
 * solution as it stands. An open card writes its words; it draws its TABLES only while it is near the screen (solution-state.ts says
 * why), so a solution of a hundred and thirty steps is as light to open as one of twenty, and a keystroke re-draws what is in sight.
 * A closed card is its heading and nothing else.
 *
 * The unit system, the mode and every number are the ANALYSIS'S: this file is given the analysis the cards are of and nothing that
 * can change before it (the form's units would, for the moment between a switch and the render that follows).
 *
 * HOW THE NUMBERS ARE SHOWN is chosen here, once, for every table: symbols, numbers or both; significant figures 3 to 8; plain or
 * powers of ten; how a zero is written.
 */

/** Columns of one band of a wide matrix on paper. */
export const PAPER_BANDS = 12;

export interface SolutionProps {
  w: StiffnessUi;
  analysis: StiffnessAnalysis;
  /** What the page sets thousands apart with. */
  group: string;
  onPaper: boolean;
  /** The solution on screen is of the structure a moment ago. */
  busy: boolean;
  /** The id the whole section is reached by (the "skip to the worked solution" link). */
  id: string;
  /** Changes whenever a structure replaces the one before (a template, a link, start over): the cards go back to their first state. */
  epoch: number;
  /** What comes after the solution on the page: the link that skips to it. Without it there is no such link. */
  after?: { id: string; go: (e: React.MouseEvent<HTMLAnchorElement>) => void };
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
  /** Near the screen: the tables are drawn. Far from it, their room is kept and nothing more. */
  near: boolean;
  onToggle: (key: string, wasOpen: boolean) => void;
  ctx: StepContext;
  form: MatrixForm;
  zeros: ZeroStyle;
  w: StiffnessUi;
  bands: number | null;
  domId: string;
  current: boolean;
  singular: boolean;
  /** Tells the solution where the card is, so that it knows when the card is near the screen. */
  register: (key: string, el: HTMLElement | null) => void;
  /** The height each card's tables had when last drawn, by key: the room kept while they are not. */
  heights: Map<string, number>;
}

const NO_ITEMS: BodyItem[] = [];

const StepCard = memo(function StepCard({ step, view, open, near, onToggle, ctx, form, zeros, w, bands, domId, current, singular, register, heights }: CardProps) {
  // The body of the card is built when it is first drawn, and kept while the card stays the same step of the same solution.
  const built = useRef<{ step: Step; ctx: StepContext; items: BodyItem[] } | null>(null);
  const drawn = open && near;
  let items = NO_ITEMS;
  if (drawn) {
    if (!built.current || built.current.step !== step || built.current.ctx !== ctx) built.current = { step, ctx, items: stepBody(step, ctx) };
    items = built.current.items;
  }
  const head = `${domId}-h`;
  const body = `${domId}-b`;
  const place = useCallback((el: HTMLElement | null) => register(step.key, el), [register, step.key]);
  const room = useRef<HTMLDivElement>(null);
  // While the tables are drawn, their height is remembered: it is the room kept for them when they are not.
  useEffect(() => {
    const el = room.current;
    if (!drawn || !el || typeof ResizeObserver === 'undefined') return;
    const ro = new ResizeObserver(() => heights.set(step.key, el.offsetHeight));
    ro.observe(el);
    return () => ro.disconnect();
  }, [drawn, heights, step.key]);
  return (
    <div className="mp-st__card" id={domId} role="group" aria-labelledby={head} data-step={step.id} data-current={current ? 'true' : undefined} data-singular={singular ? 'true' : undefined} ref={place}>
      <h3 className="mp-st__cardhead" id={head}>
        <button type="button" className="mp-st__toggle" aria-expanded={open} aria-controls={body} onClick={() => onToggle(step.key, open)}>
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
            {drawn ? (
              <div className="mp-st__items" ref={room}>
                {items.map((item) => (item.kind === 'values' ? <Values key={item.id} rows={item.rows} form={form} /> : <MatrixTable key={item.id} model={item.model} form={form} zeros={zeros} w={w} bands={bands} />))}
              </div>
            ) : (
              <div className="mp-st__later" style={{ minHeight: `${heights.get(step.key) ?? estimateBody(step)}px` }} aria-hidden="true" />
            )}
          </>
        ) : null}
      </div>
    </div>
  );
}, (a, b) => sameCard(a as unknown as SameCardProps, b as unknown as SameCardProps));

/* ── The solution ─────────────────────────────────────────────────────── */

const FORMS: MatrixForm[] = ['both', 'symbolic', 'numbers'];
const STYLES: NumStyle[] = ['auto', 'fixed', 'scientific'];
const ZEROS: ZeroStyle[] = ['light', 'dot', 'plain'];
const SCOPES: PrintScope[] = ['short', 'all'];

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

export function Solution({ w, analysis, group, onPaper, busy, id, epoch, after }: SolutionProps) {
  const uid = useId().replace(/[^a-zA-Z0-9]/g, '');
  const solved = analysis.solution !== null;
  // The unit system and the mode are those the numbers were computed in, never the form's now.
  const system = systemOf(analysis);
  const mode = analysis.mode;
  const all: Step[] = useMemo(() => analysis.solution?.steps ?? analysis.partial, [analysis]);

  /* How the numbers are shown. */
  const [form, setForm] = useState<MatrixForm>('both');
  const [sig, setSig] = useState(4);
  const [style, setStyle] = useState<NumStyle>('auto');
  const [zeros, setZeros] = useState<ZeroStyle>('light');
  const format: NumFormat = useMemo(() => ({ sig, style, group }), [sig, style, group]);
  const ctx: StepContext = useMemo(() => ({ w, system, mode, format }), [w, system, mode, format]);

  /* The views of every step (cheap), and the weight of the whole. */
  const labels = useMemo(() => labelsOf(all), [all]);
  const views = useMemo(() => all.map((s) => stepView(s, labels, ctx)), [all, labels, ctx]);
  const weight = useMemo(() => weightOf(all), [all]);
  const autos = useMemo(() => autoOpen(all), [all]);
  const closedAtStart = startClosed(autos);
  const indexOf = useMemo(() => new Map(all.map((s, k) => [s.key, k] as const)), [all]);

  /* What the sheet carries: every step, or - of a very long solution, by choice - the short sheet. */
  const heavy = weight > PRINT_BUDGET;
  const [chosenScope, setScope] = useState<PrintScope | null>(null);
  const scope: PrintScope = heavy ? (chosenScope ?? startScope(all)) : 'all';
  const steps = useMemo(() => (onPaper ? printSteps(all, scope) : all), [all, onPaper, scope]);
  const skipped = all.length - steps.length;
  const keys = useMemo(() => steps.map((s) => s.key), [steps]);

  /* Which cards are open (the cards' own start, then what the visitor chose) and which the visitor was taken to. */
  const [open, dispatch] = useReducer(openReducer, FRESH);
  const [seen, setSeen] = useState(epoch);
  if (seen !== epoch) {
    setSeen(epoch);
    dispatch({ type: 'reset' });
  }
  const cur = currentOf(open, keys);
  const toggle = useCallback((key: string, wasOpen: boolean) => dispatch({ type: 'toggle', key, wasOpen }), []);

  /* Which cards are near the screen: the first few, until the page knows where the screen is, then what an observer says. */
  const [near, setNear] = useState<ReadonlySet<string>>(() => seedNear(all));
  const [watching, setWatching] = useState(true);
  const heights = useRef(new Map<string, number>());
  const nodes = useRef(new Map<string, HTMLElement>());
  const keyOf = useRef(new WeakMap<Element, string>());
  const observer = useRef<IntersectionObserver | null>(null);
  useEffect(() => {
    if (onPaper) return;
    if (typeof IntersectionObserver === 'undefined') {
      setWatching(false);
      return;
    }
    // Two screens of room each way: a card is drawn before the reader reaches it.
    const margin = Math.max(900, Math.round(window.innerHeight * 1.5));
    const obs = new IntersectionObserver(
      (entries) => {
        const changes = entries.flatMap((e) => {
          const key = keyOf.current.get(e.target);
          return key === undefined ? [] : [{ key, on: e.isIntersecting }];
        });
        startTransition(() => setNear((prev) => applyNear(prev, changes)));
      },
      { rootMargin: `${margin}px 0px` },
    );
    observer.current = obs;
    nodes.current.forEach((el) => obs.observe(el));
    return () => {
      obs.disconnect();
      observer.current = null;
    };
  }, [onPaper]);
  const register = useCallback((key: string, el: HTMLElement | null) => {
    const had = nodes.current.get(key);
    if (had && had !== el) observer.current?.unobserve(had);
    if (el) {
      nodes.current.set(key, el);
      keyOf.current.set(el, key);
      observer.current?.observe(el);
    } else if (had) {
      nodes.current.delete(key);
    }
  }, []);
  const isNear = (key: string) => onPaper || !watching || near.has(key) || key === cur;

  /* Going to a card: it is opened, drawn, scrolled to and handed the focus. */
  const goal = useRef<string | null>(null);
  const domId = useCallback((key: string) => `${uid}-${stepKey(key)}`, [uid]);
  const go = useCallback((key: string) => {
    goal.current = key;
    dispatch({ type: 'go', key });
  }, []);
  useLayoutEffect(() => {
    const key = goal.current;
    if (!key) return;
    const el = document.getElementById(domId(key));
    if (!el) return;
    goal.current = null;
    el.querySelector<HTMLElement>('button')?.focus({ preventScroll: true });
    el.scrollIntoView({ block: 'start' });
  });
  const previous = stepTarget(cur, keys, -1);
  const next = stepTarget(cur, keys, 1);
  const at = cur === null ? -1 : keys.indexOf(cur);
  const label = cur === null ? null : (views[indexOf.get(cur) ?? 0]?.label ?? null);
  const where = positionLine(w.solution, label, at, keys.length);

  const stages = useMemo(() => stagesOf(steps), [steps]);
  const stageTitle = (n: number) => (w.solution.stageTitles as Record<number, string>)[n] ?? String(n);
  const singularKey = all.find((s) => s.id === 'forward-pass' && s.facts.singular === true)?.key ?? null;
  const bands = onPaper ? PAPER_BANDS : null;

  // THE OUTLINE AND THE MENU depend on the steps' keys, numbers and titles - none of which a number typed into the form changes - and they are a hundred and thirty
  // links and options on the largest structure. They are built again only when one of those changes (or the step the reader is at does).
  const outlineKey = steps.map((s) => `${s.key}\t${views[indexOf.get(s.key) ?? 0].label}\t${views[indexOf.get(s.key) ?? 0].title}`).join('\n');
  const outline = useMemo(
    () => (
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
                  aria-current={cur !== null && stage.steps.some((s) => s.key === cur) ? 'step' : undefined}
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
                      const v = views[indexOf.get(s.key) ?? 0];
                      return (
                        <li key={s.key}>
                          <a
                            href={`#${domId(s.key)}`}
                            className="mp-st__chip"
                            aria-label={`${fill(w.solution.stage, { label: v.label })}: ${v.title}`}
                            title={v.title}
                            aria-current={cur === s.key ? 'step' : undefined}
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
    ),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [outlineKey, cur, w, go, domId],
  );
  const jumpOptions = useMemo(
    () =>
      steps.map((s) => {
        const v = views[indexOf.get(s.key) ?? 0];
        return (
          <option key={s.key} value={s.key}>
            {v.label} {v.title}
          </option>
        );
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [outlineKey],
  );

  const radio = (name: string, value: string, text: string, checked: boolean, onChange: () => void) => (
    <label key={value} className="mp-seg__item">
      <input type="radio" name={name} checked={checked} onChange={onChange} />
      <span>{text}</span>
    </label>
  );

  const said = open.said === 'expanded' ? fill(w.solution.expanded, { total: keys.length }) : open.said === 'collapsed' ? w.solution.collapsed : '';

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
            {heavy ? (
              <label className="mp-num mp-num--select mp-st__scope">
                <span className="mp-num__label">{w.solution.printScope}</span>
                <span className="mp-num__box">
                  <select className="mp-num__input" value={scope} onChange={(e) => setScope(e.target.value as PrintScope)}>
                    {SCOPES.map((s) => (
                      <option key={s} value={s}>
                        {w.solution.printScopes[s]}
                      </option>
                    ))}
                  </select>
                </span>
              </label>
            ) : null}
          </div>
          <p className="mp-app__note mp-st__looknote">{w.look.note}</p>
          {closedAtStart > 0 ? <p className="mp-app__note mp-st__long">{fill(w.solution.long, { steps: all.length, cells: groupDigits(weight, group), closed: closedAtStart })}</p> : null}
          {heavy ? <p className="mp-app__note mp-st__printnote">{fill(w.solution.printNote, { count: all.filter((s) => PRINT_SKIPPED.includes(s.id)).length })}</p> : null}

          <div className="mp-st__layout">
            <div className="mp-st__aside">
              {after ? (
                <a className="mp-st__skip" href={`#${after.id}`} onClick={after.go}>
                  {w.jump.skipSteps}
                </a>
              ) : null}
              <div className="mp-st__bar mp-st__bar--steps">
                <button type="button" className="mp-app__btn" onClick={() => previous && go(previous)} disabled={previous === null}>
                  {w.solution.previous}
                </button>
                <button type="button" className="mp-app__btn" onClick={() => next && go(next)} disabled={next === null}>
                  {w.solution.next}
                </button>
              </div>
              <div className="mp-st__bar">
                <button type="button" className="mp-app__btn" onClick={() => dispatch({ type: 'expand' })}>
                  {w.solution.expandAll}
                </button>
                <button type="button" className="mp-app__btn" onClick={() => dispatch({ type: 'collapse' })}>
                  {w.solution.collapseAll}
                </button>
              </div>
              <p className="mp-st__position mp-st__position--aside">{where}</p>
              <p className="mp-st__announce" role="status">
                {said}
              </p>
              {outline}
            </div>
            <div className="mp-st__cards">
              {onPaper && skipped > 0 ? <p className="mp-st__skipped">{fill(w.solution.printSkipped, { count: skipped })}</p> : null}
              {steps.map((s) => {
                const k = indexOf.get(s.key) ?? 0;
                return (
                  <StepCard
                    key={s.key}
                    step={s}
                    view={views[k]}
                    open={isOpen(open, s.key, autos[k], onPaper)}
                    near={isNear(s.key)}
                    onToggle={toggle}
                    ctx={ctx}
                    form={form}
                    zeros={zeros}
                    w={w}
                    bands={bands}
                    domId={domId(s.key)}
                    current={cur === s.key}
                    singular={s.key === singularKey}
                    register={register}
                    heights={heights.current}
                  />
                );
              })}
            </div>
            {/* On a tablet or a phone: the way through the steps stays at the foot of the screen while the cards are read (it comes after them, so that it can). */}
            <div className="mp-st__stepbar" role="group" aria-label={w.solution.stepBar}>
              <p className="mp-st__position">{where}</p>
              <div className="mp-st__stepbar-row">
                <button type="button" className="mp-app__btn" onClick={() => previous && go(previous)} disabled={previous === null} aria-label={w.solution.previous}>
                  {w.solution.previousShort}
                </button>
                <label className="mp-st__jump">
                  <span className="mp-st__sr">{w.solution.jump}</span>
                  <select value={cur ?? ''} onChange={(e) => (e.target.value ? go(e.target.value) : undefined)}>
                    <option value="">{w.solution.jump}</option>
                    {jumpOptions}
                  </select>
                </label>
                <button type="button" className="mp-app__btn" onClick={() => next && go(next)} disabled={next === null} aria-label={w.solution.next}>
                  {w.solution.nextShort}
                </button>
              </div>
            </div>
          </div>
        </>
      ) : null}
    </section>
  );
}
