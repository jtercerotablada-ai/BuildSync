'use client';

import React, { memo, useCallback, useDeferredValue, useId, useMemo, useReducer, useRef, useState } from 'react';
import { flushSync } from 'react-dom';
import { formatNumber } from '@/lib/calc/format';
import { analyseSafely, type AnalysisIssue, type MemberLine } from '@/lib/calc/truss/analysis';
import {
  MAX_LOADS,
  MAX_MEMBERS,
  MAX_NODES,
  MAX_SUPPORTS,
  TRUSS_KEY,
  TRUSS_UNITS,
  decodeTruss,
  defaultTruss,
  encodeTruss,
  reduceTruss,
  type TrussAction,
  type TrussForm,
  type TrussList,
  type TrussMaterial,
  type TrussNotice,
  type TrussRow,
} from '@/lib/calc/truss/model';
import type { Clamp, SupportLayout, TemplateId } from '@/lib/calc/truss/templates';
import { TEMPLATE_DEFAULTS, TEMPLATE_IDS, TEMPLATE_SPECS, buildTemplate } from '@/lib/calc/truss/templates';
import type { TrussShared, TrussUi } from '@/lib/calc/truss/strings';
import { NumField } from '../NumField';
import { Actions } from '../shell/Actions';
import { useAddress } from '../shell/address';
import { select } from '../shell/fields';
import { PAPER_WIDTH, useTooTall, useWidth } from '../shell/layout';
import { arrow } from '../shell/results';
import { SheetStamp, useSheet } from '../shell/sheet';
import { TrussSchematic, canDeform, forceText } from './TrussSchematic';
import { fill, issueSentence, listOf, sortMembers, type Order } from './text';
import './truss.css';

/**
 * TRUSS MEMBER FORCES - the calculator (/resources/truss).
 *
 * The fifth calculator of the catalogue, and the fourth one's sibling
 * (shaft/ShaftCalculator.tsx): the form on the left, the answer on the right
 * and nothing between them - every keystroke that leaves a number in a field
 * solves the truss again, a moment after the key and not inside it (`solved`,
 * below); the address follows the truss (`#t=...`); nothing leaves the browser;
 * its words are props; it renders on the server with its example. What is the
 * same from one calculator to the next is the shell's (../shell) and the
 * number field (../NumField), used here as they are and not copied.
 *
 * WHAT IS THIS ONE'S. A plane pin-jointed truss entered as FOUR TABLES - nodes,
 * members, supports, loads - or started from one of nine TEMPLATES and edited.
 * The answer is the axial force in every member (tension positive), the
 * reactions, the equilibrium check, the zero-force members with the reason for
 * each, and - where every member has an area and a modulus - the stresses, the
 * elongations and the displacements of the nodes. The drawing colours the
 * members by their force and a member picked in a table (or under the pointer in
 * the drawing) is marked in both.
 *
 * All the arithmetic is in lib/calc/truss: `model.ts` (the form, what each edit
 * does to it, the address), `engine.ts` (the truss), `templates.ts`, and
 * `analysis.ts`, which hands this file every number it prints ALREADY SETTLED
 * and in the units shown - what is rounding is zero there, once. This file is the
 * form, the tables and the wiring: it decides nothing about a number. What it
 * does decide is how one is written, and the sentence that goes with each code.
 *
 * TWO SETS OF WORDS. `t` is the part of the first calculator's that says the
 * same on any calculator (lib/calc/truss/strings.ts, `TrussShared`). `w` is what
 * is about a truss. Neither file is imported here - both languages would travel
 * with the script.
 *
 * NODES ARE SHOWN BY THEIR LABEL, their place in the list from 1; the form holds
 * ids so that deleting a node renumbers the labels after it and nothing else.
 */

/** The example truss, as it is written in an address. */
const EXAMPLE = encodeTruss(defaultTruss());

const Schematic = memo(TrussSchematic);

const LIMITS: Record<TrussList, number> = { nodes: MAX_NODES, members: MAX_MEMBERS, supports: MAX_SUPPORTS, loads: MAX_LOADS };

/**
 * What the fragment of an address opens. `undefined`: it is not this
 * calculator's (`#main` is a place on the page; `#h=...` is the shaft's). `null`:
 * it is, and cannot be read - its key with nothing after it included.
 */
function caseIn(hash: string): TrussForm | null | undefined {
  const m = hash.match(new RegExp(`^#${TRUSS_KEY}=(.*)$`));
  if (!m) return undefined;
  let text = m[1];
  try {
    text = decodeURIComponent(text);
  } catch {
    /* not percent-encoded: read as it is */
  }
  return decodeTruss(text);
}

/**
 * A form but for the numbers typed into it: its units, its rows, every choice
 * made in it - and the ids by which a member names its nodes, which are numbers
 * but not typed ones: a member moved to another node is a different truss, solved
 * in the render that shows it.
 */
const IDENTIFIERS = new Set(['id', 'i', 'j', 'node', 'nextId']);
const choicesOf = (form: TrussForm) => JSON.stringify(form, (key, value: unknown) => (typeof value === 'number' && !IDENTIFIERS.has(key) ? 0 : value));

/** A row of the form as one word: two issues are on the same row when theirs are the same. */
const rowKey = (row: TrussRow) => (row.list === 'model' ? `model${row.field}` : `${row.list}${row.id}`);

/** What the template group holds: not part of the case, a few numbers for the next template to load. */
interface TemplateState {
  template: TemplateId;
  span: number;
  height: number;
  panels: number;
  load: number;
  supports: SupportLayout;
}
const templateDefaults = (template: TemplateId, units: TrussForm['units']): TemplateState => {
  const d = TEMPLATE_DEFAULTS[units][template];
  return { template, span: d.span, height: d.height, panels: d.panels, load: d.load, supports: TEMPLATE_SPECS[template].layouts[0] };
};

