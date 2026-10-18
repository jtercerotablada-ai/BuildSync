import type { StiffnessMemberLoad, StiffnessModel } from './types';

/**
 * ─────────────────────────────────────────────────────────────────────────────
 * STIFFNESS MATRIX — the oracle the engine is tested against, and the generator of structures
 * ─────────────────────────────────────────────────────────────────────────────
 * Not part of the calculator (the name does not match the test glob). It shares NO CODE with engine.ts: its own arithmetic (exact fractions of
 * BigInts), its own member matrix (the END FORCES for a unit displacement of each degree of freedom, written out with the beam's formulas and
 * rotated by the direction cosines, where the engine multiplies Tᵀ·k·T), its own fixed-end forces (the loads INTEGRATED against the Hermite shape
 * functions as exact polynomials, where the engine uses closed forms), its own treatment of the supports (Lagrange multipliers: the reaction is an
 * unknown and the support an equation, where the engine partitions and eliminates), its own solver (fraction-free Gauss–Jordan: every division in it
 * is exact) and its own member end forces.
 *
 * Exact where the geometry allows: every member is axis-aligned or a Pythagorean triangle (3-4-5, 5-12-13, 8-15-17, 7-24-25), so its length, cosine and
 * sine are fractions; every section property and every load a dyadic rational. A singular system is answered with null: a mechanism, which the engine must
 * report as one.
 */

/* ── Fractions ────────────────────────────────────────────────────────── */

export const B0 = BigInt(0);
export const B1 = BigInt(1);

export interface Q {
  n: bigint;
  d: bigint;
}
const abs = (a: bigint): bigint => (a < B0 ? -a : a);
export function gcd(a: bigint, b: bigint): bigint {
  a = abs(a);
  b = abs(b);
  while (b !== B0) [a, b] = [b, a % b];
  return a;
}
export function q(n: bigint | number, d: bigint | number = B1): Q {
  let nn = BigInt(n);
  let dd = BigInt(d);
  if (dd === B0) throw new Error('division by zero');
  if (dd < B0) {
    nn = -nn;
    dd = -dd;
  }
  const g = gcd(nn, dd);
  return g > B1 ? { n: nn / g, d: dd / g } : { n: nn, d: dd };
}
export const add = (a: Q, b: Q): Q => q(a.n * b.d + b.n * a.d, a.d * b.d);
export const sub = (a: Q, b: Q): Q => q(a.n * b.d - b.n * a.d, a.d * b.d);
export const mul = (a: Q, b: Q): Q => q(a.n * b.n, a.d * b.d);
export const div = (a: Q, b: Q): Q => q(a.n * b.d, a.d * b.n);
export const neg = (a: Q): Q => ({ n: -a.n, d: a.d });
export const ZERO: Q = { n: B0, d: B1 };
export const ONE: Q = { n: B1, d: B1 };
export const isZero = (a: Q): boolean => a.n === B0;

/** A double as the exact fraction it is. */
export function fromNumber(v: number): Q {
  if (v === 0) return ZERO;
  if (!Number.isFinite(v)) throw new Error('not finite');
  let m = v;
  let e = 0;
  while (!Number.isInteger(m)) {
    m *= 2;
    e++;
    if (e > 1100) throw new Error('too fine');
  }
  return q(BigInt(m), B1 << BigInt(e));
}
/** A fraction as a double (relative error 2⁻⁵²). */
export function toNumber(a: Q): number {
  if (a.n === B0) return 0;
  const shift = BigInt(200);
  const negative = a.n < B0;
  const scaled = (abs(a.n) << shift) / a.d;
  const v = Number(scaled) / 2 ** 200;
  return negative ? -v : v;
}

