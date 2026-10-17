import type { FrameMemberLoad, FrameModel } from './types';

/**
 * ─────────────────────────────────────────────────────────────────────────────
 * PLANE FRAME — the oracle the engine is tested against, and the generator of frames
 * ─────────────────────────────────────────────────────────────────────────────
 * Not part of the calculator (the name does not match the test glob). It shares NO CODE with
 * engine.ts or element.ts: its own arithmetic (exact fractions of BigInts), its own fixed-end
 * forces (the loads are INTEGRATED against the Hermite polynomials as exact polynomials, where
 * the engine uses Gauss quadrature), its own condensation of hinges, its own treatment of
 * supports (Lagrange multipliers: the reaction is an unknown and the support an equation, where
 * the engine eliminates the constrained displacement), its own way of solving (fraction-free
 * Gauss–Jordan: Montante/Bareiss) and its own internal forces (M(x), V(x), N(x) written
 * straight from the free body to the left of the cut, where the engine integrates piece by piece).
 *
 * Exact where the geometry allows: every member is axis-aligned or a 3-4-5 triangle
 * (the cosine and the sine are fractions), every section property and load a dyadic
 * rational. A support's line is (a, b) with √(a² + b²) an integer. A singular system is
 * answered with null: a mechanism, which the engine must report as one.
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
const isqrt = (n: bigint): bigint => {
  if (n < BigInt(2)) return n;
  let x = B1 << BigInt(Math.ceil(n.toString(2).length / 2));
  for (;;) {
    const y = (x + n / x) >> B1;
    if (y >= x) return x;
    x = y;
  }
};
/** √a for a fraction that is a perfect square (throws otherwise: the generator only builds those). */
export function sqrtExact(a: Q): Q {
  const rn = isqrt(a.n);
  const rd = isqrt(a.d);
  if (rn * rn !== a.n || rd * rd !== a.d) throw new Error('not a perfect square');
  return q(rn, rd);
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

/* ── Polynomials over Q (ascending) ───────────────────────────────────── */

type QP = Q[];
const pmul = (a: QP, b: QP): QP => {
  const out: QP = Array.from({ length: a.length + b.length - 1 }, () => ZERO);
  a.forEach((x, i) => b.forEach((y, j) => (out[i + j] = add(out[i + j], mul(x, y)))));
  return out;
};
const peval = (p: QP, x: Q): Q => p.reduceRight((s, c) => add(mul(s, x), c), ZERO);
const pint = (p: QP): QP => [ZERO, ...p.map((c, k) => div(c, q(k + 1)))];
const pder = (p: QP): QP => (p.length <= 1 ? [ZERO] : p.slice(1).map((c, k) => mul(c, q(k + 1))));
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
  rs: boolean;
  re: boolean;
  h?: number;
}
export interface OSupport {
  node: number;
  kind: 'fixed' | 'pin' | 'roller' | 'guide' | 'spring';
  /** The restrained line (roller, guide) as integers (a, b) with √(a²+b²) an integer. */
  line?: [number, number];
  kx?: number;
  ky?: number;
  kr?: number;
  dx?: number;
  dy?: number;
  dr?: number;
}
export interface OSpec {
  nodes: { x: number; y: number }[];
  members: OMember[];
  supports: OSupport[];
  loads: { node: number; fx: number; fy: number; m: number }[];
  memberLoads: FrameMemberLoad[];
}

/** The engine's model for a specification. */
export function toModel(spec: OSpec): FrameModel {
  return {
    nodes: spec.nodes.map((n) => ({ ...n })),
    members: spec.members.map((m) => ({ i: m.i, j: m.j, E: m.E, A: m.A, I: m.I, ...(m.rs || m.re ? { releases: { start: m.rs, end: m.re } } : {}), ...(m.h !== undefined ? { h: m.h } : {}) })),
    supports: spec.supports.map((s) => ({
      node: s.node,
      kind: s.kind,
      ...(s.line ? { angle: (Math.atan2(s.line[1], s.line[0]) * 180) / Math.PI } : {}),
      ...(s.kx ? { kx: s.kx } : {}),
      ...(s.ky ? { ky: s.ky } : {}),
      ...(s.kr ? { kr: s.kr } : {}),
      ...(s.dx ? { dx: s.dx } : {}),
      ...(s.dy ? { dy: s.dy } : {}),
      ...(s.dr ? { dr: s.dr } : {}),
    })),
    loads: spec.loads.map((l) => ({ ...l })),
    memberLoads: spec.memberLoads.map((l) => ({ ...l })),
  };
}

/* ── The solution ─────────────────────────────────────────────────────── */

export interface OResult {
  /** Global displacements (3 per node). */
  u: number[];
  /** Per support: the force and moment on the structure, springs included. */
  reactions: { rx: number; ry: number; rm: number }[];
  /** Per member: what the nodes exert on it, local axes. */
  forces: number[][];
  /** Internal forces at x (distance from node i), exact. */
  at(member: number, x: number, side?: 'left' | 'right'): { N: number; V: number; M: number };
  /** The sums of the loads and the reactions about the origin (should be zero). */
  residual: { fx: number; fy: number; m: number };
}

