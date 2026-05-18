// Base Plate Construction Details — supporting data tables
//
// All values transcribed from:
//   AISC Design Guide 1, 3rd Edition (2024) — Tables 4-3, 4-4
//   ASME B18.2.2-2022 — Heavy hex nut dimensions
//   ASTM F1554 — Anchor rod material & color codes
//   ACI 117-10 — Tolerances for embedded items
//   AISC Code of Standard Practice 2022 §7.5.1 — Anchor rod tolerances
//
// Used by the BasePlatePrintReport to populate construction-detail pages
// and verified material/tolerance tables.

import type { AnchorGrade } from './types';

// ============================================================================
// AISC DG1 Table 4-3 — Recommended hole + washer sizes per anchor diameter
// (all values in inches)
// ============================================================================
export interface HoleWasherSpec {
  /** Anchor diameter da (in). */
  da: number;
  /** Recommended base plate hole diameter (in) — significantly larger than rod. */
  holeDia: number;
  /** Minimum plate-washer width (in) — square or circular. */
  washerWidth: number;
  /** Minimum plate-washer thickness (in) — varies by anchor grade. */
  washerThk: { gr36: number; gr55: number; gr105: number };
}

export const HOLE_WASHER_TABLE: HoleWasherSpec[] = [
  { da: 0.750, holeDia: 1.3125, washerWidth: 2.000, washerThk: { gr36: 0.250, gr55: 0.250, gr105: 0.375 } },
  { da: 0.875, holeDia: 1.5625, washerWidth: 2.500, washerThk: { gr36: 0.375, gr55: 0.375, gr105: 0.500 } },
  { da: 1.000, holeDia: 1.8125, washerWidth: 3.000, washerThk: { gr36: 0.375, gr55: 0.375, gr105: 0.500 } },
  { da: 1.250, holeDia: 2.0625, washerWidth: 3.500, washerThk: { gr36: 0.375, gr55: 0.500, gr105: 0.625 } },
  { da: 1.500, holeDia: 2.3750, washerWidth: 4.000, washerThk: { gr36: 0.250, gr55: 0.500, gr105: 0.625 } },
  { da: 1.750, holeDia: 2.6875, washerWidth: 4.500, washerThk: { gr36: 0.750, gr55: 0.750, gr105: 0.750 } },
  { da: 2.000, holeDia: 3.2500, washerWidth: 5.000, washerThk: { gr36: 0.750, gr55: 0.750, gr105: 0.750 } },
  { da: 2.500, holeDia: 3.7500, washerWidth: 5.500, washerThk: { gr36: 0.750, gr55: 0.750, gr105: 0.875 } },
];

export function lookupHoleWasher(da: number): HoleWasherSpec {
  // Pick closest match
  return HOLE_WASHER_TABLE.reduce((best, cur) =>
    Math.abs(cur.da - da) < Math.abs(best.da - da) ? cur : best
  );
}

export function washerThicknessForGrade(spec: HoleWasherSpec, grade: AnchorGrade): number {
  if (grade === 'F1554-105') return spec.washerThk.gr105;
  if (grade === 'F1554-55') return spec.washerThk.gr55;
  return spec.washerThk.gr36;   // Gr 36, A325, A490, custom default to Gr 36 thickness
}

// ============================================================================
// ASME B18.2.2 — Heavy hex nut dimensions
// ============================================================================
export interface HexNutSpec {
  da: number;
  /** Width across flats F (in). */
  acrossFlats: number;
  /** Width across corners (in). */
  acrossCorners: number;
  /** Nut height H (in). */
  height: number;
}

