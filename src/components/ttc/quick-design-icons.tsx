import React from 'react';
import type { ToolCategory } from '@/lib/resources/quick-design-tools';

const Svg = ({ children }: { children: React.ReactNode }) => (
  <svg
    viewBox="0 0 48 48"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.5"
    width="40"
    height="40"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    {children}
  </svg>
);

export const CATEGORY_ICONS: Record<ToolCategory, React.ReactNode> = {
  Steel: (
    <Svg>
      {/* I-beam section */}
      <path d="M10 8h28M10 40h28" />
      <path d="M20 8v32M28 8v32" />
      <path d="M14 8v4h20V8M14 40v-4h20v4" opacity="0.6" />
    </Svg>
  ),
  'Cold-Formed Steel': (
    <Svg>
      {/* C-shape / lipped channel */}
      <path d="M14 8h20v6H20v20h14v6H14z" />
    </Svg>
  ),
  Concrete: (
    <Svg>
      {/* Rebar grid in a block */}
      <rect x="8" y="10" width="32" height="28" />
      <path d="M8 20h32M8 30h32M16 10v28M24 10v28M32 10v28" opacity="0.5" />
    </Svg>
  ),
  Timber: (
    <Svg>
      {/* Log end-grain + grain lines */}
      <circle cx="24" cy="24" r="16" />
      <path d="M24 10c-6 4-6 14 0 28M24 10c6 4 6 14 0 28" opacity="0.6" />
      <circle cx="24" cy="24" r="4" />
    </Svg>
  ),
  Foundations: (
    <Svg>
      {/* Footing with soil hatches */}
      <path d="M4 32h40v8H4z" />
      <path d="M18 8h12v24H18z" />
      <path d="M6 40l-2 4M14 40l-2 4M22 40l-2 4M30 40l-2 4M38 40l-2 4" opacity="0.5" />
    </Svg>
  ),
  Aluminum: (
    <Svg>
      {/* Extrusion T-section */}
      <path d="M8 8h32v8H28v24h-8V16H8z" />
    </Svg>
  ),
  Connections: (
    <Svg>
      {/* Two plates + bolt circles */}
      <rect x="6" y="12" width="16" height="24" />
      <rect x="26" y="12" width="16" height="24" />
      <circle cx="14" cy="20" r="2" />
      <circle cx="14" cy="28" r="2" />
      <circle cx="34" cy="20" r="2" />
      <circle cx="34" cy="28" r="2" />
    </Svg>
  ),
  Scaffolding: (
    <Svg>
      {/* Scaffold frame */}
      <path d="M10 6v36M38 6v36" />
      <path d="M10 14h28M10 24h28M10 34h28" />
      <path d="M10 14l28 10M10 24l28 10" opacity="0.5" />
    </Svg>
  ),
  Loading: (
    <Svg>
      {/* Wind/snow arrows + roof */}
      <path d="M8 28l16-14 16 14" />
      <path d="M10 10l4 4M10 14l4-4M20 8l4 4M20 12l4-4M30 10l4 4M30 14l4-4" opacity="0.8" />
    </Svg>
  ),
  Analysis: (
    <Svg>
      {/* Beam with diagram curve */}
      <path d="M4 32h40" />
      <path d="M8 32V20c6-6 22-6 32 0v12" />
      <circle cx="8" cy="32" r="2" />
      <circle cx="40" cy="32" r="2" />
    </Svg>
  ),
  Utility: (
    <Svg>
      {/* Wrench + ruler */}
      <path d="M10 38l24-24" />
      <path d="M8 38a4 4 0 003 3l2-2-3-3z" />
      <path d="M34 14a4 4 0 013-3l2 2-3 3z" />
      <path d="M14 34l4 4M18 30l4 4M22 26l4 4M26 22l4 4" opacity="0.5" />
    </Svg>
  ),
  Other: (
    <Svg>
      {/* Calculator */}
      <rect x="10" y="6" width="28" height="36" rx="2" />
      <rect x="14" y="10" width="20" height="8" />
      <circle cx="18" cy="24" r="1.5" />
      <circle cx="24" cy="24" r="1.5" />
      <circle cx="30" cy="24" r="1.5" />
      <circle cx="18" cy="30" r="1.5" />
      <circle cx="24" cy="30" r="1.5" />
      <circle cx="30" cy="30" r="1.5" />
      <circle cx="18" cy="36" r="1.5" />
      <circle cx="24" cy="36" r="1.5" />
      <circle cx="30" cy="36" r="1.5" />
    </Svg>
  ),
};
