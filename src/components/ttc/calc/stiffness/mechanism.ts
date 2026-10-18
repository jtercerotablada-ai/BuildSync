import type { Step } from '@/lib/calc/stiffness/types';

/**
 * WHICH NODES A MECHANISM LETS MOVE - ALL OF THEM. The engine names the nodes of ONE motion (the one its first zero pivot belongs to) and counts the
 * independent ones; a mechanism of two motions (two loose joints on one line) has two such sets, and the drawing must ring every node that can move,
 * not the first. The motions are the null space of K_FF, the stiffness of the free DOFs, which the failure carries in the partition step (the steps
 * worked out before it): its eigenvectors of eigenvalue no more than rounding, found here by Jacobi's rotations on the matrix scaled to a unit
 * diagonal (the same scaling the engine counts them in). A node moves in a motion when it moves at least a quarter as much as the one that moves
 * most in it (a rotation counts for its size times the structure's), as the engine's own list does.
 *
 * Pure arithmetic on numbers the page already has; null when the matrix is not there or is not a matrix of numbers.
 */

/** An eigenvalue of the unit-diagonal K_FF no larger than this is a motion (rounding, never a stiffness of the structure). */
const NULL = 1e-9;
/** A node moves in a motion when it moves at least this share of the one that moves most. */
const SHARE = 0.25;

/** The eigenvalues and eigenvectors (rows of `vectors`) of a symmetric matrix, by cyclic Jacobi rotations. */
export function jacobi(matrix: number[][]): { values: number[]; vectors: number[][] } {
  const n = matrix.length;
  const a = matrix.map((row) => [...row]);
  const v: number[][] = a.map((_, i) => a.map((__, j): number => (i === j ? 1 : 0)));
  for (let sweep = 0; sweep < 60; sweep++) {
    let off = 0;
    for (let i = 0; i < n; i++) for (let j = i + 1; j < n; j++) off += a[i][j] * a[i][j];
    if (off < 1e-30) break;
    for (let p = 0; p < n; p++) {
      for (let q = p + 1; q < n; q++) {
        if (Math.abs(a[p][q]) < 1e-300) continue;
        const theta = (a[q][q] - a[p][p]) / (2 * a[p][q]);
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
  return { values: a.map((row, i) => row[i]), vectors: a.map((_, c) => v.map((row) => row[c])) };
}

/** The labels (from 1) of every node that moves in some motion of the mechanism, ascending; null when they cannot be found. `size` is the structure's size. */
export function movingNodes(partial: readonly Step[], size: number): number[] | null {
  const step = partial.find((s) => s.id === 'partition');
  const block = step?.blocks.find((b) => b.type === 'matrix' && b.name === 'K_FF');
  if (!block || block.type !== 'matrix' || block.values.length === 0) return null;
  const parsed = block.rowLabels.map((label) => /^(\d+)([xyθ])$/.exec(label));
  if (parsed.some((m) => m === null) || !block.values.every((row) => row.length === block.values.length && row.every(Number.isFinite))) return null;
  const labels = parsed.map((m) => ({ node: Number(m![1]), kind: m![2] }));
  // Unit diagonal: the stiffness of each DOF alone is 1, so that a rotation and a translation are weighed alike.
  const scale = block.values.map((row, i) => (row[i] > 0 ? 1 / Math.sqrt(row[i]) : 0));
  const unit = block.values.map((row, i) => row.map((x, j) => x * scale[i] * scale[j]));
  const { values, vectors } = jacobi(unit);
  const reach = Math.max(size, 1e-300);
  const moving = new Set<number>();
  values.forEach((lambda, k) => {
    if (!(Math.abs(lambda) <= NULL)) return;
    // The motion in the DOFs' own units: the unit-diagonal coordinate back to the DOF.
    const motion = vectors[k].map((x, i) => x * (scale[i] > 0 ? scale[i] : 1));
    const perNode = new Map<number, { x: number; y: number; r: number }>();
    labels.forEach((l, i) => {
      const m = perNode.get(l.node) ?? { x: 0, y: 0, r: 0 };
      if (l.kind === 'x') m.x = motion[i];
      else if (l.kind === 'y') m.y = motion[i];
      else m.r = Math.abs(motion[i]) * reach;
      perNode.set(l.node, m);
    });
    const size1 = new Map([...perNode].map(([node, m]) => [node, Math.max(Math.hypot(m.x, m.y), m.r)]));
    const top = Math.max(0, ...size1.values());
    if (top > 0) for (const [node, m] of size1) if (m >= SHARE * top) moving.add(node);
  });
  return moving.size > 0 ? [...moving].sort((p, q) => p - q) : null;
}
