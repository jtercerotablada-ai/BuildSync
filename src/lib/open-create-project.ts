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