interface QMember {
  i: number;
  j: number;
  L: Q;
  c: Q;
  s: Q;
  EA: Q;
  EI: Q;
  rs: boolean;
  re: boolean;
  dist: { a: Q; b: Q; qy1: Q; qy2: Q; qx1: Q; qx2: Q }[];
  points: { a: Q; Px: Q; Py: Q }[];
  moments: { a: Q; C: Q }[];
  eps0: Q;
  curv0: Q;
}

const matZero = (n: number, m: number = n): Q[][] => Array.from({ length: n }, () => Array.from({ length: m }, () => ZERO));

function localK(EA: Q, EI: Q, L: Q): Q[][] {
  const k = matZero(6);
  const L2 = mul(L, L);
  const L3 = mul(L2, L);
  const a = div(EA, L);
  const b = div(mul(q(12), EI), L3);
  const c = div(mul(q(6), EI), L2);
  const d = div(mul(q(4), EI), L);
  const e = div(mul(q(2), EI), L);
  const set = (i: number, j: number, v: Q) => {
    k[i][j] = v;
    k[j][i] = v;
  };
  set(0, 0, a);
  set(3, 3, a);
  set(0, 3, neg(a));
  set(1, 1, b);
  set(4, 4, b);
  set(1, 4, neg(b));
  set(1, 2, c);
  set(1, 5, c);
  set(2, 4, neg(c));
  set(4, 5, neg(c));
  set(2, 2, d);
  set(5, 5, d);
  set(2, 5, e);
  return k;
}

/** The Hermite and linear shape functions of a member of length L as exact polynomials in x. */
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

/** Equivalent nodal loads: the loads INTEGRATED against the exact shape polynomials. */
function equivalent(m: QMember): Q[] {
  const p: Q[] = [ZERO, ZERO, ZERO, ZERO, ZERO, ZERO];
  const sh = shapes(m.L);
  const addTo = (idx: number, v: Q) => (p[idx] = add(p[idx], v));
  for (const d of m.dist) {
    const len = sub(d.b, d.a);
    const my = div(sub(d.qy2, d.qy1), len);
    const mx = div(sub(d.qx2, d.qx1), len);
    const qy: QP = [sub(d.qy1, mul(my, d.a)), my];
    const qx: QP = [sub(d.qx1, mul(mx, d.a)), mx];
    [1, 2, 4, 5].forEach((idx, k) => addTo(idx, integrate(pmul(qy, sh.bend[k]), d.a, d.b)));
    addTo(0, integrate(pmul(qx, sh.axial[0]), d.a, d.b));
    addTo(3, integrate(pmul(qx, sh.axial[1]), d.a, d.b));
  }
  for (const pt of m.points) {
    [1, 2, 4, 5].forEach((idx, k) => addTo(idx, mul(pt.Py, peval(sh.bend[k], pt.a))));
    addTo(0, mul(pt.Px, peval(sh.axial[0], pt.a)));
    addTo(3, mul(pt.Px, peval(sh.axial[1], pt.a)));
  }
  for (const mo of m.moments) [1, 2, 4, 5].forEach((idx, k) => addTo(idx, mul(mo.C, peval(pder(sh.bend[k]), mo.a))));
  // Thermal: ∫ EA ε₀ N_a' dx and ∫ EI κ₀ N_k'' dx over the member.
  const zero = ZERO;
  addTo(0, integrate([mul(m.EA, m.eps0)].map((c) => mul(c, sh.axial[0][1])), zero, m.L));
  addTo(3, integrate([mul(m.EA, m.eps0)].map((c) => mul(c, sh.axial[1][1])), zero, m.L));
  [1, 2, 4, 5].forEach((idx, k) => addTo(idx, integrate(pder(pder(sh.bend[k])).map((c) => mul(mul(m.EI, m.curv0), c)), zero, m.L)));
  return p;
}

function condenseQ(k: Q[][], p: Q[], rs: boolean, re: boolean): { k: Q[][]; p: Q[] } {
  const C = [...(rs ? [2] : []), ...(re ? [5] : [])];
  if (C.length === 0) return { k, p };
  const R = [0, 1, 2, 3, 4, 5].filter((i) => !C.includes(i));
  const kcc = C.map((c) => C.map((e) => k[c][e]));
  const kStar = matZero(6);
  const pStar: Q[] = [ZERO, ZERO, ZERO, ZERO, ZERO, ZERO];
  const pc = solveExact(kcc, C.map((c) => p[c]))!;
  for (const r of R) {
    for (const s of R) {
      const col = solveExact(kcc, C.map((c) => k[c][s]))!;
      kStar[r][s] = sub(k[r][s], C.reduce((acc, c, n) => add(acc, mul(k[r][c], col[n])), ZERO));
    }
    pStar[r] = sub(p[r], C.reduce((acc, c, n) => add(acc, mul(k[r][c], pc[n])), ZERO));
  }
  return { k: kStar, p: pStar };
}

