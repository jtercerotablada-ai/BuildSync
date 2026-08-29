/**
 * Team privacy labels + icons — one source of truth.
 *
 * Team.privacy has THREE values in the schema (the team settings modal
 * and the create-team screen all offer the third), so the Private/Public
 * ternary that used to be copy-pasted across the team surfaces told the
 * whole firm that a "membership by request" team was open to anyone.
 * Every screen that shows privacy reads its label and icon from here.
 */

import { Globe, Lock, Mail } from "lucide-react";

export type TeamPrivacy = "PUBLIC" | "REQUEST_TO_JOIN" | "PRIVATE";

export const TEAM_PRIVACY_META = {
  PUBLIC: { label: "Public", icon: Globe },
  REQUEST_TO_JOIN: { label: "Membership by request", icon: Mail },
  PRIVATE: { label: "Private", icon: Lock },
} as const;

/**
 * Look up the label/icon for a privacy value. Falls back to Public for
 * any value the schema grows later, rather than rendering a blank badge.
 */
export function teamPrivacyMeta(privacy: string) {
  return TEAM_PRIVACY_META[privacy as TeamPrivacy] ?? TEAM_PRIVACY_META.PUBLIC;
}

/**
 * How an outsider gets in — the UI counterpart of what the join and
 * requests routes actually enforce:
 *
 *   INSTANT      POST /api/teams/:id/join adds them on the spot.
 *   REQUEST      POST /api/teams/:id/requests opens a PENDING row a
 *                team lead has to approve; /join answers 409.
 *   INVITE_ONLY  neither route admits them; a lead has to add them.
 *
 * Kept beside the labels so a screen can never offer a "Join" button for
 * a team whose route will refuse it — the class of bug that put an Invite
 * button in front of every member when only leads could use it.
 */
export type TeamJoinMode = "INSTANT" | "REQUEST" | "INVITE_ONLY";

export function teamJoinMode(privacy: string): TeamJoinMode {
  if (privacy === "PUBLIC") return "INSTANT";
  if (privacy === "REQUEST_TO_JOIN") return "REQUEST";
  return "INVITE_ONLY";
}

/**
 * Caption under the copyable invite link.
 *
 * It used to read "Anyone with this link can join the team", which was
 * wrong in all three cases: /api/teams/:id/join requires membership of
 * the team's workspace before it looks at privacy at all, answers 409 on
 * a REQUEST_TO_JOIN team, and 404s on a PRIVATE one. Passing the link to
 * an outsider does nothing.
 */
export function teamInviteLinkCaption(privacy?: string): string {
  switch (teamJoinMode(privacy ?? "")) {
    case "INSTANT":
      return "People already in this workspace can use this link to join. It does nothing for someone outside it — invite them by email above.";
    case "REQUEST":
      return "People already in this workspace can use this link to request to join. A team lead approves each request.";
    default:
      // Includes the unknown-privacy case: never promise more than the
      // narrowest branch actually allows.
      return "This team is private, so the link only opens its page — a team lead has to add people directly.";
  }
}
