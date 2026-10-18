import { formatNumber } from '@/lib/calc/format';
import { analyseSafely, type StiffnessAnalysis } from '@/lib/calc/stiffness/analysis';
import { FROM_ENGINE, TO_ENGINE, emptyStiffness, encodeStiffness, reduceStiffness, type StiffnessAction, type StiffnessForm, type UnitSystem } from '@/lib/calc/stiffness/model';
import type { StiffnessUi } from '@/lib/calc/stiffness/strings';
import { TEMPLATE_IDS, buildTemplate, type TemplateId } from '@/lib/calc/stiffness/templates';
import { fill } from './text';

/**
 * THE TEXTBOOK ANSWERS of the seven problems, and the check that this tool agrees with them.
 *
 * Each problem the page offers (lib/calc/stiffness/templates.ts) has an answer a student finds by hand. Here it is written out as formulas
 * of the problem's own numbers - so it holds in feet and kips and in metres and kilonewtons alike - and put beside what the tool gives.
 * The check solves the selected problem ITSELF, apart from the structure on screen (which the visitor may have edited since), and
 * compares the two, value by value, each against the largest value of its own kind (a force with forces, a moment with moments).
 *
 * WHICH STRUCTURE THE PANEL IS ABOUT. The hand answer and the tool's line are about the PROBLEM AS LISTED - not about whatever is on
 * screen. So the panel shows them only while the structure on screen IS that problem as it loads in the units now shown (`panelOf`:
 * the address of the form equals the address of the problem); after an edit, a switch of the units, a change of the kind of structure,
 * or Back and Forward onto another structure, it says that the structure differs and offers the problem. A problem is never quoted
 * beside results it did not give.
 *
 * The portal frame is the one place the textbook and the tool differ in method: the textbook takes the members as inextensible, the tool
 * counts their stretching, so they agree to a few percent (3 %) and not to the last figure; every other problem agrees to the figures
 * the engine computes.
 *
 * Signs as the tool's: a reaction is what the support does to the structure (+x right, +y up, counter-clockwise moment); N is positive in
 * tension. Where the hand answer is about size alone (the portal's moments) the comparison is of size alone.
 */

export type AnswerUnit = 'force' | 'moment' | 'rotation' | 'small';

/** The unit class of each answer key. */
const UNIT_OF: Record<string, AnswerUnit> = {
  N1: 'force', N2: 'force', N3: 'force', N4: 'force', N5: 'force', Nv: 'force', Ni: 'force', Nc: 'force',
  R1x: 'force', R1y: 'force', R2x: 'force', R2y: 'force', Rl: 'force', Rr: 'force', Rx: 'force', Ry: 'force', Vl: 'force', Vr: 'force', H: 'force',
  Ml: 'moment', Mr: 'moment', Mb: 'moment', Mf: 'moment', Mt: 'moment',
  theta: 'rotation',
  drop: 'small',
};
export const unitOfAnswer = (key: string): AnswerUnit => UNIT_OF[key] ?? 'force';

/** The relative tolerance each problem is held to. */
export const TOLERANCE: Record<TemplateId, number> = {
  'truss-two-bar': 1e-6,
  'truss-three-bar': 1e-6,
  'truss-five-member': 1e-6,
  'frame-propped': 1e-6,
  'frame-l': 1e-6,
  'frame-portal': 0.03,
  'frame-fixed-point': 1e-6,
};
/** Whether the textbook answer ignores the stretching of the members. */
export const INEXTENSIBLE: Record<TemplateId, boolean> = {
  'truss-two-bar': false,
  'truss-three-bar': false,
  'truss-five-member': false,
  'frame-propped': false,
  'frame-l': false,
  'frame-portal': true,
  'frame-fixed-point': false,
};

