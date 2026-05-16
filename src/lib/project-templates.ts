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
      "Full structural design playbook in five modules — sizing & loads, analysis & design, detailing, foundations, documentation. Pre-loaded with 41 parent tasks and ~150 subtasks so the work plan exists from day one. Comes with the calc package review workflow.",
    icon: "Building2",
    accent: "amber",
    category: "engineering",
    defaults: { type: "DESIGN", gate: "PRE_DESIGN", color: "#c9a84c" },
    sections: [
      "M1. Estructuración y cargas",
      "M2. Análisis y dimensionado",
      "M3. Detallado",
      "M4. Cimentaciones",
      "M5. Documentación",
    ],
    tasks: [
      // ── M1. Estructuración y cargas ────────────────────────────
      {
        section: "M1. Estructuración y cargas",
        name: "Introducción",
        subtasks: [
          "¿Qué es estructurar?",
          "Arquitectura",
          "Estudio de suelos",
          "Cargas",
          "Predimensionado",
        ],
      },
      {
        section: "M1. Estructuración y cargas",
        name: "Cargas",
        subtasks: [
          "Introducción y normativas",
          "Carga muerta o permanente",
          "Carga viva o variable",
          "Carga o acción de viento",
          "Carga o acción sísmica",
          "Empujes",
          "Otras",
        ],
      },
      {
        section: "M1. Estructuración y cargas",
        name: "Predimensionado de losas",
        subtasks: [
          "Introducción",
          "Tipos y selección",
          "Clasificación",
          "Comportamiento en 1D y 2D",
          "Secciones",
          "Predimensionado de losas en 1D",
          "Losas macizas en 1D",
          "Losas aligeradas en 1D",
          "Predimensionado de losas en 2D",
          "Losas macizas en 2D",
          "Losas aligeradas en 2D",
        ],
      },
      {
        section: "M1. Estructuración y cargas",
        name: "Predimensionado de vigas",
        subtasks: [
          "Introducción",
          "Vinculaciones",
          "Cuantías",
          "Vigas para losas 1D",
          "Vigas para losas 2D",
        ],
      },
      {
        section: "M1. Estructuración y cargas",
        name: "Predimensionado de columnas",
        subtasks: [
          "Introducción y tipologías",
          "Dimensiones",
          "Armaduras",
          "Cuantía mínima",
          "Cuantía máxima",
          "Columnas en proyecto",
          "Ejemplo de predimensionado",
        ],
      },
      {
        section: "M1. Estructuración y cargas",
        name: "Predimensionado de cimentaciones",
      },
      {
        section: "M1. Estructuración y cargas",
        name: "Estructuración",
        subtasks: [
          "Configuración estructural",
          "Criterios de estructuración",
          "Irregularidad estructural",
        ],
      },
      {
        section: "M1. Estructuración y cargas",
        name: "Estructuración en la práctica",
        subtasks: [
          "Ejemplo: Edificio E1 y E2",
          "Estructuración y predimensionado E1",
          "Estructuración y predimensionado E2",
          "Ejemplo: Casa C1",
          "Estructuración casa C1",
        ],
      },
      // ── M2. Análisis y dimensionado ────────────────────────────
      {
        section: "M2. Análisis y dimensionado",
        name: "Introducción",
        subtasks: ["Objetivo de la etapa", "¿Qué debemos verificar?"],
      },
      {
        section: "M2. Análisis y dimensionado",
        name: "Deformaciones verticales",
        subtasks: [
          "Deformaciones verticales",
          "Combinaciones de carga y secciones",
          "Valores admisibles",
          "Flechas dentro de CYPECAD",
        ],
      },
      {
        section: "M2. Análisis y dimensionado",
        name: "Deformaciones horizontales",
        subtasks: ["Deformaciones laterales y derivas", "Derivas por viento"],
      },
      {
        section: "M2. Análisis y dimensionado",
        name: "Verificaciones al análisis sísmico",
        subtasks: ["Verificaciones de resultados", "Derivas debido al sismo"],
      },
      {
        section: "M2. Análisis y dimensionado",
        name: "Verificaciones E.L.U.",
        subtasks: [
          "Verificaciones superficiales",
          "Verificaciones en columnas",
          "Verificaciones en vigas",
        ],
      },
      // ── M3. Detallado ─────────────────────────────────────────
      {
        section: "M3. Detallado",
        name: "Conceptos previos",
        subtasks: [
          "Introducción",
          "Adherencia y anclaje",
          "Anclaje con gancho",
          "Anclaje a compresión",
          "Empalmes, solapes y/o traslapes",
          "Longitud de desarrollo s/ACI",
          "Desarrollo con gancho s/ACI",
          "Desarrollo a compresión s/ACI",
          "Empalmes a tracción s/ACI",
          "Empalmes a compresión s/ACI",
        ],
      },
      {
        section: "M3. Detallado",
        name: "Columnas",
        subtasks: [
          "Introducción",
          "Armadura longitudinal",
          "Empalmes",
          "Refuerzo transversal",
          "Configuraciones CYPECAD",
          "Editor CYPECAD",
          "Ejemplo (Anclaje y Ld)",
          "Ejemplo (Longitudinal)",
          "Ejemplo (Transversal)",
        ],
      },
      {
        section: "M3. Detallado",
        name: "Vigas",
        subtasks: [
          "Armado longitudinal",
          "Longitud de desarrollo",
          "Refuerzo transversal",
          "Configuraciones CYPECAD",
          "Editor de vigas",
          "Ejemplo (Armadura longitudinal)",
          "Ejemplo (Armadura transversal)",
        ],
      },
      {
        section: "M3. Detallado",
        name: "Losas alivianadas 1D",
        subtasks: [
          "Introducción",
          "Armadura longitudinal",
          "Corte y armadura transversal",
          "Configuración CYPE",
          "Editor de resultados",
          "Ejemplo",
        ],
      },
      {
        section: "M3. Detallado",
        name: "Losas alivianadas 2D",
        subtasks: [
          "Introducción",
          "Configuraciones CYPE",
          "Detallado de losas con vigas",
          "Detallado de losas sin vigas",
        ],
      },
      {
        section: "M3. Detallado",
        name: "Muros de contención",
        subtasks: ["Introducción", "Configuraciones en CYPECAD", "Detallado"],
      },
      {
        section: "M3. Detallado",
        name: "Escaleras",
        subtasks: ["Introducción", "Configuración y detallado"],
      },
      // ── M4. Cimentaciones ─────────────────────────────────────
      {
        section: "M4. Cimentaciones",
        name: "Introducción",
        subtasks: [
          "Introducción",
          "Tipos de cimentaciones",
          "Conociendo el terreno",
          "Idealización",
          "Verificaciones",
          "Predimensionado",
          "Predimensionado de zapatas",
          "Predimensionado de losas",
          "Predimensionado de profundas",
        ],
      },
      {
        section: "M4. Cimentaciones",
        name: "Zapatas",
        subtasks: [
          "Conceptos previos",
          "Tipos según su forma",
          "Tipos según su posición",
          "Vigas de atado y equilibrio",
          "Verificaciones geotécnicas",
          "Presión de hundimiento",
          "Ejemplo de presión de hundimiento",
          "Asentamiento",
          "Esfuerzo medio y máximo",
          "Verificaciones estructurales",
          "Punzonamiento",
          "Corte tipo viga",
          "Diseño a flexión",
          "Vigas de equilibrio",
          "Configuraciones en CYPECAD",
          "Ejemplo de zapata céntrica",
          "Ejemplo de zapata excéntrica",
          "Ejemplo de zapata combinada",
        ],
      },
      {
        section: "M4. Cimentaciones",
        name: "Losas de cimentación",
        subtasks: [
          "Introducción y comportamiento",
          "Coeficiente de balasto",
          "Cálculo del coeficiente de balasto",
          "Tipos de losas",
          "Predimensionado",
          "Verificaciones geotécnicas",
          "Verificaciones estructurales",
          "Configuraciones CYPECAD",
          "Ejemplo",
        ],
      },
      {
        section: "M4. Cimentaciones",
        name: "Cimentaciones profundas",
        subtasks: [
          "Introducción y comportamiento",
          "Tipologías",
          "Geometría",
          "Diseño geotécnico",
          "Resistencia por punta — M. Analítico",
          "Resistencia por fuste — M. Analítico",
          "Métodos semi empíricos",
          "Capacidad estructural",
          "Comportamiento de encepados (parte 1)",
          "Comportamiento de encepados (parte 2)",
          "Configuraciones CYPECAD",
          "Ejemplos (parte 1)",
          "Ejemplos (parte 2)",
        ],
      },
      // ── M5. Documentación ─────────────────────────────────────
      {
        section: "M5. Documentación",
        name: "Introducción",
      },
      {
        section: "M5. Documentación",
        name: "Planos",
        subtasks: [
          "Planos",
          "Planos mínimos necesarios",
          "Cimentaciones",
          "Cimentaciones CYPECAD",
          "Columnas",
          "Columnas CYPECAD",
          "Losas",
          "Losas CYPECAD",
          "Vigas",
          "Vigas CYPECAD",
          "Muros de contención",
          "Muros de contención CYPECAD",
          "Elementos singulares",
        ],
      },
      {
        section: "M5. Documentación",
        name: "Memorias e informes",
        subtasks: ["Memoria de cálculo", "Informes", "Cuantificaciones"],
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
