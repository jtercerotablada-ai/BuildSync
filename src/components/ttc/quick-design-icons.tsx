import React from 'react';
import type { ToolCategory } from '@/lib/resources/quick-design-tools';

// Detailed category icons — each one carries a specific engineering artifact
// characteristic of that discipline, so a glance at the card tells you
// whether you're looking at Steel, Timber, Concrete, etc.
//
// Design rules:
//   • viewBox 48×48, stroke currentColor (inherits TTC gold)
//   • three-tier weight + opacity: 1.6 · 1.0 opacity primary,
//     1.1 · 0.65 secondary, 0.85 · 0.4 detail/hatch
//   • each icon reads cleanly down to 24px so the card-head + group-head
//     sizes both work
const Svg = ({ children }: { children: React.ReactNode }) => (
  <svg
    viewBox="0 0 48 48"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.6"
    width="40"
    height="40"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    {children}
  </svg>
);

export const CATEGORY_ICONS: Record<ToolCategory, React.ReactNode> = {
  // W-shape elevation + hot-rolled section stamp
  Steel: (
    <Svg>
      {/* elevation view */}
      <path d="M6 8h14v4H14v24h6v4H6v-4h6V12H6z" />
      {/* section callout line */}
      <path d="M22 24h4" strokeWidth="0.9" opacity="0.6" />
      {/* section view (smaller scale) */}
      <path d="M30 10h12v4h-4v20h4v4H30v-4h4V14h-4z" strokeWidth="1.1" opacity="0.7" />
      {/* dimension ticks */}
      <path d="M44 10v24" strokeWidth="0.8" opacity="0.5" />
      <path d="M43 10h2M43 34h2" strokeWidth="0.8" opacity="0.5" />
    </Svg>
  ),

  // Lipped C-channel with punched holes — cold-formed signature
  'Cold-Formed Steel': (
    <Svg>
      {/* outer profile with return lips */}
      <path d="M10 8h22v4H22v4M10 40h22v-4H22v-4M10 8v32" />
      {/* inner thin-wall line (cold-formed = thin walls) */}
      <path d="M14 12v24M30 16h-6M30 32h-6" strokeWidth="0.9" opacity="0.55" />
      {/* punched access holes */}
      <circle cx="21" cy="20" r="1.6" strokeWidth="1" opacity="0.7" />
      <circle cx="21" cy="28" r="1.6" strokeWidth="1" opacity="0.7" />
    </Svg>
  ),

  // RC section with longitudinal bars + stirrup + hatching
  Concrete: (
    <Svg>
      {/* concrete outline */}
      <rect x="6" y="8" width="36" height="32" />
      {/* inner stirrup */}
      <path d="M10 12h28v24H10z" strokeWidth="1" opacity="0.65" />
      {/* stirrup hook */}
      <path d="M10 14l-2-2" strokeWidth="0.9" opacity="0.55" />
      {/* longitudinal bars top + bottom */}
      <circle cx="13" cy="14" r="1.2" fill="currentColor" />
      <circle cx="19" cy="14" r="1.2" fill="currentColor" />
      <circle cx="25" cy="14" r="1.2" fill="currentColor" />
      <circle cx="31" cy="14" r="1.2" fill="currentColor" />
      <circle cx="13" cy="34" r="1.2" fill="currentColor" />
      <circle cx="19" cy="34" r="1.2" fill="currentColor" />
      <circle cx="25" cy="34" r="1.2" fill="currentColor" />
      <circle cx="31" cy="34" r="1.2" fill="currentColor" />
      {/* concrete fill hatch */}
      <path d="M14 22l6 6M22 20l6 6M30 20l6 6M14 28l6 6" strokeWidth="0.7" opacity="0.35" />
    </Svg>
  ),

  // Log end-grain with annual rings + side grain lines
  Timber: (
    <Svg>
      {/* log outer */}
      <circle cx="24" cy="24" r="16" />
      {/* annual rings (eccentric to simulate heartwood offset) */}
      <ellipse cx="24" cy="23" rx="12" ry="11" strokeWidth="1" opacity="0.6" />
      <ellipse cx="24" cy="23" rx="8" ry="7" strokeWidth="0.9" opacity="0.5" />
      <ellipse cx="24" cy="23" rx="4" ry="3.5" strokeWidth="0.9" opacity="0.45" />
      {/* pith */}
      <circle cx="24" cy="23" r="1" fill="currentColor" opacity="0.7" />
      {/* grain rays */}
      <path d="M18 10l-2-4M30 10l2-4M12 18l-4-2M36 18l4-2" strokeWidth="0.8" opacity="0.45" />
    </Svg>
  ),

  // Spread footing + pedestal + grade line + rebar + soil hatching
  Foundations: (
    <Svg>
      {/* grade line */}
      <path d="M2 14h44" strokeDasharray="3 3" opacity="0.7" />
      {/* column stub above grade */}
      <path d="M20 6h8v8h-8z" />
      {/* footing */}
      <rect x="8" y="22" width="32" height="10" />
      {/* pedestal in soil */}
      <path d="M20 14h8v8h-8z" strokeWidth="1.1" opacity="0.75" />
      {/* rebar dots inside footing */}
      <path d="M12 25h24M12 29h24" strokeWidth="0.8" opacity="0.55" />
      <circle cx="14" cy="27" r="0.8" fill="currentColor" />
      <circle cx="24" cy="27" r="0.8" fill="currentColor" />
      <circle cx="34" cy="27" r="0.8" fill="currentColor" />
      {/* soil hatch below */}
      <path d="M2 40l4-4M10 40l4-4M18 40l4-4M26 40l4-4M34 40l4-4M42 40l4-4" strokeWidth="0.8" opacity="0.45" />
      <path d="M2 44h44" strokeWidth="0.9" opacity="0.55" />
    </Svg>
  ),

  // Aluminum T-extrusion section with thin walls + dimension markers
  Aluminum: (
    <Svg>
      {/* T profile */}
      <path d="M6 8h36v6H28v26h-8V14H6z" />
      {/* inner thin-wall outline (dual-line = extrusion) */}
      <path d="M10 10h28v2M22 16v22" strokeWidth="0.9" opacity="0.55" />
      {/* dimension tick arrows */}
      <path d="M6 44h36" strokeWidth="0.8" opacity="0.55" />
      <path d="M8 42l-2 2l2 2M40 42l2 2l-2 2" strokeWidth="0.8" opacity="0.55" />
    </Svg>
  ),

  // Bolted moment connection — plates, bolt pattern, shear tab, weld
  Connections: (
    <Svg>
      {/* column */}
      <path d="M6 6h4v36H6z" />
      {/* beam I stub */}
      <path d="M14 18h24v4H14zM14 26h24v4H14z" />
      {/* end plate (shear tab) */}
      <rect x="12" y="14" width="3" height="20" strokeWidth="1.1" opacity="0.7" />
      {/* bolt pattern (4 bolts) */}
      <circle cx="13.5" cy="18" r="1.4" />
      <path d="M13.5 16.6v2.8M12.1 18h2.8" strokeWidth="0.7" opacity="0.8" />
      <circle cx="13.5" cy="24" r="1.4" />
      <path d="M13.5 22.6v2.8M12.1 24h2.8" strokeWidth="0.7" opacity="0.8" />
      <circle cx="13.5" cy="30" r="1.4" />
      <path d="M13.5 28.6v2.8M12.1 30h2.8" strokeWidth="0.7" opacity="0.8" />
      {/* weld bead at column-to-plate interface */}
      <path
        d="M11 14c1 1 0 3 1 4s0 3 1 4s0 3 1 4s0 3 1 4"
        strokeWidth="0.9"
        opacity="0.55"
      />
    </Svg>
  ),

  // Multi-tier scaffold with diagonal braces + base plates + deck
  Scaffolding: (
    <Svg>
      {/* uprights */}
      <path d="M10 6v36M24 6v36M38 6v36" strokeWidth="1.4" />
      {/* horizontal ledgers */}
      <path d="M10 14h28M10 24h28M10 34h28" strokeWidth="1.3" />
      {/* cross bracing */}
      <path d="M10 14l14 10M24 14l14 10M10 24l14 10M24 24l14 10" strokeWidth="0.9" opacity="0.55" />
      {/* base plates */}
      <path d="M6 42h8v2H6zM20 42h8v2h-8zM34 42h8v2h-8z" />
      {/* deck hint on top */}
      <path d="M10 6h28" strokeWidth="1.3" />
      <path d="M13 6v-2M18 6v-2M23 6v-2M28 6v-2M33 6v-2" strokeWidth="0.8" opacity="0.55" />
    </Svg>
  ),

  // Multi-load building: wind + snow + seismic arrows on structure
  Loading: (
    <Svg>
      {/* building silhouette */}
      <path d="M18 18h20v20H18z" strokeWidth="1.4" />
      {/* roof line */}
      <path d="M16 18l12-10 12 10" strokeWidth="1.2" />
      {/* wind arrows from left */}
      <path d="M4 14h10M4 20h11M4 26h9" strokeWidth="1.1" />
      <path d="M14 14l-2-2M14 14l-2 2M15 20l-2-2M15 20l-2 2M13 26l-2-2M13 26l-2 2" strokeWidth="1.1" />
      {/* snow flakes on the roof */}
      <path d="M22 6v3M20.5 7.5h3M21.5 6.5l2 2M23.5 6.5l-2 2" strokeWidth="0.8" opacity="0.8" />
      <path d="M34 6v3M32.5 7.5h3M33.5 6.5l2 2M35.5 6.5l-2 2" strokeWidth="0.8" opacity="0.8" />
      {/* seismic ground waves */}
      <path d="M4 44l3-3 3 3 3-3 3 3 3-3 3 3 3-3 3 3 3-3 3 3 3-3 3 3 3-3 3 3" strokeWidth="1" opacity="0.7" />
    </Svg>
  ),

  // Beam with BMD (parabola) above + SFD (step) below + supports
  Analysis: (
    <Svg>
      {/* distributed load arrows */}
      <path d="M10 4v3M18 4v3M26 4v3M34 4v3M42 4v3" strokeWidth="0.9" opacity="0.75" />
      <path d="M6 7h40" strokeWidth="0.9" opacity="0.6" />
      {/* beam */}
      <path d="M6 12h40v3H6z" />
      {/* moment (parabolic) diagram above */}
      <path
        d="M6 18C14 28 34 28 46 18"
        strokeWidth="1.3"
        opacity="0.85"
      />
      {/* shear diagram (linear) below */}
      <path d="M6 38l20-10 20 10" strokeWidth="1.1" opacity="0.65" />
      <path d="M6 42h40" strokeWidth="0.8" opacity="0.4" />
      {/* supports */}
      <path d="M10 15l-3 6h6z" />
      <path d="M42 15l-3 6h6z" />
    </Svg>
  ),

  // Utility — caliper + ruler + pencil crossed
  Utility: (
    <Svg>
      {/* ruler */}
      <rect x="4" y="26" width="36" height="6" transform="rotate(-20 4 26)" />
      <path d="M8 32l2-3M14 34l2-3M20 36l2-3M26 38l2-3M32 40l2-3" strokeWidth="0.8" opacity="0.55" transform="rotate(-20 4 26)" />
      {/* pencil crossing */}
      <path d="M38 8l-22 22" strokeWidth="1.4" />
      <path d="M38 8l4-4l3 3l-4 4z" strokeWidth="1.2" />
      <path d="M13 33l-3 5l5-3z" strokeWidth="1.2" />
      {/* graphite tip */}
      <path d="M13 33l2 2" strokeWidth="1.4" />
    </Svg>
  ),

  // Other — scientific calculator
  Other: (
    <Svg>
      {/* calculator body */}
      <rect x="10" y="4" width="28" height="40" rx="2" />
      {/* display */}
      <rect x="14" y="8" width="20" height="10" strokeWidth="1.1" opacity="0.75" />
      <path d="M30 11l3 0" strokeWidth="0.9" opacity="0.6" />
      <path d="M30 14l3 0" strokeWidth="0.9" opacity="0.6" />
      {/* button grid */}
      <circle cx="17" cy="24" r="1.6" strokeWidth="1" opacity="0.8" />
      <circle cx="24" cy="24" r="1.6" strokeWidth="1" opacity="0.8" />
      <circle cx="31" cy="24" r="1.6" strokeWidth="1" opacity="0.8" />
      <circle cx="17" cy="32" r="1.6" strokeWidth="1" opacity="0.8" />
      <circle cx="24" cy="32" r="1.6" strokeWidth="1" opacity="0.8" />
      <circle cx="31" cy="32" r="1.6" strokeWidth="1" opacity="0.8" />
      <circle cx="17" cy="40" r="1.6" strokeWidth="1" opacity="0.8" />
      <circle cx="24" cy="40" r="1.6" strokeWidth="1" opacity="0.8" />
      <circle cx="31" cy="40" r="1.6" strokeWidth="1" opacity="0.8" />
    </Svg>
  ),
};
