// Slab Design — solver
// Computes design moments, reinforcement, deflection, punching shear, crack control
// per ACI 318-19 and EN 1992-1-1.

import {
  type Code,
  type SlabInput,
  type SlabAnalysis,
  type Geometry,
  type Materials,
  type Loads,
  type ReinforcementResult,
  type DeflectionResult,
  type PunchingResult,
  type CrackControlResult,
  type MomentSet,
  type EdgeCondition,
  type PanelEdges,
  CONCRETE_PRESETS,
  REBAR_PRESETS,
  BAR_CATALOG,
} from './types';
import { lookupMethod3, classifyEdgesToCase, type Method3Case } from './method3-coefficients';

const G = 9.81;

// ================================================================
// Public entry point
// ================================================================
export function analyze(input: SlabInput): SlabAnalysis {
  const warnings: string[] = [];

  // ---- Defaults ----
  const code = input.code;
  const g = applyGeometryDefaults(input.geometry);
  const m = applyMaterialDefaults(input.materials);
  const e = input.edges;

  // ---- Validation ----
  if (g.Lx <= 0 || g.Ly <= 0) {
    warnings.push('Both Lx and Ly must be > 0');
    return emptyResult(code, g, m, input.loads, e, warnings);
  }
  if (g.h <= 0) {
    warnings.push('Slab thickness h must be > 0');
    return emptyResult(code, g, m, input.loads, e, warnings);
  }
  if (m.fc <= 0 || m.fy <= 0) {
    warnings.push("f'c and fy must be > 0");
    return emptyResult(code, g, m, input.loads, e, warnings);
  }

  // ---- Derived quantities ----
  const wSelf = (m.gammaC ?? 24) * (g.h / 1000);                       // kN/m²
  const DL = (input.loads.DL_super ?? 0) + wSelf;                      // kN/m²
  const LL = input.loads.LL ?? 0;
  const factor_DL = input.loads.factor_DL ?? defaultFactor('DL', code);
  const factor_LL = input.loads.factor_LL ?? defaultFactor('LL', code);
  const wu = factor_DL * DL + factor_LL * LL;                          // factored
  const wService = DL + LL;                                            // unfactored, for SLS

  // ---- Classification ----
  const Lx = g.Lx, Ly = g.Ly;
  const longSide: 'x' | 'y' = Lx >= Ly ? 'x' : 'y';
  const longLen  = Math.max(Lx, Ly);
  const shortLen = Math.min(Lx, Ly);
  const beta = longLen / shortLen;                                     // ≥ 1
  const classification: 'one-way' | 'two-way' = beta > 2.0 ? 'one-way' : 'two-way';

  // ---- Moments ----
  let moments: MomentSet;
  let caseNum: Method3Case | undefined;
  if (classification === 'one-way') {
    moments = oneWayMoments(shortLen, wu, factor_DL * DL, factor_LL * LL, e, longSide);
  } else {
    const c = classifyEdgesToCase(e, longSide);
    if (c === null) {
      warnings.push('Edge configuration unsupported by Method 3 (e.g. all four edges free).');
      return emptyResult(code, g, m, input.loads, e, warnings);
    }
    caseNum = c;
    moments = twoWayMoments(shortLen, longLen, wu, factor_DL * DL, factor_LL * LL, c, longSide);
  }

  // ---- Reinforcement design ----
  const reinforcement = designReinforcement(moments, g, m, code);

  // ---- Deflection ----
  const deflection = checkDeflection(g, m, e, classification, beta, wService, code);

  // ---- Punching shear (optional) ----
  let punching: PunchingResult | undefined;
  if (input.punching) {
    punching = checkPunching(input.punching, g, m, code);
  }

  // ---- Crack control on midspan reinforcement (worst direction) ----
  const worstMid = pickWorstMidspan(reinforcement);
  const crackControl = worstMid ? checkCrackControl(worstMid, m, code, g) : undefined;

  return {
    geometry: g,
    materials: m,
    loads: { ...input.loads, DL_self: wSelf },
    edges: e,
    code,
    beta,
    classification,
    case: caseNum,
    wu,
    wSelf,
    wService,
    moments,
    reinforcement,
    deflection,
    punching,
    crackControl,
    warnings,
    solved: true,
  };
}

