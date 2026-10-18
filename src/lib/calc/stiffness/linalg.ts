/**
 * Dense linear algebra for the stiffness-matrix engine: small matrices (at most 36 × 36). Pure
 * functions, no words, nothing throws on a singular matrix. These are written out in full on
 * purpose: the matrices are what the page shows.
 */

export type Mat = number[][];

export const zeros = (n: number, m: number = n): Mat => Array.from({ length: n }, () => new Array<number>(m).fill(0));

export const identity = (n: number): Mat => {
  const out = zeros(n);
  for (let i = 0; i < n; i++) out[i][i] = 1;
  return out;
};

export function transpose(a: Mat): Mat {
  const rows = a.length;
  const cols = rows === 0 ? 0 : a[0].length;
  const out = zeros(cols, rows);
  for (let i = 0; i < rows; i++) for (let j = 0; j < cols; j++) out[j][i] = a[i][j];
  return out;
}

/** a · b (the sum over the shared index taken in ascending order, so a replay of it is bit for bit the same). */
export function matMul(a: Mat, b: Mat): Mat {
  const n = a.length;
  const inner = b.length;
  const m = inner === 0 ? 0 : b[0].length;
  const out = zeros(n, m);
  for (let i = 0; i < n; i++) {
    for (let j = 0; j < m; j++) {
      let s = 0;
      for (let k = 0; k < inner; k++) s += a[i][k] * b[k][j];
      out[i][j] = s;
    }
  }
  return out;
}

export function matVec(a: Mat, v: readonly number[]): number[] {
  return a.map((row) => {
    let s = 0;
    for (let k = 0; k < row.length; k++) s += row[k] * v[k];
    return s;
  });
}

export const dot = (a: readonly number[], b: readonly number[]): number => {
  let s = 0;
  for (let i = 0; i < a.length; i++) s += a[i] * b[i];
  return s;
};

export const maxAbs = (v: readonly number[]): number => {
  let m = 0;
  for (const x of v) m = Math.max(m, Math.abs(x));
  return m;
};

export const maxAbsMat = (a: Mat): number => {
  let m = 0;
  for (const row of a) for (const x of row) m = Math.max(m, Math.abs(x));
  return m;
};

/**
 * Eigenvalues and eigenvectors of a symmetric matrix by cyclic Jacobi rotations. `vectors[k]` is the (unit) eigenvector of `values[k]`.
 * Sorted by ascending eigenvalue.
 */
export function jacobiEigen(input: Mat): { values: number[]; vectors: Mat } {
  const n = input.length;
  const a = input.map((r) => r.slice());
  const v = identity(n);
  for (let sweep = 0; sweep < 60; sweep++) {
    let off = 0;
    let diag = 0;
    for (let i = 0; i < n; i++) {
      diag += a[i][i] * a[i][i];
      for (let j = i + 1; j < n; j++) off += a[i][j] * a[i][j];
    }
    if (off === 0 || off <= 1e-30 * Math.max(diag, 1e-300)) break;
    for (let p = 0; p < n - 1; p++) {
      for (let q = p + 1; q < n; q++) {
        const apq = a[p][q];
        if (Math.abs(apq) < 1e-300) continue;
        const theta = (a[q][q] - a[p][p]) / (2 * apq);
        const t = Math.sign(theta || 1) / (Math.abs(theta) + Math.sqrt(theta * theta + 1));
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
  const order = Array.from({ length: n }, (_, i) => i).sort((x, y) => a[x][x] - a[y][y]);
  return { values: order.map((k) => a[k][k]), vectors: order.map((k) => v.map((row) => row[k])) };
}

/** Whether `a` is positive definite: a Cholesky factorisation that finds every pivot above `floor`. */
export function positiveDefinite(a: Mat, floor = 0): boolean {
  const n = a.length;
  const l = zeros(n);
  for (let i = 0; i < n; i++) {
    for (let j = 0; j <= i; j++) {
      let s = a[i][j];
      for (let k = 0; k < j; k++) s -= l[i][k] * l[j][k];
      if (i === j) {
        if (!(s > floor)) return false;
        l[i][i] = Math.sqrt(s);
      } else l[i][j] = s / l[j][j];
    }
  }
  return true;
}
