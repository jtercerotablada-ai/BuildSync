/**
 * A SECOND ORACLE for structures whose members differ by many orders of magnitude (not part of the calculator: the name does not match the test glob).
 * Written from scratch and sharing no code with engine.ts: 120-digit fixed-point BigInt arithmetic with partial pivoting, the member matrices built from the
 * doubles the model holds (every difference of coordinates exact), the fixed-end forces from their closed forms, and the supports taken by partition. It solves
 * the very numbers of the model, so what it gives is the exact answer to the question the engine is asked, whatever the stiffness ratio. It also counts the
 * independent motions of a singular stiffness matrix exactly (`nullity`, complete pivoting). oracle.testlib.ts is the other one: exact fractions, for
 * structures whose members lie along Pythagorean directions.
 */
import type { StiffnessModel } from './types';

const SC = 120;
const S = BigInt(10) ** BigInt(SC);

export function fx(x: number): bigint {
  if (x === 0) return BigInt(0);
  const dv = new DataView(new ArrayBuffer(8));
  dv.setFloat64(0, x);
  const hi = dv.getUint32(0);
  const lo = dv.getUint32(4);
  const sign = hi >>> 31 ? -BigInt(1) : BigInt(1);
  const e = (hi >>> 20) & 0x7ff;
  let m = (BigInt(hi & 0xfffff) << BigInt(32)) | BigInt(lo);
  let exp: number;
  if (e === 0) exp = -1074;
  else {
    m |= BigInt(1) << BigInt(52);
    exp = e - 1075;
  }
  let v = m * S;
  if (exp >= 0) v = v << BigInt(exp);
  else v = v >> BigInt(-exp);
  return sign * v;
}
const mul = (a: bigint, b: bigint) => (a * b) / S;
const div = (a: bigint, b: bigint) => (a * S) / b;
const abs = (a: bigint) => (a < BigInt(0) ? -a : a);
function isqrt(n: bigint): bigint {
  if (n < BigInt(2)) return n;
  let x = n;
  let y = (x + BigInt(1)) / BigInt(2);
  while (y < x) {
    x = y;
    y = (x + n / x) / BigInt(2);
  }
  return x;
}
const sqrtF = (a: bigint) => isqrt(a * S);
export const toNum = (a: bigint): number => {
  const neg = a < BigInt(0);
  const v = neg ? -a : a;
  const r = Number(v) / Number(S);
  return neg ? -r : r;
};

type M = bigint[][];
const zerosM = (r: number, c: number): M => Array.from({ length: r }, () => new Array<bigint>(c).fill(BigInt(0)));
function mmul(a: M, b: M): M {
  const out = zerosM(a.length, b[0].length);
  for (let i = 0; i < a.length; i++) for (let k = 0; k < b.length; k++) if (a[i][k] !== BigInt(0)) for (let j = 0; j < b[0].length; j++) out[i][j] += mul(a[i][k], b[k][j]);
  return out;
}
const tr = (a: M): M => a[0].map((_, j) => a.map((r) => r[j]));
const mv = (a: M, v: bigint[]): bigint[] => a.map((r) => r.reduce((s, x, j) => s + mul(x, v[j]), BigInt(0)));

export interface Exact {
  singular: boolean;
  /** number of independent zero-energy motions of the free DOFs (exact rank deficiency, complete pivoting) */
  nullity: number;
  /** smallest pivot over largest diagonal, as a double (log10 scale useful) */
  pivotRatio: number;
  u: number[];
  R: number[];
  /** local end forces per member */
  f: number[][];
  /** global K as numbers */
  K: number[][];
  P: number[];
  free: number[];
  restrained: number[];
}

