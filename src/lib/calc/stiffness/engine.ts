import { dot, jacobiEigen, matMul, matVec, maxAbs, transpose, zeros, type Mat } from './linalg';
import {
  AGREE,
  ASSEMBLY,
  EPSILON,
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
 * STABILITY. A structure is stable (to first order) exactly when K_FF is positive definite. The elimination finds out, and it does so
 * against the ROUNDING of the arithmetic and not against the stiffness a DOF started with (a stable structure with a very stiff member has a
 * pivot that is a millionth of its starting diagonal, and is not a mechanism): beside every entry it carries the largest error the arithmetic could
 * have put in it. A pivot that error reaches RESOLVE of is zero for the arithmetic. The movement it allows (the pivot's DOF set to 1, the rows
 * already eliminated solved for the rest: the null mode) is then tried on every member: if none is strained (STRAIN) the structure is a 'mechanism',
 * a rigid-body motion of the whole if it fits a translation and a rotation of the whole to RIGID, a 'sway' otherwise; if a member is strained the
 * structure is, as far as the movement can be found, stable and only too badly scaled for the arithmetic ('stiffness-range': the tool does not say
 * that it is NOT a mechanism: beside a very stiff member the movement of a mechanism is mixed by rounding with a stable movement next to it,
 * and the mixture strains the soft members). A pivot whose error reaches WEAK of it is solved with a
 * warning that says how many figures to trust. A structure with fewer than 3 restrained DOFs is refused first ('few-supports') and the elimination
 * is not tried.
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
const copyMat = (a: Mat): Mat => a.map((r) => r.slice());

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
  const a = EA / L;
  if (mode === 'truss') {
    return [
      [a, neg(a)],
      [neg(a), a],
    ];
  }
  const b = (12 * EI) / (L * L * L);
  const c = (6 * EI) / (L * L);
  const d = (4 * EI) / L;
  const e = (2 * EI) / L;
  const k = zeros(6);
  k[0][0] = a;
  k[0][3] = neg(a);
  k[3][0] = neg(a);
  k[3][3] = a;
  k[1][1] = b;
  k[1][2] = c;
  k[1][4] = neg(b);
  k[1][5] = c;
  k[2][1] = c;
  k[2][2] = d;
  k[2][4] = neg(c);
  k[2][5] = e;
  k[4][1] = neg(b);
  k[4][2] = neg(c);
  k[4][4] = b;
  k[4][5] = neg(c);
  k[5][1] = c;
  k[5][2] = e;
  k[5][4] = neg(c);
  k[5][5] = d;
  return k;
}

/** The transformation u_local = T·u_global. A bar: the 2 × 4 [[c, s, 0, 0], [0, 0, c, s]]. A beam-column: the 6 × 6 block-diagonal of [[c, s, 0], [−s, c, 0], [0, 0, 1]]. */
export function transformation(mode: Mode, c: number, s: number): Mat {
  if (mode === 'truss') {
    return [
      [c, s, 0, 0],
      [0, 0, c, s],
    ];
  }
  const T = zeros(6);
  for (const o of [0, 3]) {
    T[o][o] = c;
    T[o][o + 1] = s;
    T[o + 1][o] = neg(s);
    T[o + 1][o + 1] = c;
    T[o + 2][o + 2] = 1;
  }
  return T;
}

