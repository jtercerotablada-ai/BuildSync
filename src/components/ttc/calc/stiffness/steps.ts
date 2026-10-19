import { TOLERANCES } from '@/lib/calc/stiffness/analysis';
import { CALCULATION_UNITS, STIFFNESS_UNITS, type UnitSystem } from '@/lib/calc/stiffness/model';
import type { StiffnessUi } from '@/lib/calc/stiffness/strings';
import type { Block, MatrixBlock, Mode, ScalarBlock, Step, VectorBlock } from '@/lib/calc/stiffness/types';
import { formatCell, type NumFormat } from './numfmt';
import { labelKind, loadsTable, matrixTable, partitionTable, vectorsTable, type Kind, type Quantity, type TableModel, type TableOptions } from './table';
import { dofName, fill, raised } from './text';

/**
 * ONE STEP OF THE WORKED SOLUTION, as data. For each step the library recorded (types.ts, Step) this file makes:
 *
 *   the TITLE and the NUMBER the outline and the card carry,
 *   the PARAGRAPHS that say what the step does and why - a textbook's way, the formula first and then this structure's numbers - in
 *   the sentences of the words given (strings.ts), chosen by what the step really is: a bar or a member, a member with loads or
 *   without, a structure with a settlement or without, an elimination recorded pass by pass or too long for that,
 *   the FORMULAS the library lists (only the equations: the names of terms are in the sentences),
 *   and, built only when the card is opened, the BODY: its values and its tables (table.ts).
 *
 * No React here. The component that writes it (Steps.tsx) decides nothing; the tests walk every step of every template, in both
 * modes and both languages, and hold these sentences to the rule that each is true in every branch it can be written in.
 */

export interface StepContext {
  w: StiffnessUi;
  system: UnitSystem;
  mode: Mode;
  /** How a number of a table is written. */
  format: NumFormat;
}

/** One value of a step: its name, the formula the library gave it, the number and its unit. */
export interface ValueRow {
  key: string;
  gloss: string;
  symbol: string;
  formula: string | null;
  text: string;
  unit: string;
}

export type BodyItem =
  | { kind: 'values'; id: string; rows: ValueRow[] }
  | { kind: 'table'; id: string; model: TableModel };

export interface StepView {
  key: string;
  id: Step['id'];
  stage: number;
  /** '6.2' (or '6' for a stage of one step). */
  label: string;
  title: string;
  paragraphs: string[];
  formulas: string[];
}

/* ── Labels and titles ────────────────────────────────────────────────── */

/** '6.2' for the second step of stage 6, '6' for a stage that has one step. By position in the stage, so that no two steps share a label. */
export function labelsOf(steps: readonly Step[]): Map<string, string> {
  const count = new Map<number, number>();
  for (const s of steps) count.set(s.number, (count.get(s.number) ?? 0) + 1);
  const seen = new Map<number, number>();
  const out = new Map<string, string>();
  for (const s of steps) {
    const at = (seen.get(s.number) ?? 0) + 1;
    seen.set(s.number, at);
    out.set(s.key, (count.get(s.number) ?? 1) > 1 ? `${s.number}.${at}` : String(s.number));
  }
  return out;
}

const memberOf = (s: Step): number => (s.scope.kind === 'member' ? s.scope.member : Number(s.facts.member ?? 0));

/** The title of a step, with its member, pass or unknown in it. */
export function titleOf(step: Step, w: StiffnessUi): string {
  return fill(w.steps.titles[step.id], { member: memberOf(step), pass: Number(step.facts.pass ?? step.sub ?? 0), unknown: Number(step.facts.unknown ?? step.sub ?? 0) });
}

/* ── Looking inside a step ────────────────────────────────────────────── */

