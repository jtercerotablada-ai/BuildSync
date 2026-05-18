// Multi-span continuous beam solver — Phase 5a
//
// Implements the stiffness (matrix) method for a 1-D Euler-Bernoulli beam
// with arbitrary supports (pin / roller / fix / free) at each node. All
// spans share the same EI (constant cross-section); per-span EI variation
// can be added later. Loads include UDL (DL + LL split) per span and an
// arbitrary list of point loads per span.
//
// The solver returns moment Mu(x) and shear Vu(x) tabulated at `nStations`
// points per span. Pattern loading per ACI §6.4 — live load on alternating
// spans — is applied via envelope (max + and max − across all patterns).
//
// References:
//   • Hibbeler, "Structural Analysis" 9e §10–11
//   • ACI 318-25 §6.4 (analysis of continuous beams + pattern loading)
//   • McCormac & Brown, "Reinforced Concrete Design" 10e §13

import type {
  ContinuousBeamModel, ContinuousSpan, ManualStation, PointLoad, SupportType,
} from './types';

// ─── Stiffness method primitives ────────────────────────────────────────────

interface BeamElement {
  /** Span length L (mm). */
  L: number;
  /** Bending stiffness EI (constant, kN·mm²). EI is set by the analyzer
   *  using Ec and Ig from the section properties. */
  EI: number;
  /** Distributed load w (kN/mm) — total factored UDL (DL + LL pattern). */
  w: number;
  /** Point loads, x measured from left end of element (mm), P in kN. */
  P: { x: number; P: number }[];
  /** Node indices (left, right) into the global node array. */
  nLeft: number;
  nRight: number;
}

/** 4×4 element stiffness for a Euler-Bernoulli beam (DOFs: vL, θL, vR, θR).
 *  Standard textbook form, units kN/mm and kN·mm/rad. */
function elementK(L: number, EI: number): number[][] {
  const c = EI / Math.pow(L, 3);
  return [
    [12 * c,        6 * L * c,    -12 * c,       6 * L * c   ],
    [6 * L * c,     4 * L * L * c, -6 * L * c,    2 * L * L * c],
    [-12 * c,      -6 * L * c,    12 * c,       -6 * L * c   ],
    [6 * L * c,     2 * L * L * c, -6 * L * c,    4 * L * L * c],
  ];
}

/** 4-vector of fixed-end forces / moments for a UDL w (kN/mm) on span L (mm).
 *  Sign convention: + transverse load downward → reactions upward. */
function udlFEF(L: number, w: number): number[] {
  // FEF for UDL (clamped-clamped): VL = wL/2, ML = wL²/12, VR = wL/2, MR = -wL²/12
  return [
    w * L / 2,
    w * L * L / 12,
    w * L / 2,
    -w * L * L / 12,
  ];
}

/** FEF for a point load P at position a from the left end of a beam length L. */
function pointFEF(L: number, P: number, a: number): number[] {
  const b = L - a;
  // Clamped-clamped FEF for a point load
  // V_L = P·b²·(3a + b)/L³, M_L = P·a·b²/L²
  // V_R = P·a²·(a + 3b)/L³, M_R = -P·a²·b/L²
  const VL = P * b * b * (3 * a + b) / Math.pow(L, 3);
  const ML = P * a * b * b / Math.pow(L, 2);
  const VR = P * a * a * (a + 3 * b) / Math.pow(L, 3);
  const MR = -P * a * a * b / Math.pow(L, 2);
  return [VL, ML, VR, MR];
}

/** Solve linear system Kx = F with simple LU (Doolittle). For small N (< 50)
 *  this is plenty fast and avoids a numerics dependency. */
function solveLinear(A: number[][], b: number[]): number[] {
  const n = A.length;
  const M = A.map((row, i) => [...row, b[i]]);
  // Forward elimination (with partial pivoting)
  for (let k = 0; k < n; k++) {
    let pivot = k;
    for (let i = k + 1; i < n; i++) {
      if (Math.abs(M[i][k]) > Math.abs(M[pivot][k])) pivot = i;
    }
    if (pivot !== k) [M[k], M[pivot]] = [M[pivot], M[k]];
    const akk = M[k][k];
    if (Math.abs(akk) < 1e-14) {
      throw new Error(`Singular system at row ${k}`);
    }
    for (let i = k + 1; i < n; i++) {
      const f = M[i][k] / akk;
      for (let j = k; j <= n; j++) M[i][j] -= f * M[k][j];
    }
  }
  // Back substitution
  const x = new Array<number>(n).fill(0);
  for (let i = n - 1; i >= 0; i--) {
    let s = M[i][n];
    for (let j = i + 1; j < n; j++) s -= M[i][j] * x[j];
    x[i] = s / M[i][i];
  }
  return x;
}

