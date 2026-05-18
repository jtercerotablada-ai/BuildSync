/**
 * Combined Footing Auto-Design Driver — Phase B
 * ----------------------------------------------
 *
 * Given two columns + soil + materials, returns a fully-sized rectangular
 * combined footing (L, B, T) with rebar that satisfies all checks.
 *
 * Algorithm (closely mirrors the spread-footing auto-design):
 *   1. SIZE B, L:
 *        Total Pservice ≈ Σ(PD + PL) · 1.10  (Wf+Ws ≈ 10%)
 *        A_req ← Pservice / qa
 *        Place footing centroid on load resultant → choose L from columns
 *        Choose B from A_req / L
 *   2. SIZE T:
 *        Iterate ≤ 12 times: T += 50 until punching + 1-way shear pass
 *   3. PICK BOTTOM-LONG REBAR:
 *        AsTarget = max(AsReq from |Mu+|, AsMin per §9.6.1.2)
 *        Walk catalog ≥ #5; pick smallest count with valid spacing
 *   4. PICK TOP-LONG REBAR:
 *        AsTarget = max(AsReq from |Mu−|, AsMin)
 *   5. PICK BOTTOM-TRANS REBAR:
 *        AsTarget per crossbeam under each column
 *   6. VERIFY + RETURN
 */

import type {
  CombinedFootingInput,
  CombinedAutoDesignOptions,
  CombinedAutoDesignResult,
} from './types';
import type { CalcStep } from '../footing/types';
import { analyzeCombinedFooting } from './solver';
import { BAR_CATALOG, barArea, barDiameter } from '../rc/types';

const STD_BARS = ['#5', '#6', '#7', '#8', '#9', '#10', '#11'];

function roundUp25(x: number): number {
  return Math.ceil(x / 25) * 25;
}

function pickBars(
  AsTarget: number, distAcross: number, cover: number, dagg: number,
  T: number,
): { bar: string; count: number } | null {
  const candidates = BAR_CATALOG
    .filter((b) => b.system === 'imperial' && STD_BARS.includes(b.label))
    .sort((a, b) => a.db - b.db);
  for (const bar of candidates) {
    const dbBar = bar.db;
    const sClearMin = Math.max(25, dbBar, (4 / 3) * dagg);
    const sClearMax = Math.min(3 * T, 450);
    const usable = distAcross - 2 * cover;
    const nMin = Math.max(2, Math.ceil(AsTarget / bar.Ab));
    for (let n = nMin; n <= 30; n++) {
      const sClear = (usable - n * dbBar) / Math.max(n - 1, 1);
      if (sClear >= sClearMin && sClear <= sClearMax) {
        return { bar: bar.label, count: n };
      }
    }
  }
  return null;
}