const scalarOf = (step: Step, name: string, tag?: string): ScalarBlock | undefined => step.blocks.find((b): b is ScalarBlock => b.type === 'scalar' && b.name === name && (tag === undefined || b.tag === tag));
const vectorOf = (step: Step, name: string, tag?: string): VectorBlock | undefined => step.blocks.find((b): b is VectorBlock => b.type === 'vector' && b.name === name && (tag === undefined ? b.tag === undefined : b.tag === tag));
const matrixOf = (step: Step, name: string, tag?: string): MatrixBlock | undefined => step.blocks.find((b): b is MatrixBlock => b.type === 'matrix' && b.name === name && (tag === undefined ? b.tag === undefined : b.tag === tag));
const num = (step: Step, key: string): number => {
  const v = step.facts[key];
  return typeof v === 'number' ? v : 0;
};

/* ── Units of a single value ──────────────────────────────────────────── */

const stiffnessUnit = (system: UnitSystem, kind: Kind | null): string => {
  const u = CALCULATION_UNITS[system];
  return kind === 'θ' ? u.stiffnessRotation : u.stiffness;
};

/** The unit a scalar of the steps is in (the calculation's: feet and kips, metres and kilonewtons). `pivotKind` is the kind of the DOF a pivot belongs to. */
export function scalarUnit(name: string, system: UnitSystem, pivotKind: Kind | null = null): string {
  const u = CALCULATION_UNITS[system];
  switch (name) {
    case 'dx':
    case 'dy':
    case 'L':
    case 'a':
    case 'b':
    case 'δ':
      return u.length;
    case 'θ':
      return '°';
    case 'E':
    case 'σ':
      return u.E;
    case 'A':
      return u.area;
    case 'I':
      return u.inertia;
    case 'EA':
    case 'P':
    case 'N':
    case 'ΣFx':
    case 'ΣFy':
      return u.force;
    case 'EI':
      return `${u.force}·${u.length}²`;
    case 'EA/L':
    case '12EI/L³':
      return u.stiffness;
    case '6EI/L²':
      return u.stiffnessCoupling;
    case '4EI/L':
    case '2EI/L':
      return u.stiffnessRotation;
    case 'pivot':
      return stiffnessUnit(system, pivotKind);
    case 'w':
    case 'q':
      return u.line;
    case 'ΣM':
    case 'U':
    case 'W':
      return u.moment;
    default:
      return '';
  }
}

/* ── The views ────────────────────────────────────────────────────────── */

const power = (v: number): string => formatCell(v, { sig: 1, style: 'scientific', group: ',' });

