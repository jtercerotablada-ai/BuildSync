/**
 * Display metadata for the Position and CompanyRole enums.
 *
 * These are separate from the Prisma enums themselves — keeping
 * the labels here gives the UI a single source of truth and lets
 * us localize / re-label without touching the DB.
 */

export type Position =
  | "CEO"
  | "COO"
  | "PRINCIPAL_ENGINEER"
  | "DIRECTOR_OF_ENGINEERING"
  | "OFFICE_ADMIN"
  | "ACCOUNTANT"
  | "HR"
  | "MARKETING"
  | "PROJECT_MANAGER"
  | "PROJECT_ENGINEER"
  | "SENIOR_STRUCTURAL_ENGINEER"
  | "STRUCTURAL_ENGINEER"
  | "JUNIOR_ENGINEER"
  | "DRAFTER"
  | "ENGINEERING_INTERN"
  | "ARCHITECT"
  | "CIVIL_ENGINEER"
  | "MEP_ENGINEER"
  | "GEOTECH_ENGINEER"
  | "SITE_SUPERINTENDENT"
  | "CONSULTANT"
  | "CONTRACTOR"
  | "OTHER";

export type CompanyRole =
  | "STRUCTURAL_ENGINEER"
  | "ARCHITECT"
  | "CIVIL_ENGINEER"
  | "MEP_ENGINEER"
  | "GEOTECH_ENGINEER"
  | "LANDSCAPE_ARCHITECT"
  | "GENERAL_CONTRACTOR"
  | "SUBCONTRACTOR"
  | "OWNER_DEVELOPER"
  | "CONSTRUCTION_MANAGER"
  | "COMMISSIONING_AGENT"
  | "INTERIOR_DESIGNER"
  | "SPECIALTY_CONSULTANT"
  | "BUILDING_DEPARTMENT_AHJ"
  | "OTHER";

export type WorkspaceRole =
  | "OWNER"
  | "ADMIN"
  | "MEMBER"
  | "WORKER"
  | "GUEST"
  | "CLIENT";

export type ProjectRole = "ADMIN" | "EDITOR" | "COMMENTER" | "VIEWER";

// ──────────────────────────────────────────────────────────────
// Position metadata
// ──────────────────────────────────────────────────────────────

// Org-chart departments — silos that determine cross-functional
// visibility. Engineering doesn't see Admin tasks by default; Admin
// doesn't see Engineering's internal RFIs by default; etc. CEO and
// EXECUTIVE-level positions bypass this rule and see everything.
export type Department =
  | "EXECUTIVE"        // CEO, COO, Principal — top of the org
  | "ENGINEERING"      // PE/PM/Engineers/Drafters/Interns
  | "ADMINISTRATION"   // Office Admin, Accountant, HR
  | "MARKETING"        // Marketing
  | "FIELD"            // Site supers
  | "EXTERNAL";        // Consultants, contractors (rare for employees)

interface PositionMeta {
  label: string;
  short: string;
  group: "Management" | "Engineering" | "Disciplines" | "Field" | "Other";
  // Hierarchy level — drives "what can I see?" rules. Higher level
  // sees everything at its level and below within the same dept (and
  // CEO/Executives see across depts).
  //   6 = CEO / Owner — sees everything, always
  //   5 = Executive (COO, Principal, Director)
  //   4 = Management (PM, PE, Office Admin)
  //   3 = Senior (Sr. Engineer, Accountant, HR)
  //   2 = Individual contributor (Engineer, Drafter, Marketing)
  //   1 = Junior / Intern — most restricted access
  level: 1 | 2 | 3 | 4 | 5 | 6;
  // Which org silo this position belongs to.
  department: Department;
  // Feature gates this position unlocks. Engineering features
  // (PE stamping in particular) read from this list.
  capabilities?: ("CAN_STAMP" | "CAN_APPROVE_SUBMITTAL")[];
}

