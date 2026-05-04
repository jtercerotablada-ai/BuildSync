// Reinforced Concrete (RC) Beam Design — solver
//
// Implements all major design checks per ACI 318-25 (SI units):
//   • FLEXURE       §22.2 (sectional strength) + §9.5 (design strength)
//                   - Whitney rectangular stress block (§22.2.2.4)
//                   - β1 per §22.2.2.4.3
//                   - φ per §21.2.2 (tension-controlled / compression-controlled)
//                   - As_min per §9.6.1.2
//                   - Doubly-reinforced + T-beams supported
//   • SHEAR         §22.5 (sectional shear) + §9.6.3 + §9.7.6.2.2
//                   - Vc per §22.5.5 (simplified)
//                   - Vs per §22.5.10.5.3 (vertical stirrups)
//                   - φ = 0.75
//                   - Av,min + s,max
//   • DEFLECTION    §24.2 (Bischoff Ie §24.2.3.5) + Tabla 24.2.2 + §24.2.4 long-term
//                   - Ig, Icr, Mcr, Ie
//                   - λΔ = ξ/(1+50·ρ′), ξ per Table 24.2.4.1.3
//   • CRACK CONTROL §24.3.2 (max bar spacing)
//
// All calcs in SI. Inputs in mm, MPa, kN, kN·m.

import type {
  BeamInput,
  BeamAnalysis,
  FlexureCheck,
  ShearCheck,
  DeflectionCheck,
  CrackControlCheck,
  DetailingCheck,
  DetailingItem,
  CalcStep,
  Materials,
  Reinforcement,
  Geometry,
  Loads,
  DeflectionLimitCategory,
  Code,
  BeamEnvelopeInput,
  EnvelopeAnalysis,
  StationResult,
  GoverningFailure,
  DemandSource,
} from './types';
import { lookupBar, barArea, barDiameter } from './types';
import { buildElevationData } from './phase3';

// ============================================================================
// COMMON HELPERS
// ============================================================================
function sumBarArea(groups: { bar: string; count: number }[]): number {
  return groups.reduce((s, g) => s + g.count * barArea(g.bar), 0);
}
function maxBarDiameter(groups: { bar: string; count: number }[]): number {
  return groups.reduce((d, g) => Math.max(d, barDiameter(g.bar)), 0);
}
function sumBarCount(groups: { bar: string; count: number }[]): number {
  return groups.reduce((n, g) => n + g.count, 0);
}

/** β1 per ACI 318-25 §22.2.2.4.3 (SI, fc in MPa). */
export function computeBeta1(fc: number): number {
  if (fc <= 28) return 0.85;
  if (fc >= 55) return 0.65;
  return 0.85 - 0.05 * (fc - 28) / 7;
}

/** Modulus of elasticity Ec per ACI 318-25 §19.2.2 (SI, MPa, normal weight). */
export function computeEc(fc: number, gammaC: number = 24): number {
  // For normal weight (γc ≈ 24 kN/m³):  Ec = 4700·√fc
  // General form ACI Eq 19.2.2.1.b: Ec = (γc^1.5)·0.043·√fc with γc in kg/m³
  const wc = gammaC * 1000 / 9.81;  // kN/m³ → kg/m³ approx
  if (Math.abs(gammaC - 24) < 0.5) return 4700 * Math.sqrt(fc);
  return Math.pow(wc, 1.5) * 0.043 * Math.sqrt(fc);
}

/** Modulus of rupture fr per ACI 318-25 §19.2.3.1 (SI, MPa). */
export function computeFr(fc: number, lambdaC: number = 1.0): number {
  return 0.62 * lambdaC * Math.sqrt(fc);
}

/** φ per ACI 318-25 §21.2.2 from net tensile strain εt. */
export function phiFromStrain(epsT: number, epsTy: number): {
  phi: number;
  section: 'tension-controlled' | 'transition' | 'compression-controlled';
} {
  const epsTcl = epsTy + 0.003;     // tension-controlled limit
  if (epsT >= epsTcl) return { phi: 0.90, section: 'tension-controlled' };
  if (epsT <= epsTy) return { phi: 0.65, section: 'compression-controlled' };
  // Linear interpolation in transition zone
  const phi = 0.65 + 0.25 * (epsT - epsTy) / (epsTcl - epsTy);
  return { phi, section: 'transition' };
}

/** ξ multiplier for sustained loads per ACI 318-25 Table 24.2.4.1.3. */
export function xiFromMonths(months: number): number {
  if (months <= 3) return 1.0;
  if (months <= 6) return 1.2;
  if (months <= 12) return 1.4;
  return 2.0;
}

/** Deflection limit ratio per ACI 318-25 Tabla 24.2.2 (returns L/X integer). */
export function deflectionLimitRatio(cat: DeflectionLimitCategory): number {
  switch (cat) {
    case 'flat-roof-no-attached': return 180;
    case 'floor-no-attached': return 360;
    case 'floor-attached-not-likely': return 240;
    case 'floor-attached-likely-damage': return 480;
  }
}

/** Code reference helper: returns "ACI 318-25 §X.Y" or equivalent for the chosen code. */
function ref(code: Code, section: string): string {
  if (code === 'ACI 318-19') return `ACI 318-19 §${section}`;
  if (code === 'EN 1992-1-1') return `EN 1992-1-1 §${section}`;
  return `ACI 318-25 §${section}`;
}

// ============================================================================
// SECTION GEOMETRIC PROPERTIES
// ============================================================================
/** Area of concrete cross section (mm²). */
export function sectionArea(g: Geometry): number {
  if (g.shape === 'rectangular') return g.bw * g.h;
  // T-beam (or L/inverted-T treated as T for properties)
  const bf = g.bf ?? g.bw;
  const hf = g.hf ?? 0;
  return bf * hf + g.bw * (g.h - hf);
}

/** Centroid measured from top of beam (mm). */
export function sectionCentroid(g: Geometry): number {
  if (g.shape === 'rectangular') return g.h / 2;
  const bf = g.bf ?? g.bw;
  const hf = g.hf ?? 0;
  const A1 = bf * hf;
  const A2 = g.bw * (g.h - hf);
  const y1 = hf / 2;
  const y2 = hf + (g.h - hf) / 2;
  return (A1 * y1 + A2 * y2) / (A1 + A2);
}

/** Gross moment of inertia Ig about the centroid (mm⁴). */
export function gross_Ig(g: Geometry): number {
  if (g.shape === 'rectangular') return g.bw * Math.pow(g.h, 3) / 12;
  const bf = g.bf ?? g.bw;
  const hf = g.hf ?? 0;
  const A1 = bf * hf;
  const A2 = g.bw * (g.h - hf);
  const y1 = hf / 2;
  const y2 = hf + (g.h - hf) / 2;
  const ybar = sectionCentroid(g);
  const I1 = bf * Math.pow(hf, 3) / 12 + A1 * Math.pow(ybar - y1, 2);
  const I2 = g.bw * Math.pow(g.h - hf, 3) / 12 + A2 * Math.pow(ybar - y2, 2);
  return I1 + I2;
}

/** Distance from centroid to extreme tension fibre (mm). */
export function yt(g: Geometry): number {
  return g.h - sectionCentroid(g);
}

/** Cracked moment of inertia Icr (rectangular section, singly reinforced) (mm⁴). */
export function cracked_Icr(g: Geometry, n: number, As: number, AsPrime: number = 0, dPrime: number = 0): number {
  const b = g.bw;        // approximation: T-beam treated as rectangular for Icr
  const d = g.d;
  const nA = n * As;
  const nAPrime = (n - 1) * AsPrime;     // approximate transformation for compression steel
  // Solve for kd from quadratic: b·kd²/2 + (n-1)·As'·kd - n·As·d - (n-1)·As'·d' = 0  (approximate)
  // Simplified for singly: b·kd²/2 + n·As·kd - n·As·d = 0
  const a_q = b / 2;
  const b_q = nA + nAPrime;
  const c_q = -nA * d - nAPrime * dPrime;
  const disc = b_q * b_q - 4 * a_q * c_q;
  const kd = (-b_q + Math.sqrt(disc)) / (2 * a_q);
  // Icr about neutral axis (kd from top)
  const Icr = b * Math.pow(kd, 3) / 3 + nA * Math.pow(d - kd, 2) + nAPrime * Math.pow(kd - dPrime, 2);
  return Icr;
}

// ============================================================================
// MAIN ENTRY POINT
// ============================================================================
export function analyze(input: BeamInput): BeamAnalysis {
  const warnings: string[] = [];
  try {
    const Ec = computeEc(input.materials.fc, input.materials.gammaC ?? 24);
    const Es = input.materials.Es ?? 200000;
    const n = Es / Ec;
    void n;

    const flexure = checkFlexure(input);
    const shear = checkShear(input);
    const deflection = checkDeflection(input, flexure);
    const crack = checkCrackControl(input);
    const detailing = checkDetailing(input);

    const selfWeight = (input.materials.gammaC ?? 24) * sectionArea(input.geometry) * 1e-6;

    if (flexure.section === 'compression-controlled') {
      warnings.push('Section is compression-controlled — increase d, b, or use compression steel.');
    }
    if (flexure.section === 'transition') {
      warnings.push('Section is in transition zone (φ < 0.90) — consider increasing depth or steel for full ductility.');
    }
    if (flexure.needsDouble) {
      warnings.push('Mu exceeds singly-reinforced capacity — add compression steel (doubly reinforced design).');
    }
    if (shear.stirrupsRequired && shear.AvMin > shear.Av) {
      warnings.push(`Provided stirrup area Av = ${shear.Av.toFixed(0)} mm² < Av,min = ${shear.AvMin.toFixed(0)} mm² — increase stirrup size or decrease spacing.`);
    }

    const ok = flexure.ok && shear.ok && deflection.ok && crack.ok && detailing.ok;

    return {
      input, flexure, shear, deflection, crack, detailing,
      selfWeight,
      sectionType: input.geometry.shape,
      warnings,
      ok,
      solved: true,
    };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return {
      input,
      flexure: emptyFlexure(),
      shear: emptyShear(),
      deflection: emptyDeflection(input),
      crack: emptyCrack(),
      detailing: emptyDetailing(),
      selfWeight: 0,
      sectionType: input.geometry.shape,
      warnings: [`Solver error: ${msg}`],
      ok: false,
      solved: false,
    };
  }
}

