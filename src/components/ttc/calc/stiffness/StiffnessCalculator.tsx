'use client';

import React, { memo, useCallback, useDeferredValue, useEffect, useId, useMemo, useReducer, useRef, useState } from 'react';
import { flushSync } from 'react-dom';
import { formatNumber } from '@/lib/calc/format';
import { analyseSafely, type AnalysisIssue } from '@/lib/calc/stiffness/analysis';
import {
  LIMITS,
  STIFFNESS_KEY,
  STIFFNESS_UNITS,
  STIFFNESS_US_TO_SI,
  choicesOf,
  decodeStiffness,
  defaultStiffness,
  encodeStiffness,
  reduceStiffness,
  type StiffnessAction,
  type StiffnessForm,
  type StiffnessList,
  type StiffnessMaterial,
} from '@/lib/calc/stiffness/model';
import type { StiffnessShared, StiffnessUi } from '@/lib/calc/stiffness/strings';
import { TEMPLATE_IDS, type TemplateId } from '@/lib/calc/stiffness/templates';
import { Actions } from '../shell/Actions';
import { useAddress } from '../shell/address';
import { select } from '../shell/fields';
import { PAPER_WIDTH, useWidth } from '../shell/layout';
import { SheetStamp, useSheet } from '../shell/sheet';
import { useSteelShapes } from '../shell/steel';
import { FNum } from './FNum';
import { reactionDirection, reactionSymbol } from './headline';
import { drawingFacts, type Looks } from './layout';
import { PIN_START, usePinFit } from './pin-fit';
import { Results } from './Results';
import { LoadRowView, MemberLoadRowView, MemberRowView, NodeRowView, SupportRowView, type RowEnv } from './Rows';
import { anchorFor, scrollTarget } from './print-place';
import { filledLine, keepOpen, settlementOpen } from './rows-state';
import { solutionOf } from './solution-state';
import { FigureGuard, StiffnessSchematic } from './Schematic';
import { Solution } from './Solution';
import { showFor, startShow, type Show } from './show';
import { answerLine, checkTextbook, panelOf, templateMatching, templatePlan, verdictLine } from './textbook';
import { fill, flaggedNodes, focusAddedRow, formToSolve, issueSentence, keepsMarks, largestNode, largestReaction, largestRotation, leaveBehind as leaveBehindWith, noticeText, openWhole, readingSentence, restartsRows, signed, warningSentence, type Fmt } from './text';
import './stiffness.css';

/**
 * STIFFNESS MATRIX, STEP BY STEP - the calculator (/resources/stiffness-matrix).
 *
 * The ninth calculator of the catalogue, and a teaching tool: the visitor enters a small 2D truss or frame and reads the direct stiffness
 * method worked out on the page, every step of it - the numbering of the degrees of freedom, each member's local and global stiffness
 * matrix, the assembly of K member by member, the load vector, the partition, the Gaussian elimination pass by pass, the displacements, the
 * reactions, the member end forces and the checks.
 *
 * As the calculators before it: the form on the left, the drawing and the answer on the right, the tables under both; every keystroke that
 * leaves a number in a field solves the structure again, a moment after the key and not inside it (`solved`, below); the address follows the
 * structure (`#m=...`); nothing leaves the browser; its words are props; it renders on the server with its example. What is the same from
 * one calculator to the next is the shell's (../shell) and the number field (../NumField), used here as they are and not copied.
 *
 * WHAT IS THIS ONE'S. The worked solution (Solution.tsx, steps.ts, table.ts), the drawing with the degrees of freedom numbered
 * (layout.ts, Schematic.tsx) and the textbook problems with a hand answer beside the tool's (textbook.ts).
 *
 * All the arithmetic is in lib/calc/stiffness: `model.ts` (the form, what each edit does to it, the address), `engine.ts` (the method,
 * recorded step by step), `templates.ts`, and `analysis.ts`, which hands this file every number it prints ALREADY SETTLED. This file is the
 * form, the tables and the wiring: it decides nothing about a number.
 *
 * TWO SETS OF WORDS. `t` is the part of the first calculator's that says the same on any calculator (lib/calc/stiffness/strings.ts,
 * `StiffnessShared`). `w` is what is about this tool. Neither file is imported here - both languages would travel with the script.
 *
 * NODES AND MEMBERS ARE SHOWN BY THEIR LABEL, their place in the list from 1; the form holds ids so that deleting a node renumbers the
 * labels after it and nothing else.
 */

/** The example structure, as it is written in an address. */
export const EXAMPLE = encodeStiffness(defaultStiffness());

const Schematic = memo(StiffnessSchematic);

/**
 * What the fragment of an address opens. `undefined`: it is not this calculator's (`#main` is a place on the page; `#f=...` is the frame's).
 * `null`: it is, and cannot be read - its key with nothing after it included.
 */
export function caseIn(hash: string): StiffnessForm | null | undefined {
  const m = hash.match(new RegExp(`^#${STIFFNESS_KEY}=(.*)$`));
  if (!m) return undefined;
  let text = m[1];
  try {
    text = decodeURIComponent(text);
  } catch {
    /* not percent-encoded: read as it is */
  }
  return decodeStiffness(text);
}

/** The issues that are about a node's place and are shown on its row. */
const NODE_CODES = new Set(['duplicate-node', 'node-unconnected', 'duplicate-support']);

const noop = () => undefined;

/** A shape of the steel table in the units shown: A and I, to six figures. */
const shapeValues = (shape: { A: number; Ix: number }, units: StiffnessForm['units']) => ({
  A: Number((units === 'us' ? shape.A : shape.A * STIFFNESS_US_TO_SI.area).toPrecision(6)),
  I: Number((units === 'us' ? shape.Ix : shape.Ix * STIFFNESS_US_TO_SI.inertia).toPrecision(6)),
});

/**
 * `initial`: the structure it opens with, where that is not the example - for the tests, which can neither type nor press.
 */