/** The one that opens "Pratt" is the example's own. */
const FIRST_TEMPLATE: TemplateId = 'pratt';

/**
 * `initial`: the truss it opens with, where that is not the example - for the
 * tests, which can neither type nor press.
 */
export function TrussCalculator({ t, w, initial }: { t: TrussShared; w: TrussUi; initial?: TrussForm }) {
  const [form, dispatchRaw] = useReducer(reduceTruss, initial, (given) => given ?? defaultTruss());
  // The truss last put on screen whole - opened from the address, or the example on "Start over": that one is
  // solved in the render that shows it (`solved`, below), never a moment later under the results of the truss before.
  const [whole, setWhole] = useState<TrussForm | null>(null);
  const [tpl, setTpl] = useState<TemplateState>(() => templateDefaults(FIRST_TEMPLATE, (initial ?? { units: 'us' }).units));
  // What "Load template" said it did; gone with the next edit of any kind.
  const [said, setSaid] = useState('');
  const [show, setShow] = useState({ forces: true, numbers: false, deformed: false });
  const [order, setOrder] = useState<Order>('member');
  // The member under the pointer or the keyboard's focus, and the one picked (pressed in a table or the drawing).
  const [hover, setHover] = useState<number | null>(null);
  const [picked, setPicked] = useState<number | null>(null);
  const uid = useId();
  // The calculator itself: a truss opened from the address asks whether the focus is in one of its fields.
  const root = useRef<HTMLDivElement>(null);
  const [plotRef, windowWidth] = useWidth<HTMLDivElement>();
  const [outRef, tooTall] = useTooTall<HTMLElement>();
  const u = TRUSS_UNITS[form.units];
  const group = t.numbers.group;

  // Any edit but a number typed into a field puts the member marks away (a label is a place in a list and means
  // another member once one before it is gone) and takes back the line "Load template" said.
  const dispatch = useCallback((action: TrussAction) => {
    setSaid('');
    if (action.type !== 'patch' && action.type !== 'section' && action.type !== 'material') {
      setPicked(null);
      setHover(null);
    }
    dispatchRaw(action);
  }, []);

  // THE ADDRESS FOLLOWS THE TRUSS (../shell/address.ts).
  const code = useCallback(() => encodeTruss(form), [form]);
  const address = useAddress<TrussForm>({
    key: TRUSS_KEY,
    example: EXAMPLE,
    code,
    read: caseIn,
    blank: defaultTruss,
    // A truss in the address opens as that truss.
    open: (found) => {
      // An edit in progress is an edit of the truss before, and ends here. The field with the focus is left FIRST:
      // it would go on showing what was typed into that truss, and fall back on that truss's value at the first key
      // that is not a number (NumField).
      const focused = document.activeElement;
      if (focused instanceof HTMLInputElement && root.current?.contains(focused)) focused.blur();
      dispatch({ type: 'load', form: found });
      setWhole(found);
      setTpl(templateDefaults(FIRST_TEMPLATE, found.units));
    },
  });
  const { linkError } = address;
  // The printed sheet gives the address that opens this very truss, and while it prints the drawing is the sheet's size.
  const { stamp, onPaper } = useSheet({ locale: t.sheet.locale, url: () => address.link(encodeTruss(form)) });
  const width = onPaper ? PAPER_WIDTH : windowWidth;

  // WHICH TRUSS IS SOLVED. A truss of forty nodes and a hundred and twenty members is some sixty milliseconds of
  // arithmetic on a desktop and several times that on a phone, and inside the keystroke that kept the key off the
  // screen for as long. So while only NUMBERS change, the answer is of the form as it was a moment ago
  // (`useDeferredValue`): the key shows at once, and the truss is solved in a render of its own, which the next key
  // may interrupt. The results say so while they are behind (`aria-busy`). Anything else - the units, a row added or
  // removed, a choice in a list, a member moved to another node, a truss opened whole - is solved in the same render
  // as ever: the answer must never stand under other units, beside rows it was not solved for, or under a truss it
  // is not of. And on paper it is the form itself: a sheet is never printed with the answer of the truss before.
  const behind = useDeferredValue(form);
  const solved = onPaper || form === whole || choicesOf(behind) !== choicesOf(form) ? form : behind;
  const catching = solved !== form;

  // Everything the page prints (lib/calc/truss/analysis.ts) - through the door that never throws.
  const a = useMemo(() => analyseSafely(solved), [solved]);
  const r = a.results;
  const ru = a.units;

  // The marks are of a member that is there.
  const known = (label: number | null) => (label !== null && label <= solved.members.length ? label : null);
  const active = known(hover) ?? known(picked);
  const onActive = useCallback((label: number | null) => setHover(label), []);
  const onPick = useCallback((label: number) => setPicked((p) => (p === label ? null : label)), []);
  const flagged = useMemo(() => {
    const ring = new Set<number>();
    for (const i of a.issues) if (i.code === 'mechanism' || i.code === 'node-unconnected' || i.code === 'duplicate-node' || i.code === 'duplicate-support') for (const n of i.nodes ?? []) ring.add(n);
    return [...ring].sort((p, q) => p - q);
  }, [a]);

  // Every number this page prints, with the page's own mark between thousands.
  const num = (v: number, sig = 4) => formatNumber(v, sig, group).replace(' × ', ' × ');
  const signedNum = (v: number, sig = 4) => forceText(v, group, sig);
  const pointed = (v: number, plus: string, minus: string) => (
    <>
      {num(Math.abs(v))} <span className="mp-app__dir">{v === 0 ? '' : arrow(v, plus, minus)}</span>
    </>
  );

  /* -- The faults, by row -- */
  const listName: Record<TrussList, string> = { nodes: w.nodes.name, members: w.members.name, supports: w.supports.name, loads: w.loads.name };
  const says = (issue: AnalysisIssue, where = false): string => {
    const text = issueSentence(issue, w);
    if (!where || !issue.row) return text;
    return `${issue.row.list === 'model' ? t.section.title : `${listName[issue.row.list]} ${issue.at ?? ''}`.trim()}: ${text}`;
  };
  // The faults of one row of a list: those that name it, and for a node those that name its label.
  const issuesOf = (list: TrussList, id: number): AnalysisIssue[] => {
    const label = list === 'nodes' ? solved.nodes.findIndex((n) => n.id === id) + 1 : 0;
    return a.issues.filter((i) => (i.row && i.row.list === list && i.row.id === id) || (list === 'nodes' && (i.code === 'duplicate-node' || i.code === 'node-unconnected') && i.nodes?.includes(label)));
  };
  const sectionIssues = (field: 'E' | 'A') => a.issues.filter((i) => i.row?.list === 'model' && i.row.field === field);
  const idOf = (key: string) => `${uid}${key}`;
  // A field of a row at fault: marked, and tied to the row's message. The field the fault is about - every field, when it names none.
  const fault = (list: TrussList, id: number, ...fields: string[]) => {
    const mine = issuesOf(list, id).filter((i) => !i.row?.field || fields.length === 0 || fields.includes(i.row.field));
    return mine.length ? { invalid: true, describedBy: idOf(rowKey({ list, id })) } : {};
  };
  const sectionFault = (field: 'E' | 'A') => (sectionIssues(field).length ? { invalid: true, describedBy: idOf(`model${field}`) } : {});
  const rowIssue = (key: string, issues: AnalysisIssue[]) => {
    const texts = [...new Set(issues.map((i) => says(i)))];
    return texts.length ? (
      <p className="mp-app__row-error" id={idOf(key)}>
        {texts.join(' ')}
      </p>
    ) : null;
  };
  // What the results box says, each thing once.
  const notices = a.issues.map((i) => ({ id: i.row ? undefined : `${uid}${i.code}`, text: says(i, true) })).filter((n, i, all) => all.findIndex((m) => m.text === n.text) === i);

  /* -- The rows of the form -- */
  const patch = (list: TrussList, id: number, p: Record<string, unknown>) => dispatch({ type: 'patch', list, id, patch: p });
  // A row removed WITH THE KEYBOARD took the focus away with it, and the browser left it on nothing. It is given to the
  // first control of the row that takes the place - the next one, else the one before - or to the group's "add" button
  // when no row is left. Not after a click or a tap (`detail` counts them, and is 0 for a key).
  const removeRow = (list: TrussList, id: number) => (press: React.MouseEvent<HTMLButtonElement>) => {
    const row = press.currentTarget.closest('.mp-app__item');
    const near = [row?.nextElementSibling, row?.previousElementSibling].find((el) => el?.classList.contains('mp-app__item'));
    const next = press.detail === 0 ? (near?.querySelector<HTMLElement>('input, select') ?? press.currentTarget.closest('fieldset')?.querySelector<HTMLElement>('.mp-app__add')) : null;
    dispatch({ type: 'remove', list, id });
    next?.focus();
  };
  const removeButton = (list: TrussList, id: number, what: string) => (
    <button type="button" className="mp-app__remove" onClick={removeRow(list, id)} aria-label={`${t.row.remove}: ${what}`} title={t.row.remove}>
      <span aria-hidden="true">×</span>
    </button>
  );
  // A row added WITH THE KEYBOARD is handed the focus, in its first field. The row is put on screen first (`flushSync`).
  const addRow = (list: TrussList) => (press: React.MouseEvent<HTMLButtonElement>) => {
    if (press.detail !== 0) {
      dispatch({ type: 'add', list });
      return;
    }
    const fieldset = press.currentTarget.closest('fieldset');
    flushSync(() => dispatch({ type: 'add', list }));
    const rows = fieldset?.querySelectorAll('.mp-app__item');
    rows?.[rows.length - 1]?.querySelector<HTMLElement>('input, select')?.focus();
  };
  // A list at its limit: the button stays where it is and does nothing, and the limit is a line of the page under it.
  const limitLine = (list: TrussList) => fill(w.limit, { max: LIMITS[list], list: w.lists[list] });
  const addButton = (list: TrussList, label: string) => {
    const full = form[list].length >= LIMITS[list];
    const limited = full || (form.notice?.code === 'limit' && form.notice.list === list);
    return (
      <>
        <button type="button" className="mp-app__add" onClick={full ? undefined : addRow(list)} aria-disabled={full || undefined} aria-describedby={limited ? `${uid}${list}limit` : undefined}>
          <span aria-hidden="true">+</span> {label}
        </button>
        {limited ? (
          <p className="mp-truss__limit" id={`${uid}${list}limit`} role="status">
            {limitLine(list)}
          </p>
        ) : null}
      </>
    );
  };

  // A list of nodes, read by label. Named with its row, since a form has dozens of lists of "From node".
  const nodePick = (label: string, rowName: string, value: number, onChange: (id: number) => void, extra: { invalid?: boolean; describedBy?: string } = {}) => (
    <label className="mp-num mp-num--select" data-invalid={extra.invalid ? 'true' : undefined}>
      <span className="mp-num__label">{label}</span>
      <span className="mp-num__box">
        <select className="mp-num__input" aria-label={`${label}, ${rowName}`} aria-invalid={extra.invalid ? true : undefined} aria-describedby={extra.describedBy} value={value} onChange={(e) => onChange(Number(e.target.value))}>
          {form.nodes.map((n, k) => (
            <option key={n.id} value={n.id}>
              {k + 1}
            </option>
          ))}
        </select>
      </span>
    </label>
  );
  const kindPick = (rowName: string, value: 'pin' | 'roller', onChange: (kind: 'pin' | 'roller') => void) => (
    <label className="mp-num mp-num--select">
      <span className="mp-num__label">{w.supports.kind}</span>
      <span className="mp-num__box">
        <select className="mp-num__input" aria-label={`${w.supports.kind}, ${rowName}`} value={value} onChange={(e) => onChange(e.target.value as 'pin' | 'roller')}>
          <option value="pin">{w.supports.kinds.pin}</option>
          <option value="roller">{w.supports.kinds.roller}</option>
        </select>
      </span>
    </label>
  );
  // An optional number: an empty field is "not given" (null), which the field knows as a value that is not a number.
  const optionalNumber = (value: number | null) => value ?? Number.NaN;
  const fromField = (v: number) => (Number.isNaN(v) ? null : v);

  // One row of a list: its name for the eye, its fields, the button that removes it and what is wrong with it.
  const item = (list: TrussList, id: number, index: number, fields: React.ReactNode) => {
    const name = `${listName[list]} ${index + 1}`;
    const issues = issuesOf(list, id);
    return (
      <div key={id} className="mp-app__item mp-truss__item" role="group" aria-label={name} data-invalid={issues.length ? 'true' : undefined}>
        <p className="mp-truss__name" aria-hidden="true">
          {name}
        </p>
        <div className="mp-app__row mp-app__row--rm">
          <div className="mp-app__fields mp-truss__fields">{fields}</div>
          {removeButton(list, id, name)}
        </div>
        {rowIssue(rowKey({ list, id }), issues)}
      </div>
    );
  };

  /* -- The notices of the form -- */
  const noticeText = (n: TrussNotice | null): { where: TrussList | 'template'; text: string } | null => {
    if (!n) return null;
    if (n.code === 'node-removed') {
      return {
        where: 'nodes',
        text: [
          fill(w.removed.node, { node: n.node }),
          n.members.length ? fill(w.removed.members, { count: n.members.length, list: listOf(n.members, w.words.and) }) : '',
          n.supports ? fill(w.removed.supports, { count: n.supports }) : '',
          n.loads ? fill(w.removed.loads, { count: n.loads }) : '',
          n.renumbered ? w.removed.renumbered : '',
        ]
          .filter(Boolean)
          .join(' '),
      };
    }
    if (n.code === 'template') {
      const asText = (c: Clamp, v: number | string) => {
        if (c.field === 'supports') return typeof v === 'string' && v in w.template.layouts ? w.template.layouts[v as SupportLayout] : '—';
        return typeof v === 'number' ? num(v, 6) : '—';
      };
      const unit = (c: Clamp) => (c.field === 'load' ? u.force : u.length);
      return { where: 'template', text: n.clamped.map((c) => fill(w.template.clamped[c.field], { asked: asText(c, c.asked), used: asText(c, c.used), unit: unit(c) })).join(' ') };
    }
    return null;
  };
  const notice = noticeText(form.notice);

  /* -- The template group -- */
  const spec = TEMPLATE_SPECS[tpl.template];
  const setTemplate = (template: TemplateId) => setTpl(templateDefaults(template, form.units));
  const applyTemplate = () => {
    const params = { span: tpl.span, height: tpl.height, panels: tpl.panels, load: tpl.load, supports: tpl.supports };
    dispatch({ type: 'template', template: tpl.template, params });
    const built = buildTemplate(tpl.template, params, form.units);
    setSaid(fill(w.template.done, { template: w.template.names[tpl.template], nodes: built.nodes.length, members: built.members.length, supports: built.supports.length, loads: built.loads.length }));
  };

  /* -- The tables -- */
  // A head of a table: what the column is and, after it, its unit - in the mono of every unit on the page.
  const head = (title: string, unit?: string) => (
    <>
      {title}
      {unit ? <span className="mp-plot__unit"> ({unit})</span> : null}
    </>
  );
  // The same head inside a cell, for a phone: there a row is laid out as lines of its own and each cell stands under
  // its head (truss.css). Out of sight anywhere else, and silent everywhere: the table's own heads are read.
  const under = (title: string, unit?: string) => (
    <span className="mp-truss__head" aria-hidden="true">
      {head(title, unit)}
    </span>
  );
  // A member, as a button that marks it on the drawing: the keyboard's way to the drawing, and a finger's.
  const memberButton = (label: number) => (
    <button
      type="button"
      className="mp-truss__pick"
      aria-pressed={picked === label}
      aria-label={`${w.results.forces.member} ${label}`}
      title={w.results.forces.pick}
      onClick={() => onPick(label)}
      onFocus={() => setHover(label)}
      onBlur={() => setHover(null)}
    >
      {label}
    </button>
  );
  const rowMarks = (label: number) => ({
    'data-active': active === label ? 'true' : undefined,
    onPointerEnter: (e: React.PointerEvent) => {
      if (e.pointerType === 'mouse') setHover(label);
    },
    onPointerLeave: (e: React.PointerEvent) => {
      if (e.pointerType === 'mouse') setHover(null);
    },
  });

  const sorted = useMemo<MemberLine[]>(() => (r ? sortMembers(r.members, order) : []), [r, order]);

  const showStress = r ? r.members.some((m) => m.stress !== null) : false;
  const showElongation = r ? r.members.some((m) => m.elongation !== null) : false;
  const stateWord = (m: MemberLine) => (m.state === 'tension' ? w.results.forces.tension : m.state === 'compression' ? w.results.forces.compression : w.results.forces.zero);
  const extreme = (e: { member: number; force: number } | null) => (e ? `${fill(w.results.memberOf, { member: e.member })}, ${signedNum(e.force)} ${ru.force}` : w.results.none);

  const cards = r ? (
    <div className="mp-app__tables mp-truss__tables" aria-busy={catching ? true : undefined}>
      <div className="mp-app__card mp-app__card--wide">
        <h3 className="mp-app__h">{t.results.reactions}</h3>
        <table className="mp-app__table mp-truss__table" role="table">
          <thead role="rowgroup">
            <tr role="row">
              <th scope="col" role="columnheader">
                {head(t.results.support)}
              </th>
              <th scope="col" role="columnheader">
                {head(w.results.reaction.node)}
              </th>
              <th scope="col" role="columnheader">
                {head(w.results.reaction.kind)}
              </th>
              <th scope="col" role="columnheader">
                {head(w.results.reaction.rx, ru.force)}
              </th>
              <th scope="col" role="columnheader">
                {head(w.results.reaction.ry, ru.force)}
              </th>
              <th scope="col" role="columnheader">
                {head(w.results.reaction.size, ru.force)}
              </th>
              <th scope="col" role="columnheader">
                {head(w.results.reaction.along, ru.force)}
              </th>
            </tr>
          </thead>
          <tbody role="rowgroup">
            {r.reactions.map((x) => (
              <tr key={x.label} role="row">
                <th scope="row" role="rowheader">
                  {under(t.results.support)}
                  {x.label}
                </th>
                <td role="cell">
                  {under(w.results.reaction.node)}
                  {x.node}
                </td>
                <td role="cell">
                  {under(w.results.reaction.kind)}
                  {x.kind === 'pin' ? w.results.reaction.pin : fill(w.results.reaction.roller, { angle: num(x.angle ?? 90) })}
                </td>
                <td role="cell">
                  {under(w.results.reaction.rx, ru.force)}
                  {pointed(x.rx, w.results.reaction.right, w.results.reaction.left)}
                </td>
                <td role="cell">
                  {under(w.results.reaction.ry, ru.force)}
                  {pointed(x.ry, t.results.upward, t.results.downward)}
                </td>
                <td role="cell">
                  {under(w.results.reaction.size, ru.force)}
                  {num(x.magnitude)}
                </td>
                <td role="cell">
                  {under(w.results.reaction.along, ru.force)}
                  {x.along === null ? '—' : signedNum(x.along)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        <p className="mp-app__note">{w.results.reaction.alongNote}</p>
      </div>

      <div className="mp-app__card mp-app__card--wide">
        <h3 className="mp-app__h">{w.results.forces.title}</h3>
        <label className="mp-num mp-num--select mp-truss__order">
          <span className="mp-num__label">{w.results.forces.order}</span>
          <span className="mp-num__box">
            <select className="mp-num__input" value={order} onChange={(e) => setOrder(e.target.value as Order)}>
              <option value="member">{w.results.forces.orders.member}</option>
              <option value="largest">{w.results.forces.orders.largest}</option>
              <option value="tension">{w.results.forces.orders.tension}</option>
            </select>
          </span>
        </label>
        <table className="mp-app__table mp-truss__table mp-truss__table--members" role="table">
          <thead role="rowgroup">
            <tr role="row">
              <th scope="col" role="columnheader">
                {head(w.results.forces.member)}
              </th>
              <th scope="col" role="columnheader">
                {head(w.results.forces.nodes)}
              </th>
              <th scope="col" role="columnheader">
                {head(t.beam.length, ru.length)}
              </th>
              <th scope="col" role="columnheader">
                {head(w.results.forces.force, ru.force)}
              </th>
              <th scope="col" role="columnheader">
                {head(w.results.forces.state)}
              </th>
              {showStress ? (
                <th scope="col" role="columnheader">
                  {head(w.results.forces.stress, ru.stress)}
                </th>
              ) : null}
              {showElongation ? (
                <th scope="col" role="columnheader">
                  {head(w.results.forces.elongation, ru.displacement)}
                </th>
              ) : null}
            </tr>
          </thead>
          <tbody role="rowgroup">
            {sorted.map((m) => (
              <tr key={m.label} role="row" className="mp-truss__member" {...rowMarks(m.label)}>
                <th scope="row" role="rowheader">
                  {under(w.results.forces.member)}
                  {memberButton(m.label)}
                </th>
                <td role="cell">
                  {under(w.results.forces.nodes)}
                  {m.i} – {m.j}
                </td>
                <td role="cell">
                  {under(t.beam.length, ru.length)}
                  {num(m.length)}
                </td>
                <td role="cell" className={`mp-truss__force mp-truss__force--${m.state}`}>
                  {under(w.results.forces.force, ru.force)}
                  {signedNum(m.force)}
                </td>
                <td role="cell">
                  {under(w.results.forces.state)}
                  {stateWord(m)}
                  {r.largest.tension?.member === m.label ? <span className="mp-app__dir mp-truss__largest"> · {w.results.forces.largestTension}</span> : null}
                  {r.largest.compression?.member === m.label ? <span className="mp-app__dir mp-truss__largest"> · {w.results.forces.largestCompression}</span> : null}
                </td>
                {showStress ? (
                  <td role="cell">
                    {under(w.results.forces.stress, ru.stress)}
                    {m.stress === null ? '—' : signedNum(m.stress)}
                  </td>
                ) : null}
                {showElongation ? (
                  <td role="cell">
                    {under(w.results.forces.elongation, ru.displacement)}
                    {m.elongation === null ? '—' : signedNum(m.elongation)}
                  </td>
                ) : null}
              </tr>
            ))}
          </tbody>
        </table>
        <p className="mp-app__note">{w.results.forces.signs}</p>
        {showStress ? <p className="mp-app__note">{w.results.forces.stressNote}</p> : null}
        {r.displacements === null ? <p className="mp-app__note">{w.results.displacements.equal}</p> : null}
      </div>

      {r.displacements ? (
        <div className="mp-app__card mp-app__card--wide">
          <h3 className="mp-app__h">{w.results.displacements.title}</h3>
          <table className="mp-app__table mp-truss__table" role="table">
            <thead role="rowgroup">
              <tr role="row">
                <th scope="col" role="columnheader">
                  {head(w.results.displacements.node)}
                </th>
                <th scope="col" role="columnheader">
                  {head(w.results.displacements.ux, ru.displacement)}
                </th>
                <th scope="col" role="columnheader">
                  {head(w.results.displacements.uy, ru.displacement)}
                </th>
                <th scope="col" role="columnheader">
                  {head(w.results.displacements.size, ru.displacement)}
                </th>
              </tr>
            </thead>
            <tbody role="rowgroup">
              {r.displacements.map((d) => (
                <tr key={d.node} role="row">
                  <th scope="row" role="rowheader">
                    {under(w.results.displacements.node)}
                    {d.node}
                  </th>
                  <td role="cell">
                    {under(w.results.displacements.ux, ru.displacement)}
                    {signedNum(d.ux)}
                  </td>
                  <td role="cell">
                    {under(w.results.displacements.uy, ru.displacement)}
                    {signedNum(d.uy)}
                  </td>
                  <td role="cell">
                    {under(w.results.displacements.size, ru.displacement)}
                    {num(d.magnitude)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="mp-app__note">{w.results.displacements.note}</p>
        </div>
      ) : null}

      <div className="mp-app__card">
        <h3 className="mp-app__h">{w.results.equilibrium.title}</h3>
        <dl className="mp-app__dl">
          <div>
            <dt>{w.results.equilibrium.loads}</dt>
            <dd>
              Fx {signedNum(r.applied.fx)} · Fy {signedNum(r.applied.fy)} {ru.force}
            </dd>
          </div>
          <div>
            <dt>{w.results.equilibrium.sumFx}</dt>
            <dd>
              {num(r.equilibrium.sumFx)} {ru.force}
            </dd>
          </div>
          <div>
            <dt>{w.results.equilibrium.sumFy}</dt>
            <dd>
              {num(r.equilibrium.sumFy)} {ru.force}
            </dd>
          </div>
          <div>
            <dt>{fill(w.results.equilibrium.sumM, { x: num(r.equilibrium.about.x), y: num(r.equilibrium.about.y) })}</dt>
            <dd>
              {num(r.equilibrium.sumM)} {ru.moment}
            </dd>
          </div>
          <div>
            <dt>{w.results.equilibrium.joint}</dt>
            <dd>
              {num(r.equilibrium.joint)} {ru.force}
            </dd>
          </div>
        </dl>
        {r.equilibrium.balanced ? <p className="mp-app__note mp-truss__balanced">{w.results.equilibrium.balanced}</p> : <p className="mp-app__row-error">{w.results.equilibrium.unbalanced}</p>}
      </div>

      <div className="mp-app__card">
        <h3 className="mp-app__h">{w.results.zero.title}</h3>
        {r.zeroMembers.length === 0 ? (
          <p className="mp-app__note">{w.results.zero.none}</p>
        ) : (
          <ul className="mp-truss__zero">
            {r.zeroMembers.map((label) => {
              const why = r.inspection.find((z) => z.member === label);
              const m = r.members[label - 1];
              return (
                <li key={label} {...rowMarks(label)}>
                  <span className="mp-truss__zero-name">
                    {memberButton(label)} <span className="mp-app__dir">({m.i} – {m.j})</span>
                  </span>{' '}
                  {why ? fill(w.results.zero.rule[why.rule], { node: why.node }) : w.results.zero.solved}
                </li>
              );
            })}
          </ul>
        )}
        <p className="mp-app__note">{w.results.zero.note}</p>
      </div>
    </div>
  ) : null;

  /* -- The drawing in words -- */
  const summaryOf = (): string => {
    if (solved.nodes.length === 0) return w.results.drawing.empty;
    const parts = [fill(w.results.drawing.truss, { nodes: solved.nodes.length, members: solved.members.length, supports: solved.supports.length, loads: solved.loads.length })];
    if (r) {
      parts.push(fill(w.results.drawing.largest, { tension: extreme(r.largest.tension), compression: extreme(r.largest.compression) }));
      if (r.reactions.length) parts.push(fill(w.results.drawing.reactions, { list: r.reactions.map((x) => `${w.results.reaction.node} ${x.node}: ${num(x.magnitude)} ${ru.force}`).join('; ') }));
    } else parts.push(w.results.drawing.unsolved);
    return parts.join(' ');
  };
  const summary = summaryOf();

  // The box of notices.
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

  const degree = a.determinacy.members + a.determinacy.reactions - 2 * a.determinacy.joints;
  const word = a.determinacy.word;
  const deformable = canDeform(a.drawing);

  return (
    <div className={onPaper ? 'mp-app mp-truss mp-truss--sheet' : 'mp-app mp-truss'} ref={root}>
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
                    name="truss-units"
                    checked={form.units === unit}
                    onChange={() => {
                      dispatch({ type: 'units', units: unit });
                      // A span typed in feet is not that many metres.
                      setTpl(templateDefaults(tpl.template, unit));
                    }}
                  />
                  <span>{w.toolbar[unit]}</span>
                </label>
              ))}
            </fieldset>
          </div>

          {/* A starting point, not part of the case: it is not printed. */}
          <fieldset className="mp-app__group mp-truss__template">
            <legend>{w.template.title}</legend>
            <div className="mp-app__row mp-app__row--two">
              {select<TemplateId>(w.template.pick, tpl.template, TEMPLATE_IDS.map((id) => [id, w.template.names[id]] as [TemplateId, string]), setTemplate)}
              {select<SupportLayout>(w.template.layout, tpl.supports, spec.layouts.map((l) => [l, w.template.layouts[l]] as [SupportLayout, string]), (supports) => setTpl({ ...tpl, supports }))}
            </div>
            <div className="mp-app__row mp-app__row--two">
              <NumField numbers={t.numbers} label={w.template.span} unit={u.length} value={tpl.span} onChange={(span) => setTpl({ ...tpl, span })} />
              <NumField numbers={t.numbers} label={w.template.depth} unit={u.length} value={tpl.height} onChange={(height) => setTpl({ ...tpl, height })} />
              {spec.panels.fixed ? null : <NumField numbers={t.numbers} label={w.template.panels} value={tpl.panels} onChange={(panels) => setTpl({ ...tpl, panels })} />}
              <NumField numbers={t.numbers} label={w.template.load} unit={u.force} value={tpl.load} onChange={(load) => setTpl({ ...tpl, load })} />
            </div>
            {spec.panels.fixed ? <p className="mp-app__note">{w.template.fixed}</p> : null}
            <button type="button" className="mp-app__btn" onClick={applyTemplate}>
              {w.template.apply}
            </button>
            {said ? (
              <p className="mp-app__computed mp-truss__said" role="status">
                {said}
              </p>
            ) : null}
            {notice?.where === 'template' ? (
              <p className="mp-truss__notice" role="status">
                {notice.text}
              </p>
            ) : null}
            <p className="mp-app__note">{w.template.note}</p>
          </fieldset>

          <fieldset className="mp-app__group">
            <legend>{w.nodes.title}</legend>
            <p className="mp-app__note">{w.nodes.note}</p>
            {form.nodes.length === 0 ? <p className="mp-app__none">{t.loads.none}</p> : null}
            {form.nodes.map((n, i) =>
              item(
                'nodes',
                n.id,
                i,
                <>
                  <NumField numbers={t.numbers} label={w.nodes.x} unit={u.length} value={n.x} onChange={(x) => patch('nodes', n.id, { x })} {...fault('nodes', n.id, 'x')} />
                  <NumField numbers={t.numbers} label={w.nodes.y} unit={u.length} value={n.y} onChange={(y) => patch('nodes', n.id, { y })} {...fault('nodes', n.id, 'y')} />
                </>,
              ),
            )}
            {addButton('nodes', w.nodes.add)}
            {notice?.where === 'nodes' ? (
              <p className="mp-truss__notice" role="status">
                {notice.text}
              </p>
            ) : null}
          </fieldset>

          <fieldset className="mp-app__group">
            <legend>{w.members.title}</legend>
            <p className="mp-app__note">{w.members.note}</p>
            {form.members.length === 0 ? <p className="mp-app__none">{t.loads.none}</p> : null}
            {form.members.map((m, i) =>
              item(
                'members',
                m.id,
                i,
                <>
                  {nodePick(w.members.from, `${w.members.name} ${i + 1}`, m.i, (id) => patch('members', m.id, { i: id }), fault('members', m.id, 'i'))}
                  {nodePick(w.members.to, `${w.members.name} ${i + 1}`, m.j, (id) => patch('members', m.id, { j: id }), fault('members', m.id, 'j'))}
                  <NumField
                    numbers={t.numbers}
                    label={w.members.area}
                    unit={u.area}
                    optional={t.section.optional}
                    value={optionalNumber(m.A)}
                    emptyIs={Number.NaN}
                    onChange={(A) => patch('members', m.id, { A: fromField(A) })}
                    {...fault('members', m.id, 'A')}
                  />
                  <NumField
                    numbers={t.numbers}
                    label={w.members.modulus}
                    unit={u.E}
                    optional={t.section.optional}
                    value={optionalNumber(m.E)}
                    emptyIs={Number.NaN}
                    onChange={(E) => patch('members', m.id, { E: fromField(E) })}
                    {...fault('members', m.id, 'E')}
                  />
                </>,
              ),
            )}
            {addButton('members', w.members.add)}
          </fieldset>

          <fieldset className="mp-app__group">
            <legend>{t.supports.title}</legend>
            <p className="mp-app__note">{w.supports.note}</p>
            {form.supports.length === 0 ? <p className="mp-app__none">{t.loads.none}</p> : null}
            {form.supports.map((s, i) =>
              item(
                'supports',
                s.id,
                i,
                <>
                  {nodePick(w.supports.node, `${w.supports.name} ${i + 1}`, s.node, (id) => patch('supports', s.id, { node: id }), fault('supports', s.id, 'node'))}
                  {kindPick(`${w.supports.name} ${i + 1}`, s.kind, (kind) => patch('supports', s.id, { kind }))}
                  {s.kind === 'roller' ? (
                    <NumField numbers={t.numbers} label={w.supports.angle} unit="°" value={s.angle} onChange={(angle) => patch('supports', s.id, { angle })} {...fault('supports', s.id, 'angle')} />
                  ) : null}
                </>,
              ),
            )}
            {addButton('supports', w.supports.add)}
          </fieldset>

          <fieldset className="mp-app__group">
            <legend>{t.loads.title}</legend>
            <p className="mp-app__note">{w.loads.note}</p>
            {form.loads.length === 0 ? <p className="mp-app__none">{t.loads.none}</p> : null}
            {form.loads.map((l, i) =>
              item(
                'loads',
                l.id,
                i,
                <>
                  {nodePick(w.loads.node, `${w.loads.name} ${i + 1}`, l.node, (id) => patch('loads', l.id, { node: id }), fault('loads', l.id, 'node'))}
                  <NumField numbers={t.numbers} label={w.loads.fx} unit={u.force} value={l.fx} onChange={(fx) => patch('loads', l.id, { fx })} {...fault('loads', l.id, 'fx')} />
                  <NumField numbers={t.numbers} label={w.loads.fy} unit={u.force} value={l.fy} onChange={(fy) => patch('loads', l.id, { fy })} {...fault('loads', l.id, 'fy')} />
                </>,
              ),
            )}
            {addButton('loads', w.loads.add)}
          </fieldset>

          <fieldset className="mp-app__group">
            <legend>{t.section.title}</legend>
            <div className="mp-app__row mp-app__row--two mp-truss__material">
              {select<TrussMaterial>(
                t.section.material,
                form.material,
                [
                  ['steel', t.section.materials.steel],
                  ['aluminum', t.section.materials.aluminum],
                  ['custom', t.section.materials.custom],
                ],
                (material) => dispatch({ type: 'material', material }),
              )}
              <NumField
                numbers={t.numbers}
                label={t.section.E}
                unit={u.E}
                value={optionalNumber(form.E)}
                emptyIs={Number.NaN}
                onChange={(E) => dispatch({ type: 'section', patch: { E: fromField(E) } })}
                {...sectionFault('E')}
              />
              <NumField
                numbers={t.numbers}
                label={w.material.area}
                unit={u.area}
                value={optionalNumber(form.A)}
                emptyIs={Number.NaN}
                onChange={(A) => dispatch({ type: 'section', patch: { A: fromField(A) } })}
                {...sectionFault('A')}
              />
            </div>
            {rowIssue('modelE', sectionIssues('E'))}
            {rowIssue('modelA', sectionIssues('A'))}
            <p className="mp-app__note">{w.material.note}</p>
          </fieldset>

          <Actions
            t={{ ...t.toolbar, copy: w.toolbar.copy }}
            copy={() => {
              // The address is brought to this truss too, and a link that could not be read has nothing left to say:
              // the one copied is the truss on screen.
              address.take(encodeTruss(form));
              return address.link(encodeTruss(form));
            }}
            reset={() => {
              // One press throws away whatever was typed, and nothing is asked. So the truss that goes - unless it is the
              // example - is left one step behind in the browser's history: Back brings it back, as the page opens any
              // truss its address holds (../shell/address.ts), and Forward returns to the example. The address is brought
              // to that truss first: the entry left behind is the one on screen.
              const thrown = encodeTruss(form);
              if (thrown !== EXAMPLE) {
                address.take(thrown);
                try {
                  window.history.pushState(window.history.state, '', window.location.href);
                } catch {
                  /* the way back is a convenience; the calculator works without it */
                }
              }
              const example = defaultTruss();
              dispatch({ type: 'load', form: example });
              setWhole(example);
              setTpl(templateDefaults(FIRST_TEMPLATE, 'us'));
              setOrder('member');
              // The address goes bare - if what is after the # is a truss.
              address.take(EXAMPLE);
            }}
          />
        </form>

        {/* -- the answer -- */}
        <section className={tooTall ? 'mp-app__out mp-app__out--tall' : 'mp-app__out'} aria-label={t.results.title} ref={outRef} aria-busy={catching ? true : undefined}>
          {box}

          {a.warnings.length ? (
            <div className="mp-truss__warnings" role="status">
              <p className="mp-app__issues-title">{w.results.warningsTitle}</p>
              <ul>
                {a.warnings.map((x) => (
                  <li key={x.code}>{w.warnings[x.code]}</li>
                ))}
              </ul>
            </div>
          ) : null}

          {word ? (
            <div className={`mp-truss__status mp-truss__status--${word}`} data-word={word}>
              <p className="mp-truss__word">{fill(w.results.determinacy[word].title, { degree: a.determinacy.degree })}</p>
              <p className="mp-app__computed">
                {w.results.determinacy.formula} = {a.determinacy.members} + {a.determinacy.reactions} − 2 × {a.determinacy.joints} = {degree < 0 ? `−${-degree}` : degree}
              </p>
              <p className="mp-app__note">
                {w.results.determinacy[word].note} {w.results.determinacy.legend}.
              </p>
            </div>
          ) : null}

          {r ? (
            <dl className="mp-app__dl mp-truss__largest-forces">
              <div>
                <dt>{w.results.tension}</dt>
                <dd>{extreme(r.largest.tension)}</dd>
              </div>
              <div>
                <dt>{w.results.compression}</dt>
                <dd>{extreme(r.largest.compression)}</dd>
              </div>
            </dl>
          ) : null}

          <fieldset className="mp-truss__options">
            <legend className="mp-num__label">{w.results.options.title}</legend>
            <label className="mp-app__check">
              <input type="checkbox" checked={show.forces} onChange={(e) => setShow({ ...show, forces: e.target.checked })} />
              <span>{w.results.options.forces}</span>
            </label>
            <label className="mp-app__check">
              <input type="checkbox" checked={show.numbers} onChange={(e) => setShow({ ...show, numbers: e.target.checked })} />
              <span>{w.results.options.numbers}</span>
            </label>
            {deformable ? (
              <label className="mp-app__check">
                <input type="checkbox" checked={show.deformed} onChange={(e) => setShow({ ...show, deformed: e.target.checked })} />
                <span>{w.results.options.deformed}</span>
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
              forces={show.forces}
              numbers={show.numbers}
              deformed={show.deformed && deformable}
              flagged={flagged}
              group={group}
              summary={summary}
              active={active}
              onActive={onActive}
              onPick={onPick}
              legend={w.results.legend}
            />
            {show.deformed && deformable && a.drawing.deformScale !== null ? <p className="mp-app__note">{fill(w.results.scale, { scale: num(a.drawing.deformScale, 3) })}</p> : null}
            {r ? null : <p className="mp-app__need">{w.results.waiting}</p>}
          </div>
        </section>
      </div>

      {/* -- the numbers: under the form and the drawing, on paper too -- */}
      {cards}

      <p className="mp-app__privacy">{t.results.privacy}</p>
      {/* On paper only: when the sheet was printed, and the address that opens this very truss again. */}
      <SheetStamp stamp={stamp} t={{ printed: t.sheet.printed, link: w.sheet.link }} />
    </div>
  );
}
