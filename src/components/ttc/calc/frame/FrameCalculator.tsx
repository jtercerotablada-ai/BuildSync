'use client';

import React, { memo, useCallback, useDeferredValue, useEffect, useId, useMemo, useReducer, useRef, useState } from 'react';
import { flushSync } from 'react-dom';
import { formatNumber } from '@/lib/calc/format';
import { analyseSafely, memberValuesAt, type AnalysisIssue } from '@/lib/calc/frame/analysis';
import {
  FRAME_KEY,
  FRAME_UNITS,
  FRAME_US_TO_SI,
  LIMITS,
  convertTemplateParams,
  decodeFrame,
  defaultFrame,
  encodeFrame,
  reduceFrame,
  type FrameAction,
  type FrameForm,
  type FrameList,
  type FrameMaterial,
} from '@/lib/calc/frame/model';
import type { FrameShared, FrameUi } from '@/lib/calc/frame/strings';
import { TEMPLATE_DEFAULTS, TEMPLATE_FIELDS, TEMPLATE_IDS, carryParams, type TemplateId, type TemplateParams } from '@/lib/calc/frame/templates';
import { Actions } from '../shell/Actions';
import { useAddress } from '../shell/address';
import { select } from '../shell/fields';
import { PAPER_WIDTH, useTooTall, useWidth } from '../shell/layout';
import { SheetStamp, useSheet } from '../shell/sheet';
import { useSteelShapes } from '../shell/steel';
import { FNum } from './FNum';
import { LoadRowView, MemberLoadRowView, MemberRowView, NodeRowView, SupportRowView, type RowEnv } from './FrameRows';
import { FrameResults } from './FrameResults';
import { FigureGuard, FrameSchematic } from './FrameSchematic';
import { AMPS, ampLimit, drawingFacts, type DiagramMode, type Looks } from './layout';
import { fill, flaggedNodes, membersNeedingDepth, restartsRows, focusAddedRow, formToSolve, issueSentence, keepsMarks, largerExtreme, leaveBehind as leaveBehindWith, noticeText, openWhole, readingSentence, readoutSentence, signed, warningSentence, type Fmt, type Order } from './text';
import './frame.css';

/**
 * PLANE FRAME ANALYSIS - the calculator (/resources/plane-frame-analysis).
 *
 * The eighth calculator of the catalogue, and the fifth one's sibling (truss/TrussCalculator.tsx): the form on the left, the answer
 * on the right and nothing between them - every keystroke that leaves a number in a field solves the frame again, a moment after
 * the key and not inside it (`solved`, below); the address follows the frame (`#f=...`); nothing leaves the browser; its words are
 * props; it renders on the server with its example. What is the same from one calculator to the next is the shell's (../shell) and
 * the number field (../NumField), used here as they are and not copied.
 *
 * WHAT IS THIS ONE'S. A plane frame entered as FIVE TABLES - nodes, members, supports, loads at nodes, loads on members - or started
 * from one of six TEMPLATES and edited. The answer is the bending moment, shear and axial force along every member (and the
 * diagrams of all three), the reactions, the end forces and the extremes of each member, the equilibrium check and - where every
 * member has a section - the displacements and the deformed shape. A member picked in a table, or under the pointer in the drawing,
 * is marked in both, and the drawing reads N, V and M at the place pointed at.
 *
 * All the arithmetic is in lib/calc/frame: `model.ts` (the form, what each edit does to it, the address), `engine.ts` (the direct
 * stiffness method), `templates.ts`, and `analysis.ts`, which hands this file every number it prints ALREADY SETTLED and in the
 * units shown - what is rounding is zero there, once. This file is the form, the tables and the wiring: it decides nothing about a
 * number. What it does decide is how one is written, and the sentence that goes with each code (text.ts).
 *
 * TWO SETS OF WORDS. `t` is the part of the first calculator's that says the same on any calculator (lib/calc/frame/strings.ts,
 * `FrameShared`). `w` is what is about a frame. Neither file is imported here - both languages would travel with the script.
 *
 * NODES AND MEMBERS ARE SHOWN BY THEIR LABEL, their place in the list from 1; the form holds ids so that deleting a node renumbers the
 * labels after it and nothing else.
 */

/** The example frame, as it is written in an address. */
const EXAMPLE = encodeFrame(defaultFrame());

const Schematic = memo(FrameSchematic);

/**
 * What the fragment of an address opens. `undefined`: it is not this calculator's (`#main` is a place on the page; `#t=...` is the
 * truss's). `null`: it is, and cannot be read - its key with nothing after it included.
 */
function caseIn(hash: string): FrameForm | null | undefined {
  const m = hash.match(new RegExp(`^#${FRAME_KEY}=(.*)$`));
  if (!m) return undefined;
  let text = m[1];
  try {
    text = decodeURIComponent(text);
  } catch {
    /* not percent-encoded: read as it is */
  }
  return decodeFrame(text);
}

/** What the template group holds: not part of the case, a few numbers for the next template to load. */
interface TemplateState {
  template: TemplateId;
  params: TemplateParams;
}
const templateDefaults = (template: TemplateId, units: FrameForm['units']): TemplateState => ({ template, params: { ...TEMPLATE_DEFAULTS[units][template] } });
const FIRST_TEMPLATE: TemplateId = 'portal';

/** The issues that are about a node's place and are shown on its row. */
const NODE_CODES = new Set(['duplicate-node', 'duplicate-nodes', 'scale', 'node-unconnected']);

const noop = () => undefined;

/** A shape of the steel table in the units shown: A and I, to six figures. */
const shapeValues = (shape: { A: number; Ix: number }, units: FrameForm['units']) => ({
  A: Number((units === 'us' ? shape.A : shape.A * FRAME_US_TO_SI.area).toPrecision(6)),
  I: Number((units === 'us' ? shape.Ix : shape.Ix * FRAME_US_TO_SI.inertia).toPrecision(6)),
});

