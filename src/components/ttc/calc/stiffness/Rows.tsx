'use client';

import React, { memo } from 'react';
import type { AnalysisIssue } from '@/lib/calc/stiffness/analysis';
import { STIFFNESS_UNITS, type LoadRow, type MemberLoadRow, type MemberRow, type NodeRow, type StiffnessList, type StiffnessRow, type SupportRow } from '@/lib/calc/stiffness/model';
import type { StiffnessShared, StiffnessUi } from '@/lib/calc/stiffness/strings';
import type { Mode } from '@/lib/calc/stiffness/types';
import { FNum } from './FNum';

/**
 * THE ROWS OF THE FIVE TABLES, one component each. A keystroke in a field changes ONE row of the form (the reducer hands every other row
 * back as it was), and a structure of twelve nodes and forty loads has dozens of rows: written as one function in the calculator, every key
 * made the page build the elements of all of them again. Here each row is memoised on what it is made of - its row, its number, the
 * problems that name it and the few things that are the same for all (`env`) - so that a key builds the one row it is typed in.
 *
 * Nothing here decides anything: what a field is called, what unit it is in, and what each row says is wrong with it, all come from the
 * calculator.
 */

export type Units = (typeof STIFFNESS_UNITS)['us'];

/** What is the same for every row, and stable from one render to the next (the calculator makes a new one only when one of these changes). */
export interface RowEnv {
  t: StiffnessShared;
  w: StiffnessUi;
  u: Units;
  mode: Mode;
  uid: string;
  format: (v: number) => string;
  /** The `<option>`s of a list of nodes and of members, made once. */
  nodeOptions: React.ReactNode;
  memberOptions: React.ReactNode;
  patch: (list: StiffnessList, id: number, p: Record<string, unknown>) => void;
  remove: (list: StiffnessList, id: number) => (press: React.MouseEvent<HTMLButtonElement>) => void;
  listName: Record<StiffnessList, string>;
}

/** A row of the form as one word: two issues are on the same row when theirs are the same. */
export const rowKey = (row: StiffnessRow) => (row.list === 'model' ? `model${row.field}` : `${row.list}${row.id}`);

interface RowProps {
  env: RowEnv;
  /** The label: its place in the list, from 1. */
  index: number;
  /** The problems that name this row, and the sentence each is. */
  issues: AnalysisIssue[];
  texts: string[];
}

/** A field of a row at fault: marked, and tied to the row's message. The field the fault is about - every field, when it names none. */
const faultOf = (env: RowEnv, list: StiffnessList, id: number, issues: AnalysisIssue[], ...fields: string[]) => {
  const mine = issues.filter((i) => !i.row?.field || fields.length === 0 || fields.includes(i.row.field));
  return mine.length ? { invalid: true, describedBy: `${env.uid}${rowKey({ list, id })}` } : {};
};

const same = (a: RowProps & { row: unknown }, b: RowProps & { row: unknown }, extra: unknown[] = [], more: unknown[] = []): boolean =>
  a.row === b.row && a.index === b.index && a.env === b.env && JSON.stringify(a.issues) === JSON.stringify(b.issues) && JSON.stringify(a.texts) === JSON.stringify(b.texts) && extra.every((x, k) => x === more[k]);

function Shell({ env, list, id, index, issues, texts, children }: RowProps & { list: StiffnessList; id: number; children: React.ReactNode }) {
  const name = `${env.listName[list]} ${index}`;
  return (
    <div className="mp-app__item mp-st__item" role="group" aria-label={name} data-invalid={issues.length ? 'true' : undefined}>
      <p className="mp-st__name" aria-hidden="true">
        {name}
      </p>
      <div className="mp-app__row mp-app__row--rm">
        <div className="mp-app__fields mp-st__fields">{children}</div>
        <button type="button" className="mp-app__remove" onClick={env.remove(list, id)} aria-label={`${env.t.row.remove}: ${name}`} title={env.t.row.remove}>
          <span aria-hidden="true">×</span>
        </button>
      </div>
      {texts.length ? (
        <p className="mp-app__row-error" id={`${env.uid}${rowKey({ list, id })}`}>
          {texts.join(' ')}
        </p>
      ) : null}
    </div>
  );
}

type Extra = { invalid?: boolean; describedBy?: string };

function Num({ env, label, unit, value, onChange, extra }: { env: RowEnv; label: string; unit?: string; value: number; onChange: (v: number) => void; extra: Extra }) {
  return <FNum numbers={env.t.numbers} words={env.w.fieldWords} format={env.format} label={label} unit={unit} value={value} onChange={onChange} {...extra} />;
}

