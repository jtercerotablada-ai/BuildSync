/**
 * ─────────────────────────────────────────────────────────────────────────────
 * STIFFNESS MATRIX, STEP BY STEP — double-double arithmetic: about 32 significant digits
 * ─────────────────────────────────────────────────────────────────────────────
 * A number here is the unevaluated sum of two doubles, `[hi, lo]` with |lo| ≤ ulp(hi)/2, so that hi is the number rounded to a double and lo what that rounding
 * left. Every operation is built from error-free transformations of the doubles (Knuth's TwoSum, Dekker's TwoProduct with Veltkamp's splitting), so its result is
 * correct to about 2⁻¹⁰⁴ of itself (one `EPSILON_DD` is taken as 2⁻¹⁰⁰ in the engine: every operation of this file is within a few units of 2⁻¹⁰⁴).
 *
 * WHY. A stiffness matrix of a structure with one very stiff member (a rigid link, an inextensible column) is a sum of terms that differ by ten or more orders of
 * magnitude: with 16 digits the soft part is a few digits of a sum that the stiff part dominates, and the answer has a few figures or none. With 32 digits the
 * same structure keeps 16 or more, and the tool can say what it computes without a warning for every member a million times stiffer than another. What is
 * printed is the hi part of the number (the number correctly rounded to a double), so a reader sees the doubles of any calculator; nothing else in the page is
 * different.
 *
 * Values must be finite and below about 10²⁹⁰ in size: the splitting multiplies by 2²⁷ + 1. The engine refuses anything near that long before ('size').
 * Pure functions, no state, nothing throws.
 */

/** A double-double number: [hi, lo]. */
export type DD = readonly [number, number];

const SPLITTER = 134217729; // 2^27 + 1

export const DD_ZERO: DD = [0, 0];
export const DD_ONE: DD = [1, 0];

/** A double as a double-double. */
export const dd = (x: number): DD => [x, 0];

/** The double nearest to the number. */
export const toDouble = (a: DD): number => a[0];

/** −a, never −0. */
export const ddNeg = (a: DD): DD => [0 - a[0], 0 - a[1]];

export const ddAbs = (a: DD): DD => (a[0] < 0 || (a[0] === 0 && a[1] < 0) ? ddNeg(a) : a);

export const ddIsZero = (a: DD): boolean => a[0] === 0 && a[1] === 0;

/** The sign of a: −1, 0 or 1. */
export const ddSign = (a: DD): number => (a[0] > 0 || (a[0] === 0 && a[1] > 0) ? 1 : a[0] < 0 || (a[0] === 0 && a[1] < 0) ? -1 : 0);

export const ddFinite = (a: DD): boolean => Number.isFinite(a[0]) && Number.isFinite(a[1]);

/** a + b exactly, as a double-double (the sum of two doubles is exactly representable as one). */
export function sum2(a: number, b: number): DD {
  const s = a + b;
  const bb = s - a;
  const e = a - (s - bb) + (b - bb);
  return [s, e];
}

/** a · b exactly, as a double-double. */
export function prod2(a: number, b: number): DD {
  const p = a * b;
  let t = SPLITTER * a;
  const ah = t - (t - a);
  const al = a - ah;
  t = SPLITTER * b;
  const bh = t - (t - b);
  const bl = b - bh;
  const e = ah * bh - p + ah * bl + al * bh + al * bl;
  return [p, e];
}

function renorm(hi: number, lo: number): DD {
  const s = hi + lo;
  return [s, lo - (s - hi)];
}

export function ddAdd(a: DD, b: DD): DD {
  const s = a[0] + b[0];
  const bb = s - a[0];
  let e = a[0] - (s - bb) + (b[0] - bb);
  const t = a[1] + b[1];
  const cc = t - a[1];
  const f = a[1] - (t - cc) + (b[1] - cc);
  e += t;
  const h = s + e;
  e = e - (h - s);
  e += f;
  return renorm(h, e);
}

export const ddSub = (a: DD, b: DD): DD => ddAdd(a, [0 - b[0], 0 - b[1]]);

/** a + b for a double b. */
export function ddAddD(a: DD, b: number): DD {
  const s = a[0] + b;
  const bb = s - a[0];
  let e = a[0] - (s - bb) + (b - bb);
  e += a[1];
  return renorm(s, e);
}