export function autoDesignCombinedFooting(
  baseInput: CombinedFootingInput,
  opts: CombinedAutoDesignOptions = {},
): CombinedAutoDesignResult {
  const aspect = opts.aspect ?? 2.5;
  const safetyFactor = opts.qaSafetyFactor ?? 1.0;
  const dagg = 19;
  const rationaleSteps: CalcStep[] = [];
  const warnings: string[] = [];

  // Deep clone the input
  let input: CombinedFootingInput = JSON.parse(JSON.stringify(baseInput));

  // ── Step 1 — Size L, B ──────────────────────────────────────────────────
  const qa_eff = input.soil.qa / safetyFactor;
  const P_estimate =
    (input.column1.PD + input.column1.PL +
     input.column2.PD + input.column2.PL) * 1.10;
  const A_req = P_estimate / qa_eff;     // m²

  // L is determined by placing the centroid on the load resultant.
  // Distance between columns + cantilevers on both ends.
  const colSeparation = Math.abs(input.column2.position - input.column1.position);
  const P1 = input.column1.PD + input.column1.PL;
  const P2 = input.column2.PD + input.column2.PL;
  // Resultant location from column1
  const xR_from_C1 = P2 * colSeparation / Math.max(P1 + P2, 1e-9);
  // Choose L so that the centroid of L falls on the resultant.
  // Place column1 at exterior-edge offset + cl1/2 (typical: tight cantilever
  // exterior column = property line case)
  const ext_offset = input.column1.cl / 2 + 25;     // small clearance
  // L/2 from left edge = position of column 1 + xR_from_C1
  // → leftEdge = (col1.position + xR_from_C1) − L/2
  // → L = 2·(col1.position + xR_from_C1 − leftEdge)
  // Choose leftEdge such that col1 has at least ext_offset cantilever:
  const leftEdge = input.column1.position - ext_offset;
  // Required L based on resultant centring:
  const L_required = 2 * (input.column1.position + xR_from_C1 - leftEdge);
  let L = roundUp25(L_required);
  // B from area requirement
  let B = roundUp25(Math.max(800, (A_req * 1e6) / L));
  // Enforce aspect cap
  if (L / B > aspect * 1.3) {
    B = roundUp25(L / aspect);
  }

  rationaleSteps.push({
    title: 'Step 1 — Size L (centroid on resultant) + B from A_req/L',
    formula: 'A_req = (ΣPD + ΣPL)·1.10 / qa;  L set by resultant centring',
    substitution: `A_req = ${A_req.toFixed(3)} m²;  resultant from C1 = ${xR_from_C1.toFixed(0)} mm`,
    result: `L = ${L} mm,  B = ${B} mm  (A = ${(L * B / 1e6).toFixed(3)} m²)`,
  });

  input.geometry = { ...input.geometry, L, B, leftEdge };

  // ── Step 2 — Size T iteratively ────────────────────────────────────────
  let T = opts.fixT ?? Math.max(450, Math.max(input.column1.cl, input.column2.cl) + 200);
  T = roundUp25(T);

  for (let iter = 0; iter < 14; iter++) {
    input.geometry = { ...input.geometry, T };
    // Placeholder rebar (small bars to compute geometry only)
    input.reinforcement = {
      bottomLong: { bar: '#7', count: 14 },
      topLong: { bar: '#7', count: 14 },
      bottomTrans: { bar: '#5', count: 18 },
    };
    const r = analyzeCombinedFooting(input);
    if (!r.bearing.ok) {
      // Bump area
      const factor = Math.sqrt(r.bearing.q_max / qa_eff);
      L = roundUp25(L * factor);
      B = roundUp25(B * factor);
      input.geometry = { ...input.geometry, L, B };
      continue;
    }
    if (r.punching1.ok && r.punching2.ok && r.shearLong.ok) {
      rationaleSteps.push({
        title: 'Step 2 — Size T iteratively',
        formula: 'Iterate T += 50 until punching + 1-way shear pass',
        substitution: `iterations = ${iter + 1}`,
        result: `T = ${T} mm`,
      });
      break;
    }
    if (opts.fixT) break;
    T = roundUp25(T + 50);
    if (T > 2200) {
      warnings.push('T exceeded 2200 mm without converging — check loads / column sizes.');
      break;
    }
  }

  // ── Step 3 — Pick bottom-long rebar ────────────────────────────────────
  const final_geom = analyzeCombinedFooting(input);
  const cover = input.geometry.coverClear;
  const Mu_pos = Math.max(1, final_geom.beam.Mu_pos_max);
  const Mu_neg = Math.max(1, Math.abs(final_geom.beam.Mu_neg_max));
  // Use the LARGER of Mu_pos, Mu_neg for sizing both sides (then refine)
  // For bottom-long: AsReq from positive Mu (cantilever side)
  const fc = input.materials.fc;
  const fy = input.materials.fy;
  const phi = 0.90;
  const d = T - cover - 22 / 2;     // estimate
  function asReqFor(Mu_kNm: number, bw: number): number {
    const A_q = fy * fy / (2 * 0.85 * fc * bw);
    const B_q = -fy * d;
    const C_q = (Mu_kNm * 1e6) / phi;
    const disc = B_q * B_q - 4 * A_q * C_q;
    return disc < 0 ? 0 : (-B_q - Math.sqrt(disc)) / (2 * A_q);
  }
  const AsMin = Math.max(Math.sqrt(fc) / (4 * fy), 1.4 / fy) * input.geometry.B * d;
  const AsReqPos = asReqFor(Mu_pos, input.geometry.B);
  const AsReqNeg = asReqFor(Mu_neg, input.geometry.B);
  const targetBotLong = Math.max(AsReqPos, AsMin);
  const targetTopLong = Math.max(AsReqNeg, AsMin);

  const pickBL = pickBars(targetBotLong, input.geometry.B, cover, dagg, T);
  if (pickBL) {
    input.reinforcement = { ...input.reinforcement, bottomLong: pickBL };
    rationaleSteps.push({
      title: 'Step 3 — Pick bottom-long rebar',
      formula: 'AsTarget = max(AsReq+, AsMin); walk catalog with spacing rules',
      substitution: `Mu+ = ${Mu_pos.toFixed(0)} kN·m, AsReq+ = ${AsReqPos.toFixed(0)}, AsMin = ${AsMin.toFixed(0)}`,
      result: `${pickBL.count} ${pickBL.bar} bottom-long`,
    });
  } else {
    warnings.push('Could not fit bottom-long bars — try bigger footing.');
  }

  const pickTL = pickBars(targetTopLong, input.geometry.B, cover, dagg, T);
  if (pickTL) {
    input.reinforcement = { ...input.reinforcement, topLong: pickTL };
    rationaleSteps.push({
      title: 'Step 4 — Pick top-long rebar (negative-moment region)',
      formula: 'AsTarget = max(AsReq−, AsMin); walk catalog',
      substitution: `|Mu−| = ${Mu_neg.toFixed(0)} kN·m, AsReq− = ${AsReqNeg.toFixed(0)}`,
      result: `${pickTL.count} ${pickTL.bar} top-long`,
    });
  } else {
    warnings.push('Could not fit top-long bars — try bigger footing.');
  }

  // ── Step 5 — Pick bottom-trans rebar ───────────────────────────────────
  const targetBotTrans = Math.max(
    final_geom.flexTrans1.AsReq, final_geom.flexTrans2.AsReq,
    final_geom.flexTrans1.AsMin,
  );
  const pickBT = pickBars(targetBotTrans, input.geometry.L, cover, dagg, T);
  if (pickBT) {
    input.reinforcement = { ...input.reinforcement, bottomTrans: pickBT };
    rationaleSteps.push({
      title: 'Step 5 — Pick bottom-trans rebar (crossbeam)',
      formula: 'AsTarget = max of crossbeam As at each column',
      substitution: `target = ${targetBotTrans.toFixed(0)} mm²`,
      result: `${pickBT.count} ${pickBT.bar} bottom-trans`,
    });
  } else {
    warnings.push('Could not fit bottom-trans bars.');
  }

  // ── Step 6 — Verify ────────────────────────────────────────────────────
  const final = analyzeCombinedFooting(input);
  rationaleSteps.push({
    title: 'Step 6 — Verify all checks',
    formula: 'analyzeCombinedFooting(final input)',
    substitution: `L=${L}, B=${B}, T=${T} mm`,
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
void barDiameter;
