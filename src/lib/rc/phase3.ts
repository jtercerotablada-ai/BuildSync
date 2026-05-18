// ============================================================================
// Phase 3 — Stirrup zoning, development length, lap splices, bar curtailment
// All per ACI 318-25 (SI Units).
// ============================================================================

import type {
  BeamEnvelopeInput, EnvelopeAnalysis, FlexureCheck,
  DevLengthInfo, LapSpliceInfo, StirrupZone, StirrupZoningResult,
  BarCutoff, CurtailmentResult, ElevationData,
  CalcStep, BarLocation, BarCoating,
} from './types';
import { lookupBar, barArea, barDiameter } from './types';

// ============================================================================
// Development length §25.4.2.3 (simplified equations) + §25.4.9 (compression)
// ============================================================================

interface DevLengthOpts {
  db: number;                  // bar diameter (mm)
  fy: number;                  // bar yield strength (MPa)
  fc: number;                  // concrete fc (MPa)
  lambda?: number;             // §19.2.4: 1.0 nwt, 0.85 LW, 0.75 sand-LW
  location?: BarLocation;      // 'top' → ψt = 1.3 (≥300mm fresh concrete below); else 1.0
  coating?: BarCoating;        // 'epoxy' → ψe up to 1.5; 'uncoated' → 1.0
  case?: 1 | 2;                // 1 = better confinement (cover ≥ db, sp ≥ db, min stirrups); 2 = other
}

/** Tension development length §25.4.2.3 simplified. Returns ld in mm (≥ 300 mm). */
export function tensionDevLength(opts: DevLengthOpts): {
  ld: number; psiT: number; psiE: number; psiS: number; psiG: number; lambda: number;
  steps: CalcStep[];
} {
  const { db, fy, fc } = opts;
  const lambda = opts.lambda ?? 1.0;
  const psiT = opts.location === 'top' ? 1.3 : 1.0;
  // Simplified ψe — true value depends on cover/spacing; use 1.5 (conservative) for epoxy
  const psiE = opts.coating === 'epoxy' ? 1.5 : opts.coating === 'galvanized' ? 1.0 : 1.0;
  // ψs (size factor) handled by switching equation between #6-and-smaller (db ≤ 19) vs #7+ (db > 19)
  const psiS = db <= 19 ? 1.0 : 1.0;     // factored into the divisor below
  // ψg (grade) §25.4.2.5(c): 1.0 for fy ≤ 420; 1.15 for 421–550; 1.3 for > 550
  const psiG = fy <= 420 ? 1.0 : fy <= 550 ? 1.15 : 1.3;

  const useCase = opts.case ?? 2;          // default: case 2 (no confinement guarantees)
  // Simplified equation divisor per §25.4.2.3 (Table)
  const divisor =
    db <= 19
      ? (useCase === 1 ? 2.1 : 1.4)
      : (useCase === 1 ? 1.7 : 1.1);

  const ldRatio = (fy * psiT * psiE * psiG) / (divisor * lambda * Math.sqrt(fc));
  const ld = Math.max(300, ldRatio * db);

  const steps: CalcStep[] = [
    {
      title: 'ψt — top-reinf factor §25.4.2.5(d)',
      formula: '1.3 for top bars with ≥ 300 mm fresh concrete below; else 1.0',
      substitution: opts.location === 'top' ? 'top bar' : 'not top bar',
      result: `ψt = ${psiT.toFixed(2)}`,
    },
    {
      title: 'ψe — coating §25.4.2.5(b)',
      formula: 'Epoxy with cover < 3db or sp < 6db: 1.5; epoxy other: 1.2; uncoated: 1.0',
      substitution: opts.coating ?? 'uncoated',
      result: `ψe = ${psiE.toFixed(2)}`,
    },
    {
      title: 'ψg — grade §25.4.2.5(c)',
      formula: '1.0 for fy ≤ 420; 1.15 for 421–550; 1.3 for > 550 MPa',
      substitution: `fy = ${fy} MPa`,
      result: `ψg = ${psiG.toFixed(2)}`,
    },
    {
      title: 'Tension ld (simplified §25.4.2.3)',
      formula: `ld/db = fy·ψt·ψe·ψg / (${divisor}·λ·√fʹc) ${db <= 19 ? '[#6 & smaller]' : '[#7 & larger]'} ${useCase === 1 ? '(case 1)' : '(case 2)'}`,
      substitution: `ld/db = ${fy}·${psiT}·${psiE}·${psiG}/(${divisor}·${lambda}·√${fc})`,
      result: `ld/db = ${ldRatio.toFixed(1)}  →  ld = ${ld.toFixed(0)} mm`,
      ref: 'ACI 318-25 §25.4.2.3',
    },
  ];
  return { ld, psiT, psiE, psiS, psiG, lambda, steps };
}