// ─── Public API ─────────────────────────────────────────────────────────────

export interface ContinuousAnalysisOptions {
  /** Bending stiffness EI (kN·mm²) — should match the actual cross-section. */
  EI: number;
  /** When true, apply ACI §6.4 pattern loading — LL on alternating spans
   *  produces an envelope with max +M (midspan) and max −M (supports). */
  pattern?: boolean;
}

export interface ContinuousResult {
  /** Stations along the FULL beam (x from 0 to total length, mm). */
  stations: ManualStation[];
  /** Moment envelope (max +) per station (kN·m). */
  Mmax: number[];
  /** Moment envelope (max -) per station (kN·m). */
  Mmin: number[];
  /** Shear envelope (max abs value per station, kN). */
  Vabs: number[];
  /** Total length of the beam (sum of all span lengths, mm). */
  Ltotal: number;
  /** Span boundaries (x positions of nodes) in mm. */
  spanBoundaries: number[];
  /** Per-pattern raw moment / shear traces — for diagnostics if needed. */
  patterns: { name: string; M: number[]; V: number[] }[];
}

/** Run a single load case on the continuous beam. Returns M, V at each station. */
function runOneCase(
  spans: ContinuousSpan[],
  supports: SupportType[],
  EI: number,
  /** For each span, the UDL w (kN/mm) used in this case (DL or DL+LL pattern). */
  perSpanW: number[],
  nStations: number,
): { M: number[]; V: number[]; stationsX: number[] } {
  const nNodes = spans.length + 1;
  const nDOF = 2 * nNodes;          // (v, θ) per node

  // Assemble global stiffness K and load vector F
  const K: number[][] = Array.from({ length: nDOF }, () => new Array(nDOF).fill(0));
  const F: number[] = new Array(nDOF).fill(0);

  const elements: BeamElement[] = spans.map((sp, i) => ({
    L: sp.L, EI,
    w: perSpanW[i],
    P: (sp.point ?? []).map((p) => ({ x: p.x, P: p.Pu })),
    nLeft: i, nRight: i + 1,
  }));

  for (const el of elements) {
    const ke = elementK(el.L, el.EI);
    const fef = udlFEF(el.L, el.w);
    for (const p of el.P) {
      const pfef = pointFEF(el.L, p.P, p.x);
      for (let i = 0; i < 4; i++) fef[i] += pfef[i];
    }
    // DOF map: [vL, θL, vR, θR] → [2*nL, 2*nL+1, 2*nR, 2*nR+1]
    const dof = [2 * el.nLeft, 2 * el.nLeft + 1, 2 * el.nRight, 2 * el.nRight + 1];
    for (let i = 0; i < 4; i++) {
      F[dof[i]] += fef[i];
      for (let j = 0; j < 4; j++) {
        K[dof[i]][dof[j]] += ke[i][j];
      }
    }
  }

  // Apply boundary conditions (zero DOFs)
  // v constrained at pin/roller/fix; θ constrained only at fix
  const fixedDof = new Set<number>();
  supports.forEach((sup, i) => {
    if (sup === 'pin' || sup === 'roller' || sup === 'fix') {
      fixedDof.add(2 * i);          // v = 0
    }
    if (sup === 'fix') {
      fixedDof.add(2 * i + 1);      // θ = 0
    }
    // 'free' → no constraint (cantilever end)
  });

  // Reduce K, F
  const freeDof: number[] = [];
  for (let i = 0; i < nDOF; i++) if (!fixedDof.has(i)) freeDof.push(i);
  const Kr = freeDof.map((i) => freeDof.map((j) => K[i][j]));
  const Fr = freeDof.map((i) => F[i]);

  if (Kr.length === 0) {
    // All DOFs fixed (degenerate) — return zeros
    return { M: new Array(nStations * spans.length + 1).fill(0),
             V: new Array(nStations * spans.length + 1).fill(0),
             stationsX: [] };
  }

  // Solve
  const ur = solveLinear(Kr, Fr);

  // Re-assemble full displacement vector
  const u = new Array(nDOF).fill(0);
  freeDof.forEach((dof, i) => { u[dof] = ur[i]; });

  // Compute moments + shears at element-internal stations
  const stationsX: number[] = [];
  const Mglobal: number[] = [];
  const Vglobal: number[] = [];
  let xOffset = 0;

  for (let e = 0; e < elements.length; e++) {
    const el = elements[e];
    const dof = [2 * el.nLeft, 2 * el.nLeft + 1, 2 * el.nRight, 2 * el.nRight + 1];
    const ue = dof.map((d) => u[d]);
    const ke = elementK(el.L, el.EI);
    // Internal forces at LEFT end (with FEF correction for span loads)
    const fefSpan = udlFEF(el.L, el.w);
    for (const p of el.P) {
      const pfef = pointFEF(el.L, p.P, p.x);
      for (let i = 0; i < 4; i++) fefSpan[i] += pfef[i];
    }
    // Element internal forces at LEFT end of element. The stiffness method
    // assembles F[node] += FEF[member end], producing displacements u that
    // satisfy F = K·u. The recovered "Q_e = K·u − FEF" gives nodal loads
    // FROM the member, with V's sign opposite to the standard sagging-positive
    // shear convention. M's sign is correct (sagging-positive).
    //
    // We negate V to match the sagging-positive convention, so that:
    //   V positive = upward shear on left face of the cut (=  R_L for SS beam)
    //   M positive = sagging
    const KuV =
      ke[0][0] * ue[0] + ke[0][1] * ue[1] + ke[0][2] * ue[2] + ke[0][3] * ue[3];
    const KuM =
      ke[1][0] * ue[0] + ke[1][1] * ue[1] + ke[1][2] * ue[2] + ke[1][3] * ue[3];
    const VL_int = -(KuV - fefSpan[0]);           // kN, sagging-positive
    const ML_int = KuM - fefSpan[1];              // kN·mm, sagging-positive

    // Walk along the element. At each station x_e ∈ [0, L], compute:
    //   V(x) = VL − w·x − Σ Pi(x ≥ ai)
    //   M(x) = ML + VL·x − w·x²/2 − Σ Pi·(x − ai)·H(x ≥ ai)
    const NS = nStations;
    // Internal units: V in kN, M in kN·mm. Convert M to kN·m for output.
    for (let s = 0; s < NS; s++) {
      const xe = (s / (NS - 1)) * el.L;
      let V = VL_int - el.w * xe;
      let M_kNmm = ML_int + VL_int * xe - el.w * xe * xe / 2;
      for (const p of el.P) {
        if (xe >= p.x) {
          V -= p.P;
          M_kNmm -= p.P * (xe - p.x);
        }
      }
      const xGlobal = xOffset + xe;
      // First station of subsequent elements would duplicate the previous element's
      // last station — skip duplicates (keep the first element's first, then s>0 thereafter).
      if (e > 0 && s === 0) continue;
      stationsX.push(xGlobal);
      Vglobal.push(V);
      Mglobal.push(M_kNmm / 1000);   // kN·mm → kN·m
    }
    xOffset += el.L;
  }

  return { M: Mglobal, V: Vglobal, stationsX };
}

