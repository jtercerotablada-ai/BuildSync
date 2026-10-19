import { jacobiEigen, maxAbs, type Mat } from './linalg';
import {
  DD_ONE,
  DD_ZERO,
  dd,
  ddAbs,
  ddAdd,
  ddAddD,
  ddDiv,
  ddDivD,
  ddIsZero,
  ddMatMul,
  ddMatMulSize,
  ddMul,
  ddMulD,
  ddNeg,
  ddSqrt,
  ddSub,
  ddTranspose,
  ddZeros,
  prod2,
  sum2,
  type DD,
} from './dd';
import {
  AGREE,
  ASSEMBLY,
  EPSILON_DD,
  LARGE,
  LIMIT,
  MAX_LOADS,
  MAX_MEMBERS,
  MAX_MEMBER_LOADS,
  MAX_NODES,
  MAX_SUPPORTS,
  NEAR,
  RECORD_LIMIT,
  RESIDUAL,
  RESOLVE,
  RIGID,
  ROUNDING,
  SECTION_LOW,
  SHORT,
  STRAIN,
  WEAK,
  ZERO,
  type Block,
  type Check,
  type Dof,
  type DofKind,
  type Failure,
  type Highlight,
  type Issue,
  type ListName,
  type MatrixBlock,
  type MemberForces,
  type Mode,
  type Outcome,
  type ReactionEntry,
  type ScalarBlock,
  type SolvedMember,
  type SolvedNode,
  type Solution,
  type Step,
  type StepId,
  type StepScope,
  type StiffnessMemberLoad,
  type StiffnessModel,
  type StiffnessSupport,
  type VectorBlock,
  type Warning,
} from './types';

/**
 * ─────────────────────────────────────────────────────────────────────────────
 * STIFFNESS MATRIX, STEP BY STEP — the engine: the direct stiffness method, written out
 * ─────────────────────────────────────────────────────────────────────────────
 * types.ts has what goes in, what comes out, the signs and the code of every problem. `solve` never throws and never
 * returns a NaN or an Infinity: the result is a Solution whose every number is finite, or a Failure with its issues.
 *
 * THE METHOD, as a student writes it by hand, and the engine RECORDS EACH STEP AS DATA (`Solution.steps`):
 *   1  the structure and the numbering of its degrees of freedom (DOFs);
 *   2  for each member its geometry (L, c, s);
 *   3  its LOCAL stiffness matrix k;             4  the TRANSFORMATION matrix T (u_local = T u_global);
 *   5  its GLOBAL matrix K_e = Tᵀ k T and its code vector (the global DOF of each of its local DOFs);
 *   6  the ASSEMBLY of the structure stiffness matrix K, member by member, with the running K;
 *   7  the LOAD VECTOR: nodal loads and, in frame mode, the fixed-end forces of the member loads → equivalent nodal loads;
 *   8  the PARTITION into free (F) and restrained (R) DOFs;   9  the REDUCED EQUATION K_FF u_F = P_F − K_FR u_R;
 *  10  its SOLUTION by Gaussian elimination without row exchanges (K_FF is symmetric and positive definite for a stable structure),
 *      recorded pass by pass for up to 12 free DOFs;
 *  11  the full DISPLACEMENT vector;   12  the REACTIONS R = K_RF u_F + K_RR u_R − P_R;
 *  13  the MEMBER END FORCES f = k·T·u_e + f_FE and the internal forces N, V, M at both ends;
 *  14  the CHECKS: equilibrium of the whole and of every joint, the energy identity, the residual of K u = P + R.
 *
 * EVERY NUMBER OF A STEP IS COMPUTED FROM THE EARLIER STEPS' DATA (and the model's loads), by the very expression the
 * step's formulas state, so that a student can redo each from the page: replay.testlib.ts recomputes each step from the
 * previous steps alone and compares.
 *
 * THE ARITHMETIC. Everything is worked in double-double numbers (dd.ts: two doubles, about 32 significant digits), and what a step prints is each number
 * rounded to a double. A rigid link, an inextensible column, a member a million times stiffer than its neighbours make a stiffness matrix whose
 * terms differ by that much: with 16 digits their sum keeps a few figures of the soft part or none; with 32 it keeps 16 or more, so the structures
 * engineers write down are solved to the figures printed. Beside every entry the engine carries the largest error its arithmetic could have put in it
 * (a running forward bound: the rounding of the terms that made the entry, the errors of the entries it was made from, grown by every multiplier), and
 * every number it prints as zero is a number no larger than that bound: a value is never zero because it is small, and rounding is never a value.
 *
 * STABILITY. A structure is stable (to first order) exactly when K_FF is positive definite. The elimination finds out against the ROUNDING of the
 * arithmetic and not against the stiffness a DOF started with: a pivot that its error reaches RESOLVE of is zero for the arithmetic. The movement it
 * allows (the pivot's DOF set to 1, the rows already eliminated solved for the rest: the null mode) is then tried on every member: if none is strained
 * (STRAIN) the structure is a 'mechanism', a rigid-body motion of the whole if it fits a translation and a rotation of the whole to RIGID, a 'sway'
 * otherwise. The null mode is worked in the same 32 digits, so it is not blurred by a stiff member beside it; if it does strain a member, the structure
 * is searched for a movement that does not (an elimination with the largest diagonal first: its null space; the eigenvectors of the unit-diagonal matrix),
 * and only when none is found is it called 'stiffness-range': stable as far as the movements can be found, and too badly scaled for even the 32 digits.
 * A structure with fewer than 3 restrained DOFs is refused first ('few-supports') and the elimination is not tried.
 *
 * HOW MANY FIGURES. What is uncertain in each equation (the residual the unknowns leave, the rounding of its terms, the errors of the stiffnesses and of the loads it is
 * made of) is gathered, and the answer moves by the inverse of K_FF times that and by nothing else: so a displacement, a reaction and an end force each have a bound, in which
 * a stiff member that holds two soft nodes together does not count its stiffness twice (the two ends of a rigid link move together). The largest of those bounds, each against
 * the largest of its kind (a displacement against the largest displacement, a force against the force scale), is the `share` of the solution: over WEAK of it the answer is solved
 * with a warning that says how many figures stand; over RESOLVE it is refused as 'stiffness-range'. A bound is a worst case: the error really made is far smaller.
 *
 * FORMULA ALPHABET. The strings in `formulas`, `symbolic` and `factor` use only: letters and digits, `_` for a subscript (x_j; the symbols' own subscripts
 * local, global, nodal, equivalent, FE, F, R), `^T` for a transpose, the superscripts ² and ³, `θ`, `σ`, `δ`, `√`, `Σ`, `·`, the true minus `−`, `+`, `/`, `=`,
 * `(`, `)`, `[`, `]`, `|`, `;` (rows of an inline matrix), `,`, `←`, `½`, the space, and no word. The font the site sets in has ¹ ² ³ only, so there
 * is no other raised character: a transpose is `^T`.
 */

/* ── Small helpers ────────────────────────────────────────────────────── */

const isNum = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v) && Math.abs(v) <= LIMIT;
const isSection = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v) && v >= SECTION_LOW && v <= LIMIT;
const isIndex = (v: unknown, n: number): v is number => typeof v === 'number' && Number.isInteger(v) && v >= 0 && v < n;
const given = (v: unknown): boolean => v !== undefined && v !== null;
/** 0 − v: never −0. */
const neg = (v: number): number => 0 - v;
const E = EPSILON_DD;

/** The double nearest to a double-double, never −0. */
const H = (a: DD): number => a[0] + 0;
const hiMat = (m: readonly (readonly DD[])[]): Mat => m.map((r) => r.map(H));
const hiVec = (v: readonly DD[]): number[] => v.map(H);
/** The matrix times the vector. */
const mv = (a: readonly (readonly DD[])[], v: readonly DD[]): DD[] =>
  a.map((row) => {
    let s: DD = DD_ZERO;
    for (let k = 0; k < row.length; k++) if (!ddIsZero(row[k]) && !ddIsZero(v[k])) s = ddAdd(s, ddMul(row[k], v[k]));
    return s;
  });
/** The sizes Σ|a_ij|·|v_j| of the terms of a matrix times a vector. */
const mvSize = (a: readonly (readonly DD[])[], v: readonly number[]): number[] => a.map((row) => row.reduce((s, x, k) => s + Math.abs(x[0]) * v[k], 0));
/** What the arithmetic could have put into each entry of a matrix times a vector: the rounding of the sum of the sizes of its terms, and the errors of the entries of the matrix times the vector. */
const mvFloor = (a: readonly (readonly DD[])[], v: readonly DD[], errA?: readonly (readonly number[])[]): number[] =>
  a.map((row, i) => ASSEMBLY * E * row.reduce((s, x, j) => s + Math.abs(x[0] * v[j][0]), 0) + (errA ? errA[i].reduce((s, e, j) => s + e * Math.abs(v[j][0]), 0) : 0));
/** The entries that are no larger than their floor are exactly 0: they are rounding. */
const zeroUnder = (v: readonly DD[], floor: readonly number[]): DD[] => v.map((x, i) => (!ddIsZero(x) && Math.abs(x[0]) <= floor[i] ? DD_ZERO : x));

/** The DOF numbers of node `label` (from 1): [2n − 1, 2n] or [3n − 2, 3n − 1, 3n]. */
export function dofsOfNode(label: number, mode: Mode): number[] {
  return mode === 'truss' ? [2 * label - 1, 2 * label] : [3 * label - 2, 3 * label - 1, 3 * label];
}

/** The label of a global DOF: '1x', '1y', '1θ'. */
export const dofLabel = (node: number, kind: DofKind): string => `${node}${kind}`;

/* ── The member: stiffness, transformation, fixed-end forces ──────────── */

/**
 * The local stiffness matrix. A bar (truss mode): k = (EA/L)·[[1, −1], [−1, 1]] on [u_i, u_j]. A beam-column (frame mode), on
 * [u_i, v_i, θ_i, u_j, v_j, θ_j]: axial EA/L, bending 12EI/L³, 6EI/L², 4EI/L, 2EI/L.
 */
export function localStiffness(mode: Mode, EA: number, EI: number, L: number): Mat {
  return hiMat(localStiffnessDD(mode, dd(EA), dd(EI), dd(L)));
}

function localStiffnessDD(mode: Mode, EA: DD, EI: DD, L: DD): DD[][] {
  const a = ddDiv(EA, L);
  if (mode === 'truss') {
    return [
      [a, ddNeg(a)],
      [ddNeg(a), a],
    ];
  }
  const L2 = ddMul(L, L);
  const L3 = ddMul(L2, L);
  const b = ddDiv(ddMulD(EI, 12), L3);
  const c = ddDiv(ddMulD(EI, 6), L2);
  const d = ddDiv(ddMulD(EI, 4), L);
  const e = ddDiv(ddMulD(EI, 2), L);
  const k = ddZeros(6);
  k[0][0] = a;
  k[0][3] = ddNeg(a);
  k[3][0] = ddNeg(a);
  k[3][3] = a;
  k[1][1] = b;
  k[1][2] = c;
  k[1][4] = ddNeg(b);
  k[1][5] = c;
  k[2][1] = c;
  k[2][2] = d;
  k[2][4] = ddNeg(c);
  k[2][5] = e;
  k[4][1] = ddNeg(b);
  k[4][2] = ddNeg(c);
  k[4][4] = b;
  k[4][5] = ddNeg(c);
  k[5][1] = c;
  k[5][2] = e;
  k[5][4] = ddNeg(c);
  k[5][5] = d;
  return k;
}

/** The transformation u_local = T·u_global. A bar: the 2 × 4 [[c, s, 0, 0], [0, 0, c, s]]. A beam-column: the 6 × 6 block-diagonal of [[c, s, 0], [−s, c, 0], [0, 0, 1]]. */
export function transformation(mode: Mode, c: number, s: number): Mat {
  return hiMat(transformationDD(mode, dd(c), dd(s)));
}

function transformationDD(mode: Mode, c: DD, s: DD): DD[][] {
  if (mode === 'truss') {
    return [
      [c, s, DD_ZERO, DD_ZERO],
      [DD_ZERO, DD_ZERO, c, s],
    ];
  }
  const T = ddZeros(6);
  for (const o of [0, 3]) {
    T[o][o] = c;
    T[o][o + 1] = s;
    T[o + 1][o] = ddNeg(s);
    T[o + 1][o + 1] = c;
    T[o + 2][o + 2] = DD_ONE;
  }
  return T;
}

type FixedEndLoad = { kind: 'udl'; w: number } | { kind: 'point'; a: number; P: number } | { kind: 'axial'; q: number };

/** The fixed-end forces of one member load: what the clamps exert on the member with both ends held (local axes, [Fx_i, Fy_i, M_i, Fx_j, Fy_j, M_j]). */
export function fixedEndForces(load: FixedEndLoad, L: number): number[] {
  return fixedEndForcesDD(load, dd(L)).map(H);
}