// ============================================================================
// FLEXURE CHECK — ACI 318-25 §22.2 + §9.5 + §9.6.1
// ============================================================================
function checkFlexure(input: BeamInput): FlexureCheck {
  const { code, geometry: g, materials: m, reinforcement: r, loads: L } = input;
  const fc = m.fc;
  const fy = m.fy;
  const Es = m.Es ?? 200000;
  const beta1 = computeBeta1(fc);
  const epsTy = fy / Es;
  const epsCu = 0.003;          // concrete crushing strain (ACI §22.2.2.1)

  // Provided steel
  const As = sumBarArea(r.tension);
  const AsPrime = sumBarArea(r.compression ?? []);
  const dPrime = g.dPrime ?? 60;       // default 60 mm if compression steel exists

  // For T-beam, we need to figure out if NA is in flange or in web.
  // First, assume NA in flange → treat as rectangular with b = bf.
  let bEff = g.bw;
  if (g.shape !== 'rectangular') {
    bEff = g.bf ?? g.bw;
  }

  // === Iterative φ calculation ===
  // For singly: T = C  →  As·fy = 0.85·fc·b·a  →  a = As·fy / (0.85·fc·b)
  // For doubly: assume As'·fy compression first (approximate; iterate if needed)
  let a: number, c: number;
  let needsDouble = false;

  if (AsPrime > 1e-6) {
    // Doubly reinforced. Compute compression force from steel + concrete.
    // Assume both steels yield. Then T = C_steel' + C_concrete
    // (As - As')·fy = 0.85·fc·b·a  →  a = (As - As')·fy / (0.85·fc·b)
    const AsNet = Math.max(0, As - AsPrime);
    a = AsNet * fy / (0.85 * fc * bEff);
    c = a / beta1;
    // Check if compression steel yields (εs' ≥ εty)
    const epsSPrime = epsCu * (c - dPrime) / c;
    if (epsSPrime < epsTy) {
      // Compression steel doesn't yield — re-solve with elastic stress
      // f's = Es · εs' = Es · 0.003·(c - d')/c
      // Equilibrium: As·fy = 0.85·fc·b·a + As'·f's
      // Substitute a = β1·c:
      // As·fy = 0.85·fc·b·β1·c + As'·Es·0.003·(c-d')/c
      // Multiply through by c:
      // As·fy·c = 0.85·fc·b·β1·c² + As'·Es·0.003·(c - d')
      // 0.85·fc·b·β1·c² + (As'·Es·0.003 - As·fy)·c - As'·Es·0.003·d' = 0
      const A_q = 0.85 * fc * bEff * beta1;
      const B_q = AsPrime * Es * 0.003 - As * fy;
      const C_q = -AsPrime * Es * 0.003 * dPrime;
      const disc = B_q * B_q - 4 * A_q * C_q;
      c = (-B_q + Math.sqrt(disc)) / (2 * A_q);
      a = beta1 * c;
    }
  } else {
    // Singly. Check T-beam: if a > hf, NA is in web (T-beam action).
    a = As * fy / (0.85 * fc * bEff);
    c = a / beta1;
    if (g.shape !== 'rectangular' && g.hf && a > g.hf) {
      // T-beam, NA in web. Resolve.
      // C = 0.85·fc·[bf·hf + bw·(a - hf)]
      // T = As·fy
      // → 0.85·fc·bw·(a - hf) = As·fy - 0.85·fc·bf·hf
      // → a = hf + (As·fy - 0.85·fc·bf·hf) / (0.85·fc·bw)
      const Cflange = 0.85 * fc * (g.bf ?? bEff) * g.hf;
      a = g.hf + (As * fy - Cflange) / (0.85 * fc * g.bw);
      c = a / beta1;
    }
  }

  // Net tension strain εt at extreme tension steel level
  const epsT = epsCu * (g.d - c) / c;
  const phiInfo = phiFromStrain(epsT, epsTy);

  // Nominal moment Mn (kN·m)
  let Mn: number;
  if (AsPrime > 1e-6) {
    // Doubly reinforced
    const epsSPrime = epsCu * (c - dPrime) / c;
    const fsPrime = Math.min(fy, epsSPrime * Es);
    const Cs = AsPrime * fsPrime;
    const Cc = 0.85 * fc * bEff * a;
    Mn = (Cc * (g.d - a / 2) + Cs * (g.d - dPrime)) / 1e6;
  } else if (g.shape !== 'rectangular' && g.hf && a > g.hf) {
    // T-beam, NA in web
    const Cflange = 0.85 * fc * (g.bf ?? bEff) * g.hf;
    const Cweb = 0.85 * fc * g.bw * (a - g.hf);
    Mn = (Cflange * (g.d - g.hf / 2) + Cweb * (g.d - (a + g.hf) / 2)) / 1e6;
  } else {
    // Singly, rectangular
    Mn = (As * fy * (g.d - a / 2)) / 1e6;
  }
  const phiMn = phiInfo.phi * Mn;

  // Required As (closed-form, iteratively could refine but this is exact for singly-rect)
  // Mu = φ·As·fy·(d - a/2)  with a = As·fy/(0.85·fc·b)
  // → As² · fy²/(2·0.85·fc·b) - As·fy·d + Mu/φ = 0
  // → As = (b·d/m) · (1 - √(1 - 2·m·Mn,req/(b·d²·fy)))
  // Use direct quadratic solve:
  const Mu_req_Nmm = L.Mu * 1e6;        // kN·m → N·mm
  const phiUse = 0.90;                   // assume tension-controlled for As_req
  const A_q = fy * fy / (2 * 0.85 * fc * bEff);
  const B_q = -fy * g.d;
  const C_q = Mu_req_Nmm / phiUse;
  const disc = B_q * B_q - 4 * A_q * C_q;
  const AsReq = disc < 0 ? 0 : (-B_q - Math.sqrt(disc)) / (2 * A_q);
  needsDouble = disc < 0;

  // As_min per ACI 318-25 §9.6.1.2 (SI, MPa)
  const AsMin = Math.max(
    1.4 * g.bw * g.d / fy,
    0.25 * Math.sqrt(fc) * g.bw * g.d / fy,
  );

  // As_max for tension-controlled (singly, εt = εty + 0.003)
  // c_max = εcu·d / (εty + 0.003 + εcu) = 0.003·d / (εty + 0.006)
  const cMaxTC = 0.003 * g.d / (epsTy + 0.006);
  const aMaxTC = beta1 * cMaxTC;
  const AsMaxTC = 0.85 * fc * bEff * aMaxTC / fy;

  const ratio = L.Mu / Math.max(phiMn, 1e-9);
  const ok = ratio <= 1 && As >= AsMin;

  const steps: CalcStep[] = [
    {
      title: 'β1 (Whitney stress block factor)',
      formula: 'β1 = 0.85 if fc ≤ 28 MPa; 0.65 if fc ≥ 55; linear between',
      substitution: `fc = ${fc.toFixed(2)} MPa`,
      result: `β1 = ${beta1.toFixed(4)}`,
      ref: ref(code, '22.2.2.4.3'),
    },
    {
      title: 'Provided tension steel area As',
      formula: 'As = Σ count·Ab',
      substitution: r.tension.map((g) => `${g.count}·${barArea(g.bar)}`).join(' + '),
      result: `As = ${As.toFixed(0)} mm²`,
    },
    {
      title: 'Whitney stress-block depth a',
      formula: AsPrime > 0
        ? '(As − Aʹs)·fy = 0.85·fʹc·b·a' + (g.shape !== 'rectangular' ? ' (T-beam: check NA location)' : '')
        : 'a = As·fy / (0.85·fʹc·b)',
      substitution: `a = ${(AsPrime > 0 ? `(${As.toFixed(0)} − ${AsPrime.toFixed(0)})` : As.toFixed(0))}·${fy} / (0.85·${fc}·${bEff.toFixed(0)})`,
      result: `a = ${a.toFixed(2)} mm,  c = a/β1 = ${c.toFixed(2)} mm`,
      ref: ref(code, '22.2.2.4.1'),
    },
    {
      title: 'Net tensile strain εt at extreme tension steel',
      formula: 'εt = 0.003·(d − c) / c',
      substitution: `εt = 0.003·(${g.d} − ${c.toFixed(2)}) / ${c.toFixed(2)}`,
      result: `εt = ${(epsT * 1000).toFixed(3)} ‰  (εty = ${(epsTy * 1000).toFixed(3)} ‰)`,
      ref: ref(code, '22.2.2.1'),
    },
    {
      title: 'Strength reduction factor φ',
      formula: `φ = 0.90 if εt ≥ εty + 0.003 (tension-controlled); 0.65 if εt ≤ εty (compression-controlled); linear in transition`,
      substitution: phiInfo.section,
      result: `φ = ${phiInfo.phi.toFixed(3)}  (${phiInfo.section})`,
      ref: ref(code, '21.2.2'),
    },
    {
      title: 'Nominal moment Mn',
      formula: AsPrime > 0
        ? 'Mn = Cc·(d − a/2) + Cs·(d − dʹ)'
        : (g.shape !== 'rectangular' && g.hf && a > g.hf
          ? 'Mn = Cflange·(d − hf/2) + Cweb·(d − (a+hf)/2)'
          : 'Mn = As·fy·(d − a/2)'),
      substitution: `d = ${g.d}, a = ${a.toFixed(2)}`,
      result: `Mn = ${Mn.toFixed(2)} kN·m`,
      ref: ref(code, '22.2'),
    },
    {
      title: 'Available moment φMn',
      formula: 'φMn = φ · Mn',
      substitution: `${phiInfo.phi.toFixed(3)} · ${Mn.toFixed(2)}`,
      result: `φMn = ${phiMn.toFixed(2)} kN·m`,
    },
    {
      title: 'Required steel As,req for given Mu',
      formula: 'As,req solve quadratic from Mu = φ·As·fy·(d − a/2)',
      substitution: `Mu = ${L.Mu.toFixed(2)} kN·m`,
      result: needsDouble
        ? `Singly-reinforced section INSUFFICIENT — needs compression steel.`
        : `As,req = ${AsReq.toFixed(0)} mm²`,
    },
    {
      title: 'Minimum steel As,min',
      formula: 'As,min = max(1.4·bw·d/fy, 0.25·√fʹc·bw·d/fy)',
      substitution: `max(1.4·${g.bw}·${g.d}/${fy}, 0.25·√${fc}·${g.bw}·${g.d}/${fy})`,
      result: `As,min = ${AsMin.toFixed(0)} mm² ${As >= AsMin ? '✓' : '✗ (As < As,min)'}`,
      ref: ref(code, '9.6.1.2'),
    },
    {
      title: 'Maximum steel for tension-controlled response',
      formula: 'c_max = 0.003·d / (εty + 0.006); As,max = 0.85·fʹc·b·β1·c_max / fy',
      substitution: `c_max = 0.003·${g.d}/(${epsTy.toFixed(4)}+0.006)`,
      result: `As,max(TC) = ${AsMaxTC.toFixed(0)} mm² (informational)`,
    },
    {
      title: 'Demand vs capacity',
      formula: 'Mu / φMn',
      substitution: `${L.Mu.toFixed(2)} / ${phiMn.toFixed(2)}`,
      result: `Ratio = ${ratio.toFixed(3)} ${ratio <= 1 ? '✓' : '✗'}`,
    },
  ];

  return {
    As, a, c, beta1, epsT, epsTy, phi: phiInfo.phi, section: phiInfo.section,
    Mn, phiMn, AsReq, AsMin, AsMaxTC,
    ratio, ok, needsDouble,
    ref: ref(code, '22.2 + 9.5'),
    steps,
  };
}

