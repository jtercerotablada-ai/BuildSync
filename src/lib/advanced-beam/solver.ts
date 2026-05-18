// Advanced Beam — Euler-Bernoulli FEM solver
// Capabilities:
//   • Variable EI per segment (multi-section beams)
//   • Multiple supports: fixed / pin / roller / spring (k_v, k_r) / free
//   • Internal hinges (moment release nodes)
//   • Prescribed support settlements (mm) and rotations (rad)
//   • Loads: point, point moment, distributed (uniform/trapezoidal/triangular)
//   • Self-weight per segment
//   • Thermal gradient curvature
//   • Optional modal analysis (lowest N bending modes, consistent mass matrix)
//
// Numerical approach:
//   • Direct stiffness; Hermite cubic shape functions for displacement
//   • Hinges: duplicated θ DOFs at the hinge node (left side ≠ right side)
//   • Settlements: substitution method (partition free vs prescribed)
//   • V(x), M(x) post-processed by section-cut equilibrium (avoids numerical
//     differentiation noise; produces clean step jumps at point loads/moments)
//   • v(x), θ(x) via Hermite-cubic interpolation of the FE displacement vector

import type {
  BeamModel,
  Results,
  Reaction,
  DiagramPoint,
  Extremum,
  Segment,
  SolveOptions,
  ModalResult,
} from './types';

// ---------- Unit conversions ----------
const KN = 1000;          // 1 kN = 1000 N
const MPA = 1e6;          // 1 MPa = 1e6 N/m²  (= 1 N/mm² × 1e6 mm²/m²)
const MM4 = 1e-12;        // 1 mm⁴ = 1e-12 m⁴
const MM2 = 1e-6;         // 1 mm² = 1e-6  m²
const MM_TO_M = 1e-3;
const M_TO_MM = 1000;
const G = 9.81;           // m/s²
const TOL = 1e-9;