function fixedEndForcesDD(load: FixedEndLoad, L: DD): DD[] {
  switch (load.kind) {
    case 'udl': {
      const wL = ddMulD(L, load.w);
      const half = ddNeg(ddDivD(wL, 2));
      const m12 = ddDivD(ddMul(wL, L), 12);
      return [DD_ZERO, half, ddNeg(m12), DD_ZERO, half, m12];
    }
    case 'point': {
      const a = dd(load.a);
      const b = ddSub(L, a);
      const P = load.P;
      const L2 = ddMul(L, L);
      const L3 = ddMul(L2, L);
      const a2 = ddMul(a, a);
      const b2 = ddMul(b, b);
      const f2 = ddDiv(ddMul(ddMulD(b2, P), ddAdd(ddMulD(a, 3), b)), L3);
      const f3 = ddDiv(ddMul(ddMulD(ddMul(a, b2), P), DD_ONE), L2);
      const f5 = ddDiv(ddMul(ddMulD(a2, P), ddAdd(a, ddMulD(b, 3))), L3);
      const f6 = ddDiv(ddMulD(ddMul(a2, b), P), L2);
      return [DD_ZERO, ddNeg(f2), ddNeg(f3), DD_ZERO, ddNeg(f5), f6];
    }
    default: {
      const half = ddNeg(ddDivD(ddMulD(L, load.q), 2));
      return [half, DD_ZERO, DD_ZERO, half, DD_ZERO, DD_ZERO];
    }
  }
}

/* ── Validation ───────────────────────────────────────────────────────── */

interface Prepared {
  mode: Mode;
  nodes: { x: number; y: number }[];
  members: { i: number; j: number; E?: number | null; A?: number | null; I?: number | null }[];
  supports: StiffnessSupport[];
  loads: StiffnessModel['loads'];
  memberLoads: StiffnessMemberLoad[];
  E?: number | null;
  A?: number | null;
  I?: number | null;
}

function validate(model: StiffnessModel | null | undefined): { issues: Issue[]; p: Prepared | null } {
  const issues: Issue[] = [];
  if (!model || typeof model !== 'object') return { issues: [{ code: 'stopped' }], p: null };
  const mode = model.mode;
  if (mode !== 'truss' && mode !== 'frame') return { issues: [{ code: 'mode' }], p: null };
  const frame = mode === 'frame';
  const nodes = Array.isArray(model.nodes) ? model.nodes : [];
  const members = Array.isArray(model.members) ? model.members : [];
  const supports = Array.isArray(model.supports) ? model.supports : [];
  const loads = Array.isArray(model.loads) ? model.loads : [];
  // The member loads of a truss are not used, whatever they hold.
  const memberLoads = frame && Array.isArray(model.memberLoads) ? model.memberLoads : [];
  if (nodes.length < 2) issues.push({ code: 'few-nodes', count: nodes.length });
  if (members.length === 0) issues.push({ code: 'no-members' });
  const caps: [ListName, number, number][] = [
    ['nodes', nodes.length, MAX_NODES],
    ['members', members.length, MAX_MEMBERS],
    ['supports', supports.length, MAX_SUPPORTS],
    ['loads', loads.length, MAX_LOADS],
    ['memberLoads', memberLoads.length, MAX_MEMBER_LOADS],
  ];
  for (const [list, n, max] of caps) if (n > max) issues.push({ code: 'too-big', list, count: n, max });
  if (issues.length > 0) return { issues, p: null };

  const bad = (list: ListName | 'model', index: number, field: string, code: Issue['code'] = 'number') => issues.push({ code, where: { list, index, field } });
  nodes.forEach((n, k) => {
    if (!n || !isNum(n.x)) bad('nodes', k, 'x');
    if (!n || !isNum(n.y)) bad('nodes', k, 'y');
  });
  const sectionFields = frame ? (['E', 'A', 'I'] as const) : (['E', 'A'] as const);
  for (const f of sectionFields) {
    const v = model[f];
    if (given(v) && !isSection(v)) bad('model', 0, f, 'section');
  }
  members.forEach((m, k) => {
    if (!m || typeof m !== 'object') return bad('members', k, 'i', 'member-node');
    if (!isIndex(m.i, nodes.length)) bad('members', k, 'i', 'member-node');
    if (!isIndex(m.j, nodes.length)) bad('members', k, 'j', 'member-node');
    for (const f of sectionFields) {
      const v = m[f];
      if (given(v) && !isSection(v)) bad('members', k, f, 'section');
    }
  });
  supports.forEach((s, k) => {
    if (!s || typeof s !== 'object') return bad('supports', k, 'node', 'support-node');
    if (!isIndex(s.node, nodes.length)) bad('supports', k, 'node', 'support-node');
    // A settlement is a number only where the support holds the DOF: a value typed on one it does not hold has no effect (the engine says so) and is never a fault,
    // whatever it is, for it is a field the visitor may not be able to see.
    const held = { dx: s.ux, dy: s.uy, dr: s.rz };
    for (const f of frame ? (['dx', 'dy', 'dr'] as const) : (['dx', 'dy'] as const)) if (given(s[f]) && Boolean(held[f]) && !isNum(s[f])) bad('supports', k, f);
  });
  loads.forEach((l, k) => {
    if (!l || typeof l !== 'object') return bad('loads', k, 'node', 'load-node');
    if (!isIndex(l.node, nodes.length)) bad('loads', k, 'node', 'load-node');
    for (const f of frame ? (['fx', 'fy', 'm'] as const) : (['fx', 'fy'] as const)) if (!isNum(l[f])) bad('loads', k, f);
  });
  memberLoads.forEach((l, k) => {
    if (!l || typeof l !== 'object') return bad('memberLoads', k, 'member', 'load-member');
    if (!isIndex(l.member, members.length)) bad('memberLoads', k, 'member', 'load-member');
    const fields: Record<string, string[]> = { udl: ['w'], point: ['a', 'P'], axial: ['q'] };
    const kind = (l as { kind?: unknown }).kind;
    if (typeof kind !== 'string' || !Object.prototype.hasOwnProperty.call(fields, kind)) return bad('memberLoads', k, 'kind', 'load-kind');
    for (const f of fields[kind]) if (!isNum((l as unknown as Record<string, unknown>)[f])) bad('memberLoads', k, f);
  });
  if (issues.length > 0) return { issues, p: null };
  return { issues, p: { mode, nodes, members, supports, loads, memberLoads, E: model.E, A: model.A, I: model.I } };
}

/* ── Elimination ──────────────────────────────────────────────────────── */

interface Stuck {
  /** The position (0-based, among the free DOFs) of the pivot that rounding cannot tell from zero. */
  at: number;
  /** Its value, and the largest error the arithmetic could have put in it. */
  pivot: number;
  rounding: number;
  /** The augmented matrix at that moment (the rows above `at` are final). */
  rows: DD[][];
}

interface Eliminated {
  /** Set when a pivot is zero for the arithmetic. */
  stuck: Stuck | null;
  /** Set when a number stopped being finite. */
  overflow: boolean;
  u: DD[];
  /** The multipliers of the forward elimination: l_ik under the diagonal, 0 elsewhere. */
  lower: DD[][];
  /** The augmented matrix after the last forward pass (upper triangular). */
  aug: DD[][];
}

/**
 * Gaussian elimination without row exchanges on the augmented matrix [A | b], calling `pass` after each forward pass. It carries beside every entry the largest error the arithmetic could have put in it (`errA`, `errB` are the errors of the
 * matrix and of the right-hand side as given): the entry's own rounding, the errors of the entries it is made of, and the error of the multiplier
 * that scales them. A pivot whose error reaches RESOLVE of it (or that is not above zero) is zero for the arithmetic: the elimination stops
 * there. An entry no larger than its own error is exactly 0 (it cannot be told from rounding): the narrated elimination prints the numbers it computed.
 */
function eliminate(
  A: readonly (readonly DD[])[],
  b: readonly DD[],
  errA: readonly (readonly number[])[],
  errB: readonly number[],
  hooks: {
    pass?: (k: number, pivot: DD, multipliers: DD[], aug: DD[][], changed: [number, number][], eliminated: number[]) => void;
  },
): Eliminated {
  const n = b.length;
  const aug: DD[][] = A.map((row, i) => [...row, b[i]]);
  const err: number[][] = errA.map((row, i) => [...row, errB[i]]);
  const lower: DD[][] = ddZeros(n);
  const fail = (stuck: Stuck | null, overflow: boolean): Eliminated => ({ stuck, overflow, u: [], lower: [], aug: [] });
  for (let k = 0; k < n; k++) {
    const pivot = aug[k][k];
    const p = pivot[0];
    const e = err[k][k];
    if (!Number.isFinite(p) || !Number.isFinite(e)) return fail(null, true);
    if (!(p > 0) || !(p * RESOLVE > e)) return fail({ at: k, pivot: p, rounding: e, rows: aug.map((r) => r.slice()) }, false);
    if (k === n - 1) break;
    const multipliers: DD[] = [];
    const changed: [number, number][] = [];
    const eliminated: number[] = [];
    for (let i = k + 1; i < n; i++) {
      const l = ddDiv(aug[i][k], pivot);
      const la = Math.abs(l[0]);
      lower[i][k] = l;
      // the error of the multiplier: that of its numerator, that of the pivot (scaled by the multiplier itself), and its own rounding
      const el = (err[i][k] + la * e) / p + E * la;
      multipliers.push(l);
      if (la !== 0) eliminated.push(i);
      for (let j = k + 1; j <= n; j++) {
        const akj = aug[k][j];
        const before = aug[i][j];
        let v = before;
        err[i][j] += la * err[k][j] + Math.abs(akj[0]) * el;
        if (la !== 0 && !ddIsZero(akj)) {
          const product = ddMul(l, akj);
          v = ddSub(before, product);
          err[i][j] += E * (Math.abs(product[0]) + Math.abs(v[0]));
        }
        if (!ddIsZero(v) && Math.abs(v[0]) <= err[i][j]) v = DD_ZERO;
        if (v[0] !== before[0] || v[1] !== before[1]) changed.push([i, j]);
        aug[i][j] = v;
      }
      aug[i][k] = DD_ZERO;
    }
    hooks.pass?.(k, pivot, multipliers, aug, changed, eliminated);
  }
  const u: DD[] = new Array<DD>(n).fill(DD_ZERO);
  for (let k = n - 1; k >= 0; k--) {
    let s = aug[k][n];
    for (let j = k + 1; j < n; j++) if (!ddIsZero(aug[k][j]) && !ddIsZero(u[j])) s = ddSub(s, ddMul(aug[k][j], u[j]));
    u[k] = ddDiv(s, aug[k][k]);
  }
  if (!u.every((x) => Number.isFinite(x[0]))) return fail(null, true);
  return { stuck: null, overflow: false, u, lower, aug };
}

/** The inverse of the matrix that was eliminated: each column solved from the multipliers and the triangle. */
function inverseOf(lower: readonly (readonly DD[])[], upper: readonly (readonly DD[])[], n: number): DD[][] {
  const X = ddZeros(n);
  for (let c = 0; c < n; c++) {
    const y: DD[] = new Array<DD>(n).fill(DD_ZERO);
    y[c] = DD_ONE;
    for (let k = c; k < n; k++) {
      if (ddIsZero(y[k])) continue;
      for (let i = k + 1; i < n; i++) if (!ddIsZero(lower[i][k])) y[i] = ddSub(y[i], ddMul(lower[i][k], y[k]));
    }
    const x: DD[] = new Array<DD>(n).fill(DD_ZERO);
    for (let k = n - 1; k >= 0; k--) {
      let s = y[k];
      for (let j = k + 1; j < n; j++) if (!ddIsZero(upper[k][j]) && !ddIsZero(x[j])) s = ddSub(s, ddMul(upper[k][j], x[j]));
      x[k] = ddDiv(s, upper[k][k]);
    }
    for (let i = 0; i < n; i++) X[i][c] = x[i];
  }
  return X;
}

/**
 * The independent motions of a symmetric positive semi-definite matrix, as far as the arithmetic can tell: an elimination that takes the largest remaining
 * diagonal as its pivot each time, stopped when the largest left is no larger than its own rounding (RESOLVE). What is left over is the null space; a basis of it
 * (one vector per unresolved column, the resolved rows solved for) is returned in the order of the unknowns.
 */
