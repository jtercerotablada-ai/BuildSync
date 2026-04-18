import React from 'react';

const Svg = ({ children }: { children: React.ReactNode }) => (
  <svg
    viewBox="0 0 48 48"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.5"
    width="48"
    height="48"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    {children}
  </svg>
);

export const resourceIcons: Record<string, React.ReactNode> = {
  s3d: (
    <Svg>
      <path d="M24 6l16 8v20l-16 8-16-8V14z" />
      <path d="M8 14l16 8 16-8M24 22v20" />
      <path d="M16 18l16 8M32 18L16 26" opacity="0.5" />
    </Svg>
  ),
  beam: (
    <Svg>
      <path d="M4 20h40M4 20v6h40v-6" />
      <path d="M10 26v10M24 26v10M38 26v10" />
      <path d="M14 14v6M24 10v10M34 14v6" />
      <path d="M14 14l-2-4M14 14l2-4M24 10l-2-4M24 10l2-4M34 14l-2-4M34 14l2-4" />
    </Svg>
  ),
  sectionBuilder: (
    <Svg>
      <rect x="6" y="6" width="14" height="14" />
      <rect x="28" y="6" width="14" height="14" />
      <rect x="6" y="28" width="14" height="14" />
      <path d="M28 28h14v14H28zM28 32h14M32 28v14" />
    </Svg>
  ),
  advancedBeam: (
    <Svg>
      <path d="M4 16h40v16H4z" />
      <circle cx="14" cy="24" r="3" />
      <circle cx="24" cy="24" r="3" />
      <circle cx="34" cy="24" r="3" />
      <path d="M4 20l40 0M4 28l40 0" opacity="0.4" />
    </Svg>
  ),
  quickDesign: (
    <Svg>
      <path d="M28 4L10 26h10l-4 18 18-22H24z" />
    </Svg>
  ),
  loadGen: (
    <Svg>
      <path d="M4 12h28M4 20h24M4 28h32M4 36h20" />
      <path d="M38 10c3 0 5 2 5 5s-2 5-5 5" />
      <path d="M36 26c3 0 5 2 5 5s-2 5-5 5" opacity="0.5" />
    </Svg>
  ),
  connection: (
    <Svg>
      <rect x="4" y="20" width="20" height="8" />
      <rect x="24" y="20" width="20" height="8" />
      <circle cx="24" cy="24" r="3" />
      <path d="M14 14v6M34 14v6M14 28v6M34 28v6" />
    </Svg>
  ),
  basePlate: (
    <Svg>
      <rect x="18" y="6" width="12" height="26" />
      <rect x="4" y="32" width="40" height="6" />
      <circle cx="10" cy="35" r="1.5" fill="currentColor" />
      <circle cx="38" cy="35" r="1.5" fill="currentColor" />
      <path d="M4 42h40" />
    </Svg>
  ),
  foundation: (
    <Svg>
      <path d="M4 14h40" strokeDasharray="2 3" />
      <rect x="8" y="14" width="32" height="10" />
      <rect x="14" y="24" width="20" height="14" />
      <path d="M4 42h40" />
      <path d="M8 42v-4M40 42v-4" opacity="0.5" />
    </Svg>
  ),
  rcDesign: (
    <Svg>
      <rect x="8" y="8" width="32" height="32" />
      <circle cx="14" cy="14" r="1.5" fill="currentColor" />
      <circle cx="24" cy="14" r="1.5" fill="currentColor" />
      <circle cx="34" cy="14" r="1.5" fill="currentColor" />
      <circle cx="14" cy="34" r="1.5" fill="currentColor" />
      <circle cx="24" cy="34" r="1.5" fill="currentColor" />
      <circle cx="34" cy="34" r="1.5" fill="currentColor" />
      <path d="M14 14v20M24 14v20M34 14v20" opacity="0.4" />
    </Svg>
  ),
  memberDesign: (
    <Svg>
      <path d="M6 8h8v32H6zM34 8h8v32h-8z" />
      <path d="M14 22h20v4H14z" />
      <path d="M20 14l-4-4M28 14l4-4M20 34l-4 4M28 34l4 4" opacity="0.5" />
    </Svg>
  ),
  composite: (
    <Svg>
      <path d="M4 14h40v6H4z" />
      <path d="M10 20v18M24 20v18M38 20v18" />
      <path d="M4 38h40" />
      <circle cx="10" cy="28" r="1.5" fill="currentColor" />
      <circle cx="24" cy="28" r="1.5" fill="currentColor" />
      <circle cx="38" cy="28" r="1.5" fill="currentColor" />
    </Svg>
  ),
  retaining: (
    <Svg>
      <path d="M4 42h40" />
      <path d="M8 42V10l10 4v28" />
      <path d="M8 18h40M8 26h38M8 34h36" opacity="0.4" />
      <path d="M18 42h26" />
    </Svg>
  ),
  slab: (
    <Svg>
      <path d="M6 14l18-8 18 8-18 8z" />
      <path d="M6 14v10l18 8 18-8V14" />
      <path d="M14 18l10 4 10-4" opacity="0.4" />
    </Svg>
  ),
};
