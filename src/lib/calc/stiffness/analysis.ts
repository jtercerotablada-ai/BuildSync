import { solve } from './engine';
import { maxAbs, maxAbsMat } from './linalg';
import { FROM_ENGINE, STIFFNESS_UNITS, issueRow, settlementOf, toEngine, type StiffnessForm, type StiffnessList, type StiffnessRow, type StiffnessUnitNames } from './model';
import { AGREE, LARGE, LIMIT, NEAR, RECORD_LIMIT, RESIDUAL, RESOLVE, RIGID, SHORT, STRAIN, WEAK, ZERO, type Block, type Check, type Dof, type DofKind, type EndLine, type Failure, type Issue, type Mode, type Solution, type Step, type Warning } from './types';

/**
 * ─────────────────────────────────────────────────────────────────────────────
 * STIFFNESS MATRIX, STEP BY STEP — from the form to everything the page prints and draws
 * ─────────────────────────────────────────────────────────────────────────────
 * This calculator's `analyse`: the form as it stands (model.ts) goes in; out come the faults by row, and — when the structure can be solved —
 * the worked solution (`solution`, every step), the tables (`results`) and every line of the drawing (`drawing`), ALREADY SETTLED. A value that is
 * rounding is zero here, once, so the steps, the tables and the drawing cannot say different things. The component lays it out and decides nothing
 * about a number.
 *
 * LABELS. Everything in this file is numbered FROM 1, as the page numbers it: node 1, member 1, support 1, load 1. A label is a row's place in its list,
 * so it changes when a row before it is deleted. `row` on an issue names the row by its id (which does not), `at` is the label of that row.
 *
 * NO WORDS. Where a word is wanted a STABLE MACHINE CODE and the numbers the sentence needs are given; the page writes the sentences, in both languages:
 *   issues[].code     IssueCode (types.ts has the numbers each carries);   warnings[].code  WarningCode;   support symbol: SupportSymbol below.
 *
 * THE SETTLING (ZERO = 1e-9, types.ts). The engine's `Solution` is raw. `analyse` returns it SETTLED: in every matrix and vector of every step but the
 * first (the inputs), an entry whose size is under ZERO of the largest of its block is exactly 0 (never −0, never 1e-14); the step 14 checks are
 * settled against the force scale of the problem (the moments against it times the size of the structure); the residual of step 10 against the largest
 * equation; the forces at the ends of a member against the force scale of the whole structure (a bar that carries nothing is 'no force', not a tension of
 * 1e-15). The tables are made from the settled numbers, so they are the same numbers the steps print. Scalars are left as they are (a −0 apart).
 * Settling a block changes nothing it stands for beyond one part in 10⁹ of its largest entry; replay.testlib.ts recomputes the settled solution to 1e-8.
 * EXCEPT the stiffness matrices K and the elimination (`EXACT_MATRICES`): the engine has already made an entry exactly 0 when it is no larger than the
 * error the arithmetic could have put in it, so what is printed is what was computed, and a floor measured against the largest entry of a poorly scaled
 * matrix cannot zero a real one (the last triangle printed gives the unknowns printed).
 *
 * UNITS. The steps are in the calculation units (feet, kips, radians; or metres, kilonewtons, radians: `calculation`, model.ts). The TABLES (`results`)
 * are in the units the form shows: displacements in inches or millimetres (a rotation in radians and degrees), stresses in ksi or MPa, forces and
 * moments the same numbers as the steps. The DRAWING is in the length unit shown (feet, metres), y UP (the page flips for the screen); its deformed
 * shape is exaggerated by a stated clean factor.
 */

/** The tolerances of types.ts, in one object for the copy: the sentences quote these numbers, so a sentence can never say 10⁻⁹ where the engine uses another. */
export const TOLERANCES = { resolve: RESOLVE, weak: WEAK, strain: STRAIN, residual: RESIDUAL, zero: ZERO, agree: AGREE, near: NEAR, short: SHORT, rigid: RIGID, large: LARGE, limit: LIMIT, record: RECORD_LIMIT } as const;

export type SupportSymbol = 'fixed' | 'pin' | 'roller-y' | 'roller-x' | 'guide-x' | 'guide-y' | 'rotation' | 'none';

export interface AnalysisIssue {
  code: Issue['code'];
  /** The row at fault, when it is one row; `at` is its label (from 1) in its list. */
  row?: StiffnessRow;
  at?: number;
  /** Everything else the engine says about it: labels from 1 for nodes, members and DOFs (types.ts, IssueCode). */
  nodes?: number[];
  members?: number[];
  groups?: number[][];
  count?: number;
  list?: StiffnessList;
  max?: number;
  length?: number;
  distance?: number;
  size?: number;
  dof?: number;
  /** 'mechanism' and 'stiffness-range': the DOF's label ('3y') and the node of it. */
  dofLabel?: string;
  node?: number;
  kind?: 'sway' | 'rigid-body';
  shape?: number[];
  ratio?: number;
  residual?: number;
  limit?: number;
}

export interface DisplacementLine {
  node: number;
  /** In inches or millimetres. */
  ux: number;
  uy: number;
  magnitude: number;
  /** Radians, counter-clockwise; null in truss mode. */
  rotation: number | null;
  rotationDegrees: number | null;
}

/** What a support does on its node: the reaction on each global direction it restrains (null: not restrained, no reaction there). */
export interface SupportReaction {
  /** The support's label among the supports, and its node's. */
  label: number;
  node: number;
  rx: number | null;
  ry: number | null;
  rm: number | null;
  /** The size of the force, ≥ 0 (the moment apart). */
  magnitude: number;
}

export type { EndLine };

export interface MemberLine {
  label: number;
  i: number;
  j: number;
  length: number;
  c: number;
  s: number;
  /** The direction of i→j, degrees counter-clockwise from +x, in (−180, 180]. */
  angle: number;
  /** E (ksi, GPa), A (in², mm²) and I (in⁴, 10⁶ mm⁴; null in truss mode) the member was solved with. */
  E: number;
  A: number;
  I: number | null;
  /** The internal forces just inside each end (the SIGNS of types.ts). A bar: V = M = 0. */
  start: EndLine;
  end: EndLine;
  /** Truss mode: the force (tension +), the stress N/A (ksi, MPa) and the elongation (in, mm). Null in frame mode. */
  bar: { N: number; stress: number; elongation: number; state: 'tension' | 'compression' | 'zero' } | null;
}