/** Solves A x = b exactly, or null if A is singular (fraction-free Gauss–Jordan: every division is exact). */
export function solveExact(A: Q[][], b: Q[]): Q[] | null {
  const n = b.length;
  const M: bigint[][] = A.map((row, i) => {
    const entries = [...row, b[i]];
    let lcm = B1;
    for (const e of entries) lcm = (lcm / gcd(lcm, e.d)) * e.d;
    return entries.map((e) => (e.n * lcm) / e.d);
  });
  let prev = B1;
  for (let k = 0; k < n; k++) {
    let p = k;
    while (p < n && M[p][k] === B0) p++;
    if (p === n) return null;
    if (p !== k) [M[p], M[k]] = [M[k], M[p]];
    const pivot = M[k][k];
    for (let i = 0; i < n; i++) {
      if (i === k) continue;
      const f = M[i][k];
      for (let j = 0; j <= n; j++) {
        if (j === k) continue;
        M[i][j] = (pivot * M[i][j] - f * M[k][j]) / prev;
      }
      M[i][k] = B0;
    }
    prev = pivot;
  }
  return M.map((row, i) => q(row[n], row[i]));
}

/* ── Polynomials over Q (ascending coefficients) ──────────────────────── */

type QP = Q[];
const pmul = (a: QP, b: QP): QP => {
  const out: QP = Array.from({ length: a.length + b.length - 1 }, () => ZERO);
  a.forEach((x, i) => b.forEach((y, j) => (out[i + j] = add(out[i + j], mul(x, y)))));
  return out;
};
const peval = (p: QP, x: Q): Q => p.reduceRight((s, c) => add(mul(s, x), c), ZERO);
const pint = (p: QP): QP => [ZERO, ...p.map((c, k) => div(c, q(k + 1)))];
const integrate = (p: QP, a: Q, b: Q): Q => {
  const P = pint(p);
  return sub(peval(P, b), peval(P, a));
};

/* ── The specification ────────────────────────────────────────────────── */

export interface OMember {
  i: number;
  j: number;
  E: number;
  A: number;
  I: number;
}
export interface OSupport {
  node: number;
  ux: boolean;
  uy: boolean;
  rz: boolean;
  dx?: number;
  dy?: number;
  dr?: number;
}
export interface OSpec {
  mode: 'truss' | 'frame';
  nodes: { x: number; y: number }[];
  members: OMember[];
  supports: OSupport[];
  loads: { node: number; fx: number; fy: number; m: number }[];
  memberLoads: StiffnessMemberLoad[];
}

/** The engine's model for a specification. */
export function toModel(spec: OSpec): StiffnessModel {
  return {
    mode: spec.mode,
    nodes: spec.nodes.map((n) => ({ ...n })),
    members: spec.members.map((m) => ({ i: m.i, j: m.j, E: m.E, A: m.A, ...(spec.mode === 'frame' ? { I: m.I } : {}) })),
    supports: spec.supports.map((s) => ({ node: s.node, ux: s.ux, uy: s.uy, rz: s.rz, ...(s.dx ? { dx: s.dx } : {}), ...(s.dy ? { dy: s.dy } : {}), ...(s.dr ? { dr: s.dr } : {}) })),
    loads: spec.loads.map((l) => ({ ...l })),
    memberLoads: spec.memberLoads.map((l) => ({ ...l })),
  };
}

/* ── The solution ─────────────────────────────────────────────────────── */

export interface OResult {
  nd: number;
  /** Global displacements, 3 (frame) or 2 (truss) per node. */
  u: Q[];
  /** The global stiffness matrix and the load vector (nodal plus equivalent loads). */
  K: Q[][];
  P: Q[];
  /** Per restrained DOF (ascending): the DOF index (from 0) and the reaction. */
  reactions: { dof: number; value: Q }[];
  /** Per member: the global matrix, and what the nodes exert on it, local axes. */
  Ke: Q[][][];
  forces: Q[][];
}

const zeroVec = (n: number): Q[] => Array.from({ length: n }, () => ZERO);
const matZero = (n: number, m: number = n): Q[][] => Array.from({ length: n }, () => Array.from({ length: m }, () => ZERO));

interface QMember {
  i: number;
  j: number;
  L: Q;
  c: Q;
  s: Q;
  EA: Q;
  EI: Q;
}

/** The sqrt of a perfect square of a fraction, or throws (the generator only makes those). */
function isqrt(n: bigint): bigint {
  if (n < BigInt(2)) return n;
  let x = B1 << BigInt(Math.ceil(n.toString(2).length / 2));
  for (;;) {
    const y = (x + n / x) >> B1;
    if (y >= x) return x;
    x = y;
  }
}
function sqrtExact(a: Q): Q {
  const rn = isqrt(a.n);
  const rd = isqrt(a.d);
  if (rn * rn !== a.n || rd * rd !== a.d) throw new Error('not a perfect square');
  return q(rn, rd);
}