export function StiffnessCalculator({ t, w, initial }: { t: StiffnessShared; w: StiffnessUi; initial?: StiffnessForm }) {
  const [form, dispatchRaw] = useReducer(reduceStiffness, initial, (given) => given ?? defaultStiffness());
  // The structure last put on screen whole - opened from the address, or the example on "Start over": that one is
  // solved in the render that shows it (`solved`, below), never a moment later under the results of the structure before.
  const [whole, setWhole] = useState<StiffnessForm | null>(null);
  // The problem the visitor picked in the list of textbook problems; none: the list follows the structure on screen (textbook.ts, `panelOf`).
  const [pick, setPick] = useState<TemplateId | 'own' | null>(null);
  // The problem the structure on screen last was: an edit of it leaves the list on that problem (and the panel says the structure now differs from it).
  const [last, setLast] = useState<TemplateId | null>(() => templateMatching(encodeStiffness(initial ?? defaultStiffness()), (initial ?? defaultStiffness()).units));
  // What "Load problem" said it did; gone with the next edit of any kind.
  const [said, setSaid] = useState('');
  // How the drawing is looked at: screen choices, kept while the page is open (not in the address) and across the structures opened (show.ts).
  const [show, setShow] = useState<Show>(() => startShow(initial ?? defaultStiffness()));
  // Which supports show their settlement fields, and the shape picker.
  const [more, setMore] = useState<ReadonlySet<number>>(() => new Set());
  const [picking, setPicking] = useState(false);
  const [target, setTarget] = useState<'structure' | number>('structure');
  const [chosen, setChosen] = useState('');
  const [filled, setFilled] = useState('');
  // Counts the structures put in place of one another: the worked solution goes back to its first state at each.
  const [epoch, setEpoch] = useState(0);
  const uid = useId();
  const drawingId = `${uid}drawing`;
  const resultsId = `${uid}results`;
  const stepsId = `${uid}steps`;
  const formId = `${uid}form`;
  const afterId = `${uid}after`;
  // The calculator itself: a structure opened from the address asks whether the focus is in one of its fields.
  const root = useRef<HTMLDivElement>(null);
  const [plotRef, windowWidth] = useWidth<HTMLDivElement>();
  // Only the drawing and the sentence that reads it stay in view while the form is filled in; the rest of the answer scrolls with the page. The drawing is
  // made as tall as the window leaves room for (pin-fit.ts), and the sentence leaves the pin where the window is too short for both.
  const pinRef = useRef<HTMLDivElement>(null);
  const sayingRef = useRef<HTMLDivElement>(null);
  const u = STIFFNESS_UNITS[form.units];
  const group = t.numbers.group;
  const frame = form.mode === 'frame';

  // Any edit but a number typed into a field takes back the line "Load problem" said.
  const dispatch = useCallback((action: StiffnessAction) => {
    setSaid('');
    setFilled('');
    // A support's id is only its own within one structure: a template, a start over or an opened link numbers its rows from 1 again.
    if (restartsRows(action.type)) {
      setMore(new Set());
      setEpoch((e) => e + 1);
    }
    if (!keepsMarks(action.type)) setTarget('structure');
    dispatchRaw(action);
  }, []);

  // THE ADDRESS FOLLOWS THE STRUCTURE (../shell/address.ts).
  const code = useCallback(() => encodeStiffness(form), [form]);
  const address = useAddress<StiffnessForm>({
    key: STIFFNESS_KEY,
    example: EXAMPLE,
    code,
    read: caseIn,
    blank: defaultStiffness,
    // A structure in the address opens as that structure.
    open: (found) =>
      // An edit in progress is an edit of the structure before, and ends here. The field with the focus is left FIRST:
      // it would go on showing what was typed into that structure, and fall back on that structure's value at the first key
      // that is not a number (NumField).
      openWhole(found, {
        blur: () => {
          const focused = document.activeElement;
          if (focused instanceof HTMLInputElement && root.current?.contains(focused)) focused.blur();
        },
        load: (opened) => {
          dispatch({ type: 'load', form: opened });
          setShow((s) => showFor(opened, s));
        },
        remember: setWhole,
        template: () => {
          setPick(null);
          setLast(null);
        },
      }),
  });
  const { linkError } = address;
  // PRINTING KEEPS THE READER'S PLACE. The sheet is a different page (every card open, the drawings at the sheet's size) and the screen comes back
  // shorter: the card nearest the top of the screen is remembered before the sheet is made (this listener comes before the sheet's), and put back at the top after.
  useEffect(() => {
    let kept: { el: Element; offset: number } | null = null;
    const before = () => {
      const marks = [...(root.current?.querySelectorAll('.mp-st__card, .mp-st__target, .mp-app__form') ?? [])];
      const found = anchorFor(marks.map((el) => el.getBoundingClientRect().top));
      kept = found ? { el: marks[found.index], offset: found.offset } : null;
    };
    const after = () => {
      const back = () => {
        if (kept) window.scrollTo({ top: scrollTarget(window.scrollY, kept.el.getBoundingClientRect().top, kept.offset) });
      };
      // The sheet is taken down by a render of its own, and the cards drawn near the screen after it: put back twice.
      window.setTimeout(back, 60);
      window.setTimeout(back, 500);
    };
    window.addEventListener('beforeprint', before);
    window.addEventListener('afterprint', after);
    return () => {
      window.removeEventListener('beforeprint', before);
      window.removeEventListener('afterprint', after);
    };
  }, []);
  // The printed sheet gives the address that opens this very structure, and while it prints the drawings are the sheet's size.
  const { stamp, onPaper } = useSheet({ locale: t.sheet.locale, url: () => address.link(encodeStiffness(form)) });
  const width = onPaper ? PAPER_WIDTH : windowWidth;

  // WHICH STRUCTURE IS SOLVED. A structure of twelve nodes and twenty members is some tens of milliseconds of arithmetic on a desktop and
  // several times that on a phone, and inside the keystroke that kept the key off the screen for as long. So while only NUMBERS
  // change, the answer is of the form as it was a moment ago (`useDeferredValue`): the key shows at once, and the structure is solved in
  // a render of its own, which the next key may interrupt. The results say so while they are behind (`aria-busy`). Anything else -
  // the units, the mode, a row added or removed, a restraint ticked, a member moved to another node, a structure opened whole - is solved in
  // the same render as ever: the answer must never stand under other units, beside rows it was not solved for, or under a structure it is
  // not of. And on paper it is the form itself: a sheet is never printed with the answer of the structure before.
  const behind = useDeferredValue(form);
  const solved = formToSolve({ form, behind, whole, onPaper, choices: choicesOf });
  const catching = solved !== form;

  // Everything the page prints (lib/calc/stiffness/analysis.ts) - through the door that never throws.
  const a = useMemo(() => analyseSafely(solved), [solved]);
  const r = a.results;
  const ru = a.units;
  // The worked solution is the heaviest thing on the page: it is drawn in a render of its own, after the form, the drawing and the answer.
  const deferredAnalysis = useDeferredValue(a);
  const solutionShown = solutionOf({ fresh: a, deferred: deferredAnalysis, onPaper });
  const flagged = useMemo(() => flaggedNodes(a), [a]);

  // Every number this page prints in a sentence, with the page's own mark between thousands and a true minus.
  const fmt: Fmt = useMemo(
    () => ({
      num: (v, sig = 4) => formatNumber(v, sig, group).replace(/^-/, '−'),
      val: (v, sig = 4) => signed(formatNumber(Math.abs(v), sig, group), v),
    }),
    [group],
  );
  const { num, val } = fmt;

  // The looks of the drawing.
  const looks: Looks = useMemo(
    () => ({
      loads: show.loads,
      reactions: show.reactions && r !== null,
      deformed: show.deformed && r !== null,
      dofs: show.dofs,
      nodeNumbers: show.nodeNumbers,
      memberNumbers: show.memberNumbers,
      values: show.values,
      group,
      flagged,
    }),
    [r, show.loads, show.reactions, show.deformed, show.dofs, show.nodeNumbers, show.memberNumbers, show.values, group, flagged],
  );
  // How many words the drawing on screen leaves off: told by the figure when it has been drawn (it is drawn a moment after the key). Whether
  // widening the drawing would put them on is a search over widths, asked for a moment after the last key and not inside it.
  const [omittedNow, setOmitted] = useState(0);
  const omitted = onPaper ? 0 : omittedNow;
  const [everyOk, setEveryOk] = useState<boolean | null>(null);
  useEffect(() => {
    if (onPaper || omitted === 0) {
      setEveryOk(null);
      return;
    }
    const timer = setTimeout(() => {
      try {
        setEveryOk(drawingFacts(a.drawing, looks, width).every);
      } catch {
        setEveryOk(false);
      }
    }, 250);
    return () => clearTimeout(timer);
  }, [a.drawing, looks, width, onPaper, omitted]);
  const facts = { omitted, every: omitted > 0 && everyOk !== false };
  // Ticking "Show every word" on a large structure is a search over widths that takes seconds: the drawing says so on screen (Schematic.tsx), and the page tells it
  // to a screen reader until the drawing it makes arrives.
  const [widening, setWidening] = useState(false);
  // What the figure drew that the sentence under it must follow: the nodes it drew as dots, and whether it drew loads and reactions.
  const [facts2, setDrawnFacts] = useState<{ dots: readonly number[]; loads: boolean; reactions: boolean } | null>(null);
  const arrived = useCallback((count: number, seen?: { dots: readonly number[]; loads: boolean; reactions: boolean }) => {
    setOmitted(count);
    setWidening(false);
    if (seen) setDrawnFacts((was) => (was && was.loads === seen.loads && was.reactions === seen.reactions && was.dots.length === seen.dots.length && was.dots.every((d, k) => d === seen.dots[k]) ? was : { dots: seen.dots, loads: seen.loads, reactions: seen.reactions }));
  }, []);
  useEffect(() => {
    if (!widening) return;
    const timer = window.setTimeout(() => setWidening(false), 20_000);
    return () => window.clearTimeout(timer);
  }, [widening]);

  /* -- The faults, by row -- */
  const listName: Record<StiffnessList, string> = { nodes: w.nodes.name, members: w.members.name, supports: w.supports.name, loads: w.loads.name, memberLoads: w.memberLoads.name };
  const says = (issue: AnalysisIssue, where = false): string => {
    const text = issueSentence(issue, w, { number: (v) => num(v, 3), unit: u.length, mode: form.mode });
    if (!where || !issue.row) return text;
    return `${issue.row.list === 'model' ? t.section.title : `${listName[issue.row.list]} ${issue.at ?? ''}`.trim()}: ${text}`;
  };
  // The faults of one row of a list: those that name it, and for a node or a member those that name its label.
  const issuesOf = (list: StiffnessList, id: number): AnalysisIssue[] => {
    const label = list === 'nodes' ? solved.nodes.findIndex((n) => n.id === id) + 1 : list === 'members' ? solved.members.findIndex((m) => m.id === id) + 1 : 0;
    return a.issues.filter((i) => (i.row && i.row.list === list && i.row.id === id) || (list === 'nodes' && NODE_CODES.has(i.code) && !i.row && i.nodes?.includes(label)) || (list === 'members' && i.code === 'duplicate-member' && i.members?.includes(label)));
  };
  const sectionIssues = (field: 'E' | 'A' | 'I') => a.issues.filter((i) => (i.row?.list === 'model' && i.row.field === field) || (i.code === 'section-missing' && form[field] === null && i.row?.field === field));
  const idOf = (key: string) => `${uid}${key}`;
  const sectionFault = (field: 'E' | 'A' | 'I') => (sectionIssues(field).length ? { invalid: true, describedBy: idOf('modelsection') } : {});
  const rowIssue = (key: string, issues: AnalysisIssue[]) => {
    const texts = [...new Set(issues.map((i) => says(i)))];
    return texts.length ? (
      <p className="mp-app__row-error" id={idOf(key)}>
        {texts.join(' ')}
      </p>
    ) : null;
  };
  // What the results box says, each thing once. Nodes that no member reaches are one problem, said once.
  const loose = a.issues.filter((i) => i.code === 'node-unconnected');
  const listed: AnalysisIssue[] = loose.length > 1 ? [{ code: 'node-unconnected', nodes: loose.flatMap((i) => i.nodes ?? []) }, ...a.issues.filter((i) => i.code !== 'node-unconnected')] : a.issues;
  const notices = listed.map((i) => ({ text: says(i, true) })).filter((n, i, all) => all.findIndex((m) => m.text === n.text) === i);
  const formatIt = (v: number) => num(v, 6);

  /* -- The rows of the form -- */
  // A row added WITH THE KEYBOARD is handed the focus, in its first field. The row is put on screen first (`flushSync`).
  const addRow = (list: StiffnessList) => (press: React.MouseEvent<HTMLButtonElement>) => {
    if (press.detail !== 0) {
      dispatch({ type: 'add', list });
      return;
    }
    const fieldset = press.currentTarget.closest('fieldset');
    const before = fieldset?.querySelectorAll('.mp-app__item').length ?? 0;
    flushSync(() => dispatch({ type: 'add', list }));
    // Only a row that was added is handed the focus. An "add" that had nothing to add leaves it on the button, and says why.
    focusAddedRow(fieldset, before);
  };
  // A list at its limit: the button stays where it is and does nothing, and the limit is a line of the page under it.
  const limitLine = (list: StiffnessList) => fill(w.limit, { max: LIMITS[list], list: w.lists[list] });
  const addButton = (list: StiffnessList, label: string) => {
    const full = form[list].length >= LIMITS[list];
    const limited = full || (form.notice?.code === 'limit' && form.notice.list === list);
    return (
      <>
        <button type="button" className="mp-app__add" onClick={full ? undefined : addRow(list)} aria-disabled={full || undefined} aria-describedby={limited ? `${uid}${list}limit` : undefined}>
          <span aria-hidden="true">+</span> {label}
        </button>
        <p className="mp-st__limit" id={`${uid}${list}limit`} role="status">
          {limited ? limitLine(list) : ''}
        </p>
      </>
    );
  };

  // The rows of the five tables are components of their own (Rows.tsx), made again only when the row they are of changes.
  const nodeKey = form.nodes.map((n) => n.id).join(',');
  const memberKey = form.members.map((m) => m.id).join(',');
  const nodeOptions = useMemo(
    () =>
      nodeKey === ''
        ? null
        : nodeKey.split(',').map((id, k) => (
            <option key={id} value={id}>
              {k + 1}
            </option>
          )),
    [nodeKey],
  );
  const memberOptions = useMemo(
    () =>
      memberKey === ''
        ? null
        : memberKey.split(',').map((id, k) => (
            <option key={id} value={id}>
              {k + 1}
            </option>
          )),
    [memberKey],
  );
  const patch = useCallback(
    (list: StiffnessList, id: number, p: Record<string, unknown>) => {
      // A settlement being typed keeps its fields open until the visitor closes them: a value on its way through 0 ("0", then "0.25") must not close
      // the row under the cursor (the fields are open by themselves only while there is a settlement).
      setMore((prev) => keepOpen(prev, list, id, p));
      dispatch({ type: 'patch', list, id, patch: p });
    },
    [dispatch],
  );
  // A row removed WITH THE KEYBOARD took the focus away with it, and the browser left it on nothing. It is given to the first control of the row
  // that takes the place - the next one, else the one before - or to the group's "add" button when no row is left. Not after a click or a tap.
  const removeRow = useCallback(
    (list: StiffnessList, id: number) => (press: React.MouseEvent<HTMLButtonElement>) => {
      const row = press.currentTarget.closest('.mp-app__item');
      const near = [row?.nextElementSibling, row?.previousElementSibling].find((el) => el?.classList.contains('mp-app__item'));
      const next = press.detail === 0 ? (near?.querySelector<HTMLElement>('input, select') ?? press.currentTarget.closest('fieldset')?.querySelector<HTMLElement>('.mp-app__add')) : null;
      dispatch({ type: 'remove', list, id });
      next?.focus();
    },
    [dispatch],
  );
  const rowEnv: RowEnv = useMemo(
    () => ({ t, w, u, mode: form.mode, uid, format: formatIt, nodeOptions, memberOptions, patch, remove: removeRow, listName }),
    // `formatIt` follows the number format, which follows the page's group mark.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [t, w, u, form.mode, uid, group, nodeOptions, memberOptions, patch, removeRow],
  );
  const toggleMore = useCallback(
    (id: number) =>
      setMore((prev) => {
        const next = new Set(prev);
        if (next.has(id)) next.delete(id);
        else next.add(id);
        return next;
      }),
    [],
  );
  // An optional number: an empty field is "not given" (null), which the field knows as a value that is not a number.
  const optionalNumber = (value: number | null) => value ?? Number.NaN;
  const fromField = (v: number) => (Number.isNaN(v) ? null : v);
  // A number of the section group (the rows of the tables are Rows.tsx's).
  const field = (label: string, unit: string | undefined, value: number, onChange: (v: number) => void, extra: { invalid?: boolean; describedBy?: string } = {}) => (
    <FNum numbers={t.numbers} words={w.fieldWords} format={formatIt} label={label} unit={unit} value={value} onChange={onChange} {...extra} />
  );
  // What goes with a row: the faults that name it, and the sentence of each.
  const rowProps = (list: StiffnessList, id: number, index: number) => {
    const issues = issuesOf(list, id);
    return { env: rowEnv, index: index + 1, issues, texts: [...new Set(issues.map((i) => says(i)))] };
  };

  /* -- The notices of the form -- */
  const notice = noticeText(form.notice, w);
  // A line that tells what just happened is on the page before it has anything to say, so that a screen reader hears it arrive.
  const status = (where: StiffnessList, className: string) => (
    <p className={className} role="status">
      {notice?.where === where && form.notice?.code !== 'limit' ? notice.text : ''}
    </p>
  );

  /* -- The textbook problems -- */
  // The hand answer and the tool's line are about the PROBLEM, and they are shown only while the structure on screen is that problem as it loads (textbook.ts).
  const formCode = useMemo(() => encodeStiffness(form), [form]);
  const matched = templateMatching(formCode, form.units);
  if (matched !== null && matched !== last) setLast(matched);
  const panel = panelOf({ code: formCode, units: form.units, pick, last });
  const selected = panel.selected;
  const check = useMemo(() => (selected ? checkTextbook(selected, form.units) : null), [selected, form.units]);
  const answerOf = (values: Record<string, number>): string => (selected ? answerLine(w, selected, values, { force: u.force, moment: u.moment, displacement: u.displacement }, num) : '');
  const applyTemplate = () => {
    if (!selected) return;
    // A structure that replaces the one before is put on screen WHOLE (the same object as `whole`): it is solved in the render that shows it, never a
    // moment later under the results of the structure before - which a problem loaded over a copy of itself with other numbers used to be.
    const plan = templatePlan(form, selected);
    const built = plan.whole;
    const left = leaveBehind(built);
    dispatch(plan.action);
    setWhole(plan.whole);
    setPick(selected);
    setShow((s) => showFor(built, s));
    setSaid(
      [
        fill(w.template.done, { template: w.template.names[selected], nodes: built.nodes.length, members: built.members.length, supports: built.supports.length, loads: built.loads.length, memberLoads: built.memberLoads.length }),
        left ? w.template.back : '',
      ]
        .filter(Boolean)
        .join(' '),
    );
  };
  // A structure that is about to be thrown away - by "Start over" or by "Load problem" - is left one step behind in the browser's history,
  // so that Back brings it back. The address is brought to that structure first: the entry left behind is the one on screen.
  const leaveBehind = (next: StiffnessForm) =>
    leaveBehindWith(form, next, EXAMPLE, {
      take: address.take,
      push: () => {
        try {
          window.history.pushState(window.history.state, '', window.location.href);
        } catch {
          /* the way back is a convenience; the calculator works without it */
        }
      },
    });

  /* -- The section: a shape from the shell's table -- */
  const steel = useSteelShapes({ wanted: picking, name: '', onName: noop });
  const chosenShape = steel.shapes ? (steel.shapes.find((s) => s.designation === chosen) ?? steel.filtered[0] ?? null) : null;
  const shown = chosenShape ? shapeValues(chosenShape, form.units) : null;
  const useShape = () => {
    if (!chosenShape || !shown) return;
    if (target === 'structure') dispatch({ type: 'section', patch: frame ? { A: shown.A, I: shown.I } : { A: shown.A } });
    else dispatch({ type: 'patch', list: 'members', id: target, patch: frame ? { A: shown.A, I: shown.I } : { A: shown.A } });
    setFilled(filledLine(w, chosenShape.designation, target === 'structure' ? 'structure' : form.members.findIndex((m) => m.id === target) + 1));
  };

  /* -- The drawing in words -- */
  const drawn = { deformed: looks.deformed, nodeNumbers: show.nodeNumbers, ...(facts2 && !onPaper ? { dots: facts2.dots, loads: facts2.loads, reactions: facts2.reactions } : { reactions: looks.reactions, loads: looks.loads }) };
  const reading = readingSentence(a, drawn, w, { ...fmt, mode: form.mode });
  // How far each support that settles moves: said in a line under the drawing (the badge on the drawing says which support).
  const settleLine = (() => {
    const parts = a.drawing.supports.flatMap((s) => {
      if (!s.settle) return [];
      const bits = [s.settle.dx !== 0 ? `x ${val(s.settle.dx, 3)} ${ru.displacement}` : '', s.settle.dy !== 0 ? `y ${val(s.settle.dy, 3)} ${ru.displacement}` : '', s.settle.dr !== 0 ? `${val(s.settle.dr, 3)} rad` : ''].filter(Boolean);
      return [fill(w.drawing.notes.settlement, { n: s.node, parts: bits.join(', ') })];
    });
    return parts.length ? fill(w.drawing.notes.settlements, { list: parts.join('; ') }) : '';
  })();
  // The drawing is as tall as the window leaves room for; on paper it is the sheet's.
  const fit = usePinFit({ pin: pinRef, saying: sayingRef }, a.drawing, onPaper);
  const fitted = onPaper ? PIN_START : fit;
  // What reads the drawing: the sentence, the line about a settlement, the line that waits. It stays in the pin, or - where the window is too short for both - under it.
  const saying = (
    <div className="mp-st__says" ref={sayingRef}>
      {reading ? (
        <p id={idOf('reading')} className="mp-st__reading">
          {reading}
        </p>
      ) : null}
      {settleLine ? <p className="mp-st__reading mp-st__settle">{settleLine}</p> : null}
      {r ? null : <p className="mp-app__need">{w.results.waiting}</p>}
    </div>
  );
  const summary = a.drawing.nodes.length === 0 ? w.drawing.summary.empty : fill(w.drawing.summary.structure, { nodes: solved.nodes.length, members: solved.members.length, supports: solved.supports.length, loads: solved.loads.length, memberLoads: solved.memberLoads.length });
  // A link that goes to a place on this page and leaves the address alone (a fragment would replace the structure in it).
  const goTo = (id: string) => (e: React.MouseEvent<HTMLAnchorElement>) => {
    const el = document.getElementById(id);
    if (!el) return;
    e.preventDefault();
    el.focus({ preventScroll: true });
    el.scrollIntoView({ block: 'start' });
  };

  const degree = a.determinacy.degree;
  const word = a.determinacy.word;
  const farthest = largestNode(a);
  const turning = farthest ? null : largestRotation(a);
  const biggest = largestReaction(a);
  const biggestWay = biggest ? reactionDirection(r?.reactions ?? [], biggest) : null;
  const members = r?.members ?? [];
  const topForce = frame ? null : members.reduce<{ member: number; value: number } | null>((best, m) => (m.bar && Math.abs(m.bar.N) > Math.abs(best?.value ?? 0) ? { member: m.label, value: m.bar.N } : best), null);
  const topMoment = frame
    ? members.reduce<{ member: number; value: number } | null>((best, m) => {
        const big = Math.abs(m.start.M) >= Math.abs(m.end.M) ? m.start.M : m.end.M;
        return Math.abs(big) > Math.abs(best?.value ?? 0) ? { member: m.label, value: big } : best;
      }, null)
    : null;

  // The box of notices: mounted before it has anything to say.
  const box = (
    <div className="mp-app__issues" role="status" aria-live="polite">
      {notices.length ? (
        <>
          <p className="mp-app__issues-title">{w.issuesTitle}</p>
          <ul>
            {notices.map((n) => (
              <li key={n.text}>{n.text}</li>
            ))}
          </ul>
        </>
      ) : linkError ? (
        <p className="mp-app__issues-title">{w.linkError}</p>
      ) : null}
    </div>
  );

  const words = useMemo(() => ({ legend: w.drawing.legend, notes: w.drawing.notes, broken: w.drawing.broken }), [w]);
  const figureUnits = useMemo(() => ({ length: ru.length, displacement: ru.displacement }), [ru.length, ru.displacement]);
  const paperLooks = (rest: Partial<Looks>): Looks => ({ ...looks, values: true, nodeNumbers: true, memberNumbers: true, ...rest });
  const check1 = (key: Exclude<keyof Show, 'few'>, label: string) => (
    <label key={key} className="mp-app__check">
      <input
        type="checkbox"
        checked={show[key]}
        onChange={(e) => {
          if (key === 'every') setWidening(e.target.checked);
          setShow({ ...show, [key]: e.target.checked });
        }}
      />
      <span>{label}</span>
    </label>
  );

  return (
    <div className={onPaper ? 'mp-app mp-st mp-st--sheet' : 'mp-app mp-st'} ref={root}>
      <nav className="mp-st__jumps" aria-label={w.jump.label}>
        <a href={`#${drawingId}`} onClick={goTo(drawingId)}>
          {w.jump.drawing}
        </a>
        {r ? (
          <a href={`#${resultsId}`} onClick={goTo(resultsId)}>
            {w.jump.results}
          </a>
        ) : null}
        <a href={`#${stepsId}`} onClick={goTo(stepsId)}>
          {w.jump.steps}
        </a>
      </nav>
      <div className="mp-app__top">
        {/* -- the form -- */}
        <form className="mp-app__form mp-st__target" id={formId} tabIndex={-1} onSubmit={(e) => e.preventDefault()} noValidate>
          <div className="mp-app__bar">
            <fieldset className="mp-seg">
              <legend className="mp-num__label">{w.toolbar.mode}</legend>
              {(['truss', 'frame'] as const).map((mode) => (
                <label key={mode} className="mp-seg__item">
                  <input type="radio" name={`${uid}mode`} checked={form.mode === mode} onChange={() => dispatch({ type: 'mode', mode })} />
                  <span>{w.toolbar.modes[mode]}</span>
                </label>
              ))}
            </fieldset>
            <fieldset className="mp-seg">
              <legend className="mp-num__label">{t.toolbar.units}</legend>
              {(['us', 'si'] as const).map((unit) => (
                <label key={unit} className="mp-seg__item">
                  <input type="radio" name={`${uid}units`} checked={form.units === unit} onChange={() => dispatch({ type: 'units', units: unit })} />
                  <span>{w.toolbar[unit]}</span>
                </label>
              ))}
            </fieldset>
          </div>
          <p className="mp-app__note mp-st__modenote">{w.modeNote[form.mode]}</p>

          {/* A starting point, not part of the case: it is not printed. */}
          <fieldset className="mp-app__group mp-st__template">
            <legend>{w.template.title}</legend>
            {select<TemplateId | ''>(
              w.template.pick,
              selected ?? '',
              [['', w.template.own], ...TEMPLATE_IDS.map((id) => [id, w.template.names[id]] as [TemplateId, string])],
              (v) => setPick(v === '' ? 'own' : v),
            )}
            {panel.kind === 'compare' && check ? (
              <>
                <p className="mp-app__computed mp-st__answer">{fill(w.template.answer, { answer: answerOf(check.expected) })}</p>
                <p className="mp-app__computed mp-st__answer">{check.got ? fill(w.template.got, { answer: answerOf(check.got) }) : w.template.unsolved}</p>
                <p className="mp-app__note mp-st__verdict" data-agrees={check.agrees ? 'true' : 'false'}>
                  {verdictLine(w, check, group)}
                </p>
              </>
            ) : (
              <p className="mp-app__note mp-st__neutral">{panel.kind === 'differs' ? w.template.differsFromBook : w.template.pickOne}</p>
            )}
            <button type="button" className="mp-app__btn" onClick={applyTemplate} disabled={selected === null}>
              {w.template.apply}
            </button>
            <p className="mp-app__computed mp-st__said" role="status">
              {said}
            </p>
            <p className="mp-app__note">{w.template.note}</p>
          </fieldset>

          <fieldset className="mp-app__group">
            <legend>{w.nodes.title}</legend>
            <p className="mp-app__note">{w.nodes.note}</p>
            {form.nodes.length === 0 ? <p className="mp-app__none">{w.empty.nodes}</p> : null}
            {form.nodes.map((n, i) => (
              <NodeRowView key={n.id} {...rowProps('nodes', n.id, i)} row={n} />
            ))}
            {addButton('nodes', w.nodes.add)}
            {status('nodes', 'mp-st__notice')}
          </fieldset>

          <fieldset className="mp-app__group">
            <legend>{w.members.title}</legend>
            <p className="mp-app__note">{w.members.note}</p>
            {form.members.length === 0 ? <p className="mp-app__none">{w.empty.members}</p> : null}
            {form.members.map((m, i) => (
              <MemberRowView key={m.id} {...rowProps('members', m.id, i)} row={m} />
            ))}
            {addButton('members', w.members.add)}
            {status('members', 'mp-st__notice')}
          </fieldset>

          <fieldset className="mp-app__group">
            <legend>{t.supports.title}</legend>
            <p className="mp-app__note">{w.supports.note}</p>
            {form.supports.length === 0 ? <p className="mp-app__none">{w.empty.supports}</p> : null}
            {form.supports.map((s, i) => {
              const { open, forced } = settlementOpen(more, s, frame);
              return <SupportRowView key={s.id} {...rowProps('supports', s.id, i)} row={s} open={open} forced={forced} toggle={toggleMore} nodeLabel={form.nodes.findIndex((n) => n.id === s.node) + 1} />;
            })}
            {addButton('supports', w.supports.add)}
            {status('supports', 'mp-st__notice')}
          </fieldset>

          <fieldset className="mp-app__group">
            <legend>{w.loads.title}</legend>
            <p className="mp-app__note">{w.loads.note}</p>
            {form.loads.length === 0 ? <p className="mp-app__none">{w.empty.loads}</p> : null}
            {form.loads.map((l, i) => (
              <LoadRowView key={l.id} {...rowProps('loads', l.id, i)} row={l} />
            ))}
            {addButton('loads', w.loads.add)}
            {status('loads', 'mp-st__notice')}
          </fieldset>

          {frame || form.memberLoads.length > 0 ? (
            <fieldset className="mp-app__group">
              <legend>{w.memberLoads.title}</legend>
              <p className="mp-app__note">{frame ? w.memberLoads.note : w.memberLoads.trussNote}</p>
              {form.memberLoads.length === 0 ? <p className="mp-app__none">{w.empty.memberLoads}</p> : null}
              {form.memberLoads.map((l, i) => (
                <MemberLoadRowView key={l.id} {...rowProps('memberLoads', l.id, i)} row={l} />
              ))}
              {frame ? addButton('memberLoads', w.memberLoads.add) : null}
              {status('memberLoads', 'mp-st__notice')}
            </fieldset>
          ) : null}

          <fieldset className="mp-app__group">
            <legend>{t.section.title}</legend>
            <p className="mp-app__note">{w.section.note}</p>
            <div className="mp-app__row mp-app__row--two mp-st__material">
              {select<StiffnessMaterial>(
                t.section.material,
                form.material,
                [
                  ['steel', t.section.materials.steel],
                  ['aluminum', t.section.materials.aluminum],
                  ['custom', t.section.materials.custom],
                ],
                (material) => dispatch({ type: 'material', material }),
              )}
              {field(t.section.E, u.E, optionalNumber(form.E), (E) => dispatch({ type: 'section', patch: { E: fromField(E) } }), sectionFault('E'))}
            </div>
            <div className="mp-app__row mp-app__row--two">
              {field(w.section.A, u.area, optionalNumber(form.A), (A) => dispatch({ type: 'section', patch: { A: fromField(A) } }), sectionFault('A'))}
              {frame ? field(w.section.I, u.inertia, optionalNumber(form.I), (I) => dispatch({ type: 'section', patch: { I: fromField(I) } }), sectionFault('I')) : null}
            </div>
            {rowIssue('modelsection', [...new Set(['E', 'A', 'I'].flatMap((fld) => sectionIssues(fld as 'E' | 'A' | 'I')))])}
            <p className="mp-app__note">{w.section.typicalMaterial}</p>

            {/* A shape from the steel table: fetched the first time it is wanted, the failure said. */}
            {picking ? (
              <div className="mp-st__shapes">
                <p className="mp-st__subtitle">{w.section.steelTitle}</p>
                {steel.shapes ? (
                  <>
                    <div className="mp-app__row mp-app__row--two">
                      <label className="mp-num mp-num--filter">
                        <span className="mp-num__label">{t.section.filter}</span>
                        <span className="mp-num__box">
                          <input className="mp-num__input" type="text" value={steel.filter} onChange={(e) => steel.setFilter(e.target.value)} placeholder={t.section.filterHint} autoComplete="off" spellCheck={false} />
                        </span>
                      </label>
                      <label className="mp-num mp-num--select">
                        <span className="mp-num__label">{t.section.shape}</span>
                        <span className="mp-num__box">
                          <select className="mp-num__input" value={chosenShape?.designation ?? ''} onChange={(e) => setChosen(e.target.value)}>
                            {chosenShape && !steel.filtered.includes(chosenShape) ? <option value={chosenShape.designation}>{chosenShape.designation}</option> : null}
                            {steel.filtered.map((s) => (
                              <option key={s.designation} value={s.designation}>
                                {s.designation}
                              </option>
                            ))}
                          </select>
                        </span>
                      </label>
                    </div>
                    {steel.filtered.length === 0 ? <p className="mp-app__none">{t.section.noMatch}</p> : null}
                    <div className="mp-app__row mp-app__row--two">
                      <label className="mp-num mp-num--select">
                        <span className="mp-num__label">{w.section.applyTo}</span>
                        <span className="mp-num__box">
                          <select className="mp-num__input" value={target} onChange={(e) => setTarget(e.target.value === 'structure' ? 'structure' : Number(e.target.value))}>
                            <option value="structure">{w.section.structureTarget}</option>
                            {form.members.map((m, k) => (
                              <option key={m.id} value={m.id}>
                                {fill(w.section.memberTarget, { member: k + 1 })}
                              </option>
                            ))}
                          </select>
                        </span>
                      </label>
                    </div>
                    {chosenShape && shown ? (
                      <p className="mp-app__computed">{fill(frame ? w.section.values : w.section.valuesBar, { shape: chosenShape.designation, A: num(shown.A, 6), I: num(shown.I, 6), areaUnit: u.area, inertiaUnit: u.inertia })}</p>
                    ) : null}
                    <button type="button" className="mp-app__btn" disabled={!chosenShape} onClick={useShape}>
                      {w.section.use}
                    </button>
                    <p className="mp-app__note">{w.section.typical}</p>
                  </>
                ) : (
                  <>
                    <p className="mp-app__none">{steel.failed ? t.section.loadFailed : t.section.loading}</p>
                    {steel.failed ? (
                      <button
                        type="button"
                        className="mp-app__btn"
                        onClick={() => {
                          // The case is in the address: the page comes back to it.
                          address.flush();
                          window.location.reload();
                        }}
                      >
                        {t.section.reload}
                      </button>
                    ) : null}
                  </>
                )}
              </div>
            ) : (
              <button type="button" className="mp-app__btn mp-app__btn--quiet mp-st__shape-open" onClick={() => setPicking(true)}>
                {w.section.steelTitle}
              </button>
            )}
            {/* Mounted with the group, empty: the table's arrival, its failure and the shape put in are announced when they fill it. */}
            <p className="mp-st__filled" role="status">
              {filled || (picking && !steel.shapes ? (steel.failed ? t.section.loadFailed : t.section.loading) : '')}
            </p>
          </fieldset>

          <Actions
            t={{ ...t.toolbar, copy: w.toolbar.copy }}
            copy={() => {
              // The address is brought to this structure too, and a link that could not be read has nothing left to say:
              // the one copied is the structure on screen.
              address.take(encodeStiffness(form));
              return address.link(encodeStiffness(form));
            }}
            reset={() => {
              // One press throws away whatever was typed, and nothing is asked. So the structure that goes - unless it is the
              // example - is left one step behind in the browser's history: Back brings it back, as the page opens any
              // structure its address holds (../shell/address.ts), and Forward returns to the example.
              const example = defaultStiffness();
              const left = leaveBehind(example);
              dispatch({ type: 'load', form: example });
              // Where the way back is said (the line under "Load problem").
              if (left) setSaid(w.template.back);
              setWhole(example);
              setPick(null);
              setLast(null);
              setShow(startShow(example));
              // The address goes bare - if what is after the # is a structure.
              address.take(EXAMPLE);
            }}
          />
        </form>

        {/* -- the answer -- */}
        <section className="mp-app__out mp-st__out" aria-label={t.results.title} aria-busy={catching ? true : undefined}>
          {box}

          {/* Mounted before it has anything to say, so that a reader who cannot see it is told when it fills. */}
          <div className="mp-st__warnings" role="status" data-empty={a.warnings.length ? undefined : 'true'}>
            {a.warnings.length ? (
              <>
                <p className="mp-app__issues-title">{w.warningsTitle}</p>
                <ul>
                  {a.warnings.map((x) => (
                    <li key={x.code}>{warningSentence(x, w, { mode: form.mode })}</li>
                  ))}
                </ul>
              </>
            ) : null}
          </div>

          {word ? (
            <div className={`mp-st__status mp-st__status--${word}`} data-word={word}>
              <p className="mp-st__word">{fill(w.results.determinacy[word].title, { degree })}</p>
              <p className="mp-app__computed">
                {w.results.determinacy[form.mode]}{' '}
                {fill(form.mode === 'frame' ? w.results.determinacy.countsFrame : w.results.determinacy.countsTruss, {
                  members: a.determinacy.members,
                  reactions: a.determinacy.reactions,
                  joints: a.determinacy.joints,
                  degree: degree < 0 ? `−${-degree}` : degree,
                })}
              </p>
              <p className="mp-app__note">
                {w.results.determinacy[word].note} {w.results.determinacy.legend}.
              </p>
            </div>
          ) : null}

          {r ? (
            <dl className="mp-app__dl mp-st__largest">
              <div>
                <dt>{w.results.headline.displacement}</dt>
                <dd>{farthest ? fill(w.results.headline.atNode, { value: num(farthest.magnitude), unit: ru.displacement, node: farthest.node }) : turning ? fill(w.results.headline.turnAtNode, { value: num(turning.value), node: turning.node }) : w.results.headline.none}</dd>
              </div>
              <div>
                <dt>{w.results.headline.reaction}</dt>
                <dd>{biggest && biggestWay ? fill(w.results.headline.component, { symbol: reactionSymbol(biggest.kind), value: num(biggest.value), unit: biggest.moment ? ru.moment : ru.force, direction: w.results.headline.directions[biggestWay], node: biggest.node }) : w.results.headline.none}</dd>
              </div>
              {topForce ? (
                <div>
                  <dt>{w.results.headline.force}</dt>
                  <dd>{fill(w.results.headline.inMember, { value: val(topForce.value), unit: ru.force, member: topForce.member })}</dd>
                </div>
              ) : null}
              {topMoment ? (
                <div>
                  <dt>{w.results.headline.moment}</dt>
                  <dd>{fill(w.results.headline.inMember, { value: val(topMoment.value), unit: ru.moment, member: topMoment.member })}</dd>
                </div>
              ) : null}
            </dl>
          ) : null}

          <div className="mp-st__options">
            <fieldset className="mp-st__checks">
              <legend className="mp-num__label">{w.drawing.options.title}</legend>
              {check1('loads', w.drawing.options.loads)}
              {check1('reactions', w.drawing.options.reactions)}
              {check1('deformed', w.drawing.options.deformed)}
              {check1('dofs', w.drawing.options.dofs)}
              {check1('nodeNumbers', w.drawing.options.nodeNumbers)}
              {check1('memberNumbers', w.drawing.options.memberNumbers)}
              {check1('values', w.drawing.options.values)}
              {facts.every ? check1('every', w.drawing.options.every) : null}
              {/* Told, not shown: the drawing itself says it is widening (Schematic.tsx); this is for whoever cannot see it do so. */}
              <p className="mp-st__widening mp-st__sr" role="status">
                {widening ? w.drawing.options.widening : ''}
              </p>
            </fieldset>
          </div>

          {/* The drawing and the sentence that reads it are what stays in view beside the form (stiffness.css); the notices, the status and the switches above scroll away. */}
          <div className={fitted.mode === 'free' ? 'mp-st__pin mp-st__pin--tall' : 'mp-st__pin'} ref={pinRef}>
          <div className="mp-app__plots" ref={plotRef}>
            {onPaper ? (
              // The sheet's figures carry their own titles: here only the units.
              <p className="mp-st__unitsline">{fill(w.matrix.unitsLine, { units: `${ru.length}, ${ru.force}` })}</p>
            ) : (
              <p className="mp-plot__title mp-plot__title--first">
                {w.drawing.title}
                <span className="mp-plot__unit">
                  {' '}
                  · {ru.length}, {ru.force}
                </span>
              </p>
            )}
            {onPaper ? (
              <div className="mp-st__sheetfigs">
                <Schematic drawing={a.drawing} width={PAPER_WIDTH} widen={false} paper maxHeight={420} looks={paperLooks({ deformed: false, loads: true, reactions: r !== null, dofs: true })} summary={summary} words={words} units={figureUnits} caption={w.drawing.sheet.structure} />
                {r ? <Schematic drawing={a.drawing} width={PAPER_WIDTH} widen={false} paper maxHeight={320} looks={paperLooks({ deformed: true, loads: false, reactions: false, dofs: false, memberNumbers: false })} summary={w.drawing.sheet.deformed} words={words} units={figureUnits} caption={w.drawing.sheet.deformed} /> : null}
              </div>
            ) : (
              <FigureGuard message={w.drawing.failed} reset={a.drawing}>
                <Schematic id={drawingId} drawing={a.drawing} width={width} widen every={show.every && facts.every} canWiden={omitted === 0 ? null : everyOk} onThinned={arrived} maxHeight={fitted.cap ?? undefined} looks={looks} summary={summary} describedBy={idOf('reading')} words={words} units={figureUnits} />
              </FigureGuard>
            )}
            {fitted.mode === 'drawing' ? null : saying}
          </div>
          </div>
          {fitted.mode === 'drawing' ? saying : null}
        </section>
      </div>

      {/* -- the numbers: under the form and the drawing, on paper too -- */}
      <Results a={a} w={w} t={t} fmt={fmt} id={resultsId} busy={catching} />
      <p className="mp-app__note mp-st__method">{w.results.method}</p>

      {/* -- the worked solution -- */}
      <Solution w={w} analysis={solutionShown.analysis} group={group} onPaper={onPaper} busy={catching || solutionShown.behind} id={stepsId} epoch={epoch} after={{ id: afterId, go: goTo(afterId) }} />
      {/* The way back: skip links only went forward, and a keyboard reader at the foot of a long solution had the whole of it to cross again. */}
      <nav className="mp-st__back mp-st__target" id={afterId} tabIndex={-1} aria-label={w.jump.back}>
        <a href={`#${formId}`} onClick={goTo(formId)}>
          {w.jump.form}
        </a>
        <a href={`#${drawingId}`} onClick={goTo(drawingId)}>
          {w.jump.drawing}
        </a>
      </nav>

      <p className="mp-app__privacy">{t.results.privacy}</p>
      {/* On paper only: when the sheet was printed, and the address that opens this very structure again. */}
      <SheetStamp stamp={stamp} t={{ printed: t.sheet.printed, link: w.sheet.link }} />
    </div>
  );
}