function along(dir: string, w: Q, c: Q, s: Q): [Q, Q] {
  if (dir === 'local-x') return [w, ZERO];
  if (dir === 'local-y') return [ZERO, w];
  if (dir === 'global-x') return [mul(w, c), neg(mul(w, s))];
  return [mul(w, s), mul(w, c)];
}

export function solveOracle(spec: OSpec): OResult | null {
  const n = spec.nodes.length;
  const N3 = 3 * n;
  const nodes = spec.nodes.map((p) => ({ x: fromNumber(p.x), y: fromNumber(p.y) }));
  const mems: QMember[] = spec.members.map((m, mi) => {
    const dx = sub(nodes[m.j].x, nodes[m.i].x);
    const dy = sub(nodes[m.j].y, nodes[m.i].y);
    const L = sqrtExact(add(mul(dx, dx), mul(dy, dy)));
    const c = div(dx, L);
    const s = div(dy, L);
    const qm: QMember = { i: m.i, j: m.j, L, c, s, EA: mul(fromNumber(m.E), fromNumber(m.A)), EI: mul(fromNumber(m.E), fromNumber(m.I)), rs: m.rs, re: m.re, dist: [], points: [], moments: [], eps0: ZERO, curv0: ZERO };
    for (const l of spec.memberLoads) {
      if (l.member !== mi) continue;
      switch (l.kind) {
        case 'udl': {
          const [qx, qy] = along(l.dir, fromNumber(l.w), c, s);
          qm.dist.push({ a: ZERO, b: L, qx1: qx, qx2: qx, qy1: qy, qy2: qy });
          break;
        }
        case 'udl-projected': {
          const proj = l.dir === 'global-y' ? (c.n < B0 ? neg(c) : c) : s.n < B0 ? neg(s) : s;
          const [qx, qy] = along(l.dir, mul(fromNumber(l.w), proj), c, s);
          qm.dist.push({ a: ZERO, b: L, qx1: qx, qx2: qx, qy1: qy, qy2: qy });
          break;
        }
        case 'trapezoid': {
          const [x1, y1] = along(l.dir, fromNumber(l.w1), c, s);
          const [x2, y2] = along(l.dir, fromNumber(l.w2), c, s);
          qm.dist.push({ a: fromNumber(l.a), b: fromNumber(l.b), qx1: x1, qx2: x2, qy1: y1, qy2: y2 });
          break;
        }
        case 'point': {
          const [px, py] = along(l.dir, fromNumber(l.P), c, s);
          qm.points.push({ a: fromNumber(l.a), Px: px, Py: py });
          break;
        }
        case 'moment':
          qm.moments.push({ a: fromNumber(l.a), C: fromNumber(l.M) });
          break;
        case 'temperature':
          qm.eps0 = add(qm.eps0, mul(fromNumber(l.alpha), fromNumber(l.dT)));
          if (l.dTg !== 0) qm.curv0 = sub(qm.curv0, div(mul(fromNumber(l.alpha), fromNumber(l.dTg)), fromNumber(m.h!)));
          break;
      }
    }
    return qm;
  });

  const K = matZero(N3);
  const F: Q[] = Array.from({ length: N3 }, () => ZERO);
  for (const l of spec.loads) {
    F[3 * l.node] = add(F[3 * l.node], fromNumber(l.fx));
    F[3 * l.node + 1] = add(F[3 * l.node + 1], fromNumber(l.fy));
    F[3 * l.node + 2] = add(F[3 * l.node + 2], fromNumber(l.m));
  }
  const cond = mems.map((m) => condenseQ(localK(m.EA, m.EI, m.L), equivalent(m), m.rs, m.re));
  mems.forEach((m, mi) => {
    const R = matZero(6);
    for (const b of [0, 3]) {
      R[b][b] = m.c;
      R[b][b + 1] = m.s;
      R[b + 1][b] = neg(m.s);
      R[b + 1][b + 1] = m.c;
      R[b + 2][b + 2] = ONE;
    }
    const idx = [3 * m.i, 3 * m.i + 1, 3 * m.i + 2, 3 * m.j, 3 * m.j + 1, 3 * m.j + 2];
    // kg = Rᵀ k R
    const tmp = matZero(6);
    for (let a = 0; a < 6; a++) for (let b = 0; b < 6; b++) for (let c = 0; c < 6; c++) tmp[a][b] = add(tmp[a][b], mul(cond[mi].k[a][c], R[c][b]));
    for (let a = 0; a < 6; a++) for (let b = 0; b < 6; b++) {
      let s = ZERO;
      for (let c = 0; c < 6; c++) s = add(s, mul(R[c][a], tmp[c][b]));
      K[idx[a]][idx[b]] = add(K[idx[a]][idx[b]], s);
    }
    for (let a = 0; a < 6; a++) {
      let s = ZERO;
      for (let c = 0; c < 6; c++) s = add(s, mul(R[c][a], cond[mi].p[c]));
      F[idx[a]] = add(F[idx[a]], s);
    }
  });
  // Supports: springs into K and F; rigid restraints as equations.
  const rows: { coef: [number, Q][]; rhs: Q; support: number }[] = [];
  const springs: { node: number; k: [Q, Q, Q]; s: [Q, Q, Q] }[] = [];
  spec.supports.forEach((s, si) => {
    const dx = fromNumber(s.dx ?? 0);
    const dy = fromNumber(s.dy ?? 0);
    const dr = fromNumber(s.dr ?? 0);
    const k: [Q, Q, Q] = [fromNumber(s.kx ?? 0), fromNumber(s.ky ?? 0), fromNumber(s.kr ?? 0)];
    springs.push({ node: s.node, k, s: [dx, dy, dr] });
    for (let c = 0; c < 3; c++) {
      K[3 * s.node + c][3 * s.node + c] = add(K[3 * s.node + c][3 * s.node + c], k[c]);
      F[3 * s.node + c] = add(F[3 * s.node + c], mul(k[c], [dx, dy, dr][c]));
    }
    let nx = ZERO;
    let ny = ZERO;
    if (s.line) {
      const h = sqrtExact(q(s.line[0] * s.line[0] + s.line[1] * s.line[1]));
      nx = div(q(s.line[0]), h);
      ny = div(q(s.line[1]), h);
    }
    const base = 3 * s.node;
    if (s.kind === 'fixed' || s.kind === 'pin') {
      rows.push({ coef: [[base, ONE]], rhs: dx, support: si });
      rows.push({ coef: [[base + 1, ONE]], rhs: dy, support: si });
      if (s.kind === 'fixed') rows.push({ coef: [[base + 2, ONE]], rhs: dr, support: si });
    }
    if (s.kind === 'roller' || s.kind === 'guide') {
      rows.push({ coef: [[base, nx], [base + 1, ny]], rhs: add(mul(dx, nx), mul(dy, ny)), support: si });
      if (s.kind === 'guide') rows.push({ coef: [[base + 2, ONE]], rhs: dr, support: si });
    }
  });
  const nc = rows.length;
  const A = matZero(N3 + nc);
  const b: Q[] = Array.from({ length: N3 + nc }, () => ZERO);
  for (let i = 0; i < N3; i++) {
    for (let j = 0; j < N3; j++) A[i][j] = K[i][j];
    b[i] = F[i];
  }
  rows.forEach((r, ri) => {
    for (const [col, v] of r.coef) {
      A[N3 + ri][col] = v;
      A[col][N3 + ri] = v;
    }
    b[N3 + ri] = r.rhs;
  });
  const x = solveExact(A, b);
  if (!x) return null;
  const u = x.slice(0, N3);
  const lambda = x.slice(N3);

  // Reactions: the rigid part −Cᵀλ plus the springs −k(u − s).
  const reactions = spec.supports.map((s, si) => {
    const v: Q[] = [ZERO, ZERO, ZERO];
    rows.forEach((r, ri) => {
      if (r.support !== si) return;
      for (const [col, c] of r.coef) v[col - 3 * s.node] = sub(v[col - 3 * s.node], mul(c, lambda[ri]));
    });
    const sp = springs[si];
    for (let c = 0; c < 3; c++) v[c] = sub(v[c], mul(sp.k[c], sub(u[3 * s.node + c], sp.s[c])));
    return { rx: toNumber(v[0]), ry: toNumber(v[1]), rm: toNumber(v[2]) };
  });

  // Member end forces.
  const forces: Q[][] = mems.map((m, mi) => {
    const ug = [u[3 * m.i], u[3 * m.i + 1], u[3 * m.i + 2], u[3 * m.j], u[3 * m.j + 1], u[3 * m.j + 2]];
    const ul = [
      add(mul(m.c, ug[0]), mul(m.s, ug[1])),
      add(mul(neg(m.s), ug[0]), mul(m.c, ug[1])),
      ug[2],
      add(mul(m.c, ug[3]), mul(m.s, ug[4])),
      add(mul(neg(m.s), ug[3]), mul(m.c, ug[4])),
      ug[5],
    ];
    return cond[mi].k.map((row, r) => sub(row.reduce((acc, kv, cc) => add(acc, mul(kv, ul[cc])), ZERO), cond[mi].p[r]));
  });

  const at = (mi: number, xv: number, side: 'left' | 'right' = 'right'): { N: number; V: number; M: number } => {
    const m = mems[mi];
    const f = forces[mi];
    const X = fromNumber(xv);
    // The free body to the left of the cut; a load exactly at the cut counts on the right side only.
    const before = (a: Q) => (side === 'right' ? a.n * X.d <= X.n * a.d : a.n * X.d < X.n * a.d);
    let N = neg(f[0]);
    let V = f[1];
    let M = neg(f[2]);
    M = add(M, mul(f[1], X));
    for (const d of m.dist) {
      const lo = d.a;
      const hi = sub(d.b, X).n < B0 ? d.b : X;
      if (sub(hi, lo).n <= B0) continue;
      const len = sub(d.b, d.a);
      const sy = div(sub(d.qy2, d.qy1), len);
      const sx = div(sub(d.qx2, d.qx1), len);
      const w = sub(hi, lo);
      const dd = sub(X, d.a);
      V = add(V, add(mul(d.qy1, w), mul(sy, div(mul(w, w), q(2)))));
      N = sub(N, add(mul(d.qx1, w), mul(sx, div(mul(w, w), q(2)))));
      // ∫_0^w (q1 + s u)(dd − u) du
      const w2 = mul(w, w);
      const w3 = mul(w2, w);
      M = add(M, sub(add(mul(d.qy1, sub(mul(dd, w), div(w2, q(2)))), mul(sy, sub(mul(dd, div(w2, q(2))), div(w3, q(3))))), ZERO));
    }
    for (const p of m.points) {
      if (!before(p.a)) continue;
      V = add(V, p.Py);
      N = sub(N, p.Px);
      M = add(M, mul(p.Py, sub(X, p.a)));
    }
    for (const mo of m.moments) if (before(mo.a)) M = sub(M, mo.C);
    return { N: toNumber(N), V: toNumber(V), M: toNumber(M) };
  };

  // The loads and reactions about the origin.
  let rf = { fx: ZERO, fy: ZERO, m: ZERO };
  const addForce = (x0: Q, y0: Q, fx: Q, fy: Q, mm: Q) => {
    rf = { fx: add(rf.fx, fx), fy: add(rf.fy, fy), m: add(rf.m, add(sub(mul(x0, fy), mul(y0, fx)), mm)) };
  };
  for (const l of spec.loads) addForce(nodes[l.node].x, nodes[l.node].y, fromNumber(l.fx), fromNumber(l.fy), fromNumber(l.m));
  mems.forEach((m) => {
    // Resultant of the member loads from their definitions.
    let lx = ZERO;
    let ly = ZERO;
    let lm = ZERO;
    for (const d of m.dist) {
      const len = sub(d.b, d.a);
      lx = add(lx, mul(div(add(d.qx1, d.qx2), q(2)), len));
      ly = add(ly, mul(div(add(d.qy1, d.qy2), q(2)), len));
      const my = div(sub(d.qy2, d.qy1), len);
      const qy: QP = [sub(d.qy1, mul(my, d.a)), my];
      lm = add(lm, integrate(pmul(qy, [ZERO, ONE]), d.a, d.b));
    }
    for (const p of m.points) {
      lx = add(lx, p.Px);
      ly = add(ly, p.Py);
      lm = add(lm, mul(p.a, p.Py));
    }
    for (const mo of m.moments) lm = add(lm, mo.C);
    addForce(nodes[m.i].x, nodes[m.i].y, sub(mul(m.c, lx), mul(m.s, ly)), add(mul(m.s, lx), mul(m.c, ly)), lm);
  });
  spec.supports.forEach((s, si) => addForce(nodes[s.node].x, nodes[s.node].y, fromNumber(reactions[si].rx), fromNumber(reactions[si].ry), fromNumber(reactions[si].rm)));

  return {
    u: u.map(toNumber),
    reactions,
    forces: forces.map((f) => f.map(toNumber)),
    at,
    residual: { fx: toNumber(rf.fx), fy: toNumber(rf.fy), m: toNumber(rf.m) },
  };
}

