/**
 * ─────────────────────────────────────────────────────────────────────────────
 * TRUSS — the oracle the engine is tested against, and the generators of trusses
 * ─────────────────────────────────────────────────────────────────────────────
 * Not part of the calculator: a test library (the name does not match the test
 * glob). It shares NO CODE with engine.ts: its own arithmetic (exact fractions
 * of BigInts), its own assembly of the equations, its own way of solving them
 * (fraction-free Gauss–Jordan elimination, Montante's/Bareiss' method: every
 * division in it is exact) and its own way of treating a support (Lagrange
 * multipliers: the reaction is an unknown and the support an equation, where
 * the engine eliminates the constrained displacement).
 *
 *   — A DETERMINATE truss (m + r = 2j) is solved by the equilibrium of its
 *     joints: the unknowns are the member forces and the reaction components,
 *     there is one equation for each component of each joint, and E·A is nowhere
 *     in them.
 *   — An INDETERMINATE truss (m + r > 2j) is solved by its stiffness equations
 *     with the supports as constraints: K u − R = F, C u = 0, in the unknowns
 *     (u, R). (A determinate one can be put through this as well, and the two
 *     routes are compared in oracle.test.ts.)
 *
 * The numbers are exact where they can be. A member's length is a square root:
 * where the square of the length is a perfect square of a fraction the length
 * is that fraction, exactly (members that are horizontal, vertical, 3-4-5,
 * 5-12-13…); where it is not, the length is taken to 2⁻⁶⁴ — a relative error
 * of 1e-19, nine orders under anything the engine's floating point is asked
 * to match — and the equations are then solved EXACTLY for those numbers.
 */

/* ── Fractions ────────────────────────────────────────────────────────── */

export const B0 = BigInt(0);
export const B1 = BigInt(1);
export const B2 = BigInt(2);

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
export const isZero = (a: Q): boolean => a.n === B0;
export const ZERO: Q = { n: B0, d: B1 };
export const ONE: Q = { n: B1, d: B1 };

const bitLength = (a: bigint): number => (a === B0 ? 0 : abs(a).toString(2).length);

/** A fraction as a double, to a relative error of 2⁻⁵² (not under 2⁻²⁰⁰ in size). */
export function toNumber(a: Q): number {
  if (a.n === B0) return 0;
  const shift = BigInt(200);
  const negative = a.n < B0;
  const scaled = (abs(a.n) << shift) / a.d;
  const v = Number(scaled) / 2 ** Number(shift);
  return negative ? -v : v;
}

/** floor(√n) by Newton's method. */
export function isqrt(n: bigint): bigint {
  if (n < B0) throw new Error('negative');
  if (n < B2) return n;
  let x = B1 << BigInt(Math.ceil(bitLength(n) / 2));
  for (;;) {
    const y = (x + n / x) >> B1;
    if (y >= x) return x;
    x = y;
  }
}

/** √(a): exact when it is the square of a fraction, otherwise to 2⁻⁶⁴. */
export function sqrtQ(a: Q): Q {
  const rn = isqrt(a.n);
  const rd = isqrt(a.d);
  if (rn * rn === a.n && rd * rd === a.d) return q(rn, rd);
  const B = BigInt(64);
  const root = isqrt((a.n << (B2 * B)) / a.d);
  return q(root, B1 << B);
}

/* ── Exact solution of a square system ────────────────────────────────── */

/**
 * Solves A x = b exactly, or returns null if A is singular. Each row is first
 * made integer by its common denominator; then fraction-free Gauss–Jordan
 * (Montante): after the pivot k, every other row i becomes
 * (M[k][k]·M[i][j] − M[i][k]·M[k][j]) / (the previous pivot) — an exact division
 * — and at the end every diagonal entry is the determinant and the last column is
 * det·x.
 */
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
  // Each row's diagonal is the determinant (row i: M[i][i] = det after the last step).
  return M.map((row, i) => q(row[n], row[i]));
}

/* ── The oracle ───────────────────────────────────────────────────────── */

export interface OSupport {
  node: number;
  kind: 'pin' | 'roller';
  /** A roller's direction as an exact unit vector (cos, sin). */
  c?: Q;
  s?: Q;
}
export interface OCase {
  nodes: { x: Q; y: Q }[];
  members: { i: number; j: number; ea: Q }[];
  supports: OSupport[];
  loads: { node: number; fx: Q; fy: Q }[];
}
export interface OResult {
  N: number[];
  /** Per support, in order: the components of the force on the truss. */
  reactions: { rx: number; ry: number }[];
  /** Which route solved it. */
  route: 'equilibrium' | 'stiffness';
}