// ================================================================
// Defaults
// ================================================================
function applyGeometryDefaults(g: Geometry): Geometry {
  return {
    Lx: g.Lx,
    Ly: g.Ly,
    h: g.h,
    cover_bottom_x: g.cover_bottom_x ?? 25,
    cover_bottom_y: g.cover_bottom_y ?? 35,
    cover_top_x:    g.cover_top_x    ?? 25,
    cover_top_y:    g.cover_top_y    ?? 35,
  };
}

function applyMaterialDefaults(mat: Materials): Materials {
  const fc = mat.concreteGrade && mat.concreteGrade !== 'custom'
    ? CONCRETE_PRESETS[mat.concreteGrade].fc : mat.fc;
  const fy = mat.rebarGrade && mat.rebarGrade !== 'custom'
    ? REBAR_PRESETS[mat.rebarGrade].fy : mat.fy;
  return {
    fc,
    fy,
    fr: mat.fr ?? 0.62 * Math.sqrt(fc),
    gammaC: mat.gammaC ?? 24,
    Es: mat.Es ?? 200_000,
    concreteGrade: mat.concreteGrade,
    rebarGrade: mat.rebarGrade,
  };
}

function defaultFactor(kind: 'DL' | 'LL', code: Code): number {
  if (code === 'ACI 318-19') return kind === 'DL' ? 1.2 : 1.6;       // ACI §5.3.1 basic
  /* EN 1992-1-1, Eurocode partial safety factors */
  return kind === 'DL' ? 1.35 : 1.5;                                  // EN 1990 Table A1.2(B)
}

// ================================================================
// Moment computation
// ================================================================
function oneWayMoments(
  L_short: number,
  wu: number,
  DLu: number,
  LLu: number,
  edges: PanelEdges,
  longSide: 'x' | 'y',
): MomentSet {
  // Use ACI 318-19 §6.5 simplified continuous beam coefficients on the SHORT direction.
  // The long direction carries only minimum reinforcement (handled in design).
  // Edge condition along the SHORT direction = the two edges perpendicular to short span
  // = the LONG edges of the slab.
  const longEdges  = longSide === 'x' ? [edges.top, edges.bottom] : [edges.left, edges.right];
  const supportType = longEdges.map((e) => e === 'fixed' ? 'fixed' : e === 'simple' ? 'simple' : 'free');

  // Choose representative coefficients
  let Cmid = 1 / 8;        // SS default
  let Cend_neg = 0;
  if (supportType.every((s) => s === 'fixed')) {
    Cmid = 1 / 24;         // fixed-fixed midspan
    Cend_neg = -1 / 12;
  } else if (supportType.includes('fixed') && supportType.includes('simple')) {
    Cmid = 1 / 14;         // propped cantilever-like
    Cend_neg = -1 / 9;
  }
  const Mx_pos = Cmid * wu * L_short * L_short;
  const Mx_neg = Cend_neg * wu * L_short * L_short;
  const Vx = wu * L_short / 2;

  // Long direction: minimum reinforcement region — moments effectively zero, but compute a small token
  return {
    Mx_pos, Mx_neg, My_pos: 0, My_neg: 0,
    Vx, Vy: 0,
  };
}

function twoWayMoments(
  L_short: number,
  L_long: number,
  wu: number,
  DLu: number,
  LLu: number,
  caseNum: Method3Case,
  longSide: 'x' | 'y',
): MomentSet {
  const m_ratio = L_short / L_long;      // 0.5 ≤ m ≤ 1
  const c = lookupMethod3(caseNum, m_ratio);

  // Subscript "a" = short direction; subscript "b" = long direction.
  const Ma_pos = (c.Ca_DL * DLu + c.Ca_LL * LLu) * L_short * L_short;
  const Mb_pos = (c.Cb_DL * DLu + c.Cb_LL * LLu) * L_long  * L_long;
  const Ma_neg = -c.Ca_neg * wu * L_short * L_short;
  const Mb_neg = -c.Cb_neg * wu * L_long  * L_long;

  // Map "a" (short) and "b" (long) onto the slab's x / y coordinates
  const xIsShort = longSide === 'y';   // if longSide is y, x is short
  const Mx_pos = xIsShort ? Ma_pos : Mb_pos;
  const My_pos = xIsShort ? Mb_pos : Ma_pos;
  const Mx_neg = xIsShort ? Ma_neg : Mb_neg;
  const My_neg = xIsShort ? Mb_neg : Ma_neg;

  // Shears at supports — conservative tributary load distribution.
  // Short direction carries fraction r = lb⁴ / (la⁴ + lb⁴) of the load (Grashof partition).
  const r_short = Math.pow(L_long, 4) / (Math.pow(L_short, 4) + Math.pow(L_long, 4));
  const Vx = xIsShort ? wu * L_short * r_short / 2 : wu * L_long * (1 - r_short) / 2;
  const Vy = xIsShort ? wu * L_long  * (1 - r_short) / 2 : wu * L_short * r_short / 2;

  return { Mx_pos, My_pos, Mx_neg, My_neg, Vx, Vy };
}