export function ddMul(a: DD, b: DD): DD {
  const p = prod2(a[0], b[0]);
  const e = p[1] + (a[0] * b[1] + a[1] * b[0]);
  return renorm(p[0], e);
}

/** a · b for a double b. */
export function ddMulD(a: DD, b: number): DD {
  const p = prod2(a[0], b);
  return renorm(p[0], p[1] + a[1] * b);
}

export function ddDiv(a: DD, b: DD): DD {
  const q1 = a[0] / b[0];
  let r = ddSub(a, ddMulD(b, q1));
  const q2 = r[0] / b[0];
  r = ddSub(r, ddMulD(b, q2));
  const q3 = r[0] / b[0];
  const q = renorm(q1, q2);
  return ddAddD(q, q3);
}

/** a / b for a double b. */
export const ddDivD = (a: DD, b: number): DD => ddDiv(a, [b, 0]);

export function ddSqrt(a: DD): DD {
  if (a[0] === 0) return DD_ZERO;
  if (a[0] < 0) return [Number.NaN, Number.NaN];
  const x = 1 / Math.sqrt(a[0]);
  const ax = a[0] * x;
  const diff = ddSub(a, prod2(ax, ax));
  return sum2(ax, diff[0] * (x * 0.5));
}

/** 1 if a > b, −1 if a < b, 0 if equal. */
export function ddCompare(a: DD, b: DD): number {
  if (a[0] !== b[0]) return a[0] > b[0] ? 1 : -1;
  if (a[1] !== b[1]) return a[1] > b[1] ? 1 : -1;
  return 0;
}

/** The sum of the products a_i · b_i, and the sum of their sizes Σ|a_i · b_i| (a double: what the rounding of the sum is measured against). */
export function ddDot(a: readonly DD[], b: readonly DD[]): { value: DD; size: number } {
  let value: DD = DD_ZERO;
  let size = 0;
  for (let i = 0; i < a.length; i++) {
    const p = ddMul(a[i], b[i]);
    value = ddAdd(value, p);
    size += Math.abs(p[0]);
  }
  return { value, size };
}

/** The matrix product a · b. */
export function ddMatMul(a: readonly (readonly DD[])[], b: readonly (readonly DD[])[]): DD[][] {
  const n = a.length;
  const inner = b.length;
  const m = inner === 0 ? 0 : b[0].length;
  const out: DD[][] = [];
  for (let i = 0; i < n; i++) {
    const row: DD[] = [];
    for (let j = 0; j < m; j++) {
      let s: DD = DD_ZERO;
      for (let k = 0; k < inner; k++) {
        const aik = a[i][k];
        const bkj = b[k][j];
        if ((aik[0] === 0 && aik[1] === 0) || (bkj[0] === 0 && bkj[1] === 0)) continue;
        s = ddAdd(s, ddMul(aik, bkj));
      }
      row.push(s);
    }
    out.push(row);
  }
  return out;
}

/** The sizes Σ_k |a_ik| · |b_kj| of the terms of a matrix product (doubles): what the rounding of each entry of the product is measured against. */
export function ddMatMulSize(a: readonly (readonly DD[])[], b: readonly (readonly DD[])[]): number[][] {
  const n = a.length;
  const inner = b.length;
  const m = inner === 0 ? 0 : b[0].length;
  const out: number[][] = [];
  for (let i = 0; i < n; i++) {
    const row: number[] = [];
    for (let j = 0; j < m; j++) {
      let s = 0;
      for (let k = 0; k < inner; k++) s += Math.abs(a[i][k][0]) * Math.abs(b[k][j][0]);
      row.push(s);
    }
    out.push(row);
  }
  return out;
}

export const ddTranspose = (a: readonly (readonly DD[])[]): DD[][] => (a.length === 0 ? [] : a[0].map((_, j) => a.map((row) => row[j])));

/** The hi parts of a matrix. */
export const ddHi = (a: readonly (readonly DD[])[]): number[][] => a.map((row) => row.map((x) => x[0]));

/** A matrix of zeros. */
export const ddZeros = (n: number, m: number = n): DD[][] => Array.from({ length: n }, () => Array.from({ length: m }, () => DD_ZERO));
