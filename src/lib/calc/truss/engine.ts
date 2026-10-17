import type {
  Determinacy,
  DisplacementResult,
  Extreme,
  MemberResult,
  ReactionResult,
  TrussIssue,
  TrussModel,
  TrussOutcome,
  TrussSolution,
  TrussSupport,
  TrussWarning,
  ZeroByInspection,
} from './types';
import { MAX_LOADS, MAX_MEMBERS, MAX_NODES, MAX_SUPPORTS } from './types';

/**
 * ─────────────────────────────────────────────────────────────────────────────
 * TRUSS MEMBER FORCES — the engine: the direct stiffness method, 2D, pin joints
 * ─────────────────────────────────────────────────────────────────────────────
 * The engine of the fifth calculator of the catalogue ("Truss member forces",
 * /resources/truss-member-forces). types.ts has what goes in and what comes out: units,
 * signs, supports, and the code of every problem that is REPORTED and never
 * thrown. `solveTruss` never throws and never returns a NaN: a result is a
 * solution whose every number is finite, or a list of issues.
 *
 * THE METHOD.
 *   1. KINEMATICS. A member k from node i to node j, with unit vector e = (cx,
 *      cy) from i to j, lengthens by δ = (u_j − u_i)·e when the nodes move by u.
 *      Every node has two displacement components, EXCEPT where a support holds
 *      it: a pin holds both; a roller holds the component along its direction
 *      n = (cos a, sin a) and leaves the one along t = (−sin a, cos a). So a
 *      node's unknowns are a short list of coefficients q along orthonormal
 *      directions that the support leaves free (two for a free node, one for a
 *      roller, none for a pin), and u_node = Σ q·t. THIS IS THE ELIMINATION OF
 *      THE CONSTRAINTS, EXACT: a roller of any angle, inclined or not, is a
 *      change of basis at its node, and no penalty stiffness stands in for it.
 *      The elongations are δ = G q, with G a sparse m × (2j − r) matrix.
 *   2. STIFFNESS. A member's axial stiffness is w = E·A / L, its force N = w·δ
 *      (tension positive), and the stiffness matrix of the truss is the sum of
 *      the members' own: K = Gᵀ W G — the assembly of every member's
 *      (EA/L)·[c² cs; cs s²] blocks, written through G.
 *   3. STABILITY, BEFORE ANY SOLVE (`stability`). A truss is stable, to first
 *      order, exactly when K is positive definite. That depends only on the
 *      geometry and the supports, never on the values of E·A (every w > 0
 *      gives the same null space), so it is tested on K with every w = 1: its
 *      entries are made of direction cosines, O(1), and an absolute tolerance
 *      means something. K₁ = GᵀG is symmetric, diagonalised by Jacobi rotations
 *      (a robust method for the small, dense matrices here: at most 80 × 80),
 *      and every eigenvalue under MECH is a way for the truss to move with no
 *      member changing length. Those null vectors are named:
 *        — the ones that are a rigid motion of the whole truss (a translation
 *          or a rotation: three at most) are the supports failing to hold it:
 *          'unrestrained';
 *        — the rest are motions of part of it: 'mechanism', with the nodes
 *          that can move — those the null vectors move at all.
 *      (A truss that is plainly stable never reaches the eigenvalues: if K₁ less
 *      twice MECH is still positive definite, which a Cholesky factorisation
 *      tells in a few hundred thousand operations, its smallest eigenvalue is
 *      over 2·MECH and there is no null vector. The largest truss took 60 ms
 *      of Jacobi rotations before; it takes 4 ms of everything now.)
 *      A joint with two members on one line and nothing else is a mechanism of
 *      this kind: in a first-order analysis it has no stiffness across the
 *      line, whatever the load on it.
 *   4. THE SOLVE (`solveLinear`: scaling of rows and columns, LU with partial
 *      pivoting, and iterative refinement).
 *        — Statically DETERMINATE (m + r = 2j; G is square): the member forces
 *          are the solution of the equilibrium of the joints, Gᵀ N = f. E·A is
 *          nowhere in it, so the forces do not depend on it AT ALL, and the
 *          system's condition is the geometry's and not its square.
 *          Displacements, only if every member has E and A, are then found
 *          from G q = (N L / E A).
 *        — INDETERMINATE: K q = f, N = W G q. With every member's E and A where
 *          they are all given, and otherwise EA the same in all members (the
 *          warning 'partial-stiffness' says so when some are given). With only
 *          the areas (or only the moduli) given, to EVERY member, EA follows the
 *          one that is there (stiffness 'relative'); a factor given to some
 *          members only cannot be read as a ratio.
 *   5. REACTIONS. At a support node the force the support exerts is what
 *      balances the node: R = −(F + Σ members' force on the node) — this is
 *      K u − F at that node, written through the member forces already found.
 *      A roller's R is the part of it along n. The part along t (the free
 *      direction) is zero by the solve and is counted in `joint`, the check.
 *   6. THE CHECK. Equilibrium of the whole: ΣFx, ΣFy and ΣM about the centre of
 *      the box around the nodes, loads plus reactions, and the largest force
 *      left over at any joint. A truss is returned only if each of them is
 *      under RESIDUAL of the problem's size.
 *
 * TOLERANCES — all RELATIVE, and why.
 *   NEAR = 1e-9, of the truss's size (the diagonal of the box around its
 *     nodes). Coordinates are typed to eight figures, and sums of such
 *     coordinates are held to a rounding of a billionth: two nodes closer than
 *     that are one node typed twice.
 *   SHORT = 1e-6, of the truss's size. A member this short beside the truss
 *     has a stiffness a million times that of a typical one, and the forces of
 *     an indeterminate truss with it are not right to the figures printed. It
 *     is refused ('short-member') rather than solved badly; a determinate
 *     truss does not suffer from it, but one rule is easier to state.
 *   MECH = 1e-9 on the eigenvalues of K₁ (entries O(1); rounding of the
 *     eigenvalues is about 1e-15). A stable truss' smallest eigenvalue is a
 *     geometric quantity: a joint whose two members make an angle θ with each
 *     other's line has about θ². MEASURED (engine.test.ts builds them): the
 *     shallowest and longest trusses the templates can build, depth a hundredth
 *     of the span, have 7.7e-7 (the 19-panel cantilever), 6.6e-6 (Warren, 19
 *     panels), 7e-6 (Pratt, 18), 2e-4 (king post); the usual ones 1e-2 to 1e-1.
 *     So the line sits two to three orders under the least a template makes and
 *     six over rounding. What it refuses is a truss with members collinear to
 *     within about 3e-5 radians (a triangle one hundred-thousandth as high as it
 *     is long): unstable to every practical end.
 *   RIGID = 1e-6, on the share of a null vector that is not a rigid motion.
 *     A rigid null vector has 1e-15 of it left over; a mechanism's, which moves
 *     a few nodes, has a large share. There is a gap of nine orders.
 *   ZERO = 1e-9, of the loads' size: a force under it is rounding (so a force
 *     that is truly smaller than a billionth of the sum of the loads, loads that
 *     differ by ten orders of magnitude on one truss, reads 0: the figures
 *     printed are four, and no load case a person types has that range). MEASURED
 *     against the exact oracle (engine.test.ts, oracle.testlib.ts) on random
 *     trusses of 3 to 9 joints: the worst error of a member force, relative to
 *     the largest, is 1e-14 in a determinate truss and 5e-12 in an
 *     indeterminate one whose members' EA differ by a factor of 9. It grows
 *     with the CONTRAST between the members' stiffnesses EA/L, because K is
 *     formed from them: 2e-9 at a contrast of 1e6, 3e-7 at 1e9, 2e-6 at 1e12,
 *     5e-6 at 1e15. Sections in a real truss differ by a factor of ten or a
 *     hundred, never a million; and beyond about 1e12 some trusses are refused
 *     ('ill-conditioned') instead. A determinate truss does not suffer from it
 *     at all: its forces do not involve E·A.
 *   COLLINEAR = 1e-9 on the cross product of two unit vectors, for "these two
 *     members lie on one line" in the inspection rules.
 *   RESIDUAL = 1e-6, of the larger of the loads' size and the largest force.
 *     Far above the 1e-12 a good solve leaves, and far under anything that
 *     could be read in four figures. Past it: 'ill-conditioned'.
 *   LIMIT = 1e30 on every input number, and the sections must lie in [1e-30,
 *     1e30], so that no product in the solve can overflow.
 */

