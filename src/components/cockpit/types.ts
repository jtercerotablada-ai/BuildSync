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
  _count: { tasks: number };
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

export const TYPE_COLOR: Record<ProjectType, string> = {
  CONSTRUCTION: "#c9a84c", // gold
  DESIGN: "#4573D2", // blue
  RECERTIFICATION: "#a8893a", // bronze
  PERMIT: "#d28a4a", // orange
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

export const STATUS_COLOR: Record<ProjectStatus, string> = {
  ON_TRACK: "#5a8f5e",
  AT_RISK: "#d28a4a",
  OFF_TRACK: "#c44a5a",
  ON_HOLD: "#888888",
  COMPLETE: "#5a7d8f",
};