// ---------- Public entry point ----------
export function solve(model: BeamModel, opts: SolveOptions = {}): Results {
  const warnings: string[] = [];

  // ----- Input validation -----
  const L = model.totalLength;
  if (!isFinite(L) || L <= 0) {
    warnings.push('Beam length must be greater than zero');
    return emptyResults(warnings);
  }
  if (!model.segments.length) {
    warnings.push('At least one segment is required');
    return emptyResults(warnings);
  }
  for (const seg of model.segments) {
    if (seg.startPosition < -TOL || seg.endPosition > L + TOL) {
      warnings.push(`Segment ${seg.id} extends beyond beam length`);
      return emptyResults(warnings);
    }
    if (seg.endPosition - seg.startPosition <= TOL) {
      warnings.push(`Segment ${seg.id} has zero or negative length`);
      return emptyResults(warnings);
    }
    if (seg.E <= 0 || seg.I <= 0) {
      warnings.push(`Segment ${seg.id}: E and I must be positive`);
      return emptyResults(warnings);
    }
  }
  if (!model.supports.length) {
    warnings.push('At least one support is required');
    return emptyResults(warnings);
  }
  // Stability: need at least one v constraint, plus enough rotational/translational
  // constraints to prevent rigid-body modes. We rely on the linear solve to detect
  // singularity below if user has a truly unstable configuration.

  // ----- Build node list (positions, sorted, deduped) -----
  const positionSet = new Set<number>();
  positionSet.add(0);
  positionSet.add(L);
  for (const seg of model.segments) {
    positionSet.add(clamp(seg.startPosition, 0, L));
    positionSet.add(clamp(seg.endPosition, 0, L));
  }
  for (const s of model.supports) positionSet.add(clamp(s.position, 0, L));
  for (const h of model.hinges) positionSet.add(clamp(h.position, 0, L));
  for (const ld of model.loads) {
    if (ld.type === 'point' || ld.type === 'moment') {
      positionSet.add(clamp(ld.position, 0, L));
    } else if (ld.type === 'distributed') {
      positionSet.add(clamp(ld.startPosition, 0, L));
      positionSet.add(clamp(ld.endPosition, 0, L));
    }
  }
  // Densify mesh for accurate Hermite-cubic deflection (capture 4th-order shapes)
  const minElems = Math.max(40, Math.ceil(L * 8));
  for (let i = 1; i < minElems; i++) positionSet.add((i / minElems) * L);

  const nodePositions = dedupe(
    Array.from(positionSet)
      .map((x) => clamp(x, 0, L))
      .sort((a, b) => a - b),
    TOL,
  );
  const N = nodePositions.length;

  // Hinge node lookup
  const hingeAt: boolean[] = new Array(N).fill(false);
  for (const h of model.hinges) {
    const idx = findNode(nodePositions, h.position);
    // Hinges at the very ends have no effect (no element on one side)
    if (idx > 0 && idx < N - 1) hingeAt[idx] = true;
  }

  // ----- DOF map -----
  // Each node: 1 v-DOF + (hinge ? 2 : 1) θ-DOFs
  // For element k (between node k and k+1):
  //   left  θ DOF  = node k's RIGHT-side θ
  //   right θ DOF  = node (k+1)'s LEFT-side θ
  // At a non-hinge node, left-side θ === right-side θ.
  // At a hinge node, they are independent.
  const vDofOfNode: number[] = new Array(N);
  const thetaLeftOfNode: number[] = new Array(N);
  const thetaRightOfNode: number[] = new Array(N);
  let dofCount = 0;
  for (let i = 0; i < N; i++) {
    vDofOfNode[i] = dofCount++;
    const tDof = dofCount++;
    thetaLeftOfNode[i] = tDof;
    thetaRightOfNode[i] = hingeAt[i] ? dofCount++ : tDof;
  }
  const NDOF = dofCount;

  // ----- Assemble global stiffness K -----
  const K = zeros(NDOF, NDOF);
  const elementEI: number[] = new Array(N - 1);
  const elementSeg: (Segment | null)[] = new Array(N - 1);

  for (let e = 0; e < N - 1; e++) {
    const x1 = nodePositions[e];
    const x2 = nodePositions[e + 1];
    const Le = x2 - x1;
    if (Le < TOL) {
      elementEI[e] = 0;
      elementSeg[e] = null;
      continue;
    }
    const seg = findSegmentForRange(model.segments, x1, x2);
    elementSeg[e] = seg;
    if (!seg) {
      // Element falls outside any segment (gap in beam) — treat as rigid skip with zero EI
      // (this is an input error; warn and skip stiffness contribution)
      warnings.push(`No segment defined for x ∈ [${x1.toFixed(3)}, ${x2.toFixed(3)}]`);
      elementEI[e] = 0;
      continue;
    }
    const EI = seg.E * MPA * seg.I * MM4;
    elementEI[e] = EI;
    const ke = elementStiffness(EI, Le);
    const dofs = [
      vDofOfNode[e],
      thetaRightOfNode[e],
      vDofOfNode[e + 1],
      thetaLeftOfNode[e + 1],
    ];
    for (let a = 0; a < 4; a++) {
      for (let b = 0; b < 4; b++) {
        K[dofs[a]][dofs[b]] += ke[a][b];
      }
    }
  }

  // Spring supports → add to K diagonal
  for (const s of model.supports) {
    if (s.type !== 'spring') continue;
    const idx = findNode(nodePositions, s.position);
    if (s.kv && s.kv > 0) K[vDofOfNode[idx]][vDofOfNode[idx]] += s.kv * KN;
    if (s.kr && s.kr > 0) {
      // Apply rotational spring on BOTH sides if hinge (couples them through ground)
      K[thetaLeftOfNode[idx]][thetaLeftOfNode[idx]] += s.kr * KN;
      if (hingeAt[idx]) {
        K[thetaRightOfNode[idx]][thetaRightOfNode[idx]] += s.kr * KN;
      }
    }
  }

  // ----- Assemble load vector F -----
  const F = new Array(NDOF).fill(0);

  // Point loads
  for (const ld of model.loads) {
    if (ld.type !== 'point') continue;
    const idx = findNode(nodePositions, ld.position);
    const sign = ld.direction === 'up' ? 1 : -1;
    F[vDofOfNode[idx]] += sign * ld.magnitude * KN;
  }

  // Point moments — applied to RIGHT-side θ DOF at the node
  // (so M-diagram jump occurs immediately to the right of the application point)
  for (const ld of model.loads) {
    if (ld.type !== 'moment') continue;
    const idx = findNode(nodePositions, ld.position);
    const sign = ld.direction === 'ccw' ? 1 : -1;
    F[thetaRightOfNode[idx]] += sign * ld.magnitude * KN;
  }

  // Distributed loads (trapezoidal) → element-by-element FEM contributions
  for (const ld of model.loads) {
    if (ld.type !== 'distributed') continue;
    const sign = ld.direction === 'up' ? 1 : -1;
    const aPos = Math.min(ld.startPosition, ld.endPosition);
    const bPos = Math.max(ld.startPosition, ld.endPosition);
    const span = bPos - aPos;
    if (span < TOL) continue;
    const reversed = ld.startPosition > ld.endPosition;
    const wAraw = sign * Math.abs(ld.startMagnitude) * KN;
    const wBraw = sign * Math.abs(ld.endMagnitude) * KN;
    const wA = reversed ? wBraw : wAraw;
    const wB = reversed ? wAraw : wBraw;
    const intensityAt = (x: number) => wA + ((wB - wA) * (x - aPos)) / span;

    for (let e = 0; e < N - 1; e++) {
      const x1 = nodePositions[e];
      const x2 = nodePositions[e + 1];
      const Le = x2 - x1;
      if (Le < TOL) continue;
      if (x2 <= aPos + TOL || x1 >= bPos - TOL) continue;
      const wL = intensityAt(x1);
      const wR = intensityAt(x2);
      const fem = trapezoidFEM(Le, wL, wR);
      const dofs = [
        vDofOfNode[e],
        thetaRightOfNode[e],
        vDofOfNode[e + 1],
        thetaLeftOfNode[e + 1],
      ];
      for (let i = 0; i < 4; i++) F[dofs[i]] += fem[i];
    }
  }

  // Self-weight per segment (UDL = ρ·A·g, downward → negative)
  for (const seg of model.segments) {
    if (!seg.selfWeight) continue;
    const A = seg.A ?? 0;
    if (A <= 0) continue;
    const rho = seg.density ?? 7850;
    const w = -rho * A * MM2 * G;        // N/m, negative = downward
    if (Math.abs(w) < TOL) continue;
    for (let e = 0; e < N - 1; e++) {
      const x1 = nodePositions[e];
      const x2 = nodePositions[e + 1];
      if (x2 <= seg.startPosition + TOL || x1 >= seg.endPosition - TOL) continue;
      const Le = x2 - x1;
      if (Le < TOL) continue;
      const fem = trapezoidFEM(Le, w, w);
      const dofs = [
        vDofOfNode[e],
        thetaRightOfNode[e],
        vDofOfNode[e + 1],
        thetaLeftOfNode[e + 1],
      ];
      for (let i = 0; i < 4; i++) F[dofs[i]] += fem[i];
    }
  }

  // Thermal-gradient loads → equivalent nodal moments per element of the segment.
  //
  // Convention: deltaTGradient = T_top − T_bot. For top hotter (ΔT > 0), the FREE
  // beam bows DOWNWARD (hogging shape, v″ < 0). The "thermal curvature" the beam
  // wants to take is therefore κ_T = -α·ΔT_grad/h (negative for top hotter).
  //
  // Equivalent nodal load vector (from initial-strain virtual work derivation):
  //   F_θ_left  of element = -EI · κ_T
  //   F_θ_right of element = +EI · κ_T
  //   F_v ends = 0
  //
  // Sanity check: fixed-fixed beam, top hotter (ΔT > 0):
  //   κ_T < 0, internal moment after constraint = -EI·κ_T > 0 (SAGGING throughout)
  //   — supports must apply CW couples at ends to restrain the hogging tendency,
  //     producing uniform sagging-positive internal moment. ✓
  for (const ld of model.loads) {
    if (ld.type !== 'thermal') continue;
    const seg = model.segments.find((s) => s.id === ld.segmentId);
    if (!seg) {
      warnings.push(`Thermal load ${ld.id}: segment ${ld.segmentId} not found`);
      continue;
    }
    const alpha = seg.alpha ?? 1.2e-5;
    const h = seg.h ?? 0;
    if (h <= 0) {
      warnings.push(`Thermal load ${ld.id}: segment depth h must be > 0 (mm)`);
      continue;
    }
    const kappaT = -(alpha * ld.deltaTGradient) / (h * MM_TO_M);    // rad/m
    const EI = seg.E * MPA * seg.I * MM4;
    for (let e = 0; e < N - 1; e++) {
      const x1 = nodePositions[e];
      const x2 = nodePositions[e + 1];
      if (x2 <= seg.startPosition + TOL || x1 >= seg.endPosition - TOL) continue;
      F[thetaRightOfNode[e]]   += -EI * kappaT;
      F[thetaLeftOfNode[e + 1]] += +EI * kappaT;
    }
  }

  // ----- Boundary conditions: prescribed displacements -----
  // Map: dof index → prescribed value (m for v, rad for θ)
  const prescribed = new Map<number, number>();
  for (const s of model.supports) {
    const idx = findNode(nodePositions, s.position);
    const settle = (s.settlement ?? 0) * MM_TO_M; // mm → m, +ve downward
    const settleSigned = -settle; // our sign convention: +v UP, settlement is downward
    const rot = s.rotation ?? 0;

    if (s.type === 'fixed') {
      prescribed.set(vDofOfNode[idx], settleSigned);
      prescribed.set(thetaLeftOfNode[idx], rot);
      if (hingeAt[idx]) prescribed.set(thetaRightOfNode[idx], rot);
    } else if (s.type === 'pin' || s.type === 'roller') {
      prescribed.set(vDofOfNode[idx], settleSigned);
    } else if (s.type === 'spring') {
      // Springs are stiffness contributions, not constraints.
      // If user provided a settlement on a spring support, treat as a "ground displacement"
      // that creates an equivalent force F = k * settlement on the structure side.
      if (s.settlement !== undefined && s.kv && s.kv > 0) {
        F[vDofOfNode[idx]] += s.kv * KN * settleSigned;
      }
      if (s.rotation !== undefined && s.kr && s.kr > 0) {
        F[thetaLeftOfNode[idx]] += s.kr * KN * rot;
        if (hingeAt[idx]) F[thetaRightOfNode[idx]] += s.kr * KN * rot;
      }
    }
    // 'free' → no constraint
  }

  // ----- Solve via partition: K_ff·u_f = F_f − K_fp·u_p -----
  const free: number[] = [];
  const pres: number[] = [];
  const presValue: number[] = [];
  for (let i = 0; i < NDOF; i++) {
    if (prescribed.has(i)) {
      pres.push(i);
      presValue.push(prescribed.get(i)!);
    } else {
      free.push(i);
    }
  }
  const Kff = free.map((i) => free.map((j) => K[i][j]));
  const Kfp = free.map((i) => pres.map((j) => K[i][j]));
  const Ff_load = free.map((i) => F[i]);
  const Ff = Ff_load.map((v, i) => {
    let s = v;
    for (let k = 0; k < pres.length; k++) s -= Kfp[i][k] * presValue[k];
    return s;
  });

  let uf: number[] | null = null;
  if (free.length === 0) {
    uf = [];
  } else {
    uf = solveLinear(Kff, Ff);
  }
  if (uf === null) {
    warnings.push('Solver failed — beam appears unstable (singular stiffness matrix). Check supports and hinges.');
    return emptyResults(warnings);
  }

  const u = new Array(NDOF).fill(0);
  free.forEach((dof, i) => (u[dof] = uf![i]));
  pres.forEach((dof, i) => (u[dof] = presValue[i]));

  // ----- Reactions -----
  // R = (K · u − F) at constrained DOFs, plus spring reactions
  const Ku = matVec(K, u);
  const reactions: Reaction[] = [];
  for (const s of model.supports) {
    const idx = findNode(nodePositions, s.position);
    let Rv = 0;
    let Rm = 0;

    // Sign convention for the displayed moment reaction r.M (sagging-positive):
    //   We display the INTERNAL bending moment at the support face, measured just inside
    //   the beam. For a support where the beam extends to the RIGHT (left/interior support),
    //   r.M = M_sagging(x_supp+) = -Mccw_couple_on_beam.
    //   For the rightmost support (beam ends here, extends to the LEFT only),
    //   r.M = M_sagging(x_supp-) = +Mccw_couple_on_beam.
    const isRightEnd = idx === N - 1;
    const sagSign = isRightEnd ? +1 : -1;

    if (s.type === 'spring') {
      // Spring exerts force F = -k·(u − u_ground) on the structure.
      // Reaction (force the support exerts on the beam, +ve up) = F.
      // u is in m (or rad); k is in kN/m (or kN·m/rad) → result is kN (or kN·m).
      const groundV = s.settlement !== undefined ? -(s.settlement * MM_TO_M) : 0;
      const groundR = s.rotation ?? 0;
      if (s.kv && s.kv > 0) {
        Rv = -s.kv * (u[vDofOfNode[idx]] - groundV);
      }
      if (s.kr && s.kr > 0) {
        const thetaAvg = hingeAt[idx]
          ? 0.5 * (u[thetaLeftOfNode[idx]] + u[thetaRightOfNode[idx]])
          : u[thetaLeftOfNode[idx]];
        // CCW couple applied on beam by rotational spring: M_ccw = -kr·(θ - θ_ground).
        const Mccw = -s.kr * (thetaAvg - groundR);
        Rm = sagSign * Mccw;
      }
    } else if (s.type !== 'free') {
      // For pin/roller/fixed: reaction = K·u − F at the constrained DOF
      const dofV = vDofOfNode[idx];
      Rv = (Ku[dofV] - F[dofV]) / KN;
      if (s.type === 'fixed') {
        const dofM = thetaLeftOfNode[idx];
        const Mccw = (Ku[dofM] - F[dofM]) / KN;
        Rm = sagSign * Mccw;
        if (hingeAt[idx]) {
          const dofM2 = thetaRightOfNode[idx];
          const Mccw2 = (Ku[dofM2] - F[dofM2]) / KN;
          Rm += sagSign * Mccw2;
        }
      }
    }

    reactions.push({ supportId: s.id, position: s.position, type: s.type, V: Rv, M: Rm });
  }

  // ----- Sample x positions for diagrams -----
  const numSamples = opts.samples ?? model.samples ?? 600;
  const xset = new Set<number>();
  for (let k = 0; k <= numSamples; k++) xset.add((k / numSamples) * L);
  for (const x of nodePositions) xset.add(x);
  for (const s of model.supports) {
    xset.add(Math.max(0, s.position - 1e-7));
    xset.add(Math.min(L, s.position + 1e-7));
  }
  for (const ld of model.loads) {
    if (ld.type === 'point' || ld.type === 'moment') {
      xset.add(Math.max(0, ld.position - 1e-7));
      xset.add(Math.min(L, ld.position + 1e-7));
    } else if (ld.type === 'distributed') {
      xset.add(Math.max(0, ld.startPosition - 1e-7));
      xset.add(Math.min(L, ld.startPosition + 1e-7));
      xset.add(Math.max(0, ld.endPosition - 1e-7));
      xset.add(Math.min(L, ld.endPosition + 1e-7));
    }
  }
  const xs = Array.from(xset)
    .map((x) => clamp(x, 0, L))
    .sort((a, b) => a - b);

  // ----- V(x), M(x) by section-cut equilibrium -----
  // Sum forces and moments to the LEFT of the cut at x:
  //   V(x) = -Σ (F_left_vertical)          — convention: right side reacts; +V means right
  //   M(x) =  Σ (F·(x − x_F)) + Σ M_left   — sagging positive
  // For cuts at x = L, exclude the right-end reaction (it's outside the cut).
  const shear: DiagramPoint[] = [];
  const moment: DiagramPoint[] = [];
  for (const x of xs) {
    let V = 0;
    let M = 0;
    const atRightEnd = Math.abs(x - L) < TOL;

    // Reactions to the left of (or at) x
    for (const r of reactions) {
      if (r.position <= x + TOL) {
        if (atRightEnd && Math.abs(r.position - L) < TOL) continue;
        V += r.V;
        M += r.V * (x - r.position);
        M += r.M; // sagging-positive moment at fixed support contributes
      }
    }

    // Point loads strictly to the left
    for (const ld of model.loads) {
      if (ld.type === 'point' && ld.position < x - TOL) {
        const P = (ld.direction === 'up' ? 1 : -1) * ld.magnitude;
        V += P;
        M += P * (x - ld.position);
      }
    }

    // Point moments strictly to the left → sagging M decreases by CCW applied moment
    for (const ld of model.loads) {
      if (ld.type !== 'moment') continue;
      if (ld.position < x - TOL) {
        const S = (ld.direction === 'ccw' ? 1 : -1) * ld.magnitude;
        M -= S;
      }
    }

    // Distributed load contributions for portion x_a..min(x, x_b)
    for (const ld of model.loads) {
      if (ld.type !== 'distributed') continue;
      const sign = ld.direction === 'up' ? 1 : -1;
      const aPos = Math.min(ld.startPosition, ld.endPosition);
      const bPos = Math.max(ld.startPosition, ld.endPosition);
      const span = bPos - aPos;
      if (span < TOL) continue;
      if (x <= aPos) continue;
      const reversed = ld.startPosition > ld.endPosition;
      const wAraw = sign * Math.abs(ld.startMagnitude);
      const wBraw = sign * Math.abs(ld.endMagnitude);
      const wA = reversed ? wBraw : wAraw;
      const wB = reversed ? wAraw : wBraw;
      const hi = Math.min(x, bPos);
      const Lx = hi - aPos;
      if (Lx <= 0) continue;
      const wHi = wA + ((wB - wA) * Lx) / span;
      const D = x - aPos;
      V += (Lx * (wA + wHi)) / 2;
      M += wA * (D * Lx - (Lx * Lx) / 2) + (wHi - wA) * ((D * Lx) / 2 - (Lx * Lx) / 3);
    }

    // Self-weight (treat each segment as UDL)
    for (const seg of model.segments) {
      if (!seg.selfWeight) continue;
      const A = seg.A ?? 0;
      if (A <= 0) continue;
      const rho = seg.density ?? 7850;
      const w = -rho * A * MM2 * G / KN; // kN/m, negative = downward
      const aPos = seg.startPosition;
      const bPos = Math.min(seg.endPosition, x);
      if (x <= aPos) continue;
      const Lx = bPos - aPos;
      if (Lx <= 0) continue;
      V += w * Lx;
      M += w * Lx * (x - (aPos + bPos) / 2);
    }

    shear.push({ x, value: V });
    moment.push({ x, value: M });
  }

  // ----- v(x) and θ(x) via Hermite cubic interpolation of FE displacement -----
  const deflection: DiagramPoint[] = [];
  const slope: DiagramPoint[] = [];
  for (const x of xs) {
    const e = findElement(nodePositions, x);
    const x1 = nodePositions[e];
    const x2 = nodePositions[e + 1];
    const Le = x2 - x1;
    let v = 0;
    let th = 0;
    if (Le > TOL) {
      const xi = (x - x1) / Le;
      const v1 = u[vDofOfNode[e]];
      const t1 = u[thetaRightOfNode[e]];
      const v2 = u[vDofOfNode[e + 1]];
      const t2 = u[thetaLeftOfNode[e + 1]];
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
    deflection.push({ x, value: v * M_TO_MM });
    slope.push({ x, value: th });
  }

  const maxShear = findMaxAbs(shear, true);
  const minShear = findMaxAbs(shear, false);
  const maxMoment = findMaxAbs(moment, true);
  const minMoment = findMaxAbs(moment, false);
  const maxDeflection = findMaxAbsMag(deflection);

  // ----- Optional modal analysis -----
  let modes: ModalResult[] | undefined;
  if (opts.computeModes && opts.computeModes > 0) {
    try {
      modes = computeModes(
        nodePositions,
        elementSeg,
        elementEI,
        vDofOfNode,
        thetaLeftOfNode,
        thetaRightOfNode,
        K,
        prescribed,
        free,
        opts.computeModes,
      );
    } catch (e: unknown) {
      warnings.push(`Modal analysis skipped: ${(e as Error).message ?? 'numerical issue'}`);
    }
  }

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
    modes,
    warnings,
    solved: true,
  };
}