// ============================================================================
// SHEAR CHECK — ACI 318-25 §22.5 + §9.6.3 + §10.7.6.5
// ============================================================================
function checkShear(input: BeamInput): ShearCheck {
  const { code, geometry: g, materials: m, reinforcement: r, loads: L } = input;
  const fc = m.fc;
  const fyt = m.fyt ?? m.fy;
  const lambdaC = m.lambdaC ?? 1.0;

  // Stirrup area Av (mm²) per spacing
  const Av = r.stirrup.legs * barArea(r.stirrup.bar);

  // Vs per §22.5.10.5.3 (vertical stirrups)
  const s = r.stirrup.spacing;
  const Vs = (Av * fyt * g.d) / (s * 1000);    // N → kN

  // Vs,max per §22.5.1.2:  Vs ≤ 0.66·√fc·bw·d (stop redesign threshold)
  const VsMax = 0.66 * Math.sqrt(fc) * g.bw * g.d / 1000;

  // s_max per §9.7.6.2.2 (along beam length, beam rule):
  //   If Vs ≤ 0.33·√fc·bw·d:   s_max = min(d/2, 600 mm)
  //   else:                     s_max = min(d/4, 300 mm)
  const VsThreshold = 0.33 * Math.sqrt(fc) * g.bw * g.d / 1000;
  const sMax = Vs <= VsThreshold ? Math.min(g.d / 2, 600) : Math.min(g.d / 4, 300);

  // Av,min per §9.6.3.4 (when Vu > 0.5·φ·Vc):
  //  Av,min/s = max(0.062·√fc·bw/fyt, 0.35·bw/fyt)  →  Av,min = max(...) · s
  const AvMin = Math.max(0.062 * Math.sqrt(fc) * g.bw / fyt, 0.35 * g.bw / fyt) * s;

  // Vc per ACI 318-25 Table 22.5.5.1 (no axial load case):
  //   • Av ≥ Av,min     →  eqn (a): Vc = 0.17·λ·√fc·bw·d                (simplified)
  //   • Av < Av,min     →  eqn (c): Vc = 0.66·λs·(ρw)^(1/3)·√fc·bw·d   (size-effect)
  //                       where λs = √(2/(1+d/250)) ≤ 1   (§22.5.5.1.3)
  //                       ρw = As / (bw·d)                              (§22.5.5.1.4)
  //
  // Reason: §22.5.5.1.3 acknowledges size effect for under-reinforced sections.
  // For deep beams (d > 250 mm) without minimum stirrups, the simplified eqn (a)
  // over-predicts shear strength; the size-effect equation gives realistic capacity.
  const meetsAvMin = Av >= AvMin;
  let Vc: number;
  let VcEqLabel: string;
  if (meetsAvMin) {
    Vc = 0.17 * lambdaC * Math.sqrt(fc) * g.bw * g.d / 1000;
    VcEqLabel = 'eqn (a) Vc = 0.17·λ·√fʹc·bw·d  [Av ≥ Av,min]';
  } else {
    // Size-effect factor §22.5.5.1.3
    const lambdaS = Math.min(1, Math.sqrt(2 / (1 + g.d / 250)));
    // Longitudinal-tension reinf ratio §22.5.5.1.4
    const AsTens = sumBarArea(r.tension);
    const rhoW = Math.max(AsTens / (g.bw * g.d), 1e-6);
    Vc = 0.66 * lambdaS * Math.pow(rhoW, 1 / 3) * lambdaC * Math.sqrt(fc) * g.bw * g.d / 1000;
    VcEqLabel = `eqn (c) Vc = 0.66·λs·ρw^(1/3)·λ·√fʹc·bw·d  [Av < Av,min, λs=${lambdaS.toFixed(3)}, ρw=${rhoW.toFixed(4)}]`;
  }

  const Vn = Vc + Vs;
  const phi = 0.75;
  const phiVn = phi * Vn;

  // Required spacing for given Vu
  // φVc + φ·Av·fyt·d/s ≥ Vu  →  s ≤ φ·Av·fyt·d / (Vu − φVc)
  const VuExcess = L.Vu - phi * Vc;
  const sReq = VuExcess > 0 ? (phi * Av * fyt * g.d) / (VuExcess * 1000) : Infinity;

  const stirrupsRequired = L.Vu > 0.5 * phi * Vc;
  const ratio = L.Vu / Math.max(phiVn, 1e-9);
  const ok = ratio <= 1 && Vs <= VsMax && (stirrupsRequired ? Av >= AvMin && s <= sMax : true);

  const steps: CalcStep[] = [
    {
      title: `Concrete shear strength Vc (${meetsAvMin ? 'simplified' : 'size-effect'})`,
      formula: meetsAvMin
        ? 'Vc = 0.17 · λ · √fʹc · bw · d              [Av ≥ Av,min, eqn (a)]'
        : 'Vc = 0.66 · λs · ρw^(1/3) · λ · √fʹc · bw · d   [Av < Av,min, eqn (c)]',
      substitution: meetsAvMin
        ? `Vc = 0.17·${lambdaC}·√${fc}·${g.bw}·${g.d}/1000`
        : VcEqLabel,
      result: `Vc = ${Vc.toFixed(2)} kN`,
      ref: ref(code, '22.5.5.1'),
    },
    {
      title: 'Stirrup area per section Av',
      formula: 'Av = legs · Ab,stirrup',
      substitution: `Av = ${r.stirrup.legs}·${barArea(r.stirrup.bar)}`,
      result: `Av = ${Av.toFixed(0)} mm² @ s = ${s} mm c/c`,
    },
    {
      title: 'Stirrup shear strength Vs',
      formula: 'Vs = Av · fyt · d / s',
      substitution: `Vs = ${Av.toFixed(0)}·${fyt}·${g.d}/${s}/1000`,
      result: `Vs = ${Vs.toFixed(2)} kN`,
      ref: ref(code, '22.5.10.5.3'),
    },
    {
      title: 'Maximum permitted Vs (limit on stirrup shear)',
      formula: 'Vs,max = 0.66·√fʹc·bw·d',
      substitution: `Vs,max = 0.66·√${fc}·${g.bw}·${g.d}/1000`,
      result: `Vs,max = ${VsMax.toFixed(2)} kN ${Vs <= VsMax ? '✓' : '✗ (must increase section)'}`,
      ref: ref(code, '22.5.1.2'),
    },
    {
      title: `Available shear strength φVn (φ = 0.75)`,
      formula: 'φVn = φ · (Vc + Vs)',
      substitution: `φVn = 0.75·(${Vc.toFixed(2)} + ${Vs.toFixed(2)})`,
      result: `φVn = ${phiVn.toFixed(2)} kN`,
    },
    {
      title: 'Maximum stirrup spacing per §9.7.6.2.2',
      formula: 'If Vs ≤ 0.33·√fʹc·bw·d → s,max = min(d/2, 600); else min(d/4, 300)',
      substitution: `Vs = ${Vs.toFixed(2)}, threshold = ${VsThreshold.toFixed(2)} kN`,
      result: `s,max = ${sMax.toFixed(0)} mm  (provided s = ${s} mm ${s <= sMax ? '✓' : '✗'})`,
      ref: ref(code, '9.7.6.2.2'),
    },
    {
      title: 'Minimum stirrup area Av,min',
      formula: 'Av,min = max(0.062·√fʹc·bw/fyt, 0.35·bw/fyt) · s',
      substitution: `s = ${s} mm`,
      result: `Av,min = ${AvMin.toFixed(0)} mm² ${Av >= AvMin ? '✓' : '✗'}`,
      ref: ref(code, '9.6.3.4'),
    },
    {
      title: 'Demand vs capacity',
      formula: 'Vu / φVn',
      substitution: `${L.Vu.toFixed(2)} / ${phiVn.toFixed(2)}`,
      result: `Ratio = ${ratio.toFixed(3)} ${ratio <= 1 ? '✓' : '✗'}`,
    },
  ];

  return {
    Vc, Vs, Vn, phiVn, VsMax, sMax, sReq, Av, AvMin,
    ratio, ok, stirrupsRequired,
    ref: ref(code, '22.5'),
    steps,
  };
}