export const HEAVY_HEX_NUTS: HexNutSpec[] = [
  { da: 0.500, acrossFlats: 0.875,  acrossCorners: 1.010, height: 0.504 },
  { da: 0.625, acrossFlats: 1.0625, acrossCorners: 1.227, height: 0.629 },
  { da: 0.750, acrossFlats: 1.250,  acrossCorners: 1.443, height: 0.754 },
  { da: 0.875, acrossFlats: 1.4375, acrossCorners: 1.660, height: 0.879 },
  { da: 1.000, acrossFlats: 1.625,  acrossCorners: 1.877, height: 1.004 },
  { da: 1.125, acrossFlats: 1.8125, acrossCorners: 2.093, height: 1.129 },
  { da: 1.250, acrossFlats: 2.000,  acrossCorners: 2.310, height: 1.254 },
  { da: 1.375, acrossFlats: 2.1875, acrossCorners: 2.527, height: 1.379 },
  { da: 1.500, acrossFlats: 2.375,  acrossCorners: 2.743, height: 1.504 },
  { da: 1.750, acrossFlats: 2.750,  acrossCorners: 3.176, height: 1.754 },
  { da: 2.000, acrossFlats: 3.125,  acrossCorners: 3.610, height: 2.004 },
  { da: 2.500, acrossFlats: 3.875,  acrossCorners: 4.476, height: 2.504 },
];

export function lookupHexNut(da: number): HexNutSpec {
  return HEAVY_HEX_NUTS.reduce((best, cur) =>
    Math.abs(cur.da - da) < Math.abs(best.da - da) ? cur : best
  );
}

// ============================================================================
// AISC DG1 Table 4-4 — Hex coupling nut dimensions (for repair/extension)
// ============================================================================
export interface CouplingNutSpec {
  da: number;
  acrossFlats: number;
  acrossCorners: number;
  height: number;
}

export const COUPLING_NUTS: CouplingNutSpec[] = [
  { da: 0.500, acrossFlats: 0.875,  acrossCorners: 1.010, height: 1.250 },
  { da: 0.625, acrossFlats: 1.000,  acrossCorners: 1.155, height: 1.625 },
  { da: 0.750, acrossFlats: 1.250,  acrossCorners: 1.443, height: 2.250 },
  { da: 0.875, acrossFlats: 1.4375, acrossCorners: 1.660, height: 2.500 },
  { da: 1.000, acrossFlats: 1.625,  acrossCorners: 1.877, height: 2.750 },
  { da: 1.250, acrossFlats: 2.000,  acrossCorners: 2.310, height: 3.000 },
  { da: 1.500, acrossFlats: 2.375,  acrossCorners: 2.743, height: 3.500 },
  { da: 1.750, acrossFlats: 2.750,  acrossCorners: 3.176, height: 5.250 },
  { da: 2.000, acrossFlats: 3.125,  acrossCorners: 3.610, height: 6.000 },
  { da: 2.500, acrossFlats: 3.875,  acrossCorners: 4.476, height: 7.500 },
];

export function lookupCouplingNut(da: number): CouplingNutSpec {
  return COUPLING_NUTS.reduce((best, cur) =>
    Math.abs(cur.da - da) < Math.abs(best.da - da) ? cur : best
  );
}

// ============================================================================
// ACI 117-10 + AISC CoSP 2022 §7.5.1 — Anchor rod placement tolerances
// ============================================================================
export interface AnchorTolerances {
  /** Anchor diameter range (in). */
  daMin: number;
  daMax: number;
  /** Horizontal tolerance from specified centerline (±in). */
  horizontalCenterline: number;
}

export const ANCHOR_TOLERANCES: AnchorTolerances[] = [
  { daMin: 0.750, daMax: 0.875, horizontalCenterline: 0.250 },   // ±1/4"
  { daMin: 1.000, daMax: 1.500, horizontalCenterline: 0.375 },   // ±3/8"
  { daMin: 1.750, daMax: 2.500, horizontalCenterline: 0.500 },   // ±1/2"
];

export function lookupAnchorTolerance(da: number): number {
  const row = ANCHOR_TOLERANCES.find((r) => da >= r.daMin && da <= r.daMax);
  return row?.horizontalCenterline ?? 0.500;
}

