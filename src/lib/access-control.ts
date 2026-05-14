/**
 * access-control.ts — single source of truth for who can see what.
 *
 * Three things drive every "can access?" decision:
 *
 *   1. **WorkspaceRole** (OWNER / ADMIN / MEMBER / WORKER / GUEST /
 *      CLIENT) — platform-wide power. OWNER bypasses everything.
 *
 *   2. **Position level** (1–6) — derived from the user's Position
 *      enum. Drives "what can I see across the org?" rules. Higher
 *      level sees more. Defaults to L2 when no position is set.
 *
 *   3. **Department** (EXECUTIVE / ENGINEERING / ADMINISTRATION /
 *      MARKETING / FIELD / EXTERNAL) — silo rule. Engineering
 *      doesn't see Admin's internal tasks by default. EXECUTIVE
 *      and OWNER bypass the silo.
 *
 * This file exports PURE functions — no DB calls, no async. Call
 * sites resolve the user's effective access (level + dept +
 * workspaceRole) once at the top of an API/page, then use these
 * predicates to filter lists or gate UI.
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
  | "workflow"          // Per-project; visible L3+, edit L4+
  | "admin"             // Workspace admin (billing, members) — OWNER + ADMIN
  | "portal-admin";     // Client portal admin — L4+

export function canAccessSection(
  access: EffectiveAccess,
  section: AppSection
): boolean {
  // OWNER bypass — sees everything regardless of level.
  if (isWorkspaceOwner(access.workspaceRole)) return true;

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

    case "admin":
      // Workspace admin (billing, all members, workspace settings).
      // Owner-bypass already handled above; ADMIN of workspace can
      // also enter.
      return isWorkspaceAdmin(access.workspaceRole);

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

// ─── Project-detail tab access ────────────────────────────────

export type ProjectTab =
  | "overview"
  | "list"
  | "board"
  | "timeline"
  | "dashboard"
  | "calendar"
  | "workflow"
  | "messages"
  | "files"
  | "team";

/**
 * Tab visibility WITHIN a project the user has access to (i.e.
 * they're already a ProjectMember or workspace OWNER). The membership
 * check happens BEFORE this — these rules just decide which tabs
 * render inside an accessible project.
 */
export function canAccessProjectTab(
  access: EffectiveAccess,
  tab: ProjectTab
): boolean {
  if (isWorkspaceOwner(access.workspaceRole)) return true;
  const { level } = access;

  switch (tab) {
    case "overview":
    case "list":
    case "board":
    case "calendar":
    case "messages":
    case "files":
    case "team":
      return true;

    case "timeline":
    case "dashboard":
      // Production data — visible to everyone on the project.
      return true;

    case "workflow":
      // Hide automation panel from L1–L2 (junior + intern).
      return level >= 3;

    default: {
      const _exhaustive: never = tab;
      void _exhaustive;
      return false;
    }
  }
}

// ─── Activity / task visibility (Home feed + filters) ─────────

/**
 * Should this activity / task be visible to the user?
 *
 * Used by:
 *   • Home feed
 *   • Project task list (filter L1 out of management chatter)
 *   • Search results
 *   • Inbox notifications (when generating, not when rendering —
 *     filter at fan-out time)
 *
 * Rules:
 *   • OWNER + Executive (L5+) see EVERYTHING.
 *   • Within the same department, you see your level and below.
 *   • Cross-department by default is HIDDEN, except for
 *     PUBLIC-visibility content.
 *   • Always see content YOU authored or you're assigned to.
 *
 * The `actor` is who generated the activity (e.g., the assignee
 * of a task, the author of a message, the manager who closed a
 * milestone). If the actor's level > viewer's level AND they're
 * in the same dept, OR they're in a different dept altogether,
 * the activity is hidden.
 */
export interface ActivityActor {
  userId: string;
  level: 1 | 2 | 3 | 4 | 5 | 6;
  department: Department;
}

export interface ActivityScope {
  // Set true if this activity is on a task ASSIGNED TO the viewer
  // or AUTHORED BY them. Forces visibility.
  involvesViewer: boolean;
  // Set true if this is a PROJECT message / task in a project where
  // the viewer is a member. Membership doesn't auto-grant view, but
  // bumps the floor: project members see same-level peers across
  // departments within that project.
  inViewerProject: boolean;
  // Optional explicit visibility tag on the row (e.g. Task.visibility
  // in a future migration). PUBLIC overrides everything.
  visibility?: "PUBLIC" | "PROJECT" | "MANAGEMENT" | "EXECUTIVE" | "PRIVATE";
}

export function canSeeActivity(
  access: EffectiveAccess,
  actor: ActivityActor,
  scope: ActivityScope
): boolean {
  // Hard overrides.
  if (isWorkspaceOwner(access.workspaceRole)) return true;
  if (scope.involvesViewer) return true;
  if (scope.visibility === "PUBLIC") return true;
  if (scope.visibility === "PRIVATE") return false;

  // EXECUTIVE-tagged content needs L5+.
  if (scope.visibility === "EXECUTIVE") return access.level >= 5;
  // MANAGEMENT-tagged content needs L4+.
  if (scope.visibility === "MANAGEMENT") return access.level >= 4;

  // L5+ Executive sees everything by default.
  if (access.level >= 5) return true;

  // Same department — viewer sees same level and below.
  if (actor.department === access.department) {
    return actor.level <= access.level;
  }

  // Cross-department — only if the row is in a project the viewer
  // is on, AND the actor is L≤ viewer (you can see peers across
  // depts inside a shared project).
  if (scope.inViewerProject) {
    return actor.level <= access.level;
  }

  // Otherwise — cross-dept, no shared project, not involving viewer
  // → hidden.
  return false;
}

// ─── List-shape helpers ───────────────────────────────────────

/**
 * Filter an array of activity-like rows in one pass. The mapper
 * arg extracts the (actor, scope) for each row so this helper
 * stays type-agnostic.
 */
export function filterVisibleActivities<T>(
  access: EffectiveAccess,
  rows: T[],
  extract: (row: T) => { actor: ActivityActor; scope: ActivityScope }
): T[] {
  // Fast-path for owner / executive — skip the per-row check.
  if (isWorkspaceOwner(access.workspaceRole) || access.level >= 5) {
    return rows;
  }
  return rows.filter((row) => {
    const { actor, scope } = extract(row);
    return canSeeActivity(access, actor, scope);
  });
}

// ─── Page-level guards ────────────────────────────────────────

/**
 * The redirect target when a user hits a forbidden page directly
 * via URL. Used by page server components + middleware.
 */
export const FORBIDDEN_REDIRECT = "/home";

/**
 * Tiny convenience for page server components:
 *
 *   const access = await getEffectiveAccess(userId);
 *   if (!canAccessSection(access, "reporting")) {
 *     redirect(FORBIDDEN_REDIRECT);
 *   }
 */
export function assertSectionAccess(
  access: EffectiveAccess,
  section: AppSection
): void {
  if (!canAccessSection(access, section)) {
    throw new ForbiddenSectionError(section);
  }
}

export class ForbiddenSectionError extends Error {
  constructor(public section: AppSection) {
    super(`Forbidden access to section: ${section}`);
    this.name = "ForbiddenSectionError";
  }
}

// ─── Re-exports for convenience ───────────────────────────────

export { getLevel, getDepartment, isWorkspaceOwner, isWorkspaceAdmin };
