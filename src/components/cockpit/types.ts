// Shared project-type vocabulary for the stage strip, the project overview
// and the Firm cockpit on /home. The cockpit's payload types live in
// @/lib/cockpit (the route builds them); they are re-exported here so the
// cockpit components have one place to import from.

export type ProjectType =
  | "CONSTRUCTION"
  | "DESIGN"
  | "RECERTIFICATION"
  | "PERMIT"
  | "BSIP";
export type ProjectStatus = "ON_TRACK" | "AT_RISK" | "OFF_TRACK" | "ON_HOLD" | "COMPLETE";

// ────────────────────────────────────────────────────────────
// Type label + color helpers
// ────────────────────────────────────────────────────────────

export const TYPE_LABEL: Record<ProjectType, string> = {
  CONSTRUCTION: "Construction",
  DESIGN: "Design",
  RECERTIFICATION: "Recertification",
  PERMIT: "Permit",
  BSIP: "BSIP",
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
  // Broward's BSIP is the same work as a recertification, so it sits in the
  // same bronze family — one shade darker, since the map and the pipeline
  // have to let the firm tell the two counties apart at a glance.
  BSIP: "#8a7028",         // dark bronze
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

export type {
  CockpitApprovalTask,
  CockpitJob,
  CockpitOverduePerson,
  CockpitOverdueTask,
  CockpitPayload,
  CockpitStageMove,
  CockpitUser,
} from "@/lib/cockpit";