// ============================================================================
// DEFLECTION CHECK — ACI 318-25 §24.2 (Branson Ie + long-term)
// ============================================================================
function checkDeflection(input: BeamInput, _flexure: FlexureCheck): DeflectionCheck {
  void _flexure;
  const { code, geometry: g, materials: m, reinforcement: r, loads: L } = input;
  const fc = m.fc;
  const Es = m.Es ?? 200000;
  const lambdaC = m.lambdaC ?? 1.0;
  const Ec = computeEc(fc, m.gammaC ?? 24);
  const n = Es / Ec;

  // Provided steel
  const As = sumBarArea(r.tension);
  const AsPrime = sumBarArea(r.compression ?? []);

  // Section properties
  const Ig = gross_Ig(g);
  const Icr = cracked_Icr(g, n, As, AsPrime, g.dPrime ?? 0);
  const fr = computeFr(fc, lambdaC);
  const ytExt = yt(g);
  const Mcr = (fr * Ig / ytExt) / 1e6;     // N·mm → kN·m

  // Service moment
  const Ma = L.Ma ?? L.Mu / 1.5;       // rough estimate if not provided
  // Bischoff effective moment of inertia — ACI 318-25 §24.2.3.5(b)
  // ACI 318-19 replaced the 1965 Branson formula with Bischoff because Branson
  // under-predicted deflection of lightly-reinforced sections (low ρ).
  //   Ma ≤ (2/3)·Mcr     →  Ie = Ig                                     (24.2.3.5a)
  //   Ma > (2/3)·Mcr     →  Ie = Icr / [1 − ((2/3)·Mcr/Ma)² · (1 − Icr/Ig)]   (24.2.3.5b)
  let Ie: number;
  const McrEff = (2 / 3) * Mcr;
  if (Ma <= McrEff) {
    Ie = Ig;
  } else {
    const denom = 1 - Math.pow(McrEff / Ma, 2) * (1 - Icr / Ig);
    Ie = Icr / Math.max(denom, 1e-9);
    Ie = Math.min(Ie, Ig);     // belt-and-suspenders cap (formula already ≤ Ig)
  }

  // Immediate deflection — assume simply-supported uniform load: Δ = 5·M·L²/(48·E·I)
  // (Approximate; coefficients depend on support conditions but most common is SS)
  const L_m = g.L / 1000;       // mm → m
  const deltaI = (5 * (Ma * 1e6) * Math.pow(g.L, 2)) / (48 * Ec * Ie);   // mm

  // Long-term: λΔ = ξ/(1+50·ρ′)
  const rhoComp = AsPrime / (g.bw * g.d);
  const xi = xiFromMonths(L.longTermPeriodMonths ?? 60);
  const lambdaDelta = xi / (1 + 50 * rhoComp);

  // Sustained deflection: only sustained portion
  const psi = L.sustainedLLFraction ?? 0.25;
  const M_DL = L.M_DL ?? Ma * 0.6;      // assume 60% of Ma is DL if not given
  const M_LL = L.M_LL ?? Ma * 0.4;
  const M_sustained = M_DL + psi * M_LL;
  const deltaSustained = (5 * (M_sustained * 1e6) * Math.pow(g.L, 2)) / (48 * Ec * Ie);
  const deltaLt = lambdaDelta * deltaSustained + deltaI * (M_LL / Ma) * (1 - psi);

  // Limit per Tabla 24.2.2
  const cat = L.deflectionLimitCategory ?? 'floor-attached-likely-damage';
  const limitRatio = deflectionLimitRatio(cat);
  const deltaLimit = g.L / limitRatio;

  // Which deflection to check depends on category:
  // L/180, L/360 → immediate from LL only
  // L/240, L/480 → long-term + immediate from LL
  let deltaCheck: number;
  if (cat === 'flat-roof-no-attached' || cat === 'floor-no-attached') {
    deltaCheck = (5 * (M_LL * 1e6) * Math.pow(g.L, 2)) / (48 * Ec * Ie);
  } else {
    deltaCheck = deltaLt;
  }

  const ratio = deltaCheck / Math.max(deltaLimit, 1e-9);
  const ok = ratio <= 1;

  const steps: CalcStep[] = [
    {
      title: 'Modulus of elasticity Ec',
      formula: 'Ec = 4700·√fʹc',
      substitution: `Ec = 4700·√${fc}`,
      result: `Ec = ${Ec.toFixed(0)} MPa,  n = Es/Ec = ${n.toFixed(2)}`,
      ref: ref(code, '19.2.2'),
    },
    {
      title: 'Modulus of rupture fr',
      formula: 'fr = 0.62·λ·√fʹc',
      substitution: `fr = 0.62·${lambdaC}·√${fc}`,
      result: `fr = ${fr.toFixed(3)} MPa`,
      ref: ref(code, '19.2.3.1'),
    },
    {
      title: 'Gross moment of inertia Ig',
      formula: g.shape === 'rectangular' ? 'Ig = b·h³/12' : 'Ig (T-beam) = composite I about centroid',
      substitution: '',
      result: `Ig = ${Ig.toExponential(3)} mm⁴`,
    },
    {
      title: 'Cracked Icr',
      formula: 'Icr = b·kd³/3 + n·As·(d − kd)²',
      substitution: '',
      result: `Icr = ${Icr.toExponential(3)} mm⁴`,
    },
    {
      title: 'Cracking moment Mcr',
      formula: 'Mcr = fr · Ig / yt',
      substitution: `Mcr = ${fr.toFixed(3)}·${Ig.toExponential(2)}/${ytExt.toFixed(0)}`,
      result: `Mcr = ${Mcr.toFixed(2)} kN·m`,
    },
    {
      title: 'Effective Ie (Bischoff §24.2.3.5)',
      formula: 'Ie = Ig if Ma ≤ ⅔·Mcr; else Icr / [1 − (⅔·Mcr/Ma)²·(1 − Icr/Ig)]',
      substitution: `Ma = ${Ma.toFixed(2)} kN·m`,
      result: `Ie = ${Ie.toExponential(3)} mm⁴`,
      ref: ref(code, '24.2.3.5'),
    },
    {
      title: 'Immediate deflection Δi (simply-supported assumption)',
      formula: 'Δi = 5·Ma·L² / (48·Ec·Ie)',
      substitution: `L = ${L_m.toFixed(2)} m`,
      result: `Δi = ${deltaI.toFixed(2)} mm`,
    },
    {
      title: 'Long-term multiplier λΔ',
      formula: 'λΔ = ξ / (1 + 50·ρ′);  ξ from Table 24.2.4.1.3',
      substitution: `ξ = ${xi.toFixed(2)} (period = ${L.longTermPeriodMonths ?? 60} months); ρ′ = ${rhoComp.toFixed(4)}`,
      result: `λΔ = ${lambdaDelta.toFixed(3)}`,
      ref: ref(code, '24.2.4.1.1'),
    },
    {
      title: `Deflection limit (${cat})`,
      formula: `Δ ≤ L / ${limitRatio}`,
      substitution: `Δlimit = ${g.L}/${limitRatio}`,
      result: `Δlimit = ${deltaLimit.toFixed(2)} mm`,
      ref: ref(code, 'Tabla 24.2.2'),
    },
    {
      title: 'Demand vs limit',
      formula: 'Δcheck / Δlimit',
      substitution: `${deltaCheck.toFixed(2)} / ${deltaLimit.toFixed(2)}`,
      result: `Ratio = ${ratio.toFixed(3)} ${ratio <= 1 ? '✓' : '✗'}`,
    },
  ];

  return {
    Ig, Icr, fr, Mcr, Ie, Ec, n, rhoComp, lambdaDelta, xi,
    deltaI, deltaLt, deltaCheck, deltaLimit, deltaLimitRatio: limitRatio,
    limitCategory: cat,
    ratio, ok,
    ref: ref(code, '24.2'),
    steps,
  };
}

