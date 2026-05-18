export type UnitSystem = 'metric' | 'imperial';

export type Quantity =
  | 'length'
  | 'position'
  | 'force'
  | 'distLoad'
  | 'moment'
  | 'deflection'
  | 'E'
  | 'I'
  | 'A'
  | 'density'
  | 'dimension'
  | 'sectionModulus'
  | 'massPerLength'
  | 'stress'
  | 'torsion'
  | 'warping'
  | 'pressure'         // kPa ↔ ksf (geotechnical bearing/stress)
  | 'unitWeight'       // kN/m³ ↔ pcf (soil/concrete unit weight)
  | 'areaPerLength'    // mm²/m ↔ in²/ft (rebar area per unit length)
  | 'forcePerLength'   // kN/m ↔ klf (per-meter line load/force)
  | 'momentPerLength'  // kN·m/m ↔ kip·ft/ft (per-meter wall moment)
  | 'velocity'         // m/s ↔ mph (wind speed)
  | 'pressureSmall';   // Pa ↔ psf (wind/cladding pressures — much smaller than geotech)

// SI (metric) is the canonical internal representation for every value in BeamModel.
// Factor = value-in-SI per unit-of-imperial.  value_SI = value_imperial * factor.
const FT_TO_M = 0.3048;
const KIP_TO_KN = 4.4482216152605;
const KIPFT_TO_KNM = 1.3558179483314;
const IN_TO_MM = 25.4;
const KSI_TO_MPA = 6.8947572931783;
const IN4_TO_MM4 = 416231.42588;
const IN2_TO_MM2 = 645.16;
const IN3_TO_MM3 = 16387.064;
const IN6_TO_MM6 = IN_TO_MM ** 6;
const PCF_TO_KGM3 = 16.0184633739601;
// 1 lb/ft = 0.45359237 kg / 0.3048 m = 1.48816394358... kg/m
const LBPERFT_TO_KGPERM = 0.45359237 / FT_TO_M;
// Distributed load: 1 kip/ft = (kip/ft) → kN/m.  kN/m = kip * 4.4482 / 0.3048.
const KIPPERFT_TO_KNM = KIP_TO_KN / FT_TO_M;

// Pressure: 1 ksf (kip/ft²) = 4.4482 kN / 0.0929 m² = 47.88 kPa
const KSF_TO_KPA = KIP_TO_KN / (FT_TO_M * FT_TO_M);
// Unit weight: 1 pcf (lb/ft³) = 0.004448 kN / (0.3048³ m³) = 0.1571 kN/m³
const PCF_TO_KNM3 = (0.00444822161526) / (FT_TO_M ** 3);
// Rebar area per width: 1 in²/ft = 645.16 mm² / 0.3048 m = 2116.73 mm²/m
const IN2_PER_FT_TO_MM2_PER_M = IN2_TO_MM2 / FT_TO_M;
// Velocity: 1 mph = 0.44704 m/s (wind speed)
const MPH_TO_MS = 0.44704;
// Small pressure: 1 psf = 47.88 Pa (wind / cladding); kept in Pa in SI
const PSF_TO_PA = (0.00444822161526 * 1000) / (FT_TO_M * FT_TO_M);