// =====================================================================
// Helpers
// =====================================================================

// Element stiffness for Euler-Bernoulli beam (4×4)
function elementStiffness(EI: number, L: number): number[][] {
  const c = EI / (L * L * L);
  return [
    [12 * c,        6 * c * L,    -12 * c,       6 * c * L    ],
    [6 * c * L,    4 * c * L * L, -6 * c * L,   2 * c * L * L ],
    [-12 * c,      -6 * c * L,    12 * c,       -6 * c * L    ],
    [6 * c * L,    2 * c * L * L, -6 * c * L,   4 * c * L * L ],
  ];
}

// Consistent mass matrix for Euler-Bernoulli beam (4×4), per unit ρA
function elementMass(rhoA: number, L: number): number[][] {
  const c = (rhoA * L) / 420;
  return [
    [156 * c,        22 * L * c,    54 * c,       -13 * L * c  ],
    [22 * L * c,    4 * L * L * c, 13 * L * c,   -3 * L * L * c],
    [54 * c,        13 * L * c,    156 * c,      -22 * L * c   ],
    [-13 * L * c,  -3 * L * L * c, -22 * L * c,  4 * L * L * c ],
  ];
}

// FEM equivalent nodal forces for trapezoidal load on element of length L,
// with intensity wL (left node, N/m) and wR (right node, N/m).
// Returns [F_v1, F_θ1, F_v2, F_θ2].
function trapezoidFEM(
  L: number,
  wL: number,
  wR: number,
): [number, number, number, number] {
  const dw = wR - wL;
  const Fv1 = (wL * L) / 2 + (3 * dw * L) / 20;
  const Ft1 = (wL * L * L) / 12 + (dw * L * L) / 30;
  const Fv2 = (wL * L) / 2 + (7 * dw * L) / 20;
  const Ft2 = -(wL * L * L) / 12 - (dw * L * L) / 20;
  return [Fv1, Ft1, Fv2, Ft2];
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
  let bestD = Infinity;
  for (let i = 0; i < nodes.length; i++) {
    const d = Math.abs(nodes[i] - pos);
    if (d < bestD) {
      bestD = d;
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

function findSegmentForRange(
  segments: Segment[],
  x1: number,
  x2: number,
): Segment | null {
  const mid = 0.5 * (x1 + x2);
  for (const s of segments) {
    if (mid >= s.startPosition - TOL && mid <= s.endPosition + TOL) return s;
  }
  return null;
}

function matVec(A: number[][], x: number[]): number[] {
  const n = A.length;
  const m = x.length;
  const out = new Array(n).fill(0);
  for (let i = 0; i < n; i++) {
    let s = 0;
    for (let j = 0; j < m; j++) s += A[i][j] * x[j];
    out[i] = s;
  }
  return out;
}

function solveLinear(A: number[][], b: number[]): number[] | null {
  const n = A.length;
  if (n === 0) return [];
  // Build augmented matrix
  const M = A.map((row, i) => [...row, b[i]]);
  for (let i = 0; i < n; i++) {
    // Partial pivoting
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
      if (f === 0) continue;
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

// =====================================================================
// Modal analysis: lowest N bending modes via inverse iteration with deflation
// =====================================================================
function computeModes(
  nodePositions: number[],
  elementSeg: (Segment | null)[],
  elementEI: number[],
  vDofOfNode: number[],
  thetaLeftOfNode: number[],
  thetaRightOfNode: number[],
  K: number[][],
  prescribed: Map<number, number>,
  free: number[],
  numModes: number,
): ModalResult[] {
  const N = nodePositions.length;
  const NDOF = K.length;
  const M = zeros(NDOF, NDOF);
  for (let e = 0; e < N - 1; e++) {
    const seg = elementSeg[e];
    if (!seg) continue;
    const A = seg.A ?? 0;
    const rho = seg.density ?? 7850;
    if (A <= 0) continue;
    const rhoA = rho * A * MM2;            // kg/m
    const Le = nodePositions[e + 1] - nodePositions[e];
    const me = elementMass(rhoA, Le);
    const dofs = [
      vDofOfNode[e],
      thetaRightOfNode[e],
      vDofOfNode[e + 1],
      thetaLeftOfNode[e + 1],
    ];
    for (let a = 0; a < 4; a++)
      for (let b = 0; b < 4; b++) M[dofs[a]][dofs[b]] += me[a][b];
  }

  // Restrict to free DOFs
  const Kff = free.map((i) => free.map((j) => K[i][j]));
  const Mff = free.map((i) => free.map((j) => M[i][j]));
  const n = free.length;
  if (n === 0) return [];

  // Inverse iteration with M-orthogonal deflation against previously found modes
  const modes: ModalResult[] = [];
  const eigvecs: number[][] = [];
  const eigvals: number[] = [];

  for (let m = 0; m < numModes; m++) {
    // Random initial vector (M-orthogonal to previous modes)
    let v = new Array(n).fill(0).map(() => Math.random() - 0.5);
    v = mNormalize(v, Mff);
    for (const prev of eigvecs) v = mDeflate(v, prev, Mff);

    let omega2 = 0;
    for (let iter = 0; iter < 200; iter++) {
      // Solve K · w = M · v
      const Mv = matVec(Mff, v);
      const w = solveLinear(Kff, Mv);
      if (!w) throw new Error('singular K_ff in modal solve');
      // Deflate against previous modes
      let wd = w;
      for (const prev of eigvecs) wd = mDeflate(wd, prev, Mff);
      const wn = mNormalize(wd, Mff);
      // Rayleigh quotient
      const Kwn = matVec(Kff, wn);
      const Mwn = matVec(Mff, wn);
      const num = dot(wn, Kwn);
      const den = dot(wn, Mwn);
      const ray = num / den;
      const conv = Math.abs(ray - omega2) / Math.max(1e-12, Math.abs(ray));
      omega2 = ray;
      v = wn;
      if (iter > 3 && conv < 1e-9) break;
    }
    eigvals.push(omega2);
    eigvecs.push(v);

    // Build full DOF vector and extract v-DOFs for shape display
    const uFull = new Array(NDOF).fill(0);
    free.forEach((d, i) => (uFull[d] = v[i]));
    // Set prescribed DOFs to zero (modes operate on free system)
    prescribed.forEach((_, d) => (uFull[d] = 0));
    const shape: DiagramPoint[] = [];
    for (let i = 0; i < N; i++) shape.push({ x: nodePositions[i], value: uFull[vDofOfNode[i]] });
    const omega = Math.sqrt(Math.max(0, omega2));
    modes.push({ frequencyHz: omega / (2 * Math.PI), omega, shape });
  }
  return modes;
}

function dot(a: number[], b: number[]): number {
  let s = 0;
  for (let i = 0; i < a.length; i++) s += a[i] * b[i];
  return s;
}

function mNormalize(v: number[], M: number[][]): number[] {
  const Mv = matVec(M, v);
  const norm = Math.sqrt(Math.max(1e-30, dot(v, Mv)));
  return v.map((x) => x / norm);
}

function mDeflate(v: number[], prev: number[], M: number[][]): number[] {
  const Mprev = matVec(M, prev);
  const proj = dot(v, Mprev);
  return v.map((x, i) => x - proj * prev[i]);
}