function nullSpace(A: readonly (readonly DD[])[], errA: readonly (readonly number[])[]): { nullity: number; basis: DD[][] } {
  const n = A.length;
  const a: DD[][] = A.map((r) => r.slice());
  const err: number[][] = errA.map((r) => r.slice());
  const perm = Array.from({ length: n }, (_, i) => i);
  let k = 0;
  for (; k < n; k++) {
    let best = k;
    for (let i = k + 1; i < n; i++) if (a[i][i][0] > a[best][best][0]) best = i;
    const p = a[best][best][0];
    const e = err[best][best];
    if (!(p > 0) || !(p * RESOLVE > e)) break;
    if (best !== k) {
      [a[k], a[best]] = [a[best], a[k]];
      [err[k], err[best]] = [err[best], err[k]];
      for (let i = 0; i < n; i++) {
        [a[i][k], a[i][best]] = [a[i][best], a[i][k]];
        [err[i][k], err[i][best]] = [err[i][best], err[i][k]];
      }
      [perm[k], perm[best]] = [perm[best], perm[k]];
    }
    const pivot = a[k][k];
    for (let i = k + 1; i < n; i++) {
      const l = ddDiv(a[i][k], pivot);
      const la = Math.abs(l[0]);
      const el = (err[i][k] + la * e) / p + E * la;
      for (let j = k + 1; j < n; j++) {
        const akj = a[k][j];
        const before = a[i][j];
        let v = before;
        err[i][j] += la * err[k][j] + Math.abs(akj[0]) * el;
        if (la !== 0 && !ddIsZero(akj)) {
          const product = ddMul(l, akj);
          v = ddSub(before, product);
          err[i][j] += E * (Math.abs(product[0]) + Math.abs(v[0]));
        }
        if (!ddIsZero(v) && Math.abs(v[0]) <= err[i][j]) v = DD_ZERO;
        a[i][j] = v;
      }
      a[i][k] = DD_ZERO;
    }
  }
  const basis: DD[][] = [];
  for (let c = k; c < n; c++) {
    const v: DD[] = new Array<DD>(n).fill(DD_ZERO);
    v[c] = DD_ONE;
    for (let i = k - 1; i >= 0; i--) {
      let s: DD = DD_ZERO;
      for (let j = i + 1; j < k; j++) s = ddAdd(s, ddMul(a[i][j], v[j]));
      s = ddAdd(s, a[i][c]);
      v[i] = ddNeg(ddDiv(s, a[i][i]));
    }
    const original: DD[] = new Array<DD>(n).fill(DD_ZERO);
    v.forEach((x, idx) => {
      original[perm[idx]] = x;
    });
    basis.push(original);
  }
  return { nullity: n - k, basis };
}

/* ── The run ──────────────────────────────────────────────────────────── */

/**
 * The criterion of 'ill-conditioned', in one place: the answer is refused when the largest residual of the solved equations, against the size of its own
 * equation, is above RESIDUAL (`worstRatio`), or when any check of step 14 fails: a sum of loads and reactions, a joint, the energy identity or the
 * residual of K u = P + R above RESIDUAL of its scale (and its rounding allowance). Returns the issue, with the largest relative departure, or null.
 */
export function illConditioned(worstRatio: number, checks: readonly Check[]): Issue | null {
  const failed = checks.filter((c) => !c.ok);
  if (worstRatio <= RESIDUAL && failed.length === 0) return null;
  const worst = Math.max(Number.isFinite(worstRatio) ? worstRatio : 1, ...failed.map((c) => (c.scale > 0 && Number.isFinite(c.value) ? Math.abs(c.value) / c.scale : 1)));
  return { code: 'ill-conditioned', residual: worst, limit: RESIDUAL };
}

export function solve(model: StiffnessModel): Outcome {
  try {
    return run(model);
  } catch {
    return { ok: false, issues: [{ code: 'stopped' }], steps: [] };
  }
}

/** The leading steps whose numbers are all finite: a partial solution never carries a NaN or an Infinity. */
function finiteSteps(steps: readonly Step[]): Step[] {
  const out: Step[] = [];
  for (const s of steps) {
    const whole = s.blocks.every((b) => blockFinite(b)) && Object.values(s.facts).every((f) => typeof f !== 'number' || Number.isFinite(f));
    if (!whole) break;
    out.push(s);
  }
  return out;
}

const fail = (issues: Issue[], steps: Step[] = []): Failure => ({ ok: false, issues, steps: finiteSteps(steps) });