/** Compute the M+/M-/Vmax envelope across DL + (LL on each subset of spans). */
export function analyzeContinuous(
  model: ContinuousBeamModel,
  opts: ContinuousAnalysisOptions,
): ContinuousResult {
  const NS = Math.max(2, model.nStations ?? 11);
  const supports = model.supports;
  const spans = model.spans;
  const nSpans = spans.length;
  if (supports.length !== nSpans + 1) {
    throw new Error(`supports.length must be spans.length + 1 (${supports.length} vs ${nSpans + 1})`);
  }

  const Ltotal = spans.reduce((s, sp) => s + sp.L, 0);
  const spanBoundaries: number[] = [0];
  let acc = 0;
  for (const sp of spans) { acc += sp.L; spanBoundaries.push(acc); }

  // DL only — every span sees its full wDL (and any point loads we treat as DL)
  const wDL = spans.map((sp) => (sp.wDL ?? 0) / 1000);   // kN/m → kN/mm

  // Pattern cases:
  //   • CASE 0: DL only           — baseline
  //   • CASE 1..2^N − 1: DL + LL on each non-empty subset of spans. For
  //     practical purposes ACI §6.4.2 uses only the worst-case patterns:
  //     (a) LL on all spans, (b) LL on alternating spans (two phasings),
  //     (c) LL on each pair of adjacent spans.
  // We generate the practical-engineering set (~2N + 2 patterns) which
  // bounds the envelope without explosion of cases.

  const patterns: { name: string; spansWithLL: boolean[] }[] = [];

  // (a) LL on all spans
  patterns.push({ name: 'LL all', spansWithLL: spans.map(() => true) });
  // (b) LL on alternating spans (two phasings)
  patterns.push({ name: 'LL alt-1', spansWithLL: spans.map((_, i) => i % 2 === 0) });
  patterns.push({ name: 'LL alt-2', spansWithLL: spans.map((_, i) => i % 2 === 1) });
  // (c) LL on each pair of adjacent spans
  for (let i = 0; i < nSpans - 1; i++) {
    const flags = spans.map(() => false);
    flags[i] = true; flags[i + 1] = true;
    patterns.push({ name: `LL pair ${i}-${i + 1}`, spansWithLL: flags });
  }
  // (d) LL on each single span
  for (let i = 0; i < nSpans; i++) {
    const flags = spans.map(() => false);
    flags[i] = true;
    patterns.push({ name: `LL span ${i}`, spansWithLL: flags });
  }
  // (e) DL only
  patterns.push({ name: 'DL only', spansWithLL: spans.map(() => false) });

  const usePattern = model.patternLL !== false;
  const usedPatterns = usePattern ? patterns : [{ name: 'DL+LL all', spansWithLL: spans.map(() => true) }];

  // Run each pattern
  const traces: { name: string; M: number[]; V: number[] }[] = [];
  let stationsXRef: number[] | null = null;
  for (const pat of usedPatterns) {
    const wTotal = wDL.map((w, i) => w + (pat.spansWithLL[i] ? (spans[i].wLL ?? 0) / 1000 : 0));
    const r = runOneCase(spans, supports, opts.EI, wTotal, NS);
    traces.push({ name: pat.name, M: r.M, V: r.V });
    if (!stationsXRef) stationsXRef = r.stationsX;
  }
  const stationsX = stationsXRef!;

  // Envelope
  const Mmax = stationsX.map((_, i) =>
    Math.max(...traces.map((t) => t.M[i])));
  const Mmin = stationsX.map((_, i) =>
    Math.min(...traces.map((t) => t.M[i])));
  const Vabs = stationsX.map((_, i) =>
    Math.max(...traces.map((t) => Math.abs(t.V[i]))));

  // Build station list with worst-case (max abs) M and V per station.
  // For the existing single-span machinery we feed |M| and |V| as factored
  // demand. Detailing of negative-moment regions requires the SIGN, so we
  // also expose Mmax/Mmin separately on ContinuousResult.
  const stations: ManualStation[] = stationsX.map((x, i) => ({
    x,
    Mu: Math.abs(Mmax[i]) > Math.abs(Mmin[i]) ? Mmax[i] : Mmin[i],
    Vu: Vabs[i],
  }));

  return { stations, Mmax, Mmin, Vabs, Ltotal, spanBoundaries, patterns: traces };
}