/** Constant tolerances per ACI 117-10 §2.3 + AISC CoSP §7.5.1 */
export const TOLERANCE_CONSTANTS = {
  /** Vertical deviation, top of anchor rod from specified elevation (±in). */
  verticalElevation: 0.500,        // ±1/2"
  /** Centerline of anchor assembly from specified location, horizontal (±in). */
  assemblyHorizontal: 1.000,       // ±1"
  /** Centerline of anchor assembly from specified location, vertical (±in). */
  assemblyVertical: 1.000,         // ±1"
};

// ============================================================================
// ASTM F1554 anchor rod material color codes
// ============================================================================
export const F1554_COLOR_CODES: Record<'F1554-36' | 'F1554-55' | 'F1554-105', { color: string; hex: string }> = {
  'F1554-36':  { color: 'BLUE',   hex: '#1f4ec0' },
  'F1554-55':  { color: 'YELLOW', hex: '#d6b500' },
  'F1554-105': { color: 'RED',    hex: '#c93030' },
};

// ============================================================================
// Recommended thread length per DG1 §4.5.3
//   "thread lengths should be specified at least 3 in., preferably 6 in.,
//    greater than required to allow for variations in setting elevation"
// ============================================================================
export function recommendedThreadProjection(da: number, plateThk: number): {
  minimum: number;
  preferred: number;
  total: number;
} {
  // Length needed = nut height + plate thk + projection above nut
  const nut = lookupHexNut(da);
  const minimum = nut.height + plateThk + 3;       // +3" extra
  const preferred = nut.height + plateThk + 6;     // +6" extra
  return { minimum, preferred, total: preferred };
}

// ============================================================================
// Grouting requirements per DG1 §4.5.6
// ============================================================================
export interface GroutSpec {
  /** Minimum grout thickness (in). */
  minThickness: number;
  /** Recommended grout thickness (in). */
  recommendedThickness: number;
  /** Required grout compressive strength (ksi). */
  requiredFc: number;
  /** Notes. */
  notes: string[];
}

export function groutRequirements(concreteFc: number, plateWidth: number): GroutSpec {
  // DG1 §4.5.6: 1" if on finished floor, 1.5" - 2" on top of footing/pier
  const isLargePlate = plateWidth > 24;
  return {
    minThickness: 1.0,
    recommendedThickness: isLargePlate ? 2.0 : 1.5,
    /** Recommended: at least 2× concrete fc */
    requiredFc: 2 * concreteFc,
    notes: [
      'Use non-shrink, premixed grout per ASTM C1107.',
      `Minimum compressive strength: 2·fʹc concrete = ${(2 * concreteFc).toFixed(2)} ksi.`,
      'Lower grout strength may be used if compressive strength is confirmed by calculation.',
      isLargePlate
        ? 'Plate ≥ 24″ — provide one or two 2″ to 3″ grout holes (thermally cut).'
        : 'Plate < 24″ — no grout holes required; grout from one side until it flows out the opposite side.',
      'Form around the edge of the plate. Use enough head pressure for grout to flow out all sides.',
      'Cure per manufacturer\'s recommendations before applying load.',
      'In cold weather, provide protection per manufacturer\'s specifications.',
      'Grouting is the responsibility of the concrete contractor (per DG1 §4.5.6).',
    ],
  };
}