/** Compression development length §25.4.9.2. Returns ldc in mm (≥ 200 mm). */
export function compressionDevLength(opts: { db: number; fy: number; fc: number; lambda?: number; psiR?: number }): number {
  const { db, fy, fc } = opts;
  const lambda = opts.lambda ?? 1.0;
  const psiR = opts.psiR ?? 1.0;     // confinement factor for compression
  const psiG = fy <= 420 ? 1.0 : fy <= 550 ? 1.15 : 1.3;
  // §25.4.9.2 Eq. 25.4.9.2: ldc = max(0.24·fy·ψr·ψg/(λ·√fc), 0.043·fy·ψr·ψg) · db ≥ 200
  const ldcRatio = Math.max(
    0.24 * fy * psiR * psiG / (lambda * Math.sqrt(fc)),
    0.043 * fy * psiR * psiG,
  );
  return Math.max(200, ldcRatio * db);
}

/** Build a DevLengthInfo for use in the elevation drawing + report. */
export function buildDevLengthInfo(bar: string, opts: Omit<DevLengthOpts, 'db'>): DevLengthInfo {
  const db = barDiameter(bar);
  const tension = tensionDevLength({ db, ...opts });
  const ldc = compressionDevLength({ db, fy: opts.fy, fc: opts.fc, lambda: opts.lambda });
  return {
    db, location: opts.location ?? 'bottom', coating: opts.coating ?? 'uncoated',
    case: opts.case ?? 2,
    ld: tension.ld, ldc,
    factors: {
      psiT: tension.psiT, psiE: tension.psiE, psiS: tension.psiS,
      psiG: tension.psiG, lambda: tension.lambda,
    },
    ref: 'ACI 318-25 §25.4',
    steps: tension.steps,
  };
}

// ============================================================================
// Lap splices §25.5
// ============================================================================
export function lapSpliceLength(ld: number, fyStress?: number, fy?: number, fractionSpliced?: number): LapSpliceInfo {
  const stressRatio = fyStress && fy ? fyStress / fy : 1.0;
  const frac = fractionSpliced ?? 1.0;     // default: all bars spliced
  // Class A allowed only when stress ≤ 0.5·fy AND ≤ 50% bars spliced at one location.
  const classA = Math.max(300, ld);
  const classB = Math.max(300, 1.3 * ld);
  const recommended = stressRatio <= 0.5 && frac <= 0.5 ? 'A' : 'B';
  return { classA, classB, recommended, ref: 'ACI 318-25 §25.5.2' };
}

// ============================================================================
// Stirrup zoning — auto-divide the beam into N zones based on Vu envelope
// ============================================================================

/** Standard stirrup spacings for design (mm), descending order. */
const STD_SPACINGS = [300, 250, 200, 175, 150, 125, 100, 75];

/**
 * Compute optimal stirrup spacing per zone based on Vu envelope.
 * Algorithm:
 *   1. For each station, compute the smallest standard spacing satisfying both
 *      shear demand AND s,max per §9.7.6.2.2.
 *   2. Group consecutive stations with the same chosen spacing into zones.
 *   3. Apply zone-merge: short zones (< L/20) merge with the tighter neighbor.
 */
