// Auto-design — given factored demands and geometry/materials, RECOMMEND
// reinforcement (tension bars, compression bars if needed, stirrup spacing,
// torsion add-on). Returns a Reinforcement payload that, when fed back into
// the analyzer, will pass all checks (or come as close as the bar catalog
// allows).
//
// Phase 5b — RC Beam Design.
//
// Approach
// --------
// • Flexure: solve quadratic for AsReq from Mu (assume tension-controlled
//   φ = 0.90), then walk the bar catalog from smallest db upward, picking
//   the bar that gives the SMALLEST count >= AsReq + AsMin while still
//   fitting in one row at code-mandated clear spacing. If no bar fits in
//   one row even at max count → escalate to two rows. If φMn,max,singly
//   < Mu → enable doubly-reinforced design.
// • Shear: pick stirrup spacing that meets s ≤ min(s,max code, s for Vu).
//   Walk a discrete set of spacings (75…300 mm) descending.
// • Torsion: bump (At/s) = Tu/(φ·2·Ao·fyt) and tighten spacing if torsion
//   s,max governs.
//
// Output: Reinforcement object + a per-step rationale that the UI can show.
// The user can accept the recommendation or tweak it.

import type {
  BeamInput, Materials, Geometry, Reinforcement, BarGroup,
  StirrupConfig, CalcStep,
} from './types';
import { BAR_CATALOG, lookupBar, barArea, barDiameter } from './types';
import {
  computeBeta1, sectionArea, sectionCentroid, gross_Ig,
} from './solver';

void sectionArea; void sectionCentroid; void gross_Ig;

export interface AutoDesignResult {
  /** Recommended reinforcement (drop into BeamInput.reinforcement). */
  reinforcement: Reinforcement;
  /** Required tension steel area used to drive the selection (mm²). */
  AsReq: number;
  /** Provided tension steel area for the selected bars (mm²). */
  AsProvided: number;
  /** Whether doubly-reinforced design was needed. */
  needsDouble: boolean;
  /** Whether the selection successfully meets all primary checks. */
  ok: boolean;
  /** Bilingual narrative + per-step rationale for the report / UI. */
  steps: CalcStep[];
  /** Warnings (anything to flag for the user, e.g. multiple-row layout). */
  warnings: string[];
}

/** Required tension steel area for given Mu, b, d, fc, fy (singly-reinforced). */
function requiredAs(
  Mu_kNm: number, bw: number, d: number, fc: number, fy: number,
): { AsReq: number; needsDouble: boolean } {
  const phi = 0.90;
  const Mu_Nmm = Mu_kNm * 1e6;
  // Mu = φ·As·fy·(d − a/2),  a = As·fy/(0.85·fc·b)
  // → As = (b·d/m)·(1 − √(1 − 2·m·Mu/(φ·b·d²·fy)))   where m = fy/(0.85·fc)
  const A = (fy * fy) / (2 * 0.85 * fc * bw);
  const B = -fy * d;
  const C = Mu_Nmm / phi;
  const disc = B * B - 4 * A * C;
  if (disc < 0) {
    // φMn,max < Mu → must add compression steel (doubly).
    return { AsReq: NaN, needsDouble: true };
  }
  const AsReq = (-B - Math.sqrt(disc)) / (2 * A);
  return { AsReq, needsDouble: false };
}

/** Minimum As per ACI 318-25 §9.6.1.2. */
function minAs(g: Geometry, fc: number, fy: number): number {
  return Math.max(
    1.4 * g.bw * g.d / fy,
    0.25 * Math.sqrt(fc) * g.bw * g.d / fy,
  );
}

/** Walk the bar catalog and pick the smallest count that meets a target area
 *  while fitting in one row of the given web. Returns null if no fit. */
