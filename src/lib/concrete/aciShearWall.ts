/**
 * ACI 318-19 — Reinforced Concrete Shear (Structural) Wall Design.
 * US customary units internally: force = lb, stress = psi, length = in.
 * (The UI converts to kips, kip·ft, ft.)  Es = 29,000,000 psi, εcu = 0.003.
 *
 * Rectangular wall of length lw and thickness h resisting in-plane shear,
 * in-plane moment and axial load.  Limit states:
 *  · In-plane shear      §11.5.4  (special §18.10.4)
 *  · Axial-flexure P-M    Ch. 22 strain compatibility (distributed + boundary steel)
 *  · Simplified axial     §11.5.3
 *  · Minimum reinforcement §11.6 / detailing §11.7
 *  · Special boundary elements §18.10.6
 *
 * Validated against ACI 318-19 clause arithmetic + PCA Notes / StructurePoint
 * values — see aciShearWall.selftest.ts.
 */

export const ES = 29_000_000; // psi
export const EPS_CU = 0.003;

export function beta1(fc: number): number {
  if (fc <= 4000) return 0.85;
  if (fc >= 8000) return 0.65;
  return 0.85 - 0.05 * (fc - 4000) / 1000;
}
export function epsTy(fy: number): number { return fy / ES; }

/** φ vs net tensile strain of the extreme tension layer (Grade-60 tied member). */
export function phiFromEps(epsT: number, fy: number): number {
  const ety = epsTy(fy);
  if (epsT <= ety) return 0.65;
  if (epsT >= ety + 0.003) return 0.9;
  return 0.65 + 0.25 * (epsT - ety) / 0.003;
}

/* ── in-plane shear (§11.5.4 / §18.10.4) ──────────────────────────────── */
export interface ShearInputs {
  lw: number; h: number;   // in
  fc: number; fy: number;  // psi
  rho_t: number;           // horizontal (transverse) distributed steel ratio
  hw_lw: number;           // wall (or segment) aspect ratio
  lambda: number;          // lightweight factor
  special: boolean;        // special seismic wall (§18.10.4)
  phiOverride?: number;    // e.g. 0.60 for overstrength-governed seismic shear
}
export interface ShearResult {
  clause: string; Acv: number; alpha_c: number; sqrtFc: number;
  Vc_term: number; Vs_term: number; Vn: number; Vn_cap: number; capped: boolean;
  phi: number; phiVn: number;
}
export function alphaC(hw_lw: number): number {
  if (hw_lw <= 1.5) return 3.0;
  if (hw_lw >= 2.0) return 2.0;
  return 3.0 - (3.0 - 2.0) * (hw_lw - 1.5) / (2.0 - 1.5);
}
export function inplaneShear(s: ShearInputs): ShearResult {
  const Acv = s.h * s.lw;
  const ac = alphaC(s.hw_lw);
  const sq = Math.sqrt(s.fc);
  const Vc_term = ac * s.lambda * sq * Acv;
  const Vs_term = s.rho_t * s.fy * Acv;
  let Vn = Vc_term + Vs_term;
  // web-crushing cap: ordinary 10√f'c·Acv (§11.5.4.1); special wall 8√f'c·Acv (§18.10.4.4 overall)
  const capCoef = s.special ? 8 : 10;
  const Vn_cap = capCoef * sq * Acv;
  const capped = Vn > Vn_cap;
  Vn = Math.min(Vn, Vn_cap);
  const phi = s.phiOverride ?? 0.75;
  return { clause: s.special ? '18.10.4' : '11.5.4', Acv, alpha_c: ac, sqrtFc: sq, Vc_term, Vs_term, Vn, Vn_cap, capped, phi, phiVn: phi * Vn };
}

/* ── axial-flexure P-M interaction (Ch. 22 strain compatibility) ───────── */
export interface WallReinf {
  rho_l: number;      // distributed vertical steel ratio (web)
  nLayers: number;    // discretisation of distributed steel along lw
  AsBoundary: number; // concentrated vertical steel area at EACH end (in²)
  dBoundary: number;  // distance of boundary bars from the wall edge (in)
}
export interface PMPoint { c: number; Pn: number; Mn: number; phi: number; phiPn: number; phiMn: number; epsT: number; }
export interface InteractionResult {
  Ag: number; Ast: number; Po: number; PnMax: number; phiPnMax: number;
  points: PMPoint[];  // ordered from pure axial (top) down through bending into tension
}