export const POSITION_META: Record<Position, PositionMeta> = {
  // ── L6 — CEO ───────────────────────────────────────────────
  CEO: {
    label: "Chief Executive Officer",
    short: "CEO",
    group: "Management",
    level: 6,
    department: "EXECUTIVE",
  },

  // ── L5 — Executive ─────────────────────────────────────────
  COO: {
    label: "Chief Operating Officer",
    short: "COO",
    group: "Management",
    level: 5,
    department: "EXECUTIVE",
  },
  PRINCIPAL_ENGINEER: {
    label: "Principal Engineer",
    short: "Principal",
    group: "Management",
    level: 5,
    department: "EXECUTIVE",
    capabilities: ["CAN_STAMP", "CAN_APPROVE_SUBMITTAL"],
  },
  DIRECTOR_OF_ENGINEERING: {
    label: "Director of Engineering",
    short: "Director of Eng.",
    group: "Management",
    level: 5,
    department: "EXECUTIVE",
    capabilities: ["CAN_APPROVE_SUBMITTAL"],
  },

  // ── L4 — Management ────────────────────────────────────────
  PROJECT_MANAGER: {
    label: "Project Manager",
    short: "PM",
    group: "Engineering",
    level: 4,
    department: "ENGINEERING",
    capabilities: ["CAN_APPROVE_SUBMITTAL"],
  },
  PROJECT_ENGINEER: {
    label: "Project Engineer (PE)",
    short: "PE",
    group: "Engineering",
    level: 4,
    department: "ENGINEERING",
    capabilities: ["CAN_STAMP", "CAN_APPROVE_SUBMITTAL"],
  },
  OFFICE_ADMIN: {
    label: "Office Administrator",
    short: "Office Admin",
    group: "Management",
    level: 4,
    department: "ADMINISTRATION",
  },

  // ── L3 — Senior ────────────────────────────────────────────
  SENIOR_STRUCTURAL_ENGINEER: {
    label: "Senior Structural Engineer",
    short: "Sr. Structural",
    group: "Engineering",
    level: 3,
    department: "ENGINEERING",
  },
  ACCOUNTANT: {
    label: "Accountant",
    short: "Accountant",
    group: "Management",
    level: 3,
    department: "ADMINISTRATION",
  },
  HR: {
    label: "Human Resources",
    short: "HR",
    group: "Management",
    level: 3,
    department: "ADMINISTRATION",
  },

  // ── L2 — Individual contributor ────────────────────────────
  STRUCTURAL_ENGINEER: {
    label: "Structural Engineer",
    short: "Structural Eng.",
    group: "Engineering",
    level: 2,
    department: "ENGINEERING",
  },
  DRAFTER: {
    label: "Drafter / CAD Technician",
    short: "Drafter",
    group: "Engineering",
    level: 2,
    department: "ENGINEERING",
  },
  MARKETING: {
    label: "Marketing",
    short: "Marketing",
    group: "Management",
    level: 2,
    department: "MARKETING",
  },

  // ── L1 — Junior / Intern ───────────────────────────────────
  JUNIOR_ENGINEER: {
    label: "Junior Engineer",
    short: "Jr. Engineer",
    group: "Engineering",
    level: 1,
    department: "ENGINEERING",
  },
  ENGINEERING_INTERN: {
    label: "Engineering Intern",
    short: "Intern",
    group: "Engineering",
    level: 1,
    department: "ENGINEERING",
  },

  // ── Disciplinas (employees who do other-discipline work) ───
  // Defaulted to L3 ENGINEERING — these are usually mid-level engineers
  // who happen to specialize in something other than structural.
  ARCHITECT: {
    label: "Architect",
    short: "Architect",
    group: "Disciplines",
    level: 3,
    department: "ENGINEERING",
  },
  CIVIL_ENGINEER: {
    label: "Civil Engineer",
    short: "Civil Eng.",
    group: "Disciplines",
    level: 3,
    department: "ENGINEERING",
  },
  MEP_ENGINEER: {
    label: "MEP Engineer",
    short: "MEP Eng.",
    group: "Disciplines",
    level: 3,
    department: "ENGINEERING",
  },
  GEOTECH_ENGINEER: {
    label: "Geotechnical Engineer",
    short: "Geotech",
    group: "Disciplines",
    level: 3,
    department: "ENGINEERING",
  },

  // ── Campo y externos ──────────────────────────────────────
  SITE_SUPERINTENDENT: {
    label: "Site Superintendent",
    short: "Site Super",
    group: "Field",
    level: 4,
    department: "FIELD",
  },
  CONSULTANT: {
    label: "Consultant",
    short: "Consultant",
    group: "Field",
    level: 3,
    department: "EXTERNAL",
  },
  CONTRACTOR: {
    label: "Contractor",
    short: "Contractor",
    group: "Field",
    level: 3,
    department: "EXTERNAL",
  },

  // ── Catch-all ─────────────────────────────────────────────
  // Defaults to L2 ENGINEERING — the same default a customTitle
  // employee gets. Edit their position to bump them.
  OTHER: {
    label: "Other",
    short: "Other",
    group: "Other",
    level: 2,
    department: "ENGINEERING",
  },
};

// Departments + labels for filter UIs and badges.
export const DEPARTMENT_META: Record<
  Department,
  { label: string; short: string; color: string }