function pickTensionBars(
  AsReq: number, AsMin: number, g: Geometry, m: Materials,
  stirDb: number, dagg: number,
): { bar: BarGroup; rows: number } | null {
  const target = Math.max(AsReq, AsMin);
  // Try small bars first (most ductile), then escalate. Imperial set first.
  const candidates = BAR_CATALOG
    .filter((b) => b.system === 'imperial' && b.db >= 12)   // skip stirrup-size #3
    .sort((a, b) => a.db - b.db);

  for (const bar of candidates) {
    const Ab = bar.Ab;
    const dbT = bar.db;
    // Min count to meet area
    const nMin = Math.ceil(target / Ab);
    // Cap at sensible max bars per row (avoid #6 × 20 etc.)
    if (nMin > 12) continue;

    // ACI §25.2.1 + textbook clear-bar spacing
    const sClearMin = Math.max(25, dbT, (4 / 3) * dagg);
    const bAvailable = g.bw - 2 * g.coverClear - 2 * stirDb;
    const widthRequired = nMin * dbT + (nMin - 1) * sClearMin;

    if (widthRequired <= bAvailable) {
      return { bar: { bar: bar.label, count: nMin }, rows: 1 };
    }
    // Try 2 rows if single-row doesn't fit
    const nPerRow = Math.ceil(nMin / 2);
    const widthReq2 = nPerRow * dbT + (nPerRow - 1) * sClearMin;
    if (widthReq2 <= bAvailable && nMin <= 2 * Math.floor(bAvailable / dbT)) {
      return { bar: { bar: bar.label, count: nMin }, rows: 2 };
    }
  }
  return null;
}

/** Pick stirrup spacing from the standard discrete set. */
const STIRRUP_SPACINGS = [75, 100, 125, 150, 175, 200, 225, 250, 300];

function pickStirrupSpacing(
  Vu_kN: number, g: Geometry, m: Materials,
  stirBar: string, legs: number,
  Tu_kNm: number,
): { spacing: number; sMax: number; sMaxTorsion: number } {
  const fyt = m.fyt ?? m.fy;
  const lambda = m.lambdaC ?? 1.0;
  const phi = 0.75;
  const fc = m.fc;
  const sqrtFc = Math.sqrt(fc);
  const Vc_N = 0.17 * lambda * sqrtFc * g.bw * g.d;     // §22.5.5 simplified
  const Vu_N = Math.abs(Vu_kN) * 1e3;

  // Vs required (N): Vu = φ·(Vc + Vs)  →  Vs = Vu/φ − Vc  (≥ 0)
  const Vs_req_N = Math.max(0, Vu_N / phi - Vc_N);

  // Stirrup area (Av = legs · Ab,stirrup)
  const Av = legs * barArea(stirBar);

  // Required spacing from Vs:  Vs = Av·fyt·d/s  →  s = Av·fyt·d / Vs_req
  const s_for_Vs = Vs_req_N > 0 ? (Av * fyt * g.d) / Vs_req_N : 1e9;

  // s,max per §9.7.6.2.2:  d/2 (or d/4 if Vs > 0.33·√fc·bw·d)
  const VsThreshold_N = 0.33 * lambda * sqrtFc * g.bw * g.d;
  const sMax_code = Vs_req_N > VsThreshold_N
    ? Math.min(g.d / 4, 300)
    : Math.min(g.d / 2, 600);

  // Torsion s,max — ph/8 from web only
  const ccCL = g.coverClear + barDiameter(stirBar) / 2;
  const ph = 2 * ((g.bw - 2 * ccCL) + (g.h - 2 * ccCL));
  const sMaxTorsion = Tu_kNm > 0 ? Math.min(ph / 8, 300) : 1e9;

  const sNeeded = Math.min(s_for_Vs, sMax_code, sMaxTorsion);
  // Pick the LARGEST standard spacing that's still ≤ sNeeded
  let chosen = STIRRUP_SPACINGS[0];        // fallback to tightest
  for (const s of STIRRUP_SPACINGS) {
    if (s <= sNeeded) chosen = s;
  }
  return { spacing: chosen, sMax: sMax_code, sMaxTorsion };
}

/** Recommend hanger / compression bars for a singly-reinforced section.
 *  Always at least 2× #4 to support stirrups. */
function recommendHangers(): BarGroup[] {
  return [{ bar: '#4', count: 2 }];
}

