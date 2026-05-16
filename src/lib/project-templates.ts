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
 *  - `type` lets templates flag major deliverables as Milestones or
 *    sign-offs as Approvals so the kanban + timeline render the right
 *    glyph from day one (defaults to a regular TASK)
 */
export interface ProjectTemplateTask {
  section: string;
  name: string;
  type?: "TASK" | "MILESTONE" | "APPROVAL";
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
      "Production-grade structural design playbook — kickoff through stamped & sealed deliverables. Five modules cover framing & loads, analysis & member design, detailing per ACI 318, foundations, and documentation. Ships with 35+ parent tasks, key project milestones, and ~150 subtasks so the work plan exists day one. Pre-wires the calc package review workflow.",
    icon: "Building2",
    accent: "amber",
    category: "engineering",
    defaults: { type: "DESIGN", gate: "PRE_DESIGN", color: "#c9a84c" },
    sections: [
      "M1. Framing & Loads",
      "M2. Analysis & Member Design",
      "M3. Detailing per ACI 318",
      "M4. Foundations",
      "M5. Documentation & Issuance",
    ],
    tasks: [
      // ── M1. Framing & Loads ────────────────────────────────────
      {
        section: "M1. Framing & Loads",
        name: "Project kickoff",
        subtasks: [
          "Contract executed & PO received",
          "Project number assigned",
          "Internal kickoff meeting",
          "Client kickoff meeting",
          "Distribution list & RACI confirmed",
        ],
      },
      {
        section: "M1. Framing & Loads",
        name: "Code research & criteria memo",
        subtasks: [
          "Governing building code (IBC / local amendments)",
          "Material standards (ACI 318, AISC 360, ASCE 7)",
          "Risk category & importance factor",
          "Wind speed & exposure (ASCE 7-22 maps)",
          "Seismic SDC & response parameters",
          "Snow load (when applicable)",
          "Issue design criteria memo for client review",
        ],
      },
      {
        section: "M1. Framing & Loads",
        name: "Existing conditions & geotech intake",
        subtasks: [
          "Architectural drawings received",
          "Survey received (boundary + topo)",
          "Geotechnical report received",
          "Allowable bearing pressure & SBC assumptions",
          "Soil class for seismic site coefficients",
        ],
      },
      {
        section: "M1. Framing & Loads",
        name: "Architectural drawings received",
        type: "MILESTONE",
      },
      {
        section: "M1. Framing & Loads",
        name: "Framing strategy",
        subtasks: [
          "Conceptual structural framing options",
          "Material selection (RC / steel / wood / masonry)",
          "Lateral system selection (moment frame / shear wall / braced)",
          "Structural configuration check",
          "Regularity / irregularity check (ASCE 7 §12.3)",
          "Stakeholder review of framing options",
        ],
      },
      {
        section: "M1. Framing & Loads",
        name: "Load take-off",
        subtasks: [
          "Code references & combinations",
          "Dead load (self-weight + superimposed)",
          "Live load (occupancy + reducibles)",
          "Wind pressures by zone",
          "Seismic base shear & vertical distribution",
          "Lateral earth pressures (where applicable)",
          "Snow / rain / other environmental loads",
          "Load combination matrix (ASD + LRFD)",
        ],
      },
      {
        section: "M1. Framing & Loads",
        name: "Slab preliminary sizing",
        subtasks: [
          "Slab system selection (flat / pan-joist / one-way / two-way)",
          "Span-to-depth ratio check (ACI 318 §7.3.1)",
          "1D vs 2D behavior",
          "1D solid slab preliminary depth",
          "1D ribbed (joist) slab depth",
          "2D solid slab preliminary depth",
          "2D ribbed / waffle slab depth",
          "Preliminary slab thickness schedule",
        ],
      },
      {
        section: "M1. Framing & Loads",
        name: "Beam preliminary sizing",
        subtasks: [
          "Support conditions (simple / continuous / cantilever)",
          "Span-to-depth ratio (deflection control)",
          "Preliminary reinforcement ratios",
          "Beams supporting 1D slabs",
          "Beams supporting 2D slabs",
          "Preliminary beam schedule",
        ],
      },
      {
        section: "M1. Framing & Loads",
        name: "Column preliminary sizing",
        subtasks: [
          "Column typology & shape",
          "Tributary area & axial load take-off",
          "Preliminary cross-section per floor",
          "Minimum reinforcement ratio (ACI 318 §10.6.1.1)",
          "Maximum reinforcement ratio (ACI 318 §10.6.1.1)",
          "Column schedule by tier",
          "Worked sizing example",
        ],
      },
      {
        section: "M1. Framing & Loads",
        name: "Foundation preliminary sizing",
        subtasks: [
          "Foundation system selection",
          "Allowable bearing pressure verified",
          "Preliminary footing sizes",
        ],
      },
      {
        section: "M1. Framing & Loads",
        name: "SD package issued",
        type: "MILESTONE",
      },
      // ── M2. Analysis & Member Design ───────────────────────────
      {
        section: "M2. Analysis & Member Design",
        name: "Analysis model setup",
        subtasks: [
          "Geometry from architectural model",
          "Material properties (f'c, fy, E)",
          "Support conditions & restraints",
          "Diaphragm action assumptions",
          "Load patterns (DL / LL / Wx / Wy / Ex / Ey)",
          "Load combinations per ASCE 7-22",
          "Mesh / element size convergence check",
          "Model peer-review",
        ],
      },
      {
        section: "M2. Analysis & Member Design",
        name: "Vertical deflection checks",
        subtasks: [
          "Immediate deflections",
          "Long-term deflections (creep + shrinkage)",
          "Load combinations & sections",
          "Allowable values per IBC Table 1604.3",
          "Deflection report",
        ],
      },
      {
        section: "M2. Analysis & Member Design",
        name: "Lateral drift checks",
        subtasks: [
          "Wind story drifts (ASCE 7 §C.1.2)",
          "Inter-story drift limits",
          "P-delta effects assessment",
        ],
      },
      {
        section: "M2. Analysis & Member Design",
        name: "Seismic analysis checks",
        subtasks: [
          "Modal participation mass ≥ 90%",
          "Period verification",
          "Base shear vs equivalent static (ELF)",
          "Seismic story drifts (ASCE 7 §12.12)",
          "Torsional irregularity check",
        ],
      },
      {
        section: "M2. Analysis & Member Design",
        name: "Member design (ULS)",
        subtasks: [
          "Slab design check",
          "Beam design check",
          "Column design check (P-M interaction)",
          "Shear / torsion check",
          "Critical members called out",
        ],
      },
      {
        section: "M2. Analysis & Member Design",
        name: "Internal QC — analysis review",
        type: "APPROVAL",
      },
      {
        section: "M2. Analysis & Member Design",
        name: "DD package issued",
        type: "MILESTONE",
      },
      // ── M3. Detailing per ACI 318 ──────────────────────────────
      {
        section: "M3. Detailing per ACI 318",
        name: "Detailing fundamentals",
        subtasks: [
          "Cover & spacing requirements",
          "Bond, anchorage & development",
          "Standard hooks (ACI 318 §25.3)",
          "Compression anchorage",
          "Splices: lap, mechanical, welded",
          "Tension development length Ld (ACI 318 §25.4.2)",
          "Hooked development Ldh (ACI 318 §25.4.3)",
          "Compression development Ldc (ACI 318 §25.4.9)",
          "Class A vs Class B tension splices",
          "Compression splices",
        ],
      },
      {
        section: "M3. Detailing per ACI 318",
        name: "Column detailing",
        subtasks: [
          "Longitudinal bar layout",
          "Splice location & class",
          "Transverse reinforcement (ties / spirals)",
          "Seismic detailing (special moment frames if SDC ≥ D)",
          "Worked example — anchorage & Ld",
          "Worked example — longitudinal",
          "Worked example — transverse",
        ],
      },
      {
        section: "M3. Detailing per ACI 318",
        name: "Beam detailing",
        subtasks: [
          "Longitudinal top + bottom reinforcement",
          "Anchorage & development at supports",
          "Stirrup spacing per shear demand",
          "Special hoop zones at supports (seismic)",
          "Worked example — longitudinal",
          "Worked example — transverse",
        ],
      },
      {
        section: "M3. Detailing per ACI 318",
        name: "One-way slab / joist detailing",
        subtasks: [
          "Bottom & top bar layout",
          "Shear & transverse reinforcement",
          "Cutoff points & extensions",
          "Worked example",
        ],
      },
      {
        section: "M3. Detailing per ACI 318",
        name: "Two-way slab detailing",
        subtasks: [
          "Column-strip vs middle-strip moments",
          "Slab-with-beams detailing",
          "Slab-without-beams detailing (flat plate)",
          "Punching shear reinforcement (when required)",
        ],
      },
      {
        section: "M3. Detailing per ACI 318",
        name: "Retaining wall detailing",
        subtasks: [
          "Stem reinforcement",
          "Heel & toe reinforcement",
          "Drainage & weep notes",
        ],
      },
      {
        section: "M3. Detailing per ACI 318",
        name: "Stair detailing",
        subtasks: ["Stair flight & landing reinforcement"],
      },
      // ── M4. Foundations ────────────────────────────────────────
      {
        section: "M4. Foundations",
        name: "Geotechnical intake & system selection",
        subtasks: [
          "Geotech report reviewed",
          "Allowable bearing pressure confirmed",
          "Settlement & differential settlement limits",
          "Foundation system selection (footings / mat / piles)",
          "Liquefaction / expansive soil notes",
        ],
      },
      {
        section: "M4. Foundations",
        name: "Spread footings",
        subtasks: [
          "Types by shape (square / rectangular / strip)",
          "Types by position (concentric / eccentric / combined)",
          "Tie & strap beams",
          "Geotechnical checks",
          "Bearing capacity (ultimate vs allowable)",
          "Bearing capacity worked example",
          "Settlement (immediate + consolidation)",
          "Average & peak soil pressures",
          "Structural design — one-way shear",
          "Structural design — two-way / punching shear",
          "Flexural design",
          "Strap beam design",
          "Concentric footing example",
          "Eccentric footing example",
          "Combined footing example",
        ],
      },
      {
        section: "M4. Foundations",
        name: "Mat foundations",
        subtasks: [
          "Mat behavior under loading",
          "Subgrade modulus (k) selection",
          "k computation from plate-load test",
          "Mat types (uniform thickness / cellular / piled-mat)",
          "Mat preliminary sizing",
          "Geotechnical checks",
          "Structural checks (FE / equivalent frame)",
          "Reinforcement layout",
          "Mat design example",
        ],
      },
      {
        section: "M4. Foundations",
        name: "Deep foundations",
        subtasks: [
          "Deep foundation behavior",
          "Pile typology (driven / drilled / micropile)",
          "Pile geometry & spacing",
          "Geotechnical design",
          "Tip resistance — analytical method (Meyerhof / Vesić)",
          "Shaft resistance — analytical method",
          "Semi-empirical methods (SPT / CPT)",
          "Structural capacity (axial + lateral)",
          "Pile cap behavior — single load case",
          "Pile cap behavior — combined load",
          "Pile design example",
          "Pile cap design example",
        ],
      },
      {
        section: "M4. Foundations",
        name: "Foundation design complete",
        type: "MILESTONE",
      },
      // ── M5. Documentation & Issuance ───────────────────────────
      {
        section: "M5. Documentation & Issuance",
        name: "Drawing package",
        subtasks: [
          "Sheet list & numbering",
          "General notes & abbreviations",
          "Foundation plan",
          "Foundation details",
          "Column schedule & details",
          "Beam schedule & details",
          "Slab plans & details",
          "Retaining wall plans & details",
          "Special elements (transfer / cantilever / openings)",
          "Cross-references between sheets verified",
        ],
      },
      {
        section: "M5. Documentation & Issuance",
        name: "Calculation package",
        subtasks: [
          "Cover sheet & seal block",
          "Design criteria summary",
          "Load take-offs",
          "Member design calcs",
          "Foundation design calcs",
          "Lateral analysis report",
          "Software output exhibits",
        ],
      },
      {
        section: "M5. Documentation & Issuance",
        name: "Specifications & quantity take-off",
        subtasks: [
          "Concrete specifications",
          "Reinforcement specifications",
          "Quantity take-off (rebar, concrete, formwork)",
          "Special inspection schedule",
        ],
      },
      {
        section: "M5. Documentation & Issuance",
        name: "Internal QC — final review",
        type: "APPROVAL",
      },
      {
        section: "M5. Documentation & Issuance",
        name: "PE stamp & seal",
        type: "MILESTONE",
      },
      {
        section: "M5. Documentation & Issuance",
        name: "Issued for permit",
        type: "MILESTONE",
      },
      {
        section: "M5. Documentation & Issuance",
        name: "Project closeout",
        subtasks: [
          "Archive stamped set (PDF + native files)",
          "Submittals log handover",
          "RFI log handover",
          "Lessons learned debrief",
          "Final invoice issued",
        ],
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