// ============================================================================
// Welding requirements per DG1 §4.5.2 + AISC 360-22 §J2
// ============================================================================
export function weldingNotes(plateThk: number, electrode: 'E60' | 'E70' | 'E80'): string[] {
  const minSize = plateThk <= 0.25 ? '1/8'
    : plateThk <= 0.50 ? '3/16'
    : plateThk <= 0.75 ? '1/4'
    : '5/16';
  return [
    `Welding electrode: ${electrode} per AWS A5.1 / A5.5.`,
    'Welding procedures per AWS D1.1 / D1.1M Structural Welding Code — Steel.',
    `Minimum fillet weld size per AISC 360 Table J2.4 = ${minSize}″ (based on ${plateThk.toFixed(3)}″ plate).`,
    'Weld FLATS only — avoid weld-all-around symbol on W-shapes (DG1 §4.5.2 recommendation).',
    'For W-shape columns under axial compression only: weld one side of each flange with minimum AWS size.',
    'For columns with moment, axial tension, or anchor rods at corners: weld all faces; corners must be welded for HSS.',
    'Pre-heat per AWS D1.1 Table 5.8 if base plate or column flange is thick.',
    'Visual inspection (VT) per AWS D1.1 §6.9.1 required for all welds.',
    'Magnetic particle (MT) or ultrasonic (UT) testing for critical welds where specified.',
    'Use plate washers welded to base plate ONLY when anchor rods resist shear at the column base.',
  ];
}

// ============================================================================
// Anchor rod material & nut specifications per DG1 §2.3 + AISC Manual
// ============================================================================
export interface AnchorRodSpec {
  rodMaterial: string;
  rodGrade: string;
  rodFy: number;
  rodFu: number;
  colorCode: string;
  colorHex: string;
  nutMaterial: string;
  nutSpec: string;
  threads: string;
}

export function anchorRodMaterialSpec(grade: AnchorGrade, customFy?: number, customFu?: number): AnchorRodSpec {
  if (grade === 'custom') {
    return {
      rodMaterial: 'Custom anchor rod', rodGrade: '—',
      rodFy: customFy ?? 36, rodFu: customFu ?? 58,
      colorCode: '—', colorHex: '#888',
      nutMaterial: 'ASTM A563 Grade A or DH', nutSpec: 'Heavy hex',
      threads: 'UNC Class 2A',
    };
  }
  if (grade === 'A325') {
    return {
      rodMaterial: 'ASTM F3125', rodGrade: 'A325 (Grade A325)',
      rodFy: 92, rodFu: 120,
      colorCode: '—', colorHex: '#666',
      nutMaterial: 'ASTM A563 Grade DH', nutSpec: 'Heavy hex',
      threads: 'UNC Class 2A',
    };
  }
  if (grade === 'A490') {
    return {
      rodMaterial: 'ASTM F3125', rodGrade: 'A490 (Grade A490)',
      rodFy: 130, rodFu: 150,
      colorCode: '—', colorHex: '#666',
      nutMaterial: 'ASTM A563 Grade DH', nutSpec: 'Heavy hex',
      threads: 'UNC Class 2A',
    };
  }
  // F1554 grades
  const colors = F1554_COLOR_CODES[grade];
  const fyFu = grade === 'F1554-36' ? { Fy: 36, Fu: 58 }
    : grade === 'F1554-55' ? { Fy: 55, Fu: 75 }
    : { Fy: 105, Fu: 125 };
  return {
    rodMaterial: 'ASTM F1554', rodGrade: grade.replace('F1554-', 'Grade '),
    rodFy: fyFu.Fy, rodFu: fyFu.Fu,
    colorCode: colors.color, colorHex: colors.hex,
    nutMaterial: grade === 'F1554-105' ? 'ASTM A563 Grade DH' : 'ASTM A563 Grade A or DH',
    nutSpec: 'Heavy hex',
    threads: 'UNC Class 2A',
  };
}

// ============================================================================
// Erection method recommendations per DG1 §4.5.5
// ============================================================================
export interface ErectionMethod {
  name: string;
  bestFor: string;
  notes: string[];
}

