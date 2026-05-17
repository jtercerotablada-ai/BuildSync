// Shared types for the CEO cockpit. Mirrors the shape returned by
// /api/dashboard/ceo. Kept loose on enums (string) so the UI doesn't
// crash if the DB has a value the client hasn't been recompiled for.

export type ProjectType = "CONSTRUCTION" | "DESIGN" | "RECERTIFICATION" | "PERMIT";
export type ProjectGate = "PRE_DESIGN" | "DESIGN" | "PERMITTING" | "CONSTRUCTION" | "CLOSEOUT";
export type ProjectStatus = "ON_TRACK" | "AT_RISK" | "OFF_TRACK" | "ON_HOLD" | "COMPLETE";

export interface CockpitProject {
  id: string;
  name: string;
  color: string;
  status: ProjectStatus;
  type: ProjectType | null;
  gate: ProjectGate | null;
  location: string | null;
  latitude: number | null;
  longitude: number | null;
  budget: number | null;
  currency: string | null;
  clientName: string | null;
  startDate: string | null;
  endDate: string | null;
  updatedAt: string;
  owner: { id: string; name: string | null; image: string | null } | null;
  // `completedTasks` is populated by /api/dashboard/ceo so PMI tiles
  // can compute real EV → SPI → % complete instead of always-zero.
  // Defaults to 0 for projects with no tasks completed yet.
  _count: { tasks: number; completedTasks: number };
}

export interface TeamMember {
  id: string;
  name: string | null;
  email: string;
  image: string | null;
  role: string;
  load: number; // number of in-flight tasks assigned
}

export interface CriticalTask {
  id: string;
  name: string;
  dueDate: string;
  priority: string;
  // `taskType` lets the Upcoming Milestones tile narrow to actual
  // milestones (taskType === "MILESTONE") instead of any task. Other
  // tiles (Priority Queue) ignore the field.
  taskType: "TASK" | "MILESTONE" | "APPROVAL" | null;
  project: { id: string; name: string; color: string; type: ProjectType | null };
  assignee: { id: string; name: string | null; image: string | null } | null;
}

export interface ActivityItem {
  id: string;
  name: string;
  completedAt: string | null;
  updatedAt: string;
  project: { id: string; name: string; color: string };
  assignee: { id: string; name: string | null; image: string | null } | null;
  creator: { id: string; name: string | null; image: string | null } | null;
}

export interface RevenueMonth {
  month: string;
  revenue: number;
}

// Capabilities flag returned alongside the data so the UI can
// gracefully degrade for lower-hierarchy viewers (L1–L3) without
// hard-coding role logic on the client. Mirrors what the API
// already computes from getEffectiveAccess() and isWorkspaceOwner().
export interface CockpitViewerCapabilities {
  canSeeFinancials: boolean;
  canSeeAllProjects: boolean;
  /** Hierarchy level 1-7; 5+ is "executive". */
  level: number;
}

export interface CockpitData {
  projects: CockpitProject[];
  countsByType: Record<ProjectType, number>;
  countsByGate: Record<ProjectGate, number>;
  kpis: {
    activeProjects: number;
    totalBudget: number;
    currency: string;
    pendingSignatures: number;
    teamUtilization: number;
  };
  team: TeamMember[];
  criticalPath: CriticalTask[];
  compliance: CockpitProject[];
  revenuePipeline: RevenueMonth[];
  activity: ActivityItem[];
  // Always present in the API response (route.ts line ~340). Made
  // optional here so older cached payloads parsed before this field
  // was typed don't crash the UI on first paint after a deploy.
  viewerCapabilities?: CockpitViewerCapabilities;
}

// ────────────────────────────────────────────────────────────
// Type label + color helpers used by every cockpit panel
// ────────────────────────────────────────────────────────────

export const TYPE_LABEL: Record<ProjectType, string> = {
  CONSTRUCTION: "Construction",
  DESIGN: "Design",
  RECERTIFICATION: "Recertification",
  PERMIT: "Permit",
};

// All-monochrome palette (black/white/gold). The four project types use
// shades within the gold family + a charcoal fallback so they remain
// visually distinguishable on the map and pipeline without introducing
// off-palette accent colors.
export const TYPE_COLOR: Record<ProjectType, string> = {
  CONSTRUCTION: "#c9a84c", // gold (primary brand accent)
  DESIGN: "#d4b65a",       // bright gold
  RECERTIFICATION: "#a8893a", // deep gold / bronze
  PERMIT: "#1a1a1a",       // black — outlined treatment in badges
};

export const GATE_LABEL: Record<ProjectGate, string> = {
  PRE_DESIGN: "Pre-Design",
  DESIGN: "Design",
  PERMITTING: "Permitting",
  CONSTRUCTION: "Construction",
  CLOSEOUT: "Closeout",
};

export const GATE_INDEX: Record<ProjectGate, number> = {
  PRE_DESIGN: 0,
  DESIGN: 1,
  PERMITTING: 2,
  CONSTRUCTION: 3,
  CLOSEOUT: 4,
};

// Status uses gold for active states, black for severe, gray for neutral.
// "At risk" gets a darker bronze to read distinctly from on-track gold,
// without resorting to amber/orange.
export const STATUS_COLOR: Record<ProjectStatus, string> = {
  ON_TRACK: "#c9a84c", // gold
  AT_RISK: "#a8893a",  // deep gold / bronze
  OFF_TRACK: "#0a0a0a", // black (the "severe" signal)
  ON_HOLD: "#888888",   // gray
  COMPLETE: "#d4b65a",  // bright gold (success, faded by context)
};