/* ── Random frames ────────────────────────────────────────────────────── */

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

export interface GenOptions {
  maxNodes?: number;
  /** Probability that a member end is a hinge. */
  hinge?: number;
  /** Allow supports of the kinds 'guide' and 'spring', settlements. */
  exotic?: boolean;
  /** Member loads per frame at most. */
  loads?: number;
  /** Force a hinge-free frame. */
  noHinges?: boolean;
  /** No members beyond a spanning tree: with one fixed support such a frame is statically determinate. */
  tree?: boolean;
}

const VECTORS: [number, number][] = [
  [4, 0], [-4, 0], [0, 4], [0, -4], [6, 0], [-6, 0], [0, 6], [0, -6], [8, 0], [0, 8], [3, 4], [-3, 4], [4, 3], [-4, 3], [3, -4], [4, -3], [6, 8], [-6, 8], [8, 6], [-8, 6],
];
const LINES: [number, number][] = [[0, 1], [1, 0], [3, 4], [4, 3], [-3, 4], [-4, 3]];
/** A random valid frame (no duplicate members or nodes, connected), built from rational data. May be a mechanism: that is for the test to find out. */
export function randomFrame(seed: number, opt: GenOptions = {}): OSpec {
  const r = rng(seed);
  const pick = <T,>(xs: readonly T[]): T => xs[Math.floor(r() * xs.length)];
  const nNodes = 2 + Math.floor(r() * ((opt.maxNodes ?? 6) - 1));
  const nodes: { x: number; y: number }[] = [{ x: 0, y: 0 }];
  const edges: [number, number][] = [];
  const at = (x: number, y: number) => nodes.findIndex((p) => p.x === x && p.y === y);
  for (let k = 1; k < nNodes; k++) {
    for (let tries = 0; tries < 50; tries++) {
      const from = Math.floor(r() * nodes.length);
      const [vx, vy] = pick(VECTORS);
      const x = nodes[from].x + vx;
      const y = nodes[from].y + vy;
      if (at(x, y) >= 0) continue;
      nodes.push({ x, y });
      edges.push([from, nodes.length - 1]);
      break;
    }
  }
  const n = nodes.length;
  const has = (a: number, b: number) => edges.some(([p, s]) => (p === a && s === b) || (p === b && s === a));
  for (let a = 0; a < n; a++) {
    for (let b = a + 1; b < n; b++) {
      if (has(a, b) || opt.tree) continue;
      const dx = nodes[b].x - nodes[a].x;
      const dy = nodes[b].y - nodes[a].y;
      const l = Math.round(Math.hypot(dx, dy));
      if (l * l !== dx * dx + dy * dy) continue;
      if (r() < 0.45) edges.push([a, b]);
    }
  }
  const pHinge = opt.noHinges ? 0 : opt.hinge ?? 0.18;
  const members: OMember[] = edges.map(([i, j]) => ({
    i,
    j,
    E: pick([1000, 2000, 29000]),
    A: pick([5, 10, 40, 200]),
    I: pick([50, 100, 400, 1000, 3000]),
    rs: r() < pHinge,
    re: r() < pHinge,
    h: pick([1, 2, 0.5]),
  }));
  // Supports.
  const supports: OSupport[] = [];
  const nSup = 1 + Math.floor(r() * 3);
  const order = Array.from({ length: n }, (_, k) => k).sort(() => r() - 0.5);
  for (let k = 0; k < Math.min(nSup, n); k++) {
    const node = order[k];
    const roll = r();
    const sup: OSupport = { node, kind: roll < 0.3 ? 'fixed' : roll < 0.6 ? 'pin' : 'roller' };
    if (opt.exotic !== false) {
      if (roll >= 0.85 && roll < 0.93) sup.kind = 'guide';
      if (roll >= 0.93) {
        sup.kind = 'spring';
        sup.kx = pick([0, 30, 300]);
        sup.ky = pick([0, 30, 300]);
        sup.kr = pick([0, 200, 2000]);
      }
      if ((sup.kind === 'pin' || sup.kind === 'roller') && r() < 0.15) sup.kr = pick([200, 2000]);
      if (sup.kind === 'roller' && r() < 0.12) sup.kx = pick([30, 300]);
    }
    if (sup.kind === 'roller' || sup.kind === 'guide') sup.line = pick(LINES);
    if (opt.exotic !== false && r() < 0.2) {
      sup.dx = pick([0, 0.0625, -0.125]);
      sup.dy = pick([0, -0.0625, 0.25]);
      sup.dr = pick([0, 0.001953125, -0.00390625]);
    }
    supports.push(sup);
  }
  // Repair: a node where every member is hinged and nothing holds its rotation has a rotation that does not exist.
  for (let k = 0; k < n; k++) {
    const ends = members.flatMap((m) => [m.i === k ? (m.rs ? 'h' : 's') : '', m.j === k ? (m.re ? 'h' : 's') : '']).filter(Boolean);
    const sup = supports.find((s) => s.node === k);
    const holds = sup && (sup.kind === 'fixed' || sup.kind === 'guide' || (sup.kr ?? 0) > 0);
    if (ends.length > 0 && !ends.includes('s') && !holds) {
      const m = members.find((mm) => mm.i === k || mm.j === k)!;
      if (m.i === k) m.rs = false;
      else m.re = false;
    }
  }
  const loads: OSpec['loads'] = [];
  const nLoads = Math.floor(r() * 3);
  for (let k = 0; k < nLoads; k++) loads.push({ node: Math.floor(r() * n), fx: pick([0, 3, -5, 8]), fy: pick([0, -4, -10, 6]), m: pick([0, 0, 12, -20]) });
  const memberLoads: FrameMemberLoad[] = [];
  const nML = Math.floor(r() * ((opt.loads ?? 4) + 1));
  const dirs = ['local-y', 'local-x', 'global-x', 'global-y'] as const;
  for (let k = 0; k < nML; k++) {
    const mi = Math.floor(r() * members.length);
    const m = members[mi];
    const dx = nodes[m.j].x - nodes[m.i].x;
    const dy = nodes[m.j].y - nodes[m.i].y;
    const L = Math.round(Math.hypot(dx, dy));
    const pos = () => Math.floor(r() * (2 * L + 1)) / 2;
    const kind = pick(['udl', 'udl', 'udl-projected', 'trapezoid', 'point', 'point', 'moment', 'temperature'] as const);
    const val = () => pick([-1, -2, -3.5, 1, 2, 0.5, -0.25]);
    switch (kind) {
      case 'udl':
        memberLoads.push({ kind, member: mi, dir: pick(dirs), w: val() });
        break;
      case 'udl-projected':
        memberLoads.push({ kind, member: mi, dir: pick(['global-x', 'global-y'] as const), w: val() });
        break;
      case 'trapezoid': {
        const a = pos();
        const b = pos();
        if (a === b) break;
        memberLoads.push({ kind, member: mi, dir: pick(dirs), a: Math.min(a, b), b: Math.max(a, b), w1: val(), w2: val() });
        break;
      }
      case 'point':
        memberLoads.push({ kind, member: mi, dir: pick(dirs), a: pos(), P: pick([-4, -10, 6, 2.5]) });
        break;
      case 'moment':
        memberLoads.push({ kind, member: mi, a: pos(), M: pick([10, -15, 4]) });
        break;
      case 'temperature':
        memberLoads.push({ kind, member: mi, dT: pick([0, 40, -25]), dTg: pick([0, 0, 20, -30]), alpha: pick([1e-5, 2e-5]) });
        break;
    }
  }
  return { nodes, members, supports, loads, memberLoads };
}