function Optional({ env, label, unit, value, onChange, extra }: { env: RowEnv; label: string; unit: string; value: number | null; onChange: (v: number | null) => void; extra: Extra }) {
  return (
    <FNum
      numbers={env.t.numbers}
      words={env.w.fieldWords}
      format={env.format}
      label={label}
      unit={unit}
      optional={env.t.section.optional}
      placeholder={env.w.members.sameAsStructure}
      value={value ?? Number.NaN}
      emptyIs={Number.NaN}
      onChange={(v) => onChange(Number.isNaN(v) ? null : v)}
      {...extra}
    />
  );
}

function Pick({ label, rowName, value, onChange, options, extra }: { label: string; rowName: string; value: number; onChange: (id: number) => void; options: React.ReactNode; extra: Extra }) {
  return (
    <label className="mp-num mp-num--select" data-invalid={extra.invalid ? 'true' : undefined}>
      <span className="mp-num__label">{label}</span>
      <span className="mp-num__box">
        <select className="mp-num__input" aria-label={`${label}, ${rowName}`} aria-invalid={extra.invalid ? true : undefined} aria-describedby={extra.describedBy} value={value} onChange={(e) => onChange(Number(e.target.value))}>
          {options}
        </select>
      </span>
    </label>
  );
}

function Choose<T extends string>({ label, rowName, value, options, onChange, kind = '' }: { label: string; rowName: string; value: T; options: [T, string][]; onChange: (v: T) => void; kind?: string }) {
  return (
    <label className={`mp-num mp-num--select ${kind}`.trim()}>
      <span className="mp-num__label">{label}</span>
      <span className="mp-num__box">
        <select className="mp-num__input" aria-label={`${label}, ${rowName}`} value={value} onChange={(e) => onChange(e.target.value as T)}>
          {options.map(([v, text]) => (
            <option key={v} value={v}>
              {text}
            </option>
          ))}
        </select>
      </span>
    </label>
  );
}

function Check({ label, rowName, checked, onChange }: { label: string; rowName: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="mp-app__check mp-st__check">
      <input type="checkbox" checked={checked} aria-label={`${label}, ${rowName}`} onChange={(e) => onChange(e.target.checked)} />
      <span>{label}</span>
    </label>
  );
}

/* ── Nodes ────────────────────────────────────────────────────────────── */

export const NodeRowView = memo(
  function NodeRowView(p: RowProps & { row: NodeRow }) {
    const { env, row: n } = p;
    const f = (...fields: string[]) => faultOf(env, 'nodes', n.id, p.issues, ...fields);
    return (
      <Shell {...p} list="nodes" id={n.id}>
        <Num env={env} label={env.w.nodes.x} unit={env.u.length} value={n.x} onChange={(x) => env.patch('nodes', n.id, { x })} extra={f('x')} />
        <Num env={env} label={env.w.nodes.y} unit={env.u.length} value={n.y} onChange={(y) => env.patch('nodes', n.id, { y })} extra={f('y')} />
      </Shell>
    );
  },
  (a, b) => same(a, b),
);

/* ── Members ──────────────────────────────────────────────────────────── */

export const MemberRowView = memo(
  function MemberRowView(p: RowProps & { row: MemberRow }) {
    const { env, row: m, index } = p;
    const { w, u } = env;
    const name = `${w.members.name} ${index}`;
    const f = (...fields: string[]) => faultOf(env, 'members', m.id, p.issues, ...fields);
    return (
      <Shell {...p} list="members" id={m.id}>
        <Pick label={w.members.from} rowName={name} value={m.i} onChange={(id) => env.patch('members', m.id, { i: id })} options={env.nodeOptions} extra={f('i')} />
        <Pick label={w.members.to} rowName={name} value={m.j} onChange={(id) => env.patch('members', m.id, { j: id })} options={env.nodeOptions} extra={f('j')} />
        <Optional env={env} label={w.members.E} unit={u.E} value={m.E} onChange={(E) => env.patch('members', m.id, { E })} extra={f('E')} />
        <Optional env={env} label={w.members.A} unit={u.area} value={m.A} onChange={(A) => env.patch('members', m.id, { A })} extra={f('A')} />
        {env.mode === 'frame' ? <Optional env={env} label={w.members.I} unit={u.inertia} value={m.I} onChange={(I) => env.patch('members', m.id, { I })} extra={f('I')} /> : null}
      </Shell>
    );
  },
  (a, b) => same(a, b),
);

/* ── Supports ─────────────────────────────────────────────────────────── */

