import { buildPieces, condense, endForceOf, loadVector, localStiffness, maximaOf, stationsOf, type LocalLoads } from './element';
import { dot, factor, jacobiEigen, positiveDefinite, zeros } from './linalg';
import {
  FRAME_ZERO,
  MAX_MEMBERS,
  MAX_MEMBER_LOADS,
  MAX_NODAL_LOADS,
  MAX_NODES,
  MAX_SUPPORTS,
  type Determinacy,
  type DisplacementResult,
  type ExtremeOf,
  type FrameExtremes,
  type FrameIssue,
  type FrameMember,
  type FrameMemberLoad,
  type FrameModel,
  type FrameOutcome,
  type FrameSolution,
  type FrameSupport,
  type FrameWarning,
  type MemberResult,
  type ReactionResult,
} from './types';

/**
 * ─────────────────────────────────────────────────────────────────────────────
 * PLANE FRAME ANALYSIS — the engine: the direct stiffness method, 2D
 * ─────────────────────────────────────────────────────────────────────────────
 * types.ts has what goes in and what comes out: units, signs, supports, loads and
 * the code of every problem that is REPORTED and never thrown. `solveFrame` never
 * throws and never returns a NaN or an Infinity: a result is a solution whose
 * every number is finite, or a list of issues. element.ts has the member (its
 * stiffness, its loads, its hinges, its exact diagrams).
 *
 * THE METHOD.
 *   1. Every node has three displacements (ux, uy, θ). A member k contributes
 *      its 6 × 6 stiffness, condensed for the hinges at its ends (element.ts) and
 *      turned to the global axes, and its equivalent nodal loads.
 *   2. SUPPORTS are eliminated, exactly, not penalised. At a node, the
 *      displacement is U = T·q + d: the columns of T are the directions the support
 *      leaves FREE (none for a fixed support; θ for a pin; the translation across the
 *      line, and θ, for a roller of ANY angle: the inclined roller is a change of basis at
 *      its node) and d is the prescribed (settled) part. Springs are added to K.
 *      The solve is K_r q = T'(F − K d) with K_r = T'KT.
 *   3. STABILITY, BEFORE ANY SOLVE (`stability`). A frame is stable, to first
 *      order, exactly when K_r is positive definite, which depends on the geometry,
 *      the hinges and the supports and never on the values of E, A, I. It is tested
 *      on K_r = GᵀG, G the matrix of the members' DEFORMATIONS (elongation and the
 *      rotation of each unreleased end relative to the chord, one row each) and of
 *      the springs, in dimensionless coordinates and then scaled to unit diagonal.
 *      A Cholesky factorisation of (that − 2·MECH·I) tells a plainly stable frame
 *      at once; otherwise the eigenvalues under MECH are the ways the frame can move
 *      with nothing deforming. A null vector that is a rigid motion of the
 *      whole frame is 'unrestrained'; the rest are a 'mechanism' and name the nodes
 *      that move (those that move at least a quarter as much as the one that moves
 *      most).
 *   4. THE SOLVE: scaling of rows and columns, LU with partial pivoting, iterative
 *      refinement. The forces of a member follow from its end displacements.
 *   5. REACTIONS from the equilibrium of the support nodes: R = Σ(member end forces)
 *      − (nodal load). Springs are part of the reaction (and are listed apart).
 *   6. THE CHECK. ΣFx, ΣFy, ΣM about the centre of the box around the nodes (the loads
 *      added up FROM THEIR DEFINITIONS, not from the equivalent loads the solve used),
 *      and the equilibrium of every joint. A frame is returned only if each is under
 *      RESIDUAL of the problem's size.
 *
 * TOLERANCES (all relative).
 *   NEAR = 1e-9 of the frame's size: two nodes closer are one node typed twice.
 *   SHORT = 1e-5 of the frame's size: a shorter member has a stiffness a hundred
 *     thousand times that of a typical one; refused rather than solved badly.
 *   MECH = 1e-9, on the eigenvalues of the scaled GᵀG (entries O(1); rounding of the eigenvalues is
 *     1e-15). The measured stable frames have 1e-4 (a three-hinged gable with a rise of a hundredth of the
 *     span) and more; a stable frame is never refused as a mechanism, except a hinged arch whose rise is under about
 *     3·10⁻⁵ of its span (arch.ts of the reviews): that one is a mechanism to first order, to the eigenvalue limit.
 *   RIGID = 1e-6, on the share of a null vector that is not a rigid motion.
 *   RESIDUAL = 1e-6 of the problem's force scale; past it, 'ill-conditioned'.
 *   CONTRAST = 1e12 between the stiffest and the softest member (EA/L or the transverse stiffness, whichever is larger): 'ill-conditioned' before the solve.
 *   FRAME_ZERO = 1e-9 (types.ts): the relative size under which a result is rounding. The
 *     engine uses it only for its roots (a V that is rounding has no zero); analysis.ts settles.
 *   POSITION = 1e-7 of a member's length: a load's position that far past an end (a length rounded to the eight figures a field holds) is the end.
 *   LIMIT = 1e30 on every input number; sections lie in [1e-30, 1e30].
 */

export const NEAR = 1e-9;
export const SHORT = 1e-5;
export const MECH = 1e-9;
export const RIGID = 1e-6;
export const RESIDUAL = 1e-6;
/** The ratio of the stiffest member's stiffness to the softest's past which a frame is refused (before the solve). */
export const CONTRAST = 1e12;
export const LIMIT = 1e30;
/** How far past an end of a member (a ten-millionth of its length) a load's position may be and be taken for the end: a field holds eight figures. */
export const POSITION = 1e-7;
const SECTION_LOW = 1e-30;

const isNum = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v) && Math.abs(v) <= LIMIT;
const isSection = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v) && v >= SECTION_LOW && v <= LIMIT;
const isIndex = (v: unknown, n: number): v is number => typeof v === 'number' && Number.isInteger(v) && v >= 0 && v < n;

/** A roller's direction as a unit vector, exact at the quarter turns; the angle returned is in [0, 180). */
export function directionOf(angle: number | undefined): { angle: number; c: number; s: number } {
  const raw = angle === undefined ? 90 : angle;
  let a = raw % 180;
  if (a < 0) a += 180;
  if (a >= 180) a = 0;
  if (a === 0) return { angle: 0, c: 1, s: 0 };
  if (a === 90) return { angle: 90, c: 0, s: 1 };
  const r = (a * Math.PI) / 180;
  return { angle: a, c: Math.cos(r), s: Math.sin(r) };
}

const KINDS = ['fixed', 'pin', 'roller', 'guide', 'spring'];
const DIRS = ['local-y', 'local-x', 'global-x', 'global-y'];