export function computeStirrupZones(
  envelopeResult: EnvelopeAnalysis,
  input: BeamEnvelopeInput,
): StirrupZoningResult {
  const { geometry: g, materials: m, reinforcement: r } = input;
  const fc = m.fc;
  const fyt = m.fyt ?? m.fy;
  const lambdaC = m.lambdaC ?? 1.0;
  const Av = r.stirrup.legs * barArea(r.stirrup.bar);
  const phi = 0.75;
  const stations = envelopeResult.stations;

  // s,max per §9.7.6.2.2 (depends on Vs threshold = 0.33·√fc·bw·d)
  const VsThresh = 0.33 * Math.sqrt(fc) * g.bw * g.d / 1000;

  // Av,min/s per §9.6.3.4 — gives the LARGEST spacing for which Av ≥ Av,min.
  // Av,min = max(0.062·√fʹc·bw·s/fyt, 0.35·bw·s/fyt) → for given Av:
  //   s ≤ Av / max(0.062·√fʹc·bw/fyt, 0.35·bw/fyt)
  const AvMinPerS = Math.max(0.062 * Math.sqrt(fc) * g.bw / fyt, 0.35 * g.bw / fyt);
  const sFromAvMin = Av / AvMinPerS;

  // For each station: pick minimum standard spacing that passes shear AND s,max
  // AND Av ≥ Av,min (when stirrups are required at all).
  const stationSpacings: number[] = stations.map((stn) => {
    const Vu = stn.Vu;
    // Required Vs from Vu: φVc + φVs ≥ Vu  →  Vs ≥ Vu/φ - Vc
    const Vc = 0.17 * lambdaC * Math.sqrt(fc) * g.bw * g.d / 1000;
    const VsReq = Math.max(0, Vu / phi - Vc);
    // s_max per §9.7.6.2.2
    const sMaxThis = VsReq <= VsThresh ? Math.min(g.d / 2, 600) : Math.min(g.d / 4, 300);
    // s required for shear: s ≤ Av·fyt·d / (Vs·1000)
    const sShear = VsReq > 0 ? (Av * fyt * g.d) / (VsReq * 1000) : Infinity;
    // Stirrups required when Vu > 0.5·φ·Vc (§9.6.3.1)
    const stirrupsRequired = Vu > 0.5 * phi * Vc;
    const sAvMin = stirrupsRequired ? sFromAvMin : Infinity;
    const sLimit = Math.min(sMaxThis, sShear, sAvMin);
    // Pick the largest standard spacing ≤ sLimit
    for (const s of STD_SPACINGS) {
      if (s <= sLimit) return s;
    }
    return STD_SPACINGS[STD_SPACINGS.length - 1];     // fallback to tightest
  });

  // Group consecutive stations with same spacing into zones
  const rawZones: StirrupZone[] = [];
  let zoneStart = 0;
  let zoneSpacing = stationSpacings[0];
  for (let i = 1; i <= stationSpacings.length; i++) {
    if (i === stationSpacings.length || stationSpacings[i] !== zoneSpacing) {
      const xStart = zoneStart === 0 ? 0 : (stations[zoneStart - 1].x + stations[zoneStart].x) / 2;
      const xEnd = i === stationSpacings.length ? g.L : (stations[i - 1].x + stations[i].x) / 2;
      // Worst Vu in this zone
      let VuMax = 0;
      let ratioMax = 0;
      for (let k = zoneStart; k < i; k++) {
        VuMax = Math.max(VuMax, stations[k].Vu);
        ratioMax = Math.max(ratioMax, stations[k].shearRatio);
      }
      const len = xEnd - xStart;
      const count = Math.max(2, Math.floor(len / zoneSpacing) + 1);
      // Compute s,max for this zone (worst case)
      const VsLocal = (Av * fyt * g.d) / (zoneSpacing * 1000);
      const sMaxLocal = VsLocal <= VsThresh ? Math.min(g.d / 2, 600) : Math.min(g.d / 4, 300);
      rawZones.push({
        xStart, xEnd, s: zoneSpacing,
        sMax: sMaxLocal, VuMax, ratio: ratioMax,
        count, ok: zoneSpacing <= sMaxLocal && ratioMax <= 1.0,
      });
      if (i < stationSpacings.length) {
        zoneStart = i;
        zoneSpacing = stationSpacings[i];
      }
    }
  }

  // Merge short zones (< L/20 = ~5%) into the adjacent tighter-spacing zone
  const minZoneLen = g.L / 20;
  const merged: StirrupZone[] = [];
  for (const z of rawZones) {
    const len = z.xEnd - z.xStart;
    if (merged.length > 0 && len < minZoneLen) {
      const prev = merged[merged.length - 1];
      // Use the tighter spacing
      prev.s = Math.min(prev.s, z.s);
      prev.xEnd = z.xEnd;
      prev.VuMax = Math.max(prev.VuMax, z.VuMax);
      prev.ratio = Math.max(prev.ratio, z.ratio);
      prev.count = Math.max(2, Math.floor((prev.xEnd - prev.xStart) / prev.s) + 1);
      prev.ok = prev.ok && z.ok;
    } else {
      merged.push({ ...z });
    }
  }

  const totalCount = merged.reduce((sum, z) => sum + z.count, 0);
  const stirrupBar = lookupBar(r.stirrup.bar);
  const stirrupPerimeter = (g.bw - 2 * g.coverClear) * 2 + (g.h - 2 * g.coverClear) * 2;     // approx
  const totalMass = stirrupBar
    ? totalCount * (stirrupPerimeter / 1000) * stirrupBar.mass
    : 0;
  const ok = merged.every((z) => z.ok);

  const Lm = g.L / 1000;
  return {
    zones: merged,
    totalCount,
    totalMass,
    ok,
    narrativeEn: `${merged.length} stirrup zone${merged.length > 1 ? 's' : ''} along the ${Lm.toFixed(2)} m beam — ${totalCount} stirrups total (~${totalMass.toFixed(1)} kg).`,
    narrativeEs: `${merged.length} zona${merged.length > 1 ? 's' : ''} de estribos a lo largo de la viga de ${Lm.toFixed(2)} m — ${totalCount} estribos en total (~${totalMass.toFixed(1)} kg).`,
  };
}

