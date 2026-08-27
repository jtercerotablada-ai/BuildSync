/**
 * Cross-component signal for "the unread notification count changed".
 *
 * The header's bell badge and the Inbox page each keep their own copy of
 * the unread count, and the header's copy was refreshed only by a 30s
 * poll. So on /inbox — where both are on screen at once — "Mark all as
 * read" dropped the tab badge to 0 while the bell directly above it kept
 * showing the old number for up to half a minute.
 *
 * Same window-CustomEvent pattern as OPEN_CREATE_PROJECT_EVENT in
 * lib/open-create-project: fire it right after a mutation that can move
 * the count. Pass the new server count when it is known; omit it to ask
 * listeners to refetch.
 */

export const NOTIFICATIONS_UNREAD_EVENT = "buildsync:notifications-unread";

export interface NotificationsUnreadDetail {
  count?: number;
}

export function notifyUnreadChanged(count?: number) {
  if (typeof window === "undefined") return;
  window.dispatchEvent(
    new CustomEvent<NotificationsUnreadDetail>(NOTIFICATIONS_UNREAD_EVENT, {
      detail: { count },
    })
  );
}
