/**
 * ACI 318-19 — Reinforced Concrete Column Design (rectangular tied + circular
 * spiral). US customary units internally: force = kip, stress = ksi, length =
 * in, moment = kip·in.  Es = 29,000 ksi, εcu = 0.003.
 *
 * Limit states / features:
 *  · Uniaxial P-M interaction (Ch. 22 strain compatibility) about each axis,
 *    with the true circular-segment compression block for round columns.
 *  · Biaxial bending — Bresler reciprocal load (high axial) + PCA load contour
 *    (low axial).
 *  · Slenderness / moment magnification (§6.2.5, §6.6.4 non-sway δns).
 *  · Detailing limits (§10.6, §10.7, §25.7).
 *
 * Validated against ACI 318-19 hand calcs + PCA/StructurePoint values — see
 * aciColumn.selftest.ts.
 */
export const ES = 29000; // ksi
export const EPS_CU = 0.003;
/** Stress-block factor β1 (Table 22.2.2.4.3); f′c in psi. */
export function beta1(fcPsi: number): number {
  if (fcPsi <= 4000) return 0.85;
  if (fcPsi >= 8000) return 0.65;
  return 0.85 - 0.05 * (fcPsi - 4000) / 1000;
}

export const PHI_TIED = 0.65;
export const PHI_SPIRAL = 0.75;

/** φ from net tensile strain (extreme tension layer); spiral vs tied. */
export function phiCol(epsT: number, fy: number, spiral: boolean): number {
  const ety = fy / ES;
  const phi0 = spiral ? PHI_SPIRAL : PHI_TIED;
  if (epsT <= ety) return phi0;
  if (epsT >= ety + 0.003) return 0.9;
  return phi0 + (0.9 - phi0) * (epsT - ety) / 0.003;
}
export const Ec = (fc: number) => 57000 * Math.sqrt(fc * 1000) / 1000; // ksi (fc in ksi → psi → ksi)

/* ── section + reinforcement ──────────────────────────────────────────── */
export type ColSection = { kind: 'rect'; b: number; h: number } | { kind: 'circ'; D: number };
export interface BarPt { x: number; y: number; area: number } // from geometric centroid (in)

/** Rectangular perimeter layout: nx bars per horizontal face, ny per vertical
 *  face, corners shared. inset = cover + tie dia + bar dia/2. */
export function rectBars(b: number, h: number, inset: number, area: number, nx: number, ny: number): BarPt[] {
  const xs = (n: number) => (n <= 1 ? [0] : Array.from({ length: n }, (_, i) => -(b / 2 - inset) + i * (b - 2 * inset) / (n - 1)));
  const ysCol = (n: number) => (n <= 1 ? [0] : Array.from({ length: n }, (_, i) => -(h / 2 - inset) + i * (h - 2 * inset) / (n - 1)));
  const pts: BarPt[] = [];
  const xrow = xs(nx);
  for (const x of xrow) { pts.push({ x, y: h / 2 - inset, area }); pts.push({ x, y: -(h / 2 - inset), area }); }
  const ycol = ysCol(ny);
  for (let i = 1; i < ny - 1; i++) { const y = ycol[i]; pts.push({ x: b / 2 - inset, y, area }); pts.push({ x: -(b / 2 - inset), y, area }); }
  return pts;
}
/** Circular ring layout: N bars equally spaced at radius R = D/2 − inset. */
export function circBars(D: number, inset: number, area: number, N: number): BarPt[] {
  const R = D / 2 - inset;
  return Array.from({ length: N }, (_, i) => { const t = (2 * Math.PI * i) / N - Math.PI / 2; return { x: R * Math.cos(t), y: R * Math.sin(t), area }; });
}

export const grossArea = (s: ColSection) => (s.kind === 'rect' ? s.b * s.h : Math.PI * s.D * s.D / 4);
export const grossI = (s: ColSection, axis: 'x' | 'y') => (s.kind === 'rect' ? (axis === 'x' ? s.b * s.h ** 3 : s.h * s.b ** 3) / 12 : Math.PI * s.D ** 4 / 64);

