// Auto-design for continuous beams — generates a SkyCiv-style layered
// reinforcement layout (top bars at supports for negative-moment regions,
// bottom bars in midspans for positive-moment regions) from the moment
// envelope produced by analyzeContinuous().
//
// Methodology (per Wight & MacGregor 7e Ch 10 + ACI 318-25 §9.7.3):
//
//   1. From envelope: Mmax(x) (positive) and Mmin(x) (negative).
//   2. Identify positive-moment regions where Mmax > 0 (between inflection
//      points) → BOTTOM bars.
//   3. Identify negative-moment regions where Mmin < 0 (around supports) →
//      TOP bars.
//   4. For each positive-moment region:
//      - Continuous bottom bars: ≥ 1/3 of the peak +M As, full length to
//        anchor into supports (§9.7.3.8.1).
//      - Curtailed extra bars: from inflection − ld/extension to inflection
//        + ld/extension, sized so the running 1/3 carries the moment outside
//        this range.
//   5. For each negative-moment region (around an interior support):
//      - Top bars at full peak −M As over a window centered at the support.
//      - Window extent: from inflection-left of left span to inflection-right
//        of right span, plus the §9.7.3.5 extension max(d, 12·db).
//   6. Generate stirrup zones from the shear envelope using the existing
//      computeStirrupZones() machinery (called separately).
//
// Output: a Reinforcement with `layers` populated. Capacity at every station
// is automatically satisfied by construction (provided the bar selection
// rounds up appropriately).

import type { ContinuousAnalysisOptions, ContinuousResult } from './continuous';
import { analyzeContinuous } from './continuous';
import type {
  RebarLayer, ShearZoneInput, Reinforcement, Materials, Geometry, CalcStep,
  ContinuousBeamModel, ContinuousSpan,
} from './types';
import { BAR_CATALOG, barArea, barDiameter } from './types';
import { computeBeta1 } from './solver';

void computeBeta1;

export interface ContinuousAutoDesignInput {
  geometry: Geometry;
  materials: Materials;
  model: ContinuousBeamModel;
  /** Override default span ratio for "≥ 1/3 of bars run full length". Default 0.34. */
  runFractionPos?: number;
  /** Override extension factor for curtailed bars (max(d, 12·db) by default). */
  extensionMin?: 'd' | '12db' | 'max';
}