export interface StiffnessResults {
  displacements: DisplacementLine[];
  reactions: SupportReaction[];
  members: MemberLine[];
  /** The largest displacement of a node (inches, mm). */
  maxDisplacement: number;
  /** Step 14, settled: the checks, the sums (about the centre of the box around the nodes) and whether every check holds. */
  checks: Check[];
  equilibrium: {
    about: { x: number; y: number };
    sumFx: number;
    sumFy: number;
    sumM: number;
    /** The loads added up from their definitions, and the reactions added up: same terms as the sums (a moment about `about`). */
    applied: { fx: number; fy: number; m: number };
    reacted: { fx: number; fy: number; m: number };
    balanced: boolean;
    /** The floors: what is 0 below (a force; a moment). */
    floor: { force: number; moment: number };
    scale: number;
    size: number;
  };
}

/* ── The drawing ──────────────────────────────────────────────────────── */

export interface Box {
  x0: number;
  y0: number;
  x1: number;
  y1: number;
  width: number;
  height: number;
}
export interface Pt {
  x: number;
  y: number;
}

export interface DrawingNode {
  label: number;
  x: number;
  y: number;
  /** The DOF numbers of the node and their labels ('3x'), and which are restrained: what the drawing writes beside the node. */
  dofs: number[];
  dofLabels: string[];
  restrained: boolean[];
}
export interface DrawingMember {
  label: number;
  i: number;
  j: number;
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  length: number;
  /** The member's code vector: the DOF numbers of its two nodes in order. */
  code: number[];
}
export interface DrawingSupport {
  label: number;
  node: number;
  x: number;
  y: number;
  ux: boolean;
  uy: boolean;
  rz: boolean;
  symbol: SupportSymbol;
  /** The prescribed displacements that count (inches/mm; radians), or null when there is none. */
  settle: { dx: number; dy: number; dr: number } | null;
}
export interface DrawingNodalLoad {
  label: number;
  node: number;
  x: number;
  y: number;
  fx: number;
  fy: number;
  m: number;
  magnitude: number;
  /** Unit vector the force acts along ((0, 0) when there is no force). */
  dx: number;
  dy: number;
  /** Magnitude over the largest nodal force, 0 to 1. */
  share: number;
}
export interface DrawingMemberLoad {
  label: number;
  member: number;
  kind: 'udl' | 'point' | 'axial';
  /** The loaded stretch (global); a point load: both ends are its place. */
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  /** Distance of the stretch's start from node i, and its end. */
  a: number;
  b: number;
  /** The signed value (kip/ft, kN/m; kip, kN) and the unit vector (global) it pushes along when positive. */
  value: number;
  dx: number;
  dy: number;
  /** |value| over the largest of its class (lines; points), 0 to 1. */
  share: number;
}
export interface DrawingReaction {
  node: number;
  x: number;
  y: number;
  rx: number;
  ry: number;
  rm: number;
  magnitude: number;
  dx: number;
  dy: number;
  share: number;
}
/** The end forces of a member as a drawing labels them: where it is, what is at each end, and how big it is beside the others. */
export interface DrawingMemberForce {
  member: number;
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  /** The internal forces just inside each end (the SIGNS of types.ts; a bar has V = M = 0). */
  start: EndLine;
  end: EndLine;
  /** A bar: tension, compression or zero. Null in frame mode. */
  state: 'tension' | 'compression' | 'zero' | null;
  /** |N|, |V|, |M| (the larger of the two ends) over the largest of the whole structure, 0 to 1. A bar has N only. */
  share: { N: number; V: number; M: number };
}
export interface Deformed {
  /**
   * The factor the displacements are multiplied by to be drawn (1, 1.5, 2, 2.5, 3, 4, 5, 6, 8 × 10ⁿ). Null: nothing moves. BELOW 1 it is a REDUCTION, not an
   * exaggeration (the movement is a large share of the structure: the shape is drawn smaller than it was computed): `shrink` is then the clean number it is drawn
   * 1/N of (the factor is exactly 1/shrink), and the copy says 'drawn at 1/N of its computed size', never 'magnified 0.6 times'.
   */
  factor: number | null;
  /** When the factor is under 1, the clean number N (1.5, 2, 2.5, 3, 4, 5, 6, 8 × 10ⁿ) such that the shape is drawn at 1/N of its computed size; otherwise null. */
  shrink: number | null;
  /** The solution carries the 'large-displacements' warning (a member's chord turns by more than TOLERANCES.large): first order does not hold, and the drawn shape is the theory's. */
  large: boolean;
  /** The largest displacement of any point drawn — a node, or a point of a member bent by its loads (inches, mm) — and what it is drawn as a share of the larger side of the box (0.05 to 0.08). */
  maxDisplacement: number;
  share: number | null;
  nodes: { node: number; x: number; y: number }[];
  members: { member: number; points: Pt[] }[];
}
export interface StiffnessDrawing {
  nodes: DrawingNode[];
  members: DrawingMember[];
  supports: DrawingSupport[];
  loads: DrawingNodalLoad[];
  memberLoads: DrawingMemberLoad[];
  reactions: DrawingReaction[];
  /** The end forces of every member (empty when the structure is not solved). */
  forces: DrawingMemberForce[];
  deformed: Deformed | null;
  /** The box around the nodes, and the same padded all round by `pad`. Zero-size boxes at the origin for a structure with no node. */
  box: Box;
  frame: Box;
  pad: number;
  /** The larger side of `box`. */
  side: number;
}

