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
  | 'warping';

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
