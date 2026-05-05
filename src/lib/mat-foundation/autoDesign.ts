/**
 * Mat Foundation Auto-Design Driver — Phase C
 * --------------------------------------------
 *
 * Given an array of columns + soil + materials, returns a sized mat
 * foundation (B, L, T) with the 4 reinforcement mats picked from a bar
 * catalog.
 *
 * Approach (rigid method):
 *   1. SIZE B, L:
 *        Total Pservice ≈ ΣP·1.10
 *        A_req = Pservice / qa
 *        Fit a rectangle around the column footprint with margin = max(cl)·2,
 *        then enlarge to meet A_req while honouring user aspect.
 *   2. SIZE T:
 *        Iterate ≤ 14 times: T += 50 until punching at every column passes.
 *   3. PICK MATS:
 *        AsReq from strip flexure (per metre), per direction.
 *        Walk catalog ≥ #5; pick (bar, spacing) such that AsProv/m ≥ AsReq.
 *   4. VERIFY + RETURN.
 */

import type {
  MatFoundationInput,
  MatAutoDesignOptions,
  MatAutoDesignResult,
} from './types';
import type { CalcStep } from '../footing/types';
import { analyzeMatFoundation } from './solver';
import { BAR_CATALOG, barArea } from '../rc/types';

const MAT_BARS = ['#5', '#6', '#7', '#8', '#9', '#10'];
const STD_SPACINGS = [100, 125, 150, 175, 200, 225, 250, 300];

function roundUp25(x: number): number {
  return Math.ceil(x / 25) * 25;
}

function pickMat(
  AsTargetPerMm: number, T: number,
): { bar: string; spacing: number } | null {
  // AsTargetPerMm is mm² per mm of strip width = mm
  // We want (1000/spacing)·barArea ≥ AsReq_per_m → spacing ≤ 1000·barArea/AsReq_per_m
  const candidates = BAR_CATALOG
    .filter((b) => b.system === 'imperial' && MAT_BARS.includes(b.label))
    .sort((a, b) => a.db - b.db);
  for (const bar of candidates) {
    for (const s of STD_SPACINGS) {
      if (s > Math.min(3 * T, 450)) continue;
      const sClear = s - bar.db;
      if (sClear < Math.max(25, bar.db, 25)) continue;
      const AsProvPerM = (1000 / s) * bar.Ab;
      if (AsProvPerM / 1000 >= AsTargetPerMm) {
        return { bar: bar.label, spacing: s };
      }
    }
  }
  return null;
}