export const NEAR = 1e-9;
export const SHORT = 1e-6;
export const MECH = 1e-9;
export const RIGID = 1e-6;
export const ZERO = 1e-9;
export const COLLINEAR = 1e-9;
export const RESIDUAL = 1e-6;
export const LIMIT = 1e30;
const SECTION_LOW = 1e-30;

const finite = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v) && Math.abs(v) <= LIMIT;
const section = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v) && v >= SECTION_LOW && v <= LIMIT;
/** A zero that is rounding is exactly 0, and never −0. */
const settle = (v: number, floor: number): number => (Math.abs(v) <= floor ? 0 : v);

/** A roller's direction as a unit vector, exact at the quarter turns. */
export function directionOf(angle: number | undefined): { angle: number; c: number; s: number } {
  const raw = angle === undefined ? 90 : angle;
  let a = raw % 180;
  if (a < 0) a += 180;
  // −1e-20 % 180 + 180 is 180 in floating point: the range is [0, 180), so that is the same line as 0.
  if (a >= 180) a = 0;
  if (a === 0) return { angle: 0, c: 1, s: 0 };
  if (a === 90) return { angle: 90, c: 0, s: 1 };
  const r = (a * Math.PI) / 180;
  return { angle: a, c: Math.cos(r), s: Math.sin(r) };
}

/* ── Counting ─────────────────────────────────────────────────────────── */

/** j, m, r and m + r − 2j, from whatever the model holds: it is what the page says before the model is whole. */
export function countOf(model: Pick<TrussModel, 'nodes' | 'members' | 'supports'>): { joints: number; members: number; reactions: number; degree: number } {
  const joints = Array.isArray(model.nodes) ? model.nodes.length : 0;
  const members = Array.isArray(model.members) ? model.members.length : 0;
  let reactions = 0;
  if (Array.isArray(model.supports)) for (const s of model.supports) reactions += s && s.kind === 'pin' ? 2 : s && s.kind === 'roller' ? 1 : 0;
  return { joints, members, reactions, degree: members + reactions - 2 * joints };
}

/* ── Dense linear algebra (small matrices) ────────────────────────────── */

type Mat = number[][];

/**
 * LU with partial pivoting of a matrix scaled by rows and then by columns to
 * have 1 as its largest entry, with iterative refinement. Returns a solver, or
 * null if a pivot of the scaled matrix is under 1e-13 (the matrix is singular
 * to rounding).
 */