/* ── Counting ─────────────────────────────────────────────────────────── */

interface Rest {
  /** The directions the node's displacement is free in (3-vectors), before the nodes whose rotation does not matter are cut. */
  free: number[][];
  /** The prescribed displacement, global (ux, uy, θ). */
  d: number[];
  /** Rigid reaction components of the support itself. */
  rigid: number;
  /** The spring stiffnesses (global). */
  k: [number, number, number];
  /** Settlement of the spring's far end. */
  s: [number, number, number];
  dir: { angle: number; c: number; s: number };
  kind: string;
}

const spring = (v: unknown): number => (typeof v === 'number' && Number.isFinite(v) && v > 0 ? v : 0);
const move = (v: unknown): number => (typeof v === 'number' && Number.isFinite(v) ? v : 0);

function restOf(s: FrameSupport): Rest {
  const dir = directionOf(typeof s.angle === 'number' && Number.isFinite(s.angle) ? s.angle : undefined);
  const dx = move(s.dx);
  const dy = move(s.dy);
  const dr = move(s.dr);
  const k: [number, number, number] = [spring(s.kx), spring(s.ky), spring(s.kr)];
  const e = [
    [1, 0, 0],
    [0, 1, 0],
    [0, 0, 1],
  ];
  const normal = dx * dir.c + dy * dir.s;
  switch (s.kind) {
    case 'fixed':
      return { free: [], d: [dx, dy, dr], rigid: 3, k, s: [dx, dy, dr], dir, kind: 'fixed' };
    case 'pin':
      return { free: [e[2]], d: [dx, dy, 0], rigid: 2, k, s: [dx, dy, dr], dir, kind: 'pin' };
    case 'roller':
      return { free: [[-dir.s, dir.c, 0], e[2]], d: [normal * dir.c, normal * dir.s, 0], rigid: 1, k, s: [dx, dy, dr], dir, kind: 'roller' };
    case 'guide':
      return { free: [[-dir.s, dir.c, 0]], d: [normal * dir.c, normal * dir.s, dr], rigid: 2, k, s: [dx, dy, dr], dir, kind: 'guide' };
    default:
      return { free: e, d: [0, 0, 0], rigid: 0, k, s: [dx, dy, dr], dir, kind: 'spring' };
  }
}

const FREE_NODE: Rest = { free: [[1, 0, 0], [0, 1, 0], [0, 0, 1]], d: [0, 0, 0], rigid: 0, k: [0, 0, 0], s: [0, 0, 0], dir: { angle: 90, c: 0, s: 1 }, kind: 'none' };

/** Independent spring reaction components at a node: the rank of Bᵀ·diag(k)·B over the directions B the support leaves free. */
function springRank(r: Rest): number {
  if (r.free.length === 0 || (r.k[0] === 0 && r.k[1] === 0 && r.k[2] === 0)) return 0;
  const f = r.free.length;
  const M = zeros(f);
  for (let a = 0; a < f; a++) for (let b = 0; b < f; b++) for (let c = 0; c < 3; c++) M[a][b] += r.free[a][c] * r.k[c] * r.free[b][c];
  const { values } = jacobiEigen(M);
  const top = Math.max(...values.map(Math.abs), 0);
  return values.filter((v) => v > 1e-12 * top).length;
}

export interface Counts {
  joints: number;
  members: number;
  reactions: number;
  releases: number;
  freeJoints: number;
  equations: number;
  degree: number;
  /** Indices of the nodes whose rotation does not matter. */
  inert: number[];
}

/**
 * The counts of the determinacy, from whatever the model holds: it is what the page says before the model is whole.
 * Never throws.
 */
export function countOf(model: Partial<FrameModel> | null | undefined): Counts {
  const nodes = Array.isArray(model?.nodes) ? model!.nodes! : [];
  const members = Array.isArray(model?.members) ? model!.members! : [];
  const supports = Array.isArray(model?.supports) ? model!.supports! : [];
  const n = nodes.length;
  let releases = 0;
  const attached = new Array<number>(n).fill(0);
  const stiffEnds = new Array<number>(n).fill(0);
  let count = 0;
  for (const m of members) {
    if (!m || typeof m !== 'object') continue;
    count++;
    const a = isIndex(m.i, n) ? m.i : -1;
    const b = isIndex(m.j, n) ? m.j : -1;
    const rs = Boolean(m.releases?.start);
    const re = Boolean(m.releases?.end);
    if (rs) releases++;
    if (re) releases++;
    if (a >= 0) {
      attached[a]++;
      if (!rs) stiffEnds[a]++;
    }
    if (b >= 0) {
      attached[b]++;
      if (!re) stiffEnds[b]++;
    }
  }
  let reactions = 0;
  const holdsTheta = new Array<boolean>(n).fill(false);
  const seen = new Set<number>();
  for (const s of supports) {
    if (!s || typeof s !== 'object' || !isIndex(s.node, n) || !KINDS.includes(s.kind) || seen.has(s.node)) continue;
    seen.add(s.node);
    const r = restOf(s);
    reactions += r.rigid + springRank(r);
    if (s.kind === 'fixed' || s.kind === 'guide' || spring(s.kr) > 0) holdsTheta[s.node] = true;
  }
  const inert: number[] = [];
  for (let k = 0; k < n; k++) if (attached[k] > 0 && stiffEnds[k] === 0 && !holdsTheta[k]) inert.push(k);
  const equations = 3 * n - inert.length;
  return { joints: n, members: count, reactions, releases, freeJoints: inert.length, equations, degree: 3 * count + reactions - equations - releases, inert };
}

/* ── Load geometry ────────────────────────────────────────────────────── */

/** The local components (x̄, ȳ) of a vector of size w along a direction, for a member with direction cosines (c, s). */
function along(dir: string, w: number, c: number, s: number): [number, number] {
  switch (dir) {
    case 'local-x':
      return [w, 0];
    case 'local-y':
      return [0, w];
    case 'global-x':
      return [w * c, -w * s];
    default:
      return [w * s, w * c];
  }
}