// ================================================================
// Reinforcement design (flexure)
// ================================================================
function designReinforcement(
  M: MomentSet,
  g: Geometry,
  mat: Materials,
  code: Code,
): ReinforcementResult[] {
  const out: ReinforcementResult[] = [];
  const cases: { loc: ReinforcementResult['location']; Mu: number; cover: number }[] = [
    { loc: 'mid-x', Mu: M.Mx_pos, cover: g.cover_bottom_x! },
    { loc: 'mid-y', Mu: M.My_pos, cover: g.cover_bottom_y! },
    { loc: 'sup-x', Mu: -M.Mx_neg, cover: g.cover_top_x! },     // negate so Mu > 0 for design
    { loc: 'sup-y', Mu: -M.My_neg, cover: g.cover_top_y! },
  ];
  for (const item of cases) {
    out.push(designOneRebarLayer(item.loc, item.Mu, g.h, item.cover, mat, code));
  }
  return out;
}

function designOneRebarLayer(
  location: ReinforcementResult['location'],
  Mu_kNm: number,
  h_mm: number,
  cover_mm: number,
  mat: Materials,
  code: Code,
): ReinforcementResult {
  // Compute As required from rectangular stress block (per unit metre width)
  const fc = mat.fc;
  const fy = mat.fy;
  const phi = code === 'ACI 318-19' ? 0.9 : 1.0;       // EN uses material partial factors instead
  const gamma_s = code === 'EN 1992-1-1' ? 1.15 : 1.0; // EN steel partial factor
  const gamma_c = code === 'EN 1992-1-1' ? 1.5 : 1.0;  // EN concrete partial factor
  const fyd = fy / gamma_s;                             // design yield (EN) or = fy (ACI)
  const fcd = code === 'EN 1992-1-1' ? 0.85 * fc / gamma_c : 0.85 * fc;  // design conc. stress

  const d = Math.max(10, h_mm - cover_mm);              // mm
  const b = 1000;                                        // 1 m strip
  const Mu_Nmm = Math.abs(Mu_kNm) * 1e6;                 // N·mm/m

  // Solve quadratic for As: Mu = phi * As * fyd * (d - a/2), a = As*fyd / (fcd*b)
  // Substitute: Mu = phi * As * fyd * (d - As*fyd / (2*fcd*b))
  //   → 0 = (phi*fyd^2/(2*fcd*b)) * As^2 - phi*fyd*d * As + Mu
  const A = (phi * fyd * fyd) / (2 * fcd * b);
  const B = -phi * fyd * d;
  const C = Mu_Nmm;
  const disc = B * B - 4 * A * C;
  let As_req = 0;
  if (disc >= 0 && A > 0) {
    As_req = (-B - Math.sqrt(disc)) / (2 * A);          // smaller root = under-reinforced
  } else {
    // Section can't carry moment with current d — recommend thicker slab; fall back to simplified
    As_req = Mu_Nmm / (phi * fyd * 0.9 * d);
  }

  // Minimum reinforcement
  let As_min = 0;
  let refMin = '';
  if (code === 'ACI 318-19') {
    // ACI 318-19 §7.6.1.1: shrinkage and temperature reinf
    //   for fy ≤ 420: 0.0018 * Ag (per unit width)
    //   for fy > 420: 0.0018 * 420 / fy * Ag, but ≥ 0.0014 * Ag
    let rho_st = 0.0018 * 420 / Math.max(fy, 420);
    rho_st = Math.max(rho_st, 0.0014);
    As_min = rho_st * b * h_mm;
    refMin = 'ACI 318-19 §7.6.1.1 (S&T) and §9.6.1 (flexural)';
    // Also flexural minimum (ACI §9.6.1.2) for slabs is implicitly satisfied by S&T
  } else {
    // EN 1992-1-1 §9.3.1.1: As_min = 0.26 * (fctm/fyk) * b * d ≥ 0.0013 * b * d
    const fctm = 0.30 * Math.pow(fc, 2 / 3);
    const ratio = Math.max(0.26 * fctm / fy, 0.0013);
    As_min = ratio * b * d;
    refMin = 'EN 1992-1-1 §9.3.1.1';
  }

  const As_design = Math.max(As_req, As_min);

  // Bar selection — choose smallest bar that gives spacing ≤ s_max
  const s_max = code === 'ACI 318-19'
    ? Math.min(3 * h_mm, 450)               // ACI 318-19 §7.7.2.3 for slabs: 3h or 18 in (450 mm)
    : Math.min(3 * h_mm, 400);              // EN 1992-1-1 §9.3.1.1(3)
  const candidates = code === 'ACI 318-19'
    ? BAR_CATALOG.filter((bar) => bar.system === 'imperial' && bar.db >= 9.5)
    : BAR_CATALOG.filter((bar) => bar.system === 'metric'   && bar.db >= 8);
  let chosen = candidates[0];
  let spacing = (chosen.Ab * b) / Math.max(1, As_design);
  for (const bar of candidates) {
    const s = (bar.Ab * b) / Math.max(1, As_design);
    if (s <= s_max && s >= 50) { chosen = bar; spacing = s; break; }
  }

  const ref = code === 'ACI 318-19'
    ? `ACI 318-19 §22.2.2 (φ=0.9), ${refMin}`
    : `EN 1992-1-1 §6.1 (γs=1.15, γc=1.5), ${refMin}`;

  return {
    location, Mu: Math.abs(Mu_kNm), d,
    As_req, As_min, As_design,
    bar: chosen.label, spacing, spacing_max: s_max, ref,
  };
}