/** The paragraphs of a step: what it does and why, in the sentences of the words given, with this structure's numbers. */
function paragraphsOf(step: Step, c: StepContext): string[] {
  const { w, system, mode, format } = c;
  const cell = (v: number) => formatCell(v, format);
  const calc = CALCULATION_UNITS[system];
  const shown = STIFFNESS_UNITS[system];
  const frame = mode === 'frame';
  const t = w.steps;
  const member = memberOf(step);
  switch (step.id) {
    case 'structure': {
      const prescribed = (vectorOf(step, 'prescribed')?.highlights ?? []).some((h) => h.reason === 'prescribed');
      // Each unit stands with its symbol ('E in ksi, A in in², I in in⁴'): a bare run of units reads as one list of what was entered and what is worked.
      const named = (E: string, A: string, I: string) => [fill(w.matrix.unitIn, { symbol: 'E', unit: E }), fill(w.matrix.unitIn, { symbol: 'A', unit: A }), ...(frame ? [fill(w.matrix.unitIn, { symbol: 'I', unit: I })] : [])].join(', ');
      const entered = named(shown.E, shown.area, shown.inertia);
      const worked = named(calc.E, calc.area, calc.inertia);
      return [
        t.structure[mode],
        fill(t.structure.counts, { nodes: num(step, 'nodes'), members: num(step, 'members'), dofs: num(step, 'dofs'), restrained: num(step, 'restrained'), free: num(step, 'free') }),
        num(step, 'free') === 0 ? (prescribed ? t.structure.noFreeSettles : t.structure.noFree) : '',
        t.structure.held,
        prescribed ? t.structure.prescribed : t.structure.noPrescribed,
        fill(t.structure.units, { entered, worked, force: calc.force, length: calc.length }),
      ].filter(Boolean);
    }
    case 'geometry':
      return [fill(t.geometry.lead, { member, i: num(step, 'i'), j: num(step, 'j') })];
    case 'local-stiffness': {
      // A bar's rows are its two nodes' displacements along it: u<i>, u<j>.
      const labels = matrixOf(step, 'k')?.rowLabels ?? [];
      const nodeOf = (label: string | undefined) => Number((label ?? '').replace(/\D/g, '')) || 0;
      return [fill(t['local-stiffness'][mode], { i: nodeOf(labels[0]), j: nodeOf(labels[labels.length - 1]) })];
    }
    case 'transformation': {
      const get = (n: string) => scalarOf(step, n)?.value ?? 0;
      return [fill(t.transformation[mode], { c: cell(get('c')), s: cell(get('s')) })];
    }
    case 'global-member': {
      const code = vectorOf(step, 'code');
      const out = [fill(t['global-member'].lead, { codes: (code?.labels ?? []).join(', ') })];
      if (!frame) {
        out.push(t['global-member'].closed);
        out.push(step.facts.agree === true ? t['global-member'].agree : fill(t['global-member'].disagree, { difference: cell(num(step, 'difference')), stiff: calc.stiffness }));
      }
      return out;
    }
    case 'assembly': {
      const contribution = matrixOf(step, 'contribution');
      const first = member <= 1;
      return [
        fill(t.assembly.lead, { codes: (contribution ? [...new Set((contribution.highlights ?? []).map((h) => contribution.rowLabels[h.row]))] : []).join(', '), cells: num(step, 'cells') }),
        first ? t.assembly.first : fill(t.assembly.next, { member }),
      ];
    }
    case 'assembled':
      return [step.from.length === 1 ? t.assembled.leadOne : fill(t.assembled.lead, { members: step.from.length }), step.facts.symmetric === true ? t.assembled.symmetric : fill(t.assembled.notSymmetric, { asymmetry: cell(num(step, 'asymmetry')) })];
    case 'nodal-loads':
      return [t['nodal-loads'].lead, num(step, 'loads') === 0 ? t['nodal-loads'].none : fill(t['nodal-loads'].some, { loads: num(step, 'loads') })];
    case 'member-loads':
      return [t['member-loads'].lead, num(step, 'loads') === 1 ? fill(t['member-loads'].countOne, { member }) : fill(t['member-loads'].count, { member, loads: num(step, 'loads') }), t['member-loads'].signs];
    case 'load-vector':
      return [t['load-vector'].lead, frame ? (num(step, 'loadedMembers') > 0 ? t['load-vector'].frame : t['load-vector'].frameNone) : t['load-vector'].truss];
    case 'partition': {
      const prescribed = (vectorOf(step, 'u_R')?.highlights ?? []).some((h) => h.reason === 'prescribed');
      const free = num(step, 'free');
      return [
        t.partition.lead,
        fill(t.partition.counts, { free, restrained: num(step, 'restrained') }),
        free === 0 ? t.partition.none : fill(t.partition.known, { settle: prescribed ? t.partition.settle : '' }),
      ];
    }
    case 'reduced': {
      if (num(step, 'free') === 0) return [step.facts.settles === true ? t.reduced.emptySettles : t.reduced.empty];
      const term = vectorOf(step, 'K_FR·u_R');
      const zero = (term?.values ?? []).every((v) => v === 0);
      return [t.reduced.lead, zero ? t.reduced.zero : t.reduced.nonzero];
    }
    case 'augmented':
      return [t.augmented.lead];
    case 'forward-pass': {
      const pivot = scalarOf(step, 'pivot')?.value ?? 0;
      const dof = dofName(num(step, 'pivotDof'), mode);
      if (step.facts.singular === true) {
        // A pivot the arithmetic cannot tell from zero: a mechanism, or a stable structure whose stiffnesses are too far apart for it.
        const stiff = scalarUnit('pivot', system, labelKind(dof));
        const sentence = step.facts.cause === 'range' ? t['forward-pass'].singularRange : pivot === 0 && num(step, 'error') === 0 ? t['forward-pass'].singularZero : t['forward-pass'].singular;
        return [fill(sentence, { dof, pivot: cell(pivot), rounding: cell(num(step, 'error')), stiff })];
      }
      const rows = num(step, 'rows');
      return [
        fill(t['forward-pass'].lead, { pass: num(step, 'pass'), dof, pivot: cell(pivot), stiff: scalarUnit('pivot', system, labelKind(dof)) }),
        rows === 0 ? t['forward-pass'].none : fill(t['forward-pass'].rows, { rows }),
      ];
    }
    case 'back-substitution': {
      const dof = dofName(num(step, 'dof'), mode);
      const kind = labelKind(dof);
      const pivot = scalarOf(step, 'pivot')?.value ?? 0;
      return [
        t['back-substitution'].lead,
        fill(t['back-substitution'].value, { unknown: num(step, 'unknown'), dof, value: cell(num(step, 'value')), unit: kind === 'θ' ? calc.rotation : calc.length, pivot: cell(pivot), stiff: scalarUnit('pivot', system, kind) }),
      ];
    }
    case 'solution': {
      const free = num(step, 'free');
      if (free === 0) return [t.solution.none];
      const out: string[] = [];
      if (step.facts.recorded === false) out.push(fill(t.solution.tooMany, { free, limit: num(step, 'limit') || TOLERANCES.record }));
      out.push(t.solution.recorded);
      // (the largest residual as the table above it prints it: under a billionth of the equations it is rounding, and is zero)
      const residual = scalarOf(step, 'max|residual|')?.value ?? num(step, 'residual');
      // (a row of a rotation is a moment: a frame says both)
      const unit = frame ? `${calc.force} ${w.words.or} ${calc.moment}` : calc.force;
      out.push(residual === 0 ? t.solution.zero : fill(t.solution.residual, { residual: cell(residual), scale: cell(num(step, 'equationScale')), unit }));
      return out;
    }
    case 'displacements':
      return [t.displacements.lead, fill(t.displacements.units, { length: calc.length, shown: t.displacements.shown[system] })];
    case 'reactions':
      return [t.reactions.lead];
    case 'end-forces': {
      if (!frame) {
        const N = scalarOf(step, 'N')?.value ?? 0;
        return [t['end-forces'].truss, fill(N > 0 ? t['end-forces'].states.tension : N < 0 ? t['end-forces'].states.compression : t['end-forces'].states.zero, { member })];
      }
      const loaded = vectorOf(step, 'f_FE') !== undefined;
      return [fill(t['end-forces'].frame, { loaded: loaded ? t['end-forces'].loaded : '' }), t['end-forces'].signs];
    }
    case 'checks':
      return [
        fill(t.checks.lead, { x: cell(num(step, 'aboutX')), y: cell(num(step, 'aboutY')) }),
        fill(t.checks.tolerance, { tol: power(TOLERANCES.residual), scale: cell(num(step, 'scale')), unit: calc.force, work: cell(num(step, 'work')), energy: calc.moment, rounding: TOLERANCES.rounding, allowance: cell(num(step, 'allowance')) }),
        step.facts.allOk === true ? t.checks.balanced : t.checks.unbalanced,
      ];
  }
}