/** The textbook answer of a problem, by key, in the units shown (kip, kip·ft, rad, and the displacement unit for the small length). */
export function textbookOf(id: TemplateId, units: UnitSystem): Record<string, number> {
  const us = units === 'us';
  // Lengths of the SI set are a quarter of the US set's and its loads four times: forces follow the loads, since the angles are the same.
  const F = us ? 1 : 4;
  const t = buildTemplate(id, units);
  const k = TO_ENGINE[units];
  switch (id) {
    case 'truss-two-bar':
      return { N1: -12.5 * F, N2: -37.5 * F, R1x: 10 * F, R1y: 7.5 * F, R2x: -30 * F, R2y: 22.5 * F };
    case 'truss-three-bar': {
      const Nv = (5000 / 179) * F;
      const h = (us ? 6 : 1.5) as number;
      const EA = t.E * k.E * (t.A * k.area);
      return { Nv, Ni: (1800 / 179) * F, drop: ((Nv * h) / EA) * FROM_ENGINE[units].displacement };
    }
    case 'truss-five-member':
      return { N1: -4 * F, N2: 20 * F, N3: -20 * F, N4: 20 * F, N5: -25 * F, R1x: -12 * F, R1y: -12 * F, R2y: 27 * F };
    case 'frame-propped': {
      const w = Math.abs((t.memberLoads[0] as { w: number }).w);
      const L = t.nodes[1].x - t.nodes[0].x;
      const EI = t.E * k.E * (t.I * k.inertia);
      return { Rl: (5 * w * L) / 8, Rr: (3 * w * L) / 8, Ml: (w * L * L) / 8, theta: (w * L ** 3) / (48 * EI) };
    }
    case 'frame-l': {
      const w = Math.abs((t.memberLoads[0] as { w: number }).w);
      const L = t.nodes[2].x - t.nodes[1].x;
      return { Rx: 0, Ry: w * L, Mb: (w * L * L) / 2, Nc: -w * L };
    }
    case 'frame-portal': {
      const H = t.loads[0].fx;
      const h = t.nodes[2].y - t.nodes[0].y;
      const width = t.nodes[1].x - t.nodes[0].x;
      const r = h / width;
      const Mf = (H * h * (1 + 3 * r)) / (2 * (1 + 6 * r));
      const Mt = (H * h * 3 * r) / (2 * (1 + 6 * r));
      const V = (H * h - 2 * Mf) / width;
      return { H: H / 2, Mf, Mt, Vl: -V, Vr: V };
    }
    case 'frame-fixed-point': {
      const m = t.memberLoads[0] as { a: number; P: number };
      const P = Math.abs(m.P);
      const L = t.nodes[1].x - t.nodes[0].x;
      const a = m.a;
      const b = L - a;
      return { Ml: (P * a * b * b) / (L * L), Mr: -(P * a * a * b) / (L * L), Rl: (P * b * b * (3 * a + b)) / L ** 3, Rr: (P * a * a * (a + 3 * b)) / L ** 3 };
    }
  }
}

/** The same quantities as the tool gives them for the problem solved, by key; null when it could not be solved. */
export function toolValues(id: TemplateId, a: StiffnessAnalysis): Record<string, number> | null {
  const r = a.results;
  if (!r) return null;
  const bar = (k: number) => r.members[k]?.bar?.N ?? 0;
  const rx = (k: number) => r.reactions[k]?.rx ?? 0;
  const ry = (k: number) => r.reactions[k]?.ry ?? 0;
  const rm = (k: number) => r.reactions[k]?.rm ?? 0;
  switch (id) {
    case 'truss-two-bar':
      return { N1: bar(0), N2: bar(1), R1x: rx(0), R1y: ry(0), R2x: rx(1), R2y: ry(1) };
    case 'truss-three-bar':
      return { Nv: bar(1), Ni: bar(0), drop: -(r.displacements[3]?.uy ?? 0) };
    case 'truss-five-member':
      return { N1: bar(0), N2: bar(1), N3: bar(2), N4: bar(3), N5: bar(4), R1x: rx(0), R1y: ry(0), R2y: ry(1) };
    case 'frame-propped':
      return { Rl: ry(0), Rr: ry(1), Ml: rm(0), theta: r.displacements[1]?.rotation ?? 0 };
    case 'frame-l':
      return { Rx: rx(0), Ry: ry(0), Mb: rm(0), Nc: r.members[0]?.end.N ?? 0 };
    case 'frame-portal':
      // The textbook gives the sizes of the moments and the shear: the tool's are compared in size.
      return { H: Math.abs(rx(0)), Mf: Math.abs(rm(0)), Mt: Math.abs(r.members[2]?.start.M ?? 0), Vl: ry(0), Vr: ry(1) };
    case 'frame-fixed-point':
      return { Ml: rm(0), Mr: rm(1), Rl: ry(0), Rr: ry(1) };
  }
}

export interface TextbookCheck {
  expected: Record<string, number>;
  got: Record<string, number> | null;
  /** The largest difference, as a share of the largest value of its kind. */
  worst: number;
  tolerance: number;
  agrees: boolean;
  inextensible: boolean;
}

/** Compares the two sets of values: each difference against the largest expected value of its own unit class. */
export function compareValues(expected: Record<string, number>, got: Record<string, number>): number {
  const scale = new Map<AnswerUnit, number>();
  for (const [key, v] of Object.entries(expected)) scale.set(unitOfAnswer(key), Math.max(scale.get(unitOfAnswer(key)) ?? 0, Math.abs(v)));
  let worst = 0;
  for (const [key, v] of Object.entries(expected)) {
    const g = got[key];
    const s = scale.get(unitOfAnswer(key)) ?? 0;
    if (g === undefined || !Number.isFinite(g)) return Infinity;
    worst = Math.max(worst, s > 0 ? Math.abs(g - v) / s : Math.abs(g - v));
  }
  return worst;
}

const checks = new Map<string, TextbookCheck>();