// ============================================================================
// CRACK CONTROL — ACI 318-25 §24.3.2 (max bar spacing)
// ============================================================================
function checkCrackControl(input: BeamInput): CrackControlCheck {
  const { code, geometry: g, materials: m, reinforcement: r } = input;
  const fy = m.fy;

  // Service stress fs (per §24.3.2.1, can be calculated; default 2/3·fy)
  const fs = 2 / 3 * fy;        // Conservative default

  // Concrete cover to centre of bar (mm). Stirrup db + tension db/2.
  const dbStirrup = barDiameter(r.stirrup.bar);
  const dbTens = maxBarDiameter(r.tension);
  const cc = g.coverClear + dbStirrup + dbTens / 2;
  // s,max per ACI 318-25 §24.3.2 (SI, MPa, mm):
  //   s ≤ 380·(280/fs) − 2.5·cc
  //   s ≤ 300·(280/fs)
  const sMax1 = 380 * (280 / fs) - 2.5 * (cc - dbTens / 2);  // cc here = clear cover to bar
  const sMax2 = 300 * (280 / fs);
  const sMax = Math.min(sMax1, sMax2);

  // Actual spacing — assume bars distributed evenly across width
  const nBars = sumBarCount(r.tension);
  const usableWidth = g.bw - 2 * (g.coverClear + dbStirrup) - dbTens;
  const s = nBars > 1 ? usableWidth / (nBars - 1) : 0;

  const ratio = s / Math.max(sMax, 1e-9);
  const ok = s <= sMax;

  const steps: CalcStep[] = [
    {
      title: 'Service stress in tension steel fs',
      formula: 'fs = 2/3 · fy (default per §24.3.2.1)',
      substitution: `fs = 2/3·${fy}`,
      result: `fs = ${fs.toFixed(0)} MPa`,
    },
    {
      title: 'Concrete cover to centre of bar cc',
      formula: 'cc = clear cover + db,stirrup + db,tens/2',
      substitution: `cc = ${g.coverClear} + ${dbStirrup} + ${dbTens}/2`,
      result: `cc = ${cc.toFixed(1)} mm`,
    },
    {
      title: 'Maximum bar spacing s,max',
      formula: 's,max = min(380·(280/fs) − 2.5·cc, 300·(280/fs))',
      substitution: `s,max = min(${sMax1.toFixed(0)}, ${sMax2.toFixed(0)})`,
      result: `s,max = ${sMax.toFixed(0)} mm`,
      ref: ref(code, '24.3.2'),
    },
    {
      title: 'Provided bar spacing',
      formula: 's = (bw − 2·(cover + db,stirrup) − db) / (n − 1)',
      substitution: `bars = ${nBars}, usable width = ${usableWidth.toFixed(0)}`,
      result: `s = ${s.toFixed(0)} mm  ${s <= sMax ? '✓' : '✗'}`,
    },
  ];

  return { fs, sMax, s, cc, ratio, ok, ref: ref(code, '24.3.2'), steps };
}

// ============================================================================
// DETAILING — Code-mandated rules (ACI 318-25)
// ============================================================================
//
// Implements the 7 most-critical rules NOT covered by flexure/shear/deflection/crack:
//
//   §20.5.1.3 — Min concrete cover (40 mm typical interior, 50 mm exterior, 75 mm cast-against-ground)
//   §25.2.1   — Min clear bar spacing (max(25, db, 4/3·dagg))
//   §9.7.2.1  — refers to §25.2 for spacing
//   §9.7.2.3  — Skin reinforcement when h > 900 mm
//   §9.7.6.4  — Compression bars need closed stirrups + min stirrup size
//   §25.7.2.2 — Min stirrup bar size (≥#3 for #11 & smaller; ≥#4 for #14, #18)
//   §9.7.6.2.2 — Stirrup leg spacing across width (depends on Vs threshold)
//
// PLUS one practical-engineering rule (universally accepted, not strictly in code):
//   "Hanger bars" — every beam with stirrups needs at least 2 top bars to support the
//   stirrup cage during construction (Wight & MacGregor §5-3, "stirrup support bars").
// ============================================================================

function passItem(label: string, ref: string, en: string, es: string, opts?: Partial<DetailingItem>): DetailingItem {
  return { label, ref, ok: true, noteEn: en, noteEs: es, ...(opts ?? {}) };
}
function failItem(label: string, ref: string, en: string, es: string, opts?: Partial<DetailingItem>): DetailingItem {
  return { label, ref, ok: false, noteEn: en, noteEs: es, ...(opts ?? {}) };
}

function minCoverByExposure(exposure: 'interior' | 'exterior' | 'cast-against-ground'): number {
  // ACI 318-25 §20.5.1.3 — typical primary reinforcement
  switch (exposure) {
    case 'cast-against-ground': return 75;
    case 'exterior': return 50;
    case 'interior':
    default: return 40;
  }
}