// ================================================================
// Deflection
// ================================================================
function checkDeflection(
  g: Geometry,
  mat: Materials,
  edges: PanelEdges,
  classification: 'one-way' | 'two-way',
  beta: number,
  wService: number,
  code: Code,
): DeflectionResult {
  const Lshort = Math.min(g.Lx, g.Ly);
  const L = Lshort * 1000;        // mm
  const limit = L / 240;          // ACI default L/240 immediate, more stringent if interfering elements

  // h_min check
  let h_min = 0;
  if (code === 'ACI 318-19') {
    // ACI 318-19 Table 7.3.1.1 (one-way) and Table 8.3.1.1 (two-way without interior beams).
    if (classification === 'one-way') {
      // Both edges discontinuous (SS): L/20.  Both continuous: L/28.  Cantilever: L/10.
      const fixedCount = [edges.left, edges.right, edges.top, edges.bottom].filter((e) => e === 'fixed').length;
      const factor = fixedCount >= 2 ? 28 : 20;
      h_min = L / factor;
    } else {
      // Two-way without interior beams (flat plate): from Table 8.3.1.1
      // Simplified — exterior: L/30, interior: L/33 with edge beams; use L/30 conservative
      const fixedCount = [edges.left, edges.right, edges.top, edges.bottom].filter((e) => e === 'fixed').length;
      const factor = fixedCount === 4 ? 36 : fixedCount >= 2 ? 33 : 30;
      h_min = L / factor;
    }
  } else {
    // EN 1992-1-1 §7.4.2 — span/depth
    // Assume basic ratios for lightly stressed reinforced concrete (ρ ≈ 0.5%):
    //   simply supported: 20    end span continuous: 26    interior continuous: 30
    const fixedCount = [edges.left, edges.right, edges.top, edges.bottom].filter((e) => e === 'fixed').length;
    const factor = fixedCount === 4 ? 30 : fixedCount >= 2 ? 26 : 20;
    h_min = L / factor;
  }

  // Branson immediate deflection (Mid-x location, simplified beam)
  const fc = mat.fc;
  const fr = mat.fr ?? 0.62 * Math.sqrt(fc);
  const Ec = code === 'ACI 318-19'
    ? 4700 * Math.sqrt(fc)              // ACI §19.2.2 (MPa)
    : 22000 * Math.pow(Math.max(fc, 12) / 10 + 0.8, 0.3);   // EN §3.1.3 — simplified Ecm
  const b = 1000;                                            // 1-m strip
  const h = g.h;                                             // mm
  const Ig = (b * Math.pow(h, 3)) / 12;                       // mm⁴/m  (gross section)
  // Use a conservative cracked stiffness if Mservice > Mcr; assume ½ Ig as fallback.
  // For midspan service moment estimate (one-way SS-like simplification):
  const Mservice = (wService * Lshort * Lshort / 8) * 1e6;   // N·mm/m for SS span
  const Mcr = (fr * Ig) / (h / 2);                            // N·mm/m
  let Ie = Ig;
  if (Mservice > Mcr) {
    const ratio = Math.pow(Mcr / Mservice, 3);
    const Icr = 0.4 * Ig;                                     // approx for slabs
    Ie = ratio * Ig + (1 - ratio) * Icr;
  }
  // Simply supported uniform load deflection: 5wL⁴/(384·E·I)
  const w_per_m = wService * 1.0;                             // kN/m on 1-m strip = wService kN/m²·m
  const w_Nm = w_per_m * 1000;                                // N/m
  const L_m = Lshort;                                          // m
  const delta_imm_m = (5 * w_Nm * Math.pow(L_m, 4)) / (384 * Ec * 1e6 * Ie * 1e-12);
  const delta_immediate = delta_imm_m * 1000;                 // mm

  // Long-term: ACI 318-19 §24.2.4.1.1 multiplier λ = ξ/(1+50ρ'), with ξ=2.0 (5+ years).
  // Conservative: ρ' ≈ 0 → λ = 2.0; total long-term = (1 + λ) × immediate
  const lambda = 2.0;
  const delta_longterm = delta_immediate * (1 + lambda);

  return {
    h_min,
    h_min_ok: g.h >= h_min - 1e-6,
    spanDepthLimit: code === 'EN 1992-1-1' ? L / h_min : undefined,
    spanDepth: code === 'EN 1992-1-1' ? L / Math.max(1, g.h) : undefined,
    spanDepthOk: code === 'EN 1992-1-1' ? L / Math.max(1, g.h) <= L / h_min : undefined,
    Ie,
    delta_immediate,
    longTermFactor: lambda,
    delta_longterm,
    delta_limit: limit,
    delta_ok: delta_longterm <= limit,
  };
}