/* ── concrete compression resultant ───────────────────────────────────── */
function ccRect(fc: number, a: number, width: number, H: number): { Cc: number; yBar: number } {
  const aa = Math.min(Math.max(a, 0), H);
  return { Cc: 0.85 * fc * aa * width, yBar: aa / 2 };
}
/** Circular segment cut at depth a from the extreme compression fiber:
 *  area and centroid depth from that fiber (d0 goes negative past center). */
export function circSegment(D: number, a: number): { area: number; centroidFromFiber: number } {
  const R = D / 2, aa = Math.min(Math.max(a, 0), D), d0 = R - aa;
  const root = Math.sqrt(Math.max(0, R * R - d0 * d0));
  const area = R * R * Math.acos(Math.max(-1, Math.min(1, d0 / R))) - d0 * root;
  const ybarFromCenter = area > 1e-9 ? (2 / 3) * Math.pow(Math.max(0, R * R - d0 * d0), 1.5) / area : 0;
  return { area, centroidFromFiber: R - ybarFromCenter };
}
function ccCirc(fc: number, a: number, D: number): { Cc: number; yBar: number } {
  const seg = circSegment(D, a);
  return { Cc: 0.85 * fc * seg.area, yBar: seg.centroidFromFiber };
}

/* ── uniaxial P-M interaction about one axis ──────────────────────────── */
export interface PMPoint { c: number; Pn: number; PnRaw: number; Mn: number; phi: number; phiPn: number; phiMn: number; epsT: number }
export interface ColInteraction {
  Ag: number; Ast: number; Po: number; PnMax: number; phiPnMax: number; points: PMPoint[];
}
export function interactionAxis(section: ColSection, bars: BarPt[], fc: number, fy: number, axis: 'x' | 'y', spiral: boolean): ColInteraction {
  const H = section.kind === 'rect' ? (axis === 'x' ? section.h : section.b) : section.D;
  const width = section.kind === 'rect' ? (axis === 'x' ? section.b : section.h) : 0;
  const R = section.kind === 'circ' ? section.D / 2 : 0;
  const bd = bars.map((b) => ({ d: section.kind === 'rect' ? H / 2 - (axis === 'x' ? b.y : b.x) : R - (axis === 'x' ? b.y : b.x), area: b.area }));
  const dt = Math.max(...bd.map((b) => b.d));
  const Ag = grossArea(section), Ast = bars.reduce((s, b) => s + b.area, 0);
  const Po = 0.85 * fc * (Ag - Ast) + fy * Ast;
  const PnMax = (spiral ? 0.85 : 0.8) * Po;
  const phi0 = spiral ? PHI_SPIRAL : PHI_TIED;
  const b1 = beta1(fc * 1000); // beta1 expects psi
  const ety = fy / ES;

  const evalC = (c: number): PMPoint => {
    const a = b1 * c;
    const cc = section.kind === 'rect' ? ccRect(fc, a, width, H) : ccCirc(fc, a, section.D);
    let Pn = cc.Cc, Mn = cc.Cc * (H / 2 - cc.yBar);
    for (const b of bd) {
      const eps = EPS_CU * (c - b.d) / c;
      let fs = Math.max(-fy, Math.min(fy, ES * eps));
      if (b.d < a && fs > 0) fs -= 0.85 * fc; // displaced concrete for compression bars in the block
      Pn += b.area * fs; Mn += b.area * fs * (H / 2 - b.d);
    }
    const epsT = EPS_CU * (dt - c) / c;
    const phi = phiCol(epsT, fy, spiral);
    const PnCap = Math.min(Pn, PnMax);
    return { c, Pn: PnCap, PnRaw: Pn, Mn, phi, phiPn: phi * PnCap, phiMn: phi * Mn, epsT };
  };

  const cs: number[] = [];
  for (let f = 0.025; f <= 3.0; f += 0.025) cs.push(f * H);
  for (const et of [ety, ety + 0.003]) { const c = dt * EPS_CU / (EPS_CU + et); if (c > 0 && c < 3 * H) cs.push(c); }
  let lo = dt * EPS_CU / (EPS_CU + ety), hi = 3 * H;
  if (evalC(lo).PnRaw < PnMax && evalC(hi).PnRaw >= PnMax) { for (let k = 0; k < 40; k++) { const m = (lo + hi) / 2; if (evalC(m).PnRaw < PnMax) lo = m; else hi = m; } cs.push((lo + hi) / 2); }
  cs.sort((a, b) => b - a);
  const points: PMPoint[] = cs.map(evalC);
  const Tn = -fy * Ast;
  points.push({ c: 0, Pn: Tn, PnRaw: Tn, Mn: 0, phi: 0.9, phiPn: 0.9 * Tn, phiMn: 0, epsT: 0.05 });
  return { Ag, Ast, Po, PnMax, phiPnMax: phi0 * PnMax, points };
}