export function checkDetailing(input: BeamInput): DetailingCheck {
  const { code, geometry: g, materials: m, reinforcement: r } = input;
  const exposure = m.exposure ?? 'interior';
  const dagg = m.aggSize ?? 19;     // mm — default 3/4"
  const stirDb = barDiameter(r.stirrup.bar);
  const tens = r.tension;
  const comp = r.compression ?? [];

  // Bar dimensions for tension (use largest bar diameter for spacing/fit)
  const dbMaxTens = tens.reduce((d, bg) => Math.max(d, barDiameter(bg.bar)), 0);
  const nBarsTens = tens.reduce((n, bg) => n + bg.count, 0);

  // ============================================================================
  // CHECK 1 — Concrete cover §20.5.1.3
  // ============================================================================
  const minCover = minCoverByExposure(exposure);
  const cover: DetailingItem = g.coverClear >= minCover
    ? passItem(
        `Cover §20.5.1.3 (${exposure})`,
        ref(code, '20.5.1.3'),
        `Clear cover ${g.coverClear} mm ≥ required ${minCover} mm.`,
        `Recubrimiento libre ${g.coverClear} mm ≥ requerido ${minCover} mm.`,
        { required: minCover, provided: g.coverClear })
    : failItem(
        `Cover §20.5.1.3 (${exposure})`,
        ref(code, '20.5.1.3'),
        `Clear cover ${g.coverClear} mm < ${minCover} mm required for ${exposure} exposure. Increase cover.`,
        `Recubrimiento ${g.coverClear} mm < ${minCover} mm requerido para exposición ${exposure}. Aumenta el recubrimiento.`,
        { required: minCover, provided: g.coverClear });

  // ============================================================================
  // CHECK 2 — Bar fit (do tension bars fit in one row?) — Wight Eq 5-25 + §25.2.1
  // ============================================================================
  const sClearMin = Math.max(25, dbMaxTens, (4 / 3) * dagg);
  const bAvailable = g.bw - 2 * g.coverClear - 2 * stirDb;
  // Required width for n bars in one row
  const widthRequired_1row = nBarsTens * dbMaxTens + (nBarsTens - 1) * sClearMin;
  const fitsInOneRow = nBarsTens <= 1 || widthRequired_1row <= bAvailable;
  // Provided clear spacing (if 1 row): (bAvailable - n·db) / (n-1)
  const sClearProvided_1row = nBarsTens > 1 ? (bAvailable - nBarsTens * dbMaxTens) / (nBarsTens - 1) : 1e9;
  const rowsNeeded = nBarsTens <= 1 ? 1 : Math.ceil(widthRequired_1row / Math.max(bAvailable, 1));

  const barFit: DetailingItem = fitsInOneRow
    ? passItem(
        'Bar fit in one row',
        ref(code, '25.2.1') + ' / Wight 5-25',
        `${nBarsTens} bars (db=${dbMaxTens.toFixed(1)} mm) fit in available width ${bAvailable.toFixed(0)} mm; required width ${widthRequired_1row.toFixed(0)} mm.`,
        `${nBarsTens} barras (db=${dbMaxTens.toFixed(1)} mm) caben en el ancho disponible ${bAvailable.toFixed(0)} mm; ancho requerido ${widthRequired_1row.toFixed(0)} mm.`,
        { required: widthRequired_1row, provided: bAvailable })
    : failItem(
        'Bar fit in one row',
        ref(code, '25.2.1') + ' / Wight 5-25',
        `${nBarsTens} bars do not fit in one row: required ${widthRequired_1row.toFixed(0)} mm > available ${bAvailable.toFixed(0)} mm. Use multiple rows (${rowsNeeded} rows) or widen the beam.`,
        `${nBarsTens} barras no caben en una fila: requerido ${widthRequired_1row.toFixed(0)} mm > disponible ${bAvailable.toFixed(0)} mm. Usa varias capas (${rowsNeeded}) o ensancha la viga.`,
        { required: widthRequired_1row, provided: bAvailable });

  // ============================================================================
  // CHECK 3 — Min clear bar spacing §25.2.1
  // ============================================================================
  const barSpacing: DetailingItem = !fitsInOneRow
    ? passItem(
        'Bar clear spacing §25.2.1',
        ref(code, '25.2.1'),
        `Bars in multiple rows — vertical spacing handled by §25.2.2.`,
        `Barras en varias capas — espaciamiento vertical regido por §25.2.2.`,
        { informational: true })
    : sClearProvided_1row >= sClearMin || nBarsTens <= 1
      ? passItem(
          'Bar clear spacing §25.2.1',
          ref(code, '25.2.1'),
          `Provided clear spacing ${sClearProvided_1row.toFixed(0)} mm ≥ required ${sClearMin.toFixed(0)} mm (max of 25, db=${dbMaxTens.toFixed(1)}, 4/3·dagg=${((4/3)*dagg).toFixed(1)}).`,
          `Espaciamiento libre ${sClearProvided_1row.toFixed(0)} mm ≥ requerido ${sClearMin.toFixed(0)} mm (máx de 25, db=${dbMaxTens.toFixed(1)}, 4/3·dagg=${((4/3)*dagg).toFixed(1)}).`,
          { required: sClearMin, provided: sClearProvided_1row })
      : failItem(
          'Bar clear spacing §25.2.1',
          ref(code, '25.2.1'),
          `Provided clear spacing ${sClearProvided_1row.toFixed(0)} mm < required ${sClearMin.toFixed(0)} mm. Use fewer/smaller bars or widen.`,
          `Espaciamiento ${sClearProvided_1row.toFixed(0)} mm < requerido ${sClearMin.toFixed(0)} mm. Usa menos barras / más finas, o ensancha.`,
          { required: sClearMin, provided: sClearProvided_1row });

  // ============================================================================
  // CHECK 4 — Hanger bars (practical) — at least 2 top bars to support stirrups
  // ============================================================================
  const nTopBars = comp.reduce((n, bg) => n + bg.count, 0);
  const hangerBars: DetailingItem = nTopBars >= 2
    ? passItem(
        'Stirrup-support bars (practical)',
        'Wight & MacGregor §5-3',
        `${nTopBars} top bars provide stirrup support during construction.`,
        `${nTopBars} barras superiores sostienen los estribos durante la construcción.`,
        { provided: nTopBars, required: 2 })
    : failItem(
        'Stirrup-support bars (practical)',
        'Wight & MacGregor §5-3',
        `Only ${nTopBars} top bar(s). Add at least 2 small top bars (e.g. 2#4) to hold the stirrup cage. Required even when no compression steel is needed for flexure.`,
        `Solo ${nTopBars} barra(s) superior(es). Agrega al menos 2 barras superiores (p.ej. 2#4) para sostener los estribos. Requerido aunque no se necesite acero a compresión por flexión.`,
        { provided: nTopBars, required: 2 });

  // ============================================================================
  // CHECK 5 — Skin reinforcement §9.7.2.3 (h > 900 mm)
  // ============================================================================
  const needsSkin = g.h > 900;
  const skinBarsPerFace = r.skin?.countPerFace ?? 0;
  const skinReinf: DetailingItem = !needsSkin
    ? passItem(
        'Skin reinforcement §9.7.2.3',
        ref(code, '9.7.2.3'),
        `h = ${g.h} mm ≤ 900 mm — skin reinforcement not required.`,
        `h = ${g.h} mm ≤ 900 mm — no se requiere armadura de piel.`,
        { informational: true })
    : skinBarsPerFace >= 2
      ? passItem(
          'Skin reinforcement §9.7.2.3',
          ref(code, '9.7.2.3'),
          `h = ${g.h} mm > 900 mm — ${skinBarsPerFace} skin bars per face provided over h/2 from tension face.`,
          `h = ${g.h} mm > 900 mm — ${skinBarsPerFace} barras de piel por cara distribuidas sobre h/2 desde la cara traccionada.`,
          { provided: skinBarsPerFace, required: 2 })
      : failItem(
          'Skin reinforcement §9.7.2.3',
          ref(code, '9.7.2.3'),
          `h = ${g.h} mm > 900 mm. Skin reinforcement REQUIRED on both side faces over h/2 from tension face. Spacing ≤ s per §24.3.2. Bars #10–#16 typical.`,
          `h = ${g.h} mm > 900 mm. Se REQUIERE armadura de piel en ambas caras laterales sobre h/2 desde la cara traccionada. Espaciamiento ≤ s por §24.3.2. Barras #10–#16 típicas.`,
          { provided: skinBarsPerFace, required: 2 });

  // ============================================================================
  // CHECK 6 — Min stirrup bar size §25.7.2.2 / §9.7.6.4.2
  // ACI: stirrup ≥ No. 10 (10 mm) when longitudinal db ≤ 32 mm; ≥ No. 13 (13 mm)
  // when longitudinal db > 32 mm. (ASTM equivalents: ≥ #3 for ≤ #11, ≥ #4 for ≥ #14.)
  // Threshold = 36 mm to catch metric M40 (39.9 mm) longitudinal bars too.
  // ============================================================================
  const needsLarger = dbMaxTens >= 36;     // > 32 mm long bar → ≥ No. 13 / #4 stirrup
  const minStirDb = needsLarger ? 12.7 : 9.5;
  const minStirLabel = needsLarger ? '#4 / No. 13 (≥ 12.7 mm)' : '#3 / No. 10 (≥ 9.5 mm)';
  const stirrupSize: DetailingItem = stirDb >= minStirDb
    ? passItem(
        'Stirrup min size §25.7.2.2',
        ref(code, '25.7.2.2'),
        `Stirrup ${r.stirrup.bar} (db=${stirDb.toFixed(1)} mm) ≥ required ${minStirLabel} for longitudinal db=${dbMaxTens.toFixed(1)} mm.`,
        `Estribo ${r.stirrup.bar} (db=${stirDb.toFixed(1)} mm) ≥ requerido ${minStirLabel} para barra longitudinal db=${dbMaxTens.toFixed(1)} mm.`,
        { provided: stirDb, required: minStirDb })
    : failItem(
        'Stirrup min size §25.7.2.2',
        ref(code, '25.7.2.2'),
        `Stirrup ${r.stirrup.bar} too small. Use at least ${minStirLabel} for longitudinal bars db=${dbMaxTens.toFixed(1)} mm.`,
        `Estribo ${r.stirrup.bar} demasiado pequeño. Usa al menos ${minStirLabel} para barras longitudinales db=${dbMaxTens.toFixed(1)} mm.`,
        { provided: stirDb, required: minStirDb });

  // ============================================================================
  // CHECK 7 — Stirrup leg spacing across width §9.7.6.2.2
  // ============================================================================
  // For Vs ≤ 0.33·√fc·bw·d: max across-width = lesser(d, 600)
  // For Vs > 0.33·√fc·bw·d: max across-width = lesser(d/2, 300)
  // Across-width spacing for n legs: (bw - 2·cover - 2·dbs - dbs)/(n-1) when legs > 1
  // For 2 legs the inner span is just bw - 2·cover - 2·dbs (one inter-leg distance).
  const lambdaCfac = m.lambdaC ?? 1.0;
  const VsPerStirrup = (() => {
    // Use the worst-case Vs from the input.loads.Vu if computed, else estimate using s,max
    const Vc = 0.17 * lambdaCfac * Math.sqrt(m.fc) * g.bw * g.d / 1000;
    const phi = 0.75;
    const VsRequired = Math.max(0, input.loads.Vu / phi - Vc);
    return VsRequired;
  })();
  const VsThresh = 0.33 * Math.sqrt(m.fc) * g.bw * g.d / 1000;
  const heavyShear = VsPerStirrup > VsThresh;
  const sLegMax = heavyShear ? Math.min(g.d / 2, 300) : Math.min(g.d, 600);
  const innerSpan = g.bw - 2 * g.coverClear - 2 * stirDb;     // mm
  const sLegProvided = r.stirrup.legs <= 1 ? innerSpan : innerSpan / Math.max(r.stirrup.legs - 1, 1);
  const stirrupLegSpacing: DetailingItem = sLegProvided <= sLegMax
    ? passItem(
        'Stirrup leg spacing across width §9.7.6.2.2',
        ref(code, '9.7.6.2.2'),
        `Across-width leg spacing ${sLegProvided.toFixed(0)} mm ≤ limit ${sLegMax.toFixed(0)} mm (${heavyShear ? 'high Vs' : 'low Vs'}).`,
        `Espaciamiento transversal entre ramas ${sLegProvided.toFixed(0)} mm ≤ límite ${sLegMax.toFixed(0)} mm (${heavyShear ? 'Vs alto' : 'Vs bajo'}).`,
        { provided: sLegProvided, required: sLegMax })
    : failItem(
        'Stirrup leg spacing across width §9.7.6.2.2',
        ref(code, '9.7.6.2.2'),
        `Across-width leg spacing ${sLegProvided.toFixed(0)} mm > limit ${sLegMax.toFixed(0)} mm. Add additional stirrup legs (use 3 or 4 legs) for wide beams.`,
        `Espaciamiento transversal entre ramas ${sLegProvided.toFixed(0)} mm > límite ${sLegMax.toFixed(0)} mm. Agrega ramas adicionales (3 o 4) en vigas anchas.`,
        { provided: sLegProvided, required: sLegMax });

  // ============================================================================
  // CHECK 8 — Lateral support of compression reinforcement §9.7.6.4
  // ============================================================================
  // §9.7.6.4.2: stirrup size ≥ §25.7.2.2 minimum (handled in CHECK 6).
  // §9.7.6.4.3: stirrup spacing for lateral support of compression bars
  //   ≤ least of:  (a) 16·db,longit
  //                (b) 48·db,stirrup
  //                (c) least dimension of beam (= min(bw, h))
  // §9.7.6.4.4: every corner and alternate compression bar must be enclosed.
  // (Implicitly satisfied by 2-leg closed stirrups when compression bars are at corners.)
  const hasComp = nTopBars > 0;
  const compMinStirDb = hasComp ? minStirDb : 0;
  const dbCompMax = comp.reduce((d, bg) => Math.max(d, barDiameter(bg.bar)), 0);
  const sCompLimit = hasComp ? Math.min(16 * dbCompMax, 48 * stirDb, Math.min(g.bw, g.h)) : Infinity;
  const sStirrupProvided = r.stirrup.spacing;
  const sizeOk = stirDb >= compMinStirDb;
  const spacingOk = sStirrupProvided <= sCompLimit;
  const compressionLateral: DetailingItem = !hasComp
    ? passItem(
        'Compression bar lateral support §9.7.6.4',
        ref(code, '9.7.6.4'),
        `No compression bars → no lateral-support requirement.`,
        `Sin barras de compresión → no aplica el soporte lateral.`,
        { informational: true })
    : sizeOk && spacingOk
      ? passItem(
          'Compression bar lateral support §9.7.6.4',
          ref(code, '9.7.6.4'),
          `Closed stirrups ${r.stirrup.bar} @ ${sStirrupProvided} mm — size ≥ §25.7.2.2 (${minStirLabel}); spacing ≤ ${sCompLimit.toFixed(0)} mm (min of 16·db,L=${(16 * dbCompMax).toFixed(0)}, 48·db,S=${(48 * stirDb).toFixed(0)}, b/h_min=${Math.min(g.bw, g.h).toFixed(0)}).`,
          `Estribos cerrados ${r.stirrup.bar} @ ${sStirrupProvided} mm — tamaño ≥ §25.7.2.2 (${minStirLabel}); espaciamiento ≤ ${sCompLimit.toFixed(0)} mm (mín de 16·db,L, 48·db,S, b/h_mín).`,
          { provided: sStirrupProvided, required: sCompLimit })
      : !sizeOk
        ? failItem(
            'Compression bar lateral support §9.7.6.4',
            ref(code, '9.7.6.4'),
            `Stirrup size insufficient to laterally support compression bars. Increase stirrup bar to ≥ ${minStirLabel}.`,
            `Tamaño del estribo insuficiente. Aumenta a ≥ ${minStirLabel}.`,
            { provided: stirDb, required: compMinStirDb })
        : failItem(
            'Compression bar lateral support §9.7.6.4.3',
            ref(code, '9.7.6.4.3'),
            `Stirrup spacing ${sStirrupProvided} mm > limit ${sCompLimit.toFixed(0)} mm (min of 16·db,L=${(16 * dbCompMax).toFixed(0)}, 48·db,S=${(48 * stirDb).toFixed(0)}, b/h_min=${Math.min(g.bw, g.h).toFixed(0)}). Reduce stirrup spacing.`,
            `Espaciamiento ${sStirrupProvided} mm > límite ${sCompLimit.toFixed(0)} mm (mín de 16·db,L=${(16 * dbCompMax).toFixed(0)}, 48·db,S=${(48 * stirDb).toFixed(0)}, b/h_mín=${Math.min(g.bw, g.h).toFixed(0)}). Reduce el espaciamiento.`,
            { provided: sStirrupProvided, required: sCompLimit });

  // ============================================================================
  // Aggregate
  // ============================================================================
  const items: DetailingItem[] = [
    cover, barFit, barSpacing, hangerBars, skinReinf, stirrupSize, stirrupLegSpacing, compressionLateral,
  ];
  // Aggregate ok ignores informational items
  const ok = items.filter((i) => !i.informational).every((i) => i.ok);
  const failing = items.filter((i) => !i.ok && !i.informational);

  const narrativeEn = ok
    ? `Detailing OK — all ${items.length} code-mandated checks pass.`
    : `Detailing issues: ${failing.length} of ${items.length} checks fail (${failing.map((i) => i.label).join(', ')}).`;
  const narrativeEs = ok
    ? `Detallado OK — los ${items.length} chequeos del código cumplen.`
    : `Problemas de detallado: ${failing.length} de ${items.length} chequeos no cumplen (${failing.map((i) => i.label).join(', ')}).`;

  return {
    cover, barFit, barSpacing, hangerBars, skinReinf, stirrupSize, stirrupLegSpacing, compressionLateral,
    ok, narrativeEn, narrativeEs,
  };
}