/**
 * Whether the structure is statically determinate, by counting: a truss  degree = bars + reaction components − 2·joints; a frame (rigid joints, no hinges)
 * degree = 3·members + reaction components − 3·joints. 0 'determinate': the forces follow from equilibrium alone; above 0 'indeterminate' (the degree of
 * indeterminacy: the stiffness decides); 'unstable': below 0, or a mechanism, or too few supports was found; null: the model has a fault that comes before any count.
 * (A count of 0 or more does not prove stability: the elimination does.)
 */
export interface Determinacy {
  members: number;
  joints: number;
  reactions: number;
  degree: number;
  word: 'determinate' | 'indeterminate' | 'unstable' | null;
}

export interface StiffnessAnalysis {
  units: StiffnessUnitNames;
  mode: Mode;
  /** Faults that stop a solution, each once. Empty: solved. */
  issues: AnalysisIssue[];
  warnings: Warning[];
  /** The counts, also when the structure is not solved. `dofs` is 2 or 3 per node; `restrained` counts the restrained DOFs of the supports as they stand. */
  counts: { nodes: number; members: number; supports: number; loads: number; memberLoads: number; dofs: number; free: number; restrained: number };
  determinacy: Determinacy;
  /** The worked solution, settled; null when not solved. */
  solution: Solution | null;
  /** The steps worked out before a failure (a mechanism: steps 1 to 9 and the passes up to the zero pivot), settled; empty otherwise. */
  partial: Step[];
  results: StiffnessResults | null;
  drawing: StiffnessDrawing;
}

/** The steps grouped by their stage (1–14), in order: the page shows a stage as one section and the steps of its members or passes inside it. */
export function stagesOf(steps: readonly Step[]): { number: number; steps: Step[] }[] {
  const out: { number: number; steps: Step[] }[] = [];
  for (const step of steps) {
    const last = out[out.length - 1];
    if (last && last.number === step.number) last.steps.push(step);
    else out.push({ number: step.number, steps: [step] });
  }
  return out;
}

/* ── The settling ─────────────────────────────────────────────────────── */

const clean = (v: number): number => (v === 0 ? 0 : v);
/** The same value with every −0 in it a plain 0 (the drawing carries what the form holds: a −0 typed into a field is still nothing). */
function noNegativeZero<T>(value: T): T {
  if (typeof value === 'number') return (value === 0 ? 0 : value) as T;
  if (Array.isArray(value)) return value.map((v) => noNegativeZero(v)) as T;
  if (value && typeof value === 'object') return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, noNegativeZero(v)])) as T;
  return value;
}
const settle = (v: number, floor: number): number => (Math.abs(v) <= floor ? 0 : clean(v));
const numbers = (...v: number[]): boolean => v.every(Number.isFinite);

function settleVector(values: readonly number[], floor: number | ((index: number) => number)): number[] {
  return values.map((v, k) => settle(v, typeof floor === 'number' ? floor : floor(k)));
}

/** A block with its small entries settled. A matrix and a vector against the largest of their own entries (or `floor`); a scalar is only cleaned. */
function settleBlock(b: Block, floor?: number): Block {
  if (b.type === 'scalar') return { ...b, value: clean(b.value) };
  if (b.type === 'vector') return { ...b, values: settleVector(b.values, floor ?? ZERO * maxAbs(b.values)) };
  const f = floor ?? ZERO * maxAbsMat(b.values);
  return { ...b, values: b.values.map((row) => row.map((v) => settle(v, f))) };
}

/** `fixed` is the part of a step the settling leaves alone: the inputs. */
const UNTOUCHED = new Set(['structure']);

/**
 * The matrices the engine itself has already freed of rounding, entry by entry (an entry no larger than the error the arithmetic could have put in it is exactly 0
 * there): the stiffness of the structure at each stage of the assembly, its partition, and the elimination. They are printed as they were computed, so that the
 * triangle on the page gives the answer on the page; a floor measured against the largest entry of the whole matrix would zero a real entry of a poorly scaled one.
 */
const EXACT_MATRICES = new Set(['K', 'running', 'K_FF', 'K_FR', 'K_RF', 'K_RR', 'augmented']);

function settleSteps(steps: readonly Step[], context: { scale: number; size: number; dofs: Dof[]; floors: readonly (readonly number[])[] } | null): Step[] {
  return steps.map((step) => {
    if (UNTOUCHED.has(step.id)) return noNegativeZero(step);
    if (step.id === 'checks' && context) {
      const force = ZERO * context.scale;
      const moment = ZERO * context.scale * Math.max(context.size, 1e-300);
      const blocks = step.blocks.map((b): Block => {
        if (b.type === 'scalar') {
          if (b.name === 'ΣFx' || b.name === 'ΣFy') return { ...b, value: settle(b.value, force) };
          if (b.name === 'ΣM') return { ...b, value: settle(b.value, moment) };
          return { ...b, value: clean(b.value) };
        }
        if (b.type === 'vector') {
          const kinds = b.labels.map((l) => l.charAt(l.length - 1));
          return { ...b, values: settleVector(b.values, (k) => (kinds[k] === 'θ' ? moment : force)) };
        }
        return settleBlock(b);
      });
      return { ...step, blocks };
    }
    if (step.id === 'end-forces' && context) {
      // The forces at the ends of a member are measured against what rounding could have put into each of them (the engine's `floor`, from the terms that were
      // added up to make it): a bar that carries nothing has 1e-15 of rounding in it and that is not a tension, and a member much stiffer than the rest keeps its
      // real forces however small they are beside the terms of its own stiffness. The fixed-end forces are exact, never rounding. (The movements are measured
      // against the movements of the block.)
      const floor = step.scope.kind === 'member' ? context.floors[step.scope.member - 1] : undefined;
      const forces = new Set(['k·u_local', 'f']);
      return {
        ...step,
        blocks: step.blocks.map((b): Block => {
          if (b.type === 'vector' && b.name === 'f_FE') return { ...b, values: b.values.map(clean) };
          if (b.type === 'vector' && forces.has(b.name) && floor) return { ...b, values: settleVector(b.values, (k) => floor[k] ?? 0) };
          return settleBlock(b);
        }),
      };
    }
    if (step.id === 'solution') {
      const equation = typeof step.facts.equationScale === 'number' ? step.facts.equationScale : 0;
      const blocks = step.blocks.map((b): Block => {
        if (b.type === 'vector' && b.name === 'residual') return { ...b, values: settleVector(b.values, ZERO * equation) };
        if (b.type === 'scalar' && b.name === 'max|residual|') return { ...b, value: settle(b.value, ZERO * equation) };
        return settleBlock(b);
      });
      return { ...step, blocks };
    }
    return { ...step, blocks: step.blocks.map((b) => (b.type === 'matrix' && EXACT_MATRICES.has(b.name) ? settleBlock(b, 0) : settleBlock(b))) };
  });
}

