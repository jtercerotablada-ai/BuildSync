/**
 * Cross-component trigger for the project-creation gallery.
 *
 * The gallery (CreateProjectGallery) is mounted at the DashboardShell
 * level so it's always available regardless of which page the user is
 * on. Any descendant — sidebar, projects/all, teams pages, empty-state
 * CTAs — needs a way to *open* it without prop-drilling state through
 * every layer.
 *
 * This module dispatches a window CustomEvent the shell listens for.
 * Same pattern many design systems use for global commands (search,
 * command palette, etc.).
 *
 * Calling `openCreateProjectGallery()` from any client component opens
 * the gallery. The optional `teamId` is reserved for future use (e.g.
 * pre-selecting a team for the new project); for now it's recorded but
 * not consumed yet.
 */

export const OPEN_CREATE_PROJECT_EVENT = "buildsync:open-create-project-gallery";

export interface OpenCreateProjectDetail {
  teamId?: string | null;
}

export function openCreateProjectGallery(detail: OpenCreateProjectDetail = {}) {
  if (typeof window === "undefined") return;
  window.dispatchEvent(
    new CustomEvent<OpenCreateProjectDetail>(OPEN_CREATE_PROJECT_EVENT, {
      detail,
    })
  );
}

/**
 * Signal that the set of projects/teams changed (create, rename, archive,
 * duplicate, delete) so persistent client chrome — chiefly the Sidebar,
 * which caches its lists and only fetched them once on mount — can refetch
 * WITHOUT a full page reload. Same window-CustomEvent pattern as above;
 * fire it right after a successful mutation.
 */
export const SIDEBAR_REFRESH_EVENT = "buildsync:sidebar-refresh";

export function notifySidebarRefresh() {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent(SIDEBAR_REFRESH_EVENT));
}