/** Design moment capacity φMn at a factored axial Pu (outer envelope). */
export function momentCapacityAt(res: ColInteraction, Pu: number): number {
  const p = res.points; let best = 0;
  for (let i = 0; i < p.length - 1; i++) {
    const a = p[i], b = p[i + 1], lo = Math.min(a.phiPn, b.phiPn), hi = Math.max(a.phiPn, b.phiPn);
    if (Pu >= lo && Pu <= hi) { const t = Math.abs(b.phiPn - a.phiPn) < 1e-9 ? 0 : (Pu - a.phiPn) / (b.phiPn - a.phiPn); best = Math.max(best, a.phiMn + t * (b.phiMn - a.phiMn)); }
  }
  return best;
}
/** UNCAPPED nominal axial Pn on the compression branch at a nominal moment Mn.
 *  Bresler needs the true nominal capacity — NOT the Pn,max-capped design value. */
export function axialAtMoment(res: ColInteraction, Mn: number): number {
  const p = res.points; let best = 0;
  for (let i = 0; i < p.length - 1; i++) {
    const a = p[i], b = p[i + 1], lo = Math.min(a.Mn, b.Mn), hi = Math.max(a.Mn, b.Mn);
    if (Mn >= lo && Mn <= hi) { const t = Math.abs(b.Mn - a.Mn) < 1e-9 ? 0 : (Mn - a.Mn) / (b.Mn - a.Mn); best = Math.max(best, a.PnRaw + t * (b.PnRaw - a.PnRaw)); }
  }
  return best;
}

/* ── biaxial bending ──────────────────────────────────────────────────── */
export interface BiaxialResult {
  method: 'Bresler reciprocal' | 'PCA load contour'; adequate: boolean; ratio: number;
  phiPn?: number; Pnx0?: number; Pny0?: number; Po?: number; phiMnx0?: number; phiMny0?: number; alpha?: number;
}
export function biaxial(xi: ColInteraction, yi: ColInteraction, fc: number, Ag: number, Pu: number, Mux: number, Muy: number, spiral: boolean, alpha = 1.0): BiaxialResult {
  const phi0 = spiral ? PHI_SPIRAL : PHI_TIED;
  const highAxial = Pu >= 0.1 * fc * Ag;
  if (highAxial && Pu > 0) {
    // Bresler reciprocal: uniaxial axial capacities at the required nominal moments
    const Pnx0 = axialAtMoment(xi, Mux / phi0);
    const Pny0 = axialAtMoment(yi, Muy / phi0);
    const Po = xi.Po;
    const inv = 1 / Pnx0 + 1 / Pny0 - 1 / Po;
    const Pn = inv > 0 ? 1 / inv : Infinity;
    const phiPn = Math.min(phi0 * Pn, xi.phiPnMax);
    return { method: 'Bresler reciprocal', adequate: phiPn >= Pu, ratio: Pu / phiPn, phiPn, Pnx0, Pny0, Po };
  }
  // PCA load contour at the given axial load
  const phiMnx0 = momentCapacityAt(xi, Pu);
  const phiMny0 = momentCapacityAt(yi, Pu);
  const rx = phiMnx0 > 0 ? Math.pow(Mux / phiMnx0, alpha) : (Mux > 0 ? Infinity : 0);
  const ry = phiMny0 > 0 ? Math.pow(Muy / phiMny0, alpha) : (Muy > 0 ? Infinity : 0);
  const ratio = rx + ry;
  return { method: 'PCA load contour', adequate: ratio <= 1.0, ratio, phiMnx0, phiMny0, alpha };
}

