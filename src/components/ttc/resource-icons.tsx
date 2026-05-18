import React from 'react';

// Three-tier icon system. Each icon uses:
//   • stroke currentColor so it inherits the TTC gold from the card
//   • strokeWidth 1.6 for primary lines, 1.0 for secondary, 0.8 for hatching
//   • opacity 1.0 → 0.6 → 0.35 to set visual hierarchy
//   • 48×48 viewBox, readable down to 24px
const Svg = ({ children }: { children: React.ReactNode }) => (
  <svg
    viewBox="0 0 48 48"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.6"
    width="48"
    height="48"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    {children}
  </svg>
);

export const resourceIcons: Record<string, React.ReactNode> = {
  // Structural 3D analysis — iso wireframe frame with diagonal brace + load
  s3d: (
    <Svg>
      {/* front frame */}
      <path d="M10 14l0 24l18 4l0-24z" />
      {/* back frame receding */}
      <path d="M10 14l10-6l18 2l-10 6" strokeWidth="1.2" opacity="0.7" />
      <path d="M38 10l0 22l-10 6" strokeWidth="1.2" opacity="0.7" />
      {/* diagonal bracing */}
      <path d="M10 14l18 28M28 18l-18 24" strokeWidth="0.9" opacity="0.45" />
      {/* applied load on top */}
      <path d="M18 6v4" />
      <path d="M15 9l3 3l3-3" />
    </Svg>
  ),

  // Simply-supported beam with pin + roller + distributed load arrows
  beam: (
    <Svg>
      {/* distributed load arrows */}
      <path d="M8 8v6M16 8v6M24 8v6M32 8v6M40 8v6" strokeWidth="1.2" opacity="0.8" />
      <path d="M6 14h36" strokeWidth="1" opacity="0.8" />
      {/* beam */}
      <rect x="6" y="18" width="36" height="8" />
      {/* flanges indication */}
      <path d="M6 20h36M6 24h36" strokeWidth="0.8" opacity="0.45" />
      {/* pin support (triangle with hatches) */}
      <path d="M10 26l-4 8h8z" />
      <path d="M4 36h12" />
      <path d="M4 40l4-4M8 40l4-4M12 40l4-4" strokeWidth="0.9" opacity="0.55" />
      {/* roller support (triangle + circle) */}
      <path d="M38 26l-4 6h8z" />
      <circle cx="38" cy="36" r="2" />
      <path d="M30 40h16" />
    </Svg>
  ),

  // Section Builder — I-shape foreground + circle + rectangle library cards
  sectionBuilder: (
    <Svg>
      {/* background cards */}
      <rect x="4" y="28" width="14" height="14" rx="1" strokeWidth="1" opacity="0.55" />
      <circle cx="38" cy="34" r="7" strokeWidth="1" opacity="0.55" />
      {/* foreground I-shape with centroid cross */}
      <path d="M16 6h16v4H26v22h6v4H16v-4h6V10h-6z" />
      <path d="M20 22h8" strokeWidth="1" opacity="0.5" />
      <circle cx="24" cy="22" r="1" fill="currentColor" />
    </Svg>
  ),

  // Continuous (multi-span) beam — 4 supports, wavy deflected shape above
  advancedBeam: (
    <Svg>
      {/* deflected shape hint */}
      <path
        d="M4 14c4 0 4 4 10 4s6-4 10-4 6 4 10 4 4-4 10-4"
        strokeWidth="0.9"
        opacity="0.45"
      />
      {/* beam body */}
      <rect x="4" y="22" width="40" height="6" />
      <path d="M4 24h40" strokeWidth="0.8" opacity="0.45" />
      {/* supports */}
      <path d="M10 28l-3 6h6zM24 28l-3 6h6zM38 28l-3 6h6z" />
      <path d="M4 34h40" strokeWidth="1" />
      {/* first pin detailed */}
      <path d="M5 38l2-2M9 38l2-2M13 38l2-2" strokeWidth="0.9" opacity="0.55" />
    </Svg>
  ),

  // Quick Design — lightning bolt with motion
  quickDesign: (
    <Svg>
      <path d="M28 4L10 26h10l-4 18 18-22H24z" strokeWidth="1.8" />
      <path d="M34 8l4-2M36 14l5-1M38 20l4 0" strokeWidth="0.9" opacity="0.6" />
    </Svg>
  ),

  // Load Generator — building with wind + snow + seismic
  loadGen: (
    <Svg>
      {/* building */}
      <path d="M18 18h18v24H18z" />
      <path d="M22 22h4M30 22h4M22 28h4M30 28h4M22 34h4M30 34h4" strokeWidth="0.9" opacity="0.5" />
      {/* wind arrows from left */}
      <path d="M4 14h10M4 20h12M4 26h9" strokeWidth="1.2" />
      <path d="M14 14l-2-2M14 14l-2 2M16 20l-2-2M16 20l-2 2M13 26l-2-2M13 26l-2 2" strokeWidth="1.2" />
      {/* snow flakes on top */}
      <path d="M24 6v4M22 8h4M25 7l-2 2M23 7l2 2" strokeWidth="0.9" opacity="0.75" />
      <path d="M32 10v4M30 12h4M33 11l-2 2M31 11l2 2" strokeWidth="0.9" opacity="0.75" />
      {/* seismic ground zigzag */}
      <path d="M4 44l4-2 4 2 4-2 4 2 4-2 4 2 4-2 4 2 4-2" strokeWidth="1" opacity="0.7" />
    </Svg>
  ),

  // Connection — two plates bolted + weld bead
  connection: (
    <Svg>
      {/* plates */}
      <rect x="4" y="16" width="22" height="16" />
      <rect x="24" y="16" width="20" height="16" />
      {/* bolts (pattern of 4 with cross-hatching) */}
      <circle cx="12" cy="22" r="2.2" />
      <path d="M12 19.8v4.4M9.8 22h4.4" strokeWidth="0.8" opacity="0.8" />
      <circle cx="18" cy="22" r="2.2" />
      <path d="M18 19.8v4.4M15.8 22h4.4" strokeWidth="0.8" opacity="0.8" />
      <circle cx="12" cy="28" r="2.2" />
      <path d="M12 25.8v4.4M9.8 28h4.4" strokeWidth="0.8" opacity="0.8" />
      <circle cx="18" cy="28" r="2.2" />
      <path d="M18 25.8v4.4M15.8 28h4.4" strokeWidth="0.8" opacity="0.8" />
      {/* weld bead on right edge */}
      <path d="M34 18c1 1 1 3 0 4s-1 3 0 4s1 3 0 4s-1 3 0 4" strokeWidth="1.2" />
      <path d="M40 18c1 1 1 3 0 4s-1 3 0 4s1 3 0 4s-1 3 0 4" strokeWidth="0.9" opacity="0.55" />
    </Svg>
  ),

  // Base Plate — column with fillet welds + anchor bolts + grouted base
  basePlate: (
    <Svg>
      {/* I-column section */}
      <path d="M18 6h12v4h-4v18h4v4H18v-4h4V10h-4z" />
      {/* weld fillets */}
      <path d="M18 32l-2 2M30 32l2 2" strokeWidth="1" opacity="0.55" />
      {/* base plate */}
      <rect x="6" y="32" width="36" height="5" />
      {/* anchor bolts sticking below */}
      <path d="M10 37v6M16 37v6M32 37v6M38 37v6" />
      {/* hex nut heads */}
      <circle cx="10" cy="34.5" r="1" fill="currentColor" />
      <circle cx="16" cy="34.5" r="1" fill="currentColor" />
      <circle cx="32" cy="34.5" r="1" fill="currentColor" />
      <circle cx="38" cy="34.5" r="1" fill="currentColor" />
      {/* grout + ground */}
      <path d="M6 43h36" strokeWidth="1.2" />
      <path d="M6 47l4-4M14 47l4-4M22 47l4-4M30 47l4-4M38 47l4-4" strokeWidth="0.8" opacity="0.5" />
    </Svg>
  ),

  // Spread Footing — pedestal + footing + soil + rebar hints
  foundation: (
    <Svg>
      {/* ground line dashed */}
      <path d="M2 14h44" strokeDasharray="3 3" opacity="0.7" />
      {/* pedestal */}
      <rect x="20" y="4" width="8" height="10" />
      {/* footing */}
      <rect x="8" y="26" width="32" height="10" />
      {/* stem into footing */}
      <rect x="20" y="14" width="8" height="12" />
      {/* rebar grid inside footing */}
      <path d="M12 29h24M12 33h24" strokeWidth="0.8" opacity="0.55" />
      <circle cx="14" cy="31" r="0.7" fill="currentColor" />
      <circle cx="24" cy="31" r="0.7" fill="currentColor" />
      <circle cx="34" cy="31" r="0.7" fill="currentColor" />
      {/* surrounding soil hatching */}
      <path d="M2 40l4-4M10 40l4-4M42 40l4-4" strokeWidth="0.9" opacity="0.5" />
      <path d="M2 44h44" opacity="0.6" />
    </Svg>
  ),

  // RC Design — beam section with stirrups + longitudinal bars
  rcDesign: (
    <Svg>
      {/* concrete outline */}
      <rect x="10" y="8" width="28" height="32" />
      {/* stirrup (inner rect with hook corners) */}
      <path d="M14 12h20v24H14z" strokeWidth="1" opacity="0.6" />
      <path d="M14 14l-2-2M34 14l2-2" strokeWidth="0.8" opacity="0.5" />
      {/* longitudinal bars: 4 corners + 2 mid top/bot */}
      <circle cx="16" cy="14" r="1.6" fill="currentColor" />
      <circle cx="24" cy="14" r="1.6" fill="currentColor" />
      <circle cx="32" cy="14" r="1.6" fill="currentColor" />
      <circle cx="16" cy="34" r="1.6" fill="currentColor" />
      <circle cx="24" cy="34" r="1.6" fill="currentColor" />
      <circle cx="32" cy="34" r="1.6" fill="currentColor" />
      {/* cover hint */}
      <path d="M12 40v3M36 40v3" strokeWidth="0.8" opacity="0.55" />
    </Svg>
  ),

  // Member Design — I-shape with compliance checkmark
  memberDesign: (
    <Svg>
      {/* I shape */}
      <path d="M8 8h20v4H20v24h8v4H8v-4h8V12H8z" />
      {/* applied force + moment arc */}
      <path d="M20 4v2" strokeWidth="0.9" />
      {/* checkmark stamp */}
      <circle cx="36" cy="34" r="8" strokeWidth="1.4" />
      <path d="M32 34l3 3 6-6" strokeWidth="1.8" />
    </Svg>
  ),

  // Composite — concrete slab + steel beam + shear studs
  composite: (
    <Svg>
      {/* concrete slab with hatch */}
      <rect x="4" y="8" width="40" height="10" />
      <path d="M8 12l2-2M14 12l2-2M20 12l2-2M26 12l2-2M32 12l2-2M38 12l2-2" strokeWidth="0.8" opacity="0.55" />
      {/* shear studs */}
      <path d="M12 18v4M20 18v4M28 18v4M36 18v4" strokeWidth="1.4" />
      <circle cx="12" cy="18" r="1" fill="currentColor" />
      <circle cx="20" cy="18" r="1" fill="currentColor" />
      <circle cx="28" cy="18" r="1" fill="currentColor" />
      <circle cx="36" cy="18" r="1" fill="currentColor" />
      {/* steel I-beam below */}
      <path d="M4 22h40v4h-16v12h16v4H4v-4h16V26H4z" />
    </Svg>
  ),

  // Retaining Wall — cantilever profile + soil layers behind + grass
  retaining: (
    <Svg>
      {/* wall L-profile */}
      <path d="M22 6v28M22 34h16v6H4v-6h18M22 14L20 6" strokeWidth="1.4" />
      <rect x="4" y="34" width="34" height="6" />
      <path d="M22 6l-2 28" />
      {/* soil layers behind */}
      <path d="M22 10h22M22 18h22M22 26h22" strokeWidth="0.8" opacity="0.5" />
      {/* pebble dots */}
      <circle cx="30" cy="14" r="0.7" fill="currentColor" opacity="0.7" />
      <circle cx="38" cy="22" r="0.7" fill="currentColor" opacity="0.7" />
      <circle cx="33" cy="28" r="0.7" fill="currentColor" opacity="0.7" />
      {/* grass strip */}
      <path d="M22 6h22" strokeWidth="2" opacity="0.85" />
      {/* pressure arrow */}
      <path d="M16 22l-6 0" strokeWidth="1.2" />
      <path d="M10 22l3-2M10 22l3 2" strokeWidth="1.2" />
      {/* foundation hatching below */}
      <path d="M4 42l3 3M12 42l3 3M20 42l3 3M28 42l3 3M36 42l3 3" strokeWidth="0.8" opacity="0.5" />
    </Svg>
  ),

  // Slab — iso cube with rebar grid
  slab: (
    <Svg>
      {/* top surface (flat plan hint) */}
      <path d="M4 14l20-8 20 8-20 8z" />
      {/* rebar grid on the top plane */}
      <path d="M10 14l20 4M20 9l20 8M14 17l10-5M24 20l10-5" strokeWidth="0.8" opacity="0.55" />
      {/* depth */}
      <path d="M4 14v10l20 8 20-8V14" />
      <path d="M24 22v10" strokeWidth="0.9" opacity="0.45" />
    </Svg>
  ),
};