// ============================================================================
// ENVELOPE — multi-section design along beam length
// ============================================================================
//
// Phase 1 scope:
//   • Demand sources:
//       - 'simply-supported': closed-form Mu(x), Vu(x) from UDL + N point loads
//       - 'manual':           user provides (x, Mu, Vu) tuples
//   • Reinforcement is constant along the length (no curtailment yet — Phase 3)
//   • For each station, run flexure + shear checks independently and aggregate.
//   • Report governing failure with Wight & MacGregor §8-7 conventions
//     (capacity envelope φMn(x), φVn(x) must envelop demand Mu(x), Vu(x)).
//
// Sign convention:
//   x        mm  measured from left support
//   wu       kN/m positive downward
//   Pu       kN  positive downward
//   Mu(x)    kN·m positive = tension at bottom (sagging)
//   Vu(x)    kN  envelope reported as |V(x)| (max-magnitude)
//
// Reference: ACI 318-25 §9.4.3 (factored loads), §22 (sectional strength),
//            Wight & MacGregor Fig 8-19g (moment-strength vs required moment).
// ============================================================================

/** Internal: simply-supported beam reactions and (M, V) at a station. */
function ssDemand(
  L_mm: number,
  wu: number,
  point: { x: number; Pu: number }[],
  x_mm: number
): { Mu: number; Vu: number } {
  const L = L_mm / 1000;       // m
  const x = x_mm / 1000;       // m
  // Reactions (L is span between supports)
  const wL = wu * L;
  const sumP = point.reduce((s, p) => s + p.Pu, 0);
  const momentAboutA = wu * L * L / 2 + point.reduce((s, p) => s + p.Pu * (p.x / 1000), 0);
  const RB = momentAboutA / L;
  const RA = wL + sumP - RB;
  // Shear at x (just to the right of x): V(x) = RA - wu·x - Σ Pu_i (where x_i < x)
  // We use ≤ to include loads exactly at x in the "left" portion.
  const V_right = RA - wu * x - point.reduce((s, p) => s + (p.x / 1000 < x ? p.Pu : 0), 0);
  // Moment at x: M(x) = RA·x - wu·x²/2 - Σ Pu_i·(x - x_i_m) (where x_i ≤ x)
  const M = RA * x - wu * x * x / 2
    - point.reduce((s, p) => {
        const xi = p.x / 1000;
        return s + (xi <= x ? p.Pu * (x - xi) : 0);
      }, 0);
  return { Mu: M, Vu: Math.abs(V_right) };
}

/** Resolve demand into N station tuples (x_mm, Mu, Vu). */
export function resolveStations(
  demand: DemandSource,
  L_mm: number
): { x: number; Mu: number; Vu: number }[] {
  if (demand.kind === 'manual') {
    // Sort by x just in case
    return [...demand.stations].sort((a, b) => a.x - b.x).map((s) => ({
      x: s.x, Mu: s.Mu, Vu: s.Vu,
    }));
  }
  // simply-supported
  const N = demand.nStations ?? 21;
  const wu = demand.udl?.wu ?? 0;
  const points = demand.point;
  const out: { x: number; Mu: number; Vu: number }[] = [];
  for (let i = 0; i < N; i++) {
    const x = (i / (N - 1)) * L_mm;
    const { Mu, Vu } = ssDemand(L_mm, wu, points, x);
    out.push({ x, Mu, Vu });
  }
  // Also inject point-load locations explicitly so the diagram captures them.
  for (const p of points) {
    if (p.x > 0 && p.x < L_mm) {
      const { Mu, Vu } = ssDemand(L_mm, wu, points, p.x);
      out.push({ x: p.x, Mu, Vu });
    }
  }
  out.sort((a, b) => a.x - b.x);
  return out;
}

/** Build a shadow BeamInput with a station's demand for re-using checkFlexure/checkShear. */
function shadowSingleSection(input: BeamEnvelopeInput, Mu: number, Vu: number): BeamInput {
  return {
    code: input.code,
    method: input.method,
    geometry: input.geometry,
    materials: input.materials,
    reinforcement: input.reinforcement,
    loads: { ...input.loads, Mu: Math.abs(Mu), Vu: Math.abs(Vu) },
    branding: input.branding,
  };
}

/** Build governing-failure narrative considering flexure, shear, deflection, and crack. */
function governingFromStations(
  stations: StationResult[],
  flexureWorst: FlexureCheck,
  shearWorst: ShearCheck,
  deflection: DeflectionCheck,
  crack: CrackControlCheck,
  L_mm: number
): GoverningFailure {
  if (stations.length === 0) {
    return {
      kind: 'none', x: 0, demand: 0, capacity: 0, ratio: 0,
      narrativeEn: 'No stations resolved.',
      narrativeEs: 'Sin estaciones resueltas.',
    };
  }
  const worstFlex = stations.reduce((a, b) => (b.flexureRatio > a.flexureRatio ? b : a));
  const worstShr = stations.reduce((a, b) => (b.shearRatio > a.shearRatio ? b : a));

  // Build the four candidate governing checks
  type Cand = {
    kind: 'flexure' | 'shear' | 'deflection' | 'crack';
    ratio: number; x: number; demand: number; capacity: number;
    nameEn: string; nameEs: string;
    demandLabel: string; capacityLabel: string;
    unit: string;
    actionEn?: string; actionEs?: string;
  };
  const cands: Cand[] = [
    {
      kind: 'flexure',
      ratio: worstFlex.flexureRatio, x: worstFlex.x,
      demand: worstFlex.Mu, capacity: worstFlex.phiMn,
      nameEn: 'flexure', nameEs: 'flexión',
      demandLabel: 'Mu', capacityLabel: 'φMn', unit: 'kN·m',
      actionEn: flexureWorst.needsDouble
        ? 'Add compression steel (doubly reinforced) OR increase d / b.'
        : 'Add tension bars OR increase d.',
      actionEs: flexureWorst.needsDouble
        ? 'Agrega acero de compresión (doblemente reforzada) O aumenta d / b.'
        : 'Agrega barras de tracción O aumenta d.',
    },
    {
      kind: 'shear',
      ratio: worstShr.shearRatio, x: worstShr.x,
      demand: worstShr.Vu, capacity: worstShr.phiVn,
      nameEn: 'shear', nameEs: 'corte',
      demandLabel: 'Vu', capacityLabel: 'φVn', unit: 'kN',
      actionEn: shearWorst.Vs > shearWorst.VsMax
        ? 'Vs exceeds Vs,max → enlarge bw or h.'
        : 'Reduce stirrup spacing OR add legs.',
      actionEs: shearWorst.Vs > shearWorst.VsMax
        ? 'Vs supera Vs,máx → aumenta bw o h.'
        : 'Reduce el espaciamiento de estribos O añade ramas.',
    },
    {
      kind: 'deflection',
      ratio: deflection.ratio, x: L_mm / 2,
      demand: deflection.deltaCheck, capacity: deflection.deltaLimit,
      nameEn: 'deflection', nameEs: 'deflexión',
      demandLabel: 'Δ', capacityLabel: `L/${deflection.deltaLimitRatio}`, unit: 'mm',
      actionEn: 'Increase h (depth) — deflection scales as h³. OR raise the limit category if non-structural elements aren\'t attached.',
      actionEs: 'Aumenta h (peralte) — la deflexión escala con h³. O cambia la categoría de límite si no hay elementos no-estructurales adheridos.',
    },
    {
      kind: 'crack',
      ratio: crack.ratio, x: L_mm / 2,
      demand: crack.s, capacity: crack.sMax,
      nameEn: 'crack control', nameEs: 'fisuración',
      demandLabel: 's_actual', capacityLabel: 's_max', unit: 'mm',
      actionEn: 'Reduce bar spacing (use more, smaller bars) OR increase fy / cover per §24.3.2.',
      actionEs: 'Reduce el espaciamiento (usa más barras más finas) O cambia fy / recubrimiento por §24.3.2.',
    },
  ];

  // Pick the candidate with the highest ratio
  const gov = cands.reduce((a, b) => (b.ratio > a.ratio ? b : a));
  const fails = gov.ratio > 1;
  const overpct = (gov.ratio - 1) * 100;
  const xKm = (gov.x / 1000).toFixed(2);

  return {
    kind: gov.kind,
    x: gov.x,
    demand: gov.demand,
    capacity: gov.capacity,
    ratio: gov.ratio,
    narrativeEn: fails
      ? `Beam FAILS — ${gov.nameEn} deficit at x=${xKm} m: ${gov.demandLabel}=${gov.demand.toFixed(2)} ${gov.unit} > ${gov.capacityLabel}=${gov.capacity.toFixed(2)} ${gov.unit} (+${overpct.toFixed(1)}%).`
      : `Beam passes — governing ${gov.nameEn} at x=${xKm} m, utilization ${(gov.ratio * 100).toFixed(1)}%.`,
    narrativeEs: fails
      ? `Viga NO CUMPLE — déficit de ${gov.nameEs} en x=${xKm} m: ${gov.demandLabel}=${gov.demand.toFixed(2)} ${gov.unit} > ${gov.capacityLabel}=${gov.capacity.toFixed(2)} ${gov.unit} (+${overpct.toFixed(1)}%).`
      : `Viga cumple — ${gov.nameEs} gobernante en x=${xKm} m, utilización ${(gov.ratio * 100).toFixed(1)}%.`,
    actionEn: fails ? gov.actionEn : undefined,
    actionEs: fails ? gov.actionEs : undefined,
  };
}