function run(model: StiffnessModel): Outcome {
  const { issues, p } = validate(model);
  if (!p) return fail(issues);
  const mode = p.mode;
  const frame = mode === 'frame';
  const nd = frame ? 3 : 2;
  const { nodes, members, supports } = p;
  const nn = nodes.length;
  const N = nd * nn;
  const kinds: DofKind[] = frame ? ['x', 'y', 'θ'] : ['x', 'y'];

  /* Geometry of the structure. */
  let x0 = Infinity;
  let x1 = -Infinity;
  let y0 = Infinity;
  let y1 = -Infinity;
  for (const q of nodes) {
    x0 = Math.min(x0, q.x);
    x1 = Math.max(x1, q.x);
    y0 = Math.min(y0, q.y);
    y1 = Math.max(y1, q.y);
  }
  const extent = Math.hypot(x1 - x0, y1 - y0);
  const about = { x: (x0 + x1) / 2, y: (y0 + y1) / 2 };
  // (the name `size` is the extent in the rest of this function: the checks, the drawing and the sentences all call it so)
  const sz = extent;

  /* The faults that are not about the numbers: collected together. */
  const found: Issue[] = [];
  // Nodes at one place: groups, by union–find over the pairs that are closer than NEAR of the size.
  {
    const parent = nodes.map((_, i) => i);
    const root = (a: number): number => {
      while (parent[a] !== a) {
        parent[a] = parent[parent[a]];
        a = parent[a];
      }
      return a;
    };
    for (let a = 0; a < nn; a++) for (let b = a + 1; b < nn; b++) if (Math.hypot(nodes[a].x - nodes[b].x, nodes[a].y - nodes[b].y) <= NEAR * sz) parent[root(a)] = root(b);
    const groups = new Map<number, number[]>();
    for (let k = 0; k < nn; k++) groups.set(root(k), [...(groups.get(root(k)) ?? []), k]);
    for (const g of groups.values()) {
      if (g.length < 2) continue;
      let distance = 0;
      for (const a of g) for (const b of g) distance = Math.max(distance, Math.hypot(nodes[a].x - nodes[b].x, nodes[a].y - nodes[b].y));
      found.push({ code: 'duplicate-node', nodes: g.map((k) => k + 1), distance, size: sz });
    }
  }
  const lengths: number[] = [];
  const pair = new Map<string, number>();
  members.forEach((m, k) => {
    const a = nodes[m.i];
    const b = nodes[m.j];
    const L = Math.hypot(b.x - a.x, b.y - a.y);
    lengths.push(L);
    if (m.i === m.j) found.push({ code: 'zero-length', where: { list: 'members', index: k }, members: [k + 1] });
    else if (L > NEAR * sz && L < SHORT * sz) found.push({ code: 'short-member', where: { list: 'members', index: k }, members: [k + 1], length: L, size: sz });
    const key = m.i < m.j ? `${m.i}-${m.j}` : `${m.j}-${m.i}`;
    const first = pair.get(key);
    if (first !== undefined) found.push({ code: 'duplicate-member', where: { list: 'members', index: k }, members: [first + 1, k + 1] });
    else pair.set(key, k);
  });
  const degree = new Array<number>(nn).fill(0);
  for (const m of members) {
    degree[m.i]++;
    degree[m.j]++;
  }
  degree.forEach((d, k) => {
    if (d === 0) found.push({ code: 'node-unconnected', nodes: [k + 1] });
  });
  {
    const parent = nodes.map((_, i) => i);
    const root = (a: number): number => {
      while (parent[a] !== a) {
        parent[a] = parent[parent[a]];
        a = parent[a];
      }
      return a;
    };
    for (const m of members) parent[root(m.i)] = root(m.j);
    const groups = new Map<number, number[]>();
    for (let k = 0; k < nn; k++) if (degree[k] > 0) groups.set(root(k), [...(groups.get(root(k)) ?? []), k + 1]);
    if (groups.size > 1) found.push({ code: 'disconnected', groups: [...groups.values()].sort((a, b) => a[0] - b[0]) });
  }
  const supportAt = new Map<number, number>();
  supports.forEach((s, k) => {
    if (supportAt.has(s.node)) found.push({ code: 'duplicate-support', where: { list: 'supports', index: k }, nodes: [s.node + 1] });
    else supportAt.set(s.node, k);
  });
  p.memberLoads.forEach((l, k) => {
    if (l.kind !== 'point') return;
    const L = lengths[l.member];
    if (!(L > 0)) return;
    if (!(l.a > 0 && l.a < L)) found.push({ code: 'load-position', where: { list: 'memberLoads', index: k, field: 'a' }, length: L });
  });
  // Sections: each member needs E and A (and I in frame mode), its own or the model's.
  const effective = (own: number | null | undefined, fallback: number | null | undefined): number | null => (given(own) ? (own as number) : given(fallback) ? (fallback as number) : null);
  const sections = members.map((m) => ({ E: effective(m.E, p.E), A: effective(m.A, p.A), I: frame ? effective(m.I, p.I) : null }));
  sections.forEach((sec, k) => {
    for (const f of frame ? (['E', 'A', 'I'] as const) : (['E', 'A'] as const)) {
      if (sec[f] === null) found.push({ code: 'section-missing', where: { list: 'members', index: k, field: f }, members: [k + 1] });
    }
  });
  if (found.length > 0) return fail(found);

  /* The degrees of freedom and the restraints. */
  const dofs: Dof[] = [];
  const restrainedFlag = new Array<boolean>(N).fill(false);
  const prescribed = new Array<number>(N).fill(0);
  const warnings: Warning[] = [];
  const ignoredSettlement: number[] = [];
  const emptySupports: number[] = [];
  supports.forEach((s) => {
    const flags = frame ? [Boolean(s.ux), Boolean(s.uy), Boolean(s.rz)] : [Boolean(s.ux), Boolean(s.uy)];
    const values = frame ? [s.dx ?? 0, s.dy ?? 0, s.dr ?? 0] : [s.dx ?? 0, s.dy ?? 0];
    if (!flags.some(Boolean)) emptySupports.push(s.node + 1);
    flags.forEach((on, c) => {
      const d = nd * s.node + c;
      if (on) {
        restrainedFlag[d] = true;
        prescribed[d] = values[c] + 0;
      } else if (values[c] !== 0) ignoredSettlement.push(d + 1);
    });
  });
  const free: number[] = [];
  const restrained: number[] = [];
  for (let d = 0; d < N; d++) {
    const node = Math.floor(d / nd) + 1;
    const kind = kinds[d % nd];
    const isRestrained = restrainedFlag[d];
    if (isRestrained) restrained.push(d + 1);
    else free.push(d + 1);
    dofs.push({ number: d + 1, node, kind, label: dofLabel(node, kind), restrained: isRestrained, prescribed: isRestrained ? prescribed[d] : 0, free: isRestrained ? null : free.length });
  }
  if (restrained.length < 3) return fail([{ code: 'few-supports', count: restrained.length }]);
  const nF = free.length;
  const nR = restrained.length;
  const dofLabels = dofs.map((d) => d.label);
  const freeLabels = free.map((d) => dofLabels[d - 1]);
  const restrainedLabels = restrained.map((d) => dofLabels[d - 1]);

  /* The steps. */
  const steps: Step[] = [];
  const add = (id: StepId, number: number, sub: number | null, scope: StepScope, from: string[], facts: Step['facts'], formulas: string[], blocks: Block[]): string => {
    const key = sub === null ? id : `${id}#${sub}`;
    steps.push({ id, key, number, sub, scope, from, facts, formulas, blocks });
    return key;
  };
  const mat = (name: string, rowLabels: string[], colLabels: string[], values: Mat, extra: Partial<MatrixBlock> = {}): MatrixBlock => ({ type: 'matrix', name, rowLabels, colLabels, values, ...extra });
  const vec = (name: string, labels: string[], values: number[], extra: Partial<VectorBlock> = {}): VectorBlock => ({ type: 'vector', name, labels, values, ...extra });
  const sca = (name: string, value: number, symbolic?: string, tag?: string): ScalarBlock => ({ type: 'scalar', name, value, ...(symbolic !== undefined ? { symbolic } : {}), ...(tag !== undefined ? { tag } : {}) });

  const nodeLabels = nodes.map((_, k) => String(k + 1));
  const memberLabels = members.map((_, k) => String(k + 1));
  const kindLabels = kinds.map((k) => k);

  /* 1 — the structure and the numbering of its degrees of freedom. */
  add(
    'structure',
    1,
    null,
    { kind: 'structure' },
    [],
    { mode, nodes: nn, members: members.length, dofsPerNode: nd, dofs: N, free: nF, restrained: nR, loadedMembers: new Set(p.memberLoads.map((l) => l.member)).size },
    frame ? ['DOF(n, x) = 3n − 2', 'DOF(n, y) = 3n − 1', 'DOF(n, θ) = 3n'] : ['DOF(n, x) = 2n − 1', 'DOF(n, y) = 2n'],
    [
      mat('coordinates', nodeLabels, ['x', 'y'], nodes.map((q) => [q.x, q.y])),
      mat('connectivity', memberLabels, ['i', 'j'], members.map((m) => [m.i + 1, m.j + 1])),
      mat('sections', memberLabels, frame ? ['E', 'A', 'I'] : ['E', 'A'], sections.map((sec) => (frame ? [sec.E as number, sec.A as number, sec.I as number] : [sec.E as number, sec.A as number]))),
      mat('dof-numbers', nodeLabels, kindLabels, nodes.map((_, k) => kinds.map((__, c) => nd * k + c + 1))),
      mat('restraints', nodeLabels, kindLabels, nodes.map((_, k) => kinds.map((__, c) => (restrainedFlag[nd * k + c] ? 1 : 0)))),
      vec('prescribed', dofLabels, dofs.map((d) => d.prescribed), {
        highlights: dofs.flatMap((d, k) => (d.restrained ? [{ index: k, reason: d.prescribed !== 0 ? ('prescribed' as const) : ('restrained' as const) }] : [])),
      }),
    ],
  );

  /* 2–5 — each member: geometry, local stiffness, transformation, global matrix. */
  const solvedMembers: SolvedMember[] = [];
  // Per member, in double-double: the length and the direction, the rigidities, k, T, and K_e with the largest error its arithmetic could have put in each entry.
  const LD: DD[] = [];
  const cD: DD[] = [];
  const sD: DD[] = [];
  const dxD: DD[] = [];
  const dyD: DD[] = [];
  const EAD: DD[] = [];
  const EID: DD[] = [];
  const kD: DD[][][] = [];
  const TD: DD[][][] = [];
  const KeD: DD[][][] = [];
  const KeErr: number[][][] = [];
  members.forEach((m, k) => {
    const a = nodes[m.i];
    const b = nodes[m.j];
    // (the differences of coordinates are exact, and so a coordinate typed as −0 is a plain zero)
    const dx = sum2(b.x, 0 - a.x);
    const dy = sum2(b.y, 0 - a.y);
    const L = ddIsZero(dy) ? ddAbs(dx) : ddIsZero(dx) ? ddAbs(dy) : ddSqrt(ddAdd(ddMul(dx, dx), ddMul(dy, dy)));
    const c = ddIsZero(dx) ? DD_ZERO : ddIsZero(dy) ? (dx[0] > 0 ? DD_ONE : dd(-1)) : ddDiv(dx, L);
    const s = ddIsZero(dy) ? DD_ZERO : ddIsZero(dx) ? (dy[0] > 0 ? DD_ONE : dd(-1)) : ddDiv(dy, L);
    dxD.push(dx);
    dyD.push(dy);
    LD.push(L);
    cD.push(c);
    sD.push(s);
    let angle = (Math.atan2(H(dy), H(dx)) * 180) / Math.PI;
    if (H(c) === 0 || H(s) === 0) angle = H(c) === 0 ? (H(s) > 0 ? 90 : -90) : H(c) > 0 ? 0 : 180;
    const sec = sections[k];
    const code = [...dofsOfNode(m.i + 1, mode), ...dofsOfNode(m.j + 1, mode)];
    EAD.push(prod2(sec.E as number, sec.A as number));
    EID.push(frame ? prod2(sec.E as number, sec.I as number) : DD_ZERO);
    solvedMembers.push({
      label: k + 1,
      i: m.i + 1,
      j: m.j + 1,
      length: H(L),
      c: H(c),
      s: H(s),
      angle,
      E: sec.E as number,
      A: sec.A as number,
      I: sec.I,
      code,
      codeLabels: code.map((d) => dofLabels[d - 1]),
      localLabels: frame ? [`u${m.i + 1}`, `v${m.i + 1}`, `θ${m.i + 1}`, `u${m.j + 1}`, `v${m.j + 1}`, `θ${m.j + 1}`] : [`u${m.i + 1}`, `u${m.j + 1}`],
    });
  });
  const scope = (k: number): StepScope => ({ kind: 'member', member: k + 1 });
  const geometryKey = (k: number) => `geometry#${k + 1}`;
  solvedMembers.forEach((sm, k) => {
    add(
      'geometry',
      2,
      k + 1,
      scope(k),
      ['structure'],
      { member: k + 1, i: sm.i, j: sm.j },
      ['dx = x_j − x_i', 'dy = y_j − y_i', 'L = √(dx² + dy²)', 'c = cosθ = dx/L', 's = sinθ = dy/L', 'c² + s² = 1'],
      [
        sca('dx', H(dxD[k]), 'x_j − x_i'),
        sca('dy', H(dyD[k]), 'y_j − y_i'),
        sca('L', sm.length, '√(dx² + dy²)'),
        sca('c', sm.c, 'dx/L'),
        sca('s', sm.s, 'dy/L'),
        sca('θ', sm.angle),
        sca('E', sm.E),
        sca('A', sm.A),
        ...(frame ? [sca('I', sm.I as number)] : []),
        sca('EA', H(EAD[k]), 'E·A'),
        ...(frame ? [sca('EI', H(EID[k]), 'E·I')] : []),
      ],
    );
  });
  solvedMembers.forEach((sm, k) => {
    const L = LD[k];
    const kk = localStiffnessDD(mode, EAD[k], EID[k], L);
    kD.push(kk);
    const sym = frame
      ? [
          ['EA/L', '0', '0', '−EA/L', '0', '0'],
          ['0', '12EI/L³', '6EI/L²', '0', '−12EI/L³', '6EI/L²'],
          ['0', '6EI/L²', '4EI/L', '0', '−6EI/L²', '2EI/L'],
          ['−EA/L', '0', '0', 'EA/L', '0', '0'],
          ['0', '−12EI/L³', '−6EI/L²', '0', '12EI/L³', '−6EI/L²'],
          ['0', '6EI/L²', '2EI/L', '0', '−6EI/L²', '4EI/L'],
        ]
      : [
          ['EA/L', '−EA/L'],
          ['−EA/L', 'EA/L'],
        ];
    const highlights: Highlight[] = [];
    kk.forEach((row, r) =>
      row.forEach((_v, q) => {
        if (sym[r][q] === '0') return;
        highlights.push({ row: r, col: q, reason: sym[r][q].includes('EI') ? 'bending' : 'axial' });
      }),
    );
    const L2 = ddMul(L, L);
    const L3 = ddMul(L2, L);
    add(
      'local-stiffness',
      3,
      k + 1,
      scope(k),
      [geometryKey(k)],
      { member: k + 1, size: kk.length },
      frame ? ['EA/L', '12EI/L³', '6EI/L²', '4EI/L', '2EI/L', 'k·u_local = f_local'] : ['k = (EA/L)·[1 −1; −1 1]', 'k·u_local = f_local'],
      [
        mat('k', sm.localLabels, sm.localLabels, hiMat(kk), { symbolic: sym, highlights }),
        sca('EA/L', H(ddDiv(EAD[k], L)), 'EA/L'),
        ...(frame
          ? [
              sca('12EI/L³', H(ddDiv(ddMulD(EID[k], 12), L3)), '12EI/L³'),
              sca('6EI/L²', H(ddDiv(ddMulD(EID[k], 6), L2)), '6EI/L²'),
              sca('4EI/L', H(ddDiv(ddMulD(EID[k], 4), L)), '4EI/L'),
              sca('2EI/L', H(ddDiv(ddMulD(EID[k], 2), L)), '2EI/L'),
            ]
          : []),
      ],
    );
  });
  solvedMembers.forEach((sm, k) => {
    const T = transformationDD(mode, cD[k], sD[k]);
    TD.push(T);
    const symT = frame
      ? [
          ['c', 's', '0', '0', '0', '0'],
          ['−s', 'c', '0', '0', '0', '0'],
          ['0', '0', '1', '0', '0', '0'],
          ['0', '0', '0', 'c', 's', '0'],
          ['0', '0', '0', '−s', 'c', '0'],
          ['0', '0', '0', '0', '0', '1'],
        ]
      : [
          ['c', 's', '0', '0'],
          ['0', '0', 'c', 's'],
        ];
    add(
      'transformation',
      4,
      k + 1,
      scope(k),
      [geometryKey(k)],
      { member: k + 1 },
      ['u_local = T·u_global', 'f_global = T^T·f_local', 'c = cosθ', 's = sinθ'],
      [mat('T', sm.localLabels, sm.codeLabels, hiMat(T), { symbolic: symT }), sca('c', sm.c), sca('s', sm.s)],
    );
  });
  // An entry of a product that is no larger than the rounding of the terms that made it is exactly 0.
  const settleEntries = (m: DD[][], terms: number[][]): DD[][] => m.map((row, r) => row.map((v, q) => (!ddIsZero(v) && Math.abs(v[0]) <= ASSEMBLY * E * terms[r][q] ? DD_ZERO : v)));
  solvedMembers.forEach((sm, k) => {
    const T = TD[k];
    const kk = kD[k];
    const TT = ddTranspose(T);
    const kTraw = ddMatMul(kk, T);
    const kT = settleEntries(kTraw, ddMatMulSize(kk, T));
    const KeTerms = ddMatMulSize(TT, kT);
    const Ke = settleEntries(ddMatMul(TT, kT), KeTerms);
    KeD.push(Ke);
    // The largest error the arithmetic could have put in each entry of K_e: ASSEMBLY roundings of the sum of the sizes of the terms that made it.
    KeErr.push(KeTerms.map((r) => r.map((v) => ASSEMBLY * E * v)));
    const blocks: Block[] = [
      mat('kT', sm.localLabels, sm.codeLabels, hiMat(kT)),
      mat('K_e', sm.codeLabels, sm.codeLabels, hiMat(Ke)),
      vec('code', sm.codeLabels, sm.code),
    ];
    const facts: Step['facts'] = { member: k + 1 };
    const formulas = ['K_e = T^T·k·T', 'code = [DOF(i), DOF(j)]'];
    if (!frame) {
      const f = ddDiv(EAD[k], LD[k]);
      const c = cD[k];
      const s = sD[k];
      const cc = ddMul(f, ddMul(c, c));
      const cs = ddMul(f, ddMul(c, s));
      const ss = ddMul(f, ddMul(s, s));
      const closed = [
        [cc, cs, ddNeg(cc), ddNeg(cs)],
        [cs, ss, ddNeg(cs), ddNeg(ss)],
        [ddNeg(cc), ddNeg(cs), cc, cs],
        [ddNeg(cs), ddNeg(ss), cs, ss],
      ];
      let diff = 0;
      let top = 0;
      closed.forEach((row, r) =>
        row.forEach((v, q) => {
          diff = Math.max(diff, Math.abs(H(ddSub(v, Ke[r][q]))));
          top = Math.max(top, Math.abs(v[0]));
        }),
      );
      facts.difference = diff;
      facts.agree = diff <= AGREE * top;
      formulas.push('K_e = (EA/L)·[c² cs −c² −cs; cs s² −cs −s²; −c² −cs c² cs; −cs −s² cs s²]');
      blocks.push(
        mat('K_e_closed', sm.codeLabels, sm.codeLabels, hiMat(closed), {
          symbolic: [
            ['c²', 'cs', '−c²', '−cs'],
            ['cs', 's²', '−cs', '−s²'],
            ['−c²', '−cs', 'c²', 'cs'],
            ['−cs', '−s²', 'cs', 's²'],
          ],
          factor: 'EA/L',
          factorValue: H(f),
        }),
      );
    }
    add('global-member', 5, k + 1, scope(k), [`local-stiffness#${k + 1}`, `transformation#${k + 1}`], facts, formulas, blocks);
  });

  /* 6 — the assembly, member by member. */
  const KD: DD[][] = ddZeros(N);
  // With K, the largest error the arithmetic could have put in each entry. An entry no larger than its error is exactly 0 in K: a sum of terms that
  // cancel (c·s of two members) leaves rounding, and rounding is not a stiffness. What is printed is what the elimination is given.
  const errK: number[][] = Array.from({ length: N }, () => new Array<number>(N).fill(0));
  const contributors: number[][][] = Array.from({ length: N }, () => Array.from({ length: N }, () => [] as number[]));
  solvedMembers.forEach((sm, k) => {
    const Ke = KeD[k];
    const contribution: Mat = Array.from({ length: N }, () => new Array<number>(N).fill(0));
    const positions: Highlight[] = [];
    sm.code.forEach((da, pa) =>
      sm.code.forEach((db, pb) => {
        contribution[da - 1][db - 1] = H(Ke[pa][pb]);
        const sum = ddAdd(KD[da - 1][db - 1], Ke[pa][pb]);
        errK[da - 1][db - 1] += KeErr[k][pa][pb] + E * Math.abs(sum[0]);
        KD[da - 1][db - 1] = Math.abs(sum[0]) <= errK[da - 1][db - 1] ? DD_ZERO : sum;
        contributors[da - 1][db - 1].push(k + 1);
        positions.push({ row: da - 1, col: db - 1, reason: 'position' });
      }),
    );
    const running = hiMat(KD);
    // The running K marks every cell that the members added so far have written into, with who they are (the cells of this member alone are marked on its contribution).
    const written: Highlight[] = [];
    for (let a = 0; a < N; a++)
      for (let b = 0; b < N; b++) {
        const who = contributors[a][b].filter((mm) => mm <= k + 1);
        if (who.length > 0) written.push({ row: a, col: b, reason: 'contributed', members: who });
      }
    add(
      'assembly',
      6,
      k + 1,
      scope(k),
      [`global-member#${k + 1}`, k === 0 ? 'structure' : `assembly#${k}`],
      { member: k + 1, cells: positions.length },
      ['K ← K + K_e'],
      [mat('contribution', dofLabels, dofLabels, contribution, { highlights: positions }), mat('running', dofLabels, dofLabels, running, { highlights: written })],
    );
  });
  const K = hiMat(KD);
  if (!K.every((row) => row.every(Number.isFinite))) return fail([{ code: 'size' }], steps);
  let asymmetry = 0;
  let kMax = 0;
  for (let a = 0; a < N; a++)
    for (let b = 0; b < N; b++) {
      asymmetry = Math.max(asymmetry, Math.abs(H(ddSub(KD[a][b], KD[b][a]))));
      kMax = Math.max(kMax, Math.abs(K[a][b]));
    }
  const finalHighlights: Highlight[] = [];
  for (let a = 0; a < N; a++)
    for (let b = 0; b < N; b++) {
      const who = contributors[a][b];
      if (who.length > 0) finalHighlights.push({ row: a, col: b, reason: who.length > 1 ? 'shared' : 'contributed', members: who.slice() });
    }
  add('assembled', 6, null, { kind: 'structure' }, members.map((_, k) => `assembly#${k + 1}`), { dofs: N, symmetric: asymmetry <= AGREE * kMax, asymmetry }, ['K = Σ K_e', 'K = K^T'], [mat('K', dofLabels, dofLabels, K, { highlights: finalHighlights })]);

  /* 7 — the load vector. */
  const Pnodal: DD[] = new Array<DD>(N).fill(DD_ZERO);
  // The largest error the arithmetic could have put in each entry of P (the rounding of the sums of the loads, and of the equivalent loads).
  const errP = new Array<number>(N).fill(0);
  for (const l of p.loads) {
    Pnodal[nd * l.node] = ddAddD(Pnodal[nd * l.node], l.fx);
    Pnodal[nd * l.node + 1] = ddAddD(Pnodal[nd * l.node + 1], l.fy);
    errP[nd * l.node] += E * Math.abs(l.fx);
    errP[nd * l.node + 1] += E * Math.abs(l.fy);
    if (frame) {
      Pnodal[nd * l.node + 2] = ddAddD(Pnodal[nd * l.node + 2], l.m);
      errP[nd * l.node + 2] += E * Math.abs(l.m);
    }
  }
  add('nodal-loads', 7, null, { kind: 'structure' }, ['structure'], { loads: p.loads.length }, ['P_nodal(d) = ΣF(d)'], [vec('P_nodal', dofLabels, hiVec(Pnodal))]);

  const Pequiv: DD[] = new Array<DD>(N).fill(DD_ZERO);
  const errEquiv = new Array<number>(N).fill(0);
  const fixedEnd: (DD[] | null)[] = members.map(() => null);
  if (frame) {
    members.forEach((_, k) => {
      const mine = p.memberLoads.map((l, idx) => ({ l, idx })).filter(({ l }) => l.member === k);
      if (mine.length === 0) return;
      const sm = solvedMembers[k];
      const L = LD[k];
      const blocks: Block[] = [sca('L', sm.length)];
      const formulas: string[] = [];
      let total: DD[] = new Array<DD>(6).fill(DD_ZERO);
      for (const { l, idx } of mine) {
        const tag = `${l.kind}#${idx + 1}`;
        let fe: DD[];
        let sym: string[];
        if (l.kind === 'udl') {
          fe = fixedEndForcesDD({ kind: 'udl', w: l.w }, L);
          sym = ['0', '−wL/2', '−wL²/12', '0', '−wL/2', 'wL²/12'];
          formulas.push('wL/2', 'wL²/12');
          blocks.push(sca('w', l.w, undefined, tag));
        } else if (l.kind === 'point') {
          fe = fixedEndForcesDD({ kind: 'point', a: l.a, P: l.P }, L);
          sym = ['0', '−Pb²(3a+b)/L³', '−Pab²/L²', '0', '−Pa²(a+3b)/L³', 'Pa²b/L²'];
          formulas.push('b = L − a', 'Pb²(3a+b)/L³', 'Pab²/L²', 'Pa²(a+3b)/L³', 'Pa²b/L²');
          blocks.push(sca('P', l.P, undefined, tag), sca('a', l.a, undefined, tag), sca('b', H(ddSub(L, dd(l.a))), 'L − a', tag));
        } else {
          fe = fixedEndForcesDD({ kind: 'axial', q: l.q }, L);
          sym = ['−qL/2', '0', '0', '−qL/2', '0', '0'];
          formulas.push('qL/2');
          blocks.push(sca('q', l.q, undefined, tag));
        }
        blocks.push(vec('f_FE', sm.localLabels, hiVec(fe), { symbolic: sym, tag }));
        total = total.map((v, q) => ddAdd(v, fe[q]));
      }
      fixedEnd[k] = total;
      const T = TD[k];
      const TT = ddTranspose(T);
      const global = zeroUnder(mv(TT, total), mvFloor(TT, total));
      const equivalent = global.map(ddNeg);
      sm.code.forEach((d, q) => {
        Pequiv[d - 1] = ddAdd(Pequiv[d - 1], equivalent[q]);
        errP[d - 1] += ASSEMBLY * E * Math.abs(equivalent[q][0]);
        errEquiv[d - 1] += ASSEMBLY * E * Math.abs(equivalent[q][0]);
      });
      blocks.push(vec('f_FE', sm.localLabels, hiVec(total), { tag: 'total' }), vec('f_FE_global', sm.codeLabels, hiVec(global)), vec('equivalent', sm.codeLabels, hiVec(equivalent)));
      add('member-loads', 7, k + 1, scope(k), [`geometry#${k + 1}`, `transformation#${k + 1}`], { member: k + 1, loads: mine.length }, [...formulas.filter((f, q) => formulas.indexOf(f) === q), 'f_FE_global = T^T·f_FE', 'equivalent = −f_FE_global'], blocks);
    });
  }
  const PD = Pnodal.map((v, d) => {
    const total = ddAdd(v, Pequiv[d]);
    return !ddIsZero(total) && Math.abs(total[0]) <= errP[d] ? DD_ZERO : total;
  });
  const P = hiVec(PD);
  add(
    'load-vector',
    7,
    null,
    { kind: 'structure' },
    ['nodal-loads', ...members.flatMap((_, k) => (fixedEnd[k] ? [`member-loads#${k + 1}`] : []))],
    { loadedMembers: fixedEnd.filter((f) => f !== null).length },
    frame ? ['P = P_nodal + P_equivalent'] : ['P = P_nodal'],
    [...(frame ? [vec('P_nodal', dofLabels, hiVec(Pnodal)), vec('P_equivalent', dofLabels, hiVec(zeroUnder(Pequiv, errEquiv)))] : []), vec('P', dofLabels, P)],
  );
  if (!P.every(Number.isFinite)) return fail([{ code: 'size' }], steps);

  /* 8 — the partition. */
  const pickD = (rows: number[], cols: number[]): DD[][] => rows.map((r) => cols.map((c) => KD[r - 1][c - 1]));
  const KFF = pickD(free, free);
  const KFR = pickD(free, restrained);
  const KRF = pickD(restrained, free);
  const KRR = pickD(restrained, restrained);
  const PF = free.map((d) => PD[d - 1]);
  const PR = restrained.map((d) => PD[d - 1]);
  const uR = restrained.map((d) => prescribed[d - 1]);
  const uRD = uR.map(dd);
  add(
    'partition',
    8,
    null,
    { kind: 'structure' },
    ['assembled', 'load-vector', 'structure'],
    { free: nF, restrained: nR },
    ['K = [K_FF K_FR; K_RF K_RR]', 'P = [P_F; P_R]', 'u = [u_F; u_R]'],
    [
      mat('K_FF', freeLabels, freeLabels, hiMat(KFF)),
      mat('K_FR', freeLabels, restrainedLabels, hiMat(KFR)),
      mat('K_RF', restrainedLabels, freeLabels, hiMat(KRF)),
      mat('K_RR', restrainedLabels, restrainedLabels, hiMat(KRR)),
      vec('P_F', freeLabels, hiVec(PF)),
      vec('P_R', restrainedLabels, hiVec(PR)),
      vec('u_R', restrainedLabels, uR, { highlights: uR.flatMap((v, k) => (v !== 0 ? [{ index: k, reason: 'prescribed' as const }] : [])) }),
    ],
  );

  /* 9 — the reduced equation. */
  const KFRuR = mv(KFR, uRD);
  // The right-hand side, and the largest error the arithmetic could have put in each entry of it. One no larger than its error is exactly 0
  // (a settlement that strains nothing leaves rounding there, and rounding is not a load).
  const errF = free.map((d) => errP[d - 1]);
  const errRhs = PF.map(
    (v, k) =>
      errF[k] +
      E * (Math.abs(v[0]) + KFR[k].reduce((s, x, j) => s + Math.abs(x[0] * uR[j]), 0)) +
      restrained.reduce((s, r, j) => s + errK[free[k] - 1][r - 1] * Math.abs(uR[j]), 0),
  );
  const rhs = PF.map((v, k) => {
    const value = ddSub(v, KFRuR[k]);
    return !ddIsZero(value) && Math.abs(value[0]) <= errRhs[k] ? DD_ZERO : value;
  });
  add(
    'reduced',
    9,
    null,
    { kind: 'structure' },
    ['partition'],
    { free: nF, settles: uR.some((v) => v !== 0) },
    ['K_FF·u_F = P_F − K_FR·u_R'],
    [vec('P_F', freeLabels, hiVec(PF)), vec('K_FR·u_R', freeLabels, hiVec(zeroUnder(KFRuR, errRhs))), vec('rhs', freeLabels, hiVec(rhs))],
  );

  /* 10 — the elimination. */
  const record = nF <= RECORD_LIMIT;
  const augLabels = [...freeLabels, 'rhs'];
  if (record && nF > 0) {
    const aug0: Mat = KFF.map((row, i) => [...row.map(H), H(rhs[i])]);
    add('augmented', 10, null, { kind: 'structure' }, ['reduced', 'partition'], { size: nF }, ['[K_FF | rhs]'], [mat('augmented', freeLabels, augLabels, aug0)]);
  }
  const errKFF = free.map((r) => free.map((c) => errK[r - 1][c - 1]));
  const out = eliminate(KFF, rhs, errKFF, errRhs, {
    pass: (k, pivot, multipliers, aug, changed, eliminated) => {
      if (!record) return;
      const highlights: Highlight[] = [{ row: k, col: k, reason: 'pivot' }];
      for (const i of eliminated) highlights.push({ row: i, col: k, reason: 'eliminated' });
      for (const [i, j] of changed) highlights.push({ row: i, col: j, reason: 'updated' });
      add(
        'forward-pass',
        10,
        k + 1,
        { kind: 'structure' },
        [k === 0 ? 'augmented' : `forward-pass#${k}`],
        { pass: k + 1, pivotDof: free[k], pivot: H(pivot), rows: nF - k - 1 },
        ['m_ik = a_ik/a_kk', 'a_ij ← a_ij − m_ik·a_kj'],
        [
          sca('pivot', H(pivot), 'a_kk', `pass#${k + 1}`),
          vec('multipliers', freeLabels.slice(k + 1), hiVec(multipliers), { symbolic: multipliers.map(() => 'a_ik/a_kk'), tag: `pass#${k + 1}` }),
          mat('augmented', freeLabels, augLabels, hiMat(aug), { highlights, tag: `pass#${k + 1}` }),
        ],
      );
    },
  });
  if (out.overflow) return fail([{ code: 'size' }], steps);
  if (out.stuck) {
    const stuck = out.stuck;
    const verdict = mechanismOf(stuck, KFF, errKFF, free, dofs, nodes, sz, mode, N, solvedMembers);
    if (record) {
      const k = stuck.at;
      add(
        'forward-pass',
        10,
        k + 1,
        { kind: 'structure' },
        [k === 0 ? 'augmented' : `forward-pass#${k}`],
        { pass: k + 1, pivotDof: free[k], pivot: stuck.pivot, rows: nF - k - 1, singular: true, error: stuck.rounding, cause: verdict.code === 'mechanism' ? 'mechanism' : 'range' },
        verdict.code === 'mechanism' ? ['a_kk = 0'] : [],
        [
          sca('pivot', stuck.pivot, 'a_kk', `pass#${k + 1}`),
          sca('rounding', stuck.rounding, undefined, `pass#${k + 1}`),
          mat('augmented', freeLabels, augLabels, hiMat(stuck.rows), { highlights: [{ row: k, col: k, reason: 'zero-pivot' }], tag: `pass#${k + 1}` }),
        ],
      );
    }
    return fail([verdict], steps);
  }
  // The unknowns as the back-substitution gives them, before any is called zero.
  const uFraw = out.u;
  // The residual: the worst equation, against RESIDUAL of the size of its own terms (the sum of their sizes) and the rounding of the largest equation of the structure
  // (ROUNDING units): an equation whose terms are all rounding — a node that does not move — leaves rounding, and rounding is measured against rounding and not against itself.
  // `worstRatio` is the residual over that tolerance, times RESIDUAL: it is at most RESIDUAL when every equation is within it.
  const residualD = KFF.map((row, i) => {
    let s: DD = ddNeg(rhs[i]);
    for (let j = 0; j < nF; j++) if (!ddIsZero(row[j]) && !ddIsZero(uFraw[j])) s = ddAdd(s, ddMul(row[j], uFraw[j]));
    return s;
  });
  const residualVector = hiVec(residualD);
  const equationSize = KFF.map((row, i) => Math.abs(rhs[i][0]) + row.reduce((s, x, j) => s + Math.abs(x[0] * uFraw[j][0]), 0));
  const equationScale = Math.max(0, ...equationSize);
  const floorTerm = (ROUNDING * E * equationScale) / RESIDUAL;
  let worstRatio = 0;
  let worstIndex = 0;
  let worstSize = 0;
  residualVector.forEach((r, i) => {
    const sz2 = equationSize[i] + floorTerm;
    const ratio = sz2 > 0 ? Math.abs(r) / sz2 : Math.abs(r) > 0 ? Infinity : 0;
    if (ratio > worstRatio || (ratio === worstRatio && Math.abs(r) > Math.abs(residualVector[worstIndex]))) {
      worstRatio = ratio;
      worstIndex = i;
      worstSize = sz2;
    }
  });
  // `max|residual|` is the largest residual of any equation; the check 'solve' is about the equation whose residual is largest against its own size.
  const maxResidual = Math.max(0, ...residualVector.map(Math.abs));
  const worstResidual = nF > 0 ? Math.abs(residualVector[worstIndex]) : 0;

  /*
   * HOW FAR THE ANSWER CAN BE WRONG. The unknowns solve K_FF·u = rhs up to a residual r, so they are the exact answer to equations that differ from these by r; and the
   * equations themselves are known only to the errors of the stiffnesses and of the loads they were made of, and to the rounding of the terms. Everything that is
   * uncertain in equation j is gathered in floorEq[j]; the answer moves by the inverse of K_FF times that, and nothing else: a displacement, a reaction or a force that is a
   * linear function of the unknowns is as uncertain as that function of the inverse says (a first-order bound, which is how an engineer reads the sensitivity of a solution).
   * A stiff member shows how little this is: the two ends of a rigid link move together, so their difference — what the force in it is made of — is as certain as the
   * inverse says it is, a million times more than the two displacements taken alone.
   */
  const X = nF > 0 ? inverseOf(out.lower, out.aug, nF) : [];
  const absX = X.map((row) => row.map((x) => Math.abs(x[0])));
  const floorEq = KFF.map((row, i) => Math.abs(residualVector[i]) + ASSEMBLY * E * equationSize[i] + row.reduce((s, _x, l) => s + errKFF[i][l] * Math.abs(uFraw[l][0]), 0) + errRhs[i]);
  const duF = absX.map((row) => row.reduce((s, x, j) => s + x * floorEq[j], 0));
  // an unknown no larger than what it could be wrong by is 0
  const uFD = uFraw.map((v, k) => (!ddIsZero(v) && Math.abs(v[0]) <= duF[k] ? DD_ZERO : v));
  const uF = hiVec(uFD);
  if (record) {
    // The back-substitution as recorded: the last unknown first.
    for (let q = 0; q < nF; q++) {
      const k = nF - 1 - q;
      add(
        'back-substitution',
        10,
        q + 1,
        { kind: 'structure' },
        [q > 0 ? `back-substitution#${q}` : nF > 1 ? `forward-pass#${nF - 1}` : 'augmented'],
        { unknown: k + 1, dof: free[k], value: H(uFD[k]) },
        ['u_k = (b_k − Σ a_kj·u_j)/a_kk'],
        [sca('pivot', H(out.aug[k][k]), 'a_kk', `unknown#${k + 1}`), vec('u', freeLabels.slice(k), hiVec(uFD.slice(k)), { tag: `unknown#${k + 1}` })],
      );
    }
  }
  add(
    'solution',
    10,
    null,
    { kind: 'structure' },
    record ? [nF > 0 ? `back-substitution#${nF}` : 'reduced'] : ['reduced'],
    { recorded: record, ...(record ? {} : { why: 'too-many-free-dofs', limit: RECORD_LIMIT }), free: nF, residual: maxResidual, relativeResidual: worstRatio, equationScale },
    ['K_FF·u_F = rhs', 'r = K_FF·u_F − rhs'],
    [vec('u_F', freeLabels, uF), vec('residual', freeLabels, residualVector), sca('max|residual|', maxResidual, 'max|K_FF·u_F − rhs|')],
  );
  const unsolved = illConditioned(worstRatio, []);
  if (unsolved) return fail([unsolved], steps);

  /* 11 — the displacements. */
  // (the numbers every later step is worked from are the unknowns as solved; the ones printed have the unknowns that are rounding set to 0)
  const uD: DD[] = dofs.map((d) => (d.free === null ? dd(d.prescribed) : uFraw[d.free - 1]));
  const uPrinted: DD[] = dofs.map((d) => (d.free === null ? dd(d.prescribed) : uFD[d.free - 1]));
  const duD: number[] = dofs.map((d) => (d.free === null ? 0 : duF[d.free - 1]));
  const u = hiVec(uPrinted);
  add(
    'displacements',
    11,
    null,
    { kind: 'structure' },
    ['solution', 'partition'],
    { dofs: N },
    ['u = [u_F; u_R]'],
    [vec('u', dofLabels, u, { highlights: dofs.flatMap((d, k) => (d.restrained ? [{ index: k, reason: d.prescribed !== 0 ? ('prescribed' as const) : ('restrained' as const) }] : [])) })],
  );
  // The rows of the inverse for the global DOFs of a member (a held DOF does not move, so its row is 0).
  const noMove: DD[] = new Array<DD>(nF).fill(DD_ZERO);
  const inverseRows = (code: readonly number[]): DD[][] => code.map((d) => (dofs[d - 1].free === null ? noMove : X[(dofs[d - 1].free as number) - 1]));

  /* 12 — the reactions. */
  const KRFuF = mv(KRF, uFraw);
  const KRRuR = mv(KRR, uRD);
  const RD0 = restrained.map((_, k) => ddSub(ddAdd(KRFuF[k], KRRuR[k]), PR[k]));
  // What the arithmetic could have put into each reaction: the roundings of its terms, the errors of the stiffnesses and of the loads they are made of, and the answer's own
  // uncertainty seen through the stiffnesses that carry it to the support (the inverse again, so that a stiff member that holds two soft nodes together does not count twice).
  const Wr = nF > 0 ? ddMatMul(KRF, X) : restrained.map(() => []);
  const dR = restrained.map((r, k) => {
    let bound = ASSEMBLY * E * (Math.abs(PR[k][0]) + KRF[k].reduce((s, x, j) => s + Math.abs(x[0] * uFraw[j][0]), 0) + KRR[k].reduce((s, x, j) => s + Math.abs(x[0] * uR[j]), 0)) + errP[r - 1];
    KRF[k].forEach((_x, j) => {
      bound += errK[r - 1][free[j] - 1] * Math.abs(uFraw[j][0]);
    });
    restrained.forEach((q, j) => {
      bound += errK[r - 1][q - 1] * Math.abs(uR[j]);
    });
    Wr[k].forEach((w, j) => {
      bound += Math.abs(w[0]) * floorEq[j];
    });
    return bound;
  });
  const RD = zeroUnder(RD0, dR);
  const R = hiVec(RD);
  add(
    'reactions',
    12,
    null,
    { kind: 'structure' },
    ['partition', 'solution'],
    { restrained: nR },
    ['R = K_RF·u_F + K_RR·u_R − P_R'],
    [
      // (the two parts that make a reaction are as uncertain as the reaction: one that is no larger than that is rounding, and is 0 beside a reaction that is 0)
      vec('K_RF·u_F', restrainedLabels, hiVec(zeroUnder(KRFuF, dR))),
      vec('K_RR·u_R', restrainedLabels, hiVec(zeroUnder(KRRuR, dR))),
      vec('P_R', restrainedLabels, hiVec(PR)),
      vec('R', restrainedLabels, R),
    ],
  );
  const reactions: ReactionEntry[] = restrained.map((d, k) => ({ dof: d, label: dofLabels[d - 1], node: dofs[d - 1].node, kind: dofs[d - 1].kind, value: R[k] }));

  /* 13 — the member end forces. */
  const forces: MemberForces[] = [];
  const fD: DD[][] = [];
  const dFmember: number[][] = [];
  solvedMembers.forEach((sm, k) => {
    const T = TD[k];
    const kk = kD[k];
    const uGlobal = sm.code.map((d) => uD[d - 1]);
    const uLocal0 = mv(T, uGlobal);
    // What the arithmetic could have put into each local displacement, each local force k·u and each end force f: the roundings of the terms, and the answer's own
    // uncertainty seen through T and through k (by the inverse: see the reactions).
    const GT = nF > 0 ? ddMatMul(T, inverseRows(sm.code)) : T.map(() => []);
    const Gk = nF > 0 ? ddMatMul(kk, GT) : kk.map(() => []);
    const seen = (G: DD[][], q: number) => G[q].reduce((s, x, j) => s + Math.abs(x[0]) * floorEq[j], 0);
    const bl = T.map((row, q) => ASSEMBLY * E * row.reduce((s, x, j) => s + Math.abs(x[0] * uGlobal[j][0]), 0) + seen(GT, q));
    const uLocal = zeroUnder(uLocal0, bl);
    const fk0 = mv(kk, uLocal0);
    const dk = kk.map((row, q) => ASSEMBLY * E * row.reduce((s, x, j) => s + Math.abs(x[0] * uLocal0[j][0]), 0) + seen(Gk, q));
    const fk = zeroUnder(fk0, dk);
    const fe = fixedEnd[k];
    const f0 = fe ? fk0.map((v, q) => ddAdd(v, fe[q])) : fk0.slice();
    const floor = f0.map((_, q) => dk[q] + (fe ? ASSEMBLY * E * Math.abs(fe[q][0]) : 0));
    const f = zeroUnder(f0, floor);
    fD.push(f);
    const uShown = sm.code.map((d) => uPrinted[d - 1]);
    const blocks: Block[] = [vec('u_e', sm.codeLabels, hiVec(uShown)), vec('u_local', sm.localLabels, hiVec(uLocal)), vec('k·u_local', sm.localLabels, hiVec(fk))];
    let start: MemberForces['start'];
    let end: MemberForces['end'];
    let bar: MemberForces['bar'] = null;
    const facts: Step['facts'] = { member: k + 1 };
    const formulas: string[] = ['u_e = u(code)', 'u_local = T·u_e'];
    const fh = hiVec(f);
    if (frame) {
      if (fe) blocks.push(vec('f_FE', sm.localLabels, hiVec(fe)));
      blocks.push(vec('f', sm.localLabels, fh));
      start = { N: neg(fh[0]), V: fh[1] + 0, M: neg(fh[2]) };
      end = { N: fh[3] + 0, V: neg(fh[4]), M: fh[5] + 0 };
      blocks.push(
        mat('ends', ['N', 'V', 'M'], ['i', 'j'], [
          [start.N, end.N],
          [start.V, end.V],
          [start.M, end.M],
        ]),
      );
      formulas.push(fe ? 'f = k·u_local + f_FE' : 'f = k·u_local', 'N_i = −f_1', 'V_i = f_2', 'M_i = −f_3', 'N_j = f_4', 'V_j = −f_5', 'M_j = f_6');
    } else {
      const Nn = fh[1] + 0;
      const elongation = H(ddSub(uLocal0[1], uLocal0[0]));
      const stress = H(ddDivD(f[1], sm.A));
      start = { N: neg(fh[0]), V: 0, M: 0 };
      end = { N: Nn, V: 0, M: 0 };
      bar = { N: Nn, stress, elongation };
      blocks.push(vec('f', sm.localLabels, fh), sca('N', Nn, 'f_2'), sca('σ', stress, 'N/A'), sca('δ', elongation, 'u_j − u_i'));
      formulas.push('f = k·u_local', 'N = f_2 = (EA/L)(u_j − u_i)', 'σ = N/A', 'δ = u_j − u_i');
    }
    forces.push({ member: k + 1, uGlobal: hiVec(uShown), uLocal: hiVec(uLocal), f: fh, fixedEnd: fe ? hiVec(fe) : null, start, end, bar, floor });
    add('end-forces', 13, k + 1, scope(k), [`local-stiffness#${k + 1}`, `transformation#${k + 1}`, 'displacements', ...(fe ? [`member-loads#${k + 1}`] : [])], facts, formulas, blocks);
    dFmember.push(floor);
  });

  /* The force scale: the loads added up, or the largest reaction or end force (a moment over the size): what a force is measured against. */
  let loadScale = 0;
  for (const l of p.loads) loadScale += Math.abs(l.fx) + Math.abs(l.fy) + (frame ? Math.abs(l.m) / Math.max(sz, 1e-300) : 0);
  const appliedMember: { x: DD; y: DD; fx: DD; fy: DD }[] = [];
  p.memberLoads.forEach((l) => {
    const L = LD[l.member];
    const a = nodes[members[l.member].i];
    let t: DD;
    let flx: DD = DD_ZERO;
    let fly: DD = DD_ZERO;
    if (l.kind === 'udl') {
      fly = ddMulD(L, l.w);
      t = ddDivD(L, 2);
    } else if (l.kind === 'point') {
      fly = dd(l.P);
      t = dd(l.a);
    } else {
      flx = ddMulD(L, l.q);
      t = ddDivD(L, 2);
    }
    loadScale += Math.abs(flx[0]) + Math.abs(fly[0]);
    const c = cD[l.member];
    const s = sD[l.member];
    appliedMember.push({ x: ddAddD(ddMul(c, t), a.x), y: ddAddD(ddMul(s, t), a.y), fx: ddSub(ddMul(c, flx), ddMul(s, fly)), fy: ddAdd(ddMul(s, flx), ddMul(c, fly)) });
  });
  let magnitude = 0;
  restrained.forEach((d, k) => {
    magnitude = Math.max(magnitude, Math.abs(R[k]) / (dofs[d - 1].kind === 'θ' ? Math.max(sz, 1e-300) : 1));
  });
  for (const fo of forces)
    fo.f.forEach((v, q) => {
      magnitude = Math.max(magnitude, Math.abs(v) / (frame && q % 3 === 2 ? Math.max(sz, 1e-300) : 1));
    });
  const scale = Math.max(loadScale, magnitude);

  /* How many figures stand: the largest bound on an error of the results, the displacements, the reactions and the end forces, each against the largest of its kind. */
  const reach = Math.max(sz, 1e-300);
  const lengthOf = (d: number, v: number) => Math.abs(v) * (dofs[d].kind === 'θ' ? reach : 1);
  const uTop = Math.max(0, ...u.map((v, d) => lengthOf(d, v)));
  let share = 0;
  let shareAt = free[0] ?? restrained[0] ?? 1;
  const consider = (s: number, dof: number) => {
    if (s > share) {
      share = s;
      shareAt = dof;
    }
  };
  if (uTop > 0) duD.forEach((v, d) => consider(lengthOf(d, v) / uTop, d + 1));
  if (scale > 0) {
    restrained.forEach((d, k) => consider(dR[k] / (dofs[d - 1].kind === 'θ' ? reach : 1) / scale, d));
    solvedMembers.forEach((sm, k) => dFmember[k].forEach((v, q) => consider(v / (frame && q % 3 === 2 ? reach : 1) / scale, sm.code[frame ? q : q === 0 ? 0 : 2])));
  }

  /* 14 — the checks. */
  // The tolerance of a check: RESIDUAL of its scale, and the rounding of its own terms (ROUNDING units of the arithmetic's rounding). The scales are the force scale for forces,
  // that times the size for moments, the work of the loads and reactions for the energy, and the size of the equation for the residual of the elimination.
  const roundOf = (terms: number) => ROUNDING * E * terms;
  // Global equilibrium, the loads added up from their definitions (not from the equivalent loads the solve used).
  let sumFx: DD = DD_ZERO;
  let sumFy: DD = DD_ZERO;
  let sumM: DD = DD_ZERO;
  let tFx = 0;
  let tFy = 0;
  let tM = 0;
  const arm = (px: number, py: number): { x: DD; y: DD } => ({ x: sum2(px, 0 - about.x), y: sum2(py, 0 - about.y) });
  for (const l of p.loads) {
    sumFx = ddAddD(sumFx, l.fx);
    sumFy = ddAddD(sumFy, l.fy);
    tFx += Math.abs(l.fx);
    tFy += Math.abs(l.fy);
    const r = arm(nodes[l.node].x, nodes[l.node].y);
    const m1 = ddMulD(r.x, l.fy);
    const m2 = ddMulD(r.y, l.fx);
    sumM = ddSub(ddAdd(sumM, m1), m2);
    tM += Math.abs(m1[0]) + Math.abs(m2[0]);
    if (frame) {
      sumM = ddAddD(sumM, l.m);
      tM += Math.abs(l.m);
    }
  }
  for (const l of appliedMember) {
    sumFx = ddAdd(sumFx, l.fx);
    sumFy = ddAdd(sumFy, l.fy);
    tFx += Math.abs(l.fx[0]);
    tFy += Math.abs(l.fy[0]);
    const rx = ddAddD(l.x, 0 - about.x);
    const ry = ddAddD(l.y, 0 - about.y);
    const m1 = ddMul(rx, l.fy);
    const m2 = ddMul(ry, l.fx);
    sumM = ddSub(ddAdd(sumM, m1), m2);
    tM += Math.abs(m1[0]) + Math.abs(m2[0]);
  }
  restrained.forEach((d, k) => {
    const dof = dofs[d - 1];
    const node = nodes[dof.node - 1];
    const r = arm(node.x, node.y);
    if (dof.kind === 'x') {
      sumFx = ddAdd(sumFx, RD[k]);
      tFx += Math.abs(R[k]);
      const m2 = ddMul(r.y, RD[k]);
      sumM = ddSub(sumM, m2);
      tM += Math.abs(m2[0]);
    } else if (dof.kind === 'y') {
      sumFy = ddAdd(sumFy, RD[k]);
      tFy += Math.abs(R[k]);
      const m1 = ddMul(r.x, RD[k]);
      sumM = ddAdd(sumM, m1);
      tM += Math.abs(m1[0]);
    } else {
      sumM = ddAdd(sumM, RD[k]);
      tM += Math.abs(R[k]);
    }
  });
  // Joint equilibrium: P_nodal + R − Σ (member end forces on the joint, global) at every DOF.
  const memberOnJoint: DD[] = new Array<DD>(N).fill(DD_ZERO);
  const jointTerms = new Array<number>(N).fill(0);
  solvedMembers.forEach((sm, k) => {
    const fg = mv(ddTranspose(TD[k]), fD[k]);
    sm.code.forEach((d, q) => {
      memberOnJoint[d - 1] = ddAdd(memberOnJoint[d - 1], fg[q]);
      jointTerms[d - 1] += Math.abs(fg[q][0]);
    });
  });
  const RfullD: DD[] = new Array<DD>(N).fill(DD_ZERO);
  restrained.forEach((d, k) => {
    RfullD[d - 1] = RD[k];
  });
  const joint = Pnodal.map((v, d) => ddSub(ddAdd(v, RfullD[d]), memberOnJoint[d]));
  jointTerms.forEach((_, d) => {
    jointTerms[d] += Math.abs(Pnodal[d][0]) + Math.abs(RfullD[d][0]);
  });
  const KuD = mv(KD, uD);
  const KuTerms = mvSize(KD, uD.map((v) => Math.abs(v[0])));
  const system = KuD.map((v, d) => ddSub(ddSub(v, PD[d]), RfullD[d]));
  const U = ddMulD(uD.reduce((s, v, d) => ddAdd(s, ddMul(v, KuD[d])), DD_ZERO), 0.5);
  const uRfullD = restrained.map((d) => uD[d - 1]);
  const W = ddMulD(ddAdd(uD.reduce((s, v, d) => ddAdd(s, ddMul(v, PD[d])), DD_ZERO), uRfullD.reduce((s, v, k) => ddAdd(s, ddMul(v, RD[k])), DD_ZERO)), 0.5);
  // The work of the loads and reactions added up in size: what the energy check is measured against; the terms of ½uᵀKu, in size, are what its rounding is measured against.
  const work = 0.5 * (uD.reduce((s, v, d) => s + Math.abs(v[0] * PD[d][0]), 0) + uRfullD.reduce((s, v, k) => s + Math.abs(v[0] * RD[k][0]), 0));
  const energyTerms = work + 0.5 * uD.reduce((s, v, d) => s + Math.abs(v[0]) * KuTerms[d], 0);
  // A check made of one number for each DOF is held, at each DOF, to RESIDUAL of the scale and to the rounding of the largest terms of any DOF (the elimination spreads
  // the rounding of an equation over the others: an equation whose own terms are small is not freed of the rounding of the large ones).
  const worstOf = (values: DD[], terms: number[]): { value: number; allowance: number } => {
    const biggest = Math.max(0, ...terms.map((t, d) => t / (dofs[d].kind === 'θ' ? reach : 1)));
    let pick = 0;
    let top = -1;
    values.forEach((v, d) => {
      const per = dofs[d].kind === 'θ' ? reach : 1;
      const tol = (RESIDUAL * scale + roundOf(biggest)) * per;
      const ratio = tol > 0 ? Math.abs(v[0]) / tol : Math.abs(v[0]) > 0 ? Infinity : 0;
      if (ratio > top) {
        top = ratio;
        pick = d;
      }
    });
    const per = values.length && dofs[pick].kind === 'θ' ? reach : 1;
    return { value: values.length ? H(values[pick]) / per : 0, allowance: roundOf(biggest) };
  };
  const jointWorst = worstOf(joint, jointTerms);
  const systemWorst = worstOf(system, KuTerms.map((v, d) => v + Math.abs(PD[d][0]) + Math.abs(RfullD[d][0])));
  const within = (value: number, sc: number, allowance: number) => Math.abs(value) <= RESIDUAL * sc + allowance;
  const check = (id: Check['id'], value: number, sc: number, allowance: number): Check => ({ id, value, scale: sc, allowance, ok: within(value, sc, allowance) });
  const checks: Check[] = [
    check('sum-fx', H(sumFx), scale, roundOf(tFx)),
    check('sum-fy', H(sumFy), scale, roundOf(tFy)),
    check('sum-moment', H(sumM), scale * Math.max(sz, 1e-300), roundOf(tM)),
    check('joints', jointWorst.value, scale, jointWorst.allowance),
    check('energy', H(ddSub(U, W)), work, roundOf(energyTerms)),
    check('system', systemWorst.value, scale, systemWorst.allowance),
    { id: 'solve', value: worstResidual, scale: worstSize, allowance: 0, ok: worstRatio <= RESIDUAL },
  ];
  const allowanceTop = Math.max(0, ...checks.filter((c) => c.id !== 'solve' && c.id !== 'energy').map((c) => c.allowance / (c.id === 'sum-moment' ? Math.max(sz, 1e-300) : 1)));
  add(
    'checks',
    14,
    null,
    { kind: 'structure' },
    ['displacements', 'reactions', ...members.map((_, k) => `end-forces#${k + 1}`), 'load-vector', 'assembled'],
    { scale, size: sz, work, allowance: allowanceTop, aboutX: about.x, aboutY: about.y, allOk: checks.every((c) => c.ok) },
    ['ΣFx = 0', 'ΣFy = 0', 'ΣM = 0', 'P_nodal + R − Σ f_global = 0', 'U = ½·u^T·K·u = ½·u^T·P + ½·u_R^T·R', 'K·u = P + R'],
    [
      sca('ΣFx', H(sumFx), 'ΣP_x + ΣR_x'),
      sca('ΣFy', H(sumFy), 'ΣP_y + ΣR_y'),
      sca('ΣM', H(sumM), 'ΣM(P) + ΣM(R)'),
      vec('joint', dofLabels, hiVec(joint), { symbolic: dofLabels.map(() => 'P_nodal + R − Σ f_global') }),
      sca('U', H(U), '½·u^T·K·u'),
      sca('W', H(W), '½·u^T·P + ½·u_R^T·R'),
      vec('K·u − P − R', dofLabels, hiVec(system)),
    ],
  );
  const unbalanced = illConditioned(worstRatio, checks);
  if (unbalanced) return fail([unbalanced], steps);
  // The results have no figure to stand on: refused, the way a pivot lost in rounding is.
  if (share >= RESOLVE) {
    const node = dofs[shareAt - 1].node;
    return fail([{ code: 'stiffness-range', dof: shareAt, node, nodes: [node], ratio: share }], steps);
  }

  /* Warnings. */
  const zeroLoad = p.loads.every((l) => l.fx === 0 && l.fy === 0 && (!frame || l.m === 0)) && p.memberLoads.every((l) => (l.kind === 'udl' ? l.w === 0 : l.kind === 'point' ? l.P === 0 : l.q === 0)) && prescribed.every((v) => v === 0);
  if (zeroLoad) warnings.push({ code: 'no-load' });
  if (!frame && Array.isArray(model.memberLoads) && model.memberLoads.length > 0) warnings.push({ code: 'member-loads-ignored', count: model.memberLoads.length });
  if (ignoredSettlement.length > 0) warnings.push({ code: 'settlement-ignored', dofs: ignoredSettlement.sort((a, b) => a - b) });
  if (emptySupports.length > 0) warnings.push({ code: 'empty-support', nodes: emptySupports.sort((a, b) => a - b) });
  // Fewer than six figures are guaranteed (more than WEAK of the largest result could be rounding): how many is said.
  if (share > WEAK) warnings.push({ code: 'near-mechanism', dofs: [shareAt], ratio: share, count: Math.max(1, Math.floor(-Math.log10(share))) });
  // First order only: a member that has left the theory the numbers belong to says so. A chord that turns, an end that turns away from its chord, a member that stretches.
  warnings.push(...largeWarnings(solvedMembers, forces, u, mode));

  const solvedNodes: SolvedNode[] = nodes.map((q, k) => ({ label: k + 1, x: q.x, y: q.y, dofs: dofsOfNode(k + 1, mode) }));
  const solution: Solution = { ok: true, mode, dofs, nodes: solvedNodes, members: solvedMembers, steps, free, restrained, u, uError: duD, accuracy: share, P, K, reactions, forces, checks, size: sz, about, scale, warnings };
  if (!everythingFinite(solution)) return fail([{ code: 'size' }], []);
  return solution;
}