function factor(a: Mat): ((b: number[]) => number[]) | null {
  const n = a.length;
  const rs = new Array<number>(n);
  const cs = new Array<number>(n).fill(0);
  for (let i = 0; i < n; i++) {
    let m = 0;
    for (let j = 0; j < n; j++) m = Math.max(m, Math.abs(a[i][j]));
    if (!(m > 0) || !Number.isFinite(m)) return null;
    rs[i] = 1 / m;
  }
  for (let j = 0; j < n; j++) {
    let m = 0;
    for (let i = 0; i < n; i++) m = Math.max(m, Math.abs(a[i][j]) * rs[i]);
    if (!(m > 0)) return null;
    cs[j] = 1 / m;
  }
  const lu: Mat = a.map((row, i) => row.map((v, j) => v * rs[i] * cs[j]));
  const perm = Array.from({ length: n }, (_, i) => i);
  for (let k = 0; k < n; k++) {
    let p = k;
    for (let i = k + 1; i < n; i++) if (Math.abs(lu[i][k]) > Math.abs(lu[p][k])) p = i;
    if (!(Math.abs(lu[p][k]) >= 1e-13)) return null;
    if (p !== k) {
      [lu[p], lu[k]] = [lu[k], lu[p]];
      [perm[p], perm[k]] = [perm[k], perm[p]];
    }
    for (let i = k + 1; i < n; i++) {
      const f = lu[i][k] / lu[k][k];
      lu[i][k] = f;
      if (f !== 0) for (let j = k + 1; j < n; j++) lu[i][j] -= f * lu[k][j];
    }
  }
  const plain = (rhs: number[]): number[] => {
    const y = new Array<number>(n);
    for (let i = 0; i < n; i++) {
      let s = rhs[perm[i]] * rs[perm[i]];
      for (let j = 0; j < i; j++) s -= lu[i][j] * y[j];
      y[i] = s;
    }
    for (let i = n - 1; i >= 0; i--) {
      let s = y[i];
      for (let j = i + 1; j < n; j++) s -= lu[i][j] * y[j];
      y[i] = s / lu[i][i];
    }
    return y.map((v, j) => v * cs[j]);
  };
  return (b) => {
    let x = plain(b);
    for (let pass = 0; pass < 2; pass++) {
      const r = b.map((v, i) => {
        let s = v;
        for (let j = 0; j < n; j++) s -= a[i][j] * x[j];
        return s;
      });
      const dx = plain(r);
      x = x.map((v, j) => v + dx[j]);
    }
    return x;
  };
}

/** Solves a x = b. Null if singular. */
export function solveLinear(a: Mat, b: number[]): number[] | null {
  if (b.length === 0) return [];
  const solver = factor(a);
  if (!solver) return null;
  const x = solver(b);
  return x.every(Number.isFinite) ? x : null;
}

/**
 * Eigenvalues and eigenvectors of a symmetric matrix by cyclic Jacobi
 * rotations. `vectors[k]` is the unit eigenvector of `values[k]`.
 */
export function jacobiEigen(sym: Mat): { values: number[]; vectors: number[][] } {
  const n = sym.length;
  const a = sym.map((row) => Float64Array.from(row));
  const v = Array.from({ length: n }, (_, i) => {
    const row = new Float64Array(n);
    row[i] = 1;
    return row;
  });
  let frob = 0;
  for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) frob += a[i][j] * a[i][j];
  for (let sweep = 0; sweep < 60; sweep++) {
    let off = 0;
    for (let i = 0; i < n; i++) for (let j = i + 1; j < n; j++) off += a[i][j] * a[i][j];
    if (off <= 1e-32 * frob || off === 0) break;
    for (let p = 0; p < n - 1; p++) {
      for (let q = p + 1; q < n; q++) {
        const apq = a[p][q];
        if (apq === 0) continue;
        const theta = (a[q][q] - a[p][p]) / (2 * apq);
        const t = (theta >= 0 ? 1 : -1) / (Math.abs(theta) + Math.sqrt(theta * theta + 1));
        const c = 1 / Math.sqrt(t * t + 1);
        const s = t * c;
        for (let k = 0; k < n; k++) {
          const akp = a[k][p];
          const akq = a[k][q];
          a[k][p] = c * akp - s * akq;
          a[k][q] = s * akp + c * akq;
        }
        for (let k = 0; k < n; k++) {
          const apk = a[p][k];
          const aqk = a[q][k];
          a[p][k] = c * apk - s * aqk;
          a[q][k] = s * apk + c * aqk;
        }
        for (let k = 0; k < n; k++) {
          const vkp = v[k][p];
          const vkq = v[k][q];
          v[k][p] = c * vkp - s * vkq;
          v[k][q] = s * vkp + c * vkq;
        }
      }
    }
  }
  const values = Array.from({ length: n }, (_, i) => a[i][i]);
  const vectors = Array.from({ length: n }, (_, k) => Array.from({ length: n }, (_, i) => v[i][k]));
  return { values, vectors };
}

/** Whether `sym` less `shift` times the identity is positive definite: a Cholesky factorisation that finds every pivot over zero. */
export function positiveDefinite(sym: Mat, shift: number): boolean {
  const n = sym.length;
  const l = sym.map((row) => Float64Array.from(row));
  for (let i = 0; i < n; i++) l[i][i] -= shift;
  for (let j = 0; j < n; j++) {
    let d = l[j][j];
    for (let k = 0; k < j; k++) d -= l[j][k] * l[j][k];
    if (!(d > 0)) return false;
    const root = Math.sqrt(d);
    l[j][j] = root;
    for (let i = j + 1; i < n; i++) {
      let v = l[i][j];
      for (let k = 0; k < j; k++) v -= l[i][k] * l[j][k];
      l[i][j] = v / root;
    }
  }
  return true;
}