/** The fixed-end forces of one member load: what the clamps exert on the member with both ends held (local axes, [Fx_i, Fy_i, M_i, Fx_j, Fy_j, M_j]). */
export function fixedEndForces(load: { kind: 'udl'; w: number } | { kind: 'point'; a: number; P: number } | { kind: 'axial'; q: number }, L: number): number[] {
  switch (load.kind) {
    case 'udl': {
      const { w } = load;
      return [0, neg((w * L) / 2), neg((w * L * L) / 12), 0, neg((w * L) / 2), (w * L * L) / 12];
    }
    case 'point': {
      const { a, P } = load;
      const b = L - a;
      return [0, neg((P * b * b * (3 * a + b)) / (L * L * L)), neg((P * a * b * b) / (L * L)), 0, neg((P * a * a * (a + 3 * b)) / (L * L * L)), (P * a * a * b) / (L * L)];
    }
    default: {
      const { q } = load;
      return [neg((q * L) / 2), 0, 0, neg((q * L) / 2), 0, 0];
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
    for (const f of frame ? (['dx', 'dy', 'dr'] as const) : (['dx', 'dy'] as const)) if (given(s[f]) && !isNum(s[f])) bad('supports', k, f);
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
  rows: Mat;
}

interface Eliminated {
  /** Set when a pivot is zero for the arithmetic. */
  stuck: Stuck | null;
  /** Set when a number stopped being finite. */
  overflow: boolean;
  u: number[];
  /** The augmented matrix after the last forward pass (upper triangular). */
  aug: Mat;
  /** The largest share of a pivot that its rounding could be (error over size), and where (0-based among the free DOFs). */
  weakest: { share: number; at: number };
}

/**
 * Gaussian elimination without row exchanges on the augmented matrix [A | b], calling `onPass` after each forward pass and `onBack`
 * after each unknown. It carries beside every entry the largest error the arithmetic could have put in it (`errA`, `errB` are the errors of the
 * matrix and of the right-hand side as given): the entry's own rounding, the errors of the entries it is made of, and the error of the multiplier
 * that scales them. A pivot whose error reaches RESOLVE of it (or that is not above zero) is zero for the arithmetic: the elimination stops
 * there. An entry no larger than its own error is exactly 0 (it cannot be told from rounding): the narrated elimination prints the numbers it computed.
 */
function eliminate(
  A: Mat,
  b: number[],
  errA: Mat,
  errB: number[],
  hooks: {
    pass?: (k: number, pivot: number, multipliers: number[], aug: Mat, changed: [number, number][], eliminated: number[]) => void;
    back?: (k: number, value: number, known: number[], u: number[]) => void;
  },
): Eliminated {
  const n = b.length;
  const aug: Mat = A.map((row, i) => [...row, b[i]]);
  const err: Mat = errA.map((row, i) => [...row, errB[i]]);
  const weakest = { share: 0, at: 0 };
  for (let k = 0; k < n; k++) {
    const pivot = aug[k][k];
    const e = err[k][k];
    if (!Number.isFinite(pivot) || !Number.isFinite(e)) return { stuck: null, overflow: true, u: [], aug: [], weakest };
    if (!(pivot > 0) || !(pivot * RESOLVE > e)) return { stuck: { at: k, pivot, rounding: e, rows: copyMat(aug) }, overflow: false, u: [], aug: [], weakest };
    if (e / pivot > weakest.share) {
      weakest.share = e / pivot;
      weakest.at = k;
    }
    if (k === n - 1) break;
    const multipliers: number[] = [];
    const changed: [number, number][] = [];
    const eliminated: number[] = [];
    for (let i = k + 1; i < n; i++) {
      const l = aug[i][k] / pivot;
      // the error of the multiplier: that of its numerator, that of the pivot (scaled by the multiplier itself), and its own rounding
      const el = (err[i][k] + Math.abs(l) * e) / pivot + EPSILON * Math.abs(l);
      multipliers.push(l);
      if (l !== 0) eliminated.push(i);
      for (let j = k + 1; j <= n; j++) {
        const akj = aug[k][j];
        const before = aug[i][j];
        let v = before;
        err[i][j] += Math.abs(l) * err[k][j] + Math.abs(akj) * el;
        if (l !== 0 && akj !== 0) {
          const product = l * akj;
          v = before - product;
          err[i][j] += EPSILON * (Math.abs(product) + Math.abs(v));
        }
        if (v !== 0 && Math.abs(v) <= err[i][j]) v = 0;
        if (v !== before) changed.push([i, j]);
        aug[i][j] = v;
      }
      aug[i][k] = 0;
    }
    hooks.pass?.(k, pivot, multipliers, aug, changed, eliminated);
  }
  const u = new Array<number>(n).fill(0);
  for (let k = n - 1; k >= 0; k--) {
    let s = aug[k][n];
    for (let j = k + 1; j < n; j++) s -= aug[k][j] * u[j];
    u[k] = s / aug[k][k];
    hooks.back?.(k, u[k], u.slice(k), u);
  }
  if (!u.every(Number.isFinite)) return { stuck: null, overflow: true, u: [], aug: [], weakest };
  return { stuck: null, overflow: false, u, aug, weakest };
}

/* ── The run ──────────────────────────────────────────────────────────── */

/**
 * The criterion of 'ill-conditioned', in one place: the answer is refused when the largest residual of the solved equations, against the size of its own
 * equation, is above RESIDUAL (`worstRatio`), or when any check of step 14 fails: a sum of loads and reactions, a joint, the energy identity or the
 * residual of K u = P + R above RESIDUAL of its scale. Returns the issue, with the largest relative departure, or null.
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

const fail = (issues: Issue[], steps: Step[] = []): Failure => ({ ok: false, issues, steps });

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
  const size = Math.hypot(x1 - x0, y1 - y0);
  const about = { x: (x0 + x1) / 2, y: (y0 + y1) / 2 };

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
    for (let a = 0; a < nn; a++) for (let b = a + 1; b < nn; b++) if (Math.hypot(nodes[a].x - nodes[b].x, nodes[a].y - nodes[b].y) <= NEAR * size) parent[root(a)] = root(b);
    const groups = new Map<number, number[]>();
    for (let k = 0; k < nn; k++) groups.set(root(k), [...(groups.get(root(k)) ?? []), k]);
    for (const g of groups.values()) {
      if (g.length < 2) continue;
      let distance = 0;
      for (const a of g) for (const b of g) distance = Math.max(distance, Math.hypot(nodes[a].x - nodes[b].x, nodes[a].y - nodes[b].y));
      found.push({ code: 'duplicate-node', nodes: g.map((k) => k + 1), distance, size });
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
    else if (L > NEAR * size && L < SHORT * size) found.push({ code: 'short-member', where: { list: 'members', index: k }, members: [k + 1], length: L, size });
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
  const kLocal: Mat[] = [];
  const TMat: Mat[] = [];
  const KeMat: Mat[] = [];
  // The largest error the arithmetic could have put in each entry of K_e: ASSEMBLY roundings of the sum of the sizes of the terms that made it.
  const KeErr: Mat[] = [];
  members.forEach((m, k) => {
    const a = nodes[m.i];
    const b = nodes[m.j];
    // (+ 0: a coordinate typed as −0 is a plain zero, and so is a difference of two)
    const dx = b.x - a.x + 0;
    const dy = b.y - a.y + 0;
    const L = Math.hypot(dx, dy);
    const c = dx / L + 0;
    const s = dy / L + 0;
    let angle = (Math.atan2(dy, dx) * 180) / Math.PI;
    if (c === 0 || s === 0) angle = c === 0 ? (s > 0 ? 90 : -90) : c > 0 ? 0 : 180;
    const sec = sections[k];
    const code = [...dofsOfNode(m.i + 1, mode), ...dofsOfNode(m.j + 1, mode)];
    solvedMembers.push({
      label: k + 1,
      i: m.i + 1,
      j: m.j + 1,
      length: L,
      c,
      s,
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
    const EA = sm.E * sm.A;
    const EI = (sm.I ?? 0) * sm.E;
    add(
      'geometry',
      2,
      k + 1,
      scope(k),
      ['structure'],
      { member: k + 1, i: sm.i, j: sm.j },
      ['dx = x_j − x_i', 'dy = y_j − y_i', 'L = √(dx² + dy²)', 'c = cosθ = dx/L', 's = sinθ = dy/L', 'c² + s² = 1'],
      [
        sca('dx', nodes[members[k].j].x - nodes[members[k].i].x + 0, 'x_j − x_i'),
        sca('dy', nodes[members[k].j].y - nodes[members[k].i].y + 0, 'y_j − y_i'),
        sca('L', sm.length, '√(dx² + dy²)'),
        sca('c', sm.c, 'dx/L'),
        sca('s', sm.s, 'dy/L'),
        sca('θ', sm.angle),
        sca('E', sm.E),
        sca('A', sm.A),
        ...(frame ? [sca('I', sm.I as number)] : []),
        sca('EA', EA, 'E·A'),
        ...(frame ? [sca('EI', EI, 'E·I')] : []),
      ],
    );
  });
  solvedMembers.forEach((sm, k) => {
    const EA = sm.E * sm.A;
    const EI = (sm.I ?? 0) * sm.E;
    const kk = localStiffness(mode, EA, EI, sm.length);
    kLocal.push(kk);
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
      row.forEach((v, q) => {
        if (sym[r][q] === '0') return;
        highlights.push({ row: r, col: q, reason: sym[r][q].includes('EI') ? 'bending' : 'axial' });
      }),
    );
    add(
      'local-stiffness',
      3,
      k + 1,
      scope(k),
      [geometryKey(k)],
      { member: k + 1, size: kk.length },
      frame ? ['EA/L', '12EI/L³', '6EI/L²', '4EI/L', '2EI/L', 'k·u_local = f_local'] : ['k = (EA/L)·[1 −1; −1 1]', 'k·u_local = f_local'],
      [
        mat('k', sm.localLabels, sm.localLabels, kk, { symbolic: sym, highlights }),
        sca('EA/L', EA / sm.length, 'EA/L'),
        ...(frame
          ? [
              sca('12EI/L³', (12 * EI) / (sm.length * sm.length * sm.length), '12EI/L³'),
              sca('6EI/L²', (6 * EI) / (sm.length * sm.length), '6EI/L²'),
              sca('4EI/L', (4 * EI) / sm.length, '4EI/L'),
              sca('2EI/L', (2 * EI) / sm.length, '2EI/L'),
            ]
          : []),
      ],
    );
  });
  solvedMembers.forEach((sm, k) => {
    const T = transformation(mode, sm.c, sm.s);
    TMat.push(T);
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
      [mat('T', sm.localLabels, sm.codeLabels, T, { symbolic: symT }), sca('c', sm.c), sca('s', sm.s)],
    );
  });
  solvedMembers.forEach((sm, k) => {
    const T = TMat[k];
    const kk = kLocal[k];
    const kT = matMul(kk, T);
    const Ke = matMul(transpose(T), kT);
    KeMat.push(Ke);
    KeErr.push(matMul(transpose(T.map((r) => r.map(Math.abs))), kT.map((r) => r.map(Math.abs))).map((r) => r.map((v) => ASSEMBLY * EPSILON * v)));
    const blocks: Block[] = [
      mat('kT', sm.localLabels, sm.codeLabels, kT),
      mat('K_e', sm.codeLabels, sm.codeLabels, Ke),
      vec('code', sm.codeLabels, sm.code),
    ];
    const facts: Step['facts'] = { member: k + 1 };
    const formulas = ['K_e = T^T·k·T', 'code = [DOF(i), DOF(j)]'];
    if (!frame) {
      const f = (sm.E * sm.A) / sm.length;
      const { c, s } = sm;
      const closed = [
        [f * (c * c), f * (c * s), neg(f * (c * c)), neg(f * (c * s))],
        [f * (c * s), f * (s * s), neg(f * (c * s)), neg(f * (s * s))],
        [neg(f * (c * c)), neg(f * (c * s)), f * (c * c), f * (c * s)],
        [neg(f * (c * s)), neg(f * (s * s)), f * (c * s), f * (s * s)],
      ];
      let diff = 0;
      let top = 0;
      closed.forEach((row, r) =>
        row.forEach((v, q) => {
          diff = Math.max(diff, Math.abs(v - Ke[r][q]));
          top = Math.max(top, Math.abs(v));
        }),
      );
      facts.difference = diff;
      facts.agree = diff <= AGREE * top;
      formulas.push('K_e = (EA/L)·[c² cs −c² −cs; cs s² −cs −s²; −c² −cs c² cs; −cs −s² cs s²]');
      blocks.push(
        mat('K_e_closed', sm.codeLabels, sm.codeLabels, closed, {
          symbolic: [
            ['c²', 'cs', '−c²', '−cs'],
            ['cs', 's²', '−cs', '−s²'],
            ['−c²', '−cs', 'c²', 'cs'],
            ['−cs', '−s²', 'cs', 's²'],
          ],
          factor: 'EA/L',
          factorValue: f,
        }),
      );
    }
    add('global-member', 5, k + 1, scope(k), [`local-stiffness#${k + 1}`, `transformation#${k + 1}`], facts, formulas, blocks);
  });

  /* 6 — the assembly, member by member. */
  const K = zeros(N);
  // With K, the largest error the arithmetic could have put in each entry. An entry no larger than its error is exactly 0 in K: a sum of terms that
  // cancel (c·s of two members) leaves rounding, and rounding is not a stiffness. What is printed is what the elimination is given.
  const errK = zeros(N);
  const contributors: number[][][] = Array.from({ length: N }, () => Array.from({ length: N }, () => [] as number[]));
  solvedMembers.forEach((sm, k) => {
    const Ke = KeMat[k];
    const contribution = zeros(N);
    const positions: Highlight[] = [];
    sm.code.forEach((da, pa) =>
      sm.code.forEach((db, pb) => {
        contribution[da - 1][db - 1] = Ke[pa][pb];
        const sum = K[da - 1][db - 1] + Ke[pa][pb];
        errK[da - 1][db - 1] += KeErr[k][pa][pb] + EPSILON * Math.abs(sum);
        K[da - 1][db - 1] = Math.abs(sum) <= errK[da - 1][db - 1] ? 0 : sum;
        contributors[da - 1][db - 1].push(k + 1);
        positions.push({ row: da - 1, col: db - 1, reason: 'position' });
      }),
    );
    const running = copyMat(K);
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
  if (!K.every((row) => row.every(Number.isFinite))) return fail([{ code: 'size' }], steps);
  let asymmetry = 0;
  let kMax = 0;
  for (let a = 0; a < N; a++)
    for (let b = 0; b < N; b++) {
      asymmetry = Math.max(asymmetry, Math.abs(K[a][b] - K[b][a]));
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
  const Pnodal = new Array<number>(N).fill(0);
  // The largest error the arithmetic could have put in each entry of P (the rounding of the sums of the loads, and of the equivalent loads).
  const errP = new Array<number>(N).fill(0);
  for (const l of p.loads) {
    Pnodal[nd * l.node] += l.fx;
    Pnodal[nd * l.node + 1] += l.fy;
    errP[nd * l.node] += EPSILON * Math.abs(l.fx);
    errP[nd * l.node + 1] += EPSILON * Math.abs(l.fy);
    if (frame) {
      Pnodal[nd * l.node + 2] += l.m;
      errP[nd * l.node + 2] += EPSILON * Math.abs(l.m);
    }
  }
  add('nodal-loads', 7, null, { kind: 'structure' }, ['structure'], { loads: p.loads.length }, ['P_nodal(d) = ΣF(d)'], [vec('P_nodal', dofLabels, Pnodal)]);

  const Pequiv = new Array<number>(N).fill(0);
  const fixedEnd: (number[] | null)[] = members.map(() => null);
  if (frame) {
    members.forEach((_, k) => {
      const mine = p.memberLoads.map((l, idx) => ({ l, idx })).filter(({ l }) => l.member === k);
      if (mine.length === 0) return;
      const sm = solvedMembers[k];
      const L = sm.length;
      const blocks: Block[] = [sca('L', L)];
      const formulas: string[] = [];
      let total = [0, 0, 0, 0, 0, 0];
      for (const { l, idx } of mine) {
        const tag = `${l.kind}#${idx + 1}`;
        let fe: number[];
        let sym: string[];
        if (l.kind === 'udl') {
          fe = fixedEndForces({ kind: 'udl', w: l.w }, L);
          sym = ['0', '−wL/2', '−wL²/12', '0', '−wL/2', 'wL²/12'];
          formulas.push('wL/2', 'wL²/12');
          blocks.push(sca('w', l.w, undefined, tag));
        } else if (l.kind === 'point') {
          fe = fixedEndForces({ kind: 'point', a: l.a, P: l.P }, L);
          sym = ['0', '−Pb²(3a+b)/L³', '−Pab²/L²', '0', '−Pa²(a+3b)/L³', 'Pa²b/L²'];
          formulas.push('b = L − a', 'Pb²(3a+b)/L³', 'Pab²/L²', 'Pa²(a+3b)/L³', 'Pa²b/L²');
          blocks.push(sca('P', l.P, undefined, tag), sca('a', l.a, undefined, tag), sca('b', L - l.a, 'L − a', tag));
        } else {
          fe = fixedEndForces({ kind: 'axial', q: l.q }, L);
          sym = ['−qL/2', '0', '0', '−qL/2', '0', '0'];
          formulas.push('qL/2');
          blocks.push(sca('q', l.q, undefined, tag));
        }
        blocks.push(vec('f_FE', sm.localLabels, fe, { symbolic: sym, tag }));
        total = total.map((v, q) => v + fe[q]);
      }
      fixedEnd[k] = total;
      const T = TMat[k];
      const global = matVec(transpose(T), total);
      const equivalent = global.map(neg);
      sm.code.forEach((d, q) => {
        Pequiv[d - 1] += equivalent[q];
        errP[d - 1] += ASSEMBLY * EPSILON * Math.abs(equivalent[q]);
      });
      blocks.push(
        vec('f_FE', sm.localLabels, total, { tag: 'total' }),
        vec('f_FE_global', sm.codeLabels, global),
        vec('equivalent', sm.codeLabels, equivalent),
      );
      add('member-loads', 7, k + 1, scope(k), [`geometry#${k + 1}`, `transformation#${k + 1}`], { member: k + 1, loads: mine.length }, [...formulas.filter((f, q) => formulas.indexOf(f) === q), 'f_FE_global = T^T·f_FE', 'equivalent = −f_FE_global'], blocks);
    });
  }
  const P = Pnodal.map((v, d) => v + Pequiv[d]);
  add(
    'load-vector',
    7,
    null,
    { kind: 'structure' },
    ['nodal-loads', ...members.flatMap((_, k) => (fixedEnd[k] ? [`member-loads#${k + 1}`] : []))],
    { loadedMembers: fixedEnd.filter((f) => f !== null).length },
    frame ? ['P = P_nodal + P_equivalent'] : ['P = P_nodal'],
    [...(frame ? [vec('P_nodal', dofLabels, Pnodal), vec('P_equivalent', dofLabels, Pequiv)] : []), vec('P', dofLabels, P)],
  );
  if (!P.every(Number.isFinite)) return fail([{ code: 'size' }], steps);

  /* 8 — the partition. */
  const pick = (rows: number[], cols: number[]): Mat => rows.map((r) => cols.map((c) => K[r - 1][c - 1]));
  const KFF = pick(free, free);
  const KFR = pick(free, restrained);
  const KRF = pick(restrained, free);
  const KRR = pick(restrained, restrained);
  const PF = free.map((d) => P[d - 1]);
  const PR = restrained.map((d) => P[d - 1]);
  const uR = restrained.map((d) => prescribed[d - 1]);
  add(
    'partition',
    8,
    null,
    { kind: 'structure' },
    ['assembled', 'load-vector', 'structure'],
    { free: nF, restrained: nR },
    ['K = [K_FF K_FR; K_RF K_RR]', 'P = [P_F; P_R]', 'u = [u_F; u_R]'],
    [
      mat('K_FF', freeLabels, freeLabels, KFF),
      mat('K_FR', freeLabels, restrainedLabels, KFR),
      mat('K_RF', restrainedLabels, freeLabels, KRF),
      mat('K_RR', restrainedLabels, restrainedLabels, KRR),
      vec('P_F', freeLabels, PF),
      vec('P_R', restrainedLabels, PR),
      vec('u_R', restrainedLabels, uR, { highlights: uR.flatMap((v, k) => (v !== 0 ? [{ index: k, reason: 'prescribed' as const }] : [])) }),
    ],
  );

  /* 9 — the reduced equation. */
  const KFRuR = matVec(KFR, uR);
  // The right-hand side, and the largest error the arithmetic could have put in each entry of it. One no larger than its error is exactly 0
  // (a settlement that strains nothing leaves rounding there, and rounding is not a load).
  const errF = free.map((d) => errP[d - 1]);
  const errRhs = PF.map((v, k) => errF[k] + EPSILON * (Math.abs(v) + KFR[k].reduce((s, x, j) => s + Math.abs(x * uR[j]), 0)) + restrained.reduce((s, r, j) => s + errK[free[k] - 1][r - 1] * Math.abs(uR[j]), 0));
  const rhs = PF.map((v, k) => {
    const value = v - KFRuR[k];
    return Math.abs(value) <= errRhs[k] ? 0 : value;
  });
  add(
    'reduced',
    9,
    null,
    { kind: 'structure' },
    ['partition'],
    { free: nF, settles: uR.some((v) => v !== 0) },
    ['K_FF·u_F = P_F − K_FR·u_R'],
    [vec('P_F', freeLabels, PF), vec('K_FR·u_R', freeLabels, KFRuR), vec('rhs', freeLabels, rhs)],
  );

  /* 10 — the elimination. */
  const record = nF <= RECORD_LIMIT;
  const augLabels = [...freeLabels, 'rhs'];
  const augOf = (aug: Mat): Mat => aug.map((r) => r.slice());
  if (record && nF > 0) {
    const aug0: Mat = KFF.map((row, i) => [...row, rhs[i]]);
    add('augmented', 10, null, { kind: 'structure' }, ['reduced', 'partition'], { size: nF }, ['[K_FF | rhs]'], [mat('augmented', freeLabels, augLabels, aug0)]);
  }
  const backTemp: { k: number; value: number; known: number[] }[] = [];
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
        { pass: k + 1, pivotDof: free[k], pivot, rows: nF - k - 1 },
        ['l_ik = a_ik/a_kk', 'a_ij ← a_ij − l_ik·a_kj'],
        [
          sca('pivot', pivot, 'a_kk', `pass#${k + 1}`),
          vec('multipliers', freeLabels.slice(k + 1), multipliers, { symbolic: multipliers.map(() => 'a_ik/a_kk'), tag: `pass#${k + 1}` }),
          mat('augmented', freeLabels, augLabels, augOf(aug), { highlights, tag: `pass#${k + 1}` }),
        ],
      );
    },
    back: (k, value, known) => {
      backTemp.push({ k, value, known });
    },
  });
  if (out.overflow) return fail([{ code: 'size' }], steps);
  if (out.stuck) {
    const stuck = out.stuck;
    const verdict = mechanismOf(stuck, KFF, free, dofs, nodes, size, mode, N, solvedMembers);
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
          mat('augmented', freeLabels, augLabels, augOf(stuck.rows), { highlights: [{ row: k, col: k, reason: 'zero-pivot' }], tag: `pass#${k + 1}` }),
        ],
      );
    }
    return fail([verdict], steps);
  }
  const uF = out.u;
  if (record) {
    // The back-substitution as recorded: the last unknown first.
    backTemp.forEach((entry, q) => {
      const k = entry.k;
      const known = freeLabels.slice(k);
      add(
        'back-substitution',
        10,
        q + 1,
        { kind: 'structure' },
        [q > 0 ? `back-substitution#${q}` : nF > 1 ? `forward-pass#${nF - 1}` : 'augmented'],
        { unknown: k + 1, dof: free[k], value: entry.value },
        ['u_k = (b_k − Σ a_kj·u_j)/a_kk'],
        [sca('pivot', out.aug[k][k], 'a_kk', `unknown#${k + 1}`), vec('u', known, entry.known, { tag: `unknown#${k + 1}` })],
      );
    });
  }
  // The residual: the worst equation, componentwise.
  const residualVector = matVec(KFF, uF).map((v, k) => v - rhs[k]);
  let worstRatio = 0;
  let worstIndex = 0;
  let worstSize = 0;
  let equationScale = 0;
  residualVector.forEach((r, i) => {
    let sz = Math.abs(rhs[i]);
    for (let j = 0; j < nF; j++) sz += Math.abs(KFF[i][j] * uF[j]);
    equationScale = Math.max(equationScale, sz);
    const ratio = sz > 0 ? Math.abs(r) / sz : Math.abs(r) > 0 ? Infinity : 0;
    if (ratio > worstRatio || (ratio === worstRatio && Math.abs(r) > Math.abs(residualVector[worstIndex]))) {
      worstRatio = ratio;
      worstIndex = i;
      worstSize = sz;
    }
  });
  // `max|residual|` is the largest residual of any equation; the check 'solve' is about the equation whose residual is largest against its own size.
  const maxResidual = Math.max(0, ...residualVector.map(Math.abs));
  const worstResidual = nF > 0 ? Math.abs(residualVector[worstIndex]) : 0;
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
  const u = dofs.map((d) => (d.free === null ? d.prescribed : uF[d.free - 1]));
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

  /* 12 — the reactions. */
  const KRFuF = matVec(KRF, uF);
  const KRRuR = matVec(KRR, uR);
  const R = restrained.map((_, k) => KRFuF[k] + KRRuR[k] - PR[k]);
  add(
    'reactions',
    12,
    null,
    { kind: 'structure' },
    ['partition', 'solution'],
    { restrained: nR },
    ['R = K_RF·u_F + K_RR·u_R − P_R'],
    [vec('K_RF·u_F', restrainedLabels, KRFuF), vec('K_RR·u_R', restrainedLabels, KRRuR), vec('P_R', restrainedLabels, PR), vec('R', restrainedLabels, R)],
  );
  const reactions: ReactionEntry[] = restrained.map((d, k) => ({ dof: d, label: dofLabels[d - 1], node: dofs[d - 1].node, kind: dofs[d - 1].kind, value: R[k] }));

  /* 13 — the member end forces. */
  const forces: MemberForces[] = [];
  solvedMembers.forEach((sm, k) => {
    const T = TMat[k];
    const kk = kLocal[k];
    const uGlobal = sm.code.map((d) => u[d - 1]);
    const uLocal = matVec(T, uGlobal);
    const fk = matVec(kk, uLocal);
    const fe = fixedEnd[k];
    const f = fe ? fk.map((v, q) => v + fe[q]) : fk.slice();
    const blocks: Block[] = [vec('u_e', sm.codeLabels, uGlobal), vec('u_local', sm.localLabels, uLocal), vec('k·u_local', sm.localLabels, fk)];
    let start: MemberForces['start'];
    let end: MemberForces['end'];
    let bar: MemberForces['bar'] = null;
    const facts: Step['facts'] = { member: k + 1 };
    const formulas: string[] = ['u_e = u(code)', 'u_local = T·u_e'];
    if (frame) {
      if (fe) blocks.push(vec('f_FE', sm.localLabels, fe));
      blocks.push(vec('f', sm.localLabels, f));
      start = { N: neg(f[0]), V: f[1] + 0, M: neg(f[2]) };
      end = { N: f[3] + 0, V: neg(f[4]), M: f[5] + 0 };
      blocks.push(
        mat('ends', ['N', 'V', 'M'], ['i', 'j'], [
          [start.N, end.N],
          [start.V, end.V],
          [start.M, end.M],
        ]),
      );
      formulas.push(fe ? 'f = k·u_local + f_FE' : 'f = k·u_local', 'N_i = −f_1', 'V_i = f_2', 'M_i = −f_3', 'N_j = f_4', 'V_j = −f_5', 'M_j = f_6');
    } else {
      const N = f[1] + 0;
      const elongation = uLocal[1] - uLocal[0];
      const stress = N / sm.A;
      start = { N: neg(f[0]), V: 0, M: 0 };
      end = { N, V: 0, M: 0 };
      bar = { N, stress, elongation };
      blocks.push(vec('f', sm.localLabels, f), sca('N', N, 'f_2'), sca('σ', stress, 'N/A'), sca('δ', elongation, 'u_j − u_i'));
      formulas.push('f = k·u_local', 'N = f_2 = (EA/L)(u_j − u_i)', 'σ = N/A', 'δ = u_j − u_i');
    }
    // What rounding could have put into each component of f: the terms k·u that were added up to make it (a stiff member beside soft ones adds terms far larger
    // than its force), and the fixed-end force. Measured against the whole structure's loads instead, a member much stiffer than the rest would lose real forces.
    const floor = f.map((_, q) => 8 * Number.EPSILON * (kk[q].reduce((sum, v, j) => sum + Math.abs(v * uLocal[j]), 0) + (fe ? Math.abs(fe[q]) : 0)));
    forces.push({ member: k + 1, uGlobal, uLocal, f, fixedEnd: fe, start, end, bar, floor });
    add('end-forces', 13, k + 1, scope(k), [`local-stiffness#${k + 1}`, `transformation#${k + 1}`, 'displacements', ...(fe ? [`member-loads#${k + 1}`] : [])], facts, formulas, blocks);
  });

  /* 14 — the checks. */
  let loadScale = 0;
  for (const l of p.loads) loadScale += Math.abs(l.fx) + Math.abs(l.fy) + (frame ? Math.abs(l.m) / Math.max(size, 1e-300) : 0);
  const appliedMember: { x: number; y: number; fx: number; fy: number }[] = [];
  p.memberLoads.forEach((l) => {
    const sm = solvedMembers[l.member];
    const L = sm.length;
    const a = nodes[members[l.member].i];
    let t: number;
    let flx = 0;
    let fly = 0;
    if (l.kind === 'udl') {
      fly = l.w * L;
      t = L / 2;
    } else if (l.kind === 'point') {
      fly = l.P;
      t = l.a;
    } else {
      flx = l.q * L;
      t = L / 2;
    }
    loadScale += Math.abs(flx) + Math.abs(fly);
    appliedMember.push({ x: a.x + sm.c * t, y: a.y + sm.s * t, fx: sm.c * flx - sm.s * fly, fy: sm.s * flx + sm.c * fly });
  });
  let magnitude = 0;
  restrained.forEach((d, k) => {
    magnitude = Math.max(magnitude, Math.abs(R[k]) / (dofs[d - 1].kind === 'θ' ? Math.max(size, 1e-300) : 1));
  });
  for (const fo of forces)
    fo.f.forEach((v, q) => {
      magnitude = Math.max(magnitude, Math.abs(v) / (frame && q % 3 === 2 ? Math.max(size, 1e-300) : 1));
    });
  // Global equilibrium, the loads added up from their definitions (not from the equivalent loads the solve used).
  let sumFx = 0;
  let sumFy = 0;
  let sumM = 0;
  for (const l of p.loads) {
    sumFx += l.fx;
    sumFy += l.fy;
    sumM += (nodes[l.node].x - about.x) * l.fy - (nodes[l.node].y - about.y) * l.fx + (frame ? l.m : 0);
  }
  for (const l of appliedMember) {
    sumFx += l.fx;
    sumFy += l.fy;
    sumM += (l.x - about.x) * l.fy - (l.y - about.y) * l.fx;
  }
  restrained.forEach((d, k) => {
    const dof = dofs[d - 1];
    const node = nodes[dof.node - 1];
    if (dof.kind === 'x') {
      sumFx += R[k];
      sumM -= (node.y - about.y) * R[k];
    } else if (dof.kind === 'y') {
      sumFy += R[k];
      sumM += (node.x - about.x) * R[k];
    } else sumM += R[k];
  });
  // Joint equilibrium: P_nodal + R − Σ (member end forces on the joint, global) at every DOF.
  const memberOnJoint = new Array<number>(N).fill(0);
  solvedMembers.forEach((sm, k) => {
    const fg = matVec(transpose(TMat[k]), forces[k].f);
    sm.code.forEach((d, q) => {
      memberOnJoint[d - 1] += fg[q];
    });
  });
  const Rfull = new Array<number>(N).fill(0);
  restrained.forEach((d, k) => {
    Rfull[d - 1] = R[k];
  });
  const joint = Pnodal.map((v, d) => v + Rfull[d] - memberOnJoint[d]);
  let jointWorst = 0;
  joint.forEach((v, d) => {
    jointWorst = Math.max(jointWorst, Math.abs(v) / (dofs[d].kind === 'θ' ? Math.max(size, 1e-300) : 1));
  });
  const Ku = matVec(K, u);
  // The force scale: the loads added up, or the largest reaction or end force, or — where larger — the sizes of the terms that are added up to make an
  // equation (Σ|K·u| + |P| at a DOF), which is what rounding is measured against: a settlement that strains nothing (a rigid-body motion) leaves forces that are
  // all rounding, and a rounding is not a failure beside the terms it came from.
  let terms = 0;
  u.forEach((_, d) => {
    let sz = Math.abs(P[d]);
    for (let j = 0; j < N; j++) sz += Math.abs(K[d][j] * u[j]);
    terms = Math.max(terms, dofs[d].kind === 'θ' ? sz / Math.max(size, 1e-300) : sz);
  });
  const scale = Math.max(loadScale, magnitude, terms);
  const system = Ku.map((v, d) => v - P[d] - Rfull[d]);
  let systemWorst = 0;
  system.forEach((v, d) => {
    systemWorst = Math.max(systemWorst, Math.abs(v) / (dofs[d].kind === 'θ' ? Math.max(size, 1e-300) : 1));
  });
  const U = 0.5 * dot(u, Ku);
  const uRfull = restrained.map((d) => u[d - 1]);
  const W = 0.5 * dot(u, P) + 0.5 * dot(uRfull, R);
  // What rounding is measured against: the terms of the two sums, taken in size (energy that is the difference of large terms is not small). The terms of
  // ½uᵀKu are every u_d·K_dj·u_j, not the sums of them: where a stiff member is beside soft ones the sum at a DOF is a small difference of large terms.
  let energyScale = 0;
  u.forEach((v, d) => {
    let row = 0;
    for (let j = 0; j < N; j++) row += Math.abs(K[d][j] * u[j]);
    energyScale += 0.5 * (Math.abs(v) * row + Math.abs(v * P[d]));
  });
  uRfull.forEach((v, k) => {
    energyScale += 0.5 * Math.abs(v * R[k]);
  });
  const checks: Check[] = [
    { id: 'sum-fx', value: sumFx, scale, ok: Math.abs(sumFx) <= RESIDUAL * scale },
    { id: 'sum-fy', value: sumFy, scale, ok: Math.abs(sumFy) <= RESIDUAL * scale },
    { id: 'sum-moment', value: sumM, scale: scale * Math.max(size, 1e-300), ok: Math.abs(sumM) <= RESIDUAL * scale * Math.max(size, 1e-300) },
    { id: 'joints', value: jointWorst, scale, ok: jointWorst <= RESIDUAL * scale },
    { id: 'energy', value: U - W, scale: energyScale, ok: Math.abs(U - W) <= RESIDUAL * energyScale },
    { id: 'system', value: systemWorst, scale, ok: systemWorst <= RESIDUAL * scale },
    { id: 'solve', value: worstResidual, scale: worstSize, ok: worstRatio <= RESIDUAL },
  ];
  add(
    'checks',
    14,
    null,
    { kind: 'structure' },
    ['displacements', 'reactions', ...members.map((_, k) => `end-forces#${k + 1}`), 'load-vector', 'assembled'],
    { scale, size, aboutX: about.x, aboutY: about.y, allOk: checks.every((c) => c.ok) },
    ['ΣFx = 0', 'ΣFy = 0', 'ΣM = 0', 'P_nodal + R − Σ f_global = 0', 'U = ½·u^T·K·u = ½·u^T·P + ½·u_R^T·R', 'K·u = P + R'],
    [
      sca('ΣFx', sumFx, 'ΣP_x + ΣR_x'),
      sca('ΣFy', sumFy, 'ΣP_y + ΣR_y'),
      sca('ΣM', sumM, 'ΣM(P) + ΣM(R)'),
      vec('joint', dofLabels, joint, { symbolic: dofLabels.map(() => 'P_nodal + R − Σ f_global') }),
      sca('U', U, '½·u^T·K·u'),
      sca('W', W, '½·u^T·P + ½·u_R^T·R'),
      vec('K·u − P − R', dofLabels, system),
    ],
  );
  const unbalanced = illConditioned(worstRatio, checks);
  if (unbalanced) return fail([unbalanced], steps);

  /* Warnings. */
  const zeroLoad = p.loads.every((l) => l.fx === 0 && l.fy === 0 && (!frame || l.m === 0)) && p.memberLoads.every((l) => (l.kind === 'udl' ? l.w === 0 : l.kind === 'point' ? l.P === 0 : l.q === 0)) && prescribed.every((v) => v === 0);
  if (zeroLoad) warnings.push({ code: 'no-load' });
  if (!frame && Array.isArray(model.memberLoads) && model.memberLoads.length > 0) warnings.push({ code: 'member-loads-ignored', count: model.memberLoads.length });
  if (ignoredSettlement.length > 0) warnings.push({ code: 'settlement-ignored', dofs: ignoredSettlement.sort((a, b) => a - b) });
  if (emptySupports.length > 0) warnings.push({ code: 'empty-support', nodes: emptySupports.sort((a, b) => a - b) });
  // A pivot the arithmetic guarantees to fewer than six figures (more than WEAK of it could be rounding): how many it is good to is said.
  if (out.weakest.share > WEAK) warnings.push({ code: 'near-mechanism', dofs: [free[out.weakest.at]], ratio: out.weakest.share, count: Math.max(1, Math.floor(-Math.log10(out.weakest.share))) });
  // First order only: a member whose chord turns by more than LARGE has left the theory the numbers belong to.
  const turn = largestChordTurn(solvedMembers, u);
  if (turn.angle > LARGE) warnings.push({ code: 'large-displacements', ratio: turn.angle, count: turn.member, nodes: [solvedMembers[turn.member - 1].i, solvedMembers[turn.member - 1].j] });

  const solvedNodes: SolvedNode[] = nodes.map((q, k) => ({ label: k + 1, x: q.x, y: q.y, dofs: dofsOfNode(k + 1, mode) }));
  const solution: Solution = { ok: true, mode, dofs, nodes: solvedNodes, members: solvedMembers, steps, free, restrained, u, P, K, reactions, forces, checks, size, about, scale, warnings };
  if (!everythingFinite(solution)) return fail([{ code: 'size' }], []);
  return solution;
}