interface Geometry {
  L: Q;
  c: Q;
  s: Q;
}

function geometry(c: OCase): Geometry[] {
  return c.members.map((m) => {
    const dx = sub(c.nodes[m.j].x, c.nodes[m.i].x);
    const dy = sub(c.nodes[m.j].y, c.nodes[m.i].y);
    const L = sqrtQ(add(mul(dx, dx), mul(dy, dy)));
    return { L, c: div(dx, L), s: div(dy, L) };
  });
}

const zeros = (n: number): Q[] => Array.from({ length: n }, () => ZERO);
const grid = (r: number, cols: number): Q[][] => Array.from({ length: r }, () => zeros(cols));

/** The reaction unknowns: for each support, the columns it adds and the direction of each. */
function reactionColumns(c: OCase): { support: number; node: number; dir: [Q, Q] }[] {
  const out: { support: number; node: number; dir: [Q, Q] }[] = [];
  c.supports.forEach((sp, k) => {
    if (sp.kind === 'pin') out.push({ support: k, node: sp.node, dir: [ONE, ZERO] }, { support: k, node: sp.node, dir: [ZERO, ONE] });
    else out.push({ support: k, node: sp.node, dir: [sp.c!, sp.s!] });
  });
  return out;
}

export function oracle(c: OCase, route?: 'equilibrium' | 'stiffness'): OResult | null {
  const j = c.nodes.length;
  const m = c.members.length;
  const cols = reactionColumns(c);
  const r = cols.length;
  const geo = geometry(c);
  const F = nodeLoads(c);
  const useRoute = route ?? (m + r === 2 * j ? 'equilibrium' : 'stiffness');
  if (useRoute === 'equilibrium' && m + r !== 2 * j) return null;
  const reactionsOf = (values: Q[]) => {
    const out = c.supports.map(() => ({ rx: ZERO, ry: ZERO }));
    cols.forEach((col, k) => {
      const v = values[k];
      out[col.support] = { rx: add(out[col.support].rx, mul(v, col.dir[0])), ry: add(out[col.support].ry, mul(v, col.dir[1])) };
    });
    return out.map((o) => ({ rx: toNumber(o.rx), ry: toNumber(o.ry) }));
  };

  if (useRoute === 'equilibrium') {
    // Unknowns: N_0..N_{m-1}, then one per reaction column. One equation per component of each node.
    const A = grid(2 * j, m + r);
    const b = zeros(2 * j);
    c.members.forEach((mem, k) => {
      A[2 * mem.i][k] = add(A[2 * mem.i][k], geo[k].c);
      A[2 * mem.i + 1][k] = add(A[2 * mem.i + 1][k], geo[k].s);
      A[2 * mem.j][k] = sub(A[2 * mem.j][k], geo[k].c);
      A[2 * mem.j + 1][k] = sub(A[2 * mem.j + 1][k], geo[k].s);
    });
    cols.forEach((col, k) => {
      A[2 * col.node][m + k] = add(A[2 * col.node][m + k], col.dir[0]);
      A[2 * col.node + 1][m + k] = add(A[2 * col.node + 1][m + k], col.dir[1]);
    });
    for (let a = 0; a < j; a++) {
      b[2 * a] = neg(F[a][0]);
      b[2 * a + 1] = neg(F[a][1]);
    }
    const x = solveExact(A, b);
    if (!x) return null;
    return { N: x.slice(0, m).map(toNumber), reactions: reactionsOf(x.slice(m)), route: 'equilibrium' };
  }

  // Stiffness: unknowns u (2j) then the reaction magnitudes (r). Equations: K u − Σ R = F at each dof; one constraint per reaction column.
  const A = grid(2 * j + r, 2 * j + r);
  const b = zeros(2 * j + r);
  c.members.forEach((mem, k) => {
    const w = div(mem.ea, geo[k].L);
    const cc = mul(w, mul(geo[k].c, geo[k].c));
    const cs = mul(w, mul(geo[k].c, geo[k].s));
    const ss = mul(w, mul(geo[k].s, geo[k].s));
    const at = (a: number, bb: number, dx: number, dy: number, v: Q) => (A[2 * a + dx][2 * bb + dy] = add(A[2 * a + dx][2 * bb + dy], v));
    for (const [p, sp] of [[mem.i, 1], [mem.j, -1]] as const) {
      for (const [qn, sq] of [[mem.i, 1], [mem.j, -1]] as const) {
        const sign = sp * sq;
        const f = (v: Q) => (sign > 0 ? v : neg(v));
        at(p, qn, 0, 0, f(cc));
        at(p, qn, 0, 1, f(cs));
        at(p, qn, 1, 0, f(cs));
        at(p, qn, 1, 1, f(ss));
      }
    }
  });
  cols.forEach((col, k) => {
    A[2 * col.node][2 * j + k] = sub(A[2 * col.node][2 * j + k], col.dir[0]);
    A[2 * col.node + 1][2 * j + k] = sub(A[2 * col.node + 1][2 * j + k], col.dir[1]);
    // The constraint: the displacement of the node along the reaction's direction is nothing.
    A[2 * j + k][2 * col.node] = col.dir[0];
    A[2 * j + k][2 * col.node + 1] = col.dir[1];
  });
  for (let a = 0; a < j; a++) {
    b[2 * a] = F[a][0];
    b[2 * a + 1] = F[a][1];
  }
  const x = solveExact(A, b);
  if (!x) return null;
  const N = c.members.map((mem, k) => {
    const du = add(mul(sub(x[2 * mem.j], x[2 * mem.i]), geo[k].c), mul(sub(x[2 * mem.j + 1], x[2 * mem.i + 1]), geo[k].s));
    return toNumber(mul(div(mem.ea, geo[k].L), du));
  });
  return { N, reactions: reactionsOf(x.slice(2 * j)), route: 'stiffness' };
}