// ================================================================
// Punching shear (ACI 318-19 §22.6 / EN 1992-1-1 §6.4)
// ================================================================
function checkPunching(
  p: NonNullable<SlabInput['punching']>,
  g: Geometry,
  mat: Materials,
  code: Code,
): PunchingResult {
  const c1 = p.c1;
  const c2 = p.c2 ?? c1;
  const d = p.d ?? Math.max(50, g.h - Math.max(g.cover_bottom_x ?? 25, g.cover_bottom_y ?? 35));
  const Vu = Math.abs(p.Vu) * 1000;                          // N

  let bo = 0;       // mm
  if (code === 'ACI 318-19') {
    // ACI critical perimeter at d/2 from column face
    if (p.position === 'interior') bo = 2 * (c1 + d) + 2 * (c2 + d);
    if (p.position === 'edge')     bo = 2 * (c1 + d / 2) + (c2 + d);
    if (p.position === 'corner')   bo = (c1 + d / 2) + (c2 + d / 2);
  } else {
    // EN 1992 critical perimeter at 2d from column face (basic)
    if (p.position === 'interior') bo = 2 * (c1 + 4 * d) + 2 * (c2 + 4 * d);  // approx, EN §6.4.2
    if (p.position === 'edge')     bo = 2 * (c1 + 2 * d) + (c2 + 4 * d);
    if (p.position === 'corner')   bo = (c1 + 2 * d) + (c2 + 2 * d);
  }

  let vc = 0;       // MPa
  let phi = 0.75;
  let ref = '';
  if (code === 'ACI 318-19') {
    // ACI §22.6.5.2: vc = least of 4λs√fc, (2+4/β)·λs·√fc, (αs·d/bo + 2)·λs·√fc; in psi → for MPa use 0.33
    const beta_col = Math.max(c1, c2) / Math.min(c1, c2);
    const alpha_s = p.position === 'interior' ? 40 : p.position === 'edge' ? 30 : 20;
    const lambda_s = 1.0;       // size factor (slab-on-grade etc.) ≈ 1 for d ≤ 250 mm
    const fc_root = Math.sqrt(mat.fc);
    const v1 = 0.33 * lambda_s * fc_root;
    const v2 = (0.17 + 0.33 / beta_col) * lambda_s * fc_root;
    const v3 = (alpha_s * d / bo / 12 + 0.17) * lambda_s * fc_root;
    vc = Math.min(v1, v2, v3);
    phi = 0.75;       // §21.2.1
    ref = 'ACI 318-19 §22.6.5.2';
  } else {
    // EN 1992-1-1 §6.4.4 — vRdc = CRdc · k · (100 ρl · fck)^(1/3) ≥ vmin
    const k = Math.min(2.0, 1 + Math.sqrt(200 / d));
    const rho_l = 0.005;        // assume 0.5% for unreinforced punching check (typical for slabs)
    const CRdc = 0.18 / 1.5;
    const vmin = 0.035 * Math.pow(k, 1.5) * Math.sqrt(mat.fc);
    vc = Math.max(CRdc * k * Math.pow(100 * rho_l * mat.fc, 1 / 3), vmin);
    phi = 1.0;                  // EN already includes partial factors
    ref = 'EN 1992-1-1 §6.4.4';
  }

  // Demand stress
  const beta_factor = (p.Mu && p.Mu !== 0) ? 1.15 : 1.0;        // simplified eccentricity amplifier
  const vu = (Vu * beta_factor) / (bo * d);                      // N/mm² = MPa
  const ratio = vu / Math.max(1e-6, phi * vc);

  return {
    bo, d, vc, vu, ratio,
    ok: ratio <= 1.0,
    ref,
    needsReinf: ratio > 1.0,
  };
}