/** A set of settled looks for the drawing. */
interface Show {
  mode: DiagramMode;
  loads: boolean;
  reactions: boolean;
  values: boolean;
  nodeNumbers: boolean;
  memberNumbers: boolean;
  every: boolean;
  amp: number;
}
const SHOW: Show = { mode: 'M', loads: true, reactions: true, values: true, nodeNumbers: true, memberNumbers: true, every: false, amp: 1 };

/**
 * `initial`: the frame it opens with, where that is not the example - for the tests, which can neither type nor press.
 */
export function FrameCalculator({ t, w, initial }: { t: FrameShared; w: FrameUi; initial?: FrameForm }) {
  const [form, dispatchRaw] = useReducer(reduceFrame, initial, (given) => given ?? defaultFrame());
  // The frame last put on screen whole - opened from the address, or the example on "Start over": that one is
  // solved in the render that shows it (`solved`, below), never a moment later under the results of the frame before.
  const [whole, setWhole] = useState<FrameForm | null>(null);
  const [tpl, setTpl] = useState<TemplateState>(() => templateDefaults(FIRST_TEMPLATE, (initial ?? { units: 'us' as const }).units));
  // What "Load template" said it did; gone with the next edit of any kind.
  const [said, setSaid] = useState('');
  // How the drawing is looked at: screen choices, kept while the page is open (not in the address); paper prints a sheet of its own.
  const [show, setShow] = useState<Show>(SHOW);
  const [order, setOrder] = useState<Order>('member');
  // The member under the pointer or the keyboard's focus, the one picked (pressed in a table or the drawing, or chosen in the list),
  // and the place along a member being read (a share of its length).
  const [hover, setHover] = useState<number | null>(null);
  const [picked, setPicked] = useState<number | null>(null);
  const [probe, setProbe] = useState<{ member: number; share: number } | null>(null);
  // Which supports show their springs and settlement, and the shape picker.
  const [more, setMore] = useState<ReadonlySet<number>>(() => new Set());
  const [picking, setPicking] = useState(false);
  const [target, setTarget] = useState<'frame' | number>('frame');
  const [chosen, setChosen] = useState('');
  const [filled, setFilled] = useState('');
  const uid = useId();
  // Where the links at the head of the form go: the drawing, and the tables of results.
  const drawingId = `${uid}drawing`;
  const resultsId = `${uid}results`;
  // The calculator itself: a frame opened from the address asks whether the focus is in one of its fields.
  const root = useRef<HTMLDivElement>(null);
  const [plotRef, windowWidth] = useWidth<HTMLDivElement>();
  const [outRef, tooTall] = useTooTall<HTMLElement>();
  const u = FRAME_UNITS[form.units];
  const group = t.numbers.group;

  // Any edit but a number typed into a field puts the member marks away (a label is a place in a list and means
  // another member once one before it is gone) and takes back the line "Load template" said.
  const dispatch = useCallback((action: FrameAction) => {
    setSaid('');
    setFilled('');
    // A support's id is only its own within one frame: a template, a start over or an opened link numbers its rows from 1 again.
    if (restartsRows(action.type)) setMore(new Set());
    if (!keepsMarks(action.type)) {
      setPicked(null);
      setHover(null);
      setProbe(null);
      setTarget('frame');
    }
    dispatchRaw(action);
  }, []);

  // THE ADDRESS FOLLOWS THE FRAME (../shell/address.ts).
  const code = useCallback(() => encodeFrame(form), [form]);
  const address = useAddress<FrameForm>({
    key: FRAME_KEY,
    example: EXAMPLE,
    code,
    read: caseIn,
    blank: defaultFrame,
    // A frame in the address opens as that frame.
    open: (found) =>
      // An edit in progress is an edit of the frame before, and ends here. The field with the focus is left FIRST:
      // it would go on showing what was typed into that frame, and fall back on that frame's value at the first key
      // that is not a number (NumField).
      openWhole(found, {
        blur: () => {
          const focused = document.activeElement;
          if (focused instanceof HTMLInputElement && root.current?.contains(focused)) focused.blur();
        },
        load: (opened) => {
          dispatch({ type: 'load', form: opened });
          setShow((s) => ({ ...s, memberNumbers: opened.members.length <= 12 }));
        },
        remember: setWhole,
        template: (opened) => setTpl(templateDefaults(FIRST_TEMPLATE, opened.units)),
      }),
  });
  const { linkError } = address;
  // The printed sheet gives the address that opens this very frame, and while it prints the drawings are the sheet's size.
  const { stamp, onPaper } = useSheet({ locale: t.sheet.locale, url: () => address.link(encodeFrame(form)) });
  const width = onPaper ? PAPER_WIDTH : windowWidth;

  // WHICH FRAME IS SOLVED. A frame of fifty nodes and a hundred members is some tens of milliseconds of arithmetic on a desktop and
  // several times that on a phone, and inside the keystroke that kept the key off the screen for as long. So while only NUMBERS
  // change, the answer is of the form as it was a moment ago (`useDeferredValue`): the key shows at once, and the frame is solved in
  // a render of its own, which the next key may interrupt. The results say so while they are behind (`aria-busy`). Anything else -
  // the units, a row added or removed, a choice in a list, a member moved to another node, a frame opened whole - is solved in the
  // same render as ever: the answer must never stand under other units, beside rows it was not solved for, or under a frame it is
  // not of. And on paper it is the form itself: a sheet is never printed with the answer of the frame before.
  const behind = useDeferredValue(form);
  const solved = formToSolve({ form, behind, whole, onPaper });
  const catching = solved !== form;

  // Everything the page prints (lib/calc/frame/analysis.ts) - through the door that never throws.
  const a = useMemo(() => analyseSafely(solved), [solved]);
  const r = a.results;
  const ru = a.units;

  // The marks are of a member that is there.
  const known = (label: number | null) => (label !== null && label <= solved.members.length ? label : null);
  const active = known(hover) ?? known(picked);
  const onActive = useCallback((label: number | null) => setHover(label), []);
  const onPick = useCallback((label: number) => {
    setPicked((p) => (p === label ? null : label));
    setProbe({ member: label, share: 0.5 });
  }, []);
  const onProbe = useCallback((member: number, share: number) => setProbe({ member, share }), []);
  const flagged = useMemo(() => flaggedNodes(a), [a]);

  // Every number this page prints, with the page's own mark between thousands and a true minus.
  const fmt: Fmt = useMemo(
    () => ({
      num: (v, sig = 4) => formatNumber(v, sig, group).replace(/^-/, '−'),
      val: (v, sig = 4) => signed(formatNumber(Math.abs(v), sig, group), v),
    }),
    [group],
  );
  const { num, val } = fmt;
  const units = useMemo(() => ({ length: u.length, force: u.force, line: u.line }), [u.length, u.force, u.line]);

  // The looks of the drawing. A diagram needs a solution; the deformed shape needs sections.
  const looks: Looks = useMemo(
    () => ({
      mode: r ? show.mode : 'none',
      loads: show.loads,
      reactions: show.reactions && r !== null,
      values: show.values,
      nodeNumbers: show.nodeNumbers,
      memberNumbers: show.memberNumbers,
      amp: show.amp,
      group,
      flagged,
      displacements: r?.displacements ? r.displacements.map((d) => ({ node: d.node, magnitude: d.magnitude })) : null,
      extremes: w.results.drawing.extremes,
    }),
    [r, w, show.mode, show.loads, show.reactions, show.values, show.nodeNumbers, show.memberNumbers, show.amp, group, flagged],
  );
  // The words the drawing leaves off at this width: found from the layout the figure draws anyway (kept by `layoutFor`). Whether widening
  // the drawing would put them on is a search over widths, and is asked for a moment after the last key and not inside it (`everyOk`):
  // until it is known the switch is offered, and the note under the drawing says no more than the layout does.
  // How many words the drawing on screen leaves off: told by the figure when it has been drawn (it is drawn a moment after the key).
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

  /* -- The faults, by row -- */
  const listName: Record<FrameList, string> = { nodes: w.nodes.name, members: w.members.name, supports: w.supports.name, loads: w.loads.name, memberLoads: w.memberLoads.name };
  const says = (issue: AnalysisIssue, where = false): string => {
    const text = issueSentence(issue, w, { number: (v) => num(v, 3), unit: u.length });
    if (!where || !issue.row) return text;
    return `${issue.row.list === 'model' ? t.section.title : `${listName[issue.row.list]} ${issue.at ?? ''}`.trim()}: ${text}`;
  };
  // The faults of one row of a list: those that name it, and for a node or a member those that name its label.
  const issuesOf = (list: FrameList, id: number): AnalysisIssue[] => {
    const label = list === 'nodes' ? solved.nodes.findIndex((n) => n.id === id) + 1 : list === 'members' ? solved.members.findIndex((m) => m.id === id) + 1 : 0;
    return a.issues.filter(
      (i) =>
        (i.row && i.row.list === list && i.row.id === id) ||
        (list === 'nodes' && NODE_CODES.has(i.code) && i.nodes?.includes(label)) ||
        (list === 'members' && (i.code === 'duplicate-member' || i.code === 'depth') && i.members?.includes(label)),
    );
  };
  const sectionIssues = (field: 'E' | 'A' | 'I') => a.issues.filter((i) => (i.row?.list === 'model' && i.row.field === field) || (i.code === 'sections' && form[field] === null));
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
  // What the results box says, each thing once.
  // Nodes that no member reaches are one problem, said once (ten nodes added in a row were ten lines).
  const loose = a.issues.filter((i) => i.code === 'node-unconnected');
  const listed: AnalysisIssue[] = loose.length > 1 ? [{ code: 'node-unconnected', nodes: loose.flatMap((i) => i.nodes ?? []) }, ...a.issues.filter((i) => i.code !== 'node-unconnected')] : a.issues;
  const notices = listed.map((i) => ({ text: says(i, true) })).filter((n, i, all) => all.findIndex((m) => m.text === n.text) === i);
  const formatIt = (v: number) => num(v, 6);

  /* -- The rows of the form -- */
  // A row added WITH THE KEYBOARD is handed the focus, in its first field. The row is put on screen first (`flushSync`).
  const addRow = (list: FrameList) => (press: React.MouseEvent<HTMLButtonElement>) => {
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
  const limitLine = (list: FrameList) => fill(w.limit, { max: LIMITS[list], list: w.lists[list] });
  const addButton = (list: FrameList, label: string) => {
    const full = form[list].length >= LIMITS[list];
    const limited = full || (form.notice?.code === 'limit' && form.notice.list === list);
    return (
      <>
        <button type="button" className="mp-app__add" onClick={full ? undefined : addRow(list)} aria-disabled={full || undefined} aria-describedby={limited ? `${uid}${list}limit` : undefined}>
          <span aria-hidden="true">+</span> {label}
        </button>
        <p className="mp-frame__limit" id={`${uid}${list}limit`} role="status">
          {limited ? limitLine(list) : ''}
        </p>
      </>
    );
  };

  // The rows of the five tables are components of their own (FrameRows.tsx), made again only when the row they are of changes.
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
  const patch = useCallback((list: FrameList, id: number, p: Record<string, unknown>) => dispatch({ type: 'patch', list, id, patch: p }), [dispatch]);
  // A row removed WITH THE KEYBOARD took the focus away with it, and the browser left it on nothing. It is given to the
  // first control of the row that takes the place - the next one, else the one before - or to the group's "add" button
  // when no row is left. Not after a click or a tap (`detail` counts them, and is 0 for a key).
  const removeRow = useCallback(
    (list: FrameList, id: number) => (press: React.MouseEvent<HTMLButtonElement>) => {
      const row = press.currentTarget.closest('.mp-app__item');
      const near = [row?.nextElementSibling, row?.previousElementSibling].find((el) => el?.classList.contains('mp-app__item'));
      const next = press.detail === 0 ? (near?.querySelector<HTMLElement>('input, select') ?? press.currentTarget.closest('fieldset')?.querySelector<HTMLElement>('.mp-app__add')) : null;
      dispatch({ type: 'remove', list, id });
      next?.focus();
    },
    [dispatch],
  );
  const rowEnv: RowEnv = useMemo(
    () => ({ t, w, u, uid, format: formatIt, nodeOptions, memberOptions, patch, remove: removeRow, listName }),
    // `formatIt` follows the number format, which follows the page's group mark.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [t, w, u, uid, group, nodeOptions, memberOptions, patch, removeRow],
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
  // A number of the section group (the rows of the tables are FrameRows.tsx's).
  const field = (label: string, unit: string | undefined, value: number, onChange: (v: number) => void, extra: { invalid?: boolean; describedBy?: string } = {}) => (
    <FNum numbers={t.numbers} words={w.fieldWords} format={formatIt} label={label} unit={unit} value={value} onChange={onChange} {...extra} />
  );
  // What goes with a row: the faults that name it, and the sentence of each.
  const rowProps = (list: FrameList, id: number, index: number) => {
    const issues = issuesOf(list, id);
    return { env: rowEnv, index: index + 1, issues, texts: [...new Set(issues.map((i) => says(i)))] };
  };

  /* -- The notices of the form -- */
  const notice = noticeText(form.notice, w, { num, units });
  // A line that tells what just happened is on the page before it has anything to say, so that a screen reader hears it arrive.
  const status = (where: FrameList | 'template', className: string) => (
    <p className={className} role="status">
      {notice?.where === where && form.notice?.code !== 'limit' ? notice.text : ''}
    </p>
  );

  /* -- The template group -- */
  const spec = TEMPLATE_FIELDS[tpl.template];
  // Another shape keeps the numbers typed for the one before wherever it has the same parameter (a width typed for a portal is the width of the gable).
  const setTemplate = (template: TemplateId) => setTpl((prev) => carryParams(prev, template, form.units));
  const setParam = (key: keyof TemplateParams, value: number | boolean | string) => setTpl({ ...tpl, params: { ...tpl.params, [key]: value } });
  // A frame that is about to be thrown away - by "Start over" or by "Load template" - is left one step behind in the browser's history,
  // so that Back brings it back. The address is brought to that frame first: the entry left behind is the one on screen.
  const leaveBehind = (next: FrameForm) =>
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
  const applyTemplate = () => {
    const action: FrameAction = { type: 'template', template: tpl.template, params: tpl.params };
    const built = reduceFrame(form, action);
    const left = leaveBehind(built);
    dispatch(action);
    // A frame of many members has no room for a number on each: its tags start switched off (the switch is the visitor's).
    setShow((s) => ({ ...s, memberNumbers: built.members.length <= 12 }));
    setSaid(
      [
        fill(w.template.done, { template: w.template.names[tpl.template], nodes: built.nodes.length, members: built.members.length, supports: built.supports.length, loads: built.loads.length, memberLoads: built.memberLoads.length }),
        left ? w.template.back : '',
      ]
        .filter(Boolean)
        .join(' '),
    );
  };
  const paramUnit = (key: keyof TemplateParams) => (key === 'width' || key === 'height' || key === 'rise' ? u.length : key === 'gravity' ? u.line : key === 'lateral' || key === 'axial' ? u.force : undefined);
  const forcedBase = spec.base === 'choice' ? null : spec.base;

  /* -- The section: a shape from the shell's table -- */
  const steel = useSteelShapes({ wanted: picking, name: '', onName: noop });
  const chosenShape = steel.shapes ? (steel.shapes.find((s) => s.designation === chosen) ?? steel.filtered[0] ?? null) : null;
  const shown = chosenShape ? shapeValues(chosenShape, form.units) : null;
  const useShape = () => {
    if (!chosenShape || !shown) return;
    // The section depth comes with the shape (the table has d): a temperature gradient asks for it, and a member that needs it has it at once.
    const depth = Number((form.units === 'us' ? chosenShape.d : chosenShape.d * FRAME_US_TO_SI.depth).toPrecision(6));
    const depthFor = membersNeedingDepth(form, target);
    if (target === 'frame') dispatch({ type: 'section', patch: { A: shown.A, I: shown.I } });
    else dispatch({ type: 'patch', list: 'members', id: target, patch: { A: shown.A, I: shown.I } });
    for (const id of depthFor) dispatch({ type: 'patch', list: 'members', id, patch: { h: depth } });
    const label = target === 'frame' ? w.section.frameTarget : fill(w.section.memberTarget, { member: form.members.findIndex((m) => m.id === target) + 1 });
    const depthLine = depthFor.length ? fill(w.section.filledDepth, { h: num(depth, 6), unit: u.depth, count: depthFor.length, list: depthFor.map((id) => form.members.findIndex((m) => m.id === id) + 1).join(', ') }) : '';
    setFilled([fill(w.section.filled, { shape: chosenShape.designation, target: label }), depthLine].filter(Boolean).join(' '));
  };

  /* -- The drawing in words -- */
  const mode = looks.mode;
  const reading = readingSentence(a, mode, w, { ...fmt, length: u.length });
  // How far each support that settles moves: said in a line under the drawing (the badge on the drawing says which support).
  const settleLine = (() => {
    const parts = a.drawing.supports.flatMap((s) => {
      if (!s.settle) return [];
      const bits = [s.settle.dx !== 0 ? `x ${val(s.settle.dx, 3)} ${ru.displacement}` : '', s.settle.dy !== 0 ? `y ${val(s.settle.dy, 3)} ${ru.displacement}` : '', s.settle.dr !== 0 ? `${val(s.settle.dr, 3)} rad` : ''].filter(Boolean);
      return [fill(w.results.drawing.settlement, { n: s.node, parts: bits.join(', ') })];
    });
    return parts.length ? fill(w.results.drawing.settlements, { list: parts.join('; ') }) : '';
  })();
  const reactionsLine = r && r.reactions.length ? fill(w.results.drawing.reactions, { list: r.reactions.map((x) => `${w.results.reactions.node} ${x.node}: ${num(x.magnitude)} ${ru.force}`).join('; ') }) : '';
  const summary = a.drawing.nodes.length === 0 ? w.results.drawing.empty : [fill(w.results.drawing.frame, { nodes: solved.nodes.length, members: solved.members.length, supports: solved.supports.length, loads: solved.loads.length, memberLoads: solved.memberLoads.length }), reading, reactionsLine, settleLine].filter(Boolean).join(' ');
  // A link that goes to a place on this page and leaves the address alone (a fragment would replace the frame in it).
  const goTo = (id: string) => (e: React.MouseEvent<HTMLAnchorElement>) => {
    const el = document.getElementById(id);
    if (!el) return;
    e.preventDefault();
    el.focus({ preventScroll: true });
    el.scrollIntoView({ block: 'start' });
  };

  // The member read: from the pointer, the table or the list.
  const readLabel = r && active !== null ? active : null;
  const readLine = r && readLabel !== null ? r.members[readLabel - 1] : null;
  const share = probe && probe.member === readLabel ? probe.share : 0.5;
  const readX = readLine ? share * readLine.length : 0;
  const readValues = r && readLine && readLabel !== null ? memberValuesAt(r, readLabel, readX) : null;
  const readText = readLine && readValues ? readoutSentence(w, { ...fmt, length: u.length, force: ru.force, moment: ru.moment }, { member: readLine.label, node: readLine.i, x: readX, ...readValues }) : '';
  const readAria = readLine && readValues ? fill(w.results.readout.aria, { N: val(readValues.N), V: val(readValues.V), M: val(readValues.M), force: ru.force, moment: ru.moment }) : '';

  const degree = a.determinacy.degree;
  const word = a.determinacy.word;
  const headline = r ? (['M', 'V', 'N'] as const).map((key) => ({ key, e: largerExtreme(r.extremes[key].max, r.extremes[key].min) })) : [];
  const headlineValue = (e: { member: number; x: number; value: number } | null, unit: string) => {
    if (!e || !r) return w.results.headline.none;
    const line = r.members[e.member - 1];
    const near = 1e-9 * line.length;
    const where = e.x <= near ? fill(w.results.headline.node, { node: line.i }) : e.x >= line.length - near ? fill(w.results.headline.node, { node: line.j }) : fill(w.results.headline.along, { x: num(e.x), unit: u.length, node: line.i });
    return `${val(e.value)} ${unit} - ${fill(w.results.headline.at, { member: e.member, where })}`;
  };
  const farthest = r?.displacements ? r.displacements.reduce((best, d) => (d.magnitude > best.magnitude ? d : best), r.displacements[0]) : null;

  // The box of notices.
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

  const radio = (key: DiagramMode) => (
    <label key={key} className="mp-seg__item">
      <input type="radio" name={`${uid}diagram`} checked={show.mode === key} disabled={r === null} onChange={() => setShow({ ...show, mode: key })} />
      <span>{w.results.options.diagrams[key]}</span>
    </label>
  );
  // The size of a diagram is held to the bays of the frame: a larger one would run over the next bay.
  const ampCap = useMemo(() => {
    try {
      return ampLimit(a.drawing, mode);
    } catch {
      return Infinity;
    }
  }, [a.drawing, mode]);
  const stepAmp = (dir: -1 | 1) => {
    const at = AMPS.indexOf(show.amp as (typeof AMPS)[number]);
    const next = AMPS[Math.min(AMPS.length - 1, Math.max(0, (at < 0 ? 1 : at) + dir))];
    if (dir === 1 && next > ampCap) return;
    setShow({ ...show, amp: next });
  };
  const ampIndex = Math.max(0, AMPS.indexOf(show.amp as (typeof AMPS)[number]));
  const ampAtLimit = ampIndex === AMPS.length - 1 || AMPS[Math.min(AMPS.length - 1, ampIndex + 1)] > ampCap;
  const diagrammed = r !== null && (mode === 'M' || mode === 'V' || mode === 'N');
  const words = useMemo(() => ({ legend: w.results.legend, notes: w.results.drawingNotes, scaleLine: w.results.scaleLine, zeroDiagram: w.results.zeroDiagram, broken: w.results.drawing.broken, limited: w.results.options.limited }), [w]);
  const figureUnits = useMemo(() => ({ length: ru.length, moment: ru.moment, force: ru.force, displacement: ru.displacement }), [ru.length, ru.moment, ru.force, ru.displacement]);
  const paperLooks = (m: DiagramMode, rest: Partial<Looks> = {}): Looks => ({ ...looks, mode: m, loads: false, reactions: false, values: true, nodeNumbers: true, memberNumbers: false, amp: 1, ...rest });

  return (
    <div className={onPaper ? 'mp-app mp-frame mp-frame--sheet' : 'mp-app mp-frame'} ref={root}>
      <nav className="mp-frame__jump" aria-label={w.jump.label}>
        <a href={`#${drawingId}`} onClick={goTo(drawingId)}>
          {w.jump.drawing}
        </a>
        {r ? (
          <a href={`#${resultsId}`} onClick={goTo(resultsId)}>
            {w.jump.results}
          </a>
        ) : null}
      </nav>
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
                    name={`${uid}units`}
                    checked={form.units === unit}
                    onChange={() => {
                      dispatch({ type: 'units', units: unit });
                      // A width typed in feet is that many feet in metres: the group's numbers are converted, and its shape is kept.
                      setTpl({ ...tpl, params: convertTemplateParams(tpl.params, form.units, unit) });
                    }}
                  />
                  <span>{w.toolbar[unit]}</span>
                </label>
              ))}
            </fieldset>
          </div>

          {/* A starting point, not part of the case: it is not printed. */}
          <fieldset className="mp-app__group mp-frame__template">
            <legend>{w.template.title}</legend>
            <div className="mp-app__row mp-app__row--two">
              {select<TemplateId>(w.template.pick, tpl.template, TEMPLATE_IDS.map((id) => [id, w.template.names[id]] as [TemplateId, string]), setTemplate)}
              {spec.base === 'choice'
                ? select<'fixed' | 'pinned'>(w.template.params.base, tpl.params.base, [['fixed', w.template.bases.fixed], ['pinned', w.template.bases.pinned]], (base) => setParam('base', base))
                : null}
            </div>
            {forcedBase ? <p className="mp-app__note">{w.template.forced[forcedBase === 'fixed' ? 'fixed' : 'pinned']}</p> : null}
            <div className="mp-app__row mp-app__row--two">
              {spec.fields.map((key) => (
                <FNum key={`${tpl.template}${key}`} numbers={t.numbers} words={w.fieldWords} format={formatIt} label={w.template.params[key]} unit={paramUnit(key)} value={tpl.params[key] as number} onChange={(v) => setParam(key, v)} />
              ))}
            </div>
            {spec.hinge ? (
              <label className="mp-app__check mp-frame__check">
                <input type="checkbox" checked={tpl.params.hinge} onChange={(e) => setParam('hinge', e.target.checked)} />
                <span>{w.template.params.hinge}</span>
              </label>
            ) : null}
            <button type="button" className="mp-app__btn" onClick={applyTemplate}>
              {w.template.apply}
            </button>
            <p className="mp-app__computed mp-frame__said" role="status">
              {said}
            </p>
            {status('template', 'mp-frame__notice')}
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
            {status('nodes', 'mp-frame__notice')}
          </fieldset>

          <fieldset className="mp-app__group">
            <legend>{w.members.title}</legend>
            <p className="mp-app__note">{w.members.note}</p>
            {form.members.length === 0 ? <p className="mp-app__none">{w.empty.members}</p> : null}
            {form.members.map((m, i) => (
              <MemberRowView key={m.id} {...rowProps('members', m.id, i)} row={m} />
            ))}
            {addButton('members', w.members.add)}
            {status('members', 'mp-frame__notice')}
          </fieldset>

          <fieldset className="mp-app__group">
            <legend>{t.supports.title}</legend>
            <p className="mp-app__note">{w.supports.note}</p>
            {form.supports.length === 0 ? <p className="mp-app__none">{w.empty.supports}</p> : null}
            {form.supports.map((s, i) => {
              const settles = s.dx !== 0 || s.dy !== 0 || (s.kind !== 'roller' && s.kind !== 'pin' && s.dr !== 0);
              const forced = settles || (s.kind !== 'spring' && (s.kx !== 0 || s.ky !== 0 || s.kr !== 0));
              return <SupportRowView key={s.id} {...rowProps('supports', s.id, i)} row={s} open={more.has(s.id) || forced} forced={forced} toggle={toggleMore} />;
            })}
            {addButton('supports', w.supports.add)}
            {status('supports', 'mp-frame__notice')}
          </fieldset>

          <fieldset className="mp-app__group">
            <legend>{w.loads.title}</legend>
            <p className="mp-app__note">{w.loads.note}</p>
            {form.loads.length === 0 ? <p className="mp-app__none">{w.empty.loads}</p> : null}
            {form.loads.map((l, i) => (
              <LoadRowView key={l.id} {...rowProps('loads', l.id, i)} row={l} />
            ))}
            {addButton('loads', w.loads.add)}
            {status('loads', 'mp-frame__notice')}
          </fieldset>

          <fieldset className="mp-app__group">
            <legend>{w.memberLoads.title}</legend>
            <p className="mp-app__note">{w.memberLoads.note}</p>
            {form.memberLoads.length === 0 ? <p className="mp-app__none">{w.empty.memberLoads}</p> : null}
            {form.memberLoads.map((l, i) => (
              <MemberLoadRowView key={l.id} {...rowProps('memberLoads', l.id, i)} row={l} />
            ))}
            {addButton('memberLoads', w.memberLoads.add)}
            {status('memberLoads', 'mp-frame__notice')}
          </fieldset>

          <fieldset className="mp-app__group">
            <legend>{t.section.title}</legend>
            <p className="mp-app__note">{w.section.note}</p>
            <div className="mp-app__row mp-app__row--two mp-frame__material">
              {select<FrameMaterial>(
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
              {field(w.section.I, u.inertia, optionalNumber(form.I), (I) => dispatch({ type: 'section', patch: { I: fromField(I) } }), sectionFault('I'))}
            </div>
            {rowIssue('modelsection', [...new Set(['E', 'A', 'I'].flatMap((fld) => sectionIssues(fld as 'E' | 'A' | 'I')))])}
            <p className="mp-app__note">{w.section.typicalMaterial}</p>

            {/* A shape from the steel table: fetched the first time it is wanted, the failure said. */}
            {picking ? (
              <div className="mp-frame__shapes">
                <p className="mp-frame__subtitle">{w.section.steelTitle}</p>
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
                          <select className="mp-num__input" value={target} onChange={(e) => setTarget(e.target.value === 'frame' ? 'frame' : Number(e.target.value))}>
                            <option value="frame">{w.section.frameTarget}</option>
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
                      <p className="mp-app__computed">{fill(w.section.values, { shape: chosenShape.designation, A: num(shown.A, 6), I: num(shown.I, 6), areaUnit: u.area, inertiaUnit: u.inertia })}</p>
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
              <button type="button" className="mp-app__btn mp-app__btn--quiet mp-frame__shape-open" onClick={() => setPicking(true)}>
                {w.section.steelTitle}
              </button>
            )}
            {/* Mounted with the group, empty: the table's arrival, its failure and the shape put in are announced when they fill it. */}
            <p className="mp-frame__filled" role="status">
              {filled || (picking && !steel.shapes ? (steel.failed ? t.section.loadFailed : t.section.loading) : '')}
            </p>
          </fieldset>

          <Actions
            t={{ ...t.toolbar, copy: w.toolbar.copy }}
            copy={() => {
              // The address is brought to this frame too, and a link that could not be read has nothing left to say:
              // the one copied is the frame on screen.
              address.take(encodeFrame(form));
              return address.link(encodeFrame(form));
            }}
            reset={() => {
              // One press throws away whatever was typed, and nothing is asked. So the frame that goes - unless it is the
              // example - is left one step behind in the browser's history: Back brings it back, as the page opens any
              // frame its address holds (../shell/address.ts), and Forward returns to the example.
              const example = defaultFrame();
              const left = leaveBehind(example);
              dispatch({ type: 'load', form: example });
              // Where the way back is said (the line under "Load template").
              if (left) setSaid(w.template.back);
              setWhole(example);
              setTpl(templateDefaults(FIRST_TEMPLATE, 'us'));
              setOrder('member');
              setShow(SHOW);
              // The address goes bare - if what is after the # is a frame.
              address.take(EXAMPLE);
            }}
          />
        </form>

        {/* -- the answer -- */}
        <section className={tooTall ? 'mp-app__out mp-app__out--tall' : 'mp-app__out'} aria-label={t.results.title} ref={outRef} aria-busy={catching ? true : undefined}>
          {box}

          {/* Mounted before it has anything to say, so that a reader who cannot see it is told when it fills. */}
          <div className="mp-frame__warnings" role="status" data-empty={a.warnings.length ? undefined : 'true'}>
            {a.warnings.length ? (
              <>
                <p className="mp-app__issues-title">{w.results.warningsTitle}</p>
                <ul>
                  {a.warnings.map((x) => (
                    <li key={x.code}>{warningSentence(x, w)}</li>
                  ))}
                </ul>
              </>
            ) : null}
          </div>

          {word ? (
            <div className={`mp-frame__status mp-frame__status--${word}`} data-word={word}>
              <p className="mp-frame__word">{fill(w.results.determinacy[word].title, { degree })}</p>
              <p className="mp-app__computed">
                {w.results.determinacy.formula}{' '}
                {fill(w.results.determinacy.counts, {
                  members: a.determinacy.members,
                  reactions: a.determinacy.reactions,
                  equations: a.determinacy.equations,
                  releases: a.determinacy.releases,
                  degree: degree < 0 ? `−${-degree}` : degree,
                })}
              </p>
              <p className="mp-app__note">
                {w.results.determinacy[word].note} {w.results.determinacy.legend}.
              </p>
            </div>
          ) : null}

          {r ? (
            <dl className="mp-app__dl mp-frame__largest">
              {headline.map(({ key, e }) => (
                <div key={key}>
                  <dt>{w.results.headline[key]}</dt>
                  <dd>{headlineValue(e, key === 'M' ? ru.moment : ru.force)}</dd>
                </div>
              ))}
              {farthest ? (
                <div>
                  <dt>{w.results.headline.displacement}</dt>
                  <dd>{farthest.magnitude > 0 ? `${num(farthest.magnitude)} ${ru.displacement} - ${fill(w.results.headline.nodeOf, { node: farthest.node })}` : w.results.headline.none}</dd>
                </div>
              ) : null}
            </dl>
          ) : null}

          <div className="mp-frame__options">
            <fieldset className="mp-seg">
              <legend className="mp-num__label">{w.results.options.diagram}</legend>
              {(['M', 'V', 'N', 'deformed', 'none'] as const).map(radio)}
            </fieldset>
            <fieldset className="mp-frame__checks">
              <legend className="mp-num__label">{w.results.options.title}</legend>
              {(
                [
                  ['loads', w.results.options.loads],
                  ['reactions', w.results.options.reactions],
                  ['values', w.results.options.values],
                  ['nodeNumbers', w.results.options.nodeNumbers],
                  ['memberNumbers', w.results.options.memberNumbers],
                ] as const
              ).map(([key, label]) => (
                <label key={key} className="mp-app__check">
                  <input type="checkbox" checked={show[key]} onChange={(e) => setShow({ ...show, [key]: e.target.checked })} />
                  <span>{label}</span>
                </label>
              ))}
              {facts.every ? (
                <label className="mp-app__check">
                  <input type="checkbox" checked={show.every} onChange={(e) => setShow({ ...show, every: e.target.checked })} />
                  <span>{w.results.options.every}</span>
                </label>
              ) : null}
            </fieldset>
            {diagrammed ? (
              <div className="mp-frame__size" role="group" aria-label={w.results.options.size}>
                <button type="button" className="mp-app__btn mp-app__btn--quiet" aria-disabled={ampIndex === 0 || undefined} onClick={() => stepAmp(-1)}>
                  {w.results.options.smaller}
                </button>
                <span className="mp-app__computed" aria-hidden="true">
                  {fill(w.results.options.sizeNow, { amp: String(show.amp) })}
                </span>
                <button type="button" className="mp-app__btn mp-app__btn--quiet" aria-disabled={ampAtLimit || undefined} onClick={() => stepAmp(1)}>
                  {w.results.options.larger}
                </button>
              </div>
            ) : null}
          </div>

          <div className="mp-app__plots" ref={plotRef}>
            <p className="mp-plot__title mp-plot__title--first">
              {w.results.schematic}
              <span className="mp-plot__unit">
                {' '}
                · {ru.length}, {ru.force}
              </span>
            </p>
            {onPaper ? (
              <div className="mp-frame__sheetfigs">
                <Schematic drawing={a.drawing} width={PAPER_WIDTH} widen={false} paper looks={{ ...looks, mode: 'none', loads: true, reactions: r !== null, values: true, memberNumbers: true }} summary={summary} words={words} units={figureUnits} caption={w.results.sheetFigures.frame} />
                {r ? (
                  <div className="mp-frame__sheetgrid">
                    <Schematic drawing={a.drawing} width={350} maxHeight={300} widen={false} paper looks={paperLooks('M')} summary={w.results.sheetFigures.M} words={words} units={figureUnits} caption={w.results.sheetFigures.M} />
                    <Schematic drawing={a.drawing} width={350} maxHeight={300} widen={false} paper looks={paperLooks('V')} summary={w.results.sheetFigures.V} words={words} units={figureUnits} caption={w.results.sheetFigures.V} />
                    <Schematic drawing={a.drawing} width={350} maxHeight={300} widen={false} paper looks={paperLooks('N')} summary={w.results.sheetFigures.N} words={words} units={figureUnits} caption={w.results.sheetFigures.N} />
                    <Schematic drawing={a.drawing} width={350} maxHeight={300} widen={false} paper looks={paperLooks('deformed')} summary={w.results.sheetFigures.deformed} words={words} units={figureUnits} caption={w.results.sheetFigures.deformed} />
                  </div>
                ) : null}
              </div>
            ) : (
              <FigureGuard message={w.results.drawing.failed} reset={a.drawing}>
                <Schematic
                  id={drawingId}
                  drawing={a.drawing}
                  width={width}
                  widen
                  every={show.every && facts.every}
                  canWiden={omitted === 0 ? null : everyOk}
                  probe={readLine && readValues ? { member: readLine.label, share } : null}
                  readout={readText}
                  onThinned={setOmitted}
                  looks={looks}
                  summary={summary}
                  active={active}
                  onActive={onActive}
                  onPick={onPick}
                  onProbe={onProbe}
                  words={words}
                  units={figureUnits}
                />
              </FigureGuard>
            )}
            {reading ? <p className="mp-frame__reading">{reading}</p> : null}
            {settleLine ? <p className="mp-frame__reading mp-frame__settle">{settleLine}</p> : null}
            {r && !onPaper ? (
              <div className="mp-frame__readout">
                <label className="mp-num mp-num--select">
                  <span className="mp-num__label">{w.results.readout.pick}</span>
                  <span className="mp-num__box">
                    <select
                      className="mp-num__input"
                      value={picked ?? 0}
                      onChange={(e) => {
                        const n = Number(e.target.value);
                        setPicked(n === 0 ? null : n);
                        setProbe(n === 0 ? null : { member: n, share: 0.5 });
                      }}
                    >
                      <option value={0}>{w.results.readout.none}</option>
                      {r.members.map((m) => (
                        <option key={m.label} value={m.label}>
                          {m.label}
                        </option>
                      ))}
                    </select>
                  </span>
                </label>
                {readLine && readValues ? (
                  <>
                    <label className="mp-frame__slider">
                      <span className="mp-num__label">{fill(w.results.readout.position, { member: readLine.label })}</span>
                      <input
                        type="range"
                        min={0}
                        max={100}
                        step={1}
                        value={Math.round(share * 100)}
                        aria-valuetext={readAria}
                        onChange={(e) => setProbe({ member: readLine.label, share: Number(e.target.value) / 100 })}
                      />
                    </label>
                    <p className="mp-app__computed mp-frame__readline">{readText}</p>
                  </>
                ) : (
                  <p className="mp-app__note">{w.results.readout.hint}</p>
                )}
              </div>
            ) : null}
            {r ? null : <p className="mp-app__need">{w.results.waiting}</p>}
          </div>
        </section>
      </div>

      {/* -- the numbers: under the form and the drawing, on paper too -- */}
      <FrameResults a={a} w={w} t={t} fmt={fmt} order={order} onOrder={setOrder} active={active} picked={picked} onPick={onPick} onHover={onActive} id={resultsId} busy={catching} />
      <p className="mp-app__note mp-frame__method">{w.results.method}</p>

      <p className="mp-app__privacy">{t.results.privacy}</p>
      {/* On paper only: when the sheet was printed, and the address that opens this very frame again. */}
      <SheetStamp stamp={stamp} t={{ printed: t.sheet.printed, link: w.sheet.link }} />
    </div>
  );
}