export const SupportRowView = memo(
  function SupportRowView(p: RowProps & { row: SupportRow; open: boolean; forced: boolean; toggle: (id: number) => void }) {
    const { env, row: s, index, open } = p;
    const { w, u } = env;
    const frame = env.mode === 'frame';
    const name = `${w.supports.name} ${index}`;
    const f = (...fields: string[]) => faultOf(env, 'supports', s.id, p.issues, ...fields);
    const patch = (x: Record<string, unknown>) => env.patch('supports', s.id, x);
    const anyHeld = s.ux || s.uy || (frame && s.rz);
    return (
      <Shell {...p} list="supports" id={s.id}>
        <Pick label={w.supports.node} rowName={name} value={s.node} onChange={(id) => patch({ node: id })} options={env.nodeOptions} extra={f('node')} />
        <fieldset className="mp-st__holds">
          <legend className="mp-num__label">{w.supports.holds}</legend>
          <Check label={w.supports.ux} rowName={name} checked={s.ux} onChange={(ux) => patch({ ux })} />
          <Check label={w.supports.uy} rowName={name} checked={s.uy} onChange={(uy) => patch({ uy })} />
          {frame ? <Check label={w.supports.rz} rowName={name} checked={s.rz} onChange={(rz) => patch({ rz })} /> : null}
        </fieldset>
        {open ? (
          <>
            {s.ux ? <Num env={env} label={w.supports.dx} unit={u.displacement} value={s.dx} onChange={(dx) => patch({ dx })} extra={f('dx')} /> : null}
            {s.uy ? <Num env={env} label={w.supports.dy} unit={u.displacement} value={s.dy} onChange={(dy) => patch({ dy })} extra={f('dy')} /> : null}
            {frame && s.rz ? <Num env={env} label={w.supports.dr} unit={u.rotation} value={s.dr} onChange={(dr) => patch({ dr })} extra={f('dr')} /> : null}
          </>
        ) : null}
        {p.forced || !anyHeld ? null : (
          <button type="button" className="mp-app__btn mp-app__btn--quiet mp-st__more" aria-expanded={open} onClick={() => p.toggle(s.id)}>
            {open ? w.supports.less : w.supports.more}
          </button>
        )}
      </Shell>
    );
  },
  (a, b) => same(a, b, [a.open, a.forced, a.toggle], [b.open, b.forced, b.toggle]),
);

/* ── Loads at nodes ───────────────────────────────────────────────────── */

export const LoadRowView = memo(
  function LoadRowView(p: RowProps & { row: LoadRow }) {
    const { env, row: l, index } = p;
    const { w, u } = env;
    const f = (...fields: string[]) => faultOf(env, 'loads', l.id, p.issues, ...fields);
    return (
      <Shell {...p} list="loads" id={l.id}>
        <Pick label={w.loads.node} rowName={`${w.loads.name} ${index}`} value={l.node} onChange={(id) => env.patch('loads', l.id, { node: id })} options={env.nodeOptions} extra={f('node')} />
        <Num env={env} label={w.loads.fx} unit={u.force} value={l.fx} onChange={(fx) => env.patch('loads', l.id, { fx })} extra={f('fx')} />
        <Num env={env} label={w.loads.fy} unit={u.force} value={l.fy} onChange={(fy) => env.patch('loads', l.id, { fy })} extra={f('fy')} />
        {env.mode === 'frame' ? <Num env={env} label={w.loads.m} unit={u.moment} value={l.m} onChange={(m) => env.patch('loads', l.id, { m })} extra={f('m')} /> : null}
      </Shell>
    );
  },
  (a, b) => same(a, b),
);

/* ── Loads on members ─────────────────────────────────────────────────── */

export const MemberLoadRowView = memo(
  function MemberLoadRowView(p: RowProps & { row: MemberLoadRow }) {
    const { env, row: l, index } = p;
    const { w, u } = env;
    const name = `${w.memberLoads.name} ${index}`;
    const patch = (x: Record<string, unknown>) => env.patch('memberLoads', l.id, x);
    const f = (key: keyof MemberLoadRow, label: string, unit: string) => (
      <Num env={env} label={label} unit={unit} value={l[key] as number} onChange={(v) => patch({ [key]: v })} extra={faultOf(env, 'memberLoads', l.id, p.issues, key as string)} />
    );
    return (
      <Shell {...p} list="memberLoads" id={l.id}>
        <Pick label={w.memberLoads.member} rowName={name} value={l.member} onChange={(id) => patch({ member: id })} options={env.memberOptions} extra={faultOf(env, 'memberLoads', l.id, p.issues, 'member')} />
        <Choose<MemberLoadRow['kind']>
          label={w.memberLoads.kind}
          rowName={name}
          value={l.kind}
          options={(['udl', 'point', 'axial'] as const).map((k) => [k, w.memberLoads.kinds[k]] as [MemberLoadRow['kind'], string])}
          onChange={(kind) => patch({ kind })}
          kind="mp-num--dir"
        />
        {l.kind === 'udl' ? f('w', w.memberLoads.w, u.line) : null}
        {l.kind === 'point' ? (
          <>
            {f('P', w.memberLoads.P, u.force)}
            {f('a', w.memberLoads.a, u.length)}
          </>
        ) : null}
        {l.kind === 'axial' ? f('q', w.memberLoads.q, u.line) : null}
      </Shell>
    );
  },
  (a, b) => same(a, b),
);