/** The same frame, hinge-free, with every support fixed or pinned: stable, for the properties that need a solution. */
export function stableFrame(seed: number, opt: GenOptions = {}): OSpec {
  const spec = randomFrame(seed, { ...opt, exotic: false });
  for (const m of spec.members) {
    m.rs = false;
    m.re = false;
  }
  spec.supports.splice(0, spec.supports.length);
  const r = rng(seed ^ 0x9e3779b9);
  const first = 0;
  spec.supports.push({ node: first, kind: 'fixed' });
  if (spec.nodes.length > 2 && r() < 0.5) spec.supports.push({ node: spec.nodes.length - 1, kind: r() < 0.5 ? 'pin' : 'roller', line: [0, 1] });
  return spec;
}

/**
 * A portal with a very short bar in its beam (and sometimes a column or the beam made very stiff): the class that a
 * condensation by subtraction broke (a bar hinged at both ends has NO transverse stiffness, and 12EI/L³ minus an almost
 * equal number is not 0). The gap is 0.0011 to 0.125 ft (its decimal is exact in the oracle, which reads the double) in a frame 64 to 130 ft
 * across; the bar's hinges are both, one (either end) or none; the EI of one member is up to 10^`stiff` times the rest.
 */
export function stubFrame(seed: number, opt: { stiff?: number } = {}): OSpec {
  const r = rng(seed * 7919 + 13);
  const pick = <T,>(xs: readonly T[]): T => xs[Math.floor(r() * xs.length)];
  // Not a power of two: a gap of 1/512 ft makes every product exact in floating point and hides the very rounding being looked for.
  const g = pick([0.0011, 0.0013, 0.0021, 0.0037, 0.0069, 0.011, 0.033, 0.1, 0.125]);
  const a = pick([32, 40, 50]);
  const b = pick([32, 40, 50]);
  const h = pick([12, 16, 20]);
  const nodes = [{ x: 0, y: 0 }, { x: 0, y: h }, { x: a, y: h }, { x: a + g, y: h }, { x: a + g + b, y: h }, { x: a + g + b, y: 0 }];
  const kind = pick(['both', 'both', 'start', 'end', 'none'] as const);
  const sec = () => ({ E: pick([1000, 29000]), A: pick([5, 40, 200]), I: pick([100, 1000, 3000]) });
  const members: OMember[] = [
    { i: 0, j: 1, ...sec(), rs: false, re: false },
    { i: 1, j: 2, ...sec(), rs: false, re: false },
    { i: 2, j: 3, ...sec(), rs: kind === 'both' || kind === 'start', re: kind === 'both' || kind === 'end' },
    { i: 3, j: 4, ...sec(), rs: false, re: false },
    { i: 4, j: 5, ...sec(), rs: false, re: false },
  ];
  if (opt.stiff) {
    const m = members[Math.floor(r() * members.length)];
    m.I *= 10 ** Math.floor(r() * (opt.stiff + 1));
  }
  const supports: OSupport[] = [{ node: 0, kind: 'fixed' }, { node: 5, kind: pick(['fixed', 'pin'] as const) }];
  const loads: OSpec['loads'] = [{ node: pick([1, 2, 3, 4]), fx: pick([0, 3, -5]), fy: pick([-4, -10, 6]), m: pick([0, 12]) }];
  const memberLoads: FrameMemberLoad[] = [{ kind: 'udl', member: pick([1, 3]), dir: 'global-y', w: pick([-1, -2.5]) }];
  if (r() < 0.5) memberLoads.push({ kind: 'point', member: 2, dir: 'global-y', a: g / 2, P: pick([-3, 2]) });
  return { nodes, members, supports, loads, memberLoads };
}

