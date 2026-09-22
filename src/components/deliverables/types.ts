/**
 * Client-side shapes of the Deliverables API (src/app/api/deliverables/**,
 * src/app/api/projects/[projectId]/deliverables). The row/detail/revision
 * shapes are imported as TYPES ONLY from the serializer, so the client and
 * the server cannot drift field by field; `import type` is erased at build
 * time, so none of the serializer's Prisma imports reach the browser.
 */

import type {
  DeliverableDetailJSON,
  DeliverableEventJSON,
  DeliverableFileJSON,
  DeliverableRowJSON,
  RevisionJSON,
} from "@/lib/deliverable-serialize";
import type { DeliverableKind } from "@/lib/deliverables";

export type {
  DeliverableDetailJSON,
  DeliverableEventJSON,
  DeliverableFileJSON,
  DeliverableRowJSON,
  RevisionJSON,
  DeliverableKind,
};

export interface UserLite {
  id: string;
  name: string | null;
  image: string | null;
}

export interface DeliverablePermissions {
  canWrite: boolean;
  canSeal: boolean;
  canMoveStage: boolean;
  isWorkspaceOwner: boolean;
  /** OWNER or ADMIN of the project's workspace. */
  isWorkspaceManager: boolean;
}

/** The project fields the tab reads (IssueDialog prefill, suggestions). */
export interface DeliverableProjectInfo {
  id: string;
  name: string;
  /** The project's workspace — the one whose seats the Seal authority
   *  popover edits (and canSeal reads). Optional until the list route
   *  selects it; without it the API falls back to the primary workspace. */
  workspaceId?: string | null;
  type: string | null;
  stage: string | null;
  clientName: string | null;
  jurisdiction: string | null;
  clientContactName: string | null;
  clientContactEmail: string | null;
  permitNumber: string | null;
  caseNumber: string | null;
}

export type DeliverableCounts = Record<
  DeliverableKind,
  { open: number; total: number }
>;

export interface DeliverableListResponse {
  items: DeliverableRowJSON[];
  permissions: DeliverablePermissions;
  project: DeliverableProjectInfo;
  counts: DeliverableCounts;
  assignableUsers: UserLite[];
}

export interface StageOffer {
  from: { key: string; label: string };
  to: { key: string; label: string };
  prompt: string;
}

export interface ActionResponse {
  item: DeliverableRowJSON | null;
  stageOffer: StageOffer | null;
}