/** The forces (global) the member's nodes exert on it for the global end displacements g: written out, not a matrix product. */
function memberForcesGlobal(mode: 'truss' | 'frame', m: QMember, g: Q[]): Q[] {
  const { c, s, L, EA, EI } = m;
  const axial = div(EA, L);
  if (mode === 'truss') {
    const ui = add(mul(c, g[0]), mul(s, g[1]));
    const uj = add(mul(c, g[2]), mul(s, g[3]));
    const fi = mul(axial, sub(ui, uj));
    // the force on node i is fi along the member, on j its opposite
    return [mul(c, fi), mul(s, fi), mul(c, neg(fi)), mul(s, neg(fi))];
  }
  const L2 = mul(L, L);
  const L3 = mul(L2, L);
  const ui = add(mul(c, g[0]), mul(s, g[1]));
  const vi = add(mul(neg(s), g[0]), mul(c, g[1]));
  const ti = g[2];
  const uj = add(mul(c, g[3]), mul(s, g[4]));
  const vj = add(mul(neg(s), g[3]), mul(c, g[4]));
  const tj = g[5];
  const k12 = div(mul(q(12), EI), L3);
  const k6 = div(mul(q(6), EI), L2);
  const k4 = div(mul(q(4), EI), L);
  const k2 = div(mul(q(2), EI), L);
  const dv = sub(vi, vj);
  const Fxi = mul(axial, sub(ui, uj));
  const Fyi = add(mul(k12, dv), mul(k6, add(ti, tj)));
  const Mi = add(add(mul(k6, dv), mul(k4, ti)), mul(k2, tj));
  const Mj = add(add(mul(k6, dv), mul(k2, ti)), mul(k4, tj));
  const local = [Fxi, Fyi, Mi, neg(Fxi), neg(Fyi), Mj];
  return [
    sub(mul(c, local[0]), mul(s, local[1])),
    add(mul(s, local[0]), mul(c, local[1])),
    local[2],
    sub(mul(c, local[3]), mul(s, local[4])),
    add(mul(s, local[3]), mul(c, local[4])),
    local[5],
  ];
}

/** Local end displacements of a member from its global ones. */
function toLocal(mode: 'truss' | 'frame', m: QMember, g: Q[]): Q[] {
  const { c, s } = m;
  const ui = add(mul(c, g[0]), mul(s, g[1]));
  if (mode === 'truss') return [ui, add(mul(c, g[2]), mul(s, g[3]))];
  return [ui, add(mul(neg(s), g[0]), mul(c, g[1])), g[2], add(mul(c, g[3]), mul(s, g[4])), add(mul(neg(s), g[3]), mul(c, g[4])), g[5]];
}

/** Local forces from local displacements, written out. */
function memberForcesLocal(mode: 'truss' | 'frame', m: QMember, l: Q[]): Q[] {
  const axial = div(EAof(m), m.L);
  if (mode === 'truss') {
    const f = mul(axial, sub(l[0], l[1]));
    return [f, neg(f)];
  }
  const L2 = mul(m.L, m.L);
  const L3 = mul(L2, m.L);
  const k12 = div(mul(q(12), m.EI), L3);
  const k6 = div(mul(q(6), m.EI), L2);
  const k4 = div(mul(q(4), m.EI), m.L);
  const k2 = div(mul(q(2), m.EI), m.L);
  const dv = sub(l[1], l[4]);
  const Fx = mul(axial, sub(l[0], l[3]));
  const Fy = add(mul(k12, dv), mul(k6, add(l[2], l[5])));
  return [Fx, Fy, add(add(mul(k6, dv), mul(k4, l[2])), mul(k2, l[5])), neg(Fx), neg(Fy), add(add(mul(k6, dv), mul(k2, l[2])), mul(k4, l[5]))];
}
const EAof = (m: QMember): Q => m.EA;

