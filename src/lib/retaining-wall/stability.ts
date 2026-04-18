// Stability checks: overturning, sliding, bearing capacity, eccentricity.
// All forces per meter of wall length.

import type {
  WallInput,
  StabilityResult,
  ForceResultant,
  PressureDistribution,
} from './types';
import { kaRankine, kpRankine, kaCoulomb, kpCoulomb, integrateActivePressure } from './earth-pressure';

export function computeStability(
  input: WallInput
): { stability: StabilityResult; pressure: PressureDistribution } {
  const { geometry: g, concrete, backfill, baseSoil, water, loads, theory } = input;
  const H_total = g.H_stem + g.H_foot; // full back height from stem top to footing bottom (mm)
  const B = g.B_toe + g.t_stem_bot + g.B_heel; // total footing width (mm)

  // -------- Active pressure coefficient --------
  const Ka =
    theory === 'rankine'
      ? kaRankine(backfill[0]?.phi ?? 0, g.backfillSlope)
      : kaCoulomb(
          backfill[0]?.phi ?? 0,
          g.backfillSlope,
          baseSoil.delta, // use wall-soil friction on vertical back
          Math.PI / 2
        );

  const integ = integrateActivePressure(H_total, backfill, Ka, loads, water);

  // -------- Passive pressure at toe --------
  // Soil in front of wall contributes passive resistance over height of
  // (frontFill + footing thickness).
  const Hp_mm = g.frontFill + g.H_foot + (g.key?.depth ?? 0);
  const Hp = Hp_mm / 1000;
  const Kp =
    theory === 'rankine'
      ? kpRankine(baseSoil.phi, 0)
      : kpCoulomb(baseSoil.phi, 0, baseSoil.delta);
  const Pp = baseSoil.passiveEnabled
    ? 0.5 * baseSoil.gamma * Hp * Hp * Kp + 2 * baseSoil.c * Math.sqrt(Kp) * Hp
    : 0;
  const keyContribution = g.key && baseSoil.passiveEnabled
    ? 0.5 * baseSoil.gamma * ((g.key.depth + g.H_foot) / 1000) ** 2 * Kp -
      0.5 * baseSoil.gamma * (g.H_foot / 1000) ** 2 * Kp
    : 0;

  // -------- Vertical force resultants (per meter of wall) --------
  const resultants: ForceResultant[] = [];

  // Helper: moment about toe (x=0, y=0 at toe bottom of footing). x increases
  // toward heel (backfill side). Resisting moments = V · x. Overturning =
  // horizontal · y above footing base.
  const gammaC = concrete.gamma; // kN/m³

  // 1. Stem weight (assumes constant thickness = average of top/bot)
  const tAvg = (g.t_stem_top + g.t_stem_bot) / 2 / 1000; // m
  const stemV = gammaC * tAvg * (g.H_stem / 1000); // kN/m
  const stemX = (g.B_toe + (g.t_stem_top + g.t_stem_bot) / 4) / 1000; // m (center of avg)
  // For tapered stem, x-centroid approx (toe-face + average half-width)
  const stemY = (g.H_foot + g.H_stem / 2) / 1000;
  resultants.push({
    label: 'Stem weight',
    V: stemV,
    H: 0,
    x: stemX * 1000,
    y: stemY * 1000,
    Mr: stemV * stemX,
  });

  // 2. Footing weight
  const footV = gammaC * (B / 1000) * (g.H_foot / 1000);
  const footX = B / 2 / 1000;
  resultants.push({
    label: 'Footing weight',
    V: footV,
    H: 0,
    x: footX * 1000,
    y: g.H_foot / 2 / 1000 * 1000,
    Mr: footV * footX,
  });

  // 3. Backfill weight on heel (trapezoidal if slope ≠ 0 — we use rectangle + triangle on top)
  // Use average gamma of the backfill column over H_stem for simplicity.
  const totalThick = backfill.reduce(
    (s, L) => s + (L.thickness <= 0 || !isFinite(L.thickness) ? g.H_stem : Math.min(L.thickness, g.H_stem)),
    0
  );
  const gammaAvg =
    totalThick > 0
      ? backfill.reduce(
          (s, L) =>
            s +
            L.gamma *
              (L.thickness <= 0 || !isFinite(L.thickness)
                ? g.H_stem
                : Math.min(L.thickness, g.H_stem)),
          0
        ) / totalThick
      : (backfill[0]?.gamma ?? 18);
  const heelM = g.B_heel / 1000;
  const Hstm = g.H_stem / 1000;
  // Rectangular part
  const fillRectV = gammaAvg * heelM * Hstm;
  const fillRectX = (g.B_toe + g.t_stem_bot + g.B_heel / 2) / 1000;
  resultants.push({
    label: 'Backfill on heel',
    V: fillRectV,
    H: 0,
    x: fillRectX * 1000,
    y: (g.H_foot + g.H_stem / 2) / 1000 * 1000,
    Mr: fillRectV * fillRectX,
  });

  // Sloping wedge above stem top (triangle)
  if (g.backfillSlope > 0) {
    const dh = heelM * Math.tan(g.backfillSlope);
    const wedgeV = 0.5 * gammaAvg * heelM * dh;
    const wedgeX = (g.B_toe + g.t_stem_bot + (2 / 3) * g.B_heel) / 1000;
    resultants.push({
      label: 'Backfill wedge',
      V: wedgeV,
      H: 0,
      x: wedgeX * 1000,
      y: (g.H_foot + g.H_stem + dh * 1000 / 3) / 1000 * 1000,
      Mr: wedgeV * wedgeX,
    });
  }

  // 4. Surcharge on heel (uniform q × heel area)
  if (loads.surchargeQ > 0) {
    const qV = loads.surchargeQ * heelM;
    const qX = (g.B_toe + g.t_stem_bot + g.B_heel / 2) / 1000;
    resultants.push({
      label: 'Surcharge on heel',
      V: qV,
      H: 0,
      x: qX * 1000,
      y: (g.H_foot + g.H_stem) / 1000 * 1000,
      Mr: qV * qX,
    });
  }

  // 5. Soil in front of wall (toe cover) — DELIBERATELY EXCLUDED from the
  //    stability resultants. Convention per SkyCiv, ASDIP, and sound
  //    geotechnical practice: do not rely on soil that could be excavated
  //    later (utility trench, landscaping, frost line work). Including it in
  //    ΣV would increase the sliding and bearing FS non-conservatively. The
  //    toe fill is still rendered on the canvas and contributes passive
  //    resistance only when the user explicitly opts in via
  //    baseSoil.passiveEnabled.

  // 6. Horizontal active pressure resultant (driving/overturning)
  const H_drive = integ.Pa + integ.Pq + integ.Pw + integ.dPae;
  const yBar = integ.yBar / 1000; // m above footing base
  resultants.push({
    label: 'Active thrust Pa',
    V: 0,
    H: H_drive,
    x: 0,
    y: yBar * 1000,
    Mo: H_drive * yBar,
  });

  // -------- Sum V, H, moments --------
  const sumV = resultants.reduce((s, r) => s + r.V, 0);
  const sumH = resultants.reduce((s, r) => s + r.H, 0); // driving horizontal
  const Mr = resultants.reduce((s, r) => s + (r.Mr ?? 0), 0);
  const Mo = resultants.reduce((s, r) => s + (r.Mo ?? 0), 0);

  // FS_overturning = ΣMr / ΣMo (dead loads only; surcharge resists too, but
  // surcharge on heel is a load — conservatively we INCLUDE it in resisting
  // since it IS physically carried by the footing).
  const FS_overturning = Mo > 0 ? Mr / Mo : Infinity;

  // FS_sliding = (ΣV · μ + Pp + key) / ΣH,  μ = tan δ
  const mu = Math.tan(baseSoil.delta);
  const adhesion = baseSoil.ca * (B / 1000);
  const slidingResist = sumV * mu + adhesion + Pp + keyContribution;
  const FS_sliding = sumH > 0 ? slidingResist / sumH : Infinity;

  // Bearing: e = B/2 − (ΣMr − ΣMo) / ΣV (distance from center of footing)
  // If e < B/6 (kern), trapezoidal stress distribution:
  //   qmax = ΣV/B · (1 + 6e/B), qmin = ΣV/B · (1 − 6e/B)
  // If e > B/6, heel lifts → triangular distribution:
  //   qmax = 2·ΣV / (3·(B/2 − e))
  const xbar_from_toe = sumV > 0 ? (Mr - Mo) / sumV * 1000 : B / 2; // mm
  const e = B / 2 - xbar_from_toe; // + means toward toe (center shifted forward)
  const kern = B / 6;
  let qMax: number, qMin: number;
  const V_kNpm = sumV; // kN/m of wall
  const B_m = B / 1000;
  // Resultant outside the footing → wall physically overturns, bearing fails.
  // Flag with ±Infinity so the check rolls to FAIL.
  if (Math.abs(e) >= B / 2 - 1e-6 || sumV <= 0) {
    qMax = Infinity;
    qMin = 0;
  } else if (Math.abs(e) <= kern) {
    qMax = (V_kNpm / B_m) * (1 + (6 * Math.abs(e)) / B); // kPa
    qMin = (V_kNpm / B_m) * (1 - (6 * Math.abs(e)) / B);
  } else {
    // Triangular distribution; length of contact = 3·(B/2 − |e|)
    const Lc = 3 * (B / 2 - Math.abs(e));
    qMax = (2 * V_kNpm) / (Lc / 1000);
    qMin = 0;
  }
  const bearingUtil = isFinite(qMax)
    ? qMax / Math.max(baseSoil.qAllow, 1e-6)
    : Infinity;

  const sf = input.safetyFactors;
  const eMax = sf.eccentricity === 'kern' ? B / 6 : B / 3;

  const pressure: PressureDistribution = {
    K: Ka,
    H_total,
    Pa: integ.Pa,
    yBar: integ.yBar,
    PaV: 0, // vertical component; for Coulomb with δ we'd compute tan δ
    Pq: integ.Pq,
    Pw: integ.Pw,
    dPae: integ.dPae,
  };

  const stability: StabilityResult = {
    resultants,
    sumV,
    sumH,
    Mr,
    Mo,
    FS_overturning,
    FS_sliding,
    slidingMu: mu,
    passiveResistance: Pp,
    keyContribution,
    eccentricity: e,
    kern,
    qMax,
    qMin,
    bearingUtilization: bearingUtil,
    B,
    overturningOk: FS_overturning >= sf.overturning,
    slidingOk: FS_sliding >= sf.sliding,
    bearingOk: bearingUtil <= 1.0,
    eccentricityOk: Math.abs(e) <= eMax,
  };

  return { stability, pressure };
}
