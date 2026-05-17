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
 * Custom field definition a template wants the new project to have.
 * Created via prisma.customFieldDefinition + linked via
 * ProjectCustomField when the project is provisioned.
 */
export interface ProjectTemplateCustomField {
  name: string;
  type:
    | "TEXT"
    | "NUMBER"
    | "DATE"
    | "DROPDOWN"
    | "MULTI_SELECT"
    | "PEOPLE"
    | "CHECKBOX"
    | "CURRENCY"
    | "PERCENTAGE";
  /** Required for DROPDOWN / MULTI_SELECT. The `id` is the value
   *  template tasks reference; `label` is what the user sees. */
  options?: { id: string; label: string; color?: string }[];
}

/**
 * Pre-baked task within a project template.
 *  - `section` must match one of the template's section names exactly
 *  - `subtasks` create child tasks via Task.parentTaskId
 *  - `type` lets templates flag major deliverables as Milestones or
 *    sign-offs as Approvals so the kanban + timeline render the right
 *    glyph from day one (defaults to a regular TASK)
 *  - `customFieldValues` pre-fills custom-field values for the task,
 *    keyed by field NAME (must match template.customFields[].name).
 *    For DROPDOWN values pass the option `id`; for MULTI_SELECT pass
 *    an array of ids.
 */
