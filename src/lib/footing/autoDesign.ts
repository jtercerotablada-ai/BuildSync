// Foundation Design — auto-design driver
// ----------------------------------------------------
// Given service loads + soil + materials + column dims, return a
// fully-sized footing (B, L, T) with rebar that meets all ACI 318-25 checks.
//
// Algorithm (per the approved MEGA-PLAN):
//   1. SIZE B, L from service loads / qa, rounded up to 25 mm.
//   2. SIZE T iteratively until punching + 1-way shear pass.
//   3. PICK BOTTOM REBAR each direction to meet AsReq + AsMin.
//   4. PICK TOP REBAR if uplift / bearing-interface fails.
//   5. CHECK OVERTURNING — bump B/L if FOS < 1.5.
//   6. VERIFY full result; record per-step rationale.

import type {
  AutoDesignOptions, AutoDesignResult, FootingInput, CalcStep, FootingMaterials,
} from './types';
import { analyzeFooting } from './solver';
import { BAR_CATALOG, barArea, barDiameter } from '../rc/types';

const STD_BARS_BOTTOM = ['#4', '#5', '#6', '#7', '#8', '#9', '#10', '#11'];

/** Round a length up to nearest 25 mm. */
function roundUp25(x: number): number {
  return Math.ceil(x / 25) * 25;
}

/** Required tension steel for a singly-reinforced rectangular section. */
function requiredAs(
  Mu_kNm: number, b: number, d: number, fc: number, fy: number,
): number {
  const phi = 0.90;
  const Mu_Nmm = Math.abs(Mu_kNm) * 1e6;
  const A = (fy * fy) / (2 * 0.85 * fc * b);
  const B = -fy * d;
  const C = Mu_Nmm / phi;
  const disc = B * B - 4 * A * C;
  if (disc < 0) return 0;
  return (-B - Math.sqrt(disc)) / (2 * A);
}

function asMinForFooting(b: number, T: number, m: FootingMaterials): number {
  const fy = m.fy;
  const rhoMin = fy <= 420 ? 0.0020 : Math.max(0.0014, 0.0018 * 420 / fy);
  return rhoMin * b * T;
}

/** Walk bar catalog and pick smallest count that meets target area + fits. */
function pickBarsForFooting(
  AsTarget: number, distAcross: number, cover: number, dagg: number,
  T: number, fixBarSize?: string,
): { bar: string; count: number } | null {
  const candidates = fixBarSize
    ? BAR_CATALOG.filter((b) => b.label === fixBarSize)
    : BAR_CATALOG.filter((b) => b.system === 'imperial' && STD_BARS_BOTTOM.includes(b.label))
                 .sort((a, b) => a.db - b.db);
  for (const bar of candidates) {
    const dbBar = bar.db;
    const sClearMin = Math.max(25, dbBar, (4 / 3) * dagg);
    const sClearMax = Math.min(3 * T, 450);
    const usable = distAcross - 2 * cover;
    // Min count for area
    const nMin = Math.max(2, Math.ceil(AsTarget / bar.Ab));
    // Iterate from nMin upward to find a count where spacing fits both bounds
    for (let n = nMin; n <= 20; n++) {
      if (n === 1) continue;
      const s_clear = (usable - n * dbBar) / (n - 1);
      if (s_clear < sClearMin) continue;       // too tight, try more bars (no — more bars = tighter)
      if (s_clear > sClearMax) continue;       // too sparse, need more bars
      // valid
      return { bar: bar.label, count: n };
    }
    // Try minimum number that gives s_clear ≥ sClearMin
    const n_for_min_spacing = Math.ceil(
      (usable - sClearMin) / (dbBar + sClearMin),
    );
    if (n_for_min_spacing >= nMin && n_for_min_spacing <= 20) {
      return { bar: bar.label, count: n_for_min_spacing };
    }
  }
  return null;
}