export function autoDesignMatFoundation(
  baseInput: MatFoundationInput,
  opts: MatAutoDesignOptions = {},
): MatAutoDesignResult {
  const aspect = opts.aspect ?? 1.0;
  const safetyFactor = opts.qaSafetyFactor ?? 1.0;
  const rationaleSteps: CalcStep[] = [];
  const warnings: string[] = [];

  let input: MatFoundationInput = JSON.parse(JSON.stringify(baseInput));

  // ── Step 1 — Size B, L ──────────────────────────────────────────────────
  const qa_eff = input.soil.qa / safetyFactor;
  const sumP = input.columns.reduce((acc, c) => acc + c.PD + c.PL, 0) * 1.10;
  const A_req = sumP / qa_eff;

  // Bounding box of columns + margin
  const xs = input.columns.map((c) => c.x);
  const ys = input.columns.map((c) => c.y);
  const colMaxDim = Math.max(...input.columns.map((c) => Math.max(c.cx, c.cy ?? c.cx)));
  const margin = colMaxDim * 1.5;
  const xMin = Math.min(...xs) - margin;
  const xMax = Math.max(...xs) + margin;
  const yMin = Math.min(...ys) - margin;
  const yMax = Math.max(...ys) + margin;
  let B = roundUp25(Math.max(2000, xMax - xMin));
  let L = roundUp25(Math.max(2000, yMax - yMin));

  // Enforce aspect (B/L target ≈ aspect)
  // If actual B/L too far from target, expand the smaller side
  const actualAspect = B / L;
  if (actualAspect < aspect) {
    B = roundUp25(L * aspect);
  } else if (actualAspect > aspect * 1.4) {
    L = roundUp25(B / aspect);
  }
  // Then ensure A ≥ A_req
  while ((B * L) / 1e6 < A_req) {
    B = roundUp25(B * 1.05);
    L = roundUp25(L * 1.05);
  }

  // Shift columns so the bounding box centre matches the mat centre.
  // (Don't shift if user-defined positions are critical — for auto-design we
  // assume positions are relative and we'll re-centre.)
  const xMid = (xMin + xMax) / 2;
  const yMid = (yMin + yMax) / 2;
  const dx = B / 2 - xMid;
  const dy = L / 2 - yMid;
  input = {
    ...input,
    columns: input.columns.map((c) => ({ ...c, x: c.x + dx, y: c.y + dy })),
  };

  rationaleSteps.push({
    title: 'Step 1 — Size B, L from column footprint + A_req',
    formula: 'A_req = (ΣP)·1.10 / qa; B, L from bounding box + margin, aspect-adjusted',
    substitution: `A_req = ${A_req.toFixed(3)} m², bounding box = ${(xMax - xMin).toFixed(0)}×${(yMax - yMin).toFixed(0)} mm`,
    result: `B = ${B} mm, L = ${L} mm  (A = ${(B * L / 1e6).toFixed(3)} m²)`,
  });

  input.geometry = { ...input.geometry, B, L };

  // ── Step 2 — Size T ─────────────────────────────────────────────────────
  let T = opts.fixT ?? Math.max(600, colMaxDim + 200);
  T = roundUp25(T);

  // Provisional rebar (small bars to compute geometry only)
  input.reinforcement = {
    topX:    { bar: '#5', spacing: 200 },
    topY:    { bar: '#5', spacing: 200 },
    bottomX: { bar: '#5', spacing: 200 },
    bottomY: { bar: '#5', spacing: 200 },
  };

  for (let iter = 0; iter < 14; iter++) {
    input.geometry = { ...input.geometry, T };
    const r = analyzeMatFoundation(input);
    if (!r.bearing.ok) {
      const factor = Math.sqrt(r.bearing.q_max / qa_eff);
      B = roundUp25(B * factor);
      L = roundUp25(L * factor);
      input.geometry = { ...input.geometry, B, L };
      continue;
    }
    if (r.punching.every((p) => p.ok)) {
      rationaleSteps.push({
        title: 'Step 2 — Size T iteratively',
        formula: 'T += 50 until punching passes at every column',
        substitution: `iterations = ${iter + 1}`,
        result: `T = ${T} mm`,
      });
      break;
    }
    if (opts.fixT) break;
    T = roundUp25(T + 50);
    if (T > 2500) {
      warnings.push('T exceeded 2500 mm — check loads / column count.');
      break;
    }
  }

  // ── Step 3 — Pick the 4 mats ────────────────────────────────────────────
  const verify = analyzeMatFoundation(input);
  const targetXBot = verify.stripFlexureX.AsReq_pos_per_m / 1000;     // mm²/mm
  const targetXTop = verify.stripFlexureX.AsReq_neg_per_m / 1000;
  const targetYBot = verify.stripFlexureY.AsReq_pos_per_m / 1000;
  const targetYTop = verify.stripFlexureY.AsReq_neg_per_m / 1000;
  const minPerM = 0.0018 * input.geometry.T;     // §8.6.1.1 minimum per metre

  const finalBotX = pickMat(Math.max(targetXBot, minPerM / 1000), T) ?? { bar: '#5', spacing: 200 };
  const finalBotY = pickMat(Math.max(targetYBot, minPerM / 1000), T) ?? { bar: '#5', spacing: 200 };
  const finalTopX = pickMat(Math.max(targetXTop, minPerM / 1000), T) ?? { bar: '#5', spacing: 200 };
  const finalTopY = pickMat(Math.max(targetYTop, minPerM / 1000), T) ?? { bar: '#5', spacing: 200 };

  input.reinforcement = {
    bottomX: finalBotX, bottomY: finalBotY,
    topX: finalTopX,    topY: finalTopY,
  };

  rationaleSteps.push({
    title: 'Step 3 — Pick all 4 mats from strip flexure',
    formula: 'AsReq_per_m from strip-method (worst Mu/strip width); minimum §8.6.1.1',
    substitution: `Bot: X = ${(targetXBot*1000).toFixed(0)}, Y = ${(targetYBot*1000).toFixed(0)} mm²/m; Top: X = ${(targetXTop*1000).toFixed(0)}, Y = ${(targetYTop*1000).toFixed(0)} mm²/m`,
    result: `Bot ${finalBotX.bar}@${finalBotX.spacing}/${finalBotY.bar}@${finalBotY.spacing}; Top ${finalTopX.bar}@${finalTopX.spacing}/${finalTopY.bar}@${finalTopY.spacing}`,
  });

  // ── Step 4 — Verify ─────────────────────────────────────────────────────
  const final = analyzeMatFoundation(input);
  rationaleSteps.push({
    title: 'Step 4 — Verify all checks',
    formula: 'analyzeMatFoundation(final input)',
    substitution: `B=${B}, L=${L}, T=${T} mm, ${input.columns.length} columns`,
    result: final.ok ? '✓ All checks pass' : `✗ ${final.warnings.length} warnings — see warnings panel`,
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

void barArea;
