import type { BeamModel, Results, Reaction, DiagramPoint, Extremum } from './types';

const KN = 1000;
const MPA = 1e6;
const MM4 = 1e-12;
const MM2 = 1e-6;
const M_TO_MM = 1000;
const G = 9.81;
const TOL = 1e-9;

export function solve(model: BeamModel): Results {
  const warnings: string[] = [];

  if (model.length <= 0) {
    warnings.push('Beam length must be greater than zero');
    return emptyResults(warnings);
  }
  if (model.section.E <= 0 || model.section.I <= 0) {
    warnings.push('Young\u2019s Modulus (E) and Moment of Inertia (I) must be positive');
    return emptyResults(warnings);
  }
  if (model.supports.length < 1) {
    warnings.push('At least one support is required');
    return emptyResults(warnings);
  }

  const hasFixed = model.supports.some((s) => s.type === 'fixed');
  const verticalSupports = model.supports.length;
  if (!hasFixed && verticalSupports < 2) {
    warnings.push('Beam is unstable \u2014 need at least 2 vertical supports or 1 fixed support');
    return emptyResults(warnings);
  }

  const L = model.length;
  const EI = model.section.E * MPA * model.section.I * MM4;

  const positionSet = new Set<number>();
  positionSet.add(0);
  positionSet.add(L);
  model.supports.forEach((s) => positionSet.add(clamp(s.position, 0, L)));
  model.loads.forEach((ld) => {
    if (ld.type === 'point') {
      positionSet.add(clamp(ld.position, 0, L));
    } else {
      positionSet.add(clamp(ld.startPosition, 0, L));
      positionSet.add(clamp(ld.endPosition, 0, L));
    }
  });
  model.moments.forEach((m) => positionSet.add(clamp(m.position, 0, L)));

  const sorted = Array.from(positionSet).sort((a, b) => a - b);
  const nodes = dedupe(sorted, TOL);
  const N = nodes.length;

  const K = zeros(2 * N, 2 * N);
  for (let i = 0; i < N - 1; i++) {
    const Le = nodes[i + 1] - nodes[i];
    if (Le < TOL) continue;
    const ke = elementStiffness(EI, Le);
    const dofs = [2 * i, 2 * i + 1, 2 * (i + 1), 2 * (i + 1) + 1];
    for (let a = 0; a < 4; a++) {
      for (let b = 0; b < 4; b++) {
        K[dofs[a]][dofs[b]] += ke[a][b];
      }
    }
  }

  const F = new Array(2 * N).fill(0);

  for (const load of model.loads) {
    if (load.type === 'point') {
      const idx = findNode(nodes, load.position);
      const sign = load.direction === 'up' ? 1 : -1;
      F[2 * idx] += sign * load.magnitude * KN;
    } else {
      const sign = load.direction === 'up' ? 1 : -1;
      const a = Math.min(load.startPosition, load.endPosition);
      const b = Math.max(load.startPosition, load.endPosition);
      const w = sign * Math.abs(load.startMagnitude) * KN;
      if (Math.abs(b - a) < TOL) continue;

      for (let i = 0; i < N - 1; i++) {
        const x1 = nodes[i];
        const x2 = nodes[i + 1];
        if (x2 <= a + TOL || x1 >= b - TOL) continue;
        const Le = x2 - x1;
        F[2 * i] += (w * Le) / 2;
        F[2 * i + 1] += (w * Le * Le) / 12;
        F[2 * (i + 1)] += (w * Le) / 2;
        F[2 * (i + 1) + 1] += -(w * Le * Le) / 12;
      }
    }
  }

  const selfW = selfWeightLoad(model);
  if (selfW !== 0) {
    for (let i = 0; i < N - 1; i++) {
      const Le = nodes[i + 1] - nodes[i];
      F[2 * i] += (selfW * Le) / 2;
      F[2 * i + 1] += (selfW * Le * Le) / 12;
      F[2 * (i + 1)] += (selfW * Le) / 2;
      F[2 * (i + 1) + 1] += -(selfW * Le * Le) / 12;
    }
  }

  for (const moment of model.moments) {
    const idx = findNode(nodes, moment.position);
    const sign = moment.direction === 'ccw' ? 1 : -1;
    F[2 * idx + 1] += sign * moment.magnitude * KN;
  }

  const constrainedSet = new Set<number>();
  const supportNode = new Map<string, number>();
  for (const s of model.supports) {
    const idx = findNode(nodes, s.position);
    supportNode.set(s.id, idx);
    constrainedSet.add(2 * idx);
    if (s.type === 'fixed') constrainedSet.add(2 * idx + 1);
  }

  const free: number[] = [];
  for (let i = 0; i < 2 * N; i++) {
    if (!constrainedSet.has(i)) free.push(i);
  }

  const Kff = free.map((i) => free.map((j) => K[i][j]));
  const Ff = free.map((i) => F[i]);
  const uf = solveLinear(Kff, Ff);

  if (!uf) {
    warnings.push('Solver failed \u2014 check supports and geometry');
    return emptyResults(warnings);
  }

  const u = new Array(2 * N).fill(0);
  free.forEach((dof, i) => (u[dof] = uf[i]));

  const reactions: Reaction[] = [];
  for (const s of model.supports) {
    const idx = supportNode.get(s.id)!;
    const dv = 2 * idx;
    const dm = 2 * idx + 1;
    let Kv = 0;
    for (let j = 0; j < 2 * N; j++) Kv += K[dv][j] * u[j];
    const Rv = (Kv - F[dv]) / KN;
    let Rm = 0;
    if (s.type === 'fixed') {
      let Km = 0;
      for (let j = 0; j < 2 * N; j++) Km += K[dm][j] * u[j];
      Rm = (Km - F[dm]) / KN;
    }
    reactions.push({ supportId: s.id, position: s.position, type: s.type, V: Rv, M: Rm });
  }

  const numSamples = 500;
  const samples: number[] = [];
  for (let k = 0; k <= numSamples; k++) samples.push((k / numSamples) * L);
  nodes.forEach((x) => samples.push(x));
  model.supports.forEach((s) => {
    samples.push(Math.max(0, s.position - 1e-6));
    samples.push(Math.min(L, s.position + 1e-6));
  });
  model.loads.forEach((ld) => {
    if (ld.type === 'point') {
      samples.push(Math.max(0, ld.position - 1e-6));
      samples.push(Math.min(L, ld.position + 1e-6));
    }
  });
  model.moments.forEach((m) => {
    samples.push(Math.max(0, m.position - 1e-6));
    samples.push(Math.min(L, m.position + 1e-6));
  });
  const xs = Array.from(new Set(samples.map((x) => clamp(x, 0, L)))).sort((a, b) => a - b);

  const shear: DiagramPoint[] = [];
  const moment: DiagramPoint[] = [];
  const deflection: DiagramPoint[] = [];
  const slope: DiagramPoint[] = [];

  for (const x of xs) {
    let V = 0;
    let M = 0;

    for (const r of reactions) {
      if (r.position <= x + TOL) {
        V += r.V * KN;
        M += r.V * KN * (x - r.position);
        M += r.M * KN;
      }
    }

    for (const ld of model.loads) {
      if (ld.type === 'point' && ld.position < x - TOL) {
        const P = (ld.direction === 'up' ? 1 : -1) * ld.magnitude * KN;
        V += P;
        M += P * (x - ld.position);
      }
    }

    for (const m of model.moments) {
      if (m.position < x - TOL) {
        const S = (m.direction === 'ccw' ? 1 : -1) * m.magnitude * KN;
        M += S;
      }
    }

    for (const ld of model.loads) {
      if (ld.type !== 'distributed') continue;
      const sign = ld.direction === 'up' ? 1 : -1;
      const w = sign * Math.abs(ld.startMagnitude) * KN;
      const a = Math.min(ld.startPosition, ld.endPosition);
      const b = Math.max(ld.startPosition, ld.endPosition);
      if (x <= a) continue;
      const hi = Math.min(x, b);
      const len = hi - a;
      if (len <= 0) continue;
      V += w * len;
      M += w * len * (x - (a + hi) / 2);
    }

    if (selfW !== 0 && x > 0) {
      V += selfW * x;
      M += selfW * x * (x / 2);
    }

    const e = findElement(nodes, x);
    const x1 = nodes[e];
    const Le = nodes[e + 1] - nodes[e];
    let v = 0;
    let th = 0;
    if (Le > TOL) {
      const xi = (x - x1) / Le;
      const v1 = u[2 * e];
      const t1 = u[2 * e + 1];
      const v2 = u[2 * (e + 1)];
      const t2 = u[2 * (e + 1) + 1];
      const N1 = 1 - 3 * xi * xi + 2 * xi * xi * xi;
      const N2 = Le * (xi - 2 * xi * xi + xi * xi * xi);
      const N3 = 3 * xi * xi - 2 * xi * xi * xi;
      const N4 = Le * (-xi * xi + xi * xi * xi);
      v = N1 * v1 + N2 * t1 + N3 * v2 + N4 * t2;
      const dN1 = (-6 * xi + 6 * xi * xi) / Le;
      const dN2 = 1 - 4 * xi + 3 * xi * xi;
      const dN3 = (6 * xi - 6 * xi * xi) / Le;
      const dN4 = -2 * xi + 3 * xi * xi;
      th = dN1 * v1 + dN2 * t1 + dN3 * v2 + dN4 * t2;
    }

    shear.push({ x, value: V / KN });
    moment.push({ x, value: M / KN });
    deflection.push({ x, value: v * M_TO_MM });
    slope.push({ x, value: th });
  }

  const maxShear = findMaxAbs(shear, true);
  const minShear = findMaxAbs(shear, false);
  const maxMoment = findMaxAbs(moment, true);
  const minMoment = findMaxAbs(moment, false);
  const maxDeflection = findMaxAbsMag(deflection);

  return {
    reactions,
    shear,
    moment,
    slope,
    deflection,
    maxShear,
    minShear,
    maxMoment,
    minMoment,
    maxDeflection,
    warnings,
    solved: true,
  };
}

