// Catalog of every Quick Design calculator we offer (or plan to offer).
// Matches SkyCiv Quick Design library. Tools already built in this site link
// to their route; the rest are shown as "coming-soon" placeholders so the
// landing page communicates the full scope.

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
  { category: 'Steel', code: 'AISC 360-22', title: 'AISC 360-22 Steel Member Design', description: 'Design standard and custom steel members per AISC 360-22.', status: 'coming-soon' },
  { category: 'Steel', code: 'EN 1993-1-1', title: 'EN 1993-1-1 Steel Member Design', description: 'Standard and custom steel member design per EN 1993-1-1.', status: 'coming-soon' },
  { category: 'Steel', code: 'AS 4100:2020', title: 'AS 4100:2020 Steel Member Design', description: 'Steel member design per AS 4100.', status: 'coming-soon' },
  { category: 'Steel', code: 'CSA S16-14', title: 'CSA S16-14 Steel I-Beam Design', description: 'Design steel I-beams per CSA S16-14.', status: 'coming-soon' },
  { category: 'Steel', code: 'NZS 3404:1997', title: 'NZS 3404:1997 Steel Member Design', description: 'Standard and custom steel member design per NZS 3404.', status: 'coming-soon' },
  { category: 'Steel', code: 'AISC 360-16', title: 'AISC 360-16 Steel Angle Design', description: 'Design steel angles per AISC 360-16.', status: 'coming-soon' },
  { category: 'Steel', code: 'AISC 360-16', title: 'AISC 360-16 Steel I-Beam Design', description: 'Design steel I-beams per AISC 360-16.', status: 'coming-soon' },
  { category: 'Steel', code: 'AISC 360-16', title: 'AISC 360-16 Steel Channel Design', description: 'Design steel channels per AISC 360-16.', status: 'coming-soon' },
  { category: 'Steel', code: 'AISC 360-22', title: 'AISC 360-22 Steel Plate Design', description: 'Design plates for minor-axis moment and shear.', status: 'coming-soon', isNew: true },
  { category: 'Steel', code: 'EN 1993-1-1', title: 'EN 1993-1-1 Steel Plate Design', description: 'Design plates for minor-axis moment and shear.', status: 'coming-soon' },
  { category: 'Steel', code: 'AS 4100:2020', title: 'AS 4100:2020 Steel Plate Design', description: 'Design plates for minor-axis moment and shear.', status: 'coming-soon', isNew: true },

  // ─────────── Cold-Formed Steel ───────────
  { category: 'Cold-Formed Steel', code: 'AISI S100-16', title: 'AISI S100-16 Cold-Formed Member Design', description: 'Cold-formed steel members per AISI S100-16.', status: 'coming-soon' },
  { category: 'Cold-Formed Steel', code: 'AS/NZS 4600:2018', title: 'AS/NZS 4600:2018 Cold-Formed Member Design', description: 'Cold-formed steel members per AS/NZS 4600.', status: 'coming-soon' },
  { category: 'Cold-Formed Steel', code: 'AISI S100-16', title: 'AISI S100-16 Purlin Design', description: 'Steel purlins per AISI S100-16.', status: 'coming-soon' },
  { category: 'Cold-Formed Steel', code: 'EN 1993-1-3', title: 'EN 1993-1-3 Purlin Capacity', description: 'Steel purlins per EN 1993-1-3:2006.', status: 'coming-soon' },
  { category: 'Cold-Formed Steel', code: 'AS/NZS 4600:2018', title: 'AS/NZS 4600:2018 Purlin Design', description: 'Steel purlins per AS/NZS 4600:2018.', status: 'coming-soon' },

  // ─────────── Concrete ───────────
  { category: 'Concrete', code: 'ACI 318-19', title: 'ACI 318-19 Concrete Shear Wall Design', description: 'Reinforced concrete walls per ACI 318-19.', status: 'coming-soon' },
  { category: 'Concrete', code: 'ACI 318-19', title: 'ACI 318-19 Concrete Column Design', description: 'Reinforced concrete columns per ACI 318-19.', status: 'coming-soon' },
  { category: 'Concrete', code: 'EN 1992-1-1:2004', title: 'EN 1992-1-1 Concrete Column Design', description: 'Reinforced concrete columns per EN 1992-1-1.', status: 'coming-soon' },
  { category: 'Concrete', code: 'AS 3600:2018', title: 'AS 3600:2018 Concrete Column Design', description: 'Reinforced concrete columns per AS 3600.', status: 'coming-soon' },
  { category: 'Concrete', code: 'NZS 3101:2006', title: 'NZS 3101:2006 Concrete Column Design', description: 'Reinforced concrete columns per NZS 3101.', status: 'coming-soon' },
  { category: 'Concrete', code: 'ACI 318-19', title: 'ACI 318-19 Concrete Beam Design', description: 'Reinforced concrete beams per ACI 318-19.', status: 'available', href: '/resources/beam' },
  { category: 'Concrete', code: 'AS 2870:2011', title: 'AS 2870:2011 Residential Slab Design', description: 'Slab on grade per AS 2870.', status: 'coming-soon' },
  { category: 'Concrete', code: 'CSA A23.3-14', title: 'CSA A23.3-14 Concrete Slab Design', description: 'RC slab resistance per CSA A23.3-14.', status: 'coming-soon' },
  { category: 'Concrete', code: 'ACI 360 R-06', title: 'ACI 360 R-06 Slab on Grade Design', description: 'Slab on grade per ACI 360 R-06.', status: 'coming-soon' },
  { category: 'Concrete', code: 'AS 3600:2018', title: 'AS 3600:2018 Concrete Shear Wall Design', description: 'Reinforced concrete walls per AS 3600.', status: 'coming-soon' },
  { category: 'Concrete', code: 'ACI 318-19', title: 'ACI 318-19 Reinforcement Development & Lap', description: 'Development and lap length per ACI 318-19.', status: 'coming-soon' },
  { category: 'Concrete', code: 'EN 1992-1-1', title: 'EN 1992-1-1 Lap & Anchorage Length', description: 'Development and lap length per EN 1992-1-1.', status: 'coming-soon' },
  { category: 'Concrete', code: 'EN 1992-1-1:2004', title: 'EN 1992-1-1 Concrete Durability', description: 'Nominal cover and minimum concrete class.', status: 'coming-soon' },
  { category: 'Concrete', code: 'AS 3600:2018', title: 'AS 3600:2018 Reinforcement Lap Length', description: 'Development and lap length per AS 3600.', status: 'coming-soon' },
  { category: 'Concrete', code: 'NZS 3101:2006', title: 'NZS 3101:2006 Reinforcement Lap Length', description: 'Development and lap length per NZS 3101.', status: 'coming-soon' },
  { category: 'Concrete', code: 'ACI 318-19 / EN 1992', title: 'Two-way Slab Design', description: 'One-way + two-way RC slab per Method 3 (9 cases) — moments, As, deflection, punching, crack control.', status: 'available', href: '/resources/slab', isNew: true },
  { category: 'Concrete', code: 'ACI 318-19', title: 'ACI 318-19 Punching Shear Design', description: 'Slab punching shear per ACI 318-19.', status: 'available', href: '/resources/slab' },
  { category: 'Concrete', code: 'AS 3600:2018', title: 'AS 3600:2018 Punching Shear Design', description: 'Slab punching shear per AS 3600.', status: 'coming-soon' },
  { category: 'Concrete', code: 'ACI 318-19', title: 'ACI 318-19 Concrete Corbel Design', description: 'Reinforced concrete corbels per ACI 318-19.', status: 'coming-soon' },
  { category: 'Concrete', code: 'EN 1992-1-2', title: 'EN 1992-1-2 Fire Resistance Design', description: 'RC sections for fire action per EN 1992-1-2.', status: 'coming-soon' },
  { category: 'Concrete', code: 'EN 1992-1-1:2004', title: 'EN 1992-1-1 Punching Shear Design', description: 'Slab punching shear per EN 1992-1-1.', status: 'coming-soon' },
  { category: 'Concrete', code: 'AS 3600:2018', title: 'AS 3600:2018 Column Fire Resistance', description: 'FRP of RC column per AS 3600.', status: 'coming-soon' },

  // ─────────── Timber ───────────
  { category: 'Timber', code: 'NDS® 2018', title: 'NDS® 2018 Wood Member Design', description: 'Structural wood members per NDS® 2018.', status: 'coming-soon' },
  { category: 'Timber', code: 'EN 1995-1-1', title: 'EN 1995-1-1 Timber Member Design', description: 'Structural timber members per EN 1995-1-1.', status: 'coming-soon' },
  { category: 'Timber', code: 'AS 1720.1:2010', title: 'AS 1720.1:2010 Timber Member Design', description: 'Structural timber members per AS 1720.1.', status: 'coming-soon' },
  { category: 'Timber', code: 'CSA O86-14', title: 'CSA O86-14 Timber Member Design', description: 'Structural timber members per CSA O86-14.', status: 'coming-soon' },
  { category: 'Timber', code: 'AS 1720:2010', title: 'AS 1720:2010 Timber Connection Design', description: 'Timber connections per AS 1720.', status: 'coming-soon' },
  { category: 'Timber', code: 'AWC 2021', title: 'AWC 2021 Floor Joist Span Calculator', description: 'Max joist span per AWC design values.', status: 'coming-soon' },

  // ─────────── Foundations ───────────
  { category: 'Foundations', code: 'ACI 318-25', title: 'ACI 318-25 Spread Footing Design', description: 'Isolated spread footings per ACI 318-25 SI — bearing, punching, one-way shear, flexure, overturning, sliding, bar fit, dev. length. 2D plan + cross-section + 3D viewer + print report. Auto-design sizes B/L/T and picks rebar.', status: 'available', href: '/resources/foundation-design', isNew: true },
  { category: 'Foundations', code: 'EN 1992-1-1', title: 'EN 1992-1-1 Pad Footing Design', description: 'Pad footings per EN 1992-1-1 and EN 1997-1.', status: 'coming-soon' },
  { category: 'Foundations', code: 'ACI 318-25', title: 'ACI 318-25 Strip Footing Design', description: 'RC strip / wall footings per ACI 318-25 SI — same engine as spread footings, with transverse-only flexure for 1 m strips.', status: 'available', href: '/resources/foundation-design', isNew: true },
  { category: 'Foundations', code: 'ACI 318-25', title: 'ACI 318-25 Combined Footing Design', description: 'Two-column rectangular combined footings per ACI 318-25 §13.3.4 + Wight Ex 15-5. Resultant centring → uniform pressure, BMD/SFD beam analysis, two-way + one-way shear, longitudinal + transverse flexure, bearing-interface + bar fit + dev length checks, full auto-design driver, 3D viewer + branded print report.', status: 'available', href: '/resources/combined-footing', isNew: true },
  { category: 'Foundations', code: 'ACI 318-25', title: 'ACI 318-25 Mat (Raft) Foundation Design', description: 'Multi-column rectangular mat foundations per ACI 318-25 §13.3.4 (rigid method). Bilinear corner pressures, per-column two-way shear with auto-detected αs, bearing-interface, bar fit for 4 mats, strip-method flexure (X + Y), full auto-design driver, 3D viewer with column array + branded print report.', status: 'available', href: '/resources/mat-foundation', isNew: true },
  { category: 'Foundations', code: '—', title: 'Bearing Capacity Calculator', description: 'Bearing capacity using FS approach.', status: 'coming-soon' },
  { category: 'Foundations', code: '—', title: 'Lateral Pile Stability', description: 'Embedment and strength for lateral pile stability.', status: 'coming-soon' },
  { category: 'Foundations', code: 'AISC 360-16 / IBC 2021', title: 'Screw Pile Design', description: 'Steel screw piles per AISC 360 & IBC 2021.', status: 'coming-soon' },
  { category: 'Foundations', code: 'EN 1997-1:2004', title: 'EN 1997-1:2004 Bearing Capacity', description: 'Bearing capacity per EN 1997-1:2004.', status: 'coming-soon' },
  { category: 'Foundations', code: 'AS 4678 / AS 5100', title: 'AS Bearing Capacity', description: 'Bearing capacity per AS 4678-2002 or AS 5100:2017.', status: 'coming-soon' },
  { category: 'Foundations', code: 'ACI 318 / Rankine', title: 'Retaining Wall Design', description: 'Cantilever retaining wall stability + ACI 318 design.', status: 'available', href: '/resources/retaining-wall' },

  // ─────────── Aluminum ───────────
  { category: 'Aluminum', code: 'ADM 2020', title: 'ADM 2020 Aluminum Member Design', description: 'Aluminum members per ADM 2020.', status: 'coming-soon' },
  { category: 'Aluminum', code: 'BS EN 1999-1-1:2023', title: 'BS EN 1999-1-1:2023 Aluminium Design', description: 'Aluminium members per BS EN 1999-1-1:2023.', status: 'coming-soon' },
  { category: 'Aluminum', code: 'BS EN 1999-1-1:2007', title: 'BS EN 1999-1-1:2007 Aluminium Design', description: 'Aluminium members per BS EN 1999-1-1:2007.', status: 'coming-soon' },
  { category: 'Aluminum', code: 'AS/NZS 1664', title: 'AS/NZS 1664 Aluminium Member Design', description: 'Aluminium members per AS/NZS 1664.', status: 'coming-soon' },
  { category: 'Aluminum', code: 'CSA S157-17', title: 'CSA S157-17 Aluminium Member Design', description: 'Aluminium members per CSA S157-17.', status: 'coming-soon' },
  { category: 'Aluminum', code: 'ADM 2015', title: 'ADM 2015 Aluminum Member Design', description: 'Aluminium members per ADM 2015.', status: 'coming-soon' },

  // ─────────── Connections ───────────
  { category: 'Connections', code: 'AISC 360-16', title: 'AISC 360-16 Blodgett Weld Capacity', description: 'Weld groups per AISC 360-16.', status: 'coming-soon' },
  { category: 'Connections', code: 'EN 1993-1-8:2005', title: 'EN 1993-1-8 Weld Group Capacity', description: 'Weld groups per EN 1993-1-8:2005.', status: 'coming-soon' },
  { category: 'Connections', code: 'AS 4100:2020', title: 'AS 4100:2020 Weld Group Capacity', description: 'Weld groups per AS 4100:2020.', status: 'coming-soon' },
  { category: 'Connections', code: 'NZS 3404:1997', title: 'NZS 3404:1997 Weld Group Capacity', description: 'Weld groups per NZS 3404:1997.', status: 'coming-soon' },
  { category: 'Connections', code: 'AISC 360-16', title: 'AISC 360-16 Bolt Group Capacity', description: 'Bolt groups per AISC 360-16.', status: 'coming-soon' },
  { category: 'Connections', code: 'EN 1993-1-8:2005', title: 'EN 1993-1-8 Bolt Group Capacity', description: 'Bolt groups per EN 1993-1-8:2005.', status: 'coming-soon' },
  { category: 'Connections', code: 'AS 4100:2020', title: 'AS 4100:2020 Bolt Group Capacity', description: 'Bolt groups per AS 4100:2020.', status: 'coming-soon' },
  { category: 'Connections', code: 'CSA S16-24', title: 'CSA S16-24 Bolt Group Capacity', description: 'Bolt groups per CSA S16-24.', status: 'coming-soon', isNew: true },
  { category: 'Connections', code: 'NZS 3404:1997', title: 'NZS 3404:1997 Bolt Group Capacity', description: 'Bolt groups per NZS 3404:1997.', status: 'coming-soon' },
  { category: 'Connections', code: 'AISC 360-16', title: 'AISC 360-16 Lifting Lug Design', description: 'Steel lifting lugs per AISC 360-16.', status: 'coming-soon' },
  { category: 'Connections', code: 'AS 4100:2020', title: 'AS 4100:2020 Lifting Lug Design', description: 'Steel lifting lugs per AS 4100:2020.', status: 'coming-soon' },
  { category: 'Connections', code: 'AISC 360-16', title: 'AISC 360-16 Kicker Brace Connection', description: 'Single-angle kicker brace per AISC 360-16.', status: 'coming-soon' },
  { category: 'Connections', code: 'AISC 360-22', title: 'AISC 360-22 Bolt Group Coefficient', description: 'Bolt group coefficient per AISC 360-22.', status: 'coming-soon' },

  // ─────────── Scaffolding ───────────
  { category: 'Scaffolding', code: 'AISC 360-16', title: 'AISC 360-16 Scaffold Member Design', description: 'Scaffolding members per AISC 360-16.', status: 'coming-soon' },
  { category: 'Scaffolding', code: 'BS EN 12811-1:2003', title: 'BS EN 12811-1 Scaffold Member Design', description: 'Scaffolding per BS EN 12811-1:2003 & EN 1993-1-1.', status: 'coming-soon' },
  { category: 'Scaffolding', code: 'AS/NZS 1576:2019', title: 'AS/NZS 1576 Scaffold Member Design', description: 'Scaffolding per AS/NZS 1576.1 & 1576.2.', status: 'coming-soon' },

  // ─────────── Loading ───────────
  { category: 'Loading', code: 'ASCE 7-22', title: 'ASCE 7-22 Wind Load Generator', description: 'MWFRS + C&C wind pressures from site lat/lng lookup.', status: 'available', href: '/resources/load-gen', isNew: true },
  { category: 'Loading', code: 'AS 4055:2021', title: 'AS 4055:2021 Wind Loads for Housing', description: 'Residential wind loading per AS 4055.', status: 'coming-soon' },
  { category: 'Loading', code: 'NBCC 2015', title: 'NBCC 2015 Multi-Roof Snow Drift', description: 'Snow loads per NBCC 2015.', status: 'coming-soon' },
  { category: 'Loading', code: 'AS 1170.4', title: 'AS 1170.4 Seismic Loading Calculator', description: 'Seismic loading per AS 1170.4.', status: 'coming-soon' },
  { category: 'Loading', code: '—', title: 'Load Combination Generator', description: 'Load combinations for all major standards.', status: 'coming-soon' },
  { category: 'Loading', code: 'ASCE 7-16', title: 'ASCE 7-16 Gust-Effect Factor (Imperial)', description: 'Gust-effect factors per ASCE 7-16 (Imperial).', status: 'coming-soon' },
  { category: 'Loading', code: 'ASCE 7-16', title: 'ASCE 7-16 Gust-Effect Factor (Metric)', description: 'Gust-effect factors per ASCE 7-16 (Metric).', status: 'coming-soon' },
  { category: 'Loading', code: 'ASCE 7-22', title: 'ASCE 7-22 Gust-Effect Factor (Imperial)', description: 'Gust-effect factors per ASCE 7-22 (Imperial).', status: 'coming-soon' },
  { category: 'Loading', code: 'ASCE 7-22', title: 'ASCE 7-22 Gust-Effect Factor (Metric)', description: 'Gust-effect factors per ASCE 7-22 (Metric).', status: 'coming-soon' },

  // ─────────── Analysis ───────────
  { category: 'Analysis', code: '—', title: 'Column Analysis', description: 'Analyse columns for axial and bending.', status: 'coming-soon' },
  { category: 'Analysis', code: '—', title: 'Simply Supported Beam Analysis', description: 'Beams with distributed and point loads.', status: 'available', href: '/resources/beam' },
  { category: 'Analysis', code: '—', title: 'Section Properties', description: 'Section properties for any shape.', status: 'available', href: '/resources/section-builder' },
  { category: 'Analysis', code: '—', title: 'Multi-Span Beam Analysis', description: 'Continuous beams, hinges, springs, settlements, thermal — full FEM.', status: 'available', href: '/resources/advanced-beam', isNew: true },
  { category: 'Analysis', code: '—', title: 'Column Buckling Load', description: 'Critical buckling load for compression columns.', status: 'coming-soon' },
  { category: 'Analysis', code: '—', title: '2D Stiffness Method Analysis', description: 'Stiffness matrix + force vector for 2D elements.', status: 'coming-soon' },
  { category: 'Analysis', code: '—', title: 'Cable Sag Analysis', description: 'Pre-tension for a specified cable sag.', status: 'coming-soon' },
  { category: 'Analysis', code: '—', title: 'Cable Tension Analysis', description: 'Cable tension for structural applications.', status: 'coming-soon' },
  { category: 'Analysis', code: '—', title: 'Plate Buckling Stress', description: 'Buckling stresses for steel plates.', status: 'coming-soon' },
  { category: 'Analysis', code: '—', title: 'Tributary Area Load Distribution', description: 'Tributary loads and beam analysis.', status: 'coming-soon' },

  // ─────────── Utility ───────────
  { category: 'Utility', code: '—', title: 'Structural Unit Converter', description: 'Convert length, force, temperature, section units.', status: 'coming-soon' },
  { category: 'Utility', code: '—', title: "Young's Modulus Calculator", description: "Young's Modulus from stress and strain data.", status: 'coming-soon' },
  { category: 'Utility', code: '—', title: "Poisson's Ratio Calculator", description: "Poisson's Ratio from strain or stiffness.", status: 'coming-soon' },
  { category: 'Utility', code: 'Mander 1988', title: 'Concrete Stress-Strain Calculator', description: "Stress–strain per Mander's (1988) theory.", status: 'coming-soon' },
  { category: 'Utility', code: '—', title: 'Sheet Metal K-Factor Calculator', description: 'K-factor for sheet metal bending.', status: 'coming-soon' },
  { category: 'Utility', code: '—', title: 'Bolt Torque Calculator', description: 'Required torque to tighten a bolt.', status: 'coming-soon' },

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