/* ── First order only ─────────────────────────────────────────────────── */

/** The chord of each member turns, in the solution, by (the difference of the nodes' displacements across it) over its length: the largest of them, in radians, and whose it is (label from 1). */
export function largestChordTurn(members: readonly SolvedMember[], u: readonly number[]): { angle: number; member: number } {
  let angle = 0;
  let member = 1;
  members.forEach((m) => {
    const di = m.code.length === 4 ? [m.code[0], m.code[1], m.code[2], m.code[3]] : [m.code[0], m.code[1], m.code[3], m.code[4]];
    const across = neg(m.s) * (u[di[2] - 1] - u[di[0] - 1]) + m.c * (u[di[3] - 1] - u[di[1] - 1]);
    const turn = Math.abs(across) / m.length;
    if (turn > angle) {
      angle = turn;
      member = m.label;
    }
  });
  return { angle, member };
}

/**
 * Small displacements are the theory the numbers belong to: a member that goes past LARGE (a tenth) in any of the three ways it can has left it, and the warning says which. Its
 * chord turns (the ends move across it by more than a tenth of its length), an end of a frame member turns away from its chord by more than a tenth of a radian, or the member
 * stretches or shortens by more than a tenth of its length. Each is reported once, for the member where it is largest.
 */
export function largeWarnings(members: readonly SolvedMember[], forces: readonly Pick<MemberForces, 'uLocal'>[], u: readonly number[], mode: Mode): Warning[] {
  const out: Warning[] = [];
  const turn = largestChordTurn(members, u);
  if (turn.angle > LARGE) out.push({ code: 'large-displacements', ratio: turn.angle, count: turn.member, nodes: [members[turn.member - 1].i, members[turn.member - 1].j] });
  let rotation = 0;
  let rotationAt = 1;
  let stretch = 0;
  let stretchAt = 1;
  members.forEach((m, k) => {
    const ul = forces[k].uLocal;
    const length = m.length;
    const stretched = Math.abs(mode === 'frame' ? ul[3] - ul[0] : ul[1] - ul[0]) / length;
    if (stretched > stretch) {
      stretch = stretched;
      stretchAt = m.label;
    }
    if (mode === 'frame') {
      const chord = (ul[4] - ul[1]) / length;
      const away = Math.max(Math.abs(ul[2] - chord), Math.abs(ul[5] - chord));
      if (away > rotation) {
        rotation = away;
        rotationAt = m.label;
      }
    }
  });
  if (rotation > LARGE) out.push({ code: 'large-rotation', ratio: rotation, count: rotationAt, nodes: [members[rotationAt - 1].i, members[rotationAt - 1].j] });
  if (stretch > LARGE) out.push({ code: 'large-stretch', ratio: stretch, count: stretchAt, nodes: [members[stretchAt - 1].i, members[stretchAt - 1].j] });
  return out;
}