// ================================================================
// Crack control
// ================================================================
function checkCrackControl(
  rebar: ReinforcementResult,
  mat: Materials,
  code: Code,
  geom: Geometry,
): CrackControlResult {
  // Approximate steel service stress fs ≈ (2/3)·fy for typical loading
  const fs = (2 / 3) * mat.fy;
  let s_max = 0;
  let ref = '';
  if (code === 'ACI 318-19') {
    // ACI 318-19 §24.3.2: s_max = least of 380·(280/fs) − 2.5·cc and 300·(280/fs).
    // cc = clear cover from concrete surface to outermost bar surface (mm).
    // Slabs typically have small cc (~20 mm); approximate from cover-to-centroid minus
    // half a typical bar diameter (~6 mm), with 15 mm floor.
    const cover = rebar.location === 'mid-x' || rebar.location === 'sup-x'
      ? (geom.cover_bottom_x ?? 25)
      : (geom.cover_bottom_y ?? 35);
    const cc = Math.max(15, cover - 6);
    const ratio = 280 / fs;
    s_max = Math.min(380 * ratio - 2.5 * cc, 300 * ratio);
    ref = 'ACI 318-19 §24.3.2';
  } else {
    // EN 1992-1-1 §7.3.3 Table 7.3N — s_max for fs = 280 MPa is ≈ 200 mm; use linear interp
    if (fs <= 240) s_max = 250;
    else if (fs <= 320) s_max = 200 - (fs - 280) / 40 * 50;
    else s_max = 100;
    ref = 'EN 1992-1-1 §7.3.3 Table 7.3N';
  }
  return {
    fs,
    s_max,
    s: rebar.spacing,
    ok: rebar.spacing <= s_max,
    ref,
  };
}

function pickWorstMidspan(reinf: ReinforcementResult[]): ReinforcementResult | undefined {
  const mid = reinf.filter((r) => r.location === 'mid-x' || r.location === 'mid-y');
  if (!mid.length) return undefined;
  return mid.reduce((a, b) => (a.As_design >= b.As_design ? a : b));
}

function emptyResult(
  code: Code,
  g: Geometry, m: Materials, l: Loads, e: PanelEdges,
  warnings: string[],
): SlabAnalysis {
  return {
    geometry: g, materials: m, loads: l, edges: e, code,
    beta: 1, classification: 'two-way',
    wu: 0, wSelf: 0, wService: 0,
    moments: { Mx_pos: 0, My_pos: 0, Mx_neg: 0, My_neg: 0, Vx: 0, Vy: 0 },
    reinforcement: [],
    deflection: { h_min: 0, h_min_ok: false, delta_limit: 0 },
    warnings,
    solved: false,
  };
}