function selfWeightLoad(model: BeamModel): number {
  if (!model.selfWeight) return 0;
  const A = model.section.A;
  if (!A || A <= 0) return 0;
  return -model.density * A * MM2 * G;
}

function elementStiffness(EI: number, L: number): number[][] {
  const c = EI / (L * L * L);
  return [
    [12 * c, 6 * c * L, -12 * c, 6 * c * L],
    [6 * c * L, 4 * c * L * L, -6 * c * L, 2 * c * L * L],
    [-12 * c, -6 * c * L, 12 * c, -6 * c * L],
    [6 * c * L, 2 * c * L * L, -6 * c * L, 4 * c * L * L],
  ];
}

function zeros(n: number, m: number): number[][] {
  return Array.from({ length: n }, () => new Array(m).fill(0));
}

function clamp(x: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, x));
}

function dedupe(arr: number[], tol: number): number[] {
  const out: number[] = [];
  for (const v of arr) {
    if (out.length === 0 || Math.abs(v - out[out.length - 1]) > tol) out.push(v);
  }
  return out;
}

function findNode(nodes: number[], pos: number): number {
  let best = 0;
  let bestDist = Infinity;
  for (let i = 0; i < nodes.length; i++) {
    const d = Math.abs(nodes[i] - pos);
    if (d < bestDist) {
      bestDist = d;
      best = i;
    }
  }
  return best;
}