/* ── slenderness / moment magnification (§6.2.5, §6.6.4 non-sway) ──────── */
export interface SlenderResult {
  r: number; klu_r: number; neglectLimit: number; slender: boolean;
  Pc: number; Cm: number; deltaNs: number; M2min: number; Mc: number; unstable: boolean;
}
export function slenderness(p: {
  section: ColSection; axis: 'x' | 'y'; k: number; lu: number; Pu: number;
  M1: number; M2: number; fc: number; betaDns: number; transverseLoad: boolean;
}): SlenderResult {
  const H = p.section.kind === 'rect' ? (p.axis === 'x' ? p.section.h : p.section.b) : p.section.D;
  const r = p.section.kind === 'rect' ? 0.3 * H : 0.25 * p.section.D;
  const klu_r = p.k * p.lu / r;
  const ratioM = p.M2 !== 0 ? p.M1 / p.M2 : 0; // + single curvature
  const neglectLimit = Math.min(34 - 12 * ratioM, 40);
  const slender = klu_r > neglectLimit;
  const EI = (0.4 * Ec(p.fc) * grossI(p.section, p.axis)) / (1 + Math.max(0, Math.min(1, p.betaDns)));
  const Pc = (Math.PI ** 2 * EI) / Math.pow(p.k * p.lu, 2);
  const Cm = p.transverseLoad ? 1.0 : 0.6 + 0.4 * ratioM; // §6.6.4.5.3a (no 0.4 floor in 318-19)
  const M2min = p.Pu * (0.6 + 0.03 * H); // kip·in
  const M2eff = Math.max(p.M2, M2min);
  const denom = 1 - p.Pu / (0.75 * Pc);
  const unstable = denom <= 0;
  const deltaNs = unstable ? Infinity : Math.max(1.0, Cm / denom);
  const Mc = deltaNs * M2eff;
  return { r, klu_r, neglectLimit, slender, Pc, Cm, deltaNs, M2min, Mc, unstable };
}

/* ── detailing limits (§10.6, §10.7, §25.7) ───────────────────────────── */
export interface DetailResult {
  rho: number; rhoOk: boolean; AstMin: number; AstMax: number;
  minBars: number; barsOk: boolean; tieSpacing: number;
  spiralRhoMin?: number;
}
export function detailing(p: {
  section: ColSection; Ast: number; nBars: number; spiral: boolean;
  longBarDia: number; tieBarDia: number; cover: number; fc: number; fyt: number;
}): DetailResult {
  const Ag = grossArea(p.section);
  const rho = p.Ast / Ag;
  const AstMin = 0.01 * Ag, AstMax = 0.08 * Ag;
  const minBars = p.spiral ? 6 : 4;
  const leastDim = p.section.kind === 'rect' ? Math.min(p.section.b, p.section.h) : p.section.D;
  const tieSpacing = Math.min(16 * p.longBarDia, 48 * p.tieBarDia, leastDim);
  let spiralRhoMin: number | undefined;
  if (p.spiral && p.section.kind === 'circ') {
    const Dch = p.section.D - 2 * p.cover; const Ach = Math.PI * Dch * Dch / 4;
    spiralRhoMin = 0.45 * (Ag / Ach - 1) * p.fc / p.fyt;
  }
  return { rho, rhoOk: rho >= 0.01 && rho <= 0.08, AstMin, AstMax, minBars, barsOk: p.nBars >= minBars, tieSpacing, spiralRhoMin };
}