/** The tool solves the problem itself and the result is held against the textbook's answer. Kept: the same problem is asked for again and again. */
export function checkTextbook(id: TemplateId, units: UnitSystem): TextbookCheck {
  const key = `${id}|${units}`;
  const held = checks.get(key);
  if (held) return held;
  const expected = textbookOf(id, units);
  const form = reduceStiffness(emptyStiffness(units), { type: 'template', template: id });
  const got = toolValues(id, analyseSafely(form));
  const worst = got ? compareValues(expected, got) : Infinity;
  const tolerance = TOLERANCE[id];
  const made: TextbookCheck = { expected, got, worst, tolerance, agrees: got !== null && worst <= tolerance, inextensible: INEXTENSIBLE[id] };
  checks.set(key, made);
  return made;
}

/* ── Which structure the panel is about ───────────────────────────────── */

const codes = new Map<string, string>();

/** The address of a problem as it loads in these units: what the form's address equals while the structure on screen IS that problem. */
export function templateCode(id: TemplateId, units: UnitSystem): string {
  const key = `${id}|${units}`;
  let code = codes.get(key);
  if (code === undefined) {
    code = encodeStiffness(reduceStiffness(emptyStiffness(units), { type: 'template', template: id }));
    codes.set(key, code);
  }
  return code;
}

/**
 * What "Load problem" does: the structure the problem makes of the one on screen, and the action that puts it there. It goes in as a WHOLE structure
 * (the action is 'load', which hands back the very object it is given, and the calculator remembers that object as the one opened whole): the next
 * render solves it, instead of showing for a moment the results of the structure before - which a problem loaded over an edited copy of itself did, since
 * only numbers had changed and the page solves a numbers-only change a moment later.
 */
export function templatePlan(form: StiffnessForm, id: TemplateId): { action: StiffnessAction; whole: StiffnessForm } {
  const whole = reduceStiffness(form, { type: 'template', template: id });
  return { action: { type: 'load', form: whole }, whole };
}

/** The problem whose address is `code`, in these units; null when the structure is none of them. */
export const templateMatching = (code: string, units: UnitSystem): TemplateId | null => TEMPLATE_IDS.find((id) => templateCode(id, units) === code) ?? null;

/**
 * What the template panel shows. `selected` is the problem the list stands on: the visitor's pick, else the problem the structure on
 * screen is (so that Back, Forward and an opened link bring the list along), else the problem it LAST was (an edit of the example leaves the list
 * on the example's problem, which the panel then says the structure differs from), else none ("your own structure").
 *   'compare'  the structure on screen is the selected problem as it loads: its hand answer and the tool's line are about it.
 *   'differs'  a problem is selected and the structure on screen is not it (edited, other units, other kind): one line says so.
 *   'pick'     no problem is selected and the structure is none of them.
 */
export interface Panel {
  selected: TemplateId | null;
  kind: 'compare' | 'differs' | 'pick';
}
export function panelOf(o: { code: string; units: UnitSystem; pick: TemplateId | 'own' | null; last?: TemplateId | null }): Panel {
  // "Your own structure" chosen in the list is a choice too: the list stands on none, and there is nothing to compare or to load.
  const selected = o.pick === 'own' ? null : (o.pick ?? templateMatching(o.code, o.units) ?? o.last ?? null);
  if (selected === null) return { selected, kind: 'pick' };
  return { selected, kind: templateCode(selected, o.units) === o.code ? 'compare' : 'differs' };
}

/* ── The sentences: the words are the page's (lib/calc/stiffness/strings.ts) ───────────────────────────────────────────────────── */

/** The units an answer is written in. */
export interface AnswerUnits {
  force: string;
  moment: string;
  displacement: string;
}

/** One set of answers (the textbook's, or the tool's) as the problem's own sentence, its values in its holes and its units after them. */
export function answerLine(w: StiffnessUi, id: TemplateId, values: Record<string, number>, units: AnswerUnits, num: (v: number, significant?: number) => string): string {
  const vars: Record<string, string | number> = { force: units.force, moment: units.moment, small: units.displacement };
  for (const [key, v] of Object.entries(values)) vars[key] = num(v, 4);
  return fill(w.template.answers[id], vars);
}

/** How far apart two answers are: as a percent when that is a few of them, else as the plain share of the largest value (1 × 10^−6). */
export function gapText(v: number, group: string): string {
  if (!Number.isFinite(v) || v === 0) return v === 0 ? '0' : '—';
  if (v >= 1e-3) return `${formatNumber(v * 100, 2, group)} %`;
  // Two figures, and always as a power: 0.00023 is not 0.0002.
  const [mantissa, exponent] = v.toExponential(1).split('e');
  return `${Number(mantissa)} × 10^${String(Number(exponent)).replace('-', '−')}`;
}

/** The line under the two answers: whether they agree and to what, and - where the textbook takes the members as inextensible - why they are not the same to the last figure. */
export function verdictLine(w: StiffnessUi, check: TextbookCheck, group: string): string {
  if (check.got === null) return w.template.unsolved;
  const line = check.agrees ? fill(w.template.agree, { tol: gapText(check.tolerance, group) }) : fill(w.template.differs, { diff: gapText(check.worst, group) });
  return check.inextensible ? `${line} ${w.template.inextensible}` : line;
}