/* ── A pivot the arithmetic cannot tell from zero: a mechanism or a stiffness range ─ */

/**
 * What a pivot that rounding cannot tell from zero is. The movement it allows (the pivot's DOF set to 1, the rows above solved for the rest) is tried on
 * every member: what the member deforms in it (its elongation over its length and the turn of its ends beyond that of its chord) against the size of the movement the
 * member takes part in. A mechanism deforms none of them (to STRAIN). If one is strained the movement is searched for again, in the null space of the whole matrix (an
 * elimination that takes the largest diagonal first, so that the unresolved columns are left over) and in the eigenvectors of the unit-diagonal matrix, and only if every
 * one of them strains a member is the structure called stable and the stiffnesses of it too far apart for the arithmetic ('stiffness-range').
 */
function mechanismOf(
  sing: Stuck,
  KFF: readonly (readonly DD[])[],
  errKFF: readonly (readonly number[])[],
  free: number[],
  dofs: Dof[],
  nodes: { x: number; y: number }[],
  extent: number,
  mode: Mode,
  N: number,
  members: readonly SolvedMember[],
): Issue {
  const nF = free.length;
  const k = sing.at;
  // The null mode: the singular DOF set to 1, the DOFs already eliminated from the rows of the reduced matrix.
  const v: DD[] = new Array<DD>(nF).fill(DD_ZERO);
  v[k] = DD_ONE;
  for (let i = k - 1; i >= 0; i--) {
    let s: DD = DD_ZERO;
    for (let j = i + 1; j <= k; j++) s = ddAdd(s, ddMul(sing.rows[i][j], v[j]));
    v[i] = ddNeg(ddDiv(s, sing.rows[i][i]));
  }
  const spread = (vector: readonly number[]): number[] => {
    const full = new Array<number>(N).fill(0);
    free.forEach((d, q) => {
      full[d - 1] = Number.isFinite(vector[q]) ? vector[q] : 0;
    });
    return full;
  };
  let full = spread(v.map(H));
  const dof = free[k];
  // The rounding over the pivot (absent where the pivot is not above zero: the share would be infinite).
  const share = sing.pivot > 0 ? sing.rounding / sing.pivot : undefined;
  const nd = mode === 'frame' ? 3 : 2;
  // How much each member is strained by a movement (one entry per DOF): what it deforms (its elongation over its length, and the turn of each end beyond the turn of its
  // chord - the numbers of no stiffness at all) against the size of the movement it takes part in (its largest translation over its length, or rotation). A member whose DOFs all
  // move by less than STRAIN of the largest movement (translations and rotations times the size, together) is not part of it: what it holds is the arithmetic's own noise in a
  // part that does not move. One that is part of it is taken with every DOF it has, the small ones too (the two ends of a very stiff bar, one of them under that line, are its strain).
  const reach = Math.max(extent, 1e-300);
  const strainOf = (field: readonly number[]): number => {
    const lengthOf = (d: number) => Math.abs(field[d - 1]) * ((d - 1) % nd === 2 ? reach : 1);
    const biggest = Math.max(0, ...free.map(lengthOf));
    let worst = 0;
    for (const m of members) {
      if (!m.code.some((d) => lengthOf(d) > STRAIN * biggest)) continue;
      const at = (end: 0 | 1) => {
        const o = end * nd;
        const vx = field[m.code[o] - 1];
        const vy = field[m.code[o + 1] - 1];
        return { u: m.c * vx + m.s * vy, w: neg(m.s) * vx + m.c * vy, turn: nd === 3 ? field[m.code[o + 2] - 1] : 0 };
      };
      const a = at(0);
      const b = at(1);
      const chord = (b.w - a.w) / m.length;
      const deformation = Math.hypot((b.u - a.u) / m.length, nd === 3 ? a.turn - chord : 0, nd === 3 ? b.turn - chord : 0);
      const movement = Math.max(Math.abs(a.u), Math.abs(a.w), Math.abs(b.u), Math.abs(b.w)) / m.length;
      const turning = Math.max(Math.abs(a.turn), Math.abs(b.turn));
      const scale = Math.max(movement, turning);
      if (scale > 0) worst = Math.max(worst, deformation / scale);
    }
    return worst;
  };
  // The independent motions, as far as the arithmetic can tell (the null space of the matrix, in 32 digits).
  const space = nullSpace(KFF, errKFF);
  let count = Math.max(1, space.nullity);
  if (strainOf(full) > STRAIN) {
    // another movement of the null space that strains no member: a basis vector, or the eigenvector of the unit-diagonal matrix
    const candidates: number[][] = space.basis.map((b) => spread(b.map(H)));
    const hiKFF = KFF.map((r) => r.map(H));
    const d = hiKFF.map((row, i) => (row[i] > 0 ? 1 / Math.sqrt(row[i]) : 0));
    const scaled = hiKFF.map((row, i) => row.map((val, j) => val * d[i] * d[j]));
    const { values, vectors } = jacobiEigen(scaled);
    if (values[0] <= AGREE) {
      const sharper = new Array<number>(N).fill(0);
      free.forEach((dd2, q) => {
        sharper[dd2 - 1] = (vectors[0]?.[q] ?? 0) * d[q];
      });
      candidates.push(sharper);
    }
    const better = candidates.find((c) => Number.isFinite(strainOf(c)) && strainOf(c) <= STRAIN);
    if (better) full = better;
    if (!better) return { code: 'stiffness-range', dof, node: dofs[dof - 1].node, nodes: [dofs[dof - 1].node], ...(share !== undefined ? { ratio: share } : {}) };
    count = Math.max(count, 1);
  }
  // Which nodes move: those that move at least a quarter as much as the one that moves most (a rotation counts for its size times the structure's).
  const move = nodes.map((_, n) => {
    const tx = full[nd * n];
    const ty = full[nd * n + 1];
    const r = nd === 3 ? Math.abs(full[nd * n + 2]) * Math.max(extent, 1e-300) : 0;
    return Math.max(Math.hypot(tx, ty), r);
  });
  const top = Math.max(...move, 0);
  const moving = move.flatMap((m, n) => (top > 0 && m >= 0.25 * top ? [n + 1] : []));
  const rigid = isRigidMotion(full, nodes, extent, nd);
  // The shape: the largest translation is 1 (or the largest rotation if nothing translates).
  let norm = 0;
  for (let n = 0; n < nodes.length; n++) norm = Math.max(norm, Math.hypot(full[nd * n], full[nd * n + 1]));
  if (!(norm > 0)) norm = maxAbs(full) || 1;
  const shape = full.map((x) => {
    const y = x / norm;
    return Math.abs(y) <= ZERO ? 0 : y;
  });
  return { code: 'mechanism', dof, node: dofs[dof - 1].node, kind: rigid ? 'rigid-body' : 'sway', nodes: moving, shape, ...(share !== undefined ? { ratio: share } : {}), count };
}