/** Multi-section envelope analysis. */
export function analyzeEnvelope(input: BeamEnvelopeInput): EnvelopeAnalysis {
  const warnings: string[] = [];
  try {
    // 1. Resolve demand stations
    const stations0 = resolveStations(input.demand, input.geometry.L);

    // 2. For each station, compute capacity (constant for now — same reinforcement everywhere)
    //    Optimization: capacity is the same at every station with constant rebar, so we compute once
    //    using checkFlexure/checkShear with that station's Mu/Vu (only ratio differs).
    const stations: StationResult[] = stations0.map((stn) => {
      const shadow = shadowSingleSection(input, stn.Mu, stn.Vu);
      const flex = checkFlexure(shadow);
      const shr = checkShear(shadow);
      return {
        x: stn.x,
        Mu: stn.Mu,
        Vu: stn.Vu,
        phiMn: flex.phiMn,
        phiVn: shr.phiVn,
        flexureRatio: flex.ratio,
        shearRatio: shr.ratio,
        ok: flex.ok && shr.ok,
      };
    });

    const maxFlexureRatio = stations.reduce((m, s) => Math.max(m, s.flexureRatio), 0);
    const maxShearRatio = stations.reduce((m, s) => Math.max(m, s.shearRatio), 0);

    // 3. Re-run full checks at the worst stations to populate FlexureCheck/ShearCheck objects
    const worstFlexStn = stations.reduce((a, b) => (b.flexureRatio > a.flexureRatio ? b : a), stations[0]);
    const worstShrStn = stations.reduce((a, b) => (b.shearRatio > a.shearRatio ? b : a), stations[0]);
    const flexureWorst = checkFlexure(shadowSingleSection(input, worstFlexStn.Mu, worstFlexStn.Vu));
    const shearWorst = checkShear(shadowSingleSection(input, worstShrStn.Mu, worstShrStn.Vu));

    // 4. Deflection + crack: single-point semantics (use Loads.Ma at midspan for simply-supported,
    //    or whatever the user provided in input.loads.Ma).
    const shadowDeflInput: BeamInput = {
      code: input.code, method: input.method,
      geometry: input.geometry, materials: input.materials, reinforcement: input.reinforcement,
      loads: { ...input.loads, Mu: worstFlexStn.Mu, Vu: worstShrStn.Vu },
    };
    const deflection = checkDeflection(shadowDeflInput, flexureWorst);
    const crack = checkCrackControl(shadowDeflInput);
    const detailing = checkDetailing(shadowDeflInput);

    const selfWeight = (input.materials.gammaC ?? 24) * sectionArea(input.geometry) * 1e-6;

    if (flexureWorst.section === 'compression-controlled') {
      warnings.push('Worst flexure station is compression-controlled — increase d, b, or use compression steel.');
    }
    if (flexureWorst.needsDouble) {
      warnings.push('Worst-station Mu exceeds singly-reinforced capacity — add compression steel.');
    }
    if (shearWorst.stirrupsRequired && shearWorst.AvMin > shearWorst.Av) {
      warnings.push(`Provided Av = ${shearWorst.Av.toFixed(0)} mm² < Av,min = ${shearWorst.AvMin.toFixed(0)} mm² — increase stirrup size or decrease spacing.`);
    }

    const ok = stations.every((s) => s.ok) && deflection.ok && crack.ok && detailing.ok;
    const governing = governingFromStations(stations, flexureWorst, shearWorst, deflection, crack, input.geometry.L);

    // Phase 3: stirrup zoning + bar curtailment + dev lengths
    let elevation: ReturnType<typeof buildElevationData> | undefined;
    try {
      // Build a partial EnvelopeAnalysis just enough for buildElevationData (it only reads stations + ratios)
      const partial = {
        input, stations, maxFlexureRatio, maxShearRatio,
        governing, flexureWorst, shearWorst, deflection, crack, detailing,
        selfWeight, sectionType: input.geometry.shape, warnings, ok, solved: true,
      } as EnvelopeAnalysis;
      elevation = buildElevationData(partial, input, flexureWorst);
    } catch (e) {
      warnings.push(`Phase 3 elevation calc skipped: ${e instanceof Error ? e.message : String(e)}`);
    }

    return {
      input,
      stations,
      maxFlexureRatio,
      maxShearRatio,
      governing,
      flexureWorst,
      shearWorst,
      deflection,
      crack,
      detailing,
      elevation,
      selfWeight,
      sectionType: input.geometry.shape,
      warnings,
      ok,
      solved: true,
    };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return {
      input,
      stations: [],
      maxFlexureRatio: 0,
      maxShearRatio: 0,
      governing: {
        kind: 'none', x: 0, demand: 0, capacity: 0, ratio: 0,
        narrativeEn: `Solver error: ${msg}`,
        narrativeEs: `Error del solver: ${msg}`,
      },
      flexureWorst: emptyFlexure(),
      shearWorst: emptyShear(),
      deflection: emptyDeflection({
        code: input.code, method: input.method, geometry: input.geometry,
        materials: input.materials, reinforcement: input.reinforcement,
        loads: input.loads,
      } as BeamInput),
      crack: emptyCrack(),
      detailing: emptyDetailing(),
      selfWeight: 0,
      sectionType: input.geometry.shape,
      warnings: [`Solver error: ${msg}`],
      ok: false,
      solved: false,
    };
  }
}

// ============================================================================
// EMPTY OUTPUT (for error cases)
// ============================================================================
function emptyFlexure(): FlexureCheck {
  return {
    As: 0, a: 0, c: 0, beta1: 0.85, epsT: 0, epsTy: 0, phi: 0,
    section: 'compression-controlled',
    Mn: 0, phiMn: 0, AsReq: 0, AsMin: 0, AsMaxTC: 0,
    ratio: 0, ok: false, needsDouble: false,
    ref: '', steps: [],
  };
}
function emptyShear(): ShearCheck {
  return {
    Vc: 0, Vs: 0, Vn: 0, phiVn: 0, VsMax: 0, sMax: 0, sReq: 0,
    Av: 0, AvMin: 0, ratio: 0, ok: false, stirrupsRequired: false,
    ref: '', steps: [],
  };
}
function emptyDeflection(input: BeamInput): DeflectionCheck {
  return {
    Ig: 0, Icr: 0, fr: 0, Mcr: 0, Ie: 0, Ec: 0, n: 0, rhoComp: 0,
    lambdaDelta: 0, xi: 0, deltaI: 0, deltaLt: 0, deltaCheck: 0,
    deltaLimit: input.geometry.L / 360, deltaLimitRatio: 360,
    limitCategory: 'floor-attached-likely-damage',
    ratio: 0, ok: false, ref: '', steps: [],
  };
}
function emptyCrack(): CrackControlCheck {
  return { fs: 0, sMax: 0, s: 0, cc: 0, ratio: 0, ok: false, ref: '', steps: [] };
}
function emptyDetailing(): DetailingCheck {
  const empty: DetailingItem = { label: '', ref: '', ok: false, noteEn: '', noteEs: '' };
  return {
    cover: empty, barFit: empty, barSpacing: empty, hangerBars: empty,
    skinReinf: empty, stirrupSize: empty, stirrupLegSpacing: empty, compressionLateral: empty,
    ok: false, narrativeEn: '', narrativeEs: '',
  };
}
