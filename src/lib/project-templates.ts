/**
 * Project templates — Asana-style "Workflow gallery" entries used by
 * the create-project flow. Each template seeds a new project with:
 *   - A meaningful default name placeholder
 *   - A project type / lifecycle gate
 *   - An initial section list (the kanban / list columns)
 *   - Optionally, a workflow-template id to apply after the project is
 *     created (so the user gets rules baked in too)
 *
 * Categories drive the tab filter at the top of the gallery. Engineering
 * categories live alongside the standard Asana ones so users picking
 * a structural / civil project see familiar AEC vocabulary.
 *
 * Used by:
 *   - components/projects/create-project-gallery.tsx (renders cards)
 *   - api/projects POST            (consumes `sections` + `type` + `gate`
 *                                   from the user payload at creation)
 *   - api/projects/[id]/workflow/templates (separately applies the
 *                                   workflow template id when present)
 */

export type ProjectTemplateCategory =
  | "for_you"
  | "engineering"
  | "construction"
  | "operations"
  | "productivity";

/**
 * Pre-baked task within a project template.
 *  - `section` must match one of the template's section names exactly
 *  - `subtasks` create child tasks via Task.parentTaskId
 */
export interface ProjectTemplateTask {
  section: string;
  name: string;
  subtasks?: string[];
}

export interface ProjectTemplate {
  id: string;
  name: string;
  description: string;
  /** Lucide icon name — resolved client-side */
  icon: string;
  /** Soft pastel background used on the card thumbnail */
  accent: "amber" | "blue" | "violet" | "rose" | "emerald" | "slate";
  category: ProjectTemplateCategory;
  /** Default project metadata */
  defaults: {
    type?: "CONSTRUCTION" | "DESIGN" | "RECERTIFICATION" | "PERMIT";
    gate?: "PRE_DESIGN" | "DESIGN" | "PERMITTING" | "CONSTRUCTION" | "CLOSEOUT";
    color?: string;
  };
  /** Initial sections (kanban columns) created when the project is made */
  sections: string[];
  /** Pre-baked tasks (with optional subtasks). Created after the
   *  sections in the order declared here. */
  tasks?: ProjectTemplateTask[];
  /** Optional workflow template id from workflow-templates.ts to apply
   *  immediately after creation. */
  workflowTemplateId?: string;
}