/** Whether a displacement field (one entry per DOF) is a rigid-body motion of the whole structure: a translation and a small rotation, to RIGID of its size. */
export function isRigidMotion(field: readonly number[], nodes: { x: number; y: number }[], extent: number, nd: number): boolean {
  const n = nodes.length;
  const scale = Math.max(extent, 1e-300);
  const total = field.length;
  const dot = (a: readonly number[], b: readonly number[]) => a.reduce((s, x, i) => s + x * b[i], 0);
  const g: number[][] = [new Array<number>(total).fill(0), new Array<number>(total).fill(0), new Array<number>(total).fill(0)];
  for (let q = 0; q < n; q++) {
    g[0][nd * q] = 1;
    g[1][nd * q + 1] = 1;
    g[2][nd * q] = neg(nodes[q].y);
    g[2][nd * q + 1] = nodes[q].x;
    if (nd === 3) g[2][nd * q + 2] = 1;
  }
  // The rotation DOFs are compared in length units: the field's rotation times the size; the basis' rotation entry (1 radian) the same.
  const weight = (d: number) => (nd === 3 && d % 3 === 2 ? scale : 1);
  const w = (vec: readonly number[]) => vec.map((x, d) => x * weight(d));
  const basis: number[][] = [];
  for (const b of g) {
    let r = w(b);
    for (const e of basis) {
      const c = dot(r, e);
      r = r.map((x, i) => x - c * e[i]);
    }
    const len = Math.sqrt(dot(r, r));
    if (len > AGREE * Math.sqrt(dot(w(b), w(b)))) basis.push(r.map((x) => x / len));
  }
  let rest = w(field);
  const whole = Math.sqrt(dot(rest, rest));
  for (const e of basis) {
    const c = dot(rest, e);
    rest = rest.map((x, i) => x - c * e[i]);
  }
  return Math.sqrt(dot(rest, rest)) <= RIGID * whole;
}