/* ── A pivot the arithmetic cannot tell from zero: a mechanism or a stiffness range ─ */

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
 * What a pivot that rounding cannot tell from zero is. The movement it allows (the pivot's DOF set to 1, the rows above solved for the rest) is tried on
 * every member: what the member deforms in it (its elongation over its length and the turn of its ends beyond that of its chord) against the size of the movement the
 * member takes part in. A mechanism deforms none of them (to STRAIN); if one is strained, the structure is as far as can be found stable and the stiffnesses of it
 * differ by more than the arithmetic can hold ('stiffness-range').
 */
function mechanismOf(
  sing: { at: number; pivot: number; rounding: number; rows: Mat },
  KFF: Mat,
  free: number[],
  dofs: Dof[],
  nodes: { x: number; y: number }[],
  size: number,
  mode: Mode,
  N: number,
  members: readonly SolvedMember[],
): Issue {
  const nF = free.length;
  const k = sing.at;
  // The null mode: the singular DOF set to 1, the DOFs already eliminated from the rows of the reduced matrix.
  const v = new Array<number>(nF).fill(0);
  v[k] = 1;
  for (let i = k - 1; i >= 0; i--) {
    let s = 0;
    for (let j = i + 1; j <= k; j++) s += sing.rows[i][j] * v[j];
    v[i] = neg(s) / sing.rows[i][i];
  }
  let full = new Array<number>(N).fill(0);
  free.forEach((d, q) => {
    full[d - 1] = Number.isFinite(v[q]) ? v[q] : 0;
  });
  const dof = free[k];
  // The rounding over the pivot (absent where the pivot is not above zero: the share would be infinite).
  const share = sing.pivot > 0 ? sing.rounding / sing.pivot : undefined;
  const nd = mode === 'frame' ? 3 : 2;
  // How much each member is strained by a movement (one entry per DOF): what it deforms (its elongation over its length, and the turn of each end beyond the turn of its
  // chord - the numbers of no stiffness at all) against the size of the movement it takes part in (its largest translation over its length, or rotation). A member whose DOFs all
  // move by less than STRAIN of the largest movement (translations and rotations times the size, together) is not part of it: what it holds is the arithmetic's own noise in a
  // part that does not move. One that is part of it is taken with every DOF it has, the small ones too (the two ends of a very stiff bar, one of them under that line, are its strain).
  const reach = Math.max(size, 1e-300);
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
  // K_FF scaled to a unit diagonal: its eigenvalues count the independent motions, and its smallest eigenvector is the movement that the rows above (solved with the
  // arithmetic's errors in them) can only approximate when a very stiff member is in the structure.
  const d = KFF.map((row, i) => (row[i] > 0 ? 1 / Math.sqrt(row[i]) : 0));
  const scaled = KFF.map((row, i) => row.map((val, j) => val * d[i] * d[j]));
  const { values, vectors } = jacobiEigen(scaled);
  if (strainOf(full) > STRAIN) {
    const sharper = new Array<number>(N).fill(0);
    free.forEach((dd, q) => {
      sharper[dd - 1] = (vectors[0]?.[q] ?? 0) * d[q];
    });
    if (values[0] <= AGREE && Number.isFinite(strainOf(sharper)) && strainOf(sharper) <= STRAIN) full = sharper;
  }
  if (strainOf(full) > STRAIN) return { code: 'stiffness-range', dof, node: dofs[dof - 1].node, nodes: [dofs[dof - 1].node], ...(share !== undefined ? { ratio: share } : {}) };
  // Which nodes move: those that move at least a quarter as much as the one that moves most (a rotation counts for its size times the structure's).
  const move = nodes.map((_, n) => {
    const tx = full[nd * n];
    const ty = full[nd * n + 1];
    const r = nd === 3 ? Math.abs(full[nd * n + 2]) * Math.max(size, 1e-300) : 0;
    return Math.max(Math.hypot(tx, ty), r);
  });
  const top = Math.max(...move, 0);
  const moving = move.flatMap((m, n) => (top > 0 && m >= 0.25 * top ? [n + 1] : []));
  const rigid = isRigidMotion(full, nodes, size, nd);
  // How many independent motions: the eigenvalues of K_FF scaled to a unit diagonal that are no more than rounding.
  const count = Math.max(1, values.filter((e) => e <= AGREE).length);
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
export function isRigidMotion(field: readonly number[], nodes: { x: number; y: number }[], size: number, nd: number): boolean {
  const n = nodes.length;
  const scale = Math.max(size, 1e-300);
  const total = field.length;
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
  if (!s.u.every(Number.isFinite) || !s.P.every(Number.isFinite)) return false;
  if (!s.K.every((r) => r.every(Number.isFinite))) return false;
  if (!s.reactions.every((r) => Number.isFinite(r.value))) return false;
  if (!Number.isFinite(s.scale) || !Number.isFinite(s.size)) return false;
  for (const f of s.forces) {
    if (![...f.f, ...f.uGlobal, ...f.uLocal, f.start.N, f.start.V, f.start.M, f.end.N, f.end.V, f.end.M].every(Number.isFinite)) return false;
    if (f.bar && ![f.bar.N, f.bar.stress, f.bar.elongation].every(Number.isFinite)) return false;
  }
  for (const m of s.members) if (![m.length, m.c, m.s, m.angle, m.E, m.A].every(Number.isFinite)) return false;
  for (const st of s.steps) for (const b of st.blocks) if (!blockFinite(b)) return false;
  for (const c of s.checks) if (!Number.isFinite(c.value) || !Number.isFinite(c.scale)) return false;
  return true;
}

