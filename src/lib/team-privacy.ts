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