function localLoadsOf(index: number, L: number, c: number, s: number, h: number | undefined, loads: readonly FrameMemberLoad[]): LocalLoads {
  const out: LocalLoads = { dist: [], points: [], moments: [], eps0: 0, curv0: 0 };
  const clamp = (v: number) => Math.min(Math.max(v, 0), L);
  for (const l of loads) {
    if (l.member !== index) continue;
    switch (l.kind) {
      case 'udl': {
        const [qx, qy] = along(l.dir, l.w, c, s);
        out.dist.push({ a: 0, b: L, qx1: qx, qx2: qx, qy1: qy, qy2: qy });
        break;
      }
      case 'udl-projected': {
        const [qx, qy] = along(l.dir, l.w * (l.dir === 'global-y' ? Math.abs(c) : Math.abs(s)), c, s);
        out.dist.push({ a: 0, b: L, qx1: qx, qx2: qx, qy1: qy, qy2: qy });
        break;
      }
      case 'trapezoid': {
        const [x1, y1] = along(l.dir, l.w1, c, s);
        const [x2, y2] = along(l.dir, l.w2, c, s);
        out.dist.push({ a: clamp(l.a), b: clamp(l.b), qx1: x1, qx2: x2, qy1: y1, qy2: y2 });
        break;
      }
      case 'point': {
        const [px, py] = along(l.dir, l.P, c, s);
        out.points.push({ a: clamp(l.a), Px: px, Py: py });
        break;
      }
      case 'moment':
        out.moments.push({ a: clamp(l.a), C: l.M });
        break;
      case 'temperature':
        out.eps0 += l.alpha * l.dT;
        if (l.dTg !== 0 && h !== undefined) out.curv0 += (-l.alpha * l.dTg) / h;
        break;
    }
  }
  return out;
}

/**
 * The resultant of a member's loads straight from their definitions (closed forms, not the equivalent nodal loads the
 * solve used): the local forces, the moment about the member's start node, and the sum of the loads' sizes.
 */
function resultantOf(loads: LocalLoads): { fx: number; fy: number; m: number; size: number } {
  let fx = 0;
  let fy = 0;
  let m = 0;
  let size = 0;
  for (const d of loads.dist) {
    const len = d.b - d.a;
    if (!(len > 0)) continue;
    fx += ((d.qx1 + d.qx2) / 2) * len;
    fy += ((d.qy1 + d.qy2) / 2) * len;
    m += (len / 6) * (d.qy1 * (2 * d.a + d.b) + d.qy2 * (d.a + 2 * d.b));
    size += (Math.abs(d.qx1) + Math.abs(d.qx2) + Math.abs(d.qy1) + Math.abs(d.qy2)) * len / 2;
  }
  for (const p of loads.points) {
    fx += p.Px;
    fy += p.Py;
    m += p.a * p.Py;
    size += Math.abs(p.Px) + Math.abs(p.Py);
  }
  for (const q of loads.moments) m += q.C;
  return { fx, fy, m, size };
}

/* ── Validation ───────────────────────────────────────────────────────── */

interface Prepared {
  nodes: { x: number; y: number }[];
  members: FrameMember[];
  supports: FrameSupport[];
  loads: FrameModel['loads'];
  memberLoads: FrameMemberLoad[];
  E?: number;
  A?: number;
  I?: number;
}

function structural(model: FrameModel | null | undefined): { issues: FrameIssue[]; p: Prepared | null } {
  const issues: FrameIssue[] = [];
  const nodes = Array.isArray(model?.nodes) ? model!.nodes : [];
  const members = Array.isArray(model?.members) ? model!.members : [];
  const supports = Array.isArray(model?.supports) ? model!.supports : [];
  const loads = Array.isArray(model?.loads) ? model!.loads : [];
  const memberLoads = Array.isArray(model?.memberLoads) ? model!.memberLoads : [];
  if (nodes.length < 2) issues.push({ code: 'few-nodes', count: nodes.length });
  if (members.length === 0) issues.push({ code: 'no-members' });
  const caps: [string, number, number][] = [
    ['nodes', nodes.length, MAX_NODES],
    ['members', members.length, MAX_MEMBERS],
    ['supports', supports.length, MAX_SUPPORTS],
    ['loads', loads.length, MAX_NODAL_LOADS],
    ['memberLoads', memberLoads.length, MAX_MEMBER_LOADS],
  ];
  for (const [list, n, max] of caps) if (n > max) issues.push({ code: 'too-big', where: { list: list as 'nodes', index: 0 }, count: n });
  if (issues.length > 0) return { issues, p: null };

  const bad = (list: 'nodes' | 'members' | 'supports' | 'loads' | 'memberLoads' | 'model', index: number, field: string, code: FrameIssue['code'] = 'number') => issues.push({ code, where: { list, index, field } });
  nodes.forEach((n, k) => {
    if (!n || !isNum(n.x)) bad('nodes', k, 'x');
    if (!n || !isNum(n.y)) bad('nodes', k, 'y');
  });
  for (const f of ['E', 'A', 'I'] as const) {
    const v = model![f];
    if (v !== undefined && v !== null && !isSection(v)) bad('model', 0, f, 'section');
  }
  members.forEach((m, k) => {
    if (!m || typeof m !== 'object') return bad('members', k, 'i', 'member-node');
    if (!isIndex(m.i, nodes.length)) bad('members', k, 'i', 'member-node');
    if (!isIndex(m.j, nodes.length)) bad('members', k, 'j', 'member-node');
    for (const f of ['E', 'A', 'I', 'h'] as const) {
      const v = m[f];
      if (v !== undefined && v !== null && !isSection(v)) bad('members', k, f, 'section');
    }
  });
  supports.forEach((s, k) => {
    if (!s || typeof s !== 'object') return bad('supports', k, 'node', 'support-node');
    if (!isIndex(s.node, nodes.length)) bad('supports', k, 'node', 'support-node');
    if (!KINDS.includes(s.kind)) bad('supports', k, 'kind', 'support-kind');
    if (s.angle !== undefined && !isNum(s.angle)) bad('supports', k, 'angle');
    for (const f of ['kx', 'ky', 'kr'] as const) {
      const v = s[f];
      if (v === undefined) continue;
      if (!isNum(v)) bad('supports', k, f);
      else if (v < 0) bad('supports', k, f, 'spring');
    }
    for (const f of ['dx', 'dy', 'dr'] as const) if (s[f] !== undefined && !isNum(s[f])) bad('supports', k, f);
  });
  loads.forEach((l, k) => {
    if (!l || typeof l !== 'object') return bad('loads', k, 'node', 'load-node');
    if (!isIndex(l.node, nodes.length)) bad('loads', k, 'node', 'load-node');
    for (const f of ['fx', 'fy', 'm'] as const) if (!isNum(l[f])) bad('loads', k, f);
  });
  memberLoads.forEach((l, k) => {
    if (!l || typeof l !== 'object') return bad('memberLoads', k, 'member', 'load-member');
    if (!isIndex(l.member, members.length)) bad('memberLoads', k, 'member', 'load-member');
    const kind = l.kind as string;
    const dir = (l as { dir?: string }).dir;
    const fields: Record<string, string[]> = {
      udl: ['w'],
      'udl-projected': ['w'],
      trapezoid: ['a', 'b', 'w1', 'w2'],
      point: ['a', 'P'],
      moment: ['a', 'M'],
      temperature: ['dT', 'dTg', 'alpha'],
    };
    if (!(kind in fields)) return bad('memberLoads', k, 'kind', 'load-kind');
    if ((kind === 'udl' || kind === 'trapezoid' || kind === 'point') && !(typeof dir === 'string' && DIRS.includes(dir))) bad('memberLoads', k, 'dir', 'load-kind');
    if (kind === 'udl-projected' && dir !== 'global-x' && dir !== 'global-y') bad('memberLoads', k, 'dir', 'load-kind');
    for (const f of fields[kind]) if (!isNum((l as unknown as Record<string, unknown>)[f])) bad('memberLoads', k, f);
  });
  if (issues.length > 0) return { issues, p: null };
  return { issues, p: { nodes, members, supports, loads, memberLoads, E: model!.E ?? undefined, A: model!.A ?? undefined, I: model!.I ?? undefined } };
}