> = {
  EXECUTIVE: {
    label: "Executive",
    short: "Exec",
    color: "#c9a84c",
  },
  ENGINEERING: {
    label: "Engineering",
    short: "Eng",
    color: "#0a0a0a",
  },
  ADMINISTRATION: {
    label: "Administration",
    short: "Admin",
    color: "#a8893a",
  },
  MARKETING: {
    label: "Marketing",
    short: "Mkt",
    color: "#6b5419",
  },
  FIELD: {
    label: "Field",
    short: "Field",
    color: "#4a4a4a",
  },
  EXTERNAL: {
    label: "External",
    short: "Ext",
    color: "#9ca3af",
  },
};

export const POSITION_ORDER: Position[] = [
  "CEO",
  "COO",
  "PRINCIPAL_ENGINEER",
  "DIRECTOR_OF_ENGINEERING",
  "PROJECT_MANAGER",
  "PROJECT_ENGINEER",
  "SENIOR_STRUCTURAL_ENGINEER",
  "STRUCTURAL_ENGINEER",
  "JUNIOR_ENGINEER",
  "DRAFTER",
  "ENGINEERING_INTERN",
  "ARCHITECT",
  "CIVIL_ENGINEER",
  "MEP_ENGINEER",
  "GEOTECH_ENGINEER",
  "OFFICE_ADMIN",
  "ACCOUNTANT",
  "HR",
  "MARKETING",
  "SITE_SUPERINTENDENT",
  "CONSULTANT",
  "CONTRACTOR",
  "OTHER",
];

export function formatPosition(
  position: Position | null | undefined,
  customTitle?: string | null,
  jobTitle?: string | null
): string {
  if (!position) return jobTitle || "—";
  if (position === "OTHER") return customTitle || jobTitle || "Other";
  return POSITION_META[position]?.short || position;
}

// ──────────────────────────────────────────────────────────────
// CompanyRole metadata
// ──────────────────────────────────────────────────────────────

interface CompanyRoleMeta {
  label: string;
  short: string;
  // Color used for the company chip in messages, file folders,
  // RFI recipient pickers, etc. Monochrome + gold palette.
  color: string;
  // Whether this role is typically "engineering" (signs/stamps
  // drawings) vs. construction vs. owner-side.
  side: "engineering" | "construction" | "owner" | "authority" | "other";
}

export const COMPANY_ROLE_META: Record<CompanyRole, CompanyRoleMeta> = {
  STRUCTURAL_ENGINEER: {
    label: "Structural Engineer of Record",
    short: "Structural EOR",
    color: "#c9a84c",
    side: "engineering",
  },
  ARCHITECT: {
    label: "Architect of Record",
    short: "Architect",
    color: "#a8893a",
    side: "engineering",
  },
  CIVIL_ENGINEER: {
    label: "Civil Engineer",
    short: "Civil",
    color: "#8b6f24",
    side: "engineering",
  },
  MEP_ENGINEER: {
    label: "MEP Engineer",
    short: "MEP",
    color: "#6b5419",
    side: "engineering",
  },
  GEOTECH_ENGINEER: {
    label: "Geotechnical Engineer",
    short: "Geotech",
    color: "#4d3b10",
    side: "engineering",
  },
  LANDSCAPE_ARCHITECT: {
    label: "Landscape Architect",
    short: "Landscape",
    color: "#7a6428",
    side: "engineering",
  },
  GENERAL_CONTRACTOR: {
    label: "General Contractor",
    short: "GC",
    color: "#0a0a0a",
    side: "construction",
  },
  SUBCONTRACTOR: {
    label: "Subcontractor",
    short: "Sub",
    color: "#2a2a2a",
    side: "construction",
  },
  CONSTRUCTION_MANAGER: {
    label: "Construction Manager",
    short: "CM",
    color: "#1a1a1a",
    side: "construction",
  },
  COMMISSIONING_AGENT: {
    label: "Commissioning Agent",
    short: "CxA",
    color: "#3a3a3a",
    side: "construction",
  },
  OWNER_DEVELOPER: {
    label: "Owner / Developer",
    short: "Owner",
    color: "#d4b65a",
    side: "owner",
  },
  INTERIOR_DESIGNER: {
    label: "Interior Designer",
    short: "ID",
    color: "#9a7a30",
    side: "engineering",
  },
  SPECIALTY_CONSULTANT: {
    label: "Specialty Consultant",
    short: "Specialty",
    color: "#5a4818",
    side: "other",
  },
  BUILDING_DEPARTMENT_AHJ: {
    label: "Building Department / AHJ",
    short: "AHJ",
    color: "#4a4a4a",
    side: "authority",
  },
  OTHER: {
    label: "Other",
    short: "Other",
    color: "#6b7280",
    side: "other",
  },
};