/* ── Zero by inspection ───────────────────────────────────────────────── */

/**
 * The members that statics alone shows to carry nothing (types.ts, ZeroRule):
 * the node must have no support and no load (loads on it add up to nothing).
 * `unit[k]` is member k's unit vector from i to j. Once a member is shown to be
 * zero it is taken away and the nodes look again.
 */
export function zeroByInspection(
  nodeCount: number,
  members: readonly { i: number; j: number }[],
  unit: readonly { cx: number; cy: number }[],
  supported: readonly boolean[],
  loaded: readonly boolean[],
): ZeroByInspection[] {
  const found = new Map<number, ZeroByInspection>();
  const at: number[][] = Array.from({ length: nodeCount }, () => []);
  members.forEach((m, k) => {
    at[m.i].push(k);
    at[m.j].push(k);
  });
  // The unit vector of member k seen from node n (pointing away from n), which a collinearity test does not need but a sign-free cross product does.
  const cross = (a: number, b: number): number => Math.abs(unit[a].cx * unit[b].cy - unit[a].cy * unit[b].cx);
  let changed = true;
  while (changed) {
    changed = false;
    for (let n = 0; n < nodeCount; n++) {
      if (supported[n] || loaded[n]) continue;
      const live = at[n].filter((k) => !found.has(k));
      const mark = (list: number[], rule: ZeroByInspection['rule']) => {
        for (const k of list) found.set(k, { member: k, node: n, rule });
        changed = true;
      };
      if (live.length === 2 && cross(live[0], live[1]) > COLLINEAR) mark(live, 'two-members');
      else if (live.length === 3) {
        const [a, b, c] = live;
        const ab = cross(a, b) <= COLLINEAR;
        const ac = cross(a, c) <= COLLINEAR;
        const bc = cross(b, c) <= COLLINEAR;
        if (ab && !ac && !bc) mark([c], 'three-members');
        else if (ac && !ab && !bc) mark([b], 'three-members');
        else if (bc && !ab && !ac) mark([a], 'three-members');
      }
    }
  }
  return [...found.values()].sort((p, q) => p.member - q.member);
}

/* ── The solver ───────────────────────────────────────────────────────── */

interface Frame {
  /** Index of the node's first unknown. */
  first: number;
  /** The directions the support leaves free: two for a free node, one for a roller, none for a pin. */
  dirs: [number, number][];
}

export function solveTruss(model: TrussModel): TrussOutcome {
  try {
    return solve(model);
  } catch {
    // Nothing in `solve` is meant to throw; a model it cannot read at all is one it refuses.
    return { ok: false, issues: [{ code: 'size' }] };
  }
}