/* ── The solve ────────────────────────────────────────────────────────── */

interface Mem {
  i: number;
  j: number;
  L: number;
  c: number;
  s: number;
  rs: boolean;
  re: boolean;
  EA: number;
  EI: number;
  E: number | null;
  A: number | null;
  I: number | null;
  loads: LocalLoads;
}

const rot = (c: number, s: number, g: readonly number[]): number[] => [c * g[0] + s * g[1], -s * g[0] + c * g[1], g[2], c * g[3] + s * g[4], -s * g[3] + c * g[4], g[5]];
const unrot = (c: number, s: number, l: readonly number[]): number[] => [c * l[0] - s * l[1], s * l[0] + c * l[1], l[2], c * l[3] - s * l[4], s * l[3] + c * l[4], l[5]];

export function solveFrame(model: FrameModel): FrameOutcome {
  try {
    return run(model);
  } catch {
    return { ok: false, issues: [{ code: 'stopped' }] };
  }
}

function run(model: FrameModel): FrameOutcome {
  const { issues, p } = structural(model);
  if (!p) return { ok: false, issues };
  const { nodes, members, supports } = p;
  const n = nodes.length;

  /* Geometry. */
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
  const ref = { x: (x0 + x1) / 2, y: (y0 + y1) / 2 };
  for (let a = 0; a < n; a++) for (let b = a + 1; b < n; b++) if (Math.hypot(nodes[a].x - nodes[b].x, nodes[a].y - nodes[b].y) <= NEAR * size) issues.push({ code: 'duplicate-node', nodes: [a, b] });
  const mem: Mem[] = [];
  const pair = new Map<string, number>();
  members.forEach((m, k) => {
    const a = nodes[m.i];
    const b = nodes[m.j];
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    const L = Math.hypot(dx, dy);
    if (m.i === m.j) issues.push({ code: 'zero-length', where: { list: 'members', index: k } });
    else if (L > NEAR * size && L < SHORT * size) issues.push({ code: 'short-member', where: { list: 'members', index: k } });
    const key = m.i < m.j ? `${m.i}-${m.j}` : `${m.j}-${m.i}`;
    const first = pair.get(key);
    if (first !== undefined) issues.push({ code: 'duplicate-member', where: { list: 'members', index: k }, members: [first, k] });
    else pair.set(key, k);
    const E = m.E ?? p.E;
    const A = m.A ?? p.A;
    const I = m.I ?? p.I;
    mem.push({
      i: m.i,
      j: m.j,
      L,
      c: L > 0 ? dx / L : 1,
      s: L > 0 ? dy / L : 0,
      rs: Boolean(m.releases?.start),
      re: Boolean(m.releases?.end),
      EA: E !== undefined && E !== null && A !== undefined && A !== null ? E * A : NaN,
      EI: E !== undefined && E !== null && I !== undefined && I !== null ? E * I : NaN,
      E: E ?? null,
      A: A ?? null,
      I: I ?? null,
      loads: { dist: [], points: [], moments: [], eps0: 0, curv0: 0 },
    });
  });
  const degree = new Array<number>(n).fill(0);
  for (const m of members) {
    degree[m.i]++;
    degree[m.j]++;
  }
  degree.forEach((d, k) => {
    if (d === 0) issues.push({ code: 'node-unconnected', nodes: [k] });
  });
  /* Pieces: a union–find over the members. */
  const parent = Array.from({ length: n }, (_, k) => k);
  const root = (a: number): number => {
    while (parent[a] !== a) {
      parent[a] = parent[parent[a]];
      a = parent[a];
    }
    return a;
  };
  for (const m of members) parent[root(m.i)] = root(m.j);
  const groups = new Map<number, number[]>();
  for (let k = 0; k < n; k++) if (degree[k] > 0) groups.set(root(k), [...(groups.get(root(k)) ?? []), k]);
  if (groups.size > 1) issues.push({ code: 'disconnected', groups: [...groups.values()].sort((a, b) => a[0] - b[0]) });
  /* Supports. */
  const supportAt = new Map<number, number>();
  supports.forEach((s, k) => {
    const first = supportAt.get(s.node);
    if (first !== undefined) issues.push({ code: 'duplicate-support', where: { list: 'supports', index: k }, nodes: [s.node] });
    else supportAt.set(s.node, k);
  });
  /* Member loads: positions and depth. */
  p.memberLoads.forEach((l, k) => {
    const m = mem[l.member];
    if (m.L <= 0) return;
    // A position is typed to eight figures: one that lies past the end by less than a ten-millionth of the member is the end.
    const tol = POSITION * m.L;
    const outside = (v: number) => v < -tol || v > m.L + tol;
    if ((l.kind === 'trapezoid' || l.kind === 'point' || l.kind === 'moment') && outside(l.a)) issues.push({ code: 'load-position', where: { list: 'memberLoads', index: k, field: 'a' }, length: m.L });
    else if (l.kind === 'trapezoid') {
      if (outside(l.b)) issues.push({ code: 'load-position', where: { list: 'memberLoads', index: k, field: 'b' }, length: m.L });
      else if (!(l.b - l.a > tol)) issues.push({ code: 'load-position', where: { list: 'memberLoads', index: k, field: 'b' }, length: m.L });
    }
    if (l.kind === 'temperature' && l.dTg !== 0 && l.alpha !== 0 && members[l.member].h == null) issues.push({ code: 'depth', where: { list: 'memberLoads', index: k }, members: [l.member] });
  });
  if (issues.length > 0) return { ok: false, issues };
  members.forEach((m, k) => (mem[k].loads = localLoadsOf(k, mem[k].L, mem[k].c, mem[k].s, m.h ?? undefined, p.memberLoads)));

  /* The supports' restraints, the nodes whose rotation does not matter. */
  const rest: Rest[] = nodes.map(() => FREE_NODE);
  supports.forEach((s) => (rest[s.node] = restOf(s)));
  const counts = countOf(model);
  const inert = new Set(counts.inert);
  const basis: number[][][] = rest.map((r, k) => (inert.has(k) ? r.free.filter((v) => !(v[0] === 0 && v[1] === 0 && v[2] === 1)) : r.free));
  const off: number[] = [];
  let nf = 0;
  for (let k = 0; k < n; k++) {
    off.push(nf);
    nf += basis[k].length;
  }
  const comps = counts.reactions;
  const found: FrameIssue[] = [];
  if (comps < 3) found.push({ code: 'few-supports', count: comps });
  // Loads at one node add up: two couples of +5 and −5 at an all-hinged node are no couple.
  const couple = new Map<number, number>();
  for (const l of p.loads) couple.set(l.node, (couple.get(l.node) ?? 0) + l.m);
  for (const [node, m] of couple) if (inert.has(node) && m !== 0) found.push({ code: 'hinged-joint-moment', nodes: [node] });
  /* Stability. */
  const st = stability(nodes, mem, rest, basis, off, nf, inert, size);
  if (st.rigid > 0 && comps >= 3) found.push({ code: 'unrestrained', count: st.rigid });
  if (st.mechanism) found.push({ code: 'mechanism', nodes: st.mechanism.nodes, kind: st.mechanism.kind, count: st.mechanism.count });
  if (found.length > 0) return { ok: false, issues: found };

  /* Sections. */
  const missing = mem.filter((m) => !Number.isFinite(m.EA) || !Number.isFinite(m.EI)).length;
  const absolute = missing === 0;
  if (!absolute && counts.degree > 0) return { ok: false, issues: [{ code: 'sections', count: missing }] };
  const dummy = !absolute;

  /* Stiffness contrast. A member's stiffness is the larger of EA/L and its transverse stiffness (12EI/L³, 3EI/L³ with one hinge,
     none with two: a bar hinged at both ends only pulls); frames whose members differ by CONTRAST or more are refused before any
     solve, as the 'ill-conditioned' message says. */
  if (absolute && mem.length > 1) {
    let hi = 0;
    let lo = Infinity;
    for (const m of mem) {
      const transverse = m.rs && m.re ? 0 : ((m.rs || m.re ? 3 : 12) * m.EI) / (m.L * m.L * m.L);
      const k = Math.max(m.EA / m.L, transverse);
      hi = Math.max(hi, k);
      lo = Math.min(lo, k);
    }
    if (!(hi <= CONTRAST * lo)) return { ok: false, issues: [{ code: 'ill-conditioned' }] };
  }

  /* Assembly. */
  const N3 = 3 * n;
  const K = zeros(N3);
  const F = new Array<number>(N3).fill(0);
  for (const l of p.loads) {
    F[3 * l.node] += l.fx;
    F[3 * l.node + 1] += l.fy;
    F[3 * l.node + 2] += l.m;
  }
  const cond = mem.map((m) => {
    const EA = dummy ? 1 : m.EA;
    const EI = dummy ? 1 : m.EI;
    const k = localStiffness(EA, EI, m.L);
    const pv = loadVector(m.L, EA, EI, m.loads);
    return condense(k, pv, { start: m.rs, end: m.re });
  });
  mem.forEach((m, mi) => {
    const kl = cond[mi].k;
    // kg = Rᵀ kl R, R = blockdiag(r, r) with r = [[c, s, 0], [−s, c, 0], [0, 0, 1]].
    const R = zeros(6);
    for (const b of [0, 3]) {
      R[b][b] = m.c;
      R[b][b + 1] = m.s;
      R[b + 1][b] = -m.s;
      R[b + 1][b + 1] = m.c;
      R[b + 2][b + 2] = 1;
    }
    const tmp = zeros(6);
    for (let a = 0; a < 6; a++) for (let b = 0; b < 6; b++) for (let c = 0; c < 6; c++) tmp[a][b] += kl[a][c] * R[c][b];
    const kg = zeros(6);
    for (let a = 0; a < 6; a++) for (let b = 0; b < 6; b++) for (let c = 0; c < 6; c++) kg[a][b] += R[c][a] * tmp[c][b];
    const ix = [3 * m.i, 3 * m.i + 1, 3 * m.i + 2, 3 * m.j, 3 * m.j + 1, 3 * m.j + 2];
    for (let a = 0; a < 6; a++) for (let b = 0; b < 6; b++) K[ix[a]][ix[b]] += kg[a][b];
    const pg = unrot(m.c, m.s, cond[mi].p);
    for (let a = 0; a < 6; a++) F[ix[a]] += pg[a];
  });
  const dp = new Array<number>(N3).fill(0);
  supports.forEach((s) => {
    const r = rest[s.node];
    for (let c = 0; c < 3; c++) {
      dp[3 * s.node + c] = r.d[c];
      K[3 * s.node + c][3 * s.node + c] += r.k[c];
      F[3 * s.node + c] += r.k[c] * r.s[c];
    }
  });
  const Kd = K.map((row) => dot(row, dp));
  const rhs = F.map((v, k) => v - Kd[k]);
  const Kr = zeros(nf);
  const fr = new Array<number>(nf).fill(0);
  for (let a = 0; a < n; a++) {
    for (let ka = 0; ka < basis[a].length; ka++) {
      const ta = basis[a][ka];
      fr[off[a] + ka] = ta[0] * rhs[3 * a] + ta[1] * rhs[3 * a + 1] + ta[2] * rhs[3 * a + 2];
      for (let b = 0; b < n; b++) {
        for (let kb = 0; kb < basis[b].length; kb++) {
          const tb = basis[b][kb];
          let s = 0;
          for (let r = 0; r < 3; r++) for (let c = 0; c < 3; c++) s += ta[r] * K[3 * a + r][3 * b + c] * tb[c];
          Kr[off[a] + ka][off[b] + kb] = s;
        }
      }
    }
  }
  let q: number[] = [];
  if (nf > 0) {
    const solver = factor(Kr);
    if (!solver) return { ok: false, issues: [{ code: 'ill-conditioned' }] };
    q = solver(fr);
  }
  const U = dp.slice();
  for (let a = 0; a < n; a++) for (let k = 0; k < basis[a].length; k++) for (let c = 0; c < 3; c++) U[3 * a + c] += q[off[a] + k] * basis[a][k][c];

  /* Members. */
  const fGlobal: number[][] = [];
  const fLocal: number[][] = [];
  const dLocal: number[][] = [];
  mem.forEach((m, mi) => {
    const ug = [U[3 * m.i], U[3 * m.i + 1], U[3 * m.i + 2], U[3 * m.j], U[3 * m.j + 1], U[3 * m.j + 2]];
    const ul = cond[mi].recover(rot(m.c, m.s, ug));
    dLocal.push(ul);
    const f = cond[mi].forces(ul);
    fLocal.push(f);
    fGlobal.push(unrot(m.c, m.s, f));
  });

  /* Reactions and joints. */
  const R = new Array<number>(N3).fill(0);
  mem.forEach((m, mi) => {
    for (let c = 0; c < 3; c++) {
      R[3 * m.i + c] += fGlobal[mi][c];
      R[3 * m.j + c] += fGlobal[mi][3 + c];
    }
  });
  const P = new Array<number>(N3).fill(0);
  for (const l of p.loads) {
    P[3 * l.node] += l.fx;
    P[3 * l.node + 1] += l.fy;
    P[3 * l.node + 2] += l.m;
  }
  for (let k = 0; k < N3; k++) R[k] -= P[k];

  /* The scale of the problem and the check. */
  let loadScale = 0;
  for (const l of p.loads) loadScale += Math.abs(l.fx) + Math.abs(l.fy) + Math.abs(l.m) / Math.max(size, 1e-300);
  const resultants = mem.map((m) => resultantOf(m.loads));
  resultants.forEach((r, mi) => {
    loadScale += r.size + (mem[mi].loads.moments.reduce((s, c) => s + Math.abs(c.C), 0)) / Math.max(size, 1e-300);
  });
  // A temperature change or a settlement is a load too: the force it would develop if the frame were fully restrained.
  mem.forEach((m) => {
    const EA = dummy ? 1 : m.EA;
    const EI = dummy ? 1 : m.EI;
    loadScale += Math.abs(EA * m.loads.eps0) + Math.abs(EI * m.loads.curv0) / Math.max(size, 1e-300);
  });
  supports.forEach((s) => {
    const move3 = Math.abs(move(s.dx)) + Math.abs(move(s.dy)) + Math.abs(move(s.dr)) * size;
    if (move3 === 0) return;
    let kmax = 0;
    mem.forEach((m) => {
      if (m.i !== s.node && m.j !== s.node) return;
      const EA = dummy ? 1 : m.EA;
      const EI = dummy ? 1 : m.EI;
      kmax = Math.max(kmax, EA / m.L, (12 * EI) / (m.L * m.L * m.L), (6 * EI) / (m.L * m.L));
    });
    loadScale += kmax * move3;
  });
  let magnitude = 0;
  for (const f of fLocal) for (const v of [f[0], f[1], f[3], f[4]]) magnitude = Math.max(magnitude, Math.abs(v));
  for (const f of fLocal) for (const v of [f[2], f[5]]) magnitude = Math.max(magnitude, Math.abs(v) / Math.max(size, 1e-300));
  for (const s of supports) for (let c = 0; c < 3; c++) magnitude = Math.max(magnitude, Math.abs(R[3 * s.node + c]) / (c === 2 ? Math.max(size, 1e-300) : 1));
  const scale = Math.max(loadScale, magnitude);

  const springForce = (node: number): number[] => {
    const r = rest[node];
    return [0, 1, 2].map((c) => -r.k[c] * (U[3 * node + c] - r.s[c]));
  };
  let joint = 0;
  for (let a = 0; a < n; a++) {
    const sf = supportAt.has(a) ? springForce(a) : [0, 0, 0];
    const g = [0, 1, 2].map((c) => P[3 * a + c] - (R[3 * a + c] + P[3 * a + c]) + sf[c]);
    for (const t of basis[a]) joint = Math.max(joint, Math.abs(dot(t, g)) / (t[2] === 1 && t[0] === 0 ? Math.max(size, 1e-300) : 1));
  }
  const appliedFx = p.loads.reduce((s, l) => s + l.fx, 0) + resultants.reduce((s, r, mi) => s + mem[mi].c * r.fx - mem[mi].s * r.fy, 0);
  const appliedFy = p.loads.reduce((s, l) => s + l.fy, 0) + resultants.reduce((s, r, mi) => s + mem[mi].s * r.fx + mem[mi].c * r.fy, 0);
  let appliedM = 0;
  for (const l of p.loads) appliedM += (nodes[l.node].x - ref.x) * l.fy - (nodes[l.node].y - ref.y) * l.fx + l.m;
  resultants.forEach((r, mi) => {
    const m = mem[mi];
    const Fg = { x: m.c * r.fx - m.s * r.fy, y: m.s * r.fx + m.c * r.fy };
    appliedM += r.m + (nodes[m.i].x - ref.x) * Fg.y - (nodes[m.i].y - ref.y) * Fg.x;
  });
  let sumFx = appliedFx;
  let sumFy = appliedFy;
  let sumM = appliedM;
  supports.forEach((s) => {
    const rx = R[3 * s.node];
    const ry = R[3 * s.node + 1];
    sumFx += rx;
    sumFy += ry;
    sumM += (nodes[s.node].x - ref.x) * ry - (nodes[s.node].y - ref.y) * rx + R[3 * s.node + 2];
  });
  const tol = RESIDUAL * scale;
  if (!(Math.abs(sumFx) <= tol && Math.abs(sumFy) <= tol && Math.abs(sumM) <= tol * Math.max(size, 1e-300) && joint <= tol)) return { ok: false, issues: [{ code: 'ill-conditioned' }] };

  /* The results. */
  const tinyForce = FRAME_ZERO * scale;
  const tinyMoment = FRAME_ZERO * scale * Math.max(size, 1e-300);
  const membersOut: MemberResult[] = mem.map((m, mi) => {
    const pieces = buildPieces({
      L: m.L,
      f: fLocal[mi],
      loads: m.loads,
      EA: dummy ? null : m.EA,
      EI: dummy ? null : m.EI,
      start: dummy ? null : [dLocal[mi][0], dLocal[mi][1], dLocal[mi][2]],
      tinyForce,
      tinyMoment,
    });
    const r = resultants[mi];
    return {
      index: mi,
      i: m.i,
      j: m.j,
      length: m.L,
      cx: m.c,
      cy: m.s,
      E: m.E,
      A: m.A,
      I: m.I,
      releases: { start: m.rs, end: m.re },
      forces: fLocal[mi] as MemberResult['forces'],
      start: endForceOf(pieces, 'start'),
      end: endForceOf(pieces, 'end', fLocal[mi], m.loads),
      displacements: dummy ? null : (dLocal[mi] as MemberResult['displacements']),
      pieces,
      stations: closeStations(stationsOf(pieces, { N: tinyForce, V: tinyForce, M: tinyMoment }), endForceOf(pieces, 'end', fLocal[mi], m.loads)),
      maxima: maximaOf(pieces),
      loadResultant: { fx: m.c * r.fx - m.s * r.fy, fy: m.s * r.fx + m.c * r.fy },
    };
  });
  const reactions: ReactionResult[] = supports.map((s, si) => {
    const r = rest[s.node];
    const rx = R[3 * s.node];
    const ry = R[3 * s.node + 1];
    const directional = s.kind === 'roller' || s.kind === 'guide';
    const hasSpring = r.k[0] > 0 || r.k[1] > 0 || r.k[2] > 0;
    const sf = springForce(s.node);
    return {
      support: si,
      node: s.node,
      kind: s.kind,
      angle: directional ? r.dir.angle : null,
      rx,
      ry,
      rm: R[3 * s.node + 2],
      magnitude: Math.hypot(rx, ry),
      along: directional ? rx * r.dir.c + ry * r.dir.s : null,
      across: directional ? -rx * r.dir.s + ry * r.dir.c : null,
      spring: hasSpring ? { fx: sf[0], fy: sf[1], m: sf[2] } : null,
    };
  });
  const displacements: DisplacementResult[] | null = dummy
    ? null
    : nodes.map((_, k) => ({ node: k, ux: U[3 * k], uy: U[3 * k + 1], rotation: inert.has(k) ? null : U[3 * k + 2], magnitude: Math.hypot(U[3 * k], U[3 * k + 1]) }));

  const extremes: FrameExtremes = { M: { max: null, min: null }, V: { max: null, min: null }, N: { max: null, min: null } };
  for (const m of membersOut) {
    for (const key of ['M', 'V', 'N'] as const) {
      const mx = m.maxima[key].max;
      const mn = m.maxima[key].min;
      const cur = extremes[key];
      if (cur.max === null || mx.value > cur.max.value) cur.max = { member: m.index, x: mx.x, value: mx.value } satisfies ExtremeOf;
      if (cur.min === null || mn.value < cur.min.value) cur.min = { member: m.index, x: mn.x, value: mn.value } satisfies ExtremeOf;
    }
  }

  const warnings: FrameWarning[] = [];
  const settled =
    p.loads.every((l) => l.fx === 0 && l.fy === 0 && l.m === 0) &&
    p.memberLoads.every((l) => (l.kind === 'temperature' ? l.alpha * l.dT === 0 && (l.alpha * l.dTg === 0) : l.kind === 'udl' || l.kind === 'udl-projected' ? l.w === 0 : l.kind === 'trapezoid' ? l.w1 === 0 && l.w2 === 0 : l.kind === 'point' ? l.P === 0 : l.M === 0)) &&
    supports.every((s) => move(s.dx) === 0 && move(s.dy) === 0 && move(s.dr) === 0);
  if (settled) warnings.push({ code: 'no-load' });
  if (dummy) warnings.push({ code: 'no-stiffness' });
  const bars = mem.flatMap((m, k) => (m.rs && m.re ? [k] : []));
  if (bars.length > 0) warnings.push({ code: 'bar', members: bars });
  if (counts.inert.length > 0) warnings.push({ code: 'free-rotation', nodes: counts.inert });
  // A temperature change with an expansion coefficient of 0 does nothing: said, so that a load that is drawn is not taken for one that acts.
  const cold = [...new Set(p.memberLoads.flatMap((l) => (l.kind === 'temperature' && l.alpha === 0 && (l.dT !== 0 || l.dTg !== 0) ? [l.member] : [])))].sort((a, b) => a - b);
  if (cold.length > 0) warnings.push({ code: 'no-expansion', members: cold });

  const determinacy: Determinacy = {
    joints: counts.joints,
    members: counts.members,
    reactions: counts.reactions,
    releases: counts.releases,
    freeJoints: counts.freeJoints,
    equations: counts.equations,
    degree: counts.degree,
    word: counts.degree === 0 ? 'determinate' : counts.degree > 0 ? 'indeterminate' : 'unstable',
  };
  const sol: FrameSolution = {
    ok: true,
    nodes: nodes.map((q) => ({ x: q.x, y: q.y })),
    members: membersOut,
    reactions,
    displacements,
    determinacy,
    stiffness: absolute ? 'absolute' : 'none',
    equilibrium: { about: ref, sumFx, sumFy, sumM, joint, scale, size, applied: { fx: appliedFx, fy: appliedFy, m: appliedM } },
    extremes,
    warnings,
  };
  return finite(sol) ? sol : { ok: false, issues: [{ code: 'size' }] };
}