/* ── Counting by rank ─────────────────────────────────────────────────── */

/** The rank of a matrix of fractions (Gauss–Jordan with exact fractions). */
export function rankQ(M: Q[][]): number {
  const A = M.map((r) => r.slice());
  const rows = A.length;
  const cols = rows === 0 ? 0 : A[0].length;
  let rank = 0;
  for (let c = 0; c < cols && rank < rows; c++) {
    let p = rank;
    while (p < rows && isZero(A[p][c])) p++;
    if (p === rows) continue;
    [A[p], A[rank]] = [A[rank], A[p]];
    for (let r = rank + 1; r < rows; r++) {
      if (isZero(A[r][c])) continue;
      const f = div(A[r][c], A[rank][c]);
      for (let k = c; k < cols; k++) A[r][k] = sub(A[r][k], mul(f, A[rank][k]));
    }
    rank++;
  }
  return rank;
}

/**
 * The statics of a specification WITHOUT the engine's formula: the equilibrium matrix B of the nodes (three equations per node) against the
 * unknown forces — for every member its axial force and the end moments that are not hinges (the shears follow from the moments), and
 * every reaction component of a rigid support — and its rank. The degree of indeterminacy is the number of unknown forces less the rank;
 * what is left of the equations (the rows that are not zero, less the rank) is the number of ways the frame can move with no member
 * deforming: mechanisms, rigid motions included. Springs are left out (the spec must have none).
 */