function solve(given: TrussModel): TrussOutcome {
  // Something that is not even an object has no nodes.
  const model: TrussModel = given !== null && typeof given === 'object' ? given : ({} as TrussModel);
  const issues: TrussIssue[] = [];
  const nodes = Array.isArray(model?.nodes) ? model.nodes : [];
  const members = Array.isArray(model?.members) ? model.members : [];
  const supports = Array.isArray(model?.supports) ? model.supports : [];
  const loads = Array.isArray(model?.loads) ? model.loads : [];
  const J = nodes.length;
  const M = members.length;

  /* ── 1. What was given ── */
  if (J > MAX_NODES) issues.push({ code: 'too-big', where: { list: 'nodes', index: J }, count: J });
  if (M > MAX_MEMBERS) issues.push({ code: 'too-big', where: { list: 'members', index: M }, count: M });
  if (supports.length > MAX_SUPPORTS) issues.push({ code: 'too-big', where: { list: 'supports', index: supports.length }, count: supports.length });
  if (loads.length > MAX_LOADS) issues.push({ code: 'too-big', where: { list: 'loads', index: loads.length }, count: loads.length });
  if (issues.length > 0) return { ok: false, issues };

  if (J < 2) issues.push({ code: 'few-nodes', count: J });
  if (M === 0) issues.push({ code: 'no-members' });

  let numbersOk = true;
  nodes.forEach((n, index) => {
    if (!n || !finite(n.x)) {
      issues.push({ code: 'number', where: { list: 'nodes', index, field: 'x' } });
      numbersOk = false;
    }
    if (!n || !finite(n.y)) {
      issues.push({ code: 'number', where: { list: 'nodes', index, field: 'y' } });
      numbersOk = false;
    }
  });
  if (model.E !== undefined && !section(model.E)) issues.push({ code: 'section', where: { list: 'model', index: 0, field: 'E' } });
  if (model.A !== undefined && !section(model.A)) issues.push({ code: 'section', where: { list: 'model', index: 0, field: 'A' } });

  const inRange = (v: unknown): v is number => typeof v === 'number' && Number.isInteger(v) && v >= 0 && v < J;
  const pairs = new Map<string, number>();
  members.forEach((m, index) => {
    if (!m || !inRange(m.i)) issues.push({ code: 'member-node', where: { list: 'members', index, field: 'i' } });
    if (!m || !inRange(m.j)) issues.push({ code: 'member-node', where: { list: 'members', index, field: 'j' } });
    if (m && inRange(m.i) && inRange(m.j)) {
      if (m.i === m.j) issues.push({ code: 'zero-length', where: { list: 'members', index } });
      else {
        const key = m.i < m.j ? `${m.i}-${m.j}` : `${m.j}-${m.i}`;
        const first = pairs.get(key);
        if (first !== undefined) issues.push({ code: 'duplicate-member', where: { list: 'members', index }, members: [first, index] });
        else pairs.set(key, index);
      }
    }
    if (m && m.A !== undefined && !section(m.A)) issues.push({ code: 'section', where: { list: 'members', index, field: 'A' } });
    if (m && m.E !== undefined && !section(m.E)) issues.push({ code: 'section', where: { list: 'members', index, field: 'E' } });
  });

  const seen = new Map<number, number>();
  supports.forEach((s, index) => {
    if (!s || !inRange(s.node)) {
      issues.push({ code: 'support-node', where: { list: 'supports', index } });
      return;
    }
    if (s.kind !== 'pin' && s.kind !== 'roller') issues.push({ code: 'number', where: { list: 'supports', index, field: 'kind' } });
    if (s.kind === 'roller' && s.angle !== undefined && !finite(s.angle)) issues.push({ code: 'number', where: { list: 'supports', index, field: 'angle' } });
    if (seen.has(s.node)) issues.push({ code: 'duplicate-support', where: { list: 'supports', index }, nodes: [s.node] });
    else seen.set(s.node, index);
  });
  loads.forEach((l, index) => {
    if (!l || !inRange(l.node)) issues.push({ code: 'load-node', where: { list: 'loads', index } });
    if (l && !finite(l.fx)) issues.push({ code: 'number', where: { list: 'loads', index, field: 'fx' } });
    if (l && !finite(l.fy)) issues.push({ code: 'number', where: { list: 'loads', index, field: 'fy' } });
  });

  // The size of the truss, to measure places against.
  let size = 0;
  if (numbersOk && J > 0) {
    let x0 = Infinity;
    let x1 = -Infinity;
    let y0 = Infinity;
    let y1 = -Infinity;
    for (const n of nodes) {
      x0 = Math.min(x0, n.x);
      x1 = Math.max(x1, n.x);
      y0 = Math.min(y0, n.y);
      y1 = Math.max(y1, n.y);
    }
    size = Math.hypot(x1 - x0, y1 - y0);
    for (let a = 0; a < J; a++) {
      for (let b = a + 1; b < J; b++) {
        if (Math.hypot(nodes[a].x - nodes[b].x, nodes[a].y - nodes[b].y) <= NEAR * size || size === 0) issues.push({ code: 'duplicate-node', nodes: [a, b] });
      }
    }
    members.forEach((m, index) => {
      if (m && inRange(m.i) && inRange(m.j) && m.i !== m.j) {
        const len = Math.hypot(nodes[m.i].x - nodes[m.j].x, nodes[m.i].y - nodes[m.j].y);
        if (len > NEAR * size && len < SHORT * size) issues.push({ code: 'short-member', where: { list: 'members', index } });
      }
    });
  }

  // Connectivity.
  const degree = new Array<number>(J).fill(0);
  const parent = Array.from({ length: J }, (_, i) => i);
  const root = (a: number): number => {
    while (parent[a] !== a) {
      parent[a] = parent[parent[a]];
      a = parent[a];
    }
    return a;
  };
  for (const m of members) {
    if (m && inRange(m.i) && inRange(m.j) && m.i !== m.j) {
      degree[m.i]++;
      degree[m.j]++;
      parent[root(m.i)] = root(m.j);
    }
  }
  if (M > 0) {
    for (let k = 0; k < J; k++) if (degree[k] === 0) issues.push({ code: 'node-unconnected', nodes: [k] });
    const groups = new Map<number, number[]>();
    for (let k = 0; k < J; k++) if (degree[k] > 0) groups.set(root(k), [...(groups.get(root(k)) ?? []), k]);
    if (groups.size > 1) issues.push({ code: 'disconnected', groups: [...groups.values()] });
  }
  if (issues.length > 0) return { ok: false, issues };

  /* ── 2. Geometry ── */
  const info = members.map((m) => {
    const dx = nodes[m.j].x - nodes[m.i].x;
    const dy = nodes[m.j].y - nodes[m.i].y;
    const length = Math.hypot(dx, dy);
    return { length, cx: dx / length, cy: dy / length };
  });
  const sectionA = members.map((m) => m.A ?? model.A ?? null);
  const sectionE = members.map((m) => m.E ?? model.E ?? null);
  const absolute = members.every((_, k) => sectionA[k] !== null && sectionE[k] !== null);
  // What the members' stiffness is made of when it is not whole. A factor given to EVERY member and the other to NONE
  // (areas and no modulus anywhere, or the reverse) still says how stiff the members are beside one another: the
  // modulus (or the area) is the same in all of them, so EA is proportional to the one that is there. Anything in
  // between, a factor on some members only, cannot be read as a ratio and the members are taken as equally stiff.
  const everyA = members.every((_, k) => sectionA[k] !== null);
  const everyE = members.every((_, k) => sectionE[k] !== null);
  const anyA = members.some((_, k) => sectionA[k] !== null);
  const anyE = members.some((_, k) => sectionE[k] !== null);
  const relative = !absolute && ((everyA && !anyE) || (everyE && !anyA));
  const someSection = anyA || anyE;

  /* ── 3. Supports → free directions ── */
  const supportAt = new Map<number, number>();
  supports.forEach((s, index) => supportAt.set(s.node, index));
  const frames: Frame[] = [];
  let free = 0;
  let r = 0;
  for (let k = 0; k < J; k++) {
    const index = supportAt.get(k);
    const s: TrussSupport | undefined = index === undefined ? undefined : supports[index];
    let dirs: [number, number][];
    if (!s) dirs = [[1, 0], [0, 1]];
    else if (s.kind === 'pin') {
      dirs = [];
      r += 2;
    } else {
      const d = directionOf(s.angle);
      dirs = [[-d.s, d.c]];
      r += 1;
    }
    frames.push({ first: free, dirs });
    free += dirs.length;
  }
  if (r < 3) return { ok: false, issues: [{ code: 'few-supports', count: r }] };

  // G: elongation of each member from the unknowns.
  const G: Mat = members.map(() => new Array<number>(free).fill(0));
  members.forEach((m, k) => {
    const { cx, cy } = info[k];
    frames[m.j].dirs.forEach(([tx, ty], f) => (G[k][frames[m.j].first + f] += cx * tx + cy * ty));
    frames[m.i].dirs.forEach(([tx, ty], f) => (G[k][frames[m.i].first + f] -= cx * tx + cy * ty));
  });

  /* ── 4. Stability ── */
  const stable = stability(nodes, frames, G, free);
  if (stable.length > 0) return { ok: false, issues: stable };

  /* ── 5. Loads ── */
  const F = nodes.map(() => [0, 0]);
  let loadScale = 0;
  for (const l of loads) {
    F[l.node][0] += l.fx;
    F[l.node][1] += l.fy;
    loadScale += Math.hypot(l.fx, l.fy);
  }
  const f = new Array<number>(free).fill(0);
  for (let k = 0; k < J; k++) frames[k].dirs.forEach(([tx, ty], d) => (f[frames[k].first + d] = F[k][0] * tx + F[k][1] * ty));

  /* ── 6. The solve ── */
  const joints = J;
  const determinate = M + r === 2 * joints;
  const weights = members.map((_, k) => {
    const EA = absolute ? (sectionE[k] as number) * (sectionA[k] as number) : relative ? ((sectionE[k] ?? 1) as number) * ((sectionA[k] ?? 1) as number) : 1;
    return EA / info[k].length;
  });
  let N: number[];
  let q: number[] | null = null;
  if (determinate) {
    const At: Mat = Array.from({ length: free }, (_, a) => members.map((_, k) => G[k][a]));
    const sol = solveLinear(At, f);
    if (!sol) return { ok: false, issues: [{ code: 'ill-conditioned' }] };
    N = sol;
    if (absolute) {
      const delta = N.map((n, k) => n / weights[k]);
      q = solveLinear(G, delta);
      if (!q) return { ok: false, issues: [{ code: 'ill-conditioned' }] };
    }
  } else if (free === 0) {
    N = members.map(() => 0);
    q = absolute ? [] : null;
  } else {
    const wmax = Math.max(...weights);
    const wn = weights.map((w) => w / wmax);
    const K: Mat = Array.from({ length: free }, () => new Array<number>(free).fill(0));
    members.forEach((_, k) => {
      for (let a = 0; a < free; a++) {
        if (G[k][a] === 0) continue;
        for (let b = 0; b < free; b++) K[a][b] += wn[k] * G[k][a] * G[k][b];
      }
    });
    const qs = solveLinear(K, f);
    if (!qs) return { ok: false, issues: [{ code: 'ill-conditioned' }] };
    N = members.map((_, k) => {
      let d = 0;
      for (let a = 0; a < free; a++) d += G[k][a] * qs[a];
      return wn[k] * d;
    });
    q = absolute ? qs.map((v) => v / wmax) : null;
  }
  if (!N.every(Number.isFinite)) return { ok: false, issues: [{ code: 'size' }] };

  /* ── 7. Reactions, and the check ── */
  // What each member does to its two nodes: tension pulls a node towards the other.
  const pull = nodes.map(() => [0, 0]);
  members.forEach((m, k) => {
    pull[m.i][0] += N[k] * info[k].cx;
    pull[m.i][1] += N[k] * info[k].cy;
    pull[m.j][0] -= N[k] * info[k].cx;
    pull[m.j][1] -= N[k] * info[k].cy;
  });
  const reactionOf: [number, number][] = nodes.map(() => [0, 0]);
  let jointResidual = 0;
  const big = Math.max(loadScale, ...N.map(Math.abs));
  for (let k = 0; k < J; k++) {
    const sx = F[k][0] + pull[k][0];
    const sy = F[k][1] + pull[k][1];
    const index = supportAt.get(k);
    const s = index === undefined ? undefined : supports[index];
    if (!s) jointResidual = Math.max(jointResidual, Math.hypot(sx, sy));
    else if (s.kind === 'pin') reactionOf[k] = [-sx, -sy];
    else {
      const d = directionOf(s.angle);
      const along = -(sx * d.c + sy * d.s);
      reactionOf[k] = [along * d.c, along * d.s];
      // The part of the balance across the roller: nothing holds it.
      jointResidual = Math.max(jointResidual, Math.abs(sx * -d.s + sy * d.c));
    }
  }
  let box = { x0: Infinity, x1: -Infinity, y0: Infinity, y1: -Infinity };
  for (const n of nodes) box = { x0: Math.min(box.x0, n.x), x1: Math.max(box.x1, n.x), y0: Math.min(box.y0, n.y), y1: Math.max(box.y1, n.y) };
  const about = { x: (box.x0 + box.x1) / 2, y: (box.y0 + box.y1) / 2 };
  let sumFx = 0;
  let sumFy = 0;
  let sumM = 0;
  const addForce = (node: number, fx: number, fy: number) => {
    sumFx += fx;
    sumFy += fy;
    sumM += (nodes[node].x - about.x) * fy - (nodes[node].y - about.y) * fx;
  };
  for (const l of loads) addForce(l.node, l.fx, l.fy);
  for (let k = 0; k < J; k++) addForce(k, reactionOf[k][0], reactionOf[k][1]);
  const arm = size === 0 ? 1 : size;
  const equilibrium = { about, sumFx, sumFy, sumM, joint: jointResidual, scale: loadScale };
  const reactionScale = Math.max(big, ...reactionOf.map((v) => Math.hypot(v[0], v[1])));
  if (![sumFx, sumFy, sumM, jointResidual, ...reactionOf.flat()].every(Number.isFinite)) return { ok: false, issues: [{ code: 'size' }] };
  if (Math.abs(sumFx) > RESIDUAL * reactionScale || Math.abs(sumFy) > RESIDUAL * reactionScale || Math.abs(sumM) > RESIDUAL * reactionScale * arm || jointResidual > RESIDUAL * reactionScale) {
    return { ok: false, issues: [{ code: 'ill-conditioned' }] };
  }

  /* ── 8. The results, settled ── */
  const floor = ZERO * loadScale;
  const memberResults: MemberResult[] = members.map((m, k) => {
    const n = settle(N[k], floor);
    const A = sectionA[k];
    const E = sectionE[k];
    return {
      index: k,
      i: m.i,
      j: m.j,
      length: info[k].length,
      cx: info[k].cx,
      cy: info[k].cy,
      N: n,
      zero: n === 0,
      elongation: A !== null && E !== null ? n * info[k].length / (E * A) : null,
      stress: A !== null ? n / A : null,
      A,
      E,
    };
  });
  const reactions: ReactionResult[] = supports.map((s, index) => {
    const [rx0, ry0] = reactionOf[s.node];
    const rx = settle(rx0, floor);
    const ry = settle(ry0, floor);
    const d = s.kind === 'roller' ? directionOf(s.angle) : null;
    return {
      support: index,
      node: s.node,
      kind: s.kind,
      angle: d ? d.angle : null,
      rx,
      ry,
      magnitude: Math.hypot(rx, ry),
      along: d ? settle(rx0 * d.c + ry0 * d.s, floor) : null,
    };
  });
  let displacements: DisplacementResult[] | null = null;
  if (absolute && q) {
    const u = nodes.map((_, k) => {
      let ux = 0;
      let uy = 0;
      frames[k].dirs.forEach(([tx, ty], d) => {
        ux += q![frames[k].first + d] * tx;
        uy += q![frames[k].first + d] * ty;
      });
      return [ux, uy];
    });
    const umax = Math.max(0, ...u.map((v) => Math.hypot(v[0], v[1])));
    if (!Number.isFinite(umax)) return { ok: false, issues: [{ code: 'size' }] };
    // A truss whose every force is nothing does not move: what the solve left in q is rounding, and the floor below
    // is relative to the largest of it, so it would be drawn as a deformed shape at a scale of 1e18.
    const still = memberResults.every((m) => m.N === 0);
    displacements = u.map(([ux0, uy0], node) => {
      const ux = still ? 0 : settle(ux0, ZERO * umax);
      const uy = still ? 0 : settle(uy0, ZERO * umax);
      return { node, ux, uy, magnitude: Math.hypot(ux, uy) };
    });
  }
  let tension: Extreme | null = null;
  let compression: Extreme | null = null;
  // Two forces that are equal but for rounding (a Fink truss' two halves, in feet and in metres) are a tie, and a tie goes
  // to the lowest member number: the larger one is not whichever the last bit of each happened to favour.
  const tie = 1e-9 * Math.max(0, ...memberResults.map((m) => Math.abs(m.N)));
  for (const m of memberResults) {
    if (m.N > 0 && (!tension || m.N > tension.N + tie)) tension = { member: m.index, N: m.N };
    if (m.N < 0 && (!compression || m.N < compression.N - tie)) compression = { member: m.index, N: m.N };
  }
  const redundants = M + r - 2 * J;
  const determinacy: Determinacy = { joints: J, members: M, reactions: r, degree: redundants, word: redundants === 0 ? 'determinate' : 'indeterminate' };
  const warnings: TrussWarning[] = [];
  if (loadScale === 0) warnings.push({ code: 'no-load' });
  if (!determinate && !absolute && !relative && someSection) warnings.push({ code: 'partial-stiffness' });
  // 'relative': the areas (or the moduli) alone told the members apart, and the forces follow them.
  const stiffness: TrussSolution['stiffness'] = absolute ? 'absolute' : relative && !determinate && weights.some((w, k) => Math.abs(w * info[k].length - weights[0] * info[0].length) > 1e-12 * weights[0] * info[0].length) ? 'relative' : 'equal';

  const supported = nodes.map((_, k) => supportAt.has(k));
  const loaded = F.map((v) => v[0] !== 0 || v[1] !== 0);
  const inspection = zeroByInspection(J, members, info, supported, loaded);

  const out: TrussSolution = {
    ok: true,
    nodes: nodes.map((n) => ({ x: n.x, y: n.y })),
    members: memberResults,
    reactions,
    displacements,
    determinacy,
    stiffness,
    equilibrium,
    largest: { tension, compression },
    inspection,
    warnings,
  };
  const everyNumber = [...memberResults.flatMap((m) => [m.N, m.length, m.elongation ?? 0, m.stress ?? 0]), ...reactions.flatMap((v) => [v.rx, v.ry, v.magnitude]), ...(displacements ?? []).flatMap((d) => [d.ux, d.uy])];
  if (!everyNumber.every(Number.isFinite)) return { ok: false, issues: [{ code: 'size' }] };
  return out;
}