export function autoDesignFooting(
  baseInput: FootingInput, opts: AutoDesignOptions = { shape: 'square' },
): AutoDesignResult {
  const aspect = opts.aspect ?? 1.25;
  const safetyFactor = opts.qaSafetyFactor ?? 1.0;
  const designForOver = opts.designForOverturning !== false;
  const dagg = 19;
  const rationaleSteps: CalcStep[] = [];
  const warnings: string[] = [];

  // Working copy of input that we mutate
  let input: FootingInput = JSON.parse(JSON.stringify(baseInput)) as FootingInput;

  // ── Step 1 — Size B, L from service loads ──────────────────────────────
  const qa_eff = input.soil.qa / safetyFactor;
  const P_estimate = (input.loads.PD + input.loads.PL) * 1.10;     // Wf+Ws ~10%
  const A_req = P_estimate / qa_eff;
  const A_req_mm2 = A_req * 1e6;

  let B: number, L: number;
  if (opts.shape === 'square') {
    const side = roundUp25(Math.sqrt(A_req_mm2));
    B = side; L = side;
  } else {
    // L/B = aspect → A = aspect·B² → B = √(A/aspect)
    const B_calc = roundUp25(Math.sqrt(A_req_mm2 / aspect));
    B = B_calc; L = roundUp25(aspect * B_calc);
  }

  rationaleSteps.push({
    title: 'Step 1 — Size footing area B × L',
    formula: 'A_req = (PD + PL)·1.10 / qa  →  B,L round-up to 25 mm',
    substitution: `A_req = ${A_req.toFixed(3)} m², shape = ${opts.shape}, aspect = ${aspect}`,
    result: `B = ${B} mm, L = ${L} mm  (A = ${((B * L) / 1e6).toFixed(3)} m²)`,
  });

  input.geometry = { ...input.geometry, B, L };

  // ── Step 2 — Size T iteratively until punching + 1-way shear pass ──────
  let T = opts.fixT
    ? input.geometry.T
    : Math.max(300, Math.max(input.geometry.cx, input.geometry.cy ?? input.geometry.cx) + 200);
  T = roundUp25(T);

  for (let iter = 0; iter < 20; iter++) {
    input.geometry = { ...input.geometry, T };
    // Use placeholder rebar — small bars to compute geometry only
    input.reinforcement = {
      bottomX: { bar: '#5', count: 8 },
      bottomY: { bar: '#5', count: 8 },
    };
    const r = analyzeFooting(input);
    // Bearing might fail because we didn't include Wf+Ws in step-1 estimate
    if (!r.bearing.ok) {
      // increase area by 10%, restart
      const factor = Math.sqrt(r.bearing.q_max / qa_eff);
      B = roundUp25(B * factor);
      L = opts.shape === 'square' ? B : roundUp25(L * factor);
      input.geometry = { ...input.geometry, B, L };
      continue;
    }
    if (r.punching.ok && r.shearX.ok && r.shearY.ok) {
      rationaleSteps.push({
        title: 'Step 2 — Size thickness T',
        formula: 'Iterate T until punching + 1-way shear pass',
        substitution: `iterations = ${iter + 1}`,
        result: `T = ${T} mm`,
      });
      break;
    }
    if (opts.fixT) break;
    T = roundUp25(T + 50);
    if (T > 2000) {
      warnings.push('T exceeded 2000 mm without converging — check loads / column size.');
      break;
    }
  }

  // ── Step 3 — Pick bottom rebar each direction ───────────────────────────
  // Re-analyze to get qnu and Mu values
  const analysis = analyzeFooting(input);
  const cover = input.geometry.coverClear;

  for (const dir of ['X', 'Y'] as const) {
    const flex = dir === 'X' ? analysis.flexureX : analysis.flexureY;
    const distAcross = dir === 'X' ? input.geometry.B : input.geometry.L;
    const AsReq = flex.AsReq;
    const AsMin = asMinForFooting(distAcross, input.geometry.T, input.materials);
    const AsTarget = Math.max(AsReq, AsMin);

    const picked = pickBarsForFooting(AsTarget, distAcross, cover, dagg, input.geometry.T, opts.fixBarSize);
    if (!picked) {
      warnings.push(`Could not fit bars in ${dir} direction — try larger footing or smaller bar.`);
      continue;
    }

    rationaleSteps.push({
      title: `Step 3${dir} — Pick bottom rebar (${dir})`,
      formula: 'AsTarget = max(AsReq, AsMin); walk catalog, pick smallest count fitting spacing',
      substitution: `AsReq = ${AsReq.toFixed(0)}, AsMin = ${AsMin.toFixed(0)} → target = ${AsTarget.toFixed(0)} mm²`,
      result: `${picked.count} ${picked.bar} (As = ${(picked.count * barArea(picked.bar)).toFixed(0)} mm²)`,
    });

    if (dir === 'X') {
      input.reinforcement = { ...input.reinforcement, bottomX: picked };
    } else {
      input.reinforcement = { ...input.reinforcement, bottomY: picked };
    }
  }

  // ── Step 4 — Top rebar (only if needed) ────────────────────────────────
  const r4 = analyzeFooting(input);
  if (!r4.bearingInterface.ok || r4.upliftRegion) {
    // Add modest top mat
    const distAcross = input.geometry.B;
    const AsTopMin = asMinForFooting(distAcross, input.geometry.T, input.materials) * 0.5;
    const topX = pickBarsForFooting(AsTopMin, distAcross, cover, dagg, input.geometry.T);
    const topY = pickBarsForFooting(AsTopMin, input.geometry.L, cover, dagg, input.geometry.T);
    if (topX && topY) {
      input.reinforcement = { ...input.reinforcement, topX, topY };
      rationaleSteps.push({
        title: 'Step 4 — Top rebar (uplift / bearing)',
        formula: '0.5·AsMin top mat for uplift / bearing-interface deficit',
        substitution: '',
        result: `top X: ${topX.count} ${topX.bar}, top Y: ${topY.count} ${topY.bar}`,
      });
    }
  }

  // ── Step 5 — Overturning bump ──────────────────────────────────────────
  if (designForOver) {
    let safetyIter = 0;
    while (safetyIter < 5) {
      const r = analyzeFooting(input);
      if (!r.overturning.notApplicable && !r.overturning.ok) {
        const newB = roundUp25(input.geometry.B * 1.15);
        const newL = opts.shape === 'square' ? newB : roundUp25(input.geometry.L * 1.15);
        input.geometry = { ...input.geometry, B: newB, L: newL };
        safetyIter++;
      } else {
        break;
      }
    }
    if (safetyIter > 0) {
      rationaleSteps.push({
        title: 'Step 5 — Overturning safety bump',
        formula: 'Increase B/L by 15% until FOS ≥ 1.5',
        substitution: `iterations = ${safetyIter}`,
        result: `B = ${input.geometry.B} mm, L = ${input.geometry.L} mm`,
      });
    }
  }

  // ── Step 6 — Verify ─────────────────────────────────────────────────────
  const final = analyzeFooting(input);
  rationaleSteps.push({
    title: 'Step 6 — Verify all checks',
    formula: 'analyzeFooting(final input)',
    substitution: `B=${input.geometry.B}, L=${input.geometry.L}, T=${input.geometry.T} mm`,
    result: final.ok
      ? `✓ All ${13} checks pass`
      : `✗ ${final.warnings.length} warnings — see warnings panel`,
  });

  if (!final.ok) {
    warnings.push('Auto-design did not converge to a fully-passing design — review warnings.');
  }

  return {
    patchedInput: input,
    ok: final.ok,
    rationaleSteps,
    warnings: [...warnings, ...final.warnings],
  };
}

void barDiameter;     // keep import side-effects