export const PROJECT_TEMPLATES: ProjectTemplate[] = [
  // ── Engineering ────────────────────────────────────────────────
  {
    id: "structural-design",
    name: "Structural design project",
    description:
      "Full structural design playbook in five modules — framing & loads, analysis & sizing, detailing, foundations, documentation. Pre-loaded with 30 parent tasks and 150+ subtasks so the work plan exists from day one. Comes with the calc package review workflow.",
    icon: "Building2",
    accent: "amber",
    category: "engineering",
    defaults: { type: "DESIGN", gate: "PRE_DESIGN", color: "#c9a84c" },
    sections: [
      "M1. Framing & Loads",
      "M2. Analysis & Sizing",
      "M3. Detailing",
      "M4. Foundations",
      "M5. Documentation",
    ],
    tasks: [
      // ── M1. Framing & Loads ────────────────────────────────────
      {
        section: "M1. Framing & Loads",
        name: "Introduction",
        subtasks: [
          "What is structural framing?",
          "Architecture",
          "Soil study",
          "Loads",
          "Pre-sizing",
        ],
      },
      {
        section: "M1. Framing & Loads",
        name: "Loads",
        subtasks: [
          "Introduction & code references",
          "Dead (permanent) load",
          "Live (variable) load",
          "Wind load / action",
          "Seismic load / action",
          "Lateral earth pressures",
          "Other loads",
        ],
      },
      {
        section: "M1. Framing & Loads",
        name: "Slab pre-sizing",
        subtasks: [
          "Introduction",
          "Types & selection",
          "Classification",
          "1D vs 2D behavior",
          "Sections",
          "1D slab pre-sizing",
          "1D solid slabs",
          "1D ribbed slabs",
          "2D slab pre-sizing",
          "2D solid slabs",
          "2D ribbed slabs",
        ],
      },
      {
        section: "M1. Framing & Loads",
        name: "Beam pre-sizing",
        subtasks: [
          "Introduction",
          "Support conditions",
          "Reinforcement ratios",
          "Beams for 1D slabs",
          "Beams for 2D slabs",
        ],
      },
      {
        section: "M1. Framing & Loads",
        name: "Column pre-sizing",
        subtasks: [
          "Introduction & typology",
          "Dimensions",
          "Reinforcement layout",
          "Minimum reinforcement ratio",
          "Maximum reinforcement ratio",
          "Columns in the project",
          "Pre-sizing example",
        ],
      },
      {
        section: "M1. Framing & Loads",
        name: "Foundation pre-sizing",
      },
      {
        section: "M1. Framing & Loads",
        name: "Framing layout",
        subtasks: [
          "Structural configuration",
          "Framing criteria",
          "Structural irregularity",
        ],
      },
      {
        section: "M1. Framing & Loads",
        name: "Framing in practice",
        subtasks: [
          "Example: Building E1 & E2",
          "Framing & pre-sizing — E1",
          "Framing & pre-sizing — E2",
          "Example: House C1",
          "Framing — House C1",
        ],
      },
      // ── M2. Analysis & Sizing ──────────────────────────────────
      {
        section: "M2. Analysis & Sizing",
        name: "Introduction",
        subtasks: ["Objective of this stage", "What we need to verify"],
      },
      {
        section: "M2. Analysis & Sizing",
        name: "Vertical deflections",
        subtasks: [
          "Vertical deflections",
          "Load combinations & sections",
          "Allowable values",
          "Deflections inside CYPECAD",
        ],
      },
      {
        section: "M2. Analysis & Sizing",
        name: "Lateral deflections",
        subtasks: ["Lateral deflections & drifts", "Wind drifts"],
      },
      {
        section: "M2. Analysis & Sizing",
        name: "Seismic analysis checks",
        subtasks: ["Result verifications", "Seismic drifts"],
      },
      {
        section: "M2. Analysis & Sizing",
        name: "ULS verifications",
        subtasks: [
          "Surface element checks",
          "Column checks",
          "Beam checks",
        ],
      },
      // ── M3. Detailing ──────────────────────────────────────────
      {
        section: "M3. Detailing",
        name: "Fundamentals",
        subtasks: [
          "Introduction",
          "Bond & anchorage",
          "Hooked anchorage",
          "Compression anchorage",
          "Splices, laps & overlaps",
          "Development length per ACI",
          "Hooked development per ACI",
          "Compression development per ACI",
          "Tension splices per ACI",
          "Compression splices per ACI",
        ],
      },
      {
        section: "M3. Detailing",
        name: "Columns",
        subtasks: [
          "Introduction",
          "Longitudinal reinforcement",
          "Splices",
          "Transverse reinforcement",
          "CYPECAD settings",
          "CYPECAD editor",
          "Example (anchorage & Ld)",
          "Example (longitudinal)",
          "Example (transverse)",
        ],
      },
      {
        section: "M3. Detailing",
        name: "Beams",
        subtasks: [
          "Longitudinal reinforcement",
          "Development length",
          "Transverse reinforcement",
          "CYPECAD settings",
          "Beam editor",
          "Example (longitudinal reinforcement)",
          "Example (transverse reinforcement)",
        ],
      },
      {
        section: "M3. Detailing",
        name: "1D ribbed slabs",
        subtasks: [
          "Introduction",
          "Longitudinal reinforcement",
          "Shear & transverse reinforcement",
          "CYPE settings",
          "Results editor",
          "Example",
        ],
      },
      {
        section: "M3. Detailing",
        name: "2D ribbed slabs",
        subtasks: [
          "Introduction",
          "CYPE settings",
          "Slab detailing with beams",
          "Slab detailing without beams",
        ],
      },
      {
        section: "M3. Detailing",
        name: "Retaining walls",
        subtasks: ["Introduction", "CYPECAD settings", "Detailing"],
      },
      {
        section: "M3. Detailing",
        name: "Stairs",
        subtasks: ["Introduction", "Settings & detailing"],
      },
      // ── M4. Foundations ────────────────────────────────────────
      {
        section: "M4. Foundations",
        name: "Introduction",
        subtasks: [
          "Introduction",
          "Foundation types",
          "Understanding the soil",
          "Idealization",
          "Verifications",
          "Pre-sizing",
          "Footing pre-sizing",
          "Mat slab pre-sizing",
          "Deep foundation pre-sizing",
        ],
      },
      {
        section: "M4. Foundations",
        name: "Spread footings",
        subtasks: [
          "Fundamentals",
          "Types by shape",
          "Types by position",
          "Tie & strap beams",
          "Geotechnical checks",
          "Bearing capacity",
          "Bearing capacity example",
          "Settlement",
          "Average & peak pressures",
          "Structural checks",
          "Punching shear",
          "Beam-action shear",
          "Flexural design",
          "Strap beams",
          "CYPECAD settings",
          "Concentric footing example",
          "Eccentric footing example",
          "Combined footing example",
        ],
      },
      {
        section: "M4. Foundations",
        name: "Mat foundations",
        subtasks: [
          "Introduction & behavior",
          "Subgrade modulus",
          "Subgrade modulus computation",
          "Mat types",
          "Pre-sizing",
          "Geotechnical checks",
          "Structural checks",
          "CYPECAD settings",
          "Example",
        ],
      },
      {
        section: "M4. Foundations",
        name: "Deep foundations",
        subtasks: [
          "Introduction & behavior",
          "Typology",
          "Geometry",
          "Geotechnical design",
          "Tip resistance — analytical method",
          "Shaft resistance — analytical method",
          "Semi-empirical methods",
          "Structural capacity",
          "Pile cap behavior (part 1)",
          "Pile cap behavior (part 2)",
          "CYPECAD settings",
          "Examples (part 1)",
          "Examples (part 2)",
        ],
      },
      // ── M5. Documentation ──────────────────────────────────────
      {
        section: "M5. Documentation",
        name: "Introduction",
      },
      {
        section: "M5. Documentation",
        name: "Drawings",
        subtasks: [
          "Drawings",
          "Minimum required drawings",
          "Foundations",
          "Foundations — CYPECAD",
          "Columns",
          "Columns — CYPECAD",
          "Slabs",
          "Slabs — CYPECAD",
          "Beams",
          "Beams — CYPECAD",
          "Retaining walls",
          "Retaining walls — CYPECAD",
          "Special elements",
        ],
      },
      {
        section: "M5. Documentation",
        name: "Reports & calculations",
        subtasks: ["Calculation report", "Project reports", "Quantity takeoffs"],
      },
    ],
    workflowTemplateId: "calc-package-review",
  },
  {
    id: "permit-submittal",
    name: "Permit submittal",
    description:
      "Track a permit from preparation through AHJ review, corrections, and approval. Comes with the permit-cycle workflow.",
    icon: "FileBadge",
    accent: "blue",
    category: "engineering",
    defaults: { type: "PERMIT", gate: "PERMITTING", color: "#888888" },
    sections: ["Permit Prep", "Submitted to AHJ", "Corrections", "Approved"],
    workflowTemplateId: "permit-cycle",
  },
  {
    id: "recertification-40yr",
    name: "40-year recertification",
    description:
      "Florida 40-year recertification flow: structural + electrical inspection, report, AHJ submittal, and closeout.",
    icon: "BadgeCheck",
    accent: "violet",
    category: "engineering",
    defaults: { type: "RECERTIFICATION", gate: "PRE_DESIGN", color: "#a8893a" },
    sections: [
      "Site Visit Scheduled",
      "Inspection",
      "Report Drafting",
      "Submitted to AHJ",
      "Approved",
    ],
  },
  {
    id: "civil-site",
    name: "Civil / site engineering",
    description:
      "Grading, drainage, utilities, and site improvements through design, permit, and construction admin.",
    icon: "Map",
    accent: "emerald",
    category: "engineering",
    defaults: { type: "DESIGN", gate: "PRE_DESIGN", color: "#4a4a4a" },
    sections: [
      "Site Investigation",
      "Conceptual Layout",
      "Permit Drawings",
      "Bidding",
      "Construction Admin",
    ],
  },
  {
    id: "qc-gate",
    name: "Internal QC gate",
    description:
      "Three-step QC checkpoint for any deliverable: technical review, comments resolution, sign-off. Comes with the QC workflow.",
    icon: "ShieldCheck",
    accent: "slate",
    category: "engineering",
    defaults: { type: "DESIGN", gate: "DESIGN", color: "#0a0a0a" },
    sections: ["QC Review", "QC Comments", "QC Cleared"],
    workflowTemplateId: "qc-gate",
  },

  // ── Construction ──────────────────────────────────────────────
  {
    id: "construction-build",
    name: "New construction build",
    description:
      "Ground-up build managed across mobilization, foundations, structure, MEP rough-in, finishes, commissioning, and turnover.",
    icon: "Hammer",
    accent: "amber",
    category: "construction",
    defaults: { type: "CONSTRUCTION", gate: "CONSTRUCTION", color: "#c9a84c" },
    sections: [
      "Mobilization",
      "Foundations",
      "Structure",
      "MEP Rough-in",
      "Finishes",
      "Commissioning",
      "Turnover",
    ],
  },
  {
    id: "renovation-retrofit",
    name: "Renovation / retrofit",
    description:
      "Existing-building scope — assessment, design intent, permitted set, construction, and final inspection.",
    icon: "Wrench",
    accent: "blue",
    category: "construction",
    defaults: { type: "CONSTRUCTION", gate: "PRE_DESIGN", color: "#4a4a4a" },
    sections: [
      "Existing Conditions",
      "Design Intent",
      "Permitted Set",
      "Construction",
      "Final Inspection",
    ],
  },
  {
    id: "field-rfi",
    name: "Field RFI tracker",
    description:
      "Log construction-phase RFIs, route to the design team, track turnaround, close with a documented response.",
    icon: "HelpCircle",
    accent: "rose",
    category: "construction",
    defaults: { type: "CONSTRUCTION", gate: "CONSTRUCTION", color: "#a8893a" },
    sections: ["RFI Open", "Response Drafted", "RFI Closed"],
    workflowTemplateId: "rfi-lifecycle",
  },
  {
    id: "submittal-log",
    name: "Submittal log",
    description:
      "Contractor submittals — shop drawings, product data, samples — moving through review and return.",
    icon: "Inbox",
    accent: "violet",
    category: "construction",
    defaults: { type: "CONSTRUCTION", gate: "CONSTRUCTION", color: "#888888" },
    sections: ["Received", "Under Review", "Returned"],
    workflowTemplateId: "submittal-review",
  },
  {
    id: "change-orders",
    name: "Change order register",
    description:
      "Track change orders from initial request through pricing, owner sign-off, and execution.",
    icon: "FilePenLine",
    accent: "emerald",
    category: "construction",
    defaults: { type: "CONSTRUCTION", gate: "CONSTRUCTION", color: "#c9a84c" },
    sections: ["CO Requested", "Pricing", "Pending Owner", "Executed"],
    workflowTemplateId: "change-order",
  },

  // ── Operations ────────────────────────────────────────────────
  {
    id: "bid-pipeline",
    name: "Bid & proposal pipeline",
    description:
      "Sales pipeline for new opportunities — qualify the lead, draft the proposal, submit, win or lose.",
    icon: "Briefcase",
    accent: "blue",
    category: "operations",
    defaults: { color: "#0a0a0a" },
    sections: ["Lead", "Proposal Drafting", "Submitted", "Won", "Lost"],
    workflowTemplateId: "bid-proposal",
  },
  {
    id: "license-renewal",
    name: "License & CEU tracker",
    description:
      "Per-state license renewal cadence: CEU/PDH hours, ethics, state filing, renewed.",
    icon: "BadgeCheck",
    accent: "amber",
    category: "operations",
    defaults: { color: "#a8893a" },
    sections: ["Upcoming", "In Progress", "Renewed"],
    workflowTemplateId: "recertification",
  },
  {
    id: "project-closeout",
    name: "Project closeout",
    description:
      "Final deliverables, archival, and lessons-learned. Useful for closing out any project deliverable workflow.",
    icon: "PackageCheck",
    accent: "slate",
    category: "operations",
    defaults: { gate: "CLOSEOUT", color: "#888888" },
    sections: ["Final Deliverables", "Archived", "Lessons Learned"],
    workflowTemplateId: "project-closeout",
  },

  // ── Productivity ──────────────────────────────────────────────
  {
    id: "weekly-priorities",
    name: "Weekly priorities",
    description:
      "Lightweight personal or team weekly cadence — pick a few things that matter, ship them, repeat.",
    icon: "Target",
    accent: "rose",
    category: "productivity",
    defaults: { color: "#c9a84c" },
    sections: ["This week", "Next week", "Later", "Done"],
  },
  {
    id: "meeting-agenda",
    name: "Meeting agenda & action items",
    description:
      "Capture agenda topics, parking lot, decisions, and action items from recurring meetings.",
    icon: "Users",
    accent: "violet",
    category: "productivity",
    defaults: { color: "#4a4a4a" },
    sections: ["Agenda", "Parking Lot", "Decisions", "Action Items"],
  },
];

export function findProjectTemplate(id: string): ProjectTemplate | undefined {
  return PROJECT_TEMPLATES.find((t) => t.id === id);
}

export const CATEGORY_LABELS: Record<ProjectTemplateCategory, string> = {
  for_you: "For you",
  engineering: "Engineering",
  construction: "Construction",
  operations: "Operations",
  productivity: "Productivity",
};

// "For you" surfaces a curated set — first 6 hand-picked from across
// categories so the default tab feels relevant to an engineering firm.
export const FOR_YOU_TEMPLATE_IDS = [
  "structural-design",
  "permit-submittal",
  "field-rfi",
  "submittal-log",
  "change-orders",
  "bid-pipeline",
];