/** The Hermite shape functions of a member of length L as exact polynomials in x, and the linear ones. */
function shapes(L: Q): { bend: QP[]; axial: QP[] } {
  const L2 = mul(L, L);
  const L3 = mul(L2, L);
  const il = div(ONE, L);
  const il2 = div(ONE, L2);
  const il3 = div(ONE, L3);
  return {
    bend: [
      [ONE, ZERO, neg(mul(q(3), il2)), mul(q(2), il3)],
      [ZERO, ONE, neg(mul(q(2), il)), il2],
      [ZERO, ZERO, mul(q(3), il2), neg(mul(q(2), il3))],
      [ZERO, ZERO, neg(il), il2],
    ],
    axial: [
      [ONE, neg(il)],
      [ZERO, il],
    ],
  };
}

/** The fixed-end forces of one member's loads (local): minus the load INTEGRATED against the shape functions. */
function fixedEnd(m: QMember, loads: StiffnessMemberLoad[]): Q[] {
  const sh = shapes(m.L);
  const p = zeroVec(6);
  const addTo = (k: number, v: Q) => (p[k] = add(p[k], v));
  for (const l of loads) {
    if (l.kind === 'udl') {
      const w = fromNumber(l.w);
      [1, 2, 4, 5].forEach((idx, k) => addTo(idx, integrate(pmul([w], sh.bend[k]), ZERO, m.L)));
    } else if (l.kind === 'axial') {
      const qq = fromNumber(l.q);
      addTo(0, integrate(pmul([qq], sh.axial[0]), ZERO, m.L));
      addTo(3, integrate(pmul([qq], sh.axial[1]), ZERO, m.L));
    } else {
      const a = fromNumber(l.a);
      const P = fromNumber(l.P);
      [1, 2, 4, 5].forEach((idx, k) => addTo(idx, mul(P, peval(sh.bend[k], a))));
    }
  }
  return p.map(neg);
}

/** Solves the specification exactly, or null if its stiffness equations are singular (a mechanism). */
export function solveExactly(spec: OSpec): OResult | null {
  const mode = spec.mode;
  const nd = mode === 'truss' ? 2 : 3;
  const N = nd * spec.nodes.length;
  const ms: QMember[] = spec.members.map((m) => {
    const dx = sub(fromNumber(spec.nodes[m.j].x), fromNumber(spec.nodes[m.i].x));
    const dy = sub(fromNumber(spec.nodes[m.j].y), fromNumber(spec.nodes[m.i].y));
    const L = sqrtExact(add(mul(dx, dx), mul(dy, dy)));
    return { i: m.i, j: m.j, L, c: div(dx, L), s: div(dy, L), EA: mul(fromNumber(m.E), fromNumber(m.A)), EI: mul(fromNumber(m.E), fromNumber(m.I)) };
  });
  const code = (m: QMember): number[] => {
    const out: number[] = [];
    for (const n of [m.i, m.j]) for (let c = 0; c < nd; c++) out.push(nd * n + c);
    return out;
  };
  const K = matZero(N);
  const P = zeroVec(N);
  const Ke: Q[][][] = [];
  const fe: Q[][] = [];
  ms.forEach((m, k) => {
    const cd = code(m);
    const nm = cd.length;
    const mat = matZero(nm);
    for (let col = 0; col < nm; col++) {
      const g = zeroVec(nm);
      g[col] = ONE;
      const f = memberForcesGlobal(mode, m, g);
      for (let row = 0; row < nm; row++) mat[row][col] = f[row];
    }
    Ke.push(mat);
    cd.forEach((da, ra) => cd.forEach((db, rb) => (K[da][db] = add(K[da][db], mat[ra][rb]))));
    // equivalent nodal loads of the member's loads: minus the global fixed-end forces
    if (mode === 'frame') {
      const mine = spec.memberLoads.filter((l) => l.member === k);
      const local = fixedEnd(m, mine);
      fe.push(local);
      const { c, s } = m;
      const globalFE = [
        sub(mul(c, local[0]), mul(s, local[1])),
        add(mul(s, local[0]), mul(c, local[1])),
        local[2],
        sub(mul(c, local[3]), mul(s, local[4])),
        add(mul(s, local[3]), mul(c, local[4])),
        local[5],
      ];
      cd.forEach((d, r) => (P[d] = sub(P[d], globalFE[r])));
    } else fe.push(zeroVec(2));
  });
  for (const l of spec.loads) {
    P[nd * l.node] = add(P[nd * l.node], fromNumber(l.fx));
    P[nd * l.node + 1] = add(P[nd * l.node + 1], fromNumber(l.fy));
    if (mode === 'frame') P[nd * l.node + 2] = add(P[nd * l.node + 2], fromNumber(l.m));
  }
  // The supports as constraints: unknowns (u, λ), equations  K u − Σ e_r λ_r = P  and  u_r = d_r.
  const restrained: { dof: number; value: Q }[] = [];
  for (const s of spec.supports) {
    const flags = mode === 'frame' ? [s.ux, s.uy, s.rz] : [s.ux, s.uy];
    const vals = mode === 'frame' ? [s.dx ?? 0, s.dy ?? 0, s.dr ?? 0] : [s.dx ?? 0, s.dy ?? 0];
    flags.forEach((on, c) => {
      if (on) restrained.push({ dof: nd * s.node + c, value: fromNumber(vals[c]) });
    });
  }
  restrained.sort((a, b) => a.dof - b.dof);
  const R = restrained.length;
  const A = matZero(N + R);
  const b = zeroVec(N + R);
  for (let r = 0; r < N; r++) {
    for (let c = 0; c < N; c++) A[r][c] = K[r][c];
    b[r] = P[r];
  }
  restrained.forEach((s, k) => {
    A[s.dof][N + k] = neg(ONE);
    A[N + k][s.dof] = ONE;
    b[N + k] = s.value;
  });
  const x = solveExact(A, b);
  if (!x) return null;
  const u = x.slice(0, N);
  const reactions = restrained.map((s, k) => ({ dof: s.dof, value: x[N + k] }));
  const forces = ms.map((m, k) => {
    const local = toLocal(mode, m, code(m).map((d) => u[d]));
    const fk = memberForcesLocal(mode, m, local);
    return fk.map((v, r) => add(v, fe[k][r]));
  });
  return { nd, u, K, P, reactions, Ke, forces };
}