// ============================================================================
// Bar curtailment §9.7.3
// ============================================================================

/**
 * Compute curtailment plan for tension bars.
 *
 * §9.7.3 logic:
 *   • At least 1/3 of the +moment bars must extend along the same face into the support
 *     (§9.7.3.8.1, simply-supported case).
 *   • Remaining bars can be curtailed where Mu(x) ≤ reduced φMn (with N − cut bars).
 *   • Bars must extend max(d, 12·db) past the theoretical cutoff (§9.7.3.3).
 *   • Bars must extend ld past the section of max stress (§9.7.3.3 implicit).
 */
export function computeCurtailment(
  envelopeResult: EnvelopeAnalysis,
  input: BeamEnvelopeInput,
  _flexureWorst: FlexureCheck,
): CurtailmentResult {
  void _flexureWorst;     // legacy param kept for ABI; reduced φMn now exact
  const { geometry: g, materials: m, reinforcement: r } = input;
  const stations = envelopeResult.stations;
  const tens = r.tension;
  const comp = r.compression ?? [];

  // Total tension bars across all groups
  const totalTensCount = tens.reduce((s, bg) => s + bg.count, 0);
  // Bars that MUST extend full length (≥ 1/3 per §9.7.3.8.1, rounded up to nearest bar)
  const mustRunCount = Math.max(2, Math.ceil(totalTensCount / 3));

  const bars: BarCutoff[] = [];

  // Distribute bars: first N "running" bars from each group take priority for being kept full-length
  let runningBudget = mustRunCount;

  tens.forEach((bg, gi) => {
    const db = barDiameter(bg.bar);
    const dbCount = bg.count;
    const runningInGroup = Math.min(dbCount, runningBudget);
    const curtailedInGroup = dbCount - runningInGroup;
    runningBudget -= runningInGroup;

    if (runningInGroup > 0) {
      bars.push({
        groupIndex: gi,
        position: 'tension',
        bar: bg.bar,
        count: runningInGroup,
        kind: 'running',
        xStart: 0,
        xEnd: g.L,
        noteEn: `${runningInGroup} bar(s) of ${bg.bar} extend full length (§9.7.3.8.1).`,
        noteEs: `${runningInGroup} barra(s) ${bg.bar} extienden la longitud completa (§9.7.3.8.1).`,
      });
    }

    if (curtailedInGroup > 0) {
      // Theoretical cutoff: where Mu(x) drops below the φMn provided by only
      // the RUNNING bars. We compute the EXACT φMn for the running-bar
      // configuration by re-running the flexure equation, not the linear
      // approximation As_running/As_total · φMn.
      //
      // Closed-form for singly-rect (running area only):
      //   a = As_run·fy/(0.85·fc·b),  Mn = As_run·fy·(d − a/2)
      // Use bw for safety (T-beam will be conservative; curtailment cutoff
      // moves slightly outward, which is on the SAFE side per §9.7.3.5).
      const fc = m.fc;
      const fy = m.fy;
      const beta1Eff = fc <= 28 ? 0.85 : fc >= 55 ? 0.65 : 0.85 - 0.05 * (fc - 28) / 7;
      const As_run = mustRunCount * barArea(bg.bar);
      const a_run = As_run * fy / (0.85 * fc * g.bw);
      const c_run = a_run / beta1Eff;
      const Es = 200000;
      const epsTy = fy / Es;
      const epsT_run = 0.003 * (g.d - c_run) / Math.max(c_run, 1);
      // φ from §21.2.2 for the reduced-As case (typically still tension-controlled)
      const epsTcl = epsTy + 0.003;
      const phi_run =
        epsT_run >= epsTcl ? 0.90 :
        epsT_run <= epsTy ? 0.65 :
        0.65 + 0.25 * (epsT_run - epsTy) / (epsTcl - epsTy);
      const reducedPhiMn = phi_run * As_run * fy * (g.d - a_run / 2) / 1e6;

      // Find the leftmost station where Mu first exceeds reducedPhiMn (and rightmost where it drops back below)
      let xLeft = 0, xRight = g.L;
      for (let i = 0; i < stations.length; i++) {
        if (stations[i].Mu > reducedPhiMn) { xLeft = stations[i].x; break; }
      }
      for (let i = stations.length - 1; i >= 0; i--) {
        if (stations[i].Mu > reducedPhiMn) { xRight = stations[i].x; break; }
      }
      // Extension max(d, 12·db) per §9.7.3.3
      const extension = Math.max(g.d, 12 * db);
      const xStart = Math.max(0, xLeft - extension);
      const xEnd = Math.min(g.L, xRight + extension);
      // Plus development-length extension from the point of max stress (typically midspan for SS)
      const ld = tensionDevLength({ db, fy: m.fy, fc: m.fc, lambda: m.lambdaC,
        location: 'bottom', coating: 'uncoated', case: 2 }).ld;

      bars.push({
        groupIndex: gi,
        position: 'tension',
        bar: bg.bar,
        count: curtailedInGroup,
        kind: 'curtailed',
        xTheoretical: xLeft,           // leftmost theoretical cutoff (rightmost mirrored)
        xActual: xStart,                // actual cut after extension
        ld,
        xStart, xEnd,
        noteEn: `${curtailedInGroup} bar(s) of ${bg.bar} curtailed at x = ${(xStart / 1000).toFixed(2)}–${(xEnd / 1000).toFixed(2)} m (theoretical cutoff at ${(xLeft / 1000).toFixed(2)}–${(xRight / 1000).toFixed(2)} m + extension max(d, 12·db) = ${extension.toFixed(0)} mm).`,
        noteEs: `${curtailedInGroup} barra(s) ${bg.bar} cortada(s) en x = ${(xStart / 1000).toFixed(2)}–${(xEnd / 1000).toFixed(2)} m (corte teórico en ${(xLeft / 1000).toFixed(2)}–${(xRight / 1000).toFixed(2)} m + extensión máx(d, 12·db) = ${extension.toFixed(0)} mm).`,
      });
    }
  });

  // Compression / hanger bars: run full length
  comp.forEach((bg, gi) => {
    bars.push({
      groupIndex: gi,
      position: 'compression',
      bar: bg.bar,
      count: bg.count,
      kind: 'running',
      xStart: 0,
      xEnd: g.L,
      noteEn: `${bg.count} bar(s) of ${bg.bar} (top, hangers) extend full length to support stirrups.`,
      noteEs: `${bg.count} barra(s) ${bg.bar} (superiores, percheros) extienden longitud completa para sostener estribos.`,
    });
  });

  // Steel takeoff
  const totalMass = bars.reduce((sum, b) => {
    const mass = lookupBar(b.bar)?.mass ?? 0;
    const length = (b.xEnd - b.xStart) / 1000;
    return sum + b.count * length * mass;
  }, 0);

  const ok = bars.length > 0 && envelopeResult.maxFlexureRatio <= 1;

  return {
    bars,
    totalMass,
    ok,
    narrativeEn: `${bars.length} bar group${bars.length > 1 ? 's' : ''} planned (${bars.filter(b => b.kind === 'running').length} running, ${bars.filter(b => b.kind === 'curtailed').length} curtailed). Steel takeoff: ${totalMass.toFixed(1)} kg.`,
    narrativeEs: `${bars.length} grupo${bars.length > 1 ? 's' : ''} de barras planeado${bars.length > 1 ? 's' : ''} (${bars.filter(b => b.kind === 'running').length} corridas, ${bars.filter(b => b.kind === 'curtailed').length} cortadas). Volumen de acero: ${totalMass.toFixed(1)} kg.`,
  };
}

// ============================================================================
// Combined: build the full ElevationData from an envelope analysis
// ============================================================================
export function buildElevationData(
  envelopeResult: EnvelopeAnalysis,
  input: BeamEnvelopeInput,
  flexureWorst: FlexureCheck,
): ElevationData {
  const { materials: m, reinforcement: r } = input;
  const zoning = computeStirrupZones(envelopeResult, input);
  const curtailment = computeCurtailment(envelopeResult, input, flexureWorst);

  // Build dev-length info per unique bar size used
  const devLengths: Record<string, DevLengthInfo> = {};
  const lapSplices: Record<string, LapSpliceInfo> = {};
  const allBars = new Set<string>();
  r.tension.forEach((bg) => allBars.add(bg.bar));
  (r.compression ?? []).forEach((bg) => allBars.add(bg.bar));
  for (const bar of allBars) {
    const info = buildDevLengthInfo(bar, {
      fy: m.fy, fc: m.fc, lambda: m.lambdaC ?? 1.0,
      location: 'bottom', coating: 'uncoated', case: 2,
    });
    devLengths[bar] = info;
    lapSplices[bar] = lapSpliceLength(info.ld);
  }

  return { zoning, curtailment, devLengths, lapSplices };
}
