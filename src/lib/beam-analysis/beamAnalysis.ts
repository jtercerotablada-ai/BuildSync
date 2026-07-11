/**
 * Single-beam analysis — Euler-Bernoulli direct-stiffness (FE) solver.
 * Handles any support configuration (determinate + indeterminate): simply
 * supported, cantilever, propped cantilever, fixed-fixed, overhangs and
 * multi-span, under point loads, distributed (trapezoidal) loads and applied
 * moments.  Returns reactions and the shear, bending-moment, slope and
 * deflection diagrams.
 *
 * Sign convention: downward load & deflection positive, sagging moment
 * positive, shear positive when the left portion is pushed up.
 * US units: length in, force kip, EI in kip·in².  (The UI works in ft / klf and
 * converts.)  Validated against closed-form beam solutions — see selftest.
 */

export type SupportType = 'pin' | 'roller' | 'fixed';
export interface Support { pos: number; type: SupportType }
export interface PointLoad { pos: number; P: number }      // downward +
export interface AppliedMoment { pos: number; M: number }  // counter-clockwise +
export interface DistLoad { x1: number; x2: number; w1: number; w2: number } // downward +, trapezoidal

export interface BeamInput {
  L: number; EI: number;
  supports: Support[]; points: PointLoad[]; moments: AppliedMoment[]; dists: DistLoad[];
  nStations?: number;
}
export interface Reaction { pos: number; Rv: number; Rm: number; fixed: boolean } // Rv up+, Rm moment
export interface BeamResult {
  reactions: Reaction[];
  x: number[]; shear: number[]; moment: number[]; deflection: number[]; slope: number[];
  Vmax: number; VmaxAt: number; Mmax: number; MmaxAt: number; Mmin: number; MminAt: number;
  defMax: number; defMaxAt: number; defMin: number; defMinAt: number;
  reactSumV: number; // static check: ΣRv − Σloads ≈ 0
  stable: boolean;   // false → rigid-body mechanism / singular system
}

const wAt = (d: DistLoad, s: number) => d.w1 + (d.w2 - d.w1) * (s - d.x1) / (d.x2 - d.x1);
/** ∫ w(s) ds over [d.x1, min(d.x2, x)] (portion left of x). */
function wIntegral(d: DistLoad, x: number): number {
  const b = Math.min(d.x2, x); if (b <= d.x1) return 0;
  return (d.w1 + wAt(d, b)) / 2 * (b - d.x1);
}
/** ∫ w(s)·(x − s) ds over the portion left of x (moment of the distributed load about x). */
function wMomentIntegral(d: DistLoad, x: number): number {
  const b = Math.min(d.x2, x); if (b <= d.x1) return 0;
  const n = 24, h = (b - d.x1) / n; let m = 0;
  for (let i = 0; i < n; i++) { const s0 = d.x1 + i * h, s1 = s0 + h; m += (wAt(d, s0) * (x - s0) + wAt(d, s1) * (x - s1)) / 2 * h; }
  return m;
}

/* ── dense linear solve (Gaussian elimination, partial pivot) ──────────── */
function solveLinear(A: number[][], b: number[]): { x: number[]; singular: boolean } {
  const n = b.length, M = A.map((r, i) => [...r, b[i]]);
  let scale = 1e-30; for (const row of A) for (const v of row) { const a = Math.abs(v); if (a > scale) scale = a; } // matrix magnitude (no spread)
  let singular = false;
  for (let c = 0; c < n; c++) {
    let piv = c; for (let r = c + 1; r < n; r++) if (Math.abs(M[r][c]) > Math.abs(M[piv][c])) piv = r;
    [M[c], M[piv]] = [M[piv], M[c]];
    if (Math.abs(M[c][c]) < 1e-10 * scale) singular = true; // rigid-body mechanism → singular
    const d = M[c][c] || 1e-30;
    for (let r = 0; r < n; r++) { if (r === c) continue; const f = M[r][c] / d; for (let k = c; k <= n; k++) M[r][k] -= f * M[c][k]; }
  }
  return { x: M.map((r, i) => r[n] / (M[i][i] || 1e-30)), singular };
}