function block<T extends Block['type']>(steps: readonly Step[], key: string, name: string, type: T): Extract<Block, { type: T }> | undefined {
  const step = steps.find((s) => s.key === key);
  return step?.blocks.find((b): b is Extract<Block, { type: T }> => b.type === type && b.name === name && b.tag === undefined);
}

/** The solution with the settling applied to its steps, and its own arrays brought to the same numbers (so the tables and the steps agree). */
export function settleSolution(sol: Solution): Solution {
  const steps = settleSteps(sol.steps, { scale: sol.scale, size: sol.size, dofs: sol.dofs, floors: sol.forces.map((f) => f.floor) });
  const u = block(steps, 'displacements', 'u', 'vector')?.values ?? sol.u;
  const P = block(steps, 'load-vector', 'P', 'vector')?.values ?? sol.P;
  const K = block(steps, 'assembled', 'K', 'matrix')?.values ?? sol.K;
  const R = block(steps, 'reactions', 'R', 'vector')?.values;
  const reactions = sol.reactions.map((r, k) => ({ ...r, value: R ? R[k] : clean(r.value) }));
  const forces = sol.forces.map((f, k) => {
    const key = `end-forces#${k + 1}`;
    const get = (name: string) => block(steps, key, name, 'vector')?.values;
    const fv = get('f') ?? f.f;
    const uGlobal = get('u_e') ?? f.uGlobal;
    const uLocal = get('u_local') ?? f.uLocal;
    const fixedEnd = f.fixedEnd ? (get('f_FE') ?? f.fixedEnd) : null;
    const frame = sol.mode === 'frame';
    const start = frame ? { N: clean(0 - fv[0]), V: clean(fv[1]), M: clean(0 - fv[2]) } : { N: clean(0 - fv[0]), V: 0, M: 0 };
    const end = frame ? { N: clean(fv[3]), V: clean(0 - fv[4]), M: clean(fv[5]) } : { N: clean(fv[1]), V: 0, M: 0 };
    // (an elongation is the difference of two displacements: what is rounding in it is measured against them, so a bar that carries nothing does not lengthen)
    // (and a bar that carries no force does not lengthen: N = EA·δ/L, so a δ that is rounding goes with an N that is)
    const bar = f.bar ? { N: end.N, stress: clean(end.N / sol.members[k].A), elongation: end.N === 0 ? 0 : settle(uLocal[1] - uLocal[0], ZERO * Math.max(Math.abs(uLocal[0]), Math.abs(uLocal[1]))) } : null;
    return { ...f, f: fv, uGlobal, uLocal, fixedEnd, start, end, bar };
  });
  // The ends block and the scalars of an end-forces step are made again from the settled vector, so that they are the numbers the table has.
  const finalSteps = steps.map((step) => {
    if (step.id !== 'end-forces' || step.scope.kind !== 'member') return step;
    const fo = forces[step.scope.member - 1];
    return {
      ...step,
      blocks: step.blocks.map((b): Block => {
        if (b.type === 'matrix' && b.name === 'ends') return { ...b, values: [[fo.start.N, fo.end.N], [fo.start.V, fo.end.V], [fo.start.M, fo.end.M]] };
        if (b.type === 'scalar' && fo.bar) {
          if (b.name === 'N') return { ...b, value: fo.bar.N };
          if (b.name === 'σ') return { ...b, value: fo.bar.stress };
          if (b.name === 'δ') return { ...b, value: fo.bar.elongation };
        }
        return b;
      }),
    };
  });
  const force = ZERO * sol.scale;
  const moment = ZERO * sol.scale * Math.max(sol.size, 1e-300);
  const checks = sol.checks.map((c) => ({ ...c, value: settle(c.value, c.id === 'sum-moment' ? moment : c.id === 'energy' ? ZERO * c.scale : force) }));
  return { ...sol, steps: finalSteps, u, P, K, reactions, forces, checks };
}

/* ── Clean numbers for the exaggeration ───────────────────────────────── */

const NICE_FACTOR = [1, 1.5, 2, 2.5, 3, 4, 5, 6, 8];
export function nice(target: number, series: readonly number[] = NICE_FACTOR): number {
  if (!(target > 0) || !Number.isFinite(target)) return 1;
  const decade = Math.floor(Math.log10(target));
  let best = 1;
  let bestDistance = Infinity;
  for (const d of [decade - 1, decade, decade + 1]) {
    for (const s of [...series, 10]) {
      const v = s * 10 ** d;
      const dist = Math.abs(Math.log(v / target));
      if (dist < bestDistance) {
        bestDistance = dist;
        best = v;
      }
    }
  }
  return Number(best.toPrecision(6));
}

/* ── The drawing ──────────────────────────────────────────────────────── */

const emptyBox = (): Box => ({ x0: 0, y0: 0, x1: 0, y1: 0, width: 0, height: 0 });
function boxOf(points: Pt[], pad = 0): Box {
  if (points.length === 0) return emptyBox();
  let x0 = Infinity;
  let x1 = -Infinity;
  let y0 = Infinity;
  let y1 = -Infinity;
  for (const p of points) {
    x0 = Math.min(x0, p.x);
    x1 = Math.max(x1, p.x);
    y0 = Math.min(y0, p.y);
    y1 = Math.max(y1, p.y);
  }
  x0 -= pad;
  x1 += pad;
  y0 -= pad;
  y1 += pad;
  return { x0, y0, x1, y1, width: x1 - x0, height: y1 - y0 };
}

