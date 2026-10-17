/**
 * Dense linear algebra for the frame engine: small matrices (at most 150 × 150).
 * Pure functions, no words. Nothing here throws on a singular matrix: it says so.
 */

export type Mat = number[][];

export const zeros = (n: number, m: number = n): Mat => Array.from({ length: n }, () => new Array<number>(m).fill(0));

/**
 * LU with partial pivoting of a matrix scaled by rows and then by columns to have 1 as its largest entry, with iterative
 * refinement against the original. Returns a solver, or null when a pivot of the scaled matrix is under 1e-14 (the matrix
 * is singular to rounding).
 */
export function factor(a: Mat): ((b: number[]) => number[]) | null {
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
  const lu = a.map((row, i) => row.map((v, j) => v * rs[i] * cs[j]));
  const perm = Array.from({ length: n }, (_, i) => i);
  for (let k = 0; k < n; k++) {
    let p = k;
    let best = Math.abs(lu[k][k]);
    for (let i = k + 1; i < n; i++) {
      const v = Math.abs(lu[i][k]);
      if (v > best) {
        best = v;
        p = i;
      }
    }
    if (!(best > 1e-14)) return null;
    if (p !== k) {
      [lu[p], lu[k]] = [lu[k], lu[p]];
      [perm[p], perm[k]] = [perm[k], perm[p]];
    }
    const piv = lu[k][k];
    for (let i = k + 1; i < n; i++) {
      const f = lu[i][k] / piv;
      lu[i][k] = f;
      if (f !== 0) for (let j = k + 1; j < n; j++) lu[i][j] -= f * lu[k][j];
    }
  }
  const solveScaled = (rhs: number[]): number[] => {
    // rhs is in the scaled row space and already permuted by the caller.
    const y = new Array<number>(n);
    for (let i = 0; i < n; i++) {
      let s = rhs[i];
      for (let j = 0; j < i; j++) s -= lu[i][j] * y[j];
      y[i] = s;
    }
    const x = new Array<number>(n);
    for (let i = n - 1; i >= 0; i--) {
      let s = y[i];
      for (let j = i + 1; j < n; j++) s -= lu[i][j] * x[j];
      x[i] = s / lu[i][i];
    }
    return x;
  };
  const once = (b: number[]): number[] => {
    const rhs = perm.map((p) => b[p] * rs[p]);
    const y = solveScaled(rhs);
    return y.map((v, j) => v * cs[j]);
  };
  return (b: number[]): number[] => {
    let x = once(b);
    for (let it = 0; it < 3; it++) {
      const r = b.map((bi, i) => {
        let s = bi;
        for (let j = 0; j < n; j++) s -= a[i][j] * x[j];
        return s;
      });
      const d = once(r);
      let grow = 0;
      let size = 0;
      for (let j = 0; j < n; j++) {
        grow = Math.max(grow, Math.abs(d[j]));
        size = Math.max(size, Math.abs(x[j]));
      }
      x = x.map((v, j) => v + d[j]);
      if (grow <= 1e-16 * size) break;
    }
    return x;
  };
}

/** Whether a − shift·I is positive definite (Cholesky succeeds with every pivot above `floor`). */
export function positiveDefinite(a: Mat, shift: number, floor = 0): boolean {
  const n = a.length;
  const l = zeros(n);
  for (let i = 0; i < n; i++) {
    for (let j = 0; j <= i; j++) {
      let s = a[i][j] - (i === j ? shift : 0);
      for (let k = 0; k < j; k++) s -= l[i][k] * l[j][k];
      if (i === j) {
        if (!(s > floor)) return false;
        l[i][i] = Math.sqrt(s);
      } else l[i][j] = s / l[j][j];
    }
  }
  return true;
}

/**
 * Eigenvalues and eigenvectors of a symmetric matrix by cyclic Jacobi rotations. `vectors[k]` is the (unit) eigenvector
 * of `values[k]`. Sorted by ascending eigenvalue.
 */
export function jacobiEigen(input: Mat): { values: number[]; vectors: Mat } {
  const n = input.length;
  const a = input.map((r) => r.slice());
  const v = zeros(n);
  for (let i = 0; i < n; i++) v[i][i] = 1;
  for (let sweep = 0; sweep < 60; sweep++) {
    let off = 0;
    let diag = 0;
    for (let i = 0; i < n; i++) {
      diag += a[i][i] * a[i][i];
      for (let j = i + 1; j < n; j++) off += a[i][j] * a[i][j];
    }
    if (off <= 1e-30 * Math.max(diag, 1e-300) || off === 0) break;
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

export const dot = (a: readonly number[], b: readonly number[]): number => {
  let s = 0;
  for (let i = 0; i < a.length; i++) s += a[i] * b[i];
  return s;
};
