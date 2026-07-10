import React from 'react';
import type { ToolCategory } from '@/lib/resources/quick-design-tools';
import { CATEGORY_ICONS } from './quick-design-icons';

// Unique per-tool icons. Each calculator gets its own distinct engineering
// glyph so the catalog is visually scannable. Tools that share the same
// underlying physics across design codes (AISC vs EN vs AS) reuse one icon.
//
// ── Premium duotone system (v2) ──────────────────────────────────────────
// 24-grid, warm dark-ink line work + ONE gold accent per icon (the load, the
// critical point, the action). Hand-tuned for a crafted, cohesive feel.
const INK = '#221e17';
const GOLD = '#c9a84c';
const Ico = ({ children }: { children: React.ReactNode }) => (
  <svg
    viewBox="0 0 24 24"
    fill="none"
    stroke={INK}
    strokeWidth="1.0"
    width="40"
    height="40"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    {children}
  </svg>
);

export const TOOL_ICONS: Record<string, React.ReactNode> = {
  // ───── Steel ─────
  // I-section profile + gold centroidal point & axis ticks (section design)
  steelMember: (
    <Ico>
      <path d="M7 5h10M7 19h10M12 5v14" />
      <path d="M7.5 12h9" stroke={GOLD} strokeWidth="0.9" opacity="0.9" />
      <circle cx="12" cy="12" r="1.4" fill={GOLD} stroke="none" />
    </Ico>
  ),
  // I-beam in elevation + gold applied load
  steelIBeam: (
    <Ico>
      <path d="M4 9h16M4 15h16M4 9v6M20 9v6" />
      <path d="M4 12h16" strokeWidth="0.9" opacity="0.45" />
      <path d="M12 2.6v4.3" stroke={GOLD} strokeWidth="1.1" />
      <path d="M10.3 5.3 12 7l1.7-1.7" stroke={GOLD} strokeWidth="1.1" />
    </Ico>
  ),
  // L angle profile + gold heel (critical corner)
  steelAngle: (
    <Ico>
      <path d="M7 4h2.6v12.4H20V19H7Z" />
      <circle cx="9.6" cy="16.4" r="1.25" fill={GOLD} stroke="none" />
    </Ico>
  ),
  // C channel profile + gold shear-centre marker
  steelChannel: (
    <Ico>
      <path d="M17 5H7v14h10v-2.4H9.4V7.4H17Z" />
      <circle cx="13.2" cy="12" r="1.25" fill={GOLD} stroke="none" />
    </Ico>
  ),
  // Flat plate + gold bending-moment arc
  steelPlate: (
    <Ico>
      <path d="M3 13h18v3H3z" />
      <path d="M8 11.2a4 4 0 0 1 8 0" stroke={GOLD} strokeWidth="1.1" />
      <path d="M16 13.6 14.7 10.9h2.6z" fill={GOLD} stroke="none" />
    </Ico>
  ),
  // Composite slab over I-beam + gold shear studs
  composite: (
    <Ico>
      <path d="M4 6h16v3.6H4z" />
      <path d="M9 13.2h6M12 13.2V19M9 19h6" />
      <path d="M10.5 9.6v3.6M13.5 9.6v3.6" stroke={GOLD} strokeWidth="1.1" />
    </Ico>
  ),

  // ───── Cold-Formed Steel ─────
  // Lipped C cold-formed section + gold fastener holes
  cfsMember: (
    <Ico>
      <path d="M8 5v14M8 5h7v2.5M8 19h7v-2.5" />
      <circle cx="11" cy="10" r="1" fill={GOLD} stroke="none" />
      <circle cx="11" cy="14" r="1" fill={GOLD} stroke="none" />
    </Ico>
  ),
  // Z purlin + gold applied roof load
  cfsPurlin: (
    <Ico>
      <path d="M16 5h-5v14h-5" />
      <path d="M11 4v2.5M11 20v-2.5" strokeWidth="1" opacity="0.5" />
      <path d="M13.5 2.5v3.5" stroke={GOLD} strokeWidth="1.1" />
      <path d="M11.8 4.3 13.5 6l1.7-1.7" stroke={GOLD} strokeWidth="1.1" />
    </Ico>
  ),

  // ───── Concrete ─────
  // RC column section + gold longitudinal rebar
  rcColumn: (
    <Ico>
      <path d="M6 6h12v12H6z" />
      <path d="M8.7 8.7h6.6v6.6H8.7z" strokeWidth="0.8" opacity="0.4" />
      <circle cx="8.7" cy="8.7" r="1.1" fill={GOLD} stroke="none" />
      <circle cx="15.3" cy="8.7" r="1.1" fill={GOLD} stroke="none" />
      <circle cx="8.7" cy="15.3" r="1.1" fill={GOLD} stroke="none" />
      <circle cx="15.3" cy="15.3" r="1.1" fill={GOLD} stroke="none" />
    </Ico>
  ),
  // RC beam section + gold main tension steel
  rcBeam: (
    <Ico>
      <path d="M5 7h14v11H5z" />
      <path d="M7 9h10v7H7z" strokeWidth="0.8" opacity="0.4" />
      <circle cx="8" cy="15.5" r="1" fill={GOLD} stroke="none" />
      <circle cx="12" cy="15.5" r="1" fill={GOLD} stroke="none" />
      <circle cx="16" cy="15.5" r="1" fill={GOLD} stroke="none" />
    </Ico>
  ),
  // Shear wall + gold lateral load
  rcShearWall: (
    <Ico>
      <path d="M9 5h6v15H9z" />
      <path d="M12 5v15M9 10h6M9 15h6" strokeWidth="0.8" opacity="0.4" />
      <path d="M3 7h5.4" stroke={GOLD} strokeWidth="1.1" />
      <path d="M6.7 5.3 8.5 7l-1.8 1.7" stroke={GOLD} strokeWidth="1.1" />
    </Ico>
  ),
  // One-way slab + gold main reinforcement
  rcSlab: (
    <Ico>
      <path d="M5 6h14v12H5z" />
      <path d="M7.5 8v8M10.5 8v8M13.5 8v8M16.5 8v8" stroke={GOLD} strokeWidth="0.95" />
    </Ico>
  ),
  // Slab on grade + gold applied load
  rcSlabOnGrade: (
    <Ico>
      <path d="M4 10h16v3.5H4z" />
      <path d="M5 16l1.6-1.6M9 16l1.6-1.6M13 16l1.6-1.6M17 16l1.6-1.6" strokeWidth="0.9" opacity="0.45" />
      <path d="M12 3.5v4.5" stroke={GOLD} strokeWidth="1.1" />
      <path d="M10.3 6.3 12 8l1.7-1.7" stroke={GOLD} strokeWidth="1.1" />
    </Ico>
  ),
  // Two-way slab + gold two-way reinforcement
  rcSlab2Way: (
    <Ico>
      <path d="M5 6h14v12H5z" />
      <path d="M9.7 6v12M14.3 6v12M5 10h14M5 14h14" strokeWidth="0.8" opacity="0.35" />
      <path d="M12 7.5v9" stroke={GOLD} strokeWidth="1.0" />
      <path d="M6.5 12h11" stroke={GOLD} strokeWidth="1.0" />
    </Ico>
  ),
  // Lap splice — two bars overlap + gold lap length
  rebarLap: (
    <Ico>
      <path d="M3 9h12" strokeWidth="1.15" />
      <path d="M9 15h12" strokeWidth="1.15" />
      <path d="M9 11.5h6" stroke={GOLD} strokeWidth="1.0" />
      <path d="M9 10.7v1.6M15 10.7v1.6" stroke={GOLD} strokeWidth="0.9" />
    </Ico>
  ),
  // Concrete cover / durability — gold cover zone over rebar
  rcDurability: (
    <Ico>
      <path d="M6 6h12v12H6z" />
      <circle cx="9.5" cy="12.5" r="1" stroke={INK} />
      <circle cx="12" cy="12.5" r="1" stroke={INK} />
      <circle cx="14.5" cy="12.5" r="1" stroke={INK} />
      <path d="M7 15.5h10" stroke={GOLD} strokeWidth="1.0" />
    </Ico>
  ),
  // Punching shear — column through slab + gold shear cone
  punching: (
    <Ico>
      <path d="M3 12h18v3.5H3z" />
      <path d="M10 5h4v7h-4z" />
      <path d="M10 12 7 18M14 12l3 6" stroke={GOLD} strokeWidth="1.0" />
      <path d="M7 18h10" stroke={GOLD} strokeWidth="1.0" opacity="0.7" strokeDasharray="2 2" />
    </Ico>
  ),
  // Corbel bracket on column + gold bearing load
  corbel: (
    <Ico>
      <path d="M6 4h2.5v16H6z" />
      <path d="M8.5 8h7l-2.5 5H8.5z" />
      <path d="M12 4.5v4" stroke={GOLD} strokeWidth="1.1" />
      <path d="M10.3 6.8 12 8.5l1.7-1.7" stroke={GOLD} strokeWidth="1.1" />
    </Ico>
  ),
  // Fire resistance — concrete section + gold flame
  fireResistance: (
    <Ico>
      <path d="M7 13h10v6H7z" />
      <path d="M12 3c1.6 2.2.4 3.6.4 5.1.9 0 1.5-.7 1.7-1.6 1.2 1.6 1.2 3.4-.3 4.9-1.3 1.2-3.3.6-3.7-.9-.3-1.3.7-2.2.9-3.1" stroke={GOLD} strokeWidth="1.0" />
    </Ico>
  ),
  // Crack width — concrete block + gold crack
  crackWidth: (
    <Ico>
      <path d="M5 6h14v12H5z" />
      <path d="M11 6l1.5 4-2 2.5 1.5 2.5-1 3" stroke={GOLD} strokeWidth="1.0" />
    </Ico>
  ),

  // ───── Timber ─────
  // Timber beam + gold wood grain
  timberMember: (
    <Ico>
      <path d="M5 8h14v8H5z" />
      <path d="M7 10c3 1.5 8-1.5 11 0M7 13c3 1.5 8-1.5 11 0" stroke={GOLD} strokeWidth="0.9" />
    </Ico>
  ),
  // Lapped timber joint + gold fasteners
  timberConnection: (
    <Ico>
      <path d="M4 8h10v4H4zM10 12h10v4H10z" />
      <circle cx="9" cy="10" r="1.2" fill={GOLD} stroke="none" />
      <circle cx="15" cy="14" r="1.2" fill={GOLD} stroke="none" />
    </Ico>
  ),
  // Floor joists between supports + gold clear span
  timberJoistSpan: (
    <Ico>
      <path d="M4 5v14M20 5v14" strokeWidth="1.0" />
      <path d="M4 8h16M4 12h16M4 16h16" />
      <path d="M5 21h14" stroke={GOLD} strokeWidth="0.95" />
      <path d="M5 21l1.6-1.3M5 21l1.6 1.3M19 21l-1.6-1.3M19 21l-1.6 1.3" stroke={GOLD} strokeWidth="0.95" />
    </Ico>
  ),
  // Sloped rafter + gold roof load
  timberRafter: (
    <Ico>
      <path d="M4 19 12 6l8 13" />
      <path d="M4 19h16" strokeWidth="0.9" opacity="0.5" />
      <path d="M12 1.5v4" stroke={GOLD} strokeWidth="1.1" />
      <path d="M10.4 4 12 5.7l1.6-1.7" stroke={GOLD} strokeWidth="1.1" />
    </Ico>
  ),

  // ───── Foundations ─────
  // Isolated column on a pad + gold soil-bearing pressure
  spreadFooting: (
    <Ico>
      <path d="M3 8h18" strokeWidth="0.9" opacity="0.5" strokeDasharray="2 2" />
      <path d="M11 5h2v8h-2z" />
      <path d="M6 13h12v3.5H6z" />
      <path d="M8 21.5V18M12 21.5V18M16 21.5V18" stroke={GOLD} strokeWidth="1.1" />
      <path d="M6.6 19.4 8 18l1.4 1.4M10.6 19.4 12 18l1.4 1.4M14.6 19.4 16 18l1.4 1.4" stroke={GOLD} strokeWidth="1.1" />
    </Ico>
  ),
  // Continuous wall on a strip + gold bearing pressure
  stripFooting: (
    <Ico>
      <path d="M3 8h18" strokeWidth="0.9" opacity="0.5" strokeDasharray="2 2" />
      <path d="M11.3 4h1.4v9h-1.4z" />
      <path d="M5 13h14v3H5z" />
      <path d="M7 20.5V17.5M12 20.5V17.5M17 20.5V17.5" stroke={GOLD} strokeWidth="1.1" />
      <path d="M5.6 18.9 7 17.5l1.4 1.4M10.6 18.9 12 17.5l1.4 1.4M15.6 18.9 17 17.5l1.4 1.4" stroke={GOLD} strokeWidth="1.1" />
    </Ico>
  ),
  // Two columns on one pad + gold bearing pressure
  combinedFooting: (
    <Ico>
      <path d="M3 8h18" strokeWidth="0.9" opacity="0.5" strokeDasharray="2 2" />
      <path d="M7.5 4h2v9h-2zM14.5 4h2v9h-2z" />
      <path d="M5 13h14v3.2H5z" />
      <path d="M7 20.6V17.6M12 20.6V17.6M17 20.6V17.6" stroke={GOLD} strokeWidth="1.1" />
      <path d="M5.6 19 7 17.6l1.4 1.4M10.6 19 12 17.6l1.4 1.4M15.6 19 17 17.6l1.4 1.4" stroke={GOLD} strokeWidth="1.1" />
    </Ico>
  ),
  // Column array on a raft slab + gold columns
  matFoundation: (
    <Ico>
      <path d="M4 5h16v14H4z" />
      <path d="M4 12h16M9.3 5v14M14.7 5v14" strokeWidth="0.8" opacity="0.4" />
      <rect x="7" y="8.3" width="2" height="2" fill={GOLD} stroke="none" />
      <rect x="11" y="8.3" width="2" height="2" fill={GOLD} stroke="none" />
      <rect x="15" y="8.3" width="2" height="2" fill={GOLD} stroke="none" />
      <rect x="7" y="13.7" width="2" height="2" fill={GOLD} stroke="none" />
      <rect x="11" y="13.7" width="2" height="2" fill={GOLD} stroke="none" />
      <rect x="15" y="13.7" width="2" height="2" fill={GOLD} stroke="none" />
    </Ico>
  ),
  // Footing on soil + gold applied load (over faint failure wedge)
  bearingCapacity: (
    <Ico>
      <path d="M3 11h18" />
      <path d="M9 7h6v4H9z" />
      <path d="M9 11l-3.5 6M15 11l3.5 6M5.5 17q6.5 4 13 0" strokeWidth="1" opacity="0.5" />
      <path d="M12 2.3v4.4" stroke={GOLD} strokeWidth="1.1" />
      <path d="M10.3 5 12 6.7l1.7-1.7" stroke={GOLD} strokeWidth="1.1" />
    </Ico>
  ),
  // Deep pile in soil + gold lateral load
  lateralPile: (
    <Ico>
      <path d="M3 8h18" strokeWidth="0.9" opacity="0.5" strokeDasharray="2 2" />
      <path d="M11.2 5h1.6v15h-1.6z" />
      <path d="M3 7h5.6" stroke={GOLD} strokeWidth="1.1" />
      <path d="M6.9 5.3 8.8 7l-1.9 1.7" stroke={GOLD} strokeWidth="1.1" />
    </Ico>
  ),
  // Pile shaft + gold helical screw plates
  screwPile: (
    <Ico>
      <path d="M12 3v17" />
      <path d="M9 4h6" strokeWidth="0.95" />
      <path d="M7.5 12 16.5 14M7.5 15 16.5 17M7.5 18 16.5 20" stroke={GOLD} strokeWidth="1.0" />
    </Ico>
  ),
  // L cantilever wall + gold triangular earth pressure
  retainingWall: (
    <Ico>
      <path d="M5 4h2.4v12.6H17V19H5Z" />
      <path d="M12 8H7.6M13.5 12H7.6M15 15.5H7.6" stroke={GOLD} strokeWidth="1.0" />
      <path d="M9 6.7 7.6 8l1.4 1.3M9 10.7 7.6 12l1.4 1.3M9 14.2 7.6 15.5l1.4 1.3" stroke={GOLD} strokeWidth="1.0" />
    </Ico>
  ),

  // ───── Aluminum ─────
  // Hollow extruded box section + gold applied load
  aluminumMember: (
    <Ico>
      <path d="M6 7h12v10H6z" />
      <path d="M8.5 9.5h7v5h-7z" strokeWidth="0.9" opacity="0.5" />
      <path d="M12 2.5v3.5" stroke={GOLD} strokeWidth="1.1" />
      <path d="M10.4 4.3 12 6l1.6-1.7" stroke={GOLD} strokeWidth="1.1" />
    </Ico>
  ),
  // Aluminium I-section + gold allowable-load capacity
  aluminumBeam: (
    <Ico>
      <path d="M7 5h10M7 19h10M12 5v14" />
      <path d="M3 12h3.4M17.6 12h3.4" stroke={GOLD} strokeWidth="1.0" />
      <path d="M5.2 10.4 6.6 12 5.2 13.6M18.8 10.4 17.4 12l1.4 1.6" stroke={GOLD} strokeWidth="1.0" />
    </Ico>
  ),

  // ───── Connections ─────
  // T-joint plates + gold fillet weld
  weldGroup: (
    <Ico>
      <path d="M11 4v16M11 11h9" />
      <path d="M11 9 14.5 11 11 13z" fill={GOLD} stroke="none" />
    </Ico>
  ),
  // Plate + gold bolt pattern
  boltGroup: (
    <Ico>
      <path d="M5 5h14v14H5z" />
      <circle cx="9" cy="9" r="1.4" fill={GOLD} stroke="none" />
      <circle cx="15" cy="9" r="1.4" fill={GOLD} stroke="none" />
      <circle cx="9" cy="15" r="1.4" fill={GOLD} stroke="none" />
      <circle cx="15" cy="15" r="1.4" fill={GOLD} stroke="none" />
    </Ico>
  ),
  // Bolt pattern + gold instantaneous centre & eccentric load
  boltGroupCoef: (
    <Ico>
      <circle cx="8" cy="8" r="1.3" stroke={INK} />
      <circle cx="14" cy="8" r="1.3" stroke={INK} />
      <circle cx="8" cy="14" r="1.3" stroke={INK} />
      <circle cx="14" cy="14" r="1.3" stroke={INK} />
      <circle cx="11" cy="11" r="1.1" fill={GOLD} stroke="none" />
      <path d="M11 11 19 6.5" stroke={GOLD} strokeWidth="1.1" />
      <path d="M16.6 6 19 6.5l-.6 2.4" stroke={GOLD} strokeWidth="1.1" />
    </Ico>
  ),
  // Lifting lug plate + gold pin hole
  liftingLug: (
    <Ico>
      <path d="M8 20v-7a4 4 0 0 1 8 0v7" />
      <path d="M8 20h8" />
      <circle cx="12" cy="11" r="2.2" stroke={GOLD} strokeWidth="1.1" />
    </Ico>
  ),
  // Beam + column + gold kicker brace
  kickerBrace: (
    <Ico>
      <path d="M3 6h15" />
      <path d="M16 6v13" />
      <path d="M6 18 15 8" stroke={GOLD} strokeWidth="1.15" />
    </Ico>
  ),
  // Base plate with shear lug + gold shear force
  shearLug: (
    <Ico>
      <path d="M4 9h16v3H4z" />
      <path d="M11 12h2v6h-2z" />
      <path d="M4 15h6.5" stroke={GOLD} strokeWidth="1.1" />
      <path d="M8.9 13.3 10.8 15l-1.9 1.7" stroke={GOLD} strokeWidth="1.1" />
    </Ico>
  ),
  // Spliced members with cover plate + gold bolts
  boltedSplice: (
    <Ico>
      <path d="M3 11h6M15 11h6" strokeWidth="1.15" />
      <path d="M8 7h8v8H8z" strokeWidth="0.9" opacity="0.5" />
      <circle cx="10.5" cy="9.5" r="1.1" fill={GOLD} stroke="none" />
      <circle cx="13.5" cy="9.5" r="1.1" fill={GOLD} stroke="none" />
      <circle cx="10.5" cy="12.5" r="1.1" fill={GOLD} stroke="none" />
      <circle cx="13.5" cy="12.5" r="1.1" fill={GOLD} stroke="none" />
    </Ico>
  ),
  // Column base plate + gold anchor rods
  basePlate: (
    <Ico>
      <path d="M11 4h2v9h-2z" />
      <path d="M6 13h12v2.5H6z" />
      <path d="M3 18h18" strokeWidth="0.8" opacity="0.4" strokeDasharray="2 2" />
      <path d="M8 15.5v3.5M16 15.5v3.5" stroke={GOLD} strokeWidth="1.1" />
    </Ico>
  ),

  // ───── Scaffolding ─────
  // Scaffold frame + gold diagonal bracing
  scaffold: (
    <Ico>
      <path d="M5 4v16M12 4v16M19 4v16" strokeWidth="0.95" />
      <path d="M5 8h14M5 14h14" strokeWidth="0.9" />
      <path d="M5 8 12 14M12 8l7 6" stroke={GOLD} strokeWidth="0.9" />
    </Ico>
  ),

  // ───── Loading ─────
  // Building + gold wind pressure
  windLoad: (
    <Ico>
      <path d="M10 20v-9h8v9" />
      <path d="M8.5 11 14 6.5 19.5 11" />
      <path d="M2 11h5M2 15h6" stroke={GOLD} strokeWidth="1.1" />
      <path d="M5.6 9.8 7 11l-1.4 1.2M6.6 13.8 8 15l-1.4 1.2" stroke={GOLD} strokeWidth="1.1" />
    </Ico>
  ),
  // Roof + gold snow load
  snowLoad: (
    <Ico>
      <path d="M4 12 12 5l8 7" />
      <path d="M4 12h16" strokeWidth="0.9" opacity="0.5" />
      <path d="M7 15v3M12 15v4M17 15v3" stroke={GOLD} strokeWidth="1.1" />
      <path d="M5.6 16.6 7 18l1.4-1.4M10.6 17.6 12 19l1.4-1.4M15.6 16.6 17 18l1.4-1.4" stroke={GOLD} strokeWidth="1.1" />
    </Ico>
  ),
  // Building + gold seismic ground motion
  seismicLoad: (
    <Ico>
      <path d="M9 4h6v13H9z" />
      <path d="M12 4v13" strokeWidth="0.8" opacity="0.4" />
      <path d="M3 20l2-2 2 2 2-2 2 2 2-2 2 2 2-2 2 2" stroke={GOLD} strokeWidth="1.0" />
    </Ico>
  ),
  // Component loads + gold governing combination
  loadCombo: (
    <Ico>
      <path d="M6 6v4M6 14v4" strokeWidth="0.95" />
      <path d="M4.4 8 6 9.6 7.6 8M4.4 16 6 17.6 7.6 16" strokeWidth="0.95" />
      <path d="M14 4v14" stroke={GOLD} strokeWidth="1.15" />
      <path d="M11.8 15.6 14 18l2.2-2.4" stroke={GOLD} strokeWidth="1.15" />
    </Ico>
  ),
  // Wind profile + gold peak gust
  gustFactor: (
    <Ico>
      <path d="M3 7h8M3 17h6" />
      <path d="M9.6 5.8 11 7l-1.4 1.2M7.6 15.8 9 17l-1.4 1.2" />
      <path d="M3 12h13" stroke={GOLD} strokeWidth="1.15" />
      <path d="M14.6 10.8 16 12l-1.4 1.2" stroke={GOLD} strokeWidth="1.15" />
      <path d="M19 4v16" strokeWidth="0.9" opacity="0.45" />
    </Ico>
  ),

  // ───── Analysis ─────
  // Column + gold axial load
  columnAnalysis: (
    <Ico>
      <path d="M10 6h4v13h-4z" />
      <path d="M8 21h8" strokeWidth="0.9" opacity="0.5" />
      <path d="M12 1.5v4" stroke={GOLD} strokeWidth="1.1" />
      <path d="M10.3 4 12 5.7l1.7-1.7" stroke={GOLD} strokeWidth="1.1" />
    </Ico>
  ),
  // Simply supported beam + gold point load
  ssBeam: (
    <Ico>
      <path d="M3 11h18" strokeWidth="1.15" />
      <path d="M4 11 6 15H2Z" />
      <path d="M20 11 22 15h-4z" />
      <path d="M12 3v5.5" stroke={GOLD} strokeWidth="1.1" />
      <path d="M10.4 7 12 8.7 13.6 7" stroke={GOLD} strokeWidth="1.1" />
    </Ico>
  ),
  // Section + gold centroidal axes & centroid
  sectionProperties: (
    <Ico>
      <path d="M6 6h12v3h-4.5v9h-3V9H6z" />
      <path d="M4 11h16M12 4v16" stroke={GOLD} strokeWidth="1" opacity="0.85" strokeDasharray="2 2" />
      <circle cx="12" cy="11" r="1.3" fill={GOLD} stroke="none" />
    </Ico>
  ),
  // Continuous beam + gold deflected shape
  multiSpanBeam: (
    <Ico>
      <path d="M3 10h18" strokeWidth="1.15" />
      <path d="M4 10 5.6 13H2.4zM12 10l1.6 3h-3.2zM20 10l1.6 3h-3.2z" />
      <path d="M3 16q4.5 4 9 0t9 0" stroke={GOLD} strokeWidth="1.1" />
    </Ico>
  ),
  // Buckled column shape + gold critical load
  columnBuckling: (
    <Ico>
      <path d="M12 5c3 2 3 5 0 7s-3 5 0 7" />
      <path d="M10 5h4M10 19h4" strokeWidth="0.9" />
      <path d="M12 1v3.5" stroke={GOLD} strokeWidth="1.1" />
      <path d="M10.3 2.8 12 4.5l1.7-1.7" stroke={GOLD} strokeWidth="1.1" />
    </Ico>
  ),
  // Node grid + gold active DOF
  stiffnessMethod: (
    <Ico>
      <path d="M6 6h12v12H6z" />
      <path d="M6 12h12M12 6v12" strokeWidth="0.8" opacity="0.4" />
      <circle cx="6" cy="6" r="1.2" fill={INK} stroke="none" />
      <circle cx="18" cy="6" r="1.2" fill={INK} stroke="none" />
      <circle cx="6" cy="18" r="1.2" fill={INK} stroke="none" />
      <circle cx="18" cy="18" r="1.2" fill={INK} stroke="none" />
      <circle cx="12" cy="12" r="1.6" fill={GOLD} stroke="none" />
    </Ico>
  ),
  // Sagging cable + gold sag dimension
  cableSag: (
    <Ico>
      <path d="M4 6v4M20 6v4" strokeWidth="0.95" />
      <path d="M4 7c5 11 11 11 16 0" />
      <path d="M12 11.5v4" stroke={GOLD} strokeWidth="1.0" />
      <path d="M10.6 14.1 12 15.5l1.4-1.4" stroke={GOLD} strokeWidth="1.0" />
    </Ico>
  ),
  // Taut inclined cable in gold tension + ink anchors
  cableTension: (
    <Ico>
      <path d="M5 5v3M19 16v3" strokeWidth="0.95" />
      <path d="M5 6.5 19 16.5" stroke={GOLD} strokeWidth="1.15" />
      <path d="M5 6.5 3 5.5M19 16.5l2 1" stroke={GOLD} strokeWidth="1.0" />
    </Ico>
  ),
  // Buckling plate + gold edge compression
  plateBuckling: (
    <Ico>
      <path d="M6 8h12v8H6z" />
      <path d="M8 8c1 2.5 2 2.5 3 0M14 8c-1 2.5-2 2.5-3 0M8 16c1-2.5 2-2.5 3 0M14 16c-1-2.5-2-2.5-3 0" strokeWidth="0.9" opacity="0.5" />
      <path d="M2 12h3.4M18.6 12h3.4" stroke={GOLD} strokeWidth="1.1" />
      <path d="M4 10.4 5.6 12 4 13.6M20 10.4 18.4 12l1.6 1.6" stroke={GOLD} strokeWidth="1.1" />
    </Ico>
  ),
  // Framing grid + gold highlighted tributary strip
  tributaryArea: (
    <Ico>
      <path d="M4 5h16v14H4z" />
      <path d="M4 12h16M9.3 5v14M14.7 5v14" strokeWidth="0.8" opacity="0.4" />
      <path d="M9.3 5h5.4v14h-5.4z" fill={GOLD} fillOpacity="0.18" stroke={GOLD} strokeWidth="0.95" />
    </Ico>
  ),
  // Triangulated truss + gold apex load
  truss2D: (
    <Ico>
      <path d="M3 18 12 6l9 12z" />
      <path d="M7.5 18 12 6M16.5 18 12 6" strokeWidth="0.9" opacity="0.5" />
      <path d="M12 2.5v3.2" stroke={GOLD} strokeWidth="1.1" />
      <path d="M10.3 4.2 12 5.9l1.7-1.7" stroke={GOLD} strokeWidth="1.1" />
    </Ico>
  ),
  // Portal frame + gold lateral load
  frame2D: (
    <Ico>
      <path d="M5 19V7h14v12" />
      <path d="M3.5 19h3M17.5 19h3" strokeWidth="0.9" />
      <path d="M2 7h4" stroke={GOLD} strokeWidth="1.1" />
      <path d="M4.4 5.6 6 7l-1.6 1.4" stroke={GOLD} strokeWidth="1.1" />
    </Ico>
  ),
  // Isometric 3D frame + gold node load
  structural3D: (
    <Ico>
      <path d="M5 8v9l7 4 7-4V8l-7-4z" />
      <path d="M5 8 12 12l7-4M12 12v9" strokeWidth="0.9" opacity="0.5" />
      <path d="M12 1.5v3" stroke={GOLD} strokeWidth="1.1" />
      <path d="M10.3 3 12 4.7l1.7-1.7" stroke={GOLD} strokeWidth="1.1" />
    </Ico>
  ),

  // ───── Utility ─────
  // Two unit boxes + gold convert arrows
  unitConverter: (
    <Ico>
      <path d="M4 5h6v6H4zM14 13h6v6h-6z" />
      <path d="M11 8h6" stroke={GOLD} strokeWidth="1.1" />
      <path d="M15.4 6.4 17 8l-1.6 1.6" stroke={GOLD} strokeWidth="1.1" />
      <path d="M13 16H7" stroke={GOLD} strokeWidth="1.1" />
      <path d="M8.6 14.4 7 16l1.6 1.6" stroke={GOLD} strokeWidth="1.1" />
    </Ico>
  ),
  // Stress-strain axes + gold elastic slope (E)
  youngsModulus: (
    <Ico>
      <path d="M5 19V5M5 19h14" />
      <path d="M5 19 17 7" stroke={GOLD} strokeWidth="1.15" />
    </Ico>
  ),
  // Block + gold axial strain (Poisson)
  poissonRatio: (
    <Ico>
      <path d="M8 8h8v8H8z" />
      <path d="M12 3v3M12 18v3" stroke={GOLD} strokeWidth="1.0" />
      <path d="M10.5 4.5 12 3l1.5 1.5M10.5 19.5 12 21l1.5-1.5" stroke={GOLD} strokeWidth="1.0" />
      <path d="M3 12h3M18 12h3" strokeWidth="1" opacity="0.5" />
    </Ico>
  ),
  // Stress-strain axes + gold curve & yield point
  stressStrain: (
    <Ico>
      <path d="M5 19V5M5 19h14" />
      <path d="M5 19c5-2 7-9 12-11" stroke={GOLD} strokeWidth="1.15" />
      <circle cx="11" cy="12" r="1.1" fill={GOLD} stroke="none" />
    </Ico>
  ),
  // Bent sheet + gold neutral axis (K-factor)
  kFactor: (
    <Ico>
      <path d="M5 6v8a5 5 0 0 0 5 5h6" />
      <path d="M8 6v8a2 2 0 0 0 2 2h6" stroke={GOLD} strokeWidth="1.0" strokeDasharray="2 2" />
    </Ico>
  ),
  // Hex nut + gold rotational torque arrow
  boltTorque: (
    <Ico>
      <path d="M9.4 7.2 12 5.8 14.6 7.2v3l-2.6 1.5-2.6-1.5z" />
      <circle cx="12" cy="8.7" r="1.2" />
      <path d="M6 13.4a6.4 6.4 0 0 0 11.4 1.6" stroke={GOLD} strokeWidth="1.1" />
      <path d="M19.3 13.8 16.6 14.2 17.7 16.7z" fill={GOLD} stroke="none" />
    </Ico>
  ),
  // Section + gold centroidal axes (I, S, Z)
  momentOfInertia: (
    <Ico>
      <path d="M7 8h10v8H7z" />
      <path d="M12 3v18M3 12h18" stroke={GOLD} strokeWidth="1" opacity="0.85" strokeDasharray="2 2" />
      <circle cx="12" cy="12" r="1.3" fill={GOLD} stroke="none" />
    </Ico>
  ),
  // Section table + gold selected entry
  sectionDatabase: (
    <Ico>
      <path d="M4 5h16v4.7H4z" fill={GOLD} fillOpacity="0.16" stroke="none" />
      <path d="M4 5h16v14H4z" />
      <path d="M4 9.7h16M4 14.3h16M12 5v14" strokeWidth="0.9" opacity="0.45" />
    </Ico>
  ),

  // ───── Other ─────
  // Tiled floor + gold cost symbol
  flooringCost: (
    <Ico>
      <path d="M4 11h16v8H4z" />
      <path d="M9.3 11v8M14.7 11v8M4 15h16" strokeWidth="0.8" opacity="0.45" />
      <path d="M12 3v6" stroke={GOLD} strokeWidth="0.95" />
      <path d="M13.7 4.4c0-.9-.8-1.5-1.7-1.5s-1.7.6-1.7 1.5.8 1.4 1.7 1.4 1.7.6 1.7 1.5-.8 1.5-1.7 1.5-1.7-.6-1.7-1.5" stroke={GOLD} strokeWidth="0.95" />
    </Ico>
  ),
  // Roof slope + gold pitch angle
  roofPitch: (
    <Ico>
      <path d="M4 18 14 8l6 10" />
      <path d="M4 18h16" strokeWidth="0.9" opacity="0.5" />
      <path d="M9.5 18a5.5 5.5 0 0 1 1.7-4" stroke={GOLD} strokeWidth="1.0" />
    </Ico>
  ),
  // Spring + gold applied force (Hooke's law)
  hookesLaw: (
    <Ico>
      <path d="M3 12h2.5l1.5-4 3 8 3-8 1.5 4" />
      <path d="M16.5 12H21" stroke={GOLD} strokeWidth="1.1" />
      <path d="M19.4 10.4 21 12l-1.6 1.6" stroke={GOLD} strokeWidth="1.1" />
    </Ico>
  ),
};

