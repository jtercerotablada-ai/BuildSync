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

interface PositionMeta {
  label: string;
  short: string;
  group: "Management" | "Engineering" | "Disciplines" | "Field" | "Other";
  // Feature gates this position unlocks. Engineering features
  // (PE stamping in particular) read from this list.
  capabilities?: ("CAN_STAMP" | "CAN_APPROVE_SUBMITTAL")[];
}

export const POSITION_META: Record<Position, PositionMeta> = {
  CEO: { label: "Chief Executive Officer", short: "CEO", group: "Management" },
  COO: { label: "Chief Operating Officer", short: "COO", group: "Management" },
  PRINCIPAL_ENGINEER: {
    label: "Principal Engineer",
    short: "Principal",
    group: "Management",
    capabilities: ["CAN_STAMP", "CAN_APPROVE_SUBMITTAL"],
  },
  DIRECTOR_OF_ENGINEERING: {
    label: "Director of Engineering",
    short: "Director of Eng.",
    group: "Management",
    capabilities: ["CAN_APPROVE_SUBMITTAL"],
  },
  OFFICE_ADMIN: {
    label: "Office Administrator",
    short: "Office Admin",
    group: "Management",
  },
  ACCOUNTANT: { label: "Accountant", short: "Accountant", group: "Management" },
  HR: { label: "Human Resources", short: "HR", group: "Management" },
  MARKETING: { label: "Marketing", short: "Marketing", group: "Management" },

  PROJECT_MANAGER: {
    label: "Project Manager",
    short: "PM",
    group: "Engineering",
    capabilities: ["CAN_APPROVE_SUBMITTAL"],
  },
  PROJECT_ENGINEER: {
    label: "Project Engineer (PE)",
    short: "PE",
    group: "Engineering",
    capabilities: ["CAN_STAMP", "CAN_APPROVE_SUBMITTAL"],
  },
  SENIOR_STRUCTURAL_ENGINEER: {
    label: "Senior Structural Engineer",
    short: "Sr. Structural",
    group: "Engineering",
  },
  STRUCTURAL_ENGINEER: {
    label: "Structural Engineer",
    short: "Structural Eng.",
    group: "Engineering",
  },
  JUNIOR_ENGINEER: {
    label: "Junior Engineer",
    short: "Jr. Engineer",
    group: "Engineering",
  },
  DRAFTER: {
    label: "Drafter / CAD Technician",
    short: "Drafter",
    group: "Engineering",
  },
  ENGINEERING_INTERN: {
    label: "Engineering Intern",
    short: "Intern",
    group: "Engineering",
  },

  ARCHITECT: { label: "Architect", short: "Architect", group: "Disciplines" },
  CIVIL_ENGINEER: {
    label: "Civil Engineer",
    short: "Civil Eng.",
    group: "Disciplines",
  },
  MEP_ENGINEER: {
    label: "MEP Engineer",
    short: "MEP Eng.",
    group: "Disciplines",
  },
  GEOTECH_ENGINEER: {
    label: "Geotechnical Engineer",
    short: "Geotech",
    group: "Disciplines",
  },

  SITE_SUPERINTENDENT: {
    label: "Site Superintendent",
    short: "Site Super",
    group: "Field",
  },
  CONSULTANT: { label: "Consultant", short: "Consultant", group: "Field" },
  CONTRACTOR: { label: "Contractor", short: "Contractor", group: "Field" },

  OTHER: { label: "Other", short: "Other", group: "Other" },
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