/** Past this a number in the results is not a result any figure printed can mean (inputs are held to 1e30; a displacement of F·L³/EI can be 1e180). */
export const RESULT_LIMIT = 1e150;

/** The last station of a member carries the end forces as the end forces are written (see endForceOf), not as the pieces add up. */
function closeStations<T extends { kind: string; N: number; V: number; M: number }>(stations: T[], end: { N: number; V: number; M: number }): T[] {
  const last = stations[stations.length - 1];
  if (last && last.kind === 'end') stations[stations.length - 1] = { ...last, N: end.N, V: end.V, M: end.M };
  return stations;
}

/** Whether every number in a result is finite and under RESULT_LIMIT. */
function finite(v: unknown): boolean {
  if (typeof v === 'number') return Number.isFinite(v) && Math.abs(v) <= RESULT_LIMIT;
  if (Array.isArray(v)) return v.every(finite);
  if (v && typeof v === 'object') return Object.values(v).every(finite);
  return true;
}

/* ── Stability ────────────────────────────────────────────────────────── */

interface Stability {
  rigid: number;
  mechanism: { nodes: number[]; kind: 'sway' | 'rotation'; count: number } | null;
}

function stability(nodes: { x: number; y: number }[], mem: Mem[], rest: Rest[], basis: number[][][], off: number[], nf: number, inert: Set<number>, size: number): Stability {
  if (nf === 0) return { rigid: 0, mechanism: null };
  const n = nodes.length;
  const S = Math.max(size, 1e-300);
  const rows: number[][] = [];
  const row = (entries: [number, number[]][]): void => {
    const r = new Array<number>(nf).fill(0);
    for (const [node, c3] of entries) basis[node].forEach((t, k) => (r[off[node] + k] += dot(c3, t)));
    if (r.some((v) => v !== 0)) rows.push(r);
  };
  for (const m of mem) {
    const w = m.L / S;
    row([
      [m.i, [-m.c, -m.s, 0]],
      [m.j, [m.c, m.s, 0]],
    ]);
    if (!m.rs)
      row([
        [m.i, [-m.s, m.c, w]],
        [m.j, [m.s, -m.c, 0]],
      ]);
    if (!m.re)
      row([
        [m.i, [-m.s, m.c, 0]],
        [m.j, [m.s, -m.c, w]],
      ]);
  }
  rest.forEach((r, k) => {
    for (let c = 0; c < 3; c++) if (r.k[c] > 0) row([[k, [c === 0 ? 1 : 0, c === 1 ? 1 : 0, c === 2 ? 1 : 0]]]);
  });
  const A = zeros(nf);
  for (const r of rows) for (let a = 0; a < nf; a++) if (r[a] !== 0) for (let b = 0; b < nf; b++) A[a][b] += r[a] * r[b];
  const d = A.map((r, k) => (r[k] > 1e-30 ? Math.sqrt(r[k]) : 1));
  const As = A.map((r, a) => r.map((v, b) => v / (d[a] * d[b])));
  if (positiveDefinite(As, 2 * MECH)) return { rigid: 0, mechanism: null };
  const eig = jacobiEigen(As);
  const nullIdx = eig.values.map((v, k) => (v < MECH ? k : -1)).filter((k) => k >= 0);
  if (nullIdx.length === 0) return { rigid: 0, mechanism: null };
  // The null vectors as vectors of the nodes' displacements (ux/S, uy/S, θ), orthonormalised.
  const full = (qv: number[]): number[] => {
    const v = new Array<number>(3 * n).fill(0);
    for (let a = 0; a < n; a++) for (let k = 0; k < basis[a].length; k++) for (let c = 0; c < 3; c++) v[3 * a + c] += qv[off[a] + k] * basis[a][k][c];
    return v;
  };
  const orthonormal = (vs: number[][]): number[][] => {
    const out: number[][] = [];
    for (const v of vs) {
      const w = v.slice();
      for (let pass = 0; pass < 2; pass++) for (const u of out) {
        const dd = dot(w, u);
        for (let k = 0; k < w.length; k++) w[k] -= dd * u[k];
      }
      const len = Math.sqrt(dot(w, w));
      if (len > 1e-8) out.push(w.map((x) => x / len));
    }
    return out;
  };
  const Phi = orthonormal(nullIdx.map((k) => full(eig.vectors[k].map((y, a) => y / d[a]))));
  const cx = nodes.reduce((s, q) => s + q.x, 0) / n;
  const cy = nodes.reduce((s, q) => s + q.y, 0) / n;
  const tx = new Array<number>(3 * n).fill(0);
  const ty = new Array<number>(3 * n).fill(0);
  const tr = new Array<number>(3 * n).fill(0);
  for (let k = 0; k < n; k++) {
    tx[3 * k] = 1;
    ty[3 * k + 1] = 1;
    tr[3 * k] = -(nodes[k].y - cy) / S;
    tr[3 * k + 1] = (nodes[k].x - cx) / S;
    tr[3 * k + 2] = inert.has(k) ? 0 : 1;
  }
  const Q = orthonormal([tx, ty, tr]);
  // The part of each rigid motion that is not a null vector.
  const B = Q.map((qv) => {
    const w = qv.slice();
    for (const u of Phi) {
      const dd = dot(qv, u);
      for (let k = 0; k < w.length; k++) w[k] -= dd * u[k];
    }
    return w;
  });
  const gram = B.map((a) => B.map((b) => dot(a, b)));
  const ge = jacobiEigen(gram);
  const inside: number[][] = [];
  ge.values.forEach((v, k) => {
    if (v < RIGID * RIGID) {
      const a = ge.vectors[k];
      inside.push(Q[0].map((_, c) => a.reduce((s, ak, m) => s + ak * Q[m][c], 0)));
    }
  });
  const rigid = inside.length;
  const count = Phi.length - rigid;
  if (count <= 0) return { rigid, mechanism: null };
  // The mechanism's modes: the null vectors without their rigid part.
  const modes = Phi.map((u) => {
    const w = u.slice();
    for (const r of inside) {
      const dd = dot(u, r);
      for (let k = 0; k < w.length; k++) w[k] -= dd * r[k];
    }
    return w;
  });
  // The nodes that move: by their TRANSLATION (a pinned foot turns in every sway mechanism and is not what the sentence is about);
  // where nothing translates, by their rotation.
  const shift = new Array<number>(n).fill(0);
  const turn = new Array<number>(n).fill(0);
  for (const w of modes) {
    for (let k = 0; k < n; k++) {
      shift[k] += w[3 * k] ** 2 + w[3 * k + 1] ** 2;
      turn[k] += w[3 * k + 2] ** 2;
    }
  }
  const trace = Math.max(...shift) > 1e-12 ? shift : turn;
  const top = Math.max(...trace);
  let moving = trace.map((v, k) => (v >= 0.25 * top && v > 1e-12 ? k : -1)).filter((k) => k >= 0);
  if (moving.length === 0) moving = [trace.indexOf(top)];
  // The kind is a hint for the sentence. 'sway': the nodes that move all move the same way (a storey sways, a part of the frame
  // translates). 'rotation': they move in different directions (a part swings about a point), or the one node that moves swings
  // about a neighbour that stays: its motion is across every member that holds it to a node at rest.
  let best = modes[0];
  for (const w of modes) if (dot(w, w) > dot(best, best)) best = w;
  const move2 = (k: number): [number, number] => [best[3 * k], best[3 * k + 1]];
  const size2 = (v: [number, number]) => Math.hypot(v[0], v[1]);
  let kind: 'sway' | 'rotation' = 'sway';
  const topMove = Math.max(...moving.map((k) => size2(move2(k))));
  if (topMove < 1e-9) kind = 'rotation';
  else if (moving.length === 1) {
    const k = moving[0];
    const u = move2(k);
    const held = mem.filter((m) => (m.i === k && !moving.includes(m.j)) || (m.j === k && !moving.includes(m.i)));
    if (held.length > 0 && held.every((m) => Math.abs(u[0] * m.c + u[1] * m.s) / size2(u) <= 0.35)) kind = 'rotation';
  } else {
    const mean: [number, number] = [moving.reduce((s, k) => s + move2(k)[0], 0), moving.reduce((s, k) => s + move2(k)[1], 0)];
    const m2 = size2(mean);
    const alike = m2 > 0 && moving.every((k) => size2(move2(k)) < 1e-9 * topMove || (move2(k)[0] * mean[0] + move2(k)[1] * mean[1]) / (size2(move2(k)) * m2) >= 0.7);
    kind = alike ? 'sway' : 'rotation';
  }
  return { rigid, mechanism: { nodes: moving, kind, count } };
}