export const ERECTION_METHODS: ErectionMethod[] = [
  {
    name: 'Setting Nut and Washer Method',
    bestFor: 'Lightly-loaded columns with 4-rod patterns (most common).',
    notes: [
      'Easy and cost-effective for typical 4-rod base plates.',
      'Setting nuts establish elevation; once set, unlikely to be disturbed.',
      'Anchor rods are loaded in COMPRESSION during erection — check pushout at bottom of footing.',
      'Plate washers required at bottom of base plate to span large oversized holes.',
      'Erection-load rod design typically responsibility of erection engineer.',
      'Even after grouting, setting nut continues to transfer load to anchor rod.',
      'NOT recommended for heavy columns or large axial loads during erection.',
    ],
  },
  {
    name: 'Setting Plate Method',
    bestFor: 'Most positive method; recommended for excavated locations or wet conditions.',
    notes: [
      'Setting plate (1/4" thick) slightly larger than base plate; max ~24" to avoid warping.',
      'Holes follow AISC J3.3 standard sizes if used as template/shear transfer; otherwise oversized.',
      'After anchor rods set, plate is removed, anchors checked, bearing area cleaned.',
      'Elevations set with jam nuts or shims; grout spread, plate tapped down to elevation.',
      'Re-check elevation after plate is set; remove and restart if necessary.',
      'AISC §M2.8(b) waives milling of base plate bottom that is grouted.',
      'Provides positive check on anchor settings before column erection.',
    ],
  },
  {
    name: 'Shim Stack Method',
    bestFor: 'Traditional method; transfers all compression directly to foundation without anchor rods.',
    notes: [
      'Steel shim packs ~4" wide set at four edges of base plate.',
      'Areas typically large enough to carry substantial dead load before grouting.',
      'Compression bypasses anchor rods entirely — beneficial for heavy columns.',
      'Requires careful elevation setting and shim selection.',
    ],
  },
];

// ============================================================================
// Repair / field-fix guidance per DG1 §4.6
// ============================================================================
export interface FieldFixGuidance {
  problem: string;
  solutions: string[];
}

export const FIELD_FIX_GUIDANCE: FieldFixGuidance[] = [
  {
    problem: 'Anchor rod(s) in wrong position',
    solutions: [
      'Slot base plate + plate washer to span slot (1-2 misplaced rods).',
      'Cut off and offset the entire base plate (uniform misalignment); check plate eccentricity.',
      'Cut off rods and install post-installed epoxy-type anchors per ACI 318 Ch 17 (large misalignment).',
      'OSHA: any modification of anchor rods must be reviewed and approved by the Engineer of Record.',
    ],
  },
  {
    problem: 'Anchor rods bent or not vertical',
    solutions: [
      'ASTM F1554 permits bending up to 45°; only Grade 36 recommended for field bending.',
      'Rods up to 1″ — cold bend with a hickey (rod bending device).',
      'Rods over 1″ — heat to ≤ 1,200°F before bending.',
      'After bending, perform visual inspection (VT) for cracks.',
      'Load-test the rod if tensile capacity is in question.',
    ],
  },
  {
    problem: 'Anchor rod projection too SHORT',
    solutions: [
      'Partial nut engagement OK if ≥ 50% of threads engaged (DG1 §4.6.3 + Labelle 2016).',
      'Use coupling nut + threaded rod extension (per DG1 Fig 4-18 + Table 4-4).',
      'Weld threaded extension to F1554 Gr 36 or Gr 55 (with Supplement S1) per DG1 §4.6.3.',
      'Use post-installed anchor in new hole if rod is for erection only.',
      'Welding hex nut to anchor rod is NOT recommended (not a prequalified joint).',
    ],
  },
  {
    problem: 'Anchor rod projection too LONG',
    solutions: [
      'Add additional plate washers to obtain proper thread engagement on the nut.',
      'Always specify thread length ≥ 3″ (preferably 6″) longer than required to absorb variations.',
    ],
  },
  {
    problem: 'Anchor rod pattern rotated 90°',
    solutions: [
      'Rotate the base plate to match (special cases — check fit-up).',
      'Cut off rods and install drilled-in epoxy-type anchors per ACI 318 Ch 17.',
    ],
  },
];