export function symbolOf(s: { ux: boolean; uy: boolean; rz: boolean }, mode: Mode): SupportSymbol {
  const rz = mode === 'frame' && s.rz;
  if (s.ux && s.uy && rz) return 'fixed';
  if (s.ux && s.uy) return 'pin';
  if (!rz) {
    if (s.uy) return 'roller-y';
    if (s.ux) return 'roller-x';
    return 'none';
  }
  if (s.uy) return 'guide-y';
  if (s.ux) return 'guide-x';
  return 'rotation';
}

function drawingOf(form: StiffnessForm): StiffnessDrawing {
  const frame = form.mode === 'frame';
  const nd = frame ? 3 : 2;
  const label = new Map(form.nodes.map((n, k) => [n.id, k + 1]));
  const at = new Map(form.nodes.map((n) => [n.id, n]));
  const memberLabel = new Map(form.members.map((m, k) => [m.id, k + 1]));
  const placed = form.nodes.filter((n) => numbers(n.x, n.y));
  const restrained = new Set<number>();
  const done = new Set<number>();
  form.supports.forEach((s) => {
    const k = label.get(s.node);
    if (k === undefined || done.has(k)) return;
    done.add(k);
    if (s.ux) restrained.add(nd * (k - 1) + 1);
    if (s.uy) restrained.add(nd * (k - 1) + 2);
    if (frame && s.rz) restrained.add(nd * (k - 1) + 3);
  });
  const nodes: DrawingNode[] = placed.map((n) => {
    const k = label.get(n.id)!;
    const dofs = frame ? [3 * k - 2, 3 * k - 1, 3 * k] : [2 * k - 1, 2 * k];
    const kinds: DofKind[] = frame ? ['x', 'y', 'θ'] : ['x', 'y'];
    return { label: k, x: n.x, y: n.y, dofs, dofLabels: kinds.map((kind) => `${k}${kind}`), restrained: dofs.map((d) => restrained.has(d)) };
  });
  const members: DrawingMember[] = [];
  form.members.forEach((m, k) => {
    const a = at.get(m.i);
    const b = at.get(m.j);
    if (!a || !b || !numbers(a.x, a.y, b.x, b.y)) return;
    const i = label.get(m.i)!;
    const j = label.get(m.j)!;
    const dof = (n: number) => (frame ? [3 * n - 2, 3 * n - 1, 3 * n] : [2 * n - 1, 2 * n]);
    members.push({ label: k + 1, i, j, x1: a.x, y1: a.y, x2: b.x, y2: b.y, length: Math.hypot(b.x - a.x, b.y - a.y), code: [...dof(i), ...dof(j)] });
  });
  const supports: DrawingSupport[] = [];
  form.supports.forEach((s, k) => {
    const n = at.get(s.node);
    if (!n || !numbers(n.x, n.y)) return;
    const st = settlementOf(s, form.mode);
    // (a settlement that is not a number is not drawn: the fault is said against its row)
    const finite = (v: number) => (Number.isFinite(v) ? v : 0);
    const any = finite(st.dx) !== 0 || finite(st.dy) !== 0 || finite(st.dr) !== 0;
    supports.push({
      label: k + 1,
      node: label.get(s.node)!,
      x: n.x,
      y: n.y,
      ux: s.ux,
      uy: s.uy,
      rz: frame && s.rz,
      symbol: symbolOf(s, form.mode),
      settle: any ? { dx: finite(st.dx), dy: finite(st.dy), dr: finite(st.dr) } : null,
    });
  });
  const loads: DrawingNodalLoad[] = [];
  form.loads.forEach((l, k) => {
    const n = at.get(l.node);
    if (!n || !numbers(n.x, n.y, l.fx, l.fy)) return;
    const m = frame ? l.m : 0;
    if (!Number.isFinite(m)) return;
    const magnitude = Math.hypot(l.fx, l.fy);
    if (magnitude === 0 && m === 0) return;
    loads.push({ label: k + 1, node: label.get(l.node)!, x: n.x, y: n.y, fx: l.fx, fy: l.fy, m, magnitude, dx: magnitude === 0 ? 0 : l.fx / magnitude, dy: magnitude === 0 ? 0 : l.fy / magnitude, share: 0 });
  });
  const topLoad = Math.max(0, ...loads.map((l) => l.magnitude));
  for (const l of loads) l.share = topLoad === 0 ? 0 : l.magnitude / topLoad;

  const memberLoads: DrawingMemberLoad[] = [];
  if (frame) {
    form.memberLoads.forEach((l, k) => {
      const mk = memberLabel.get(l.member);
      const m = mk === undefined ? undefined : form.members[mk - 1];
      const a = m && at.get(m.i);
      const b = m && at.get(m.j);
      if (!m || !a || !b || !numbers(a.x, a.y, b.x, b.y)) return;
      const L = Math.hypot(b.x - a.x, b.y - a.y);
      if (!(L > 0)) return;
      const c = (b.x - a.x) / L;
      const s = (b.y - a.y) / L;
      const point = l.kind === 'point';
      const from = point ? l.a : 0;
      const to = point ? l.a : L;
      const value = l.kind === 'udl' ? l.w : l.kind === 'point' ? l.P : l.q;
      if (!numbers(from, to, value)) return;
      // The direction a positive value pushes: along +ȳ (the left of i→j) for a UDL and a point load, along +x̄ for an axial load.
      const dir: [number, number] = l.kind === 'axial' ? [c, s] : [-s, c];
      memberLoads.push({
        label: k + 1,
        member: mk!,
        kind: l.kind,
        x1: a.x + c * from,
        y1: a.y + s * from,
        x2: a.x + c * to,
        y2: a.y + s * to,
        a: from,
        b: to,
        value,
        dx: clean(dir[0]),
        dy: clean(dir[1]),
        share: 0,
      });
    });
    const classOf = (kind: DrawingMemberLoad['kind']) => (kind === 'point' ? 'point' : 'line');
    const top = new Map<string, number>();
    for (const l of memberLoads) top.set(classOf(l.kind), Math.max(top.get(classOf(l.kind)) ?? 0, Math.abs(l.value)));
    for (const l of memberLoads) {
      const t = top.get(classOf(l.kind)) ?? 0;
      l.share = t === 0 ? 0 : Math.abs(l.value) / t;
    }
  }

  const box = boxOf(nodes);
  const side = Math.max(box.width, box.height);
  const pad = side > 0 ? 0.14 * side : 1;
  const frameBox = nodes.length === 0 ? emptyBox() : boxOf(nodes, pad);
  return { nodes, members, supports, loads, memberLoads, reactions: [], forces: [], deformed: null, box, frame: frameBox, pad, side };
}