/** Convenience: convert a continuous beam result into the existing
 *  DemandSource['kind' = 'manual'] payload so it can be analyzed by the
 *  envelope machinery (which already handles arbitrary station tables). */
export function continuousToManual(r: ContinuousResult): { stations: ManualStation[] } {
  // Use absolute values — the envelope analyzer treats demands as magnitudes
  // for capacity check; sign is preserved for visualization.
  return {
    stations: r.stations.map((s) => ({
      x: s.x, Mu: Math.abs(s.Mu), Vu: Math.abs(s.Vu),
    })),
  };
}

/** Helper for the UI: re-assemble a list of point loads attached per-span
 *  from a flat list with global x. */
export function flattenPointLoads(spans: ContinuousSpan[]): PointLoad[] {
  const out: PointLoad[] = [];
  let off = 0;
  for (const sp of spans) {
    for (const p of sp.point ?? []) out.push({ x: off + p.x, Pu: p.Pu });
    off += sp.L;
  }
  return out;
}

/** Helper for the UI: build a sensible default ContinuousBeamModel given
 *  a number of equal spans. */
export function defaultContinuousModel(nSpans: number, spanLength: number, wDL = 0, wLL = 0): ContinuousBeamModel {
  const spans: ContinuousSpan[] = Array.from({ length: nSpans }, () => ({
    L: spanLength, wDL, wLL, point: [],
  }));
  // Default: pin at left, rollers at all interior + right ends
  const supports: SupportType[] = ['pin', ...Array(nSpans - 1).fill('roller'), 'roller'];
  return { spans, supports, nStations: 11, patternLL: true };
}

// Re-export types so consumers only need to import from this file
export type { SupportType };