const TO_SI_FACTOR: Record<Quantity, Record<UnitSystem, number>> = {
  length: { metric: 1, imperial: FT_TO_M },
  position: { metric: 1, imperial: FT_TO_M },
  force: { metric: 1, imperial: KIP_TO_KN },
  distLoad: { metric: 1, imperial: KIPPERFT_TO_KNM },
  moment: { metric: 1, imperial: KIPFT_TO_KNM },
  deflection: { metric: 1, imperial: IN_TO_MM },
  E: { metric: 1, imperial: KSI_TO_MPA },
  I: { metric: 1, imperial: IN4_TO_MM4 },
  A: { metric: 1, imperial: IN2_TO_MM2 },
  density: { metric: 1, imperial: PCF_TO_KGM3 },
  dimension: { metric: 1, imperial: IN_TO_MM },
  sectionModulus: { metric: 1, imperial: IN3_TO_MM3 },
  massPerLength: { metric: 1, imperial: LBPERFT_TO_KGPERM },
  stress: { metric: 1, imperial: KSI_TO_MPA },
  torsion: { metric: 1, imperial: IN4_TO_MM4 },
  warping: { metric: 1, imperial: IN6_TO_MM6 },
  pressure: { metric: 1, imperial: KSF_TO_KPA },
  unitWeight: { metric: 1, imperial: PCF_TO_KNM3 },
  areaPerLength: { metric: 1, imperial: IN2_PER_FT_TO_MM2_PER_M },
  forcePerLength: { metric: 1, imperial: KIPPERFT_TO_KNM },
  momentPerLength: { metric: 1, imperial: KIPFT_TO_KNM }, // kip·ft per ft of length ≡ kN·m per m
  velocity: { metric: 1, imperial: MPH_TO_MS },
  pressureSmall: { metric: 1, imperial: PSF_TO_PA },
};

export const UNIT_LABELS: Record<UnitSystem, Record<Quantity, string>> = {
  metric: {
    length: 'm',
    position: 'm',
    force: 'kN',
    distLoad: 'kN/m',
    moment: 'kN\u00b7m',
    deflection: 'mm',
    E: 'MPa',
    I: 'mm\u2074',
    A: 'mm\u00b2',
    density: 'kg/m\u00b3',
    dimension: 'mm',
    sectionModulus: 'mm\u00b3',
    massPerLength: 'kg/m',
    stress: 'MPa',
    torsion: 'mm\u2074',
    warping: 'mm\u2076',
    pressure: 'kPa',
    unitWeight: 'kN/m\u00b3',
    areaPerLength: 'mm\u00b2/m',
    forcePerLength: 'kN/m',
    momentPerLength: 'kN\u00b7m/m',
    velocity: 'm/s',
    pressureSmall: 'Pa',
  },
  imperial: {
    length: 'ft',
    position: 'ft',
    force: 'kip',
    distLoad: 'kip/ft',
    moment: 'kip\u00b7ft',
    deflection: 'in',
    E: 'ksi',
    I: 'in\u2074',
    A: 'in\u00b2',
    density: 'pcf',
    dimension: 'in',
    sectionModulus: 'in\u00b3',
    massPerLength: 'lb/ft',
    stress: 'ksi',
    torsion: 'in\u2074',
    warping: 'in\u2076',
    pressure: 'ksf',
    unitWeight: 'pcf',
    areaPerLength: 'in\u00b2/ft',
    forcePerLength: 'klf',
    momentPerLength: 'kip\u00b7ft/ft',
    velocity: 'mph',
    pressureSmall: 'psf',
  },
};

export function toSI(value: number, quantity: Quantity, system: UnitSystem): number {
  return value * TO_SI_FACTOR[quantity][system];
}

export function fromSI(value: number, quantity: Quantity, system: UnitSystem): number {
  return value / TO_SI_FACTOR[quantity][system];
}

// Round for display so float roundoff doesn't surface in inputs (e.g. 3 → 3.0000000004).
export function displayNum(value: number, digits = 6): number {
  if (!isFinite(value)) return 0;
  const p = Math.pow(10, digits);
  return Math.round(value * p) / p;
}

// Convenience: convert an SI value to the user's system and return a clean number for inputs.
export function inputValue(
  siValue: number,
  quantity: Quantity,
  system: UnitSystem,
  digits = 6
): number {
  return displayNum(fromSI(siValue, quantity, system), digits);
}

// Smart fixed-digit formatter for display labels (diagrams, lists).
export function formatValue(
  siValue: number,
  quantity: Quantity,
  system: UnitSystem,
  digits = 2
): string {
  const v = fromSI(siValue, quantity, system);
  return v.toFixed(digits);
}

export function unitLabel(quantity: Quantity, system: UnitSystem): string {
  return UNIT_LABELS[system][quantity];
}