function deformedOf(sol: Solution, drawing: StiffnessDrawing, toShown: number, form: StiffnessForm): Deformed {
  const frame = sol.mode === 'frame';
  const POINTS = 17;
  // The displacement of every point that is drawn, global components in the calculation units: the nodes, and along every member of a frame the curve it bends in
  // (the Hermite cubic of its end displacements and, with its loads, the deflection of the member held at both ends under them).
  const nodeShift = sol.nodes.map((n) => ({ x: sol.u[n.dofs[0] - 1], y: sol.u[n.dofs[1] - 1] }));
  const curves = sol.members.map((m, k) => {
    const a = sol.nodes[m.i - 1];
    if (!frame) {
      return { base: [{ x: a.x, y: a.y }, { x: sol.nodes[m.j - 1].x, y: sol.nodes[m.j - 1].y }], shift: [nodeShift[m.i - 1], nodeShift[m.j - 1]] };
    }
    const [u1, v1, t1, u2, v2, t2] = sol.forces[k].uLocal;
    const L = m.length;
    const EI = m.E * (m.I ?? 0);
    const EA = m.E * m.A;
    const mine = form.memberLoads.filter((l) => form.members.findIndex((r) => r.id === l.member) === k);
    const base: Pt[] = [];
    const shift: Pt[] = [];
    for (let q = 0; q < POINTS; q++) {
      const x = (L * q) / (POINTS - 1);
      const s = x / L;
      let v = (1 - 3 * s * s + 2 * s * s * s) * v1 + L * (s - 2 * s * s + s * s * s) * t1 + (3 * s * s - 2 * s * s * s) * v2 + L * (-s * s + s * s * s) * t2;
      let u = (1 - s) * u1 + s * u2;
      for (const l of mine) {
        if (l.kind === 'udl') v += (l.w * x * x * (L - x) * (L - x)) / (24 * EI);
        else if (l.kind === 'point') {
          const aa = l.a;
          const bb = L - aa;
          v += x <= aa ? (l.P * bb * bb * x * x * (3 * aa * L - x * (3 * aa + bb))) / (6 * L * L * L * EI) : (l.P * aa * aa * (L - x) * (L - x) * (3 * bb * L - (L - x) * (3 * bb + aa))) / (6 * L * L * L * EI);
        } else u += (l.q * x * (L - x)) / (2 * EA);
      }
      base.push({ x: a.x + m.c * x, y: a.y + m.s * x });
      shift.push({ x: m.c * u - m.s * v, y: m.s * u + m.c * v });
    }
    return { base, shift };
  });
  let maxDisp = 0;
  for (const d of nodeShift) maxDisp = Math.max(maxDisp, Math.hypot(d.x, d.y));
  for (const c of curves) for (const d of c.shift) maxDisp = Math.max(maxDisp, Math.hypot(d.x, d.y));
  const side = drawing.side;
  let factor: number | null = null;
  let shrink: number | null = null;
  if (maxDisp > 0 && side > 0 && Number.isFinite(maxDisp)) {
    const target = (0.065 * side) / maxDisp;
    // A movement bigger than the share the drawing gives it is drawn at 1/N of the computed size, with N a clean number: the factor is exactly 1/N.
    if (target >= 1) factor = nice(target);
    else {
      shrink = nice(1 / target);
      factor = shrink > 1 ? 1 / shrink : 1;
      if (!(shrink > 1)) shrink = null;
    }
  }
  const f = factor ?? 0;
  const nodes = sol.nodes.map((n, k) => ({ node: n.label, x: n.x + f * nodeShift[k].x, y: n.y + f * nodeShift[k].y }));
  const members = sol.members.map((m, k) => ({ member: m.label, points: curves[k].base.map((p, q) => ({ x: p.x + f * curves[k].shift[q].x, y: p.y + f * curves[k].shift[q].y })) }));
  // Under 1 the movement is so large beside the structure that the shape is drawn SMALLER than computed: it is said as 1/N, and N is a clean number.
  return {
    factor,
    shrink,
    large: sol.warnings.some((w) => w.code === 'large-displacements'),
    maxDisplacement: maxDisp * toShown,
    share: factor === null || side === 0 ? null : (factor * maxDisp) / side,
    nodes,
    members,
  };
}

/* ── The results ──────────────────────────────────────────────────────── */