/** Only the equations of the library's list for a step (a name of a term is in the sentences, not here). */
const equationsOf = (step: Step): string[] => step.formulas.filter((f) => /[=←]/.test(f));

/** The view of a step: its title, number and paragraphs, cheap enough for every step of a structure at once. */
export function stepView(step: Step, labels: Map<string, string>, c: StepContext): StepView {
  return {
    key: step.key,
    id: step.id,
    stage: step.number,
    label: labels.get(step.key) ?? String(step.number),
    title: titleOf(step, c.w),
    paragraphs: paragraphsOf(step, c).map(raised),
    formulas: equationsOf(step),
  };
}

/* ── The body of a step ───────────────────────────────────────────────── */

const VECTOR_QUANTITY: Record<string, Quantity> = {
  prescribed: 'displacement',
  u_R: 'displacement',
  u: 'displacement',
  u_F: 'displacement',
  u_e: 'displacement',
  u_local: 'displacement',
  code: 'none',
  multipliers: 'none',
};
const quantityOfVector = (name: string): Quantity => VECTOR_QUANTITY[name] ?? 'force';

const MATRIX_QUANTITY: Record<string, Quantity> = {
  coordinates: 'length',
  connectivity: 'none',
  sections: 'sections',
  'dof-numbers': 'none',
  restraints: 'none',
  T: 'none',
  augmented: 'augmented',
  ends: 'ends',
};
const quantityOfMatrix = (name: string): Quantity => MATRIX_QUANTITY[name] ?? 'stiffness';