function findElement(nodes: number[], x: number): number {
  for (let i = 0; i < nodes.length - 1; i++) {
    if (x >= nodes[i] - TOL && x <= nodes[i + 1] + TOL) return i;
  }
  return Math.max(0, nodes.length - 2);
}

function solveLinear(A: number[][], b: number[]): number[] | null {
  const n = A.length;
  if (n === 0) return [];
  const M = A.map((row, i) => [...row, b[i]]);

  for (let i = 0; i < n; i++) {
    let maxRow = i;
    let maxVal = Math.abs(M[i][i]);
    for (let k = i + 1; k < n; k++) {
      if (Math.abs(M[k][i]) > maxVal) {
        maxVal = Math.abs(M[k][i]);
        maxRow = k;
      }
    }
    if (maxVal < 1e-14) return null;
    if (maxRow !== i) [M[i], M[maxRow]] = [M[maxRow], M[i]];
    for (let k = i + 1; k < n; k++) {
      const f = M[k][i] / M[i][i];
      for (let j = i; j <= n; j++) M[k][j] -= f * M[i][j];
    }
  }

  const x = new Array(n).fill(0);
  for (let i = n - 1; i >= 0; i--) {
    let s = M[i][n];
    for (let j = i + 1; j < n; j++) s -= M[i][j] * x[j];
    x[i] = s / M[i][i];
  }
  return x;
}

function findMaxAbs(arr: DiagramPoint[], positive: boolean): Extremum {
  let best: Extremum = { value: 0, position: 0 };
  for (const p of arr) {
    if (positive ? p.value > best.value : p.value < best.value) {
      best = { value: p.value, position: p.x };
    }
  }
  return best;
}

function findMaxAbsMag(arr: DiagramPoint[]): Extremum {
  let best: Extremum = { value: 0, position: 0 };
  for (const p of arr) {
    if (Math.abs(p.value) > Math.abs(best.value)) {
      best = { value: p.value, position: p.x };
    }
  }
  return best;
}

function emptyResults(warnings: string[]): Results {
  return {
    reactions: [],
    shear: [],
    moment: [],
    slope: [],
    deflection: [],
    maxShear: { value: 0, position: 0 },
    minShear: { value: 0, position: 0 },
    maxMoment: { value: 0, position: 0 },
    minMoment: { value: 0, position: 0 },
    maxDeflection: { value: 0, position: 0 },
    warnings,
    solved: false,
  };
}