function resultsOf(form: StiffnessForm, sol: Solution): StiffnessResults {
  const shown = FROM_ENGINE[form.units];
  const frame = sol.mode === 'frame';
  const dofOf = (node: number, kind: DofKind) => sol.dofs.find((d) => d.node === node && d.kind === kind)!;
  const displacements: DisplacementLine[] = sol.nodes.map((n) => {
    const ux = clean(sol.u[dofOf(n.label, 'x').number - 1] * shown.displacement);
    const uy = clean(sol.u[dofOf(n.label, 'y').number - 1] * shown.displacement);
    const rotation = frame ? clean(sol.u[dofOf(n.label, 'θ').number - 1]) : null;
    return { node: n.label, ux, uy, magnitude: Math.hypot(ux, uy), rotation, rotationDegrees: rotation === null ? null : clean((rotation * 180) / Math.PI) };
  });
  const reactions: SupportReaction[] = [];
  const nodeLabelOf = new Map(form.nodes.map((n, k) => [n.id, k + 1]));
  form.supports.forEach((s, k) => {
    const node = nodeLabelOf.get(s.node);
    if (node === undefined) return;
    const get = (kind: DofKind): number | null => sol.reactions.find((r) => r.node === node && r.kind === kind)?.value ?? null;
    const rx = get('x');
    const ry = get('y');
    const rm = frame ? get('θ') : null;
    if (rx === null && ry === null && rm === null) return;
    reactions.push({ label: k + 1, node, rx, ry, rm, magnitude: Math.hypot(rx ?? 0, ry ?? 0) });
  });
  const members: MemberLine[] = sol.members.map((m, k) => {
    const fo = sol.forces[k];
    return {
      label: m.label,
      i: m.i,
      j: m.j,
      length: m.length,
      c: m.c,
      s: m.s,
      angle: m.angle,
      E: form.members[k].E ?? form.E ?? 0,
      A: form.members[k].A ?? form.A ?? 0,
      I: frame ? (form.members[k].I ?? form.I) : null,
      start: fo.start,
      end: fo.end,
      bar: fo.bar
        ? { N: fo.bar.N, stress: clean(fo.bar.stress * shown.stress), elongation: clean(fo.bar.elongation * shown.displacement), state: fo.bar.N > 0 ? 'tension' : fo.bar.N < 0 ? 'compression' : 'zero' }
        : null,
    };
  });
  const reacted = { fx: 0, fy: 0, m: 0 };
  for (const r of sol.reactions) {
    const n = sol.nodes[r.node - 1];
    if (r.kind === 'x') {
      reacted.fx += r.value;
      reacted.m -= (n.y - sol.about.y) * r.value;
    } else if (r.kind === 'y') {
      reacted.fy += r.value;
      reacted.m += (n.x - sol.about.x) * r.value;
    } else reacted.m += r.value;
  }
  const force = ZERO * sol.scale;
  const moment = ZERO * sol.scale * Math.max(sol.size, 1e-300);
  const sum = (id: string) => sol.checks.find((c) => c.id === id)!;
  let appliedFx = 0;
  let appliedFy = 0;
  let appliedM = 0;
  // The loads added up, as the checks did: from the model's own loads and member loads.
  for (const l of form.loads) {
    const n = form.nodes.find((r) => r.id === l.node);
    if (!n) continue;
    appliedFx += l.fx;
    appliedFy += l.fy;
    appliedM += (n.x - sol.about.x) * l.fy - (n.y - sol.about.y) * l.fx + (frame ? l.m : 0);
  }
  if (frame) {
    form.memberLoads.forEach((l) => {
      const mi = form.members.findIndex((m) => m.id === l.member);
      if (mi < 0) return;
      const m = sol.members[mi];
      const a = sol.nodes[m.i - 1];
      const L = m.length;
      const t = l.kind === 'point' ? l.a : L / 2;
      const flx = l.kind === 'axial' ? l.q * L : 0;
      const fly = l.kind === 'udl' ? l.w * L : l.kind === 'point' ? l.P : 0;
      const gx = m.c * flx - m.s * fly;
      const gy = m.s * flx + m.c * fly;
      appliedFx += gx;
      appliedFy += gy;
      appliedM += (a.x + m.c * t - sol.about.x) * gy - (a.y + m.s * t - sol.about.y) * gx;
    });
  }
  const maxDisplacement = Math.max(0, ...displacements.map((d) => d.magnitude));
  return {
    displacements,
    reactions,
    members,
    maxDisplacement,
    checks: sol.checks,
    equilibrium: {
      about: sol.about,
      sumFx: sum('sum-fx').value,
      sumFy: sum('sum-fy').value,
      sumM: sum('sum-moment').value,
      applied: { fx: settle(appliedFx, force), fy: settle(appliedFy, force), m: settle(appliedM, moment) },
      reacted: { fx: settle(reacted.fx, force), fy: settle(reacted.fy, force), m: settle(reacted.m, moment) },
      balanced: sol.checks.every((c) => c.ok),
      floor: { force, moment },
      scale: sol.scale,
      size: sol.size,
    },
  };
}

/* ── The analysis ─────────────────────────────────────────────────────── */

function countsOf(form: StiffnessForm): StiffnessAnalysis['counts'] {
  const nd = form.mode === 'frame' ? 3 : 2;
  const seen = new Set<number>();
  let restrained = 0;
  for (const s of form.supports) {
    if (seen.has(s.node) || !form.nodes.some((n) => n.id === s.node)) continue;
    seen.add(s.node);
    restrained += (s.ux ? 1 : 0) + (s.uy ? 1 : 0) + (form.mode === 'frame' && s.rz ? 1 : 0);
  }
  const dofs = nd * form.nodes.length;
  return { nodes: form.nodes.length, members: form.members.length, supports: form.supports.length, loads: form.loads.length, memberLoads: form.memberLoads.length, dofs, restrained, free: Math.max(0, dofs - restrained) };
}

function determinacyOf(form: StiffnessForm, counts: StiffnessAnalysis['counts'], issues: readonly Issue[]): Determinacy {
  const frame = form.mode === 'frame';
  const members = form.members.length;
  const joints = form.nodes.length;
  const reactions = counts.restrained;
  const degree = frame ? 3 * members + reactions - 3 * joints : members + reactions - 2 * joints;
  const unstable = issues.some((i) => i.code === 'mechanism' || i.code === 'few-supports');
  const word: Determinacy['word'] = issues.length > 0 && !unstable ? null : unstable || degree < 0 ? 'unstable' : degree === 0 ? 'determinate' : 'indeterminate';
  return { members, joints, reactions, degree, word };
}