function steelLayers(lw: number, h: number, r: WallReinf): { d: number; As: number }[] {
  const layers: { d: number; As: number }[] = [];
  const AsDistTotal = r.rho_l * h * lw;
  const per = AsDistTotal / r.nLayers;
  for (let i = 0; i < r.nLayers; i++) layers.push({ d: (i + 0.5) * lw / r.nLayers, As: per });
  if (r.AsBoundary > 0) { layers.push({ d: r.dBoundary, As: r.AsBoundary }); layers.push({ d: lw - r.dBoundary, As: r.AsBoundary }); }
  return layers;
}

export function interaction(lw: number, h: number, fc: number, fy: number, r: WallReinf): InteractionResult {
  const Ag = lw * h;
  const layers = steelLayers(lw, h, r);
  const Ast = layers.reduce((s, l) => s + l.As, 0);
  const Po = 0.85 * fc * (Ag - Ast) + fy * Ast;
  const PnMax = 0.8 * Po; // tied
  const b1 = beta1(fc);
  const dt = Math.max(...layers.map((l) => l.d)); // extreme tension layer depth
  const ety = fy / ES;

  const evalC = (c: number): PMPoint & { PnRaw: number } => {
    const a = Math.min(b1 * c, lw);
    const Cc = 0.85 * fc * a * h;
    let Pn = Cc, Mn = Cc * (lw / 2 - a / 2);
    for (const L of layers) {
      const eps = EPS_CU * (c - L.d) / c;
      let fs = Math.max(-fy, Math.min(fy, ES * eps));
      if (L.d < a && fs > 0) fs -= 0.85 * fc; // displaced concrete for compression bars in the block
      const F = L.As * fs;
      Pn += F; Mn += F * (lw / 2 - L.d);
    }
    const epsT = EPS_CU * (dt - c) / c; // + when dt > c (tension)
    const phi = phiFromEps(epsT, fy);
    const PnCap = Math.min(Pn, PnMax);
    return { c, Pn: PnCap, PnRaw: Pn, Mn, phi, phiPn: phi * PnCap, phiMn: phi * Mn, epsT };
  };

  // sweep c; add exact nodes at the φ-transition strains and the Pn,max plateau
  // corner so the piecewise-linear envelope never straddles a kink.
  const cs: number[] = [];
  for (let f = 0.025; f <= 3.0; f += 0.025) cs.push(f * lw);
  for (const et of [ety, ety + 0.003]) { const c = dt * EPS_CU / (EPS_CU + et); if (c > 0 && c < 3 * lw) cs.push(c); }
  // bisection for the c where the UNCLAMPED Pn first reaches Pn,max (plateau corner)
  let lo = dt * EPS_CU / (EPS_CU + ety), hi = 3 * lw;
  if (evalC(lo).PnRaw < PnMax && evalC(hi).PnRaw >= PnMax) {
    for (let k = 0; k < 40; k++) { const mid = (lo + hi) / 2; if (evalC(mid).PnRaw < PnMax) lo = mid; else hi = mid; }
    cs.push((lo + hi) / 2);
  }
  cs.sort((a, b) => b - a); // large c (high axial) first
  const pts: PMPoint[] = cs.map((c) => { const { PnRaw, ...p } = evalC(c); void PnRaw; return p; });
  // pure-tension endpoint (all steel yields)
  const Tn = -fy * Ast;
  pts.push({ c: 0, Pn: Tn, Mn: 0, phi: 0.9, phiPn: 0.9 * Tn, phiMn: 0, epsT: 0.05 });
  return { Ag, Ast, Po, PnMax, phiPnMax: 0.65 * PnMax, points: pts };
}

/** Design moment capacity φMn at a given factored axial Pu (outer envelope). */
export function momentCapacityAt(res: InteractionResult, Pu: number): number {
  const p = res.points;
  let best = 0;
  for (let i = 0; i < p.length - 1; i++) {
    const a = p[i], b = p[i + 1];
    const lo = Math.min(a.phiPn, b.phiPn), hi = Math.max(a.phiPn, b.phiPn);
    if (Pu >= lo && Pu <= hi) {
      const t = Math.abs(b.phiPn - a.phiPn) < 1e-9 ? 0 : (Pu - a.phiPn) / (b.phiPn - a.phiPn);
      best = Math.max(best, a.phiMn + t * (b.phiMn - a.phiMn));
    }
  }
  return best;
}

