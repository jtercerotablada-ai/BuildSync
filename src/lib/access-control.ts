/**
 * access-control.ts — single source of truth for who can see what.
 *
 * Three things drive every "can access?" decision:
 *
 *   1. **WorkspaceRole** (OWNER / ADMIN / MEMBER / WORKER / GUEST /
 *      CLIENT) — platform-wide power. OWNER and ADMIN bypass the
 *      section gates.
 *
 *   2. **Position level** (1–6) — derived from the user's Position
 *      enum. Drives "what can I see across the org?" rules. Higher
 *      level sees more. Defaults to L2 when no position is set.
 *
 *   3. **Department** — carried on EffectiveAccess for display; no
 *      department silo is enforced anywhere. (A per-project Workflow-tab
 *      rule and an activity silo filter used to live here, documented as
 *      gating the Home feed, search and inbox, while nothing called them.
 *      They were removed rather than left to read as enforced.)
 *
 * This file exports PURE functions — no DB calls, no async. Call
 * sites resolve the user's effective access once at the top of an
 * API/page, then gate sections with canAccessSection. PROJECT access is
 * not decided here: see @/lib/project-access.
 *
 * See feature-access-matrix.md in /docs for the human-readable
 * matrix that maps each section/page to who sees it.
 */

import {
  getLevel,
  getDepartment,
  isWorkspaceOwner,
  isWorkspaceAdmin,
  type Position,
  type Department,
  type WorkspaceRole,
} from "@/lib/people-types";

// ─── Effective access ──────────────────────────────────────────

/**
 * The bundle of fields that drives every access decision. Resolve
 * this ONCE per request (via getEffectiveAccess in auth-utils),
 * then pass it around to the pure predicates below.
 */
export interface EffectiveAccess {
  userId: string;
  workspaceId: string;
  workspaceRole: WorkspaceRole;
  position: Position | null;
  level: 1 | 2 | 3 | 4 | 5 | 6;
  department: Department;
}

// ─── Section access — the sidebar gate ────────────────────────

/**
 * Which sidebar / page sections the user can access. Used by:
 *   • Sidebar UI (to hide items the user can't reach)
 *   • Page-level guards (to redirect 403 → /home)
 *   • API endpoints (as a coarse pre-check before the per-row
 *     filter)
 *
 * If a section returns `false` here, the user shouldn't even know
 * it exists in the UI. For sections that always exist but show
 * filtered content (Home, My Tasks, Inbox, Projects), the section
 * itself returns `true` and the *content* gets filtered by the
 * specific helpers further down.
 */
export type AppSection =
  | "home"
  | "my-tasks"
  | "inbox"
  | "profile"
  | "settings"          // PERSONAL settings — everyone
  | "people"            // Directory — everyone
  | "projects"          // Project list — everyone sees their own
  | "teams"             // Teams (groups) — everyone sees their own
  | "portfolios"        // L3+
  | "goals"             // Everyone sees their own goals; full view L4+
  | "reporting"         // L3+ filtered, L5+ full
  | "templates"         // Everyone use; create L4+
  | "knowledge"         // Engineering knowledge base — everyone
  | "workflow"          // Per-project; visible L3+, edit L4+
  | "portal-admin";     // Client portal admin — L4+

export function canAccessSection(
  access: EffectiveAccess,
  section: AppSection
): boolean {
  // Workspace OWNER/ADMIN bypass — sees every section regardless of level.
  // ADMIN was missing here, so promoting a colleague to ADMIN without also
  // giving them a level-3 Position hid Portfolios and Reporting from someone
  // who can already read every project in the workspace.
  if (isWorkspaceAdmin(access.workspaceRole)) return true;

  const { level } = access;

  switch (section) {
    // Always-on sections (filtered content downstream).
    case "home":
    case "my-tasks":
    case "inbox":
    case "profile":
    case "settings":
    case "people":
    case "projects":
    case "teams":
    case "templates":
    case "knowledge":
      return true;

    case "goals":
      // Everyone sees their own goals (L1+); the page itself is open.
      return true;

    case "portfolios":
      // Portfolios = strategic grouping. Hidden from individual
      // contributors and below.
      return level >= 3;

    case "reporting":
      // Financial / utilization dashboards. Hidden from L1–L2.
      return level >= 3;

    case "workflow":
      // Workflow automation panel. Senior+ can view; managers edit.
      return level >= 3;

    case "portal-admin":
      // Client portal admin (manage external client accounts).
      // L4+ (Project Managers + Office Admin) handle client-facing
      // operations.
      return level >= 4;

    default: {
      // Exhaustiveness — TS will flag any new section that's not
      // in the switch.
      const _exhaustive: never = section;
      void _exhaustive;
      return false;
    }
  }
}

// ─── Page-level guards ────────────────────────────────────────

/**
 * The redirect target when a user hits a forbidden page directly
 * via URL. Used by page server components + middleware.
 */
export const FORBIDDEN_REDIRECT = "/home";

// ─── Re-exports for convenience ───────────────────────────────

export { getLevel, getDepartment, isWorkspaceOwner, isWorkspaceAdmin };
