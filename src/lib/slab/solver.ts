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
  const deflection = checkDeflection(g, m, e, classification, beta, wService, code, input);

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
  if (isACI(code) || code === 'ACI 318-25')
    return kind === 'DL' ? 1.2 : 1.6;                                 // ACI §5.3.1 basic combo
  /* EN 1992-1-1, Eurocode partial safety factors */
  return kind === 'DL' ? 1.35 : 1.5;                                  // EN 1990 Table A1.2(B)
}

function isACI(c: Code): boolean { return c === 'ACI 318-19' || c === 'ACI 318-25'; }
function aciLabel(c: Code): string { return c === 'ACI 318-25' ? 'ACI 318-25' : 'ACI 318-19'; }
function aciClause(c: Code, n: string): string { return `${aciLabel(c)} §${n}`; }

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
  const phi = isACI(code) ? 0.9 : 1.0;       // EN uses material partial factors instead
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
  if (isACI(code)) {
    // ACI 318-19 §7.6.1.1: shrinkage and temperature reinf
    //   for fy ≤ 420: 0.0018 * Ag (per unit width)
    //   for fy > 420: 0.0018 * 420 / fy * Ag, but ≥ 0.0014 * Ag
    let rho_st = 0.0018 * 420 / Math.max(fy, 420);
    rho_st = Math.max(rho_st, 0.0014);
    As_min = rho_st * b * h_mm;
    refMin = `${aciClause(code, '7.6.1.1')} (S&T) and ${aciClause(code, '9.6.1')} (flexural)`;
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
  const s_max = isACI(code)
    ? Math.min(3 * h_mm, 450)               // ACI 318-19 §7.7.2.3 for slabs: 3h or 18 in (450 mm)
    : Math.min(3 * h_mm, 400);              // EN 1992-1-1 §9.3.1.1(3)
  const candidates = isACI(code)
    ? BAR_CATALOG.filter((bar) => bar.system === 'imperial' && bar.db >= 9.5)
    : BAR_CATALOG.filter((bar) => bar.system === 'metric'   && bar.db >= 8);
  let chosen = candidates[0];
  let spacing = (chosen.Ab * b) / Math.max(1, As_design);
  for (const bar of candidates) {
    const s = (bar.Ab * b) / Math.max(1, As_design);
    if (s <= s_max && s >= 50) { chosen = bar; spacing = s; break; }
  }

  const ref = isACI(code)
    ? `ACI 318-19 §22.2.2 (φ=0.9), ${refMin}`
    : `EN 1992-1-1 §6.1 (γs=1.15, γc=1.5), ${refMin}`;

  // Build hand-calc breakdown
  const steps = [
    {
      title: 'Effective depth d',
      formula: 'd = h − cover',
      substitution: `d = ${h_mm} − ${cover_mm} = ${d.toFixed(0)} mm`,
      result: `d = ${d.toFixed(0)} mm`,
    },
    {
      title: 'Required steel area Aₛ',
      formula: isACI(code)
        ? 'Mu = φ·As·fy·(d − a/2),  a = As·fy / (0.85·fc·b)  →  solve for As'
        : 'Mu = As·fyd·(d − a/2),  a = As·fyd / (fcd·b),  fcd = 0.85·fc/γc',
      substitution: isACI(code)
        ? `φ=0.9, fy=${fy}, fc=${fc}, b=1000, d=${d.toFixed(0)} mm`
        : `fyd=${fyd.toFixed(0)} MPa, fcd=${fcd.toFixed(2)} MPa, γs=1.15, γc=1.5`,
      result: `As_req = ${As_req.toFixed(0)} mm²/m`,
      ref: isACI(code) ? aciClause(code, '22.2.2') : 'EN 1992-1-1 §6.1',
    },
    {
      title: 'Minimum steel',
      formula: isACI(code)
        ? 'As_min = ρ_min · b · h,  ρ_min = max(0.0018·420/fy, 0.0014)'
        : 'As_min = max(0.26·fctm/fyk, 0.0013) · b · d,  fctm = 0.30·fc^(2/3)',
      substitution: isACI(code)
        ? `ρ_min = max(0.0018·420/${fy}, 0.0014) = ${(Math.max(0.0018 * 420 / Math.max(fy, 420), 0.0014)).toFixed(5)}`
        : `fctm = 0.30·${fc}^(2/3) = ${(0.30 * Math.pow(fc, 2 / 3)).toFixed(2)} MPa,  ratio = ${(Math.max(0.26 * 0.30 * Math.pow(fc, 2 / 3) / fy, 0.0013)).toFixed(5)}`,
      result: `As_min = ${As_min.toFixed(0)} mm²/m`,
      ref: refMin,
    },
    {
      title: 'Design As',
      formula: 'As_design = max(As_req, As_min)',
      substitution: `max(${As_req.toFixed(0)}, ${As_min.toFixed(0)})`,
      result: `As_design = ${As_design.toFixed(0)} mm²/m`,
    },
    {
      title: 'Bar selection',
      formula: 's = Ab · b / As_design  ≤  s_max',
      substitution: `${chosen.label} (Ab = ${chosen.Ab} mm²),  s = ${chosen.Ab}·1000 / ${As_design.toFixed(0)} = ${spacing.toFixed(0)} mm  ≤  ${s_max.toFixed(0)} mm`,
      result: `${chosen.label} @ ${spacing.toFixed(0)} mm c/c`,
      ref: isACI(code) ? aciClause(code, '7.7.2.3') : 'EN 1992-1-1 §9.3.1.1(3)',
    },
  ];

  return {
    location, Mu: Math.abs(Mu_kNm), d,
    As_req, As_min, As_design,
    bar: chosen.label, spacing, spacing_max: s_max, ref,
    steps,
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
  input: SlabInput,
): DeflectionResult {
  const Lshort = Math.min(g.Lx, g.Ly);
  const L = Lshort * 1000;        // mm
  const limit = L / 240;          // ACI default L/240 immediate, more stringent if interfering elements

  // h_min check
  let h_min = 0;
  if (isACI(code)) {
    // ACI 318-19 / 318-25: identical tables.
    // One-way: Table 7.3.1.1 — SS L/20, one end cont L/24, both cont L/28, cantilever L/10
    //          Modifier §7.3.1.1.1 for fy ≠ 420 MPa: × (0.4 + fy/700)
    // Two-way: Table 8.3.1.1 (flat plate without interior beams). For fy=420:
    //          • Exterior, no edge beam: ℓn/30
    //          • Exterior, with edge beam OR Interior: ℓn/33
    //          • Drop panels reduce these to ℓn/33 and ℓn/36 respectively
    //          fy interpolation: 280 → ÷33/36/36, 420 → ÷30/33/33, 550 → ÷27/30/30
    const fixedCount = [edges.left, edges.right, edges.top, edges.bottom].filter((e) => e === 'fixed').length;
    const fy = mat.fy;
    const fyMod = (0.4 + fy / 700);     // §7.3.1.1.1 modifier (=1.0 at fy=420)

    if (classification === 'one-way') {
      const factor = fixedCount >= 2 ? 28 : (fixedCount === 1 ? 24 : 20);
      h_min = (L / factor) * fyMod;
    } else {
      // Determine effective denominator from Table 8.3.1.1 by fy + edge condition + drop
      // We treat 4 fixed edges as INTERIOR PANEL (no exterior edge); ≥2 fixed → with edge
      // beams; otherwise without edge beams (most conservative, smallest denominator).
      const isInterior   = fixedCount === 4;
      const hasEdgeBeam  = fixedCount >= 2 && !isInterior;
      const hasDropPanel = !!input.punching?.dropPanelSize && (input.punching.dropPanelThickness ?? 0) > 0;
      // Linear-interpolate the denominator between fy values 280, 420, 550
      const interp = (lo: number, mid: number, hi: number): number => {
        if (fy <= 280) return lo;
        if (fy >= 550) return hi;
        if (fy < 420) return lo + (mid - lo) * (fy - 280) / (420 - 280);
        return mid + (hi - mid) * (fy - 420) / (550 - 420);
      };
      let denom: number;
      if (hasDropPanel) {
        // With drop panels row: interior 40/36/33; with edge beam 40/36/33; without 36/33/30
        denom = isInterior   ? interp(40, 36, 33)
              : hasEdgeBeam  ? interp(40, 36, 33)
              :                interp(36, 33, 30);
      } else {
        // Without drop panels row: interior 36/33/30; with edge beam 36/33/30; without 33/30/27
        denom = isInterior   ? interp(36, 33, 30)
              : hasEdgeBeam  ? interp(36, 33, 30)
              :                interp(33, 30, 27);
      }
      h_min = L / denom;
      // Slabs without drop panels also have absolute minimum 125 mm (8.3.1.1(a)),
      // with drop panels 100 mm (8.3.1.1(b))
      h_min = Math.max(h_min, hasDropPanel ? 100 : 125);
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
  const Ec = isACI(code)
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

  const steps: import('./types').CalcStep[] = [
    { title: 'Min thickness h_min',
      formula: isACI(code)
        ? 'h_min = L / factor  (Table 7.3.1.1 / 8.3.1.1)'
        : 'h_min = L / (basic L/d ratio)  (§7.4.2)',
      substitution: `L = ${L.toFixed(0)} mm,  factor = ${(L / h_min).toFixed(0)}`,
      result: `h_min = ${h_min.toFixed(0)} mm  (provided ${g.h} → ${g.h >= h_min ? 'OK' : 'FAIL'})`,
      ref: isACI(code) ? `${aciLabel(code)} Table 7.3.1.1 / 8.3.1.1` : 'EN 1992-1-1 §7.4.2',
    },
    { title: 'Modulus of rupture / Mcr',
      formula: 'fr = 0.62·√fc;  Mcr = fr · Ig / (h/2)',
      substitution: `fr = 0.62·√${fc} = ${fr.toFixed(2)} MPa,  Ig = b·h³/12 = ${Ig.toExponential(3)} mm⁴`,
      result: `Mcr = ${(Mcr / 1e6).toFixed(2)} kN·m/m`,
    },
    { title: 'Effective Ie (Branson)',
      formula: 'Ie = (Mcr/Ms)³·Ig + [1 − (Mcr/Ms)³]·Icr   if Ms > Mcr',
      substitution: `Ms = ${(Mservice / 1e6).toFixed(2)} kN·m/m  ${Mservice > Mcr ? '> Mcr → cracked' : '< Mcr → use Ig'}`,
      result: `Ie = ${Ie.toExponential(3)} mm⁴/m`,
      ref: aciClause(code, '24.2.3') + ' (Branson)',
    },
    { title: 'Immediate deflection Δi',
      formula: 'Δi = 5·w·L⁴ / (384·E·Ie)  [SS UDL]',
      substitution: `w = ${w_per_m.toFixed(2)} kN/m,  E = ${(Ec).toFixed(0)} MPa,  L = ${L_m.toFixed(2)} m`,
      result: `Δi = ${delta_immediate.toFixed(2)} mm`,
    },
    { title: 'Long-term deflection',
      formula: 'Δlt = (1 + λ)·Δi,  λ = ξ/(1+50ρ′),  ξ = 2 (5+ years)',
      substitution: `λ = 2.0 (assume ρ′ = 0)`,
      result: `Δlt = ${delta_longterm.toFixed(2)} mm  ≤  L/240 = ${limit.toFixed(1)} mm  ${delta_longterm <= limit ? 'OK' : 'FAIL'}`,
      ref: aciClause(code, '24.2.4'),
    },
  ];

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
    steps,
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

  // Effective depth — augmented if drop panel present
  let d = p.d ?? Math.max(50, g.h - Math.max(g.cover_bottom_x ?? 25, g.cover_bottom_y ?? 35));
  let dropPanel: import('./types').DropPanel | undefined;
  if (p.dropPanelSize && p.dropPanelThickness && p.dropPanelSize > 0 && p.dropPanelThickness > 0) {
    const d_eff = d + p.dropPanelThickness;
    dropPanel = { size: p.dropPanelSize, thickness: p.dropPanelThickness, d_eff };
    d = d_eff;
  }

  const Vu = Math.abs(p.Vu) * 1000;                          // N

  let bo = 0;       // mm
  if (isACI(code)) {
    if (p.position === 'interior') bo = 2 * (c1 + d) + 2 * (c2 + d);
    if (p.position === 'edge')     bo = 2 * (c1 + d / 2) + (c2 + d);
    if (p.position === 'corner')   bo = (c1 + d / 2) + (c2 + d / 2);
  } else {
    if (p.position === 'interior') bo = 2 * (c1 + 4 * d) + 2 * (c2 + 4 * d);
    if (p.position === 'edge')     bo = 2 * (c1 + 2 * d) + (c2 + 4 * d);
    if (p.position === 'corner')   bo = (c1 + 2 * d) + (c2 + 2 * d);
  }

  let vc = 0;
  let phi = 0.75;
  let ref = '';
  let stepsExtra: import('./types').CalcStep[] = [];

  if (isACI(code)) {
    const beta_col = Math.max(c1, c2) / Math.min(c1, c2);
    const alpha_s = p.position === 'interior' ? 40 : p.position === 'edge' ? 30 : 20;
    // §22.6.5.2 size factor: λ_s = √(2 / (1 + 0.004·d)) ≤ 1.0  (d in mm).
    // Reduces vc for thick slabs (d > 250 mm). Same in 318-19 and 318-25.
    const lambda_s = Math.min(1.0, Math.sqrt(2 / (1 + 0.004 * d)));
    // §22.6.3.1: √f'c used in vc calculation shall not exceed 8.3 MPa
    // (i.e. f'c effectively capped at ~70 MPa for shear strength).
    const fc_root = Math.min(8.3, Math.sqrt(mat.fc));
    const v1 = 0.33 * lambda_s * fc_root;
    const v2 = (0.17 + 0.33 / beta_col) * lambda_s * fc_root;
    const v3 = (alpha_s * d / bo / 12 + 0.17) * lambda_s * fc_root;
    vc = Math.min(v1, v2, v3);
    phi = 0.75;
    ref = aciClause(code, '22.6.5.2');
    stepsExtra = [
      { title: 'Critical perimeter b₀',
        formula: 'b₀ = 2(c1 + d) + 2(c2 + d)  [interior]',
        substitution: `b₀ = 2(${c1}+${d.toFixed(0)}) + 2(${c2}+${d.toFixed(0)}) = ${bo.toFixed(0)} mm`,
        result: `b₀ = ${bo.toFixed(0)} mm`,
        ref: 'ACI §22.6.4.1' },
      { title: 'Concrete shear capacity v_c',
        formula: 'v_c = min(0.33·λs·√fc, (0.17 + 0.33/β)·λs·√fc, (αs·d/b₀/12 + 0.17)·λs·√fc)',
        substitution: `min(${v1.toFixed(3)}, ${v2.toFixed(3)}, ${v3.toFixed(3)}) MPa  (β=${beta_col.toFixed(2)}, αs=${alpha_s})`,
        result: `v_c = ${vc.toFixed(3)} MPa`,
        ref: aciClause(code, '22.6.5.2') },
    ];
  } else {
    const k = Math.min(2.0, 1 + Math.sqrt(200 / d));
    const rho_l = 0.005;
    const CRdc = 0.18 / 1.5;
    const vmin = 0.035 * Math.pow(k, 1.5) * Math.sqrt(mat.fc);
    vc = Math.max(CRdc * k * Math.pow(100 * rho_l * mat.fc, 1 / 3), vmin);
    phi = 1.0;
    ref = 'EN 1992-1-1 §6.4.4';
    stepsExtra = [
      { title: 'Control perimeter u₁',
        formula: 'u₁ = 2(c1 + 4d) + 2(c2 + 4d)  [interior, basic perimeter at 2d]',
        substitution: `u₁ = 2(${c1}+${(4 * d).toFixed(0)}) + 2(${c2}+${(4 * d).toFixed(0)}) = ${bo.toFixed(0)} mm`,
        result: `u₁ = ${bo.toFixed(0)} mm`,
        ref: 'EN 1992-1-1 §6.4.2' },
      { title: 'Punching capacity v_Rd,c',
        formula: 'v_Rd,c = max(C_Rd,c · k · (100·ρl·fck)^(1/3), v_min)',
        substitution: `k = 1+√(200/${d.toFixed(0)}) = ${k.toFixed(3)},  ρl = ${(rho_l * 100).toFixed(2)}%`,
        result: `v_Rd,c = ${vc.toFixed(3)} MPa`,
        ref: 'EN 1992-1-1 §6.4.4(1)' },
    ];
  }

  const beta_factor = (p.Mu && p.Mu !== 0) ? 1.15 : 1.0;
  const vu = (Vu * beta_factor) / (bo * d);
  const ratio = vu / Math.max(1e-6, phi * vc);
  const needsReinf = ratio > 1.0;

  // Stud-rail design when ratio > 1 (ACI 421.1R-20)
  let studRail: import('./types').StudRailDesign | undefined;
  if (needsReinf && isACI(code)) {
    // φ vn = φ (vc/2 + Av·fy/(bo·s)) ≥ vu  → Av/s = (vu/φ − vc/2) · bo / fy
    const studFy = p.studFy ?? 420;
    const phi_v = 0.75;
    const reqAvOverS = Math.max(0, (vu / phi_v - vc / 2) * bo / studFy);   // mm²/mm
    // Choose stud diameter and spacing — typical 9.5 mm (#3) studs, 4 rails (square col → 4 sides)
    const studDb = 9.5; const Ab_stud = 71;       // ASTM A1044 #3 stud
    const numRails = p.position === 'interior' ? 8 : p.position === 'edge' ? 6 : 4;
    // Each perimeter has numRails studs; required area per perimeter:
    // s such that (numRails · Ab_stud) / s ≥ reqAvOverS  →  s ≤ numRails·Ab_stud / reqAvOverS
    let s = reqAvOverS > 0 ? Math.min(d / 2, (numRails * Ab_stud) / reqAvOverS) : d / 2;
    s = Math.max(50, Math.floor(s / 10) * 10);    // round down to 10-mm increments
    // Number of rows — extend until punching is OK at outermost perimeter (~ 2d from col face)
    const extendToFromColFace = 2 * d;             // mm (typ ACI §8.7.7)
    const rows = Math.max(2, Math.ceil(extendToFromColFace / s));
    const Avfy_provided = (numRails * Ab_stud * studFy / 1000) / s * d;   // approx kN per perimeter
    const Avfy_required = (vu / phi_v - vc / 2) * bo * d / 1000;
    studRail = {
      studDiameter: studDb, numRails, spacing: s, rows,
      Avfy_required, Avfy_provided,
      ref: `${aciClause(code, '22.6.7')} + ACI 421.1R-20`,
    };
  }

  const steps: import('./types').CalcStep[] = [
    ...stepsExtra,
    { title: 'Demand stress v_u',
      formula: 'v_u = β · V_u / (b₀ · d)',
      substitution: `v_u = ${beta_factor.toFixed(2)} · ${(Vu / 1000).toFixed(0)}·1000 / (${bo.toFixed(0)} · ${d.toFixed(0)}) = ${vu.toFixed(3)} MPa`,
      result: `v_u = ${vu.toFixed(3)} MPa`,
    },
    { title: 'Demand / capacity ratio',
      formula: 'r = v_u / (φ · v_c)',
      substitution: `r = ${vu.toFixed(3)} / (${phi.toFixed(2)} · ${vc.toFixed(3)}) = ${ratio.toFixed(3)}`,
      result: ratio <= 1 ? `OK (r = ${ratio.toFixed(2)})` : `FAIL (r = ${ratio.toFixed(2)}) — add stud rails / drop panel / increase d`,
    },
  ];

  return {
    bo, d, vc, vu, ratio,
    ok: ratio <= 1.0,
    ref,
    needsReinf,
    steps,
    studRail,
    dropPanel,
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
  if (isACI(code)) {
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
    ref = aciClause(code, '24.3.2');
  } else {
    // EN 1992-1-1 §7.3.3 Table 7.3N — s_max for fs = 280 MPa is ≈ 200 mm; use linear interp
    if (fs <= 240) s_max = 250;
    else if (fs <= 320) s_max = 200 - (fs - 280) / 40 * 50;
    else s_max = 100;
    ref = 'EN 1992-1-1 §7.3.3 Table 7.3N';
  }

  // EN 1992-1-1 §7.3.4 — direct crack-width calculation wk
  let wk: number | undefined;
  let wk_limit: number | undefined;
  let wk_ok: boolean | undefined;
  if (code === 'EN 1992-1-1') {
    const fc = mat.fc;
    const fy = mat.fy;
    const fctm = 0.30 * Math.pow(fc, 2 / 3);
    const Ec = 22000 * Math.pow(Math.max(fc, 12) / 10 + 0.8, 0.3);
    const Es = mat.Es ?? 200_000;
    const alpha_e = Es / Ec;
    const rho_eff = Math.max(0.002, rebar.As_design / (1000 * Math.min(rebar.d * 2.5, 1000)));
    const phi_bar = 16;     // assume ϕ16 typical bar diameter for slab
    const cover = 25;       // conservative
    const k1 = 0.8;          // ribbed bars
    const k2 = 0.5;          // bending
    const k3 = 3.4;
    const k4 = 0.425;
    const sr_max = k3 * cover + k1 * k2 * k4 * phi_bar / rho_eff;     // mm
    const eps_sm_minus_eps_cm = Math.max(
      (fs - 0.4 * fctm * (1 + alpha_e * rho_eff) / rho_eff) / Es,
      0.6 * fs / Es,
    );
    wk = sr_max * eps_sm_minus_eps_cm;     // mm
    wk_limit = 0.3;        // typical for XC2/XC3 reinforced concrete (EN Table 7.1N)
    wk_ok = wk <= wk_limit;
  }

  const steps: import('./types').CalcStep[] = isACI(code)
    ? [
      { title: 'Service stress f_s',
        formula: 'f_s ≈ (2/3)·f_y',
        substitution: `f_s ≈ (2/3)·${mat.fy} = ${fs.toFixed(0)} MPa`,
        result: `f_s = ${fs.toFixed(0)} MPa` },
      { title: 'Max bar spacing',
        formula: 's_max = min(380·(280/fs) − 2.5·cc,  300·(280/fs))',
        substitution: `cc ≈ ${(geom.cover_bottom_x ?? 25) - 6} mm,  s_max = min(...) = ${s_max.toFixed(0)} mm`,
        result: `s_max = ${s_max.toFixed(0)} mm  ${rebar.spacing <= s_max ? 'OK' : 'FAIL'}`,
        ref: aciClause(code, '24.3.2') },
    ]
    : [
      { title: 'Service stress f_s',
        formula: 'f_s ≈ (2/3)·f_y',
        substitution: `f_s = ${fs.toFixed(0)} MPa`,
        result: `f_s = ${fs.toFixed(0)} MPa` },
      { title: 'Max bar spacing (Table 7.3N)',
        formula: 'Linear interpolation in Table 7.3N',
        substitution: `f_s = ${fs.toFixed(0)} MPa`,
        result: `s_max ≈ ${s_max.toFixed(0)} mm`,
        ref: 'EN 1992-1-1 §7.3.3 Table 7.3N' },
      { title: 'Crack width wk',
        formula: 'wk = sr_max · (εsm − εcm)',
        substitution: `αe = Es/Ecm,  ρ_eff = As/(b·h_eff)`,
        result: wk !== undefined ? `wk = ${wk.toFixed(3)} mm  ≤  ${wk_limit?.toFixed(2)} mm  ${wk_ok ? 'OK' : 'FAIL'}` : '—',
        ref: 'EN 1992-1-1 §7.3.4' },
    ];

  return {
    fs,
    s_max,
    s: rebar.spacing,
    ok: rebar.spacing <= s_max && (wk_ok !== false),
    ref,
    wk, wk_limit, wk_ok,
    steps,
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