/* ── simplified axial strength (§11.5.3) ──────────────────────────────── */
export function simplifiedAxial(lw: number, h: number, fc: number, lc: number, k: number): { Pn: number; phiPn: number } {
  const Ag = lw * h;
  const bracket = 1 - Math.pow(k * lc / (32 * h), 2);
  const Pn = 0.55 * fc * Ag * Math.max(0, bracket);
  return { Pn, phiPn: 0.65 * Pn };
}

/* ── minimum reinforcement + detailing (§11.6 / §11.7) ─────────────────── */
export interface MinReinfResult {
  rho_l_min: number; rho_t_min: number; shearSignificant: boolean;
  twoCurtains: boolean; twoCurtainReason: string; spacingMax: number;
}
export function minReinforcement(p: {
  lw: number; h: number; fc: number; fy: number; lambda: number;
  Vu: number; phiVc: number; hw_lw: number; rho_t: number; barNo5OrSmaller: boolean; special: boolean;
}): MinReinfResult {
  const Acv = p.h * p.lw;
  const shearSignificant = p.special
    ? p.Vu > Acv * p.lambda * Math.sqrt(p.fc)          // §18.10.2.1
    : p.Vu > 0.5 * p.phiVc;                             // §11.6.2
  let rho_t_min: number, rho_l_min: number;
  if (shearSignificant || p.special) {
    rho_t_min = 0.0025; rho_l_min = 0.0025;
    if (!p.special) {
      // Eq. 11.6.2 raises vertical steel for squat walls; uses the PROVIDED ρt,
      // ρl need not exceed ρt.
      rho_l_min = Math.max(0.0025, Math.min(p.rho_t, 0.0025 + 0.5 * (2.5 - p.hw_lw) * (p.rho_t - 0.0025)));
    } else if (p.hw_lw <= 2.0) {
      rho_l_min = Math.max(rho_l_min, p.rho_t); // §18.10.4.3
    }
  } else {
    // Table 11.6.1: reduced ratios depend on bar size / grade (No.5-or-smaller & fy≥60 ksi)
    const small = p.barNo5OrSmaller && p.fy >= 60000;
    rho_t_min = small ? 0.0020 : 0.0025;
    rho_l_min = small ? 0.0012 : 0.0015;
  }
  const twoCurtainThresh = 2 * p.lambda * Math.sqrt(p.fc) * Acv;
  const byShear = p.Vu > twoCurtainThresh, byThick = p.h > 10, byAspect = p.special && p.hw_lw >= 2.0;
  const twoCurtains = byShear || byThick || byAspect;
  const reason = [byShear && 'Vu > 2λ√f′c·Acv', byThick && 'h > 10 in', byAspect && 'special, hw/lw ≥ 2'].filter(Boolean).join('; ') || '—';
  const spacingMax = Math.min(3 * p.h, 18);
  return { rho_l_min, rho_t_min, shearSignificant, twoCurtains, twoCurtainReason: reason, spacingMax };
}

/* ── special boundary elements (§18.10.6) ─────────────────────────────── */
export interface BoundaryResult {
  cLimit: number; cDemand: number; requiredByDisp: boolean;
  sigma: number; sigmaLimit: number; requiredByStress: boolean;
  extent: number | null;
}
export function boundaryElement(p: {
  lw: number; h: number; fc: number; c: number; Pu: number; Mu: number; deltaU: number; hw: number;
}): BoundaryResult {
  const drift = Math.max(p.deltaU / p.hw, 0.005); // floor per §18.10.6.2
  const cLimit = p.lw / (600 * 1.5 * drift);
  const requiredByDisp = p.c >= cLimit;
  // stress trigger (§18.10.6.3): gross section, elastic, factored
  const Ag = p.lw * p.h, Ig = p.h * Math.pow(p.lw, 3) / 12, S = Ig / (p.lw / 2);
  const sigma = p.Pu / Ag + p.Mu / S; // psi (Pu in lb, Mu in lb·in)
  const sigmaLimit = 0.2 * p.fc;
  const requiredByStress = sigma > sigmaLimit;
  const required = requiredByDisp || requiredByStress;
  const extent = required ? Math.max(p.c - 0.1 * p.lw, p.c / 2) : null;
  return { cLimit, cDemand: p.c, requiredByDisp, sigma, sigmaLimit, requiredByStress, extent };
}