/**
 * The truss's stability (see the header, 3.): the issues if it can move. `G` is
 * the matrix of elongations from the unknowns; with every member's stiffness
 * taken as 1, K = GᵀG.
 */
function stability(nodes: { x: number; y: number }[], frames: Frame[], G: Mat, free: number): TrussIssue[] {
  if (free === 0) return [];
  const K1: Mat = Array.from({ length: free }, () => new Array<number>(free).fill(0));
  for (const row of G) {
    for (let a = 0; a < free; a++) {
      if (row[a] === 0) continue;
      for (let b = 0; b < free; b++) K1[a][b] += row[a] * row[b];
    }
  }
  // A truss that is plainly stable needs no eigenvalues: if K1 less twice MECH is still positive definite (Cholesky, a few
  // hundred thousand operations for the largest truss), its smallest eigenvalue is over 2·MECH and there is no null vector.
  // Anything else - a mechanism, or a truss near the line - goes through the eigenvalues, as it always did.
  if (positiveDefinite(K1, 2 * MECH)) return [];
  const { values, vectors } = jacobiEigen(K1);
  const nullIdx = values.map((v, k) => (v <= MECH ? k : -1)).filter((k) => k >= 0);
  if (nullIdx.length === 0) return [];
  const J = nodes.length;
  // The null vectors as displacements of the nodes: 2 per node, orthonormal.
  const U: number[][] = nullIdx.map((k) => {
    const full = new Array<number>(2 * J).fill(0);
    frames.forEach((fr, n) => {
      fr.dirs.forEach(([tx, ty], d) => {
        const c = vectors[k][fr.first + d];
        full[2 * n] += c * tx;
        full[2 * n + 1] += c * ty;
      });
    });
    return full;
  });
  // The rigid motions of the whole truss: two translations and a rotation about the centroid, orthonormal.
  const cx = nodes.reduce((s, n) => s + n.x, 0) / J;
  const cy = nodes.reduce((s, n) => s + n.y, 0) / J;
  const tx = new Array<number>(2 * J).fill(0);
  const ty = new Array<number>(2 * J).fill(0);
  const rot = new Array<number>(2 * J).fill(0);
  nodes.forEach((n, k) => {
    tx[2 * k] = 1;
    ty[2 * k + 1] = 1;
    rot[2 * k] = -(n.y - cy);
    rot[2 * k + 1] = n.x - cx;
  });
  const unit = (v: number[]) => {
    const len = Math.hypot(...v);
    return len > 0 ? v.map((c) => c / len) : v;
  };
  const rigid = [unit(tx), unit(ty), unit(rot)];
  const dot = (a: number[], b: number[]) => a.reduce((s, v, i) => s + v * b[i], 0);
  const d = U.length;
  // Share of each null direction that is not a rigid motion: S = I − (RᵀU)ᵀ(RᵀU).
  const RU = rigid.map((rv) => U.map((u) => dot(rv, u)));
  const S: Mat = Array.from({ length: d }, (_, a) => Array.from({ length: d }, (_, b) => (a === b ? 1 : 0) - RU.reduce((s, row) => s + row[a] * row[b], 0)));
  const eig = jacobiEigen(S);
  const issues: TrussIssue[] = [];
  const rigidCount = eig.values.filter((sigma) => sigma <= RIGID).length;
  // With the whole truss free to move too, a mechanism mode is only defined up to the rigid motions that are free. The
  // eigenvectors of S are orthogonal to each other, so a mechanism mode is already the part of the null space that is
  // orthogonal to the free rigid motions — which spreads a little of the swing of one node over the others, as a mean
  // (a node that swings alone with an amplitude of 3/4 leaves 1/4 on each of three that stay). A node therefore counts
  // only if it moves at least half as much as the one that moves most. Without a free rigid motion the mode is what it
  // is, and any node that moves at all counts.
  const moving = new Array<number>(J).fill(0);
  eig.values.forEach((sigma, k) => {
    if (sigma <= RIGID) return;
    const w = new Array<number>(2 * J).fill(0);
    eig.vectors[k].forEach((c, a) => U[a].forEach((u, i) => (w[i] += c * u)));
    for (let n = 0; n < J; n++) moving[n] += w[2 * n] ** 2 + w[2 * n + 1] ** 2;
  });
  const top = Math.max(...moving);
  if (top > 0) {
    const share = rigidCount > 0 ? 0.5 : 1e-6;
    const list: number[] = [];
    moving.forEach((v, n) => {
      if (Math.sqrt(v) > share * Math.sqrt(top)) list.push(n);
    });
    issues.push({ code: 'mechanism', nodes: list });
  }
  if (rigidCount > 0) issues.push({ code: 'unrestrained', count: rigidCount });
  return issues;
}