const TITLE_TO_KEY: Record<string, string> = {
  // Steel
  'Steel Member Design': 'steelMember',
  'Steel I-Beam Design': 'steelIBeam',
  'Steel Angle Design': 'steelAngle',
  'Steel Channel Design': 'steelChannel',
  'Steel Plate Design': 'steelPlate',
  'I-Beam Load Capacity Check': 'steelIBeam',
  'Composite Beam & Column Design': 'composite',

  // Cold-Formed Steel
  'AISI S100-16 Cold-Formed Member Design': 'cfsMember',
  'AS/NZS 4600:2018 Cold-Formed Member Design': 'cfsMember',
  'AISI S100-16 Purlin Design': 'cfsPurlin',
  'EN 1993-1-3 Purlin Capacity': 'cfsPurlin',
  'AS/NZS 4600:2018 Purlin Design': 'cfsPurlin',

  // Concrete
  'ACI 318-19 Concrete Shear Wall Design': 'rcShearWall',
  'ACI 318-19 Concrete Column Design': 'rcColumn',
  'EN 1992-1-1 Concrete Column Design': 'rcColumn',
  'AS 3600:2018 Concrete Column Design': 'rcColumn',
  'NZS 3101:2006 Concrete Column Design': 'rcColumn',
  'ACI 318-19 Concrete Beam Design': 'rcBeam',
  'AS 2870:2011 Residential Slab Design': 'rcSlabOnGrade',
  'CSA A23.3-14 Concrete Slab Design': 'rcSlab',
  'ACI 360 R-06 Slab on Grade Design': 'rcSlabOnGrade',
  'AS 3600:2018 Concrete Shear Wall Design': 'rcShearWall',
  'ACI 318-19 Reinforcement Development & Lap': 'rebarLap',
  'EN 1992-1-1 Lap & Anchorage Length': 'rebarLap',
  'EN 1992-1-1 Concrete Durability': 'rcDurability',
  'AS 3600:2018 Reinforcement Lap Length': 'rebarLap',
  'NZS 3101:2006 Reinforcement Lap Length': 'rebarLap',
  'Two-way Slab Design': 'rcSlab2Way',
  'ACI 318-19 Punching Shear Design': 'punching',
  'AS 3600:2018 Punching Shear Design': 'punching',
  'ACI 318-19 Concrete Corbel Design': 'corbel',
  'EN 1992-1-2 Fire Resistance Design': 'fireResistance',
  'EN 1992-1-1 Punching Shear Design': 'punching',
  'AS 3600:2018 Column Fire Resistance': 'fireResistance',
  'ACI 318-19 Flexural Crack Width': 'crackWidth',
  'EN 1992-1-1 Crack Width (wₖ)': 'crackWidth',
  'ACI 318-25 RC Beam Design': 'rcBeam',

  // Timber
  'NDS® 2018 Wood Member Design': 'timberMember',
  'EN 1995-1-1 Timber Member Design': 'timberMember',
  'AS 1720.1:2010 Timber Member Design': 'timberMember',
  'CSA O86-14 Timber Member Design': 'timberMember',
  'AS 1720:2010 Timber Connection Design': 'timberConnection',
  'AWC 2021 Floor Joist Span Calculator': 'timberJoistSpan',
  'Sloped Rafter Span Calculator': 'timberRafter',

  // Foundations
  'ACI 318-25 Spread Footing Design': 'spreadFooting',
  'EN 1992-1-1 Pad Footing Design': 'spreadFooting',
  'ACI 318-25 Strip Footing Design': 'stripFooting',
  'ACI 318-25 Combined Footing Design': 'combinedFooting',
  'ACI 318-25 Mat (Raft) Foundation Design': 'matFoundation',
  'Bearing Capacity Calculator': 'bearingCapacity',
  'Lateral Pile Stability': 'lateralPile',
  'Screw Pile Design': 'screwPile',
  'EN 1997-1:2004 Bearing Capacity': 'bearingCapacity',
  'AS Bearing Capacity': 'bearingCapacity',
  'Retaining Wall Design': 'retainingWall',

  // Aluminum
  'ADM 2020 Aluminum Member Design': 'aluminumMember',
  'BS EN 1999-1-1:2023 Aluminium Design': 'aluminumMember',
  'BS EN 1999-1-1:2007 Aluminium Design': 'aluminumMember',
  'AS/NZS 1664 Aluminium Member Design': 'aluminumMember',
  'CSA S157-17 Aluminium Member Design': 'aluminumMember',
  'ADM 2015 Aluminum Member Design': 'aluminumMember',
  'Aluminum Beam Capacity Check': 'aluminumBeam',

  // Connections
  'AISC 360-16 Blodgett Weld Capacity': 'weldGroup',
  'EN 1993-1-8 Weld Group Capacity': 'weldGroup',
  'AS 4100:2020 Weld Group Capacity': 'weldGroup',
  'NZS 3404:1997 Weld Group Capacity': 'weldGroup',
  'AISC 360-16 Bolt Group Capacity': 'boltGroup',
  'EN 1993-1-8 Bolt Group Capacity': 'boltGroup',
  'AS 4100:2020 Bolt Group Capacity': 'boltGroup',
  'CSA S16-24 Bolt Group Capacity': 'boltGroup',
  'NZS 3404:1997 Bolt Group Capacity': 'boltGroup',
  'AISC 360-16 Lifting Lug Design': 'liftingLug',
  'AS 4100:2020 Lifting Lug Design': 'liftingLug',
  'AISC 360-16 Kicker Brace Connection': 'kickerBrace',
  'AISC 360-22 Bolt Group Coefficient': 'boltGroupCoef',
  'Shear Lug Design': 'shearLug',
  'Bolted Splice Connection': 'boltedSplice',
  'Steel Base Plate & Anchor Rod Design': 'basePlate',

  // Scaffolding
  'AISC 360-16 Scaffold Member Design': 'scaffold',
  'BS EN 12811-1 Scaffold Member Design': 'scaffold',
  'AS/NZS 1576 Scaffold Member Design': 'scaffold',

  // Loading
  'ASCE 7-22 Wind Load Generator': 'windLoad',
  'AS 4055:2021 Wind Loads for Housing': 'windLoad',
  'NBCC 2015 Multi-Roof Snow Drift': 'snowLoad',
  'AS 1170.4 Seismic Loading Calculator': 'seismicLoad',
  'Load Combination Generator': 'loadCombo',
  'ASCE 7-16 Gust-Effect Factor (Imperial)': 'gustFactor',
  'ASCE 7-16 Gust-Effect Factor (Metric)': 'gustFactor',
  'ASCE 7-22 Gust-Effect Factor (Imperial)': 'gustFactor',
  'ASCE 7-22 Gust-Effect Factor (Metric)': 'gustFactor',

  // Analysis
  'Column Analysis': 'columnAnalysis',
  'Simply Supported Beam Analysis': 'ssBeam',
  'Section Properties': 'sectionProperties',
  'Multi-Span Beam Analysis': 'multiSpanBeam',
  'Column Buckling Load': 'columnBuckling',
  '2D Stiffness Method Analysis': 'stiffnessMethod',
  'Cable Sag Analysis': 'cableSag',
  'Cable Tension Analysis': 'cableTension',
  'Plate Buckling Stress': 'plateBuckling',
  'Tributary Area Load Distribution': 'tributaryArea',
  '2D Pin-Jointed Truss Solver': 'truss2D',
  '2D Plane Frame Solver': 'frame2D',
  'Structural 3D FEA': 'structural3D',

  // Utility
  'Structural Unit Converter': 'unitConverter',
  "Young's Modulus Calculator": 'youngsModulus',
  "Poisson's Ratio Calculator": 'poissonRatio',
  'Concrete Stress-Strain Calculator': 'stressStrain',
  'Sheet Metal K-Factor Calculator': 'kFactor',
  'Bolt Torque Calculator': 'boltTorque',
  'Moment of Inertia & Centroid': 'momentOfInertia',
  'Steel Section Database': 'sectionDatabase',

  // Other
  'Flooring Cost Calculator': 'flooringCost',
  'Roof Pitch Calculator': 'roofPitch',
  "Hooke's Law Calculator": 'hookesLaw',
};

export function getToolIcon(title: string, category: ToolCategory): React.ReactNode {
  const key = TITLE_TO_KEY[title];
  if (key && TOOL_ICONS[key]) return TOOL_ICONS[key];
  return CATEGORY_ICONS[category];
}