/* ── Generators ───────────────────────────────────────────────────────── */

export function rng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Direction vectors whose length is an integer (times k): the member directions the oracle can solve exactly. */
const DIRECTIONS: [number, number][] = [];
for (const [a, b] of [
  [1, 0],
  [0, 1],
  [3, 4],
  [4, 3],
  [5, 12],
  [12, 5],
  [8, 15],
  [15, 8],
  [7, 24],
]) {
  for (const sx of [1, -1]) for (const sy of [1, -1]) if (!DIRECTIONS.some(([x, y]) => x === sx * a && y === sy * b)) DIRECTIONS.push([sx * a, sy * b]);
}

export interface GenOptions {
  mode?: 'truss' | 'frame';
  maxNodes?: number;
  /** Probability of an extra member between two nodes that could be joined. */
  extra?: number;
  /** The most supports (restrained flags are drawn at random). */
  settlements?: boolean;
}

export function randomSpec(seed: number, opts: GenOptions = {}): OSpec {
  const r = rng(seed);
  const pick = <T,>(xs: readonly T[]): T => xs[Math.floor(r() * xs.length)];
  const mode = opts.mode ?? (r() < 0.5 ? 'truss' : 'frame');
  const maxNodes = opts.maxNodes ?? 6;
  const count = 2 + Math.floor(r() * (maxNodes - 1));
  const nodes: { x: number; y: number }[] = [{ x: 0, y: 0 }];
  const members: OMember[] = [];
  const E = [100, 200, 250, 300, 500, 1000, 2000, 29000];
  const A = [1, 2, 3, 4, 5, 8, 10, 12.5];
  const I = [10, 20, 40, 60, 80, 100, 125, 200];
  const section = () => ({ E: pick(E), A: pick(A), I: pick(I) });
  const base = section();
  const same = r() < 0.5;
  const sec = () => (same ? base : section());
  const taken = (x: number, y: number) => nodes.some((n) => n.x === x && n.y === y);
  const joined = (a: number, b: number) => members.some((m) => (m.i === a && m.j === b) || (m.i === b && m.j === a));
  for (let k = 1; k < count; k++) {
    for (let attempt = 0; attempt < 40; attempt++) {
      const from = Math.floor(r() * nodes.length);
      const [dx, dy] = pick(DIRECTIONS);
      const scale = pick([1, 1, 2]);
      const x = nodes[from].x + dx * scale;
      const y = nodes[from].y + dy * scale;
      if (taken(x, y)) continue;
      nodes.push({ x, y });
      members.push({ i: from, j: nodes.length - 1, ...sec() });
      break;
    }
  }
  // Extra members between nodes whose separation is a Pythagorean one.
  const extra = opts.extra ?? 0.4;
  for (let a = 0; a < nodes.length; a++)
    for (let b = a + 1; b < nodes.length; b++) {
      if (joined(a, b) || r() > extra) continue;
      const len = Math.hypot(nodes[b].x - nodes[a].x, nodes[b].y - nodes[a].y);
      if (!Number.isInteger(len) || !(len > 0)) continue;
      const flip = r() < 0.5;
      members.push({ i: flip ? b : a, j: flip ? a : b, ...sec() });
    }
  const supports: OSupport[] = [];
  const nodeIds = nodes.map((_, k) => k);
  const supportCount = 1 + Math.floor(r() * Math.min(nodes.length, 3));
  const chosen = new Set<number>();
  while (chosen.size < supportCount) chosen.add(pick(nodeIds));
  for (const node of chosen) {
    const kind = pick(['fixed', 'pin', 'roller-y', 'roller-x', 'pin', 'fixed']);
    const flags = kind === 'fixed' ? [true, true, true] : kind === 'pin' ? [true, true, false] : kind === 'roller-y' ? [false, true, false] : [true, false, false];
    const s: OSupport = { node, ux: flags[0], uy: flags[1], rz: flags[2] };
    if (opts.settlements && r() < 0.5) {
      if (s.ux && r() < 0.6) s.dx = pick([0.125, -0.25, 0.5, 1, -1]);
      if (s.uy && r() < 0.6) s.dy = pick([0.125, -0.25, 0.5, 1, -1]);
      if (mode === 'frame' && s.rz && r() < 0.5) s.dr = pick([0.0078125, -0.015625, 0.03125]);
    }
    supports.push(s);
  }
  const loads: OSpec['loads'] = [];
  const loadCount = 1 + Math.floor(r() * 3);
  for (let k = 0; k < loadCount; k++) {
    loads.push({ node: pick(nodeIds), fx: pick([0, 0, 10, -10, 5, 20, -12.5]), fy: pick([0, -10, -20, 15, -5, 7.5]), m: mode === 'frame' ? pick([0, 0, 25, -40, 12.5]) : 0 });
  }
  const memberLoads: StiffnessMemberLoad[] = [];
  if (mode === 'frame') {
    const n = Math.floor(r() * 4);
    for (let k = 0; k < n && members.length > 0; k++) {
      const member = Math.floor(r() * members.length);
      const dx = nodes[members[member].j].x - nodes[members[member].i].x;
      const dy = nodes[members[member].j].y - nodes[members[member].i].y;
      const L = Math.hypot(dx, dy);
      const kind = pick(['udl', 'point', 'axial'] as const);
      if (kind === 'udl') memberLoads.push({ kind, member, w: pick([-1, -2.5, 1.5, -0.5, 4]) });
      else if (kind === 'axial') memberLoads.push({ kind, member, q: pick([1, -2, 0.5]) });
      else memberLoads.push({ kind, member, a: L * pick([0.25, 0.5, 0.75, 0.125, 0.375]), P: pick([-10, 20, -5, 7.5]) });
    }
  }
  return { mode, nodes, members, supports, loads, memberLoads };
}

/** A structure that is stable by construction: every node reached from the first by a Pythagorean member and the first node fully fixed (frame) or pinned with a roller (truss triangulated). */
export function stableSpec(seed: number, opts: GenOptions = {}): OSpec {
  const spec = randomSpec(seed, { ...opts, extra: opts.extra ?? 0.6 });
  if (spec.mode === 'frame') {
    // A frame stands on one fixed support, whatever the rest.
    const rest = spec.supports.filter((s) => s.node !== 0);
    spec.supports = [{ node: 0, ux: true, uy: true, rz: true }, ...rest];
  }
  return spec;
}