/** A value row for a scalar block. */
function valueRow(step: Step, b: ScalarBlock, c: StepContext): ValueRow {
  const pivotDof = typeof step.facts.pivotDof === 'number' ? step.facts.pivotDof : typeof step.facts.dof === 'number' ? step.facts.dof : 0;
  const kind = pivotDof > 0 ? labelKind(dofName(pivotDof, c.mode)) : null;
  const gloss = (c.w.names as Record<string, string>)[b.name] ?? b.name;
  // A name that is a word ('pivot') is the gloss's, not a symbol: the value is headed by its formula alone.
  const word = b.name === 'pivot' || b.name === 'max|residual|';
  return { key: b.tag ? `${b.name}#${b.tag}` : b.name, gloss, symbol: word ? '' : b.name, formula: b.symbolic ?? null, text: raised(formatCell(b.value, c.format)), unit: scalarUnit(b.name, c.system, kind) };
}

/** The column head of a vector in a table of several. */
const headOf = (name: string, w: StiffnessUi): string => (w.columns as Record<string, string>)[name] ?? name;

/** Consecutive vector blocks that stand on the same labels, with the same tag and the same kind of unit: one table. */
function groupVectors(blocks: readonly Block[]): (VectorBlock | VectorBlock[] | ScalarBlock | MatrixBlock)[] {
  const out: (VectorBlock | VectorBlock[] | ScalarBlock | MatrixBlock)[] = [];
  for (const b of blocks) {
    if (b.type !== 'vector') {
      out.push(b);
      continue;
    }
    const last = out[out.length - 1];
    if (Array.isArray(last) && last[0].labels.join(',') === b.labels.join(',') && last[0].tag === b.tag && quantityOfVector(last[0].name) === quantityOfVector(b.name)) last.push(b);
    else out.push([b]);
  }
  return out;
}

