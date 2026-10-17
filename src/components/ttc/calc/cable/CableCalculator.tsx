'use client';

import React, { useCallback, useDeferredValue, useId, useMemo, useReducer, useRef, useState } from 'react';
import { formatNumber } from '@/lib/calc/format';
import { analyseSafely, type AnalysisIssue, type CableOut, type CableRow, type RegimeLine } from '@/lib/calc/cable/analysis';
import { CABLE_KEY, CABLE_UNITS, MATERIALS, ROPES, decodeCable, defaultCase, encodeCable, reduceCable, sectionInput, type CableAction, type CableForm, type SectionForm, type SectionTarget } from '@/lib/calc/cable/model';
import type { CableShared, CableUi } from '@/lib/calc/cable/strings';
import { MATERIAL_IDS, MODES, ROPE_IDS, type CableMode, type MaterialId, type PullRegimeId, type RopeId, type Side, type Travel } from '@/lib/calc/cable/types';
import { NumField } from '../NumField';
import { Actions } from '../shell/Actions';
import { useAddress } from '../shell/address';
import { select } from '../shell/fields';
import { PAPER_WIDTH, useTooTall, useWidth } from '../shell/layout';
import { SheetStamp, useSheet } from '../shell/sheet';
import { DrumSchematic } from './DrumSchematic';
import { PullCurve } from './PullCurve';
import { PullSchematic } from './PullSchematic';
import { SlingSchematic } from './SlingSchematic';
import { DataTable, Head, type Column, type Row } from './tables';
import { bodySummary, curveSummary, drumSummary, fill, issueSentence, materialForRope, regimeName, regimeSentences, ropeForMaterial, signed, slingSummary, unitText, warningSentence, whereOf, type Ctx } from './text';
import './cable.css';

/**
 * CABLE TENSION AND ELONGATION - the calculator (/resources/cable).
 *
 * The sixth calculator of the catalogue, and the fifth one's sibling
 * (truss/TrussCalculator.tsx): the form on the left, the answer on the right
 * and nothing between them - every keystroke that leaves a number in a field
 * solves the case again, a moment after the key and not inside it (`solved`,
 * below); the address follows the case (`#k=...`); nothing leaves the browser;
 * its words are props; it renders on the server with its example. What is the
 * same from one calculator to the next is the shell's (../shell) and the
 * number field (../NumField), used here as they are and not copied.
 *
 * WHAT IS THIS ONE'S. Three things to work out, chosen at the top of the form,
 * sharing one cable section and material:
 *
 *   LOAD  a weight, and a horizontal force if there is one, on one cable or a
 *         two-leg sling: the tension in each leg, the stress, the strain, the
 *         elastic and the thermal stretch, where the load point goes (the usual
 *         linear move and the exact one), the tensions again in the displaced
 *         shape, what a temperature change does when the ends are held, and
 *         what a breaking force, a design factor and an allowable stress ask.
 *   PULL  a block dragged over a surface by a cable at an angle to it: the
 *         tension to start it, to keep it going and to accelerate it, with the
 *         normal force and the friction, what happens when it cannot be pulled
 *         (and why), the best cable angle, the angle at which the block lifts,
 *         the curve T(φ), and the cable's stress and stretch under the greatest
 *         tension.
 *   DRUM  a cable round a drum: four quantities (the two tensions, μ, the wrap)
 *         of which exactly one is left empty and is found, the ratio e^(μβ), the
 *         force on the drum, and the cable's stress at the large tension.
 *
 * All the arithmetic is in lib/calc/cable: `model.ts` (the form, what each edit
 * does to it, the address), `engine.ts` (the mechanics) and `analysis.ts`, which
 * hands this file every number it prints ALREADY SETTLED and in the units shown.
 * This file is the form, the tables and the wiring: it decides no number. What it
 * does decide is how one is written, and the sentence that goes with each code.
 *
 * TWO SETS OF WORDS. `t` is the part of the first calculator's that says the same
 * on any calculator (`CableShared`). `w` is what is about a cable. Neither file is
 * imported here - both languages would travel with the script.
 */

/** The example case, as it is written in an address. */
const EXAMPLE = encodeCable(defaultCase());

/**
 * What the fragment of an address opens. `undefined`: it is not this calculator's
 * (`#main` is a place on the page; `#t=...` is the truss's). `null`: it is, and
 * cannot be read - its key with nothing after it included.
 */
function caseIn(hash: string): CableForm | null | undefined {
  const m = hash.match(new RegExp(`^#${CABLE_KEY}=(.*)$`));
  if (!m) return undefined;
  let text = m[1];
  try {
    text = decodeURIComponent(text);
  } catch {
    /* not percent-encoded: read as it is */
  }
  return decodeCable(text);
}

/** A form but for the numbers typed into it: its units, its modes, every choice made in it. A choice is solved in the render that shows it. */
const choicesOf = (form: CableForm) => JSON.stringify(form, (_key, value: unknown) => (typeof value === 'number' ? 0 : value));

type Group = CableRow['group'];
/** The region of the form a message sits under: the two legs share one. */
const regionOf = (g: Group): string => (g === 'leg1' || g === 'leg2' ? 'legs' : g);
/** The region a problem that names no field belongs to. */
const wideRegion = (i: AnalysisIssue): string | null => {
  if (i.row) return null;
  if (i.code === 'parallel-legs' || i.code === 'slack-leg') return 'legs';
  if (i.code === 'underdetermined' || i.code === 'overdetermined' || i.code === 'order') return 'drum';
  return null;
};

const STATUS_WORD = { pull: 'pull', 'slides-on-its-own': 'slides', 'stays-put': 'stays', 'self-locking': 'locks', 'leaves-surface': 'leaves' } as const;
const lower = (text: string): string => text.toLocaleLowerCase();
const upper = (text: string): string => text.charAt(0).toLocaleUpperCase() + text.slice(1);

/**
 * `initial`: the case it opens with, where that is not the example - for the
 * tests, which can neither type nor press.
 */