/* ── Totality ─────────────────────────────────────────────────────────── */

function blockFinite(b: Block): boolean {
  if (b.type === 'scalar') return Number.isFinite(b.value) && (b.symbolic === undefined || typeof b.symbolic === 'string');
  if (b.type === 'vector') return b.values.every(Number.isFinite);
  return b.values.every((r) => r.every(Number.isFinite)) && (b.factorValue === undefined || Number.isFinite(b.factorValue));
}

function everythingFinite(s: Solution): boolean {
  if (!s.u.every(Number.isFinite) || !s.P.every(Number.isFinite) || !s.uError.every(Number.isFinite) || !Number.isFinite(s.accuracy)) return false;
  if (!s.K.every((r) => r.every(Number.isFinite))) return false;
  if (!s.reactions.every((r) => Number.isFinite(r.value))) return false;
  if (!Number.isFinite(s.scale) || !Number.isFinite(s.size)) return false;
  for (const f of s.forces) {
    if (![...f.f, ...f.uGlobal, ...f.uLocal, ...f.floor, f.start.N, f.start.V, f.start.M, f.end.N, f.end.V, f.end.M].every(Number.isFinite)) return false;
    if (f.bar && ![f.bar.N, f.bar.stress, f.bar.elongation].every(Number.isFinite)) return false;
  }
  for (const m of s.members) if (![m.length, m.c, m.s, m.angle, m.E, m.A].every(Number.isFinite)) return false;
  for (const st of s.steps) for (const b of st.blocks) if (!blockFinite(b)) return false;
  for (const c of s.checks) if (!Number.isFinite(c.value) || !Number.isFinite(c.scale) || !Number.isFinite(c.allowance)) return false;
  return true;
}