function nodeLoads(c: OCase): [Q, Q][] {
  const F: [Q, Q][] = c.nodes.map(() => [ZERO, ZERO]);
  for (const l of c.loads) F[l.node] = [add(F[l.node][0], l.fx), add(F[l.node][1], l.fy)];
  return F;
}

/* ── Random trusses ───────────────────────────────────────────────────── */

/** A seeded generator (mulberry32): the same seed is the same sequence. */
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

export const pick = <T>(rand: () => number, list: readonly T[]): T => list[Math.floor(rand() * list.length)];
export const int = (rand: () => number, lo: number, hi: number): number => lo + Math.floor(rand() * (hi - lo + 1));

/** Roller directions with an exact (cos, sin), and the angle in degrees the engine is given for each. */
export const DIRECTIONS: { c: Q; s: Q; angle: number }[] = [
  { c: q(1), s: q(0), angle: 0 },
  { c: q(0), s: q(1), angle: 90 },
  { c: q(3, 5), s: q(4, 5), angle: (Math.atan2(4, 3) * 180) / Math.PI },
  { c: q(4, 5), s: q(3, 5), angle: (Math.atan2(3, 4) * 180) / Math.PI },
  { c: q(-3, 5), s: q(4, 5), angle: (Math.atan2(4, -3) * 180) / Math.PI },
  { c: q(5, 13), s: q(12, 13), angle: (Math.atan2(12, 5) * 180) / Math.PI },
  { c: q(-12, 13), s: q(5, 13), angle: (Math.atan2(5, -12) * 180) / Math.PI },
];

export interface Generated {
  /** For the engine (floating point). */
  model: {
    nodes: { x: number; y: number }[];
    members: { i: number; j: number; A?: number; E?: number }[];
    supports: { node: number; kind: 'pin' | 'roller'; angle?: number }[];
    loads: { node: number; fx: number; fy: number }[];
    E?: number;
    A?: number;
  };
  /** For the oracle (exact). */
  exact: OCase;
  determinate: boolean;
}

export interface GenOptions {
  /** Joints. */
  nodes: [number, number];
  /** Extra members past the rigid ones (0: a determinate truss on a pin and a roller). */
  extra: [number, number];
  /** Extra supports (each turns a member of the truss into a redundant). */
  extraSupports?: [number, number];
  /** Coordinates are integers in 0..grid. */
  grid?: number;
  /** Member E·A are random integers in 1..ea when the truss is indeterminate and absolute; 0: all equal. */
  ea?: number;
  /** Lattice of 3-4-5 steps: most members have rational lengths. */
  pythagorean?: boolean;
}

/**
 * A random truss. Joints are added one at a time, each joined by two members to
 * two joints already there (so the truss is rigid unless the two members lie on
 * one line, which is refused), then extra members, a pin and a roller (and
 * extra supports), and random loads. May be unstable by the supports' placement
 * (the roller's line passing through the pin): the oracle then says singular.
 */