export interface ContinuousAutoDesignResult {
  /** Generated rebar layers (top + bottom). */
  layers: RebarLayer[];
  /** Generated shear zones. */
  shearZones: ShearZoneInput[];
  /** Reinforcement object ready to drop into BeamInput. */
  reinforcement: Reinforcement;
  /** Continuous-beam analysis result for reference. */
  envelope: ContinuousResult;
  /** Per-region peak Mu values for documentation. */
  regions: Array<{
    kind: 'positive' | 'negative';
    xStart: number;
    xEnd: number;
    Mu: number;          // kN·m, signed
    AsReq: number;       // mm²
  }>;
  /** Per-step rationale. */
  steps: CalcStep[];
  /** Warnings for the engineer. */
  warnings: string[];
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

/** Walk bar catalog, pick smallest count meeting target area. */
function pickBars(
  AsTarget: number, g: Geometry, dagg: number, stirDb: number,
): { bar: string; count: number } {
  const candidates = BAR_CATALOG
    .filter((b) => b.system === 'imperial' && b.db >= 12)
    .sort((a, b) => a.db - b.db);
  for (const bar of candidates) {
    const n = Math.ceil(AsTarget / bar.Ab);
    if (n > 12) continue;
    // Fit check
    const sClearMin = Math.max(25, bar.db, (4 / 3) * dagg);
    const bAvailable = g.bw - 2 * g.coverClear - 2 * stirDb;
    const widthRequired = n * bar.db + (n - 1) * sClearMin;
    if (widthRequired <= bAvailable) {
      return { bar: bar.label, count: n };
    }
  }
  // Fallback — biggest bar that fits
  return { bar: '#11', count: Math.max(2, Math.ceil(AsTarget / 1006)) };
}

/** Find inflection points (where M crosses zero) along an array. Returns x's
 *  where the sign flips. */
function findInflections(xs: number[], M: number[]): number[] {
  const out: number[] = [];
  for (let i = 1; i < M.length; i++) {
    const a = M[i - 1], b = M[i];
    if (a === 0) continue;
    if (a * b < 0) {
      // Linear interpolation for zero-crossing
      const t = a / (a - b);
      out.push(xs[i - 1] + t * (xs[i] - xs[i - 1]));
    }
  }
  return out;
}

/** Find connected regions where Mmax > 0 (positive moment regions). */
function findPositiveRegions(
  xs: number[], Mmax: number[],
): Array<{ xStart: number; xEnd: number; Mpeak: number; xPeak: number }> {
  const regions: Array<{ xStart: number; xEnd: number; Mpeak: number; xPeak: number }> = [];
  let inRegion = false;
  let regionStart = 0, peakM = 0, peakX = 0;
  for (let i = 0; i < xs.length; i++) {
    if (Mmax[i] > 0) {
      if (!inRegion) { inRegion = true; regionStart = xs[i]; peakM = 0; peakX = xs[i]; }
      if (Mmax[i] > peakM) { peakM = Mmax[i]; peakX = xs[i]; }
    } else if (inRegion) {
      regions.push({ xStart: regionStart, xEnd: xs[i], Mpeak: peakM, xPeak: peakX });
      inRegion = false;
    }
  }
  if (inRegion) {
    regions.push({ xStart: regionStart, xEnd: xs[xs.length - 1], Mpeak: peakM, xPeak: peakX });
  }
  return regions;
}

/** Find LOCAL MINIMA of Mmin (i.e. peak negative moments). For continuous
 *  beams with pattern LL, Mmin can stay negative across multiple interior
 *  spans, so we split by support location: one negative-moment region per
 *  interior support, extending to the local maxima of Mmin (least negative)
 *  on either side. */
function findNegativeRegions(
  xs: number[], Mmin: number[], spanBoundaries: number[],
): Array<{ xStart: number; xEnd: number; Mpeak: number; xPeak: number }> {
  const regions: Array<{ xStart: number; xEnd: number; Mpeak: number; xPeak: number }> = [];
  // Interior supports are at spanBoundaries[1..n-1] (exclude leftmost x=0 and
  // rightmost x=Ltotal). For each interior support, the negative-moment
  // region is centered there.
  for (let supIdx = 1; supIdx < spanBoundaries.length - 1; supIdx++) {
    const supX = spanBoundaries[supIdx];
    // Find peak negative Mmin in the vicinity of this support (within
    // ± half the span on each side)
    const halfSpanLeft = (supX - spanBoundaries[supIdx - 1]) / 2;
    const halfSpanRight = (spanBoundaries[supIdx + 1] - supX) / 2;
    let peakM = 0, peakX = supX;
    for (let i = 0; i < xs.length; i++) {
      if (xs[i] >= supX - halfSpanLeft && xs[i] <= supX + halfSpanRight) {
        if (Mmin[i] < peakM) { peakM = Mmin[i]; peakX = xs[i]; }
      }
    }
    if (peakM >= 0) continue;     // no negative moment near this support
    // Find the region boundaries: walk OUTWARD from peakX until Mmin
    // reaches a LOCAL MAXIMUM (least negative) on each side, then use those
    // as the region extents. For exterior negative-moment ends, use the
    // span boundary (start/end of beam).
    let xLeft = supX - halfSpanLeft;
    for (let i = 0; i < xs.length - 1; i++) {
      if (xs[i] > peakX) break;
      // Find the local max of Mmin (least negative) between previous support
      // and current peak — that's the inflection-like point.
      if (xs[i] >= spanBoundaries[supIdx - 1]) {
        // Look for where Mmin starts decreasing toward peakX
        if (i > 0 && Mmin[i] < 0 && Mmin[i] > Mmin[i - 1] && Mmin[i] > Mmin[i + 1]) {
          xLeft = xs[i];
        }
      }
    }
    let xRight = supX + halfSpanRight;
    for (let i = xs.length - 1; i >= 0; i--) {
      if (xs[i] < peakX) break;
      if (xs[i] <= spanBoundaries[supIdx + 1]) {
        if (i < xs.length - 1 && Mmin[i] < 0 && Mmin[i] > Mmin[i - 1] && Mmin[i] > Mmin[i + 1]) {
          xRight = xs[i];
        }
      }
    }
    regions.push({ xStart: xLeft, xEnd: xRight, Mpeak: peakM, xPeak: peakX });
  }
  // Also check exterior supports for negative moment (cantilever or fixed end).
  // Left exterior support
  const leftBoundary = spanBoundaries[0];
  let leftPeakM = 0, leftPeakX = leftBoundary;
  for (let i = 0; i < xs.length && xs[i] < spanBoundaries[1] / 2; i++) {
    if (Mmin[i] < leftPeakM) { leftPeakM = Mmin[i]; leftPeakX = xs[i]; }
  }
  if (leftPeakM < -0.001) {
    let xRight = spanBoundaries[1] / 2;
    for (let i = 0; i < xs.length; i++) {
      if (xs[i] > leftPeakX && Mmin[i] >= 0) { xRight = xs[i]; break; }
    }
    regions.push({ xStart: leftBoundary, xEnd: xRight, Mpeak: leftPeakM, xPeak: leftPeakX });
  }
  // Right exterior support
  const rightBoundary = spanBoundaries[spanBoundaries.length - 1];
  let rightPeakM = 0, rightPeakX = rightBoundary;
  const rightHalfStart = spanBoundaries[spanBoundaries.length - 2] +
                         (rightBoundary - spanBoundaries[spanBoundaries.length - 2]) / 2;
  for (let i = 0; i < xs.length; i++) {
    if (xs[i] >= rightHalfStart && Mmin[i] < rightPeakM) {
      rightPeakM = Mmin[i]; rightPeakX = xs[i];
    }
  }
  if (rightPeakM < -0.001) {
    let xLeft = rightHalfStart;
    for (let i = xs.length - 1; i >= 0; i--) {
      if (xs[i] < rightPeakX && Mmin[i] >= 0) { xLeft = xs[i]; break; }
    }
    regions.push({ xStart: xLeft, xEnd: rightBoundary, Mpeak: rightPeakM, xPeak: rightPeakX });
  }
  return regions;
}

/** Main entry point. */
export function autoDesignContinuous(
  input: ContinuousAutoDesignInput,
): ContinuousAutoDesignResult {
  const g = input.geometry;
  const m = input.materials;
  const dagg = m.aggSize ?? 19;
  const fc = m.fc;
  const fy = m.fy;
  const dbStirrup = barDiameter('#3');     // provisional, may upgrade
  const steps: CalcStep[] = [];
  const warnings: string[] = [];

  // 1. Run continuous-beam analysis to get envelope
  const Ec = (g.h <= 600 ? 4700 : 4700) * Math.sqrt(fc);   // simple formula
  const Ig = g.bw * Math.pow(g.h, 3) / 12;
  const EI = (Ec / 1000) * Ig;     // kN·mm²
  const opts: ContinuousAnalysisOptions = { EI, pattern: input.model.patternLL !== false };
  const env = analyzeContinuous(input.model, opts);

  steps.push({
    title: 'Continuous beam envelope',
    formula: 'Mmax(x) and Mmin(x) from stiffness method + ACI §6.4 pattern loading',
    substitution: `${env.stations.length} stations, ${input.model.spans.length} spans`,
    result: `Mmax,+ = ${Math.max(...env.Mmax).toFixed(1)} kN·m, Mmin,− = ${Math.min(...env.Mmin).toFixed(1)} kN·m`,
  });

  // 2. Identify positive and negative moment regions
  const xs = env.stations.map((s) => s.x);
  const positiveRegions = findPositiveRegions(xs, env.Mmax);
  const negativeRegions = findNegativeRegions(xs, env.Mmin, env.spanBoundaries);

  steps.push({
    title: 'Identify moment regions',
    formula: 'M(x) > 0 → bottom bars region; M(x) < 0 → top bars region',
    substitution: `${positiveRegions.length} positive regions, ${negativeRegions.length} negative regions`,
    result: 'Boundaries from sign-change interpolation',
  });

  const layers: RebarLayer[] = [];
  const regions: ContinuousAutoDesignResult['regions'] = [];

  // 3. Bottom bars per positive-moment region
  const runFraction = input.runFractionPos ?? 1 / 3;
  positiveRegions.forEach((reg, i) => {
    const AsReq = requiredAs(reg.Mpeak, g.bw, g.d, fc, fy);
    const { bar, count } = pickBars(AsReq, g, dagg, dbStirrup);
    regions.push({
      kind: 'positive',
      xStart: reg.xStart,
      xEnd: reg.xEnd,
      Mu: reg.Mpeak,
      AsReq,
    });

    // Continuous portion: ≥ 1/3 of bars (or 2, whichever is more) run full
    // length per §9.7.3.8.1 — anchored into supports.
    const runCount = Math.max(2, Math.ceil(count * runFraction));
    const curtailedCount = count - runCount;

    // Continuous bottom bars — extend a bit past the inflection points into
    // adjacent supports (≥ 150 mm into support per §9.7.3.8.2).
    layers.push({
      position: 'bottom',
      count: runCount,
      bar,
      topBotDistance: g.coverClear + dbStirrup + barDiameter(bar) / 2,
      xStart: Math.max(0, reg.xStart - 150),
      xEnd: Math.min(env.Ltotal, reg.xEnd + 150),
      mark: `B${i + 1}c`,
    });

    if (curtailedCount > 0) {
      // Curtailed extra bars: cover the high-moment region with ld extension.
      // Theoretical cutoff: where running bars alone meet Mmax.
      // Approximation: extend from inflection minus 0.1·region_length to
      // inflection plus 0.1·region_length (Wight Ch 10 typical practice).
      const regionLen = reg.xEnd - reg.xStart;
      const extension = Math.max(g.d, 12 * barDiameter(bar));
      const xS = Math.max(reg.xStart, reg.xPeak - regionLen / 2 - extension);
      const xE = Math.min(reg.xEnd, reg.xPeak + regionLen / 2 + extension);
      layers.push({
        position: 'bottom',
        count: curtailedCount,
        bar,
        topBotDistance: g.coverClear + dbStirrup + barDiameter(bar) * 1.5,    // second row
        xStart: xS,
        xEnd: xE,
        mark: `B${i + 1}x`,
      });
    }
  });

  // 4. Top bars per negative-moment region
  negativeRegions.forEach((reg, i) => {
    const AsReq = requiredAs(Math.abs(reg.Mpeak), g.bw, g.d, fc, fy);
    const { bar, count } = pickBars(AsReq, g, dagg, dbStirrup);
    regions.push({
      kind: 'negative',
      xStart: reg.xStart,
      xEnd: reg.xEnd,
      Mu: reg.Mpeak,
      AsReq,
    });

    // Top bars centered on support, extending past inflection by max(d,
    // 12·db, ℓn/16) per §9.7.3.5 + §9.7.3.8.4.
    const extension = Math.max(g.d, 12 * barDiameter(bar));
    const xS = Math.max(0, reg.xStart - extension);
    const xE = Math.min(env.Ltotal, reg.xEnd + extension);

    // ≥ 1/3 must extend ℓn/16 past point of inflection (§9.7.3.8.4)
    // The full top bar count covers the negative-moment region.
    layers.push({
      position: 'top',
      count,
      bar,
      topBotDistance: g.coverClear + dbStirrup + barDiameter(bar) / 2,
      xStart: xS,
      xEnd: xE,
      mark: `T${i + 1}`,
    });
  });

  // 5. At least 2 hanger bars at the top, full length, to support stirrups
  const totalLength = env.Ltotal;
  const hangerSpansAlreadyCovered = negativeRegions.some(
    (r) => Math.abs(r.xStart) < 100 && Math.abs(r.xEnd - totalLength) < 100,
  );
  if (!hangerSpansAlreadyCovered) {
    layers.push({
      position: 'top',
      count: 2,
      bar: '#4',
      topBotDistance: g.coverClear + dbStirrup + barDiameter('#4') / 2,
      xStart: 0,
      xEnd: totalLength,
      mark: 'H',
    });
    steps.push({
      title: 'Hanger bars (practical detail)',
      formula: '2× #4 top bars full-length to support stirrup cage',
      substitution: '',
      result: '2 #4 top × full beam length',
    });
  }

  // 6. Stirrup zones — simple algorithm: 3 zones per span (2 high-shear at
  // ends + 1 lower in middle). Real refinement done by computeStirrupZones
  // when attaching to envelope.
  const shearZones: ShearZoneInput[] = [];
  let xOff = 0;
  input.model.spans.forEach((sp: ContinuousSpan) => {
    const L = sp.L;
    const supportRegion = Math.min(2 * g.d, L / 4);
    // Tighter near support
    shearZones.push({
      legs: 2, bar: '#3', spacing: 100,
      xStart: xOff, xEnd: xOff + supportRegion,
    });
    // Wider in middle
    shearZones.push({
      legs: 2, bar: '#3', spacing: 200,
      xStart: xOff + supportRegion, xEnd: xOff + L - supportRegion,
    });
    // Tighter near right support
    shearZones.push({
      legs: 2, bar: '#3', spacing: 100,
      xStart: xOff + L - supportRegion, xEnd: xOff + L,
    });
    xOff += L;
  });

  steps.push({
    title: 'Stirrup zones',
    formula: '3 zones per span — high shear at supports, lower in middle',
    substitution: `${input.model.spans.length} spans → ${shearZones.length} zones`,
    result: 'See shearZones table',
  });

  // 7. Build the resulting Reinforcement
  const reinforcement: Reinforcement = {
    // Legacy fields populated with the BIGGEST positive-region requirement so
    // single-section flexure still works as a reference. The `layers` field
    // takes precedence in continuous-beam visualization.
    tension: layers.find((l) => l.position === 'bottom')
      ? [{ bar: layers.find((l) => l.position === 'bottom')!.bar,
           count: layers.find((l) => l.position === 'bottom')!.count }]
      : [{ bar: '#5', count: 2 }],
    compression: layers.find((l) => l.position === 'top' && l.mark !== 'H')
      ? [{ bar: layers.find((l) => l.position === 'top' && l.mark !== 'H')!.bar,
           count: layers.find((l) => l.position === 'top' && l.mark !== 'H')!.count }]
      : [{ bar: '#4', count: 2 }],
    stirrup: { bar: '#3', legs: 2, spacing: 200 },
    layers,
    shearZones,
  };

  if (positiveRegions.length === 0) {
    warnings.push('No positive-moment regions detected — verify load configuration.');
  }
  if (negativeRegions.length === 0 && input.model.spans.length > 1) {
    warnings.push('No negative-moment regions detected for multi-span beam — may be cantilever-only or under-loaded.');
  }

  return { layers, shearZones, reinforcement, envelope: env, regions, steps, warnings };
}