export function analyzeBeam(inp: BeamInput): BeamResult {
  const { L, EI } = inp;
  // ── mesh: nodes at all events, then subdivide finely ──
  const events = new Set<number>([0, L]);
  inp.supports.forEach((s) => events.add(s.pos));
  inp.points.forEach((p) => events.add(p.pos));
  inp.moments.forEach((m) => events.add(m.pos));
  inp.dists.forEach((d) => { events.add(d.x1); events.add(d.x2); });
  const base = [...events].filter((p) => p >= -1e-9 && p <= L + 1e-9).sort((a, b) => a - b);
  const target = L / 160;
  const nodes: number[] = [];
  for (let i = 0; i < base.length - 1; i++) {
    const seg = base[i + 1] - base[i]; if (seg < 1e-9) continue;
    const ns = Math.max(1, Math.ceil(seg / target));
    for (let j = 0; j < ns; j++) nodes.push(base[i] + (j * seg) / ns);
  }
  nodes.push(L);
  const nN = nodes.length, nD = 2 * nN;
  const nodeIndex = (pos: number) => { let bi = 0, bd = Infinity; for (let i = 0; i < nN; i++) { const dd = Math.abs(nodes[i] - pos); if (dd < bd) { bd = dd; bi = i; } } return bi; };

  // ── assemble K and F ──
  const K = Array.from({ length: nD }, () => new Array(nD).fill(0));
  const F = new Array(nD).fill(0);
  for (let e = 0; e < nN - 1; e++) {
    const Le = nodes[e + 1] - nodes[e]; if (Le < 1e-12) continue;
    const c = EI / (Le * Le * Le);
    const ke = [
      [12 * c, 6 * Le * c, -12 * c, 6 * Le * c],
      [6 * Le * c, 4 * Le * Le * c, -6 * Le * c, 2 * Le * Le * c],
      [-12 * c, -6 * Le * c, 12 * c, -6 * Le * c],
      [6 * Le * c, 2 * Le * Le * c, -6 * Le * c, 4 * Le * Le * c],
    ];
    const dof = [2 * e, 2 * e + 1, 2 * e + 2, 2 * e + 3];
    for (let a = 0; a < 4; a++) for (let b = 0; b < 4; b++) K[dof[a]][dof[b]] += ke[a][b];
    // distributed load fully covering this element (breakpoints are nodes)
    const xm = (nodes[e] + nodes[e + 1]) / 2;
    for (const d of inp.dists) {
      if (d.x1 <= nodes[e] + 1e-9 && d.x2 >= nodes[e + 1] - 1e-9 && xm > d.x1 && xm < d.x2) {
        const wa = wAt(d, nodes[e]), wb = wAt(d, nodes[e + 1]);
        F[dof[0]] += Le / 20 * (7 * wa + 3 * wb);
        F[dof[1]] += Le * Le / 60 * (3 * wa + 2 * wb);
        F[dof[2]] += Le / 20 * (3 * wa + 7 * wb);
        F[dof[3]] += -Le * Le / 60 * (2 * wa + 3 * wb);
      }
    }
  }
  inp.points.forEach((p) => { F[2 * nodeIndex(p.pos)] += p.P; });        // downward + on v-DOF
  inp.moments.forEach((m) => { F[2 * nodeIndex(m.pos) + 1] -= m.M; });   // CCW + couple (v-down frame → −m.M on θ-DOF)

  // ── boundary conditions ──
  const constrained = new Set<number>();
  inp.supports.forEach((s) => { const n = nodeIndex(s.pos); constrained.add(2 * n); if (s.type === 'fixed') constrained.add(2 * n + 1); });
  const free = [...Array(nD).keys()].filter((i) => !constrained.has(i));
  const Kff = free.map((r) => free.map((c) => K[r][c]));
  const Ff = free.map((r) => F[r]);
  const sol = free.length ? solveLinear(Kff, Ff) : { x: [] as number[], singular: false };
  const d = new Array(nD).fill(0);
  free.forEach((i, k) => (d[i] = sol.x[k]));

  // ── reactions ──
  const reactions: Reaction[] = inp.supports.map((s) => {
    const n = nodeIndex(s.pos);
    // support force = F − K·d in the down-positive frame → upward reaction is the negative,
    // i.e. Rv (up+) = F − K·d.
    let Rv = F[2 * n]; for (let j = 0; j < nD; j++) Rv -= K[2 * n][j] * d[j];
    let Rm = 0; if (s.type === 'fixed') { Rm = F[2 * n + 1]; for (let j = 0; j < nD; j++) Rm -= K[2 * n + 1][j] * d[j]; }
    return { pos: s.pos, Rv, Rm, fixed: s.type === 'fixed' };
  });

  // ── diagrams via statics (V, M) + FE nodal (v, θ) ──
  const nStat = inp.nStations ?? 400;
  const x: number[] = [], shear: number[] = [], moment: number[] = [], deflection: number[] = [], slope: number[] = [];
  const eps = L * 1e-6;
  const vAt = (xx: number) => {
    // locate element and Hermite-interpolate v
    let e = 0; for (let i = 0; i < nN - 1; i++) if (xx >= nodes[i] - eps && xx <= nodes[i + 1] + eps) { e = i; break; }
    const Le = nodes[e + 1] - nodes[e], xi = Math.min(1, Math.max(0, (xx - nodes[e]) / Le));
    const N1 = 1 - 3 * xi * xi + 2 * xi * xi * xi, N2 = Le * (xi - 2 * xi * xi + xi * xi * xi);
    const N3 = 3 * xi * xi - 2 * xi * xi * xi, N4 = Le * (-xi * xi + xi * xi * xi);
    const v1 = d[2 * e], t1 = d[2 * e + 1], v2 = d[2 * e + 2], t2 = d[2 * e + 3];
    return { v: N1 * v1 + N2 * t1 + N3 * v2 + N4 * t2, e, xi, Le, t1, t2, v1, v2 };
  };
  const shearStat = (xx: number) => {
    let V = 0;
    reactions.forEach((r) => { if (r.pos < xx) V += r.Rv; });
    inp.points.forEach((p) => { if (p.pos < xx) V -= p.P; });
    inp.dists.forEach((dd) => { V -= wIntegral(dd, xx); });
    return V;
  };
  const momentStat = (xx: number) => {
    let M = 0;
    // sum moments of all left-of-section forces about x. A left-end fixed support
    // (pos ≈ 0) is captured by the pos+eps stations. FE→BMD sign: M_bmd = −Rm.
    reactions.forEach((r) => { if (r.pos < xx) { M += r.Rv * (xx - r.pos) - r.Rm; } });
    inp.points.forEach((p) => { if (p.pos < xx) M -= p.P * (xx - p.pos); });
    inp.dists.forEach((dd) => { M -= wMomentIntegral(dd, xx); });
    inp.moments.forEach((m) => { if (m.pos < xx) M -= m.M; }); // CCW+ couple → BMD jumps down by M0
    return M;
  };
  // stations: dense grid + duplicated event points to render jumps
  const stationSet = new Set<number>();
  for (let i = 0; i <= nStat; i++) stationSet.add((i / nStat) * L);
  [...base].forEach((p) => { stationSet.add(Math.max(0, p - eps)); stationSet.add(Math.min(L, p + eps)); });
  const xs = [...stationSet].sort((a, b) => a - b);
  for (const xx of xs) {
    const info = vAt(xx);
    x.push(xx); shear.push(shearStat(xx)); moment.push(momentStat(xx));
    deflection.push(info.v);
    // slope dv/dx from Hermite derivative
    const { e, xi, Le, v1, t1, v2, t2 } = info;
    const dN1 = (-6 * xi + 6 * xi * xi) / Le, dN2 = 1 - 4 * xi + 3 * xi * xi, dN3 = (6 * xi - 6 * xi * xi) / Le, dN4 = -2 * xi + 3 * xi * xi;
    slope.push(dN1 * v1 + dN2 * t1 + dN3 * v2 + dN4 * t2); void e;
  }

  const argmax = (arr: number[], f: (v: number) => number) => { let bi = 0; for (let i = 1; i < arr.length; i++) if (f(arr[i]) > f(arr[bi])) bi = i; return bi; };
  const iVmax = argmax(shear, Math.abs), iMmax = argmax(moment, (v) => v), iMmin = argmax(moment, (v) => -v);
  const iDmax = argmax(deflection, (v) => v), iDmin = argmax(deflection, (v) => -v);
  const totalLoad = inp.points.reduce((s, p) => s + p.P, 0) + inp.dists.reduce((s, dd) => s + wIntegral(dd, L), 0);
  const reactSumV = reactions.reduce((s, r) => s + r.Rv, 0) - totalLoad;
  const loadScale = Math.max(1, Math.abs(totalLoad), ...reactions.map((r) => Math.abs(r.Rv)));
  const stable = !sol.singular && Math.abs(reactSumV) < 1e-4 * loadScale && d.every(Number.isFinite);

  return {
    reactions, x, shear, moment, deflection, slope, stable,
    Vmax: shear[iVmax], VmaxAt: x[iVmax],
    Mmax: moment[iMmax], MmaxAt: x[iMmax], Mmin: moment[iMmin], MminAt: x[iMmin],
    defMax: deflection[iDmax], defMaxAt: x[iDmax], defMin: deflection[iDmin], defMinAt: x[iDmin],
    reactSumV,
  };
}