export function staticsOf(spec: OSpec): { degree: number; unknowns: number; rank: number; equations: number; free: number } {
  const n = spec.nodes.length;
  const cols: Q[][] = [];
  const col = (): Q[] => Array.from({ length: 3 * n }, () => ZERO);
  const nodes = spec.nodes.map((p) => ({ x: fromNumber(p.x), y: fromNumber(p.y) }));
  for (const m of spec.members) {
    const dx = sub(nodes[m.j].x, nodes[m.i].x);
    const dy = sub(nodes[m.j].y, nodes[m.i].y);
    const L = sqrtExact(add(mul(dx, dx), mul(dy, dy)));
    const c = div(dx, L);
    const s = div(dy, L);
    // The axial force N (tension): it pulls node i towards j and node j towards i.
    const axial = col();
    axial[3 * m.i] = c;
    axial[3 * m.i + 1] = s;
    axial[3 * m.j] = neg(c);
    axial[3 * m.j + 1] = neg(s);
    cols.push(axial);
    // An end moment (the node's moment on the member, counter-clockwise): the member's shear follows from the two, and the nodes receive
    // the opposite of what the member receives.
    const moment = (at: 'i' | 'j') => {
      const v = col();
      const node = at === 'i' ? m.i : m.j;
      v[3 * node + 2] = neg(ONE);
      const share = div(ONE, L);
      v[3 * m.i] = add(v[3 * m.i], mul(share, s));
      v[3 * m.i + 1] = sub(v[3 * m.i + 1], mul(share, c));
      v[3 * m.j] = sub(v[3 * m.j], mul(share, s));
      v[3 * m.j + 1] = add(v[3 * m.j + 1], mul(share, c));
      return v;
    };
    if (!m.rs) cols.push(moment('i'));
    if (!m.re) cols.push(moment('j'));
  }
  for (const s of spec.supports) {
    const base = 3 * s.node;
    const unit = (k: number, v: Q) => {
      const w = col();
      w[base + k] = v;
      return w;
    };
    if (s.kind === 'fixed' || s.kind === 'pin') {
      cols.push(unit(0, ONE), unit(1, ONE));
      if (s.kind === 'fixed') cols.push(unit(2, ONE));
    }
    if (s.kind === 'roller' || s.kind === 'guide') {
      const h = sqrtExact(q(s.line![0] * s.line![0] + s.line![1] * s.line![1]));
      const w = col();
      w[base] = div(q(s.line![0]), h);
      w[base + 1] = div(q(s.line![1]), h);
      cols.push(w);
      if (s.kind === 'guide') cols.push(unit(2, ONE));
    }
  }
  const rowsUsed = Array.from({ length: 3 * n }, (_, r) => r).filter((r) => cols.some((c) => !isZero(c[r])));
  const B = rowsUsed.map((r) => cols.map((c) => c[r]));
  const rank = B.length === 0 ? 0 : rankQ(B);
  return { degree: cols.length - rank, unknowns: cols.length, rank, equations: rowsUsed.length, free: rowsUsed.length - rank };
}