export const COMPANY_ROLE_ORDER: CompanyRole[] = [
  "STRUCTURAL_ENGINEER",
  "ARCHITECT",
  "CIVIL_ENGINEER",
  "MEP_ENGINEER",
  "GEOTECH_ENGINEER",
  "LANDSCAPE_ARCHITECT",
  "INTERIOR_DESIGNER",
  "SPECIALTY_CONSULTANT",
  "GENERAL_CONTRACTOR",
  "CONSTRUCTION_MANAGER",
  "SUBCONTRACTOR",
  "COMMISSIONING_AGENT",
  "OWNER_DEVELOPER",
  "BUILDING_DEPARTMENT_AHJ",
  "OTHER",
];

// ──────────────────────────────────────────────────────────────
// Workspace + Project role metadata
// ──────────────────────────────────────────────────────────────

export const WORKSPACE_ROLE_META: Record<
  WorkspaceRole,
  { label: string; color: string; description: string }
> = {
  OWNER: {
    label: "Owner",
    color: "#c9a84c",
    description: "Full control of the workspace. Only one per workspace.",
  },
  ADMIN: {
    label: "Admin",
    color: "#a8893a",
    description: "Can create projects, invite people, manage billing.",
  },
  MEMBER: {
    label: "Member",
    color: "#0a0a0a",
    description: "Standard employee — can be added to projects.",
  },
  WORKER: {
    label: "Worker",
    color: "#4a4a4a",
    description: "Field staff / freelancer — limited platform access.",
  },
  GUEST: {
    label: "Guest",
    color: "#6b7280",
    description: "External collaborator — project-scoped access only.",
  },
  CLIENT: {
    label: "Client",
    color: "#d4b65a",
    description: "External client — sees only what's shared with them.",
  },
};

export const PROJECT_ROLE_META: Record<
  ProjectRole,
  { label: string; color: string; description: string }
> = {
  ADMIN: {
    label: "Admin",
    color: "#c9a84c",
    description: "Manage members + settings for this project.",
  },
  EDITOR: {
    label: "Editor",
    color: "#0a0a0a",
    description: "Edit tasks, files, schedule.",
  },
  COMMENTER: {
    label: "Commenter",
    color: "#4a4a4a",
    description: "Read + comment.",
  },
  VIEWER: {
    label: "Viewer",
    color: "#6b7280",
    description: "Read-only.",
  },
};

// ──────────────────────────────────────────────────────────────
// Helpers
// ──────────────────────────────────────────────────────────────

export function canStamp(position: Position | null | undefined): boolean {
  if (!position) return false;
  return POSITION_META[position]?.capabilities?.includes("CAN_STAMP") ?? false;
}

export function canApproveSubmittal(
  position: Position | null | undefined
): boolean {
  if (!position) return false;
  return (
    POSITION_META[position]?.capabilities?.includes("CAN_APPROVE_SUBMITTAL") ??
    false
  );
}

// ──────────────────────────────────────────────────────────────
// Org hierarchy helpers
// ──────────────────────────────────────────────────────────────

/**
 * The hierarchy level for a user, derived from their Position.
 * Defaults to L2 (Individual contributor) when position is null —
 * conservative middle-ground that gates Executive/Management
 * surfaces without locking newcomers out of their basic tasks.
 */
export function getLevel(position: Position | null | undefined): 1 | 2 | 3 | 4 | 5 | 6 {
  if (!position) return 2;
  return POSITION_META[position]?.level ?? 2;
}

/**
 * The department for a user. Defaults to ENGINEERING for nulls
 * (the most common case in our firm). Used to enforce silo rules
 * between Office Admin and Engineering content.
 */
export function getDepartment(
  position: Position | null | undefined
): Department {
  if (!position) return "ENGINEERING";
  return POSITION_META[position]?.department ?? "ENGINEERING";
}

/**
 * Bypass — workspace OWNER role is the universal "sees everything"
 * gate. CEO + Owner combine into one "you can do anything" check.
 * Whether you're at level 6 or not, being workspace OWNER overrides.
 */
export function isWorkspaceOwner(
  workspaceRole: WorkspaceRole | null | undefined
): boolean {
  return workspaceRole === "OWNER";
}

/**
 * Workspace-level admin (Owner or Admin). Used for sidebar gating
 * of /admin (workspace settings), Workflow editing, etc.
 */
export function isWorkspaceAdmin(
  workspaceRole: WorkspaceRole | null | undefined
): boolean {
  return workspaceRole === "OWNER" || workspaceRole === "ADMIN";
}