export function exactSolve(model: StiffnessModel): Exact {
  const frame = model.mode === 'frame';
  const nd = frame ? 3 : 2;
  const nn = model.nodes.length;
  const N = nd * nn;
  const K: M = zerosM(N, N);
  const P: bigint[] = new Array<bigint>(N).fill(BigInt(0));
  const Tl: M[] = [];
  const kl: M[] = [];
  const fFE: (bigint[] | null)[] = [];
  const Ls: bigint[] = [];
  model.members.forEach((m, mi) => {
    const a = model.nodes[m.i];
    const b = model.nodes[m.j];
    const dx = fx(b.x) - fx(a.x);
    const dy = fx(b.y) - fx(a.y);
    const L = sqrtF(mul(dx, dx) + mul(dy, dy));
    Ls.push(L);
    const c = div(dx, L);
    const s = div(dy, L);
    const E = fx(m.E ?? model.E!);
    const A = fx(m.A ?? model.A!);
    const I = frame ? fx(m.I ?? model.I!) : BigInt(0);
    const EA = mul(E, A);
    const EI = mul(E, I);
    const aa = div(EA, L);
    let k: M;
    let T: M;
    if (!frame) {
      k = [[aa, -aa], [-aa, aa]];
      T = [[c, s, BigInt(0), BigInt(0)], [BigInt(0), BigInt(0), c, s]];
    } else {
      const L2 = mul(L, L);
      const L3 = mul(L2, L);
      const b12 = div(BigInt(12) * EI, L3);
      const c6 = div(BigInt(6) * EI, L2);
      const d4 = div(BigInt(4) * EI, L);
      const e2 = div(BigInt(2) * EI, L);
      k = [
        [aa, BigInt(0), BigInt(0), -aa, BigInt(0), BigInt(0)],
        [BigInt(0), b12, c6, BigInt(0), -b12, c6],
        [BigInt(0), c6, d4, BigInt(0), -c6, e2],
        [-aa, BigInt(0), BigInt(0), aa, BigInt(0), BigInt(0)],
        [BigInt(0), -b12, -c6, BigInt(0), b12, -c6],
        [BigInt(0), c6, e2, BigInt(0), -c6, d4],
      ];
      T = zerosM(6, 6);
      for (const o of [0, 3]) {
        T[o][o] = c;
        T[o][o + 1] = s;
        T[o + 1][o] = -s;
        T[o + 1][o + 1] = c;
        T[o + 2][o + 2] = S;
      }
    }
    // the transformation of rotation entries uses 1 = S
    Tl.push(T);
    kl.push(k);
    const Ke = mmul(tr(T), mmul(k, T));
    const code = [...Array.from({ length: nd }, (_, q) => nd * m.i + q), ...Array.from({ length: nd }, (_, q) => nd * m.j + q)];
    code.forEach((da, pa) => code.forEach((db, pb) => (K[da][db] += Ke[pa][pb])));
    fFE.push(null);
    void mi;
  });
  for (const l of model.loads) {
    P[nd * l.node] += fx(l.fx);
    P[nd * l.node + 1] += fx(l.fy);
    if (frame) P[nd * l.node + 2] += fx(l.m);
  }
  if (frame) {
    for (const ml of model.memberLoads) {
      const L = Ls[ml.member];
      let fe: bigint[];
      if (ml.kind === 'udl') {
        const w = fx(ml.w);
        fe = [BigInt(0), -mul(w, L) / BigInt(2), -mul(mul(w, L), L) / BigInt(12), BigInt(0), -mul(w, L) / BigInt(2), mul(mul(w, L), L) / BigInt(12)];
      } else if (ml.kind === 'point') {
        const a = fx(ml.a);
        const b = L - a;
        const Pp = fx(ml.P);
        const L2 = mul(L, L);
        const L3 = mul(L2, L);
        fe = [
          BigInt(0),
          -div(mul(Pp, mul(mul(b, b), BigInt(3) * a + b)), L3),
          -div(mul(Pp, mul(a, mul(b, b))), L2),
          BigInt(0),
          -div(mul(Pp, mul(mul(a, a), a + BigInt(3) * b)), L3),
          div(mul(Pp, mul(mul(a, a), b)), L2),
        ];
      } else {
        const q = fx(ml.q);
        fe = [-mul(q, L) / BigInt(2), BigInt(0), BigInt(0), -mul(q, L) / BigInt(2), BigInt(0), BigInt(0)];
      }
      const prev = fFE[ml.member];
      fFE[ml.member] = prev ? prev.map((v, i) => v + fe[i]) : fe;
      const g = mv(tr(Tl[ml.member]), fe);
      const m = model.members[ml.member];
      const code = [...Array.from({ length: nd }, (_, q) => nd * m.i + q), ...Array.from({ length: nd }, (_, q) => nd * m.j + q)];
      code.forEach((d, q) => (P[d] -= g[q]));
    }
  }
  // restraints
  const restrainedFlag = new Array<boolean>(N).fill(false);
  const pres = new Array<bigint>(N).fill(BigInt(0));
  for (const s of model.supports) {
    const fl = frame ? [s.ux, s.uy, s.rz] : [s.ux, s.uy];
    const vals = frame ? [s.dx ?? 0, s.dy ?? 0, s.dr ?? 0] : [s.dx ?? 0, s.dy ?? 0];
    fl.forEach((on, q) => {
      if (on) {
        restrainedFlag[nd * s.node + q] = true;
        pres[nd * s.node + q] = fx(vals[q]);
      }
    });
  }
  const free: number[] = [];
  const restrained: number[] = [];
  for (let d = 0; d < N; d++) (restrainedFlag[d] ? restrained : free).push(d);
  const nF = free.length;
  // reduced system
  const A: M = free.map((r) => free.map((c) => K[r][c]));
  const b: bigint[] = free.map((r) => P[r] - restrained.reduce((s, c) => s + mul(K[r][c], pres[c]), BigInt(0)));
  let nullity = 0;
  {
    const W = A.map((r) => r.slice());
    let big = BigInt(0);
    for (let i = 0; i < nF; i++) for (let j = 0; j < nF; j++) if (abs(W[i][j]) > big) big = abs(W[i][j]);
    const tol = big / BigInt(10) ** BigInt(50);
    const rowsLeft = new Set<number>(Array.from({ length: nF }, (_, i) => i));
    const colsLeft = new Set<number>(Array.from({ length: nF }, (_, i) => i));
    for (let step = 0; step < nF; step++) {
      let pi = -1, pj = -1, pv = BigInt(0);
      for (const i of rowsLeft) for (const j of colsLeft) if (abs(W[i][j]) > pv) { pv = abs(W[i][j]); pi = i; pj = j; }
      if (pi < 0 || pv <= tol) break;
      for (const i of rowsLeft) {
        if (i === pi) continue;
        const l = div(W[i][pj], W[pi][pj]);
        if (l === BigInt(0)) continue;
        for (const j of colsLeft) W[i][j] -= mul(l, W[pi][j]);
      }
      rowsLeft.delete(pi);
      colsLeft.delete(pj);
    }
    nullity = rowsLeft.size;
  }
  let kmax = BigInt(0);
  for (let i = 0; i < nF; i++) kmax = abs(A[i][i]) > kmax ? abs(A[i][i]) : kmax;
  let minPiv = kmax;
  let singular = false;
  const uF = new Array<bigint>(nF).fill(BigInt(0));
  // LU with partial pivoting on a copy
  const aug = A.map((row, i) => [...row, b[i]]);
  for (let k = 0; k < nF && !singular; k++) {
    let p = k;
    for (let i = k + 1; i < nF; i++) if (abs(aug[i][k]) > abs(aug[p][k])) p = i;
    if (p !== k) [aug[p], aug[k]] = [aug[k], aug[p]];
    const pv = abs(aug[k][k]);
    if (pv < minPiv) minPiv = pv;
    // singular if tiny relative to the whole matrix scale
    if (kmax === BigInt(0) || pv * BigInt(10) ** BigInt(60) < kmax) {
      singular = true;
      break;
    }
    for (let i = k + 1; i < nF; i++) {
      const l = div(aug[i][k], aug[k][k]);
      if (l === BigInt(0)) continue;
      for (let j = k; j <= nF; j++) aug[i][j] -= mul(l, aug[k][j]);
    }
  }
  const ratio = kmax === BigInt(0) ? 0 : toNum(div(minPiv, kmax));
  if (singular) return { singular: true, nullity, pivotRatio: ratio, u: [], R: [], f: [], K: [], P: [], free, restrained };
  for (let k = nF - 1; k >= 0; k--) {
    let s = aug[k][nF];
    for (let j = k + 1; j < nF; j++) s -= mul(aug[k][j], uF[j]);
    uF[k] = div(s, aug[k][k]);
  }
  const u = new Array<bigint>(N).fill(BigInt(0));
  free.forEach((d, q) => (u[d] = uF[q]));
  restrained.forEach((d) => (u[d] = pres[d]));
  const Ku = mv(K, u);
  const R = restrained.map((d) => Ku[d] - P[d]);
  const f: number[][] = [];
  model.members.forEach((m, mi) => {
    const code = [...Array.from({ length: nd }, (_, q) => nd * m.i + q), ...Array.from({ length: nd }, (_, q) => nd * m.j + q)];
    const ue = code.map((d) => u[d]);
    const ul = mv(Tl[mi], ue);
    const fk = mv(kl[mi], ul);
    const fe = fFE[mi];
    f.push(fk.map((v, i) => toNum(fe ? v + fe[i] : v)));
  });
  return { singular: false, nullity, pivotRatio: ratio, u: u.map(toNum), R: R.map(toNum), f, K: K.map((r) => r.map(toNum)), P: P.map(toNum), free: free.map((d) => d + 1), restrained: restrained.map((d) => d + 1) };
}

// ── a small seeded generator ──
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