const loadName = (tag: string, w: StiffnessUi): string => {
  const m = tag.match(/^(udl|point|axial)#(\d+)$/);
  return m ? fill(w.tables.loadNames[m[1] as 'udl' | 'point' | 'axial'], { n: m[2] }) : tag;
};

/** The values and tables of a step, in the order the library recorded them. Built when the card is opened, not before. */
export function stepBody(step: Step, c: StepContext): BodyItem[] {
  const { w, system, format } = c;
  const member = memberOf(step);
  const items: BodyItem[] = [];
  const opts = (id: string, caption: string, quantity: Quantity, name?: string): TableOptions => ({ w, system, format, id, caption, quantity, name });
  let pending: ValueRow[] = [];
  const flush = (id: string) => {
    if (pending.length) items.push({ kind: 'values', id: `${step.key}-${id}-${items.length}`, rows: pending });
    pending = [];
  };

  // The partition is one table, whatever the library recorded.
  if (step.id === 'partition') {
    const FF = matrixOf(step, 'K_FF');
    const FR = matrixOf(step, 'K_FR');
    const RF = matrixOf(step, 'K_RF');
    const RR = matrixOf(step, 'K_RR');
    if (RR) {
      const hasFree = FF !== undefined && FF.rowLabels.length > 0;
      items.push({ kind: 'table', id: `${step.key}-K`, model: partitionTable({ FF: hasFree ? FF : undefined, FR: hasFree ? FR : undefined, RF: hasFree ? RF : undefined, RR }, opts(`${step.key}-K`, w.tables.partition, 'stiffness')) });
    }
    const PR = vectorOf(step, 'P_R');
    const uR = vectorOf(step, 'u_R');
    if (PR && uR) {
      const PF = vectorOf(step, 'P_F');
      items.push({
        kind: 'table',
        id: `${step.key}-loads`,
        model: loadsTable({ PF: PF && PF.labels.length > 0 ? PF : undefined, PR, uR }, '?', { ...opts(`${step.key}-loads`, w.tables.loadsPartition, 'force'), heads: ['P', 'u'] }),
      });
    }
    return items;
  }

  for (const entry of groupVectors(step.blocks)) {
    if (Array.isArray(entry)) {
      flush('values');
      const first = entry[0];
      // A vector with no entry (the unknowns of a structure with no free DOF) is not a table.
      if (first.labels.length === 0) continue;
      const id = `${step.key}-${first.name}${first.tag ? `-${first.tag}` : ''}`;
      const heads = entry.map((b) => headOf(b.name, w));
      const quantity = quantityOfVector(first.name);
      let caption: string;
      switch (step.id) {
        case 'structure':
          caption = w.tables.prescribed;
          break;
        case 'global-member':
          caption = fill(w.tables.code, { member });
          break;
        case 'nodal-loads':
          caption = w.tables.P_nodal;
          break;
        case 'load-vector':
          caption = w.tables.P;
          break;
        case 'reduced':
          caption = w.tables.reducedVectors;
          break;
        case 'forward-pass':
          caption = fill(w.tables.multipliers, { pass: Number(step.facts.pass ?? 0) });
          break;
        case 'back-substitution':
          caption = w.tables.unknownTable;
          break;
        case 'solution':
          caption = first.name === 'residual' ? w.tables.residualTable : w.tables.solution;
          break;
        case 'displacements':
          caption = w.tables.displacements;
          break;
        case 'reactions':
          caption = w.tables.reactionsTable;
          break;
        case 'member-loads':
          caption = first.tag === 'total' ? fill(w.tables.fixedEndTotal, { member }) : first.name === 'f_FE' ? fill(w.tables.fixedEnd, { load: loadName(first.tag ?? '', w) }) : fill(w.tables.fixedEndGlobal, { member });
          break;
        case 'end-forces':
          caption = first.name === 'u_e' ? fill(w.tables.endGlobal, { member }) : first.name === 'u_local' ? fill(w.tables.endLocalMovements, { member }) : fill(w.tables.endLocalForces, { member });
          break;
        case 'checks':
          caption = first.name === 'joint' ? w.tables.joint : w.tables.systemTable;
          break;
        default:
          caption = first.name;
      }
      items.push({ kind: 'table', id, model: vectorsTable(entry, heads, opts(id, caption, quantity)) });
      continue;
    }
    if (entry.type === 'scalar') {
      pending.push(valueRow(step, entry, c));
      continue;
    }
    flush('values');
    if (entry.type !== 'matrix') continue;
    const m = entry;
    const id = `${step.key}-${m.name}${m.tag ? `-${m.tag}` : ''}`;
    const tag = m.tag ?? '';
    const pass = tag.startsWith('pass#') ? Number(tag.slice(5)) : 0;
    const key = m.name === 'augmented' && pass > 0 ? 'augmentedPass' : m.name === 'running' && member <= 1 ? 'runningFirst' : m.name;
    const template = (w.tables as Record<string, string | Record<string, string>>)[key];
    const caption = fill(typeof template === 'string' ? template : m.name, { member: step.id === 'assembly' || step.scope.kind === 'member' ? member : 0, pass });
    items.push({ kind: 'table', id, model: matrixTable(m, opts(id, caption, quantityOfMatrix(m.name))) });
  }
  flush('values');
  return items;
}

/** The number of entries a step's tables hold: the weight the page weighs a solution by, to decide how much to open at first. */
export function stepWeight(step: Step): number {
  let cells = 0;
  for (const b of step.blocks) cells += b.type === 'matrix' ? b.rowLabels.length * b.colLabels.length : b.type === 'vector' ? b.labels.length : 1;
  return cells;
}