export function CableCalculator({ t, w, initial }: { t: CableShared; w: CableUi; initial?: CableForm }) {
  const [form, dispatchRaw] = useReducer(reduceCable, initial, (given) => given ?? defaultCase());
  // The case last put on screen whole - opened from the address, or the example on "Start over": that one is solved in
  // the render that shows it (`solved`, below), never a moment later under the results of the case before.
  const [whole, setWhole] = useState<CableForm | null>(null);
  const [moved, setMoved] = useState(true);
  const [bodyChoice, setBodyChoice] = useState<PullRegimeId | null>(null);
  const uid = useId();
  // The calculator itself: a case opened from the address asks whether the focus is in one of its fields.
  const root = useRef<HTMLDivElement>(null);
  const [plotRef, windowWidth] = useWidth<HTMLDivElement>();
  const [outRef, tooTall] = useTooTall<HTMLElement>();
  const group = t.numbers.group;
  const dispatch = useCallback((action: CableAction) => dispatchRaw(action), []);
  const uForm = CABLE_UNITS[form.units];
  const formForce = uForm.force[form.forceUnit];

  // THE ADDRESS FOLLOWS THE CASE (../shell/address.ts).
  const code = useCallback(() => encodeCable(form), [form]);
  const address = useAddress<CableForm>({
    key: CABLE_KEY,
    example: EXAMPLE,
    code,
    read: caseIn,
    blank: defaultCase,
    // A case in the address opens as that case.
    open: (found) => {
      // An edit in progress is an edit of the case before, and ends here. The field with the focus is left FIRST: it
      // would go on showing what was typed into that case, and fall back on that case's value at the first key that is
      // not a number (NumField).
      const focused = document.activeElement;
      if (focused instanceof HTMLInputElement && root.current?.contains(focused)) focused.blur();
      dispatch({ type: 'load', form: found });
      setWhole(found);
      setBodyChoice(null);
    },
  });
  const { linkError } = address;
  // The printed sheet gives the address that opens this very case, and while it prints the drawings are the sheet's size.
  const { stamp, onPaper } = useSheet({ locale: t.sheet.locale, url: () => address.link(encodeCable(form)) });
  const width = onPaper ? PAPER_WIDTH : windowWidth;

  // WHICH CASE IS SOLVED. While only NUMBERS change, the answer is of the form as it was a moment ago
  // (`useDeferredValue`): the key shows at once, and the case is solved in a render of its own, which the next key may
  // interrupt. The results say so while they are behind (`aria-busy`). Anything else - the units, the mode, a choice in
  // a list, a case opened whole - is solved in the same render as ever: the answer must never stand under other units
  // or beside a mode it was not solved for. And on paper it is the form itself.
  const behind = useDeferredValue(form);
  const solved = onPaper || form === whole || choicesOf(behind) !== choicesOf(form) ? form : behind;
  const catching = solved !== form;

  // Everything the page prints (lib/calc/cable/analysis.ts) - through the door that never throws.
  const a = useMemo(() => analyseSafely(solved), [solved]);
  const ru = a.units;
  const rf = ru.force[solved.forceUnit];

  // Every number this page prints, with the page's own mark between thousands.
  const num = (v: number, sig = 4) => formatNumber(v, sig, group);
  const signedNum = (v: number, sig = 4) => signed(num(Math.abs(v), sig), v);
  const dash = (v: number | null, f: (x: number) => string = num) => (v === null ? '—' : f(v));
  const ctx: Ctx = { form: solved, units: ru, num };

  /* -- The faults, by row -- */
  const everything = [...a.issues, ...a.cableIssues];
  const says = (i: AnalysisIssue, where = false): string => {
    const text = issueSentence(i, w, ctx);
    const at = where ? whereOf(i.row, w) : null;
    return at ? `${at}: ${text}` : text;
  };
  const issuesIn = (region: string) => everything.filter((i) => (i.row ? regionOf(i.row.group) === region : wideRegion(i) === region));
  const idOf = (region: string) => `${uid}${region}`;
  // A field at fault: marked, and tied to the message of its region. The field the fault is about - every field of the
  // region, when the fault names none.
  const fault = (g: Group, field?: string) => {
    const hit = everything.some((i) => (i.row ? i.row.group === g && (field === undefined || ('field' in i.row && i.row.field === field)) : wideRegion(i) === regionOf(g)));
    return hit ? { invalid: true, describedBy: idOf(regionOf(g)) } : {};
  };
  const message = (region: string) => {
    const texts = [...new Set(issuesIn(region).map((i) => says(i)))];
    return texts.length ? (
      <p className="mp-app__row-error" id={idOf(region)}>
        {texts.join(' ')}
      </p>
    ) : null;
  };
  // What the results box says, each thing once.
  const notices = a.issues.map((i) => says(i, true)).filter((text, k, all) => all.indexOf(text) === k);
  const cableNotices = a.cableIssues.map((i) => says(i, true)).filter((text, k, all) => all.indexOf(text) === k);

  /* -- Small pieces of the form -- */
  const optionalNumber = (value: number | null) => value ?? Number.NaN;
  const fromField = (v: number) => (Number.isNaN(v) ? null : v);
  const seg = <T extends string>(name: string, legend: string, value: T, options: [T, string][], onChange: (v: T) => void, className = '') => (
    <fieldset className={`mp-seg ${className}`.trim()}>
      <legend className="mp-num__label">{legend}</legend>
      {options.map(([v, text]) => (
        <label key={v} className="mp-seg__item">
          <input type="radio" name={`cable-${name}`} checked={value === v} onChange={() => onChange(v)} />
          <span>{text}</span>
        </label>
      ))}
    </fieldset>
  );
  const num$ = (label: string, unit: string | undefined, value: number, onChange: (v: number) => void, extra: { invalid?: boolean; describedBy?: string } = {}) => (
    <NumField numbers={t.numbers} label={label} unit={unit} value={value} onChange={onChange} {...extra} />
  );
  const optional$ = (label: string, unit: string | undefined, value: number | null, onChange: (v: number | null) => void, extra: { invalid?: boolean; describedBy?: string } = {}, tag = t.section.optional) => (
    <NumField numbers={t.numbers} label={label} unit={unit} optional={tag} value={optionalNumber(value)} emptyIs={Number.NaN} onChange={(v) => onChange(fromField(v))} {...extra} />
  );

  /* -- The cable section and material -- */
  const typicalNow = a.typical;
  const sectionFields = (target: SectionTarget) => {
    const s = target === 'leg2' ? (form.load.own2 as SectionForm) : form.section;
    const g: Group = target === 'leg2' ? 'leg2section' : 'section';
    const patch = (p: Partial<Pick<SectionForm, 'by' | 'd' | 'A' | 'factor' | 'E' | 'alpha' | 'mbf'>>) => dispatch({ type: 'section', patch: p, target });
    const pickRope = (rope: RopeId) => {
      dispatch({ type: 'rope', rope, target });
      if (rope !== 'custom') {
        const usual = materialForRope(rope, s.material, ROPES[rope].material);
        if (usual) dispatch({ type: 'material', material: usual as MaterialId, target });
      }
    };
    const pickMaterial = (material: MaterialId) => {
      dispatch({ type: 'material', material, target });
      if (material !== 'custom') {
        const usual = ropeForMaterial(material, s.rope, MATERIALS[material].rope);
        if (usual) dispatch({ type: 'rope', rope: usual as RopeId, target });
      }
    };
    const area = sectionInput(s, form).A;
    const preset = s.material !== 'custom' ? MATERIALS[s.material] : null;
    const rope = preset && (s.material === 'rope' || s.material === 'rope-fibre') && s.E === preset.E[form.units];
    return (
      <>
        {seg<'diameter' | 'area'>(`by-${target}`, w.section.by, s.by, [['diameter', w.section.byDiameter], ['area', w.section.byArea]], (by) => patch({ by }))}
        <div className="mp-app__row mp-app__row--two">
          {s.by === 'diameter' ? num$(w.section.d, uForm.dia, optionalNumber(s.d), (d) => patch({ d: fromField(d) }), fault(g, 'd')) : num$(w.section.A, uForm.area, optionalNumber(s.A), (A) => patch({ A: fromField(A) }), fault(g, 'A'))}
          {select<RopeId>(w.section.rope, s.rope, ROPE_IDS.map((id) => [id, w.section.ropes[id]] as [RopeId, string]), pickRope)}
        </div>
        {s.rope !== 'solid' ? <div className="mp-app__row mp-app__row--two">{num$(w.section.factor, undefined, optionalNumber(s.factor), (factor) => patch({ factor: fromField(factor) }), fault(g, 'factor'))}</div> : null}
        {s.by === 'diameter' && Number.isFinite(area) ? <p className="mp-app__computed">{fill(w.section.areaOf, { area: num(area, 5), unit: uForm.area })}</p> : null}
        <div className="mp-app__row mp-app__row--three">
          {select<MaterialId>(w.section.material, s.material, MATERIAL_IDS.map((id) => [id, w.section.materials[id]] as [MaterialId, string]), pickMaterial)}
          {num$(w.section.E, uForm.E, optionalNumber(s.E), (E) => patch({ E: fromField(E) }), fault(g, 'E'))}
          {num$(w.section.alpha, unitText(uForm.alpha), optionalNumber(s.alpha), (alpha) => patch({ alpha: fromField(alpha) }), fault(g, 'alpha'))}
        </div>
        <div className="mp-app__row mp-app__row--two">{optional$(w.section.mbf, formForce, s.mbf, (mbf) => patch({ mbf }), fault(g, 'mbf'))}</div>
        {message(g)}
        {rope && preset ? <p className="mp-app__note mp-cable__trap">{fill(w.section.ropeModulus, { E: num(preset.E[form.units], 5), unit: uForm.E, steel: num(MATERIALS.steel.E[form.units], 5) })}</p> : null}
        {s.rope !== 'solid' ? <p className="mp-app__note">{w.section.ropeLoose}</p> : null}
      </>
    );
  };

  /* -- The load group -- */
  const legBlock = (n: 1 | 2) => {
    const l = n === 1 ? form.load.leg1 : form.load.leg2;
    const g: Group = n === 1 ? 'leg1' : 'leg2';
    const single = form.load.legs === 1;
    const name = single ? w.results.legs.one : fill(w.load.leg, { leg: n });
    return (
      <div key={n} className="mp-cable__leg" role="group" aria-label={name} data-invalid={issuesIn('legs').some((i) => i.row?.group === g) ? 'true' : undefined}>
        <p className="mp-cable__name" aria-hidden="true">
          {name}
        </p>
        <div className="mp-app__fields mp-cable__fields">
          {single ? null : num$(w.load.angle, '°', l.angle, (angle) => dispatch({ type: 'leg', leg: n, patch: { angle } }), fault(g, 'angle'))}
          {single
            ? null
            : select<Side>(w.load.side, l.side, [['left', w.load.sides.left], ['right', w.load.sides.right]], (side) => dispatch({ type: 'leg', leg: n, patch: { side } }))}
          {num$(w.load.length, uForm.length, l.length, (length) => dispatch({ type: 'leg', leg: n, patch: { length } }), fault(g, 'length'))}
        </div>
      </div>
    );
  };
  const oneLeg = a.load && solved.mode === 'load' && solved.load.legs === 1 ? a.load.legs[0] : null;
  const loadGroup = (
    <>
      <fieldset className="mp-app__group">
        <legend>{w.load.title}</legend>
        <p className="mp-app__note">{w.load.note}</p>
        <div className="mp-app__row mp-app__row--two">
          {num$(w.load.W, formForce, form.load.W, (W) => dispatch({ type: 'loadInput', patch: { W } }), fault('load', 'W'))}
          {num$(w.load.H, formForce, form.load.H, (H) => dispatch({ type: 'loadInput', patch: { H } }), fault('load', 'H'))}
        </div>
        <p className="mp-app__note">{w.load.hNote}</p>
        {message('load')}
        {seg<'1' | '2'>('legs', w.load.legs.label, String(form.load.legs) as '1' | '2', [['1', w.load.legs.one], ['2', w.load.legs.two]], (v) => dispatch({ type: 'legs', legs: v === '1' ? 1 : 2 }))}
        {form.load.legs === 1 ? (
          <>
            <p className="mp-app__note">
              {w.load.oneNote}
              {oneLeg ? ` ${fill(w.load.oneAngle, { angle: num(oneLeg.angle), side: lower(w.load.sides[oneLeg.side]) })}` : ''}
            </p>
            {legBlock(1)}
          </>
        ) : (
          <>
            {legBlock(1)}
            {legBlock(2)}
            <label className="mp-app__check">
              <input type="checkbox" checked={form.load.own2 !== null} onChange={(e) => dispatch({ type: 'own2', on: e.target.checked })} />
              <span>{w.load.own2}</span>
            </label>
          </>
        )}
        {message('legs')}
      </fieldset>
      {form.load.legs === 2 && form.load.own2 ? (
        <fieldset className="mp-app__group mp-cable__own2">
          <legend>{w.load.own2Title}</legend>
          <p className="mp-app__note">{w.load.own2Note}</p>
          {sectionFields('leg2')}
        </fieldset>
      ) : null}
    </>
  );

  /* -- The pull group -- */
  const p = form.pull;
  const pullGroup = (
    <fieldset className="mp-app__group">
      <legend>{w.pull.title}</legend>
      <p className="mp-app__note">{w.pull.note}</p>
      {seg<'weight' | 'mass'>('given', w.pull.given, p.massInput ? 'mass' : 'weight', [['weight', w.pull.byWeight], ['mass', w.pull.byMass]], (v) => dispatch({ type: 'pullInput', patch: { massInput: v === 'mass' } }))}
      <div className="mp-app__row mp-app__row--two">
        {num$(p.massInput ? w.pull.mass : w.pull.weight, p.massInput ? uForm.mass : formForce, p.W, (W) => dispatch({ type: 'pullInput', patch: { W } }), fault('pull', 'W'))}
        {num$(w.pull.theta, '°', p.theta, (theta) => dispatch({ type: 'pullInput', patch: { theta } }), fault('pull', 'theta'))}
      </div>
      <p className="mp-app__note">{w.pull.thetaNote}</p>
      <div className="mp-app__row mp-app__row--two">
        {num$(w.pull.muS, undefined, p.muS, (muS) => dispatch({ type: 'pullInput', patch: { muS } }), fault('pull', 'muS'))}
        {num$(w.pull.muK, undefined, p.muK, (muK) => dispatch({ type: 'pullInput', patch: { muK } }), fault('pull', 'muK'))}
      </div>
      <div className="mp-app__row mp-app__row--two">
        {num$(w.pull.phi, '°', p.phi, (phi) => dispatch({ type: 'pullInput', patch: { phi } }), fault('pull', 'phi'))}
        {optional$(w.pull.accel, uForm.accel, p.accel, (accel) => dispatch({ type: 'pullInput', patch: { accel } }), fault('pull', 'accel'))}
      </div>
      <p className="mp-app__note">
        {w.pull.phiNote} {w.pull.accelNote}
      </p>
      <div className="mp-app__row mp-app__row--two">
        {select<Travel>(w.pull.travel, p.travel, [['along', w.pull.travels.along], ['against', w.pull.travels.against]], (travel) => dispatch({ type: 'pullInput', patch: { travel } }))}
        {num$(w.pull.length, uForm.length, p.length, (length) => dispatch({ type: 'pullInput', patch: { length } }), fault('pull', 'length'))}
      </div>
      {message('pull')}
    </fieldset>
  );

  /* -- The drum group -- */
  const d = form.drum;
  const blanks = (['Tbig', 'Tsmall', 'mu', 'wrap'] as const).filter((k) => d[k] === null);
  const blankName = blanks.length === 1 ? w.drum.names[blanks[0] === 'wrap' ? 'beta' : blanks[0]] : '';
  const wrapUnit = d.wrapUnit === 'deg' ? '°' : w.words.turns;
  const drumGroup = (
    <fieldset className="mp-app__group">
      <legend>{w.drum.title}</legend>
      <p className="mp-app__note">{w.drum.note}</p>
      <div className="mp-app__row mp-app__row--two">
        {optional$(w.drum.Tbig, formForce, d.Tbig, (Tbig) => dispatch({ type: 'drumInput', patch: { Tbig } }), fault('drum', 'Tbig'), w.drum.blank)}
        {optional$(w.drum.Tsmall, formForce, d.Tsmall, (Tsmall) => dispatch({ type: 'drumInput', patch: { Tsmall } }), fault('drum', 'Tsmall'), w.drum.blank)}
      </div>
      <div className="mp-app__row mp-app__row--two">
        {optional$(w.drum.mu, undefined, d.mu, (mu) => dispatch({ type: 'drumInput', patch: { mu } }), fault('drum', 'mu'), w.drum.blank)}
        {optional$(w.drum.wrap, wrapUnit, d.wrap, (wrap) => dispatch({ type: 'drumInput', patch: { wrap } }), fault('drum', 'wrap'), w.drum.blank)}
      </div>
      {seg<'deg' | 'turns'>('wrapunit', w.drum.wrapIn, d.wrapUnit, [['deg', w.drum.degrees], ['turns', w.drum.turns]], (wrapUnit2) => dispatch({ type: 'drumInput', patch: { wrapUnit: wrapUnit2 } }))}
      <p className="mp-app__computed" role="status">
        {blanks.length === 1 ? fill(w.drum.finds, { name: blankName }) : fill(w.drum.count, { count: blanks.length })}
      </p>
      {message('drum')}
    </fieldset>
  );

  /* -- The section group, shared by the three modes -- */
  const sectionGroup = (
    <fieldset className="mp-app__group">
      <legend>{w.section.title}</legend>
      <p className="mp-app__note">{w.section.note}</p>
      {sectionFields('main')}
      {typicalNow ? (
        <p className="mp-app__note mp-cable__typical">
          <strong>{w.section.typical}</strong> {w.section.typicalNote}
        </p>
      ) : null}
      <div className="mp-app__row mp-app__row--two">{num$(w.section.dT, uForm.dT, form.dT, (dT) => dispatch({ type: 'dT', value: dT }), fault('dT'))}</div>
      <p className="mp-app__note">{w.section.dTNote}</p>
      {message('dT')}
      <div className="mp-app__row mp-app__row--two">
        {optional$(w.section.n, undefined, form.n, (n) => dispatch({ type: 'design', patch: { n } }), fault('design', 'n'))}
        {optional$(w.section.allowable, uForm.stress, form.allowable, (allowable) => dispatch({ type: 'design', patch: { allowable } }), fault('design', 'allowable'))}
      </div>
      <p className="mp-app__note">{w.section.designNote}</p>
      {message('design')}
    </fieldset>
  );

  /* -- The numbers of a cable under one tension -- */
  const cablePairs = (c: CableOut): [string, string][] => {
    const s = w.results.single;
    const out: [string, string][] = [
      [s.T, `${num(c.T)} ${rf}`],
      [s.stress, `${num(c.stress)} ${ru.stress}`],
      [s.strain, num(c.strain)],
    ];
    if (c.elastic !== null) out.push([s.elastic, `${num(c.elastic)} ${ru.stretch}`]);
    if (c.thermal !== null && solved.dT !== 0) out.push([s.thermal, `${signedNum(c.thermal)} ${ru.stretch}`]);
    if (c.stretch !== null) out.push([s.total, `${signedNum(c.stretch)} ${ru.stretch}`]);
    if (c.newLength !== null) out.push([s.newLength, `${num(c.newLength)} ${ru.length}`]);
    if (solved.dT !== 0) out.push([s.held, `${signedNum(c.restrainedForce)} ${rf}`], [s.combined, `${signedNum(c.combinedTension)} ${rf}`]);
    if (c.mbfRatio !== null) out.push([s.ratio, num(c.mbfRatio)]);
    if (c.mbfRatioCombined !== null && solved.dT !== 0) out.push([s.ratioHeld, num(c.mbfRatioCombined)]);
    if (c.requiredMbf !== null) out.push([s.required, `${num(c.requiredMbf)} ${rf}`]);
    if (c.requiredArea !== null) out.push([s.area, `${num(c.requiredArea)} ${ru.area}`]);
    if (c.requiredDiameter !== null) out.push([s.diameter, `${num(c.requiredDiameter)} ${ru.dia}`]);
    if (c.requiredNominalDiameter !== null && solved.section.rope !== 'solid') out.push([s.nominal, `${num(c.requiredNominalDiameter)} ${ru.dia}`]);
    return out;
  };
  const pairsCard = (pairs: [string, string][]) => (
    <dl className="mp-app__dl">
      {pairs.map(([k, v]) => (
        <div key={k}>
          <dt>{k}</dt>
          <dd>{v}</dd>
        </div>
      ))}
    </dl>
  );

  /* -- The cards: load -- */
  const loadCards = (() => {
    const L = a.load;
    if (!L) return null;
    const count = L.legs.length;
    const legName = (n: 1 | 2) => (count === 1 ? w.results.legs.one : `${w.words.leg} ${n}`);
    const s = w.results.legs;
    const legCols: Column[] = [
      { key: 'leg', title: s.leg },
      { key: 'angle', title: s.angle, unit: '°' },
      { key: 'T', title: s.tension, unit: rf },
      { key: 'stress', title: s.stress, unit: ru.stress },
      { key: 'strain', title: s.strain },
      { key: 'elastic', title: s.elastic, unit: ru.stretch },
      { key: 'thermal', title: s.thermal, unit: ru.stretch },
      { key: 'total', title: s.total, unit: ru.stretch },
      { key: 'length', title: s.newLength, unit: ru.length },
    ];
    const legRows: Row[] = L.legs.map((l) => ({
      key: String(l.label),
      cells: [legName(l.label), num(l.angle), num(l.T), num(l.stress), num(l.strain), dash(l.elastic), dash(l.thermal, signedNum), dash(l.stretch, signedNum), dash(l.newLength)],
    }));
    const m = L.move;
    const moveRows: Row[] = [
      { key: 'linear', cells: [w.results.move.linear, signedNum(m.linear.dx), signedNum(m.linear.dy), num(m.linear.magnitude)] },
      ...(m.exact ? [{ key: 'exact', cells: [w.results.move.exact, signedNum(m.exact.dx), signedNum(m.exact.dy), num(m.exact.magnitude)] }] : []),
      ...(m.difference !== null ? [{ key: 'difference', cells: [w.results.move.difference, '—', '—', num(m.difference)] }] : []),
    ];
    const moves = m.linear.magnitude > 0;
    const so = L.secondOrder;
    const held = L.thermal;
    const anyBreak = L.legs.some((l) => l.mbfRatio !== null || l.requiredMbf !== null || l.requiredArea !== null);
    const z = w.results.sizing;
    const sizeCols: Column[] = [
      { key: 'leg', title: z.leg },
      ...(L.legs.some((l) => l.mbfRatio !== null) ? [{ key: 'ratio', title: z.ratio }] : []),
      ...(held && L.legs.some((l) => l.mbfRatioCombined !== null) ? [{ key: 'ratioHeld', title: z.ratioHeld }] : []),
      ...(L.legs.some((l) => l.requiredMbf !== null) ? [{ key: 'required', title: z.required, unit: rf }] : []),
      ...(L.legs.some((l) => l.requiredArea !== null) ? [{ key: 'area', title: z.area, unit: ru.area }, { key: 'diameter', title: z.diameter, unit: ru.dia }] : []),
      ...(L.legs.some((l) => l.requiredNominalDiameter !== null) && solved.section.rope !== 'solid' ? [{ key: 'nominal', title: z.nominal, unit: ru.dia }] : []),
    ];
    const sizeRows: Row[] = L.legs.map((l) => ({
      key: String(l.label),
      cells: sizeCols.map((c) => {
        switch (c.key) {
          case 'leg':
            return legName(l.label);
          case 'ratio':
            return dash(l.mbfRatio);
          case 'ratioHeld':
            return dash(l.mbfRatioCombined);
          case 'required':
            return dash(l.requiredMbf);
          case 'area':
            return dash(l.requiredArea);
          case 'diameter':
            return dash(l.requiredDiameter);
          default:
            return dash(l.requiredNominalDiameter);
        }
      }),
    }));
    return (
      <>
        <div className="mp-app__card mp-app__card--wide">
          <h3 className="mp-app__h">{s.title}</h3>
          <DataTable columns={legCols} rows={legRows} stack />
          <p className="mp-app__note">{s.note}</p>
          {count === 2 ? <p className="mp-app__note">{s.sling}</p> : null}
        </div>
        <div className="mp-app__card mp-app__card--wide">
          <h3 className="mp-app__h">{w.results.move.title}</h3>
          {moves ? (
            <>
              <DataTable
                columns={[
                  { key: 'method', title: w.results.move.method },
                  { key: 'dx', title: w.results.move.dx, unit: ru.stretch },
                  { key: 'dy', title: w.results.move.dy, unit: ru.stretch },
                  { key: 'size', title: w.results.move.size, unit: ru.stretch },
                ]}
                rows={moveRows}
                stack
              />
              <p className="mp-app__note">{w.results.move.note}</p>
              {count === 2 && !m.exact ? <p className="mp-app__note">{w.results.move.noExact}</p> : null}
            </>
          ) : (
            <p className="mp-app__note">{w.results.move.none}</p>
          )}
        </div>
        {so ? (
          <div className="mp-app__card mp-app__card--wide">
            <h3 className="mp-app__h">{w.results.second.title}</h3>
            <DataTable
              columns={[
                { key: 'leg', title: w.results.second.leg },
                { key: 'first', title: w.results.second.first, unit: rf },
                { key: 'after', title: w.results.second.after, unit: rf },
                { key: 'change', title: w.results.second.change, unit: '%' },
                { key: 'angle', title: w.results.second.angle, unit: '°' },
              ]}
              rows={[
                { key: '1', cells: [legName(1), num(L.legs[0].T), num(so.T1), signedNum(so.change1 * 100, 3), num(so.angle1)] },
                { key: '2', cells: [legName(2), num(L.legs[1].T), num(so.T2), signedNum(so.change2 * 100, 3), num(so.angle2)] },
              ]}
              stack
            />
            <p className="mp-app__note">{fill(w.results.second.note, { iterations: so.iterations })}</p>
          </div>
        ) : null}
        {held ? (
          <div className="mp-app__card mp-app__card--wide">
            <h3 className="mp-app__h">{w.results.held.title}</h3>
            <DataTable
              columns={[
                { key: 'leg', title: w.results.held.leg },
                { key: 'force', title: w.results.held.force, unit: rf },
                { key: 'stress', title: w.results.held.stress, unit: ru.stress },
                { key: 'combined', title: w.results.held.combined, unit: rf },
                { key: 'combinedStress', title: w.results.held.combinedStress, unit: ru.stress },
                { key: 'state', title: w.results.held.slack },
              ]}
              rows={L.legs.map((l) => ({
                key: String(l.label),
                cells: [legName(l.label), signedNum(l.restrainedForce), signedNum(l.restrainedStress), signedNum(l.combinedTension), signedNum(l.combinedStress), l.combinedSlack ? w.results.held.slackWord : w.results.held.taut],
              }))}
              stack
            />
            <p className="mp-app__note">{w.results.held.note}</p>
          </div>
        ) : null}
        <div className="mp-app__card mp-app__card--wide">
          <h3 className="mp-app__h">{z.title}</h3>
          {anyBreak ? <DataTable columns={sizeCols} rows={sizeRows} stack /> : <p className="mp-app__note">{z.none}</p>}
          <p className="mp-app__note">{z.note}</p>
        </div>
        <div className="mp-app__card">
          <h3 className="mp-app__h">{w.results.equilibrium.title}</h3>
          {pairsCard([
            [w.results.equilibrium.loads, `W ${num(L.applied.W)} · H ${signedNum(L.applied.H)} ${rf}`],
            [w.results.equilibrium.residual, `${num(L.residual)} ${rf}`],
          ])}
          {L.balanced ? <p className="mp-app__note mp-cable__balanced">{w.results.equilibrium.balanced}</p> : <p className="mp-app__row-error">{w.results.equilibrium.unbalanced}</p>}
        </div>
      </>
    );
  })();

  /* -- The cards: pull -- */
  const P = a.pull;
  const bodyId: PullRegimeId | null = P ? (bodyChoice && P.regimes.some((r) => r.id === bodyChoice) ? bodyChoice : (P.governing ?? 'run')) : null;
  const bodyRegime: RegimeLine | null = P ? (P.regimes.find((r) => r.id === bodyId) ?? P.regimes[0] ?? null) : null;
  const pullCards = (() => {
    if (!P) return null;
    const t2 = w.results.pullTable;
    const word = (r: RegimeLine) => w.results.statusWords[STATUS_WORD[r.status]];
    const rows: Row[] = [
      { key: 'status', cells: [t2.status, ...P.regimes.map(word)] },
      { key: 'mu', cells: [t2.mu, ...P.regimes.map((r) => num(r.mu, 3))] },
      { key: 'T', cells: [<Head key="h" title={t2.T} unit={rf} />, ...P.regimes.map((r) => dash(r.T))] },
      { key: 'N', cells: [<Head key="h" title={t2.N} unit={rf} />, ...P.regimes.map((r) => dash(r.N, signedNum))] },
      { key: 'F', cells: [<Head key="h" title={t2.F} unit={rf} />, ...P.regimes.map((r) => dash(r.F))] },
      { key: 'lift', cells: [<Head key="h" title={t2.lift} unit={rf} />, ...P.regimes.map((r) => dash(r.lift))] },
      { key: 'drag', cells: [<Head key="h" title={t2.drag} unit={rf} />, ...P.regimes.map((r) => dash(r.drag))] },
      { key: 'best', cells: [<Head key="h" title={t2.best} unit="°" />, ...P.regimes.map((r) => signedNum(r.optimum.phi))] },
      { key: 'least', cells: [<Head key="h" title={t2.least} unit={rf} />, ...P.regimes.map((r) => dash(r.optimum.valid ? r.optimum.T : null))] },
      { key: 'lifts', cells: [<Head key="h" title={t2.lifts} unit="°" />, ...P.regimes.map((r) => dash(r.phiLift))] },
      { key: 'liftT', cells: [<Head key="h" title={t2.liftT} unit={rf} />, ...P.regimes.map((r) => dash(r.liftTension))] },
      ...(P.regimes.some((r) => r.hold) ? [{ key: 'hold', cells: [<Head key="h" title={t2.hold} unit={rf} />, ...P.regimes.map((r) => dash(r.hold ? r.hold.T : null))] }] : []),
    ];
    const columns: Column[] = [{ key: 'q', title: t2.quantity }, ...P.regimes.map((r) => ({ key: r.id, title: regimeName(r.id, w) }))];
    const governing = P.governing ? P.regimes.find((r) => r.id === P.governing) : null;
    const grid: number[] = [];
    for (let phi = -90; phi <= 90; phi += 10) grid.push(phi);
    return (
      <>
        <div className="mp-app__card mp-app__card--wide">
          <h3 className="mp-app__h">{t2.title}</h3>
          <DataTable columns={columns} rows={rows} className="mp-cable__matrix" />
          <p className="mp-app__note">{t2.note}</p>
        </div>
        <div className="mp-app__card mp-app__card--wide">
          <h3 className="mp-app__h">{w.results.statusTitle}</h3>
          <ul className="mp-cable__status">
            {P.regimes.map((r) => (
              <li key={r.id} data-status={r.status}>
                {regimeSentences(r, w, ctx).join(' ')}
              </li>
            ))}
          </ul>
        </div>
        <div className="mp-app__card">
          <h3 className="mp-app__h">{w.results.pullCable.title}</h3>
          {governing && governing.cable ? (
            <>
              <p className="mp-app__note">
                {w.results.pullCable.regime}: {regimeName(governing.id, w)}
              </p>
              {pairsCard(cablePairs(governing.cable))}
            </>
          ) : governing ? (
            <p className="mp-app__note">{w.results.pullCable.missing}</p>
          ) : (
            <p className="mp-app__note">{w.results.pullCable.none}</p>
          )}
        </div>
        <div className="mp-app__card mp-app__card--wide mp-cable__curve-table">
          <h3 className="mp-app__h">{w.results.curve.title}</h3>
          <DataTable
            columns={[{ key: 'phi', title: w.results.curve.phi, unit: '°' }, ...P.curves.map((c) => ({ key: c.regime, title: regimeName(c.regime, w), unit: rf }))]}
            rows={grid.map((phi) => ({ key: String(phi), cells: [signedNum(phi), ...P.curves.map((c) => dash(c.points[phi + 90]?.valid ? c.points[phi + 90].T : null))] }))}
          />
          <p className="mp-app__note">{w.results.curve.note}</p>
        </div>
      </>
    );
  })();

  /* -- The cards: drum -- */
  const D = a.drum;
  const drumCards = (() => {
    if (!D) return null;
    const t3 = w.results.drumTable;
    const mark = (k: 'Tbig' | 'Tsmall' | 'mu' | 'beta') => (D.solved === k ? ` · ${w.words.found}` : '');
    const rows: [string, string][] = [
      [t3.Tbig, `${num(D.Tbig)} ${rf}${mark('Tbig')}`],
      [t3.Tsmall, `${num(D.Tsmall)} ${rf}${mark('Tsmall')}`],
      [t3.mu, `${num(D.mu)}${mark('mu')}`],
      [t3.wrap, `${num(D.betaDeg)}°${mark('beta')}`],
      [t3.wrapTurns, num(D.turns)],
      [t3.ratio, num(D.ratio)],
      [t3.exponent, num(D.exponent)],
      [t3.share, `${num(D.holdShare * 100, 3)} %`],
      [t3.resultant, `${num(D.resultant.magnitude)} ${rf}`],
      ...(D.resultant.magnitude > 0 ? ([[t3.direction, `${signedNum(D.resultant.angle)}°`]] as [string, string][]) : []),
    ];
    return (
      <>
        <div className="mp-app__card">
          <h3 className="mp-app__h">{t3.title}</h3>
          {pairsCard(rows)}
          <p className="mp-app__note">{fill(t3.solved, { name: upper(w.drum.names[D.solved]) })}</p>
          <p className="mp-app__note">{t3.note}</p>
        </div>
        <div className="mp-app__card">
          <h3 className="mp-app__h">{w.results.cableAt.title}</h3>
          {D.cable ? (
            <>
              {pairsCard(cablePairs(D.cable))}
              <p className="mp-app__note">{w.results.cableAt.note}</p>
            </>
          ) : (
            <p className="mp-app__note">{w.results.pullCable.missing}</p>
          )}
        </div>
      </>
    );
  })();

  /* -- The headline of the answer -- */
  const headline = (() => {
    const hl = w.results.headline;
    if (a.load) {
      const L = a.load;
      const per = (f: (l: (typeof L.legs)[number]) => string) => (L.legs.length === 1 ? f(L.legs[0]) : L.legs.map((l) => `${l.label}: ${f(l)}`).join(' · '));
      const m = L.move.exact ?? L.move.linear;
      const move: string[] = [];
      if (m.dy !== 0) move.push(`${num(Math.abs(m.dy))} ${ru.stretch} ${m.dy < 0 ? w.words.down : w.words.up}`);
      if (m.dx !== 0) move.push(`${num(Math.abs(m.dx))} ${ru.stretch} ${m.dx < 0 ? w.words.left : w.words.right}`);
      const pairs: [string, string][] = [
        [L.legs.length === 1 ? hl.load.tension : hl.load.tensions, per((l) => `${num(l.T)} ${rf}`)],
        [hl.load.stress, per((l) => `${num(l.stress)} ${ru.stress}`)],
        [hl.load.stretch, per((l) => (l.stretch === null ? '—' : `${signedNum(l.stretch)} ${ru.stretch}`))],
        [hl.load.move, move.length ? move.join(` ${w.words.and} `) : w.results.move.none],
      ];
      return pairs;
    }
    if (P) {
      const gov = P.governing ? P.regimes.find((r) => r.id === P.governing) : null;
      const pairs: [string, string][] = P.regimes.map((r) => [regimeName(r.id, w), r.T !== null ? `${num(r.T)} ${rf}` : w.results.statusWords[STATUS_WORD[r.status]]]);
      pairs.unshift([hl.pull.governing, gov && gov.T !== null ? `${num(gov.T)} ${rf} (${regimeName(gov.id, w)})` : hl.pull.none]);
      if (gov && gov.optimum.valid && gov.optimum.T !== null) pairs.push([hl.pull.best, `${signedNum(gov.optimum.phi)}° → ${num(gov.optimum.T)} ${rf}`]);
      return pairs;
    }
    if (D) {
      const found =
        D.solved === 'Tbig' ? `${num(D.Tbig)} ${rf}` : D.solved === 'Tsmall' ? `${num(D.Tsmall)} ${rf}` : D.solved === 'mu' ? num(D.mu) : `${num(D.betaDeg)}° (${num(D.turns)} ${D.turns === 1 ? w.words.turn : w.words.turns})`;
      return [
        [`${hl.drum.found}: ${w.drum.names[D.solved]}`, found],
        [hl.drum.ratio, num(D.ratio)],
        [hl.drum.held, `${num(D.Tsmall)} ${rf}`],
        [hl.drum.drum, `${num(D.resultant.magnitude)} ${rf}`],
      ] as [string, string][];
    }
    return null;
  })();

  /* -- The drawings -- */
  const slingText = slingSummary(a, w, ctx, moved);
  const bodyText = bodySummary(a, bodyRegime, w, ctx);
  const curveText = curveSummary(a, w, ctx);
  const drumText = drumSummary(a, w, ctx);
  const names = w.drum.symbols;
  const wrapText = D ? `β = ${num(D.betaDeg)}° (${num(D.turns)} ${D.turns === 1 ? w.words.turn : w.words.turns})` : '';
  const sling = a.drawing.sling;
  const curveLegend = P
    ? [
        ...P.curves.map((c) => {
          const r = P.regimes.find((x) => x.id === c.regime) as RegimeLine;
          const least = c.optimum ? fill(w.results.curve.legendLeast, { T: num(c.optimum.T), unit: rf, phi: num(c.optimum.phi) }) : w.results.curve.legendNone;
          const here = r.T !== null ? fill(w.results.curve.legendAt, { phi: num(P.phi), T: num(r.T), unit: rf }) : fill(w.results.curve.legendNoneAt, { phi: num(P.phi) });
          return { key: c.regime as 'start' | 'run' | 'accel', text: `${regimeName(c.regime, w)}: ${least}; ${here}` };
        }),
        { key: 'minimum' as const, text: w.results.legend.minimum },
        { key: 'chosen' as const, text: w.results.legend.chosen },
        ...(P.regimes.some((r) => r.phiLift !== null && r.phiLift <= 90) ? [{ key: 'lift' as const, text: w.results.legend.lift }] : []),
      ]
    : [];

  // The box of notices.
  const box = (
    <div className="mp-app__issues" role="alert" aria-live="assertive">
      {notices.length ? (
        <>
          <p className="mp-app__issues-title">{w.issuesTitle}</p>
          <ul>
            {notices.map((text) => (
              <li key={text}>{text}</li>
            ))}
          </ul>
        </>
      ) : linkError ? (
        <p className="mp-app__issues-title">{w.linkError}</p>
      ) : null}
    </div>
  );

  const solvedMode: CableMode = solved.mode;
  const solvedOk = (solvedMode === 'load' && a.load) || (solvedMode === 'pull' && a.pull) || (solvedMode === 'drum' && a.drum);

  return (
    <div className={onPaper ? 'mp-app mp-cable mp-cable--sheet' : 'mp-app mp-cable'} ref={root}>
      <div className="mp-app__top">
        {/* -- the form -- */}
        <form className="mp-app__form" onSubmit={(e) => e.preventDefault()} noValidate>
          <div className="mp-app__bar mp-cable__bar">
            <fieldset className="mp-seg mp-cable__modes">
              <legend className="mp-num__label">{w.toolbar.mode}</legend>
              {MODES.map((m) => (
                <label key={m} className="mp-seg__item">
                  <input
                    type="radio"
                    name="cable-mode"
                    checked={form.mode === m}
                    onChange={() => {
                      dispatch({ type: 'mode', mode: m });
                      setBodyChoice(null);
                    }}
                  />
                  <span>
                    <strong className="mp-cable__mode-name">{w.modes[m].name}</strong>
                    <small className="mp-cable__mode-hint">{w.modes[m].hint}</small>
                  </span>
                </label>
              ))}
            </fieldset>
            <div className="mp-cable__switches">
              {seg<'us' | 'si'>('units', t.toolbar.units, form.units, [['us', w.toolbar.us], ['si', w.toolbar.si]], (units) => dispatch({ type: 'units', units }))}
              {seg<'small' | 'large'>('force', w.toolbar.force, form.forceUnit, [['small', uForm.force.small], ['large', uForm.force.large]], (force) => dispatch({ type: 'force', force }))}
            </div>
          </div>

          {form.mode === 'load' ? loadGroup : form.mode === 'pull' ? pullGroup : drumGroup}
          {sectionGroup}

          <Actions
            t={{ ...t.toolbar, copy: w.toolbar.copy }}
            copy={() => {
              // The address is brought to this case too, and a link that could not be read has nothing left to say:
              // the one copied is the case on screen.
              address.take(encodeCable(form));
              return address.link(encodeCable(form));
            }}
            reset={() => {
              // One press throws away whatever was typed, and nothing is asked. So the case that goes - unless it is the
              // example - is left one step behind in the browser's history: Back brings it back, as the page opens any
              // case its address holds (../shell/address.ts), and Forward returns to the example.
              const thrown = encodeCable(form);
              if (thrown !== EXAMPLE) {
                address.take(thrown);
                try {
                  window.history.pushState(window.history.state, '', window.location.href);
                } catch {
                  /* the way back is a convenience; the calculator works without it */
                }
              }
              const example = defaultCase();
              dispatch({ type: 'load', form: example });
              setWhole(example);
              setBodyChoice(null);
              setMoved(true);
              // The address goes bare - if what is after the # is a case.
              address.take(EXAMPLE);
            }}
          />
        </form>

        {/* -- the answer -- */}
        <section className={tooTall ? 'mp-app__out mp-app__out--tall' : 'mp-app__out'} aria-label={t.results.title} ref={outRef} aria-busy={catching ? true : undefined}>
          {box}

          {cableNotices.length ? (
            <div className="mp-cable__warnings" role="status">
              <p className="mp-app__issues-title">{w.results.cableIssuesTitle}</p>
              <ul>
                {cableNotices.map((text) => (
                  <li key={text}>{text}</li>
                ))}
              </ul>
            </div>
          ) : null}

          {a.warnings.length ? (
            <div className="mp-cable__warnings" role="status">
              <p className="mp-app__issues-title">{w.results.warningsTitle}</p>
              <ul>
                {a.warnings.map((x) => (
                  <li key={`${x.code}${x.leg ?? ''}`}>{warningSentence(x, w, ctx)}</li>
                ))}
              </ul>
            </div>
          ) : null}

          <p className="mp-cable__case">
            <span className="mp-cable__case-label">{w.results.mode}</span> <strong>{w.modes[solvedMode].name}</strong>
            <span className="mp-cable__case-units">
              {' '}
              · {w.toolbar[solved.units]}, {rf}
            </span>
          </p>

          {headline ? pairsCard(headline) : null}

          {solvedMode === 'load' ? (
            <fieldset className="mp-cable__options">
              <legend className="mp-num__label">{w.results.options.title}</legend>
              <label className="mp-app__check">
                <input type="checkbox" checked={moved} onChange={(e) => setMoved(e.target.checked)} />
                <span>{w.results.options.moved}</span>
              </label>
            </fieldset>
          ) : null}
          {solvedMode === 'pull' && P && P.regimes.length > 1 ? (
            <div className="mp-cable__options">{seg<PullRegimeId>('body', w.results.options.body, bodyId as PullRegimeId, P.regimes.map((r) => [r.id, regimeName(r.id, w)] as [PullRegimeId, string]), setBodyChoice)}</div>
          ) : null}

          <div className="mp-app__plots" ref={plotRef}>
            <p className="mp-plot__title mp-plot__title--first">
              {w.results.schematic[solvedMode]}
              <span className="mp-plot__unit">
                {' '}
                · {solvedMode === 'drum' ? rf : `${ru.length}, ${rf}`}
              </span>
            </p>
            {solvedMode === 'load' ? (
              <>
                <SlingSchematic drawing={sling} width={width} moved={moved} group={group} unit={rf} summary={slingText} legend={w.results.legend} />
                {moved && sling && sling.moveScale !== null && sling.displaced ? <p className="mp-app__note">{fill(w.results.scale, { scale: num(sling.moveScale, 3) })}</p> : null}
              </>
            ) : solvedMode === 'pull' ? (
              <>
                <PullSchematic pull={P} regime={bodyRegime} width={width} group={group} unit={rf} summary={bodyText} legend={w.results.legend} />
                <p className="mp-plot__title">{w.results.schematic.curve}</p>
                <PullCurve
                  curves={P ? P.curves : []}
                  regimes={P ? P.regimes : []}
                  width={width}
                  group={group}
                  phi={P ? P.phi : solved.pull.phi}
                  axisX={w.results.curve.axisX}
                  axisY={fill(w.results.curve.axisY, { unit: rf })}
                  lift={(phi) => fill(w.results.curve.lift, { phi: num(phi) })}
                  summary={curveText}
                  legend={curveLegend}
                />
              </>
            ) : (
              <DrumSchematic drawing={a.drawing.drum} width={width} group={group} unit={rf} names={names} wrap={wrapText} summary={drumText} legend={w.results.legend} />
            )}
            {solvedOk ? null : <p className="mp-app__need">{w.results.waiting}</p>}
          </div>
        </section>
      </div>

      {/* -- the numbers: under the form and the drawings, on paper too -- */}
      <div className="mp-app__tables mp-cable__tables" aria-busy={catching ? true : undefined}>
        {solvedMode === 'load' ? loadCards : solvedMode === 'pull' ? pullCards : drumCards}
      </div>

      <p className="mp-app__note mp-cable__verdict">{w.notes.noVerdict}</p>
      <p className="mp-app__privacy">{t.results.privacy}</p>
      {/* On paper only: when the sheet was printed, and the address that opens this very case again. */}
      <SheetStamp stamp={stamp} t={{ printed: t.sheet.printed, link: w.sheet.link }} />
    </div>
  );
}