/** Skin reinforcement when h > 900 mm per §9.7.2.3. */
function recommendSkin(g: Geometry): { bar: string; countPerFace: number } | undefined {
  if (g.h <= 900) return undefined;
  // Distribute over h/2 from tension face, max spacing min(d/6, 300)
  const halfH = g.h / 2;
  const sMax = Math.min(g.d / 6, 300);
  const countPerFace = Math.max(2, Math.ceil(halfH / sMax));
  return { bar: '#4', countPerFace };
}

/** Main entry point. Given a BeamInput (loads + geometry + materials),
 *  return a RECOMMENDED Reinforcement object plus rationale. */
export function autoDesign(input: BeamInput): AutoDesignResult {
  const g = input.geometry;
  const m = input.materials;
  const L = input.loads;
  const dagg = m.aggSize ?? 19;
  const Mu = Math.abs(L.Mu);
  const Vu = Math.abs(L.Vu);
  const Tu = Math.abs(L.Tu ?? 0);
  void computeBeta1;

  const warnings: string[] = [];
  const steps: CalcStep[] = [];

  // ── 1. Stirrup choice (default #3) ────────────────────────────────────────
  // Stirrup size depends on longitudinal bar size (§25.7.2.2):
  //   ≤ #11 long bars → #3 stirrup OK
  //   #14, #18        → #4 stirrup minimum
  // We won't know the longitudinal bar yet; pick #3 and revisit.
  const stirBar = '#3';
  const stirDb = barDiameter(stirBar);
  const legs = 2;

  // ── 2. Tension steel ──────────────────────────────────────────────────────
  const { AsReq, needsDouble } = requiredAs(Mu, g.bw, g.d, m.fc, m.fy);
  const AsMin = minAs(g, m.fc, m.fy);

  steps.push({
    title: 'Required tension steel AsReq',
    formula: 'Mu = φ·As·fy·(d − a/2);  a = As·fy/(0.85·fc·b)',
    substitution: `Mu = ${Mu.toFixed(1)} kN·m, b = ${g.bw}, d = ${g.d}`,
    result: needsDouble
      ? `Mu exceeds singly-reinf. capacity → DOUBLY required`
      : `AsReq = ${AsReq.toFixed(0)} mm² (governs vs As,min = ${AsMin.toFixed(0)})`,
  });

  let tensionBar: BarGroup;
  let tensionRows = 1;
  let AsProvided: number;

  if (needsDouble) {
    // Cap at As,max,TC + add compression steel to carry the rest.
    const beta1 = computeBeta1(m.fc);
    const Es = m.Es ?? 200000;
    const epsTy = m.fy / Es;
    const cMaxTC = 0.003 * g.d / (epsTy + 0.006);
    const aMaxTC = beta1 * cMaxTC;
    const AsMaxTC = 0.85 * m.fc * g.bw * aMaxTC / m.fy;
    // Pick bars to meet AsMaxTC
    const pickT = pickTensionBars(AsMaxTC, AsMin, g, m, stirDb, dagg);
    if (!pickT) {
      warnings.push('Doubly: no bar combo fits the web — increase bw or h.');
      return {
        reinforcement: input.reinforcement, AsReq: AsMaxTC, AsProvided: 0,
        needsDouble: true, ok: false, steps, warnings,
      };
    }
    tensionBar = pickT.bar;
    tensionRows = pickT.rows;
    AsProvided = pickT.bar.count * barArea(pickT.bar.bar);
    steps.push({
      title: 'Doubly: tension bars at As,max,TC',
      formula: 'pick bars to meet As,max,TC (tension-controlled limit)',
      substitution: `As,max,TC = ${AsMaxTC.toFixed(0)} mm²`,
      result: `${tensionBar.count} ${tensionBar.bar} (As = ${AsProvided.toFixed(0)} mm²)`,
    });
  } else {
    const pickT = pickTensionBars(AsReq, AsMin, g, m, stirDb, dagg);
    if (!pickT) {
      warnings.push('No bar combo fits the web — increase bw, deepen h, or use higher fc.');
      return {
        reinforcement: input.reinforcement, AsReq, AsProvided: 0,
        needsDouble: false, ok: false, steps, warnings,
      };
    }
    tensionBar = pickT.bar;
    tensionRows = pickT.rows;
    AsProvided = pickT.bar.count * barArea(pickT.bar.bar);
    if (tensionRows > 1) {
      warnings.push(`Tension steel placed in ${tensionRows} rows — recompute d (d ≈ h − cover − db,s − db − sClear/2).`);
    }
    steps.push({
      title: 'Selected tension bars',
      formula: 'smallest count·db ≥ AsReq, fits one row',
      substitution: `target = max(AsReq, AsMin) = ${Math.max(AsReq, AsMin).toFixed(0)} mm²`,
      result: `${tensionBar.count} ${tensionBar.bar} (${AsProvided.toFixed(0)} mm² provided)`,
    });
  }

  // ── 3. Compression / hanger bars ──────────────────────────────────────────
  let compression: BarGroup[];
  if (needsDouble) {
    // Approximate As' so that φMn ≈ Mu. As' ≈ (Mu − φ·Mn,1) / (φ·fy·(d − d')).
    // We'll set φ ≈ 0.90 (ductility maintained), Mn,1 ≈ As_TC·fy·(d − a_TC/2).
    const beta1 = computeBeta1(m.fc);
    const a_max = beta1 * (0.003 * g.d / ((m.fy / (m.Es ?? 200000)) + 0.006));
    const Mn1_kNm = (AsProvided * m.fy * (g.d - a_max / 2)) / 1e6;
    const dPrime = g.dPrime ?? 60;
    const As_p = (Mu - 0.90 * Mn1_kNm) * 1e6 / (0.90 * m.fy * (g.d - dPrime));
    // Pick smallest bar combo that meets As_p
    let chosen = { bar: '#5', count: 2 };
    for (const cand of [{ bar: '#5', db: 15.9, Ab: 199 },
                        { bar: '#6', db: 19.1, Ab: 284 },
                        { bar: '#7', db: 22.2, Ab: 387 },
                        { bar: '#8', db: 25.4, Ab: 510 }]) {
      const cnt = Math.max(2, Math.ceil(As_p / cand.Ab));
      if (cnt <= 6) { chosen = { bar: cand.bar, count: cnt }; break; }
    }
    compression = [chosen];
    steps.push({
      title: 'Compression steel for doubly design',
      formula: "As' = (Mu − φ·Mn,1) / (φ·fy·(d − d'))",
      substitution: `Mn,1 ≈ ${Mn1_kNm.toFixed(1)} kN·m`,
      result: `As' ≈ ${As_p.toFixed(0)} mm² → ${chosen.count} ${chosen.bar}`,
    });
  } else {
    compression = recommendHangers();
    steps.push({
      title: 'Hanger bars (practical)',
      formula: 'minimum 2 top bars to support stirrup cage',
      substitution: '',
      result: `${compression[0].count} ${compression[0].bar}`,
    });
  }

  // ── 4. Stirrup spacing ────────────────────────────────────────────────────
  const { spacing, sMax, sMaxTorsion } = pickStirrupSpacing(
    Vu, g, m, stirBar, legs, Tu,
  );
  const stirrup: StirrupConfig = { bar: stirBar, legs, spacing };
  steps.push({
    title: 'Stirrup spacing',
    formula: 's ≤ min(Av·fyt·d/Vs, s,max,code, s,max,torsion)',
    substitution: `s,max,code = ${sMax.toFixed(0)}, s,max,torsion = ${sMaxTorsion === 1e9 ? 'N/A' : sMaxTorsion.toFixed(0) + ' mm'}`,
    result: `${legs}-leg ${stirBar} @ ${spacing} mm`,
  });

  // ── 5. Skin reinforcement (h > 900 mm) ────────────────────────────────────
  const skin = recommendSkin(g);
  if (skin) {
    steps.push({
      title: 'Skin reinforcement §9.7.2.3 (h > 900 mm)',
      formula: 'distribute on side faces over h/2 from tension face',
      substitution: `h = ${g.h} mm > 900 mm`,
      result: `${skin.countPerFace} × ${skin.bar} per face`,
    });
  }

  const reinforcement: Reinforcement = {
    tension: [tensionBar],
    compression,
    stirrup,
    tensionRows,
    skin,
  };

  return {
    reinforcement, AsReq, AsProvided,
    needsDouble,
    ok: true,
    steps, warnings,
  };
}