function analysisIssues(form: StiffnessForm, rows: ReturnType<typeof toEngine>['rows'], issues: Issue[]): AnalysisIssue[] {
  return issues.map((i): AnalysisIssue => {
    const { where, ...rest } = i;
    void where;
    const out: AnalysisIssue = { ...rest };
    const row = issueRow(i, rows);
    if (row) {
      out.row = row;
      if (row.list !== 'model') out.at = form[row.list].findIndex((r) => r.id === row.id) + 1;
    }
    if (i.code === 'section' && row && (row.field === 'E' || row.field === 'A' || row.field === 'I')) {
      // The sentence is chosen by two numbers it is handed through the holes it already has (`{count|…|…}` and `{max|…|…}`): whether the field is the STRUCTURE's own (1: it
      // cannot be left blank, members take it) or a member's (0: blank takes the structure's), and whether the value typed is zero or below (1: 'must be greater than zero').
      const value = row.list === 'model' ? form[row.field] : row.list === 'members' ? form.members.find((m) => m.id === row.id)?.[row.field] : null;
      out.count = row.list === 'model' ? 1 : 0;
      out.max = typeof value === 'number' && value > 0 ? 0 : 1;
    }
    if ((i.code === 'mechanism' || i.code === 'stiffness-range') && i.dof !== undefined) {
      const nd = form.mode === 'frame' ? 3 : 2;
      const kinds = form.mode === 'frame' ? ['x', 'y', 'θ'] : ['x', 'y'];
      out.dofLabel = `${Math.floor((i.dof - 1) / nd) + 1}${kinds[(i.dof - 1) % nd]}`;
    }
    return out;
  });
}

export function analyseStiffness(form: StiffnessForm): StiffnessAnalysis {
  const units = STIFFNESS_UNITS[form.units];
  const { model, rows } = toEngine(form);
  const outcome = solve(model);
  const counts = countsOf(form);
  const drawing = drawingOf(form);
  if (!outcome.ok) {
    const failure: Failure = outcome;
    return {
      units,
      mode: form.mode,
      issues: analysisIssues(form, rows, failure.issues),
      warnings: [],
      counts,
      determinacy: determinacyOf(form, counts, failure.issues),
      solution: null,
      partial: settleSteps(failure.steps, null),
      results: null,
      drawing: noNegativeZero(drawing),
    };
  }
  const solution = settleSolution(outcome);
  const results = resultsOf(form, solution);
  drawing.reactions = reactionsOf(form, solution, results);
  drawing.forces = forcesOf(solution, results);
  drawing.deformed = deformedOf(solution, drawing, FROM_ENGINE[form.units].displacement, form);
  return { units, mode: form.mode, issues: [], warnings: solution.warnings, counts, determinacy: determinacyOf(form, counts, []), solution, partial: [], results: noNegativeZero(results), drawing: noNegativeZero(drawing) };
}
/** The shell's name for the same thing. */
export const analyse = analyseStiffness;

function forcesOf(sol: Solution, results: StiffnessResults): DrawingMemberForce[] {
  const big = { N: 0, V: 0, M: 0 };
  for (const m of results.members) {
    big.N = Math.max(big.N, Math.abs(m.start.N), Math.abs(m.end.N));
    big.V = Math.max(big.V, Math.abs(m.start.V), Math.abs(m.end.V));
    big.M = Math.max(big.M, Math.abs(m.start.M), Math.abs(m.end.M));
  }
  const share = (v: number, top: number) => (top === 0 ? 0 : Math.min(1, v / top));
  return results.members.map((m) => {
    const a = sol.nodes[m.i - 1];
    const b = sol.nodes[m.j - 1];
    return {
      member: m.label,
      x1: a.x,
      y1: a.y,
      x2: b.x,
      y2: b.y,
      start: m.start,
      end: m.end,
      state: m.bar ? m.bar.state : null,
      share: {
        N: share(Math.max(Math.abs(m.start.N), Math.abs(m.end.N)), big.N),
        V: share(Math.max(Math.abs(m.start.V), Math.abs(m.end.V)), big.V),
        M: share(Math.max(Math.abs(m.start.M), Math.abs(m.end.M)), big.M),
      },
    };
  });
}

function reactionsOf(form: StiffnessForm, sol: Solution, results: StiffnessResults): DrawingReaction[] {
  const out: DrawingReaction[] = [];
  const nodeOf = new Map(sol.nodes.map((n) => [n.label, n]));
  for (const r of results.reactions) {
    const n = nodeOf.get(r.node);
    if (!n || !numbers(n.x, n.y)) continue;
    const rx = r.rx ?? 0;
    const ry = r.ry ?? 0;
    const rm = r.rm ?? 0;
    const magnitude = Math.hypot(rx, ry);
    if (magnitude === 0 && rm === 0) continue;
    out.push({ node: r.node, x: n.x, y: n.y, rx, ry, rm, magnitude, dx: magnitude === 0 ? 0 : rx / magnitude, dy: magnitude === 0 ? 0 : ry / magnitude, share: 0 });
  }
  const top = Math.max(0, ...out.map((r) => r.magnitude));
  for (const r of out) r.share = top === 0 ? 0 : r.magnitude / top;
  void form;
  return out;
}

/**
 * `analyseStiffness`, which nothing it is given can make throw. The form goes through the engine (which does not throw) and through this file's
 * arithmetic; if anything in it did, the page would be a blank box — so it is caught here and said as 'stopped', with the drawing the form still allows.
 */
export function analyseSafely(form: StiffnessForm): StiffnessAnalysis {
  try {
    return analyseStiffness(form);
  } catch {
    let drawing: StiffnessDrawing;
    try {
      drawing = drawingOf(form);
    } catch {
      const zero = emptyBox();
      drawing = { nodes: [], members: [], supports: [], loads: [], memberLoads: [], reactions: [], forces: [], deformed: null, box: zero, frame: { x0: -1, y0: -1, x1: 1, y1: 1, width: 2, height: 2 }, pad: 1, side: 0 };
    }
    return {
      units: STIFFNESS_UNITS[form.units] ?? STIFFNESS_UNITS.us,
      mode: form.mode === 'frame' ? 'frame' : 'truss',
      issues: [{ code: 'stopped' }],
      warnings: [],
      counts: { nodes: 0, members: 0, supports: 0, loads: 0, memberLoads: 0, dofs: 0, free: 0, restrained: 0 },
      determinacy: { members: 0, joints: 0, reactions: 0, degree: 0, word: null },
      solution: null,
      partial: [],
      results: null,
      drawing,
    };
  }
}