export interface ProjectTemplateTask {
  section: string;
  name: string;
  type?: "TASK" | "MILESTONE" | "APPROVAL";
  subtasks?: string[];
  customFieldValues?: Record<string, unknown>;
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
  /** Initial sections (kanban columns) created when the project is made.
   *  Asana paradigm: sections are workflow STATUS, not project phases.
   *  Phases (when relevant) live in a custom field. */
  sections: string[];
  /** Custom fields the template wants on the project, e.g. "Phase".
   *  Created + linked to the project at provisioning time. */
  customFields?: ProjectTemplateCustomField[];
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
      "Production-grade structural design playbook — kickoff through stamped & sealed deliverables. Asana-style kanban: 5 status columns (To Do → In Progress → Under Review → Approved → Done) with a 'Phase' custom field tagging every task as M1 (Framing & Loads), M2 (Analysis & Member Design), M3 (Detailing per ACI 318), M4 (Foundations), or M5 (Documentation & Issuance). 35+ parent tasks, 170+ subtasks, key milestones, calc-package-review workflow pre-wired.",
    icon: "Building2",
    accent: "amber",
    category: "engineering",
    defaults: { type: "DESIGN", gate: "PRE_DESIGN", color: "#c9a84c" },
    // Asana paradigm: sections are workflow STATUS, not phases. Tasks
    // move left-to-right as they progress. Phase is tracked via the
    // custom field below so the user can filter / group the board by
    // phase without losing kanban flow.
    sections: ["To Do", "In Progress", "Under Review", "Approved", "Done"],
    customFields: [
      {
        name: "Phase",
        type: "DROPDOWN",
        options: [
          { id: "m1", label: "M1. Framing & Loads", color: "#c9a84c" },
          { id: "m2", label: "M2. Analysis & Member Design", color: "#d4b65a" },
          { id: "m3", label: "M3. Detailing per ACI 318", color: "#a8893a" },
          { id: "m4", label: "M4. Foundations", color: "#888888" },
          { id: "m5", label: "M5. Documentation & Issuance", color: "#4a4a4a" },
        ],
      },
    ],
    tasks: [
      // ── Phase M1: Framing & Loads ──────────────────────────────
      {
        section: "To Do",
        name: "Project kickoff",
        customFieldValues: { Phase: "m1" },
        subtasks: [
          "Contract executed & PO received",
          "Project number assigned",
          "Internal kickoff meeting",
          "Client kickoff meeting",
          "Distribution list & RACI confirmed",
        ],
      },
      {
        section: "To Do",
        name: "Code research & criteria memo",
        customFieldValues: { Phase: "m1" },
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
        section: "To Do",
        name: "Existing conditions & geotech intake",
        customFieldValues: { Phase: "m1" },
        subtasks: [
          "Architectural drawings received",
          "Survey received (boundary + topo)",
          "Geotechnical report received",
          "Allowable bearing pressure & SBC assumptions",
          "Soil class for seismic site coefficients",
        ],
      },
      {
        section: "To Do",
        name: "Architectural drawings received",
        type: "MILESTONE",
        customFieldValues: { Phase: "m1" },
      },
      {
        section: "To Do",
        name: "Framing strategy",
        customFieldValues: { Phase: "m1" },
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
        section: "To Do",
        name: "Load take-off",
        customFieldValues: { Phase: "m1" },
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
        section: "To Do",
        name: "Slab preliminary sizing",
        customFieldValues: { Phase: "m1" },
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
        section: "To Do",
        name: "Beam preliminary sizing",
        customFieldValues: { Phase: "m1" },
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
        section: "To Do",
        name: "Column preliminary sizing",
        customFieldValues: { Phase: "m1" },
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
        section: "To Do",
        name: "Foundation preliminary sizing",
        customFieldValues: { Phase: "m1" },
        subtasks: [
          "Foundation system selection",
          "Allowable bearing pressure verified",
          "Preliminary footing sizes",
        ],
      },
      {
        section: "To Do",
        name: "SD package issued",
        type: "MILESTONE",
        customFieldValues: { Phase: "m1" },
      },
      // ── Phase M2: Analysis & Member Design ─────────────────────
      {
        section: "To Do",
        name: "Analysis model setup",
        customFieldValues: { Phase: "m2" },
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
        section: "To Do",
        name: "Vertical deflection checks",
        customFieldValues: { Phase: "m2" },
        subtasks: [
          "Immediate deflections",
          "Long-term deflections (creep + shrinkage)",
          "Load combinations & sections",
          "Allowable values per IBC Table 1604.3",
          "Deflection report",
        ],
      },
      {
        section: "To Do",
        name: "Lateral drift checks",
        customFieldValues: { Phase: "m2" },
        subtasks: [
          "Wind story drifts (ASCE 7 §C.1.2)",
          "Inter-story drift limits",
          "P-delta effects assessment",
        ],
      },
      {
        section: "To Do",
        name: "Seismic analysis checks",
        customFieldValues: { Phase: "m2" },
        subtasks: [
          "Modal participation mass ≥ 90%",
          "Period verification",
          "Base shear vs equivalent static (ELF)",
          "Seismic story drifts (ASCE 7 §12.12)",
          "Torsional irregularity check",
        ],
      },
      {
        section: "To Do",
        name: "Member design (ULS)",
        customFieldValues: { Phase: "m2" },
        subtasks: [
          "Slab design check",
          "Beam design check",
          "Column design check (P-M interaction)",
          "Shear / torsion check",
          "Critical members called out",
        ],
      },
      {
        section: "To Do",
        name: "Internal QC — analysis review",
        type: "APPROVAL",
        customFieldValues: { Phase: "m2" },
      },
      {
        section: "To Do",
        name: "DD package issued",
        type: "MILESTONE",
        customFieldValues: { Phase: "m2" },
      },
      // ── Phase M3: Detailing per ACI 318 ────────────────────────
      {
        section: "To Do",
        name: "Detailing fundamentals",
        customFieldValues: { Phase: "m3" },
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
        section: "To Do",
        name: "Column detailing",
        customFieldValues: { Phase: "m3" },
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
        section: "To Do",
        name: "Beam detailing",
        customFieldValues: { Phase: "m3" },
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
        section: "To Do",
        name: "One-way slab / joist detailing",
        customFieldValues: { Phase: "m3" },
        subtasks: [
          "Bottom & top bar layout",
          "Shear & transverse reinforcement",
          "Cutoff points & extensions",
          "Worked example",
        ],
      },
      {
        section: "To Do",
        name: "Two-way slab detailing",
        customFieldValues: { Phase: "m3" },
        subtasks: [
          "Column-strip vs middle-strip moments",
          "Slab-with-beams detailing",
          "Slab-without-beams detailing (flat plate)",
          "Punching shear reinforcement (when required)",
        ],
      },
      {
        section: "To Do",
        name: "Retaining wall detailing",
        customFieldValues: { Phase: "m3" },
        subtasks: [
          "Stem reinforcement",
          "Heel & toe reinforcement",
          "Drainage & weep notes",
        ],
      },
      {
        section: "To Do",
        name: "Stair detailing",
        customFieldValues: { Phase: "m3" },
        subtasks: ["Stair flight & landing reinforcement"],
      },
      // ── Phase M4: Foundations ──────────────────────────────────
      {
        section: "To Do",
        name: "Geotechnical intake & system selection",
        customFieldValues: { Phase: "m4" },
        subtasks: [
          "Geotech report reviewed",
          "Allowable bearing pressure confirmed",
          "Settlement & differential settlement limits",
          "Foundation system selection (footings / mat / piles)",
          "Liquefaction / expansive soil notes",
        ],
      },
      {
        section: "To Do",
        name: "Spread footings",
        customFieldValues: { Phase: "m4" },
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
        section: "To Do",
        name: "Mat foundations",
        customFieldValues: { Phase: "m4" },
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
        section: "To Do",
        name: "Deep foundations",
        customFieldValues: { Phase: "m4" },
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
        section: "To Do",
        name: "Foundation design complete",
        type: "MILESTONE",
        customFieldValues: { Phase: "m4" },
      },
      // ── Phase M5: Documentation & Issuance ─────────────────────
      {
        section: "To Do",
        name: "Drawing package",
        customFieldValues: { Phase: "m5" },
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
        section: "To Do",
        name: "Calculation package",
        customFieldValues: { Phase: "m5" },
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
        section: "To Do",
        name: "Specifications & quantity take-off",
        customFieldValues: { Phase: "m5" },
        subtasks: [
          "Concrete specifications",
          "Reinforcement specifications",
          "Quantity take-off (rebar, concrete, formwork)",
          "Special inspection schedule",
        ],
      },
      {
        section: "To Do",
        name: "Internal QC — final review",
        type: "APPROVAL",
        customFieldValues: { Phase: "m5" },
      },
      {
        section: "To Do",
        name: "PE stamp & seal",
        type: "MILESTONE",
        customFieldValues: { Phase: "m5" },
      },
      {
        section: "To Do",
        name: "Issued for permit",
        type: "MILESTONE",
        customFieldValues: { Phase: "m5" },
      },
      {
        section: "To Do",
        name: "Project closeout",
        customFieldValues: { Phase: "m5" },
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
    name: "Building recertification",
    description:
      "Production-grade multi-discipline recertification playbook — Florida 40-year (Miami-Dade / Broward) and the post-Surfside Milestone Inspection cadence. Covers structural, electrical, thermography (IR), illumination survey, and parking lot + guardrail inspection. 5 status sections (Asana paradigm) with a 'Discipline' custom field tagging every task plus a 'Severity' field for findings. 38 parent tasks, 200+ subtasks, milestones at each discipline closeout, internal QC approval, and AHJ submittal. Inspection-cycle workflow rules pre-wired.",
    icon: "FileCheck2",
    accent: "violet",
    category: "engineering",
    defaults: { type: "RECERTIFICATION", gate: "PRE_DESIGN", color: "#a8893a" },
    // Asana paradigm: sections are workflow STATUS, not discipline. A
    // finding flows To Do → In Progress → Under Review → Approved → Done.
    // The discipline (which trade is doing the work) lives in the
    // custom field below so the board can be grouped/filtered by trade
    // without breaking the kanban flow.
    sections: ["To Do", "In Progress", "Under Review", "Approved", "Done"],
    customFields: [
      {
        name: "Discipline",
        type: "DROPDOWN",
        options: [
          { id: "engagement", label: "Engagement & Prep", color: "#888888" },
          { id: "structural", label: "Structural", color: "#c9a84c" },
          { id: "electrical", label: "Electrical", color: "#d4b65a" },
          { id: "thermography", label: "Thermography (IR)", color: "#a8893a" },
          { id: "illumination", label: "Illumination", color: "#4a4a4a" },
          { id: "parking_guardrail", label: "Parking & Guardrail", color: "#0a0a0a" },
          { id: "report", label: "Report & Submittal", color: "#94a3b8" },
        ],
      },
      {
        name: "Severity",
        type: "DROPDOWN",
        options: [
          { id: "critical", label: "Critical — immediate", color: "#dc2626" },
          { id: "major", label: "Major — within 6 mo", color: "#f59e0b" },
          { id: "minor", label: "Minor — within 12 mo", color: "#eab308" },
          { id: "monitor", label: "Monitoring only", color: "#94a3b8" },
          { id: "ok", label: "OK / Not applicable", color: "#10b981" },
        ],
      },
    ],
    tasks: [
      // ── Engagement & Preparation ───────────────────────────────
      {
        section: "To Do",
        name: "Project intake & contract",
        customFieldValues: { Discipline: "engagement" },
        subtasks: [
          "Scope of work agreed with owner / property mgmt",
          "Fee proposal issued & signed",
          "Certificate of Insurance delivered",
          "Retainer received",
          "Project number assigned & folder set up",
        ],
      },
      {
        section: "To Do",
        name: "Building documentation request",
        customFieldValues: { Discipline: "engagement" },
        subtasks: [
          "As-built / original construction drawings",
          "Prior recertification or milestone report",
          "Prior repair permits & closeout docs",
          "Deferred maintenance log",
          "Building age & Certificate of Occupancy date",
          "Property management & on-site contact",
        ],
      },
      {
        section: "To Do",
        name: "AHJ research & form selection",
        customFieldValues: { Discipline: "engagement" },
        subtasks: [
          "Confirm jurisdiction (Miami-Dade / Broward / other)",
          "Confirm inspection cycle (40-yr initial, 10-yr recurring)",
          "Pull AHJ recertification form & checklist",
          "Confirm due date & late-filing penalty",
          "Confirm milestone-inspection trigger (FL SB 4-D, condos 3+ stories)",
        ],
      },
      {
        section: "To Do",
        name: "Field team mobilization",
        customFieldValues: { Discipline: "engagement" },
        subtasks: [
          "Schedule access windows with property mgmt",
          "Tenant / resident notification letter",
          "Lift / scaffold / ladder reservations",
          "PPE check (hard hat, harness, IR-safe PPE)",
          "Equipment kit (camera, IR camera, lux meter, moisture meter, crack gauge)",
          "Safety briefing & site-specific hazard review",
        ],
      },
      {
        section: "To Do",
        name: "Pre-inspection package complete",
        type: "MILESTONE",
        customFieldValues: { Discipline: "engagement" },
      },

      // ── Structural Inspection ──────────────────────────────────
      {
        section: "To Do",
        name: "Exterior structural walkthrough",
        customFieldValues: { Discipline: "structural" },
        subtasks: [
          "Façades & cladding visual",
          "Parapet walls & coping",
          "Columns, beams & expansion joints",
          "Foundation wall above grade & weep system",
          "Photo log with elevation tags & compass bearing",
        ],
      },
      {
        section: "To Do",
        name: "Interior structural walkthrough",
        customFieldValues: { Discipline: "structural" },
        subtasks: [
          "Garage levels (slabs, columns, beams)",
          "Mechanical rooms & equipment supports",
          "Common corridors & ceilings",
          "Stairwells & landings",
          "Roof structure from inside (deck, joists, sheathing)",
          "Water intrusion mapping (staining, efflorescence, mold)",
        ],
      },
      {
        section: "To Do",
        name: "Balcony & terrace inspection",
        customFieldValues: { Discipline: "structural" },
        subtasks: [
          "Railing anchorage & corrosion at base plates",
          "Slab edge & soffit condition",
          "Waterproofing membrane integrity",
          "Drain inlets & overflow scuppers",
          "Traffic coating condition",
          "Load-test sample railings per local AHJ requirement",
        ],
      },
      {
        section: "To Do",
        name: "Roof inspection",
        customFieldValues: { Discipline: "structural" },
        subtasks: [
          "Deck & structural condition",
          "Parapet caps & flashings",
          "Drainage & overflow scuppers",
          "Mechanical equipment supports & curbs",
          "Penetrations & roof-mounted attachments",
        ],
      },
      {
        section: "To Do",
        name: "Parking garage post-tensioning check",
        customFieldValues: { Discipline: "structural" },
        subtasks: [
          "Tendon tail condition & corrosion",
          "Anchor wedge inspection",
          "End cap presence & grout pocket",
          "Slab cracking pattern (PT vs RC interpretation)",
        ],
      },
      {
        section: "To Do",
        name: "Distress documentation",
        customFieldValues: { Discipline: "structural" },
        subtasks: [
          "Crack mapping (width, length, orientation)",
          "Spalling & rebar exposure log",
          "Corrosion zone tagging",
          "Moisture-meter readings indexed",
          "Photo log keyed to finding IDs",
        ],
      },
      {
        section: "To Do",
        name: "Structural field inspection complete",
        type: "MILESTONE",
        customFieldValues: { Discipline: "structural" },
      },

      // ── Electrical Inspection ──────────────────────────────────
      {
        section: "To Do",
        name: "Main switchgear inspection",
        customFieldValues: { Discipline: "electrical" },
        subtasks: [
          "Enclosure integrity & corrosion",
          "Working clearance per NEC 110.26",
          "Labels & arc-flash warnings",
          "Door closures & padlocks",
          "Phase identification & legend accuracy",
        ],
      },
      {
        section: "To Do",
        name: "Service equipment & metering",
        customFieldValues: { Discipline: "electrical" },
        subtasks: [
          "Meter bank condition & seals",
          "CT cabinets",
          "Grounding electrode system (GES) inspection",
          "Bonding jumpers continuity",
        ],
      },
      {
        section: "To Do",
        name: "Distribution panels & subpanels",
        customFieldValues: { Discipline: "electrical" },
        subtasks: [
          "Panel covers & dead-fronts in place",
          "Breaker condition & circuit directory",
          "Double-tapped breakers flagged",
          "AIC ratings vs available fault current",
          "Open knockouts & unused openings",
        ],
      },
      {
        section: "To Do",
        name: "Branch circuits & receptacles",
        customFieldValues: { Discipline: "electrical" },
        subtasks: [
          "GFCI protection in wet locations",
          "Receptacle covers in wet / outdoor zones",
          "Polarity test sample",
          "Common-area circuits operational",
        ],
      },
      {
        section: "To Do",
        name: "Emergency power & life safety",
        customFieldValues: { Discipline: "electrical" },
        subtasks: [
          "Generator load test (per NFPA 110)",
          "Fuel tank level & integrity",
          "Automatic transfer switch test",
          "Exit signs illumination & battery backup",
          "Emergency egress lighting 90-min battery test",
        ],
      },
      {
        section: "To Do",
        name: "Grounding & bonding survey",
        customFieldValues: { Discipline: "electrical" },
        subtasks: [
          "GES resistance test (≤ 25 Ω target)",
          "Bonding continuity at major equipment",
          "Equipment grounding conductor verification",
        ],
      },
      {
        section: "To Do",
        name: "Electrical field inspection complete",
        type: "MILESTONE",
        customFieldValues: { Discipline: "electrical" },
      },

      // ── Thermography (IR) Survey ───────────────────────────────
      {
        section: "To Do",
        name: "IR camera calibration & setup",
        customFieldValues: { Discipline: "thermography" },
        subtasks: [
          "Camera calibration cert in date",
          "Ambient temperature & humidity recorded",
          "Emissivity & reflected-T settings per surface",
          "Load condition documented (≥ 40% nameplate load target)",
        ],
      },
      {
        section: "To Do",
        name: "Service entrance & main switchgear scan",
        customFieldValues: { Discipline: "thermography" },
        subtasks: [
          "Each phase under load — line side",
          "Each phase under load — load side",
          "MCCB termination scan",
          "Busbar joint scan",
          "Neutral & ground connection scan",
        ],
      },
      {
        section: "To Do",
        name: "Distribution panel scan",
        customFieldValues: { Discipline: "thermography" },
        subtasks: [
          "Every panel under representative load",
          "Breaker poles ΔT logged",
          "Lug & conductor termination scan",
          "Bus stab connections",
        ],
      },
      {
        section: "To Do",
        name: "Motor, HVAC & elevator equipment scan",
        customFieldValues: { Discipline: "thermography" },
        subtasks: [
          "HVAC compressors & contactors",
          "Elevator motors & resistors",
          "Pump & pool equipment motors",
          "Lighting contactors & relays",
        ],
      },
      {
        section: "To Do",
        name: "Thermography findings log",
        customFieldValues: { Discipline: "thermography" },
        subtasks: [
          "Hot spots ≥ 10°C above baseline flagged",
          "Severity classified by ΔT (NETA / IR convention)",
          "Repair priority assigned",
          "IR + visible photo pairs indexed",
          "Re-scan plan after repairs",
        ],
      },
      {
        section: "To Do",
        name: "IR survey complete",
        type: "MILESTONE",
        customFieldValues: { Discipline: "thermography" },
      },

      // ── Illumination Survey ────────────────────────────────────
      {
        section: "To Do",
        name: "Code & criteria establishment",
        customFieldValues: { Discipline: "illumination" },
        subtasks: [
          "Code reference (IES RP-20 parking / local amendment)",
          "Required foot-candles by zone (entry, drive aisle, stalls, egress)",
          "Uniformity ratio targets (avg/min, max/min)",
          "Egress illumination per IBC 1008 / NFPA 101",
        ],
      },
      {
        section: "To Do",
        name: "Light meter calibration",
        customFieldValues: { Discipline: "illumination" },
        subtasks: [
          "Photometer calibration cert (NIST traceable)",
          "Cosine-corrected meter selected",
          "Dusk + full-dark reading protocol agreed",
        ],
      },
      {
        section: "To Do",
        name: "Parking lot illumination grid",
        customFieldValues: { Discipline: "illumination" },
        subtasks: [
          "Grid layout sketched (typically 10' x 10' or 20' x 20')",
          "Measurements at each grid point logged",
          "Light pole bases inspected for corrosion",
          "Fixture aim & lens condition",
          "Burned-out or missing lamps inventoried",
        ],
      },
      {
        section: "To Do",
        name: "Stairwell & egress illumination",
        customFieldValues: { Discipline: "illumination" },
        subtasks: [
          "FC at egress path floor",
          "Transfer time on simulated power loss",
          "Battery backup duration sample test",
          "Photoluminescent path-marking condition (if installed)",
        ],
      },
      {
        section: "To Do",
        name: "Common area illumination",
        customFieldValues: { Discipline: "illumination" },
        subtasks: [
          "Lobby & elevator landing FC readings",
          "Corridor FC readings",
          "Lamp burnout inventory by area",
          "Color-temperature consistency check",
        ],
      },
      {
        section: "To Do",
        name: "Illumination findings log",
        customFieldValues: { Discipline: "illumination" },
        subtasks: [
          "Deficient zones mapped on as-built plan",
          "Recommended fixture, relamp, or aim adjustment",
          "IES criteria vs measured comparison table",
          "Photometric mock-up attached for major deficiencies",
        ],
      },
      {
        section: "To Do",
        name: "Illumination survey complete",
        type: "MILESTONE",
        customFieldValues: { Discipline: "illumination" },
      },

      // ── Parking Lot & Guardrail Inspection ─────────────────────
      {
        section: "To Do",
        name: "Pavement & surface condition",
        customFieldValues: { Discipline: "parking_guardrail" },
        subtasks: [
          "Cracking, potholes, rutting",
          "ADA accessible route slope & cross-slope",
          "Striping & wayfinding paint",
          "ADA stall count & van-accessible per IBC 1106",
          "Drainage swales & catch basins",
        ],
      },
      {
        section: "To Do",
        name: "Curbs, wheel stops & bumpers",
        customFieldValues: { Discipline: "parking_guardrail" },
        subtasks: [
          "Curb height & damage",
          "Wheel-stop attachment & displacement",
          "Missing or broken units inventoried",
        ],
      },
      {
        section: "To Do",
        name: "Vehicle guardrails & bollards",
        customFieldValues: { Discipline: "parking_guardrail" },
        subtasks: [
          "Anchorage to slab inspected",
          "Deflection on lateral push test",
          "Height per IBC 1015.3 (≥ 42\")",
          "Vehicle impact rating verified for ramp & garage applications",
          "Corrosion at base plates & welds",
          "Bollard at fuel / utility / glazing locations",
        ],
      },
      {
        section: "To Do",
        name: "Pedestrian guardrails & handrails",
        customFieldValues: { Discipline: "parking_guardrail" },
        subtasks: [
          "Top rail height (≥ 42\" guard, 34-38\" handrail)",
          "Baluster spacing ≤ 4\" sphere",
          "Anchorage condition at base",
          "Load-test sample per local AHJ requirement",
          "Continuous handrail at stairs both sides per IBC 1011",
        ],
      },
      {
        section: "To Do",
        name: "Signage, pole bases & drainage",
        customFieldValues: { Discipline: "parking_guardrail" },
        subtasks: [
          "ADA, fire-lane, & directional signage readability",
          "Light pole bases for corrosion / impact damage",
          "Catch basin grates secured",
          "Swale / drainage flow verified",
        ],
      },
      {
        section: "To Do",
        name: "Site & guardrail inspection complete",
        type: "MILESTONE",
        customFieldValues: { Discipline: "parking_guardrail" },
      },

      // ── Findings Compilation & Report ──────────────────────────
      {
        section: "To Do",
        name: "Findings consolidation",
        customFieldValues: { Discipline: "report" },
        subtasks: [
          "All discipline logs merged into master findings list",
          "Severity normalized across trades",
          "Photo logs cross-referenced to finding IDs",
          "Prior-cycle comparison (delta vs last recertification)",
        ],
      },
      {
        section: "To Do",
        name: "Repair priority matrix & ROM cost",
        customFieldValues: { Discipline: "report" },
        subtasks: [
          "Critical items priced (life-safety, immediate)",
          "Major items priced (within 6 months)",
          "Minor items priced (within 12 months)",
          "Monitoring items listed (no immediate action)",
          "Owner cost summary (ROM ±20%)",
        ],
      },
      {
        section: "To Do",
        name: "Recommendations memo",
        customFieldValues: { Discipline: "report" },
        subtasks: [
          "Structural recommendations",
          "Electrical + IR recommendations",
          "Illumination & egress recommendations",
          "Site / parking / guardrail recommendations",
          "Recommended maintenance schedule going forward",
        ],
      },
      {
        section: "To Do",
        name: "Draft narrative report",
        customFieldValues: { Discipline: "report" },
        subtasks: [
          "Executive summary",
          "Scope & methodology by discipline",
          "Building description & history",
          "Code & standard references",
          "Findings by discipline with severity table",
          "Appendices index",
        ],
      },
      {
        section: "To Do",
        name: "Photo log & appendices assembly",
        customFieldValues: { Discipline: "report" },
        subtasks: [
          "Indexed photo log by finding ID with captions",
          "IR + visible photo pairs",
          "Illumination grid map full size",
          "As-built plan markups with finding locations",
          "Test reports (load, IR, illumination)",
          "Prior recertification report (reference)",
        ],
      },
      {
        section: "To Do",
        name: "Internal QC — PE seal review",
        type: "APPROVAL",
        customFieldValues: { Discipline: "report" },
      },
      {
        section: "To Do",
        name: "Client preview & comment cycle",
        customFieldValues: { Discipline: "report" },
        subtasks: [
          "Deliver draft to owner / property mgmt",
          "Comment log received",
          "Comments resolved or rejected with rationale",
          "Version control of draft revisions",
        ],
      },
      {
        section: "To Do",
        name: "AHJ submittal package",
        customFieldValues: { Discipline: "report" },
        subtasks: [
          "Sealed report PDF + native files",
          "AHJ recertification form filled & signed",
          "Cover letter",
          "Supporting drawings, test reports & photos",
          "Submission fee paid",
          "Submission receipt archived",
        ],
      },
      {
        section: "To Do",
        name: "Report submitted to AHJ",
        type: "MILESTONE",
        customFieldValues: { Discipline: "report" },
      },
      {
        section: "To Do",
        name: "AHJ review & response cycle",
        customFieldValues: { Discipline: "report" },
        subtasks: [
          "AHJ comment letter received",
          "Comment-by-comment responses drafted",
          "Re-submission package issued",
          "Follow-up site visit scheduled (if requested)",
        ],
      },
      {
        section: "To Do",
        name: "Recertification approved",
        type: "MILESTONE",
        customFieldValues: { Discipline: "report" },
      },
      {
        section: "To Do",
        name: "Owner repair tracking & closeout",
        customFieldValues: { Discipline: "report" },
        subtasks: [
          "Critical items repair tracked to closure",
          "Major items repair tracked to closure",
          "Follow-up permits issued where required",
          "Final invoice issued",
          "Lessons learned debrief",
          "Calendar reminder for next 10-year cycle",
        ],
      },
    ],
    workflowTemplateId: "inspection-cycle",
  },
  {
    id: "building-safety-inspection",
    name: "Building safety inspection",
    description:
      "General-purpose building safety survey — pre-purchase due diligence, annual walkthrough, insurance-required inspection, or code-compliance review. Covers life safety, means of egress, visible structural / envelope / MEP, ADA, roof, and hazard ID. 5 status sections with a 'Category' custom field tagging every task by trade plus a 'Severity' field for findings. 28 parent tasks, 140+ subtasks, internal QC approval, and a delivery milestone.",
    icon: "ClipboardCheck",
    accent: "rose",
    category: "engineering",
    defaults: { type: "RECERTIFICATION", gate: "PRE_DESIGN", color: "#94a3b8" },
    // Same Asana paradigm B as the other engineering templates:
    // status sections + category custom field. A finding doesn't change
    // category as it progresses; it changes status.
    sections: ["To Do", "In Progress", "Under Review", "Approved", "Done"],
    customFields: [
      {
        name: "Category",
        type: "DROPDOWN",
        options: [
          { id: "engagement", label: "Engagement & Prep", color: "#888888" },
          { id: "life_safety", label: "Life Safety", color: "#dc2626" },
          { id: "egress", label: "Means of Egress", color: "#f59e0b" },
          { id: "structural", label: "Structural (visible)", color: "#c9a84c" },
          { id: "envelope", label: "Envelope", color: "#a8893a" },
          { id: "mep", label: "MEP (visible)", color: "#d4b65a" },
          { id: "ada", label: "ADA Accessibility", color: "#4a4a4a" },
          { id: "roof", label: "Roof", color: "#0a0a0a" },
          { id: "hazards", label: "Hazards", color: "#dc2626" },
          { id: "report", label: "Report & Delivery", color: "#94a3b8" },
        ],
      },
      {
        name: "Severity",
        type: "DROPDOWN",
        options: [
          { id: "critical", label: "Critical — immediate", color: "#dc2626" },
          { id: "major", label: "Major — within 6 mo", color: "#f59e0b" },
          { id: "minor", label: "Minor — within 12 mo", color: "#eab308" },
          { id: "monitor", label: "Monitoring only", color: "#94a3b8" },
          { id: "ok", label: "OK / Not applicable", color: "#10b981" },
        ],
      },
    ],
    tasks: [
      // ── Engagement & Preparation ───────────────────────────────
      {
        section: "To Do",
        name: "Project intake & scope agreement",
        customFieldValues: { Category: "engagement" },
        subtasks: [
          "Inspection purpose confirmed (due diligence / annual / insurance / code)",
          "Scope of work agreed & signed",
          "Fee proposal & retainer received",
          "Certificate of Insurance delivered",
          "Project number assigned",
        ],
      },
      {
        section: "To Do",
        name: "Pre-inspection document review",
        customFieldValues: { Category: "engagement" },
        subtasks: [
          "As-built / construction drawings",
          "Prior inspection reports",
          "Open / closed permits review",
          "Code occupancy classification & occupant load",
          "Prior insurance claims (if available)",
        ],
      },
      {
        section: "To Do",
        name: "Site access coordination",
        customFieldValues: { Category: "engagement" },
        subtasks: [
          "Access scheduled with owner / building rep",
          "On-site escort confirmed",
          "PPE & ladder / lift requirements briefed",
          "Equipment kit (camera, flashlight, moisture meter, lux meter, gauge)",
        ],
      },

      // ── Life Safety ────────────────────────────────────────────
      {
        section: "To Do",
        name: "Fire alarm & sprinkler system",
        customFieldValues: { Category: "life_safety" },
        subtasks: [
          "Fire alarm panel status & trouble lights",
          "Sprinkler riser room access",
          "Last 5-year sprinkler cert tag (NFPA 25)",
          "FDC connection accessible & capped",
          "Sprinkler heads unobstructed (18\" clearance)",
        ],
      },
      {
        section: "To Do",
        name: "Fire extinguishers & suppression",
        customFieldValues: { Category: "life_safety" },
        subtasks: [
          "Extinguisher count vs occupancy",
          "Travel distance ≤ 75 ft per NFPA 10",
          "Last inspection tag in date",
          "Mounting height & access clear",
          "Kitchen hood suppression last service (if applicable)",
        ],
      },
      {
        section: "To Do",
        name: "Smoke compartmentation & fire-rated assemblies",
        customFieldValues: { Category: "life_safety" },
        subtasks: [
          "Fire-rated doors operate & latch",
          "Door closers functional",
          "Fire-stops at penetrations (cables, pipes, ducts)",
          "Fire dampers accessible & labeled",
          "Smoke barriers continuous",
        ],
      },

      // ── Means of Egress ────────────────────────────────────────
      {
        section: "To Do",
        name: "Exit door inspection",
        customFieldValues: { Category: "egress" },
        subtasks: [
          "Hardware operates with single motion (IBC 1010.1.9)",
          "Panic hardware where required by occupancy",
          "Locks per IBC 1010.2 (no key required to exit)",
          "Exit signage illuminated & battery backup operational",
        ],
      },
      {
        section: "To Do",
        name: "Egress path width & obstructions",
        customFieldValues: { Category: "egress" },
        subtasks: [
          "Corridor width clearance",
          "No obstructions in path",
          "Slip-resistant surface check",
          "Contrasting handrails & visibility",
          "Common path of travel within code limit",
        ],
      },
      {
        section: "To Do",
        name: "Stairwell inspection",
        customFieldValues: { Category: "egress" },
        subtasks: [
          "Handrails both sides, continuous (IBC 1011)",
          "Riser & tread consistency",
          "Adequate lighting + emergency lighting",
          "Smoke-tight enclosure & self-closing doors",
          "Path markings (where required by high-rise codes)",
        ],
      },
      {
        section: "To Do",
        name: "Exit discharge",
        customFieldValues: { Category: "egress" },
        subtasks: [
          "Clear path from exit to public way",
          "Exterior egress lighting",
          "Accessible route from exit discharge",
          "No accumulating snow / debris zones",
        ],
      },

      // ── Structural (Visible) ───────────────────────────────────
      {
        section: "To Do",
        name: "Visible structural walkthrough",
        customFieldValues: { Category: "structural" },
        subtasks: [
          "Cracks, deflections, settlement evidence",
          "Water intrusion staining",
          "Spalling or rebar exposure",
          "Movement at expansion / control joints",
          "No destructive testing — visual only",
        ],
      },
      {
        section: "To Do",
        name: "Foundation visible inspection",
        customFieldValues: { Category: "structural" },
        subtasks: [
          "Cracks at foundation wall",
          "Differential settlement evidence",
          "Moisture at base of walls",
          "Sub-slab voids or movement indicators",
        ],
      },
      {
        section: "To Do",
        name: "Roof structure (interior view)",
        customFieldValues: { Category: "structural" },
        subtasks: [
          "Deck visible from below",
          "Water staining at ceiling",
          "Deflection or sag in members",
          "Truss / joist connection condition",
        ],
      },

      // ── Envelope ───────────────────────────────────────────────
      {
        section: "To Do",
        name: "Exterior walls & cladding",
        customFieldValues: { Category: "envelope" },
        subtasks: [
          "Cladding condition (brick, EIFS, stucco, panel)",
          "Sealant joints continuous & flexible",
          "Visible cracking pattern",
          "Efflorescence or staining",
        ],
      },
      {
        section: "To Do",
        name: "Windows & exterior doors",
        customFieldValues: { Category: "envelope" },
        subtasks: [
          "Glazing intact, no spider cracks",
          "Perimeter seals continuous",
          "Operability sample (open / close / lock)",
          "Water intrusion evidence at sills & jambs",
        ],
      },
      {
        section: "To Do",
        name: "Roof envelope",
        customFieldValues: { Category: "envelope" },
        subtasks: [
          "Membrane / shingle condition",
          "Flashing at penetrations",
          "Drains & scuppers clear",
          "Parapet caps & edge metal",
        ],
      },

      // ── MEP (Visible) ──────────────────────────────────────────
      {
        section: "To Do",
        name: "Electrical visible inspection",
        customFieldValues: { Category: "mep" },
        subtasks: [
          "Panels labeled & dead-fronts in place",
          "Working clearance per NEC 110.26",
          "No exposed conductors or open knockouts",
          "GFCI in wet locations",
          "Common-area lighting operational",
        ],
      },
      {
        section: "To Do",
        name: "Plumbing visible inspection",
        customFieldValues: { Category: "mep" },
        subtasks: [
          "Active leaks at visible piping",
          "Pipe supports & hangers",
          "Water heater TPR valve & discharge piping",
          "Backflow preventer present where required",
        ],
      },
      {
        section: "To Do",
        name: "HVAC visible inspection",
        customFieldValues: { Category: "mep" },
        subtasks: [
          "Equipment labels & service tags",
          "Air filters condition (sample)",
          "Condensate drainage operational",
          "Return-air paths unobstructed",
        ],
      },

      // ── ADA Accessibility ──────────────────────────────────────
      {
        section: "To Do",
        name: "Accessible route",
        customFieldValues: { Category: "ada" },
        subtasks: [
          "Slope ≤ 1:20 along route (5%)",
          "Cross-slope ≤ 1:48 (2%)",
          "Width ≥ 36\" continuous",
          "Level landings at door swings",
          "Transitions ≤ 1/2\" beveled",
        ],
      },
      {
        section: "To Do",
        name: "Accessible restroom",
        customFieldValues: { Category: "ada" },
        subtasks: [
          "Door clearance & maneuvering space",
          "Grab bars per ICC A117.1",
          "Mirror height ≤ 40\" AFF to bottom",
          "Lavatory clearance & insulated supply lines",
          "Accessible stall dimensions",
        ],
      },
      {
        section: "To Do",
        name: "Accessible parking",
        customFieldValues: { Category: "ada" },
        subtasks: [
          "Count per IBC Table 1106.1",
          "Van-accessible stall present (1 per 6 accessible)",
          "Signage compliant (min height & symbol)",
          "Route from accessible stall to entrance",
        ],
      },

      // ── Roof ───────────────────────────────────────────────────
      {
        section: "To Do",
        name: "Roof walk inspection",
        customFieldValues: { Category: "roof" },
        subtasks: [
          "Surface condition (membrane / shingle / metal)",
          "Ponding water evidence",
          "Penetrations sealed & in good repair",
          "Equipment supports & curbs",
          "Edge metal & coping condition",
          "Roof drain & overflow scupper check",
        ],
      },

      // ── Hazards ────────────────────────────────────────────────
      {
        section: "To Do",
        name: "Trip & fall hazards",
        customFieldValues: { Category: "hazards" },
        subtasks: [
          "Uneven flooring or transitions",
          "Loose mats & rugs",
          "Cord & cable management",
          "Lighting in stairs & dark corners",
        ],
      },
      {
        section: "To Do",
        name: "Hazardous materials (visible signs)",
        customFieldValues: { Category: "hazards" },
        subtasks: [
          "Lead paint suspect surfaces (pre-1978 buildings)",
          "Asbestos suspect materials (pre-1980 buildings)",
          "Visible mold growth",
          "Chemical storage & SDS posted",
        ],
      },
      {
        section: "To Do",
        name: "Security & emergency readiness",
        customFieldValues: { Category: "hazards" },
        subtasks: [
          "Security cameras operational (visual)",
          "AED location & inspection tag",
          "First aid station stocked & accessible",
          "Emergency plan posted",
        ],
      },

      // ── Report & Delivery ──────────────────────────────────────
      {
        section: "To Do",
        name: "Findings compilation",
        customFieldValues: { Category: "report" },
        subtasks: [
          "Severity-ranked master findings list",
          "Photos indexed to finding IDs",
          "Prior-report delta comparison (if applicable)",
          "Categorized by trade / responsibility",
        ],
      },
      {
        section: "To Do",
        name: "ROM cost estimate by priority",
        customFieldValues: { Category: "report" },
        subtasks: [
          "Critical (immediate) repairs priced",
          "Major (within 6 mo) repairs priced",
          "Minor (within 12 mo) repairs priced",
          "Life-safety items called out separately",
        ],
      },
      {
        section: "To Do",
        name: "Draft report",
        customFieldValues: { Category: "report" },
        subtasks: [
          "Executive summary",
          "Scope, methodology & limitations",
          "Findings table with severity",
          "Recommendations by category",
          "Photo appendix indexed",
        ],
      },
      {
        section: "To Do",
        name: "Internal QC — sign-off review",
        type: "APPROVAL",
        customFieldValues: { Category: "report" },
      },
      {
        section: "To Do",
        name: "Client review & revisions",
        customFieldValues: { Category: "report" },
        subtasks: [
          "Deliver draft to client",
          "Comment log received",
          "Revisions incorporated",
          "Final version control",
        ],
      },
      {
        section: "To Do",
        name: "Final report delivered",
        type: "MILESTONE",
        customFieldValues: { Category: "report" },
      },
      {
        section: "To Do",
        name: "Repair follow-up tracking",
        customFieldValues: { Category: "report" },
        subtasks: [
          "Critical items resolved & re-inspected",
          "Major items resolved",
          "Closeout report or letter issued (if scoped)",
          "Lessons learned + next-cycle reminder",
        ],
      },
    ],
    workflowTemplateId: "inspection-cycle",
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