export function generate(rand: () => number, o: GenOptions): Generated {
  const g = o.grid ?? 8;
  const target = int(rand, o.nodes[0], o.nodes[1]);
  const pts: [number, number][] = [];
  const step = o.pythagorean ? pick(rand, [[3, 4], [4, 3], [5, 0], [0, 5], [6, 8], [5, 12], [12, 5], [8, 6]] as const) : null;
  const same = (a: [number, number], b: [number, number]) => a[0] === b[0] && a[1] === b[1];
  const mems: [number, number][] = [];
  const has = (a: number, b: number) => mems.some((m) => (m[0] === a && m[1] === b) || (m[0] === b && m[1] === a));
  pts.push([0, 0]);
  pts.push(o.pythagorean ? [step![0], step![1]] : [int(rand, 1, g), int(rand, 0, g)]);
  mems.push([0, 1]);
  let guard = 0;
  while (pts.length < target && guard++ < 500) {
    const a = int(rand, 0, pts.length - 1);
    const b = int(rand, 0, pts.length - 1);
    if (a === b) continue;
    const p: [number, number] = o.pythagorean ? [pts[a][0] + pick(rand, [-1, 1]) * pick(rand, [0, 3, 4, 5, 6, 8, 12]) , pts[a][1] + pick(rand, [-1, 1]) * pick(rand, [0, 3, 4, 5, 6, 8, 12])] : [int(rand, 0, g), int(rand, 0, g)];
    if (pts.some((q2) => same(q2, p))) continue;
    // Not on the line through the two joints it will hang from.
    const cross = (pts[b][0] - pts[a][0]) * (p[1] - pts[a][1]) - (pts[b][1] - pts[a][1]) * (p[0] - pts[a][0]);
    if (cross === 0) continue;
    pts.push(p);
    mems.push([a, pts.length - 1], [b, pts.length - 1]);
  }
  const nPts = pts.length;
  const extraWant = int(rand, o.extra[0], o.extra[1]);
  for (let tries = 0, added = 0; added < extraWant && tries < 200; tries++) {
    const a = int(rand, 0, nPts - 1);
    const b = int(rand, 0, nPts - 1);
    if (a === b || has(a, b)) continue;
    mems.push([a, b]);
    added++;
  }
  const exactEA = (): Q => q(o.ea ? int(rand, 1, o.ea) : 1);
  const eas = mems.map(() => exactEA());

  const supports: OSupport[] = [];
  const engineSupports: Generated['model']['supports'] = [];
  const free = Array.from({ length: nPts }, (_, k) => k);
  const takeNode = (): number => free.splice(int(rand, 0, free.length - 1), 1)[0];
  const pinNode = takeNode();
  supports.push({ node: pinNode, kind: 'pin' });
  engineSupports.push({ node: pinNode, kind: 'pin' });
  const addRoller = () => {
    if (free.length === 0) return;
    const node = takeNode();
    const d = pick(rand, DIRECTIONS);
    supports.push({ node, kind: 'roller', c: d.c, s: d.s });
    engineSupports.push({ node, kind: 'roller', angle: d.angle });
  };
  addRoller();
  const more = o.extraSupports ? int(rand, o.extraSupports[0], o.extraSupports[1]) : 0;
  for (let k = 0; k < more; k++) {
    if (rand() < 0.3 && free.length > 0) {
      const node = takeNode();
      supports.push({ node, kind: 'pin' });
      engineSupports.push({ node, kind: 'pin' });
    } else addRoller();
  }

  const loads: { node: number; fx: number; fy: number }[] = [];
  const nLoads = int(rand, 1, Math.max(1, Math.ceil(nPts / 2)));
  for (let k = 0; k < nLoads; k++) loads.push({ node: int(rand, 0, nPts - 1), fx: int(rand, -9, 9), fy: int(rand, -9, 9) });

  const reactions = engineSupports.reduce((s, sp) => s + (sp.kind === 'pin' ? 2 : 1), 0);
  const determinate = mems.length + reactions === 2 * nPts;
  const absolute = !!o.ea && !determinate;
  return {
    model: {
      nodes: pts.map(([x, y]) => ({ x, y })),
      members: mems.map(([i, j], k) => ({ i, j, ...(absolute ? { A: Number(eas[k].n), E: 1 } : {}) })),
      supports: engineSupports,
      loads,
      ...(absolute ? {} : {}),
    },
    exact: {
      nodes: pts.map(([x, y]) => ({ x: q(x), y: q(y) })),
      members: mems.map(([i, j], k) => ({ i, j, ea: absolute ? eas[k] : ONE })),
      supports,
      loads: loads.map((l) => ({ node: l.node, fx: q(l.fx), fy: q(l.fy) })),
    },
    determinate,
  };
}
