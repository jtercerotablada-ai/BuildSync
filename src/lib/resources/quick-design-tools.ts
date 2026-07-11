// Catalog of every Quick Design calculator we offer (or plan to offer).
// Tools already built in this site link to their route; the rest are shown as
// "coming-soon" placeholders so the landing page communicates the full scope.
//
// Scope: American design standards only (US: ACI, AISC, AISI, ASCE, AWC/NDS,
// ADM, IBC; Canada: CSA, NBCC). European (Eurocode / EN / BS EN) and
// Oceania (AS / NZS / AS-NZS) standards are intentionally excluded.

export type ToolCategory =
  | 'Steel'
  | 'Cold-Formed Steel'
  | 'Concrete'
  | 'Timber'
  | 'Foundations'
  | 'Aluminum'
  | 'Connections'
  | 'Scaffolding'
  | 'Loading'
  | 'Analysis'
  | 'Utility'
  | 'Other';

export interface QuickDesignTool {
  title: string;
  description: string;
  category: ToolCategory;
  code?: string;           // design standard tag (ACI 318, AISC 360, etc.)
  status: 'available' | 'coming-soon';
  href?: string;
  isNew?: boolean;
}

export const QUICK_DESIGN_TOOLS: QuickDesignTool[] = [
  // ─────────── Steel ───────────
  { category: 'Steel', code: 'AISC 360-22', title: 'Steel Member Design', description: 'Axial, bending, shear and combined-action checks per AISC 360-22 (LRFD) for W, S, HSS and pipe sections — full section library, limit-state capacities, utilisation and governing clause. Validated against AISC Manual values.', status: 'available', href: '/resources/steel-member', isNew: true },
  { category: 'Steel', code: 'CSA S16-14', title: 'Steel I-Beam Design', description: 'Flexure, shear, deflection and lateral-torsional buckling for hot-rolled W and S I-sections per CSA S16-14 (LSD) — full Canadian metric shape library, section classification, Mr with LTB curve, Vr and serviceability. Validated against CISC Handbook values.', status: 'available', href: '/resources/csa-i-beam', isNew: true },
  { category: 'Steel', code: 'AISC 360-16', title: 'Steel Angle Design', description: 'Tension, compression and flexural capacity of single (L) and double (2L) hot-rolled angles per AISC 360-16 (LRFD) — full L/2L library, D2/D3 tension with shear-lag, E5 effective-slenderness compression, E4/E6 double-angle FTB, and F10/F9 flexure with principal-axis LTB. Validated against AISC Design Examples.', status: 'available', href: '/resources/steel-angle', isNew: true },
  { category: 'Steel', code: 'AISC 360-16', title: 'Steel I-Beam Design', description: 'Flexure, shear, deflection and lateral-torsional buckling for hot-rolled I-sections.', status: 'coming-soon' },
  { category: 'Steel', code: 'AISC 360-16', title: 'Steel Channel Design', description: 'Bending, shear and buckling checks for hot-rolled channel (C) sections.', status: 'coming-soon' },
  { category: 'Steel', code: 'AISC 360-22', title: 'Steel Plate Design', description: 'Minor-axis bending and shear capacity of flat plates and bars.', status: 'coming-soon', isNew: true },
  { category: 'Steel', code: 'AISC 360-22', title: 'I-Beam Load Capacity Check', description: 'Quick factored-load capacity of a W-section at a given span and bracing — picks the controlling limit state.', status: 'coming-soon' },
  { category: 'Steel', code: 'AISC 360-22 Ch. I', title: 'Composite Beam & Column Design', description: 'Steel-concrete composite beams with shear studs, plus encased and filled composite columns.', status: 'coming-soon' },

  // ─────────── Cold-Formed Steel ───────────
  { category: 'Cold-Formed Steel', code: 'AISI S100-16', title: 'AISI S100-16 Cold-Formed Member Design', description: 'Cold-formed steel members per AISI S100-16.', status: 'coming-soon' },
  { category: 'Cold-Formed Steel', code: 'AISI S100-16', title: 'AISI S100-16 Purlin Design', description: 'Steel purlins per AISI S100-16.', status: 'coming-soon' },

  // ─────────── Concrete ───────────
  { category: 'Concrete', code: 'ACI 318-19', title: 'ACI 318-19 Concrete Shear Wall Design', description: 'Reinforced concrete structural walls per ACI 318-19 — in-plane shear (§11.5.4), axial-flexure P-M interaction, minimum reinforcement, simplified axial and special boundary elements (§18.10.6), with the full interaction diagram. Validated against ACI clause arithmetic and PCA/StructurePoint values.', status: 'available', href: '/resources/shear-wall', isNew: true },
  { category: 'Concrete', code: 'ACI 318-19', title: 'ACI 318-19 Concrete Column Design', description: 'Reinforced concrete columns per ACI 318-19 — rectangular tied and circular spiral, uniaxial & biaxial P-M interaction (Bresler / PCA load contour), non-sway slenderness magnification (§6.6.4) and detailing limits, with the full interaction diagram. Validated against ACI hand calcs and StructurePoint values.', status: 'available', href: '/resources/concrete-column', isNew: true },
  { category: 'Concrete', code: 'CSA A23.3-14', title: 'CSA A23.3-14 Concrete Slab Design', description: 'RC slab resistance per CSA A23.3-14.', status: 'coming-soon' },
  { category: 'Concrete', code: 'ACI 360 R-06', title: 'ACI 360 R-06 Slab on Grade Design', description: 'Slab on grade per ACI 360 R-06.', status: 'coming-soon' },
  { category: 'Concrete', code: 'ACI 318-19', title: 'ACI 318-19 Reinforcement Development & Lap', description: 'Development and lap length per ACI 318-19.', status: 'coming-soon' },
  { category: 'Concrete', code: 'ACI 318-19', title: 'Two-way Slab Design', description: 'One-way + two-way RC slab per Method 3 (9 cases) — moments, As, deflection, punching, crack control.', status: 'available', href: '/resources/slab', isNew: true },
  { category: 'Concrete', code: 'ACI 318-19', title: 'ACI 318-19 Punching Shear Design', description: 'Slab punching shear per ACI 318-19.', status: 'available', href: '/resources/slab' },
  { category: 'Concrete', code: 'ACI 318-19', title: 'ACI 318-19 Concrete Corbel Design', description: 'Reinforced concrete corbels per ACI 318-19.', status: 'coming-soon' },
  { category: 'Concrete', code: 'ACI 318-19', title: 'ACI 318-19 Flexural Crack Width', description: 'Service-load crack width on RC beams and slabs using Frosch and Gergely-Lutz formulations — reinforcement stress, cover and bar spacing inputs.', status: 'coming-soon' },
  { category: 'Concrete', code: 'ACI 318-25', title: 'ACI 318-25 RC Beam Design', description: 'Reinforced concrete beam design per ACI 318-25 SI — flexure (singly + doubly + T-beam), shear (Vc + Vs + max stirrup spacing), Branson deflection and §24.3 crack control. 50 unit tests against first-principles ACI formulas.', status: 'available', href: '/resources/rc-design', isNew: true },
  { category: 'Concrete', code: 'ACI 318-25', title: 'ACI 318-25 Flexure — Design & Analysis', description: 'Singly-reinforced rectangular flexure (Tercero Tablada method, metric): design the steel from Mu (Rn → ρ → As + commercial-bar selection) or check capacity φMn from placed steel — with cross-section and strain diagrams.', status: 'available', href: '/resources/flexure', isNew: true },

  // ─────────── Timber ───────────
  { category: 'Timber', code: 'NDS® 2018', title: 'NDS® 2018 Wood Member Design', description: 'Structural wood members per NDS® 2018.', status: 'coming-soon' },
  { category: 'Timber', code: 'CSA O86-14', title: 'CSA O86-14 Timber Member Design', description: 'Structural timber members per CSA O86-14.', status: 'coming-soon' },
  { category: 'Timber', code: 'AWC 2021', title: 'AWC 2021 Floor Joist Span Calculator', description: 'Max joist span per AWC design values.', status: 'coming-soon' },
  { category: 'Timber', code: 'NDS® 2018 / AWC', title: 'Sloped Rafter Span Calculator', description: 'Pitched-roof rafter sizing under combined dead, snow, live and ceiling loads — bending, deflection and bearing length per NDS allowable design values.', status: 'coming-soon' },

  // ─────────── Foundations ───────────
  { category: 'Foundations', code: 'ACI 318-25', title: 'ACI 318-25 Spread Footing Design', description: 'Isolated spread footings per ACI 318-25 SI — bearing, punching, one-way shear, flexure, overturning, sliding, bar fit, dev. length. 2D plan + cross-section + 3D viewer + print report. Auto-design sizes B/L/T and picks rebar.', status: 'available', href: '/resources/foundation-design', isNew: true },
  { category: 'Foundations', code: 'ACI 318-25', title: 'ACI 318-25 Strip Footing Design', description: 'RC strip / wall footings per ACI 318-25 SI — same engine as spread footings, with transverse-only flexure for 1 m strips.', status: 'available', href: '/resources/foundation-design', isNew: true },
  { category: 'Foundations', code: 'ACI 318-25', title: 'ACI 318-25 Combined Footing Design', description: 'Two-column rectangular combined footings per ACI 318-25 §13.3.4 + Wight Ex 15-5. Resultant centring → uniform pressure, BMD/SFD beam analysis, two-way + one-way shear, longitudinal + transverse flexure, bearing-interface + bar fit + dev length checks, full auto-design driver, 3D viewer + branded print report.', status: 'available', href: '/resources/combined-footing', isNew: true },
  { category: 'Foundations', code: 'ACI 318-25', title: 'ACI 318-25 Mat (Raft) Foundation Design', description: 'Multi-column rectangular mat foundations per ACI 318-25 §13.3.4 (rigid method). Bilinear corner pressures, per-column two-way shear with auto-detected αs, bearing-interface, bar fit for 4 mats, strip-method flexure (X + Y), full auto-design driver, 3D viewer with column array + branded print report.', status: 'available', href: '/resources/mat-foundation', isNew: true },
  { category: 'Foundations', code: '—', title: 'Bearing Capacity Calculator', description: 'Bearing capacity using FS approach.', status: 'coming-soon' },
  { category: 'Foundations', code: '—', title: 'Lateral Pile Stability', description: 'Embedment and strength for lateral pile stability.', status: 'coming-soon' },
  { category: 'Foundations', code: 'AISC 360-16 / IBC 2021', title: 'Screw Pile Design', description: 'Steel screw piles per AISC 360 & IBC 2021.', status: 'coming-soon' },
  { category: 'Foundations', code: 'ACI 318 / Rankine', title: 'Retaining Wall Design', description: 'Cantilever retaining wall stability + ACI 318 design.', status: 'available', href: '/resources/retaining-wall' },

  // ─────────── Aluminum ───────────
  { category: 'Aluminum', code: 'ADM 2020', title: 'ADM 2020 Aluminum Member Design', description: 'Aluminum members per ADM 2020.', status: 'coming-soon' },
  { category: 'Aluminum', code: 'CSA S157-17', title: 'CSA S157-17 Aluminium Member Design', description: 'Aluminium members per CSA S157-17.', status: 'coming-soon' },
  { category: 'Aluminum', code: 'ADM 2015', title: 'ADM 2015 Aluminum Member Design', description: 'Aluminium members per ADM 2015.', status: 'coming-soon' },
  { category: 'Aluminum', code: 'ADM 2020', title: 'Aluminum Beam Capacity Check', description: 'Quick allowable load on extruded aluminum sections (I, channel, angle, tube) under flexure — selects the controlling limit state from ADM Table B.4.', status: 'coming-soon' },

  // ─────────── Connections ───────────
  { category: 'Connections', code: 'AISC 360-16', title: 'AISC 360-16 Blodgett Weld Capacity', description: 'Weld groups per AISC 360-16.', status: 'coming-soon' },
  { category: 'Connections', code: 'AISC 360-16', title: 'AISC 360-16 Bolt Group Capacity', description: 'Bolt groups per AISC 360-16.', status: 'coming-soon' },
  { category: 'Connections', code: 'CSA S16-24', title: 'CSA S16-24 Bolt Group Capacity', description: 'Bolt groups per CSA S16-24.', status: 'coming-soon', isNew: true },
  { category: 'Connections', code: 'AISC 360-16', title: 'AISC 360-16 Lifting Lug Design', description: 'Steel lifting lugs per AISC 360-16.', status: 'coming-soon' },
  { category: 'Connections', code: 'AISC 360-16', title: 'AISC 360-16 Kicker Brace Connection', description: 'Single-angle kicker brace per AISC 360-16.', status: 'coming-soon' },
  { category: 'Connections', code: 'AISC 360-22', title: 'AISC 360-22 Bolt Group Coefficient', description: 'Bolt group coefficient per AISC 360-22.', status: 'coming-soon' },
  { category: 'Connections', code: 'ACI 318-25 / AISC DG 1', title: 'Shear Lug Design', description: 'Embedded steel plate shear lug under anchor bolt shear transfer — concrete bearing, lug plate flexure, base-plate weld and shear-friction at the lug-concrete interface.', status: 'coming-soon' },
  { category: 'Connections', code: 'AISC 360-22', title: 'Bolted Splice Connection', description: 'Beam or column splice with cover plates carrying axial + shear + moment — slip-critical and bearing-bolt limit states plus plate yielding, rupture and block shear.', status: 'coming-soon' },
  { category: 'Connections', code: 'AISC DG 1 / 360-22 + ACI 318-25', title: 'Steel Base Plate & Anchor Rod Design', description: 'Column base plate per AISC Design Guide 1 (3rd Ed.) + 360-22 — concrete bearing, plate flexion, anchor tension and ACI 318-25 Chapter 17 concrete pullout, breakout, anchor shear and weld design.', status: 'available', href: '/resources/base-plate', isNew: true },

  // ─────────── Scaffolding ───────────
  { category: 'Scaffolding', code: 'AISC 360-16', title: 'AISC 360-16 Scaffold Member Design', description: 'Scaffolding members per AISC 360-16.', status: 'coming-soon' },

  // ─────────── Loading ───────────
  { category: 'Loading', code: 'ASCE 7-22', title: 'ASCE 7-22 Wind Load Generator', description: 'MWFRS + C&C wind pressures from site lat/lng lookup.', status: 'available', href: '/resources/load-gen', isNew: true },
  { category: 'Loading', code: 'NBCC 2015', title: 'NBCC 2015 Multi-Roof Snow Drift', description: 'Snow loads per NBCC 2015.', status: 'coming-soon' },
  { category: 'Loading', code: '—', title: 'Load Combination Generator', description: 'ASCE 7 / IBC load combinations (LRFD + ASD).', status: 'coming-soon' },
  { category: 'Loading', code: 'ASCE 7-16', title: 'ASCE 7-16 Gust-Effect Factor (Imperial)', description: 'Gust-effect factors per ASCE 7-16 (Imperial).', status: 'coming-soon' },
  { category: 'Loading', code: 'ASCE 7-16', title: 'ASCE 7-16 Gust-Effect Factor (Metric)', description: 'Gust-effect factors per ASCE 7-16 (Metric).', status: 'coming-soon' },
  { category: 'Loading', code: 'ASCE 7-22', title: 'ASCE 7-22 Gust-Effect Factor (Imperial)', description: 'Gust-effect factors per ASCE 7-22 (Imperial).', status: 'coming-soon' },
  { category: 'Loading', code: 'ASCE 7-22', title: 'ASCE 7-22 Gust-Effect Factor (Metric)', description: 'Gust-effect factors per ASCE 7-22 (Metric).', status: 'coming-soon' },

  // ─────────── Analysis ───────────
  { category: 'Analysis', code: '—', title: 'Column Analysis', description: 'Analyse columns for axial and bending.', status: 'coming-soon' },
  { category: 'Analysis', code: '—', title: 'Section Properties', description: 'Section properties for any shape.', status: 'available', href: '/resources/section-builder' },
  { category: 'Analysis', code: '—', title: 'Multi-Span Beam Analysis', description: 'Continuous beams, hinges, springs, settlements, thermal — full FEM.', status: 'available', href: '/resources/advanced-beam', isNew: true },
  { category: 'Analysis', code: '—', title: 'Beam Analysis', description: 'Quick and accurate single-beam analysis with shear, moment, and deflection diagrams. Direct-stiffness (FEM) Euler-Bernoulli solution for any support layout under point, distributed and moment loads. Validated against closed-form beam solutions.', status: 'available', href: '/resources/beam-analysis', isNew: true },
  { category: 'Analysis', code: '—', title: 'Column Buckling Load', description: 'Critical buckling load for compression columns.', status: 'coming-soon' },
  { category: 'Analysis', code: '—', title: '2D Stiffness Method Analysis', description: 'Stiffness matrix + force vector for 2D elements.', status: 'coming-soon' },
  { category: 'Analysis', code: '—', title: 'Cable Sag Analysis', description: 'Pre-tension for a specified cable sag.', status: 'coming-soon' },
  { category: 'Analysis', code: '—', title: 'Cable Tension Analysis', description: 'Cable tension for structural applications.', status: 'coming-soon' },
  { category: 'Analysis', code: '—', title: 'Plate Buckling Stress', description: 'Buckling stresses for steel plates.', status: 'coming-soon' },
  { category: 'Analysis', code: '—', title: 'Tributary Area Load Distribution', description: 'Tributary loads and beam analysis.', status: 'coming-soon' },
  { category: 'Analysis', code: '—', title: '2D Pin-Jointed Truss Solver', description: 'Direct stiffness method for plane trusses — member axial forces, reactions and joint displacements from any combination of nodal loads and supports.', status: 'coming-soon' },
  { category: 'Analysis', code: '—', title: '2D Plane Frame Solver', description: 'Full FEM solver for plane frames with moment-resisting joints — beam-column elements, distributed and point loads, M/V/N diagrams and deflected-shape plot.', status: 'coming-soon' },
  { category: 'Analysis', code: '—', title: 'Structural 3D FEA', description: '3D frame and shell finite-element analysis with libraries of standard sections, multiple load cases, P-Δ effects and modal / time-history analysis.', status: 'coming-soon' },

  // ─────────── Utility ───────────
  { category: 'Utility', code: '—', title: 'Structural Unit Converter', description: 'Convert length, force, temperature, section units.', status: 'coming-soon' },
  { category: 'Utility', code: '—', title: "Young's Modulus Calculator", description: "Young's Modulus from stress and strain data.", status: 'coming-soon' },
  { category: 'Utility', code: '—', title: "Poisson's Ratio Calculator", description: "Poisson's Ratio from strain or stiffness.", status: 'coming-soon' },
  { category: 'Utility', code: 'Mander 1988', title: 'Concrete Stress-Strain Calculator', description: "Stress–strain per Mander's (1988) theory.", status: 'coming-soon' },
  { category: 'Utility', code: '—', title: 'Sheet Metal K-Factor Calculator', description: 'K-factor for sheet metal bending.', status: 'coming-soon' },
  { category: 'Utility', code: '—', title: 'Bolt Torque Calculator', description: 'Required torque to tighten a bolt.', status: 'coming-soon' },
  { category: 'Utility', code: '—', title: 'Moment of Inertia & Centroid', description: 'Quick I, S, Z and centroid for primitive cross-sections — rectangle, circle, hollow tube, I, channel, angle and T — with units toggle.', status: 'coming-soon' },
  { category: 'Utility', code: 'AISC', title: 'Steel Section Database', description: 'Searchable lookup of W, HSS, C, L, MT and equivalent profiles — geometric, torsional and classification data ready for design checks.', status: 'coming-soon' },

  // ─────────── Other ───────────
  { category: 'Other', code: '—', title: 'Flooring Cost Calculator', description: 'Calculates the cost of flooring.', status: 'coming-soon' },
  { category: 'Other', code: '—', title: 'Roof Pitch Calculator', description: 'Calculate the pitch of a roof.', status: 'coming-soon' },
  { category: 'Other', code: '—', title: "Hooke's Law Calculator", description: 'Force in a spring.', status: 'coming-soon' },
];

export const CATEGORIES: ToolCategory[] = [
  'Steel',
  'Cold-Formed Steel',
  'Concrete',
  'Timber',
  'Foundations',
  'Aluminum',
  'Connections',
  'Scaffolding',
  'Loading',
  'Analysis',
  'Utility',
  'Other',
];
